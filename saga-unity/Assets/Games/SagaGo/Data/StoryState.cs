using System;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-12 이야기 임무 진행 — 지금 장(`Ch`)·단계(`Step`) 하나(웹 `save.story = { ch, step }`). 세이브 v28 `storyCh`·`storyStep`.
    /// 임무 적·제단 불은 저장하지 않는다(불러오면 그 단계 처음). 대화 창이 열린 동안(`Talking`) 들판 전투는 입력·적 움직임이 멎는다(웹 같게).
    /// </summary>
    public static class StoryState
    {
        public static int Ch { get; private set; }
        public static int StepIndex { get; private set; }

        /// <summary>대화 창이 열려 있나 — `FieldCombat`·`FieldEnemy` 가 본다.</summary>
        public static bool Talking { get; set; }

        /// <summary>진단 스위치 — 켜면 이야기 임무가 통째로 사라진다(옛 진단이 들판·HUD 를 예전대로 보게).</summary>
        public static bool OffForTest;

        /// <summary>단계가 바뀌었다(장 끝이면 받은 보상 글, 아니면 null).</summary>
        public static event Action<string> Advanced;
        public static event Action Changed;

        public static bool Done => Ch >= GoStory.Chapters.Length;
        public static GoStory.Chapter Chapter => Done ? null : GoStory.Chapters[Ch];
        /// <summary>장이 여정 등급(부대 레벨)에 막혀 있나.</summary>
        public static bool Locked => !Done && PlayerStats.Level < Chapter.Ar;
        /// <summary>지금 단계 — 다 끝났거나 장이 잠겼거나 꺼졌으면 null.</summary>
        public static GoStory.Step Current => OffForTest || Done || Locked ? null : Chapter.Steps[StepIndex];

        /// <summary>지금 단계를 끝낸다 — 장 끝이면 보상을 주고 다음 장으로. 보상 글(장 끝) 또는 null.</summary>
        public static string Advance()
        {
            var ch = Chapter;
            if (ch == null) return null;
            StepIndex++;
            string reward = null;
            if (StepIndex >= ch.Steps.Length)
            {
                GoldState.Add(ch.Gold);
                TalentState.Add(ch.Mats);
                reward = GoStory.RewardText(ch);
                Ch++;
                StepIndex = 0;
            }
            Advanced?.Invoke(reward);
            Changed?.Invoke();
            return reward;
        }

        public static void Restore(int ch, int step)
        {
            Ch = Math.Max(0, Math.Min(ch, GoStory.Chapters.Length));
            StepIndex = Done ? 0 : Math.Max(0, Math.Min(step, GoStory.Chapters[Ch].Steps.Length - 1));
            Talking = false;
            Changed?.Invoke();
        }
    }
}
