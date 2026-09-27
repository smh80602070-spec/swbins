using UnityEngine;

namespace Saga.Go.Combat
{
    // 옛 셋(화·수·뇌)의 번호는 그대로 둔다 — 진단·옛 코드가 쓴다(PLAN.md 109-14-1a).
    public enum GoElement { Physical = 0, Pyro = 1, Hydro = 2, Electro = 3, Anemo = 4, Cryo = 5, Geo = 6, Dendro = 7 }

    public enum GoReaction
    {
        None, Vaporize, Overload, ElectroCharged,
        // 109-14-1a(웹 사가고 ⑲-1)
        Melt, Frozen, Superconduct, Swirl, Crystallize, Bloom, Burning, Quicken,
        Aggravate, Spread, Shatter,
    }

    /// <summary>
    /// PLAN.md 107-1 "원소 3·반응 3" → **109-14-1a "원소 7·반응 13"**(웹 사가고 ⑲-1 · saga-godot 106 ⑭⑮) — 규칙표만 모은 순수 정적 클래스(코드는 따로).
    /// 물리(기본 공격)는 부착도 반응도 없다. 풍·암은 붙지 않고 받는 원소(화·수·뇌·빙)에만 반응한다(회오리·굳힘). 반응은 붙은 원소를 지운다(싹틈 상태는 남는다).
    /// 옛 반응 셋(물안개·터짐·물벼락)의 수치는 107 에서 이 트랙 축척으로 맞춘 값 그대로, 새 반응은 Godot 칸 배수 그대로·반지름만 × 1.85(GO 사람 키 3.4m).
    /// 이름은 웹 표시 이름(원작 용어를 안 쓴다 — 웹 ⑳).
    /// </summary>
    public static class GoElements
    {
        public const float AuraSec = 6f;
        public const float VaporizeMul = 1.5f;
        public const float OverloadRadius = 7f;      // GO 사람 키 3.4m 기준(Godot 4m × 약 1.85)
        public const float OverloadAtkMul = 1.0f;
        public const float OverloadKnockback = 6f;
        public const float ChargedSec = 2f;
        public const float ChargedTickSec = 0.5f;
        public const float ChargedTickAtkMul = 0.3f;
        public const float ChargedSpreadRadius = 4f;

        // ---- 109-14-1a 새 반응(Godot 106 ⑭ 칸 배수, 반지름 × 1.85) ----
        public const float MeltMul = 1.5f;
        public const float FrozenSec = 2.5f;
        public const float ShatterMul = 1.5f;
        public const float SuperRadius = 5.5f;       // 3m
        public const float SuperAtkMul = 0.5f;
        public const float SuperSec = 8f;
        public const float SuperPhysMul = 1.4f;
        public const float SwirlRadius = 7.4f;       // 4m
        public const float SwirlAtkMul = 0.6f;
        public const float CrystalHpFrac = 0.2f;
        public const float CrystalSec = 15f;
        public const float BloomRadius = 5.5f;       // 3m
        public const float BloomDelay = 1.5f;
        public const float BloomAtkMul = 1.5f;
        public const int BurningTicks = 8;
        public const float BurningTickSec = 0.5f;
        public const float BurningAtkMul = 0.2f;
        public const float QuickenSec = 8f;
        public const float QuickenMul = 1.25f;

        // ---- 107 ⑤ 원소 쓰는 적 — 원소 방패·덤벼 맞힐 때 상태 ----
        public const float ShieldPhysicalMul = 0.4f;
        public const float ShieldCounterMul = 2.5f;
        public const float ShieldBreakStaggerSec = 2f;
        public const int BurnTicks = 3;
        public const float BurnTickSec = 1f;
        public const float BurnMul = 0.2f;        // 그 타격 피해의 비율, 한 번마다
        public const float WetStaminaLoss = 25f;
        public const float ShockEnergyLoss = 25f;
        // 109-14-1a 새 원소 적에게 맞으면 — 풍 휘말림 · 빙 한기 · 암 짓눌림 · 초 중독(화상 자리)
        public const float SweptSkillCdAdd = 2f;
        public const float ChillSec = 3f;
        public const float CrushMul = 0.3f;
        public const int PoisonTicks = 4;
        public const float PoisonTickSec = 1f;
        public const float PoisonMul = 0.15f;

        /// <summary>일곱 원소, 옛 셋 먼저.</summary>
        public static readonly GoElement[] All = { GoElement.Pyro, GoElement.Hydro, GoElement.Electro, GoElement.Anemo, GoElement.Cryo, GoElement.Geo, GoElement.Dendro };

        /// <summary>109-14-1a 원소가 일곱으로 늘어 옛 동행 원소가 바뀌었다는 안내를 했는가(세이브 `el7Noticed`).</summary>
        public static bool SevenNoticed;

