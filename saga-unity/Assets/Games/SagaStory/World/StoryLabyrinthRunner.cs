using System.Collections.Generic;
using UnityEngine;
using Saga.Story.Data;
using Saga.Story.UI;

namespace Saga.Story.World
{
    /// <summary>
    /// PLAN.md 101-2 STORY "5-3 비경" 실행기 — 노드 지도 선택에 따라 실제로
    /// 무엇을 하는지 처리한다.
    ///
    /// **재해석 — 실행 방식.** godot은 완전히 새 3D 씬(`StoryLabyrinth.tscn`)에
    /// 5층 발판 지도를 짓지만, 이 트랙은 필드 전체가 고정 좌표
    /// (`FieldMapData`) 기반이고 경계벽이 필드 폭만 막고 있어
    /// (`StoryTerrainBuilder.BuildBoundaryWalls`) 그 안에 새 구역을 끼워
    /// 넣을 자리가 없다 — 노드 지도 자체는 **풀스크린 UI**
    /// (`StoryLabyrinthMapUi`, 슬레이 더 스파이어 식)로 다루고, 실제
    /// 전투가 필요한 노드(전투·정예·보스)만 필드 밖 멀리(x=1000~) 지어
    /// 둔 **전용 아레나**로 순간이동시켜 실제 `StoryEnemy`를 스폰해
    /// 싸운다(보물·휴식·사건 노드는 자리 이동 없이 즉시 판정). 판정 엔진
    /// (`StoryEnemy`/`StoryCombat`)은 필드와 완전히 같은 것을 그대로
    /// 재사용한다(웹판 "판정은 side.js 사냥터 엔진 재사용"과 같은 정신).
    ///
    /// **재해석 — 죽음.** 이 트랙 플레이어는 피격당하지 않아
    /// (`StoryCombat.cs` StartHp 주석) HP 기반 죽음 자체가 없다 — 대신
    /// **노드 제한시간**을 진짜 위협으로 세운다(PLAN 원안 "층당 전투
    /// 40~60s 목표"를 강제 실패 조건으로 승격). 시간 안에 못 끝내면 그
    /// 회차가 끝난다(이미 확정된 기억 조각은 유지, 축복·더 앞선 진행은
    /// 사라진다) — godot의 "패퇴"(hp&lt;=0 관찰)와 결과는 같고 판정 축만
    /// 다르다. PLAN.md 109-11-1(2026-09-27) 부터는 플레이어 체력이 생겨(두목 패턴이 때린다)
    /// 쓰러져도 같은 패퇴다(`OnPlayerFell`).
    /// </summary>
    public class StoryLabyrinthRunner : MonoBehaviour
    {
        public static StoryLabyrinthRunner Instance { get; private set; }

        private const float ArenaOriginX = 1000f;
        private const float ArenaWidth = 24f;
        private const float ArenaDepth = 4f;
        private const float GroundY = 0f;
        private static readonly Color ArenaGroundColor = new Color(0.32f, 0.22f, 0.42f); // 비경 특유의 보랏빛.

        private const float CombatTimeLimitSec = 50f; // PLAN 원안 "층당 전투 40~60s 목표"의 상한.
        private const float EliteTimeLimitSec = 60f;
        private const float BossTimeLimitSec = 90f;
        private const float EliteHpMul = 2f;
        private const float EliteExpMul = 1.5f;
        private const float BossLabyrinthHpMul = 1.5f; // 관문 대장(챔피언 ×2.5)과 안 겹치는 별개 채널 — 이 보스는 챔피언이 아니다.

        [SerializeField] private GameObject gruntModelPrefab; // BuildTestStoryScene.cs가 필드 잡졸과 같은 모델을 채운다.
        [SerializeField] private GameObject bossModelPrefab;
        [SerializeField] private float riggedVisualScale = 1f;
        [SerializeField] private float riggedBossVisualScale = 1f;
        [SerializeField] private AudioClip hitClip;
        [SerializeField] private AudioClip deathClip;
        // PLAN.md 109-3 세 시대 — 필드 `StoryEnemySpawner` 와 같은 표(이름 순 몸·배율). 없는 PC 는 null → 잡졸 몸.
        [SerializeField] private string[] eraFoeNames = new string[0];
        [SerializeField] private GameObject[] eraFoeModels = new GameObject[0];
        [SerializeField] private float[] eraFoeScales = new float[0];
        /// <summary>이번 회차에 시작한 전투 노드 수 — 시대 해시의 한 축(회차마다 0 부터, 같은 씨앗이면 같은 적).</summary>
        private int _combatCount;
        public int CombatCount => _combatCount;

