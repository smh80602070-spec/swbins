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
    /// **109-11-2 고유 기술·그로기(웹 §5-10)** — 두목마다 고유 기술 하나(`Sigs`, 웹 SIG 표 열둘 그대로)가 모든 단계
    /// 후보에 끼고, 등장 뒤 첫 기술은 늘 그것. 도넛(붙어라)·화살비(틈으로)·쇠뇌(땅에 붙어라 — 지진의 거꾸로)·
    /// 불기둥 두 박자(한 칸 옮겨 딛기)·쇠사슬(끌려가다 둘레 폭발 — 거슬러 달려라)·추적(1초 따라오다 멈춘 뒤 터짐).
    /// **그로기** — 피해를 주는 패턴(부르기 제외, 불기둥 두 박자는 하나)을 셋 잇달아 다 피하면 5초 멈춘다:
    /// 받는 피해 ×1.5, 새 패턴 없음. 한 번이라도 맞으면 셈이 0.
    ///
    /// **이 트랙 다름**: 웹 두목의 "뜸 들이다 달려들기"(돌진)가 이 판엔 없어 "패턴 동안 돌진 미룸"·그로기의
    /// "걷기·박치기 없음"은 없다. 두목 피해는 웹 spawnEnemy 공식(4 + lv × 1.6) × 두목 배율 2 인데 이 판 들판 두목은
    /// 레벨이 없어 **플레이어 레벨**을 lv 로 쓴다(`StoryCombat.BossDmgFor`). 웹 사냥터 보스 여섯은 이 판에 들판이
    /// 하나라 황건 두목(도넛)만 있고, 비경 두목은 웹 비경 보스 그대로 관문 수호장(추적) — 나머지 기술은 11-3
    /// (관문 대장 다섯)이 쓴다.
    ///
    /// **109-11-3 관문 대장(웹 §5-11)** — 이 판 관문 대장은 들판 두목의 주간 강화판이라 주마다 관문 대장 다섯
    /// (`GateCaptains`) 중 하나의 이름·고유 기술을 입는다(`GateCaptainIndex`, 주 번호 % 5). 웹 `stepSig` 그대로
    /// 고유 기술은 공용 후보에 안 끼고 따로 돈다: 첫 4초·그 뒤 8초 간격, 다른 패턴이 걸려 있으면 미룬다.
    /// 웹 관문 대장의 "제 패턴"(달려들기·내려찍기·소환)은 이 판에 없어 공용 패턴전(단계·광폭 포함)이 그 자리를 맡는다.
    ///
    /// 판정은 `Step` 하나 — 상태(`State`)만 바꾸고 바깥 일(피해·예고 그림·부하·끌어당김·알림)은 `IApi` 로 한다.
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
        /// <summary>"바닥에 발 붙임" 높이 — 웹 8px 에 이 판 CharacterController 살갗 두께를 더했다(발판은 2.2m 부터라 안 겹침). 지진·쇠뇌 공용.</summary>
        public const float QuakeFootTol = 0.3f;
        public const float SweepT = 1.8f, SweepW = 170f * Px, SweepPct = 0.55f;
        public const float SweepDistMin = 150f * Px, SweepDistJitter = 170f * Px, SweepMargin = 10f * Px;
        public const float SummonT = 0.4f, SummonDx = 90f * Px, SummonMargin = 40f * Px;
        /// <summary>웹 near — 두목은 가로 420px · 발 높이차 70px 안에서만 새 패턴을 문다.</summary>
        public const float NearDx = 420f * Px, NearDy = 70f * Px;

        // ── 109-11-2 고유 기술(웹 §5-10) ──
        public const float RingT = 1.3f, RingR = 100f * Px, RingMul = 1.1f;
        public const float VolleyT = 1.2f, VolleyR = 34f * Px, VolleyMul = 0.8f, VolleyGap = 110f * Px, VolleyJitter = 40f * Px, VolleyMargin = 20f * Px;
        public const int VolleyN = 5;
        public const float BeamT = 1.1f, BeamMul = 1.1f, BeamY = 95f * Px;
        public const float PillarT = 1.0f, PillarT2 = 0.8f, PillarW = 60f * Px, PillarGap = 120f * Px, PillarMul = 1.0f;
        public const int PillarN = 3;
        public const float PullT = 1.4f, PullV = 150f * Px, PullR = 130f * Px, PullMul = 1.4f;
        public const float ChaseT = 1.5f, ChaseLock = 0.5f, ChaseR = 70f * Px, ChaseMul = 1.4f;
        public const int GroggyN = 3;
        public const float GroggyT = 5f, GroggyMul = 1.5f;

        public enum Kind { None, Slam, Rock, Quake, Sweep, Summon, Ring, Volley, Beam, Pillar, Pull, Chase }

        /// <summary>웹 SIG 표 — 두목 id(이 트랙 키) · 이름 · 기술. 이름은 웹 그대로(가명 칭호).</summary>
        public struct Sig
        {
            public string Id;
            public string BossKo;
            public Kind Kind;
            public string NameKo;
            public string BossKey => "bp.boss." + Id;
            public string NameKey => "bp.sig." + Id;
        }

        public static readonly Sig[] Sigs =
        {
            new Sig { Id = "hwanggeon_chief", BossKo = "황건 두목", Kind = Kind.Ring, NameKo = "황천 부적진" },
            new Sig { Id = "steppe_chief", BossKo = "오랑캐 족장", Kind = Kind.Volley, NameKo = "초원 화살비" },
            new Sig { Id = "wei_commander", BossKo = "위군 도독", Kind = Kind.Beam, NameKo = "쇠뇌 일제사" },
            new Sig { Id = "rival_general", BossKo = "적국 대장군", Kind = Kind.Pillar, NameKo = "화계 불기둥" },
            new Sig { Id = "ruin_brute", BossKo = "폐도 흉장", Kind = Kind.Pull, NameKo = "쇠사슬 끌어당김" },
            new Sig { Id = "cave_wraith", BossKo = "암굴 귀장", Kind = Kind.Chase, NameKo = "귀화 추적" },
            // 관문 대장(웹 §5-11) — 11-3 이 쓴다.
            new Sig { Id = "bandit_chief", BossKo = "산채 두령", Kind = Kind.Volley, NameKo = "돌팔매 소나기" },
            new Sig { Id = "pirate_captain", BossKo = "왜구 선장", Kind = Kind.Pull, NameKo = "갈고리 끌어당김" },
            new Sig { Id = "khitan_marshal", BossKo = "거란 도통", Kind = Kind.Beam, NameKo = "기마 화살 일제사" },
            new Sig { Id = "horde_commander", BossKo = "몽골 만호장", Kind = Kind.Ring, NameKo = "만호 포위진" },
            new Sig { Id = "raider_general", BossKo = "왜장", Kind = Kind.Pillar, NameKo = "화승총 두 줄 사격" },
            new Sig { Id = "gate_guardian", BossKo = "관문 수호장", Kind = Kind.Chase, NameKo = "수호 인장 추적" },
        };

        /// <summary>109-11-3 관문 대장 다섯(웹 §5-11 마을 다섯) — 주마다 돌아가며.</summary>
        public static readonly string[] GateCaptains = { "bandit_chief", "pirate_captain", "khitan_marshal", "horde_commander", "raider_general" };
        public const float GateSigFirst = 4f, GateSigCd = 8f;

        /// <summary>이번 주(주 번호) 관문 대장의 `Sigs` 번호.</summary>
        public static int GateCaptainIndex(int week) => SigIndex(GateCaptains[((week % GateCaptains.Length) + GateCaptains.Length) % GateCaptains.Length]);

        public static int SigIndex(string id)
        {
            for (int i = 0; i < Sigs.Length; i++) if (Sigs[i].Id == id) return i;
            return -1;
        }

        public static string SigName(int index) => index >= 0 ? StoryLocalization.T(Sigs[index].NameKey, Sigs[index].NameKo) : "";
        public static string SigBoss(int index) => index >= 0 ? StoryLocalization.T(Sigs[index].BossKey, Sigs[index].BossKo) : "";

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
            // 109-11-2
            /// <summary>고유 기술(`Sigs` 번호, 없으면 −1) · 등장 뒤 첫 기술(한 번 쓰면 None).</summary>
            public int SigIndex = -1;
            public Kind First = Kind.None;
            public int Dodge;
            public float Groggy;
            public int Wave;
            public int HitAcc;
            /// <summary>도넛·쇠사슬 가운데(두목 자리) · 불기둥 격자 기준(내 발).</summary>
            public float Cx, Px;
            /// <summary>진단 — 그로기 횟수.</summary>
            public int GroggyCount;
            /// <summary>109-11-3 관문 대장 — 고유 기술이 제 시계(`SigCd`)로 따로 돈다.</summary>
            public bool Gate;
            public float SigCd;

            public Kind SigKind => SigIndex >= 0 ? Sigs[SigIndex].Kind : Kind.None;
        }

        public struct StepResult
        {
            public int Phase;
            public bool Changed;
            /// <summary>이번 걸음에 판정이 끝난 패턴(None = 판정 없음 — 불기둥 첫 박자도 None).</summary>
            public Kind Resolved;
            public int Hit;
            public bool Groggy;
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
            /// <summary>쇠사슬 — 플레이어를 가로로 dx 만큼 끈다(벽이 막으면 덜 간다).</summary>
            void PullPlayer(float dx);
            /// <summary>패턴을 걸었다 — 예고 그림·알림(상태의 Marks·SafeX·Cx 를 읽는다). 불기둥 둘째 박자도 다시 부른다.</summary>
            void Warn(Kind kind, State s);
            /// <summary>판정이 났다 — 흔들림·예고 지우기(불기둥 첫 박자도).</summary>
            void Resolved(Kind kind, int hit);
            void PhaseChanged(int phase);
            void GroggyStarted();
        }

        /// <summary>웹 Math.round 와 같은 반올림(.5 는 위로) — Mathf.Round 는 짝수 쪽이라 12.5 → 12 가 된다.</summary>
        public static float JsRound(float x) => Mathf.Floor(x + 0.5f);

        /// <summary>체력 비율 → 단계(0·1·2).</summary>
        public static int PhaseOf(float hp, float hpMax)
        {
            float r = hpMax > 0f ? hp / hpMax : 1f;
            return r > PhaseAt[0] ? 0 : (r > PhaseAt[1] ? 1 : 2);
        }

        /// <summary>이 단계에서 고를 수 있는 패턴(고유 기술이 있으면 끝에 끼운다).</summary>
        public static List<Kind> PoolOf(int phase, Kind sig = Kind.None)
        {
            List<Kind> pool;
            if (phase <= 0) pool = new List<Kind> { Kind.Slam, Kind.Rock };
            else if (phase == 1) pool = new List<Kind> { Kind.Slam, Kind.Rock, Kind.Quake, Kind.Summon };
            else pool = new List<Kind> { Kind.Slam, Kind.Rock, Kind.Quake, Kind.Sweep };
            if (sig != Kind.None) pool.Add(sig);
            return pool;
        }

        /// <summary>지금 두목 한 대의 힘 — 광폭이면 ×1.25.</summary>
        public static float DmgOf(State s, float baseDmg) => s.Phase >= 2 ? JsRound(baseDmg * EnrageMul) : baseDmg;

        /// <summary>받는 피해 배수 — 그로기 동안 ×1.5(웹 dmgTakenMul).</summary>
        public static float DamageTakenMul(State s) => s != null && s.Groggy > 0f ? GroggyMul : 1f;

        public static bool IsNear(Vector2 bossFeet, Vector2 feet) =>
            Mathf.Abs(feet.x - bossFeet.x) < NearDx && Mathf.Abs(feet.y - bossFeet.y) < NearDy;

        /// <summary>고유 기술을 건다 — 등장 뒤 첫 기술이 그것이 되게.</summary>
        public static void SetSig(State s, int sigIndex)
        {
            s.SigIndex = sigIndex;
            s.Gate = false;
            s.First = s.SigKind;
        }

        /// <summary>109-11-3 — 관문 대장 고유 기술(웹 stepSig): 첫 기술 강제 없음, 4초 뒤 첫 시전·8초 간격.</summary>
        public static void SetGateSig(State s, int sigIndex)
        {
            s.SigIndex = sigIndex;
            s.Gate = true;
            s.First = Kind.None;
            s.SigCd = GateSigFirst;
        }

        /// <summary>걸린 패턴·예고를 거둔다(단계 전환·플레이어가 쓰러져 두목이 태세를 되돌릴 때).</summary>
        public static void Clear(State s)
        {
            s.Current = Kind.None;
            s.T = 0f;
            s.Marks.Clear();
            s.SafeW = 0f;
            s.Wave = 0;
            s.HitAcc = 0;
        }

        /// <summary>처음 상태로(플레이어가 쓰러져 두목이 체력을 되찾을 때) — 첫 기술도 다시 고유 기술.</summary>
        public static void Reset(State s)
        {
            Clear(s);
            s.Phase = 0;
            s.Cd = FirstCd;
            s.Last = Kind.None;
            s.Summoned = 0;
            s.Dodge = 0;
            s.Groggy = 0f;
            s.First = s.Gate ? Kind.None : s.SigKind;
            s.SigCd = GateSigFirst;
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
            if (TickBusy(s, dt, api, ref result, baseDmg)) return result;
            // 관문 대장 고유 기술 — 제 시계로, 다른 패턴이 걸려 있으면(위 TickBusy) 미룬다.
            if (s.Gate && s.SigIndex >= 0)
            {
                s.SigCd -= dt;
                if (s.SigCd <= 0f && near)
                {
                    Begin(s, s.SigKind, api, bossX);
                    s.SigCd = GateSigCd;
                    return result;
                }
            }
            s.Cd -= dt * (s.Phase >= 2 ? EnragedCdRate : 1f);
            if (s.Cd <= 0f && near)
            {
                var pool = PoolOf(s.Phase, s.Gate ? Kind.None : s.SigKind);
                // 같은 것을 두 번 잇지 않는다 · 부르기는 단계마다 한 번.
                var cand = pool.FindAll(k => k != s.Last && !(k == Kind.Summon && s.Summoned >= s.Phase));
                if (cand.Count == 0) cand = pool;
                var pick = cand[(int)(api.Rand() * cand.Count) % cand.Count];
                if (s.First != Kind.None) { pick = s.First; s.First = Kind.None; } // 등장 뒤 첫 기술은 고유 기술
                Begin(s, pick, api, bossX);
                s.Cd = Cd[Mathf.Clamp(s.Phase, 0, Cd.Length - 1)];
            }
            return result;
        }

        /// <summary>그로기·걸린 패턴을 한 걸음 굴린다 — 이번 걸음을 여기서 끝냈으면 true.</summary>
        private static bool TickBusy(State s, float dt, IApi api, ref StepResult result, float baseDmg)
        {
            if (s.Groggy > 0f)
            {
                s.Groggy -= dt;
                result.Groggy = true;
                if (s.Groggy <= 0f) { s.Groggy = 0f; s.Cd = Mathf.Min(s.Cd, 1.0f); }
                return true;
            }
            if (s.Current == Kind.None) return false;
            s.T -= dt;
            if (s.Current == Kind.Pull && s.T > 0f)
            {
                // 쇠사슬 — 두목 쪽으로 끌린다(두목을 넘어가진 않는다).
                float pd = s.Cx - api.Feet.x;
                api.PullPlayer(Mathf.Sign(pd) * Mathf.Min(Mathf.Abs(pd), PullV * dt));
            }
            else if (s.Current == Kind.Chase && s.T > ChaseLock && s.Marks.Count > 0)
            {
                var f = api.Feet;
                s.Marks[0] = new Mark { X = f.x, Y = f.y, R = ChaseR };
            }
            if (s.T <= 0f)
            {
                var kind = s.Current;
                if (kind == Kind.Summon) Clear(s);
                else
                {
                    int rh = Resolve(s, api, DmgOf(s, baseDmg));
                    if (rh >= 0)
                    {
                        result.Hit = rh;
                        result.Resolved = kind;
                        if (s.Groggy > 0f) result.Groggy = true;
                    }
                }
            }
            return true;
        }

        /// <summary>불기둥 한 박자 — 내 발 둘레 2.4m 칸, 첫 박자는 홀수 칸(내 칸은 비었다), 둘째는 짝수 칸.</summary>
        private static void PillarMarks(State s, IApi api, int wave)
        {
            s.Marks.Clear();
            for (int k = -PillarN; k <= PillarN; k++)
            {
                if (Mathf.Abs(k) % 2 != (wave == 1 ? 1 : 0)) continue;
                float mx = s.Px + k * PillarGap;
                if (mx < api.MinX || mx > api.MaxX) continue;
                s.Marks.Add(new Mark { X = mx, Y = api.FloorY, R = PillarW });
            }
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
                case Kind.Ring:
                    s.T = RingT;
                    s.Cx = bossX;
                    break;
                case Kind.Volley:
                {
                    s.T = VolleyT;
                    float j0 = (api.Rand() - 0.5f) * VolleyJitter;
                    for (int i = 0; i < VolleyN; i++)
                    {
                        float vx = Mathf.Clamp(f.x + (i - 2) * VolleyGap + j0, api.MinX + VolleyMargin, api.MaxX - VolleyMargin);
                        s.Marks.Add(new Mark { X = vx, Y = f.y, R = VolleyR });
                    }
                    break;
                }
                case Kind.Beam:
                    s.T = BeamT;
                    break;
                case Kind.Pillar:
                    s.T = PillarT;
                    s.Wave = 1;
                    s.HitAcc = 0;
                    s.Px = f.x;
                    PillarMarks(s, api, 1);
                    break;
                case Kind.Pull:
                    s.T = PullT;
                    s.Cx = bossX;
                    break;
                case Kind.Chase:
                    s.T = ChaseT;
                    s.Marks.Add(new Mark { X = f.x, Y = f.y, R = ChaseR });
                    break;
            }
            api.Warn(kind, s);
        }

        /// <summary>판정 — 맞았으면 api.Hurt. 돌려주는 것은 맞은 수(불기둥 첫 박자는 −1 — 둘째 박자를 건다).</summary>
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
                    if (Grounded(api, f)) { hit = 1; api.Hurt(JsRound(dmg * QuakeMul), kind); }
                    break;
                case Kind.Sweep:
                    if (Mathf.Abs(f.x - s.SafeX) > s.SafeW / 2f) { hit = 1; api.Hurt(JsRound(api.HpMax * SweepPct), kind); }
                    break;
                case Kind.Ring:
                    if (Mathf.Abs(f.x - s.Cx) > RingR) { hit = 1; api.Hurt(JsRound(dmg * RingMul), kind); }
                    break;
                case Kind.Volley:
                case Kind.Chase:
                    foreach (var m in s.Marks)
                        if (Mathf.Abs(f.x - m.X) < m.R && Mathf.Abs(f.y - m.Y) < m.R * 1.6f) hit++;
                    if (hit > 0) api.Hurt(JsRound(dmg * (kind == Kind.Chase ? ChaseMul : VolleyMul)), kind);
                    break;
                case Kind.Beam:
                    // 뛰었거나 발판 위면 맞는다 — 땅에 붙어라(지진의 거꾸로).
                    if (!Grounded(api, f)) { hit = 1; api.Hurt(JsRound(dmg * BeamMul), kind); }
                    break;
                case Kind.Pillar:
                    foreach (var m in s.Marks) if (Mathf.Abs(f.x - m.X) < PillarW) hit = 1;
                    if (hit > 0) api.Hurt(JsRound(dmg * PillarMul), kind);
                    if (s.Wave == 1)
                    {
                        // 둘째 박자 — 같은 격자에서 짝수 칸. 한 칸(2.4m) 옮겨 딛어야 산다.
                        api.Resolved(kind, hit);
                        s.HitAcc = hit;
                        s.Wave = 2;
                        s.T = PillarT2;
                        PillarMarks(s, api, 2);
                        api.Warn(kind, s);
                        return -1;
                    }
                    hit = hit > 0 || s.HitAcc > 0 ? 1 : 0;
                    break;
                case Kind.Pull:
                    if (Mathf.Abs(f.x - s.Cx) < PullR) { hit = 1; api.Hurt(JsRound(dmg * PullMul), kind); }
                    break;
            }
            api.Resolved(kind, hit);
            // 그로기 셈 — 피해를 주는 패턴만(부르기는 여기 안 온다). 셋 잇달아 다 피하면 5초 멈춘다.
            if (hit > 0) s.Dodge = 0;
            else if (++s.Dodge >= GroggyN)
            {
                s.Dodge = 0;
                s.Groggy = GroggyT;
                s.GroggyCount++;
                api.GroggyStarted();
            }
            Clear(s);
            return hit;
        }

        private static bool Grounded(IApi api, Vector2 f) => api.OnGround && f.y - api.FloorY < QuakeFootTol;
    }
}
