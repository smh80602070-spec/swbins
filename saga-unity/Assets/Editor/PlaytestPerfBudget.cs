using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0234 판별 폰 예산 — 판 헤드리스가 장면을 다 세운 뒤 부른다(`perf-budget` 줄).
    /// 자리 둘: `front` = 게임 카메라 그대로(시작 자리 — 1만리·3마을 마을 한복판·2나락 마을·4종횡 첫 무대·5천하 디오라마) ·
    /// `back` = 같은 자리에서 뒤로 돌아본 임시 카메라(시작 자리 반대쪽 — 들판·숲 쪽). 렌더러 수·삼각형(LOD 고른 단계만)을 재 표 상한과 견준다.
    /// SetPass 는 GUI 렌더가 돌 때만 값이 있어 배치 진단에선 안 잼(촬영 칸 `perf` 몫).
    /// </summary>
    public static class PlaytestPerfBudget
    {
        public static bool Check(string tag, string game)
        {
            var cam = Camera.main;
            if (cam == null) { Debug.Log($"[{tag}] perf-budget OK - SKIP(카메라 없음)"); return true; }
            bool ok = true;
            var lines = new System.Collections.Generic.List<string>();
            var (r1, t1) = PerfBudget.Measure(cam);
            ok &= Report(tag, game + ".front", r1, t1, lines);
            var go = new GameObject("PerfBudgetBack");
            try
            {
                var back = go.AddComponent<Camera>();
                back.CopyFrom(cam);
                back.enabled = false;
                var e = cam.transform.eulerAngles;
                back.transform.SetPositionAndRotation(cam.transform.position, Quaternion.Euler(e.x, e.y + 180f, 0f));
                var (r2, t2) = PerfBudget.Measure(back);
                ok &= Report(tag, game + ".back", r2, t2, lines);
            }
            finally { Object.DestroyImmediate(go); }
            if (ok) Debug.Log($"[{tag}] perf-budget OK - {string.Join(" · ", lines)}");
            return ok;
        }

        private static bool Report(string tag, string key, int r, long t, System.Collections.Generic.List<string> lines)
        {
            bool ok = PerfBudget.Judge(key, r, t, out var line);
            lines.Add(line);
            if (!ok) Debug.LogError($"[{tag}] perf-budget FAIL - {line}(×{PerfBudget.Scale:0.##})");
            return ok;
        }
    }
}
