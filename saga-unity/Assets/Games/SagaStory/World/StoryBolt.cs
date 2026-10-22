using System.Collections.Generic;
using UnityEngine;
using Saga.Story.Data;

namespace Saga.Story.World
{
    /// <summary>
    /// "STORY 콘텐츠 확장"(2026-09-12) — 무예 기탄(氣彈, data-job.js bolt).
    /// `js/side.js` castSkill()의 `effect==='bolt'` 처리(관통, 여러 적을
    /// 한 번씩만 때린다)를 옮겼다. 적은 이 슬라이스에서 전부 제자리에
    /// 서 있으므로(`StoryEnemy.cs` 클래스 주석) 충돌은 X거리 문턱 하나로
    /// 충분하다 — DUNGEON류 물리 콜라이더 투사체 대신 가장 단순한 형태.
    /// </summary>
    public class StoryBolt : MonoBehaviour
    {
        private const float HitRadius = 0.6f;

        private float _dir;
        private float _atk;
        private float _mul;
        private float _timer;
        private float _speed = StoryCombat.BoltSpeed;
        private float _life = StoryCombat.BoltLife;
        private Animator _shooterAnimator;
        private readonly HashSet<StoryEnemy> _alreadyHit = new HashSet<StoryEnemy>();

        /// <summary>false면 첫 적 하나만 맞히고 사라진다 — 웹판 arrow·volley(`side.js`
        /// castBody의 pierce:false). 5-2 1단계 직업 무예(`StorySkillData`)가 쓴다.</summary>
        public bool Pierce { get; private set; } = true;
        /// <summary>PLAN.md 106-10 — 곁의 유격이 쏜 화살(소환 게이지 +1).</summary>
        public bool FromCompanion;

        public void Configure(float dir, float atk, float mul, Animator shooterAnimator)
        {
            Configure(dir, atk, mul, shooterAnimator, true, StoryCombat.BoltSpeed, StoryCombat.BoltLife,
                new Color(0.35f, 0.65f, 0.95f)); // data-job.js bolt emoji 💠 — 청백색
        }

        public void Configure(float dir, float atk, float mul, Animator shooterAnimator,
            bool pierce, float speed, float life, Color color)
        {
            _dir = dir;
            _atk = atk;
            _mul = mul;
            _shooterAnimator = shooterAnimator;
            Pierce = pierce;
            _speed = speed;
            _life = life;

            var visual = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            visual.name = "Visual";
            visual.transform.SetParent(transform, false);
            visual.transform.localScale = pierce ? Vector3.one * 0.35f : new Vector3(0.45f, 0.12f, 0.12f);
            Saga.Core.Colliders.Strip(visual);
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "StoryBolt (generated)" };
            mat.color = color;
            visual.GetComponent<MeshRenderer>().sharedMaterial = mat;
        }

        private void Update()
        {
            _timer += Time.deltaTime;
            if (_timer > _life)
            {
                Destroy(gameObject);
                return;
            }

            transform.position += new Vector3(_dir * _speed * Time.deltaTime, 0f, 0f);

            foreach (var enemy in StoryEnemy.All)
            {
                if (enemy == null || enemy.IsDead || _alreadyHit.Contains(enemy)) continue;
                if (Mathf.Abs(enemy.transform.position.x - transform.position.x) > HitRadius) continue;

                _alreadyHit.Add(enemy);
                var (dmg, crit) = StoryCombat.RollDamage(_atk, _mul);
                if (FromCompanion) StorySummonState.HitSource = StorySummonState.Source.Companion;
                enemy.TakeDamage(dmg, crit);
                StorySummonState.HitSource = StorySummonState.Source.Player;
                if (crit) StoryCombat.TriggerHitstop(this);
                var sh = StoryCombat.ShakeFor(dmg, crit); // tasks U-0159
                StoryCameraFollow.Instance?.Shake(sh.mag, sh.sec);
                StoryCombat.ApplyHitFreeze(this, _shooterAnimator);
                if (!Pierce)
                {
                    Destroy(gameObject);
                    return;
                }
            }
        }
    }
}
