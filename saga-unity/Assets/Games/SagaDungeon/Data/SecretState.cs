using System;

namespace Saga.Dungeon.Data
{
    /// <summary>비결을 거는 자리 — 이 트랙 무예 셋(`PlayerCombat` 평타·강공격·회전베기).</summary>
    public enum SecretMove { Attack, Heavy, Whirl }

    /// <summary>웹 §5.9 비결 다섯(순서 = 열리는 순서). 세이브는 이 정수값을 쓴다 — 순서를 바꾸지 않는다.</summary>
    public enum Secret { None, Rage, Frost, Spread, Swift, Leech }

    /// <summary>
    /// PLAN.md 109-10 첫 조각 — 웹 사가나락 §5.9 "비결(秘訣)"(디아블로3 스킬 룬): 무예 하나의 쓰임을 다섯 갈래로.
    /// 웹은 무예 120 × 단수 1~5 인데 이 트랙 무예는 셋(평타·강공격·회전베기)뿐이고 단수가 없다 — 그래서
    /// **무예 셋에 비결 하나씩**, 단수 대신 **영웅 레벨**로 연다(단 = 1 + (Lv−1)/2, 단마다 하나 → Lv 1·3·5·7·9).
    /// 수치는 웹 그대로이되 이 트랙에 없는 축은 이렇게 옮겼다:
    /// - 분노 기력 ×1.4 → **재냉각 ×1.4**(이 판엔 기력이 없고 쿨다운이 유일한 대가 — `PlayerCombat` 클래스 주석).
    /// - 한기 결→빙·지속형 지속 ×1.4 → 원소·지속 피해가 없어 **맞은 적을 얼린다**(기본 냉기 2초 × 1.4 = 2.8초,
    ///   그동안 쫓기·공격 준비가 ×0.6 — `DungeonEnemy.Chill`).
    /// - 확산 범위 ×1.35·발수 +2 → 회전베기는 반경 ×1.35, 한 명을 치는 평타·강공격은 사거리 ×1.35 + 곁의 둘 더.
    /// - 흡혈 3초 12% — 그 무예를 쓴 순간부터 3초 동안 세 무예로 준 피해의 12% 를 되찾는다.
    /// 세이브 v11 `secrets` = 무예 순서 정수 셋. 레벨이 모자라면(웹의 환원) 고른 값은 남기되 없는 것으로 읽는다.
    /// </summary>
    public static class SecretState
    {
        public const int MoveCount = 3;
        public const int SecretCount = 5;
        public const int MaxRank = 5;

        public const float RageDamage = 1.45f;
        public const float RageCooldown = 1.4f;
        public const float FrostDamage = 0.9f;
        public const float FrostChillSec = 2f * 1.4f;
        public const float ChillSlow = 0.6f;
        public const float SpreadDamage = 0.8f;
        public const float SpreadRange = 1.35f;
        public const int SpreadExtraTargets = 2;
        public const float SwiftDamage = 0.7f;
        public const float SwiftCooldown = 0.5f;
        public const float LeechDamage = 0.9f;
        public const float LeechSec = 3f;
        public const float LeechFrac = 0.12f;

        /// <summary>PLAN.md 109-10-2 비전(웹 §5.10 `LORE_MUL`) — 든 무기의 비전과 같은 비결을 건 무예 위력 배율.</summary>
        public const float LoreMul = 1.6f;

        private static readonly Secret[] Chosen = new Secret[MoveCount];
        private static float _leechUntil = -1f;
        private static float _leechCarry;

        /// <summary>고른 비결이 바뀌면(패널·복원) — 버튼 딱지가 다시 그린다.</summary>
        public static event Action Changed;

        /// <summary>지금 단(1~5) — 레벨 둘마다 하나.</summary>
        public static int Rank => RankAt(HeroState.Level);
        public static int RankAt(int level) => Math.Min(MaxRank, 1 + Math.Max(0, level - 1) / 2);

        /// <summary>이 비결이 열리는 레벨(없음 = 1).</summary>
        public static int UnlockLevel(Secret s) => s == Secret.None ? 1 : 1 + 2 * ((int)s - 1);
        public static bool IsUnlocked(Secret s) => HeroState.Level >= UnlockLevel(s);

