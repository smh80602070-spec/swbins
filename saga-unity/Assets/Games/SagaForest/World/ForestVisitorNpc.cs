using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.UI;
using Saga.Core;

namespace Saga.Forest.World
{
    /// <summary>
    /// PLAN.md 109-12-1 손님 하나 — 광장에 서서, 플레이어가 다가설 때마다(2.5m 안으로 들어올 때, 4m 밖으로 물러났다 오면 또)
    /// 한 번 말한다. 머리 위에 이름표. 몸은 빌린 사실 몸 → 없으면 캡슐, 도깨비불은 빛 구슬(코드 그림).
    /// 사실 몸은 `ForestWorldCurve` 셰이더를 안 타 마을 사람처럼 땅 휨만큼 내린다.
    ///
    /// 109-12-2(웹 §5.10) — 역할 셋: 오늘 손님(`Talk`) · 눌러앉은 손님(`TalkSettled` — 하루 선물, 수다 중이면 그 대화) ·
    /// 도깨비 꼬마(작게, 한마디). **몸짓**: 5m 안이면 나를 돌아보고(수다 짝이 있으면 평소엔 짝을 본다) 4m 안에서 4초마다 👋,
    /// 그날 부탁을 다 들어주면(꼬마는 늘) 제자리에서 깡충 뛰며 천천히 돈다. 이 판 몸은 대기 클립뿐이라 손짓은 머리 위 글자로.
    /// </summary>
    public class ForestVisitorNpc : MonoBehaviour
    {
        public enum Role { Today, Settled, Kid }

        public const float FaceRadius = 5f;
        public const float WaveRadius = 4f;
        public const float WaveEverySec = 4f;
        public const float WaveShowSec = 1f;
        public const float HopHeight = 0.25f;
        public const float DanceSpinDegPerSec = 60f;

        private ForestVisitors.Visitor _data;
        private ForestVisitorRunner _runner;
        private Transform _visual;
        private float _visualBaseY;
        private Transform _player;
        private bool _armed = true;
        private TMPro.TextMeshPro _tag;
        private TMPro.TextMeshPro _wave;
        private Camera _cam;
        private float _t;
        private float _waveLeft, _waveShow;
        private bool _orb;
        private float _hop;

        public ForestVisitors.Visitor Data => _data;
        public Role Kind { get; private set; }
        public Transform Visual => _visual;
        public bool Rigged { get; private set; }
        public bool Orb => _orb;
        public int TalkCount { get; private set; }
        public string LastLine { get; private set; }
        public string TagText => _tag != null ? _tag.text : null;
        /// <summary>수다 짝(없으면 null)·그 대화.</summary>
        public ForestVisitorNpc ChatWith { get; set; }
        public string Chat { get; set; }
        /// <summary>진단 — 지금 춤추나·손짓 글자가 떴나.</summary>
        public bool Dancing => Kind == Role.Kid || (Kind == Role.Today && ForestVisitors.Rec.Done && ForestVisitors.Rec.Key == _data.Key);
        public bool Waving => _waveShow > 0f;
        public float BodyHeight => Kind == Role.Kid ? ForestVisitors.KidHeight : ForestVisitors.Height;

        public void Build(ForestVisitors.Visitor data, GameObject model, ForestVisitorRunner runner, Role role = Role.Today)
        {
            _data = data;
            _runner = runner;
            Kind = role;
            float h = BodyHeight;
            if (role != Role.Kid && string.IsNullOrEmpty(data.Body)) BuildOrb();
            else if (NpcIdle.SpawnRigged(model, transform, h) != null) Rigged = true;
            else CharacterVisual.SpawnFallbackCapsule(transform, h, role == Role.Kid ? new Color(0.85f, 0.3f, 0.25f) : new Color(0.75f, 0.55f, 0.3f));
            _visual = transform.Find("Visual");
            if (_visual != null) _visualBaseY = _visual.localPosition.y;

            var tagGo = new GameObject("NameTag");
            tagGo.transform.SetParent(transform, false);
            tagGo.transform.localPosition = Vector3.up * (h + 0.45f);
            string label = role == Role.Kid ? "🧒 " + ForestVisitors.KidName() : $"{data.Emoji} {ForestVisitors.Name(data)}";
            _tag = Saga.Core.SagaWorldText.Add(tagGo, label, 48f * (role == Role.Kid ? 0.06f : 0.08f), new Color(1f, 0.93f, 0.7f));
            var waveGo = new GameObject("Wave");
            waveGo.transform.SetParent(transform, false);
            waveGo.transform.localPosition = Vector3.up * (h + 0.95f);
            _wave = Saga.Core.SagaWorldText.Add(waveGo, "👋", 48f * 0.12f, Color.white);
            _wave.gameObject.SetActive(false);
            _waveLeft = 0f;
            _cam = Camera.main;
        }

