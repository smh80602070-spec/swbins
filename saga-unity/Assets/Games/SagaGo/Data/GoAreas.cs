using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-37 이야기 4~9부 무대 — 지도 밖 독립 땅(서리봉 고원 `GoFrost` 와 같은 방식, 일반화): 지도(±216 × ±264) 밖 먼 곳에 400×540m 땅을 실행 때 짓고,
    /// 명소(큰 반경 16m·작은 반경 7m — 웹 자리 × 0.45)를 찾으면 금·연마석·경험치를 한 번 준다. 드나드는 길은 지도 쪽 돌기둥 ↔ 땅 쪽 경계비 곁 돌기둥(열린 뒤에만).
    /// 다섯째 지역 은하 나루(웹 ⑲-37 `skyport.js`)가 첫 사용자 — 갈림길·잠긴 도읍 같은 뒤 지역도 이 표에 한 벌씩 더한다.
    /// 세이브 `areaFound`("지역:명소" 목록, 버전 그대로 — 옛 세이브는 아무것도 못 찾은 채).
    /// </summary>
    public static class GoAreas
    {
        public const float HalfX = 200f, HalfZ = 270f, Thickness = 10f, WallHeight = 60f;
        public const float BigRadius = 16f, SmallRadius = 7f, GateRadius = 4.5f;
        public const int BigGold = 150, BigPolish = 2, BigExp = 40, SmallGold = 60, SmallExp = 20;

        public sealed class Site
        {
            public string Id, NameKo;
            public GoEra Era;
            public Vector2 Off;     // 가운데에서(x, z — z 가 클수록 남쪽)
            public bool Big;
            public Area Area;
            public string Name => GoLocalization.T("area." + Area.Id + ".site." + Id, NameKo);
            public Vector3 Pos => new Vector3(Area.Center.x + Off.x, 0f, Area.Center.z + Off.y);
            public float Radius => Big ? BigRadius : SmallRadius;
            public string Key => Area.Id + ":" + Id;
        }

        public sealed class Area
        {
            public string Id, NameKo, Hanja, LoreKo, GroundHex;
            public Vector3 Center;
            public Site[] Sites;
            /// <summary>땅으로 드는 지도 쪽 돌기둥 자리(월드).</summary>
            public System.Func<Vector3> MapGate;
            /// <summary>나가는 돌기둥이 서는 명소 id — 그 명소 곁 (4, 0) 에 서고 들어오는 자리는 북쪽 6m.</summary>
            public string GateSite;
            /// <summary>열렸나(드나들 수 있나).</summary>
            public System.Func<bool> Open;
            public int Danger = 1;
            public Color Fog, Sun;
            public float FogDensity = 1.5f;
            public string NameKey => "region." + Id;

            public bool Contains(Vector3 p) => Mathf.Abs(p.x - Center.x) <= HalfX + 5f && Mathf.Abs(p.z - Center.z) <= HalfZ + 5f;
            public bool TrySite(string id, out Site s)
            {
                foreach (var x in Sites) if (x.Id == id) { s = x; return true; }
                s = null;
                return false;
            }
            public Site GateSiteObj { get { TrySite(GateSite, out var s); return s; } }
            /// <summary>땅 쪽 나가는 돌기둥(경계비 곁).</summary>
            public Vector3 SteleGround => GateSiteObj.Pos + new Vector3(4f, 0f, 0f);
            /// <summary>땅에 내리는 자리 — 경계비 북쪽 6m.</summary>
            public Vector3 ArrivalPos => GateSiteObj.Pos + new Vector3(0f, 0.3f, -6f);
            /// <summary>지도 쪽에 내리는 자리 — 돌기둥 남쪽 5m.</summary>
            public Vector3 ReturnPos => MapGate() + new Vector3(0f, 0.3f, 5f);

            public GoWorldMap.Region Region => new GoWorldMap.Region
            {
                Id = Id, NameKey = NameKey, NameKo = NameKo, LabelGx = 0f, LabelGy = 0f, Hanja = Hanja, Danger = Danger, Roster = new FieldEnemy.Kind[0],
                LoreKey = NameKey + ".lore", LoreKo = LoreKo,
            };

            public GoWorldMap.Atmosphere Atmosphere => new GoWorldMap.Atmosphere { RegionId = Id, Fog = Fog, DensityMul = FogDensity, Sun = Sun };
        }

        private static Site S(string id, string name, GoEra era, float x, float z, bool big) =>
            new Site { Id = id, NameKo = name, Era = era, Off = new Vector2(x, z), Big = big };

        private static Area Make(Area a, params Site[] sites)
        {
            a.Sites = sites;
            foreach (var s in sites) s.Area = a;
            return a;
        }

        // ---- 다섯째 지역 은하 나루(웹 ⑲-37) — 웹 명소 다섯·작은 발견 열, 자리 × 0.45 ----
        public static readonly Area Skyport = Make(new Area
        {
            Id = "skyport", NameKo = "은하 나루", Hanja = "銀河", GroundHex = "5b6470",
            LoreKo = "별배가 떠나온 나루. 태양광 밭과 은하역, 옛 절터가 한 땅에 겹쳐 있고 남쪽 끝 틈 고개 너머로 시간 틈 문이 열린다.",
            Center = new Vector3(1400f, 0f, -860f),
            GateSite = "gate",
            MapGate = () => GoStory.GridPos(3.0f, 9.0f),
            Open = () => StoryState.Ch > 14, // 15장을 마쳐야 틈 문이 열린다
            Fog = new Color(0.62f, 0.66f, 0.8f), Sun = new Color(0.9f, 0.92f, 1f), FogDensity = 1.1f, Danger = 2,
        },
            S("port", "별배 나루", GoEra.Future, 0f, -99f, true),
            S("temple", "옛 절터", GoEra.Past, -126f, 45f, true),
            S("station", "은하역", GoEra.Modern, 108f, 81f, true),
            S("farm", "태양광 밭", GoEra.Future, -54f, 162f, true),
            S("gate", "틈 고개 경계비", GoEra.Future, 27f, 234f, true),
            S("courier", "멈춘 배달 기계", GoEra.Future, 72f, -54f, false),
            S("bell", "떨어진 절 종", GoEra.Past, -171f, -18f, false),
            S("phone", "낡은 공중전화", GoEra.Modern, 144f, 18f, false),
            S("capsule", "묻힌 시간 캡슐", GoEra.Future, -27f, 54f, false),
            S("cairn", "길가 돌탑", GoEra.Past, -99f, -90f, false),
            S("sign", "갈림길 이정표", GoEra.Modern, 45f, 144f, false),
            S("crate", "별배 화물 상자", GoEra.Future, 54f, -135f, false),
            S("busstop", "빈 정류장", GoEra.Modern, 171f, 135f, false),
            S("jar", "깨진 옹기", GoEra.Past, -153f, 108f, false),
            S("antenna", "녹슨 안테나", GoEra.Future, 108f, -117f, false));

        public static readonly Area[] All = { Skyport };

        public static bool TryArea(string id, out Area a)
        {
            foreach (var x in All) if (x.Id == id) { a = x; return true; }
            a = null;
            return false;
        }

        /// <summary>그 자리가 든 땅(없으면 null).</summary>
        public static Area AreaAt(Vector3 p)
        {
            foreach (var a in All) if (a.Contains(p)) return a;
            return null;
        }

        public static bool TrySite(string key, out Site s)
        {
            s = null;
            int i = key.IndexOf(':');
            if (i < 0 || !TryArea(key.Substring(0, i), out var a)) return false;
            return a.TrySite(key.Substring(i + 1), out s);
        }

        public static string RewardText(Site s)
        {
            var p = new List<string>();
            p.Add(string.Format(GoLocalization.T("frost.r_gold", "금 {0}"), s.Big ? BigGold : SmallGold));
            if (s.Big) p.Add(string.Format(GoLocalization.T("frost.r_polish", "연마석 {0}"), BigPolish));
            p.Add(string.Format(GoLocalization.T("frost.r_exp", "경험치 {0}"), s.Big ? BigExp : SmallExp));
            return string.Join(" · ", p);
        }
    }

    /// <summary>독립 땅에서 찾은 명소·발견(웹 `save.skyport = { found }` 등을 한 표로) — 열쇠 "지역:명소".</summary>
    public static class AreaState
    {
        private static readonly HashSet<string> _found = new HashSet<string>();
        public static event System.Action Changed;

        public static bool Found(string key) => _found.Contains(key);
        public static int Count => _found.Count;
        public static int CountIn(string areaId)
        {
            int n = 0;
            foreach (var k in _found) if (k.StartsWith(areaId + ":")) n++;
            return n;
        }

        /// <summary>찾았다 — 처음이면 보상(금·연마석·경험치)을 주고 true.</summary>
        public static bool Discover(string key)
        {
            if (!GoAreas.TrySite(key, out var s) || !_found.Add(key)) return false;
            GoldState.Add(s.Big ? GoAreas.BigGold : GoAreas.SmallGold);
            if (s.Big) ArtifactState.AddPolish(GoAreas.BigPolish);
            PlayerStats.AddExp(s.Big ? GoAreas.BigExp : GoAreas.SmallExp);
            Changed?.Invoke();
            return true;
        }

        public static List<string> Snapshot()
        {
            var l = new List<string>(_found);
            l.Sort(string.CompareOrdinal);
            return l;
        }

        /// <summary>불러오기·새 게임·진단 — 없으면(옛 세이브) 아무것도 못 찾은 채. 없는 열쇠는 버린다.</summary>
        public static void Restore(IEnumerable<string> found)
        {
            _found.Clear();
            if (found != null) foreach (var k in found) if (GoAreas.TrySite(k, out _)) _found.Add(k);
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null);
    }
}
