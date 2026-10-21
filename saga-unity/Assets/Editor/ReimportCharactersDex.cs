using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0156 — 로컬 설치 `Art/CharactersDex/&lt;id&gt;.gltf` 중 못 읽힌 몸을 다시 임포트한다. glTFast 6.14 는 뼈대 있는 메시를 읽을 때
    /// 잡 안전 검사가 "SortAndNormalizeBoneWeightsJob ... writes to NativeArray" 로 임포트를 깬다(새 몸을 덮어 넣으면 9 중 6 이 깨짐) —
    /// `SetupBeastAnimals` 와 같이 임포트하는 동안만 잡 디버거를 끈다.
    /// 대상: 환경 변수 `SAGA_REIMPORT_IDS`(쉼표) 가 있으면 그 id, 없으면 못 읽힌 몸 전부.
    /// `-executeMethod Saga.EditorTools.ReimportCharactersDex.Run` → 다시 읽힌 수 · 남은 실패.
    /// </summary>
    public static class ReimportCharactersDex
    {
        public const string Dir = "Assets/Art/CharactersDex/";

        [MenuItem("Saga/Reimport Characters Dex (broken)")]
        public static void Run()
        {
            var env = System.Environment.GetEnvironmentVariable("SAGA_REIMPORT_IDS");
            var ids = string.IsNullOrEmpty(env)
                ? Directory.GetFiles(Dir, "*.gltf").Select(Path.GetFileNameWithoutExtension)
                    .Where(id => AssetDatabase.LoadAssetAtPath<GameObject>(Dir + id + ".gltf") == null).ToList()
                : env.Split(',').Select(s => s.Trim()).Where(s => s.Length > 0).ToList();

            bool jobDebugger = Unity.Jobs.LowLevel.Unsafe.JobsUtility.JobDebuggerEnabled;
            Unity.Jobs.LowLevel.Unsafe.JobsUtility.JobDebuggerEnabled = false;
            var failed = new List<string>();
            try
            {
                foreach (var id in ids)
                {
                    AssetDatabase.ImportAsset(Dir + id + ".gltf", ImportAssetOptions.ForceUpdate);
                    if (AssetDatabase.LoadAssetAtPath<GameObject>(Dir + id + ".gltf") == null) failed.Add(id);
                }
            }
            finally { Unity.Jobs.LowLevel.Unsafe.JobsUtility.JobDebuggerEnabled = jobDebugger; }

            // 군중 목록(guid + 뿌리 fileID 로 가리킴)이 덮어 넣은 몸을 여전히 찾는지 — 다시 지을 필요가 있으면 `CrowdBodyListBuilder`.
            var list = AssetDatabase.LoadAssetAtPath<Saga.Core.CrowdBodyList>(CrowdBodyListBuilder.AssetPath);
            int lost = list == null || list.bodies == null ? -1 : list.bodies.Count(b => b == null);
            Debug.Log($"[ReimportCharactersDex] 대상 {ids.Count} · 다시 읽힘 {ids.Count - failed.Count} · 실패 {failed.Count}{(failed.Count > 0 ? ": " + string.Join(",", failed) : "")} · 군중 목록 {(list == null ? "없음" : $"{list.bodies.Length} 중 빈 칸 {lost}")}");
            if (Application.isBatchMode) EditorApplication.Exit(failed.Count == 0 && lost <= 0 ? 0 : 1);
        }
    }
}
