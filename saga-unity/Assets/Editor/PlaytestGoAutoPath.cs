using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0190 1만리 자동 퀘스트 길찾기 진단 — `PlaytestHeadless` 가 자동 퀘스트 뒤에 부른다(한 프레임 안).
    /// ① 가짜 격자: 곧은 들판 = 경유점 하나 · 긴 담(x=5, z −10~10) = 돌아가는 길(담 칸을 안 지남·끝 = 목표) · 둘레가 다 막힘 = null · 높은 턱(3m) 너머 목표 = 턱에 안 올라감
    /// ② 앞 막힘 감지 ③ 진짜 물리: 주인공 앞 3m 에 임시 벽(1×4×12)을 세우면 벽을 지나지 않는 길 · 자동 퀘스트 TryPlan 이 길을 쥠. 끝나면 벽·손잡이를 치운다.
    /// </summary>
    public static class PlaytestGoAutoPath
    {
        private const string T = "[PlaytestHeadless] autopath";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            string m = "";
            GameObject wall = null;
            try
            {
                // ① 가짜 격자
                GoAutoPath.CellForTest = (x, z) => (true, 0f);
                var open = GoAutoPath.Plan(Vector3.zero, new Vector3(12f, 0f, 3f), null);
                if (open == null || open.Count != 1) Fail($"곧은 들판 경유점 {open?.Count}");
                var far = GoAutoPath.Plan(Vector3.zero, new Vector3(200f, 0f, 0f), null);   // U-0197 창 밖 목표 — 칸 상한 안에서도 목표 쪽으로
                if (far == null || far[far.Count - 1].x < 20f) Fail($"창 밖 목표 — 끝 {(far == null ? "null" : far[far.Count - 1].ToString())}");
                else m += $" 창 밖 목표 끝 x {far[far.Count - 1].x:0}";

                GoAutoPath.CellForTest = Wall;
                var around = GoAutoPath.Plan(Vector3.zero, new Vector3(12f, 0f, 0f), null);
                if (around == null) Fail("담 — 길 없음");
                else
                {
                    if (Crosses(Vector3.zero, around, (x, z) => !Wall(x, z).open)) Fail("담 칸을 지나는 길");
                    Vector3 end = around[around.Count - 1];
                    if (Mathf.Abs(end.x - 12f) > 0.01f || Mathf.Abs(end.z) > 0.01f) Fail($"끝 {end}");
                    if (around.Count > 4) Fail($"경유점이 많음 {around.Count}");
                    m += $" 담 경유점 {around.Count}";
                }

                GoAutoPath.CellForTest = (x, z) => (new Vector2(x, z).magnitude < 3f || new Vector2(x, z).magnitude > 5f, 0f);
                if (GoAutoPath.Plan(Vector3.zero, new Vector3(20f, 0f, 0f), null) != null) Fail("갇혔는데 길");

                GoAutoPath.CellForTest = (x, z) => (true, x > 5f ? 3f : 0f);
                var ledge = GoAutoPath.Plan(Vector3.zero, new Vector3(12f, 3f, 0f), null);
                if (ledge != null && Crosses(Vector3.zero, ledge, (x, z) => x > 5.76f)) Fail("3m 턱 위로 올라가는 길");

                // ② 앞 막힘
                GoAutoPath.CellForTest = Wall;
                if (!GoAutoPath.BlockedAhead(new Vector3(3.5f, 0f, 0f), Vector3.right, null)) Fail("담 앞인데 안 막힘");
                if (GoAutoPath.BlockedAhead(new Vector3(3.5f, 0f, 0f), Vector3.left, null)) Fail("뒤로는 막힘");
                GoAutoPath.CellForTest = null;

                // ③ 진짜 물리
                var fc = FieldCombat.Instance;
                if (fc == null) Fail("주인공 없음");
                else
                {
                    Vector3 me = fc.transform.position;
                    Vector3 fw = fc.transform.forward; fw.y = 0f; fw = fw.sqrMagnitude > 0.01f ? fw.normalized : Vector3.forward;
                    wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    wall.name = "AutoPathTestWall";
                    wall.transform.position = me + fw * 3f + Vector3.up * 1.5f;
                    wall.transform.rotation = Quaternion.LookRotation(fw);
                    wall.transform.localScale = new Vector3(12f, 4f, 1f);
                    Physics.SyncTransforms();
                    var box = wall.GetComponent<BoxCollider>();
                    Vector3 goal = me + fw * 10f;
                    if (!GoAutoPath.BlockedAhead(me, fw, fc.transform)) Fail("벽 앞인데 안 막힘");
                    var sw = System.Diagnostics.Stopwatch.StartNew();
                    var way = GoAutoPath.Plan(me, goal, fc.transform);
                    double msWall = sw.Elapsed.TotalMilliseconds;
                    // R-5 — 목표가 창 밖이면 61×61 칸을 다 잰다(가장 무거운 꼴) — 걸린 시간을 남긴다
                    sw.Restart();
                    GoAutoPath.Plan(me, me + fw * 200f, fc.transform);
                    double msFar = sw.Elapsed.TotalMilliseconds;
                    m += $" · 길 내기 {msWall:0.0}ms(벽)·{msFar:0.0}ms(창 밖 목표)";
                    if (way == null) Fail("벽 — 길 없음");
                    else
                    {
                        if (Crosses(me, way, (x, z) => Inside(box, new Vector3(x, wall.transform.position.y, z)))) Fail("벽을 지나는 길");
                        m += $" · 벽 경유점 {way.Count}";
                    }
                    var aq = GoAutoQuest.Instance;
                    if (aq != null)
                    {
                        int p0 = aq.Plans;
                        if (!aq.TryPlan(me, goal, fc.transform) || aq.Plans != p0 + 1 || aq.Path == null) Fail("자동 퀘스트 TryPlan");
                    }
                }
            }
            finally
            {
                GoAutoPath.CellForTest = null;
                if (wall != null) Object.DestroyImmediate(wall);
                Physics.SyncTransforms();
            }
            if (_ok) Debug.Log($"{T} OK - 곧은 들판 하나 · 담 돌아감(담 칸 안 지남·끝 = 목표) · 갇힘 null · 3m 턱 안 오름 · 앞 막힘 감지 · 진짜 벽 돌아감 · TryPlan |{m}");
            return _ok;
        }

        /// <summary>x 4.5~5.5 · z −10~10 담.</summary>
        private static (bool open, float h) Wall(float x, float z) => (!(Mathf.Abs(x - 5f) < 0.8f && Mathf.Abs(z) <= 10.5f), 0f);

        private static bool Crosses(Vector3 from, List<Vector3> way, System.Func<float, float, bool> bad)
        {
            Vector3 a = from;
            foreach (var b in way)
            {
                int n = Mathf.CeilToInt(Vector2.Distance(new Vector2(a.x, a.z), new Vector2(b.x, b.z)) / 0.25f);
                for (int i = 0; i <= n; i++)
                {
                    Vector3 p = Vector3.Lerp(a, b, n == 0 ? 1f : i / (float)n);
                    if (bad(p.x, p.z)) return true;
                }
                a = b;
            }
            return false;
        }

        private static bool Inside(BoxCollider box, Vector3 p) => (box.ClosestPoint(p) - p).sqrMagnitude < 0.0001f;

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