        /// <summary>고른 그대로(잠겼어도) — 패널이 "Lv.n 에 다시 살아남"을 보일 때.</summary>
        public static Secret Picked(SecretMove m) => Chosen[(int)m];

        /// <summary>실제로 먹는 비결 — 잠긴 것은 없는 것으로 읽는다.</summary>
        public static Secret Of(SecretMove m)
        {
            var s = Chosen[(int)m];
            return IsUnlocked(s) ? s : Secret.None;
        }

        /// <summary>고르기. 이미 먹고 있는 것을 다시 고르면 풀린다(없음). 잠긴 것은 false.</summary>
        public static bool Choose(SecretMove m, Secret s)
        {
            if (!IsUnlocked(s)) return false;
            Chosen[(int)m] = Of(m) == s ? Secret.None : s;
            Changed?.Invoke();
            return true;
        }

        public static float DamageMul(SecretMove m)
        {
            float lore = LoreBoosts(m) ? LoreMul : 1f;
            switch (Of(m))
            {
                case Secret.Rage: return RageDamage * lore;
                case Secret.Frost: return FrostDamage * lore;
                case Secret.Spread: return SpreadDamage * lore;
                case Secret.Swift: return SwiftDamage * lore;
                case Secret.Leech: return LeechDamage * lore;
                default: return 1f;
            }
        }

        // ── 비전(PLAN.md 109-10-2, 웹 §5.10)
        // 웹: 전설 한 점에 비전 하나, 선두가 입으면 그 비결을 건 무예 위력 ×1.6, 같은 비전 두 점은 안 겹친다.
        // 이 트랙은 무기 한 칸(`HeroState.EquipIfBetter`)이라 늘 한 점 — 겹침은 저절로 없다. 보석엔 비전이 없다.
        // 부서짐·미확인·부르기 수 +1 은 이 트랙에 없는 축이라 뺐다. 세이브도 없다(무기 id 에서 읽는다).

        /// <summary>지금 든 무기의 비전(없으면 없음).</summary>
        public static Secret EquippedLore => HeroState.EquippedWeapon?.Lore ?? Secret.None;

        /// <summary>이 무예의 비결이 든 무기 비전과 같은가.</summary>
        public static bool LoreBoosts(SecretMove m)
        {
            var s = Of(m);
            return s != Secret.None && s == EquippedLore;
        }

        /// <summary>웹 비전 이름 다섯 — 노화·빙혼·만상·섬광·혈해(비결 순서).</summary>
        public static string LoreName(Secret s)
        {
            switch (s)
            {
                case Secret.Rage: return DungeonLocalization.T("lore.rage", "노화");
                case Secret.Frost: return DungeonLocalization.T("lore.frost", "빙혼");
                case Secret.Spread: return DungeonLocalization.T("lore.spread", "만상");
                case Secret.Swift: return DungeonLocalization.T("lore.swift", "섬광");
                case Secret.Leech: return DungeonLocalization.T("lore.leech", "혈해");
                default: return "";
            }
        }

        /// <summary>물건 설명 줄 — "비전 노화 — 분노를 건 무예 위력 ×1.6"(없으면 빈 글).</summary>
        public static string LoreLine(Secret s) => s == Secret.None ? "" :
            string.Format(DungeonLocalization.T("lore.line", "비전 {0} — {1} 을(를) 건 무예 위력 ×1.6"), LoreName(s), Name(s));

        public static float CooldownMul(SecretMove m)
        {
            switch (Of(m))
            {
                case Secret.Rage: return RageCooldown;
                case Secret.Swift: return SwiftCooldown;
                default: return 1f;
            }
        }

        /// <summary>사거리(평타·강공격) 또는 반경(회전베기) 배율.</summary>
        public static float RangeMul(SecretMove m) => Of(m) == Secret.Spread ? SpreadRange : 1f;

        /// <summary>한 명을 치는 무예가 곁에서 더 때리는 수 — 회전베기는 원래 다 친다.</summary>
        public static int ExtraTargets(SecretMove m) =>
            m != SecretMove.Whirl && Of(m) == Secret.Spread ? SpreadExtraTargets : 0;

        public static float ChillSec(SecretMove m) => Of(m) == Secret.Frost ? FrostChillSec : 0f;

