using UnityEngine;

namespace Saga.Go.Combat
{
    public enum GoElement { Physical = 0, Pyro = 1, Hydro = 2, Electro = 3 }

    public enum GoReaction { None, Vaporize, Overload, ElectroCharged }

    /// <summary>
    /// PLAN.md 107-1 "원소 3·반응 3" — 규칙표만 모은 순수 정적 클래스(웹·Godot 사가고와
    /// 비율만 같고 코드는 따로). 물리(기본 공격)는 부착도 반응도 없다. 반응은 부착을 지운다.
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

        // ---- 107 ⑤ 원소 쓰는 적 — 원소 방패·덤벼 맞힐 때 상태 ----
        public const float ShieldPhysicalMul = 0.4f;
        public const float ShieldCounterMul = 2.5f;
        public const float ShieldBreakStaggerSec = 2f;
        public const int BurnTicks = 3;
        public const float BurnTickSec = 1f;
        public const float BurnMul = 0.2f;        // 그 타격 피해의 비율, 한 번마다
        public const float WetStaminaLoss = 25f;
        public const float ShockEnergyLoss = 25f;

        /// <summary>상성 — 수가 화를, 뇌가 수를, 화가 뇌를 누른다.</summary>
        public static bool Counters(GoElement attacker, GoElement shield) =>
            (attacker == GoElement.Hydro && shield == GoElement.Pyro) ||
            (attacker == GoElement.Electro && shield == GoElement.Hydro) ||
            (attacker == GoElement.Pyro && shield == GoElement.Electro);

        /// <summary>원소 방패에 들어가는 배율 — 같은 원소 0(면역) · 물리 0.4 · 상성 2.5 · 나머지 1.</summary>
        public static float ShieldMul(GoElement shield, GoElement incoming)
        {
            if (incoming == GoElement.Physical) return ShieldPhysicalMul;
            if (incoming == shield) return 0f;
            return Counters(incoming, shield) ? ShieldCounterMul : 1f;
        }

        /// <summary>주인공의 원소 — 동료는 <see cref="ForMember"/>.</summary>
        public const GoElement HeroElement = GoElement.Pyro;

        public static GoReaction Resolve(GoElement aura, GoElement incoming)
        {
            if (aura == GoElement.Physical || incoming == GoElement.Physical || aura == incoming) return GoReaction.None;
            if (Pair(aura, incoming, GoElement.Pyro, GoElement.Hydro)) return GoReaction.Vaporize;
            if (Pair(aura, incoming, GoElement.Pyro, GoElement.Electro)) return GoReaction.Overload;
            return GoReaction.ElectroCharged; // 남은 짝은 수↔뇌뿐
        }

        private static bool Pair(GoElement a, GoElement b, GoElement x, GoElement y) =>
            (a == x && b == y) || (a == y && b == x);

        /// <summary>동료 id → 원소(화·수·뇌 중 하나로 고정). string.GetHashCode 는 런타임마다
        /// 다를 수 있어 FNV-1a 를 직접 쓴다.</summary>
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
                default: return "";
            }
        }

        public static Color ColorOf(GoReaction r)
        {
            switch (r)
            {
                case GoReaction.Vaporize: return new Color(1f, 0.8f, 0.4f);
                case GoReaction.Overload: return new Color(1f, 0.4f, 0.65f);
                case GoReaction.ElectroCharged: return new Color(0.6f, 0.55f, 1f);
                default: return Color.white;
            }
        }
    }
}
