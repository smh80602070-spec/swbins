using System;
using System.Collections.Generic;

namespace Saga.Realm.Data
{
    /// <summary>
    /// tasks U-0098 격자 전술 규칙 — 웹 `saga-web/saga-realm/js/tactics.js`(W-0107) 그대로, 화면 없음(화면은 `RealmTacticsView`).
    /// **옛 판(<see cref="Srpg"/> 끔)**: 8×6 · 내 편 둘째·셋째 열 / 적 여섯째·일곱째 열 · 칸 평지·숲(엄폐 30)·강(못 섬)·성벽(엄폐 50) · 3턴 · AI 양쪽 같은 규칙.
    /// 장수 hp 50+통솔·atk 10+무력/5·def 무력/10·mov 3·rng 지력≥무력이면 2 / 부대 hp 30+병력/200(최대 120)·atk 12·def 2·mov 2·rng 1.
    /// 명중 clamp(65+(atk−def)×2−엄폐, 10, 95) · 피해 atk×2×(0.8~1.2) · 결과 대승 +25%p·사상 ×0.7 / 승 +10 / 무 0 / 패 −25.
    /// **SRPG 본전투(tasks U-0204 ③⑤, <see cref="Srpg"/> 켬 — 정본 `saga-web/saga-realm/PLAN.md` §5-17)**: 판 평지 10×8·강 11×9·공성 12×10 ·
    /// 칸 + 언덕(높이 1 — 위에서 치면 명중 +10%p)·성문(공성 목표) · 승리 조건 하나(대장 격파·성문 점령·N턴 버팀 — 전멸은 늘 승) · 턴 상한 없음(안전 상한 <see cref="TurnCap"/>) ·
    /// 병종 창>기>궁>창(+20%p/−20%p, 기병 mov +1·궁병 rng 2) · 뒤치기 +20%p(맞는 쪽이 보는 반대에서) · 장수 책략(화계·혼란·회복, 한 판 편마다 둘) · 일기토·설전(이웃 적 장수·대장).
    /// **판정 두 벌 금지** — 결과는 <see cref="Apply"/> 의 보정값뿐이고, 공략 판정은 <see cref="RealmWarState.Attack"/> 가 한 번 한다.
    /// 굴림은 판 씨앗 해시(FNV-1a, 웹과 비트 단위 같음 — 같은 씨앗·같은 수순 = 웹과 같은 판·같은 결과). 반올림은 Math.round(= floor(x+0.5)).
    /// 이 트랙 적 성엔 장수가 없어(<see cref="RealmEnemyRecord"/>) 적 편은 부대만 선다(SRPG 는 그중 하나가 대장).
    /// </summary>
    public static class RealmTactics
    {
        public const int Cols = 8, Rows = 6, Turns = 3, Mov = 3, MovTroop = 2, WoundMonths = 3;
        public const int HitMin = 10, HitMax = 95, HitBase = 65;
        /// <summary>SRPG — 상성·높이·뒤치기 덤(%p) · 버팀 턴 · 안전 상한 · 책략 수.</summary>
        public const int ArmEdge = 20, HighEdge = 10, BackEdge = 20, HoldTurns = 6, TurnCap = 30, SchemesPerSide = 2;
        /// <summary>손잡이 — 웹 `rtk.tacticsDmg` 2.</summary>
        public static double DmgMul = 2;
        /// <summary>손잡이 — 웹 `rtk.permadeath` 1(끄면 쓰러진 장수는 전사 대신 중상).</summary>
        public static bool Permadeath = true;
        /// <summary>손잡이 — 웹 `rtk.srpg` 1(tasks U-0204). 끄면 옛 판(8×6·3턴·전술판 켬 토글일 때만).</summary>
        public static bool Srpg = true;
        /// <summary>SRPG 적 부대 세기 배율(자동 대국 60판 승률 45~65% 로 맞춘 값 — U-0204 메모).</summary>
        public static double FoeMul = 2.1;

        public enum Cell { Plain, Forest, River, Wall, Hill, Gate }

        public sealed class Unit
        {
            public string Uid, Id, Side, Kind, Arm = "";
            public int Hp, Max, Mov, Rng, X, Y, Might = 50, Wisdom = 50, Confused;
            public int Fx = 1, Fy;   // 보는 쪽(뒤치기)
            public double Atk, Def;
            public bool Moved, Acted, Chief, Dueled;
        }

        public sealed class LogEntry
        {
            public int Turn, Dmg, Chance;
            public string A, To, What = "attack";
            public bool Hit;
        }

        public sealed class Board
        {
            public string Seed, Land;
            public bool Siege;
            public int W = Cols, H = Rows;
            public Cell[] Cells;
            public List<Unit> Units = new List<Unit>();
            public int Turn = 1, N;
            public string Side = "me", Done;
            /// <summary>SRPG 승리 조건 — "chief"·"gate"·"hold"(옛 판 "").</summary>
            public string Goal = "";
            public bool IsSrpg;
            public Dictionary<string, int> Schemes = new Dictionary<string, int> { ["me"] = SchemesPerSide, ["foe"] = SchemesPerSide };
            public List<LogEntry> Log = new List<LogEntry>();
            // Unity 배선 — Open() 이 채운다(판 자체엔 안 쓴다).
            public string FromCityId, EnemyId;
        }

        public struct Stats
        {
            public int Might, Wisdom, Command;
            public Stats(int might, int wisdom, int command) { Might = might; Wisdom = wisdom; Command = command; }
        }

