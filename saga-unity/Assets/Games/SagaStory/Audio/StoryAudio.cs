using UnityEngine;
using Saga.Story.Data;
using Saga.Core;

namespace Saga.Story.Audio
{
    /// <summary>
    /// PLAN.md 67장 "사운드" — `Saga.Forest.Audio.ForestAudio.cs`·
    /// `Saga.Go.Audio.GoAudio.cs`·`Saga.Realm.Audio.RealmAudio.cs`와 같은
    /// 결(다섯 판이 공용 로직을 각자 복사해 쓰는 관례, 루트 CLAUDE.md).
    /// 진짜 Unity AudioMixer 에셋은 에디터 GUI로 사람이 노드를 잇는
    /// 방식이라 배치 모드로 못 만들어 이번에도 코드로 Master/SFX 볼륨을
    /// 곱하는 것으로만 흉내 낸다.
    ///
    /// 2026-09-14 — `StoryEnemy.cs`의 피격/처치에 타격감 SFX를 붙이려고
    /// 먼저 만든다(GO `BanditEncounter.cs`와 같은 결 — 클립 자체는 이
    /// 클래스가 안 들고 있고, 씬 빌드 스크립트가 채운 [SerializeField]를
    /// 호출부가 넘긴다).
    /// </summary>
    public static class StoryAudio
    {
        private const string MasterKey = "saga_story_vol_master";
        private const string SfxKey = "saga_story_vol_sfx";
        private const string BgmKey = "saga_story_vol_bgm";

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
            if (_sfxSource != null) return _sfxSource;
            var go = new GameObject("StoryAudio_SfxSource");
            _sfxSource = go.AddComponent<AudioSource>();
            _sfxSource.playOnAwake = false;
            return _sfxSource;
        }

        public static void PlaySfx(AudioClip clip, float volumeScale = 1f)
        {
            if (clip == null) return;
            EnsureSfxSource().PlayOneShot(clip, MasterVolume * SfxVolume * volumeScale);
#if UNITY_ANDROID || UNITY_IOS
            if (StorySettingsState.VibrationOn) Handheld.Vibrate(); // PLAN.md 110 ① — PC 빌드엔 진동 API 가 없다.
#endif
        }

        /// <summary>BGM 재생은 `Saga.Core.Bgm` 이 맡는다(tasks U-0014) — 곡 하나 반복이던 판별 복사본을 합쳤다. 곡 파일(`Resources/Audio/Bgm/story-<장면>`)이
        /// 없으면 부트스트랩이 준 곡 그대로 돈다. 음량 = Master×Bgm(PlayerPrefs 키는 그대로).</summary>
        public static void PlayBgm(AudioClip clip) => Bgm.Play("story", "main", clip, () => MasterVolume * BgmVolume);

        /// <summary>설정에서 BGM On/Off 를 누를 때마다 불러 이미 도는 곡의 음량에 바로 반영한다.</summary>
        public static void RefreshBgmVolume() => Bgm.RefreshVolume();
    }
}
