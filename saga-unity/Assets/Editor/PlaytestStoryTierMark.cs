using UnityEngine;
using Saga.Story.Data;
using Saga.Story.Player;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0160 웹 대조 S 묶음 ② — `PlaytestStorySlice` 가 흔들림 뒤에 부른다.
    /// 발밑 전직 표식(무명 0 · 1차 고리 하나 · 2차 굵게 · 3차 안쪽 · 4차 바깥 · 5차 별 여섯 = 선 0/1/1/2/3/9 · 2차가 1차보다 굵음 · 무기·옷 빛깔 그대로) ·
    /// 쓰러짐 카드(판 없음 = "없음" · 판 있음 = 판 등급 줄 + "이번 판 등급 덤" · 남은 것 줄 늘). 끝나면 레벨·경험·직업을 시작 때로.
    /// </summary>
    public static class PlaytestStoryTierMark
    {
        private const string T = "[PlaytestStorySlice] tiermark";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var tint = Object.FindFirstObjectByType<StoryOutfitTint>();
            if (tint == null) { Fail("StoryOutfitTint 없음"); return false; }
            int lv = StoryJobState.Level; float exp = StoryJobState.Exp; string job = StoryJobState.Job;
            string m = "";
            try
            {
                string[] jobs = { StoryJobState.NoJob, "warrior", "general", "marshal", "warlord", "godwar" };
                int[] want = { 0, 1, 1, 2, 3, 9 };
                float w1 = 0f, w2 = 0f;
                for (int i = 0; i < jobs.Length; i++)
                {
                    StoryJobState.Restore(60, 0f, jobs[i]);
                    tint.Refresh();
                    int got = Saga.Core.RankRing.Count(tint.transform);
                    if (got != want[i] || tint.RingPieces != want[i]) Fail($"{jobs[i]}(단 {StoryJobState.Tier}) 선 {got}/{tint.RingPieces} ≠ {want[i]}");
                    var ring = tint.transform.Find(Saga.Core.RankRing.Name);
                    if (want[i] > 0)
                    {
                        var lr = ring.GetComponentInChildren<LineRenderer>();
                        if (i == 1) w1 = lr.widthMultiplier;
                        if (i == 2) w2 = lr.widthMultiplier;
                        if (Mathf.Abs(ring.localPosition.y) > 0.1f) Fail($"표식이 발밑이 아님 y={ring.localPosition.y}");
                    }
                    m += $" {StoryJobState.Tier}:{got}";
                }
                if (w2 <= w1) Fail($"2차 고리가 굵지 않음 {w1}→{w2}");
                // 쓰러짐 카드
                string none = StoryPlayerVitals.FallCard(null);
                string keep = StoryLocalization.T("hp.fell_keep", "");
                if (!none.Contains(StoryLocalization.T("hp.fell_lost_none", "없음")) || keep.Length == 0 || !none.Contains(keep)) Fail($"판 없는 카드 {none}");
                var run = new StoryRunRank.Result("B", 300, 2, 9, 95, dead: true);
                string card = StoryPlayerVitals.FallCard(run);
                if (!card.Contains(StoryRunRank.Line(run)) || !card.Contains(StoryLocalization.T("hp.fell_lost_run", "이번 판 등급 덤")) || !card.Contains(keep)) Fail($"판 있는 카드 {card}");
                if (card.Split('\n').Length != 4) Fail($"카드 줄 수 {card.Split('\n').Length} ≠ 4");
            }
            finally
            {
                StoryJobState.Restore(lv, exp, job);
                tint.Refresh();
            }
            if (_ok) Debug.Log($"{T} OK - 발밑 전직 표식(단:선{m} · 2차 굵게 · 발밑) · 쓰러짐 카드(잃은 것·남은 것 · 판 등급 줄을 한 장에)");
            return _ok;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
