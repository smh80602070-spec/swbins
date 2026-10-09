using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// PLAN.md 101-2 5.1 "축복 3택" — <see cref="BlessingState.RollChoice"/>가 뽑은
    /// 카드 3장(세로)을 보여주고 고르거나 거절하게 한다. SagaGo `PerkChoiceUi.cs`와
    /// 같은 결이지만, 이 트랙엔 그쪽의 `EncounterUiKit` 같은 공용 부품이 없어
    /// SagaStory `StoryJobChoiceUi.cs`처럼 캔버스/패널/텍스트/버튼을 이 컴포넌트가
    /// 스스로 짓는다(둘 다 같은 판단 — 아직 세 번째 재사용처가 없어 kit로 안 뽑는다).
    /// </summary>
    public class BlessingChoiceUi : MonoBehaviour
    {
        [SerializeField] private GameObject _panel;
        [SerializeField] private TextMeshProUGUI _titleLabel;
        [SerializeField] private TextMeshProUGUI[] _cardLabels = new TextMeshProUGUI[3];
        [SerializeField] private Button[] _cardButtons = new Button[3];
        [SerializeField] private TextMeshProUGUI _rejectLabel;

        private BlessingState.BlessingDef[] _offer = System.Array.Empty<BlessingState.BlessingDef>();
        private System.Action<BlessingState.BlessingDef> _onChosen;
        private System.Action _onRejected;

        public bool IsShowing => _panel != null && _panel.activeSelf;

        private static readonly string[] AxisLabel = { "공(攻)", "수(守)", "선(旋)" };
        private static readonly string[] AxisKey = { "blessing.axis.atk", "blessing.axis.def", "blessing.axis.sweep" };

        private static readonly Vector2 CardSize = new Vector2(600f, 130f);

        private void Awake() => ApplyLayout();

        /// <summary>
        /// 카드 자리 한 곳 — <see cref="Build"/>(씬 빌더)와 <see cref="Awake"/> 가 같이 부른다(씬을 다시 안 지어도 실행 때 맞는다).
        /// PLAN.md 110 ⑤c-3: 카드 140·간격 170 이면 셋째 카드가 아래 거절 단추에 30 파고들었다 → 130·150.
        /// </summary>
        private void ApplyLayout()
        {
            for (int i = 0; i < _cardButtons.Length; i++)
            {
                if (_cardButtons[i] == null) continue;
                var rt = (RectTransform)_cardButtons[i].transform;
                rt.anchoredPosition = new Vector2(0f, -170f - 150f * i);
                rt.sizeDelta = CardSize;
                if (_cardLabels[i] != null) _cardLabels[i].rectTransform.sizeDelta = CardSize;
            }
        }

        public void Build()
        {
            var canvas = NewCanvas("BlessingChoiceUI");
            canvas.transform.SetParent(transform, false);

            _panel = NewPanel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(700f, 760f),
                new Color(0f, 0f, 0f, 0.85f));
            _panel.SetActive(false);

            _titleLabel = NewText(_panel.transform, DungeonLocalization.T("blessing.title", "축복! 하나를 고르세요"),
                new Vector2(0.5f, 1f), new Vector2(0f, -60f), new Vector2(620f, 90f), 28);

            for (int i = 0; i < _cardButtons.Length; i++)
            {
                _cardButtons[i] = NewButton(_panel.transform, "", new Vector2(0.5f, 1f),
                    new Vector2(0f, -170f - 150f * i), CardSize, null);
                // 영속 리스너(인자 int) — 람다는 씬 저장 때 사라진다(SagaCore/ButtonWiring.cs).
                Saga.Core.ButtonWiring.Wire(_cardButtons[i], ChooseIndex, i);
                _cardLabels[i] = _cardButtons[i].GetComponentInChildren<TextMeshProUGUI>();
            }
            ApplyLayout();

            _rejectLabel = NewButton(_panel.transform,
                DungeonLocalization.T("blessing.reject", "거절 — 층수만큼 금 획득"),
                new Vector2(0.5f, 0f), new Vector2(0f, 40f), new Vector2(320f, 80f), Reject)
                .GetComponentInChildren<TextMeshProUGUI>();
        }

        public void Show(BlessingState.BlessingDef[] offer, System.Action<BlessingState.BlessingDef> onChosen, System.Action onRejected)
        {
            if (_panel == null || offer == null || offer.Length != _cardButtons.Length) return;

            _offer = offer;
            _onChosen = onChosen;
            _onRejected = onRejected;

            for (int i = 0; i < offer.Length; i++)
            {
                var blessing = offer[i];
                string axis = DungeonLocalization.T(AxisKey[(int)blessing.Axis], AxisLabel[(int)blessing.Axis]);
                _cardLabels[i].text = $"{axis} {DungeonLocalization.T("blessing." + blessing.Id, blessing.Name)}\n(+{Mathf.RoundToInt(blessing.Bonus * 100f)}%)";
            }
            _panel.SetActive(true);
            if (!_holding) { HeroState.DamageHold++; _holding = true; } // U-0076 — 고르는 동안은 안 맞는다
        }

        private bool _holding;

        private void Release()
        {
            if (!_holding) return;
            _holding = false;
            HeroState.DamageHold = Mathf.Max(0, HeroState.DamageHold - 1);
        }

        private void OnDestroy() => Release();

        private void ChooseIndex(int index)
        {
            if (index < 0 || index >= _offer.Length) return;
            var blessing = _offer[index];
            _panel.SetActive(false);
            Release();
            _onChosen?.Invoke(blessing);
        }

        private void Reject()
        {
            _panel.SetActive(false);
            Release();
            _onRejected?.Invoke();
        }

        // StoryJobChoiceUi.cs와 같은 넷(캔버스/패널/텍스트/버튼) — kit로 안 뽑고 그대로 둔다(같은 판단).
        private static Canvas NewCanvas(string name)
        {
            var go = new GameObject(name);
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            DungeonSettingsState.ApplyUiScale(scaler);
            go.AddComponent<GraphicRaycaster>();
            return canvas;
        }

        private static GameObject NewPanel(Transform parent, Vector2 anchor, Vector2 size, Color color)
        {
            var go = new GameObject("Panel", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = anchor;
            rect.sizeDelta = size;
            rect.anchoredPosition = Vector2.zero;
            var img = go.AddComponent<Image>();
            img.color = color;
            return go;
        }

        private static TextMeshProUGUI NewText(Transform parent, string content, Vector2 anchor, Vector2 pos, Vector2 size, int fontSize)
        {
            var go = new GameObject("Text", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = anchor;
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
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = anchor;
            rect.anchoredPosition = pos;
            rect.sizeDelta = size;

            var img = go.AddComponent<Image>();
            img.color = new Color(1f, 1f, 1f, 0.18f);
            var button = go.AddComponent<Button>();
            button.targetGraphic = img;
            // 에디터 빌드면 영속 리스너, Play 중이면 런타임 리스너 — SagaCore/ButtonWiring.cs(2026-09-23 먹통 버그).
            Saga.Core.ButtonWiring.Wire(button, onClick);

            NewText(go.transform, label, new Vector2(0.5f, 0.5f), Vector2.zero, size, 26);

            return button;
        }
    }
}
