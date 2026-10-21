using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Saga.Core.Region;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0148 툰 외곽선 — 인물만. `Saga/CelToon` 외곽선 패스는 있지만 모든 재질이 두께 0 이라 꺼져 있었다(U-0145 측정).
    /// 물체 단위 두께(`_OutlineWidth`)는 판마다 몸 크기(1만리 3.4m)·배율이 달라 굵기가 들쭉날쭉해, 셰이더에 **화면 기준 두께**
    /// `_OutlinePx`(1080p 픽셀, 4m→12m 에서 ×1→×0.5)를 더했고, 여기서 **인물 재질 사본**에만 그 값을 준다(공유 .mat 은 안 고침).
    ///   인물 = Animator 아래 렌더러(<see cref="RegionMaterials.IsCharacter"/>) · 재질이 `Saga/CelToon` · 불투명(렌더 큐 &lt; 2450) ·
    ///   이름이 눈·속눈썹·눈썹·입·홍채가 아님(얼굴 위 지저분한 선) · 이미 `_OutlineWidth` 를 쓰는 재질(무기 빛)은 그대로.
    /// 배경·땅·소품은 사실 PBR 이라 안 건드린다. 전역 배율 `_SagaOutlineMul` — 켜면 1, 화질 "낮음"(`MobileGraphics.ApplyQuality(false)`)이면 0.
    /// 늦게 생기는 몸(편성 교체·VRoid 바꿔 끼움·적)·뒤에 갈아 끼운 재질까지 잡으려고 1초마다 Animator 아래를 다시 훑는다(이미 외곽선이면 건너뜀).
    /// 끄기: `SAGA_NO_OUTLINE=1`. 배치 모드(헤드리스 진단)는 기본으로 안 돈다(켜려면 `SAGA_OUTLINE=1`).
    /// </summary>
    public static class CharacterOutline
    {
        public const float DefaultPx = 1.6f;
        public static readonly Color OutlineColor = new Color(0.08f, 0.06f, 0.10f, 1f);
        private static readonly string[] SkipNames = { "eye", "lash", "brow", "mouth", "iris", "highlight", "teeth", "tongue" };
        private static readonly int PxId = Shader.PropertyToID("_OutlinePx");
        private static readonly int WidthId = Shader.PropertyToID("_OutlineWidth");
        private static readonly int ColorId = Shader.PropertyToID("_OutlineColor");
        private static readonly int MulId = Shader.PropertyToID("_SagaOutlineMul");

        private static readonly Dictionary<Material, Material> Cache = new Dictionary<Material, Material>();

        /// <summary>진단 — 지금 전역 배율.</summary>
        public static float Mul => Shader.GetGlobalFloat(MulId);

        public static bool ActiveByEnvironment()
        {
            if (System.Environment.GetEnvironmentVariable("SAGA_NO_OUTLINE") == "1") return false;
            if (Application.isBatchMode && System.Environment.GetEnvironmentVariable("SAGA_OUTLINE") != "1") return false;
            return true;
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            Cache.Clear();
            _active = ActiveByEnvironment();
            Refresh();
            if (!_active) return;
            var go = new GameObject("CharacterOutline") { hideFlags = HideFlags.HideAndDontSave };
            Object.DontDestroyOnLoad(go);
            go.AddComponent<Runner>();
        }

        private static bool _active, _high = true;

        /// <summary>화질 높음/낮음 — `MobileGraphics.ApplyQuality` 가 부른다(낮음이면 외곽선 끔). 부트보다 먼저 와도 기억한다.</summary>
        public static void SetQuality(bool high) { _high = high; Refresh(); }

        /// <summary>진단 — 켬/끔을 손으로(부트 없이).</summary>
        public static void SetActiveForTest(bool on) { _active = on; Refresh(); }

        private static void Refresh() => Shader.SetGlobalFloat(MulId, _active && _high ? 1f : 0f);

        private sealed class Runner : MonoBehaviour
        {
            private IEnumerator Start()
            {
                var wait = new WaitForSeconds(1f);
                while (true)
                {
                    yield return null; // ToonScenePass(첫 프레임·두 프레임 뒤) 다음
                    // 이미 본 몸도 다시 훑는다 — 옷 입히기·툰 변환이 뒤에 재질을 새 사본으로 갈아 끼우기 때문(1만리 촬영 10-21).
                    // 이미 외곽선인 재질은 Eligible 에서 바로 빠져 값싸다.
                    foreach (var a in FindObjectsByType<Animator>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
                    {
                        if (a == null) continue;
                        int n = ApplyTo(a.gameObject);
                        if (LogApply && n > 0) Debug.Log($"[CharacterOutline] {a.name} 바꿈 {n} · 셰이더 {ShadersOf(a.gameObject)}");
                    }
                    yield return wait;
                }
            }
        }

        /// <summary>촬영·진단 — 몸마다 바꾼 칸·셰이더를 남긴다(`SAGA_OUTLINE_LOG=1`).</summary>
        public static bool LogApply = System.Environment.GetEnvironmentVariable("SAGA_OUTLINE_LOG") == "1";

        private static string ShadersOf(GameObject root)
        {
            var set = new SortedSet<string>();
            foreach (var r in root.GetComponentsInChildren<Renderer>(true))
                foreach (var m in r.sharedMaterials) if (m != null && m.shader != null) set.Add(m.shader.name + (m.HasProperty(PxId) && m.GetFloat(PxId) > 0f ? "*" + m.name + "@" + r.name + (r.enabled && r.gameObject.activeInHierarchy ? "" : "(꺼짐)") : ""));
            return string.Join(",", set) + $" · 전역 {Mul}";
        }

        /// <summary>한 몸(뿌리) 아래 인물 재질에 외곽선 사본을 낀다. 바꾼 칸 수.</summary>
        public static int ApplyTo(GameObject root, float px = DefaultPx)
        {
            if (root == null) return 0;
            int n = 0;
            var mats = new List<Material>();
            foreach (var r in root.GetComponentsInChildren<Renderer>(true))
            {
                if (r is ParticleSystemRenderer || r is TrailRenderer || r is LineRenderer || !RegionMaterials.IsCharacter(r)) continue;
                r.GetSharedMaterials(mats);
                bool any = false;
                for (int i = 0; i < mats.Count; i++)
                {
                    var m = Outlined(mats[i], px);
                    if (m != mats[i]) { mats[i] = m; any = true; n++; }
                }
                if (any) r.SetSharedMaterials(mats);
            }
            return n;
        }

        /// <summary>재질 하나 — 바꿀 대상이면 외곽선 사본(같은 원본은 같은 사본), 아니면 그대로.</summary>
        public static Material Outlined(Material src, float px = DefaultPx)
        {
            if (!Eligible(src)) return src;
            if (Cache.TryGetValue(src, out var done) && done != null) return done;
            var m = new Material(src) { name = src.name + " (outline)" };
            m.SetFloat(PxId, px);
            if (m.HasProperty(ColorId)) m.SetColor(ColorId, OutlineColor);
            Cache[src] = m;
            return m;
        }

        public static bool Eligible(Material m)
        {
            if (m == null || m.shader == null || m.shader.name != "Saga/CelToon" || !m.HasProperty(PxId)) return false;
            if (m.GetFloat(PxId) > 0f || m.GetFloat(WidthId) > 0f) return false; // 이미 외곽선(사본·무기 빛)
            if (m.renderQueue >= 2450) return false;                              // 알파 잘라내기·반투명
            string n = m.name.ToLowerInvariant();
            foreach (var s in SkipNames) if (n.Contains(s)) return false;
            return true;
        }
    }
}
