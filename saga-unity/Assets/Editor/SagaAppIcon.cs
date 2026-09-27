using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 110 ⑥b 앱 아이콘 — `Assets/Art/Icon/` 세 장(그리는 법 `tools/app-icon/make_icon.py`, 임시 — 그림을 받으면 같은 이름으로 바꿔 넣는다)을
    /// PlayerSettings 에 건다: PC·기본 = 전체 그림, 안드로이드 적응형 = 뒤판 + 앞판, 둥근·옛 아이콘 = 전체 그림.
    /// 안드로이드 모듈이 없는 PC 에서도 컴파일되게 아이콘 종류는 이름으로 찾는다(`UnityEditor.Android` 를 안 씀).
    /// 빌드가 매번 부른다(<see cref="SagaPlayerBuild"/>), 이미 같으면 안 바꾼다.
    /// </summary>
    public static class SagaAppIcon
    {
        public const string Dir = "Assets/Art/Icon/";
        public const string Full = Dir + "icon_full.png";
        public const string AdaptiveBg = Dir + "icon_adaptive_bg.png";
        public const string AdaptiveFg = Dir + "icon_adaptive_fg.png";

        [MenuItem("Saga/Build/Apply App Icon")]
        public static void ApplyMenu()
        {
            bool ok = Apply();
            if (Application.isBatchMode) { AssetDatabase.SaveAssets(); EditorApplication.Exit(ok ? 0 : 1); }
        }

        public static bool Apply()
        {
            foreach (var p in new[] { Full, AdaptiveBg, AdaptiveFg }) Import(p, p == AdaptiveFg);
            var full = AssetDatabase.LoadAssetAtPath<Texture2D>(Full);
            var bg = AssetDatabase.LoadAssetAtPath<Texture2D>(AdaptiveBg);
            var fg = AssetDatabase.LoadAssetAtPath<Texture2D>(AdaptiveFg);
            if (full == null || bg == null || fg == null) { Debug.LogError($"[SagaAppIcon] 아이콘 그림 없음 ({Dir})"); return false; }

            // PC·기본(다른 대상이 따로 없으면 이것)
            var cur = PlayerSettings.GetIcons(NamedBuildTarget.Unknown, IconKind.Any);
            if (cur.Length != 1 || cur[0] != full) PlayerSettings.SetIcons(NamedBuildTarget.Unknown, new[] { full }, IconKind.Any);

            int android = 0;
            foreach (var kind in PlayerSettings.GetSupportedIconKinds(NamedBuildTarget.Android))
            {
                var icons = PlayerSettings.GetPlatformIcons(NamedBuildTarget.Android, kind);
                bool adaptive = kind.ToString().Contains("Adaptive");
                bool changed = false;
                foreach (var icon in icons)
                {
                    var want = adaptive && icon.maxLayerCount >= 2 ? new[] { bg, fg } : new[] { full };
                    var have = icon.GetTextures();
                    if (have != null && have.Length == want.Length && have.SequenceEqual(want)) continue;
                    icon.SetTextures(want);
                    changed = true;
                }
                if (changed) PlayerSettings.SetPlatformIcons(NamedBuildTarget.Android, kind, icons);
                android += icons.Length;
            }
            Debug.Log($"[SagaAppIcon] OK — 기본 1 · 안드로이드 칸 {android}");
            return true;
        }

        private static void Import(string path, bool alpha)
        {
            var ti = AssetImporter.GetAtPath(path) as TextureImporter;
            if (ti == null) return;
            bool dirty = false;
            void Set<T>(T now, T want, System.Action<T> set) { if (!Equals(now, want)) { set(want); dirty = true; } }
            Set(ti.textureType, TextureImporterType.Default, v => ti.textureType = v);
            Set(ti.mipmapEnabled, false, v => ti.mipmapEnabled = v);
            Set(ti.textureCompression, TextureImporterCompression.Uncompressed, v => ti.textureCompression = v);
            Set(ti.maxTextureSize, 1024, v => ti.maxTextureSize = v);
            Set(ti.alphaIsTransparency, alpha, v => ti.alphaIsTransparency = v);
            Set(ti.npotScale, TextureImporterNPOTScale.None, v => ti.npotScale = v);
            if (dirty) ti.SaveAndReimport();
        }
    }
}
