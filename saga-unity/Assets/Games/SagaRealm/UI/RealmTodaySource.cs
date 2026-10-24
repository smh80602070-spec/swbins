using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Core;
using Saga.Realm.Data;

namespace Saga.Realm.UI
{
    /// <summary>
    /// tasks U-0215 「이번 달」 창 5천하 어댑터(고돗 G-0364 짝) — 실제 시계 일일이 없어 U-0213 「오늘」 창 틀을 **게임 달 기준**으로 쓴다.
    /// 첫 묶음 = 이번 달(머리 "이번 달 · ○년 ○월") — 명령 낸 장수 n/우리 장수(<see cref="RealmCityState.IsOfficerDone"/>·<see cref="RealmCityState.RosterIds"/>)
    /// · 국가 방침(<see cref="RealmFocus.Current"/>·<see cref="RealmFocus.Left"/>·끝낸 n/<see cref="RealmFocus.MaxDone"/>).
    /// 둘째 묶음 = 천하(승리 조건 진행) — 천하통일 성 n/전체(<see cref="RealmVictoryState.CapturedCount"/>) · 문화 문답 정답 n/30.
    /// 외교 화친 승리는 이 트랙에 없어(세력 하나) 줄 없음. **읽기만** — 받기 없음·갈림 없음(<see cref="DateTime.MinValue"/>, 달은 「다음 달」이 넘긴다).
    /// `GameBootstrap.Start` 가 <see cref="Install"/>, ☰ 메뉴(<see cref="RealmMenuHub"/>)가 📅 단추를 숨기고 칸으로 연다.
    /// </summary>
    public class RealmTodaySource : ITodaySource
    {
        /// <summary>오른쪽 위 기둥 왼쪽 옆 — ☰ 메뉴가 곧 숨긴다(칸이 대신 연다).</summary>
        public static readonly Vector2 ButtonAt = new Vector2(-210f, -20f);

        public static TodayPanel Install(Transform parent = null)
        {
            var p = TodayPanel.Create(new RealmTodaySource(), parent);
            var b = p.AddHudButton(ButtonAt);
            var t = b.GetComponentInChildren<TMPro.TextMeshProUGUI>(true);
            if (t != null) { t.text = RealmLocalization.T("today.button", "📅 이번 달"); t.enableAutoSizing = true; t.fontSizeMin = 14f; t.fontSizeMax = 40f; }
            return p;
        }

        public string TodayTitle => string.Format(RealmLocalization.T("today.title", "이번 달 · {0}년 {1}월"), RealmCityState.Year, RealmCityState.Month);

        public string WeekTitle => RealmLocalization.T("today.world", "천하");

        public void Rows(List<TodayRow> today, List<TodayRow> week)
        {
            int ours = 0, ordered = 0;
            foreach (var id in RealmCityState.RosterIds)
            {
                ours++;
                if (RealmCityState.IsOfficerDone(id)) ordered++;
            }
            today.Add(TodayRow.Line(string.Format(RealmLocalization.T("today.orders", "⚔️ 이번 달 명령 — 장수 {0}/{1}"), ordered, ours), ours > 0 && ordered >= ours));

            int done = RealmFocus.Done.Count;
            var cur = RealmFocus.Get(RealmFocus.Current);
            today.Add(TodayRow.Line(cur != null
                ? string.Format(RealmLocalization.T("today.focus", "🎯 방침 — {0} · {1}달 남음 · 끝낸 방침 {2}/{3}"), cur.Name, RealmFocus.Left, done, RealmFocus.MaxDone)
                : string.Format(RealmLocalization.T("today.focus_none", "🎯 방침 — 고르지 않음 · 끝낸 방침 {0}/{1}"), done, RealmFocus.MaxDone),
                done >= RealmFocus.MaxDone));

            int captured = RealmVictoryState.CapturedCount(), total = RealmEnemyCity.AllIds.Length;
            week.Add(TodayRow.Line(string.Format(RealmLocalization.T("today.conquest", "🏯 천하통일 — 성 {0}/{1}"), captured, total), total > 0 && captured >= total));
            int correct = RealmQuizState.GetProgress().Correct, target = RealmVictoryState.CultureCorrectTarget;
            week.Add(TodayRow.Line(string.Format(RealmLocalization.T("today.culture", "📜 문화 — 문답 정답 {0}/{1}"), Mathf.Min(correct, target), target), correct >= target));
            if (RealmVictoryState.IsOver)
                week.Add(TodayRow.Line(string.Format(RealmLocalization.T("today.over", "🏆 천하가 정해졌다 — {0}"),
                    RealmVictoryState.Result == RealmVictoryState.Kind.Culture ? RealmLocalization.T("victory.culture", "문화") : RealmLocalization.T("victory.conquest", "정복")), true));
        }

        public void Claim(int claimId) { }

        /// <summary>갈림 없음 — 달은 실제 시계가 아니라 「다음 달」 명령이 넘긴다.</summary>
        public DateTime NextReset(bool week, DateTime now) => DateTime.MinValue;
    }
}
