using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-56b 밤의 잔불(웹 사가고 ⑲-56 `nightecho.js` · saga-godot 106 52-5) — 1차 결말(29장) 뒤 실제 시각 21~4시(밤)에만 이야기가 지나간 일곱 곳마다 보랏빛 잔불이 탄다.
    /// 14m 안이면 잔당 셋(들판 전투 무리, 천하 등급 없음 · 체력 ×2 · 공격 ×1.4), 60m 넘게 떠나거나 낮이 되면 거둔다. 다 쓰러뜨리면 그 자리 인물 한 줄 + 금 800 + 무예 교본 1,
    /// 자리마다 그날(새벽 4시 넘김) 한 번. 표·시각 판정은 순수(시각은 `NowFn` 으로 붙든다) — 런타임은 `NightEchoField`.
    /// </summary>
    public static class GoNight
    {
        public const int After = 29, NightFrom = 21, NightTo = 4;
        public const float NearR = 14f, FarR = 60f, FoeRing = 4f, HpMul = 2f, AtkMul = 1.4f;
        public const int RewardGold = 800, RewardGuide = 1;

        public struct Spot
        {
            public string Id, NameKo, WhoNpc, LineKo;
            /// <summary>109-14-69 이 잔불이 타는 이야기 장(0 이면 <see cref="GoNight.After"/> = 29, 새 지역 셋은 2차 결말 38).</summary>
            public int After;
            public Func<Vector3> Where;
            public GoDomain.Foe[] Foes;
            public Vector3 Pos => Where();
            public string Name => GoLocalization.T("night.spot." + Id, NameKo);
            public string Line => GoLocalization.T("night.line." + Id, LineKo);
        }

        private static GoDomain.Foe Imp => new GoDomain.Foe(FieldEnemy.Kind.EmberImp);
        private static GoDomain.Foe Toad => new GoDomain.Foe(FieldEnemy.Kind.DrownedGhost);
        private static GoDomain.Foe Raptor => new GoDomain.Foe(FieldEnemy.Kind.StormWraith);
        private static GoDomain.Foe Hawk => new GoDomain.Foe(FieldEnemy.Kind.StormWraith, GoElement.Anemo);
        private static GoDomain.Foe Fox => new GoDomain.Foe(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo);
        private static GoDomain.Foe Rock => new GoDomain.Foe(FieldEnemy.Kind.EmberImp, GoElement.Geo);       // 웹 rockbear — 암 원소 몸
        private static GoDomain.Foe Bolt => new GoDomain.Foe(FieldEnemy.Kind.StormWraith, GoElement.Electro);   // 웹 bolt — 뇌 원소 몸

        /// <summary>열 자리(웹 SPOTS 일곱 + 2차 결말 뒤 새 지역 셋) — 그 이야기 제단 곁 남쪽 4m(매듭 돌은 북쪽 3m) · 서리봉 고원 가운데 · 잠긴 도읍 모래밭.</summary>
        public static readonly Spot[] Spots =
        {
            new Spot { Id = "ruins", NameKo = "폐허 제단", WhoNpc = "scholar", LineKo = "이 불… 비문 밑에서 올라온 거야. 다 꺼졌으면 좋겠는데.", Where = () => GoStory.GridPos(GoStory.AltarGx, GoStory.AltarGy) + new Vector3(0f, 0f, 4f), Foes = new[] { Imp, Imp, Raptor } },
            new Spot { Id = "road", NameKo = "서쪽 옛길", WhoNpc = "wanderer", LineKo = "……밤마다 이 길 끝에서 불이 튄다. 임금의 미련이다.", Where = () => GoStory.GridPos(GoStory.Altar2Gx, GoStory.Altar2Gy) + new Vector3(0f, 0f, 4f), Foes = new[] { Imp, Hawk, Raptor } },
            new Spot { Id = "peak", NameKo = "북쪽 봉우리", WhoNpc = "haesol", LineKo = "노랫소리가 남았어. 이번엔 내가 끝을 맺을게.", Where = () => GoStory.ArenaPos(GoStory.ArenaAltar) + new Vector3(0f, 0f, 4f), Foes = new[] { Hawk, Raptor, Imp } },
            new Spot { Id = "cape", NameKo = "물마루 곶", WhoNpc = "ferryman", LineKo = "허, 이 늙은이 노 소리에 잔불도 물러가는군.", Where = () => GoStory.GridPos(GoStory.CapeGx, GoStory.CapeGy - 22f / 48f) + new Vector3(0f, 0f, 4f), Foes = new[] { Imp, Toad, Toad } },
            new Spot { Id = "isle", NameKo = "바위섬", WhoNpc = "ferryman", LineKo = "밤 물살이 잔불을 실어 오네. 이제 진짜 끝이겠지.", Where = () => GoStory.IslePos(new Vector2(0f, 4f)), Foes = new[] { Imp, Toad, Hawk } },
            new Spot { Id = "frost", NameKo = "서리봉 고원", WhoNpc = "haram", LineKo = "(무전) 관측소 온도계가 밤마다 튀었는데 — 이 불 때문이었어요.", Where = () => GoStory.FrostPos(Vector2.zero), Foes = new[] { Fox, Fox, Hawk } },
            new Spot { Id = "sunken", NameKo = "잠긴 도읍 모래밭", WhoNpc = "mulsae", LineKo = "밤 바다에 보랏빛이 비치더니 — 그게 이거였구려.", Where = () => GoStory.AreaPos("sunken:gate", GoStory.SandArrive), Foes = new[] { Toad, Toad, Raptor } },
            // 109-14-69 2차 결말(38장) 뒤 — 새 지역 셋(웹 ⑲-69 SPOTS amber·vault·fork, 자리는 그 지역 이야기 kill 칸). 오프셋은 웹 off × 그 지역 배율 0.45(굳은 네거리 3.6m·세갈래 성문 10m) — 야적장은 그 자리가 창고(12×8m) 안이라 건물 앞 8.5m.
            new Spot { Id = "amber", NameKo = "굳은 네거리", After = 38, WhoNpc = "chorong", LineKo = "밤에도 신호등이 초록으로 또렷해요. 시계방 괘종도 제 박자를 찾았고요.", Where = () => GoStory.AreaPos("amber:cross", new Vector2(0f, 3.6f)), Foes = new[] { Rock, Imp, Bolt } },
            new Spot { Id = "vault", NameKo = "야적장", After = 38, WhoNpc = "maru", LineKo = "금고 불이 꺼져도 야적장이 어둡지 않아요. 이 잔불이 가로등 노릇을 했나 봐요.", Where = () => GoStory.AreaPos("vault:yard", new Vector2(0f, 8.5f)), Foes = new[] { Rock, Hawk, Fox } },
            new Spot { Id = "fork", NameKo = "세갈래 성문 앞", After = 38, WhoNpc = "byeori", LineKo = "성문 앞에 먹구름 부스러기라니 — 쓸어 줘서 고맙다. 오늘 밤 화덕은 편히 피우겠어.", Where = () => GoStory.AreaPos("fork:gate", new Vector2(0f, 10f)), Foes = new[] { Imp, Bolt, Fox } },
        };

        /// <summary>진단이 시각을 붙든다 — 없으면 지금(지역 시각).</summary>
        public static Func<DateTime> NowFn = () => DateTime.Now;
        /// <summary>진단 손잡이 — true 면 늘 밤(웹 `nightecho.night`, 확인용).</summary>
        public static bool AlwaysNightForTest;

        public static bool Open => StoryState.Ch >= After && !StoryState.OffForTest;
        /// <summary>이 자리의 잔불이 타는 장을 마쳤나 — 1차 결말 자리는 29장, 새 지역 셋은 38장.</summary>
        public static bool SpotOpen(Spot s) => StoryState.Ch >= (s.After > 0 ? s.After : After) && !StoryState.OffForTest;
        /// <summary>실제 시각 21~4시(4시 전)면 밤. 순수.</summary>
        public static bool IsNight(DateTime t) => t.Hour >= NightFrom || t.Hour < NightTo;
        /// <summary>"오늘"의 키 — 새벽 4시에 갈린다. 순수.</summary>
        public static string DayKey(DateTime t) => t.AddHours(-NightTo).ToString("yyyy-MM-dd");
        /// <summary>지금 잔불이 타나 — 열렸고 밤이다.</summary>
        public static bool Lit => Open && (AlwaysNightForTest || IsNight(NowFn()));
        public static int IndexOf(string id) { for (int i = 0; i < Spots.Length; i++) if (Spots[i].Id == id) return i; return -1; }
    }

    /// <summary>109-14-56b 밤의 잔불 — 오늘(새벽 4시에 갈림) 이미 끈 자리(세이브: 날짜·자리 목록, 버전 그대로).</summary>
    public static class NightEchoState
    {
        private static string _day = "";
        private static readonly HashSet<string> _done = new HashSet<string>();

        private static void Roll()
        {
            string dk = GoNight.DayKey(GoNight.NowFn());
            if (_day != dk) { _day = dk; _done.Clear(); }
        }

        public static bool Done(string id) { Roll(); return _done.Contains(id); }
        public static void MarkDone(string id) { Roll(); _done.Add(id); }
        public static string Day { get { Roll(); return _day; } }

        public static List<string> Snapshot() { Roll(); var l = new List<string>(_done); l.Sort(string.CompareOrdinal); return l; }

        /// <summary>불러오기 — 없으면(옛 세이브) 빈 채. 없는 자리는 버린다.</summary>
        public static void Restore(string day, IEnumerable<string> done)
        {
            _day = day ?? "";
            _done.Clear();
            if (done != null) foreach (var id in done) if (GoNight.IndexOf(id) >= 0) _done.Add(id);
        }

        public static void ResetForTest() => Restore("", null);
    }
}
