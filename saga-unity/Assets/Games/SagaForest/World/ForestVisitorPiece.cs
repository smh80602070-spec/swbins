using UnityEngine;
using Saga.Forest.Data;

namespace Saga.Forest.World
{
    /// <summary>
    /// PLAN.md 109-12-1 흩어진 조각 하나(난파 선원 나침반 조각 · 도깨비불 조각) — 존 안에 떠서 돌며 빛나고,
    /// 플레이어가 1.6m 안에 오면 줍는다(`ForestVisitorRunner.OnPicked`). 땅 휨만큼 내린다.
    /// </summary>
    public class ForestVisitorPiece : MonoBehaviour
    {
        private Transform _visual;
        private Transform _body;
        private Transform _player;
        private float _t;

        public int Index { get; private set; }

        public void Build(int index, string visitorKey)
        {
            Index = index;
            _t = index * 0.7f;
            _visual = new GameObject("Visual").transform;
            _visual.SetParent(transform, false);
            bool wisp = visitorKey == "wisp";
            var b = GameObject.CreatePrimitive(wisp ? PrimitiveType.Sphere : PrimitiveType.Cylinder);
            b.name = "Piece";
            Destroy(b.GetComponent<Collider>());
            b.transform.SetParent(_visual, false);
            b.transform.localPosition = Vector3.up * 0.8f;
            b.transform.localScale = wisp ? Vector3.one * 0.32f : new Vector3(0.45f, 0.04f, 0.45f);
            if (!wisp) b.transform.localRotation = Quaternion.Euler(70f, 0f, 0f);
            _body = b.transform;
            Color c = wisp ? new Color(0.55f, 0.85f, 1f) : new Color(1f, 0.8f, 0.35f);
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

        private void Update()
        {
            _t += Time.deltaTime;
            if (_body != null)
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
