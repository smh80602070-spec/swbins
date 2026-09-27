using System.Collections.Generic;
using UnityEngine;
using Saga.Story.Cinematics;
using Saga.Story.Data;
using Saga.Story.Player;
using Saga.Story.UI;

namespace Saga.Story.World
{
    /// <summary>
    /// PLAN.md 109-11-1 보스 패턴전 실행기 — 두목(`StoryEnemy.IsBoss`, 들판·비경)마다 하나, `StoryEnemy.Awake` 가 Play 때 붙인다.
    /// 판정은 `StoryBossPattern.Step` 이 하고, 이 컴포넌트는 그 바깥 일(`IApi`)만 맡는다: 플레이어 발·땅 여부,
    /// 판 경계(들판 0~44m · 비경 방), 피해(`StoryPlayerHp`), 부하(`StoryEnemy.SpawnMinion`), 예고 그림(`StoryBossWarnFx`),
    /// 알림·흔들림·포효.
    ///
    /// 들판 두목은 등장 컷(106-8)을 튼 뒤부터 문다(비경 두목은 컷이 없어 곧장). 컷 동안·죽은 뒤엔 멈춘다.
    /// 플레이어가 쓰러지면 `ResetPattern` 으로 처음 단계부터(`StoryEnemy.RegroupAfterPlayerFell`).
    /// </summary>
    [DisallowMultipleComponent]
    public class StoryBossPatternRunner : MonoBehaviour, StoryBossPattern.IApi
    {
        private StoryEnemy _enemy;
        private readonly StoryBossPattern.State _state = new StoryBossPattern.State();
        private readonly List<StoryBossWarnFx> _warns = new List<StoryBossWarnFx>();
        private readonly List<StoryEnemy> _minions = new List<StoryEnemy>();
        private Transform _player;
        private CharacterController _cc;
        private StoryPlayerController _pc;

        public StoryBossPattern.State State => _state;
        public IReadOnlyList<StoryEnemy> Minions => _minions;
        /// <summary>진단 — 걸려 있는 예고 그림(판정이 나면 지운다).</summary>
        public IReadOnlyList<StoryBossWarnFx> Warns => _warns;
        /// <summary>진단 — 이 두목 패턴이 준 피해 합·맞힌 수.</summary>
        public float DamageDealt { get; private set; }
        public int Hits { get; private set; }
        /// <summary>진단 — 무작위를 고정한다(null 이면 UnityEngine.Random).</summary>
        public System.Func<float> RandOverride;
        /// <summary>진단 — 땅 여부를 고정한다(null 이면 CharacterController).</summary>
        public System.Func<bool> OnGroundOverride;

        private void Awake() => _enemy = GetComponent<StoryEnemy>();

        private void Update() => Tick(Time.deltaTime);

        private void OnDestroy() => ClearWarns();

        /// <summary>한 걸음(진단도 직접 부른다). 걸음이 돌았으면 결과, 못 돌았으면 null.</summary>
        public StoryBossPattern.StepResult? Tick(float dt)
        {
            if (!StoryBossPattern.Enabled || _enemy == null || _enemy.IsDead || StoryCutscenes.Playing) return null;
            if (!_enemy.IsLabyrinthEnemy && !_enemy.IntroPlayed) return null;
            if (!FindPlayer()) return null;
            _minions.RemoveAll(m => m == null || m.IsDead);
            var bossFeet = new Vector2(transform.position.x, transform.position.y);
            bool near = StoryBossPattern.IsNear(bossFeet, Feet);
            return StoryBossPattern.Step(_state, dt, this, near, _enemy.Hp, _enemy.MaxHp, transform.position.x,
                StoryCombat.BossDmgFor(StoryJobState.Level));
        }

        /// <summary>플레이어가 쓰러져 두목이 태세를 되돌릴 때 — 단계·예고·부하를 거둔다.</summary>
        public void ResetPattern()
        {
            StoryBossPattern.Reset(_state);
            ClearWarns();
            foreach (var m in _minions) if (m != null && !m.IsDead) Destroy(m.gameObject);
            _minions.Clear();
        }

        private bool FindPlayer()
        {
            if (_player != null) return true;
            var go = GameObject.FindWithTag("Player");
            if (go == null) return false;
            _player = go.transform;
            _cc = go.GetComponent<CharacterController>();
            _pc = go.GetComponent<StoryPlayerController>();
            return true;
        }

        private void ClearWarns()
        {
            foreach (var w in _warns) if (w != null) Destroy(w.gameObject);
            _warns.Clear();
        }

        private string BossName => _enemy != null ? _enemy.DisplayName : "";

