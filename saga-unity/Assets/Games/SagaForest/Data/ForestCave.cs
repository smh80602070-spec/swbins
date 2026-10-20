using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Forest.Data
{
    /// <summary>
    /// tasks U-0132 땅 아래 층(웹 W-0285 `cave-depth.js`·고돗 G-0242) — 순수 상태. 0층 = 굴 입구 방(횃불·사다리뿐), 1~5층마다
    /// 횃불 받침(열매 1 → 120초 밝힘) · 광맥 둘(하루 한 번씩, 밝으면 ×2) · 사다리를 지키는 짐승(쫓으면 열림) · 5층은 사다리 대신 옛 유물(한 번).
    /// 이 트랙엔 광석이 없어 광맥 = 열매, 5층 광맥 둘(웹 고사리·물고기 화석)은 화석 도감 기존 칸에도 기록, 유물 = 열매 + 화석 한 칸(새 칸 안 만듦).
    /// 지금 층·쫓은 짐승은 판 안 상태(웹과 같음), 저장은 가장 깊이·횃불 끝 시각·유물·오늘 캔 것.
    /// </summary>
    public static class ForestCave
    {
        public const int Floors = 5;
        public const float TorchSec = 120f;
        public const int TorchCost = 1, RelicFruit = 5;
        public const float SightDark = 2.5f, SightLit = 9f;
        private static readonly string[] Floor5Fossils = { "나선화석", "발자국화석" }; // 웹 5층 고사리·물고기 화석 자리
        public const string RelicFossil = "이빨화석";

        public enum Kind { Up, Torch, Ore0, Ore1, Beast, Ladder, Relic }

        [Serializable]
        private class Store
        {
            public int deepest;
            public double torchUntil;
            public bool relic;
            public int dugDay = int.MinValue;
            public List<string> dug = new List<string>();
        }

        private static Store _s = new Store();
        private static readonly HashSet<int> Shooed = new HashSet<int>();

        /// <summary>횃불 시계(유닉스 초) — 진단이 바꿔 끼운다(null 이면 실제 시각).</summary>
        public static Func<double> ClockForTest;
        private static double Now => ClockForTest?.Invoke() ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() / 1000.0;

        /// <summary>-1 = 굴 밖, 0 = 입구 방, 1~5 = 지하 층.</summary>
        public static int Floor { get; private set; } = -1;
        public static bool Inside => Floor >= 0;
        public static int Deepest => _s.deepest;
        public static bool RelicTaken => _s.relic;
        public static bool Lit => _s.torchUntil > Now;
        public static int TorchLeft => Math.Max(0, (int)Math.Ceiling(_s.torchUntil - Now));
        public static float Sight => Lit ? SightLit : SightDark;
        public static bool IsShooed(int floor) => Shooed.Contains(floor);

        public static event Action Changed;

        /// <summary>이 층에 있는 것 — 0층은 위로·횃불·사다리, 1~4층은 짐승·광맥 둘이 더, 5층은 사다리 대신 유물.</summary>
        public static IEnumerable<Kind> KindsOn(int floor)
        {
            yield return Kind.Up;
            yield return Kind.Torch;
            if (floor >= 1)
            {
                yield return Kind.Ore0;
                yield return Kind.Ore1;
                yield return Kind.Beast;
            }
            yield return floor >= Floors ? Kind.Relic : Kind.Ladder;
        }

        public static string BeastName(int floor) => ForestLocalization.T("cave.beast." + Mathf.Clamp(floor, 1, Floors), "굴 짐승");

        private static List<string> DugToday()
        {
            int day = ForestVisitors.Today;
            if (_s.dugDay != day) { _s.dugDay = day; _s.dug.Clear(); }
            return _s.dug;
        }

        public static bool DugToday(int floor, int ore) => DugToday().Contains(floor + ":" + ore);

        // ---- 굴 드나들기 ----

        public static void Enter()
        {
            Floor = 0;
            Shooed.Clear();
            Changed?.Invoke();
        }

        public static void Leave()
        {
            Floor = -1;
            Shooed.Clear();
            Changed?.Invoke();
        }

        // ---- 행동(결과 글을 돌려준다, ok = 무엇이 바뀌었나) ----

        public static bool LightTorch(out string text)
        {
            if (Lit) { text = string.Format(ForestLocalization.T("cave.torch_still", "🔥 아직 {0}초 탄다"), TorchLeft); return false; }
            if (!ForestState.SpendFruit(TorchCost)) { text = ForestLocalization.T("cave.torch_need", "열매가 1개 있어야 횃불을 밝힌다"); return false; }
            _s.torchUntil = Now + TorchSec;
            text = ForestLocalization.T("cave.torch_lit", "🔥 횃불을 밝혔다 — 2분, 멀리 보이고 광맥이 둘씩 나온다");
            Changed?.Invoke();
            return true;
        }

        public static bool Dig(int ore, out string text)
        {
            if (Floor < 1 || ore < 0 || ore > 1) { text = null; return false; }
            if (DugToday(Floor, ore)) { text = ForestLocalization.T("cave.dug", "오늘은 다 캤다 — 내일 다시"); return false; }
            int n = Lit ? 2 : 1;
            DugToday().Add(Floor + ":" + ore);
            ForestState.AddFruit(n);
            text = string.Format(ForestLocalization.T("cave.dig", "⛏️ 지하 {0}층 광맥 — 열매 +{1}"), Floor, n) + (Lit ? ForestLocalization.T("cave.dig_lit", " (횃불 덕에 둘)") : "");
            if (Floor >= Floors)
            {
                string fossil = Floor5Fossils[ore];
                bool isNew = ForestMuseumState.Record(ForestMuseumState.Category.Fossil, fossil);
                text += string.Format(ForestLocalization.T(isNew ? "cave.fossil_new" : "cave.fossil", isNew ? " · {0} 처음 발견(도감)" : " · {0}"), ForestMuseumState.DisplayName(fossil));
            }
            Changed?.Invoke();
            return true;
        }

        public static bool Shoo(out string text)
        {
            if (Floor < 1) { text = null; return false; }
            if (!Shooed.Add(Floor)) { text = ForestLocalization.T("cave.shooed_already", "이미 달아났다"); return false; }
            text = string.Format(ForestLocalization.T("cave.shoo", "{0}이(가) 어둠 속으로 달아났다 — 사다리가 열렸다"), BeastName(Floor));
            Changed?.Invoke();
            return true;
        }

        public static bool Down(out string text)
        {
            if (Floor < 0 || Floor >= Floors) { text = ForestLocalization.T("cave.bottom", "여기가 맨 아래다"); return false; }
            if (Floor >= 1 && !Shooed.Contains(Floor)) { text = string.Format(ForestLocalization.T("cave.guarded", "{0}이(가) 사다리를 지킨다 — 먼저 쫓는다"), BeastName(Floor)); return false; }
            Floor++;
            if (Floor > _s.deepest) _s.deepest = Floor;
            text = string.Format(ForestLocalization.T("cave.down", "🪜 지하 {0}층 — {1}"), Floor,
                Lit ? ForestLocalization.T("cave.down_lit", "횃불이 밝다") : ForestLocalization.T("cave.down_dark", "어둡다, 횃불 받침을 찾자"));
            Changed?.Invoke();
            return true;
        }

        /// <summary>한 층 위로. 0층에서 부르면 굴 밖으로(Floor = -1) — 돌려주는 값이 false 면 밖으로 나간 것.</summary>
        public static bool Up(out string text)
        {
            if (Floor <= 0) { Leave(); text = ForestLocalization.T("cave.out", "굴 밖으로 나왔다"); return false; }
            Floor--;
            text = Floor > 0 ? string.Format(ForestLocalization.T("cave.up", "🪜 지하 {0}층으로 올라왔다"), Floor) : ForestLocalization.T("cave.up_entry", "🪜 굴 입구 방으로 올라왔다");
            Changed?.Invoke();
            return true;
        }

        public static bool TakeRelic(out string text)
        {
            if (Floor < Floors) { text = null; return false; }
            if (_s.relic) { text = ForestLocalization.T("cave.relic_gone", "유물은 이미 가져갔다"); return false; }
            _s.relic = true;
            ForestState.AddFruit(RelicFruit);
            ForestMuseumState.Record(ForestMuseumState.Category.Fossil, RelicFossil);
            text = string.Format(ForestLocalization.T("cave.relic", "🏺 옛 유물 — {0}(도감) · 열매 +{1}"), ForestMuseumState.DisplayName(RelicFossil), RelicFruit);
            Changed?.Invoke();
            return true;
        }

        /// <summary>곁에 선 것의 이름 한 줄(힌트 단추).</summary>
        public static string Label(Kind k)
        {
            switch (k)
            {
                case Kind.Up: return Floor > 0 ? string.Format(ForestLocalization.T("cave.lbl_up", "🪜 {0}층으로 올라간다"), Floor - 1 > 0 ? (Floor - 1).ToString() : ForestLocalization.T("cave.entry", "입구"))
                                            : ForestLocalization.T("cave.lbl_out", "굴 밖으로 나간다");
                case Kind.Torch: return Lit ? string.Format(ForestLocalization.T("cave.lbl_torch_lit", "🔥 횃불 — {0}초 남음"), TorchLeft) : ForestLocalization.T("cave.lbl_torch", "🔥 횃불 받침 — 열매 1 로 2분");
                case Kind.Ore0:
                case Kind.Ore1: return DugToday(Floor, k == Kind.Ore0 ? 0 : 1) ? ForestLocalization.T("cave.lbl_ore_done", "⛏️ 광맥 (오늘은 다 캤다)") : ForestLocalization.T("cave.lbl_ore", "⛏️ 광맥 — 캔다");
                case Kind.Beast: return BeastName(Floor) + (IsShooed(Floor) ? ForestLocalization.T("cave.lbl_beast_gone", " (달아났다)") : ForestLocalization.T("cave.lbl_beast", " — 쫓는다"));
                case Kind.Ladder: return string.Format(ForestLocalization.T("cave.lbl_ladder", "🪜 {0}층으로 내려간다"), Floor + 1) + (Floor >= 1 && !IsShooed(Floor) ? ForestLocalization.T("cave.lbl_guarded", " (짐승이 지킨다)") : "");
                default: return _s.relic ? ForestLocalization.T("cave.lbl_relic_gone", "🏺 유물 자리 (가져갔다)") : ForestLocalization.T("cave.lbl_relic", "🏺 옛 유물 — 가져간다");
            }
        }

        /// <summary>목표판 첫 줄 — 굴 안일 때만.</summary>
        public static string HudLine()
        {
            if (!Inside) return "";
            string where = Floor == 0 ? ForestLocalization.T("cave.hud_entry", "굴 입구") : string.Format(ForestLocalization.T("cave.hud_floor", "지하 {0}층/{1}"), Floor, Floors);
            string light = Lit ? string.Format(ForestLocalization.T("cave.hud_lit", "🔥 {0}초"), TorchLeft) : ForestLocalization.T("cave.hud_dark", "🌑 어둠");
            return string.Format(ForestLocalization.T("cave.hud", "{0} · {1} · 가장 깊이 {2}층"), where, light, _s.deepest);
        }

        // ---- 저장 ----

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            if (_s.dug == null) _s.dug = new List<string>();
            _s.deepest = Mathf.Clamp(_s.deepest, 0, Floors);
            Floor = -1; // R-5 리뷰 — 불러오면 굴 밖에서 시작(러너가 갇힌 자리·어둠을 정리)
            Shooed.Clear();
            Changed?.Invoke();
        }

        public static void ResetForTest()
        {
            Restore(null);
            Floor = -1;
            Shooed.Clear();
            ClockForTest = null;
        }
    }
}
