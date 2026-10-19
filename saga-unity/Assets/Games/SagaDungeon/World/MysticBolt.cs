using UnityEngine;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.World
{
    /// <summary>술사의 빛살 — 표적을 쫓아 날아가 닿으면 피해. 표적이 먼저 죽으면 사라진다.</summary>
    public class MysticBolt : MonoBehaviour
    {
        public const float Speed = 14f;
        private const float LifeSec = 2f;
        private static readonly Color BoltColor = new Color(0.75f, 0.65f, 1f);

        private DungeonEnemy _target;
        private float _damage;
        private float _life;

        public static MysticBolt Fire(Vector3 from, DungeonEnemy target, float damage)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = "MysticBolt";
            Saga.Core.Colliders.Strip(go);
            go.transform.position = from;
            go.transform.localScale = Vector3.one * 0.28f;
            var r = go.GetComponent<Renderer>();
            r.material = new Material(Shader.Find("Sprites/Default")) { color = BoltColor };
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            var light = go.AddComponent<Light>();
            light.type = LightType.Point;
            light.color = BoltColor;
            light.range = 3f;
            light.intensity = 2f;
            var bolt = go.AddComponent<MysticBolt>();
            bolt._target = target;
            bolt._damage = damage;
            return bolt;
        }

        private void Update() => Step(Time.deltaTime);

        /// <summary>진단이 시간을 직접 넣는다. 닿으면 true(이미 사라졌어도 true).</summary>
        public bool Step(float dt)
        {
            if (this == null) return true;
            _life += dt;
            if (_target == null || !_target.IsAlive || _life > LifeSec)
            {
                Destroy(gameObject);
                return true;
            }
            Vector3 aim = _target.transform.position + Vector3.up * (1.1f * _target.VisualScale);
            Vector3 to = aim - transform.position;
            float step = Speed * dt;
            if (to.magnitude <= step)
            {
                _target.TakeDamage(_damage);
                PartyState.AddAllyHit(PartyRole.Mystic);
                Destroy(gameObject);
                _target = null;
                return true;
            }
            transform.position += to.normalized * step;
            return false;
        }
    }
}
