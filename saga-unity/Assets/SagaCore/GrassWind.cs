using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0216 풀 포기 흔들림·바람 날 배율(고돗 G-0363 `weather_visual.gd` WIND_MUL·wind_target · G-0365 sway 짝).
    /// 풀 렌더러의 재질을 런타임 사본(셰이더 <see cref="ShaderName"/>, 값은 원래 glTFast 속성 그대로)으로 바꿔 끼우고 등록해 두면,
    /// 날씨 배율(바람 ×2.6 · 비 ×1.6 · 눈 ×1.3 · 그 밖 ×1)로 초당 0.5 씩 다가가며 0.5초마다 <c>_Sway = 기본(0.12) × 배율</c>.
    /// 들어올 때 이미 바람이면 바로 그 배율(<see cref="SetMul"/> — <see cref="SkyWeather.Install"/>). 모는 쪽은 SkyWeather.LateUpdate(WetGround 와 같은 자리).
    /// 정적 배칭되면 메시가 월드 좌표로 합쳐져 셰이더가 모델 높이를 못 읽으니, 서브메시별로 원본 메시의 높이를 UV.y 직선으로 맞춘 값
    /// <c>_SwayFit</c>(월드 m)을 넣는다. 공유 에셋(GLB 재질·.mat)은 안 바뀐다(사본만). 손잡이 <c>SAGA_GRASS_SWAY=0</c> = 끔(바꿔 끼우지도 않음 · 이미 등록된 것은 0).
    /// </summary>
    public static class GrassWind
    {
        public const string ShaderName = "Saga/GrassSway";
        /// <summary>기본 세기 — 고돗 G-0365 풀 포기 0.12 결.</summary>
        public const float BaseSway = 0.12f;
        /// <summary>배율이 다가가는 빠르기(초당) — 고돗 move_toward(delta·0.5).</summary>
        public const float ApproachPerSec = 0.5f;
        /// <summary>재질 갱신 간격(초) — 매 프레임 SetFloat 하지 않는다.</summary>
        public const float ApplyEvery = 0.5f;

        private static readonly int SwayId = Shader.PropertyToID("_Sway");
        private static readonly int FitId = Shader.PropertyToID("_SwayFit");

        private sealed class Entry { public Material M; public float Base; public Vector2 FitModel; public float ScaleSum; public int ScaleN; }

        private static readonly List<Entry> _mats = new List<Entry>();
        private static readonly Dictionary<(int src, int mesh, int sub), Material> _copies = new Dictionary<(int, int, int), Material>();
        private static readonly Dictionary<(int mesh, int sub), Vector2> _fits = new Dictionary<(int, int), Vector2>();
        private static Shader _shader;
        private static float _acc;
        private static float _applied = -1f;

        /// <summary>지금 날씨 배율(1 = 맑음 결).</summary>
        public static float Mul { get; private set; } = 1f;

        /// <summary>테스트용 손잡이 — null 이면 환경변수 SAGA_GRASS_SWAY 를 본다.</summary>
        public static bool? ForcedEnabled;
        public static bool Enabled => ForcedEnabled ?? Environment.GetEnvironmentVariable("SAGA_GRASS_SWAY") != "0";

        /// <summary>순수 셈 — 날씨별 목표 배율(고돗 WIND_MUL: wind 2.6 · rain 1.6 · snow 1.3 · 그 밖 1).</summary>
        public static float Target(SkyWeatherRules.Kind k)
        {
            switch (k)
            {
                case SkyWeatherRules.Kind.Wind: return 2.6f;
                case SkyWeatherRules.Kind.Rain: return 1.6f;
                case SkyWeatherRules.Kind.Snow: return 1.3f;
                default: return 1f;
            }
        }

        /// <summary>순수 셈 — 목표 쪽으로 초당 0.5 씩.</summary>
        public static float Step(float cur, float target, float dt) => dt <= 0f ? cur : Mathf.MoveTowards(cur, target, ApproachPerSec * dt);

        /// <summary>등록된(살아 있는) 재질 수.</summary>
        public static int Count { get { Prune(); return _mats.Count; } }

        public static bool IsRegistered(Material m)
        {
            if (m == null) return false;
            foreach (var e in _mats) if (e.M == m) return true;
            return false;
        }

        /// <summary>등록 재질의 지금 <c>_Sway</c>(없으면 -1).</summary>
        public static float SwayOf(Material m) => m != null && m.HasProperty(SwayId) ? m.GetFloat(SwayId) : -1f;

        /// <summary>흔들림 셰이더(빌드 포함은 SagaShaderKeep). 없으면 null — 그땐 풀을 안 바꾼다(옛 화면).</summary>
        public static Shader SwayShader => _shader != null ? _shader : (_shader = Shader.Find(ShaderName));

        /// <summary>
        /// 풀 렌더러 하나 — 재질마다(서브메시 i) GrassSway 사본으로 바꿔 끼우고 등록한다. <paramref name="srcMesh"/> = 원본 메시(배칭 전, 높이 맞춤용 — null 이면
        /// 렌더러 메시 경계 높이로 대충), <paramref name="scale"/> = 그 포기 크기(월드 배율). 같은 원본 재질·메시·서브메시는 사본 한 벌을 나눠 쓴다(배칭 묶음 그대로).
        /// 바꿔 끼운 재질 수를 돌려준다. 끔이거나 셰이더가 없으면 0(그대로).
        /// </summary>
        public static int Own(Renderer r, Mesh srcMesh, float scale)
        {
            if (r == null || !Enabled || SwayShader == null) return 0;
            var mats = r.sharedMaterials;
            int changed = 0;
            for (int i = 0; i < mats.Length; i++)
            {
                var src = mats[i];
                if (src == null) continue;
                if (src.shader == SwayShader)
                {
                    // 이미 사본(씬을 다시 훑음) — 진단 정리(ResetAll)로 목록에서 빠졌으면 다시 등록
                    if (!IsRegistered(src)) _mats.Add(new Entry { M = src, Base = BaseSway, FitModel = FitOf(srcMesh, i, r) });
                    AddScale(src, scale);
                    continue;
                }
                var key = (src.GetInstanceID(), srcMesh != null ? srcMesh.GetInstanceID() : 0, i);
                if (!_copies.TryGetValue(key, out var copy) || copy == null)
                {
                    copy = new Material(src) { name = src.name + " (sway)" };
                    copy.shader = SwayShader;
                    copy.renderQueue = src.renderQueue;
                    _copies[key] = copy;
                    var fit = FitOf(srcMesh, i, r);
                    _mats.Add(new Entry { M = copy, Base = BaseSway, FitModel = fit });
                }
                AddScale(copy, scale);
                mats[i] = copy;
                changed++;
            }
            if (changed > 0) r.sharedMaterials = mats;
            return changed;
        }

        private static void AddScale(Material m, float scale)
        {
            foreach (var e in _mats)
            {
                if (e.M != m) continue;
                e.ScaleSum += Mathf.Max(0.01f, scale); e.ScaleN++;
                float s = e.ScaleSum / e.ScaleN;
                m.SetVector(FitId, new Vector4(e.FitModel.x * s, e.FitModel.y * s, 0f, 0f));
                Apply(e);
                return;
            }
        }

        /// <summary>서브메시 높이(모델 단위) ≈ a + b·uv.y 최소제곱 — 뿌리(uv.y 0 쪽) 0. 못 읽으면 (0, 경계 높이).</summary>
        public static Vector2 FitOf(Mesh mesh, int sub, Renderer r = null)
        {
            if (mesh == null || !mesh.isReadable || sub >= mesh.subMeshCount)
            {
                float hgt = mesh != null ? mesh.bounds.max.y : r != null ? r.bounds.size.y / Mathf.Max(0.01f, r.transform.lossyScale.y) : 1f;
                return new Vector2(0f, Mathf.Max(0.01f, hgt));
            }
            var key = (mesh.GetInstanceID(), sub);
            if (_fits.TryGetValue(key, out var f)) return f;
            var verts = mesh.vertices;
            var uvs = new List<Vector2>();
            mesh.GetUVs(0, uvs);
            var idx = mesh.GetIndices(sub);
            var seen = new HashSet<int>();
            double n = 0, su = 0, sy = 0, suu = 0, suy = 0;
            foreach (int v in idx)
            {
                if (!seen.Add(v) || v >= uvs.Count) continue;
                double u = uvs[v].y, y = verts[v].y;
                n++; su += u; sy += y; suu += u * u; suy += u * y;
            }
            Vector2 fit;
            double den = n * suu - su * su;
            if (n < 2 || Math.Abs(den) < 1e-9) fit = new Vector2(0f, Mathf.Max(0.01f, mesh.bounds.max.y));
            else
            {
                double b = (n * suy - su * sy) / den, a = (sy - b * su) / n;
                fit = new Vector2((float)a, (float)b);
            }
            _fits[key] = fit;
            return fit;
        }

        /// <summary>바로 배율을 정하고 얹는다(들어올 때 이미 바람 · 진단).</summary>
        public static void SetMul(float mul)
        {
            Mul = Mathf.Max(0f, mul);
            _acc = 0f;
            ApplyAll();
        }

        /// <summary>한 틱 — 배율을 목표 쪽으로 셈하고 0.5초마다 재질에 얹는다.</summary>
        public static void Tick(SkyWeatherRules.Kind kind, float dt)
        {
            Mul = Step(Mul, Target(kind), dt);
            _acc += dt;
            if (_acc < ApplyEvery) return;
            _acc = 0f;
            float want = Enabled ? Mul : 0f;
            if (want != _applied) ApplyAll();
        }

        /// <summary>전부 0 으로 두고 목록을 비운다(진단 정리 — 사본은 렌더러에 그대로 남는다).</summary>
        public static void ResetAll()
        {
            foreach (var e in _mats) if (e.M != null) e.M.SetFloat(SwayId, 0f);
            _mats.Clear();
            _copies.Clear();
            Mul = 1f; _acc = 0f; _applied = -1f;
        }

        private static void ApplyAll()
        {
            Prune();
            foreach (var e in _mats) Apply(e);
            _applied = Enabled ? Mul : 0f;
        }

        private static void Apply(Entry e) => e.M.SetFloat(SwayId, Enabled ? e.Base * Mul : 0f);

        private static void Prune()
        {
            for (int i = _mats.Count - 1; i >= 0; i--) if (_mats[i].M == null) _mats.RemoveAt(i);
        }
    }
}
