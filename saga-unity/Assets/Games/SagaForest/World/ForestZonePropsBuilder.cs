using System.Collections.Generic;
using UnityEngine;
using Saga.Forest.Data;

namespace Saga.Forest.World
{
    /// <summary>
    /// PLAN.md 108 끝줄 "FOREST 존 전용 소품" — `ForestZoneProps.Clusters` 를 씬에 세우고, 매 프레임 땅 휨만큼 조각을 내린다.
    /// 조각 하나 = 뿌리(땅 자리, 상자 충돌 — 안 움직인다) → "Visual"(휨만큼 내림, `ForestLandmark.Follow` 와 같은 식)
    /// → "Body"(밑면을 땅에 맞춘 높이) → LOD0 원본 · LOD1 가벼운 메시(LODGroup 은 Visual 에).
    /// 조각이 매 프레임 움직이므로 정적 표시를 하지 않는다(정적 배칭이 휨을 막는다).
    /// 편집기 빌드가 모델을 `Init()` 으로 채우고 한 번 구워 씬에 저장한다(GO `RegionPropsBuilder` 와 같은 결, 코드는 이 판 것).
    /// PLAN.md 109-4 — 미래 조각(시간 틈 잔해)은 원본 텍스처를 쓴 URP Lit 청록 발광 재질로 바꾸고 "Body" 를 `ForestRiftSpin` 으로 돌린다.
    /// </summary>
    public class ForestZonePropsBuilder : MonoBehaviour
    {
        [SerializeField] private string[] modelKeys = new string[0];
        [SerializeField] private GameObject[] models = new GameObject[0];
        [SerializeField] private GameObject[] lodModels = new GameObject[0];
        [SerializeField] private List<Transform> visuals = new List<Transform>();

        /// <summary>LOD0 → LOD1 화면 높이 비율 · LOD1 이 사라지는 비율. FOREST 는 카메라가 가까워 GO(0.25)보다 조금 높게.</summary>
        public const float Lod0ScreenHeight = 0.3f;
        public const float CullScreenHeight = 0.004f;

        private Transform _player;
        private readonly Dictionary<Material, Material> _rift = new Dictionary<Material, Material>();

        public IReadOnlyList<Transform> Visuals => visuals;

        public void Init(string[] keys, GameObject[] modelAssets, GameObject[] lodAssets)
        {
            modelKeys = keys;
            models = modelAssets;
            lodModels = lodAssets;
        }

