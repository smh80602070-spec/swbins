using System.Linq;
using UnityEngine;
using Saga.Go.Combat;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0211 1만리 들판 적 버그 고침 진단 — `PlaytestHeadless` 가 보스 약점 뒤에 부른다(한 프레임 안, 흐름은 `Tick` 직접).
    /// ① 잡힌 채 쓰러짐 → EndHold 뒤에도 90초 전엔 안 섬(90초 지나면 섬) ③ 고리 예고 중 넘어짐·귀가 → 고리 테 꺼짐·Parryable 되돌림
    /// ④ 제단 노린 한 대가 쳐내기로 끊기면 표시가 풀려 다음 한 대는 제단을 안 침(나를 노림). 끝나면 적을 집으로 되살린다.
    /// </summary>
    public static class PlaytestGoEnemyFixes
    {
        private const string T = "[PlaytestHeadless] enemyfix";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            var mob = FieldEnemy.All.FirstOrDefault(e => e != null && e.isActiveAndEnabled && !e.IsFieldBoss && !e.IsHero
                && !e.ShoveOnly && !e.DomainFoe && !e.StoryFoe && e.CurrentMove == null);
            if (mob == null) { Debug.LogError($"{T} FAIL - 잡을 수 있는 잡몹 없음"); return false; }
            int siegeHits = 0;
            System.Action<FieldEnemy, float> onSiege = (e, d) => { if (e == mob) siegeHits++; };
            FieldEnemy.SiegeHit += onSiege;
            try
            {
                // 내 자리에서 멀리 세운다(한 대가 나를 실제로 치지 않게 — 판정 길만 본다)
                mob.RestoreHomeForTest();
                var fc = FieldCombat.Instance;
                if (fc != null && (mob.transform.position - fc.transform.position).magnitude < 40f)
                    mob.WarpForTest(mob.transform.position + new Vector3(80f, 0f, 0f));

                // ① 잡힌 채 쓰러짐
                Begin();
                mob.SetShieldForTest(0f);
                mob.BeginHold();
                if (mob.HoldState != FieldEnemy.Hold.Grabbed) Fail($"안 잡힘 {mob.HoldState}");
                mob.TakeRaw(1e7f, Color.white);
                mob.EndHold(mob.transform.position); // FieldCombat.TickGrab 의 `!f.Alive` 길 그대로
                for (int i = 0; i < 10; i++) mob.Tick(1f);
                bool stillDown = !mob.Alive;
                for (int i = 0; i < 81; i++) mob.Tick(1f);
                if (!stillDown) Fail("잡힌 채 쓰러졌는데 10초 안에 다시 섬");
                else if (!mob.Alive) Fail($"{FieldEnemy.RespawnSec + 1}초가 지나도 안 섬");
                End($"hold OK - 잡힌 채 쓰러짐 → 10초 뒤에도 쓰러져 있음 · {FieldEnemy.RespawnSec + 1:0}초에 다시 섬");

                // ③ 고리 예고 끊김
                Begin();
                Vector3 here = mob.transform.position;
                mob.WarpForTest(here);
                mob.SetRotation(new[] { FieldEnemy.BossMove.Halo });
                mob.BeginTelegraphForTest(false);
                if (mob.HaloInnerNow <= 0f || !mob.HaloRingShown || mob.Parryable) Fail($"고리 예고가 안 섬 {mob.HaloInnerNow}·{mob.HaloRingShown}·{mob.Parryable}");
                mob.KnockDown(1f);
                mob.Tick(0.01f);
                if (mob.HaloInnerNow > 0f || mob.HaloRingShown || !mob.Parryable) Fail($"넘어졌는데 고리 남음 {mob.HaloInnerNow}·{mob.HaloRingShown}·쳐냄 {mob.Parryable}");
                mob.WarpForTest(here);
                mob.BeginTelegraphForTest(false);
                mob.ForceReturn();
                mob.Tick(0.01f);
                if (mob.HaloInnerNow > 0f || mob.HaloRingShown) Fail("귀가했는데 고리 남음");
                End("halo OK - 고리 예고 중 넘어짐·귀가 → 고리 테 꺼짐·안쪽 0·쳐낼 수 있음");
                mob.SetRotation(null);

                // ④ 제단 노린 한 대 끊김
                Begin();
                mob.WarpForTest(here);
                mob.SetSiege(mob.transform.position);
                mob.BeginTelegraphForTest(true);
                if (!mob.SiegeStrikeNow) Fail("제단 노림 표시가 안 섬");
                mob.Parried(0.3f);
                mob.Tick(0.01f);
                if (mob.SiegeStrikeNow) Fail("쳐냈는데 제단 노림 표시 남음");
                siegeHits = 0;
                mob.BeginTelegraphForTest(false);
                mob.ResolveStrike();
                int after = siegeHits;
                mob.BeginTelegraphForTest(true);
                mob.ResolveStrike();
                if (after != 0) Fail($"끊긴 뒤 다음 한 대가 또 제단을 침 {after}");
                else if (siegeHits != 1) Fail($"제단 노린 한 대가 제단을 안 침 {siegeHits}");
                End("siege OK - 제단 한 대 쳐내기로 끊김 → 표시 풀림 · 다음 한 대는 나를 노림(제단 0) · 다시 노리면 제단 1");
            }
            finally
            {
                FieldEnemy.SiegeHit -= onSiege;
                mob.SetRotation(null);
                mob.ClearSiegeForTest();
                mob.RestoreHomeForTest();
            }
            return _ok;
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