        /// <summary>무예를 쓴 순간(피해 전) — 흡혈이면 3초 창을 연다.</summary>
        public static void OnCast(SecretMove m, float now)
        {
            if (Of(m) == Secret.Leech) _leechUntil = now + LeechSec;
        }

        public static bool LeechActive(float now) => now <= _leechUntil;

        /// <summary>흡혈 창 안에서 준 피해 → 되찾을 체력(정수, 모자란 끝수는 다음 타로 넘긴다).</summary>
        public static int LeechHeal(float damageDealt, float now)
        {
            if (!LeechActive(now) || damageDealt <= 0f) return 0;
            _leechCarry += damageDealt * LeechFrac;
            int heal = (int)Math.Floor(_leechCarry);
            _leechCarry -= heal;
            return heal;
        }

        public static int[] Snapshot()
        {
            var a = new int[MoveCount];
            for (int i = 0; i < MoveCount; i++) a[i] = (int)Chosen[i];
            return a;
        }

        /// <summary>null(v10 이하)·짧은 배열·모르는 값은 없음으로.</summary>
        public static void Restore(int[] saved)
        {
            for (int i = 0; i < MoveCount; i++)
            {
                int v = saved != null && i < saved.Length ? saved[i] : 0;
                Chosen[i] = v >= 0 && v <= SecretCount ? (Secret)v : Secret.None;
            }
            _leechUntil = -1f;
            _leechCarry = 0f;
            Changed?.Invoke();
        }

        public static string Name(Secret s)
        {
            switch (s)
            {
                case Secret.Rage: return DungeonLocalization.T("secret.rage", "분노");
                case Secret.Frost: return DungeonLocalization.T("secret.frost", "한기");
                case Secret.Spread: return DungeonLocalization.T("secret.spread", "확산");
                case Secret.Swift: return DungeonLocalization.T("secret.swift", "신속");
                case Secret.Leech: return DungeonLocalization.T("secret.leech", "흡혈");
                default: return DungeonLocalization.T("secret.none", "없음");
            }
        }

        /// <summary>버튼 딱지 한 글자(이 판 글꼴엔 그림 문자가 없어 글자로).</summary>
        public static string Glyph(Secret s)
        {
            switch (s)
            {
                case Secret.Rage: return DungeonLocalization.T("secret.rage_glyph", "분");
                case Secret.Frost: return DungeonLocalization.T("secret.frost_glyph", "한");
                case Secret.Spread: return DungeonLocalization.T("secret.spread_glyph", "확");
                case Secret.Swift: return DungeonLocalization.T("secret.swift_glyph", "신");
                case Secret.Leech: return DungeonLocalization.T("secret.leech_glyph", "흡");
                default: return "";
            }
        }

        /// <summary>그 무예에 걸었을 때 달라지는 것 한 줄.</summary>
        public static string Effect(Secret s, SecretMove m)
        {
            switch (s)
            {
                case Secret.Rage: return DungeonLocalization.T("secret.rage_fx", "위력 ×1.45 · 재냉각 ×1.4");
                case Secret.Frost: return DungeonLocalization.T("secret.frost_fx", "위력 ×0.9 · 맞은 적 2.8초 얼림");
                case Secret.Spread:
                    return m == SecretMove.Whirl
                        ? DungeonLocalization.T("secret.spread_fx_whirl", "위력 ×0.8 · 반경 ×1.35")
                        : DungeonLocalization.T("secret.spread_fx", "위력 ×0.8 · 사거리 ×1.35 · 곁의 둘 더");
                case Secret.Swift: return DungeonLocalization.T("secret.swift_fx", "위력 ×0.7 · 재냉각 ×0.5");
                case Secret.Leech: return DungeonLocalization.T("secret.leech_fx", "위력 ×0.9 · 3초 동안 피해의 12% 흡수");
                default: return "";
            }
        }

        public static string MoveName(SecretMove m)
        {
            switch (m)
            {
                case SecretMove.Heavy: return DungeonLocalization.T("action.heavy_attack", "강공격");
                case SecretMove.Whirl: return DungeonLocalization.T("action.whirl", "회전베기");
                default: return DungeonLocalization.T("action.attack", "공격");
            }
        }
    }
}