        public sealed class Outcome
        {
            public string Kind, Name, Goal;
            public int WinPct, Turn, HpMe, HpFoe;
            public float LossMul;
            public List<string> Fallen = new List<string>(), Wounded = new List<string>(), FoeDown = new List<string>();
        }

        /// <summary>공략 판정이 받을 보정값 — <see cref="RealmWarState.Attack"/> 의 끝 인자.</summary>
        public sealed class Bonus
        {
            public string Kind, Where;
            public int WinPct;
            public float LossMul = 1f;
            public List<string> Fallen = new List<string>();
            public List<(string id, int months)> Wounded = new List<(string, int)>();
        }

        private struct OutDef { public string Name; public int WinPct; public float LossMul; }
        private static OutDef Out(string kind)
        {
            switch (kind)
            {
                case "rout": return new OutDef { Name = "대승", WinPct = 25, LossMul = 0.7f };
                case "win": return new OutDef { Name = "승", WinPct = 10, LossMul = 1f };
                case "lose": return new OutDef { Name = "패", WinPct = -25, LossMul = 1f };
                default: return new OutDef { Name = "무승부", WinPct = 0, LossMul = 1f };
            }
        }

        public static int Cover(Cell c) => c == Cell.Forest ? 30 : c == Cell.Wall ? 50 : c == Cell.Gate ? 20 : 0;

        private static int JsRound(double x) => (int)Math.Floor(x + 0.5);

        /// <summary>작은 결정적 해시 0~1 — 웹 hash(seed, salt) 와 비트 단위로 같다.</summary>
        public static double Hash(string seed, string salt)
        {
            unchecked
            {
                uint h = 2166136261u;
                string s = seed + "|" + salt;
                for (int i = 0; i < s.Length; i++) { h ^= s[i]; h *= 16777619u; }
                h ^= h >> 13; h *= 1274126177u; h ^= h >> 16;
                return h / 4294967296.0;
            }
        }

        /// <summary>판 안의 다음 굴림 — 굴릴 때마다 순번이 오른다.</summary>
        private static double Roll(Board b, string salt) { b.N++; return Hash(b.Seed, salt + "#" + b.N.ToString(System.Globalization.CultureInfo.InvariantCulture)); }

        /* ── 판 ── */

        private static (double forest, bool river, double rocks) Mix(string land)
        {
            switch (land)
            {
                case "hill": return (0.28, false, 0);
                case "river": return (0.1, true, 0);
                case "mount": return (0.35, false, 0.08);
                default: return (0.12, false, 0);
            }
        }

        public static string LandKey(RealmLand land) => land == RealmLand.River ? "river" : "plain";

        /// <summary>SRPG 판 크기 — 공성 12×10 · 강 11×9 · 그 밖 10×8.</summary>
        public static (int w, int h) SrpgSize(string land, bool siege) => siege ? (12, 10) : land == "river" ? (11, 9) : (10, 8);

        /// <summary>판 하나 — land = plain|hill|river|mount, siege = 수비 쪽 끝 성벽 줄. 순수 함수(같은 씨앗 = 같은 판). <see cref="Srpg"/> 면 SRPG 판.</summary>
        public static Board MakeBoard(string seed, string land, bool siege) => Srpg ? MakeSrpgBoard(seed, land, siege) : MakeLegacyBoard(seed, land, siege);

        private static Board MakeLegacyBoard(string seed, string land, bool siege)
        {
            var mx = Mix(land);
            if (land != "hill" && land != "river" && land != "mount") land = "plain";
            var cells = new Cell[Cols * Rows];
            for (int y = 0; y < Rows; y++)
            {
                for (int x = 0; x < Cols; x++)
                {
                    var t = Cell.Plain;
                    double r = Hash(seed, "c" + x + "," + y);
                    if (x >= 2 && x <= 5 && r < mx.forest) t = Cell.Forest;
                    else if (mx.rocks > 0 && x >= 2 && x <= 5 && r > 1 - mx.rocks) t = Cell.Wall;
                    cells[y * Cols + x] = t;
                }
            }
            if (mx.river)
            {
                int rx = 3 + (Hash(seed, "rx") < 0.5 ? 0 : 1);
                int f1 = (int)Math.Floor(Hash(seed, "f1") * Rows);
                int f2 = (f1 + 2 + (int)Math.Floor(Hash(seed, "f2") * (Rows - 3))) % Rows;
                for (int y = 0; y < Rows; y++) cells[y * Cols + rx] = (y == f1 || y == f2) ? Cell.Plain : Cell.River;
            }
            if (siege) for (int y = 0; y < Rows; y++) if (y % 2 == 0) cells[y * Cols + (Cols - 2)] = Cell.Wall;
            return new Board { Seed = seed, Land = land, Siege = siege, Cells = cells };
        }

