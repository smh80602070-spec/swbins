using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using Saga.Core;

namespace Saga.Title
{
    /// <summary>
    /// PLAN.md 110 ② 타이틀 — 빌드의 첫 씬. 다섯 판 카드(이름·한 줄·저장 상태)에서 이어하기/새로 시작, 아래에 게임 종료·버전.
    /// "새로 시작"은 저장이 있으면 한 번 묻는다. 이번 실행에서 이미 들어갔던 판이면 메모리의 정적 상태가 남아 있으니,
    /// 앱을 켜고 처음 타이틀이 떴을 때 떠 둔 기본값(<see cref="CaptureDefaults"/>)을 적용해 되돌린 뒤 판을 연다.
    /// UI 는 전부 Play 때 짓는다(`SagaUi`, TextMeshPro). 판 이름·한 줄은 원작 이름을 쓰지 않는다.
    /// </summary>
    public class TitleScreen : MonoBehaviour
    {
        public struct Game
        {
            public string Key;
            public string Name;
            public string Tagline;
            public string NameEn;
            public string TaglineEn;
            public string Scene;
            public Func<bool> HasSave;
            public Action DeleteSave;
            public Func<string> ToJson;
            public Func<string, bool> ApplyJson;
        }

        public static readonly Game[] Games =
        {
            new Game { Key = "go", Name = "사가고", Tagline = "들판을 누비며 인물을 모으는 수집 모험", NameEn = "Saga GO", TaglineEn = "Roam the fields and gather heroes", Scene = "TestVillage",
                HasSave = () => Saga.Go.Data.SaveState.HasSave, DeleteSave = Saga.Go.Data.SaveState.DeleteSave,
                ToJson = Saga.Go.Data.SaveState.ToJson, ApplyJson = Saga.Go.Data.SaveState.ApplyJson },
            new Game { Key = "dungeon", Name = "사가블로", Tagline = "층을 내려가며 베어 넘기는 핵앤슬래시 던전", NameEn = "Sagablo", TaglineEn = "Hack and slash down floor after floor", Scene = "TestDungeon",
                HasSave = () => Saga.Dungeon.Data.SaveState.HasSave, DeleteSave = Saga.Dungeon.Data.SaveState.DeleteSave,
                ToJson = Saga.Dungeon.Data.SaveState.ToJson, ApplyJson = Saga.Dungeon.Data.SaveState.ApplyJson },
            new Game { Key = "forest", Name = "사가의숲", Tagline = "숲속 마을을 가꾸는 느긋한 하루", NameEn = "Saga Forest", TaglineEn = "Slow days tending a village in the woods", Scene = "TestVillageForest",
                HasSave = () => Saga.Forest.Data.ForestSaveState.HasSave, DeleteSave = Saga.Forest.Data.ForestSaveState.DeleteSave,
                ToJson = Saga.Forest.Data.ForestSaveState.ToJson, ApplyJson = Saga.Forest.Data.ForestSaveState.ApplyJson },
            new Game { Key = "story", Name = "사가스토리", Tagline = "옆으로 달리며 무예를 키우는 성장 액션", NameEn = "Saga Story", TaglineEn = "Side-scrolling action, growing your arts", Scene = "TestField",
                HasSave = () => Saga.Story.Data.StorySaveState.HasSave, DeleteSave = Saga.Story.Data.StorySaveState.DeleteSave,
                ToJson = Saga.Story.Data.StorySaveState.ToJson, ApplyJson = Saga.Story.Data.StorySaveState.ApplyJson },
            new Game { Key = "realm", Name = "사가국지", Tagline = "성을 다스려 천하를 겨루는 경영 전략", NameEn = "Saga Realm", TaglineEn = "Rule castles and contend for the realm", Scene = "TestCity",
                HasSave = () => Saga.Realm.Data.RealmSaveState.HasSave, DeleteSave = Saga.Realm.Data.RealmSaveState.DeleteSave,
                ToJson = Saga.Realm.Data.RealmSaveState.ToJson, ApplyJson = Saga.Realm.Data.RealmSaveState.ApplyJson },
        };

