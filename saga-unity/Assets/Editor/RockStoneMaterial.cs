using UnityEditor;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// Kenney 바위 GLB(rock_largeA/smallA)는 재질이 **금속(metallic 1)·주황/청록 단색**이라 사실적 PBR 판에서 장난감처럼 번쩍인다
    /// (2026-09-24 소환수 모델 작업 중 발견 — 사가마을 108 ② 명소 바위도 같았다). PolyHaven rock_boulder_dry 사진(1k, CC0)을
    /// 입힌 비금속 돌 재질을 하나 만들어 둘 다 쓴다. 바위 UV 는 실제 투영값(약 ±20)이라 타일링을 0.03 으로 줄여 한두 번만 되풀이.
    /// </summary>
    public static class RockStoneMaterial
    {
        public const string Path = "Assets/Art/Environment/PBR/rock_boulder_dry_URPLit.mat";
        private const string DiffPath = "Assets/Art/Environment/PBR/PolyHaven_RockBoulderDry/rock_boulder_dry_diff_1k.jpg";
        public const float Tiling = 0.03f;

        public static Material LoadOrCreate()
        {
            var mat = AssetDatabase.LoadAssetAtPath<Material>(Path);
            if (mat != null) return mat;
            var shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null) return null;
            mat = new Material(shader) { name = "rock_boulder_dry_URPLit" };
            var diff = AssetDatabase.LoadAssetAtPath<Texture2D>(DiffPath);
            if (diff != null)
            {
                mat.SetTexture("_BaseMap", diff);
                mat.SetTextureScale("_BaseMap", new Vector2(Tiling, Tiling));
            }
            mat.SetColor("_BaseColor", new Color(0.92f, 0.9f, 0.86f));
            mat.SetFloat("_Metallic", 0f);
            mat.SetFloat("_Smoothness", 0.18f);
            AssetDatabase.CreateAsset(mat, Path);
            return mat;
        }
    }
}
