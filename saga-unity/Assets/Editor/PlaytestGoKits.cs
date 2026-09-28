using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-11 "고유·갈래 스킬"(웹 사가고 ⑲-11 진단 항목) — `PlaytestHeadless` 가 들판 보스 진단 뒤에 부른다.
    /// 옛 진단은 `GoKits.OffForTest`(모두 109-8 모양)로 돌고 여기서만 켠다.
    /// 표(고유 다섯 틀·갈래 셋·지략 null·원소 덧붙임 일곱·스위치) · 실제로 쓰기: 주인공 불꽃 돌진·불새 깃(원소 부여 → 기본 공격에 화·×1.2) ·
    /// 통솔 호령(늦게 떨어지는 탄 → 맞음)·군기(공격 ×1.15, 10초 뒤 풀림) · 인덕 방패(명단 보호막)·맹세(받는 피해 ×0.8) ·
    /// 팔괘진(진 → 명단 기력)·천기 뇌우(스킬 대기 두 배) · 돌개 화살(소용돌이가 끈다) · 지략은 109-8 모양 · 도감 한 줄. 세이브 없음.
    /// 끝나면 동행·들판·스위치를 되돌린다.
    /// </summary>
    public static class PlaytestGoKits
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            if (fc == null || pc == null) { Fail("FieldCombat/PlayerController 없음"); return false; }
            var startMembers = new List<string>(PartyState.MemberIds);
            string parts = "";
            try
            {
                CheckTables();
                GoKits.OffForTest = false;
                pc.Teleport(fc.SafePoint);
                parts = CheckCombat(fc, pc);
            }
            finally
            {
                GoKits.OffForTest = true;
                PartyState.Restore(startMembers);
                fc.ResetForTest();
                fc.RebuildParty();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] kits OK - 고유 다섯·갈래 셋·지략 null·원소 덧붙임 일곱 · {parts} · 도감 줄");
            return _ok;
        }

        private static bool Near(float a, float b, float eps = 0.01f) => Mathf.Abs(a - b) <= eps;

        private static void CheckTables()
        {
            if (GoKits.KitOf(FieldCombat.HeroId, GoElement.Pyro) != null) Fail("스위치를 켰는데 한 벌이 나옴");
            GoKits.OffForTest = false;
            void Sig(string id, KitSkillType s, KitBurstType b)
            {
                var k = GoKits.KitOf(id, GoElements.ForMember(id));
                if (k == null || !k.Sig || k.Skill.Type != s || k.Burst.Type != b) Fail($"{id} 고유 {k?.Skill.Type}/{k?.Burst.Type} ≠ {s}/{b}");
            }
            Sig(FieldCombat.HeroId, KitSkillType.Dash, KitBurstType.Infuse);
            Sig("sg_zhugeliang", KitSkillType.Zone, KitBurstType.Haste);
            Sig("kr_yisunsin", KitSkillType.Shells, KitBurstType.Rally);
            Sig("kr_gyebaek", KitSkillType.Guard, KitBurstType.Ward);
            Sig("sg_huangzhong", KitSkillType.Shells, KitBurstType.Vortex);
            int wisdomNull = 0;
            foreach (var h in GoHeroes.All)
            {
                var k = GoKits.KitOf(h.Id, GoHeroes.ElementOf(h));
                if (k != null && k.Sig) continue;
                var want = h.Trait == HeroTrait.Might ? KitSkillType.Dash : h.Trait == HeroTrait.Command ? KitSkillType.Shells : KitSkillType.Guard;
                if (h.Trait == HeroTrait.Wisdom) { if (k != null) Fail($"{h.Id} 지략인데 한 벌"); else wisdomNull++; continue; }
                if (k == null || k.Skill.Type != want) Fail($"{h.Id} {h.Trait} → {k?.Skill.Type}");
            }
            if (wisdomNull == 0) Fail("지략 인물이 없음");
            if (GoKits.KitOf(PartyBodies.BanditId, GoElement.Physical) != null) Fail("도감 밖(산적)에 한 벌");
            var fire = GoKits.Family(HeroTrait.Command, GoElement.Pyro);
            if (!Near(fire.Burst.Mul, 3.0f * 1.15f) || !fire.Skill.Name.Contains(GoLocalization.T("kit.word.pyro", "불꽃"))) Fail("불꽃 덧붙임");
            if (!Near(GoKits.Family(HeroTrait.Might, GoElement.Hydro).Burst.Heal, 0.08f)) Fail("물결 덧붙임");
            if (!Near(GoKits.Family(HeroTrait.Might, GoElement.Electro).Burst.Team, 6f)) Fail("번개 덧붙임");
            if (!Near(GoKits.Family(HeroTrait.Might, GoElement.Anemo).Skill.Cd, 5.5f)) Fail("바람 덧붙임");
            if (!Near(GoKits.Family(HeroTrait.Might, GoElement.Cryo).Skill.Mul, 2.6f * 1.15f)) Fail("서리 덧붙임");
            if (!Near(GoKits.Family(HeroTrait.Virtue, GoElement.Geo).Skill.ShieldAdd, 0.12f)) Fail("바위 덧붙임");
            if (!Near(GoKits.Family(HeroTrait.Virtue, GoElement.Dendro).Burst.Sec, 13f)) Fail("덩굴 덧붙임");
            GoKits.OffForTest = true;
        }

        private static string First(HeroTrait t) =>
            GoHeroes.All.First(h => h.Trait == t && !new[] { "sg_zhugeliang", "kr_yisunsin", "kr_gyebaek", "sg_huangzhong" }.Contains(h.Id)).Id;

        /// <summary>동행 하나만 둔 명단으로 그 사람을 앞에 세운다.</summary>
        private static bool Lead(FieldCombat fc, string id)
        {
            PartyState.Restore(new List<string>());
            if (id != FieldCombat.HeroId) PartyState.Recruit(id);
            fc.RebuildParty();
            fc.ResetForTest();
            for (int i = 0; i < fc.Party.Count; i++)
                if (fc.Party[i].Id == id) { if (i == 0 || fc.Swap(i)) { fc.ResetForTest(); if (i != 0) fc.Swap(i); return true; } }
            Fail($"{id} 를 앞에 못 세움");
            return false;
        }

        private static FieldEnemy Foe(FieldCombat fc, PlayerController pc, float ahead)
        {
            var e = FieldEnemy.All.First(x => !x.IsGuardian && !x.IsHero && !x.DomainFoe && x.Alive);
            e.ReviveNow();
            Vector3 fwd = pc.Visual != null ? pc.Visual.forward : pc.transform.forward;
            fwd.y = 0f; fwd.Normalize();
            e.WarpForTest(fc.transform.position + fwd * ahead);
            if (e.Shielded) e.SetShieldForTest(0f);
            return e;
        }

        private static string CheckCombat(FieldCombat fc, PlayerController pc)
        {
            var parts = new List<string>();
            // 주인공 — 불꽃 돌진 · 불새 깃
            if (Lead(fc, FieldCombat.HeroId))
            {
                var e = Foe(fc, pc, 6f);
                int hits = fc.Skill();
                if (hits < 1 || fc.LastKit == null || fc.LastKit.Skill.Type != KitSkillType.Dash || fc.Active.SkillCd < 5.9f) Fail($"불꽃 돌진 {hits}·대기 {fc.Active.SkillCd}");
                fc.Active.Energy = FieldCombat.BurstCost;
                fc.Burst();
                if (!Near(fc.Active.InfuseLeft, 8f) || !Near(fc.Active.InfuseMul, 1.2f)) Fail("불새 깃 원소 부여");
                e = Foe(fc, pc, 2.5f);
                float hp0 = e.Hp, want = fc.Atk * GoWeapons.Kits[0].Mul[0] * TalentState.Mul(FieldCombat.HeroId, GoTalent.Kind.Normal) * FieldCombat.DmgMul(FieldCombat.HeroId, "n", GoElement.Pyro) * 1.2f;
                fc.Attack();
                if (!Near(hp0 - e.Hp, want, 0.5f) || e.Aura != GoElement.Pyro) Fail($"부여 뒤 1타 {hp0 - e.Hp} ≠ {want}·{e.Aura}");
                else parts.Add("불꽃 돌진·불새 깃(화 ×1.2)");
            }
            // 통솔 — 호령 · 군기
            string cmd = First(HeroTrait.Command);
            if (Lead(fc, cmd))
            {
                var e = Foe(fc, pc, 8f);
                float hp0 = e.Hp;
                fc.Skill();
                if (fc.ShellCount < 1 || fc.LastKit.Skill.Type != KitSkillType.Shells) Fail($"호령 탄 {fc.ShellCount}");
                if (e.Hp < hp0) Fail("탄이 늦지 않고 바로 맞음");
                fc.TickTimers(0.7f);
                if (fc.ShellCount != 0 || e.Hp >= hp0) Fail("0.6초 뒤 탄이 안 맞음");
                float atk0 = fc.Atk;
                fc.Active.Energy = FieldCombat.BurstCost;
                fc.Burst();
                if (!Near(fc.Atk / atk0, 1.15f, 0.001f)) Fail($"군기 공격 ×{fc.Atk / atk0}");
                fc.TickTimers(10.1f);
                if (!Near(fc.Atk, atk0, 0.01f)) Fail("군기가 10초 뒤 안 풀림");
                parts.Add("호령 탄·군기 ×1.15");
            }
            // 인덕 — 방패 · 맹세
            string vir = First(HeroTrait.Virtue);
            if (Lead(fc, vir))
            {
                Foe(fc, pc, 3f);
                var k = GoKits.KitOf(vir, fc.Active.Element);
                fc.Skill();
                if (!Near(fc.GuardHp, fc.Active.MaxHp * (k.Skill.Shield + k.Skill.ShieldAdd), 0.5f)) Fail($"방패 보호막 {fc.GuardHp}");
                // 맹세 — 리셋으로 보호막·무적을 비운 뒤(리셋은 맨 앞을 주인공으로 되돌린다) 다시 앞에 세워 해방
                fc.ResetForTest();
                fc.Swap(1);
                var e = Foe(fc, pc, 3f);
                fc.Active.Energy = FieldCombat.BurstCost;
                fc.Burst();
                if (!Near(fc.WardLeft, k.Burst.Sec) || !Near(fc.WardMul, 0.8f)) Fail($"맹세 {fc.WardLeft}·×{fc.WardMul}");
                float hp0 = fc.Active.Hp, dmg = 100f * 200f / (200f + fc.ActiveDef) * 0.8f;
                typeof(FieldCombat).GetProperty("InvulnLeft").SetValue(fc, 0f);
                fc.ReceiveStrike(100f, e);
                if (!Near(hp0 - fc.Active.Hp, dmg, 0.5f)) Fail($"맹세 받은 피해 {hp0 - fc.Active.Hp} ≠ {dmg}");
                else parts.Add("방패 보호막·맹세 ×0.8");
            }
            // 팔괘진 · 천기 뇌우
            if (Lead(fc, "sg_zhugeliang"))
            {
                var e = Foe(fc, pc, 2f);
                foreach (var m in fc.Party) m.Energy = 0f;
                fc.Skill();
                if (!fc.Zones.Any(z => z.Kind == SkillShape.KitZone) || fc.Party[0].Energy <= 0f) Fail("팔괘진 진·명단 기력");
                fc.Active.Energy = FieldCombat.BurstCost;
                fc.Burst();
                fc.Active.SkillCd = 6f;
                fc.TickTimers(1f);
                if (!Near(fc.Active.SkillCd, 4f, 0.01f) || !Near(fc.HasteLeft, 11f, 0.01f)) Fail($"천기 뇌우 대기 {fc.Active.SkillCd}");
                else parts.Add("팔괘진·천기 뇌우 ×2");
            }
            // 돌개 화살 — 소용돌이
            if (Lead(fc, "sg_huangzhong"))
            {
                var e = Foe(fc, pc, 15f);
                fc.Active.Energy = FieldCombat.BurstCost;
                fc.Burst();
                var z = fc.Zones.FirstOrDefault(q => q.Kind == SkillShape.Vortex);
                if (z == null) Fail("돌개 화살 소용돌이가 없음");
                else
                {
                    e.WarpForTest(z.Center + Vector3.right * (z.Radius - 1f));
                    float d0 = Vector3.Distance(Flatten(e.transform.position), Flatten(z.Center));
                    float hp0 = e.Hp;
                    fc.TickTimers(0.6f);
                    float d1 = Vector3.Distance(Flatten(e.transform.position), Flatten(z.Center));
                    if (d1 >= d0 - 0.5f || e.Hp >= hp0) Fail($"소용돌이 끌기 {d0:0.0}→{d1:0.0}·피해");
                    else parts.Add("돌개 화살 끌기");
                }
            }
            // 지략 — 109-8 모양 그대로
            string wis = GoHeroes.All.First(h => h.Trait == HeroTrait.Wisdom && h.Id != "sg_zhugeliang").Id;
            if (Lead(fc, wis))
            {
                Foe(fc, pc, 5f);
                var before = fc.LastKit;
                fc.Skill();
                if (fc.LastKit != before || (fc.LastShape != SkillShape.Field && fc.LastShape != SkillShape.Summon)) Fail($"지략이 한 벌을 씀({fc.LastShape})");
                else parts.Add("지략 109-8");
            }
            if (!HeroDexUi.KitLine("kr_yisunsin", GoElements.ForMember("kr_yisunsin")).Contains(GoLocalization.T("kit.sig.yisun.skill", "일제 포격"))) Fail("도감 한 벌 줄");
            return string.Join("·", parts);
        }

        private static Vector3 Flatten(Vector3 v) { v.y = 0f; return v; }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] kits FAIL - {msg}");
        }
    }
}
