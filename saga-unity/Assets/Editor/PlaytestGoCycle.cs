using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0045 별배 재출항(회차) 진단. 두 길 —
    /// ① <see cref="RunBatch"/>(`-executeMethod …PlaytestGoCycle.RunBatch`, 장면 없이): 표(5회차·+5%·상한 +2·보상) · Blocker(이야기 안 끝남·마지막 회차) ·
    ///    Advance 효과 전부(상자 되살림 수·다른 이벤트는 그대로·채집 타이머·주간 횟수·밤의 잔불·낮춤 해제·보상 지급·회차 +1) · 영구 보너스(경험치 ×1.05) ·
    ///    천하 등급 상한·문턱(회차 0 은 옛 값 그대로·1회차 10·2회차 12·문턱 27·30) · 세이브 왕복(범위 밖 눌림).
    /// ② <see cref="Run"/>(`PlaytestHeadless` 가 주간 도전 진단 뒤에 부른다, 장면 안): 창이 붙어 있고 두 번 눌러야 재출항하고, 실제 상자가 도로 닫히며,
    ///    세이브 파일에 필드가 들어가고(버전 그대로) 옛 세이브(필드 없음)는 0 회차로 읽힘. 끝나면 모든 상태·세이브를 되돌린다.
    /// </summary>
    public static class PlaytestGoCycle
    {
        private static string _tag;
        private static bool _ok;

        private sealed class Saved
        {
            public int Gold, Lv, Exp, Cycle, Paid, Ch, Step;
            public bool Lowered;
            public int[] Mats; public List<TalentState.Entry> Talent;
            public List<string> Events; public List<CookState.Entry> Bag, Prof; public List<CookState.TimeEntry> Gather;
            public (int resin, long t, int claims, string week, int weekN) Dom;
            public string NightDay; public List<string> Night;
        }

        private static Saved Save()
        {
            return new Saved
            {
                Gold = GoldState.Gold, Lv = PlayerStats.Level, Exp = PlayerStats.Exp, Cycle = CycleState.Cycle, Paid = AdventureState.Paid, Lowered = AdventureState.Lowered,
                Ch = StoryState.Ch, Step = StoryState.StepIndex, Mats = TalentState.SnapshotMats(), Talent = TalentState.Snapshot(),
                Events = new List<string>(WorldEventState.TriggeredIds), Bag = CookState.SnapshotBag(), Prof = CookState.SnapshotProf(), Gather = CookState.SnapshotGather(),
                Dom = DomainState.Snapshot(), NightDay = NightEchoState.Day, Night = NightEchoState.Snapshot(),
            };
        }

        private static void Load(Saved s)
        {
            GoldState.Restore(s.Gold);
            PlayerStats.Restore(s.Lv, s.Exp);
            TalentState.Restore(s.Talent, s.Mats);
            WorldEventState.Restore(s.Events);
            CookState.Restore(s.Bag, s.Prof, s.Gather);
            DomainState.Restore(s.Dom.resin, s.Dom.t, s.Dom.claims, s.Dom.week, s.Dom.weekN);
            NightEchoState.Restore(s.NightDay, s.Night);
            StoryState.Restore(s.Ch, s.Step);
            CycleState.Restore(s.Cycle);
            AdventureState.RestoreSave(s.Lowered, s.Paid);
        }

        [MenuItem("Saga/Playtest Go Cycle")]
        public static void RunBatch()
        {
            PlaytestKit.Begin("[PlaytestGoCycle]");
            var saved = Save();
            using (PlaytestKit.ErrorCounter())
            {
                CycleState.ResetForTest();
                try
                {
                    CheckTable();
                    CheckBlocker();
                    CheckAdvance();
                    CheckBonus();
                    CheckWorldCap();
                    CheckSnapshot();
                }
                finally { Load(saved); }
            }
            PlaytestKit.Summary("PlaytestGoCycle");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        // ---- 규칙 층 ----

        private static void FinishStory() => StoryState.Restore(GoStory.Chapters.Length, 0);

        private static void CheckTable()
        {
            PlaytestKit.Check(GoCycle.MaxCycle == 5 && Mathf.Approximately(GoCycle.BonusPerCycle, 0.05f) && GoCycle.WorldCapPerCycle == 2, "표 수치가 고돗(5회차·+5%·상한 +2)과 다름");
            PlaytestKit.Check(GoCycle.RewardGold == 20000 && GoCycle.RewardGuide == 2 && GoCycle.RewardKnot == 3 && GoCycle.RewardExp == 200, "보상 수치가 고돗과 다름");
            PlaytestKit.Check(GoStory.Chapters.Length == 41, $"이야기 {GoStory.Chapters.Length}장 ≠ 41");
        }

        private static void CheckBlocker()
        {
            CycleState.ResetForTest(); StoryState.Restore(10, 0);
            PlaytestKit.Check(CycleState.Blocker().Length > 0 && !CycleState.Advance().Ok, "이야기를 안 끝냈는데 재출항됨");
            PlaytestKit.Check(CycleState.Cycle == 0, "막힌 재출항이 회차를 올림");
            FinishStory();
            PlaytestKit.Check(CycleState.Blocker().Length == 0, "이야기를 끝냈는데 막힘");
            CycleState.Restore(GoCycle.MaxCycle);
            PlaytestKit.Check(CycleState.Blocker().Length > 0 && !CycleState.Advance().Ok && CycleState.Cycle == GoCycle.MaxCycle, "마지막 회차를 넘어 재출항됨");
        }

        private static void CheckAdvance()
        {
            CycleState.ResetForTest(); FinishStory();
            // 준비 — 상자 둘을 열고, 다른 이벤트·채집 타이머·주간 횟수·잔불·낮춤을 만들어 둔다
            var chests = GoTreasure.Chests;
            WorldEventState.Restore(new[] { GoTreasure.EventKey(chests[0]), GoTreasure.EventKey(chests[1]), "other_event_x" });
            CookState.Restore(CookState.SnapshotBag(), CookState.SnapshotProf(), new List<CookState.TimeEntry> { new CookState.TimeEntry { id = "herb_1", t = CookState.Now } });
            DomainState.ResetForTest(); DomainState.MarkClaim(GoDomain.Kind.Weekly);
            NightEchoState.Restore(NightEchoState.Day, new List<string>());
            PlayerStats.Restore(30, 0); // 레벨 58 부터는 ExpToNext 가 int 를 넘어 AddExp 가 끝나지 않는다 — 진단은 30
            AdventureState.RestoreSave(true, AdventureState.Paid);
            PlaytestKit.Check(AdventureState.Lowered && DomainState.WeeklyUsed == 1 && CookState.SnapshotGather().Count == 1, "준비 실패");
            int gold = GoldState.Gold, guide = TalentState.Count(GoTalent.Mat.Guide), knot = TalentState.Count(GoTalent.Mat.Knot);
            var r = CycleState.Advance();
            PlaytestKit.Check(r.Ok && r.Cycle == 1 && CycleState.Cycle == 1, "재출항이 안 됨");
            PlaytestKit.Check(r.Chests == 2, $"되살린 상자 {r.Chests} ≠ 2");
            PlaytestKit.Check(!GoTreasure.IsOpened(chests[0]) && !GoTreasure.IsOpened(chests[1]), "상자가 안 되살아남");
            PlaytestKit.Check(WorldEventState.IsTriggered("other_event_x"), "상자 말고 다른 이벤트가 지워짐");
            PlaytestKit.Check(CookState.SnapshotGather().Count == 0, "채집 자리가 안 돌아옴");
            PlaytestKit.Check(DomainState.WeeklyUsed == 0, "주간 숨은 터 횟수가 안 초기화됨");
            PlaytestKit.Check(!AdventureState.Lowered, "낮춘 천하 등급이 안 풀림");
            PlaytestKit.Check(GoldState.Gold == gold + GoCycle.RewardGold && TalentState.Count(GoTalent.Mat.Guide) == guide + GoCycle.RewardGuide && TalentState.Count(GoTalent.Mat.Knot) == knot + GoCycle.RewardKnot, "보상(금·교본·매듭)이 다름");
            // 이야기·레벨 불변
            PlaytestKit.Check(StoryState.Done, "재출항이 이야기를 건드림");
            PlaytestKit.Check(PlayerStats.Level >= 30, "재출항이 레벨을 낮춤");
            // 연속 재출항 — 5번째까지만
            for (int i = 2; i <= GoCycle.MaxCycle; i++) PlaytestKit.Check(CycleState.Advance().Ok && CycleState.Cycle == i, $"{i}회차 재출항 실패");
            PlaytestKit.Check(!CycleState.Advance().Ok && CycleState.Cycle == GoCycle.MaxCycle, "6회차가 열림");
        }

        private static void CheckBonus()
        {
            CycleState.ResetForTest();
            PlaytestKit.Check(Mathf.Approximately(CycleState.Bonus, 0f), "회차 0 보너스가 0 이 아님");
            PlayerStats.Restore(30, 0); PlayerStats.AddExp(100); // 레벨 30 은 다음 레벨까지 멀어 레벨업으로 값이 줄지 않는다
            PlaytestKit.Check(PlayerStats.Exp == 100, $"회차 0 경험치가 그대로가 아님({PlayerStats.Exp})");
            CycleState.Restore(2);
            PlaytestKit.Check(Mathf.Approximately(CycleState.Bonus, 0.10f), "2회차 보너스가 +10% 가 아님");
            PlayerStats.Restore(30, 0); PlayerStats.AddExp(100); // 레벨 30 은 다음 레벨까지 멀어 레벨업으로 값이 줄지 않는다
            PlaytestKit.Check(PlayerStats.Exp == 110, $"2회차 경험치 ×1.10 이 아님({PlayerStats.Exp})");
            CycleState.Restore(5);
            PlayerStats.Restore(30, 0); PlayerStats.AddExp(100); // 레벨 30 은 다음 레벨까지 멀어 레벨업으로 값이 줄지 않는다
            PlaytestKit.Check(PlayerStats.Exp == 125, $"5회차 경험치 ×1.25 가 아님({PlayerStats.Exp})");
        }

        private static void CheckWorldCap()
        {
            CycleState.ResetForTest();
            PlaytestKit.Check(GoAdventure.WlMax == 8 && GoAdventure.NaturalOf(99) == 8 && GoAdventure.NextAt(24) == 0, "회차 0 천하 상한이 옛 값(8)이 아님");
            CycleState.Restore(1);
            PlaytestKit.Check(GoAdventure.WlMax == 10 && GoAdventure.NaturalOf(24) == 8 && GoAdventure.NaturalOf(27) == 9 && GoAdventure.NaturalOf(30) == 10 && GoAdventure.NaturalOf(99) == 10, "1회차 상한 10·문턱 27·30 이 아님");
            PlaytestKit.Check(GoAdventure.NextAt(24) == 27 && GoAdventure.NextAt(30) == 0, "1회차 다음 문턱이 다름");
            CycleState.Restore(2);
            PlaytestKit.Check(GoAdventure.WlMax == 12 && GoAdventure.NaturalOf(99) == 12 && GoAdventure.NaturalOf(33) == 11, "2회차 상한 12 가 아님");
            PlaytestKit.Check(Mathf.Approximately(GoAdventure.HpMul(12), 1f + 0.35f * 12) && Mathf.Approximately(GoAdventure.AtkMul(10), 1f + 0.22f * 10), "상한을 넘는 배수가 이어 계산되지 않음");
            CycleState.ResetForTest();
            PlaytestKit.Check(Mathf.Approximately(GoAdventure.HpMul(12), 1f + 0.35f * 8), "회차 0 에서 상한 밖 배수가 눌리지 않음");
        }

        private static void CheckSnapshot()
        {
            CycleState.Restore(3);
            PlaytestKit.Check(CycleState.Cycle == 3, "복원");
            CycleState.Restore(99); PlaytestKit.Check(CycleState.Cycle == GoCycle.MaxCycle, "범위 밖(위)이 안 눌림");
            CycleState.Restore(-4); PlaytestKit.Check(CycleState.Cycle == 0, "범위 밖(아래)이 안 눌림");
        }

        // ---- 장면 층 ----

        public static bool Run(string tag)
        {
            _tag = tag; _ok = true;
            var ui = CycleUi.Instance;
            if (ui == null) { Fail("CycleUi 없음(WorldMapBuilder 연결?)"); return false; }
            var saved = Save();
            var arts = ArtifactState.Snapshot(); int seq = ArtifactState.Seq, polish = ArtifactState.Polish;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            var parts = new List<string>();
            try
            {
                CycleState.ResetForTest();
                CheckUi(ui, parts);
                CheckFile(savePath, parts);
            }
            finally
            {
                ui.Close();
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                Load(saved);
                ArtifactState.Restore(arts, seq, polish);
            }
            if (_ok) Debug.Log($"[{_tag}] cycle OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static void CheckUi(CycleUi ui, List<string> parts)
        {
            if (ui.OpenButton == null || ui.ActionButton == null || ui.CloseButton == null) { Fail("단추 없음"); return; }
            // 이야기를 안 끝낸 채 열면 재출항이 막혀 있다
            StoryState.Restore(10, 0);
            ui.Refresh(); ui.OpenButton.onClick.Invoke();
            if (!ui.IsOpen) Fail("단추로 안 열림");
            if (ui.ActionButton.interactable) Fail("이야기를 안 끝냈는데 재출항 단추가 켜져 있음");
            if (!ui.BodyText.Contains("/41")) Fail("몸글에 이야기 진행이 없음");
            ui.ActionButton.onClick.Invoke();
            if (CycleState.Cycle != 0) Fail("막힌 단추가 재출항시킴");
            ui.CloseButton.onClick.Invoke();
            // 이야기를 끝내고 실제 상자를 열어 둔 채 재출항
            StoryState.Restore(GoStory.Chapters.Length, 0);
            var chest = UnityEngine.Object.FindObjectsByType<Saga.Go.World.TreasureChest>(FindObjectsSortMode.None).FirstOrDefault();
            if (chest == null) { Fail("씬에 상자가 없음"); return; }
            string key = GoTreasure.EventKey(chest.Data);
            WorldEventState.TryTrigger(key);
            ui.Open();
            if (!ui.ActionButton.interactable) Fail("이야기를 끝냈는데 재출항 단추가 꺼져 있음");
            int gold = GoldState.Gold;
            ui.ActionButton.onClick.Invoke();
            if (CycleState.Cycle != 0 || !ui.Armed) Fail("첫 번째 누름이 확인 단계가 아님");
            ui.ActionButton.onClick.Invoke();
            if (CycleState.Cycle != 1) Fail("두 번째 누름에 재출항이 안 됨");
            if (GoldState.Gold != gold + GoCycle.RewardGold) Fail($"재출항 금 지급이 다름({GoldState.Gold - gold})");
            if (GoTreasure.IsOpened(chest.Data)) Fail("상자 기록이 안 지워짐");
            if (!ui.TitleText.Contains("1/5")) Fail("제목이 1/5회차가 아님");
            ui.CloseButton.onClick.Invoke();
            if (ui.IsOpen) Fail("닫는다로 안 닫힘");
            parts.Add("창 열고 닫기·막힘 단추·두 번 눌러 재출항(금 +20000)·상자 기록 되살림·제목 1/5");
        }

        private static void CheckFile(string savePath, List<string> parts)
        {
            CycleState.Restore(2);
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"cycleN\":2") || !json.Contains("\"version\":29")) Fail("세이브에 회차가 없다(버전은 그대로여야 함)");
            CycleState.ResetForTest();
            if (!SaveState.TryLoad() || CycleState.Cycle != 2) Fail("세이브 왕복(회차)");
            string old = Regex.Replace(json, ",\"cycleN\":\\d+", "");
            if (old.Contains("cycleN")) { Fail("옛 세이브 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, old);
            CycleState.Restore(4);
            if (!SaveState.TryLoad()) { Fail("회차 없는 옛 파일 TryLoad 실패"); return; }
            if (CycleState.Cycle != 0) Fail("회차 없는 옛 세이브가 0 회차로 안 읽힘");
            parts.Add("세이브(회차 왕복 · 옛 세이브는 0 · 버전 그대로)");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] cycle FAIL - {msg}");
        }
    }
}
