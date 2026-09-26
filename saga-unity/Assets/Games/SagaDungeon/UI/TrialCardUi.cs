using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// PLAN.md 109-10-3 시련 단계 카드 — 웹 §5.11 "굴혈 선택 카드 '시련' 절(단계 단추 셋·순위표 5)" 을 시련 표식에서 연다.
    /// 열린 단계 위 셋(높은 것부터, 적 배율 함께) · 최고 단계·횟수 · 순위표 위 다섯 · 닫기. 단추를 누르면 곧바로 시련 방으로.
    /// Play 때 `TrialRunner.Install` 이 지어 리스너는 런타임 리스너다.
    /// </summary>
    public class TrialCardUi : MonoBehaviour
    {
        public static TrialCardUi Instance { get; private set; }

        private GameObject _panel;
        private TextMeshProUGUI _title;
        private TextMeshProUGUI _board;
        private readonly Button[] _stageButtons = new Button[3];
        private readonly TextMeshProUGUI[] _stageTexts = new TextMeshProUGUI[3];
        private readonly int[] _stageOf = new int[3];
        private Vector3 _returnPos;

        public bool IsOpen => _panel != null && _panel.activeSelf;
        public Button StageButton(int i) => _stageButtons[i];
        public int StageOf(int i) => _stageOf[i];
        public string BoardText => _board != null ? _board.text : null;

        private void Awake()
        {
            Instance = this;
            Build();
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        public void Show(Vector3 returnPos)
        {
            _returnPos = returnPos;
            var offers = TrialState.Offers();
            _title.text = string.Format(DungeonLocalization.T("trial.card_title",
                "시련 — 15분 안에 진척 100 → 수호자 · 최고 {0}단계 · {1}번"), TrialState.Best, TrialState.Runs);
            for (int i = 0; i < _stageButtons.Length; i++)
            {
                bool has = i < offers.Length;
                _stageOf[i] = has ? offers[i] : 0;
                _stageButtons[i].gameObject.SetActive(has);
                if (has) _stageTexts[i].text = string.Format(DungeonLocalization.T("trial.stage_button", "{0}단계\n적 ×{1:0.00}"), offers[i], TrialState.EnemyMul(offers[i]));
            }
            var sb = new System.Text.StringBuilder();
            sb.Append(DungeonLocalization.T("trial.board_title", "순위표"));
            if (TrialState.Board.Count == 0) sb.Append("\n").Append(DungeonLocalization.T("trial.board_empty", "아직 완주 없음"));
            for (int i = 0; i < Mathf.Min(5, TrialState.Board.Count); i++) sb.Append("\n").Append(TrialState.BoardLine(i));
            _board.text = sb.ToString();
            _panel.SetActive(true);
        }

        public void Close() => _panel.SetActive(false);

        private void Pick(int i)
        {
            int stage = _stageOf[i];
            Close();
            if (stage <= 0 || TrialRunner.Instance == null) return;
            TrialRunner.Instance.StartRun(stage, _returnPos);
        }

        private void Build()
        {
            var canvasGo = new GameObject("TrialCardCanvas");
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 21;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            DungeonSettingsState.ApplyUiScale(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            _panel = new GameObject("TrialCard", typeof(RectTransform));
            _panel.transform.SetParent(canvasGo.transform, false);
            var prt = (RectTransform)_panel.transform;
            prt.anchorMin = prt.anchorMax = prt.pivot = new Vector2(0.5f, 0.5f);
            prt.sizeDelta = new Vector2(940f, 840f); // 110 ⑤c-3: 1000 은 가로 화면 높이(900)를 넘어 닫기가 잘렸다
            _panel.AddComponent<Image>().color = new Color(0.05f, 0.04f, 0.02f, 0.9f);

            _title = NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -25f), new Vector2(880f, 100f), 28);
            for (int i = 0; i < _stageButtons.Length; i++)
            {
                int idx = i;
                var b = NewButton(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2((i - 1) * 290f, -140f), new Vector2(260f, 150f),
                    new Color(0.8f, 0.62f, 0.2f, 0.45f), 28);
                b.onClick.AddListener(() => Pick(idx));
                _stageButtons[i] = b;
                _stageTexts[i] = b.GetComponentInChildren<TextMeshProUGUI>();
            }
            _board = NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -315f), new Vector2(880f, 380f), 24);
            _board.alignment = TextAlignmentOptions.Top;
            var close = NewButton(_panel.transform, DungeonLocalization.T("secret.close", "닫기"), new Vector2(0.5f, 0f),
                new Vector2(0f, 30f), new Vector2(260f, 80f), new Color(1f, 1f, 1f, 0.16f), 26);
            close.onClick.AddListener(Close);
            _panel.SetActive(false);
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
