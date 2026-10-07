using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;

namespace Saga.Go.Data
{
    /// <summary>
    /// tasks U-0031 사냥 기록(saga-godot 사가만리 2026-09-30 새 시스템 `data/hunt.gd`·`world/hunt_log.gd`) — 몬스터헌터식 "종마다 쌓는 기록".
    /// 업적(<see cref="GoAchieve"/>)은 들판 처치를 통틀어 세지만 여기는 종마다 따로 센다: 처음 쓰러뜨리면 이름이 적히고(그 전엔 "???"),
    /// 마릿수 단계마다 보상을 받는다. 일반 종은 10·40·120마리, 우두머리(수호장·영웅)는 1·3·10마리 단계(고돗 체력 2500 이상 = 우두머리).
    /// 종 목록은 <see cref="FieldEnemy.Kind"/> 열한 값(일반 먼저, 우두머리 나중). 보상 이름을 이 트랙 길로 옮겼다 —
    /// 모라 → 금 · 경험 책 작은/중간 → 무예 쪽지/교본 · 인연의 매듭 → 인연 매듭 · 작은 광석 → 강화석 · 연마석 → 연마석(성유물). 수치는 고돗 그대로.
    /// 세이브 `huntKills`·`huntClaimed`(버전 그대로 — 옛 세이브는 0 에서). 업적·일일 의뢰 셈과 섞지 않는다.
    /// </summary>
    public static class GoHunt
    {
        public static readonly int[] Tiers = { 10, 40, 120 };
        public static readonly int[] BossTiers = { 1, 3, 10 };

        public struct Reward
        {
            public int Gold, Ore, Polish;
            public int[] Mats; // GoTalent.Mat 순서(쪽지·교본·비전·매듭·비늘)

            public Reward Plus(Reward o)
            {
                var m = new int[5];
                for (int i = 0; i < 5; i++) m[i] = (Mats != null ? Mats[i] : 0) + (o.Mats != null ? o.Mats[i] : 0);
                return new Reward { Gold = Gold + o.Gold, Ore = Ore + o.Ore, Polish = Polish + o.Polish, Mats = m };
            }
        }

        private static Reward R(int gold, int note = 0, int guide = 0, int knot = 0, int ore = 0, int polish = 0)
        {
            var m = new int[5];
            m[(int)GoTalent.Mat.Note] = note; m[(int)GoTalent.Mat.Guide] = guide; m[(int)GoTalent.Mat.Knot] = knot;
            return new Reward { Gold = gold, Ore = ore, Polish = polish, Mats = m };
        }

        /// <summary>고돗 `REWARDS` — 일반 종 단계별.</summary>
        public static readonly Reward[] Rewards = { R(1000, note: 1), R(2000, note: 2, ore: 2), R(3500, guide: 1, polish: 1) };
        /// <summary>고돗 `BOSS_REWARDS` — 우두머리 단계별.</summary>
        public static readonly Reward[] BossRewards = { R(2500, note: 2), R(5000, guide: 1, polish: 1), R(8000, guide: 2, knot: 1) };

        /// <summary>종 목록 — 일반 먼저, 우두머리 나중(<see cref="FieldEnemy.Kind"/> 적힌 순서 그대로).</summary>
        public static readonly FieldEnemy.Kind[] Species = BuildSpecies();

        private static FieldEnemy.Kind[] BuildSpecies()
        {
            var normal = new List<FieldEnemy.Kind>(); var boss = new List<FieldEnemy.Kind>();
            foreach (FieldEnemy.Kind k in System.Enum.GetValues(typeof(FieldEnemy.Kind))) (IsBoss(k) ? boss : normal).Add(k);
            normal.AddRange(boss);
            return normal.ToArray();
        }

        public static bool IsBoss(FieldEnemy.Kind k) => k == FieldEnemy.Kind.Guardian || k == FieldEnemy.Kind.Hero;
        public static int[] TiersOf(FieldEnemy.Kind k) => IsBoss(k) ? BossTiers : Tiers;
        public static Reward[] RewardsOf(FieldEnemy.Kind k) => IsBoss(k) ? BossRewards : Rewards;

        public static string RewardText(Reward r)
        {
            var parts = new List<string>();
            if (r.Gold > 0) parts.Add(string.Format(GoLocalization.T("ach.r_gold", "금 {0}"), r.Gold));
            for (int i = 0; r.Mats != null && i < r.Mats.Length; i++) if (r.Mats[i] > 0) parts.Add($"{GoTalent.MatName((GoTalent.Mat)i)} {r.Mats[i]}");
            if (r.Ore > 0) parts.Add(string.Format(GoLocalization.T("ach.r_ore", "강화석 {0}"), r.Ore));
            if (r.Polish > 0) parts.Add(string.Format(GoLocalization.T("hunt.r_polish", "연마석 {0}"), r.Polish));
            return string.Join(" · ", parts);
        }
    }

    /// <summary>
    /// 사냥 기록 진행 — 종마다 처치 수(kills)와 받은 단계 수(claimed). 알림은 <see cref="Check"/> 가 새로 닿은 단계를 돌려준다
    /// (불러온 직후 첫 확인은 기준만 잡고 빈 목록 — 업적 `AchieveState.Check` 와 같은 결).
    /// </summary>
    public static class HuntState
    {
        private static readonly Dictionary<string, int> _kills = new Dictionary<string, int>();
        private static readonly Dictionary<string, int> _claimed = new Dictionary<string, int>();
        private static Dictionary<string, int> _seen;
        public static event System.Action Changed;

