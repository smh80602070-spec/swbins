using System;

namespace Saga.Story.Data
{
    /// <summary>
    /// tasks U-0230 ⓪ 들판 되살기 · ② 사냥터 엘리트(웹 W-0429 · 메이플스토리 — 구조만). 4종횡 들판 적은 원래 한 번 잡으면 끝이었다(생성기 머리 주석) —
    /// 쓰러진 잡졸은 <see cref="RespawnSec"/> 뒤, 플레이어가 그 자리에서 <see cref="RespawnFar"/> 넘게 떨어져 있으면 같은 자리에 다시 선다(두목·비경 빼고).
    /// 엘리트: 들판 처치 <see cref="Per"/> 마다 하나가 엘리트(크기 ×1.6·체력 ×15·처치 경험치 ×10 — 4종횡엔 금·물건이 없어 웹 "전리품 셋"은 뺌),
    /// 엘리트 셋째 처치 뒤 엘리트 두목(크기 ×1.3 더·체력 ×40·60초 뒤 사라짐). 웹 300 → 100: 유니티 들판은 적 열 자리라 되살기 30초 기준 약 5분.
    /// 셈은 세션만(세이브 안 함). 손잡이 `SAGA_STORY_RESPAWN=0`(되살기 끔)·`SAGA_STORY_ELITE=0`(엘리트 끔).
    /// </summary>
    public static class StoryElite
    {
        public const int Per = 100, BossAfter = 3;
        public const float HpMul = 15f, Scale = 1.6f, ExpMul = 10f, BossHpMul = 40f, BossScaleMul = 1.3f, BossLifeSec = 60f;
        public const float RespawnSec = 30f, RespawnFar = 15f;

        public static bool RespawnOn = Environment.GetEnvironmentVariable("SAGA_STORY_RESPAWN") != "0";
        public static bool On = Environment.GetEnvironmentVariable("SAGA_STORY_ELITE") != "0";

        public enum Event { None, Elite, Boss }

        public static int Kills { get; private set; }
        public static int EliteKills { get; private set; }

        /// <summary>들판 처치 하나(순수 셈) — 엘리트를 세울 차례면 Elite, 엘리트 두목 차례면 Boss.</summary>
        public static Event OnFieldKill(bool elite, bool eliteBoss)
        {
            if (!On) return Event.None;
            if (eliteBoss) { EliteKills = 0; return Event.None; }
            if (elite)
            {
                EliteKills++;
                if (EliteKills >= BossAfter) { EliteKills = 0; return Event.Boss; }
                return Event.None;
            }
            Kills++;
            return Kills % Per == 0 ? Event.Elite : Event.None;
        }

        public static void ResetForTest() { Kills = 0; EliteKills = 0; }
        public static void SetForTest(int kills, int eliteKills) { Kills = kills; EliteKills = eliteKills; }
    }
}
