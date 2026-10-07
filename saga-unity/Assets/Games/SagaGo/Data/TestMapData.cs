using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// VERTICAL_SLICE.md의 테스트 지역. saga-godot의 test_map.gd와 같은 글자
    /// 지도를 원안으로 쓰되(0장 — 기획은 공유, 구현만 각자), **2026-09-12
    /// PLAN.md 51장 "GO 월드 확장 — 지도 크기"로 saga-unity 쪽만 남쪽 4줄 +
    /// 동쪽 2칸을 늘렸다**(saga-godot은 아직 7x7 그대로 — 두 트랙이 지도
    /// 크기까지 반드시 같을 필요는 없다, 0장 "기획만 같이 본다"). 지금
    /// 9칸×11칸(칸당 48m = 432m×528m). 기존 BanditEncounter·HiddenTreasure·
    /// Gatherable·MountainShrine·RareWolfEncounter·NpcBuilder·
    /// WanderingAnimal·EastGroveRelic이 전부 상수 (gx,gy)를
    /// `TestMapData.WorldPos(gx,gy)`로만 넘겨 자리를 잡는다 — **행 끝·열
    /// 끝에만 새로 보태면 기존 좌표들의 내용은 하나도 안 바뀐다**(새 행/열은
    /// 기존보다 더 큰 index로만 추가되니까). 동쪽 확장은 마을 행(row2~4)의
    /// 동쪽 벽이 원래 숲(walkable)이라 남쪽처럼 따로 "문"을 뚫을 필요 없이
    /// 자연스럽게 이어진다 — col7에 숲 버퍼 한 칸(+ row3만 들판), col8에
    /// 새 산 경계. 남쪽은 문(col3, '=')을 겹겹이 둔 "공터→벽→공터→벽" 구조
    /// (row5 강+다리 → row6 문 → row7 첫 공터 → row8 문(둘째 조각에서
    /// 새로 뚫음) → row9 둘째 공터(F 논밭 — Legend엔 있었지만 Rows엔 한
    /// 번도 안 쓰이던 타일, 산신당 'S' 때와 같은 결) → row10 새 산 경계).
    /// **주의 — 칸 수가 바뀌면 WorldPos()의 halfW/halfH가 같이 바뀌어 기존
    /// 모든 좌표가 월드 공간에서 다 같이 밀린다**(개별 좌표 사이 관계는
    /// 그대로라 안전하지만, WorldPos()를 거치지 않고 값을 상수로 박아 둔
    /// 자리가 있으면 그 자리만 안 따라간다 — BuildTestVillageScene.cs의
    /// PlayerSpawn이 실제로 이 함정에 걸려 있어서 남쪽 확장 때 WorldPos()
    /// 호출로 고쳤다, 그 뒤 두 번의 확장에서도 그 수정이 그대로 유효함을
    /// 확인).
    ///
    /// ^ 산   T 숲   ~ 강   = 길   H 마을   F 논밭   . 들
    /// C 굴 입구   S 옛 사당   R 폐허   B 다리
    /// </summary>
    public static class TestMapData
    {
        public static readonly string[] Rows =
        {
            "^^^C^^^^^",
            "^TT=TS^^^",
            "T..=..TT^",
            "T.HH.RT.^",
            "T..=..TT^",
            "~~~B~~~~~",
            "^^^=^^^^^",
            "^T...T^^^",
            "^^^=^^^^^",
            "^T.F.T^^^",
            "^^^^^^^^^",
        };

        public const float TileSize = 48f;

        public struct TileInfo
        {
            public string Name;
            public Color Color;
            public bool Walkable;
            public float Height;
        }

        /// <summary>
        /// height — "물은 12cm 낮춘다"는 사가마을 웹판 원칙과 같은 결. 산은
        /// 두드러지고 강은 패어 보이게, 나머지는 거의 평면에 가깝게.
        /// saga-godot의 terrain_builder.gd LEGEND와 같은 수치.
        /// </summary>
        public static readonly Dictionary<char, TileInfo> Legend = new Dictionary<char, TileInfo>
        {
            ['^'] = new TileInfo { Name = "mountain", Color = new Color(0.55f, 0.53f, 0.5f), Walkable = false, Height = 2.5f },
            ['T'] = new TileInfo { Name = "forest", Color = new Color(0.16f, 0.32f, 0.14f), Walkable = true, Height = 0.15f },
            ['~'] = new TileInfo { Name = "river", Color = new Color(0.3f, 0.26f, 0.18f), Walkable = false, Height = -1.0f },
            ['='] = new TileInfo { Name = "path", Color = new Color(0.62f, 0.5f, 0.32f), Walkable = true, Height = 0.05f },
            ['H'] = new TileInfo { Name = "village", Color = new Color(0.78f, 0.68f, 0.42f), Walkable = true, Height = 0.1f },
            ['F'] = new TileInfo { Name = "farmland", Color = new Color(0.55f, 0.58f, 0.22f), Walkable = true, Height = 0.05f },
            ['.'] = new TileInfo { Name = "plains", Color = new Color(0.38f, 0.55f, 0.24f), Walkable = true, Height = 0.0f },
            ['C'] = new TileInfo { Name = "cave", Color = new Color(0.2f, 0.2f, 0.22f), Walkable = true, Height = 0.2f },
            ['S'] = new TileInfo { Name = "shrine", Color = new Color(0.5f, 0.42f, 0.3f), Walkable = true, Height = 0.2f },
            ['R'] = new TileInfo { Name = "ruins", Color = new Color(0.45f, 0.42f, 0.4f), Walkable = true, Height = 0.2f },
            ['B'] = new TileInfo { Name = "bridge", Color = new Color(0.5f, 0.36f, 0.2f), Walkable = true, Height = -1.0f },
        };

        public const float WaterHeightAboveBed = 0.55f;

        /// <summary>다리 널판이 강바닥 위로 뜨는 높이. LandmarksBuilder도 이 값을 그대로 쓴다.</summary>
        public const float BridgeClearance = 2.0f;

        /// <summary>산·강을 막는 벽의 높이(둘 다 walkable=false — 다리로만 강을 건넌다).</summary>
        public const float BlockHeight = 6.0f;

        // ---- PLAN.md 107 ② "이동" — 오를 수 있는 산·들어갈 수 있는 강 ----------------------
        // 예전 산은 2.5m 평지 위 보이지 않는 6m 벽, 강은 투명 벽이었다. 이제 산은 칸마다 높이가 다른
        // 절벽 고원(안쪽 12~22m, 지도 테두리 30~38m — 테두리 밖은 NoClimb 경계벽), 강은 수면 아래
        // 3m 남짓 깊이라 헤엄친다. Legend 의 Height 는 옛 배치 코드(다리 널판 등)가 그대로 쓰므로 안 바꾸고,
        // 실제로 보이고 딛는 높이는 GroundHeight() 로 따로 준다.
        public const float RiverBedHeight = -3.5f;
        /// <summary>예전 강바닥(-1) + 0.55 그대로 — 다리 널판(-1 + 2)과의 관계가 안 바뀐다.</summary>
        public const float WaterSurfaceHeight = -0.45f;
        public const float BoundaryWallHeight = 90f;

        public static bool IsBorder(int gx, int gy) => gx <= 0 || gy <= 0 || gx >= Cols - 1 || gy >= RowCount - 1;

        public static bool IsWater(char ch) => ch == '~' || ch == 'B';

        /// <summary>산 칸 고원 높이 — 좌표 해시라 빌드마다 같다.</summary>
        public static float MountainHeight(int gx, int gy)
        {
            uint h = (uint)(gx * 73856093) ^ (uint)(gy * 19349663) ^ 0x9E3779B9u;
            h ^= h >> 13; h *= 0x5bd1e995; h ^= h >> 15;
            float t = (h % 1000) / 999f;
            return IsBorder(gx, gy) ? 30f + t * 8f : 12f + t * 10f;
        }

        // ---- PLAN.md 107-3 봉우리 — 네모 고원 위 뾰족한 바위(육각 뿔대, 기어오를 수 있는 가파름) ----
        public const float PeakBaseRadius = 10f;
        public const float PeakTopRadius = 5f;

        private static float Hash01(int gx, int gy, uint salt)
        {
            uint h = (uint)(gx * 73856093) ^ (uint)(gy * 19349663) ^ salt;
            h ^= h >> 13; h *= 0x5bd1e995; h ^= h >> 15;
            return (h % 1000) / 999f;
        }

        /// <summary>이 산 칸에 봉우리가 있나 — 해시 절반쯤, 옛 망루 칸(4,6)은 뺀다.</summary>
        public static bool HasPeak(int gx, int gy)
        {
            if (TileAt(gx, gy) != '^' || gx < 0 || gy < 0 || gx >= Cols || gy >= RowCount) return false;
            if (gx == 4 && gy == 6) return false;
            return Hash01(gx, gy, 0x51ED270Bu) > 0.5f;
        }

        public static float PeakHeight(int gx, int gy) => 12f + Hash01(gx, gy, 0x2545F491u) * 6f;

        // ---- PLAN.md 107-3 "걸어 오르는 경사·고개" — 절벽 고원에 기대 선 돌 비탈 ----------------------------
        // 28°라 캐릭터 경사 한계(45°) 안에서 걸어 오르고, 윗면 법선 y≈0.88 이라 등반(가파름 문턱 0.5)엔 안 걸린다.
        public const float RampSlopeDeg = 28f;
        public const float RampWidth = 8f;
        /// <summary>비탈 윗끝이 고원 안으로 들어가는 길이(틈이 안 생기게).</summary>
        public const float RampTopOverlap = 0.6f;

        public struct Ramp
        {
            public string Id;
            public int Gx, Gy;      // 발치 칸(걸을 수 있는 칸)
            public int Dx, Dy;      // 발치 → 산 칸 방향(네 방향 중 하나)
            public float Lateral;   // 칸 가운데에서 옆으로 비킨 거리(m)
            public string LabelKey, LabelKo; // M 지도 표시(없으면 안 적음)
        }

        public static readonly Ramp[] Ramps =
        {
            // 고개 — (1,8) 산을 남쪽 공터 숲(1,7)에서 올라 끝 논밭 숲(1,9)으로 내려간다(가운데 길목 문 말고 다른 길)
            new Ramp { Id = "pass_north", Gx = 1, Gy = 7, Dx = 0, Dy = 1, Lateral = 0f, LabelKey = "map.pass", LabelKo = "고개" },
            new Ramp { Id = "pass_south", Gx = 1, Gy = 9, Dx = 0, Dy = -1, Lateral = 0f },
            // 옛 망루 고원(4,6)으로 — 남쪽 공터(4,7) 동쪽 끝에서(가운데 행운 돌탑은 비킨다)
            new Ramp { Id = "tower_slope", Gx = 4, Gy = 7, Dx = 0, Dy = -1, Lateral = 14f, LabelKey = "map.slope", LabelKo = "비탈" },
        };

        /// <summary>비탈의 아래끝 가운데(발치 땅 높이)·위끝 가운데(고원 높이)·오르는 방향·옆 방향.</summary>
        public static void RampGeometry(Ramp r, out Vector3 bottom, out Vector3 top, out Vector3 dir, out Vector3 side)
        {
            dir = new Vector3(r.Dx, 0f, r.Dy);
            side = new Vector3(dir.z, 0f, -dir.x);
            float foot = GroundHeight(r.Gx, r.Gy);
            float high = GroundHeight(r.Gx + r.Dx, r.Gy + r.Dy);
            float run = (high - foot) / Mathf.Tan(RampSlopeDeg * Mathf.Deg2Rad);
            Vector3 edge = WorldPos(r.Gx, r.Gy) + dir * (TileSize * 0.5f) + side * r.Lateral;
            bottom = edge - dir * run + Vector3.up * foot;
            top = edge + dir * RampTopOverlap + Vector3.up * high;
        }

        // ---- PLAN.md 109-9 발원지 폭포 둘(웹 사가만리 ⑰) — 산 고원에서 강으로 떨어진다 -----------------------------

        public struct Waterfall
        {
            public string Id;
            public int Gx, Gy;      // 폭포가 떨어지는 산 칸
            public int Dx, Dy;      // 산 칸 → 강 칸 방향
            public string NameKey, NameKo;
        }

        public const float WaterfallWidth = 9f;
        /// <summary>물이 넘치는 턱이 절벽 면 밖으로 나오는 거리 · 아래끝이 면에서 떨어진 거리.</summary>
        public const float WaterfallLip = 1.4f;
        public const float WaterfallFoot = 2.6f;

        public static readonly Waterfall[] Waterfalls =
        {
            // 동쪽 끝 경계 산(고원 30~38m) — 너른 강의 발원지
            new Waterfall { Id = "fall_east", Gx = 8, Gy = 4, Dx = 0, Dy = 1, NameKey = "map.fall_east", NameKo = "은빛 폭포" },
            // 서쪽 남쪽 산(12~22m) — 강 남쪽 둑으로
            new Waterfall { Id = "fall_west", Gx = 1, Gy = 6, Dx = 0, Dy = -1, NameKey = "map.fall_west", NameKo = "안개 폭포" },
        };

        /// <summary>폭포 턱 가운데(고원 높이·절벽 면 위)·아래끝 가운데(수면)·떨어지는 쪽·옆 방향.</summary>
        public static void WaterfallGeometry(Waterfall w, out Vector3 lip, out Vector3 foot, out Vector3 dir, out Vector3 side)
        {
            dir = new Vector3(w.Dx, 0f, w.Dy);
            side = new Vector3(dir.z, 0f, -dir.x);
            Vector3 edge = WorldPos(w.Gx, w.Gy) + dir * (TileSize * 0.5f);
            lip = edge + Vector3.up * MountainHeight(w.Gx, w.Gy);
            foot = edge + dir * WaterfallFoot + Vector3.up * WaterSurfaceHeight;
        }

        /// <summary>봉우리 밑동 가운데(고원 윗면 높이).</summary>
        public static Vector3 PeakBase(int gx, int gy)
        {
            float jx = (Hash01(gx, gy, 0x68E31DA4u) - 0.5f) * 12f;
            float jz = (Hash01(gx, gy, 0xB5297A4Du) - 0.5f) * 12f;
            return WorldPos(gx, gy) + new Vector3(jx, MountainHeight(gx, gy), jz);
        }

        /// <summary>보이고 딛는 땅 높이 — 산은 고원, 강·다리 칸은 강바닥, 나머지는 Legend 높이.</summary>
        public static float GroundHeight(int gx, int gy)
        {
            char ch = TileAt(gx, gy);
            if (ch == '^') return MountainHeight(gx, gy);
            if (IsWater(ch)) return RiverBedHeight;
            return Legend.TryGetValue(ch, out var info) ? info.Height : 0f;
        }

        public static int Cols => Rows[0].Length;
        public static int RowCount => Rows.Length;

        public static char TileAt(int gx, int gy)
        {
            if (gy < 0 || gy >= Rows.Length) return '^';
            string row = Rows[gy];
            if (gx < 0 || gx >= row.Length) return '^';
            return row[gx];
        }

        /// <summary>격자 좌표 -> 월드 좌표(중심이 원점). 지도의 그림과 걷는 자리가 같은 칸 크기를 쓴다.</summary>
        public static Vector3 WorldPos(float gx, float gy)
        {
            float halfW = Cols * 0.5f;
            float halfH = RowCount * 0.5f;
            return new Vector3((gx - halfW) * TileSize, 0f, (gy - halfH) * TileSize);
        }

        /// <summary>WorldPos()의 역함수 — PLAN.md 24~27장 "동물"의 배회 AI가
        /// 다음 목표 지점이 걸을 수 있는 칸인지 물을 때 쓴다.</summary>
        public static (int gx, int gy) WorldToGrid(Vector3 worldPos)
        {
            float halfW = Cols * 0.5f;
            float halfH = RowCount * 0.5f;
            int gx = Mathf.RoundToInt(worldPos.x / TileSize + halfW);
            int gy = Mathf.RoundToInt(worldPos.z / TileSize + halfH);
            return (gx, gy);
        }
    }
}
