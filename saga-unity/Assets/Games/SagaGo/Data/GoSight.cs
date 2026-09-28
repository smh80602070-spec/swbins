using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-3b "원소 시야"(웹 사가고 ⑲-3 · saga-godot 106 ⑬) — 짚는 거리·흔적 점 규칙·빛깔만 모은 순수 정적 클래스.
    /// 누르는 동안 세상이 잿빛이 되고 83m 안의 찾을 것(안 연 상자 금빛 · 구슬 하늘빛 · 꺼진 석등 제 원소 빛 · 못 간 역참·정상·망루 흰빛 · 들판 적 원소 빛, 맨몸은 붉게)이
    /// 빛기둥으로 서며, 148m 안 가장 가까운 상자·구슬 쪽으로 4m 마다 빛 점(최대 14)이 깔린다. 거리는 웹 45m·80m·2.2m × 1.85.
    /// </summary>
    public static class GoSight
    {
        public enum Mark { Chest, Orb, Torch, Landmark, Enemy }

        public const float Range = 83f;
        public const float TrailRange = 148f;
        public const float TrailSpacing = 4f;
        public const int TrailMax = 14;
        public const float FadeSec = 0.2f;
        public const float RippleSec = 0.7f;
        public const float RefreshSec = 0.25f;
        public const float Saturation = -70f;
        public const float Exposure = -0.6f;

        public static readonly Color ChestColor = new Color(1f, 0.8f, 0.3f);
        public static readonly Color OrbColor = new Color(0.55f, 0.85f, 1f);
        public static readonly Color LandmarkColor = Color.white;
        public static readonly Color BareFoeColor = new Color(1f, 0.28f, 0.22f);

        public static Color ColorOf(Mark m, GoElement el = GoElement.Physical)
        {
            switch (m)
            {
                case Mark.Chest: return ChestColor;
                case Mark.Orb: return OrbColor;
                case Mark.Torch: return GoElements.ColorOf(el);
                case Mark.Landmark: return LandmarkColor;
                default: return el == GoElement.Physical ? BareFoeColor : GoElements.ColorOf(el);
            }
        }

        public static bool InRange(Vector3 from, Vector3 to, float range)
        {
            Vector3 d = to - from;
            d.y = 0f;
            return d.magnitude <= range;
        }

        /// <summary>흔적 점 — from 에서 to 쪽으로 4m 마다, to 에 닿기 전까지, 최대 14(높이는 부르는 쪽이 땅에 맞춘다).</summary>
        public static List<Vector3> Trail(Vector3 from, Vector3 to)
        {
            var list = new List<Vector3>();
            Vector3 d = to - from;
            d.y = 0f;
            float len = d.magnitude;
            if (len < TrailSpacing) return list;
            Vector3 dir = d / len;
            for (int k = 1; k <= TrailMax && k * TrailSpacing < len; k++)
                list.Add(from + dir * (k * TrailSpacing));
            return list;
        }
    }
}
