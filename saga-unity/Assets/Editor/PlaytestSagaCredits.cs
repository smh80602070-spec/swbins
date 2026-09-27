using System;
using System.Collections.Generic;
using System.IO;
using Saga.Core;
using UnityEditor;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 110 ⑥ 진단 — 플레이 없이 도는 것만: ① 크레딧 점검 통과(표에 없는 빌드 에셋 0) ② 법적 고지 파일의 쓰인 출처·전문
    /// ③ 두 언어 머리 글 ④ 버전 코드 셈 ⑤ 오류 기록(같은 오류 합치기·다른 오류·다시 켜서 이어 읽기·지우기, 임시 파일).
    /// 크레딧 창 배치·여닫기는 `UiLayoutCheck`(타이틀 패널)가 잰다.
    /// `-executeMethod Saga.EditorTools.PlaytestSagaCredits.Run` → "[PlaytestSagaCredits] OK/FAIL"
    /// </summary>
    public static class PlaytestSagaCredits
    {
        private const string T = "[PlaytestSagaCredits]";

        [MenuItem("Saga/Playtest/Credits & Error Log (Headless)")]
        public static void Run()
        {
            var fails = new List<string>();
            var notes = new List<string>();
            try { Checks(fails, notes); }
            catch (Exception e) { fails.Add("예외 " + e); }
            finally { SagaCrashLog.Stop(); }
            string line = $"{T} {(fails.Count == 0 ? "OK" : "FAIL")} — {string.Join(" · ", notes)}";
            foreach (var f in fails) line += "\n  " + f;
            if (fails.Count == 0) Debug.Log(line); else Debug.LogError(line);
            if (Application.isBatchMode) EditorApplication.Exit(fails.Count == 0 ? 0 : 1);
        }

        private static void Checks(List<string> fails, List<string> notes)
        {
            // ① ②
            if (!SagaCreditsCheck.Check(out var summary)) fails.Add("크레딧 점검 " + summary);
            AssetDatabase.Refresh();
            var used = SagaCredits.UsedIds();
            foreach (var id in new[] { "noto", "unity", "polyhaven", "bgm" })
                if (!used.Contains(id)) fails.Add($"쓰인 출처에 {id} 없음 [{string.Join(",", used)}]");
            string legal = SagaCredits.LegalBody();
            if (legal.IndexOf("SIL OPEN FONT LICENSE", StringComparison.OrdinalIgnoreCase) < 0) fails.Add("고지에 OFL 전문 없음");
            if (legal.IndexOf("Apache License", StringComparison.Ordinal) < 0) fails.Add("고지에 Apache(glTFast) 전문 없음");
            if (legal.IndexOf("2014-2021 Adobe", StringComparison.Ordinal) < 0) fails.Add("고지에 Noto Sans KR 저작권 줄 없음");
            notes.Add($"출처 {used.Count} · 고지 {legal.Length / 1024}KB");

            // ③
            string ko = SagaCredits.Summary(false), en = SagaCredits.Summary(true);
            if (!ko.Contains("글꼴") || !en.Contains("Fonts")) fails.Add("머리 글 두 언어");
            foreach (var e in SagaCredits.Entries)
                if (!e.Own && !used.Contains(e.Id) && ko.Contains(e.TitleKo + "</color>")) fails.Add($"안 쓰인 출처가 화면에: {e.Id}");

            // ④
            if (SagaPlayerBuild.VersionCode("0.1.0") != 100 || SagaPlayerBuild.VersionCode("1.2.3") != 10203 || SagaPlayerBuild.VersionCode("1.2") != 0)
                fails.Add("버전 코드 셈");
            int code = SagaPlayerBuild.VersionCode(PlayerSettings.bundleVersion);
            if (code <= 0) fails.Add($"bundleVersion 형식 {PlayerSettings.bundleVersion}");
            if (PlayerSettings.Android.bundleVersionCode != code) fails.Add($"안드로이드 버전 코드 {PlayerSettings.Android.bundleVersionCode} ≠ {code}");
            notes.Add($"v{PlayerSettings.bundleVersion}({code})");

            // ⑤ — 진단이 일부러 내는 오류라 로그에 "[의도]" 를 붙인다.
            string path = Path.Combine(Path.GetTempPath(), "saga_error_log_test.txt");
            SagaCrashLog.StartForTest(path);
            for (int i = 0; i < 3; i++) Emit("[의도] 같은 오류");
            Debug.LogException(new InvalidOperationException("[의도] 다른 오류"));
            if (SagaCrashLog.Count != 2) fails.Add($"합친 기록 수 {SagaCrashLog.Count} (기대 2)");
            string text = SagaCrashLog.Read();
            if (!text.Contains("×3")) fails.Add("같은 오류 세 번이 ×3 으로 안 합쳐짐");
            if (!text.Contains("InvalidOperationException")) fails.Add("예외 이름이 기록에 없음");
            SagaCrashLog.StartForTest(path, keepFile: true); // 앱을 다시 켠 것처럼
            if (SagaCrashLog.Count != 2) fails.Add($"다시 켠 뒤 기록 수 {SagaCrashLog.Count} (기대 2)");
            Emit("[의도] 같은 오류");
            if (!SagaCrashLog.Read().Contains("×4")) fails.Add("다시 켠 뒤 같은 오류가 이어 합쳐지지 않음");
            SagaCrashLog.Clear();
            if (SagaCrashLog.Count != 0 || File.Exists(path)) fails.Add("지우기");
            notes.Add("오류 기록 합치기·이어 읽기·지우기");
        }

        private static void Emit(string msg) => Debug.LogError(msg);
    }
}
