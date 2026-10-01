using Saga.Core;
using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 108 ① "지역 전용 소품 묶음" — `GoRegionProps.Clusters` 를 씬에 세운다(자리·모양은 표가 정본).
    /// PropsBuilder.cs 와 같은 결: 편집기 빌드가 모델을 `Init()` 으로 채우고 한 번 구워 씬에 저장한다.
    /// 조각마다 렌더러 밑면을 땅(강은 강바닥)에 맞추고, 충돌이 필요한 조각은 메시 크기 상자 충돌을 단다.
    /// 그을린 조각은 원본 재질을 복제해 바탕색만 어둡게 한다(재질마다 한 벌, 씬에 함께 저장).
    /// 109-1b 미래 조각(시간 틈 잔해)은 원본 텍스처를 쓴 URP Lit 청록 발광 재질(`_rift`)로 바꾸고 `RiftSpin` 으로 돌린다(정적 아님).
    /// </summary>
    public class RegionPropsBuilder : MonoBehaviour
    {
        [SerializeField] private string[] modelKeys = new string[0];
        [SerializeField] private GameObject[] models = new GameObject[0];
        /// <summary>먼 거리용 가벼운 메시(`tools/polyhaven_lod1.py`, 재질 없음 — LOD0 재질을 씌운다). 없으면 LOD 없이 원본만.</summary>
        [SerializeField] private GameObject[] lodModels = new GameObject[0];
        [SerializeField] private GameObject pillarModel;   // Kenney pillar-stone.glb, 지름 0.32·높이 1(원점 밑면)
        [SerializeField] private Material stoneMaterial;   // castle_wall_slates(LandmarksBuilder 폐허 기둥과 같은 돌)

        private readonly Dictionary<Material, Material> _charred = new Dictionary<Material, Material>();
        private readonly Dictionary<Material, Material> _rift = new Dictionary<Material, Material>();

        /// <summary>LOD0 → LOD1 넘어가는 화면 높이 비율 · LOD1 이 사라지는 비율(아주 먼 조각만).
        /// 0.25 = 6m 통나무가 약 20m 안일 때만 원본 — 사진측량 원본(통나무 10만 삼각형)을 곁에 설 때만 쓴다.</summary>
        public const float Lod0ScreenHeight = 0.25f;
        public const float CullScreenHeight = 0.004f;

        public void Init(string[] keys, GameObject[] modelAssets, GameObject[] lodAssets, GameObject pillar, Material stone)
        {
            modelKeys = keys;
            models = modelAssets;
            lodModels = lodAssets;
            pillarModel = pillar;
            stoneMaterial = stone;
        }

        private void Awake()
        {
            // PropsBuilder.cs 와 같은 방어 — 저장된 씬을 열면 이미 구운 자식이 있다.
            if (transform.childCount > 0) return;
            Build();
        }

        public void Build()
        {
            foreach (var c in GoRegionProps.Clusters) BuildCluster(c);
            MarkStatic();
        }

        private void BuildCluster(GoRegionProps.Cluster c)
        {
            var root = new GameObject("RegionProps_" + c.Id).transform;
            root.SetParent(transform, false);
            float baseY = GoRegionProps.BaseHeight(c);
            root.position = GoRegionProps.Center(c) + Vector3.up * baseY;

            for (int i = 0; i < c.Pieces.Length; i++)
            {
                var p = c.Pieces[i];
                var go = SpawnPiece(p, root, $"{i:D2}_{ShortName(p.Model)}");
                if (go == null) continue;
                go.transform.localPosition = new Vector3(p.X, 0f, p.Z);
                go.transform.localRotation = Quaternion.Euler(p.Pitch, p.Yaw, p.Roll);
                // 밑면 맞춤 — 모델마다 원점이 제각각이라(방패 몸통은 가운데) 실제 꼭짓점 최저점을 잰다.
                // 렌더러 경계 상자는 기울인 조각에서 헐거워(눕힌 방패가 0.1~0.2m 떴다) 쓰지 않는다.
                if (TryLowest(go, out float low))
                    go.transform.position += Vector3.up * (root.position.y + p.Y - p.Sink - low);
                if (p.Charred) Char(go);
                if (p.Era == GoEra.Future)
                {
                    Rift(go);
                    go.AddComponent<RiftSpin>().Init(go.transform.rotation, i * 47f);
                }
                if (p.Collide) AddBoxColliders(go.transform.Find("LOD0") != null ? go.transform.Find("LOD0").gameObject : go);
            }

            if (c.Light != GoRegionProps.Glow.None) AddGlow(root, c);
        }

        private GameObject SpawnPiece(GoRegionProps.Piece p, Transform parent, string name)
        {
            if (p.Model == GoRegionProps.Pillar)
            {
                if (pillarModel == null) return null;
                var pillar = Object.Instantiate(pillarModel, parent);
                pillar.name = name;
                pillar.transform.localScale = Vector3.one * p.Scale;
                if (stoneMaterial != null)
                    foreach (var r in pillar.GetComponentsInChildren<MeshRenderer>(true))
                        r.sharedMaterial = EnvironmentMaterial.MakeTiled(stoneMaterial, 0.32f * p.Scale, p.Scale);
                return pillar;
            }

            string id = p.Model, part = null;
            int hash = id.IndexOf('#');
            if (hash >= 0) { part = id.Substring(hash + 1); id = id.Substring(0, hash); }
            var src = Model(models, id);
            if (src == null) { Debug.LogWarning($"[RegionPropsBuilder] 모델 없음: {id}"); return null; }
            var lod0 = Part(src, part, id);
            if (lod0 == null) return null;

            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localScale = Vector3.one * (GoRegionProps.WorldScale * p.Scale);
            var near = Object.Instantiate(lod0, go.transform);
            near.name = "LOD0";
            ResetLocal(near.transform);

            var lodSrc = Model(lodModels, id);
            var lod1 = lodSrc != null ? Part(lodSrc, part, id) : null;
            if (lod1 == null) return go;
            var far = Object.Instantiate(lod1, go.transform);
            far.name = "LOD1";
            ResetLocal(far.transform);
            // 가벼운 메시엔 재질이 없다 — 같은 이름 LOD0 렌더러의 재질을 그대로(서브메시 수가 다르면 첫 재질로 채운다).
            var nearRenderers = near.GetComponentsInChildren<MeshRenderer>(true);
            foreach (var r in far.GetComponentsInChildren<MeshRenderer>(true))
            {
                var match = nearRenderers.Length > 0 ? nearRenderers[0] : null;
                foreach (var n in nearRenderers) if (n.name == r.name || (r.transform == far.transform && n.transform == near.transform)) { match = n; break; }
                if (match == null) continue;
                var src0 = match.sharedMaterials;
                var mats = new Material[Mathf.Max(1, r.sharedMaterials.Length)];
                for (int i = 0; i < mats.Length; i++) mats[i] = src0[Mathf.Min(i, src0.Length - 1)];
                r.sharedMaterials = mats;
            }
            var group = go.AddComponent<LODGroup>();
            group.SetLODs(new[]
            {
                new LOD(Lod0ScreenHeight, near.GetComponentsInChildren<Renderer>(true)),
                new LOD(CullScreenHeight, far.GetComponentsInChildren<Renderer>(true)),
            });
            group.RecalculateBounds();
            return go;
        }

        private static GameObject Part(GameObject src, string part, string id)
        {
            if (part == null) return src;
            var child = FindPart(src.transform, part);
            if (child == null) { Debug.LogWarning($"[RegionPropsBuilder] {id} 에 {part} 없음"); return null; }
            return child.gameObject;
        }

        private static void ResetLocal(Transform t)
        {
            t.localPosition = Vector3.zero;
            t.localRotation = Quaternion.identity;
            t.localScale = Vector3.one;
        }

        private GameObject Model(GameObject[] pool, string id)
        {
            for (int i = 0; i < modelKeys.Length && i < pool.Length; i++)
                if (modelKeys[i] == id) return pool[i];
            return null;
        }

        private static Transform FindPart(Transform root, string suffix)
        {
            foreach (var t in root.GetComponentsInChildren<Transform>(true))
                if (t != root && t.name.EndsWith(suffix)) return t;
            return null;
        }

        private static string ShortName(string model)
        {
            int hash = model.IndexOf('#');
            return hash >= 0 ? model.Substring(hash + 1) : model;
        }

        /// <summary>월드 꼭짓점 최저 높이(편집기 빌드에선 메시를 읽을 수 있다). 못 읽는 메시는 렌더러 경계로 대신한다.</summary>
        internal static bool TryLowest(GameObject go, out float low)
        {
            low = float.PositiveInfinity;
            foreach (var f in go.GetComponentsInChildren<MeshFilter>(true))
            {
                var mesh = f.sharedMesh;
                if (mesh == null) continue;
                if (mesh.isReadable || !Application.isPlaying)
                {
                    var m = f.transform.localToWorldMatrix;
                    foreach (var v in mesh.vertices) low = Mathf.Min(low, m.MultiplyPoint3x4(v).y);
                }
                else
                {
                    var r = f.GetComponent<Renderer>();
                    if (r != null) low = Mathf.Min(low, r.bounds.min.y);
                }
            }
            return !float.IsPositiveInfinity(low);
        }

        private void Char(GameObject go)
        {
            foreach (var r in go.GetComponentsInChildren<MeshRenderer>(true))
            {
                var mats = r.sharedMaterials;
                for (int i = 0; i < mats.Length; i++)
                {
                    var m = mats[i];
                    if (m == null) continue;
                    if (!_charred.TryGetValue(m, out var dark))
                    {
                        dark = new Material(m) { name = m.name + "_charred" };
                        // glTFast 셰이더는 baseColorFactor, URP Lit 은 _BaseColor.
                        foreach (var prop in new[] { "baseColorFactor", "_BaseColor" })
                            if (dark.HasProperty(prop)) dark.SetColor(prop, dark.GetColor(prop) * GoRegionProps.CharredTint);
                        _charred[m] = dark;
                    }
                    mats[i] = dark;
                }
                r.sharedMaterials = mats;
            }
        }

        private void Rift(GameObject go)
        {
            var lit = Shader.Find("Universal Render Pipeline/Lit");
            foreach (var r in go.GetComponentsInChildren<MeshRenderer>(true))
            {
                var mats = r.sharedMaterials;
                for (int i = 0; i < mats.Length; i++)
                {
                    var m = mats[i];
                    if (m == null || lit == null) continue;
                    if (!_rift.TryGetValue(m, out var glow))
                    {
                        glow = new Material(lit) { name = m.name + "_rift" };
                        // glTFast 재질 텍스처(baseColorTexture·normalTexture)를 URP Lit 칸으로 옮긴다.
                        Texture baseTex = m.HasProperty("baseColorTexture") ? m.GetTexture("baseColorTexture") : m.HasProperty("_BaseMap") ? m.GetTexture("_BaseMap") : null;
                        Texture normal = m.HasProperty("normalTexture") ? m.GetTexture("normalTexture") : m.HasProperty("_BumpMap") ? m.GetTexture("_BumpMap") : null;
                        if (baseTex != null) { glow.SetTexture("_BaseMap", baseTex); glow.SetTexture("_EmissionMap", baseTex); }
                        if (normal != null) { glow.SetTexture("_BumpMap", normal); glow.EnableKeyword("_NORMALMAP"); }
                        glow.SetColor("_BaseColor", GoRegionProps.RiftTint);
                        glow.SetFloat("_Metallic", 0.8f);
                        glow.SetFloat("_Smoothness", 0.6f);
                        glow.EnableKeyword("_EMISSION");
                        glow.SetColor("_EmissionColor", GoRegionProps.RiftGlow);
                        glow.globalIlluminationFlags = MaterialGlobalIlluminationFlags.None;
                        _rift[m] = glow;
                    }
                    mats[i] = glow;
                }
                r.sharedMaterials = mats;
            }
        }

        private static void AddBoxColliders(GameObject go)
        {
            foreach (var f in go.GetComponentsInChildren<MeshFilter>(true))
            {
                if (f.sharedMesh == null) continue;
                var box = f.gameObject.AddComponent<BoxCollider>();
                box.center = f.sharedMesh.bounds.center;
                box.size = f.sharedMesh.bounds.size;
            }
        }

        private static void AddGlow(Transform root, GoRegionProps.Cluster c)
        {
            var lightGo = new GameObject("Glow");
            lightGo.transform.SetParent(root, false);
            lightGo.transform.localPosition = c.LightLocal;
            var light = lightGo.AddComponent<Light>();
            light.type = LightType.Point;
            light.shadows = LightShadows.None;
            if (c.Light == GoRegionProps.Glow.Fire)
            {
                light.color = new Color(1f, 0.58f, 0.28f);
                light.intensity = 2.4f;
                light.range = 12f;
            }
            else
            {
                light.color = new Color(0.55f, 0.72f, 1f);
                light.intensity = 0.25f;
                light.range = 10f;
            }
            lightGo.AddComponent<PropFlicker>().Init(c.Light == GoRegionProps.Glow.Fire ? PropFlicker.Mode.Fire : PropFlicker.Mode.Spark, light.intensity);
        }

        /// <summary>PropsBuilder.MarkStatic() 과 같은 규칙 — 서브메시 여럿인 렌더러는 정적 배칭에서 뺀다. 불빛은 움직이니 뺀다.</summary>
        private void MarkStatic()
        {
            foreach (Transform t in GetComponentsInChildren<Transform>(true))
            {
                if (t.GetComponent<Light>() != null) continue;
                if (t.GetComponentInParent<RiftSpin>() != null) continue; // 109-1b 떠서 도는 조각
                var filter = t.GetComponent<MeshFilter>();
                if (filter != null && filter.sharedMesh != null && filter.sharedMesh.subMeshCount > 1) continue;
                t.gameObject.isStatic = true;
            }
        }
    }
}
