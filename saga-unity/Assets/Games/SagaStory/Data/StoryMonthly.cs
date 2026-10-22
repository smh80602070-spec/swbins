using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Story.Data
{
    /// <summary>
    /// tasks U-0162(웹 W-0242 monthly.js · 고돗 G-0296 짝) 달 사명 — 놓쳐도 벌칙 없는 월간 목표.
    /// 이번 달(기기 날짜 YYYY-MM) 안에 몹 300, 이달의 사냥터에선 한 마리를 둘로 센다. 채우면 그 달 "달 문장"을 모은다(힘 없음 — 도감처럼).
    /// 새 달은 셈만 새로, 모은 문장은 그대로. 이 판의 사냥터는 `StoryEras.Tier` 와 같은 넷(들판 · 비경 1~2층 · 3~4층 · 5층) — 달 열쇠 해시로 하나.
    /// </summary>
    public static class StoryMonthly
    {
        public const int Goal = 300;
        public const int GroundCount = 4;

        [Serializable]
        private class Store
        {
            public string key = "";
            public int kills;
            public List<string> badges = new List<string>();
        }

        private static Store _s = new Store();

        /// <summary>진단이 날짜를 박는다(null 이면 기기 날짜).</summary>
        public static DateTime? NowForTest;

        public static string KeyOf(DateTime d) => $"{d.Year:0000}-{d.Month:00}";
        public static string NowKey => KeyOf(NowForTest ?? DateTime.Now);

        /// <summary>달 열쇠 → 이달의 사냥터(0 들판 · 1 비경 1~2층 · 2 3~4층 · 3 5층). 같은 달은 늘 같다(FNV-1a).</summary>
        public static int FeaturedOf(string key)
        {
            uint h = 2166136261u;
            foreach (char c in key) { h ^= c; h *= 16777619u; }
            return (int)(h % GroundCount);
        }

        public static string GroundName(int g) => g switch
        {
            0 => StoryLocalization.T("monthly.ground0", "들판"),
            1 => StoryLocalization.T("monthly.ground1", "비경 1~2층"),
            2 => StoryLocalization.T("monthly.ground2", "비경 3~4층"),
            _ => StoryLocalization.T("monthly.ground3", "비경 5층"),
        };

        public static int Kills { get { Roll(); return _s.kills; } }
        public static IReadOnlyList<string> Badges => _s.badges;
        public static bool Done { get { Roll(); return _s.badges.Contains(_s.key); } }

        /// <summary>달이 바뀌었으면 셈만 새로(문장은 그대로).</summary>
        private static void Roll()
        {
            string k = NowKey;
            if (_s.key == k) return;
            _s.key = k;
            _s.kills = 0;
        }

        /// <summary>몹 하나 — ground = `StoryEras.Tier(비경 층)`(들판 0). 이 처치로 문장을 얻었으면 true.</summary>
        public static bool OnKill(int ground)
        {
            Roll();
            if (_s.badges.Contains(_s.key)) { _s.kills += ground == FeaturedOf(_s.key) ? 2 : 1; return false; }
            _s.kills += ground == FeaturedOf(_s.key) ? 2 : 1;
            if (_s.kills < Goal) return false;
            _s.badges.Add(_s.key);
            Earned?.Invoke(_s.key);
            return true;
        }

        public static event Action<string> Earned;

        /// <summary>세션 카드 한 줄 — "🌙 달 사명 2026-10 · 132/300 · 이달의 사냥터 비경 3~4층 ×2" / 채웠으면 "🌙 2026-10 달 문장 ✓".</summary>
        public static string Line()
        {
            Roll();
            if (_s.badges.Contains(_s.key))
                return string.Format(StoryLocalization.T("monthly.done", "🌙 {0} 달 문장 ✓ (모은 문장 {1})"), _s.key, _s.badges.Count);
            return string.Format(StoryLocalization.T("monthly.line", "🌙 달 사명 {0} · {1}/{2} · 이달의 사냥터 {3} ×2"),
                _s.key, Mathf.Min(_s.kills, Goal), Goal, GroundName(FeaturedOf(_s.key)));
        }

        public static string Snapshot() => JsonUtility.ToJson(_s);

        /// <summary>옛 세이브(null)는 빈 칸.</summary>
        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            if (_s.badges == null) _s.badges = new List<string>();
            if (_s.key == null) _s.key = "";
        }
    }
}
