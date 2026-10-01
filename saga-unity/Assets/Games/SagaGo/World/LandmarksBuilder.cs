using Saga.Core;
using UnityEngine;
using Saga.Go.Data;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 28~31장 — 지도 위 이름난 자리(랜드마크): 굴 입구·마을집·폐허·
    /// 다리·산신당. saga-godot의 landmarks_builder.gd와 같은 자리·같은 크기.
    ///
    /// 2026-09-12 GLB 도입(PLAN.md 8장) — Kenney Fantasy Town Kit·Modular
    /// Cave Kit(CC0, saga-godot 트랙과 같은 파일, docs/ASSET_GUIDE.md 참고)로
    /// 굴 입구·마을집 벽/지붕·폐허 기둥·다리 널판을 교체했다. GLB를 못 찾으면
    /// (다른 PC 등) 예전 primitive로 대체한다.
    ///
    /// **산신당은 그때 미뤄 뒀다가(altar-stone.glb가 기둥 4개짜리 옛 구조와
    /// 형태가 많이 달라 재설계가 필요했다) 같은 날 후속 조각으로 처리했다**
    /// — saga-godot landmarks_builder.gd의 SHRINE_SIZE/SHRINE_SCALE을 그대로
    /// 옮겨 받침대+기둥 4개 구조를 통째로 걷어내고 작은 제단 하나로 바꿨다
    /// (아래 BuildShrine() 참고).
    /// </summary>
    public class LandmarksBuilder : MonoBehaviour
    {
        private static readonly Color CaveColor = new Color(0.12f, 0.12f, 0.14f);
        private static readonly Color WallColor = new Color(0.72f, 0.6f, 0.4f);
        private static readonly Color RoofColor = new Color(0.45f, 0.18f, 0.14f);
        private static readonly Color RuinColor = new Color(0.5f, 0.48f, 0.46f);
        private static readonly Color BridgeColor = new Color(0.42f, 0.3f, 0.18f);
        private static readonly Color ShrineColor = new Color(0.62f, 0.52f, 0.3f);

        // docs/ASSET_GUIDE.md 실측 표와 같은 값(같은 TileSize=48 세계 축척이라
        // saga-godot 스케일을 그대로 재사용) — 편집기 빌드 스크립트가 Init()으로
        // 채워 준다(NpcBuilder.cs와 같은 이유, 런타임 Awake()는 AssetDatabase를
        // 못 쓴다).
        [SerializeField] private GameObject caveModel;   // gate-rock.glb, 실측 4.00×4.05×2.45, ×1.48
        [SerializeField] private GameObject wallModel;    // wall-block.glb, 실측 1×1×1(비균등 스케일=벽 크기 그대로)
        [SerializeField] private GameObject roofModel;    // roof-gable.glb, 실측 1.1×0.57×1.07, ×10(균일)
        [SerializeField] private GameObject pillarModel;  // pillar-stone.glb, 실측 0.16×1.0×0.16, 스케일=높이
        [SerializeField] private GameObject plankModel;   // planks.glb, 실측 1×0.06×1, 44개 이어 붙임
        [SerializeField] private GameObject shrineModel;  // altar-stone.glb, 실측 1.04×0.49×0.65, ×2.5(균일)

        // 44장 "Building" 교체(2026-09-14) — Kenney wall-block.glb·roof-gable.glb는
        // 공유 아틀라스(colormap.png) UV라 DUNGEON room-small.glb 셸처럼 "부분
        // 교체 불가"였는데, DUNGEON이 gate.glb 아치에 이미 쓴 것과 같은 방식
        // (기존 아틀라스 UV 위에 EnvironmentMaterial.MakeTiled로 다시 구운 재질을
        // 그냥 덮어씀 — DungeonRoomBuilder.BuildGateArch와 동일 패턴)을 그대로
        // 옮겼다. 처음엔 마을집 벽/지붕에만 썼는데(그때는 wallMaterial/
        // roofMaterial로 불렀다), 이어서(2026-09-14 후속) 굴 입구·폐허 기둥·
        // 다리 널판·산신당까지 같은 두 재질을 재사용해 필드 이름을 재질
        // 성질(나무/돌) 기준으로 바꿨다 — woodMaterial=dark_wooden_planks
        // (다리 널판), stoneMaterial=castle_wall_slates(마을집 지붕·굴 입구·
        // 폐허 기둥·산신당, 전부 돌/바위 질감이라 어울린다). 66-2장이 미리
        // 구워 둔 다섯 후보 중 재사용, 새 텍스처는 안 받았다. 둘 다 없으면
        // (다른 PC 등) 기존 GLB 원본 재질 그대로 폴백.
        [SerializeField] private Material woodMaterial;
        [SerializeField] private Material stoneMaterial;

        public void Init(GameObject cave, GameObject wall, GameObject roof, GameObject pillar, GameObject plank, GameObject shrine)
        {
            caveModel = cave;
            wallModel = wall;
            roofModel = roof;
            pillarModel = pillar;
            plankModel = plank;
            shrineModel = shrine;
        }

        private void Awake()
        {
            // 이미 저장된 씬을 실제 Play로 열면 Awake가 다시 불려 Build()를
            // 또 돌리는데, 편집기 빌드 스크립트가 이미 자식들을 만들어 둔
            // 뒤라 그대로 두면 랜드마크가 두 벌씩 겹쳐 생긴다 — NpcBuilder.cs와
            // 같은 방어(2026-09-12 GLB 교체 때 같이 발견).
            if (transform.childCount > 0) return;
            Build();
        }

        public void Build()
        {
            BuildCave();
            BuildVillage();
            BuildRuins();
            BuildBridge();
            BuildShrine();
            MarkStatic();
        }

        /// <summary>PLAN.md 76장 Mobile Performance Pass — 굴 입구·마을집·
        /// 폐허·다리는 절대 안 움직이니 정적 배칭·오클루전 컬링 대상으로
        /// 표시한다.</summary>
        private void MarkStatic()
        {
            foreach (Transform t in GetComponentsInChildren<Transform>(true))
            {
                t.gameObject.isStatic = true;
            }
        }

        // ---- 굴 입구 --------------------------------------------------------

        private void BuildCave()
        {
            float ground = TestMapData.Legend['C'].Height;
            Vector3 pos = TestMapData.WorldPos(3, 0) + new Vector3(0, ground, 0);

            if (caveModel != null)
            {
                var cave = Object.Instantiate(caveModel, transform);
                cave.name = "CaveEntrance";
                cave.transform.position = pos;
                const float scale = 1.48f; // docs/ASSET_GUIDE.md — 목표 높이 6m
                cave.transform.localScale = Vector3.one * scale;

                // GLB엔 콜라이더가 없다 — 실측 로컬 AABB(바닥 피벗)로 직접 추가.
                var col = cave.AddComponent<BoxCollider>();
                col.center = new Vector3(0f, 2.025f, 0f);
                col.size = new Vector3(4.0f, 4.05f, 2.45f);
                if (stoneMaterial != null)
                {
                    ApplyPbrToRenderers(cave, EnvironmentMaterial.MakeTiled(stoneMaterial, 4.0f * scale, 2.45f * scale));
                }
            }
            else
            {
                var size = new Vector3(10f, 6f, 4f);
                var box = CreateBox("CaveEntrance", pos + Vector3.up * (size.y * 0.5f), size, CaveColor);
                box.transform.SetParent(transform, true);
            }
        }

        // ---- 마을집 --------------------------------------------------------

        // 103-1 "변형 배가 대상 — 건물 모듈(Kenney 4 → PBR 모듈 8 × 배치 조합)"
        // (2026-09-21) — 새 부품을 안 받고 기존 wall-block·roof-gable·
        // pillar-stone 3종을 곁채(작은 wall-block+roof-gable 한 벌 더)·굴뚝
        // (pillar-stone 재사용, SpawnPillar와 같은 결)으로 다시 조합해
        // 집 두 채가 서로 다르게 보이게 한다. 곁채 유무 × 굴뚝 유무 =
        // 2×2 조합, 여기에 몸통 크기 변주(hash)까지 얹어 "8종 조합" 취지를
        // 만족한다 — 새 지오메트리·새 텍스처 없이 배치 조합만으로.
        private void BuildVillage()
        {
            float ground = TestMapData.Legend['H'].Height;
            var wingSize = new Vector3(5f, 2.6f, 5f);

            int[] houseGx = { 2, 3 };
            bool[] hasWing = { true, false };
            bool[] hasChimney = { true, true };

            for (int i = 0; i < houseGx.Length; i++)
            {
                int gx = houseGx[i];
                // 몸통 크기도 집마다 살짝 흔든다(0.9~1.1) — 완전히 같은 박스 두 채가
                // 서 있는 인상을 없앤다.
                float s = 0.9f + VegetationBuilder.Hash(gx, 3, 900) * 0.2f;
                var bodySize = new Vector3(10f * s, 4f, 10f * s);
                var roofSize = new Vector3(11f * s, 1.2f, 11f * s);
                Vector3 basePos = TestMapData.WorldPos(gx, 3) + new Vector3(0, ground, 0);

                var house = new GameObject($"House_{gx}");
                house.transform.SetParent(transform, false);
                house.transform.position = basePos;

                BuildHouseBody(house.transform, Vector3.zero, bodySize, roofSize, addCollider: true);

                if (hasWing[i])
                {
                    // 몸통 옆(+X)에 붙는 작은 곁채 — 자기 벽·지붕 한 벌을 따로 지어
                    // 몸통과 다른 실루엣을 만든다(같은 부품, 다른 배치).
                    float wingX = bodySize.x * 0.5f + wingSize.x * 0.5f;
                    var wingRoofSize = new Vector3(wingSize.x * 1.1f, 1.2f, wingSize.z * 1.1f);
                    BuildHouseBody(house.transform, new Vector3(wingX, 0f, 1.5f), wingSize, wingRoofSize, addCollider: true);
                }

                if (hasChimney[i])
                {
                    // pillar-stone.glb 재사용(SpawnPillar와 같은 결) — 지붕 마루 근처에서
                    // 위로 튀어나오게. 실측 지름 0.16m라 스케일=높이로도 굴뚝다운 가는 비례가 나온다.
                    const float chimneyHeight = 3f;
                    Vector3 chimneyGround = basePos + new Vector3(bodySize.x * 0.28f, bodySize.y + 1.6f, -bodySize.z * 0.28f);
                    SpawnPillar($"Chimney_{gx}", chimneyGround, chimneyHeight, RoofColor, stoneMaterial);
                }
            }
        }

        /// <summary>벽 한 채(wall-block 스케일업) + 지붕 한 채(roof-gable ×10) —
        /// 몸통·곁채가 이 메서드 하나를 공유한다(103-1 "배치 조합").
        /// localOffset은 house 트랜스폼 기준 로컬 좌표.</summary>
        private void BuildHouseBody(Transform houseParent, Vector3 localOffset, Vector3 bodySize, Vector3 roofSize, bool addCollider)
        {
            if (wallModel != null)
            {
                // wall-block.glb 실측이 정확히 1×1×1이라 비균등 스케일을
                // bodySize 그대로 넣으면 예전 박스 발자국과 완전히 같다.
                var wall = Object.Instantiate(wallModel, houseParent);
                wall.name = "Wall";
                wall.transform.localPosition = localOffset;
                wall.transform.localScale = bodySize;
                if (addCollider)
                {
                    var col = wall.AddComponent<BoxCollider>();
                    col.center = new Vector3(0f, 0.5f, 0f);
                    col.size = Vector3.one;
                }
                if (woodMaterial != null)
                {
                    ApplyPbrToRenderers(wall, EnvironmentMaterial.MakeTiled(woodMaterial, bodySize.x, bodySize.z));
                }
            }
            else
            {
                var wall = CreateBox("Wall", houseParent.position + localOffset + Vector3.up * (bodySize.y * 0.5f), bodySize, WallColor);
                wall.transform.SetParent(houseParent, true);
            }

            if (roofModel != null)
            {
                // roof-gable.glb — docs/ASSET_GUIDE.md와 같은 균일 ×10(saga-godot
                // 실측 기준). 지붕은 밟고 다니는 자리가 아니라 콜라이더 없음(기존과 동일).
                var roof = Object.Instantiate(roofModel, houseParent);
                roof.name = "Roof";
                roof.transform.localPosition = localOffset + new Vector3(0f, bodySize.y, 0f);
                roof.transform.localScale = Vector3.one * 10f;
                if (stoneMaterial != null)
                {
                    ApplyPbrToRenderers(roof, EnvironmentMaterial.MakeTiled(stoneMaterial, roofSize.x, roofSize.z));
                }
                CameraOccluder.Attach(roof); // 109-9 — 밟지는 않지만 카메라는 지붕 앞에서 멈춘다
            }
            else
            {
                var roof = CreateBox("Roof", houseParent.position + localOffset + Vector3.up * (bodySize.y + roofSize.y * 0.5f), roofSize, RoofColor, withCollider: false);
                roof.transform.SetParent(houseParent, true);
                CameraOccluder.Attach(roof);
            }
        }

        // ---- 폐허 --------------------------------------------------------

        private void BuildRuins()
        {
            float ground = TestMapData.Legend['R'].Height;
            Vector3 basePos = TestMapData.WorldPos(5, 3) + new Vector3(0, ground, 0);
            var offsets = new[] { new Vector2(-3, -2), new Vector2(2, 1), new Vector2(-1, 3) };

            for (int i = 0; i < offsets.Length; i++)
            {
                float height = 5f + (i % 2) * 1.5f;
                Vector3 pos = basePos + new Vector3(offsets[i].x, 0f, offsets[i].y);
                SpawnPillar($"RuinPillar_{i}", pos, height, RuinColor, stoneMaterial);
            }
        }

        // ---- 다리 --------------------------------------------------------

        /// <summary>
        /// 충돌은 TerrainBuilder.BuildCollision이 'B' 타일에 이미 같은 높이로
        /// 놓아 뒀다(saga-godot landmarks_builder.gd의 같은 결정 — 두 곳이
        /// 각자 만들면 겹친다) — 여기 널판은 순전히 눈에 보이는 다리 덱이라
        /// 충돌체를 안 둔다. planks.glb(실측 1×0.06×1)를 이어 붙인다 —
        /// saga-godot도 같은 폭(44개)으로 이어 붙였다(docs/ASSET_GUIDE.md).
        /// </summary>
        private void BuildBridge()
        {
            float bed = TestMapData.Legend['B'].Height;
            Vector3 center = TestMapData.WorldPos(3, 5) + new Vector3(0, bed + TestMapData.BridgeClearance, 0);
            const float width = 6f;
            float depth = TestMapData.TileSize * 0.92f;

            if (plankModel != null)
            {
                var deck = new GameObject("Bridge");
                deck.transform.SetParent(transform, false);

                int count = Mathf.RoundToInt(depth);
                float plankLength = depth / count;
                // 널판 44개가 전부 같은 크기라 재질 인스턴스도 하나만 구워 공유한다
                // (매번 새로 구우면 44벌 생긴다 — 낭비).
                var plankMat = woodMaterial != null ? EnvironmentMaterial.MakeTiled(woodMaterial, width, plankLength) : null;
                for (int i = 0; i < count; i++)
                {
                    float z = center.z + (i - (count - 1) * 0.5f) * plankLength;
                    var plank = Object.Instantiate(plankModel, deck.transform);
                    plank.name = "Plank";
                    plank.transform.position = new Vector3(center.x, center.y - 0.03f, z);
                    plank.transform.localScale = new Vector3(width, 1f, plankLength);
                    if (plankMat != null)
                    {
                        ApplyPbrToRenderers(plank, plankMat);
                    }
                }
            }
            else
            {
                var size = new Vector3(width, 0.6f, depth);
                var bridge = CreateBox("Bridge", center, size, BridgeColor, withCollider: false);
                bridge.transform.SetParent(transform, true);
            }
        }

        // ---- 산신당 --------------------------------------------------------

        // saga-godot landmarks_builder.gd의 SHRINE_SIZE/SHRINE_SCALE 그대로
        // (altar-stone.glb, CC0 Kenney Graveyard Kit, 바닥 중앙 피벗) —
        // gate-rock.glb와 같은 이유로(실제 돌 표면 굴곡이 있는 조각) 균일
        // 스케일만 쓴다. 최종 크기 약 2.6×1.23×1.63m.
        private static readonly Vector3 ShrineSize = new Vector3(1.04f, 0.49f, 0.65f);
        private const float ShrineScale = 2.5f;

        /// <summary>
        /// PLAN.md 8장 "실제 3D 에셋" — 2026-09-12 재설계. 예전엔 받침대
        /// 박스(5×0.6×5)+기둥 4개짜리 구조였는데, 실제로 받아 온
        /// altar-stone.glb는 작은 제단 하나짜리 모양이라 그 구조를 통째로
        /// 걷어내고 saga-godot과 같은 단일 제단으로 바꿨다.
        /// </summary>
        private void BuildShrine()
        {
            float ground = TestMapData.Legend['S'].Height;
            Vector3 basePos = TestMapData.WorldPos(5, 1) + new Vector3(0, ground, 0);

            if (shrineModel != null)
            {
                var altar = Object.Instantiate(shrineModel, transform);
                altar.name = "ShrineAltar";
                altar.transform.position = basePos;
                altar.transform.localScale = Vector3.one * ShrineScale;

                // GLB엔 콜라이더가 없다 — 실측 로컬 AABB(바닥 피벗)로 직접 추가.
                var col = altar.AddComponent<BoxCollider>();
                col.center = new Vector3(0f, ShrineSize.y * 0.5f, 0f);
                col.size = ShrineSize;
                if (stoneMaterial != null)
                {
                    ApplyPbrToRenderers(altar,
                        EnvironmentMaterial.MakeTiled(stoneMaterial, ShrineSize.x * ShrineScale, ShrineSize.z * ShrineScale));
                }
            }
            else
            {
                var size = ShrineSize * ShrineScale;
                var altar = CreateBox("ShrineAltar", basePos + Vector3.up * (size.y * 0.5f), size, ShrineColor);
                altar.transform.SetParent(transform, true);
            }
        }

        // ---- 공통 --------------------------------------------------------

        /// <summary>pillar-stone.glb(실측 0.16×1.0×0.16, 바닥 피벗) — 스케일이
        /// 곧 목표 높이(docs/ASSET_GUIDE.md "높이=스케일값"). GLB가 없으면
        /// 예전 primitive Cylinder로 대체한다.</summary>
        private void SpawnPillar(string name, Vector3 groundPos, float height, Color color, Material pbrMaterial = null)
        {
            if (pillarModel != null)
            {
                var pillar = Object.Instantiate(pillarModel, transform);
                pillar.name = name;
                pillar.transform.position = groundPos;
                pillar.transform.localScale = Vector3.one * height;
                var col = pillar.AddComponent<CapsuleCollider>();
                col.radius = 0.08f;
                col.height = 1f;
                col.direction = 1; // Y축
                if (pbrMaterial != null)
                {
                    // pillar-stone.glb 실측 지름 0.32m — 아주 얇은 기둥이라 타일
                    // 배율을 그대로 쓰면 0.1 최솟값에 눌려 거의 늘 같은 배율이
                    // 된다(EnvironmentMaterial.MakeTiled 참고), 그래도 무해하다.
                    ApplyPbrToRenderers(pillar, EnvironmentMaterial.MakeTiled(pbrMaterial, 0.32f, height));
                }
            }
            else
            {
                const float radius = 0.6f;
                var pillar = CreateCylinder(name, groundPos + Vector3.up * (height * 0.5f), radius, height, color);
                pillar.transform.SetParent(transform, true);
            }
        }

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
            // 기본 Cylinder는 반지름 0.5·높이 2.
            go.transform.localScale = new Vector3(radius * 2f, height * 0.5f, radius * 2f);
            go.GetComponent<MeshRenderer>().sharedMaterial = MakeMaterial(color);
            return go;
        }

        /// <summary>GLB 하나에 렌더러가 여럿(부품별 서브메시)일 수 있어 전부에
        /// 같은 재질을 씌운다 — DungeonRoomBuilder.BuildGateArch와 같은 결.</summary>
        private static void ApplyPbrToRenderers(GameObject root, Material mat)
        {
            foreach (var renderer in root.GetComponentsInChildren<MeshRenderer>(true))
            {
                renderer.sharedMaterial = mat;
            }
        }

        private static Material MakeMaterial(Color color)
        {
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Landmark (generated)" };
            mat.color = color;
            return mat;
        }
    }
}