        // ── IApi ─────────────────────────────────────────────────
        public Vector2 Feet => _player != null ? new Vector2(_player.position.x, _player.position.y) : Vector2.zero;

        public bool OnGround
        {
            get
            {
                if (OnGroundOverride != null) return OnGroundOverride();
                if (_pc != null && _pc.OnRope) return false;
                return _cc != null && _cc.isGrounded;
            }
        }

        public float MinX => _enemy != null && _enemy.IsLabyrinthEnemy ? StoryLabyrinthRunner.ArenaMinX : 0f;
        public float MaxX => _enemy != null && _enemy.IsLabyrinthEnemy ? StoryLabyrinthRunner.ArenaMaxX : FieldMapData.WidthM;
        public float FloorY => 0f;
        public float HpMax => StoryPlayerHp.HpMax;
        public float Rand() => RandOverride != null ? RandOverride() : Random.value;

        public void Hurt(float amount, StoryBossPattern.Kind kind)
        {
            if (!StoryPlayerHp.Hurt(amount)) return;
            DamageDealt += Mathf.Max(1f, StoryBossPattern.JsRound(amount));
            Hits++;
        }

        public void Spawn(float x)
        {
            if (_enemy == null) return;
            var m = _enemy.SpawnMinion(x);
            if (m != null) _minions.Add(m);
        }

        public void Warn(StoryBossPattern.Kind kind, StoryBossPattern.State s)
        {
            ClearWarns();
            var root = transform.parent;
            switch (kind)
            {
                case StoryBossPattern.Kind.Slam:
                case StoryBossPattern.Kind.Rock:
                    foreach (var m in s.Marks)
                        _warns.Add(StoryBossWarnFx.Circle(m.X, m.Y, m.R, s.T, kind == StoryBossPattern.Kind.Rock, root));
                    break;
                case StoryBossPattern.Kind.Quake:
                    _warns.Add(StoryBossWarnFx.Quake(MinX, MaxX, FloorY, Feet.x, s.T, StoryLocalization.T("bp.jump", "⬆ 점프!"), root));
                    break;
                case StoryBossPattern.Kind.Sweep:
                    StoryBossWarnFx.Sweep(MinX, MaxX, FloorY, s.SafeX, s.SafeW, s.T, StoryLocalization.T("bp.safe", "안전"), root, _warns);
                    Toast(string.Format(StoryLocalization.T("bp.sweep", "⚠ {0}의 휩쓸기 — 초록 안전지대로!"), BossName), 2.2f);
                    break;
                case StoryBossPattern.Kind.Summon:
                    Toast(string.Format(StoryLocalization.T("bp.summon", "👥 {0}이(가) 부하를 불렀다!"), BossName), 2.2f);
                    _enemy.PlayRoar();
                    break;
            }
            if (kind != StoryBossPattern.Kind.Summon) PlayWindup();
        }

        public void Resolved(StoryBossPattern.Kind kind, int hit)
        {
            ClearWarns();
            // 웹 shake amt 4·6·9·12 → 이 판 흔들림(평타 0.05·급소 0.12 m) 결로.
            float mag = kind switch
            {
                StoryBossPattern.Kind.Slam => 0.12f,
                StoryBossPattern.Kind.Rock => 0.08f,
                StoryBossPattern.Kind.Quake => 0.18f,
                StoryBossPattern.Kind.Sweep => 0.24f,
                _ => 0.08f,
            };
            float sec = kind == StoryBossPattern.Kind.Sweep ? 0.6f : kind == StoryBossPattern.Kind.Quake ? 0.5f : 0.3f;
            StoryCameraFollow.Instance?.Shake(mag, sec);
            StoryGroundDecal.Spawn(new Vector3(Feet.x, FloorY, 0f), StoryGroundDecal.Kind.HitMark);
        }

        public void PhaseChanged(int phase)
        {
            ClearWarns();
            _enemy.PlayRoar();
            StoryCameraFollow.Instance?.Shake(0.2f, 0.6f);
            Toast(phase == 1
                ? string.Format(StoryLocalization.T("bp.phase2", "⚠ {0} 2단계 — 땅이 흔들린다(점프로 피하라)!"), BossName)
                : string.Format(StoryLocalization.T("bp.enrage", "🔥 {0} 광폭 — 휩쓸기가 온다!"), BossName), 3f);
        }

        /// <summary>예고를 걸 때 두목이 팔을 든다(공격 클립, 판정 없음).</summary>
        private void PlayWindup()
        {
            var animator = GetComponentInChildren<Animator>();
            if (animator != null && animator.runtimeAnimatorController != null) animator.SetTrigger("Attack");
        }

        private static void Toast(string text, float sec) => DialogueLabel.Instance?.Show(text, sec);
    }
}
