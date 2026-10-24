using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0151 빌린 3D 걷기 — Poly Haven 소품 id → 자체 짝(`SagaCore/Resources/World/&lt;짝&gt;.glb`, 표 `tools/world-forge/data/k129_unity.json` pair).
    /// 빌더 셋(1만리 `RegionPropsBuilder`·3마을 `ForestZonePropsBuilder`·2나락 `EraDecorBuilder`)은 짝이 있으면 그것을 옛 모델(또는 `#조각`)의
    /// 경계 상자 가운데·최대 변에 맞춰 세운다(`PairFitModels`). 옛 상자는 Poly Haven 폴더를 지운 뒤에도 쓰도록 `OldBoxes` 에 재어 둔 값.
    /// 짝이 없는 것(`new:` — K-0172 요청)은 옛 Poly Haven 그대로.
    /// 잴 때: `-executeMethod Saga.EditorTools.SelfPairs.Measure`(옛 모델이 있을 때만 — 표 줄을 찍는다).
    /// </summary>
    public static class SelfPairs
    {
        public const string WorldDir = "Assets/SagaCore/Resources/World/";
        public const string PolyDir = "Assets/Art/Props/PolyHaven/";

        /// <summary>Poly Haven id → 자체 짝(있는 것만 — 표의 `new:` 는 뺌).</summary>
        public static readonly Dictionary<string, string> Pairs = new Dictionary<string, string>
        {
            { "antique_estoc", "wpn_sword_rare" }, { "antique_katana_01", "wpn_sword_legend" }, { "barrel_03", "barrel_01" },
            { "brass_diya_lantern", "oil_lamp_01" }, { "dead_quiver_trunk", "tree_dead_01" }, { "dead_tree_trunk", "log_01" },
            { "fishermans_hat", "acc_hat_wide" }, { "hatchet", "wpn_axe_common" }, { "kite_shield", "wpn_shield_rare" },
            { "ornate_medieval_dagger", "wpn_dagger_rare" }, { "ornate_medieval_mace", "wpn_club_01" }, { "ornate_war_hammer", "wpn_axe_rare" },
            { "rock_moss_set_02", "rock_moss_01" }, { "round_spectacles", "acc_glasses_round" }, { "stone_fire_pit", "campfire_logs_01" },
            { "vintage_spacecraft_instrument", "terminal_01" }, { "wine_barrel_01", "keg_01" }, { "wooden_axe", "wpn_axe_common" },
            { "wooden_crate_01", "crate_small_01" }, { "wooden_handle_saber", "wpn_sword_common" }, { "wooden_lantern_01", "hanging_lantern_01" },
            // tasks U-0200 ② K-0172 마지막 10종(표의 `new:` 가 놓임)
            { "concrete_road_barrier_02", "road_barrier_01" }, { "covered_car", "covered_car_01" }, { "old_tyre", "old_tyre_01" },
            { "portable_generator", "generator_01" }, { "portable_searchlight", "searchlight_01" }, { "power_box_01", "power_box_01" },
            { "utility_box_01", "power_box_01" }, { "security_camera_02", "security_camera_01" }, { "wicker_basket_01", "wicker_basket_01" },
            { "wooden_bucket_01", "wooden_bucket_01" }, { "seadogs_compass", "pocket_compass_01" },
        };

        /// <summary>옛 Poly Haven 모델(키 = 표의 `Model` — `#조각` 이면 그 조각)의 제 좌표 경계 상자: 가운데 xyz · 최대 변 w. `Measure` 가 찍은 값.</summary>
        public static readonly Dictionary<string, Vector4> OldBoxes = new Dictionary<string, Vector4>
        {
            { "antique_estoc", new Vector4(0f, -0.001f, -0.547f, 1.492f) }, // 옛 0.37×0.15×1.49 · 짝 0.30×1.28×0.08
            { "antique_katana_01", new Vector4(0f, 0.195f, 0f, 1.003f) }, // 옛 0.09×1.00×0.09 · 짝 0.46×1.43×0.09
            { "barrel_03", new Vector4(0f, 0.465f, 0f, 0.93f) }, // 옛 0.63×0.93×0.64 · 짝 0.81×0.86×0.81
            { "brass_diya_lantern", new Vector4(-0.005f, 0.19f, -0.006f, 0.381f) }, // 옛 0.12×0.38×0.12 · 짝 0.30×0.32×0.24
            { "dead_quiver_trunk", new Vector4(0.017f, 1.009f, 0.003f, 1.994f) }, // 옛 0.31×1.99×0.27 · 짝 4.19×6.02×3.87
            { "dead_tree_trunk", new Vector4(0.014f, 0.117f, -0.032f, 3.051f) }, // 옛 3.05×0.29×0.28 · 짝 1.02×0.51×0.92
            { "fishermans_hat", new Vector4(0f, 0.028f, 0.003f, 0.35f) }, // 옛 0.32×0.12×0.35 · 짝 0.58×0.11×0.60
            { "hatchet", new Vector4(0f, 0.083f, 0.025f, 0.289f) }, // 옛 0.03×0.29×0.10 · 짝 0.05×1.33×0.30
            { "kite_shield", new Vector4(0f, -0.05f, 0.015f, 1.394f) }, // 옛 0.54×1.39×0.13 · 짝 0.65×1.06×0.21
            { "ornate_medieval_dagger", new Vector4(-0.02f, 0.096f, 0f, 0.349f) }, // 옛 0.12×0.35×0.02 · 짝 0.16×0.59×0.06
            { "ornate_medieval_mace", new Vector4(0f, 0.211f, 0f, 0.63f) }, // 옛 0.09×0.63×0.10 · 짝 0.18×0.87×0.19
            { "ornate_war_hammer", new Vector4(-0.005f, 0.205f, 0f, 0.711f) }, // 옛 0.14×0.71×0.03 · 짝 0.07×1.45×0.36
            { "rock_moss_set_02", new Vector4(-0.33f, 0.369f, -0.209f, 8.278f) }, // 옛 8.28×1.37×3.41 · 짝 2.40×0.99×1.88
            { "rock_moss_set_02#rock07", new Vector4(0.067f, 0.078f, -0.007f, 2.493f) }, // 옛 2.49×1.10×1.79 · 짝 2.40×0.99×1.88
            { "rock_moss_set_02#rock08", new Vector4(-0.069f, 0.253f, 0.048f, 1.206f) }, // 옛 1.21×0.53×0.98 · 짝 2.40×0.99×1.88
            { "rock_moss_set_02#rock09", new Vector4(-0.037f, 0.267f, -0.02f, 1.629f) }, // 옛 1.63×0.61×1.01 · 짝 2.40×0.99×1.88
            { "rock_moss_set_02#rock11", new Vector4(0.009f, 0.398f, -0.189f, 1.954f) }, // 옛 1.95×1.31×1.53 · 짝 2.40×0.99×1.88
            { "rock_moss_set_02#rock12", new Vector4(-0.032f, 0.336f, -0.005f, 1.58f) }, // 옛 1.58×0.74×1.44 · 짝 2.40×0.99×1.88
            { "rock_moss_set_02#rock13", new Vector4(0.039f, -0.031f, -0.565f, 2.091f) }, // 옛 2.09×1.26×1.14 · 짝 2.40×0.99×1.88
            { "round_spectacles", new Vector4(0f, 0f, -0.074f, 0.158f) }, // 옛 0.16×0.05×0.15 · 짝 0.20×0.06×0.12
            { "stone_fire_pit", new Vector4(0.012f, 0.001f, 0.002f, 1.448f) }, // 옛 1.45×0.39×1.43 · 짝 1.78×0.81×1.81
            { "vintage_spacecraft_instrument", new Vector4(0f, 0f, 0.017f, 0.41f) }, // 옛 0.41×0.27×0.20 · 짝 0.70×1.45×0.53
            { "wine_barrel_01", new Vector4(0f, 0.436f, 0.007f, 0.871f) }, // 옛 0.74×0.87×0.76 · 짝 0.53×0.60×0.68
            { "wooden_axe", new Vector4(0f, 0.097f, 0.071f, 0.63f) }, // 옛 0.05×0.63×0.21 · 짝 0.05×1.33×0.30
            { "wooden_crate_01", new Vector4(0f, 0.167f, 0.008f, 0.825f) }, // 옛 0.83×0.35×0.41 · 짝 0.52×0.46×0.52
            { "wooden_handle_saber", new Vector4(0f, 0.372f, -0.004f, 0.935f) }, // 옛 0.03×0.94×0.12 · 짝 0.25×1.12×0.06
            { "wooden_lantern_01", new Vector4(0f, 0.254f, 0.007f, 0.53f) }, // 옛 0.22×0.53×0.23 · 짝 0.40×0.75×0.40
            // tasks U-0200 ② K-0172 10종(10-24 Measure)
            { "concrete_road_barrier_02", new Vector4(-0.007f, 0.553f, -0.033f, 1.565f) }, // 옛 1.57×1.11×0.44 · 짝 1.56×1.10×0.44
            { "covered_car", new Vector4(-0.048f, 0.706f, 0.024f, 4.38f) }, // 옛 1.79×1.41×4.38 · 짝 4.40×1.63×1.84
            { "old_tyre", new Vector4(0f, 0f, 0f, 0.6f) }, // 옛 0.60×0.60×0.17 · 짝 0.60×0.17×0.60
            { "portable_generator", new Vector4(0.005f, 0.289f, 0f, 0.818f) }, // 옛 0.82×0.58×0.56 · 짝 0.79×0.56×0.56
            { "portable_searchlight", new Vector4(0f, 0.01f, -0.001f, 0.253f) }, // 옛 0.17×0.19×0.25 · 짝 0.15×0.26×0.15
            { "power_box_01", new Vector4(0.056f, 0f, 0.153f, 0.503f) }, // 옛 0.46×0.50×0.40 · 짝 0.54×1.12×0.44
            { "seadogs_compass", new Vector4(-0.003f, 0.044f, -0.012f, 0.15f) }, // 옛 0.08×0.09×0.15 · 짝 0.08×0.10×0.03
            { "security_camera_02", new Vector4(0f, 0.06f, 0.197f, 0.394f) }, // 옛 0.14×0.21×0.39 · 짝 0.12×0.26×0.35
            { "utility_box_01", new Vector4(0f, 0.56f, 0.006f, 1.12f) }, // 옛 0.52×1.12×0.43 · 짝 0.54×1.12×0.44
            { "wicker_basket_01", new Vector4(0f, 0.058f, 0f, 0.383f) }, // 옛 0.38×0.12×0.30 · 짝 0.39×0.30×0.39
            { "wooden_bucket_01", new Vector4(0.001f, 0.275f, 0.001f, 0.55f) }, // 옛 0.37×0.55×0.34 · 짝 0.35×0.35×0.35
        };

        /// <summary>옛 키(m) — `keepHeight` 면 짝이 옛것보다 납작할 때 이 키에 맞춘다(1만리 여울 바위가 물에 잠기지 않게 · 2나락 방은 커지면 벽에 박혀 안 씀). 바위만.</summary>
        public static readonly Dictionary<string, float> OldHeights = new Dictionary<string, float>
        {
            { "rock_moss_set_02", 1.37f }, { "rock_moss_set_02#rock07", 1.10f }, { "rock_moss_set_02#rock08", 0.53f }, { "rock_moss_set_02#rock09", 0.61f },
            { "rock_moss_set_02#rock11", 1.31f }, { "rock_moss_set_02#rock12", 0.74f }, { "rock_moss_set_02#rock13", 1.26f },
        };

        /// <summary>축마다 옛 크기에 맞출 것 — 누운 가는 통나무(3.05×0.29×0.28)는 짝 log_01(1.61×0.81×0.48)을 같은 배율로 키우면 굵기 1.5m 원기둥이 된다.</summary>
        public static readonly Dictionary<string, Vector3> OldAxes = new Dictionary<string, Vector3>
        {
            { "dead_tree_trunk", new Vector3(3.051f, 0.29f, 0.28f) },
        };

        public static string IdOf(string key)
        {
            int hash = key.IndexOf('#');
            return hash >= 0 ? key.Substring(0, hash) : key;
        }

        /// <summary>짝 모델(없으면 null).</summary>
        public static GameObject PairModel(string polyId) =>
            polyId != null && Pairs.TryGetValue(polyId, out var pair) ? AssetDatabase.LoadAssetAtPath<GameObject>(WorldDir + pair + ".glb") : null;

        /// <summary>짝 먼저, 없으면 옛 Poly Haven(꾸밈·정령처럼 크기를 받는 쪽이 재는 자리).</summary>
        public static GameObject Model(string polyId) =>
            PairModel(polyId) ?? AssetDatabase.LoadAssetAtPath<GameObject>($"{PolyDir}{polyId}/{polyId}_1k.gltf");

        /// <summary>표 `Model` 키들 중 짝이 있는 것 → (키, 짝 모델, 맞춤 xyz 옮김·w 배율). 빌더 `InitPairs` 로 넘긴다.</summary>
        public static void PairFitModels(IEnumerable<string> keys, out string[] outKeys, out GameObject[] outModels, out PairFit.Fit[] outFits, bool keepHeight = false)
        {
            var k = new List<string>();
            var m = new List<GameObject>();
            var f = new List<PairFit.Fit>();
            foreach (var key in keys.Distinct())
            {
                var pair = PairModel(IdOf(key));
                if (pair == null) continue;
                if (!OldBoxes.TryGetValue(key, out var old)) { Debug.LogWarning($"[SelfPairs] {key} 옛 상자 값 없음 — 옛 모델 그대로"); continue; }
                if (!Box(pair, null, out var nb)) continue;
                float s = old.w / Mathf.Max(MaxSide(nb.size), 1e-4f);
                if (keepHeight && OldHeights.TryGetValue(key, out float oh)) s = Mathf.Max(s, oh / Mathf.Max(nb.size.y, 1e-4f));
                var sv = Vector3.one * s;
                if (OldAxes.TryGetValue(key, out var ax)) sv = new Vector3(ax.x / Mathf.Max(nb.size.x, 1e-4f), ax.y / Mathf.Max(nb.size.y, 1e-4f), ax.z / Mathf.Max(nb.size.z, 1e-4f));
                var c = new Vector3(old.x, old.y, old.z) - Vector3.Scale(nb.center, sv);
                k.Add(key); m.Add(pair); f.Add(new PairFit.Fit { Offset = c, Scale = sv });
            }
            outKeys = k.ToArray(); outModels = m.ToArray(); outFits = f.ToArray();
        }

        /// <summary>꾸밈(`PartyBodies.gearScales`) — 짝을 옛 모델 최대 변에 맞추는 배율(짝 없으면 1).</summary>
        public static float GearScale(string polyId)
        {
            var pair = PairModel(polyId);
            if (pair == null || !OldBoxes.TryGetValue(polyId, out var old) || !Box(pair, null, out var nb)) return 1f;
            return old.w / Mathf.Max(MaxSide(nb.size), 1e-4f);
        }

        private static float MaxSide(Vector3 v) => Mathf.Max(v.x, Mathf.Max(v.y, v.z));

        /// <summary>모델(또는 이름이 `part` 로 끝나는 조각)을 원점·단위로 세워 잰 경계 상자.</summary>
        public static bool Box(GameObject src, string part, out Bounds b)
        {
            b = default;
            if (part != null)
            {
                var t = src.GetComponentsInChildren<Transform>(true).FirstOrDefault(x => x != src.transform && x.name.EndsWith(part));
                if (t == null) return false;
                src = t.gameObject;
            }
            var go = (GameObject)Object.Instantiate(src);
            go.transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity);
            go.transform.localScale = Vector3.one;
            bool any = false;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                if (!any) { b = r.bounds; any = true; } else b.Encapsulate(r.bounds);
            }
            Object.DestroyImmediate(go);
            return any;
        }

        /// <summary>세 표의 소품 키 전부.</summary>
        public static IEnumerable<string> AllKeys()
        {
            foreach (var c in Saga.Go.Data.GoRegionProps.Clusters) foreach (var p in c.Pieces) yield return p.Model;
            foreach (var c in Saga.Forest.Data.ForestZoneProps.Clusters) foreach (var p in c.Pieces) yield return p.Model;
            foreach (var id in Saga.Dungeon.Data.DungeonEraDecor.ModelIds) yield return id;
            foreach (var s in Saga.Dungeon.Data.DungeonEraDecor.Landmarks) foreach (var p in s.Pieces) yield return p.Model;
            foreach (var s in Saga.Dungeon.Data.DungeonEraDecor.Towns) foreach (var p in s.Pieces) yield return p.Model;
            foreach (var g in Saga.Go.Data.GoHeroLooks.AllGear) yield return Saga.Go.Data.GoHeroLooks.GearAsset(g);
        }

        public static void Measure()
        {
            var lines = new List<string>();
            foreach (var key in AllKeys().Distinct().OrderBy(x => x))
            {
                string id = IdOf(key);
                if (!Pairs.ContainsKey(id)) continue;
                var old = AssetDatabase.LoadAssetAtPath<GameObject>($"{PolyDir}{id}/{id}_1k.gltf");
                string part = key.Contains('#') ? key.Substring(key.IndexOf('#') + 1) : null;
                if (old == null || !Box(old, part, out var ob)) { lines.Add($"// {key} 옛 모델 못 잼"); continue; }
                string pairInfo = Box(PairModel(id), null, out var nb) ? $"{nb.size.x:0.00}×{nb.size.y:0.00}×{nb.size.z:0.00}" : "짝 없음";
                lines.Add(string.Format(System.Globalization.CultureInfo.InvariantCulture,
                    "{{ \"{0}\", new Vector4({1:0.###}f, {2:0.###}f, {3:0.###}f, {4:0.###}f) }}, // 옛 {5:0.00}×{6:0.00}×{7:0.00} · 짝 {8}",
                    key, ob.center.x, ob.center.y, ob.center.z, MaxSide(ob.size), ob.size.x, ob.size.y, ob.size.z, pairInfo));
            }
            foreach (var n in (System.Environment.GetEnvironmentVariable("SAGA_MEASURE_EXTRA") ?? "").Split(',').Where(x => x.Length > 0))
                lines.Add(Box(AssetDatabase.LoadAssetAtPath<GameObject>(WorldDir + n + ".glb"), null, out var eb) ? $"// {n} {eb.size.x:0.00}×{eb.size.y:0.00}×{eb.size.z:0.00} 가운데 {eb.center}" : $"// {n} 없음");
            Debug.Log("[SelfPairs] Measure\n" + string.Join("\n", lines));
            if (Application.isBatchMode) EditorApplication.Exit(0);
        }
    }
}
