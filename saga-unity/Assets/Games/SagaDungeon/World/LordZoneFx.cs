using UnityEngine;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 109-10-9 예고 원(웹 fx 'zone') — 퍼지지 않고 제 크기에 서서, 터질 때가 다가올수록 진해지고 굵어진다.
    /// 불바닥(pool)은 고르게 일렁이다 마지막 0.3초에 흐려진다. 수명이 다하면 스스로 사라진다.
    /// </summary>
    public class LordZoneFx : MonoBehaviour
    {
        private const int Segments = 40;

        private LineRenderer _ring;
        private float _life, _t;
        private bool _pool;
        private Color _color;

        public float LifeLeft => _life - _t;

        public static LordZoneFx Spawn(Vector3 center, float radius, Color color, float life, bool pool)
        {
            var go = new GameObject(pool ? "LordPool" : "LordZone");
            go.transform.position = new Vector3(center.x, center.y + 0.07f, center.z);
            var z = go.AddComponent<LordZoneFx>();
            z._life = life;
            z._pool = pool;
            z._color = color;
            z._ring = go.AddComponent<LineRenderer>();
            z._ring.useWorldSpace = false;
            z._ring.loop = true;
            z._ring.material = new Material(Shader.Find("Sprites/Default"));
            z._ring.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            z._ring.receiveShadows = false;
            z._ring.positionCount = Segments;
            for (int i = 0; i < Segments; i++)
            {
                float a = i * Mathf.PI * 2f / Segments;
                z._ring.SetPosition(i, new Vector3(Mathf.Cos(a) * radius, 0f, Mathf.Sin(a) * radius));
            }
            z.Tick(0f);
            return z;
        }

        private void Update() => Tick(Time.deltaTime);

        public void Tick(float dt)
        {
            _t += dt;
            float k = _life > 0f ? Mathf.Clamp01(_t / _life) : 1f;
            float alpha, width;
            if (_pool)
            {
                alpha = (0.55f + 0.2f * Mathf.Sin(_t * 6f)) * (1f - Mathf.Clamp01((_t - (_life - 0.3f)) / 0.3f));
                width = 0.18f;
            }
            else
            {
                alpha = Mathf.Lerp(0.25f, 1f, k);
                width = Mathf.Lerp(0.06f, 0.16f, k);
            }
            _ring.widthMultiplier = width;
            _ring.startColor = _ring.endColor = new Color(_color.r, _color.g, _color.b, alpha);
            if (_t >= _life) Destroy(gameObject);
        }
    }
}