        /// <summary>SRPG 판 — 가운데 띠(내 둘째 열 뒤 ~ 적 둘째 열 앞)에 숲·언덕, 강은 가운데 한 줄(건널목 셋), 공성은 끝에서 셋째 열 성벽(가운데 성문 하나·틈 하나).</summary>
        private static Board MakeSrpgBoard(string seed, string land, bool siege)
        {
            var mx = Mix(land);
            if (land != "hill" && land != "river" && land != "mount") land = "plain";
            var (w, h) = SrpgSize(land, siege);
            var cells = new Cell[w * h];
            double hill = land == "hill" ? 0.16 : 0.08;
            for (int y = 0; y < h; y++)
            {
                for (int x = 0; x < w; x++)
                {
                    var t = Cell.Plain;
                    double r = Hash(seed, "s" + x + "," + y);
                    if (x >= 3 && x <= w - 4)
                    {
                        if (r < mx.forest) t = Cell.Forest;
                        else if (r < mx.forest + hill) t = Cell.Hill;
                        else if (mx.rocks > 0 && r > 1 - mx.rocks) t = Cell.Wall;
                    }
                    cells[y * w + x] = t;
                }
            }
            if (mx.river)
            {
                int rx = w / 2 + (Hash(seed, "rx") < 0.5 ? -1 : 0);
                var fords = new HashSet<int>();
                for (int k = 0; fords.Count < 3 && k < 20; k++) fords.Add((int)Math.Floor(Hash(seed, "ford" + k) * h));
                for (int y = 0; y < h; y++) cells[y * w + rx] = fords.Contains(y) ? Cell.Plain : Cell.River;
            }
            if (siege)
            {
                int wx = w - 3, gy = h / 2, gap = (gy + 3) % h;
                for (int y = 0; y < h; y++) cells[y * w + wx] = y == gy ? Cell.Gate : y == gap ? Cell.Plain : Cell.Wall;
            }
            return new Board { Seed = seed, Land = land, Siege = siege, Cells = cells, W = w, H = h, IsSrpg = true, Goal = siege ? "gate" : "chief" };
        }

        public static Cell? CellAt(Board b, int x, int y) => x < 0 || y < 0 || x >= b.W || y >= b.H ? (Cell?)null : b.Cells[y * b.W + x];
        public static int CoverAt(Board b, int x, int y) { var c = CellAt(b, x, y); return c.HasValue ? Cover(c.Value) : 0; }
        private static bool Passable(Cell c) => c != Cell.River && c != Cell.Wall;

        /// <summary>성문 칸(공성 판, 없으면 null).</summary>
        public static (int x, int y)? GateOf(Board b)
        {
            for (int i = 0; i < b.Cells.Length; i++) if (b.Cells[i] == Cell.Gate) return (i % b.W, i / b.W);
            return null;
        }

        /* ── 유닛 ── */

        /// <summary>장수 병종 — 지력이 무력 이상이면 궁(rng 2), 무력이 통솔 이상이면 기(mov +1), 아니면 창.</summary>
        public static string ArmOf(Stats s) => s.Wisdom >= s.Might ? "bow" : s.Might >= s.Command ? "cav" : "spear";

        public static Unit OfficerUnit(string id, string side, Stats s)
        {
            int hp = 50 + s.Command;
            var u = new Unit { Uid = side + ":" + id, Id = id, Side = side, Kind = "officer", Hp = hp, Max = hp, Atk = 10 + s.Might / 5.0, Def = s.Might / 10.0,
                Mov = Mov, Rng = s.Wisdom >= s.Might ? 2 : 1, Might = s.Might, Wisdom = s.Wisdom };
            if (Srpg) { u.Arm = ArmOf(s); if (u.Arm == "cav") u.Mov++; }
            return u;
        }

        public static Unit TroopUnit(int n, string side, int troops)
        {
            int hp = Math.Min(120, JsRound(30 + troops / 200.0));
            var u = new Unit { Uid = side + ":troop" + n, Id = "", Side = side, Kind = "troop", Hp = hp, Max = hp, Atk = 12, Def = 2, Mov = MovTroop, Rng = 1 };
            if (Srpg)
            {
                u.Arm = n % 3 == 0 ? "spear" : n % 3 == 1 ? "bow" : "cav";
                if (u.Arm == "bow") u.Rng = 2;
                if (u.Arm == "cav") u.Mov++;
            }
            return u;
        }

        /// <summary>SRPG 적 대장 — 부대보다 굳센 수비 대장(체력 ×1.5·공격 +4·무력 70·지력 55), 쓰러지면 「대장 격파」.</summary>
        public static Unit ChiefUnit(string side, int troops)
        {
            var u = TroopUnit(99, side, troops);
            u.Uid = side + ":chief"; u.Kind = "chief"; u.Chief = true; u.Arm = "spear"; u.Rng = 1; u.Mov = MovTroop;
            u.Hp = u.Max = JsRound(u.Max * 1.5); u.Atk += 4; u.Def += 2; u.Might = 70; u.Wisdom = 55;
            return u;
        }

        private static Stats StatsOf(string id, IDictionary<string, Stats> stats)
        {
            if (stats != null && stats.TryGetValue(id, out var s)) return s;
            var o = RealmOfficerPool.Get(id);
            return o != null ? new Stats(o.Might, o.Wisdom, o.Command) : new Stats(60, 60, 60);
        }

