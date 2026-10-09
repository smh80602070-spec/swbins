using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Core;

namespace Saga.Dungeon.Audio
{
    /// <summary>
    /// PLAN.md(saga-dungeon 웹판) 37장 "사운드". 처음엔 이 프로젝트에 CC0
    /// 오디오를 구할 방법이 없어 파형을 코드로 합성한 절차적 톤을 썼는데
    /// (원문 상수·"그림은 코드가 그린다" 원칙 참고 — 이제는 지운 옛 구현),
    /// 2026-09-14 다른 네 판(GO/FOREST/STORY/REALM)에 Kenney CC0 실클립을
    /// 붙인 뒤 사용자가 명시적으로 "DUNGEON도 실제 클립으로 통일"을
    /// 골라 이 클래스도 같은 방식으로 바꿨다 — 공개 API(PlayHit() 등,
    /// 인자 없음)는 그대로 둬서 `PlayerCombat.cs`·`DungeonEnemy.cs`·
    /// `DungeonSecretStash.cs`·`GameBootstrap.cs` 네 호출부는 안 건드렸다.
    ///
    /// 클립 자체는 정적 클래스라 씬에 못 묶는다(Unity 직렬화는
    /// MonoBehaviour/ScriptableObject 인스턴스 필드뿐, `Saga.Realm.Audio.
    /// RealmAudio.cs`가 겪은 것과 같은 제약) — 씬에 하나뿐이라 이미
    /// `PlayLevelUp()`을 부르고 있던 `GameBootstrap`이 [SerializeField]로
    /// 받은 클립 다섯 개를 `Configure()`로 한 번 넘긴다(씬 빌드 스크립트가
    /// `BuildTestDungeonScene.cs`에서 그 필드들을 채운다).
    /// </summary>
    public static class SfxPlayer
    {
        private const string MasterKey = "saga_dungeon_vol_master";
        private const string SfxKey = "saga_dungeon_vol_sfx";
        private const string BgmKey = "saga_dungeon_vol_bgm";

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

        private static AudioSource _source;

        private static AudioClip _hitClip;
        private static AudioClip _heavyHitClip;
        private static AudioClip _enemyDeathClip;
        private static AudioClip _levelUpClip;
        private static AudioClip _discoveryClip;

        public static void Configure(AudioClip hitClip, AudioClip heavyHitClip, AudioClip enemyDeathClip,
            AudioClip levelUpClip, AudioClip discoveryClip, AudioClip bgmClip = null)
        {
            _hitClip = hitClip;
            _heavyHitClip = heavyHitClip;
            _enemyDeathClip = enemyDeathClip;
            _levelUpClip = levelUpClip;
            _discoveryClip = discoveryClip;
            PlayBgm(bgmClip);
        }

        public static void PlayHit() => Play(_hitClip);
        public static void PlayHeavyHit() => Play(_heavyHitClip, 0.9f); // knifeSlice — chop.ogg보다 날카로워 강공격/급소 대용으로 구분.
        public static void PlayEnemyDeath() => Play(_enemyDeathClip);
        public static void PlayLevelUp() => Play(_levelUpClip);
        public static void PlayDiscovery() => Play(_discoveryClip);

        private static void Play(AudioClip clip, float volumeScale = 1f)
        {
            if (clip == null) return;
            EnsureSource();
            _source.PlayOneShot(clip, MasterVolume * SfxVolume * volumeScale);
#if UNITY_ANDROID || UNITY_IOS
            if (DungeonSettingsState.VibrationOn) Handheld.Vibrate(); // PLAN.md 110 ① — PC 빌드엔 진동 API 가 없다.
#endif
        }

        private static void EnsureSource()
        {
            if (_source != null) return;
            var go = new GameObject("SfxPlayer");
            _source = go.AddComponent<AudioSource>();
            _source.playOnAwake = false;
            _source.spatialBlend = 0f; // 던전 규모가 작아 위치 기반 감쇠 없이 2D로 충분.
        }

        /// <summary>BGM 재생은 `Saga.Core.Bgm` 이 맡는다(tasks U-0014) — 곡 하나 반복이던 판별 복사본을 합쳤다. 곡 파일(`Resources/Audio/Bgm/dungeon-<장면>`)이
        /// 없으면 부트스트랩이 준 곡 그대로 돈다. 음량 = Master×Bgm(PlayerPrefs 키는 그대로).</summary>
        public static void PlayBgm(AudioClip clip)
        {
            Bgm.Play("dungeon", "town", clip, () => MasterVolume * BgmVolume);
            SagaVoice.MasterVolume = () => MasterVolume; // U-0068 R-5 — 대사 음성도 이 판의 마스터 음량을 따른다(장면마다 PlayBgm 이 처음 불림)
            SagaVoice.Speaker = "self"; // 사가만리에서 싸우던 동료 목소리가 이 판 주인공에 남지 않게
        }

        /// <summary>설정에서 BGM On/Off 를 누를 때마다 불러 이미 도는 곡의 음량에 바로 반영한다.</summary>
        public static void RefreshBgmVolume() => Bgm.RefreshVolume();
    }
}
