using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Story.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0162 달 사명(웹 W-0242 · 고돗 G-0296) — `PlaytestStorySlice` 가 줌 뒤에 부른다.
    /// 이달의 사냥터(같은 달 늘 같음 · 열두 달에 셋 이상 고루) · 셈(이달 사냥터 2 · 나머지 1) · 300 에 문장 한 번 · 더 잡아도 또 안 줌 ·
    /// 새 달은 셈만 0(문장 그대로) · 옛 세이브(null) 빈 칸 · 세이브 JSON 왕복(StorySaveState) · 카드 줄. 끝나면 달 사명 상태·날짜를 시작 때로.
    /// </summary>
    public static class PlaytestStoryMonthly
    {
        private const string T = "[PlaytestStorySlice] monthly";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            string snap = StoryMonthly.Snapshot();
            string m = "";
            try
            {
                var grounds = new HashSet<int>();
                for (int mo = 1; mo <= 12; mo++)
                {
                    string k = StoryMonthly.KeyOf(new DateTime(2026, mo, 3));
                    int g = StoryMonthly.FeaturedOf(k);
                    if (g < 0 || g >= StoryMonthly.GroundCount || g != StoryMonthly.FeaturedOf(k)) Fail($"{k} 사냥터 {g}");
                    grounds.Add(g);
                }
                if (grounds.Count < 3) Fail($"열두 달 사냥터 {grounds.Count} 가지");

                StoryMonthly.NowForTest = new DateTime(2026, 10, 15);
                StoryMonthly.Restore(null);
                if (StoryMonthly.Kills != 0 || StoryMonthly.Badges.Count != 0 || StoryMonthly.Done) Fail("옛 세이브가 빈 칸이 아님");
                int feat = StoryMonthly.FeaturedOf("2026-10"), other = (feat + 1) % StoryMonthly.GroundCount;
                StoryMonthly.OnKill(feat);
                StoryMonthly.OnKill(other);
                if (StoryMonthly.Kills != 3) Fail($"셈 {StoryMonthly.Kills} ≠ 3(이달 2 + 1)");
                int earned = 0;
                for (int i = 0; i < 400; i++) if (StoryMonthly.OnKill(other)) earned++;
                if (earned != 1 || !StoryMonthly.Done || StoryMonthly.Badges.Count != 1 || StoryMonthly.Badges[0] != "2026-10") Fail($"문장 {earned}·{StoryMonthly.Badges.Count}");
                if (!StoryMonthly.Line().Contains("✓")) Fail($"채운 줄 {StoryMonthly.Line()}");

                StoryMonthly.NowForTest = new DateTime(2026, 11, 1);
                if (StoryMonthly.Kills != 0 || StoryMonthly.Done || StoryMonthly.Badges.Count != 1) Fail($"새 달 셈 {StoryMonthly.Kills}·문장 {StoryMonthly.Badges.Count}");
                string line = StoryMonthly.Line();
                if (!line.Contains("2026-11") || !line.Contains("/" + StoryMonthly.Goal) || !line.Contains(StoryMonthly.GroundName(StoryMonthly.FeaturedOf("2026-11")))) Fail($"카드 줄 {line}");
                StoryMonthly.OnKill(0);

                // 세이브 왕복 — StorySaveState 가 monthJson 을 싣고 되읽는다
                string json = StorySaveState.ToJson();
                int k0 = StoryMonthly.Kills;
                StoryMonthly.Restore(null);
                if (!StorySaveState.ApplyJson(json)) Fail("ApplyJson 실패");
                if (StoryMonthly.Kills != k0 || StoryMonthly.Badges.Count != 1) Fail($"세이브 왕복 셈 {StoryMonthly.Kills}≠{k0}·문장 {StoryMonthly.Badges.Count}");
                m = $" 사냥터 {grounds.Count}가지 · 10월 이달 {StoryMonthly.GroundName(feat)} · 11월 {StoryMonthly.GroundName(StoryMonthly.FeaturedOf("2026-11"))}";
            }
            finally
            {
                StoryMonthly.NowForTest = null;
                StoryMonthly.Restore(snap);
            }
            if (_ok) Debug.Log($"{T} OK - 이달의 사냥터(고정·고루)·셈 2/1·300 에 문장 한 번·새 달 셈만 0·옛 세이브 빈 칸·세이브 왕복·카드 줄 |{m}");
            return _ok;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
