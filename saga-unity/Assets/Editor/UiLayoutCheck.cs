using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 110 ⑤b 배치 점검 — 타이틀·다섯 판을 플레이로 켜고(첫 화면 = HUD) 화면비 셋(16:9·20:9·4:3)마다
    /// 보이는 UI 의 **실제 발자국**(TMP 는 그려진 글자 범위, 나머지는 사각형)을 화면 픽셀로 재서
    /// ① 서로 다른 위젯끼리 겹침 ② 화면 밖으로 나감 을 센다. 배치 모드는 화면이 없어, 잴 때만 루트 캔버스를
    /// 월드 공간으로 돌려 그 화면비의 논리 크기(CanvasScaler 식 그대로)를 입힌 뒤 되돌린다.
    ///
    /// - 위젯 = 캔버스(또는 꽉 찬 투명 틀) 바로 밑 덩어리. 한 위젯 안의 겹침(버튼 위 글자 등)은 설계라 안 센다.
    /// - 모달(화면 30% 넘는 판을 가진 위젯)은 다른 위젯과의 겹침에서 뺀다 — 일부러 위를 덮는다.
    /// - **패널(110 ⑤c-2)**: 첫 화면을 잰 뒤 보이는 단추를 하나씩 눌러(타이틀은 설정만) 새로 나타난 그래픽이 셋 이상이면
    ///   그것만 세 화면비로 잰다 — 단위는 단추(안의 글자·그림 포함)·단추 밖 글자, 단추 밖 그림(판·띠·아이콘)은 뺀다.
    ///   닫기는 새 것 중 닫기·확인 류 단추 → 일시정지 메뉴 → 연 단추 한 번 더. 스크롤 마스크 밖은 잘라 낸다.
    /// - **패널 속 패널(⑤c-2b)**: 판 패널 안의 단추(닫기 류 빼고, 패널마다 <see cref="MaxSubPresses"/> 까지)를 또 눌러 둘째 단계
    ///   (탭·목표 고르기 등)가 뜨면 같은 식으로 잰다 — 같은 모양(새 그래픽 이름 묶음)은 한 번만. 누르면 설정 값도 도니
    ///   판 설정 PlayerPrefs 는 `SagaPrefsBackup` 으로 떠 뒀다 되돌린다.
    /// - **상태(⑤c-3)**: 단추로는 안 열리고 놀다가 켜지는 것 — GO 들판 전투 명단 넷·폭발 준비·지역 사명 줄, 옛 결투 셋(결투 중엔
    ///   들판 전투 HUD 가 숨는다)·조우 알림 셋·승급 3택 / DUNGEON 축복 3택·시련 카드·지역 배너 / FOREST 밀어내기 / STORY 전직·선택 /
    ///   REALM 알림 / 판마다 긴 대사 줄. 알림·고르기는 패널처럼 새로 뜬 것만, 나머지는 화면 전체를 다시 잰다(늘 있는 HUD 와 겹치면 문제).
    ///   `-uiHidden` 이면 재지 않고 판마다 첫 화면에 숨은 UI 목록만 쓴다(새 상태를 찾을 때).
    /// - 세이브는 백업했다 되돌린다. 결과 "[UiLayoutCheck] OK/FAIL", 자세한 목록은 `Logs/ui_layout_report.txt`.
    /// `-executeMethod Saga.EditorTools.UiLayoutCheck.Run`
    /// </summary>
    public static class UiLayoutCheck
    {
        private const string T = "[UiLayoutCheck]";
        public const string ReportPath = "Logs/ui_layout_report.txt";

        public static readonly (string name, int w, int h)[] Screens =
        {
            ("16:9", 1920, 1080),
            ("20:9", 2400, 1080),
            ("4:3", 1440, 1080),
        };

        private static readonly string[] Scenes = SagaPlayerBuild.Scenes;

        private static NestedCoroutine _run;
        private static int _panels, _subPanels;
        private const int MaxSubPresses = 40;
        private static readonly List<string> Unclosed = new List<string>();
        // 110 ⑤c-2c — 영어 바퀴에 보이는 한글 글(번역 표를 안 거친 HUD·대사). 지금은 세기만(문제로 안 셈).
        private static string _lang = "ko";
        private static readonly SortedDictionary<string, int> HangulBy = new SortedDictionary<string, int>();
        private static readonly StringBuilder HangulLines = new StringBuilder();
        private static readonly StringBuilder Report = new StringBuilder();
        private static readonly StringBuilder Map = new StringBuilder();
        private static readonly List<string> Summary = new List<string>();
        private static int _issues;
        private static bool _done;
        private static readonly Dictionary<string, byte[]> SaveBackup = new Dictionary<string, byte[]>();
        private static bool _origOptionsEnabled;
        private static EnterPlayModeOptions _origOptions;

        [MenuItem("Saga/Check/UI Layout (3 aspect ratios)")]
        public static void Run()
        {
            Report.Clear(); Map.Clear(); Summary.Clear(); _issues = 0; _done = false; _panels = 0; _subPanels = 0; _states = 0; Unclosed.Clear(); HangulBy.Clear(); HangulLines.Clear(); _lang = "ko";
            SaveBackup.Clear();
            foreach (var f in Directory.GetFiles(Application.persistentDataPath, "save*.json")) SaveBackup[f] = File.ReadAllBytes(f);
            SagaPrefsBackup.Backup();
            _origOptionsEnabled = EditorSettings.enterPlayModeOptionsEnabled;
            _origOptions = EditorSettings.enterPlayModeOptions;
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions = EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;
            EditorSceneManager.OpenScene(Scenes[0]);
            EditorApplication.playModeStateChanged += OnState;
            EditorApplication.isPlaying = true;
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
                EditorApplication.playModeStateChanged -= OnState;
                EditorSettings.enterPlayModeOptionsEnabled = _origOptionsEnabled;
                EditorSettings.enterPlayModeOptions = _origOptions;
                SetupSagaFonts.ResetDynamicFonts();
                foreach (var f in Directory.GetFiles(Application.persistentDataPath, "save*.json"))
                    if (!SaveBackup.ContainsKey(f)) File.Delete(f);
                foreach (var kv in SaveBackup) File.WriteAllBytes(kv.Key, kv.Value);
                SagaPrefsBackup.Restore();
                Directory.CreateDirectory(Path.GetDirectoryName(ReportPath));
                File.WriteAllText(ReportPath, Report.ToString() + System.Environment.NewLine + Map + System.Environment.NewLine + "== 영어 바퀴에 남은 한글(16:9)" + System.Environment.NewLine + HangulLines, new UTF8Encoding(false));
                bool ok = _done && _issues == 0;
                Debug.Log($"{T} {(ok ? "OK" : "FAIL")} - 문제 {_issues} (done={_done}) · 패널 {_panels} · 속 패널 {_subPanels} · 상태 {_states} · 영어에 한글 {HangulBy.Values.Sum()} [{string.Join(", ", HangulBy.Select(kv => kv.Key + " " + kv.Value))}] · 못 닫음 {Unclosed.Count}{(Unclosed.Count > 0 ? " [" + string.Join(", ", Unclosed) + "]" : "")} | {string.Join(" · ", Summary)}");
                if (Application.isBatchMode) EditorApplication.Exit(ok ? 0 : 1);
            }
        }

        private static void Tick()
        {
            bool more;
            try { more = _run.Step(); }
            catch (System.Exception e) { Debug.LogError($"{T} 예외 {e}"); _issues++; more = false; }
            if (!more)
            {
                EditorApplication.update -= Tick;
                EditorApplication.isPlaying = false;
            }
        }

        /// <summary>한국어 한 바퀴 → 다섯 판 언어를 영어로 바꿔 타이틀부터 한 바퀴 더(110 ⑤c-2b — 영어 글자가 길어 넘치는 것).</summary>
        private static readonly string[] Langs = { "ko", "en" };

        /// <summary>`-uiHidden`: 재지 않고 판마다 첫 화면에 숨은 UI 목록만(상태 고르기용 조사).</summary>
        private static bool Quick => System.Environment.GetCommandLineArgs().Contains("-uiHidden");

        private static void Hidden(string scene)
        {
            Map.AppendLine($"== {scene} 첫 화면에 숨은 UI");
            foreach (var c in Resources.FindObjectsOfTypeAll<Canvas>())
            {
                if (EditorUtility.IsPersistent(c) || !c.gameObject.scene.IsValid()) continue;
                if (c.transform.parent != null && c.transform.parent.GetComponentInParent<Canvas>(true) != null) continue;
                if (c.renderMode != RenderMode.ScreenSpaceOverlay) continue;
                if (!c.gameObject.activeInHierarchy) { Map.AppendLine($"  [캔버스 꺼짐] {c.name} 그래픽 {c.GetComponentsInChildren<Graphic>(true).Length}"); continue; }
                Walk(c.transform, 1);
            }
            void Walk(Transform t, int depth)
            {
                foreach (Transform ch in t)
                {
                    int n = ch.GetComponentsInChildren<Graphic>(true).Length;
                    if (n == 0) continue;
                    if (!ch.gameObject.activeSelf) Map.AppendLine($"  {PathOf(ch)} 그래픽 {n}");
                    else if (depth < 3) Walk(ch, depth + 1);
                }
            }
        }

        private static IEnumerator Script()
        {
            foreach (var lang in Langs)
            {
                if (Quick && lang != Langs[0]) break;
                SetLanguage(lang);
                _lang = lang;
                for (int i = 0; i < Scenes.Length; i++)
                {
                    if (i > 0 || lang != Langs[0]) EditorSceneManager.LoadSceneInPlayMode(Scenes[i], new LoadSceneParameters(LoadSceneMode.Single));
                    float t0 = Time.realtimeSinceStartup;
                    int frames = 0;
                    while (frames < 60 || Time.realtimeSinceStartup - t0 < 1.5f) { frames++; yield return null; }
                    string label = (lang == Langs[0] ? "" : lang + ":") + Path.GetFileNameWithoutExtension(Scenes[i]);
                    if (Quick) { Hidden(label); continue; }
                    foreach (var sc in Screens) Measure(label, sc.name, sc.w, sc.h);
                    yield return Panels(label, i == 0);
                    yield return States(label, Path.GetFileNameWithoutExtension(Scenes[i]));
                }
            }
            _done = true;
        }

        /// <summary>다섯 판 언어 키를 한꺼번에(타이틀 설정과 같은 키) — 판은 다음 씬을 열 때 새 언어로 짓는다.</summary>
        private static void SetLanguage(string lang)
        {
            foreach (var g in new[] { "go", "dungeon", "forest", "story", "realm" }) PlayerPrefs.SetString($"saga_{g}_language", lang);
            Saga.Core.SagaUi.Lang = lang;
        }

        // ───────── 패널 — 단추를 눌러 새로 뜬 것만 ─────────

        private static readonly string[] CloseLabels = { "닫기", "닫는다", "Close", "확인", "OK", "취소", "Cancel", "돌아가기", "계속하기", "Resume", "X", "×", "✕" };

        private static IEnumerator Panels(string scene, bool title)
        {
            var buttons = VisibleButtons().OrderBy(b => PathOf(b.transform)).ToList();
            int n = 0;
            foreach (var b in buttons)
            {
                if (b == null || !b.isActiveAndEnabled || !b.interactable) continue;
                if (title && b.name != "Settings" && b.name != "Credits") continue; // 타이틀의 나머지는 판을 연다·끈다
                var before = new HashSet<int>(VisibleGraphics().Select(g => g.GetInstanceID()));
                string name = b.name + Label(b);
                b.onClick.Invoke();
                for (int f = 0; f < 20; f++) yield return null;
                // 루트 캔버스마다 묶어 셋 이상 새로 뜬 캔버스만 — 기다리는 사이 다른 캔버스에 뜬 알림(지역 배너 등)은 패널이 아니다.
                var fresh = VisibleGraphics().Where(g => !before.Contains(g.GetInstanceID()))
                    .GroupBy(g => g.canvas != null ? g.canvas.rootCanvas : null).Where(grp => grp.Count() >= 3)
                    .SelectMany(grp => grp).ToList();
                if (fresh.Count < 3) continue; // 버튼 글자만 바뀜·토스트 한 줄은 패널 아님
                n++; _panels++;
                var only = new HashSet<Graphic>(fresh);
                foreach (var sc in Screens) Measure($"{scene} ▸ {name}", sc.name, sc.w, sc.h, only);
                // 설정 창의 단추는 둘째 단계가 아니라 전역 값(언어·UI 크기·품질)을 돌린다 — 뒤 패널이 다른 언어로 재진다
                if (!title && !b.name.Contains("설정") && !Label(b).Contains("설정")) yield return SubPanels($"{scene} ▸ {name}", fresh);
                yield return Close(b, fresh, $"{scene} ▸ {name}");
            }
            Summary.Add($"{scene} 패널 {n}");
        }

        /// <summary>판 패널 안 단추를 눌러 둘째 단계를 잰다. 누른 단추가 패널을 닫았으면(고르기 → 닫힘) 남은 단추는 건너뛴다.</summary>
        private static IEnumerator SubPanels(string parent, List<Graphic> panel)
        {
            var inside = new List<Button>();
            foreach (var g in panel)
            {
                if (g == null) continue;
                var bb = g.GetComponentInParent<Button>();
                if (bb != null && !inside.Contains(bb) && !IsClose(bb)) inside.Add(bb);
            }
            var seen = new HashSet<string>();
            int pressed = 0;
            foreach (var b in inside.OrderBy(x => PathOf(x.transform)))
            {
                if (pressed >= MaxSubPresses) break;
                if (b == null || !b.isActiveAndEnabled || !b.interactable) continue;
                if (!panel.Any(g => g != null && g.isActiveAndEnabled && g.gameObject.activeInHierarchy)) break; // 패널이 닫혔다
                pressed++;
                var before = new HashSet<int>(VisibleGraphics().Select(g => g.GetInstanceID()));
                string name = b.name + Label(b);
                b.onClick.Invoke();
                for (int f = 0; f < 20; f++) yield return null;
                var fresh = VisibleGraphics().Where(g => !before.Contains(g.GetInstanceID()))
                    .GroupBy(g => g.canvas != null ? g.canvas.rootCanvas : null).Where(grp => grp.Count() >= 3)
                    .SelectMany(grp => grp).ToList();
                if (fresh.Count < 3) continue;
                string sig = string.Join("|", fresh.Select(g => g.name).OrderBy(x => x));
                string what = $"{parent} ▸ {name}";
                if (seen.Add(sig))
                {
                    _subPanels++;
                    var only = new HashSet<Graphic>(fresh);
                    foreach (var sc in Screens) Measure(what, sc.name, sc.w, sc.h, only);
                }
                yield return Close(b, fresh, what, true);
            }
        }

        private static IEnumerator Close(Button opener, List<Graphic> fresh, string what, bool sub = false)
        {
            if (Alive(fresh) < 3) yield break; // 안 단추(고르기)가 이미 닫았다 — 연 단추를 또 누르면 다시 열린다
            Button close = null;
            foreach (var g in fresh)
            {
                if (g == null) continue; // 패널이 다시 그려 지운 것
                var bb = g.GetComponentInParent<Button>();
                if (bb != null && bb.isActiveAndEnabled && IsClose(bb)) { close = bb; break; }
            }
            if (close != null) close.onClick.Invoke();
            else if (sub) yield break; // 둘째 단계에 닫기가 없으면 패널 안의 바뀜(탭·상세) — 같은 단추를 또 누르면 행동이 한 번 더 된다
            else if (Saga.Core.SagaPauseMenu.IsOpen) Saga.Core.SagaPauseMenu.Close();
            else if (opener != null && opener.isActiveAndEnabled) opener.onClick.Invoke();
            for (int f = 0; f < 20; f++) yield return null;
            // 단추 없이 저절로 닫히는 카드(세션 정리 카드 5초 — REALM "다음 달")는 기다린다
            float t0 = Time.realtimeSinceStartup;
            while (Alive(fresh) >= 3 && Time.realtimeSinceStartup - t0 < 6f) yield return null;
            int left = Alive(fresh);
            if (left >= 3)
            {
                Unclosed.Add(what);
                foreach (var g in fresh) if (g != null) g.enabled = false; // 다음 단추를 가리지 않게(재기에서만)
            }
        }

        private static int Alive(List<Graphic> gs) => gs.Count(g => g != null && g.isActiveAndEnabled && g.gameObject.activeInHierarchy && Alpha(g) >= 0.05f);

        /// <summary>닫기 류 단추 — 글자가 닫기 말로 시작("닫기 (M)"·"Close" 등).</summary>
        private static bool IsClose(Button b)
        {
            string t = Label(b).Trim();
            return CloseLabels.Any(c => t == c || (c.Length > 1 && t.StartsWith(c)));
        }

        private static IEnumerable<Graphic> VisibleGraphics()
        {
            foreach (var c in Object.FindObjectsByType<Canvas>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
            {
                if (!c.isRootCanvas || !c.enabled || c.renderMode != RenderMode.ScreenSpaceOverlay) continue;
                foreach (var g in c.GetComponentsInChildren<Graphic>(false))
                    if (g.enabled && g.gameObject.activeInHierarchy && Alpha(g) >= 0.05f) yield return g;
            }
        }

        private static IEnumerable<Button> VisibleButtons()
        {
            var seen = new HashSet<Button>();
            foreach (var g in VisibleGraphics())
            {
                var b = g.GetComponentInParent<Button>();
                if (b != null && !IsDebugOnly(b.transform) && seen.Add(b)) yield return b;
            }
        }

        private static string Label(Button b)
        {
            var t = b.GetComponentInChildren<TMP_Text>();
            return t != null ? t.text.Replace("\n", " ") : "";
        }

        // ───────── 상태 — 단추로는 안 열리고 놀다가 켜지는 것(110 ⑤c-3) ─────────

        /// <summary>
        /// 상태 하나 = 켜기·끄기. <c>panel</c> 이면 패널처럼 새로 뜬 것만 재고(가운데를 일부러 덮는 알림·고르기),
        /// 아니면 화면 전체를 다시 잰다(전투 HUD·대사 줄·배너 — 늘 있는 HUD 와 겹치면 안 된다).
        /// 켜기가 false 면 그 판에 그 상태가 없다(요약에 "없음").
        /// </summary>
        private sealed class UiState
        {
            public string name;
            public System.Func<bool> enter;
            public System.Action exit;
            public bool panel;
            public float settle = 0.4f;          // 켠 뒤 기다릴 실제 초(배너 서서히 나타남 등)
            public System.Action everyFrame;     // 기다리는 동안 매 틱(결투 보고 등)
        }

        private static int _states;

        private static IEnumerator States(string label, string scene)
        {
            int n = 0;
            foreach (var st in StatesFor(scene))
            {
                var before = new HashSet<int>(VisibleGraphics().Select(g => g.GetInstanceID()));
                bool on;
                try { on = st.enter(); }
                catch (System.Exception e) { Debug.LogError($"{T} 상태 켜기 예외 {label} {st.name}: {e}"); _issues++; continue; }
                if (!on) { Summary.Add($"{label} 상태 {st.name} 없음"); _issues++; continue; }
                float t0 = Time.realtimeSinceStartup;
                for (int f = 0; f < 20 || Time.realtimeSinceStartup - t0 < st.settle; f++) { st.everyFrame?.Invoke(); yield return null; }
                st.everyFrame?.Invoke();
                string what = $"{label} ▸ 상태 {st.name}";
                if (st.panel)
                {
                    var fresh = VisibleGraphics().Where(g => !before.Contains(g.GetInstanceID())).ToList();
                    if (fresh.Count < 3) { Summary.Add($"{what} 안 뜸"); _issues++; }
                    else { var only = new HashSet<Graphic>(fresh); foreach (var sc in Screens) Measure(what, sc.name, sc.w, sc.h, only); }
                }
                else foreach (var sc in Screens) Measure(what, sc.name, sc.w, sc.h);
                n++; _states++;
                try { st.exit?.Invoke(); }
                catch (System.Exception e) { Debug.LogError($"{T} 상태 끄기 예외 {label} {st.name}: {e}"); _issues++; }
                for (int f = 0; f < 10; f++) yield return null;
            }
            if (n > 0) Summary.Add($"{label} 상태 {n}");
        }

        private const BindingFlags Any = BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;
        private static object Get(object o, string field) => o.GetType().GetField(field, Any).GetValue(o);
        private static void Set(object o, string field, object v) => o.GetType().GetField(field, Any).SetValue(o, v);
        private static object Call(object o, string method, params object[] args) => o.GetType().GetMethod(method, Any).Invoke(o, args);

        /// <summary>대사 줄에 넣을 긴 한 줄 — 실제 대사 중 긴 편(두 줄 넘김)과 같은 길이.</summary>
        private static string LongLine => _lang == "en"
            ? "Village chief: Bandits have blocked the mountain pass again. Would you go and take a look? I will make it worth your while."
            : "촌장: 도적 떼가 또 고갯길을 막았다네. 자네가 한번 가 봐 주겠나? 보답은 섭섭지 않게 하겠네.";

        private static UiState Dialogue(System.Func<MonoBehaviour> find) => new UiState
        {
            name = "대사 줄",
            enter = () => { var d = find(); if (d == null) return false; Call(d, "Show", LongLine, 60f); return true; },
            exit = () => { var d = find(); if (d != null) Call(d, "Show", "", 0.01f); },
        };

        private static List<UiState> StatesFor(string scene)
        {
            var list = new List<UiState>();
            switch (scene)
            {
                case "TestVillage": GoStates(list); list.Add(Dialogue(() => Saga.Go.UI.DialogueLabel.Instance)); break;
                case "TestDungeon": DungeonStates(list); list.Add(Dialogue(() => Saga.Dungeon.UI.DialogueLabel.Instance)); break;
                case "TestVillageForest": ForestStates(list); list.Add(Dialogue(() => Saga.Forest.UI.DialogueLabel.Instance)); break;
                case "TestField": StoryStates(list); list.Add(Dialogue(() => Saga.Story.UI.DialogueLabel.Instance)); break;
                case "TestCity":
                    list.Add(new UiState
                    {
                        name = "알림",
                        enter = () => { var t = Saga.Realm.UI.RealmToast.Instance; if (t == null) return false; t.Show(LongLine, 60f); return true; },
                        exit = () => Saga.Realm.UI.RealmToast.Instance?.Show("", 0.01f),
                    });
                    // 109-16 시나리오 카드 — 본문이 가장 긴 카드(고른 답 글까지)를 사건 판에 띄운다. 판은 열릴 때 스스로 크기를 맞춘다.
                    GameObject eventPanel = null;
                    list.Add(new UiState
                    {
                        name = "시나리오 카드",
                        panel = true,
                        enter = () =>
                        {
                            var ui = Object.FindFirstObjectByType<Saga.Realm.UI.RealmCommandUi>();
                            if (ui == null) return false;
                            eventPanel = (GameObject)Get(ui, "_eventPanel");
                            string longest = null; int max = 0;
                            foreach (var c in Saga.Realm.Data.RealmScenarioData.Cards)
                            {
                                var d = Saga.Realm.Data.RealmScenario.Describe(c.Id);
                                int len = d.body.Length + d.a.Length + d.b.Length + d.c.Length;
                                if (len > max) { max = len; longest = c.Id; }
                            }
                            var present = typeof(Saga.Realm.Data.RealmEventState).GetMethod("Present", Any);
                            present.Invoke(null, new object[] { new Saga.Realm.Data.RealmEventState.Card(Saga.Realm.Data.RealmEventState.Kind.Scenario, longest) });
                            return true;
                        },
                        exit = () => { eventPanel.SetActive(false); Saga.Realm.Data.RealmEventState.ClearForTest(); },
                    });
                    break;
            }
            return list;
        }

        private static void GoStates(List<UiState> list)
        {
            // ① 들판 전투 — 명단 넷(이름 긴 인물 셋)·다 폭발 준비·지역 사명 줄. 첫 화면은 주인공 하나라 명단 한 칸뿐이다.
            List<string> savedMembers = null;
            float savedEnergy = 0f;
            list.Add(new UiState
            {
                name = "전투 명단 넷",
                enter = () =>
                {
                    var fc = Saga.Go.Combat.FieldCombat.Instance;
                    if (fc == null) return false;
                    savedMembers = Saga.Go.Data.PartyState.MemberIds.ToList();
                    savedEnergy = fc.Party[0].Energy;
                    var add = Saga.Go.Data.GoHeroes.All.Where(h => !savedMembers.Contains(h.Id))
                        .OrderByDescending(h => Saga.Go.Data.GoHeroes.Name(h).Length).ThenBy(h => h.Id).Take(3).Select(h => h.Id);
                    Saga.Go.Data.PartyState.Restore(savedMembers.Concat(add).ToList());
                    fc.RebuildParty();
                    foreach (var m in fc.Party) m.Energy = Saga.Go.Combat.FieldCombat.BurstCost;
                    fc.GetComponent<Saga.Go.Combat.FieldCombatHud>()?.Refresh();
                    var mission = Saga.Go.UI.RegionMissionHud.Instance;
                    if (mission != null)
                    {
                        var line = (TextMeshProUGUI)Get(mission, "_line");
                        string region = Saga.Go.Data.GoWorldMap.Regions.Select(r => Saga.Go.Data.GoWorldMap.RegionName(r.Id)).OrderByDescending(s => s.Length).First();
                        line.text = string.Format(Saga.Go.Data.GoLocalization.T("mission.clear", "◆ {0} 평정! — 금 {1}냥 · 경험치 {2}"), region, 1200, 3400);
                        line.gameObject.SetActive(true);
                        Set(mission, "_flashLeft", 999f);
                    }
                    return fc.Party.Count == Saga.Go.Combat.FieldCombat.MaxParty;
                },
                exit = () =>
                {
                    var fc = Saga.Go.Combat.FieldCombat.Instance;
                    Saga.Go.Data.PartyState.Restore(savedMembers);
                    if (fc != null)
                    {
                        fc.RebuildParty();
                        foreach (var m in fc.Party) m.Energy = m.Id == fc.Party[0].Id ? savedEnergy : 0f;
                    }
                    var mission = Saga.Go.UI.RegionMissionHud.Instance;
                    if (mission != null) Set(mission, "_flashLeft", 0f);
                },
            });

            // ② 옛 결투 셋·③ 조우 알림 셋 — 사건마다 첫 개체의 UI 를 그대로 켠다(게임 상태는 안 건드림).
            // 결투 중엔 들판 전투 HUD 가 숨는다(DuelGate) — 기다리는 동안 결투를 보고해 그 모습 그대로.
            foreach (var type in new[] { typeof(Saga.Go.World.BanditEncounter), typeof(Saga.Go.World.RareWolfEncounter), typeof(Saga.Go.World.ShrineTrialEncounter) })
            {
                string tn = type.Name.Replace("Encounter", "");
                GameObject root = null;
                list.Add(new UiState
                {
                    name = $"결투 {tn}",
                    enter = () =>
                    {
                        var enc = Object.FindFirstObjectByType(type);
                        if (enc == null) return false;
                        root = (GameObject)Get(enc, "_combatRoot");
                        root.SetActive(true);
                        return true;
                    },
                    everyFrame = () => Saga.Go.Combat.DuelGate.Report(true),
                    exit = () => { root.SetActive(false); Saga.Go.Combat.DuelGate.ResetForTest(); },
                });
                GameObject prompt = null;
                list.Add(new UiState
                {
                    name = $"조우 {tn}",
                    panel = true,
                    enter = () =>
                    {
                        var enc = Object.FindFirstObjectByType(type);
                        if (enc == null) return false;
                        prompt = (GameObject)Get(enc, "_promptRoot");
                        prompt.SetActive(true);
                        return true;
                    },
                    exit = () => prompt.SetActive(false),
                });
            }

            // ④ 승급 3택 — 레벨이 오를 때 뜬다.
            list.Add(new UiState
            {
                name = "승급 3택",
                panel = true,
                enter = () =>
                {
                    var ui = Object.FindFirstObjectByType<Saga.Go.UI.PerkChoiceUi>();
                    if (ui == null) return false;
                    ui.Show(Saga.Go.Data.PerkState.RollChoice(new System.Random(20260824)), null, null);
                    return true;
                },
                exit = () => { var ui = Object.FindFirstObjectByType<Saga.Go.UI.PerkChoiceUi>(); if (ui != null) Call(ui, "Reject"); },
            });

            // ⑤ 낚시(109-14-24) — 낚시 칸(고리 겨누기) · 줄다리기 막대(낚시 칸 위에 함께) · 게시판 창. 서는 자리로 옮겨 켜고 끝나면 되돌린다.
            Vector3 fishFrom = default;
            System.Func<System.Func<Saga.Go.World.FishingField, Vector3>, bool> fishEnter = where =>
            {
                var fc = Saga.Go.Combat.FieldCombat.Instance;
                var field = Saga.Go.World.FishingField.Instance;
                var ui = Saga.Go.UI.FishingUi.Instance;
                if (fc == null || field == null || ui == null) return false;
                fishFrom = fc.transform.position;
                field.Paused = true;
                var dest = where(field);
                if (Saga.Go.UI.WorldMapUi.Instance != null) Set(Saga.Go.UI.WorldMapUi.Instance, "_lastRegion", Saga.Go.Data.GoWorldMap.RegionAt(dest)); // 자리를 옮겨도 지역 자막이 안 뜨게
                fc.GetComponent<Saga.Go.Player.PlayerController>()?.Teleport(dest);
                return true;
            };
            System.Action fishExit = () =>
            {
                var fc = Saga.Go.Combat.FieldCombat.Instance;
                Saga.Go.UI.FishingUi.Instance?.CloseBoard();
                Saga.Go.UI.FishingUi.Instance?.Quit();
                if (Saga.Go.World.FishingField.Instance != null) Saga.Go.World.FishingField.Instance.Paused = false;
                if (Saga.Go.UI.WorldMapUi.Instance != null) Set(Saga.Go.UI.WorldMapUi.Instance, "_lastRegion", Saga.Go.Data.GoWorldMap.RegionAt(fishFrom));
                fc?.GetComponent<Saga.Go.Player.PlayerController>()?.Teleport(fishFrom);
            };
            list.Add(new UiState
            {
                name = "낚시 칸",
                enter = () => fishEnter(f => f.StandPos("river_w")) && Saga.Go.UI.FishingUi.Instance.TryBegin(),
                exit = fishExit,
            });
            list.Add(new UiState
            {
                name = "낚시 줄다리기",
                enter = () => fishEnter(f => f.StandPos("river_w")) && Saga.Go.UI.FishingUi.Instance.TryBegin(),
                everyFrame = () => ((GameObject)Get(Saga.Go.UI.FishingUi.Instance, "_bar")).SetActive(true),
                exit = fishExit,
            });
            // ⑤-2 탐사 창(109-14-26) — 게시판 곁인 것으로(보내기·받기 단추가 다 켜진 모양)
            list.Add(new UiState
            {
                name = "탐사 창",
                panel = true,
                enter = () =>
                {
                    var ui = Saga.Go.UI.DispatchUi.Instance;
                    if (ui == null) return false;
                    Saga.Go.UI.DispatchUi.AtBoardForTest = 1;
                    ui.Open();
                    return ui.IsOpen;
                },
                exit = () => { Saga.Go.UI.DispatchUi.Instance?.Close(); Saga.Go.UI.DispatchUi.AtBoardForTest = -1; },
            });
            // ⑥ 업적 창(109-14-25) — 받을 게 있는 상태로(단추 ●N·탭 ●N·받기 단추가 다 켜진 모양)
            list.Add(new UiState
            {
                name = "업적 창",
                panel = true,
                enter = () =>
                {
                    var ui = Saga.Go.UI.AchieveUi.Instance;
                    if (ui == null) return false;
                    ui.Open();
                    ui.SelectTab(Saga.Go.Data.GoAchieve.Cat.World);
                    return ui.IsOpen;
                },
                exit = () => Saga.Go.UI.AchieveUi.Instance?.Close(),
            });
            list.Add(new UiState
            {
                name = "낚시 게시판",
                panel = true,
                enter = () =>
                {
                    if (!fishEnter(f => f.BoardPos(Saga.Go.Data.GoFishing.BoardSpot()))) return false;
                    Saga.Go.UI.FishingUi.Instance.OpenBoard();
                    return Saga.Go.UI.FishingUi.Instance.BoardOpen;
                },
                exit = fishExit,
            });
        }

        private static void DungeonStates(List<UiState> list)
        {
            // 109-16 시나리오 장면 상자 — 가장 긴 줄이 든 장면(글 자리)과 고르기 장면(답 단추 둘)을 각각 띄운다.
            foreach (bool choiceMode in new[] { false, true })
            {
                list.Add(new UiState
                {
                    name = choiceMode ? "시나리오 고르기" : "시나리오 장면",
                    panel = true,
                    enter = () =>
                    {
                        var ui = Saga.Dungeon.UI.DungeonScenarioUi.Instance;
                        if (ui == null) return false;
                        Saga.Dungeon.Data.DungeonScenarioData.Scene pick = null;
                        int max = 0;
                        foreach (var sc in Saga.Dungeon.Data.DungeonScenarioData.Scenes)
                        {
                            if (choiceMode ? sc.Choice == null : sc.Choice != null) continue;
                            for (int i = 0; i < sc.Lines.Length; i++)
                            {
                                int len = Saga.Dungeon.Data.DungeonScenario.LineText(sc.Id, i).Length;
                                if (len > max) { max = len; pick = sc; }
                            }
                        }
                        if (pick == null) return false;
                        var ch = Saga.Dungeon.Data.DungeonScenarioData.ChapterOf(pick.ChapterId);
                        ui.Play(new Saga.Dungeon.Data.DungeonScenario.SceneRequest { Scene = pick, Title = Saga.Dungeon.Data.DungeonScenario.ChapterTitle(ch) });
                        // 가장 긴 줄까지 넘긴다
                        int want = 0; int best = 0;
                        for (int i = 0; i < pick.Lines.Length; i++)
                        {
                            int len = Saga.Dungeon.Data.DungeonScenario.LineText(pick.Id, i).Length;
                            if (len > best) { best = len; want = i; }
                        }
                        for (int i = 0; i < want; i++) ui.Next();
                        if (choiceMode) ui.Skip();
                        return true;
                    },
                    exit = () => Saga.Dungeon.UI.DungeonScenarioUi.Instance?.Hide(),
                });
            }
            list.Add(new UiState
            {
                name = "축복 3택",
                panel = true,
                enter = () =>
                {
                    var ui = Object.FindFirstObjectByType<Saga.Dungeon.UI.BlessingChoiceUi>();
                    if (ui == null) return false;
                    ui.Show(Saga.Dungeon.Data.BlessingState.RollChoice(new System.Random(20260824)), null, null);
                    return true;
                },
                exit = () => { var ui = Object.FindFirstObjectByType<Saga.Dungeon.UI.BlessingChoiceUi>(); if (ui != null) Call(ui, "Reject"); },
            });
            list.Add(new UiState
            {
                name = "시련 카드",
                panel = true,
                enter = () =>
                {
                    var ui = Saga.Dungeon.UI.TrialCardUi.Instance;
                    if (ui == null) return false;
                    ui.Show(Vector3.zero);
                    return true;
                },
                exit = () => Saga.Dungeon.UI.TrialCardUi.Instance?.Close(),
            });
            // 지역 배너 — 서서히 떠서 머문다. 이름 가장 긴 지역으로.
            int announced = -1;
            list.Add(new UiState
            {
                name = "지역 배너",
                settle = 1.2f,
                enter = () =>
                {
                    var tr = Object.FindFirstObjectByType<Saga.Dungeon.World.DungeonRegionTracker>();
                    if (tr == null) return false;
                    announced = tr.Announced;
                    int longest = Enumerable.Range(0, Saga.Dungeon.Data.DungeonWorldMap.All.Length)
                        .OrderByDescending(i => (Saga.Dungeon.Data.DungeonWorldMap.BannerTitle(i) + Saga.Dungeon.Data.DungeonWorldMap.BannerLine(i)).Length).First();
                    Call(tr, "Announce", longest);
                    return true;
                },
                exit = () => Object.FindFirstObjectByType<Saga.Dungeon.World.DungeonRegionTracker>()?.ResetState(announced),
            });
        }

        private static void ForestStates(List<UiState> list)
        {
            list.Add(new UiState
            {
                name = "밀어내기",
                enter = () =>
                {
                    var ui = Saga.Forest.UI.ForestHostileEncounterUi.Instance;
                    if (ui == null) return false;
                    ui.StartEncounter(null);
                    return ui.IsActive;
                },
                exit = () =>
                {
                    var ui = Saga.Forest.UI.ForestHostileEncounterUi.Instance;
                    for (int k = 0; k < 50 && ui != null && ui.IsActive; k++) ui.DebugPress();
                },
            });
        }

        private static void StoryStates(List<UiState> list)
        {
            // 109-16 시나리오 장면 상자 — 가장 긴 줄이 든 장면(글 자리)을 그 줄까지 넘겨 띄운다.
            list.Add(new UiState
            {
                name = "시나리오 장면",
                panel = true,
                enter = () =>
                {
                    var ui = Saga.Story.UI.StoryScenarioUi.Instance;
                    if (ui == null) return false;
                    Saga.Story.Data.StoryScenarioData.Scene pick = null;
                    int max = 0, want = 0;
                    foreach (var sc in Saga.Story.Data.StoryScenarioData.Scenes)
                        for (int i = 0; i < sc.Lines.Length; i++)
                        {
                            int len = Saga.Story.Data.StoryScenario.LineText(sc.Id, i).Length;
                            if (len > max) { max = len; pick = sc; want = i; }
                        }
                    if (pick == null) return false;
                    var ch = Saga.Story.Data.StoryScenarioData.ChapterOf(pick.ChapterId);
                    ui.Play(new Saga.Story.Data.StoryScenario.SceneRequest { Scene = pick, Title = Saga.Story.Data.StoryScenario.ChapterFullTitle(ch) });
                    for (int i = 0; i < want; i++) ui.Next();
                    return true;
                },
                exit = () => Saga.Story.UI.StoryScenarioUi.Instance?.Hide(),
            });
            list.Add(new UiState
            {
                name = "전직 고르기",
                panel = true,
                enter = () =>
                {
                    var ui = Saga.Story.UI.StoryJobChoiceUi.Instance;
                    if (ui == null) return false;
                    ui.Show(Saga.Story.Data.StoryLocalization.T("npc.trainer_choice_prompt", "전직할 수 있습니다 — 원하는 길을 고르세요"), null);
                    return true;
                },
                exit = () => { var ui = Saga.Story.UI.StoryJobChoiceUi.Instance; if (ui != null) ((GameObject)Get(ui, "_panel")).SetActive(false); },
            });
            list.Add(new UiState
            {
                name = "선택",
                panel = true,
                enter = () =>
                {
                    var ui = Saga.Story.UI.StoryChoiceUi.Instance;
                    if (ui == null) return false;
                    ui.Show(LongLine, LongLine.Substring(0, LongLine.Length / 2), LongLine.Substring(LongLine.Length / 2), null);
                    return true;
                },
                exit = () => { var ui = Saga.Story.UI.StoryChoiceUi.Instance; if (ui != null) ((GameObject)Get(ui, "panel")).SetActive(false); },
            });
        }

        // ───────── 재기 ─────────

        private struct Item
        {
            public Graphic g;
            public Rect px;       // 화면 픽셀 발자국
            public Transform widget;
            public bool modal;
        }

        private static void Measure(string scene, string screenName, int w, int h, HashSet<Graphic> only = null)
        {
            var roots = Object.FindObjectsByType<Canvas>(FindObjectsInactive.Exclude, FindObjectsSortMode.None)
                .Where(c => c.isRootCanvas && c.enabled && c.renderMode == RenderMode.ScreenSpaceOverlay).ToList();
            var saved = new List<(Canvas c, CanvasScaler s, bool se, Vector3 pos, Quaternion rot, Vector3 scale, Vector2 pivot, Vector2 size)>();
            var items = new List<Item>();
            var screen = new Rect(0, 0, w, h);
            foreach (var c in roots)
            {
                var rt = (RectTransform)c.transform;
                var scaler = c.GetComponent<CanvasScaler>();
                saved.Add((c, scaler, scaler != null && scaler.enabled, rt.position, rt.rotation, rt.localScale, rt.pivot, rt.sizeDelta));
                float k = ScaleFactor(scaler, w, h);
                if (scaler != null) scaler.enabled = false;
                c.renderMode = RenderMode.WorldSpace;
                rt.rotation = Quaternion.identity;
                rt.localScale = Vector3.one;
                rt.pivot = Vector2.zero;
                rt.position = Vector3.zero;
                rt.sizeDelta = new Vector2(w / k, h / k);
            }
            Canvas.ForceUpdateCanvases();
            foreach (var c in roots)
            {
                float k = ScaleFactor(c.GetComponent<CanvasScaler>(), w, h);
                Collect(c, k, w, h, items, only);
            }
            // 되돌리기
            foreach (var x in saved)
            {
                var rt = (RectTransform)x.c.transform;
                x.c.renderMode = RenderMode.ScreenSpaceOverlay;
                if (x.s != null) x.s.enabled = x.se;
                rt.pivot = x.pivot; rt.localScale = x.scale; rt.rotation = x.rot; rt.position = x.pos; rt.sizeDelta = x.size;
            }
            Canvas.ForceUpdateCanvases();

            int overlaps = 0, off = 0;
            var lines = new List<string>();
            foreach (var it in items)
            {
                var r = it.px;
                float outX = Mathf.Max(0, -r.xMin) + Mathf.Max(0, r.xMax - w);
                float outY = Mathf.Max(0, -r.yMin) + Mathf.Max(0, r.yMax - h);
                if (outX > 4 || outY > 4)
                {
                    off++;
                    lines.Add($"  화면 밖 {outX:F0}×{outY:F0}px  {PathOf(it.g.transform)}{TextOf(it.g)}");
                }
            }
            var reported = new HashSet<(Transform, Transform)>();
            for (int a = 0; a < items.Count; a++)
                for (int b = a + 1; b < items.Count; b++)
                {
                    var A = items[a]; var B = items[b];
                    if (A.widget == B.widget || A.modal || B.modal) continue;
                    var key = A.widget.GetInstanceID() < B.widget.GetInstanceID() ? (A.widget, B.widget) : (B.widget, A.widget);
                    if (reported.Contains(key)) continue;
                    float ix = Mathf.Min(A.px.xMax, B.px.xMax) - Mathf.Max(A.px.xMin, B.px.xMin);
                    float iy = Mathf.Min(A.px.yMax, B.px.yMax) - Mathf.Max(A.px.yMin, B.px.yMin);
                    if (ix <= 2 || iy <= 2) continue;
                    float area = ix * iy, small = Mathf.Min(A.px.width * A.px.height, B.px.width * B.px.height);
                    if (area < 64 || area < small * 0.08f) continue;
                    reported.Add(key);
                    overlaps++;
                    lines.Add($"  겹침 {ix:F0}×{iy:F0}px  {PathOf(A.g.transform)}{TextOf(A.g)}  ↔  {PathOf(B.g.transform)}{TextOf(B.g)}");
                }
            if (screenName == Screens[0].name && only == null)
            {
                // 16:9 자리표 — 위젯마다 발자국 합집합(화면 픽셀, 왼쪽 아래 원점). 배치를 고칠 때 본다.
                Map.AppendLine($"== {scene} {screenName} 위젯 자리(px x·y·w·h, 왼쪽 아래 원점)");
                foreach (var grp in items.GroupBy(i => i.widget).OrderBy(g => -g.Max(i => i.px.yMax)))
                {
                    var u = grp.Select(i => i.px).Aggregate((r1, r2) => Rect.MinMaxRect(Mathf.Min(r1.xMin, r2.xMin), Mathf.Min(r1.yMin, r2.yMin), Mathf.Max(r1.xMax, r2.xMax), Mathf.Max(r1.yMax, r2.yMax)));
                    Map.AppendLine($"  {u.xMin,5:F0} {u.yMin,5:F0} {u.width,5:F0} {u.height,5:F0}  {PathOf(grp.Key)}{(grp.First().modal ? " (모달)" : "")}");
                }
            }
            _issues += overlaps + off;
            if (_lang == "en" && screenName == Screens[0].name)
            {
                var seenText = new HashSet<Graphic>();
                foreach (var it in items)
                {
                    if (!(it.g is TMP_Text t) || !seenText.Add(t) || !System.Text.RegularExpressions.Regex.IsMatch(t.text, "[가-힣]")) continue;
                    string where = scene.Split(' ')[0];
                    HangulBy[where] = (HangulBy.TryGetValue(where, out int c) ? c : 0) + 1;
                    var bits = System.Text.RegularExpressions.Regex.Matches(t.text, "[가-힣][가-힣0-9 ·,()%+:~/-]*").Cast<System.Text.RegularExpressions.Match>().Select(m => m.Value.Trim()).Distinct();
                    HangulLines.AppendLine($"  {scene} · {PathOf(t.transform)} ⟨{string.Join(" | ", bits)}⟩");
                }
            }
            if (only == null || overlaps + off > 0) Summary.Add($"{scene} {screenName} 겹침 {overlaps}·밖 {off}");
            Report.AppendLine($"== {scene} {screenName} ({w}×{h}) — {(only == null ? $"캔버스 {roots.Count} · " : "")}보이는 것 {items.Count} · 겹침 {overlaps} · 화면 밖 {off}");
            foreach (var l in lines) Report.AppendLine(l);
        }

        /// <summary>CanvasScaler 의 크기 식 그대로(ScaleWithScreenSize 세 방식·고정 픽셀).</summary>
        public static float ScaleFactor(CanvasScaler s, int w, int h)
        {
            if (s == null) return 1f;
            if (s.uiScaleMode == CanvasScaler.ScaleMode.ConstantPixelSize) return s.scaleFactor;
            if (s.uiScaleMode != CanvasScaler.ScaleMode.ScaleWithScreenSize) return 1f;
            var r = s.referenceResolution;
            switch (s.screenMatchMode)
            {
                case CanvasScaler.ScreenMatchMode.Expand: return Mathf.Min(w / r.x, h / r.y);
                case CanvasScaler.ScreenMatchMode.Shrink: return Mathf.Max(w / r.x, h / r.y);
                default:
                    float lw = Mathf.Log(w / r.x, 2), lh = Mathf.Log(h / r.y, 2);
                    return Mathf.Pow(2, Mathf.Lerp(lw, lh, s.matchWidthOrHeight));
            }
        }

        private static void Collect(Canvas c, float k, int w, int h, List<Item> items, HashSet<Graphic> only)
        {
            float screenArea = (float)w * h;
            var widgetOf = new Dictionary<Transform, Transform>();
            var modalWidgets = new HashSet<Transform>();
            var found = new List<Item>();
            foreach (var g in c.GetComponentsInChildren<Graphic>(false))
            {
                if (!g.enabled || !g.gameObject.activeInHierarchy) continue;
                if (Alpha(g) < 0.05f) continue;
                if (g is TMP_SubMeshUI) continue; // 글꼴 아틀라스 둘째 장의 보조 그림 — 글자 잉크는 부모 TMP 가 이미 다 센다(사각형은 글자와 무관)
                if (g.GetComponentInParent<Saga.Core.LayoutFree>() != null) continue; // 움직이는 표지(지도 내 위치 등)
                if (IsDebugOnly(g.transform)) continue; // 릴리스 빌드엔 안 뜨는 디버그 줄(DebugHud: !Debug.isDebugBuild 면 꺼짐)
                Button unitButton = null;
                if (only != null)
                {
                    if (!only.Contains(g)) continue;
                    unitButton = g.GetComponentInParent<Button>();
                    if (unitButton == null && !(g is TMP_Text)) continue; // 패널 안 그림(판·띠·아이콘)은 뺀다
                }
                Rect px;
                if (g is TMP_Text t)
                {
                    if (string.IsNullOrWhiteSpace(t.text)) continue;
                    t.ForceMeshUpdate();
                    if (t.textInfo == null || t.textInfo.characterCount == 0) continue;
                    // textBounds 는 줄 높이(ascender~descender, Noto 1.45em)라 과하다 — 보이는 글자의 잉크 상자 합집합으로 잰다.
                    Vector2 mn = new Vector2(float.MaxValue, float.MaxValue), mx = new Vector2(float.MinValue, float.MinValue);
                    var info = t.textInfo;
                    for (int ci = 0; ci < info.characterCount; ci++)
                    {
                        var ch = info.characterInfo[ci];
                        if (!ch.isVisible) continue;
                        mn = Vector2.Min(mn, new Vector2(ch.bottomLeft.x, ch.bottomLeft.y));
                        mx = Vector2.Max(mx, new Vector2(ch.topRight.x, ch.topRight.y));
                    }
                    if (mx.x - mn.x <= 0.01f || mx.y - mn.y <= 0.01f) continue;
                    px = ToPx(t.transform, mn, mx, k);
                }
                else
                {
                    var corners = new Vector3[4];
                    g.rectTransform.GetWorldCorners(corners);
                    px = Rect.MinMaxRect(corners[0].x * k, corners[0].y * k, corners[2].x * k, corners[2].y * k);
                    if (px.width < 2 || px.height < 2) continue;
                }
                var clip = ClipOf(g.transform, k);
                if (clip.HasValue)
                {
                    var r = clip.Value;
                    if (px.xMax <= r.xMin || px.xMin >= r.xMax || px.yMax <= r.yMin || px.yMin >= r.yMax) continue; // 스크롤 밖
                    px = Rect.MinMaxRect(Mathf.Max(px.xMin, r.xMin), Mathf.Max(px.yMin, r.yMin), Mathf.Min(px.xMax, r.xMax), Mathf.Min(px.yMax, r.yMax));
                }
                if (only != null)
                {
                    found.Add(new Item { g = g, px = px, widget = unitButton != null ? unitButton.transform : g.transform });
                    continue;
                }
                var widget = WidgetOf(g.transform, c.transform, w / k, h / k, widgetOf);
                if (px.width * px.height > screenArea * 0.3f) modalWidgets.Add(widget);
                // 세션 정리 카드는 뒤를 흐리고(DoF) 5초 위를 덮는 카드 — 화면 30% 가 안 돼도 모달(REALM "다음 달" 알림과 같이 뜬다)
                if (g.GetComponentInParent<Saga.Core.SessionCard>() != null) modalWidgets.Add(widget);
                found.Add(new Item { g = g, px = px, widget = widget });
            }
            foreach (var it in found)
            {
                var x = it;
                x.modal = modalWidgets.Contains(it.widget);
                // 모달의 큰 판 자체는 화면 밖 검사만 의미 없어 뺀다(꽉 찬 배경은 넘쳐도 된다)
                if (x.modal && x.px.width * x.px.height > screenArea * 0.3f) continue;
                items.Add(x);
            }
        }

        /// <summary>가장 가까운 마스크(RectMask2D·Mask)의 화면 픽셀 사각형 — 스크롤 목록에서 가려진 줄을 안 세게.</summary>
        private static Rect? ClipOf(Transform t, float k)
        {
            for (var p = t.parent; p != null; p = p.parent)
            {
                if (p.GetComponent<RectMask2D>() == null && p.GetComponent<Mask>() == null) continue;
                var corners = new Vector3[4];
                ((RectTransform)p).GetWorldCorners(corners);
                return Rect.MinMaxRect(corners[0].x * k, corners[0].y * k, corners[2].x * k, corners[2].y * k);
            }
            return null;
        }

        private static bool IsDebugOnly(Transform t)
        {
            for (var p = t; p != null; p = p.parent)
                foreach (var mb in p.GetComponents<MonoBehaviour>())
                    if (mb != null && mb.GetType().Name == "DebugHud") return true;
            return false;
        }

        private static Rect ToPx(Transform tr, Vector3 min, Vector3 max, float k)
        {
            var a = tr.TransformPoint(min); var b = tr.TransformPoint(max);
            return Rect.MinMaxRect(Mathf.Min(a.x, b.x) * k, Mathf.Min(a.y, b.y) * k, Mathf.Max(a.x, b.x) * k, Mathf.Max(a.y, b.y) * k);
        }

        private static float Alpha(Graphic g)
        {
            float a = g.color.a * g.canvasRenderer.GetAlpha();
            for (var p = g.transform; p != null; p = p.parent)
            {
                var cg = p.GetComponent<CanvasGroup>();
                if (cg == null) continue;
                a *= cg.alpha;
                if (cg.ignoreParentGroups) break;
            }
            return a;
        }

        /// <summary>캔버스 또는 "꽉 찬 투명 틀" 바로 밑의 조상 = 위젯.</summary>
        private static Transform WidgetOf(Transform t, Transform canvas, float lw, float lh, Dictionary<Transform, Transform> memo)
        {
            if (memo.TryGetValue(t, out var w)) return w;
            var chain = new List<Transform>();
            for (var p = t; p != null && p != canvas; p = p.parent) chain.Add(p);
            chain.Reverse(); // 캔버스 쪽부터
            Transform result = chain.Count > 0 ? chain[chain.Count - 1] : t;
            foreach (var n in chain)
            {
                if (IsContainer(n, lw, lh)) continue;
                result = n;
                break;
            }
            memo[t] = result;
            return result;
        }

        private static bool IsContainer(Transform n, float lw, float lh)
        {
            if (!(n is RectTransform rt)) return false;
            if (n.GetComponent<Canvas>() != null) return true; // 중첩 캔버스
            var size = rt.rect.size;
            if (size.x < lw * 0.9f || size.y < lh * 0.9f) return false;
            var g = n.GetComponent<Graphic>();
            return g == null || !g.enabled || Alpha(g) < 0.05f;
        }

        private static string PathOf(Transform t)
        {
            var parts = new List<string>();
            for (var p = t; p != null && parts.Count < 4; p = p.parent) parts.Add(p.name);
            parts.Reverse();
            return string.Join("/", parts);
        }

        private static string TextOf(Graphic g)
        {
            if (!(g is TMP_Text t)) return "";
            var s = t.text.Replace("\n", " ");
            return $" \"{(s.Length > 24 ? s.Substring(0, 24) + "…" : s)}\"";
        }
    }
}
