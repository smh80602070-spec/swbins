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

        /// <summary>109-14-13 — follow 단계에서 인물이 걸은 거리(m) · gather 단계에서 모은 수. 저장 안 함(불러오면 그 단계 처음), 단계가 바뀌면 0.</summary>
        public static float FollowDist { get; set; }
        public static int Progress { get; set; }
        /// <summary>109-14-19 chase — 달아나는 도둑 자리(쫓는 동안만, 저장 안 함 — 불러오면 처음 자리).</summary>
        public static UnityEngine.Vector3? ChasePos { get; set; }

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
        /// <summary>이야기의 지금 단계(따라가는 줄과 상관없이) — 다 끝났거나 장이 잠겼거나 꺼졌으면 null.</summary>
        public static GoStory.Step StoryCurrent => OffForTest || Done || Locked ? null : Chapter.Steps[StepIndex];

        // ---- PLAN.md 109-14-21 따라가는 줄(웹 ⑲-21 track) — 이야기(−1) 또는 맡은 세계 임무 하나. 목표·추적 줄·임무 적·기둥은 이 줄만.
        // 바꾸면 그 단계 처음부터(따라간 거리·모은 수·쫓기 자리를 비운다). 세계 임무가 끝나면 이야기로 돌아온다.
        public static int Track { get; private set; } = -1;
        public static bool TrackingQuest => Track >= 0 && WorldQuestState.Taken(Track);
        /// <summary>줄 이름 — 이야기면 장 번호("4"), 세계 임무면 "wq1".</summary>
        public static string LineId => TrackingQuest ? "wq" + Track : Ch.ToString();
        public static int LineStep => TrackingQuest ? WorldQuestState.Step(Track) : StepIndex;
        /// <summary>줄·단계 열쇠("4_2" · "wq1_3") — 임무 적 무리·석등·제단 불이 이것으로 묶인다.</summary>
        public static string LineKey => LineId + "_" + LineStep;
        /// <summary>마지막으로 끝낸 장·임무 이름(끝 알림) · 그게 세계 임무였나.</summary>
        public static string LastDoneName { get; private set; }
        public static bool LastDoneQuest { get; private set; }

        /// <summary>지금 단계 — 따라가는 줄의 것. 꺼졌으면 null.</summary>
        public static GoStory.Step Current => OffForTest ? null : TrackingQuest ? WorldQuestState.Current(Track) : StoryCurrent;

        /// <summary>그 줄의 그 단계에 닿았나(같거나 지났나) — 제단·석등이 선다(세계 임무는 끝났으면 모두 지난 것).</summary>
        public static bool Reached(string line, int step)
        {
            if (line.StartsWith("wq"))
            {
                int q = int.Parse(line.Substring(2));
                return WorldQuestState.Done(q) || (WorldQuestState.Taken(q) && WorldQuestState.Step(q) >= step);
            }
            int c = int.Parse(line);
            return Ch > c || (Ch == c && StepIndex >= step);
        }

        /// <summary>줄·단계 → 단계 표.</summary>
        public static GoStory.Step StepOf(string line, int i) =>
            line.StartsWith("wq") ? GoWorldQuests.Quests[int.Parse(line.Substring(2))].Steps[i] : GoStory.Chapters[int.Parse(line)].Steps[i];

        /// <summary>따라가는 줄을 바꾼다(−1 = 이야기). 맡지 않은 임무·같은 줄이면 false.</summary>
        public static bool SetTrack(int q)
        {
            if (q >= 0 && !WorldQuestState.Taken(q)) return false;
            if (q < 0) q = -1;
            if (q == Track) return false;
            Track = q;
            FollowDist = 0f;
            Progress = 0;
            ChasePos = null;
            Changed?.Invoke();
            return true;
        }

        /// <summary>불러오기 — 세이브의 임무 id(없으면 이야기).</summary>
        public static void RestoreTrack(string id)
        {
            int q = string.IsNullOrEmpty(id) ? -1 : GoWorldQuests.IndexOf(id);
            Track = q >= 0 && WorldQuestState.Taken(q) ? q : -1;
            Changed?.Invoke();
        }

        public static string TrackId => TrackingQuest ? GoWorldQuests.Quests[Track].Id : null;

        /// <summary>지금 단계를 끝낸다 — 장 끝이면 보상을 주고 다음 장으로. 보상 글(장 끝) 또는 null.</summary>
        public static string Advance()
        {
            if (TrackingQuest)
            {
                // 109-14-21 세계 임무 — 끝나면 보상·이야기로 돌아온다
                int q = Track;
                string done = WorldQuestState.Advance(q);
                FollowDist = 0f;
                Progress = 0;
                ChasePos = null;
                if (done != null) { LastDoneName = GoWorldQuests.Name(GoWorldQuests.Quests[q]); LastDoneQuest = true; Track = -1; }
                Advanced?.Invoke(done);
                Changed?.Invoke();
                return done;
            }
            var ch = Chapter;
            if (ch == null) return null;
            StepIndex++;
            FollowDist = 0f;
            Progress = 0;
            ChasePos = null;
            string reward = null;
            if (StepIndex >= ch.Steps.Length)
            {
                GoldState.Add(ch.Gold);
                TalentState.Add(ch.Mats);
                reward = GoStory.RewardText(ch);
                LastDoneName = GoStory.ChapterName(ch);
                LastDoneQuest = false;
                if (Join(ch)) reward += " · " + string.Format(GoLocalization.T("story.joined", "{0} 합류"), FieldJoinName(ch.Join));
                Ch++;
                StepIndex = 0;
            }
            Advanced?.Invoke(reward);
            Changed?.Invoke();
            return reward;
        }

        /// <summary>109-14-15 장 끝 합류 — 아직 동행이 아니면 들인다(등용과 같게 맨 뒤 = 들판 둘째 자리). 들였으면 true.</summary>
        private static bool Join(GoStory.Chapter ch)
        {
            if (string.IsNullOrEmpty(ch.Join) || PartyState.Has(ch.Join)) return false;
            PartyState.Recruit(ch.Join);
            return true;
        }

        private static string FieldJoinName(string id) => GoHeroes.TryGet(id, out var h) ? GoHeroes.Name(h) : id;

        /// <summary>109-14-15 — 합류가 생기기 전에 그 장을 끝낸 세이브는 불러올 때 조용히 들어온다(두 번 불러도 한 명). `SaveState` 가 부른다.</summary>
        public static int CatchUpJoins()
        {
            int n = 0;
            for (int c = 0; c < Ch && c < GoStory.Chapters.Length; c++) if (Join(GoStory.Chapters[c])) n++;
            return n;
        }

        public static void Restore(int ch, int step)
        {
            Ch = Math.Max(0, Math.Min(ch, GoStory.Chapters.Length));
            StepIndex = Done ? 0 : Math.Max(0, Math.Min(step, GoStory.Chapters[Ch].Steps.Length - 1));
            Talking = false;
            FollowDist = 0f;
            Progress = 0;
            ChasePos = null;
            Track = -1; // 109-14-21 이야기 자리를 앉히면 따라가는 줄도 이야기로(세이브는 뒤에 RestoreTrack)
            Changed?.Invoke();
        }
    }
}
