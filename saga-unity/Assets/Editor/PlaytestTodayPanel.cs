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
    /// ④ Esc(<see cref="TodayPanel.CloseOpen"/>) 로 닫힘 ⑤ 5천하 어댑터 없음(구현 넷뿐). Play 없이 정적 값만 읽는다 — 세이브 안 씀, 씬 저장 안 함.
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
                    CheckHud("3마을", Saga.Forest.UI.ForestTodaySource.Install, Saga.Forest.UI.ForestTodaySource.ButtonAt);
                    CheckHud("4종횡", Saga.Story.UI.StoryTodaySource.Install, Saga.Story.UI.StoryTodaySource.ButtonAt);
                    CheckNoRealm();
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

        private static void CheckNoRealm()
        {
            var impls = AppDomain.CurrentDomain.GetAssemblies()
                .SelectMany(a => { try { return a.GetTypes(); } catch { return Type.EmptyTypes; } })
                .Where(t => typeof(ITodaySource).IsAssignableFrom(t) && !t.IsInterface && !t.IsAbstract)
                .Select(t => t.FullName).OrderBy(s => s).ToList();
            PlaytestKit.Check(impls.Count == 4 && !impls.Any(s => s.StartsWith("Saga.Realm", StringComparison.Ordinal)), "어댑터 " + string.Join(",", impls));
            Debug.Log($"{Tag} realm OK - 어댑터 {impls.Count}(5천하 없음)");
        }
    }
}
