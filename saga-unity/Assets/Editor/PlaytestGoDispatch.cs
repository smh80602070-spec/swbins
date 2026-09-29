using System.Collections.Generic;
using System.Linq;
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
    /// PLAN.md 109-14-26 "탐사 파견"(웹 사가고 ⑲-26 진단 항목) — `PlaytestHeadless` 가 업적 진단 뒤에 부른다.
    /// 표(탐사지 여덟·지역·보상 셈 — 시간 배율·최소 1·잘 맞는 원소 +25% 올림 · 자리 = 여정 등급 2~5 · 게시판 자리·곁 판정) ·
    /// 흐름(게시판 밖·잠긴 지역·이미 나감·자리 꽉 참·들판 명단 동료·이미 탐사 중은 못 보냄 · 나간 동료는 편성에 못 넣음 · 시간이 흘러야 받음 · 받으면 보상·동료 복귀 · 부르면 보상 없음) ·
    /// 알림(불러온 직후 모아 한 줄 · 그 뒤 하나씩 한 번) · 세이브 왕복(옛 세이브는 빈 채) · 화면(단추 곁에서만·●N·창 줄·◀▶·보내기/부르기/받기).
    /// 끝나면 동행·탐사·돈·재료·강화석·연마석·레벨·지도 기록·세이브 파일·시각을 되돌린다.
    /// </summary>
    public static class PlaytestGoDispatch
    {
        private static string _tag;
        private static bool _ok;
        private const long T0 = 4_000_000;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var ui = DispatchUi.Instance;
            var field = DispatchField.Instance;
            if (fc == null || pc == null || ui == null || field == null) { Fail("FieldCombat/PlayerController/DispatchUi/DispatchField 없음"); return false; }

            var members = new List<string>(PartyState.MemberIds);
            var disp = DispatchState.Snapshot();
            int done0 = DispatchState.Done;
            var cookBag = CookState.SnapshotBag();
            var cookProf = CookState.SnapshotProf();
            var cookGather = CookState.SnapshotGather();
            var inv = WeaponState.SnapshotInv();
            var equip = WeaponState.SnapshotEquip();
            int ore = WeaponState.Ore;
            var arts = ArtifactState.Snapshot();
            int aseq = ArtifactState.Seq, apol = ArtifactState.Polish;
            int gold = GoldState.Gold;
            int lv = PlayerStats.Level, exp = PlayerStats.Exp;
            var wp0 = WorldMapState.SnapshotWaypoints();
            var rg0 = WorldMapState.SnapshotRegions();
            bool rev0 = WorldMapState.Revealed;
            long now0 = CookState.NowForTest;
            int board0 = DispatchUi.AtBoardForTest;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            var parts = new List<string>();
            try
            {
                CookState.NowForTest = T0;
                CheckTables(field, parts);
                CheckFlow(parts);
                CheckNotice(parts);
                CheckSave(savePath, parts);
                CheckUi(ui, parts);
            }
            finally
            {
                ui.Close();
                DispatchUi.AtBoardForTest = board0;
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                CookState.NowForTest = now0;
                PartyState.Restore(members);
                DispatchState.Restore(disp, done0);
                CookState.Restore(cookBag, cookProf, cookGather);
                WeaponState.Restore(inv, equip, ore);
                ArtifactState.Restore(arts, aseq, apol);
                GoldState.Restore(gold);
                PlayerStats.Restore(lv, exp);
                WorldMapState.Restore(wp0, rg0, rev0);
                fc.RebuildParty();
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] dispatch OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static GoDispatch.Site Site(string id) => GoDispatch.Sites.First(s => s.Id == id);

        private static void Setup(int rank)
        {
            var ids = GoHeroes.All.Take(6).Select(h => h.Id).ToList(); // 앞 셋 = 벤치, 뒤 셋 = 들판
            PartyState.Restore(ids);
            DispatchState.ResetForTest();
            PlayerStats.Restore(rank, 0);
            WorldMapState.Restore(null, null, false);
            CookState.NowForTest = T0;
        }

        // ---- 표 ----

        private static void CheckTables(DispatchField field, List<string> parts)
        {
            if (GoDispatch.Sites.Length != 8 || GoDispatch.Sites.Select(s => s.Id).Distinct().Count() != 8) Fail("탐사지가 여덟이 아님");
            foreach (var s in GoDispatch.Sites)
            {
                if (s.Name.StartsWith("dispatch.site.") || s.Desc.StartsWith("dispatch.desc.")) Fail($"{s.Id} 글이 없음");
                if (GoWorldMap.RegionName(s.Region).Length == 0 || GoWorldMap.Regions.All(r => r.Id != s.Region)) Fail($"{s.Id} 지역 {s.Region}");
                if (s.Gold + s.Ore + s.Dust == 0 && s.Items.Length == 0) Fail($"{s.Id} 보상이 없음");
                foreach (var (item, _) in s.Items) if (!GoCooking.TryItem(item, out _)) Fail($"{s.Id} 재료 {item} 없음");
            }
            if (GoDispatch.Sites.Count(s => s.Region == "village") != 2) Fail("마을 들판 둘(늘 열림)");
            // 109-14-32 고원 탐사지 둘 — 눈꽃 1씩, 경계비를 찾아야 열림(글자 지도 지역은 안 본다)
            var frostSites = GoDispatch.Sites.Where(s => s.Frost).ToArray();
            if (frostSites.Length != 2 || frostSites.Any(s => s.Id != "snow_fort" && s.Id != "ship_wreck" || !s.Items.Any(i => i.item == "snow_bloom" && i.n == 1) || s.Place != GoWorldMap.RegionName("frost"))) Fail("고원 탐사지 둘(눈꽃 1)");
            var fsnap = FrostState.Snapshot();
            FrostState.Restore(new string[0]);
            if (frostSites.Any(DispatchState.Open) || DispatchState.SendCheck("snow_fort", "x", 4, true) == null) Fail("경계비를 안 밟았는데 고원 탐사지가 열림");
            FrostState.Restore(new[] { "stele" });
            if (frostSites.Any(s => !DispatchState.Open(s))) Fail("경계비를 밟았는데 고원 탐사지가 잠김");
            FrostState.Restore(fsnap);
            var road = Site("old_road");
            if (GoDispatch.RewardOf(road, 4, false).Gold != 400 || GoDispatch.RewardOf(road, 8, false).Gold != 720 || GoDispatch.RewardOf(road, 20, false).Gold != 1520) Fail("금 배율(×1·1.8·3.8)");
            if (GoDispatch.RewardOf(road, 4, true).Gold != 500 || GoDispatch.RewardOf(road, 12, true).Gold != 1250) Fail("잘 맞는 원소 +25%(올림)");
            if (GoDispatch.RewardOf(Site("shipyard"), 4, false).Ore != 2 || GoDispatch.RewardOf(Site("quarry"), 8, false).Ore != 2 || GoDispatch.RewardOf(Site("forest_edge"), 20, false).Items[0].n != 8) Fail("반올림 셈");
            if (GoDispatch.RewardOf(road, 5, false).Gold != 0) Fail("없는 시간이 보상을 줌");
            if (GoDispatch.RewardText(GoDispatch.RewardOf(Site("observatory"), 8, false)).Length == 0) Fail("보상 글");
            if (GoDispatch.SlotsFor(0) != 2 || GoDispatch.SlotsFor(1) != 2 || GoDispatch.SlotsFor(4) != 2 || GoDispatch.SlotsFor(5) != 3 || GoDispatch.SlotsFor(10) != 4 || GoDispatch.SlotsFor(15) != 5 || GoDispatch.SlotsFor(99) != 5) Fail("자리 수(여정 등급 1·1·5·10·15)");
            // 잘 맞는 원소 — 그 원소인 인물이 있어야 함
            var hero = GoHeroes.All.FirstOrDefault(h => GoElements.ForMember(h.Id) == road.El);
            if (hero.Id != null && !GoDispatch.Fits(road, hero.Id)) Fail("원소가 같은데 안 맞는다고 나옴");
            var other = GoHeroes.All.FirstOrDefault(h => GoElements.ForMember(h.Id) != road.El);
            if (other.Id != null && GoDispatch.Fits(road, other.Id)) Fail("원소가 다른데 맞는다고 나옴");
            if (field.Boards.Count != GoWorldMap.Waypoints.Length) Fail($"게시판 {field.Boards.Count} ≠ 역참 {GoWorldMap.Waypoints.Length}");
            foreach (var w in GoWorldMap.Waypoints)
            {
                Vector3 b = GoDispatch.BoardPos(w);
                if (GoDispatch.BoardNear(b) != w.Id) Fail($"{w.Id} 게시판 자리에서 곁 판정이 안 됨");
                if (GoDispatch.BoardNear(b + new Vector3(0f, 0f, 20f)) == w.Id) Fail($"{w.Id} 게시판에서 20m 떨어졌는데 곁");
                if (Vector3.Distance(b, CookField.Instance != null && CookField.Instance.Pots.Count > 0 ? GoCooking.PotPos(w) : b + Vector3.right * 13f) < 12f) Fail($"{w.Id} 게시판이 솥과 너무 가까움");
                if (!field.Boards.TryGetValue(w.Id, out var p) || Mathf.Abs(p.y - GoWorldMap.WaypointPos(w).y) > 6f) Fail($"{w.Id} 게시판 높이");
            }
            parts.Add("표(탐사지 여덟·글·지역·고원 둘 눈꽃·경계비 열림·보상 셈·+25%·자리 2~5·게시판 다섯 곁 판정)");
        }

        // ---- 흐름 ----

        private static void CheckFlow(List<string> parts)
        {
            Setup(1);
            var cand = DispatchState.Candidates();
            if (cand.Count != 3) { Fail($"벤치 동료 {cand.Count} ≠ 3"); return; }
            string h0 = cand[0], h1 = cand[1];
            var field = PartyState.FieldIds();
            if (field.Contains(h0)) { Fail("벤치가 들판에 있음"); return; }
            if (DispatchState.Send("old_road", h0, 4, false) == null) Fail("게시판 밖에서 보내짐");
            if (DispatchState.Send("mudflat", h0, 4, true) == null) Fail("안 밟은 지역(너른 강)으로 보내짐");
            if (DispatchState.Send("old_road", field[0], 4, true) == null) Fail("들판 명단 동료가 보내짐");
            if (DispatchState.Send("old_road", h0, 7, true) == null) Fail("없는 시간으로 보내짐");
            if (DispatchState.Send("old_road", null, 4, true) == null || DispatchState.Send("old_road", "nobody", 4, true) == null) Fail("동료 없이·없는 동료가 보내짐");
            if (DispatchState.Send("old_road", h0, 4, true) != null || !DispatchState.IsOut("old_road") || DispatchState.Used != 1) Fail("첫 탐사 보내기");
            if (DispatchState.Away(h0) != "old_road" || DispatchState.Candidates().Contains(h0)) Fail("나간 동료가 아직 후보에 있음");
            if (DispatchState.Send("old_road", h1, 4, true) == null) Fail("이미 누가 간 곳으로 보내짐");
            if (DispatchState.Send("forest_edge", h0, 4, true) == null) Fail("이미 탐사 중인 동료가 또 보내짐");
            if (DispatchState.Send("forest_edge", h1, 8, true) != null || DispatchState.Used != 2) Fail("둘째 탐사 보내기");
            var third = DispatchState.Candidates().FirstOrDefault();
            WorldMapState.Restore(new List<string>(), new List<string> { "south_glade" }, false); // 남쪽 공터를 밟아 채석장을 열어 두고
            if (third == null || DispatchState.Send("quarry", third, 4, true) == null) Fail("자리(2)가 꽉 찼는데 보내짐");
            // 나간 동료는 편성에 못 넣는다
            if (PartyState.ToField(h0) || PartyState.FieldSlotOf(h0) >= 0) Fail("탐사 중인 동료가 들판에 들어감");
            if (PartyState.Pick(new[] { h0, h1 }).Count != 0) Fail("편성 고르기가 탐사 중 동료를 뺀다");
            // 시간이 흘러야 받는다
            if (DispatchState.Left("old_road") != 4 * 3600) Fail($"남은 시간 {DispatchState.Left("old_road")}");
            CookState.NowForTest = T0 + 4 * 3600 - 1;
            if (DispatchState.Left("old_road") != 1 || DispatchState.DoneList().Count != 0 || DispatchState.Claim("old_road", true, out _) != null) Fail("끝나기 전에 받아짐");
            CookState.NowForTest = T0 + 4 * 3600;
            if (DispatchState.DoneList().Count != 1 || DispatchState.Claim("old_road", false, out string why0) != null || why0 == null) Fail("게시판 밖에서 받아짐");
            int gold = GoldState.Gold;
            GoDispatch.TrySite("old_road", out var road);
            var want = GoDispatch.RewardOf(road, 4, GoDispatch.Fits(road, h0));
            string got = DispatchState.Claim("old_road", true, out _);
            if (got == null || GoldState.Gold != gold + want.Gold || DispatchState.Done != 1 || DispatchState.IsOut("old_road") || !DispatchState.Candidates().Contains(h0)) Fail($"받기 금 {GoldState.Gold - gold}(기대 {want.Gold})·복귀");
            if (DispatchState.Claim("old_road", true, out _) != null) Fail("받은 걸 또 받음");
            // 둘째는 8시간 — 아직
            if (DispatchState.Left("forest_edge") <= 0 || DispatchState.ClaimAll(true) != 0) Fail("8시간짜리가 4시간에 받아짐");
            CookState.NowForTest = T0 + 8 * 3600;
            int mint = CookState.Count("mint");
            if (DispatchState.ClaimAll(true) != 1 || CookState.Count("mint") <= mint || DispatchState.Done != 2) Fail("모두 받기·재료");
            // 부르기 — 보상 없이
            gold = GoldState.Gold;
            if (DispatchState.Send("old_road", h0, 4, true) != null) Fail("다시 보내기");
            if (DispatchState.Recall("old_road", false) == null) Fail("게시판 밖에서 불러짐");
            if (DispatchState.Recall("old_road", true) != null || DispatchState.IsOut("old_road") || GoldState.Gold != gold || DispatchState.Done != 2) Fail("부르기(보상 없이 돌아옴)");
            if (DispatchState.Recall("old_road", true) == null) Fail("나간 이 없는데 불러짐");
            // 자리 수는 여정 등급
            PlayerStats.Restore(5, 0);
            WorldMapState.Restore(null, null, true);
            DispatchState.ResetForTest();
            int sent = 0;
            foreach (var s in GoDispatch.Sites)
            {
                var c = DispatchState.Candidates().FirstOrDefault();
                if (c != null && DispatchState.Send(s.Id, c, 4, true) == null) sent++;
            }
            if (sent != 3 || DispatchState.Slots != 3) Fail($"여정 등급 5 자리 {sent}/{DispatchState.Slots}(3 기대 — 벤치 셋이라 셋)");
            parts.Add("흐름(못 보냄 여덟 까닭 · 편성 못 넣음 · 시간 · 받기·복귀 · 모두 받기 · 부르기 · 자리 = 등급)");
        }

        // ---- 알림 ----

        private static void CheckNotice(List<string> parts)
        {
            Setup(1);
            var cand = DispatchState.Candidates();
            var entries = new List<DispatchState.Entry>
            {
                new DispatchState.Entry { site = "old_road", hero = cand[0], hours = 4, start = T0 - 5 * 3600 },
                new DispatchState.Entry { site = "forest_edge", hero = cand[1], hours = 4, start = T0 - 6 * 3600 },
                new DispatchState.Entry { site = "bogus", hero = cand[2], hours = 4, start = T0 },
            };
            DispatchState.Restore(entries, 0);
            if (DispatchState.Used != 2) Fail("없는 탐사지가 복원됨");
            var first = DispatchState.Check();
            if (first.Count != 1 || !first[0].Contains("2")) Fail($"불러온 직후는 모아 한 줄이어야 함({first.Count})");
            if (DispatchState.Check().Count != 0) Fail("같은 알림이 또 옴");
            DispatchState.Claim("old_road", true, out _);
            DispatchState.Claim("forest_edge", true, out _);
            var c2 = DispatchState.Candidates();
            DispatchState.Send("old_road", c2[0], 4, true);
            DispatchState.Send("forest_edge", c2[1], 4, true);
            CookState.NowForTest = T0 + 4 * 3600 + 5;
            var next = DispatchState.Check();
            if (next.Count != 2 || DispatchState.Check().Count != 0) Fail($"그 뒤는 하나씩 한 번({next.Count})");
            parts.Add("알림(불러온 직후 모아 한 줄·그 뒤 하나씩 한 번·없는 탐사지 뺌)");
        }

        // ---- 세이브 ----

        private static void CheckSave(string savePath, List<string> parts)
        {
            Setup(1);
            var cand = DispatchState.Candidates();
            DispatchState.Send("old_road", cand[0], 12, true);
            DispatchState.Send("forest_edge", cand[1], 4, true);
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"dispOut\":[") || !json.Contains("old_road") || !json.Contains("\"version\":28")) Fail("세이브에 탐사가 없다(버전은 28 그대로)");
            DispatchState.ResetForTest();
            if (!SaveState.TryLoad() || DispatchState.Used != 2 || DispatchState.Away(cand[0]) != "old_road" || DispatchState.Left("old_road") != 12 * 3600) Fail("왕복 뒤 탐사가 달라짐");
            string old = Regex.Replace(json, ",\"dispOut\":\\[[^\\]]*\\],\"dispDone\":\\d+", "");
            if (old.Contains("dispOut")) { Fail("옛 세이브 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, old);
            if (!SaveState.TryLoad()) { Fail("탐사 없는 옛 파일 TryLoad 실패"); return; }
            if (DispatchState.Used != 0 || DispatchState.Done != 0) Fail("탐사 없는 옛 세이브를 읽었는데 비어 있지 않음");
            parts.Add("세이브(나간 이·시간 왕복 · 옛 세이브는 빈 채 · 버전 그대로)");
        }

        // ---- 화면 ----

        private static void CheckUi(DispatchUi ui, List<string> parts)
        {
            Setup(1);
            GoldState.Restore(0);
            DispatchUi.AtBoardForTest = 0;
            ui.UpdateShown();
            if (ui.OpenButton.gameObject.activeSelf) Fail("게시판 밖인데 탐사 단추가 보임");
            DispatchUi.AtBoardForTest = 1;
            ui.UpdateShown();
            if (!ui.OpenButton.gameObject.activeSelf) Fail("게시판 곁인데 탐사 단추가 없음");
            ui.Open();
            ui.UpdateShown();
            if (!ui.IsOpen || ui.OpenButton.gameObject.activeSelf) Fail("창이 열린 동안엔 단추가 숨어야 함");
            if (!ui.TitleText.Contains("0/2") || ui.HeroLabel.Length == 0 || !ui.HoursLabel.Contains("8")) Fail($"창 제목·고르기 '{ui.TitleText}' '{ui.HeroLabel}' '{ui.HoursLabel}'");
            for (int i = 0; i < 8; i++) if (!ui.RowText(i).Contains(GoDispatch.Sites[i].Name)) Fail($"줄 {i} 이름");
            if (!ui.RowText(2).Contains(GoLocalization.T("dispatch.row_locked", "잠김 — {0} 을(를) 밟으면 열린다").Split('{')[0]) || ui.ActButton(2).interactable) Fail("안 밟은 지역 줄은 잠기고 보내기가 닫혀야 함");
            if (!ui.ActButton(0).interactable || ui.ClaimButton(0).interactable) Fail("열린 빈 줄: 보내기만 열림");
            string hero0 = ui.HeroLabel;
            ui.PickHero(1);
            if (ui.HeroLabel == hero0) Fail("◀▶ 가 동료를 안 바꿈");
            ui.PickHero(-1);
            int h0 = ui.Hours;
            ui.PickHours(1);
            if (ui.Hours == h0 || !ui.HoursLabel.Contains(ui.Hours.ToString())) Fail("시간 ◀▶");
            ui.PickHours(-1);
            ui.PickHours(-1); // 4시간
            if (ui.Hours != 4) Fail($"시간 4 로 돌리기 {ui.Hours}");
            ui.ActButton(0).onClick.Invoke();
            if (!DispatchState.IsOut("old_road") || ui.ActLabel(0) != GoLocalization.T("dispatch.recall", "부르기")) Fail("보내기 단추");
            if (ui.ClaimButton(0).interactable) Fail("끝나기 전에 받기가 열림");
            CookState.NowForTest = T0 + 4 * 3600;
            ui.Refresh();
            if (!ui.ClaimButton(0).interactable || !ui.OpenLabel.Contains("●1")) Fail($"다 된 줄의 받기 단추·●1 '{ui.OpenLabel}'");
            if (!ui.AllButton.interactable) Fail("모두 받기가 닫힘");
            int g0 = GoldState.Gold;
            ui.ClaimButton(0).onClick.Invoke();
            if (GoldState.Gold <= g0 || DispatchState.IsOut("old_road") || ui.ClaimButton(0).interactable) Fail("받기 단추");
            ui.ActButton(0).onClick.Invoke(); // 다시 보냄
            DispatchUi.AtBoardForTest = 0;
            ui.Refresh();
            if (ui.ActButton(0).interactable || ui.ActButton(1).interactable || ui.AllButton.interactable) Fail("게시판을 벗어났는데 단추가 열려 있음");
            DispatchUi.AtBoardForTest = 1;
            ui.CheckNow();
            ui.Close();
            parts.Add("화면(곁에서만 단추·창 제목·줄·잠김·◀▶ 동료·시간·보내기→부르기·받기·모두 받기·게시판 밖은 닫힘)");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] dispatch FAIL - {msg}");
        }
    }
}
