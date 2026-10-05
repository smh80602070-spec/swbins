using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-7 "여정 등급·천하 등급"(웹 사가고 ⑲-7 `adventure.js` · saga-godot 106 ㉒) — 표·식만 모은 순수 정적 클래스.
    /// 여정 등급 = 이미 있는 부대 레벨(`PlayerStats.Level`, 경험 곡선 그대로 — 새 경험 체계를 만들지 않는다).
    /// 오를 때마다 금 100 × 등급 · 강화석 2, 5 의 배수면 인연 매듭 1(웹 부대 경험 40 × 등급은 이 트랙에 인물 경험이 없어 뺐다).
    /// 천하 등급 0~8 — 여정 등급 1·3·6·9·12·15·18·21·24(웹 그대로). 들판 적(무리·원소 괴물·들판 인물·수호장) 체력·방패 ×(1 + 0.35 × 천하),
    /// 공격 ×(1 + 0.22 × 천하) — 지역 위험 배율(108)에 곱한다. 사당 시련은 안 받는다. 수호장 금 ×(1 + 0.25 × 천하)(웹은 들판 처치 금마다 — 이 트랙은 처치 금이 수호장뿐).
    /// 한 단계 낮추기·되돌리기(싸우는 중엔 막음). 웹의 단사 +1(3 단계마다)·머리 위 Lv 덧셈은 이 트랙에 없어 뺐다.
    /// </summary>
    public static class GoAdventure
    {
        public static readonly int[] WlAt = { 1, 3, 6, 9, 12, 15, 18, 21, 24 };
        public static int WlMaxBase => WlAt.Length - 1;
        /// <summary>U-0045 재출항마다 천하 등급 상한 +2(회차 0 은 옛 값 8 그대로).</summary>
        public static int WlMax => WlMaxBase + GoCycle.WorldCapPerCycle * CycleState.Cycle;
        /// <summary>그 천하 등급이 열리는 여정 등급 — 표 끝(24)을 넘으면 3레벨마다 하나씩(27·30·…).</summary>
        public static int WlAtOf(int i) => i <= WlMaxBase ? WlAt[i] : WlAt[WlMaxBase] + GoCycle.WlStepBeyond * (i - WlMaxBase);
        public const float HpStep = 0.35f, AtkStep = 0.22f, LootStep = 0.25f;
        public const int GoldPerRank = 100, OrePerRank = 2, KnotEvery = 5;

        /// <summary>여정 등급 ar 에서 저절로 열리는 천하 등급.</summary>
        public static int NaturalOf(int ar)
        {
            int w = 0;
            for (int i = 1; i <= WlMax; i++) if (ar >= WlAtOf(i)) w = i;
            return w;
        }

        public static int Clamp(int w) => Mathf.Clamp(w, 0, WlMax);
        public static float HpMul(int w) => 1f + HpStep * Clamp(w);
        public static float AtkMul(int w) => 1f + AtkStep * Clamp(w);
        public static float LootMul(int w) => 1f + LootStep * Clamp(w);

        /// <summary>그 천하 등급이 열리는 여정 등급(끝이면 0).</summary>
        public static int NextAt(int ar)
        {
            int n = NaturalOf(ar);
            return n < WlMax ? WlAtOf(n + 1) : 0;
        }

        /// <summary>여정 등급 ar 에 오르면 받는 것.</summary>
        public static (int gold, int ore, int knot) RewardOf(int ar) => (GoldPerRank * ar, OrePerRank, ar % KnotEvery == 0 ? 1 : 0);
    }

    /// <summary>109-14-7 낮춤·보상 받은 여정 등급(세이브 v24 `advLowered`·`advPaid`). 천하 등급이 바뀌면 `WorldChanged` — 들판 적이 다시 잰다.</summary>
    public static class AdventureState
    {
        public static bool Lowered { get; private set; }
        /// <summary>보상을 받은 여정 등급 — 옛 세이브는 지금 레벨(지난 보상이 쏟아지지 않게).</summary>
        public static int Paid { get; private set; } = 1;
        /// <summary>진단 — 켜면 천하 0·보상 없음(옛 진단이 적 체력·금 값을 잰다). 켜고 끌 때 부르는 쪽이 `Rescale` 을 부른다.</summary>
        public static bool OffForTest;
        /// <summary>(옛, 새) 천하 등급.</summary>
        public static event System.Action<int, int> WorldChanged;
        public static event System.Action Changed;

        private static int _lastWl = -1;

        public static int Rank => PlayerStats.Level;
        public static int Natural => GoAdventure.NaturalOf(Rank);

        public static int WorldLevel
        {
            get
            {
                if (OffForTest) return 0;
                int n = Natural;
                return Mathf.Max(0, n - (Lowered && n > 0 ? 1 : 0));
            }
        }

        /// <summary>천하 등급이 바뀌었으면 알린다(들판 적이 다시 잰다).</summary>
        public static void Rescale()
        {
            int w = WorldLevel;
            int from = _lastWl < 0 ? w : _lastWl;
            _lastWl = w;
            WorldChanged?.Invoke(from, w);
            Changed?.Invoke();
        }

        /// <summary>레벨업마다(`PlayerStats.LeveledUp`) — 받은 등급 다음부터 지금까지 보상, 알림 글(없으면 빈 목록).</summary>
        public static List<string> OnLevelUp(int lv)
        {
            var out_ = new List<string>();
            if (OffForTest) { Paid = Mathf.Max(Paid, lv); return out_; }
            while (Paid < lv)
            {
                Paid++;
                var r = GoAdventure.RewardOf(Paid);
                GoldState.Add(r.gold);
                WeaponState.AddOre(r.ore);
                if (r.knot > 0) TalentState.Add(new[] { 0, 0, 0, r.knot, 0 });
                out_.Add(string.Format(GoLocalization.T("adv.reward", "여정 등급 {0} — 금 {1} · 강화석 {2}{3}"), Paid, r.gold, r.ore,
                    r.knot > 0 ? " · " + string.Format(GoLocalization.T("adv.knot", "인연 매듭 {0}"), r.knot) : ""));
            }
            int before = _lastWl;
            if (before >= 0 && WorldLevel != before)
            {
                if (WorldLevel > before) out_.Add(string.Format(GoLocalization.T("adv.world_up", "천하 등급 {0} — 들판 적이 세지고 수호장 금이 늘어난다"), WorldLevel));
                Rescale();
            }
            else if (before < 0) _lastWl = WorldLevel;
            Changed?.Invoke();
            return out_;
        }

        /// <summary>한 단계 낮출 수 있나 — 싸우는 중인지는 부르는 쪽이 넘긴다.</summary>
        public static bool CanLower(bool fighting, out string why)
        {
            why = null;
            if (Lowered) why = GoLocalization.T("adv.why.lowered", "이미 한 단계 낮췄다");
            else if (Natural < 1) why = GoLocalization.T("adv.why.zero", "천하 등급 0 은 더 낮출 수 없다");
            else if (fighting) why = GoLocalization.T("adv.why.fight", "싸우는 중엔 바꿀 수 없다");
            return why == null;
        }

        public static bool CanRestore(bool fighting, out string why)
        {
            why = null;
            if (!Lowered) why = GoLocalization.T("adv.why.not_lowered", "낮춘 적이 없다");
            else if (fighting) why = GoLocalization.T("adv.why.fight", "싸우는 중엔 바꿀 수 없다");
            return why == null;
        }

        public static bool Lower(bool fighting)
        {
            if (!CanLower(fighting, out _)) return false;
            Lowered = true;
            Rescale();
            return true;
        }

        public static bool Restore(bool fighting)
        {
            if (!CanRestore(fighting, out _)) return false;
            Lowered = false;
            Rescale();
            return true;
        }

        /// <summary>세이브에서 — paid 가 0 이하(옛 세이브)면 지금 레벨.</summary>
        public static void RestoreSave(bool lowered, int paid)
        {
            Lowered = lowered;
            Paid = paid > 0 ? paid : PlayerStats.Level;
            Rescale();
        }

        public static void ResetForTest()
        {
            Lowered = false;
            Paid = PlayerStats.Level;
            Rescale();
        }
    }
}
