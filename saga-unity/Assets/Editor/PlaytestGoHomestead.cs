using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0032 쉼터 마당 진단. 두 길 —
    /// ① <see cref="RunBatch"/>(`-executeMethod …PlaytestGoHomestead.RunBatch`, 장면 없이): 표(소품 12·등급 5) · 놓기 거절 다섯과 성공 · 등급 경계 · 시간(1시간당 금·12시간 상한) ·
    ///    등급이 바뀌는 놓기·치우기 직전 은행(소급 안 바뀜) · 수확 · 치우기 환불 · 세이브 왕복(모르는 소품 버림·40개 자름·옛 세이브 = 빈 마당).
    /// ② <see cref="Run"/>(`PlaytestHeadless` 가 사냥 기록 진단 뒤에 부른다, 장면 안): 마당 반지름 안 충돌체 0 · 표지 · 둘레에서 단추가 뜸 · 창으로 놓기·돌리기·치우기·수확 ·
    ///    금 모자라면 거절 · 세이브 파일에 필드가 들어가고(버전 그대로) 불러오면 소품이 다시 서고 옛 세이브(필드 없음)는 빈 마당.
    ///    끝나면 마당·금·시각·세이브 파일·플레이어 자리를 되돌린다.
    /// </summary>
    public static class PlaytestGoHomestead
    {
        private static string _tag;
        private static bool _ok;
        private const long T0 = 1_700_000_000;

        [MenuItem("Saga/Playtest Go Homestead")]
        public static void RunBatch()
        {
            PlaytestKit.Begin("[PlaytestGoHomestead]");
            int gold0 = GoldState.Gold;
            using (PlaytestKit.ErrorCounter())
            {
                try
                {
                    CheckTables();
                    CheckPlace();
                    CheckTiers();
                    CheckTime();
                    CheckBank();
                    CheckRemoveHarvest();
                    CheckSnapshot();
                }
                finally { HomeState.NowForTest = -1; HomeState.ResetForTest(); GoldState.Restore(gold0); }
            }
            PlaytestKit.Summary("PlaytestGoHomestead");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static HomePlaced P(string id, float x, float z) => new HomePlaced { id = id, x = x, z = z, r = 0 };

        /// <summary>fence 를 n 개 서로 1.5m 떨어뜨려 마당 안에 깐 목록(안락도 n).</summary>
        private static List<HomePlaced> Fences(int n)
        {
            var c = GoHomestead.Center; var l = new List<HomePlaced>();
            for (int i = 0; i < n; i++) l.Add(P("fence", c.x - 6f + (i % 8) * 1.5f, c.z - 6f + (i / 8) * 1.5f));
            return l;
        }

        private static void CheckTables()
        {
            var it = GoHomestead.Items;
            PlaytestKit.Check(it.Length == 12 && it.Select(x => x.Id).Distinct().Count() == 12, "소품 12 · id 서로 다름");
            PlaytestKit.Check(GoHomestead.Find("fence").Cost == 100 && GoHomestead.Find("fence").Comfort == 1 && GoHomestead.Find("shed").Cost == 2500 && GoHomestead.Find("shed").Comfort == 15
                && GoHomestead.Find("tree").Cost == 800 && GoHomestead.Find("tree").Comfort == 6 && GoHomestead.Find("stall").Cost == 1200 && GoHomestead.Find("stall").Comfort == 8, "소품 수치가 고돗과 다름");
            PlaytestKit.Check(it.All(x => x.Name.Length > 0 && !x.Name.StartsWith("home.item.")), "소품 이름 글");
            var t = GoHomestead.Tiers;
            PlaytestKit.Check(t.Length == 5 && t.Select(x => x.Min).SequenceEqual(new[] { 0, 10, 30, 60, 100 }) && t.Select(x => x.Income).SequenceEqual(new[] { 0, 60, 150, 300, 500 }), "등급 표가 고돗과 다름");
            PlaytestKit.Check(t.All(x => x.Name.Length > 0 && !x.Name.StartsWith("home.tier.")), "등급 이름 글");
            PlaytestKit.Check(GoHomestead.Radius == 9f && GoHomestead.MaxItems == 40 && GoHomestead.Spacing == 0.9f && GoHomestead.Refund == 0.5f && GoHomestead.CapHours == 12f, "상수가 고돗과 다름");
        }

        private static void CheckPlace()
        {
            var c = GoHomestead.Center;
            HomeState.NowForTest = T0; HomeState.ResetForTest();
            GoldState.Restore(10000);
            int g = GoldState.Gold;
            PlaytestKit.Check(HomeState.Place("nope", c.x, c.z, 0, c).Length > 0 && HomeState.Count == 0 && GoldState.Gold == g, "모르는 소품 거절");
            PlaytestKit.Check(HomeState.Place("fence", c.x + 20f, c.z, 0, c).Length > 0 && HomeState.Count == 0 && GoldState.Gold == g, "마당 밖(20m) 거절");
            PlaytestKit.Check(HomeState.Place("fence", c.x + 9.5f, c.z, 0, c).Length > 0, "9.5m 도 거절(반지름 9m)");
            PlaytestKit.Check(HomeState.Place("fence", c.x + 1f, c.z, 0, c) == "" && HomeState.Count == 1 && GoldState.Gold == g - 100 && HomeState.Comfort() == 1 && HomeState.Spent == 100, "놓기 성공: 금 −100·안락도 +1");
            PlaytestKit.Check(HomeState.Place("reed", c.x + 1.4f, c.z, 0, c).Length > 0 && HomeState.Count == 1 && GoldState.Gold == g - 100, "너무 가까움(0.4m < 0.9m) 거절");
            PlaytestKit.Check(HomeState.Place("reed", c.x + 2.0f, c.z, 0, c) == "" && HomeState.Count == 2, "1m 떨어지면 놓음(경계 0.9m)");
            GoldState.Restore(50);
            string e = HomeState.Place("shed", c.x - 5f, c.z, 0, c);
            PlaytestKit.Check(e.Length > 0 && e.Contains("2500") && HomeState.Count == 2 && GoldState.Gold == 50, $"금 모자람 거절(글에 2500): {e}");
            // 가득 참 — fence 를 마흔 채운 뒤 하나 더
            HomeState.Restore(Fences(40), T0, 0, 0);
            GoldState.Restore(10000);
            string full = HomeState.Place("fence", c.x, c.z + 8.9f, 0, c);
            PlaytestKit.Check(HomeState.Count == 40 && full.Length > 0 && full.Contains("40") && GoldState.Gold == 10000, $"가득 참(40) 거절: {full}");
            // 돌림은 0~3 안으로
            HomeState.ResetForTest();
            HomeState.Place("rock", c.x, c.z, 7, c);
            PlaytestKit.Check(HomeState.Items[0].r == 3, $"돌림 7 → 3 이어야 함: {HomeState.Items[0].r}");
        }

        private static void CheckTiers()
        {
            foreach (var (c, tier) in new[] { (0, 0), (9, 0), (10, 1), (29, 1), (30, 2), (59, 2), (60, 3), (99, 3), (100, 4), (500, 4) })
                PlaytestKit.Check(GoHomestead.TierOf(c) == tier, $"안락도 {c} → 등급 {GoHomestead.TierOf(c)}({tier} 이어야 함)");
            HomeState.NowForTest = T0;
            HomeState.Restore(Fences(9), T0, 0, 0); PlaytestKit.Check(HomeState.Tier() == 0 && HomeState.IncomePerHour() == 0, "울타리 9 = 빈 마당");
            HomeState.Restore(Fences(10), T0, 0, 0); PlaytestKit.Check(HomeState.Tier() == 1 && HomeState.IncomePerHour() == 60, "울타리 10 = 아담한(60)");
            HomeState.Restore(Fences(30), T0, 0, 0); PlaytestKit.Check(HomeState.Tier() == 2 && HomeState.IncomePerHour() == 150, "울타리 30 = 정갈한(150)");
        }

        private static void CheckTime()
        {
            HomeState.Restore(Fences(10), T0, 0, 0);   // 시간당 60
            HomeState.NowForTest = T0; PlaytestKit.Check(HomeState.Pending() == 0, "정산 직후 0");
            HomeState.NowForTest = T0 + 3600; PlaytestKit.Check(HomeState.Pending() == 60, $"1시간 = 60: {HomeState.Pending()}");
            HomeState.NowForTest = T0 + 7200; PlaytestKit.Check(HomeState.Pending() == 120, "2시간 = 120");
            HomeState.NowForTest = T0 + 12 * 3600; PlaytestKit.Check(HomeState.Pending() == 720, "12시간 = 720(상한)");
            HomeState.NowForTest = T0 + 40 * 3600; PlaytestKit.Check(HomeState.Pending() == 720, "40시간도 720(상한)");
            HomeState.NowForTest = T0 - 500; PlaytestKit.Check(HomeState.Pending() == 0, "시각이 거꾸로 가도 음수 아님");
            // 수확
            HomeState.Restore(Fences(10), T0, 0, 0); GoldState.Restore(0);
            HomeState.NowForTest = T0 + 3600;
            PlaytestKit.Check(HomeState.Harvest() == 60 && GoldState.Gold == 60 && HomeState.Pending() == 0, "수확: 금 +60·쌓인 금 0");
            PlaytestKit.Check(HomeState.Harvest() == 0 && GoldState.Gold == 60, "쌓인 게 없으면 수확 0");
            HomeState.NowForTest = T0 + 7200; PlaytestKit.Check(HomeState.Pending() == 60, "수확 뒤 다시 1시간 = 60");
        }

        private static void CheckBank()
        {
            var c = GoHomestead.Center;
            // 아홉 개(수입 0) 에서 5시간 뒤 열 번째를 놓아 등급이 오르면, 지난 5시간은 소급되지 않는다
            HomeState.Restore(Fences(9), T0, 0, 0); GoldState.Restore(5000);
            HomeState.NowForTest = T0 + 5 * 3600;
            PlaytestKit.Check(HomeState.Place("fence", c.x + 8f, c.z, 0, c) == "" && HomeState.Tier() == 1, "열 번째 울타리로 등급이 오름");
            PlaytestKit.Check(HomeState.Pending() == 0, $"올라간 등급이 지난 5시간에 소급됨: {HomeState.Pending()}");
            HomeState.NowForTest = T0 + 6 * 3600; PlaytestKit.Check(HomeState.Pending() == 60, "올린 뒤 1시간 = 60");
            // 열 개(60/h)에서 2시간 쌓인 뒤 하나 치워 등급이 내려가도 쌓인 120 은 남는다
            HomeState.Restore(Fences(10), T0, 0, 0); GoldState.Restore(0);
            HomeState.NowForTest = T0 + 2 * 3600;
            var f = HomeState.Items[0];
            HomeState.RemoveNear(f.x, f.z, 0.5f);
            PlaytestKit.Check(HomeState.Tier() == 0 && HomeState.Pending() == 120, $"내려간 등급이 쌓인 금을 지움: {HomeState.Pending()}");
            HomeState.NowForTest = T0 + 12 * 3600; PlaytestKit.Check(HomeState.Pending() == 120, "수입 0 이 되어 더 안 쌓임");
        }

        private static void CheckRemoveHarvest()
        {
            var c = GoHomestead.Center;
            HomeState.NowForTest = T0; HomeState.ResetForTest(); GoldState.Restore(5000);
            HomeState.Place("tree", c.x + 2f, c.z + 2f, 0, c);
            int g = GoldState.Gold;
            PlaytestKit.Check(HomeState.RemoveNear(c.x - 5f, c.z - 5f, 3f) == "" && HomeState.Count == 1 && GoldState.Gold == g, "reach 밖은 안 치움");
            PlaytestKit.Check(HomeState.RemoveNear(c.x + 2.5f, c.z + 2f, 3f) == "tree" && HomeState.Count == 0 && GoldState.Gold == g + 400, "치우기: 절반(400) 환불");
            // 가장 가까운 것을 치운다
            HomeState.Place("rock", c.x + 3f, c.z, 0, c); HomeState.Place("lamp", c.x + 5f, c.z, 0, c);
            PlaytestKit.Check(HomeState.RemoveNear(c.x + 4.4f, c.z, 3f) == "lamp", "가장 가까운 소품을 치움");
        }

        private static void CheckSnapshot()
        {
            var c = GoHomestead.Center;
            HomeState.NowForTest = T0; HomeState.ResetForTest(); GoldState.Restore(5000);
            HomeState.Place("well", c.x + 3f, c.z + 1f, 2, c); HomeState.Place("flowers", c.x - 2f, c.z, 1, c);
            HomeState.NowForTest = T0 + 3600;
            var items = HomeState.Snapshot(); long t = HomeState.SnapshotT(); int acc = HomeState.SnapshotAcc(), spent = HomeState.Spent;
            HomeState.ResetForTest();
            PlaytestKit.Check(HomeState.Count == 0 && HomeState.Spent == 0, "진단 준비: 초기화");
            HomeState.Restore(items, t, acc, spent);
            PlaytestKit.Check(HomeState.Count == 2 && HomeState.Items[0].id == "well" && HomeState.Items[0].r == 2 && HomeState.Spent == 1050 && HomeState.Comfort() == 8, "왕복(소품·돌림·쓴 금)");
            HomeState.Restore(new List<HomePlaced> { P("well", 0, 0), P("ghost", 1, 1), null, P("fence", 2, 2) }, T0, 99, 5);
            PlaytestKit.Check(HomeState.Count == 2 && HomeState.Comfort() == 7, "모르는 소품·null 을 버림");
            HomeState.Restore(Fences(60), T0, 0, 0);
            PlaytestKit.Check(HomeState.Count == 40, $"40개를 넘으면 자름: {HomeState.Count}");
            HomeState.Restore(null, 0, 0, 0);
            PlaytestKit.Check(HomeState.Count == 0 && HomeState.Pending() == 0 && HomeState.Tier() == 0, "옛 세이브(null·0)는 빈 마당");
        }

        // ---- 장면 층(PlaytestHeadless 안) ----

        public static bool Run(string tag)
        {
            _tag = tag; _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var field = HomesteadField.Instance;
            var ui = HomesteadUi.Instance;
            if (fc == null || pc == null || field == null || ui == null) { Fail("FieldCombat/PlayerController/HomesteadField/HomesteadUi 없음"); return false; }

            var items = HomeState.Snapshot(); long t = HomeState.SnapshotT(); int acc = HomeState.SnapshotAcc(), spent = HomeState.Spent;
            int gold = GoldState.Gold;
            Vector3 pos0 = pc.transform.position;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            var parts = new List<string>();
            try
            {
                HomeState.NowForTest = T0; HomeState.ResetForTest();
                CheckYard(parts);
                pc.Teleport(GoHomestead.Center + Vector3.up * 0.3f); pc.Step(0.02f); pc.Step(0.02f);
                CheckUi(ui, field, parts);
                CheckFile(savePath, field, parts);
            }
            finally
            {
                ui.Close();
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                HomeState.NowForTest = -1;
                HomeState.Restore(items, t, acc, spent);
                GoldState.Restore(gold);
                fc.ResetForTest();
                pc.Teleport(pos0);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] homestead OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static void CheckYard(List<string> parts)
        {
            var c = GoHomestead.Center;
            // 반지름 안(땅 위 1~9m 높이 상자)에 충돌체가 없어야 한다 — 표지(마당 자신)는 빼고
            var hits = Physics.OverlapBox(c + Vector3.up * 5f, new Vector3(GoHomestead.Radius, 4f, GoHomestead.Radius), Quaternion.identity, ~0, QueryTriggerInteraction.Ignore);
            var field = HomesteadField.Instance;
            var bad = hits.Where(h => h != null && !h.transform.IsChildOf(field.transform)).Select(h => h.name).Distinct().Take(6).ToList();
            if (bad.Count > 0) Fail($"마당 반지름 {GoHomestead.Radius}m 안에 충돌체: {string.Join(", ", bad)} — 마당 자리(GoHomestead.Center)를 옮길 것");
            if (field.MarkerObjects < 8) Fail($"마당 표지가 {field.MarkerObjects}개(8 이상)");
            parts.Add($"마당 자리(반지름 안 충돌체 0)·표지 {field.MarkerObjects}");
        }

        private static void CheckUi(HomesteadUi ui, HomesteadField field, List<string> parts)
        {
            ui.Refresh();
            if (!field.Near || !field.Inside) Fail("마당 한가운데에 서도 near/inside 가 아님");
            if (!ui.PromptShown) Fail("마당 둘레인데 쉼터 단추가 안 뜸");
            GoldState.Restore(5000);
            ui.Open();
            if (!ui.IsOpen) { Fail("Open 이 안 열림"); return; }
            for (int i = 0; i < GoHomestead.Items.Length; i++) if (ui.ItemButton(i) == null) Fail($"소품 단추 {i} 없음");
            ui.Pick("flowers");
            int g0 = GoldState.Gold;
            ui.PlaceButton.onClick.Invoke();
            if (HomeState.Count != 1 || GoldState.Gold != g0 - 150) Fail($"창으로 놓기: 소품 {HomeState.Count}(1)·금 {GoldState.Gold - g0}(-150)");
            if (field.PlacedObjects != 1) Fail($"놓은 소품이 마당에 안 섬: {field.PlacedObjects}");
            if (!ui.InfoText.Contains("안락도 2")) Fail($"창에 안락도가 없음: {ui.InfoText}");
            ui.RotateButton.onClick.Invoke();
            if (ui.Rot != 1) Fail("돌리기");
            // 같은 자리에 또 놓으면 거절(너무 가까움)
            ui.PlaceButton.onClick.Invoke();
            if (HomeState.Count != 1) Fail($"같은 자리에 또 놓임: {HomeState.Count}");
            // 금 모자라면 거절
            GoldState.Restore(10);
            ui.Pick("shed"); string err = field.PlaceHere("shed", 0);
            if (err.Length == 0 || HomeState.Count != 1) Fail("금이 모자란데 놓임");
            // 치우기 — 서 있는 자리(소품과 같은 자리)라 3m 안
            GoldState.Restore(0);
            ui.RemoveButton.onClick.Invoke();
            if (HomeState.Count != 0 || GoldState.Gold != 75 || field.PlacedObjects != 0) Fail($"창으로 치우기: 소품 {HomeState.Count}(0)·금 {GoldState.Gold}(75)·서 있는 것 {field.PlacedObjects}(0)");
            // 수확
            HomeState.Restore(Fences(10), T0, 0, 0); HomeState.NowForTest = T0 + 3600; GoldState.Restore(0);
            ui.Refresh();
            if (!ui.HarvestButton.interactable) Fail("쌓인 금이 있는데 수확 단추가 꺼짐");
            ui.HarvestButton.onClick.Invoke();
            if (GoldState.Gold != 60) Fail($"창으로 수확: 금 {GoldState.Gold}(60)");
            ui.Close();
            HomeState.Restore(null, 0, 0, 0); HomeState.NowForTest = T0;
            parts.Add("창(단추·놓기·돌리기·거절·치우기·수확)");
        }

        private static void CheckFile(string savePath, HomesteadField field, List<string> parts)
        {
            var c = GoHomestead.Center;
            HomeState.NowForTest = T0; HomeState.ResetForTest(); GoldState.Restore(5000);
            HomeState.Place("well", c.x + 3f, c.z + 1f, 2, c); HomeState.Place("lamp", c.x - 2f, c.z, 0, c);
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"homeItems\":[") || !json.Contains("\"homeT\":") || !json.Contains("\"homeSpent\":1250") || !json.Contains("\"version\":29")) Fail("세이브에 쉼터 마당이 없다(버전은 그대로여야 함)");
            HomeState.ResetForTest();
            if (!SaveState.TryLoad() || HomeState.Count != 2 || HomeState.Spent != 1250) Fail($"세이브 왕복: 소품 {HomeState.Count}(2)·쓴 금 {HomeState.Spent}(1250)");
            if (field.PlacedObjects != 2) Fail($"불러온 뒤 소품이 다시 안 섬: {field.PlacedObjects}(2)");
            string old = Regex.Replace(json, ",\"homeItems\":\\[[^\\]]*\\],\"homeT\":-?\\d+,\"homeAcc\":-?\\d+,\"homeSpent\":-?\\d+", "");
            if (old.Contains("homeItems")) { Fail("옛 세이브 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, old);
            if (!SaveState.TryLoad()) { Fail("쉼터 없는 옛 파일 TryLoad 실패"); return; }
            if (HomeState.Count != 0 || field.PlacedObjects != 0) Fail($"쉼터 없는 옛 세이브인데 소품이 남음: {HomeState.Count}·{field.PlacedObjects}");
            parts.Add("세이브(소품·쓴 금 왕복·불러온 뒤 다시 섬 · 옛 세이브는 빈 마당 · 버전 그대로)");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] homestead FAIL - {msg}");
        }
    }
}
