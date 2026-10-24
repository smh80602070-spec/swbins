using System.Linq;
using UnityEngine;
using Saga.Go.Combat;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0203 1만리 보스 약점 부수기(고돗 G-0342 짝) 진단 — `PlaytestHeadless` 가 대치 뒤에 부른다(한 프레임 안).
    /// ① 보스 빛 공(몸 높이 0.85)·약점 체력 = 최대 × 0.12 · 잡몹엔 없음 ② 덜 깎으면 그대로 · 다 깎으면 부서짐(비틀 2.5초·빛 꺼짐)
    /// ③ 부서진 뒤 공격 ×0.85 · 또 맞아도 그대로 ④ 되살면 다시 섬 ⑤ 손잡이.
    /// </summary>
    public static class PlaytestGoWeakPart
    {
        private const string T = "[PlaytestHeadless] weakpart";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            var boss = FieldEnemy.GuardianInstance ?? FieldEnemy.All.FirstOrDefault(e => e != null && e.IsFieldBoss);
            var mob = FieldEnemy.All.FirstOrDefault(e => e != null && !e.IsFieldBoss && !e.IsHero);
            if (boss == null || mob == null) { Debug.LogError($"{T} FAIL - 보스·잡몹 없음"); return false; }
            try
            {
                boss.RestoreHomeForTest();
                mob.RestoreHomeForTest();

                // ① 표식
                Begin();
                boss.EnsurePartMark();
                mob.EnsurePartMark();
                var mark = boss.PartMark;
                if (mark == null || !mark.activeSelf) Fail("보스 빛 공 없음");
                else if (Mathf.Abs(mark.transform.position.y - boss.transform.position.y - boss.BodyTop * FieldEnemy.PartHeight) > 0.05f)
                    Fail($"빛 공 높이 {mark.transform.position.y - boss.transform.position.y:0.00} ≠ {boss.BodyTop * FieldEnemy.PartHeight:0.00}");
                if (Mathf.Abs(boss.PartMax - boss.MaxHp * FieldEnemy.PartFrac) > 0.01f) Fail($"약점 체력 {boss.PartMax} ≠ {boss.MaxHp * FieldEnemy.PartFrac}");
                if (mob.PartMark != null || mob.PartHit(99999f)) Fail("잡몹에 약점");
                End($"mark OK - {boss.name} 빛 공 높이 {boss.BodyTop * FieldEnemy.PartHeight:0.0}m · 약점 {boss.PartMax:0}/{boss.MaxHp:0} · 잡몹 없음");

                // ② 부수기
                Begin();
                bool b1 = boss.PartHit(boss.PartMax * 0.5f);
                if (b1 || boss.PartBroken || Mathf.Abs(boss.PartHp - boss.PartMax * 0.5f) > 0.01f) Fail($"반만 깎았는데 {boss.PartHp}");
                bool b2 = boss.PartHit(boss.PartMax);
                if (!b2 || !boss.PartBroken || boss.CurrentState != FieldEnemy.State.Stagger || (mark != null && mark.activeSelf)) Fail($"부서짐 {b2}·{boss.CurrentState}·빛 {mark?.activeSelf}");
                End("break OK - 반 = 그대로 · 다 깎음 = 부서짐·비틀·빛 꺼짐");

                // ③ 약해짐
                Begin();
                if (Mathf.Abs(boss.PartMul - FieldEnemy.PartAtkMul) > 1e-4f || boss.PartHit(99999f)) Fail($"약해짐 {boss.PartMul} · 또 부서짐");
                End($"weak OK - 공격 ×{boss.PartMul:0.00} · 또 맞아도 그대로");

                // ④ 되살기
                Begin();
                boss.RestoreHomeForTest();
                if (boss.PartBroken || boss.PartMul != 1f || Mathf.Abs(boss.PartHp - boss.PartMax) > 0.01f || (mark != null && !mark.activeSelf)) Fail("되살았는데 약점이 안 섬");
                End("reset OK - 되살면 약점·빛 다시");

                // ⑤ 손잡이
                Begin();
                FieldEnemy.WeakPartOn = false;
                if (boss.PartHit(99999f) || boss.PartBroken) Fail("껐는데 부서짐");
                End("off OK - 끄면 약점 없음");
            }
            finally
            {
                FieldEnemy.WeakPartOn = true;
                boss.RestoreHomeForTest();
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
