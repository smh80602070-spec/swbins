using Saga.Core;
using UnityEngine;
using Saga.Go.Data;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 8장 "실제 3D 에셋" — Props(44~49장 우선순위, Environment/
    /// Building 다음 칸). 지금까지 마을·상인·논밭 자리가 primitive 지형·
    /// 인물뿐이라 허전해 보이던 것을 채운다(PLAN.md 9~10장 "아무것도
    /// 없다는 느낌을 최대한 피한다"). 새 자산이 아니라 이미 쓰고 있는
    /// Fantasy Town Kit(2.0, CC0, `LandmarksBuilder.cs`의 wall-block·
    /// roof-gable과 같은 킷)에서 그때 안 받았던 소품 세 종(가로등·좌판·
    /// 울타리)만 추가로 받아 왔다 — docs/ASSET_GUIDE.md 참고.
    ///
    /// LandmarksBuilder.cs와 같은 결: 자리마다 상수로 박아 두고(격자 좌표가
    /// 재사용 가능한 N개가 아니라 이번에도 "자리 하나짜리"), GLB가 없으면
    /// primitive로 대체한다.
    /// </summary>
    public class PropsBuilder : MonoBehaviour
    {
        private static readonly Color LanternColor = new Color(0.35f, 0.3f, 0.22f);
        private static readonly Color StallColor = new Color(0.55f, 0.16f, 0.14f);
        private static readonly Color FenceColor = new Color(0.42f, 0.3f, 0.18f);

        // 편집기 빌드 스크립트가 Init()으로 채워 준다(NpcBuilder.cs와 같은 이유).
        [SerializeField] private GameObject lanternModel;   // lantern.glb, 실측 0.216×1.556×0.224
        [SerializeField] private GameObject stallModel;     // stall-red.glb, 실측 1×1.237×1
        [SerializeField] private GameObject fenceModel;     // fence.glb, 실측 0.075×0.38×1(비중앙 피벗)
        [SerializeField] private GameObject fenceGateModel; // fence-gate.glb, 실측 0.519×0.55×1

        // 102-4(2026-09-21) "단계 교체" — 울타리는 LandmarksBuilder.cs의 다리
        // 널판(fence.glb와 같은 나무 널판 성질)과 같은 이유로 woodMaterial을
        // 그대로 씌운다.
        [SerializeField] private Material woodMaterial;

        // 102-4(2026-09-23, `BuildPropsMaterialSplit.cs`) — lantern·stall은 실제로 뜯어보니
        // "재질이 섞여 위험"하지 않았다: lantern은 158개 삼각형 전부 금속 톤(나무 성분 0)이라
        // 원본 텍스처는 그대로 두고 금속 속성만 올린 재질을, stall은 나무 다리(약 130개)·빨강
        // 차양(약 140개)으로 뚜렷이 갈려 서브메시 둘로 쪼갠 메시+재질 쌍을 쓴다(둘 다 없으면
        // 예전처럼 원본 GLB 그대로 — 폴백 안전).
        [SerializeField] private Material lanternMetalMaterial;
        [SerializeField] private Mesh stallSplitMesh;
        [SerializeField] private Material stallWoodMaterial;
        [SerializeField] private Material stallCanopyMaterial;

        public void Init(GameObject lantern, GameObject stall, GameObject fence, GameObject fenceGate)
        {
            lanternModel = lantern;
            stallModel = stall;
            fenceModel = fence;
            fenceGateModel = fenceGate;
        }

        /// <summary>102-4(2026-09-23) — 위 넷을 한 번에 채운다(BuildTestVillageScene.cs 전용,
        /// 없어도(null) 무해 — 예전처럼 원본 GLB 재질 그대로 쓴다).</summary>
        public void InitMaterialSplit(Material lanternMetal, Mesh stallSplit, Material stallWood, Material stallCanopy)
        {
            lanternMetalMaterial = lanternMetal;
            stallSplitMesh = stallSplit;
            stallWoodMaterial = stallWood;
            stallCanopyMaterial = stallCanopy;
        }

        private void Awake()
        {
            // 이미 저장된 씬을 실제 Play로 열면 Awake가 다시 불려 Build()를
            // 또 돌리는데, 편집기 빌드 스크립트가 이미 자식들을 만들어 둔
            // 뒤라 그대로 두면 소품이 두 벌씩 겹쳐 생긴다 — NpcBuilder.cs와
            // 같은 방어.
            if (transform.childCount > 0) return;
            Build();
        }

        public void Build()
        {
            BuildLanterns();
            BuildMarketStall();
            BuildFarmFence();
            MarkStatic();
        }

        /// <summary>PLAN.md 76장 Mobile Performance Pass — 소품은 절대 안
        /// 움직이니 정적 배칭·오클루전 컬링 대상으로 표시한다.
        ///
        /// **예외(2026-09-23)** — 서브메시가 둘 이상인 오브젝트(재질을 분리한 stall)는
        /// 뺀다. Unity 정적 배칭은 같은 재질을 쓰는 여러 정적 렌더러를 하나의 결합
        /// 메시로 합치는데, 서브메시가 여럿인(=재질도 여럿인) 렌더러가 섞이면 결합
        /// 뒤 `MeshFilter.sharedMesh`가 원래와 다른 공유 메시로 바뀌어 서브메시 수가
        /// 실행마다 달라진다(실측: 5·49 등, 헤드리스 검증 중 발견) — 서브메시별
        /// 재질 매핑을 코드가 더는 신뢰 못 하게 되므로, 작은 오브젝트 하나의 배칭
        /// 이득을 포기하는 편이 싸다.</summary>
        private void MarkStatic()
        {
            foreach (Transform t in GetComponentsInChildren<Transform>(true))
            {
                var filter = t.GetComponent<MeshFilter>();
                if (filter != null && filter.sharedMesh != null && filter.sharedMesh.subMeshCount > 1) continue;
                t.gameObject.isStatic = true;
            }
        }

        // ---- 가로등 --------------------------------------------------------

        /// <summary>
        /// 마을집 두 채(격자 2,3·3,3) 사이 공터를 밝히는 가로등 두 개 —
        /// 서로 마주 보게 안쪽으로 놓는다(원점이 실측 그대로라 스케일은
        /// ×1, 이미 사람 눈높이보다 큰 실제 크기).
        /// </summary>
        private void BuildLanterns()
        {
            float ground = TestMapData.Legend['H'].Height;
            SpawnLantern("Lantern_House2", TestMapData.WorldPos(2, 3) + new Vector3(7f, ground, 0f));
            SpawnLantern("Lantern_House3", TestMapData.WorldPos(3, 3) + new Vector3(-7f, ground, 0f));
        }

        private void SpawnLantern(string name, Vector3 pos)
        {
            if (lanternModel != null)
            {
                var lantern = Object.Instantiate(lanternModel, transform);
                lantern.name = name;
                lantern.transform.position = pos;

                if (lanternMetalMaterial != null)
                {
                    ApplyPbrToRenderers(lantern, lanternMetalMaterial);
                }

                var col = lantern.AddComponent<BoxCollider>();
                col.center = new Vector3(0f, 0.778f, 0f);
                col.size = new Vector3(0.216f, 1.556f, 0.224f);
            }
            else
            {
                const float radius = 0.3f;
                const float height = 1.6f;
                var lantern = CreateCylinder(name, pos + Vector3.up * (height * 0.5f), radius, height, LanternColor);
                lantern.transform.SetParent(transform, true);
            }
        }

        // ---- 시장 좌판 --------------------------------------------------------

        /// <summary>
        /// 떠돌이 상인(NpcBuilder.cs, 격자 4,3)이 실제로 뭔가를 파는
        /// 자리처럼 보이게 옆에 좌판을 둔다 — NPC 본체와 안 겹치게 몇 미터
        /// 떨어뜨린다. 실측 1×1.237×1을 ×2로 키워 카운터 높이가 나게 한다.
        /// </summary>
        private const float StallScale = 2f;

        private void BuildMarketStall()
        {
            float ground = TestMapData.Legend['H'].Height;
            Vector3 pos = TestMapData.WorldPos(4, 3) + new Vector3(4f, ground, 3f);

            if (stallModel != null)
            {
                var stall = Object.Instantiate(stallModel, transform);
                stall.name = "MarketStall";
                stall.transform.position = pos;
                stall.transform.localScale = Vector3.one * StallScale;

                // 102-4(2026-09-23) — 나무 다리/틀 서브메시엔 실제 PBR 목재, 빨강 차양
                // 서브메시는 원본 색 그대로(BuildPropsMaterialSplit.cs 참고).
                if (stallSplitMesh != null && stallWoodMaterial != null && stallCanopyMaterial != null)
                {
                    var filter = stall.GetComponent<MeshFilter>();
                    var stallRenderer = stall.GetComponent<MeshRenderer>();
                    if (filter != null && stallRenderer != null)
                    {
                        filter.sharedMesh = stallSplitMesh;
                        stallRenderer.sharedMaterials = new[] { stallWoodMaterial, stallCanopyMaterial };
                    }
                }

                var col = stall.AddComponent<BoxCollider>();
                col.center = new Vector3(0f, 0.6185f, 0f);
                col.size = new Vector3(1f, 1.237f, 1f);
            }
            else
            {
                var size = new Vector3(1f, 1.237f, 1f) * StallScale;
                var stall = CreateBox("MarketStall", pos + Vector3.up * (size.y * 0.5f), size, StallColor);
                stall.transform.SetParent(transform, true);
            }
        }

        // ---- 논밭 울타리 --------------------------------------------------------

        /// <summary>
        /// 소(AnimalBuilder.cs cow_1, 격자 3,9)가 있는 논밭 한 켠에 낮은
        /// 울타리 세 칸 + 문 한 칸을 한 줄로 세워 "목장 한구석" 느낌만
        /// 준다 — 소를 실제로 가두지는 않는다(WanderingAnimal의 24유닛
        /// 배회 반경을 다 두르려면 수십 칸이 필요해 장식 목적과 안 맞다,
        /// 3장 "테스트 안 된 추측성 변경" 회피). fence.glb는 원점이 로컬
        /// X 중앙이 아니라 한쪽 모서리에 있는 모듈형 조각이라(실측 참고),
        /// z만 2m(스케일 ×2 적용 후 실제 길이)씩 이어 붙이면 x는 그대로
        /// 두어도 한 줄로 곧게 선다.
        /// </summary>
        private const float FenceScale = 2f;

        private void BuildFarmFence()
        {
            float ground = TestMapData.Legend['F'].Height;
            Vector3 basePos = TestMapData.WorldPos(3, 9) + new Vector3(3f, ground, 0f);

            SpawnFencePanel(fenceModel, "Fence_0", basePos + new Vector3(0f, 0f, -3f));
            SpawnFencePanel(fenceModel, "Fence_1", basePos + new Vector3(0f, 0f, -1f));
            SpawnFencePanel(fenceGateModel, "FenceGate", basePos + new Vector3(0f, 0f, 1f));
            SpawnFencePanel(fenceModel, "Fence_2", basePos + new Vector3(0f, 0f, 3f));
        }

        private void SpawnFencePanel(GameObject model, string name, Vector3 pos)
        {
            if (model != null)
            {
                var panel = Object.Instantiate(model, transform);
                panel.name = name;
                panel.transform.position = pos;
                panel.transform.localScale = Vector3.one * FenceScale;
                // 장식용 — 소·플레이어 모두 지나갈 수 있게 콜라이더를 안 둔다
                // (일부만 두른 줄이라 실제로 막으면 오히려 걸린 것처럼 보인다).
                if (woodMaterial != null)
                {
                    // fence.glb 실측 0.075×0.38×1 × FenceScale(2) → 높이 0.76·길이 2m
                    // (아래 CreateBox 폴백 size와 같은 값) — 보이는 면이 세로 널판이라
                    // LandmarksBuilder.BuildBridge()의 (width, plankLength)와 달리
                    // (높이, 길이)를 태일 축으로 쓴다.
                    ApplyPbrToRenderers(panel, EnvironmentMaterial.MakeTiled(woodMaterial, 0.76f, FenceScale));
                }
            }
            else
            {
                var size = new Vector3(0.15f, 0.76f, 2f);
                var panel = CreateBox(name, pos + Vector3.up * (size.y * 0.5f), size, FenceColor, withCollider: false);
                panel.transform.SetParent(transform, true);
            }
        }

        // ---- 공통 --------------------------------------------------------

        private static GameObject CreateBox(string name, Vector3 center, Vector3 size, Color color, bool withCollider = true)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.position = center;
            go.transform.localScale = size;
            if (!withCollider)
            {
                Object.DestroyImmediate(go.GetComponent<Collider>());
            }
            go.GetComponent<MeshRenderer>().sharedMaterial = MakeMaterial(color);
            return go;
        }

        private static GameObject CreateCylinder(string name, Vector3 center, float radius, float height, Color color)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            go.name = name;
            go.transform.position = center;
            go.transform.localScale = new Vector3(radius * 2f, height * 0.5f, radius * 2f);
            go.GetComponent<MeshRenderer>().sharedMaterial = MakeMaterial(color);
            return go;
        }

        private static Material MakeMaterial(Color color)
        {
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Prop (generated)" };
            mat.color = color;
            return mat;
        }

        /// <summary>LandmarksBuilder.ApplyPbrToRenderers()와 같은 결(GLB 하나에
        /// 서브메시 렌더러가 여럿일 수 있어 전부에 같은 재질을 씌운다).</summary>
        private static void ApplyPbrToRenderers(GameObject root, Material mat)
        {
            foreach (var renderer in root.GetComponentsInChildren<MeshRenderer>(true))
            {
                renderer.sharedMaterial = mat;
            }
        }
    }
}
