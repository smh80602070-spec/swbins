using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// 시나리오 표 → `Games/Saga&lt;판&gt;/Resources/scenario_&lt;판&gt;.json` 내보내기(tasks U-0009). 옛 정적 표(`Snapshot()`)를 `JsonUtility` 로 쓰고,
    /// 같은 파일을 <see cref="ScenarioJson.Load{T}"/> 로 다시 읽어 옛 표와 의미 비교(<see cref="ScenarioJson.DeepEqual"/>)해 0 차이를 확인한다.
    /// `-executeMethod Saga.EditorTools.ScenarioJsonExport.Forest` → "[ScenarioJsonExport] forest OK n장 m씬".
    /// 표를 로더로 바꾼 뒤에는 `Snapshot()` 이 로드한 표라 같은 호출이 "저장된 파일 = 로드한 표" 확인이 된다.
    /// </summary>
    public static class ScenarioJsonExport
    {
        [MenuItem("Saga/Scenario JSON/Export Forest")]
        public static void Forest() => Run("Forest", Saga.Forest.Data.ForestScenarioData.Snapshot(),
            s => $"{s.chapters.Length}장 {s.scenes.Length}씬 {s.casts.Length}인물");

        private static void Run<T>(string game, T snapshot, System.Func<T, string> counts) where T : class, new()
        {
            PlaytestKit.Begin("[ScenarioJsonExport]");
            string res = "scenario_" + game.ToLowerInvariant();
            string dir = $"Assets/Games/Saga{game}/Resources";
            Directory.CreateDirectory(dir);
            string path = $"{dir}/{res}.json";
            string json = JsonUtility.ToJson(snapshot, true);
            File.WriteAllText(path, json + "\n", new System.Text.UTF8Encoding(false));
            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport);
            var loaded = ScenarioJson.Load<T>(res);
            var diffs = new List<string>();
            ScenarioJson.DeepEqual(snapshot, loaded, diffs);
            foreach (string d in diffs.GetRange(0, System.Math.Min(10, diffs.Count))) PlaytestKit.Fail($"{game} {d}");
            PlaytestKit.Check(diffs.Count == 0, $"{game} 옛 표와 다시 읽은 표가 {diffs.Count}곳 다름");
            Debug.Log($"[ScenarioJsonExport] {game.ToLowerInvariant()} {(PlaytestKit.Fails == 0 ? "OK" : "FAIL")} {counts(snapshot)} · {new FileInfo(path).Length}B");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }
    }
}
