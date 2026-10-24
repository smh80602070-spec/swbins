using System;
using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0206 3마을 벌집(고돗 G-0346 짝) 진단 — `PlaytestForestHeadless` 가 물약(brew) 뒤에 부른다(한 프레임 안, 걸음은 Step 으로 직접).
    /// ① 굴림(날 하나 자리 1000 ≈ 20% · 같은 날·자리 같은 값 · 나무마다 하루 한 번) ② 쫓음(7m/s — 걷기 6 &lt; 7 &lt; 달리기 10)
    /// ③ 잡기(1.2m 안 모임·단추 보임 → 단추 누름 = 곤충 도감 · 사라짐) ④ 쏘임(0.8초 뒤 · MoveMul 0 1.2초 · 벌떼가 지워져도 풀림)
    /// ⑤ 흩어짐(8초) ⑥ 탈것 위 안 뜸(굴림 소비)·SAGA_BEES=0. 끝나면 도감·벌떼·탈것 손잡이·시계를 시작 때로.
    /// </summary>
    public static class PlaytestForestBees
    {
        private const string T = "[PlaytestForestHeadless] bees";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string[] museum0 = ForestMuseumState.Snapshot();
            string env0 = Environment.GetEnvironmentVariable("SAGA_BEES");
            int score0 = ForestMounts.ScoreForTest;
            bool rode0 = ForestMounts.Riding != null;
            Vector3 at = new Vector3(500f, 0f, 500f); // 마을 밖 — 진짜 플레이어와 겹치지 않게(Step 에 자리를 직접 준다)
            try
            {
                Environment.SetEnvironmentVariable("SAGA_BEES", null);
                ForestBees.ResetForTest();
                if (rode0) ForestMounts.Dismount();
                int today = ForestVisitors.Today;

                // ① 굴림
                Begin();
                int hits = 0;
                for (int i = 0; i < 1000; i++) if (ForestBees.HiveRoll(today, ForestBees.TreeKey(at + new Vector3(i * 3, 0f, 0f)))) hits++;
                if (hits < 150 || hits > 250) Fail($"자리 1000 에 {hits}");
                Vector3 hit = FindTree(at, today, true, 0), miss = FindTree(at, today, false, 0);
                if (ForestBees.HiveRoll(today, ForestBees.TreeKey(hit)) != ForestBees.HiveRoll(today, ForestBees.TreeKey(hit))) Fail("같은 날·자리인데 값이 다름");
                if (ForestBees.OnShake(miss) != null || ForestBees.Rolled != 1 || ForestBees.Spawned != 0) Fail("빗나간 나무에 벌떼");
                var b1 = ForestBees.OnShake(hit);
                if (b1 == null || ForestBees.Rolled != 2 || ForestBees.Spawned != 1 || ForestBees.Active != b1) Fail("벌집 나무인데 안 나옴");
                if (b1 != null && b1.transform.childCount != ForestBees.NBees) Fail($"알갱이 {b1?.transform.childCount}");
                if (ForestBees.OnShake(hit) != null || ForestBees.OnShake(miss) != null || ForestBees.Rolled != 2) Fail("같은 날 두 번 굴림");
                End($"roll OK - 자리 1000 에 {hits}(20%) · 같은 날·자리 같은 값 · 나무마다 하루 한 번 · 알갱이 {ForestBees.NBees}");

                // ② 쫓음
                Begin();
                if (!(6f < ForestBees.Speed && ForestBees.Speed < 10f)) Fail("속도가 걷기·달리기 사이 아님");
                Vector3 p0 = b1.transform.position;
                Vector3 far = p0 + Vector3.right * 10f - Vector3.up * 1.2f; // 목표(머리 높이) = 정확히 오른쪽 10m
                b1.Step(0.1f, far);
                float moved = Vector3.Distance(b1.transform.position, p0);
                if (Mathf.Abs(moved - 0.7f) > 0.01f || b1.State != ForestBees.S.Chase) Fail($"0.1초 {moved:0.00}m·{b1.State}");
                End($"chase OK - 0.1초 {moved:0.00}m(7m/s, 걷기 6 < 7 < 달리기 10)");

                // ③ 잡기
                Begin();
                Vector3 near = b1.transform.position + Vector3.right * 1.0f - Vector3.up * 1.2f;
                b1.Step(0.02f, near);
                if (b1.State != ForestBees.S.Gather || !b1.ButtonShown) Fail($"1.2m 안인데 {b1.State}·단추 {b1.ButtonShown}");
                ForestMuseumState.Restore(new string[0]); // 빈 도감에서 — 끝에 되돌린다
                int insect0 = ForestMuseumState.DiscoveredCountOf(ForestMuseumState.Category.Insect);
                b1.CatchButton?.onClick.Invoke();
                int insect1 = ForestMuseumState.DiscoveredCountOf(ForestMuseumState.Category.Insect);
                if (ForestBees.Caught != 1 || b1.State != ForestBees.S.Done || b1.ButtonShown) Fail("단추로 안 잡힘");
                if (insect1 != insect0 + 1) Fail($"곤충 도감 {insect0} → {insect1}");
                if (b1.TryCatch() != null || ForestBees.Caught != 1) Fail("두 번 잡힘");
                b1.Step(ForestBees.FinishSec + 0.01f, near);
                if (!b1.Gone || ForestBees.Active != null || ForestBees.MoveMul != 1f) Fail("잡은 뒤 안 사라짐·못 움직임");
                End($"catch OK - 1.2m 안 모임·단추 → 곤충 도감 {insect0} → {insect1} · 사라짐 · 쏘임 없음");

                // ④ 쏘임
                Begin();
                ForestBees.NowForTest = 100f;
                var b2 = ForestBees.Spawn(at);
                Vector3 n2 = b2.transform.position + Vector3.right * 0.5f - Vector3.up * 1.2f;
                b2.Step(0.02f, n2);
                b2.Step(ForestBees.GatherSec - 0.1f, n2);
                if (b2.State != ForestBees.S.Gather || ForestBees.Stung != 0) Fail("0.8초 전에 쏨");
                b2.Step(0.15f, n2);
                if (ForestBees.Stung != 1 || ForestBees.MoveMul != 0f || b2.ButtonShown) Fail($"안 쏨(쏘임 {ForestBees.Stung}·배율 {ForestBees.MoveMul})");
                if (b2.TryCatch() != null) Fail("쏜 뒤 잡힘");
                b2.Step(ForestBees.FinishSec + 0.01f, n2);
                ForestBees.NowForTest = 101.1f;
                if (!b2.Gone || ForestBees.MoveMul != 0f) Fail("벌떼가 지워지며 쏘임이 먼저 풀림");
                ForestBees.NowForTest = 101.21f;
                if (ForestBees.MoveMul != 1f) Fail("1.2초 뒤에도 못 움직임");
                End("sting OK - 0.8초 모였다 쏨 · 1.2초 못 움직임(MoveMul 0, 벌떼가 먼저 지워져도 시각으로 풀림) · 쏜 뒤 못 잡음");

                // ⑤ 흩어짐
                Begin();
                var b3 = ForestBees.Spawn(at);
                Vector3 run = at + Vector3.right * 200f;
                b3.Step(7.9f, run);
                if (b3.State != ForestBees.S.Chase) Fail("8초 전에 흩어짐");
                b3.Step(0.2f, run);
                if (b3.State != ForestBees.S.Done || ForestBees.Fled != 1 || ForestBees.Stung != 1) Fail("8초 지나도 쫓음");
                b3.Step(ForestBees.FinishSec + 0.01f, run);
                if (!b3.Gone) Fail("흩어진 뒤 남음");
                End("scatter OK - 8초 동안 못 붙으면 흩어짐 · 쏘임 없음");

                // ⑥ 탈것·손잡이
                Begin();
                int rolled = ForestBees.Rolled, spawned = ForestBees.Spawned;
                Vector3 hit2 = FindTree(at, today, true, 1), hit3 = FindTree(at, today, true, 2);
                ForestMounts.ScoreForTest = 99999;
                if (!ForestMounts.TryRide(Vector3.zero, out string why)) Fail($"못 탐({why})");
                if (ForestBees.OnShake(hit2) != null || ForestBees.Rolled != rolled + 1 || ForestBees.Spawned != spawned) Fail("탈것 위인데 벌떼");
                ForestMounts.Dismount();
                if (ForestBees.OnShake(hit2) != null || ForestBees.Rolled != rolled + 1) Fail("탈것 위 굴림이 소비 안 됨");
                Environment.SetEnvironmentVariable("SAGA_BEES", "0");
                if (ForestBees.OnShake(hit3) != null || ForestBees.Spawned != spawned || ForestBees.Active != null) Fail("SAGA_BEES=0 인데 벌떼");
                End("off OK - 탈것 위 안 뜸(굴림 소비 — 내려도 그날 그 나무 다시 안 굴림) · SAGA_BEES=0 이면 벌집 없음");
            }
            catch (Exception e)
            {
                Fail(e.ToString());
            }
            finally
            {
                Environment.SetEnvironmentVariable("SAGA_BEES", env0);
                ForestMounts.Dismount();
                ForestMounts.ScoreForTest = score0;
                if (rode0) ForestMounts.TryRide(Vector3.zero, out _);
                ForestBees.ResetForTest();
                ForestBees.NowForTest = null;
                ForestMuseumState.Restore(museum0);
            }
            return _ok;
        }

        /// <summary>그날 벌집이(hive) 떨어지는/안 떨어지는 n 번째 자리.</summary>
        private static Vector3 FindTree(Vector3 at, int day, bool hive, int nth)
        {
            for (int i = 0; i < 5000; i++)
            {
                var p = at + new Vector3(0f, 0f, 3f + i * 3f);
                if (ForestBees.HiveRoll(day, ForestBees.TreeKey(p)) == hive && nth-- == 0) return p;
            }
            throw new InvalidOperationException("자리 못 찾음");
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
