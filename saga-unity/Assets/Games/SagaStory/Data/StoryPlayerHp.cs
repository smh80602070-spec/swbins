using System;
using UnityEngine;

namespace Saga.Story.Data
{
    /// <summary>
    /// PLAN.md 109-11-1(2026-09-27 사용자 결정 "플레이어 체력 신설") — 이 판 플레이어는 여태 안 맞았다
    /// (`StoryCombat.StartHp` 는 값만 있었다). 웹 사가종횡 §5-9 보스 패턴전이 "피하지 못하면 피해"라
    /// 체력 축을 세운다. 최대치는 웹 `power()` 그대로 60 + 통솔 15 × 6 + 레벨 × 12 + 전직 grow.hp
    /// (Lv.1 = 162 = StartHp), 맞은 뒤 무적 0.7초(웹 HIT_COOL).
    ///
    /// **이 트랙 다름**: 피해를 주는 건 두목 패턴뿐(잡졸은 예전처럼 반격이 없다). 웹 탕약·회복 무예가 없어
    /// 5초 안 맞으면 초당 최대치의 4% 가 찬다. 세이브 없음(기력 MP 와 같은 결 — 켤 때마다 가득).
    /// 0 이 되면 `Fell` — 들판이면 입구에서 다시 일어서고 두목이 태세를 되돌리며, 비경이면 패퇴
    /// (`StoryPlayerVitals`). 웹 동료 교대 onFall(쓰러지면 다음 인물)은 이 판 교대 셋이 체력을 따로
    /// 안 가져 뺐다.
    /// </summary>
    public static class StoryPlayerHp
    {
        public const float HitCool = 0.7f;          // side.js HIT_COOL
        public const float RegenDelay = 5f;
        public const float RegenPctPerSec = 0.04f;

        public static float HpMax => 60f + 15f * 6f + StoryJobState.Level * 12f + StoryJobState.HpBonus;
        public static float Hp { get; private set; } = StoryCombat.StartHp;
        public static float Invuln { get; private set; }
        public static float SinceHurt { get; private set; } = 99f;
        /// <summary>진단 — 쓰러진 횟수(이번 켬).</summary>
        public static int Falls { get; private set; }

        public static event Action<float> Hurted;
        public static event Action Fell;

        private static float _lastMax = StoryCombat.StartHp;

        /// <summary>맞는다 — 무적 중이거나 이미 쓰러졌으면 false. 최소 1.</summary>
        /// <summary>tasks U-0093 — 무예 3택 창이 떠 있는 동안 켠다(고르는 사이 맞지 않게).</summary>
        public static bool HoldForPick { get; set; }

        public static bool Hurt(float amount)
        {
            if (amount <= 0f || Invuln > 0f || Hp <= 0f || HoldForPick) return false;
            float n = Mathf.Max(1f, StoryBossPattern.JsRound(amount));
            Hp = Mathf.Max(0f, Hp - n);
            Invuln = HitCool;
            SinceHurt = 0f;
            Hurted?.Invoke(n);
            StoryRunRank.OnHurt();   // tasks U-0093 판 등급 — 피격·연타 끊김
            if (Hp <= 0f)
            {
                Falls++;
                StoryRunRank.Finish(Time.time);   // 쓰러짐 = 판 끝
                Fell?.Invoke();
            }
            return true;
        }

        /// <summary>한 걸음 — 무적·회복. 최대치가 늘면(레벨업·전직) 는 만큼 채운다.</summary>
        public static void Tick(float dt)
        {
            float max = HpMax;
            if (max > _lastMax) Hp += max - _lastMax;
            _lastMax = max;
            Invuln = Mathf.Max(0f, Invuln - dt);
            SinceHurt += dt;
            if (Hp > 0f && SinceHurt >= RegenDelay) Hp += max * RegenPctPerSec * dt;
            Hp = Mathf.Min(Hp, max);
        }

        public static void Refill()
        {
            _lastMax = HpMax;
            Hp = _lastMax;
            Invuln = 0f;
            SinceHurt = 99f;
        }

        /// <summary>진단 — 체력을 정해 둔다(무적·회복 시계도 지움).</summary>
        public static void SetForTest(float hp)
        {
            _lastMax = HpMax;
            Hp = Mathf.Clamp(hp, 0f, _lastMax);
            Invuln = 0f;
            SinceHurt = 0f;
        }
    }
}
