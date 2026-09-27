using System.Collections.Generic;
using UnityEngine;

namespace Saga.Story.Data
{
    /// <summary>
    /// PLAN.md 109-11-1 "보스 패턴전"(웹 사가스토리 §5-9 `js/boss-pattern.js`, 2026-09-27 이식) — 순수 판정.
    /// 두목이 "제자리에 서서 맞기만" 하던 판에 읽고 피하는 싸움을 세운다:
    ///
    ///   1단계(체력 100~66%)  내려찍기(내 자리 원) · 낙석(세 줄기)
    ///   2단계(66~33%)        + 지진(바닥 전체 — 점프하거나 발판·줄 위면 산다) · 부하 둘(단계에 한 번)
    ///   3단계(33% 아래)      + 휩쓸기(초록 안전지대만 산다, 내 최대 체력의 55%) · 광폭(피해 ×1.25·간격 ×0.7)
    ///
    /// 단계가 넘어가면 포효하고 걸린 패턴을 거둔다. 같은 패턴을 잇지 않는다. 수치는 웹 그대로,
    /// 거리는 이 판 척도(`FieldMapData.ScaleMPerPx`, 50px = 1m).
    ///
    /// **이 트랙 다름**: 웹 두목의 "뜸 들이다 달려들기"(돌진)가 이 판엔 없어 "패턴 동안 돌진 미룸"은 없다.
    /// 두목 피해는 웹 spawnEnemy 공식(4 + lv × 1.6) × 두목 배율 2 인데 이 판 들판 두목은 레벨이 없어
    /// **플레이어 레벨**을 lv 로 쓴다(`StoryCombat.BossDmgFor`). 5-10 고유 기술·그로기는 다음 조각.
    ///
    /// 판정은 `Step` 하나 — 상태(`State`)만 바꾸고 바깥 일(피해·예고 그림·부하·알림)은 `IApi` 로 한다.
    /// 그래서 진단이 가짜 api 로 단계·예고·판정을 값으로 굴린다(웹 `step(e, dt, api)` 와 같은 결).
    /// </summary>
    public static class StoryBossPattern
    {
        /// <summary>웹 손잡이 `bossPattern.on` — 끄면 두목은 예전처럼 서 있기만 한다.</summary>
        public static bool Enabled = true;
        /// <summary>웹 손잡이 `bossPattern.enrage`.</summary>
        public static float EnrageMul = 1.25f;

        private const float Px = FieldMapData.ScaleMPerPx;

        public static readonly float[] PhaseAt = { 0.66f, 0.33f };
        public static readonly float[] Cd = { 6.5f, 5.0f, 3.8f };   // 단계별 패턴 간격(초)
        public const float FirstCd = 3.2f;                          // 싸움이 붙고 첫 패턴까지
        public const float RoarCd = 1.4f;                           // 포효 뒤 곧 새 패턴
        public const float EnragedCdRate = 1f / 0.7f;               // 광폭 — 간격 ×0.7

        public const float SlamT = 1.0f, SlamR = 80f * Px, SlamMul = 1.3f;
        public const float RockT = 1.1f, RockR = 40f * Px, RockMul = 0.9f;
        public const int RockN = 3;
        public const float RockOffMin = 130f * Px, RockOffJitter = 50f * Px, RockMargin = 30f * Px;
        public const float QuakeT = 1.2f, QuakeMul = 1.2f;
        /// <summary>지진 판정의 "바닥에 발 붙임" 높이 — 웹 8px 에 이 판 CharacterController 살갗 두께를 더했다(발판은 2.2m 부터라 안 겹침).</summary>
        public const float QuakeFootTol = 0.3f;
        public const float SweepT = 1.8f, SweepW = 170f * Px, SweepPct = 0.55f;
        public const float SweepDistMin = 150f * Px, SweepDistJitter = 170f * Px, SweepMargin = 10f * Px;
        public const float SummonT = 0.4f, SummonDx = 90f * Px, SummonMargin = 40f * Px;
        /// <summary>웹 near — 두목은 가로 420px · 발 높이차 70px 안에서만 새 패턴을 문다.</summary>
        public const float NearDx = 420f * Px, NearDy = 70f * Px;

        public enum Kind { None, Slam, Rock, Quake, Sweep, Summon }

        public struct Mark
        {
            public float X, Y, R;
        }

