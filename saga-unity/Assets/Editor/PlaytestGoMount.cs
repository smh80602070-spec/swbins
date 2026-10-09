using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-15 탈것·비행(웹 사가만리 ⑲-61·62 T1·T2 진단 항목) — `PlaytestHeadless` 가 부른다.
    /// 표(다섯·레벨·배율·이름) · 열림·고르기(레벨 4/5/15/20/30/40 — 안 골랐을 땐 지상 탈것 중 가장 빠른 것) · 타고 내리기(싸움 직후 못 탐·뛰면 내림) ·
    /// 실제 걷는 속도 배율(같은 자리에서 0.5초 — 안 탄 채 대 탄 채) · 비행(Space 오르기 속도 10m/초·손 떼면 그 높이·내리기·높이 한도 학 40 용 70·뜬 동안 속도 배율·이야기 단계에선 못 오르고 내려와 내림) ·
    /// `MountField`(모양·리더 높이·단추 켜고 끔) · 세이브(왕복·옛 세이브는 안 고른 채). 끝나면 레벨·탈것·이야기·자리·세이브 파일을 되돌린다.
    /// </summary>
    public static class PlaytestGoMount
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var mf = MountField.Instance;
            if (fc == null || pc == null || mf == null) { Fail("FieldCombat/PlayerController/MountField 없음"); return false; }
            int lv0 = PlayerStats.Level; long exp0 = PlayerStats.Exp;
            int ch0 = StoryState.Ch, st0 = StoryState.StepIndex;
            bool off0 = StoryState.OffForTest;
            string sel0 = GoMounts.Snapshot();
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            var parts = new List<string>();
            try
            {
                StoryState.OffForTest = true;
                GoMounts.ResetForTest();
                CheckTable(parts);
                CheckUnlock(parts);
                CheckRide(fc, pc, parts);
                CheckSpeed(pc, parts);
                CheckFly(pc, parts);
                CheckStoryBlock(pc, parts);
                CheckField(pc, mf, parts);
                CheckSave(savePath, parts);
            }
            finally
            {
                GoMounts.ResetForTest();
                GoMounts.Restore(sel0);
                PlayerStats.Restore(lv0, exp0);
                StoryState.Restore(ch0, st0);
                StoryState.OffForTest = off0;
                pc.ClearTestInput();
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
            }
            if (_ok) Debug.Log($"[{_tag}] mount OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static void CheckTable(List<string> parts)
        {
            var all = GoMounts.All;
            if (all.Length != 5 || all.Select(m => m.Id).Distinct().Count() != 5 || all.Count(m => !m.IsFly) != 3 || all.Count(m => m.IsFly) != 2) Fail("탈것 표(지상 셋·비행 둘)");
            var want = new (string id, int lv, float mul, bool fly, float f, float ceil)[] { ("mt_farm", 5, 1.6f, false, 0f, 0f), ("mt_brown", 15, 1.85f, false, 0f, 0f), ("mt_white", 30, 2.1f, false, 0f, 0f), ("mt_crane", 20, 1.5f, true, 2.6f, 40f), ("mt_dragon", 40, 1.7f, true, 3.4f, 70f) };
            foreach (var w in want)
            {
                var m = GoMounts.Def(w.id);
                if (m == null || m.Lv != w.lv || Mathf.Abs(m.Mul - w.mul) > 0.001f || m.IsFly != w.fly || Mathf.Abs(m.Fly - w.f) > 0.001f || Mathf.Abs(m.Ceil - w.ceil) > 0.001f) Fail($"탈것 {w.id} 수치");
                else if (m.Name.StartsWith("mount.") || m.Name.Length == 0) Fail($"탈것 {w.id} 이름 글이 없다");
            }
            if (GoMounts.Def("nope") != null || GoMounts.Def(null) != null) Fail("없는 탈것 id");
            parts.Add("표(지상 셋·비행 둘·레벨·배율·높이 한도·이름)");
        }

        private static void CheckUnlock(List<string> parts)
        {
            PlayerStats.Restore(4, 0);
            if (GoMounts.UnlockedList().Count != 0 || GoMounts.Selected() != null) Fail("레벨 4 인데 탈것이 있다");
            if (GoMounts.CanRide(Time.time, out string why) || string.IsNullOrEmpty(why) || why.StartsWith("mount.")) Fail($"레벨 4 탈 수 없음 이유 '{why}'");
            PlayerStats.Restore(5, 0);
            if (GoMounts.UnlockedList().Count != 1 || GoMounts.Selected()?.Id != "mt_farm") Fail("레벨 5 = 농마 하나");
            PlayerStats.Restore(15, 0);
            if (GoMounts.UnlockedList().Count != 2 || GoMounts.Selected()?.Id != "mt_brown") Fail("레벨 15 = 갈색 말이 가장 빠른 지상 탈것");
            PlayerStats.Restore(20, 0);
            if (GoMounts.UnlockedList().Count != 3 || GoMounts.Selected()?.Id != "mt_brown") Fail("레벨 20 = 학이 열려도 안 골랐을 땐 지상 탈것");
            PlayerStats.Restore(30, 0);
            if (GoMounts.Selected()?.Id != "mt_white") Fail("레벨 30 = 흰 말");
            PlayerStats.Restore(40, 0);
            if (GoMounts.UnlockedList().Count != 5) Fail("레벨 40 = 다섯 모두");
            // 고르기 — Shift+H 차례
            GoMounts.Restore("");
            var order = new List<string>();
            for (int i = 0; i < 5; i++) order.Add(GoMounts.Cycle().Id);
            if (string.Join(",", order) != "mt_crane,mt_dragon,mt_farm,mt_brown,mt_white") Fail($"고르기 차례 {string.Join(",", order)}");
            GoMounts.Restore("mt_dragon");
            if (GoMounts.Selected()?.Id != "mt_dragon" || GoMounts.Sel != "mt_dragon") Fail("고른 탈것이 안 남음");
            PlayerStats.Restore(20, 0);
            if (GoMounts.Selected()?.Id != "mt_brown") Fail("못 쓰게 된 탈것을 골라 둔 채 — 쓸 수 있는 가장 빠른 지상 탈것으로");
            GoMounts.Restore("bogus");
            if (GoMounts.Sel != "") Fail("모르는 id 를 골라 둠");
            GoMounts.OffForTest = true;
            PlayerStats.Restore(40, 0);
            if (GoMounts.UnlockedList().Count != 0) Fail("OffForTest 인데 탈것이 있다");
            GoMounts.OffForTest = false;
            parts.Add("열림·고르기(레벨 4·5·15·20·30·40 — 안 골랐을 땐 지상 중 가장 빠른 것·Shift+H 차례·못 쓰게 된 것·모르는 id)");
        }

        private static void CheckRide(FieldCombat fc, PlayerController pc, List<string> parts)
        {
            PlayerStats.Restore(30, 0);
            GoMounts.Restore("");
            GoMounts.LastCombatAt = Time.time; // 방금 싸움 — 못 탄다
            if (GoMounts.TryRide(Time.time, out string why) || GoMounts.Riding != null || string.IsNullOrEmpty(why)) Fail("싸움 직후인데 탐");
            GoMounts.LastCombatAt = Time.time - GoMounts.CombatCalmSec - 0.1f;
            if (!GoMounts.TryRide(Time.time, out _) || GoMounts.Riding?.Id != "mt_white" || !GoMounts.RidingGround || Mathf.Abs(GoMounts.GroundMul - 2.1f) > 0.001f) Fail("가라앉은 뒤 못 탐·배율");
            GoMounts.Dismount();
            if (GoMounts.Riding != null || GoMounts.GroundMul != 1f || GoMounts.FlyMul != 1f) Fail("내렸는데 배율이 남음");
            // 뛰면 지상 탈것에서 내린다
            pc.Teleport(GoStory.GridPos(3.7f, 4.1f) + new Vector3(0f, 0.3f, 0f));
            pc.Step(0.1f);
            GoMounts.TryRide(Time.time, out _);
            pc.RequestJump();
            pc.Step(0.02f);
            if (GoMounts.Riding != null) Fail("뛰었는데 지상 탈것에서 안 내림");
            parts.Add("타고 내리기(싸움 직후 못 탐·가라앉은 뒤 탐·배율·뛰면 내림)");
        }

        /// <summary>같은 자리에서 0.5초 걸은 거리 — 막히지 않은 방향(안 탄 채 ≥ 2.8m)을 골라 재고 탄 채와 견준다.</summary>
        private static float Walked(PlayerController pc, Vector3 start, Vector2 dir)
        {
            pc.Teleport(start);
            pc.Step(0.1f);
            pc.Teleport(start);
            pc.SetTestInput(dir, false);
            for (int i = 0; i < 25; i++) pc.Step(0.02f);
            pc.ClearTestInput();
            Vector3 d = pc.transform.position - start; d.y = 0f;
            return d.magnitude;
        }

        private static void CheckSpeed(PlayerController pc, List<string> parts)
        {
            PlayerStats.Restore(30, 0);
            // U-0070 — 예전 +0.3m 는 Teleport 의 땅 판정 경계(<0.3)와 같아 부동소수 끝자리가 땅/공중을 갈랐다(Windows 대상은 지형, 안드로이드는
            // 발밑 그림자 판에 맞아 끝자리가 달라 Windows 에서만 "공중 → 말에서 내림"). 발밑을 재서 실제 땅 + 0.05m 에서 시작한다.
            Vector3 start = GoStory.GridPos(3.7f, 4.1f);
            float groundY = float.MaxValue, best = float.MaxValue; // 주인공 제 캡슐(그 자리에 서 있을 수 있다)은 건너뛴다
            foreach (var h in Physics.RaycastAll(start + Vector3.up * 5f, Vector3.down, 20f, ~0, QueryTriggerInteraction.Ignore))
                if (!h.collider.transform.IsChildOf(pc.transform) && h.distance < best) { best = h.distance; groundY = h.point.y; }
            if (groundY != float.MaxValue) start.y = groundY;
            start.y += 0.05f;
            bool done = false;
            foreach (var dir in new[] { new Vector2(0f, 1f), new Vector2(0f, -1f), new Vector2(1f, 0f), new Vector2(-1f, 0f) })
            {
                GoMounts.Restore("");
                float d0 = Walked(pc, start, dir);
                if (d0 < 2.8f) continue;
                GoMounts.Restore("mt_white");
                if (!GoMounts.TryRide(Time.time + 100f, out string why)) { Fail($"흰 말에 못 탐 — {why}"); return; }
                float d1 = Walked(pc, start, dir);
                GoMounts.Dismount();
                float ratio = d1 / d0;
                if (Mathf.Abs(ratio - 2.1f) > 0.08f) Fail($"흰 말 걷는 거리 배율 {ratio:0.00} ≠ 2.1 (안 탄 {d0:0.00}m · 탄 {d1:0.00}m)");
                done = true;
                break;
            }
            if (!done) Fail("막히지 않은 방향이 없어 속도를 못 쟀다");
            pc.Teleport(start);
            parts.Add("걷는 속도 배율(같은 자리 0.5초 — 흰 말 ×2.1)");
        }

        private static float Alt(PlayerController pc) => pc.HeightAboveGround();

        private static void CheckFly(PlayerController pc, List<string> parts)
        {
            PlayerStats.Restore(40, 0);
            Vector3 start = GoStory.GridPos(3.7f, 4.1f) + new Vector3(0f, 0.3f, 0f);
            pc.Teleport(start);
            pc.Step(0.1f);
            GoMounts.Restore("mt_dragon");
            if (!GoMounts.TryRide(Time.time + 100f, out _) || !GoMounts.RidingFly || Mathf.Abs(GoMounts.FlyMul - 3.4f) > 0.001f) Fail("용을 못 탐");
            // 오르기 — Space(오름 입력) 3초 = 10m/초 → 약 30m
            GoMounts.Lift = 1f;
            for (int i = 0; i < 30; i++) pc.Step(0.1f);
            float h = Alt(pc);
            if (pc.Mode != PlayerController.MoveMode.Fly || h < 24f || h > 32f) Fail($"용 3초 오름 {h:0.0}m Mode {pc.Mode}");
            // 손 떼면 그 높이
            GoMounts.Lift = 0f;
            for (int i = 0; i < 10; i++) pc.Step(0.1f);
            if (Mathf.Abs(Alt(pc) - h) > 0.6f || pc.Mode != PlayerController.MoveMode.Fly) Fail($"손 뗐는데 높이가 변함 {h:0.0} → {Alt(pc):0.0}");
            // 뜬 동안 속도 배율 = 걷기 6 × 3.4 = 20.4m/초
            Vector3 p0 = pc.transform.position;
            pc.SetTestInput(new Vector2(0f, 1f), false);
            for (int i = 0; i < 25; i++) pc.Step(0.02f);
            pc.ClearTestInput();
            Vector3 dd = pc.transform.position - p0; dd.y = 0f;
            if (Mathf.Abs(dd.magnitude - 10.2f) > 0.6f) Fail($"용 뜬 속도 0.5초 {dd.magnitude:0.0}m ≠ 10.2");
            // 높이 한도 — 용 70m
            GoMounts.Lift = 1f;
            for (int i = 0; i < 90; i++) pc.Step(0.1f);
            if (Alt(pc) > 71f || Alt(pc) < 68f) Fail($"용 높이 한도 {Alt(pc):0.0}m ≠ 70");
            // 내리기 — Z(내림 입력) → 땅에 닿으면 탄 채 걷는다
            GoMounts.Lift = -1f;
            for (int i = 0; i < 80 && pc.Mode == PlayerController.MoveMode.Fly; i++) pc.Step(0.1f);
            if (pc.Mode != PlayerController.MoveMode.Ground || GoMounts.Riding == null || Alt(pc) > 0.5f) Fail($"착지 Mode {pc.Mode}·탄 채 {GoMounts.Riding != null}·높이 {Alt(pc):0.0}");
            GoMounts.Lift = 0f;
            // 학 — 40m 한도·땅에서 걷는 배율 1.5
            GoMounts.Restore("mt_crane");
            GoMounts.TryRide(Time.time + 100f, out _);
            if (Mathf.Abs(GoMounts.GroundMul - 1.5f) > 0.001f || Mathf.Abs(GoMounts.FlyMul - 2.6f) > 0.001f) Fail("학 배율");
            GoMounts.Lift = 1f;
            for (int i = 0; i < 70; i++) pc.Step(0.1f);
            if (Alt(pc) > 41f || Alt(pc) < 38f) Fail($"학 높이 한도 {Alt(pc):0.0}m ≠ 40");
            // 타고 있는 중 내리면 그 자리에서 떨어진다(Mode 가 Fly 를 벗어남)
            GoMounts.Dismount();
            pc.Step(0.1f);
            if (pc.Mode == PlayerController.MoveMode.Fly) Fail("내렸는데 계속 남");
            for (int i = 0; i < 120 && !pc.OnFoot; i++) pc.Step(0.1f);
            GoMounts.Lift = 0f;
            parts.Add("비행(용 오름 10m/초·손 떼면 그 높이·뜬 속도 ×3.4·한도 70/학 40·착지 후 탄 채·내리면 떨어짐)");
        }

        private static void CheckStoryBlock(PlayerController pc, List<string> parts)
        {
            PlayerStats.Restore(70, 0);
            StoryState.OffForTest = false;
            try
            {
                Vector3 start = GoStory.GridPos(3.7f, 4.1f) + new Vector3(0f, 0.3f, 0f);
                pc.Teleport(start);
                pc.Step(0.1f);
                GoMounts.Restore("mt_dragon");
                StoryState.Restore(29, 0); // 30장 첫 단계(대화) — 날 수 있다
                if (GoMounts.StoryBlocked) Fail("대화 단계에서 막힘");
                GoMounts.TryRide(Time.time + 100f, out _);
                GoMounts.Lift = 1f;
                for (int i = 0; i < 20; i++) pc.Step(0.1f);
                if (pc.Mode != PlayerController.MoveMode.Fly || Alt(pc) < 15f) Fail("대화 단계에서 못 오름");
                // 이야기가 결정 짐승(kill) 단계가 되면 — 못 오르고 천천히 내려와 땅에 닿으면 내린다
                StoryState.Restore(29, 2);
                if (!GoMounts.StoryBlocked) Fail("kill 단계인데 안 막힘");
                float h0 = Alt(pc);
                pc.Step(0.5f);
                float dropped = h0 - Alt(pc);
                if (dropped < 5.5f || dropped > 8.5f) Fail($"이야기 구간 내려오는 속도 0.5초 {dropped:0.0}m ≠ 7(14m/초)");
                for (int i = 0; i < 80 && GoMounts.Riding != null; i++) pc.Step(0.1f);
                if (GoMounts.Riding != null || pc.Mode == PlayerController.MoveMode.Fly) Fail("이야기 구간에서 땅에 닿았는데 안 내림");
                // 막힌 채 땅에서 Space(오름) — 못 뜬다
                GoMounts.TryRide(Time.time + 100f, out _);
                GoMounts.Lift = 1f;
                for (int i = 0; i < 10; i++) pc.Step(0.1f);
                if (pc.Mode == PlayerController.MoveMode.Fly || Alt(pc) > 1f) Fail("이야기 구간인데 땅에서 떴다");
                // 단계 종류 여덟 — 넘는 것만 막힘
                var blocked = new[] { GoStory.StepType.Sky, GoStory.StepType.Climb, GoStory.StepType.Sail, GoStory.StepType.Follow, GoStory.StepType.Chase, GoStory.StepType.Duel, GoStory.StepType.Defend, GoStory.StepType.Kill };
                int n = 0;
                foreach (var ch in GoStory.Chapters) foreach (var s in ch.Steps) if (blocked.Contains(s.Type)) n++;
                if (n < 20) Fail($"막히는 단계 수 {n}");
            }
            finally
            {
                GoMounts.Lift = 0f;
                GoMounts.Dismount();
                StoryState.OffForTest = true;
            }
            for (int i = 0; i < 100 && !pc.OnFoot; i++) pc.Step(0.1f);
            parts.Add("이야기 구간(kill 단계 — 못 오르고 14m/초로 내려와 땅에서 내림·대화 단계는 남)");
        }

        private static void CheckField(PlayerController pc, MountField mf, List<string> parts)
        {
            PlayerStats.Restore(30, 0);
            GoMounts.Restore("");
            GoMounts.LastCombatAt = -999f;
            Vector3 start = GoStory.GridPos(3.7f, 4.1f) + new Vector3(0f, 0.3f, 0f);
            pc.Teleport(start);
            pc.Step(0.1f);
            var refresh = typeof(MountField).GetMethod("RefreshUi", BindingFlags.NonPublic | BindingFlags.Instance);
            var late = typeof(MountField).GetMethod("LateUpdate", BindingFlags.NonPublic | BindingFlags.Instance);
            refresh.Invoke(mf, null);
            if (!mf.RideButton.gameObject.activeSelf || mf.UpButton.gameObject.activeSelf || mf.DownButton.gameObject.activeSelf) Fail("지상 탈것: 타기 단추만 보여야");
            if (!mf.Toggle() || GoMounts.Riding?.Id != "mt_white") Fail("Toggle 로 흰 말을 못 탐");
            late.Invoke(mf, null);
            refresh.Invoke(mf, null);
            if (!mf.BodyShown || mf.BodyId != "mt_white" || Mathf.Abs(mf.RiderLiftNow - MountField.LiftOf(GoMounts.Riding)) > 0.001f) Fail("흰 말 몸·리더 높이");
            if (!mf.RideLabel.Contains(GoMounts.Riding.Name) || !mf.RideLabel.Contains("H")) Fail($"단추 글 '{mf.RideLabel}'");
            float baseY = pc.Visual != null ? pc.Visual.localPosition.y - MountField.LiftOf(GoMounts.Riding) : 0f;
            mf.Toggle();
            late.Invoke(mf, null);
            if (mf.BodyShown || GoMounts.Riding != null || (pc.Visual != null && Mathf.Abs(pc.Visual.localPosition.y - baseY) > 0.001f)) Fail("내렸는데 몸이 남거나 리더 높이가 안 돌아옴");
            // 비행 탈것 — 단추 셋·모양 바뀜
            PlayerStats.Restore(40, 0);
            GoMounts.Restore("mt_crane");
            mf.Toggle();
            late.Invoke(mf, null);
            refresh.Invoke(mf, null);
            if (!mf.BodyShown || mf.BodyId != "mt_crane" || !mf.UpButton.gameObject.activeSelf || !mf.DownButton.gameObject.activeSelf) Fail("학: 몸·▲▼ 단추");
            if (!mf.CycleSelection() || GoMounts.Riding?.Id != "mt_dragon") Fail("Shift+H 로 타고 있는 채 용으로 바뀌어야");
            late.Invoke(mf, null);
            if (mf.BodyId != "mt_dragon") Fail("탈것을 바꿨는데 몸이 안 바뀜");
            mf.Toggle();
            late.Invoke(mf, null);
            refresh.Invoke(mf, null);
            if (mf.UpButton.gameObject.activeSelf || mf.BodyShown) Fail("내린 뒤 ▲▼ 단추·몸이 남음");
            // 레벨 4 — 단추도 없다
            PlayerStats.Restore(4, 0);
            GoMounts.Restore("");
            refresh.Invoke(mf, null);
            if (mf.RideButton.gameObject.activeSelf) Fail("레벨 4 인데 타기 단추가 보임");
            parts.Add("화면(지상 = 타기 단추만·비행 = ▲▼ 더·말/학/용 몸 셋·리더 높이 돌아옴·Shift+H 로 바꿈·레벨 4 단추 없음)");
        }

        private static void CheckSave(string savePath, List<string> parts)
        {
            PlayerStats.Restore(40, 0);
            GoMounts.Restore("mt_crane");
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"mountSel\":\"mt_crane\"") || !json.Contains("\"version\":29")) Fail("세이브에 탈것이 없다(버전은 28 그대로)");
            GoMounts.Restore("");
            if (!SaveState.TryLoad() || GoMounts.Sel != "mt_crane" || GoMounts.Riding != null) Fail("왕복 뒤 고른 탈것이 달라짐·탄 채 불러옴");
            string old = Regex.Replace(json, ",\"mountSel\":\"[^\"]*\"", "");
            if (old.Contains("mountSel")) { Fail("옛 세이브 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, old);
            GoMounts.Restore("mt_dragon");
            if (!SaveState.TryLoad() || GoMounts.Sel != "") Fail("탈것 없는 옛 세이브를 읽었는데 고른 채");
            parts.Add("세이브(고른 탈것 왕복·탄 채 저장 안 함·옛 세이브는 안 고른 채·버전 그대로)");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] mount FAIL - {msg}");
        }
    }
}
