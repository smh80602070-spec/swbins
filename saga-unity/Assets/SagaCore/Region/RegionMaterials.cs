using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Saga.Core.Region
{
    /// <summary>지역 재질 공장(tasks U-0023). 셰이더를 빌드에서 안 빠지게 하려고 `Resources/RegionMaterials/*.mat` 를 본뜬다
    /// (에디터 메뉴 `Saga/Regions/Create Materials` 가 만든다). 없으면 Shader.Find 로 대신하지만 빌드에선 셰이더가 빠질 수 있어 경고한다.
    /// GLB(glTFast) 재질은 툰(CelToon)으로 바꾼다 — 반투명은 원본 그대로, 스스로 빛나는 재질(emissive)은 빛 계산 없는 Unlit 로.</summary>
    public static class RegionMaterials
    {
        public const string Dir = "RegionMaterials/";

        public enum Kind { Toon, Emissive, KeptTransparent }

        /// <summary>이름 → (마스터 셰이더). 에디터 도구가 같은 표로 .mat 를 만든다.</summary>
        public static readonly (string name, string shader)[] Sources =
        {
            ("Toon", "Saga/CelToon"),
            ("ToonVertex", "Saga/CelToon"),
            ("Ground", "Saga/RegionGround"),
            ("Unlit", "Universal Render Pipeline/Unlit"),
            ("SparkAdd", "Saga/RegionSpark"),
            ("SparkAlpha", "Saga/RegionSpark"),
            ("Sky", "Skybox/Panoramic"),
        };

        public static Material Make(string name)
        {
            var src = Resources.Load<Material>(Dir + name);
            Material m;
            if (src != null) m = new Material(src);
            else
            {
                string shaderName = null;
                foreach (var s in Sources) if (s.name == name) shaderName = s.shader;
                var shader = shaderName == null ? null : Shader.Find(shaderName);
                if (shader == null) { Debug.LogError("[Region] 재질 원본 " + Dir + name + " 도 셰이더도 없다"); return null; }
                Debug.LogWarning("[Region] " + Dir + name + ".mat 이 없어 Shader.Find 로 만든다(빌드에서 셰이더가 빠질 수 있다 — Saga/Regions/Create Materials)");
                m = new Material(shader);
                if (name == "ToonVertex") { m.SetFloat("_UseVertexColor", 1f); m.EnableKeyword("_VERTEX_COLOR"); }
            }
            m.name = name;
            m.enableInstancing = name == "Toon" || name == "ToonVertex" || name == "Unlit";
            return m;
        }

        /// <summary>지정한 그림·색으로 툰 재질(그림 없으면 흰색 바탕).</summary>
        public static Material Toon(Texture tex, Color baseColorLinear)
        {
            var m = Make("Toon");
            if (m == null) return null;
            if (tex != null) m.SetTexture("_BaseMap", tex);
            m.SetColor("_BaseColor", baseColorLinear.gamma);
            return m;
        }

        // ---- glTFast 재질 읽기 ----
        private static bool TryTexture(Material m, out Texture tex, out Vector4 st, params string[] names)
        {
            foreach (var n in names)
            {
                if (!m.HasProperty(n)) continue;
                tex = m.GetTexture(n);
                st = new Vector4(m.GetTextureScale(n).x, m.GetTextureScale(n).y, m.GetTextureOffset(n).x, m.GetTextureOffset(n).y);
                return tex != null;
            }
            tex = null; st = new Vector4(1, 1, 0, 0);
            return false;
        }

        private static Color ReadColor(Material m, Color fallback, params string[] names)
        {
            foreach (var n in names) if (m.HasProperty(n)) return m.GetColor(n);
            return fallback;
        }

        public static bool IsTransparent(Material m)
        {
            if (m.renderQueue >= (int)RenderQueue.Transparent) return true;
            return m.HasProperty("_Surface") && m.GetFloat("_Surface") > 0.5f;
        }

        /// <summary>이 이하 발광은 "약한 발광", 이 이상 기본색은 "밝은 기본색" — 둘이 겹치면 발광색 단색으로 바꾸지 않는다.</summary>
        public const float WeakGlowMax = 0.5f, BrightBaseMin = 0.5f;

        public static bool IsEmissive(Material m, out Color emissive)
        {
            emissive = ReadColor(m, Color.black, "emissiveFactor", "_EmissionColor");
            return emissive.maxColorComponent > 0.01f;
        }

        /// <summary>GLB 재질 하나를 툰·Unlit 로 바꾼다(같은 원본은 cache 가 같은 결과를 돌려준다). 이미 툰이면 그대로.</summary>
        public static Material FromGltf(Material src, Dictionary<Material, Material> cache, out Kind kind)
        {
            kind = Kind.Toon;
            if (src == null) return null;
            if (src.shader != null && (src.shader.name == "Saga/CelToon" || src.shader.name == "Universal Render Pipeline/Unlit")) return src;
            if (cache != null && cache.TryGetValue(src, out var done))
            {
                kind = KindOf(done, src);
                return done;
            }
            Material result;
            if (IsTransparent(src)) { result = src; kind = Kind.KeptTransparent; }
            else if (IsEmissive(src, out var emissive))
            {
                kind = Kind.Emissive;
                result = Make("Unlit");
                if (result != null)
                {
                    if (TryTexture(src, out var etex, out var est, "emissiveTexture")) { result.SetTexture("_BaseMap", etex); SetST(result, est); }
                    // 약한 발광(≤0.5) + 밝은 기본색(≥0.5)은 "빛나는 것"이 아니라 밝은 물체에 은은한 발광이 얹힌 것(TimeRift 구름바다 `cloudpuff`) —
                    // 발광색만 쓰면 갈색이 된다. 기본색을 어둡게(조명 몫 0.65) 더해 밝은 분홍 흰색으로 둔다. 강한 발광(고리·석등 불)은 그대로.
                    var baseCol = ReadColor(src, Color.white, "baseColorFactor", "_BaseColor", "_Color");
                    if (emissive.maxColorComponent <= WeakGlowMax && baseCol.maxColorComponent >= BrightBaseMin && !TryTexture(src, out _, out _, "emissiveTexture"))
                        emissive = new Color(Mathf.Min(1f, baseCol.r * 0.65f + emissive.r), Mathf.Min(1f, baseCol.g * 0.65f + emissive.g), Mathf.Min(1f, baseCol.b * 0.65f + emissive.b), 1f);
                    result.SetColor("_BaseColor", emissive);
                }
            }
            else
            {
                result = Make("Toon");
                if (result != null)
                {
                    if (TryTexture(src, out var tex, out var st, "baseColorTexture", "_BaseMap", "_MainTex")) { result.SetTexture("_BaseMap", tex); SetST(result, st); }
                    result.SetColor("_BaseColor", ReadColor(src, Color.white, "baseColorFactor", "_BaseColor", "_Color"));
                    // glTFast 는 alphaMode MASK 를 _ALPHATEST_ON 키워드 + alphaCutoff 속성으로 싣는다
                    if (src.IsKeywordEnabled("_ALPHATEST_ON"))
                    {
                        result.SetFloat("_AlphaClip", 1f); result.EnableKeyword("_ALPHATEST_ON");
                        result.SetFloat("_Cutoff", src.HasProperty("alphaCutoff") ? src.GetFloat("alphaCutoff") : 0.5f);
                    }
                }
            }
            if (result != null && result != src) result.name = src.name + (kind == Kind.Emissive ? " (glow)" : " (toon)");
            if (cache != null) cache[src] = result;
            return result;
        }

        private static Kind KindOf(Material made, Material src)
        {
            if (made == src) return Kind.KeptTransparent;
            return made.shader != null && made.shader.name == "Universal Render Pipeline/Unlit" ? Kind.Emissive : Kind.Toon;
        }

        private static void SetST(Material m, Vector4 st)
        {
            m.SetTextureScale("_BaseMap", new Vector2(st.x, st.y));
            m.SetTextureOffset("_BaseMap", new Vector2(st.z, st.w));
        }
    }
}
