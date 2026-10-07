using System;
using System.Collections.Generic;

namespace Saga.Forest.Data
{
    /// <summary>
    /// tasks U-0029 — 웹 사가마을(`js/data-village.js` `ruin` 표)이 09-30 에 더한 다섯째 번들 갈래
    /// "탑성 조각". 폐허 곁 돌무더기 여섯(`World/ForestRubbleSpot.cs`)에서 조각 여섯을 하나씩
    /// 모으면 마을에 다시 쌓은 정자가 선다. 웹의 `bonus: true` 와 같게 **보너스 갈래**라
    /// 네 갈래(곤충·버섯·화석·꽃)의 "다 채움"·마을 평가·꽃놀이·방문객·시나리오 집계에 안 낀다.
    ///
    /// `ForestMuseumState.Category` 에 다섯째 값을 끼우지 않고 따로 둔 이유: 그 enum 은 배열 첨자·
    /// 개수(`ForestScenario.Gather[(int)c]`·`ForestFestivalState.CategoryCount=4`·`ForestTownScore`·
    /// `ForestTutorial` 이 `Enum.GetValues` 로 훑음)로 쓰여, 값 하나를 더하면 평가·꽃놀이·시나리오가 흔들린다.
    /// 세이브에는 한국어 이름이 아니라 키(`rooftile` …)를 적는다 — 표시 글자만 현지화 표로 바꾼다.
    /// </summary>
    public static class ForestRuinBundle
    {
        /// <summary>조각 여섯 — 웹 `ruin` 표 순서(흔한 것 → 드문 것).</summary>
        public static readonly string[] Keys = { "rooftile", "wallstone", "rafter", "bignail", "doorring", "postkey" };

        // 웹 표시 이름 그대로(실명 없음). 화면 글은 `ruin.piece.<키>` 번역 표가 먼저, 없으면 이 이름.
        private static readonly Dictionary<string, string> KoNames = new Dictionary<string, string>
        {
            ["rooftile"] = "옛 기와 조각", ["wallstone"] = "성돌", ["rafter"] = "서까래 토막",
            ["bignail"] = "대못", ["doorring"] = "문고리", ["postkey"] = "옛 우체통 열쇠",
        };

        private static readonly HashSet<string> Found = new HashSet<string>();
        private static bool _completed;

        /// <summary>여섯 조각이 막 다 모인 순간(딱 한 번) — 마을에 정자를 짓는 신호.</summary>
        public static event Action Completed;

        public static int Total => Keys.Length;
        public static int FoundCount => Found.Count;
        public static bool IsCompleted => _completed;
        public static bool IsFound(string key) => key != null && Found.Contains(key);
        public static bool IsValidKey(string key) => key != null && KoNames.ContainsKey(key);

        public static string DisplayName(string key) =>
            key != null && KoNames.TryGetValue(key, out var ko) ? ForestLocalization.T("ruin.piece." + key, ko) : key;

        /// <summary>처음 모은 조각이면 true. 여섯째가 채워진 호출 안에서 `Completed` 를 한 번 쏜다.
        /// 모르는 키·이미 모은 조각은 false 이고 아무것도 안 바꾼다.</summary>
        public static bool Record(string key)
        {
            if (!IsValidKey(key) || !Found.Add(key)) return false;
            if (!_completed && Found.Count >= Keys.Length)
            {
                _completed = true;
                Completed?.Invoke();
            }
            return true;
        }

        public static string[] Snapshot()
        {
            var arr = new string[Found.Count];
            Found.CopyTo(arr);
            return arr;
        }

        /// <summary>SaveState 전용 — 이벤트는 안 쏜다(로드는 "막 완성한 순간"이 아니다, `ForestMuseumState.Restore`
        /// 와 같은 이유). `ForestBootstrap` 이 로드 직후 `IsCompleted` 를 직접 보고 정자를 소리 없이 다시 세운다.
        /// null(옛 세이브)·모르는 키는 조용히 빈 채로 둔다.</summary>
        public static void Restore(string[] keys)
        {
            Found.Clear();
            _completed = false;
            if (keys != null)
            {
                foreach (var k in keys) if (IsValidKey(k)) Found.Add(k);
            }
            _completed = Found.Count >= Keys.Length;
        }

        public static void ResetForTest() => Restore(null);
    }
}