        /// <summary>버전은 PlayerSettings.bundleVersion 한 곳(빌드 스크립트가 안드로이드 버전 코드도 여기서 셈).</summary>
        public static string Version => Application.version;

        public static string DisplayName(Game g) => SagaUi.L(g.Name, g.NameEn);
        public static string DisplayTagline(Game g) => SagaUi.L(g.Tagline, g.TaglineEn);

        /// <summary>앱을 켜고 어느 판에도 들어가기 전에 뜬 기본 상태(판 키 → 세이브 JSON). 판을 먼저 연 실행이면 비어 있다.</summary>
        private static readonly Dictionary<string, string> Defaults = new Dictionary<string, string>();
        /// <summary>진단 — 마지막 "새로 시작"이 기본값으로 되돌렸고, 되돌린 뒤 상태가 기본값과 같았는지(판 키 → 결과).</summary>
        public static readonly Dictionary<string, bool> LastResetMatched = new Dictionary<string, bool>();

        public static TitleScreen Instance { get; private set; }

        public readonly List<Button> ContinueButtons = new List<Button>();
        public readonly List<Button> NewButtons = new List<Button>();
        public Button QuitButton { get; private set; }
        public Button ConfirmYes { get; private set; }
        public Button ConfirmNo { get; private set; }
        public bool ConfirmOpen => _confirm != null && _confirm.activeSelf;
        public string ConfirmText => _confirmText != null ? _confirmText.text : "";
        public Canvas Canvas { get; private set; }

        // PLAN.md 110 ⑤c — 타이틀 설정(다섯 판 공통, `TitleSettings`).
        public Button SettingsButton { get; private set; }
        public Button LanguageButton { get; private set; }
        public Button VolumeButton { get; private set; }
        public Button BgmButton { get; private set; }
        public Button SfxButton { get; private set; }
        public Button VibrationButton { get; private set; }
        public Button SettingsClose { get; private set; }
        public bool SettingsOpen => _settings != null && _settings.activeSelf;
        private GameObject _settings;

        // PLAN.md 110 ⑥ — 크레딧(출처·라이선스 전문)과 오류 기록(설정 줄, 복사).
        public Button CreditsButton { get; private set; }
        public Button CreditsClose { get; private set; }
        public Button ErrorLogButton { get; private set; }
        public bool CreditsOpen => _credits != null && _credits.activeSelf;
        public int CreditsChunks => _creditsContent != null ? _creditsContent.childCount : 0;
        private GameObject _credits;
        private RectTransform _creditsContent;
        private ScrollRect _creditsScroll;

        private GameObject _confirm;
        private TextMeshProUGUI _confirmText;
        private int _pending = -1;

        // PLAN.md 110 ③ — 측정용 빌드(SAGA_PERF)에서만: 자동 측정·성능 기록표.
        public Button BenchmarkButton { get; private set; }
        public Button PerfButton { get; private set; }
        public bool PerfOpen => _perf != null && _perf.activeSelf;
        public string PerfText => _perfText != null ? _perfText.text : "";
        private GameObject _perf;
        private TextMeshProUGUI _perfText;
        private static bool _openPerfNext;

        static TitleScreen()
        {
            SagaPerf.BenchmarkFinished += () => _openPerfNext = true;
        }

        public void StartBenchmark()
        {
            var list = new List<(string key, string scene)>();
            foreach (var g in Games) list.Add((g.Key, g.Scene));
            SagaPerf.RunBenchmark(list);
        }

        public void ShowPerf(bool on)
        {
            if (_perf == null) return;
            if (on) _perfText.text = PerfTable();
            _perf.SetActive(on);
        }

