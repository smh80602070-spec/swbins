using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Core;
using Saga.Go.Data;

namespace Saga.Go.UI
{
    /// <summary>
    /// tasks U-0213 「오늘」 창 1만리 어댑터(고돗 G-0351 `goals_adapter.gd` 짝) — 기존 값만 읽는다.
    /// 오늘 = 일일 의뢰 넷(<see cref="DailyTaskState"/>, 새벽 4시) + 마무리 보상(같은 <see cref="DailyTaskState.TryClaimBonus"/>) ·
    /// 도장 줄 · 이번 주 = 주간 도전 다섯(<see cref="WeeklyState"/>, 월요일 새벽 4시) + 완주 보상(<see cref="WeeklyUi.Claim"/>·<see cref="WeeklyUi.ClaimBonus"/>).
    /// </summary>
    public class GoTodaySource : ITodaySource
    {
        public const int ClaimDaily = 0, ClaimWeekBase = 10, ClaimWeekBonus = 20;

        public string TodayTitle => SagaUi.L("오늘", "Today"); // tasks U-0215 — 창 제목·첫 묶음 머리(옛 글 그대로)

        public string WeekTitle => GoLocalization.T("today.week", "이번 주");

        public void Rows(List<TodayRow> today, List<TodayRow> week)
        {
            DailyTaskState.EnsureToday();
            int n = DailyTaskState.TaskCount;
            for (int i = 0; i < n; i++) today.Add(TodayRow.Line(DailyTaskState.TaskLine(i), DailyTaskState.TaskDone(i)));
            if (n > 0)
                today.Add(TodayRow.Reward(string.Format(GoLocalization.T("today.daily_bonus", "넷 다 하면 마무리 — 금 {0} · 강화석 {1} · 인연 매듭 {2}"),
                    DailyTaskState.BonusGold, DailyTaskState.BonusOre, DailyTaskState.BonusKnot),
                    ClaimDaily, DailyTaskState.AllDoneToday, DailyTaskState.BonusClaimed));
            today.Add(TodayRow.Line(DailyTaskState.WeekLineText())); // 일과 도장(넷 다 한 날 하나, 7 = 주간 보상)

            var picks = WeeklyState.Picks();
            for (int i = 0; i < picks.Length; i++)
            {
                var g = GoWeekly.Get(picks[i]);
                bool claimed = WeeklyState.Claimed(g.Id);
                int p = Mathf.Min(WeeklyState.Progress(g.Id), g.Target);
                week.Add(TodayRow.Reward($"{g.Name}  <size=80%><color=#b9c2cc>{g.Desc}</color></size>  {p}/{g.Target}", ClaimWeekBase + i, WeeklyState.Done(g.Id), claimed));
            }
            week.Add(TodayRow.Reward(string.Format(GoLocalization.T("today.week_bonus", "다섯 다 받으면 완주 — {0}"), GoWeekly.BonusRewardText()),
                ClaimWeekBonus, WeeklyState.BonusReady, WeeklyState.BonusClaimed));
        }

        public void Claim(int claimId)
        {
            if (claimId == ClaimDaily)
            {
                string got = DailyTaskState.TryClaimBonus(); // 길표석과 같은 함수(하루 한 번)
                if (got != null && DialogueLabel.Instance != null) DialogueLabel.Instance.Show(got, 4f);
                if (got != null) Saga.Go.Audio.GoSfx.Play("quest_done");
                return;
            }
            if (claimId == ClaimWeekBonus)
            {
                if (WeeklyUi.Instance != null) WeeklyUi.Instance.ClaimBonus(); else WeeklyState.ClaimBonus();
                return;
            }
            int row = claimId - ClaimWeekBase;
            if (row < 0 || row >= GoWeekly.PerWeek) return;
            if (WeeklyUi.Instance != null) WeeklyUi.Instance.Claim(row);
            else { var picks = WeeklyState.Picks(); if (row < picks.Length) WeeklyState.Claim(picks[row]); }
        }

        public DateTime NextReset(bool week, DateTime now) => week
            ? TodayPanel.NextMonday(now, DailyTaskState.DayStartHour)
            : TodayPanel.NextDaily(now, DailyTaskState.DayStartHour);
    }
}
