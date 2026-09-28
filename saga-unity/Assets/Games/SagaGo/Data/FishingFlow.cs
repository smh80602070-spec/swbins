using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-24 낚시 흐름(웹 `fishing.js` step) — 고리 겨누기 → 던지기(미끼 하나) → 그 미끼 물고기가 다가와 1~3번 건드림 →
    /// 입질 1초 안에 당기기 → 줄다리기(누르면 찌가 오르고 떼면 내려감, 물고기 칸 안이면 막대 +, 밖이면 −). 화면 없이도 돈다(`Step(dt)` 하나) —
    /// 진단이 시각 없이 돌린다. 난수는 mulberry32(판마다 씨앗 고정). 물고기 자리·상태는 이번 판만(세이브는 `FishState`).
    /// 좌표는 전부 XZ 평면(`Vector2` = (x, z)).
    /// </summary>
    public sealed class FishingFlow
    {
        public enum Phase { Idle, Aim, Wait, Nibble, Bite, Reel }

        public sealed class School
        {
            public int Idx;
            public string Id;
            public Vector2 P, Target;
            public float Scared;
        }

        public const uint Seed = 20260824;

        private uint _rng = Seed;
        private readonly Dictionary<string, List<School>> _school = new Dictionary<string, List<School>>();

        public Phase State { get; private set; } = Phase.Idle;
        public GoFishing.Spot Spot { get; private set; }
        public string Bait = "honey_flower";
        public Vector2 Reticle, Float;
        public int Hooked = -1;
        public float T, Clock;
        public float ZoneC = 0.5f, ZoneW = 0.2f, Cursor = 0.5f, Progress;
        public bool Holding;
        public string Last = "";

        private float _gap = 1f, _zoneTarget = 0.5f, _zoneT, _cursorV;
        private int _nibbles;

        /// <summary>알림 글(화면이 띄운다).</summary>
        public event Action<string> Say;
        /// <summary>단계·고리·미끼가 바뀜(화면 갱신).</summary>
        public event Action Changed;
        /// <summary>물고기를 잡았다(물고기 id).</summary>
        public event Action<string> Caught;

        public bool Busy => State != Phase.Idle;

        private void Note(string text) { if (!string.IsNullOrEmpty(text)) Say?.Invoke(text); }

        private float Rand01()
        {
            _rng += 0x6D2B79F5u;
            uint r = (_rng ^ (_rng >> 15)) * (1u | _rng);
            r = (r + (r ^ (r >> 7)) * (61u | r)) ^ r;
            return (r ^ (r >> 14)) / 4294967296f;
        }

        private float Rand(float a, float b) => a + (b - a) * Rand01();

        /// <summary>진단 — 씨앗을 처음으로(물고기 자리도 다시).</summary>
        public void ResetForTest()
        {
            _rng = Seed;
            _school.Clear();
            State = Phase.Idle;
            Spot = null;
            Hooked = -1;
            Holding = false;
            Last = "";
            Clock = 0f;
        }

        private void SetState(Phase p)
        {
            State = p;
            T = 0f;
            Changed?.Invoke();
        }

        // ---- 물고기(이번 판만) ----

        private Vector2 WanderPoint(GoFishing.Spot sp)
        {
            for (int k = 0; k < 8; k++)
            {
                float a = Rand01() * Mathf.PI * 2f, r = Mathf.Sqrt(Rand01()) * GoFishing.SwimR;
                var p = sp.Cast + new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * r;
                if (GoFishing.WetAt(p)) return p;
            }
            return sp.Cast;
        }

        public List<School> Fish(GoFishing.Spot sp)
        {
            if (_school.TryGetValue(sp.Id, out var l)) return l;
            l = new List<School>();
            for (int i = 0; i < GoFishing.FishPerSpot; i++)
            {
                var p = WanderPoint(sp);
                var t = WanderPoint(sp);
                l.Add(new School { Idx = i, Id = sp.Fish[i], P = p, Target = t });
            }
            _school[sp.Id] = l;
            return l;
        }

        // ---- 시작·끝 ----

        /// <summary>할 수 있나 — 못 하면 이유 글.</summary>
        public bool BeginCheck(Vector2 p, bool fighting, string spotId, out GoFishing.Spot sp, out string why)
        {
            why = null;
            sp = null;
            if (State != Phase.Idle) { why = GoLocalization.T("fish.why.busy", "이미 낚시 중이다"); return false; }
            sp = spotId != null ? (GoFishing.TrySpot(spotId, out var s) ? s : null) : GoFishing.NearSpot(p);
            if (sp == null || Vector2.Distance(sp.Stand, p) > GoFishing.StandR) { why = GoLocalization.T("fish.why.spot", "낚시터 곁에서만 낚시할 수 있다"); return false; }
            if (fighting) { why = GoLocalization.T("fish.why.fight", "싸우는 중엔 낚시할 수 없다"); return false; }
            return true;
        }

        public bool Begin(Vector2 p, bool fighting, string spotId = null)
        {
            if (!BeginCheck(p, fighting, spotId, out var sp, out string why)) { Note(why); return false; }
            Last = "";
            Spot = sp;
            Reticle = sp.Cast;
            Float = Vector2.zero;
            Hooked = -1;
            Holding = false;
            Fish(sp);
            SetState(Phase.Aim);
            return true;
        }

        public bool End()
        {
            if (State == Phase.Idle) return false;
            ReleaseHooked(false);
            Holding = false;
            Spot = null;
            State = Phase.Idle;
            T = 0f;
            Changed?.Invoke();
            return true;
        }

        public bool SetBait(string b)
        {
            if (Array.IndexOf(GoFishing.Baits, b) < 0 || State == Phase.Reel || State == Phase.Bite || State == Phase.Nibble) return false;
            Bait = b;
            Changed?.Invoke();
            return true;
        }

        /// <summary>다음 미끼로(T 키).</summary>
        public bool CycleBait() => SetBait(GoFishing.Baits[(Array.IndexOf(GoFishing.Baits, Bait) + 1) % GoFishing.Baits.Length]);

        // ---- 고리·던지기 ----

        /// <summary>고리를 옮긴다 — dir 는 XZ 방향(정규화 안 해도 됨).</summary>
        public bool MoveReticle(Vector2 dir, float dt)
        {
            if (State != Phase.Aim || dir.sqrMagnitude < 1e-8f) return false;
            Reticle = GoFishing.ClampReticle(Spot, Reticle + dir.normalized * GoFishing.ReticleSpeed * dt, Reticle);
            Changed?.Invoke();
            return true;
        }

        /// <summary>서는 자리 기준 — along(멀리 +) · side(오른쪽 +). 폰 단추·조이스틱.</summary>
        public bool Nudge(float along, float side, float dt)
        {
            if (Spot == null) return false;
            Vector2 d = Spot.Dir, r = new Vector2(d.y, -d.x);
            return MoveReticle(d * along + r * side, dt);
        }

        public bool Cast()
        {
            if (State != Phase.Aim) return false;
            if (CookState.Count(Bait) <= 0)
            {
                Note(string.Format(GoLocalization.T("fish.no_bait", "{0}가 없다 — 재료를 모아 오자"), GoFishing.BaitName(Bait)));
                Last = "no_bait";
                return false;
            }
            if (!GoFishing.WetAt(Reticle)) { Note(GoLocalization.T("fish.need_water", "물 위에 던져야 한다")); return false; }
            CookState.Spend(Bait, 1);
            Float = Reticle;
            Hooked = -1;
            SetState(Phase.Wait);
            return true;
        }

        private void ReelIn(string reason)
        {
            ReleaseHooked(false);
            Note(reason);
            SetState(Phase.Aim);
        }

        private void ReleaseHooked(bool scared)
        {
            if (Hooked < 0 || Spot == null) { Hooked = -1; return; }
            var list = Fish(Spot);
            if (Hooked < list.Count && scared)
            {
                var f = list[Hooked];
                f.Scared = GoFishing.Scare;
                Vector2 a = f.P - Float;
                float al = a.magnitude;
                if (al < 0.1f) { a = Spot.Dir; al = 1f; }
                f.Target = Spot.Cast + a / al * GoFishing.SwimR * 0.9f;
            }
            Hooked = -1;
        }

        private void ScareOff()
        {
            Last = "scared";
            ReleaseHooked(true);
            ReelIn(GoLocalization.T("fish.scared", "너무 일찍 당겼다 — 물고기가 달아났다"));
        }

        private void Escape()
        {
            Last = "escaped";
            ReleaseHooked(true);
            ReelIn(GoLocalization.T("fish.escaped", "놓쳤다…"));
        }

        private void StartReel()
        {
            var d = GoFishing.FishOf(Fish(Spot)[Hooked].Id);
            ZoneW = d.Zone;
            ZoneC = 0.5f;
            _zoneTarget = 0.5f;
            _zoneT = 0f;
            Cursor = 0.5f;
            _cursorV = 0f;
            Progress = GoFishing.ProgressStart;
            SetState(Phase.Reel);
        }

        private void DoCatch()
        {
            var sp = Spot;
            var f = Fish(sp)[Hooked];
            var d = GoFishing.FishOf(f.Id);
            bool first = FishState.Catch(sp.Id, f.Idx, f.Id);
            Hooked = -1;
            Last = "caught:" + d.Id;
            Note(string.Format(GoLocalization.T("fish.caught", "잡았다! {0} {1} · {2}"), d.Name, d.Stars, GoEras.EraName(d.Era))
                + (first ? GoLocalization.T("fish.first", " — 처음 잡은 물고기") : ""));
            Caught?.Invoke(d.Id);
            SetState(Phase.Aim);
        }

        /// <summary>누름(true)·뗌(false) — F·큰 단추.</summary>
        public bool Press(bool down)
        {
            if (!down) { Holding = false; return true; }
            switch (State)
            {
                case Phase.Aim: return Cast();
                case Phase.Wait:
                    if (Hooked >= 0) ScareOff();
                    else { Last = "reeled"; ReelIn(""); }
                    return true;
                case Phase.Nibble: ScareOff(); return true;
                case Phase.Bite: StartReel(); Holding = true; return true;
                case Phase.Reel: Holding = true; return true;
            }
            return false;
        }

        // ---- 한 틱 ----

        private void PickApproacher()
        {
            var list = Fish(Spot);
            int best = -1;
            float bd = GoFishing.BiteR;
            for (int i = 0; i < list.Count; i++)
            {
                var f = list[i];
                if (!FishState.Present(Spot.Id, f.Idx) || f.Scared > 0f || GoFishing.FishOf(f.Id).Bait != Bait) continue;
                float d = Vector2.Distance(f.P, Float);
                if (d < bd) { bd = d; best = i; }
            }
            Hooked = best;
        }

        private void TickSchool(GoFishing.Spot sp, float dt)
        {
            var list = Fish(sp);
            bool mine = Spot != null && Spot.Id == sp.Id;
            for (int i = 0; i < list.Count; i++)
            {
                var f = list[i];
                if (!FishState.Present(sp.Id, f.Idx)) continue;
                f.Scared = Mathf.Max(0f, f.Scared - dt);
                bool hk = mine && i == Hooked;
                if (hk && State == Phase.Reel)
                {
                    f.P = Float + new Vector2(Mathf.Sin(Clock * 9f) * 0.3f, Mathf.Cos(Clock * 7f) * 0.3f);
                    continue;
                }
                Vector2 goal = hk && State != Phase.Aim ? Float : f.Target;
                float speed = hk ? GoFishing.Approach : GoFishing.Swim;
                Vector2 v = goal - f.P;
                float d = v.magnitude;
                if (d < GoFishing.Arrive)
                {
                    if (hk && State == Phase.Wait)
                    {
                        _nibbles = GoFishing.NibbleMin + Mathf.FloorToInt(Rand01() * (GoFishing.NibbleMax - GoFishing.NibbleMin + 1));
                        SetState(Phase.Nibble);
                        _gap = Rand(GoFishing.NibbleGapMin, GoFishing.NibbleGapMax);
                    }
                    else if (!hk) f.Target = WanderPoint(sp);
                }
                else f.P += v / d * Mathf.Min(speed * dt, d);
            }
        }

        private void TickReel(float dt)
        {
            var d = GoFishing.FishOf(Fish(Spot)[Hooked].Id);
            _zoneT -= dt;
            if (_zoneT <= 0f)
            {
                _zoneT = Rand(d.MoveMin, d.MoveMax);
                _zoneTarget = Rand(ZoneW * 0.5f, 1f - ZoneW * 0.5f);
            }
            float zs = dt * GoFishing.ZoneSpeed, dz = _zoneTarget - ZoneC;
            ZoneC += Mathf.Abs(dz) <= zs ? dz : (dz > 0f ? zs : -zs);
            _cursorV = Mathf.Clamp(_cursorV + (Holding ? GoFishing.PullAccel : -GoFishing.PullAccel) * dt, -GoFishing.PullVMax, GoFishing.PullVMax);
            Cursor += _cursorV * dt;
            if (Cursor <= 0f || Cursor >= 1f) { Cursor = Mathf.Clamp01(Cursor); _cursorV = 0f; }
            Progress += (GoFishing.InZone(Cursor, ZoneC, ZoneW) ? d.Gain : -d.Loss) * dt;
            if (Progress >= 1f) { Progress = 1f; DoCatch(); }
            else if (Progress <= 0f) { Progress = 0f; Escape(); }
        }

        /// <summary>한 틱 — 물고기·입질·줄다리기. p = 발 자리(XZ), fighting = 들판 전투 중.</summary>
        public void Step(float dt, Vector2 p, bool fighting)
        {
            if (!(dt > 0f)) return;
            Clock += dt;
            // 곁의 낚시터 물고기는 늘 헤엄친다(그림) — 낚시 중인 곳은 따로
            foreach (var s in GoFishing.Spots)
            {
                if (Spot != null && s.Id == Spot.Id) continue;
                if (Vector2.Distance(s.Cast, p) < 90f * GoFishing.Sc) TickSchool(s, dt);
            }
            if (State == Phase.Idle) return;
            if (fighting)
            {
                Note(GoLocalization.T("fish.fight_stop", "적이 다가온다 — 낚시를 멈춘다"));
                Last = "fight";
                End();
                return;
            }
            if (Vector2.Distance(Spot.Stand, p) > GoFishing.StandR * 2f) { Last = "left"; End(); return; }
            T += dt;
            TickSchool(Spot, dt);
            switch (State)
            {
                case Phase.Wait:
                    if (Hooked < 0) PickApproacher();
                    if (Hooked < 0 && T > GoFishing.WaitMax) { Last = "no_fish"; ReelIn(GoLocalization.T("fish.no_fish", "물고기가 오지 않는다 — 다른 미끼나 자리로")); }
                    break;
                case Phase.Nibble:
                    if (T >= _gap)
                    {
                        T = 0f;
                        _gap = Rand(GoFishing.NibbleGapMin, GoFishing.NibbleGapMax);
                        _nibbles--;
                        if (_nibbles <= 0) { SetState(Phase.Bite); Note(GoLocalization.T("fish.bite", "입질! — 지금 당겨라")); }
                    }
                    break;
                case Phase.Bite:
                    if (T > GoFishing.BiteWindow) Escape();
                    break;
                case Phase.Reel:
                    TickReel(dt);
                    break;
            }
        }
    }
}
