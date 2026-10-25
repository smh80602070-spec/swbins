using System;

namespace Saga.Story.Data
{
    /// <summary>
    /// tasks U-0247 4종횡 사냥터 몰이 파도(웹 W-0437 ③ hunt-wave.js · 디아블로·PoE 군단 — 구조만, 수치는 우리 것).
    /// 들판 잡졸 처치 <see cref="Every"/> 마다 「몰이」: 파도 <see cref="Waves"/>, 파도마다 <see cref="Base"/>+<see cref="Step"/>×i 마리가 주인공 양옆에서,
    /// 그 파도를 다 잡으면 다음 · 마지막 파도엔 대장 하나(엘리트 몸) · 다 잡으면 장비 <see cref="Loot"/> 번 굴림(두목 몫) · <see cref="Limit"/>초 안에 못 끝내면 흩어짐.
    /// 웹 150·4+2i → 유니티 50·3+i: 이 들판은 적 열 자리 + 30초 되살기라(엘리트 300 → 100 과 같은 비율), 파도 마리는 몸(뼈 모델) 값이 커서 폰 예산 안으로.
    /// 셈은 이번 켬만(웹과 같음 — 세이브 안 함). 몰이 몹 처치는 셈·엘리트 셈에 안 든다. 끄기 `SAGA_STORY_HUNTWAVE=0`.
    /// 이 파일은 순수 셈 — 스폰·흩어짐은 `StoryEnemySpawner`.
    /// </summary>
    public static class StoryHuntWave
    {
        public const int Every = 50, Waves = 5, Base = 3, Step = 1, Loot = 2;
        public const float Limit = 120f, SideM = 6f, GapM = 0.8f;
        public static bool On = Environment.GetEnvironmentVariable("SAGA_STORY_HUNTWAVE") != "0";

        public static int Kills { get; private set; }
        public static bool Active { get; private set; }
        /// <summary>지금 몰이 번호(1 부터, 스폰한 몹 표식) · 지금 파도(0 부터).</summary>
        public static int Id { get; private set; }
        public static int Wave { get; private set; }
        public static float TimeLeft { get; private set; }

        public static int CountOf(int wave) => Base + Step * wave;
        public static bool IsLast(int wave) => wave == Waves - 1;

        /// <summary>들판 처치 하나 — 몰이 몹·엘리트는 안 센다. 몰이를 시작할 차례면 true(Active 가 켜지고 Wave 0).</summary>
        public static bool OnFieldKill(bool waveFoe, bool elite)
        {
            if (!On || Active || waveFoe || elite) return false;
            Kills++;
            if (Kills % Every != 0) return false;
            Active = true; Id++; Wave = 0; TimeLeft = Limit;
            return true;
        }

        public enum Turn { None, NextWave, Done, Scattered }

        /// <summary>매 프레임 — 남은 몰이 몹 수를 받아 다음 할 일. NextWave 면 Wave 가 이미 올라 있다.</summary>
        public static Turn Tick(float dt, int alive)
        {
            if (!Active) return Turn.None;
            TimeLeft -= dt;
            if (TimeLeft <= 0f) { Active = false; return Turn.Scattered; }
            if (alive > 0) return Turn.None;
            Wave++;
            if (Wave >= Waves) { Active = false; return Turn.Done; }
            return Turn.NextWave;
        }

        public static void ResetForTest() { Kills = 0; Active = false; Id = 0; Wave = 0; TimeLeft = 0f; }
    }
}