        /// <summary>두 편을 세운다 — mine 셋까지, foes 셋까지, 부대는 장수와 합쳐 3~5(모자라면 3000 으로 채움). SRPG 면 적 부대 첫째가 대장.</summary>
        public static List<Unit> UnitsOf(Board b, IList<string> mine, IList<string> foes, IList<int> foeTroops, IDictionary<string, Stats> stats = null)
        {
            var list = new List<Unit>();
            if (mine != null) for (int i = 0; i < mine.Count && i < 3; i++) list.Add(OfficerUnit(mine[i], "me", StatsOf(mine[i], stats)));
            int fo = 0;
            if (foes != null) for (int i = 0; i < foes.Count && i < 3; i++) { list.Add(OfficerUnit(foes[i], "foe", StatsOf(foes[i], stats))); fo++; }
            var tr = new List<int>();
            int cap = b.IsSrpg ? 6 : 5;
            if (foeTroops != null) for (int i = 0; i < foeTroops.Count && i < Math.Max(0, cap - fo); i++) tr.Add(foeTroops[i]);
            while (fo + tr.Count < 3) tr.Add(3000);
            for (int k = 0; k < tr.Count; k++)
            {
                var u = b.IsSrpg && k == 0 && fo == 0 ? ChiefUnit("foe", tr[k]) : TroopUnit(k, "foe", tr[k]);
                if (b.IsSrpg) { u.Hp = u.Max = Math.Max(1, JsRound(u.Max * FoeMul)); u.Atk *= FoeMul; }
                list.Add(u);
            }

            var me = new List<(int x, int y)>();
            var foe = new List<(int x, int y)>();
            for (int y = 0; y < b.H; y++)
            {
                for (int x = 1; x <= 2; x++) me.Add((x, (y * 2 + 1) % b.H));
                if (b.IsSrpg && b.Siege) for (int x = b.W - 2; x >= b.W - 3; x--) foe.Add((x, (y * 2 + 1) % b.H));   // 성벽 뒤(끝 둘째) 앞으로
                else for (int x = b.W - 2; x >= b.W - 3; x--) foe.Add((x, (y * 2 + 1) % b.H));
            }
            if (b.IsSrpg)
            {
                // 가운데 줄부터 — 큰 판에서 양 끝 귀퉁이에 흩어지지 않게
                int mid = b.H / 2;
                me.Sort((p, q) => Math.Abs(p.y - mid).CompareTo(Math.Abs(q.y - mid)) != 0 ? Math.Abs(p.y - mid).CompareTo(Math.Abs(q.y - mid)) : q.x.CompareTo(p.x));
                foe.Sort((p, q) => Math.Abs(p.y - mid).CompareTo(Math.Abs(q.y - mid)) != 0 ? Math.Abs(p.y - mid).CompareTo(Math.Abs(q.y - mid)) : p.x.CompareTo(q.x));
                if (b.Siege) foe.Sort((p, q) => (p.x == b.W - 2 ? 0 : 1).CompareTo(q.x == b.W - 2 ? 0 : 1) != 0 ? (p.x == b.W - 2 ? 0 : 1).CompareTo(q.x == b.W - 2 ? 0 : 1) : Math.Abs(p.y - mid).CompareTo(Math.Abs(q.y - mid)));
            }
            var used = new HashSet<int>();
            foreach (var u in list)
            {
                var s = u.Side == "me" ? me : foe;
                foreach (var p in s)
                {
                    var c = CellAt(b, p.x, p.y);
                    if (used.Contains(p.y * b.W + p.x) || !c.HasValue || !Passable(c.Value)) continue;
                    used.Add(p.y * b.W + p.x); u.X = p.x; u.Y = p.y; break;
                }
                u.Fx = u.Side == "me" ? 1 : -1; u.Fy = 0;
            }
            b.Units = list;
            return list;
        }

        public static Unit UnitOf(Board b, string uid) { foreach (var u in b.Units) if (u.Uid == uid) return u; return null; }
        public static List<Unit> Alive(Board b, string side = null) => b.Units.FindAll(u => u.Hp > 0 && (side == null || u.Side == side));
        private static bool Occupied(Board b, int x, int y) { foreach (var u in b.Units) if (u.Hp > 0 && u.X == x && u.Y == y) return true; return false; }
        public static int Dist(int ax, int ay, int bx, int by) => Math.Abs(ax - bx) + Math.Abs(ay - by);
        private static int Dist(Unit a, Unit b) => Dist(a.X, a.Y, b.X, b.Y);

        private static readonly int[,] Dirs = { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } };

        /// <summary>갈 수 있는 칸들(제자리 포함) — 상하좌우 mov 걸음, 강·성벽·남이 선 칸은 못 지난다(웹과 같은 BFS 순서). 혼란이면 제자리만.</summary>
        public static List<(int x, int y)> Moves(Board b, string uid)
        {
            var u = UnitOf(b, uid);
            var outList = new List<(int x, int y)>();
            if (u == null || u.Hp <= 0) return outList;
            if (u.Moved || u.Confused > 0) { outList.Add((u.X, u.Y)); return outList; }
            var seen = new HashSet<int> { u.Y * b.W + u.X };
            var q = new Queue<(int x, int y, int d)>();
            q.Enqueue((u.X, u.Y, 0));
            while (q.Count > 0)
            {
                var c = q.Dequeue();
                outList.Add((c.x, c.y));
                if (c.d >= u.Mov) continue;
                for (int i = 0; i < 4; i++)
                {
                    int nx = c.x + Dirs[i, 0], ny = c.y + Dirs[i, 1];
                    var t = CellAt(b, nx, ny);
                    if (!t.HasValue || seen.Contains(ny * b.W + nx) || t.Value == Cell.River || (b.IsSrpg && t.Value == Cell.Wall) || Occupied(b, nx, ny)) continue;
                    seen.Add(ny * b.W + nx); q.Enqueue((nx, ny, c.d + 1));
                }
            }
            return outList;
        }

        private static void Face(Unit u, int dx, int dy)
        {
            if (dx == 0 && dy == 0) return;
            if (Math.Abs(dx) >= Math.Abs(dy)) { u.Fx = Math.Sign(dx); u.Fy = 0; } else { u.Fx = 0; u.Fy = Math.Sign(dy); }
        }

        public static bool Move(Board b, string uid, int x, int y)
        {
            var u = UnitOf(b, uid);
            if (u == null || u.Side != b.Side || u.Moved || b.Done != null) return false;
            if (!Moves(b, uid).Contains((x, y))) return false;
            Face(u, x - u.X, y - u.Y);
            u.X = x; u.Y = y; u.Moved = true;
            return true;
        }

