using System.Collections.Generic;
using UnityEngine;
using Saga.Core;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0163 자동 퀘스트 진단 — `PlaytestHeadless` 가 부른다(한 프레임 안, 시간은 손으로 넣는다).
    /// ① 공용 틀(가짜 어댑터): 목표 없음 = 안 켜짐 · 목표 바뀌면 셈 · 멈출 이유면 멈춤 · 바쁘면 막힘 안 셈 · 30초 제자리 = 막힘 → 비켜 가기 · 넷째 = 멈춤 "막힘 —".
    /// ② 1만리 진짜: 1장 첫 단계(말 걸기)에서 25m 떨어져 켜면 걸어가 말을 걸고 줄을 넘겨 단계가 넘어간다 · 앞장 체력 30% 밑 = 멈춤 · 손 조작 = 멈춤 · ▶ 단추.
    /// 끝나면 이야기 진행·체력·자리·글 빠르기를 시작 때로.
    /// </summary>
    public static class PlaytestGoAutoQuest
    {
        private static string T;
        private static bool _ok;

        private class Fake : AutoQuest.IAutoQuestAdapter
        {
            public List<AutoQuest.Goal> Goals = new List<AutoQuest.Goal>();
            public Vector3 P;
            public bool IsBusy;
            public string PauseWhy;
            public int Unsticks, Begins, Ends;
            public AutoQuest.Goal First() => Goals.Count > 0 ? Goals[0] : null;
            public string Run(AutoQuest.Goal g, float dt) => "run " + g.Id;
            public Vector3? Pos() => P;
            public bool Busy() => IsBusy;
            public string Pause() => PauseWhy;
            public void Begin(AutoQuest.Goal g) => Begins++;
            public void End(string why) => Ends++;
            public void Unstick(int n, AutoQuest.Goal g) => Unsticks++;
        }

        public static bool Run(string tag)
        {
            T = $"[{tag}]";
            _ok = true;
            string m = CheckCore();
            m += CheckGo();
            if (_ok) Debug.Log($"{T} autoquest OK - 틀(목표 없음·셈·멈출 이유·바쁨·막힘 셋 비켜 가기·넷째 멈춤) · 1만리(걸어가 말 걸고 줄 넘겨 단계 넘김·체력 낮음·손 조작·▶) |{m}");
            return _ok;
        }

        private static string CheckCore()
        {
            var f = new Fake();
            var q = new AutoQuest(f);
            if (q.Start() || q.On) Fail("목표 없는데 켜짐");
            f.Goals.Add(new AutoQuest.Goal { Id = "a", Type = "go", Label = "A" });
            if (!q.Start() || !q.On || f.Begins != 1) Fail("켜기");
            q.Tick(0.1f);
            if (q.Doing != "run a") Fail($"할 일 {q.Doing}");
            f.Goals[0] = new AutoQuest.Goal { Id = "b", Type = "go", Label = "B" };
            q.Tick(0.1f);
            if (q.Done != 1 || q.Current.Id != "b") Fail($"목표 바뀜 셈 {q.Done}");
            // 바쁘면 막힘 안 셈
            f.IsBusy = true;
            for (int i = 0; i < 400; i++) q.Tick(0.1f);
            if (q.Stuck != 0) Fail($"바쁜데 막힘 {q.Stuck}");
            f.IsBusy = false;
            // 제자리 30초씩 — 셋은 비켜 가기, 넷째 멈춤
            for (int i = 0; i < 3; i++) for (int k = 0; k < 302; k++) q.Tick(0.1f);
            if (q.Stuck != 3 || f.Unsticks != 3 || !q.On) Fail($"막힘 셋 {q.Stuck}·비켜 {f.Unsticks}·켜짐 {q.On}");
            for (int k = 0; k < 302; k++) q.Tick(0.1f);
            if (q.On || !q.Why.Contains("B") || f.Ends != 1) Fail($"넷째 막힘 멈춤 {q.On}·{q.Why}");
            // 움직이면 막힘 안 셈
            q.Start();
            for (int k = 0; k < 600; k++) { f.P += new Vector3(0.2f, 0f, 0f); q.Tick(0.1f); }
            if (q.Stuck != 0 || !q.On) Fail($"움직이는데 막힘 {q.Stuck}");
            // 멈출 이유
            f.PauseWhy = "체력";
            q.Tick(0.1f);
            if (q.On || q.Why != "체력") Fail("멈출 이유");
            return " 틀";
        }

        private static string CheckGo()
        {
            var aq = GoAutoQuest.Instance;
            var fc = FieldCombat.Instance;
            var ui = StoryUi.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            if (aq == null || fc == null || ui == null || pc == null) { Fail("GoAutoQuest·FieldCombat·StoryUi·PlayerController 없음"); return ""; }
            bool off0 = StoryState.OffForTest;
            int ch0 = StoryState.Ch, st0 = StoryState.StepIndex;
            float cps0 = StoryUi.RevealCps;
            Vector3 pos0 = pc.transform.position;
            float hp0 = fc.Active.Hp;
            string m = "";
            try
            {
                GoAutoQuest.WatchOffForTest = true;
                StoryUi.RevealCps = 0f;
                StoryState.OffForTest = false;
                StoryState.Restore(0, 0);
                var g = aq.First();
                if (g == null) { Fail("1장 첫 단계 목표 없음"); return ""; }
                StoryField.Target(out var at, out _);
                if (g.Id != StoryState.LineKey || g.At == null || (g.At.Value - at).sqrMagnitude > 0.01f) Fail($"목표 {g.Id}·{g.At}");
                if (g.Type != GoAutoQuest.TypeOf(StoryState.Current.Type)) Fail($"종류 {g.Type}");
                // 25m 떨어져서 켠다
                pc.Teleport(at + new Vector3(25f, 0.4f, 0f));
                string key0 = StoryState.LineKey;
                float d0 = Flat(pc.transform.position - at), dMin = d0;
                if (!aq.Q.Start()) Fail("켜기 " + aq.Q.Why);
                bool talked = false;
                int steps = 0;
                for (; steps < 1200 && aq.Q.On && StoryState.LineKey == key0; steps++)
                {
                    aq.Step(0.05f);
                    pc.Step(0.05f);
                    ui.Refresh();
                    talked |= ui.TalkOpen;
                    dMin = Mathf.Min(dMin, Flat(pc.transform.position - at));
                }
                if (dMin > d0 - 15f) Fail($"안 걸어감 {d0:0.0}→{dMin:0.0}m");
                if (g.Type == "talk" && !talked) Fail("말을 안 걺");
                if (StoryState.LineKey == key0) Fail($"단계가 안 넘어감({steps} 걸음, {aq.Q.Why}·{aq.Q.Doing})");
                m += $" 걸음 {steps}·{d0:0}→{dMin:0.0}m·{(talked ? "대화" : "")}·{key0}→{StoryState.LineKey}";
                aq.Q.Stop("진단");
                // 체력 낮음
                fc.Active.Hp = fc.Active.MaxHp * 0.2f;
                aq.Q.Start();
                aq.Step(0.05f);
                if (aq.Q.On || aq.Q.Why != GoLocalization.T("aq.lowhp", "체력 낮음")) Fail($"체력 낮음 멈춤 {aq.Q.On}·{aq.Q.Why}");
                fc.Active.Hp = hp0;
                // 손 조작
                aq.Q.Start();
                aq.FakeHandInputForTest = true;
                aq.Step(0.05f);
                if (aq.Q.On || aq.Q.Why != GoLocalization.T("aq.hand", "손 조작")) Fail($"손 조작 멈춤 {aq.Q.On}·{aq.Q.Why}");
                // ▶ 단추
                if (aq.PlayButton == null) Fail("▶ 단추 없음");
                else
                {
                    aq.PlayButton.onClick.Invoke();
                    bool on = aq.Q.On;
                    aq.PlayButton.onClick.Invoke();
                    if (!on || aq.Q.On) Fail("▶ 단추 켜고 끄기");
                }
            }
            finally
            {
                if (aq.Q.On) aq.Q.Stop("진단 끝");
                pc.ClearTestInput();
                if (ui.TalkOpen) ui.Next(-1);
                fc.Active.Hp = hp0;
                StoryState.Restore(ch0, st0);
                StoryState.OffForTest = off0;
                StoryUi.RevealCps = cps0;
                GoAutoQuest.WatchOffForTest = false;
                pc.Teleport(pos0);
            }
            return m;
        }

        private static float Flat(Vector3 v) { v.y = 0f; return v.magnitude; }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} autoquest FAIL - {why}");
        }
    }
}
