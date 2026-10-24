using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Player;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0202 1만리 대치(고돗 G-0343 짝) 진단 — `PlaytestHeadless` 가 동료 우정 뒤에 부른다(한 프레임 안, 흐름은 `StepStandoffForTest`).
    /// ① 맞섬(쉬는 무리 곁 → 대치·전원 노려봄) ② 창 안 평타 = 한 칼·이어 달려듦·창 ×0.85 ③ 놓침 = 깨짐·남은 무리 쫓음 ④ 깬 무리 60초 안 다시 안 맞섬
    /// ⑤ 이르면 성급 ⑥ 헛몸짓에 누르면 성급 ⑦ 6m 벗어나면 풂(쫓지 않음) ⑧ 손잡이. 끝나면 적·싸움·자리를 처음으로.
    /// </summary>
    public static class PlaytestGoStandoff
    {
        private const string T = "[PlaytestHeadless] standoff";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            if (fc == null || pc == null) { Debug.LogError($"{T} FAIL - FieldCombat 없음"); return false; }
            try
            {
                FieldCombat.StandFeintChance = 0f;

                // ① 맞섬
                Begin();
                var group = Start(fc, pc, out var members);
                if (group == null) { Fail("셋 넘는 쉬는 무리 없음"); return false; }
                if (fc.Stand != FieldCombat.StandPhase.Wait || fc.StandGroup != group || members.Any(e => e.Stand != FieldEnemy.StandPose.Glare))
                    Fail($"맞섬 {fc.Stand}·{fc.StandGroup}≠{group}·노려봄 {members.Count(e => e.Stand == FieldEnemy.StandPose.Glare)}/{members.Count}");
                End($"start OK - 무리 {group} {members.Count} · 대치·전원 노려봄");

                // ② 한 칼
                Begin();
                fc.StepStandoffForTest(FieldCombat.StandWaitMax + 0.01f);
                var foe = fc.StandFoe;
                if (fc.Stand != FieldCombat.StandPhase.Lunge || foe == null || foe.Stand != FieldEnemy.StandPose.Lunge) Fail($"달려듦 {fc.Stand}");
                fc.StepStandoffForTest(FieldCombat.StandLungeSec + 0.01f);
                if (fc.Stand != FieldCombat.StandPhase.Window) Fail($"창 {fc.Stand}");
                fc.Attack();
                float w2 = fc.StandWindowNow;
                if (foe == null || foe.Alive || fc.StandKills != 1 || fc.LastStand != "strike") Fail($"한 칼 살아 있음 {foe?.Alive}·{fc.StandKills}·{fc.LastStand}");
                if (fc.Stand != FieldCombat.StandPhase.Wait) Fail($"한 칼 뒤 {fc.Stand}(이어 달려들어야)");
                if (Mathf.Abs(w2 - FieldCombat.StandWindowSec * FieldCombat.StandChain) > 0.001f) Fail($"다음 창 {w2}");
                End($"strike OK - 창 안 평타 한 칼(남은 {members.Count(e => e.Alive)}) · 다음 창 {w2:0.000}초");

                // ③ 놓침 · ④ 식음
                Begin();
                fc.StepStandoffForTest(FieldCombat.StandNextMax + 0.01f);
                fc.StepStandoffForTest(FieldCombat.StandLungeSec + 0.01f);
                fc.StepStandoffForTest(w2 + 0.01f);
                if (fc.LastStand != "miss" || fc.Stand != FieldCombat.StandPhase.None) Fail($"놓침 {fc.LastStand}·{fc.Stand}");
                if (members.Any(e => e.Alive && e.CurrentState != FieldEnemy.State.Chase)) Fail("깨졌는데 안 쫓음");
                foreach (var e in members) if (e.Alive) e.RestoreHomeForTest();
                pc.Teleport(members[0].transform.position + Vector3.right * 3f);
                fc.StepStandoffForTest(0.01f);
                bool cooled = fc.StandGroup == group && fc.Stand != FieldCombat.StandPhase.None;
                if (cooled) Fail("깬 무리가 60초 안에 또 맞섬");
                End("miss OK - 창 놓침 = 깨짐·남은 무리 쫓음 · 60초 안 다시 안 맞섬");

                // ⑤ 성급
                Begin();
                group = Start(fc, pc, out members);
                fc.Attack();
                if (fc.LastStand != "rash" || fc.Stand != FieldCombat.StandPhase.None || members.Any(e => e.Alive && e.CurrentState != FieldEnemy.State.Chase)) Fail($"성급 {fc.LastStand}");
                End("rash OK - 달려들기 전 평타 = 성급했다·무리 쫓음");

                // ⑥ 헛몸짓
                Begin();
                FieldCombat.StandFeintChance = 1f;
                group = Start(fc, pc, out members);
                fc.StepStandoffForTest(FieldCombat.StandWaitMax + 0.01f);
                bool feint = fc.Stand == FieldCombat.StandPhase.Feint && fc.StandFoe != null && fc.StandFoe.Stand == FieldEnemy.StandPose.Cue;
                fc.Attack();
                if (!feint || fc.LastStand != "rash") Fail($"헛몸짓 {feint}·{fc.LastStand}");
                FieldCombat.StandFeintChance = 0f;
                End("feint OK - 헛몸짓(움찔)에 누르면 성급");

                // ⑦ 벗어남
                Begin();
                group = Start(fc, pc, out members);
                pc.Teleport(fc.transform.position + Vector3.forward * (FieldCombat.StandLeave + 2f));
                fc.StepStandoffForTest(0.01f);
                if (fc.LastStand != "leave" || members.Any(e => e.Stand != FieldEnemy.StandPose.None || e.CurrentState == FieldEnemy.State.Chase)) Fail($"벗어남 {fc.LastStand}");
                End("leave OK - 6m 벗어나면 풂(쫓지 않음)");

                // ⑧ 손잡이
                Begin();
                FieldCombat.StandoffOn = false;
                var g = Start(fc, pc, out members);
                if (fc.Stand != FieldCombat.StandPhase.None) Fail("껐는데 맞섬");
                End("off OK - 끄면 옛 길");
            }
            finally
            {
                FieldCombat.StandoffOn = true;
                FieldCombat.StandFeintChance = 0.25f;
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                Saga.Go.Combat.GoStamina.ResetFull();
            }
            return _ok;
        }

        /// <summary>적·싸움을 되돌리고 셋 넘는 쉬는 무리 곁 3m 에 선 뒤 한 걸음.</summary>
        private static string Start(FieldCombat fc, PlayerController pc, out List<FieldEnemy> members)
        {
            foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            fc.ResetForTest();
            members = null;
            var grp = FieldEnemy.All.Where(e => e.StandoffOk && !string.IsNullOrEmpty(e.GroupId)).GroupBy(e => e.GroupId)
                .Where(x => x.Count() >= 3 && FieldEnemy.All.Where(e => e.GroupId == x.Key).All(e => e.StandoffOk)).OrderBy(x => x.Key).FirstOrDefault();
            if (grp == null) return null;
            members = FieldEnemy.All.Where(e => e.GroupId == grp.Key).ToList();
            pc.Teleport(members[0].transform.position + Vector3.right * 3f);
            fc.StepStandoffForTest(0.01f);
            return grp.Key;
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
