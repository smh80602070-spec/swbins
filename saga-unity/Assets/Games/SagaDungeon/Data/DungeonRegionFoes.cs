using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 109-10-5 "지역 몬스터·위험도·우두머리" — 웹 사가블로 §5.13 결(코드 공유 없음, 웹 `world-map.js` FOES·`dungeon.js` stepRegionBoss 의 수치를 옮겼다).
    /// 위험도: 지역 기본값 웹 그대로(중원 0·개펄 2·폐도시/서역 3·신도시/설산 4·천계 5·지옥/기계 6). 웹의 "가운데서 3000 마다 +1(상한 30)"은
    /// 이 트랙 칸이 모두 가운데에서 한 칸 거리라 해당 없음 — 칸 = 지역 = 위험도 하나.
    /// **옛 VS 적(모루골·Room2~4 잡졸·정예·살수·들길 매복)엔 위험도를 안 곱한다** — 북방 설산(위험 4)이 던전 가는 첫 길이라
    /// 곱하면 첫 걸음부터 4층 적이 선다. 위험도는 새로 선 지역 우두머리·호위에만 탄다.
    /// 명단: 웹은 지역마다 몬스터 12~23종이지만 이 트랙 몸은 시대 적 여덟·황건·해골뿐이라 **지역 시대(웹 era)로 호위 몸을 고른다** —
    /// 과거 = 황건 정예 · 현대/미래 = 그 층 단계의 시대 적(`DungeonEras`) · 신화 = 해골 무사.
    /// 우두머리 아홉(웹 이름·사연 그대로): 칸마다 고정 표식 하나, **밟으면** 호위 정예 셋과 선다(웹 "1500 안에 들면" — 칸이 방 하나라
    /// 다가가기만 해도 서면 시작 마을에서 바로 붙는다). 세기는 위험도 + 4 층 두목 공식 · 체력 ×3. 쓰러뜨리면 전설 한 점(명소 무기 여섯 —
    /// §5.10 비전)·홍옥·금(잡졸 금 ×6)·공적(15 + 층, 공적 화폐가 없어 × 50 냥), 10분(실제 시각) 뒤 다시 선다.
    /// 몸은 색 바꿔 돌려쓰기 대신 **다른 판 몸을 빌린다**(웹 "base 몸을 빌려 이름·색만" 과 같은 결) — 이 판의 적·NPC 몸과 안 겹친다.
    /// 웹의 "보물 bias 45 둘·재료" 는 이 판이 무기 한 칸·재료 없음이라 뺐다.
    /// </summary>
    public static class DungeonRegionFoes
    {
        public const int BossLevelAdd = 4;
        public const float BossHpMul = 3f;
        public const int Guards = 3;
        public const double RestSeconds = 600.0;
        public const float GoldMul = 6f;
        public const int MeritBase = 15;
        public const int GoldPerMerit = 50;
        /// <summary>표식 반경 — 이 안을 밟으면 선다.</summary>
        public const float SummonRadius = 2.2f;
        /// <summary>이 안에 들면 한 번 알림(위험도·밟으면 선다·쉬는 중이면 남은 분). 표식 곁만 — 보물상자·난입 표식 같은 다른 볼일 자리와 안 겹치게 좁다.</summary>
        public const float NoticeRadius = 4f;
        /// <summary>플레이어가 표식에서 이만큼 멀어지면 무리가 제자리로 물러난다(쓰러뜨린 게 아니라 쉼 없음) — 적 이동이 벽을 안 봐 끝없이 쫓는다.</summary>
        public const float LeashRadius = 18f;
        /// <summary>호위 셋 — 표식에서 방 안쪽으로 이 거리, 이 각도 간격 부채꼴(표식이 벽 가라 둘레로 펴면 벽 밖에 선다).</summary>
        public const float GuardRing = 2.6f;
        public const float GuardFanDeg = 50f;
        public const float BossHeight = 2.8f;
        public const float GuardHeight = 2.2f;
        public const float TintMix = 0.45f;
        public const float DangerRed = 10f;

        public const string SkeletonBody = "Skeleton";
        public const string SkeletonNameKo = "해골 무사";
        public const string SkeletonNameKey = "enemy.region_skeleton";
        public static readonly Color SkeletonTint = new Color(0.88f, 0.9f, 0.96f);
        public static readonly Color PastEliteColor = new Color(0.75f, 0.35f, 0.15f);
        public const string PastEliteName = "폐허의 황건 정예";

        public static readonly string[] Legends = { "wp_lm_tomb", "wp_lm_fort", "wp_lm_bandit", "wp_lm_palace", "wp_lm_hellgate", "wp_lm_cloud" };
        public const string GemReward = "gem_ruby";

        public struct Boss
        {
            public string Id;
            public string NameKo;
            public string DescKo;
            /// <summary>빌린 몸(`SetupNpcCharacterImports` 표 이름) — 원래 판.</summary>
            public string Body;
            public Color Color;
            /// <summary>표식 자리(세계 좌표) — 그 칸 방 안, 문·행상·손님·시대 꾸밈·옛 VS 적을 비킨 바깥쪽 벽 가(웹 "방위 한가운데 먼 자리").</summary>
            public Vector3 Spot;
        }

        private static Color Hex(int rgb) => new Color(((rgb >> 16) & 255) / 255f, ((rgb >> 8) & 255) / 255f, (rgb & 255) / 255f);

        /// <summary>`DungeonWorldMap.All` 순서 그대로 — 웹 FOES.lvl.</summary>
        public static readonly int[] Danger = { 0, 3, 2, 6, 4, 3, 5, 4, 6 };

        /// <summary>`DungeonWorldMap.All` 순서 — 웹 FOES.boss(id·이름·사연·빛깔) + 빌린 몸(STORY 두목 Morak · GO 수호장 Maw · GO 떠도는 망자 Copzombie ·
        /// STORY 시대 적 여섯).</summary>
        public static readonly Boss[] Bosses =
        {
            new Boss { Id = "rb_jungwon", NameKo = "벌판 흑기 대장", DescKo = "중원 도적떼를 한데 거느린 검은 기병",
                Body = "Morak", Color = Hex(0x2a2a3a), Spot = new Vector3(-7f, 0f, -8f) },
            new Boss { Id = "rb_neon", NameKo = "폐도시 폭주룡", DescKo = "멈춘 공장을 둥지 삼은 강철 짐승",
                Body = "Warzombie", Color = Hex(0x6a4a3a), Spot = new Vector3(36.5f, 0f, -6.5f) },
            new Boss { Id = "rb_saltmarsh", NameKo = "개펄 촉수왕", DescKo = "물 빠진 갯벌 밑에서 올라온 촉수",
                Body = "Copzombie", Color = Hex(0x2a4a5a), Spot = new Vector3(34f, 0f, -36.5f) },
            new Boss { Id = "rb_hellgate", NameKo = "균열 문지기 겁옥", DescKo = "갈라진 땅을 지키는 불의 문지기",
                Body = "Yaku", Color = Hex(0x8a1a10), Spot = new Vector3(4f, 0f, -36.5f) },
            new Boss { Id = "rb_solar", NameKo = "태양로 폭주 거신", DescKo = "과열된 태양로가 깨운 거인",
                Body = "Racer", Color = Hex(0xc9a020), Spot = new Vector3(-35f, 0f, -35f) },
            new Boss { Id = "rb_silkroad", NameKo = "모래바다 폭군", DescKo = "대상 길목을 끊어 놓은 뿔 달린 폭군",
                Body = "Maw", Color = Hex(0xb08a4a), Spot = new Vector3(-36.5f, 0f, 4f) },
            new Boss { Id = "rb_heaven", NameKo = "타락한 천장", DescKo = "하늘 사당을 버리고 칼을 든 옛 수호장",
                Body = "Mremireh", Color = Hex(0x8a8ad9), Spot = new Vector3(-35f, 0f, 24f) },
            new Boss { Id = "rb_snowfort", NameKo = "만년설 거한", DescKo = "산성 폐허를 차지한 눈의 거한",
                Body = "Dummy", Color = Hex(0xc9d9e8), Spot = new Vector3(-6f, 0f, 96.5f) },
            new Boss { Id = "rb_scrap", NameKo = "고철 거신", DescKo = "쓰러진 기계를 모아 스스로 일어선 것",
                Body = "Mannequin", Color = Hex(0x5a626e), Spot = new Vector3(36.5f, 0f, 36.5f) },
        };

        /// <summary>씬 빌더가 층 진행기에 실어 둘 빌린 몸 — 우두머리 아홉 + 신화 호위(해골).</summary>
        public static string[] BorrowedBodies()
        {
            var list = new string[Bosses.Length + 1];
            for (int i = 0; i < Bosses.Length; i++) list[i] = Bosses[i].Body;
            list[Bosses.Length] = SkeletonBody;
            return list;
        }

        /// <summary>표식이 선 방의 가운데 — 방은 30m 격자(북 칸 Room2~4 도 z = 30·60·90)라 가장 가까운 격자점.</summary>
        public static Vector3 RoomCenterOf(Vector3 spot) =>
            new Vector3(Mathf.Round(spot.x / DungeonWorldMap.Cell) * DungeonWorldMap.Cell, 0f, Mathf.Round(spot.z / DungeonWorldMap.Cell) * DungeonWorldMap.Cell);

        /// <summary>그 지역 적이 쓰는 층 공식의 층 — 위험 0 은 예전 들판(1층) 그대로.</summary>
        public static int RegionFloor(int region) => Mathf.Max(1, Danger[region]);
        /// <summary>우두머리·호위의 층 — 웹 levelAt(자리) + 4.</summary>
        public static int BossFloor(int region) => Danger[region] + BossLevelAdd;

        public static float BossHp(int region) => Mathf.Round(DungeonFormulas.EnemyHp(BossFloor(region), true) * BossHpMul);
        public static float BossDmg(int region) => DungeonFormulas.EnemyDmg(BossFloor(region), true);
        public static int BossGold(int region) => Mathf.RoundToInt(DungeonFormulas.RewardGold(BossFloor(region), false) * GoldMul);
        public static int MeritGold(int region) => (MeritBase + BossFloor(region)) * GoldPerMerit;

        /// <summary>호위 i 번째의 시대 — 지역 시대(웹 era)를 돌아가며.</summary>
        public static string GuardEra(int region, int slot)
        {
            var eras = DungeonWorldMap.All[region].Eras;
            return eras[slot % eras.Length];
        }

        /// <summary>토벌마다 다른 전설 — 지역·횟수 해시(무작위 없음).</summary>
        public static string LegendFor(int region, int kills) =>
            Legends[(int)(DungeonEras.Hash($"rb:{DungeonWorldMap.All[region].Key}:{kills}") % (uint)Legends.Length)];

        public static string BossName(int region) => DungeonLocalization.T($"rboss.{DungeonWorldMap.All[region].Key}", Bosses[region].NameKo);
        public static string BossDesc(int region) => DungeonLocalization.T($"rboss.{DungeonWorldMap.All[region].Key}.desc", Bosses[region].DescKo);

        /// <summary>"위험 N" — 10 이상 붉게(웹 그대로, 이 트랙 상한은 6).</summary>
        public static string DangerLabel(int region)
        {
            string s = string.Format(DungeonLocalization.T("region.danger", "위험 {0}"), Danger[region]);
            return Danger[region] >= DangerRed ? $"<color=#ff5a5a>{s}</color>" : s;
        }

        /// <summary>들어섬 배너 셋째 줄 — "위험 N · ☠ 우두머리".</summary>
        public static string BannerLine(int region) => $"{DangerLabel(region)} · ☠ {BossName(region)}";
    }
}
