using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Core;
using Saga.Forest.Data;

namespace Saga.Forest.UI
{
    /// <summary>
    /// tasks U-0213 「오늘」 창 3마을 어댑터(고돗 G-0351 짝) — 기존 값만 읽는다. 받기 없음(선물·하트는 다가설 때).
    /// 오늘(지역 자정, <see cref="ForestVisitors.Today"/>) = 이야기(촌장 + 눌러앉은 이웃, 오늘 하트 오른 수 <see cref="ForestHearts.GainedToday"/> &gt; 0 —
    /// "오늘 이야기함" 공개 읽기가 없어 새 상태 대신 이 셈) · 이웃 선물(<see cref="ForestVisitors.GiftTakenToday"/>) · 오늘 손님 부탁(<see cref="ForestVisitors.Rec"/>.Done) ·
    /// 축제 = <see cref="ForestFestivalState.GoalLineText"/>. `ForestBootstrap.Start` 가 <see cref="Install"/> — 일시정지와 저장 사이 빈칸에 📅 80×80.
    /// </summary>
    public class ForestTodaySource : ITodaySource
    {
        /// <summary>오른쪽 위 첫 줄 — 일시정지(오른쪽에서 386~466)와 저장(30~190) 사이(오른쪽에서 218~298). 1만리 ☰ 단추 자리와 같은 틈, 같은 높이.</summary>
        public static readonly Vector2 ButtonAt = new Vector2(-218f, -30f);

        public static TodayPanel Install()
        {
            var p = TodayPanel.Create(new ForestTodaySource());
            p.AddHudButton(ButtonAt);
            return p;
        }

        public string TodayTitle => SagaUi.L("오늘", "Today"); // tasks U-0215 — 창 제목·첫 묶음 머리(옛 글 그대로)

        public string WeekTitle => ForestLocalization.T("today.festival", "🎉 축제");

        public void Rows(List<TodayRow> today, List<TodayRow> week)
        {
            var settled = ForestVisitors.SettledList;
            int people = settled.Count + 1, talked = ForestHearts.GainedToday(ForestHearts.KeeperId) > 0 ? 1 : 0, gifts = 0;
            foreach (var key in settled)
            {
                if (ForestHearts.GainedToday(key) > 0) talked++;
                if (ForestVisitors.GiftTakenToday(key)) gifts++;
            }
            today.Add(TodayRow.Line(string.Format(ForestLocalization.T("today.talk", "💬 주민과 이야기 {0}/{1}"), talked, people), talked >= people));
            if (settled.Count > 0)
                today.Add(TodayRow.Line(string.Format(ForestLocalization.T("today.gift", "🎁 이웃 선물 {0}/{1}"), gifts, settled.Count), gifts >= settled.Count));
            else
                today.Add(TodayRow.Line(ForestLocalization.T("today.gift_none", "🎁 눌러앉은 이웃이 생기면 날마다 작은 선물")));

            var v = ForestVisitors.TodayVisitor;
            bool done = ForestVisitors.Rec.Done;
            today.Add(TodayRow.Line(string.Format(done
                ? ForestLocalization.T("today.visitor_done", "✓ {0} 오늘 손님 {1} — 부탁 마침")
                : ForestLocalization.T("today.visitor", "{0} 오늘 손님 {1} — 부탁 들어주기"), v.Emoji, ForestVisitors.Name(v)), done));

            // tasks U-0223 밭 — 지었을 때만: 다 자란 칸이 있으면 거두기, 아니면 물 주기 n/m(자라는 칸이 없으면 씨 뿌리기 권함)
            if (ForestCrops.HasField)
            {
                int ripe = ForestCrops.RipeCount, grow = ForestCrops.GrowingCount, wet = ForestCrops.WateredCount;
                if (ripe > 0) today.Add(TodayRow.Line(string.Format(ForestLocalization.T("today.crop_ripe", "🌾 밭 거둘 칸 {0}"), ripe)));
                else if (grow > 0) today.Add(TodayRow.Line(string.Format(ForestLocalization.T("today.crop_water", "💧 밭 물 주기 {0}/{1}"), wet, grow), wet >= grow));
                else today.Add(TodayRow.Line(ForestLocalization.T("today.crop_sow", "🌱 밭에 씨를 뿌리자")));
            }

            week.Add(TodayRow.Line(ForestFestivalState.GoalLineText(), ForestFestivalState.IsDoneToday()));
        }

        public void Claim(int claimId) { }

        /// <summary>오늘 = 지역 자정 · 축제 줄은 날짜(갈림 없음, D-day 가 줄에 있다).</summary>
        public DateTime NextReset(bool week, DateTime now) => week ? DateTime.MinValue : TodayPanel.NextDaily(now, 0);
    }
}
