using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Saga.Realm.Data;
using U = Saga.Realm.Data.RealmTactics;
using V = Saga.Realm.World.RealmTacticsView;

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
            bool srpg0 = U.Srpg;
            U.Srpg = false; // tasks U-0204 — 이 진단은 웹 W-0107 과 비트 단위 같은 옛 판(8×6·3턴)을 잰다 · SRPG 는 PlaytestRealmSrpg
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

                // U-0099 화면 — 칸 변환 · 고르기/옮기기 · 물러남 복원 · 맡기기 = AutoPlay · 토글 배선
                if (!ViewChecks(json1, from, enemy, ref m)) _ok = false;
                // U-0101 열전·중상 보이기 · 전술판 글 ko/en
                if (!RecordChecks(json1, enemy, tester, ref m)) _ok = false;

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
                    string dead = tester[0], hurt = tester[1], lord = RealmWarState.Lord();
                    if (lord == null) { Fail("군주 없음(수도 장수·시작 장수 둘 다 없음)"); lord = tester[0]; }
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
                    if (!RealmWarState.IsLord(lord) || RealmWarState.IsLord(tester[1])) Fail("군주 = 수도 장수 하나");
                    // R-5 리뷰 — 전사자는 찾은 사람 목록에서 빠지고, 합류로 되살아나지 않는다
                    if (RealmCityState.FoundIds.Contains(dead) || !RealmCityState.IsDead(dead) || RealmCityState.JoinOfficer(dead, from)) Fail("전사자가 다시 들 수 있음");
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
                U.Srpg = srpg0;
            }
            if (RealmCityState.Gold != gold0 || RealmCityState.RosterIds.Count != roster0) Fail("상태 되돌림");
            if (_ok) Debug.Log($"{T} OK - 웹 판 셋 같음·판 모양 200씨앗·명중·AI·결과 넷·결정성 · grid 없는 Attack = Fight 직접 · 대승/패 보정 · 전사·열전·중상 3달·군주 중상·세이브 왕복 |{m}");
            return _ok;
        }

        /// <summary>촬영·레이아웃 점검용(U-0099) — 지금 판에서 열 수 있는 전술판을 연다(지금 성 → 장수 있는 우리 성 순).
        /// 칠 적 성이 다 함락돼 있으면 장수 있는 성의 첫 목표를 다시 세운다(그 프로세스 안에서만 — 부르는 쪽이 세이브를 되돌린다).
        /// 열리면 첫 내 장수를 고른 채 돌려준다.</summary>
        public static V OpenForShot()
        {
            var cities = new List<string> { RealmCityState.CurrentCity };
            foreach (var id in RealmCityState.RosterIds) { var c = RealmCityState.OfficerCityId(id); if (c != null && !cities.Contains(c)) cities.Add(c); }
            V v = null;
            for (int pass = 0; pass < 3 && v == null; pass++)
            {
                if (pass == 2) RealmCityState.NextMonth(); // 앞 점검이 이 달 장수를 다 썼으면(공격 단추) 달을 넘겨 다시
                foreach (var c in cities)
                {
                    if (RealmWarState.MarchOfficers(c).Count == 0) continue;
                    foreach (var e in RealmEnemyCity.TargetsFrom(c))
                    {
                        if (pass >= 1)
                        {
                            var s = RealmWarState.Snapshot(e);
                            RealmWarState.Restore(e, Mathf.Max(200, s.maxWall), Mathf.Max(200, s.maxWall), 9000, 60, 300, false);
                            var r = RealmCityState.CityRecord(c);
                            if (r != null) RealmCityState.AdjustCity(c, troops: Mathf.Max(0, 12000 - r.Troops), food: 50000);
                        }
                        v = V.Open(c, e, null);
                        if (v != null) break;
                    }
                    if (v != null) break;
                }
            }
            if (v == null) return null;
            var me = v.Board.Units.First(u => u.Side == "me");
            v.Tap(me.X, me.Y);
            Debug.Log($"[PlaytestRealmTactics] 촬영 판 {v.Board.FromCityId}→{v.Board.EnemyId} 씨앗 {v.Board.Seed} · 유닛 {v.Board.Units.Count} · 고른 {v.Selected} · 갈 칸 {v.MoveCellCount}");
            return v;
        }

        /// <summary>U-0101 촬영·레이아웃 점검용 — 명단 밖 장수 n 명을 열전에 심는다(세이브는 부르는 쪽이 되돌린다).</summary>
        public static void SeedAnnals(int n)
        {
            var ids = RealmOfficerPool.AllIds.Where(id => !RealmCityState.RosterIds.Contains(id)).Take(n).ToArray();
            var where = ids.Select((id, i) => RealmEnemyCity.AllIds[i % RealmEnemyCity.AllIds.Length]).ToArray();
            var by = where.Select(w => string.Format(RealmLocalization.T("tactics.by", "{0} 수비군"), RealmEnemyCity.Get(w)?.Name ?? w)).ToArray();
            var years = ids.Select(_ => RealmCityState.Year).ToArray();
            var months = ids.Select((_, i) => Mathf.Clamp(RealmCityState.Month - i, 1, 12)).ToArray();
            RealmCityState.RestoreWarRecords(null, null, ids, where, by, years, months);
        }

        public static readonly string[] Keys =
        {
            "command.grid", "tactics.by", "tactics.cancelled", "tactics.delegate", "tactics.draw", "tactics.end_turn", "tactics.fallen", "tactics.head",
            "tactics.hint_act", "tactics.hint_busy", "tactics.hint_pick", "tactics.hint_pick2", "tactics.hit", "tactics.lose", "tactics.miss", "tactics.note",
            "tactics.note_take", "tactics.result", "tactics.retreat", "tactics.rout", "tactics.troop", "tactics.win", "tactics.wounded", "war.err_hurt",
            "archive.annals_title", "archive.annal_row", "archive.annals_more", "mount.hurt",
        };

        private static List<string> NewTexts(Transform root, int from)
        {
            var list = new List<string>();
            for (int i = from; i < root.childCount; i++)
                foreach (var t in root.GetChild(i).GetComponentsInChildren<TMPro.TextMeshProUGUI>(true)) list.Add(t.text);
            return list;
        }

        private static bool RecordChecks(string json1, string enemy, List<string> tester, ref string m)
        {
            const System.Reflection.BindingFlags Any = System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance;
            // ① 서고 열전 — 둘을 쓰러뜨리면 제목 "2", 최근 먼저
            RealmSaveState.ApplyJson(json1);
            var ui = Object.FindFirstObjectByType<Saga.Realm.UI.RealmCommandUi>();
            if (ui == null) { Fail("RealmCommandUi 없음"); return false; }
            var t = typeof(Saga.Realm.UI.RealmCommandUi);
            var root = (Transform)t.GetField("_archiveButtonsRoot", Any).GetValue(ui);
            int n0 = root.childCount;
            t.GetMethod("RefreshArchivePanel", Any).Invoke(ui, null);
            if (NewTexts(root, n0).Any(s => s.Contains("⚰️"))) Fail("열전이 없는데 서고에 열전 절");
            RealmCityState.RetireOfficer(tester[0], enemy, "시험 수비군 갑");
            RealmCityState.RetireOfficer(tester[1], enemy, "시험 수비군 을");
            n0 = root.childCount;
            t.GetMethod("RefreshArchivePanel", Any).Invoke(ui, null);
            var texts = NewTexts(root, n0);
            string n1 = RealmOfficerPool.Get(tester[1])?.Name ?? tester[1], n2 = RealmOfficerPool.Get(tester[0])?.Name ?? tester[0];
            if (texts.Count < 3 || !texts[0].Contains("⚰️") || !texts[0].Contains("2") || !texts[1].Contains(n1) || !texts[1].Contains("을") || !texts[2].Contains(n2))
                Fail($"서고 열전 줄 [{string.Join(" | ", texts.Take(3))}]");
            m += $" · 서고 열전 「{(texts.Count > 1 ? texts[1] : "")}」";

            // ② 명마 줄 🩹 — 셋째 달에 사라짐
            var mu = Saga.Realm.UI.RealmMountUi.Instance;
            if (mu == null) Fail("RealmMountUi 없음");
            else
            {
                var mt = typeof(Saga.Realm.UI.RealmMountUi);
                string who = RealmCityState.RosterIds[0], nm = RealmOfficerPool.Get(who)?.Name ?? who;
                RealmCityState.SetHurt(who, 3);
                string Row()
                {
                    var rr = (Transform)mt.GetField("_rowsRoot", Any).GetValue(mu);
                    mt.GetMethod("RefreshPanel", Any).Invoke(mu, null);   // 옛 줄은 떼어 낸 뒤 지우므로 남은 자식은 다 새 줄
                    return NewTexts(rr, 0).FirstOrDefault(s => s.StartsWith(nm)) ?? "";
                }
                string r1 = Row();
                if (!r1.Contains("🩹 3")) Fail($"명마 줄 중상 딱지 「{r1}」");
                for (int k = 0; k < 3; k++) RealmCityState.NextMonth();
                string r2 = Row();
                if (r2.Contains("🩹")) Fail($"셋째 달 뒤에도 딱지 「{r2}」");
                m += $" · 명마 「{r1}」";
            }

            // ③ ko/en 표 — 새 키 다 있고 en 값에 한글 없음
            var ko = Resources.Load<TextAsset>("Localization/realm_ko")?.text ?? "";
            var en = Resources.Load<TextAsset>("Localization/realm_en")?.text ?? "";
            foreach (var k in Keys)
            {
                string pat = "\"key\": \"" + System.Text.RegularExpressions.Regex.Escape(k) + "\", \"value\": \"((?:[^\"\\\\]|\\\\.)*)\"";
                var mk = System.Text.RegularExpressions.Regex.Match(ko, pat);
                var me = System.Text.RegularExpressions.Regex.Match(en, pat);
                if (!mk.Success || !me.Success) { Fail($"번역 키 없음 {k} (ko {mk.Success}·en {me.Success})"); continue; }
                if (System.Text.RegularExpressions.Regex.IsMatch(me.Groups[1].Value, "[가-힣]")) Fail($"en {k} 에 한글");
            }
            RealmSaveState.ApplyJson(json1);
            return _ok;
        }

        private static int EnabledRootCanvases() => Object.FindObjectsByType<Canvas>(FindObjectsSortMode.None).Count(c => c.isRootCanvas && c.enabled);

        private static bool ViewChecks(string json1, string from, string enemy, ref string m)
        {
            bool ok = _ok;
            // ① CellOf — 칸 가운데·가장자리·바깥(−1)
            for (int y = 0; y < U.Rows; y++)
                for (int x = 0; x < U.Cols; x++)
                    if (V.CellOf(V.CellCenter(x, y)) != new Vector2Int(x, y)) Fail($"CellOf 가운데 ({x},{y})");
            if (V.CellOf(V.CellCenter(7, 5) + new Vector3(0.49f, 0f, -0.49f)) != new Vector2Int(7, 5) ||
                V.CellOf(V.CellCenter(0, 0) + new Vector3(-0.49f, 0f, 0.49f)) != new Vector2Int(0, 0)) Fail("CellOf 가장자리");
            foreach (var p in new[] { new Vector3(-4.01f, 0f, 0f), new Vector3(4.01f, 0f, 0f), new Vector3(0f, 0f, 3.01f), new Vector3(0f, 0f, -3.01f) })
                if (V.CellOf(p) != new Vector2Int(-1, -1)) Fail($"CellOf 바깥 {p}");

            // ② 고르기·옮기기·물러남(instant)
            RealmSaveState.ApplyJson(json1);
            int canv0 = EnabledRootCanvases();
            bool called = false; U.Bonus got = null;
            var v = V.Open(from, enemy, g => { called = true; got = g; }, instant: true);
            if (v == null) { Fail("판 Open null"); return false; }
            if (v.FigureCount != v.Board.Units.Count) Fail($"몸 {v.FigureCount} ≠ 유닛 {v.Board.Units.Count}");
            if (v.Cam == null || v.Cam.depth < 50f || EnabledRootCanvases() != 1 || v.PausedCount == 0) Fail($"판 카메라·캔버스 가림 (캔버스 {EnabledRootCanvases()}·멈춤 {v.PausedCount})");
            var mu = v.Board.Units.First(u => u.Side == "me");
            v.Tap(mu.X, mu.Y);
            if (v.Selected != mu.Uid || v.MoveCellCount == 0) Fail($"고르기 {v.Selected} 갈 칸 {v.MoveCellCount}");
            var dest = U.Moves(v.Board, mu.Uid).First(c => c.x != mu.X || c.y != mu.Y);
            v.Tap(dest.x, dest.y);
            if (mu.X != dest.x || mu.Y != dest.y || !mu.Moved) Fail($"옮기기 ({mu.X},{mu.Y}) ≠ ({dest.x},{dest.y})");
            if (!v.Engaged) Fail("옮긴 뒤 Engaged 아님");
            v.Retreat();   // 맞붙은 뒤 물러남 = 패(R-5 리뷰)
            if (!called || got == null || got.Kind != "lose" || got.WinPct != -25 || V.Active != null) Fail($"맞붙은 뒤 물러남 → 패여야 ({got?.Kind})");
            if (EnabledRootCanvases() != canv0) Fail($"캔버스 되돌림 {EnabledRootCanvases()} ≠ {canv0}");
            called = false; got = null;
            v = V.Open(from, enemy, g => { called = true; got = g; }, instant: true);
            int cams = Object.FindObjectsByType<Camera>(FindObjectsSortMode.None).Count(c => c.enabled);
            if (cams != 1) Fail($"판이 열린 동안 켜진 카메라 {cams} ≠ 1(판 카메라만)");
            if (v.Engaged) Fail("새 판인데 Engaged");
            v.Retreat();   // 아무것도 안 하고 물러남 = 출진 취소(콜백 null)
            if (!called || got != null || V.Active != null) Fail("손대기 전 물러남 → 콜백 null(취소)");
            // 클릭 — 몸(키 절반 자리)을 누르면 그 유닛 칸, 칸 윗면 가운데를 누르면 그 칸(높이 반영)
            v = V.Open(from, enemy, null, instant: true);
            var fu = v.Board.Units.First(u => u.Side == "foe");
            var fig = v.transform.Find(fu.Uid);
            if (fig != null)
            {
                var sp = v.Cam.WorldToScreenPoint(fig.position + Vector3.up * 0.6f);
                if (v.PickCell(sp) != new Vector2Int(fu.X, fu.Y)) Fail($"몸 클릭 {v.PickCell(sp)} ≠ ({fu.X},{fu.Y})");
            }
            for (int y = 0; y < U.Rows; y++)
                for (int x = 0; x < U.Cols; x++)
                {
                    if (v.Board.Units.Exists(u => u.Hp > 0 && Mathf.Abs(u.X - x) + Mathf.Abs(u.Y - y) <= 1)) continue; // 몸 둘레는 몸 판정이 먼저
                    if (y + 1 < U.Rows && V.Height(U.CellAt(v.Board, x, y + 1).Value) > V.Height(U.CellAt(v.Board, x, y).Value)) continue; // 카메라 쪽 앞 칸이 더 높으면(성벽) 가려진다 — 앞 칸이 잡히는 게 맞다
                    var top = v.transform.position + V.CellCenter(x, y) + Vector3.up * V.Height(U.CellAt(v.Board, x, y).Value);
                    var c = v.PickCell(v.Cam.WorldToScreenPoint(top));
                    if (c != new Vector2Int(x, y)) Fail($"칸 윗면 클릭 ({x},{y}) → {c}");
                }
            V.Close();

            // ③ 맡기기 = 같은 씨앗 AutoPlay
            called = false; got = null;
            v = V.Open(from, enemy, g => { called = true; got = g; }, instant: true);
            v.PressDelegate();
            var rb = U.Open(from, enemy);
            var want = U.Apply(U.AutoPlay(rb), rb.EnemyId);
            if (!called || got == null || got.Kind != want.Kind || got.WinPct != want.WinPct || !got.Fallen.SequenceEqual(want.Fallen)) Fail($"맡기기 {got?.Kind} ≠ AutoPlay {want.Kind}");
            if (V.Active != null) Fail("맡기기 뒤 판이 안 닫힘");

            // ④ 토글 배선 — 켜고 출진하면 판이 먼저 열리고, 손대기 전 물러나면 출진을 거두며, 맞붙은 뒤 물러나면 패 보정으로 출진한다
            RealmSaveState.ApplyJson(json1);
            var ui = Object.FindFirstObjectByType<Saga.Realm.UI.RealmCommandUi>();
            if (ui == null) Fail("RealmCommandUi 없음");
            else
            {
                const System.Reflection.BindingFlags Any = System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance;
                var t = typeof(Saga.Realm.UI.RealmCommandUi);
                var label = t.GetField("_gridToggleLabel", Any).GetValue(ui) as TMPro.TextMeshProUGUI;
                if (label == null || !label.text.Contains("♟")) Fail("전술판 토글 없음");
                bool duel0 = (bool)t.GetField("_duelEnabled", Any).GetValue(ui);
                t.GetField("_duelEnabled", Any).SetValue(ui, false);
                t.GetMethod("ToggleGrid", Any).Invoke(ui, null);
                int troops0 = RealmCityState.CityRecord(from).Troops;
                string cur0 = RealmCityState.CurrentCity;
                typeof(RealmCityState).GetProperty("CurrentCity").SetValue(null, from);
                t.GetMethod("BeginAttackFlow", Any).Invoke(ui, new object[] { enemy, true });
                if (V.Active == null || RealmCityState.CityRecord(from).Troops != troops0) Fail("토글 켜고 출진 → 판이 먼저 열려야(아직 출진 전)");
                V.Active?.Retreat();
                if (V.Active != null || RealmCityState.CityRecord(from).Troops != troops0) Fail("손대기 전 물러나면 출진을 거둬야(병력 그대로)");
                t.GetMethod("BeginAttackFlow", Any).Invoke(ui, new object[] { enemy, true });
                var av = V.Active;
                if (av == null) Fail("다시 출진 → 판이 열려야");
                else
                {
                    typeof(V).GetField("_instant", Any).SetValue(av, true);
                    var mu2 = av.Board.Units.First(u => u.Side == "me");
                    av.Tap(mu2.X, mu2.Y);
                    var d2 = U.Moves(av.Board, mu2.Uid).First(c => c.x != mu2.X || c.y != mu2.Y);
                    av.Tap(d2.x, d2.y);
                    av.Retreat();
                    if (V.Active != null || RealmCityState.CityRecord(from).Troops == troops0) Fail("맞붙은 뒤 물러나면 패 보정으로 출진해야(병력이 나갔어야)");
                }
                Saga.Realm.World.RealmBattlefield.Hide();
                t.GetMethod("ToggleGrid", Any).Invoke(ui, null);
                t.GetField("_duelEnabled", Any).SetValue(ui, duel0);
                typeof(RealmCityState).GetProperty("CurrentCity").SetValue(null, cur0);
            }
            m += " · 판 화면 칸 변환·고르기·옮기기·물러남(취소/패)·카메라 하나·클릭 높이·맡기기=AutoPlay·토글 배선";
            return ok && _ok;
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
        internal static bool Setup(out string from, out string enemy, out List<string> tester)
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
