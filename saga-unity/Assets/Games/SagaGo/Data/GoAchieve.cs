using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-25 업적(웹 사가만리 ⑲-25 `achieve.js` = saga-godot 106 ㊸) — 다섯 갈래·업적 스물둘·단계 예순셋 표·받기.
    /// 셈은 둘 — 이미 있는 상태에서 읽는 것(상자·구슬·오른 정상·봉헌 등급·끝낸 사명·물고기 기록·이야기 장·세계 임무·여정 등급)과
    /// 신호로 세는 것(`Bump`: 들판 처치·큰 적·원소 괴물·숨은 터·급소·채집·요리, `Reaction`: 반응 수·가짓수).
    /// 이름·보상은 웹 그대로(첫 단 금 300 · 둘째 금 600·무예 쪽지 2 · 셋째 무예 교본 2·강화석 3, 어려운 셋은 인연 매듭 1 더).
    /// 이 트랙의 표 값: 상자 17개·정상 28·봉헌 등급 10·지역 사명 수를 따라 단계 수를 맞췄다(웹의 탑·탐험도는 정상·사명으로).
    /// 세이브 `achStats`·`achKinds`·`achGot`(버전 그대로 — 옛 세이브는 0 에서).
    /// </summary>
    public static class GoAchieve
    {
        public enum Cat { World, Fight, Element, Life, Story }

        public static readonly string[] CatKo = { "세상 곳곳", "싸움의 길", "원소의 이치", "살림살이", "이야기" };
        public static string CatName(Cat c) => GoLocalization.T("ach.cat." + c.ToString().ToLowerInvariant(), CatKo[(int)c]);

        public sealed class Entry
        {
            public string Id, NameKo, UnitKo, Src;
            public Cat Cat;
            public int[] Tiers;
            /// <summary>이 단계 번호(0부터)에 인연 매듭을 더 준다(−1 = 없음).</summary>
            public int Hard = -1;
            public string Name => GoLocalization.T("ach.name." + Id, NameKo);
            public string Unit => GoLocalization.T("ach.unit." + Id, UnitKo);
        }

        private static Entry E(string id, Cat cat, string name, string unit, int[] tiers, string src, int hard = -1) =>
            new Entry { Id = id, Cat = cat, NameKo = name, UnitKo = unit, Tiers = tiers, Src = src, Hard = hard };

        /// <summary>웹 `LIST`(같은 순서). Src: stat:· kind:· 그 밖은 상태에서 읽는다.</summary>
        public static readonly Entry[] All =
        {
            E("chest", Cat.World, "보물 사냥꾼", "상자를 열었다", new[] { 5, 10, 17 }, "chests"),
            E("orb", Cat.World, "구슬 줍는 이", "수집 구슬을 주웠다", new[] { 5, 12, 20 }, "orbs"),
            E("peak", Cat.World, "정상 찾는 길", "정상을 올랐다", new[] { 5, 14, 28 }, "peaks"),
            E("offer", Cat.World, "봉헌의 벗", "봉헌 등급", new[] { 2, 5, 10 }, "orbLv"),
            E("mission", Cat.World, "지역 평정", "사명을 끝낸 지역", new[] { 1, 3 }, "missions", 1),
            E("kill", Cat.Fight, "들판의 칼", "들판 적을 물리쳤다", new[] { 20, 100, 300 }, "stat:kills"),
            E("elite", Cat.Fight, "원소 괴물 사냥", "방패 두른 원소 괴물", new[] { 5, 20, 60 }, "stat:elite"),
            E("boss", Cat.Fight, "큰 적 쓰러뜨림", "보스·수호자", new[] { 1, 5, 15 }, "stat:boss"),
            E("domain", Cat.Fight, "숨은 터 돌파", "숨은 터를 끝냈다", new[] { 1, 5, 15 }, "stat:domain"),
            E("weak", Cat.Fight, "급소 한 발", "급소 화살", new[] { 1, 10, 30 }, "stat:weak"),
            E("react", Cat.Element, "원소 부림", "원소 반응", new[] { 10, 50, 200 }, "stat:react"),
            E("kinds", Cat.Element, "반응 도감", "반응 가짓수", new[] { 4, 8, 14 }, "kinds", 2),
            E("shatter", Cat.Element, "얼음 깨기", "깨뜨림", new[] { 1, 10 }, "kind:shatter"),
            E("swirl", Cat.Element, "회오리 부름", "회오리", new[] { 1, 20 }, "kind:swirl"),
            E("gather", Cat.Life, "들풀 모으기", "채집", new[] { 20, 60, 150 }, "stat:gather"),
            E("cook", Cat.Life, "솥 앞에서", "요리", new[] { 1, 10, 30 }, "stat:cook"),
            E("tasty", Cat.Life, "맛있는 한 상", "맛있는 요리", new[] { 1, 5, 15 }, "stat:tasty"),
            E("fish", Cat.Life, "낚싯대 드리우기", "물고기를 낚았다", new[] { 1, 10, 30 }, "fish"),
            E("fishkinds", Cat.Life, "물고기 도감", "물고기 가짓수", new[] { 3, 5, 8 }, "fishKinds"),
            E("chapter", Cat.Story, "이야기 따라", "이야기 장을 마쳤다", new[] { 1, 5, 9 }, "chapters", 2),
            E("wq", Cat.Story, "세계의 부탁", "세계 임무를 마쳤다", new[] { 1, 2, 3 }, "wq"),
            E("rank", Cat.Story, "여정의 걸음", "여정 등급", new[] { 5, 10, 20 }, "rank"),
        };

        public static int TotalTiers { get { int n = 0; foreach (var a in All) n += a.Tiers.Length; return n; } }

        public struct Reward
        {
            public int Gold, Ore;
            public int[] Mats; // GoTalent.Mat 순서(쪽지·교본·비전·매듭·비늘)
        }

        /// <summary>단계 번호(0부터)의 보상 — 두 단짜리는 앞 둘만.</summary>
        public static Reward RewardOf(Entry a, int tier)
        {
            var mats = new int[5];
            var r = new Reward { Mats = mats };
            switch (Mathf.Clamp(tier, 0, 2))
            {
                case 0: r.Gold = 300; break;
                case 1: r.Gold = 600; mats[(int)GoTalent.Mat.Note] = 2; break;
                default: mats[(int)GoTalent.Mat.Guide] = 2; r.Ore = 3; break;
            }
            if (a.Hard == tier) mats[(int)GoTalent.Mat.Knot] += 1;
            return r;
        }

        public static string RewardText(Reward r)
        {
            var parts = new List<string>();
            if (r.Gold > 0) parts.Add(string.Format(GoLocalization.T("ach.r_gold", "금 {0}"), r.Gold));
            for (int i = 0; i < r.Mats.Length; i++) if (r.Mats[i] > 0) parts.Add($"{GoTalent.MatName((GoTalent.Mat)i)} {r.Mats[i]}");
            if (r.Ore > 0) parts.Add(string.Format(GoLocalization.T("ach.r_ore", "강화석 {0}"), r.Ore));
            return string.Join(" · ", parts);
        }

        /// <summary>닿은 단계 수(0 ~ Tiers.Length).</summary>
        public static int TierOf(Entry a, int v)
        {
            int n = 0;
            while (n < a.Tiers.Length && v >= a.Tiers[n]) n++;
            return n;
        }
    }

    /// <summary>
    /// 업적 진행(웹 `save.ach = { stats, got }`) — stats(신호 셈)·kinds(반응 가짓수별 횟수)·got(업적마다 받은 단계 수).
    /// 값 = 신호 셈 + 상태에서 읽는 것. 알림은 `Check()` 가 새로 닿은 단계를 돌려준다(불러온 직후 첫 확인은 기준만 잡고 빈 목록).
    /// </summary>
    public static class AchieveState
    {
        private static readonly Dictionary<string, int> _stats = new Dictionary<string, int>();
        private static readonly Dictionary<string, int> _kinds = new Dictionary<string, int>();
        private static readonly Dictionary<string, int> _got = new Dictionary<string, int>();
        private static Dictionary<string, int> _seen;
        public static event System.Action Changed;

        // ---- 신호 ----

        public static void Bump(string key, int n = 1)
        {
            if (n <= 0) return;
            _stats.TryGetValue(key, out int v);
            _stats[key] = v + n;
        }

        public static void Reaction(GoReaction r)
        {
            if (r == GoReaction.None) return;
            Bump("react");
            string k = r.ToString().ToLowerInvariant();
            _kinds.TryGetValue(k, out int v);
            _kinds[k] = v + 1;
        }

        public static int Stat(string key) => _stats.TryGetValue(key, out int v) ? v : 0;
        public static int KindCount(string kind) => _kinds.TryGetValue(kind, out int v) ? v : 0;
        public static int Kinds => _kinds.Count;

        // ---- 값 ----

        public static int MissionsDone()
        {
            int n = 0;
            foreach (var m in GoRegionMission.Missions) if (RegionMissionState.StageOf(m.RegionId) >= GoRegionMission.Stages) n++;
            return n;
        }

        public static int FishTotal() { int n = 0; foreach (var f in GoFishing.Fishes) n += FishState.LogOf(f.Id); return n; }
        public static int FishKinds() { int n = 0; foreach (var f in GoFishing.Fishes) if (FishState.LogOf(f.Id) > 0) n++; return n; }

        public static int ValueOf(GoAchieve.Entry a)
        {
            string src = a.Src;
            if (src.StartsWith("stat:")) return Stat(src.Substring(5));
            if (src.StartsWith("kind:")) return KindCount(src.Substring(5));
            switch (src)
            {
                case "chests": return GoTreasure.OpenedCount;
                case "orbs": return OrbState.GotCount;
                case "peaks": return WorldMapState.PeakCount;
                case "orbLv": return OrbState.Level;
                case "missions": return MissionsDone();
                case "kinds": return Kinds;
                case "fish": return FishTotal();
                case "fishKinds": return FishKinds();
                case "chapters": return Mathf.Min(9, StoryState.Ch);
                case "wq": { int n = 0; for (int i = 0; i < WorldQuestState.Count; i++) if (WorldQuestState.Done(i)) n++; return n; }
                case "rank": return PlayerStats.Level;
            }
            return 0;
        }

        public struct Status
        {
            public GoAchieve.Entry A;
            public int Value, Tier, Got;
            public int Claim => Tier - Got;
        }

        public static Status StatusOf(GoAchieve.Entry a)
        {
            int v = ValueOf(a), t = GoAchieve.TierOf(a, v);
            _got.TryGetValue(a.Id, out int g);
            return new Status { A = a, Value = v, Tier = t, Got = Mathf.Min(t, g) };
        }

        public static List<Status> StatusAll()
        {
            var l = new List<Status>();
            foreach (var a in GoAchieve.All) l.Add(StatusOf(a));
            return l;
        }

        public static int Claimable() { int n = 0; foreach (var a in GoAchieve.All) n += StatusOf(a).Claim; return n; }
        public static int ClaimableIn(GoAchieve.Cat c) { int n = 0; foreach (var a in GoAchieve.All) if (a.Cat == c) n += StatusOf(a).Claim; return n; }
        public static int TiersDone() { int n = 0; foreach (var a in GoAchieve.All) n += StatusOf(a).Tier; return n; }

        // ---- 받기 ----

        /// <summary>받기 — 다음 한 단계. 받은 보상 글(못 받으면 빈 글).</summary>
        public static string Claim(string id)
        {
            GoAchieve.Entry a = null;
            foreach (var x in GoAchieve.All) if (x.Id == id) a = x;
            if (a == null) return "";
            var s = StatusOf(a);
            if (s.Claim <= 0) return "";
            var r = GoAchieve.RewardOf(a, s.Got);
            if (r.Gold > 0) GoldState.Add(r.Gold);
            TalentState.Add(r.Mats);
            if (r.Ore > 0) WeaponState.AddOre(r.Ore);
            _got[id] = s.Got + 1;
            Changed?.Invoke();
            return GoAchieve.RewardText(r);
        }

        /// <summary>모두 받기 — 받은 단계 수.</summary>
        public static int ClaimAll()
        {
            int n = 0;
            foreach (var a in GoAchieve.All) while (Claim(a.Id).Length > 0) n++;
            return n;
        }

        // ---- 알림 ----

        /// <summary>새로 닿은 단계 — (업적, 단계 수). 첫 확인은 기준만 잡고 빈 목록.</summary>
        public static List<(GoAchieve.Entry a, int tier)> Check()
        {
            var outl = new List<(GoAchieve.Entry, int)>();
            if (_seen == null)
            {
                _seen = new Dictionary<string, int>();
                foreach (var a in GoAchieve.All) _seen[a.Id] = StatusOf(a).Tier;
                return outl;
            }
            foreach (var a in GoAchieve.All)
            {
                int t = StatusOf(a).Tier;
                _seen.TryGetValue(a.Id, out int old);
                if (t > old) { outl.Add((a, t)); _seen[a.Id] = t; }
            }
            if (outl.Count > 0) Changed?.Invoke();
            return outl;
        }

        // ---- 세이브 ----

        public static List<CookState.Entry> SnapshotStats() => Snap(_stats);
        public static List<CookState.Entry> SnapshotKinds() => Snap(_kinds);
        public static List<CookState.Entry> SnapshotGot() => Snap(_got);

        private static List<CookState.Entry> Snap(Dictionary<string, int> d)
        {
            var l = new List<CookState.Entry>();
            foreach (var kv in d) l.Add(new CookState.Entry { id = kv.Key, n = kv.Value });
            l.Sort((a, b) => string.CompareOrdinal(a.id, b.id));
            return l;
        }

        /// <summary>불러오기·새 게임·진단 — 없으면(옛 세이브) 0 에서. 기준(알림)도 다시 잡는다.</summary>
        public static void Restore(List<CookState.Entry> stats, List<CookState.Entry> kinds, List<CookState.Entry> got)
        {
            _stats.Clear();
            _kinds.Clear();
            _got.Clear();
            _seen = null;
            if (stats != null) foreach (var e in stats) if (!string.IsNullOrEmpty(e.id) && e.n > 0) _stats[e.id] = e.n;
            if (kinds != null) foreach (var e in kinds) if (!string.IsNullOrEmpty(e.id) && e.n > 0) _kinds[e.id] = e.n;
            if (got != null)
                foreach (var e in got)
                    foreach (var a in GoAchieve.All)
                        if (a.Id == e.id && e.n > 0) _got[e.id] = Mathf.Min(e.n, a.Tiers.Length);
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null, null, null);
    }
}
