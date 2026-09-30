using UnityEngine;
using Saga.Story.Data;
using Saga.Story.UI;
using Saga.Core;

namespace Saga.Story.World
{
    /// <summary>
    /// PLAN.md 51장 "STORY 확장 — 전직·SP 투자 UI"(saga-godot
    /// `story_job_trainer.gd`가 정본 — 이 세션의 출처). **재해석** —
    /// 원작(godot)은 "SP 투자"까지 같은 자리에서 겸하지만, 이 포트엔 직업별
    /// 무예(job-specific skill) 자체가 없다(STORY엔 아직 연참·횡소·기탄·
    /// 기합 네 무예뿐, 전부 직업 공통 — `StoryCombat.cs` JobsTier1 클래스
    /// 주석 참고) — SP 투자는 범위 밖으로 명시적으로 남긴다(godot 쪽도
    /// 처음엔 grow만 옮기고 SP는 다음 걸음이었다, 같은 경계).
    ///
    /// `StoryNpc.cs`와 같은 트리거 규칙(반경+쿨다운, 다가가면 자동 반응).
    /// 1차 전직(Lv.10, 무사·궁수·협객·방사 중 하나) + 2차 전직(2026-09-23, PLAN.md 101-2
    /// 5-2 2단계 — Lv.15 + 1차 무예 하나 5, <see cref="ShowPromote"/>). 3·4차는 아직 범위 밖.
    /// </summary>
    public class StoryJobTrainer : MonoBehaviour
    {
        private const float TalkRadius = 2f;
        private const float TalkGapSec = 15f;
        private const float LineShowSec = 4f;
        private const float NpcHeight = 1.6f;
        private static readonly Color BodyColor = new Color(0.55f, 0.42f, 0.18f); // 척후병(녹갈색)과 다른 갈색 계열

        [SerializeField] private GameObject modelPrefab; // BuildTestStoryScene.cs가 채운다(StoryNpc.cs와 같은 결).
        // PLAN.md 106-4 STORY 몫 — Mixamo 사실 모델(전직관 Jolleen). 로컬 전용이라 없으면 null → 위 Kenney.
        [SerializeField] private GameObject rigPrefab;
        /// <summary>사실 모델 키(Maria 1.8m 와 나란히) · 카메라(−z) 쪽을 본다.</summary>
        private const float RigHeight = 1.75f;
        private const float RigYaw = 180f;

        private float _lastShownTime = -TalkGapSec;

        private void Awake()
        {
            if (transform.Find("Visual") != null) return; // 씬 재로드 시 중복 생성 방지.
            BuildVisual();
            BuildTalkArea();
        }

        private void BuildVisual()
        {
            if (NpcIdle.SpawnRigged(rigPrefab, transform, RigHeight, RigYaw) != null) return;
            if (modelPrefab != null)
            {
                CharacterVisual.Spawn(modelPrefab, transform, NpcHeight, BodyColor);
            }
            else
            {
                CharacterVisual.SpawnFallbackCapsule(transform, NpcHeight, BodyColor);
            }
        }

        private void BuildTalkArea()
        {
            var talkGo = new GameObject("TalkArea");
            talkGo.transform.SetParent(transform, false);
            var col = talkGo.AddComponent<SphereCollider>();
            col.isTrigger = true;
            col.radius = TalkRadius;
        }

        private void OnTriggerEnter(Collider other)
        {
            if (!other.CompareTag("Player")) return;
            if (Time.time - _lastShownTime < TalkGapSec) return;
            _lastShownTime = Time.time;

            if (StoryJobState.CanChooseJob)
            {
                ShowChoice();
                return;
            }
            if (StoryJobState.CanPromote)
            {
                ShowPromote();
                return;
            }

            DialogueLabel.Instance?.Show($"{TrainerName} — {StatusText()}", LineShowSec);
            // PLAN.md 101-2 5-2 1단계 — 전직을 마친 뒤엔 무예 점수 패널을 연다(웹판 전직관이
            // 무예 탭으로 이어지는 것과 같은 자리). 남은 점수가 없으면 안 연다(매번 뜨면 성가시다).
            if (StoryJobState.HasJob && StorySkillState.SpLeft > 0) StorySkillPanelUi.Instance?.Show();
        }

        private static string TrainerName => StoryLocalization.T("npc.trainer_name", "전직관");

