using System;
using UnityEngine;
using Saga.Story.Data;
using Saga.Story.Player;
using Saga.Story.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0192 4종횡 문파(고돗 G-0333 짝) 진단 — `PlaytestStorySlice` 준비 단계 끝(숨은 우두머리 뒤)이 부른다(한 프레임 안).
    /// ① 들기·나가기(공 0)·없는 문파·같은 문파 ② 공 — 잡졸 +1·두목 +10·오늘 의뢰 사냥터 ×2·날마다 돌아감·문파 없으면 0·단계 오름(제자 100) ③ 덤 — 검각 공격(주인공 AttackPower)·서원 경험(GainExp)·상단 채집 덤(같은 씨앗 2000번)·남의 갈래 0
    /// ④ 창 — 🏯 단추·들기 단추·줄·나가기·닫기 ⑤ 세이브 칸·왕복·옛 세이브 ⑥ 손잡이. 끝나면 문파·레벨·경험·채집 기록을 시작 때로.
    /// </summary>
    public static class PlaytestStoryGuild
    {
        private const string T = "[PlaytestStorySlice] guild";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string guild0 = StoryGuild.Snapshot(), life0 = StoryLife.Snapshot();
            int lv0 = StoryJobState.Level; float exp0 = StoryJobState.Exp; string job0 = StoryJobState.Job;
            try
            {
                StoryGuild.ResetForTest();
                StoryGuild.TodayForTest = new DateTime(2026, 10, 23);
                int day = StoryGuild.Today;

                // ① 들기·나가기
                Begin();
                if (StoryGuild.Join("nope").Length == 0) Fail("없는 문파에 듦");
                if (StoryGuild.Join("blade").Length > 0 || StoryGuild.Joined != "blade") Fail("검각 들기");
                if (StoryGuild.Join("blade").Length == 0) Fail("같은 문파 또 듦");
                StoryGuild.SetPtsForTest(50);
                if (StoryGuild.Join("academy").Length > 0 || StoryGuild.Joined != "academy" || StoryGuild.Pts != 0) Fail($"서원으로 옮김 — 공 {StoryGuild.Pts}");
                StoryGuild.Leave();
                if (StoryGuild.Joined.Length != 0) Fail("나가기");
                End("join OK - 없는 문파·같은 문파 막힘 · 옮기면 공 0 · 나가기");

                // ② 공
                Begin();
                if (StoryGuild.OnKill("field", false, day) != -1 || StoryGuild.Pts != 0) Fail("문파 없는데 공");
                StoryGuild.Join("blade");
                string hunt = StoryGuild.HuntToday("blade", day), other = hunt == "field" ? "labyrinth" : "field";
                if (StoryGuild.HuntToday("blade", day + 1) == hunt) Fail("다음 날도 같은 의뢰 사냥터");
                if (StoryGuild.HuntToday("merchant", day) == hunt) Fail("문파가 달라도 같은 의뢰 사냥터");
                StoryGuild.OnKill(other, false, day);
                int p1 = StoryGuild.Pts;
                StoryGuild.OnKill(hunt, false, day);
                int p2 = StoryGuild.Pts - p1;
                StoryGuild.OnKill(other, true, day);
                int p3 = StoryGuild.Pts - p1 - p2;
                StoryGuild.OnKill(hunt, true, day);
                int p4 = StoryGuild.Pts - p1 - p2 - p3;
                if (p1 != 1 || p2 != 2 || p3 != StoryGuild.BossPts || p4 != StoryGuild.BossPts * 2) Fail($"공 잡졸 {p1}·의뢰 {p2}·두목 {p3}·의뢰 두목 {p4}");
                StoryGuild.SetPtsForTest(99);
                int up = StoryGuild.OnKill(other, false, day);
                if (up != 1 || StoryGuild.RankUpLine(up).Length == 0) Fail($"제자 오름 {up}");
                if (StoryGuild.OnKill(other, false, day) != -1) Fail("안 올랐는데 오름");
                End($"merit OK - 잡졸 +{p1}·의뢰({StoryGuild.HuntName(hunt)}) +{p2}·두목 +{p3}·의뢰 두목 +{p4} · 날·문파마다 돌아감 · 99→100 제자「{StoryGuild.RankUpLine(1)}」");

                // ③ 덤
                Begin();
                var pc = UnityEngine.Object.FindFirstObjectByType<StoryPlayerController>();
                StoryGuild.Leave();
                float atk0 = pc != null ? pc.AttackPower : 0f;
                StoryGuild.Join("blade"); StoryGuild.SetPtsForTest(3000);
                float atkB = pc != null ? pc.AttackPower : 0f;
                if (pc == null || Mathf.Abs(atkB / Mathf.Max(0.001f, atk0) - 1.10f) > 0.001f) Fail($"검각 문주 공격 {atk0}→{atkB}");
                if (StoryGuild.ExpMul != 1f || StoryGuild.MatsChance != 0f) Fail("검각인데 남의 갈래 덤");
                StoryJobState.Restore(lv0, 0f, job0);
                StoryJobState.GainExp(1f);
                float e0 = StoryJobState.Exp;
                StoryGuild.Join("academy"); StoryGuild.SetPtsForTest(700);   // 장로 = +6%
                StoryJobState.Restore(lv0, 0f, job0);
                StoryJobState.GainExp(1f);
                float e1 = StoryJobState.Exp;
                if (Mathf.Abs(e0 - 1f) > 1e-4f || Mathf.Abs(e1 - 1.06f) > 1e-4f) Fail($"서원 장로 경험 {e0}→{e1}");
                int m0 = GatherMats(null), m1 = GatherMats("merchant");
                if (m1 <= m0) Fail($"상단 채집 덤 {m0}→{m1}");
                End($"bonus OK - 검각 문주 공격 ×{atkB / Mathf.Max(0.001f, atk0):0.00} · 서원 장로 경험 1→{e1:0.00} · 상단 문주 채집 2000번 재료 {m0}→{m1} · 남의 갈래 0");

                // ④ 창
                Begin();
                var ui = StoryGuildUi.Instance;
                if (ui == null || ui.OpenButton == null) Fail("창·🏯 단추 없음");
                else
                {
                    StoryGuild.Leave();
                    ui.OpenButton.onClick.Invoke();
                    if (!ui.IsOpen || !ui.RankLabel.text.Contains(StoryGuild.RankText())) Fail("🏯 눌러도 창 안 열림");
                    ui.JoinButtons[2].onClick.Invoke();
                    if (StoryGuild.Joined != "academy" || ui.JoinButtons[2].interactable || !ui.LeaveButton.interactable) Fail("서원 단추");
                    if (!ui.HuntLabel.text.Contains(StoryGuild.HuntName(StoryGuild.HuntToday("academy", day)))) Fail($"의뢰 줄「{ui.HuntLabel.text}」");
                    string line = ui.RankLabel.text;
                    ui.LeaveButton.onClick.Invoke();
                    if (StoryGuild.Joined.Length != 0) Fail("나가기 단추");
                    ui.CloseButton.onClick.Invoke();
                    if (ui.IsOpen) Fail("닫기");
                    End($"ui OK -「{line}」·「{ui.HuntLabel.text}」· 나가기·닫기");
                }

                // ⑤ 세이브
                Begin();
                StoryGuild.Join("merchant"); StoryGuild.SetPtsForTest(321);
                string snap = StoryGuild.Snapshot();
                if (!StorySaveState.ToJson().Contains("\"guildJson\"")) Fail("세이브에 guildJson 없음");
                StoryGuild.Restore(null);
                if (StoryGuild.Joined.Length != 0 || StoryGuild.Pts != 0) Fail("옛 세이브인데 문파");
                StoryGuild.Restore(snap);
                if (StoryGuild.Joined != "merchant" || StoryGuild.Pts != 321) Fail($"왕복 {StoryGuild.Joined} {StoryGuild.Pts}");
                StoryGuild.Restore("{\"id\":\"ghost\",\"pts\":5}");
                if (StoryGuild.Joined.Length != 0) Fail("없는 문파 세이브를 받음");
                End("save OK - guildJson 왕복(문파·공)·옛 세이브 = 문파 없음·없는 문파 버림");

                // ⑥ 손잡이
                Begin();
                StoryGuild.Restore(snap);
                StoryGuild.On = false;
                if (StoryGuild.Joined.Length != 0 || StoryGuild.AtkMul != 1f || StoryGuild.OnKill("field", true, day) != -1) Fail("껐는데 문파");
                End("off OK - 끄면 문파·덤·공 없음");
            }
            finally
            {
                StoryGuild.On = true;
                StoryGuild.TodayForTest = null;
                StoryGuild.Restore(guild0);
                StoryLife.Restore(life0);
                StoryJobState.Restore(lv0, exp0, job0);
                StoryGuildUi.Instance?.Close();
            }
            return _ok;
        }

        /// <summary>같은 씨앗 2000번 채집 — 얻은 재료 합(문파 id = null 이면 문파 없이, 아니면 문주로).</summary>
        private static int GatherMats(string guild)
        {
            StoryGuild.Leave();
            if (guild != null) { StoryGuild.Join(guild); StoryGuild.SetPtsForTest(3000); }
            StoryLife.SetXpForTest(0);
            var rng = new System.Random(20260824);
            int n = 0;
            for (int i = 0; i < 2000; i++) { n += StoryLife.Gather(rng, out _); StoryLife.SetXpForTest(0); }
            return n;
        }

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string why)
        {
            _ok = false;
            _step = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
