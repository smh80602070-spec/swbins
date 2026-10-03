using UnityEngine;

namespace Saga.Story.Data
{
    /// <summary>
    /// 회차(회귀) — 이야기를 다 본 뒤 사냥터가 한 단 더 거칠어진다(웹 사가스토리 PLAN §5-14, SAGA-DESIGN §16, tasks U-0024).
    /// 이 판은 한 캐릭터가 계속 크는 판이라 회차 = **난도 회귀**: 레벨·전직·무예·장비·이야기 장 기록은 그대로 두고 배율만 오른다.
    /// ① 적 체력·(두목 패턴) 공격 ×(1+0.25×(N−1), 최대 ×2.5) ② 잡아서 얻는 경험치 ×(1+0.2×(N−1), 최대 ×2.6). 9회차 다음은 없다.
    /// 웹의 "금 +3000×(N−1)" 은 옮기지 않는다 — 이 트랙 STORY 에는 금이 없다(<see cref="StoryQuestState"/> 머리글).
    /// 처음 열리는 조건은 지금 있는 이야기를 다 본 것, 그 뒤 다음 회귀는 **이번 회차에 처치 400 + 비경 한 번**이 더 든다(연달아 못 누르게).
    /// 웹의 "마을에서만" 은 이 트랙에 마을이 없어 "비경 안에서는 못 한다"로 옮겼다(비경은 스스로 한 판이라 도중에 배율이 바뀌면 안 된다).
    /// 사냥터 안에서 누르는 단추는 <c>StorySettingsPanel</c> 의 "🔁 회귀" 줄 — 한 번 눌러 조건을 보고, 6초 안에 한 번 더 누르면 시작
    /// (<c>RealmRound</c> 의 "다음 달" 단추와 같은 방식).
    /// 세이브: <c>round</c>·<c>roundKills</c>·<c>roundRifts</c>(옛 세이브 = 필드 없음 = 1회차·기준점 없음). 최고 회차는 새로 시작해도 남게 PlayerPrefs.
    /// </summary>
    public static class StoryRound
    {
        public const int Max = 9;
        public const float FoeStep = 0.25f, FoeCap = 2.5f, GainStep = 0.2f, GainCap = 2.6f;
        public const int KillsNeed = 400, RiftsNeed = 1;
        public const float ArmSeconds = 6f;
        private const string BestKey = "saga.story.bestRound";

        public static int Round { get; private set; } = 1;

        /// <summary>첫 회귀 전 = -1(기준점 없음 — 이야기만 보면 열린다).</summary>
        public static int BaseKills { get; private set; } = -1;
        public static int BaseRifts { get; private set; } = -1;

        /// <summary>진단 — 비경 안인지 강제로 정한다(null = <see cref="StoryLabyrinthState.InRun"/> 을 본다).</summary>
        public static bool? InRunForTest;
        /// <summary>진단 — 처치·비경 수를 강제로 정한다(null = 실제 값).</summary>
        public static int? KillsForTest, RiftsForTest;

        public static int Best => Mathf.Max(Round, PlayerPrefs.GetInt(BestKey, 1));

        public static float FoeMul(int round) => Mathf.Min(FoeCap, 1f + FoeStep * (Mathf.Max(1, round) - 1));
        public static float GainMul(int round) => Mathf.Min(GainCap, 1f + GainStep * (Mathf.Max(1, round) - 1));

        /// <summary>지금 회차의 적 배율 — 적이 태어날 때·두목이 때릴 때 곱한다. 1회차는 정확히 1.</summary>
        public static float FoeMul() => Round <= 1 ? 1f : FoeMul(Round);
        /// <summary>지금 회차의 경험치 배율 — 1회차는 정확히 1.</summary>
        public static float GainMul() => Round <= 1 ? 1f : GainMul(Round);

        private static int KillsNow => KillsForTest ?? StoryQuestState.Kills;
        private static int RiftsNow => RiftsForTest ?? StoryScenario.Rifts;
        private static bool InRun => InRunForTest ?? StoryLabyrinthState.InRun;

