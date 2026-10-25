using System;
using System.Security.Cryptography;
using System.Text;

namespace Saga.Go.Data
{
    /// <summary>
    /// tasks U-0227 ① 핏빛 달 밤(고돗 G-0379 `go_blood_moon.gd` 역이식 · 젤다 야숨 블러드문 — 구조만). 실제 시각 밤(21~4시, `GoNight.IsNight`) 중
    /// 다섯에 하나 꼴로 달이 붉다 — 그 밤의 날짜(1970-01-01 부터 며칠째, 새벽 4시 전이면 전날)를 `md5("blood:" + 날짜)` 앞 여섯 자리로 굴린다
    /// (고돗과 같은 식이라 같은 밤이 세 트랙에서 같이 붉다). 붉어지는 순간 쓰러진 들판 무리가 1초 뒤 일어서고(두목은 꽃 규칙 그대로),
    /// 그 밤 동안 들판 처치 경험치·정예 재료 ×2. 셈은 순수, 런타임은 `World/BloodMoonField`. 손잡이 `SAGA_BLOOD_MOON=0`(끔)·`=1`(밤이면 늘 붉음).
    /// </summary>
    public static class GoBloodMoon
    {
        public const float Chance = 0.2f, RiseSec = 1f;
        public const int LootMul = 2;

        public static bool On = Environment.GetEnvironmentVariable("SAGA_BLOOD_MOON") != "0";
        public static bool ForceRed = Environment.GetEnvironmentVariable("SAGA_BLOOD_MOON") == "1";

        /// <summary>지금 붉은 밤인가(런타임이 정한다).</summary>
        public static bool Active { get; set; }
        /// <summary>들판 처치 배율 — 붉은 밤이면 2.</summary>
        public static int Mul => Active ? LootMul : 1;

        /// <summary>그 밤 날짜가 붉은 밤인가(순수 — 고돗 `is_blood_night` 과 같은 식).</summary>
        public static bool IsBloodNight(long nightDay)
        {
            if (ForceRed) return true;
            using (var md5 = MD5.Create())
            {
                var h = md5.ComputeHash(Encoding.UTF8.GetBytes("blood:" + nightDay));
                int v = (h[0] << 16) | (h[1] << 8) | h[2];   // 앞 여섯 hex 자리
                return v / (float)0xFFFFFF < Chance;
            }
        }

        /// <summary>지금 밤의 날짜 — 1970-01-01(지역 시각) 부터 며칠째, 새벽(4시 전)이면 전날 밤(순수).</summary>
        public static long NightDay(DateTime local)
        {
            long day = (long)(local.Date - new DateTime(1970, 1, 1)).TotalDays;
            return local.Hour < GoNight.NightTo ? day - 1 : day;
        }

        /// <summary>이 시각이 붉은 밤인가 — 밤이고 그 밤 날짜가 붉다.</summary>
        public static bool RedAt(DateTime local) => On && (GoNight.AlwaysNightForTest || GoNight.IsNight(local)) && IsBloodNight(NightDay(local));
    }
}
