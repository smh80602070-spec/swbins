using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-3b "원소 시야"(웹 사가만리 ⑲-3 진단 항목 "시야 흔적 점(간격·최대 14)") — `PlaytestHeadless` 가 구슬 진단 뒤에 부른다.
    /// 흔적 규칙(4m 간격·목표 앞에서 멈춤·최대 14·가까우면 없음) · 빛깔(맨몸 적 붉게·원소 적 원소 빛·석등 원소 빛) · 켜고 끄기(누르는 동안 0.2초에 잿빛·놓으면 걷힘) ·
    /// 짚기(83m 안만·안 주운 구슬만·흔적 점 간격) · 결투 중 꺼짐 · HUD "시야" 단추 켜고 끔. 끝나면 구슬·시야 상태를 되돌린다.
    /// </summary>
    public static class PlaytestGoSight
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var sight = ElementalSight.Instance;
            var orbs = GoOrbField.Instance;
            var fc = FieldCombat.Instance;
            if (sight == null || orbs == null || fc == null) { Fail("ElementalSight/GoOrbField/FieldCombat 없음"); return false; }
            var startGot = OrbState.Snapshot();
            int startGiven = OrbState.Given;
            string marks = "";
            try
            {
                CheckRules();
                CheckToggle(sight);
                marks = CheckMarks(sight, orbs);
                CheckBlockedAndButton(sight, fc);
            }
            finally
            {
                DuelGate.ResetForTest();
                sight.SetHeldForTest(false);
                sight.Toggled = false;
                sight.Tick(1f);
                OrbState.Restore(startGot, startGiven);
                orbs.Rebuild();
            }
            if (_ok) Debug.Log($"[{_tag}] sight OK - 흔적 4m·최대 14·목표 앞 멈춤 · 빛깔 · 누르는 동안 잿빛 0.2초·놓으면 걷힘 · {marks} · 결투 중 꺼짐 · 시야 단추");
            return _ok;
        }

        private static void CheckRules()
        {
            var t = GoSight.Trail(Vector3.zero, new Vector3(30f, 5f, 0f));
            if (t.Count != 7) Fail($"30m 흔적 점 {t.Count} ≠ 7");
            for (int i = 0; i < t.Count; i++)
                if (Mathf.Abs(t[i].x - GoSight.TrailSpacing * (i + 1)) > 0.01f) { Fail($"흔적 점 {i} 자리 {t[i].x}"); break; }
            if (GoSight.Trail(Vector3.zero, new Vector3(0f, 0f, 140f)).Count != GoSight.TrailMax) Fail("140m 흔적이 14 로 안 막힘");
            if (GoSight.Trail(Vector3.zero, new Vector3(3f, 0f, 0f)).Count != 0) Fail("3m 목표에 흔적 점");
            if (GoSight.ColorOf(GoSight.Mark.Enemy) != GoSight.BareFoeColor) Fail("맨몸 적이 붉지 않음");
            if (GoSight.ColorOf(GoSight.Mark.Enemy, GoElement.Cryo) != GoElements.ColorOf(GoElement.Cryo)) Fail("원소 적 빛깔");
            if (GoSight.ColorOf(GoSight.Mark.Torch, GoElement.Hydro) != GoElements.ColorOf(GoElement.Hydro)) Fail("석등 빛깔");
            if (!GoSight.InRange(Vector3.zero, new Vector3(82f, 40f, 0f), GoSight.Range) || GoSight.InRange(Vector3.zero, new Vector3(84f, 0f, 0f), GoSight.Range)) Fail("83m 짚기 거리(높이는 안 봄)");
        }

        private static void CheckToggle(ElementalSight sight)
        {
            sight.SetHeldForTest(true);
            sight.Tick(0.1f);
            if (!sight.On || Mathf.Abs(sight.Weight - 0.5f) > 0.01f) Fail($"누르고 0.1초 — 켜짐 {sight.On}·잿빛 {sight.Weight} ≠ 0.5");
            sight.Tick(0.15f);
            if (sight.Weight < 0.999f) Fail($"0.25초 뒤 잿빛 {sight.Weight} ≠ 1");
            sight.SetHeldForTest(false);
            sight.Tick(0.1f);
            if (sight.On || sight.Marks.Count != 0) Fail("놓았는데 시야가 남음");
            sight.Tick(0.2f);
            if (sight.Weight > 0.001f) Fail("놓고 0.3초 뒤에도 잿빛");
        }

        private static string CheckMarks(ElementalSight sight, GoOrbField orbs)
        {
            OrbState.ResetForTest();
            orbs.Rebuild();
            var o = GoOrbs.All[0];
            Vector3 op = orbs.PosOf(o.Id);
            Vector3 player = op + new Vector3(40f, 0f, 0f);
            sight.Refresh(player);
            bool seen = false;
            foreach (var m in sight.Marks)
            {
                if (!GoSight.InRange(player, m.pos, GoSight.Range)) Fail($"83m 밖 {m.mark} 짚음");
                if (m.mark == GoSight.Mark.Orb && (m.pos - op).sqrMagnitude < 0.01f) seen = true;
            }
            if (!seen) Fail($"40m 앞 구슬 {o.Id} 을 안 짚음");
            int n = sight.TrailPoints.Count;
            if (n < 1 || n > GoSight.TrailMax) Fail($"흔적 점 {n}");
            for (int i = 1; i < n; i++)
            {
                Vector3 d = sight.TrailPoints[i] - sight.TrailPoints[i - 1];
                d.y = 0f;
                if (Mathf.Abs(d.magnitude - GoSight.TrailSpacing) > 0.05f) { Fail($"흔적 간격 {d.magnitude}"); break; }
            }
            int marks = sight.Marks.Count;
            OrbState.Collect(o.Id);
            sight.Refresh(player);
            foreach (var m in sight.Marks)
                if (m.mark == GoSight.Mark.Orb && (m.pos - op).sqrMagnitude < 0.01f) Fail("주운 구슬을 짚음");
            return $"짚기 {marks}(40m 앞 구슬·83m 밖 없음)·흔적 {n}점·주운 구슬 빠짐";
        }

        private static void CheckBlockedAndButton(ElementalSight sight, FieldCombat fc)
        {
            DuelGate.Report(true);
            sight.SetHeldForTest(true);
            sight.Tick(0.3f);
            if (sight.On || sight.Weight > 0.001f) Fail("결투 중인데 시야가 켜짐");
            DuelGate.ResetForTest();
            sight.SetHeldForTest(false);
            var hud = fc.GetComponent<FieldCombatHud>();
            if (hud == null || hud.SightButton == null) { Fail("HUD 시야 단추 없음"); return; }
            hud.SightButton.onClick.Invoke();
            sight.Tick(0.3f);
            if (!sight.Toggled || !sight.On) Fail("시야 단추가 안 켬");
            hud.SightButton.onClick.Invoke();
            sight.Tick(0.3f);
            if (sight.Toggled || sight.On) Fail("시야 단추가 안 끔");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] sight FAIL - {msg}");
        }
    }
}
