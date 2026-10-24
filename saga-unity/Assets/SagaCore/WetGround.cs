using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0212 — 비 오는 날 땅 젖음(고돗 G-0359~0361 이식). 하늘 있는 세 판(1만리·3마을·4종횡)의 땅 재질을 등록해 두면
    /// 비가 오는 동안 20초에 걸쳐 젖고(색 ×0.64·거칠기 ×0.45 = 어둡고 매끈), 그치면 60초에 걸쳐 마른다.
    /// 재질의 **처음 값을 기억**해 그 값에 곱한다 — <c>Wet</c> 0 이면 처음 값 그대로(옛 화면). 공유 에셋(.mat)은 <see cref="Own"/> 이
    /// 런타임 사본으로 바꿔 끼운 뒤 등록하니 에셋 파일은 안 바뀐다. 모는 쪽은 <see cref="SkyWeather"/>(LateUpdate·Install).
    /// 손잡이 <c>SAGA_WET=0</c> = 끔(등록도 안 하고 젖지도 않음).
    /// U-0214 — 재질에 <c>_Wet</c>(평지 물웅덩이)·<c>_Rain</c>(빗방울 물결) 속성이 있으면 같이 채운다(셰이더 SagaWetPuddle.hlsl 은
    /// 웅덩이 층만 — 전체 색·거칠기 곱은 여기서 이미 함). <c>_Rain</c> 은 비 내리는 동안 3초에 걸쳐 1, 그치면 3초에 0.
    /// 겨울(<see cref="SkyWeatherRules.CurrentSeason"/> winter)엔 <c>_Wet</c> 0 — 땅 셰이더에 눈 판정이 없어 웅덩이를 안 만든다.
    /// </summary>
    public static class WetGround
    {
        public const float WetSeconds = 20f, DrySeconds = 60f;
        public const float ColorMul = 0.64f, RoughMul = 0.45f;
        /// <summary>재질 갱신 간격(초) — 매 프레임 SetFloat 하지 않는다.</summary>
        public const float ApplyEvery = 0.5f;
        /// <summary>U-0214 빗방울 물결 세기가 0↔1 오가는 시간(초).</summary>
        public const float RainSeconds = 3f;

        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");
        private static readonly int RoughnessId = Shader.PropertyToID("_Roughness");
        private static readonly int SmoothnessId = Shader.PropertyToID("_Smoothness");
        private static readonly int WetId = Shader.PropertyToID("_Wet");
        private static readonly int RainId = Shader.PropertyToID("_Rain");

        private sealed class Entry
        {
            public Material M;
            public int ColorProp = -1; public Color Color0;
            public int RoughProp = -1; public float Rough0;
            public bool Smooth;  // true 면 RoughProp 이 _Smoothness(1-거칠기)
            public bool Puddle;  // U-0214 _Wet·_Rain 속성 있음(웅덩이 층 셰이더)
        }

        private static readonly List<Entry> _mats = new List<Entry>();
        private static float _acc;
        private static float _applied = -1f;
        private static float _appliedRain = -1f;

        /// <summary>지금 젖음 0~1.</summary>
        public static float Wet { get; private set; }
        /// <summary>U-0214 빗방울 물결 세기 0~1(비 내리는 동안 1 쪽).</summary>
        public static float Rain { get; private set; }

        /// <summary>U-0214 웅덩이를 막는 철(겨울) — 테스트용 손잡이 null 이면 계절을 본다.</summary>
        public static bool? ForcedNoPuddles;
        public static bool NoPuddles => ForcedNoPuddles ?? SkyWeatherRules.CurrentSeason().Key == "winter";

        /// <summary>테스트용 손잡이 — null 이면 환경변수 SAGA_WET 을 본다.</summary>
        public static bool? ForcedEnabled;
        public static bool Enabled => ForcedEnabled ?? Environment.GetEnvironmentVariable("SAGA_WET") != "0";

        /// <summary>순수 셈 — 비면 20초에 0→1, 아니면 60초에 1→0.</summary>
        public static float WetStep(float wet, bool raining, float dt)
        {
            if (dt <= 0f) return Mathf.Clamp01(wet);
            return raining ? Mathf.Min(1f, wet + dt / WetSeconds) : Mathf.Max(0f, wet - dt / DrySeconds);
        }

        /// <summary>U-0214 순수 셈 — 비면 3초에 0→1, 아니면 3초에 1→0.</summary>
        public static float RainStep(float rain, bool raining, float dt)
        {
            if (dt <= 0f) return Mathf.Clamp01(rain);
            return raining ? Mathf.Min(1f, rain + dt / RainSeconds) : Mathf.Max(0f, rain - dt / RainSeconds);
        }

        /// <summary>젖음 w 일 때 색 곱·거칠기 곱.</summary>
        public static float ColorFactor(float w) => Mathf.Lerp(1f, ColorMul, Mathf.Clamp01(w));
        public static float RoughFactor(float w) => Mathf.Lerp(1f, RoughMul, Mathf.Clamp01(w));

        /// <summary>등록된(살아 있는) 재질 수.</summary>
        public static int Count { get { Prune(); return _mats.Count; } }

        public static bool IsRegistered(Material m)
        {
            if (m == null) return false;
            foreach (var e in _mats) if (e.M == m) return true;
            return false;
        }

        /// <summary>런타임에 만든 재질(에셋 아님)을 등록한다 — 처음 값을 기억하고 지금 젖음을 바로 얹는다.</summary>
        public static void Register(Material m)
        {
            if (m == null || !Enabled || IsRegistered(m)) return;
            Prune();
            var e = new Entry { M = m };
            if (m.HasProperty(BaseColorId)) { e.ColorProp = BaseColorId; e.Color0 = m.GetColor(BaseColorId); }
            else if (m.HasProperty(ColorId)) { e.ColorProp = ColorId; e.Color0 = m.GetColor(ColorId); }
            if (m.HasProperty(RoughnessId)) { e.RoughProp = RoughnessId; e.Rough0 = m.GetFloat(RoughnessId); }
            else if (m.HasProperty(SmoothnessId)) { e.RoughProp = SmoothnessId; e.Rough0 = m.GetFloat(SmoothnessId); e.Smooth = true; }
            e.Puddle = m.HasProperty(WetId) && m.HasProperty(RainId);
            if (e.ColorProp < 0 && e.RoughProp < 0) return;
            _mats.Add(e);
            if (Wet > 0f) Apply(e, Wet, Rain, NoPuddles);
        }

        /// <summary>렌더러의 재질(공유 에셋일 수 있음)을 런타임 사본으로 바꿔 끼우고 그 사본을 등록한다. 끔이면 그대로.</summary>
        public static Material Own(Renderer r)
        {
            if (r == null || r.sharedMaterial == null) return null;
            if (!Enabled) return r.sharedMaterial;
            if (IsRegistered(r.sharedMaterial)) return r.sharedMaterial;
            var copy = new Material(r.sharedMaterial) { name = r.sharedMaterial.name + " (wet)" };
            r.sharedMaterial = copy;
            Register(copy);
            return copy;
        }

        /// <summary>등록을 풀고 처음 값으로 되돌린다.</summary>
        public static void Unregister(Material m)
        {
            for (int i = _mats.Count - 1; i >= 0; i--)
                if (_mats[i].M == m) { if (m != null) Apply(_mats[i], 0f, 0f, true); _mats.RemoveAt(i); }
        }

        /// <summary>한 틱 — 젖음을 셈하고 0.5초마다 재질에 얹는다.</summary>
        public static void Tick(bool raining, float dt)
        {
            if (!Enabled) { if (Wet != 0f || Rain != 0f) SetWet(0f); return; }
            Wet = WetStep(Wet, raining, dt);
            Rain = RainStep(Rain, raining, dt);
            _acc += dt;
            if (_acc < ApplyEvery) return;
            _acc = 0f;
            if (Wet != _applied || Rain != _appliedRain) ApplyAll();
        }

        /// <summary>바로 젖음을 정하고 얹는다(씬에 들어올 때 이미 비면 1 · 진단). 물결 세기도 같은 값.</summary>
        public static void SetWet(float w) => SetWet(w, w);

        /// <summary>젖음·물결 세기를 따로 정하고 얹는다(진단 — 비 그친 뒤 젖은 채 물결만 0).</summary>
        public static void SetWet(float w, float rain)
        {
            Wet = Enabled ? Mathf.Clamp01(w) : 0f;
            Rain = Enabled ? Mathf.Clamp01(rain) : 0f;
            _acc = 0f;
            ApplyAll();
        }

        /// <summary>전부 처음 값으로 되돌리고 목록을 비운다(진단 정리).</summary>
        public static void ResetAll()
        {
            Wet = 0f; Rain = 0f;
            foreach (var e in _mats) if (e.M != null) Apply(e, 0f, 0f, true);
            _mats.Clear();
            _acc = 0f; _applied = -1f; _appliedRain = -1f;
        }

        private static void ApplyAll()
        {
            Prune();
            bool noPuddles = _mats.Count > 0 && Wet > 0f && NoPuddles;
            foreach (var e in _mats) Apply(e, Wet, Rain, noPuddles);
            _applied = Wet; _appliedRain = Rain;
        }

        private static void Apply(Entry e, float w, float rain, bool noPuddles)
        {
            if (e.Puddle)
            {
                // U-0214 웅덩이 층 — 겨울·젖음 0 이면 0(셰이더 분기 건너뜀 = 옛 화면)
                e.M.SetFloat(WetId, noPuddles ? 0f : Mathf.Clamp01(w));
                e.M.SetFloat(RainId, noPuddles || w <= 0f ? 0f : Mathf.Clamp01(rain));
            }
            if (e.ColorProp >= 0)
            {
                float k = ColorFactor(w);
                e.M.SetColor(e.ColorProp, w <= 0f ? e.Color0 : new Color(e.Color0.r * k, e.Color0.g * k, e.Color0.b * k, e.Color0.a));
            }
            if (e.RoughProp >= 0)
            {
                float f = RoughFactor(w);
                float v = w <= 0f ? e.Rough0 : e.Smooth ? 1f - (1f - e.Rough0) * f : e.Rough0 * f;
                e.M.SetFloat(e.RoughProp, v);
            }
        }

        private static void Prune()
        {
            for (int i = _mats.Count - 1; i >= 0; i--) if (_mats[i].M == null) _mats.RemoveAt(i);
        }
    }
}
