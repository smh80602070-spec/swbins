using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// VERTICAL_SLICE_FOREST.md(saga-godot) 4절 "결정 — 포함: 채집 동사
    /// 하나만 — 나무 흔들기 → 과일 하나 획득(`GATHER.tree` 그대로,
    /// `reset:1`(하루 1회)은 이번엔 무시 — 무제한으로 흔들 수 있다, 하루/
    /// 시간 시스템 자체가 이번 슬라이스 밖이라)". "무제한"이 "매 프레임
    /// 마다"는 아니라고 보고(가만히 서 있기만 해도 초당 수십 번씩 과일이
    /// 쌓이면 숫자가 무의미해진다) DUNGEON `DungeonAmbush.cs`가 이미 쓴
    /// 것과 같은 짧은 쿨다운(2초)만 얹었다 — 문서의 "무제한"은 그대로
    /// 지킨다(재시도 횟수 제한이 없다는 뜻일 뿐, 속도 제한과는 별개).
    ///
    /// GO `VegetationBuilder.cs`가 이미 검증한 나무 GLB를 그대로
    /// 재사용(2절 "나무 한 그루가 타일 하나에 딱 들어맞는다"). 2026-09-21
    /// PLAN.md 102-4 — Kenney tree_oak.glb 대신 GO의 procgen 나무 하나
    /// (`Assets/Art/Generated/SagaGo/tree_s1_01.glb`, 씨앗 고정 — 과일나무는
    /// "흔들 수 있는 나무"라는 인지가 걸려 있어 모양을 안 흔든다)를 쓴다.
    /// procgen 메시는 UV가 없어 `Saga/VertexColorTriplanarLit` 재질을
    /// 갈아 끼운다(정점색 바탕 + 트라이플레이너 바크 디테일).
    /// </summary>
    public class ForestFruitTree : MonoBehaviour
    {
        // procgen 나무는 이미 "실제 미터" 치수로 나와(GO VegetationBuilder.cs의
        // GeneratedTreeScale과 같은 이유) 예전 Kenney tree_oak.glb ×4.5보다
        // 훨씬 작은 배율이면 된다.
        private const float TreeScale = 1.0f;
        private const float GatherRadius = 2.5f;
        private const float GatherCooldownSec = 2f;
        private static string FruitName => ForestLocalization.T("fruit.name", "산딸기");
        private const float ToastSec = 3f;

        [SerializeField] private GameObject treeModel; // BuildTestVillageForestScene.cs가 procgen 나무 GLB를 채운다.
        [SerializeField] private Material treeMaterial; // BuildTestVillageForestScene.cs가 TriplanarDetail_Bark.mat을 채운다.
        [SerializeField] private AudioClip[] gatherClips; // BuildTestVillageForestScene.cs가 채운다 — 101-2 5.8① 라운드로빈.

        private float _cooldownLeft;
        private Transform _player;
        private Transform _visual;

        private void Awake()
        {
            if (transform.childCount == 0) BuildVisual();
            _visual = transform.Find("Visual");
            ReplaceWithUnifiedModel(); // U-0036 A — 통일 자연 소품 세트(씬에 구운 procgen 위에 런타임으로)
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void BuildVisual()
        {
            if (treeModel != null)
            {
                var inst = Object.Instantiate(treeModel, transform, false);
                inst.name = "Visual";
                inst.transform.localScale = Vector3.one * TreeScale;
                if (treeMaterial != null)
                {
                    foreach (var renderer in inst.GetComponentsInChildren<MeshRenderer>(true))
                    {
                        renderer.sharedMaterial = treeMaterial;
                    }
                }
                return;
            }

            // 폴백 — GLB를 못 찾은 PC에서도 씬이 안 깨지게(줄기+수관, DUNGEON
            // 바이옴 소품이 이미 쓴 결).
            var trunk = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            trunk.name = "Visual";
            trunk.transform.SetParent(transform, false);
            trunk.transform.localScale = new Vector3(0.3f, 1.2f, 0.3f);
            trunk.transform.localPosition = new Vector3(0f, 1.2f, 0f);
            var trunkMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "TreeTrunk (generated)" };
            trunkMat.color = new Color(0.4f, 0.28f, 0.16f);
            trunk.GetComponent<MeshRenderer>().sharedMaterial = trunkMat;
            Object.Destroy(trunk.GetComponent<Collider>());

            var canopy = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            canopy.name = "Canopy";
            canopy.transform.SetParent(transform, false);
            canopy.transform.localScale = Vector3.one * 2.2f;
            canopy.transform.localPosition = new Vector3(0f, 2.6f, 0f);
            var canopyMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "TreeCanopy (generated)" };
            canopyMat.color = new Color(0.25f, 0.5f, 0.2f);
            canopy.GetComponent<MeshRenderer>().sharedMaterial = canopyMat;
            Object.Destroy(canopy.GetComponent<Collider>());
        }

        /// <summary>U-0036 A — 통일 세트 나무(`World/tree_broadleaf_01`)가 있으면 구워진 Visual 을 그것으로 바꾼다.
        /// 키는 옛 Visual 의 렌더러 높이에 맞춘다(세계 축척 불변). 없으면 그대로.</summary>
        private void ReplaceWithUnifiedModel()
        {
            var prefab = ForestNatureModels.FruitTree();
            if (prefab == null || _visual == null) return;
            float oldHeight = 0f;
            var rs = _visual.GetComponentsInChildren<Renderer>(true);
            if (rs.Length > 0) { var b = rs[0].bounds; foreach (var r in rs) b.Encapsulate(r.bounds); oldHeight = b.size.y; }
            var inst = Object.Instantiate(prefab, transform, false);
            inst.name = "Visual";
            inst.transform.localPosition = _visual.localPosition;
            foreach (var c in inst.GetComponentsInChildren<Collider>(true)) Object.Destroy(c);
            var cache = new System.Collections.Generic.Dictionary<Material, Material>();
            var mats = new System.Collections.Generic.List<Material>();
            Bounds nb = default; bool any = false;
            foreach (var r in inst.GetComponentsInChildren<Renderer>(true))
            {
                r.GetSharedMaterials(mats);
                bool changed = false;
                for (int i = 0; i < mats.Count; i++)
                {
                    var made = Saga.Core.Region.RegionMaterials.FromGltf(mats[i], cache, out _);
                    if (made != null && made != mats[i]) { mats[i] = made; changed = true; }
                }
                if (changed) r.SetSharedMaterials(mats);
                if (!any) { nb = r.bounds; any = true; } else nb.Encapsulate(r.bounds);
            }
            if (!any || nb.size.y < 0.01f) { Object.Destroy(inst); return; }
            if (oldHeight > 0.5f) inst.transform.localScale = Vector3.one * (oldHeight / nb.size.y);
            Object.Destroy(_visual.gameObject);
            _visual = inst.transform;
        }

        private void Update()
        {
            if (_cooldownLeft > 0f) _cooldownLeft -= Time.deltaTime;
            if (_player == null || _cooldownLeft > 0f) return;
            if (Vector3.Distance(transform.position, _player.position) > GatherRadius) return;

            _cooldownLeft = GatherCooldownSec;
            // PLAN.md 101-2 5.6 "축제 하루"(2026-09-21) — 소원 버프가 있으면 과일 획득 ×1.5.
            ForestState.AddFruit(Mathf.RoundToInt(1 * ForestFestivalState.FruitMultiplier));
            DialogueLabel.Instance?.Show(
                string.Format(ForestLocalization.T("fruit.gather_toast", "나무를 흔들었다 — {0}을(를) 주웠다 (보유 {1}개)"),
                    FruitName, ForestState.FruitCount),
                ToastSec);

            ForestGatherFeel.Play(transform.position + Vector3.up * 2.6f, _visual, FruitName, gatherClips);
        }
    }
}
