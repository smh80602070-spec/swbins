using System;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 102-1-2 "판별 색보정 LUT" — 게임별 톤(마을=따뜻/그림자
    /// 차갑게, 굴혈=청록, 들판=황금시각, 필드=고대비, 성=저채도)을 코드로
    /// 구운 32³ LUT 텍스처(`Assets/Settings/LUT_<game>.png`)와 그 LUT만
    /// 담은 작은 전용 VolumeProfile(`ToneVolume_<game>.asset`)로 만든다.
    ///
    /// 공유 FF16Volume_PC/Mobile(102-2, `BuildFF16VolumeProfiles.cs`)은
    /// 다섯 판이 같이 쓰는 자산이라 게임별 LUT를 못 넣는다 — 대신 각 게임
    /// 씬이 이 프로필을 두 번째(우선순위 높은) Volume 으로 겹쳐 낀다.
    /// ColorLookup(102-2 표에서 PC·Mobile 둘 다 ○)만 담고 ColorAdjustments
    /// 는 없어 공유 프로필의 다른 값은 안 건드린다.
    ///
    /// `Assets/Settings/PC_RPAsset.asset`·`Mobile_RPAsset.asset`의
    /// `m_ColorGradingLutSize: 32`와 반드시 일치해야 한다(URP `ColorLookup.
    /// ValidateLUT()`가 텍스처 크기를 그 값으로 검사) — 텍스처는 항상
    /// (32*32)×32 = 1024×32.
    ///
    /// 멱등 — 다시 실행하면 텍스처·프로필을 지우고 새로 짓는다
    /// (`BuildFF16VolumeProfiles.cs`와 같은 관례). 재실행 뒤엔 다섯 씬을
    /// 같이 재빌드해야 새 GUID를 물게 된다.
    /// </summary>
    public static class BuildGameToneLuts
    {
        private const int LutSize = 32;

        public const string GoLutPath = "Assets/Settings/LUT_go.png";
        public const string DungeonLutPath = "Assets/Settings/LUT_dungeon.png";
        public const string ForestLutPath = "Assets/Settings/LUT_forest.png";
        public const string StoryLutPath = "Assets/Settings/LUT_story.png";
        public const string RealmLutPath = "Assets/Settings/LUT_realm.png";

        public const string GoProfilePath = "Assets/Settings/ToneVolume_go.asset";
        public const string DungeonProfilePath = "Assets/Settings/ToneVolume_dungeon.asset";
        public const string ForestProfilePath = "Assets/Settings/ToneVolume_forest.asset";
        public const string StoryProfilePath = "Assets/Settings/ToneVolume_story.asset";
        public const string RealmProfilePath = "Assets/Settings/ToneVolume_realm.asset";

        [MenuItem("Saga/Build Game Tone LUTs")]
        public static void Build()
        {
            BuildOne(GoLutPath, GoProfilePath, GradeVillage);
            BuildOne(DungeonLutPath, DungeonProfilePath, GradeDungeon, DungeonContribution);
            BuildOne(ForestLutPath, ForestProfilePath, GradeForest);
            BuildOne(StoryLutPath, StoryProfilePath, GradeStory);
            BuildOne(RealmLutPath, RealmProfilePath, GradeRealm);

            AssetDatabase.SaveAssets();
            Debug.Log("[BuildGameToneLuts] saved 5 LUTs + 5 tone volume profiles");
        }

        /// <summary>tasks U-0082 — 2나락 LUT 세기. 청록·대비 1.12 가 그늘을 눌러 보조등 없는 방이 까맸다 — 0.3 만 섞는다(10-10 측정, 나머지 판은 1).</summary>
        public const float DungeonContribution = 0.3f;

        private static void BuildOne(string lutPath, string profilePath, Func<Color, Color> grade, float contribution = 1f)
        {
            var tex = BakeAndImportLut(lutPath, grade);
            BuildToneProfile(profilePath, tex, contribution);
        }

        private static Texture2D BakeAndImportLut(string path, Func<Color, Color> grade)
        {
            int width = LutSize * LutSize;
            var tex = new Texture2D(width, LutSize, TextureFormat.RGBA32, false);

            for (int b = 0; b < LutSize; b++)
            {
                float bf = b / (float)(LutSize - 1);
                for (int g = 0; g < LutSize; g++)
                {
                    float gf = g / (float)(LutSize - 1);
                    for (int r = 0; r < LutSize; r++)
                    {
                        float rf = r / (float)(LutSize - 1);
                        Color graded = grade(new Color(rf, gf, bf, 1f));
                        tex.SetPixel(b * LutSize + r, g, new Color(
                            Mathf.Clamp01(graded.r), Mathf.Clamp01(graded.g), Mathf.Clamp01(graded.b), 1f));
                    }
                }
            }
            tex.Apply();

            byte[] png = tex.EncodeToPNG();
            UnityEngine.Object.DestroyImmediate(tex);
            File.WriteAllBytes(path, png);
            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);

            // ColorLookup.ValidateLUT()는 sRGB 포맷이면 거부한다 — 값을
            // 그대로(감마 보정 없이) 담은 선형 텍스처로 강제한다.
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            importer.sRGBTexture = false;
            importer.mipmapEnabled = false;
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.filterMode = FilterMode.Bilinear;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.maxTextureSize = 2048;
            importer.alphaIsTransparency = false;
            EditorUtility.SetDirty(importer);
            importer.SaveAndReimport();

            return AssetDatabase.LoadAssetAtPath<Texture2D>(path);
        }

        private static void BuildToneProfile(string path, Texture2D lut, float contribution)
        {
            if (AssetDatabase.LoadAssetAtPath<VolumeProfile>(path) != null)
            {
                AssetDatabase.DeleteAsset(path);
            }
            var profile = ScriptableObject.CreateInstance<VolumeProfile>();
            AssetDatabase.CreateAsset(profile, path);

            var lookup = profile.Add<ColorLookup>(true);
            AssetDatabase.AddObjectToAsset(lookup, profile);
            lookup.texture.value = lut;
            lookup.contribution.value = contribution;

            EditorUtility.SetDirty(profile);
        }

        // ---- 게임별 그레이딩 함수(102-1-2 톤 방향) ----

        private static Color GradeVillage(Color c) // GO — 마을: 따뜻/그림자 차갑게
        {
            float luma = 0.299f * c.r + 0.587f * c.g + 0.114f * c.b;
            var shadow = new Color(0.90f, 0.94f, 1.06f);
            var highlight = new Color(1.08f, 1.02f, 0.90f);
            Color tint = Color.Lerp(shadow, highlight, luma);
            return new Color(c.r * tint.r, c.g * tint.g, c.b * tint.b, 1f);
        }

        private static Color GradeDungeon(Color c) // DUNGEON — 굴혈: 청록
        {
            var tint = new Color(0.86f, 1.02f, 1.08f);
            Color tinted = new Color(c.r * tint.r, c.g * tint.g, c.b * tint.b, 1f);
            return ApplyContrast(tinted, 1.12f);
        }

        private static Color GradeForest(Color c) // FOREST — 들판: 황금시각
        {
            var tint = new Color(1.12f, 1.03f, 0.82f);
            return new Color(c.r * tint.r, c.g * tint.g, c.b * tint.b, 1f);
        }

        private static Color GradeStory(Color c) // STORY — 필드: 고대비
        {
            return ApplyContrast(c, 1.35f);
        }

        private static Color GradeRealm(Color c) // REALM — 성: 저채도
        {
            float luma = 0.299f * c.r + 0.587f * c.g + 0.114f * c.b;
            var grey = new Color(luma, luma, luma);
            Color mixed = Color.Lerp(c, grey, 0.55f);
            var tint = new Color(0.97f, 0.98f, 1.02f);
            return new Color(mixed.r * tint.r, mixed.g * tint.g, mixed.b * tint.b, 1f);
        }

        private static Color ApplyContrast(Color c, float amount)
        {
            return new Color(
                0.5f + (c.r - 0.5f) * amount,
                0.5f + (c.g - 0.5f) * amount,
                0.5f + (c.b - 0.5f) * amount,
                1f);
        }
    }
}
