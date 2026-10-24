using System;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0218 발소리 — 2나락·3마을·4종횡(고돗 G-0369 이식) + 젖은 땅 물 튐(고돗 G-0368, 1만리 포함).
    /// 1만리 `FootstepSfx`(U-0051)와 같은 결: 박자는 프레임이 아니라 <b>이동 거리</b>(걷기 <see cref="WalkStride"/>·달리기 <see cref="RunStride"/> m 마다 한 번),
    /// 소리는 `sfx_step_&lt;땅&gt;_1·2`(<see cref="SagaSfx.Pick"/> 이 1·2 를 번갈아 낸다). 판 쪽은 **바닥 이름만** 정해 넘긴다(2나락 stone · 3마을 grass/집 안 wood/굴 stone · 4종횡 grass/미궁 stone).
    /// 땅 위·바닥 닿음·탈것·줄·기어오름이 아닐 때만. 땅이 젖었으면(<see cref="WetGround.Wet"/> &gt; <see cref="WetMin"/>, 눈밭·집 안·겨울 아님)
    /// 발소리마다 낮은 물 튐(`sfx_splash`, 발소리의 −10dB × 젖은 만큼 — 고돗 −16dB 발소리 · −26dB 물 튐)을 겹친다.
    /// 소리 재생은 판의 재생기(<see cref="Play"/> — 판 음량 설정 그대로). 손잡이 `SAGA_STEP_SOUND=0` = 조용(셈도 안 함).
    /// 음 높이 흔들기는 없다 — 판 재생기가 PlayOneShot 한 소스라 높이를 못 바꾼다(1만리와 같음, 1·2 번갈아로 대신).
    /// </summary>
    public sealed class StepSounds
    {
        /// <summary>1만리 `GoSurface` 와 같은 걸음(세 판도 걷기 6·달리기 10 m/s · 4종횡 6).</summary>
        public const float WalkStride = 2.4f, RunStride = 3.2f, MinSpeed = 0.5f, RunSpeed = 8f;
        public const float StepVolume = 0.6f;
        public const float WetMin = 0.4f;
        /// <summary>물 튐 음량 비(발소리 대비) — 고돗 −26dB/−16dB = 10^(−10/20).</summary>
        public const float SplashRatio = 0.316f;
        public const string Stone = "stone", Grass = "grass", Wood = "wood", Snow = "snow", Dirt = "dirt", Sand = "sand";

        /// <summary>판 재생기 — (이름, 음량 배율). 진단은 기록기로 바꿔 끼운다.</summary>
        public Action<string, float> Play;

        private Vector3 _last;
        private bool _hasLast;
        private float _stride;

        public int StepCount { get; private set; }
        public int SplashCount { get; private set; }
        public string LastSurface { get; private set; }

        public StepSounds(Action<string, float> play) { Play = play; }

        /// <summary>테스트용 손잡이 — null 이면 환경변수 SAGA_STEP_SOUND 를 본다.</summary>
        public static bool? ForcedEnabled;
        public static bool Enabled => ForcedEnabled ?? Environment.GetEnvironmentVariable("SAGA_STEP_SOUND") != "0";

        /// <summary>테스트용 젖음 — null 이면 <see cref="WetGround.Wet"/>.</summary>
        public static float? ForcedWet;
        public static float WetNow => ForcedWet ?? WetGround.Wet;

        public static string StepName(string surface) => "step_" + surface;

        /// <summary>순수 — 이 젖음·바닥이면 물 튐을 겹치나(눈밭·집 안 나무·겨울 아님).</summary>
        public static bool SplashOn(float wet, string surface, bool winter) =>
            wet > WetMin && surface != Snow && surface != Wood && !winter;

        /// <summary>순수 — 물 튐 음량(발소리 음량 × 비 × 젖음).</summary>
        public static float SplashVolume(float stepVolume, float wet) => stepVolume * SplashRatio * Mathf.Clamp01(wet);

        /// <summary>겨울(땅 웅덩이 없는 철) — 진단이 <see cref="WetGround.ForcedNoPuddles"/> 로 붙든다.</summary>
        public static bool Winter => WetGround.NoPuddles;

        public void Reset() { _hasLast = false; _stride = 0f; }

        /// <summary>걸음 하나가 났으면 그 바닥에 물 튐까지 — 1만리 `FootstepSfx` 도 부른다(박자는 제 것). 물 튐을 냈으면 참.</summary>
        public static bool Splash(Action<string, float> play, string surface, float stepVolume)
        {
            if (!Enabled) return false;
            float w = WetNow;
            if (!SplashOn(w, surface, Winter)) return false;
            play?.Invoke("splash", SplashVolume(stepVolume, w));
            return true;
        }

        /// <summary><paramref name="dt"/> 지난 한 프레임. 위치는 넘겨받는다 · <paramref name="blocked"/> = 탈것·줄·기어오름·헤엄(발소리 없음).</summary>
        public void Tick(Vector3 pos, bool grounded, bool blocked, string surface, float dt)
        {
            if (dt <= 0f) return;
            Vector3 d = _hasLast ? pos - _last : Vector3.zero;
            _last = pos;
            _hasLast = true;
            if (!Enabled || !grounded || blocked) { _stride = 0f; return; }
            float speed = new Vector2(d.x, d.z).magnitude / dt;
            if (speed < MinSpeed || speed > 60f) { _stride = 0f; return; }   // 60 m/s 넘으면 순간이동(집 드나듦·되살아남)
            _stride += speed * dt;
            float need = speed >= RunSpeed ? RunStride : WalkStride;
            if (_stride < need) return;
            _stride -= need;
            LastSurface = string.IsNullOrEmpty(surface) ? Grass : surface;
            StepCount++;
            Play?.Invoke(StepName(LastSurface), StepVolume);
            if (Splash(Play, LastSurface, StepVolume)) SplashCount++;
        }
    }
}
