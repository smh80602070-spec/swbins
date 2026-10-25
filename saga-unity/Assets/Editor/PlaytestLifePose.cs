using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0146 생활 몸짓(공용 `LifePose`) 진단 — 1만리·3마을·4종횡·5천하 사슬이 판 이름을 넣어 부른다(한 프레임 안, 시계는 손으로).
    /// ① 나: 가만히 8초 → 앉기(섞기 0.25초)·움직이면 일어남·hold 면 안 앉음·앉은 채 몸짓 안 틈 ② 주민: 들어서면 인사 한 번(나갔다 오면 또)·
    /// 카메라 멀면 둘러보기/체중 없음·가까우면 3~5초 안에 하나 ③ 씬 연결: 나에게 LifePose(5천하는 나 없음)·주민/장수 수 ④ 사람 몸(휴머노이드)이면
    /// 앉을 때 엉덩이가 내려가고 되돌리면 제자리. 진단이 만든 물체는 지우고 씬 것의 시계는 처음으로.
    /// </summary>
    public static class PlaytestLifePose
    {
        private static bool _ok;
        private static string _t;

        public static bool Run(string chain, string game)
        {
            _ok = true;
            _t = $"[{chain}] lifepose";
            var me = new GameObject("LifePoseTest_Me");
            var npc = new GameObject("LifePoseTest_Npc");
            try
            {
                // ① 나
                bool hold = false;
                var p = LifePose.Attach(me, false, () => hold);
                for (int i = 0; i < 79; i++) p.Step(0.1f, true, null, null);
                if (p.SitW > 0f) Fail($"8초 전에 앉음 {p.StillT:F1}");
                for (int i = 0; i < 4; i++) p.Step(0.1f, true, null, null);
                if (p.SitW < 0.99f) Fail($"8.3초 뒤 앉기 {p.SitW:F2}");
                if (p.Play(LifePose.Act.Wave)) Fail("앉은 채 몸짓");
                p.Step(0.1f, false, null, null);
                if (p.StillT != 0f || p.SitW > 0.61f) Fail($"움직였는데 {p.StillT}·{p.SitW:F2}");
                for (int i = 0; i < 2; i++) p.Step(0.1f, false, null, null);
                if (p.SitW > 0f) Fail("0.25초 뒤에도 앉음");
                hold = true;
                for (int i = 0; i < 100; i++) p.Step(0.1f, true, null, null);
                if (p.SitW > 0f) Fail("hold 인데 앉음");

                // ② 주민
                var n = LifePose.Attach(npc, true);
                n.ResetForTest();
                Vector3 far = new Vector3(20f, 0f, 0f), near = new Vector3(2f, 0f, 0f), camFar = new Vector3(0f, 0f, 100f), camNear = new Vector3(0f, 2f, 8f);
                n.Step(0.1f, true, far, camFar);
                n.Step(0.1f, true, near, camFar);
                if (n.Greets != 1 || n.Current != LifePose.Act.Wave) Fail($"인사 {n.Greets}·{n.Current}");
                n.Step(0.1f, true, near, camFar);
                if (n.Greets != 1) Fail("서 있기만 해도 또 인사");
                for (int i = 0; i < 20; i++) n.Step(0.1f, true, far, camFar);
                n.Step(0.1f, true, near, camFar);
                if (n.Greets != 2) Fail("나갔다 와도 인사 없음");
                for (int i = 0; i < 20; i++) n.Step(0.1f, true, far, camFar);
                n.ResetForTest();
                for (int i = 0; i < 100; i++) n.Step(0.1f, true, far, camFar);
                if (n.Current != LifePose.Act.None) Fail($"카메라 먼데 {n.Current}");
                bool idleSeen = false;
                for (int i = 0; i < 60 && !idleSeen; i++) { n.Step(0.1f, true, far, camNear); idleSeen = n.Current == LifePose.Act.Look || n.Current == LifePose.Act.Shift; }
                if (!idleSeen) Fail("카메라 가까운데 둘러보기·체중 없음");

                // ③ 씬 연결
                var playerGo = GameObject.FindWithTag("Player");
                var mine = playerGo != null ? playerGo.GetComponent<LifePose>() : null;
                if (game != "realm" && (mine == null || mine.Npc)) Fail("나에게 LifePose 없음");
                int npcs = 0, humans = 0;
                foreach (var lp in Object.FindObjectsByType<LifePose>(FindObjectsSortMode.None))
                {
                    if (lp.gameObject == me || lp.gameObject == npc || !lp.Npc) continue;
                    npcs++;
                    lp.Bind();
                    if (lp.Humanoid) humans++;
                }

                // ④ 사람 몸 앉기
                string body = "몸 없음(폴백)";
                if (mine != null)
                {
                    mine.Bind();
                    if (mine.Humanoid)
                    {
                        var anim = playerGo.GetComponentInChildren<Animator>();
                        var hips = anim.GetBoneTransform(HumanBodyBones.Hips);
                        float y0 = hips.position.y;
                        mine.ResetForTest();
                        for (int i = 0; i < 90; i++) mine.Step(0.1f, true, null, null);
                        if (mine.SitW > 0.99f)
                        {
                            mine.Apply();
                            float dy = y0 - hips.position.y;
                            float gap = mine.SitHipGap, wk = mine.SitWristKnee; // tasks U-0235 엉덩이 땅에·손 무릎 위
                            if (Mathf.Abs(gap) > 0.03f || wk > 0.08f) Fail($"앉기 엉덩이 살–땅 {gap:F3}m·손목–무릎 {wk:F3}m(몸 크기 나눔)");
                            mine.ResetForTest();
                            mine.Apply();
                            float back = Mathf.Abs(hips.position.y - y0);
                            if (dy < 0.2f || back > 0.01f) Fail($"앉기 엉덩이 내림 {dy:F2}m·되돌림 {back:F3}");
                            body = $"엉덩이 {dy:F2}m 내림·살–땅 {gap:F3}·손목–무릎 {wk:F3}·되돌림";
                        }
                        else body = "판 hold 로 안 앉음(그대로)";
                        mine.ResetForTest();
                    }
                }
                if (_ok) Debug.Log($"{_t} OK - 8초 앉기·0.25초 일어남·hold·앉은 채 몸짓 없음 · 인사 한 번/다시·카메라 멀면 없음·가까우면 둘러보기/체중 · 나 {(mine != null ? "○" : "-")}·주민 {npcs}(사람 몸 {humans}) · {body}");
            }
            catch (System.Exception ex) { Fail("예외 " + ex); }
            finally
            {
                Object.DestroyImmediate(me);
                Object.DestroyImmediate(npc);
            }
            return _ok;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{_t} FAIL - {why}");
        }
    }
}
