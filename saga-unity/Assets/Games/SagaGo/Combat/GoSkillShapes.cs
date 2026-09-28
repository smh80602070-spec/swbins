using UnityEngine;
using Saga.Go.Data;

namespace Saga.Go.Combat
{
    public enum SkillShape { Circle, Thrust, Dash, Field, Summon, KitZone, Vortex } // 뒤 둘 = 109-14-11 진·소용돌이(모양 해시는 1~4 만 쓴다)

    /// <summary>
    /// PLAN.md 109-8 "인물마다 다른 원소 스킬 모양"(웹 사가고 ⑫) — 원소 스킬(E)이 동행마다 넷 중 하나:
    /// **찌르기**(겨눈 쪽 직선) · **돌진**(적 앞까지 파고들며 길 위를 친다, 짧은 무적) · **장판**(겨눈 자리에 5초 동안 1초마다 원소를 묻힌다 — 반응 굴리기) ·
    /// **소환**(곁의 등불 정령이 8초 동안 1.5초마다 가장 가까운 적 하나, 교체해도 남는다). 주인공은 원형(107-1) 그대로.
    ///
    /// 모양은 웹의 id 해시 대신 **기질**로 정한다(웹 ⑲ 순서 11 "모양 = 기질 틀 × 원소" 방향, 들판 인물의 겨루기 틀과 같은 결):
    /// 무 → 돌진 · 덕 → 찌르기 · 지 → 장판·소환 반반(id 해시) · 통 → 소환. 도감 밖 id(산적)는 해시로 넷 중 하나.
    /// 빛깔은 웹 원소 일곱(`GoHeroes.WebElement` — 전투는 셋으로 접어도 남겨 둔 값)으로 칠해 바람·얼음·바위·풀 인물이 제 빛으로 보인다(피해 원소는 셋 그대로).
    ///
    /// 거리는 이 트랙 척도로 옮겼다 — 웹 원형 4.5m 가 여기 7m 라 ×1.56. 배율은 웹 원형 ×2.2 : 여기 ×1.8 비율(×0.82)로.
    /// </summary>
    public static class GoSkillShapes
    {
        public const float Scale = FieldCombat.SkillRadius / 4.5f;

        public const float ThrustLen = 8f * Scale;
        public const float ThrustWidth = 1.6f * Scale;
        public const float ThrustMul = 2.3f;

        public const float DashLen = 6f * Scale;
        public const float DashStop = 1.2f * Scale;   // 겨눈 적 앞 이만큼에서 멈춘다
        public const float DashWidth = 1.8f * Scale;
        public const float DashSec = 0.2f;
        public const float DashInvulnSec = 0.3f;
        public const float DashMul = 2f;

        public const float FieldRadius = 4f * Scale;
        public const float FieldSec = 5f;
        public const float FieldEvery = 1f;
        public const float FieldMul = 0.5f;            // 5틱 = ×2.5, 여럿

        public const float SummonSec = 8f;
        public const float SummonEvery = 1.5f;
        public const float SummonRadius = 7f * Scale;
        public const float SummonOffset = 1.5f * Scale;
        public const float SummonMul = 0.75f;          // 6번 = ×4.5, 하나씩

        public static SkillShape ShapeOf(string memberId)
        {
            if (string.IsNullOrEmpty(memberId) || memberId == FieldCombat.HeroId) return SkillShape.Circle;
            if (GoHeroes.TryGet(memberId, out var h))
            {
                switch (h.Trait)
                {
                    case HeroTrait.Might: return SkillShape.Dash;
                    case HeroTrait.Virtue: return SkillShape.Thrust;
                    case HeroTrait.Command: return SkillShape.Summon;
                    default: return (Hash(memberId + "#shape") & 1) == 0 ? SkillShape.Field : SkillShape.Summon;
                }
            }
            return (SkillShape)(1 + (int)(Hash(memberId + "#shape") % 4));
        }

        public static string Name(SkillShape s)
        {
            switch (s)
            {
                case SkillShape.Thrust: return GoLocalization.T("field.shape.thrust", "찌르기");
                case SkillShape.Dash: return GoLocalization.T("field.shape.dash", "돌진");
                case SkillShape.Field: return GoLocalization.T("field.shape.field", "장판");
                case SkillShape.Summon: return GoLocalization.T("field.shape.summon", "소환");
                default: return GoLocalization.T("field.btn.skill", "스킬");
            }
        }

        /// <summary>스킬 빛깔 — 도감 인물은 웹 원소 일곱의 빛, 그 밖은 전투 원소 빛.</summary>
        public static Color FxColor(string memberId, GoElement fallback)
        {
            if (!GoHeroes.TryGet(memberId, out var h)) return GoElements.ColorOf(fallback);
            switch (h.WebElement)
            {
                case WebElement.Fire: return new Color(1f, 0.42f, 0.18f);
                case WebElement.Rock: return new Color(0.92f, 0.72f, 0.32f);
                case WebElement.Water: return new Color(0.25f, 0.58f, 1f);
                case WebElement.Ice: return new Color(0.68f, 0.9f, 1f);
                case WebElement.Grass: return new Color(0.45f, 0.88f, 0.3f);
                case WebElement.Wind: return new Color(0.42f, 0.95f, 0.78f);
                default: return new Color(0.74f, 0.45f, 1f); // 번개
            }
        }

        /// <summary>점 p 에서 선분 a-b 까지 수평 거리.</summary>
        public static float SegDist(Vector3 p, Vector3 a, Vector3 b)
        {
            Vector2 P = new Vector2(p.x, p.z), A = new Vector2(a.x, a.z), B = new Vector2(b.x, b.z);
            Vector2 ab = B - A;
            float t = ab.sqrMagnitude > 1e-6f ? Mathf.Clamp01(Vector2.Dot(P - A, ab) / ab.sqrMagnitude) : 0f;
            return Vector2.Distance(P, A + ab * t);
        }

        private static uint Hash(string s)
        {
            uint h = 2166136261;
            foreach (char c in s) { h ^= c; h *= 16777619; }
            return h;
        }
    }
}
