using System;
using UnityEngine;
using Saga.Core;

namespace Saga.Title
{
    /// <summary>
    /// PLAN.md 110 ⑤c 타이틀 설정 — 언어·전체 음량·배경음·효과음·진동을 **다섯 판에 한꺼번에** 적는다.
    /// 판 설정(판 안의 "설정")은 PlayerPrefs 키가 판마다 따로라(`saga_go_language` 등) 그대로 두고, 여기선 다섯 판의
    /// 공개 설정 API 를 차례로 부른다 — 판 안에서 한 판만 바꾼 값은 다음에 타이틀에서 바꿀 때까지 그 판에만 남는다.
    /// 다섯 판 값이 서로 다르면 "판마다 다름"으로 보이고, 누르면 사가만리 값의 다음 칸으로 다섯을 맞춘다.
    /// UI 크기·그래픽 품질은 판마다 HUD·장면이 달라 판 설정에만 둔다.
    /// </summary>
    public static class TitleSettings
    {
        private struct Game
        {
            public Func<string> GetLang; public Action<string> SetLang;
            public Func<float> GetMaster; public Action<float> SetMaster;
            public Func<bool> GetBgm; public Action<bool> SetBgm;
            public Func<bool> GetSfx; public Action<bool> SetSfx;
            public Func<bool> GetVib; public Action<bool> SetVib;
        }

        // TitleScreen.Games 순서(사가만리가 첫째 — 섞였을 때의 기준).
        private static readonly Game[] Games =
        {
            new Game
            {
                GetLang = () => Saga.Go.Data.GoLocalization.CurrentLanguage, SetLang = v => Saga.Go.Data.GoLocalization.CurrentLanguage = v,
                GetMaster = () => Saga.Go.Audio.GoAudio.MasterVolume,
                SetMaster = v => { Saga.Go.Audio.GoAudio.MasterVolume = v; Saga.Go.Audio.GoAudio.RefreshBgmVolume(); },
                GetBgm = () => Saga.Go.Data.GoSettingsState.BgmOn, SetBgm = v => Saga.Go.Data.GoSettingsState.BgmOn = v,
                GetSfx = () => Saga.Go.Data.GoSettingsState.SfxOn, SetSfx = v => Saga.Go.Data.GoSettingsState.SfxOn = v,
                GetVib = () => Saga.Go.Data.GoSettingsState.VibrationOn, SetVib = v => Saga.Go.Data.GoSettingsState.VibrationOn = v,
            },
            new Game
            {
                GetLang = () => Saga.Dungeon.Data.DungeonLocalization.CurrentLanguage, SetLang = v => Saga.Dungeon.Data.DungeonLocalization.CurrentLanguage = v,
                GetMaster = () => Saga.Dungeon.Audio.SfxPlayer.MasterVolume,
                SetMaster = v => { Saga.Dungeon.Audio.SfxPlayer.MasterVolume = v; Saga.Dungeon.Audio.SfxPlayer.RefreshBgmVolume(); },
                GetBgm = () => Saga.Dungeon.Data.DungeonSettingsState.BgmOn, SetBgm = v => Saga.Dungeon.Data.DungeonSettingsState.BgmOn = v,
                GetSfx = () => Saga.Dungeon.Data.DungeonSettingsState.SfxOn, SetSfx = v => Saga.Dungeon.Data.DungeonSettingsState.SfxOn = v,
                GetVib = () => Saga.Dungeon.Data.DungeonSettingsState.VibrationOn, SetVib = v => Saga.Dungeon.Data.DungeonSettingsState.VibrationOn = v,
            },
            new Game
            {
                GetLang = () => Saga.Forest.Data.ForestLocalization.CurrentLanguage, SetLang = v => Saga.Forest.Data.ForestLocalization.CurrentLanguage = v,
                GetMaster = () => Saga.Forest.Audio.ForestAudio.MasterVolume,
                SetMaster = v => { Saga.Forest.Audio.ForestAudio.MasterVolume = v; Saga.Forest.Audio.ForestAudio.RefreshBgmVolume(); },
                GetBgm = () => Saga.Forest.Data.ForestSettingsState.BgmOn, SetBgm = v => Saga.Forest.Data.ForestSettingsState.BgmOn = v,
                GetSfx = () => Saga.Forest.Data.ForestSettingsState.SfxOn, SetSfx = v => Saga.Forest.Data.ForestSettingsState.SfxOn = v,
                GetVib = () => Saga.Forest.Data.ForestSettingsState.VibrationOn, SetVib = v => Saga.Forest.Data.ForestSettingsState.VibrationOn = v,
            },
            new Game
            {
                GetLang = () => Saga.Story.Data.StoryLocalization.CurrentLanguage, SetLang = v => Saga.Story.Data.StoryLocalization.CurrentLanguage = v,
                GetMaster = () => Saga.Story.Audio.StoryAudio.MasterVolume,
                SetMaster = v => { Saga.Story.Audio.StoryAudio.MasterVolume = v; Saga.Story.Audio.StoryAudio.RefreshBgmVolume(); },
                GetBgm = () => Saga.Story.Data.StorySettingsState.BgmOn, SetBgm = v => Saga.Story.Data.StorySettingsState.BgmOn = v,
                GetSfx = () => Saga.Story.Data.StorySettingsState.SfxOn, SetSfx = v => Saga.Story.Data.StorySettingsState.SfxOn = v,
                GetVib = () => Saga.Story.Data.StorySettingsState.VibrationOn, SetVib = v => Saga.Story.Data.StorySettingsState.VibrationOn = v,
            },
            new Game
            {
                GetLang = () => Saga.Realm.Data.RealmLocalization.CurrentLanguage, SetLang = v => Saga.Realm.Data.RealmLocalization.CurrentLanguage = v,
                GetMaster = () => Saga.Realm.Audio.RealmAudio.MasterVolume,
                SetMaster = v => { Saga.Realm.Audio.RealmAudio.MasterVolume = v; Saga.Realm.Audio.RealmAudio.RefreshBgmVolume(); },
                GetBgm = () => Saga.Realm.Data.RealmSettingsState.BgmOn, SetBgm = v => Saga.Realm.Data.RealmSettingsState.BgmOn = v,
                GetSfx = () => Saga.Realm.Data.RealmSettingsState.SfxOn, SetSfx = v => Saga.Realm.Data.RealmSettingsState.SfxOn = v,
                GetVib = () => Saga.Realm.Data.RealmSettingsState.VibrationOn, SetVib = v => Saga.Realm.Data.RealmSettingsState.VibrationOn = v,
            },
        };

