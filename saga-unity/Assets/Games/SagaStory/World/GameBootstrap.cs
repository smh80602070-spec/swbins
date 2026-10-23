using UnityEngine;
using Saga.Story.Audio;
using Saga.Story.Data;

namespace Saga.Story.World
{
    /// <summary>
    /// SagaDungeon/SagaGo의 World/GameBootstrap.cs와 같은 역할(네임스페이스만
    /// 변경) — 씬이 다 올라온 뒤 저장 파일이 있으면 위치·사명 진행도를
    /// 되돌린다.
    /// </summary>
    public class GameBootstrap : MonoBehaviour
    {
        // 67장 "사운드" BGM(2026-09-15, StoryAudio.cs 참고).
        [SerializeField] private AudioClip bgmClip;

        private StoryCameraFollow _cameraFollow;

        private void Start()
        {
            if (!StorySaveState.TryLoad()) Saga.Story.Data.StorySkillState.RestorePicks(Mathf.Max(1, Saga.Story.Data.StoryJobState.Level), 0, 0, 0);   // tasks U-0093 — 새 판은 3택 켠 채
            Saga.Core.SagaFlow.Enter("story", StorySaveState.Save);
            StoryRunRank.Finished -= OnRunFinished;   // tasks U-0093 — 한 판 등급 한 줄
            StoryRunRank.Finished += OnRunFinished; // PLAN.md 110 ② — 자동 저장·일시정지 메뉴·타이틀로.
            // 101-2 5-4 "관문 대장" — 세이브 로드 뒤에야 이번 주 도전 여부를
            // 알 수 있어(StoryEnemy.Awake()는 아직 세이브가 안 실렸을 수
            // 있다) 여기서 명시적으로 승격시킨다. 두목이 아니면 조용히 넘어간다.
            foreach (var enemy in StoryEnemy.All) enemy.TryBecomeChampion();
            StorySettingsState.ApplyToAllScalers();
            StorySettingsState.ApplyGraphicsQuality();
            StoryAudio.PlayBgm(bgmClip);
            StoryBgmScene.Attach(gameObject); // tasks U-0021 — 장면별 곡(field·battle, 파일 없으면 폴백)
            StoryJobState.LeveledUp += OnLeveledUp; // PLAN.md 101-3 G "성장 연출"(DUNGEON/GO와 같은 결, 이번에 처음 연결).
            _cameraFollow = StoryCameraFollow.Instance;
            StoryScenarioRunner.Install(); // PLAN.md 109-16 시나리오 — 장면 상자·목표 한 줄(Play 때, 씬 재빌드 없이)
            Saga.Story.UI.StoryPickUi.Install(); // tasks U-0093 레벨업 무예 3택 창(Play 때, 씬 재빌드 없이)
            StoryGatherNode.Install(); // tasks U-0133 들판 채집터 넷 — F·단추로 캐면 채집 등급 경험(Play 때, 씬 재빌드 없이)
            StoryHiddenClue.Install(); // tasks U-0181 숨은 우두머리 — 들판 맨 끝 옛 비문(Play 때, 씬 재빌드 없이)
            StoryCampfireSpot.Install(); // tasks U-0170 모닥불에 모여 쉬기 — 들머리 불, 판 사이 앉으면 앞 동료 온기(Play 때, 씬 재빌드 없이)
            MountField.Install(); // PLAN.md 109-15 탈것·비행 — H 타기·Shift+H 고르기·타기 단추(Play 때, 씬 재빌드 없이)
            Saga.Story.UI.StoryGuildUi.Install(); // tasks U-0192 문파 — 일시정지 왼쪽 🏯 창(Play 때, 씬 재빌드 없이)
            Saga.Story.UI.StoryAutoQuest.Install(); // tasks U-0165 자동 퀘스트 — 목표판 ▶(좌우 걷기·평타·장면 줄 넘김, Play 때)
        }

        private void OnDestroy()
        {
            StoryJobState.LeveledUp -= OnLeveledUp;
            StoryRunRank.Finished -= OnRunFinished;
        }

        private void OnLeveledUp(int newLevel)
        {
            _cameraFollow?.PlayLevelUpCut();
        }

        private static void OnRunFinished(StoryRunRank.Result r)
        {
            string l2 = StoryRunRank.Line2(r); // tasks U-0128 — 덤·최고 기록·쓰러짐
            Saga.Story.UI.DialogueLabel.Instance?.Show(StoryRunRank.Line(r) + (l2.Length > 0 ? "\n" + l2 : ""), 5f);
        }
    }
}
