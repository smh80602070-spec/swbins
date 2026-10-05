using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// tasks U-0044 주간 도전 표(saga-godot `data/weekly_goals.gd`) — 하루짜리 일과 위의 한 주짜리 큰 목표. 업적(`AchieveState`)이 이미 쌓는 셈을
    /// **주 시작 값 대비 증가분**으로 읽어, 열 가지 중 다섯을 주마다 고정해 뽑는다(주 번호가 씨앗 — 같은 주엔 늘 같다).
    /// 걷기(걸음 총합 셈 없음)·알 품기(신수 알 없음)는 이 트랙에 없어 뺐다. 주는 월요일 새벽 4시에 갈린다(`DailyTaskState.DayStartHour`).
    /// </summary>
    public static class GoWeekly
    {
        public readonly struct Goal
        {
            public readonly string Id, Stat, NameKo, DescKo;
            public readonly int Target;
            public Goal(string id, string stat, int target, string nameKo, string descKo) { Id = id; Stat = stat; Target = target; NameKo = nameKo; DescKo = descKo; }
            public string Name => GoLocalization.T("weekly.name." + Id, NameKo);
            public string Desc => string.Format(GoLocalization.T("weekly.desc." + Id, DescKo), Target);
        }

        /// <summary>풀 열. `Stat` 은 <see cref="Value"/> 가 읽는 이름.</summary>
        public static readonly Goal[] Pool =
        {
            new Goal("kills", "kills", 30, "들판 순찰", "들판의 적 {0}마리 쓰러뜨리기"),
            new Goal("elite", "elite", 8, "원소 사냥", "원소 방패를 두른 적 {0}마리 쓰러뜨리기"),
            new Goal("boss", "boss", 1, "우두머리 토벌", "우두머리 {0}번 쓰러뜨리기"),
            new Goal("domain", "domain", 2, "숨은 터 두 번", "숨은 터 {0}번 깨기"),
            new Goal("react", "react", 25, "원소 놀이", "원소 반응 {0}번 일으키기"),
            new Goal("gather", "gather", 25, "약초꾼", "채집물 {0}개 줍기"),
            new Goal("cook", "cook", 3, "솥 앞의 사흘", "요리 {0}번 하기"),
            new Goal("fish", "fish", 5, "낚시 한 판", "물고기 {0}마리 낚기"),
            new Goal("chests", "chests", 4, "보물 찾기", "보물 상자 {0}개 열기"),
            new Goal("orbs", "orbs", 3, "구슬 줍기", "빛 구슬 {0}개 줍기"),
        };

        public const int PerWeek = 5;
        public const int RewardGold = 2500, RewardNote = 2;
        public const int BonusKnot = 2, BonusGuide = 2, BonusPolish = 2, BonusExp = 100;

        /// <summary>진단이 셈을 바꿔 끼운다(null = 진짜 셈).</summary>
        public static Func<string, int> ProviderOverride;

        /// <summary>지금 셈 값 — 업적이 쌓는 것을 그대로 읽는다(새 셈 없음).</summary>
        public static int Value(string stat)
        {
            if (ProviderOverride != null) return ProviderOverride(stat);
            switch (stat)
            {
                case "fish": return AchieveState.FishTotal();
                case "chests": return GoTreasure.OpenedCount;
                case "orbs": return OrbState.GotCount;
                default: return AchieveState.Stat(stat);
            }
        }

        public static Goal Get(string id) { foreach (var g in Pool) if (g.Id == id) return g; throw new ArgumentException("모르는 도전 " + id); }

        /// <summary>주 번호 — 월요일 새벽 4시에 넘어간다(1970-01-01 은 목요일이라 +3).</summary>
        public static int WeekOf(DateTime at)
        {
            double day = Math.Floor((at.AddHours(-DailyTaskState.DayStartHour) - new DateTime(1970, 1, 1)).TotalDays);
            return (int)Math.Floor((day + 3.0) / 7.0);
        }

        private static int StableHash(string s)
        {
            unchecked { int h = 17; foreach (char c in s) h = h * 31 + c; return h & 0x7fffffff; }
        }

        /// <summary>그 주의 도전 id 다섯 — 주 번호가 씨앗이라 늘 같다(서로 다른 셈).</summary>
        public static string[] Picks(int week)
        {
            var list = new List<(int h, string id)>();
            foreach (var g in Pool) list.Add((StableHash(week + "|" + g.Id), g.Id));
            list.Sort((a, b) => a.h != b.h ? a.h.CompareTo(b.h) : string.CompareOrdinal(a.id, b.id));
            var picks = new string[PerWeek];
            for (int i = 0; i < PerWeek; i++) picks[i] = list[i].id;
            return picks;
        }

        public static GoHunt.Reward GoalReward() => new GoHunt.Reward { Gold = RewardGold, Mats = Mats(note: RewardNote) };
        public static GoHunt.Reward BonusReward() => new GoHunt.Reward { Polish = BonusPolish, Mats = Mats(guide: BonusGuide, knot: BonusKnot) };

        private static int[] Mats(int note = 0, int guide = 0, int knot = 0)
        {
            var m = new int[5];
            m[(int)GoTalent.Mat.Note] = note; m[(int)GoTalent.Mat.Guide] = guide; m[(int)GoTalent.Mat.Knot] = knot;
            return m;
        }

        public static string GoalRewardText() => GoHunt.RewardText(GoalReward());
        public static string BonusRewardText() => GoHunt.RewardText(BonusReward()) + " · " + string.Format(GoLocalization.T("weekly.r_exp", "경험치 {0}"), BonusExp);
    }

    /// <summary>이번 주 상태 — 주 번호·주 시작 값·받은 도전·완주 보상. 세이브 필드 넷(`SaveState`, 버전 그대로).</summary>
    public static class WeeklyState
    {
        private static int _week = -1;
        private static readonly Dictionary<string, int> _base = new Dictionary<string, int>();
        private static readonly HashSet<string> _claimed = new HashSet<string>();
        private static bool _bonus;
        private static HashSet<string> _seenDone;

        public static event Action Changed;

        /// <summary>진단 — 시각을 붙든다(null = 진짜 시계).</summary>
        public static DateTime? NowForTest;
        public static DateTime Now => NowForTest ?? DateTime.Now;
        public static int Week => GoWeekly.WeekOf(Now);

        public static int StoredWeek => _week;
        public static bool BonusClaimed => _bonus;

        /// <summary>주가 바뀌었으면 새로 짠다(받은 것 비움·시작 값 = 지금 값).</summary>
        public static void Ensure()
        {
            int w = Week;
            if (_week == w) return;
            _week = w; _bonus = false;
            _base.Clear(); _claimed.Clear(); _seenDone = null;
            foreach (var g in GoWeekly.Pool) _base[g.Stat] = GoWeekly.Value(g.Stat);
            Changed?.Invoke();
        }

        public static string[] Picks() { Ensure(); return GoWeekly.Picks(_week); }

        /// <summary>이번 주 늘린 만큼 — 값이 줄었으면(상자가 되살아나는 등) 시작 값을 낮춰 0 아래로 안 간다.</summary>
        public static int Progress(string id)
        {
            Ensure();
            string stat = GoWeekly.Get(id).Stat;
            int cur = GoWeekly.Value(stat);
            _base.TryGetValue(stat, out int b);
            if (cur < b) { _base[stat] = cur; b = cur; }
            return cur - b;
        }

        public static bool Done(string id) => Progress(id) >= GoWeekly.Get(id).Target;
        public static bool Claimed(string id) { Ensure(); return _claimed.Contains(id); }

        public static List<string> Claimable()
        {
            var l = new List<string>();
            foreach (var id in Picks()) if (Done(id) && !_claimed.Contains(id)) l.Add(id);
            return l;
        }

        public static int ClaimedCount() { Ensure(); int n = 0; foreach (var id in GoWeekly.Picks(_week)) if (_claimed.Contains(id)) n++; return n; }
        public static bool AllClaimed => ClaimedCount() >= GoWeekly.PerWeek;
        public static bool BonusReady => AllClaimed && !_bonus;

        private static void Grant(GoHunt.Reward r)
        {
            if (r.Gold > 0) GoldState.Add(r.Gold);
            TalentState.Add(r.Mats);
            if (r.Polish > 0) ArtifactState.AddPolish(r.Polish);
        }

        /// <summary>받기 — 받은 보상 글(못 받으면 빈 글: 이번 주 도전이 아님·이미 받음·아직 못 채움).</summary>
        public static string Claim(string id)
        {
            Ensure();
            if (Array.IndexOf(GoWeekly.Picks(_week), id) < 0 || _claimed.Contains(id) || !Done(id)) return "";
            _claimed.Add(id);
            Grant(GoWeekly.GoalReward());
            Changed?.Invoke();
            return GoWeekly.GoalRewardText();
        }

        /// <summary>완주 보상 — 다섯 다 받은 뒤 한 번.</summary>
        public static string ClaimBonus()
        {
            Ensure();
            if (!BonusReady) return "";
            _bonus = true;
            Grant(GoWeekly.BonusReward());
            PlayerStats.AddExp(GoWeekly.BonusExp);
            Changed?.Invoke();
            return GoWeekly.BonusRewardText();
        }

        /// <summary>새로 채운 도전 — 첫 확인(불러온 직후)은 기준만 잡고 조용히.</summary>
        public static List<string> Check()
        {
            Ensure();
            var list = new List<string>();
            var now = new HashSet<string>();
            foreach (var id in GoWeekly.Picks(_week)) if (Done(id)) now.Add(id);
            if (_seenDone == null) { _seenDone = now; return list; }
            foreach (var id in now) if (!_seenDone.Contains(id)) list.Add(id);
            _seenDone = now;
            if (list.Count > 0) Changed?.Invoke();
            return list;
        }

        // ---- 세이브 ----

        public static int SnapshotWeek() => _week;
        public static bool SnapshotBonus() => _bonus;

        public static List<CookState.Entry> SnapshotBase()
        {
            var l = new List<CookState.Entry>();
            foreach (var kv in _base) l.Add(new CookState.Entry { id = kv.Key, n = kv.Value });
            l.Sort((a, b) => string.CompareOrdinal(a.id, b.id));
            return l;
        }

        public static List<CookState.Entry> SnapshotClaimed()
        {
            var l = new List<CookState.Entry>();
            foreach (var id in _claimed) l.Add(new CookState.Entry { id = id, n = 1 });
            l.Sort((a, b) => string.CompareOrdinal(a.id, b.id));
            return l;
        }

        /// <summary>불러오기·새 게임·진단 — 주 번호가 없으면(옛 세이브) 새 주 취급(다음 Ensure 가 지금 값으로 시작 값을 잡는다).
        /// 모르는 셈·도전 id 는 버린다.</summary>
        public static void Restore(int week, List<CookState.Entry> baseVals, List<CookState.Entry> claimed, bool bonus)
        {
            _base.Clear(); _claimed.Clear(); _seenDone = null;
            _week = week > 0 ? week : -1;
            _bonus = _week >= 0 && bonus;
            if (_week >= 0)
            {
                if (baseVals != null)
                    foreach (var e in baseVals)
                        foreach (var g in GoWeekly.Pool)
                            if (e.id == g.Stat) _base[e.id] = Mathf.Max(0, e.n);
                if (claimed != null)
                    foreach (var e in claimed)
                        foreach (var g in GoWeekly.Pool)
                            if (e.id == g.Id && e.n > 0) _claimed.Add(e.id);
            }
            Changed?.Invoke();
        }

        public static void ResetForTest() { NowForTest = null; GoWeekly.ProviderOverride = null; Restore(-1, null, null, false); }
    }
}
