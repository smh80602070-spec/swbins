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
    ///
    /// 109-11-3 — 관문 대장으로 승격하면 이번 주 관문 대장의 이름·고유 기술(8초 시계)로 바뀐다(`ApplyOwnerSig`).
    /// 109-11-2 — 고유 기술은 `StoryEnemy.BossSigId`(들판 = 황건 두목 도넛 · 비경 = 관문 수호장 추적)로 찾는다.
    /// 고유 기술을 걸면 "두목 — 기술명" 알림, 그로기면 머리 위 "★★★ 그로기 N초"·받는 피해 ×1.5(`DamageTakenMul`).
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

        private TMPro.TextMeshPro _groggyLabel;
        private Camera _cam;

        /// <summary>받는 피해 배수 — `StoryEnemy.TakeDamage` 가 곱한다(그로기 ×1.5).</summary>
        public float DamageTakenMul => StoryBossPattern.DamageTakenMul(_state);

        private void Awake()
        {
            _enemy = GetComponent<StoryEnemy>();
            ApplyOwnerSig();
        }

        /// <summary>주인 두목의 고유 기술을 건다 — 관문 대장(`StoryEnemy.IsChampion`)이면 웹 stepSig 식(109-11-3), 아니면 첫 기술·후보 식.
        /// `StoryEnemy.TryBecomeChampion` 이 승격 뒤 다시 부른다.</summary>
        public void ApplyOwnerSig()
        {
            if (_enemy == null) return;
            ConfigureSig(StoryBossPattern.SigIndex(_enemy.BossSigId), _enemy.IsChampion);
        }

        /// <summary>진단도 부른다 — 고유 기술을 바꿔 끼우고 처음부터.</summary>
        public void ConfigureSig(int sigIndex, bool gate)
        {
            if (gate) StoryBossPattern.SetGateSig(_state, sigIndex);
            else StoryBossPattern.SetSig(_state, sigIndex);
            StoryBossPattern.Reset(_state);
            ClearWarns();
        }

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
            var r = StoryBossPattern.Step(_state, dt, this, near, _enemy.Hp, _enemy.MaxHp, transform.position.x,
                StoryCombat.BossDmgFor(StoryJobState.Level));
            // 추적 — 예고가 발을 따라온다(마지막 0.5초는 멈춤).
            if (_state.Current == StoryBossPattern.Kind.Chase && _state.Marks.Count > 0 && _warns.Count > 0 && _warns[0] != null)
                _warns[0].MoveTo(_state.Marks[0].X, _state.Marks[0].Y);
            UpdateGroggyLabel();
            return r;
        }

        private void UpdateGroggyLabel()
        {
            bool on = _state.Groggy > 0f;
            if (!on)
            {
                if (_groggyLabel != null) _groggyLabel.gameObject.SetActive(false);
                return;
            }
            if (_groggyLabel == null)
            {
                var go = new GameObject("GroggyLabel");
                go.transform.SetParent(transform, false);
                go.transform.localPosition = Vector3.up * (_enemy.VisualHeight + 0.6f);
                _groggyLabel = Saga.Core.SagaWorldText.Add(go, "", 48f * 0.2f, new Color(1f, 0.9f, 0.3f));
                _cam = Camera.main;
            }
            _groggyLabel.gameObject.SetActive(true);
            _groggyLabel.text = "★★★ " + string.Format(StoryLocalization.T("bp.groggy_hud", "그로기 {0}초"), Mathf.CeilToInt(_state.Groggy));
            if (_cam != null) _groggyLabel.transform.rotation = _cam.transform.rotation;
        }

        /// <summary>진단 — 머리 위 그로기 글자(없거나 꺼졌으면 null).</summary>
        public string GroggyLabelText => _groggyLabel != null && _groggyLabel.gameObject.activeSelf ? _groggyLabel.text : null;

        /// <summary>플레이어가 쓰러져 두목이 태세를 되돌릴 때 — 단계·예고·부하를 거둔다.</summary>
        public void ResetPattern()
        {
            StoryBossPattern.Reset(_state);
            ClearWarns();
            UpdateGroggyLabel();
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
            amount *= StoryRound.FoeMul(); // tasks U-0024 회차 — 두목 공격 ×(1회차는 1)
            if (!StoryPlayerHp.Hurt(amount)) return;
            DamageDealt += Mathf.Max(1f, StoryBossPattern.JsRound(amount));
            Hits++;
        }

        public void PullPlayer(float dx)
        {
            if (_player == null || Mathf.Abs(dx) < 1e-5f) return;
            if (_cc != null && _cc.enabled) _cc.Move(new Vector3(dx, 0f, 0f));
            else _player.position += new Vector3(dx, 0f, 0f);
        }

        public void GroggyStarted()
        {
            ClearWarns();
            Toast(string.Format(StoryLocalization.T("bp.groggy", "💫 {0} 그로기 — {1}초 동안 받는 피해 ×{2}!"), BossName, StoryBossPattern.GroggyT, StoryBossPattern.GroggyMul), 3f);
            _enemy.PlayRoar();
            UpdateGroggyLabel();
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
                case StoryBossPattern.Kind.Ring:
                    // 도넛 — 판 전체 붉은 막, 두목 곁 반지름 2m 만 초록.
                    StoryBossWarnFx.Sweep(MinX, MaxX, FloorY, s.Cx, StoryBossPattern.RingR * 2f, s.T, StoryLocalization.T("bp.ring", "붙어라!"), root, _warns);
                    break;
                case StoryBossPattern.Kind.Volley:
                    foreach (var m in s.Marks) _warns.Add(StoryBossWarnFx.Circle(m.X, m.Y, m.R, s.T, true, root));
                    break;
                case StoryBossPattern.Kind.Beam:
                    _warns.Add(StoryBossWarnFx.Beam(MinX, MaxX, FloorY, StoryBossPattern.BeamY, Feet.x, s.T, StoryLocalization.T("bp.beam", "⬇ 뛰지 마라!"), root));
                    break;
                case StoryBossPattern.Kind.Pillar:
                    foreach (var m in s.Marks) _warns.Add(StoryBossWarnFx.Pillar(m.X, FloorY, m.R, s.T, root));
                    break;
                case StoryBossPattern.Kind.Pull:
                    _warns.Add(StoryBossWarnFx.Circle(s.Cx, FloorY, StoryBossPattern.PullR, s.T, false, root));
                    Toast(string.Format(StoryLocalization.T("bp.pull", "⛓ {0}의 {1} — 거슬러 달려라!"), BossName, StoryBossPattern.SigName(s.SigIndex)), 2.2f);
                    break;
                case StoryBossPattern.Kind.Chase:
                    foreach (var m in s.Marks) _warns.Add(StoryBossWarnFx.Circle(m.X, m.Y, m.R, s.T, false, root, StoryBossWarnFx.Violet));
                    break;
            }
            // 고유 기술 — 이름 띠(웹 bossintro "보스 — 기술명"). 불기둥 둘째 박자는 다시 안 띄운다.
            if (kind != StoryBossPattern.Kind.None && kind == s.SigKind && s.Wave != 2 && kind != StoryBossPattern.Kind.Pull)
                Toast(string.Format(StoryLocalization.T("bp.sig_band", "⚔ {0} — {1}"), BossName, StoryBossPattern.SigName(s.SigIndex)), 1.8f);
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
                StoryBossPattern.Kind.Ring => 0.16f,
                StoryBossPattern.Kind.Pull => 0.2f,
                StoryBossPattern.Kind.Pillar => 0.12f,
                _ => 0.1f, // 화살비·추적·쇠뇌(웹 5)
            };
            float sec = kind == StoryBossPattern.Kind.Sweep ? 0.6f
                : kind == StoryBossPattern.Kind.Quake || kind == StoryBossPattern.Kind.Pull ? 0.5f
                : kind == StoryBossPattern.Kind.Ring ? 0.4f : 0.3f;
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
