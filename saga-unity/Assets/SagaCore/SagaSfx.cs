using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// U-0048 효과음 공통 찾기(`Bgm` 과 같은 결) — 자체툴 K-0045 효과음 92종(`sfx_<이름>.ogg` 또는 변형 `sfx_<이름>_1.ogg`·`_2` …)을
    /// `Resources/Audio/Sfx/` 에서 이름으로 찾는다. **파일이 없으면 null(조용)** — 배치(K-0076)가 놓이면 코드 변경 없이 소리가 난다.
    /// 변형이 있는 이름(`sword_hit` 등)은 돌려 가며(라운드로빈) 하나씩. 기록(<see cref="History"/>·<see cref="LastPlayed"/>)은 소리 파일이 없어도 남아
    /// 진단이 "이 사건에서 이 효과음을 불렀다" 를 확인한다. 판별 음량·재생은 각 판 `*Audio.PlaySfx`(예 `GoSfx`).
    /// </summary>
    public static class SagaSfx
    {
        public const string Dir = "Audio/Sfx/";

        /// <summary>클립 찾기 — 키는 파일 이름(확장자 없음, 예 `sfx_ui_click`). 진단이 바꾼다.</summary>
        public static Func<string, AudioClip> Loader = key => Resources.Load<AudioClip>(Dir + key);

        private static readonly Dictionary<string, AudioClip[]> Cache = new Dictionary<string, AudioClip[]>();
        private static readonly Dictionary<string, int> Next = new Dictionary<string, int>();
        public static readonly List<string> History = new List<string>();
        public static string LastPlayed { get; private set; } = "";
        public const int HistoryMax = 64;

        /// <summary>이름의 클립들 — `sfx_<이름>` 하나 또는 `sfx_<이름>_1`·`_2`… 변형(없으면 빈 배열).</summary>
        public static AudioClip[] Variants(string name)
        {
            if (Cache.TryGetValue(name, out var v)) return v;
            var list = new List<AudioClip>();
            var single = Loader("sfx_" + name);
            if (single != null) list.Add(single);
            for (int i = 1; i <= 9; i++)
            {
                var c = Loader($"sfx_{name}_{i}");
                if (c == null) break;
                list.Add(c);
            }
            var arr = list.ToArray();
            Cache[name] = arr;
            return arr;
        }

        public static bool Has(string name) => Variants(name).Length > 0;

        /// <summary>이름의 다음 클립(변형은 돌려 가며, 없으면 null) — 부른 기록을 남긴다.</summary>
        public static AudioClip Pick(string name)
        {
            Note(name);
            var v = Variants(name);
            if (v.Length == 0) return null;
            Next.TryGetValue(name, out int i);
            Next[name] = (i + 1) % v.Length;
            return v[i % v.Length];
        }

        public static void Note(string name)
        {
            LastPlayed = name;
            History.Add(name);
            if (History.Count > HistoryMax) History.RemoveAt(0);
        }

        /// <summary>진단 — 캐시·기록을 비운다(로더를 바꾼 뒤 부른다).</summary>
        public static void ResetForTest()
        {
            Cache.Clear(); Next.Clear(); History.Clear(); LastPlayed = "";
        }
    }
}
