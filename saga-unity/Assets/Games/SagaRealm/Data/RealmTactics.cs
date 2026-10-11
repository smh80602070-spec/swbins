using System;
using System.Collections.Generic;

namespace Saga.Realm.Data
{
    /// <summary>
    /// tasks U-0098 격자 전술 규칙 — 웹 `saga-web/saga-realm/js/tactics.js`(W-0107) 그대로, 화면 없음(화면은 다음 티켓).
    /// 판 8×6 · 내 편 둘째·셋째 열 / 적 여섯째·일곱째 열 · 칸 평지·숲(엄폐 30)·강(못 섬)·성벽(엄폐 50) · 3턴 · AI 양쪽 같은 규칙.
    /// 장수 hp 50+통솔·atk 10+무력/5·def 무력/10·mov 3·rng 지력≥무력이면 2 / 부대 hp 30+병력/200(최대 120)·atk 12·def 2·mov 2·rng 1.
    /// 명중 clamp(65+(atk−def)×2−엄폐, 10, 95) · 피해 atk×2×(0.8~1.2) · 결과 대승 +25%p·사상 ×0.7 / 승 +10 / 무 0 / 패 −25.
    /// **판정 두 벌 금지** — 결과는 <see cref="Apply"/> 의 보정값뿐이고, 공략 판정은 <see cref="RealmWarState.Attack"/> 가 한 번 한다.
    /// 굴림은 판 씨앗 해시(FNV-1a, 웹과 비트 단위 같음 — 같은 씨앗·같은 수순 = 웹과 같은 판·같은 결과). 반올림은 Math.round(= floor(x+0.5)).
    /// 이 트랙 적 성엔 장수가 없어(<see cref="RealmEnemyRecord"/>) 적 편은 부대만 선다. 땅은 평지·강 둘(<see cref="RealmLand"/>).
    /// </summary>
    public static class RealmTactics
    {
        public const int Cols = 8, Rows = 6, Turns = 3, Mov = 3, MovTroop = 2, WoundMonths = 3;
        public const int HitMin = 10, HitMax = 95, HitBase = 65;
        /// <summary>손잡이 — 웹 `rtk.tacticsDmg` 2.</summary>
        public static double DmgMul = 2;
        /// <summary>손잡이 — 웹 `rtk.permadeath` 1(끄면 쓰러진 장수는 전사 대신 중상).</summary>
        public static bool Permadeath = true;

        public enum Cell { Plain, Forest, River, Wall }

        public sealed class Unit
        {
            public string Uid, Id, Side, Kind;
            public int Hp, Max, Mov, Rng, X, Y;
            public double Atk, Def;
            public bool Moved, Acted;
        }

        public sealed class LogEntry
        {
            public int Turn, Dmg, Chance;
            public string A, To;
            public bool Hit;
        }

        public sealed class Board
        {
            public string Seed, Land;
            public bool Siege;
            public Cell[] Cells;
            public List<Unit> Units = new List<Unit>();
            public int Turn = 1, N;
            public string Side = "me", Done;
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
            public string Kind, Name;
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

        public static int Cover(Cell c) => c == Cell.Forest ? 30 : c == Cell.Wall ? 50 : 0;

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

        /// <summary>판 하나 — land = plain|hill|river|mount, siege = 수비 쪽 끝 성벽 줄. 순수 함수(같은 씨앗 = 같은 판).</summary>
        public static Board MakeBoard(string seed, string land, bool siege)
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

        public static Cell? CellAt(Board b, int x, int y) => x < 0 || y < 0 || x >= Cols || y >= Rows ? (Cell?)null : b.Cells[y * Cols + x];
        public static int CoverAt(Board b, int x, int y) { var c = CellAt(b, x, y); return c.HasValue ? Cover(c.Value) : 0; }

        /* ── 유닛 ── */

        public static Unit OfficerUnit(string id, string side, Stats s)
        {
            int hp = 50 + s.Command;
            return new Unit { Uid = side + ":" + id, Id = id, Side = side, Kind = "officer", Hp = hp, Max = hp, Atk = 10 + s.Might / 5.0, Def = s.Might / 10.0,
                Mov = Mov, Rng = s.Wisdom >= s.Might ? 2 : 1 };
        }

