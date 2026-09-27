using UnityEngine;
using Saga.Core;
using Saga.Dungeon.Audio;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// SagaGo의 World/GameBootstrap.cs와 같은 역할(네임스페이스만 변경)
    /// — 씬이 다 올라온 뒤 저장 파일이 있으면 캐릭터 상태·위치를 되돌린다.
    /// "퀘스트 시스템" 슬라이스 — QuestState는 NPC 발주자 없이 순수
    /// 폴링으로 진행을 감지해(Data/QuestState.cs 참고) 매 프레임 확인할
    /// 곳이 필요한데, 새 GameObject를 늘리지 않고 이미 씬에 하나뿐인 이
    /// 컴포넌트의 Update()에 얹었다.
    /// </summary>
    public class GameBootstrap : MonoBehaviour
    {
        // 2026-09-14 "사운드" 실클립 전환 — SfxPlayer.cs 클래스 주석 참고.
        [SerializeField] private AudioClip hitClip;
        [SerializeField] private AudioClip heavyHitClip;
        [SerializeField] private AudioClip enemyDeathClip;
        [SerializeField] private AudioClip levelUpClip;
        [SerializeField] private AudioClip discoveryClip;
        [SerializeField] private AudioClip bgmClip; // 67장 "사운드" BGM(2026-09-15).

        private CameraRig _cameraRig;

        // PLAN.md 101-2 5.1 "축복 3택"(2026-09-19) — 보스층 진입 이벤트에 얹는다.
        private BlessingChoiceUi _blessingChoiceUi;

        // PLAN.md 101-2 5.2 "유품"(2026-09-19) — 사망 시 세션 카드로 죽음을 요약한다.
        private SessionCard _sessionCard;

        private void Start()
        {
            SfxPlayer.Configure(hitClip, heavyHitClip, enemyDeathClip, levelUpClip, discoveryClip, bgmClip);
            SaveState.TryLoad();
            Saga.Core.SagaFlow.Enter("dungeon", SaveState.Save); // PLAN.md 110 ② — 자동 저장·일시정지 메뉴·타이틀로.
            CombineStaticBatches();
            DungeonSettingsState.ApplyToAllScalers();
            DungeonSettingsState.ApplyGraphicsQuality();
            QuestState.StageCompleted += OnQuestStageCompleted;
            HeroState.LeveledUp += OnLeveledUp; // "사운드" 슬라이스 — PLAN.md 37장, 레벨업 신호음.
            HeroState.Died += OnHeroDied;
            _cameraRig = Object.FindFirstObjectByType<CameraRig>(); // 101-3 G "성장 연출"용.
            _blessingChoiceUi = Object.FindFirstObjectByType<BlessingChoiceUi>();
            _sessionCard = Object.FindFirstObjectByType<SessionCard>();
            // PLAN.md 109-10 비결 패널 — Play 때 짓는다(씬 재빌드 없이, 공격 버튼이 이미 있는 뒤라 딱지도 붙는다).
            if (Object.FindFirstObjectByType<SecretPanelUi>() == null) new GameObject("SecretPanelUI").AddComponent<SecretPanelUi>();
            TrialRunner.Install(); // PLAN.md 109-10-3 시련 — 난입 방에 러너, 난입 표식 곁에 표식, 단계 카드(Play 때, 씬 재빌드 없이).
            DungeonRegionTracker.Install(); // PLAN.md 109-10-4 지역 아홉 — 들어섬 배너·바닥 땅빛(Play 때, 씬 재빌드 없이).
            RegionBossRunner.Install(); // PLAN.md 109-10-5 지역 우두머리 아홉 — 칸마다 표식(Play 때, 몸만 층 진행기에).
            RegionSagaRunner.Install(); // PLAN.md 109-10-6 지역 사연 — 흔적·사냥터(Play 때).
            GestureRunner.Install(); // PLAN.md 109-10-7 몸짓 — 촌민에 붙이고 레벨업·두목급 처치 → 동행 환호(Play 때).
            if (DungeonFloorRunner.Instance != null) DungeonFloorRunner.Instance.FloorDescended += OnFloorDescended;
        }

        private void OnDestroy()
        {
            QuestState.StageCompleted -= OnQuestStageCompleted;
            HeroState.LeveledUp -= OnLeveledUp;
            HeroState.Died -= OnHeroDied;
            if (DungeonFloorRunner.Instance != null) DungeonFloorRunner.Instance.FloorDescended -= OnFloorDescended;
        }

        /// <summary>PLAN.md 101-2 5.2 "유품" — 웹판 "사망 화면 = 세션 카드"를
        /// 이 트랙 표준 `SessionCard`(101-2 B)로 그대로 잇는다(GoalBoard용
        /// UI를 새로 안 만든다). `PlayerCombat.OnDied()`가 애니메이션·마커를
        /// 맡고, 여기는 요약 카드만.</summary>
        private void OnHeroDied(int lostGold)
        {
            // PLAN.md 101-2 5.5 "난입" — 난입 중 사망은 HordeRunner가 자기
            // 결과 카드(파도·처치·보상)를 따로 띄운다(같은 이벤트를 같이
            // 구독한다, `HordeRunner.OnHeroDiedDuringHorde` 참고) — 이
            // 기본 "쓰러졌다" 카드로 덮이면 안 된다.
            if (HordeRunner.Instance != null && HordeRunner.Instance.IsActive) return;
            if (TrialRunner.Busy) return; // PLAN.md 109-10-3 — 시련은 쓰러져도 안 끝난다(−30초, TrialRunner 가 알린다).

            string lostLine = lostGold > 0
                ? string.Format(DungeonLocalization.T("grave.card_lost", "유품으로 금 {0} — 돌아가기 전에 되찾을 것"), lostGold)
                : DungeonLocalization.T("grave.card_lost_none", "잃은 것 없음");
            _sessionCard?.Show(DungeonLocalization.T("grave.card_title", "쓰러졌다"), lostLine);
        }

        private void OnFloorDescended(int floor)
        {
            if (!DungeonFormulas.IsBossFloor(floor)) return;
            // 이미 카드가 떠 있으면 새로 안 띄운다(PerkChoiceUi.cs와 같은 방어).
            if (_blessingChoiceUi == null || _blessingChoiceUi.IsShowing) return;

            var offer = BlessingState.RollChoice();
            _blessingChoiceUi.Show(offer, BlessingState.Choose, () => BlessingState.Reject(floor));
        }

        private void OnLeveledUp(int newLevel)
        {
            SfxPlayer.PlayLevelUp();
            _cameraRig?.PlayLevelUpCut(); // PLAN.md 101-3 G "성장 연출".
        }

        private void Update()
        {
            QuestState.Poll();
        }

        private void OnQuestStageCompleted(QuestState.Stage stage, string message)
        {
            DialogueLabel.Instance?.Show(message, 5f);
        }

        /// <summary>PLAN.md 76장 Mobile Performance Pass — Room은 Awake()에서
        /// 매번 새로 만드는 메시라 빌드타임 정적 배칭 대상이 아니다.</summary>
        private void CombineStaticBatches()
        {
            var root = GameObject.Find("Room");
            if (root != null)
            {
                StaticBatchingUtility.Combine(root);
            }
        }
    }
}
