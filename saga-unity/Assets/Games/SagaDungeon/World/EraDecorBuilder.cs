using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 109-2b — `DungeonEraDecor` 표를 씬에 세운다(자리·모양은 표가 정본). 편집기 빌드가 모델을 `Init()` 으로 넣고 한 번 구워
    /// 씬에 저장한다(GO `RegionPropsBuilder` 와 같은 결, 코드는 이 판 것). 조각마다 실제 꼭짓점 최저점을 바닥에 맞추고,
    /// 충돌이 필요한 조각은 메시 크기 상자 충돌을 단다. 그을린 조각은 원본 재질 복제의 바탕색만 어둡게,
    /// 미래 조각(시간 틈 잔해)은 원본 텍스처를 쓴 URP Lit 청록 발광 재질로 바꾸고 `EraRiftSpin` 으로 돌린다.
    /// 명소 층 꾸밈은 ProcRoom 아래에 여섯 벌을 꺼 둔 채 굽고, `DungeonFloorRunner` 가 층이 바뀔 때 <see cref="ShowLandmark"/> 를 부른다.
    /// </summary>
    public class EraDecorBuilder : MonoBehaviour
    {
        [SerializeField] private string[] modelKeys = new string[0];
        [SerializeField] private GameObject[] models = new GameObject[0];
        /// <summary>명소 층 여섯 벌(`DungeonEraDecor.Landmarks` 순). 마을 꾸밈 빌더는 비어 있다.</summary>
        [SerializeField] private GameObject[] landmarkRoots = new GameObject[0];

        private readonly Dictionary<Material, Material> _charred = new Dictionary<Material, Material>();
        private readonly Dictionary<Material, Material> _rift = new Dictionary<Material, Material>();

        // tasks U-0028 — 씬이 옛 여섯 벌만 굽고 있으면(씬 재빌드 전) 모자란 명소 꾸밈(31층 …)을 Play 때 채운다. 다시 구운 씬은 이미 다 있어 아무 일도 안 한다.
        private void Awake()
        {
            RefreshRift();
            if (landmarkRoots.Length == 0 || landmarkRoots.Length >= DungeonEraDecor.Landmarks.Length) return;
            var roots = new List<GameObject>(landmarkRoots);
            for (int i = roots.Count; i < DungeonEraDecor.Landmarks.Length; i++)
            {
                var root = BuildSet(DungeonEraDecor.Landmarks[i], transform, transform.position);
                root.SetActive(false);
                roots.Add(root);
            }
            landmarkRoots = roots.ToArray();
        }

        // U-0066 — 씬에 구운 옛 잔해 재질(발광 Lit → 툰 패스가 하늘색 단색 Unlit 로 바꿈)을 Play 때 툰 + 하늘색 림으로 갈아 끼운다(씬 재빌드 없이).
        private void RefreshRift()
        {
            foreach (var s in GetComponentsInChildren<EraRiftSpin>(true)) Rift(s.gameObject);
        }

        public int LandmarkRootCount => landmarkRoots.Length;
        public GameObject LandmarkRoot(int i) => i >= 0 && i < landmarkRoots.Length ? landmarkRoots[i] : null;

        public void Init(string[] keys, GameObject[] modelAssets)
        {
            modelKeys = keys;
            models = modelAssets;
        }

        /// <summary>명소 층 여섯 벌을 이 오브젝트 자리(방 가운데)에 굽고 전부 끈다.</summary>
        public void BuildLandmarks()
        {
            var roots = new List<GameObject>();
            foreach (var set in DungeonEraDecor.Landmarks)
            {
                var root = BuildSet(set, transform, transform.position);
                root.SetActive(false);
                roots.Add(root);
            }
            landmarkRoots = roots.ToArray();
        }

        /// <summary>마을 꾸밈 — `DungeonEraDecor.Towns` 순서의 방 가운데를 받아 굽는다. 떠서 도는 조각·불빛 말고는 정적.</summary>
        public void BuildTowns(Vector3[] centers)
        {
            var sets = DungeonEraDecor.Towns;
            for (int i = 0; i < sets.Length && i < centers.Length; i++) BuildSet(sets[i], transform, centers[i]);
            MarkStatic();
        }

        /// <summary>그 명소 층 꾸밈만 켠다(-1 이면 전부 끈다).</summary>
        public void ShowLandmark(int index)
        {
            for (int i = 0; i < landmarkRoots.Length; i++)
                if (landmarkRoots[i] != null && landmarkRoots[i].activeSelf != (i == index)) landmarkRoots[i].SetActive(i == index);
        }

        private GameObject BuildSet(DungeonEraDecor.Set set, Transform parent, Vector3 center)
        {
            var root = new GameObject("EraDecor_" + set.Id).transform;
            root.SetParent(parent, true);
            root.position = center;
            root.rotation = Quaternion.identity;

            for (int i = 0; i < set.Pieces.Length; i++)
            {
                var p = set.Pieces[i];
                var go = SpawnPiece(p, root, $"{i:D2}_{p.Era}_{ShortName(p.Model)}");
                if (go == null) continue;
                go.transform.localPosition = new Vector3(p.X, 0f, p.Z);
                go.transform.localRotation = Quaternion.Euler(p.Pitch, p.Yaw, p.Roll);
                // 밑면 맞춤 — 모델마다 원점이 제각각이라 실제 꼭짓점 최저점을 잰다(렌더러 경계는 기울인 조각에서 헐겁다).
                if (TryLowest(go, out float low))
                    go.transform.position += Vector3.up * (center.y + p.Y - p.Sink - low);
                if (p.Charred) Char(go);
                if (p.Era == DungeonEra.Future)
                {
                    Rift(go);
                    go.AddComponent<EraRiftSpin>().Init(go.transform.localRotation, i * 47f);
                }
                if (p.Collide) AddBoxColliders(go);
            }

            if (set.FireLocal != Vector3.zero)
            {
                var lightGo = new GameObject("Fire");
                lightGo.transform.SetParent(root, false);
                lightGo.transform.localPosition = set.FireLocal;
                var light = lightGo.AddComponent<Light>();
                light.type = LightType.Point;
                light.shadows = LightShadows.None;
                light.color = new Color(1f, 0.58f, 0.28f);
                light.intensity = 1.8f;
                light.range = 7f;
            }
            return root.gameObject;
        }

        private GameObject SpawnPiece(DungeonEraDecor.Piece p, Transform parent, string name)
        {
            string id = p.Model, part = null;
            int hash = id.IndexOf('#');
            if (hash >= 0) { part = id.Substring(hash + 1); id = id.Substring(0, hash); }
            GameObject src = null;
            for (int i = 0; i < modelKeys.Length && i < models.Length; i++)
                if (modelKeys[i] == id) { src = models[i]; break; }
            if (src == null) { Debug.LogWarning($"[EraDecorBuilder] 모델 없음: {id}"); return null; }
            if (part != null)
            {
                Transform child = null;
                foreach (var t in src.GetComponentsInChildren<Transform>(true))
                    if (t != src.transform && t.name.EndsWith(part)) { child = t; break; }
                if (child == null) { Debug.LogWarning($"[EraDecorBuilder] {id} 에 {part} 없음"); return null; }
                src = child.gameObject;
            }

            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localScale = Vector3.one * p.Scale;
            var body = Object.Instantiate(src, go.transform);
            body.name = "Body";
            body.transform.localPosition = Vector3.zero;
            body.transform.localRotation = Quaternion.identity;
            body.transform.localScale = Vector3.one;
            return go;
        }

        private static string ShortName(string model)
        {
            int hash = model.IndexOf('#');
            return hash >= 0 ? model.Substring(hash + 1) : model;
        }

        /// <summary>월드 꼭짓점 최저 높이(편집기 빌드에선 메시를 읽을 수 있다). 못 읽는 메시는 렌더러 경계로 대신한다.</summary>
        public static bool TryLowest(GameObject go, out float low)
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
                            if (dark.HasProperty(prop)) dark.SetColor(prop, dark.GetColor(prop) * DungeonEraDecor.CharredTint);
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
                    if (m.name.EndsWith("_rift") && m.shader != null && m.shader.name == "Saga/CelToon") continue; // 이미 새 잔해 재질
                    if (!_rift.TryGetValue(m, out var glow))
                    {
                        // U-0066 — 발광 Lit 을 만들면 ToonScenePass 가 Unlit 발광색 단색으로 바꿔 무늬가 사라졌다(하늘색 실루엣).
                        // 처음부터 툰 재질(그림 × 시간 틈 빛깔) + 하늘색 림으로 — 툰은 패스가 건너뛰어 그림이 남는다.
                        Texture baseTex = null;
                        foreach (var prop in new[] { "baseColorTexture", "_BaseMap", "_MainTex" })
                            if (baseTex == null && m.HasProperty(prop)) baseTex = m.GetTexture(prop);
                        glow = Saga.Core.Region.RegionMaterials.Toon(baseTex, DungeonEraDecor.RiftTint.linear);
                        if (glow == null) continue;
                        glow.name = m.name.EndsWith("_rift") ? m.name : m.name + "_rift";
                        glow.SetColor("_RimColor", DungeonEraDecor.RiftGlow * 1.4f);
                        glow.SetFloat("_RimPower", 2.5f);
                        glow.SetFloat("_RimStrength", 1.2f);
                        if (baseTex == null) Debug.Log($"[Rift] {m.name} 바탕 그림 없음 — 빛깔만");
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

        /// <summary>서브메시 여럿인 렌더러·불빛·떠서 도는 조각은 정적 배칭에서 뺀다(GO `RegionPropsBuilder.MarkStatic` 과 같은 규칙).</summary>
        private void MarkStatic()
        {
            foreach (Transform t in GetComponentsInChildren<Transform>(true))
            {
                if (t.GetComponent<Light>() != null) continue;
                if (t.GetComponentInParent<EraRiftSpin>() != null) continue;
                var filter = t.GetComponent<MeshFilter>();
                if (filter != null && filter.sharedMesh != null && filter.sharedMesh.subMeshCount > 1) continue;
                t.gameObject.isStatic = true;
            }
        }
    }
}
