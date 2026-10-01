using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.UI;
using Saga.Core;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 109-15 탈것·비행 — 입력·화면·모양. **H = 타고 내리기 · Shift+H = 다른 탈것 고르기 · (비행) X 오르기 · Z 내리기**(폰은 타기 단추와 ▲▼ 누르고 있기).
    /// 저절로 내리는 때: 적을 치면(`PlayerCombat.Struck`) · 맞으면(`HeroState.Hurt`) · 칸 밖(던전)으로 나가면 · 컷 동안 · 뛰거나 벽을 붙잡으면(지상 탈것 — 비행은 떠 있는 게 정상).
    /// 탈것 모양은 코드로 그린 기본 도형(말·학·용 — 원작 모양 아님)을 나 밑에 붙이고 나는 그 등 높이로 올린다.
    /// `GameBootstrap.Start()` 가 Play 때 붙인다(씬 재빌드 없음 — 재빌드는 컷 타임라인 ID 를 다시 쓴다).
    /// </summary>
    public class MountField : MonoBehaviour
    {
        public static MountField Instance { get; private set; }

        private MountRig _rig;

        private Button _ride, _up, _down;
        private TextMeshProUGUI _rideText;
        private float _touchLift;
        private float _refreshWait;
        private string _lastLang;
        private PlayerController _pc;
        private float _airTime;

        public Button RideButton => _ride;
        public Button UpButton => _up;
        public Button DownButton => _down;
        public string RideLabel => _rideText != null ? _rideText.text : "";
        public bool BodyShown => _rig != null && _rig.BodyShown;
        public string BodyId => _rig != null ? _rig.BodyId : "";
        public float RiderLiftNow => _rig != null ? _rig.RiderLiftNow : 0f;

        private const float AirDismountSec = 0.15f;

        public static MountField Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("MountField").AddComponent<MountField>();
        }

        private void Awake()
        {
            _rig = gameObject.AddComponent<MountRig>();
            Instance = this;
            BuildUi();
            DungeonMounts.Changed += OnChanged;
            PlayerCombat.Struck += OnStruck;
            HeroState.Hurt += OnHurt;
        }

        private void OnDestroy()
        {
            DungeonMounts.Changed -= OnChanged;
            PlayerCombat.Struck -= OnStruck;
            HeroState.Hurt -= OnHurt;
            if (Instance == this) Instance = null;
        }

        // ---- 화면 ----

        private void BuildUi()
        {
            var canvasGo = new GameObject("MountCanvas");
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 7;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            DungeonSettingsState.ApplyUiScale(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            // 오른쪽 아래 버튼 첫 줄(공격·강공격·회전베기) 맨 위 — 회전베기(510~640) 위.
            _ride = NewButton(canvasGo.transform, "", new Vector2(1f, 0f), new Vector2(-100f, 660f), new Vector2(130f, 130f), new Color(0.55f, 0.4f, 0.2f, 0.6f), 24);
            _rideText = _ride.GetComponentInChildren<TextMeshProUGUI>();
            _ride.onClick.AddListener(OnRideClicked);
            _up = HoldButton(canvasGo.transform, "▲", new Vector2(-640f, 330f), 1f);
            _down = HoldButton(canvasGo.transform, "▼", new Vector2(-640f, 180f), -1f);
            _ride.gameObject.SetActive(false);
            _up.gameObject.SetActive(false);
            _down.gameObject.SetActive(false);
        }

        private void OnRideClicked() => Toggle();

        /// <summary>누르는 동안만 오르내리는 단추(폰).</summary>
        private Button HoldButton(Transform parent, string label, Vector2 pos, float dir)
        {
            var b = NewButton(parent, label, new Vector2(1f, 0f), pos, new Vector2(110f, 130f), new Color(0.3f, 0.5f, 0.75f, 0.6f), 40);
            b.onClick.AddListener(HoldNoop); // 동작은 아래 EventTrigger(누르는 동안) — 배선 검사(ButtonWiringCheck)가 리스너 없는 단추로 보지 않게
            var trig = b.gameObject.AddComponent<EventTrigger>();
            void Add(EventTriggerType t, float v)
            {
                var e = new EventTrigger.Entry { eventID = t };
                e.callback.AddListener(_ => _touchLift = v);
                trig.triggers.Add(e);
            }
            Add(EventTriggerType.PointerDown, dir);
            Add(EventTriggerType.PointerUp, 0f);
            Add(EventTriggerType.PointerExit, 0f);
            return b;
        }

        private static void HoldNoop() { }

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
            var tgo = new GameObject("Text", typeof(RectTransform));
            tgo.transform.SetParent(go.transform, false);
            var trect = (RectTransform)tgo.transform;
            trect.anchorMin = trect.anchorMax = trect.pivot = new Vector2(0.5f, 0.5f);
            trect.sizeDelta = size;
            var text = tgo.AddComponent<TextMeshProUGUI>();
            text.fontSize = fontSize;
            text.alignment = TextAlignmentOptions.Center;
            text.color = Color.white;
            text.textWrappingMode = TextWrappingModes.Normal;
            text.text = label;
            text.raycastTarget = false;
            return button;
        }

        private void OnChanged()
        {
            if (DungeonMounts.Riding == null) _touchLift = 0f;
            RefreshUi();
        }

        private void RefreshUi()
        {
            _lastLang = DungeonLocalization.CurrentLanguage;
            var pc = Pc;
            bool can = !DungeonMounts.OffForTest && pc != null && DungeonMounts.Selected() != null && DungeonMounts.InOpenWorld(pc.transform.position) && !DungeonCutscenes.Playing;
            if (_ride != null)
            {
                if (_ride.gameObject.activeSelf != can) _ride.gameObject.SetActive(can);
                if (can && _rideText != null)
                {
                    var m = DungeonMounts.Riding ?? DungeonMounts.Selected();
                    _rideText.text = (DungeonMounts.Riding != null ? DungeonLocalization.T("mount.btn_off", "내리기") : DungeonLocalization.T("mount.btn_on", "타기")) + "\n" + m.Name;
                }
            }
            bool fly = DungeonMounts.RidingFly;
            if (_up != null && _up.gameObject.activeSelf != fly) _up.gameObject.SetActive(fly);
            if (_down != null && _down.gameObject.activeSelf != fly) _down.gameObject.SetActive(fly);
        }

        // ---- 타고 내리기 ----

        private PlayerController Pc
        {
            get
            {
                if (_pc == null) _pc = FindFirstObjectByType<PlayerController>();
                return _pc;
            }
        }

        private static void Say(string s)
        {
            if (DialogueLabel.Instance != null) DialogueLabel.Instance.Show(s, 2.5f);
        }

        /// <summary>H — 타고 있으면 내리고, 아니면 고른 탈것을 탄다(칸 안에서만). 성공하면 true(진단도 부른다).</summary>
        public bool Toggle()
        {
            if (DungeonMounts.Riding != null)
            {
                DungeonMounts.Dismount();
                Say(DungeonLocalization.T("mount.off", "탈것에서 내렸다"));
                return true;
            }
            var pc = Pc;
            if (pc == null) return false;
            if (pc.Mode != PlayerController.MoveMode.Ground) { Say(DungeonLocalization.T("mount.need_ground", "땅에 서서 탄다")); return false; }
            if (!DungeonMounts.TryRide(pc.transform.position, out string why)) { Say(why); return false; }
            Say(string.Format(DungeonLocalization.T("mount.on", "{0} 을(를) 탔다"), DungeonMounts.Riding.Name));
            return true;
        }

        /// <summary>Shift+H — 다른 탈것으로 고른다(진단도 부른다).</summary>
        public bool CycleSelection()
        {
            var m = DungeonMounts.Cycle();
            if (m == null) { Say(DungeonLocalization.T("mount.none", "아직 탈것이 없다 — 모험 레벨 5 에 첫 탈것")); return false; }
            Say(string.Format(DungeonLocalization.T("mount.sel", "{0} 로 골랐다"), m.Name));
            return true;
        }

        private void OnStruck()
        {
            if (DungeonMounts.Riding == null) return;
            DungeonMounts.Dismount();
            Say(DungeonLocalization.T("mount.auto_attack", "싸우려고 탈것에서 내렸다"));
        }

        private void OnHurt()
        {
            if (DungeonMounts.Riding == null) return;
            DungeonMounts.Dismount();
            Say(DungeonLocalization.T("mount.auto_hurt", "맞아서 탈것에서 내렸다"));
        }

        private void Update()
        {
            var pc = Pc;
            if (pc == null) return;
            var kb = Keyboard.current;
            float lift = _touchLift;
            if (kb != null)
            {
                if (kb.hKey.wasPressedThisFrame && !DungeonCutscenes.Playing)
                {
                    if (kb.leftShiftKey.isPressed || kb.rightShiftKey.isPressed) CycleSelection();
                    else Toggle();
                }
                if (kb.xKey.isPressed) lift = 1f;
                else if (kb.zKey.isPressed) lift = -1f;
            }
            DungeonMounts.Lift = DungeonMounts.RidingFly ? lift : 0f;
            _airTime = pc.Mode == PlayerController.MoveMode.Air ? _airTime + Time.deltaTime : 0f; // 작은 턱을 내려서는 순간(한두 프레임)은 뛴 게 아니다
            if (DungeonMounts.Riding != null)
            {
                if (DungeonCutscenes.Playing) DungeonMounts.Dismount();
                else if (!DungeonMounts.InOpenWorld(pc.transform.position))
                {
                    DungeonMounts.Dismount(); // 던전 문·능묘·난입·시련 방 — 칸 밖
                    Say(DungeonLocalization.T("mount.auto_dungeon", "던전에 들어가 탈것에서 내렸다"));
                }
                else if (!DungeonMounts.Unlocked(DungeonMounts.Riding)) DungeonMounts.Dismount();
                else if (DungeonMounts.RidingGround && (_airTime > AirDismountSec || pc.Climbing))
                {
                    DungeonMounts.Dismount(); // 뛰거나 벽을 붙잡으면 저절로 내린다
                    Say(DungeonLocalization.T("mount.auto_off", "탈것에서 내렸다"));
                }
                else if (DungeonMounts.RidingFly && pc.Climbing) DungeonMounts.Dismount();
            }
            _refreshWait -= Time.deltaTime;
            if (_refreshWait <= 0f || DungeonLocalization.CurrentLanguage != _lastLang) { _refreshWait = 0.25f; RefreshUi(); }
        }

        // ---- 모양 ----

        private void LateUpdate()
        {
            var pc = Pc;
            if (pc == null) return;
            var m = DungeonMounts.Riding;
            _rig.Tick(pc.transform, pc.Visual, m?.Id, m != null && m.IsFly, pc.Mode == PlayerController.MoveMode.Fly);
        }

        /// <summary>나를 등 높이로 올리는 값(m) — 말은 낮게, 학·용은 높게.</summary>
        public static float LiftOf(DungeonMounts.Mount m) => MountRig.LiftOf(m?.Id, m != null && m.IsFly);

    }
}
