using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Story.Cinematics;
using Saga.Story.Data;
using Saga.Story.Player;
using Saga.Story.UI;
using Saga.Core;

namespace Saga.Story.World
{
    /// <summary>
    /// PLAN.md 109-15 탈것·비행 — 입력·화면·모양. **H = 타고 내리기 · Shift+H = 다른 탈것 고르기**(폰은 공격 단추 왼쪽 "타기" 단추).
    /// 지상 탈것은 이동·점프 배율, 날개 탈것은 **공중에서 점프(Space·점프 단추)를 다시 누르면 날갯짓**으로 솟는다(`StoryPlayerController.Walk`).
    /// 저절로 내리는 때(메이플의 "탈것 위에선 못 싸운다"): 공격·무예를 쓰면(`StoryPlayerController.Attacked`) · 맞으면(`StoryPlayerHp.Hurted`) · 컷 동안 · 줄을 잡으면(지상 탈것) · 못 쓰게 되면.
    /// 두목이 살아 있는 사냥터에선 날개 탈것도 못 난다(걷는 배율만 — `StoryMounts.BossHere` 를 여기서 매 프레임 채운다).
    /// 탈것 모양은 코드로 그린 기본 도형(말·학·용 — 원작 모양 아님)을 나 밑에 붙이고 나는 그 등 높이로 올린다.
    /// `GameBootstrap.Start()` 가 Play 때 붙인다(씬 재빌드 없음).
    /// </summary>
    public class MountField : MonoBehaviour
    {
        public static MountField Instance { get; private set; }

        private MountRig _rig;

        private Button _ride;
        private TextMeshProUGUI _rideText;
        private float _refreshWait;
        private string _lastLang;
        private StoryPlayerController _pc;

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
            StoryMounts.Changed += OnChanged;
            StoryPlayerController.Attacked += OnAttacked;
            StoryPlayerHp.Hurted += OnHurted;
        }