        private Vector3 _returnPosition;
        private readonly List<StoryEnemy> _arenaEnemies = new List<StoryEnemy>();
        private bool _nodeActive;
        private float _nodeTimeLeft;
        private StoryLabyrinthData.NodeType _currentNodeType;
        private System.Action _onNodeCleared;

        public bool NodeActive => _nodeActive;
        public float NodeTimeLeft => _nodeTimeLeft;
        public IReadOnlyList<StoryEnemy> ActiveArenaEnemies => _arenaEnemies;
        /// <summary>PLAN.md 109-11-1 — 비경 두목 패턴(낙석·휩쓸기·부르기)이 방 밖에 안 떨어지게.</summary>
        public const float ArenaMinX = ArenaOriginX;
        public const float ArenaMaxX = ArenaOriginX + ArenaWidth;

        /// <summary>PLAN.md 109-11-1 — 비경 두목이 부른 부하도 방 적으로 센다(다 쓰러뜨려야 방이 끝난다). 체력은 방 잡졸과 같은 배율.</summary>
        public void AddArenaEnemy(StoryEnemy enemy)
        {
            if (enemy == null || !_nodeActive) return;
            enemy.ApplyLabyrinthHpMul(StoryLabyrinthState.CurrentWeeklyVariant.EnemyHpMul * PlayerPowerHpMul());
            _arenaEnemies.Add(enemy);
        }

        /// <summary>PLAN.md 109-11-1 — 체력이 다해 쓰러지면 시간 초과와 같은 패퇴(재기가 있으면 그 방을 다시).</summary>
        public void OnPlayerFell()
        {
            if (_nodeActive) FailNode(fell: true);
        }

        private void Awake()
        {
            Instance = this;
            if (transform.Find("ArenaGround") == null) BuildArena();
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        private void Update()
        {
            if (!_nodeActive) return;

            // Destroy()는 실제 파괴를 프레임 끝으로 미루므로(StoryEnemy.IsDead
            // 클래스 주석과 같은 함정) `e == null`만으론 방금 죽은 개체를
            // 같은 프레임에 못 걸러낸다 — IsDead 플래그를 같이 본다.
            _arenaEnemies.RemoveAll(e => e == null || e.IsDead);
            if (_arenaEnemies.Count == 0)
            {
                CompleteNode();
                return;
            }

            _nodeTimeLeft -= Time.deltaTime;
            if (_nodeTimeLeft <= 0f) FailNode();
        }

        private void BuildArena()
        {
            var ground = GameObject.CreatePrimitive(PrimitiveType.Cube);
            ground.name = "ArenaGround";
            ground.transform.SetParent(transform, false);
            ground.transform.localPosition = new Vector3(ArenaOriginX + ArenaWidth * 0.5f, -0.2f, 0f);
            ground.transform.localScale = new Vector3(ArenaWidth, 0.4f, ArenaDepth);
            ground.GetComponent<MeshRenderer>().sharedMaterial = MakeMaterial(ArenaGroundColor);

            BuildWall(ArenaOriginX - 0.5f);
            BuildWall(ArenaOriginX + ArenaWidth + 0.5f);
        }

        private void BuildWall(float x)
        {
            var go = new GameObject("ArenaWall");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = new Vector3(x, 10f, 0f);
            var col = go.AddComponent<BoxCollider>();
            col.size = new Vector3(1f, 20f, ArenaDepth);
        }

        private static Material MakeMaterial(Color color)
        {
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "StoryLabyrinthArena (generated)" };
            mat.color = color;
            return mat;
        }

        /// <summary>`StoryLabyrinthGate.cs` 전용 — 회차 시작(씨앗은 실행
        /// 시각 기준).</summary>
        public void StartRun()
        {
            if (StoryLabyrinthState.InRun) return;
            RememberReturnPosition();
            _combatCount = 0;
            StoryLabyrinthState.StartRun(System.Environment.TickCount);
            StoryLabyrinthMapUi.Instance?.ShowEntryBlessing(() => StoryLabyrinthMapUi.Instance?.ShowFloor());
        }

