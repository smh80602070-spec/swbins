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
        private void HealParty(float frac)
        {
            foreach (var o in _party) if (!o.Down) o.Hp = Mathf.Min(o.MaxHp, o.Hp + o.MaxHp * frac);
        }

        private void EnergyOthers(Member m, float web)
        {
            foreach (var o in _party) if (o != m && !o.Down) o.Energy = Mathf.Min(BurstCost, o.Energy + web * GoKits.EnergyScale);
        }

        private int KitSkillCast(Member m, HeroKit hk)
        {
            var s = hk.Skill;
            LastKit = hk;
            m.SkillCd = Mathf.Max(1f, s.Cd) * TalentState.SkillCdMul(m.Id);
            const float D = GoKits.Dist;
            float reach = s.Type == KitSkillType.Shells || s.Type == KitSkillType.Blink ? s.Reach * D : Mathf.Max(AutoFaceRadius * 1.5f, s.Len * D);
            var target = Nearest(reach);
            if (target != null && player != null) player.FaceToward(target.transform.position);
            Vector3 pos = transform.position, dir = Forward();
            float aimDist = 0f;
            if (target != null)
            {
                Vector3 d = Flat(target.transform.position - pos);
                aimDist = d.magnitude;
                if (aimDist > 0.01f) dir = d / aimDist;
            }
            Color fx = GoSkillShapes.FxColor(m.Id, m.Element);
            float atk = Atk;
            float amount = atk * s.Mul * GoKits.SkillScale * TalentMul(GoTalent.Kind.Skill) * DmgMul(m.Id, "s", m.Element);
            int hits = 0;
            switch (s.Type)
            {
                case KitSkillType.Dash:
                {
                    float len = s.Len * D, w = s.W * D, stop = 1.2f * D;
                    float go = target != null ? Mathf.Min(len, Mathf.Max(0f, aimDist - stop)) : len;
                    Vector3 end = pos + dir * go;
                    hits = LineHit(pos, end + dir * stop, w, amount, m.Element);
                    InvulnLeft = Mathf.Max(InvulnLeft, GoSkillShapes.DashInvulnSec);
                    if (player != null && go > 0.05f) player.Dash(dir, go, GoSkillShapes.DashSec);
                    FieldLineFx.Spawn(pos, end + dir * stop, w * 2f, fx, 0.45f);
                    ElementPulse?.Invoke(end, w * 2f, m.Element);
                    break;
                }
                case KitSkillType.Shells:
                {
                    var foes = new List<FieldEnemy>(Snapshot());
                    foes.RemoveAll(e => Flat(e.transform.position - pos).magnitude > s.Reach * D);
                    foes.Sort((a, b) => Flat(a.transform.position - pos).sqrMagnitude.CompareTo(Flat(b.transform.position - pos).sqrMagnitude));
                    var spots = new List<Vector3>();
                    for (int i = 0; i < foes.Count && i < s.N; i++) spots.Add(foes[i].transform.position);
                    if (spots.Count == 0) spots.Add(pos + dir * 8f * D);
                    foreach (var p in spots)
                    {
                        _shells.Add((p, s.Delay, s.R * D, amount, m.Element, fx));
                        FieldRingFx.Spawn(p, s.R * D, fx, s.Delay);
                    }
                    hits = foes.Count > 0 ? Mathf.Min(foes.Count, s.N) : 0;
                    break;
                }
                case KitSkillType.Guard:
                {
                    hits = AreaHit(pos, s.R * D, amount, m.Element);
                    float shield = m.MaxHp * (s.Shield + s.ShieldAdd);
                    GuardMax = Mathf.Max(shield, GuardHp);
                    GuardHp = Mathf.Max(shield, GuardHp);
                    GuardLeft = Mathf.Max(GuardLeft, s.Sec);
                    FieldRingFx.Spawn(pos, s.R * D, fx, 0.6f);
                    FieldRingFx.Spawn(pos, 2.2f, GoElements.ColorOf(GoElement.Geo), 0.5f);
                    ElementPulse?.Invoke(pos, s.R * D, m.Element);
                    break;
                }
                case KitSkillType.Zone:
                {
                    var z = new SkillZone { Kind = SkillShape.KitZone, Owner = m.Id, Center = pos, Radius = s.R * D, Left = s.Sec, Atk = atk, Element = m.Element, Color = fx,
                        Mul = s.Mul * GoKits.SkillScale * TalentMul(GoTalent.Kind.Skill) * DmgMul(m.Id, "s", m.Element), React = ReactMul,
                        Every = s.Every, N = s.N, EnergyPerHit = s.Energy * GoKits.EnergyScale };
                    _zones.Add(z);
                    TickZone(z, 0f);
                    hits = z.Hits;
                    break;
                }
                case KitSkillType.Blink:
                {
                    // 109-14-15 그림자 걸음 — 가까운 적을 지나 그 뒤로 건너뛰어(무적) 도착 둘레를 베고, 그 적에 표식. 적이 없으면 앞으로.
                    Vector3 dest = target != null ? target.transform.position + dir * s.Back * D : pos + dir * s.Len * D;
                    if (!BlinkOk(pos, ref dest) && target != null)
                    {
                        dest = target.transform.position - dir * 1.2f * D; // 뒤가 벼랑·물이면 앞에 선다
                        if (!BlinkOk(pos, ref dest)) dest = pos;
                    }
                    InvulnLeft = Mathf.Max(InvulnLeft, GoSkillShapes.DashInvulnSec);
                    if (player != null && Flat(dest - pos).sqrMagnitude > 0.01f) player.Teleport(dest + Vector3.up * 0.1f);
                    hits = AreaHit(dest, s.R * D, amount, m.Element);
                    if (target != null && target.Alive) target.Mark(s.Mark, s.MarkMul);
                    FieldLineFx.Spawn(pos, dest, 1.2f, fx, 0.35f);
                    FieldRingFx.Spawn(dest, s.R * D, fx, 0.5f);
                    ElementPulse?.Invoke(dest, s.R * D, m.Element);
                    break;
                }
                case KitSkillType.Gust:
                {
                    // 109-14-17 부채 바람 — 앞 R 부채꼴(내적 Arc 이상)을 치고 나에게서 먼 쪽으로 밀어낸다. 명단 회복은 아래 s.Heal
                    float r = s.R * D, ra = Atk * ReactMul;
                    foreach (var e in Snapshot())
                    {
                        Vector3 d = Flat(e.transform.position - pos);
                        float dl = d.magnitude;
                        if (dl > r || (dl >= 0.5f && Vector3.Dot(d / dl, dir) < s.Arc)) continue;
                        float cm = CritMul(m.Id, out bool crit);
                        e.TakeHit(amount * cm, m.Element, ra, out _, crit: crit);
                        e.KnockBack(dl >= 0.5f ? d : dir, s.Knock * D);
                        hits++;
                    }
                    float half = Mathf.Acos(s.Arc) * Mathf.Rad2Deg;
                    Vector3 up = Vector3.up * 0.4f;
                    foreach (float a in new[] { -half, -half * 0.5f, 0f, half * 0.5f, half })
                        FieldLineFx.Spawn(pos + up, pos + up + Quaternion.Euler(0f, a, 0f) * dir * r, 0.6f, fx, 0.4f);
                    FieldRingFx.Spawn(pos + dir * r * 0.5f, r * 0.5f, fx, 0.5f);
                    ElementPulse?.Invoke(pos + dir * r * 0.5f, r * 0.5f, m.Element);
                    break;
                }
                case KitSkillType.Updraft:
                {
                    // 109-14-43 별배 견인줄 — 둘레 R 적을 Pull 만큼 끌어당겨 치고, 나는 Lift 만큼 솟구쳐 날개를 편다(점프로 활공)
                    float r = s.R * D, ra = Atk * ReactMul;
                    foreach (var e in Snapshot())
                    {
                        Vector3 d = Flat(pos - e.transform.position);
                        float dl = d.magnitude;
                        if (dl > r) continue;
                        float cm = CritMul(m.Id, out bool crit);
                        e.TakeHit(amount * cm, m.Element, ra, out _, crit: crit);
                        e.KnockBack(d, Mathf.Min(s.Pull * D, Mathf.Max(0f, dl - 1.2f * D)));
                        hits++;
                    }
                    FieldRingFx.Spawn(pos, r, fx, 0.5f);
                    FieldLineFx.Spawn(pos + Vector3.up * 0.3f, pos + Vector3.up * (s.Lift * 0.5f), 0.8f, fx, 0.5f);
                    ElementPulse?.Invoke(pos, r, m.Element);
                    if (player != null) player.Launch(s.Lift);
                    break;
                }
                case KitSkillType.Wave:
                {
                    // 109-14-17 노 물결 — 앞으로 Len·폭 W 의 길을 치고 앞으로 밀어낸다(나는 제자리)
                    Vector3 end = pos + dir * s.Len * D;
                    float w = s.W * D, ra = Atk * ReactMul;
                    foreach (var e in Snapshot())
                    {
                        if (GoSkillShapes.SegDist(e.transform.position, pos, end) > w) continue;
                        float cm = CritMul(m.Id, out bool crit);
                        e.TakeHit(amount * cm, m.Element, ra, out _, crit: crit);
                        e.KnockBack(dir, s.Knock * D);
                        hits++;
                    }
                    FieldLineFx.Spawn(pos + Vector3.up * 0.3f, end + Vector3.up * 0.3f, w * 2f, fx, 0.5f);
                    FieldRingFx.Spawn(end, w, fx, 0.4f);
                    ElementPulse?.Invoke(end, w * 2f, m.Element);
                    break;
                }
            }
            if (s.Heal > 0f) HealParty(s.Heal);
            if (s.Team > 0f) EnergyOthers(m, s.Team);
            if (hits > 0) m.Energy = Mathf.Min(BurstCost, m.Energy + EnergyPerSkillHit * EnergyMul);
            FieldDamageText.Spawn(pos + Vector3.up * 5.2f, s.Name, fx, 1.1f);
            if (player != null && player.Animator != null) player.Animator.SetTrigger("Attack");
            return hits;
        }

        private int KitBurstCast(Member m, HeroKit hk)
        {
            var b = hk.Burst;
            LastKit = hk;
            m.Energy = 0f;
            const float D = GoKits.Dist;
            Vector3 pos = transform.position;
            Color fx = GoSkillShapes.FxColor(m.Id, m.Element);
            int hits = AreaHit(pos, b.R * D, Atk * b.Mul * GoKits.BurstScale * TalentMul(GoTalent.Kind.Burst) * DmgMul(m.Id, "b", m.Element), m.Element);
            switch (b.Type)
            {
                case KitBurstType.Infuse: m.InfuseLeft = b.Sec; m.InfuseMul = b.NMul; break;
                case KitBurstType.Rally: RallyLeft = b.Sec; RallyMul = b.Atk; break;
                case KitBurstType.Ward: WardLeft = b.Sec; WardMul = b.Taken; break;
                case KitBurstType.Haste: HasteLeft = b.Sec; EnergyOthers(m, b.Energy); break;
                case KitBurstType.Lore: LoreLeft = b.Sec; LoreMul = b.RMul; break; // 109-14-15 옛 글자 풀이
                case KitBurstType.Echo:
                {
                    // 109-14-15 가면 벗기 — reach 안 표식 난 적마다 every 초 간격 메아리 N(적을 따라감), 표식 난 적이 없으면 가까운 둘
                    var near = new List<FieldEnemy>(Snapshot());
                    near.RemoveAll(e => Flat(e.transform.position - pos).magnitude > b.Reach * D);
                    near.Sort((a, c) => Flat(a.transform.position - pos).sqrMagnitude.CompareTo(Flat(c.transform.position - pos).sqrMagnitude));
                    var marked = near.FindAll(e => e.MarkLeft > 0f);
                    var tgs = marked.Count > 0 ? marked : near.GetRange(0, Mathf.Min(2, near.Count));
                    float amount = Atk * b.EMul * GoKits.BurstScale * TalentMul(GoTalent.Kind.Burst) * DmgMul(m.Id, "b", m.Element);
                    foreach (var e in tgs)
                        for (int k = 1; k <= b.N; k++) _echoes.Add((e, b.Every * k, amount, m.Element, fx));
                    break;
                }
                case KitBurstType.Feast:
                    // 109-14-17 잔칫날 순풍 — 발밑 바람 자리, 첫 틱은 Every 초 뒤
                    _zones.Add(new SkillZone { Kind = SkillShape.Feast, Owner = m.Id, Center = pos, Radius = b.R * D, Left = b.Sec, Next = b.Every, Every = b.Every, Atk = Atk, Element = m.Element, Color = fx,
                        Mul = b.EMul * GoKits.BurstScale * TalentMul(GoTalent.Kind.Burst) * DmgMul(m.Id, "b", m.Element), React = ReactMul, Heal = b.FHeal });
                    break;
                case KitBurstType.Rain:
                    // 109-14-17 뱃노래 — 값은 놓은 사람 것으로 굳힌다(교체해도 그 사람 공격력·원소)
                    RainLeft = b.Sec; RainCd = 0f; _rainKit = b; _rainOwner = m.Id; _rainEl = m.Element; _rainColor = fx;
                    _rainAmount = Atk * b.RMul * GoKits.BurstScale * TalentMul(GoTalent.Kind.Burst) * DmgMul(m.Id, "b", m.Element);
                    break;
                case KitBurstType.Vortex:
                {
                    Vector3 c = pos + Forward() * b.Ahead * D;
                    var z = new SkillZone { Kind = SkillShape.Vortex, Owner = m.Id, Center = c, Radius = b.Pull * D, Left = b.Sec, Atk = Atk, Element = m.Element, Color = fx,
                        Mul = b.Tick * GoKits.BurstScale * TalentMul(GoTalent.Kind.Burst) * DmgMul(m.Id, "b", m.Element), React = ReactMul,
                        Every = b.Every, Pull = b.Pull * D };
                    _zones.Add(z);
                    FieldRingFx.Spawn(c, z.Radius, fx, 0.8f);
                    break;
                }
            }
            if (b.Heal > 0f) HealParty(b.Heal);
            if (b.Team > 0f) EnergyOthers(m, b.Team);
            if (TalentState.BurstBuff(m.Id)) m.BuffLeft = GoTalent.C5Sec; // 109-14-4 깨달음 ⑤
            FieldRingFx.Spawn(pos, b.R * D, fx, 0.7f);
            FieldRingFx.Spawn(pos, b.R * D * 0.6f, Color.white, 0.5f);
            ElementPulse?.Invoke(pos, b.R * D, m.Element);
            ToastLine(string.Format(GoLocalization.T("field.burst_named", "{0} — {1}!"), m.Name, b.Name), 1.5f);
            if (player != null && player.Animator != null) player.Animator.SetTrigger("Attack");
            return hits;
        }

        /// <summary>109-14-15 그림자 걸음 도착 자리 — 땅에 앉히고, 물·높이 차 3m 넘는 곳(벼랑 아래·고원 위)이면 안 된다.</summary>
        private static bool BlinkOk(Vector3 from, ref Vector3 dest)
        {
            dest = FolkWalker.Grounded(dest + Vector3.up * 1.5f);
            var (gx, gy) = TestMapData.WorldToGrid(dest);
            return !TestMapData.IsWater(TestMapData.TileAt(gx, gy)) && Mathf.Abs(dest.y - from.y) < 3f;
        }

        /// <summary>진 — 가까운 적 N 을 치고 맞힐 때마다 명단 기력 · 소용돌이 — 반경 안 적을 가운데로 끌며 친다.</summary>
        private void TickKitZone(SkillZone z)
        {
            var foes = new List<FieldEnemy>();
            foreach (var e in Snapshot()) if (Flat(e.transform.position - z.Center).magnitude <= z.Radius) foes.Add(e);
            foes.Sort((a, b) => Flat(a.transform.position - z.Center).sqrMagnitude.CompareTo(Flat(b.transform.position - z.Center).sqrMagnitude));
            int n = 0;
            foreach (var e in foes)
            {
                if (z.Kind == SkillShape.KitZone && n >= z.N) break;
                if (z.Kind == SkillShape.Vortex) e.PullToward(z.Center, z.Pull * 0.35f);
                float cm = CritMul(z.Owner, out bool crit);
                e.TakeHit(z.Atk * z.Mul * cm, z.Element, z.Atk * z.React, out _, crit: crit);
                n++;
            }
            z.Hits += n;
            if (z.Kind == SkillShape.KitZone && n > 0)
                foreach (var o in _party) if (!o.Down) o.Energy = Mathf.Min(BurstCost, o.Energy + z.EnergyPerHit * n);
            FieldRingFx.Spawn(z.Center, z.Radius, z.Color, 0.5f);
            ElementPulse?.Invoke(z.Center, z.Radius, z.Element);
        }

        /// <summary>109-14-17 바람 자리 한 틱 — 안에 선 지금 인물 회복, 안의 적을 친다.</summary>
        private void TickFeast(SkillZone z)
        {
            var a = Active;
            if (a != null && !a.Down && Flat(transform.position - z.Center).magnitude <= z.Radius)
            {
                a.Hp = Mathf.Min(a.MaxHp, a.Hp + a.MaxHp * z.Heal);
                z.Heals++;
            }
            int n = 0;
            foreach (var e in Snapshot())
            {
                if (Flat(e.transform.position - z.Center).magnitude > z.Radius) continue;
                float cm = CritMul(z.Owner, out bool crit);
                e.TakeHit(z.Atk * z.Mul * cm, z.Element, z.Atk * z.React, out _, crit: crit);
                n++;
            }
            z.Hits += n;
            FieldRingFx.Spawn(z.Center, z.Radius, z.Color, 0.5f);
            FieldRingFx.Spawn(z.Center, z.Radius * 0.45f, Color.Lerp(z.Color, Color.white, 0.5f), 0.4f);
            ElementPulse?.Invoke(z.Center, z.Radius, z.Element);
        }

        /// <summary>109-14-17 뱃노래 따라 치기 — 기본·강·낙하 공격이 맞은 뒤 부른다. 쉼이 끝났으면 Reach 안 가까운 N 에 물 노 한 대씩. 친 수.</summary>
        private int RainFollow()
        {
            var k = _rainKit;
            if (RainLeft <= 0f || RainCd > 0f || k == null) return 0;
            Vector3 pos = transform.position;
            var tg = new List<FieldEnemy>(Snapshot());
            tg.RemoveAll(e => Flat(e.transform.position - pos).magnitude > k.Reach * GoKits.Dist);
            if (tg.Count == 0) return 0;
            tg.Sort((a, c) => Flat(a.transform.position - pos).sqrMagnitude.CompareTo(Flat(c.transform.position - pos).sqrMagnitude));
            RainCd = k.Gap;
            int n = Mathf.Min(k.N, tg.Count);
            for (int i = 0; i < n; i++)
            {
                var e = tg[i];
                float cm = CritMul(_rainOwner, out bool crit);
                e.TakeHit(_rainAmount * cm, _rainEl, Atk * ReactMul, out _, crit: crit);
                FieldLineFx.Spawn(pos + Vector3.up * 2.2f, e.transform.position + Vector3.up * 1.2f, 0.45f, _rainColor, 0.3f);
                FieldRingFx.Spawn(e.transform.position, 1.2f * GoKits.Dist, _rainColor, 0.3f);
            }
            RainHits += n;
            return n;
        }
    }
}