        public static readonly string[] LanguageCodes = { "ko", "en" };
        private static readonly string[] LanguageNames = { "한국어", "English" };
        public static readonly float[] VolumeSteps = { 0f, 0.25f, 0.5f, 0.75f, 1f };

        /// <summary>진동은 폰에서만 줄을 보인다(PC 는 진동이 없다).</summary>
        public static bool ShowVibration => Application.isMobilePlatform;

        /// <summary>타이틀·일시정지 메뉴의 언어 = 사가만리 판 언어(다섯이 섞였을 때도 첫째).</summary>
        public static string Language => Games[0].GetLang();

        /// <summary>공통 UI 언어를 판 설정에서 다시 읽어 SagaCore 에 적는다(타이틀이 켜질 때·언어를 바꿀 때).</summary>
        public static void SyncCoreLanguage() => SagaUi.Lang = Language == "en" ? "en" : "ko";

        public static void CycleLanguage()
        {
            int i = (Array.IndexOf(LanguageCodes, Language) + 1) % LanguageCodes.Length;
            foreach (var g in Games) g.SetLang(LanguageCodes[i]);
            SyncCoreLanguage();
        }

        public static void CycleVolume()
        {
            float cur = Games[0].GetMaster();
            int i = 0;
            while (i < VolumeSteps.Length && VolumeSteps[i] <= cur + 0.001f) i++; // 칸 사이 값(판에서 따로 바꾼 값)도 다음 칸으로
            float next = VolumeSteps[i % VolumeSteps.Length];
            foreach (var g in Games) g.SetMaster(next);
        }

        public static void ToggleBgm() { bool v = !Games[0].GetBgm(); foreach (var g in Games) g.SetBgm(v); }
        public static void ToggleSfx() { bool v = !Games[0].GetSfx(); foreach (var g in Games) g.SetSfx(v); }
        public static void ToggleVibration() { bool v = !Games[0].GetVib(); foreach (var g in Games) g.SetVib(v); }

        public static bool AllSameLanguage() => AllSame(g => g.GetLang());
        public static bool AllSameVolume() => AllSame(g => Mathf.RoundToInt(g.GetMaster() * 100f));
        public static bool AllSameBgm() => AllSame(g => g.GetBgm());
        public static bool AllSameSfx() => AllSame(g => g.GetSfx());
        public static bool AllSameVibration() => AllSame(g => g.GetVib());

        public static float MasterVolume => Games[0].GetMaster();
        public static bool BgmOn => Games[0].GetBgm();
        public static bool SfxOn => Games[0].GetSfx();

        private static string Mixed => SagaUi.L("판마다 다름", "Varies by game");

        public static string LanguageLabel()
        {
            if (!AllSameLanguage()) return Mixed;
            int i = Array.IndexOf(LanguageCodes, Language);
            return LanguageNames[i < 0 ? 0 : i];
        }

        public static string VolumeLabel() => AllSameVolume() ? $"{Mathf.RoundToInt(Games[0].GetMaster() * 100f)}%" : Mixed;
        public static string BgmLabel() => AllSameBgm() ? OnOff(Games[0].GetBgm()) : Mixed;
        public static string SfxLabel() => AllSameSfx() ? OnOff(Games[0].GetSfx()) : Mixed;
        public static string VibrationLabel() => AllSameVibration() ? OnOff(Games[0].GetVib()) : Mixed;

        private static string OnOff(bool on) => on ? SagaUi.L("켜짐", "On") : SagaUi.L("꺼짐", "Off");

        private static bool AllSame<T>(Func<Game, T> get)
        {
            T first = get(Games[0]);
            for (int i = 1; i < Games.Length; i++) if (!Equals(get(Games[i]), first)) return false;
            return true;
        }
    }
}
