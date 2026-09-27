using UnityEngine;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 109-10-10 쓰러짐 날림(웹 §5.19 1차 "날아가 눕고 가라앉음" + 2차 흩어짐) — 그림만.
    /// 쓰러진 적이 나에게서 먼 쪽(±0.45rad 해시 흔들림)으로 0.3초에 힘 × 1.1m 날아가며 살짝 뜨고 돌고, 0.6~1.2초에 0.8m 가라앉는다.
    /// 쓰러짐 클립이 없는 몸은 뒤로 눕힌다. 파괴는 부른 쪽(`DungeonEnemy.DestroyAfterDeathAnim` 1.2초) 몫이라 시간이 겹친다.
    /// </summary>
    public class DeathFling : MonoBehaviour
    {
        private Vector3 _start, _dir;
        private Quaternion _rot0, _visRot0;
        private Transform _visual;
        private float _dist, _hop, _spin, _t;
        private bool _lie;

        public float Distance => _dist;
        public Vector3 Direction => _dir;

        /// <summary>from = 때린 쪽(플레이어) 자리.</summary>
        public static DeathFling Begin(GameObject enemy, Transform visual, Vector3 from, float force, bool lie)
        {
            var f = enemy.GetComponent<DeathFling>();
            if (f == null) f = enemy.AddComponent<DeathFling>();
            Vector3 d = enemy.transform.position - from;
            d.y = 0f;
            if (d.sqrMagnitude < 0.0001f) d = -enemy.transform.forward;
            float jitter = DungeonHunt.ScatterJitter(enemy.transform.position);
            f._dir = Quaternion.AngleAxis(jitter * Mathf.Rad2Deg, Vector3.up) * d.normalized;
            f._start = enemy.transform.position;
            f._rot0 = enemy.transform.rotation;
            f._dist = force * DungeonHunt.FlingMeters;
            f._hop = 0.25f * force;
            f._spin = (jitter >= 0f ? 1f : -1f) * 40f * force * DungeonHunt.Scatter;
            f._visual = visual;
            f._visRot0 = visual != null ? visual.localRotation : Quaternion.identity;
            f._lie = lie && visual != null;
            f._t = 0f;
            return f;
        }

        private void Update() => Tick(Time.deltaTime);

        public void Tick(float dt)
        {
            _t += dt;
            float k = Mathf.Clamp01(_t / DungeonHunt.FlingSec);
            float ease = 1f - (1f - k) * (1f - k);
            Vector3 p = _start + _dir * (_dist * ease);
            p.y = _start.y + _hop * 4f * k * (1f - k);
            float sink = Mathf.Clamp01((_t - DungeonHunt.SinkStartSec) / (DungeonHunt.SinkEndSec - DungeonHunt.SinkStartSec));
            p.y -= DungeonHunt.SinkDepth * sink;
            transform.position = p;
            transform.rotation = _rot0 * Quaternion.Euler(0f, _spin * ease, 0f);
            if (_lie) _visual.localRotation = _visRot0 * Quaternion.Euler(-80f * ease, 0f, 0f);
        }
    }
}