        /// <summary>병종 상성 덤(%p) — 창>기>궁>창.</summary>
        public static int ArmBonus(string att, string tgt)
        {
            if (string.IsNullOrEmpty(att) || string.IsNullOrEmpty(tgt) || att == tgt) return 0;
            bool win = (att == "spear" && tgt == "cav") || (att == "cav" && tgt == "bow") || (att == "bow" && tgt == "spear");
            bool lose = (tgt == "spear" && att == "cav") || (tgt == "cav" && att == "bow") || (tgt == "bow" && att == "spear");
            return win ? ArmEdge : lose ? -ArmEdge : 0;
        }

        /// <summary>뒤치기인가 — 맞는 쪽이 보는 방향의 반대(내적 &lt; 0)에서 친다.</summary>
        public static bool IsBack(Unit att, Unit tgt) => (att.X - tgt.X) * tgt.Fx + (att.Y - tgt.Y) * tgt.Fy < 0;

        /// <summary>명중률(%) — 옛 판 식(순수 함수).</summary>
        public static int HitChance(Unit att, Unit tgt, int cover) =>
            Math.Max(HitMin, Math.Min(HitMax, JsRound(HitBase + (att.Atk - tgt.Def) * 2 - cover)));

        /// <summary>판 위 명중률 — 옛 판이면 <see cref="HitChance"/>, SRPG 면 + 상성 + 높이 + 뒤치기. (ax, ay) = 친다고 칠 때 선 자리.</summary>
        public static int HitAt(Board b, Unit att, Unit tgt, int ax, int ay)
        {
            int cover = CoverAt(b, tgt.X, tgt.Y);
            if (!b.IsSrpg) return HitChance(att, tgt, cover);
            int extra = ArmBonus(att.Arm, tgt.Arm);
            if (CellAt(b, ax, ay) == Cell.Hill && CellAt(b, tgt.X, tgt.Y) != Cell.Hill) extra += HighEdge;
            int sx = att.X, sy = att.Y; att.X = ax; att.Y = ay;
            if (IsBack(att, tgt)) extra += BackEdge;
            att.X = sx; att.Y = sy;
            return Math.Max(HitMin, Math.Min(HitMax, JsRound(HitBase + (att.Atk - tgt.Def) * 2 - cover + extra)));
        }

        public static int HitOf(Board b, Unit att, Unit tgt) => HitAt(b, att, tgt, att.X, att.Y);

        private static bool InRange(Unit a, Unit t) => Dist(a, t) <= a.Rng;

        public struct AttackOut { public bool Ok, Hit, Killed; public int Dmg, Chance; }

        public static AttackOut Attack(Board b, string uid, string tuid)
        {
            var a = UnitOf(b, uid); var t = UnitOf(b, tuid);
            if (a == null || t == null || a.Hp <= 0 || t.Hp <= 0 || a.Acted || a.Confused > 0 || a.Side == t.Side || a.Side != b.Side || b.Done != null || !InRange(a, t))
                return new AttackOut();
            int ch = HitOf(b, a, t);
            bool hit = Roll(b, "h") * 100 < ch;
            int dmg = 0;
            if (hit) { dmg = Math.Max(1, JsRound(a.Atk * DmgMul * (0.8 + Roll(b, "d") * 0.4))); t.Hp = Math.Max(0, t.Hp - dmg); }
            a.Acted = true; a.Moved = true;
            if (b.IsSrpg) Face(a, t.X - a.X, t.Y - a.Y);
            b.Log.Add(new LogEntry { Turn = b.Turn, A = uid, To = tuid, Hit = hit, Dmg = dmg, Chance = ch });
            Check(b);
            return new AttackOut { Ok = true, Hit = hit, Dmg = dmg, Killed = t.Hp <= 0, Chance = ch };
        }

        /* ── SRPG 장수 명령(tasks U-0204 ⑤) ── */

        public const int SchemeRange = 3, DebateRange = 2;

        /// <summary>책략 성공률(%) — 40 + (지력 − 상대 지력), 15~90. 회복은 늘 됨.</summary>
        public static int SchemeChance(Unit a, Unit t) => Math.Max(15, Math.Min(90, 40 + a.Wisdom - t.Wisdom));

        public struct CmdOut { public bool Ok, Success; public int Value; public string Why; }

        /// <summary>책략 — kind = fire(화계: 지력/4+8 피해, 숲이면 ×1.5) · confuse(혼란: 다음 제 차례 쉼) · heal(회복: 아군 최대 30%). 장수만, 편마다 한 판 둘, 사거리 3.</summary>
        public static CmdOut Scheme(Board b, string uid, string kind, string tuid)
        {
            var a = UnitOf(b, uid); var t = UnitOf(b, tuid);
            if (!b.IsSrpg || a == null || t == null || a.Hp <= 0 || t.Hp <= 0 || a.Acted || a.Confused > 0 || a.Kind != "officer" || a.Side != b.Side || b.Done != null)
                return new CmdOut { Why = "busy" };
            if (b.Schemes[a.Side] <= 0) return new CmdOut { Why = "none" };
            if (Dist(a, t) > SchemeRange) return new CmdOut { Why = "range" };
            bool ally = t.Side == a.Side;
            if ((kind == "heal") != ally) return new CmdOut { Why = "target" };
            b.Schemes[a.Side]--;
            a.Acted = true; a.Moved = true;
            int val = 0;
            bool ok;
            if (kind == "heal") { ok = true; val = Math.Min(t.Max - t.Hp, JsRound(t.Max * 0.3)); t.Hp += val; }
            else
            {
                ok = Roll(b, "s") * 100 < SchemeChance(a, t);
                if (ok && kind == "fire") { val = JsRound((8 + a.Wisdom / 4.0) * (CellAt(b, t.X, t.Y) == Cell.Forest ? 1.5 : 1)); t.Hp = Math.Max(0, t.Hp - val); }
                else if (ok && kind == "confuse") { t.Confused = 1; }
            }
            b.Log.Add(new LogEntry { Turn = b.Turn, A = uid, To = tuid, Hit = ok, Dmg = val, What = kind });
            Check(b);
            return new CmdOut { Ok = true, Success = ok, Value = val };
        }

