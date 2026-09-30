using UnityEngine;
using Saga.Story.Data;
using Saga.Story.UI;
using Saga.Core;

namespace Saga.Story.World
{
    /// <summary>
    /// PLAN.md 51장 "STORY 확장 — 스토리 챕터→NPC/선택/사건/관계"의 네 칸
    /// 중 NPC·관계·선택 셋을 채운다(사건은 `StoryDiscovery.cs`가 별도로
    /// 채움). `StoryQuestState.cs` 클래스 주석이 이미 "gear/gather/visit/
    /// talk/skill/gold" 사명은 범위 밖이라고 적어 둔 대로, 말을 걸어도
    /// 진행 자체(사명·골드 등)는 안 바꾼다 — GO `NpcBuilder.cs`의 촌장·
    /// 나그네와 달리 부수효과가 없다(STORY엔 골드·인벤토리가 없어 줄
    /// 보상이 없다).
    ///
    /// **관계** — NPC가 아직 이 척후병 하나뿐이라 본격 호감도(수치·
    /// 사건별 증감)까지는 안 가고, `StoryNpcState.ScoutTalkCount`로 "몇
    /// 번 말을 걸었는가"만 센다 — 계속 마주칠수록 인사말 앞머리가 조금씩
    /// 데워진다.
    ///
    /// **선택(2026-09-14 추가)** — 두목 처치 직후 첫 대화에서
    /// `StoryChoiceUi`로 두 선택지("함께 축배" vs "치하만")를 한 번
    /// 묻는다(`ShowChoice`). STORY엔 갈릴 결과를 담을 시스템(골드·평판
    /// 등)이 없어 **장식적 분기**다 — 어느 쪽을 골라도 게임 상태는 안
    /// 바뀌고 이후 인사말·본문 어투만 갈린다(`Greeting`/`Line`의
    /// `ChoiceMade` 분기). 이걸로 51장 STORY 네 칸이 모두 채워졌다.
    ///
    /// GO `World/VillagerTalk.cs`와 같은 트리거 규칙(플레이어가 반경에
    /// 들어오면 쿨다운을 두고 한 줄). **시각(2026-09-14 추가)** — 44장
    /// 우선순위 표엔 애초에 NPC가 없던 새 칸이라 그동안 fallback
    /// capsule이었는데, GO/FOREST가 마을 주민 역할에 이미 쓰는
    /// `character-b.glb`(Kenney Blocky Characters)를 그대로 재사용해
    /// 실제 모델을 입혔다 — 새 자산을 만들지 않고 이미 있는 "주민" 배역
    /// 모델을 그대로 가져다 쓴 것뿐이라 44장 규모의 판단은 아니다.
    /// `modelPrefab`이 비어 있으면(에셋을 못 찾은 다른 PC 등) 여전히
    /// `CharacterVisual.SpawnFallbackCapsule`로 안전하게 대체된다
    /// (`StoryEnemy.cs`와 같은 폴백 순서).
    /// </summary>
    public class StoryNpc : MonoBehaviour
    {
        private const float TalkRadius = 2f;
        private const float TalkGapSec = 30f;
        private const float LineShowSec = 5f;
        private const float NpcHeight = 1.6f;
        private static readonly Color BodyColor = new Color(0.35f, 0.5f, 0.32f); // 병졸 갑주와 다른 녹갈색 평상복

        [SerializeField] private GameObject modelPrefab; // BuildTestStoryScene.cs가 character-b.glb를 채운다.
        // PLAN.md 106-4 STORY 몫 — Mixamo 사실 모델(척후병 Peasant Man). 로컬 전용이라 없으면 null → 위 Kenney.
        [SerializeField] private GameObject rigPrefab;
        /// <summary>사실 모델 키(Maria 1.8m 와 나란히) · 카메라(−z) 쪽을 본다.</summary>
        private const float RigHeight = 1.75f;
        private const float RigYaw = 180f;

        private float _lastSaidTime = -TalkGapSec;

        private void Awake()
        {
            if (transform.Find("Visual") != null) return; // 씬 재로드 시 중복 생성 방지 — StoryEnemy.cs와 같은 결.
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
            if (Time.time - _lastSaidTime < TalkGapSec) return;

            _lastSaidTime = Time.time;

            if (StoryQuestState.QuestBossDone && StoryNpcState.ChoiceMade == 0)
            {
                ShowChoice();
                return;
            }

            StoryNpcState.AddScoutTalk();
            DialogueLabel.Instance?.Show($"{ScoutName} — {Greeting()}{Line()}", LineShowSec);
        }

