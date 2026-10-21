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

        /// <summary>tasks U-0147 — 열린 씬(이름)의 땅 셰이더 이름들(쉼표). `PlaytestGraphicsBaseline` 이 빌려 쓴다.</summary>
        public static string GroundShadersIn(string sceneName) => string.Join(",", Collect(UnityEngine.SceneManagement.SceneManager.GetSceneByName(sceneName)));

        private static string CheckScene(string path)
        {
            var scene = EditorSceneManager.OpenScene(path);
            var shaders = Collect(scene);
            string name = System.IO.Path.GetFileNameWithoutExtension(path);
            PlaytestKit.Check(shaders.Count > 0, $"{name}: 땅 렌더러를 못 찾음");
            PlaytestKit.Check(!shaders.Contains("Saga/CelToon"), $"{name}: 땅이 툰");
            return $"{name} 땅 {string.Join(",", shaders)}";
        }

        private static SortedSet<string> Collect(UnityEngine.SceneManagement.Scene scene)
        {
            var shaders = new SortedSet<string>();
            // 3마을 땅은 씬에 안 저장되고 Awake 가 짓는다 — 편집 모드에선 직접 짓는다(씬은 저장 안 함)
            foreach (var fg in Object.FindObjectsByType<Saga.Forest.World.ForestGroundBuilder>(FindObjectsInactive.Include, FindObjectsSortMode.None))
            {
                fg.Build();
                var fr = fg.GetComponent<MeshRenderer>();
                var fm = fg.GetComponent<MeshFilter>().sharedMesh;
                var uv1 = new List<Vector4>();
                if (fm != null) fm.GetUVs(1, uv1);
                PlaytestKit.Check(fm != null && uv1.Count == fm.vertexCount, "3마을 땅 메시에 사진 가중치(UV1) 없음");
                PlaytestKit.Check(RegionMaterials.PhotoOff || (fr != null && fr.sharedMaterial != null && fr.sharedMaterial.IsKeywordEnabled(RegionMaterials.GroundPhotoKeyword)), "3마을 땅 재질에 사진이 안 꽂힘");
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
            return shaders;
        }

        /// <summary>U-0084 2단계 — 사진 땅: 두 셰이더가 사진 키워드를 품고, 재질에 네 세트가 꽂히며, 칸 가중치가 맞고, 3마을 땅 메시에 UV1 가중치가 있다.
        /// `SAGA_NO_PHOTO=1` 이면 꽂히지 않아야 한다.</summary>
        private static string CheckPhoto()
        {
            int ok = 0;
            foreach (var sn in new[] { "Saga/VertexColorLit", "Saga/ForestWorldCurve" })
            {
                var sh = Shader.Find(sn);
                if (sh == null) continue;
                PlaytestKit.Check(sh.keywordSpace.keywordNames.Contains(RegionMaterials.GroundPhotoKeyword), $"{sn} 에 사진 키워드 없음");
                var m = new Material(sh);
                bool on = RegionMaterials.ApplyGroundPhoto(m, new Vector4(3, 3, 4, 2.5f));
                if (RegionMaterials.PhotoOff) { PlaytestKit.Check(!on && !m.IsKeywordEnabled(RegionMaterials.GroundPhotoKeyword), $"{sn}: SAGA_NO_PHOTO 인데 사진이 꽂힘"); continue; }
                PlaytestKit.Check(on && m.IsKeywordEnabled(RegionMaterials.GroundPhotoKeyword), $"{sn}: 사진 세트를 못 꽂음(TexturesReal 네 세트?)");
                for (int i = 0; i < 4; i++)
                    PlaytestKit.Check(m.GetTexture("_GBase" + i) != null && m.GetTexture("_GNorm" + i) != null && m.GetTexture("_GRough" + i) != null, $"{sn}: 세트 {i} 빈칸");
                if (on) ok++;
                Object.DestroyImmediate(m);
            }
            // 칸 가중치 — 들=풀, 산=바위, 길=흙, 마을=자갈 우세
            PlaytestKit.Check(Saga.Go.World.TerrainBuilder.PhotoKindOf('.').x > 0.9f && Saga.Go.World.TerrainBuilder.PhotoKindOf('^').z > 0.9f
                && Saga.Go.World.TerrainBuilder.PhotoKindOf('=').y > 0.9f && Saga.Go.World.TerrainBuilder.PhotoKindOf('H').w > 0.5f, "1만리 칸→사진 세트 표 틀림");
            var rocky = System.Array.Find(Saga.Forest.Data.ForestBiomeData.Zones, z => z.Key == "rocky");
            var wr = Saga.Forest.World.ForestGroundBuilder.PhotoKindAt(rocky.Center.x, rocky.Center.y);
            var wo = Saga.Forest.World.ForestGroundBuilder.PhotoKindAt(0f, 0f);
            PlaytestKit.Check(wr.z > 0.5f && wo.x > 0.9f, $"3마을 바위 지대 {wr} · 광장 {wo} 가중치 틀림");
            return $"사진 땅 셰이더 {ok}/2 · 바위 지대 {wr} · 광장 {wo}";
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
                notes.Add(CheckPhoto());
                foreach (var s in Scenes) notes.Add(CheckScene(s));
            }
            Debug.Log("[PlaytestGroundLook] " + string.Join(" | ", notes));
            PlaytestKit.Summary("PlaytestGroundLook");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }
    }
}