        public class State
        {
            public int Phase;
            public float Cd = FirstCd;
            public Kind Current = Kind.None;
            public Kind Last = Kind.None;
            public float T;
            public readonly List<Mark> Marks = new List<Mark>();
            public float SafeX, SafeW;
            public int Summoned;
            /// <summary>진단 — 건 패턴 수(부르기 포함).</summary>
            public int Begun;
        }

        public struct StepResult
        {
            public int Phase;
            public bool Changed;
            /// <summary>이번 걸음에 판정이 난 패턴(None = 판정 없음).</summary>
            public Kind Resolved;
            public int Hit;
        }

        /// <summary>판정 모듈이 바깥에 부탁하는 일 — 웹 `bpApi()` 자리.</summary>
        public interface IApi
        {
            /// <summary>플레이어 발(x, y) — 이 판은 transform 원점이 발이다.</summary>
            Vector2 Feet { get; }
            /// <summary>땅(바닥·발판)에 서 있나 — 뛰었거나 줄에 매달리면 false.</summary>
            bool OnGround { get; }
            float MinX { get; }
            float MaxX { get; }
            float FloorY { get; }
            /// <summary>플레이어 최대 체력(휩쓸기 55%).</summary>
            float HpMax { get; }
            float Rand();
            void Hurt(float amount, Kind kind);
            void Spawn(float x);
            /// <summary>패턴을 걸었다 — 예고 그림·알림(상태의 Marks·SafeX 를 읽는다).</summary>
            void Warn(Kind kind, State s);
            /// <summary>판정이 났다 — 흔들림·예고 지우기.</summary>
            void Resolved(Kind kind, int hit);
            void PhaseChanged(int phase);
        }

        /// <summary>웹 Math.round 와 같은 반올림(.5 는 위로) — Mathf.Round 는 짝수 쪽이라 12.5 → 12 가 된다.</summary>
        public static float JsRound(float x) => Mathf.Floor(x + 0.5f);

        /// <summary>체력 비율 → 단계(0·1·2).</summary>
        public static int PhaseOf(float hp, float hpMax)
        {
            float r = hpMax > 0f ? hp / hpMax : 1f;
            return r > PhaseAt[0] ? 0 : (r > PhaseAt[1] ? 1 : 2);
        }

        /// <summary>이 단계에서 고를 수 있는 패턴.</summary>
        public static List<Kind> PoolOf(int phase)
        {
            if (phase <= 0) return new List<Kind> { Kind.Slam, Kind.Rock };
            if (phase == 1) return new List<Kind> { Kind.Slam, Kind.Rock, Kind.Quake, Kind.Summon };
            return new List<Kind> { Kind.Slam, Kind.Rock, Kind.Quake, Kind.Sweep };
        }

        /// <summary>지금 두목 한 대의 힘 — 광폭이면 ×1.25.</summary>
        public static float DmgOf(State s, float baseDmg) => s.Phase >= 2 ? JsRound(baseDmg * EnrageMul) : baseDmg;

        public static bool IsNear(Vector2 bossFeet, Vector2 feet) =>
            Mathf.Abs(feet.x - bossFeet.x) < NearDx && Mathf.Abs(feet.y - bossFeet.y) < NearDy;

        /// <summary>걸린 패턴·예고를 거둔다(단계 전환·플레이어가 쓰러져 두목이 태세를 되돌릴 때).</summary>
        public static void Clear(State s)
        {
            s.Current = Kind.None;
            s.T = 0f;
            s.Marks.Clear();
            s.SafeW = 0f;
        }

        /// <summary>처음 상태로(플레이어가 쓰러져 두목이 체력을 되찾을 때).</summary>
        public static void Reset(State s)
        {
            Clear(s);
            s.Phase = 0;
            s.Cd = FirstCd;
            s.Last = Kind.None;
            s.Summoned = 0;
        }

