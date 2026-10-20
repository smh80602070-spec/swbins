using System.Collections.Generic;
using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// VERTICAL_SLICE_FOREST.md(saga-godot) 4절 "결정 — 포함: 집 하나 +
    /// 들어가기/나가기 — 구면 투영이 실제로 꺼졌다 켜지는 것을 증명하는
    /// 자리(1절 '집 안만 안 휜다'의 첫 실증)". 별도 씬/서브레벨을 새로
    /// 안 만들고 **마을과 안 겹치는 먼 좌표(+500m)에 실내 방을 미리
    /// 지어 두고, 문 앞에 다가가면 플레이어 위치만 그 좌표로 옮긴다**
    /// (씬 전환 없이 "포켓 공간" 기법 — DUNGEON의 room-shell처럼 실제
    /// 지오메트리가 있는 방식과 달리, FOREST는 아직 정식 씬 관리가 없어
    /// 가장 작은 단위로 이렇게 풀었다). 실내 벽·바닥은 평범한 URP Lit
    /// 머티리얼(Saga/ForestWorldCurve가 아님)이라 **구면 투영을 아예 안
    /// 물린다** — 그게 "꺼짐"의 전부다(새 on/off 스위치 코드가 필요 없다,
    /// ForestWorldCurve.shader 클래스 주석 "실내 머티리얼은 이 셰이더를
    /// 아예 안 물리는 것으로" 참고).
    /// </summary>
    public class ForestHouse : MonoBehaviour
    {
        private static readonly Vector3 IndoorPocketOffset = new Vector3(0f, 0f, 500f); // 마을 좌표와 절대 안 겹치는 먼 자리
        private static readonly Vector3 RoomSize = new Vector3(6f, 3f, 6f);

        private const float TriggerRadius = 1.4f;
        private const float ToastSec = 3f;

        private static readonly Color WallColor = new Color(0.75f, 0.6f, 0.4f);
        private static readonly Color RoofColor = new Color(0.5f, 0.2f, 0.15f);
        private static readonly Color IndoorFloorColor = new Color(0.55f, 0.42f, 0.3f);
        private static readonly Color IndoorWallColor = new Color(0.82f, 0.78f, 0.68f);

        // FOREST 다음 조각 — 벽지/장판 색(saga-forest 웹판 `data-village.js`
        // WALLS.c/FLOORS.a 그대로). 기본(흙벽/마루)은 위 IndoorWallColor/
        // IndoorFloorColor와 값이 같다 — 갈아입지 않았으면 지금까지와 똑같이
        // 보인다.
        private static readonly Dictionary<string, Color> WallFinishColors = new Dictionary<string, Color>
        {
            ["earth"] = HexColor("#e6d8bd"), ["hanji"] = HexColor("#f4ecda"), ["muk"] = HexColor("#5a5f6a"),
            ["sol"] = HexColor("#5f7f5a"), ["dan"] = HexColor("#c05a44"),
        };
        private static readonly Dictionary<string, Color> FloorFinishColors = new Dictionary<string, Color>
        {
            ["wood"] = HexColor("#c2925c"), ["mat"] = HexColor("#c8b98a"), ["jangpan"] = HexColor("#d8b26a"),
            ["stone"] = HexColor("#9aa0a6"), ["ondol"] = HexColor("#b0a08a"),
        };

        private static Color HexColor(string hex)
        {
            ColorUtility.TryParseHtmlString(hex, out var c);
            return c;
        }

        private bool _finishSynced;

        private Vector3 _entryTriggerPos;      // 야외 — 문 앞, 여기 다가가면 들어간다.
        private Vector3 _exitLandingPos;       // 야외 — 나올 때 돌아오는 자리(재진입 반경 밖).
        private Vector3 _entryLandingPosIndoor; // 실내 — 들어오면 서는 자리.
        private Vector3 _exitTriggerPosIndoor;  // 실내 — 반대편, 여기 다가가면 나간다.

        private Transform _player;
        private CharacterController _playerController;
        private bool _isInside;

        /// <summary>tasks U-0144 — 집 안 방 오른쪽 벽 곁(동반자가 서는 자리, 웹 partner.homeSpot).</summary>
        public Vector3 PartnerSpot => transform.position + IndoorPocketOffset + new Vector3(RoomSize.x * 0.5f - 1.2f, 0f, 0.5f);

        private void Awake()
        {
            if (transform.childCount == 0) Build();

            _entryTriggerPos = transform.position + new Vector3(0f, 0f, -2.5f);
            _exitLandingPos = transform.position + new Vector3(0f, 0.1f, -5f);

            Vector3 indoorCenter = transform.position + IndoorPocketOffset;
            _entryLandingPosIndoor = indoorCenter + new Vector3(0f, 0.1f, RoomSize.z * 0.5f - 1f);
            _exitTriggerPosIndoor = indoorCenter + new Vector3(0f, 0f, -RoomSize.z * 0.5f + 1f);

            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
            _playerController = playerGo != null ? playerGo.GetComponent<CharacterController>() : null;
        }

        /// <summary>saga-unity DUNGEON `DungeonFloorRunner.RepositionPlayerToEntry()`
        /// 슬라이스(2026-09-12, 열한 번째 세션)가 실제 검증 도구로 잡아낸 것과 같은
        /// 문제 — `CharacterController`가 켜진 채 `transform.position`을 그냥 대입하면
        /// Unity가 다음 프레임에 조용히 원래 자리로 되돌린다. 이 메서드는 그때 이후로
        /// 발견된 같은 패턴이라 코드 검토로 미리 고쳤다(사람이 실기로 "문이 안 열린다"
        /// 를 겪기 전에).</summary>
        private void TeleportPlayer(Vector3 position)
        {
            if (_playerController != null) _playerController.enabled = false;
            _player.position = position;
            if (_playerController != null) _playerController.enabled = true;
        }

        /// <summary>`ForestGroundBuilder.Build()`/`DungeonRoomBuilder.Build()`와
        /// 같은 결로 공개 메서드로 뺐다 — Awake()는 Play 모드에서만 저절로 불리고
        /// 에디터 스크립트가 씬을 조립하는 시점(edit-time)에는 안 불린다("집 꾸미기
        /// (가구)" 슬라이스에서 `BuildTestVillageForestScene.cs`가 IndoorRoom을
        /// 바로 찾으려다 실제로 겪은 문제 — 이 메서드를 명시로 부르면 해결된다).</summary>
        public void Build()
        {
            BuildExterior();
            BuildIndoorRoom();
        }

        /// <summary>4m×2.5m 벽 셋(남쪽만 비워 문으로 삼는다) + 지붕. 실제
        /// GLB 건물 대신 임시 primitive(PLAN.md 8장 "Placeholder는 개발
        /// 초기 테스트용") — 다음에 실제 건물 GLB를 구하면 이 메서드만
        /// 바꾸면 된다.</summary>
        private void BuildExterior() => BuildShell(transform, true);

        /// <summary>벽 셋 + 지붕 — 이 집과 tasks U-0127 작은 빈 집(`ForestLotRunner`, 줄여서·충돌 없이)이 같이 쓴다.</summary>
        internal static void BuildShell(Transform transform, bool solid)
        {
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "ForestHouseWall (generated)" };
            mat.color = WallColor;

            BuildWall(transform, new Vector3(0f, 1.25f, 2f), new Vector3(4f, 2.5f, 0.3f), mat); // 북쪽
            BuildWall(transform, new Vector3(2f, 1.25f, 0f), new Vector3(0.3f, 2.5f, 4f), mat); // 동쪽
            BuildWall(transform, new Vector3(-2f, 1.25f, 0f), new Vector3(0.3f, 2.5f, 4f), mat); // 서쪽
            if (!solid) foreach (Transform w in transform) if (w.name == "Wall") Saga.Core.Colliders.Strip(w.gameObject);
            // 남쪽(-Z)은 일부러 안 세운다 — 문.

            var roof = GameObject.CreatePrimitive(PrimitiveType.Cube);
            roof.name = "Roof";
            roof.transform.SetParent(transform, false);
            roof.transform.localScale = new Vector3(4.6f, 0.4f, 4.6f);
            roof.transform.localPosition = new Vector3(0f, 2.7f, 0f);
            var roofMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "ForestHouseRoof (generated)" };
            roofMat.color = RoofColor;
            roof.GetComponent<MeshRenderer>().sharedMaterial = roofMat;
            Saga.Core.Colliders.Strip(roof);
        }

        /// <summary>+500m 포켓의 작은 방 — 남쪽만 비워 실외 문과 같은 자리에
        /// "들어온 자리"가 있게 맞춘다. 곡률 셰이더를 안 쓰는 평범한 Lit
        /// 머티리얼이 이 방 전체의 "안 휨"을 그대로 나타낸다.</summary>
        private void BuildIndoorRoom()
        {
            var indoorGo = new GameObject("IndoorRoom");
            indoorGo.transform.SetParent(transform, false);
            indoorGo.transform.position = transform.position + IndoorPocketOffset;

            var floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
            floor.name = "IndoorFloor";
            floor.transform.SetParent(indoorGo.transform, false);
            floor.transform.localScale = new Vector3(RoomSize.x, 0.2f, RoomSize.z);
            floor.transform.localPosition = new Vector3(0f, -0.1f, 0f);
            var floorMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "ForestIndoorFloor (generated, no curve)" };
            floorMat.color = IndoorFloorColor;
            floor.GetComponent<MeshRenderer>().sharedMaterial = floorMat;

            var wallMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "ForestIndoorWall (generated, no curve)" };
            wallMat.color = IndoorWallColor;

            BuildWall(indoorGo.transform, new Vector3(0f, RoomSize.y * 0.5f, RoomSize.z * 0.5f), new Vector3(RoomSize.x, RoomSize.y, 0.2f), wallMat); // 북쪽
            BuildWall(indoorGo.transform, new Vector3(RoomSize.x * 0.5f, RoomSize.y * 0.5f, 0f), new Vector3(0.2f, RoomSize.y, RoomSize.z), wallMat); // 동쪽
            BuildWall(indoorGo.transform, new Vector3(-RoomSize.x * 0.5f, RoomSize.y * 0.5f, 0f), new Vector3(0.2f, RoomSize.y, RoomSize.z), wallMat); // 서쪽
            // 남쪽은 안 세운다 — 실외 문과 같은 자리.
        }

        private static void BuildWall(Transform parent, Vector3 localPos, Vector3 size, Material mat)
        {
            var wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wall.name = "Wall";
            wall.transform.SetParent(parent, false);
            wall.transform.localScale = size;
            wall.transform.localPosition = localPos;
            wall.GetComponent<MeshRenderer>().sharedMaterial = mat;
        }

        /// <summary>ForestFinishStall.cs가 벽지/장판을 바꿀 때 부른다(직접
        /// 호출 — 벽지/장판엔 여럿이 구독할 만한 이벤트가 필요 없어 가구
        /// 배치(`ForestFurniturePlacer.cs`, `ForestHomeState.Changed`
        /// 이벤트 구독)와 달리 이 방식을 그대로 둔다). **재질을 필드로
        /// 캐싱하지 않고 매번 하이어라키에서
        /// 찾는다** — 에디터가 미리 지어(`BuildTestVillageForestScene.cs`)
        /// 씬 파일로 저장해 둔 뒤 Play에서 그 자식을 그대로 불러오는 경로라,
        /// 이 컴포넌트의 private 필드(비직렬화)는 새 인스턴스에서 항상
        /// null이다 — 세이브 로드 직후 첫 Update에도 안전하게 쓰려면
        /// 캐싱 대신 조회가 맞다.</summary>
        public void RepaintFinish()
        {
            var indoorRoom = transform.Find("IndoorRoom");
            if (indoorRoom == null) return;

            var floorRenderer = indoorRoom.Find("IndoorFloor")?.GetComponent<MeshRenderer>();
            if (floorRenderer != null && FloorFinishColors.TryGetValue(ForestHomeState.CurrentFloor, out var floorColor))
            {
                floorRenderer.material.color = floorColor;
            }

            if (WallFinishColors.TryGetValue(ForestHomeState.CurrentWall, out var wallColor))
            {
                foreach (Transform child in indoorRoom)
                {
                    if (child.name != "Wall") continue;
                    var mr = child.GetComponent<MeshRenderer>();
                    if (mr != null) mr.material.color = wallColor;
                }
            }
        }

        private void Update()
        {
            if (!_finishSynced)
            {
                _finishSynced = true;
                RepaintFinish(); // 로드된 세이브의 벽지/장판을 첫 프레임에 반영.
            }

            if (_player == null) return;

            if (!_isInside)
            {
                if (Vector3.Distance(_player.position, _entryTriggerPos) <= TriggerRadius)
                {
                    _isInside = true;
                    TeleportPlayer(_entryLandingPosIndoor);
                    DialogueLabel.Instance?.Show(ForestLocalization.T("house.enter", "집 안으로 들어왔다 — 화면이 더는 휘지 않는다."), ToastSec);
                }
            }
            else
            {
                if (Vector3.Distance(_player.position, _exitTriggerPosIndoor) <= TriggerRadius)
                {
                    _isInside = false;
                    TeleportPlayer(_exitLandingPos);
                    DialogueLabel.Instance?.Show(ForestLocalization.T("house.exit", "밖으로 나왔다 — 다시 마을이 휘어 보인다."), ToastSec);
                }
            }
        }
    }
}
