using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-6 "채집·요리"(웹 사가고 ⑲-6 진단 항목) — `PlaytestHeadless` 가 보패 진단 뒤에 부른다.
    /// 표(재료 아홉·요리 여덟·지역마다 무리·포기가 뭍에·솥 다섯) · 바늘·품질 · 줍기·다시 자라기(일반 30분·특산 1시간, 시각은 진단이 붙든다) ·
    /// 솥 거리 · 조리(재료·숙련·자동은 다섯 번 뒤 보통) · 먹기(한 사람 회복·포만감·명단 회복·되살리기) · 버프(공격 고정·치명·방어·스태미나·계열 갈이·300초) ·
    /// 산적 고기 · 요리 창(진짜 단추 — 조리·불 끄기·먹기) · 세이브 v23 왕복·v22 로드. 끝나면 요리·동행·돈·세이브 파일·자리를 되돌린다.
    /// </summary>
    public static class PlaytestGoCooking
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var field = CookField.Instance;
            var ui = CookingUi.Instance;
            if (fc == null || pc == null || field == null || ui == null) { Fail("FieldCombat/PlayerController/CookField/CookingUi 없음"); return false; }

            var startBag = CookState.SnapshotBag();
            var startProf = CookState.SnapshotProf();
            var startGather = CookState.SnapshotGather();
            var startMembers = new List<string>(PartyState.MemberIds);
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            string parts = "";
            try
            {
                CookState.NowForTest = 1_000_000;
                CheckTables(field);
                CheckGather(field);
                CheckCook();
                parts = CheckEat(fc);
                CheckBuffs(fc);
                CheckMeat();
                CheckUi(ui, fc, pc, field);
                CheckSave(savePath);
            }
            finally
            {
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                CookState.NowForTest = -1;
                CookingUi.NeedleForTest = -1f;
                CookState.ClearSession();
                CookState.Restore(startBag, startProf, startGather);
                PartyState.Restore(startMembers);
                GoStamina.ResetFull();
                ui.Close();
                field.Rebuild();
                fc.ResetForTest();
                fc.RebuildParty();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] cooking OK - 재료 9·요리 8·포기 {GoCooking.Nodes.Length}(지역 일곱 모두·뭍에)·솥 {field.Pots.Count} · 바늘·품질 · 줍기·다시 자라기 30분/1시간 · 솥 거리 · 조리·숙련·자동 · {parts} · 버프(공격·치명·방어·스태미나·계열 갈이·300초) · 산적 고기 · 요리 창 단추 · 세이브 v23 왕복·v22 로드");
            return _ok;
        }

        private static bool Near(float a, float b, float eps = 0.01f) => Mathf.Abs(a - b) <= eps;

        private static void CheckTables(CookField field)
        {
            if (GoCooking.Items.Length != 9 || GoCooking.Recipes.Length != 8) Fail("재료 9·요리 8 이 아님");
            foreach (var r in GoCooking.Recipes)
                foreach (var (item, _) in r.Ing) if (!GoCooking.TryItem(item, out _)) Fail($"{r.Id} 재료 {item} 없음");
            var ids = new HashSet<string>();
            var perRegion = new Dictionary<string, int>();
            var specials = new Dictionary<string, int>();
            foreach (var n in GoCooking.Nodes)
            {
                if (!ids.Add(n.Id)) Fail($"포기 id 겹침 {n.Id}");
                perRegion.TryGetValue(n.RegionId, out int c);
                perRegion[n.RegionId] = c + 1;
                if (n.Special) { specials.TryGetValue(n.RegionId, out int s); specials[n.RegionId] = s + 1; }
                var (gx, gy) = TestMapData.WorldToGrid(n.Pos);
                char ch = TestMapData.TileAt(Mathf.Clamp(gx, 0, TestMapData.Cols - 1), Mathf.Clamp(gy, 0, TestMapData.RowCount - 1));
                if (ch == '~' || ch == '^' || ch == 'B') Fail($"{n.Id} 가 뭍이 아님('{ch}')");
            }
            foreach (var r in GoWorldMap.Regions)
            {
                perRegion.TryGetValue(r.Id, out int c);
                specials.TryGetValue(r.Id, out int s);
                int wantS = r.Id == "village" ? 2 : 4;
                if (c < 8 + wantS || s != wantS) Fail($"{r.Id} 포기 {c}·특산 {s}(특산 {wantS} 이어야)");
            }
            if (field.Pots.Count != GoWorldMap.Waypoints.Length) Fail($"솥 {field.Pots.Count} ≠ 역참 {GoWorldMap.Waypoints.Length}");
            if (!Near(GoCooking.NeedleAt(0f), 0f) || !Near(GoCooking.NeedleAt(0.8f), 1f) || !Near(GoCooking.NeedleAt(1.2f), 0.5f)) Fail("바늘 왕복");
            var hc = GoCooking.Recipes[0];
            if (GoCooking.QualityAt(hc, hc.Zone) != 2 || GoCooking.QualityAt(hc, hc.Zone + 0.15f) != 1 || GoCooking.QualityAt(hc, hc.Zone - 0.3f) != 0) Fail("품질 칸");
        }

        private static void CheckGather(CookField field)
        {
            CookState.ResetForTest();
            field.Rebuild();
            GoCooking.Node common = default, special = default;
            foreach (var n in GoCooking.Nodes)
            {
                if (!n.Special && common.Id == null && n.RegionId == "south_glade") common = n;
                if (n.Special && special.Id == null && n.RegionId == "river") special = n;
            }
            Vector3 cp = field.PosOf(common.Id);
            int got = field.Check(cp);
            if (got < 1 || CookState.Count(common.Item) < 1 || field.Shown(common.Id) || CookState.Available(common)) Fail($"{common.Id} 줍기 {got}");
            int before = CookState.Count(common.Item);
            field.Check(cp);
            if (CookState.Count(common.Item) != before) Fail("다시 자라기 전에 또 주움");
            CookState.NowForTest += GoCooking.RespawnCommonSec - 1;
            if (CookState.Available(common)) Fail("30분 전에 자람");
            CookState.NowForTest += 1;
            if (!CookState.Available(common)) Fail("30분에 안 자람");
            field.Check(field.PosOf(special.Id));
            if (CookState.Count(special.Item) < 1) Fail($"특산 {special.Id} 줍기");
            CookState.NowForTest += GoCooking.RespawnCommonSec;
            if (CookState.Available(special)) Fail("특산이 30분에 자람");
            CookState.NowForTest += GoCooking.RespawnSpecialSec;
            if (!CookState.Available(special)) Fail("특산이 1시간 넘어도 안 자람");
            if (field.Check(cp + Vector3.up * 8f) != 0) Fail("높이 8m 위에서 주움");
            // 솥 거리
            Vector3 pot = field.Pots[0];
            if (!field.AtPot(pot + Vector3.right * 6f) || field.AtPot(pot + Vector3.right * 9f)) Fail("솥 7.4m 거리");
        }

        private static void Give(int ri, int times)
        {
            foreach (var (item, n) in GoCooking.Recipes[ri].Ing) CookState.Add(item, n * times);
        }

        private static void CheckCook()
        {
            CookState.ResetForTest();
            if (CookState.CanCook(0, true, out string why) || !why.Contains(GoCooking.ItemName("honey_flower"))) Fail($"재료 없이 조리 '{why}'");
            Give(0, 6);
            if (CookState.CanCook(0, false, out why) || why != GoLocalization.T("cook.why.pot", "역참 곁 솥에서만")) Fail("솥 밖에서 조리됨");
            string id = CookState.Cook(0, 2, true);
            if (id != "dish_honey_cake_2" || CookState.Count("honey_flower") != 10 || CookState.Count("apple") != 5 || CookState.Prof("honey_cake") != 1) Fail($"조리 {id}·재료·숙련");
            if (CookState.AutoCook(0, true) != null) Fail("숙련 1 에 자동 조리");
            for (int i = 0; i < 4; i++) CookState.Cook(0, 0, true);
            if (!CookState.CanAuto("honey_cake") || CookState.AutoCook(0, true) != "dish_honey_cake_1") Fail("숙련 5 뒤 자동 = 보통");
            if (CookState.BestDish(0) != 2) Fail("가장 좋은 품질");
        }

        private static string CheckEat(FieldCombat fc)
        {
            var parts = new List<string>();
            fc.RebuildParty();
            fc.ResetForTest();
            CookState.ClearSession();
            CookState.ResetForTest();
            var m = fc.Party[0];
            foreach (var o in fc.Party) o.Hp = o.MaxHp;
            m.Hp = m.MaxHp * 0.3f;
            CookState.Add(GoCooking.DishId("honey_cake", 2), 3);
            float hp0 = m.Hp;
            string t = fc.Eat(0, out string why);
            float want = Mathf.Min(m.MaxHp, hp0 + m.MaxHp * 0.26f + 80f * GoCooking.HealScale);
            if (t == null || !Near(m.Hp, want, 0.5f) || !Near(CookState.FullOf(m.Id), 35f)) Fail($"꿀꽃 떡 {m.Hp} ≠ {want} ({why})");
            else parts.Add("한 사람 26%+32");
            m.Hp = m.MaxHp * 0.3f;
            fc.Eat(0, out _);
            m.Hp = m.MaxHp * 0.3f;
            if (fc.Eat(0, out why) != null || CookState.Count(GoCooking.DishId("honey_cake", 2)) != 1) Fail($"포만감 105 인데 먹음 ({why})");
            CookState.Step(40f);
            if (!Near(CookState.FullOf(m.Id), 30f)) Fail($"포만감 초당 1 줄기 {CookState.FullOf(m.Id)}");
            // 명단 회복
            CookState.Add(GoCooking.DishId("mush_skewer", 1), 1);
            m.Hp = m.MaxHp * 0.5f;
            fc.Eat(1, out _);
            if (!Near(m.Hp, m.MaxHp * 0.59f, 0.5f)) Fail("버섯 꼬치 명단 9%");
            // 되살리기
            CookState.Add(GoCooking.DishId("meat_stew", 0), 1);
            if (fc.Eat(2, out why) != null || why != GoLocalization.T("cook.why.no_down", "쓰러진 사람이 없다")) Fail("쓰러진 사람 없이 되살림");
            var d = fc.Party[fc.Party.Count - 1];
            d.Hp = 0f;
            CookState.ClearSession();
            if (fc.Eat(2, out why) == null || d.Down || !Near(d.Hp, d.MaxHp * 0.1f, 0.5f)) Fail($"고기 찜 되살리기 ({why})");
            else parts.Add("되살리기 10%");
            if (fc.Eat(5, out why) != null) Fail("없는 요리를 먹음");
            fc.ResetForTest();
            CookState.ClearSession();
            return string.Join("·", parts);
        }

        private static void CheckBuffs(FieldCombat fc)
        {
            CookState.ResetForTest();
            fc.ResetForTest();
            float p = PerkState.AtkMultiplier * BondState.AtkMultiplier;
            float atk0 = fc.Atk, def0 = fc.ActiveDef;
            for (int i = 3; i < 8; i++) CookState.Add(GoCooking.DishId(GoCooking.Recipes[i].Id, 2), 1);
            fc.Eat(3, out _);
            if (!Near(fc.Atk - atk0, 24f * 0.75f * p, 0.05f)) Fail($"박하 고기볶음 공격 +{fc.Atk - atk0} ≠ {24f * 0.75f * p}");
            fc.Eat(6, out _);
            if (!Near(fc.ActiveDef - def0, 20f * 0.6f)) Fail($"바지락탕 방어 +{fc.ActiveDef - def0}");
            fc.Eat(7, out _);
            GoStamina.SetForTest(100f);
            GoStamina.TrySpend(20f);
            if (!Near(GoStamina.Value, 100f - 20f * 0.76f)) Fail($"갯소라 구이 스태미나 {GoStamina.Value}");
            fc.Eat(4, out _); // 같은 공격 계열 — 박하 고기볶음을 갈아 끼운다
            if (CookState.Buff("atk") != 0f || !Near(CookState.Buff("crit_rate"), 0.1f) || !Near(fc.Atk, atk0, 0.05f)) Fail("공격 계열 갈이");
            int n = 0;
            foreach (var _ in CookState.Buffs()) n++;
            if (n != 3) Fail($"켜진 계열 {n} ≠ 3");
            var ended = CookState.Step(GoCooking.BuffSec + 1f);
            n = 0;
            foreach (var _ in CookState.Buffs()) n++;
            if (n != 0 || ended.Count != 3 || CookState.StaminaMul != 1f) Fail("300초 뒤 버프가 남음");
            GoStamina.ResetFull();
        }

        private static void CheckMeat()
        {
            CookState.ResetForTest();
            FieldEnemy bandit = null;
            foreach (var e in FieldEnemy.All) if (e.EnemyKind == FieldEnemy.Kind.Bandit && !e.IsHero && e.Alive) { bandit = e; break; }
            if (bandit == null) { Fail("산적이 없음"); return; }
            if (bandit.Shielded) bandit.SetShieldForTest(0f);
            bandit.TakeRaw(bandit.Hp + 999f, Color.white);
            if (CookState.Count("meat") != FieldEnemy.MeatPerBandit) Fail($"산적 고기 {CookState.Count("meat")}");
            bandit.ReviveNow();
        }

        private static void CheckUi(CookingUi ui, FieldCombat fc, PlayerController pc, CookField field)
        {
            CookState.ResetForTest();
            Give(0, 1);
            pc.Teleport(field.Pots[0] + new Vector3(0f, 0.3f, 4f));
            if (!CookField.PlayerAtPot()) Fail("솥 곁으로 옮겼는데 솥 밖");
            ui.Open();
            if (!ui.IsOpen || !ui.RowText(0).Contains(GoCooking.Recipes[0].Name) || !ui.MatsText.Contains(GoCooking.ItemName("honey_flower"))) Fail($"요리 창 글 '{ui.RowText(0)}'");
            if (!ui.CookButton(0).interactable || ui.CookButton(1).interactable) Fail("조리 단추 켜짐이 재료와 다름");
            ui.CookButton(0).onClick.Invoke();
            if (ui.Cooking != 0) Fail("조리 단추가 바늘을 안 띄움");
            CookingUi.NeedleForTest = GoCooking.Recipes[0].Zone;
            ui.StopButton.onClick.Invoke();
            CookingUi.NeedleForTest = -1f;
            if (CookState.Count(GoCooking.DishId("honey_cake", 2)) != 1 || ui.Cooking != -1) Fail("불 끄기 — 맛있는 꿀꽃 떡 하나");
            if (!ui.EatButton(0).interactable) Fail("먹기 단추가 꺼짐");
            fc.Party[0].Hp = fc.Party[0].MaxHp * 0.5f;
            ui.EatButton(0).onClick.Invoke();
            if (CookState.Count(GoCooking.DishId("honey_cake", 2)) != 0 || fc.Party[0].Hp <= fc.Party[0].MaxHp * 0.5f) Fail("먹기 단추");
            ui.CloseButton.onClick.Invoke();
            if (ui.IsOpen) Fail("닫기 단추");
            pc.Teleport(fc.SafePoint);
            fc.ResetForTest();
            CookState.ClearSession();
        }

        private static void CheckSave(string savePath)
        {
            CookState.ResetForTest();
            CookState.Add("orchid", 3);
            CookState.Add(GoCooking.DishId("clam_soup", 2), 2);
            Give(6, 1);
            CookState.Cook(6, 1, true);
            var node = GoCooking.Nodes[0];
            CookState.Pick(node);
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"version\":27") || !json.Contains("\"cookBag\":[") || !json.Contains(node.Id)) Fail("세이브 v23 에 요리가 없다");
            CookState.ResetForTest();
            if (!SaveState.TryLoad()) { Fail("v23 TryLoad 실패"); return; }
            if (CookState.Count("orchid") != 3 || CookState.Count(GoCooking.DishId("clam_soup", 2)) != 2 || CookState.Count(GoCooking.DishId("clam_soup", 1)) != 1
                || CookState.Prof("clam_soup") != 1 || CookState.Available(node)) Fail("v23 왕복 뒤 요리가 달라짐");
            string v22 = Regex.Replace(json.Replace("\"version\":27", "\"version\":22"), ",\"cookBag\":\\[[^\\]]*\\],\"cookProf\":\\[[^\\]]*\\],\"cookGather\":\\[[^\\]]*\\]", "");
            if (v22.Contains("cookBag")) { Fail("v22 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, v22);
            if (!SaveState.TryLoad()) { Fail("v22 파일 TryLoad 실패"); return; }
            if (CookState.Count("orchid") != 0 || !CookState.Available(node)) Fail("v22 파일을 읽었는데 요리가 비어 있지 않음");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] cooking FAIL - {msg}");
        }
    }
}