        /// <summary>PlaytestStorySlice.cs 전용 — 지도 진단이 씨앗을 고정해
        /// 결정성을 확인할 수 있게 한다(UI를 안 거친다).</summary>
        public void StartRunWithSeed(int seed)
        {
            RememberReturnPosition();
            _combatCount = 0;
            StoryLabyrinthState.StartRun(seed);
        }

        private void RememberReturnPosition()
        {
            var player = GameObject.FindWithTag("Player");
            if (player != null) _returnPosition = player.transform.position;
        }

        /// <summary>노드 하나를 시작한다 — 전투류(Combat/Elite/Boss)는
        /// 아레나로 순간이동시켜 실제로 싸우게 하고, 그 외(Treasure/Rest/
        /// Event)는 즉시 판정한다.</summary>
        public void EnterNode(StoryLabyrinthData.NodeType type, System.Action onCleared)
        {
            _currentNodeType = type;
            _onNodeCleared = onCleared;

            switch (type)
            {
                case StoryLabyrinthData.NodeType.Treasure: ResolveTreasure(); break;
                case StoryLabyrinthData.NodeType.Rest: ResolveRest(); break;
                case StoryLabyrinthData.NodeType.Event: ResolveEvent(); break;
                default: StartCombatNode(type); break;
            }
        }

        private void ResolveTreasure()
        {
            int shards = Mathf.RoundToInt(1 * StoryLabyrinthState.ShardRewardMul);
            StoryLabyrinthState.AddShards(shards);
            StoryJobState.GainExp(StoryCombat.GruntExp);
            DialogueLabel.Instance?.Show(
                string.Format(StoryLocalization.T("labyrinth.treasure", "💰 보물 노드 — 기억 조각 +{0}"), shards), 3f);
            InvokeCleared();
        }

        private void ResolveRest()
        {
            StoryCombat.RestoreMp(StoryCombat.MpMaxCurrent);
            DialogueLabel.Instance?.Show(StoryLocalization.T("labyrinth.rest", "🏕 휴식 노드 — 기력을 전부 회복했다"), 3f);
            InvokeCleared();
        }

        private void ResolveEvent()
        {
            bool success = Random.value < 0.5f;
            if (success)
            {
                StoryJobState.GainExp(StoryCombat.GruntExp * 1.5f);
                DialogueLabel.Instance?.Show(StoryLocalization.T("labyrinth.event_good", "📜 사건 노드 — 뜻밖의 도움을 받아 경험을 얻었다"), 3f);
            }
            else
            {
                DialogueLabel.Instance?.Show(StoryLocalization.T("labyrinth.event_neutral", "📜 사건 노드 — 별일 없이 지나갔다"), 3f);
            }
            InvokeCleared();
        }

        private void InvokeCleared()
        {
            var onCleared = _onNodeCleared;
            _onNodeCleared = null;
            onCleared?.Invoke();
        }

