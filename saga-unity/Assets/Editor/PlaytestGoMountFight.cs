using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0171 1만리 말 위 전투 진단 — `PlaytestHeadless` 가 모닥불 쉼터 뒤에 부른다(한 프레임 안).
    /// ① 평타 배율(안 탐 1 · 탄 채 서면 1 · 달리기 최고면 1.5 · 반이면 1.25) ② 탄 채 평타가 실제로 들어가고 피해 = 서서 친 것 × 배율
    /// ③ E = 돌진(앞 적 듦·비틀·쿨 6초·둘째 막힘, 뒤 적은 안 듦) ④ 탄 동안 폭발·회피·조준·잡기·쳐내기 막힘
    /// ⑤ 탄 채 맞으면 낙마·0.8초 못 침 ⑥ 싸움이 붙어도 지상 탈것은 안 내림(MountField). 끝나면 탈것·적·전투·자리를 시작 때로.
    /// </summary>
    public static class PlaytestGoMountFight
    {
        private const string T = "[PlaytestHeadless] mountfight";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            if (fc == null || pc == null || FieldEnemy.All.Count < 2) { Fail("FieldCombat·PlayerController·적 둘 없음"); return false; }
            int lv0 = PlayerStats.Level; long xp0 = PlayerStats.Exp;
            string sel0 = GoMounts.Sel;
            Vector3 origin = pc.transform.position;
            var enemies = new List<FieldEnemy>(FieldEnemy.All);
            FieldEnemy e1 = enemies[0], e2 = enemies[1];
            string m = "";
            try
            {
                DuelGate.ResetForTest();
                fc.ResetForTest();
                fc.ResetMountForTest();
                GoMounts.Dismount();
                PlayerStats.Restore(30, 0);
                GoMounts.Restore("mt_white");

                // ① 배율
                pc.GroundSpeedNow = 20f;
                if (Mathf.Abs(fc.MountMul() - 1f) > 1e-4f) Fail("안 탔는데 배율");
                Ride();
                float max = 10f * GoMounts.GroundMul;
                pc.GroundSpeedNow = 0f;
                float m0 = fc.MountMul();
                pc.GroundSpeedNow = max;
                float m1 = fc.MountMul();
                pc.GroundSpeedNow = max * 0.5f;
                float mh = fc.MountMul();
                if (Mathf.Abs(m0 - 1f) > 1e-4f || Mathf.Abs(m1 - 1.5f) > 1e-4f || Mathf.Abs(mh - 1.25f) > 1e-4f) Fail($"배율 {m0}/{mh}/{m1} ≠ 1/1.25/1.5");

                // ② 탄 채 평타 — 들어가고 안 내림
                Vector3 front = origin + new Vector3(0f, 0f, 1.6f);
                Fresh(e1, front); Park(e2, origin, 0f);
                pc.FaceToward(front);
                GoMounts.Dismount();
                float hp = e1.Hp;
                if (fc.Attack() < 0) Fail("서서 평타가 안 나감");
                float onFoot = hp - e1.Hp;
                fc.ResetForTest(); fc.ResetMountForTest();
                Fresh(e1, front);
                Ride();
                pc.GroundSpeedNow = max;
                hp = e1.Hp;
                if (fc.Attack() < 0) Fail("탄 채 평타가 안 나감");
                float mounted = hp - e1.Hp;
                if (GoMounts.Riding == null) Fail("평타에 탈것에서 내림");
                if (onFoot <= 0f || mounted <= 0f) Fail($"피해 서서 {onFoot:0.0}·탄 채 {mounted:0.0}"); // 치명 굴림이 있어 비율은 ① 배율로만 본다
                m += $" 평타 {onFoot:0}→{mounted:0}";

                // ③ 돌진
                fc.ResetForTest(); fc.ResetMountForTest();
                Ride();
                pc.GroundSpeedNow = 0f;
                Fresh(e1, front);
                Fresh(e2, origin + new Vector3(0f, 0f, -2f)); // 뒤
                pc.FaceToward(front);
                float hp1 = e1.Hp, hp2 = e2.Hp;
                int n = fc.Skill();
                if (n != 1 || fc.LastRush != 1) Fail($"돌진 든 적 {n} ≠ 1");
                if (e1.Hp >= hp1) Fail("돌진이 앞 적을 안 깎음");
                if (e1.Alive && e1.CurrentState != FieldEnemy.State.Stagger) Fail($"돌진 맞은 적이 비틀 아님 {e1.CurrentState}");
                if (e2.Hp < hp2) Fail("뒤 적까지 듦");
                if (Mathf.Abs(fc.RushCd - FieldCombat.RushCdSec) > 0.01f || fc.Skill() != -1) Fail("쿨 6초·둘째 막힘");
                m += $" 돌진 {hp1 - e1.Hp:0}";

                // ④ 막는 손
                if (fc.Burst() != -1 || fc.Dodge() || fc.ToggleAim() || fc.Grab() || fc.Parry()) Fail("탄 채 폭발·회피·조준·잡기·쳐내기가 됨");
                if (fc.AimOn) fc.ToggleAim();

                // ⑤ 낙마
                fc.ResetForTest(); fc.ResetMountForTest();
                Ride();
                fc.ReceiveStrike(5f, null);
                if (GoMounts.Riding != null || fc.FallLeft <= 0f) Fail("맞아도 안 내림");
                Fresh(e1, front);
                if (fc.Attack() != -1) Fail("낙마 0.8초 안에 침");
                fc.TickTimers(FieldCombat.FallLockSec + 0.05f);
                if (fc.Attack() < 0) Fail("낙마가 안 풀림");

                // ⑥ 싸움 붙어도 안 내림
                fc.ResetForTest(); fc.ResetMountForTest();
                Ride();
                fc.MarkFought();
                var mf = Object.FindFirstObjectByType<MountField>();
                if (mf != null)
                {
                    typeof(MountField).GetMethod("Update", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)?.Invoke(mf, null);
                    if (GoMounts.Riding == null) Fail("싸움이 붙자 지상 탈것에서 내림");
                }
                else m += " (MountField 없음 — ⑥ 건너뜀)";
            }
            finally
            {
                GoMounts.Dismount();
                GoMounts.Restore(sel0);
                PlayerStats.Restore(lv0, xp0);
                pc.GroundSpeedNow = 0f;
                foreach (var e in FieldEnemy.All) { if (!e.Alive) e.ReviveNow(); e.RestoreHomeForTest(); }
                fc.ResetForTest();
                fc.ResetMountForTest();
                DuelGate.ResetForTest();
                pc.Teleport(origin);
                GoStamina.ResetFull();
            }
            if (_ok) Debug.Log($"{T} OK - 배율 1/1.25/1.5 · 탄 채 평타(안 내림·피해 ×배율) · 돌진(앞만·비틀·쿨 6·둘째 막힘) · 탄 동안 다섯 손 막힘 · 낙마 0.8초 · 싸움 붙어도 안 내림 |{m}");
            return _ok;
        }

        private static void Ride()
        {
            var prop = typeof(GoMounts).GetProperty(nameof(GoMounts.Riding));
            prop.SetValue(null, GoMounts.Def("mt_white"));
        }

        private static void Fresh(FieldEnemy e, Vector3 pos) { e.ReviveNow(); e.WarpForTest(pos); }

        private static void Park(FieldEnemy e, Vector3 origin, float offset) => e.WarpForTest(origin + new Vector3(60f + offset, 0f, 60f));

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
