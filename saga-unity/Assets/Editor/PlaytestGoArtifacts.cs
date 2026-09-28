using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-5b "보패"(웹 사가고 ⑲-5 진단 항목) — `PlaytestHeadless` 가 무기 진단 뒤에 부른다.
    /// 웹 표본 넷과 같은 보패(씨앗 번호 → 세트·부위·주옵션·부옵션·+15 굴림) · 강화 값·3단마다 부옵션·상한 · 끼기(동행만·같은 부위 갈이·남의 것 옮김) ·
    /// 세트 2/4(봉화 깃발 기력·떠돌이 무사 근접 기본·대장간 불씨·솔바람 피리 반응) · 공격·체력·방어에 실제로 탐(고정 셋은 이 트랙 크기) ·
    /// 상한 200(안 낀 ★4 부터 분해)·★4 분해 · 얻는 곳(상자 넷·정예) · 도감 보패 칸(진짜 단추) · 세이브 v22 왕복·v21 로드.
    /// 끝나면 보패·동행·돈·세이브 파일·치명 스위치를 되돌린다.
    /// </summary>
    public static class PlaytestGoArtifacts
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var dex = HeroDexUi.Instance;
            if (fc == null || pc == null || dex == null) { Fail("FieldCombat/PlayerController/HeroDexUi 없음"); return false; }

            var startMembers = new List<string>(PartyState.MemberIds);
            var startArts = ArtifactState.Snapshot();
            int startSeq = ArtifactState.Seq, startPolish = ArtifactState.Polish;
            var startInv = WeaponState.SnapshotInv();
            var startEquip = WeaponState.SnapshotEquip();
            int startOre = WeaponState.Ore;
            int startGold = GoldState.Gold;
            bool startCritOff = FieldCombat.CritOffForTest;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            string combat = "";
            try
            {
                FieldCombat.CritOffForTest = true;
                CheckWebSamples();
                CheckGrowthAndEquip();
                CheckSets();
                combat = CheckCombat(fc, pc);
                CheckCapAndSalvage();
                CheckSources();
                CheckDexPanel(dex);
                CheckSave(savePath);
            }
            finally
            {
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                FieldCombat.CritOffForTest = startCritOff;
                FieldCombat.CritRateForTest = -1f;
                PartyState.Restore(startMembers);
                ArtifactState.Restore(startArts, startSeq, startPolish);
                WeaponState.Restore(startInv, startEquip, startOre);
                GoldState.Restore(startGold);
                fc.ResetForTest();
                fc.RebuildParty();
                dex.Close();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] artifacts OK - 웹 표본 넷(세트·부위·주/부옵션·+15) · 강화 값·3단 부옵션·상한 · 끼기·옮기기 · 세트 2/4 · {combat} · 상한 200·★4 분해 · 얻는 곳(상자 넷·정예) · 도감 보패 칸 · 세이브 v22 왕복·v21 로드");
            return _ok;
        }

        private static bool Near(float a, float b, float eps = 0.0005f) => Mathf.Abs(a - b) <= eps;

        private static void Expect(GoArtifacts.Artifact a, string label, string set, string slot, int rarity, string main, float mainV, params (string k, float v)[] subs)
        {
            if (a.set != set || a.slot != slot || a.rarity != rarity || a.main != main) Fail($"{label} {a.set}/{a.slot}/★{a.rarity}/{a.main} ≠ 웹 {set}/{slot}/★{rarity}/{main}");
            if (!Near(GoArtifacts.MainValue(a), mainV)) Fail($"{label} 주옵션 {GoArtifacts.MainValue(a)} ≠ 웹 {mainV}");
            if (a.subs.Count != subs.Length) { Fail($"{label} 부옵션 {a.subs.Count} ≠ 웹 {subs.Length}"); return; }
            for (int i = 0; i < subs.Length; i++)
                if (a.subs[i].key != subs[i].k || !Near(a.subs[i].value, subs[i].v)) Fail($"{label} 부옵션 {i} {a.subs[i].key} {a.subs[i].value} ≠ 웹 {subs[i].k} {subs[i].v}");
        }

        /// <summary>웹 `artifact.js` 를 node 로 돌려 뽑은 표본(번호 씨앗 20260824 + n × 7919).</summary>
        private static void CheckWebSamples()
        {
            uint Seed(int n) => unchecked((uint)(20260824 + n * 7919));
            Expect(GoArtifacts.Generate(Seed(1), 4), "1번 ★4", "emblem", "sands", 4, "crit_dmg", 0.064f, ("def", 3f), ("crit_rate", 0.0264f));
            Expect(GoArtifacts.Generate(Seed(2), 5), "2번 ★5", "emblem", "goblet", 5, "elem_rock", 0.06f, ("def_pct", 0.05525f), ("atk", 6.8f), ("def", 3.75f));
            Expect(GoArtifacts.Generate(Seed(3), 5), "3번 ★5", "crimson", "sands", 5, "crit_dmg", 0.08f, ("def", 3.75f), ("hp", 22.5f), ("atk", 6.8f));
            var b = GoArtifacts.Generate(Seed(5), 5);
            for (int i = 0; i < 15; i++) { b.lv++; if (b.lv % GoArtifacts.Step == 0) GoArtifacts.OnStep(b); }
            Expect(b, "5번 +15", b.set, b.slot, 5, b.main, 0.42f, ("crit_rate", 0.0528f), ("crit_dmg", 0.1155f), ("hp", 45f), ("hp_pct", 0.08f));
            if (GoArtifacts.UpCost(0) != (1, 12) || GoArtifacts.UpCost(4) != (3, 36) || GoArtifacts.UpCost(14) != (9, 108)) Fail("강화 값(⌈0.6 × (n+1)⌉ · 금 × 12)");
            if (GoArtifacts.MaxLv(4) != 12 || GoArtifacts.MaxLv(5) != 15) Fail("상한 ★4 12 · ★5 15");
            if (!Near(GoArtifacts.Applied("atk", 20f), 15f) || !Near(GoArtifacts.Applied("hp", 100f), 40f) || !Near(GoArtifacts.Applied("def", 10f), 6f)) Fail("고정 셋 이 트랙 크기");
        }

        private static List<string> HeroesOf(GoWeapons.Type t)
        {
            var l = new List<string>();
            foreach (var h in GoHeroes.All) if (GoWeapons.TypeOf(h.Id) == t) l.Add(h.Id);
            return l;
        }

        private static void CheckGrowthAndEquip()
        {
            ArtifactState.ResetForTest();
            PartyState.Restore(new List<string>()); // "안 들인 사람" 확인을 위해 비운다(끝에 되돌림)
            GoldState.Restore(100000);
            string uid = ArtifactState.Add(4);
            var a = ArtifactState.Get(uid);
            if (uid != "a1" || a.set != "emblem" || a.slot != "sands" || a.subs.Count != 2) Fail($"첫 보패 {uid} {a?.set}/{a?.slot} — 웹 1번과 다름");
            if (ArtifactState.Up(uid)) Fail("연마석 없이 강화됨");
            ArtifactState.AddPolish(200);
            int g0 = GoldState.Gold, p0 = ArtifactState.Polish;
            for (int i = 0; i < 3; i++) if (!ArtifactState.Up(uid)) Fail($"강화 +{i} 안 됨");
            if (a.lv != 3 || a.subs.Count != 3) Fail($"+3 에서 부옵션 셋이 아님({a.subs.Count})");
            if (p0 - ArtifactState.Polish != 1 + 2 + 2 || g0 - GoldState.Gold != 12 * 5 || a.spent != 5) Fail($"+0→+3 값 연마석 {p0 - ArtifactState.Polish}·금 {g0 - GoldState.Gold}");
            while (ArtifactState.Up(uid)) { }
            if (a.lv != 12 || a.subs.Count != 4) Fail($"★4 끝 +{a.lv}·부옵션 {a.subs.Count}");
            if (!ArtifactState.CanUp(uid, out string why, out _) && why != GoLocalization.T("artifact.why.max", "최대 강화")) Fail($"상한 까닭 '{why}'");

            var swords = HeroesOf(GoWeapons.Type.Sword);
            string x = swords[0], y = swords[1];
            if (ArtifactState.Equip(x, uid)) Fail("안 들인 사람이 보패를 낌");
            Recruit(x);
            Recruit(y);
            if (!ArtifactState.Equip(x, uid) || !ArtifactState.EquippedOf(x).ContainsKey("sands")) Fail("끼기");
            string u2 = ArtifactState.Add(5, "crimson", "sands");
            ArtifactState.Equip(x, u2);
            if (ArtifactState.Get(uid).owner != "" || ArtifactState.EquippedOf(x)["sands"].uid != u2) Fail("같은 부위 갈이 — 먼저 낀 것이 안 빠짐");
            ArtifactState.Equip(y, u2);
            if (ArtifactState.EquippedOf(x).ContainsKey("sands") || ArtifactState.Get(u2).owner != y) Fail("남의 것을 끼면 그쪽에서 빠져야");
            if (ArtifactState.Salvage(u2) != 0) Fail("낀 것이 분해됨");
            ArtifactState.Unequip(u2);
            int before = ArtifactState.Polish;
            if (ArtifactState.Salvage(uid) != 1 + Mathf.FloorToInt(a.spent * 0.8f) || ArtifactState.Polish - before != 1 + Mathf.FloorToInt(a.spent * 0.8f)) Fail("분해 값 = 기본 + 들인 연마석 × 0.8");
        }

        private static void CheckSets()
        {
            ArtifactState.ResetForTest();
            string x = HeroesOf(GoWeapons.Type.Sword)[0];
            Recruit(x);
            var slots = new[] { "flower", "plume", "sands", "goblet" };
            ArtifactState.Equip(x, ArtifactState.Add(5, "emblem", slots[0]));
            var b1 = ArtifactState.BonusOf(x);
            if (b1.Sets.Count != 0) Fail("하나로 세트가 켜짐");
            ArtifactState.Equip(x, ArtifactState.Add(5, "emblem", slots[1]));
            var b2 = ArtifactState.BonusOf(x);
            if (b2.Sets.Count != 1 || b2.Sets[0].n != 2 || b2.Energy < 0.18f - 0.0001f || b2.BurstDmg != 0f) Fail($"봉화 깃발 2 — 기력 {b2.Energy}·해방 {b2.BurstDmg}");
            ArtifactState.Equip(x, ArtifactState.Add(5, "emblem", slots[2]));
            ArtifactState.Equip(x, ArtifactState.Add(5, "emblem", slots[3]));
            var b4 = ArtifactState.BonusOf(x);
            if (b4.Sets[0].n != 4 || !Near(b4.BurstDmg, 0.2f)) Fail($"봉화 깃발 4 — 해방 {b4.BurstDmg}");
            // 패옥 주옵션 체력 80 → 이 트랙 × 0.4
            var flower = ArtifactState.EquippedOf(x)["flower"];
            float hp = GoArtifacts.Applied("hp", GoArtifacts.MainValue(flower));
            foreach (var s in flower.subs) if (s.key == "hp") hp += GoArtifacts.Applied("hp", s.value);
            foreach (var p in ArtifactState.EquippedOf(x).Values) if (p != flower) foreach (var s in p.subs) if (s.key == "hp") hp += GoArtifacts.Applied("hp", s.value);
            if (!Near(b4.Hp, hp, 0.01f) || b4.Hp < 32f - 0.01f) Fail($"고정 체력 {b4.Hp} ≠ {hp}");
            if (ArtifactState.BonusOf("hero").Sets.Count != 0 || ArtifactState.BonusOf(null).Atk != 0f) Fail("주인공·빈 id 에 보패가 탐");
        }

        private static string CheckCombat(FieldCombat fc, PlayerController pc)
        {
            var parts = new List<string>();
            ArtifactState.ResetForTest();
            WeaponState.Restore(null, null, 0);
            string x = HeroesOf(GoWeapons.Type.Sword)[0];
            Recruit(x);
            fc.RebuildParty();
            if (!Swap(fc, x)) return "";
            float atk0 = fc.Atk, hp0 = fc.Active.MaxHp, def0 = fc.ActiveDef;

            // 떠돌이 무사 넷 + 관모 — 공격% 2 세트 15%, 근접 기본 +30%
            foreach (var s in new[] { "flower", "plume", "sands", "goblet" }) ArtifactState.Equip(x, ArtifactState.Add(5, "gladiator", s));
            ArtifactState.Equip(x, ArtifactState.Add(5, "depth", "circlet"));
            fc.RebuildParty();
            if (!Swap(fc, x)) return "";
            var ab = ArtifactState.BonusOf(x);
            float p = PerkState.AtkMultiplier * BondState.AtkMultiplier;
            float wantAtk = atk0 / (1f + WeaponState.ModsOf(x).AtkPct) * (1f + WeaponState.ModsOf(x).AtkPct + ab.AtkPct) + ab.Atk * p;
            if (ab.AtkPct < 0.15f || !Near(fc.Atk, wantAtk, 0.05f)) Fail($"공격 {fc.Atk} ≠ {wantAtk} (보패 공격% {ab.AtkPct}·고정 {ab.Atk})");
            else parts.Add($"공격 {atk0:0}→{fc.Atk:0}");
            float wantHp = (hp0 * (1f + ab.HpPct) + ab.Hp);
            if (!Near(fc.Active.MaxHp, wantHp, 0.5f)) Fail($"체력 {fc.Active.MaxHp} ≠ {wantHp}");
            if (!Near(fc.ActiveDef, def0 * (1f + ab.DefPct) + ab.Def, 0.01f)) Fail($"방어 {fc.ActiveDef}");
            float dm = FieldCombat.DmgMul(x, "n", GoElement.Physical);
            if (!Near(dm, 1f + 0.3f + ab.Elem[0])) Fail($"떠돌이 무사 4 근접 기본 ×{dm}");
            if (!Near(FieldCombat.DmgMul(x, "s", GoElement.Hydro), 1f + ab.Elem[2])) Fail("스킬 보너스가 세트 밖에서 붙음");

            // 실제 1타 — 앞 2.5m
            var e = FieldEnemy.All[0];
            Vector3 fwd = pc.Visual != null ? pc.Visual.forward : pc.transform.forward;
            fwd.y = 0f; fwd.Normalize();
            e.ReviveNow(); e.WarpForTest(fc.transform.position + fwd * 2.5f);
            float ehp = e.Hp, want = fc.Atk * GoWeapons.Kits[0].Mul[0] * TalentState.Mul(x, GoTalent.Kind.Normal) * dm;
            fc.Attack();
            if (!Near(ehp - e.Hp, want, 0.5f)) Fail($"1타 {ehp - e.Hp} ≠ {want}");
            else parts.Add($"근접 1타 ×{dm:0.00}");

            // 반응 세트 — 대장간 불씨 4 · 솔바람 피리 4
            ArtifactState.ResetForTest();
            foreach (var s in new[] { "flower", "plume", "sands", "goblet" }) ArtifactState.Equip(x, ArtifactState.Add(5, "crimson", s));
            if (!Near(fc.SetReactMul(GoReaction.Vaporize), 1.35f) || !Near(fc.SetReactMul(GoReaction.Burning), 1.35f) || !Near(fc.SetReactMul(GoReaction.Swirl), 1f)) Fail("대장간 불씨 4 반응");
            // 녹임 실제 — 수 붙은 적에게는 안 되니 빙 붙이고 화: 녹임 × 1.35
            e.ReviveNow(); e.WarpForTest(fc.transform.position + new Vector3(40f, 0f, 40f));
            e.TakeHit(1f, GoElement.Cryo, 10f, out _);
            ehp = e.Hp;
            e.TakeHit(10f, GoElement.Pyro, 10f, out var rx);
            if (rx != GoReaction.Melt || !Near(ehp - e.Hp, 10f * GoElements.MeltMul * 1.35f, 0.05f)) Fail($"녹임 {rx} {ehp - e.Hp} ≠ {10f * GoElements.MeltMul * 1.35f}");
            else parts.Add("녹임 ×1.35");
            ArtifactState.ResetForTest();
            foreach (var s in new[] { "flower", "plume", "sands", "goblet" }) ArtifactState.Equip(x, ArtifactState.Add(5, "viridescent", s));
            if (!Near(fc.SetReactMul(GoReaction.Swirl), 1.5f) || !Near(fc.SetReactMul(GoReaction.Melt), 1f)) Fail("솔바람 피리 4 회오리");
            ArtifactState.ResetForTest();
            e.ReviveNow();
            e.WarpForTest(fc.transform.position + new Vector3(60f, 0f, 60f));
            fc.RebuildParty();
            fc.ResetForTest();
            return string.Join("·", parts);
        }

        private static void Recruit(string id)
        {
            if (!HeroDexState.IsRecruited(id)) PartyState.Recruit(id);
        }

        private static bool Swap(FieldCombat fc, string id)
        {
            fc.ResetForTest();
            for (int i = 0; i < fc.Party.Count; i++)
                if (fc.Party[i].Id == id) { if (i == 0 || fc.Swap(i)) return true; }
            Fail($"{id} 로 교체 못 함(명단에 없음)");
            return false;
        }

        private static void CheckCapAndSalvage()
        {
            ArtifactState.ResetForTest();
            string x = HeroesOf(GoWeapons.Type.Sword)[0];
            Recruit(x);
            string worn = ArtifactState.Add(4, "gladiator", "flower");
            ArtifactState.Equip(x, worn);
            for (int i = 0; i < GoArtifacts.Cap + 4; i++) ArtifactState.Add(i % 3 == 0 ? 4 : 5);
            if (ArtifactState.Count != GoArtifacts.Cap || ArtifactState.Get(worn) == null || ArtifactState.Polish < 5) Fail($"상한 {ArtifactState.Count}·낀 것 {ArtifactState.Get(worn) != null}·연마석 {ArtifactState.Polish}");
            int n4 = 0;
            foreach (var a in ArtifactState.All) if (a.rarity == 4 && a.owner == "") n4++;
            int p0 = ArtifactState.Polish;
            if (ArtifactState.SalvageLoose4() != n4 || ArtifactState.Polish - p0 != n4 || ArtifactState.Get(worn) == null) Fail("안 낀 ★4 분해");
            foreach (var a in ArtifactState.All) if (a.rarity == 4 && a.owner == "") { Fail("★4 가 남음"); break; }
        }

        private static void CheckSources()
        {
            ArtifactState.ResetForTest();
            if (ArtifactState.OnChest(GoTreasure.Grade.Common).Length != 0 || ArtifactState.Count != 0) Fail("나무 상자에 보패");
            ArtifactState.OnChest(GoTreasure.Grade.Exquisite);
            ArtifactState.OnChest(GoTreasure.Grade.Precious);
            string lux = ArtifactState.OnChest(GoTreasure.Grade.Luxurious);
            var all = ArtifactState.All;
            if (all.Count != 4 || all[0].rarity != 4 || all[1].rarity != 5 || all[2].rarity != 5 || all[3].rarity != 5 || !lux.Contains(" · ")) Fail("상자 무늬 ★4·옻칠 ★5·금박 ★5 둘");
            FieldEnemy elite = null;
            foreach (var e in FieldEnemy.All) if (e.IsElemental && e.ShieldMax > 0f && !e.IsGuardian && !e.IsHero && e.Alive) { elite = e; break; }
            if (elite == null) { Fail("방패 두른 원소 괴물이 없음"); return; }
            elite.SetShieldForTest(0f);
            elite.TakeRaw(elite.Hp + 999f, Color.white);
            if (ArtifactState.Count != 5 || ArtifactState.All[4].rarity != 4) Fail($"정예 쓰러뜨림 보패 {ArtifactState.Count} ≠ 5");
            elite.ReviveNow();
        }

        private static void CheckDexPanel(HeroDexUi dex)
        {
            ArtifactState.ResetForTest();
            string id = HeroesOf(GoWeapons.Type.Polearm)[0];
            Recruit(id);
            string u4 = ArtifactState.Add(4, "depth", "plume");
            string u5 = ArtifactState.Add(5, "emblem", "plume");
            ArtifactState.AddPolish(50);
            GoldState.Restore(100000);
            GoHeroes.TryGet(id, out var hero);
            dex.Open();
            dex.SelectEra(hero.Era);
            int k = 0, idx = -1;
            foreach (var x in GoHeroes.All) { if (x.Era != hero.Era) continue; if (x.Id == id) idx = k; k++; }
            dex.Select(idx);
            dex.ArtifactSlotButton(1).onClick.Invoke();
            if (dex.ArtifactSlot != 1 || !dex.ArtifactText.Contains(GoArtifacts.SlotName("plume"))) Fail($"보패 칸 '{dex.ArtifactText}'");
            dex.ArtifactButton(0).onClick.Invoke();
            if (ArtifactState.Get(u5).owner != id) Fail("바꾸기 첫 번 — ★5 가 먼저 안 낌");
            dex.ArtifactButton(0).onClick.Invoke();
            if (ArtifactState.Get(u4).owner != id || ArtifactState.Get(u5).owner != "") Fail("바꾸기 두 번 — ★4 로");
            dex.ArtifactButton(0).onClick.Invoke();
            if (ArtifactState.EquippedOf(id).ContainsKey("plume")) Fail("바꾸기 세 번 — 빈 칸이 아님");
            dex.ArtifactButton(0).onClick.Invoke();
            dex.ArtifactButton(1).onClick.Invoke();
            if (ArtifactState.Get(u5).lv != 1) Fail("강화 단추가 안 먹음");
            if (!dex.ArtifactText.Contains(GoArtifacts.SetOf("emblem").Name)) Fail($"보패 글에 세트 이름이 없음 '{dex.ArtifactText}'");
            dex.ArtifactButton(2).onClick.Invoke();
            if (ArtifactState.Get(u5).owner != "") Fail("빼기 단추가 안 먹음");
            dex.ArtifactButton(3).onClick.Invoke();
            if (ArtifactState.Get(u4) != null || ArtifactState.Get(u5) == null) Fail("★4 분해 단추");
            dex.Close();
        }

        private static void CheckSave(string savePath)
        {
            ArtifactState.ResetForTest();
            string x = HeroesOf(GoWeapons.Type.Sword)[0];
            Recruit(x);
            string uid = ArtifactState.Add(5, "viridescent", "goblet");
            ArtifactState.AddPolish(99);
            GoldState.Restore(100000);
            for (int i = 0; i < 6; i++) ArtifactState.Up(uid);
            ArtifactState.Equip(x, uid);
            var a = ArtifactState.Get(uid);
            int subs = a.subs.Count;
            float main = GoArtifacts.MainValue(a);
            int polish = ArtifactState.Polish;
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"version\":22") || !json.Contains($"\"artifactPolish\":{polish}") || !json.Contains("\"viridescent\"")) Fail("세이브 v22 에 보패가 없다");
            ArtifactState.ResetForTest();
            if (!SaveState.TryLoad()) { Fail("v22 TryLoad 실패"); return; }
            var b = ArtifactState.Get(uid);
            if (b == null || b.lv != 6 || b.owner != x || b.subs.Count != subs || !Near(GoArtifacts.MainValue(b), main) || ArtifactState.Seq != 1 || ArtifactState.Polish != polish)
                Fail("v22 왕복 뒤 보패가 달라짐");
            string v21 = Regex.Replace(json.Replace("\"version\":22", "\"version\":21"), ",\"artifacts\":\\[.*\\],\"artifactSeq\":\\d+,\"artifactPolish\":\\d+", "");
            if (v21.Contains("artifactPolish")) { Fail("v21 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, v21);
            if (!SaveState.TryLoad()) { Fail("v21 파일 TryLoad 실패"); return; }
            if (ArtifactState.Count != 0 || ArtifactState.Polish != 0) Fail("v21 파일을 읽었는데 보패가 비어 있지 않음");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] artifacts FAIL - {msg}");
        }
    }
}
