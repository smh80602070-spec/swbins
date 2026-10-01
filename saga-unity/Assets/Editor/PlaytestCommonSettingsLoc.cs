using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEngine;
using DgLoc = Saga.Dungeon.Data.DungeonLocalization;
using DgSet = Saga.Dungeon.Data.DungeonSettingsState;
using FsLoc = Saga.Forest.Data.ForestLocalization;
using FsSet = Saga.Forest.Data.ForestSettingsState;
using RkLoc = Saga.Realm.Data.RealmLocalization;
using RkSet = Saga.Realm.Data.RealmSettingsState;

namespace Saga.EditorTools
{
    /// <summary>
    /// `un.dg.common`·`un.fs.common`·`un.rk.common` 의 규칙 층 — 67~69 설정·Localization(RECURRING R-3, 화면·씬 없이). 판마다 ① 한/영 표: 키 중복 0·두 언어 키 집합이 같음·빈 값 0·`{0}` 자리표시자가 같음
    /// ② 언어: `T(키)` 가 지금 언어 값·없는 키는 키/대체 글 그대로·`CycleLanguage` 가 ko→en→ko·라벨 ③ 설정: 화면 크기 단계(0.85/1/1.15)가 돌고 라벨이 있음·진동·효과음·배경음 토글(REALM 은 계승 토글도).
    /// 라이팅(66-2)·목표판/세션 카드는 씬·SagaCore 쪽이라 `PlaytestMobileGraphics` 등이 본다. 시작 때 설정 값을 떠 두었다가 끝에 되돌린다.
    /// `-executeMethod Saga.EditorTools.PlaytestCommonSettingsLoc.Run` → "[PlaytestCommonSettingsLoc] OK/FAIL".
    /// </summary>
    public static class PlaytestCommonSettingsLoc
    {
        private sealed class Game
        {
            public string Tag, Dir, Prefix;
            public Func<string> Lang; public Action<string> SetLang; public Action Cycle; public Func<string> LangLabel;
            public Func<string, string> T; public Func<string, string, string> T2;
            public Func<bool> Sfx, Bgm, Vib; public Action<bool> SetSfx, SetBgm, SetVib;
            public Func<float> Scale; public Action<float> SetScale; public Action CycleScale; public Func<string> ScaleLabel;
            public float[] Steps;
            public Func<bool> Succ; public Action<bool> SetSucc;
        }

        private static readonly Game[] Games =
        {
            new Game { Tag = "un.dg.common", Dir = "SagaDungeon", Prefix = "dungeon",
                Lang = () => DgLoc.CurrentLanguage, SetLang = v => DgLoc.CurrentLanguage = v, Cycle = DgLoc.CycleLanguage, LangLabel = DgLoc.LanguageLabel, T = k => DgLoc.T(k), T2 = (k, f) => DgLoc.T(k, f),
                Sfx = () => DgSet.SfxOn, SetSfx = v => DgSet.SfxOn = v, Bgm = () => DgSet.BgmOn, SetBgm = v => DgSet.BgmOn = v, Vib = () => DgSet.VibrationOn, SetVib = v => DgSet.VibrationOn = v,
                Scale = () => DgSet.UiScaleMultiplier, SetScale = v => DgSet.UiScaleMultiplier = v, CycleScale = DgSet.CycleUiScale, ScaleLabel = DgSet.UiScaleLabel, Steps = DgSet.UiScaleSteps },
            new Game { Tag = "un.fs.common", Dir = "SagaForest", Prefix = "forest",
                Lang = () => FsLoc.CurrentLanguage, SetLang = v => FsLoc.CurrentLanguage = v, Cycle = FsLoc.CycleLanguage, LangLabel = FsLoc.LanguageLabel, T = k => FsLoc.T(k), T2 = (k, f) => FsLoc.T(k, f),
                Sfx = () => FsSet.SfxOn, SetSfx = v => FsSet.SfxOn = v, Bgm = () => FsSet.BgmOn, SetBgm = v => FsSet.BgmOn = v, Vib = () => FsSet.VibrationOn, SetVib = v => FsSet.VibrationOn = v,
                Scale = () => FsSet.UiScaleMultiplier, SetScale = v => FsSet.UiScaleMultiplier = v, CycleScale = FsSet.CycleUiScale, ScaleLabel = FsSet.UiScaleLabel, Steps = FsSet.UiScaleSteps },
            new Game { Tag = "un.rk.common", Dir = "SagaRealm", Prefix = "realm",
                Lang = () => RkLoc.CurrentLanguage, SetLang = v => RkLoc.CurrentLanguage = v, Cycle = RkLoc.CycleLanguage, LangLabel = RkLoc.LanguageLabel, T = k => RkLoc.T(k), T2 = (k, f) => RkLoc.T(k, f),
                Sfx = () => RkSet.SfxOn, SetSfx = v => RkSet.SfxOn = v, Bgm = () => RkSet.BgmOn, SetBgm = v => RkSet.BgmOn = v, Vib = () => RkSet.VibrationOn, SetVib = v => RkSet.VibrationOn = v,
                Scale = () => RkSet.UiScaleMultiplier, SetScale = v => RkSet.UiScaleMultiplier = v, CycleScale = RkSet.CycleUiScale, ScaleLabel = RkSet.UiScaleLabel, Steps = RkSet.UiScaleSteps,
                Succ = () => RkSet.SuccessionOn, SetSucc = v => RkSet.SuccessionOn = v },
        };

