using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Saga.Core.Region;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0084 진단 — 사실 땅 1단계. 땅 계열 셰이더 셋(RegionGround·VertexColorLit·ForestWorldCurve)이 오류 없이 있고 옛 명암 키워드
    /// (`_SAGA_GROUND_TOON`)를 품으며, 환경변수가 없으면 키워드가 꺼진다(= PBR 조명). 판 넷(1만리·3마을·4종횡·5천하) 씬을 열어 땅 렌더러의
    /// 셰이더 이름을 한 줄씩 적고 툰(CelToon)이 아님을 본다. `-executeMethod Saga.EditorTools.PlaytestGroundLook.Run` → OK/FAIL. 씬은 저장 안 함.
    /// </summary>
    public static class PlaytestGroundLook
    {
        private static readonly string[] GroundShaders = { "Saga/RegionGround", "Saga/VertexColorLit", "Saga/ForestWorldCurve" };
        private static readonly string[] Scenes =
        {
            "Assets/Scenes/TestVillage.unity", "Assets/Scenes/TestVillageForest.unity", "Assets/Scenes/TestField.unity", "Assets/Scenes/TestCity.unity",
        };

        private static string CheckScene(string path)
        {
            var scene = EditorSceneManager.OpenScene(path);
            var shaders = new SortedSet<string>();
            // 3마을 땅은 씬에 안 저장되고 Awake 가 짓는다 — 편집 모드에선 직접 짓는다(씬은 저장 안 함)
            foreach (var fg in Object.FindObjectsByType<Saga.Forest.World.ForestGroundBuilder>(FindObjectsInactive.Include, FindObjectsSortMode.None))
            {
                fg.Build();
                var fr = fg.GetComponent<MeshRenderer>();
                if (fr != null && fr.sharedMaterial != null && fr.sharedMaterial.shader != null) shaders.Add(fr.sharedMaterial.shader.name);
            }
            foreach (var root in scene.GetRootGameObjects())
                foreach (var r in root.GetComponentsInChildren<MeshRenderer>(true))
                {
                    string n = r.gameObject.name;
                    if (!(n == "Ground" || n == "Terrain" || n.StartsWith("ForestGround") || n == "StoryTerrain")) continue;
                    foreach (var m in r.sharedMaterials)
                        if (m != null && m.shader != null) shaders.Add(m.shader.name);
                }
            string name = System.IO.Path.GetFileNameWithoutExtension(path);
            PlaytestKit.Check(shaders.Count > 0, $"{name}: 땅 렌더러를 못 찾음");
            PlaytestKit.Check(!shaders.Contains("Saga/CelToon"), $"{name}: 땅이 툰");
            return $"{name} 땅 {string.Join(",", shaders)}";
        }

        [MenuItem("Saga/Playtest Ground Look")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestGroundLook]");
            var notes = new List<string>();
            using (PlaytestKit.ErrorCounter())
            {
                foreach (var sn in GroundShaders)
                {
                    var sh = Shader.Find(sn);
                    PlaytestKit.Check(sh != null && !ShaderUtil.ShaderHasError(sh), $"{sn} 없음·오류");
                    if (sh != null)
                        PlaytestKit.Check(sh.keywordSpace.keywordNames.Contains(RegionMaterials.GroundToonKeyword), $"{sn} 에 옛 명암 키워드 {RegionMaterials.GroundToonKeyword} 없음");
                }
                RegionMaterials.ApplyGroundLook();
                PlaytestKit.Check(RegionMaterials.GroundToon || !Shader.IsKeywordEnabled(RegionMaterials.GroundToonKeyword), "환경변수 없는데 옛 명암 키워드가 켜짐");
                foreach (var s in Scenes) notes.Add(CheckScene(s));
            }
            Debug.Log("[PlaytestGroundLook] " + string.Join(" | ", notes));
            PlaytestKit.Summary("PlaytestGroundLook");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }
    }
}
