using UnityEngine;
using Saga.Forest.Data;

namespace Saga.Forest.World
{
    /// <summary>
    /// PLAN.md 109-12-1 흩어진 조각 하나(난파 선원 나침반 조각 · 도깨비불 조각 · 109-12-2 탐사선 부품 · 꼬마가 숨은 흔들리는 덤불) — 존 안에 떠서 돌며 빛나고(덤불은 땅에서 흔들리고),
    /// 플레이어가 1.6m 안에 오면 줍는다(`ForestVisitorRunner.OnPicked`). 땅 휨만큼 내린다.
    /// </summary>
    public class ForestVisitorPiece : MonoBehaviour
    {
        private Transform _visual;
        private Transform _body;
        private Transform _player;
        private float _t;
        private bool _bush;

        public int Index { get; private set; }

        public void Build(int index, string visitorKey)
        {
            Index = index;
            _t = index * 0.7f;
            _visual = new GameObject("Visual").transform;
            _visual.SetParent(transform, false);
            if (visitorKey == "dokkaebi") { BuildBush(); return; }
            bool wisp = visitorKey == "wisp";
            bool part = visitorKey == "alien";
            var b = GameObject.CreatePrimitive(wisp ? PrimitiveType.Sphere : part ? PrimitiveType.Cube : PrimitiveType.Cylinder);
            b.name = "Piece";
            Destroy(b.GetComponent<Collider>());
            b.transform.SetParent(_visual, false);
            b.transform.localPosition = Vector3.up * 0.8f;
            b.transform.localScale = wisp ? Vector3.one * 0.32f : part ? new Vector3(0.35f, 0.18f, 0.25f) : new Vector3(0.45f, 0.04f, 0.45f);
            if (!wisp && !part) b.transform.localRotation = Quaternion.Euler(70f, 0f, 0f);
            _body = b.transform;
            Color c = wisp ? new Color(0.55f, 0.85f, 1f) : part ? new Color(0.35f, 0.95f, 0.85f) : new Color(1f, 0.8f, 0.35f);
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "VisitorPiece (generated)" };
            mat.color = c;
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", c * 1.8f);
            b.GetComponent<MeshRenderer>().sharedMaterial = mat;
            var light = new GameObject("Glow").AddComponent<Light>();
            light.transform.SetParent(_visual, false);
            light.transform.localPosition = Vector3.up * 0.9f;
            light.type = LightType.Point;
            light.color = c;
            light.range = 3.5f;
            light.intensity = 1.2f;
        }

        /// <summary>109-12-2 흔들리는 덤불 — 초록 공 셋이 땅에 붙어 흔들린다(빛 없음, 들추면 꼬마).</summary>
        private void BuildBush()
        {
            _bush = true;
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "VisitorBush (generated)" };
            mat.color = new Color(0.22f, 0.5f, 0.2f);
            var root = new GameObject("Bush").transform;
            root.SetParent(_visual, false);
            Vector3[] at = { new Vector3(0f, 0.45f, 0f), new Vector3(0.45f, 0.35f, 0.15f), new Vector3(-0.4f, 0.32f, -0.1f) };
            float[] size = { 0.95f, 0.7f, 0.65f };
            for (int i = 0; i < at.Length; i++)
            {
                var ball = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                Destroy(ball.GetComponent<Collider>());
                ball.transform.SetParent(root, false);
                ball.transform.localPosition = at[i];
                ball.transform.localScale = Vector3.one * size[i];
                ball.GetComponent<MeshRenderer>().sharedMaterial = mat;
            }
            _body = root;
        }

        private void Update()
        {
            _t += Time.deltaTime;
            if (_bush && _body != null)
            {
                // 이따금 부르르 떤다(웹 "흔들리는 덤불").
                float shake = Mathf.Sin(_t * 1.3f) > 0.6f ? Mathf.Sin(_t * 30f) * 6f : 0f;
                _body.localRotation = Quaternion.Euler(shake, 0f, shake * 0.5f);
            }
            else if (_body != null)
            {
                _body.localPosition = Vector3.up * (0.8f + 0.12f * Mathf.Sin(_t * 2.4f));
                _body.Rotate(Vector3.up, 90f * Time.deltaTime, Space.World);
            }
            if (_player == null)
            {
                var go = GameObject.FindWithTag("Player");
                if (go == null) return;
                _player = go.transform;
            }
            if (_visual != null)
            {
                float dx = transform.position.x - _player.position.x, dz = transform.position.z - _player.position.z;
                _visual.localPosition = new Vector3(0f, -(dx * dx + dz * dz) * ForestLandmark.CurveAmount, 0f);
            }
            TryPick(_player.position);
        }

        /// <summary>가까우면 줍는다(진단도 부른다). 주웠으면 true.</summary>
        public bool TryPick(Vector3 playerPos)
        {
            float d = Vector2.Distance(new Vector2(playerPos.x, playerPos.z), new Vector2(transform.position.x, transform.position.z));
            if (d > ForestVisitors.PickRadius) return false;
            var runner = ForestVisitorRunner.Instance;
            if (runner != null) runner.OnPicked(this);
            else Destroy(gameObject);
            return true;
        }
    }
}
