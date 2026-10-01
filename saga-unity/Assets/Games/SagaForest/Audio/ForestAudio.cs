using UnityEngine;
using Saga.Forest.Data;
using Saga.Core;

namespace Saga.Forest.Audio
{
    /// <summary>
    /// PLAN.md 67장 "사운드" 첫 슬라이스 — BGM/SFX 카테고리별 볼륨 분리를
    /// 요구하는데, 진짜 Unity AudioMixer 에셋은 에디터 GUI로 사람이 노드를
    /// 잇는 방식이라(66-2장 ⑤ 헤어카드/SSS Shader Graph 배선과 같은 제약 —
    /// 배치 모드 스크립트로 못 만든다) 이번엔 코드로 흉내만 낸다:
    /// `AudioSource.PlayOneShot`에 카테고리 볼륨 × 마스터 볼륨을 직접 곱해
    /// 넘긴다. 실제 Mixer(리버브·덕킹 등)로 바꾸는 건 사람이 에디터를 열어야
    /// 하는 다음 몫 — `HOW_TO_PLAYTEST.md`에 적어 둘 것.
    ///
    /// SFX 재생용 AudioSource는 씬 빌드가 미리 만들어 두지 않고 런타임에
    /// 스스로 만든다(지연 생성, `EnsureSource()`) — `ForestHostileEncounterUi.cs`
    /// 가 edit-time [SerializeField] 참조를 못 지켜 겪은 함정(씬 저장 후
    /// Play 모드에서 private 비직렬화 필드가 null로 돌아오는 것)을 아예
    /// 피해 간다.
    ///
    /// FOREST 하나에만 우선 만든다(포자괴물 밀어내기 미니게임이 첫 적용
    /// 대상) — 다섯 판이 각자 복사해 쓰는 관례(루트 CLAUDE.md)라 다른 네
    /// 판은 필요해질 때 각자 복사해 붙인다.
    /// </summary>
    public static class ForestAudio
    {
        private const string MasterKey = "saga_forest_vol_master";
        private const string SfxKey = "saga_forest_vol_sfx";
        private const string BgmKey = "saga_forest_vol_bgm";

        public static float MasterVolume
        {
            get => PlayerPrefs.GetFloat(MasterKey, 1f);
            set => PlayerPrefs.SetFloat(MasterKey, Mathf.Clamp01(value));
        }

        public static float SfxVolume
        {
            get => PlayerPrefs.GetFloat(SfxKey, 1f);
            set => PlayerPrefs.SetFloat(SfxKey, Mathf.Clamp01(value));
        }

        public static float BgmVolume
        {
            get => PlayerPrefs.GetFloat(BgmKey, 1f);
            set => PlayerPrefs.SetFloat(BgmKey, Mathf.Clamp01(value));
        }

        private static AudioSource _sfxSource;

        private static AudioSource EnsureSfxSource()
        {
            // Unity의 오버로드된 ==/!= 덕에, Play 세션이 끝나 이 GameObject가
            // 파괴되면 다음 세션에서 이 비교가 다시 false가 돼 새로 만든다
            // (static이라도 세션을 못 넘어 참조가 계속 살아남는 게 아니다).
            if (_sfxSource != null) return _sfxSource;
            var go = new GameObject("ForestAudio_SfxSource");
            _sfxSource = go.AddComponent<AudioSource>();
            _sfxSource.playOnAwake = false;
            return _sfxSource;
        }

        public static void PlaySfx(AudioClip clip, float volumeScale = 1f)
        {
            if (clip == null) return;
            EnsureSfxSource().PlayOneShot(clip, MasterVolume * SfxVolume * volumeScale);
#if UNITY_ANDROID || UNITY_IOS
            if (ForestSettingsState.VibrationOn) Handheld.Vibrate(); // PLAN.md 110 ① — PC 빌드엔 진동 API 가 없다.
#endif
        }

        /// <summary>BGM 재생은 `Saga.Core.Bgm` 이 맡는다(tasks U-0014) — 곡 하나 반복이던 판별 복사본을 합쳤다. 곡 파일(`Resources/Audio/Bgm/forest-<장면>`)이
        /// 없으면 부트스트랩이 준 곡 그대로 돈다. 음량 = Master×Bgm(PlayerPrefs 키는 그대로).</summary>
        public static void PlayBgm(AudioClip clip) => Bgm.Play("forest", "town", clip, () => MasterVolume * BgmVolume);

        /// <summary>설정에서 BGM On/Off 를 누를 때마다 불러 이미 도는 곡의 음량에 바로 반영한다.</summary>
        public static void RefreshBgmVolume() => Bgm.RefreshVolume();
    }
}
