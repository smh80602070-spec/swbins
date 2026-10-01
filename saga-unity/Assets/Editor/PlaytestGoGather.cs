using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Go.Data;
using GoSave = Saga.Go.Data.SaveState;

namespace Saga.EditorTools
{
    /// <summary>
    /// `un.go.gather` 채집 — 규칙 층만 본다(화면·씬 없이, RECURRING R-3). ① 한 자리는 한 번만(두 번째는 거절) ② 복원: null 은 비움·중복은 합침·이전 기록을 덮음
    /// ③ 세이브 JSON 왕복(채집한 자리 id 목록). 자리 위 지급(금 8)은 `Gatherable`(씬) 안에 있어 이 진단 밖.
    /// `-executeMethod Saga.EditorTools.PlaytestGoGather.Run` → "[PlaytestGoGather] OK/FAIL".
    /// </summary>
    public static class PlaytestGoGather
    {
        [MenuItem("Saga/Playtest Go Gather")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestGoGather]");
            string saved = GoSave.ToJson();
            using (PlaytestKit.IsolatedSaves())
            using (PlaytestKit.ErrorCounter())
            {
                CheckOnce();
                CheckRestore();
                CheckSaveRoundTrip();
            }
            GoSave.ApplyJson(saved);
            PlaytestKit.Summary("PlaytestGoGather");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void CheckOnce()
        {
            GatherState.Restore(null);
            PlaytestKit.Check(GatherState.GatheredIds.Count == 0 && !GatherState.IsGathered("a"), "un.go.gather: 새 상태가 비어 있지 않음");
            PlaytestKit.Check(GatherState.TryGather("a") && GatherState.IsGathered("a"), "un.go.gather: 첫 채집 실패");
            PlaytestKit.Check(!GatherState.TryGather("a") && GatherState.GatheredIds.Count == 1, "un.go.gather: 같은 자리를 두 번 채집함");
            PlaytestKit.Check(GatherState.TryGather("b") && GatherState.IsGathered("b") && !GatherState.IsGathered("c") && GatherState.GatheredIds.Count == 2, "un.go.gather: 다른 자리 채집이 어긋남");
        }

        private static void CheckRestore()
        {
            GatherState.Restore(new[] { "x", "y", "x" });
            PlaytestKit.Check(GatherState.GatheredIds.Count == 2 && GatherState.IsGathered("x") && GatherState.IsGathered("y"), "un.go.gather: 복원이 중복을 안 합침");
            PlaytestKit.Check(!GatherState.IsGathered("a") && !GatherState.TryGather("x") && GatherState.TryGather("a"), "un.go.gather: 복원이 이전 기록을 안 덮음/복원된 자리가 또 채집됨");
            GatherState.Restore(null);
            PlaytestKit.Check(GatherState.GatheredIds.Count == 0 && GatherState.TryGather("x"), "un.go.gather: Restore(null) 이 비우지 않음");
        }

        private static void CheckSaveRoundTrip()
        {
            GatherState.Restore(new[] { "spot_1", "spot_2", "spot_9" });
            string json = GoSave.ToJson();
            GatherState.Restore(null);
            PlaytestKit.Check(GoSave.ApplyJson(json), "un.go.gather: GO 세이브가 안 읽힘");
            var ids = new HashSet<string>(GatherState.GatheredIds);
            PlaytestKit.Check(ids.SetEquals(new[] { "spot_1", "spot_2", "spot_9" }), $"un.go.gather: 세이브 왕복 {string.Join(",", ids.OrderBy(s => s))}");
        }
    }
}
