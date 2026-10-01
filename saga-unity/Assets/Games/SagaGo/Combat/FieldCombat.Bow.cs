using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.Go.Combat
{
    /// <summary>`FieldCombat` 의 일부(partial) — tasks U-0010 분할.</summary>
    public partial class FieldCombat
    {
        public static bool IsBow(Member m) => m != null && WeaponState.ModsOf(m.Id).Weapon.Type == GoWeapons.Type.Bow;
        public bool CanAim => CanAct() && IsBow(Active) && !StoryState.Talking && (player == null || !player.IsDashing);
        public Vector3 AimDir => Quaternion.Euler(0f, AimYaw, 0f) * Vector3.forward;

        public bool ToggleAim() { if (AimOn) { ExitAim(); return false; } return EnterAim(); }

        /// <summary>그 점 쪽으로 겨눈다(진단·지도 표식 누르기 등).</summary>
        public void AimToward(Vector3 p)
        {
            if (!AimOn) return;
            Vector3 d = p - transform.position;
            d.y = 0f;
            if (d.sqrMagnitude < 0.01f) return;
            AimYaw = Quaternion.LookRotation(d).eulerAngles.y;
            Rig?.SetAim(true, AimYaw);
            UpdateLock();
        }

        public bool EnterAim()
        {
            if (AimOn) return true;
            if (!CanAim) return false;
            AimOn = true;
            _aimFromHold = false;
            Charging = false;
            AimCharge = 0f;
            Vector3 f = player != null && player.Visual != null ? player.Visual.forward : transform.forward;
            f.y = 0f;
            AimYaw = f.sqrMagnitude > 0.001f ? Quaternion.LookRotation(f).eulerAngles.y : 0f;
            if (player != null) { player.MoveLocked = true; player.AimCancelled = false; }
            Rig?.SetAim(true, AimYaw);
            UpdateLock();
            return true;
        }

        public void ExitAim()
        {
            if (!AimOn) return;
            AimOn = false;
            Charging = false;
            _aimFromHold = false;
            AimCharge = 0f;
            AimLock = default;
            if (player != null) player.MoveLocked = false;
            Rig?.SetAim(false);
            if (_lockRing != null) _lockRing.enabled = false;
        }

        /// <summary>한 박자(프레임마다 · 진단도 부른다) — turn = 좌우 입력(−1~1).</summary>
        public void TickAim(float dt, float turn)
        {
            if (!AimOn) return;
            if ((player != null && player.AimCancelled) || !CanAim) { if (player != null) player.AimCancelled = false; ExitAim(); return; }
            AimYaw = Mathf.Repeat(AimYaw + turn * AimTurnRad * Mathf.Rad2Deg * dt, 360f);
            Rig?.SetAim(true, AimYaw);
            if (player != null) player.FaceToward(transform.position + AimDir * 5f);
            if (Charging) AimCharge = Mathf.Min(AimChargeSec, AimCharge + dt);
            UpdateLock();
        }

        /// <summary>겨눈 쪽 ±0.16 라디안·74m 안 가장 곧은 것에 잠근다(같은 층의 적 · 상자 과녁 · 상자 석등 · 이야기 석등·제단).</summary>
        private void UpdateLock()
        {
            Vector3 o = transform.position, dir = AimDir;
            var best = new AimLockInfo();
            float bestA = AimLockRad, bestD = float.MaxValue;
            void Consider(Vector3 p, AimLockInfo info)
            {
                Vector3 v = p - o;
                v.y = 0f;
                float d = v.magnitude;
                if (d < 1f || d > AimRange) return;
                float a = Mathf.Acos(Mathf.Clamp(Vector3.Dot(v / d, dir), -1f, 1f));
                if (a < bestA - 1e-4f || (Mathf.Abs(a - bestA) <= 1e-4f && d < bestD)) { bestA = a; bestD = d; info.Point = p; best = info; }
            }
            foreach (var e in Snapshot()) Consider(e.transform.position + Vector3.up * 1.2f, new AimLockInfo { Kind = AimKind.Enemy, Enemy = e });
            var b = Saga.Go.World.WorldMapBuilder.Instance;
            if (b != null)
                foreach (var c in b.Chests)
                {
                    if (c == null || c.Opened || c.Unlocked) continue;
                    for (int i = 0; i < c.Targets.Count; i++) Consider(c.TargetEye(i), new AimLockInfo { Kind = AimKind.Target, Chest = c, Index = i });
                    foreach (var t in c.Torches) if (t != null && !t.Lit) Consider(t.transform.position + Vector3.up * 1.5f, new AimLockInfo { Kind = AimKind.Point });
                }
            var sf = Saga.Go.World.StoryField.Instance;
            if (sf != null) foreach (var p in sf.AimPoints()) Consider(p, new AimLockInfo { Kind = AimKind.Point });
            AimLock = best;
            ShowLockRing();
        }

        private void ShowLockRing()
        {
            if (AimLock.Kind == AimKind.None) { if (_lockRing != null) _lockRing.enabled = false; return; }
            if (_lockRing == null)
            {
                var go = new GameObject("AimLockRing");
                _lockRing = go.AddComponent<LineRenderer>();
                _lockRing.useWorldSpace = false;
                _lockRing.loop = true;
                _lockRing.positionCount = 24;
                _lockRing.widthMultiplier = 0.12f;
                _lockRing.material = new Material(Shader.Find("Sprites/Default")) { name = "AimLock (generated)" };
                _lockRing.startColor = _lockRing.endColor = new Color(1f, 0.82f, 0.3f, 0.95f);
                _lockRing.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                for (int k = 0; k < 24; k++)
                {
                    float a = k * Mathf.PI * 2f / 24f;
                    _lockRing.SetPosition(k, new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0f) * 0.9f);
                }
            }
            _lockRing.enabled = true;
            _lockRing.transform.position = AimLock.Point;
            var cam = Camera.main;
            if (cam != null) _lockRing.transform.rotation = Quaternion.LookRotation(AimLock.Point - cam.transform.position);
        }

        /// <summary>쏜다 — 잠긴 점으로(적이면 따라간다), 없으면 겨눈 쪽으로. 쏜 화살 수(0 = 못 쏨).</summary>
        public int FireArrow()
        {
            var m = Active;
            if (m == null || m.Down) return 0;
            bool full = AimCharge >= AimChargeSec - 1e-4f;
            AimCharge = 0f;
            GoElement el = full || m.InfuseLeft > 0f ? m.Element : GoElement.Physical;
            float amount = Atk * (full ? ArrowFullMul : ArrowWeakMul) * TalentMul(GoTalent.Kind.Normal) * DmgMul(m.Id, "n", el) * (m.InfuseLeft > 0f ? m.InfuseMul : 1f);
            Vector3 o = transform.position + Vector3.up * 1.6f;
            var lk = AimLock;
            Vector3 aimAt = lk.Kind != AimKind.None ? lk.Point : o + AimDir * ArrowRange;
            var a = new Arrow { Pos = o, Dir = (aimAt - o).normalized, Left = ArrowRange, Amount = amount, React = Atk * ReactMul, El = el, Full = full, Owner = m.Id,
                Target = lk.Kind == AimKind.Enemy ? lk.Enemy : null, HasStop = lk.Kind == AimKind.Target || lk.Kind == AimKind.Point, Stop = lk.Point, Chest = lk.Chest, Index = lk.Index };
            var vis = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            vis.name = "Arrow";
            Destroy(vis.GetComponent<Collider>());
            vis.transform.localScale = new Vector3(0.08f, 0.7f, 0.08f);
            var col = full ? GoElements.ColorOf(el) : new Color(0.85f, 0.8f, 0.7f);
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Arrow (generated)", color = col };
            if (full) { mat.EnableKeyword("_EMISSION"); mat.SetColor("_EmissionColor", col * 2f); }
            vis.GetComponent<MeshRenderer>().sharedMaterial = mat;
            a.Vis = vis;
            PlaceArrow(a);
            _arrows.Add(a);
            if (player != null && player.Animator != null) player.Animator.SetTrigger("Attack");
            return 1;
        }

        private static void PlaceArrow(Arrow a)
        {
            if (a.Vis == null) return;
            a.Vis.transform.position = a.Pos;
            a.Vis.transform.rotation = Quaternion.FromToRotation(Vector3.up, a.Dir);
        }

        private void TickArrows(float dt)
        {
            for (int i = _arrows.Count - 1; i >= 0; i--)
            {
                var a = _arrows[i];
                if (a.Target != null && a.Target.Alive) a.Dir = (a.Target.transform.position + Vector3.up * 1.2f - a.Pos).normalized; // 잠긴 적을 따라간다
                float step = Mathf.Min(ArrowSpeed * dt, a.Left);
                Vector3 next = a.Pos + a.Dir * step;
                bool done = false;
                if (a.HasStop && Vector3.Distance(a.Pos, a.Stop) <= step + 1e-3f) { Land(a, a.Stop); done = true; }
                else
                {
                    FieldEnemy hit = null;
                    float hitT = float.MaxValue;
                    foreach (var e in Snapshot())
                    {
                        Vector3 c = e.transform.position + Vector3.up * 1.2f;
                        float t = Mathf.Clamp01(Vector3.Dot(c - a.Pos, a.Dir) / Mathf.Max(step, 1e-4f));
                        float r = Mathf.Max(ArrowBodyR, e.transform.lossyScale.y * 0.9f);
                        if (Vector3.Distance(a.Pos + a.Dir * step * t, c) <= r && t < hitT) { hitT = t; hit = e; }
                    }
                    if (hit != null) { HitArrow(a, hit); done = true; }
                    else
                    {
                        a.Pos = next;
                        a.Left -= step;
                        if (a.Left <= 1e-3f) { Land(a, a.Pos); done = true; }
                    }
                }
                if (done) { if (a.Vis != null) Destroy(a.Vis); _arrows.RemoveAt(i); }
                else PlaceArrow(a);
            }
        }

        private void HitArrow(Arrow a, FieldEnemy e)
        {
            var st = e.CurrentState;
            bool sneak = a.Full && st != FieldEnemy.State.Chase && st != FieldEnemy.State.Telegraph && st != FieldEnemy.State.Recover;
            bool crit;
            float cm;
            if (sneak)
            {
                var md = WeaponState.ModsOf(a.Owner);
                var ab = ArtifactState.BonusOf(a.Owner);
                crit = true;
                cm = 1f + md.CritDmg + ab.CritDmg + CookState.Buff("crit_dmg"); // 급소 — 반드시 치명
            }
            else cm = CritMul(a.Owner, out crit);
            e.TakeHit(a.Amount * cm, a.El, a.React, out _, crit: crit);
            if (sneak) { AchieveState.Bump("weak"); FieldDamageText.Spawn(e.transform.position + Vector3.up * 5f, GoLocalization.T("field.sneak", "급소!"), new Color(1f, 0.85f, 0.3f), 1.2f); } // 109-14-25 업적 — 급소
            var m = Active;
            if (m != null && m.Id == a.Owner) m.Energy = Mathf.Min(BurstCost, m.Energy + EnergyPerHit * EnergyMul);
            RainFollow();
            FieldRingFx.Spawn(e.transform.position, 1.2f, a.Full ? GoElements.ColorOf(a.El) : Color.white, 0.3f);
            LastArrow = "enemy";
            LastSneak = sneak;
        }

        /// <summary>화살이 멈춘 자리 — 과녁이면 맞히고, 충전 화살이면 원소 신호.</summary>
        private void Land(Arrow a, Vector3 p)
        {
            LastSneak = false;
            LastArrow = "miss";
            if (a.Chest != null && a.Index >= 0) { a.Chest.HitTarget(a.Index); LastArrow = "target"; }
            else if (a.HasStop) LastArrow = "point";
            if (a.Full)
            {
                FieldRingFx.Spawn(p, ArrowSignalR, GoElements.ColorOf(a.El), 0.5f);
                ElementPulse?.Invoke(p, ArrowSignalR, a.El);
            }
        }

        private void ClearArrows()
        {
            foreach (var a in _arrows) if (a.Vis != null) Destroy(a.Vis);
            _arrows.Clear();
        }

        /// <summary>서책·활 기본 공격이 적 없이 나가면 사거리 안 가장 가까운 과녁(안 풀린 상자). 맞혔으면 true.</summary>
        private bool HitNearestTarget(float range)
        {
            var b = Saga.Go.World.WorldMapBuilder.Instance;
            if (b == null || range <= 0f) return false;
            Saga.Go.World.TreasureChest bc = null;
            int bi = -1;
            float bd = range;
            foreach (var c in b.Chests)
            {
                if (c == null || c.Opened || c.Unlocked) continue;
                for (int i = 0; i < c.Targets.Count; i++)
                {
                    float d = Flat(c.TargetEye(i) - transform.position).magnitude;
                    if (d <= bd) { bd = d; bc = c; bi = i; }
                }
            }
            if (bc == null) return false;
            if (player != null) player.FaceToward(bc.TargetEye(bi));
            FieldLineFx.Spawn(transform.position + Vector3.up * 1.6f, bc.TargetEye(bi), 0.25f, Color.white, 0.2f);
            bc.HitTarget(bi);
            return true;
        }

        private void TickKitEffects(float dt)
        {
            if (RainLeft > 0f) RainLeft = Mathf.Max(0f, RainLeft - dt); // 109-14-17 뱃노래
            if (RainCd > 0f) RainCd = Mathf.Max(0f, RainCd - dt);
            if (RallyLeft > 0f) RallyLeft = Mathf.Max(0f, RallyLeft - dt);
            if (WardLeft > 0f) WardLeft = Mathf.Max(0f, WardLeft - dt);
            if (HasteLeft > 0f) HasteLeft = Mathf.Max(0f, HasteLeft - dt);
            if (LoreLeft > 0f) LoreLeft = Mathf.Max(0f, LoreLeft - dt);
            for (int i = _echoes.Count - 1; i >= 0; i--)
            {
                var ec = _echoes[i];
                ec.left -= dt;
                if (ec.left > 0f) { _echoes[i] = ec; continue; }
                _echoes.RemoveAt(i);
                if (ec.target == null || !ec.target.Alive) continue; // 이미 쓰러졌으면 헛친다
                float cm = CritMul(Active != null ? Active.Id : HeroId, out bool crit);
                ec.target.TakeHit(ec.amount * cm, ec.el, Atk * ReactMul, out _, crit: crit);
                FieldRingFx.Spawn(ec.target.transform.position, 1.2f * GoKits.Dist, ec.c, 0.3f);
            }
            for (int i = _shells.Count - 1; i >= 0; i--)
            {
                var sh = _shells[i];
                sh.left -= dt;
                if (sh.left > 0f) { _shells[i] = sh; continue; }
                _shells.RemoveAt(i);
                AreaHit(sh.pos, sh.r, sh.amount, sh.el);
                FieldRingFx.Spawn(sh.pos, sh.r, sh.c, 0.4f);
                ElementPulse?.Invoke(sh.pos, sh.r, sh.el);
            }
        }
    }
}
