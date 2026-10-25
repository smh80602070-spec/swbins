using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// tasks U-0227 ② 들판 수수께끼(웹 W-0426 · 젤다 야숨 코록 — 구조만). 본 지도 구역(`GoZones` 144m 12칸)마다 결정적 수수께끼 셋:
    /// 외톨이 돌 들추기 · 꽃 다섯 고리를 8초 안에 차례로 밟기 · 바람개비가 가리키는 쪽에 서서 돌리기. 풀면 🌰 씨앗 하나(+경험치),
    /// 모은 수 5/15/30/60 에 숲 정령 보상(가방 칸이 없어 금·정예 재료·강화석으로 — 웹 "가방 +2칸" 대신). 풀린 자리는 `WorldEventState`
    /// `riddle_<구역>_<번호>` 로 저장(씨앗 수 = 풀린 수라 따로 안 셈 · 세이브 버전 그대로). 셈은 순수, 런타임은 `World/RiddleField`. 손잡이 `SAGA_GO_RIDDLE=0`.
    /// </summary>
    public static class GoRiddle
    {
        public enum Kind { Rock = 0, Flowers = 1, Pinwheel = 2 }

        public const int PerZone = 3, Flowers = 5, ExpPerSeed = 15, BandTries = 8, Tries = 24;
        public const float RockReach = 1.6f, FlowerRingR = 3f, FlowerStep = 0.9f, FlowerSec = 8f;
        public const float PinNear = 2f, PinFar = 5.5f, PinConeDeg = 35f, PinHoldSec = 1.2f, Inset = 16f;
        public static readonly int[] Milestones = { 5, 15, 30, 60 };

        public static bool On = Environment.GetEnvironmentVariable("SAGA_GO_RIDDLE") != "0";

        public static string Key(int zone, int k) => $"riddle_{zone}_{k}";
        public static Kind KindOf(int k) => (Kind)(k % PerZone);
        public static bool Solved(int zone, int k) => WorldEventState.IsTriggered(Key(zone, k));

        /// <summary>모은 씨앗 수 = 풀린 수수께끼 수.</summary>
        public static int Seeds
        {
            get
            {
                int n = 0;
                foreach (var id in WorldEventState.TriggeredIds) if (id.StartsWith("riddle_") && !id.StartsWith("riddle_reward_")) n++;
                return n;
            }
        }

        /// <summary>그 구역 k 번째 수수께끼의 후보 자리(attempt 번째, 순수·결정적) — 구역 안쪽 Inset 만큼 들인 사각형 안. 바람개비 방향(도)도 같이.</summary>
        public static Vector3 Candidate(Rect zoneRect, int zone, int k, int attempt, out float dirDeg)
        {
            uint h = Hash($"riddle:{zone}:{k}:{attempt}");
            float u = (h & 0xFFFF) / 65535f, v = (h >> 16) / 65535f;
            dirDeg = ((h * 2654435761u) >> 20) % 360;
            float w = zoneRect.width - Inset * 2f, d = zoneRect.height - Inset * 2f;
            // 셋이 한 곳에 몰리지 않게 구역을 세로 세 띠로 나눠 k 번째 띠 안에 — 띠 안 후보가 다 막히면(BandTries 넘음) 구역 전체에서
            if (attempt >= BandTries) return new Vector3(zoneRect.xMin + Inset + u * w, 0f, zoneRect.yMin + Inset + v * d);
            float band = d / PerZone;
            return new Vector3(zoneRect.xMin + Inset + u * w, 0f, zoneRect.yMin + Inset + (k + v) * band);
        }

        /// <summary>꽃 i 의 자리(고리 가운데 c 기준, 북쪽부터 시계 방향).</summary>
        public static Vector3 FlowerPos(Vector3 c, int i)
        {
            float a = i * Mathf.PI * 2f / Flowers;
            return c + new Vector3(Mathf.Sin(a) * FlowerRingR, 0f, Mathf.Cos(a) * FlowerRingR);
        }

        /// <summary>바람개비 판정 — 바람개비 앞(dirDeg 쪽) PinNear~PinFar·±PinConeDeg 안에 섰나(순수).</summary>
        public static bool InWind(Vector3 pin, float dirDeg, Vector3 player)
        {
            var d = new Vector2(player.x - pin.x, player.z - pin.z);
            float dist = d.magnitude;
            if (dist < PinNear || dist > PinFar) return false;
            float ang = Mathf.Atan2(d.x, d.y) * Mathf.Rad2Deg;
            return Mathf.Abs(Mathf.DeltaAngle(ang, dirDeg)) <= PinConeDeg;
        }

        /// <summary>풀었다 — 처음이면 참(씨앗 +1·경험치). 이정표에 닿으면 보상 문구를 돌려준다(없으면 null).</summary>
        public static bool Solve(int zone, int k, out string reward)
        {
            reward = null;
            if (!WorldEventState.TryTrigger(Key(zone, k))) return false;
            PlayerStats.AddExp(ExpPerSeed);
            reward = ClaimMilestones();
            return true;
        }

        /// <summary>닿은 이정표 보상을 아직 안 받았으면 준다(숲 정령). 받은 것 문구들, 없으면 null.</summary>
        public static string ClaimMilestones()
        {
            int seeds = Seeds;
            var lines = new List<string>();
            foreach (int m in Milestones)
            {
                if (seeds < m || !WorldEventState.TryTrigger($"riddle_reward_{m}")) continue;
                lines.Add(GrantMilestone(m));
            }
            return lines.Count > 0 ? string.Join(" · ", lines) : null;
        }

        private static string GrantMilestone(int m)
        {
            switch (m)
            {
                case 5: GoldState.Add(300); return GoLocalization.T("riddle.reward5", "숲 정령의 선물 — 금 300");
                case 15: for (int i = 0; i < 3; i++) TalentState.Add(GoTalent.EliteMats); return GoLocalization.T("riddle.reward15", "숲 정령의 선물 — 정예 재료 3");
                case 30: WeaponState.AddOre(3); return GoLocalization.T("riddle.reward30", "숲 정령의 선물 — 강화석 3");
                default: GoldState.Add(1500); for (int i = 0; i < 5; i++) TalentState.Add(GoTalent.EliteMats); return GoLocalization.T("riddle.reward60", "숲 정령의 선물 — 금 1500 · 정예 재료 5");
            }
        }

        /// <summary>FNV-1a(실행마다 같은 값).</summary>
        public static uint Hash(string s)
        {
            uint h = 2166136261;
            foreach (char c in s) { h ^= c; h *= 16777619; }
            return h;
        }
    }
}
