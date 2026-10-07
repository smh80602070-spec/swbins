using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-3a "수집 구슬·봉헌"(웹 사가만리 ⑲-3 · saga-godot 106 ⑪ 별조각) — 자리 규칙·봉헌 표만 모은 순수 정적 클래스.
    /// 지역 일곱마다 셋(웹 "지역 칸마다 셋"): ① 정상 둘레 산마루(윗면 가장자리 +2.2m, 걸어 닿음) ② 강물 위(수면 +0.6m, 헤엄쳐야) ③ 숲 높이(땅 +4.4m, 점프 꼭대기라야).
    /// 그 지역에 그 땅이 없으면 들판(땅 +2.0m, 서서 닿음). 자리는 지역 id·칸 번호 해시로 늘 같다(세이브 없이). 높이는 웹 값 × 1.85(GO 사람 키 3.4m).
    /// 줍기 = 수평 3m 안 + 구슬이 발보다 -0.5 ~ +3.6m(선 채 손이 닿는 높이) — 나무 위는 점프해야, 강 위는 헤엄쳐야 닿는다.
    /// 봉헌 = 불 올린 봉수대(이 트랙의 탑) 14m 안에 서면 지닌 구슬을 저절로 바친다 — 둘마다 신상 등급 +1(최대 10) → 스태미나 상한 +8(100 → 180)·금 200·경험 20
    /// (웹 단사 2 는 이 판에 없어 정상과 같은 비율로 경험).
    /// </summary>
    public static class GoOrbs
    {
        public enum Kind { Ridge, River, Tree, Field }

        public struct Orb
        {
            public string Id;       // "orb_<지역>_<칸>"
            public string RegionId;
            public Kind Kind;
            public int Gx, Gy;
            public Vector3 Pos;     // 해시 자리(땅 높이는 표 값 — 월드에선 `GoOrbField` 가 땅에 맞춰 다시 앉힌다)
        }

        public const int PerRegion = 3;
        public const float RidgeAbove = 2.2f;
        public const float RiverAbove = 0.6f;   // 수면 위
        public const float TreeAbove = 4.4f;
        public const float FieldAbove = 2.0f;
        public const float RidgeInset = 3.2f;   // 정상 윗면 가운데에서(윗면 반지름 5)
        public const float TileSpread = 14f;    // 칸 가운데에서 ±(48m 칸 — 강 구슬은 둑에서 10m 넘게 떨어진다)
        public const float PickRadius = 3f;
        public const float ReachBelow = 0.5f;
        public const float ReachAbove = 3.6f;

        public const float OfferRadius = 14f;
        public const int OrbsPerLevel = 2;
        public const int MaxLevel = 10;
        public const float StaminaPerLevel = 8f;
        public const int GoldPerLevel = 200;
        public const int ExpPerLevel = 20;

        private static Orb[] _all;

        public static Orb[] All
        {
            get
            {
                if (_all != null) return _all;
                var list = new List<Orb>();
                foreach (var r in GoWorldMap.Regions) Place(r.Id, list);
                _all = list.ToArray();
                return _all;
            }
        }

        public static int IndexOf(string id)
        {
            var all = All;
            for (int i = 0; i < all.Length; i++) if (all[i].Id == id) return i;
            return -1;
        }

        /// <summary>발(feet) 자리에서 그 구슬에 손이 닿는가.</summary>
        public static bool CanReach(Vector3 orb, Vector3 feet)
        {
            Vector3 d = orb - feet;
            float dy = d.y;
            d.y = 0f;
            return d.magnitude <= PickRadius && dy >= -ReachBelow && dy <= ReachAbove;
        }

        /// <summary>바친 구슬 수 → 신상 등급(둘마다 1, 최대 10).</summary>
        public static int LevelOf(int given) => Mathf.Min(MaxLevel, given / OrbsPerLevel);

        private static void Place(string region, List<Orb> list)
        {
            var peaks = new List<GoWorldMap.Peak>();
            foreach (var p in GoWorldMap.Peaks) if (p.RegionId == region) peaks.Add(p);
            var river = new List<Vector2Int>();
            var forest = new List<Vector2Int>();
            var field = new List<Vector2Int>();
            for (int y = 0; y < TestMapData.RowCount; y++)
                for (int x = 0; x < TestMapData.Cols; x++)
                {
                    if (GoWorldMap.RegionAt(x, y) != region) continue; // 가장자리 칸도(서쪽 숲길은 x=0 줄) — ±14m 라 바깥 벽에서 10m 넘게 떨어진다
                    char ch = TestMapData.TileAt(x, y);
                    if (ch == '~') river.Add(new Vector2Int(x, y));
                    else if (ch == 'T') forest.Add(new Vector2Int(x, y));
                    if (ch == '.' || ch == '=' || ch == 'F' || ch == 'T') field.Add(new Vector2Int(x, y)); // 마을 집·사당·폐허·동굴 칸은 비킨다
                }

            for (int slot = 0; slot < PerRegion; slot++)
            {
                uint h = Hash(region + ":" + slot);
                Kind kind = slot == 0 && peaks.Count > 0 ? Kind.Ridge
                          : slot == 1 && river.Count > 0 ? Kind.River
                          : slot == 2 && forest.Count > 0 ? Kind.Tree
                          : field.Count > 0 ? Kind.Field
                          : river.Count > 0 ? Kind.River : Kind.Ridge;
                var orb = new Orb { Id = $"orb_{region}_{slot}", RegionId = region, Kind = kind };
                if (kind == Kind.Ridge && peaks.Count > 0)
                {
                    var p = peaks[(int)(h % (uint)peaks.Count)];
                    float a = (h >> 8) % 360u * Mathf.Deg2Rad;
                    orb.Gx = p.Gx; orb.Gy = p.Gy;
                    orb.Pos = p.Top + new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * RidgeInset + Vector3.up * RidgeAbove;
                }
                else
                {
                    var cands = kind == Kind.River ? river : kind == Kind.Tree ? forest : field;
                    if (cands.Count == 0) continue;
                    var t = cands[(int)(h % (uint)cands.Count)];
                    orb.Gx = t.x; orb.Gy = t.y;
                    float ox = ((h >> 8) % 1000u / 999f * 2f - 1f) * TileSpread;
                    float oz = ((h >> 18) % 1000u / 999f * 2f - 1f) * TileSpread;
                    Vector3 c = TestMapData.WorldPos(t.x, t.y) + new Vector3(ox, 0f, oz);
                    c.y = kind == Kind.River ? TestMapData.WaterSurfaceHeight + RiverAbove
                        : TestMapData.GroundHeight(t.x, t.y) + (kind == Kind.Tree ? TreeAbove : FieldAbove);
                    orb.Pos = c;
                }
                list.Add(orb);
            }
        }

        /// <summary>FNV-1a — string.GetHashCode 는 런타임마다 다를 수 있다.</summary>
        private static uint Hash(string s)
        {
            uint h = 2166136261;
            foreach (char c in s) { h ^= c; h *= 16777619; }
            return h;
        }
    }

    /// <summary>109-14-3a 주운 구슬·바친 수(세이브 v19 `orbsGot`·`orbsGiven`).</summary>
    public static class OrbState
    {
        private static readonly HashSet<string> _got = new HashSet<string>();
        public static int Given { get; private set; }
        public static int Level => GoOrbs.LevelOf(Given);
        /// <summary>지녔지만 아직 안 바친 구슬 수.</summary>
        public static int Held => _got.Count - Given;
        public static int GotCount => _got.Count;
        public static bool Has(string id) => _got.Contains(id);

        public static bool Collect(string id) => GoOrbs.IndexOf(id) >= 0 && _got.Add(id);

        /// <summary>지닌 구슬을 모두 바친다 — 오른 등급 수를 돌려준다(보상은 부르는 쪽).</summary>
        public static int OfferAll()
        {
            int before = Level;
            Given = _got.Count;
            return Level - before;
        }

        public static List<string> Snapshot() => new List<string>(_got);

        public static void Restore(IEnumerable<string> got, int given)
        {
            _got.Clear();
            if (got != null) foreach (var id in got) if (GoOrbs.IndexOf(id) >= 0) _got.Add(id);
            Given = Mathf.Clamp(given, 0, _got.Count);
        }

        public static void ResetForTest() => Restore(null, 0);
    }
}
