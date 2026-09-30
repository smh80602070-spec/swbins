using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using UnityEngine;
using Saga.Story.Data;
using Saga.Story.Player;
using Saga.Story.UI;
using Saga.Story.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-16 사가스토리 시나리오 「이름 없는 떠돌이」 진단 — `PlaytestStorySlice` 가 부른다.
    /// 표(들판·첫 전직·비경 셋 · 잇는 순서 · 문턱 레벨 1/10/30 · 장면 여섯 · 글이 한국어 표에 다 있음) · 진행(들판 밖이면 장면 안 뜸 → 첫 사냥 → 두목 → 끝 경험치 → 레벨 문턱 → 전직 → 칭호 → 비경 → 기억 조각) ·
    /// 옛 세이브(레벨·전직으로 지나온 장) · 세이브 왕복 · 장면 상자(UI) · 러너(들판 판정·비경 완주 신호). 끝나면 레벨·직업·사명·자리를 되돌린다.
    /// </summary>
    public static class PlaytestStoryScenario
    {
        private const string T = "[PlaytestStoryScenario]";
        private static bool _ok;
        private static readonly List<StoryScenario.SceneRequest> Requests = new List<StoryScenario.SceneRequest>();
        private static readonly Queue<string> Pending = new Queue<string>();

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            var pc = playerGo != null ? playerGo.GetComponent<StoryPlayerController>() : null;
            if (pc == null || StoryScenarioRunner.Instance == null) { Fail("StoryPlayerController/StoryScenarioRunner 없음"); return false; }
            Vector3 start = playerGo.transform.position;
            int lv0 = StoryJobState.Level; float exp0 = StoryJobState.Exp; string job0 = StoryJobState.Job;
            int kills0 = StoryQuestState.Kills, boss0 = StoryQuestState.BossKills;
            int shards0 = StoryLabyrinthState.MemoryShards, tier0 = StoryLabyrinthState.MemoryTier;
            string scen0 = StoryScenario.Snapshot();
            bool enabled0 = StoryScenario.Enabled;
            string json0 = StorySaveState.ToJson();
            var parts = new List<string>();
            try
            {
                CheckTable(parts);
                CheckTexts(parts);
                CheckFlow(parts);
                CheckLegacy(parts);
                CheckSave(parts);
                CheckUi(parts);
                CheckRunner(pc, parts);
            }
            catch (Exception e) { Fail("예외 " + e); }
            finally
            {
                StoryScenario.InFieldForTest = null;
                StoryScenarioUi.Instance?.Hide();
                StoryQuestState.Restore(kills0, boss0);
                StoryJobState.Restore(lv0, exp0, job0);
                StoryLabyrinthState.Restore(shards0, tier0);
                StoryPlayerHp.Refill();
                pc.ClearTestInput();
                pc.Teleport(start);
                pc.Step(0.05f);
                StorySaveState.ApplyJson(json0);
                StoryScenario.Restore(scen0);
                StoryScenario.Enabled = enabled0;
            }
            if (_ok) Debug.Log($"{T} OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static void Fail(string what)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {what}");
        }

        // ---- 표 ----------------------------------------------------------------------------------------------

        private static void CheckTable(List<string> parts)
        {
            var ch = StoryScenarioData.Chapters;
            if (ch.Length != 5 || ch[0].Id != "p1_field" || ch[1].Id != "p1_job" || ch[2].Id != "p2_cave" || ch[3].Id != "p3_labyrinth" || ch[4].Id != "p3_job") Fail("장 다섯");
            if (ch[0].Need != 1 || ch[1].Need != 10 || ch[2].Need != 15 || ch[3].Need != 30 || ch[4].Need != 30) Fail("문턱 레벨");
            if (ch[0].After != null || ch[1].After != "p1_field" || ch[2].After != "p1_job" || ch[3].After != "p2_cave" || ch[4].After != "p3_labyrinth") Fail("잇는 순서");
            if (StoryScenarioData.Scenes.Length != 10) Fail($"장면 {StoryScenarioData.Scenes.Length}");
            if (ch[2].Steps[1].T != "job" || ch[2].Steps[1].N != 2 || ch[4].Steps[1].N != 3) Fail("전직 차수 단계");
            for (int i = 0; i < ch.Length; i++)
            {
                if (ch[i].No != i + 1) Fail($"{ch[i].Id} 번호");
                foreach (var st in ch[i].Steps)
                {
                    if (st.T == "talk" && StoryScenarioData.SceneOf(st.Scene) == null) Fail($"장면 {st.Scene} 없음");
                    if (st.T != "talk" && st.T != "mission" && st.T != "job" && st.T != "rift") Fail("단계 종류 " + st.T);
                }
            }
            foreach (var s in StoryScenarioData.Scenes)
            {
                if (StoryScenarioData.ChapterOf(s.ChapterId) == null) Fail($"장면 {s.Id} 장");
                foreach (var l in s.Lines) if (l.Who != "me" && StoryScenarioData.CastOf(l.Who) == null) Fail($"장면 {s.Id} 말하는 이 {l.Who}");
            }
            if (!ch[1].JobTitle || !ch[2].JobTitle || !ch[4].JobTitle || ch[3].Shards != 3 || ch[0].Exp != 400 || ch[2].Exp != 4000 || ch[4].Exp != 40000) Fail("보상");
            parts.Add("표(다섯·문턱 1/10/15/30/30·잇는 순서·장면 열·전직 2·3차 단계·보상)");
        }

        private static void CheckTexts(List<string> parts)
        {
            int miss = 0;
            void Need(string key) { if (StoryLocalization.T(key, "\u0001") == "\u0001") { miss++; if (miss < 4) Debug.LogError($"{T} 글 키 없음 {key}"); } }
            foreach (var c in StoryScenarioData.Casts) Need($"sscen.cast.{c.Id}");
            foreach (var c in StoryScenarioData.Chapters) { Need($"sscen.ch.{c.Id}.title"); Need($"sscen.ch.{c.Id}.blurb"); }
            foreach (var s in StoryScenarioData.Scenes) for (int i = 0; i < s.Lines.Length; i++) Need($"sscen.scene.{s.Id}.{i}");
            if (miss > 0) Fail($"없는 글 키 {miss}");
            parts.Add("글(한국어 표에 다 있음)");
        }

        // ---- 진행 --------------------------------------------------------------------------------------------

        private static FieldInfo PlayField => typeof(StoryScenario).GetField("ScenePlay", BindingFlags.Static | BindingFlags.NonPublic);

        private static Action<StoryScenario.SceneRequest> SwapToAuto()
        {
            var saved = (Action<StoryScenario.SceneRequest>)PlayField.GetValue(null);
            Action<StoryScenario.SceneRequest> auto = r => { Requests.Add(r); Pending.Enqueue(r.Scene.Id); };
            PlayField.SetValue(null, auto);
            return saved;
        }

        private static void Drain()
        {
            int guard = 0;
            while (Pending.Count > 0 && guard++ < 100) StoryScenario.SceneFinished(Pending.Dequeue());
        }

        private static void Fresh()
        {
            // 상태를 먼저 되돌린다 — Restore 가 쏘는 이벤트를 러너가 듣고 진짜 장면을 띄우지 못하게(시나리오는 아직 옛 상태·꺼진 채 들판 밖).
            StoryScenario.Enabled = false;
            StoryQuestState.Restore(0, 0);
            StoryJobState.Restore(1, 0f, StoryJobState.NoJob);
            StoryLabyrinthState.Restore(0, 0);
            StoryScenarioUi.Instance?.Hide();
            StoryScenario.ResetForTest();
            StoryScenario.InFieldForTest = false;
            Requests.Clear();
            Pending.Clear();
        }

        private static void CheckFlow(List<string> parts)
        {
            Fresh();
            var saved = SwapToAuto();
            try
            {
                StoryScenario.InFieldForTest = false;
                StoryScenario.Check();
                if (Requests.Count != 0) Fail("들판 밖인데 장면이 뜸");
                if (StoryScenario.ChapterId != "p1_field" || !StoryScenario.HudLine().Contains("제1장")) Fail("첫 장 " + StoryScenario.ChapterId + " / " + StoryScenario.HudLine());
                StoryScenario.InFieldForTest = true;
                StoryScenario.Poll(); Drain();
                if (Requests.Count != 1 || Requests[0].Scene.Id != "field1") Fail($"field1 이 안 뜸 (요청 {Requests.Count}, 재생 중 {StoryScenario.Playing}, 단계 {StoryScenario.StepIndex}, 들판 {StoryScenario.InField()}, 켜짐 {StoryScenario.Enabled})");
                if (Requests.Count > 0 && !Requests[0].Title.Contains("제1장")) Fail("장면 제목 " + Requests[0].Title);
                if (StoryScenario.StepIndex != 1 || !StoryScenario.HudLine().Contains("첫 사냥")) Fail("첫 사냥 단계 " + StoryScenario.StepIndex + " / " + StoryScenario.HudLine());
                StoryQuestState.Restore(StoryQuestState.KillGoal, 0);
                StoryScenario.Check(); Drain();
                if (StoryScenario.StepIndex != 2 || !StoryScenario.HudLine().Contains("두목의 목")) Fail("두목 단계 " + StoryScenario.StepIndex);
                float exp = StoryJobState.Exp; int lv = StoryJobState.Level;
                StoryQuestState.Restore(StoryQuestState.KillGoal, StoryQuestState.BossGoal);
                StoryScenario.Check(); Drain();
                if (!StoryScenario.IsDone("p1_field") || !Requests.Any(r => r.Scene.Id == "field2")) Fail("1장이 안 끝남");
                if (StoryJobState.Level == lv && StoryJobState.Exp <= exp) Fail("1장 경험치 +400");
                // 2장은 레벨 10 부터
                int lvNow = StoryJobState.Level;
                if (lvNow < 10)
                {
                    if (!StoryScenario.HudLine().Contains("10")) Fail("문턱 안내 " + StoryScenario.HudLine());
                    if (Requests.Any(r => r.Scene.Id == "job1")) Fail("문턱 전에 job1");
                }
                StoryJobState.Restore(10, 0f, StoryJobState.NoJob);
                StoryScenario.Check(); Drain();
                if (!Requests.Any(r => r.Scene.Id == "job1") || StoryScenario.StepIndex != 1 || !StoryScenario.HudLine().Contains("전직")) Fail("전직 단계 " + StoryScenario.StepIndex);
                StoryJobState.ChooseJob("warrior"); Drain(); // 러너가 JobChosen 을 듣고 job2 를 띄운다
                if (!StoryScenario.IsDone("p1_job")) Fail("2장이 전직 뒤 안 끝남");
                if (!Requests.Any(r => r.Scene.Id == "job2")) Fail("job2 안 뜸");
                if (StoryScenario.AwardedTitles.Count != 1 || !StoryScenario.AwardedTitles[0].Contains("무사")) Fail("칭호 " + string.Join(",", StoryScenario.AwardedTitles));
                // 3장(2차 전직)은 레벨 15 부터 — 이름 없는 채로 둘째 자리
                if (Requests.Any(r => r.Scene.Id == "cave1")) Fail("문턱 전에 cave1");
                StoryJobState.Restore(15, 0f, "warrior");
                StoryScenario.Check(); Drain();
                if (!Requests.Any(r => r.Scene.Id == "cave1") || StoryScenario.StepIndex != 1 || !StoryScenario.HudLine().Contains("2차")) Fail("2차 전직 단계 " + StoryScenario.StepIndex + " / " + StoryScenario.HudLine());
                if (StoryScenario.IsDone("p2_cave")) Fail("전직 전에 3장이 끝남");
                StoryJobState.Restore(15, 0f, "general");
                StoryScenario.Check(); Drain();
                if (!StoryScenario.IsDone("p2_cave") || !Requests.Any(r => r.Scene.Id == "cave2")) Fail("3장이 2차 전직 뒤 안 끝남");
                if (StoryScenario.AwardedTitles.Count != 2 || !StoryScenario.AwardedTitles[1].Contains("장군")) Fail("칭호 둘째 " + string.Join(",", StoryScenario.AwardedTitles));
                // 4장은 레벨 30 부터
                if (Requests.Any(r => r.Scene.Id == "lab1")) Fail("문턱 전에 lab1");
                StoryJobState.Restore(30, 0f, "general");
                int shards = StoryLabyrinthState.MemoryShards;
                StoryScenario.Check(); Drain();
                if (!Requests.Any(r => r.Scene.Id == "lab1") || StoryScenario.StepIndex != 1 || !StoryScenario.HudLine().Contains("비경")) Fail("비경 단계 " + StoryScenario.StepIndex);
                StoryScenario.Check(); Drain();
                if (StoryScenario.IsDone("p3_labyrinth")) Fail("비경 전에 끝남");
                StoryScenario.OnRiftCleared(); Drain();
                if (!StoryScenario.IsDone("p3_labyrinth") || !Requests.Any(r => r.Scene.Id == "lab2")) Fail("3장이 비경 뒤 안 끝남");
                if (StoryLabyrinthState.MemoryShards != shards + 3) Fail($"기억 조각 +3 ({StoryLabyrinthState.MemoryShards - shards})");
                // 5장 = 3차 전직 (비경 뒤, 레벨 30 — 셋째 자리는 3차 전직을 해야 끝)
                if (!Requests.Any(r => r.Scene.Id == "job31") || StoryScenario.StepIndex != 1 || !StoryScenario.HudLine().Contains("3차")) Fail("3차 전직 단계 " + StoryScenario.StepIndex + " / " + StoryScenario.HudLine());
                if (StoryScenario.IsDone("p3_job")) Fail("3차 전직 전에 5장이 끝남");
                StoryJobState.Restore(30, 0f, "marshal");
                StoryScenario.Check(); Drain();
                if (!StoryScenario.IsDone("p3_job") || !Requests.Any(r => r.Scene.Id == "job32")) Fail("5장이 3차 전직 뒤 안 끝남");
                if (StoryScenario.AwardedTitles.Count != 3 || !StoryScenario.AwardedTitles[2].Contains("원수")) Fail("칭호 셋째 " + string.Join(",", StoryScenario.AwardedTitles));
                if (StoryScenario.Current() != null || StoryScenario.HudLine().Length != 0) Fail("다 끝난 뒤 줄");
                // 비경을 시작 전에 깬 것은 안 센다
                Fresh();
                StoryQuestState.Restore(StoryQuestState.KillGoal, StoryQuestState.BossGoal);
                StoryJobState.Restore(30, 0f, "warrior");
                StoryScenario.RestoreLegacy(25, true);
                StoryScenario.OnRiftCleared();
                StoryScenario.Check(); Drain();
                if (StoryScenario.IsDone("p3_labyrinth")) Fail("비경 단계 시작 전 완주가 셈에 들어감");
                parts.Add("진행(들판 밖 안 뜸·첫 사냥→두목→1장 끝·레벨 10 문턱·전직→칭호·레벨 15 문턱·2차 전직→칭호·레벨 30 문턱·비경 완주→기억 조각 +3·3차 전직→칭호·시작 전 완주는 안 셈)");
            }
            finally { PlayField.SetValue(null, saved); Pending.Clear(); }
        }

        private static void CheckLegacy(List<string> parts)
        {
            StoryScenario.RestoreLegacy(5, false);
            if (StoryScenario.DoneCount != 0) Fail("레벨 5 옛 세이브");
            StoryScenario.RestoreLegacy(10, false);
            if (!StoryScenario.IsDone("p1_field") || !StoryScenario.IsDone("p1_job") || StoryScenario.IsDone("p3_labyrinth")) Fail("레벨 10 옛 세이브");
            StoryScenario.RestoreLegacy(5, true);
            if (StoryScenario.DoneCount != 2) Fail("전직한 옛 세이브");
            StoryScenario.RestoreLegacy(25, false);
            if (StoryScenario.DoneCount != 3 || !StoryScenario.IsDone("p2_cave") || StoryScenario.IsDone("p3_labyrinth")) Fail("레벨 25 옛 세이브");
            StoryScenario.RestoreLegacy(45, true);
            if (StoryScenario.DoneCount != 5) Fail("레벨 45 옛 세이브");
            parts.Add("옛 세이브(레벨 5=없음·10=둘·전직=둘·25=셋·45=다섯 — 보상 없이)");
        }

        private static void CheckSave(List<string> parts)
        {
            Fresh();
            var saved = SwapToAuto();
            try
            {
                StoryScenario.InFieldForTest = true;
                StoryScenario.Check(); Drain();
                StoryQuestState.Restore(StoryQuestState.KillGoal, 0);
                StoryScenario.Check(); Drain();
                string json = StoryScenario.Snapshot();
                int step = StoryScenario.StepIndex; string ch = StoryScenario.ChapterId;
                StoryScenario.ResetForTest();
                StoryScenario.Restore(json);
                if (StoryScenario.StepIndex != step || StoryScenario.ChapterId != ch || !StoryScenario.HasSaid("field1")) Fail("왕복");
                string sj = StorySaveState.ToJson();
                if (!sj.Contains("scenarioJson")) Fail("세이브 필드");
                StoryScenario.ResetForTest();
                StoryScenario.InFieldForTest = false; // ApplyJson 이 쏘는 레벨 이벤트가 장면을 띄우지 않게
                StorySaveState.ApplyJson(sj);
                if (StoryScenario.StepIndex != step || !StoryScenario.HasSaid("field1")) Fail("StorySaveState 왕복");
                parts.Add("세이브(왕복·본 장면·StorySaveState 필드)");
            }
            finally { PlayField.SetValue(null, saved); Pending.Clear(); }
        }

        // ---- UI · 러너 ----------------------------------------------------------------------------------------

        private static void CheckUi(List<string> parts)
        {
            var ui = StoryScenarioUi.Instance;
            if (ui == null) { Fail("ui: 없음"); return; }
            Fresh();
            ui.Hide();
            StoryScenario.InFieldForTest = true;
            StoryScenario.Check(); // 러너의 진짜 신호 → UI
            if (!ui.IsOpen || ui.SceneId != "field1" || ui.LineIndex != 0) { Fail($"ui: 안 열림 {ui.IsOpen}/{ui.SceneId}"); return; }
            if (!ui.WhoText.Contains("척후병 소리") || ui.BodyText != StoryScenarioData.SceneOf("field1").Lines[0].Ko) Fail("ui: 첫 줄 " + ui.WhoText);
            if (!ui.TitleText.Contains("허창 들판")) Fail("ui: 제목 " + ui.TitleText);
            ui.Next();
            if (ui.LineIndex != 1 || !ui.WhoText.Contains(StoryLocalization.T("sscen.you", "나"))) Fail("ui: 둘째 줄 " + ui.WhoText);
            ui.NextButton.onClick.Invoke();
            ui.NextButton.onClick.Invoke();
            if (ui.LineIndex != 3) Fail("ui: 넷째 줄 " + ui.LineIndex);
            ui.Next();
            if (ui.IsOpen || !StoryScenario.HasSaid("field1")) Fail("ui: 닫힘");
            StoryQuestState.Restore(StoryQuestState.KillGoal, StoryQuestState.BossGoal);
            StoryScenario.Check();
            if (!ui.IsOpen || ui.SceneId != "field2") { Fail("ui: field2 " + ui.SceneId); return; }
            ui.SkipButton.onClick.Invoke();
            if (ui.IsOpen || !StoryScenario.HasSaid("field2") || !StoryScenario.IsDone("p1_field")) Fail("ui: 건너뛰기");
            parts.Add("장면 상자(열림·글·다음/건너뛰기·닫히면 본 장면·장 끝)");
        }

        private static void CheckRunner(StoryPlayerController pc, List<string> parts)
        {
            Fresh();
            StoryScenarioUi.Instance?.Hide();
            StoryScenario.InFieldForTest = null;
            if (!StoryScenario.InField()) Fail("runner: 들판에서 들판이 아님");
            StoryLabyrinthState.StartRun(20260824);
            bool inRun = StoryScenario.InField();
            StoryLabyrinthState.EndRun();
            if (inRun) Fail("runner: 비경 회차 중인데 들판");
            // 비경 완주 신호 — CompleteRun 은 플레이어를 돌려놓으므로 자리를 되돌린다
            var labyrinth = StoryLabyrinthRunner.Instance;
            if (labyrinth == null) { Fail("runner: 비경 러너 없음"); return; }
            Vector3 pos = pc.transform.position;
            int before = StoryScenario.Rifts;
            labyrinth.CompleteRun();
            pc.Teleport(pos);
            pc.Step(0.05f);
            if (StoryScenario.Rifts != before + 1) Fail("runner: 비경 완주 신호");
            parts.Add("러너(들판 판정·비경 회차 중엔 아님·비경 완주 신호)");
        }
    }
}
