using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// 사실 재질 → Saga/CelToon 변환(tasks U-0022 단계 2 비교용) — 지금 열린 씬의 렌더러 재질을 CelToon 재질로 바꿔 Godot 과 나란히 본다.
    /// 메뉴 `Saga/Cel Toon/Preview Open Scene` — 씬을 **저장하지 말 것**(재질은 메모리에만 만든다, 에셋 0). 되돌리기는 씬 다시 열기.
    /// 바탕 그림·색·알파 컷아웃만 옮기고(불투명 URP Lit/SimpleLit/Unlit/BakedLit), 반투명·파티클·UI·다른 셰이더 재질은 그대로 둔다.
    /// 3단계(K-0017 GLB 건물에 규칙으로 입히기)는 사용자 판정 뒤 같은 <see cref="Convert"/> 를 쓴다.
    /// </summary>
    public static class CelToonConvert
    {
        private static readonly HashSet<string> Convertible = new HashSet<string>
        {
            "Universal Render Pipeline/Lit", "Universal Render Pipeline/Simple Lit", "Universal Render Pipeline/Unlit", "Universal Render Pipeline/Baked Lit",
        };

        /// <summary>변환할 수 있으면 새 CelToon 재질, 아니면 null(반투명·다른 셰이더·이미 CelToon).</summary>
        public static Material Convert(Material src)
        {
            if (src == null || src.shader == null || !Convertible.Contains(src.shader.name)) return null;
            if (src.HasProperty("_Surface") && src.GetFloat("_Surface") > 0.5f) return null;
            var toon = Shader.Find(PlaytestCelToon.ShaderName);
            if (toon == null) return null;

            var m = new Material(toon) { name = src.name + " (toon)", hideFlags = HideFlags.DontSave };
            if (src.HasProperty("_BaseMap"))
            {
                m.SetTexture("_BaseMap", src.GetTexture("_BaseMap"));
                m.SetTextureScale("_BaseMap", src.GetTextureScale("_BaseMap"));
                m.SetTextureOffset("_BaseMap", src.GetTextureOffset("_BaseMap"));
            }
            if (src.HasProperty("_BaseColor")) m.SetColor("_BaseColor", src.GetColor("_BaseColor"));
            else if (src.HasProperty("_Color")) m.SetColor("_BaseColor", src.GetColor("_Color"));
            if (src.HasProperty("_AlphaClip") && src.GetFloat("_AlphaClip") > 0.5f)
            {
                m.SetFloat("_AlphaClip", 1f);
                m.EnableKeyword("_ALPHATEST_ON");
                m.SetFloat("_Cutoff", src.HasProperty("_Cutoff") ? src.GetFloat("_Cutoff") : 0.5f);
            }
            if (src.HasProperty("_Cull")) m.SetFloat("_Cull", src.GetFloat("_Cull"));
            return m;
        }

        /// <summary>열린 씬 전체 렌더러를 바꾼다. 바꾼 재질 칸 수를 돌려준다.</summary>
        public static int ConvertOpenScene()
        {
            var cache = new Dictionary<Material, Material>();
            int changed = 0;
            foreach (var r in Object.FindObjectsByType<Renderer>(FindObjectsInactive.Include, FindObjectsSortMode.None))
            {
                if (r is ParticleSystemRenderer || r is TrailRenderer || r is LineRenderer) continue;
                var mats = r.sharedMaterials;
                bool any = false;
                for (int i = 0; i < mats.Length; i++)
                {
                    var src = mats[i];
                    if (src == null) continue;
                    if (!cache.TryGetValue(src, out var toon)) cache[src] = toon = Convert(src);
                    if (toon == null) continue;
                    mats[i] = toon; any = true; changed++;
                }
                if (any) r.sharedMaterials = mats;
            }
            return changed;
        }

        [MenuItem("Saga/Cel Toon/Preview Open Scene (do not save)")]
        public static void PreviewOpenScene()
        {
            int n = ConvertOpenScene();
            Debug.Log($"[CelToonConvert] 재질 {n}칸을 CelToon 으로 바꿨다(메모리만 — 씬을 저장하지 말 것).");
        }
    }
}
