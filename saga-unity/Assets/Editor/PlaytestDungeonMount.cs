using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-15 탈것·비행(웹 사가블로 T1·T2 진단 항목) — `PlaytestDungeonHeadless` 가 부른다.
    /// 표(다섯·레벨·배율·높이 한도·이름 — 한도는 방 벽 4m 아래) · 열림·고르기(레벨 4/5/14/18/26/34 — 안 골랐을 땐 지상 탈것 중 가장 빠른 것) ·
    /// 타고 내리기(던전 층 방·바깥은 못 탐 · 칸 밖으로 나가면·맞으면·적을 치면·뛰면 내림) · 실제 걷는 속도 배율(같은 자리 0.5초) ·
    /// 비행(X 오르기 5m/초·손 떼면 그 높이·내리기·높이 한도·뜬 속도·칸 가장자리에서 막힘·착지 후 탄 채·내리면 떨어짐) ·
    /// `MountField`(모양·리더 높이·단추 켜고 끔) · 세이브(왕복·옛 세이브는 안 고른 채). 끝나면 레벨·탈것·자리·세이브 상태를 되돌린다.
    /// </summary>
    public static class PlaytestDungeonMount
    {
        private const string T = "[PlaytestDungeonHeadless] mount";
        private static bool _ok;
        private static int _lv0, _exp0, _hp0, _gold0;
        private static string _weapon0, _gem0;

        private static readonly Vector3 Open = new Vector3(0f, 0.1f, 0f);        // 가운데 칸(모루골) 방 한가운데 근처
        private static readonly Vector3 Dungeon = new Vector3(0f, 0.1f, 120f);   // 던전 층 방(칸 밖)

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            var pc = playerGo != null ? playerGo.GetComponent<PlayerController>() : null;
            var mf = MountField.Instance;
            if (pc == null || mf == null) { Fail("PlayerController/MountField 없음"); return false; }
            Vector3 start = playerGo.transform.position;
            _lv0 = HeroState.Level; _exp0 = HeroState.Exp; _hp0 = HeroState.Hp; _gold0 = HeroState.Gold;
            _weapon0 = HeroState.EquippedWeaponId; _gem0 = HeroState.SocketedGemId;
            string sel0 = DungeonMounts.Snapshot();
            string json0 = SaveState.ToJson();
            var parts = new List<string>();
            try
            {
                DungeonMounts.ResetForTest();
                CheckTable(parts);
                CheckUnlock(parts);
                CheckRide(pc, mf, parts);
                CheckSpeed(pc, parts);
                CheckFly(pc, parts);
                CheckField(pc, mf, parts);
                CheckSave(parts);
            }
            finally
            {
                DungeonMounts.Lift = 0f;
                DungeonMounts.ResetForTest();
                DungeonMounts.Restore(sel0);
                SetLevel(_lv0);
                HeroState.Restore(_lv0, _exp0, _hp0, _gold0, _weapon0, _gem0);
                pc.ClearTestInput();
                pc.Teleport(start);
                pc.Step(0.05f);
                SaveState.ApplyJson(json0);
            }
            if (_ok) Debug.Log($"{T} OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static void SetLevel(int lv) => HeroState.Restore(lv, 0, _hp0, _gold0, _weapon0, _gem0);

        private static void CheckTable(List<string> parts)
        {
            var all = DungeonMounts.All;
            if (all.Length != 5 || all.Select(m => m.Id).Distinct().Count() != 5 || all.Count(m => !m.IsFly) != 3 || all.Count(m => m.IsFly) != 2) Fail("탈것 표(지상 셋·비행 둘)");
            var want = new (string id, int lv, float mul, bool fly, float f, float ceil)[]
            {
                ("mt_farm", 5, 1.5f, false, 0f, 0f), ("mt_brown", 14, 1.75f, false, 0f, 0f), ("mt_white", 26, 2.0f, false, 0f, 0f),
                ("mt_crane", 18, 1.3f, true, 1.6f, 3.2f), ("mt_dragon", 34, 1.4f, true, 1.9f, 3.8f),
            };
            foreach (var w in want)
            {
                var m = DungeonMounts.Def(w.id);
                if (m == null || m.Lv != w.lv || Mathf.Abs(m.Mul - w.mul) > 0.001f || m.IsFly != w.fly || Mathf.Abs(m.Fly - w.f) > 0.001f || Mathf.Abs(m.Ceil - w.ceil) > 0.001f) Fail($"탈것 {w.id} 수치");
                else if (m.Name.StartsWith("mount.") || m.Name.Length == 0) Fail($"탈것 {w.id} 이름 글이 없다");
                if (m != null && m.IsFly && m.Ceil >= 4f) Fail($"{w.id} 높이 한도가 방 벽(4m)을 넘는다 — 벽 너머는 바닥이 없다");
            }
            if (DungeonMounts.Def("nope") != null || DungeonMounts.Def(null) != null) Fail("없는 탈것 id");
            parts.Add("표(지상 셋·비행 둘·레벨·배율·높이 한도 벽 아래·이름)");
        }

        private static void CheckUnlock(List<string> parts)
        {
            SetLevel(4);
            if (DungeonMounts.UnlockedList().Count != 0 || DungeonMounts.Selected() != null) Fail("레벨 4 인데 탈것이 있다");
            if (DungeonMounts.CanRide(Open, out string why) || string.IsNullOrEmpty(why) || why.StartsWith("mount.")) Fail($"레벨 4 탈 수 없음 이유 '{why}'");
            SetLevel(5);
            if (DungeonMounts.UnlockedList().Count != 1 || DungeonMounts.Selected()?.Id != "mt_farm") Fail("레벨 5 = 농마 하나");
            SetLevel(14);
            if (DungeonMounts.UnlockedList().Count != 2 || DungeonMounts.Selected()?.Id != "mt_brown") Fail("레벨 14 = 갈색 말이 가장 빠른 지상 탈것");
            SetLevel(18);
            if (DungeonMounts.UnlockedList().Count != 3 || DungeonMounts.Selected()?.Id != "mt_brown") Fail("레벨 18 = 학이 열려도 안 골랐을 땐 지상 탈것");
            SetLevel(26);
            if (DungeonMounts.Selected()?.Id != "mt_white") Fail("레벨 26 = 흰 말");
            SetLevel(34);
            if (DungeonMounts.UnlockedList().Count != 5) Fail("레벨 34 = 다섯 모두");
            DungeonMounts.Restore("");
            var order = new List<string>();
            for (int i = 0; i < 5; i++) order.Add(DungeonMounts.Cycle().Id);
            if (string.Join(",", order) != "mt_crane,mt_dragon,mt_farm,mt_brown,mt_white") Fail($"고르기 차례 {string.Join(",", order)}");
            DungeonMounts.Restore("mt_dragon");
            if (DungeonMounts.Selected()?.Id != "mt_dragon" || DungeonMounts.Sel != "mt_dragon") Fail("고른 탈것이 안 남음");
            SetLevel(18);
            if (DungeonMounts.Selected()?.Id != "mt_brown") Fail("못 쓰게 된 탈것을 골라 둔 채 — 쓸 수 있는 가장 빠른 지상 탈것으로");
            DungeonMounts.Restore("bogus");
            if (DungeonMounts.Sel != "") Fail("모르는 id 를 골라 둠");
            DungeonMounts.OffForTest = true;
            SetLevel(34);
            if (DungeonMounts.UnlockedList().Count != 0) Fail("OffForTest 인데 탈것이 있다");
            DungeonMounts.OffForTest = false;
            parts.Add("열림·고르기(레벨 4·5·14·18·26·34 — 안 골랐을 땐 지상 중 가장 빠른 것·Shift+H 차례·못 쓰게 된 것·모르는 id)");
        }

        private static void Update(MountField mf) =>
            typeof(MountField).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance).Invoke(mf, null);

        private static void CheckRide(PlayerController pc, MountField mf, List<string> parts)
        {
            SetLevel(26);
            DungeonMounts.Restore("");
            pc.Teleport(Open);
            pc.Step(0.1f);
            if (!DungeonMounts.TryRide(pc.transform.position, out _) || DungeonMounts.Riding?.Id != "mt_white" || !DungeonMounts.RidingGround || Mathf.Abs(DungeonMounts.GroundMul - 2f) > 0.001f) Fail("칸 안에서 못 탐·배율");
            DungeonMounts.Dismount();
            if (DungeonMounts.Riding != null || DungeonMounts.GroundMul != 1f || DungeonMounts.FlyMul != 1f) Fail("내렸는데 배율이 남음");

            // 던전 층 방·능묘 속·난입 방 — 칸 밖이라 못 탄다
            foreach (var p in new[] { Dungeon, new Vector3(-60f, 0.1f, 0f), new Vector3(60f, 0.1f, 60f) })
            {
                bool inWorld = DungeonMounts.InOpenWorld(p);
                bool rode = DungeonMounts.TryRide(p, out string why);
                if (inWorld || rode || DungeonMounts.Riding != null || string.IsNullOrEmpty(why) || why.StartsWith("mount.")) Fail($"칸 밖 {p} 인데 탐/이유 '{why}'");
            }

            // 타고 칸 밖으로 나가면 저절로 내린다
            pc.Teleport(Open); pc.Step(0.1f);
            DungeonMounts.TryRide(pc.transform.position, out _);
            pc.Teleport(Dungeon); pc.Step(0.05f);
            Update(mf);
            if (DungeonMounts.Riding != null) Fail("던전 층 방에 들어갔는데 안 내림");

            // 맞으면 내린다 — 실제 피해
            pc.Teleport(Open); pc.Step(0.1f);
            HeroState.FullHeal();
            DungeonMounts.TryRide(pc.transform.position, out _);
            HeroState.TakeDamage(1f);
            if (DungeonMounts.Riding != null) Fail("맞았는데 안 내림");

            // 무적(회피) 중엔 맞은 게 아니라 안 내린다
            DungeonMounts.TryRide(pc.transform.position, out _);
            HeroState.Invulnerable = true;
            HeroState.TakeDamage(1f);
            HeroState.Invulnerable = false;
            if (DungeonMounts.Riding == null) Fail("무적 중인데 내림");
            DungeonMounts.Dismount();

            // 적을 치면 내린다 — Strike 가 쏘는 Struck
            DungeonMounts.TryRide(pc.transform.position, out _);
            var f = typeof(PlayerCombat).GetField("Struck", BindingFlags.NonPublic | BindingFlags.Static);
            ((System.Action)f?.GetValue(null))?.Invoke();
            if (f == null || DungeonMounts.Riding != null) Fail("적을 쳤는데 안 내림");

            // 뛰면 지상 탈것에서 내린다(F — 공중에 0.15초 넘게)
            pc.Teleport(Open); pc.Step(0.1f);
            DungeonMounts.TryRide(pc.transform.position, out _);
            pc.RequestJump();
            bool off = false;
            for (int i = 0; i < 400 && !off; i++)
            {
                pc.Step(0.02f);
                Update(mf);
                off = DungeonMounts.Riding == null;
                if (pc.Mode == PlayerController.MoveMode.Ground && i > 5) break;
            }
            if (!off && Time.deltaTime > 0.0001f) Fail("뛰었는데 지상 탈것에서 안 내림");
            DungeonMounts.Dismount();
            parts.Add("타고 내리기(던전 층·능묘 속·난입 방은 못 탐·칸 밖으로 나가면·맞으면·적을 치면·뛰면 내림·무적 중엔 안 내림)");
        }

        /// <summary>같은 자리에서 0.5초 걸은 거리(수평).</summary>
        private static float Walked(PlayerController pc, Vector3 start, Vector2 dir)
        {
            pc.Teleport(start);
            pc.Step(0.1f);
            pc.Teleport(start);
            pc.SetTestInput(dir);
            for (int i = 0; i < 25; i++) pc.Step(0.02f);
            pc.ClearTestInput();
            Vector3 d = pc.transform.position - start; d.y = 0f;
            return d.magnitude;
        }

        private static IEnumerable<(Vector3 start, Vector2 dir)> Trials()
        {
            foreach (var s in new[] { new Vector3(-8f, 0.1f, 0f), new Vector3(0f, 0.1f, -30f), new Vector3(-30f, 0.1f, 0f), new Vector3(0f, 0.1f, 8f) })
                foreach (var d in new[] { new Vector2(1f, 0f), new Vector2(-1f, 0f), new Vector2(0f, 1f), new Vector2(0f, -1f) })
                    yield return (s, d);
        }

        private static void CheckSpeed(PlayerController pc, List<string> parts)
        {
            SetLevel(26);
            bool done = false;
            foreach (var (start, dir) in Trials())
            {
                DungeonMounts.Restore("");
                float d0 = Walked(pc, start, dir);
                if (d0 < 2.8f) continue;
                DungeonMounts.Restore("mt_white");
                DungeonMounts.TryRide(start, out _);
                float d1 = Walked(pc, start, dir);
                DungeonMounts.Dismount();
                float ratio = d1 / d0;
                if (Mathf.Abs(ratio - 2f) > 0.08f) continue; // 앞이 막혔을 수 있다 — 다른 방향을 더 본다
                done = true;
                break;
            }
            if (!done) Fail("걷는 거리 배율이 ×2.0 인 방향이 없다(막히지 않은 방향을 못 찾았거나 배율이 다름)");
            pc.Teleport(Open);
            parts.Add("걷는 속도 배율(같은 자리 0.5초 — 흰 말 ×2.0)");
        }

        private static float Alt(PlayerController pc) => pc.HeightAboveGround();

        private static void CheckFly(PlayerController pc, List<string> parts)
        {
            SetLevel(34);
            pc.Teleport(Open);
            pc.Step(0.1f);
            DungeonMounts.Restore("mt_dragon");
            if (!DungeonMounts.TryRide(pc.transform.position, out _) || !DungeonMounts.RidingFly || Mathf.Abs(DungeonMounts.FlyMul - 1.9f) > 0.001f) Fail("용을 못 탐");
            // 오르기 — X(오름 입력) 0.4초 = 5m/초 → 약 2m
            DungeonMounts.Lift = 1f;
            for (int i = 0; i < 20; i++) pc.Step(0.02f);
            float h = Alt(pc);
            if (pc.Mode != PlayerController.MoveMode.Fly || h < 1.5f || h > 2.5f) Fail($"용 0.4초 오름 {h:0.00}m Mode {pc.Mode}");
            // 손 떼면 그 높이
            DungeonMounts.Lift = 0f;
            for (int i = 0; i < 25; i++) pc.Step(0.02f);
            if (Mathf.Abs(Alt(pc) - h) > 0.15f || pc.Mode != PlayerController.MoveMode.Fly) Fail($"손 뗐는데 높이가 변함 {h:0.00} → {Alt(pc):0.00}");
            // 높이 한도 — 용 3.8m, 그 뒤로 더 눌러도 안 오른다
            DungeonMounts.Lift = 1f;
            for (int i = 0; i < 100; i++) pc.Step(0.02f);
            if (Alt(pc) > 3.8f + 0.2f || Alt(pc) < 3.8f - 0.1f) Fail($"용 높이 한도 {Alt(pc):0.00}m ≠ 3.8");
            // 뜬 동안 속도 배율 = 걷기 6 × 1.9 = 11.4m/초 → 0.5초 5.7m (막힌 방향은 넘긴다)
            DungeonMounts.Lift = 0f;
            bool speedOk = false;
            foreach (var (start, dir) in Trials())
            {
                pc.Teleport(start + Vector3.up * 3.7f);
                DungeonMounts.Lift = 1f;
                pc.Step(0.02f); // 공중에 놓였으니 오름 입력 한 번으로 비행 상태로
                DungeonMounts.Lift = 0f;
                Vector3 p0 = pc.transform.position;
                pc.SetTestInput(dir);
                for (int i = 0; i < 25; i++) pc.Step(0.02f);
                pc.ClearTestInput();
                Vector3 dd = pc.transform.position - p0; dd.y = 0f;
                if (Mathf.Abs(dd.magnitude - 5.7f) < 0.3f && pc.Mode == PlayerController.MoveMode.Fly) { speedOk = true; break; }
            }
            if (!speedOk) Fail("용 뜬 속도 0.5초 5.7m(×1.9)인 방향이 없다");
            // 칸 가장자리 — 바깥으로 못 나간다(가장자리 x=44.9 에서 동쪽으로 1초)
            pc.Teleport(new Vector3(44.5f, 2f, 0f));
            DungeonMounts.Lift = 1f;
            pc.Step(0.02f);
            DungeonMounts.Lift = 0f;
            pc.SetTestInput(new Vector2(1f, 0f));
            for (int i = 0; i < 50; i++) pc.Step(0.02f);
            pc.ClearTestInput();
            if (pc.transform.position.x > DungeonWorldMap.Outer + 0.05f) Fail($"칸 가장자리를 넘음 x={pc.transform.position.x:0.0}");
            // 내리기 — Z(내림 입력) → 땅에 닿으면 탄 채 걷는다
            pc.Teleport(Open + Vector3.up * 3f);
            DungeonMounts.Lift = 1f;
            pc.Step(0.02f);
            DungeonMounts.Lift = -1f;
            for (int i = 0; i < 200 && pc.Mode == PlayerController.MoveMode.Fly; i++) pc.Step(0.02f);
            if (pc.Mode != PlayerController.MoveMode.Ground || DungeonMounts.Riding == null || Alt(pc) > 0.5f) Fail($"착지 Mode {pc.Mode}·탄 채 {DungeonMounts.Riding != null}·높이 {Alt(pc):0.00}");
            DungeonMounts.Lift = 0f;
            // 학 — 3.2m 한도·땅에서 걷는 배율 1.3
            DungeonMounts.Restore("mt_crane");
            pc.Teleport(Open); pc.Step(0.1f);
            DungeonMounts.TryRide(pc.transform.position, out _);
            if (Mathf.Abs(DungeonMounts.GroundMul - 1.3f) > 0.001f || Mathf.Abs(DungeonMounts.FlyMul - 1.6f) > 0.001f) Fail("학 배율");
            DungeonMounts.Lift = 1f;
            for (int i = 0; i < 100; i++) pc.Step(0.02f);
            if (Alt(pc) > 3.4f || Alt(pc) < 3.1f) Fail($"학 높이 한도 {Alt(pc):0.00}m ≠ 3.2");
            // 타고 있는 중 내리면 그 자리에서 떨어진다
            DungeonMounts.Dismount();
            pc.Step(0.02f);
            if (pc.Mode == PlayerController.MoveMode.Fly) Fail("내렸는데 계속 남");
            for (int i = 0; i < 400 && pc.Mode != PlayerController.MoveMode.Ground; i++) pc.Step(0.02f);
            if (pc.Mode != PlayerController.MoveMode.Ground) Fail("내린 뒤 땅에 안 닿음");
            DungeonMounts.Lift = 0f;
            parts.Add("비행(용 오름 5m/초·손 떼면 그 높이·한도 3.8/학 3.2·뜬 속도 ×1.9·칸 가장자리에서 막힘·착지 후 탄 채·내리면 떨어짐)");
        }

        private static void CheckField(PlayerController pc, MountField mf, List<string> parts)
        {
            SetLevel(26);
            DungeonMounts.Restore("");
            pc.Teleport(Open);
            pc.Step(0.1f);
            var refresh = typeof(MountField).GetMethod("RefreshUi", BindingFlags.NonPublic | BindingFlags.Instance);
            var late = typeof(MountField).GetMethod("LateUpdate", BindingFlags.NonPublic | BindingFlags.Instance);
            refresh.Invoke(mf, null);
            if (!mf.RideButton.gameObject.activeSelf || mf.UpButton.gameObject.activeSelf || mf.DownButton.gameObject.activeSelf) Fail("지상 탈것: 타기 단추만 보여야");
            if (!mf.Toggle() || DungeonMounts.Riding?.Id != "mt_white") Fail("Toggle 로 흰 말을 못 탐");
            late.Invoke(mf, null);
            refresh.Invoke(mf, null);
            if (!mf.BodyShown || mf.BodyId != "mt_white" || Mathf.Abs(mf.RiderLiftNow - MountField.LiftOf(DungeonMounts.Riding)) > 0.001f) Fail("흰 말 몸·리더 높이");
            if (!mf.RideLabel.Contains(DungeonMounts.Riding.Name) || mf.RideLabel.Contains("mount.")) Fail($"단추 글 '{mf.RideLabel}'");
            float baseY = pc.Visual != null ? pc.Visual.localPosition.y - MountField.LiftOf(DungeonMounts.Riding) : 0f;
            mf.Toggle();
            late.Invoke(mf, null);
            if (mf.BodyShown || DungeonMounts.Riding != null || (pc.Visual != null && Mathf.Abs(pc.Visual.localPosition.y - baseY) > 0.001f)) Fail("내렸는데 몸이 남거나 리더 높이가 안 돌아옴");
            // 비행 탈것 — 단추 셋·모양 바뀜
            SetLevel(34);
            DungeonMounts.Restore("mt_crane");
            mf.Toggle();
            late.Invoke(mf, null);
            refresh.Invoke(mf, null);
            if (!mf.BodyShown || mf.BodyId != "mt_crane" || !mf.UpButton.gameObject.activeSelf || !mf.DownButton.gameObject.activeSelf) Fail("학: 몸·▲▼ 단추");
            if (!mf.CycleSelection() || DungeonMounts.Riding?.Id != "mt_dragon") Fail("Shift+H 로 타고 있는 채 용으로 바뀌어야");
            late.Invoke(mf, null);
            if (mf.BodyId != "mt_dragon") Fail("탈것을 바꿨는데 몸이 안 바뀜");
            mf.Toggle();
            late.Invoke(mf, null);
            refresh.Invoke(mf, null);
            if (mf.UpButton.gameObject.activeSelf || mf.BodyShown) Fail("내린 뒤 ▲▼ 단추·몸이 남음");
            // 던전 층 방 — 단추도 없고 탈 수 없다
            pc.Teleport(Dungeon);
            pc.Step(0.05f);
            refresh.Invoke(mf, null);
            if (mf.RideButton.gameObject.activeSelf) Fail("던전 층 방인데 타기 단추가 보임");
            if (mf.Toggle() || DungeonMounts.Riding != null) Fail("던전 층 방에서 탐");
            // 레벨 4 — 단추도 없다
            pc.Teleport(Open);
            pc.Step(0.1f);
            SetLevel(4);
            DungeonMounts.Restore("");
            refresh.Invoke(mf, null);
            if (mf.RideButton.gameObject.activeSelf) Fail("레벨 4 인데 타기 단추가 보임");
            parts.Add("화면(지상 = 타기 단추만·비행 = ▲▼ 더·말/학/용 몸 셋·리더 높이 돌아옴·Shift+H 로 바꿈·던전 층 방/레벨 4 단추 없음)");
        }

        private static void CheckSave(List<string> parts)
        {
            SetLevel(34);
            DungeonMounts.Restore("mt_crane");
            string json = SaveState.ToJson();
            if (!json.Contains("\"mountSel\":\"mt_crane\"") || !json.Contains("\"version\":14")) Fail("세이브에 탈것이 없다(버전은 14 그대로)");
            DungeonMounts.Restore("");
            if (!SaveState.ApplyJson(json) || DungeonMounts.Sel != "mt_crane" || DungeonMounts.Riding != null) Fail("왕복 뒤 고른 탈것이 달라짐·탄 채 불러옴");
            string old = Regex.Replace(json, ",\"mountSel\":\"[^\"]*\"", "");
            if (old.Contains("mountSel")) { Fail("옛 세이브 가짜 만들기 실패"); return; }
            DungeonMounts.Restore("mt_dragon");
            if (!SaveState.ApplyJson(old) || DungeonMounts.Sel != "") Fail("탈것 없는 옛 세이브를 읽었는데 고른 채");
            parts.Add("세이브(고른 탈것 왕복·탄 채 저장 안 함·옛 세이브는 안 고른 채·버전 그대로)");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {msg}");
        }
    }
}
