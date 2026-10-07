using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 109-10-4 "고정 세계 지역 아홉" — 웹 사가나락 PLAN §5.12 결(코드 공유 없음, 웹 `world-map.js` REGIONS 의 키·이름·한자·시대·사연·땅빛을 옮겼다).
    /// 웹은 481×481 칸 들판을 방위 아홉으로 가르지만, 이 트랙의 바깥 세상은 이미 **30m 간격 3×3 칸에 손으로 박은 방**이다
    /// (가운데 모루골 · 남 Town2 · 서 Town3 · 동 Town4 · 서남·동남 갈림길 · 서북 잊힌 능묘 입구 · 북 던전 길 Room2~4 · 동북 옛 감시탑 뜰).
    /// 그 칸 하나 = 지역 하나로 방위를 그대로 맞췄다. 웹이 고친 "절차 들판 끼임"은 이 트랙엔 절차 들판이 없어 해당 없음.
    /// 칸 밖(던전 층 ProcRoom·능묘 속 방·난입/시련 격리 방)은 지역 없음(null) — 웹 "던전 안은 명소 층만 고정"과 같은 결.
    /// 무작위 없음. 세이브 없음(지도는 코드가 정한다). 위험도·명단·우두머리는 §5.13(109-10-5), 사연 사슬은 §5.14(109-10-6).
    /// 웹의 지역 전용 시대 소품(t_factory 등)은 109-2b 마을·갈림길 꾸밈이 이미 세 시대라 여기서 더 안 세운다.
    /// </summary>
    public static class DungeonWorldMap
    {
        /// <summary>칸 간격·칸 반폭 — `BuildTestDungeonScene` 의 마을·갈림길 중심(±30)과 복도 한가운데(±15)에서.</summary>
        public const float Cell = 30f;
        public const float Half = 15f;
        /// <summary>바깥 한계 — 칸 가운데 ±30 에 방 반폭 10·복도를 더한 것. 이 밖(능묘 속 시련 방 x=-60·난입 방 60,60)은 지역 없음.</summary>
        public const float Outer = 45f;
        /// <summary>북 칸(던전 길)은 Room4 뒤 복도 끝까지 — 그 너머 ProcRoom(z=120, 반폭 10)은 던전 층이라 지역 없음.</summary>
        public const float NorthEnd = 110f;
        /// <summary>웹 수치 그대로 — 지역에 이만큼 머물면 배너.</summary>
        public const float DwellSeconds = 1.2f;

        public struct Region
        {
            public string Key;
            public string NameKo;
            public string Hanja;
            /// <summary>웹 era 키: past·modern·future·myth(한 지역에 둘까지).</summary>
            public string[] Eras;
            public string DescKo;
            /// <summary>웹 ground(들판 땅 색) — 여기선 그 칸 방 바닥에 옅게 곱한다(<see cref="FloorTint"/>).</summary>
            public Color Ground;
            /// <summary>칸 자리(-1·0·1) — x 는 서→동, z 는 남→북.</summary>
            public int GridX, GridZ;
            /// <summary>그 칸의 자리 이름(마을·갈림길 이름) — 이름은 전부 지어낸 것(모루골은 원래 이름).</summary>
            public string PlaceKo;
            /// <summary>그 칸의 방(씬 경로) — 바닥 땅빛을 받는다.</summary>
            public string[] Rooms;
        }

        private static Color Hex(int rgb) => new Color(((rgb >> 16) & 255) / 255f, ((rgb >> 8) & 255) / 255f, (rgb & 255) / 255f);

        /// <summary>웹 REGIONS 순서(중원 → 동 → 시계 방향).</summary>
        public static readonly Region[] All =
        {
            new Region { Key = "jungwon", NameKo = "중원 벌판", Hanja = "中原", Eras = new[] { "past" },
                DescKo = "기와와 초가 사이로 논두렁과 숲이 이어진다", Ground = Hex(0x46632f),
                GridX = 0, GridZ = 0, PlaceKo = "모루골", Rooms = new[] { "/Room" } },
            new Region { Key = "neon", NameKo = "잿빛 폐도시", Hanja = "廢都市", Eras = new[] { "modern" },
                DescKo = "무너진 공장 굴뚝과 콘크리트 잔해, 멈춘 급수탑", Ground = Hex(0x57524b),
                GridX = 1, GridZ = 0, PlaceKo = "굴뚝 마을", Rooms = new[] { "/Town4" } },
            new Region { Key = "saltmarsh", NameKo = "소금 개펄", Hanja = "鹽田", Eras = new[] { "past", "modern" },
                DescKo = "물 빠진 갯벌과 갈대, 바다를 보던 녹슨 관측탑", Ground = Hex(0x6d6b52),
                GridX = 1, GridZ = -1, PlaceKo = "갯벌 갈림길", Rooms = new[] { "/Crossroads2" } },
            new Region { Key = "hellgate", NameKo = "지옥 균열", Hanja = "地獄龜裂", Eras = new[] { "myth" },
                DescKo = "붉게 갈라진 바위와 동굴 아가리, 잎 없는 나무들", Ground = Hex(0x4d2621),
                GridX = 0, GridZ = -1, PlaceKo = "잿불 마을", Rooms = new[] { "/Town2" } },
            new Region { Key = "solar", NameKo = "태양 신도시", Hanja = "新都市", Eras = new[] { "future" },
                DescKo = "태양광 판이 늘어선 개척지, 반듯한 길과 야영 천막", Ground = Hex(0x5d6c3e),
                GridX = -1, GridZ = -1, PlaceKo = "볕판 갈림길", Rooms = new[] { "/Crossroads" } },
            new Region { Key = "silkroad", NameKo = "서역 모랫길", Hanja = "西域", Eras = new[] { "past" },
                DescKo = "대상(隊商)의 야영지와 모래에 반쯤 묻힌 옛 유적", Ground = Hex(0xa08a5a),
                GridX = -1, GridZ = 0, PlaceKo = "낙타 마을", Rooms = new[] { "/Town3" } },
            new Region { Key = "heaven", NameKo = "천계 사당", Hanja = "天界", Eras = new[] { "myth", "future" },
                DescKo = "구름 위 사당과 빛으로 새긴 홀로그램 비석", Ground = Hex(0x6b6b8c),
                GridX = -1, GridZ = 1, PlaceKo = "잊힌 능묘 어귀", Rooms = new[] { "/Temple_ForgottenTomb/Temple_Entrance" } },
            new Region { Key = "snowfort", NameKo = "북방 설산", Hanja = "北方雪山", Eras = new[] { "past", "modern" },
                DescKo = "눈 덮인 산성 폐허, 골짜기를 가로지르는 케이블카 기둥", Ground = Hex(0x8e959d),
                GridX = 0, GridZ = 1, PlaceKo = "굴혈 가는 길", Rooms = new[] { "/Room2", "/Room3", "/Room4" } },
            new Region { Key = "scrap", NameKo = "기계 황무지", Hanja = "機械荒蕪", Eras = new[] { "future" },
                DescKo = "쓰러진 기계 더미 사이로 홀로그램 표지가 깜빡인다", Ground = Hex(0x4b4553),
                GridX = 1, GridZ = 1, PlaceKo = "옛 감시탑 뜰", Rooms = new[] { "/WatchCourt/WatchCourt_Room" } },
        };

        /// <summary>그 자리의 지역 번호, 칸 밖이면 -1. 칸 경계는 복도 한가운데(±15) — 걸어 지나가면 복도 절반에서 바뀐다.</summary>
        public static int IndexAt(Vector3 p)
        {
            if (p.z >= NorthEnd || p.z < -Outer || Mathf.Abs(p.x) > Outer) return -1;
            int gx = p.x < -Half ? -1 : p.x > Half ? 1 : 0;
            int gz = p.z < -Half ? -1 : p.z > Half ? 1 : 0;
            if (gz == 1 && gx != 0 && p.z > Outer) return -1; // 능묘 속 방(-30,60)·(-30,90) 등 — 서북·동북 칸은 방 하나뿐.
            return IndexOfCell(gx, gz);
        }

        public static int IndexOfCell(int gx, int gz)
        {
            for (int i = 0; i < All.Length; i++) if (All[i].GridX == gx && All[i].GridZ == gz) return i;
            return -1;
        }

        public static int IndexOf(string key)
        {
            for (int i = 0; i < All.Length; i++) if (All[i].Key == key) return i;
            return -1;
        }

        /// <summary>칸 가운데(세계 좌표) — 진단·지도용.</summary>
        public static Vector3 CellCenter(int i) => new Vector3(All[i].GridX * Cell, 0f, All[i].GridZ * Cell);

        /// <summary>바닥에 곱할 빛 — 웹 땅색을 가장 밝은 채널로 나눠 밝기는 두고 색조만, 흰색과 <see cref="TintStrength"/> 만큼 섞는다
        /// (PBR 바닥 텍스처가 그대로 보이게 — 웹처럼 단색으로 칠하면 사진 재질이 죽는다).</summary>
        public const float TintStrength = 0.4f;
        public static Color FloorTint(int i)
        {
            var g = All[i].Ground;
            float m = Mathf.Max(0.01f, Mathf.Max(g.r, Mathf.Max(g.g, g.b)));
            var hue = new Color(g.r / m, g.g / m, g.b / m, 1f);
            return Color.Lerp(Color.white, hue, TintStrength);
        }

        public static string Name(int i) => DungeonLocalization.T($"region.{All[i].Key}", All[i].NameKo);
        public static string Desc(int i) => DungeonLocalization.T($"region.{All[i].Key}.desc", All[i].DescKo);
        public static string Place(int i) => DungeonLocalization.T($"region.{All[i].Key}.place", All[i].PlaceKo);

        public static string EraLabel(string era) => era switch
        {
            "past" => DungeonLocalization.T("region.era.past", "과거"),
            "modern" => DungeonLocalization.T("region.era.modern", "현대"),
            "future" => DungeonLocalization.T("region.era.future", "미래"),
            _ => DungeonLocalization.T("region.era.myth", "신화"),
        };

        public static string Eras(int i)
        {
            var e = All[i].Eras;
            var parts = new string[e.Length];
            for (int k = 0; k < e.Length; k++) parts[k] = EraLabel(e[k]);
            return string.Join("·", parts);
        }

        /// <summary>들어섬 배너 첫 줄 — "— 이름 한자 —".</summary>
        public static string BannerTitle(int i) => $"— {Name(i)} {All[i].Hanja} —";
        /// <summary>들어섬 배너 둘째 줄 — 자리 · 시대 · 사연.</summary>
        public static string BannerLine(int i) => $"{Place(i)} · {Eras(i)} · {Desc(i)}";
    }
}
