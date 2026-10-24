using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Core;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// tasks U-0213 「오늘」 창 2나락 어댑터(고돗 G-0351 짝) — 기존 값만 읽는다. 받기 없음(일과는 자동 지급).
    /// 오늘 = 일과 셋(<see cref="DungeonDailyTaskState"/>, 지역 자정) + 일과 도장 줄 · 시즌 = 사다리 단계·점수·다음 단계까지(<see cref="DungeonSeason"/>, 월요일 지역 자정).
    /// `GameBootstrap.Start` 가 <see cref="Install"/> — 시즌 🏆 단추 줄 밑, 탈것 단추 오른쪽 빈칸에 📅 80×80.
    /// </summary>
    public class DungeonTodaySource : ITodaySource
    {
        /// <summary>오른쪽 위 둘째 줄 — 저장 단추(오른쪽에서 30~190) 밑 · 탈것 단추(오른쪽에서 100~230) 오른쪽. 첫 줄은 목표판 글(영어)·시즌·일시정지로 꽉 찼다.</summary>
        public static readonly Vector2 ButtonAt = new Vector2(-16f, -114f);

        public static TodayPanel Install()
        {
            var p = TodayPanel.Create(new DungeonTodaySource());
            p.AddHudButton(ButtonAt);
            return p;
        }

        public string TodayTitle => SagaUi.L("오늘", "Today"); // tasks U-0215 — 창 제목·첫 묶음 머리(옛 글 그대로)

        public string WeekTitle => DungeonLocalization.T("today.season", "🏆 시즌");

        public void Rows(List<TodayRow> today, List<TodayRow> week)
        {
            foreach (var (text, done) in DungeonBounty.Rows(DungeonFloorRunner.Instance != null ? DungeonFloorRunner.Instance.CurrentFloor : 1))
                today.Add(TodayRow.Line(text, done)); // tasks U-0221 현상금 셋 — 맨 위
            int n = DungeonDailyTaskState.TaskCount;
            for (int i = 0; i < n; i++) today.Add(TodayRow.Line(DungeonDailyTaskState.TaskLine(i), DungeonDailyTaskState.TaskDone(i)));
            today.Add(TodayRow.Line(DungeonDailyTaskState.WeekLineText()));

            if (!DungeonSeason.On) return;
            int score = DungeonSeason.Score, t = DungeonSeason.TierIdx(score);
            week.Add(TodayRow.Line(string.Format(DungeonLocalization.T("season.now", "이번 시즌 {0}점 · {1}"), score, DungeonSeason.TierName(t))));
            if (t < DungeonSeason.Need.Length - 1)
                week.Add(TodayRow.Line(string.Format(DungeonLocalization.T("today.season_next", "다음 단계 {0}까지 {1}점"), DungeonSeason.TierName(t + 1), DungeonSeason.Need[t + 1] - score)));
            else
                week.Add(TodayRow.Line(DungeonLocalization.T("today.season_top", "맨 위 단계 — 시즌 끝까지 지키기"), true));
        }

        public void Claim(int claimId) { }

        public DateTime NextReset(bool week, DateTime now) => week ? TodayPanel.NextMonday(now, 0) : TodayPanel.NextDaily(now, 0);
    }
}
