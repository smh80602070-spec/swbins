using UnityEngine;

namespace Saga.Go.Combat
{
    /// <summary>
    /// PLAN.md 107-1 "회피"·107 ② "스태미나 100 공용" — 달리기·회피(지금)와 등반·활공·수영(②)이
    /// 같이 쓰는 기력. 쓴 뒤 0.8초가 지나야 초당 25씩 차고, 바닥나면 30까지 달리기가 잠긴다.
    /// </summary>
    public static class GoStamina
    {
        public const float Max = 100f;
        public const float RegenPerSec = 25f;
        public const float RegenDelaySec = 0.8f;
        public const float SprintPerSec = 8f;
        public const float SprintUnlockAt = 30f;

        public static float Value { get; private set; } = Max;
        public static bool SprintLocked { get; private set; }

        private static float _sinceUse = 999f;

        /// <summary>한 번에 치르는 값(회피 등). 모자라면 안 쓰고 false.</summary>
        public static bool TrySpend(float amount)
        {
            if (Value < amount) return false;
            Value -= amount;
            _sinceUse = 0f;
            if (Value <= 0f) { Value = 0f; SprintLocked = true; }
            return true;
        }

        /// <summary>계속 닳는 값(달리기). 잠겼거나 바닥나면 false.</summary>
        public static bool Drain(float amount)
        {
            if (SprintLocked || Value <= 0f) return false;
            Value = Mathf.Max(0f, Value - amount);
            _sinceUse = 0f;
            if (Value <= 0f) SprintLocked = true;
            return true;
        }

        /// <summary>등반·활공·수영처럼 달리기 잠금과 무관하게 계속 쓰는 값. 바닥이면 false(남은 만큼은 깎는다).</summary>
        public static bool Use(float amount)
        {
            if (Value <= 0f) return false;
            Value = Mathf.Max(0f, Value - amount);
            _sinceUse = 0f;
            if (Value <= 0f) SprintLocked = true;
            return true;
        }

        /// <summary>진단용 — 값을 곧장 맞춘다.</summary>
        public static void SetForTest(float value)
        {
            Value = Mathf.Clamp(value, 0f, Max);
            SprintLocked = Value <= 0f;
            _sinceUse = 0f;
        }

        /// <summary>`PlayerController.Update` 가 프레임마다 한 번 부른다.</summary>
        /// <summary>109-14-1a 빙 적의 한기 — 이 초 동안 스태미나가 안 돈다.</summary>
        public static float RegenBlockLeft { get; private set; }

        public static void BlockRegen(float sec) => RegenBlockLeft = Mathf.Max(RegenBlockLeft, sec);

        public static void Tick(float dt)
        {
            _sinceUse += dt;
            if (RegenBlockLeft > 0f) { RegenBlockLeft = Mathf.Max(0f, RegenBlockLeft - dt); return; }
            if (_sinceUse >= RegenDelaySec && Value < Max)
            {
                Value = Mathf.Min(Max, Value + RegenPerSec * dt);
            }
            if (SprintLocked && Value >= SprintUnlockAt) SprintLocked = false;
        }

        public static void ResetFull()
        {
            RegenBlockLeft = 0f;
            Value = Max;
            SprintLocked = false;
            _sinceUse = 999f;
        }
    }
}