        [MenuItem("Saga/Playtest Common Settings Loc")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestCommonSettingsLoc]");
            using (PlaytestKit.ErrorCounter())
            {
                foreach (var g in Games)
                {
                    string lang0 = g.Lang(); bool sfx0 = g.Sfx(), bgm0 = g.Bgm(), vib0 = g.Vib(); float scale0 = g.Scale();
                    bool succ0 = g.Succ != null && g.Succ();
                    try
                    {
                        CheckTables(g);
                        CheckLanguage(g);
                        CheckSettings(g);
                    }
                    finally
                    {
                        g.SetLang(lang0); g.SetSfx(sfx0); g.SetBgm(bgm0); g.SetVib(vib0); g.SetScale(scale0);
                        if (g.SetSucc != null) g.SetSucc(succ0);
                    }
                }
            }
            PlaytestKit.Summary("PlaytestCommonSettingsLoc");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        [Serializable]
        private sealed class Entry { public string key; public string value; }
        [Serializable]
        private sealed class Table { public Entry[] entries; }

        private static Dictionary<string, string> Load(Game g, string lang, out int count)
        {
            string path = Path.Combine(Application.dataPath, "Games", g.Dir, "Resources", "Localization", $"{g.Prefix}_{lang}.json");
            count = 0;
            PlaytestKit.Check(File.Exists(path), $"{g.Tag}: 표 파일 {g.Prefix}_{lang}.json 이 없음");
            if (!File.Exists(path)) return new Dictionary<string, string>();
            var t = JsonUtility.FromJson<Table>(File.ReadAllText(path));
            var d = new Dictionary<string, string>();
            if (t?.entries == null) return d;
            count = t.entries.Length;
            foreach (var e in t.entries) d[e.key] = e.value;
            return d;
        }

        private static string Placeholders(string s) =>
            string.Join(",", Regex.Matches(s ?? "", @"\{(\d+)(?::[^}]*)?\}").Cast<Match>().Select(m => "{" + m.Groups[1].Value + "}").OrderBy(x => x));

        private static void CheckTables(Game g)
        {
            var ko = Load(g, "ko", out int koN);
            var en = Load(g, "en", out int enN);
            PlaytestKit.Check(koN > 100 && ko.Count == koN, $"{g.Tag}: 한국어 표 {koN}줄·고유 키 {ko.Count}(중복 있거나 비었음)");
            PlaytestKit.Check(en.Count == enN, $"{g.Tag}: 영어 표 {enN}줄·고유 키 {en.Count}(중복)");
            var onlyKo = ko.Keys.Where(k => !en.ContainsKey(k)).Take(3).ToList();
            var onlyEn = en.Keys.Where(k => !ko.ContainsKey(k)).Take(3).ToList();
            PlaytestKit.Check(onlyKo.Count == 0 && onlyEn.Count == 0, $"{g.Tag}: 두 언어 키가 다름 — 한국어에만 [{string.Join(",", onlyKo)}] 영어에만 [{string.Join(",", onlyEn)}]");
            var empty = ko.Concat(en).Where(kv => string.IsNullOrEmpty(kv.Value)).Select(kv => kv.Key).Take(3).ToList();
            PlaytestKit.Check(empty.Count == 0, $"{g.Tag}: 빈 값 [{string.Join(",", empty)}]");
            var phBad = ko.Where(kv => en.ContainsKey(kv.Key) && Placeholders(kv.Value) != Placeholders(en[kv.Key])).Select(kv => kv.Key).Take(3).ToList();
            PlaytestKit.Check(phBad.Count == 0, $"{g.Tag}: 한/영 자리표시자가 다름 [{string.Join(",", phBad)}]");
        }

