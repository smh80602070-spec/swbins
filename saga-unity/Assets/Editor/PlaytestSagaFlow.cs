using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using Saga.Core;
using Saga.Title;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 110 ② 흐름 진단 — 타이틀에서 진짜 버튼을 눌러 다섯 판을 **두 바퀴** 오간다(`-executeMethod`, `-quit` 없이).
    /// ① 타이틀: 카드 다섯·저장 없으면 이어하기 없음·옛 `UI.Text` 0·TMP 글꼴 Noto·기본값 다섯 떠 둠
    ///    + 설정(110 ⑤c): 언어 두 번(다섯 판·공통 UI 언어·타이틀 다시 짓기)·섞인 음량 → 다음 칸·배경음/효과음 — 판 설정 키는 떠 뒀다 끝에 되돌림
    /// ② 첫 바퀴(새로 시작): 판이 뜨고 흐름에 들어옴 → Ⅱ 단추로 일시정지(시간 멈춤·저장 단추·계속하기로 시간 되돌림) → 타이틀로(자동 저장 → 그 카드에 이어하기)
    /// ③ 둘째 바퀴(이어하기): 다시 들어가도 오류 없음, 사가블로에선 앱 일시정지 자동 저장
    /// ④ 새로 시작 되돌리기: 판마다 상태를 바꿔 둔 뒤 새로 시작 → 확인 창(취소는 그대로) → 지우고 시작 → 기본값과 같아짐·판 안에서도 기본값
    /// 도는 내내 오류·예외 로그 0. 진짜 세이브 다섯은 시작 때 떠 두고 끝에(실패해도) 되돌린다.
    /// </summary>
    public static class PlaytestSagaFlow
    {
        private const string T = "[PlaytestSagaFlow]";
        private const int WaitTicks = 8000;
        private const int SettleTicks = 90;
        private static readonly string[] Probe = { "gold", "gold", "fruitCount", "kills", "gold" }; // TitleScreen.Games 순서

        private static readonly Dictionary<string, byte[]> Backup = new Dictionary<string, byte[]>();
        private static readonly List<string> Notes = new List<string>();
        private static NestedCoroutine _run;
        private static bool _ok;
        private static bool _done;
        private static int _ticks;
        private static bool _origOptionsEnabled;
        private static EnterPlayModeOptions _origOptions;

        private static readonly string[] FileNames =
        {
            Saga.Go.Data.SaveState.FileName, Saga.Dungeon.Data.SaveState.FileName, Saga.Forest.Data.ForestSaveState.FileName,
            Saga.Story.Data.StorySaveState.FileName, Saga.Realm.Data.RealmSaveState.FileName,
        };

        [MenuItem("Saga/Playtest Saga Flow (Headless)")]
        /// <summary>두 JSON 이 처음 달라지는 자리 앞뒤 글(진단 메시지용).</summary>
        private static string FirstDiff(string a, string b)
        {
            a = a ?? ""; b = b ?? "";
            int i = 0;
            while (i < a.Length && i < b.Length && a[i] == b[i]) i++;
            string Cut(string s) => s.Substring(System.Math.Max(0, i - 40), System.Math.Min(s.Length - System.Math.Max(0, i - 40), 120));
            return $"처음 다른 자리 {i}: 지금 「{Cut(a)}」 / 기본 「{Cut(b)}」";
        }

        public static void Run()
        {
            _ok = true;
            _done = false;
            _ticks = 0;
            Notes.Clear();
            BackupSaves();
            SagaPrefsBackup.Backup(); // 타이틀 설정이 판 설정을 돌린다
            SagaPlayerBuild.SyncEditorBuildScenes();
            _origOptionsEnabled = EditorSettings.enterPlayModeOptionsEnabled;
            _origOptions = EditorSettings.enterPlayModeOptions;
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions = EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;
            EditorSceneManager.OpenScene(SagaFlow.TitleScenePath);
            Application.logMessageReceived += OnLog;
            EditorApplication.playModeStateChanged += OnState;
            EditorApplication.isPlaying = true;
        }

        private static void OnLog(string condition, string stack, LogType type)
        {
            if (type != LogType.Error && type != LogType.Exception) return;
            if (stack.Contains("UnityEditor.Search")) return;
            if (condition.StartsWith(T)) return;
            _ok = false;
            Debug.LogWarning($"{T} 오류 로그: {condition}");
        }

        private static void OnState(PlayModeStateChange s)
        {
            if (s == PlayModeStateChange.EnteredPlayMode)
            {
                _run = new NestedCoroutine(Script());
                EditorApplication.update += Tick;
            }
            else if (s == PlayModeStateChange.EnteredEditMode)
            {
                Application.logMessageReceived -= OnLog;
                EditorApplication.playModeStateChanged -= OnState;
                EditorSettings.enterPlayModeOptionsEnabled = _origOptionsEnabled;
                EditorSettings.enterPlayModeOptions = _origOptions;
                SetupSagaFonts.ResetDynamicFonts(); // 진단 중 동적 글꼴에 오른 글자를 비워 에셋을 늘 같게.
                RestoreSaves();
                SagaPrefsBackup.Restore();
                bool ok = _ok && _done;
                Debug.Log(ok
                    ? $"{T} OK - 타이틀·두 바퀴 다섯 판·일시정지·자동 저장·새로 시작 되돌리기·오류 0 | {string.Join(" · ", Notes)}"
                    : $"{T} FAIL - ok={_ok} done={_done} ticks={_ticks} | {string.Join(" · ", Notes)}");
                EditorApplication.Exit(ok ? 0 : 1);
            }
        }

        private static void Tick()
        {
            _ticks++;
            bool more;
            try { more = _run.Step(); }
            catch (System.Exception e)
            {
                Fail("진단 예외 " + e);
                more = false;
            }
            if (!more)
            {
                EditorApplication.update -= Tick;
                EditorApplication.isPlaying = false;
            }
        }

        private static IEnumerator Script()
        {
            // ① 타이틀
            yield return WaitTitle();
            var title = TitleScreen.Instance;
            if (title == null) { Fail("타이틀 안 뜸"); yield break; }
            if (title.NewButtons.Count != TitleScreen.Games.Length) Fail($"카드 {title.NewButtons.Count}");
            for (int i = 0; i < title.ContinueButtons.Count; i++) if (title.ContinueButtons[i] != null) Fail($"저장 없는데 이어하기 {i}");
            int legacy = Object.FindObjectsByType<UnityEngine.UI.Text>(FindObjectsSortMode.None).Length;
            var tmps = Object.FindObjectsByType<TMP_Text>(FindObjectsSortMode.None);
            if (legacy != 0) Fail($"타이틀에 옛 UI.Text {legacy}");
            if (tmps.Length == 0 || tmps[0].font == null || !tmps[0].font.name.Contains("NotoSansKR")) Fail("TMP 글꼴이 Noto Sans KR 아님");
            foreach (var g in TitleScreen.Games) if (!TitleScreen.HasDefaults(g.Key)) Fail($"{g.Key} 기본값 안 떠 둠");
            Notes.Add($"타이틀 TMP {tmps.Length}");

            // ①-2 타이틀 설정(110 ⑤c) — 진짜 단추로 언어·음량·배경음·효과음을 다섯 판에 한꺼번에
            yield return TitleSettingsCheck();

            // ② 첫 바퀴 — 새로 시작
            for (int i = 0; i < TitleScreen.Games.Length; i++)
            {
                var g = TitleScreen.Games[i];
                TitleScreen.Instance.NewButtons[i].onClick.Invoke();
                yield return WaitGame(g);
                if (SagaFlow.CurrentGame != g.Key) { Fail($"{g.Key} 안 들어옴"); yield break; }
                if (SagaFlowRunner.Instance == null) Fail($"{g.Key} 흐름 러너 없음");
                float ts = Time.timeScale;
                if (SagaPauseButton.Instance == null || !SagaPauseButton.Instance.Button.gameObject.activeInHierarchy)
                {
                    Fail($"{g.Key} 일시정지 단추 없음");
                    SagaPauseMenu.Open();
                }
                else SagaPauseButton.Instance.Button.onClick.Invoke(); // 110 ⑤c — 눈에 보이는 단추로 연다
                if (!SagaPauseMenu.IsOpen || Time.timeScale != 0f) Fail($"{g.Key} 일시정지 안 됨(ts {Time.timeScale})");
                var menu = SagaPauseMenu.Instance;
                if (!menu.TitleButton.gameObject.activeSelf) Fail($"{g.Key} 타이틀로 단추 숨음");
                menu.SaveButton.onClick.Invoke();
                if (menu.StatusText != "저장했다") Fail($"{g.Key} 메뉴 저장 '{menu.StatusText}'");
                menu.ResumeButton.onClick.Invoke();
                if (SagaPauseMenu.IsOpen || Time.timeScale != ts) Fail($"{g.Key} 계속하기가 시간을 안 되돌림({Time.timeScale})");
                SagaPauseMenu.Open();
                SagaPauseMenu.Instance.TitleButton.onClick.Invoke();
                yield return WaitTitle();
                if (TitleScreen.Instance == null) { Fail($"{g.Key} 뒤 타이틀 안 뜸"); yield break; }
                if (Time.timeScale != 1f) Fail($"{g.Key} 뒤 타이틀 시간 {Time.timeScale}");
                if (!g.HasSave() || TitleScreen.Instance.ContinueButtons[i] == null || SagaFlow.LastAutoSaveReason != "title")
                    Fail($"{g.Key} 타이틀로 자동 저장 안 됨({SagaFlow.LastAutoSaveReason})");
            }
            Notes.Add("첫 바퀴 5");

            // ③ 둘째 바퀴 — 이어하기
            for (int i = 0; i < TitleScreen.Games.Length; i++)
            {
                var g = TitleScreen.Games[i];
                TitleScreen.Instance.ContinueButtons[i].onClick.Invoke();
                yield return WaitGame(g);
                if (SagaFlow.CurrentGame != g.Key) { Fail($"{g.Key} 이어하기로 안 들어옴"); yield break; }
                if (g.Key == "dungeon")
                {
                    g.DeleteSave();
                    SagaFlowRunner.Instance.SendMessage("OnApplicationPause", true);
                    if (!g.HasSave() || SagaFlow.LastAutoSaveReason != "pause") Fail("앱 일시정지 자동 저장 안 됨");
                }
                SagaPauseMenu.Open();
                SagaPauseMenu.Instance.TitleButton.onClick.Invoke();
                yield return WaitTitle();
                if (TitleScreen.Instance == null) { Fail($"{g.Key} 둘째 바퀴 뒤 타이틀 안 뜸"); yield break; }
            }
            Notes.Add("둘째 바퀴 5");

            // ④ 새로 시작 되돌리기
            for (int i = 0; i < TitleScreen.Games.Length; i++)
            {
                var g = TitleScreen.Games[i];
                string def = TitleScreen.DefaultJson(g.Key);
                var m = Regex.Match(def ?? "", $"\"{Probe[i]}\":(-?\\d+)");
                if (!m.Success) { Fail($"{g.Key} 기본값에 {Probe[i]} 없음"); continue; }
                string mutated = Regex.Replace(def, $"\"{Probe[i]}\":-?\\d+", $"\"{Probe[i]}\":7777");
                g.ApplyJson(mutated);
                if (!g.ToJson().Contains($"\"{Probe[i]}\":7777")) Fail($"{g.Key} 상태 바꾸기 안 먹음");

                var t = TitleScreen.Instance;
                t.NewButtons[i].onClick.Invoke();
                if (!t.ConfirmOpen || !t.ConfirmText.Contains(g.Name)) Fail($"{g.Key} 확인 창 안 뜸");
                t.ConfirmNo.onClick.Invoke();
                if (t.ConfirmOpen || !g.HasSave() || SceneManager.GetActiveScene().name != SagaFlow.TitleSceneName) Fail($"{g.Key} 취소가 그대로 두지 않음");
                t.NewButtons[i].onClick.Invoke();
                t.ConfirmYes.onClick.Invoke();
                yield return WaitGame(g);
                if (!TitleScreen.LastResetMatched.TryGetValue(g.Key, out bool matched) || !matched) Fail($"{g.Key} 기본값으로 안 돌아감 — {(TitleScreen.LastResetDiff.TryGetValue(g.Key, out var diff) ? diff : "(차이 기록 없음)")}");
                if (!g.ToJson().Contains($"\"{Probe[i]}\":{m.Groups[1].Value}")) Fail($"{g.Key} 판 안에서 {Probe[i]} 가 기본값({m.Groups[1].Value}) 아님");
                SagaPauseMenu.Open();
                SagaPauseMenu.Instance.TitleButton.onClick.Invoke();
                yield return WaitTitle();
                if (TitleScreen.Instance == null) { Fail($"{g.Key} 새로 시작 뒤 타이틀 안 뜸"); yield break; }
            }
            Notes.Add("새로 시작 5");
            _done = true;
        }

        private static IEnumerator TitleSettingsCheck()
        {
            var t = TitleScreen.Instance;
            t.SettingsButton.onClick.Invoke();
            if (!t.SettingsOpen) { Fail("타이틀 설정 창 안 열림"); yield break; }

            string lang0 = TitleSettings.Language;
            t.LanguageButton.onClick.Invoke(); // 언어 → 타이틀을 새 언어로 다시 짓는다
            yield return null;
            t = TitleScreen.Instance;
            string lang1 = TitleSettings.Language;
            if (lang1 == lang0 || !TitleSettings.AllSameLanguage()) Fail($"언어가 다섯 판에 안 먹음({lang0}→{lang1})");
            if (SagaUi.Lang != (lang1 == "en" ? "en" : "ko")) Fail($"공통 UI 언어 {SagaUi.Lang} ≠ {lang1}");
            if (!t.SettingsOpen || t.NewButtons.Count != TitleScreen.Games.Length) Fail($"언어 바꾼 뒤 다시 짓기 이상(창 {t.SettingsOpen}·카드 {t.NewButtons.Count})");
            if (lang1 == "en" && SagaUi.Label(t.SettingsButton) != "Settings") Fail($"영어 타이틀 설정 단추 '{SagaUi.Label(t.SettingsButton)}'");
            int canvases = 0;
            foreach (var c in Object.FindObjectsByType<Canvas>(FindObjectsSortMode.None)) if (c.isRootCanvas && c.name == "TitleCanvas") canvases++;
            if (canvases != 1) Fail($"다시 지은 뒤 타이틀 캔버스 {canvases}");
            t.LanguageButton.onClick.Invoke();
            yield return null;
            t = TitleScreen.Instance;
            if (TitleSettings.Language != lang0 || !TitleSettings.AllSameLanguage()) Fail($"언어 되돌리기 {TitleSettings.Language}");
            if (lang0 == "ko" && SagaUi.Label(t.SettingsButton) != "설정") Fail($"한국어 타이틀 설정 단추 '{SagaUi.Label(t.SettingsButton)}'");

            // 음량 — 판 하나만 칸 사이 값이면 "판마다 다름", 누르면 다섯이 같은 다음 칸
            Saga.Dungeon.Audio.SfxPlayer.MasterVolume = 0.3f;
            t.ShowSettings(true);
            if (TitleSettings.AllSameVolume() || SagaUi.Label(t.VolumeButton) != SagaUi.L("판마다 다름", "Varies by game")) Fail($"섞인 음량 표시 '{SagaUi.Label(t.VolumeButton)}'");
            float v0 = TitleSettings.MasterVolume;
            t.VolumeButton.onClick.Invoke();
            float v1 = TitleSettings.MasterVolume;
            if (!TitleSettings.AllSameVolume() || v1 == v0 || System.Array.IndexOf(TitleSettings.VolumeSteps, v1) < 0) Fail($"음량 {v0}→{v1} 다섯 같음 {TitleSettings.AllSameVolume()}");
            if (SagaUi.Label(t.VolumeButton) != $"{Mathf.RoundToInt(v1 * 100f)}%") Fail($"음량 글 '{SagaUi.Label(t.VolumeButton)}'");

            bool bgm0 = TitleSettings.BgmOn, sfx0 = TitleSettings.SfxOn;
            t.BgmButton.onClick.Invoke();
            t.SfxButton.onClick.Invoke();
            if (TitleSettings.BgmOn == bgm0 || !TitleSettings.AllSameBgm()) Fail("배경음 끄고 켜기가 다섯 판에 안 먹음");
            if (TitleSettings.SfxOn == sfx0 || !TitleSettings.AllSameSfx()) Fail("효과음 끄고 켜기가 다섯 판에 안 먹음");
            t.BgmButton.onClick.Invoke();
            t.SfxButton.onClick.Invoke();
            if (TitleSettings.BgmOn != bgm0 || TitleSettings.SfxOn != sfx0) Fail("배경음·효과음 되돌리기");

            t.SettingsClose.onClick.Invoke();
            if (t.SettingsOpen) Fail("타이틀 설정 닫기");
            Notes.Add($"타이틀 설정 언어 {lang0}→{lang1}→{lang0}·음량 {v0:0.##}→{v1:0.##}");
        }

        private static IEnumerator WaitTitle()
        {
            for (int k = 0; k < WaitTicks; k++)
            {
                if (SceneManager.GetActiveScene().name == SagaFlow.TitleSceneName && TitleScreen.Instance != null) break;
                yield return null;
            }
            for (int k = 0; k < 10; k++) yield return null;
        }

        private static IEnumerator WaitGame(TitleScreen.Game g)
        {
            int k = 0;
            for (; k < WaitTicks; k++)
            {
                if (SceneManager.GetActiveScene().name == g.Scene && SagaFlow.CurrentGame == g.Key) break;
                yield return null;
            }
            if (k >= WaitTicks) Fail($"{g.Key} 씬 {g.Scene} 안 뜸");
            for (int s = 0; s < SettleTicks; s++) yield return null;
        }

        private static void BackupSaves()
        {
            Backup.Clear();
            foreach (var f in FileNames)
            {
                string p = Path.Combine(Application.persistentDataPath, f);
                Backup[p] = File.Exists(p) ? File.ReadAllBytes(p) : null;
                if (File.Exists(p)) File.Delete(p);
            }
        }

        private static void RestoreSaves()
        {
            foreach (var kv in Backup)
            {
                try
                {
                    if (kv.Value != null) File.WriteAllBytes(kv.Key, kv.Value);
                    else if (File.Exists(kv.Key)) File.Delete(kv.Key);
                }
                catch (System.Exception e) { Debug.LogWarning($"{T} 세이브 되돌리기 실패 {kv.Key}: {e.Message}"); }
            }
            Notes.Add($"세이브 되돌림 {Backup.Count}");
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogWarning($"{T} FAIL - {why}");
        }
    }
}
