using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Story.Cinematics;
using Saga.Story.Data;
using Saga.Story.Player;
using Saga.Story.UI;

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

        private Button _ride;
        private TextMeshProUGUI _rideText;
        private float _refreshWait;
        private string _lastLang;
        private GameObject _body;
        private string _bodyId = "";
        private StoryPlayerController _pc;
        private Transform _visual;
        private Vector3 _visualBase;
        private bool _lifted;
        private Transform _wingL, _wingR;
        private float _wingT;

        public Button RideButton => _ride;
        public string RideLabel => _rideText != null ? _rideText.text : "";
        public bool BodyShown => _body != null && _body.activeSelf;
        public string BodyId => _body != null ? _bodyId : "";
        public float RiderLiftNow { get; private set; }

        public static MountField Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("MountField").AddComponent<MountField>();
        }

        private void Awake()
        {
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
            if (pc.Visual != _visual) { RestoreRider(); _visual = pc.Visual; _visualBase = _visual != null ? _visual.localPosition : Vector3.zero; }
            if (m == null)
            {
                RestoreRider();
                if (_body != null && _body.activeSelf) _body.SetActive(false);
                RiderLiftNow = 0f;
                return;
            }
            if (_body == null || _bodyId != m.Id) RebuildBody(m);
            if (!_body.activeSelf) _body.SetActive(true);
            float lift = LiftOf(m);
            RiderLiftNow = lift;
            if (_visual != null)
            {
                if (!_lifted) { _visualBase = _visual.localPosition; _lifted = true; }
                _visual.localPosition = _visualBase + Vector3.up * lift;
                _body.transform.rotation = Quaternion.Euler(0f, _visual.eulerAngles.y, 0f);
            }
            _body.transform.position = pc.transform.position;
            if (m.IsFly && _wingL != null)
            {
                bool air = pc.FlyActive;
                _wingT += Time.deltaTime * (air ? 6f : 1.2f);
                float a = air ? Mathf.Sin(_wingT) * 28f : 8f;
                _wingL.localRotation = Quaternion.Euler(0f, 0f, a);
                _wingR.localRotation = Quaternion.Euler(0f, 0f, -a);
            }
        }

        private void RestoreRider()
        {
            if (_lifted && _visual != null) _visual.localPosition = _visualBase;
            _lifted = false;
        }

        /// <summary>나를 등 높이로 올리는 값(m) — 말은 낮게, 학·용은 높게.</summary>
        public static float LiftOf(StoryMounts.Mount m) => m == null ? 0f : m.Id == "mt_dragon" ? 1.45f : m.IsFly ? 1.25f : 0.85f;

        private static Material Mat(Color c, float smooth = 0.25f)
        {
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { color = c };
            mat.SetFloat("_Smoothness", smooth);
            return mat;
        }

        private static GameObject Part(Transform parent, PrimitiveType t, string name, Vector3 local, Vector3 scale, Material mat, Vector3 euler = default)
        {
            var g = GameObject.CreatePrimitive(t);
            g.name = name;
            var col = g.GetComponent<Collider>();
            if (col != null) Destroy(col); // 나(CharacterController)와 부딪히지 않게 — 모양만
            g.transform.SetParent(parent, false);
            g.transform.localPosition = local;
            g.transform.localRotation = Quaternion.Euler(euler);
            g.transform.localScale = scale;
            g.GetComponent<MeshRenderer>().sharedMaterial = mat;
            return g;
        }

        private void RebuildBody(StoryMounts.Mount m)
        {
            if (_body != null) Destroy(_body);
            _bodyId = m.Id;
            _body = new GameObject("Mount_" + m.Id);
            var t = _body.transform;
            _wingL = _wingR = null;
            switch (m.Id)
            {
                case "mt_crane": BuildCrane(t); break;
                case "mt_dragon": BuildDragon(t); break;
                default: BuildHorse(t, m.Id == "mt_white" ? new Color(0.93f, 0.93f, 0.95f) : m.Id == "mt_brown" ? new Color(0.45f, 0.28f, 0.16f) : new Color(0.66f, 0.5f, 0.3f)); break;
            }
        }

        /// <summary>말 — 몸통·목·머리·다리 넷·꼬리·갈기(앞이 +z).</summary>
        private static void BuildHorse(Transform t, Color coat)
        {
            var body = Mat(coat);
            var dark = Mat(coat * 0.55f);
            Part(t, PrimitiveType.Cube, "Body", new Vector3(0f, 1.0f, 0f), new Vector3(0.7f, 0.7f, 1.5f), body);
            Part(t, PrimitiveType.Cube, "Neck", new Vector3(0f, 1.5f, 0.85f), new Vector3(0.3f, 0.75f, 0.35f), body, new Vector3(28f, 0f, 0f));
            Part(t, PrimitiveType.Cube, "Head", new Vector3(0f, 1.8f, 1.25f), new Vector3(0.3f, 0.35f, 0.62f), body, new Vector3(-10f, 0f, 0f));
            Part(t, PrimitiveType.Cube, "Mane", new Vector3(0f, 1.62f, 0.7f), new Vector3(0.1f, 0.7f, 0.2f), dark, new Vector3(28f, 0f, 0f));
            foreach (float x in new[] { -0.25f, 0.25f })
                foreach (float z in new[] { -0.55f, 0.55f })
                    Part(t, PrimitiveType.Cylinder, "Leg", new Vector3(x, 0.4f, z), new Vector3(0.14f, 0.4f, 0.14f), dark);
            Part(t, PrimitiveType.Cube, "Tail", new Vector3(0f, 1.05f, -0.9f), new Vector3(0.12f, 0.6f, 0.15f), dark, new Vector3(-25f, 0f, 0f));
            Part(t, PrimitiveType.Cube, "Saddle", new Vector3(0f, 1.4f, -0.05f), new Vector3(0.6f, 0.08f, 0.5f), Mat(new Color(0.35f, 0.15f, 0.1f)));
        }

        /// <summary>학 — 가는 몸통·긴 목과 다리·큰 날개 둘(날갯짓).</summary>
        private void BuildCrane(Transform t)
        {
            var white = Mat(new Color(0.96f, 0.96f, 0.94f));
            var black = Mat(new Color(0.1f, 0.1f, 0.12f));
            var red = Mat(new Color(0.85f, 0.15f, 0.1f));
            Part(t, PrimitiveType.Sphere, "Body", new Vector3(0f, 1.15f, 0f), new Vector3(0.75f, 0.6f, 1.5f), white);
            Part(t, PrimitiveType.Cylinder, "Neck", new Vector3(0f, 1.75f, 0.85f), new Vector3(0.14f, 0.55f, 0.14f), white, new Vector3(25f, 0f, 0f));
            Part(t, PrimitiveType.Sphere, "Head", new Vector3(0f, 2.3f, 1.15f), new Vector3(0.25f, 0.25f, 0.35f), white);
            Part(t, PrimitiveType.Cube, "Beak", new Vector3(0f, 2.28f, 1.5f), new Vector3(0.06f, 0.06f, 0.45f), black);
            Part(t, PrimitiveType.Cube, "Crest", new Vector3(0f, 2.45f, 1.1f), new Vector3(0.12f, 0.05f, 0.12f), red);
            foreach (float x in new[] { -0.15f, 0.15f }) Part(t, PrimitiveType.Cylinder, "Leg", new Vector3(x, 0.55f, -0.1f), new Vector3(0.05f, 0.55f, 0.05f), black);
            Part(t, PrimitiveType.Cube, "Tail", new Vector3(0f, 1.2f, -0.95f), new Vector3(0.3f, 0.06f, 0.7f), black);
            _wingL = WingRoot(t, "WingL", new Vector3(-0.35f, 1.4f, 0.05f)); _wingR = WingRoot(t, "WingR", new Vector3(0.35f, 1.4f, 0.05f));
            Part(_wingL, PrimitiveType.Cube, "Wing", new Vector3(-1.1f, 0f, 0f), new Vector3(2.2f, 0.06f, 1.1f), white);
            Part(_wingR, PrimitiveType.Cube, "Wing", new Vector3(1.1f, 0f, 0f), new Vector3(2.2f, 0.06f, 1.1f), white);
            Part(_wingL, PrimitiveType.Cube, "Tip", new Vector3(-2.15f, 0f, 0f), new Vector3(0.5f, 0.07f, 1.0f), black);
            Part(_wingR, PrimitiveType.Cube, "Tip", new Vector3(2.15f, 0f, 0f), new Vector3(0.5f, 0.07f, 1.0f), black);
        }

        /// <summary>푸른 용 — 긴 몸통·머리와 뿔·꼬리·큰 날개 둘·발톱.</summary>
        private void BuildDragon(Transform t)
        {
            var azure = Mat(new Color(0.15f, 0.45f, 0.75f), 0.4f);
            var deep = Mat(new Color(0.08f, 0.22f, 0.45f), 0.4f);
            var gold = Mat(new Color(0.95f, 0.8f, 0.25f), 0.5f);
            Part(t, PrimitiveType.Cube, "Body", new Vector3(0f, 1.2f, 0f), new Vector3(0.95f, 0.85f, 2.6f), azure);
            Part(t, PrimitiveType.Cube, "Neck", new Vector3(0f, 1.6f, 1.5f), new Vector3(0.45f, 0.5f, 0.9f), azure, new Vector3(-20f, 0f, 0f));
            Part(t, PrimitiveType.Cube, "Head", new Vector3(0f, 1.85f, 2.2f), new Vector3(0.6f, 0.5f, 0.95f), azure);
            foreach (float x in new[] { -0.2f, 0.2f }) Part(t, PrimitiveType.Cube, "Horn", new Vector3(x, 2.25f, 2.0f), new Vector3(0.08f, 0.5f, 0.08f), gold, new Vector3(-30f, 0f, x * 60f));
            Part(t, PrimitiveType.Cube, "Tail1", new Vector3(0f, 1.1f, -1.8f), new Vector3(0.6f, 0.5f, 1.4f), azure);
            Part(t, PrimitiveType.Cube, "Tail2", new Vector3(0f, 1.0f, -2.9f), new Vector3(0.35f, 0.3f, 1.2f), deep);
            foreach (float x in new[] { -0.4f, 0.4f })
                foreach (float z in new[] { -0.7f, 0.8f }) Part(t, PrimitiveType.Cube, "Claw", new Vector3(x, 0.55f, z), new Vector3(0.2f, 0.5f, 0.3f), deep);
            _wingL = WingRoot(t, "WingL", new Vector3(-0.5f, 1.6f, 0.2f)); _wingR = WingRoot(t, "WingR", new Vector3(0.5f, 1.6f, 0.2f));
            Part(_wingL, PrimitiveType.Cube, "Wing", new Vector3(-1.5f, 0f, 0f), new Vector3(3f, 0.06f, 1.7f), deep);
            Part(_wingR, PrimitiveType.Cube, "Wing", new Vector3(1.5f, 0f, 0f), new Vector3(3f, 0.06f, 1.7f), deep);
        }

        private static Transform WingRoot(Transform parent, string name, Vector3 local)
        {
            var g = new GameObject(name);
            g.transform.SetParent(parent, false);
            g.transform.localPosition = local;
            return g.transform;
        }
    }
}
