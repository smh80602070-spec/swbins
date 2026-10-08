using System;
using System.Diagnostics;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEngine;
using Saga.Go.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0052 사가만리 경험치 곡선 진단(`-executeMethod …PlaytestGoExpCurve.RunBatch`, 장면 없이) —
    /// ① Lv.1~30 문턱이 옛 식(80×1.35^(L−1), float 반올림)과 같다 ② Lv.1~200 문턱이 0 보다 크고 계속 커진다
    /// ③ <c>AddExp(long.MaxValue/4)</c> 가 1초 안에 끝난다(옛 식은 Lv.58 에서 음수 문턱으로 끝나지 않았다)
    /// ④ 이야기 마지막 장 문턱 Lv.85 가 5e7 이하 ⑤ 옛 int 세이브(Lv.10·경험치 1000)를 읽어도 값 그대로.
    /// 끝나면 세이브 스냅샷으로 모든 상태를 되돌린다.
    /// </summary>
    public static class PlaytestGoExpCurve
    {
        [MenuItem("Saga/Playtest Go Exp Curve")]
        public static void RunBatch()
        {
            PlaytestKit.Begin("[PlaytestGoExpCurve]");
            string snap = SaveState.ToJson();
            int lv0 = PlayerStats.Level, cycle0 = CycleState.Cycle; long exp0 = PlayerStats.Exp;
            using (PlaytestKit.ErrorCounter())
            {
                try
                {
                    CheckOldRange();
                    CheckMonotonic();
                    CheckHugeAddExp();
                    CheckStoryThreshold();
                    CheckOldSave(snap);
                }
                finally
                {
                    SaveState.ApplyJson(snap);
                    PlayerStats.Restore(lv0, exp0); CycleState.Restore(cycle0);
                }
            }
            PlaytestKit.Summary("PlaytestGoExpCurve");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        // 옛 PlayerStats.ExpForLevel 그대로 — float 거듭제곱 후 AwayFromZero 반올림
        private static int OldExpForLevel(int level) => (int)Math.Round(80 * (float)Math.Pow(1.35f, level - 1), MidpointRounding.AwayFromZero);

        private static void CheckOldRange()
        {
            for (int l = 1; l <= PlayerStats.CurveBendLevel; l++)
                PlaytestKit.Check(PlayerStats.ExpForLevel(l) == OldExpForLevel(l), $"Lv.{l} 문턱 {PlayerStats.ExpForLevel(l)} ≠ 옛 식 {OldExpForLevel(l)}");
            PlaytestKit.Check(PlayerStats.ExpForLevel(1) == 80, "Lv.1 문턱이 80 이 아님");
        }

        private static void CheckMonotonic()
        {
            PlaytestKit.Check(PlayerStats.ExpForLevel(1) > 0, "Lv.1 문턱이 0 이하");
            for (int l = 2; l <= PlayerStats.LoopGuardLevel; l++)
                PlaytestKit.Check(PlayerStats.ExpForLevel(l) > PlayerStats.ExpForLevel(l - 1), $"Lv.{l} 문턱 {PlayerStats.ExpForLevel(l)} 이 Lv.{l - 1} {PlayerStats.ExpForLevel(l - 1)} 보다 크지 않음");
            // 꺾인 뒤는 레벨마다 ×1.08 — 1.35 로 계속 자라지 않는다
            double r = (double)PlayerStats.ExpForLevel(PlayerStats.CurveBendLevel + 1) / PlayerStats.ExpForLevel(PlayerStats.CurveBendLevel);
            PlaytestKit.Check(Math.Abs(r - 1.08) < 0.001, $"Lv.31 증가율 {r:F4} ≠ 1.08");
        }

        private static void CheckHugeAddExp()
        {
            CycleState.ResetForTest();
            PlayerStats.Restore(1, 0);
            var sw = Stopwatch.StartNew();
            PlayerStats.AddExp(long.MaxValue / 4);
            sw.Stop();
            PlaytestKit.Check(sw.ElapsedMilliseconds < 1000, $"AddExp(long.MaxValue/4) 가 {sw.ElapsedMilliseconds}ms");
            PlaytestKit.Check(PlayerStats.Level == PlayerStats.LoopGuardLevel && PlayerStats.Exp > 0, $"큰 경험치 뒤 Lv.{PlayerStats.Level}·경험치 {PlayerStats.Exp}");
            // 옛 식이 멈추던 자리(Lv.58) 를 지나 보통 크기로도 오른다(동행 보너스가 있으면 더 오를 수 있어 ≥)
            PlayerStats.Restore(57, 0);
            PlayerStats.AddExp(PlayerStats.ExpToNext + PlayerStats.ExpForLevel(58));
            PlaytestKit.Check(PlayerStats.Level >= 59, $"Lv.57 → 59 가 아님(Lv.{PlayerStats.Level}·경험치 {PlayerStats.Exp})");
        }

        private static void CheckStoryThreshold()
        {
            long t85 = PlayerStats.ExpForLevel(85);
            PlaytestKit.Check(t85 <= 50_000_000L, $"Lv.85 문턱 {t85:N0} > 5e7");
            long sum = 0;
            for (int l = 1; l < 85; l++) sum += PlayerStats.ExpForLevel(l);
            UnityEngine.Debug.Log($"[PlaytestGoExpCurve] Lv.30 {PlayerStats.ExpForLevel(30):N0} · Lv.58 {PlayerStats.ExpForLevel(58):N0} · Lv.85 {t85:N0} · Lv.1→85 누적 {sum:N0} · Lv.200 {PlayerStats.ExpForLevel(200):N0}");
        }

        private static void CheckOldSave(string snap)
        {
            // 옛 세이브는 exp 를 int 로 썼다 — 같은 JSON 숫자라 long 칸에 그대로 읽혀야 한다
            // 첫 칸 = 최상위 칸(같은 이름이 안쪽에 또 있어도 안 건드린다)
            string old = new Regex("\"level\":-?\\d+").Replace(snap, "\"level\":10", 1);
            old = new Regex("\"exp\":-?\\d+").Replace(old, "\"exp\":1000", 1);
            PlaytestKit.Check(old.Contains("\"level\":10") && old.Contains("\"exp\":1000"), "옛 세이브 JSON 을 못 만듦(필드 이름이 바뀜)");
            PlaytestKit.Check(SaveState.ApplyJson(old), "옛 세이브 읽기 실패");
            PlaytestKit.Check(PlayerStats.Level == 10 && PlayerStats.Exp == 1000, $"옛 세이브가 Lv.{PlayerStats.Level}·경험치 {PlayerStats.Exp} 로 읽힘");
            // 왕복 — 다시 써도 같은 값
            string again = SaveState.ToJson();
            PlaytestKit.Check(again.Contains("\"level\":10") && again.Contains("\"exp\":1000"), "세이브 왕복에서 경험치가 바뀜");
        }
    }
}