        public static string PerfTable()
        {
            var recs = SagaPerf.LoadLog();
            if (recs.Count == 0) return "기록 없음 — \"자동 측정\"을 누르거나 판을 한동안 놀고 돌아오세요.";
            var sb = new System.Text.StringBuilder();
            var last = recs[recs.Count - 1];
            sb.AppendLine($"<color=#F2C760>{last.device} · {last.width}×{last.height} · 품질 {last.quality}</color>");
            int from = Mathf.Max(0, recs.Count - 14);
            for (int i = from; i < recs.Count; i++) sb.AppendLine(SagaPerf.Row(recs[i]));
            return sb.ToString();
        }

        private void Awake()
        {
            Instance = this;
            Time.timeScale = 1f;
            CaptureDefaults();
            TitleSettings.SyncCoreLanguage();
            SagaUi.EnsureEventSystem();
            Build();
            int saved = 0;
            foreach (var g in Games) if (g.HasSave()) saved++;
            // 빌드 연기 시험이 플레이어 로그에서 이 줄을 찾는다.
            Debug.Log($"[TitleScreen] 카드 {NewButtons.Count} · 저장 {saved} · 글꼴 {(TMP_Settings.defaultFontAsset != null ? TMP_Settings.defaultFontAsset.name : "없음")}");
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        /// <summary>어느 판에도 안 들어간 실행에서만 한 번 뜬다(판의 정적 상태가 아직 초기값일 때).</summary>
        public static void CaptureDefaults()
        {
            if (Defaults.Count > 0 || SagaFlow.EnteredThisRun.Count > 0) return;
            foreach (var g in Games) Defaults[g.Key] = g.ToJson();
        }

        public static bool HasDefaults(string key) => Defaults.ContainsKey(key);
        public static string DefaultJson(string key) => Defaults.TryGetValue(key, out var j) ? j : null;

        public static int IndexOf(string key)
        {
            for (int i = 0; i < Games.Length; i++) if (Games[i].Key == key) return i;
            return -1;
        }

        public void Continue(int i) => SceneManager.LoadScene(Games[i].Scene);

        /// <summary>"새로 시작" — 저장이 있으면 먼저 묻는다.</summary>
        public void RequestNew(int i)
        {
            if (!Games[i].HasSave()) { StartNew(i); return; }
            _pending = i;
            _confirmText.text = SagaUi.En
                ? $"Delete the {Games[i].NameEn} save and start over?\n<size=70%><color=#B8B2A8>A deleted save can't be recovered.</color></size>"
                : $"{Games[i].Name}의 저장을 지우고 처음부터 시작할까요?\n<size=70%><color=#B8B2A8>지운 저장은 되돌릴 수 없습니다.</color></size>";
            _confirm.SetActive(true);
        }

        private void OnConfirmYes()
        {
            _confirm.SetActive(false);
            if (_pending >= 0) StartNew(_pending);
            _pending = -1;
        }

        private void OnConfirmNo()
        {
            _confirm.SetActive(false);
            _pending = -1;
        }

        private void StartNew(int i)
        {
            var g = Games[i];
            g.DeleteSave();
            if (SagaFlow.EnteredThisRun.Contains(g.Key))
            {
                string def = DefaultJson(g.Key);
                if (def != null)
                {
                    g.ApplyJson(def);
                    LastResetMatched[g.Key] = g.ToJson() == def;
                }
                else
                {
                    LastResetMatched[g.Key] = false;
                    Debug.LogWarning($"[TitleScreen] {g.Key} 기본값이 없어(판을 먼저 연 실행) 메모리 상태를 못 되돌렸다");
                }
            }
            SceneManager.LoadScene(g.Scene);
        }

        private void Build()
        {
            Canvas = SagaUi.NewCanvas("TitleCanvas", 0, transform);
            var root = Canvas.transform;
            bool narrow = SagaUi.IsNarrow();

            var bg = SagaUi.Fill(root, "Background").gameObject.AddComponent<RawImage>();
            bg.texture = GradientTexture();

            var top = new Vector2(0.5f, 1f);
            var title = SagaUi.NewText(root, "SAGA", 150f, SagaUi.Gold, top, new Vector2(0f, narrow ? -140f : -115f), new Vector2(900f, 170f));
            title.fontStyle = FontStyles.Bold;
            title.characterSpacing = 18f;
            SagaUi.NewText(root, SagaUi.L("역사 인물로 노는 다섯 판", "Five games with figures from history"), 36f, SagaUi.InkDim, top, new Vector2(0f, narrow ? -265f : -255f), new Vector2(900f, 60f));

            var cards = SagaUi.NewRect(root, "Cards", new Vector2(0.5f, 0.5f), new Vector2(0f, narrow ? -40f : -30f), Vector2.zero);
            Vector2 cardSize = narrow ? new Vector2(880f, 230f) : new Vector2(330f, 470f);
            for (int i = 0; i < Games.Length; i++)
            {
                Vector2 pos = narrow
                    ? new Vector2(0f, (2 - i) * 250f)
                    : new Vector2((i - 2) * 355f, 0f);
                BuildCard(cards, i, pos, cardSize, narrow);
            }

            var bottom = new Vector2(0.5f, 0f);
            bool canQuit = Application.platform != RuntimePlatform.IPhonePlayer;
            // 아래 줄: 설정 · 크레딧 · (게임 종료 — iOS 는 없음), 340 간격 가운데 맞춤
            int n = canQuit ? 3 : 2;
            float X(int i) => (i - (n - 1) * 0.5f) * 340f;
            SettingsButton = SagaUi.NewButton(root, "Settings", SagaUi.L("설정", "Settings"), bottom, new Vector2(X(0), 70f), new Vector2(300f, 80f), SagaUi.ButtonIdle, 30f);
            SettingsButton.onClick.AddListener(() => ShowSettings(true));
            CreditsButton = SagaUi.NewButton(root, "Credits", SagaUi.L("크레딧", "Credits"), bottom, new Vector2(X(1), 70f), new Vector2(300f, 80f), SagaUi.ButtonIdle, 30f);
            CreditsButton.onClick.AddListener(() => ShowCredits(true));
            QuitButton = SagaUi.NewButton(root, "Quit", SagaUi.L("게임 종료", "Quit game"), bottom, new Vector2(X(2), 70f), new Vector2(300f, 80f), SagaUi.ButtonIdle, 30f);
            QuitButton.onClick.AddListener(Application.Quit);
            QuitButton.gameObject.SetActive(canQuit);
            SagaUi.NewText(root, "v" + Version, 24f, SagaUi.InkDim, new Vector2(1f, 0f), new Vector2(-90f, 30f), new Vector2(160f, 40f));

            BuildConfirm(root);
            BuildSettings(root);
            BuildCredits(root);
            if (SagaPerf.Enabled) BuildPerf(root);
        }

        /// <summary>언어를 바꾸면 타이틀 글자를 새 언어로 다시 짓는다(설정 창은 연 채로). 옛 캔버스는 떼어 끄고 지운다
        /// (onClick 안이라 같은 프레임에 새로 지어도 안 쌓이게).</summary>
        private void Rebuild()
        {
            var old = Canvas.gameObject;
            old.SetActive(false);
            old.transform.SetParent(null);
            Destroy(old);
            ContinueButtons.Clear();
            NewButtons.Clear();
            Build();
            ShowSettings(true);
        }

        public void ShowSettings(bool on)
        {
            if (_settings == null) return;
            if (on) RefreshSettings();
            _settings.SetActive(on);
        }

        private void RefreshSettings()
        {
            SetLabel(LanguageButton, TitleSettings.LanguageLabel());
            SetLabel(VolumeButton, TitleSettings.VolumeLabel());
            SetLabel(BgmButton, TitleSettings.BgmLabel());
            SetLabel(SfxButton, TitleSettings.SfxLabel());
            if (VibrationButton != null) SetLabel(VibrationButton, TitleSettings.VibrationLabel());
            SetLabel(ErrorLogButton, ErrorLogLabel());
        }

        /// <summary>오류 기록 줄 — 없으면 "없음", 있으면 건수·복사(누르면 클립보드로, 시험하는 사람이 메신저에 붙여 보낸다).</summary>
        private static string ErrorLogLabel()
        {
            int n = SagaCrashLog.Count;
            return n == 0 ? SagaUi.L("없음", "None") : SagaUi.L($"{n}건 · 복사", $"{n} · Copy");
        }

        private void OnErrorLog()
        {
            string text = SagaCrashLog.Read();
            if (text.Length == 0) { RefreshSettings(); return; }
            GUIUtility.systemCopyBuffer = text;
            SetLabel(ErrorLogButton, SagaUi.L("복사했습니다", "Copied"));
        }

        public void ShowCredits(bool on)
        {
            if (_credits == null) return;
            if (on && _creditsContent.childCount == 0) FillCredits();
            if (on) _creditsScroll.verticalNormalizedPosition = 1f;
            _credits.SetActive(on);
        }

        private void BuildCredits(Transform root)
        {
            _credits = SagaUi.Fill(root, "CreditsModal").gameObject;
            _credits.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0.8f);
            var panel = SagaUi.NewPanel(_credits.transform, "Panel", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1500f, 960f), SagaUi.Panel);
            SagaUi.NewText(panel.transform, SagaUi.L("크레딧", "Credits"), 50f, SagaUi.Gold, new Vector2(0.5f, 1f), new Vector2(0f, -30f), new Vector2(1300f, 80f)).fontStyle = FontStyles.Bold;

