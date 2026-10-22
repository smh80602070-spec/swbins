using TMPro;
using UnityEngine;
using Saga.Core;
using Saga.Story.Data;

namespace Saga.Story.World
{
    /// <summary>
    /// tasks U-0170 모닥불에 모여 쉬기(웹 W-0300) — 사냥터 들머리(x <see cref="FireX"/>, 첫 잡졸 3m·줄 6.8m 앞, 길 조금 뒤)에 모닥불 하나.
    /// 자체툴 `campfire_logs_01`(U-0168 과 같은 몸, 없으면 통나무 셋) + 불꽃 공·점광원. 판이 닫혀 있을 때 주인공이 <see cref="SitX"/> 안에
    /// 땅 높이로 서면 앉는다(<see cref="StoryCampfire.Sit"/> — 체력·온기). 한 번 앉으면 <see cref="LeaveX"/> 밖에 나갔다 와야 다시 앉는다
    /// (처음 자리가 불 곁이어도 들어오자마자 앉지 않게 시작은 꺼진 채). 규칙은 <see cref="StoryCampfire"/>.
    /// 씬 재빌드 없이 `GameBootstrap.Start` 가 <see cref="Install"/> 로 세운다(다른 Install 들과 같은 결).
    /// </summary>
    public class StoryCampfireSpot : MonoBehaviour
    {
        public const float FireX = 1.2f, FireZ = 0.9f, SitX = 1.6f, SitY = 1.2f, LeaveX = 4.5f, TickSec = 0.2f;

        public static StoryCampfireSpot Instance { get; private set; }

        private Transform _player;
        private TextMeshPro _label;
        private float _tick;
        private bool _armed;

        public bool Armed => _armed;
        public Vector3 FirePos => new Vector3(FireX, 0f, FireZ);

        public static StoryCampfireSpot Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("StoryCampfire").AddComponent<StoryCampfireSpot>();
        }

        private void Awake()
        {
            Instance = this;
            transform.position = FirePos;
            if (WorldModels.Spawn("campfire_logs_01", transform, 1.2f) == null)
            {
                for (int i = 0; i < 3; i++)
                {
                    var log = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                    Colliders.Strip(log);
                    log.name = "Log";
                    log.transform.SetParent(transform, false);
                    log.transform.localScale = new Vector3(0.16f, 0.5f, 0.16f);
                    log.transform.localPosition = new Vector3(0f, 0.1f, 0f);
                    log.transform.localRotation = Quaternion.Euler(80f, i * 120f, 0f);
                    log.GetComponent<Renderer>().material.color = new Color(0.35f, 0.22f, 0.12f);
                }
            }
            var flame = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Colliders.Strip(flame);
            flame.name = "Flame";
            flame.transform.SetParent(transform, false);
            flame.transform.localPosition = new Vector3(0f, 0.4f, 0f);
            flame.transform.localScale = new Vector3(0.4f, 0.6f, 0.4f);
            flame.GetComponent<Renderer>().sharedMaterial = new Material(Shader.Find("Universal Render Pipeline/Unlit")) { name = "StoryCampFlame (generated)", color = new Color(1f, 0.55f, 0.15f) };
            var lightGo = new GameObject("Glow");
            lightGo.transform.SetParent(transform, false);
            lightGo.transform.localPosition = new Vector3(0f, 1.1f, 0f);
            var glow = lightGo.AddComponent<Light>();
            glow.type = LightType.Point;
            glow.range = 7f;
            glow.intensity = 2f;
            glow.color = new Color(1f, 0.6f, 0.3f);
            var labelGo = new GameObject("Label");
            labelGo.transform.SetParent(transform, false);
            labelGo.transform.localPosition = new Vector3(0f, 1.9f, 0f);
            _label = labelGo.AddComponent<TextMeshPro>();
            _label.fontSize = 3f;
            _label.alignment = TextAlignmentOptions.Center;
            _label.rectTransform.sizeDelta = new Vector2(6f, 1.2f);
            _label.color = new Color(1f, 0.85f, 0.55f);
        }

        private void Start()
        {
            var pl = GameObject.FindWithTag("Player");
            _player = pl != null ? pl.transform : null;
            _armed = _player == null || !Near(_player.position);
            Refresh();
        }

        private void OnDestroy() { if (Instance == this) Instance = null; }

        private static bool Near(Vector3 p) => Mathf.Abs(p.x - FireX) <= SitX && p.y <= SitY;

        private void Update()
        {
            if (_player == null) return;
            _tick += Time.deltaTime;
            if (_tick < TickSec) return;
            _tick = 0f;
            Sense();
        }

        /// <summary>한 번 살핌(진단도 부른다) — 앉았으면 true.</summary>
        public bool Sense()
        {
            if (_player == null) return false;
            float dx = Mathf.Abs(_player.position.x - FireX);
            if (dx > LeaveX) { _armed = true; Refresh(); return false; }
            if (!_armed || !Near(_player.position) || !StoryCampfire.Sit()) { Refresh(); return false; }
            _armed = false;
            Saga.Story.UI.DialogueLabel.Instance?.Show(StoryCampfire.Line(), 4f);
            Refresh();
            return true;
        }

        private void Refresh()
        {
            if (_label == null) return;
            _label.text = StoryCampfire.HasWarmth
                ? StoryLocalization.T("camp.label_warm", "🔥 모닥불 · 온기 있음")
                : StoryLocalization.T("camp.label", "🔥 모닥불 · 쉬어 가기");
        }

        /// <summary>진단 — 주인공 참조를 다시 잡고 앉기를 켠다.</summary>
        public void ArmForTest()
        {
            var pl = GameObject.FindWithTag("Player");
            _player = pl != null ? pl.transform : null;
            _armed = true;
        }
    }
}