        /// <summary>일기토 승률(%) — 50 + (무력 차)×1.5, 15~85.</summary>
        public static int DuelChance(Unit a, Unit t) => Math.Max(15, Math.Min(85, JsRound(50 + (a.Might - t.Might) * 1.5)));

        /// <summary>일기토 — 이웃(거리 1) 적 장수·대장에게, 장수마다 한 판 한 번. 이기면 그 적 쓰러짐, 지면 내 장수 체력 반.</summary>
        public static CmdOut Duel(Board b, string uid, string tuid)
        {
            var a = UnitOf(b, uid); var t = UnitOf(b, tuid);
            if (!b.IsSrpg || a == null || t == null || a.Hp <= 0 || t.Hp <= 0 || a.Acted || a.Confused > 0 || a.Kind != "officer" || a.Side != b.Side || a.Side == t.Side || b.Done != null)
                return new CmdOut { Why = "busy" };
            if (a.Dueled) return new CmdOut { Why = "once" };
            if (t.Kind != "officer" && t.Kind != "chief") return new CmdOut { Why = "target" };
            if (Dist(a, t) != 1) return new CmdOut { Why = "range" };
            a.Dueled = true; a.Acted = true; a.Moved = true;
            bool win = Roll(b, "duel") * 100 < DuelChance(a, t);
            int val;
            if (win) { val = t.Hp; t.Hp = 0; } else { val = a.Hp - Math.Max(1, a.Hp / 2); a.Hp = Math.Max(1, a.Hp / 2); }
            b.Log.Add(new LogEntry { Turn = b.Turn, A = uid, To = tuid, Hit = win, Dmg = val, What = "duel" });
            Check(b);
            return new CmdOut { Ok = true, Success = win, Value = val };
        }

        /// <summary>설전 — 사거리 2 적 장수·대장, 지력 겨룸(책략 확률). 이기면 그 적 두 차례 혼란, 지면 내 장수 한 차례 혼란.</summary>
        public static CmdOut Debate(Board b, string uid, string tuid)
        {
            var a = UnitOf(b, uid); var t = UnitOf(b, tuid);
            if (!b.IsSrpg || a == null || t == null || a.Hp <= 0 || t.Hp <= 0 || a.Acted || a.Confused > 0 || a.Kind != "officer" || a.Side != b.Side || a.Side == t.Side || b.Done != null)
                return new CmdOut { Why = "busy" };
            if (t.Kind != "officer" && t.Kind != "chief") return new CmdOut { Why = "target" };
            if (Dist(a, t) > DebateRange) return new CmdOut { Why = "range" };
            a.Acted = true; a.Moved = true;
            bool win = Roll(b, "debate") * 100 < SchemeChance(a, t);
            if (win) t.Confused = 2; else a.Confused = 1;
            b.Log.Add(new LogEntry { Turn = b.Turn, A = uid, To = tuid, Hit = win, What = "debate" });
            return new CmdOut { Ok = true, Success = win };
        }

        /* ── AI(양쪽 같은 규칙) ── */

        private static void ActAuto(Board b, Unit u)
        {
            if (u.Hp <= 0 || b.Done != null) return;
            if (b.IsSrpg) { ActAutoSrpg(b, u); return; }
            var foes = Alive(b, u.Side == "me" ? "foe" : "me");
            if (foes.Count == 0) return;
            Unit BestTarget()
            {
                Unit best = null; int bc = -1;
                foreach (var t in foes)
                {
                    if (t.Hp > 0 && InRange(u, t)) { int c = HitChance(u, t, CoverAt(b, t.X, t.Y)); if (c > bc) { bc = c; best = t; } }
                }
                return best;
            }
            var tg = BestTarget();
            if (tg == null)
            {
                Unit near = null;
                foreach (var p in foes)
                {
                    if (near == null) { near = p; continue; }
                    int d = Dist(u, p) - Dist(u, near);
                    if (d < 0 || (d == 0 && string.CompareOrdinal(p.Uid, near.Uid) < 0)) near = p;
                }
                (int x, int y)? pick = null; int pd = int.MaxValue, pc = -1;
                foreach (var c in Moves(b, u.Uid))
                {
                    int d = Math.Max(0, Dist(c.x, c.y, near.X, near.Y) - u.Rng), cv = CoverAt(b, c.x, c.y);
                    if (d < pd || (d == pd && cv > pc)) { pick = c; pd = d; pc = cv; }
                }
                if (pick.HasValue) { u.X = pick.Value.x; u.Y = pick.Value.y; }
                u.Moved = true;
                tg = BestTarget();
            }
            if (tg != null) Attack(b, u.Uid, tg.Uid);
        }

