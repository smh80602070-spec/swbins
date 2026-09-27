using UnityEngine;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 109-10-8 동행 서명 파동 — 땅 위 고리 하나가 0.35초에 반경까지 번지며 흐려지고 사라진다(웹 fx 'whirl' life 0.35).
    /// `PartySummon` 의 충격 고리와 같은 LineRenderer 결.
    /// </summary>
    public class SigPulse : MonoBehaviour
    {
        public const float LifeSec = 0.35f;
        private const int Segments = 48;

        private LineRenderer _ring;
        private float _radius, _t;
        private Color _color;

        public static SigPulse Spawn(Vector3 groundPos, float radius, Color color)
        {
            var go = new GameObject("SigPulse");
            go.transform.position = groundPos + Vector3.up * 0.08f;
            var p = go.AddComponent<SigPulse>();
            p._radius = radius;
            p._color = color;
            p._ring = go.AddComponent<LineRenderer>();
            p._ring.useWorldSpace = false;
            p._ring.loop = true;
            p._ring.widthMultiplier = 0.22f;
            p._ring.material = new Material(Shader.Find("Sprites/Default"));
            p._ring.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            p._ring.positionCount = Segments;
            p.Tick(0f);
            return p;
        }

        private void Update() => Tick(Time.deltaTime);

        public void Tick(float dt)
        {
            _t += dt;
            float k = Mathf.Clamp01(_t / LifeSec);
            float r = Mathf.Lerp(0.6f, _radius, 1f - (1f - k) * (1f - k));
            for (int i = 0; i < Segments; i++)
            {
                float a = i * Mathf.PI * 2f / Segments;
                _ring.SetPosition(i, new Vector3(Mathf.Cos(a) * r, 0f, Mathf.Sin(a) * r));
            }
            _ring.startColor = _ring.endColor = new Color(_color.r, _color.g, _color.b, 1f - k);
            if (_t >= LifeSec) Destroy(gameObject);
        }
    }
}
