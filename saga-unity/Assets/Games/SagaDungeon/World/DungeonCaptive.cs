using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using Saga.Core;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md 다음 슬라이스 "방 종류 마지막" — saga-dungeon
    /// 웹판 `room.captive`(이벤트방, PLAN 35절 "NPC Rescue", js/dungeon.js:383-393,
    /// 2203-2221)를 옮겼다: 지키는 잡졸을 다 치우면 풀려나 노획물을 준다.
    /// 웹판은 은사(boon)를 고르지 않고 바로 하나 얹는데, 은사 시스템 자체가
    /// 이번 슬라이스 범위 밖(`DungeonShrine.cs`가 이미 같은 이유로 뺐다)이라
    /// 그 자리를 `DungeonShrine.cs`와 같은 단순화(경험치 지급)로 대신했다 —
    /// 다만 "받은 은혜"가 사당의 정식 가호보다는 가볍다는 뜻으로 경험치는
    /// 더 작게 잡았다(성소 30 → 구출 15). 노획물(`dropItem`·`dropGold`)은
    /// 돈으로 옮겼다(퀄리티 16→돈 16, 트로브·성소가 이미 쓴 "잡졸 보상(8)
    /// 배율" 환산과 같은 결).
    /// </summary>
    public class DungeonCaptive : MonoBehaviour
    {
        private const float TriggerRadius = 2.0f;
        private const int RewardExp = 15;
        private const int RewardGold = 16;
        private const float ToastSec = 4f;

        [SerializeField] private string roomId = "room1";
        // PLAN.md 106-4 — 사실 모델(Peasant Girl, 무릎 꿇은 대기 → 풀려나면 기쁜 대기). 없으면 예전 캡슐.
        [SerializeField] private GameObject modelPrefab;

        private static readonly Color CaptiveColor = new Color(0.75f, 0.72f, 0.6f); // 지친 인영 — 옅은 살구빛

        private bool _freed;
        private Transform _player;

        /// <summary>"DUNGEON 오픈월드 확장 — 절차적 층 진행" 슬라이스 —
        /// `DungeonFloorRunner`가 런타임에 즉석으로 만든 POI에 값을 채우는
        /// 정식 API. Awake가 아직 안 돈 상태에서만 의미가 있다.</summary>
        public void SetRoomId(string newRoomId) => roomId = newRoomId;

        /// <summary>`SetRoomId` 와 같은 제약 — 비활성 GameObject 에 붙이고 부른 뒤 활성화한다.</summary>
        public void SetModel(GameObject newModelPrefab) => modelPrefab = newModelPrefab;

        public bool IsFreed => _freed;

        /// <summary>PLAN.md 109-16 시나리오 `rescue` 단계 — 갇힌 인물을 구했을 때(어느 층이든).</summary>
        public static event System.Action Freed;

        private void Awake()
        {
            if (transform.childCount == 0) BuildVisual();
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void BuildVisual()
        {
            if (NpcIdle.SpawnRigged(modelPrefab, transform, "Kneel") != null) return;

            var visual = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            visual.name = "Visual";
            visual.transform.SetParent(transform, false);
            visual.transform.localScale = new Vector3(0.6f, 0.7f, 0.6f); // 웅크린 사람 — 보통 캐릭터보다 낮다
            visual.transform.localPosition = new Vector3(0f, 0.6f, 0f);

            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "DungeonCaptive (generated)" };
            mat.color = CaptiveColor;
            visual.GetComponent<MeshRenderer>().sharedMaterial = mat;

            Object.Destroy(visual.GetComponent<Collider>());
        }

        private void Update()
        {
            if (_freed || _player == null) return;
            if (DungeonEnemy.CountAliveInRoom(roomId) > 0) return; // 웹판 room.cleared와 같은 뜻 — 지킴이를 다 치워야.
            if (Vector3.Distance(transform.position, _player.position) > TriggerRadius) return;

            _freed = true;
            var idle = GetComponent<NpcIdle>();
            if (idle != null)
            {
                idle.SetState("Idle"); // 일어나 기뻐한다.
                Vector3 look = _player.position - transform.position;
                look.y = 0f;
                if (look.sqrMagnitude > 0.01f) transform.rotation = Quaternion.LookRotation(look);
            }
            int levelBefore = HeroState.Level;
            HeroState.AddExp(RewardExp);
            HeroState.AddGold(RewardGold);
            string msg = string.Format(DungeonLocalization.T("captive.rescued_reward", "구출 · 은혜를 갚는다 — 경험치 +{0} · 돈 +{1}냥"), RewardExp, RewardGold);
            if (HeroState.Level > levelBefore) msg += string.Format(DungeonLocalization.T("combat.levelup_suffix", " — 레벨업! ({0} → {1})"), levelBefore, HeroState.Level);
            DialogueLabel.Instance?.Show(msg, ToastSec);
            QuestState.MarkCaptiveFreed(); // "퀘스트 시스템" 슬라이스 — 메인 퀘스트 마지막 단계.
            Freed?.Invoke();
        }
    }
}
