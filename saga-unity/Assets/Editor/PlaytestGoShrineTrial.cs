using System;
using UnityEditor;
using UnityEngine;
using Saga.Go.Data;
using GoSave = Saga.Go.Data.SaveState;

namespace Saga.EditorTools
{
    /// <summary>
    /// `un.go.shrine-trial` 101-2 사당 시련 — 규칙 층만 본다(화면·씬 없이, RECURRING R-3). ① 하루 3회 입장(날이 바뀌면 다시)·인장 조각 3개 = 인장 1
    /// ② 실패 잠금 10분(들어갈 수 없음·풀림) ③ 복원은 음수를 자름·날짜 없음은 빈 글자 ④ 세이브 JSON 왕복(입장 수·조각·인장·잠금).
    /// 파도 3개·보상 수치는 `ShrineTrialEncounter`(씬) 안에 있어 이 진단 밖.
    /// `-executeMethod Saga.EditorTools.PlaytestGoShrineTrial.Run` → "[PlaytestGoShrineTrial] OK/FAIL".
    /// </summary>
    public static class PlaytestGoShrineTrial
    {
        [MenuItem("Saga/Playtest Go Shrine Trial")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestGoShrineTrial]");
            string saved = GoSave.ToJson();
            using (PlaytestKit.IsolatedSaves())
            using (PlaytestKit.ErrorCounter())
            {
                CheckConstants();
                CheckDaily();
                CheckStamps();
                CheckLock();
                CheckRestore();
                CheckSaveRoundTrip();
            }
            GoSave.ApplyJson(saved);
            PlaytestKit.Summary("PlaytestGoShrineTrial");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static string Today => DateTime.Now.ToString("yyyy-MM-dd");

        private static void CheckConstants()
        {
            PlaytestKit.Check(ShrineTrialState.DailyLimit == 3 && ShrineTrialState.ShardsPerStamp == 3 && Math.Abs(ShrineTrialState.LockWindowSec - 600.0) < 1e-6,
                "un.go.shrine-trial: 웹판 상수(하루 3회·조각 3개·잠금 10분)와 다름");
        }

        private static void CheckDaily()
        {
            ShrineTrialState.Restore("", 0, 0, 0, 0L);
            for (int i = 0; i < ShrineTrialState.DailyLimit; i++)
            {
                PlaytestKit.Check(ShrineTrialState.CanEnter(), $"un.go.shrine-trial: {i}번 들어갔을 때 입장이 막힘");
                ShrineTrialState.ReportEntry();
            }
            PlaytestKit.Check(!ShrineTrialState.CanEnter(), "un.go.shrine-trial: 하루 3번을 채웠는데 또 들어갈 수 있음");
            PlaytestKit.Check(ShrineTrialState.SnapshotDate() == Today && ShrineTrialState.SnapshotDailyCount() == 3, $"un.go.shrine-trial: 오늘 기록 {ShrineTrialState.SnapshotDate()}/{ShrineTrialState.SnapshotDailyCount()}");
            ShrineTrialState.Restore("2000-01-01", 3, 0, 0, 0L);
            PlaytestKit.Check(ShrineTrialState.CanEnter() && ShrineTrialState.SnapshotDailyCount() == 0, "un.go.shrine-trial: 날이 바뀌었는데 횟수가 안 풀림");
            ShrineTrialState.Restore(Today, 3, 0, 0, 0L);
            PlaytestKit.Check(!ShrineTrialState.CanEnter(), "un.go.shrine-trial: 오늘 3번 쓴 기록을 복원했는데 들어갈 수 있음");
            ShrineTrialState.Restore(Today, 2, 0, 0, 0L);
            PlaytestKit.Check(ShrineTrialState.CanEnter(), "un.go.shrine-trial: 오늘 2번 쓴 기록인데 입장이 막힘");
        }

        private static void CheckStamps()
        {
            ShrineTrialState.Restore("", 0, 0, 0, 0L);
            bool[] want = { false, false, true, false, false, true, false };
            for (int i = 0; i < want.Length; i++)
                PlaytestKit.Check(ShrineTrialState.ReportClear() == want[i], $"un.go.shrine-trial: {i + 1}번째 클리어 인장 지급 여부가 {want[i]} 가 아님");
            PlaytestKit.Check(ShrineTrialState.Shards == 7 && ShrineTrialState.Stamps == 2, $"un.go.shrine-trial: 조각 {ShrineTrialState.Shards}·인장 {ShrineTrialState.Stamps} (기대 7·2)");
        }

        private static void CheckLock()
        {
            ShrineTrialState.Restore("", 0, 0, 0, 0L);
            PlaytestKit.Check(!ShrineTrialState.IsLocked && ShrineTrialState.CanEnter(), "un.go.shrine-trial: 잠금 전인데 잠겨 있음");
            long before = DateTime.Now.Ticks;
            ShrineTrialState.ReportFailLock();
            double sec = (ShrineTrialState.SnapshotLockUntilTicks() - before) / (double)TimeSpan.TicksPerSecond;
            PlaytestKit.Check(ShrineTrialState.IsLocked && !ShrineTrialState.CanEnter(), "un.go.shrine-trial: 실패 뒤에도 잠기지 않음");
            PlaytestKit.Check(sec > 595.0 && sec < 610.0, $"un.go.shrine-trial: 잠금 길이 {sec:F1}초 (기대 600)");
            ShrineTrialState.Restore("", 0, 0, 0, DateTime.Now.AddSeconds(-1).Ticks);
            PlaytestKit.Check(!ShrineTrialState.IsLocked && ShrineTrialState.CanEnter(), "un.go.shrine-trial: 지난 잠금이 안 풀림");
            ShrineTrialState.Restore("", 0, 0, 0, DateTime.Now.AddMinutes(5).Ticks);
            PlaytestKit.Check(ShrineTrialState.IsLocked && !ShrineTrialState.CanEnter(), "un.go.shrine-trial: 남은 잠금이 복원에서 사라짐");
        }

        private static void CheckRestore()
        {
            ShrineTrialState.Restore(null, -5, -7, -9, 0L);
            PlaytestKit.Check(ShrineTrialState.SnapshotDate() == "" && ShrineTrialState.SnapshotDailyCount() == 0 && ShrineTrialState.Shards == 0 && ShrineTrialState.Stamps == 0,
                "un.go.shrine-trial: 복원이 음수·null 을 못 자름");
        }

        private static void CheckSaveRoundTrip()
        {
            ShrineTrialState.Restore(Today, 2, 5, 1, DateTime.Now.AddMinutes(3).Ticks);
            long lockTicks = ShrineTrialState.SnapshotLockUntilTicks();
            string json = GoSave.ToJson();
            ShrineTrialState.Restore("", 0, 0, 0, 0L);
            PlaytestKit.Check(GoSave.ApplyJson(json), "un.go.shrine-trial: GO 세이브가 안 읽힘");
            PlaytestKit.Check(ShrineTrialState.SnapshotDate() == Today && ShrineTrialState.SnapshotDailyCount() == 2 && ShrineTrialState.Shards == 5 && ShrineTrialState.Stamps == 1 && ShrineTrialState.SnapshotLockUntilTicks() == lockTicks,
                $"un.go.shrine-trial: 세이브 왕복 {ShrineTrialState.SnapshotDate()}/{ShrineTrialState.SnapshotDailyCount()}/{ShrineTrialState.Shards}/{ShrineTrialState.Stamps}");
        }
    }
}
