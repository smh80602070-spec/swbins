using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Saga.Realm.Data;
using Saga.Realm.UI;
using Saga.Realm.World;
using U = Saga.Realm.Data.RealmTactics;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0204 ③④⑤ 격자 SRPG 본전투 진단 — `PlaytestRealmSlice` 가 옛 전술 진단 뒤에 부른다(한 프레임 안).
    /// ① 판(평지 10×8·강 11×9·공성 12×10 · 성문 하나 · 강 건널목) ② 유닛(대장·병종·기병 mov·궁병 rng) ③ 명중 덤(상성 ±20·높이 +10·뒤치기 +20)
    /// ④ 승리 조건(전멸·대장 격파·성문 점령·버팀·패) ⑤ 명령(화계·혼란·회복·일기토·설전 · 책략 둘) ⑥ 자동 대국 60판(승률 45~65%·평균 턴 ≤ 12)
    /// ⑦ 진입(전술판 단추 SRPG·세 상태 · 판 열기 = SRPG · 자동 전투 → 보정값). 끝나면 세이브 JSON·손잡이로 되돌린다.
    /// </summary>
    public static class PlaytestRealmSrpg
    {
        private const string T = "[PlaytestRealmSlice] srpg";
        private static bool _ok, _step;

        private static readonly Dictionary<string, U.Stats> St = new Dictionary<string, U.Stats>
        {
            ["a"] = new U.Stats(85, 60, 75), ["b"] = new U.Stats(55, 85, 70), ["c"] = new U.Stats(70, 50, 80),
        };

        public static bool Run()
        {
            _ok = true;
            string json0 = RealmSaveState.ToJson();
            bool srpg0 = U.Srpg;
            double foe0 = U.FoeMul;
            try
            {
                U.Srpg = true;

                // ① 판
                Begin();
                var p = U.MakeBoard("t|1", "plain", false);
                var r = U.MakeBoard("t|2", "river", false);
                var g = U.MakeBoard("t|3", "plain", true);
                if (p.W != 10 || p.H != 8 || r.W != 11 || r.H != 9 || g.W != 12 || g.H != 10) Fail($"크기 {p.W}×{p.H}·{r.W}×{r.H}·{g.W}×{g.H}");
                if (p.Goal != "chief" || g.Goal != "gate") Fail($"목표 {p.Goal}·{g.Goal}");
                int gates = g.Cells.Count(c => c == U.Cell.Gate);
                var gate = U.GateOf(g);
                int fords = 0;
                for (int y = 0; y < r.H; y++) { bool riverCol = false; for (int x = 0; x < r.W; x++) if (U.CellAt(r, x, y) == U.Cell.River) riverCol = true; if (!riverCol) fords++; }
                if (gates != 1 || !gate.HasValue || gate.Value.x != g.W - 3) Fail($"성문 {gates}");
                if (fords < 2) Fail($"강 건널목 {fords}");
                int hills = 0;
                for (int i = 0; i < 20; i++) hills += U.MakeBoard("h|" + i, "plain", false).Cells.Count(c => c == U.Cell.Hill);
                if (hills == 0) Fail("언덕이 한 칸도 없음(20판)");
                End($"board OK - 평지 10×8·강 11×9(건널목 {fords})·공성 12×10(성문 {gate}) · 언덕 20판 {hills}칸 · 목표 대장/성문");

                // ② 유닛
                Begin();
                var b = U.MakeBoard("u|1", "plain", false);
                U.UnitsOf(b, new[] { "a", "b", "c" }, null, new[] { 3000, 3000, 3000 }, St);
                var chief = b.Units.FirstOrDefault(u => u.Chief);
                var ua = U.UnitOf(b, "me:a"); var ub = U.UnitOf(b, "me:b"); var uc = U.UnitOf(b, "me:c");
                if (chief == null || chief.Kind != "chief") Fail("대장 없음");
                if (ua.Arm != "cav" || ua.Mov != U.Mov + 1 || ub.Arm != "bow" || ub.Rng != 2 || uc.Arm != "spear") Fail($"병종 {ua.Arm}{ua.Mov}·{ub.Arm}{ub.Rng}·{uc.Arm}");
                var spots = new HashSet<int>();
                foreach (var u in b.Units) { if (!spots.Add(u.Y * b.W + u.X)) Fail("자리 겹침"); var c = U.CellAt(b, u.X, u.Y); if (c == U.Cell.River || c == U.Cell.Wall) Fail("못 서는 칸"); }
                End($"units OK - 대장 hp {chief?.Max}·무력 {chief?.Might} · 무력 높음 = 기(mov {ua.Mov}) · 지력 높음 = 궁(rng {ub.Rng}) · 통솔 = 창 · 겹침 0");

                // ③ 명중 덤
                Begin();
                if (U.ArmBonus("spear", "cav") != 20 || U.ArmBonus("cav", "bow") != 20 || U.ArmBonus("bow", "spear") != 20 || U.ArmBonus("cav", "spear") != -20 || U.ArmBonus("spear", "spear") != 0) Fail("상성 표");
                var hb = U.MakeBoard("m|1", "plain", false);
                for (int i = 0; i < hb.Cells.Length; i++) hb.Cells[i] = U.Cell.Plain;
                var att = new U.Unit { Uid = "me:x", Side = "me", Kind = "troop", Arm = "spear", Atk = 6, Def = 2, X = 3, Y = 3, Rng = 1, Hp = 50, Max = 50 };
                var tgt = new U.Unit { Uid = "foe:y", Side = "foe", Kind = "troop", Arm = "spear", Atk = 12, Def = 4, X = 4, Y = 3, Fx = -1, Fy = 0, Hp = 50, Max = 50 };
                hb.Units = new List<U.Unit> { att, tgt };
                int front = U.HitOf(hb, att, tgt);
                hb.Cells[3 * hb.W + 3] = U.Cell.Hill;
                int high = U.HitOf(hb, att, tgt);
                hb.Cells[3 * hb.W + 3] = U.Cell.Plain;
                tgt.Fx = 1;   // 등을 보임
                int back = U.HitOf(hb, att, tgt);
                tgt.Fx = -1; tgt.Arm = "bow";   // 창이 궁을 침 — 불리
                int weak = U.HitOf(hb, att, tgt);
                if (high != front + U.HighEdge || back != front + U.BackEdge || weak != front - U.ArmEdge) Fail($"명중 앞 {front}·언덕 {high}·뒤 {back}·불리 {weak}");
                End($"hit OK - 앞 {front}% · 언덕 위 {high}% · 뒤치기 {back}% · 창→궁 {weak}%");

                // ④ 승리 조건
                Begin();
                var c1 = Duo("g|1", "chief"); U.Alive(c1, "foe").First(u => u.Chief).Hp = 0; U.Check(c1);
                var c2 = Duo("g|2", "gate", siege: true); var gt = U.GateOf(c2).Value; var m2 = U.Alive(c2, "me")[0]; m2.X = gt.x; m2.Y = gt.y; U.EndTurn(c2);
                var c3 = Duo("g|3", "hold"); c3.Turn = U.HoldTurns + 1; U.Check(c3);
                var c4 = Duo("g|4", "chief"); foreach (var u in U.Alive(c4, "foe")) u.Hp = 0; U.Check(c4);
                var c5 = Duo("g|5", "chief"); foreach (var u in U.Alive(c5, "me")) u.Hp = 0; U.Check(c5);
                var c6 = Duo("g|6", "chief"); U.Check(c6);
                if (c1.Done != "win" || c2.Done != "win" || c3.Done != "win" || c4.Done != "rout" || c5.Done != "lose" || c6.Done != null)
                    Fail($"조건 대장 {c1.Done}·성문 {c2.Done}·버팀 {c3.Done}·전멸 {c4.Done}·패 {c5.Done}·진행 {c6.Done}");
                End($"goal OK - 대장 격파 승 · 성문 점령 승 · {U.HoldTurns}턴 버팀 승 · 전멸 대승 · 내 편 전멸 패 · 턴 상한 없음({U.TurnCap} 안전)");

                // ⑤ 명령
                Begin();
                var cb = Duo("c|1", "chief");
                var me1 = U.UnitOf(cb, "me:b"); var foeT = U.Alive(cb, "foe").First(u => !u.Chief); var ch = U.Alive(cb, "foe").First(u => u.Chief);
                me1.X = foeT.X - 2; me1.Y = foeT.Y;
                int hp0 = foeT.Hp;
                var f1 = U.Scheme(cb, me1.Uid, "fire", foeT.Uid);
                if (!f1.Ok || (f1.Success && foeT.Hp != hp0 - f1.Value) || (!f1.Success && foeT.Hp != hp0)) Fail($"화계 {f1.Ok}·{f1.Success}·{hp0}→{foeT.Hp}");
                if (U.Scheme(cb, me1.Uid, "confuse", foeT.Uid).Why != "busy") Fail("행동한 장수가 또 책략");
                me1.Acted = me1.Moved = false;
                var ally = U.UnitOf(cb, "me:a"); ally.Hp = ally.Max / 3; ally.X = me1.X; ally.Y = me1.Y + 1;
                int ah = ally.Hp;
                var h1 = U.Scheme(cb, me1.Uid, "heal", ally.Uid);
                if (!h1.Ok || ally.Hp <= ah) Fail("회복");
                me1.Acted = me1.Moved = false;
                if (U.Scheme(cb, me1.Uid, "fire", foeT.Uid).Why != "none") Fail($"책략 셋째 {cb.Schemes["me"]}");
                var duelist = U.UnitOf(cb, "me:a"); duelist.Acted = duelist.Moved = false; duelist.X = ch.X - 1; duelist.Y = ch.Y; duelist.Hp = duelist.Max;
                int dch = U.DuelChance(duelist, ch);
                var d1 = U.Duel(cb, duelist.Uid, ch.Uid);
                if (!d1.Ok || (d1.Success ? ch.Hp != 0 : duelist.Hp != duelist.Max / 2)) Fail($"일기토 {d1.Success}");
                duelist.Acted = duelist.Moved = false;
                if (U.Duel(cb, duelist.Uid, ch.Uid).Why != (ch.Hp > 0 ? "once" : "busy")) Fail("일기토 두 번");
                var cd = Duo("c|2", "chief");
                var de = U.UnitOf(cd, "me:b"); var dc = U.Alive(cd, "foe").First(u => u.Chief); de.X = dc.X - 2; de.Y = dc.Y;
                var t1 = U.Debate(cd, de.Uid, dc.Uid);
                if (!t1.Ok || (t1.Success ? dc.Confused != 2 : de.Confused != 1)) Fail($"설전 {t1.Success}");
                End($"cmd OK - 화계 {(f1.Success ? "−" + f1.Value : "실패")} · 회복 +{h1.Value} · 책략 둘 뒤 거절 · 일기토({dch}%) {(d1.Success ? "승 — 대장 쓰러짐" : "패 — 체력 반")}·두 번 안 됨 · 설전 {(t1.Success ? "승 — 대장 혼란 2" : "패 — 내 장수 혼란 1")}");

                // ⑥ 자동 대국 60판
                Begin();
                var (rate, turns, kinds) = Balance(60);
                if (rate < 0.45 || rate > 0.65) Fail($"60판 승률 {rate:P0}(45~65%)");
                if (turns > 12) Fail($"평균 턴 {turns:0.0} > 12");
                End($"balance OK - 60판 승률 {rate:P0} · 평균 {turns:0.0}턴 · " + string.Join(" ", kinds.Select(kv => kv.Key + kv.Value)) + $" · 적 세기 ×{U.FoeMul:0.00}");

                // ⑦ 진입
                Begin();
                var ui = Object.FindFirstObjectByType<RealmCommandUi>();
                string lab = ui != null ? ui.GridLabelForTest : "";
                if (ui == null || !lab.Contains("SRPG")) Fail($"전술판 단추「{lab}」");
                else
                {
                    ui.ToggleGridForTest(); bool off = !U.Srpg;
                    ui.ToggleGridForTest(); bool old = !U.Srpg;
                    ui.ToggleGridForTest();
                    if (!off || !old || !U.Srpg || !ui.GridLabelForTest.Contains("SRPG")) Fail("세 상태 돌기");
                }
                if (!PlaytestRealmTactics.Setup(out string from, out string enemy, out _)) Fail("칠 성 세우기 실패");
                else
                {
                    U.Bonus got = null; bool called = false;
                    var v = RealmTacticsView.Open(from, enemy, x => { called = true; got = x; }, instant: true);
                    bool srpgBoard = v != null && v.Board.IsSrpg && v.Board.W >= 10;
                    v?.PressDelegate();
                    if (!srpgBoard || !called || got == null) Fail($"판 SRPG {srpgBoard}·끝 {called}·보정 {got != null}");
                    End($"entry OK - 단추「♟ 본전투:SRPG」·세 상태 · {from} 출진 → SRPG 판 {v?.Board.W}×{v?.Board.H}(목표 {v?.Board.Goal}) · 자동 전투 → {got?.Kind} {got?.WinPct:+0;-0}%");
                }
            }
            finally
            {
                RealmTacticsView.Close();
                U.Srpg = srpg0;
                U.FoeMul = foe0;
                RealmSaveState.ApplyJson(json0);
            }
            return _ok;
        }

        /// <summary>내 셋(a·b·c) 대 적 셋(대장 포함) — 목표만 바꾼 판.</summary>
        private static U.Board Duo(string seed, string goal, bool siege = false)
        {
            var b = U.MakeBoard(seed, "plain", siege);
            U.UnitsOf(b, new[] { "a", "b", "c" }, null, new[] { 3000, 3000, 3000 }, St);
            b.Goal = goal;
            return b;
        }

        /// <summary>자동 대국 — 씨앗마다 땅(평지·강)·공성(셋에 하나)·장수 능력 55~85·적 병력 2000~8000. 승(승·대승) 비율·평균 턴·결과 셈.</summary>
        public static (double rate, double turns, Dictionary<string, int> kinds) Balance(int n)
        {
            int wins = 0, turnSum = 0;
            var kinds = new Dictionary<string, int>();
            for (int i = 0; i < n; i++)
            {
                string seed = "bal|" + i;
                var stats = new Dictionary<string, U.Stats>();
                var ids = new[] { "p", "q", "r" };
                foreach (var id in ids)
                    stats[id] = new U.Stats(55 + (int)(U.Hash(seed, id + "m") * 31), 55 + (int)(U.Hash(seed, id + "w") * 31), 55 + (int)(U.Hash(seed, id + "c") * 31));
                var b = U.MakeBoard(seed, i % 2 == 0 ? "plain" : "river", i % 3 == 0);
                int troops = 2000 + (int)(U.Hash(seed, "t") * 6000);
                U.UnitsOf(b, ids, null, new[] { troops, troops, troops }, stats);
                var o = U.AutoPlay(b);
                kinds[o.Kind] = kinds.TryGetValue(o.Kind, out var k) ? k + 1 : 1;
                if (o.Kind == "win" || o.Kind == "rout") wins++;
                turnSum += o.Turn;
            }
            return (wins / (double)n, turnSum / (double)n, kinds);
        }

        /// <summary>균형 잡기 — 적 세기 배율마다 60판 승률·평균 턴(배치: -executeMethod Saga.EditorTools.PlaytestRealmSrpg.Calibrate).</summary>
        public static void Calibrate()
        {
            bool s0 = U.Srpg; double f0 = U.FoeMul;
            U.Srpg = true;
            var lines = new List<string>();
            foreach (var m in new[] { 1.0, 1.4, 1.8, 2.2, 2.6, 3.0, 3.4 })
            {
                U.FoeMul = m;
                var (rate, turns, kinds) = Balance(60);
                lines.Add($"×{m:0.0} 승률 {rate:P0} 평균 {turns:0.0}턴 " + string.Join(" ", kinds.Select(kv => kv.Key + kv.Value)));
            }
            U.Srpg = s0; U.FoeMul = f0;
            Debug.Log("[PlaytestRealmSrpg] Calibrate | " + string.Join(" | ", lines));
            if (Application.isBatchMode) UnityEditor.EditorApplication.Exit(0);
        }

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string why)
        {
            _ok = false;
            _step = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
