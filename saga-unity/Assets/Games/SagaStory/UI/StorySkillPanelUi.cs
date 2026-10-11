using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Story.Data;

namespace Saga.Story.UI
{
    /// <summary>
    /// PLAN.md 101-2 STORY 5-2 1단계 — 무예 점수(SP)를 직업 무예에 붓는 화면. 웹판
    /// 무예 탭(`saga-web/saga-story/js/ui.js`)의 "이름 · 레벨 · 설명 · +" 줄을 옮겼다.
    /// `StoryJobChoiceUi`와 같은 결로 자기 UI를 스스로 짓되, 줄은 직업이 정해진 뒤에야
    /// 알 수 있어 열 때마다 다시 그린다. 여는 길: K키 · 모바일 "무예" 버튼 · 전직관(전직 뒤).
    ///
    /// **3단계(2026-09-23)** — 4차까지 오르면 사슬 무예가 최대 23줄이라 한 화면에 안 들어간다.
    /// 웹판 무예 탭의 차수 소제목을 **차수 탭**(1차~지금 자리)으로 바꿔 한 번에 한 차수(≤6줄)만
    /// 보이고, 열면 지금 자리 탭부터 연다. 줄마다 "칸" 버튼으로 무예 칸 고정을 켜고 끈다
    /// (`StorySkillState.TogglePin`), 탭 아래 한 줄에 지금 칸 넷을 보여 준다.
    /// 탭·칸 줄은 줄 버튼처럼 런타임에 짓는다(씬 저장 때 onClick이 안 남는 함정을 피한다).
    /// </summary>
    public class StorySkillPanelUi : MonoBehaviour
    {
        public static StorySkillPanelUi Instance { get; private set; }

        [SerializeField] private GameObject _panel;
        [SerializeField] private TextMeshProUGUI _titleLabel;
        [SerializeField] private TextMeshProUGUI _statusLabel;
        [SerializeField] private Transform _rows;
        [SerializeField] private TextMeshProUGUI _closeLabel;
        // Build()(에디터 전용)가 거는 onClick은 씬 저장 때 안 남아 참조만 두고 Awake()에서 건다
        // (StoryJobChoiceUi 클래스의 같은 주석 참고). 줄 버튼은 Redraw()가 런타임에 지어 괜찮다.
        [SerializeField] private Button _closeButton;

        public bool IsShowing => _panel != null && _panel.activeSelf;

        private void Awake()
        {
            Instance = this;
            if (_closeButton != null) _closeButton.onClick.AddListener(Hide);
        }

        private void OnEnable() => StorySkillState.Changed += OnChanged;

        private void OnDisable() => StorySkillState.Changed -= OnChanged;

