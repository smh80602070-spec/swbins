using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.Player;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-15 탈것·비행(웹 사가마을 T1·T2 진단 항목) — `PlaytestForestHeadless` 가 부른다.
    /// 표(다섯·마을 점수 문턱·배율·이름) · 열림·고르기(점수 19/20/60/100/150/200 — 안 골랐을 땐 지상 탈것 중 가장 빠른 것) ·
    /// 타고 내리기(집 안은 못 탐 · 타고 집에 들어가면 내림) · 실제 걷는 속도 배율(같은 자리 0.5초) ·
    /// 비행(타면 2.8m 로 뜸 · 뜬 속도 · 충돌 없이 나무/소품 자리를 지나감 · 마을 가장자리에서 미끄러짐 · 내리면 충돌 켜고 떨어져 땅에 섬) ·
    /// `MountField`(모양·리더 높이·단추 켜고 끔) · 세이브(왕복·옛 세이브는 안 고른 채). 끝나면 탈것·점수 손잡이·자리·세이브 상태를 되돌린다.
    /// </summary>
    public static class PlaytestForestMount
    {
        private const string T = "[PlaytestForestHeadless] mount";
        private static bool _ok;

        private static readonly Vector3 Open = new Vector3(0f, 0.1f, 0f);
        private static readonly Vector3 Free = new Vector3(-20f, 0.1f, 0f); // 빈 땅(원점엔 깃대·시설이 있어 그 위에 내려앉을 수 있다)
        private static readonly Vector3 Indoor = new Vector3(0f, 0.1f, 500f);

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            var pc = playerGo != null ? playerGo.GetComponent<PlayerController>() : null;
            var mf = MountField.Instance;
            if (pc == null || mf == null) { Fail("PlayerController/MountField 없음"); return false; }
            Vector3 start = playerGo.transform.position;
            string sel0 = ForestMounts.Snapshot();
            string json0 = ForestSaveState.ToJson();
            var parts = new List<string>();
            try
            {
                ForestMounts.ResetForTest();
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
                ForestMounts.ResetForTest();
                ForestMounts.Restore(sel0);
                pc.ClearTestInput();
                ForestMounts.Dismount();
                pc.Step(0.02f);
                pc.Teleport(start);
                pc.Step(0.05f);
                ForestSaveState.ApplyJson(json0);
            }
            if (_ok) Debug.Log($"{T} OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static void Score(int s) => ForestMounts.ScoreForTest = s;

        private static void CheckTable(List<string> parts)
        {
            var all = ForestMounts.All;
            if (all.Length != 5 || all.Select(m => m.Id).Distinct().Count() != 5 || all.Count(m => !m.IsFly) != 3 || all.Count(m => m.IsFly) != 2) Fail("탈것 표(지상 셋·비행 둘)");
            var want = new (string id, int score, float mul, bool fly)[]
            {
                ("mt_deer", 20, 1.4f, false), ("mt_brown", 60, 1.7f, false), ("mt_white", 150, 1.95f, false),
                ("mt_crane", 100, 1.5f, true), ("mt_dragon", 200, 1.8f, true),
            };
            foreach (var w in want)
            {
                var m = ForestMounts.Def(w.id);
                if (m == null || m.Score != w.score || Mathf.Abs(m.Mul - w.mul) > 0.001f || m.IsFly != w.fly) Fail($"탈것 {w.id} 수치");
                else if (m.Name.StartsWith("mount.") || m.Name.Length == 0) Fail($"탈것 {w.id} 이름 글이 없다");
            }
            if (ForestMounts.Hover <= 2.5f) Fail("뜬 높이가 손 닿는 반경(2.5m) 안 — 뜬 채로 줍기·말 걸기가 된다");
            if (ForestMounts.Def("nope") != null || ForestMounts.Def(null) != null) Fail("없는 탈것 id");
            parts.Add("표(지상 셋·비행 둘·마을 점수 문턱·배율·이름·뜬 높이 > 손 닿는 반경)");
        }

        private static void CheckUnlock(List<string> parts)
        {
            Score(19);
            if (ForestMounts.UnlockedList().Count != 0 || ForestMounts.Selected() != null) Fail("점수 19 인데 탈것이 있다");
            if (ForestMounts.CanRide(Open, out string why) || string.IsNullOrEmpty(why) || why.StartsWith("mount.")) Fail($"점수 19 탈 수 없음 이유 '{why}'");
            Score(20);
            if (ForestMounts.UnlockedList().Count != 1 || ForestMounts.Selected()?.Id != "mt_deer") Fail("점수 20 = 사슴 하나");
            Score(60);
            if (ForestMounts.UnlockedList().Count != 2 || ForestMounts.Selected()?.Id != "mt_brown") Fail("점수 60 = 갈색 말이 가장 빠른 지상 탈것");
            Score(100);
            if (ForestMounts.UnlockedList().Count != 3 || ForestMounts.Selected()?.Id != "mt_brown") Fail("점수 100 = 학이 열려도 안 골랐을 땐 지상 탈것");
            Score(150);
            if (ForestMounts.Selected()?.Id != "mt_white") Fail("점수 150 = 흰 말");
            Score(200);
            if (ForestMounts.UnlockedList().Count != 5) Fail("점수 200 = 다섯 모두");
            ForestMounts.Restore("");
            var order = new List<string>();
            for (int i = 0; i < 5; i++) order.Add(ForestMounts.Cycle().Id);
            if (string.Join(",", order) != "mt_crane,mt_dragon,mt_deer,mt_brown,mt_white") Fail($"고르기 차례 {string.Join(",", order)}");
            ForestMounts.Restore("mt_dragon");
            if (ForestMounts.Selected()?.Id != "mt_dragon" || ForestMounts.Sel != "mt_dragon") Fail("고른 탈것이 안 남음");
            Score(100);
            if (ForestMounts.Selected()?.Id != "mt_brown") Fail("못 쓰게 된 탈것을 골라 둔 채 — 쓸 수 있는 가장 빠른 지상 탈것으로");
            ForestMounts.Restore("bogus");
            if (ForestMounts.Sel != "") Fail("모르는 id 를 골라 둠");
            ForestMounts.OffForTest = true;
            Score(200);
            if (ForestMounts.UnlockedList().Count != 0) Fail("OffForTest 인데 탈것이 있다");
            ForestMounts.OffForTest = false;
            ForestMounts.ScoreForTest = -1;
            if (ForestMounts.Progress() != ForestTownScore.Total()) Fail("점수 손잡이를 풀었는데 마을 점수가 아님");
            parts.Add("열림·고르기(마을 점수 19·20·60·100·150·200 — 안 골랐을 땐 지상 중 가장 빠른 것·Shift+H 차례·못 쓰게 된 것·모르는 id)");
        }

        private static void Update(MountField mf) =>
            typeof(MountField).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance).Invoke(mf, null);

        private static void CheckRide(PlayerController pc, MountField mf, List<string> parts)
        {
            Score(150);
            ForestMounts.Restore("");
            pc.Teleport(Open);
            pc.Step(0.1f);
            if (!ForestMounts.TryRide(pc.transform.position, out _) || ForestMounts.Riding?.Id != "mt_white" || !ForestMounts.RidingGround || Mathf.Abs(ForestMounts.SpeedMul - 1.95f) > 0.001f) Fail("마을에서 못 탐·배율");
            ForestMounts.Dismount();
            if (ForestMounts.Riding != null || ForestMounts.SpeedMul != 1f) Fail("내렸는데 배율이 남음");
            bool rode = ForestMounts.TryRide(Indoor, out string why);
            if (rode || ForestMounts.Riding != null || string.IsNullOrEmpty(why) || why.StartsWith("mount.")) Fail($"집 안인데 탐/이유 '{why}'");
            // 타고 집에 들어가면 내린다
            pc.Teleport(Open); pc.Step(0.1f);
            ForestMounts.TryRide(pc.transform.position, out _);
            pc.Teleport(Indoor); pc.Step(0.05f);
            Update(mf);
            if (ForestMounts.Riding != null) Fail("집에 들어갔는데 안 내림");
            pc.Teleport(Open); pc.Step(0.1f);
            parts.Add("타고 내리기(집 안은 못 탐·타고 집에 들어가면 내림·내리면 배율 1)");
        }

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
            foreach (var s in new[] { new Vector3(-20f, 0.1f, 0f), new Vector3(0f, 0.1f, -15f), new Vector3(20f, 0.1f, 10f), new Vector3(-30f, 0.1f, -10f) })
                foreach (var d in new[] { new Vector2(1f, 0f), new Vector2(-1f, 0f), new Vector2(0f, 1f), new Vector2(0f, -1f) })
                    yield return (s, d);
        }

        private static void CheckSpeed(PlayerController pc, List<string> parts)
        {
            Score(150);
            bool done = false;
            foreach (var (start, dir) in Trials())
            {
                ForestMounts.Restore("");
                float d0 = Walked(pc, start, dir);
                if (d0 < 2.8f) continue;
                ForestMounts.Restore("mt_white");
                ForestMounts.TryRide(start, out _);
                float d1 = Walked(pc, start, dir);
                ForestMounts.Dismount();
                if (Mathf.Abs(d1 / d0 - 1.95f) > 0.08f) continue; // 앞이 막혔을 수 있다 — 다른 방향을 더 본다
                done = true;
                break;
            }
            if (!done) Fail("걷는 거리 배율이 ×1.95 인 방향이 없다(막히지 않은 방향을 못 찾았거나 배율이 다름)");
            pc.Teleport(Open);
            parts.Add("걷는 속도 배율(같은 자리 0.5초 — 흰 말 ×1.95)");
        }

        private static void CheckFly(PlayerController pc, List<string> parts)
        {
            Score(200);
            pc.Teleport(Open);
            pc.Step(0.1f);
            float y0 = pc.transform.position.y; // 열린 자리 땅 높이 — 오름은 땅 기준 상대값으로 잰다
            ForestMounts.Restore("mt_dragon");
            if (!ForestMounts.TryRide(pc.transform.position, out _) || !ForestMounts.RidingFly || Mathf.Abs(ForestMounts.SpeedMul - 1.8f) > 0.001f) Fail("용을 못 탐");
            // 타면 떠오른다 — 6m/초, 2.8m 까지
            for (int i = 0; i < 10; i++) pc.Step(0.02f);
            float y = pc.transform.position.y - y0;
            if (!pc.Flying || y < 0.9f || y > 1.9f) Fail($"0.2초 뒤 오른 높이 {y:0.00} (6m/초 오름) Flying {pc.Flying}");
            for (int i = 0; i < 50; i++) pc.Step(0.02f);
            if (Mathf.Abs(pc.transform.position.y - ForestMounts.Hover) > 0.01f) Fail($"1.2초 뒤 높이 {pc.transform.position.y:0.00} ≠ {ForestMounts.Hover}");
            if (pc.GetComponent<CharacterController>().enabled) Fail("뜬 동안 충돌이 켜져 있다");
            // 뜬 속도 = 걷기 6 × 1.8 = 10.8m/초 → 0.5초 5.4m — 막힘 없이(충돌이 꺼져 어디서나)
            pc.Teleport(new Vector3(-20f, 0.1f, 0f));
            pc.Step(0.02f);
            Vector3 p0 = pc.transform.position;
            pc.SetTestInput(new Vector2(1f, 0f));
            for (int i = 0; i < 25; i++) pc.Step(0.02f);
            pc.ClearTestInput();
            float dx = pc.transform.position.x - p0.x;
            if (Mathf.Abs(dx - 5.4f) > 0.15f) Fail($"용 뜬 속도 0.5초 {dx:0.00}m ≠ 5.4 (×1.8)");
            // 마을 가장자리에서 미끄러진다 — 동북쪽 끝으로 10초
            pc.SetTestInput(new Vector2(1f, 1f));
            for (int i = 0; i < 500; i++) pc.Step(0.02f);
            pc.ClearTestInput();
            var e = pc.transform.position;
            float limX = ForestGroundBuilder.VillageWidth * 0.5f - ForestMounts.EdgeInset, limZ = ForestGroundBuilder.VillageDepth * 0.5f - ForestMounts.EdgeInset;
            if (Mathf.Abs(e.x) > limX + 0.01f || Mathf.Abs(e.z) > limZ + 0.01f) Fail($"마을 밖으로 나감 ({e.x:0.0},{e.z:0.0})");
            if (e.x < limX - 0.5f || e.z < limZ - 0.5f) Fail($"가장자리까지 못 감 ({e.x:0.0},{e.z:0.0})");
            // 내리면 충돌을 켜고 떨어져 땅에 선다
            pc.Teleport(Free);
            pc.Step(0.02f);
            for (int i = 0; i < 50; i++) pc.Step(0.02f);
            ForestMounts.Dismount();
            pc.Step(0.02f);
            if (pc.Flying || !pc.GetComponent<CharacterController>().enabled) Fail("내렸는데 비행/충돌 꺼짐이 남음");
            for (int i = 0; i < 150; i++) pc.Step(0.02f);
            if (pc.transform.position.y > 0.4f) Fail($"내린 뒤 땅에 안 섬 y={pc.transform.position.y:0.00}");
            // 학 — 같은 높이·배율 1.5
            ForestMounts.Restore("mt_crane");
            pc.Teleport(Free); pc.Step(0.1f);
            ForestMounts.TryRide(pc.transform.position, out _);
            if (Mathf.Abs(ForestMounts.SpeedMul - 1.5f) > 0.001f) Fail("학 배율");
            for (int i = 0; i < 80; i++) pc.Step(0.02f);
            if (Mathf.Abs(pc.transform.position.y - ForestMounts.Hover) > 0.01f) Fail("학 높이");
            ForestMounts.Dismount();
            for (int i = 0; i < 200; i++) pc.Step(0.02f);
            if (pc.Flying) Fail("학에서 내린 뒤 비행이 남음");
            parts.Add("비행(타면 6m/초로 2.8m·충돌 꺼짐·뜬 속도 ×1.8·마을 가장자리에서 미끄러짐·내리면 충돌 켜고 떨어져 땅에 섬·학)");
        }

        private static void CheckField(PlayerController pc, MountField mf, List<string> parts)
        {
            Score(200);
            ForestMounts.Restore("");
            pc.Teleport(Open);
            pc.Step(0.1f);
            var refresh = typeof(MountField).GetMethod("RefreshUi", BindingFlags.NonPublic | BindingFlags.Instance);
            var late = typeof(MountField).GetMethod("LateUpdate", BindingFlags.NonPublic | BindingFlags.Instance);
            refresh.Invoke(mf, null);
            if (!mf.RideButton.gameObject.activeSelf) Fail("타기 단추가 안 보임");
            if (!mf.Toggle() || ForestMounts.Riding?.Id != "mt_white") Fail("Toggle 로 흰 말을 못 탐");
            late.Invoke(mf, null);
            refresh.Invoke(mf, null);
            if (!mf.BodyShown || mf.BodyId != "mt_white" || Mathf.Abs(mf.RiderLiftNow - MountField.LiftOf(ForestMounts.Riding)) > 0.001f) Fail("흰 말 몸·리더 높이");
            if (!mf.RideLabel.Contains(ForestMounts.Riding.Name) || mf.RideLabel.Contains("mount.")) Fail($"단추 글 '{mf.RideLabel}'");
            float baseY = pc.Visual != null ? pc.Visual.localPosition.y - MountField.LiftOf(ForestMounts.Riding) : 0f;
            mf.Toggle();
            late.Invoke(mf, null);
            if (mf.BodyShown || ForestMounts.Riding != null || (pc.Visual != null && Mathf.Abs(pc.Visual.localPosition.y - baseY) > 0.001f)) Fail("내렸는데 몸이 남거나 리더 높이가 안 돌아옴");
            // 사슴·학·용 몸이 바뀐다
            ForestMounts.Restore("mt_deer");
            mf.Toggle();
            late.Invoke(mf, null);
            if (mf.BodyId != "mt_deer") Fail("사슴 몸");
            if (!mf.CycleSelection() || ForestMounts.Riding?.Id != "mt_brown") Fail("Shift+H 로 타고 있는 채 갈색 말로 바뀌어야");
            late.Invoke(mf, null);
            if (mf.BodyId != "mt_brown") Fail("탈것을 바꿨는데 몸이 안 바뀜");
            ForestMounts.Restore("mt_crane");
            mf.Toggle();
            late.Invoke(mf, null);
            if (mf.BodyId != "mt_crane") Fail("학 몸");
            mf.CycleSelection();
            late.Invoke(mf, null);
            if (mf.BodyId != "mt_dragon") Fail("용 몸");
            mf.Toggle();
            for (int i = 0; i < 200; i++) pc.Step(0.02f);
            late.Invoke(mf, null);
            if (mf.BodyShown || pc.Flying) Fail("내린 뒤 몸/비행이 남음");
            // 집 안 — 단추도 없고 탈 수 없다
            pc.Teleport(Indoor);
            pc.Step(0.05f);
            refresh.Invoke(mf, null);
            if (mf.RideButton.gameObject.activeSelf) Fail("집 안인데 타기 단추가 보임");
            if (mf.Toggle() || ForestMounts.Riding != null) Fail("집 안에서 탐");
            // 점수 19 — 단추도 없다
            pc.Teleport(Open); pc.Step(0.1f);
            Score(19);
            ForestMounts.Restore("");
            refresh.Invoke(mf, null);
            if (mf.RideButton.gameObject.activeSelf) Fail("점수 19 인데 타기 단추가 보임");
            parts.Add("화면(타기 단추·사슴/말/학/용 몸·리더 높이 돌아옴·Shift+H 로 바꿈·집 안/점수 19 단추 없음)");
        }

        private static void CheckSave(List<string> parts)
        {
            Score(200);
            ForestMounts.Restore("mt_crane");
            string json = ForestSaveState.ToJson();
            if (!json.Contains("\"mountSel\":\"mt_crane\"") || !json.Contains("\"version\":9")) Fail("세이브에 탈것이 없다(버전은 9 그대로)");
            ForestMounts.Restore("");
            if (!ForestSaveState.ApplyJson(json) || ForestMounts.Sel != "mt_crane" || ForestMounts.Riding != null) Fail("왕복 뒤 고른 탈것이 달라짐·탄 채 불러옴");
            string old = Regex.Replace(json, ",\"mountSel\":\"[^\"]*\"", "");
            if (old.Contains("mountSel")) { Fail("옛 세이브 가짜 만들기 실패"); return; }
            ForestMounts.Restore("mt_dragon");
            if (!ForestSaveState.ApplyJson(old) || ForestMounts.Sel != "") Fail("탈것 없는 옛 세이브를 읽었는데 고른 채");
            parts.Add("세이브(고른 탈것 왕복·탄 채 저장 안 함·옛 세이브는 안 고른 채·버전 그대로)");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {msg}");
        }
    }
}
