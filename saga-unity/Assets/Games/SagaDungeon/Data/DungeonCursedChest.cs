using System;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// tasks U-0228 ① 저주받은 상자(고돗 G-0380 역이식 — 디아블로 3 저주받은 상자, 구조만). 한 층(판)에 하나, 싸움 방 3번째 또는 6번째(층 씨앗).
    /// 곁 3m 로 오면 열림 → 6초마다 적 둘 × 4번(24초) · 상자 둘레 9m 고리 안에서 24초 버티면 성공: 금 60×층 + 정예 처치 금 × 3
    /// (유니티 상자는 물건을 안 떨궈 웹·고돗 "전리품 셋"을 정예 금 셋으로) · 고리 밖·쓰러짐 = 실패(상자 사라짐). 셈은 순수,
    /// 런타임은 `World/DungeonCursedChestRunner`. 손잡이 `SAGA_CURSED=0`.
    /// </summary>
    public static class DungeonCursedChest
    {
        public const float OpenR = 3f, RingR = 9f, WaveSec = 6f, LastSec = 24f;
        public const int Waves = 4, PerWave = 2, GoldPerFloor = 60, EliteRolls = 3;

        public static bool On = Environment.GetEnvironmentVariable("SAGA_CURSED") != "0";

        /// <summary>이 층에서 저주 상자가 놓일 방 번호(0 부터 — 첫 방 0) · 없으면 -1(순수). 마지막 방(두목 자리)은 안 씀.</summary>
        public static int RoomFor(int floor, int roomTotal)
        {
            int want = ((floor * 131 + 17) / 7) % 2 == 0 ? 3 : 6;
            if (want >= roomTotal - 1) want = 3;
            return want < roomTotal - 1 ? want : -1;
        }

        /// <summary>t 초(열린 뒤)까지 나온 파도 수(순수) — 0초에 첫 파도.</summary>
        public static int WavesBy(float t) => t < 0f ? 0 : Math.Min(Waves, (int)(t / WaveSec) + 1);

        /// <summary>성공 보상 금(순수).</summary>
        public static int Reward(int floor, int eliteGold) => GoldPerFloor * Math.Max(1, floor) + EliteRolls * eliteGold;
    }
}
