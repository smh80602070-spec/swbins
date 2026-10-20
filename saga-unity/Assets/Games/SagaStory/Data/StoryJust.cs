using System;

namespace Saga.Story.Data
{
    /// <summary>
    /// tasks U-0142 저스트 회피 — 웹 `saga-web/saga-story/js/side-just.js`(W-0282)·고돗 G-0233 짝. 상수 그대로.
    /// 회피 무적(<see cref="StoryPlayerHp.DodgeLeft"/>, 0.12초) 안에 두목 패턴 판정이 닿으면(<see cref="StoryPlayerHp.Hurt"/> 무적 가지)
    /// 0.8초 슬로(판정 dt ×0.35 — 전역 timeScale 아님, 두목 러너만) + 다음 한 타 ×1.3 · 쿨 4초.
    /// 순수 상태(세이브 없음) — 번쩍·소리·알림은 <see cref="Happened"/> 를 듣는 몸 쪽(`StoryPlayerVitals`)이 낸다.
    /// **웹과 다름**: 웹 scale(dt) 는 줄이기와 배율을 한 번에 했지만 이 판은 두목 러너가 여럿일 수 있어
    /// 시계는 <see cref="Tick"/>(플레이어 한 걸음에 한 번), 배율은 <see cref="Scale"/>(값만)로 나눴다.
    /// </summary>
    public static class StoryJust
    {
        public const float Window = 0.15f, SlowSec = 0.8f, SlowMul = 0.35f, NextMul = 1.3f, CdSec = 4f;

        public static float SlowLeft { get; private set; }
        public static float CdLeft { get; private set; }
        public static float Bonus { get; private set; } = 1f;
        /// <summary>진단 — 저스트 횟수(이번 켬).</summary>
        public static int Count { get; private set; }

        /// <summary>저스트가 났다(몸 쪽이 번쩍·소리·알림).</summary>
        public static event Action Happened;

        /// <summary>무적 중인 나에게 판정이 닿았다 — 회피 무적 창 안이고 쿨이 아니면 저스트.</summary>
        public static bool Evaded(float dodgeLeft)
        {
            if (!(dodgeLeft > 0f) || CdLeft > 0f) return false;
            if (dodgeLeft < Math.Max(0f, StoryPlayerHp.DodgeInvuln - Window)) return false; // 창(0.15)이 무적(0.12)보다 길어 지금은 늘 참
            SlowLeft = SlowSec;
            CdLeft = CdSec;
            Bonus = NextMul;
            Count++;
            Happened?.Invoke();
            return true;
        }

        /// <summary>한 걸음 — 쿨·슬로를 실제 dt 로 줄인다.</summary>
        public static void Tick(float dt)
        {
            if (CdLeft > 0f) CdLeft = Math.Max(0f, CdLeft - dt);
            if (SlowLeft > 0f) SlowLeft = Math.Max(0f, SlowLeft - dt);
        }

        /// <summary>판정 dt — 슬로 중이면 ×0.35.</summary>
        public static float Scale(float dt) => SlowLeft > 0f ? dt * SlowMul : dt;

        /// <summary>한 타가 한 번 꺼내 쓰고 지운다.</summary>
        public static float TakeNextMul()
        {
            float b = Bonus;
            Bonus = 1f;
            return b;
        }

        public static void Reset()
        {
            SlowLeft = 0f;
            CdLeft = 0f;
            Bonus = 1f;
        }
    }
}
