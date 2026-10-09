using UnityEngine;
using Saga.Realm.Data;
using Saga.Core;

namespace Saga.Realm.Audio
{
    /// <summary>
    /// PLAN.md 67장 "사운드" — `Saga.Forest.Audio.ForestAudio.cs`·
    /// `Saga.Go.Audio.GoAudio.cs`와 같은 결(다섯 판이 공용 로직을 각자
    /// 복사해 쓰는 관례, 루트 CLAUDE.md). 진짜 Unity AudioMixer 에셋은
    /// 에디터 GUI로 사람이 노드를 잇는 방식이라 배치 모드로 못 만들어
    /// 이번에도 코드로 Master/SFX 볼륨을 곱하는 것으로만 흉내 낸다.
    ///
    /// REALM은 전투(타격감)가 아니라 명령·문답·계략 같은 판정 결과 UI가
    /// 중심이다 — 어느 클립을 재생할지는 이 클래스가 안 들고 있고,
    /// `RealmCommandUi.cs`가 [SerializeField]로 받은 confirm/error 클립을
    /// 호출부에서 골라 넘긴다(정적 클래스는 씬 저장을 못 버텨 클립 자체를
    /// 못 들고 있다 — `ForestHostileEncounterUi.cs`가 겪은 함정과 같은
    /// 이유). 승리 팡파레 같은 감정가 있는 선곡은 GO의 "Short jingles"
    /// 보류(GoAudio.cs 클래스 주석 참고)와 같은 이유로 하지 않는다 —
    /// 소패 함락(승)도 confirm, 퇴각(패)도 error 한 갈래로 묶는다.
    /// </summary>
    public static class RealmAudio
    {
        private const string MasterKey = "saga_realm_vol_master";
        private const string SfxKey = "saga_realm_vol_sfx";
        private const string BgmKey = "saga_realm_vol_bgm";

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
            var go = new GameObject("RealmAudio_SfxSource");
            _sfxSource = go.AddComponent<AudioSource>();
            _sfxSource.playOnAwake = false;
            return _sfxSource;
        }

        public static void PlaySfx(AudioClip clip, float volumeScale = 1f)
        {
            if (clip == null) return;
            EnsureSfxSource().PlayOneShot(clip, MasterVolume * SfxVolume * volumeScale);
#if UNITY_ANDROID || UNITY_IOS
            if (RealmSettingsState.VibrationOn) Handheld.Vibrate(); // PLAN.md 110 ① — PC 빌드엔 진동 API 가 없다.
#endif
        }

        /// <summary>BGM 재생은 `Saga.Core.Bgm` 이 맡는다(tasks U-0014) — 곡 하나 반복이던 판별 복사본을 합쳤다. 곡 파일(`Resources/Audio/Bgm/realm-<장면>`)이
        /// 없으면 부트스트랩이 준 곡 그대로 돈다. 음량 = Master×Bgm(PlayerPrefs 키는 그대로).</summary>
        public static void PlayBgm(AudioClip clip)
        {
            Bgm.Play("realm", "town", clip, () => MasterVolume * BgmVolume);
            SagaVoice.MasterVolume = () => MasterVolume; // U-0068 R-5 — 대사 음성도 이 판의 마스터 음량을 따른다(장면마다 PlayBgm 이 처음 불림)
            SagaVoice.Speaker = "self"; // 사가만리에서 싸우던 동료 목소리가 이 판 주인공에 남지 않게
        }

        /// <summary>설정에서 BGM On/Off 를 누를 때마다 불러 이미 도는 곡의 음량에 바로 반영한다.</summary>
        public static void RefreshBgmVolume() => Bgm.RefreshVolume();
    }
}
