using UnityEngine;
using Saga.Core;

namespace Saga.Dungeon.World
{
    /// <summary>치유의 빛 — 발밑에서 솟는 초록 빛기둥(점광 + 둥근 고리, 1초).</summary>
    public class HealGlow : MonoBehaviour
    {
        private const float LifeSec = 1f;
        private static readonly Color GlowColor = new Color(0.5f, 1f, 0.6f);
        private Light _light;
        private float _t;

        public static void Spawn(Vector3 groundPos)
        {
            var go = new GameObject("HealGlow");
            go.transform.position = groundPos + Vector3.up * 1f;
            var glow = go.AddComponent<HealGlow>();
            glow._light = go.AddComponent<Light>();
            glow._light.type = LightType.Point;
            glow._light.color = GlowColor;
            glow._light.range = 5f;
            glow._light.intensity = 4f;
            HitSpark.Spawn(go.transform.position, heavy: true);
            Destroy(go, LifeSec);
        }

        private void Update()
        {
            _t += Time.deltaTime;
            if (_light != null) _light.intensity = Mathf.Lerp(4f, 0f, _t / LifeSec);
            transform.position += Vector3.up * Time.deltaTime * 0.8f;
        }
    }
}
