using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// tasks U-0096 — 웹 사가만리 W-0101 "사냥 의뢰"(`js/track.js`, 몬헌의 추적→사냥→소재)의 이 트랙 판. 순수 데이터(날짜는 <see cref="NowFn"/> 주입).
    /// 길에 **흔적** 여섯 종이 60m 칸 해시로 늘 같은 자리에 깔린다(웹 값 그대로 — 칸 60·흔들림 20·문턱 0.55·물·산·마을·가장자리 칸이면 세 번 다시 굴림).
    /// 하루(새벽 4시에 갈림)에 흔적 셋을 읽으면 **오늘의 큰 짐승** = 마지막 흔적에서 가장 가까운 들판 보스(이 트랙엔 망루 수호장·서리 곰왕 둘뿐 —
    /// 웹 "그 바이옴 수호자" 자리를 "가장 가까운 보스" 로)가 정해지고, 그 보스를 쓰러뜨리면(또는 이미 꽃이 핀 그 보스를 다시 쓰러뜨리면) 강화석 +2·의뢰 끝.
    /// 하루 한 번. 웹의 부위 파괴·가루는 이 트랙에 없어 강화석 하나로 합쳤다. 세이브 `trackDay`·`trackRead`·`trackBoss`·`trackDone`(버전 그대로).
    /// </summary>
    public static class GoTrack
    {
        public const float Cell = 60f, Jit = 20f, ReadR = 10f, Share = 0.55f;
        public const int Need = 3, HuntOre = 2, NightTo = 4;
        public static Func<DateTime> NowFn = () => DateTime.Now;

        public enum Kind { Foot, Claw, Feather, Graze, Wade, Twig }
        public static readonly string[] KindEmoji = { "🐾", "🪵", "🪶", "🌿", "💧", "🌾" };
        public static readonly string[] KindName = { "발자국", "긁힌 나무", "깃털", "뜯긴 풀", "물가 발자국", "부러진 가지" };

        /// <summary>지역 → 흔적 두 종(웹 BY_BIOME 결 — 숲은 긁힌 나무·깃털, 강가는 물가 발자국…).</summary>
        private static readonly Dictionary<string, Kind[]> ByRegion = new Dictionary<string, Kind[]>
        {
            { "west_wood", new[] { Kind.Claw, Kind.Feather } },
            { "east_grove", new[] { Kind.Feather, Kind.Twig } },
            { "north_foot", new[] { Kind.Foot, Kind.Claw } },
            { "river", new[] { Kind.Wade, Kind.Foot } },
            { "south_glade", new[] { Kind.Foot, Kind.Graze } },
            { "farmland", new[] { Kind.Graze, Kind.Twig } },
            { GoFrost.RegionId, new[] { Kind.Foot, Kind.Claw } },   // tasks U-0103 서리봉 고원 — 곰(웹 바이옴엔 눈밭이 없어 이 트랙 몫)
        };

        public struct Trace { public string Key; public Vector3 Pos; public Kind Kind; public string Region; }

        public const string BossGuardian = "guardian", BossFrost = "frost";

        private static List<Trace> _all;
        public static string Day { get; private set; } = "";
        private static readonly HashSet<string> _read = new HashSet<string>();
        public static string Boss { get; private set; }
        public static bool Done { get; private set; }
        public static event Action Changed;

        public static int ReadCount { get { Roll(); return _read.Count; } }
        public static bool IsRead(string key) { Roll(); return _read.Contains(key); }

        public static string DayKey(DateTime t) => t.AddHours(-NightTo).ToString("yyyy-MM-dd");

        /// <summary>날이 바뀌었으면 읽은 흔적·의뢰를 비운다.</summary>
        public static void Roll()
        {
            string today = DayKey(NowFn());
            if (today == Day) return;
            Day = today;
            _read.Clear();
            Boss = null;
            Done = false;
            Changed?.Invoke();
        }

        /// <summary>결정적 해시 0~1(웹 h3 와 같은 소수 — `VegetationBuilder.Hash` 와 같은 식, 데이터 쪽에 둔다).</summary>
        public static float Hash(int a, int b, int salt)
        {
            unchecked
            {
                long h = ((long)a * 374761393) ^ ((long)b * 668265263) ^ ((long)salt * 2246822519);
                h = (h ^ (h >> 13)) * 1274126177;
                h ^= h >> 16;
                return (h & 0x7fffffffL) / (float)0x7fffffff;
            }
        }

        /// <summary>흔적을 놓을 수 있는 땅 — 지도 안·가장자리 아님·물·산·마을 아님.</summary>
        public static bool Placeable(Vector3 p)
        {
            var (gx, gy) = TestMapData.WorldToGrid(p);
            if (gx < 0 || gy < 0 || gx >= TestMapData.Cols || gy >= TestMapData.RowCount) return false;
            if (TestMapData.IsBorder(gx, gy)) return false;
            char t = TestMapData.TileAt(gx, gy);
            if (TestMapData.IsWater(t) || t == '^' || t == 'H') return false;
            return GoWorldMap.RegionAt(gx, gy) != "village";
        }

        /// <summary>tasks U-0103 — 서리봉 고원(글자 지도 밖 독립 눈밭 `GoFrost`)에서 흔적을 놓을 땅: 가장자리 24m 안쪽 · 명소 반지름 +6m 밖 ·
        /// 곰왕 20m 밖 · 경계비 10m 밖(웹 놓을 땅 결 — 길목·볼거리 위엔 안 깐다).</summary>
        public const float FrostEdge = 24f;
        public static bool PlaceableFrost(Vector3 p)
        {
            var c = GoFrost.Center;
            if (Mathf.Abs(p.x - c.x) > GoFrost.HalfX - FrostEdge || Mathf.Abs(p.z - c.z) > GoFrost.HalfZ - FrostEdge) return false;
            foreach (var s in GoFrost.Sites) if (Flat(p, s.Pos) < GoFrost.RadiusOf(s) + 6f) return false;
            if (Flat(p, GoFrost.KingHome) < 20f || Flat(p, GoFrost.SteleGround) < 10f) return false;
            return true;
        }

        private static float Flat(Vector3 a, Vector3 b) => new Vector2(a.x - b.x, a.z - b.z).magnitude;

        /// <summary>지도 위 흔적 전부(늘 같다). 마을 지도 칸이 먼저, 그 뒤 서리봉 고원 칸(키 `f` 접두, U-0103).</summary>
        public static IReadOnlyList<Trace> All
        {
            get
            {
                if (_all != null) return _all;
                _all = new List<Trace>();
                var lo = TestMapData.WorldPos(-0.5f, -0.5f);
                var hi = TestMapData.WorldPos(TestMapData.Cols - 0.5f, TestMapData.RowCount - 0.5f);
                float x0 = Mathf.Min(lo.x, hi.x), x1 = Mathf.Max(lo.x, hi.x), z0 = Mathf.Min(lo.z, hi.z), z1 = Mathf.Max(lo.z, hi.z);
                int cx0 = Mathf.FloorToInt(x0 / Cell), cx1 = Mathf.FloorToInt(x1 / Cell), cz0 = Mathf.FloorToInt(z0 / Cell), cz1 = Mathf.FloorToInt(z1 / Cell);
                for (int cx = cx0; cx <= cx1; cx++)
                    for (int cz = cz0; cz <= cz1; cz++)
                    {
                        if (Hash(cx, cz, 17) >= Share) continue;
                        for (int k = 0; k < 3; k++)
                        {
                            var p = new Vector3((cx + 0.5f) * Cell + (Hash(cx, cz, 23 + 100 * k) * 2f - 1f) * Jit, 0f,
                                                (cz + 0.5f) * Cell + (Hash(cx, cz, 29 + 100 * k) * 2f - 1f) * Jit);
                            if (!Placeable(p)) continue;
                            var (gx, gy) = TestMapData.WorldToGrid(p);
                            p.y = TestMapData.GroundHeight(gx, gy);
                            string region = GoWorldMap.RegionAt(gx, gy);
                            var kinds = ByRegion.TryGetValue(region ?? "", out var ks) ? ks : new[] { Kind.Foot, Kind.Twig };
                            _all.Add(new Trace { Key = $"{cx}_{cz}", Pos = p, Kind = kinds[Hash(cx, cz, 31) < 0.5f ? 0 : 1], Region = region });
                            break;
                        }
                    }
                // tasks U-0103 — 서리봉 고원(지도 북쪽 밖 눈밭, 바닥 윗면 y=0)에도 같은 칸 해시로. 고원에서 셋을 읽으면 가장 가까운 보스 = 곰왕.
                var fc = GoFrost.Center;
                int fx0 = Mathf.FloorToInt((fc.x - GoFrost.HalfX) / Cell), fx1 = Mathf.FloorToInt((fc.x + GoFrost.HalfX) / Cell);
                int fz0 = Mathf.FloorToInt((fc.z - GoFrost.HalfZ) / Cell), fz1 = Mathf.FloorToInt((fc.z + GoFrost.HalfZ) / Cell);
                var frostKinds = ByRegion[GoFrost.RegionId];
                for (int cx = fx0; cx <= fx1; cx++)
                    for (int cz = fz0; cz <= fz1; cz++)
                    {
                        if (Hash(cx, cz, 17) >= Share) continue;
                        for (int k = 0; k < 3; k++)
                        {
                            var p = new Vector3((cx + 0.5f) * Cell + (Hash(cx, cz, 23 + 100 * k) * 2f - 1f) * Jit, 0f,
                                                (cz + 0.5f) * Cell + (Hash(cx, cz, 29 + 100 * k) * 2f - 1f) * Jit);
                            if (!PlaceableFrost(p)) continue;
                            _all.Add(new Trace { Key = $"f{cx}_{cz}", Pos = p, Kind = frostKinds[Hash(cx, cz, 31) < 0.5f ? 0 : 1], Region = GoFrost.RegionId });
                            break;
                        }
                    }
                return _all;
            }
        }

        /// <summary>그 자리 둘레 <see cref="ReadR"/> 안의 안 읽은 흔적(가장 가까운 것), 없으면 null.</summary>
        public static Trace? NearestUnread(Vector3 at)
        {
            Roll();
            Trace? best = null; float bd = ReadR;
            foreach (var t in All)
            {
                if (_read.Contains(t.Key)) continue;
                float d = Vector2.Distance(new Vector2(t.Pos.x, t.Pos.z), new Vector2(at.x, at.z));
                if (d <= bd) { bd = d; best = t; }
            }
            return best;
        }

        public static Vector3 BossPos(string boss) => boss == BossFrost ? GoFrost.KingHome : TestMapData.WorldPos(3.6f, 6.75f);

        public static string BossName(string boss) => boss == BossFrost
            ? GoLocalization.T("track.boss_frost", "만년설 바위곰왕")
            : GoLocalization.T("track.boss_guardian", "망루 수호장");

        /// <summary>흔적 하나를 읽는다 — 셋째면 오늘의 큰 짐승을 정한다. 글(토스트) 또는 null(이미 읽음·없는 칸).</summary>
        public static string Read(string key)
        {
            Roll();
            Trace? tr = null;
            foreach (var t in All) if (t.Key == key) { tr = t; break; }
            if (tr == null || _read.Contains(key)) return null;
            _read.Add(key);
            string msg = string.Format(GoLocalization.T("track.read", "{0} {1}을(를) 읽었다 ({2}/{3})"), KindEmoji[(int)tr.Value.Kind], KindName[(int)tr.Value.Kind], Mathf.Min(_read.Count, Need), Need);
            if (_read.Count >= Need && Boss == null)
            {
                var p = tr.Value.Pos;
                Boss = (BossPos(BossFrost) - p).sqrMagnitude < (BossPos(BossGuardian) - p).sqrMagnitude ? BossFrost : BossGuardian;
                msg += " — " + string.Format(GoLocalization.T("track.hunt", "오늘의 큰 짐승: {0}"), BossName(Boss));
            }
            Changed?.Invoke();
            return msg;
        }

        /// <summary>들판 보스를 쓰러뜨렸을 때(`FieldEnemy` 죽음) — 오늘의 큰 짐승이면 강화석 +2·의뢰 끝. 보상 글 또는 null.</summary>
        public static string OnBossDown(bool frost)
        {
            Roll();
            if (Boss == null || Done || Boss != (frost ? BossFrost : BossGuardian)) return null;
            Done = true;
            WeaponState.AddOre(HuntOre);
            Changed?.Invoke();
            return string.Format(GoLocalization.T("track.done", "사냥 의뢰 끝 — {0} · 강화석 +{1}"), BossName(Boss), HuntOre);
        }

        /// <summary>목표판 "지금" 줄 — 쫓는 중이면 거리, 읽는 중이면 셈, 없으면 null.</summary>
        public static string Line(Vector3 from)
        {
            Roll();
            if (Boss != null && !Done)
                return string.Format(GoLocalization.T("track.line_hunt", "🐾 큰 짐승을 쫓는다 — {0} {1:0}m"), BossName(Boss), Vector3.Distance(from, BossPos(Boss)));
            if (_read.Count > 0 && Boss == null)
                return string.Format(GoLocalization.T("track.line_read", "🐾 흔적 {0}/{1} — 길에서 흔적을 더 찾는다"), _read.Count, Need);
            return null;
        }

        /// <summary>무기 빛 단계 0~11(웹 weapon.js — 강화 5 마다 한 단 + 승급).</summary>
        public static int GlowTier(int lv, int asc) => Mathf.Clamp(lv / 5 + asc, 0, 11);
        public static readonly Color GlowLow = new Color(0x14 / 255f, 0x12 / 255f, 0x0f / 255f), GlowHigh = new Color(1f, 0xc8 / 255f, 0x3a / 255f);
        public static Color GlowColor(int tier) => Color.Lerp(GlowLow, GlowHigh, tier / 11f);

        public static List<string> SnapshotRead() { Roll(); var l = new List<string>(_read); l.Sort(string.CompareOrdinal); return l; }

        public static void Restore(string day, IEnumerable<string> read, string boss, int done)
        {
            Day = day ?? "";
            _read.Clear();
            if (read != null) foreach (var k in read) _read.Add(k);
            Boss = string.IsNullOrEmpty(boss) ? null : boss;
            Done = done != 0;
            Roll();
            Changed?.Invoke();
        }
    }
}
