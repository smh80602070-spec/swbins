using Saga.Go.Combat;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 107-8 "지역 사명 사슬"(웹 사가만리 ⑬) — 지역마다 세 단: ① 이 지역 랜드마크 발견(역참 켜기, 남쪽 공터는 옛 망루 꼭대기)
    /// ② 이 지역 무리 토벌 2 ③ 망루 수호장(남쪽 공터) 또는 이 지역 보물 상자 모두 열기. **앞에서부터 차례로** 채워진다 —
    /// 발견 전에 친 무리도 셈은 쌓이고, 발견하는 순간 둘째 단까지 넘어간다. 규칙·금 비율은 웹 그대로(단사는 이 판에 없어 경험치로).
    /// 이 판엔 탑이 옛 망루 하나뿐이라 나머지 지역의 "발견"은 역참이 대신한다. 서쪽 숲길·너른 강은 역참이 없어 사명이 없다.
    /// </summary>
    public static class GoRegionMission
    {
        public enum Final { Guardian, Chests }

        public struct Mission
        {
            public string RegionId;
            public int Grade;
            /// <summary>첫 단 — 이 역참을 켠다. null 이면 옛 망루 꼭대기(지도 밝히기).</summary>
            public string WaypointId;
            public Final Final;
        }

        public const int Stages = 3;
        public const int ClearsNeeded = 2;
        public const int Stage2GoldPerGrade = 80;
        public const int Stage2ExpPerGrade = 20;
        public const int FinalGoldPerGrade = 200;
        public const int FinalExpPerGrade = 60;

        /// <summary>등급 — 마을에서 먼 곳일수록, 수호장이 서는 남쪽 공터는 수호장 등급(3)과 같게.</summary>
        public static readonly Mission[] Missions =
        {
            new Mission { RegionId = "east_grove",  Grade = 1, WaypointId = "wp_east",  Final = Final.Chests },
            new Mission { RegionId = "north_foot",  Grade = 1, WaypointId = "wp_north", Final = Final.Chests },
            new Mission { RegionId = "south_glade", Grade = 3, WaypointId = null,       Final = Final.Guardian },
            new Mission { RegionId = "farmland",    Grade = 2, WaypointId = "wp_farm",  Final = Final.Chests },
        };

        /// <summary>순수 단 계산 — 몇 단까지 채웠나(0~3). 앞 단이 막히면 뒤 단은 조건이 맞아도 안 센다.</summary>
        public static int StageOf(bool found, int clears, bool finalDone)
        {
            if (!found) return 0;
            if (clears < ClearsNeeded) return 1;
            return finalDone ? 3 : 2;
        }

        public static int IndexOf(string regionId)
        {
            for (int i = 0; i < Missions.Length; i++) if (Missions[i].RegionId == regionId) return i;
            return -1;
        }

        public static bool LandmarkDone(Mission m) => m.WaypointId == null ? WorldMapState.Revealed : WorldMapState.IsActive(m.WaypointId);

        public static bool FinalDone(Mission m)
        {
            if (m.Final == Final.Guardian) return GuardianState.Defeated;
            ChestProgress(m.RegionId, out int opened, out int total);
            return opened >= total;
        }

        public static void ChestProgress(string regionId, out int opened, out int total)
        {
            opened = total = 0;
            foreach (var c in GoTreasure.Chests)
            {
                if (GoWorldMap.RegionAt(TestMapData.WorldPos(c.Gx, c.Gy)) != regionId) continue;
                total++;
                if (GoTreasure.IsOpened(c)) opened++;
            }
        }

        /// <summary>무리 id → 그 무리 한가운데가 선 지역(수호장은 무리가 아니다 → null).</summary>
        public static string RegionOfGroup(string groupId) => FieldSpawner.GroupRegion(groupId);
    }
}
