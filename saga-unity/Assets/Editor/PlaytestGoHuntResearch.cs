using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0220 1만리 종 연구 과제(고돗 G-0371 짝) 진단 — `PlaytestHeadless` 가 사냥 기록 진단 뒤에 부른다(한 프레임 안).
    /// ① 급소 3 → 과제 하나 덤 한 번(넷째는 덤 없음) ② 반응·쳐냄·던짐 각각 → 넷째 과제에 연구 완료 덤 ③ 우두머리 = 과제 셋(던짐 안 셈)·목표 1
    /// ④ 진짜 들판 — 치명타 막타·막타 아닌 치명타 0·반응 막타·쳐낸 적·던진 적(그 목숨 동안 — 다시 서면 지움) ⑤ 끔 0 ⑥ 세이브 왕복·옛 세이브 0·모르는 종 버림 ⑦ 사냥 기록 줄 끝.
    /// 끝나면 연구·사냥 기록·업적·금·재료·레벨·세이브 파일·들판 적을 시작 때로.
    /// </summary>
    public static class PlaytestGoHuntResearch
    {
        private const string T = "[PlaytestHeadless] research";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string r0 = GoHuntResearch.Snapshot();
            var hk = HuntState.SnapshotKills(); var hc = HuntState.SnapshotClaimed();
            var ach = (AchieveState.SnapshotStats(), AchieveState.SnapshotKinds(), AchieveState.SnapshotGot());
            int gold0 = GoldState.Gold, lv0 = PlayerStats.Level; long exp0 = PlayerStats.Exp;
            var tal0 = TalentState.Snapshot(); var mats0 = TalentState.SnapshotMats();
            int meat0 = CookState.Count("meat");
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            string m = "";
            try
            {
                var N = FieldEnemy.Kind.Bandit;
                var B = FieldEnemy.Kind.Guardian;

                // ① 급소 3 → 과제 하나
                Begin();
                GoHuntResearch.ResetForTest();
                int g = GoldState.Gold, note = TalentState.Count(GoTalent.Mat.Note);
                int fresh1 = GoHuntResearch.Record(N, GoHuntResearch.Tag.Weak).Count + GoHuntResearch.Record(N, GoHuntResearch.Tag.Weak).Count;
                var third = GoHuntResearch.Record(N, GoHuntResearch.Tag.Weak);
                int g3 = GoldState.Gold, n3 = TalentState.Count(GoTalent.Mat.Note);
                var fourth = GoHuntResearch.Record(N, GoHuntResearch.Tag.Weak);
                if (fresh1 != 0 || third.Count != 1 || third[0] != GoHuntResearch.Tag.Weak) Fail($"급소 3 에 과제 하나 아님(앞 둘 {fresh1}·셋째 {third.Count})");
                if (g3 - g != GoHuntResearch.TaskGold || n3 - note != GoHuntResearch.TaskNote) Fail($"과제 덤 금 +{g3 - g}·쪽지 +{n3 - note}");
                if (fourth.Count != 0 || GoldState.Gold != g3 || TalentState.Count(GoTalent.Mat.Note) != n3) Fail("넷째 급소에 덤을 또 줌");
                if (GoHuntResearch.Count(N, GoHuntResearch.Tag.Weak) != 4 || GoHuntResearch.DoneCount(N) != 1) Fail($"급소 셈 {GoHuntResearch.Count(N, GoHuntResearch.Tag.Weak)}·채운 {GoHuntResearch.DoneCount(N)}");
                End($"weak OK - 급소 막타 3 → 과제 1(금 +{GoHuntResearch.TaskGold}·{GoTalent.MatName(GoTalent.Mat.Note)} +{GoHuntResearch.TaskNote}) · 넷째 덤 없음 · 「{GoHuntResearch.RowText(N)}」");

                // ② 반응·쳐냄·던짐 → 연구 완료
                Begin();
                int fr = 0, fp = 0, ft = 0;
                for (int i = 0; i < 3; i++) fr += GoHuntResearch.Record(N, GoHuntResearch.Tag.React).Count;
                for (int i = 0; i < 3; i++) fp += GoHuntResearch.Record(N, GoHuntResearch.Tag.Parried).Count;
                int gBefore = GoldState.Gold, guide = TalentState.Count(GoTalent.Mat.Guide);
                List<GoHuntResearch.Tag> last = null;
                for (int i = 0; i < 3; i++) { last = GoHuntResearch.Record(N, GoHuntResearch.Tag.Thrown); ft += last.Count; }
                if (fr != 1 || fp != 1) Fail($"반응 {fr}·쳐냄 {fp} 과제 수");
                if (last == null || last.Count != 2 || !last.Contains(GoHuntResearch.Tag.Thrown) || !last.Contains(GoHuntResearch.Tag.None)) Fail("넷째 과제에 연구 완료 없음");
                if (GoldState.Gold - gBefore != GoHuntResearch.TaskGold + GoHuntResearch.DoneGold || TalentState.Count(GoTalent.Mat.Guide) - guide != GoHuntResearch.DoneGuide) Fail($"완료 덤 금 +{GoldState.Gold - gBefore}");
                if (!GoHuntResearch.Complete(N)) Fail("연구 완료가 아님");
                string notice = GoHuntResearch.NoticeText(N, last);
                if (!notice.Contains(FieldEnemy.KindName(N)) || notice.Split('\n').Length != 2) Fail($"알림 글「{notice}」");
                int gAfter = GoldState.Gold;
                GoHuntResearch.Record(N, GoHuntResearch.Tag.Weak | GoHuntResearch.Tag.React);
                if (GoldState.Gold != gAfter) Fail("완료 뒤에도 덤");
                End($"done OK - 반응·쳐냄·던짐 각 3 → 과제 넷 · 연구 완료 덤(금 +{GoHuntResearch.DoneGold}·{GoTalent.MatName(GoTalent.Mat.Guide)} +{GoHuntResearch.DoneGuide}) 한 번 · 「{GoHuntResearch.RowText(N)}」");

                // ③ 우두머리
                Begin();
                var bt = GoHuntResearch.Record(B, GoHuntResearch.Tag.Weak | GoHuntResearch.Tag.React | GoHuntResearch.Tag.Parried | GoHuntResearch.Tag.Thrown);
                if (GoHuntResearch.TasksOf(B).Count != 3 || GoHuntResearch.GoalOf(B) != 1) Fail($"우두머리 과제 {GoHuntResearch.TasksOf(B).Count}·목표 {GoHuntResearch.GoalOf(B)}");
                if (bt.Count != 4 || GoHuntResearch.Count(B, GoHuntResearch.Tag.Thrown) != 0 || !GoHuntResearch.Complete(B)) Fail($"우두머리 한 번에 셋+완료 아님({bt.Count})");
                End($"boss OK - 우두머리 과제 셋(던짐 뺌)·목표 1 → 한 마리에 셋 + 연구 완료 · 「{GoHuntResearch.RowText(B)}」");

                // ④ 진짜 들판
                Begin();
                GoHuntResearch.ResetForTest();
                FieldEnemy e = null;
                foreach (var x in FieldEnemy.All) if (x.Alive && !x.IsGuardian && !x.IsHero && !x.DomainFoe && !x.StoryFoe) { e = x; break; }
                if (e == null) Fail("들판 적이 없음");
                else
                {
                    var k = e.EnemyKind;
                    void Prep() { e.ReviveNow(); if (e.Shielded) e.SetShieldForTest(0f); e.ClearAuraForTest(); }
                    Prep();
                    e.TakeHit(e.Hp + 999f, GoElement.Physical, 10f, out _, false, true);
                    int weak1 = GoHuntResearch.Count(k, GoHuntResearch.Tag.Weak);
                    Prep();
                    e.TakeHit(1f, GoElement.Physical, 10f, out _, false, true);
                    e.TakeRaw(e.Hp + 999f, Color.white);
                    int weak2 = GoHuntResearch.Count(k, GoHuntResearch.Tag.Weak);
                    Prep();
                    e.TakeHit(0.01f, GoElement.Pyro, 10f, out _);
                    e.TakeHit(e.Hp + 999f, GoElement.Hydro, 10f, out var rx);
                    int react = GoHuntResearch.Count(k, GoHuntResearch.Tag.React);
                    Prep();
                    e.Parried(0.1f);
                    e.TakeRaw(e.Hp + 999f, Color.white);
                    int par1 = GoHuntResearch.Count(k, GoHuntResearch.Tag.Parried);
                    Prep();
                    e.TakeRaw(e.Hp + 999f, Color.white);
                    int par2 = GoHuntResearch.Count(k, GoHuntResearch.Tag.Parried);
                    Prep();
                    e.MarkThrownForResearch();
                    e.TakeRaw(e.Hp + 999f, Color.white);
                    int thr = GoHuntResearch.Count(k, GoHuntResearch.Tag.Thrown);
                    Prep();
                    e.TakeRaw(e.Hp + 999f, Color.white);
                    int thr2 = GoHuntResearch.Count(k, GoHuntResearch.Tag.Thrown);
                    e.ReviveNow();
                    if (weak1 != 1) Fail($"치명타 막타 급소 {weak1}");
                    if (weak2 != 1) Fail($"막타 아닌 치명타가 셈 {weak2}");
                    if (react != 1 || rx == GoReaction.None) Fail($"반응 막타 {react}({rx})");
                    if (par1 != 1 || par2 != 1) Fail($"쳐낸 적 {par1}→{par2}(다시 선 뒤에도 셈?)");
                    if (thr != 1 || thr2 != 1) Fail($"던진 적 {thr}→{thr2}");
                    if (GoHuntResearch.Count(k, GoHuntResearch.Tag.Weak) + GoHuntResearch.Count(k, GoHuntResearch.Tag.React) + GoHuntResearch.Count(k, GoHuntResearch.Tag.Parried) + GoHuntResearch.Count(k, GoHuntResearch.Tag.Thrown) != 4) Fail("맨 처치가 과제에 셈");
                    m += $" 들판 {k}";
                    End($"field OK - 진짜 {k}: 치명타 막타 급소 1 · 막타 아닌 치명타 0 · 반응({rx}) 막타 1 · 쳐낸 적 1(다시 서면 지움) · 던진 적 1 · 맨 처치 0");
                }

                // ⑤ 끔
                Begin();
                GoHuntResearch.On = false;
                int gOff = GoldState.Gold;
                var off = GoHuntResearch.Record(N, GoHuntResearch.Tag.Weak | GoHuntResearch.Tag.React);
                if (off.Count != 0 || GoldState.Gold != gOff || GoHuntResearch.RowText(N).Length != 0) Fail("껐는데 셈");
                GoHuntResearch.On = true;
                End("off OK - 끄면 셈·덤·줄 글 없음");

                // ⑥ 세이브
                Begin();
                GoHuntResearch.ResetForTest();
                for (int i = 0; i < 3; i++) GoHuntResearch.Record(N, GoHuntResearch.Tag.Weak | GoHuntResearch.Tag.Parried);
                string snap = GoHuntResearch.Snapshot();
                if (!SaveState.ToJson().Contains("\"huntResearch\"")) Fail("세이브에 huntResearch 없음");
                GoHuntResearch.Restore(null);
                if (GoHuntResearch.DoneCount(N) != 0) Fail("옛 세이브인데 연구");
                GoHuntResearch.Restore(snap);
                if (GoHuntResearch.DoneCount(N) != 2 || GoHuntResearch.Count(N, GoHuntResearch.Tag.Parried) != 3) Fail("왕복");
                GoHuntResearch.Restore("{\"rows\":[{\"id\":\"NoSuchKind\",\"n\":[3,3,3,3]}]}");
                if (GoHuntResearch.Snapshot().Contains("NoSuchKind")) Fail("모르는 종을 안 버림");
                End("save OK - huntResearch 왕복(과제 2/4) · 옛 세이브 0 · 모르는 종 버림");

                // ⑦ 사냥 기록 줄
                Begin();
                GoHuntResearch.Restore(snap);
                string line = HuntLogUi.LineText(N);
                if (!line.Contains(GoHuntResearch.RowText(N))) Fail($"사냥 기록 줄에 연구 없음「{line}」");
                End($"row OK - 사냥 기록 줄 끝「{GoHuntResearch.RowText(N)}」");
            }
            finally
            {
                GoHuntResearch.On = true;
                GoHuntResearch.Restore(r0);
                HuntState.Restore(hk, hc);
                AchieveState.Restore(ach.Item1, ach.Item2, ach.Item3);
                GoldState.Restore(gold0);
                TalentState.Restore(tal0, mats0);
                PlayerStats.Restore(lv0, exp0);
                int meatPlus = CookState.Count("meat") - meat0; if (meatPlus > 0) CookState.Spend("meat", meatPlus); // 산적 봇짐 고기
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                FieldCombat.Instance?.ResetForTest();
                foreach (var x in FieldEnemy.All) x.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"{T} done |{m}");
            return _ok;
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
