using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Saga.Core.Region;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0150 밤 불빛 — 자체툴 K-0155 가 등·횃불 9종 불 면을 `glow_fire`(화로·횃불대·촛대·등잔·벽 횃불)·`glow_lamp`(석등·가로등·탁상등·매단 등)
    /// 재질로 나누고 빈 노드 `light_point` 를 넣었고, 건물 창은 `glass`(알파 0.35 BLEND)다. 이 셋을 이름으로 찾아 **밤에만** 켠다.
    ///   불 면  = 사실 Lit 사본(`RegionMaterials` 원본 "LitGlow", 발광 켬) — 발광 = 불빛 색 × 세기 × <see cref="Level"/>. 낮엔 0(바탕 크림빛만).
    ///   창     = 낮엔 원래 유리 그대로, 밤엔 따뜻하게 빛나는 불투명 사본으로 바꿔 끼움(반투명 유리에 발광만 더하면 흐려서 안 보인다).
    ///   점광   = `light_point` 노드에 Point Light(그림자 없음, 불 #ffb060 6m·등 #ffd890 5m — 모델 크기 배율), 카메라 40m 안 가까운 8개만(모바일 추가 광원 한도).
    /// 세기 곡선 <see cref="LevelAt"/> = 밤 1 · 노을 0.5 · 새벽 0.3 · 낮 0 — `SkyPass.HourNow` 를 1초마다 읽는다. 하늘 없는 판(2나락 실내)은 불 면 늘 켬·점광 없음(횃불 HeroTorch 와 안 겹치게).
    /// 늦게 생기는 소품까지 잡으려고 2초마다 렌더러를 다시 훑는다(이미 본 것은 건너뜀). 재질 사본은 원본별 하나(캐시).
    /// 끄기 `SAGA_NO_NIGHTGLOW=1` · 배치 모드(헤드리스 진단)는 기본으로 안 돈다(진단은 <see cref="Sweep"/>·<see cref="Apply"/> 를 직접 부름).
    /// </summary>
    public static class NightGlow
    {
        public enum GlowKind { None, Fire, Lamp, Glass }

        public static readonly Color FireColor = new Color(1f, 0.69f, 0.38f);   // #ffb060 — 점광 빛깔
        public static readonly Color LampColor = new Color(1f, 0.85f, 0.56f);   // #ffd890
        // 발광 빛깔은 점광보다 진하게 — 밝은 값은 블룸·톤매핑 뒤 흰색으로 날린다(1만리 촬영 10-21: #ffd890×3 → 하얀 네모)
        public static readonly Color FireGlow = new Color(1f, 0.45f, 0.15f), LampGlow = new Color(1f, 0.62f, 0.28f), GlassColor = new Color(1f, 0.6f, 0.3f);
        public const float FireEmission = 1.6f, LampEmission = 1.2f, GlassEmission = 0.8f;
        public const float FireRange = 9f, LampRange = 8f, FireLight = 4f, LampLight = 3f;
        public const int MaxLights = 8;
        public const float LightRadius = 40f;
        private static readonly int EmissionId = Shader.PropertyToID("_EmissionColor");

        /// <summary>재질 이름 → 종류(대소문자 구분 — K-0155 규약은 소문자. glTFast·사본 꼬리 " (Instance)"·" (real)" 등은 무시, 앞머리만 본다).</summary>
        public static GlowKind KindOf(string materialName)
        {
            if (string.IsNullOrEmpty(materialName)) return GlowKind.None;
            if (materialName.StartsWith("glow_fire", System.StringComparison.Ordinal)) return GlowKind.Fire;
            if (materialName.StartsWith("glow_lamp", System.StringComparison.Ordinal)) return GlowKind.Lamp;
            if (materialName.StartsWith("glass", System.StringComparison.Ordinal)) return GlowKind.Glass;
            return GlowKind.None;
        }

        /// <summary>시각(0~24) → 불빛 세기 0~1. 밤 1 · 새벽 6시 0.3 · 7~17시 0 · 18시 노을 0.5 · 20시부터 1.</summary>
        public static float LevelAt(float hour)
        {
            hour = Mathf.Repeat(hour, 24f);
            if (hour < 5f) return 1f;
            if (hour < 6f) return Mathf.Lerp(1f, 0.3f, hour - 5f);
            if (hour < 7f) return Mathf.Lerp(0.3f, 0f, hour - 6f);
            if (hour < 17f) return 0f;
            if (hour < 18f) return Mathf.Lerp(0f, 0.5f, hour - 17f);
            if (hour < 20f) return Mathf.Lerp(0.5f, 1f, (hour - 18f) * 0.5f);
            return 1f;
        }

        /// <summary>지금 적용된 세기(진단).</summary>
        public static float Level { get; private set; } = -1f;
        /// <summary>하늘 없는 판(실내) — 불 면 늘 켬·점광 없음.</summary>
        public static bool Indoor { get => _indoor; set { if (_indoor != value) _dirty = true; _indoor = value; } }
        private static bool _indoor;

        private struct Slot { public Renderer r; public int i; public Material day, night; }
        private static readonly Dictionary<Material, Material> GlowCache = new Dictionary<Material, Material>();
        private static readonly Dictionary<Material, Material> GlassCache = new Dictionary<Material, Material>();
        private static readonly List<(Material m, GlowKind k)> GlowMats = new List<(Material, GlowKind)>();
        private static readonly List<Slot> GlassSlots = new List<Slot>();
        private static readonly List<(Light l, float baseIntensity)> Lights = new List<(Light, float)>();
        private static readonly HashSet<int> Seen = new HashSet<int>();
        private static bool _dirty;

        public static int GlowMaterialCount => GlowMats.Count;
        public static int GlassSlotCount => GlassSlots.Count;
        public static int LightCount => Lights.Count;
        public static int LitLightCount { get; private set; }

        /// <summary>진단·씬 바뀜 — 붙든 것 다 잊기(만든 사본·점광은 씬과 함께 사라진다).</summary>
        public static void Reset()
        {
            GlowMats.Clear(); GlassSlots.Clear(); Lights.Clear(); Seen.Clear();
            GlowCache.Clear(); GlassCache.Clear();
            Level = -1f; LitLightCount = 0;
        }

        /// <summary>불 면 재질 하나 — 사실 Lit 사본(원래 바탕색·그림, 발광 켬). `RegionMaterials.ForBackdrop` 도 부른다(늘 켜진 단색 Unlit 대신).</summary>
        public static Material GlowCopy(Material src)
        {
            var k = src == null ? GlowKind.None : KindOf(src.name);
            if (k != GlowKind.Fire && k != GlowKind.Lamp) return src;
            if (GlowCache.TryGetValue(src, out var done) && done != null) return done;
            if (src.name.EndsWith(" (night)"))   // 이미 사본(씬 바뀜·부트 전에 만든 것) — 붙들기만
            {
                if (!GlowMats.Exists(x => x.m == src)) GlowMats.Add((src, k));
                GlowCache[src] = src;
                return src;
            }
            var m = RegionMaterials.Make("LitGlow");
            if (m == null) return src;
            m.name = src.name.Split(' ')[0] + " (night)";
            m.SetColor("_BaseColor", ReadColor(src, k == GlowKind.Fire ? FireColor : LampColor, "baseColorFactor", "_BaseColor", "_Color"));
            // 바탕 그림은 안 씀 — K-0155 불 면은 단색이고, toon 판 묶음 그림이 끼면 낮에 갈색 판처럼 보인다(촬영 10-21)
            m.SetFloat("_Smoothness", 0.35f);
            m.SetFloat("_Metallic", 0f);
            m.EnableKeyword("_EMISSION");
            m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
            SetEmission(m, k, Level < 0f ? 0f : Level);
            GlowCache[src] = m;
            GlowMats.Add((m, k));
            return m;
        }

        private static Material NightGlass(Material src)
        {
            if (GlassCache.TryGetValue(src, out var done) && done != null) return done;
            var m = RegionMaterials.Make("LitGlow");
            if (m == null) return null;
            m.name = src.name.Split(' ')[0] + " (night)";
            m.SetColor("_BaseColor", new Color(0.22f, 0.18f, 0.14f));
            m.SetFloat("_Smoothness", 0.85f);
            m.SetFloat("_Metallic", 0f);
            m.EnableKeyword("_EMISSION");
            GlassCache[src] = m;
            GlowMats.Add((m, GlowKind.Glass));
            return m;
        }

        private static void SetEmission(Material m, GlowKind k, float level)
        {
            Color c; float s;
            switch (k)
            {
                case GlowKind.Fire: c = FireGlow; s = FireEmission; break;
                case GlowKind.Lamp: c = LampGlow; s = LampEmission; break;
                default: c = GlassColor; s = GlassEmission; break;
            }
            m.SetColor(EmissionId, c * (s * level));
        }

        /// <summary>렌더러들을 훑어 불 면·창·점광 자리를 붙든다(이미 본 렌더러는 건너뜀). 붙든 새 칸 수.</summary>
        public static int Sweep(IEnumerable<Renderer> renderers)
        {
            int n = 0;
            var mats = new List<Material>();
            foreach (var r in renderers)
            {
                if (r == null || r is ParticleSystemRenderer || r is TrailRenderer || r is LineRenderer) continue;
                if (!Seen.Add(r.GetInstanceID())) continue;
                if (RegionMaterials.IsCharacter(r)) continue;   // 인물·적 몸 재질에도 "Glass"(눈·면갑) 이름이 있다(1만리 StormWraith·Skeleton, 10-21)
                r.GetSharedMaterials(mats);
                bool changed = false, glow = false; GlowKind lightKind = GlowKind.None;
                for (int i = 0; i < mats.Count; i++)
                {
                    var src = mats[i];
                    if (src == null) continue;
                    var k = KindOf(src.name);
                    if (k == GlowKind.Fire || k == GlowKind.Lamp)
                    {
                        var g = GlowCopy(src);
                        if (g != src) { mats[i] = g; changed = true; }
                        glow = true; if (lightKind != GlowKind.Fire) lightKind = k; n++;
                    }
                    else if (k == GlowKind.Glass && !src.name.EndsWith(" (night)"))
                    {
                        var night = NightGlass(src);
                        if (night != null) { GlassSlots.Add(new Slot { r = r, i = i, day = src, night = night }); n++; }
                        if (Log) Debug.Log($"[NightGlow] 창 {r.name} ← {(r.transform.parent != null ? r.transform.parent.name : "-")} ← {(r.transform.parent?.parent != null ? r.transform.parent.parent.name : "-")}");
                    }
                }
                if (changed) r.SetSharedMaterials(mats);
                if (glow) AttachLight(r.transform, lightKind);
            }
            if (n > 0) _dirty = true;
            if (Level >= 0f) Apply(Level, null);
            return n;
        }

        /// <summary>불 면 렌더러 둘레(위로 세 단계까지)에서 `light_point` 노드를 찾아 점광을 단다(한 노드에 하나).</summary>
        private static void AttachLight(Transform t, GlowKind k)
        {
            if (Indoor) return;
            Transform node = null;
            var a = t;
            for (int up = 0; up < 3 && a != null && node == null; up++, a = a.parent)
                node = FindDeep(a, "light_point");
            if (node == null || node.GetComponent<Light>() != null) return;
            var l = node.gameObject.AddComponent<Light>();
            l.type = LightType.Point;
            l.shadows = LightShadows.None;
            l.color = k == GlowKind.Fire ? FireColor : LampColor;
            float scale = Mathf.Max(0.2f, node.lossyScale.y);
            l.range = (k == GlowKind.Fire ? FireRange : LampRange) * Mathf.Clamp(scale, 0.5f, 3f);
            l.intensity = 0f;
            l.enabled = false;
            Lights.Add((l, k == GlowKind.Fire ? FireLight : LampLight));
        }

        private static Transform FindDeep(Transform root, string prefix)
        {
            if (root.name.StartsWith(prefix)) return root;
            for (int i = 0; i < root.childCount; i++)
            {
                var f = FindDeep(root.GetChild(i), prefix);
                if (f != null) return f;
            }
            return null;
        }

        /// <summary>세기 적용 — 불 면·창 발광, 창 낮/밤 바꿔 끼움, 점광은 `cam` 둘레 가까운 <see cref="MaxLights"/> 개만(cam 이 없으면 순서대로).</summary>
        public static void Apply(float level, Camera cam)
        {
            float glowLevel = Indoor ? 1f : level;
            bool changed = _dirty || !Mathf.Approximately(level, Level);
            Level = level;
            _dirty = false;
            if (changed)
                foreach (var (m, k) in GlowMats) if (m != null) SetEmission(m, k, k == GlowKind.Glass ? level : glowLevel);
            // 창 — 낮/밤 바꿔 끼움. 씬 패스가 뒤에 유리를 다른 사본으로 갈아 끼웠으면 그것을 새 "낮" 으로 삼는다.
            bool night = level > 0.05f && !Indoor;
            var mats = new List<Material>();
            for (int si = 0; si < GlassSlots.Count; si++)
            {
                var s = GlassSlots[si];
                if (s.r == null) continue;
                s.r.GetSharedMaterials(mats);
                if (s.i >= mats.Count) continue;
                var cur = mats[s.i];
                if (cur != s.night && cur != s.day && cur != null && KindOf(cur.name) == GlowKind.Glass) { s.day = cur; GlassSlots[si] = s; }
                var want = night ? s.night : s.day;
                if (cur != want) { mats[s.i] = want; s.r.SetSharedMaterials(mats); }
            }
            Lights.RemoveAll(x => x.l == null);
            LitLightCount = 0;
            if (level <= 0.05f || Indoor) { foreach (var (l, _) in Lights) l.enabled = false; return; }
            var order = new List<(float d, int i)>();
            Vector3 c = cam != null ? cam.transform.position : Vector3.zero;
            for (int i = 0; i < Lights.Count; i++)
            {
                if (!Lights[i].l.gameObject.activeInHierarchy) continue;
                float d = cam != null ? Vector3.Distance(c, Lights[i].l.transform.position) : i;
                if (cam == null || d <= LightRadius) order.Add((d, i));
            }
            order.Sort((a, b) => a.d.CompareTo(b.d));
            var on = new HashSet<int>();
            for (int j = 0; j < order.Count && j < MaxLights; j++) on.Add(order[j].i);
            for (int i = 0; i < Lights.Count; i++)
            {
                var (l, bi) = Lights[i];
                bool e = on.Contains(i);
                l.enabled = e;
                l.intensity = bi * level;
                if (e) LitLightCount++;
            }
        }

        private static Color ReadColor(Material m, Color fallback, params string[] names)
        {
            foreach (var n in names) if (m.HasProperty(n)) return m.GetColor(n);
            return fallback;
        }

        /// <summary>촬영·진단 — 4초마다 한 줄(`SAGA_NIGHTGLOW_LOG=1`).</summary>
        public static bool Log = System.Environment.GetEnvironmentVariable("SAGA_NIGHTGLOW_LOG") == "1";

        public static bool ActiveByEnvironment()
        {
            if (System.Environment.GetEnvironmentVariable("SAGA_NO_NIGHTGLOW") == "1") return false;
            if (Application.isBatchMode && System.Environment.GetEnvironmentVariable("SAGA_NIGHTGLOW") != "1") return false;
            return true;
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            Reset();
            if (!ActiveByEnvironment()) return;
            var go = new GameObject("NightGlow") { hideFlags = HideFlags.HideAndDontSave };
            Object.DontDestroyOnLoad(go);
            go.AddComponent<Runner>();
            UnityEngine.SceneManagement.SceneManager.activeSceneChanged += (_, s) => { Reset(); Indoor = SkyPass.ModeFor(s.name) == SkyPass.Mode.None; };
            Indoor = SkyPass.ModeFor(UnityEngine.SceneManagement.SceneManager.GetActiveScene().name) == SkyPass.Mode.None;
        }

        private sealed class Runner : MonoBehaviour
        {
            private IEnumerator Start()
            {
                var wait = new WaitForSeconds(1f);
                int tick = 0;
                while (true)
                {
                    yield return null;   // 씬 패스(재질 바꾸기) 다음
                    if (tick++ % 2 == 0) Sweep(FindObjectsByType<Renderer>(FindObjectsInactive.Exclude, FindObjectsSortMode.None));
                    Apply(LevelAt(SkyPass.HourNow()), Camera.main);
                    if (Log && tick % 4 == 1)
                        Debug.Log($"[NightGlow] 세기 {Level:0.00} · 불 면 재질 {GlowMaterialCount} · 창 칸 {GlassSlotCount} · 점광 {LightCount}(켬 {LitLightCount}) · 실내 {Indoor} · 첫 점광 {(Lights.Count > 0 && Lights[0].l != null && Camera.main != null ? $"{Vector3.Distance(Camera.main.transform.position, Lights[0].l.transform.position):0}m 범위 {Lights[0].l.range:0.0} 켬 {Lights[0].l.gameObject.activeInHierarchy}" : "-")}");
                    yield return wait;
                }
            }
        }
    }
}
