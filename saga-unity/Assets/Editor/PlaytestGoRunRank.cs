using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0174 1만리 무리 토벌 등급(웹 W-0379 · 고돗 G-0313) 진단 — `PlaytestHeadless` 가 말 위 전투 뒤에 부른다(한 프레임 안, 시각은 붙듦).
    /// 무리 south_glade_e(해골 둘, 보물 상자 잠금 없음)로: ① 빠르고 안 맞으면 S — 실제 `TakeHit` 이 판을 열고 연타를 세며, 무리가 다 쓰러지면
    /// 닫힘·경험 덤(쓰러뜨린 경험 × 0.5)·첫 기록 ② 장판 틱은 연타로 안 셈 · 피격 많으면 등급이 낮고 기록은 안 바뀜 ③ 20초 멍하면 버림 ·
    /// 전멸이면 버림 · 수호장은 안 셈 ④ 세이브 칸·왕복·옛 세이브 빈 기록. 끝나면 레벨·경험·기록·적을 시작 때로.
    /// </summary>
    public static class PlaytestGoRunRank
    {
        private const string T = "[PlaytestHeadless] gorank";
        private const string Camp = "south_glade_e";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            var foes = new List<FieldEnemy>();
            FieldEnemy guard = null;
            foreach (var e in FieldEnemy.All)
            {
                if (e.GroupId == Camp) foes.Add(e);
                if (e.GroupId == FieldSpawner.GuardianGroupId) guard = e;
            }
            if (foes.Count != 2) { Fail($"{Camp} 적 {foes.Count} ≠ 2"); return false; }
            int lv0 = PlayerStats.Level; long xp0 = PlayerStats.Exp;
            var camps0 = GoRunRank.SnapshotCamps();
            var grades0 = GoRunRank.SnapshotGrades(camps0);
            try
            {
                GoRunRank.Restore(null, null);
                GoRunRank.NowForTest = 100f;

                // ① S
                Begin();
                Fresh(foes);
                PlayerStats.Restore(30, 0);
                foes[0].TakeHit(1f, GoElement.Physical, 1f, out _);
                if (!GoRunRank.Counting(Camp)) Fail("TakeHit 이 판을 안 엶");
                for (int i = 0; i < 11; i++) GoRunRank.OnStruck(foes[i % 2]);
                GoRunRank.NowForTest = 130f;
                int exp = 0;
                foreach (var e in foes) { exp += e.ExpReward; e.TakeRaw(e.MaxHp * 10f, Color.white); }
                var r = GoRunRank.Last;
                if (GoRunRank.Counting(Camp) || !r.HasValue) Fail("무리가 다 쓰러졌는데 안 닫힘");
                else
                {
                    var v = r.Value;
                    int bonus = Mathf.RoundToInt(exp * 0.5f);
                    if (v.Rank != "S" || v.ComboMax != 12 || v.Hits != 0 || v.Kills != 2 || v.Sec != 30) Fail($"등급 {v.Rank} 연타 {v.ComboMax} 피격 {v.Hits} 처치 {v.Kills} {v.Sec}초");
                    if (v.Tier != GoWorldMap.DangerOf(FieldSpawner.GroupRegion(Camp))) Fail($"급 {v.Tier}");
                    if (v.Bonus != bonus || PlayerStats.Exp < exp + bonus) Fail($"덤 {v.Bonus} ≠ {bonus} · 경험 {PlayerStats.Exp} < {exp + bonus}"); // 회차·짝 배율이 곱해질 수 있어 하한만
                    if (!v.Best || v.PrevBest != null || GoRunRank.BestOf(Camp) != "S") Fail("첫 기록 아님");
                    End($"S OK - TakeHit 이 엶·연타 12·피격 0·30초 → S(급 {v.Tier}) · 덤 경험 +{v.Bonus}(= {exp} × 0.5) · 첫 기록「{GoRunRank.Text(v).Replace("\n", " / ")}」");
                }

                // ② 장판·피격
                Begin();
                Fresh(foes);
                GoRunRank.ClearForTest();
                GoRunRank.NowForTest = 200f;
                FieldCombat.ZoneTicking = true;
                for (int i = 0; i < 6; i++) GoRunRank.OnStruck(foes[0]);
                FieldCombat.ZoneTicking = false;
                if (!GoRunRank.Counting(Camp)) Fail("장판 틱이 판을 안 엶");
                GoRunRank.OnStruck(foes[0]);
                for (int i = 0; i < 9; i++) GoRunRank.OnHurt();
                GoRunRank.NowForTest = 205f;
                foreach (var e in foes) e.TakeRaw(e.MaxHp * 10f, Color.white);
                r = GoRunRank.Last;
                if (!r.HasValue) Fail("둘째 판 안 닫힘");
                else
                {
                    var v = r.Value;
                    // 급 3: 피격 9 ≤ 8+4 → 1 · 연타 1 → 0 · 5초 → 2 = 3 → B
                    if (v.ComboMax != 1 || v.Hits != 9 || v.Rank != "B") Fail($"장판 연타 셈·피격 — 연타 {v.ComboMax}(1) 피격 {v.Hits}(9) 등급 {v.Rank}(B)");
                    if (v.Best || v.PrevBest != null && v.PrevBest != "S" || GoRunRank.BestOf(Camp) != "S") Fail("낮은 등급이 기록을 덮음");
                    End($"zone OK - 장판 틱 6 은 판만 열고 연타 0 · 피격 9 → {v.Rank} · 기록 S 그대로");
                }

                // ③ 버림
                Begin();
                Fresh(foes);
                GoRunRank.ClearForTest();
                GoRunRank.NowForTest = 300f;
                for (int i = 0; i < 3; i++) GoRunRank.OnStruck(foes[0]);
                GoRunRank.NowForTest = 300f + GoRunRank.IdleSec + 1f;
                GoRunRank.OnStruck(foes[0]); // 멍한 판은 버리고 새로 연다
                foes[0].TakeRaw(foes[0].MaxHp * 10f, Color.white);
                GoRunRank.NowForTest = 400f;
                foes[1].TakeRaw(foes[1].MaxHp * 10f, Color.white); // 같은 새 판(처치는 멍한 셈을 안 하고 닫는다)
                if (!GoRunRank.Last.HasValue || GoRunRank.Last.Value.ComboMax != 1) Fail($"멍한 판을 안 버림(연타 {GoRunRank.Last?.ComboMax})");
                Fresh(foes);
                GoRunRank.ClearForTest();
                GoRunRank.OnStruck(foes[0]);
                GoRunRank.OnWiped();
                if (GoRunRank.Counting(Camp)) Fail("전멸에 안 버림");
                if (guard != null) { GoRunRank.OnStruck(guard); if (GoRunRank.Counting(guard.GroupId)) Fail("수호장을 셈"); }
                End($"drop OK - {GoRunRank.IdleSec:0}초 멍하면 새 판 · 전멸이면 버림 · 수호장 안 셈");

                // ④ 세이브
                Begin();
                GoRunRank.Restore(new List<string> { Camp, "north_wood", "", "farm_edge" }, new List<string> { "A", "Q", "S", "B" });
                if (GoRunRank.BestOf(Camp) != "A" || GoRunRank.BestOf("north_wood") != "" || GoRunRank.BestOf("farm_edge") != "B") Fail("복원 거름");
                string json = SaveState.ToJson();
                if (!json.Contains("\"rankCamps\"") || !json.Contains("\"rankGrades\"")) Fail("세이브에 rankCamps·rankGrades 없음");
                var c = GoRunRank.SnapshotCamps();
                var g = GoRunRank.SnapshotGrades(c);
                GoRunRank.Restore(null, null);
                if (GoRunRank.BestOf(Camp) != "") Fail("옛 세이브인데 기록이 남음");
                GoRunRank.Restore(c, g);
                if (GoRunRank.BestOf(Camp) != "A" || GoRunRank.BestOf("farm_edge") != "B") Fail("왕복");
                End("save OK - rankCamps·rankGrades 칸·왕복·틀린 등급 거름·옛 세이브 빈 기록");
            }
            finally
            {
                GoRunRank.NowForTest = null;
                FieldCombat.ZoneTicking = false;
                GoRunRank.Restore(camps0, grades0);
                foreach (var e in foes) { e.ReviveNow(); e.RestoreHomeForTest(); }
                PlayerStats.Restore(lv0, xp0);
            }
            return _ok;
        }

        private static void Fresh(List<FieldEnemy> foes) { foreach (var e in foes) e.ReviveNow(); }

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