        /// <summary>적에게 붙는 원소인가 — 물리·풍·암은 안 붙는다.</summary>
        public static bool Attaches(GoElement e) => e != GoElement.Physical && e != GoElement.Anemo && e != GoElement.Geo;

        /// <summary>회오리·굳힘이 받는 원소(화·수·뇌·빙).</summary>
        public static bool Swirlable(GoElement e) => e == GoElement.Pyro || e == GoElement.Hydro || e == GoElement.Electro || e == GoElement.Cryo;

        /// <summary>그 방패 원소를 크게 깎는 원소 — 수>화 · 뇌>수 · 화>뇌 · 암>풍 · 화>빙 · 초>암 · 풍>초.</summary>
        public static GoElement CounterOf(GoElement shield)
        {
            switch (shield)
            {
                case GoElement.Pyro: return GoElement.Hydro;
                case GoElement.Hydro: return GoElement.Electro;
                case GoElement.Electro: return GoElement.Pyro;
                case GoElement.Anemo: return GoElement.Geo;
                case GoElement.Cryo: return GoElement.Pyro;
                case GoElement.Geo: return GoElement.Dendro;
                case GoElement.Dendro: return GoElement.Anemo;
                default: return GoElement.Physical;
            }
        }

        /// <summary>상성 — attacker 가 shield 원소 방패를 누르는가.</summary>
        public static bool Counters(GoElement attacker, GoElement shield) =>
            attacker != GoElement.Physical && CounterOf(shield) == attacker;

        /// <summary>원소 방패에 들어가는 배율 — 같은 원소 0(면역) · 물리 0.4(바위 방패는 1) · 상성 2.5 · 나머지 1.</summary>
        public static float ShieldMul(GoElement shield, GoElement incoming)
        {
            if (incoming == GoElement.Physical) return shield == GoElement.Geo ? 1f : ShieldPhysicalMul;
            if (incoming == shield) return 0f;
            return Counters(incoming, shield) ? ShieldCounterMul : 1f;
        }

        /// <summary>주인공의 원소 — 동료는 <see cref="ForMember"/>.</summary>
        public const GoElement HeroElement = GoElement.Pyro;

        /// <summary>붙은 원소에 새 원소가 닿았을 때(웹 `react`). 같은 원소·물리·반응 없는 쌍은 None.</summary>
        public static GoReaction Resolve(GoElement aura, GoElement incoming)
        {
            if (aura == GoElement.Physical || incoming == GoElement.Physical || aura == incoming) return GoReaction.None;
            if (incoming == GoElement.Anemo) return Swirlable(aura) ? GoReaction.Swirl : GoReaction.None;
            if (incoming == GoElement.Geo) return Swirlable(aura) ? GoReaction.Crystallize : GoReaction.None;
            if (!Attaches(aura)) return GoReaction.None;
            if (Pair(aura, incoming, GoElement.Pyro, GoElement.Hydro)) return GoReaction.Vaporize;
            if (Pair(aura, incoming, GoElement.Pyro, GoElement.Electro)) return GoReaction.Overload;
            if (Pair(aura, incoming, GoElement.Hydro, GoElement.Electro)) return GoReaction.ElectroCharged;
            if (Pair(aura, incoming, GoElement.Pyro, GoElement.Cryo)) return GoReaction.Melt;
            if (Pair(aura, incoming, GoElement.Hydro, GoElement.Cryo)) return GoReaction.Frozen;
            if (Pair(aura, incoming, GoElement.Electro, GoElement.Cryo)) return GoReaction.Superconduct;
            if (Pair(aura, incoming, GoElement.Hydro, GoElement.Dendro)) return GoReaction.Bloom;
            if (Pair(aura, incoming, GoElement.Pyro, GoElement.Dendro)) return GoReaction.Burning;
            if (Pair(aura, incoming, GoElement.Electro, GoElement.Dendro)) return GoReaction.Quicken;
            return GoReaction.None; // 빙↔초
        }

        private static bool Pair(GoElement a, GoElement b, GoElement x, GoElement y) =>
            (a == x && b == y) || (a == y && b == x);

        /// <summary>동료 id → 원소. 도감 인물은 제 원소(일곱 — 109-14-1a 부터 암·빙·초·풍 인물의 원소가 바뀐다), 도감 밖(산적)은 옛 셋 해시 그대로
        /// (웹 ⑲-1 은 해시 % 7 이지만, 이 트랙 107 상자 퍼즐이 주인공 화 + 산적 수로 풀리게 짜여 있어 산적은 안 바꾼다).
        /// string.GetHashCode 는 런타임마다 다를 수 있어 FNV-1a 를 직접 쓴다.</summary>
        public static GoElement ForMember(string id)
        {
            if (string.IsNullOrEmpty(id)) return HeroElement;
            if (Saga.Go.Data.GoHeroes.TryGet(id, out var hero)) return Saga.Go.Data.GoHeroes.ElementOf(hero); // 109-6 도감 인물은 제 원소
            uint h = 2166136261;
            foreach (char c in id)
            {
                h ^= c;
                h *= 16777619;
            }
            return (GoElement)(1 + (int)(h % 3));
        }

