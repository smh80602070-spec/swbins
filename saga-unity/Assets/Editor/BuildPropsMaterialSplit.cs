using Saga.Core;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 102-4 "Props" 판정 — lantern·stall-red(Kenney Fantasy Town Kit)는 둘 다
    /// 삼각형이 전부 단일 공유 팔레트 텍스처(`Textures/colormap.png`, Kenney 표준 아틀라스)의
    /// 작은 스와치 하나만 UV로 가리키는 구조라(각 모델의 UV bounding box가 거의 한 점), 단순히
    /// `EnvironmentMaterial.MakeTiled()`로 재질 전체를 갈아 끼우면(울타리에 이미 한 방식)
    /// 색이 섞인 나머지 부분까지 새 텍스처로 덮여 지워진다 — 그래서 2026-09-21엔 보류했다.
    ///
    /// **실제로 뜯어보니 둘의 구성이 다르다**(2026-09-23, 실제 GLB 삼각형별 UV를 샘플해 확인):
    /// - `lantern.glb` — **158개 삼각형 전부**가 팔레트의 청회색 계열(HSV h≈0.63~0.67, 금속 톤)
    ///   이다. 나무 성분이 아예 없다 — 애초에 쪼갤 게 없다. 대신 원본 재질이
    ///   `metallicFactor=0`(완전 비금속 취급)이라 "금속 등"인데 광택이 하나도 없어 밋밋해
    ///   보인다 — **텍스처는 그대로 두고 `_Metallic`·`_Smoothness`만 올린** 복제 재질로 바꾼다
    ///   (색은 원본 그대로라 "지워질 위험" 자체가 없다).
    /// - `stall-red.glb` — 270개 중 **나무 색(다리·틀, h≈0.05, 채도 중간) 약 130개 + 빨강 차양
    ///   (h≈0.98, wraparound) 약 140개**로 뚜렷이 갈린다. `BuildMariaSkinSplit.cs`와 같은
    ///   기법(삼각형 UV 중심점의 팔레트 색으로 분류)으로 메시를 **서브메시 둘로 쪼개**,
    ///   나무 서브메시에만 `dark_wooden_planks_URPLit`(울타리와 같은 소스)을 씌우고 차양
    ///   서브메시는 원본 재질을 그대로 복제해 색을 안 건드린다.
    ///
    /// 결과물은 `Assets/Art/Props/Generated/`(103-1 규칙 — 커밋한다, 원본 팩과 안 섞는다).
    /// </summary>
    public static class BuildPropsMaterialSplit
    {
        private const string LanternPath = "Assets/Art/Props/lantern.glb";
        private const string StallPath = "Assets/Art/Props/stall-red.glb";
        private const string ColormapPath = "Assets/Art/Props/Textures/colormap.png";
        private const string WoodTemplatePath = "Assets/Art/Environment/PBR/dark_wooden_planks_URPLit.mat";
        private const string GeneratedDir = "Assets/Art/Props/Generated";

        public const string LanternMetalMatPath = GeneratedDir + "/LanternMetal.mat";
        public const string StallSplitMeshPath = GeneratedDir + "/StallRed_Split.asset";
        public const string StallWoodMatPath = GeneratedDir + "/StallRedWood.mat";
        public const string StallCanopyMatPath = GeneratedDir + "/StallRedCanopy.mat";

        // 실측 팔레트 샘플로 확정한 범위(2026-09-23) — wood 스와치 h 0.043~0.090
        // (그 사이 나무 톤 전부), 빨강 차양은 h 0.97 안팎이라 겹치지 않는다.
        // s·v는 나무 스와치 관측값(0.50~0.51, 0.75~0.83)에 여유를 더 뒀다.
        private static bool IsWoodTone(Color c)
        {
            Color.RGBToHSV(c, out var h, out var s, out var v);
            return h is >= 0.03f and <= 0.10f && s is >= 0.30f and <= 0.65f && v is >= 0.4f and <= 0.98f;
        }

        [MenuItem("Saga/Build Props Material Split")]
        public static void Build()
        {
            if (!AssetDatabase.IsValidFolder(GeneratedDir))
            {
                AssetDatabase.CreateFolder("Assets/Art/Props", "Generated");
            }

            BuildLanternMetal();
            BuildStallSplit();
            AssetDatabase.SaveAssets();
            Debug.Log("[BuildPropsMaterialSplit] done — lantern metal-ized, stall wood/canopy split");
        }

        private static void BuildLanternMetal()
        {
            var lanternGo = AssetDatabase.LoadAssetAtPath<GameObject>(LanternPath);
            var renderer = lanternGo.GetComponent<MeshRenderer>();
            var sourceMat = renderer.sharedMaterial;

            // glTFast가 GLB에 물리는 셰이더는 URP/Lit이 아니라 glTF PBR Shader Graph라
            // 속성 이름이 glTF 스펙 그대로다(`_Metallic`이 아니라 `metallicFactor`,
            // `_Smoothness`가 아니라 `roughnessFactor` — 낮을수록 광택). 원본은
            // metallicFactor=0·roughnessFactor=1(완전 비금속·완전 무광)이라 밋밋했다.
            var metalMat = new Material(sourceMat) { name = "LanternMetal" };
            if (metalMat.HasProperty("metallicFactor")) metalMat.SetFloat("metallicFactor", 0.8f);
            if (metalMat.HasProperty("roughnessFactor")) metalMat.SetFloat("roughnessFactor", 0.35f);
            SaveAsset(metalMat, LanternMetalMatPath);
            Debug.Log("[BuildPropsMaterialSplit] lantern — 158/158 tris metal-toned (no wood found), metallicFactor/roughnessFactor only");
        }

        private static void BuildStallSplit()
        {
            var stallGo = AssetDatabase.LoadAssetAtPath<GameObject>(StallPath);
            var meshFilter = stallGo.GetComponent<MeshFilter>();
            var renderer = stallGo.GetComponent<MeshRenderer>();
            var sourceMesh = meshFilter.sharedMesh;
            var sourceMat = renderer.sharedMaterial;

            var colormap = ForceReadable(ColormapPath);
            var triangles = sourceMesh.triangles;
            var uv = sourceMesh.uv;
            var woodTris = new List<int>();
            var canopyTris = new List<int>();

            for (var i = 0; i < triangles.Length; i += 3)
            {
                var a = triangles[i];
                var b = triangles[i + 1];
                var c = triangles[i + 2];
                var u = (uv[a].x + uv[b].x + uv[c].x) / 3f;
                var v = (uv[a].y + uv[b].y + uv[c].y) / 3f;
                var sample = colormap.GetPixelBilinear(u, v);

                var list = IsWoodTone(sample) ? woodTris : canopyTris;
                list.Add(a);
                list.Add(b);
                list.Add(c);
            }

            Debug.Log($"[BuildPropsMaterialSplit] stall-red — classified {woodTris.Count / 3} wood tris, {canopyTris.Count / 3} canopy/rest tris (of {triangles.Length / 3} total)");
            if (woodTris.Count == 0 || canopyTris.Count == 0)
            {
                Debug.LogWarning("[BuildPropsMaterialSplit] stall-red — 한쪽이 0개, 분류가 틀렸을 수 있다. 색 임계값을 다시 확인할 것.");
            }

            Debug.Log($"[BuildPropsMaterialSplit] stall-red — source mesh subMeshCount(빌드 전)={sourceMesh.subMeshCount}");
            var splitMesh = Object.Instantiate(sourceMesh);
            splitMesh.name = "StallRed_Split";
            splitMesh.subMeshCount = 2;
            splitMesh.SetTriangles(woodTris, 0);
            splitMesh.SetTriangles(canopyTris, 1);
            Debug.Log($"[BuildPropsMaterialSplit] stall-red — split mesh subMeshCount(설정 직후)={splitMesh.subMeshCount}");

            var existingMesh = AssetDatabase.LoadAssetAtPath<Mesh>(StallSplitMeshPath);
            if (existingMesh != null) AssetDatabase.DeleteAsset(StallSplitMeshPath);
            AssetDatabase.CreateAsset(splitMesh, StallSplitMeshPath);

            // 다리·틀(나무) — 울타리와 같은 소스 재질을 그대로 이어 쓴다(PropsBuilder.cs
            // SpawnFencePanel의 EnvironmentMaterial.MakeTiled와 같은 결). 스케일은
            // PropsBuilder.StallScale(×2) 적용 뒤 실측(1×1.237×1×2)에 맞춰 잡는다.
            var woodTemplate = AssetDatabase.LoadAssetAtPath<Material>(WoodTemplatePath);
            var woodMat = woodTemplate != null
                ? EnvironmentMaterial.MakeTiled(woodTemplate, 1f, 1.237f)
                : new Material(sourceMat) { name = "StallRedWood" };
            woodMat.name = "StallRedWood";
            SaveAsset(woodMat, StallWoodMatPath);

            // 차양(빨강 천) — 색을 안 건드린다, 원본 그대로 복제(BuildMariaSkinSplit의
            // "MariaRest.mat"과 같은 이유 — 원본 프리팹 참조 대신 안정된 별도 에셋으로).
            var canopyMat = new Material(sourceMat) { name = "StallRedCanopy" };
            SaveAsset(canopyMat, StallCanopyMatPath);
        }

        private static void SaveAsset(Material mat, string path)
        {
            var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (existing != null) AssetDatabase.DeleteAsset(path);
            AssetDatabase.CreateAsset(mat, path);
        }

        private static Texture2D ForceReadable(string path)
        {
            var importer = AssetImporter.GetAtPath(path) as TextureImporter;
            if (importer != null && !importer.isReadable)
            {
                importer.isReadable = true;
                importer.SaveAndReimport();
            }
            return AssetDatabase.LoadAssetAtPath<Texture2D>(path);
        }
    }
}
