using System;

namespace Saga.Story.Data
{
    /// <summary>
    /// tasks U-0230 ① 룬(고돗 G-0382 역이식 · 메이플스토리 룬 — 구조만). 들판에 90~180초마다 플레이어 앞 7m 에 룬 — 닿으면 화살표 넷을 6초 안에
    /// 차례로 맞히기(방향키·폰 화살 단추) → 10분 동안 들판 처치 경험치 ×2 · 틀리거나 6초 넘기면 사라짐. 메모리만(세이브 안 함).
    /// 셈은 순수(시각은 넘겨 받음), 런타임은 `World/StoryRuneSpot`. 손잡이 `SAGA_RUNE=0`.
    /// </summary>
    public static class StoryRune
    {
        public const float MinGap = 90f, MaxGap = 180f, Ahead = 7f, TouchR = 1.2f, InputSec = 6f, BuffSec = 600f, BuffMul = 2f;
        public const int Arrows = 4;
        public static readonly string[] ArrowText = { "←", "↑", "→", "↓" };

        public static bool On = Environment.GetEnvironmentVariable("SAGA_RUNE") != "0";

        /// <summary>시각(초) 출처 — 런타임은 Time.time, 진단은 붙든다.</summary>
        public static Func<float> Now = () => UnityEngine.Time.time;
        public static float BuffUntil { get; private set; } = -1f;
        public static bool Buffed => BuffUntil > Now();
        /// <summary>들판 처치 경험치 배율 — 룬 덤 동안 2.</summary>
        public static float ExpMul => Buffed ? BuffMul : 1f;

        /// <summary>n 번째 룬까지의 틈(초, 순수).</summary>
        public static float GapOf(int n) => MinGap + (MaxGap - MinGap) * (Hash(n, 7) % 1000) / 999f;

        /// <summary>n 번째 룬의 화살표 넷(0←·1↑·2→·3↓, 순수).</summary>
        public static int[] SequenceOf(int n)
        {
            var a = new int[Arrows];
            for (int i = 0; i < Arrows; i++) a[i] = (int)(Hash(n, 100 + i) % 4);
            return a;
        }

        public static void GrantBuff() => BuffUntil = Now() + BuffSec;
        public static void ResetForTest() => BuffUntil = -1f;

        private static uint Hash(int a, int b)
        {
            uint h = 2166136261u;
            foreach (int v in new[] { a, b }) for (int k = 0; k < 4; k++) { h ^= (uint)((v >> (8 * k)) & 0xff); h *= 16777619u; }
            return h;
        }
    }
}
