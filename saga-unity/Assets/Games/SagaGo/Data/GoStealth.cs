using System;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// tasks U-0232 몰래 다가가 등용(웹 W-0286·고돗 G-0230 짝) — 웹·고돗은 짐승 포획에 붙였지만 유니티 1만리엔 포획 조우가 없어
    /// 「싸워서 등용」(PLAN 109-6) 들판 인물에 붙인다. 순수 판정만 — 걸음·들킴 반응은 `PlayerController`·`FieldHeroes`·`FieldEnemy`.
    /// 시야 = 앞 100°·12m · 웅크리면 6m 밖은 안 보임 · 풀숲(숲 칸 'T') 안이면 걸을 땐 안 보임(달리면 보임).
    /// 들키지 않은 채 4m 안까지 다가가면 「기습」 겨루기 — 첫 타 피해 ×1.15, 굴복 문턱 체력 37.5%(웹 창 1.6배 = 깎아야 할 체력 ÷1.6).
    /// 시야 안에서 달리거나 대시하면 들킴 → 겁 많은 사람은 10m 물러서고, 사나운 사람은 곧장 겨루기(기습 없음).
    /// 손잡이 `SAGA_GO_STEALTH=0`(끄면 예전 — 늘 나를 보고 7m 에서 겨루기).
    /// </summary>
    public static class GoStealth
    {
        public const float ViewDeg = 100f;
        public const float ViewRange = 12f;
        public const float CrouchSeenRange = 6f;
        public const float AmbushRange = 4f;
        public const float AmbushFirstHitMul = 1.15f;
        public const float AmbushCatchMul = 1.6f;
        /// <summary>기습 겨루기의 굴복 문턱(최대 체력 비율) — 보통은 0(다 깎아야 굴복), 기습이면 깎을 몫이 ÷1.6.</summary>
        public static float AmbushYieldFrac => 1f - 1f / AmbushCatchMul;
        public const float CrouchSpeedMul = 0.5f;
        public const float TimidRetreat = 10f;
        public const float AlertSec = 0.4f;

        public static bool On = Environment.GetEnvironmentVariable("SAGA_GO_STEALTH") != "0";

        /// <summary>인물이 나를 보는가 — 앞 100°·12m, 웅크리면 6m 안만, 풀숲에서 걸으면 안 보임.</summary>
        public static bool Sees(Vector3 heroPos, Vector3 heroFwd, Vector3 playerPos, bool crouch, bool inGrass, bool running)
        {
            Vector3 d = playerPos - heroPos;
            d.y = 0f;
            float dist = d.magnitude;
            if (dist > ViewRange) return false;
            if (dist > 0.01f)
            {
                heroFwd.y = 0f;
                if (heroFwd.sqrMagnitude < 1e-6f) return false;
                if (Vector3.Angle(heroFwd, d) > ViewDeg * 0.5f) return false;
            }
            if (inGrass && !running) return false;
            if (crouch && dist > CrouchSeenRange) return false;
            return true;
        }

        /// <summary>풀숲 — 지도 숲 칸('T').</summary>
        public static bool InGrass(Vector3 pos)
        {
            var (gx, gy) = TestMapData.WorldToGrid(pos);
            return TestMapData.TileAt(gx, gy) == 'T';
        }

        /// <summary>성격 — 인물 id 해시로 반반(겁 = 물러섬 · 사나움 = 곧장 겨루기).</summary>
        public static bool Fierce(string heroId) => !string.IsNullOrEmpty(heroId) && GoEras.Hash(heroId) % 2 == 1;

        /// <summary>서 있는 인물이 둘러보는 방향(도) — 기본 방향에서 ±70° 를 9초 주기로(id 해시로 위상). 늘 나를 보면 뒤로 돌 수 없다.</summary>
        public static float LookYaw(string heroId, float baseYaw, float t)
        {
            float phase = (GoEras.Hash(heroId ?? "") % 360u) * Mathf.Deg2Rad;
            return baseYaw + 70f * Mathf.Sin(t * Mathf.PI * 2f / 9f + phase);
        }
    }
}