        public static Color ColorOf(GoElement e)
        {
            switch (e)
            {
                case GoElement.Pyro: return new Color(1f, 0.45f, 0.2f);
                case GoElement.Hydro: return new Color(0.25f, 0.6f, 1f);
                case GoElement.Electro: return new Color(0.72f, 0.45f, 1f);
                case GoElement.Anemo: return new Color(0.37f, 0.88f, 0.74f);  // 웹 #5fe0bd
                case GoElement.Cryo: return new Color(0.68f, 0.92f, 1f);      // #aeeaff
                case GoElement.Geo: return new Color(0.93f, 0.72f, 0.3f);     // #eeb84c
                case GoElement.Dendro: return new Color(0.55f, 0.85f, 0.22f); // #8cd938
                default: return new Color(0.85f, 0.85f, 0.85f);
            }
        }

        public static string NameOf(GoElement e)
        {
            switch (e)
            {
                case GoElement.Pyro: return Saga.Go.Data.GoLocalization.T("field.el.pyro", "화");
                case GoElement.Hydro: return Saga.Go.Data.GoLocalization.T("field.el.hydro", "수");
                case GoElement.Electro: return Saga.Go.Data.GoLocalization.T("field.el.electro", "뇌");
                case GoElement.Anemo: return Saga.Go.Data.GoLocalization.T("field.el.anemo", "풍");
                case GoElement.Cryo: return Saga.Go.Data.GoLocalization.T("field.el.cryo", "빙");
                case GoElement.Geo: return Saga.Go.Data.GoLocalization.T("field.el.geo", "암");
                case GoElement.Dendro: return Saga.Go.Data.GoLocalization.T("field.el.dendro", "초");
                default: return Saga.Go.Data.GoLocalization.T("field.el.physical", "물리");
            }
        }

        public static string NameOf(GoReaction r)
        {
            switch (r)
            {
                case GoReaction.Vaporize: return Saga.Go.Data.GoLocalization.T("field.re.vaporize", "물안개");
                case GoReaction.Overload: return Saga.Go.Data.GoLocalization.T("field.re.overload", "터짐");
                case GoReaction.ElectroCharged: return Saga.Go.Data.GoLocalization.T("field.re.charged", "물벼락");
                case GoReaction.Melt: return Saga.Go.Data.GoLocalization.T("field.re.melt", "녹임");
                case GoReaction.Frozen: return Saga.Go.Data.GoLocalization.T("field.re.frozen", "얼어붙음");
                case GoReaction.Superconduct: return Saga.Go.Data.GoLocalization.T("field.re.superconduct", "서리번개");
                case GoReaction.Swirl: return Saga.Go.Data.GoLocalization.T("field.re.swirl", "회오리");
                case GoReaction.Crystallize: return Saga.Go.Data.GoLocalization.T("field.re.crystallize", "굳힘");
                case GoReaction.Bloom: return Saga.Go.Data.GoLocalization.T("field.re.bloom", "꽃피움");
                case GoReaction.Burning: return Saga.Go.Data.GoLocalization.T("field.re.burning", "들불");
                case GoReaction.Quicken: return Saga.Go.Data.GoLocalization.T("field.re.quicken", "싹틈");
                case GoReaction.Aggravate: return Saga.Go.Data.GoLocalization.T("field.re.aggravate", "번개싹");
                case GoReaction.Spread: return Saga.Go.Data.GoLocalization.T("field.re.spread", "덩굴뻗음");
                case GoReaction.Shatter: return Saga.Go.Data.GoLocalization.T("field.re.shatter", "깨뜨림");
                default: return "";
            }
        }

        /// <summary>반응 글자 빛깔 — 옛 셋은 107 빛깔, 새 것은 웹처럼 그 반응의 원소 빛.</summary>
        public static Color ColorOf(GoReaction r)
        {
            switch (r)
            {
                case GoReaction.Vaporize: return new Color(1f, 0.8f, 0.4f);
                case GoReaction.Overload: return new Color(1f, 0.4f, 0.65f);
                case GoReaction.ElectroCharged: return new Color(0.6f, 0.55f, 1f);
                case GoReaction.Melt: case GoReaction.Burning: return ColorOf(GoElement.Pyro);
                case GoReaction.Frozen: case GoReaction.Superconduct: case GoReaction.Shatter: return ColorOf(GoElement.Cryo);
                case GoReaction.Swirl: return ColorOf(GoElement.Anemo);
                case GoReaction.Crystallize: return ColorOf(GoElement.Geo);
                case GoReaction.Bloom: case GoReaction.Quicken: case GoReaction.Spread: return ColorOf(GoElement.Dendro);
                case GoReaction.Aggravate: return ColorOf(GoElement.Electro);
                default: return Color.white;
            }
        }
    }
}
