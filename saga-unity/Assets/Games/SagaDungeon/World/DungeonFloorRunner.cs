using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// "DUNGEON 오픈월드 확장 — 절차적 층 진행" 슬라이스(2026-09-12) — 사용자가
    /// "100층까지 진행해줘"로 요청했다. Room5~11까지 썼던 "층마다 방을
    /// 편집기 스크립트로 손으로 이어 붙이는" 물리적 확장은 100층 규모에선
    /// 불가능(방 수백~수천 개를 좌표로 하나하나 배치해야 함)이라, saga-dungeon
    /// 웹판의 실제 방식(방 하나를 클리어마다 갈아치우며 문 2~3개 중 다음
    /// 방 종류를 고르는 로그라이크식 진행, `js/dungeon.js` `run.room`/
    /// `goRoom()`/`descend()`)으로 전환했다 — Room5~11은 이 시스템으로
    /// 대체됐다(더 이상 물리적으로 존재하지 않는다).
    ///
    /// 문 선택은 화면 UI 버튼 대신 이 프로젝트의 기존 관례(우물·사당·퍼즐
    /// 제단처럼 "걸어서 가까이 가면 반응하는" 트리거)를 그대로 따른다 —
    /// 새 Canvas/EventSystem 배선이 필요 없다. 방이 갱신될 때마다 문 자리에
    /// 작은 표지(원기둥)+월드 공간 라벨(`DamagePopup.cs`와 같은 TMPro.TextMeshPro
    /// 빌보드 패턴)을 세우고, 그 위로 걸어가면 그 종류로 다음 방이 열린다.
    ///
    /// 난수는 이 파일 안에서만 쓰는 시드 고정 `System.Random`(프로젝트 관례인
    /// 20260824 시드 재사용)이라 `Editor/SimulateDungeonFloors.cs`가 씬 없이도
    /// 같은 순서를 재현해 100층까지 미리 검증할 수 있다.
    ///
    /// "방 셸 — 티어별 마모 3단" 슬라이스(2026-09-22, PLAN.md 103-1) — 방
    /// 하나를 계속 재사용하다 보니 100층을 내려가도 톤이 안 변해 밋밋했다.
    /// `_floor`가 바뀔 때마다(`Awake`/`Descend`/`JumpToFloor`)
    /// `DungeonRoomBuilder.SetWearTier(DungeonFormulas.RoomWearTier(_floor))`를
    /// 불러 재질만 다시 굽는다 — 새 지오메트리 없음.
    /// </summary>
    public class DungeonFloorRunner : MonoBehaviour
    {
        private const string RoomId = "procroom";
        private const float DoorTriggerRadius = 1.8f;

        [SerializeField] private GameObject gruntModel;   // character-d
        [SerializeField] private GameObject eliteModel;   // character-c (엘리트/미니보스/두목 공용)
        [SerializeField] private GameObject merchantModel; // PLAN.md 106-4 — Peasant Man(없으면 좌판만)
        [SerializeField] private GameObject captiveModel;  // PLAN.md 106-4 — Peasant Girl(없으면 캡슐)

        // PLAN.md 106-4 두목 전용 몸(2026-09-24) — 빈 칸이면 예전 몸(살수·주인 = eliteModel, 기계화 정예 = gruntModel).
        // 배율(ScaleMul)은 씬 빌더가 프리팹 키를 재서 옛 몸과 같은 키가 되게 넣는다. 전용 몸은 제 빛깔(주인만 명소 빛을 옅게).
        [SerializeField] private GameObject minibossModel;      // 황건 살수 — Ninja
        [SerializeField] private float minibossScaleMul = 1f;
        [SerializeField] private GameObject lordModel;          // 층 주인 — Demon T Wiezzorek
        [SerializeField] private float lordScaleMul = 1f;
        [SerializeField] private GameObject fusionEliteModel;   // 기계화 정찰병(5.7 시대 퓨전) — Alien Soldier
        [SerializeField] private float fusionEliteScaleMul = 1f;
        // PLAN.md 109-2 세 시대 — 전투 방 잡졸의 현대·미래 몸(`DungeonEras.FoeBodies` 이름 순, 배율 = 잡졸 키 / 새 몸 키)·행상 몸.
        // 없는 PC 는 null → 잡졸 몸에 그 시대 이름·빛깔만.
        [SerializeField] private string[] eraFoeNames = new string[0];
        [SerializeField] private GameObject[] eraFoeModels = new GameObject[0];
        [SerializeField] private float[] eraFoeScaleMuls = new float[0];
        [SerializeField] private GameObject modernPeddlerModel;
        [SerializeField] private GameObject futurePeddlerModel;
        // PLAN.md 109-10-5 지역 우두머리·신화 호위가 빌려 쓰는 다른 판 몸(`DungeonRegionFoes.BorrowedBodies` 이름 순). 키는 부르는 쪽이 재서 맞춘다.
        [SerializeField] private string[] regionBodyNames = new string[0];
        [SerializeField] private GameObject[] regionBodyModels = new GameObject[0];

        /// <summary>층 주인 전용 몸에 명소 빛을 입히는 비율 — 여섯 주인이 한 몸이라 빛으로 가른다.</summary>
        public const float LordTintMix = 0.35f;

        private static readonly Vector3[] GruntOffsets =
        {
            new Vector3(0f, 0f, 2f),
            new Vector3(-4f, 0f, -2f),
            new Vector3(4f, 0f, 3f),
            new Vector3(-3f, 0f, 4f),
        };

        private static readonly Vector3 SoloOffset = new Vector3(2f, 0f, 0f);       // elite/miniboss/boss 본체
        private static readonly Vector3[] EscortOffsets =
        {
            new Vector3(1f, 0f, 2.5f),
            new Vector3(1f, 0f, -2.5f),
        };
        private static readonly Vector3 PoiAnchor = new Vector3(-2f, 0f, -3f);       // trove/well/shrine/cave/merchant/puzzle/forage 공용

        private static readonly Vector3[] DoorPodOffsets =
        {
            new Vector3(-3f, 0f, 8f),
            new Vector3(0f, 0f, 9f),
            new Vector3(3f, 0f, 8f),
        };

        private readonly System.Random _rng = new System.Random(20260824); // 루트 CLAUDE.md 진단 시드 관례 재사용
        private readonly List<(Transform Pod, string Kind)> _doorPods = new List<(Transform, string)>();

        private int _floor = 2;   // Room1~4가 이미 "층1" — 이 시스템은 그 다음(Room5~11이 쓰던 층2)부터 이어받는다.
        private int _roomIndex;
        private int _roomTotal;
        private bool _doorsShown;
        private Transform _contentRoot;
        private Transform _player;
        private CharacterController _playerController;
        private DungeonRoomBuilder _roomBuilder; // "방 셸 — 티어별 마모 3단" — 같은 GameObject에 붙어 있다(BuildTestDungeonScene.cs).

        // PLAN.md 108 ③ 명소 층 — 이 층이 `DungeonLandmarkData` 의 몇 번째인지(-1 이면 보통 층), 지금 층 주인.
        private int _landmark = -1;
        private DungeonEnemy _lord;
        private EraDecorBuilder _eraDecor; // PLAN.md 109-2b — 자식 "LandmarkEraDecor"(없는 씬이면 null).

        public int CurrentLandmark => _landmark;
        public int RoomIndex => _roomIndex;
        public int RoomTotal => _roomTotal;
        public DungeonEnemy Lord => _lord;
        /// <summary>HUD 한 줄 — 명소 층이면 "⚱ 순장 왕릉 · 참배길", 아니면 빈 글.</summary>
        public string LandmarkHud => _landmark >= 0 ? DungeonLandmarkData.HudLine(_landmark, _roomIndex) : "";
        /// <summary>진단 — 지금 서 있는 문 표지(종류·글).</summary>
        public IEnumerable<(string Kind, string Label)> DoorPods()
        {
            foreach (var d in _doorPods)
            {
                if (d.Pod == null) continue;
                var mesh = d.Pod.GetComponentInChildren<TMPro.TextMeshPro>();
                yield return (d.Kind, mesh != null ? mesh.text : "");
            }
        }

        // `PlaytestDungeonFloorProgression.cs`(신규 검증 도구)가 실제로 잡아낸 결함 —
        // 방을 갈아치운 뒤에도 플레이어를 문 표지 자리(z=8~9)에 그대로 둬서, 다음 방이
        // 무전투 종류(POI)면 그 자리에 새로 선 문이 곧바로 다시 트리거돼 사람이 걷지도
        // 않았는데 방 여러 개를 순식간에 건너뛰어 버렸다(DoorTriggerRadius 1.8 안에
        // 계속 서 있는 셈이라). 방을 다시 지을 때마다 문 구역과 충분히 떨어진 남쪽
        // 진입 지점으로 되돌려 세워, 다음 문까지 다시 걸어오게 한다(다른 물리적 방들이
        // 복도를 지나야 다음 방에 닿는 것과 같은 느낌).
        private static readonly Vector3 PlayerEntryOffset = new Vector3(0f, 0f, -6f);

        /// <summary>`Data/SaveState.cs`가 저장/복원 시점에 찾아 쓰는 정식
        /// 접근점 — 씬에 이 컴포넌트가 하나뿐이라(ProcRoom 하나) 싱글턴으로
        /// 충분하다.</summary>
        public static DungeonFloorRunner Instance { get; private set; }

        /// <summary>지금 층 — 세이브가 저장하는 값(정확한 방 인덱스·종류까지는
        /// 안 남긴다, 아래 `JumpToFloor()` 주석 참고).</summary>
        public int CurrentFloor => _floor;

        /// <summary>PLAN.md 101-2 5.1 "축복 3택" 트리거 — GameBootstrap이 구독해
        /// `DungeonFormulas.IsBossFloor(floor)`일 때만 카드를 띄운다(웹판 "3층마다"와 같은 문턱,
        /// `JumpToFloor()`로 세이브를 복원할 땐 안 쏜다 — 그건 "다시 내려간다"가 아니라 이어하기다).</summary>
        public event Action<int> FloorDescended;

        /// <summary>PLAN.md 101-2 5.2 "유품" — `GraveMarker`가 이 자리로 자신을
        /// 옮겨 붙는다. `_contentRoot`(방 갈이마다 통째로 Destroy되는 자리)에
        /// 얹으면 "회수 전에 방을 뜨면 사라진다"가 별도 로직 없이 저절로
        /// 지켜진다 — `worldPositionStays: true`로 스폰 당시 월드 좌표를 그대로 둔다.</summary>
        public void AddToRoom(GameObject go) => go.transform.SetParent(_contentRoot, true);

        private void Awake()
        {
            Instance = this;
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
            _playerController = playerGo != null ? playerGo.GetComponent<CharacterController>() : null;

            var contentGo = new GameObject("RoomContent");
            contentGo.transform.SetParent(transform, false);
            _contentRoot = contentGo.transform;

            _roomBuilder = GetComponent<DungeonRoomBuilder>();
            _eraDecor = GetComponentInChildren<EraDecorBuilder>(true);
            UpdateWearTier();

            EnterFloorLayout();
            BuildRoomContent(FirstRoomKind()); // dungeon.js buildFloor() — 층의 첫 방은 항상 전투방(명소 층은 표의 첫 방).
        }

        private void OnEnable() => DungeonEnemy.AnyDied += OnEnemyDied;
        private void OnDisable() => DungeonEnemy.AnyDied -= OnEnemyDied;

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        /// <summary>PLAN.md 108 ③ — 층이 바뀔 때 명소 층인지 보고 방 수를 정한다(명소 층은 방 다섯 고정).</summary>
        private void EnterFloorLayout()
        {
            _landmark = DungeonLandmarkData.IndexOfFloor(_floor);
            _roomTotal = _landmark >= 0 ? DungeonLandmarkData.RoomCount : DungeonFormulas.RoomsFor(_floor);
            _lord = null;
            if (_eraDecor != null) _eraDecor.ShowLandmark(_landmark); // 109-2b 명소 층 꾸밈(시대 층) — 그 층 것만 켠다.
        }

        private string FirstRoomKind() => _landmark >= 0 ? DungeonLandmarkData.All[_landmark].Kinds[0] : "fight";

        /// <summary>PLAN.md 108 ③ — 층 주인이 쓰러지면 토벌을 적고, 첫 토벌이면 금을 더 준다(무기는 주인이 떨군다).</summary>
        private void OnEnemyDied(DungeonEnemy e)
        {
            if (e == null || e != _lord || _landmark < 0) return;
            _lord = null;
            bool first = LandmarkState.RecordClear(_landmark);
            string name = DungeonLandmarkData.Name(_landmark);
            if (first)
            {
                int gold = DungeonLandmarkData.FirstClearGoldPerFloor * _floor;
                HeroState.AddGold(gold);
                var item = ItemData.Get(DungeonLandmarkData.All[_landmark].RewardItemId);
                DialogueLabel.Instance?.Show(string.Format(DungeonLandmarkData.FirstClearText(), name, item != null ? item.Name : "", gold), 5f);
            }
            else
            {
                DialogueLabel.Instance?.Show(string.Format(DungeonLocalization.T("landmark.clear_again", "⚱ {0} — 층 주인을 다시 눌렀다"), name), 3f);
            }
        }

        /// <summary>`SaveState.TryLoad()`가 부른다(Awake가 끝난 뒤, GameBootstrap
        /// .Start()에서 — Unity 실행 순서상 이 컴포넌트의 Awake가 이미
        /// floor=2 첫 방을 지어 둔 다음이라 한 번 다시 짓는 비용이 든다,
        /// 단순함을 위해 감수). **정확한 방 인덱스·종류까지는 저장하지
        /// 않는다** — 층 하나가 이 프로젝트가 다루기로 한 "의미 있는 진행
        /// 단위"라(원작도 `dstate().best`로 최고 층만 따로 추적한다,
        /// dungeon.js descend()) 저장된 층의 첫 방(전투)부터 다시 시작한다.</summary>
        public void JumpToFloor(int floor)
        {
            if (floor < 2) return;
            ClearDoorPods();
            _floor = floor;
            _roomIndex = 0;
            EnterFloorLayout();
            UpdateWearTier();
            BuildRoomContent(FirstRoomKind());
        }

        /// <summary>"방 셸 — 티어별 마모 3단" — `_roomBuilder`가 없는 PC(에셋
        /// 미확보로 PBR 재질을 못 찾아 primitive 색상 경로로 빠진 경우)에도
        /// `SetWearTier()`가 안전하게 아무 일도 안 하니 그냥 부른다.</summary>
        private void UpdateWearTier() => _roomBuilder?.SetWearTier(DungeonFormulas.RoomWearTier(_floor));

        private void Update()
        {
            if (_player == null) return;

            if (_doorsShown)
            {
                for (int i = 0; i < _doorPods.Count; i++)
                {
                    if (_doorPods[i].Pod == null) continue;
                    if (Vector3.Distance(_doorPods[i].Pod.position, _player.position) <= DoorTriggerRadius)
                    {
                        string chosen = _doorPods[i].Kind;
                        ClearDoorPods();
                        if (chosen == "stair") Descend();
                        else AdvanceRoom(chosen);
                        return;
                    }
                }
                return;
            }

            if (DungeonEnemy.CountAliveInRoom(RoomId) > 0) return; // 아직 안 치워짐 — dungeon.js room.cleared와 같은 뜻.

            if (_roomIndex >= _roomTotal - 1) ShowStairDoor();
            else ShowKindDoors();
        }

        private void ShowKindDoors()
        {
            _doorsShown = true;
            if (_landmark >= 0)
            {
                // PLAN.md 108 ③ 명소 층 — 갈림길 없이 문 하나, 표지에 다음 방 이름. 난수를 안 쓴다(같은 층은 늘 같은 방).
                int next = _roomIndex + 1;
                string kind = DungeonLandmarkData.All[_landmark].Kinds[next];
                var landmarkPod = BuildDoorPod(DoorPodOffsets[1], kind, DungeonLandmarkData.RoomName(_landmark, next));
                _doorPods.Add((landmarkPod, kind));
                return;
            }
            var kinds = DungeonFormulas.PickDoorKinds(_rng);
            for (int i = 0; i < kinds.Count && i < DoorPodOffsets.Length; i++)
            {
                var pod = BuildDoorPod(DoorPodOffsets[i], kinds[i]);
                _doorPods.Add((pod, kinds[i]));
            }
        }

        private void ShowStairDoor()
        {
            _doorsShown = true;
            var pod = BuildDoorPod(DoorPodOffsets[1], "stair");
            _doorPods.Add((pod, "stair"));
        }

        private Transform BuildDoorPod(Vector3 localOffset, string kind, string label = null)
        {
            var go = new GameObject($"Door_{kind}");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = localOffset;

            var visual = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            visual.name = "Visual";
            visual.transform.SetParent(go.transform, false);
            visual.transform.localScale = new Vector3(0.8f, 0.5f, 0.8f);
            visual.transform.localPosition = new Vector3(0f, 0.5f, 0f);
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "DungeonFloorDoor (generated)" };
            mat.color = new Color(0.85f, 0.75f, 0.3f);
            visual.GetComponent<MeshRenderer>().sharedMaterial = mat;
            UnityEngine.Object.Destroy(visual.GetComponent<Collider>());

            var labelGo = new GameObject("Label");
            labelGo.transform.SetParent(go.transform, false);
            labelGo.transform.localPosition = new Vector3(0f, 1.6f, 0f);
            var mesh = Saga.Core.SagaWorldText.Add(labelGo, label ?? DungeonFormulas.KindDisplayName(kind), 40f * 0.22f, Color.white);
            labelGo.AddComponent<DoorLabelBillboard>();

            return go.transform;
        }

        private void ClearDoorPods()
        {
            for (int i = 0; i < _doorPods.Count; i++)
            {
                if (_doorPods[i].Pod != null) UnityEngine.Object.Destroy(_doorPods[i].Pod.gameObject);
            }
            _doorPods.Clear();
            _doorsShown = false;
        }

        private void AdvanceRoom(string kind)
        {
            _roomIndex++;
            bool forceBoss = _landmark < 0 && DungeonFormulas.IsBossFloor(_floor) && _roomIndex >= _roomTotal - 1;
            BuildRoomContent(forceBoss ? "boss" : kind);
            RepositionPlayerToEntry();
            if (_landmark >= 0) DialogueLabel.Instance?.Show(LandmarkHud, 2.5f); // 108 ③ 방마다 이름
        }

        private void Descend()
        {
            // PLAN.md 101-2 5.3 "부적 던전" — 방금 떠나는 층(증가 전 _floor)이
            // 변형자 층이었으면 클리어 보상을 준다. FloorDescended가 사용자
            // 접근점(CurrentFloor)을 새 층으로 바꾸기 전에 여기서 먼저 계산한다.
            int sigilBonus = SigilState.ClearBonusGold(_floor);
            if (sigilBonus > 0)
            {
                HeroState.AddGold(sigilBonus);
                // PLAN.md 101-2 5.6 "목표판·세션 카드·일일/주간"(2026-09-21) — 일일 풀의 "부적 층 클리어".
                DungeonDailyTaskState.ReportProgress(DungeonDailyTaskState.Kind.SigilClear, 1);
            }

            _floor++;
            _roomIndex = 0;
            EnterFloorLayout();
            UpdateWearTier();

            string msg = string.Format(DungeonLocalization.T("floor.descend", "🪜 제{0}층으로 내려간다"), _floor);
            if (sigilBonus > 0) msg += "\n" + string.Format(DungeonLocalization.T("floor.sigil_bonus", "📜 부적 층 클리어 — 금 {0} 추가 획득"), sigilBonus);
            if (SigilState.IsSigilFloor(_floor)) msg += "\n" + string.Format(DungeonLocalization.T("floor.sigil_warn", "⚠ 부적 층 — {0}"), SigilState.Label(SigilState.ModOf(_floor)));
            if (_landmark >= 0) msg += "\n" + DungeonLandmarkData.EnterText(_landmark); // 108 ③
            DialogueLabel.Instance?.Show(msg, _landmark >= 0 ? 5f : 4f);
            BuildRoomContent(FirstRoomKind());
            RepositionPlayerToEntry();
            FloorDescended?.Invoke(_floor);
        }

        /// <summary>`PlaytestDungeonFloorProgression.cs`가 잡아낸 결함 수정 — 문 표지
        /// 구역(z=8~9)에 그대로 서 있으면 무전투 방이 연달아 나올 때 걷지도 않았는데
        /// 자동으로 계속 트리거됐다. CharacterController가 켜진 채 transform.position을
        /// 그냥 대입하면 다음 프레임에 조용히 되돌아가므로(Unity 표준 동작) 잠깐 꺼서
        /// 옮긴다 — `Data/SaveState.cs`의 위치 복원은 Start() 이전이라 이 문제를 안
        /// 밟았지만, 이건 Play 도중(런타임) 실행이라 다르다.</summary>
        private void RepositionPlayerToEntry()
        {
            if (_player == null) return;
            Vector3 target = transform.TransformPoint(PlayerEntryOffset);
            if (_playerController != null) _playerController.enabled = false;
            _player.position = target;
            if (_playerController != null) _playerController.enabled = true;
        }

        private void BuildRoomContent(string kind)
        {
            // 떼어 내고 끈 뒤 지운다 — `Destroy` 는 프레임 끝이라 같은 프레임에 다시 지으면 옛 적이 살아 있는 채로
            // 방에 섞여 센다(PROJECT_STATE 알려진 오류, 108 ③ 진단이 JumpToFloor 직후에 잡았다).
            for (int i = _contentRoot.childCount - 1; i >= 0; i--)
            {
                var old = _contentRoot.GetChild(i).gameObject;
                old.transform.SetParent(null, true);
                old.SetActive(false);
                UnityEngine.Object.Destroy(old);
            }

            switch (kind)
            {
                case "fight": SpawnFight(); break;
                case "elite": SpawnElite(); break;
                case "miniboss": SpawnSolo("황건 살수", new Color(0.24f, 0.04f, 0.4f), isBoss: true, withEscorts: false); break;
                case "boss": SpawnSolo("황건적 두목", new Color(0.45f, 0.08f, 0.08f), isBoss: true, withEscorts: true); break;
                case "trove": SpawnTrove(); break;
                case "well": SpawnWell(); break;
                case "shrine": SpawnShrine(); break;
                case "cave": SpawnVein(); break;
                case "merchant": SpawnMerchant(); break;
                case "puzzle": SpawnPuzzle(); break;
                case "event": SpawnCaptive(); break;
                case "forage": SpawnForage(); break;
                case DungeonLandmarkData.LordKind: SpawnLord(); break;
                default: SpawnFight(); break;
            }
        }

        /// <summary>진단 — 지금 층에 그 종류 방을 바로 짓는다(문 고르기 없이).</summary>
        public void BuildRoomForTest(string kind) => BuildRoomContent(kind);

        /// <summary>109-2 — 이 방 행상이 선 시대(진단).</summary>
        public DungeonEra LastPeddlerEra { get; private set; }

        // PLAN.md 109-10-3 시련(`TrialRunner`)이 같은 몸을 쓴다 — 없는 PC 는 null(부르는 쪽이 옛 몸으로).
        public GameObject GruntModel => gruntModel;
        public GameObject EliteModel => eliteModel;
        public (GameObject model, float scale) FusionEliteBody => (fusionEliteModel, fusionEliteModel != null ? fusionEliteScaleMul : 1f);
        public (GameObject model, float scale) LordBody => (lordModel, lordModel != null ? lordScaleMul : 1f);
        public (GameObject model, float scale) EraFoeBody(string body)
        {
            int k = EraFoeIndex(body);
            var model = k >= 0 && k < eraFoeModels.Length ? eraFoeModels[k] : null;
            return (model, model != null && k < eraFoeScaleMuls.Length ? eraFoeScaleMuls[k] : 1f);
        }

        /// <summary>PLAN.md 109-10-5 — 빌린 몸(없는 PC 는 null → 부르는 쪽이 옛 몸으로).</summary>
        public GameObject RegionBody(string body)
        {
            for (int i = 0; i < regionBodyNames.Length && i < regionBodyModels.Length; i++)
                if (regionBodyNames[i] == body) return regionBodyModels[i];
            return null;
        }

        /// <summary>진단 — 실린 빌린 몸 이름.</summary>
        public string[] RegionBodyNames => (string[])regionBodyNames.Clone();

        private int EraFoeIndex(string body)
        {
            for (int i = 0; i < eraFoeNames.Length; i++) if (eraFoeNames[i] == body) return i;
            return -1;
        }

        /// <summary>109-2 — 전투 방 잡졸 i 번째. 층 단계의 현대·미래 적이면 몸·이름·배율을 바꾸고 체력·공격·보상은 잡졸 그대로.</summary>
        private GameObject SpawnGrunt(Vector3 localOffset, int fightSlot)
        {
            DungeonEra era = _landmark >= 0 ? DungeonEra.Past : DungeonEras.GruntEra(_floor, _roomIndex, fightSlot);
            if (era == DungeonEra.Past) return SpawnGrunt(localOffset);
            var foe = DungeonEras.FoeFor(_floor, era);
            int k = EraFoeIndex(foe.Body);
            var model = k >= 0 && k < eraFoeModels.Length ? eraFoeModels[k] : null;
            float mul = model != null && k < eraFoeScaleMuls.Length ? eraFoeScaleMuls[k] : 1f;
            var go = new GameObject("Enemy_Floor_EraGrunt");
            go.SetActive(false);
            go.transform.SetParent(_contentRoot, false);
            go.transform.localPosition = localOffset;
            var enemy = go.AddComponent<DungeonEnemy>();
            enemy.SetSpawnContext(RoomId, model != null ? model : gruntModel);
            enemy.ConfigureCombat(
                DungeonFormulas.EnemyHp(_floor, false) * SigilState.EnemyHpMultiplier(_floor),
                DungeonFormulas.EnemyDmg(_floor, false) * SigilState.EnemyDamageMultiplier(_floor),
                DungeonFormulas.RewardExp(_floor, false), DungeonFormulas.RewardGold(_floor, false),
                "wp_axe", null, false, foe.NameKo,
                model != null ? Color.white : era == DungeonEra.Future ? EraFusionData.FusionBodyColor : new Color(0.3f, 0.34f, 0.3f), mul);
            go.SetActive(true);
            return go;
        }

        private GameObject SpawnGrunt(Vector3 localOffset)
        {
            var go = new GameObject("Enemy_Floor_Grunt");
            go.SetActive(false);
            go.transform.SetParent(_contentRoot, false);
            go.transform.localPosition = localOffset;
            var enemy = go.AddComponent<DungeonEnemy>();
            enemy.SetSpawnContext(RoomId, gruntModel);
            // PLAN.md 101-2 5.3 "부적 던전" 변형자 — 정상 층은 배율 1이라 그대로.
            enemy.ConfigureCombat(
                DungeonFormulas.EnemyHp(_floor, false) * SigilState.EnemyHpMultiplier(_floor),
                DungeonFormulas.EnemyDmg(_floor, false) * SigilState.EnemyDamageMultiplier(_floor),
                DungeonFormulas.RewardExp(_floor, false), DungeonFormulas.RewardGold(_floor, false),
                "wp_axe", null, false, _landmark >= 0 ? DungeonLandmarkData.GruntName(_landmark) : "황건적",
                new Color(0.72f, 0.64f, 0.3f), 1f);
            go.SetActive(true);
            return go;
        }

        private void SpawnFight()
        {
            for (int i = 0; i < GruntOffsets.Length; i++) SpawnGrunt(GruntOffsets[i], i);
        }

        private void SpawnElite()
        {
            var go = new GameObject("Enemy_Floor_Elite");
            go.SetActive(false);
            go.transform.SetParent(_contentRoot, false);
            go.transform.localPosition = SoloOffset;
            var enemy = go.AddComponent<DungeonEnemy>();

            // PLAN.md 101-2 5.7 "시대 퓨전" — 깊은 층부터 정예를 기계화
            // 변종으로 바꿔치기(짐승형 파생 규칙이 없는 이 트랙의 재해석,
            // EraFusionData.cs 클래스 주석 참고).
            bool fusion = EraFusionData.IsFusionFloor(_floor);
            bool mech = fusion && fusionEliteModel != null;
            enemy.SetSpawnContext(RoomId, mech ? fusionEliteModel : gruntModel);
            string rewardItem = fusion ? EraFusionData.FusionRewardItemId(_floor) : "wp_saber";
            string displayName = fusion ? "기계화 정찰병" : "폐허의 황건 정예";
            Color color = mech ? Color.white : fusion ? EraFusionData.FusionBodyColor : new Color(0.75f, 0.35f, 0.15f);

            enemy.ConfigureCombat(
                DungeonFormulas.EliteHp(_floor) * SigilState.EnemyHpMultiplier(_floor),
                DungeonFormulas.EliteDmg(_floor) * SigilState.EnemyDamageMultiplier(_floor),
                DungeonFormulas.EliteRewardExp(_floor), DungeonFormulas.EliteRewardGold(_floor),
                rewardItem, null, false, displayName,
                color, 1.25f * (mech ? fusionEliteScaleMul : 1f));
            go.SetActive(true);

            foreach (var offset in EscortOffsets) SpawnGrunt(SoloOffset + offset);
        }

        private void SpawnSolo(string displayName, Color color, bool isBoss, bool withEscorts)
        {
            var go = new GameObject($"Enemy_Floor_{(withEscorts ? "Boss" : "Miniboss")}");
            go.SetActive(false);
            go.transform.SetParent(_contentRoot, false);
            go.transform.localPosition = SoloOffset;
            var enemy = go.AddComponent<DungeonEnemy>();
            // 살수(미니보스)만 전용 몸 — 층 끝 두목은 원래 배역 Brute(황건적 두목) 그대로.
            bool assassin = !withEscorts && minibossModel != null;
            enemy.SetSpawnContext(RoomId, assassin ? minibossModel : eliteModel);
            // PLAN.md 101-2 5.4 "월드 보스" — withEscorts는 "boss" 종류(층 끝
            // 진짜 두목)에만 true라(미니보스는 false) 그대로 재사용한다.
            enemy.ConfigureCombat(
                DungeonFormulas.EnemyHp(_floor, true) * SigilState.EnemyHpMultiplier(_floor),
                DungeonFormulas.EnemyDmg(_floor, true) * SigilState.EnemyDamageMultiplier(_floor),
                DungeonFormulas.RewardExp(_floor, true), DungeonFormulas.RewardGold(_floor, true),
                "wp_greatblade", "gem_ruby", isBoss, displayName,
                assassin ? Color.white : color, withEscorts ? 2.0f : 1.8f * (assassin ? minibossScaleMul : 1f), newIsWorldBoss: withEscorts);
            go.SetActive(true);

            if (withEscorts)
            {
                foreach (var offset in EscortOffsets) SpawnGrunt(SoloOffset + offset);
            }
        }

        /// <summary>PLAN.md 108 ③ 층 주인 — 층 두목 공식 × <see cref="LordHpMul"/>, 호위 둘. 월드 보스 초읽기는 안 건다(명소는 쫓기는 싸움이 아니다).
        /// 첫 토벌 전이면 그 층 고유 무기를, 뒤로는 흑철중검을 떨군다.</summary>
        public const float LordHpMul = 1.15f;

        private void SpawnLord()
        {
            var lm = DungeonLandmarkData.All[_landmark];
            var go = new GameObject("Enemy_Floor_Lord");
            go.SetActive(false);
            go.transform.SetParent(_contentRoot, false);
            go.transform.localPosition = SoloOffset;
            var enemy = go.AddComponent<DungeonEnemy>();
            bool demon = lordModel != null;
            enemy.SetSpawnContext(RoomId, demon ? lordModel : eliteModel);
            enemy.ConfigureCombat(
                DungeonFormulas.EnemyHp(_floor, true) * LordHpMul * SigilState.EnemyHpMultiplier(_floor),
                DungeonFormulas.EnemyDmg(_floor, true) * SigilState.EnemyDamageMultiplier(_floor),
                DungeonFormulas.RewardExp(_floor, true), DungeonFormulas.RewardGold(_floor, true),
                LandmarkState.IsCleared(_landmark) ? "wp_greatblade" : lm.RewardItemId, "gem_ruby", true,
                DungeonLandmarkData.LordName(_landmark),
                demon ? Color.Lerp(Color.white, lm.LordColor, LordTintMix) : lm.LordColor, 2.1f * (demon ? lordScaleMul : 1f));
            enemy.SetIntroSubtitle(string.Format(DungeonLocalization.T("cut.lord_sub", "{0}의 주인"), DungeonLandmarkData.Name(_landmark)));
            go.SetActive(true);
            _lord = enemy;
            foreach (var offset in EscortOffsets) SpawnGrunt(SoloOffset + offset);
        }

        private void SpawnTrove()
        {
            var go = new GameObject("Trove");
            go.transform.SetParent(_contentRoot, false);
            go.transform.localPosition = PoiAnchor;
            go.AddComponent<DungeonTrove>();
        }

        private void SpawnWell()
        {
            var go = new GameObject("Well");
            go.transform.SetParent(_contentRoot, false);
            go.transform.localPosition = PoiAnchor;
            go.AddComponent<DungeonWell>();
        }

        private void SpawnShrine()
        {
            var go = new GameObject("Shrine");
            go.transform.SetParent(_contentRoot, false);
            go.transform.localPosition = PoiAnchor;
            go.AddComponent<DungeonShrine>();
        }

        private void SpawnVein()
        {
            var go = new GameObject("Vein");
            go.transform.SetParent(_contentRoot, false);
            go.transform.localPosition = PoiAnchor;
            var vein = go.AddComponent<DungeonVein>();
            vein.SetRoomId(RoomId);
        }

        private void SpawnMerchant()
        {
            var go = new GameObject("Merchant");
            go.SetActive(false); // Awake 전에 모델을 넣는다(DungeonEnemy.SetSpawnContext 와 같은 결).
            go.transform.SetParent(_contentRoot, false);
            go.transform.localPosition = PoiAnchor;
            var merchant = go.AddComponent<DungeonMerchant>();
            merchant.Configure(RoomId, "wp_saber", null, 45);
            // 109-2 — 행상도 약 40% 가 현대(고물 행상)·미래(시간 행상) 몸. 없는 PC 는 옛 몸.
            LastPeddlerEra = DungeonEras.PeddlerEra(_floor, _roomIndex);
            var peddler = LastPeddlerEra == DungeonEra.Modern ? modernPeddlerModel : LastPeddlerEra == DungeonEra.Future ? futurePeddlerModel : null;
            merchant.SetModel(peddler != null ? peddler : merchantModel);
            go.SetActive(true);
        }

        private void SpawnPuzzle()
        {
            var go = new GameObject("Puzzle");
            go.transform.SetParent(_contentRoot, false);
            go.transform.localPosition = PoiAnchor;
            go.AddComponent<DungeonPuzzle>();
        }

        private void SpawnCaptive()
        {
            var go = new GameObject("Captive");
            go.SetActive(false);
            go.transform.SetParent(_contentRoot, false);
            go.transform.localPosition = SoloOffset;
            var captive = go.AddComponent<DungeonCaptive>();
            captive.SetRoomId(RoomId);
            captive.SetModel(captiveModel);
            go.SetActive(true);

            foreach (var offset in EscortOffsets) SpawnGrunt(SoloOffset + offset);
        }

        private void SpawnForage()
        {
            var go = new GameObject("Forage");
            go.transform.SetParent(_contentRoot, false);
            go.transform.localPosition = PoiAnchor;
            var forage = go.AddComponent<DungeonForage>();
            forage.SetRoomId(RoomId);
        }

        /// <summary>`DamagePopup.cs`와 같은 결 — 문 라벨을 항상 카메라 쪽으로.</summary>
        private class DoorLabelBillboard : MonoBehaviour
        {
            private Camera _cam;
            private void Awake() => _cam = Camera.main;
            private void Update() { if (_cam != null) transform.rotation = _cam.transform.rotation; }
        }
    }
}