        private void Awake()
        {
            if (transform.childCount == 0) Build();
            else RefreshRift();
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void LateUpdate()
        {
            if (_player != null) Follow(_player.position);
        }

        /// <summary>조각마다 땅 휨만큼 "Visual" 을 내린다. 진단도 부른다.</summary>
        public void Follow(Vector3 curveCenter)
        {
            foreach (var v in visuals)
            {
                if (v == null) continue;
                Vector3 p = v.parent.position;
                float dx = p.x - curveCenter.x, dz = p.z - curveCenter.z;
                v.localPosition = new Vector3(0f, -(dx * dx + dz * dz) * ForestLandmark.CurveAmount, 0f);
            }
        }

        public void Build()
        {
            visuals.Clear();
            foreach (var c in ForestZoneProps.Clusters)
            {
                var root = new GameObject("ZoneProps_" + c.Id).transform;
                root.SetParent(transform, false);
                root.position = ForestZoneProps.Center(c);
                for (int i = 0; i < c.Pieces.Length; i++)
                {
                    var p = c.Pieces[i];
                    var piece = SpawnPiece(p, root, $"{i:D2}_{ShortName(p.Model)}");
                    if (piece == null) continue;
                    piece.position = ForestZoneProps.PiecePos(c, p);
                    var body = piece.Find("Visual/Body");
                    body.localRotation = Quaternion.Euler(p.Pitch, p.Yaw, 0f);
                    if (TryLowest(body.gameObject, out float low))
                        body.position += Vector3.up * (piece.position.y + p.Y - low);
                    if (p.Era == ForestEra.Future)
                    {
                        Rift(body.gameObject);
                        body.gameObject.AddComponent<ForestRiftSpin>().Init(body.localRotation, i * 47f + c.Id.Length * 31f);
                    }
                    if (p.Collide) AddBoxCollider(piece, body.Find("LOD0"));
                    visuals.Add(piece.Find("Visual"));
                }
            }
        }

        private Transform SpawnPiece(ForestZoneProps.Piece p, Transform parent, string name)
        {
            string id = p.Model, part = null;
            int hash = id.IndexOf('#');
            if (hash >= 0) { part = id.Substring(hash + 1); id = id.Substring(0, hash); }
            var src = Model(models, id);
            if (src == null) { Debug.LogWarning($"[ForestZonePropsBuilder] 모델 없음: {id}"); return null; }
            var lod0 = Part(src, part, id);
            if (lod0 == null) return null;

            var piece = new GameObject(name).transform;
            piece.SetParent(parent, false);
            var visual = new GameObject("Visual").transform;
            visual.SetParent(piece, false);
            var body = new GameObject("Body").transform;
            body.SetParent(visual, false);
            body.localScale = Vector3.one * (ForestZoneProps.WorldScale * p.Scale);
            var near = Object.Instantiate(lod0, body);
            near.name = "LOD0";
            ResetLocal(near.transform);
            foreach (var col in near.GetComponentsInChildren<Collider>(true)) Object.DestroyImmediate(col);

            var lodSrc = Model(lodModels, id);
            var lod1 = lodSrc != null ? Part(lodSrc, part, id) : null;
            if (lod1 == null) return piece;
            var far = Object.Instantiate(lod1, body);
            far.name = "LOD1";
            ResetLocal(far.transform);
            foreach (var col in far.GetComponentsInChildren<Collider>(true)) Object.DestroyImmediate(col);
            // 가벼운 메시엔 재질이 없다 — 같은 이름 LOD0 렌더러의 재질을 그대로.
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
            var group = visual.gameObject.AddComponent<LODGroup>();
            group.SetLODs(new[]
            {
                new LOD(Lod0ScreenHeight, near.GetComponentsInChildren<Renderer>(true)),
                new LOD(CullScreenHeight, far.GetComponentsInChildren<Renderer>(true)),
            });
            group.RecalculateBounds();
            return piece;
        }

        /// <summary>DUNGEON `EraDecorBuilder.Rift` 와 같은 식 — glTFast 재질 텍스처를 URP Lit 칸으로 옮기고 청록 발광.</summary>
        // U-0066 — 씬에 구운 옛 잔해 재질(발광 Lit → 툰 패스가 하늘색 단색 Unlit 로 바꿈)을 Play 때 툰 + 하늘색 림으로 갈아 끼운다(씬 재빌드 없이).
        private void RefreshRift()
        {
            foreach (var s in GetComponentsInChildren<ForestRiftSpin>(true)) Rift(s.gameObject);
        }

        private void Rift(GameObject go)
        {
            var lit = Shader.Find("Universal Render Pipeline/Lit");
            if (lit == null) return;
            foreach (var r in go.GetComponentsInChildren<MeshRenderer>(true))
            {
                var mats = r.sharedMaterials;
                for (int i = 0; i < mats.Length; i++)
                {
                    var m = mats[i];
                    if (m == null) continue;
                    if (m.name.EndsWith("_rift") && m.shader != null && m.shader.name == "Saga/CelToon") continue; // 이미 새 잔해 재질
                    if (!_rift.TryGetValue(m, out var glow))
                    {
                        // U-0066 — 발광 Lit 을 만들면 ToonScenePass 가 Unlit 발광색 단색으로 바꿔 무늬가 사라졌다(하늘색 실루엣).
                        // 처음부터 툰 재질(그림 × 시간 틈 빛깔) + 하늘색 림으로 — 툰은 패스가 건너뛰어 그림이 남는다.
                        Texture baseTex = null;
                        foreach (var prop in new[] { "baseColorTexture", "_BaseMap", "_MainTex" })
                            if (baseTex == null && m.HasProperty(prop)) baseTex = m.GetTexture(prop);
                        glow = Saga.Core.Region.RegionMaterials.Toon(baseTex, ForestEras.RiftTint.linear);
                        if (glow == null) continue;
                        glow.name = m.name.EndsWith("_rift") ? m.name : m.name + "_rift";
                        glow.SetColor("_RimColor", ForestEras.RiftGlow * 1.4f);
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

        private static GameObject Part(GameObject src, string part, string id)
        {
            if (part == null) return src;
            foreach (var t in src.GetComponentsInChildren<Transform>(true))
                if (t != src.transform && t.name.EndsWith(part)) return t.gameObject;
            Debug.LogWarning($"[ForestZonePropsBuilder] {id} 에 {part} 없음");
            return null;
        }

        private GameObject Model(GameObject[] pool, string id)
        {
            for (int i = 0; i < modelKeys.Length && i < pool.Length; i++)
                if (modelKeys[i] == id) return pool[i];
            return null;
        }

        private static void ResetLocal(Transform t)
        {
            t.localPosition = Vector3.zero;
            t.localRotation = Quaternion.identity;
            t.localScale = Vector3.one;
        }

        private static string ShortName(string model)
        {
            int hash = model.IndexOf('#');
            return hash >= 0 ? model.Substring(hash + 1) : model;
        }

        /// <summary>월드 꼭짓점 최저 높이(편집기 빌드에선 메시를 읽을 수 있다). 기울인 조각에서 렌더러 경계 상자는 헐겁다.</summary>
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

        /// <summary>충돌은 뿌리에(휨 따라 안 움직인다 — 가까이선 휨이 거의 0). 크기는 LOD0 렌더러를 감싼 상자.</summary>
        private static void AddBoxCollider(Transform piece, Transform lod0)
        {
            if (lod0 == null) return;
            var rs = lod0.GetComponentsInChildren<Renderer>(true);
            if (rs.Length == 0) return;
            var b = rs[0].bounds;
            for (int i = 1; i < rs.Length; i++) b.Encapsulate(rs[i].bounds);
            var box = piece.gameObject.AddComponent<BoxCollider>();
            box.center = piece.InverseTransformPoint(b.center);
            box.size = b.size;
        }
    }
}
