using TMPro;
using System.Collections.Generic;
using System.Reflection;
using Unity.Cinemachine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using Saga.Core;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>`PlaytestDungeonHeadless` 의 일부(partial) — tasks U-0010 분할.</summary>
    public static partial class PlaytestDungeonHeadless
    {
        /// <summary>PLAN.md 101-2 5.5 "난입"(2026-09-20 추가) — 순수 공식(파도별
        /// 적 수·티어) 먼저 확인한 뒤, 실제로 두 회차(완주/사망)를 다 돌려
        /// `BlessingState`가 "난입 한정"으로 잠깐 비워지고 끝나면 원래대로
        /// 돌아오는지, 15분 생존·사망 둘 다 `HordeRunner.EndRun()`으로 모여
        /// 세이브 통계(`HordeState`)가 늘고 남은 적이 청소되는지 확인한다.
        /// `CheckGraveMarker`가 이미 HeroState.Hp를 0으로 만들어 뒀으므로
        /// 맨 앞에서 `FullHeal()`로 되돌린다.</summary>
        private static void CheckHorde()
        {
            if (DungeonFormulas.HordeEnemyCount(1) != 8 || DungeonFormulas.HordeEnemyCount(20) != 40)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] HordeEnemyCount 공식이 어긋남 — wave1={DungeonFormulas.HordeEnemyCount(1)}(기대 8), wave20={DungeonFormulas.HordeEnemyCount(20)}(기대 40, 상한)");
                _hadError = true;
                return;
            }
            if (DungeonFormulas.HordeTier(7) != 1 || DungeonFormulas.HordeTier(8) != 1 || DungeonFormulas.HordeTier(16) != 2)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] HordeTier 공식이 어긋남 — wave7={DungeonFormulas.HordeTier(7)}(기대 1) wave8={DungeonFormulas.HordeTier(8)}(기대 1) wave16={DungeonFormulas.HordeTier(16)}(기대 2)");
                _hadError = true;
                return;
            }

            var runner = HordeRunner.Instance;
            var playerGo = GameObject.FindWithTag("Player");
            var blessingUi = Object.FindFirstObjectByType<BlessingChoiceUi>();
            if (runner == null || playerGo == null || blessingUi == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 난입 검증용 HordeRunner/player/BlessingChoiceUi를 못 찾음");
                _hadError = true;
                return;
            }

            HeroState.FullHeal();

            // "난입 한정" — 회차용 축복을 하나 미리 쌓아 두고 난입 동안 비워지는지 본다.
            var preOffer = BlessingState.RollChoice(new System.Random(1));
            BlessingState.Choose(preOffer[0]); // offer[0]은 항상 공(攻) 축(BlessingState.RollChoice 참고).
            float atkBefore = BlessingState.AtkMultiplier;
            if (Mathf.Approximately(atkBefore, 1f))
            {
                Debug.LogError("[PlaytestDungeonHeadless] 난입 사전 축복이 안 앉음(AtkMultiplier==1)");
                _hadError = true;
                return;
            }

            Vector3 returnPos = playerGo.transform.position;
            int runsBefore = HordeState.Runs;
            runner.StartRun(returnPos);

            if (!runner.IsActive || runner.Wave != 1)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] StartRun 직후 상태가 이상함 — IsActive={runner.IsActive} Wave={runner.Wave}(기대 true/1)");
                _hadError = true;
                return;
            }
            if (!Mathf.Approximately(BlessingState.AtkMultiplier, 1f))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 난입 시작 시 회차 축복이 안 비워짐 — AtkMultiplier={BlessingState.AtkMultiplier}(기대 1)");
                _hadError = true;
                return;
            }
            int aliveWave1 = DungeonEnemy.CountAliveInRoom("horde");
            if (aliveWave1 != DungeonFormulas.HordeEnemyCount(1))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 난입 파도1 스폰 수가 다름 — {aliveWave1}(기대 {DungeonFormulas.HordeEnemyCount(1)})");
                _hadError = true;
                return;
            }

            // 레벨업 3택이 난입 중에도 뜨는지 — 뜨면 0번(첫 카드)을 골라 닫는다.
            HeroState.AddExp(HeroState.ExpToNext + 1);
            if (!blessingUi.IsShowing)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 난입 중 레벨업인데 축복 3택이 안 뜸");
                _hadError = true;
                return;
            }
            // U-0076 — 3택이 떠 있는 동안은 안 맞는다(고르는 사이 쓰러져 "쓰러졌다" 카드가 단추를 덮었다)
            int hpOpen = HeroState.Hp;
            HeroState.TakeDamage(5f);
            if (HeroState.Hp != hpOpen || HeroState.DamageHold <= 0)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 축복 3택이 떠 있는데 피해가 들어옴(Hp {hpOpen}→{HeroState.Hp}, DamageHold {HeroState.DamageHold})");
                _hadError = true;
                return;
            }
            var chooseIndex = typeof(BlessingChoiceUi).GetMethod("ChooseIndex", BindingFlags.NonPublic | BindingFlags.Instance);
            chooseIndex.Invoke(blessingUi, new object[] { 0 });
            if (blessingUi.IsShowing)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 난입 축복 3택 선택 후에도 패널이 안 닫힘");
                _hadError = true;
                return;
            }
            if (HeroState.DamageHold != 0)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 축복 3택을 골랐는데 피해 막기가 안 풀림(DamageHold {HeroState.DamageHold})");
                _hadError = true;
                return;
            }
            Debug.Log("[PlaytestDungeonHeadless] blessing hold OK - 3택이 떠 있는 동안 피해 0·고르면 풀림");

            // 15분 생존 종료 — 실시간 대기 대신 타이머를 목표 직전으로 밀어 두고
            // Update()를 한 번 더 돌려 그 프레임에 넘기게 한다(CheckWorldBoss와 같은 결).
            var updateMethod = typeof(HordeRunner).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);
            SetPrivate(runner, "_survivalTimer", 15f * 60f - 0.001f);
            int goldBefore = HeroState.Gold;
            updateMethod.Invoke(runner, null);

            if (runner.IsActive)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 15분 생존 종료가 EndRun을 안 부름 — 여전히 IsActive");
                _hadError = true;
                return;
            }
            if (HordeState.Runs != runsBefore + 1)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 완주 후 HordeState.Runs가 안 늘어남 — {HordeState.Runs}(기대 {runsBefore + 1})");
                _hadError = true;
                return;
            }
            if (HeroState.Gold <= goldBefore)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 완주 보상 금이 안 붙음 — {goldBefore}→{HeroState.Gold}");
                _hadError = true;
                return;
            }
            if (!Mathf.Approximately(BlessingState.AtkMultiplier, atkBefore))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 난입 종료 후 회차 축복이 복원 안 됨 — AtkMultiplier={BlessingState.AtkMultiplier}(기대 {atkBefore})");
                _hadError = true;
                return;
            }
            if (Vector3.Distance(playerGo.transform.position, returnPos) > 0.01f)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 완주 후 원래 자리로 복귀 안 함 — {playerGo.transform.position}(기대 {returnPos})");
                _hadError = true;
                return;
            }
            if (DungeonEnemy.CountAliveInRoom("horde") != 0)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 완주 후 남은 난입 적이 안 치워짐 — {DungeonEnemy.CountAliveInRoom("horde")}(기대 0)");
                _hadError = true;
                return;
            }
            Debug.Log($"[PlaytestDungeonHeadless] horde survive OK - 완주 보상 {goldBefore}→{HeroState.Gold}, runs={HordeState.Runs}, 축복 복원 확인, 남은 적 청소 확인");

            // 두 번째 회차 — 사망으로 끝나는 경로. HeroState.Died를 GameBootstrap도
            // 같이 구독하므로("쓰러졌다" 기본 카드) 그 핸들러가 난입 활성 중엔
            // 스킵하는지는 별도로 안 본다(SessionCard 내용까지는 이 체크가 안 봄) —
            // IsActive==false로 EndRun이 확실히 탔는지만 본다.
            HeroState.FullHeal();
            float atkBeforeSecondRun = BlessingState.AtkMultiplier;
            runsBefore = HordeState.Runs;
            runner.StartRun(playerGo.transform.position);
            HeroState.TakeDamage(999999f);

            if (runner.IsActive)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 난입 중 사망이 EndRun을 안 부름 — 여전히 IsActive");
                _hadError = true;
                return;
            }
            if (HordeState.Runs != runsBefore + 1)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 사망 종료 후 HordeState.Runs가 안 늘어남 — {HordeState.Runs}(기대 {runsBefore + 1})");
                _hadError = true;
                return;
            }
            if (!Mathf.Approximately(BlessingState.AtkMultiplier, atkBeforeSecondRun))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 사망 종료 후 회차 축복이 복원 안 됨 — AtkMultiplier={BlessingState.AtkMultiplier}(기대 {atkBeforeSecondRun})");
                _hadError = true;
                return;
            }
            Debug.Log($"[PlaytestDungeonHeadless] horde death OK - 사망으로도 EndRun 확인, runs={HordeState.Runs}");
        }

        private static DungeonEnemy SpawnDummyEnemy(Vector3 position, bool isWorldBoss = false)
        {
            var go = new GameObject("WhirlTestDummy");
            go.transform.position = position;
            var enemy = go.AddComponent<DungeonEnemy>();
            if (isWorldBoss) SetPrivate(enemy, "isWorldBoss", true);
            return enemy;
        }

        /// <summary>PLAN.md 106-1 진단용 — 씬의 다른 적을 잠깐 꺼 후보를 더미로만 좁힌다.</summary>
        private static List<DungeonEnemy> DisableOtherEnemies()
        {
            var list = new List<DungeonEnemy>(DungeonEnemy.Active);
            foreach (var e in list)
            {
                if (e != null) e.gameObject.SetActive(false);
            }
            return list;
        }

        private static void RestoreEnemies(List<DungeonEnemy> list)
        {
            foreach (var e in list)
            {
                if (e != null) e.gameObject.SetActive(true);
            }
        }

        private static void ResetDodge(PlayerController controller)
        {
            SetPrivate(controller, "_dodgeTimeLeft", 0f);
            SetPrivate(controller, "_dodgeCooldownLeft", 0f);
            SetPrivate(controller, "_invulnTimeLeft", 0f);
            HeroState.Invulnerable = false;
        }

        /// <summary>PLAN.md 106-1 "락온" — 뒤의 더 가까운 적보다 카메라 정면의 적을
        /// 먼저 잡는지, 카메라·표식이 따라오는지, Tab 전환·락온 백스텝·대상 사망 시
        /// 자동 전환·해제를 진짜 메서드로 확인한다.</summary>
        private static void CheckLockOn()
        {
            const string T = "[PlaytestDungeonHeadless] lockon";
            var playerGo = GameObject.FindWithTag("Player");
            var lockOn = playerGo != null ? playerGo.GetComponent<PlayerLockOn>() : null;
            var controller = playerGo != null ? playerGo.GetComponent<PlayerController>() : null;
            var rig = playerGo != null ? playerGo.GetComponentInChildren<CameraRig>() : null;
            if (lockOn == null || controller == null || rig == null)
            {
                Debug.LogError($"{T} — Player 에 PlayerLockOn/PlayerController/CameraRig 가 없다(씬 재빌드 필요)");
                _hadError = true;
                return;
            }

            var others = DisableOtherEnemies();
            DungeonEnemy front = null, back = null;
            try
            {
                lockOn.Release();
                Vector3 p = playerGo.transform.position;
                Vector3 fwd = rig.transform.forward;
                fwd.y = 0f;
                fwd.Normalize();
                back = SpawnDummyEnemy(p - fwd * 2.5f);  // 더 가깝지만 등 뒤.
                front = SpawnDummyEnemy(p + fwd * 4f);

                lockOn.Toggle();
                if (lockOn.Target != front || rig.LockTarget != front.transform || !lockOn.MarkerVisible)
                {
                    Debug.LogError($"{T} — 정면 적을 못 잡음 target={lockOn.Target} camera={rig.LockTarget} marker={lockOn.MarkerVisible}");
                    _hadError = true;
                    return;
                }

                lockOn.SwitchTarget();
                if (lockOn.Target != back)
                {
                    Debug.LogError($"{T} — Tab 전환이 다른 적으로 안 넘어감 target={lockOn.Target}");
                    _hadError = true;
                    return;
                }

                ResetDodge(controller);
                controller.TryDodge();
                var dodgeDir = (Vector3)GetPrivate(controller, "_dodgeDir");
                Vector3 away = p - back.transform.position;
                away.y = 0f;
                away.Normalize();
                if (Vector3.Dot(dodgeDir, away) < 0.95f || !HeroState.Invulnerable)
                {
                    Debug.LogError($"{T} — 락온 중 입력 없는 회피가 백스텝이 아님 dir={dodgeDir} away={away} invuln={HeroState.Invulnerable}");
                    _hadError = true;
                    return;
                }

                back.TakeDamage(999999f);
                lockOn.Refresh();
                if (lockOn.Target != front)
                {
                    Debug.LogError($"{T} — 대상이 죽은 뒤 남은 적으로 자동 전환 안 됨 target={lockOn.Target}");
                    _hadError = true;
                    return;
                }

                lockOn.Toggle();
                if (lockOn.IsLocked || rig.LockTarget != null || lockOn.MarkerVisible)
                {
                    Debug.LogError($"{T} — 해제가 안 됨 locked={lockOn.IsLocked} camera={rig.LockTarget} marker={lockOn.MarkerVisible}");
                    _hadError = true;
                    return;
                }
                Debug.Log($"{T} OK - 정면 우선·카메라/표식·Tab 전환·백스텝·사망 시 자동 전환·해제");
            }
            finally
            {
                lockOn.Release();
                ResetDodge(controller);
                if (front != null) Object.Destroy(front.gameObject);
                if (back != null) Object.Destroy(back.gameObject);
                RestoreEnemies(others);
            }
        }

        /// <summary>PLAN.md 106-1 "적 공격 예고" — `DungeonEnemy.Tick()`에 시간을 직접
        /// 넣어 예비동작 중엔 안 맞고·판정에 맞고·반경 밖이면 헛손질·회피 무적이면
        /// 완벽 회피(반격 창)·반격 평타 2배·강공격이 예비동작을 끊는지 확인한다.</summary>
        private static void CheckEnemyTelegraph()
        {
            const string T = "[PlaytestDungeonHeadless] telegraph";
            var playerGo = GameObject.FindWithTag("Player");
            var controller = playerGo != null ? playerGo.GetComponent<PlayerController>() : null;
            var combat = playerGo != null ? playerGo.GetComponent<PlayerCombat>() : null;
            if (controller == null || combat == null)
            {
                Debug.LogError($"{T} — Player/PlayerController/PlayerCombat 없음");
                _hadError = true;
                return;
            }

            var others = DisableOtherEnemies();
            DungeonEnemy e = null;
            try
            {
                HeroState.FullHeal();
                ResetDodge(controller);
                SetPrivate(combat, "_counterUntil", -1f);
                Vector3 p = playerGo.transform.position;
                e = SpawnDummyEnemy(p + new Vector3(1.5f, 0f, 0f));
                SetPrivate(e, "_curHp", 9999f);

                e.Tick(0.016f); // Idle → Chase
                e.Tick(0.016f); // 사거리 안 → 예비동작
                int hp0 = HeroState.Hp;
                bool started = e.IsWindingUp;
                e.Tick(0.3f);
                bool heldDuringWindup = e.IsWindingUp && HeroState.Hp == hp0;
                e.Tick(0.25f);
                bool hitOnStrike = !e.IsWindingUp && HeroState.Hp < hp0;
                if (!started || !heldDuringWindup || !hitOnStrike)
                {
                    Debug.LogError($"{T} — 예비동작→판정 순서가 틀림 started={started} held={heldDuringWindup} hit={hitOnStrike} hp {hp0}→{HeroState.Hp}");
                    _hadError = true;
                    return;
                }

                SetPrivate(e, "_attackCooldown", 0f);
                e.Tick(0.016f);
                int hp1 = HeroState.Hp;
                e.transform.position = p + new Vector3(6f, 0f, 0f);
                e.Tick(0.6f);
                if (e.IsWindingUp || HeroState.Hp != hp1)
                {
                    Debug.LogError($"{T} — 판정 반경 밖인데 맞음 hp {hp1}→{HeroState.Hp}");
                    _hadError = true;
                    return;
                }

                e.transform.position = p + new Vector3(1.5f, 0f, 0f);
                SetPrivate(e, "_attackCooldown", 0f);
                e.Tick(0.016f);
                ResetDodge(controller);
                controller.TryDodge();
                e.Tick(0.6f);
                if (HeroState.Hp != hp1 || !combat.CounterReady)
                {
                    Debug.LogError($"{T} — 회피 무적으로 흘렸는데 맞았거나 반격 창이 안 열림 hp {hp1}→{HeroState.Hp} counter={combat.CounterReady}");
                    _hadError = true;
                    return;
                }

                ResetDodge(controller);
                SetPrivate(combat, "_cooldownLeft", 0f);
                float before = (float)GetPrivate(e, "_curHp");
                combat.TriggerAttack();
                float dealt = before - (float)GetPrivate(e, "_curHp");
                float want = HeroState.HitDamage * PlayerCombat.CounterDamageMul;
                if (Mathf.Abs(dealt - want) > 0.01f || combat.CounterReady)
                {
                    Debug.LogError($"{T} — 반격 평타 피해가 {PlayerCombat.CounterDamageMul}배가 아님 dealt={dealt} want={want} counterLeft={combat.CounterReady}");
                    _hadError = true;
                    return;
                }

                SetPrivate(e, "_attackCooldown", 0f);
                e.Tick(0.016f);
                bool windingBeforeHeavy = e.IsWindingUp;
                SetPrivate(combat, "_heavyCooldownLeft", 0f);
                combat.TriggerHeavyAttack();
                if (!windingBeforeHeavy || e.IsWindingUp)
                {
                    Debug.LogError($"{T} — 강공격이 잡졸 예비동작을 못 끊음 before={windingBeforeHeavy} after={e.IsWindingUp}");
                    _hadError = true;
                    return;
                }
                Debug.Log($"{T} OK - 예비동작 중 무피해·판정 피해·반경 밖 헛손질·완벽 회피 반격 창·반격 {PlayerCombat.CounterDamageMul}배·강공격 끊기");
            }
            finally
            {
                ResetDodge(controller);
                SetPrivate(combat, "_counterUntil", -1f);
                HeroState.FullHeal();
                if (e != null) Object.Destroy(e.gameObject);
                RestoreEnemies(others);
            }
        }
    }
}