        public void Build()
        {
            Instance = this;

            var canvas = NewCanvas("StorySkillPanelUI");
            canvas.transform.SetParent(transform, false);

            // 2026-09-23 — 줄 영역은 EnsureChrome()이 탭·칸 줄 아래로 다시 잡는다(차수 탭, 3단계).
            _panel = NewPanel(canvas.transform, new Vector2(0.5f, 0.5f), PanelSize,
                new Color(0f, 0f, 0f, 0.88f));
            _panel.SetActive(false);

            _titleLabel = NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -30f), new Vector2(RowsWidth, 64f), 30);
            _statusLabel = NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -95f), new Vector2(RowsWidth, 50f), 22);

            var rowsGo = new GameObject("Rows", typeof(RectTransform));
            rowsGo.transform.SetParent(_panel.transform, false);
            var rect = (RectTransform)rowsGo.transform;
            rect.anchorMin = rect.anchorMax = rect.pivot = new Vector2(0.5f, 1f);
            rect.anchoredPosition = new Vector2(0f, RowsTop);
            rect.sizeDelta = new Vector2(RowsWidth, RowsHeight);
            _rows = rowsGo.transform;

            _closeButton = NewButton(_panel.transform, StoryLocalization.T("settings.close"),
                new Vector2(0.5f, 0f), new Vector2(0f, CloseY), new Vector2(300f, 70f), null);
            _closeLabel = _closeButton.GetComponentInChildren<TextMeshProUGUI>();
        }

        private void Update()
        {
            var kb = Keyboard.current;
            if (kb != null && kb.kKey.wasPressedThisFrame) Toggle();
        }

        public void Toggle()
        {
            if (IsShowing) Hide();
            else Show();
        }

        public void Show()
        {
            if (_panel == null) return;
            _panel.SetActive(true);
            _statusLabel.text = "";
            _tab = Mathf.Max(1, StoryJobState.Tier);
            Redraw();
        }

        /// <summary>차수 탭 버튼 onClick과 같은 경로 — PlaytestStorySlice가 부른다.</summary>
        public void SelectTab(int tier)
        {
            _tab = Mathf.Clamp(tier, 1, Mathf.Max(1, StoryJobState.Tier));
            _statusLabel.text = "";
            Redraw();
        }

        /// <summary>줄의 "칸" 버튼 onClick과 같은 경로 — PlaytestStorySlice가 부른다.</summary>
        public void ClickPin(string key)
        {
            string why = StorySkillState.TogglePin(key); // Changed → OnChanged → Redraw
            _statusLabel.text = why != null ? StoryLocalization.T(why) : "";
        }

        public int CurrentTab => _tab;
        public int TabCount => _tabButtons.Count;
        public string SlotsText => _slotsLabel != null ? _slotsLabel.text : "";

        public void Hide()
        {
            if (_panel != null) _panel.SetActive(false);
        }

        /// <summary>줄 버튼 onClick과 같은 경로 — PlaytestStorySlice가 리플렉션 없이 부른다.</summary>
        public void ClickRaise(string key)
        {
            string why = StorySkillState.CanRaise(key);
            if (why != null)
            {
                _statusLabel.text = StoryLocalization.T(why);
                return;
            }
            StorySkillState.Raise(key); // Changed → OnChanged → Redraw
            _statusLabel.text = "";
        }

        /// <summary>테스트가 줄 수를 확인하는 용도.</summary>
        public int RowCount => _rows != null ? _rows.childCount : 0;

        private void OnChanged()
        {
            if (IsShowing) Redraw();
        }

        private void Redraw()
        {
            if (_closeLabel != null) _closeLabel.text = StoryLocalization.T("settings.close");

            EnsureChrome();
            if (!StoryJobState.HasJob)
            {
                ClearRows();
                ClearTabs();
                _slotsLabel.text = "";
                _rowJob = null;
                _titleLabel.text = StoryLocalization.T("skill.panel_title_nojob", "무예");
                _statusLabel.text = string.Format(StoryLocalization.T("skill.panel_nojob", "전직(Lv.{0}) 뒤에 직업 무예를 익힌다"),
                    StoryCombat.JobChangeLevel);
                return;
            }

            string jobName = StoryLocalization.T($"job.{StoryJobState.Job}", StoryJobState.JobDisplayName);
            _titleLabel.text = string.Format(StoryLocalization.T("skill.panel_title", "{0} 무예 — 강화 점수 {1}"),
                jobName, StorySkillState.SpLeft);

            _tab = Mathf.Clamp(_tab, 1, StoryJobState.Tier);
            RedrawTabs();
            _slotsLabel.text = SlotsLine();

            // 줄 구성(직업·탭)이 그대로면 글자만 고친다 — "+"·"칸" 버튼 onClick 한가운데서 그
            // 버튼을 지우면 이벤트 시스템이 이미 파괴된 버튼을 계속 붙든다.
            var skills = StorySkillData.OfChain().FindAll(sk => sk.Tier == _tab);
            if (_rowJob == StoryJobState.Job && _rowTier == _tab && _rowLabels.Count == skills.Count && RowCount == skills.Count)
            {
                for (int i = 0; i < skills.Count; i++)
                {
                    _rowLabels[i].text = RowText(skills[i]);
                    _pinLabels[i].text = PinText(skills[i]);
                }
                return;
            }

            ClearRows();
            _rowJob = StoryJobState.Job;
            _rowTier = _tab;
            // 두 열(왼쪽 먼저 위→아래). 하나뿐이면 가운데.
            int perCol = Mathf.Max(1, (skills.Count + 1) / 2);
            float step = Mathf.Min(150f, RowsHeight / perCol);
            for (int i = 0; i < skills.Count; i++)
            {
                float x = skills.Count == 1 ? 0f : (i < perCol ? -ColumnX : ColumnX);
                _rowLabels.Add(BuildRow(skills[i], x, -(i % perCol) * step, step - 10f));
            }
        }

        // 110 ⑤c-2 — 가로 판(옛 900×1600 세로 판은 가로 화면 논리 높이 900 을 두 배 가까이 넘었다).
        // 제목(-30)·상태(-95)·탭(-150)·칸 줄(-212) 아래부터 닫기(아래 30~100) 위까지, 줄은 두 열.
        private static readonly Vector2 PanelSize = new Vector2(1500f, 860f);
        private const float RowsWidth = 1440f;
        private const float RowWidth = 700f;
        private const float ColumnX = 370f;
        private const float RowsTop = -265f;
        private const float RowsHeight = 480f;
        private const float CloseY = 30f;

        private string _rowJob;
        private int _rowTier;
        private int _tab = 1;
        private readonly System.Collections.Generic.List<TextMeshProUGUI> _rowLabels = new System.Collections.Generic.List<TextMeshProUGUI>();
        private readonly System.Collections.Generic.List<TextMeshProUGUI> _pinLabels = new System.Collections.Generic.List<TextMeshProUGUI>();
        private readonly System.Collections.Generic.List<Button> _tabButtons = new System.Collections.Generic.List<Button>();
        private Transform _tabsRoot;
        private TextMeshProUGUI _slotsLabel;

        /// <summary>탭 줄·칸 줄을 (없으면) 짓고 줄 영역을 그 아래로 내린다 — 옛 씬(3단계 전
        /// Build)도 재빌드 없이 맞는다.</summary>
        private void EnsureChrome()
        {
            if (_tabsRoot == null)
            {
                var go = new GameObject("Tabs", typeof(RectTransform));
                go.transform.SetParent(_panel.transform, false);
                var r = (RectTransform)go.transform;
                r.anchorMin = r.anchorMax = r.pivot = new Vector2(0.5f, 1f);
                r.anchoredPosition = new Vector2(0f, -150f);
                r.sizeDelta = new Vector2(RowsWidth, 60f);
                _tabsRoot = go.transform;
            }
            if (_slotsLabel == null)
            {
                _slotsLabel = NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -212f), new Vector2(RowsWidth, 44f), 22);
            }
            if (_rows is RectTransform rows)
            {
                rows.anchoredPosition = new Vector2(0f, RowsTop);
                rows.sizeDelta = new Vector2(RowsWidth, RowsHeight);
            }
            // 옛 씬(세로 판으로 지은 것)도 재빌드 없이 가로 판으로.
            ((RectTransform)_panel.transform).sizeDelta = PanelSize;
            Place(_titleLabel != null ? _titleLabel.rectTransform : null, new Vector2(0f, -30f), new Vector2(RowsWidth, 64f));
            Place(_statusLabel != null ? _statusLabel.rectTransform : null, new Vector2(0f, -95f), new Vector2(RowsWidth, 50f));
            if (_closeButton != null) ((RectTransform)_closeButton.transform).anchoredPosition = new Vector2(0f, CloseY);
        }

        private static void Place(RectTransform r, Vector2 pos, Vector2 size)
        {
            if (r == null) return;
            r.anchoredPosition = pos;
            r.sizeDelta = size;
        }

        /// <summary>차수 탭 1~지금 자리. 자리가 바뀔 때만 다시 짓고, 평소엔 고른 탭 색만 바꾼다
        /// (탭 onClick 한가운데서 그 탭을 지우지 않게).</summary>
        private void RedrawTabs()
        {
            int tiers = StoryJobState.Tier;
            if (_tabButtons.Count != tiers)
            {
                ClearTabs();
                const float w = 190f, gap = 20f;
                float x0 = -(tiers - 1) * (w + gap) * 0.5f;
                for (int t = 1; t <= tiers; t++)
                {
                    int captured = t;
                    var b = NewButton(_tabsRoot, string.Format(StoryLocalization.T("skill.tab", "{0}차"), t),
                        new Vector2(0.5f, 0.5f), new Vector2(x0 + (t - 1) * (w + gap), 0f), new Vector2(w, 60f),
                        () => SelectTab(captured));
                    _tabButtons.Add(b);
                }
            }
            for (int i = 0; i < _tabButtons.Count; i++)
            {
                var img = _tabButtons[i].targetGraphic as Image;
                if (img != null) img.color = i + 1 == _tab ? new Color(0.95f, 0.8f, 0.4f, 0.55f) : new Color(1f, 1f, 1f, 0.18f);
                var label = _tabButtons[i].GetComponentInChildren<TextMeshProUGUI>();
                if (label != null) label.text = string.Format(StoryLocalization.T("skill.tab", "{0}차"), i + 1);
            }
        }

        private void ClearTabs()
        {
            _tabButtons.Clear();
            if (_tabsRoot == null) return;
            for (int i = _tabsRoot.childCount - 1; i >= 0; i--) DestroyImmediate(_tabsRoot.GetChild(i).gameObject);
        }

        /// <summary>"칸: 파멸격 · 천붕격 · — · —" — 지금 칸 넷(고정+자동).</summary>
        private static string SlotsLine()
        {
            var parts = new string[StorySkillState.SlotCount];
            for (int i = 0; i < parts.Length; i++)
            {
                var sk = StorySkillState.SlotSkill(i);
                if (sk == null) { parts[i] = "—"; continue; }
                string name = StoryLocalization.T($"skill.{sk.Key}", sk.Name);
                int paren = name.IndexOf('(');
                parts[i] = paren > 0 ? name.Substring(0, paren) : name;
            }
            return string.Format(StoryLocalization.T("skill.slots_line", "칸: {0}"), string.Join(" · ", parts));
        }

        /// <summary>"칸"(안 고정) / "칸2"(두 번째 칸에 고정).</summary>
        private static string PinText(StorySkillData.Skill sk)
        {
            int at = StorySkillState.PinIndex(sk.Key);
            return at >= 0
                ? string.Format(StoryLocalization.T("skill.pin_on", "칸{0}"), at + 1)
                : StoryLocalization.T("skill.pin", "칸");
        }

        /// <summary>5-2 2단계 — 줄 앞에 [유파], 칸에서 세트가 켜졌으면 "·2세트"(웹판 무예 탭의
        /// 유파 소제목·세트 색을 글자로), 선행 무예가 모자라면 끝에 "(참격 5 먼저)".</summary>
        private static string RowText(StorySkillData.Skill sk)
        {
            string name = StoryLocalization.T($"skill.{sk.Key}", sk.Name);
            string desc = StoryLocalization.T($"skill.{sk.Key}.desc", sk.Desc);
            var school = StorySkillData.GetSchool(sk.School);
            string tag = "";
            if (school != null)
            {
                int set = StorySkillState.SchoolTier(sk.School);
                tag = set > 0
                    ? string.Format(StoryLocalization.T("skill.school_set", "[{0}·{1}세트] "), StoryLocalization.T("skill.school." + school.Id, school.Name), set)
                    : $"[{StoryLocalization.T("skill.school." + school.Id, school.Name)}] ";
            }
            string need = "";
            if (sk.Need != null && StorySkillState.LevelOf(sk.Need) < sk.NeedLv)
            {
                var pre = StorySkillData.Get(sk.Need);
                need = string.Format(StoryLocalization.T("skill.need_suffix", " ({0} {1} 먼저)"),
                    StoryLocalization.T($"skill.{sk.Need}", pre != null ? pre.Name : sk.Need), sk.NeedLv);
            }
            return $"{tag}{name}  Lv.{StorySkillState.LevelOf(sk.Key)}/{sk.Max}{need}\n{desc}";
        }

        private TextMeshProUGUI BuildRow(StorySkillData.Skill sk, float x, float y, float height)
        {
            var row = new GameObject($"Row_{sk.Key}", typeof(RectTransform));
            row.transform.SetParent(_rows, false);
            var rect = (RectTransform)row.transform;
            rect.anchorMin = rect.anchorMax = rect.pivot = new Vector2(0.5f, 1f);
            rect.anchoredPosition = new Vector2(x, y);
            rect.sizeDelta = new Vector2(RowWidth, height);

            var label = NewText(row.transform, RowText(sk), new Vector2(0f, 0.5f),
                new Vector2(10f, 0f), new Vector2(RowWidth - 260f, height - 4f), height >= 110f ? 24 : 20);
            label.alignment = TextAlignmentOptions.Left;

            string captured = sk.Key;
            var pin = NewButton(row.transform, PinText(sk), new Vector2(1f, 0.5f), new Vector2(-130f, 0f), new Vector2(110f, height - 10f),
                () => ClickPin(captured));
            _pinLabels.Add(pin.GetComponentInChildren<TextMeshProUGUI>());
            NewButton(row.transform, "+", new Vector2(1f, 0.5f), new Vector2(-10f, 0f), new Vector2(110f, height - 10f),
                () => ClickRaise(captured));
            return label;
        }

        // Destroy()는 프레임 끝으로 밀려 같은 프레임에 다시 그리면 쌓인다
        // (StoryLabyrinthMapUi.ClearChildren()과 같은 함정, PROJECT_STATE "알려진 오류").
        private void ClearRows()
        {
            _rowLabels.Clear();
            _pinLabels.Clear();
            if (_rows == null) return;
            for (int i = _rows.childCount - 1; i >= 0; i--) DestroyImmediate(_rows.GetChild(i).gameObject);
        }

        private static Canvas NewCanvas(string name)
        {
            var go = new GameObject(name);
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 20;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            StorySettingsState.ApplyUiScale(scaler);
            go.AddComponent<GraphicRaycaster>();
            return canvas;
        }

        private static GameObject NewPanel(Transform parent, Vector2 anchor, Vector2 size, Color color)
        {
            var go = new GameObject("Panel", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = rect.anchorMax = rect.pivot = anchor;
            rect.sizeDelta = size;
            rect.anchoredPosition = Vector2.zero;
            go.AddComponent<Image>().color = color;
            return go;
        }

        private static TextMeshProUGUI NewText(Transform parent, string content, Vector2 anchor, Vector2 pos, Vector2 size, int fontSize)
        {
            var go = new GameObject("Text", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = rect.anchorMax = rect.pivot = anchor;
            rect.anchoredPosition = pos;
            rect.sizeDelta = size;

            var text = go.AddComponent<TextMeshProUGUI>();
            text.fontSize = fontSize;
            text.alignment = TextAlignmentOptions.Center;
            text.color = Color.white;
            text.textWrappingMode = TextWrappingModes.Normal;
            text.text = content;
            return text;
        }

        private static Button NewButton(Transform parent, string label, Vector2 anchor, Vector2 pos, Vector2 size, UnityEngine.Events.UnityAction onClick)
        {
            var go = new GameObject($"Btn_{label}", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = rect.anchorMax = rect.pivot = anchor;
            rect.anchoredPosition = pos;
            rect.sizeDelta = size;

            var img = go.AddComponent<Image>();
            img.color = new Color(1f, 1f, 1f, 0.18f);
            var button = go.AddComponent<Button>();
            button.targetGraphic = img;
            if (onClick != null) button.onClick.AddListener(onClick);

            NewText(go.transform, label, new Vector2(0.5f, 0.5f), Vector2.zero, size, 30);
            return button;
        }
    }
}