        private static string Key(FieldEnemy.Kind k) => k.ToString();

        // ---- 셈 ----

        /// <summary>들판 적 하나를 쓰러뜨렸다 — 그 종의 처치 수 +1(돌려주는 값 = 새 수). 모르는 값이면 0.</summary>
        public static int Record(FieldEnemy.Kind k)
        {
            if (!System.Enum.IsDefined(typeof(FieldEnemy.Kind), k)) return 0;
            _kills.TryGetValue(Key(k), out int v);
            _kills[Key(k)] = ++v;
            return v;
        }

        public static int Kills(FieldEnemy.Kind k) => _kills.TryGetValue(Key(k), out int v) ? v : 0;

        /// <summary>지금까지 닿은 단계 수(0~3).</summary>
        public static int TierReached(FieldEnemy.Kind k)
        {
            var t = GoHunt.TiersOf(k); int n = Kills(k), r = 0;
            for (int i = 0; i < t.Length; i++) if (n >= t[i]) r = i + 1;
            return r;
        }

        public static int ClaimedTiers(FieldEnemy.Kind k) => _claimed.TryGetValue(Key(k), out int v) ? v : 0;
        public static int Claimable(FieldEnemy.Kind k) => Mathf.Max(TierReached(k) - ClaimedTiers(k), 0);

        public static int ClaimableTotal() { int n = 0; foreach (var k in GoHunt.Species) n += Claimable(k); return n; }

        /// <summary>한 번이라도 쓰러뜨린 종 수 / 전체 = <see cref="GoHunt.Species"/>.Length.</summary>
        public static int FoundCount() { int n = 0; foreach (var k in GoHunt.Species) if (Kills(k) > 0) n++; return n; }

        /// <summary>받을 단계가 모두 찬 종 수(모든 단계를 받은 종).</summary>
        public static int TiersDone() { int n = 0; foreach (var k in GoHunt.Species) n += ClaimedTiers(k); return n; }
        public static int TotalTiers() { int n = 0; foreach (var k in GoHunt.Species) n += GoHunt.TiersOf(k).Length; return n; }

        // ---- 받기 ----

        /// <summary>받기 — 닿았는데 못 받은 단계를 한꺼번에. 받은 보상 글(못 받으면 빈 글).</summary>
        public static string Claim(FieldEnemy.Kind k)
        {
            int from = ClaimedTiers(k), to = TierReached(k);
            if (to <= from) return "";
            var sum = new GoHunt.Reward { Mats = new int[5] };
            var rw = GoHunt.RewardsOf(k);
            for (int i = from; i < to; i++) sum = sum.Plus(rw[i]);
            if (sum.Gold > 0) GoldState.Add(sum.Gold);
            TalentState.Add(sum.Mats);
            if (sum.Ore > 0) WeaponState.AddOre(sum.Ore);
            if (sum.Polish > 0) ArtifactState.AddPolish(sum.Polish);
            _claimed[Key(k)] = to;
            Changed?.Invoke();
            return GoHunt.RewardText(sum);
        }

        /// <summary>모두 받기 — 받은 단계 수.</summary>
        public static int ClaimAll()
        {
            int n = 0;
            foreach (var k in GoHunt.Species) { int c = Claimable(k); if (c > 0 && Claim(k).Length > 0) n += c; }
            return n;
        }

        // ---- 알림 ----

        /// <summary>새로 닿은 단계 — (종, 단계 수). 첫 확인은 기준만 잡고 빈 목록.</summary>
        public static List<(FieldEnemy.Kind k, int tier)> Check()
        {
            var list = new List<(FieldEnemy.Kind, int)>();
            if (_seen == null)
            {
                _seen = new Dictionary<string, int>();
                foreach (var k in GoHunt.Species) _seen[Key(k)] = TierReached(k);
                return list;
            }
            foreach (var k in GoHunt.Species)
            {
                int t = TierReached(k);
                _seen.TryGetValue(Key(k), out int old);
                if (t > old) { list.Add((k, t)); _seen[Key(k)] = t; }
            }
            if (list.Count > 0) Changed?.Invoke();
            return list;
        }

        // ---- 세이브 ----

        public static List<CookState.Entry> SnapshotKills() => Snap(_kills);
        public static List<CookState.Entry> SnapshotClaimed() => Snap(_claimed);

        private static List<CookState.Entry> Snap(Dictionary<string, int> d)
        {
            var l = new List<CookState.Entry>();
            foreach (var kv in d) l.Add(new CookState.Entry { id = kv.Key, n = kv.Value });
            l.Sort((a, b) => string.CompareOrdinal(a.id, b.id));
            return l;
        }

        /// <summary>불러오기·새 게임·진단 — 없으면(옛 세이브) 0 에서. 모르는 종 이름은 버리고, 받은 단계는 단계 수 안으로 누른다. 기준(알림)도 다시 잡는다.</summary>
        public static void Restore(List<CookState.Entry> kills, List<CookState.Entry> claimed)
        {
            _kills.Clear(); _claimed.Clear(); _seen = null;
            if (kills != null)
                foreach (var e in kills)
                    foreach (var k in GoHunt.Species)
                        if (e.id == Key(k) && e.n > 0) _kills[e.id] = e.n;
            if (claimed != null)
                foreach (var e in claimed)
                    foreach (var k in GoHunt.Species)
                        if (e.id == Key(k) && e.n > 0) _claimed[e.id] = Mathf.Min(e.n, GoHunt.TiersOf(k).Length);
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null, null);
    }
}
