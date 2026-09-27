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
    /// <summary>
    /// `PlaytestHeadless.cs`(GO)와 같은 결, 씬 경로만 다르다 — TestDungeon
    /// 씬을 배치 모드에서 몇 프레임 재생해 런타임 예외가 없는지 확인한다.
    /// **주의 — PlaytestHeadless.cs와 같은 이유로 -executeMethod로 부를
    /// 때 -quit을 같이 주지 않는다.**
    ///
    /// **회전베기 검증(2026-09-14 추가)** — 이 프로젝트의 DUNGEON
    /// Playtest들은 지금까지 `TakeDamage(999999f)`로 적을 바로 죽여
    /// 전투 스킬(TryAttack/TryHeavyAttack) 자체는 한 번도 직접 확인한
    /// 적이 없었다(PlaytestDungeonFloorProgression.cs 등). 새 AoE
    /// 스킬(PlayerCombat.TriggerWhirl, PLAN.md 51장 "DUNGEON 확장 —
    /// 빌드")은 "반경 안 여럿, 반경 밖은 안 건드림"이 핵심이라 이번엔
    /// 직접 스폰한 더미로 실제로 확인한다(STORY `PlaytestStorySlice.
    /// SpawnDummyEnemy`와 같은 결).
    /// </summary>
    public static class PlaytestDungeonHeadless
    {
        private const string ScenePath = "Assets/Scenes/TestDungeon.unity";
        private const int FramesToRun = 10;
        private const int WhirlCheckFrame = 3; // 씬 로드 직후 Awake 체인이 다 돈 뒤(여유 있게 잡음).
        // PLAN.md 106-3 — 브레인은 LateUpdate 에서 실제 카메라를 옮기므로 컷 카메라는 프레임을 넘겨 본다.
        private const int CutLiveCheckFrame = 6;
        private const int CutBackCheckFrame = 8;
        private static bool _cutProbeStarted;

        private static int _framesSeen;
        private static bool _hadError;
        private static bool _whirlChecked;
        private static bool _origEnterPlayModeOptionsEnabled;
        private static EnterPlayModeOptions _origEnterPlayModeOptions;

        [MenuItem("Saga/Playtest TestDungeon (Headless)")]
        public static void Run()
        {
            _origEnterPlayModeOptionsEnabled = EditorSettings.enterPlayModeOptionsEnabled;
            _origEnterPlayModeOptions = EditorSettings.enterPlayModeOptions;
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions =
                EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;

            EditorSceneManager.OpenScene(ScenePath);
            _framesSeen = 0;
            _hadError = false;
            _whirlChecked = false;
            _cutProbeStarted = false;
            Application.logMessageReceived += OnLog;
            EditorApplication.playModeStateChanged += OnStateChanged;
            EditorApplication.isPlaying = true;
        }

        private static void OnLog(string condition, string stackTrace, LogType type)
        {
            if (type != LogType.Error && type != LogType.Exception) return;
            if (stackTrace.Contains("UnityEditor.Search.SearchInit.IndexationOnStartup")) return;

            _hadError = true;
            Debug.LogError($"[PlaytestDungeonHeadless] runtime error: {condition}\n{stackTrace}");
        }

        private static void OnStateChanged(PlayModeStateChange state)
        {
            if (state == PlayModeStateChange.EnteredPlayMode)
            {
                EditorApplication.update += CountFrames;
            }
            else if (state == PlayModeStateChange.EnteredEditMode)
            {
                Application.logMessageReceived -= OnLog;
                EditorApplication.playModeStateChanged -= OnStateChanged;
                EditorSettings.enterPlayModeOptionsEnabled = _origEnterPlayModeOptionsEnabled;
                EditorSettings.enterPlayModeOptions = _origEnterPlayModeOptions;
                Debug.Log(_hadError
                    ? "[PlaytestDungeonHeadless] FAIL - runtime error(s) logged"
                    : $"[PlaytestDungeonHeadless] OK - {FramesToRun} frames, no errors");
                EditorApplication.Exit(_hadError ? 1 : 0);
            }
        }

        private static void CountFrames()
        {
            _framesSeen++;

            if (_framesSeen == WhirlCheckFrame && !_whirlChecked)
            {
                _whirlChecked = true;
                CheckHitstop(); // CheckWhirl보다 먼저 — TryAttack의 _cooldownLeft는 TryWhirl의 _whirlCooldownLeft와 별개 필드라 순서가 서로 안 막는다.
                CheckHitSpark();
                // CheckLootMarker보다 먼저 — CheckLootMarker의 더미 처치 보상(rewardExp
                // 기본값 20)이 레벨 1의 ExpToNext(20)와 정확히 맞아떨어져 그 자리에서
                // 먼저 레벨업을 하나 유발한다. 그 뒤에 이 체크가 돌면 Time.deltaTime이
                // 이 프레임에 크게 잡힌 경우(배치 모드 실행 시간 편차) CameraRig.
                // LevelUpCutRoutine()의 첫 동기 반복에서 두 번의 레벨업 컷이 모두
                // _zoom을 MinZoom으로 완전히 클램프해 zoomBefore==zoomAfter가 되어
                // 간헐적으로 실패했다(2026-09-17, 지형 반응 데칼 검증 중 실제로 겪음).
                // 이 체크를 세션의 첫 레벨업으로 만들면 zoomBefore가 항상 손 안 댄
                // 기본값(6)이라 결정적으로 통과한다.
                CheckLevelUpCut();
                CheckLootMarker();
                CheckSigilState();
                CheckWorldBoss();
                CheckWeaponVisual();
                CheckEraFusion();
                CheckWhirl();
                CheckDebugHud();
                CheckSettingsPanel();
                CheckButtonWiring();
                CheckPlayerHudLocalization();
                CheckActionButtonLocalization();
                CheckGoalBoardAndSessionCard();
                CheckGraveMarker(); // SessionCard를 띄우므로 CheckGoalBoardAndSessionCard 뒤(그 체크가 "시작부터 숨김" 전제를 이미 다 씀).
                CheckGroundDecal();
                CheckHorde(); // PLAN.md 101-2 5.5 — CheckGraveMarker가 이미 HeroState.Hp를 0으로 만들어 둬 이 체크 맨 앞에서 FullHeal()로 되돌린다.
                CheckNpcModels(); // PLAN.md 106-4 — 씬을 안 바꾸는 검사라 앞쪽 아무 데나.
                CheckLockOn(); // PLAN.md 106-1 — 더미 처치가 레벨업을 부를 수 있어 CheckLevelUpCut 뒤.
                CheckEnemyTelegraph();
                if (!PlaytestDungeonBossIntro.Run()) _hadError = true; // PLAN.md 106-7 층 두목 등장 컷.
                if (!PlaytestNpcModels.Dungeon()) _hadError = true; // 106-4 능묘지기 전용 몸(읽기만)
                if (!PlaytestDungeonParty.Run()) _hadError = true; // PLAN.md 106-6 파티·소환 — 더미로 보고 자리·게이지를 되돌린다.
                if (!PlaytestDungeonExplore.Run()) _hadError = true; // PLAN.md 106-5 탐험 — 걷고 뛰고 오른 뒤 자리·비트를 되돌린다.
                if (!PlaytestDungeonLandmarks.Run()) _hadError = true; // PLAN.md 108 ③ 명소 층 — 층·토벌·영웅·자리를 되돌린다.
                if (!PlaytestDungeonEras.Run()) _hadError = true; // PLAN.md 109-2 세 시대 — 층·도감·자리를 되돌린다.
                if (!PlaytestDungeonEraDecor.Run()) _hadError = true; // PLAN.md 109-2b 명소 층·마을 꾸밈 시대 층 — 층·자리를 되돌린다.
                if (!PlaytestDungeonSecrets.Run()) _hadError = true; // PLAN.md 109-10 비결·빛기둥 — 영웅·비결·다른 적을 되돌린다.
                if (!PlaytestDungeonTrial.Run()) _hadError = true; // PLAN.md 109-10-3 시련 — 시련 기록·영웅·자리를 되돌린다.
                if (!PlaytestDungeonRegions.Run()) _hadError = true; // PLAN.md 109-10-4 지역 아홉 — 자리·배너 상태를 되돌린다.
                if (!PlaytestDungeonRegionFoes.Run()) _hadError = true; // PLAN.md 109-10-5 지역 우두머리 — 영웅·기록·자리를 되돌린다.
                CheckTemple(); // PLAN.md 106-2 — 플레이어를 순간이동시키므로 맨 끝(finally 에서 되돌린다).
                StartCutCameraProbe(); // PLAN.md 106-3 — 6·8프레임째에 이어서 본다.
            }
            if (_framesSeen == CutLiveCheckFrame) CheckCutCameraLive();
            if (_framesSeen == CutBackCheckFrame) CheckCutCameraBack();

            if (_framesSeen >= FramesToRun)
            {
                EditorApplication.update -= CountFrames;
                EditorApplication.isPlaying = false;
            }
        }

        /// <summary>"타격감 2차"(PLAN.md 101-3 C hitstop, 2026-09-17 추가) —
        /// `PlayerCombat.ApplyHitstop()`가 코루틴 첫 세그먼트(첫 yield 전)를
        /// `StartCoroutine()` 호출과 같은 프레임에 동기 실행한다는 점을
        /// 이용해, 공격 직후 바로 Animator.speed==0인지 확인한다(복원
        /// 타이밍까지는 안 본다 — `SessionCard`의 `_closeTimer`처럼 실시간을
        /// 흉내 내는 필드가 따로 없어, FlashHit()의 색 복원과 같은 결로
        /// 신뢰한다). 더미(`SpawnDummyEnemy`)는 모델이 없어 자기 Animator가
        /// 원래 null이라 피해자 쪽은 "null 허용" 분기만 확인되고, 가해자
        /// (플레이어) 쪽만 실제로 값을 본다.</summary>
        private static void CheckHitstop()
        {
            var playerGo = GameObject.FindWithTag("Player");
            var combat = playerGo != null ? playerGo.GetComponent<PlayerCombat>() : null;
            var controller = playerGo != null ? playerGo.GetComponent<PlayerController>() : null;
            if (playerGo == null || combat == null || controller == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] hitstop 검증용 player/PlayerCombat/PlayerController를 못 찾음");
                _hadError = true;
                return;
            }

            var dummy = SpawnDummyEnemy(playerGo.transform.position + new Vector3(1.5f, 0f, 0f));
            var playerAnimator = controller.Animator;
            combat.TriggerAttack();
            float? speedRightAfter = playerAnimator != null ? playerAnimator.speed : (float?)null;
            Object.Destroy(dummy.gameObject);

            if (playerAnimator == null)
            {
                Debug.Log("[PlaytestDungeonHeadless] hitstop 검증 스킵 — 이 씬 Player Animator가 null(폴백 캡슐, 정상 케이스)");
                return;
            }
            if (speedRightAfter != 0f)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] hitstop이 공격 직후 player Animator를 안 멈춤 — speed={speedRightAfter}");
                _hadError = true;
                return;
            }
            Debug.Log("[PlaytestDungeonHeadless] hitstop OK - 공격 직후 player Animator.speed=0 확인");
        }

        /// <summary>PLAN.md 101-3 C "타격 VFX"(2026-09-17 추가) — `HitSpark`는
        /// 풀링 없이 매번 새 GameObject를 만들어 `SpawnCount`(테스트 전용
        /// 카운터, `StoryCombat.RestoreMp`와 같은 결)로만 확인한다. 실제
        /// 타격은 `DungeonEnemy.TakeDamage()`가 부르므로 더미를 죽지 않을
        /// 만큼 살짝만 때린다(CheckHitstop처럼 999999f로 즉사시키면 이후
        /// 검증에 쓸 더미가 없어진다 — 이 더미는 이 체크 전용으로 새로 스폰).</summary>
        private static void CheckHitSpark()
        {
            var playerGo = GameObject.FindWithTag("Player");
            if (playerGo == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] hitspark 검증용 player를 못 찾음");
                _hadError = true;
                return;
            }

            var dummy = SpawnDummyEnemy(playerGo.transform.position + new Vector3(1.5f, 0f, 0f));
            int before = HitSpark.SpawnCount;
            dummy.TakeDamage(1f);
            Object.Destroy(dummy.gameObject);

            if (HitSpark.SpawnCount != before + 1)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 히트 파티클이 안 생김 — SpawnCount {before} → {HitSpark.SpawnCount}");
                _hadError = true;
                return;
            }
            Debug.Log("[PlaytestDungeonHeadless] hitspark OK - 타격마다 HitSpark.Spawn 호출 확인");
        }

        /// <summary>PLAN.md 101-3 F "죽음"(2026-09-17 추가) — 실제로 죽여서
        /// `LootMarker.Spawn()`이 불렸는지만 카운터로 본다(`CheckHitSpark`와
        /// 같은 결). 더미를 player 1.5m 옆에서 죽여 마커의 회수 반경(2m)
        /// 안에서 바로 스폰되게 하면 이후 자연 프레임에서 픽업 경로도 같이
        /// 타는데, 그때 예외가 나면 `Run()`의 전역 로그 리스너가 잡아
        /// FAIL로 드러난다 — 여기서 따로 다시 확인하지 않는다.</summary>
        private static void CheckLootMarker()
        {
            var playerGo = GameObject.FindWithTag("Player");
            if (playerGo == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 유품 마커 검증용 player를 못 찾음");
                _hadError = true;
                return;
            }

            var dummy = SpawnDummyEnemy(playerGo.transform.position + new Vector3(1.5f, 0f, 0f));
            int before = LootMarker.SpawnCount;
            dummy.TakeDamage(999999f);

            if (LootMarker.SpawnCount != before + 1)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 유품 마커가 안 생김 — SpawnCount {before} → {LootMarker.SpawnCount}");
                _hadError = true;
                return;
            }
            Debug.Log("[PlaytestDungeonHeadless] loot marker OK - 사망마다 LootMarker.Spawn 호출 확인(픽업 경로는 이후 자연 프레임에서 같이 검증됨)");
        }

        /// <summary>PLAN.md 101-2 5.3 "부적 던전"(2026-09-19 추가) — `SigilState`는
        /// UnityEngine 의존이 없는 순수 함수라 게임 오브젝트 없이 직접 호출해
        /// 값을 본다(`DungeonFormulas`류와 같은 결). 층9(층10 미만)·층11(보스층
        /// 아님)은 부적 층이 아니고, 층12(보스층·10 이상)는 부적 층에 정예 폭증
        /// (hp×2·dmg×1), 층15는 유리대포(hp×1·dmg×1.5)가 항상 걸리는지 —
        /// 그리고 `ModOf`가 결정적인지(같은 층 두 번 호출해도 같음) 확인한다.</summary>
        private static void CheckSigilState()
        {
            if (SigilState.IsSigilFloor(9) || SigilState.IsSigilFloor(11) || !SigilState.IsSigilFloor(12))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] SigilState.IsSigilFloor 조건이 어긋남 — 9={SigilState.IsSigilFloor(9)} 11={SigilState.IsSigilFloor(11)} 12={SigilState.IsSigilFloor(12)}(기대 false/false/true)");
                _hadError = true;
                return;
            }

            if (SigilState.ModOf(12) != SigilState.ModOf(12))
            {
                Debug.LogError("[PlaytestDungeonHeadless] SigilState.ModOf가 결정적이지 않음(같은 층인데 값이 다름)");
                _hadError = true;
                return;
            }

            bool eliteSurgeOk = Mathf.Approximately(SigilState.EnemyHpMultiplier(12), 2f) && Mathf.Approximately(SigilState.EnemyDamageMultiplier(12), 1f);
            bool glassCannonOk = Mathf.Approximately(SigilState.EnemyHpMultiplier(15), 1f) && Mathf.Approximately(SigilState.EnemyDamageMultiplier(15), 1.5f);
            bool normalFloorOk = Mathf.Approximately(SigilState.EnemyHpMultiplier(9), 1f) && Mathf.Approximately(SigilState.EnemyDamageMultiplier(11), 1f);
            if (!eliteSurgeOk || !glassCannonOk || !normalFloorOk)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] SigilState 배율이 기대와 다름 — 12층 hp×{SigilState.EnemyHpMultiplier(12)} dmg×{SigilState.EnemyDamageMultiplier(12)}, 15층 hp×{SigilState.EnemyHpMultiplier(15)} dmg×{SigilState.EnemyDamageMultiplier(15)}");
                _hadError = true;
                return;
            }

            int bonus12 = SigilState.ClearBonusGold(12);
            int expectedBonus12 = DungeonFormulas.RewardGold(12, true);
            if (bonus12 != expectedBonus12 || SigilState.ClearBonusGold(11) != 0)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] SigilState.ClearBonusGold가 기대와 다름 — 12층={bonus12}(기대 {expectedBonus12}), 11층={SigilState.ClearBonusGold(11)}(기대 0)");
                _hadError = true;
                return;
            }

            Debug.Log($"[PlaytestDungeonHeadless] sigil state OK - 층12=정예 폭증(hp×2), 층15=유리대포(dmg×1.5), 결정적, 클리어 보상 {bonus12}");
        }

        /// <summary>PLAN.md 101-2 5.4 "월드 보스"(2026-09-19 추가) — 두목 더미를
        /// 세워 아직 아무도 안 부른 `Update()`를 리플렉션으로 한 번 직접
        /// 불러(`SessionCard` 만료 검증과 같은 결) Idle→Chase 전환·타이머
        /// 시작을 확인하고, 부위 파괴 보상·완파까지 실제로 죽여 확인한다.
        /// 별도 더미로 시간 초과(도망) 경로도 확인한다 — `_worldBossTimeLeft`를
        /// 리플렉션으로 만료 직전까지 깎은 뒤 `Update()`를 한 번 더 불러
        /// `Flee()`가 타는지 본다.</summary>
        private static void CheckWorldBoss()
        {
            var playerGo = GameObject.FindWithTag("Player");
            if (playerGo == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 월드 보스 검증용 player를 못 찾음");
                _hadError = true;
                return;
            }

            var updateMethod = typeof(DungeonEnemy).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);
            var boss = SpawnDummyEnemy(playerGo.transform.position + new Vector3(1f, 0f, 0f), isWorldBoss: true);
            updateMethod.Invoke(boss, null); // Idle→Chase, 타이머 시작.

            if (DungeonEnemy.ActiveWorldBoss != boss || !(boss.WorldBossTimeLeft > 0f))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 월드 보스 타이머가 시작 안 됨 — ActiveWorldBoss={(DungeonEnemy.ActiveWorldBoss == boss)}, timeLeft={boss.WorldBossTimeLeft}");
                _hadError = true;
                Object.Destroy(boss.gameObject);
                return;
            }

            float bossHp = (float)GetPrivate(boss, "hp"); // SpawnDummyEnemy 기본값 24.
            int goldBefore = HeroState.Gold;
            boss.TakeDamage(bossHp * 0.30f); // 70%로 낮춰 첫 문턱(75%)만 넘긴다.
            if (HeroState.Gold <= goldBefore)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 월드 보스 부위 파괴 보상이 안 나옴(첫 문턱)");
                _hadError = true;
                Object.Destroy(boss.gameObject);
                return;
            }

            boss.TakeDamage(bossHp); // 확실히 죽인다 — 남은 두 문턱+완파 보너스+사망 보상까지 한 번에.
            if (DungeonEnemy.ActiveWorldBoss != null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 월드 보스 사망 후에도 ActiveWorldBoss가 안 지워짐");
                _hadError = true;
                return;
            }

            // 시간 초과(도망) 경로 — 별도 더미. Destroy()는 이 프레임 끝에야
            // 실제로 처리돼(Unity 표준 동작) 같은 프레임 안에서 `fleeBoss == null`을
            // 곧바로 기대할 수 없다(LootMarker류와 같은 이유로 파괴 자체는 여기서
            // 안 본다) — 대신 동기 부작용(보상·ActiveWorldBoss 해제)만 확인한다.
            var fleeBoss = SpawnDummyEnemy(playerGo.transform.position + new Vector3(-1f, 0f, 0f), isWorldBoss: true);
            updateMethod.Invoke(fleeBoss, null); // Idle→Chase, 타이머 시작.
            SetPrivate(fleeBoss, "_worldBossTimeLeft", 0.0001f);
            int goldBeforeFlee = HeroState.Gold;
            updateMethod.Invoke(fleeBoss, null); // 다음 프레임 취급 — 타임아웃 → Flee().

            if (HeroState.Gold <= goldBeforeFlee || DungeonEnemy.ActiveWorldBoss != null)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 월드 보스 도망 경로가 어긋남 — gold {goldBeforeFlee}→{HeroState.Gold}, ActiveWorldBoss null={DungeonEnemy.ActiveWorldBoss == null}");
                _hadError = true;
                return;
            }

            Debug.Log($"[PlaytestDungeonHeadless] world boss OK - 타이머 시작·부위 파괴 보상·완파 정산·시간 초과 도망(축소 보상) 전부 확인");
        }

        /// <summary>PLAN.md 101-2 5.2 "유품"(2026-09-19 추가) — 플레이어를 실제로
        /// 죽여(`HeroState.TakeDamage`) `GraveMarker.Spawn()`이 불렸는지, 그리고
        /// 소지 골드가 정확히 그 값만큼 0으로 비워지는지 본다(`CheckLootMarker`와
        /// 같은 결 — 회수 경로는 마커가 플레이어 자리에 그대로 스폰돼(거리 0,
        /// PickupRadius 2m 안) 이후 자연 프레임에서 예외 없이 타는지로 대신
        /// 확인한다). `CheckGoalBoardAndSessionCard` 뒤에 둔다 — 이 죽음이
        /// `GameBootstrap.OnHeroDied()`로 SessionCard를 띄우는데, 그 체크는
        /// "세션 시작부터 떠 있으면 실패"를 전제해 먼저 끝나 있어야 한다.</summary>
        private static void CheckGraveMarker()
        {
            var playerGo = GameObject.FindWithTag("Player");
            if (playerGo == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 유품(사망) 검증용 player를 못 찾음");
                _hadError = true;
                return;
            }

            HeroState.AddGold(77);
            int goldBefore = HeroState.Gold;
            int before = GraveMarker.SpawnCount;

            HeroState.TakeDamage(999999f);

            if (GraveMarker.SpawnCount != before + 1)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 유품(사망) 마커가 안 생김 — SpawnCount {before} → {GraveMarker.SpawnCount}");
                _hadError = true;
                return;
            }
            if (HeroState.Gold != 0)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 사망 후 골드가 안 비워짐 — {HeroState.Gold}(기대 0, 원래 {goldBefore})");
                _hadError = true;
                return;
            }
            Debug.Log($"[PlaytestDungeonHeadless] grave marker OK - 사망 시 금 {goldBefore} 전부 유품으로, HeroState.Gold=0(픽업 경로는 이후 자연 프레임에서 같이 검증됨)");
        }

        /// <summary>PLAN.md 101-3 G "성장 연출"(2026-09-17 추가) — Timeline
        /// 대신 `CameraRig.PlayLevelUpCut()`(줌 펀치인)으로 대신했다(클래스
        /// 주석 참고). `HeroState.AddExp()`가 `LeveledUp`을 동기 호출하고
        /// `GameBootstrap.OnLeveledUp()`이 그 자리에서 `StartCoroutine()`을
        /// 부르니 `CheckHitstop`과 같은 이유로 같은 프레임에 `_zoom`이 이미
        /// 움직여 있다.</summary>
        private static void CheckLevelUpCut()
        {
            var cameraRig = Object.FindFirstObjectByType<CameraRig>();
            if (cameraRig == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 성장 연출 검증용 CameraRig를 못 찾음");
                _hadError = true;
                return;
            }

            var zoomField = typeof(CameraRig).GetField("_zoom", BindingFlags.NonPublic | BindingFlags.Instance);
            float zoomBefore = (float)zoomField.GetValue(cameraRig);

            HeroState.AddExp(HeroState.ExpToNext + 1);

            float zoomAfter = (float)zoomField.GetValue(cameraRig);
            if (Mathf.Approximately(zoomAfter, zoomBefore))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 레벨업 직후 카메라 줌이 안 바뀜 — zoom={zoomAfter}");
                _hadError = true;
                return;
            }
            Debug.Log($"[PlaytestDungeonHeadless] level-up cut OK - 레벨업 직후 zoom {zoomBefore:F2}→{zoomAfter:F2}");
        }

        /// <summary>PLAN.md 101-3 G "장비 가시화"(2026-09-17 추가) —
        /// `HeroState.EquipmentChanged`가 동기 이벤트라 `CheckLevelUpCut`과
        /// 같은 이유로 `EquipIfBetter()` 호출 직후 바로 값을 본다.
        /// wp_glaive(2등급, AtkBonus 26)는 이 시점까지 다른 검사가 남긴
        /// 어떤 드랍(기본 wp_axe, 2등급 미만)보다도 확실히 세서 결정적으로
        /// "장착됨 → 칼날이 커짐"을 보장한다.</summary>
        private static void CheckWeaponVisual()
        {
            var playerGo = GameObject.FindWithTag("Player");
            var weaponVisual = playerGo != null ? playerGo.GetComponent<WeaponVisual>() : null;
            if (playerGo == null || weaponVisual == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 무기 가시화 검증용 WeaponVisual을 못 찾음");
                _hadError = true;
                return;
            }

            var blade = (Transform)GetPrivate(weaponVisual, "_blade");
            if (blade == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 무기 칼날(blade) 메시가 안 생김");
                _hadError = true;
                return;
            }

            float lengthBefore = blade.localScale.y;
            HeroState.EquipIfBetter("wp_glaive");
            float lengthAfter = blade.localScale.y;

            if (lengthAfter <= lengthBefore)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 무기 등급 갱신이 칼날 크기에 안 반영됨 — {lengthBefore:F2}→{lengthAfter:F2}");
                _hadError = true;
                return;
            }
            Debug.Log($"[PlaytestDungeonHeadless] weapon visual OK - 무기 교체 시 칼날 길이 {lengthBefore:F2}→{lengthAfter:F2}(등급 갱신 반영)");
        }

        /// <summary>PLAN.md 101-2 5.7 "시대 퓨전"(2026-09-20 추가) — 순수 함수
        /// (`EraFusionData`)를 먼저 값으로 확인한 뒤, 절차적 정예 스폰
        /// (`DungeonFloorRunner.SpawnElite()`)을 리플렉션으로 두 층(비퓨전
        /// 4층·퓨전 5층)에서 직접 불러 표시명·드랍·색이 실제로 갈리는지,
        /// 그리고 두 미래 무기(`wp_lance_e`/`wp_gauntlet`)를 강제 장착했을 때
        /// `WeaponVisual`의 칼날 모양이 등급 3단과 별개로 갈리는지 본다
        /// (`HeroState.Restore()`로 진행도를 안 흔들고 무기만 바꿔치기 —
        /// `EquipIfBetter`의 "더 셀 때만" 문턱을 피해야 해서).</summary>
        private static void CheckEraFusion()
        {
            if (EraFusionData.IsFusionFloor(4) || !EraFusionData.IsFusionFloor(5))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] EraFusionData.IsFusionFloor 문턱이 어긋남 — 4층={EraFusionData.IsFusionFloor(4)}(기대 false) 5층={EraFusionData.IsFusionFloor(5)}(기대 true)");
                _hadError = true;
                return;
            }
            if (EraFusionData.FusionRewardItemId(5) != "wp_gauntlet" || EraFusionData.FusionRewardItemId(6) != "wp_lance_e")
            {
                Debug.LogError($"[PlaytestDungeonHeadless] EraFusionData.FusionRewardItemId 홀짝 배정이 어긋남 — 5층={EraFusionData.FusionRewardItemId(5)}(기대 wp_gauntlet) 6층={EraFusionData.FusionRewardItemId(6)}(기대 wp_lance_e)");
                _hadError = true;
                return;
            }

            var runner = Object.FindFirstObjectByType<DungeonFloorRunner>();
            if (runner == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 시대 퓨전 검증용 DungeonFloorRunner를 못 찾음");
                _hadError = true;
                return;
            }

            object floorBefore = GetPrivate(runner, "_floor");
            var spawnEliteMethod = typeof(DungeonFloorRunner).GetMethod("SpawnElite", BindingFlags.NonPublic | BindingFlags.Instance);
            var contentRoot = (Transform)GetPrivate(runner, "_contentRoot");

            // Awake()가 이미 "fight" 방을 지어 둔 상태라(층2 첫 방, 기존 grunt
            // 다수) 이름으로 지우면 그 원래 방 몬스터까지 같이 지운다 —
            // 새로 추가되는 자식(인덱스 >= 시작 개수)만 걷어낸다.
            int countBefore = contentRoot.childCount;
            SetPrivate(runner, "_floor", 4);
            spawnEliteMethod.Invoke(runner, null);
            var normalElite = contentRoot.GetChild(countBefore);
            string normalName = (string)GetPrivate(normalElite.GetComponent<DungeonEnemy>(), "displayName");
            string normalItem = (string)GetPrivate(normalElite.GetComponent<DungeonEnemy>(), "rewardItemId");
            DestroySpawnedFrom(contentRoot, countBefore);

            SetPrivate(runner, "_floor", 5);
            spawnEliteMethod.Invoke(runner, null);
            var fusionElite = contentRoot.GetChild(countBefore);
            string fusionName = (string)GetPrivate(fusionElite.GetComponent<DungeonEnemy>(), "displayName");
            string fusionItem = (string)GetPrivate(fusionElite.GetComponent<DungeonEnemy>(), "rewardItemId");
            DestroySpawnedFrom(contentRoot, countBefore);

            SetPrivate(runner, "_floor", floorBefore);

            if (normalName != "폐허의 황건 정예" || normalItem != "wp_saber" || fusionName != "기계화 정찰병" || fusionItem != "wp_gauntlet")
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 시대 퓨전 정예 바꿔치기가 이상함 — 4층 name={normalName} item={normalItem}(기대 폐허의 황건 정예/wp_saber), 5층 name={fusionName} item={fusionItem}(기대 기계화 정찰병/wp_gauntlet)");
                _hadError = true;
                return;
            }

            int levelBefore = HeroState.Level, expBefore = HeroState.Exp, hpBefore = HeroState.Hp, goldBefore = HeroState.Gold;
            string weaponBefore = HeroState.EquippedWeaponId, gemBefore = HeroState.SocketedGemId;
            var playerGo = GameObject.FindWithTag("Player");
            var weaponVisual = playerGo != null ? playerGo.GetComponent<WeaponVisual>() : null;
            var blade = weaponVisual != null ? (Transform)GetPrivate(weaponVisual, "_blade") : null;
            if (blade == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 시대 퓨전 무기 모양 검증용 WeaponVisual/_blade를 못 찾음");
                _hadError = true;
                return;
            }

            // HeroState.Restore()가 EquipmentChanged를 쏘게 방금 고쳐서(HeroState.cs
            // 클래스 주석 참고 — 이 검증 중 실제로 못 갱신되는 걸 처음 발견)
            // WeaponVisual이 알아서 Refresh()된다.
            HeroState.Restore(levelBefore, expBefore, hpBefore, goldBefore, "wp_lance_e", gemBefore);
            Vector3 lanceScale = blade.localScale;
            HeroState.Restore(levelBefore, expBefore, hpBefore, goldBefore, "wp_gauntlet", gemBefore);
            Vector3 gauntletScale = blade.localScale;
            HeroState.Restore(levelBefore, expBefore, hpBefore, goldBefore, weaponBefore, gemBefore); // 원상복귀.

            bool lanceOk = lanceScale.y > 1f && lanceScale.x < 0.1f; // 길고 얇게(기존 최대 칼날 0.71보다 뚜렷히 길게).
            bool gauntletOk = gauntletScale.y < 0.3f && gauntletScale.x > 0.2f; // 짧고 두껍게.
            if (!lanceOk || !gauntletOk)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 미래 무기 모양이 이상함 — lance scale={lanceScale}(길고 얇게 기대) gauntlet scale={gauntletScale}(짧고 두껍게 기대)");
                _hadError = true;
                return;
            }

            Debug.Log($"[PlaytestDungeonHeadless] era fusion OK - 문턱/드랍 홀짝 결정적, 4층 정상 정예 vs 5층 기계화 정찰병 바꿔치기, 전자창/동력장갑 모양 갈림(lance={lanceScale}, gauntlet={gauntletScale})");
        }

        private static void DestroySpawnedFrom(Transform contentRoot, int fromIndex)
        {
            for (int i = contentRoot.childCount - 1; i >= fromIndex; i--)
            {
                Object.DestroyImmediate(contentRoot.GetChild(i).gameObject);
            }
        }

        private static void CheckWhirl()
        {
            var playerGo = GameObject.FindWithTag("Player");
            var combat = playerGo != null ? playerGo.GetComponent<PlayerCombat>() : null;
            if (playerGo == null || combat == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 회전베기 검증용 player/PlayerCombat을 못 찾음");
                _hadError = true;
                return;
            }

            Vector3 origin = playerGo.transform.position;
            var near1 = SpawnDummyEnemy(origin + new Vector3(1.5f, 0f, 0f));
            var near2 = SpawnDummyEnemy(origin + new Vector3(-1.5f, 0f, 0f));
            var far = SpawnDummyEnemy(origin + new Vector3(10f, 0f, 0f));

            float hpBefore = (float)GetPrivate(near1, "hp");
            combat.TriggerWhirl();

            float near1Hp = (float)GetPrivate(near1, "_curHp");
            float near2Hp = (float)GetPrivate(near2, "_curHp");
            float farHp = (float)GetPrivate(far, "_curHp");

            // 회전베기 피해(24 HP 더미에 약 2.8)로는 안 죽어 STORY 더미(Die()로
            // 자가 정리)와 달리 손수 치워야 한다 — 안 치우면 남은 프레임 동안
            // DungeonEnemy.Active에 그대로 남아 플레이어를 쫓아다니며(aggroRadius
            // 8f) 이후 검사에 비결정적 부작용을 끼얹는다.
            Object.Destroy(near1.gameObject);
            Object.Destroy(near2.gameObject);
            Object.Destroy(far.gameObject);

            if (near1Hp >= hpBefore || near2Hp >= hpBefore)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 회전베기가 반경 안 더미를 안 때림 — near1={near1Hp} near2={near2Hp}(기대 < {hpBefore})");
                _hadError = true;
            }
            else if (!Mathf.Approximately(farHp, hpBefore))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 회전베기가 반경 밖 더미까지 때림 — far={farHp}(기대={hpBefore})");
                _hadError = true;
            }
            else
            {
                Debug.Log($"[PlaytestDungeonHeadless] whirl OK - near1={near1Hp} near2={near2Hp} far={farHp}(변화 없음)");
            }
        }

        /// <summary>PLAN.md 44~49장 디버그 화면(2026-09-14, GO와 같은 결) —
        /// 레벨/층/적 수/사명/좌표 줄이 실제로 채워지는지 본다.</summary>
        private static void CheckDebugHud()
        {
            var hudGo = GameObject.Find("DebugUI");
            var hud = hudGo != null ? hudGo.GetComponent<DebugHud>() : null;
            var labelGo = hudGo != null ? hudGo.transform.Find("Label") : null;
            var label = labelGo != null ? labelGo.GetComponent<TextMeshProUGUI>() : null;
            if (hud == null || label == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] DebugUI/Label을 못 찾음");
                _hadError = true;
                return;
            }

            var method = typeof(DebugHud).GetMethod("Refresh", BindingFlags.NonPublic | BindingFlags.Instance);
            method.Invoke(hud, null);

            if (!label.text.Contains("lv ") || !label.text.Contains("floor ") || !label.text.Contains("quest:") || !label.text.Contains("pos:"))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 디버그 오버레이 내용 이상 text=\"{label.text}\"");
                _hadError = true;
            }
            else
            {
                Debug.Log($"[PlaytestDungeonHeadless] debug hud OK - \"{label.text.Replace("\n", " | ")}\"");
            }
        }

        /// <summary>PLAN.md 104-1 ②(2026-09-16) — GO
        /// `PlaytestHeadless.CheckSettingsPanel()`과 같은 결로 존재 확인만
        /// 하던 걸 TogglePanel()·ChooseSfx() 실제 호출 + 라벨 텍스트
        /// 확인으로 바꿨다(RealmCommandUi 사례 재발 방지 — 그쪽 클래스
        /// 주석 참고).</summary>
        private static void CheckSettingsPanel()
        {
            var panel = Object.FindFirstObjectByType<DungeonSettingsPanel>();
            if (panel == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] DungeonSettingsPanel 컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }

            var panelGoField = typeof(DungeonSettingsPanel).GetField("_panel", BindingFlags.NonPublic | BindingFlags.Instance);
            var panelGo = panelGoField.GetValue(panel) as GameObject;
            if (panelGo == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] DungeonSettingsPanel._panel이 null — 씬 재로드 후 참조가 안 살아남음");
                _hadError = true;
                return;
            }

            var toggleMethod = typeof(DungeonSettingsPanel).GetMethod("TogglePanel", BindingFlags.NonPublic | BindingFlags.Instance);
            toggleMethod.Invoke(panel, null); // 열기 — 여기서 NRE가 나면 그대로 테스트 실패로 드러난다.
            if (!panelGo.activeSelf)
            {
                Debug.LogError("[PlaytestDungeonHeadless] TogglePanel() 호출 후에도 설정 패널이 안 열림");
                _hadError = true;
                return;
            }
            toggleMethod.Invoke(panel, null); // 닫기
            if (panelGo.activeSelf)
            {
                Debug.LogError("[PlaytestDungeonHeadless] TogglePanel() 두 번째 호출 후에도 설정 패널이 안 닫힘");
                _hadError = true;
                return;
            }

            var sfxValueLabelField = typeof(DungeonSettingsPanel).GetField("_sfxValueLabel", BindingFlags.NonPublic | BindingFlags.Instance);
            var sfxValueLabel = sfxValueLabelField.GetValue(panel) as TextMeshProUGUI;
            if (sfxValueLabel == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] DungeonSettingsPanel._sfxValueLabel이 null");
                _hadError = true;
                return;
            }

            bool sfxBefore = DungeonSettingsState.SfxOn;
            var chooseSfxMethod = typeof(DungeonSettingsPanel).GetMethod("ChooseSfx", BindingFlags.NonPublic | BindingFlags.Instance);
            chooseSfxMethod.Invoke(panel, null); // 실제 버튼 핸들러 — 상태를 뒤집고 Refresh()까지 그대로 탄다.
            string expectedText = DungeonLocalization.T(DungeonSettingsState.SfxOn ? "state.on" : "state.off");
            if (DungeonSettingsState.SfxOn == sfxBefore || sfxValueLabel.text != expectedText)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] ChooseSfx() 이후 라벨이 실제로 안 바뀜 text=\"{sfxValueLabel.text}\"(기대=\"{expectedText}\")");
                _hadError = true;
                return;
            }
            chooseSfxMethod.Invoke(panel, null); // 원상복귀

            bool vibBefore = DungeonSettingsState.VibrationOn;
            DungeonSettingsState.VibrationOn = !vibBefore;
            if (DungeonSettingsState.VibrationOn == vibBefore)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 진동 토글이 안 바뀜");
                _hadError = true;
                return;
            }

            DungeonSettingsState.UiScaleMultiplier = 1.15f;
            var scaler = Saga.Core.SagaUi.FirstGameScaler(); // Ⅱ 단추 등 메뉴 캔버스는 뺀다(110 ⑤c)
            float expected = Saga.Core.SagaUi.GameReference.x / 1.15f; // 110 ⑤b 기준 1600×900
            if (scaler == null || Mathf.Abs(scaler.referenceResolution.x - expected) > 1f)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] UI 크기가 캔버스에 안 먹음 — got={(scaler == null ? "null" : scaler.referenceResolution.x.ToString())}");
                _hadError = true;
                return;
            }
            DungeonSettingsState.UiScaleMultiplier = 1f;

            DungeonSettingsState.HighGraphicsQuality = false;
            if (!Mathf.Approximately(QualitySettings.shadowDistance, 15f) || QualitySettings.antiAliasing != 0)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 그래픽 품질(절약)이 QualitySettings에 안 먹음 — shadowDistance={QualitySettings.shadowDistance} aa={QualitySettings.antiAliasing}");
                _hadError = true;
                return;
            }
            DungeonSettingsState.HighGraphicsQuality = true;

            string langBefore = DungeonLocalization.CurrentLanguage;
            string qualityLabelBefore = DungeonSettingsState.GraphicsQualityLabel();
            DungeonLocalization.CycleLanguage();
            if (DungeonLocalization.CurrentLanguage == langBefore
                || DungeonSettingsState.GraphicsQualityLabel() == qualityLabelBefore)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 언어 전환이 실제 문구를 안 바꿈");
                _hadError = true;
                return;
            }
            DungeonLocalization.CurrentLanguage = langBefore;

            Debug.Log("[PlaytestDungeonHeadless] settings panel OK - sfx/vibration/ui-scale/graphics-quality/language all verified");
        }

        /// <summary>PLAN.md 67~69장 "Localization" 2차(2026-09-14) — PlayerHud의
        /// 체력/경험치/돈/공격력/층 표시가 실제로 영어 문구를 보여주는지 본다.</summary>
        private static void CheckPlayerHudLocalization()
        {
            var hudGo = GameObject.Find("PlayerHudUI");
            var hud = hudGo != null ? hudGo.GetComponent<PlayerHud>() : null;
            var label = hudGo != null ? hudGo.GetComponentInChildren<TextMeshProUGUI>() : null;
            if (hud == null || label == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] PlayerHudUI/Label을 못 찾음");
                _hadError = true;
                return;
            }

            string langBefore = DungeonLocalization.CurrentLanguage;
            var method = typeof(PlayerHud).GetMethod("Refresh", BindingFlags.NonPublic | BindingFlags.Instance);

            DungeonLocalization.CurrentLanguage = "en";
            method.Invoke(hud, null);
            if (!label.text.Contains("HP") || !label.text.Contains("EXP") || !label.text.Contains("ATK"))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] PlayerHud 영어 전환이 안 먹음 text=\"{label.text}\"");
                _hadError = true;
                DungeonLocalization.CurrentLanguage = langBefore;
                return;
            }
            DungeonLocalization.CurrentLanguage = langBefore;
            method.Invoke(hud, null);

            Debug.Log("[PlaytestDungeonHeadless] player hud localization OK");
        }

        /// <summary>2026-09-15 "모바일 액션 버튼 언어 전환 반응" —
        /// `LocalizedButtonLabel`(폴링, Update()는 private이라 리플렉션)이
        /// 씬 빌드 시점 이후에도 언어를 따라가는지 본다.</summary>
        private static void CheckActionButtonLocalization()
        {
            var go = GameObject.Find("AttackButton");
            var localized = go != null ? go.GetComponent<LocalizedButtonLabel>() : null;
            var label = go != null ? go.GetComponentInChildren<TextMeshProUGUI>() : null;
            if (localized == null || label == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] AttackButton/LocalizedButtonLabel을 못 찾음");
                _hadError = true;
                return;
            }

            string langBefore = DungeonLocalization.CurrentLanguage;
            var method = typeof(LocalizedButtonLabel).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);

            DungeonLocalization.CurrentLanguage = "en";
            method.Invoke(localized, null);
            if (label.text != "Attack")
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 액션 버튼 영어 전환이 안 먹음 text=\"{label.text}\"(기대=Attack)");
                _hadError = true;
                DungeonLocalization.CurrentLanguage = langBefore;
                return;
            }
            DungeonLocalization.CurrentLanguage = langBefore;
            method.Invoke(localized, null);
            if (label.text != (langBefore == "en" ? "Attack" : "공격"))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 액션 버튼이 원래 언어로 안 돌아옴 text=\"{label.text}\"(기대=공격)");
                _hadError = true;
            }

            Debug.Log("[PlaytestDungeonHeadless] action button localization OK");
        }

        /// <summary>PLAN.md 101-2 "공통 선행" A·B(DUNGEON 두 번째 이식) —
        /// `PlaytestHeadless.CheckGoalBoardAndSessionCard()`(GO)와 완전히
        /// 같은 기준 — GoalBoard 세 줄이 실제로 채워지는지, Awake()의
        /// IGoalSource 자동 재탐색이 동작하는지, SessionCard 가 뜨고
        /// 스스로 닫히는지를 직접 확인한다 — 존재 확인만으로 끝내지 않는다.</summary>
        private static void CheckGoalBoardAndSessionCard()
        {
            var board = Object.FindFirstObjectByType<GoalBoard>();
            if (board == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] GoalBoard 컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }

            var sourceField = typeof(GoalBoard).GetField("_source", BindingFlags.NonPublic | BindingFlags.Instance);
            if (sourceField.GetValue(board) == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] GoalBoard._source가 null — Awake() 자동 재탐색 실패");
                _hadError = true;
                return;
            }

            var labelField = typeof(GoalBoard).GetField("_label", BindingFlags.NonPublic | BindingFlags.Instance);
            var label = labelField.GetValue(board) as TextMeshProUGUI;
            if (label == null || !label.text.Contains(Saga.Core.SagaUi.L("지금", "Now") + " —") || !label.text.Contains(Saga.Core.SagaUi.L("이번 세션", "This session") + " —") || !label.text.Contains(Saga.Core.SagaUi.L("이번 주", "This week") + " —"))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] GoalBoard 세 줄이 안 채워짐 text=\"{(label == null ? "null" : label.text.Replace("\n", " | "))}\"");
                _hadError = true;
                return;
            }

            var card = Object.FindFirstObjectByType<SessionCard>();
            if (card == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] SessionCard 컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }
            if (card.IsShowing)
            {
                Debug.LogError("[PlaytestDungeonHeadless] SessionCard가 세션 시작부터 떠 있음(기본은 숨김)");
                _hadError = true;
                return;
            }

            card.Show("테스트", "줄1", "줄2");
            if (!card.IsShowing)
            {
                Debug.LogError("[PlaytestDungeonHeadless] SessionCard.Show() 호출 후에도 안 뜸");
                _hadError = true;
                return;
            }

            // 5초를 실제로 안 기다리고 _closeTimer를 만료 직전으로 돌린 뒤
            // Update()를 한 번 더 불러 자동 닫힘 경로를 확인한다.
            var closeTimerField = typeof(SessionCard).GetField("_closeTimer", BindingFlags.NonPublic | BindingFlags.Instance);
            closeTimerField.SetValue(card, 0.0001f);
            var updateMethod = typeof(SessionCard).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);
            updateMethod.Invoke(card, null);
            if (card.IsShowing)
            {
                Debug.LogError("[PlaytestDungeonHeadless] SessionCard가 만료 후에도 자동으로 안 닫힘");
                _hadError = true;
                return;
            }

            if (Object.FindFirstObjectByType<DungeonSessionTracker>() == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] DungeonSessionTracker 컴포넌트를 못 찾음");
                _hadError = true;
                return;
            }

            Debug.Log("[PlaytestDungeonHeadless] goal board / session card OK - 3 lines filled, source auto-found, card shows and auto-closes");
        }

        /// <summary>PLAN.md 101-3 G "지형 반응"(2026-09-17 추가) — 타격마다
        /// `GroundDecal.Spawn(HitMark)`가 실제로 호출되는지, 그리고 "최대
        /// 32" 캡이 지켜지는지 둘 다 본다. 이 시점까지 이미 여러 검사
        /// (hitstop·hitspark·loot marker·whirl·weapon visual)가 적을 때려
        /// 히트마크를 계속 쌓아 왔으니 그 누적 위에 40개를 몰아 스폰해
        /// 캡이 진짜 32에서 멈추는지 확인한다(발자국은 씬이 짧게 도는
        /// 헤드리스 특성상 플레이어가 거의 안 움직여 여기선 안 본다 —
        /// 히트마크 경로와 스폰 함수 자체가 같아 캡 검증엔 충분하다).</summary>
        private static void CheckGroundDecal()
        {
            var playerGo = GameObject.FindWithTag("Player");
            if (playerGo == null)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 지형 데칼 검증용 player를 못 찾음");
                _hadError = true;
                return;
            }

            int before = GroundDecal.ActiveCount;
            var dummy = SpawnDummyEnemy(playerGo.transform.position + new Vector3(2f, 0f, 0f));
            dummy.TakeDamage(1f);
            Object.Destroy(dummy.gameObject);

            if (GroundDecal.ActiveCount <= before)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 타격 지형 데칼이 안 생김 — before={before} after={GroundDecal.ActiveCount}");
                _hadError = true;
                return;
            }

            for (int i = 0; i < 40; i++)
            {
                GroundDecal.Spawn(Vector3.zero, GroundDecal.Kind.HitMark);
            }

            if (GroundDecal.ActiveCount > 32)
            {
                Debug.LogError($"[PlaytestDungeonHeadless] 지형 데칼 최대 32 캡이 안 지켜짐 — ActiveCount={GroundDecal.ActiveCount}");
                _hadError = true;
                return;
            }

            Debug.Log($"[PlaytestDungeonHeadless] ground decal OK - 타격마다 생성 확인, 캡 이후 ActiveCount={GroundDecal.ActiveCount}(<=32)");
        }

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
            var chooseIndex = typeof(BlessingChoiceUi).GetMethod("ChooseIndex", BindingFlags.NonPublic | BindingFlags.Instance);
            chooseIndex.Invoke(blessingUi, new object[] { 0 });
            if (blessingUi.IsShowing)
            {
                Debug.LogError("[PlaytestDungeonHeadless] 난입 축복 3택 선택 후에도 패널이 안 닫힘");
                _hadError = true;
                return;
            }

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

        /// <summary>PLAN.md 106-2 "잊힌 능묘" — 씬에 지어진 진짜 상자·문·블록·벽·능묘지기를
        /// 순서대로 밟는다: 입구 제목 → 벽력탄 없음 → 열쇠 없는 문 막힘 → 시련 클리어 전 상자
        /// 숨김 → 작은 열쇠 → 문 → 블록(밀기 감지·경계 막힘·발판) → 벽력탄 → 금 간 벽(폭발·자기
        /// 피해) → 보스 열쇠 → 보스 문 → 갑주 15%·기절 150% → 정복 비트.</summary>
        private static void CheckTemple()
        {
            const string T = "[PlaytestDungeonHeadless] temple";
            var playerGo = GameObject.FindWithTag("Player");
            var controller = playerGo != null ? playerGo.GetComponent<PlayerController>() : null;
            var bombs = playerGo != null ? playerGo.GetComponent<PlayerBombs>() : null;
            TempleChest keyChest = null, bombChest = null, bossKeyChest = null;
            foreach (var c in Object.FindObjectsByType<TempleChest>(FindObjectsSortMode.None))
            {
                if (c.Content == TempleChestContent.SmallKey) keyChest = c;
                else if (c.Content == TempleChestContent.Bombs) bombChest = c;
                else if (c.Content == TempleChestContent.BossKey) bossKeyChest = c; // 106-5 보물 상자는 뺀다
            }
            TempleDoor smallDoor = null, bossDoor = null;
            foreach (var d in Object.FindObjectsByType<TempleDoor>(FindObjectsSortMode.None))
            {
                if (d.Kind == TempleDoorKind.SmallKey) smallDoor = d;
                else bossDoor = d;
            }
            var wall = Object.FindFirstObjectByType<TempleCrackedWall>();
            var block = Object.FindFirstObjectByType<TemplePushBlock>();
            var entrance = Object.FindFirstObjectByType<TempleEntrance>();
            var bossIntro = Object.FindFirstObjectByType<TempleBossIntro>();
            var cuts = DungeonCutscenes.Instance;
            DungeonEnemy guardian = null;
            foreach (var e in DungeonEnemy.Active)
            {
                if (e != null && e.IsBombArmored) guardian = e;
            }
            if (controller == null || bombs == null || keyChest == null || bombChest == null || bossKeyChest == null
                || smallDoor == null || bossDoor == null || wall == null || block == null || entrance == null || guardian == null
                || bossIntro == null || cuts == null)
            {
                Debug.LogError($"{T} — 능묘 구성품을 못 찾음(씬 재빌드 필요) bombs={bombs} key={keyChest} bomb={bombChest} bossKey={bossKeyChest} " +
                               $"door={smallDoor}/{bossDoor} wall={wall} block={block} entrance={entrance} guardian={guardian} bossIntro={bossIntro} cuts={cuts}");
                _hadError = true;
                return;
            }

            Transform p = playerGo.transform;
            Vector3 origPos = p.position;
            int origKeys = TempleState.SmallKeys;
            int origFlags = (int)TempleState.Flags;
            Vector3 far = origPos;
            bool Fail(string msg)
            {
                Debug.LogError($"{T} — {msg}");
                _hadError = true;
                return false;
            }
            try
            {
                TempleState.Restore(0, 0);
                HeroState.FullHeal();
                ResetDodge(controller);
                cuts.Skip();
                int hudBefore = CountHudCanvases();
                int playsBefore = cuts.PlayCount;

                p.position = entrance.transform.position;
                entrance.Tick();
                if (!TempleState.Has(TempleFlag.Visited) || TempleState.HudLine().Length == 0) { Fail("입구에서 Visited·HUD 줄이 안 섬"); return; }

                // PLAN.md 106-3 도착 컷 — 도는 동안 HUD 가 꺼지고 적이 멈추며, 지역명 카드가 뜨고, 넘기면 돌아온다.
                if (!DungeonCutscenes.Playing || cuts.Current != CutsceneKind.Arrival) { Fail($"입구 첫 발에 도착 컷이 안 돎 current={cuts.Current}"); return; }
                if (CountHudCanvases() != 0) { Fail($"컷 도중 HUD 캔버스가 {CountHudCanvases()}개 켜져 있음"); return; }
                DungeonEnemy trialWarden = null;
                foreach (var e in DungeonEnemy.Active)
                {
                    if (e != null && e.RoomId == "temple_trial") { trialWarden = e; break; }
                }
                if (trialWarden != null)
                {
                    p.position = trialWarden.transform.position + new Vector3(1.5f, 0f, 0f);
                    trialWarden.Tick(0.5f);
                    string st = GetPrivate(trialWarden, "_state").ToString();
                    p.position = entrance.transform.position;
                    if (st != "Idle") { Fail($"컷 도중인데 파수꾼이 움직임 state={st}"); return; }
                }
                cuts.Seek(2.0);
                string wantTitle = DungeonLocalization.T("cut.temple_title");
                if (cuts.TitleCard.ShownTitle != wantTitle || cuts.TitleCard.ShownAlpha < 0.9f)
                { Fail($"도착 컷 2초에 지역명 카드가 안 보임 '{cuts.TitleCard.ShownTitle}' a={cuts.TitleCard.ShownAlpha:F2}"); return; }
                cuts.Skip();
                if (DungeonCutscenes.Playing || cuts.TitleCard.ShownAlpha > 0f || CountHudCanvases() != hudBefore)
                { Fail($"도착 컷을 넘겼는데 안 돌아옴 playing={DungeonCutscenes.Playing} hud={CountHudCanvases()}/{hudBefore}"); return; }

                bombs.TryPlaceBomb();
                if (bombs.ActiveBomb != null) { Fail("벽력탄 없이 놓임"); return; }

                p.position = smallDoor.transform.position + new Vector3(0f, 0f, -1.5f);
                smallDoor.Tick();
                if (smallDoor.IsOpened) { Fail("열쇠 없이 잠긴 문이 열림"); return; }
                p.position = far;
                smallDoor.Tick();

                keyChest.Tick();
                if (keyChest.IsRevealed) { Fail("시련의 방 파수꾼이 살아 있는데 상자가 보임"); return; }
                foreach (var e in new List<DungeonEnemy>(DungeonEnemy.Active))
                {
                    if (e != null && e.RoomId == "temple_trial") e.TakeDamage(999999f);
                }
                p.position = keyChest.transform.position + new Vector3(1f, 0f, 0f);
                keyChest.Tick();
                if (!keyChest.IsOpened || TempleState.SmallKeys != 1) { Fail($"시련 클리어 뒤 작은 열쇠 상자 revealed={keyChest.IsRevealed} opened={keyChest.IsOpened} keys={TempleState.SmallKeys}"); return; }
                var chestCam = cuts.CameraOf(CutsceneKind.Chest).transform.position;
                if (cuts.Current != CutsceneKind.Chest || chestCam.y < keyChest.transform.position.y + 0.8f
                    || TempleVisuals.FlatDistance(chestCam, keyChest.transform.position) > 4f)
                { Fail($"상자 컷 카메라 자리 틀림 current={cuts.Current} cam={chestCam} chest={keyChest.transform.position}"); return; }
                cuts.Skip();

                p.position = smallDoor.transform.position + new Vector3(0f, 0f, -1.5f);
                smallDoor.Tick();
                if (!smallDoor.IsOpened || TempleState.SmallKeys != 0 || !TempleState.Has(TempleFlag.SmallDoor)) { Fail($"작은 열쇠로 문이 안 열림 keys={TempleState.SmallKeys}"); return; }

                // 블록 — 진짜 밀기 감지(서쪽 면에 붙어 동쪽으로 0.35초) 한 번, 나머지는 즉시 밀기.
                p.position = far;
                bombChest.Tick();
                if (bombChest.IsRevealed) { Fail("발판 전인데 벽력탄 상자가 보임"); return; }
                Vector3 blockWorld = block.transform.TransformPoint(block.BlockLocal);
                p.position = new Vector3(blockWorld.x - 1.4f, origPos.y, blockWorld.z);
                SetPrivate(controller, "_moveIntent", Vector3.right);
                block.Tick(0.2f);
                bool heldEarly = (bool)GetPrivate(block, "_sliding");
                block.Tick(0.2f);
                bool pushed = (bool)GetPrivate(block, "_sliding");
                SetPrivate(controller, "_moveIntent", Vector3.zero);
                if (heldEarly || !pushed) { Fail($"블록 밀기 감지 틀림 early={heldEarly} pushed={pushed}"); return; }
                block.StopAllCoroutines();
                SetPrivate(block, "_sliding", false);
                var blockTf = block.transform.Find("Block");
                blockTf.localPosition = new Vector3(-2f, blockTf.localPosition.y, -4f);
                p.position = far;
                bool z1 = block.TryPush(Vector3.back, instant: true);
                bool z2 = block.TryPush(Vector3.back, instant: true);
                bool z3 = block.TryPush(Vector3.back, instant: true); // -10 은 방 경계 밖.
                if (!z1 || !z2 || z3) { Fail($"블록 경계 막힘 틀림 {z1}/{z2}/{z3} at {block.BlockLocal}"); return; }
                block.TryPush(Vector3.forward, instant: true);
                block.TryPush(Vector3.forward, instant: true);
                for (int i = 0; i < 3; i++) block.TryPush(Vector3.right, instant: true);
                if (!block.IsSolved || !TempleState.Has(TempleFlag.BlockSolved)) { Fail($"발판에 올렸는데 안 풀림 block={block.BlockLocal} plate={block.PlateLocal}"); return; }
                bombChest.Tick();
                p.position = bombChest.transform.position + new Vector3(1f, 0f, 0f);
                bombChest.Tick();
                if (!bombChest.IsOpened || !TempleState.HasBombs) { Fail("벽력탄 상자가 안 열림"); return; }
                bombs.TryPlaceBomb();
                if (cuts.Current != CutsceneKind.Chest || bombs.ActiveBomb != null) { Fail($"벽력탄 상자 컷 도중 벽력탄이 놓임(또는 컷 없음) current={cuts.Current}"); return; }
                cuts.Skip();

                // 금 간 벽 — 진짜로 놓은 뒤 벽 앞으로 옮겨 즉시 터뜨린다(심지 2초는 기다리지 않는다).
                p.position = wall.transform.position + new Vector3(1.5f, 0f, 0f);
                HeroState.FullHeal();
                int hpBefore = HeroState.Hp;
                int explodeBefore = TempleBomb.ExplodeCount;
                bombs.TryPlaceBomb();
                var bomb = bombs.ActiveBomb;
                if (bomb == null) { Fail("벽력탄을 가졌는데 안 놓임"); return; }
                bomb.transform.position = wall.transform.position + new Vector3(0.9f, 0.25f, 0f);
                bomb.Explode();
                if (!wall.IsBroken || !TempleState.Has(TempleFlag.CrackedWall) || TempleBomb.ExplodeCount != explodeBefore + 1)
                { Fail($"벽력탄으로 금 간 벽이 안 부서짐 broken={wall.IsBroken}"); return; }
                if (HeroState.Hp >= hpBefore) { Fail($"폭발 반경 안인데 자기 피해 없음 hp {hpBefore}→{HeroState.Hp}"); return; }

                p.position = bossKeyChest.transform.position + new Vector3(1.2f, 0f, 0f);
                bossKeyChest.Tick();
                if (!bossKeyChest.IsOpened || !TempleState.HasBossKey) { Fail("보스 열쇠 상자가 안 열림"); return; }
                if (cuts.Current != CutsceneKind.Chest) { Fail("보스 열쇠 상자 컷이 안 돎"); return; }
                cuts.Skip();

                p.position = far;
                bossDoor.Tick();
                p.position = bossDoor.transform.position + new Vector3(0f, 0f, -1.5f);
                bossDoor.Tick();
                if (!bossDoor.IsOpened || TempleState.HasBossKey) { Fail("보스 열쇠로 보스 문이 안 열림(또는 열쇠가 안 소비됨)"); return; }

                // PLAN.md 106-3 등장 컷 — 보스방 첫 발에 한 번, 보스 이름표, 다시 들어가면 안 튼다.
                p.position = far;
                bossIntro.Tick();
                if (DungeonCutscenes.Playing) { Fail("보스방 밖인데 등장 컷이 돎"); return; }
                p.position = bossIntro.transform.position + new Vector3(0f, 0f, -6f);
                bossIntro.Tick();
                if (cuts.Current != CutsceneKind.BossIntro || !TempleState.Has(TempleFlag.BossIntroSeen)) { Fail($"보스방 첫 발에 등장 컷이 안 돎 current={cuts.Current}"); return; }
                cuts.Seek(3.0);
                string wantBoss = DungeonLocalization.T("cut.guardian_title");
                if (cuts.TitleCard.ShownTitle != wantBoss || cuts.TitleCard.ShownAlpha < 0.9f)
                { Fail($"등장 컷 3초에 보스 이름표가 안 보임 '{cuts.TitleCard.ShownTitle}' a={cuts.TitleCard.ShownAlpha:F2}"); return; }
                cuts.Skip();
                bossIntro.Tick();
                if (DungeonCutscenes.Playing) { Fail("등장 컷을 본 뒤 다시 들어갔는데 또 돎"); return; }
                if (cuts.PlayCount - playsBefore != 5) { Fail($"능묘 한 바퀴 컷 수 {cuts.PlayCount - playsBefore} ≠ 5(도착·상자 셋·등장)"); return; }

                SetPrivate(guardian, "_curHp", 480f);
                guardian.TakeDamage(100f);
                float afterArmor = (float)GetPrivate(guardian, "_curHp");
                guardian.BombHit(100f);
                float afterBomb = (float)GetPrivate(guardian, "_curHp");
                bool stunned = guardian.IsStunned;
                guardian.TakeDamage(100f);
                float afterStun = (float)GetPrivate(guardian, "_curHp");
                if (Mathf.Abs(480f - afterArmor - 15f) > 0.01f || !stunned
                    || Mathf.Abs(afterArmor - afterBomb - 150f) > 0.01f || Mathf.Abs(afterBomb - afterStun - 150f) > 0.01f)
                { Fail($"갑주 배율 틀림 480→{afterArmor}(갑주)→{afterBomb}(폭발)→{afterStun}(기절) stunned={stunned}"); return; }
                guardian.TakeDamage(999999f);
                if (!TempleState.Has(TempleFlag.BossDefeated)) { Fail("능묘지기를 쓰러뜨렸는데 정복 비트가 안 섬"); return; }

                Debug.Log($"{T} OK - 입구·열쇠 없는 문·시련 상자·작은 열쇠·문·블록 감지/경계/발판·벽력탄·금 간 벽·자기 피해·보스 열쇠·보스 문·갑주 15%/기절 150%·정복 " +
                          "+ 106-3 컷(도착 카드·HUD 끔·적 멈춤·상자 카메라·컷 중 벽력탄 막힘·등장 이름표·한 번만·5회)");
            }
            finally
            {
                cuts.Skip();
                p.position = origPos;
                SetPrivate(controller, "_moveIntent", Vector3.zero);
                TempleState.Restore(origKeys, origFlags);
                HeroState.FullHeal();
                ResetDodge(controller);
            }
        }

        /// <summary>PLAN.md 106-4 "캐릭터 통일" — 동행·마을 사람·포로·행상·능묘 파수꾼이 사실 모델(Humanoid
        /// Animator)로 섰는지. 사실 모델 원본은 PC 마다 받는 gitignore 자산이라, 이 PC 에 구운 프리팹이
        /// 없으면 검사를 건너뛴다(폴백 모델이 정상 동작).</summary>
        private static void CheckNpcModels()
        {
            const string T = "[PlaytestDungeonHeadless] npc models";
            string[] names = { "Skeleton", "Paladin", "PeasantMan", "PeasantGirl" };
            foreach (var n in names)
            {
                if (AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(n)) == null)
                {
                    Debug.Log($"{T} skip - {n} 프리팹 없음(Saga/Setup NPC Character Imports 전)");
                    return;
                }
            }
            bool Human(Animator a) => a != null && a.isHuman && a.runtimeAnimatorController != null;
            string fail = null;

            var ally = Object.FindFirstObjectByType<AllyFighter>();
            if (ally == null || !Human(ally.Animator)) fail = $"동행이 사실 모델이 아님 animator={ally?.Animator}";

            int villagers = 0;
            foreach (var idle in Object.FindObjectsByType<NpcIdle>(FindObjectsSortMode.None))
            {
                if (idle.gameObject.name != "Villager") continue;
                villagers++;
                if (fail == null && !Human(idle.GetComponentInChildren<Animator>())) fail = $"마을 사람 {idle.transform.position} 애니메이터 없음";
            }
            if (fail == null && villagers < 3) fail = $"사실 모델 마을 사람 {villagers} < 3";

            foreach (var c in Object.FindObjectsByType<DungeonCaptive>(FindObjectsSortMode.None))
            {
                var idle = c.GetComponent<NpcIdle>();
                var a = c.GetComponentInChildren<Animator>();
                if (fail == null && (idle == null || !Human(a) || (!c.IsFreed && idle.StateName != "Kneel")
                    || !a.HasState(0, Animator.StringToHash("Kneel"))))
                    fail = $"포로가 무릎 꿇은 사실 모델이 아님 idle={idle?.StateName}";
            }
            int keepers = 0;
            foreach (var m in Object.FindObjectsByType<DungeonMerchant>(FindObjectsSortMode.None))
            {
                var keeper = m.transform.Find("Keeper");
                if (keeper != null && Human(keeper.GetComponentInChildren<Animator>())) keepers++;
            }
            if (fail == null && keepers < 5) fail = $"행상 사람 {keepers} < 5";

            int skeletons = 0;
            foreach (var e in DungeonEnemy.Active)
            {
                if (e == null || !e.RoomId.StartsWith("temple_") || e.IsBombArmored) continue;
                var a = e.Animator;
                if (Human(a) && a.avatar != null && a.avatar.name.StartsWith("Skeleton")) skeletons++;
            }
            if (fail == null && skeletons < 6) fail = $"해골 파수꾼 {skeletons} < 6";

            if (fail != null)
            {
                Debug.LogError($"{T} — {fail}");
                _hadError = true;
                return;
            }
            Debug.Log($"{T} OK - 동행(Paladin)·마을 사람 {villagers}·포로(Kneel)·행상 {keepers}·해골 파수꾼 {skeletons} 전부 Humanoid");
        }

        /// <summary>켜진 HUD 캔버스 수 — 컷 레터박스와 토스트(DialogueLabel)는 뺀다(`DungeonCutscenes.HideHud` 와 같은 기준).</summary>
        private static int CountHudCanvases()
        {
            int n = 0;
            foreach (var c in Object.FindObjectsByType<Canvas>(FindObjectsSortMode.None))
            {
                if (!c.isRootCanvas || !c.enabled || c.renderMode != RenderMode.ScreenSpaceOverlay) continue;
                if (c.gameObject.name == "CutsceneOverlay" || c.GetComponent<DialogueLabel>() != null) continue;
                n++;
            }
            return n;
        }

        /// <summary>PLAN.md 106-3 — 등장 컷을 3초 자리로 틀어 두고, 6프레임째에 브레인이 실제 카메라를
        /// 컷 가상 카메라로 옮겼는지(`CheckCutCameraLive`), 넘긴 뒤 8프레임째에 플레이 카메라로
        /// 돌아왔는지(`CheckCutCameraBack`) 본다.</summary>
        private static void StartCutCameraProbe()
        {
            var cuts = DungeonCutscenes.Instance;
            DungeonEnemy guardian = null;
            foreach (var e in DungeonEnemy.Active)
            {
                if (e != null && e.IsBombArmored) guardian = e;
            }
            if (cuts == null || guardian == null || !cuts.PlayBossIntro(guardian))
            {
                Debug.LogError($"[PlaytestDungeonHeadless] cut camera — 등장 컷을 못 틂 cuts={cuts} guardian={guardian}");
                _hadError = true;
                return;
            }
            cuts.Seek(3.0);
            _cutProbeStarted = true;
        }

        private static void CheckCutCameraLive()
        {
            if (!_cutProbeStarted) return;
            const string T = "[PlaytestDungeonHeadless] cut camera";
            var cuts = DungeonCutscenes.Instance;
            var close = cuts.CameraOf(CutsceneKind.BossIntro, close: true);
            if (!DungeonCutscenes.Playing || cuts.Current != CutsceneKind.BossIntro)
            {
                Debug.LogError($"{T} — 등장 컷이 프레임을 넘기며 끊김 current={cuts.Current}");
                _hadError = true;
                return;
            }
            var live = cuts.Brain.ActiveVirtualCamera;
            float gap = Vector3.Distance(cuts.Brain.OutputCamera.transform.position, close.transform.position);
            double t = cuts.CurrentDirector.time;
            cuts.Skip();
            if (!ReferenceEquals(live, close) || gap > 1.2f || !cuts.RoarFired)
            {
                Debug.LogError($"{T} — 브레인이 컷 카메라로 안 옮김 live={live?.Name} gap={gap:F2} roar={cuts.RoarFired} t={t:F2}");
                _hadError = true;
                return;
            }
            Debug.Log($"{T} live OK - t={t:F2} 실제 카메라가 {close.name} 에({gap:F2}m)·포효 신호");
        }

        private static void CheckCutCameraBack()
        {
            if (!_cutProbeStarted) return;
            const string T = "[PlaytestDungeonHeadless] cut camera";
            var cuts = DungeonCutscenes.Instance;
            var rig = Object.FindFirstObjectByType<CameraRig>();
            var view = rig != null ? GetPrivate(rig, "view") as Transform : null;
            var playerView = view != null ? view.GetComponent<CinemachineCamera>() : null;
            var live = cuts.Brain.ActiveVirtualCamera;
            if (DungeonCutscenes.Playing || playerView == null || !ReferenceEquals(live, playerView) || CountHudCanvases() == 0)
            {
                Debug.LogError($"{T} — 넘긴 뒤 플레이 카메라로 안 돌아옴 playing={DungeonCutscenes.Playing} live={live?.Name} view={playerView} hud={CountHudCanvases()}");
                _hadError = true;
                return;
            }
            Debug.Log($"{T} back OK - {playerView.name} 로 돌아옴·HUD {CountHudCanvases()}");
        }

        private static object GetPrivate(object target, string fieldName)
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.NonPublic | BindingFlags.Instance);
            return field?.GetValue(target);
        }

        private static void SetPrivate(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.NonPublic | BindingFlags.Instance);
            field?.SetValue(target, value);
        }

        /// <summary>2026-09-23 "모바일 버튼 먹통" 회귀 — 씬의 버튼 전부에 리스너가 있는지 +
        /// 설정 버튼을 진짜 onClick으로 열고 닫아 본다(ButtonWiringCheck.cs 주석 참고).</summary>
        private static void CheckButtonWiring()
        {
            const string Tag = "PlaytestDungeonHeadless";
            bool ok = ButtonWiringCheck.CheckNoDeadButtons(Tag);
            var settings = Object.FindFirstObjectByType<DungeonSettingsPanel>();
            var root = settings != null ? settings.transform : null;
            var panel = settings != null
                ? typeof(DungeonSettingsPanel).GetField("_panel", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(settings) as GameObject
                : null;
            ok &= ButtonWiringCheck.PressOpensAndCloses(Tag, "설정 버튼",
                ButtonWiringCheck.FindByLabel(root, DungeonLocalization.T("settings.title")),
                ButtonWiringCheck.FindByLabel(root, DungeonLocalization.T("settings.close")), panel);
            if (!ok) _hadError = true;
        }

    }
}
