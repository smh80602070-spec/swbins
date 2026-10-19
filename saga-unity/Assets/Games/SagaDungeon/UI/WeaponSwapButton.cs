using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// tasks U-0131 무기 두 벌(웹 W-0281 🔁 단추·고돗 G-0236 weapon_swap_button) — 오른쪽 끝 띠(공격 열 바깥, 강공격 옆 -5·360)
    /// — 점프 위는 설정·일시정지, -640 열은 지역 배너·대사 줄과 겹쳤다(UiLayoutCheck).
    /// 을(乙) 이름을 둘째 줄에 쓰고, 을이 없으면 흐리게, 쿨 1초 동안은 아래서 차오르는 고리. 데스크톱은 G(PlayerCombat).
    /// `SecretPanelUi` 처럼 `GameBootstrap.Start()` 가 Play 때 짓는다(씬 재빌드 금지 — 런타임 리스너).
    /// </summary>
    public class WeaponSwapButton : MonoBehaviour
    {
        private static readonly Vector2 Pos = new Vector2(-5f, 360f), Size = new Vector2(90f, 110f);
        private static readonly Color On = new Color(0.55f, 0.35f, 0.15f, 0.6f), Off = new Color(0.3f, 0.3f, 0.3f, 0.35f);

        private Button _button;
        private Image _bg, _ring;
        private TextMeshProUGUI _text;
        private PlayerCombat _combat;
        private string _shown;

        public static WeaponSwapButton Instance { get; private set; }
        public Button Button => _button;
        public string Label => _text != null ? _text.text : null;
        public bool Dim => _bg != null && _bg.color == Off;

        public static void Install()
        {
            if (Instance == null) new GameObject("WeaponSwapUI").AddComponent<WeaponSwapButton>();
        }

        private void Awake()
        {
            Instance = this;
            Build();
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        private void Build()
        {
            var canvasGo = new GameObject("WeaponSwapCanvas");
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 20;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            DungeonSettingsState.ApplyUiScale(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            var go = new GameObject("WeaponSwapButton", typeof(RectTransform));
            go.transform.SetParent(canvasGo.transform, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = rect.anchorMax = rect.pivot = new Vector2(1f, 0f);
            rect.anchoredPosition = Pos;
            rect.sizeDelta = Size;
            _bg = go.AddComponent<Image>();
            _bg.color = Off;
            _button = go.AddComponent<Button>();
            _button.targetGraphic = _bg;
            _button.onClick.AddListener(OnClicked);

            var ringGo = new GameObject("Cooldown", typeof(RectTransform));
            ringGo.transform.SetParent(go.transform, false);
            var rr = (RectTransform)ringGo.transform;
            rr.anchorMin = Vector2.zero;
            rr.anchorMax = Vector2.one;
            rr.offsetMin = rr.offsetMax = Vector2.zero;
            _ring = ringGo.AddComponent<Image>();
            _ring.color = new Color(0f, 0f, 0f, 0.45f);
            _ring.type = Image.Type.Filled;
            _ring.fillMethod = Image.FillMethod.Vertical;
            _ring.fillOrigin = (int)Image.OriginVertical.Top;
            _ring.fillAmount = 0f;
            _ring.raycastTarget = false;

            var tgo = new GameObject("Text", typeof(RectTransform));
            tgo.transform.SetParent(go.transform, false);
            var tr = (RectTransform)tgo.transform;
            tr.anchorMin = tr.anchorMax = tr.pivot = new Vector2(0.5f, 0.5f);
            tr.sizeDelta = Size - new Vector2(10f, 8f);
            _text = tgo.AddComponent<TextMeshProUGUI>();
            _text.enableAutoSizing = true;
            _text.fontSizeMin = 12;
            _text.fontSizeMax = 24;
            _text.alignment = TextAlignmentOptions.Center;
            _text.color = Color.white;
            _text.textWrappingMode = TextWrappingModes.Normal;
            _text.raycastTarget = false;
            Refresh();
        }

        private void OnClicked()
        {
            if (_combat == null) _combat = FindFirstObjectByType<PlayerCombat>();
            _combat?.TriggerSwap();
            Refresh();
        }

        private void Update() => Refresh();

        private void Refresh()
        {
            var second = HeroState.SecondWeapon;
            float left = HeroState.SwapCooldownLeft(Time.time);
            _ring.fillAmount = second == null ? 0f : left / HeroState.SwapCooldown;
            var c = second != null ? On : Off;
            if (_bg.color != c) _bg.color = c;
            string label = DungeonLocalization.T("swap.btn", "바꿔 들기") + "\n" + (second != null ? second.Name : DungeonLocalization.T("swap.btn_empty", "을 없음"));
            if (label != _shown) _text.text = _shown = label;
        }
    }
}
