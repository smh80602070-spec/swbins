using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0150 밤 불빛 진단 — ① 임포트: `Resources/World`·`Regions/Pieces` glb 가 전부 GameObject 로 읽힘(실패 0, K-0152~0155·0157 다시 임포트 확인)
    /// ② 빈 씬에 등·횃불 9종 + 석등 넷 더 + 창 있는 건물 셋(hanok·inn·지역 조각 cafe)을 세우고 `NightGlow.Sweep` →
    /// 22시: 9종 불 면 발광 &gt; 0 · 점광 13 중 켜진 것 = 상한 8 · 창이 밤 사본 · 12시: 발광 0 · 점광 꺼짐 · 창 원래 유리 ·
    /// 실내(하늘 없는 판): 불 면 늘 켬·점광 0 · 세기 곡선 표. `-executeMethod Saga.EditorTools.PlaytestNightGlow.Run` → OK/FAIL. 씬은 저장 안 함.
    /// </summary>
    public static class PlaytestNightGlow
    {
        public static readonly string[] Lamps =
        {
            "brazier_01", "torch_stand_01", "candlestick_01", "oil_lamp_01", "torch_wall_01",
            "stone_lantern_01", "street_lamp_01", "table_lamp_01", "hanging_lantern_01",
        };

        [MenuItem("Saga/Playtest Night Glow")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestNightGlow]");
            var notes = new List<string>();
            bool oldIndoor = NightGlow.Indoor;
            using (PlaytestKit.ErrorCounter())
            {
                notes.Add(CheckImports("Assets/SagaCore/Resources/World"));
                notes.Add(CheckImports("Assets/SagaCore/Resources/Regions/Pieces"));
                RegionMaterialSetup.EnsureAll();

                // 세기 곡선
                PlaytestKit.Check(NightGlow.LevelAt(22f) == 1f && NightGlow.LevelAt(2f) == 1f && NightGlow.LevelAt(12f) == 0f
                    && Mathf.Abs(NightGlow.LevelAt(18f) - 0.5f) < 1e-3f && Mathf.Abs(NightGlow.LevelAt(6f) - 0.3f) < 1e-3f, "세기 곡선 틀림(22·2시 1 · 12시 0 · 18시 0.5 · 6시 0.3)");

                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                NightGlow.Reset();
                NightGlow.Indoor = false;
                var models = new Dictionary<string, GameObject>();
                int x = 0;
                foreach (var n in Lamps)
                {
                    var holder = new GameObject("Lamp_" + n).transform;
                    holder.position = new Vector3(x++ * 3f, 0f, 0f);
                    var go = WorldModels.Spawn(n, holder);
                    if (go == null) { PlaytestKit.Fail($"{n} 을 못 세움"); continue; }
                    models[n] = go;
                }
                for (int i = 0; i < 4; i++)   // 상한 8 넘기기 — 석등 넷 더(멀리)
                {
                    var holder = new GameObject("LampExtra_" + i).transform;
                    holder.position = new Vector3(i * 3f, 0f, 30f);
                    WorldModels.Spawn("stone_lantern_01", holder);
                }
                var houses = new List<GameObject>();
                foreach (var n in new[] { "hanok_01", "inn_01" })
                {
                    var holder = new GameObject("House_" + n).transform;
                    holder.position = new Vector3(houses.Count * 25f, 0f, -25f);
                    var go = WorldModels.Spawn(n, holder);
                    if (go != null) houses.Add(go); else PlaytestKit.Fail($"{n} 을 못 세움");
                }
                var piece = Resources.Load<GameObject>("Regions/Pieces/cafe_01");
                if (piece != null) houses.Add(Object.Instantiate(piece, new Vector3(50f, 0f, -25f), Quaternion.identity));
                else PlaytestKit.Fail("Regions/Pieces/cafe_01 을 못 읽음");

                // 인물 몸(Animator 아래)의 "glass" 재질은 창이 아니다 — 안 붙들어야 함(1만리 적 StormWraith·Skeleton)
                var body = new GameObject("DiagBody", typeof(Animator));
                var eye = GameObject.CreatePrimitive(PrimitiveType.Cube);
                eye.transform.SetParent(body.transform, false);
                eye.GetComponent<Renderer>().sharedMaterial = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "glass_visor" };

                var camGo = new GameObject("DiagCam");
                var cam = camGo.AddComponent<Camera>();
                camGo.transform.position = new Vector3(12f, 3f, -6f);

                int swept = NightGlow.Sweep(Object.FindObjectsByType<Renderer>(FindObjectsInactive.Include, FindObjectsSortMode.None));
                PlaytestKit.Check(NightGlow.LightCount == Lamps.Length + 4, $"점광 {NightGlow.LightCount} ≠ {Lamps.Length + 4}(light_point 노드마다 하나)");
                PlaytestKit.Check(NightGlow.GlassSlotCount >= 3, $"창 칸 {NightGlow.GlassSlotCount} < 3(hanok·inn·cafe)");

                // 22시
                NightGlow.Apply(NightGlow.LevelAt(22f), cam);
                var dark = Lamps.Where(n => models.ContainsKey(n) && MaxEmission(models[n]) <= 0.5f).ToList();
                PlaytestKit.Check(dark.Count == 0, "22시 불 면이 안 빛남: " + string.Join(",", dark));
                PlaytestKit.Check(NightGlow.LitLightCount == NightGlow.MaxLights, $"22시 켜진 점광 {NightGlow.LitLightCount} ≠ 상한 {NightGlow.MaxLights}");
                int nightGlass = houses.Sum(h => GlassNames(h).Count(s => s.EndsWith(" (night)")));
                int dayGlass = houses.Sum(h => GlassNames(h).Count(s => !s.EndsWith(" (night)")));
                PlaytestKit.Check(nightGlass > 0 && dayGlass == 0, $"22시 창 밤 사본 {nightGlass} · 원래 유리 남음 {dayGlass}");
                PlaytestKit.Check(eye.GetComponent<Renderer>().sharedMaterial.name == "glass_visor", "인물 몸의 glass 재질을 창으로 바꿈");
                float nightLamp = models.Values.Max(MaxEmission);
                float wallEmit = models.Values.Max(WallEmission);
                PlaytestKit.Check(wallEmit <= 0.01f, $"불 면 아닌 재질이 빛남 {wallEmit:0.00}");
                var lightsOn = Object.FindObjectsByType<Light>(FindObjectsInactive.Include, FindObjectsSortMode.None).Where(l => l.enabled).ToList();
                PlaytestKit.Check(lightsOn.All(l => l.shadows == LightShadows.None && l.type == LightType.Point), "점광이 그림자를 쓰거나 점광이 아님");

                // 12시
                NightGlow.Apply(NightGlow.LevelAt(12f), cam);
                float dayLamp = models.Values.Max(MaxEmission);
                PlaytestKit.Check(dayLamp <= 0.01f, $"12시 불 면 발광 {dayLamp:0.00} > 0");
                PlaytestKit.Check(NightGlow.LitLightCount == 0, $"12시 켜진 점광 {NightGlow.LitLightCount}");
                int nightGlassDay = houses.Sum(h => GlassNames(h).Count(s => s.EndsWith(" (night)")));
                PlaytestKit.Check(nightGlassDay == 0, $"12시 창이 아직 밤 사본 {nightGlassDay}");

                // 실내(2나락) — 불 면 늘 켬·점광 없음
                NightGlow.Indoor = true;
                NightGlow.Apply(0f, cam);
                float indoorLamp = models.Values.Max(MaxEmission);
                PlaytestKit.Check(indoorLamp > 0.5f && NightGlow.LitLightCount == 0, $"실내 불 면 {indoorLamp:0.00} · 점광 {NightGlow.LitLightCount}");

                notes.Add($"훑음 {swept} · 불 면 재질 {NightGlow.GlowMaterialCount} · 창 칸 {NightGlow.GlassSlotCount} · 점광 {NightGlow.LightCount}(켬 상한 {NightGlow.MaxLights}) · 22시 발광 최대 {nightLamp:0.0}·창 밤 {nightGlass} · 12시 {dayLamp:0.0} · 실내 {indoorLamp:0.0}");
            }
            NightGlow.Indoor = oldIndoor;
            NightGlow.Reset();
            Debug.Log("[PlaytestNightGlow] " + string.Join(" | ", notes));
            PlaytestKit.Summary("PlaytestNightGlow");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static string CheckImports(string dir)
        {
            var files = Directory.GetFiles(dir, "*.glb").Select(p => p.Replace('\\', '/')).ToList();
            var bad = files.Where(p => AssetDatabase.LoadAssetAtPath<GameObject>(p) == null).Select(Path.GetFileNameWithoutExtension).ToList();
            PlaytestKit.Check(files.Count > 0 && bad.Count == 0, $"{dir} 임포트 실패 {bad.Count}: {string.Join(",", bad.Take(10))}");
            return $"{dir.Substring(dir.LastIndexOf("Resources/") + 10)} glb {files.Count} 실패 {bad.Count}";
        }

        private static float MaxEmission(GameObject go)
        {
            float m = 0f;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
                foreach (var mat in r.sharedMaterials)
                    if (mat != null && NightGlow.KindOf(mat.name) is NightGlow.GlowKind.Fire or NightGlow.GlowKind.Lamp && mat.HasProperty("_EmissionColor"))
                        m = Mathf.Max(m, mat.GetColor("_EmissionColor").maxColorComponent);
            return m;
        }

        /// <summary>불 면·창이 아닌 재질의 발광(벽이 빛나면 안 됨) — URP Lit 발광 키워드가 켜진 것만.</summary>
        private static float WallEmission(GameObject go)
        {
            float m = 0f;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
                foreach (var mat in r.sharedMaterials)
                    if (mat != null && NightGlow.KindOf(mat.name) == NightGlow.GlowKind.None && mat.IsKeywordEnabled("_EMISSION") && mat.HasProperty("_EmissionColor"))
                        m = Mathf.Max(m, mat.GetColor("_EmissionColor").maxColorComponent);
            return m;
        }

        private static IEnumerable<string> GlassNames(GameObject go) =>
            go.GetComponentsInChildren<Renderer>(true).SelectMany(r => r.sharedMaterials).Where(m => m != null && NightGlow.KindOf(m.name) == NightGlow.GlowKind.Glass).Select(m => m.name);
    }
}