        /// <summary>SRPG AI — 혼란이면 쉼(풀림). 회복 쓸 장수면 다친 아군 먼저 · 갈 칸 × 칠 적 중 명중 × 피해 기대가 가장 큰 수(대장·마무리 덤) ·
        /// 칠 게 없으면 목표(내 편: 성문이면 성문, 아니면 대장 / 적 편: 가장 가까운 적) 쪽으로. 버티는 쪽(hold)의 적은 성문·끝 열을 지킨다.</summary>
        private static void ActAutoSrpg(Board b, Unit u)
        {
            if (u.Confused > 0) { u.Confused--; u.Moved = u.Acted = true; return; }
            string other = u.Side == "me" ? "foe" : "me";
            var foes = Alive(b, other);
            if (foes.Count == 0) return;
            if (u.Kind == "officer" && b.Schemes[u.Side] > 0)
            {
                foreach (var al in Alive(b, u.Side))
                    if (al != u && al.Hp < al.Max * 0.4 && Dist(u, al) <= SchemeRange) { Scheme(b, u.Uid, "heal", al.Uid); return; }
            }
            (int x, int y) best = (u.X, u.Y); Unit bt = null; double bv = -1;
            foreach (var c in Moves(b, u.Uid))
            {
                foreach (var t in foes)
                {
                    if (Dist(c.x, c.y, t.X, t.Y) > u.Rng) continue;
                    double v = HitAt(b, u, t, c.x, c.y) / 100.0 * u.Atk;
                    if (t.Chief) v *= 1.4;
                    if (t.Hp <= u.Atk * DmgMul) v *= 1.3;
                    v += CoverAt(b, c.x, c.y) * 0.01;
                    if (v > bv || (Math.Abs(v - bv) < 1e-9 && bt != null && string.CompareOrdinal(t.Uid, bt.Uid) < 0)) { bv = v; best = c; bt = t; }
                }
            }
            if (bt != null)
            {
                if (best.x != u.X || best.y != u.Y) Move2(b, u, best.x, best.y);
                u.Moved = true;
                Attack(b, u.Uid, bt.Uid);
                return;
            }
            // 칠 게 없음 — 목표 쪽으로
            (int x, int y) goal;
            var gate = GateOf(b);
            var chief = foes.Find(t => t.Chief);
            if (u.Side == "me" && b.Goal == "gate" && gate.HasValue) goal = gate.Value;
            else if (u.Side == "me" && chief != null) goal = (chief.X, chief.Y);
            else
            {
                Unit near = null;
                foreach (var p in foes) if (near == null || Dist(u, p) < Dist(u, near) || (Dist(u, p) == Dist(u, near) && string.CompareOrdinal(p.Uid, near.Uid) < 0)) near = p;
                goal = (near.X, near.Y);
            }
            if (u.Side == "foe" && b.Goal == "gate" && gate.HasValue && Dist(u.X, u.Y, gate.Value.x, gate.Value.y) <= 2) { u.Moved = true; return; } // 성문 지기
            (int x, int y)? pick = null; int pd = int.MaxValue, pc = -1;
            foreach (var c in Moves(b, u.Uid))
            {
                int d = Dist(c.x, c.y, goal.x, goal.y), cv = CoverAt(b, c.x, c.y) + (CellAt(b, c.x, c.y) == Cell.Hill ? 10 : 0);
                if (d < pd || (d == pd && cv > pc)) { pick = c; pd = d; pc = cv; }
            }
            if (pick.HasValue && (pick.Value.x != u.X || pick.Value.y != u.Y)) Move2(b, u, pick.Value.x, pick.Value.y);
            u.Moved = true;
        }

        private static void Move2(Board b, Unit u, int x, int y) { Face(u, x - u.X, y - u.Y); u.X = x; u.Y = y; }

        private static void AutoSide(Board b, string side)
        {
            string s0 = b.Side;
            b.Side = side;
            foreach (var u in Alive(b, side)) ActAuto(b, u);
            b.Side = s0;
        }

        /// <summary>적 턴 — AI 가 다 두고 다음 턴으로. 옛 판은 3턴이 끝나면 결과가 선다.</summary>
        public static string AiTurn(Board b)
        {
            if (b.Done != null) return b.Done;
            if (b.IsSrpg) { GateCheck(b); if (b.Done != null) return b.Done; }
            AutoSide(b, "foe");
            if (b.Done != null) return b.Done;
            b.Turn++;
            foreach (var u in b.Units)
            {
                u.Moved = false; u.Acted = false;
                if (u.Side == "me" && u.Confused > 0 && b.IsSrpg) { u.Confused--; u.Moved = u.Acted = true; }   // 혼란 — 내 차례 하나 쉼
            }
            b.Side = "me";
            Check(b);
            return b.Done;
        }

        /// <summary>내 턴 끝 → 적 턴.</summary>
        public static string EndTurn(Board b) => AiTurn(b);

        /// <summary>내 차례를 AI 로(화면의 「맡기기」·「자동 전투」 — tasks U-0099·U-0204). 뒤이어 <see cref="EndTurn"/> 을 부르면 <see cref="AutoPlay"/> 한 바퀴와 같다.</summary>
        public static string AutoTurn(Board b)
        {
            if (b.Done != null) return b.Done;
            AutoSide(b, "me");
            return Check(b);
        }

        /* ── 결과 ── */

        private static double HpFrac(Board b, string side)
        {
            double now = 0, max = 0;
            foreach (var u in b.Units) if (u.Side == side) { now += u.Hp; max += u.Max; }
            return max > 0 ? now / max : 0;
        }

        /// <summary>성문 점령 — 내 차례 끝에 내 편이 성문 칸에 서 있으면 승.</summary>
        private static void GateCheck(Board b)
        {
            if (b.Goal != "gate" || b.Done != null) return;
            var g = GateOf(b);
            if (g.HasValue && Alive(b, "me").Exists(u => u.X == g.Value.x && u.Y == g.Value.y)) b.Done = "win";
        }

