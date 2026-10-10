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

        public enum Kind { Toon, Emissive, KeptTransparent, Lit }

        /// <summary>이름 → (마스터 셰이더). 에디터 도구가 같은 표로 .mat 를 만든다.</summary>
        public static readonly (string name, string shader)[] Sources =
        {
            ("Toon", "Saga/CelToon"),
            ("ToonVertex", "Saga/CelToon"),
            ("Ground", "Saga/RegionGround"),
            ("Unlit", "Universal Render Pipeline/Unlit"),
            ("Lit", "Universal Render Pipeline/Lit"),   // U-0085 배경(소품·길·광장) 사실 재질
            ("SparkAdd", "Saga/RegionSpark"),
            ("SparkAlpha", "Saga/RegionSpark"),
            ("Sky", "Skybox/Panoramic"),
            ("SkyReal", "Saga/SkyReal"),       // U-0083 사실 하늘(SkyPass)
            ("WaterReal", "Saga/WaterReal"),   // U-0078 사실 물 — TerrainBuilder 는 Shader.Find 로 찾으니 빌드에 남기려고 원본만 둔다
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

        // ---- U-0085 배경 사실 재질 — 툰은 인물에만 ----
        // "배경 전부 사실·인물 툰"(사용자 10-09): 소품·건물·나무·꾸밈은 GLB 의 PBR(glTFast·URP Lit) 그대로 두고 재질 이름으로 거칠기·금속값만 다듬는다.
        // 반투명은 그대로, 스스로 빛나는 재질은 지금 규칙(Unlit) 그대로. 되돌리기 = 환경변수 `SAGA_PROPS_TOON=1`(옛 툰).

        public static bool PropsToon => System.Environment.GetEnvironmentVariable("SAGA_PROPS_TOON") == "1";

        /// <summary>인물(툰 유지 대상)인가 — 스킨 메시이거나 위(부모 포함)에 Animator 가 있는 것. 손에 든 무기도 뼈 아래라 인물 쪽.</summary>
        public static bool IsCharacter(Renderer r) =>
            r is SkinnedMeshRenderer || (r != null && r.GetComponentInParent<Animator>(true) != null);

        /// <summary>배경 재질 하나 — 반투명·발광은 <see cref="FromGltf"/> 와 같은 규칙, 나머지는 PBR 그대로 + 이름별 값(같은 원본은 cache).</summary>
        public static Material ForBackdrop(Material src, Dictionary<Material, Material> cache, out Kind kind)
        {
            if (PropsToon) return FromGltf(src, cache, out kind);
            kind = Kind.Lit;
            if (src == null) return null;
            if (src.shader != null && (src.shader.name == "Saga/CelToon" || src.shader.name == "Universal Render Pipeline/Unlit")) { kind = KindOf(src, null); return src; }
            if (cache != null && cache.TryGetValue(src, out var done)) { kind = done != src ? KindOf(done, src) : IsTransparent(src) ? Kind.KeptTransparent : Kind.Lit; return done; }
            if (IsTransparent(src) || IsEmissive(src, out _)) return FromGltf(src, cache, out kind);
            if (src.name.EndsWith(" (real)")) return src;   // 이미 다듬은 것(씬 패스는 두 번 훑는다)
            var result = TuneByName(src);
            if (cache != null) cache[src] = result;
            return result;
        }

        /// <summary>재질 이름 → (금속, 거칠기). 모르는 이름은 null(원본 값 그대로).</summary>
        public static (float metallic, float roughness)? SurfaceFor(string name)
        {
            if (string.IsNullOrEmpty(name)) return null;
            string n = name.ToLowerInvariant();
            bool Has(params string[] keys) { foreach (var k in keys) if (n.Contains(k)) return true; return false; }
            if (Has("metal", "iron", "steel", "rust", "bronze", "copper", "brass", "chrome", "gold")) return (0.6f, 0.5f);
            if (Has("plaster", "stucco", "clay", "mud", "adobe", "concrete", "cement")) return (0f, 0.95f);
            if (Has("stone", "rock", "brick", "slate", "tile", "roof", "cobble", "marble", "granite", "wall", "boulder", "pebble", "gravel")) return (0f, 0.9f);
            if (Has("wood", "plank", "log", "bark", "timber", "barrel", "crate", "trunk", "branch", "fence")) return (0f, 0.8f);
            if (Has("leaf", "leaves", "foliage", "grass", "bush", "hay", "straw")) return (0f, 0.85f);
            if (Has("cloth", "fabric", "canvas", "rope", "rug", "carpet", "cushion")) return (0f, 0.9f);
            return null;
        }

        /// <summary>이름이 알려진 재질이면 복제해 금속·거칠기를 맞춘다(glTFast·URP Lit 속성 둘 다), 아니면 원본 그대로.</summary>
        public static Material TuneByName(Material src)
        {
            var s = SurfaceFor(src.name);
            if (s == null) return src;
            var m = new Material(src) { name = src.name + " (real)" };
            if (m.HasProperty("metallicFactor")) m.SetFloat("metallicFactor", s.Value.metallic);
            if (m.HasProperty("roughnessFactor")) m.SetFloat("roughnessFactor", s.Value.roughness);
            if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", s.Value.metallic);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", 1f - s.Value.roughness);
            return m;
        }

        /// <summary>코드 메시(길·광장·쉼터 색 소품)용 배경 재질 — URP Lit(거칠게). `SAGA_PROPS_TOON=1` 이면 옛 툰.</summary>
        public static Material Backdrop(Texture tex, Color baseColorLinear, float roughness = 0.9f)
        {
            if (PropsToon) return Toon(tex, baseColorLinear);
            var m = Make("Lit");
            if (m == null) return Toon(tex, baseColorLinear);
            if (tex != null) m.SetTexture("_BaseMap", tex);
            m.SetColor("_BaseColor", baseColorLinear.gamma);
            m.SetFloat("_Metallic", 0f);
            m.SetFloat("_Smoothness", 1f - roughness);
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
            if (made.shader != null && made.shader.name == "Universal Render Pipeline/Unlit") return Kind.Emissive;
            return made.shader != null && made.shader.name == "Saga/CelToon" ? Kind.Toon : Kind.Lit;
        }

        private static void SetST(Material m, Vector4 st)
        {
            m.SetTextureScale("_BaseMap", new Vector2(st.x, st.y));
            m.SetTextureOffset("_BaseMap", new Vector2(st.z, st.w));
        }
    }
}
