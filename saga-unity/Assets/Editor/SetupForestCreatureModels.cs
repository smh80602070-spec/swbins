using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 108 후속 — FOREST 짐승 여덟을 primitive 도형에서 사실 모델로. Mixamo 몸 여섯
    /// (`SetupNpcCharacterImports` 표: Goblin·Hulk·Warrok·Parasite·Nightshade·Jolleen, 원본은 `tools/mixamo_automation`
    /// README 레시피) 위에 종마다 키·빛깔·꾸밈을 얹어 `CharactersRealistic/Forest/Forest_&lt;종&gt;.prefab` 으로 굽는다.
    /// 씬 빌더(`BuildTestVillageForestScene`)가 이 프리팹을 `ForestCreatureBuilder.models` 에 꽂는다.
    ///
    /// `CharactersRealistic/` 는 gitignore 라 PC 마다 몸을 받은 뒤 이 메뉴 → 숲 씬 재빌드를 한 번 돌린다.
    /// 몸이 없는 종은 건너뛰고, 그 종은 런타임에 예전 도형으로 선다.
    ///
    /// 꾸밈은 에셋만: 버섯 무리·꽃은 자체 짝(U-0151 — `Resources/World` mushroom_01·flower_patch_01), 없는 PC 는 옛 Quaternius(`Art/Vegetation/QuaterniusNature/`).
    /// 나비정령 날개만 납작 구 넷(반투명 발광 재질, 런타임 `ForestCreature` 가 퍼덕인다) — 맞는 CC0 날개 메시가 없다.
    /// </summary>
    public static class SetupForestCreatureModels
    {
        private const string Root = "Assets/Art/CharactersRealistic/Forest/";
        private const string MatDir = Root + "Materials/";
        private const string NatureDir = "Assets/Art/Vegetation/QuaterniusNature/";

        // U-0151 — 빌린 Quaternius 식물 → 자체 짝(표 tools/world-forge/data/k129_unity.json).
        private static readonly Dictionary<string, string> NaturePairs = new Dictionary<string, string>
        {
            { "Flower_3_Single", "flower_patch_01" }, { "Flower_4_Single", "flower_patch_01" }, { "Mushroom_Common", "mushroom_01" },
        };

        private static string NaturePath(string name) =>
            NaturePairs.TryGetValue(name, out var w) && File.Exists(SelfPairs.WorldDir + w + ".glb") ? SelfPairs.WorldDir + w + ".glb" : $"{NatureDir}{name}.gltf";

        private enum Extra { None, SporeBack, MushroomHat, FlowerCrown, Wings, GhostLight }

        private sealed class Look
        {
            public string Kind, Body;
            public float Height;          // 선 키(m). 플레이어 Maria 1.8m.
            public Color Tint = Color.white;
            public float Metallic = -1f, Smoothness = -1f; // <0 이면 원래 값
            public Color Emission = Color.black;
            public float Alpha = 1f;      // <1 이면 반투명(안개유령)
            public float LiftY;           // 몸을 뿌리에서 올리고 내림(안개유령은 den 이 1m 떠 있어 내린다)
            public Extra Extra;
        }

        // 종 순서는 상관없다 — 씬 빌더가 `ForestCreatureBuilder.KindOrder` 로 찾는다.
        private static readonly Look[] Looks =
        {
            // 숲도깨비 — 마른 고블린, 이끼빛을 살짝.
            new Look { Kind = "dokkaebi", Body = "Goblin", Height = 1.25f, Tint = new Color(0.86f, 1f, 0.84f) },
            // 바위도깨비 — 회색 거구, 돌빛 회갈로 눌러 바위 피부처럼.
            new Look { Kind = "bawi", Body = "Hulk", Height = 1.85f, Tint = new Color(0.86f, 0.8f, 0.72f), Smoothness = 0.15f },
            // 무쇠도깨비 — 뿔 난 거구, 청회 무쇠빛 + 금속감.
            new Look { Kind = "musoetokkebi", Body = "Warrok", Height = 1.75f, Tint = new Color(0.66f, 0.72f, 0.86f), Metallic = 0.55f, Smoothness = 0.45f },
            // 포자괴물(유일한 적대) — 병든 황록 + 등·어깨에 버섯 무리.
            new Look { Kind = "pojagoemul", Body = "Parasite", Height = 1.6f, Tint = new Color(0.86f, 0.95f, 0.5f), Emission = new Color(0.04f, 0.06f, 0f), Extra = Extra.SporeBack },
            // 안개유령 — 반투명 창백 + 제 빛. den 이 땅 위 1m 라 몸을 0.55 내려 발끝이 0.45m 뜬다.
            new Look { Kind = "angaeyuryeong", Body = "Nightshade", Height = 1.6f, Tint = new Color(0.72f, 0.84f, 0.95f), Alpha = 0.5f,
                Emission = new Color(0.18f, 0.24f, 0.32f), LiftY = -0.55f, Extra = Extra.GhostLight },
            // 정령 셋 — 잎 옷 요정 몸 하나를 작게 줄이고 빛깔·꾸밈으로 가른다.
            new Look { Kind = "beoseot", Body = "Jolleen", Height = 0.95f, Tint = new Color(0.7f, 0.95f, 0.95f), Emission = new Color(0f, 0.05f, 0.05f), Extra = Extra.MushroomHat },
            new Look { Kind = "kkot", Body = "Jolleen", Height = 0.9f, Tint = new Color(1f, 0.88f, 0.9f), Emission = new Color(0.06f, 0.03f, 0.04f), Extra = Extra.FlowerCrown },
            new Look { Kind = "nabijeongryeong", Body = "Jolleen", Height = 0.85f, Tint = new Color(0.9f, 0.76f, 1f), Emission = new Color(0.05f, 0.03f, 0.08f), Extra = Extra.Wings },
        };

        public static string PrefabPath(string kind) => $"{Root}Forest_{kind}.prefab";

        [MenuItem("Saga/Setup Forest Creature Models")]
        public static void SetupAll()
        {
            Directory.CreateDirectory(MatDir);
            AssetDatabase.Refresh();

            var bodiesDone = new HashSet<string>();
            int built = 0;
            foreach (var look in Looks)
            {
                if (!bodiesDone.Contains(look.Body))
                {
                    bodiesDone.Add(look.Body);
                    if (File.Exists($"Assets/Art/CharactersRealistic/{look.Body}/{look.Body}.fbx"))
                        SetupNpcCharacterImports.SetupOne(look.Body);
                }
                if (Bake(look)) built++;
            }
            AssetDatabase.SaveAssets();
            Debug.Log($"[SetupForestCreatureModels] {built}/{Looks.Length} 짐승 프리팹을 구움");
        }

        private static bool Bake(Look look)
        {
            var bodyPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(look.Body));
            if (bodyPrefab == null)
            {
                Debug.LogWarning($"[SetupForestCreatureModels] {look.Kind}: {look.Body} 몸 프리팹 없음 — 건너뜀(도형으로 선다)");
                return false;
            }

            var root = new GameObject($"Forest_{look.Kind}");
            var body = (GameObject)PrefabUtility.InstantiatePrefab(bodyPrefab, root.transform);
            body.transform.localPosition = Vector3.zero;
            body.transform.localRotation = Quaternion.identity;

            var b = RendererBounds(body);
            if (b.size.y < 0.01f)
            {
                Debug.LogError($"[SetupForestCreatureModels] {look.Kind}: 몸 크기를 못 잼");
                Object.DestroyImmediate(root);
                return false;
            }
            float scale = look.Height / b.size.y;
            body.transform.localScale = Vector3.one * scale;
            body.transform.localPosition = new Vector3(0f, -b.min.y * scale + look.LiftY, 0f);

            Recolor(look, body);
            var animator = body.GetComponent<Animator>();
            AddExtra(look, body, animator);

            PrefabUtility.SaveAsPrefabAsset(root, PrefabPath(look.Kind));
            Object.DestroyImmediate(root);
            Debug.Log($"[SetupForestCreatureModels] saved {PrefabPath(look.Kind)} (키 {look.Height}m, 배율 {scale:F3})");
            return true;
        }

        private static Bounds RendererBounds(GameObject go)
        {
            var rs = go.GetComponentsInChildren<Renderer>();
            if (rs.Length == 0) return new Bounds();
            var b = rs[0].bounds;
            for (int i = 1; i < rs.Length; i++) b.Encapsulate(rs[i].bounds);
            return b;
        }

        // ── 빛깔 ──

        private static void Recolor(Look look, GameObject body)
        {
            int n = 0;
            foreach (var r in body.GetComponentsInChildren<Renderer>())
            {
                var mats = r.sharedMaterials;
                for (int i = 0; i < mats.Length; i++)
                {
                    if (mats[i] == null) continue;
                    var m = new Material(mats[i]) { name = $"Forest_{look.Kind}_{n}" };
                    Tint(m, look.Tint);
                    if (look.Metallic >= 0f && m.HasProperty("_Metallic")) m.SetFloat("_Metallic", look.Metallic);
                    if (look.Smoothness >= 0f && m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", look.Smoothness);
                    if (look.Emission.maxColorComponent > 0f) Emit(m, look.Emission);
                    if (look.Alpha < 1f) MakeTransparent(m, look.Alpha);
                    mats[i] = SaveMat(m);
                    n++;
                }
                r.sharedMaterials = mats;
                if (look.Alpha < 1f) r.shadowCastingMode = ShadowCastingMode.Off; // 안개는 그림자를 안 드리운다.
            }
        }

        private static void Tint(Material m, Color tint)
        {
            foreach (var prop in new[] { "_BaseColor", "baseColorFactor", "_Color" })
            {
                if (!m.HasProperty(prop)) continue;
                var c = m.GetColor(prop);
                m.SetColor(prop, new Color(c.r * tint.r, c.g * tint.g, c.b * tint.b, c.a));
                return;
            }
        }

        private static void Emit(Material m, Color e)
        {
            if (m.HasProperty("_EmissionColor"))
            {
                m.EnableKeyword("_EMISSION");
                m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
                m.SetColor("_EmissionColor", e);
            }
            else if (m.HasProperty("emissiveFactor"))
            {
                m.SetColor("emissiveFactor", e);
            }
        }

        /// <summary>URP Lit 반투명(알파 섞기). 에셋으로 저장해 두니 빌드에 변형이 들어간다.</summary>
        private static void MakeTransparent(Material m, float alpha)
        {
            if (m.HasProperty("_BaseColor"))
            {
                var c = m.GetColor("_BaseColor");
                m.SetColor("_BaseColor", new Color(c.r, c.g, c.b, alpha));
            }
            m.SetFloat("_Surface", 1f);
            m.SetFloat("_Blend", 0f);
            m.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
            m.SetFloat("_DstBlend", (float)BlendMode.OneMinusSrcAlpha);
            m.SetFloat("_SrcBlendAlpha", (float)BlendMode.One);
            m.SetFloat("_DstBlendAlpha", (float)BlendMode.OneMinusSrcAlpha);
            m.SetFloat("_ZWrite", 0f);
            m.SetFloat("_AlphaClip", 0f);
            m.SetOverrideTag("RenderType", "Transparent");
            m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
            m.DisableKeyword("_ALPHATEST_ON");
            m.SetShaderPassEnabled("DepthOnly", false);
            m.SetShaderPassEnabled("ShadowCaster", false);
            m.renderQueue = (int)RenderQueue.Transparent;
        }

        private static Material SaveMat(Material m)
        {
            string path = $"{MatDir}{m.name}.mat";
            if (AssetDatabase.LoadAssetAtPath<Material>(path) != null) AssetDatabase.DeleteAsset(path);
            AssetDatabase.CreateAsset(m, path);
            return m;
        }

        // ── 꾸밈 ──

        private static void AddExtra(Look look, GameObject body, Animator animator)
        {
            if (look.Extra == Extra.None) return;
            if (animator == null || !animator.isHuman)
            {
                Debug.LogWarning($"[SetupForestCreatureModels] {look.Kind}: 사람 뼈대가 아니라 꾸밈을 건너뜀");
                return;
            }
            var head = animator.GetBoneTransform(HumanBodyBones.Head);
            var chest = Bone(animator, HumanBodyBones.UpperChest, HumanBodyBones.Chest);
            if (head == null || chest == null)
            {
                Debug.LogWarning($"[SetupForestCreatureModels] {look.Kind}: 머리·가슴 뼈가 없어 꾸밈을 건너뜀");
                return;
            }
            var lShoulder = Bone(animator, HumanBodyBones.LeftShoulder, HumanBodyBones.Chest);
            var rShoulder = Bone(animator, HumanBodyBones.RightShoulder, HumanBodyBones.Chest);
            float top = RendererBounds(body).max.y;
            float h = look.Height;

            switch (look.Extra)
            {
                case Extra.SporeBack:
                {
                    // 등 한가운데 큰 무리 + 두 어깨 작은 무리 — 걸을 때 몸과 같이 흔들린다.
                    var mat = NatureMat("Mushroom_Common", "Forest_pojagoemul_spore", new Color(0.8f, 0.9f, 0.45f), new Color(0.05f, 0.08f, 0f));
                    Place(chest, "Spore0", NaturePath("Mushroom_Common"), mat, chest.position + new Vector3(0f, 0.02f * h, -0.14f * h), 0.34f * h, Quaternion.Euler(-70f, 0f, 0f));
                    Place(lShoulder, "Spore1", NaturePath("Mushroom_Common"), mat, lShoulder.position + new Vector3(-0.06f * h, 0.05f * h, -0.04f * h), 0.2f * h, Quaternion.Euler(-20f, 0f, 25f));
                    Place(rShoulder, "Spore2", NaturePath("Mushroom_Common"), mat, rShoulder.position + new Vector3(0.06f * h, 0.05f * h, -0.04f * h), 0.2f * h, Quaternion.Euler(-20f, 180f, -25f));
                    break;
                }
                case Extra.MushroomHat:
                {
                    var mat = NatureMat("Mushroom_Common", "Forest_beoseot_cap", new Color(0.75f, 1f, 1f), new Color(0f, 0.06f, 0.06f));
                    var at = new Vector3(head.position.x, Mathf.Lerp(head.position.y, top, 0.7f), head.position.z);
                    Place(head, "MushroomHat", NaturePath("Mushroom_Common"), mat, at, 0.42f * h, Quaternion.identity);
                    break;
                }
                case Extra.FlowerCrown:
                {
                    var mat = NatureMat("Flower_3_Single", "Forest_kkot_flower", Color.white, new Color(0.05f, 0.02f, 0.03f));
                    var c = new Vector3(head.position.x, Mathf.Lerp(head.position.y, top, 0.72f), head.position.z);
                    float radius = 0.085f * h;
                    for (int i = 0; i < 7; i++)
                    {
                        float a = i * Mathf.PI * 2f / 7f;
                        var p = c + new Vector3(Mathf.Cos(a) * radius, 0f, Mathf.Sin(a) * radius);
                        string path = NaturePath(i % 2 == 0 ? "Flower_3_Single" : "Flower_4_Single");
                        Place(head, $"Flower{i}", path, mat, p, 0.11f * h, Quaternion.Euler(0f, i * 51f, 0f), outward: new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)));
                    }
                    break;
                }
                case Extra.Wings:
                    Wing(chest, "WingL", -1f, h);
                    Wing(chest, "WingR", 1f, h);
                    break;
                case Extra.GhostLight:
                {
                    var go = new GameObject("GhostLight");
                    go.transform.SetParent(chest, false);
                    go.transform.position = chest.position + new Vector3(0f, 0f, 0.1f * h);
                    var l = go.AddComponent<Light>();
                    l.type = LightType.Point;
                    l.color = new Color(0.72f, 0.86f, 1f);
                    l.range = 3.5f;
                    l.intensity = 1.4f;
                    l.shadows = LightShadows.None;
                    break;
                }
            }
        }

        private static Transform Bone(Animator a, HumanBodyBones want, HumanBodyBones fallback)
        {
            var t = a.GetBoneTransform(want);
            return t != null ? t : a.GetBoneTransform(fallback);
        }

        /// <summary>glTF 하나를 뼈에 붙인다. `size` 는 가장 긴 변(m). `outward` 가 있으면 그쪽으로 살짝 눕힌다(화관).</summary>
        private static void Place(Transform bone, string name, string gltfPath, Material mat, Vector3 worldPos, float size,
            Quaternion rot, Vector3? outward = null)
        {
            var asset = AssetDatabase.LoadAssetAtPath<GameObject>(gltfPath);
            if (asset == null)
            {
                Debug.LogWarning($"[SetupForestCreatureModels] {gltfPath} 없음 — {name} 건너뜀");
                return;
            }
            var go = (GameObject)PrefabUtility.InstantiatePrefab(asset);
            go.name = name;
            go.transform.rotation = outward.HasValue
                ? Quaternion.FromToRotation(Vector3.up, (Vector3.up * 2.5f + outward.Value).normalized) * rot
                : rot;
            go.transform.localScale = Vector3.one;
            var b = RendererBounds(go);
            float longest = Mathf.Max(b.size.x, Mathf.Max(b.size.y, b.size.z));
            if (longest > 0.0001f) go.transform.localScale = Vector3.one * (size / longest);
            go.transform.position = worldPos;
            if (gltfPath.StartsWith(SelfPairs.WorldDir)) // 자체 짝은 원점이 밑면이 아닐 수 있다 — 밑면 가운데를 그 자리에(Quaternius 는 원점 = 밑면)
            {
                var nb = RendererBounds(go);
                go.transform.position += worldPos - new Vector3(nb.center.x, nb.min.y, nb.center.z);
            }
            foreach (var r in go.GetComponentsInChildren<Renderer>())
            {
                if (mat != null && r.sharedMaterials.Length == 1)
                {
                    var ms = r.sharedMaterials;
                    for (int i = 0; i < ms.Length; i++) ms[i] = mat;
                    r.sharedMaterials = ms;
                }
                r.shadowCastingMode = ShadowCastingMode.Off; // 작은 꾸밈 — 그림자 값 아낀다(보이는 차이 없음).
            }
            foreach (var col in go.GetComponentsInChildren<Collider>()) Object.DestroyImmediate(col);
            go.transform.SetParent(bone, true);
        }

        /// <summary>glTF 재질을 복사해 빛깔·발광을 입힌다(원본 텍스처 유지).</summary>
        private static Material NatureMat(string gltfName, string matName, Color tint, Color emission)
        {
            var asset = AssetDatabase.LoadAssetAtPath<GameObject>(NaturePath(gltfName));
            var r = asset != null ? asset.GetComponentInChildren<Renderer>() : null;
            if (r == null || r.sharedMaterial == null) return null;
            var m = new Material(r.sharedMaterial) { name = matName };
            Tint(m, tint);
            if (emission.maxColorComponent > 0f) Emit(m, emission);
            return SaveMat(m);
        }

        /// <summary>나비 날개 한 쪽 — 축(`WingL`/`WingR`, 몸 방향 그대로) 아래 윗날개·아랫날개 납작 구 둘.
        /// 런타임 `ForestCreature` 가 축의 앞(z)축으로 돌려 퍼덕인다.</summary>
        private static void Wing(Transform chest, string name, float side, float h)
        {
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = $"Forest_nabi_{name}" };
            mat.SetColor("_BaseColor", new Color(0.62f, 0.7f, 1f));
            mat.SetFloat("_Smoothness", 0.8f);
            Emit(mat, new Color(0.22f, 0.18f, 0.45f));
            MakeTransparent(mat, 0.6f);
            mat = SaveMat(mat);

            var pivot = new GameObject(name).transform;
            pivot.position = chest.position + new Vector3(0.03f * side * h, 0.02f * h, -0.08f * h);
            pivot.rotation = Quaternion.identity;
            Blade(pivot, "Upper", mat, new Vector3(0.2f * side, 0.1f, -0.02f) * h, new Vector3(0.38f, 0.24f, 0.015f) * h, 20f * side);
            Blade(pivot, "Lower", mat, new Vector3(0.14f * side, -0.08f, -0.02f) * h, new Vector3(0.24f, 0.18f, 0.015f) * h, -25f * side);
            pivot.SetParent(chest, true);
        }

        private static void Blade(Transform pivot, string name, Material mat, Vector3 localPos, Vector3 size, float rollDeg)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = name;
            Object.DestroyImmediate(go.GetComponent<Collider>());
            go.transform.SetParent(pivot, false);
            go.transform.localPosition = localPos;
            go.transform.localRotation = Quaternion.Euler(0f, 0f, rollDeg);
            go.transform.localScale = size;
            var r = go.GetComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = ShadowCastingMode.Off;
        }
    }
}