        private static string ScoutName => StoryLocalization.T("npc.scout_name", "들판의 척후병");

        /// <summary>선택 — 두목 처치 직후 한 번만 묻는다. `StoryChoiceUi`가
        /// 씬에 없으면(구버전 씬 등) 안전하게 평소 대화로 건너뛴다 —
        /// 에러가 아니라 조용한 폴백(다른 Build*Scene 자산 누락 처리와
        /// 같은 결).</summary>
        private void ShowChoice()
        {
            var ui = StoryChoiceUi.Instance;
            if (ui == null)
            {
                StoryNpcState.AddScoutTalk();
                DialogueLabel.Instance?.Show($"{ScoutName} — {Greeting()}{Line()}", LineShowSec);
                return;
            }

            ui.Show(
                StoryLocalization.T("npc.scout_choice_prompt", "두목까지 처치하셨군요! 노고를 어떻게 치하해 드릴까요?"),
                StoryLocalization.T("npc.scout_choice_a", "함께 축배를 든다"),
                StoryLocalization.T("npc.scout_choice_b", "간단히 치하만 받는다"),
                choice =>
                {
                    StoryNpcState.SetChoice(choice);
                    StoryNpcState.AddScoutTalk();
                    DialogueLabel.Instance?.Show($"{ScoutName} — {ChoiceLine(choice)}", LineShowSec);
                });
        }

        private static string ChoiceLine(int choice) => choice == 1
            ? StoryLocalization.T("npc.scout_choice_line_a", "좋습니다, 오늘은 마음 놓고 한 잔 합시다!")
            : StoryLocalization.T("npc.scout_choice_line_b", "예, 알겠습니다 — 다음에 또 뵙지요.");

        /// <summary>관계 — 몇 번째 만남인지에 따라 인사말 앞머리만 데운다
        /// (본문 `Line()`은 그대로, 관계와 사명 진행을 서로 안 섞는다).
        /// 선택 이후엔 그 어투를 우선한다(둘 다 장식일 뿐이라 섞지
        /// 않고 나중 결정 하나만 반영).</summary>
        private static string Greeting()
        {
            int count = StoryNpcState.ScoutTalkCount;
            switch (StoryNpcState.ChoiceMade)
            {
                case 1: return count <= 1 ? "" : StoryLocalization.T("npc.scout_greeting_1", "형씨! ");
                case 2: return count <= 1 ? "" : StoryLocalization.T("npc.scout_greeting_2", "어서 오십시오. ");
            }
            if (count <= 1) return "";
            if (count <= 4) return StoryLocalization.T("npc.scout_greeting_default_2", "또 뵙는군요. ");
            return StoryLocalization.T("npc.scout_greeting_default_3", "이제 낯이 익어 마음이 놓입니다. ");
        }

        private static string Line()
        {
            if (StoryQuestState.QuestBossDone)
            {
                // 이 분기에 오는 시점엔 ShowChoice()를 이미 거쳤다(ChoiceMade!=0) —
                // 선택 어투만 다르고 안전 선언 자체는 그대로다(장식적 분기).
                return StoryNpcState.ChoiceMade == 1
                    ? StoryLocalization.T("npc.scout_line_done_a", "지난번 잔치, 아직도 훈훈합니다. 이 들판은 이제 안전합니다.")
                    : StoryLocalization.T("npc.scout_line_done_b", "이 들판은 이제 안전합니다. 감사합니다.");
            }
            if (StoryQuestState.QuestDone)
            {
                return StoryLocalization.T("npc.scout_line_boss_pending", "잡졸들은 거의 정리되셨군요. 안쪽에 두목이 아직 버티고 있습니다.");
            }
            if (StoryQuestState.Kills > 0)
            {
                return string.Format(StoryLocalization.T("npc.scout_line_kills_remaining", "황건적이 아직 {0}명은 더 남았을 겁니다."), StoryQuestState.KillGoal - StoryQuestState.Kills);
            }
            return StoryLocalization.T("npc.scout_line_initial", "이 들판에 황건적 떼가 진을 쳤습니다. 조심하십시오.");
        }
    }
}
