using System;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0237 탈것 소리(자체툴 K-0189) — 탄 동안 발소리 대신 발굽, 나는 탈것이 떠 있으면 날갯짓. 네 판(1만리·2나락·3마을·4종횡) 컨트롤러가
    /// 발소리 Tick 곁에서 한 줄로 부른다. 소리 = `sfx_hoof_soft_1~3`(풀·흙·모래·눈)·`sfx_hoof_hard_1~3`(돌·나무)·`sfx_wing_flap_1~3`(학)·`sfx_wing_heavy_1~2`(용) —
    /// 판 재생기(<see cref="SagaSfx.Pick"/> 변주). 박자: 발굽 = 이동 거리(걷기 보폭 ×1.4 — 네 발 두 박) · 날갯짓 = 시간(학 0.5초·용 0.85초).
    /// 나는 탈것이 땅을 걸으면 소리 없음. 손잡이는 발소리와 같이 `SAGA_STEP_SOUND=0`.
    /// </summary>
    public sealed class MountSounds
    {
        public const float HoofStrideMul = 1.4f, FlapSec = 0.5f, HeavyFlapSec = 0.85f, HoofVolume = 0.6f, WingVolume = 0.7f;

        public Action<string, float> Play;
        private Vector3 _last;
        private bool _hasLast;
        private float _stride, _flapT;

        public int HoofCount { get; private set; }
        public int WingCount { get; private set; }
        public string LastName { get; private set; }

        public MountSounds(Action<string, float> play) { Play = play; }

        /// <summary>순수 — 땅 이름 → 발굽 소리 이름(돌·나무 = 단단, 나머지 무름).</summary>
        public static string HoofName(string surface) => surface == StepSounds.Stone || surface == StepSounds.Wood ? "hoof_hard" : "hoof_soft";

        public static string WingName(bool heavy) => heavy ? "wing_heavy" : "wing_flap";

        public void Reset() { _hasLast = false; _stride = 0f; _flapT = 0f; }

        /// <summary>한 프레임. riding = 탄 탈것이 있음 · flyMount = 나는 탈것 · airborne = 지금 날고 있음 · heavy = 용(무거운 날갯짓).</summary>
        public void Tick(Vector3 pos, bool riding, bool flyMount, bool airborne, bool heavy, bool grounded, string surface, float dt)
        {
            if (dt <= 0f) return;
            Vector3 d = _hasLast ? pos - _last : Vector3.zero;
            _last = pos;
            _hasLast = true;
            if (!StepSounds.Enabled || !riding) { _stride = 0f; _flapT = 0f; return; }
            if (flyMount)
            {
                _stride = 0f;
                if (!airborne) { _flapT = 0f; return; }
                _flapT -= dt;
                if (_flapT > 0f) return;
                _flapT = heavy ? HeavyFlapSec : FlapSec;
                WingCount++;
                LastName = WingName(heavy);
                Play?.Invoke(LastName, WingVolume);
                return;
            }
            if (!grounded) { _stride = 0f; return; }
            float speed = new Vector2(d.x, d.z).magnitude / dt;
            if (speed < StepSounds.MinSpeed || speed > 60f) { _stride = 0f; return; }
            _stride += speed * dt;
            float need = (speed >= StepSounds.RunSpeed ? StepSounds.RunStride : StepSounds.WalkStride) * HoofStrideMul;
            if (_stride < need) return;
            _stride -= need;
            HoofCount++;
            LastName = HoofName(string.IsNullOrEmpty(surface) ? StepSounds.Grass : surface);
            Play?.Invoke(LastName, HoofVolume);
        }
    }
}
