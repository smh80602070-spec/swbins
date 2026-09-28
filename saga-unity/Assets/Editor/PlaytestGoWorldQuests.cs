using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-21 "세계 임무 셋·따라가는 줄"(웹 사가고 ⑲-21 진단 항목) — `PlaytestHeadless` 가 이야기 진단 뒤에 부른다.
    /// 표(임무 셋·단계·등급·보상·인물 일곱) · 자리(걷는 칸·이야기 인물과 12m·임무 적/제단이 들판 무리 35m·숨은 터 20m 밖·물결 자리·둥실이 길·평균 빠르기) ·
    /// 맡기(등급 전 ! 없음·밝은 !·시대 글자·F 로 맡아 🔷 따라감·이야기 인물에게 말 걸면 이야기로·흐린 !·안 따라가는 임무의 다음 대화로 이어 감) ·
    /// 편지 끝까지(둥실이 쫓기·둥지 무리·목록 단추로 이야기로 바꾸면 무리 치움·보상·다시 못 맡음) · 등대(도착·한빛·무리·봉수 불) ·
    /// 틈(석등 달·해·별·바꾸면 물결 치움·물결 둘) · 세이브 칸(맡음·끝·따라가는 임무, 옛 세이브 = 아무것도 안 맡음).
    /// 끝나면 이야기·세계 임무·따라가는 줄·돈·레벨·재료·자리를 되돌린다.
    /// </summary>
    public static class PlaytestGoWorldQuests
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var field = StoryField.Instance;
            var ui = StoryUi.Instance;
            if (fc == null || pc == null || field == null || ui == null) { Fail("FieldCombat/PlayerController/StoryField/StoryUi 없음"); return false; }
            bool off0 = StoryState.OffForTest;
            float cps0 = StoryUi.RevealCps;
            int ch0 = StoryState.Ch, st0 = StoryState.StepIndex, gold0 = GoldState.Gold, lv0 = PlayerStats.Level, exp0 = PlayerStats.Exp;
            var wqs0 = WorldQuestState.SnapshotSteps();
            var wqd0 = WorldQuestState.SnapshotDone();
            string track0 = StoryState.TrackId;
            var tal0 = TalentState.Snapshot();
            var mats0 = TalentState.SnapshotMats();
            var parts = new List<string>();
            try
            {
                StoryState.OffForTest = false;
                StoryUi.RevealCps = 0f;
                WorldQuestState.Restore(null, null);
                StoryState.Restore(0, 0);
                field.ResetForTest();
                CheckTable(parts);
                CheckPlaces(parts);
                CheckLetters(fc, pc, field, ui, parts);
                CheckLighthouse(pc, field, ui, parts);
                CheckRift(pc, field, ui, parts);
                CheckSave(parts);
            }
            finally
            {
                ui.ResetForTest();
                StoryUi.RevealCps = cps0;
                WorldQuestState.Restore(wqs0, wqd0);
                StoryState.Restore(ch0, st0);
                StoryState.RestoreTrack(track0);
                StoryState.OffForTest = off0;
                GoldState.Restore(gold0);
                PlayerStats.Restore(lv0, exp0);
                TalentState.Restore(tal0, mats0);
                field.ResetForTest();
                ui.ResetForTest();
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] world quests OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        // ---- 표·자리 ------------------------------------------------------------------------------------------

        private static char Letter(GoStory.StepType t) => t switch
        {
            GoStory.StepType.Talk => 'T', GoStory.StepType.Go => 'G', GoStory.StepType.Kill => 'K', GoStory.StepType.Light => 'L',
            GoStory.StepType.Chase => 'R', GoStory.StepType.Seal => 'S', GoStory.StepType.Defend => 'E', _ => '?',
        };

        private static void CheckTable(List<string> parts)
        {
            var Q = GoWorldQuests.Quests;
            if (Q.Length != 3 || WorldQuestState.Count != 3) { Fail($"임무 {Q.Length}"); return; }
            string[] want = { "TTRTKT", "TGTKLT", "TKTTSETT" };
            int[] ar = { 3, 8, 12 }, gold = { 600, 750, 900 };
            for (int q = 0; q < 3; q++)
            {
                string types = new string(Q[q].Steps.Select(s => Letter(s.Type)).ToArray());
                if (types != want[q] || Q[q].Ar != ar[q] || Q[q].Gold != gold[q]) Fail($"{Q[q].Id} 표 {types}·{Q[q].Ar}·{Q[q].Gold}");
                if (Q[q].Steps[0].Type != GoStory.StepType.Talk || Q[q].Steps[0].Npc != Q[q].Giver) Fail($"{Q[q].Id} 첫 단계가 맡길 사람과의 대화가 아니다");
                foreach (var st in Q[q].Steps)
                {
                    if ((st.Type == GoStory.StepType.Talk || st.Type == GoStory.StepType.Chase) && GoStory.NpcIndex(st.Npc) < 0) Fail("인물 없는 단계 " + st.TextKo);
                    if (st.Type == GoStory.StepType.Talk)
                        foreach (var l in st.Lines)
                            if (l.IsPick ? l.PickKo.Length != 2 : GoStory.NpcIndex(l.Who) < 0) Fail("대화 줄 " + st.TextKo);
                }
            }
            int wq = GoStory.Npcs.Count(n => n.Id.StartsWith("wq_"));
            if (wq != 7 || GoStory.Npcs.Where(n => n.Id.StartsWith("wq_")).Any(n => n.EraKo == null)) Fail($"세계 임무 인물 {wq}·시대 글자");
            parts.Add("표 셋·인물 일곱");
        }

        private static bool Walkable(Vector3 p)
        {
            var (gx, gy) = TestMapData.WorldToGrid(p);
            char t = TestMapData.TileAt(gx, gy);
            return TestMapData.Legend.TryGetValue(t, out var info) && info.Walkable && !TestMapData.IsWater(t);
        }

        private static void CheckPlaces(List<string> parts)
        {
            var story = GoStory.Npcs.Where(n => !n.Id.StartsWith("wq_")).Select(n => GoStory.GridPos(n.Gx, n.Gy)).ToList();
            foreach (var n in GoStory.Npcs.Where(n => n.Id.StartsWith("wq_")))
            {
                Vector3 p = GoStory.GridPos(n.Gx, n.Gy);
                if (!Walkable(p)) Fail($"{n.Id} 자리가 걷는 칸이 아니다");
                foreach (var s in story) if (GoStory.Flat(p, s) < 12f) Fail($"{n.Id} 가 이야기 인물 곁 {GoStory.Flat(p, s):0}m");
            }
            foreach (var w in GoWorldQuests.Quests)
                foreach (var st in w.Steps)
                {
                    if (st.Type != GoStory.StepType.Kill && st.Type != GoStory.StepType.Light && st.Type != GoStory.StepType.Seal && st.Type != GoStory.StepType.Defend && st.Type != GoStory.StepType.Go) continue;
                    Vector3 c = GoStory.StepPos(st);
                    if (!Walkable(c)) Fail($"{w.Id} {st.TextKo} 자리가 걷는 칸이 아니다");
                    if (st.Type == GoStory.StepType.Go) continue;
                    foreach (var g in FieldSpawner.GroupCenters()) if (GoStory.Flat(c, g) < 35f) Fail($"{w.Id} {st.TextKo} 가 들판 무리 곁 {GoStory.Flat(c, g):0}m");
                    foreach (var s in GoDomain.Sites) if (GoStory.Flat(c, s.Pos) < 20f) Fail($"{w.Id} {st.TextKo} 가 숨은 터 {s.Id} 곁");
                    if (st.Type == GoStory.StepType.Seal)
                        for (int i = 0; i < 3; i++) if (!Walkable(GoStory.SealLampPos(c, i))) Fail("틈 석등이 못 걷는 칸");
                    if (st.Type == GoStory.StepType.Defend)
                        for (int i = 0; i < st.Dirs.Length; i++) if (!Walkable(GoStory.DefendSlot(c, st.Dirs, 0, i))) Fail($"틈 물결 자리 {st.Dirs[i]}° 가 못 걷는 칸");
                }
            float len = 0f;
            int n2 = GoStory.RunCount("wq_dungsil");
            for (int i = 0; i < n2; i++) if (!Walkable(GoStory.RunPoint("wq_dungsil", i))) Fail($"둥실이 길 {i} 가 못 걷는 칸");
            for (int i = 1; i < n2; i++) len += GoStory.Flat(GoStory.RunPoint("wq_dungsil", i - 1), GoStory.RunPoint("wq_dungsil", i));
            float avg = len / (len / GoStory.ChaseSpeed + GoStory.ChasePause * (n2 - 2));
            if (avg <= 6f || avg >= 10f) Fail($"둥실이 평균 {avg:0.0}m/초");
            parts.Add($"자리(걷는 칸·무리 35m·숨은 터 20m·둥실이 평균 {avg:0.0}m/초)");
        }

        // ---- 공통 ---------------------------------------------------------------------------------------------

        private static void Near(PlayerController pc, string npc) => pc.Teleport(GoStory.NpcPos(npc) + new Vector3(2f, 0.4f, 0f));

        /// <summary>곁에서 대화 단추를 누르고 끝까지 — 대화 뒤 줄·단계를 본다.</summary>
        private static void Talk(PlayerController pc, StoryUi ui, string npc, string label)
        {
            Near(pc, npc);
            ui.Refresh();
            if (!ui.TalkShown) { Fail(label + " — 곁인데 대화 단추 없음"); return; }
            ui.TalkButton.onClick.Invoke();
            if (!ui.TalkOpen) { Fail(label + " — 대화 창이 안 열림"); return; }
            for (int guard = 0; guard < 20 && ui.TalkOpen; guard++)
            {
                if (ui.PickButton(0).gameObject.activeSelf) ui.PickButton(0).onClick.Invoke();
                else ui.NextButton.onClick.Invoke();
            }
            if (ui.TalkOpen) Fail(label + " — 대화가 안 끝남");
        }

        private static void Pulse(Vector3 c, float r)
        {
            var f = typeof(FieldCombat).GetField("ElementPulse", BindingFlags.Static | BindingFlags.NonPublic);
            (f?.GetValue(null) as System.Action<Vector3, float, GoElement>)?.Invoke(c, r, GoElement.Hydro);
        }

        private static void Kill(FieldEnemy e)
        {
            for (int i = 0; i < 6 && e.Alive; i++)
            {
                if (e.Shielded) e.SetShieldForTest(0f);
                e.TakeRaw(e.Hp + 99999f, Color.white);
            }
        }

        private static void ExpectQ(int q, int step, string label)
        {
            if (WorldQuestState.Step(q) != step) Fail($"{label} — 단계 {WorldQuestState.Step(q)} ≠ {step}");
        }

        // ---- 편지 ---------------------------------------------------------------------------------------------

        private static void CheckLetters(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui, List<string> parts)
        {
            PlayerStats.Restore(2, 0);
            field.Refresh();
            if (StoryField.BangOf("wq_postmaster") != 0 || field.BangShown("wq_postmaster", true)) Fail("여정 2 인데 묵호 머리 위 !");
            Near(pc, "wq_postmaster");
            ui.Refresh();
            if (ui.TalkShown) Fail("등급 전인데 묵호와 말이 됨");
            PlayerStats.Restore(3, 0);
            field.Refresh();
            if (StoryField.BangOf("wq_postmaster") != 2 || !field.BangShown("wq_postmaster", true)) Fail("여정 3 인데 묵호 밝은 ! 없음");
            ui.Refresh();
            string era = GoLocalization.T("era.past", "과거");
            if (!ui.TalkShown || !ui.TalkButton.GetComponentInChildren<TMPro.TextMeshProUGUI>().text.Contains(era)) Fail("묵호 대화 단추·시대 글자");
            Talk(pc, ui, "wq_postmaster", "편지 맡기");
            ExpectQ(0, 1, "편지 맡음");
            ui.Refresh();
            if (!StoryState.TrackingQuest || StoryState.Track != 0 || !ui.TrackText.StartsWith("🔷") || !ui.TrackText.Contains(GoWorldQuests.Name(GoWorldQuests.Quests[0])))
                Fail("맡은 편지를 안 따라감 " + ui.TrackText);
            if (StoryField.BangOf("wq_postmaster") != 0) Fail("맡은 뒤에도 묵호 !");
            // 이야기 인물에게 말 걸면 이야기로
            Near(pc, "elder");
            ui.Refresh();
            if (!ui.TalkShown || !ui.StartTalk() || StoryState.TrackingQuest) Fail("이야기 인물에게 말 걸었는데 이야기로 안 넘어감");
            ui.ResetForTest();
            field.Refresh();
            if (StoryField.BangOf("wq_rider") != 1 || !field.BangShown("wq_rider", false)) Fail("안 따라가는 편지의 다음 상대 다래에 흐린 ! 없음");
            Talk(pc, ui, "wq_rider", "다래(안 따라가는 임무 이어 감)");
            ExpectQ(0, 2, "다래 뒤");
            if (StoryState.Track != 0) Fail("다래와 말했는데 편지를 안 따라감");
            // 둥실이 쫓기 — 달리면 잡는다
            field.Refresh();
            if (!field.NpcShown("wq_dungsil")) Fail("둥실이가 안 섰다");
            Vector3 me = GoStory.RunPoint("wq_dungsil", 0) + new Vector3(-10f, 0f, 0f);
            bool caught = false;
            for (float t = 0f; t < 60f && !caught; t += 0.05f)
            {
                Vector3 to = field.ChasePos - me;
                to.y = 0f;
                if (to.magnitude > 0.01f) me += to.normalized * Mathf.Min(10f * 0.05f, to.magnitude);
                field.ChaseTick(me, 0.05f);
                caught = WorldQuestState.Step(0) != 2;
            }
            if (!caught) Fail("달렸는데 둥실이를 못 잡음");
            ExpectQ(0, 3, "둥실이 잡음");
            Talk(pc, ui, "wq_dungsil", "둥실이 달래기");
            ExpectQ(0, 4, "둥실이 뒤");                                                         // → 4 kill
            var nest = GoStory.StepPos(GoWorldQuests.Quests[0].Steps[4]);
            pc.Teleport(nest + new Vector3(0f, 0.4f, -20f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 3) { Fail($"둥지 무리 {field.Squad.Count} ≠ 3"); return; }
            // 목록 단추로 이야기로 바꾸면 무리를 치우고, 되돌리면 처음부터
            ui.ToggleList(true);
            if (!ui.ListText.Contains(GoLocalization.T("wq.state_track", "따라가는 중")) || !ui.TrackQuestButton(0).interactable || ui.TrackQuestButton(1).interactable) Fail("목록 — 따라가는 중·단추");
            ui.TrackQuestButton(0).onClick.Invoke();
            field.Refresh();
            if (StoryState.TrackingQuest || field.Squad.Count != 0) Fail("이야기로 바꿨는데 무리가 남음");
            if (!ui.TrackQuestButton(1).interactable) Fail("편지 따라가기 단추가 꺼짐");
            ui.TrackQuestButton(1).onClick.Invoke();
            ui.ToggleList(false);
            field.Check(pc.transform.position);
            if (!StoryState.TrackingQuest || field.Squad.Count != 3) { Fail($"되돌린 뒤 둥지 무리 {field.Squad.Count}"); return; }
            foreach (var e in new List<FieldEnemy>(field.Squad)) Kill(e);
            ExpectQ(0, 5, "둥지 무리");
            int gold = GoldState.Gold;
            Talk(pc, ui, "wq_postmaster", "편지 돌려주기");
            if (!WorldQuestState.Done(0) || GoldState.Gold != gold + 600 || StoryState.TrackingQuest) Fail("편지 끝·보상·이야기로");
            if (WorldQuestState.Take(0) || StoryField.BangOf("wq_postmaster") != 0) Fail("끝난 편지를 또 맡음");
            parts.Add("등급 전 ! 없음·밝은 !·시대 글자·맡아 🔷·이야기로 넘어감·흐린 !·이어 감·둥실이 잡음·목록 단추로 바꾸면 무리 치움·편지 보상 600");
        }

        // ---- 등대 ---------------------------------------------------------------------------------------------

        private static void CheckLighthouse(PlayerController pc, StoryField field, StoryUi ui, List<string> parts)
        {
            PlayerStats.Restore(8, 0);
            field.Refresh();
            Talk(pc, ui, "wq_researcher", "등대 맡기");
            ExpectQ(1, 1, "등대 맡음");
            field.Refresh();
            if (field.NpcShown("wq_hanbit")) Fail("도착 전에 한빛이 섰다");
            pc.Teleport(GoStory.GridPos(GoStory.LightGx, GoStory.LightGy) + new Vector3(3f, 0.4f, 0f));
            field.Check(pc.transform.position);
            ExpectQ(1, 2, "등대 터 도착");
            field.Refresh();
            if (!field.NpcShown("wq_hanbit")) Fail("등대 터에 한빛이 안 섰다");
            Talk(pc, ui, "wq_hanbit", "한빛");
            ExpectQ(1, 3, "한빛 뒤");
            field.Check(pc.transform.position);
            if (field.Squad.Count != 3) { Fail($"등대 무리 {field.Squad.Count}"); return; }
            foreach (var e in new List<FieldEnemy>(field.Squad)) Kill(e);
            ExpectQ(1, 4, "등대 무리");
            field.Refresh();
            var torch = field.AltarOfKey("wq1_4");
            if (torch == null || !torch.gameObject.activeSelf || torch.Lit) Fail("봉수대가 꺼진 채 안 섰다");
            Pulse(GoStory.GridPos(GoStory.LightGx, GoStory.LightGy), 2f);
            ExpectQ(1, 5, "봉수 불");
            field.Refresh();
            if (torch == null || !torch.Lit) Fail("봉수 불이 안 켜짐");
            int gold = GoldState.Gold;
            Talk(pc, ui, "wq_researcher", "물결에게 알리기");
            if (!WorldQuestState.Done(1) || GoldState.Gold != gold + 750) Fail("등대 끝·보상");
            field.Refresh();
            if (torch == null || !torch.Lit || field.NpcShown("wq_hanbit")) Fail("끝난 뒤 봉수 불·한빛");
            parts.Add("등대 도착·한빛·무리·봉수 불·보상 750");
        }

        // ---- 틈 -----------------------------------------------------------------------------------------------

        private static void CheckRift(PlayerController pc, StoryField field, StoryUi ui, List<string> parts)
        {
            PlayerStats.Restore(12, 0);
            field.Refresh();
            Talk(pc, ui, "wq_byeori", "틈 맡기");
            var kill = GoStory.StepPos(GoWorldQuests.Quests[2].Steps[1]);
            pc.Teleport(kill + new Vector3(0f, 0.4f, -20f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 3) { Fail($"틈 괴물 {field.Squad.Count}"); return; }
            foreach (var e in new List<FieldEnemy>(field.Squad)) Kill(e);
            Talk(pc, ui, "wq_byeori", "틈 조각 건네기");
            field.Refresh();
            if (!field.NpcShown("wq_dolsoe")) Fail("돌쇠가 안 섰다");
            Talk(pc, ui, "wq_dolsoe", "돌쇠");
            ExpectQ(2, 4, "돌쇠 뒤");                                                            // → 4 seal 달·해·별
            field.Refresh();
            int Lamp(string id) => System.Array.IndexOf(GoStory.SealLayout, id);
            Vector3 L(string id) => field.SealLampOfKey("wq2_4", Lamp(id)).transform.position;
            if (field.SealLampOfKey("wq2_4", 0) == null || !field.SealLampOfKey("wq2_4", 0).gameObject.activeSelf) { Fail("틈 석등이 안 섰다"); return; }
            Pulse(L("sun"), 1f);
            if (StoryState.Progress != 0) Fail("틈 — 해가 먼저 켜짐");
            Pulse(L("moon"), 1f);
            Pulse(L("sun"), 1f);
            Pulse(L("star"), 1f);
            ExpectQ(2, 5, "달·해·별");                                                           // → 5 defend
            Vector3 rift = GoStory.GridPos(GoStory.RiftGx, GoStory.RiftGy);
            pc.Teleport(rift + new Vector3(0f, 0.4f, 6f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            StoryState.SetTrack(-1);                                                            // 바꾸면 물결을 치운다
            field.Refresh();
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.Squad.Count != 0) Fail("이야기로 바꿨는데 물결이 남음");
            StoryState.SetTrack(2);
            field.Refresh();
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0) Fail("되돌린 뒤 물결이 처음부터 아님");
            for (int w = 0; w < 2; w++)
            {
                foreach (var e in new List<FieldEnemy>(field.Squad)) if (e != null && e.Alive) Kill(e);
                field.DefendTick(pc.transform.position, 0.1f);
            }
            ExpectQ(2, 6, "물결 둘");
            Talk(pc, ui, "wq_dolsoe", "문 선 뒤 돌쇠");
            int gold = GoldState.Gold;
            Talk(pc, ui, "wq_byeori", "별이 배웅");
            if (!WorldQuestState.Done(2) || GoldState.Gold != gold + 900) Fail("틈 끝·보상");
            parts.Add("틈 괴물·석등 달·해·별·바꾸면 물결 치움·물결 둘·보상 900");
        }

        // ---- 세이브 -------------------------------------------------------------------------------------------

        private static void CheckSave(List<string> parts)
        {
            WorldQuestState.Restore(new List<int> { 3, -1, 6 }, new List<bool> { false, false, true });
            StoryState.RestoreTrack("wq_letters");
            string json = SaveState.ToJson();
            if (!json.Contains("\"wqSteps\"") || !json.Contains("\"wqTrack\":\"wq_letters\"") && !json.Contains("\"wqTrack\": \"wq_letters\"")) Fail("세이브 JSON 에 세계 임무가 없다");
            var s = WorldQuestState.SnapshotSteps();
            var d = WorldQuestState.SnapshotDone();
            WorldQuestState.Restore(null, null);
            if (WorldQuestState.Taken(0) || WorldQuestState.Done(2)) Fail("옛 세이브인데 맡은 임무가 남음");
            WorldQuestState.Restore(s, d);
            StoryState.RestoreTrack("wq_letters");
            if (WorldQuestState.Step(0) != 3 || !WorldQuestState.Done(2) || StoryState.Track != 0) Fail("세이브 왕복");
            StoryState.RestoreTrack("wq_rift");
            if (StoryState.TrackingQuest) Fail("끝난 임무를 따라감");
            parts.Add("세이브 왕복·옛 세이브");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] world quests FAIL - {msg}");
        }
    }
}
