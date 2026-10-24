using System;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0213 「오늘」 창 진단(고돗 G-0351 `probe_goals_panel.gd` 짝) — `-executeMethod Saga.EditorTools.PlaytestTodayPanel.Run`(-quit 없이).
    /// ① 갈림 셈(새벽 4시·월요일·4종횡 UTC 7일 창) ② 네 판 어댑터로 창을 지어 오늘 줄 ≥1·머리에 남은 시간 · HUD 단추 80×80(2나락·3마을·4종횡)
    /// ③ 1만리 받기: 의뢰 넷을 채워 덤 준비 → 창 받기 단추 → <see cref="Saga.Go.Data.DailyTaskState.BonusClaimed"/>·단추 "받음"(상태는 되돌린다)
    /// ④ Esc(<see cref="TodayPanel.CloseOpen"/>) 로 닫힘 ⑤ 5천하(U-0215 「이번 달」 — 게임 달 기준): 이번 달 ≥2줄·천하 ≥2줄·머리 "이번 달 · ○년 ○월"·갈림 글 없음·받기 단추 없음,
    /// 어댑터 다섯. 네 판 머리는 "오늘" 그대로. Play 없이 정적 값만 읽는다 — 세이브 안 씀, 씬 저장 안 함.
    /// </summary>
    public static class PlaytestTodayPanel
    {
        private const string Tag = "[PlaytestTodayPanel]";

        public static void Run()
        {
            PlaytestKit.Begin(Tag);
            string lang = SagaUi.Lang;
            SagaUi.Lang = "ko";
            using (PlaytestKit.ErrorCounter())
            {
                try
                {
                    CheckResets();
                    CheckGo();
                    CheckHud("2나락", Saga.Dungeon.UI.DungeonTodaySource.Install, Saga.Dungeon.UI.DungeonTodaySource.ButtonAt);
                    CheckDungeonRows(); // tasks U-0221 현상금 셋이 맨 위
                    CheckHud("3마을", Saga.Forest.UI.ForestTodaySource.Install, Saga.Forest.UI.ForestTodaySource.ButtonAt);
                    CheckHud("4종횡", Saga.Story.UI.StoryTodaySource.Install, Saga.Story.UI.StoryTodaySource.ButtonAt);
                    CheckRealm();
                }
                catch (Exception e) { PlaytestKit.Fail("예외 " + e); }
                finally { SagaUi.Lang = lang; }
            }
            PlaytestKit.Summary("PlaytestTodayPanel");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void CheckResets()
        {
            var sat = new DateTime(2026, 10, 24, 3, 0, 0); // 토요일 새벽 3시 — 새벽 4시 전은 전날
            PlaytestKit.Check(TodayPanel.NextDaily(sat, 4) == new DateTime(2026, 10, 24, 4, 0, 0), $"새벽 4시 갈림 {TodayPanel.NextDaily(sat, 4)}");
            PlaytestKit.Check(TodayPanel.NextDaily(sat, 0) == new DateTime(2026, 10, 25), $"자정 갈림 {TodayPanel.NextDaily(sat, 0)}");
            PlaytestKit.Check(TodayPanel.NextMonday(sat, 4) == new DateTime(2026, 10, 26, 4, 0, 0), $"월요일 4시 {TodayPanel.NextMonday(sat, 4)}");
            var mon = new DateTime(2026, 10, 26, 3, 0, 0); // 월요일 3시 = 아직 지난 주
            PlaytestKit.Check(TodayPanel.NextMonday(mon, 4) == new DateTime(2026, 10, 26, 4, 0, 0), $"월요일 3시 → 같은 날 4시 {TodayPanel.NextMonday(mon, 4)}");
            PlaytestKit.Check(TodayPanel.NextMonday(mon.AddHours(2), 4) == new DateTime(2026, 11, 2, 4, 0, 0), "월요일 5시 → 다음 주");
            PlaytestKit.Check(TodayPanel.NextMonday(mon, 0) == new DateTime(2026, 11, 2), "2나락 시즌 월요일 0시");
            // 1만리 주 번호와 같은 갈림인가
            var next = TodayPanel.NextMonday(sat, Saga.Go.Data.DailyTaskState.DayStartHour);
            PlaytestKit.Check(Saga.Go.Data.GoWeekly.WeekOf(next) == Saga.Go.Data.GoWeekly.WeekOf(next.AddSeconds(-1)) + 1, "1만리 주 갈림이 GoWeekly.WeekOf 와 다름");
            // 4종횡 관문 대장 — UTC 7일 창(목요일 0시 UTC)
            var st = new Saga.Story.UI.StoryTodaySource();
            var now = DateTime.Now;
            var champ = st.NextReset(true, now);
            long wk = 7L * 86400L;
            long a = new DateTimeOffset(champ).ToUnixTimeSeconds();
            PlaytestKit.Check(champ > now && champ - now <= TimeSpan.FromDays(7) && a % wk == 0 && new DateTimeOffset(champ).UtcDateTime.DayOfWeek == DayOfWeek.Thursday,
                $"4종횡 관문 대장 갈림 {champ}");
            PlaytestKit.Check(TodayPanel.LeftText(TimeSpan.FromMinutes(192)) == "3시간 12분" && TodayPanel.LeftText(TimeSpan.FromHours(53)) == "2일 5시간", "남은 시간 글");
            Debug.Log($"{Tag} resets OK - 새벽 4시·자정·월요일·UTC 목요일");
        }

        private static void CheckGo()
        {
            Saga.Go.Data.DailyTaskState.EnsureToday();
            string date = Saga.Go.Data.DailyTaskState.CurrentDate;
            var prog = Saga.Go.Data.DailyTaskState.SnapshotProgress();
            var done = Saga.Go.Data.DailyTaskState.SnapshotDone();
            bool stamp = Saga.Go.Data.DailyTaskState.SnapshotDayStampGranted();
            int stamps = Saga.Go.Data.DailyTaskState.Stamps;
            bool bonus = Saga.Go.Data.DailyTaskState.BonusClaimed;
            bool off = Saga.Go.Data.DailyTaskState.OffForTest;
            TodayPanel p = null;
            try
            {
                Saga.Go.Data.DailyTaskState.OffForTest = false;
                Saga.Go.Data.DailyTaskState.Restore(date, new int[prog.Length], new bool[done.Length], false, stamps, false); // 오늘 처음부터
                p = TodayPanel.Create(new Saga.Go.UI.GoTodaySource());
                p.Open();
                int n = Saga.Go.Data.DailyTaskState.TaskCount;
                PlaytestKit.Check(p.IsOpen, "1만리 창이 안 열림");
                PlaytestKit.Check(p.TodayCount == n + 2 && n >= 1, $"1만리 오늘 줄 {p.TodayCount} ≠ 의뢰 {n} + 덤 + 도장");
                PlaytestKit.Check(p.WeekCount == Saga.Go.Data.GoWeekly.PerWeek + 1, $"1만리 이번 주 줄 {p.WeekCount} ≠ 6");
                PlaytestKit.Check(p.TodayHeadText.Contains("새로까지") && p.WeekHeadText.Contains("새로까지"), $"1만리 머리에 남은 시간 없음 '{p.TodayHeadText}'");
                var claim = p.ClaimButton(n);
                PlaytestKit.Check(claim != null && !claim.interactable, "의뢰를 안 했는데 덤 받기가 켜짐");
                for (int i = 0; i < n; i++) Saga.Go.Data.DailyTaskState.ReportProgress(Saga.Go.Data.DailyTaskState.TaskKind(i), 100000);
                p.Refresh();
                claim = p.ClaimButton(n);
                PlaytestKit.Check(Saga.Go.Data.DailyTaskState.AllDoneToday && claim != null && claim.interactable, "의뢰 넷을 다 했는데 덤 받기가 꺼짐");
                if (claim != null) claim.onClick.Invoke();
                claim = p.ClaimButton(n);
                PlaytestKit.Check(Saga.Go.Data.DailyTaskState.BonusClaimed, "창 받기로 덤을 못 받음");
                PlaytestKit.Check(claim != null && !claim.interactable && SagaUi.Label(claim) == "받음", "받은 뒤 단추가 '받음'·꺼짐이 아님");
                if (claim != null) claim.onClick.Invoke();
                PlaytestKit.Check(Saga.Go.Data.DailyTaskState.BonusClaimed, "두 번 눌러 상태가 바뀜");

                PlaytestKit.Check(TodayPanel.CloseOpen() && !p.IsOpen, "Esc(CloseOpen) 로 안 닫힘");
                PlaytestKit.Check(!TodayPanel.CloseOpen(), "닫힌 뒤 CloseOpen 이 또 true(일시정지가 안 열림)");
                p.Toggle();
                PlaytestKit.Check(p.IsOpen, "Toggle 로 안 열림");
                p.CloseButton.onClick.Invoke();
                PlaytestKit.Check(!p.IsOpen, "닫기 단추로 안 닫힘");
                Debug.Log($"{Tag} go OK - 오늘 {p.TodayCount}·이번 주 {p.WeekCount}·덤 준비 → 받음·Esc 닫힘");
            }
            finally
            {
                Saga.Go.Data.DailyTaskState.Restore(date, prog, done, stamp, stamps, bonus);
                Saga.Go.Data.DailyTaskState.OffForTest = off;
                if (p != null) UnityEngine.Object.DestroyImmediate(p.gameObject);
            }
        }

        /// <summary>tasks U-0221 — 2나락 오늘 줄 = 현상금 셋 + 일과 + 도장(끄면 현상금 없음).</summary>
        private static void CheckDungeonRows()
        {
            var today = new System.Collections.Generic.List<TodayRow>(); var week = new System.Collections.Generic.List<TodayRow>();
            new Saga.Dungeon.UI.DungeonTodaySource().Rows(today, week);
            int bounty = Saga.Dungeon.Data.DungeonBounty.On ? Saga.Dungeon.Data.DungeonBounty.PickCount : 0;
            int want = Saga.Dungeon.Data.DungeonDailyTaskState.TaskCount + 1 + bounty;
            PlaytestKit.Check(today.Count == want, $"2나락 오늘 줄 {today.Count} ≠ 현상금 {bounty} + 일과 + 도장 {want}");
            PlaytestKit.Check(bounty == 0 || today[0].Text.Contains("📜"), "2나락 맨 위 줄이 현상금이 아님");
            Debug.Log($"{Tag} 2나락 rows OK - 오늘 {today.Count}(현상금 {bounty} 맨 위)");
        }

        private static void CheckHud(string game, Func<TodayPanel> install, Vector2 at)
        {
            TodayPanel p = null;
            try
            {
                p = install();
                var b = p.HudButton;
                var rt = b != null ? (RectTransform)b.transform : null;
                PlaytestKit.Check(rt != null && rt.sizeDelta == TodayPanel.HudButtonSize && rt.anchoredPosition == at && rt.anchorMin == Vector2.one, $"{game} 📅 단추 자리·크기");
                if (b != null) b.onClick.Invoke();
                PlaytestKit.Check(p.IsOpen, $"{game} 단추로 안 열림");
                PlaytestKit.Check(p.TodayCount >= 1, $"{game} 오늘 줄 {p.TodayCount}");
                PlaytestKit.Check(p.TodayHeadText.Contains("새로까지"), $"{game} 오늘 머리에 남은 시간 없음 '{p.TodayHeadText}'");
                PlaytestKit.Check(p.TodayHeadText.StartsWith("오늘", StringComparison.Ordinal), $"{game} 머리가 '오늘' 이 아님 '{p.TodayHeadText}'"); // U-0215 — 네 판 그대로
                for (int i = 0; i < p.TodayCount + p.WeekCount; i++)
                    PlaytestKit.Check(!string.IsNullOrEmpty(p.RowText(i)), $"{game} 줄 {i} 빈 글");
                PlaytestKit.Check(TodayPanel.CloseOpen() && !p.IsOpen, $"{game} Esc 로 안 닫힘");
                Debug.Log($"{Tag} {game} OK - 오늘 {p.TodayCount}·둘째 {p.WeekCount}·'{p.RowText(0)}'");
            }
            finally
            {
                if (p != null) UnityEngine.Object.DestroyImmediate(p.gameObject);
            }
        }

        /// <summary>tasks U-0215 — 5천하 「이번 달」(게임 달 기준, 고돗 G-0364 짝). 정적 값만 읽는다(방침·승리 상태 안 바꿈).</summary>
        private static void CheckRealm()
        {
            TodayPanel p = null;
            try
            {
                string focusBefore = Saga.Realm.Data.RealmFocus.Current;
                int leftBefore = Saga.Realm.Data.RealmFocus.Left, doneBefore = Saga.Realm.Data.RealmFocus.Done.Count;
                p = Saga.Realm.UI.RealmTodaySource.Install();
                var b = p.HudButton;
                PlaytestKit.Check(b != null, "5천하 📅 단추 없음");
                if (b != null) b.onClick.Invoke();
                PlaytestKit.Check(p.IsOpen, "5천하 단추로 안 열림");
                PlaytestKit.Check(p.TodayCount >= 2, $"5천하 이번 달 줄 {p.TodayCount} < 2");
                PlaytestKit.Check(p.WeekCount >= 2, $"5천하 천하 줄 {p.WeekCount} < 2");
                bool ko = Saga.Realm.Data.RealmLocalization.CurrentLanguage == "ko";
                string month = string.Format(Saga.Realm.Data.RealmLocalization.T("today.title", "이번 달 · {0}년 {1}월"), Saga.Realm.Data.RealmCityState.Year, Saga.Realm.Data.RealmCityState.Month);
                PlaytestKit.Check(p.TodayHeadText == month && (!ko || month.StartsWith("이번 달", StringComparison.Ordinal)), $"5천하 머리 '{p.TodayHeadText}' ≠ '{month}'");
                PlaytestKit.Check(!p.TodayHeadText.Contains("<size") && !p.WeekHeadText.Contains("<size"), $"5천하 머리에 갈림 글 '{p.TodayHeadText}' / '{p.WeekHeadText}'");
                PlaytestKit.Check(p.WeekHeadText == Saga.Realm.Data.RealmLocalization.T("today.world", "천하"), $"5천하 둘째 머리 '{p.WeekHeadText}'");
                for (int i = 0; i < p.TodayCount + p.WeekCount; i++)
                {
                    PlaytestKit.Check(!string.IsNullOrEmpty(p.RowText(i)) && !p.RowText(i).StartsWith("today.", StringComparison.Ordinal), $"5천하 줄 {i} '{p.RowText(i)}'");
                    PlaytestKit.Check(p.ClaimButton(i) == null, $"5천하 줄 {i} 에 받기 단추");
                }
                string total = "/" + Saga.Realm.Data.RealmEnemyCity.AllIds.Length;
                PlaytestKit.Check(p.RowText(p.TodayCount).Contains(Saga.Realm.Data.RealmVictoryState.CapturedCount() + total), $"5천하 천하통일 줄 '{p.RowText(p.TodayCount)}'");
                PlaytestKit.Check(p.RowText(p.TodayCount + 1).Contains("/" + Saga.Realm.Data.RealmVictoryState.CultureCorrectTarget), $"5천하 문화 줄 '{p.RowText(p.TodayCount + 1)}'");
                PlaytestKit.Check(Saga.Realm.Data.RealmFocus.Current == focusBefore && Saga.Realm.Data.RealmFocus.Left == leftBefore && Saga.Realm.Data.RealmFocus.Done.Count == doneBefore, "5천하 창이 방침 상태를 바꿈");
                PlaytestKit.Check(TodayPanel.CloseOpen() && !p.IsOpen, "5천하 Esc 로 안 닫힘");
                var impls = AppDomain.CurrentDomain.GetAssemblies()
                    .SelectMany(a => { try { return a.GetTypes(); } catch { return Type.EmptyTypes; } })
                    .Where(t => typeof(ITodaySource).IsAssignableFrom(t) && !t.IsInterface && !t.IsAbstract)
                    .Select(t => t.FullName).OrderBy(s => s).ToList();
                PlaytestKit.Check(impls.Count == 5 && impls.Contains(typeof(Saga.Realm.UI.RealmTodaySource).FullName), "어댑터 " + string.Join(",", impls));
                Debug.Log($"{Tag} realm OK - 이번 달 {p.TodayCount}·천하 {p.WeekCount}·머리 '{p.TodayHeadText}'·'{p.RowText(0)}'·어댑터 {impls.Count}");
            }
            finally
            {
                if (p != null) UnityEngine.Object.DestroyImmediate(p.gameObject);
            }
        }
    }
}
