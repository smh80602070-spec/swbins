using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// PLAN.md 109-12-1 오늘의 손님 하나 — 광장에 서서, 플레이어가 다가설 때마다(2.5m 안으로 들어올 때, 4m 밖으로 물러났다 오면 또)
    /// 한 번 말한다(`ForestVisitors.Talk`). 머리 위에 이름표. 몸은 빌린 사실 몸 → 없으면 캡슐, 도깨비불은 빛 구슬(코드 그림).
    /// 사실 몸은 `ForestWorldCurve` 셰이더를 안 타 마을 사람처럼 땅 휨만큼 내린다.
    /// </summary>
    public class ForestVisitorNpc : MonoBehaviour
    {
        private ForestVisitors.Visitor _data;
        private ForestVisitorRunner _runner;
        private Transform _visual;
        private float _visualBaseY;
        private Transform _player;
        private bool _armed = true;
        private TMPro.TextMeshPro _tag;
        private Camera _cam;
        private float _t;
        private bool _orb;

        public ForestVisitors.Visitor Data => _data;
        public Transform Visual => _visual;
        public bool Rigged { get; private set; }
        public bool Orb => _orb;
        public int TalkCount { get; private set; }
        public string LastLine { get; private set; }
        public string TagText => _tag != null ? _tag.text : null;

        public void Build(ForestVisitors.Visitor data, GameObject model, ForestVisitorRunner runner)
        {
            _data = data;
            _runner = runner;
            if (string.IsNullOrEmpty(data.Body)) BuildOrb();
            else if (NpcIdle.SpawnRigged(model, transform, ForestVisitors.Height) != null) Rigged = true;
            else CharacterVisual.SpawnFallbackCapsule(transform, ForestVisitors.Height, new Color(0.75f, 0.55f, 0.3f));
            _visual = transform.Find("Visual");
            if (_visual != null) _visualBaseY = _visual.localPosition.y;

            var tagGo = new GameObject("NameTag");
            tagGo.transform.SetParent(transform, false);
            tagGo.transform.localPosition = Vector3.up * (ForestVisitors.Height + 0.45f);
            _tag = Saga.Core.SagaWorldText.Add(tagGo, $"{data.Emoji} {ForestVisitors.Name(data)}", 48f * 0.08f, new Color(1f, 0.93f, 0.7f));
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
            _t += Time.deltaTime;
            if (_orb && _visual != null && _visual.childCount > 0)
                _visual.GetChild(0).localPosition = Vector3.up * (1.3f + 0.18f * Mathf.Sin(_t * 2.2f));
            if (_tag != null && _cam != null) _tag.transform.rotation = _cam.transform.rotation;
            if (_player == null)
            {
                var go = GameObject.FindWithTag("Player");
                if (go == null) return;
                _player = go.transform;
            }
            CheckTalk(_player.position);
        }

        private void LateUpdate()
        {
            if (_player != null) FollowCurve(_player.position);
        }

        /// <summary>다가서면 한 번 말한다 — 물러났다(4m) 다시 오면 또. 말했으면 그 글(진단도 부른다).</summary>
        public string CheckTalk(Vector3 playerPos)
        {
            float d = Vector2.Distance(new Vector2(playerPos.x, playerPos.z), new Vector2(transform.position.x, transform.position.z));
            if (d > ForestVisitors.LeaveRadius) { _armed = true; return null; }
            if (!_armed || d > ForestVisitors.TalkRadius) return null;
            _armed = false;
            TalkCount++;
            LastLine = ForestVisitors.Talk(_runner != null ? _runner.RemainingDirs() : null);
            DialogueLabel.Instance?.Show(LastLine, ForestVisitors.LineSec);
            return LastLine;
        }

        /// <summary>땅 휨 따라 "Visual" 을 내린다(`ForestEraFolk.FollowCurve` 와 같은 식).</summary>
        public void FollowCurve(Vector3 curveCenter)
        {
            if (_visual == null) return;
            float dx = transform.position.x - curveCenter.x, dz = transform.position.z - curveCenter.z;
            var p = _visual.localPosition;
            _visual.localPosition = new Vector3(p.x, _visualBaseY - (dx * dx + dz * dz) * ForestLandmark.CurveAmount, p.z);
        }
    }
}