            var view = new GameObject("CreditsScroll", typeof(RectTransform), typeof(Image), typeof(RectMask2D), typeof(ScrollRect));
            view.transform.SetParent(panel.transform, false);
            var viewRect = (RectTransform)view.transform;
            viewRect.anchorMin = Vector2.zero;
            viewRect.anchorMax = Vector2.one;
            viewRect.offsetMin = new Vector2(50f, 140f);  // 닫기(아래 36~120) 위
            viewRect.offsetMax = new Vector2(-50f, -120f); // 제목 아래
            view.GetComponent<Image>().color = new Color(0f, 0f, 0f, 0f); // 끌기를 받는 투명 판
            var content = new GameObject("Content", typeof(RectTransform), typeof(VerticalLayoutGroup), typeof(ContentSizeFitter));
            content.transform.SetParent(view.transform, false);
            _creditsContent = (RectTransform)content.transform;
            _creditsContent.anchorMin = new Vector2(0f, 1f);
            _creditsContent.anchorMax = Vector2.one;
            _creditsContent.pivot = new Vector2(0.5f, 1f);
            _creditsContent.anchoredPosition = Vector2.zero;
            _creditsContent.sizeDelta = Vector2.zero;
            var layout = content.GetComponent<VerticalLayoutGroup>();
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            layout.spacing = 6f;
            layout.padding = new RectOffset(10, 10, 6, 30);
            content.GetComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            _creditsScroll = view.GetComponent<ScrollRect>();
            _creditsScroll.viewport = viewRect;
            _creditsScroll.content = _creditsContent;
            _creditsScroll.horizontal = false;
            _creditsScroll.movementType = ScrollRect.MovementType.Clamped;
            _creditsScroll.scrollSensitivity = 60f;

