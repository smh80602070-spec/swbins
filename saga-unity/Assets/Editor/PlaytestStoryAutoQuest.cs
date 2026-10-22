using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using Saga.Core;
using Saga.Story.Data;
using Saga.Story.Player;
using Saga.Story.UI;
using Saga.Story.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0165 4종횡 자동 퀘스트 진단 — `PlaytestStorySlice` 준비 단계 끝이 부른다(한 프레임 안, 시간은 손으로 넣는다).
    /// 뒤 단계가 들판 잡졸을 하나씩 다 잡으므로 잡졸 하나를 **복제**해 들판 끝에 두고: 이야기를 끈 채(사명 「첫 사냥」) 8m 떨어져 켜면
    /// 좌우로 걸어가(턱이면 뛰어) 돌아서며 평타로 잡는다(다른 잡졸은 잠깐 끔 · 처치 +1 · 목표 = 첫 사냥) · 걸음 종류 표(talk·kills·boss·gate·job) · job 걸음 = 멈춤 "직접" ·
    /// 체력 30% 밑 = 멈춤 · 손 조작 = 멈춤 · ▶ 단추. 끝나면 사명·직업·달 사명·판 등급 셈·이야기·체력·자리를 시작 때로(복제는 죽어 지워진다).
    /// </summary>
    public static class PlaytestStoryAutoQuest
    {
        private const string T = "[PlaytestStorySlice] autoquest";
        private const BindingFlags PS = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static;
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var aq = StoryAutoQuest.Instance;
            var playerGo = GameObject.FindWithTag("Player");
            var pc = playerGo != null ? playerGo.GetComponent<StoryPlayerController>() : null;
            if (aq == null || pc == null) { Fail("StoryAutoQuest·플레이어 없음"); return false; }
            StoryEnemy src = null;
            foreach (var e in StoryEnemy.All) if (e != null && !e.IsDead && !e.IsBoss && !e.IsChampion && !e.IsLabyrinthEnemy) { src = e; break; }
            if (src == null) { Fail("복제할 잡졸 없음"); return false; }

            Vector3 pos0 = playerGo.transform.position;
            int kills0 = StoryQuestState.Kills, boss0 = StoryQuestState.BossKills;
            int lv0 = StoryJobState.Level; float exp0 = StoryJobState.Exp; string job0 = StoryJobState.Job;
            float hp0 = StoryPlayerHp.Hp;
            bool scen0 = StoryScenario.Enabled;
            string scenSnap = StoryScenario.Snapshot(), monthly0 = StoryMonthly.Snapshot();
            var rank = SnapStatics(typeof(StoryRunRank));
            GameObject dummy = null;
            var hidden = new List<(GameObject go, Vector3 at)>();
            string m = "";
            try
            {
                AutoQuestHud.WatchOffForTest = true;
                StoryPlayerHp.SetForTest(StoryPlayerHp.HpMax);
                // 걸음 종류 표
                string kinds = StoryAutoQuest.KindOf(new StoryScenarioData.Step { T = "talk" }) + StoryAutoQuest.KindOf(new StoryScenarioData.Step { T = "kills" })
                    + StoryAutoQuest.KindOf(new StoryScenarioData.Step { T = "mission", Key = "q_boss1" }) + StoryAutoQuest.KindOf(new StoryScenarioData.Step { T = "gate" })
                    + StoryAutoQuest.KindOf(new StoryScenarioData.Step { T = "job", N = 1 });
                if (kinds != "talkkillbossgatemanual") Fail("걸음 종류 " + kinds);

                // 진짜 처치 — 복제 잡졸 하나, 이야기는 끄고 사명 「첫 사냥」
                StoryScenario.Enabled = false;
                StoryQuestState.Restore(0, boss0);
                StoryJobState.Restore(lv0, 0f, job0); // 한 마리 경험치로 레벨이 안 오르게(무예 3택 창이 뒤 단계를 막지 않게)
                // 다른 적은 잠깐 끄고 멀리 둔다(겨눔에서 빠짐 · 휘두름·동행 공격도 안 닿음 — 들판에 빈 자리가 없다)
                float fx = src.transform.position.x;
                foreach (var e in StoryEnemy.All)
                    if (e != null && e.gameObject.activeSelf) { hidden.Add((e.gameObject, e.transform.position)); e.gameObject.SetActive(false); e.transform.position += new Vector3(5000f, 0f, 0f); }
                dummy = Object.Instantiate(src.gameObject, new Vector3(fx, src.transform.position.y, src.transform.position.z), src.transform.rotation);
                dummy.name = "AutoQuestDummy";
                dummy.SetActive(true); // 원본을 끈 뒤 복제했으니 켠다
                var foe = dummy.GetComponent<StoryEnemy>();
                pc.Teleport(new Vector3(fx - 6f, pos0.y + 0.6f, pos0.z));
                Physics.SyncTransforms();
                var g = aq.First();
                if (g == null || g.Id != "q_field" || g.Type != "kill") Fail($"첫 목표 {g?.Id}·{g?.Type}");
                if (aq.TargetOf("kill") != foe) Fail("겨눈 적이 복제가 아님");
                if (!aq.Q.Start()) Fail("켜기 " + aq.Q.Why);
                float x0 = playerGo.transform.position.x;
                int steps = 0;
                for (; steps < 600 && aq.Q.On && !foe.IsDead; steps++)
                {
                    aq.Step(0.05f);
                    pc.Step(0.05f);
                }
                if (!foe.IsDead) Fail($"복제 잡졸을 못 잡음({steps} 걸음, 나 x {playerGo.transform.position.x:0.0}·적 x {foe.transform.position.x:0.0}·{aq.Q.Why}·{aq.Q.Doing})");
                if (StoryQuestState.Kills != 1)
                {
                    var dead = new List<string>();
                    foreach (var e in StoryEnemy.All) if (e != null && e.IsDead) dead.Add($"{e.name}@{e.transform.position.x:0.0}{(e.gameObject.activeSelf ? "" : "(꺼짐)")}");
                    Fail($"처치 셈 {StoryQuestState.Kills} — 죽은 것 {string.Join(",", dead)} · 복제 x {fx:0.0} · 원래 자리 x {pos0.x:0.0}");
                }
                m += $" 걸음 {steps}·x {x0:0.0}→{playerGo.transform.position.x:0.0}·처치 {StoryQuestState.Kills}";
                aq.Q.Stop("진단");
                StoryJobState.Restore(lv0, 0f, job0);

                // 체력 낮음
                StoryPlayerHp.SetForTest(StoryPlayerHp.HpMax * 0.2f);
                aq.Q.Start();
                aq.Step(0.05f);
                if (aq.Q.On || aq.Q.Why != AutoQuestHud.LowHpWhy) Fail($"체력 낮음 멈춤 {aq.Q.On}·{aq.Q.Why}");
                StoryPlayerHp.SetForTest(StoryPlayerHp.HpMax);
                // 손 조작
                aq.Q.Start();
                aq.FakeHandInputForTest = true;
                aq.Step(0.05f);
                if (aq.Q.On || aq.Q.Why != AutoQuestHud.HandWhy) Fail($"손 조작 멈춤 {aq.Q.On}·{aq.Q.Why}");
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
                AutoQuestHud.WatchOffForTest = false;
                if (dummy != null) Object.DestroyImmediate(dummy);
                foreach (var h in hidden) if (h.go != null) { h.go.transform.position = h.at; h.go.SetActive(true); }
                StoryScenario.Enabled = scen0;
                StoryScenario.Restore(scenSnap);
                StoryMonthly.Restore(monthly0);
                RestoreStatics(typeof(StoryRunRank), rank);
                StoryQuestState.Restore(kills0, boss0);
                StoryJobState.Restore(lv0, exp0, job0);
                StoryPlayerHp.SetForTest(hp0);
                pc.Teleport(pos0);
            }
            if (_ok) Debug.Log($"{T} OK - 4종횡(걸음 종류 표·사명 첫 사냥 = 좌우로 걸어가 돌아서며 평타로 처치·체력 낮음·손 조작·▶) |{m}");
            return _ok;
        }

        /// <summary>값 정적 필드만(판 등급 셈) — 처치 한 번이 바꾼 셈을 되돌린다.</summary>
        private static Dictionary<FieldInfo, object> SnapStatics(System.Type t)
        {
            var d = new Dictionary<FieldInfo, object>();
            foreach (var f in t.GetFields(PS))
                if (!f.IsLiteral && !f.IsInitOnly && (f.FieldType.IsValueType || f.FieldType == typeof(string))) d[f] = f.GetValue(null);
            return d;
        }

        private static void RestoreStatics(System.Type t, Dictionary<FieldInfo, object> d)
        {
            foreach (var kv in d) kv.Key.SetValue(null, kv.Value);
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
