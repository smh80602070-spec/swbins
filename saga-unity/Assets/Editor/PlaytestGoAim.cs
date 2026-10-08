using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-22 "활 조준 사격·과녁 잠금"(웹 사가만리 ⑲-22 진단 항목) — `PlaytestHeadless` 가 세계 임무 진단 뒤에 부른다.
    /// 조준(칼은 못 함·걸음 막힘·어깨 너머 카메라·잠김·돌리면 풀림·덜 참 물리·다 참 원소·쉬는 적 급소·쫓는 적은 급소 아님·빈 곳 83m 끝 원소 신호 ·
    /// 점프·다른 인물이면 풀림·길게 누르면 조준·충전 → 쏘고 나옴) · 과녁(셋·거리·화살·서책 기본 공격·10초·늦으면 꺼짐·셋 → 풀림) ·
    /// 이야기 옛 제단에 잠겨 충전 화살로 불. 끝나면 동행·들판·상자 잠금·이야기·레벨·자리를 되돌린다.
    /// </summary>
    public static class PlaytestGoAim
    {
        private static string _tag;
        private static bool _ok;
        private static readonly List<(FieldEnemy e, float hp)> _tough = new List<(FieldEnemy, float)>();

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var b = WorldMapBuilder.Instance;
            if (fc == null || pc == null || b == null) { Fail("FieldCombat/PlayerController/WorldMapBuilder 없음"); return false; }
            var start = new List<string>(PartyState.MemberIds);
            bool off0 = StoryState.OffForTest;
            int ch0 = StoryState.Ch, st0 = StoryState.StepIndex, lv0 = PlayerStats.Level; long exp0 = PlayerStats.Exp;
            var chest = b.Chests.FirstOrDefault(c => c != null && c.Data.Lock == GoTreasure.Lock.Targets);
            var parts = new List<string>();
            try
            {
                PlayerStats.Restore(1, 0);
                FieldCombat.CritOffForTest = true;
                CheckAim(fc, pc, parts);
                if (chest == null) Fail("과녁 상자가 없다"); else CheckTargets(fc, pc, chest, parts);
                CheckStory(fc, pc, parts);
            }
            finally
            {
                FieldCombat.CritOffForTest = false;
                fc.ExitAim();
                fc.ResetForTest();
                chest?.ResetLockForTest();
                foreach (var (e, hp) in _tough) if (e != null) e.SetMaxHpForTest(hp);
                _tough.Clear();
                StoryState.Restore(ch0, st0);
                StoryState.OffForTest = off0;
                StoryField.Instance?.ResetForTest();
                PlayerStats.Restore(lv0, exp0);
                PartyState.Restore(start);
                fc.RebuildParty();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] aim OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        /// <summary>그 사람만 동행으로 둬 앞에 세운다.</summary>
        private static bool Lead(FieldCombat fc, string id)
        {
            PartyState.Restore(new List<string> { id });
            fc.RebuildParty();
            fc.ResetForTest();
            for (int i = 0; i < fc.Party.Count; i++)
                if (fc.Party[i].Id == id) { if (i == 0 || fc.Swap(i)) { fc.ResetForTest(); if (i != 0) fc.Swap(i); return fc.Active.Id == id; } }
            Fail($"{id} 를 앞에 못 세움");
            return false;
        }

        private static string HeroOf(GoWeapons.Type t) => GoHeroes.All.First(h => GoWeapons.TypeOf(h.Id) == t).Id;

        private static FieldEnemy Foe(Vector3 pos, FieldEnemy not = null)
        {
            var e = FieldEnemy.All.First(x => !x.IsGuardian && !x.IsHero && !x.DomainFoe && !x.StoryFoe && x.Alive && x != not);
            e.ReviveNow();
            _tough.Add((e, e.MaxHp));
            e.SetMaxHpForTest(e.MaxHp * 30f);
            e.WarpForTest(pos);
            if (e.Shielded) e.SetShieldForTest(0f);
            return e;
        }

        private static void Fly(FieldCombat fc)
        {
            for (int i = 0; i < 40 && fc.ArrowCount > 0; i++) fc.TickTimers(0.05f);
        }

        private static void Shoot(FieldCombat fc, float charge)
        {
            fc.TickHold(true, 0.02f);
            fc.TickAim(charge, 0f);
            fc.TickHold(false, 0.02f);
            Fly(fc);
        }

        private static void CheckAim(FieldCombat fc, PlayerController pc, List<string> parts)
        {
            if (!Lead(fc, HeroOf(GoWeapons.Type.Sword))) return;
            pc.Teleport(fc.SafePoint);
            if (fc.EnterAim() || fc.AimOn) Fail("칼 인물이 조준함");
            string bowId = HeroOf(GoWeapons.Type.Bow);
            if (!Lead(fc, bowId)) return;
            pc.Teleport(fc.SafePoint);
            Vector3 f = pc.Visual != null ? pc.Visual.forward : pc.transform.forward;
            f.y = 0f; f.Normalize();
            var e = Foe(fc.transform.position + f * 20f);
            var rig = pc.GetComponentInChildren<CameraRig>();
            if (!fc.EnterAim() || !pc.MoveLocked || (rig != null && !rig.AimShot)) { Fail("활 인물 조준이 안 켜짐"); return; }
            if (fc.AimLock.Kind != FieldCombat.AimKind.Enemy || fc.AimLock.Enemy != e) Fail($"겨눈 적에 안 잠김 {fc.AimLock.Kind}");
            Vector3 p0 = pc.transform.position;
            pc.SetTestInput(new Vector2(0f, 1f), false);
            for (int i = 0; i < 10; i++) pc.Step(0.05f);
            pc.ClearTestInput();
            if (GoStory.Flat(pc.transform.position, p0) > 0.2f) Fail("조준 중인데 걸어감");
            fc.TickAim(0.5f, 1f);
            if (fc.AimLock.Enemy == e) Fail("돌렸는데 잠김이 안 풀림");
            fc.TickAim(0.5f, -1f);
            if (fc.AimLock.Enemy != e) Fail("되돌렸는데 안 잠김");
            // 덜 참 — 물리
            float hp = e.Hp;
            Shoot(fc, 0.3f);
            if (fc.LastArrow != "enemy" || !(e.Hp < hp) || fc.LastSneak || e.Aura != GoElement.Physical) Fail($"덜 찬 화살 {fc.LastArrow}·{hp}→{e.Hp}·급소 {fc.LastSneak}·{e.Aura}");
            float weak = hp - e.Hp;
            // 다 참 — 쉬는 적이면 급소(치명), 인물 원소
            e.WarpForTest(e.transform.position);
            if (e.Shielded) e.SetShieldForTest(0f);
            hp = e.Hp;
            Shoot(fc, 1.5f);
            float full = hp - e.Hp;
            if (fc.LastArrow != "enemy" || !fc.LastSneak || full <= weak * 2f) Fail($"다 찬 화살 급소 {fc.LastSneak}·{weak:0}→{full:0}");
            // 쫓는 적은 급소가 아니다
            e.WarpForTest(e.transform.position);
            if (e.Shielded) e.SetShieldForTest(0f);
            e.ForceChase();
            Shoot(fc, 1.5f);
            if (fc.LastArrow != "enemy" || fc.LastSneak) Fail("쫓는 적에 급소");
            // 빈 곳 — 83m 끝에서 원소 신호
            int pulses = 0;
            System.Action<Vector3, float, GoElement> onPulse = (c, r, el) => { if (Mathf.Abs(r - FieldCombat.ArrowSignalR) < 0.01f) pulses++; };
            FieldCombat.ElementPulse += onPulse;
            fc.TickAim(1.3f, 1f); // 옆으로 돌려 잠김 없이
            bool empty = fc.AimLock.Kind == FieldCombat.AimKind.None;
            Shoot(fc, 1.5f);
            FieldCombat.ElementPulse -= onPulse;
            if (!empty || fc.LastArrow != "miss" || pulses != 1) Fail($"빈 곳 화살 잠김 {!empty}·{fc.LastArrow}·신호 {pulses}");
            // 점프하면 풀린다
            pc.RequestJump();
            pc.Step(0.05f);
            fc.TickAim(0.05f, 0f);
            if (fc.AimOn || pc.MoveLocked || (rig != null && rig.AimShot)) Fail("점프했는데 조준이 남음");
            pc.Teleport(fc.SafePoint);
            // 다른(칼) 인물로 바뀌면 풀린다
            PartyState.Restore(new List<string> { bowId, HeroOf(GoWeapons.Type.Sword) });
            fc.RebuildParty();
            fc.ResetForTest();
            int bi = fc.Party.ToList().FindIndex(m => m.Id == bowId), si = fc.Party.ToList().FindIndex(m => m.Id != bowId && m.Id != FieldCombat.HeroId);
            fc.Swap(bi);
            fc.ResetForTest();
            fc.Swap(bi);
            if (!fc.EnterAim()) Fail("활로 바꾼 뒤 조준 못 함");
            fc.ResetForTest();
            fc.Swap(si);
            fc.TickAim(0.05f, 0f);
            if (fc.AimOn) Fail("칼 인물로 바꿨는데 조준이 남음");
            // 길게 누르면 조준·충전 → 떼면 쏘고 나온다
            if (!Lead(fc, bowId)) return;
            pc.Teleport(fc.SafePoint);
            fc.TickHold(true, 0.45f);
            if (!fc.AimOn || !fc.Charging) Fail("길게 눌렀는데 조준·충전이 아님");
            fc.TickAim(0.5f, 0f);
            fc.TickHold(false, 0.02f);
            Fly(fc);
            if (fc.AimOn || fc.LastArrow == null) Fail("떼었는데 안 쏘거나 조준이 남음");
            parts.Add($"칼 못 함·걸음 막힘·카메라·잠김/풀림·덜 참 물리 {weak:0}·다 참 급소 {full:0}·쫓는 적 급소 아님·빈 곳 신호·점프/칼 인물 풀림·길게 눌러 쏘고 나옴");
        }

        private static void CheckTargets(FieldCombat fc, PlayerController pc, TreasureChest chest, List<string> parts)
        {
            chest.ResetLockForTest();
            if (chest.Targets.Count != 3) { Fail($"과녁 {chest.Targets.Count}"); return; }
            for (int i = 0; i < 3; i++)
            {
                float d = GoStory.Flat(chest.Targets[i].position, chest.transform.position);
                if (Mathf.Abs(d - GoTreasure.TargetDist[i]) > 0.5f) Fail($"과녁 {i} 거리 {d:0.0}");
            }
            if (!Lead(fc, HeroOf(GoWeapons.Type.Bow))) return;
            Vector3 c = chest.transform.position;
            pc.Teleport(FolkWalker.Grounded(c + (c - chest.Targets[0].position).normalized * 3f + Vector3.up * 3f) + Vector3.up * 0.1f); // 상자 곁 고원 위
            fc.EnterAim();
            fc.AimToward(chest.TargetEye(0));
            if (fc.AimLock.Kind != FieldCombat.AimKind.Target || fc.AimLock.Index != 0) { Fail($"과녁 0 에 안 잠김 {fc.AimLock.Kind}"); return; }
            Shoot(fc, 0.2f);
            if (fc.LastArrow != "target" || !chest.TargetLit(0)) Fail("덜 찬 화살이 과녁을 못 맞힘");
            chest.Tick(GoTreasure.TargetLitSec + 0.3f, c + Vector3.up * 200f);
            if (chest.TargetLit(0)) Fail("10초 지나도 과녁 빛이 남음");
            fc.AimToward(chest.TargetEye(0));
            Shoot(fc, 0.2f);
            fc.AimToward(chest.TargetEye(2));
            Shoot(fc, 0.2f);
            if (chest.TargetLitCount != 2 || chest.Unlocked) Fail($"둘 켰는데 {chest.TargetLitCount}·풀림 {chest.Unlocked}");
            fc.ExitAim();
            // 서책 기본 공격 — 둘레에 적이 없으면 가장 가까운 과녁
            if (!Lead(fc, HeroOf(GoWeapons.Type.Catalyst))) return;
            Vector3 t1 = chest.Targets[1].position;
            pc.Teleport(FolkWalker.Grounded(t1 + (c - t1).normalized * 3f + Vector3.up * 3f) + Vector3.up * 0.1f);
            foreach (var e in FieldEnemy.All) if (e.Alive && GoStory.Flat(e.transform.position, pc.transform.position) < 15f) e.WarpForTest(e.transform.position + Vector3.right * 60f);
            fc.Attack();
            if (!chest.TargetLit(1) || !chest.Unlocked) Fail($"서책 기본 공격 과녁 {chest.TargetLit(1)}·풀림 {chest.Unlocked}");
            parts.Add("과녁 셋·거리 12/16/20·화살·10초 꺼짐·서책 기본 공격·셋 → 풀림");
        }

        private static void CheckStory(FieldCombat fc, PlayerController pc, List<string> parts)
        {
            var field = StoryField.Instance;
            if (field == null) return;
            StoryState.OffForTest = false;
            StoryState.Restore(0, StoryField.LightStepIndex);
            field.ResetForTest();
            var altar = field.Altar;
            if (altar == null || !altar.gameObject.activeInHierarchy || altar.Lit) { Fail("1장 옛 제단이 꺼진 채 안 섰다"); return; }
            if (!Lead(fc, HeroOf(GoWeapons.Type.Bow))) return;
            Vector3 a = altar.transform.position;
            pc.Teleport(a + new Vector3(0f, 0.4f, 25f));
            pc.Teleport(FolkWalker.Grounded(pc.transform.position + Vector3.up * 5f) + Vector3.up * 0.2f);
            fc.EnterAim();
            fc.AimToward(a);
            if (fc.AimLock.Kind != FieldCombat.AimKind.Point) { Fail($"옛 제단에 안 잠김 {fc.AimLock.Kind}"); return; }
            Shoot(fc, 1.5f);
            if (fc.LastArrow != "point" || StoryState.StepIndex != StoryField.LightStepIndex + 1) Fail($"충전 화살로 옛 제단 불 {fc.LastArrow}·{StoryState.StepIndex}");
            fc.ExitAim();
            parts.Add("옛 제단 잠김·충전 화살 불");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] aim FAIL - {msg}");
        }
    }
}