            CreditsClose = SagaUi.NewButton(panel.transform, "Close", SagaUi.L("닫기", "Close"), new Vector2(0.5f, 0f), new Vector2(0f, 36f), new Vector2(300f, 84f), SagaUi.ButtonAccent, 32f);
            CreditsClose.onClick.AddListener(() => ShowCredits(false));
            _credits.SetActive(false);
        }

        /// <summary>처음 열 때 채운다 — 머리(쓰인 출처, 두 언어) + 라이선스 전문(영어 원문). 전문은 95KB 라 글 하나에 다 넣으면
        /// 메시 정점 한도를 넘으니 줄 묶음(~2400자)마다 글을 나눈다. 전문은 꺾쇠(&lt;URL&gt;)가 많아 서식 해석을 끈다.</summary>
        private void FillCredits()
        {
            string head = SagaUi.L("SAGA — 역사 인물로 노는 다섯 판\n\n", "SAGA — Five games with figures from history\n\n") + SagaCredits.Summary(SagaUi.En);
            AddCreditsText(head, 30f, SagaUi.Ink, true);
            string legal = SagaCredits.LegalBody();
            if (legal.Length == 0) return;
            var sb = new System.Text.StringBuilder();
            void Flush()
            {
                if (sb.Length > 0) AddCreditsText(sb.ToString().TrimEnd(), 20f, SagaUi.InkDim, false);
                sb.Clear();
            }
            foreach (var line in legal.Split('\n'))
            {
                if (line.StartsWith("==== "))
                {
                    Flush();
                    AddCreditsText("\n" + line.Trim('=', ' '), 24f, SagaUi.Gold, false);
                    continue;
                }
                if (sb.Length > 2400) Flush();
                sb.Append(line).Append('\n');
            }
            Flush();
        }

