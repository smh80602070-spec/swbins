using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// tasks U-0135 무예 나무 창(웹 W-0280 무예 탭의 나무) — 비결 창 아래 무예 셋 단추가 연다. 마디 여덟 줄 × 갈래 둘(가/나) 단추,
    /// 찍은 점·최대를 단추에, 앞 마디가 비었거나 다른 갈래를 찍었거나 점이 없으면 흐리게. 아래 「되돌리기 (금 200)」·닫기.
    /// 비결 창처럼 Play 때 짓는다(`SecretPanelUi.Build` 가 <see cref="Install"/>). 이 판 글꼴엔 그림 문자가 없어 글자만 쓴다.
    /// </summary>
    public class SkillTreeUi : MonoBehaviour
    {
        private static readonly Color Idle = new Color(1f, 1f, 1f, 0.16f), On = new Color(0.95f, 0.75f, 0.25f, 0.85f), Locked = new Color(0.25f, 0.25f, 0.25f, 0.6f);

        public static SkillTreeUi Instance { get; private set; }

        private GameObject _panel;
        private TextMeshProUGUI _title;
        private readonly Button[,] _opts = new Button[SkillTree.Nodes, 2];
        private readonly TextMeshProUGUI[,] _optTexts = new TextMeshProUGUI[SkillTree.Nodes, 2];
        private TextMeshProUGUI _resetText;
        private SecretMove _move;

        public bool IsOpen => _panel != null && _panel.activeSelf;
        public SecretMove Move => _move;
        public RectTransform Root => _panel != null ? (RectTransform)_panel.transform : null;
        public Button Opt(int node, bool a) => _opts[node, a ? 0 : 1];
        public string TitleText => _title != null ? _title.text : null;

        public static SkillTreeUi Install()
        {
            if (Instance == null) new GameObject("SkillTreeUI").AddComponent<SkillTreeUi>();
            return Instance;
        }

        private void Awake()
        {
            Instance = this;
            Build();
            SkillTree.Changed += Refresh;
        }

        private void OnDestroy()
        {
            SkillTree.Changed -= Refresh;
            if (Instance == this) Instance = null;
        }

        public void Open(SecretMove m)
        {
            _move = m;
            _panel.SetActive(true);
            Refresh();
        }

        public void Close() => _panel.SetActive(false);

        private void Build()
        {
            var canvasGo = new GameObject("SkillTreeCanvas");
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 21; // 비결 창(20) 위
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            DungeonSettingsState.ApplyUiScale(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            _panel = new GameObject("SkillTreePanel", typeof(RectTransform));
            _panel.transform.SetParent(canvasGo.transform, false);
            var prt = (RectTransform)_panel.transform;
            prt.anchorMin = prt.anchorMax = prt.pivot = new Vector2(0.5f, 0.5f);
            prt.sizeDelta = new Vector2(980f, 860f); // 비결 창과 같은 크기(가로 화면 논리 높이 900 안)
            _panel.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0.92f);

            _title = NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -14f), new Vector2(920f, 70f), 26);
            float y = -96f;
            for (int i = 0; i < SkillTree.Nodes; i++)
            {
                int node = i;
                for (int side = 0; side < 2; side++)
                {
                    bool a = side == 0;
                    var b = NewButton(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(a ? -230f : 230f, y), new Vector2(440f, 66f), Idle, 22);
                    b.onClick.AddListener(() => Put(node, a));
                    _opts[i, side] = b;
                    _optTexts[i, side] = b.GetComponentInChildren<TextMeshProUGUI>();
                }
                y -= 74f;
            }
            var reset = NewButton(_panel.transform, "", new Vector2(0.5f, 0f), new Vector2(-170f, 24f), new Vector2(320f, 70f), Idle, 22);
            reset.onClick.AddListener(Reset);
            _resetText = reset.GetComponentInChildren<TextMeshProUGUI>();
            var close = NewButton(_panel.transform, DungeonLocalization.T("secret.close", "닫기"), new Vector2(0.5f, 0f), new Vector2(170f, 24f), new Vector2(240f, 70f), Idle, 24);
            close.onClick.AddListener(Close);
            _panel.SetActive(false);
        }

        private void Put(int node, bool a)
        {
            string why = SkillTree.Why(_move, node, a);
            if (why != null || !SkillTree.Put(_move, node, a))
                DialogueLabel.Instance?.Show(DungeonLocalization.T("tree.why." + why, WhyKo(why)), 2f);
        }

        private static string WhyKo(string why) => why switch
        {
            "prereq" => "앞 마디에 점이 있어야 열린다",
            "side" => "이 마디는 다른 갈래를 골랐다 — 되돌리기로",
            "max" => "이 마디는 다 찍었다",
            "point" => "남은 점이 없다 — 이 무예를 더 쓰면 레벨이 오른다",
            _ => "찍을 수 없다",
        };

        private void Reset()
        {
            string why = SkillTree.Reset(_move);
            DialogueLabel.Instance?.Show(why == null
                ? string.Format(DungeonLocalization.T("tree.reset_done", "{0} 나무를 되돌렸다 — 금 {1}, 경험은 그대로"), SecretState.MoveName(_move), SkillTree.ResetGold)
                : why == "gold" ? string.Format(DungeonLocalization.T("tree.reset_gold", "금 {0} 이 있어야 되돌린다"), SkillTree.ResetGold)
                : DungeonLocalization.T("tree.reset_empty", "찍은 점이 없다"), 2f);
        }

        public void Refresh()
        {
            if (_panel == null || !_panel.activeSelf) return;
            var m = _move;
            int lv = SkillTree.Level(m);
            _title.text = string.Format(DungeonLocalization.T("tree.title", "{0} 나무 — Lv.{1}/{2} · 남은 점 {3}\n맞힌 시전마다 경험 1 · 마디 하나엔 한 갈래 · 앞 마디부터"),
                SecretState.MoveName(m), lv, SkillTree.MaxLv, SkillTree.PointsLeft(m));
            for (int i = 0; i < SkillTree.Nodes; i++)
            {
                int p = SkillTree.Pts(m, i);
                for (int side = 0; side < 2; side++)
                {
                    bool a = side == 0;
                    int mine = a ? Mathf.Max(0, p) : Mathf.Max(0, -p);
                    int max = SkillTree.Tree[i, side].Max;
                    _optTexts[i, side].text = $"{i + 1}{(a ? DungeonLocalization.T("tree.a", "가") : DungeonLocalization.T("tree.b", "나"))}. {SkillTree.OptLabel(i, a)}  {mine}/{max}";
                    bool can = SkillTree.Why(m, i, a) == null;
                    ((Image)_opts[i, side].targetGraphic).color = mine > 0 ? On : can ? Idle : Locked;
                }
            }
            _resetText.text = string.Format(DungeonLocalization.T("tree.reset", "되돌리기 (금 {0})"), SkillTree.ResetGold);
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