        private void StartCombatNode(StoryLabyrinthData.NodeType type)
        {
            var player = GameObject.FindWithTag("Player");
            if (player == null) return;

            if (StoryLabyrinthState.MpShieldOnEntry) StoryCombat.RestoreMp(StoryCombat.MpMaxCurrent);

            TeleportPlayer(player, new Vector3(ArenaOriginX + 2f, GroundY + 0.1f, 0f));

            foreach (var old in _arenaEnemies) if (old != null) Destroy(old.gameObject);
            _arenaEnemies.Clear();

            float weeklyHpMul = StoryLabyrinthState.CurrentWeeklyVariant.EnemyHpMul;
            bool boss = type == StoryLabyrinthData.NodeType.Boss;
            int count = type == StoryLabyrinthData.NodeType.Elite || boss ? 1 : 2;
            bool plain = count == 2; // 109-3 — 보통 전투 잡졸만 세 시대(정예·보스는 그대로).
            int combat = _combatCount++;
            int tier = StoryEras.Tier(StoryLabyrinthState.Floor);
            for (int i = 0; i < count; i++)
            {
                float x = ArenaOriginX + 6f + i * 5f;

                // Awake()가 AddComponent 즉시(동기) 실행되므로(플레이 중
                // 런타임 스폰 — 에디터 빌드 스크립트의 edit-time 순서와
                // 다르다) isBoss/isLabyrinthEnemy/modelPrefab 등을 Awake
                // 전에 못 박아야 한다. 비활성 상태로 만들어 필드를 채운
                // 뒤 마지막에 SetActive(true)로 Awake를 미룬다.
                var go = new GameObject(boss ? "LabyrinthBoss" : "LabyrinthEnemy");
                go.SetActive(false);
                go.transform.SetParent(transform, false);
                go.transform.position = new Vector3(x, GroundY, 0f);

                var enemy = go.AddComponent<StoryEnemy>();
                if (boss) enemy.SetBoss(true);
                enemy.SetLabyrinthEnemy(true);
                GameObject model = gruntModelPrefab;
                float scale = riggedVisualScale;
                var era = plain ? StoryEras.LabyrinthEra(StoryLabyrinthState.Floor, combat, i) : StoryEra.Past;
                if (era != StoryEra.Past)
                {
                    var foe = StoryEras.FoeFor(tier, era);
                    enemy.SetEra(foe);
                    int k = System.Array.IndexOf(eraFoeNames, foe.Body);
                    if (k >= 0 && k < eraFoeModels.Length && eraFoeModels[k] != null)
                    {
                        model = eraFoeModels[k];
                        scale = k < eraFoeScales.Length ? eraFoeScales[k] : 1f;
                    }
                }
                SetPrivate(enemy, "modelPrefab", model);
                SetPrivate(enemy, "riggedVisualScale", scale);
                SetPrivate(enemy, "hitClip", hitClip);
                SetPrivate(enemy, "deathClip", deathClip);
                if (boss)
                {
                    SetPrivate(enemy, "bossModelPrefab", bossModelPrefab);
                    SetPrivate(enemy, "riggedBossVisualScale", riggedBossVisualScale);
                }

                go.SetActive(true); // 여기서 Awake() 실행 — _hp가 원본값으로 잡힌다.
                enemy.ApplyLabyrinthHpMul(ExtraHpMulFor(type) * weeklyHpMul * PlayerPowerHpMul());
                _arenaEnemies.Add(enemy);
            }

            float baseLimit = type switch
            {
                StoryLabyrinthData.NodeType.Elite => EliteTimeLimitSec,
                StoryLabyrinthData.NodeType.Boss => BossTimeLimitSec,
                _ => CombatTimeLimitSec,
            };
            _nodeTimeLeft = baseLimit * StoryLabyrinthState.TimeLimitMul;
            _nodeActive = true;
        }

        /// <summary>5-2 2단계(2026-09-23, 사용자 결정 "경험치만 키우기") — 웹판 적 체력
        /// 18×1.22^(lv−1)을 그대로 쓰면 이 트랙은 플레이어 공격력이 레벨로 안 올라(웹판은
        /// 장비·인물로 오른다) Lv.13 무렵부터 보스를 제한시간 안에 못 잡는다. 대신 **기본
        /// 공격력이 시작값보다 늘어난 비율**(전직 grow·기억 조각 영구 강화)만큼만 적도
        /// 단단해진다 — 잡는 데 걸리는 시간이 레벨과 상관없이 비슷하게 남는다. 회차 중
        /// 축복·강화 버프·동료 교대 배율은 안 넣는다(그걸 고른 보람이 사라지므로).</summary>
        public static float PlayerPowerHpMul() =>
            (StoryCombat.StartAtk + StoryJobState.AtkBonus + StoryLabyrinthState.MemoryAtkBonus) / StoryCombat.StartAtk;

        private static float ExtraHpMulFor(StoryLabyrinthData.NodeType type) => type switch
        {
            StoryLabyrinthData.NodeType.Elite => EliteHpMul,
            StoryLabyrinthData.NodeType.Boss => BossLabyrinthHpMul,
            _ => 1f,
        };

