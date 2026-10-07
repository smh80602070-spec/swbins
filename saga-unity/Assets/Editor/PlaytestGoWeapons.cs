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
    /// PLAN.md 109-14-5a "무기·치명타"(웹 사가만리 ⑲-5 진단 항목) — `PlaytestHeadless` 가 무예 진단 뒤에 부른다.
    /// 종류 해시(웹 표본 넷·주인공 칼·다섯 고루) · 기본 공격 모양(칼 = 옛 3타 · 대도 무거운 타격 · 서책 원소 · 활 멀리) · 무기 공격 식·상한·강화 값·벼림·울림(5 넘치면 강화석) ·
    /// 옮기면 먼저 든 사람은 수련용 · 부옵션(치명 확률)·체력% · 치명 굴림(100% 면 ×(1+치피)·0% 면 안 남) · 서책·활·대도 실제 공격 · 얻는 곳(상자·정예) ·
    /// 도감 무기 칸(진짜 단추) · 세이브 v21 왕복·v20 로드. 끝나면 무기·동행·돈·세이브 파일·치명 스위치를 되돌린다.
    /// </summary>
    public static class PlaytestGoWeapons
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
            var startInv = WeaponState.SnapshotInv();
            var startEquip = WeaponState.SnapshotEquip();
            int startOre = WeaponState.Ore;
            var startTalent = TalentState.Snapshot();
            var startMats = TalentState.SnapshotMats();
            int startGold = GoldState.Gold;
            bool startCritOff = FieldCombat.CritOffForTest;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            string combat = "";
            try
            {
                CheckTables();
                CheckGrowth();
                CheckEquip();
                combat = CheckCombat(fc, pc);
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
                WeaponState.Restore(startInv, startEquip, startOre);
                TalentState.Restore(startTalent, startMats);
                GoldState.Restore(startGold);
                fc.ResetForTest();
                fc.RebuildParty();
                dex.Close();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] weapons OK - 종류 해시(웹 표본 넷·주인공 칼·다섯 고루) · 모양 다섯 · 공격 식·상한·강화·벼림·울림 · 옮기기 · 부옵션 · {combat} · 얻는 곳(상자·정예) · 도감 무기 칸 · 세이브 v21 왕복·v20 로드");
            return _ok;
        }

        private static void CheckTables()
        {
            if (GoWeapons.TypeOf("hero") != GoWeapons.Type.Sword || GoWeapons.TypeOf(null) != GoWeapons.Type.Sword) Fail("주인공이 칼이 아님");
            // 웹 `typeOf` 로 뽑은 표본
            if (GoWeapons.TypeOf("sg_guanyu") != GoWeapons.Type.Bow || GoWeapons.TypeOf("sg_zhugeliang") != GoWeapons.Type.Sword
                || GoWeapons.TypeOf("kr_yisunsin") != GoWeapons.Type.Catalyst || GoWeapons.TypeOf("jp_musashi") != GoWeapons.Type.Polearm) Fail("종류 해시가 웹 표본과 다름");
            var count = new int[5];
            foreach (var h in GoHeroes.All) count[(int)GoWeapons.TypeOf(h.Id)]++;
            for (int i = 0; i < 5; i++) if (count[i] < 10) Fail($"{(GoWeapons.Type)i} {count[i]} 명 — 치우침");

            var sword = GoWeapons.Kits[0];
            for (int i = 0; i < 3; i++) if (Mathf.Abs(sword.Mul[i] - FieldCombat.ComboMul[i]) > 0.001f) Fail($"칼 {i + 1}타 {sword.Mul[i]} ≠ 옛 {FieldCombat.ComboMul[i]}");
            if (Mathf.Abs(sword.Reach - FieldCombat.AttackReach) > 0.01f || Mathf.Abs(sword.Sec[0] - FieldCombat.AttackIntervalSec) > 0.01f) Fail("칼 사거리·빠르기가 옛 값이 아님");
            if (!GoWeapons.Kits[1].Heavy || GoWeapons.Kits[1].Mul[2] < 2f) Fail("대도 무거운 타격");
            if (!GoWeapons.Kits[3].Element || GoWeapons.Kits[3].Reach > 0f || GoWeapons.Kits[4].Range < 18f) Fail("서책 원소·활 사거리");
            if (GoWeapons.All.Length != 16) Fail($"무기 {GoWeapons.All.Length} ≠ 16"); // 15 + 낚시 조합 갯바람 작살(109-14-24)
            GoWeapons.TryGet("w_sword_3", out var w3);
            if (Mathf.Abs(GoWeapons.AtkAt(w3, 1, 0) - 34f * 0.75f) > 0.01f || Mathf.Abs(GoWeapons.AtkAt(w3, 10, 1) - 34f * 0.75f * (1f + 0.54f + 0.1f)) > 0.01f) Fail("무기 공격 식");
            if (GoWeapons.Cap(0) != 10 || GoWeapons.Cap(5) != 30) Fail("무기 상한");
            if (GoWeapons.UpCost(1) != (1, 15) || GoWeapons.UpCost(6) != (2, 90)) Fail("강화 값");
            if (GoWeapons.ChestWeapon("c", GoTreasure.Grade.Common) != null || GoWeapons.ChestWeapon("c", GoTreasure.Grade.Luxurious)?.EndsWith("_4") != true) Fail("상자 무기 등급");
        }

        private static void CheckGrowth()
        {
            WeaponState.ResetForTest();
            GoldState.Restore(100000);
            if (WeaponState.Give("w_sword_3").Length == 0 || !WeaponState.Owned("w_sword_3")) Fail("무기 얻기");
            WeaponState.Give("w_sword_3");
            if (WeaponState.RecOf("w_sword_3").refine != 2) Fail("또 얻었는데 울림 2 가 아님");
            for (int i = 0; i < 3; i++) WeaponState.Give("w_sword_3");
            WeaponState.Give("w_sword_3");
            if (WeaponState.RecOf("w_sword_3").refine != 5 || WeaponState.Ore != GoWeapons.RefineOverOre) Fail($"울림 5 넘침 → 강화석 {WeaponState.Ore}");
            WeaponState.AddOre(100);
            for (int i = 0; i < 9; i++) if (!WeaponState.Up("w_sword_3")) Fail($"강화 {i + 1} → {i + 2} 안 됨");
            if (WeaponState.RecOf("w_sword_3").lv != 10 || WeaponState.Up("w_sword_3")) Fail("Lv 10 상한에서 더 올라감");
            if (!WeaponState.CanUp("w_sword_3", out string why, out _) && why != GoLocalization.T("weapon.why.cap", "무기 벼림 필요")) Fail($"상한 까닭 '{why}'");
            int g0 = GoldState.Gold;
            if (!WeaponState.Ascend("w_sword_3") || g0 - GoldState.Gold != 250 || !WeaponState.Up("w_sword_3")) Fail("벼림 1(금 250) 뒤 Lv 11");
            if (WeaponState.Up("w_sword_0") || WeaponState.Ascend("w_sword_0")) Fail("수련용이 강화·벼림됨");
        }

        private static void CheckEquip()
        {
            var swords = new List<string>();
            foreach (var h in GoHeroes.All) if (GoWeapons.TypeOf(h.Id) == GoWeapons.Type.Sword) swords.Add(h.Id);
            string a = swords[0], b = swords[1];
            if (WeaponState.Equip(a, "w_sword_3")) Fail("안 들인 사람이 무기를 듦");
            PartyState.Recruit(a);
            PartyState.Recruit(b);
            if (!WeaponState.Equip(a, "w_sword_3") || WeaponState.Equipped(a) != "w_sword_3") Fail("무기 들기");
            if (WeaponState.Equip(a, "w_bow_0")) Fail("다른 종류를 듦");
            WeaponState.Equip(b, "w_sword_3");
            if (WeaponState.Equipped(b) != "w_sword_3" || WeaponState.Equipped(a) != "w_sword_0") Fail("옮겼는데 먼저 든 사람이 수련용이 아님");
            WeaponState.Give("w_sword_4");
            WeaponState.Equip(a, "w_sword_4");
            var md = WeaponState.ModsOf(a);
            if (Mathf.Abs(md.CritRate - (GoWeapons.BaseCritRate + 0.035f)) > 0.0001f || md.Pas != "s") Fail($"청하 보검 치명 확률 {md.CritRate}·효과 {md.Pas}");
        }

        private static string CheckCombat(FieldCombat fc, PlayerController pc)
        {
            var parts = new List<string>();
            var e = FieldEnemy.All[0];
            fc.RebuildParty();
            fc.ResetForTest();
            Vector3 fwd = pc.Visual != null ? pc.Visual.forward : pc.transform.forward;
            fwd.y = 0f; fwd.Normalize();

            // 치명 — 주인공(수련용 목검) 100% 면 ×1.5, 0% 면 없음
            FieldCombat.CritOffForTest = false;
            FieldCombat.CritRateForTest = 1f;
            e.ReviveNow(); e.WarpForTest(fc.transform.position + fwd * 2.5f);
            float atk = fc.Atk, hp0 = e.Hp;
            fc.Attack();
            if (!fc.LastCrit || Mathf.Abs(hp0 - e.Hp - atk * FieldCombat.ComboMul[0] * (1f + GoWeapons.BaseCritDmg)) > 0.5f) Fail($"치명 100% 피해 {hp0 - e.Hp}");
            FieldCombat.CritRateForTest = 0f;
            fc.ResetForTest();
            e.ReviveNow(); e.WarpForTest(fc.transform.position + fwd * 2.5f);
            hp0 = e.Hp;
            fc.Attack();
            if (fc.LastCrit || Mathf.Abs(hp0 - e.Hp - atk * FieldCombat.ComboMul[0]) > 0.5f) Fail("치명 0% 인데 치명");
            hp0 = e.Hp;
            e.TakeHit(10f, GoElement.Physical, 10f, out _);
            if (Mathf.Abs(hp0 - e.Hp - 10f) > 0.01f) Fail("직접 맞히기(반응 조각 결)가 치명을 굴림");
            FieldCombat.CritOffForTest = true;
            FieldCombat.CritRateForTest = -1f;
            parts.Add("치명 100% ×1.5·0% 없음·직접 안 굴림");

            // 서책 — 인물 원소로 멀리 하나 / 활 — 더 멀리 / 대도 — 얼음 깨뜨림
            string cat = null, bow = null, clay = null;
            foreach (var h in GoHeroes.All)
            {
                var t = GoWeapons.TypeOf(h.Id);
                if (t == GoWeapons.Type.Catalyst && cat == null && GoElements.Attaches(GoHeroes.ElementOf(h))) cat = h.Id;
                if (t == GoWeapons.Type.Bow && bow == null) bow = h.Id;
                if (t == GoWeapons.Type.Claymore && clay == null) clay = h.Id;
            }
            foreach (var id in new[] { cat, bow, clay }) if (id != null) PartyState.Recruit(id);
            fc.RebuildParty();
            if (Swap(fc, cat))
            {
                e.ReviveNow(); e.WarpForTest(fc.transform.position + fwd * 8f);
                if (fc.Attack() != 1 || e.Aura != fc.Active.Element) Fail($"서책 8m 한 발·원소 {e.Aura} ≠ {fc.Active.Element}");
                else parts.Add($"서책 8m {GoElements.NameOf(fc.Active.Element)}");
            }
            if (Swap(fc, bow))
            {
                e.ReviveNow(); e.WarpForTest(fc.transform.position + fwd * 16f);
                hp0 = e.Hp;
                if (fc.Attack() != 1 || e.Hp >= hp0) Fail("활 16m 한 발");
                else parts.Add("활 16m");
            }
            if (Swap(fc, clay))
            {
                e.ReviveNow(); e.WarpForTest(fc.transform.position + fwd * 2.5f);
                e.TakeHit(1f, GoElement.Hydro, 10f, out _); e.TakeHit(1f, GoElement.Cryo, 10f, out _);
                fc.Attack();
                if (e.Frozen) Fail("대도 1타가 얼음을 못 깸");
                else parts.Add("대도 깨뜨림");
                // 체력% — 나무꾼 큰도끼 +7%
                float hpBase = fc.Active.MaxHp;
                WeaponState.Give("w_claymore_3");
                WeaponState.Equip(clay, "w_claymore_3");
                fc.RebuildParty();
                if (Mathf.Abs(fc.Active.MaxHp - hpBase * 1.07f) > 0.5f) Fail($"큰도끼 체력% {fc.Active.MaxHp} ≠ {hpBase} × 1.07");
            }
            e.ReviveNow();
            e.WarpForTest(fc.transform.position + new Vector3(60f, 0f, 60f));
            fc.ResetForTest();
            return string.Join("·", parts);
        }

        private static bool Swap(FieldCombat fc, string id)
        {
            fc.ResetForTest();
            for (int i = 0; i < fc.Party.Count; i++)
                if (fc.Party[i].Id == id) { if (i == 0 || fc.Swap(i)) return true; }
            Fail($"{id} 로 교체 못 함(명단에 없음)");
            return false;
        }

        private static void CheckSources()
        {
            WeaponState.Restore(null, null, 0);
            string txt = WeaponState.OnChest("chest_x", GoTreasure.Grade.Common);
            if (WeaponState.Ore != 2 || WeaponState.SnapshotInv().Count != 0 || txt.Length == 0) Fail("평범 상자 강화석 2·무기 없음");
            WeaponState.OnChest("chest_x", GoTreasure.Grade.Precious);
            var inv = WeaponState.SnapshotInv();
            if (WeaponState.Ore != 17 || inv.Count != 1 || !inv[0].wid.EndsWith("_3")) Fail("진귀 상자 강화석 15·★3 무기");
            FieldEnemy elite = null;
            foreach (var e in FieldEnemy.All) if (e.IsElemental && e.ShieldMax > 0f && !e.IsGuardian && !e.IsHero && e.Alive) { elite = e; break; }
            if (elite == null) { Fail("방패 두른 원소 괴물이 없음"); return; }
            elite.SetShieldForTest(0f);
            elite.TakeRaw(elite.Hp + 999f, Color.white);
            if (WeaponState.Ore != 18) Fail($"정예 쓰러뜨림 강화석 {WeaponState.Ore} ≠ 18");
            elite.ReviveNow();
        }

        private static void CheckDexPanel(HeroDexUi dex)
        {
            string id = null;
            foreach (var h in GoHeroes.All) if (GoWeapons.TypeOf(h.Id) == GoWeapons.Type.Polearm) { id = h.Id; break; }
            PartyState.Recruit(id);
            WeaponState.Restore(null, null, 50);
            WeaponState.Give("w_polearm_3");
            GoldState.Restore(100000);
            GoHeroes.TryGet(id, out var hero);
            dex.Open();
            dex.SelectEra(hero.Era);
            int k = 0, idx = -1;
            foreach (var x in GoHeroes.All) { if (x.Era != hero.Era) continue; if (x.Id == id) idx = k; k++; }
            dex.Select(idx);
            if (!dex.WeaponText.Contains(GoWeapons.TypeName(GoWeapons.Type.Polearm))) Fail($"무기 칸 '{dex.WeaponText}'");
            dex.WeaponButton(2).onClick.Invoke();
            if (WeaponState.Equipped(id) != "w_polearm_3") Fail("바꾸기 단추가 대나무 창으로 안 바꿈");
            dex.WeaponButton(0).onClick.Invoke();
            if (WeaponState.RecOf("w_polearm_3").lv != 2) Fail("강화 단추가 안 먹음");
            dex.Close();
        }

        private static void CheckSave(string savePath)
        {
            WeaponState.Restore(new List<WeaponState.InvEntry> { new WeaponState.InvEntry { wid = "w_bow_4", lv = 12, asc = 1, refine = 3 } },
                new List<WeaponState.EquipEntry> { new WeaponState.EquipEntry { hero = "sg_guanyu", wid = "w_bow_4" } }, 7);
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"version\":29") || !json.Contains("\"weaponOre\":7") || !json.Contains("w_bow_4")) Fail("세이브 v21 에 무기가 없다");
            WeaponState.ResetForTest();
            if (!SaveState.TryLoad() || WeaponState.RecOf("w_bow_4").lv != 12 || WeaponState.RecOf("w_bow_4").refine != 3 || WeaponState.Ore != 7) Fail("v21 왕복 뒤 무기가 달라짐");
            string v20 = Regex.Replace(json.Replace("\"version\":29", "\"version\":20"), ",\"weapons\":\\[[^\\]]*\\],\"weaponEquip\":\\[[^\\]]*\\],\"weaponOre\":\\d+", "");
            if (v20.Contains("weaponOre")) { Fail("v20 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, v20);
            if (!SaveState.TryLoad()) { Fail("v20 파일 TryLoad 실패"); return; }
            if (WeaponState.Owned("w_bow_4") || WeaponState.Ore != 0) Fail("v20 파일을 읽었는데 무기가 비어 있지 않음");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] weapons FAIL - {msg}");
        }
    }
}