        public static Unit TroopUnit(int n, string side, int troops)
        {
            int hp = Math.Min(120, JsRound(30 + troops / 200.0));
            return new Unit { Uid = side + ":troop" + n, Id = "", Side = side, Kind = "troop", Hp = hp, Max = hp, Atk = 12, Def = 2, Mov = MovTroop, Rng = 1 };
        }

        private static Stats StatsOf(string id, IDictionary<string, Stats> stats)
        {
            if (stats != null && stats.TryGetValue(id, out var s)) return s;
            var o = RealmOfficerPool.Get(id);
            return o != null ? new Stats(o.Might, o.Wisdom, o.Command) : new Stats(60, 60, 60);
        }

        /// <summary>두 편을 세운다 — mine 셋까지, foes 셋까지, 부대는 장수와 합쳐 3~5(모자라면 3000 으로 채움).</summary>
        public static List<Unit> UnitsOf(Board b, IList<string> mine, IList<string> foes, IList<int> foeTroops, IDictionary<string, Stats> stats = null)
        {
            var list = new List<Unit>();
            if (mine != null) for (int i = 0; i < mine.Count && i < 3; i++) list.Add(OfficerUnit(mine[i], "me", StatsOf(mine[i], stats)));
            int fo = 0;
            if (foes != null) for (int i = 0; i < foes.Count && i < 3; i++) { list.Add(OfficerUnit(foes[i], "foe", StatsOf(foes[i], stats))); fo++; }
            var tr = new List<int>();
            if (foeTroops != null) for (int i = 0; i < foeTroops.Count && i < Math.Max(0, 5 - fo); i++) tr.Add(foeTroops[i]);
            while (fo + tr.Count < 3) tr.Add(3000);
            for (int k = 0; k < tr.Count; k++) list.Add(TroopUnit(k, "foe", tr[k]));

            var me = new List<(int x, int y)>();
            var foe = new List<(int x, int y)>();
            for (int y = 0; y < Rows; y++)
            {
                for (int x = 1; x <= 2; x++) me.Add((x, (y * 2 + 1) % Rows));
                for (int x = Cols - 2; x >= Cols - 3; x--) foe.Add((x, (y * 2 + 1) % Rows));
            }
            var used = new HashSet<int>();
            foreach (var u in list)
            {
                var s = u.Side == "me" ? me : foe;
                foreach (var p in s)
                {
                    var c = CellAt(b, p.x, p.y);
                    if (used.Contains(p.y * Cols + p.x) || c == Cell.River || c == Cell.Wall) continue;
                    used.Add(p.y * Cols + p.x); u.X = p.x; u.Y = p.y; break;
                }
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

        /// <summary>갈 수 있는 칸들(제자리 포함) — 상하좌우 mov 걸음, 강·남이 선 칸은 못 지난다(웹과 같은 BFS 순서).</summary>
        public static List<(int x, int y)> Moves(Board b, string uid)
        {
            var u = UnitOf(b, uid);
            var outList = new List<(int x, int y)>();
            if (u == null || u.Hp <= 0) return outList;
            if (u.Moved) { outList.Add((u.X, u.Y)); return outList; }
            var seen = new HashSet<int> { u.Y * Cols + u.X };
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
                    if (!t.HasValue || seen.Contains(ny * Cols + nx) || t.Value == Cell.River || Occupied(b, nx, ny)) continue;
                    seen.Add(ny * Cols + nx); q.Enqueue((nx, ny, c.d + 1));
                }
            }
            return outList;
        }

        public static bool Move(Board b, string uid, int x, int y)
        {
            var u = UnitOf(b, uid);
            if (u == null || u.Side != b.Side || u.Moved || b.Done != null) return false;
            if (!Moves(b, uid).Contains((x, y))) return false;
            u.X = x; u.Y = y; u.Moved = true;
            return true;
        }

        /// <summary>명중률(%) — 순수 함수.</summary>
        public static int HitChance(Unit att, Unit tgt, int cover) =>
            Math.Max(HitMin, Math.Min(HitMax, JsRound(HitBase + (att.Atk - tgt.Def) * 2 - cover)));

        private static bool InRange(Unit a, Unit t) => Dist(a, t) <= a.Rng;

        public struct AttackOut { public bool Ok, Hit, Killed; public int Dmg, Chance; }