        private void OnDestroy()
        {
            StoryMounts.Changed -= OnChanged;
            StoryPlayerController.Attacked -= OnAttacked;
            StoryPlayerHp.Hurted -= OnHurted;
            StoryMounts.BossHere = false;
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
            StorySettingsState.ApplyUiScale(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            // 오른쪽 아래 맨 아랫줄(점프·공격) 왼쪽 옆 — 다른 줄은 다 찼다.
            var go = new GameObject("MountButton", typeof(RectTransform));
            go.transform.SetParent(canvasGo.transform, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = rect.anchorMax = rect.pivot = new Vector2(1f, 0f);
            rect.anchoredPosition = new Vector2(-380f, 140f);
            rect.sizeDelta = new Vector2(128f, 128f);
            var img = go.AddComponent<Image>();
            img.color = new Color(0.55f, 0.4f, 0.2f, 0.6f);
            _ride = go.AddComponent<Button>();
            _ride.targetGraphic = img;
            var tgo = new GameObject("Text", typeof(RectTransform));
            tgo.transform.SetParent(go.transform, false);
            var trect = (RectTransform)tgo.transform;
            trect.anchorMin = Vector2.zero;
            trect.anchorMax = Vector2.one;
            trect.offsetMin = trect.offsetMax = Vector2.zero;
            _rideText = tgo.AddComponent<TextMeshProUGUI>();
            _rideText.fontSize = 24;
            _rideText.alignment = TextAlignmentOptions.Center;
            _rideText.color = Color.white;
            _rideText.textWrappingMode = TextWrappingModes.Normal;
            _rideText.raycastTarget = false;
            _ride.onClick.AddListener(OnRideClicked);
            go.SetActive(false);
        }

        private void OnRideClicked() => Toggle();

        private void OnChanged() => RefreshUi();

        private void RefreshUi()
        {
            _lastLang = StoryLocalization.CurrentLanguage;
            bool can = !StoryMounts.OffForTest && StoryMounts.Selected() != null && !StoryCutscenes.Playing;
            if (_ride == null) return;
            if (_ride.gameObject.activeSelf != can) _ride.gameObject.SetActive(can);
            if (can && _rideText != null)
            {
                var m = StoryMounts.Riding ?? StoryMounts.Selected();
                _rideText.text = (StoryMounts.Riding != null ? StoryLocalization.T("mount.btn_off", "내리기") : StoryLocalization.T("mount.btn_on", "타기")) + "\n" + m.Name;
            }
        }

        // ---- 타고 내리기 ----

        private StoryPlayerController Pc
        {
            get
            {
                if (_pc == null) _pc = FindFirstObjectByType<StoryPlayerController>();
                return _pc;
            }
        }

        private static void Say(string s)
        {
            if (DialogueLabel.Instance != null) DialogueLabel.Instance.Show(s, 2.5f);
        }

        /// <summary>H — 타고 있으면 내리고, 아니면 고른 탈것을 탄다. 성공하면 true(진단도 부른다).</summary>
        public bool Toggle()
        {
            if (StoryMounts.Riding != null)
            {
                StoryMounts.Dismount();
                Say(StoryLocalization.T("mount.off", "탈것에서 내렸다"));
                return true;
            }
            var pc = Pc;
            if (pc == null) return false;
            if (!StoryMounts.TryRide(pc.OnRope, out string why)) { Say(why); return false; }
            bool fly = StoryMounts.Riding.IsFly;
            Say(string.Format(fly ? StoryLocalization.T("mount.on_fly", "{0} 을(를) 탔다 — 공중에서 점프를 거듭 눌러 난다") : StoryLocalization.T("mount.on", "{0} 을(를) 탔다"), StoryMounts.Riding.Name));
            return true;
        }

        /// <summary>Shift+H — 다른 탈것으로 고른다(진단도 부른다).</summary>
        public bool CycleSelection()
        {
            var m = StoryMounts.Cycle();
            if (m == null) { Say(string.Format(StoryLocalization.T("mount.none", "아직 탈것이 없다 — 레벨 {0} 에 첫 탈것"), StoryMounts.All[0].Lv)); return false; }
            Say(string.Format(StoryLocalization.T("mount.sel", "{0} 로 골랐다"), m.Name));
            return true;
        }

        private void OnAttacked()
        {
            if (StoryMounts.Riding == null) return;
            StoryMounts.Dismount();
            Say(StoryLocalization.T("mount.auto_attack", "싸우려고 탈것에서 내렸다"));
        }

        private void OnHurted(float amount)
        {
            if (StoryMounts.Riding == null) return;
            StoryMounts.Dismount();
            Say(StoryLocalization.T("mount.auto_hurt", "맞아서 탈것에서 내렸다"));
        }

        /// <summary>두목의 싸움터 안인가 — 살아 있는 두목이 X 로 <see cref="StoryMounts.BossArenaM"/> 안이거나 비경(방 하나가 통째로 싸움터)의 두목이다.
        /// 들판 끝의 두목이 저 멀리 서 있는 동안은 아니다(안 그러면 두목을 잡기 전엔 아예 못 난다).</summary>
        public static bool BossNear(float playerX)
        {
            foreach (var e in StoryEnemy.All)
            {
                if (e == null || !e.IsBoss || e.IsDead) continue;
                if (e.IsLabyrinthEnemy || Mathf.Abs(e.transform.position.x - playerX) <= StoryMounts.BossArenaM) return true;
            }
            return false;
        }

        private void Update()
        {
            var pc = Pc;
            if (pc == null) return;
            StoryMounts.BossHere = BossNear(pc.transform.position.x);
            var kb = Keyboard.current;
            if (kb != null && kb.hKey.wasPressedThisFrame && !StoryCutscenes.Playing)
            {
                if (kb.leftShiftKey.isPressed || kb.rightShiftKey.isPressed) CycleSelection();
                else Toggle();
            }
            if (StoryMounts.Riding != null)
            {
                if (StoryCutscenes.Playing) StoryMounts.Dismount();
                else if (!StoryMounts.Unlocked(StoryMounts.Riding)) StoryMounts.Dismount();
                else if (StoryMounts.RidingGround && pc.OnRope)
                {
                    StoryMounts.Dismount(); // 줄을 잡으면 지상 탈것에서 내린다(날개 탈것은 그냥 안 난다)
                    Say(StoryLocalization.T("mount.auto_rope", "줄을 잡아 탈것에서 내렸다"));
                }
            }
            _refreshWait -= Time.deltaTime;
            if (_refreshWait <= 0f || StoryLocalization.CurrentLanguage != _lastLang) { _refreshWait = 0.25f; RefreshUi(); }
        }

        // ---- 모양 ----

        private void LateUpdate()
        {
            var pc = Pc;
            if (pc == null) return;
            var m = StoryMounts.Riding;
            _rig.Tick(pc.transform, pc.Visual, m?.Id, m != null && m.IsFly, pc.FlyActive);
        }

        /// <summary>나를 등 높이로 올리는 값(m) — 말은 낮게, 학·용은 높게.</summary>
        public static float LiftOf(StoryMounts.Mount m) => MountRig.LiftOf(m?.Id, m != null && m.IsFly);

    }
}
