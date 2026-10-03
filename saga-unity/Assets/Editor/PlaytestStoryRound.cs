using System;
using System.Linq;
using System.Text.RegularExpressions;
using TMPro;
using UnityEngine;
using Saga.Story.Data;
using Saga.Story.UI;
using Saga.Story.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// 회차(웹 사가스토리 §5-14 진단 항목, tasks U-0024) — `PlaytestStorySlice` 가 시나리오 진단 뒤에 부른다(플레이 중) · 혼자서도 돈다(`RunBatch`, 정적 규칙만).
    /// 수치 표(적 ×1.25/1.5/…최대 2.5 · 경험치 ×1.2/…최대 2.6 · 1회차는 정확히 ×1) · 이야기가 안 끝났거나 꺼졌거나 비경 안이거나 9회차면 막힘 ·
    /// 첫 회귀는 조건 없이 열림, 그다음은 처치 400 + 비경 1 이 더 있어야 · 회귀해도 레벨·전직·시나리오 기록은 불변 · 세이브 왕복과 옛 세이브(필드 없음 = 1회차) ·
    /// 플레이 중이면 적 체력이 2회차에 ×1.25 인지와 설정 패널 "🔁 회귀" 줄이 붙었는지. 끝나면 세이브 JSON·회차·최고 기록을 되돌린다.
    /// </summary>
    public static class PlaytestStoryRound
    {
        private const string T = "[PlaytestStoryRound]";
        private const string BestKey = "saga.story.bestRound";
        private static bool _ok;

        [UnityEditor.MenuItem("Saga/Playtest Story Round")]
        public static void RunBatch()
        {
            bool ok = Run();
            Debug.Log($"{T} {(ok ? "OK" : "FAIL")}");
            if (Application.isBatchMode) UnityEditor.EditorApplication.Exit(ok ? 0 : 1);
        }

        public static bool Run()
        {
            _ok = true;
            string json0 = StorySaveState.ToJson();
            string scen0 = StoryScenario.Snapshot();
            bool enabled0 = StoryScenario.Enabled;
            bool hadBest = PlayerPrefs.HasKey(BestKey);
            int best0 = PlayerPrefs.GetInt(BestKey, 1);
            try
            {
                StoryRound.ResetForTest();
                CheckTable();
                CheckRules();
                CheckStart();
                CheckSave();
                if (Application.isPlaying) CheckPlaying();
            }
            catch (Exception e) { Fail("예외 " + e); }
            finally
            {
                StoryRound.ResetForTest();
                StoryScenario.Enabled = enabled0;
                StorySaveState.ApplyJson(json0);
                StoryScenario.Restore(scen0);
                if (hadBest) PlayerPrefs.SetInt(BestKey, best0); else PlayerPrefs.DeleteKey(BestKey);
            }
            return _ok;
        }

        private static void Fail(string what) { _ok = false; Debug.LogError($"{T} FAIL {what}"); }
        private static void Check(bool cond, string what) { if (!cond) Fail(what); }
        private static bool Near(float a, float b) => Mathf.Abs(a - b) < 1e-4f;

        // 이야기를 다 본 상태로 만든다(모든 장 id 를 끝낸 것으로).
        private static void FinishStory()
        {
            var ids = StoryScenarioData.Chapters.Select(c => "\"" + c.Id + "\"");
            StoryScenario.Restore("{\"ch\":\"\",\"step\":0,\"rifts\":0,\"riftBase\":-1,\"killBase\":-1,\"bossBase\":-1,\"done\":[" + string.Join(",", ids) + "]}");
        }

        private static void CheckTable()
        {
            Check(Near(StoryRound.FoeMul(2), 1.25f) && Near(StoryRound.FoeMul(3), 1.5f) && Near(StoryRound.FoeMul(6), 2.25f), "적 배율 2·3·6회차 ×1.25/1.5/2.25");
            Check(Near(StoryRound.FoeMul(9), 2.5f) && Near(StoryRound.FoeMul(30), 2.5f), "적 배율 9회차·그 너머는 ×2.5 로 막힘");
            Check(Near(StoryRound.GainMul(2), 1.2f) && Near(StoryRound.GainMul(6), 2.0f) && Near(StoryRound.GainMul(9), 2.6f) && Near(StoryRound.GainMul(30), 2.6f), "경험치 배율 ×1.2/2.0/2.6");
            Check(StoryRound.Round == 1 && StoryRound.FoeMul() == 1f && StoryRound.GainMul() == 1f, "1회차 배율이 정확히 1 이 아님(기존 수치가 달라진다)");
        }

        private static void CheckRules()
        {
            StoryScenario.Enabled = false;
            Check(StoryRound.Why() != null && !StoryRound.CanNext, "이야기가 꺼졌는데 열림");
            StoryScenario.Enabled = true;

            StoryScenario.Restore("{\"done\":[]}");
            Check(StoryScenario.Current() != null && StoryRound.Why() != null, "이야기가 안 끝났는데 열림");

            FinishStory();
            Check(StoryScenario.Current() == null, "진단 준비: 이야기를 끝낸 상태가 안 됨");
            StoryRound.InRunForTest = true;
            Check(StoryRound.Why() != null, "비경 안인데 열림");
            StoryRound.InRunForTest = false;
            Check(StoryRound.Why() == null && StoryRound.CanNext, "이야기를 다 봤고 비경 밖인데 첫 회귀가 안 열림(첫 회귀는 조건 없음)");
            Check(StoryRound.GetProgress().First, "첫 회귀 진척이 First 가 아님");

            StoryRound.Restore(StoryRound.Max, 0, 0, true);
            Check(StoryRound.Why() != null && StoryRound.Round == StoryRound.Max, "9회차인데 더 열림");
            StoryRound.ResetForTest(); FinishStory(); StoryRound.InRunForTest = false;
        }

        private static void CheckStart()
        {
            int lv = StoryJobState.Level; string job = StoryJobState.Job; string scen = StoryScenario.Snapshot();
            StoryRound.KillsForTest = 1000; StoryRound.RiftsForTest = 3;
            Check(StoryRound.StartNext(false, out string why1) && why1 == null, "첫 회귀가 안 시작됨: " + why1);
            Check(StoryRound.Round == 2 && StoryRound.BaseKills == 1000 && StoryRound.BaseRifts == 3, $"첫 회귀 뒤 회차·기준점 {StoryRound.Round}/{StoryRound.BaseKills}/{StoryRound.BaseRifts}");
            Check(Near(StoryRound.FoeMul(), 1.25f) && Near(StoryRound.GainMul(), 1.2f), "2회차 현재 배율이 표와 다름");
            Check(StoryJobState.Level == lv && StoryJobState.Job == job && StoryScenario.Snapshot() == scen, "회귀가 레벨·전직·이야기 기록을 건드림");
            Check(PlayerPrefs.GetInt(BestKey, 1) >= 2, "최고 회차가 안 남음");

            // 곧바로 또 누르면 막힘 — 이번 회차 처치·비경이 모자란다
            Check(!StoryRound.CanNext && StoryRound.StartNext(false, out _) == false, "연달아 회귀가 열림");
            StoryRound.KillsForTest = 1399; StoryRound.RiftsForTest = 4;
            Check(!StoryRound.CanNext, "처치 399 인데 열림");
            StoryRound.KillsForTest = 1400; StoryRound.RiftsForTest = 3;
            Check(!StoryRound.CanNext, "비경 0 인데 열림");
            StoryRound.KillsForTest = 1400; StoryRound.RiftsForTest = 4;
            Check(StoryRound.CanNext, "처치 400 + 비경 1 인데 안 열림");
            Check(StoryRound.StartNext(false, out _) && StoryRound.Round == 3 && Near(StoryRound.FoeMul(), 1.5f), "둘째 회귀가 3회차(×1.5)가 안 됨");
            StoryRound.KillsForTest = null; StoryRound.RiftsForTest = null;
        }

        private static void CheckSave()
        {
            StoryRound.Restore(4, 120, 2, true);
            string json = StorySaveState.ToJson();
            Check(json.Contains("\"round\":4") && json.Contains("\"roundKills\":120") && json.Contains("\"roundRifts\":2"), "세이브 JSON 에 회차 필드가 없다");
            StoryRound.ResetForTest();
            Check(StorySaveState.ApplyJson(json) && StoryRound.Round == 4 && StoryRound.BaseKills == 120 && StoryRound.BaseRifts == 2, $"세이브 왕복 {StoryRound.Round}/{StoryRound.BaseKills}/{StoryRound.BaseRifts}");
            // 옛 세이브: 회차 필드가 아예 없다
            string old = Regex.Replace(json, ",\"round\":\\d+,\"roundKills\":\\d+,\"roundRifts\":\\d+", "");
            Check(old != json, "진단 준비: 옛 세이브 JSON 을 못 만듦");
            Check(StorySaveState.ApplyJson(old) && StoryRound.Round == 1 && StoryRound.BaseKills == -1 && StoryRound.BaseRifts == -1, "옛 세이브가 1회차·기준점 없음이 아님");
            StoryRound.ResetForTest();
        }

        // 플레이 중에만: 적 체력 배율과 설정 패널 줄.
        private static void CheckPlaying()
        {
            var go1 = new GameObject("RoundProbe1");
            var e1 = go1.AddComponent<StoryEnemy>();
            float hp1 = e1.Hp;
            UnityEngine.Object.DestroyImmediate(go1);
            StoryRound.Restore(2, 0, 0, true);
            var go2 = new GameObject("RoundProbe2");
            var e2 = go2.AddComponent<StoryEnemy>();
            float hp2 = e2.Hp;
            UnityEngine.Object.DestroyImmediate(go2);
            StoryRound.ResetForTest();
            Check(hp1 > 0f && Near(hp2, hp1 * 1.25f), $"2회차 적 체력 {hp2} (1회차 {hp1} ×1.25 여야)");

            var panel = UnityEngine.Object.FindFirstObjectByType<StorySettingsPanel>();
            if (panel != null)
            {
                bool row = panel.GetComponentsInChildren<TextMeshProUGUI>(true).Any(t => t.text.Contains("회차") || t.text.Contains("Round") || t.text.Contains("🔁"));
                Check(row, "설정 패널에 \"🔁 회귀\" 줄이 안 붙었다");
            }
        }
    }
}
