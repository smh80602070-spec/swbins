using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0179 1만리 바람 길잡이(고돗 G-0318 짝) 진단 — `PlaytestHeadless` 가 환경 연쇄(fieldfire) 뒤에 부른다(한 프레임 안, 틱은 손으로 — 주인공은 안 옮긴다).
    /// ① 규칙(4m 안·목표 없음 = 안 붊, 1.5초·6초·바람만 12초) ② 가만히 1.5초에 줄기 일곱·목표 쪽으로 흐름 ③ 6초 쿨·다 흐르면 사라짐
    /// ④ 가까우면·목표 없으면 안 붊 ⑤ 바람만 = 걸어도 12초·기둥 꺼짐(되돌리면 다시) ⑥ 손잡이 끄면 안 붊. 끝나면 손잡이·줄기·목표·이야기 끔을 시작 때로.
    /// </summary>
    public static class PlaytestGoWind
    {
        private const string T = "[PlaytestHeadless] wind";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            var wg = GoWindGuide.Instance;
            var fc = FieldCombat.Instance;
            var sf = StoryField.Instance;
            if (wg == null || fc == null || sf == null) { Fail("GoWindGuide·FieldCombat·StoryField 없음"); return false; }
            bool off0 = StoryState.OffForTest;
            Vector3 p = fc.transform.position;
            try
            {
                wg.ClearForTest();
                GoWindGuide.ResetCountForTest();

                // ① 규칙
                Begin();
                if (GoWindGuide.Dir(p, p + new Vector3(3f, 5f, 0f), out _)) Fail("4m 안인데 방향");
                if (!GoWindGuide.Dir(p, p + new Vector3(0f, 9f, 20f), out var d0) || Vector3.Distance(d0, Vector3.forward) > 0.001f) Fail($"20m 앞 방향 {d0}");
                if (GoWindGuide.ShouldBlow(1.4f, 9f, false) || GoWindGuide.ShouldBlow(2f, 5.9f, false) || !GoWindGuide.ShouldBlow(1.5f, 6f, false)) Fail("1.5초·6초 문턱");
                if (GoWindGuide.ShouldBlow(0f, 11.9f, true) || !GoWindGuide.ShouldBlow(0f, 12f, true)) Fail("바람만 12초 문턱");
                End("rule OK - 4m 안 안 붊 · 땅 위 방향 · 가만히 1.5초 + 6초 · 바람만이면 걸어도 12초");

                // ② 가만히 1.5초
                Begin();
                Vector3 tgt = p + new Vector3(20f, 0f, 0f);
                GoWindGuide.TargetForTest = tgt;
                wg.SetStillForTest(0f, GoWindGuide.Every);
                wg.Step(0.5f); wg.Step(0.5f); wg.Step(0.4f);
                if (GoWindGuide.Blows != 0) Fail($"1.4초에 붊({wg.StillFor:0.0}초)");
                wg.Step(0.2f);
                if (GoWindGuide.Blows != 1 || wg.Live != GoWindGuide.Streaks) Fail($"1.6초에 {GoWindGuide.Blows}번·줄기 {wg.Live} ≠ 1·{GoWindGuide.Streaks}");
                float x0 = MeanX(wg);
                wg.Step(0.8f);
                float x1 = MeanX(wg);
                if (!(x1 > x0 + 3f)) Fail($"목표 쪽으로 안 흐름 x {x0:0.0} → {x1:0.0}");
                End($"blow OK - 1.4초 안 붊 · 1.6초 줄기 {GoWindGuide.Streaks} · 0.8초에 목표 쪽 {x1 - x0:0.0}m");

                // ③ 쿨·사라짐
                Begin();
                wg.Step(1.5f);
                if (GoWindGuide.Blows != 1) Fail("6초 안에 또 붊");
                if (wg.Live != 0) Fail($"다 흘렀는데 줄기 {wg.Live}");
                wg.Step(GoWindGuide.Every - 2.3f + 0.05f);
                if (GoWindGuide.Blows != 2) Fail($"6초 지나 안 붊({GoWindGuide.Blows})");
                wg.ClearForTest();
                End("cool OK - 6초 안 다시 안 붊·2.3초에 줄기 0·6초 뒤 다시");

                // ④ 가깝거나 목표 없음
                Begin();
                int b = GoWindGuide.Blows;
                GoWindGuide.TargetForTest = p + new Vector3(3f, 0f, 0f);
                wg.SetStillForTest(5f, 10f); wg.Step(0.1f);
                GoWindGuide.TargetForTest = null;
                StoryState.OffForTest = true;
                wg.SetStillForTest(5f, 10f); wg.Step(0.1f);
                StoryState.OffForTest = off0;
                if (GoWindGuide.Blows != b) Fail("가까운데·목표 없는데 붊");
                End("none OK - 4m 안·따라가는 목표 없음 = 안 붊");

                // ⑤ 바람만
                Begin();
                GoWindGuide.TargetForTest = tgt;
                GoWindGuide.WindOnly = true;
                wg.SetStillForTest(0f, 11.8f); wg.Step(0.1f);
                if (GoWindGuide.Blows != b) Fail("바람만 11.9초에 붊");
                wg.Step(0.15f);
                if (GoWindGuide.Blows != b + 1) Fail("바람만 12초에 걸어도(가만히 0) 안 붊");
                wg.ClearForTest();
                sf.Refresh();
                if (sf.Pillar != null && sf.Pillar.activeSelf) Fail("바람만인데 기둥 켜짐");
                GoWindGuide.WindOnly = false;
                sf.Refresh();
                bool has = StoryField.Target(out _, out _);
                if (sf.Pillar != null && sf.Pillar.activeSelf != has) Fail($"되돌렸는데 기둥 {sf.Pillar.activeSelf} ≠ 목표 {has}");
                End($"windonly OK - 걸어도 12초·기둥 끔 · 되돌리면 기둥 {(has ? "다시 켬" : "목표 없어 꺼진 채")}");

                // ⑥ 손잡이
                Begin();
                GoWindGuide.On = false;
                b = GoWindGuide.Blows;
                wg.SetStillForTest(5f, 10f); wg.Step(0.1f);
                if (GoWindGuide.Blows != b || wg.Live != 0) Fail("껐는데 붊");
                End("off OK - 손잡이 끄면 안 붊");
            }
            finally
            {
                GoWindGuide.On = true;
                GoWindGuide.WindOnly = false;
                GoWindGuide.TargetForTest = null;
                StoryState.OffForTest = off0;
                wg.ClearForTest();
                wg.SetStillForTest(0f, GoWindGuide.Every);
                sf.Refresh();
            }
            return _ok;
        }

        private static float MeanX(GoWindGuide wg)
        {
            float x = 0f; int n = 0;
            foreach (Transform t in wg.transform) if (t.name == "WindStreak") { x += t.position.x; n++; }
            return n > 0 ? x / n : 0f;
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