        public static string Check(Board b)
        {
            if (b.Done != null) return b.Done;
            if (Alive(b, "foe").Count == 0) b.Done = "rout";
            else if (Alive(b, "me").Count == 0) b.Done = "lose";
            else if (!b.IsSrpg)
            {
                if (b.Turn > Turns)
                {
                    double m = HpFrac(b, "me"), f = HpFrac(b, "foe");
                    b.Done = (f <= 0 || m / f >= 1.5) ? "win" : "draw";
                }
            }
            else if (b.Goal == "chief" && !Alive(b, "foe").Exists(u => u.Chief)) b.Done = "win";
            else if (b.Goal == "hold" && b.Turn > HoldTurns) b.Done = "win";
            else if (b.Turn > TurnCap)
            {
                double m = HpFrac(b, "me"), f = HpFrac(b, "foe");
                b.Done = m / Math.Max(1e-6, f) >= 1.5 ? "win" : "draw";
            }
            return b.Done;
        }

        /// <summary>승리 조건 글 — 「적 대장 격파」·「성문 점령」·「6턴 버팀」(옛 판은 "3턴").</summary>
        public static string GoalText(Board b) =>
            !b.IsSrpg ? string.Format(RealmLocalization.T("tactics.goal_turns", "{0}턴"), Turns)
            : b.Goal == "gate" ? RealmLocalization.T("tactics.goal_gate", "성문 점령")
            : b.Goal == "hold" ? string.Format(RealmLocalization.T("tactics.goal_hold", "{0}턴 버팀"), HoldTurns)
            : RealmLocalization.T("tactics.goal_chief", "적 대장 격파");

        /// <summary>결과 — 끝나지 않았으면 null. Fallen(영구 전사)·Wounded(중상) 는 쓰러진 내 장수 id.</summary>
        public static Outcome OutcomeOf(Board b)
        {
            string k = Check(b);
            if (k == null) return null;
            var o = Out(k);
            var r = new Outcome { Kind = k, Name = o.Name, WinPct = o.WinPct, LossMul = o.LossMul, Turn = b.IsSrpg ? b.Turn : Math.Min(b.Turn, Turns), Goal = b.Goal,
                HpMe = JsRound(HpFrac(b, "me") * 100), HpFoe = JsRound(HpFrac(b, "foe") * 100) };
            foreach (var u in b.Units)
            {
                if (u.Side == "me" && u.Kind == "officer" && u.Hp <= 0) (Permadeath ? r.Fallen : r.Wounded).Add(u.Id);
                if (u.Side == "foe" && u.Hp <= 0) r.FoeDown.Add(string.IsNullOrEmpty(u.Id) ? u.Uid : u.Id);
            }
            return r;
        }

        /// <summary>공략 판정이 받을 보정값 — 판정은 하지 않는다.</summary>
        public static Bonus Apply(Outcome o, string where = "")
        {
            if (o == null) return null;
            var a = new Bonus { Kind = o.Kind, WinPct = o.WinPct, LossMul = o.LossMul, Where = where ?? "" };
            a.Fallen.AddRange(o.Fallen);
            foreach (var id in o.Wounded) a.Wounded.Add((id, WoundMonths));
            return a;
        }

        /// <summary>진단·균형용 — 양쪽 다 AI 로 끝까지.</summary>
        public static Outcome AutoPlay(Board b)
        {
            int guard = 0, cap = b.IsSrpg ? TurnCap + 2 : 20;
            while (b.Done == null && guard++ < cap) { AutoSide(b, "me"); Check(b); if (b.Done != null) break; AiTurn(b); }
            return OutcomeOf(b);
        }

        /* ── Unity 배선 ── */

        /// <summary>그 성에서 그 적 성을 칠 판을 연다 — 내 편 = Attack() 이 데려갈 장수 앞 셋, 적 = 부대(옛 판 둘·SRPG 셋 — 첫째가 대장, 병력을 나눔).
        /// 씨앗 `적 성|달`. 칠 수 없으면 null(`RealmWarState.MarchBlock` — 목표·함락·병력·군량·장수).</summary>
        public static Board Open(string fromCityId, string enemyId = null)
        {
            if (RealmWarState.MarchBlock(fromCityId, ref enemyId) != null) return null; // Attack 이 거절할 출진은 판을 안 연다(R-5 — 조건 한 곳)
            var def = RealmEnemyCity.Get(enemyId);
            var rec = RealmWarState.Get(enemyId);
            var mine = RealmWarState.MarchOfficers(fromCityId);
            int n = Srpg ? 3 : 2;   // 웹 marchGrid max(1, min(2, 5 − 적 장수)) — 이 트랙 적 성엔 장수가 없어 옛 판은 늘 둘
            var tr = new List<int>();
            for (int k = 0; k < n; k++) tr.Add(JsRound(rec.Troops / (double)n));
            var b = MakeBoard(enemyId + "|" + RealmScenario.TurnNow, LandKey(def.Land), rec.Wall > 0);
            UnitsOf(b, mine, null, tr);
            b.FromCityId = fromCityId; b.EnemyId = enemyId;
            return b;
        }

        /// <summary>판을 양쪽 AI 로 끝까지 두고 보정값만 — 화면 없이 출진할 때·진단.</summary>
        public static Bonus Auto(string fromCityId, string enemyId = null)
        {
            var b = Open(fromCityId, enemyId);
            return b == null ? null : Apply(AutoPlay(b), b.EnemyId);
        }
    }
}
