using UnityEngine;
using Saga.Go.Audio;
using Saga.Go.Data;

namespace Saga.Go.Player
{
    /// <summary>
    /// U-0051 걸음·착지·입수 소리 — `PlayerController.Step` 끝에서 매 걸음 부른다. 걸음은 프레임이 아니라 <b>이동 거리</b>로 박자를 잡는다
    /// (걷기 <see cref="GoSurface.WalkStride"/>·달리기 <see cref="GoSurface.RunStride"/> m 마다 한 번 — 느린 PC 에서도 같은 박자).
    /// 땅 위(<see cref="PlayerController.MoveMode.Ground"/>)·지면에 닿음·탈것을 안 탐일 때만. 착지 = 공중에 <see cref="MinAirSec"/> 넘게 뜬 뒤 닿을 때, 입수 = 헤엄이 막 시작될 때.
    /// 파일이 아직 없으면(K-0076 배치 전) 조용하고 <see cref="SagaCore"/> 쪽 기록만 남는다.
    /// </summary>
    public class FootstepSfx
    {
        public const float MinAirSec = 0.25f;
        public const float StepVolume = 0.6f;

        private Vector3 _last;
        private bool _hasLast;
        private float _stride;      // 지금 걸음까지 모은 거리
        private float _airSec;
        private float _fallSpeed;   // 공중에서 가장 빨랐던 낙하 속도(m/s, 양수)
        private PlayerController.MoveMode _prevMode = PlayerController.MoveMode.Ground;

        public int StepCount { get; private set; }
        public string LastSurface { get; private set; }

        public void Reset() { _hasLast = false; _stride = 0f; _airSec = 0f; _fallSpeed = 0f; }

        /// <summary><paramref name="dt"/> 지난 한 걸음. 위치는 스스로 읽는다(<paramref name="pos"/>).</summary>
        public void Tick(Vector3 pos, PlayerController.MoveMode mode, bool grounded, bool riding, float dt)
        {
            if (dt <= 0f) return;
            Vector3 d = _hasLast ? pos - _last : Vector3.zero;
            _last = pos;
            _hasLast = true;

            if (mode == PlayerController.MoveMode.Swim && _prevMode != PlayerController.MoveMode.Swim) GoSfx.Play("splash", 0.9f, 0.3f);
            _prevMode = mode;

            bool onGround = mode == PlayerController.MoveMode.Ground && grounded;
            if (!onGround)
            {
                _stride = 0f;
                if (mode == PlayerController.MoveMode.Ground || mode == PlayerController.MoveMode.Air)
                {
                    _airSec += dt;
                    if (d.y < 0f) _fallSpeed = Mathf.Max(_fallSpeed, -d.y / dt);
                }
                else { _airSec = 0f; _fallSpeed = 0f; }
                return;
            }

            if (_airSec >= MinAirSec && !riding) GoSfx.Play("land", Mathf.Lerp(0.5f, 1f, Mathf.Clamp01(_fallSpeed / 20f)), 0.15f);
            _airSec = 0f;
            _fallSpeed = 0f;

            float speed = new Vector2(d.x, d.z).magnitude / dt;
            if (riding || speed < GoSurface.MinSpeed) { _stride = 0f; return; }
            _stride += speed * dt;
            float need = speed >= GoSurface.RunSpeed ? GoSurface.RunStride : GoSurface.WalkStride;
            if (_stride < need) return;
            _stride -= need;
            LastSurface = GoSurface.At(pos);
            StepCount++;
            GoSfx.Play(GoSurface.StepName(LastSurface), StepVolume);
        }
    }
}
