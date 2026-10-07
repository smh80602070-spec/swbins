using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-24 낚시(웹 사가만리 ⑲-24 `fishing.js` = saga-godot 106 ㊷ 규칙) — 표·판정(순수)·가방·조합.
    /// 낚시터 넷은 마을 남쪽 강의 북쪽 둑(남쪽은 산 절벽이라 딛는 땅이 없다) — 서는 자리에서 강 쪽(+Z)으로 물이 펼쳐진다.
    /// 물고기 여덟(과거·현대·미래가 한 물에)·미끼 셋(요리 재료 — `CookState` 가방)·조합(다리목 게시판).
    /// 웹 미터는 이 트랙에서 ×1.85(다른 ⑲ 조각과 같은 몸 크기 배율), 시간·수치(입질·줄다리기)는 웹 그대로.
    /// 흐름(던지기→입질→줄다리기)은 `FishingFlow`, 세이브는 `FishState`(가방·잡은 수·잡은 자리 시각 — 버전 그대로).
    /// </summary>
    public static class GoFishing
    {
        public const float Sc = 1.85f;
        public const int FishPerSpot = 5;
        public const long RespawnSec = 1800;

        // 서는 자리에서(m) — 웹 4·9·14
        public const float CastMin = 4f * Sc, CastMax = 14f * Sc, CastOff = 9f * Sc;
        public const float BiteR = 4f * Sc, SwimR = 5.5f * Sc, Swim = 1.2f * Sc, Approach = 1.6f * Sc, Arrive = 0.45f * Sc;
        public const float StandR = 3f * Sc, ReticleSpeed = 6f * Sc, BoardOff = 5f * Sc;
        public const int NibbleMin = 1, NibbleMax = 3;
        public const float NibbleGapMin = 0.7f, NibbleGapMax = 1.3f, BiteWindow = 1f, WaitMax = 15f, Scare = 8f;
        public const float PullAccel = 2.6f, PullVMax = 1.2f, ProgressStart = 0.3f, ZoneSpeed = 0.45f;
        /// <summary>물고기 그림자 크기 배율(웹 그림자 × 1.4).</summary>
        public const float ShadowScale = 1.4f;

        public struct Fish
        {
            public string Id, NameKo, Bait;
            public GoEra Era;
            public int Star;
            public float Zone, MoveMin, MoveMax, Gain, Loss, Len;
            public Color Color;
            public string Name => GoLocalization.T("fish.name." + Id, NameKo);
            public string Stars => new string('★', Star);
        }

        private static Fish F(string id, string ko, GoEra era, int star, string bait, float zone, float mv0, float mv1, float gain, float loss, float len, string hex)
        {
            ColorUtility.TryParseHtmlString(hex, out var c);
            return new Fish { Id = id, NameKo = ko, Era = era, Star = star, Bait = bait, Zone = zone, MoveMin = mv0, MoveMax = mv1, Gain = gain, Loss = loss, Len = len, Color = c };
        }

        /// <summary>웹 `FISH` 그대로(이름·시대·칸 너비·움직임·차오르는/줄어드는 빠르기).</summary>
        public static readonly Fish[] Fishes =
        {
            F("crucian", "은비늘 붕어", GoEra.Past, 1, "honey_flower", 0.28f, 1.0f, 1.6f, 0.34f, 0.16f, 0.45f, "#bfc7d1"),
            F("mandarin", "청하 쏘가리", GoEra.Modern, 2, "meat", 0.22f, 0.7f, 1.2f, 0.28f, 0.2f, 0.6f, "#9e8c4d"),
            F("clockcarp", "태엽 잉어", GoEra.Future, 3, "apple", 0.16f, 0.45f, 0.9f, 0.24f, 0.24f, 0.7f, "#d9b359"),
            F("gizzard", "갯바람 전어", GoEra.Past, 1, "honey_flower", 0.28f, 0.9f, 1.5f, 0.34f, 0.16f, 0.4f, "#99b8cc"),
            F("lanternpuffer", "등불 복어", GoEra.Modern, 2, "apple", 0.22f, 0.7f, 1.2f, 0.28f, 0.2f, 0.45f, "#ffcc66"),
            F("steelflounder", "강철 넙치", GoEra.Future, 2, "meat", 0.2f, 0.6f, 1.1f, 0.27f, 0.21f, 0.75f, "#8c99b3"),
            F("neonhairtail", "네온 갈치", GoEra.Future, 3, "meat", 0.15f, 0.4f, 0.8f, 0.24f, 0.25f, 1.1f, "#66f2ff"),
            F("moonjelly", "옛 달 해파리", GoEra.Past, 3, "apple", 0.17f, 0.5f, 0.9f, 0.25f, 0.24f, 0.5f, "#d9ccff"),
        };

        public static bool TryFish(string id, out Fish f)
        {
            foreach (var x in Fishes) if (x.Id == id) { f = x; return true; }
            f = default;
            return false;
        }

        public static Fish FishOf(string id) => TryFish(id, out var f) ? f : Fishes[0];

        /// <summary>미끼 = 요리 재료 id(`GoCooking.Items`).</summary>
        public static readonly string[] Baits = { "honey_flower", "apple", "meat" };

        public static string BaitName(string id) => string.Format(GoLocalization.T("fish.bait", "{0} 미끼"), GoCooking.ItemName(id));

        public sealed class Spot
        {
            public string Id, NameKo;
            /// <summary>서는 자리(물가 땅, XZ) · 물 쪽 단위 방향(+Z) · 던지는 물 가운데.</summary>
            public Vector2 Stand, Dir, Cast;
            public string[] Fish;
            public bool Board;
            /// <summary>게시판 자리(서는 자리 뒤쪽 뭍) — Board 인 낚시터만.</summary>
            public Vector2 BoardPos;
            public string Name => GoLocalization.T("fish.spot." + Id, NameKo);
        }

        /// <summary>강 북쪽 둑(모든 낚시터 공통) — 서는 자리는 둑에서 2.5m 안쪽 땅.</summary>
        public static float StandZ => TestMapData.WorldPos(0f, 4.5f).z - 2.5f;

        private static Spot MakeSpot(string id, string ko, float gx, string[] fish, bool board = false)
        {
            float x = TestMapData.WorldPos(gx, 0f).x;
            var stand = new Vector2(x, StandZ);
            var dir = new Vector2(0f, 1f);
            var s = new Spot { Id = id, NameKo = ko, Stand = stand, Dir = dir, Cast = stand + dir * CastOff, Fish = fish, Board = board };
            if (board) s.BoardPos = stand - dir * BoardOff;
            return s;
        }

        private static Spot[] _spots;

        /// <summary>낚시터 넷(웹 순서 — 강가 둘·물목 둘). 서는 자리는 칸 가운데 gx 기준이라 지도가 같으면 늘 같다.</summary>
        public static Spot[] Spots => _spots ?? (_spots = new[]
        {
            MakeSpot("river_w", "서쪽 둑 낚시터", 1f, new[] { "crucian", "crucian", "mandarin", "mandarin", "clockcarp" }),
            MakeSpot("dock", "다리목 낚시터", 2.3f, new[] { "gizzard", "gizzard", "lanternpuffer", "steelflounder", "neonhairtail" }, board: true),
            MakeSpot("rift", "시간 틈 물목 낚시터", 4f, new[] { "gizzard", "lanternpuffer", "lanternpuffer", "steelflounder", "moonjelly" }),
            MakeSpot("river_e", "동쪽 둑 낚시터", 5f, new[] { "crucian", "crucian", "crucian", "mandarin", "clockcarp" }),
        });

        public static bool TrySpot(string id, out Spot s)
        {
            foreach (var x in Spots) if (x.Id == id) { s = x; return true; }
            s = null;
            return false;
        }

        public static Spot BoardSpot()
        {
            foreach (var s in Spots) if (s.Board) return s;
            return null;
        }

        /// <summary>낚시터에서 이 안이면 "곁"(서는 자리 기준).</summary>
        public static Spot NearSpot(Vector2 p)
        {
            Spot best = null;
            float bd = StandR;
            foreach (var s in Spots)
            {
                float d = Vector2.Distance(s.Stand, p);
                if (d <= bd) { bd = d; best = s; }
            }
            return best;
        }

        public static bool NearBoard(Vector2 p)
        {
            var b = BoardSpot();
            return b != null && Vector2.Distance(b.BoardPos, p) <= StandR;
        }

        // ---- 판정(순수) ----

        /// <summary>물인가 — 강 칸(`~`)만(다리 칸 `B` 는 널판 위라 물고기가 없다).</summary>
        public static bool WetAt(float x, float z)
        {
            var (gx, gy) = TestMapData.WorldToGrid(new Vector3(x, 0f, z));
            return TestMapData.TileAt(gx, gy) == '~';
        }

        public static bool WetAt(Vector2 p) => WetAt(p.x, p.y);

        /// <summary>고리를 서는 자리에서 CastMin~CastMax 로 조이고, 물이 아니면 prev 그대로.</summary>
        public static Vector2 ClampReticle(Spot s, Vector2 want, Vector2 prev)
        {
            Vector2 v = want - s.Stand;
            float d = Mathf.Max(v.magnitude, 1e-6f);
            Vector2 q = s.Stand + v * (Mathf.Clamp(d, CastMin, CastMax) / d);
            return WetAt(q) ? q : prev;
        }

        public static bool InZone(float cursor, float center, float width) => Mathf.Abs(cursor - center) <= width * 0.5f;

        // ---- 낚시 조합(다리목 게시판) ----

        public struct Row
        {
            public string Id, NameKo, Weapon;
            public (string fish, int n)[] Cost;
            public int Gold, Ore;
            public int[] Mats;
            public string Name => GoLocalization.T("fish.row." + Id, NameKo);
        }

        /// <summary>웹 `EXCHANGE`(작살 atk 41 · 금 800 · 쪽지 2 · 강화석 3 · 매듭 1).</summary>
        public static readonly Row[] Exchange =
        {
            new Row { Id = "catch_spear", NameKo = "갯바람 작살(★4 창)", Cost = new[] { ("gizzard", 6), ("lanternpuffer", 3), ("steelflounder", 2) }, Weapon = "w_polearm_catch" },
            new Row { Id = "gold", NameKo = "금 800", Cost = new[] { ("crucian", 3) }, Gold = 800 },
            new Row { Id = "gold_sea", NameKo = "금 800", Cost = new[] { ("gizzard", 3) }, Gold = 800 },
            new Row { Id = "note", NameKo = "무예 쪽지 2", Cost = new[] { ("mandarin", 2) }, Mats = new[] { 2, 0, 0, 0, 0 } },
            new Row { Id = "ore", NameKo = "강화석 3", Cost = new[] { ("clockcarp", 1) }, Ore = 3 },
            new Row { Id = "knot", NameKo = "인연 매듭 1", Cost = new[] { ("neonhairtail", 1), ("moonjelly", 1) }, Mats = new[] { 0, 0, 0, 1, 0 } },
        };
    }

    /// <summary>
    /// 낚시 가방·기록(웹 `save.fish = { bag, log, gone }`) — 가방(잡은 물고기)·log(누적 잡은 수)·gone(잡은 자리 시각, 30분 뒤 다시).
    /// 세이브 `fishBag`·`fishLog`·`fishGone`(버전 그대로 — 옛 세이브는 빈 채). 물고기 자리·입질 상태는 이번 판만.
    /// </summary>
    public static class FishState
    {
        private static readonly Dictionary<string, int> _bag = new Dictionary<string, int>();
        private static readonly Dictionary<string, int> _log = new Dictionary<string, int>();
        private static readonly Dictionary<string, long> _gone = new Dictionary<string, long>();
        public static event System.Action Changed;
        /// <summary>잡았다(물고기 id) — 이야기·일과 임무가 이어 쓸 자리.</summary>
        public static event System.Action<string> Caught;

        private static void Touch() => Changed?.Invoke();
        private static string Key(string spot, int idx) => spot + "_" + idx;

        public static int Count(string id) => _bag.TryGetValue(id, out int n) ? n : 0;
        public static int LogOf(string id) => _log.TryGetValue(id, out int n) ? n : 0;
        public static int Total() { int t = 0; foreach (var kv in _bag) t += kv.Value; return t; }

        public static bool Present(string spot, int idx) =>
            !_gone.TryGetValue(Key(spot, idx), out long t) || CookState.Now - t >= GoFishing.RespawnSec;

        public static int Left(string spot)
        {
            int n = 0;
            for (int i = 0; i < GoFishing.FishPerSpot; i++) if (Present(spot, i)) n++;
            return n;
        }

        /// <summary>잡았다 — 가방·기록·잡은 자리. 처음 잡은 물고기면 true.</summary>
        public static bool Catch(string spot, int idx, string fish)
        {
            bool first = LogOf(fish) == 0;
            _bag[fish] = Count(fish) + 1;
            _log[fish] = LogOf(fish) + 1;
            _gone[Key(spot, idx)] = CookState.Now;
            Touch();
            Caught?.Invoke(fish);
            return first;
        }

        /// <summary>바꿀 수 있나 — 물고기 값·무기(이미 울림 끝이면 못 받음).</summary>
        public static bool CanExchange(int i, out string why)
        {
            why = null;
            if (i < 0 || i >= GoFishing.Exchange.Length) { why = GoLocalization.T("fish.why.none", "없는 조합"); return false; }
            var row = GoFishing.Exchange[i];
            foreach (var (fish, n) in row.Cost)
                if (Count(fish) < n) { why = string.Format(GoLocalization.T("fish.why.lack", "{0} 부족"), GoFishing.FishOf(fish).Name); return false; }
            if (row.Weapon != null && WeaponState.Owned(row.Weapon) && WeaponState.RecOf(row.Weapon).refine >= GoWeapons.RefineMax)
            { why = GoLocalization.T("fish.why.maxed", "이 작살은 울림이 끝났다"); return false; }
            return true;
        }

        /// <summary>바꾼다 — 받은 것 글(못 바꾸면 빈 글).</summary>
        public static string Exchange(int i)
        {
            if (!CanExchange(i, out _)) return "";
            var row = GoFishing.Exchange[i];
            foreach (var (fish, n) in row.Cost)
            {
                _bag[fish] -= n;
                if (_bag[fish] <= 0) _bag.Remove(fish);
            }
            var got = new List<string>();
            if (row.Weapon != null) got.Add(WeaponState.Give(row.Weapon));
            if (row.Gold > 0) { GoldState.Add(row.Gold); got.Add(string.Format(GoLocalization.T("fish.got_gold", "금 +{0}"), row.Gold)); }
            if (row.Ore > 0) { WeaponState.AddOre(row.Ore); got.Add(string.Format(GoLocalization.T("fish.got_ore", "강화석 +{0}"), row.Ore)); }
            if (row.Mats != null) { string t = TalentState.Add(row.Mats); if (t.Length > 0) got.Add(t); }
            Touch();
            return string.Join(" · ", got);
        }

        // ---- 세이브 ----

        public static List<CookState.Entry> SnapshotBag() => Snap(_bag);
        public static List<CookState.Entry> SnapshotLog() => Snap(_log);

        private static List<CookState.Entry> Snap(Dictionary<string, int> d)
        {
            var l = new List<CookState.Entry>();
            foreach (var kv in d) l.Add(new CookState.Entry { id = kv.Key, n = kv.Value });
            l.Sort((a, b) => string.CompareOrdinal(a.id, b.id));
            return l;
        }

        /// <summary>다시 나온 자리(30분 지난)는 안 적는다(세이브가 끝없이 안 커지게).</summary>
        public static List<CookState.TimeEntry> SnapshotGone()
        {
            var l = new List<CookState.TimeEntry>();
            foreach (var kv in _gone) if (CookState.Now - kv.Value < GoFishing.RespawnSec) l.Add(new CookState.TimeEntry { id = kv.Key, t = kv.Value });
            l.Sort((a, b) => string.CompareOrdinal(a.id, b.id));
            return l;
        }

        /// <summary>불러오기·새 게임·진단 — 없으면(옛 세이브) 빈 채.</summary>
        public static void Restore(List<CookState.Entry> bag, List<CookState.Entry> log, List<CookState.TimeEntry> gone)
        {
            _bag.Clear();
            _log.Clear();
            _gone.Clear();
            if (bag != null) foreach (var e in bag) if (GoFishing.TryFish(e.id, out _) && e.n > 0) _bag[e.id] = e.n;
            if (log != null) foreach (var e in log) if (GoFishing.TryFish(e.id, out _) && e.n > 0) _log[e.id] = e.n;
            if (gone != null) foreach (var e in gone) if (!string.IsNullOrEmpty(e.id)) _gone[e.id] = e.t;
            Touch();
        }

        public static void ResetForTest() => Restore(null, null, null);
    }
}
