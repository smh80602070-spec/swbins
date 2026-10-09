using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0046 신수 알·동행 진단. 두 길 —
    /// ① <see cref="RunBatch"/>(`-executeMethod …PlaytestGoEggs.RunBatch`, 장면 없이): 표(신수 11·알 3종·풀이 신수 안·칸 수) · 굴림(같은 곳·열쇠 같은 결과·확률 1·0·분포) ·
    ///    주머니 가득 · 부화기 넣기/되돌리기 거절 · 걸음→부화(안 가진 신수 우선·겹치면 금·경험치) · 동행(안 만난 신수 거절·친밀·보너스 수치·400m 금) ·
    ///    경험치 보너스 곱 · 세이브 왕복(모르는 것 버림·주머니·칸 수 자름·옛 세이브는 빈 상태).
    /// ② <see cref="Run"/>(`PlaytestHeadless` 가 재출항 진단 뒤에 부른다, 장면 안): 창·단추·주머니 알을 단추로 넣기·실제 걸음(`EggWalker.Feed`)으로 부화·순간이동은 안 셈 ·
    ///    세이브 파일에 필드가 들어가고(버전 그대로) 옛 세이브는 빈 상태. 끝나면 금·경험치·알 상태·세이브를 되돌린다.
    /// </summary>
    public static class PlaytestGoEggs
    {
        private static string _tag;
        private static bool _ok;

        private sealed class Saved
        {
            public int Gold, Lv, Hatched; public long Exp;
            public float Walk, BuddyM;
            public string Buddy;
            public List<string> Bag, Owned;
            public List<EggIncSave> Inc;
            public List<CookState.Entry> Friend;
        }

        private static Saved Save() => new Saved
        {
            Gold = GoldState.Gold, Lv = PlayerStats.Level, Exp = PlayerStats.Exp, Hatched = EggState.Hatched, Walk = EggState.WalkTotal, BuddyM = EggState.SnapshotBuddyM(), Buddy = EggState.Buddy,
            Bag = EggState.SnapshotBag(), Owned = EggState.SnapshotOwned(), Inc = EggState.SnapshotInc(), Friend = EggState.SnapshotFriend(),
        };

        private static void Load(Saved s)
        {
            GoldState.Restore(s.Gold);
            PlayerStats.Restore(s.Lv, s.Exp);
            EggState.Restore(s.Bag, s.Inc, s.Hatched, s.Walk, s.Buddy, s.BuddyM, s.Friend, s.Owned);
        }

        [MenuItem("Saga/Playtest Go Eggs")]
        public static void RunBatch()
        {
            PlaytestKit.Begin("[PlaytestGoEggs]");
            var saved = Save();
            using (PlaytestKit.ErrorCounter())
            {
                EggState.ResetForTest();
                try
                {
                    CheckTables();
                    CheckRoll();
                    CheckBagAndIncubator();
                    CheckHatch();
                    CheckBuddy();
                    CheckExpBonus();
                    CheckSnapshot();
                }
                finally { Load(saved); }
            }
            PlaytestKit.Summary("PlaytestGoEggs");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        // ---- 규칙 층 ----

        private static readonly string[] PetIds = { "pt_samjogo", "pt_haetae", "pt_cheongryong", "pt_baekho", "pt_jujak", "pt_hyeonmu", "pt_gumiho", "pt_dokkaebi", "pt_bulgasari", "pt_jeoktoma", "pt_jeolyeong" };

        private static void CheckTables()
        {
            PlaytestKit.Check(GoEggs.Pets.Select(p => p.Id).SequenceEqual(PetIds), "신수 11 id 가 고돗과 다름");
            PlaytestKit.Check(GoEggs.Pets.All(p => p.Kind == "atk" || p.Kind == "exp" || p.Kind == "def"), "신수 갈래가 atk/exp/def 가 아님");
            PlaytestKit.Check(GoEggs.Tiers.Length == 3 && GoEggs.Tiers[0].Need == 300f && GoEggs.Tiers[1].Need == 800f && GoEggs.Tiers[2].Need == 1500f, "알 3종 거리가 다름");
            foreach (var t in GoEggs.Tiers) PlaytestKit.Check(t.Pool.Length > 0 && t.Pool.All(id => GoEggs.Find(id) != null), $"{t.Id} 풀에 모르는 신수");
            PlaytestKit.Check(GoEggs.SlotsForRank(1) == 1 && GoEggs.SlotsForRank(3) == 1 && GoEggs.SlotsForRank(4) == 2 && GoEggs.SlotsForRank(8) == 3 && GoEggs.SlotsForRank(99) == 3, "부화기 칸 수가 다름");
            PlaytestKit.Check(GoEggs.Sources.Values.All(rows => rows.All(r => GoEggs.TierOf(r.tier) != null && r.chance > 0f && r.chance <= 1f)), "알 나오는 곳에 모르는 알·확률");
            PlaytestKit.Check(GoEggs.BagMax == 9 && GoEggs.BuddyM == 400f && GoEggs.BuddyLevelM == 500f && GoEggs.BuddyGold == 800 && GoEggs.DupGold == 1500 && GoEggs.DupExp == 30, "수치가 고돗과 다름");
            PlaytestKit.Check(GoEggs.BodyName("pt_gumiho") == "pet_pt_gumiho", "몸 이름 규칙(K-0075)이 다름");
            // U-0068 — K-0075 몸 11 이 Resources/World 에 놓였고 열린다
            var noBody = GoEggs.Pets.Where(p => Saga.Core.WorldModels.Load(GoEggs.BodyName(p.Id)) == null).Select(p => p.Id).ToList();
            PlaytestKit.Check(noBody.Count == 0, $"동행 몸을 못 엶: {string.Join(",", noBody)}");
        }

        private static void CheckRoll()
        {
            PlaytestKit.Check(GoEggs.Roll("chest:luxurious", "k").Contains("e_mid"), "확률 1 인 굴림이 안 나옴");
            PlaytestKit.Check(GoEggs.Roll("commission", "x").SequenceEqual(new[] { "e_small" }), "일과는 늘 작은 알이어야 함");
            PlaytestKit.Check(GoEggs.Roll("nowhere", "x").Length == 0, "모르는 곳이 알을 줌");
            PlaytestKit.Check(GoEggs.Roll("chest:common", "abc").SequenceEqual(GoEggs.Roll("chest:common", "abc")), "같은 곳·열쇠 굴림이 흔들림");
            int n = 0; for (int i = 0; i < 2000; i++) if (GoEggs.Roll("chest:common", "c" + i).Length > 0) n++;
            PlaytestKit.Check(n > 2000 * 0.08 && n < 2000 * 0.16, $"평범한 상자 알 확률 {n / 2000f:0.000} ≠ 0.12 근처");
            int rare = 0; for (int i = 0; i < 2000; i++) if (GoEggs.Roll("chest:luxurious", "l" + i).Contains("e_rare")) rare++;
            PlaytestKit.Check(rare > 2000 * 0.22 && rare < 2000 * 0.38, $"호화 상자 빛나는 알 확률 {rare / 2000f:0.000} ≠ 0.3 근처");
        }

        private static void CheckBagAndIncubator()
        {
            EggState.ResetForTest(); PlayerStats.Restore(1, 0);
            for (int i = 0; i < GoEggs.BagMax; i++) PlaytestKit.Check(EggState.AddEgg("e_small"), "주머니에 안 들어감");
            PlaytestKit.Check(!EggState.AddEgg("e_small") && EggState.BagCount == 9, "주머니가 9 를 넘음");
            PlaytestKit.Check(EggState.Drop("commission", "full").Contains("놓쳤다") && EggState.BagCount == 9, "가득 찬 주머니의 알림·수");
            PlaytestKit.Check(!EggState.AddEgg("e_none"), "모르는 알이 들어감");
            PlaytestKit.Check(EggState.Start(-1).Length > 0 && EggState.Start(99).Length > 0, "없는 알을 부화기에 넣음");
            PlaytestKit.Check(EggState.Start(0) == "" && EggState.IncCount == 1 && EggState.BagCount == 8, "넣기 실패");
            PlaytestKit.Check(EggState.Start(0).Length > 0 && EggState.IncCount == 1, "레벨 1 은 칸이 하나인데 둘째가 들어감");
            PlayerStats.Restore(8, 0);
            PlaytestKit.Check(EggState.Start(0) == "" && EggState.Start(0) == "" && EggState.IncCount == 3 && EggState.Start(0).Length > 0, "레벨 8 은 칸이 셋이어야 함");
            PlaytestKit.Check(EggState.Stop(5).Length > 0, "없는 칸을 되돌림");
            PlaytestKit.Check(EggState.Stop(0) == "" && EggState.IncCount == 2 && EggState.BagCount == 7, "되돌리기 실패");
            EggState.ResetForTest();
            EggState.AddEgg("e_small"); PlayerStats.Restore(8, 0); EggState.Start(0);
            for (int i = 0; i < GoEggs.BagMax; i++) EggState.AddEgg("e_mid");
            PlaytestKit.Check(EggState.Stop(0).Length > 0 && EggState.IncCount == 1, "가득 찬 주머니로 되돌려짐");
        }

        private static void CheckHatch()
        {
            EggState.ResetForTest(); PlayerStats.Restore(30, 0);
            EggState.AddEgg("e_small"); EggState.Start(0);
            PlaytestKit.Check(EggState.Walk(0f).Count == 0 && EggState.Walk(-5f).Count == 0, "0·음수 걸음이 셈");
            PlaytestKit.Check(EggState.Walk(299f).Count == 0 && EggState.OwnedCount == 0, "299m 에 부화함");
            var r = EggState.Walk(1f);
            PlaytestKit.Check(r.Count == 1 && !r[0].Dup && GoEggs.TierOf("e_small").Value.Pool.Contains(r[0].Pet) && EggState.Owns(r[0].Pet) && EggState.Hatched == 1 && EggState.IncCount == 0, "300m 부화가 다름");
            // 안 가진 신수 우선 — 작은 알 풀 넷이 서로 다르게 나온다
            var seen = new HashSet<string> { r[0].Pet };
            for (int i = 0; i < 3; i++)
            {
                EggState.AddEgg("e_small"); EggState.Start(0);
                var h = EggState.Walk(300f);
                PlaytestKit.Check(h.Count == 1 && !h[0].Dup, "안 가진 신수가 남았는데 겹침");
                if (h.Count == 1) seen.Add(h[0].Pet);
            }
            PlaytestKit.Check(seen.Count == 4, $"작은 알 풀 넷이 다 안 나옴({seen.Count})");
            // 다 가진 뒤엔 겹침 — 금·경험치
            int gold = GoldState.Gold; long exp = PlayerStats.Exp;
            EggState.AddEgg("e_small"); EggState.Start(0);
            var d = EggState.Walk(300f);
            PlaytestKit.Check(d.Count == 1 && d[0].Dup, "다 가졌는데 새 신수로 나옴");
            PlaytestKit.Check(GoldState.Gold == gold + GoEggs.DupGold && PlayerStats.Exp == exp + GoEggs.DupExp, $"겹침 보상이 다름(금 {GoldState.Gold - gold} 경험 {PlayerStats.Exp - exp})");
            // 한꺼번에 둘 부화
            EggState.ResetForTest(); PlayerStats.Restore(8, 0);
            EggState.AddEgg("e_small"); EggState.AddEgg("e_small"); EggState.Start(0); EggState.Start(0);
            PlaytestKit.Check(EggState.Walk(300f).Count == 2, "한 번에 둘이 안 부화함");
            // 걸음이 알마다 따로 쌓이고 큰 알은 더 걸어야 한다
            EggState.ResetForTest(); PlayerStats.Restore(8, 0);
            EggState.AddEgg("e_mid"); EggState.AddEgg("e_rare"); EggState.Start(0); EggState.Start(0);
            PlaytestKit.Check(EggState.Walk(799f).Count == 0, "큰 알이 799m 에 부화함");
            PlaytestKit.Check(EggState.Walk(1f).Count == 1 && EggState.IncCount == 1, "큰 알 800m 부화 실패");
            PlaytestKit.Check(EggState.Walk(699f).Count == 0 && EggState.Walk(1f).Count == 1, "빛나는 알 1500m 부화 실패");
        }

        private static void CheckBuddy()
        {
            EggState.ResetForTest(); PlayerStats.Restore(30, 0);
            PlaytestKit.Check(EggState.SetBuddy("pt_gumiho").Length > 0 && EggState.Buddy == "", "안 만난 신수가 동행이 됨");
            EggState.Discover("pt_gumiho"); EggState.Discover("pt_cheongryong");
            PlaytestKit.Check(EggState.SetBuddy("pt_gumiho") == "" && EggState.Buddy == "pt_gumiho", "만난 신수 동행 실패");
            PlaytestKit.Check(EggState.BuddyLevel == 0 && EggState.BuddyBonus("exp") == 0f, "처음 친밀이 0 이 아님");
            int gold = GoldState.Gold;
            EggState.Walk(499f); PlaytestKit.Check(EggState.BuddyLevel == 0, "499m 에 친밀이 오름");
            EggState.Walk(1f); PlaytestKit.Check(EggState.BuddyLevel == 1, "500m 에 친밀 1 이 아님");
            PlaytestKit.Check(GoldState.Gold == gold + GoEggs.BuddyGold, $"500m 동안 금 {GoldState.Gold - gold} ≠ 800(400m 한 번)");
            EggState.Walk(2500f); PlaytestKit.Check(EggState.BuddyLevel == 6, $"3000m 친밀 {EggState.BuddyLevel} ≠ 6");
            PlaytestKit.Check(Mathf.Abs(EggState.BuddyBonus("exp") - 0.09f * 6 / 10f) < 1e-5f && EggState.BuddyBonus("atk") == 0f && EggState.BuddyBonus("def") == 0f, "구미호(지혜 9) 친밀 6 보너스가 다름");
            EggState.Walk(100000f); PlaytestKit.Check(EggState.BuddyLevel == 10 && Mathf.Abs(EggState.BuddyBonus("exp") - 0.09f) < 1e-5f, "친밀 10 상한·보너스가 다름");
            // 동행을 바꾸면 신수마다 친밀이 따로 쌓인다
            EggState.SetBuddy("pt_cheongryong");
            PlaytestKit.Check(EggState.BuddyLevel == 0 && EggState.BuddyBonus("exp") == 0f, "새 동행 친밀이 0 이 아님");
            EggState.Walk(5000f);
            PlaytestKit.Check(EggState.BuddyLevel == 10 && Mathf.Abs(EggState.BuddyBonus("atk") - 0.14f) < 1e-5f, "청룡(힘 14) 친밀 10 공격 +14% 가 아님");
            EggState.SetBuddy("pt_gumiho");
            PlaytestKit.Check(EggState.BuddyLevel == 10, "옛 동행 친밀이 사라짐");
            PlaytestKit.Check(EggState.SetBuddy("") == "" && EggState.Buddy == "" && EggState.BuddyBonus("atk") == 0f && EggState.BuddyBonus("exp") == 0f, "내보내기 실패");
            PlaytestKit.Check(GoEggs.Pets.Count(p => p.Kind == "def") == 4 && GoEggs.Pets.Count(p => p.Kind == "atk") == 4 && GoEggs.Pets.Count(p => p.Kind == "exp") == 3, "갈래별 신수 수가 다름");
        }

        private static void CheckExpBonus()
        {
            EggState.ResetForTest(); CycleState.ResetForTest();
            PlayerStats.Restore(30, 0); PlayerStats.AddExp(100);
            PlaytestKit.Check(PlayerStats.Exp == 100, "동행 없는데 경험치가 달라짐");
            EggState.Discover("pt_gumiho"); EggState.SetBuddy("pt_gumiho"); EggState.Walk(5000f);
            PlayerStats.Restore(30, 0); PlayerStats.AddExp(100);
            PlaytestKit.Check(PlayerStats.Exp == 109, $"구미호 친밀 10 경험치 ×1.09 가 아님({PlayerStats.Exp})");
            CycleState.Restore(2);
            PlayerStats.Restore(30, 0); PlayerStats.AddExp(100);
            PlaytestKit.Check(PlayerStats.Exp == 120, $"회차 2 와 동행의 경험치 곱이 다름({PlayerStats.Exp} ≠ 120)");
            CycleState.ResetForTest();
        }

        private static void CheckSnapshot()
        {
            EggState.ResetForTest(); PlayerStats.Restore(8, 0);
            EggState.Discover("pt_haetae"); EggState.Discover("pt_baekho"); EggState.SetBuddy("pt_baekho");
            EggState.AddEgg("e_mid"); EggState.AddEgg("e_rare"); EggState.AddEgg("e_small"); EggState.Start(0); EggState.Walk(120f);
            var bag = EggState.SnapshotBag(); var inc = EggState.SnapshotInc(); var own = EggState.SnapshotOwned(); var fr = EggState.SnapshotFriend();
            int hatched = EggState.Hatched; float walk = EggState.WalkTotal, bm = EggState.SnapshotBuddyM();
            EggState.ResetForTest();
            PlaytestKit.Check(EggState.BagCount == 0 && EggState.OwnedCount == 0 && EggState.Buddy == "", "진단 준비: 초기화");
            EggState.Restore(bag, inc, hatched, walk, "pt_baekho", bm, fr, own);
            PlaytestKit.Check(EggState.BagCount == 2 && EggState.IncCount == 1 && EggState.Owns("pt_haetae") && EggState.Buddy == "pt_baekho" && Mathf.Approximately(EggState.WalkTotal, walk) && Mathf.Abs(EggState.IncAt(0).Walked - 120f) < 0.01f && Mathf.Abs(EggState.Friend("pt_baekho") - 120f) < 1f, "스냅샷 왕복이 다름");
            // 모르는 것 버림·수 자름
            var bigBag = Enumerable.Repeat("e_small", 20).Concat(new[] { "e_none" }).ToList();
            var bigInc = new List<EggIncSave> { new EggIncSave { tier = "e_small", walked = 5 }, new EggIncSave { tier = "e_none", walked = 5 }, new EggIncSave { tier = "e_mid", walked = -9 }, new EggIncSave { tier = "e_mid", walked = 1 }, new EggIncSave { tier = "e_mid", walked = 1 }, null };
            EggState.Restore(bigBag, bigInc, -3, -5f, "pt_nope", 0f, new List<CookState.Entry> { new CookState.Entry { id = "pt_nope", n = 9 } }, new List<string> { "pt_haetae", "pt_nope" });
            PlaytestKit.Check(EggState.BagCount == 9, $"주머니가 9 로 안 잘림({EggState.BagCount})");
            PlaytestKit.Check(EggState.IncCount <= 3 && Enumerable.Range(0, EggState.IncCount).All(i => EggState.IncAt(i).Walked >= 0f), "부화기 칸·걸음이 안 눌림");
            PlaytestKit.Check(EggState.Hatched == 0 && EggState.WalkTotal == 0f && EggState.Buddy == "" && EggState.OwnedCount == 1 && EggState.Friend("pt_nope") == 0f, "모르는 신수·음수가 안 버려짐");
            EggState.Restore(null, null, 0, 0f, null, 0f, null, null);
            PlaytestKit.Check(EggState.BagCount == 0 && EggState.IncCount == 0 && EggState.OwnedCount == 0 && EggState.Buddy == "", "옛 세이브(null)는 빈 상태여야 함");
        }

        // ---- 장면 층 ----

        public static bool Run(string tag)
        {
            _tag = tag; _ok = true;
            var ui = EggUi.Instance; var walker = EggWalker.Instance;
            if (ui == null || walker == null) { Fail("EggUi/EggWalker 없음(WorldMapBuilder 연결?)"); return false; }
            var saved = Save();
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            var parts = new List<string>();
            try
            {
                EggState.ResetForTest(); PlayerStats.Restore(30, 0);
                CheckUi(ui, walker, parts);
                CheckRealPaths(walker, parts);
                CheckBodies(walker, parts);
                CheckFile(savePath, parts);
            }
            finally
            {
                ui.Close();
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                Load(saved);
            }
            if (_ok) Debug.Log($"[{_tag}] eggs OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static void CheckUi(EggUi ui, EggWalker walker, List<string> parts)
        {
            if (ui.OpenButton == null || ui.CloseButton == null) { Fail("단추 없음"); return; }
            ui.Refresh(); ui.OpenButton.onClick.Invoke();
            if (!ui.IsOpen) Fail("단추로 안 열림");
            if (ui.BagRowShown(0)) Fail("알이 없는데 주머니 줄이 보임");
            // 실제 굴림 경로로 알을 받는다(호화 상자 = 큰 알 확정)
            string text = EggState.Drop("chest:luxurious", "scene-test");
            if (text.Length == 0 || EggState.BagCount == 0) { Fail("알이 안 나옴"); return; }
            ui.Refresh();
            if (!ui.BagRowShown(0)) Fail("알을 받았는데 주머니 줄이 안 보임");
            if (!ui.OpenLabel.Contains("●")) Fail("알이 있고 칸이 비었는데 단추에 ● 가 없음");
            while (EggState.BagCount > 1) EggState.Start(0); // 칸이 허락하는 만큼만 — 나머지는 주머니에
            int incBefore = EggState.IncCount;
            if (ui.BagRowShown(0) && ui.BagButton(0).interactable) ui.BagButton(0).onClick.Invoke();
            if (EggState.IncCount < incBefore) Fail("단추로 알을 넣었는데 칸이 줄어듦");
            // 칸을 정리하고 작은 알 하나로 실제 걸음 시험
            EggState.ResetForTest(); PlayerStats.Restore(30, 0);
            EggState.AddEgg("e_small"); ui.Refresh();
            ui.BagButton(0).onClick.Invoke();
            if (EggState.IncCount != 1 || EggState.BagCount != 0) Fail("주머니 단추가 알을 부화기에 못 넣음");
            if (!ui.IncText(0).Contains("0/300")) Fail("부화기 줄에 0/300m 가 없음: " + ui.IncText(0));
            Vector3 p = new Vector3(5000f, 0f, 5000f);
            walker.Feed(p);
            float counted = 0f;
            for (int i = 0; i < 160; i++) { p += new Vector3(0f, 0f, 2f); counted += walker.Feed(p); } // 2m × 160 = 320m
            walker.Flush();
            if (Mathf.Abs(counted - 320f) > 0.01f) Fail($"걸음 {counted}m ≠ 320m");
            if (EggState.IncCount != 0 || EggState.OwnedCount != 1 || EggState.Hatched != 1) Fail($"실제 걸음으로 부화가 안 됨(칸 {EggState.IncCount}·신수 {EggState.OwnedCount})");
            if (walker.LastHatches.Count != 0 && walker.LastHatches.Count != 1) Fail("부화 목록이 이상함");
            // 순간이동(한 프레임 3m 넘게)은 안 센다
            float walkBefore = EggState.WalkTotal;
            float c2 = walker.Feed(p + new Vector3(80f, 0f, 0f));
            walker.Flush();
            if (c2 != 0f || EggState.WalkTotal != walkBefore) Fail("순간이동이 걸음으로 셈");
            // 도감에 오른 신수를 단추로 동행에
            var pet = EggState.SnapshotOwned()[0]; int idx = Array.FindIndex(GoEggs.Pets, x => x.Id == pet);
            ui.Refresh();
            if (!ui.PetButton(idx).gameObject.activeSelf) Fail("만난 신수의 동행 단추가 안 보임");
            ui.PetButton(idx).onClick.Invoke();
            if (EggState.Buddy != pet) Fail("동행 단추가 안 먹음");
            if (!ui.TitleText.Contains("1/11")) Fail("제목에 도감 1/11 이 없음");
            ui.CloseButton.onClick.Invoke();
            if (ui.IsOpen) Fail("닫는다로 안 닫힘");
            parts.Add("창 열고 닫기·알 단추로 부화기에 넣기·실제 걸음 320m 로 부화·순간이동 안 셈·동행 단추·제목 도감 1/11");
        }

        /// <summary>D2 — 진단이 직접 부르던 함수 말고 **실제 경로**로: ① 걸음 세기를 진짜 플레이어 위치 + `EggWalker.Update`(리플렉션) ② 진짜 상자 `Open()` ③ 일과 완료 → 알.</summary>
        private static void CheckRealPaths(EggWalker walker, List<string> parts)
        {
            var update = typeof(EggWalker).GetMethod("Update", BindingFlags.Instance | BindingFlags.NonPublic);
            var player = GameObject.FindWithTag("Player");
            if (update == null || player == null) { Fail("실제 경로 점검 준비 실패(Update/Player)"); return; }

            // ① 진짜 플레이어를 움직여 Update 가 걸음을 센다 — 한 프레임 2.9m(세어짐)·3.1m(순간이동으로 뺌)
            var cc = player.GetComponent<CharacterController>();
            bool ccWas = cc != null && cc.enabled; if (cc != null) cc.enabled = false;
            Vector3 home = player.transform.position;
            try
            {
                EggState.ResetForTest(); PlayerStats.Restore(30, 0);
                EggState.AddEgg("e_small"); EggState.Start(0);
                update.Invoke(walker, null); // 첫 Update — 지난 자리와의 거리는 순간이동으로 버려진다
                float before = EggState.WalkTotal;
                for (int i = 0; i < 100; i++) { player.transform.position += new Vector3(2.9f, 0f, 0f); update.Invoke(walker, null); }
                walker.Flush();
                float counted = EggState.WalkTotal - before;
                if (Mathf.Abs(counted - 290f) > 0.5f) Fail($"실제 이동 100프레임×2.9m 가 {counted:0.0}m 로 셈(≈290)");
                if (EggState.Hatched != 0 && EggState.IncCount == 0 && EggState.OwnedCount != 1) Fail("부화 상태가 이상함");
                player.transform.position += new Vector3(3.1f, 0f, 0f); update.Invoke(walker, null); walker.Flush();
                if (Mathf.Abs((EggState.WalkTotal - before) - counted) > 0.01f) Fail("3.1m/프레임이 걸음으로 셈(순간이동으로 빠져야 함)");
                for (int i = 0; i < 20; i++) { player.transform.position += new Vector3(2.9f, 0f, 0f); update.Invoke(walker, null); }
                walker.Flush();
                if (EggState.OwnedCount != 1 || EggState.IncCount != 0) Fail($"실제 이동 310m 로 작은 알이 안 부화함(칸 {EggState.IncCount}·신수 {EggState.OwnedCount})");
                parts.Add("실제 플레이어 이동 + EggWalker.Update 로 2.9m/프레임 세어짐·3.1m 는 뺌·300m 부화");
            }
            finally { player.transform.position = home; if (cc != null) cc.enabled = ccWas; }

            // ② 진짜 상자 열기 — target_ledge(정교 아닌 귀한 상자, 알 굴림 통과) 는 큰 알이 나오고 south_glade(평범, 굴림 실패)는 안 나온다
            int gold = GoldState.Gold; var mats = TalentState.SnapshotMats(); var talent = TalentState.Snapshot();
            var arts = ArtifactState.Snapshot(); int seq = ArtifactState.Seq, polish = ArtifactState.Polish;
            int ore = WeaponState.Ore; var winv = WeaponState.SnapshotInv(); var weq = WeaponState.SnapshotEquip();
            int lv = PlayerStats.Level; long exp = PlayerStats.Exp;
            var events = new List<string>(WorldEventState.TriggeredIds);
            try
            {
                EggState.ResetForTest();
                var open = typeof(TreasureChest).GetMethod("Open", BindingFlags.Instance | BindingFlags.NonPublic);
                foreach (var pair in new[] { ("target_ledge", 1), ("south_glade", 0) })
                {
                    var chest = UnityEngine.Object.FindObjectsByType<TreasureChest>(FindObjectsSortMode.None).FirstOrDefault(c => c.Data.Id == pair.Item1);
                    if (chest == null) { Fail($"씬에 상자 {pair.Item1} 없음"); continue; }
                    WorldEventState.Restore(events.Where(e => e != GoTreasure.EventKey(chest.Data)));
                    int bag = EggState.BagCount;
                    bool ok = (bool)open.Invoke(chest, null);
                    if (!ok) { Fail($"상자 {pair.Item1} 이 안 열림"); continue; }
                    int got = EggState.BagCount - bag;
                    if (got != pair.Item2) Fail($"상자 {pair.Item1} 에서 알 {got}개(기대 {pair.Item2})");
                    if (pair.Item2 == 1 && (EggState.BagCount == 0 || EggState.BagAt(EggState.BagCount - 1) != "e_mid")) Fail("귀한 상자 알이 큰 알이 아님");
                }
                parts.Add("진짜 상자 Open(): 귀한 상자 target_ledge 는 큰 알 1·평범한 south_glade 는 0");
            }
            finally
            {
                WorldEventState.Restore(events);
                GoldState.Restore(gold); TalentState.Restore(talent, mats); ArtifactState.Restore(arts, seq, polish);
                WeaponState.Restore(winv, weq, ore); PlayerStats.Restore(lv, exp);
            }

            // ③ 일과 하나를 실제로 완료하면 작은 알
            var dd = (DailyTaskState.CurrentDate, DailyTaskState.SnapshotProgress(), DailyTaskState.SnapshotDone(), DailyTaskState.SnapshotDayStampGranted(), DailyTaskState.Stamps, DailyTaskState.BonusClaimed);
            gold = GoldState.Gold; lv = PlayerStats.Level; exp = PlayerStats.Exp;
            bool dailyOff = DailyTaskState.OffForTest; DailyTaskState.OffForTest = false; // 헤드리스는 옛 진단 값을 지키려 일과 진행을 꺼 둔다 — 이 점검만 켠다
            try
            {
                EggState.ResetForTest();
                DailyTaskState.EnsureToday();
                var kind = DailyTaskState.TaskKind(0);
                int bag = EggState.BagCount;
                DailyTaskState.ReportProgress(kind, 99999);
                if (EggState.BagCount <= bag) Fail("일과 완료에서 알이 안 나옴");
                else if (EggState.BagAt(EggState.BagCount - 1) != "e_small") Fail("일과 알이 작은 알이 아님");
                else parts.Add("일과 실제 완료(ReportProgress) → 작은 알");
            }
            finally
            {
                DailyTaskState.OffForTest = dailyOff;
                DailyTaskState.Restore(dd.CurrentDate, dd.Item2, dd.Item3, dd.Item4, dd.Stamps, dd.BonusClaimed);
                GoldState.Restore(gold); PlayerStats.Restore(lv, exp);
            }
        }

        private static void CheckFile(string savePath, List<string> parts)
        {
            EggState.ResetForTest(); PlayerStats.Restore(30, 0);
            EggState.Discover("pt_gumiho"); EggState.SetBuddy("pt_gumiho"); EggState.AddEgg("e_mid"); EggState.Walk(600f);
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"eggBag\":[") || !json.Contains("\"petOwned\":[") || !json.Contains("\"eggBuddy\":\"pt_gumiho\"") || !json.Contains("\"version\":29")) Fail("세이브에 알·동행이 없다(버전은 그대로여야 함)");
            EggState.ResetForTest();
            if (!SaveState.TryLoad() || !EggState.Owns("pt_gumiho") || EggState.Buddy != "pt_gumiho" || EggState.BagCount != 1 || EggState.BuddyLevel != 1) Fail("세이브 왕복(알·동행·친밀)");
            string old = Regex.Replace(json, ",\"eggBag\":.*?\"petOwned\":\\[[^\\]]*\\]", "", RegexOptions.Singleline);
            if (old.Contains("eggBag") || old.Contains("petOwned")) { Fail("옛 세이브 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, old);
            EggState.Discover("pt_haetae");
            if (!SaveState.TryLoad()) { Fail("알 없는 옛 파일 TryLoad 실패"); return; }
            if (EggState.BagCount != 0 || EggState.OwnedCount != 0 || EggState.Buddy != "") Fail("알 없는 옛 세이브가 빈 상태로 안 읽힘");
            parts.Add("세이브(알·부화기·신수·동행·친밀 왕복 · 옛 세이브는 빈 상태 · 버전 그대로)");
        }

        /// <summary>U-0068 — 신수 11 을 하나씩 동행으로 두고 진짜 `EggWalker.Update` 를 돌리면 그 몸(그림 있음)이 주인공 뒤에 선다 · 내보내면 사라진다.</summary>
        private static void CheckBodies(EggWalker walker, List<string> parts)
        {
            var update = typeof(EggWalker).GetMethod("Update", BindingFlags.Instance | BindingFlags.NonPublic);
            var bodyField = typeof(EggWalker).GetField("_body", BindingFlags.Instance | BindingFlags.NonPublic);
            var player = GameObject.FindWithTag("Player");
            if (update == null || bodyField == null || player == null) { Fail("EggWalker.Update/_body/Player 없음"); return; }
            int stood = 0;
            foreach (var pet in GoEggs.Pets)
            {
                EggState.Discover(pet.Id);
                if (EggState.SetBuddy(pet.Id).Length > 0) { Fail($"{pet.Id} 동행이 안 됨"); continue; }
                update.Invoke(walker, null);
                var body = bodyField.GetValue(walker) as GameObject;
                if (body == null || body.GetComponentsInChildren<Renderer>().Length == 0) { Fail($"동행 {pet.Id} 몸이 안 섬"); continue; }
                if (body.name != GoEggs.BodyName(pet.Id)) Fail($"동행 몸 이름이 다름 {body.name}");
                if (Vector3.Distance(body.transform.position, player.transform.position) > 6f) Fail($"동행 {pet.Id} 몸이 주인공 곁이 아님");
                // U-0074 — 키 0.9m(가장 긴 가로 변 ≤ 2.2m) · 막 선 몸은 Idle
                Bounds bb = default; bool anyR = false;
                foreach (var r in body.GetComponentsInChildren<Renderer>()) { if (!anyR) { bb = r.bounds; anyR = true; } else bb.Encapsulate(r.bounds); }
                float len = Mathf.Max(bb.size.x, bb.size.z);
                bool tallOk = Mathf.Abs(bb.size.y - GoEggs.BuddyHeight) <= 0.05f, lenCapped = len <= GoEggs.BuddyMaxLen + 0.02f;
                if (!lenCapped || (!tallOk && Mathf.Abs(len - GoEggs.BuddyMaxLen) > 0.02f)) Fail($"동행 {pet.Id} 크기 키 {bb.size.y:0.00}·길이 {len:0.00}(키 {GoEggs.BuddyHeight}·길이 ≤ {GoEggs.BuddyMaxLen})");
                if (walker.BuddyClip != "Idle") Fail($"동행 {pet.Id} 막 섰는데 동작 '{walker.BuddyClip}'(Idle 이어야)");
                stood++;
            }
            CheckBuddyGait(walker, update, player.transform, parts);
            EggState.SetBuddy(""); update.Invoke(walker, null);
            if (bodyField.GetValue(walker) as GameObject != null) Fail("동행을 내보냈는데 몸이 남음");
            parts.Add($"동행 몸 {stood}/11 이 진짜 Update 로 주인공 곁에 섬·내보내면 사라짐");
        }

        /// <summary>U-0074 — 마지막 동행 몸으로: 주인공을 1.5m/s 로 옮기면 Walk · 8m/s 면 Run · 멈추면 다시 Idle(진짜 Update, 같은 프레임 안 반복).</summary>
        private static void CheckBuddyGait(EggWalker walker, MethodInfo update, Transform player, List<string> parts)
        {
            Vector3 home = player.position;
            float dt = Mathf.Max(Time.deltaTime, 0.02f);
            string Drive(float speed, int steps)
            {
                for (int i = 0; i < steps; i++) { player.position += Vector3.forward * speed * dt; update.Invoke(walker, null); }
                return walker.BuddyClip;
            }
            try
            {
                string walk = Drive(1.5f, 80), run = Drive(8f, 80), idle = Drive(0f, 200);
                if (walk != "Walk") Fail($"1.5m/s 로 따라오는데 동작 '{walk}'(Walk 이어야)");
                if (run != "Run") Fail($"8m/s 로 따라오는데 동작 '{run}'(Run 이어야)");
                if (idle != "Idle") Fail($"멈췄는데 동작 '{idle}'(Idle 이어야)");
                parts.Add($"동행 걸음 1.5m/s {walk}·8m/s {run}·멈춤 {idle}");
            }
            finally { player.position = home; update.Invoke(walker, null); }
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] eggs FAIL - {msg}");
        }
    }
}
