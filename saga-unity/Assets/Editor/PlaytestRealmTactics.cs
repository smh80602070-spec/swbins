using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Saga.Realm.Data;
using U = Saga.Realm.Data.RealmTactics;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0098 격자 전술 규칙(웹 tactics.js W-0107) 진단 — `PlaytestRealmSlice` 세 시대 단계 끝(전 성이 우리 것)에 부른다(한 프레임 안).
    /// ⓪ node 로 돌린 웹 tactics.js 판 셋(평지 공성·강·산 공성)과 칸·자리·hp·자동 대국 결과·굴림 수가 같다 ① 판 모양(200 씨앗)
    /// ② 명중 clamp·엄폐 ③ AI 가 닿으면 친다 ④ 결과 넷 판정식·손잡이 permadeath ⑤ 결정성 ⑥ grid 없는 Attack = 옛 계산(같은 Random 으로 Fight 직접)
    /// ⑦ 대승은 덜 잃고 패는 덜 친다 ⑧ 전사 → 명단에서 빠지고 열전 ⑨ 중상 3달 출진 못 함·달 셋에 풀림 ⑩ 군주는 중상 ⑪ 세이브 왕복.
    /// 끝나면 세이브 JSON·Random 상태·손잡이를 시작 때로.
    /// </summary>
    public static class PlaytestRealmTactics
    {
        private const string T = "[PlaytestRealmSlice] tactics";
        private static bool _ok;

        private static readonly Dictionary<string, U.Stats> St = new Dictionary<string, U.Stats>
        {
            ["a"] = new U.Stats(85, 40, 70), ["b"] = new U.Stats(45, 90, 60), ["c"] = new U.Stats(70, 70, 80),
        };

        public static bool Run()
        {
            _ok = true;
            string m = "";
            string json0 = RealmSaveState.ToJson();
            var rnd0 = Random.state;
            bool pd0 = U.Permadeath;
            int gold0 = RealmCityState.Gold, roster0 = RealmCityState.RosterIds.Count;
            try
            {
                // ⓪ 웹과 같은 판 — 기준값은 node 로 tactics.js 를 돌려 뽑았다(tasks U-0098 메모)
                if (System.Math.Abs(U.Hash("x", "y") - 0.5710271967109293) > 1e-15) Fail($"해시 {U.Hash("x", "y"):R}");
                Web("xiaopei|0", "plain", true, new[] { "a", "b" }, new[] { 3000, 3000 },
                    "ppppppwpppppppppppppppwpppppppppppppppwppppppppp", "11,21,61,51,63", "120,110,45,45,45", "rout", 79, 0, 15, 8, "97,85,0,0,0");
                Web("luoyang|7", "river", false, new[] { "a", "b", "c" }, new[] { 5000, 5000 },
                    "pppppppppppprppppppprppppppprppppppppppppppfrppp", "11,21,13,61,51,63", "120,110,130,55,55,45", "win", 100, 35, 9, 5, "120,110,130,55,0,0");
                Web("ye|31", "mount", true, new[] { "c" }, new[] { 12000, 8000 },
                    "ppppppwpppppwfpppppfwfwppppfppppppppwpwpppffpppp", "11,61,51,63", "130,90,70,45", "win", 85, 31, 12, 8, "110,38,19,6");

                // ① 판 모양
                for (int i = 0; i < 200; i++)
                {
                    foreach (var land in new[] { "plain", "river" })
                    {
                        var b = U.MakeBoard("s" + i, land, i % 2 == 0);
                        if (b.Cells.Length != U.Cols * U.Rows || U.Cols != 8 || U.Rows != 6) { Fail("판 8×6 아님"); break; }
                        int riverCols = 0;
                        for (int x = 0; x < U.Cols; x++)
                        {
                            int rv = 0;
                            for (int y = 0; y < U.Rows; y++) if (U.CellAt(b, x, y) == U.Cell.River) rv++;
                            if (rv == 0) continue;
                            riverCols++;
                            if (U.Rows - rv < 2) Fail($"{b.Seed} 강 건널목 {U.Rows - rv} < 2");
                        }
                        if ((land == "river") != (riverCols == 1)) Fail($"{b.Seed} {land} 강 줄 {riverCols}");
                        if (b.Siege) for (int y = 0; y < U.Rows; y += 2) if (U.CellAt(b, U.Cols - 2, y) != U.Cell.Wall) Fail($"{b.Seed} 성벽 줄");
                        U.UnitsOf(b, new[] { "a", "b", "c" }, null, new[] { 5000, 5000 }, St);
                        if (b.Units.Count != 6) Fail($"{b.Seed} 유닛 {b.Units.Count} ≠ 6");
                        var spots = new HashSet<int>();
                        foreach (var u in b.Units)
                        {
                            var c = U.CellAt(b, u.X, u.Y);
                            if (c == U.Cell.River || c == U.Cell.Wall) Fail($"{b.Seed} {u.Uid} 이 {c} 칸");
                            if (u.Side == "me" ? (u.X < 1 || u.X > 2) : (u.X < 5 || u.X > 6)) Fail($"{b.Seed} {u.Uid} 열 {u.X}");
                            if (!spots.Add(u.Y * U.Cols + u.X)) Fail($"{b.Seed} 자리 겹침");
                            foreach (var p in U.Moves(b, u.Uid)) if (U.CellAt(b, p.x, p.y) == U.Cell.River) Fail($"{b.Seed} 강 칸으로 감");
                        }
                    }
                    if (!_ok) break;
                }

                // ② 명중
                var strong = U.OfficerUnit("s", "me", new U.Stats(100, 0, 50));   // atk 30
                var troop = U.TroopUnit(0, "foe", 3000);                          // def 2
                var weak = U.TroopUnit(1, "me", 3000);                            // atk 12
                var tank = U.OfficerUnit("t", "foe", new U.Stats(100, 0, 50));    // def 10
                var feeble = new U.Unit { Atk = 5 };                              // 65 + (5−10)×2 − 50 = 5 → 10
                if (U.HitChance(strong, troop, 0) != 95) Fail($"명중 위 clamp {U.HitChance(strong, troop, 0)}");
                if (U.HitChance(weak, troop, 0) != 85 || U.HitChance(weak, troop, 30) != 55 || U.HitChance(weak, troop, 50) != 35) Fail("엄폐 숲 −30·성벽 −50");
                if (U.HitChance(weak, tank, 50) != 19 || U.HitChance(feeble, tank, 50) != 10) Fail($"명중 식·아래 clamp {U.HitChance(weak, tank, 50)} {U.HitChance(feeble, tank, 50)}");

                // ③ AI 가 닿으면 친다
                {
                    var b = U.MakeBoard("ai", "plain", false);
                    U.UnitsOf(b, new[] { "a" }, null, new[] { 3000, 3000 }, St);
                    var me = b.Units[0]; var f0 = b.Units[1];
                    me.X = 3; me.Y = 3; f0.X = 4; f0.Y = 3;
                    U.AiTurn(b);
                    if (!b.Log.Any(l => l.A == f0.Uid && l.To == me.Uid)) Fail("적 AI 가 닿는 적을 안 침");
                }

                // ④ 결과 넷
                {
                    var b = Fresh(); foreach (var u in b.Units) if (u.Side == "foe") u.Hp = 0;
                    var o = U.OutcomeOf(b);
                    if (o.Kind != "rout" || o.WinPct != 25 || o.LossMul != 0.7f) Fail($"대승 {o.Kind} {o.WinPct} {o.LossMul}");
                    b = Fresh(); foreach (var u in b.Units) if (u.Side == "me") u.Hp = 0;
                    o = U.OutcomeOf(b);
                    if (o.Kind != "lose" || o.WinPct != -25 || o.Fallen.Count != 2 || o.Wounded.Count != 0) Fail($"패 {o.Kind} 전사 {o.Fallen.Count}");
                    U.Permadeath = false;
                    var a = U.Apply(U.OutcomeOf(Fresh(u => { if (u.Side == "me") u.Hp = 0; })), "w");
                    if (a.Fallen.Count != 0 || a.Wounded.Count != 2 || a.Wounded[0].months != 3) Fail("permadeath 0 → 중상 3달");
                    U.Permadeath = true;
                    b = Fresh(); b.Turn = 4; foreach (var u in b.Units) if (u.Side == "foe") u.Hp = u.Max / 2;
                    if (U.OutcomeOf(b).Kind != "win") Fail("hp 비 2 → 승");
                    b = Fresh(); b.Turn = 4; foreach (var u in b.Units) if (u.Side == "foe") u.Hp = u.Max * 4 / 5;
                    if (U.OutcomeOf(b).Kind != "draw") Fail("hp 비 1.25 → 무승부");
                    if (U.OutcomeOf(Fresh()) != null) Fail("안 끝난 판에 결과");
                }

                // ⑤ 결정성
                {
                    string Sig(string seed) { var b = U.MakeBoard(seed, "river", true); U.UnitsOf(b, new[] { "a", "b", "c" }, null, new[] { 4000, 4000 }, St); var o = U.AutoPlay(b); return o.Kind + b.N + "/" + b.Log.Count + "/" + string.Join(",", b.Units.Select(u => u.Hp)); }
                    if (Sig("det|1") != Sig("det|1")) Fail("같은 씨앗 다른 결과");
                    var kinds = new Dictionary<string, int>();
                    for (int i = 0; i < 100; i++) { var b = U.MakeBoard("k" + i, "plain", i % 3 == 0); U.UnitsOf(b, new[] { "a", "b" }, null, new[] { 6000, 6000 }, St); var k = U.AutoPlay(b).Kind; kinds[k] = kinds.TryGetValue(k, out var n) ? n + 1 : 1; }
                    m += " 자동 대국 100판 " + string.Join("·", kinds.OrderBy(kv => kv.Key).Select(kv => kv.Key + kv.Value));
                }

                // ── Unity 배선: 적 성 하나를 다시 세우고 우리 성 하나에 시험 장수 셋 ──
                if (!Setup(out string from, out string enemy, out var tester)) return _ok = false;
                string json1 = RealmSaveState.ToJson();

                // Open·Auto
                {
                    var b = U.Open(from, enemy);
                    int want = Mathf.Min(3, RealmWarState.MarchOfficers(from).Count);
                    if (b == null) Fail("Open null");
                    else
                    {
                        if (b.Units.Count(u => u.Side == "me") != want || b.Units.Count(u => u.Side == "foe" && u.Kind == "troop") != 3) Fail($"Open 유닛 {b.Units.Count}");
                        if (b.Seed != enemy + "|" + RealmScenario.TurnNow || !b.Siege) Fail($"Open 씨앗·공성 {b.Seed} {b.Siege}");
                    }
                    if (U.Auto(from, enemy) == null) Fail("Auto null");
                }

                // ⑥ grid 없는 Attack = 옛 계산
                for (int s = 1; s <= 10; s++)
                {
                    var r0 = Run(json1, s, from, enemy, null);
                    var r1 = Run(json1, s, from, enemy, new U.Bonus { Kind = "draw" });
                    RealmSaveState.ApplyJson(json1);
                    var city = RealmCityState.CityRecord(from);
                    var rec = RealmWarState.Get(enemy);
                    var atk = new RealmArmy { Troops = city.Troops, Start = city.Troops, Train = city.Train, Tech = city.Tech, OfficerIds = RealmWarState.MarchOfficers(from), Morale = 1f };
                    var def = new RealmArmy { Troops = rec.Troops, Start = rec.Troops, Train = rec.Train, Tech = rec.Tech, OfficerIds = new List<string>(), Morale = 1f };
                    Random.InitState(s);
                    var f = RealmWar.Fight(atk, def, rec, RealmEnemyCity.Get(enemy).Land);
                    if (!r0.Ok || r0.Won != f.Won || r0.AtkLeft != atk.Troops || r0.DefLeft != def.Troops) Fail($"grid 없음 ≠ Fight 직접 (씨앗 {s})");
                    if (r1.Won != r0.Won || r1.AtkLeft != r0.AtkLeft || r1.DefLeft != r0.DefLeft) Fail($"무승부 보정 ≠ 보정 없음 (씨앗 {s})");
                }

                // ⑦ 대승 / 보정 없음 / 패
                {
                    int wR = 0, wN = 0, wL = 0; long sR = 0, sN = 0, sL = 0, kR = 0, kL = 0;
                    for (int s = 100; s < 160; s++)
                    {
                        var rr = Run(json1, s, from, enemy, new U.Bonus { Kind = "rout", WinPct = 25, LossMul = 0.7f });
                        var rn = Run(json1, s, from, enemy, null);
                        var rl = Run(json1, s, from, enemy, new U.Bonus { Kind = "lose", WinPct = -25 });
                        if (rr.Won) wR++; if (rn.Won) wN++; if (rl.Won) wL++;
                        sR += rr.AtkLeft; sN += rn.AtkLeft; sL += rl.AtkLeft;
                        kR += rr.DefStart - rr.DefLeft; kL += rl.DefStart - rl.DefLeft;
                    }
                    if (!(wR >= wN && wN >= wL)) Fail($"이긴 수 대승 {wR}·없음 {wN}·패 {wL}");
                    if (!(sR >= sN && sR > sL)) Fail($"남은 병력 대승 {sR}·없음 {sN}·패 {sL}");
                    m += $" · 60출진 이김 대승{wR}/없음{wN}/패{wL} 남은 병력 {sR / 60}/{sN / 60}/{sL / 60} 적 손실 대승{kR / 60}·패{kL / 60}";
                }

                // ⑧ 전사 · ⑨ 중상 · ⑩ 군주
                {
                    RealmSaveState.ApplyJson(json1);
                    string dead = tester[0], hurt = tester[1], lord = RealmOfficerPool.StartingOfficerId;
                    int annals0 = RealmCityState.Annals.Count;
                    var g = new U.Bonus { Kind = "lose", WinPct = -25 };
                    g.Fallen.Add(dead); g.Fallen.Add(lord); g.Wounded.Add((hurt, U.WoundMonths));
                    Random.InitState(7);
                    var r = RealmWarState.Attack(from, enemy, grid: g);
                    if (!r.Ok) Fail("전사 시험 출진 실패 " + r.Message);
                    if (RealmCityState.RosterIds.Contains(dead) || RealmCityState.OfficerCityId(dead) != null) Fail("전사자가 명단에 남음");
                    var an = RealmCityState.Annals.Where(a => a.Id == dead).ToList();
                    if (an.Count != 1 || an[0].Where != enemy || an[0].Year != RealmCityState.Year || an[0].Month != RealmCityState.Month || RealmCityState.Annals.Count != annals0 + 1) Fail("열전 기록");
                    if (!RealmCityState.RosterIds.Contains(lord) || RealmCityState.HurtMonths(lord) != 3) Fail("군주는 중상 3달이어야");
                    if (!RealmWarState.IsLord(RealmSuccessionState.FindCapitalOfficer())) Fail("수도 장수가 군주 아님");
                    if (RealmCityState.HurtMonths(hurt) != 3 || !r.Message.Contains("⚰️") || !r.Message.Contains("🩹")) Fail("중상·전투 글");

                    // ⑪ 세이브 왕복(이 상태 그대로)
                    string j = RealmSaveState.ToJson();
                    RealmSaveState.ApplyJson(json1);
                    if (RealmCityState.IsHurt(hurt) || RealmCityState.Annals.Count != annals0) Fail("되돌림에 중상·열전이 남음");
                    RealmSaveState.ApplyJson(j);
                    if (RealmCityState.HurtMonths(hurt) != 3 || RealmCityState.Annals.Count(a => a.Id == dead && a.Where == enemy) != 1) Fail("세이브 왕복");

                    // ⑨ 달 넘김 — 둘째 달까지 못 나가고 셋째 달에 풀림
                    for (int k = 1; k <= 3; k++)
                    {
                        RealmCityState.NextMonth();
                        bool marches = RealmWarState.MarchOfficers(from).Contains(hurt);
                        if (k < 3 && (marches || !RealmCityState.IsHurt(hurt))) Fail($"중상 {k}달째에 출진 가능");
                        if (k == 3 && (!marches || RealmCityState.IsHurt(hurt))) Fail("셋째 달에 안 풀림");
                    }
                }
            }
            finally
            {
                RealmSaveState.ApplyJson(json0);
                Random.state = rnd0;
                U.Permadeath = pd0;
            }
            if (RealmCityState.Gold != gold0 || RealmCityState.RosterIds.Count != roster0) Fail("상태 되돌림");
            if (_ok) Debug.Log($"{T} OK - 웹 판 셋 같음·판 모양 200씨앗·명중·AI·결과 넷·결정성 · grid 없는 Attack = Fight 직접 · 대승/패 보정 · 전사·열전·중상 3달·군주 중상·세이브 왕복 |{m}");
            return _ok;
        }

        private static void Web(string seed, string land, bool siege, string[] mine, int[] tr,
            string cells, string pos, string hp, string kind, int hpMe, int hpFoe, int n, int log, string end)
        {
            var b = U.MakeBoard(seed, land, siege);
            string c = new string(b.Cells.Select(x => x == U.Cell.Plain ? 'p' : x == U.Cell.Forest ? 'f' : x == U.Cell.River ? 'r' : 'w').ToArray());
            U.UnitsOf(b, mine, null, tr, St);
            string p = string.Join(",", b.Units.Select(u => $"{u.X}{u.Y}"));
            string h = string.Join(",", b.Units.Select(u => u.Hp));
            var o = U.AutoPlay(b);
            string e = string.Join(",", b.Units.Select(u => u.Hp));
            if (c != cells || p != pos || h != hp) Fail($"웹 판 {seed} 칸·자리·hp 다름\n{c}\n{p} {h}");
            else if (o.Kind != kind || o.HpMe != hpMe || o.HpFoe != hpFoe || b.N != n || b.Log.Count != log || e != end)
                Fail($"웹 판 {seed} 대국 다름 {o.Kind} {o.HpMe}/{o.HpFoe} 굴림 {b.N} 기록 {b.Log.Count} 끝 {e}");
        }

        private static U.Board Fresh(System.Action<U.Unit> f = null)
        {
            var b = U.MakeBoard("fresh", "plain", false);
            U.UnitsOf(b, new[] { "a", "b" }, null, new[] { 3000, 3000 }, St);
            if (f != null) foreach (var u in b.Units) f(u);
            return b;
        }

        private static RealmWarState.AttackResult Run(string json, int seed, string from, string enemy, U.Bonus grid)
        {
            RealmSaveState.ApplyJson(json);
            Random.InitState(seed);
            return RealmWarState.Attack(from, enemy, grid: grid);
        }

        /// <summary>시작 장수·수도가 아닌 우리 성 하나에서 칠 적 성을 다시 세우고(함락 풂), 시험 장수 셋을 그 성에 들인다.</summary>
        private static bool Setup(out string from, out string enemy, out List<string> tester)
        {
            from = enemy = null; tester = new List<string>();
            foreach (var id in RealmEnemyCity.AllIds)
            {
                var d = RealmEnemyCity.Get(id);
                if (d == null || d.AttackFromCityId == RealmOfficerPool.StartingOfficerCityId || RealmCityState.CityRecord(d.AttackFromCityId) == null) continue;
                from = d.AttackFromCityId; enemy = id; break;
            }
            if (enemy == null) { Fail("시험할 적 성 없음"); return false; }
            var snap = RealmWarState.Snapshot(enemy);
            RealmWarState.Restore(enemy, Mathf.Max(200, snap.maxWall), Mathf.Max(200, snap.maxWall), 14000, 60, 300, false);
            var r = RealmCityState.CityRecord(from);
            RealmCityState.AdjustCity(from, troops: 20000 - r.Troops, food: 50000);
            foreach (var id in RealmOfficerPool.AllIds)
            {
                if (tester.Count >= 3) break;
                if (RealmCityState.RosterIds.Contains(id)) continue;
                if (RealmCityState.JoinOfficer(id, from)) tester.Add(id);
            }
            if (tester.Count < 2) { Fail("시험 장수 못 들임"); return false; }
            return true;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
