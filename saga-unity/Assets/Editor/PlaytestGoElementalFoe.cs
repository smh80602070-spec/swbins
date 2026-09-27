using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 107-5 "원소 쓰는 적" 진단 — `PlaytestHeadless` 가 들판 전투 진단 바로 뒤에 부른다.
    /// 적을 처치하지 않으므로(경험치 안 줌) 세이브·성장은 안 건드린다. 끝나면 적·명단·스태미나를 시작 때로.
    /// </summary>
    public static class PlaytestGoElementalFoe
    {
        private static string _tag;
        private static bool _ok;

        private static readonly FieldEnemy.Kind[] Kinds = { FieldEnemy.Kind.EmberImp, FieldEnemy.Kind.DrownedGhost, FieldEnemy.Kind.StormWraith };

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            DuelGate.ResetForTest();
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            if (fc == null || pc == null) { Fail("FieldCombat/PlayerController 없음"); return false; }
            Vector3 origin = fc.SafePoint;
            string summary = "";
            try
            {
                pc.Teleport(origin);
                CheckTable();
                if (!CheckSpawn()) return false;
                foreach (var k in Kinds) summary += CheckShield(Find(k), pc, origin);
                CheckRealSkill(fc, pc, origin);
                CheckStatus(fc, origin);
            }
            finally
            {
                DuelGate.ResetForTest();
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                GoStamina.ResetFull();
            }
            if (_ok) Debug.Log($"[{_tag}] elemental foe OK - 원소 적 8(무리 3)·상성 표·방패 면역/물리/상성/깨짐→비틀 2초·깨진 뒤 부착·부활 복구·진짜 스킬(면역·상성 깨기)·화상 3틱/안 죽음·젖음·감전 |{summary}");
            return _ok;
        }

        private static void Fail(string msg)
        {
            Debug.LogError($"[{_tag}] elemental foe: {msg}");
            _ok = false;
        }

        private static FieldEnemy Find(FieldEnemy.Kind k)
        {
            foreach (var e in FieldEnemy.All) if (e.EnemyKind == k) return e;
            return null;
        }

        private static GoElement CounterOf(GoElement shield) => GoElements.CounterOf(shield); // 109-14-1a 일곱

        private static GoElement NeutralOf(GoElement shield)
        {
            foreach (GoElement a in GoElements.All)
                if (a != shield && !GoElements.Counters(a, shield)) return a;
            return GoElement.Physical;
        }

        private static void CheckTable()
        {
            if (!GoElements.Counters(GoElement.Hydro, GoElement.Pyro) || !GoElements.Counters(GoElement.Electro, GoElement.Hydro) || !GoElements.Counters(GoElement.Pyro, GoElement.Electro))
                Fail("상성(수>화·뇌>수·화>뇌)이 틀림");
            if (GoElements.Counters(GoElement.Pyro, GoElement.Hydro)) Fail("화가 수를 누름");
            foreach (GoElement s in new[] { GoElement.Pyro, GoElement.Hydro, GoElement.Electro })
            {
                if (GoElements.ShieldMul(s, s) != 0f) Fail($"{s} 방패가 같은 원소에 면역이 아님");
                if (Mathf.Abs(GoElements.ShieldMul(s, GoElement.Physical) - 0.4f) > 0.001f) Fail("물리 배율 ≠ 0.4");
                if (Mathf.Abs(GoElements.ShieldMul(s, CounterOf(s)) - 2.5f) > 0.001f) Fail("상성 배율 ≠ 2.5");
                if (Mathf.Abs(GoElements.ShieldMul(s, NeutralOf(s)) - 1f) > 0.001f) Fail("그 밖 원소 배율 ≠ 1");
            }
        }

        private static bool CheckSpawn()
        {
            if (FieldEnemy.All.Count != FieldSpawner.PlannedCount) Fail($"들판 적 {FieldEnemy.All.Count} ≠ {FieldSpawner.PlannedCount}");
            int n = 0;
            var groups = new HashSet<string>();
            foreach (var e in FieldEnemy.All)
            {
                if (!e.IsElemental || e.IsGuardian) continue; // 107-7 수호장은 따로(PlaytestGoGuardian)
                n++;
                groups.Add(e.GroupId);
                if (!FieldEnemy.CanStandOn(e.Home)) Fail($"{e.DisplayName} 집이 설 수 없는 칸");
                int exp = Mathf.RoundToInt(20 * GoWorldMap.DangerMul(e.Danger)); // 108 지역 위험 배율
                if (e.ExpReward != exp) Fail($"{e.DisplayName} 경험치 {e.ExpReward} ≠ {exp}");
            }
            if (n != 8 || groups.Count != 3) Fail($"원소 적 {n}마리·무리 {groups.Count} ≠ 8·3");
            foreach (var k in Kinds) if (Find(k) == null) { Fail($"{k} 가 없음"); return false; }
            return true;
        }

        private static string CheckShield(FieldEnemy e, PlayerController pc, Vector3 origin)
        {
            float expectMax = e.EnemyKind == FieldEnemy.Kind.EmberImp ? 150f : e.EnemyKind == FieldEnemy.Kind.DrownedGhost ? 180f : 130f;
            expectMax *= GoWorldMap.DangerMul(e.Danger); // 108 지역 위험 배율
            e.WarpForTest(origin + new Vector3(30f, 0f, 0f));
            string n = e.DisplayName;
            if (Mathf.Abs(e.ShieldMax - expectMax) > 0.01f || !Mathf.Approximately(e.ShieldHp, e.ShieldMax)) Fail($"{n} 방패 {e.ShieldHp}/{e.ShieldMax} ≠ {expectMax}");
            float hp = e.Hp;
            GoElement el = e.Element, counter = CounterOf(el), neutral = NeutralOf(el);

            if (e.TakeHit(50f, el, 100f, out _) != 0f || !Mathf.Approximately(e.ShieldHp, e.ShieldMax)) Fail($"{n} 가 같은 원소({el})에 면역이 아님");
            float s0 = e.ShieldHp;
            e.TakeHit(50f, GoElement.Physical, 100f, out _);
            if (Mathf.Abs(s0 - e.ShieldHp - 20f) > 0.01f) Fail($"{n} 물리 50 → 방패 -{s0 - e.ShieldHp} ≠ 20");
            s0 = e.ShieldHp;
            e.TakeHit(20f, counter, 100f, out var r);
            if (Mathf.Abs(s0 - e.ShieldHp - 50f) > 0.01f) Fail($"{n} 상성 {counter} 20 → 방패 -{s0 - e.ShieldHp} ≠ 50");
            if (r != GoReaction.None || e.AuraLeft > 0f) Fail($"{n} 방패가 있는데 원소가 붙음/반응");
            s0 = e.ShieldHp;
            e.TakeHit(10f, neutral, 100f, out _);
            if (Mathf.Abs(s0 - e.ShieldHp - 10f) > 0.01f) Fail($"{n} 그 밖 원소 10 → 방패 -{s0 - e.ShieldHp} ≠ 10");
            if (!Mathf.Approximately(e.Hp, hp)) Fail($"{n} 방패가 있는데 체력이 깎임");

            // 깨기 — 넘치는 몫은 버린다, 2초 비틀거림(곁에 서 있어도 예고 안 함)
            e.TakeHit(9999f, counter, 100f, out _);
            if (e.Shielded || e.CurrentState != FieldEnemy.State.Stagger) Fail($"{n} 방패가 안 깨짐/비틀거림 아님({e.CurrentState})");
            if (!Mathf.Approximately(e.Hp, hp)) Fail($"{n} 방패를 깬 넘친 피해가 체력에 들어감");
            pc.Teleport(e.transform.position + new Vector3(2f, 0.1f, 0f));
            e.Tick(1.0f);
            if (e.CurrentState != FieldEnemy.State.Stagger) Fail($"{n} 비틀거림이 1초 만에 끝남({e.CurrentState})");
            e.Tick(1.1f);
            if (e.CurrentState == FieldEnemy.State.Stagger) Fail($"{n} 비틀거림이 2초 넘게 이어짐");
            pc.Teleport(origin);

            e.TakeHit(10f, neutral, 100f, out _);
            if (e.Hp >= hp || e.Aura != neutral) Fail($"{n} 방패가 깨졌는데 체력·부착이 안 됨");
            e.ReviveNow();
            if (!Mathf.Approximately(e.ShieldHp, e.ShieldMax)) Fail($"{n} 되살아났는데 방패가 안 돌아옴");
            return $" {n} {el} 방패 {e.ShieldMax:F0}";
        }

        private static void CheckRealSkill(FieldCombat fc, PlayerController pc, Vector3 origin)
        {
            // 주인공(화)의 진짜 스킬 — 불도깨비는 면역, 번개귀는 상성으로 한 번에 깨진다
            var imp = Find(FieldEnemy.Kind.EmberImp);
            var wraith = Find(FieldEnemy.Kind.StormWraith);
            fc.ResetForTest();
            pc.Teleport(origin);
            imp.WarpForTest(origin + new Vector3(3f, 0f, 0f));
            if (fc.Skill() < 1) Fail("곁의 불도깨비에게 스킬이 안 닿음");
            if (!Mathf.Approximately(imp.ShieldHp, imp.ShieldMax) || !Mathf.Approximately(imp.Hp, imp.MaxHp)) Fail("주인공 화 스킬이 불도깨비 방패/체력을 깎음(면역이어야)");
            imp.RestoreHomeForTest();

            fc.ResetForTest();
            wraith.WarpForTest(origin + new Vector3(3f, 0f, 0f));
            float expect = fc.Atk * FieldCombat.SkillMul * 2.5f;
            fc.Skill();
            if (expect >= wraith.ShieldMax && wraith.Shielded) Fail($"화 스킬 상성({expect:F0})이 번개귀 방패 {wraith.ShieldMax} 를 못 깸");
            if (expect < wraith.ShieldMax && Mathf.Abs(wraith.ShieldMax - wraith.ShieldHp - expect) > 0.5f) Fail("화 스킬 상성 피해가 2.5배가 아님");
            wraith.RestoreHomeForTest();
        }

        private static void CheckStatus(FieldCombat fc, Vector3 origin)
        {
            var imp = Find(FieldEnemy.Kind.EmberImp);
            var ghost = Find(FieldEnemy.Kind.DrownedGhost);
            var wraith = Find(FieldEnemy.Kind.StormWraith);
            FieldEnemy bandit = null;
            foreach (var e in FieldEnemy.All) if (e.EnemyKind == FieldEnemy.Kind.Bandit) { bandit = e; break; }

            // 화상 — 그 타격의 0.2 씩 세 번
            fc.ResetForTest();
            var m = fc.Active;
            float hp0 = m.Hp;
            if (!fc.ReceiveStrike(imp.Atk, imp)) { Fail("불도깨비 타격이 안 들어감"); return; }
            float dmg = hp0 - m.Hp;
            if (fc.BurnTicksLeft != 3) Fail($"화상 틱 {fc.BurnTicksLeft} ≠ 3");
            float hp1 = m.Hp;
            fc.TickTimers(1.05f);
            if (fc.BurnTicksLeft != 2) Fail("화상 1초 뒤 틱이 안 줄어듦");
            fc.TickTimers(2.1f);
            if (fc.BurnTicksLeft != 0) Fail("화상이 3초 뒤에도 남음");
            if (Mathf.Abs(hp1 - m.Hp - dmg * 0.6f) > 0.6f) Fail($"화상 합 {hp1 - m.Hp:F1} ≠ 타격 {dmg:F1} × 0.6");
            // 화상만으로는 안 쓰러진다
            m.Hp = 2f;
            fc.ApplyFoeStatus(GoElement.Pyro, 500f);
            fc.TickTimers(3.2f);
            if (m.Down || m.Hp < 1f) Fail("화상으로 쓰러짐");

            // 젖음 — 스태미나 -25
            fc.ResetForTest();
            GoStamina.ResetFull();
            fc.ReceiveStrike(ghost.Atk, ghost);
            if (Mathf.Abs(GoStamina.Value - (GoStamina.Max - 25f)) > 0.01f) Fail($"젖음 스태미나 {GoStamina.Value} ≠ {GoStamina.Max - 25f}");

            // 감전 — 기력 -25
            fc.ResetForTest();
            fc.Active.Energy = 60f;
            fc.ReceiveStrike(wraith.Atk, wraith);
            if (Mathf.Abs(fc.Active.Energy - 35f) > 0.01f) Fail($"감전 기력 {fc.Active.Energy} ≠ 35");

            // 보통 적·회피 무적은 상태 없음
            fc.ResetForTest();
            GoStamina.ResetFull();
            if (bandit != null) fc.ReceiveStrike(bandit.Atk, bandit);
            if (fc.BurnTicksLeft != 0 || GoStamina.Value < GoStamina.Max) Fail("산적 타격에 원소 상태가 붙음");
            fc.ResetForTest();
            fc.Dodge();
            fc.ReceiveStrike(imp.Atk, imp);
            if (fc.BurnTicksLeft != 0) Fail("회피 무적 중에 화상이 붙음");
            fc.ResetForTest();
        }
    }
}
