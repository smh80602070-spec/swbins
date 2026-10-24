using UnityEngine;
using Saga.Go.Data;

namespace Saga.Go.Combat
{
    /// <summary>`FieldCombat` 의 일부(partial) — U-0125 잡기·던지기.</summary>
    public partial class FieldCombat
    {
        // ---- U-0125 잡기·던지기(웹 W-0277 `field-grab.js`, 거리 × 1.85) — C(폰 ✊): 2.78m 안 가장 가까운 잡몹을 0.3초 들어 올려
        // 바라보는 쪽 9.25m 로 0.45초 포물선(코드 보간 — Rigidbody 안 씀). 떨어진 자리 3.7m 안 적이 1.5초 넘어지고(던진 적도),
        // 던진 적은 잡을 때 공격력 × 1.2 물리 피해. 수호장·주간 보스·이야기 보스·인물은 안 잡히고 4.6m 밀쳐진다. 쿨 6초.
        // 키: G 는 요리 창(CookingUi)이 이미 써서 웹처럼 C.
        public const float GrabRadius = 1.5f * 1.85f, GrabCdSec = 6f, GrabThrow = 5f * 1.85f, GrabLandR = 2f * 1.85f,
            GrabDownSec = 1.5f, GrabMul = 1.2f, GrabShove = 2.5f * 1.85f, GrabLift = 0.3f, GrabFly = 0.45f, GrabArc = 2.4f;

        private class GrabJob
        {
            public FieldEnemy Foe;
            public float T, Atk;
            public Vector3 Dir, From, To;
            public bool Flying;
        }
        private GrabJob _grab;

        public float GrabCd { get; private set; }
        public FieldEnemy Held => _grab?.Foe;
        /// <summary>진단 — 날아가는 중이면 떨어질 자리.</summary>
        public Vector3? GrabLanding => _grab != null && _grab.Flying ? _grab.To : (Vector3?)null;
        /// <summary>진단 — 마지막 누름: "grab" · "shove" · "cd" · "none" · "busy".</summary>
        public string LastGrab { get; private set; }
        /// <summary>진단 — 마지막 착지에서 함께 넘어진 적 수·던진 적이 받은 피해.</summary>
        public int LastThrowDowned { get; private set; }
        public float LastThrowDmg { get; private set; }

        /// <summary>지금 누르면 잡을(밀칠) 적 — 쿨·든 중·못 싸우면 null(폰 단추가 빛나는지).</summary>
        public FieldEnemy GrabTarget() => !CanAct() || _grab != null || GrabCd > 0f ? null : NearestGrab();

        private FieldEnemy NearestGrab()
        {
            FieldEnemy best = null;
            float bestD = GrabRadius;
            foreach (var e in Snapshot())
            {
                if (!e.Grabbable && !(e.ShoveOnly && !e.Yielded)) continue;
                float d = Flat(e.transform.position - transform.position).magnitude;
                if (d <= bestD) { bestD = d; best = e; }
            }
            return best;
        }

        /// <summary>C·✊ — 잡기(보스류는 밀치기). 됐으면 true.</summary>
        public bool Grab()
        {
            if (!CanAct() || MountBlocks() || _grab != null) { LastGrab = "busy"; return false; } // U-0171 탄 동안 못 잡음
            Vector3 me = transform.position;
            if (GrabCd > 0f)
            {
                LastGrab = "cd";
                FieldDamageText.Spawn(me + Vector3.up * 2.6f, string.Format(GoLocalization.T("field.grab_cd", "✊ {0}초"), Mathf.CeilToInt(GrabCd)), Color.white, 0.9f);
                return false;
            }
            var f = NearestGrab();
            if (f == null) { LastGrab = "none"; return false; }
            Vector3 d = Flat(f.transform.position - me);
            GrabCd = GrabCdSec;
            MarkFought();
            if (f.ShoveOnly)
            {
                f.Shove(d.sqrMagnitude > 1e-6f ? d : Forward(), GrabShove);
                FieldRingFx.Spawn(f.transform.position, 1.6f * 1.85f, new Color(1f, 0.54f, 0.35f), 0.4f);
                FieldDamageText.Spawn(f.transform.position + Vector3.up * (f.BodyTop + 1.5f), GoLocalization.T("field.shove", "밀치기"), new Color(1f, 0.54f, 0.35f), 1f);
                LastGrab = "shove";
                return true;
            }
            _grab = new GrabJob { Foe = f, Atk = Atk, Dir = Forward() };
            f.BeginHold();
            if (player != null && player.Animator != null) player.Animator.SetTrigger("Attack");
            FieldRingFx.Spawn(f.transform.position, 1.2f * 1.85f, new Color(1f, 0.82f, 0.48f), 0.35f);
            FieldDamageText.Spawn(f.transform.position + Vector3.up * (f.BodyTop + 1.5f), GoLocalization.T("field.grab", "✊ 잡기"), new Color(1f, 0.82f, 0.48f), 1f);
            LastGrab = "grab";
            return true;
        }

