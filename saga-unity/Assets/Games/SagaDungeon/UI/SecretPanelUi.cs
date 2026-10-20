using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// PLAN.md 109-10 비결 패널(웹 §5.9 "무예 나무 아래 비결 단추"·"칸에 비결 그림") — 무예 셋 줄 × 비결 다섯 칸.
    /// 칸을 누르면 그 무예에 건다(먹고 있는 칸을 다시 누르면 푼다), 아직 안 열린 칸은 "Lv.n" 만 보이고 안 눌린다.
    /// 여는 곳: 오른쪽 아래 버튼 줄 셋째 칸 맨 위(소환 위, -460·630) · 데스크톱 K.
    /// 평타·강공격·회전베기 버튼 오른쪽 위에 건 비결 첫 글자 딱지를 붙인다.
    ///
    /// 씬 빌더가 아니라 `GameBootstrap.Start()` 가 Play 때 지어 리스너가 런타임 리스너다 —
    /// 씬 재빌드 없이 붙고(재빌드는 컷 타임라인 ID 를 다시 쓴다), `ButtonWiringCheck` 도 런타임 리스너를 센다.
    /// </summary>
    public class SecretPanelUi : MonoBehaviour
    {
        private static readonly string[] MoveButtonNames = { "AttackButton", "HeavyAttackButton", "WhirlButton" };
        private static readonly Color CellIdle = new Color(1f, 1f, 1f, 0.16f);
        private static readonly Color CellOn = new Color(0.95f, 0.75f, 0.25f, 0.85f);
        private static readonly Color CellLocked = new Color(0.25f, 0.25f, 0.25f, 0.6f);

        private GameObject _panel;
        private TextMeshProUGUI _title;
        private Button _toggle;
        private TextMeshProUGUI _toggleText;
        private TextMeshProUGUI _closeText;
        private readonly TextMeshProUGUI[] _rowLabels = new TextMeshProUGUI[SecretState.MoveCount];
        private readonly Button[,] _cells = new Button[SecretState.MoveCount, SecretState.SecretCount];
        private readonly TextMeshProUGUI[,] _cellTexts = new TextMeshProUGUI[SecretState.MoveCount, SecretState.SecretCount];
        private readonly TextMeshProUGUI[] _badges = new TextMeshProUGUI[SecretState.MoveCount];
        private readonly Button[] _treeButtons = new Button[SecretState.MoveCount]; // tasks U-0135 무예 나무
        public Button TreeButton(SecretMove m) => _treeButtons[(int)m];
        private string _lastLang;

        public static SecretPanelUi Instance { get; private set; }
        public bool IsOpen => _panel != null && _panel.activeSelf;
        public Button ToggleButton => _toggle;
        public Button Cell(SecretMove m, Secret s) => s == Secret.None ? null : _cells[(int)m, (int)s - 1];
        public string BadgeText(SecretMove m) => _badges[(int)m] != null ? _badges[(int)m].text : null;
        public string TitleText => _title != null ? _title.text : null;
        public string RowText(SecretMove m) => _rowLabels[(int)m] != null ? _rowLabels[(int)m].text : null;
        public string CellText(SecretMove m, Secret s) => s == Secret.None ? null : _cellTexts[(int)m, (int)s - 1].text;

        private void Awake()
        {
            Instance = this;
            Build();
            SecretState.Changed += Refresh;
            SkillTree.Changed += Refresh; // tasks U-0135 — 무예 레벨·점이 단추 글에
            HeroState.LeveledUp += OnLeveledUp;
            HeroState.EquipmentChanged += OnEquipmentChanged; // 비전(109-10-2)은 든 무기에서 읽는다.
        }

        private void OnDestroy()
        {
            SecretState.Changed -= Refresh;
            SkillTree.Changed -= Refresh;
            HeroState.LeveledUp -= OnLeveledUp;
            HeroState.EquipmentChanged -= OnEquipmentChanged;
            if (Instance == this) Instance = null;
        }

        private void OnLeveledUp(int level) => Refresh();
        private void OnEquipmentChanged(string weaponId) => Refresh();

        private void Update()
        {
            var kb = Keyboard.current;
            if (kb != null && kb.kKey.wasPressedThisFrame) Toggle();
            if (DungeonLocalization.CurrentLanguage != _lastLang) Refresh();
        }

        public void Toggle()
        {
            if (_panel == null) return;
            _panel.SetActive(!_panel.activeSelf);
            if (_panel.activeSelf) Refresh();
        }

        private void Close() => _panel.SetActive(false);

        private void Pick(SecretMove m, Secret s)
        {
            if (!SecretState.Choose(m, s))
            {
                DialogueLabel.Instance?.Show(string.Format(DungeonLocalization.T("secret.locked", "{0} — Lv.{1} 에 열린다"),
                    SecretState.Name(s), SecretState.UnlockLevel(s)), 2f);
                return;
            }
            var now = SecretState.Of(m);
            DialogueLabel.Instance?.Show(now == Secret.None
                ? string.Format(DungeonLocalization.T("secret.cleared", "{0} — 비결을 풀었다"), SecretState.MoveName(m))
                : string.Format(DungeonLocalization.T("secret.set", "{0} · {1} — {2}"), SecretState.MoveName(m), SecretState.Name(now), SecretState.Effect(now, m)), 2.5f);
        }

        public void Refresh()
        {
            _lastLang = DungeonLocalization.CurrentLanguage;
            if (_toggleText != null) _toggleText.text = DungeonLocalization.T("action.secret", "비결");
            if (_closeText != null) _closeText.text = DungeonLocalization.T("secret.close", "닫기");
            if (_title != null)
                _title.text = string.Format(DungeonLocalization.T("secret.title", "비결 — 무예 하나에 하나 · 단 {0}/{1} (Lv.{2})"),
                    SecretState.Rank, SecretState.MaxRank, HeroState.Level)
                    + (SecretState.EquippedLore == Secret.None ? "" : "\n" + SecretState.LoreLine(SecretState.EquippedLore));
            for (int m = 0; m < SecretState.MoveCount; m++)
            {
                var tb = _treeButtons[m];
                if (tb != null) tb.GetComponentInChildren<TextMeshProUGUI>().text = string.Format(DungeonLocalization.T("tree.button", "{0} 나무 Lv.{1} · 점 {2}"),
                    SecretState.MoveName((SecretMove)m), SkillTree.Level((SecretMove)m), SkillTree.PointsLeft((SecretMove)m));
            }
            for (int m = 0; m < SecretState.MoveCount; m++)
            {
                var move = (SecretMove)m;
                var on = SecretState.Of(move);
                var picked = SecretState.Picked(move);
                if (_rowLabels[m] != null)
                {
                    string line = on == Secret.None
                        ? string.Format(DungeonLocalization.T("secret.row_none", "{0} — 비결 없음"), SecretState.MoveName(move))
                        : string.Format(DungeonLocalization.T("secret.row", "{0} — {1}: {2}"), SecretState.MoveName(move), SecretState.Name(on), SecretState.Effect(on, move));
                    if (SecretState.LoreBoosts(move))
                        line += string.Format(DungeonLocalization.T("lore.row", " · 비전 {0} ×1.6"), SecretState.LoreName(on));
                    if (on == Secret.None && picked != Secret.None)
                        line += string.Format(DungeonLocalization.T("secret.row_sleep", " (고른 {0} 은 Lv.{1} 에 다시 산다)"), SecretState.Name(picked), SecretState.UnlockLevel(picked));
                    _rowLabels[m].text = line;
                }
                for (int i = 0; i < SecretState.SecretCount; i++)
                {
                    var s = (Secret)(i + 1);
                    var cell = _cells[m, i];
                    if (cell == null) continue;
                    bool open = SecretState.IsUnlocked(s);
                    cell.interactable = open;
                    ((Image)cell.targetGraphic).color = !open ? CellLocked : on == s ? CellOn : CellIdle;
                    string cellText = open ? SecretState.Name(s) : $"{SecretState.Name(s)}\nLv.{SecretState.UnlockLevel(s)}";
                    if (s == SecretState.EquippedLore) cellText += "\n" + string.Format(DungeonLocalization.T("lore.cell", "비전 {0}"), SecretState.LoreName(s));
                    _cellTexts[m, i].text = cellText;
                }
                if (_badges[m] != null) _badges[m].text = SecretState.Glyph(on);
            }
        }

        private void Build()
        {
            var canvasGo = new GameObject("SecretPanelCanvas");
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 20;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            DungeonSettingsState.ApplyUiScale(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            _toggle = NewButton(canvasGo.transform, DungeonLocalization.T("action.secret", "비결"), new Vector2(1f, 0f),
                new Vector2(-460f, 630f), new Vector2(130f, 130f), new Color(0.3f, 0.45f, 0.8f, 0.55f), 26);
            _toggle.onClick.AddListener(Toggle);
            _toggleText = _toggle.GetComponentInChildren<TextMeshProUGUI>();

            _panel = new GameObject("SecretPanel", typeof(RectTransform));
            _panel.transform.SetParent(canvasGo.transform, false);
            var prt = (RectTransform)_panel.transform;
            prt.anchorMin = prt.anchorMax = prt.pivot = new Vector2(0.5f, 0.5f);
            prt.sizeDelta = new Vector2(980f, 860f); // 110 ⑤c-2 — 가로 화면 논리 높이 900 안(옛 1080 은 아래가 잘렸다)
            _panel.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0.88f);

            _title = NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -16f), new Vector2(920f, 76f), 28);
            float y = -100f;
            for (int m = 0; m < SecretState.MoveCount; m++)
            {
                _rowLabels[m] = NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, y), new Vector2(920f, 50f), 24);
                y -= 52f;
                for (int i = 0; i < SecretState.SecretCount; i++)
                {
                    var move = (SecretMove)m;
                    var s = (Secret)(i + 1);
                    float x = (i - 2) * 180f;
                    var b = NewButton(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(x, y), new Vector2(165f, 104f), CellIdle, 24);
                    b.onClick.AddListener(() => Pick(move, s));
                    _cells[m, i] = b;
                    _cellTexts[m, i] = b.GetComponentInChildren<TextMeshProUGUI>();
                }
                y -= 114f;
            }

            // tasks U-0135 — 무예 셋 나무 단추(줄 아래 빈 띠, 닫기 위). 누르면 그 무예 나무 창.
            SkillTreeUi.Install();
            for (int m = 0; m < SecretState.MoveCount; m++)
            {
                var move = (SecretMove)m;
                var tb = NewButton(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2((m - 1) * 310f, -628f), new Vector2(296f, 70f), CellIdle, 22);
                tb.onClick.AddListener(() => SkillTreeUi.Instance?.Open(move));
                _treeButtons[m] = tb;
            }

            var close = NewButton(_panel.transform, DungeonLocalization.T("secret.close", "닫기"), new Vector2(0.5f, 0f),
                new Vector2(0f, 30f), new Vector2(260f, 80f), CellIdle, 26);
            close.onClick.AddListener(Close);
            _closeText = close.GetComponentInChildren<TextMeshProUGUI>();
            _panel.SetActive(false);

            for (int m = 0; m < SecretState.MoveCount; m++)
            {
                var btn = GameObject.Find(MoveButtonNames[m]);
                if (btn == null) continue;
                var badge = NewText(btn.transform, "", new Vector2(1f, 1f), new Vector2(-4f, -4f), new Vector2(44f, 44f), 30);
                badge.gameObject.name = "SecretBadge";
                badge.color = new Color(1f, 0.85f, 0.35f);
                badge.raycastTarget = false;
                _badges[m] = badge;
            }
            Refresh();
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

        private static Button NewButton(Transform parent, string label, Vector2 anchor, Vector2 pos, Vector2 size, Color color, int fontSize)
        {
            var go = new GameObject("Btn", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = rect.anchorMax = rect.pivot = anchor;
            rect.anchoredPosition = pos;
            rect.sizeDelta = size;
            var img = go.AddComponent<Image>();
            img.color = color;
            var button = go.AddComponent<Button>();
            button.targetGraphic = img;
            var t = NewText(go.transform, label, new Vector2(0.5f, 0.5f), Vector2.zero, size, fontSize);
            t.raycastTarget = false;
            return button;
        }
    }
}
