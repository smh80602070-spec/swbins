using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0036 A 진단 — TestVillageForest 를 Play 로 켜(헤드리스 가능, `PlaytestHeadless` 와 같은 방식) 과일나무마다 구운 procgen
    /// Visual 이 통일 세트 나무(`World/tree_broadleaf_01`, 툰 재질)로 바뀌었는지 + 키가 옛 Visual 과 같은지 본다.
    /// `-executeMethod Saga.EditorTools.PlaytestForestNature.Run` (-quit 없이) → "[PlaytestForestNature] OK/FAIL".
    /// </summary>
    public static class PlaytestForestNature
    {
        private const string ScenePath = "Assets/Scenes/TestVillageForest.unity";
        private static bool _opt; private static EnterPlayModeOptions _opts;
        private static int _frame;
        private static float _bakedHeightSum; private static int _bakedCount;

        [MenuItem("Saga/Playtest Forest Nature")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestForestNature]");
            _opt = EditorSettings.enterPlayModeOptionsEnabled; _opts = EditorSettings.enterPlayModeOptions;
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions = EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;
            var scene = EditorSceneManager.OpenScene(ScenePath);
            // 구운 높이(바뀌기 전) — 편집 모드에서 잰다.
            foreach (var t in Object.FindObjectsByType<ForestFruitTree>(FindObjectsSortMode.None))
            {
                var v = t.transform.Find("Visual");
                if (v == null) continue;
                var rs = v.GetComponentsInChildren<Renderer>(true);
                if (rs.Length == 0) continue;
                var b = rs[0].bounds; foreach (var r in rs) b.Encapsulate(r.bounds);
                _bakedHeightSum += b.size.y; _bakedCount++;
            }
            _frame = 0;
            EditorApplication.playModeStateChanged += OnState;
            EditorApplication.isPlaying = true;
        }

        private static void OnState(PlayModeStateChange s)
        {
            if (s == PlayModeStateChange.EnteredPlayMode) EditorApplication.update += Tick;
            else if (s == PlayModeStateChange.EnteredEditMode)
            {
                EditorApplication.playModeStateChanged -= OnState;
                EditorSettings.enterPlayModeOptionsEnabled = _opt; EditorSettings.enterPlayModeOptions = _opts;
                PlaytestKit.Summary("PlaytestForestNature");
                EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
            }
        }

        private static void Tick()
        {
            if (++_frame < 15) return;
            EditorApplication.update -= Tick;
            var trees = Object.FindObjectsByType<ForestFruitTree>(FindObjectsSortMode.None);
            PlaytestKit.Check(trees.Length > 0, "씬에 과일나무가 없다");
            int toon = 0; float h = 0f;
            foreach (var t in trees)
            {
                var v = t.transform.Find("Visual");
                if (v == null) { PlaytestKit.Fail("과일나무에 Visual 이 없다"); continue; }
                var rs = v.GetComponentsInChildren<Renderer>(true);
                bool allToon = rs.Length > 0;
                var b = rs.Length > 0 ? rs[0].bounds : default;
                foreach (var r in rs)
                {
                    b.Encapsulate(r.bounds);
                    foreach (var m in r.sharedMaterials)
                        if (m == null || m.shader == null || (m.shader.name != "Saga/CelToon" && !RegionMaterialsIsKept(m))) allToon = false;
                }
                if (allToon) toon++;
                h += b.size.y;
            }
            float avg = trees.Length > 0 ? h / trees.Length : 0f;
            float baked = _bakedCount > 0 ? _bakedHeightSum / _bakedCount : 0f;
            Debug.Log($"[PlaytestForestNature] 과일나무 {trees.Length} · 툰 {toon} · 평균 키 {avg:0.00}m (구운 것 {baked:0.00}m, {_bakedCount}그루)");
            PlaytestKit.Check(toon == trees.Length, $"통일 세트로 안 바뀐 과일나무 {trees.Length - toon}");
            if (baked > 0.5f) PlaytestKit.Check(Mathf.Abs(avg - baked) / baked < 0.15f, $"키가 옛 Visual 과 다르다 {avg:0.00} vs {baked:0.00}");
            EditorApplication.isPlaying = false;
        }

        // 반투명 재질은 원본 유지가 설계 — 툰이 아니어도 통과.
        private static bool RegionMaterialsIsKept(Material m) => Saga.Core.Region.RegionMaterials.IsTransparent(m);
    }
}
