using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 107-1 "들판 전투" 진단 — `PlaytestHeadless` 가 Play 3프레임째(다른 GO 진단 뒤, 일일 과제 앞)에 부른다.
    /// 같은 프레임 안에서 동기로 돌리므로 적 `Update` 가 끼어들지 않는다. 시간이 필요한 곳은 `Tick`/`TickTimers` 로 건너뛴다.
    /// 끝나면 적은 전부 집으로, 플레이어는 안전 지점으로, 명단은 전원 회복으로 되돌린다.
    /// </summary>
    public static class PlaytestGoFieldCombat
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            DuelGate.ResetForTest(); // 앞 진단이 결투 상태를 보고했을 수 있다

            CheckReactionTable();

            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            if (fc == null || pc == null) { Fail("FieldCombat/PlayerController 가 플레이어에 없음"); return false; }
            if (FieldEnemy.All.Count != FieldSpawner.PlannedCount)
                Fail($"들판 적 수 {FieldEnemy.All.Count} ≠ {FieldSpawner.PlannedCount}");
            var hud = fc.GetComponent<FieldCombatHud>();
            if (hud == null || hud.Root == null) Fail("FieldCombatHud 가 안 만들어짐");

            var enemies = new List<FieldEnemy>(FieldEnemy.All);
            if (enemies.Count < 3) { Fail("적이 셋 미만"); return false; }
            FieldEnemy e1 = enemies[0], e2 = enemies[1], e3 = enemies[2];
            Vector3 origin = fc.transform.position;

            try
            {
                CheckBasicAttackAndKill(fc, pc, e1, e2, e3, origin);
                CheckReactions(fc, e1, e2, origin);
                CheckReactions7(fc, e1, e2, origin);
                CheckChargeAndPlunge(fc, pc, e1, e2, origin);
                CheckSkillAndBurst(fc, pc, e1, e2, e3, origin);
                CheckEnemyStrikeAndDodge(fc, pc, e1, origin);
                CheckSwapAndWipe(fc, e1, origin);
                CheckDuelGate(fc);
                if (hud != null) CheckHud(fc, pc, hud, e1, origin);
            }
            finally
            {
                DuelGate.ResetForTest();
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                GoStamina.ResetFull();
            }

            if (_ok) Debug.Log($"[{_tag}] field combat OK - enemies {FieldEnemy.All.Count}, party {fc.Party.Count}, reactions·원소 일곱 반응 열셋·강공격·낙하 공격·3타·스킬·폭발·피격·회피·교체·전멸 복귀·결투 경계·버튼");
            return _ok;
        }

        private static void Fail(string msg)
        {
            Debug.LogError($"[{_tag}] field combat: {msg}");
            _ok = false;
        }

        private static void CheckReactionTable()
        {
            if (GoElements.Resolve(GoElement.Pyro, GoElement.Hydro) != GoReaction.Vaporize) Fail("화+수 ≠ 증발");
            if (GoElements.Resolve(GoElement.Hydro, GoElement.Pyro) != GoReaction.Vaporize) Fail("수+화 ≠ 증발");
            if (GoElements.Resolve(GoElement.Electro, GoElement.Pyro) != GoReaction.Overload) Fail("뇌+화 ≠ 과부하");
            if (GoElements.Resolve(GoElement.Hydro, GoElement.Electro) != GoReaction.ElectroCharged) Fail("수+뇌 ≠ 감전");
            if (GoElements.Resolve(GoElement.Pyro, GoElement.Pyro) != GoReaction.None) Fail("같은 원소가 반응함");
            if (GoElements.Resolve(GoElement.Hydro, GoElement.Physical) != GoReaction.None) Fail("물리가 반응함");
            if (GoElements.ForMember("산적") != GoElements.ForMember("산적") || GoElements.ForMember("산적") == GoElement.Physical)
                Fail("동료 원소 해시가 흔들리거나 물리");
        }

        private static Vector3 Fwd(PlayerController pc)
        {
            Vector3 f = pc.Visual != null ? pc.Visual.forward : pc.transform.forward;
            f.y = 0f;
            return f.normalized;
        }

        private static void Place(FieldEnemy e, Vector3 pos) => e.WarpForTest(pos);

        private static void Park(FieldEnemy e, Vector3 origin, float offset)
        {
            Place(e, origin + new Vector3(60f + offset, 0f, 60f));
        }

        private static void CheckBasicAttackAndKill(FieldCombat fc, PlayerController pc, FieldEnemy e1, FieldEnemy e2, FieldEnemy e3, Vector3 origin)
        {
            fc.ResetForTest();
            Park(e2, origin, 0f);
            Park(e3, origin, 10f);
            Place(e1, origin + Fwd(pc) * 2.5f);

            float atk = fc.Atk;
            float hp0 = e1.Hp;
            int hits = fc.Attack();
            if (hits != 1) Fail($"기본 공격 1타 적중 {hits} ≠ 1");
            if (Mathf.Abs(hp0 - e1.Hp - atk * FieldCombat.ComboMul[0]) > 0.5f) Fail($"1타 피해 {hp0 - e1.Hp} ≠ {atk * FieldCombat.ComboMul[0]}");
            if (fc.Attack() != -1) Fail("공격 간격 안에 다시 쳐짐");
            fc.TickTimers(0.4f);
            float hp1 = e1.Hp;
            fc.Attack();
            if (Mathf.Abs(hp1 - e1.Hp - atk * FieldCombat.ComboMul[1]) > 0.5f) Fail("2타 배율이 안 먹음");
            if (fc.ComboStep != 2) Fail($"콤보 단계 {fc.ComboStep} ≠ 2");
            fc.TickTimers(FieldCombat.ComboWindowSec + 0.1f);
            if (fc.ComboStep != 0) Fail("이어 치기 창이 지나도 콤보가 안 끊김");

            int killed = 0;
            System.Action<FieldEnemy> onKill = e => { if (e == e1) killed++; };
            FieldEnemy.Killed += onKill;
            int lv0 = PlayerStats.Level, exp0 = PlayerStats.Exp;
            for (int i = 0; i < 60 && e1.Alive; i++) { fc.TickTimers(0.4f); fc.Attack(); }
            FieldEnemy.Killed -= onKill;
            if (e1.Alive) Fail("기본 공격으로 적이 안 쓰러짐");
            if (killed != 1) Fail($"Killed 이벤트 {killed} ≠ 1");
            if (PlayerStats.Level == lv0 && PlayerStats.Exp - exp0 != e1.ExpReward) Fail($"처치 경험치 {PlayerStats.Exp - exp0} ≠ {e1.ExpReward}");
            if (fc.Active.Energy <= 0f) Fail("기본 공격 적중에 기력이 안 참");
        }

        private static void CheckReactions(FieldCombat fc, FieldEnemy e1, FieldEnemy e2, Vector3 origin)
        {
            const float Atk = 100f;
            // 증발
            Place(e1, origin + new Vector3(30f, 0f, 30f));
            e1.TakeHit(1f, GoElement.Hydro, Atk, out var r0);
            if (r0 != GoReaction.None || e1.Aura != GoElement.Hydro) Fail("수 부착이 안 됨");
            float hp = e1.Hp;
            e1.TakeHit(100f, GoElement.Pyro, Atk, out var r1);
            if (r1 != GoReaction.Vaporize) Fail($"증발 안 남 ({r1})");
            if (Mathf.Abs(hp - e1.Hp - 150f) > 0.5f) Fail($"증발 피해 {hp - e1.Hp} ≠ 150");
            if (e1.AuraLeft > 0f) Fail("반응 뒤 부착이 안 지워짐");

            // 과부하 — 옆 적도 맞는다
            Place(e1, origin + new Vector3(30f, 0f, 30f));
            Place(e2, origin + new Vector3(33f, 0f, 30f));
            e1.TakeHit(1f, GoElement.Electro, Atk, out _);
            float hp2 = e2.Hp;
            e1.TakeHit(10f, GoElement.Pyro, Atk, out var r2);
            if (r2 != GoReaction.Overload) Fail($"과부하 안 남 ({r2})");
            if (Mathf.Abs(hp2 - e2.Hp - Atk * GoElements.OverloadAtkMul) > 0.5f) Fail($"과부하 광역 피해 {hp2 - e2.Hp} ≠ {Atk * GoElements.OverloadAtkMul}");

            // 감전 — 지속 + 젖은 옆 적에게 번짐
            Place(e1, origin + new Vector3(30f, 0f, 30f));
            Place(e2, origin + new Vector3(32f, 0f, 30f));
            e2.TakeHit(1f, GoElement.Hydro, Atk, out _);
            e1.TakeHit(1f, GoElement.Hydro, Atk, out _);
            e1.TakeHit(1f, GoElement.Electro, Atk, out var r3);
            if (r3 != GoReaction.ElectroCharged) Fail($"감전 안 남 ({r3})");
            if (!e1.Charged) Fail("감전 지속이 안 걸림");
            if (!e2.Charged) Fail("젖은 옆 적에게 감전이 안 번짐");
            float hp3 = e1.Hp;
            e1.Tick(GoElements.ChargedTickSec + 0.01f);
            if (Mathf.Abs(hp3 - e1.Hp - Atk * GoElements.ChargedTickAtkMul) > 0.5f) Fail($"감전 틱 피해 {hp3 - e1.Hp} ≠ {Atk * GoElements.ChargedTickAtkMul}");
            Park(e2, origin, 0f);
        }

        /// <summary>PLAN.md 109-14-1a 원소 일곱·반응 열셋(웹 사가고 ⑲-1 진단 항목) — 표 · 방패 상성 일곱 · 녹임 · 풍/암 안 붙음 · 얼어붙음 → 3타·암 깨뜨림 · 서리번개 ·
        /// 회오리가 옆 적에 원소를 옮김 · 굳힘 보호막이 피해를 막음 · 꽃피움 씨앗 · 들불 · 싹틈 → 번개싹·덩굴뻗음 · 새 원소 적 상태 넷.</summary>
        private static void CheckReactions7(FieldCombat fc, FieldEnemy e1, FieldEnemy e2, Vector3 origin)
        {
            const float Atk = 100f;
            var P = GoElement.Pyro; var H = GoElement.Hydro; var El = GoElement.Electro; var A = GoElement.Anemo;
            var C = GoElement.Cryo; var G = GoElement.Geo; var D = GoElement.Dendro; var Ph = GoElement.Physical;

            // 표
            void Pair(GoElement a, GoElement b, GoReaction want)
            {
                if (GoElements.Resolve(a, b) != want) Fail($"반응 {a}+{b} = {GoElements.Resolve(a, b)} ≠ {want}");
                if (GoElements.Attaches(a) && GoElements.Attaches(b) && GoElements.Resolve(b, a) != want) Fail($"반응 {b}+{a} 순서 따라 다름");
            }
            Pair(P, H, GoReaction.Vaporize); Pair(P, El, GoReaction.Overload); Pair(H, El, GoReaction.ElectroCharged);
            Pair(C, P, GoReaction.Melt); Pair(H, C, GoReaction.Frozen); Pair(El, C, GoReaction.Superconduct);
            Pair(H, D, GoReaction.Bloom); Pair(P, D, GoReaction.Burning); Pair(El, D, GoReaction.Quicken);
            Pair(C, D, GoReaction.None);
            foreach (var x in new[] { P, H, El, C }) { Pair(x, A, GoReaction.Swirl); Pair(x, G, GoReaction.Crystallize); }
            Pair(D, A, GoReaction.None); Pair(D, G, GoReaction.None);
            if (GoElements.Attaches(A) || GoElements.Attaches(G) || GoElements.Attaches(Ph)) Fail("풍·암·물리가 붙음");
            foreach (var s in GoElements.All)
            {
                if (GoElements.ShieldMul(s, s) != 0f) Fail($"{s} 방패가 같은 원소에 면역 아님");
                if (Mathf.Abs(GoElements.ShieldMul(s, GoElements.CounterOf(s)) - GoElements.ShieldCounterMul) > 0.001f) Fail($"{s} 방패 상성 {GoElements.CounterOf(s)} 배율");
                float phys = GoElements.ShieldMul(s, Ph);
                if (Mathf.Abs(phys - (s == G ? 1f : GoElements.ShieldPhysicalMul)) > 0.001f) Fail($"{s} 방패 물리 {phys}");
            }
            if (GoElements.CounterOf(A) != G || GoElements.CounterOf(C) != P || GoElements.CounterOf(G) != D || GoElements.CounterOf(D) != A) Fail("새 상성 넷(암>풍·화>빙·초>암·풍>초)");
            if (GoElements.ForMember("산적") != H) Fail("산적 원소가 수가 아님(107 상자 퍼즐)");
            if (GoHeroes.InnerOf(C) != P || GoHeroes.InnerOf(A) != D || GoHeroes.InnerOf(P) != El) Fail("★5 속 방패(빙→화·풍→초·화→뇌)");

            void Fresh(FieldEnemy e, Vector3 pos) { e.ReviveNow(); Place(e, pos); }
            Vector3 at = origin + new Vector3(30f, 0f, 30f), near = at + new Vector3(2f, 0f, 0f);
            float hp;

            // 녹임 · 풍 안 붙음
            Fresh(e1, at);
            e1.TakeHit(1f, A, Atk, out var ra);
            if (ra != GoReaction.None || e1.AuraLeft > 0f) Fail("풍이 맨 적에 붙음/반응");
            e1.TakeHit(1f, C, Atk, out _);
            hp = e1.Hp; e1.TakeHit(100f, P, Atk, out var rm);
            if (rm != GoReaction.Melt || Mathf.Abs(hp - e1.Hp - 150f) > 0.5f) Fail($"녹임 {rm} 피해 {hp - e1.Hp} ≠ 150");

            // 얼어붙음 → 3타째 깨뜨림 · 암 깨뜨림 · 시간 지나면 풀림
            Fresh(e1, at);
            e1.TakeHit(1f, H, Atk, out _); e1.TakeHit(1f, C, Atk, out var rf);
            if (rf != GoReaction.Frozen || !e1.Frozen) Fail($"얼어붙음 안 남 ({rf})");
            e1.Tick(1f);
            if (!e1.Frozen) Fail("얼어붙음이 1초에 풀림");
            hp = e1.Hp; e1.TakeHit(100f, Ph, Atk, out var rs, heavy: true);
            if (rs != GoReaction.Shatter || e1.Frozen || Mathf.Abs(hp - e1.Hp - 150f) > 0.5f) Fail($"강공격(heavy) 깨뜨림 {rs} 피해 {hp - e1.Hp}");
            Fresh(e1, at);
            e1.TakeHit(1f, H, Atk, out _); e1.TakeHit(1f, C, Atk, out _);
            e1.TakeHit(1f, Ph, Atk, out var rn);
            if (rn != GoReaction.None || !e1.Frozen) Fail("보통 물리 한 타가 얼음을 깸");
            e1.TakeHit(10f, G, Atk, out var rg);
            if (rg != GoReaction.Shatter || e1.Frozen) Fail($"암 깨뜨림 {rg}");
            Fresh(e1, at);
            e1.TakeHit(1f, H, Atk, out _); e1.TakeHit(1f, C, Atk, out _);
            e1.Tick(GoElements.FrozenSec + 0.1f);
            if (e1.Frozen) Fail("얼어붙음이 2.5초 지나도 안 풀림");

            // 서리번개 — 옆 적 광역 ×0.5 + 물리 ×1.4
            Fresh(e1, at); Fresh(e2, near);
            e1.TakeHit(1f, El, Atk, out _);
            hp = e2.Hp; e1.TakeHit(1f, C, Atk, out var rc);
            if (rc != GoReaction.Superconduct || Mathf.Abs(hp - e2.Hp - Atk * GoElements.SuperAtkMul) > 0.5f || e2.SuperLeft <= 0f) Fail($"서리번개 {rc} 옆 피해 {hp - e2.Hp}");
            hp = e2.Hp; e2.TakeHit(100f, Ph, Atk, out _);
            if (Mathf.Abs(hp - e2.Hp - 140f) > 0.5f) Fail($"서리번개 뒤 물리 {hp - e2.Hp} ≠ 140");

            // 회오리 — 옆 적에 원소를 옮겨 붙인다
            Fresh(e1, at); Fresh(e2, near);
            e1.TakeHit(1f, P, Atk, out _);
            hp = e2.Hp; e1.TakeHit(1f, A, Atk, out var rw);
            if (rw != GoReaction.Swirl || e2.Aura != P || e2.AuraLeft <= 0f || Mathf.Abs(hp - e2.Hp - Atk * GoElements.SwirlAtkMul) > 0.5f)
                Fail($"회오리 {rw} 옆 원소 {e2.Aura} 피해 {hp - e2.Hp}");
            Park(e2, origin, 0f);

            // 굳힘 — 보호막이 피해를 먼저 막는다
            fc.ResetForTest();
            Fresh(e1, at);
            e1.TakeHit(1f, H, Atk, out _); e1.TakeHit(1f, G, Atk, out var rcr);
            float want = fc.Active.MaxHp * GoElements.CrystalHpFrac;
            if (rcr != GoReaction.Crystallize || Mathf.Abs(fc.GuardHp - want) > 0.5f) Fail($"굳힘 {rcr} 보호막 {fc.GuardHp} ≠ {want}");
            float mhp = fc.Active.Hp, g0 = fc.GuardHp;
            fc.ReceiveStrike(5f, null);
            if (fc.Active.Hp != mhp || fc.GuardHp >= g0) Fail("굳힘이 피해를 안 막음");
            fc.TickTimers(GoElements.CrystalSec + 0.1f);
            if (fc.GuardHp > 0f) Fail("굳힘이 15초 뒤에도 남음");

            // 꽃피움 — 1.5초 뒤 씨앗이 터진다
            Fresh(e1, at);
            e1.TakeHit(1f, H, Atk, out _); e1.TakeHit(1f, D, Atk, out var rb);
            if (rb != GoReaction.Bloom || fc.SeedCount != 1) Fail($"꽃피움 {rb} 씨앗 {fc.SeedCount}");
            hp = e1.Hp; fc.TickTimers(1f);
            if (e1.Hp != hp) Fail("씨앗이 1.5초 전에 터짐");
            fc.TickTimers(0.6f);
            if (fc.SeedCount != 0 || Mathf.Abs(hp - e1.Hp - Atk * GoElements.BloomAtkMul) > 0.5f) Fail($"씨앗 터짐 피해 {hp - e1.Hp}");

            // 들불 — 0.5초마다 ×0.2 여덟 번
            Fresh(e1, at);
            e1.TakeHit(1f, P, Atk, out _); e1.TakeHit(1f, D, Atk, out var rbu);
            if (rbu != GoReaction.Burning || e1.BurningLeft != GoElements.BurningTicks) Fail($"들불 {rbu} 틱 {e1.BurningLeft}");
            hp = e1.Hp; e1.Tick(GoElements.BurningTickSec + 0.01f);
            if (Mathf.Abs(hp - e1.Hp - Atk * GoElements.BurningAtkMul) > 0.5f) Fail($"들불 틱 {hp - e1.Hp}");

            // tasks U-0015 — 죽인 일격이 불붙음·감전을 다시 세우지 않고, 부활한 적에게 반응 상태가 안 남는다(적을 죽이면 경험치·의뢰·업적이 쌓여 뒤 진단이 흔들리므로 세이브 스냅샷으로 되돌린다)
            string snapU15 = Saga.Go.Data.SaveState.ToJson();
            Fresh(e1, at);
            e1.TakeHit(1f, P, Atk, out _); e1.TakeHit(1e6f, D, Atk, out var rkb);
            if (rkb != GoReaction.Burning || e1.Alive || e1.BurningLeft != 0) Fail($"죽인 일격이 불붙음을 다시 세움 {rkb} 산 채 {e1.Alive} 틱 {e1.BurningLeft}");
            e1.ReviveNow();
            if (e1.BurningLeft != 0 || e1.Charged || e1.QuickenLeft > 0f) Fail($"부활한 적에 반응 상태 잔존 틱 {e1.BurningLeft} 감전 {e1.Charged} 가속 {e1.QuickenLeft}");
            Fresh(e1, at);
            e1.TakeHit(1f, H, Atk, out _); e1.TakeHit(1e6f, El, Atk, out var rkc);
            if (rkc != GoReaction.ElectroCharged || e1.Alive || e1.Charged) Fail($"죽인 일격이 감전을 다시 세움 {rkc} 산 채 {e1.Alive} 감전 {e1.Charged}");
            e1.ReviveNow();
            if (e1.Charged) Fail("부활한 적에 감전 잔존");
            if (!Saga.Go.Data.SaveState.ApplyJson(snapU15)) Fail("진단 스냅샷 복원 실패");

            // 싹틈 → 번개싹·덩굴뻗음 ×1.25
            Fresh(e1, at);
            e1.TakeHit(1f, El, Atk, out _); e1.TakeHit(1f, D, Atk, out var rq);
            if (rq != GoReaction.Quicken || e1.QuickenLeft <= 0f) Fail($"싹틈 {rq}");
            hp = e1.Hp; e1.TakeHit(80f, El, Atk, out var rag);
            if (rag != GoReaction.Aggravate || Mathf.Abs(hp - e1.Hp - 100f) > 0.5f) Fail($"번개싹 {rag} {hp - e1.Hp}");
            hp = e1.Hp; e1.TakeHit(80f, D, Atk, out var rsp);
            if (rsp != GoReaction.Spread || Mathf.Abs(hp - e1.Hp - 100f) > 0.5f || e1.QuickenLeft <= 0f) Fail($"덩굴뻗음 {rsp} {hp - e1.Hp}");

            // 새 원소 적에게 맞으면 — 휘말림·한기·짓눌림·중독
            fc.ResetForTest();
            var m = fc.Active;
            fc.ApplyFoeStatus(A, 100f);
            if (Mathf.Abs(m.SkillCd - GoElements.SweptSkillCdAdd) > 0.01f) Fail($"휘말림 스킬 쿨 {m.SkillCd}");
            GoStamina.SetForTest(50f);
            fc.ApplyFoeStatus(C, 100f);
            GoStamina.Tick(2f);
            if (GoStamina.Value > 50.01f) Fail("한기인데 스태미나가 돎");
            GoStamina.Tick(1.5f); GoStamina.Tick(1f);
            if (GoStamina.Value <= 50.01f) Fail("한기가 3초 뒤에도 안 풀림");
            m.Hp = 10f;
            fc.ApplyFoeStatus(G, 100f);
            if (m.Hp < 1f || m.Hp > 1.01f) Fail($"짓눌림이 쓰러뜨리거나 안 깎음 hp={m.Hp}");
            m.Hp = m.MaxHp;
            fc.ReceiveStrike(1f, null); // 회복 대기(8초)를 새로 걸어 틱 피해만 잰다
            fc.ApplyFoeStatus(D, 100f);
            if (fc.BurnTicksLeft != GoElements.PoisonTicks || fc.BurnElement != D) Fail($"중독 틱 {fc.BurnTicksLeft} {fc.BurnElement}");
            hp = m.Hp; fc.TickTimers(GoElements.PoisonTickSec + 0.01f);
            if (Mathf.Abs(hp - m.Hp - 100f * GoElements.PoisonMul) > 0.5f) Fail($"중독 틱 피해 {hp - m.Hp}");

            fc.ResetForTest();
            GoStamina.ResetFull();
            e1.ReviveNow(); e2.ReviveNow();
            Park(e2, origin, 0f);
        }

        /// <summary>PLAN.md 109-14-2 강공격·낙하 공격(웹 사가고 ⑲-2 진단 항목) — 강공격 스태미나·배수·앞쪽만·모자라면 안 됨·0.4초 누르기 한 번 ·
        /// 3타째는 얼음을 못 깨고 강공격은 깬다 · 낙하 배수(18.5m ×2.2 · 100m 는 27.75m 로 막힘) · 활공 중 공격 → 내리꽂아 착지 둘레 · 낮으면 안 됨.</summary>
        private static void CheckChargeAndPlunge(FieldCombat fc, PlayerController pc, FieldEnemy e1, FieldEnemy e2, Vector3 origin)
        {
            fc.ResetForTest();
            GoStamina.ResetFull();
            e1.ReviveNow(); e2.ReviveNow();
            Vector3 fwd = Fwd(pc);
            Place(e1, origin + fwd * 3f);
            Place(e2, origin - fwd * 3.5f); // 뒤 — 안 맞는다
            float atk = fc.Atk, hp1 = e1.Hp, hp2 = e2.Hp;
            int hits = fc.ChargedAttack();
            if (hits != 1 || Mathf.Abs(hp1 - e1.Hp - atk * FieldCombat.ChargeMul) > 0.5f || e2.Hp != hp2)
                Fail($"강공격 적중 {hits}·앞 피해 {hp1 - e1.Hp} ≠ {atk * FieldCombat.ChargeMul}·뒤 피해 {hp2 - e2.Hp}");
            if (Mathf.Abs(GoStamina.Value - (GoStamina.Max - FieldCombat.ChargeStamina)) > 0.01f) Fail($"강공격 스태미나 {GoStamina.Value}");
            if (fc.ComboStep != 0) Fail("강공격 뒤 콤보가 처음부터가 아님");
            GoStamina.SetForTest(10f);
            if (fc.ChargedAttack() != -1) Fail("스태미나 10 인데 강공격이 나감");

            GoStamina.ResetFull();
            fc.TickHold(false, 0f);
            fc.TickHold(true, 0.3f);
            if (GoStamina.Value < GoStamina.Max - 0.01f) Fail("0.3초 누름에 강공격이 나감");
            fc.TickHold(true, 0.15f);
            if (GoStamina.Value > GoStamina.Max - FieldCombat.ChargeStamina + 0.01f) Fail("0.45초 누름에 강공격이 안 나감");
            float st = GoStamina.Value;
            fc.TickHold(true, 1f);
            if (GoStamina.Value != st) Fail("누른 채로 강공격이 또 나감");
            fc.TickHold(false, 0f);

            // 깨뜨림 — 기본 3타는 못 깨고 강공격은 깬다
            fc.ResetForTest();
            GoStamina.ResetFull();
            // 1·2타는 빈 곳에 휘둘러 콤보만 올린다(세 번 다 맞히면 앞 진단으로 오른 공격력에 적이 쓰러져 얼음이 지워진다)
            e1.ReviveNow(); Park(e1, origin, 5f); Park(e2, origin, 0f);
            fc.Attack(); fc.TickTimers(0.4f); fc.Attack(); fc.TickTimers(0.4f);
            if (fc.ComboStep != 2) Fail($"빈 휘두름으로 콤보가 안 오름({fc.ComboStep})");
            Place(e1, origin + fwd * 3f);
            e1.TakeHit(1f, GoElement.Hydro, 100f, out _); e1.TakeHit(1f, GoElement.Cryo, 100f, out _);
            if (fc.Attack() != 1 || !e1.Alive) Fail("3타째가 얼은 적을 못 맞힘");
            if (!e1.Frozen) Fail("기본 3타째가 얼음을 깸(깨뜨림은 강공격·낙하만)");
            fc.ChargedAttack();
            if (e1.Frozen) Fail("강공격이 얼음을 못 깸");

            if (Mathf.Abs(FieldCombat.PlungeMul(18.5f) - 2.2f) > 0.01f || Mathf.Abs(FieldCombat.PlungeMul(100f) - 2.7f) > 0.01f)
                Fail($"낙하 배수 18.5m {FieldCombat.PlungeMul(18.5f)} · 100m {FieldCombat.PlungeMul(100f)}");

            // 활공 → 공격 → 내리꽂아 착지 둘레(6.5m 안만)
            fc.ResetForTest();
            GoStamina.ResetFull();
            e1.ReviveNow(); e2.ReviveNow();
            Place(e1, origin + new Vector3(2f, 0f, 0f));
            Place(e2, origin + new Vector3(12f, 0f, 0f));
            hp1 = e1.Hp; hp2 = e2.Hp;
            pc.Teleport(origin + Vector3.up * 20f);
            pc.Step(0.02f); // 순간이동 직후 CharacterController.isGrounded 가 낡은 true 로 남아 점프 가지를 타므로, 공중에서 한 걸음 먼저 내디뎌 땅 판정을 갱신한다
            pc.RequestJump();
            pc.Step(0.02f);
            if (pc.Mode != PlayerController.MoveMode.Glide) { Fail($"20m 에서 활공이 안 열림({pc.Mode}) — 땅 위 높이 {pc.HeightAboveGround():0.0}m·순회 {pc.Traversal}·스태미나 {GoStamina.Value:0.0}·위치 {pc.transform.position}"); return; }
            if (fc.AttackPress() != 0 || !pc.Plunging) { Fail("활공 중 공격이 내리꽂기가 아님"); return; }
            for (int i = 0; i < 300 && pc.Plunging; i++) pc.Step(0.02f);
            if (pc.Plunging || pc.Mode != PlayerController.MoveMode.Ground) Fail($"내리꽂기가 땅에 안 닿음({pc.Mode})");
            float dealt = hp1 - e1.Hp;
            if (fc.LastPlungeHits < 1 || dealt < atk * 2f || dealt > atk * 2.75f) Fail($"낙하 공격 적중 {fc.LastPlungeHits}·피해 {dealt} (공 {atk})");
            if (e2.Hp != hp2) Fail("낙하 공격이 12m 밖 적을 침");

            // 낮으면 안 됨
            pc.Teleport(origin + Vector3.up * 4.3f);
            pc.RequestJump();
            pc.Step(0.02f);
            if (pc.Mode == PlayerController.MoveMode.Glide && (fc.AttackPress() != -1 || pc.Plunging)) Fail("4.6m 아래에서 내리꽂힘");
            pc.Teleport(origin);
            fc.ResetForTest();
            GoStamina.ResetFull();
            e1.ReviveNow(); e2.ReviveNow();
            Park(e2, origin, 0f);
        }

        private static void CheckSkillAndBurst(FieldCombat fc, PlayerController pc, FieldEnemy e1, FieldEnemy e2, FieldEnemy e3, Vector3 origin)
        {
            fc.ResetForTest();
            Place(e1, origin + Fwd(pc) * 3f);
            int hits = fc.Skill();
            if (hits < 1) Fail($"원소 스킬이 앞 적을 못 맞힘({hits})");
            if (e1.Aura != fc.Active.Element) Fail($"스킬 원소 부착 {e1.Aura} ≠ {fc.Active.Element}");
            if (Mathf.Abs(fc.Active.SkillCd - FieldCombat.SkillCooldownSec) > 0.01f) Fail("스킬 쿨이 안 걸림");
            if (fc.Skill() != -1) Fail("쿨 중에 스킬이 또 나감");
            if (fc.Active.Energy < FieldCombat.EnergyPerSkillHit - 0.01f) Fail("스킬 적중 기력 +15 가 안 참");
            if (fc.Burst() != -1) Fail("기력 모자란데 폭발이 나감");
            fc.Active.Energy = FieldCombat.BurstCost;
            Place(e1, origin + Fwd(pc) * 8f);
            float hp = e1.Hp;
            if (fc.Burst() < 1) Fail("원소 폭발이 8m 적을 못 맞힘");
            if (fc.Active.Energy > 0f) Fail("폭발 뒤 기력이 안 비워짐");
            if (hp - e1.Hp < Mathf.Min(hp, fc.Atk * FieldCombat.BurstMul) - 0.5f) Fail("폭발 피해가 4배 미만"); // 즉사하면 남은 체력까지만 깎인다
        }

        private static void CheckEnemyStrikeAndDodge(FieldCombat fc, PlayerController pc, FieldEnemy e1, Vector3 origin)
        {
            fc.ResetForTest();
            Place(e1, origin + Fwd(pc) * 2f);
            e1.Tick(0.01f); // 배회 → 발견
            if (e1.CurrentState != FieldEnemy.State.Chase) Fail($"가까운 플레이어를 발견 못 함({e1.CurrentState})");
            e1.Tick(0.01f); // 추격 → 사거리 안이라 예고
            if (e1.CurrentState != FieldEnemy.State.Telegraph) Fail($"사거리 안인데 예고 안 함({e1.CurrentState})");
            float hp = fc.Active.Hp;
            e1.Tick(FieldEnemy.TelegraphSec + 0.05f);
            if (fc.Active.Hp >= hp) Fail("가만히 서 있는데 안 맞음");
            if (e1.CurrentState != FieldEnemy.State.Recover) Fail("판정 뒤 쉼으로 안 감");

            // 회피 — 무적 창 안의 판정은 흘린다
            fc.ResetForTest();
            GoStamina.ResetFull();
            if (!fc.Dodge()) Fail("회피가 안 나감");
            if (Mathf.Abs(GoStamina.Value - (GoStamina.Max - FieldCombat.DodgeStamina)) > 0.01f) Fail($"회피 스태미나 {GoStamina.Value}");
            float hp2 = fc.Active.Hp;
            if (fc.ReceiveStrike(e1.Atk, e1) || fc.Active.Hp < hp2) Fail("회피 무적 중에 맞음");
            fc.TickTimers(FieldCombat.DodgeInvulnSec + 0.01f);
            if (!fc.ReceiveStrike(e1.Atk, e1)) Fail("무적이 끝났는데 안 맞음");
            GoStamina.ResetFull();
            pc.Teleport(origin);
        }

        private static void CheckSwapAndWipe(FieldCombat fc, FieldEnemy e1, Vector3 origin)
        {
            fc.ResetForTest();
            fc.RebuildParty();
            int n = fc.Party.Count;
            if (n != Mathf.Min(FieldCombat.MaxParty, 1 + PartyState.MemberIds.Count)) Fail($"명단 {n} 이 등용 수와 안 맞음");
            if (fc.Party[0].Id != FieldCombat.HeroId || fc.Party[0].Element != GoElements.HeroElement) Fail("명단 첫 칸이 주인공(화)이 아님");
            if (n >= 2)
            {
                if (!fc.Swap(1) || fc.ActiveIndex != 1) Fail("교체 1 이 안 됨");
                if (fc.Active.Element != GoElements.ForMember(fc.Active.Id)) Fail("동료 원소가 해시와 다름");
                if (fc.Swap(0)) Fail("교체 쿨 중에 또 바뀜");
                fc.TickTimers(FieldCombat.SwapCooldownSec + 0.05f);
                if (!fc.Swap(0)) Fail("쿨이 끝났는데 안 바뀜");
                // 나선 인물이 쓰러지면 다음 사람으로
                fc.Active.Hp = 1f;
                fc.ReceiveStrike(9999f, e1);
                if (fc.ActiveIndex == 0 || fc.Party[0].Hp > 0f) Fail("쓰러진 뒤 자동 교체가 안 됨");
            }
            else
            {
                Debug.Log($"[{_tag}] field combat: 등용한 동료가 없어 교체 검사 건너뜀");
            }

            // 전멸 — 잃는 것 없이 안전 지점에서 전원 회복
            var pc = fc.GetComponent<PlayerController>();
            pc.Teleport(origin + new Vector3(20f, 0f, 20f));
            int gold0 = GoldState.Gold;
            fc.ResetForTest();
            int count = fc.Party.Count;
            for (int i = 0; i < count; i++)
            {
                fc.Active.Hp = 1f;
                fc.ReceiveStrike(9999f, e1);
            }
            foreach (var m in fc.Party) if (m.Hp < m.MaxHp) { Fail($"전멸 뒤 {m.Name} 이 회복 안 됨"); break; }
            if (fc.ActiveIndex != 0) Fail("전멸 뒤 주인공이 안 나섬");
            Vector3 d = fc.transform.position - fc.SafePoint; d.y = 0f;
            if (d.magnitude > 1f) Fail($"전멸 뒤 안전 지점으로 안 감(거리 {d.magnitude:F1})");
            if (GoldState.Gold != gold0) Fail("전멸로 돈을 잃음");
            pc.Teleport(origin);
        }

        private static void CheckDuelGate(FieldCombat fc)
        {
            fc.ResetForTest();
            DuelGate.Report(true);
            if (!DuelGate.Active) Fail("DuelGate 보고가 안 먹음");
            if (fc.CanBeTargeted) Fail("결투 중인데 적이 노릴 수 있음");
            if (fc.Attack() != -1) Fail("결투 중인데 들판 공격이 나감");
            DuelGate.ResetForTest();
            if (!fc.CanBeTargeted) Fail("결투가 끝났는데 안 풀림");
        }

        private static void CheckHud(FieldCombat fc, PlayerController pc, FieldCombatHud hud, FieldEnemy e1, Vector3 origin)
        {
            fc.ResetForTest();
            hud.Refresh();
            if (!hud.RosterText(0).Contains(fc.Party[0].Name)) Fail($"명단 첫 줄에 주인공 이름이 없음 \"{hud.RosterText(0)}\"");
            Place(e1, origin + Fwd(pc) * 2.5f);
            float hp = e1.Hp;
            hud.AttackButton.onClick.Invoke(); // 진짜 onClick
            if (e1.Hp >= hp) Fail("공격 버튼(진짜 onClick)이 안 먹음");
            if (fc.Party.Count >= 2)
            {
                fc.TickTimers(2f);
                hud.RosterButton(1).onClick.Invoke();
                if (fc.ActiveIndex != 1) Fail("명단 버튼(진짜 onClick)으로 교체가 안 됨");
            }
        }
    }
}
