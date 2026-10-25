using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// tasks U-0245 세트 무예 폰 단추(데스크톱은 C — PlayerCombat) — 바꿔 들기 단추(-5·360) 바로 위 띠.
    /// 한 벌 세 점을 다 걸쳤을 때만 보인다(없으면 숨김 — 그래서 UiLayoutCheck 기본 장면엔 안 잡힌다, 자리는 촬영으로 본다).
    /// 쿨 동안은 위에서 차오르는 어둠. `WeaponSwapButton` 처럼 `GameBootstrap.Start()` 가 Play 때 짓는다(씬 재빌드 없음).
    /// </summary>
    public class SetSkillButton : MonoBehaviour
    {
        private static readonly Vector2 Pos = new Vector2(-5f, 480f), Size = new Vector2(90f, 90f);
        private static readonly Color Bg = new Color(0f, 0.45f, 0.1f, 0.6f);
        private GameObject _root;
        private Image _ring;
        private TextMeshProUGUI _text;
        private PlayerCombat _combat;
        private string _shown;

        public static SetSkillButton Instance { get; private set; }
        public bool Visible => _root != null && _root.activeSelf;

        public static void Install()
        {
            if (Instance == null) new GameObject("SetSkillUI").AddComponent<SetSkillButton>();
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
            var canvasGo = new GameObject("SetSkillCanvas");
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 20;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            DungeonSettingsState.ApplyUiScale(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            _root = new GameObject("SetSkillButton", typeof(RectTransform));
            _root.transform.SetParent(canvasGo.transform, false);
            var rect = (RectTransform)_root.transform;
            rect.anchorMin = rect.anchorMax = rect.pivot = new Vector2(1f, 0f);
            rect.anchoredPosition = Pos;
            rect.sizeDelta = Size;
            var bg = _root.AddComponent<Image>();
            bg.color = Bg;
            var button = _root.AddComponent<Button>();
            button.targetGraphic = bg;
            button.onClick.AddListener(OnClicked);

            var ringGo = new GameObject("Cooldown", typeof(RectTransform));
            ringGo.transform.SetParent(_root.transform, false);
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
            tgo.transform.SetParent(_root.transform, false);
            var tr = (RectTransform)tgo.transform;
            tr.anchorMin = tr.anchorMax = tr.pivot = new Vector2(0.5f, 0.5f);
            tr.sizeDelta = Size - new Vector2(8f, 8f);
            _text = tgo.AddComponent<TextMeshProUGUI>();
            _text.enableAutoSizing = true;
            _text.fontSizeMin = 11;
            _text.fontSizeMax = 22;
            _text.alignment = TextAlignmentOptions.Center;
            _text.color = Color.white;
            _text.textWrappingMode = TextWrappingModes.Normal;
            _text.raycastTarget = false;
            Refresh();
        }

        private void OnClicked()
        {
            if (_combat == null) _combat = FindFirstObjectByType<PlayerCombat>();
            _combat?.TriggerSetSkill();
            Refresh();
        }

        private void Update() => Refresh();

        private void Refresh()
        {
            var full = Gear.Totals.FullSet;
            bool on = full?.Skill != null;
            if (_root.activeSelf != on) _root.SetActive(on);
            if (!on) return;
            float left = PlayerCombat.SetSkillReadyAt - Time.time;
            _ring.fillAmount = left > 0f ? Mathf.Clamp01(left / Mathf.Max(1f, full.Skill.Cd)) : 0f;
            string label = full.Skill.Emoji + "\n" + full.Skill.Name;
            if (label != _shown) _text.text = _shown = label;
        }
    }
}