        private void ShowChoice()
        {
            var ui = StoryJobChoiceUi.Instance;
            if (ui == null)
            {
                DialogueLabel.Instance?.Show($"{TrainerName} — {StatusText()}", LineShowSec);
                return;
            }

            ui.Show(
                StoryLocalization.T("npc.trainer_choice_prompt", "전직할 수 있습니다 — 원하는 길을 고르세요"),
                jobKey =>
                {
                    bool ok = StoryJobState.ChooseJob(jobKey);
                    if (ok)
                    {
                        var info = StoryCombat.JobsTier1[jobKey];
                        string mpPart = info.Mp > 0f
                            ? string.Format(StoryLocalization.T("npc.trainer_chosen_mp_suffix", " 기력+{0}"), Mathf.RoundToInt(info.Mp))
                            : "";
                        string name = StoryLocalization.T($"job.{jobKey}", info.Name);
                        // info.Hp(grow.hp)는 메시지에 안 넣는다 — 이 슬라이스는 플레이어가
                        // 안 맞아(StoryCombat.StartHp 주석 참고) 체력 상한이 어디에도 안
                        // 쓰인다, "체력+N"을 보여주면 실제로 안 일어나는 효과를 약속하는 셈.
                        DialogueLabel.Instance?.Show(string.Format(
                            StoryLocalization.T("npc.trainer_chosen", "{0} — {1}로 전직! 공격+{2}{3}"),
                            TrainerName, name, Mathf.RoundToInt(info.Atk), mpPart), LineShowSec);
                        StorySkillPanelUi.Instance?.Show();
                    }
                    else
                    {
                        DialogueLabel.Instance?.Show($"{TrainerName} — {StatusText()}", LineShowSec);
                    }
                });
        }

        /// <summary>PLAN.md 101-2 5-2 2단계(2026-09-23) — 2차 전직. 웹판 nextJobs()는 갈래마다
        /// 하나라 넷 중 고르는 화면(StoryJobChoiceUi) 대신 두 갈래 선택(StoryChoiceUi)으로 묻는다.
        /// 공개 — PlaytestStorySlice가 트리거 없이 부른다.</summary>
        public void ShowPromote()
        {
            string next = StoryJobState.NextJob;
            if (next == null || !StoryCombat.TryGetJob(next, out var info)) return;
            string name = StoryLocalization.T($"job.{next}", info.Name);
            var ui = StoryChoiceUi.Instance;
            if (ui == null)
            {
                DialogueLabel.Instance?.Show($"{TrainerName} — {StatusText()}", LineShowSec);
                return;
            }
            ui.Show(
                string.Format(StoryLocalization.T("npc.trainer_promote_prompt", "{0}(으)로 오를 수 있습니다 — 오르겠습니까?"), name),
                StoryLocalization.T("npc.trainer_promote_yes", "오른다"),
                StoryLocalization.T("npc.trainer_promote_no", "나중에"),
                choice =>
                {
                    if (choice != 1 || !StoryJobState.Promote()) return;
                    string mpPart = info.Mp > 0f
                        ? string.Format(StoryLocalization.T("npc.trainer_chosen_mp_suffix", " 기력+{0}"), Mathf.RoundToInt(info.Mp))
                        : "";
                    DialogueLabel.Instance?.Show(string.Format(
                        StoryLocalization.T("npc.trainer_chosen", "{0} — {1}로 전직! 공격+{2}{3}"),
                        TrainerName, name, Mathf.RoundToInt(info.Atk), mpPart), LineShowSec);
                    StorySkillPanelUi.Instance?.Show();
                });
        }

        private static string StatusText()
        {
            if (StoryJobState.HasJob)
            {
                string name = StoryLocalization.T($"job.{StoryJobState.Job}", StoryJobState.JobDisplayName);
                string done = string.Format(StoryLocalization.T("npc.trainer_status_done", "🎖️ {0} Lv.{1}"), name, StoryJobState.Level);
                // 윗자리(2~4차)가 남았으면 무엇이 모자란지 붙인다(웹판 canJoin() 사유).
                string why = StoryJobState.PromoteBlock();
                if (why == "job.why_level")
                    return done + " · " + string.Format(StoryLocalization.T("job.why_level", "윗자리는 Lv.{0}부터"), StoryJobState.PromoteLevelNeeded);
                if (why == "job.why_skill")
                    return done + " · " + string.Format(StoryLocalization.T("job.why_skill", "윗자리는 무예 하나를 {0} 이상 익혀야 한다"), StoryJobState.PromoteSkillLevelNeeded);
                return done;
            }
            if (StoryJobState.Level < StoryCombat.JobChangeLevel)
            {
                return string.Format(StoryLocalization.T("npc.trainer_status_locked", "전직은 Lv.{0}부터(현재 Lv.{1})"),
                    StoryCombat.JobChangeLevel, StoryJobState.Level);
            }
            return StoryLocalization.T("npc.trainer_status_ready", "전직할 수 있습니다");
        }
    }
}
