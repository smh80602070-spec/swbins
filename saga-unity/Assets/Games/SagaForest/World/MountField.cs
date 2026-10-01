using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Forest.Data;
using Saga.Forest.Player;
using Saga.Forest.UI;
using Saga.Core;

namespace Saga.Forest.World
{
    /// <summary>
    /// PLAN.md 109-15 탈것·비행 — 입력·화면·모양. **H = 타고 내리기 · Shift+H = 다른 탈것 고르기**(폰은 오른쪽 아래 타기 단추).
    /// 비행 탈것은 타면 저절로 마을 위 2.8m 로 뜬다(오르내림 키 없음 — 웹처럼 한 높이). 저절로 내리는 때: 집에 들어가면 · 못 쓰게 되면.
    /// 뜬 동안엔 손이 닿는 일이 안 된다(줍기·말 걸기·집 문 — 전부 2.5m 안 근접이라) — 내려서 한다.
    /// 탈것 모양은 코드로 그린 기본 도형(사슴·말·학·용 — 원작 모양 아님)을 나 밑에 붙이고 나는 그 등 높이로 올린다.
    /// `ForestBootstrap.Start()` 가 Play 때 붙인다(씬 재빌드 없음).
    /// </summary>
    public class MountField : MonoBehaviour
    {
        public static MountField Instance { get; private set; }

        private MountRig _rig;

        private Button _ride;
        private TextMeshProUGUI _rideText;
        private float _refreshWait;
        private string _lastLang;
        private PlayerController _pc;

        public Button RideButton => _ride;
        public string RideLabel => _rideText != null ? _rideText.text : "";
        public bool BodyShown => _rig != null && _rig.BodyShown;
        public string BodyId => _rig != null ? _rig.BodyId : "";
        public float RiderLiftNow => _rig != null ? _rig.RiderLiftNow : 0f;

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
            ForestMounts.Changed += OnChanged;
        }

        private void OnDestroy()
        {
            ForestMounts.Changed -= OnChanged;
            if (Instance == this) Instance = null;
        }

        // ---- 화면 ----

        private void BuildUi()
        {
            var canvas = EncounterUiKit.NewCanvas("MountUI");
            canvas.sortingOrder = 7;
            canvas.transform.SetParent(transform, false);
            // 오른쪽 아래 — 이 판엔 다른 단추가 없다(왼쪽 아래는 조이스틱).
            _ride = EncounterUiKit.NewButton(canvas.transform, "", new Vector2(1f, 0f), new Vector2(-40f, 120f), new Vector2(200f, 130f), null);
            _rideText = _ride.GetComponentInChildren<TextMeshProUGUI>();
            _rideText.fontSize = 26;
            _ride.onClick.AddListener(OnRideClicked);
            _ride.gameObject.SetActive(false);
        }

        private void OnRideClicked() => Toggle();

        private void OnChanged() => RefreshUi();

        private void RefreshUi()
        {
            _lastLang = ForestLocalization.CurrentLanguage;
            var pc = Pc;
            bool can = !ForestMounts.OffForTest && pc != null && ForestMounts.Selected() != null && !ForestMounts.Indoors(pc.transform.position);
            if (_ride == null) return;
            if (_ride.gameObject.activeSelf != can) _ride.gameObject.SetActive(can);
            if (can && _rideText != null)
            {
                var m = ForestMounts.Riding ?? ForestMounts.Selected();
                _rideText.text = (ForestMounts.Riding != null ? ForestLocalization.T("mount.btn_off", "내리기") : ForestLocalization.T("mount.btn_on", "타기")) + "\n" + m.Name;
            }
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

        /// <summary>H — 타고 있으면 내리고, 아니면 고른 탈것을 탄다(집 밖에서만). 성공하면 true(진단도 부른다).</summary>
        public bool Toggle()
        {
            if (ForestMounts.Riding != null)
            {
                ForestMounts.Dismount();
                Say(ForestLocalization.T("mount.off", "탈것에서 내렸다"));
                return true;
            }
            var pc = Pc;
            if (pc == null) return false;
            if (!ForestMounts.TryRide(pc.transform.position, out string why)) { Say(why); return false; }
            bool fly = ForestMounts.Riding.IsFly;
            Say(string.Format(fly ? ForestLocalization.T("mount.on_fly", "{0} 을(를) 탔다 — 마을 위를 떠서 간다(내리려면 H)") : ForestLocalization.T("mount.on", "{0} 을(를) 탔다"), ForestMounts.Riding.Name));
            return true;
        }

        /// <summary>Shift+H — 다른 탈것으로 고른다(진단도 부른다).</summary>
        public bool CycleSelection()
        {
            var m = ForestMounts.Cycle();
            if (m == null) { Say(string.Format(ForestLocalization.T("mount.none", "아직 탈것이 없다 — 마을 점수 {0}점에 첫 사슴"), ForestMounts.All[0].Score)); return false; }
            Say(string.Format(ForestLocalization.T("mount.sel", "{0} 로 골랐다"), m.Name));
            return true;
        }

        private void Update()
        {
            var pc = Pc;
            if (pc == null) return;
            var kb = Keyboard.current;
            if (kb != null && kb.hKey.wasPressedThisFrame)
            {
                if (kb.leftShiftKey.isPressed || kb.rightShiftKey.isPressed) CycleSelection();
                else Toggle();
            }
            if (ForestMounts.Riding != null)
            {
                if (ForestMounts.Indoors(pc.transform.position))
                {
                    ForestMounts.Dismount();
                    Say(ForestLocalization.T("mount.auto_house", "집에 들어가 탈것에서 내렸다"));
                }
                else if (!ForestMounts.Unlocked(ForestMounts.Riding)) ForestMounts.Dismount();
            }
            _refreshWait -= Time.deltaTime;
            if (_refreshWait <= 0f || ForestLocalization.CurrentLanguage != _lastLang) { _refreshWait = 0.25f; RefreshUi(); }
        }

        // ---- 모양 ----

        private void LateUpdate()
        {
            var pc = Pc;
            if (pc == null) return;
            var m = ForestMounts.Riding;
            _rig.Tick(pc.transform, pc.Visual, m?.Id, m != null && m.IsFly, pc.Flying);
        }

        /// <summary>나를 등 높이로 올리는 값(m) — 말은 낮게, 학·용은 높게.</summary>
        public static float LiftOf(ForestMounts.Mount m) => MountRig.LiftOf(m?.Id, m != null && m.IsFly);

    }
}