        /// <summary>한 걸음. near = 두목이 나를 보고 있나(`IsNear`). hp·hpMax 는 두목 것.</summary>
        public static StepResult Step(State s, float dt, IApi api, bool near, float hp, float hpMax, float bossX, float baseDmg)
        {
            var result = new StepResult { Phase = s.Phase };
            int ph = PhaseOf(hp, hpMax);
            if (ph > s.Phase)
            {
                s.Phase = ph;
                Clear(s);
                s.Cd = RoarCd;
                result.Phase = ph;
                result.Changed = true;
                api.PhaseChanged(ph);
                return result;
            }
            if (s.Current != Kind.None)
            {
                s.T -= dt;
                if (s.T <= 0f)
                {
                    var kind = s.Current;
                    if (kind == Kind.Summon) Clear(s);
                    else
                    {
                        result.Hit = Resolve(s, api, DmgOf(s, baseDmg));
                        result.Resolved = kind;
                    }
                }
                return result;
            }
            s.Cd -= dt * (s.Phase >= 2 ? EnragedCdRate : 1f);
            if (s.Cd <= 0f && near)
            {
                var pool = PoolOf(s.Phase);
                // 같은 것을 두 번 잇지 않는다 · 부르기는 단계마다 한 번.
                var cand = pool.FindAll(k => k != s.Last && !(k == Kind.Summon && s.Summoned >= s.Phase));
                if (cand.Count == 0) cand = pool;
                var pick = cand[(int)(api.Rand() * cand.Count) % cand.Count];
                Begin(s, pick, api, bossX);
                s.Cd = Cd[Mathf.Clamp(s.Phase, 0, Cd.Length - 1)];
            }
            return result;
        }

        /// <summary>패턴을 건다 — 예고를 먼저 내고, T 초 뒤 `Resolve` 가 판정한다.</summary>
        public static void Begin(State s, Kind kind, IApi api, float bossX)
        {
            var f = api.Feet;
            s.Current = kind;
            s.Last = kind;
            s.Begun++;
            s.Marks.Clear();
            s.SafeW = 0f;
            switch (kind)
            {
                case Kind.Slam:
                    s.T = SlamT;
                    s.Marks.Add(new Mark { X = f.x, Y = f.y, R = SlamR });
                    break;
                case Kind.Rock:
                    s.T = RockT;
                    float[] off = { 0f, -(RockOffMin + api.Rand() * RockOffJitter), RockOffMin + api.Rand() * RockOffJitter };
                    for (int i = 0; i < RockN; i++)
                    {
                        float mx = Mathf.Clamp(f.x + off[i], api.MinX + RockMargin, api.MaxX - RockMargin);
                        s.Marks.Add(new Mark { X = mx, Y = f.y, R = RockR });
                    }
                    break;
                case Kind.Quake:
                    s.T = QuakeT;
                    break;
                case Kind.Sweep:
                {
                    s.T = SweepT;
                    float side = api.Rand() < 0.5f ? -1f : 1f;
                    float dist = SweepDistMin + api.Rand() * SweepDistJitter;
                    float lo = api.MinX + SweepW / 2f + SweepMargin, hi = api.MaxX - SweepW / 2f - SweepMargin;
                    float sx = f.x + side * dist;
                    if (sx < lo || sx > hi) sx = f.x - side * dist;
                    s.SafeX = Mathf.Clamp(sx, lo, hi);
                    s.SafeW = SweepW;
                    break;
                }
                case Kind.Summon:
                    s.T = SummonT;
                    s.Summoned++;
                    api.Spawn(Mathf.Max(api.MinX + SummonMargin, bossX - SummonDx));
                    api.Spawn(Mathf.Min(api.MaxX - SummonMargin, bossX + SummonDx));
                    break;
            }
            api.Warn(kind, s);
        }

        /// <summary>판정 — 맞았으면 api.Hurt. 돌려주는 것은 맞은 수.</summary>
        public static int Resolve(State s, IApi api, float dmg)
        {
            var f = api.Feet;
            var kind = s.Current;
            int hit = 0;
            switch (kind)
            {
                case Kind.Slam:
                case Kind.Rock:
                    foreach (var m in s.Marks)
                        if (Mathf.Abs(f.x - m.X) < m.R && Mathf.Abs(f.y - m.Y) < m.R * 0.9f) hit++;
                    if (hit > 0) api.Hurt(JsRound(dmg * (kind == Kind.Slam ? SlamMul : RockMul)), kind);
                    break;
                case Kind.Quake:
                    // 바닥에 발을 붙인 채면 맞는다 — 뛰었거나 발판·줄 위면 산다.
                    if (api.OnGround && f.y - api.FloorY < QuakeFootTol) { hit = 1; api.Hurt(JsRound(dmg * QuakeMul), kind); }
                    break;
                case Kind.Sweep:
                    if (Mathf.Abs(f.x - s.SafeX) > s.SafeW / 2f) { hit = 1; api.Hurt(JsRound(api.HpMax * SweepPct), kind); }
                    break;
            }
            api.Resolved(kind, hit);
            Clear(s);
            return hit;
        }
    }
}