        public static AttackOut Attack(Board b, string uid, string tuid)
        {
            var a = UnitOf(b, uid); var t = UnitOf(b, tuid);
            if (a == null || t == null || a.Hp <= 0 || t.Hp <= 0 || a.Acted || a.Side == t.Side || a.Side != b.Side || b.Done != null || !InRange(a, t))
                return new AttackOut();
            int ch = HitChance(a, t, CoverAt(b, t.X, t.Y));
            bool hit = Roll(b, "h") * 100 < ch;
            int dmg = 0;
            if (hit) { dmg = Math.Max(1, JsRound(a.Atk * DmgMul * (0.8 + Roll(b, "d") * 0.4))); t.Hp = Math.Max(0, t.Hp - dmg); }
            a.Acted = true; a.Moved = true;
            b.Log.Add(new LogEntry { Turn = b.Turn, A = uid, To = tuid, Hit = hit, Dmg = dmg, Chance = ch });
            Check(b);
            return new AttackOut { Ok = true, Hit = hit, Dmg = dmg, Killed = t.Hp <= 0, Chance = ch };
        }

        /* ── AI(양쪽 같은 규칙) ── */

        private static void ActAuto(Board b, Unit u)
        {
            if (u.Hp <= 0 || b.Done != null) return;
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

        private static void AutoSide(Board b, string side)
        {
            string s0 = b.Side;
            b.Side = side;
            foreach (var u in Alive(b, side)) ActAuto(b, u);
            b.Side = s0;
        }

        /// <summary>적 턴 — AI 가 다 두고 다음 턴으로. 3턴이 끝나면 결과가 선다.</summary>
        public static string AiTurn(Board b)
        {
            if (b.Done != null) return b.Done;
            AutoSide(b, "foe");
            if (b.Done != null) return b.Done;
            b.Turn++;
            foreach (var u in b.Units) { u.Moved = false; u.Acted = false; }
            b.Side = "me";
            Check(b);
            return b.Done;
        }

        /// <summary>내 턴 끝 → 적 턴.</summary>
        public static string EndTurn(Board b) => AiTurn(b);

        /// <summary>내 차례를 AI 로(화면의 「맡기기」 — tasks U-0099). 뒤이어 <see cref="EndTurn"/> 을 부르면 <see cref="AutoPlay"/> 한 바퀴와 같다.</summary>
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

        public static string Check(Board b)
        {
            if (b.Done != null) return b.Done;
            if (Alive(b, "foe").Count == 0) b.Done = "rout";
            else if (Alive(b, "me").Count == 0) b.Done = "lose";
            else if (b.Turn > Turns)
            {
                double m = HpFrac(b, "me"), f = HpFrac(b, "foe");
                b.Done = (f <= 0 || m / f >= 1.5) ? "win" : "draw";
            }
            return b.Done;
        }

        /// <summary>결과 — 끝나지 않았으면 null. Fallen(영구 전사)·Wounded(중상) 는 쓰러진 내 장수 id.</summary>
        public static Outcome OutcomeOf(Board b)
        {
            string k = Check(b);
            if (k == null) return null;
            var o = Out(k);
            var r = new Outcome { Kind = k, Name = o.Name, WinPct = o.WinPct, LossMul = o.LossMul, Turn = Math.Min(b.Turn, Turns),
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
            int guard = 0;
            while (b.Done == null && guard++ < 20) { AutoSide(b, "me"); Check(b); if (b.Done != null) break; AiTurn(b); }
            return OutcomeOf(b);
        }

        /* ── Unity 배선 ── */

        /// <summary>그 성에서 그 적 성을 칠 판을 연다 — 내 편 = Attack() 이 데려갈 장수 앞 셋, 적 = 부대 둘(병력 반씩, 셋째는 3000).
        /// 씨앗 `적 성|달`. 칠 수 없으면 null(목표 없음·함락됨·장수 없음).</summary>
        public static Board Open(string fromCityId, string enemyId = null)
        {
            if (enemyId == null) enemyId = RealmEnemyCity.TargetFrom(fromCityId);
            else if (!RealmEnemyCity.TargetsFrom(fromCityId).Contains(enemyId)) enemyId = null;
            if (enemyId == null) return null;
            var def = RealmEnemyCity.Get(enemyId);
            var rec = RealmWarState.Get(enemyId);
            if (def == null || rec == null || rec.Captured) return null;
            var mine = RealmWarState.MarchOfficers(fromCityId);
            if (mine.Count == 0) return null;
            int n = Math.Max(1, Math.Min(2, 5 - 0));
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
