using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-27a 서리봉 고원(웹 사가만리 ⑲-27 `frost.js` = saga-godot 106 ㊺-1) — 이야기 2부 무대인 넷째 땅.
    /// 이 트랙은 글자 지도(9×11 칸)를 못 늘리므로(칸 수가 바뀌면 굳힌 씬·좌표가 다 밀린다) 고원은 **지도 북쪽 밖 먼 곳의 독립 눈밭**
    /// (구름섬처럼 실행 때 짓는다)이고, 드나드는 길은 북쪽 산기슭 역참 곁 "서리 고개" 돌기둥 ↔ 고원 남쪽 경계비 한 쌍이다.
    /// 명소 다섯(옛 산성 터·기상 관측소·추락한 비행선·얼어붙은 호수·서리 고개 경계비)·작은 발견 일곱은 웹 이름·시대·보상 그대로,
    /// 웹 자리(가운데에서 m)는 × 0.45 로 줄였다(이 판 눈밭 크기 400×540m). 명소 30m·발견 14m(웹 GPS 30m)는 16m·7m.
    /// 세이브 `frostFound`(버전 그대로 — 옛 세이브는 아무것도 못 찾은 채).
    /// </summary>
    public static class GoFrost
    {
        public const string RegionId = "frost";

        /// <summary>고원 가운데(월드) — 지도(±216 × ±264) 북쪽 경계벽(90m) 밖.</summary>
        public static readonly Vector3 Center = new Vector3(0f, 0f, -860f);
        public const float HalfX = 200f, HalfZ = 270f, Thickness = 10f, WallHeight = 60f;

        /// <summary>109-14-31 만년설 바위곰왕이 서는 자리 — 고원 가운데에서 서북쪽 64m(명소·이야기 자리·돌기둥에서 멀고, 10장의 "고원 가운데까지 걷기" 를 비킨다).</summary>
        public static readonly Vector3 KingHome = Center + new Vector3(-45f, 0f, 45f);

        /// <summary>109-14-27b 고원 들판 무리 다섯(웹 절차 무리 대신 고정 자리 — 명소 큰 46m·작은 24m·곰왕 20m 밖) · 가운데에서 m.</summary>
        public struct WildGroup { public string Id; public Vector2 Off; public FoeSpec[] Foes; }
        public struct FoeSpec { public FieldEnemy.Kind Kind; public GoElement El; }
        // 14-1b — 웹 그대로 제 괴물: 눈여우(빙)·바위곰(암)·회오리매(풍). 원소는 그 괴물이 가진다.
        private static FoeSpec Fx() => new FoeSpec { Kind = FieldEnemy.Kind.IceFox, El = GoElement.Cryo };
        private static FoeSpec Bear() => new FoeSpec { Kind = FieldEnemy.Kind.RockBear, El = GoElement.Geo };
        private static FoeSpec Hawk() => new FoeSpec { Kind = FieldEnemy.Kind.WindHawk, El = GoElement.Anemo };
        public static readonly WildGroup[] Wild =
        {
            new WildGroup { Id = "frost_w", Off = new Vector2(-80f, 10f), Foes = new[] { Fx(), Fx(), Bear() } },
            new WildGroup { Id = "frost_e", Off = new Vector2(70f, 60f), Foes = new[] { Hawk(), Hawk(), Fx() } },
            new WildGroup { Id = "frost_s", Off = new Vector2(-30f, 130f), Foes = new[] { Bear(), Fx(), Hawk() } },
            new WildGroup { Id = "frost_ne", Off = new Vector2(150f, -100f), Foes = new[] { Fx(), Fx(), Fx() } },
            new WildGroup { Id = "frost_c", Off = new Vector2(20f, -40f), Foes = new[] { Hawk(), Bear(), Fx() } },
        };

        public const float BigRadius = 16f, SmallRadius = 7f, GateRadius = 4.5f;
        public const int BigGold = 150, BigPolish = 2, BigExp = 40, SmallGold = 60, SmallExp = 20;

        public const float SnowBox = 44f, SnowHeight = 14f, SnowFall = 2.4f;
        public const int SnowRate = 45;

        public struct Site
        {
            public string Id, NameKo;
            public GoEra Era;
            public Vector2 Off;     // 가운데에서(x, z — z 가 클수록 남쪽)
            public bool Big;
            public string Name => GoLocalization.T("frost.site." + Id, NameKo);
            public Vector3 Pos => new Vector3(Center.x + Off.x, 0f, Center.z + Off.y);
        }

        private static Site S(string id, string name, GoEra era, float x, float z, bool big) =>
            new Site { Id = id, NameKo = name, Era = era, Off = new Vector2(x, z), Big = big };

        /// <summary>웹 `LANDMARKS`(다섯)→`SMALL`(일곱) 순서·이름·시대 그대로, 자리 × 0.45.</summary>
        public static readonly Site[] Sites =
        {
            S("fort", "옛 산성 터", GoEra.Past, 68f, -112f, true),
            S("obs", "기상 관측소", GoEra.Modern, 135f, -54f, true),
            S("ship", "추락한 비행선", GoEra.Future, 99f, 117f, true),
            S("lake", "얼어붙은 호수", GoEra.Past, 0f, 171f, true),
            S("stele", "서리 고개 경계비", GoEra.Past, -27f, 234f, true),
            S("sat", "떨어진 위성 조각", GoEra.Future, 180f, 157f, false),
            S("statue", "장수 석상", GoEra.Past, -90f, 112f, false),
            S("hut", "사냥꾼 오두막", GoEra.Past, 45f, -180f, false),
            S("snowman", "누가 만든 눈사람", GoEra.Modern, -36f, 81f, false),
            S("cable", "멈춘 케이블카", GoEra.Modern, 189f, -135f, false),
            S("cave", "얼음굴 어귀", GoEra.Past, -126f, -36f, false),
            S("beacon", "고원 봉화", GoEra.Past, 112f, 27f, false),
        };

        public static bool TrySite(string id, out Site s)
        {
            foreach (var x in Sites) if (x.Id == id) { s = x; return true; }
            s = default;
            return false;
        }

        public static float RadiusOf(Site s) => s.Big ? BigRadius : SmallRadius;

        /// <summary>고원 눈밭 안인가(경계벽 바깥 5m 까지).</summary>
        public static bool Contains(Vector3 p) => Mathf.Abs(p.x - Center.x) <= HalfX + 5f && Mathf.Abs(p.z - Center.z) <= HalfZ + 5f;

        // ---- 드나드는 길 ----

        /// <summary>북쪽 산기슭 역참 곁 "서리 고개" 돌기둥(들어가는 쪽).</summary>
        public static Vector3 GatePos
        {
            get
            {
                foreach (var w in GoWorldMap.Waypoints)
                    if (w.Id == "wp_north") return GoWorldMap.WaypointPos(w) + new Vector3(-8f, 0f, 2f);
                return GoWorldMap.WaypointPos(GoWorldMap.Waypoints[0]);
            }
        }

        /// <summary>고원 남쪽 경계비(나가는 쪽) 곁 땅.</summary>
        public static Vector3 SteleGround { get { TrySite("stele", out var s); return s.Pos; } }

        /// <summary>고원에 내리는 자리 — 경계비 북쪽 6m.</summary>
        public static Vector3 ArrivalPos => SteleGround + new Vector3(0f, 0.3f, -6f);

        /// <summary>마을 쪽에 내리는 자리 — 돌기둥 남쪽 5m.</summary>
        public static Vector3 ReturnPos => GatePos + new Vector3(0f, 0.3f, 5f);

        public static string RewardText(Site s)
        {
            var p = new List<string>();
            p.Add(string.Format(GoLocalization.T("frost.r_gold", "금 {0}"), s.Big ? BigGold : SmallGold));
            if (s.Big) p.Add(string.Format(GoLocalization.T("frost.r_polish", "연마석 {0}"), BigPolish));
            p.Add(string.Format(GoLocalization.T("frost.r_exp", "경험치 {0}"), s.Big ? BigExp : SmallExp));
            return string.Join(" · ", p);
        }
    }

    /// <summary>찾은 명소·발견(웹 `save.frost = { found }`).</summary>
    public static class FrostState
    {
        private static readonly HashSet<string> _found = new HashSet<string>();
        public static event System.Action Changed;

        public static bool Found(string id) => _found.Contains(id);
        public static int Count => _found.Count;

        /// <summary>찾았다 — 처음이면 보상(금·연마석·경험치)을 주고 true.</summary>
        public static bool Discover(string id)
        {
            if (!GoFrost.TrySite(id, out var s) || !_found.Add(id)) return false;
            GoldState.Add(s.Big ? GoFrost.BigGold : GoFrost.SmallGold);
            if (s.Big) ArtifactState.AddPolish(GoFrost.BigPolish);
            PlayerStats.AddExp(s.Big ? GoFrost.BigExp : GoFrost.SmallExp);
            Changed?.Invoke();
            return true;
        }

        public static List<string> Snapshot()
        {
            var l = new List<string>(_found);
            l.Sort(string.CompareOrdinal);
            return l;
        }

        /// <summary>불러오기·새 게임·진단 — 없으면(옛 세이브) 아무것도 못 찾은 채. 없는 id 는 버린다.</summary>
        public static void Restore(IEnumerable<string> found)
        {
            _found.Clear();
            if (found != null) foreach (var id in found) if (GoFrost.TrySite(id, out _)) _found.Add(id);
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null);
    }
}
