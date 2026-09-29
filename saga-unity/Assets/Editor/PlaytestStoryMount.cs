using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Story.Data;
using Saga.Story.Player;
using Saga.Story.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-15 탈것·비행(웹 사가스토리 T1·T2 진단 항목) — `PlaytestStorySlice` 가 부른다.
    /// 표(다섯·레벨·이동/점프 배율·이름) · 열림·고르기(레벨 3/4/12/16/22/30 — 안 골랐을 땐 지상 탈것 중 가장 빠른 것) ·
    /// 타고 내리기(줄에 매달려선 못 탐 · 공격/무예/맞으면 내림 · 실제 TriggerAttack 경로) · 지상 탈것의 실제 이동 배율과 점프 높이 ·
    /// 날개(중력 ×0.22 낙하 상한 · 공중 점프 = 날갯짓 0.16초 쉼 · 천장에서 멎음 · 두목 싸움터에선 못 남) ·
    /// `MountField`(모양·리더 높이·단추 켜고 끔) · 세이브(왕복·옛 세이브는 안 고른 채). 끝나면 레벨·직업·체력·탈것·자리를 되돌린다.
    /// </summary>
    public static class PlaytestStoryMount
    {
        private const string T = "[PlaytestStoryMount]";
        private static bool _ok;
        private static float _exp0;
        private static string _job0;
        private static readonly Vector3 Gap = new Vector3(10.5f, 0.1f, 0f); // 발판·줄·잡졸 사이 빈 자리(발판 9.0~13.0 사이, 잡졸 8·13 에서 각각 2.5m — 평타 사거리 2.2m 밖이라 진단 공격이 잡졸을 안 죽인다)

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            var pc = playerGo != null ? playerGo.GetComponent<StoryPlayerController>() : null;
            var mf = MountField.Instance;
            if (pc == null || mf == null) { Fail("StoryPlayerController/MountField 없음"); return false; }
            Vector3 start = playerGo.transform.position;
            int lv0 = StoryJobState.Level; _exp0 = StoryJobState.Exp; _job0 = StoryJobState.Job;
            string sel0 = StoryMounts.Snapshot();
            string json0 = StorySaveState.ToJson();
            var parts = new List<string>();
            try
            {
                StoryMounts.ResetForTest();
                CheckTable(parts);
                CheckUnlock(parts);
                CheckRide(pc, mf, parts);
                CheckGround(pc, parts);
                CheckFly(pc, parts);
                CheckField(pc, mf, parts);
                CheckSave(parts);
            }
            finally
            {
                StoryMounts.ResetForTest();
                StoryMounts.Restore(sel0);
                StoryJobState.Restore(lv0, _exp0, _job0);
                StoryPlayerHp.Refill();
                pc.ClearTestInput();
                pc.Teleport(start);
                pc.Step(0.05f);
                StorySaveState.ApplyJson(json0);
            }
            if (_ok) Debug.Log($"{T} OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static void SetLevel(int lv) => StoryJobState.Restore(lv, 0f, _job0);

        private static void CheckTable(List<string> parts)
        {
            var all = StoryMounts.All;
            if (all.Length != 5 || all.Select(m => m.Id).Distinct().Count() != 5 || all.Count(m => !m.IsFly) != 3 || all.Count(m => m.IsFly) != 2) Fail("탈것 표(지상 셋·비행 둘)");
            var want = new (string id, int lv, float mul, float jump, bool fly)[]
            {
                ("mt_farm", 4, 1.35f, 1.06f, false), ("mt_brown", 12, 1.55f, 1.10f, false), ("mt_white", 22, 1.75f, 1.14f, false),
                ("mt_crane", 16, 1.25f, 1f, true), ("mt_dragon", 30, 1.5f, 1f, true),
            };
            foreach (var w in want)
            {
                var m = StoryMounts.Def(w.id);
                if (m == null || m.Lv != w.lv || Mathf.Abs(m.Mul - w.mul) > 0.001f || Mathf.Abs(m.Jump - w.jump) > 0.001f || m.IsFly != w.fly) Fail($"탈것 {w.id} 수치");
                else if (m.Name.StartsWith("mount.") || m.Name.Length == 0) Fail($"탈것 {w.id} 이름 글이 없다");
            }
            if (Mathf.Abs(StoryMounts.FlyGrav - 0.22f) > 0.0001f || Mathf.Abs(StoryMounts.FlapVy - 0.8f) > 0.0001f || Mathf.Abs(StoryMounts.FlapCd - 0.16f) > 0.0001f || Mathf.Abs(StoryMounts.FlyFallCap - 2.8f) > 0.0001f) Fail("날개 수치(중력 0.22·날갯짓 0.8·0.16초·낙하 2.8m/초)");
            if (StoryMounts.Def("nope") != null || StoryMounts.Def(null) != null) Fail("없는 탈것 id");
            parts.Add("표(지상 셋·비행 둘·레벨·이동/점프 배율·날개 수치·이름)");
        }

        private static void CheckUnlock(List<string> parts)
        {
            SetLevel(3);
            if (StoryMounts.UnlockedList().Count != 0 || StoryMounts.Selected() != null) Fail("레벨 3 인데 탈것이 있다");
            if (StoryMounts.CanRide(false, out string why) || string.IsNullOrEmpty(why) || why.StartsWith("mount.")) Fail($"레벨 3 탈 수 없음 이유 '{why}'");
            SetLevel(4);
            if (StoryMounts.UnlockedList().Count != 1 || StoryMounts.Selected()?.Id != "mt_farm") Fail("레벨 4 = 농마 하나");
            SetLevel(12);
            if (StoryMounts.UnlockedList().Count != 2 || StoryMounts.Selected()?.Id != "mt_brown") Fail("레벨 12 = 갈색 말이 가장 빠른 지상 탈것");
            SetLevel(16);
            if (StoryMounts.UnlockedList().Count != 3 || StoryMounts.Selected()?.Id != "mt_brown") Fail("레벨 16 = 학이 열려도 안 골랐을 땐 지상 탈것");
            SetLevel(22);
            if (StoryMounts.Selected()?.Id != "mt_white") Fail("레벨 22 = 흰 말");
            SetLevel(30);
            if (StoryMounts.UnlockedList().Count != 5) Fail("레벨 30 = 다섯 모두");
            StoryMounts.Restore("");
            var order = new List<string>();
            for (int i = 0; i < 5; i++) order.Add(StoryMounts.Cycle().Id);
            if (string.Join(",", order) != "mt_crane,mt_dragon,mt_farm,mt_brown,mt_white") Fail($"고르기 차례 {string.Join(",", order)}");
            StoryMounts.Restore("mt_dragon");
            if (StoryMounts.Selected()?.Id != "mt_dragon" || StoryMounts.Sel != "mt_dragon") Fail("고른 탈것이 안 남음");
            SetLevel(16);
            if (StoryMounts.Selected()?.Id != "mt_brown") Fail("못 쓰게 된 탈것을 골라 둔 채 — 쓸 수 있는 가장 빠른 지상 탈것으로");
            StoryMounts.Restore("bogus");
            if (StoryMounts.Sel != "") Fail("모르는 id 를 골라 둠");
            StoryMounts.OffForTest = true;
            SetLevel(30);
            if (StoryMounts.UnlockedList().Count != 0) Fail("OffForTest 인데 탈것이 있다");
            StoryMounts.OffForTest = false;
            parts.Add("열림·고르기(레벨 3·4·12·16·22·30 — 안 골랐을 땐 지상 중 가장 빠른 것·Shift+H 차례·못 쓰게 된 것·모르는 id)");
        }

        private static void Ground(StoryPlayerController pc)
        {
            pc.ClearTestInput();
            pc.Teleport(Gap);
            for (int i = 0; i < 10; i++) pc.Step(0.02f);
        }

        private static void CheckRide(StoryPlayerController pc, MountField mf, List<string> parts)
        {
            SetLevel(22);
            StoryMounts.Restore("");
            Ground(pc);
            if (StoryMounts.TryRide(true, out string why) || StoryMounts.Riding != null || string.IsNullOrEmpty(why) || why.StartsWith("mount.")) Fail($"줄에 매달려 탔다/이유 '{why}'");
            if (!StoryMounts.TryRide(false, out _) || StoryMounts.Riding?.Id != "mt_white" || !StoryMounts.RidingGround || Mathf.Abs(StoryMounts.SpeedMul - 1.75f) > 0.001f || Mathf.Abs(StoryMounts.JumpMul - 1.14f) > 0.001f) Fail("흰 말 못 탐·배율");
            StoryMounts.Dismount();
            if (StoryMounts.Riding != null || StoryMounts.SpeedMul != 1f || StoryMounts.JumpMul != 1f) Fail("내렸는데 배율이 남음");

            // 실제 공격 경로 — 모바일 공격 단추(TriggerAttack) → 내린다
            StoryMounts.TryRide(false, out _);
            pc.TriggerAttack();
            if (StoryMounts.Riding != null) Fail("공격했는데 안 내림");
            // 무예(기합) 도 내린다
            StoryMounts.TryRide(false, out _);
            float mp0 = StoryCombat.Mp;
            StoryCombat.RestoreMp(StoryCombat.MpMaxCurrent);
            pc.TriggerBrace();
            StoryCombat.RestoreMp(mp0);
            if (StoryMounts.Riding != null) Fail("기합을 썼는데 안 내림");
            // 맞으면 내린다 — 실제 피해
            StoryPlayerHp.Refill();
            StoryMounts.TryRide(false, out _);
            if (!StoryPlayerHp.Hurt(1f)) Fail("피해가 안 들어감(무적?)");
            if (StoryMounts.Riding != null) Fail("맞았는데 안 내림");
            StoryPlayerHp.Refill();
            parts.Add("타고 내리기(줄에 매달려선 못 탐·공격/기합/맞으면 내림·내리면 배율 1)");
        }

        private static float Walked(StoryPlayerController pc, float startX, float dir)
        {
            pc.ClearTestInput();
            pc.Teleport(new Vector3(startX, 0.1f, 0f));
            for (int i = 0; i < 10; i++) pc.Step(0.02f);
            float x0 = pc.transform.position.x;
            pc.SetTestAxis(dir);
            for (int i = 0; i < 12; i++) pc.Step(0.02f);
            pc.ClearTestInput();
            return Mathf.Abs(pc.transform.position.x - x0);
        }

        /// <summary>땅에서 점프해 오른 최고 높이(m).</summary>
        private static float JumpApex(StoryPlayerController pc)
        {
            Ground(pc);
            float y0 = pc.transform.position.y;
            pc.TriggerJump();
            float top = y0;
            for (int i = 0; i < 150; i++)
            {
                pc.Step(0.01f);
                top = Mathf.Max(top, pc.transform.position.y);
            }
            return top - y0;
        }

        private static void CheckGround(StoryPlayerController pc, List<string> parts)
        {
            SetLevel(22);
            bool done = false;
            foreach (float sx in new[] { 10.5f, 5.5f, 18.5f, 27.5f })
                foreach (float dir in new[] { 1f, -1f })
                {
                    StoryMounts.Restore("");
                    float d0 = Walked(pc, sx, dir);
                    if (d0 < 1.3f) continue;
                    StoryMounts.Restore("mt_white");
                    StoryMounts.TryRide(false, out _);
                    float d1 = Walked(pc, sx, dir);
                    StoryMounts.Dismount();
                    if (Mathf.Abs(d1 / d0 - 1.75f) > 0.08f) continue;
                    done = true;
                    break;
                }
            if (!done) Fail("걷는 거리 배율이 ×1.75 인 자리·방향이 없다");
            // 점프 — v = 15 × 1.14 → 높이 v²/2g, 안 탄 채와의 비 = 1.14² ≈ 1.30
            StoryMounts.Restore("");
            float h0 = JumpApex(pc);
            StoryMounts.Restore("mt_white");
            StoryMounts.TryRide(false, out _);
            float h1 = JumpApex(pc);
            StoryMounts.Dismount();
            if (h0 < 2.5f || Mathf.Abs(h1 / h0 - 1.14f * 1.14f) > 0.06f) Fail($"점프 높이 안 탄 {h0:0.00} 탄 {h1:0.00} 비 {h1 / Mathf.Max(h0, 0.01f):0.00} ≠ 1.30");
            parts.Add("지상 탈것(같은 자리 0.24초 걷는 거리 ×1.75·점프 높이 ×1.14²)");
        }

        private static void CheckFly(StoryPlayerController pc, List<string> parts)
        {
            SetLevel(30);
            StoryMounts.Restore("mt_dragon");
            Ground(pc);
            if (!StoryMounts.TryRide(false, out _) || !StoryMounts.RidingFly || StoryMounts.JumpMul != 1f) Fail("용을 못 탐");
            float ceil = FieldMapData.HeightOfPx(StoryMounts.CeilPx);
            // 공중에 띄워 놓고 떨어뜨린다 — 낙하 상한 2.8m/초, 1초에 2.0~2.6m
            pc.Teleport(new Vector3(Gap.x, 6f, 0f));
            pc.Step(0.001f);
            float y0 = pc.transform.position.y;
            for (int i = 0; i < 100; i++) pc.Step(0.01f);
            float drop = y0 - pc.transform.position.y;
            if (drop < 2.0f || drop > 2.6f) Fail($"용 1초 낙하 {drop:0.00}m (중력 ×0.22·상한 2.8m/초 → 약 2.3)");
            // 일반 중력이면 같은 1초에 4m 넘게 떨어진다 — 안 탄 채 대조
            StoryMounts.Dismount();
            pc.Teleport(new Vector3(Gap.x, 6f, 0f));
            pc.Step(0.001f);
            y0 = pc.transform.position.y;
            for (int i = 0; i < 100; i++) pc.Step(0.01f);
            if (y0 - pc.transform.position.y < 4f) Fail("안 탄 채 낙하가 느리다(날개 중력이 새어 나옴)");
            // 날갯짓 — 공중에서 점프를 누르면 솟는다(0.5초 뒤 약 5m 높이 오름), 쉬는 0.16초 안 두 번째는 무시
            StoryMounts.TryRide(false, out _);
            pc.Teleport(new Vector3(Gap.x, 3f, 0f));
            pc.Step(0.001f);
            y0 = pc.transform.position.y;
            pc.TriggerJump();
            pc.Step(0.01f);
            float vyProbe = pc.transform.position.y - y0;
            pc.TriggerJump(); // 쉼 안 — 무시돼야
            for (int i = 0; i < 49; i++) pc.Step(0.01f);
            float rose = pc.transform.position.y - y0;
            if (vyProbe < 0.08f || rose < 4.4f || rose > 5.6f) Fail($"날갯짓 0.5초 오름 {rose:0.00}m (약 5.0)·첫 프레임 {vyProbe:0.000}");
            // 쉬는 시간이 지난 뒤 다시 누르면 또 솟는다 — 첫 날갯짓 1.2초 뒤(속도 약 2.5m/초로 느려졌을 때) 다시 누르면 0.1초에 1m 넘게 오른다
            pc.Teleport(new Vector3(Gap.x, 0.6f, 0f));
            pc.Step(0.001f);
            pc.TriggerJump();
            for (int i = 0; i < 120; i++) pc.Step(0.01f);
            float before = pc.transform.position.y;
            pc.TriggerJump();
            for (int i = 0; i < 10; i++) pc.Step(0.01f);
            float gain = pc.transform.position.y - before;
            if (gain < 0.9f) Fail($"쉼이 지난 뒤 날갯짓이 안 먹음 (0.1초 오름 {gain:0.00}m, 먹으면 약 1.15·안 먹으면 약 0.25)");
            // 천장 — 웹 y=20px 에서 멎는다
            for (int k = 0; k < 40; k++)
            {
                pc.TriggerJump();
                for (int i = 0; i < 20; i++) pc.Step(0.01f);
            }
            float top = pc.transform.position.y;
            if (top > ceil + 0.06f || top < ceil - 0.5f) Fail($"천장 {top:0.00}m ≠ {ceil:0.00}");
            // 두목 싸움터에선 못 난다 — 중력이 그대로고 날갯짓도 안 먹는다
            StoryMounts.BossHere = true;
            pc.Teleport(new Vector3(Gap.x, 6f, 0f));
            pc.Step(0.001f);
            y0 = pc.transform.position.y;
            pc.TriggerJump();
            for (int i = 0; i < 100; i++) pc.Step(0.01f);
            if (y0 - pc.transform.position.y < 4f) Fail("두목 싸움터인데 여전히 뜸/날갯짓");
            StoryMounts.BossHere = false;
            // 두목 싸움터 판정 — 들판 끝의 두목이 저 멀리 있으면 아니다, 곁이면 그렇다
            var boss = StoryEnemy.All.FirstOrDefault(e => e != null && e.IsBoss && !e.IsDead && !e.IsLabyrinthEnemy);
            if (boss != null)
            {
                if (MountField.BossNear(boss.transform.position.x - StoryMounts.BossArenaM - 2f)) Fail("두목이 멀리 있는데 싸움터");
                if (!MountField.BossNear(boss.transform.position.x - 5f)) Fail("두목 곁인데 싸움터가 아님");
            }
            // 착지 — 탄 채 땅에 선다
            StoryMounts.BossHere = false;
            pc.Teleport(new Vector3(Gap.x, 3f, 0f));
            for (int i = 0; i < 400 && !pc.transform.position.y.Equals(0f) && pc.transform.position.y > 0.2f; i++) pc.Step(0.01f);
            if (pc.transform.position.y > 0.3f || StoryMounts.Riding == null) Fail($"착지 y={pc.transform.position.y:0.00}·탄 채 {StoryMounts.Riding != null}");
            StoryMounts.Dismount();
            parts.Add($"날개(1초 낙하 약 2.3m·안 탄 채 4m+·날갯짓 0.5초 약 5m·쉼 0.16초·천장 {ceil:0.0}m·두목 싸움터에선 못 남·착지 후 탄 채)");
        }

        private static void CheckField(StoryPlayerController pc, MountField mf, List<string> parts)
        {
            SetLevel(30);
            StoryMounts.Restore("");
            Ground(pc);
            var refresh = typeof(MountField).GetMethod("RefreshUi", BindingFlags.NonPublic | BindingFlags.Instance);
            var late = typeof(MountField).GetMethod("LateUpdate", BindingFlags.NonPublic | BindingFlags.Instance);
            refresh.Invoke(mf, null);
            if (!mf.RideButton.gameObject.activeSelf) Fail("타기 단추가 안 보임");
            if (!mf.Toggle() || StoryMounts.Riding?.Id != "mt_white") Fail("Toggle 로 흰 말을 못 탐");
            late.Invoke(mf, null);
            refresh.Invoke(mf, null);
            if (!mf.BodyShown || mf.BodyId != "mt_white" || Mathf.Abs(mf.RiderLiftNow - MountField.LiftOf(StoryMounts.Riding)) > 0.001f) Fail("흰 말 몸·리더 높이");
            if (!mf.RideLabel.Contains(StoryMounts.Riding.Name) || mf.RideLabel.Contains("mount.")) Fail($"단추 글 '{mf.RideLabel}'");
            float baseY = pc.Visual != null ? pc.Visual.localPosition.y - MountField.LiftOf(StoryMounts.Riding) : 0f;
            mf.Toggle();
            late.Invoke(mf, null);
            if (mf.BodyShown || StoryMounts.Riding != null || (pc.Visual != null && Mathf.Abs(pc.Visual.localPosition.y - baseY) > 0.001f)) Fail("내렸는데 몸이 남거나 리더 높이가 안 돌아옴");
            StoryMounts.Restore("mt_farm");
            mf.Toggle();
            late.Invoke(mf, null);
            if (mf.BodyId != "mt_farm") Fail("농마 몸");
            if (!mf.CycleSelection() || StoryMounts.Riding?.Id != "mt_brown") Fail("Shift+H 로 타고 있는 채 갈색 말로 바뀌어야");
            late.Invoke(mf, null);
            if (mf.BodyId != "mt_brown") Fail("탈것을 바꿨는데 몸이 안 바뀜");
            StoryMounts.Restore("mt_crane");
            mf.Toggle();
            late.Invoke(mf, null);
            if (mf.BodyId != "mt_crane") Fail("학 몸");
            mf.CycleSelection();
            late.Invoke(mf, null);
            if (mf.BodyId != "mt_dragon") Fail("용 몸");
            mf.Toggle();
            late.Invoke(mf, null);
            if (mf.BodyShown) Fail("내린 뒤 몸이 남음");
            // 레벨 3 — 단추도 없다
            SetLevel(3);
            StoryMounts.Restore("");
            refresh.Invoke(mf, null);
            if (mf.RideButton.gameObject.activeSelf) Fail("레벨 3 인데 타기 단추가 보임");
            parts.Add("화면(타기 단추·농마/말/학/용 몸·리더 높이 돌아옴·Shift+H 로 바꿈·레벨 3 단추 없음)");
        }

        private static void CheckSave(List<string> parts)
        {
            SetLevel(30);
            StoryMounts.Restore("mt_crane");
            string json = StorySaveState.ToJson();
            if (!json.Contains("\"mountSel\":\"mt_crane\"") || !json.Contains("\"version\":6")) Fail("세이브에 탈것이 없다(버전은 6 그대로)");
            StoryMounts.Restore("");
            if (!StorySaveState.ApplyJson(json) || StoryMounts.Sel != "mt_crane" || StoryMounts.Riding != null) Fail("왕복 뒤 고른 탈것이 달라짐·탄 채 불러옴");
            string old = Regex.Replace(json, ",\"mountSel\":\"[^\"]*\"", "");
            if (old.Contains("mountSel")) { Fail("옛 세이브 가짜 만들기 실패"); return; }
            StoryMounts.Restore("mt_dragon");
            if (!StorySaveState.ApplyJson(old) || StoryMounts.Sel != "") Fail("탈것 없는 옛 세이브를 읽었는데 고른 채");
            parts.Add("세이브(고른 탈것 왕복·탄 채 저장 안 함·옛 세이브는 안 고른 채·버전 그대로)");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {msg}");
        }
    }
}
