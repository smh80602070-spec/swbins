using System;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0205 2나락 피 구슬(고돗 G-0344 짝) 진단 — `PlaytestDungeonHeadless` 가 부대 우정 뒤에 부른다(한 프레임 안, 걸음은 Step 으로 직접).
    /// ① 떨굼(씨앗 20260824 잡졸 1000 ≈ 22% · 정예 1 · 두목 셋 0.8m 둘레) ② 끌림(3m 안 9m/s · 밖은 그대로) ③ 먹기(0.7m · 12% 올림 · 사라짐)
    /// ④ 가득(끌림·먹기 없음, 남음) ⑤ 수명(22초까지 그대로 · 마지막 3초 줄어듦 · 25초 사라짐) ⑥ SAGA_GLOBE=0. 끝나면 영웅·구슬·손잡이를 시작 때로.
    /// </summary>
    public static class PlaytestDungeonGlobe
    {
        private const string T = "[PlaytestDungeonHeadless] globe";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            int lv = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string weapon = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId;
            string env0 = Environment.GetEnvironmentVariable("SAGA_GLOBE");
            Vector3 at = new Vector3(500f, 0f, 500f); // 방 밖 — 진짜 플레이어와 겹치지 않게(Step 에 자리를 직접 준다)
            try
            {
                Environment.SetEnvironmentVariable("SAGA_GLOBE", null);
                HealthGlobe.ResetForTest();

                // ① 떨굼
                Begin();
                HealthGlobe.Rng = new System.Random(20260824);
                int grunt = 0;
                for (int i = 0; i < 1000; i++) { grunt += HealthGlobe.Drop(at, false, false); HealthGlobe.ResetForTest(); }
                if (grunt < 180 || grunt > 260) Fail($"잡졸 1000 에 {grunt}");
                if (HealthGlobe.Drop(at, false, true) != 1) Fail("정예 1 아님");
                HealthGlobe.ResetForTest();
                int boss = HealthGlobe.Drop(at, true, false);
                if (boss != 3 || HealthGlobe.Active.Count != 3 || HealthGlobe.Dropped != 3) Fail($"두목 {boss}·살아 {HealthGlobe.Active.Count}");
                foreach (var g in HealthGlobe.Active)
                    if (Mathf.Abs(Vector3.Distance(g.transform.position, at) - HealthGlobe.SpreadM) > 0.01f) Fail("두목 구슬 둘레 아님");
                End($"drop OK - 잡졸 1000 에 {grunt}(22%) · 정예 1 · 두목 3(0.8m 둘레)");

                // ② 끌림
                Begin();
                HealthGlobe.ResetForTest();
                SetHp(1);
                HealthGlobe.Drop(at, false, true);
                var g1 = HealthGlobe.Active[0];
                Vector3 far = at + Vector3.right * 4f;
                g1.Step(0.1f, far);
                if (Vector3.Distance(g1.transform.position, at) > 0.001f) Fail("4m 인데 끌림");
                Vector3 near = at + Vector3.right * 2.5f;
                g1.Step(0.1f, near);
                float moved = g1.transform.position.x - at.x;
                if (Mathf.Abs(moved - 0.9f) > 0.01f || HealthGlobe.Eaten != 0) Fail($"2.5m 에서 0.1초 {moved:0.00}m");
                End($"pull OK - 4m 그대로 · 2.5m 에서 0.1초 {moved:0.00}m(9m/s)");

                // ③ 먹기
                Begin();
                int before = HeroState.Hp;
                g1.Step(0.02f, g1.transform.position + Vector3.right * 0.5f); // 0.7m 안
                int got = HeroState.Hp - before;
                if (!g1.Gone || HealthGlobe.Eaten != 1) Fail($"안 먹음(남음 {!g1.Gone}·먹음 {HealthGlobe.Eaten})");
                if (got != HealthGlobe.HealAmount || got != Math.Max(1, Mathf.CeilToInt(HeroState.HpMax * 0.12f))) Fail($"회복 {got} ≠ {HealthGlobe.HealAmount}");
                End($"eat OK - 0.7m 안 먹음 · 최대 {HeroState.HpMax} 의 12% 올림 +{got} · 사라짐");

                // ④ 가득
                Begin();
                HealthGlobe.ResetForTest();
                SetHp(HeroState.HpMax);
                HealthGlobe.Drop(at, false, true);
                var g2 = HealthGlobe.Active[0];
                g2.Step(0.1f, near);
                g2.Step(0.1f, at);
                if (g2.Gone || HealthGlobe.Eaten != 0 || Vector3.Distance(g2.transform.position, at) > 0.001f) Fail("가득인데 끌림·먹음");
                if (g2.Eat(at) != 0) Fail("가득인데 Eat 이 채움");
                End("full OK - 가득이면 끌림·먹기 없음, 제자리에 남음");

                // ⑤ 수명
                Begin();
                var vis = g2.transform.Find("Visual");
                float s0 = vis.localScale.x;
                g2.Step(21.7f, null);
                if (g2.Gone || Mathf.Abs(vis.localScale.x - s0) > 0.001f) Fail("22초 전에 흐려짐");
                g2.Step(1.7f, null); // 23.6초
                float s1 = vis.localScale.x;
                if (g2.Gone || s1 >= s0 || s1 <= 0f) Fail($"마지막 3초 줄어듦 아님({s1:0.00})");
                g2.Step(1.6f, null);
                if (!g2.Gone) Fail("25초 뒤 남음");
                End($"life OK - 22초까지 그대로 · 23.6초 {s1 / s0:0.00} · 25초 사라짐");

                // ⑥ 손잡이
                Begin();
                HealthGlobe.ResetForTest();
                Environment.SetEnvironmentVariable("SAGA_GLOBE", "0");
                if (HealthGlobe.Drop(at, true, false) != 0 || HealthGlobe.Active.Count != 0) Fail("SAGA_GLOBE=0 인데 떨굼");
                End("off OK - SAGA_GLOBE=0 이면 두목도 안 떨굼");
            }
            finally
            {
                Environment.SetEnvironmentVariable("SAGA_GLOBE", env0);
                HealthGlobe.Rng = null;
                HealthGlobe.ResetForTest();
                HeroState.Restore(lv, exp, hp, gold, weapon, gem);
            }
            return _ok;
        }

        private static void SetHp(int v) =>
            HeroState.Restore(HeroState.Level, HeroState.Exp, v, HeroState.Gold, HeroState.EquippedWeaponId, HeroState.SocketedGemId);

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
