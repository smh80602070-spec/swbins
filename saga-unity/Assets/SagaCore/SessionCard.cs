using TMPro;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Saga.Core
{
    /// <summary>
    /// PLAN.md 101-2 "공통 선행" B — 세션 마무리 카드. 게임 쪽(예:
    /// Saga.Go.UI.GoSessionTracker)이 무입력·백그라운드 전환을 감지해
    /// <see cref="Show"/>를 부르면 5초 뒤 스스로 닫힌다(웹판 §5 ④의
    /// catchpop 계열과 같은 결).
    ///
    /// `GoalBoard`와 같은 이유로 Awake()가 매번 자기 자식을 다시 지어
    /// [SerializeField] 없이도 씬 재로드 후 안전하다.
    ///
    /// PLAN.md 105장 Q-U5(2026-09-17 확정, 102-2 표대로 진행) — 이 카드가
    /// 뜨는 동안만 Depth of Field 를 켠다(102-2 "대화·카드 연출 토글
    /// 시만", PC 만). `BuildFF16VolumeProfiles.BuildPcOnlyOverrides()`가
    /// PC 프로파일에만 DepthOfField 오버라이드를 넣어 뒀으니(mode 기본
    /// Off), Mobile 프로파일엔 그 컴포넌트 자체가 없어 VolumeProfile.TryGet
    /// 이 조용히 실패한다 — 플랫폼 분기 코드가 따로 필요 없다.
    /// </summary>
    public class SessionCard : MonoBehaviour
    {
        private const float AutoCloseSeconds = 5f;

        private GameObject _panel;
        private TextMeshProUGUI _label;
        private Button _action;
        private System.Action _onAction;
        private float _closeTimer = -1f;
        /// <summary>단추 달린 카드가 스스로 닫히기까지(누를 틈을 넉넉히 — tasks U-0092).</summary>
        public const float ActionCloseSeconds = 15f;

        public bool IsShowing => _panel != null && _panel.activeSelf;

        private void Awake()
        {
            for (int i = transform.childCount - 1; i >= 0; i--)
            {
                DestroyImmediate(transform.GetChild(i).gameObject);
            }
            Build();
        }

        private void Build()
        {
            var canvasGo = new GameObject("Canvas", typeof(RectTransform));
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 100; // 다른 상시 HUD보다 위에 뜨게.
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            _panel = new GameObject("Panel", typeof(RectTransform));
            _panel.transform.SetParent(canvasGo.transform, false);
            var panelRect = (RectTransform)_panel.transform;
            panelRect.anchorMin = new Vector2(0.5f, 0.5f);
            panelRect.anchorMax = new Vector2(0.5f, 0.5f);
            panelRect.pivot = new Vector2(0.5f, 0.5f);
            panelRect.sizeDelta = new Vector2(760f, 420f);
            var img = _panel.AddComponent<Image>();
            img.color = new Color(0f, 0f, 0f, 0.85f);

            var textGo = new GameObject("Label", typeof(RectTransform));
            textGo.transform.SetParent(_panel.transform, false);
            var rect = (RectTransform)textGo.transform;
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = new Vector2(40f, 40f);
            rect.offsetMax = new Vector2(-40f, -40f);

            _label = textGo.AddComponent<TextMeshProUGUI>();
            _label.fontSize = 30;
            _label.alignment = TextAlignmentOptions.Center;
            _label.color = Color.white;
            _label.textWrappingMode = TextWrappingModes.Normal;
            _label.text = "";

            // tasks U-0092 — 단추 하나(있을 때만 보임). 누르면 카드를 닫고 콜백.
            _action = Saga.Core.SagaUi.NewButton(_panel.transform, "Action", "", new Vector2(0.5f, 0f), new Vector2(0f, 56f),
                new Vector2(420f, 72f), Saga.Core.SagaUi.ButtonAccent, 30f);
            _action.onClick.AddListener(PressAction);
            _action.gameObject.SetActive(false);

            _panel.SetActive(false);
        }

        /// <summary>title 아래 lines 를 한 줄씩 이어 붙여 5초간 보여준다.
        /// 이미 떠 있으면 내용만 새로 갈고 5초를 다시 잰다.</summary>
        public void Show(string title, params string[] lines)
        {
            if (_panel == null || _label == null) return;
            _label.text = lines != null && lines.Length > 0
                ? $"{title}\n\n{string.Join("\n", lines)}"
                : title;
            _panel.SetActive(true);
            _closeTimer = AutoCloseSeconds;
            SetDepthOfField(true);
            SetAction(null, null);
        }

        /// <summary>tasks U-0092 — <see cref="Show(string, string[])"/> 에 단추 하나를 더한 판(예: 사가나락 「은총에서 다시」).
        /// <see cref="ActionCloseSeconds"/> 뒤 스스로 닫힌다(누르지 않으면 콜백 없음).</summary>
        public void Show(string title, string actionLabel, System.Action onAction, params string[] lines)
        {
            Show(title, lines);
            if (_panel == null) return;
            SetAction(actionLabel, onAction);
            if (onAction != null) _closeTimer = ActionCloseSeconds;
        }

        /// <summary>단추가 떠 있는가(진단용).</summary>
        public bool HasAction => _action != null && _action.gameObject.activeSelf;
        public string ActionLabel => HasAction ? Saga.Core.SagaUi.Label(_action) : null;
        public string Text => _label != null ? _label.text : "";

        /// <summary>단추를 누른 것과 같다(진단·키 입력용).</summary>
        public void PressAction()
        {
            var cb = _onAction;
            Hide();
            cb?.Invoke();
        }

        private void SetAction(string label, System.Action onAction)
        {
            _onAction = onAction;
            if (_action == null) return;
            bool on = onAction != null && !string.IsNullOrEmpty(label);
            _action.gameObject.SetActive(on);
            if (on) _action.GetComponentInChildren<TMP_Text>().text = label;
            // 단추가 있으면 글을 위로 올려 겹치지 않게
            var rect = (RectTransform)_label.transform;
            rect.offsetMin = new Vector2(40f, on ? 120f : 40f);
            // 단추가 있으면 판을 키워 마지막 줄이 단추에 가리지 않게(U-0092 촬영 — 넷째 줄이 단추 위로 걸쳤다)
            ((RectTransform)_panel.transform).sizeDelta = new Vector2(760f, on ? 520f : 420f);
        }

        public void Hide()
        {
            _closeTimer = -1f;
            _onAction = null;
            if (_panel != null) _panel.SetActive(false);
            SetDepthOfField(false);
        }

        /// <summary>씬의 Global Volume 을 찾아 DepthOfField 오버라이드를
        /// 켜고 끈다 — Mobile 프로파일엔 이 컴포넌트가 없어(102-2 표)
        /// TryGet 이 false 를 돌려주면 조용히 넘어간다.</summary>
        private static void SetDepthOfField(bool on)
        {
            var volume = Object.FindFirstObjectByType<Volume>();
            if (volume == null || volume.profile == null) return;
            if (!volume.profile.TryGet(out DepthOfField dof)) return;
            dof.mode.value = on ? DepthOfFieldMode.Gaussian : DepthOfFieldMode.Off;
        }

        private void Update()
        {
            if (_closeTimer < 0f) return;
            _closeTimer -= Time.unscaledDeltaTime;
            if (_closeTimer <= 0f) Hide();
        }
    }
}