        private void CompleteNode()
        {
            _nodeActive = false;
            var type = _currentNodeType;

            int shards = type == StoryLabyrinthData.NodeType.Boss ? 3 : 1;
            shards = Mathf.RoundToInt(shards * StoryLabyrinthState.ShardRewardMul);
            StoryLabyrinthState.AddShards(shards);

            // StoryEnemy.Die()는 isLabyrinthEnemy면 경험치를 자기가 안
            // 주므로(StoryEnemy.cs 클래스 주석) 여기서 노드 종류별 정확한
            // 총량을 한 번에 준다 — Combat은 잡졸 둘(StartCombatNode count=2).
            // 5-2 2단계(2026-09-23, 사용자 결정) — 비경 적은 플레이어 레벨을 lv로 받는다
            // (웹판 식 그대로, StoryCombat.EnemyExp 주석). lv=1이면 예전 고정값과 같다.
            int lv = StoryJobState.Level;
            float exp = type switch
            {
                StoryLabyrinthData.NodeType.Combat => StoryCombat.EnemyExp(lv, false) * 2f,
                StoryLabyrinthData.NodeType.Elite => StoryCombat.EnemyExp(lv, false) * EliteExpMul,
                StoryLabyrinthData.NodeType.Boss => StoryCombat.EnemyExp(lv, true),
                _ => 0f,
            };
            if (exp > 0f) StoryJobState.GainExp(exp);

            var player = GameObject.FindWithTag("Player");
            if (player != null) TeleportPlayer(player, _returnPosition);

            DialogueLabel.Instance?.Show(
                string.Format(StoryLocalization.T("labyrinth.node_clear", "⚔️ 노드 클리어 — 기억 조각 +{0}"), shards), 3f);

            var onCleared = _onNodeCleared;
            _onNodeCleared = null;
            if (type == StoryLabyrinthData.NodeType.Elite)
            {
                StoryLabyrinthMapUi.Instance?.ShowEliteBlessing(onCleared);
            }
            else
            {
                onCleared?.Invoke();
            }
        }

        private void FailNode(bool fell = false)
        {
            _nodeActive = false;
            foreach (var e in _arenaEnemies) if (e != null) Destroy(e.gameObject);
            _arenaEnemies.Clear();

            if (StoryLabyrinthState.ConsumeExtraLifeIfAvailable())
            {
                DialogueLabel.Instance?.Show(fell
                    ? StoryLocalization.T("labyrinth.regroup_fell", "💀 쓰러졌다 — 재기(再起)로 다시 도전한다")
                    : StoryLocalization.T("labyrinth.regroup", "⏱ 시간 초과 — 재기(再起)로 다시 도전한다"), 3f);
                StartCombatNode(_currentNodeType);
                return;
            }

            var player = GameObject.FindWithTag("Player");
            if (player != null) TeleportPlayer(player, _returnPosition);
            int shards = StoryLabyrinthState.MemoryShards; // 실패해도 이미 얻은 기억 조각은 안 사라진다(클래스 주석 "재해석 — 죽음" 참고).
            int floor = StoryLabyrinthState.Floor;
            StoryLabyrinthState.EndRun();
            DialogueLabel.Instance?.Show(
                string.Format(fell
                    ? StoryLocalization.T("labyrinth.failed_fell", "💀 쓰러졌다 — {0}층에서 회차가 끝났다(기억 조각은 남는다, 보유 {1})")
                    : StoryLocalization.T("labyrinth.failed", "💀 패퇴 — {0}층에서 회차가 끝났다(기억 조각은 남는다, 보유 {1})"), floor, shards), 4f);
            StoryLabyrinthMapUi.Instance?.Close();
        }

        public void AbandonRun()
        {
            if (!StoryLabyrinthState.InRun) return;
            foreach (var e in _arenaEnemies) if (e != null) Destroy(e.gameObject);
            _arenaEnemies.Clear();
            _nodeActive = false;
            var player = GameObject.FindWithTag("Player");
            if (player != null) TeleportPlayer(player, _returnPosition);
            StoryLabyrinthState.EndRun();
            DialogueLabel.Instance?.Show(StoryLocalization.T("labyrinth.abandon", "🚪 비경에서 물러났다"), 3f);
        }

        public void CompleteRun()
        {
            StoryLabyrinthState.EndRun();
            StoryScenario.OnRiftCleared(); // PLAN.md 109-16 — 시나리오 rift 단계(이 단계가 시작된 뒤 한 번 끝까지)
            var player = GameObject.FindWithTag("Player");
            if (player != null) TeleportPlayer(player, _returnPosition);
            DialogueLabel.Instance?.Show(StoryLocalization.T("labyrinth.cleared", "🏆 비경 클리어! 관문의 주인을 넘어섰다"), 4f);
        }

        private static void TeleportPlayer(GameObject player, Vector3 position)
        {
            var controller = player.GetComponent<CharacterController>();
            if (controller != null) controller.enabled = false;
            player.transform.position = position;
            if (controller != null) controller.enabled = true;
        }

        private static void SetPrivate(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName,
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            field?.SetValue(target, value);
        }
    }
}
