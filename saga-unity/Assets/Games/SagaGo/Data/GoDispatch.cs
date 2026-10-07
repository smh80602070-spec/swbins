using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-26 탐사 파견(웹 사가만리 ⑲-26 `dispatch.js` = saga-godot 106 ㊹) — 들판 명단 밖 동료를 몇 시간 보내 재료를 받는다.
    /// 시간 4·8·12·20시간(이 기기 실제 시각 — 꺼 둔 동안도 흐른다) × 배율 1·1.8·2.5·3.8(반올림·최소 1) · 자리 = 여정 등급 1·1·5·10·15 이상인 칸 수(2~5) ·
    /// 탐사지 하나에 한 명 · 잘 맞는 원소면 보상 +25%(올림) · 부르면 보상 없이 돌아옴 · 다 되면 받기·모두 받기.
    /// 게시판은 역참마다 솥 반대편(서쪽 6.5m, 반경 7.4m — 웹 3.5·4m × 1.85). 탐사지 여덟은 웹 이름·보상 그대로, 땅만 이 판의 지역으로
    /// (마을 들판 둘 = 늘 열림 · 너른 강 둘 · 남쪽 공터 둘 · 북쪽 산기슭 둘 — 그 지역에 발 디디면 열림). 눈꽃(웹 서리봉 특산)은 이 판에 없어 청하란으로.
    /// 단사 = 연마석. 세이브 `dispOut`·`dispDone`(버전 그대로 — 옛 세이브는 빈 채).
    /// </summary>
    public static class GoDispatch
    {
        public static readonly int[] Hours = { 4, 8, 12, 20 };
        public static readonly float[] Mul = { 1f, 1.8f, 2.5f, 3.8f };
        public static readonly int[] SlotRank = { 1, 1, 5, 10, 15 };
        public const float FitBonus = 0.25f;
        public const float BoardOffset = 6.5f, BoardRadius = 7.4f;

        public struct Reward
        {
            public int Gold, Ore, Dust;
            public List<(string item, int n)> Items;
        }

        public sealed class Site
        {
            public string Id, NameKo, DescKo, Region;
            public GoEra Era;
            public GoElement El;
            /// <summary>109-14-32 서리봉 고원 탐사지 — 고원 어귀 경계비를 찾아야 열린다(지역 표기도 고원).</summary>
            public bool Frost;
            public int Gold, Ore, Dust;
            public (string item, int n)[] Items;
            public string Name => GoLocalization.T("dispatch.site." + Id, NameKo);
            /// <summary>잠김 글·줄 머리에 쓰는 땅 이름 — 고원 탐사지는 서리봉 고원.</summary>
            public string Place => GoWorldMap.RegionName(Frost ? GoFrost.RegionId : Region);
            public string Desc => GoLocalization.T("dispatch.desc." + Id, DescKo);
        }

        private static Site S(string id, string name, string region, GoEra era, GoElement el, string desc, int gold = 0, int ore = 0, int dust = 0, bool frost = false, params (string, int)[] items) =>
            new Site { Id = id, NameKo = name, Region = region, Era = era, El = el, DescKo = desc, Gold = gold, Ore = ore, Dust = dust, Items = items, Frost = frost };

        /// <summary>웹 `SITES` 순서·이름·보상 그대로(땅만 이 판 지역).</summary>
        public static readonly Site[] Sites =
        {
            S("old_road", "옛 역참 길", "village", GoEra.Past, GoElement.Anemo, "옛 파발꾼이 달리던 길을 살핀다", gold: 400),
            S("forest_edge", "북쪽 숲 가장자리", "village", GoEra.Past, GoElement.Dendro, "숲 가장자리에서 들풀을 캔다", items: new[] { ("mint", 2), ("mushroom", 1) }),
            S("mudflat", "갯벌 선창", "river", GoEra.Modern, GoElement.Hydro, "물 빠진 선창에서 조개를 줍는다", items: new[] { ("clam", 3) }),
            S("shipyard", "녹슨 조선소", "river", GoEra.Modern, GoElement.Pyro, "버려진 조선소에서 쓸 만한 쇠를 고른다", ore: 2),
            S("quarry", "잿빛 채석장", "south_glade", GoEra.Past, GoElement.Geo, "옛 채석장 돌무더기를 뒤진다", ore: 1, items: new[] { ("meat", 1) }),
            S("observatory", "시간 틈 관측소", "south_glade", GoEra.Future, GoElement.Electro, "틈 곁 관측소의 기록을 거둔다", ore: 1, dust: 3),
            S("snow_fort", "얼음 아래 산성 터", "north_foot", GoEra.Past, GoElement.Cryo, "얼어붙은 산성 터 밑 곳간을 더듬는다", ore: 1, items: new[] { ("mushroom", 2), ("snow_bloom", 1) }, frost: true),
            S("ship_wreck", "추락한 비행선 잔해", "north_foot", GoEra.Future, GoElement.Anemo, "눈에 묻힌 비행선 잔해에서 쓸 만한 것을 건진다", ore: 2, dust: 1, items: new[] { ("snow_bloom", 1) }, frost: true),
        };

        public static bool TrySite(string id, out Site s)
        {
            foreach (var x in Sites) if (x.Id == id) { s = x; return true; }
            s = null;
            return false;
        }

        // ---- 판정(순수) ----

        public static int SlotsFor(int rank)
        {
            int n = 0;
            foreach (int r in SlotRank) if (Mathf.Max(1, rank) >= r) n++;
            return n;
        }

        public static float MulOf(int hours)
        {
            int i = System.Array.IndexOf(Hours, hours);
            return i >= 0 ? Mul[i] : 0f;
        }

        private static int Scale(int v, float m, bool fit)
        {
            int n = Mathf.Max(1, Mathf.RoundToInt(v * m));
            return fit ? Mathf.CeilToInt(n * (1f + FitBonus)) : n;
        }

        public static Reward RewardOf(Site s, int hours, bool fit)
        {
            var r = new Reward { Items = new List<(string, int)>() };
            float m = MulOf(hours);
            if (s == null || m <= 0f) return r;
            if (s.Gold > 0) r.Gold = Scale(s.Gold, m, fit);
            if (s.Ore > 0) r.Ore = Scale(s.Ore, m, fit);
            if (s.Dust > 0) r.Dust = Scale(s.Dust, m, fit);
            foreach (var (item, n) in s.Items) r.Items.Add((item, Scale(n, m, fit)));
            return r;
        }

        public static bool Fits(Site s, string heroId) => s != null && GoElements.ForMember(heroId) == s.El;

        public static string RewardText(Reward r)
        {
            var p = new List<string>();
            if (r.Gold > 0) p.Add(string.Format(GoLocalization.T("dispatch.r_gold", "금 {0}"), r.Gold));
            foreach (var (item, n) in r.Items) p.Add($"{GoCooking.ItemName(item)} {n}");
            if (r.Ore > 0) p.Add(string.Format(GoLocalization.T("dispatch.r_ore", "강화석 {0}"), r.Ore));
            if (r.Dust > 0) p.Add(string.Format(GoLocalization.T("dispatch.r_dust", "연마석 {0}"), r.Dust));
            return string.Join(" · ", p);
        }

        public static string TimeText(long sec)
        {
            long m = (sec + 59) / 60;
            return m >= 60 ? string.Format(GoLocalization.T("dispatch.hm", "{0}시간 {1}분"), m / 60, m % 60) : string.Format(GoLocalization.T("dispatch.m", "{0}분"), m);
        }

        // ---- 게시판 ----

        public static Vector3 BoardPos(GoWorldMap.Waypoint w) => GoWorldMap.WaypointPos(w) - Vector3.right * BoardOffset;

        /// <summary>발 자리가 어느 게시판 반경 안이면 그 역참(없으면 null).</summary>
        public static string BoardNear(Vector3 feet)
        {
            foreach (var w in GoWorldMap.Waypoints)
            {
                Vector3 d = BoardPos(w) - feet;
                d.y = 0f;
                if (d.magnitude <= BoardRadius) return w.Id;
            }
            return null;
        }
    }

    /// <summary>탐사 진행(웹 `save.dispatch = { out, done }`) — 나간 이(탐사지마다 동료·시간·시작 유닉스 초)·끝낸 수.</summary>
    public static class DispatchState
    {
        [System.Serializable]
        public struct Entry { public string site, hero; public int hours; public long start; }

        private static readonly Dictionary<string, Entry> _out = new Dictionary<string, Entry>();
        private static readonly HashSet<string> _notified = new HashSet<string>();
        private static bool _first = true;
        public static int Done { get; private set; }
        public static event System.Action Changed;

        public static int Slots => GoDispatch.SlotsFor(AdventureState.Rank);
        public static int Used => _out.Count;
        public static bool IsOut(string site) => _out.ContainsKey(site);
        public static bool TryOut(string site, out Entry e) => _out.TryGetValue(site, out e);

        /// <summary>탐사 중인 동료가 나간 탐사지(아니면 null) — 편성이 못 넣게 묻는다.</summary>
        public static string Away(string hero)
        {
            foreach (var kv in _out) if (kv.Value.hero == hero) return kv.Key;
            return null;
        }

        /// <summary>그 지역에 발 디뎠나(마을 들판은 늘).</summary>
        public static bool Open(GoDispatch.Site s) => s.Frost ? FrostState.Found("stele") : s.Region == "village" || WorldMapState.IsVisited(s.Region); // 109-14-32 고원 탐사지는 경계비를 밟아야

        /// <summary>남은 초(0 이면 다 됨), 안 나간 곳은 −1.</summary>
        public static long Left(string site) => _out.TryGetValue(site, out var e) ? System.Math.Max(0, e.start + e.hours * 3600L - CookState.Now) : -1;

        public static List<string> DoneList()
        {
            var l = new List<string>();
            foreach (var s in GoDispatch.Sites) if (Left(s.Id) == 0) l.Add(s.Id);
            return l;
        }

        /// <summary>보낼 수 있는 동료 — 도감 인물 · 들판 명단 밖(벤치) · 안 나감.</summary>
        public static List<string> Candidates()
        {
            var l = new List<string>();
            foreach (var id in PartyState.MemberIds)
                if (GoHeroes.TryGet(id, out _) && PartyState.FieldSlotOf(id) < 0 && Away(id) == null && !l.Contains(id)) l.Add(id);
            return l;
        }

        public static string SendCheck(string site, string hero, int hours, bool atBoard)
        {
            if (!GoDispatch.TrySite(site, out var s)) return GoLocalization.T("dispatch.why.nosite", "없는 탐사지");
            if (!atBoard) return GoLocalization.T("dispatch.why.board", "역참 곁 게시판에서만");
            if (!Open(s)) return string.Format(GoLocalization.T("dispatch.why.locked", "{0} 을(를) 밟아야 열린다"), s.Place);
            if (_out.ContainsKey(site)) return GoLocalization.T("dispatch.why.taken", "이미 누가 가 있다");
            if (Used >= Slots) return GoLocalization.T("dispatch.why.full", "자리가 꽉 찼다(여정 등급을 올리면 는다)");
            if (System.Array.IndexOf(GoDispatch.Hours, hours) < 0) return GoLocalization.T("dispatch.why.hours", "시간을 고르자");
            if (string.IsNullOrEmpty(hero)) return GoLocalization.T("dispatch.why.hero", "동료를 고르자");
            if (!PartyState.Has(hero) || !GoHeroes.TryGet(hero, out _)) return GoLocalization.T("dispatch.why.nohero", "없는 동료");
            if (PartyState.FieldSlotOf(hero) >= 0) return GoLocalization.T("dispatch.why.field", "들판 명단에 있는 동료는 못 보낸다");
            if (Away(hero) != null) return GoLocalization.T("dispatch.why.away", "이미 탐사 중");
            return null;
        }

        /// <summary>보낸다 — 못 하면 까닭, 됐으면 null.</summary>
        public static string Send(string site, string hero, int hours, bool atBoard)
        {
            string why = SendCheck(site, hero, hours, atBoard);
            if (why != null) return why;
            _out[site] = new Entry { site = site, hero = hero, hours = hours, start = CookState.Now };
            _notified.Remove(site);
            Changed?.Invoke();
            return null;
        }

        /// <summary>부른다 — 보상 없이 돌아온다.</summary>
        public static string Recall(string site, bool atBoard)
        {
            if (!_out.ContainsKey(site)) return GoLocalization.T("dispatch.why.none_out", "나간 이가 없다");
            if (!atBoard) return GoLocalization.T("dispatch.why.board", "역참 곁 게시판에서만");
            _out.Remove(site);
            Changed?.Invoke();
            return null;
        }

        /// <summary>받는다 — 다 된 탐사 하나. 받은 글(못 받으면 null, why 에 까닭).</summary>
        public static string Claim(string site, bool atBoard, out string why)
        {
            why = null;
            if (!_out.TryGetValue(site, out var e)) { why = GoLocalization.T("dispatch.why.none_out", "나간 이가 없다"); return null; }
            if (!atBoard) { why = GoLocalization.T("dispatch.why.board", "역참 곁 게시판에서만"); return null; }
            if (Left(site) > 0) { why = GoLocalization.T("dispatch.why.still", "아직 탐사 중"); return null; }
            GoDispatch.TrySite(site, out var s);
            var r = GoDispatch.RewardOf(s, e.hours, GoDispatch.Fits(s, e.hero));
            if (r.Gold > 0) GoldState.Add(r.Gold);
            if (r.Ore > 0) WeaponState.AddOre(r.Ore);
            if (r.Dust > 0) ArtifactState.AddPolish(r.Dust);
            foreach (var (item, n) in r.Items) CookState.Add(item, n);
            _out.Remove(site);
            Done++;
            Changed?.Invoke();
            return GoDispatch.RewardText(r);
        }

        public static int ClaimAll(bool atBoard)
        {
            int n = 0;
            foreach (var id in DoneList()) if (Claim(id, atBoard, out _) != null) n++;
            return n;
        }

        // ---- 알림 ----

        /// <summary>새로 다 된 탐사 알림 글 — 불러온 직후 첫 확인은 모아 한 줄.</summary>
        public static List<string> Check()
        {
            var fresh = new List<string>();
            foreach (var id in DoneList()) if (_notified.Add(id)) fresh.Add(id);
            var outl = new List<string>();
            if (fresh.Count == 0) { _first = false; return outl; }
            if (_first) outl.Add(string.Format(GoLocalization.T("dispatch.notice_all", "탐사 {0}곳이 끝났다 — 역참 게시판에서 받기"), fresh.Count));
            else
                foreach (var id in fresh)
                {
                    GoDispatch.TrySite(id, out var s);
                    GoHeroes.TryGet(_out[id].hero, out var h);
                    outl.Add(string.Format(GoLocalization.T("dispatch.notice", "{0} — {1} 탐사 끝 (역참 게시판에서 받기)"), GoHeroes.Name(h), s.Name));
                }
            _first = false;
            return outl;
        }

        // ---- 세이브 ----

        public static List<Entry> Snapshot()
        {
            var l = new List<Entry>(_out.Values);
            l.Sort((a, b) => string.CompareOrdinal(a.site, b.site));
            return l;
        }

        /// <summary>불러오기·새 게임·진단 — 없으면(옛 세이브) 빈 채. 알림은 "첫 확인"으로 돌아간다.</summary>
        public static void Restore(List<Entry> list, int done)
        {
            _out.Clear();
            _notified.Clear();
            _first = true;
            Done = Mathf.Max(0, done);
            if (list != null)
                foreach (var e in list)
                    if (GoDispatch.TrySite(e.site, out _) && !string.IsNullOrEmpty(e.hero) && System.Array.IndexOf(GoDispatch.Hours, e.hours) >= 0 && !_out.ContainsKey(e.site)) _out[e.site] = e;
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null, 0);
    }
}
