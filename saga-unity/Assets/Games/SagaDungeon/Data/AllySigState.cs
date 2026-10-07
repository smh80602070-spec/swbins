using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 109-10-8 동행 서명(同行署名, 웹 사가나락 §5.17 `castAllySig`) — 동행도 제 서명 무예를 스스로 쓰고, 선두 서명 직후면 **합격**.
    ///
    /// 웹은 동행이 인물이라 제 서명(105종 중 하나)을 빌리지만, 이 판 동행은 무사·술사 두 자리라 **서명을 하나씩 정했다**(이름은 지어냄):
    /// 무사 💥 철벽 진동(v 3.0·재사용 16 → 24초·밀침 1.25m) · 술사 ❄ 서리꽃 파동(v 2.6·재사용 14 → 21초·밀침 0.83m·맞은 적 2.8초 얼림 = 비결 한기와 같은 값).
    /// 모양은 웹 그대로 동행 자리를 가운데 둔 파동 하나(반경 = 웹 120 을 회전베기 비(68 ↔ 2.8m)로 → 5m).
    /// 웹 수치 그대로: 첫 4초 · 재사용 max(8, cd × 1.5) · 곁에 적 셋 이상이거나 정예·두목급이면 · 선두 서명(이 판은 **회전베기**) 뒤 1.5초 안이면
    /// 적 하나로도 곧장 나가고 ×1.5 합격(창은 한 번 쓰면 닫힘 — 동행 둘 중 먼저 나간 쪽만) · 밀침 ≤ 웹 30(= 1.25m) · 판정에 무작위 없음.
    /// 위력 = 제 평타 피해 × v(웹 companionMul 은 동행 힘이 선두 대비라서 — 이 판 동행은 제 공격력을 이미 따로 갖고 있어 뺐다).
    /// 셈(웹 run.allySigs·allyCombos)은 세션 셈, 세이브 없음. 웹 손잡이 `dungeon.allySig` = <see cref="Enabled"/>.
    /// </summary>
    public static class AllySigState
    {
        public const float FirstSec = 4f, CdMul = 1.5f, CdMin = 8f;
        public const float Radius = 5f;
        public const int Crowd = 3;
        public const float ComboWindowSec = 1.5f, ComboMul = 1.5f;
        public const float KnockbackMax = 1.25f;

        public struct Sig
        {
            public PartyRole Role;
            public string NameKey, NameKo, Emoji;
            public float V;         // 제 평타 피해 배율
            public float Cd;        // 웹 sk.cd — 실제 재사용은 max(CdMin, Cd × CdMul)
            public float Knockback; // m
            public float ChillSec;  // 0 이면 안 얼림
            public Color Color;
        }

        public static readonly Sig Guard = new Sig
        {
            Role = PartyRole.Guard, NameKey = "allysig.guard", NameKo = "철벽 진동", Emoji = "💥",
            V = 3.0f, Cd = 16f, Knockback = KnockbackMax, ChillSec = 0f, Color = new Color(1f, 0.78f, 0.35f),
        };

        public static readonly Sig Mystic = new Sig
        {
            Role = PartyRole.Mystic, NameKey = "allysig.mystic", NameKo = "서리꽃 파동", Emoji = "❄",
            V = 2.6f, Cd = 14f, Knockback = 20f / 24f, ChillSec = 2.8f, Color = new Color(0.7f, 0.88f, 1f),
        };

        public static Sig Of(PartyRole role) => role == PartyRole.Mystic ? Mystic : Guard;

        public static float CooldownOf(Sig s) => Mathf.Max(CdMin, s.Cd * CdMul);

        public static string Name(Sig s) => DungeonLocalization.T(s.NameKey, s.NameKo);

        /// <summary>웹 손잡이 `dungeon.allySig` — 끄면 동행은 평타만.</summary>
        public static bool Enabled = true;

        /// <summary>진단이 시각을 넣는다(음수면 <see cref="Time.time"/>).</summary>
        public static float NowOverride = -1f;
        public static float Now => NowOverride >= 0f ? NowOverride : Time.time;

        private static float _comboUntil = float.NegativeInfinity;

        public static int Sigs { get; private set; }
        public static int Combos { get; private set; }

        public static void Reset()
        {
            _comboUntil = float.NegativeInfinity;
            Sigs = Combos = 0;
        }

        /// <summary>진단이 셈을 되돌린다.</summary>
        public static void RestoreCounts(int sigs, int combos) { Sigs = sigs; Combos = combos; }

        /// <summary>선두 서명(회전베기) — 1.5초 합격 창을 연다.</summary>
        public static void OnLeadSignature(float now) => _comboUntil = now + ComboWindowSec;

        public static bool ComboOpen(float now) => now < _comboUntil;

        /// <summary>지금 쓸 까닭이 있나 — 순수(웹 allySigWants). n = 반경 안 산 적 수, strong = 그중 정예·두목급.</summary>
        public static bool Wants(int n, bool strong, bool combo) => Enabled && n > 0 && (combo || strong || n >= Crowd);

        /// <summary>한 번 썼다 — 합격이면 창을 닫는다(동행 둘이 같은 창을 두 번 못 쓴다).</summary>
        public static void OnCast(bool combo)
        {
            Sigs++;
            if (!combo) return;
            Combos++;
            _comboUntil = float.NegativeInfinity;
        }
    }
}