        public readonly struct Progress
        {
            public readonly bool First;     // 첫 회귀(처치·비경은 안 센다)
            public readonly int Kills, Rifts;
            public readonly bool Done;
            public Progress(bool first, int kills, int rifts)
            {
                First = first; Kills = kills; Rifts = rifts;
                Done = first || (kills >= KillsNeed && rifts >= RiftsNeed);
            }
        }

        /// <summary>이번 회차에서 다음 회귀까지의 진척.</summary>
        public static Progress GetProgress()
        {
            if (BaseKills < 0) return new Progress(true, 0, 0);
            return new Progress(false, Mathf.Max(0, KillsNow - BaseKills), Mathf.Max(0, RiftsNow - BaseRifts));
        }

        /// <summary>다음 회귀를 못 하는 까닭 — 할 수 있으면 null.</summary>
        public static string Why()
        {
            if (!StoryScenario.Enabled) return StoryLocalization.T("round.off", "이야기가 꺼져 있다.");
            if (Round >= Max) return string.Format(StoryLocalization.T("round.last", "🔁 {0}회차까지 깼다 — 더 없다"), Round);
            if (StoryScenario.Current() != null) return StoryLocalization.T("round.story_first", "지금 있는 이야기를 다 본 뒤에 열린다.");
            if (InRun) return StoryLocalization.T("round.not_in_rift", "비경 안에서는 못 한다 — 나와서 하자.");
            var p = GetProgress();
            if (!p.Done)
                return string.Format(StoryLocalization.T("round.need", "이번 회차에 처치 {0}(지금 {1})과 비경 한 번(지금 {2})이 더 필요하다."), KillsNeed, p.Kills, p.Rifts);
            return null;
        }

        public static bool CanNext => Why() == null;

        /// <summary>한 줄 미리보기 — 다음 회차의 적·경험치 배율.</summary>
        public static string Preview()
        {
            int next = Round + 1;
            return string.Format(StoryLocalization.T("round.preview", "🔁 {0}회차 — 적 ×{1:0.0#} · 경험치 ×{2:0.0#} (레벨·전직·장비는 그대로)"), next, FoeMul(next), GainMul(next));
        }

        /// <summary>설정 패널 줄의 오른쪽 글 — 지금 회차와 열렸는지.</summary>
        public static string StateLabel()
        {
            string head = string.Format(StoryLocalization.T("round.state", "{0}회차"), Round);
            return CanNext ? head + " ▶" : head;
        }

        /// <summary>
        /// 다음 회차를 시작한다 — 안 되면 false 와 까닭. 레벨·전직·장·사명·시나리오 기록은 건드리지 않는다.
        /// <paramref name="persist"/> 면 세이브 파일에도 쓴다(진단은 false).
        /// </summary>
        public static bool StartNext(bool persist, out string reason)
        {
            reason = Why();
            if (reason != null) return false;
            PlayerPrefs.SetInt(BestKey, Mathf.Max(PlayerPrefs.GetInt(BestKey, 1), Round));
            Round++;
            BaseKills = KillsNow;
            BaseRifts = RiftsNow;
            PlayerPrefs.SetInt(BestKey, Mathf.Max(PlayerPrefs.GetInt(BestKey, 1), Round));
            if (persist) StorySaveState.Save();
            return true;
        }

        /// <summary>세이브에서 되돌린다 — 옛 세이브(필드 없음)는 0·0·0 으로 와서 1회차·기준점 없음.</summary>
        public static void Restore(int round, int baseKills, int baseRifts, bool hasBase)
        {
            Round = round < 1 ? 1 : Mathf.Min(round, Max);
            BaseKills = hasBase ? Mathf.Max(0, baseKills) : -1;
            BaseRifts = hasBase ? Mathf.Max(0, baseRifts) : -1;
        }

        public static void ResetForTest()
        {
            Round = 1; BaseKills = -1; BaseRifts = -1;
            InRunForTest = null; KillsForTest = null; RiftsForTest = null;
        }
    }
}
