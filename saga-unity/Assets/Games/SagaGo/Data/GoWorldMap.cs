using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 107-3 "지역 지도" — 지역 일곱·순간이동 지점 다섯·옛 망루 자리를 모은 표(글자 지도 칸 좌표).
    /// PLAN.md 108 "고정 특색 지역" — 지역마다 한자·사연·위험도·몬스터 명단(땅빛은 아래 `Atmospheres`·`Vegetations`).
    /// 이름·한자는 전부 지어낸 것(실제 지명·원작 이름 아님).
    /// </summary>
    public static class GoWorldMap
    {
        public struct Region
        {
            public string Id;
            public string NameKey;
            public string NameKo;
            public float LabelGx, LabelGy;
            /// <summary>108 — 지은 한자 이름(표시 글자, 번역 안 함).</summary>
            public string Hanja;
            public string LoreKey;
            public string LoreKo;
            /// <summary>108 — 1~3. 그 지역 들판 적의 체력·공격·방패·경험치에 `DangerMul` 을 곱한다(수호장 제외).</summary>
            public int Danger;
            /// <summary>108 — 그 지역에 서는 적 종류. `FieldSpawner` 무리 구성이 이 명단 안에 있어야 한다(진단이 본다).</summary>
            public FieldEnemy.Kind[] Roster;
        }

        public const int MaxDanger = 3;

        /// <summary>위험 1 → ×1.0, 2 → ×1.15, 3 → ×1.3.</summary>
        public static float DangerMul(int danger) => 1f + 0.15f * (Mathf.Clamp(danger, 1, MaxDanger) - 1);

        public struct Waypoint
        {
            public string Id;
            public string NameKey;
            public string NameKo;
            public float Gx, Gy;
        }

        private static readonly FieldEnemy.Kind KB = FieldEnemy.Kind.Bandit;
        private static readonly FieldEnemy.Kind KS = FieldEnemy.Kind.Skeleton;
        private static readonly FieldEnemy.Kind KF = FieldEnemy.Kind.EmberImp;
        private static readonly FieldEnemy.Kind KW = FieldEnemy.Kind.DrownedGhost;
        private static readonly FieldEnemy.Kind KT = FieldEnemy.Kind.StormWraith;
        private static readonly FieldEnemy.Kind KG = FieldEnemy.Kind.Guardian;

        public static readonly Region[] Regions =
        {
            new Region { Id = "village",    NameKey = "region.village",    NameKo = "마을 들판",   LabelGx = 3f,   LabelGy = 3f,   Hanja = "市原", Danger = 1, Roster = new FieldEnemy.Kind[0],
                LoreKey = "region.village.lore",     LoreKo = "역참과 장터가 모인 첫 들판. 마을 울타리 안에선 칼 뽑을 일이 없다." },
            new Region { Id = "west_wood",  NameKey = "region.west_wood",  NameKo = "서쪽 숲길",   LabelGx = 0f,   LabelGy = 3f,   Hanja = "雷林", Danger = 2, Roster = new[] { KT, KW },
                LoreKey = "region.west_wood.lore",   LoreKo = "벼락 맞은 고목이 늘어선 짙은 숲길. 번개귀가 나무 사이를 건너뛴다." },
            new Region { Id = "east_grove", NameKey = "region.east_grove", NameKo = "동쪽 숲",     LabelGx = 7f,   LabelGy = 2.6f, Hanja = "丹林", Danger = 2, Roster = new[] { KB, KS, KW },
                LoreKey = "region.east_grove.lore",  LoreKo = "호박빛 단풍 숲에 산적 소굴이 숨어 있다. 옛 싸움터 해골과 숲 못의 물귀신도 깨어난다." },
            new Region { Id = "north_foot", NameKey = "region.north_foot", NameKo = "북쪽 산기슭", LabelGx = 2.5f, LabelGy = 0.6f, Hanja = "寒麓", Danger = 3, Roster = new[] { KS },
                LoreKey = "region.north_foot.lore",  LoreKo = "무너진 성터 무덤이 흩어진 서늘한 비탈. 해골 병사가 줄지어 지킨다." },
            new Region { Id = "river",      NameKey = "region.river",      NameKo = "너른 강",     LabelGx = 5.5f, LabelGy = 5f,   Hanja = "廣川", Danger = 1, Roster = new FieldEnemy.Kind[0],
                LoreKey = "region.river.lore",       LoreKo = "마을과 남쪽 땅을 가르는 물줄기. 헤엄칠 땐 기운이 다하지 않게." },
            new Region { Id = "south_glade",NameKey = "region.south_glade",NameKo = "남쪽 공터",   LabelGx = 3f,   LabelGy = 7f,   Hanja = "金坪", Danger = 3, Roster = new[] { KB, KS, KG },
                LoreKey = "region.south_glade.lore", LoreKo = "옛 망루 발치의 금빛 풀밭. 망루를 지키던 수호장이 아직 서 있다." },
            new Region { Id = "farmland",   NameKey = "region.farmland",   NameKo = "끝 논밭",     LabelGx = 3f,   LabelGy = 9.3f, Hanja = "末田", Danger = 2, Roster = new[] { KB, KF, KT },
                LoreKey = "region.farmland.lore",    LoreKo = "마른 논둑에 도깨비불이 인다. 산적이 가을걷이를 노린다." },
        };

        public static readonly Waypoint[] Waypoints =
        {
            new Waypoint { Id = "wp_village", NameKey = "wp.village", NameKo = "마을 역참",     Gx = 3.4f, Gy = 2.25f },
            new Waypoint { Id = "wp_east",    NameKey = "wp.east",    NameKo = "동쪽 숲 역참",  Gx = 6.4f, Gy = 3.0f },
            new Waypoint { Id = "wp_north",   NameKey = "wp.north",   NameKo = "산기슭 역참",   Gx = 2.6f, Gy = 1.35f },
            new Waypoint { Id = "wp_south",   NameKey = "wp.south",   NameKo = "남쪽 공터 역참", Gx = 3.0f, Gy = 7.25f },
            new Waypoint { Id = "wp_farm",    NameKey = "wp.farm",    NameKo = "논밭 역참",     Gx = 2.4f, Gy = 9.2f },
        };

        /// <summary>옛 망루 — 길목(3,6) 옆 안쪽 산 고원 위. 마을에서 남쪽으로 보인다.</summary>
        public const int TowerGx = 4;
        public const int TowerGy = 6;
        public const float TowerHeight = 24f;
        public const float TowerWidth = 8f;

        public const float WaypointActivateRadius = 7f;

        /// <summary>PLAN.md 107-3 "지역마다 바이옴" — 안개 빛깔·짙기(기본 `SkyFogBuilder.FogDensity` 배율)·햇빛 빛깔(곱).
        /// 경계를 넘으면 `RegionAtmosphere` 가 몇 초에 걸쳐 스며들듯 바꾼다.</summary>
        public struct Atmosphere
        {
            public string RegionId;
            public Color Fog;
            public float DensityMul;
            public Color Sun;
        }

        public static readonly Atmosphere[] Atmospheres =
        {
            new Atmosphere { RegionId = "village",     Fog = new Color(0.85f, 0.72f, 0.58f), DensityMul = 1.0f, Sun = new Color(1f, 1f, 1f) },          // 기본 노을빛
            new Atmosphere { RegionId = "west_wood",   Fog = new Color(0.60f, 0.68f, 0.52f), DensityMul = 2.2f, Sun = new Color(0.88f, 0.98f, 0.84f) }, // 짙은 숲 녹빛
            new Atmosphere { RegionId = "east_grove",  Fog = new Color(0.80f, 0.64f, 0.48f), DensityMul = 1.6f, Sun = new Color(1f, 0.9f, 0.78f) },     // 호박빛 숲
            new Atmosphere { RegionId = "north_foot",  Fog = new Color(0.64f, 0.68f, 0.76f), DensityMul = 2.0f, Sun = new Color(0.86f, 0.9f, 1f) },     // 서늘한 산 회청
            new Atmosphere { RegionId = "river",       Fog = new Color(0.68f, 0.77f, 0.86f), DensityMul = 2.6f, Sun = new Color(0.9f, 0.95f, 1f) },     // 물안개
            new Atmosphere { RegionId = "south_glade", Fog = new Color(0.93f, 0.78f, 0.54f), DensityMul = 1.2f, Sun = new Color(1f, 0.92f, 0.76f) },    // 금빛 공터
            new Atmosphere { RegionId = "farmland",    Fog = new Color(0.90f, 0.83f, 0.60f), DensityMul = 0.9f, Sun = new Color(1f, 0.96f, 0.82f) },    // 밀빛 논밭
            new Atmosphere { RegionId = "frost",       Fog = new Color(0.82f, 0.88f, 0.96f), DensityMul = 1.7f, Sun = new Color(0.86f, 0.93f, 1f) },     // 109-14-27a 서리봉 고원 — 눈안개
        };

        /// <summary>procgen.py 나무 수관 모양(씨앗마다 셋 중 하나) — 비트로 섞어 고른다.</summary>
        [System.Flags]
        public enum TreeForm { Broadleaf = 1, Conifer = 2, Willow = 4 }

        /// <summary>PLAN.md 107-3 "식생 바이옴" — 숲 칸 나무 수·모양·크기, 수관·풀 빛깔(`_CanopyTint`, a = 세기), 풀 포기 수.
        /// 편집기 씬 빌드 때 `VegetationBuilder` 가 칸의 지역을 보고 고른다(자리는 예전처럼 좌표 해시 — 칸마다 앞 셋은 옛 자리 그대로).</summary>
        public struct Vegetation
        {
            public string RegionId;
            public int TreesPerForestTile;
            public TreeForm Forms;
            public float ScaleMin, ScaleMax;
            public Color CanopyTint;
            /// <summary>들('.')·숲('T') 칸 하나에 까는 풀 포기.</summary>
            public int GrassPerTile;
        }

        public static readonly Vegetation[] Vegetations =
        {
            new Vegetation { RegionId = "village",     TreesPerForestTile = 3, Forms = TreeForm.Broadleaf,                   ScaleMin = 0.7f, ScaleMax = 1.3f, CanopyTint = new Color(0.20f, 0.38f, 0.14f, 0f),    GrassPerTile = 5 },  // 옛 모습 그대로
            new Vegetation { RegionId = "west_wood",   TreesPerForestTile = 4, Forms = TreeForm.Broadleaf | TreeForm.Willow, ScaleMin = 0.9f, ScaleMax = 1.5f, CanopyTint = new Color(0.07f, 0.22f, 0.09f, 0.7f),  GrassPerTile = 4 },  // 짙고 빽빽한 숲길
            new Vegetation { RegionId = "east_grove",  TreesPerForestTile = 3, Forms = TreeForm.Broadleaf,                   ScaleMin = 0.8f, ScaleMax = 1.4f, CanopyTint = new Color(0.58f, 0.32f, 0.08f, 0.75f), GrassPerTile = 4 },  // 호박빛 단풍
            new Vegetation { RegionId = "north_foot",  TreesPerForestTile = 3, Forms = TreeForm.Conifer,                     ScaleMin = 0.8f, ScaleMax = 1.5f, CanopyTint = new Color(0.10f, 0.24f, 0.20f, 0.6f),  GrassPerTile = 3 },  // 서늘한 바늘잎
            new Vegetation { RegionId = "river",       TreesPerForestTile = 3, Forms = TreeForm.Willow,                      ScaleMin = 0.8f, ScaleMax = 1.3f, CanopyTint = new Color(0.22f, 0.40f, 0.20f, 0.4f),  GrassPerTile = 4 },  // (숲 칸 없음 — 강가는 갈대)
            new Vegetation { RegionId = "south_glade", TreesPerForestTile = 2, Forms = TreeForm.Broadleaf | TreeForm.Willow, ScaleMin = 0.8f, ScaleMax = 1.4f, CanopyTint = new Color(0.40f, 0.42f, 0.12f, 0.6f),  GrassPerTile = 12 }, // 성긴 나무·금빛 풀밭
            new Vegetation { RegionId = "farmland",    TreesPerForestTile = 2, Forms = TreeForm.Broadleaf,                   ScaleMin = 0.7f, ScaleMax = 1.2f, CanopyTint = new Color(0.34f, 0.42f, 0.12f, 0.5f),  GrassPerTile = 7 },  // 밀빛 둑
        };

        public static Vegetation VegetationOf(string regionId)
        {
            foreach (var v in Vegetations) if (v.RegionId == regionId) return v;
            return Vegetations[0];
        }

        public static Atmosphere AtmosphereOf(string regionId)
        {
            foreach (var a in Atmospheres) if (a.RegionId == regionId) return a;
            return Atmospheres[0];
        }

        /// <summary>칸 → 지역 id. 산 칸은 그 줄 지역에 속한다.</summary>
        public static string RegionAt(int gx, int gy)
        {
            if (gy <= 1) return gx >= 6 ? "east_grove" : "north_foot";
            if (gy <= 4)
            {
                if (gx <= 0) return "west_wood";
                if (gx >= 6) return "east_grove";
                return "village";
            }
            if (gy == 5) return "river";
            if (gy <= 8) return "south_glade";
            return "farmland";
        }

        public static string RegionAt(Vector3 world)
        {
            if (GoFrost.Contains(world)) return GoFrost.RegionId; // 109-14-27a 서리봉 고원 — 지도 밖 독립 눈밭
            var (gx, gy) = TestMapData.WorldToGrid(world);
            return RegionAt(Mathf.Clamp(gx, 0, TestMapData.Cols - 1), Mathf.Clamp(gy, 0, TestMapData.RowCount - 1));
        }

        public static string RegionName(string id)
        {
            foreach (var r in Regions) if (r.Id == id) return GoLocalization.T(r.NameKey, r.NameKo);
            if (id == Frost.Id) return GoLocalization.T(Frost.NameKey, Frost.NameKo);
            return id;
        }

        public static Region RegionOf(string id)
        {
            foreach (var r in Regions) if (r.Id == id) return r;
            if (id == Frost.Id) return Frost;
            return Regions[0];
        }

        /// <summary>109-14-27a 서리봉 고원 — `Regions`(글자 지도 칸을 덮는 일곱)에 안 넣는다(구슬·채집·사명·진단이 그 일곱을 센다). 이름·사연·바이옴만 여기서.</summary>
        public static readonly Region Frost = new Region
        {
            Id = "frost", NameKey = "region.frost", NameKo = "서리봉 고원", LabelGx = 0f, LabelGy = 0f, Hanja = "霜峰", Danger = 1, Roster = new FieldEnemy.Kind[0],
            LoreKey = "region.frost.lore", LoreKo = "고개 너머 눈에 덮인 고원. 옛 산성 터와 기상 관측소, 추락한 비행선이 한 땅에 함께 있다.",
        };

        public static int DangerOf(string id) => RegionOf(id).Danger;

        public static string RegionLore(string id)
        {
            var r = RegionOf(id);
            return GoLocalization.T(r.LoreKey, r.LoreKo);
        }

        /// <summary>108 — "●●○" 식 위험 점(최대 `MaxDanger`).</summary>
        public static string DangerDots(int danger)
        {
            danger = Mathf.Clamp(danger, 1, MaxDanger);
            return new string('●', danger) + new string('○', MaxDanger - danger);
        }

        /// <summary>108 — "위험 ●●○ · 산적·해골 병사"(명단이 비면 "위험 ●○○ · 적 없음"), 109-1 다른 시대 무리가 서면 " · 시간 틈 떠도는 망자·…".</summary>
        public static string DangerLine(string id)
        {
            var r = RegionOf(id);
            string foes = r.Roster.Length == 0 ? GoLocalization.T("region.no_foes", "적 없음") : "";
            for (int i = 0; i < r.Roster.Length; i++) foes += (i > 0 ? "·" : "") + FieldEnemy.KindName(r.Roster[i]);
            string line = string.Format(GoLocalization.T("region.danger", "위험 {0} · {1}"), DangerDots(r.Danger), foes);
            // 109-1 — 다른 시대 무리가 서면 그 이름을 뒤에(웹 ⑱ "적 이름 뒤 시대 표시")
            var era = FieldSpawner.EraFoeNames(id);
            if (era.Count > 0) line += " · " + string.Format(GoLocalization.T("region.era_foes", "시간 틈 {0}"), string.Join("·", era));
            return line;
        }

        public static string WaypointName(Waypoint w) => GoLocalization.T(w.NameKey, w.NameKo);

        /// <summary>지점 돌기둥이 서는 자리(땅 높이 포함).</summary>
        public static Vector3 WaypointPos(Waypoint w)
        {
            var (gx, gy) = TestMapData.WorldToGrid(TestMapData.WorldPos(w.Gx, w.Gy));
            return TestMapData.WorldPos(w.Gx, w.Gy) + Vector3.up * TestMapData.GroundHeight(gx, gy);
        }

        /// <summary>순간이동해 내리는 자리 — 돌기둥 남쪽 4m.</summary>
        public static Vector3 ArrivalPos(Waypoint w) => WaypointPos(w) + new Vector3(0f, 0.3f, 4f);

        /// <summary>월드 좌표 → 글자 지도 연속 좌표(칸 중심 = 정수).</summary>
        public static Vector2 WorldToGridF(Vector3 world)
        {
            return new Vector2(world.x / TestMapData.TileSize + TestMapData.Cols * 0.5f,
                               world.z / TestMapData.TileSize + TestMapData.RowCount * 0.5f);
        }

        // ---- PLAN.md 109-9 정상 — 웹 사가고 ⑰ "정상 발견 · 오른 정상 순간이동" ----------------------------

        public struct Peak
        {
            public string Id;       // "peak_{gx}_{gy}"
            public int Gx, Gy;
            public Vector3 Top;     // 윗면 가운데(월드)
            public string RegionId;
            public int Order;       // 그 지역 안 몇째(이름에 쓴다, 1부터)
        }

        /// <summary>정상 윗면에 섰다고 보는 거리 — 수평은 윗면 반지름 + 1m, 높이는 윗면 1.2m 아래까지.</summary>
        public const float PeakStandRadius = TestMapData.PeakTopRadius + 1f;
        public const float PeakStandBelow = 1.2f;
        /// <summary>웹 ⑰ — 정상 발견 = 금 80 + 높이 · 경험 50 · 단사 2(이 판엔 단사가 없어 지역 사명과 같은 비율로 경험 +20).</summary>
        public const int PeakGoldBase = 80;
        public const int PeakExp = 70;

        private static Peak[] _peaks;

        /// <summary>봉우리가 선 산 칸마다 정상 하나(`TestMapData.HasPeak`, 줄 → 칸 순서).</summary>
        public static Peak[] Peaks
        {
            get
            {
                if (_peaks != null) return _peaks;
                var list = new List<Peak>();
                var order = new Dictionary<string, int>();
                for (int y = 0; y < TestMapData.RowCount; y++)
                    for (int x = 0; x < TestMapData.Cols; x++)
                    {
                        if (!TestMapData.HasPeak(x, y)) continue;
                        Vector3 top = TestMapData.PeakBase(x, y) + Vector3.up * TestMapData.PeakHeight(x, y);
                        string region = RegionAt(x, y);
                        order.TryGetValue(region, out int n);
                        order[region] = n + 1;
                        list.Add(new Peak { Id = $"peak_{x}_{y}", Gx = x, Gy = y, Top = top, RegionId = region, Order = n + 1 });
                    }
                _peaks = list.ToArray();
                return _peaks;
            }
        }

        public static int PeakIndex(string id)
        {
            for (int i = 0; i < Peaks.Length; i++) if (Peaks[i].Id == id) return i;
            return -1;
        }

        /// <summary>"북쪽 산기슭 봉우리 3" — 지역 안 순번(한 지역에 봉우리가 열 넘게 선다).</summary>
        public static string PeakName(Peak p) =>
            string.Format(GoLocalization.T("map.peak_name", "{0} 봉우리 {1}"), RegionName(p.RegionId), p.Order);

        public static int PeakGold(Peak p) => PeakGoldBase + Mathf.RoundToInt(p.Top.y);

        /// <summary>정상 윗면에 서 있나.</summary>
        public static bool StandsOn(Peak p, Vector3 pos)
        {
            Vector2 d = new Vector2(pos.x - p.Top.x, pos.z - p.Top.z);
            return d.magnitude <= PeakStandRadius && pos.y >= p.Top.y - PeakStandBelow;
        }

        /// <summary>오른 정상으로 순간이동해 내리는 자리 — 윗면 가운데 조금 위.</summary>
        public static Vector3 PeakArrival(Peak p) => p.Top + Vector3.up * 0.3f;
    }
}
