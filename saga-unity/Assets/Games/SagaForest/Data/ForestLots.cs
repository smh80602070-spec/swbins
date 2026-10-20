using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Forest.Data
{
    /// <summary>
    /// tasks U-0127 입주 조건(웹 사가마을 W-0284 `lots.js`) — 제작대로 **작은 빈 집**(최대 셋)을 짓고 집 창고의 가구를 넣는다.
    /// 가구마다 태그(서재·악기·부엌·안방·뜰·바다·밤·별·길 — 웹 `LOT_TAGS` 그대로, 없으면 계열)가 있고, 한 집에 **서로 다른 태그 셋 이상**이면
    /// 그 태그를 둘 이상 좋아하는(웹 `LOT_LIKES`) 아직 안 눌러앉은 떠돌이 방문객이 **다음 날** 눌러앉는다 · 하루 한 명.
    /// 눌러앉기는 109-12-2 단골과 같은 명단(`ForestVisitors.SettleFromLot`) — 광장 곁 제자리·하루 선물·사연·이웃 평가가 그대로 붙는다.
    ///
    /// **이 트랙 다름**: 재료가 없어 짓는 값은 열매 <see cref="BuildFruit"/>(웹 솔 12·쇠 3·조각 2 ≈ 가구 화로 값). 웹 행사 가구(fest_*)·택배
    /// 상자(visit_parcel)가 없어 "길" 태그 가구는 아직 없다(여우는 부엌·서재로 온다). 웹 손님 둘(택배·사진)은 이 트랙엔 마을 사람이라 표에 없다.
    /// 날 바뀜은 <see cref="ForestVisitors.Today"/>(실제 날짜) — 처음 본 날을 적어 두고 날이 넘어가면 한 번 굴린다.
    /// </summary>
    public static class ForestLots
    {
        public const int MaxLots = 3, FurnMax = 6, NeedTags = 3, NeedLike = 2, BuildFruit = 15;

        private static readonly Dictionary<string, string> Tags = new Dictionary<string, string>
        {
            ["seoan"] = "study", ["jokja"] = "study", ["mungab"] = "study", ["badukpan"] = "study", ["byeongpung"] = "study", ["deungjan"] = "study",
            ["geomungo"] = "music",
            ["mulhang"] = "kitchen", ["hwaro"] = "kitchen", ["soban"] = "kitchen",
            ["bangseok"] = "rest", ["bandaji"] = "rest", ["dokja"] = "rest",
            ["hwabun"] = "garden", ["visit_bug"] = "garden",
            ["visit_sailor"] = "sea", ["visit_angler"] = "sea",
            ["visit_wisp"] = "night", ["visit_dokkaebi"] = "night",
            ["visit_future"] = "star", ["visit_alien"] = "star",
        };
        private static readonly Dictionary<string, string> TagKo = new Dictionary<string, string>
        {
            ["study"] = "서재", ["music"] = "악기", ["kitchen"] = "부엌", ["rest"] = "안방", ["garden"] = "뜰",
            ["sea"] = "바다", ["night"] = "밤", ["star"] = "별", ["road"] = "길",
        };
        private static readonly Dictionary<string, string[]> Likes = new Dictionary<string, string[]>
        {
            ["fox"] = new[] { "road", "kitchen", "study" }, ["sailor"] = new[] { "sea", "kitchen" }, ["wisp"] = new[] { "night", "music" },
            ["angler"] = new[] { "sea", "garden" }, ["bugdoc"] = new[] { "garden", "study" }, ["traveler"] = new[] { "star", "study" },
            ["dokkaebi"] = new[] { "night", "rest" }, ["alien"] = new[] { "star", "music" },
        };

        [Serializable]
        public class Lot
        {
            public List<string> furn = new List<string>();
            public string who = "";
        }

        [Serializable]
        private class Store { public List<Lot> lots = new List<Lot>(); public int rolled = int.MinValue; }

        private static Store _s = new Store();

        public static event Action Changed;
        public static IReadOnlyList<Lot> List => _s.lots;
        public static int Count => _s.lots.Count;

        /// <summary>tasks U-0144 — 그 손님이 좋아하는 태그(동반자 아침 선물). 없으면 빈 배열.</summary>
        public static string[] LikesOf(string key) => key != null && Likes.TryGetValue(key, out var l) ? l : new string[0];

        public static string TagOf(string furnId)
        {
            if (furnId != null && Tags.TryGetValue(furnId, out var t)) return t;
            var f = FurnitureItem.Get(furnId);
            return f != null ? f.Set.ToString().ToLowerInvariant() : null;
        }

        public static string TagName(string tag)
        {
            if (tag == null) return "";
            if (TagKo.TryGetValue(tag, out var ko)) return ForestLocalization.T("lot.tag." + tag, ko);
            return Enum.TryParse<FurnitureSet>(tag, true, out var set) ? FurnitureItem.SetName(set) : tag;
        }

        public static List<string> TagsOf(int i)
        {
            var o = new List<string>();
            if (i < 0 || i >= Count) return o;
            foreach (var k in _s.lots[i].furn) { var t = TagOf(k); if (t != null && !o.Contains(t)) o.Add(t); }
            return o;
        }

        // ---- 짓기·넣기·빼기 ----

        /// <summary>열매로 빈 집 하나 — 실패면 이유 키(lot.why_*), 되면 null.</summary>
        public static string Build()
        {
            if (Count >= MaxLots) return "lot.why_max";
            if (!ForestState.SpendFruit(BuildFruit)) return "lot.why_fruit";
            _s.lots.Add(new Lot());
            Touch();
            return null;
        }

        public static string Put(int i, string furnId)
        {
            if (i < 0 || i >= Count) return "lot.why_none";
            var lot = _s.lots[i];
            if (!string.IsNullOrEmpty(lot.who)) return "lot.why_lived";
            if (lot.furn.Count >= FurnMax) return "lot.why_full";
            if (!ForestHomeState.TakeStock(furnId)) return "lot.why_stock";
            lot.furn.Add(furnId);
            Touch();
            return null;
        }

        public static bool Take(int i, string furnId)
        {
            if (i < 0 || i >= Count) return false;
            var lot = _s.lots[i];
            if (!string.IsNullOrEmpty(lot.who) || !lot.furn.Remove(furnId)) return false;
            ForestHomeState.AddStock(furnId, 1);
            Touch();
            return true;
        }

        // ---- 누가 오나 ----

        /// <summary>집 i 에 가장 어울리는 아직 안 눌러앉은 손님(좋아하는 태그가 가장 많이 든) — 없으면 Key null.</summary>
        public static (string Key, int Score, List<string> Miss) MatchFor(int i)
        {
            var tags = TagsOf(i);
            string best = null; int bestScore = -1; List<string> bestMiss = null;
            foreach (var v in ForestVisitors.List)
            {
                if (ForestVisitors.IsSettled(v.Key) || !Likes.TryGetValue(v.Key, out var likes)) continue;
                int score = 0; var miss = new List<string>();
                foreach (var l in likes) { if (tags.Contains(l)) score++; else miss.Add(l); }
                if (score > bestScore) { best = v.Key; bestScore = score; bestMiss = miss; }
            }
            return (best, bestScore, bestMiss ?? new List<string>());
        }

        public static string ReadyFor(int i)
        {
            if (i < 0 || i >= Count || !string.IsNullOrEmpty(_s.lots[i].who) || TagsOf(i).Count < NeedTags) return null;
            var m = MatchFor(i);
            return m.Key != null && m.Score >= NeedLike ? m.Key : null;
        }

        /// <summary>날이 넘어갔으면 한 번 굴린다 — 조건 맞는 빈 집 하나에 손님이 눌러앉는다(하루 한 명). 눌러앉은 키(없으면 null).
        /// 처음 본 날은 적기만 한다(오늘 꾸민 집은 다음 날 찬다).</summary>
        public static string Tick(int today)
        {
            if (_s.rolled == int.MinValue) { _s.rolled = today; Touch(); return null; }
            if (today <= _s.rolled) return null;
            _s.rolled = today;
            string who = null;
            for (int i = 0; i < Count && who == null; i++)
            {
                string key = ReadyFor(i);
                if (key == null || !ForestVisitors.SettleFromLot(key)) continue;
                _s.lots[i].who = key;
                who = key;
            }
            Touch();
            return who;
        }

        /// <summary>창 한 줄 — 산다면 그 손님, 아니면 무엇이 모자라는지.</summary>
        public static string HintFor(int i)
        {
            if (i < 0 || i >= Count) return "";
            var lot = _s.lots[i];
            if (!string.IsNullOrEmpty(lot.who)) { var v = ForestVisitors.List[ForestVisitors.IndexOf(lot.who)]; return $"{v.Emoji} {ForestVisitors.Name(v)}"; }
            var m = MatchFor(i);
            if (m.Key == null) return ForestLocalization.T("lot.hint_none", "이제 올 손님이 없다");
            int n = TagsOf(i).Count;
            if (n < NeedTags) return string.Format(ForestLocalization.T("lot.hint_tags", "태그 {0}/{1} — 서로 다른 태그 가구를 더"), n, NeedTags);
            var mv = ForestVisitors.List[ForestVisitors.IndexOf(m.Key)];
            if (m.Score >= NeedLike) return string.Format(ForestLocalization.T("lot.hint_ready", "{0} {1} 이(가) 내일 눌러앉는다"), mv.Emoji, ForestVisitors.Name(mv));
            var miss = new List<string>();
            foreach (var t in m.Miss) miss.Add(TagName(t));
            return string.Format(ForestLocalization.T("lot.hint_like", "{0} {1} 이(가) 어울린다 — {2} 가구가 있으면"), mv.Emoji, ForestVisitors.Name(mv), string.Join("·", miss));
        }

        // ---- 저장 ----

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            if (_s.lots == null) _s.lots = new List<Lot>();
            if (_s.lots.Count > MaxLots) _s.lots.RemoveRange(MaxLots, _s.lots.Count - MaxLots);
            foreach (var l in _s.lots) { if (l.furn == null) l.furn = new List<string>(); if (l.who == null) l.who = ""; }
            Touch();
        }

        public static void ResetForTest() => Restore(null);

        private static void Touch() => Changed?.Invoke();
    }
}