        /// <summary>도깨비불 — 떠서 흔들리는 푸른 빛 구슬 + 점광(몸 모델 없음).</summary>
        private void BuildOrb()
        {
            _orb = true;
            var root = new GameObject("Visual").transform;
            root.SetParent(transform, false);
            var ball = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            ball.name = "Wisp";
            Destroy(ball.GetComponent<Collider>());
            ball.transform.SetParent(root, false);
            ball.transform.localPosition = Vector3.up * 1.3f;
            ball.transform.localScale = Vector3.one * 0.55f;
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "VisitorWisp (generated)" };
            mat.color = new Color(0.55f, 0.85f, 1f);
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", new Color(0.35f, 0.75f, 1f) * 2.5f);
            ball.GetComponent<MeshRenderer>().sharedMaterial = mat;
            var light = new GameObject("Glow").AddComponent<Light>();
            light.transform.SetParent(ball.transform, false);
            light.type = LightType.Point;
            light.color = new Color(0.5f, 0.8f, 1f);
            light.range = 5f;
            light.intensity = 1.6f;
        }

        private void Update()
        {
            if (_player == null)
            {
                var go = GameObject.FindWithTag("Player");
                if (go != null) _player = go.transform;
            }
            Step(Time.deltaTime, _player != null ? _player.position : (Vector3?)null);
            if (_player != null) CheckTalk(_player.position);
        }

        private void LateUpdate()
        {
            if (_player != null) FollowCurve(_player.position);
        }

        /// <summary>몸짓 한 걸음 — 돌아보기·손짓·춤(진단도 부른다).</summary>
        public void Step(float dt, Vector3? playerPos)
        {
            _t += dt;
            if (_orb && _visual != null && _visual.childCount > 0)
                _visual.GetChild(0).localPosition = Vector3.up * (1.3f + 0.18f * Mathf.Sin(_t * 2.2f));
            float dist = playerPos.HasValue ? Flat(playerPos.Value - transform.position) : float.MaxValue;
            if (Dancing)
            {
                // 깡충 + 천천히 돎(웹 3D 춤).
                _hop = Mathf.Abs(Mathf.Sin(_t * 5f)) * HopHeight * (Kind == Role.Kid ? 0.7f : 1f);
                transform.Rotate(Vector3.up, DanceSpinDegPerSec * dt, Space.World);
            }
            else
            {
                _hop = 0f;
                Vector3? look = null;
                if (dist <= FaceRadius) look = playerPos.Value;
                else if (ChatWith != null) look = ChatWith.transform.position;
                if (look.HasValue)
                {
                    var d = look.Value - transform.position;
                    d.y = 0f;
                    if (d.sqrMagnitude > 0.01f)
                        transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(d), Mathf.Clamp01(dt * 6f));
                }
            }
            // 손짓 — 곁(4m)에 있으면 4초마다 1초 👋(춤출 땐 안 한다).
            _waveShow = Mathf.Max(0f, _waveShow - dt);
            if (!Dancing && Kind != Role.Kid && dist <= WaveRadius)
            {
                _waveLeft -= dt;
                if (_waveLeft <= 0f) { _waveLeft = WaveEverySec; _waveShow = WaveShowSec; }
            }
            else _waveLeft = 0f;
            if (_wave != null) _wave.gameObject.SetActive(_waveShow > 0f);
            if (_cam != null)
            {
                if (_tag != null) _tag.transform.rotation = _cam.transform.rotation;
                if (_wave != null) _wave.transform.rotation = _cam.transform.rotation;
            }
        }

        /// <summary>다가서면 한 번 말한다 — 물러났다(4m) 다시 오면 또. 말했으면 그 글(진단도 부른다).</summary>
        public string CheckTalk(Vector3 playerPos)
        {
            float d = Flat(playerPos - transform.position);
            if (d > ForestVisitors.LeaveRadius) { _armed = true; return null; }
            if (!_armed || d > ForestVisitors.TalkRadius) return null;
            _armed = false;
            TalkCount++;
            switch (Kind)
            {
                case Role.Kid: LastLine = ForestVisitors.KidLine(); break;
                case Role.Settled: LastLine = ForestVisitors.TalkSettled(_data.Key, Chat); break;
                default:
                    LastLine = ForestVisitors.Talk(_runner != null ? _runner.RemainingDirs() : null);
                    break;
            }
            DialogueLabel.Instance?.Show(LastLine, ForestVisitors.LineSec);
            return LastLine;
        }

        /// <summary>땅 휨 따라 "Visual" 을 내린다(`ForestEraFolk.FollowCurve` 와 같은 식) + 춤 깡충.</summary>
        public void FollowCurve(Vector3 curveCenter)
        {
            if (_visual == null) return;
            float dx = transform.position.x - curveCenter.x, dz = transform.position.z - curveCenter.z;
            var p = _visual.localPosition;
            _visual.localPosition = new Vector3(p.x, _visualBaseY - (dx * dx + dz * dz) * ForestLandmark.CurveAmount + _hop, p.z);
        }

        private static float Flat(Vector3 d) => new Vector2(d.x, d.z).magnitude;
    }
}
