using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Story.Data;
using Saga.Story.World;

namespace Saga.Story.UI
{
    /// <summary>
    /// VERTICAL_SLICE_STORY.md 1절 사명 — 웹판 data-quest.js q_first
    /// ("첫 사냥", kill 10) 진행도를 상시 표시한다(saga-godot
    /// `quest_label.gd`와 같은 값). DUNGEON `PlayerHud.cs`와 같은 폴링
    /// 패턴(값이 바뀌는 곳이 StoryEnemy.Die() 하나뿐이라도 폴링이 신호
    /// 배선보다 단순하다).
    /// </summary>
    public class StoryHud : MonoBehaviour
    {
        [SerializeField] private TextMeshProUGUI label;

        private const float RefreshGapSec = 0.25f;
        private float _timer;

        private void Start() => Refresh();

        private void Update()
        {
            _timer += Time.unscaledDeltaTime; // 히트스톱(Time.timeScale)에 안 묶이게.
            if (_timer < RefreshGapSec) return;
            _timer = 0f;
            Refresh();
        }

        private void Refresh()
        {
            if (label == null) return;
            bool done = StoryQuestState.QuestDone;
            bool bossDone = StoryQuestState.QuestBossDone;
            string mp = string.Format(StoryLocalization.T("hud.mp"), Mathf.RoundToInt(StoryCombat.Mp), Mathf.RoundToInt(StoryCombat.MpMaxCurrent));
            // PLAN.md 109-11-1 — 플레이어 체력(두목 패턴이 때린다), 기력 앞에 한 줄로.
            mp = string.Format(StoryLocalization.T("hud.hp", "❤ HP {0}/{1}"), Mathf.CeilToInt(StoryPlayerHp.Hp), Mathf.RoundToInt(StoryPlayerHp.HpMax)) + " · " + mp;
            string jobSuffix = StoryJobState.HasJob
                ? $" {StoryLocalization.T($"job.{StoryJobState.Job}", StoryJobState.JobDisplayName)}"
                : "";
            label.text = $"🎖️ {string.Format(StoryLocalization.T("hud.level"), StoryJobState.Level)}{jobSuffix}" +
                         $"\n🗡️ {StoryLocalization.T("quest.first_hunt", "첫 사냥")} {Mathf.Min(StoryQuestState.Kills, StoryQuestState.KillGoal)}/{StoryQuestState.KillGoal}" +
                         (done ? StoryLocalization.T("hud.done") : "") +
                         $"\n👺 {StoryLocalization.T("quest.boss_head", "두목의 목")} {Mathf.Min(StoryQuestState.BossKills, StoryQuestState.BossGoal)}/{StoryQuestState.BossGoal}" +
                         (bossDone ? StoryLocalization.T("hud.done") : "") +
                         $"\n{mp}";

            // PLAN.md 109-16 시나리오 — 지금 장·단계 한 줄(안 열렸거나 다 봤으면 없음).
            string story = StoryScenario.HudLine();
            if (story.Length > 0) label.text += "\n" + story;

            // PLAN.md 101-2 5-2 1단계 — 전직 뒤에만 남은 무예 점수(웹판 무예 탭 머리글과 같은 값).
            if (StoryJobState.HasJob)
            {
                label.text += "\n" + string.Format(StoryLocalization.T("hud.sp", "📜 무예 점수 {0} (K)"), StorySkillState.SpLeft);
            }

            // PLAN.md 101-2 5-4 "관문 대장" — 챔피언전이 진행 중일 때만 카운트다운을 얹는다(DUNGEON PlayerHud와 같은 결).
            var champion = StoryEnemy.ActiveChampion;
            if (champion != null)
            {
                string shield = champion.ChampionShieldBroken ? StoryLocalization.T("gatechampion.shield_hud", " 🛡깨짐") : "";
                string timer = string.Format(StoryLocalization.T("gatechampion.timer", "🚪 관문 대장 — {0:0}초{1}"),
                    Mathf.Max(0f, champion.ChampionTimeLeft), shield);
                label.text += $"\n{timer}";
            }

            // PLAN.md 101-2 5-3 "비경" — 회차 중일 때만 층수+(전투 노드
            // 진행 중이면) 제한시간을 얹는다.
            if (StoryLabyrinthState.InRun)
            {
                string floorLine = string.Format(StoryLocalization.T("labyrinth.floor_hud", "🌀 비경 {0}층"), StoryLabyrinthState.Floor);
                var runner = StoryLabyrinthRunner.Instance;
                if (runner != null && runner.NodeActive)
                {
                    floorLine += " " + string.Format(StoryLocalization.T("labyrinth.timer_hud", "— {0:0}초"), Mathf.Max(0f, runner.NodeTimeLeft));
                }
                label.text += $"\n{floorLine}";
            }

            // PLAN.md 101-2 5-8 "동료 교대" — 웹판 "HUD 왼쪽 아래 초상 3(체력
            // 바)"을 이 트랙의 텍스트 HUD 한 줄로 재해석(초상·체력 자체가
            // 없다, StoryPartyState.cs 클래스 주석 참고).
            string partyName = StoryPartyState.Active.DisplayName;
            string cooldown = StoryPartyState.CooldownLeft > 0f
                ? string.Format(StoryLocalization.T("party.cooldown_hud", "(교대까지 {0:0.0}초)"), StoryPartyState.CooldownLeft)
                : StoryLocalization.T("party.ready_hud", "(교대 가능)");
            // PLAN.md 106-10 — 쉬는 둘은 곁에서 싸운다.
            string beside = "";
            if (StoryCompanionSquad.Instance != null)
            {
                var names = new System.Collections.Generic.List<string>();
                for (int i = 0; i < StoryPartyState.Roster.Length; i++)
                {
                    if (i != StoryPartyState.ActiveIndex) names.Add(StoryPartyState.Roster[i].DisplayName);
                }
                beside = " · " + string.Format(StoryLocalization.T("party.beside_hud", "곁: {0}"), string.Join("·", names));
            }
            label.text += $"\n🎭 {partyName}{beside} {cooldown}";

            // PLAN.md 106-10 둘째 단계 — 소환 게이지(차면 "준비").
            label.text += "\n" + (StorySummonState.Ready
                ? StoryLocalization.T("summon.ready_hud", "⚡ 소환 준비 — [V]")
                : string.Format(StoryLocalization.T("summon.gauge_hud", "⚡ 소환 {0:0}%"), StorySummonState.Gauge));
        }
    }
}
