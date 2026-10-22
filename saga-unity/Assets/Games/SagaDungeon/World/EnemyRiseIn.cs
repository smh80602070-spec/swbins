using UnityEngine;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// tasks U-0159(웹 W-0327 ② · 고돗 G-0293 짝) — 난입 물결 적이 화면 안에서 "툭" 생기지 않게 몸 그림만 땅 밑에서 0.6초 솟는다.
    /// 판정(트랜스폼·충돌)은 그대로 — 그림 자식의 지역 Y 만 내렸다 되돌린다. 솟는 중 쓰러지면 바로 제자리로 두고 빠진다.
    /// </summary>
    public class EnemyRiseIn : MonoBehaviour
    {
        public const float RiseSec = 0.6f;
        public const float RiseDepth = 1.8f;

        private DungeonEnemy _enemy;
        private Transform _visual;
        private float _baseY;
        private float _t;

        /// <summary>진단 — 지금 그림이 제자리에서 내려가 있는 깊이(0 이면 다 솟음).</summary>
        public float Sunk => _visual != null ? _baseY - _visual.localPosition.y : 0f;

        /// <summary>막 세운 적에 붙인다(그림이 없으면 아무것도 안 함).</summary>
        public static EnemyRiseIn Attach(DungeonEnemy enemy)
        {
            if (enemy == null || enemy.VisualGo == null) return null;
            var r = enemy.gameObject.AddComponent<EnemyRiseIn>();
            r._enemy = enemy;
            r._visual = enemy.VisualGo.transform;
            r._baseY = r._visual.localPosition.y;
            r.Step(0f);
            return r;
        }

        private void Update() => Step(Time.deltaTime);

        /// <summary>진단이 시간을 직접 넣는다.</summary>
        public void Step(float dt)
        {
            if (_visual == null) { Destroy(this); return; }
            _t += dt;
            float k = Mathf.Clamp01(_t / RiseSec);
            if (_enemy == null || !_enemy.IsAlive) k = 1f;
            float ease = 1f - (1f - k) * (1f - k) * (1f - k); // 빨리 솟고 끝에서 느려진다
            var p = _visual.localPosition;
            p.y = _baseY - RiseDepth * (1f - ease);
            _visual.localPosition = p;
            if (k >= 1f) Destroy(this);
        }
    }
}
