using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// U-0068 대사 음성 재생 — 다섯 판 공용, 고돗 `saga_core/audio/voice.gd`(G-0111) 규칙 그대로.
    ///   SagaVoice.Say("shout", "sg_guanyu")  // 갈래 shout·pickup·greet — 그 인물 목소리(assign)로 무작위 한 줄
    ///   SagaVoice.Say("shout", id, true)     // sure = 확률·간격 없이, 앞 말을 끊고(필살처럼 꼭 외칠 때)
    ///   SagaVoice.Say("pickup")              // id 를 안 주면 <see cref="Speaker"/>(기본 "self" = 주인공)
    ///   SagaVoice.System("save")             // 안내 = 해설 NA 의 system 줄(키는 <see cref="SystemLines"/>)
    /// 파일: `Resources/Audio/Voice/voice_<목소리>_<줄 id>.ogg` + `voice_list.json`(lines·assign·missing — K-0036 산출, 고치지 않는다).
    /// 빠진 줄(missing)·상황이 정해진 줄(SKIP)은 고르지 않는다. 갈래마다 간격(GAP)·확률(CHANCE)로 매번 떠들지 않게 하고,
    /// 소리원은 하나 — 말하는 중엔 더 낮은 순위(PRIO)의 말은 버린다. 클립을 못 찾아도 <see cref="LastPath"/>·<see cref="Count"/> 는 남는다(진단용).
    /// 켜기·음량은 PlayerPrefs(`saga.voice.enabled`·`saga.voice.volume`), 판의 마스터 음량은 <see cref="MasterVolume"/> 로 곱한다.
    /// </summary>
    public static class SagaVoice
    {
        public const string Dir = "Audio/Voice/";
        public const string Narrator = "NA";
        public const float BaseVolume = 0.63f; // 고돗 BASE_DB -4dB
        public const float EstSec = 1.5f;      // 클립 길이를 모를 때 한 마디 길이
        private const string EnabledKey = "saga.voice.enabled", VolumeKey = "saga.voice.volume";

        private static readonly string[] HashVoices = { "M1", "M2", "M3", "M4", "M5", "F1", "F2", "F3", "F4", "F5" };
        public static readonly Dictionary<string, float> Gap = new Dictionary<string, float> { ["shout"] = 3f, ["pickup"] = 4f, ["greet"] = 1.5f, ["system"] = 2f };
        public static readonly Dictionary<string, float> Chance = new Dictionary<string, float> { ["shout"] = 0.35f, ["pickup"] = 0.6f, ["greet"] = 1f, ["system"] = 1f };
        private static readonly Dictionary<string, int> Prio = new Dictionary<string, int> { ["pickup"] = 1, ["greet"] = 1, ["shout"] = 2, ["system"] = 3 };
        /// <summary>아무 때나 내면 어긋나는 줄 — 가방 꽉 참·새 장비·선물·손에 맞음 / 아침 인사·작별·고마움·부탁.</summary>
        public static readonly Dictionary<string, string[]> Skip = new Dictionary<string, string[]>
        {
            ["pickup"] = new[] { "pickup_12", "pickup_14", "pickup_15", "pickup_18" },
            ["greet"] = new[] { "greet_05", "greet_09", "greet_11", "greet_15", "greet_18", "greet_19" },
        };
        /// <summary>안내 키 → system 줄.</summary>
        public static readonly Dictionary<string, string> SystemLines = new Dictionary<string, string>
        {
            ["save"] = "system_01", ["new_area"] = "system_02", ["bag_full"] = "system_03", ["daily"] = "system_04",
            ["levelup"] = "system_06", ["gacha_rare"] = "system_07", ["gacha_legend"] = "system_07", ["join"] = "system_07",
            ["quest"] = "system_08", ["new_gear"] = "system_09", ["danger"] = "system_10", ["boss_appear"] = "system_11",
            ["victory"] = "system_12", ["defeat"] = "system_13", ["load"] = "system_14", ["settings"] = "system_15",
            ["new_skill"] = "system_16", ["time_low"] = "system_17", ["door"] = "system_18", ["secret"] = "system_19",
            ["reward"] = "system_19", ["login"] = "system_20",
        };

        /// <summary>클립 찾기(키 = 파일 이름, 확장자 없음) · 표 글 찾기 · 시각 · 판 마스터 음량 — 진단·판이 바꾼다.</summary>
        public static Func<string, AudioClip> Loader = key => Resources.Load<AudioClip>(Dir + key);
        public static Func<string> TableLoader = () => Resources.Load<TextAsset>(Dir + "voice_list")?.text;
        public static Func<float> Now = () => Time.realtimeSinceStartup;
        public static Func<float> MasterVolume = () => 1f;
        public static global::System.Random Rng = new global::System.Random();

        /// <summary>판이 정하는 말하는 이(사가만리는 싸우는 인물 id). 기본 "self" = 주인공.</summary>
        public static string Speaker = "self";
        /// <summary>시험용 — 확률을 무시하고 늘 말한다(간격·순위는 그대로).</summary>
        public static bool Always;

        public static string LastPath { get; private set; } = "";
        public static string LastKind { get; private set; } = "";
        public static AudioClip LastClip { get; private set; }
        public static int Count { get; private set; }
        /// <summary>최근에 고른 파일 키(진단용, 최대 <see cref="HistoryMax"/>).</summary>
        public static readonly List<string> History = new List<string>();
        public const int HistoryMax = 64;

        private static Dictionary<string, List<string>> _lines;
        private static readonly Dictionary<string, string> Assign = new Dictionary<string, string>();
        private static readonly HashSet<string> Missing = new HashSet<string>();
        private static readonly Dictionary<string, float> At = new Dictionary<string, float>();
        private static readonly Dictionary<string, AudioClip> Cache = new Dictionary<string, AudioClip>();
        private static float _busyUntil;
        private static int _busyPrio;
        private static AudioSource _src;

        public static bool Enabled
        {
            get => PlayerPrefs.GetInt(EnabledKey, 1) != 0;
            set { PlayerPrefs.SetInt(EnabledKey, value ? 1 : 0); if (!value && _src != null) _src.Stop(); }
        }

        public static float Volume
        {
            get => PlayerPrefs.GetFloat(VolumeKey, 1f);
            set { PlayerPrefs.SetFloat(VolumeKey, Mathf.Clamp01(value)); if (_src != null) _src.volume = TargetVolume(); }
        }

        public static float TargetVolume() => Mathf.Clamp01(BaseVolume * Volume * MasterVolume());

        public static string Say(string kind, string id = "", bool sure = false)
        {
            if (kind == "system" || !Gap.ContainsKey(kind)) return "";
            if (!(Always || sure) && Rng.NextDouble() > Chance[kind]) return "";
            string v = VoiceOf(string.IsNullOrEmpty(id) ? Speaker : id);
            return Speak(kind, v, Pick(kind, v), kind, sure);
        }

        public static string System(string key) =>
            SystemLines.TryGetValue(key, out var line) ? Speak("system", Narrator, line, "system:" + key, false) : "";

        /// <summary>인물 id → 목소리. 표에 없으면 id 해시로 열 목소리 중 하나(같은 id 는 늘 같은 목소리).</summary>
        public static string VoiceOf(string id)
        {
            Table();
            if (Assign.TryGetValue(id, out var v)) return v;
            uint h = 2166136261;
            foreach (char c in id) { h ^= c; h *= 16777619; }
            return HashVoices[h % (uint)HashVoices.Length];
        }

        /// <summary>그 목소리로 낼 수 있는 갈래 줄 하나(빠진 줄·SKIP 은 건너뜀). 없으면 "".</summary>
        public static string Pick(string kind, string voice)
        {
            if (!Table().TryGetValue(kind, out var all)) return "";
            Skip.TryGetValue(kind, out var skip);
            var ok = new List<string>();
            foreach (var lid in all)
                if (!Missing.Contains(voice + "/" + lid) && (skip == null || Array.IndexOf(skip, lid) < 0)) ok.Add(lid);
            return ok.Count == 0 ? "" : ok[Rng.Next(ok.Count)];
        }

        public static string KeyOf(string voice, string lineId) => $"voice_{voice}_{lineId}";
        public static bool IsMissing(string voice, string lineId) { Table(); return Missing.Contains(voice + "/" + lineId); }
        public static IReadOnlyDictionary<string, List<string>> Lines => Table();
        public static IReadOnlyDictionary<string, string> AssignTable { get { Table(); return Assign; } }

        private static string Speak(string kind, string voice, string lineId, string gapKey, bool sure)
        {
            if (!Enabled || lineId.Length == 0 || IsMissing(voice, lineId)) return "";
            float now = Now();
            if (!sure && At.TryGetValue(gapKey, out float t) && now - t < Gap[kind]) return "";
            int prio = Prio[kind] + (sure ? 1 : 0);
            if (now < _busyUntil && prio < _busyPrio) return "";
            At[gapKey] = now;
            _busyPrio = prio;
            _busyUntil = now + EstSec;
            LastPath = KeyOf(voice, lineId);
            LastKind = kind;
            Count++;
            History.Add(LastPath);
            if (History.Count > HistoryMax) History.RemoveAt(0);
            LastClip = Clip(LastPath);
            if (LastClip != null)
            {
                _busyUntil = now + LastClip.length;
                Play(LastClip);
            }
            return LastPath;
        }

        private static AudioClip Clip(string key)
        {
            if (Cache.TryGetValue(key, out var c)) return c;
            c = Loader(key);
            Cache[key] = c;
            return c;
        }

        private static void Play(AudioClip clip)
        {
            if (!Application.isPlaying) return; // 에디터 진단(플레이 밖)은 고르기·기록만
            if (_src == null)
            {
                var go = new GameObject("SagaVoice");
                UnityEngine.Object.DontDestroyOnLoad(go);
                _src = go.AddComponent<AudioSource>();
                _src.playOnAwake = false;
                _src.loop = false;
                _src.spatialBlend = 0f;
            }
            _src.Stop(); // 한 번에 한 마디 — 새 말이 앞 말을 끊는다
            _src.clip = clip;
            _src.volume = TargetVolume();
            _src.Play();
        }

        [Serializable] private class LineRow { public string id; public string kind; }
        [Serializable] private class TableRows { public LineRow[] lines; public string[] missing; }

        private static Dictionary<string, List<string>> Table()
        {
            if (_lines != null) return _lines;
            _lines = new Dictionary<string, List<string>>();
            string text = TableLoader();
            if (string.IsNullOrEmpty(text)) return _lines;
            var rows = JsonUtility.FromJson<TableRows>(text);
            if (rows?.lines != null)
                foreach (var l in rows.lines)
                {
                    if (!_lines.TryGetValue(l.kind, out var list)) _lines[l.kind] = list = new List<string>();
                    list.Add(l.id);
                }
            if (rows?.missing != null) foreach (var m in rows.missing) Missing.Add(m);
            // assign 은 사전이라 JsonUtility 가 못 읽는다 — "assign": { ... } 블록만 정규식으로
            int a = text.IndexOf("\"assign\"", StringComparison.Ordinal);
            if (a >= 0)
            {
                int open = text.IndexOf('{', a), close = open < 0 ? -1 : text.IndexOf('}', open);
                if (open >= 0 && close > open)
                    foreach (Match m in Regex.Matches(text.Substring(open, close - open), "\"([^\"]+)\"\\s*:\\s*\"([^\"]+)\""))
                        Assign[m.Groups[1].Value] = m.Groups[2].Value;
            }
            return _lines;
        }

        /// <summary>진단 — 표·캐시·간격·기록을 비운다(로더를 바꾼 뒤 부른다).</summary>
        public static void ResetForTest()
        {
            _lines = null; Assign.Clear(); Missing.Clear(); At.Clear(); Cache.Clear();
            _busyUntil = 0f; _busyPrio = 0; Always = false; Speaker = "self";
            LastPath = ""; LastKind = ""; LastClip = null; Count = 0; History.Clear();
        }

        /// <summary>진단 — 간격·말하는 중만 비운다(표·말하는 이·기록은 그대로).</summary>
        public static void ResetTimingForTest() { At.Clear(); _busyUntil = 0f; _busyPrio = 0; }
    }
}