        private void AddCreditsText(string text, float size, Color color, bool rich)
        {
            if (text.Trim().Length == 0) return;
            var t = SagaUi.NewText(_creditsContent, text, size, color, new Vector2(0.5f, 1f), Vector2.zero, new Vector2(1380f, 100f), TextAlignmentOptions.TopLeft);
            t.richText = rich;
        }

        private static void SetLabel(Button b, string text) => b.GetComponentInChildren<TMP_Text>().text = text;

        private void OnLanguage() { TitleSettings.CycleLanguage(); Rebuild(); }
        private void OnVolume() { TitleSettings.CycleVolume(); RefreshSettings(); }
        private void OnBgm() { TitleSettings.ToggleBgm(); RefreshSettings(); }
        private void OnSfx() { TitleSettings.ToggleSfx(); RefreshSettings(); }
        private void OnVibration() { TitleSettings.ToggleVibration(); RefreshSettings(); }

        private void BuildSettings(Transform root)
        {
            _settings = SagaUi.Fill(root, "SettingsModal").gameObject;
            _settings.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0.7f);
            var rows = new List<(string label, Action onClick, Action<Button> keep)>
            {
                (SagaUi.L("언어", "Language"), OnLanguage, b => LanguageButton = b),
                (SagaUi.L("전체 음량", "Master volume"), OnVolume, b => VolumeButton = b),
                (SagaUi.L("배경음", "Music"), OnBgm, b => BgmButton = b),
                (SagaUi.L("효과음", "Sound effects"), OnSfx, b => SfxButton = b),
            };
            VibrationButton = null;
            if (TitleSettings.ShowVibration) rows.Add((SagaUi.L("진동", "Vibration"), OnVibration, b => VibrationButton = b));
            rows.Add((SagaUi.L("오류 기록", "Error log"), OnErrorLog, b => ErrorLogButton = b));
            const float rowH = 104f;
            float h = 180f + rows.Count * rowH + 130f; // 제목 180 · 줄 · 닫기 칸 130 (NewRect 는 앵커 = 기준점이라 위 기준 자리는 칸의 윗변)
            var panel = SagaUi.NewPanel(_settings.transform, "Panel", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(900f, h), SagaUi.Panel);
            SagaUi.NewText(panel.transform, SagaUi.L("설정", "Settings"), 50f, SagaUi.Gold, new Vector2(0.5f, 1f), new Vector2(0f, -36f), new Vector2(800f, 80f)).fontStyle = FontStyles.Bold;
            SagaUi.NewText(panel.transform, SagaUi.L("다섯 판에 함께 적용됩니다", "Applies to all five games"), 26f, SagaUi.InkDim,
                new Vector2(0.5f, 1f), new Vector2(0f, -122f), new Vector2(800f, 40f));
            for (int i = 0; i < rows.Count; i++)
            {
                float y = -180f - i * rowH;
                SagaUi.NewText(panel.transform, rows[i].label, 34f, SagaUi.Ink, new Vector2(0f, 1f), new Vector2(60f, y - 7f), new Vector2(380f, 70f), TextAlignmentOptions.Left);
                var b = SagaUi.NewButton(panel.transform, "Row_" + i, "", new Vector2(1f, 1f), new Vector2(-60f, y), new Vector2(380f, 84f), SagaUi.ButtonIdle, 32f);
                var click = rows[i].onClick;
                b.onClick.AddListener(() => click());
                rows[i].keep(b);
            }
            SettingsClose = SagaUi.NewButton(panel.transform, "Close", SagaUi.L("닫기", "Close"), new Vector2(0.5f, 0f), new Vector2(0f, 36f), new Vector2(300f, 84f), SagaUi.ButtonAccent, 32f);
            SettingsClose.onClick.AddListener(() => ShowSettings(false));
            _settings.SetActive(false);
        }

        private void BuildCard(RectTransform parent, int i, Vector2 pos, Vector2 size, bool narrow)
        {
            var g = Games[i];
            var card = SagaUi.NewPanel(parent, "Card_" + g.Key, new Vector2(0.5f, 0.5f), pos, size, SagaUi.Panel);
            bool saved = g.HasSave();
            if (narrow)
            {
                SagaUi.NewText(card.transform, DisplayName(g), 48f, SagaUi.Ink, new Vector2(0f, 1f), new Vector2(250f, -55f), new Vector2(460f, 70f), TextAlignmentOptions.Left).fontStyle = FontStyles.Bold;
                SagaUi.NewText(card.transform, DisplayTagline(g), 28f, SagaUi.InkDim, new Vector2(0f, 1f), new Vector2(250f, -120f), new Vector2(460f, 80f), TextAlignmentOptions.TopLeft);
                SagaUi.NewText(card.transform, saved ? SagaUi.L("저장 있음", "Saved") : SagaUi.L("처음", "New"), 26f, saved ? SagaUi.Gold : SagaUi.InkDim, new Vector2(0f, 0f), new Vector2(250f, 30f), new Vector2(460f, 40f), TextAlignmentOptions.Left);
                AddButtons(card.transform, i, saved, new Vector2(1f, 0.5f), new Vector2(-150f, 45f), new Vector2(-150f, -50f), new Vector2(260f, 80f));
            }
            else
            {
                SagaUi.NewText(card.transform, DisplayName(g), 50f, SagaUi.Ink, new Vector2(0.5f, 1f), new Vector2(0f, -60f), new Vector2(300f, 70f)).fontStyle = FontStyles.Bold;
                SagaUi.NewText(card.transform, DisplayTagline(g), 28f, SagaUi.InkDim, new Vector2(0.5f, 1f), new Vector2(0f, -160f), new Vector2(280f, 120f), TextAlignmentOptions.Top);
                SagaUi.NewText(card.transform, saved ? SagaUi.L("저장 있음", "Saved") : SagaUi.L("처음", "New"), 26f, saved ? SagaUi.Gold : SagaUi.InkDim, new Vector2(0.5f, 1f), new Vector2(0f, -250f), new Vector2(280f, 40f));
                AddButtons(card.transform, i, saved, new Vector2(0.5f, 0f), new Vector2(0f, 150f), new Vector2(0f, 55f), new Vector2(280f, 80f));
            }
        }

        private void AddButtons(Transform card, int i, bool saved, Vector2 anchor, Vector2 firstPos, Vector2 secondPos, Vector2 size)
        {
            int idx = i;
            Button cont = null;
            if (saved)
            {
                cont = SagaUi.NewButton(card, "Continue", SagaUi.L("이어하기", "Continue"), anchor, firstPos, size, SagaUi.ButtonAccent, 32f);
                cont.onClick.AddListener(() => Continue(idx));
            }
            var fresh = SagaUi.NewButton(card, "New", SagaUi.L("새로 시작", "New game"), anchor, saved ? secondPos : firstPos, size,
                saved ? SagaUi.ButtonIdle : SagaUi.ButtonAccent, 32f);
            fresh.onClick.AddListener(() => RequestNew(idx));
            ContinueButtons.Add(cont);
            NewButtons.Add(fresh);
        }

        private void BuildConfirm(Transform root)
        {
            _confirm = SagaUi.Fill(root, "Confirm").gameObject;
            _confirm.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0.7f);
            var panel = SagaUi.NewPanel(_confirm.transform, "Panel", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(820f, 380f), SagaUi.Panel);
            _confirmText = SagaUi.NewText(panel.transform, "", 36f, SagaUi.Ink, new Vector2(0.5f, 1f), new Vector2(0f, -110f), new Vector2(740f, 160f));
            ConfirmYes = SagaUi.NewButton(panel.transform, "Yes", SagaUi.L("지우고 시작", "Delete & start"), new Vector2(0.5f, 0f), new Vector2(-170f, 70f), new Vector2(300f, 84f), SagaUi.ButtonAccent, 32f);
            ConfirmNo = SagaUi.NewButton(panel.transform, "No", SagaUi.L("취소", "Cancel"), new Vector2(0.5f, 0f), new Vector2(170f, 70f), new Vector2(300f, 84f), SagaUi.ButtonIdle, 32f);
            ConfirmYes.onClick.AddListener(OnConfirmYes);
            ConfirmNo.onClick.AddListener(OnConfirmNo);
            _confirm.SetActive(false);
        }

        private void BuildPerf(Transform root)
        {
            var corner = new Vector2(1f, 1f);
            BenchmarkButton = SagaUi.NewButton(root, "Benchmark", "자동 측정", corner, new Vector2(-150f, -60f), new Vector2(240f, 70f), SagaUi.ButtonAccent, 28f);
            PerfButton = SagaUi.NewButton(root, "PerfLog", "성능 기록", corner, new Vector2(-150f, -140f), new Vector2(240f, 70f), SagaUi.ButtonIdle, 28f);
            BenchmarkButton.onClick.AddListener(StartBenchmark);
            PerfButton.onClick.AddListener(() => ShowPerf(true));

            _perf = SagaUi.Fill(root, "Perf").gameObject;
            _perf.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0.8f);
            var panel = SagaUi.NewPanel(_perf.transform, "Panel", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1500f, 860f), SagaUi.Panel);
            SagaUi.NewText(panel.transform, "성능 기록 — 판마다 상한(30fps 그대로) · 풀기(상한 없이 여유)", 34f, SagaUi.Gold,
                new Vector2(0.5f, 1f), new Vector2(0f, -50f), new Vector2(1400f, 60f));
            _perfText = SagaUi.NewText(panel.transform, "", 24f, SagaUi.Ink, new Vector2(0.5f, 1f), new Vector2(0f, -440f), new Vector2(1420f, 680f),
                TextAlignmentOptions.TopLeft);
            var clear = SagaUi.NewButton(panel.transform, "Clear", "기록 지우기", new Vector2(0.5f, 0f), new Vector2(-170f, 60f), new Vector2(280f, 76f), SagaUi.ButtonIdle, 28f);
            var close = SagaUi.NewButton(panel.transform, "Close", "닫기", new Vector2(0.5f, 0f), new Vector2(170f, 60f), new Vector2(280f, 76f), SagaUi.ButtonAccent, 28f);
            clear.onClick.AddListener(() => { SagaPerf.ClearLog(); ShowPerf(true); });
            close.onClick.AddListener(() => ShowPerf(false));
            _perf.SetActive(false);
            if (_openPerfNext) { _openPerfNext = false; ShowPerf(true); }
        }

        /// <summary>위 먹빛 → 아래 옅은 쪽빛 세로 그러데이션(텍스처 한 장, 코드로 굽는다).</summary>
        private static Texture2D GradientTexture()
        {
            const int h = 256;
            var tex = new Texture2D(1, h, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            var top = new Color(0.05f, 0.05f, 0.07f);
            var bottom = new Color(0.16f, 0.17f, 0.24f);
            for (int y = 0; y < h; y++) tex.SetPixel(0, y, Color.Lerp(bottom, top, y / (h - 1f)));
            tex.Apply();
            return tex;
        }
    }
}
