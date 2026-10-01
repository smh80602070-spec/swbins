using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Core;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-15 탈것·비행 — 입력·화면·모양. **H = 타고 내리기 · Shift+H = 다른 탈것 고르기 · (비행) Space 오르기 · Z 내리기**(폰은 🐎 단추와 ▲▼ 단추).
    /// 저절로 내리는 때: 싸움이 붙으면 · 벽을 붙잡거나 헤엄·활공하면(뛰기는 `PlayerController` 가 처리). 탈것 모양은 코드로 그린 기본 도형(말·학·용 — 원작 모양 아님)을 나 밑에 붙이고 나는 그 등 높이로 올린다.
    /// `WorldMapBuilder` 가 Play 때 붙인다(씬 재빌드 없음).
    /// </summary>
    public class MountField : MonoBehaviour
    {
        public static MountField Instance { get; private set; }

        private MountRig _rig;

        private Button _ride, _up, _down;
        private TextMeshProUGUI _rideText;
        private float _touchLift;
        private float _refreshWait;

        public Button RideButton => _ride;
        public Button UpButton => _up;
        public Button DownButton => _down;
        public string RideLabel => _rideText != null ? _rideText.text : "";
        public bool BodyShown => _rig != null && _rig.BodyShown;
        public string BodyId => _rig != null ? _rig.BodyId : "";
        public float RiderLiftNow => _rig != null ? _rig.RiderLiftNow : 0f;

        private void Awake()
        {
            _rig = gameObject.AddComponent<MountRig>();
            Instance = this;
            BuildUi();
            GoMounts.Changed += OnChanged;
        }

        private void OnDestroy()
        {
            GoMounts.Changed -= OnChanged;
            if (Instance == this) Instance = null;
        }

        // ---- 화면 ----

        private void BuildUi()
        {
            var canvas = EncounterUiKit.NewCanvas("MountUI");
            canvas.sortingOrder = 7;
            canvas.transform.SetParent(transform, false);
            _ride = EncounterUiKit.NewButton(canvas.transform, "", new Vector2(0.5f, 0f), new Vector2(-160f, 150f), new Vector2(280f, 70f), null);
            _rideText = _ride.GetComponentInChildren<TextMeshProUGUI>();
            _rideText.fontSize = 24;
            _ride.onClick.AddListener(() => Toggle());
            _up = HoldButton(canvas.transform, GoLocalization.T("mount.up", "▲"), new Vector2(150f, 150f), 1f);
            _down = HoldButton(canvas.transform, GoLocalization.T("mount.down", "▼"), new Vector2(250f, 150f), -1f);
            _ride.gameObject.SetActive(false);
            _up.gameObject.SetActive(false);
            _down.gameObject.SetActive(false);
        }

        /// <summary>누르는 동안만 오르내리는 단추(폰).</summary>
        private Button HoldButton(Transform parent, string label, Vector2 pos, float dir)
        {
            var b = EncounterUiKit.NewButton(parent, label, new Vector2(0.5f, 0f), pos, new Vector2(80f, 70f), null);
            b.GetComponentInChildren<TextMeshProUGUI>().fontSize = 30;
            b.onClick.AddListener(() => { }); // 동작은 아래 EventTrigger(누르는 동안) — 배선 검사(ButtonWiringCheck)가 리스너 없는 단추로 보지 않게
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

        private void OnChanged()
        {
            if (GoMounts.Riding == null) _touchLift = 0f;
            RefreshUi();
        }

        private void RefreshUi()
        {
            var fc = FieldCombat.Instance;
            bool can = !GoMounts.OffForTest && GoMounts.Selected() != null && !StoryState.Talking && (fc == null || !fc.InCombat());
            if (_ride != null)
            {
                if (_ride.gameObject.activeSelf != can) _ride.gameObject.SetActive(can);
                if (can && _rideText != null)
                {
                    var m = GoMounts.Riding ?? GoMounts.Selected();
                    _rideText.text = GoMounts.Riding != null ? string.Format(GoLocalization.T("mount.btn_off", "내리기 (H) · {0}"), m.Name) : string.Format(GoLocalization.T("mount.btn_on", "🐎 타기 (H) · {0}"), m.Name);
                }
            }
            bool fly = GoMounts.RidingFly;
            if (_up != null && _up.gameObject.activeSelf != fly) _up.gameObject.SetActive(fly);
            if (_down != null && _down.gameObject.activeSelf != fly) _down.gameObject.SetActive(fly);
        }

        // ---- 타고 내리기 ----

        private PlayerController Pc
        {
            get { var fc = FieldCombat.Instance; return fc != null ? fc.GetComponent<PlayerController>() : null; }
        }

        private void Say(string s)
        {
            if (DialogueLabel.Instance != null) DialogueLabel.Instance.Show(s, 2.5f);
        }

        /// <summary>H — 타고 있으면 내리고, 아니면 고른 탈것을 탄다(땅 위에서만). 성공하면 true(진단도 부른다).</summary>
        public bool Toggle()
        {
            if (GoMounts.Riding != null)
            {
                GoMounts.Dismount();
                Say(GoLocalization.T("mount.off", "탈것에서 내렸다"));
                return true;
            }
            var pc = Pc;
            if (pc != null && pc.Mode != PlayerController.MoveMode.Ground) { Say(GoLocalization.T("mount.need_ground", "땅에 서서 탄다")); return false; }
            if (!GoMounts.TryRide(Time.time, out string why)) { Say(why); return false; }
            Say(string.Format(GoLocalization.T("mount.on", "{0} 을(를) 탔다"), GoMounts.Riding.Name));
            return true;
        }

        /// <summary>Shift+H — 다른 탈것으로 고른다(진단도 부른다).</summary>
        public bool CycleSelection()
        {
            var m = GoMounts.Cycle();
            if (m == null) { Say(GoLocalization.T("mount.none", "아직 탈것이 없다 — 모험 레벨 5 에 첫 탈것")); return false; }
            Say(string.Format(GoLocalization.T("mount.sel", "{0} 로 골랐다"), m.Name));
            return true;
        }

        private void Update()
        {
            var fc = FieldCombat.Instance;
            var pc = Pc;
            if (fc == null || pc == null) return;
            if (fc.InCombat())
            {
                GoMounts.LastCombatAt = Time.time;
                if (GoMounts.Riding != null) { GoMounts.Dismount(); Say(GoLocalization.T("mount.auto_combat", "싸움이 붙어 탈것에서 내렸다")); }
            }
            var kb = Keyboard.current;
            float lift = _touchLift;
            if (kb != null)
            {
                if (kb.hKey.wasPressedThisFrame && !StoryState.Talking && !FishingField.Busy)
                {
                    if (kb.leftShiftKey.isPressed || kb.rightShiftKey.isPressed) CycleSelection();
                    else Toggle();
                }
                if (kb.spaceKey.isPressed) lift = 1f;
                else if (kb.zKey.isPressed) lift = -1f;
            }
            GoMounts.Lift = GoMounts.RidingFly ? lift : 0f;
            if (GoMounts.Riding != null && (pc.Mode == PlayerController.MoveMode.Climb || pc.Mode == PlayerController.MoveMode.Mantle || pc.Mode == PlayerController.MoveMode.Glide || pc.Mode == PlayerController.MoveMode.Swim))
            {
                GoMounts.Dismount(); // 벽을 붙잡거나 활공·헤엄이면 저절로 내린다
                Say(GoLocalization.T("mount.auto_off", "탈것에서 내렸다"));
            }
            _refreshWait -= Time.deltaTime;
            if (_refreshWait <= 0f) { _refreshWait = 0.25f; RefreshUi(); }
        }

        // ---- 모양 ----

        private void LateUpdate()
        {
            var pc = Pc;
            if (pc == null) return;
            var m = GoMounts.Riding;
            _rig.Tick(pc.transform, pc.Visual, m?.Id, m != null && m.IsFly, pc.Mode == PlayerController.MoveMode.Fly);
        }

        /// <summary>나를 등 높이로 올리는 값(m) — 말은 낮게, 학·용은 높게.</summary>
        public static float LiftOf(GoMounts.Mount m) => MountRig.LiftOf(m?.Id, m != null && m.IsFly);

    }
}
