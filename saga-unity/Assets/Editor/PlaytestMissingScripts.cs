using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Saga.EditorTools
{
    /// <summary>
    /// 씬·프리팹에 Missing Script(지워지거나 GUID 가 끊긴 스크립트)가 남았는지 센다 — 스크립트를 옮기거나 합친 뒤(`tools/remap-guid.mjs`) 돌린다.
    /// `-executeMethod Saga.EditorTools.PlaytestMissingScripts.Run` → "[PlaytestMissingScripts] OK/FAIL n". 읽기만 한다(씬을 저장하지 않는다).
    /// </summary>
    public static class PlaytestMissingScripts
    {
        [MenuItem("Saga/Playtest Missing Scripts")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestMissingScripts]");
            int scenes = 0, prefabs = 0;
            foreach (string guid in AssetDatabase.FindAssets("t:Scene", new[] { "Assets/Scenes" }))
            {
                string path = AssetDatabase.GUIDToAssetPath(guid);
                var scene = EditorSceneManager.OpenScene(path, OpenSceneMode.Single);
                scenes++;
                foreach (var root in scene.GetRootGameObjects()) Scan(root, path);
            }
            foreach (string guid in AssetDatabase.FindAssets("t:Prefab", new[] { "Assets/Games", "Assets/SagaCore" }))
            {
                string path = AssetDatabase.GUIDToAssetPath(guid);
                var root = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                if (root == null) continue;
                prefabs++;
                Scan(root, path);
            }
            Debug.Log($"[PlaytestMissingScripts] 씬 {scenes} · 프리팹 {prefabs} 검사");
            PlaytestKit.Summary("PlaytestMissingScripts");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void Scan(GameObject root, string where)
        {
            foreach (var t in root.GetComponentsInChildren<Transform>(true))
            {
                int n = GameObjectUtility.GetMonoBehavioursWithMissingScriptCount(t.gameObject);
                if (n > 0) PlaytestKit.Fail($"{where} — {t.name} 에 Missing Script {n}개");
            }
        }
    }
}
