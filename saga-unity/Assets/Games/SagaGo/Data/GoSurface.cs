using UnityEngine;
using Saga.Go.World;

namespace Saga.Go.Data
{
    /// <summary>
    /// U-0051 발 밑 지면 — 지역 id → 발소리 지면 이름(`step_&lt;지면&gt;_N`, 정본 K-0045: dirt·grass·sand·snow·stone·wood).
    /// 표만(규칙 층). 집 안은 나무, 모르는 지역은 흙. 걸음 거리(걸어서/달려서 몇 m 마다 한 번)도 여기서 정한다.
    /// </summary>
    public static class GoSurface
    {
        public const string Dirt = "dirt", Grass = "grass", Sand = "sand", Snow = "snow", Stone = "stone", Wood = "wood";

        /// <summary>코드가 부르는 지면 전부 — 진단이 정본 파일 목록에 있는지 대조한다.</summary>
        public static readonly string[] All = { Dirt, Grass, Sand, Snow, Stone, Wood };

        /// <summary>한 걸음 거리(m). 사람 키 3.4m·걷기 6m/s·달리기 10m/s 기준 초당 약 2.5·3.1걸음.</summary>
        public const float WalkStride = 2.4f, RunStride = 3.2f;
        /// <summary>이 속도(m/s) 밑이면 선 것으로 본다 · 이 속도 위면 달리는 걸음.</summary>
        public const float MinSpeed = 0.5f, RunSpeed = 8f;

        public static string OfRegion(string regionId)
        {
            switch (regionId)
            {
                case "village": case "farmland": return Dirt;
                case "west_wood": case "east_grove": case "south_glade": case "vault": return Grass;
                case "north_foot": case "skyport": case "crossing": case "sunken": case "amber": case "fork": return Stone;
                case "river": return Sand;
                case "frost": return Snow;
                default: return Dirt;
            }
        }

        public static bool InsideHouse()
        {
            foreach (var h in GoHouseInterior.All) if (h != null && h.Inside) return true;
            return false;
        }

        /// <summary>지금 이 자리의 발소리 지면(집 안 → 나무).</summary>
        public static string At(Vector3 world) => InsideHouse() ? Wood : OfRegion(GoWorldMap.RegionAt(world));

        public static string StepName(string surface) => "step_" + surface;
    }
}
