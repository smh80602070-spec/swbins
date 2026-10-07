using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 109-2b "명소 층·마을 꾸밈에 시대 층"(SAGA-DESIGN §13 전체 퓨전 · 웹 사가나락 §5.20 뒤 후보 "명소 층 전용 3D 소품") —
    /// 명소 층 여섯(`DungeonLandmarkData`)과 마을 셋·갈림길 둘에 과거·현대·미래 소품을 한 자리에 세운다. 자리는 전부 손으로 박았다(난수 없음).
    /// 모델은 GO 108 ①·109-1b 와 같은 Poly Haven 스캔(CC0, `Assets/Art/Props/PolyHaven/`) — 에셋만 같이 쓰고 코드는 이 판 것.
    /// 이 판 사람 키는 실제와 같은 약 1.8m 라 실측 그대로(× 1). 미래 조각은 "시간 틈 잔해"(청록 발광·공중에 떠 세로축으로 돈다, `EraRiftSpin`).
    /// 명소 층 꾸밈은 층 진행기의 한 방(ProcRoom)에 여섯 벌을 구워 두고 그 층일 때만 켠다 — 방 다섯 내내 같은 꾸밈(층의 얼굴).
    /// 잡졸·손님·행상의 시대 섞기는 109-2a(`DungeonEras`) 그대로다 — 이 표는 꾸밈만.
    /// </summary>
    public static class DungeonEraDecor
    {
        public struct Piece
        {
            /// <summary>Poly Haven id(`wooden_crate_01`) · 묶음 안 한 덩이는 `id#노드이름 끝`.</summary>
            public string Model;
            /// <summary>방 가운데에서 m. Y 는 바닥 위로 밑면 높이(쌓을 때·잔해가 뜰 때만 0 아님).</summary>
            public float X, Y, Z;
            public float Yaw, Pitch, Roll;
            public float Scale;
            /// <summary>밑면을 바닥 밑으로 묻는 깊이(m) — 꽂힌 방패.</summary>
            public float Sink;
            /// <summary>그을린 빛(바탕색 × <see cref="CharredTint"/>) — 업화 대문.</summary>
            public bool Charred;
            /// <summary>상자 충돌(메시 크기). 작은 바구니·들통·눕힌 조각·잔해는 없음.</summary>
            public bool Collide;
            public DungeonEra Era;
        }

        public struct Set
        {
            /// <summary>명소 층은 `DungeonLandmarkData.Landmark.Key`, 마을은 씬 오브젝트 이름(Town2 …).</summary>
            public string Id;
            public string NameKo;
            public Piece[] Pieces;
            /// <summary>불씨 점광(그림자 없음) — 방 가운데 기준 자리. `Vector3.zero` 면 없음.</summary>
            public Vector3 FireLocal;
        }

        public static readonly Color CharredTint = new Color(0.4f, 0.36f, 0.34f, 1f);
        /// <summary>시간 틈 잔해 — GO 109-1b 와 같은 빛깔(두 판이 같은 "시간 틈"으로 읽히게).</summary>
        public static readonly Color RiftTint = new Color(0.55f, 0.8f, 0.9f, 1f);
        public static readonly Color RiftGlow = new Color(0.08f, 0.62f, 0.72f, 1f);
        public const float RiftSpinDegPerSec = 9f;
        /// <summary>잔해 밑면은 바닥에서 적어도 이만큼(사람 머리 위), 윗면은 벽 높이(4m) 아래 <see cref="RiftMaxTop"/> 까지.</summary>
        public const float RiftMinHover = 1.5f;
        public const float RiftMaxTop = 3.7f;

        private static Piece P(string model, float x, float z, float scale = 1f, float yaw = 0f, bool collide = true) =>
            new Piece { Model = model, X = x, Z = z, Scale = scale, Yaw = yaw, Collide = collide };

        private static Piece Tilt(Piece p, float pitch, float roll = 0f) { p.Pitch = pitch; p.Roll = roll; return p; }
        private static Piece Up(Piece p, float y) { p.Y = y; return p; }
        private static Piece Sunk(Piece p, float sink) { p.Sink = sink; return p; }
        private static Piece Charred(Piece p) { p.Charred = true; return p; }
        private static Piece M(Piece p) { p.Era = DungeonEra.Modern; return p; }
        /// <summary>미래 조각 — hover(m, 바닥 위) 만큼 떠 있고 부딪히지 않는다.</summary>
        private static Piece Rift(Piece p, float hover) { p.Era = DungeonEra.Future; p.Y = hover; p.Collide = false; return p; }

        // 과거
        private const string FirePit = "stone_fire_pit";
        private const string Barrel = "wine_barrel_01";
        private const string Crate = "wooden_crate_01";
        private const string Lantern = "wooden_lantern_01";
        private const string Shield = "kite_shield";
        private const string Basket = "wicker_basket_01";
        private const string Bucket = "wooden_bucket_01";
        private const string Snag = "dead_quiver_trunk";
        private const string RockA = "rock_moss_set_02#rock07";
        private const string RockB = "rock_moss_set_02#rock08";
        private const string RockD = "rock_moss_set_02#rock11";
        private const string RockE = "rock_moss_set_02#rock12";
        private const string RockF = "rock_moss_set_02#rock13";
        // 현대 — 드럼통·낡은 타이어·배전함·덮개 씌운 차·콘크리트 방호벽
        private const string Drum = "barrel_03";
        private const string Tyre = "old_tyre";
        private const string UtilityBox = "utility_box_01";
        private const string Car = "covered_car";
        private const string Barrier = "concrete_road_barrier_02";
        // 미래(시간 틈 잔해) — 탐사선 계기·감시 눈·탐조등·중계함·발전기
        private const string Probe = "vintage_spacecraft_instrument";
        private const string Eye = "security_camera_02";
        private const string Searchlight = "portable_searchlight";
        private const string Relay = "power_box_01";
        private const string Generator = "portable_generator";

        /// <summary>모델 id(`#` 앞) 전부 — 편집기 빌드가 이 목록만 불러 넣는다.</summary>
        public static readonly string[] ModelIds =
        {
            FirePit, Barrel, Crate, Lantern, Shield, Basket, Bucket, Snag, "rock_moss_set_02",
            Drum, Tyre, UtilityBox, Car, Barrier,
            Probe, Eye, Searchlight, Relay, Generator,
        };

        /// <summary>
        /// 명소 층 일곱 — `DungeonLandmarkData.All` 순. 방(20×20) 안에서 잡졸 넷·두목/호위·볼일 자리·문 표지·들어오는 자리·남쪽 문길·
        /// 바이옴 꾸밈(−8, 5)을 비킨 벽 가 띠(|x| 6.4~8.6)와 모서리에만 선다(`PlaytestDungeonEraDecor`).
        /// </summary>
        public static readonly Set[] Landmarks =
        {
            // 殉陵 — 무덤 돌·제등·제기 / 발굴단이 두고 간 방호벽·조명 배전함 / 뜬 탐조등
            new Set { Id = "tomb", NameKo = "순장 왕릉", Pieces = new[] {
                P(RockB, -7.6f, -4.2f, 0.9f, 20f),
                P(RockE, -7.4f, -1.2f, 0.8f, 110f),
                P(Lantern, -6.6f, -2.7f, 1f, 0f, false),
                P(Bucket, 7.4f, -6.6f, 1f, 30f, false),
                M(P(Barrier, 6.8f, -8.2f, 1f, 0f)),
                M(P(UtilityBox, 8.1f, 1.5f, 1f, 270f)),
                Rift(P(Searchlight, 7.2f, 6.9f, 3.2f, 200f), 1.9f),
            } },
            // 廢樓城 — 꽂힌·눕은 방패·병기 궤짝·술통 / 성문을 막은 방호벽·타이어 / 떠 있는 감시 눈
            new Set { Id = "fort", NameKo = "무너진 망루성", Pieces = new[] {
                Sunk(Tilt(P(Shield, -7.6f, -3.2f, 1f, 80f), -12f), 0.3f),
                Tilt(P(Shield, -6.9f, -6.4f, 1f, 140f, false), 88f),
                P(Crate, 7.5f, -6.6f, 1f, 10f),
                Up(P(Crate, 7.5f, -6.6f, 1f, 28f), 0.66f),
                P(Barrel, 7.9f, -4.6f, 1f, 40f),
                M(P(Barrier, -7.9f, 0.9f, 1f, 90f)),
                M(Tilt(P(Tyre, 7.6f, 3.2f, 1f, 30f, false), -12f)),
                Rift(P(Eye, 6.9f, 6.9f, 3.2f, 220f), 2.0f),
            } },
            // 黑風寨 — 화덕·술통·궤짝·바구니 / 약탈한 딴 시대 드럼통·타이어 / 뜬 발전기
            new Set { Id = "bandit", NameKo = "흑풍 산채", FireLocal = new Vector3(-6.8f, 0.9f, -5.6f), Pieces = new[] {
                P(FirePit, -6.8f, -5.6f),
                P(Barrel, 7.7f, -5.1f),
                P(Barrel, 8.0f, -3.5f, 1f, 40f),
                P(Crate, 7.4f, 4.6f, 1f, 15f),
                P(Basket, -7.6f, -2.4f, 1f, 0f, false),
                M(P(Drum, -7.9f, 1.3f)),
                M(Tilt(P(Tyre, 6.3f, -8.0f, 1f, 80f, false), -14f)),
                Rift(P(Generator, 7.0f, 7.0f, 2.0f, 45f), 1.9f),
            } },
            // 沈龍宮 — 물이 빠진 이끼 바위·들통 / 떠밀려 온 드럼통·타이어 / 가라앉았던 탐사선 계기
            new Set { Id = "palace", NameKo = "가라앉은 용궁", Pieces = new[] {
                P(RockF, -7.5f, -4.6f, 1.1f, 30f),
                P(RockD, 7.5f, -5.9f, 1.0f, 200f),
                P(RockA, 7.6f, 4.9f, 0.9f, 110f),
                P(Bucket, -7.3f, -1.3f, 1f, 60f, false),
                M(Tilt(P(Drum, 7.7f, -2.0f, 1f, 20f), 90f)),
                M(Tilt(P(Tyre, -6.6f, -7.7f, 1f, 50f, false), -16f)),
                Rift(P(Probe, 6.9f, 7.0f, 2.4f, 140f), 1.9f),
            } },
            // 業火門 — 그을린 고사목·화덕·방패·술통 / 불에 탄 덮개 차·배전함 / 뜬 중계함
            new Set { Id = "hellgate", NameKo = "업화 대문", FireLocal = new Vector3(7.2f, 0.9f, -6.4f), Pieces = new[] {
                Charred(P(Snag, -7.6f, -5.4f, 1.1f, 60f)),
                P(FirePit, 7.2f, -6.4f),
                Charred(Sunk(Tilt(P(Shield, 7.9f, 2.4f, 1f, 270f), -10f), 0.3f)),
                Charred(P(Barrel, 7.8f, 4.8f, 1f, 20f)),
                Charred(M(P(Car, -7.4f, -0.8f, 0.8f, 0f))),
                Charred(M(P(UtilityBox, 8.1f, -3.6f, 1f, 270f))),
                Rift(P(Relay, 6.9f, 6.9f, 2.6f, 30f), 1.9f),
            } },
            // 雲上闕 — 제등 둘·금빛 보고 궤짝·바구니 / 배전함 / 탐사선 계기·발전기 둘이 구름 사이에 뜬다
            new Set { Id = "cloud", NameKo = "구름 위 금궐", Pieces = new[] {
                P(Crate, -7.4f, -2.2f, 1f, 5f),
                Up(P(Lantern, -7.4f, -2.2f, 1f, 0f, false), 0.66f),
                P(Crate, 7.4f, -2.2f, 1f, -8f),
                Up(P(Lantern, 7.4f, -2.2f, 1f, 0f, false), 0.66f),
                P(Crate, 7.4f, -6.5f, 1f, 20f),
                P(Basket, -7.2f, -6.7f, 1f, 0f, false),
                M(P(UtilityBox, 8.1f, 3.4f, 1f, 270f)),
                Rift(P(Probe, 7.0f, 0.6f, 2.4f, 70f), 2.0f),
                Rift(P(Generator, 7.0f, 7.0f, 2.0f, 200f), 1.9f),
            } },
            // 無名處 — 글자 지워진 비석 돌·제등·바구니 / 도시 잔해 방호벽·배전함 / 뜬 탐조등(순장 왕릉과 같은 자리 — tasks U-0028)
            new Set { Id = "nameless", NameKo = "이름 없는 곳", Pieces = new[] {
                P(RockB, -7.6f, -4.2f, 1.0f, 200f),
                P(RockE, -7.4f, -1.2f, 0.9f, 20f),
                P(Lantern, -6.6f, -2.7f, 1f, 0f, false),
                P(Basket, 7.4f, -6.6f, 1f, 30f, false),
                M(P(Barrier, 6.8f, -8.2f, 1f, 0f)),
                M(P(UtilityBox, 8.1f, 1.5f, 1f, 270f)),
                Rift(P(Searchlight, 7.2f, 6.9f, 3.2f, 200f), 1.9f),
            } },
        };

        /// <summary>
        /// 마을 셋·갈림길 둘 — 씬 이름으로 찾는다(가운데 = 그 방 자리). 문길·행상·등롱·궤짝·촌민·시대 손님을 비킨 모서리에 선다.
        /// 시대 손님(109-2a) 곁엔 제 시대 물건을 둔다 — 택배 기사 곁 타이어, 시간 여행자 곁 감시 눈, 탐사 대원 곁 탐조등, 회사원 곁 배전함.
        /// </summary>
        public static readonly Set[] Towns =
        {
            new Set { Id = "Town2", NameKo = "남쪽 마을", Pieces = new[] {
                P(Crate, -7.6f, -7.4f, 1f, 12f),
                P(Basket, -6.0f, -8.2f, 1f, 0f, false),
                P(Barrel, 7.8f, 7.6f, 1f, 30f),
                M(Tilt(P(Tyre, 7.4f, 5.4f, 1f, 20f, false), -12f)),
                Rift(P(Probe, -7.4f, 7.4f, 2.4f, 60f), 2.0f),
            } },
            new Set { Id = "Town3", NameKo = "서쪽 마을", Pieces = new[] {
                P(Bucket, -7.8f, -3.2f, 1f, 0f, false),
                P(Crate, 7.6f, -7.6f, 1f, 15f),
                P(Barrel, -7.6f, 7.6f, 1f, 70f),
                M(P(Barrier, 7.0f, 8.1f, 1f, 0f)),
                Rift(P(Eye, -7.6f, -7.4f, 3.2f, 120f), 2.0f),
            } },
            new Set { Id = "Town4", NameKo = "동쪽 마을", Pieces = new[] {
                P(Basket, 7.8f, -3.2f, 1f, 0f, false),
                P(Crate, -7.6f, 7.6f, 1f, 20f),
                P(Bucket, -7.8f, -7.6f, 1f, 30f, false),
                M(P(Drum, 7.6f, 7.8f)),
                Rift(P(Searchlight, 7.6f, 2.6f, 3.2f, 250f), 1.9f),
            } },
            new Set { Id = "Crossroads", NameKo = "서남 갈림길", Pieces = new[] {
                P(RockB, -7.4f, -7.2f, 0.9f, 40f),
                P(Crate, -7.6f, 6.8f, 1f, 30f),
                M(P(UtilityBox, 8.1f, -7.4f, 1f, 270f)),
                Rift(P(Generator, 6.9f, 7.1f, 2.0f, 100f), 1.9f),
            } },
            new Set { Id = "Crossroads2", NameKo = "동남 갈림길", Pieces = new[] {
                P(Barrel, 7.6f, -7.4f, 1f, 50f),
                P(RockE, 7.6f, 6.6f, 0.8f, 160f),
                M(Tilt(P(Tyre, -7.4f, -7.6f, 1f, 70f, false), -12f)),
                Rift(P(Relay, -7.1f, 7.1f, 2.6f, 300f), 1.9f),
            } },
        };

        public static string ModelId(string model)
        {
            int hash = model.IndexOf('#');
            return hash >= 0 ? model.Substring(0, hash) : model;
        }
    }
}
