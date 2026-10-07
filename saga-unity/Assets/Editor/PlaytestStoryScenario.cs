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
    /// PLAN.md 109-16 사가종횡 시나리오 「이름 없는 떠돌이」 진단 — `PlaytestStorySlice` 가 부른다.
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
                CheckThresholds(parts);
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
            string[] ids = { "p1_field", "p1_job", "p2_port", "p2_forest", "p2_namjeong", "p2_cave", "p3_gisan", "p3_gorge", "p3_labyrinth", "p3_job",
                "p4_luoyang", "p4_depth", "p4_gate", "p4_name", "p5_past", "p5_now", "p5_future" };
            int[] needs = { 1, 10, 10, 10, 12, 15, 17, 20, 22, 25, 26, 28, 29, 30, 30, 30, 30 };
            if (ch.Length != ids.Length) Fail($"장 {ids.Length} ({ch.Length})");
            for (int k = 0; k < ids.Length && k < ch.Length; k++)
            {
                if (ch[k].Id != ids[k]) Fail($"장 순서 {k} {ch[k].Id}");
                if (ch[k].Need != needs[k]) Fail($"{ids[k]} 문턱 레벨 {ch[k].Need}");
                if (ch[k].After != (k == 0 ? null : ids[k - 1])) Fail($"{ids[k]} 잇는 순서 {ch[k].After}");
                if (ch[k].No != k + 1) Fail($"{ids[k]} 번호");
                if (ch[k].Steps.Length == 0) Fail($"{ids[k]} 단계 없음");
            }
            if (StoryScenarioData.Scenes.Length != 29) Fail($"장면 {StoryScenarioData.Scenes.Length}");
            if (StoryScenarioData.ChapterOf("p2_port").Steps[1].T != "gate" || StoryScenarioData.ChapterOf("p2_cave").Steps[1].N != 2 || StoryScenarioData.ChapterOf("p3_job").Steps[1].N != 3 || StoryScenarioData.ChapterOf("p4_name").Steps[1].N != 4) Fail("관문·전직 차수 단계");
            foreach (var c in ch)
            {
                foreach (var st in c.Steps)
                {
                    if (st.T == "talk" && string.IsNullOrEmpty(st.By) && StoryScenarioData.SceneOf(st.Scene) == null) Fail($"장면 {st.Scene} 없음");
                    if (st.T == "talk" && !string.IsNullOrEmpty(st.By))
                        foreach (var o in StoryScenarioData.Scenes.First(x => x.Choice != null && x.Choice.Id == st.By).Choice.Options)
                            if (StoryScenarioData.SceneOf(st.Scene + "_" + o.Key) == null) Fail($"고르기 장면 {st.Scene}_{o.Key} 없음");
                    if (st.T != "talk" && st.T != "mission" && st.T != "job" && st.T != "gate" && st.T != "kills" && st.T != "boss" && st.T != "rift") Fail("단계 종류 " + st.T);
                    if ((st.T == "kills" || st.T == "boss" || st.T == "job") && st.N < 1) Fail($"{c.Id} {st.T} 수");
                }
            }
            foreach (var sc in StoryScenarioData.Scenes)
            {
                if (StoryScenarioData.ChapterOf(sc.ChapterId) == null) Fail($"장면 {sc.Id} 장");
                foreach (var l in sc.Lines) if (l.Who != "me" && StoryScenarioData.CastOf(l.Who) == null) Fail($"장면 {sc.Id} 말하는 이 {l.Who}");
                if (sc.Choice != null && (sc.Choice.Options.Length < 2 || sc.Choice.Options.Length > 3)) Fail($"장면 {sc.Id} 답 수");
            }
            var byId = StoryScenarioData.Chapters.ToDictionary(x => x.Id);
            if (!byId["p1_job"].JobTitle || !byId["p2_cave"].JobTitle || !byId["p3_job"].JobTitle || !byId["p4_name"].JobTitle || byId["p3_labyrinth"].Shards != 3
                || byId["p1_field"].Exp != 400 || byId["p2_port"].Exp != 1200 || byId["p2_cave"].Exp != 4000 || byId["p3_job"].Exp != 40000 || byId["p5_future"].Exp != 600000) Fail("보상");
            parts.Add("표(열일곱·문턱 1/10/10/10/12/15/17/20/22/25/26/28/29/30…·잇는 순서·장면 스물아홉·관문·전직 차수·고르기 둘·보상)");
        }

        private static void CheckTexts(List<string> parts)
        {
            int miss = 0;
            void Need(string key) { if (StoryLocalization.T(key, "\u0001") == "\u0001") { miss++; if (miss < 4) Debug.LogError($"{T} 글 키 없음 {key}"); } }
            foreach (var c in StoryScenarioData.Casts) Need($"sscen.cast.{c.Id}");
            foreach (var c in StoryScenarioData.Chapters) { Need($"sscen.ch.{c.Id}.title"); Need($"sscen.ch.{c.Id}.blurb"); }
            foreach (var s in StoryScenarioData.Scenes)
            {
                for (int i = 0; i < s.Lines.Length; i++) Need($"sscen.scene.{s.Id}.{i}");
                if (s.Choice == null) continue;
                Need($"sscen.choice.{s.Choice.Id}.prompt");
                foreach (var o in s.Choice.Options) { Need($"sscen.choice.{s.Choice.Id}.{o.Key}"); if (o.TitleKo != null) Need($"sscen.choice.{s.Choice.Id}.{o.Key}.title"); }
            }
            foreach (var k in new[] { "sscen.hint.kills", "sscen.hint.boss_n", "sscen.hint.gate", "sscen.hint.job_n" }) Need(k);
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
            StorySaveState.ResetChampionForTest(); // 관문 대장 단계가 처음엔 안 채워져 있게
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
                // 3장(관문 대장) — 레벨 10, 이번엔 관문 대장을 아직 못 이긴 채
                if (!Requests.Any(r => r.Scene.Id == "port1") || StoryScenario.StepIndex != 1 || !StoryScenario.HudLine().Contains("관문 대장")) Fail("관문 단계 " + StoryScenario.StepIndex + " / " + StoryScenario.HudLine());
                if (StoryScenario.IsDone("p2_port")) Fail("관문 대장 전에 3장이 끝남");
                StorySaveState.ClaimChampion();
                StoryScenario.Check(); Drain();
                if (!StoryScenario.IsDone("p2_port") || !Requests.Any(r => r.Scene.Id == "port2")) Fail("3장이 관문 대장 뒤 안 끝남");
                // 4장(잡졸 20 — 단계가 시작된 뒤 것만) · 5장(레벨 12, 전직은 이미 함)
                StoryScenario.Check(); Drain();
                if (StoryScenario.ChapterId != "p2_forest" || StoryScenario.StepIndex != 0 || !StoryScenario.HudLine().Contains("0/20")) Fail("잡졸 단계 " + StoryScenario.ChapterId + " / " + StoryScenario.HudLine());
                for (int k = 0; k < 19; k++) StoryQuestState.AddKill();
                StoryScenario.Check(); Drain();
                if (StoryScenario.StepIndex != 0 || !StoryScenario.HudLine().Contains("19/20")) Fail("잡졸 19 " + StoryScenario.HudLine());
                StoryQuestState.AddKill();
                StoryScenario.Check(); Drain();
                if (!StoryScenario.IsDone("p2_forest") || !Requests.Any(r => r.Scene.Id == "forest2")) Fail("4장이 잡졸 20 뒤 안 끝남");
                StoryJobState.Restore(12, 0f, "warrior");
                StoryScenario.Check(); Drain();
                if (!StoryScenario.IsDone("p2_namjeong") || !Requests.Any(r => r.Scene.Id == "nam2")) Fail("5장(전직 이미 함)이 안 끝남");
                // 6장(2차 전직)은 레벨 15 부터 — 이름 없는 채로 둘째 자리
                StoryJobState.Restore(15, 0f, "warrior");
                StoryScenario.Check(); Drain();
                if (!Requests.Any(r => r.Scene.Id == "cave1") || StoryScenario.StepIndex != 1 || !StoryScenario.HudLine().Contains("2차")) Fail("2차 전직 단계 " + StoryScenario.StepIndex + " / " + StoryScenario.HudLine());
                if (StoryScenario.IsDone("p2_cave")) Fail("전직 전에 6장이 끝남");
                StoryJobState.Restore(15, 0f, "general");
                StoryScenario.Check(); Drain();
                if (!StoryScenario.IsDone("p2_cave") || !Requests.Any(r => r.Scene.Id == "cave2")) Fail("6장이 2차 전직 뒤 안 끝남");
                if (StoryScenario.AwardedTitles.Count != 2 || !StoryScenario.AwardedTitles[1].Contains("장군")) Fail("칭호 둘째 " + string.Join(",", StoryScenario.AwardedTitles));
                // 7장 이야기만(레벨 18) · 8장 잡졸 30 → 두목 → 이야기(레벨 22)
                StoryJobState.Restore(18, 0f, "general");
                StoryScenario.Check(); Drain();
                if (!StoryScenario.IsDone("p3_gisan") || !Requests.Any(r => r.Scene.Id == "gisan2")) Fail("7장 이야기만 안 끝남");
                StoryJobState.Restore(22, 0f, "general");
                StoryScenario.Check(); Drain();
                if (StoryScenario.ChapterId != "p3_gorge" || StoryScenario.StepIndex != 0) Fail("gorge 시작 " + StoryScenario.ChapterId + StoryScenario.StepIndex);
                for (int k = 0; k < 30; k++) StoryQuestState.AddKill();
                StoryScenario.Check(); Drain();
                if (StoryScenario.StepIndex != 1 || !StoryScenario.HudLine().Contains("두목")) Fail("gorge 두목 단계 " + StoryScenario.StepIndex + " / " + StoryScenario.HudLine());
                StoryScenario.Check(); Drain();
                if (StoryScenario.IsDone("p3_gorge")) Fail("두목 전에 8장이 끝남");
                StoryQuestState.AddBossKill();
                StoryScenario.Check(); Drain();
                if (!StoryScenario.IsDone("p3_gorge") || !Requests.Any(r => r.Scene.Id == "gorge2")) Fail("8장이 두목 뒤 안 끝남");
                // 9장(비경)은 레벨 30 부터
                StoryJobState.Restore(30, 0f, "general");
                int shards = StoryLabyrinthState.MemoryShards;
                StoryScenario.Check(); Drain();
                if (!Requests.Any(r => r.Scene.Id == "lab1") || StoryScenario.StepIndex != 1 || !StoryScenario.HudLine().Contains("비경")) Fail("비경 단계 " + StoryScenario.StepIndex);
                StoryScenario.Check(); Drain();
                if (StoryScenario.IsDone("p3_labyrinth")) Fail("비경 전에 끝남");
                StoryScenario.OnRiftCleared(); Drain();
                if (!StoryScenario.IsDone("p3_labyrinth") || !Requests.Any(r => r.Scene.Id == "lab2")) Fail("9장이 비경 뒤 안 끝남");
                if (StoryLabyrinthState.MemoryShards != shards + 3) Fail($"기억 조각 +3 ({StoryLabyrinthState.MemoryShards - shards})");
                // 10장 = 3차 전직 (비경 뒤, 레벨 30 — 셋째 자리는 3차 전직을 해야 끝)
                if (!Requests.Any(r => r.Scene.Id == "job31") || StoryScenario.StepIndex != 1 || !StoryScenario.HudLine().Contains("3차")) Fail("3차 전직 단계 " + StoryScenario.StepIndex + " / " + StoryScenario.HudLine());
                if (StoryScenario.IsDone("p3_job")) Fail("3차 전직 전에 10장이 끝남");
                StoryJobState.Restore(30, 0f, "marshal");
                StoryScenario.Check(); Drain();
                if (!StoryScenario.IsDone("p3_job") || !Requests.Any(r => r.Scene.Id == "job32")) Fail("10장이 3차 전직 뒤 안 끝남");
                if (StoryScenario.AwardedTitles.Count != 3 || !StoryScenario.AwardedTitles[2].Contains("원수")) Fail("칭호 셋째 " + string.Join(",", StoryScenario.AwardedTitles));
                // 11장 낙양(잡졸 40 → 두목) · 12장 검각(잡졸 50) · 13장 문(두목 → 고르기) · 14장 이름(4차 전직 → 칭호 고르기 → 결말) · 15~17장 문 너머(잡졸 60 → 두목)
                StoryScenario.Choose("gate", "keep"); // 웹 결말이 갈리는 답 — 장면 스스로 고르는 자리는 CheckUi 가 본다
                StoryScenario.Choose("name", "wander");
                for (int k = 0; k < 40; k++) StoryQuestState.AddKill();
                StoryScenario.Check(); Drain();
                StoryQuestState.AddBossKill();
                StoryScenario.Check(); Drain();
                if (!StoryScenario.IsDone("p4_luoyang") || !Requests.Any(r => r.Scene.Id == "luoyang2")) Fail("11장이 안 끝남 " + StoryScenario.ChapterId + StoryScenario.StepIndex);
                for (int k = 0; k < 50; k++) StoryQuestState.AddKill();
                StoryScenario.Check(); Drain();
                if (!StoryScenario.IsDone("p4_depth") || !Requests.Any(r => r.Scene.Id == "depth2")) Fail("12장이 안 끝남 " + StoryScenario.ChapterId + StoryScenario.StepIndex);
                StoryQuestState.AddBossKill();
                StoryScenario.Check(); Drain();
                if (!StoryScenario.IsDone("p4_gate") || !Requests.Any(r => r.Scene.Id == "gate1") || !Requests.Any(r => r.Scene.Id == "gate2")) Fail("13장이 안 끝남 " + StoryScenario.ChapterId + StoryScenario.StepIndex);
                if (StoryScenario.ChapterId != null && StoryScenario.ChapterId != "p4_name") Fail("14장으로 안 넘어감 " + StoryScenario.ChapterId);
                if (!Requests.Any(r => r.Scene.Id == "name1") || StoryScenario.StepIndex != 1 || !StoryScenario.HudLine().Contains("4차")) Fail("4차 전직 단계 " + StoryScenario.StepIndex + " / " + StoryScenario.HudLine());
                StoryJobState.Restore(30, 0f, "warlord");
                StoryScenario.Check(); Drain();
                if (!StoryScenario.IsDone("p4_name") || !Requests.Any(r => r.Scene.Id == "name2") || !Requests.Any(r => r.Scene.Id == "name3_keep") || Requests.Any(r => r.Scene.Id == "name3_close")) Fail("14장이 고른 답(지킨다)대로 안 끝남");
                if (!StoryScenario.AwardedTitles.Any(t => t.Contains("문 너머의 나그네")) || !StoryScenario.AwardedTitles.Any(t => t.Contains("전신"))) Fail("칭호(고른 것·직업) " + string.Join(",", StoryScenario.AwardedTitles));
                for (int n = 0; n < 3; n++)
                {
                    string id = new[] { "p5_past", "p5_now", "p5_future" }[n];
                    for (int k = 0; k < 60; k++) StoryQuestState.AddKill();
                    StoryScenario.Check(); Drain();
                    StoryQuestState.AddBossKill();
                    StoryScenario.Check(); Drain();
                    if (!StoryScenario.IsDone(id)) Fail(id + " 이 안 끝남 " + StoryScenario.ChapterId + StoryScenario.StepIndex);
                }
                if (!Requests.Any(r => r.Scene.Id == "beyond1") || !Requests.Any(r => r.Scene.Id == "beyond2") || !Requests.Any(r => r.Scene.Id == "beyond3_keep") || Requests.Any(r => r.Scene.Id == "beyond3_close")) Fail("문 너머 장면(지킨다 결말)");
                if (StoryScenario.Current() != null || StoryScenario.HudLine().Length != 0) Fail("다 끝난 뒤 줄");
                // 고르기 기록은 세이브 왕복에서 남는다
                string blob = StoryScenario.Snapshot();
                StoryScenario.ResetForTest(); StoryScenario.InFieldForTest = true;
                StoryScenario.Restore(blob);
                if (StoryScenario.ChoiceOf("gate") != "keep" || StoryScenario.ChoiceOf("name") != "wander" || !StoryScenario.IsDone("p5_future")) Fail("고르기·장 세이브 왕복");
                // 비경을 시작 전에 깬 것은 안 센다
                Fresh();
                StoryQuestState.Restore(StoryQuestState.KillGoal, StoryQuestState.BossGoal);
                StoryJobState.Restore(30, 0f, "warrior");
                StoryScenario.RestoreLegacy(25, true);
                StoryScenario.OnRiftCleared();
                StoryScenario.Check(); Drain();
                if (StoryScenario.IsDone("p3_labyrinth")) Fail("비경 단계 시작 전 완주가 셈에 들어감");
                parts.Add("진행(열일곱 장 처음부터 끝·잡졸 N/두목 단계·고른 답 결말·전직 4차·레벨 10 문턱·전직→칭호·관문 대장 단계→3장 끝·레벨 15 문턱·2차 전직→칭호·레벨 30 문턱·비경 완주→기억 조각 +3·3차 전직→칭호·시작 전 완주는 안 셈)");
            }
            finally { PlayField.SetValue(null, saved); Pending.Clear(); }
        }

        /// <summary>레벨 문턱 — 앞 장을 다 끝낸 세이브에서 문턱 레벨 -1 이면 그 장이 안 열리고 안내 줄에 문턱이 뜬다(장 보상 경험치가 레벨을 올려서 진행 흐름 안에선 못 본다).</summary>
        private static void CheckThresholds(List<string> parts)
        {
            var ch = StoryScenarioData.Chapters;
            var saved = SwapToAuto();
            int checkedCount = 0;
            try
            {
                for (int i = 1; i < ch.Length; i++)
                {
                    if (ch[i].Need <= 1) continue;
                    Fresh();
                    StoryScenario.InFieldForTest = true;
                    var done = new List<string>();
                    for (int k = 0; k < i; k++) done.Add("\"" + ch[k].Id + "\"");
                    StoryScenario.Restore("{\"ch\":\"\",\"step\":0,\"rifts\":0,\"riftBase\":-1,\"killBase\":-1,\"bossBase\":-1,\"done\":[" + string.Join(",", done) + "],\"said\":[],\"titles\":[],\"choiceIds\":[],\"choiceKeys\":[]}");
                    StoryJobState.Restore(ch[i].Need - 1, 0f, "warlord");
                    StoryScenario.Check(); Drain();
                    if (StoryScenario.ChapterId == ch[i].Id || StoryScenario.IsDone(ch[i].Id) || Requests.Count != 0) Fail($"{ch[i].Id} 이 문턱({ch[i].Need}) 전에 열림 {StoryScenario.ChapterId}");
                    if (!StoryScenario.HudLine().Contains(ch[i].Need.ToString())) Fail($"{ch[i].Id} 문턱 안내 " + StoryScenario.HudLine());
                    StoryJobState.Restore(ch[i].Need, 0f, "warlord");
                    StoryScenario.Check(); Drain();
                    if (StoryScenario.ChapterId != ch[i].Id && !StoryScenario.IsDone(ch[i].Id)) Fail($"{ch[i].Id} 이 문턱 레벨에 안 열림 {StoryScenario.ChapterId}");
                    checkedCount++;
                }
            }
            finally { PlayField.SetValue(null, saved); Pending.Clear(); }
            parts.Add($"문턱(장 {checkedCount}개 — 문턱 −1 은 안 열리고 안내 줄에 레벨·문턱 레벨은 열림)");
        }

        private static void CheckLegacy(List<string> parts)
        {
            StoryScenario.RestoreLegacy(5, false);
            if (StoryScenario.DoneCount != 0) Fail("레벨 5 옛 세이브");
            StoryScenario.RestoreLegacy(10, false);
            if (!StoryScenario.IsDone("p1_field") || !StoryScenario.IsDone("p1_job") || StoryScenario.IsDone("p3_labyrinth")) Fail("레벨 10 옛 세이브");
            StoryScenario.RestoreLegacy(5, true);
            if (StoryScenario.DoneCount != 2) Fail("전직한 옛 세이브 " + StoryScenario.DoneCount);
            StoryScenario.RestoreLegacy(25, false);
            if (StoryScenario.DoneCount != 6 || !StoryScenario.IsDone("p2_cave") || !StoryScenario.IsDone("p2_port") || !StoryScenario.IsDone("p2_forest") || StoryScenario.IsDone("p3_gisan") || StoryScenario.IsDone("p3_labyrinth")) Fail("레벨 25 옛 세이브 " + StoryScenario.DoneCount);
            StoryScenario.RestoreLegacy(45, true);
            if (StoryScenario.DoneCount != 10 || StoryScenario.IsDone("p4_luoyang")) Fail("레벨 45 옛 세이브 " + StoryScenario.DoneCount);
            StoryScenario.RestoreLegacy(70, true);
            if (StoryScenario.DoneCount != 14 || StoryScenario.IsDone("p5_past")) Fail("레벨 70 옛 세이브 " + StoryScenario.DoneCount);
            parts.Add("옛 세이브(레벨 5=없음·10=둘·전직=둘·25=여섯·45=열·70=열넷 — 문 너머 셋은 안 지나감·보상 없이)");
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
            // 장면 끝 고르기 — 마지막 줄에서 답 단추가 뜨고(다음 단추는 숨음·탭은 안 닫음), 누르면 답이 적히며 닫힌다. 건너뛰기는 첫 답.
            Fresh();
            ui.Hide();
            var gate2 = StoryScenarioData.SceneOf("gate2");
            ui.Play(new StoryScenario.SceneRequest { Scene = gate2, Title = "t" });
            if (ui.Choosing || ui.ChoiceCount != 0) Fail("ui: 첫 줄에 고르기가 뜸");
            while (ui.LineIndex < gate2.Lines.Length - 1) ui.Next();
            if (!ui.Choosing || ui.ChoiceCount != 2 || ui.NextButton.gameObject.activeSelf || !ui.ChoiceButton(0).gameObject.activeSelf || ui.ChoiceButton(2).gameObject.activeSelf) Fail("ui: 고르기 단추");
            if (!ui.PromptText.Contains(StoryScenario.ChoicePrompt(gate2.Choice)) || !ui.ChoiceButton(1).GetComponentInChildren<TMPro.TextMeshProUGUI>().text.Contains(StoryScenario.ChoiceLabel(gate2.Choice, gate2.Choice.Options[1]))) Fail("ui: 고르기 글");
            ui.Next(); // 탭·Space 는 고르기를 안 닫는다
            if (!ui.IsOpen) Fail("ui: 고르기가 탭으로 닫힘");
            ui.ChoiceButton(1).onClick.Invoke();
            if (ui.IsOpen || StoryScenario.ChoiceOf("gate") != "keep" || !StoryScenario.HasSaid("gate2")) Fail("ui: 답 기록 " + StoryScenario.ChoiceOf("gate"));
            Fresh();
            ui.Hide();
            var name2 = StoryScenarioData.SceneOf("name2");
            ui.Play(new StoryScenario.SceneRequest { Scene = name2, Title = "t" });
            while (ui.LineIndex < name2.Lines.Length - 1) ui.Next();
            if (ui.ChoiceCount != 3 || !ui.ChoiceButton(2).gameObject.activeSelf) Fail("ui: 칭호 고르기 셋");
            ui.SkipButton.onClick.Invoke();
            if (ui.IsOpen || StoryScenario.ChoiceOf("name") != "found" || StoryScenario.AwardedTitles.Count != 1) Fail("ui: 건너뛰면 첫 답 " + StoryScenario.ChoiceOf("name"));
            parts.Add("고르기(마지막 줄에만·탭은 안 닫음·답 기록·건너뛰면 첫 답·칭호)");
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