        private static void CheckLanguage(Game g)
        {
            var ko = Load(g, "ko", out _);
            var en = Load(g, "en", out _);
            var pair = ko.Where(kv => en.ContainsKey(kv.Key) && en[kv.Key] != kv.Value && !kv.Value.Contains("{")).Take(1).ToList();
            PlaytestKit.Check(pair.Count == 1, $"{g.Tag}: 한/영이 서로 다른 글인 키가 하나도 없음");
            if (pair.Count == 0) return;
            string key = pair[0].Key;

            g.SetLang("ko");
            PlaytestKit.Check(g.T(key) == ko[key] && g.T2(key, "대체") == ko[key], $"{g.Tag}: 한국어에서 T({key}) 가 표 값이 아님");
            g.SetLang("en");
            PlaytestKit.Check(g.T(key) == en[key] && g.T2(key, "fallback") == en[key], $"{g.Tag}: 영어에서 T({key}) 가 표 값이 아님");
            const string missing = "__no_such_key__";
            PlaytestKit.Check(g.T(missing) == missing, $"{g.Tag}: 없는 키가 키 그대로 안 돌아옴");
            PlaytestKit.Check(g.T2(missing, "대체 글") == "대체 글", $"{g.Tag}: 없는 키가 대체 글을 안 돌려줌");

            g.SetLang("ko");
            g.Cycle();
            PlaytestKit.Check(g.Lang() == "en" && g.LangLabel() == "English", $"{g.Tag}: ko → 순환이 en 이 아님({g.Lang()}/{g.LangLabel()})");
            g.Cycle();
            PlaytestKit.Check(g.Lang() == "ko" && g.LangLabel() == "한국어", $"{g.Tag}: en → 순환이 ko 가 아님({g.Lang()}/{g.LangLabel()})");
            g.SetLang("zz");
            PlaytestKit.Check(!string.IsNullOrEmpty(g.LangLabel()), $"{g.Tag}: 모르는 언어 코드의 라벨이 비었음");
        }

        private static void CheckSettings(Game g)
        {
            g.SetLang("ko");
            // 화면 크기 단계 — 단계 밖 값에서 시작하면 첫 단계로, 이후 한 칸씩 돌아 처음으로.
            PlaytestKit.Check(g.Steps.SequenceEqual(new[] { 0.85f, 1f, 1.15f }), $"{g.Tag}: 화면 크기 단계가 0.85/1/1.15 가 아님");
            g.SetScale(0.5f);
            g.CycleScale();
            PlaytestKit.Check(Mathf.Approximately(g.Scale(), 0.85f), $"{g.Tag}: 단계 밖 값에서 첫 단계로 안 감({g.Scale()})");
            float[] want = { 1f, 1.15f, 0.85f };
            foreach (float w in want)
            {
                g.CycleScale();
                PlaytestKit.Check(Mathf.Approximately(g.Scale(), w), $"{g.Tag}: 화면 크기 순환 {g.Scale()} (기대 {w})");
                PlaytestKit.Check(!string.IsNullOrEmpty(g.ScaleLabel()), $"{g.Tag}: 화면 크기 {w} 라벨이 비었음");
            }

            g.SetVib(false);
            PlaytestKit.Check(!g.Vib(), $"{g.Tag}: 진동 끄기 실패");
            g.SetVib(true);
            PlaytestKit.Check(g.Vib(), $"{g.Tag}: 진동 켜기 실패");
            g.SetSfx(false);
            PlaytestKit.Check(!g.Sfx(), $"{g.Tag}: 효과음 끄기 실패");
            g.SetSfx(true);
            PlaytestKit.Check(g.Sfx(), $"{g.Tag}: 효과음 켜기 실패");
            g.SetBgm(false);
            PlaytestKit.Check(!g.Bgm(), $"{g.Tag}: 배경음 끄기 실패");
            g.SetBgm(true);
            PlaytestKit.Check(g.Bgm(), $"{g.Tag}: 배경음 켜기 실패");
            if (g.SetSucc != null)
            {
                g.SetSucc(false);
                PlaytestKit.Check(!g.Succ(), $"{g.Tag}: 계승 끄기 실패");
                g.SetSucc(true);
                PlaytestKit.Check(g.Succ(), $"{g.Tag}: 계승 켜기 실패");
            }
        }
    }
}
