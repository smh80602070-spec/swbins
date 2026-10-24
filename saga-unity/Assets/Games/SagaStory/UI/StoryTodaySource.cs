using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Core;
using Saga.Story.Data;

namespace Saga.Story.UI
{
    /// <summary>
    /// tasks U-0213 「오늘」 창 4종횡 어댑터(고돗 G-0351 짝) — 기존 값만 읽는다. 받기 없음(관문 대장은 처치 때 자동).
    /// 이 트랙엔 일일 토벌·채집이 없어(고돗과 다름) 오늘 = 문파 오늘의 의뢰 사냥터(<see cref="StoryGuild.HuntToday"/>, 지역 자정) ·
    /// 이번 주 = 관문 대장(<see cref="StorySaveState.ChampionAvailable"/>, UTC 7일 창 = 목요일 0시 UTC) · 이번 달 = 달 사명(<see cref="StoryMonthly.Line"/>).
    /// `GameBootstrap.Start` 가 <see cref="Install"/> — 문파 🏯 단추 밑에 📅 80×80.
    /// </summary>
    public class StoryTodaySource : ITodaySource
    {
        /// <summary>오른쪽 위 둘째 줄 — 문파 단추(−486) 바로 밑. 기술 칸(위에서 197 아래)과 안 닿게 위 112.</summary>
        public static readonly Vector2 ButtonAt = new Vector2(-486f, -112f);

        public static TodayPanel Install()
        {
            var p = TodayPanel.Create(new StoryTodaySource());
            p.AddHudButton(ButtonAt);
            return p;
        }

        public string TodayTitle => SagaUi.L("오늘", "Today"); // tasks U-0215 — 창 제목·첫 묶음 머리(옛 글 그대로)

        public string WeekTitle => StoryLocalization.T("today.week_month", "이번 주 · 이번 달");

        public void Rows(List<TodayRow> today, List<TodayRow> week)
        {
            string id = StoryGuild.Joined;
            if (id.Length == 0)
                today.Add(TodayRow.Line(StoryLocalization.T("today.guild_none", "🏯 문파에 들면 날마다 의뢰 사냥터가 열린다(처치 공 ×2)")));
            else
                today.Add(TodayRow.Line(string.Format(StoryLocalization.T("today.guild_hunt", "🏯 오늘의 의뢰 사냥터 — {0} (처치 공 ×2)"),
                    StoryGuild.HuntName(StoryGuild.HuntToday(id, StoryGuild.Today)))));

            bool champ = StorySaveState.ChampionAvailable();
            week.Add(TodayRow.Line(champ
                ? StoryLocalization.T("today.champion", "👑 관문 대장 — 이번 주 아직(두목이 대장으로 나온다)")
                : StoryLocalization.T("today.champion_done", "✓ 👑 관문 대장 — 이번 주 이김"), !champ));
            week.Add(TodayRow.Line(StoryMonthly.Line(), StoryMonthly.Done));
            if (StoryMonsterBook.On) week.Add(TodayRow.Line(StoryMonsterBook.Line(), StoryMonsterBook.CompleteCount() >= StoryMonsterBook.Species.Length)); // tasks U-0222 카드 도감
        }

        public void Claim(int claimId) { }

        /// <summary>오늘 = 지역 자정 · 주 = 관문 대장 UTC 7일 창(1970-01-01 목요일 0시 UTC 부터 7일씩).</summary>
        public DateTime NextReset(bool week, DateTime now)
        {
            if (!week) return TodayPanel.NextDaily(now, 0);
            long weekSec = 7L * 86400L;
            long unix = new DateTimeOffset(now).ToUnixTimeSeconds();
            return DateTimeOffset.FromUnixTimeSeconds((unix / weekSec + 1) * weekSec).LocalDateTime;
        }
    }
}