        /// <summary>`TickTimers` 가 부른다 — 쿨이 돌고, 든 적을 머리 위로·포물선으로 옮기고, 닿으면 넘어뜨린다.</summary>
        private void TickGrab(float dt)
        {
            if (GrabCd > 0f) GrabCd = Mathf.Max(0f, GrabCd - dt);
            var g = _grab;
            if (g == null) return;
            var f = g.Foe;
            if (f == null || !f.Alive || f.HoldState == FieldEnemy.Hold.None)
            {
                if (f != null) f.EndHold(f.transform.position);
                _grab = null;
                return;
            }
            g.T += dt;
            Vector3 me = transform.position;
            if (g.T < GrabLift)
            {
                f.CarryTo(me + g.Dir * 0.6f + Vector3.up * 2.2f, false);
                return;
            }
            if (!g.Flying)
            {
                g.Flying = true;
                g.From = me + g.Dir * 0.6f + Vector3.up * 2.2f;
                g.To = f.ThrowLanding(me, me + g.Dir * GrabThrow);
            }
            float k = Mathf.Min(1f, (g.T - GrabLift) / GrabFly);
            if (k < 1f)
            {
                f.CarryTo(Vector3.Lerp(g.From, g.To, k) + Vector3.up * (GrabArc * 4f * k * (1f - k)), true);
                return;
            }
            Land(g);
        }

        private void Land(GrabJob g)
        {
            var f = g.Foe;
            _grab = null;
            f.EndHold(g.To);
            Vector3 at = f.transform.position;
            f.MarkThrownForResearch(); // tasks U-0220 종 연구 — 던진 적
            LastThrowDmg = f.TakeHit(g.Atk * GrabMul, GoElement.Physical, g.Atk * ReactMul, out _);
            f.KnockDown(GrabDownSec);
            int n = 0;
            foreach (var e in Snapshot())
            {
                if (e == f || Flat(e.transform.position - at).magnitude > GrabLandR || e.ShoveOnly) continue;
                e.KnockDown(GrabDownSec);
                n++;
            }
            LastThrowDowned = n;
            FieldRingFx.Spawn(at, GrabLandR, new Color(1f, 0.7f, 0.28f), 0.6f);
            FieldRingFx.Spawn(at, GrabLandR * 0.5f, Color.white, 0.35f);
            FieldDamageText.Spawn(at + Vector3.up * (f.BodyTop + 1.5f), GoLocalization.T("field.throw_land", "넘어뜨림") + (n > 0 ? " +" + n : ""), new Color(1f, 0.7f, 0.28f), 1.15f);
            Saga.Core.GroundDecal.Spawn(at, Saga.Core.GroundDecal.Kind.HitMark);
        }

        private void ClearGrab()
        {
            if (_grab != null && _grab.Foe != null) _grab.Foe.EndHold(_grab.Foe.transform.position);
            _grab = null;
            GrabCd = 0f;
            LastGrab = null;
            LastThrowDowned = 0;
            LastThrowDmg = 0f;
        }
    }
}
