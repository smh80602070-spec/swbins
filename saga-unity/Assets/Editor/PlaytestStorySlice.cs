using TMPro;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using Saga.Core;
using Saga.Story.Data;
using Saga.Story.Player;
using Saga.Story.World;
using Saga.Story.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// VERTICAL_SLICE_STORY.md 완료 조건을 실제 Play 모드 GameObject 경로로
    /// 확인한다(DUNGEON `PlaytestDungeonFloorProgression.cs`와 같은 결 —
    /// CharacterController 토글 순간이동 + 리플렉션으로 사설 로직 직접
    /// 호출). 실제 키보드 입력 시뮬레이션은 이 프로젝트에 아직 선례가
    /// 없어(다른 Playtest들도 전부 순간이동+직접 호출 방식) 이동감·점프
    /// 궤적·로프 키 조작 자체는 사람이 GUI로 확인해야 한다 — 여기서는
    /// **로직 경로**(트리거 배선, 전투 판정, 저장/로드)만 검증한다:
    /// (1) 잡졸 열에게 다가가 실제로 때려서 죽이고 사명(kill 10) 카운트가
    /// 오르고 완료되는지, (1-1) 두목(황건 두목, "STORY 콘텐츠 확장"
    /// 2026-09-13)이 잡졸보다 훨씬 단단하고(한 방에 안 죽음) 결국 죽으면
    /// 두 번째 사명(q_boss1)이 완료되는지,
    /// (2) 무예 나머지 셋(횡소·기탄·기합, "STORY 콘텐츠 확장" 2026-09-12)이
    /// 실제로 적을 때리고 MP를 깎는지,
    /// (3) 점프 버튼이 수직 속도를 실제로 올리는지,
    /// (4) 로프 트리거 진입/이탈이 실제로 배선되고, 로프 위쪽 끝(Platform[0]
    /// 밑을 지나는 구간, 위 StoryTerrainBuilder.RopeGapHalfWidth 참고)에서
    /// CharacterController가 안 끼는지,
    /// (5) 저장 후 상태를 지웠다가 불러오면 그대로 돌아오는지.
    /// </summary>
    public static class PlaytestStorySlice
    {
        private const string ScenePath = "Assets/Scenes/TestField.unity";
        private const int ExpectedEnemyCount = 10; // FieldMapData.EnemyPositionsM() 자리 수 = StoryQuestState.KillGoal

        private static bool _hadError;
        private static int _framesSeen;
        private static bool _origEnterPlayModeOptionsEnabled;
        private static EnterPlayModeOptions _origEnterPlayModeOptions;

        private enum Phase
        {
            Init, TalkNpc, TriggerDiscovery, KillEnemies, KillBoss, TalkNpcChoice, SweepTest, BoltCast, BoltWait, BraceTest,
            PartySwapTest, PartySwapWait,
            LandBeforeJump, EnterRope, RopeTopClearance, RopeDescend, ExitRope, LabyrinthTest, SaveLoad, Done,
        }
        private static Phase _phase = Phase.Init;
        private static float _waitUntilRealTime;
        private static int _enemyIndex;

        private static Transform _player;
        private static CharacterController _playerController;
        private static StoryPlayerController _storyController;
        private static GameObject _ropeGo;
        private static StoryRope _rope;
        private static FieldMapData.RopeDef _ropeDef;
        private static StoryEnemy _sweepDummy;
        private static StoryEnemy _boltNearDummy;
        private static StoryEnemy _boltFarDummy;
        private static StoryEnemy _partySwapNearDummy;
        private static StoryEnemy _partySwapFarDummy;

        [MenuItem("Saga/Playtest Story Slice (Headless)")]
        public static void Run()
        {
            _origEnterPlayModeOptionsEnabled = EditorSettings.enterPlayModeOptionsEnabled;
            _origEnterPlayModeOptions = EditorSettings.enterPlayModeOptions;
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions =
                EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;

            EditorSceneManager.OpenScene(ScenePath);

            _hadError = false;
            _framesSeen = 0;
            _phase = Phase.Init;
            _waitUntilRealTime = 0f;
            _enemyIndex = 0;
            _player = null;
            _playerController = null;
            _storyController = null;
            _ropeGo = null;
            _rope = null;
            _sweepDummy = null;
            _boltNearDummy = null;
            _boltFarDummy = null;

            Application.logMessageReceived += OnLog;
            EditorApplication.playModeStateChanged += OnStateChanged;
            EditorApplication.isPlaying = true;
        }

        private static void OnLog(string condition, string stackTrace, LogType type)
        {
            if (type != LogType.Error && type != LogType.Exception) return;
            if (stackTrace.Contains("UnityEditor.Search.SearchInit.IndexationOnStartup")) return;

            _hadError = true;
            Debug.LogError($"[PlaytestStorySlice] runtime error: {condition}\n{stackTrace}");
        }

        private static void OnStateChanged(PlayModeStateChange state)
        {
            if (state == PlayModeStateChange.EnteredPlayMode)
            {
                EditorApplication.update += Tick;
            }
            else if (state == PlayModeStateChange.EnteredEditMode)
            {
                Application.logMessageReceived -= OnLog;
                EditorApplication.playModeStateChanged -= OnStateChanged;
                EditorSettings.enterPlayModeOptionsEnabled = _origEnterPlayModeOptionsEnabled;
                EditorSettings.enterPlayModeOptions = _origEnterPlayModeOptions;

                bool ok = !_hadError && _phase == Phase.Done;
                Debug.Log(ok
                    ? "[PlaytestStorySlice] OK - killed 10 grunts + boss (both quests done), npc talk/choice, sweep/bolt/brace/jump/rope/job-change/save-load all verified, no errors"
                    : $"[PlaytestStorySlice] FAIL - error={_hadError} phase={_phase} frames={_framesSeen}");
                EditorApplication.Exit(ok ? 0 : 1);
            }
        }

        private static void Tick()
        {
            _framesSeen++;
            // 다른 Playtest들의 2000 프레임 예산과 달리 이 테스트는 트리거
            // 안정화를 위해 실시간(Time.realtimeSinceStartup) 기준 대기를
            // 세 번 쓴다(각 0.2초) — 배치 모드가 초당 수천 프레임으로
            // 도는 걸 감안해 여유 있게 잡는다.
            if (_framesSeen > 20000)
            {
                Debug.LogError("[PlaytestStorySlice] 프레임 예산 초과");
                Fail();
                return;
            }

            switch (_phase)
            {
                case Phase.Init:
                    var playerGo = GameObject.FindWithTag("Player");
                    _player = playerGo != null ? playerGo.transform : null;
                    _playerController = playerGo != null ? playerGo.GetComponent<CharacterController>() : null;
                    _storyController = playerGo != null ? playerGo.GetComponent<StoryPlayerController>() : null;
                    _ropeGo = GameObject.Find("Rope");
                    _rope = _ropeGo != null ? _ropeGo.GetComponent<StoryRope>() : null;

                    if (_player == null || _storyController == null || _rope == null || StoryEnemy.All.Count != ExpectedEnemyCount + 1)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 씬 구성 못 찾음 — player={_player != null} controller={_storyController != null} rope={_rope != null} enemies={StoryEnemy.All.Count}(기대={ExpectedEnemyCount}+두목1)");
                        Fail();
                        return;
                    }
                    // GameBootstrap.Start()가 이전 실행이 남긴 save_story.json을
                    // 이미 불러왔을 수 있다(예: 이 테스트 자신의 지난 SaveLoad
                    // 단계가 디스크에 남긴 파일 — 실제로 겪음). 존재를 가정하지
                    // 않고 이 테스트가 스스로 시작 상태를 못박는다.
                    StoryQuestState.Restore(0, 0);
                    StoryWorldEventState.Restore(null); // 위와 같은 이유 — 이전 실행이 남긴 save_story.json 무시.
                    StoryNpcState.Restore(0, 0); // 위와 같은 이유 — 새 정적 상태를 추가할 때마다 여기 잊지 말 것(2026-09-14에 한 번 빠뜨려 겪음).
                    StoryJobState.Restore(1, 0f, StoryJobState.NoJob); // 위와 같은 이유(2026-09-15 "전직" 추가).
                    // 101-2 5-4 "관문 대장"(2026-09-20) — 위와 같은 이유. 리셋 전에
                    // GameBootstrap.Start()가 이미 (이전 실행이 남긴 값으로) 잘못
                    // 판정해 TryBecomeChampion()을 불렀을 수 있어, 리셋 뒤 다시 부른다
                    // (이미 승격됐으면 TryBecomeChampion() 자체가 조용히 no-op).
                    StorySaveState.ResetChampionForTest();
                    foreach (var se in StoryEnemy.All) se.TryBecomeChampion();
                    // 101-2 5-3 "비경"(2026-09-20) — 위와 같은 이유(이전 실행이
                    // 남긴 save_story.json 무시).
                    StoryLabyrinthState.ResetForTest();
                    StoryLabyrinthState.Restore(0, 0);
                    StorySkillState.Restore(null, null); // 101-2 5-2 1단계 — 위와 같은 이유.
                    if (!CheckButtonWiring()) { Fail(); return; }
                    if (!CheckSettingsPanel()) { Fail(); return; }
                    if (!CheckPlayerHudLocalization()) { Fail(); return; }
                    if (!CheckActionButtonLocalization()) { Fail(); return; }
                    if (!CheckGoalBoardAndSessionCard()) { Fail(); return; }
                    // PLAN.md 101-3 G "성장 연출" — 세션에서 가장 먼저 돌려야
                    // 한다(CheckLevelUpCut() 클래스 주석 참고). 잡졸을 죽이기
                    // 시작하면 그 자체로 GainExp()가 걸려 나중엔 이미 다른
                    // 레벨업이 지나간 뒤일 수 있다.
                    if (!CheckLevelUpCut()) { Fail(); return; }
                    if (!PlaytestStoryBossIntro.Run()) { Fail(); return; } // PLAN.md 106-8 — 두목 곁에 가기 전에(여기서 한 번 틀어 두면 뒤 단계가 안 막힌다).
                    if (!PlaytestStoryCompanions.Run()) { Fail(); return; } // PLAN.md 106-10 — 교대 셋 곁에 세우기. 끝나면 동료를 멈춰 뒤 단계를 안 흔든다.
                    if (!PlaytestStorySummon.Run()) { Fail(); return; } // PLAN.md 106-10 둘째 단계 — 소환(게이지·컷·내려찍기).
                    if (!PlaytestNpcModels.Story()) { Fail(); return; } // PLAN.md 106-4 STORY 몫 — 척후병·전직관 사실 모델.
                    if (!PlaytestStoryEras.Run()) { Fail(); return; } // PLAN.md 109-3 세 시대 — 자리·비경 상태를 되돌린다.
                    if (!PlaytestStoryBossPattern.Run()) { Fail(); return; } // PLAN.md 109-11-1 보스 패턴전 — 두목 등장 진단 뒤(컷을 튼 두목만 문다), 자리·체력·두목을 되돌린다.
                    _enemyIndex = 0;
                    _phase = Phase.TalkNpc;
                    break;

                case Phase.TalkNpc:
                {
                    // PLAN.md 51장 "STORY 확장 — NPC" 첫 슬라이스 검증 —
                    // 다른 단계들처럼 private 메서드를 리플렉션으로 직접
                    // 불러 판정 경로만 본다(실제 물리 트리거 콜백 타이밍에
                    // 기대지 않는다 — 처음엔 텔레포트 후 한 틱 기다리는
                    // 방식으로 짰다가 CharacterController×트리거 조합이
                    // 이 헤드리스 환경에서 안 잡혀 실패했다, TryAttack()
                    // 등 다른 단계와 같은 결로 바꿈).
                    var npcGo = GameObject.Find("Npc_Scout");
                    var npc = npcGo != null ? npcGo.GetComponent<StoryNpc>() : null;
                    if (npc == null)
                    {
                        Debug.LogError("[PlaytestStorySlice] Npc_Scout를 씬에서 못 찾음");
                        Fail();
                        return;
                    }
                    var method = typeof(StoryNpc).GetMethod("OnTriggerEnter", BindingFlags.NonPublic | BindingFlags.Instance);
                    method.Invoke(npc, new object[] { _playerController });

                    var dialogueGo = GameObject.Find("StoryDialogueUI");
                    var dialogueLabel = dialogueGo != null ? dialogueGo.GetComponent<DialogueLabel>() : null;
                    var label = dialogueLabel != null ? GetPrivate(dialogueLabel, "label") as TextMeshProUGUI : null;
                    if (label == null || !label.gameObject.activeSelf || string.IsNullOrEmpty(label.text))
                    {
                        Debug.LogError("[PlaytestStorySlice] 척후병에게 말을 걸었는데 DialogueLabel이 안 뜸");
                        Fail();
                        return;
                    }
                    if (StoryNpcState.ScoutTalkCount != 1)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 첫 대화인데 ScoutTalkCount={StoryNpcState.ScoutTalkCount}(기대=1)");
                        Fail();
                        return;
                    }

                    // 관계 — 쿨다운을 직접 0으로 되돌려(TryAttack 쿨다운
                    // 우회와 같은 결) 두 번째 만남을 시뮬레이션, 인사말
                    // 앞머리가 데워지는지 본다(StoryNpc.Greeting()).
                    SetPrivate(npc, "_lastSaidTime", -1000f);
                    method.Invoke(npc, new object[] { _playerController });
                    if (StoryNpcState.ScoutTalkCount != 2 || !label.text.Contains(StoryLocalization.T("npc.scout_greeting_default_2").Trim()))
                    {
                        Debug.LogError($"[PlaytestStorySlice] 두 번째 대화 갱신 실패 count={StoryNpcState.ScoutTalkCount}(기대=2) text=\"{label.text}\"");
                        Fail();
                        return;
                    }

                    Debug.Log($"[PlaytestStorySlice] npc talk OK - \"{label.text}\"");
                    _phase = Phase.TriggerDiscovery;
                    break;
                }

                case Phase.TriggerDiscovery:
                {
                    // PLAN.md 72~73장 World Event / Hidden Area 검증 — 위
                    // TalkNpc와 같은 이유(헤드리스 환경 물리 트리거 불신)로
                    // OnTriggerEnter를 직접 호출한다. MP를 일부러 깎아 둔
                    // 뒤 발견 보상(RestoreMp)이 실제로 채우는지까지 본다.
                    var discoveryGo = GameObject.Find("Discovery_Lookout");
                    var discovery = discoveryGo != null ? discoveryGo.GetComponent<StoryDiscovery>() : null;
                    if (discovery == null)
                    {
                        Debug.LogError("[PlaytestStorySlice] Discovery_Lookout를 씬에서 못 찾음");
                        Fail();
                        return;
                    }
                    StoryCombat.RestoreMp(0f);
                    var method = typeof(StoryDiscovery).GetMethod("OnTriggerEnter", BindingFlags.NonPublic | BindingFlags.Instance);
                    method.Invoke(discovery, new object[] { _playerController });

                    if (!StoryWorldEventState.IsTriggered(StoryDiscovery.EventId))
                    {
                        Debug.LogError("[PlaytestStorySlice] 망루 발견 트리거를 불렀는데 StoryWorldEventState에 안 남음");
                        Fail();
                        return;
                    }
                    if (Mathf.Abs(StoryCombat.Mp - StoryCombat.MpMax) > 0.01f)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 발견 보상이 MP를 안 채움 mp={StoryCombat.Mp}(기대={StoryCombat.MpMax})");
                        Fail();
                        return;
                    }
                    // Destroy()는 실제 파괴를 프레임 끝으로 미뤄(StoryEnemy.IsDead
                    // 주석과 같은 함정) 같은 프레임에 GameObject.Find로 확인할 수
                    // 없다 — 대신 State 쪽 자체 중복 방지를 본다(같은 id를 또
                    // 트리거해도 false여야 한다, 오브젝트 파괴 타이밍과 무관).
                    if (StoryWorldEventState.TryTrigger(StoryDiscovery.EventId))
                    {
                        Debug.LogError("[PlaytestStorySlice] StoryWorldEventState가 같은 id 중복 트리거를 막지 못함");
                        Fail();
                        return;
                    }

                    Debug.Log("[PlaytestStorySlice] discovery OK - event triggered, mp restored, object cleared, dedupe OK");
                    _phase = Phase.KillEnemies;
                    break;
                }

                case Phase.KillEnemies:
                    if (_enemyIndex >= ExpectedEnemyCount)
                    {
                        if (StoryQuestState.Kills != ExpectedEnemyCount || !StoryQuestState.QuestDone)
                        {
                            Debug.LogError($"[PlaytestStorySlice] 잡졸 열을 다 죽였는데 kills={StoryQuestState.Kills} done={StoryQuestState.QuestDone}(기대={ExpectedEnemyCount}/true)");
                            Fail();
                            return;
                        }
                        Debug.Log($"[PlaytestStorySlice] killed {ExpectedEnemyCount} grunts, quest done, kills={StoryQuestState.Kills}");
                        // PLAN.md 101-3 G "지형 반응" 캡 검증 — 이제서야 돈다.
                        // 위 per-hit ActiveCount 델타 비교(각 잡졸 타격마다)가
                        // 아직 남아 있는 동안 40개를 더 스폰하면 ActiveCount가
                        // 캡(32)에 눌어붙어 다음 잡졸의 델타 비교가 항상 실패한다
                        // (실제로 겪음 — 루프 안에 넣었다가 인덱스 1부터 깨짐).
                        if (!CheckGroundDecalCap()) { Fail(); return; }
                        _phase = Phase.KillBoss;
                        break;
                    }

                    // 잡졸 죽을 때마다 리스트에서 빠지지만, Awake() 호출
                    // 순서가 하이어라키 순서와 항상 같다는 보장이 없어(실제로
                    // 두목이 [0]에 온 적이 있었다 — "STORY 콘텐츠 확장"
                    // 2026-09-13에 발견) 인덱스 대신 IsBoss로 걸러 첫 잡졸을 찾는다.
                    StoryEnemy enemy = null;
                    foreach (var e in StoryEnemy.All) { if (!e.IsBoss) { enemy = e; break; } }
                    if (enemy == null)
                    {
                        Debug.LogError("[PlaytestStorySlice] 잡졸이 두목만 남기고 이미 다 사라짐(리스트 이상)");
                        Fail();
                        return;
                    }
                    Vector3 enemyPos = enemy.transform.position;
                    TeleportPlayer(enemyPos + new Vector3(-1f, 0f, 0f)); // 왼쪽에 서면 dx>0=facing(+1)과 일치 — 정면 판정 통과.
                    // TryAttack()의 쿨다운(0.36초)은 이 판의 손맛 규칙이지 이 테스트가
                    // 확인하려는 대상이 아니다 — 연속 공격 사이 실제로 몇 프레임씩
                    // 기다리는 대신 매번 0으로 되돌려 "판정 자체"만 격리해서 본다.
                    SetPrivate(_storyController, "_attackCooldownLeft", 0f);
                    int hitSparkBefore = HitSpark.SpawnCount;
                    int groundDecalBefore = StoryGroundDecal.ActiveCount;
                    int lootMarkerBefore = StoryLootMarker.SpawnCount;
                    InvokePrivate(_storyController, "TryAttack");

                    if (_enemyIndex == 0 && !CheckHitFeedback()) { Fail(); return; }

                    // PLAN.md 101-3 C "타격 VFX"(2026-09-17 추가) — 죽는 잡졸마다
                    // 확인(CheckHitFeedback과 달리 인덱스 제한 없음, 카운터 비교라 가볍다).
                    if (HitSpark.SpawnCount != hitSparkBefore + 1)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 잡졸 #{_enemyIndex} 타격에 HitSpark가 안 생김 — SpawnCount {hitSparkBefore} → {HitSpark.SpawnCount}");
                        Fail();
                        return;
                    }

                    // PLAN.md 101-3 G "지형 반응"(2026-09-18 STORY 이식) — 타격마다 HitMark 데칼.
                    if (StoryGroundDecal.ActiveCount <= groundDecalBefore)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 잡졸 #{_enemyIndex} 타격에 지형 데칼이 안 생김 — ActiveCount {groundDecalBefore} → {StoryGroundDecal.ActiveCount}");
                        Fail();
                        return;
                    }

                    // PLAN.md 101-3 F "죽음"(2026-09-18 STORY 이식) — 처치마다 유품 마커.
                    if (StoryLootMarker.SpawnCount != lootMarkerBefore + 1)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 잡졸 #{_enemyIndex} 처치에 유품 마커가 안 생김 — SpawnCount {lootMarkerBefore} → {StoryLootMarker.SpawnCount}");
                        Fail();
                        return;
                    }

                    // 데미지 굴림(atk21×0.88~1.12)의 최솟값(18.48)이 EnemyHp(18)보다
                    // 항상 크다 — 한 방에 죽어야 정상, 안 죽었으면 판정 로직 결함.
                    // Destroy()는 실제 파괴를 프레임 끝으로 미루니 IsDead 플래그로 본다.
                    if (!enemy.IsDead)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 잡졸 #{_enemyIndex}이 한 방에 안 죽음(StartAtk={StoryCombat.StartAtk} vs EnemyHp={StoryCombat.EnemyHp})");
                        Fail();
                        return;
                    }
                    _enemyIndex++;
                    break;

                case Phase.KillBoss:
                {
                    // "STORY 콘텐츠 확장"(2026-09-13) q_boss1 — 잡졸을 다
                    // 잡고 나면 StoryEnemy.All엔 두목 하나만 남는다.
                    if (StoryEnemy.All.Count != 1 || !StoryEnemy.All[0].IsBoss)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 두목만 남아야 하는데 count={StoryEnemy.All.Count} isBoss={(StoryEnemy.All.Count > 0 ? StoryEnemy.All[0].IsBoss.ToString() : "-")}");
                        Fail();
                        return;
                    }
                    var boss = StoryEnemy.All[0];
                    TeleportPlayer(boss.transform.position + new Vector3(-1f, 0f, 0f));

                    // 101-2 5-4 "관문 대장"(2026-09-20) — 새 게임은 항상
                    // 이번 주 미도전이라 GameBootstrap.Start()가 이 두목을
                    // 챔피언(HP×2.5=540)으로 이미 승격시켜 뒀어야 한다.
                    if (!boss.IsChampion || StoryEnemy.ActiveChampion != boss || !StorySaveState.ChampionAvailable())
                    {
                        Debug.LogError($"[PlaytestStorySlice] 새 게임 두목이 관문 대장으로 안 승격됨 — isChampion={boss.IsChampion} activeChampion={(StoryEnemy.ActiveChampion == boss)} available={StorySaveState.ChampionAvailable()}");
                        Fail();
                        return;
                    }

                    // 잡졸(EnemyHp=18)과 달리 두목은 챔피언 HP(540, =BossHp×2.5)라
                    // 한 방(StartAtk≈21)엔 안 죽어야 한다 — 그 자체가 "두목"이
                    // 다르다는 첫 증거.
                    SetPrivate(_storyController, "_attackCooldownLeft", 0f);
                    InvokePrivate(_storyController, "TryAttack");
                    if (boss.IsDead)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 두목이 한 방에 죽어 버림(챔피언 HP가 안 먹은 듯)");
                        Fail();
                        return;
                    }

                    // 남은 체력을 마저 깎는다 — 최저 변동폭(0.88)만 나와도
                    // 540/(21*0.88)≈30번이면 확실히 죽는다(수학적 상한, RNG
                    // 운에 안 기댐) — 여유 잡아 50.
                    int hits = 1;
                    bool sawShieldBroken = false;
                    while (!boss.IsDead && hits < 50)
                    {
                        SetPrivate(_storyController, "_attackCooldownLeft", 0f);
                        InvokePrivate(_storyController, "TryAttack");
                        if (boss.ChampionShieldBroken) sawShieldBroken = true;
                        hits++;
                    }
                    if (!boss.IsDead)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 두목이 {hits}번 쳐도 안 죽음(챔피언 HP)");
                        Fail();
                        return;
                    }
                    if (!sawShieldBroken)
                    {
                        Debug.LogError("[PlaytestStorySlice] 관문 대장 방패 파괴(누적 피해 30%)가 한 번도 안 걸림");
                        Fail();
                        return;
                    }
                    if (StorySaveState.ChampionAvailable())
                    {
                        Debug.LogError("[PlaytestStorySlice] 관문 대장 처치 후에도 이번 주 클레임이 안 찍힘");
                        Fail();
                        return;
                    }
                    if (StoryQuestState.BossKills != 1 || !StoryQuestState.QuestBossDone)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 두목 처치 후 사명 미갱신 — bossKills={StoryQuestState.BossKills} done={StoryQuestState.QuestBossDone}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestStorySlice] gate champion killed in {hits} hits (shield broken={sawShieldBroken}), claimed for this week, quest boss done, bossKills={StoryQuestState.BossKills}");
                    _phase = Phase.TalkNpcChoice;
                    break;
                }

                case Phase.TalkNpcChoice:
                {
                    // PLAN.md 51장 "STORY 확장 — 선택" 검증 — 두목을 막 잡은
                    // 뒤 첫 대화는 평소 대사 대신 StoryChoiceUi가 떠야 한다.
                    var npcGo = GameObject.Find("Npc_Scout");
                    var npc = npcGo != null ? npcGo.GetComponent<StoryNpc>() : null;
                    var choiceGo = GameObject.Find("StoryChoiceUI");
                    var choiceUi = choiceGo != null ? choiceGo.GetComponent<StoryChoiceUi>() : null;
                    if (npc == null || choiceUi == null)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 선택 검증용 오브젝트 못 찾음 npc={npc != null} choiceUi={choiceUi != null}");
                        Fail();
                        return;
                    }

                    SetPrivate(npc, "_lastSaidTime", -1000f);
                    var method = typeof(StoryNpc).GetMethod("OnTriggerEnter", BindingFlags.NonPublic | BindingFlags.Instance);
                    method.Invoke(npc, new object[] { _playerController });

                    if (!choiceUi.IsShowing)
                    {
                        Debug.LogError("[PlaytestStorySlice] 두목 처치 직후 대화인데 StoryChoiceUi가 안 뜸");
                        Fail();
                        return;
                    }
                    if (StoryNpcState.ChoiceMade != 0)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 선택 팝업이 뜨기 전인데 ChoiceMade={StoryNpcState.ChoiceMade}(기대=0)");
                        Fail();
                        return;
                    }

                    var optionAButton = GetPrivate(choiceUi, "optionAButton") as Button;
                    optionAButton.onClick.Invoke();

                    if (choiceUi.IsShowing)
                    {
                        Debug.LogError("[PlaytestStorySlice] 선택지를 눌렀는데 팝업이 안 닫힘");
                        Fail();
                        return;
                    }
                    if (StoryNpcState.ChoiceMade != 1)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 첫 선택지를 눌렀는데 ChoiceMade={StoryNpcState.ChoiceMade}(기대=1)");
                        Fail();
                        return;
                    }

                    var dialogueGo = GameObject.Find("StoryDialogueUI");
                    var dialogueLabel = dialogueGo != null ? dialogueGo.GetComponent<DialogueLabel>() : null;
                    var label = dialogueLabel != null ? GetPrivate(dialogueLabel, "label") as TextMeshProUGUI : null;
                    if (label == null || !label.text.Contains(StoryLocalization.T("npc.scout_choice_line_a")))
                    {
                        Debug.LogError($"[PlaytestStorySlice] 선택 직후 대사가 이상함 text=\"{(label != null ? label.text : "<null>")}\"");
                        Fail();
                        return;
                    }

                    // 다음 만남부터는 선택 어투(형씨!)로 인사말이 갈리는지 확인 —
                    // 두 번 다시 선택 팝업이 뜨지 않아야 한다(ChoiceMade!=0).
                    SetPrivate(npc, "_lastSaidTime", -1000f);
                    method.Invoke(npc, new object[] { _playerController });
                    if (choiceUi.IsShowing || !label.text.Contains(StoryLocalization.T("npc.scout_greeting_1").Trim()))
                    {
                        Debug.LogError($"[PlaytestStorySlice] 선택 이후 재대화가 이상함 showingChoice={choiceUi.IsShowing} text=\"{label.text}\"");
                        Fail();
                        return;
                    }

                    Debug.Log($"[PlaytestStorySlice] npc choice OK - \"{label.text}\"");
                    _phase = Phase.SweepTest;
                    break;
                }

                case Phase.SweepTest:
                    // 실제 잡졸은 다 죽었으니(위 KillEnemies) 스킬 전용 더미를
                    // 직접 세운다 — StoryEnemySpawner의 고정 자리와 무관.
                    TeleportPlayer(new Vector3(5f, 0.1f, 0f));
                    _sweepDummy = SpawnDummyEnemy(new Vector3(5.8f, 0.1f, 0f));
                    StoryCombat.RestoreMp(StoryCombat.MpMax);
                    SetPrivate(_storyController, "_sweepCooldownLeft", 0f);
                    _storyController.TriggerSweep();

                    if (!_sweepDummy.IsDead)
                    {
                        Debug.LogError("[PlaytestStorySlice] 횡소(TriggerSweep) 뒤에도 반경 안 더미가 안 죽음");
                        Fail();
                        return;
                    }
                    if (!Mathf.Approximately(StoryCombat.Mp, StoryCombat.MpMax - StoryCombat.SweepCost))
                    {
                        Debug.LogError($"[PlaytestStorySlice] 횡소 MP 차감 이상 — mp={StoryCombat.Mp}(기대={StoryCombat.MpMax - StoryCombat.SweepCost})");
                        Fail();
                        return;
                    }
                    Debug.Log("[PlaytestStorySlice] sweep OK - dummy killed, mp deducted");
                    _phase = Phase.BoltCast;
                    break;

                case Phase.BoltCast:
                    // facing은 이 테스트 내내 초기값(+1, 오른쪽)에서 안 바뀐다(가상
                    // 키 입력을 안 걸어서) — 그러니 더미 둘을 플레이어 오른쪽에 둔다.
                    TeleportPlayer(new Vector3(5f, 0.1f, 0f));
                    _boltNearDummy = SpawnDummyEnemy(new Vector3(7f, 0.1f, 0f));
                    _boltFarDummy = SpawnDummyEnemy(new Vector3(9.5f, 0.1f, 0f));
                    StoryCombat.RestoreMp(StoryCombat.MpMax);
                    SetPrivate(_storyController, "_boltCooldownLeft", 0f);
                    _storyController.TriggerBolt();
                    // MP 차감은 기다리기 전에 바로 확인 — 대기하는 동안에도
                    // MP 자연 회복(TickMpRegen, 8/초)이 계속 돌아 나중엔 수치가
                    // 이미 불어나 있다(실제로 겪음 — 0.5초 뒤 79.7 vs 기대 76).
                    if (!Mathf.Approximately(StoryCombat.Mp, StoryCombat.MpMax - StoryCombat.BoltCost))
                    {
                        Debug.LogError($"[PlaytestStorySlice] 기탄 MP 차감 이상 — mp={StoryCombat.Mp}(기대={StoryCombat.MpMax - StoryCombat.BoltCost})");
                        Fail();
                        return;
                    }
                    _waitUntilRealTime = Time.realtimeSinceStartup + 0.5f; // BoltSpeed(≈10.4m/s)로 4.5m 도달 여유.
                    _phase = Phase.BoltWait;
                    break;

                case Phase.BoltWait:
                    if (Time.realtimeSinceStartup < _waitUntilRealTime) return;
                    if (!_boltNearDummy.IsDead || !_boltFarDummy.IsDead)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 기탄(관통) 뒤에도 더미가 안 죽음 — near={_boltNearDummy.IsDead} far={_boltFarDummy.IsDead}");
                        Fail();
                        return;
                    }
                    Debug.Log("[PlaytestStorySlice] bolt OK - pierced both dummies, mp deducted");
                    _phase = Phase.BraceTest;
                    break;

                case Phase.BraceTest:
                    StoryCombat.RestoreMp(StoryCombat.MpMax);
                    SetPrivate(_storyController, "_braceCooldownLeft", 0f);
                    _storyController.TriggerBrace();

                    var buffUntil = (float)GetPrivate(_storyController, "_buffUntilTime");
                    if (buffUntil < Time.time + StoryCombat.BraceSeconds - 0.5f)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 기합(TriggerBrace) 뒤 buffUntil 이상 — {buffUntil}(now={Time.time})");
                        Fail();
                        return;
                    }
                    if (!Mathf.Approximately(StoryCombat.Mp, StoryCombat.MpMax - StoryCombat.BraceCost))
                    {
                        Debug.LogError($"[PlaytestStorySlice] 기합 MP 차감 이상 — mp={StoryCombat.Mp}(기대={StoryCombat.MpMax - StoryCombat.BraceCost})");
                        Fail();
                        return;
                    }
                    Debug.Log("[PlaytestStorySlice] brace OK - buff window set, mp deducted");
                    _phase = Phase.PartySwapTest;
                    break;

                case Phase.PartySwapTest:
                {
                    // PLAN.md 101-2 5-8 "동료 교대" — 기본 활성 역할은 0(선봉).
                    if (StoryPartyState.ActiveIndex != 0)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 기본 활성 역할이 0(선봉)이 아님 — {StoryPartyState.ActiveIndex}");
                        Fail();
                        return;
                    }
                    TeleportPlayer(new Vector3(5f, 0.1f, 0f));
                    _partySwapNearDummy = SpawnDummyEnemy(new Vector3(7f, 0.1f, 0f));
                    _partySwapFarDummy = SpawnDummyEnemy(new Vector3(9.5f, 0.1f, 0f));
                    StoryCombat.RestoreMp(StoryCombat.MpMax);
                    SetPrivate(_storyController, "_boltCooldownLeft", 0f);

                    // 유격(1) — 서명은 기탄(관통) — MP 없이 즉시 발동돼야 한다.
                    _storyController.TriggerPartySwap(1);
                    if (StoryPartyState.ActiveIndex != 1)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 교대 후 ActiveIndex={StoryPartyState.ActiveIndex}(기대=1, 유격)");
                        Fail();
                        return;
                    }
                    if (!Mathf.Approximately(StoryCombat.Mp, StoryCombat.MpMax))
                    {
                        Debug.LogError($"[PlaytestStorySlice] 동료 서명(기탄)이 MP를 소모함 — mp={StoryCombat.Mp}(기대={StoryCombat.MpMax}, 무료여야 함)");
                        Fail();
                        return;
                    }
                    _waitUntilRealTime = Time.realtimeSinceStartup + 0.5f; // BoltCast/BoltWait와 같은 여유(관통 투사체 도달 시간).
                    _phase = Phase.PartySwapWait;
                    break;
                }

                case Phase.PartySwapWait:
                {
                    if (Time.realtimeSinceStartup < _waitUntilRealTime) return;
                    if (!_partySwapNearDummy.IsDead || !_partySwapFarDummy.IsDead)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 동료 서명(기탄) 뒤에도 더미가 안 죽음 — near={_partySwapNearDummy.IsDead} far={_partySwapFarDummy.IsDead}");
                        Fail();
                        return;
                    }

                    // 교대 쿨다운(4초) 안에 다른 역할로 재교대 시도 — 거절돼야 한다.
                    _storyController.TriggerPartySwap(2);
                    if (StoryPartyState.ActiveIndex != 1)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 교대 쿨다운(4초) 중인데 재교대가 성사됨 — ActiveIndex={StoryPartyState.ActiveIndex}(기대=1 유지)");
                        Fail();
                        return;
                    }

                    // 쿨다운을 강제로 비운 뒤(실제 4초를 기다리지 않는다, BraceTest류와
                    // 같은 관례) 다시 시도하면 이번엔 성사돼야 한다.
                    typeof(StoryPartyState).GetField("_cooldownLeft", BindingFlags.NonPublic | BindingFlags.Static)?.SetValue(null, 0f);
                    _storyController.TriggerPartySwap(2);
                    if (StoryPartyState.ActiveIndex != 2)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 쿨다운 해제 후에도 교대 실패 — ActiveIndex={StoryPartyState.ActiveIndex}(기대=2 호법)");
                        Fail();
                        return;
                    }

                    Debug.Log("[PlaytestStorySlice] party swap OK - MP-free signature fired on swap, 4s cooldown enforced then respected after reset");
                    StoryPartyState.Restore(0); // 이후 단계(공격력 관련)가 역할 배율에 안 영향받게 기본값(선봉)으로.
                    _phase = Phase.LandBeforeJump;
                    break;
                }

                case Phase.LandBeforeJump:
                    // 배치 모드는 실시간보다 훨씬 빠르게 돈다(초당 수천 프레임 —
                    // PlaytestForestFurniture.cs가 이미 겪은 함정과 같은 종류) —
                    // 프레임 수만큼 기다려도 중력이 실제로 몇 mm도 못 끌어내릴 수
                    // 있다. `Move()`를 직접 큰 하강 벡터로 한 번 불러 접지시키고,
                    // **같은 프레임 안에서 곧바로** isGrounded를 읽는다 — 한 프레임
                    // 쉬면 `StoryPlayerController.Update()`가 그 사이 극소 dt로 자기
                    // Move()를 한 번 더 굴려(속도 0 근처, 배치 모드에서 사실상
                    // 이동량이 0에 가까워) isGrounded를 다시 false로 덮어써 버리는
                    // 걸 실제로 겪었다(CharacterController는 "이번 Move 호출이
                    // 바닥에 닿았는가"만 본다, 최근 방문 프레임 누적이 아니다).
                    TeleportPlayer(new Vector3(2f, 1f, 0f));
                    _playerController.Move(Vector3.down * 5f);
                    if (!_playerController.isGrounded)
                    {
                        var groundGo = GameObject.Find("Terrain/Ground");
                        var groundCol = groundGo != null ? groundGo.GetComponent<Collider>() : null;
                        Debug.LogError("[PlaytestStorySlice] Move(down) 뒤에도 isGrounded가 false — 지형 콜라이더 결함 의심 " +
                            $"playerPos={_player.position} controllerHeight={_playerController.height} controllerCenter={_playerController.center} " +
                            $"groundFound={groundGo != null} groundBounds={(groundCol != null ? groundCol.bounds.ToString() : "n/a")}");
                        Fail();
                        return;
                    }
                    CheckJumpNow();
                    _phase = Phase.EnterRope;
                    break;

                case Phase.EnterRope:
                    // 트리거 충돌 이벤트는 물리 엔진의 FixedUpdate 스텝에서 잡힌다 —
                    // 배치 모드는 렌더 프레임이 실시간보다 훨씬 빠르게 도니(위
                    // LandBeforeJump 주석과 같은 함정) "프레임 수"로 기다리면 실제
                    // 물리 스텝이 한 번도 안 돌았을 수 있다. `Time.realtimeSinceStartup`
                    // 기준 실제 0.2초를 기다린다(PlaytestForestFurniture.cs가 프레임
                    // 대신 Time.time 기준 대기로 고친 것과 같은 처방).
                    if (Time.realtimeSinceStartup < _waitUntilRealTime) return;
                    // rope.X(6.8)가 Platform[0](x 3.8~9.0, y 2.2~2.6) 바로 아래라
                    // 로프 중간 높이로 순간이동하면 캐릭터 캡슐이 그 발판 밑면에
                    // 박혀 CharacterController가 위로 밀어내 버린다(실제로 겪음 —
                    // Enter 직후 곧바로 Exit, y=1.41→2.69로 튀어 오름). 바닥에서
                    // 걸어와 오르기 시작하는 자리(로프 밑동 근처)로 대신 선다 —
                    // 발판과 안 겹치는 진짜 진입 지점.
                    _ropeDef = FieldMapData.Rope();
                    float entryY = _ropeDef.Bottom + 0.3f;
                    TeleportPlayer(new Vector3(_ropeDef.X, entryY, 0f));
                    _waitUntilRealTime = Time.realtimeSinceStartup + 0.2f;
                    _phase = Phase.RopeTopClearance;
                    break;

                case Phase.RopeTopClearance:
                    // "STORY 콘텐츠 확장"(2026-09-12)이 고친 결함의 회귀 확인 —
                    // 로프 위쪽 끝(Platform[0] 밑을 지나는 구간)에서
                    // CharacterController가 안 낀다. StoryTerrainBuilder.cs의
                    // RopeGapHalfWidth 참고.
                    if (Time.realtimeSinceStartup < _waitUntilRealTime) return;
                    float nearTopY = _ropeDef.Top - 0.05f;
                    TeleportPlayer(new Vector3(_ropeDef.X, nearTopY, 0f));
                    _playerController.Move(Vector3.zero); // 겹침이 있으면 이 한 번으로 밀려난다.
                    if (Mathf.Abs(_player.position.y - nearTopY) > 0.15f)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 로프 위쪽 끝에서 발판과 낌 — y={_player.position.y}(기대≈{nearTopY})");
                        Fail();
                        return;
                    }
                    Debug.Log("[PlaytestStorySlice] rope-top clearance OK - no platform snag");
                    // 아래 ExitRope의 가로 이탈 이동(Move(10,0,0))은 원래 로프
                    // 밑동 높이에서만 검증하던 것 — 방금 올라간 꼭대기 높이엔
                    // 발판 두 조각(RopeGapHalfWidth) 사이 좁은 틈이라 가로로
                    // 10m를 밀면 그 발판 조각에 막혀 트리거를 못 벗어난다.
                    // 검증 목적이 다르니(이탈 배선 vs 꼭대기 겹침) 밑동으로
                    // 되돌려 놓는다 — **단, 같은 프레임에 바로 하지 않는다.**
                    // TeleportPlayer()를 한 프레임 안에서 두 번 연달아 부르면
                    // (방금 위로, 곧바로 아래로) CharacterController가 물리
                    // 스텝 한 번 없이 enable/disable을 거푸 겪어 트리거
                    // 겹침 추적이 꼬인다(실제로 겪음 — 나중 ExitRope의
                    // Move(10,0,0)가 OnTriggerExit를 아예 안 보냄). 이 실시간
                    // 대기가 그 사이에 최소 한 번은 물리 스텝이 돌게 해 준다.
                    _waitUntilRealTime = Time.realtimeSinceStartup + 0.2f;
                    _phase = Phase.RopeDescend;
                    break;

                case Phase.RopeDescend:
                    if (Time.realtimeSinceStartup < _waitUntilRealTime) return;
                    TeleportPlayer(new Vector3(_ropeDef.X, _ropeDef.Bottom + 0.3f, 0f));
                    _waitUntilRealTime = Time.realtimeSinceStartup + 0.2f;
                    _phase = Phase.ExitRope;
                    break;

                case Phase.ExitRope:
                    if (Time.realtimeSinceStartup < _waitUntilRealTime) return;
                    var ropeAreaField = GetPrivate(_storyController, "_ropeArea");
                    if (ropeAreaField == null)
                    {
                        Debug.LogError("[PlaytestStorySlice] 로프 트리거 안에 서 있는데 _ropeArea가 안 채워짐(OnTriggerEnter 배선 결함)");
                        Fail();
                        return;
                    }
                    // 로프 밖으로 — 여기는 TeleportPlayer()(disable→대입→enable)를
                    // 안 쓴다. Unity는 **트리거와 겹친 콜라이더를 disable하는
                    // 순간엔 OnTriggerExit를 안 보낸다**(문서화된 동작) — 그래서
                    // Enter는 이 헬퍼로 잘 잡히는데 Exit만 실제로 안 잡혔다(직접
                    // 겪음). 콜라이더를 계속 켜 둔 채 `Move()`로 실제 스윕을 한 번
                    // 굴려야 물리 엔진이 "겹침→안 겹침" 전이를 정상적으로 본다.
                    _playerController.Move(new Vector3(10f, 0f, 0f));
                    _waitUntilRealTime = Time.realtimeSinceStartup + 0.2f;
                    _phase = Phase.LabyrinthTest;
                    break;

                case Phase.LabyrinthTest:
                {
                    // ExitRope의 Move(10,0,0) 스윕이 낸 OnTriggerExit는 물리
                    // 스텝에서 비동기로 처리된다(SaveLoad 원래 첫 줄과 같은
                    // 이유의 실시간 대기) — 이 창이 지나기 전에 이 단계가
                    // CharacterController를 또 disable/enable하면(비경 순간이동)
                    // 대기 중이던 로프 트리거 상태가 꼬인다(실제로 겪음).
                    if (Time.realtimeSinceStartup < _waitUntilRealTime) return;
                    if (!CheckLabyrinth()) { Fail(); return; }
                    _phase = Phase.SaveLoad;
                    break;
                }

                case Phase.SaveLoad:
                    if (Time.realtimeSinceStartup < _waitUntilRealTime) return;
                    var ropeAreaAfterExit = GetPrivate(_storyController, "_ropeArea");
                    if (ropeAreaAfterExit != null)
                    {
                        Debug.LogError("[PlaytestStorySlice] 로프 밖으로 나갔는데 _ropeArea가 안 비워짐(OnTriggerExit 배선 결함)");
                        Fail();
                        return;
                    }

                    // 2026-09-15 "전직" — 여태까지의 자연 킬(13마리)만으론
                    // Lv.10(JobChangeLevel)에 안 닿아 직접 exp를 보태 전직
                    // 가능 여부·스탯 반영·재전직 방지를 검증한다(GainExp/
                    // ChooseJob 둘 다 public static API라 리플렉션 불필요).
                    if (!StoryJobState.CanChooseJob) StoryJobState.GainExp(9999f);
                    if (!StoryJobState.CanChooseJob)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 전직 가능 상태가 안 됨 — level={StoryJobState.Level}");
                        Fail();
                        return;
                    }

                    // PLAN.md 104-1 "Playtest 원칙 교체"가 남겨둔 구멍 —
                    // `StoryJobChoiceUi`(전직 팝업)는 지금까지 어떤 Playtest도
                    // 존재조차 확인 안 했다(2026-09-16 세션이 "테스트가 아예
                    // 없음"이라 범위 밖으로 남김, docs/HISTORY.md 참고). 아래
                    // `StoryJobState.ChooseJob()` 직접 호출과는 별개로, 내
                    // 콜백만 써서 위젯 자체(Show()로 뜨는지·버튼 클릭 흉내로
                    // 닫히고 콜백이 오는지)를 먼저 확인한다 — 실제 게임
                    // 상태(`StoryJobState`)는 안 건드린다.
                    var jobChoiceUi = Object.FindFirstObjectByType<StoryJobChoiceUi>();
                    if (jobChoiceUi == null)
                    {
                        Debug.LogError("[PlaytestStorySlice] StoryJobChoiceUi 컴포넌트를 못 찾음");
                        Fail();
                        return;
                    }
                    if (jobChoiceUi.IsShowing)
                    {
                        Debug.LogError("[PlaytestStorySlice] StoryJobChoiceUi가 시작부터 떠 있음(기본은 숨김)");
                        Fail();
                        return;
                    }
                    string jobChosenByCallback = null;
                    jobChoiceUi.Show("테스트 안내문", jobKey => jobChosenByCallback = jobKey);
                    if (!jobChoiceUi.IsShowing)
                    {
                        Debug.LogError("[PlaytestStorySlice] StoryJobChoiceUi.Show() 호출 후에도 안 뜸");
                        Fail();
                        return;
                    }
                    var chooseMethod = typeof(StoryJobChoiceUi).GetMethod("Choose", BindingFlags.NonPublic | BindingFlags.Instance);
                    chooseMethod.Invoke(jobChoiceUi, new object[] { "warrior" }); // 버튼 onClick과 같은 경로.
                    if (jobChoiceUi.IsShowing)
                    {
                        Debug.LogError("[PlaytestStorySlice] 버튼 클릭(Choose) 후에도 StoryJobChoiceUi 패널이 안 닫힘");
                        Fail();
                        return;
                    }
                    if (jobChosenByCallback != "warrior")
                    {
                        Debug.LogError($"[PlaytestStorySlice] 버튼 클릭 콜백이 실제로 안 옴 — jobChosenByCallback={jobChosenByCallback}");
                        Fail();
                        return;
                    }
                    Debug.Log("[PlaytestStorySlice] job choice UI OK - Show()로 뜨고 버튼 클릭(Choose)으로 콜백+닫힘 확인");

                    if (StoryJobState.AtkBonus != 0f)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 전직 전인데 AtkBonus!=0 — {StoryJobState.AtkBonus}");
                        Fail();
                        return;
                    }
                    if (!CheckWeaponVisualBeforeJob()) { Fail(); return; }
                    if (!StoryJobState.ChooseJob("warrior"))
                    {
                        Debug.LogError("[PlaytestStorySlice] ChooseJob(\"warrior\") 실패");
                        Fail();
                        return;
                    }
                    if (!Mathf.Approximately(StoryJobState.AtkBonus, StoryCombat.JobsTier1["warrior"].Atk))
                    {
                        Debug.LogError($"[PlaytestStorySlice] 전직 후 AtkBonus 불일치 — {StoryJobState.AtkBonus}(기대={StoryCombat.JobsTier1["warrior"].Atk})");
                        Fail();
                        return;
                    }
                    if (!CheckWeaponVisualAfterJob()) { Fail(); return; }
                    if (StoryJobState.ChooseJob("archer"))
                    {
                        Debug.LogError("[PlaytestStorySlice] 이미 전직했는데 재전직이 성공함(재전직 방지 결함)");
                        Fail();
                        return;
                    }
                    if (!CheckJobSkills()) { Fail(); return; }
                    if (!CheckPromotionAndSchools()) { Fail(); return; }
                    if (!CheckUpperTiersAndPins()) { Fail(); return; }
                    if (!CheckOutfitTint()) { Fail(); return; }

                    Vector3 posBeforeSave = new Vector3(7.5f, 0.1f, 0f);
                    TeleportPlayer(posBeforeSave);
                    // 실제 잡졸 10 + 스킬 테스트용 더미 셋(횡소1·기탄2) = 13 —
                    // StoryEnemy.Die()는 더미든 실제든 안 가리고 AddKill()을
                    // 부른다(의도된 단순함, 사명 카운트가 더미까지 세는 건
                    // 무해하다). 하드코딩된 3 대신 실제 값을 저장 직전에 읽는다.
                    int killsBeforeSave = StoryQuestState.Kills;
                    int bossKillsBeforeSave = StoryQuestState.BossKills; // KillBoss phase에서 이미 1.
                    // TriggerDiscovery phase에서 이미 true — 세이브 스키마
                    // v3(2026-09-14)가 이걸 저장/복원하는지까지 같이 본다.
                    bool discoveredBeforeSave = StoryWorldEventState.IsTriggered(StoryDiscovery.EventId);
                    // 세이브 스키마 v4(2026-09-14) — 관계(척후병 대화 횟수)도 같이 본다.
                    int scoutTalkCountBeforeSave = StoryNpcState.ScoutTalkCount;
                    // 세이브 스키마 v5(2026-09-14) — 선택(ChoiceMade)도 같이 본다.
                    int choiceMadeBeforeSave = StoryNpcState.ChoiceMade;
                    // 세이브 스키마 v6(2026-09-15) — 전직(level/exp/job)도 같이 본다.
                    int levelBeforeSave = StoryJobState.Level;
                    float expBeforeSave = StoryJobState.Exp;
                    string jobBeforeSave = StoryJobState.Job;
                    // 세이브 스키마(버전 안 올림) — 101-2 5-4 "관문 대장"
                    // 클레임(KillBoss phase에서 이번 주 이미 찍음)도 같이 본다.
                    bool championAvailableBeforeSave = StorySaveState.ChampionAvailable();
                    // 세이브 스키마(버전 안 올림) — 101-2 5-3 "비경" 기억
                    // 조각·영구 강화 단수도 같이 본다(LabyrinthTest phase가
                    // 이미 여럿 쌓고 10단까지 밀어붙여 둔 값).
                    int memoryShardsBeforeSave = StoryLabyrinthState.MemoryShards;
                    int memoryTierBeforeSave = StoryLabyrinthState.MemoryTier;
                    // 세이브 스키마(버전 안 올림) — 101-2 5-8 "동료 교대" 활성
                    // 역할도 같이 본다(PartySwapTest가 되돌려 둔 0=선봉이 아니라
                    // 실제로 다른 값이어도 왕복이 되는지 보려고 여기서 2로 바꿔 둔다).
                    //
                    // 2026-09-21 발견 — 아래 왕복이 실제 persistentDataPath/
                    // save_story.json을 두 번 덮어쓴다. GameBootstrap.Start()가
                    // 부팅마다 StorySaveState.TryLoad()를 부르므로, 이 파일을
                    // 원래 모습(테스트 시작 전 상태)으로 되돌리지 않으면 이
                    // 세션이 끝난 뒤 **다음번 헤드리스 실행**이 partyActiveIndex=2
                    // (호법, 공격 배율 0.9)를 그대로 이어받아 KillEnemies 단계의
                    // 잡졸 한 방 처치 전제(공격력 마진)가 깨진다 — 실제로 겪음
                    // (docs/PROJECT_STATE.md "알려진 오류" 참고, GO
                    // PlaytestHeadless.cs의 같은 결 try/finally를 그대로 옮김).
                    string storySavePath = System.IO.Path.Combine(Application.persistentDataPath, "save_story.json");
                    string originalStorySaveJson = System.IO.File.Exists(storySavePath)
                        ? System.IO.File.ReadAllText(storySavePath) : null;
                    try
                    {
                        StoryPartyState.Restore(2);
                        int partyIndexBeforeSave = StoryPartyState.ActiveIndex;
                        // 101-2 5-2 1단계 — 무예 레벨도 왕복 확인(버전 안 올림).
                        StorySkillState.Restore(new[] { "w_cut", "w_rush" }, new[] { 3, 2 }, new[] { "w_rush" }); // 5-2 3단계 칸 고정도 왕복
                        if (!StorySaveState.Save())
                        {
                            Debug.LogError("[PlaytestStorySlice] StorySaveState.Save() 실패");
                            Fail();
                            return;
                        }

                        // 상태를 지운 뒤 다시 불러와 그대로 돌아오는지 확인.
                        StoryQuestState.Restore(0, 0);
                        StoryWorldEventState.Restore(null);
                        StoryNpcState.Restore(0, 0);
                        StoryJobState.Restore(1, 0f, StoryJobState.NoJob);
                        StorySaveState.ResetChampionForTest();
                        StoryLabyrinthState.Restore(0, 0);
                        StoryPartyState.Restore(0);
                        StorySkillState.Restore(null, null);
                        TeleportPlayer(new Vector3(0f, 0.1f, 0f));
                        if (!StorySaveState.TryLoad())
                        {
                            Debug.LogError("[PlaytestStorySlice] StorySaveState.TryLoad() 실패");
                            Fail();
                            return;
                        }
                        if (StoryQuestState.Kills != killsBeforeSave || StoryQuestState.BossKills != bossKillsBeforeSave)
                        {
                            Debug.LogError($"[PlaytestStorySlice] 로드 후 kills={StoryQuestState.Kills}(기대={killsBeforeSave}) bossKills={StoryQuestState.BossKills}(기대={bossKillsBeforeSave})");
                            Fail();
                            return;
                        }
                        if (StoryWorldEventState.IsTriggered(StoryDiscovery.EventId) != discoveredBeforeSave)
                        {
                            Debug.LogError($"[PlaytestStorySlice] 로드 후 discovery triggered={StoryWorldEventState.IsTriggered(StoryDiscovery.EventId)}(기대={discoveredBeforeSave})");
                            Fail();
                            return;
                        }
                        if (StoryNpcState.ScoutTalkCount != scoutTalkCountBeforeSave)
                        {
                            Debug.LogError($"[PlaytestStorySlice] 로드 후 scoutTalkCount={StoryNpcState.ScoutTalkCount}(기대={scoutTalkCountBeforeSave})");
                            Fail();
                            return;
                        }
                        if (StoryNpcState.ChoiceMade != choiceMadeBeforeSave)
                        {
                            Debug.LogError($"[PlaytestStorySlice] 로드 후 choiceMade={StoryNpcState.ChoiceMade}(기대={choiceMadeBeforeSave})");
                            Fail();
                            return;
                        }
                        if (StoryJobState.Level != levelBeforeSave || !Mathf.Approximately(StoryJobState.Exp, expBeforeSave) || StoryJobState.Job != jobBeforeSave)
                        {
                            Debug.LogError($"[PlaytestStorySlice] 로드 후 level={StoryJobState.Level}(기대={levelBeforeSave}) exp={StoryJobState.Exp}(기대={expBeforeSave}) job={StoryJobState.Job}(기대={jobBeforeSave})");
                            Fail();
                            return;
                        }
                        if (StorySaveState.ChampionAvailable() != championAvailableBeforeSave)
                        {
                            Debug.LogError($"[PlaytestStorySlice] 로드 후 관문 대장 클레임 상태 불일치 — available={StorySaveState.ChampionAvailable()}(기대={championAvailableBeforeSave})");
                            Fail();
                            return;
                        }
                        if (StoryLabyrinthState.MemoryShards != memoryShardsBeforeSave || StoryLabyrinthState.MemoryTier != memoryTierBeforeSave)
                        {
                            Debug.LogError($"[PlaytestStorySlice] 로드 후 비경 기억 조각/강화 불일치 — shards={StoryLabyrinthState.MemoryShards}(기대={memoryShardsBeforeSave}) tier={StoryLabyrinthState.MemoryTier}(기대={memoryTierBeforeSave})");
                            Fail();
                            return;
                        }
                        if (StoryPartyState.ActiveIndex != partyIndexBeforeSave)
                        {
                            Debug.LogError($"[PlaytestStorySlice] 로드 후 동료 교대 활성 역할 불일치 — {StoryPartyState.ActiveIndex}(기대={partyIndexBeforeSave})");
                            Fail();
                            return;
                        }
                        if (Vector3.Distance(_player.position, posBeforeSave) > 0.01f)
                        {
                            Debug.LogError($"[PlaytestStorySlice] 로드 후 위치={_player.position}(기대={posBeforeSave})");
                            Fail();
                            return;
                        }
                        if (StorySkillState.LevelOf("w_cut") != 3 || StorySkillState.LevelOf("w_rush") != 2 || StorySkillState.SpSpent != 5 ||
                            StorySkillState.PinIndex("w_rush") != 0 || StorySkillState.SlotSkill(0)?.Key != "w_rush")
                        {
                            Debug.LogError($"[PlaytestStorySlice] 로드 후 무예 레벨/칸 고정 불일치 — w_cut={StorySkillState.LevelOf("w_cut")}(기대=3) w_rush={StorySkillState.LevelOf("w_rush")}(기대=2) spent={StorySkillState.SpSpent}(기대=5) 돌진 고정={StorySkillState.PinIndex("w_rush")}(기대 0) 칸0={StorySkillState.SlotSkill(0)?.Key}");
                            Fail();
                            return;
                        }

                        // PLAN.md 104-3 "구버전 로드 단계" — 무예 필드가 없는 옛 세이브(5-2 전 형식)를
                        // 흉내 내 두 배열을 지운 JSON으로 다시 불러 본다: 무예는 빈 상태, 나머지는 그대로.
                        string savedJson = System.IO.File.ReadAllText(storySavePath);
                        string oldFormatJson = System.Text.RegularExpressions.Regex.Replace(savedJson,
                            ",\"skillKeys\":\\[[^\\]]*\\],\"skillLevels\":\\[[^\\]]*\\](,\"skillPins\":\\[[^\\]]*\\])?", "");
                        if (oldFormatJson == savedJson || oldFormatJson.Contains("skill"))
                        {
                            Debug.LogError($"[PlaytestStorySlice] 옛 형식 흉내 JSON을 못 만듦(정규식 불일치) — {savedJson}");
                            Fail();
                            return;
                        }
                        System.IO.File.WriteAllText(storySavePath, oldFormatJson);
                        if (!StorySaveState.TryLoad())
                        {
                            Debug.LogError("[PlaytestStorySlice] 무예 필드 없는 옛 세이브 TryLoad() 실패");
                            Fail();
                            return;
                        }
                        if (StorySkillState.SpSpent != 0 || StorySkillState.PinCount != 0 || StoryJobState.Job != jobBeforeSave || StoryJobState.Level != levelBeforeSave)
                        {
                            Debug.LogError($"[PlaytestStorySlice] 옛 세이브 로드 후 상태 이상 — spent={StorySkillState.SpSpent}(기대=0) job={StoryJobState.Job}(기대={jobBeforeSave}) level={StoryJobState.Level}");
                            Fail();
                            return;
                        }
                        Debug.Log("[PlaytestStorySlice] skill save round-trip + old-format load OK");
                    }
                    finally
                    {
                        if (originalStorySaveJson != null) System.IO.File.WriteAllText(storySavePath, originalStorySaveJson);
                        else if (System.IO.File.Exists(storySavePath)) System.IO.File.Delete(storySavePath);
                    }

                    Debug.Log("[PlaytestStorySlice] save/load round-trip OK");
                    EditorApplication.update -= Tick;
                    EditorApplication.isPlaying = false;
                    _phase = Phase.Done;
                    break;
            }
        }

        /// <summary>PLAN.md 101-2 STORY "5-3 비경"(2026-09-20) — 실제
        /// Play-mode 경로로 확인한다: (a) 지도 결정성, (b) 축복 축 구조,
        /// (c) 즉시 판정 노드 셋(보물·휴식·사건), (d) 전투/정예 노드가
        /// 아레나에서 실제 StoryEnemy를 스폰·처치까지 시키는지, (e) 노드
        /// 제한시간 초과 실패와 재기(再起) 은사의 1회 무효화, (f) 실제
        /// 맵 UI 버튼을 눌러 1~5층을 완주하는 전체 흐름, (g) 기억 조각
        /// 영구 강화(공격력)와 10단 상한.</summary>
        private static bool CheckLabyrinth()
        {
            var mapA = StoryLabyrinthData.GenerateFloors(12345);
            var mapB = StoryLabyrinthData.GenerateFloors(12345);
            if (mapA.Length != mapB.Length)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 지도 층수 불일치 — {mapA.Length} vs {mapB.Length}");
                return false;
            }
            for (int i = 0; i < mapA.Length; i++)
            {
                if (mapA[i].Length != mapB[i].Length)
                {
                    Debug.LogError($"[PlaytestStorySlice] 비경 지도 {i}층 노드 개수가 같은 seed인데 다름");
                    return false;
                }
                for (int j = 0; j < mapA[i].Length; j++)
                {
                    if (mapA[i][j] != mapB[i][j])
                    {
                        Debug.LogError($"[PlaytestStorySlice] 비경 지도 {i}층 {j}번 노드가 같은 seed인데 다름 — {mapA[i][j]} vs {mapB[i][j]}");
                        return false;
                    }
                }
            }
            Debug.Log("[PlaytestStorySlice] labyrinth map determinism OK (seed 고정 시 지도 동일)");

            if (StoryLabyrinthData.AxisPools.Length != 3)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 축복 축 개수={StoryLabyrinthData.AxisPools.Length}(기대=3)");
                return false;
            }
            for (int axis = 0; axis < 3; axis++)
            {
                foreach (var b in StoryLabyrinthData.AxisPools[axis])
                {
                    if ((int)b.Axis != axis)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 비경 축복 축 불일치 — {b.Key} axis={b.Axis}(기대={(StoryLabyrinthData.BlessingAxis)axis})");
                        return false;
                    }
                }
            }
            Debug.Log("[PlaytestStorySlice] labyrinth blessing axis structure OK (3택 축 중복 0이 구조적으로 보장됨)");

            var runner = StoryLabyrinthRunner.Instance;
            var mapUi = StoryLabyrinthMapUi.Instance;
            if (runner == null || mapUi == null)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 컴포넌트를 씬에서 못 찾음 — runner={runner != null} mapUi={mapUi != null}");
                return false;
            }

            // ── 즉시 판정 노드(보물/휴식/사건) — 층 진행과 무관, EnterNode 직접 호출 ──
            runner.StartRunWithSeed(1);

            bool treasureCleared = false;
            runner.EnterNode(StoryLabyrinthData.NodeType.Treasure, () => treasureCleared = true);
            if (!treasureCleared || StoryLabyrinthState.MemoryShards != 1)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 보물 노드 실패 — cleared={treasureCleared} shards={StoryLabyrinthState.MemoryShards}(기대=1)");
                return false;
            }

            StoryCombat.RestoreMp(0f);
            bool restCleared = false;
            runner.EnterNode(StoryLabyrinthData.NodeType.Rest, () => restCleared = true);
            if (!restCleared || !Mathf.Approximately(StoryCombat.Mp, StoryCombat.MpMaxCurrent))
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 휴식 노드 실패 — cleared={restCleared} mp={StoryCombat.Mp}(기대={StoryCombat.MpMaxCurrent})");
                return false;
            }

            bool eventCleared = false;
            runner.EnterNode(StoryLabyrinthData.NodeType.Event, () => eventCleared = true);
            if (!eventCleared)
            {
                Debug.LogError("[PlaytestStorySlice] 비경 사건 노드 콜백이 안 옴(결과와 무관하게 항상 와야 한다)");
                return false;
            }
            Debug.Log("[PlaytestStorySlice] labyrinth instant nodes (treasure/rest/event) OK");

            // ── 전투 노드 — 아레나로 순간이동 + 실제 StoryEnemy 스폰·처치 ──
            Vector3 beforeCombatPos = _player.position;
            int shardsBeforeCombat = StoryLabyrinthState.MemoryShards;
            bool combatCleared = false;
            runner.EnterNode(StoryLabyrinthData.NodeType.Combat, () => combatCleared = true);
            if (!runner.NodeActive || runner.ActiveArenaEnemies.Count != 2)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 전투 노드가 잡졸 2를 안 세움 — active={runner.NodeActive} count={runner.ActiveArenaEnemies.Count}");
                return false;
            }
            foreach (var e in runner.ActiveArenaEnemies) e.TakeDamage(99999f);
            InvokePrivate(runner, "Update");
            if (!combatCleared || runner.NodeActive)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 전투 노드 클리어 실패 — cleared={combatCleared} active={runner.NodeActive}");
                return false;
            }
            if (StoryLabyrinthState.MemoryShards != shardsBeforeCombat + 1)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 전투 노드 기억 조각 보상 불일치 — {StoryLabyrinthState.MemoryShards}(기대={shardsBeforeCombat + 1})");
                return false;
            }
            if (Vector3.Distance(_player.position, beforeCombatPos) > 0.01f)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 전투 노드 클리어 후 원위치로 안 돌아옴 — {_player.position}(기대={beforeCombatPos})");
                return false;
            }
            Debug.Log("[PlaytestStorySlice] labyrinth combat node OK - 2 enemies, cleared, shard+1, teleported back");

            // ── 정예 노드 — HP 2배 + 클리어 후 보너스 은사 카드(실제 클릭까지) ──
            int shardsBeforeElite = StoryLabyrinthState.MemoryShards;
            bool eliteCleared = false;
            runner.EnterNode(StoryLabyrinthData.NodeType.Elite, () => eliteCleared = true);
            if (runner.ActiveArenaEnemies.Count != 1)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 정예 노드가 1을 안 세움 — count={runner.ActiveArenaEnemies.Count}");
                return false;
            }
            var eliteEnemy = runner.ActiveArenaEnemies[0];
            eliteEnemy.TakeDamage(StoryCombat.EnemyHp);
            if (eliteEnemy.IsDead)
            {
                Debug.LogError("[PlaytestStorySlice] 비경 정예가 잡졸 한 방(EnemyHp)에 죽음 — HP 배율 2배가 안 먹은 듯");
                return false;
            }
            eliteEnemy.TakeDamage(99999f);
            InvokePrivate(runner, "Update");
            if (eliteCleared)
            {
                Debug.LogError("[PlaytestStorySlice] 비경 정예 클리어 콜백이 은사 선택 전에 옴(정예는 은사부터 골라야 한다)");
                return false;
            }
            if (!ClickFirstBlessingButton(mapUi))
            {
                return false;
            }
            if (!eliteCleared)
            {
                Debug.LogError("[PlaytestStorySlice] 은사 클릭 후에도 정예 클리어 콜백이 안 옴");
                return false;
            }
            if (StoryLabyrinthState.MemoryShards != shardsBeforeElite + 1)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 정예 노드 기억 조각 보상 불일치 — {StoryLabyrinthState.MemoryShards}(기대={shardsBeforeElite + 1})");
                return false;
            }
            bool anyBlessingApplied =
                !Mathf.Approximately(StoryLabyrinthState.AtkMul, 1f) ||
                StoryLabyrinthState.CritRateBonus != 0f ||
                !Mathf.Approximately(StoryLabyrinthState.CooldownMul, 1f);
            if (!anyBlessingApplied)
            {
                Debug.LogError("[PlaytestStorySlice] 정예 은사 클릭 후에도 공격축 배율이 전부 기본값 — ApplyBlessing이 안 먹은 듯(버튼 0은 항상 공격축)");
                return false;
            }
            Debug.Log("[PlaytestStorySlice] labyrinth elite node OK - 2x hp, blessing card shown+clicked, shard+1, blessing applied");

            // ── 노드 제한시간 초과 — 실패로 회차가 끝난다(재기 없음) ──
            StoryLabyrinthState.EndRun();
            runner.StartRunWithSeed(2);
            bool failCallbackFired = false;
            runner.EnterNode(StoryLabyrinthData.NodeType.Combat, () => failCallbackFired = true);
            SetPrivate(runner, "_nodeTimeLeft", -1f);
            InvokePrivate(runner, "Update");
            if (StoryLabyrinthState.InRun || failCallbackFired || runner.NodeActive)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 제한시간 초과 실패 처리 결함 — inRun={StoryLabyrinthState.InRun} clearedCallback={failCallbackFired} nodeActive={runner.NodeActive}");
                return false;
            }
            Debug.Log("[PlaytestStorySlice] labyrinth time-limit failure OK - run ended, no clear callback, extra_life 없이 즉시 실패");

            // ── 재기(再起, extra_life) — 첫 실패는 무효화되고 다시 도전 ──
            runner.StartRunWithSeed(3);
            StoryLabyrinthState.ApplyBlessing("extra_life");
            bool extraLifeCallbackFired = false;
            runner.EnterNode(StoryLabyrinthData.NodeType.Combat, () => extraLifeCallbackFired = true);
            SetPrivate(runner, "_nodeTimeLeft", -1f);
            InvokePrivate(runner, "Update");
            if (!StoryLabyrinthState.InRun || StoryLabyrinthState.ExtraLifeAvailable)
            {
                Debug.LogError($"[PlaytestStorySlice] 재기 소모 실패 — inRun={StoryLabyrinthState.InRun}(기대=true) extraLifeAvailable={StoryLabyrinthState.ExtraLifeAvailable}(기대=false)");
                return false;
            }
            if (!runner.NodeActive || runner.ActiveArenaEnemies.Count != 2)
            {
                Debug.LogError($"[PlaytestStorySlice] 재기 뒤 노드가 다시 안 시작됨 — active={runner.NodeActive} count={runner.ActiveArenaEnemies.Count}");
                return false;
            }
            foreach (var e in runner.ActiveArenaEnemies) e.TakeDamage(99999f);
            InvokePrivate(runner, "Update");
            if (!extraLifeCallbackFired)
            {
                Debug.LogError("[PlaytestStorySlice] 재기 뒤 재도전 클리어 콜백이 안 옴");
                return false;
            }
            Debug.Log("[PlaytestStorySlice] labyrinth extra-life (재기) retry OK - 1회 무효화 뒤 재도전 클리어");
            runner.AbandonRun();

            // ── 전체 흐름 — 실제 맵 UI 버튼을 눌러 1~5층 완주 ──
            const int fullRunSeed = 42;
            var expectedFloors = StoryLabyrinthData.GenerateFloors(fullRunSeed);
            runner.StartRunWithSeed(fullRunSeed);
            bool entryDone = false;
            mapUi.ShowEntryBlessing(() => { entryDone = true; mapUi.ShowFloor(); });
            if (!ClickFirstBlessingButton(mapUi)) return false;
            if (!entryDone)
            {
                Debug.LogError("[PlaytestStorySlice] 비경 진입 은사 선택 후 콜백이 안 옴");
                return false;
            }

            for (int f = 0; f < expectedFloors.Length; f++)
            {
                if (StoryLabyrinthState.Floor != f + 1)
                {
                    Debug.LogError($"[PlaytestStorySlice] 비경 {f}번째 층 진행 중 Floor={StoryLabyrinthState.Floor}(기대={f + 1})");
                    return false;
                }
                var nodeType = expectedFloors[f][0]; // 항상 첫 노드 — 노드 종류별 판정은 위에서 이미 각각 확인했다.
                if (!ClickFirstMapNodeButton(mapUi)) return false;

                if (nodeType == StoryLabyrinthData.NodeType.Combat || nodeType == StoryLabyrinthData.NodeType.Elite)
                {
                    if (!runner.NodeActive)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 비경 {f + 1}층 {nodeType} 노드가 전투를 안 시작함");
                        return false;
                    }
                    foreach (var e in runner.ActiveArenaEnemies) e.TakeDamage(99999f);
                    InvokePrivate(runner, "Update");
                    if (nodeType == StoryLabyrinthData.NodeType.Elite && !ClickFirstBlessingButton(mapUi))
                    {
                        return false;
                    }
                }
            }
            if (StoryLabyrinthState.Floor < 5)
            {
                Debug.LogError($"[PlaytestStorySlice] 4개 층을 다 골랐는데 Floor={StoryLabyrinthState.Floor}(기대>=5)");
                return false;
            }

            if (!ClickFirstMapNodeButton(mapUi)) return false; // 5층 "도전한다".
            if (!runner.NodeActive || runner.ActiveArenaEnemies.Count != 1 || !runner.ActiveArenaEnemies[0].IsBoss)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 5층 보스가 안 섬 — active={runner.NodeActive} count={runner.ActiveArenaEnemies.Count}");
                return false;
            }
            runner.ActiveArenaEnemies[0].TakeDamage(99999f);
            InvokePrivate(runner, "Update");
            if (StoryLabyrinthState.InRun)
            {
                Debug.LogError("[PlaytestStorySlice] 비경 보스 처치 후에도 회차가 안 끝남");
                return false;
            }
            Debug.Log($"[PlaytestStorySlice] labyrinth full run OK - seed={fullRunSeed}, cleared floor 1~5, shards now={StoryLabyrinthState.MemoryShards}");

            // ── 영구 강화(기억 조각→공격력) + 10단 상한 ──
            float atkBonusBefore = StoryLabyrinthState.MemoryAtkBonus;
            if (StoryLabyrinthState.MemoryShards < 1)
            {
                Debug.LogError($"[PlaytestStorySlice] 영구 강화 검증 전 기억 조각이 부족 — {StoryLabyrinthState.MemoryShards}");
                return false;
            }
            if (!StoryLabyrinthState.TryUpgradeMemory() || StoryLabyrinthState.MemoryTier != 1)
            {
                Debug.LogError($"[PlaytestStorySlice] 영구 강화 실패 — tier={StoryLabyrinthState.MemoryTier}(기대=1)");
                return false;
            }
            if (StoryLabyrinthState.MemoryAtkBonus <= atkBonusBefore)
            {
                Debug.LogError($"[PlaytestStorySlice] 영구 강화 후 MemoryAtkBonus 안 늘어남 — {StoryLabyrinthState.MemoryAtkBonus}(이전={atkBonusBefore})");
                return false;
            }
            StoryLabyrinthState.AddShards(999);
            while (StoryLabyrinthState.TryUpgradeMemory()) { } // 상한까지 밀어붙인다.
            if (StoryLabyrinthState.MemoryTier != StoryLabyrinthData.MemoryTierMax || StoryLabyrinthState.TryUpgradeMemory())
            {
                Debug.LogError($"[PlaytestStorySlice] 영구 강화 상한({StoryLabyrinthData.MemoryTierMax}단) 위반 — tier={StoryLabyrinthState.MemoryTier}");
                return false;
            }
            Debug.Log($"[PlaytestStorySlice] labyrinth memory upgrade OK - tier capped at {StoryLabyrinthData.MemoryTierMax}, atkBonus={StoryLabyrinthState.MemoryAtkBonus}");

            Debug.Log("[PlaytestStorySlice] labyrinth (101-2 5-3) full verification OK");
            return true;
        }

        /// <summary>은사 선택 패널의 0번 버튼(항상 공격축, 축마다 하나씩
        /// 고정 순서로 뜬다 — StoryLabyrinthMapUi.ShowBlessingPick 참고)을
        /// 실제로 클릭해 콜백 경로까지 확인한다.</summary>
        private static bool ClickFirstBlessingButton(StoryLabyrinthMapUi mapUi)
        {
            var panel = GetPrivate(mapUi, "_blessingPanel") as GameObject;
            var root = GetPrivate(mapUi, "_blessingButtonRoot") as Transform;
            if (panel == null || !panel.activeSelf || root == null || root.childCount != 3)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 은사 패널이 안 뜸 — panelActive={(panel != null ? panel.activeSelf.ToString() : "null")} buttons={(root != null ? root.childCount.ToString() : "null")}(기대=3)");
                return false;
            }
            root.GetChild(0).GetComponent<Button>().onClick.Invoke();
            return true;
        }

        /// <summary>노드 지도 화면의 0번 버튼(노드 목록 중 첫째, 5층은
        /// "도전한다" 하나뿐)을 클릭한다.</summary>
        private static bool ClickFirstMapNodeButton(StoryLabyrinthMapUi mapUi)
        {
            var panel = GetPrivate(mapUi, "_mapPanel") as GameObject;
            var root = GetPrivate(mapUi, "_nodeButtonRoot") as Transform;
            if (panel == null || !panel.activeSelf || root == null || root.childCount == 0)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 노드 지도가 안 뜸 — panelActive={(panel != null ? panel.activeSelf.ToString() : "null")} buttons={(root != null ? root.childCount.ToString() : "null")}");
                return false;
            }
            root.GetChild(0).GetComponent<Button>().onClick.Invoke();
            return true;
        }

        private static void CheckJumpNow()
        {
            _storyController.TriggerJump();
            float v = (float)GetPrivate(_storyController, "_verticalVelocity");
            if (v <= 0f)
            {
                Debug.LogError($"[PlaytestStorySlice] TriggerJump() 뒤에도 수직 속도가 0 이하 — v={v}");
                Fail();
            }
            else
            {
                Debug.Log($"[PlaytestStorySlice] jump OK, verticalVelocity={v}");
            }
        }

        private static bool IsDestroyed(StoryEnemy enemy) => enemy == null;

        /// <summary>스킬 전용 더미 — StoryEnemySpawner 고정 자리와 무관하게
        /// 하나씩 즉석에서 세운다(modelPrefab 없이 CharacterVisual 폴백
        /// 캡슐로 충분, 시각 확인 대상이 아니다).</summary>
        private static StoryEnemy SpawnDummyEnemy(Vector3 position)
        {
            var go = new GameObject("TestDummyEnemy");
            go.transform.position = position;
            return go.AddComponent<StoryEnemy>();
        }

        /// <summary>PLAN.md 101-2 STORY "5-7 손맛 표준"(2026-09-17, 101-3 C
        /// 표) — 공격 직후 바로 확인한다(`StartCoroutine()`이 첫 yield 전
        /// 세그먼트를 같은 프레임에 동기 실행한다는 점 이용, DUNGEON
        /// `PlaytestDungeonHeadless.CheckHitstop()`과 같은 결). 카메라
        /// 흔들림은 `_shakeTimer`(private) 로, hitstop 은 player Animator
        /// 의 `.speed` 로 본다 — 둘 다 `TryAttack()` 호출과 같은 프레임에서
        /// 봐야 하므로 호출부(Phase.KillEnemies)가 첫 공격 직후 바로 부른다.</summary>
        private static bool CheckHitFeedback()
        {
            var cam = StoryCameraFollow.Instance;
            if (cam == null)
            {
                Debug.LogError("[PlaytestStorySlice] StoryCameraFollow.Instance가 없음 — shake 검증 불가");
                return false;
            }
            float shakeTimer = (float)GetPrivate(cam, "_shakeTimer");
            if (shakeTimer <= 0f)
            {
                Debug.LogError("[PlaytestStorySlice] 공격 직후 카메라 shake가 안 걸림(_shakeTimer<=0)");
                return false;
            }

            var animator = GetPrivate(_storyController, "animator") as Animator;
            if (animator != null && animator.speed != 0f)
            {
                Debug.LogError($"[PlaytestStorySlice] hitstop이 공격 직후 player Animator를 안 멈춤 — speed={animator.speed}");
                return false;
            }

            Debug.Log(animator == null
                ? "[PlaytestStorySlice] hit feedback OK - shake 확인(player Animator는 null, 폴백 캡슐 케이스라 hitstop 검증 스킵)"
                : "[PlaytestStorySlice] hit feedback OK - shake + hitstop(Animator.speed=0) 확인");
            return true;
        }

        /// <summary>PLAN.md 101-3 G "성장 연출"(2026-09-18 STORY 이식) — GO/
        /// DUNGEON `CheckLevelUpCut()`과 같은 결. 호출부(Phase.Init)가
        /// **세션에서 가장 먼저** 부른다 — KillEnemies 단계부터는 잡졸을
        /// 죽일 때마다 `StoryJobState.GainExp()`가 걸려, 나중에 확인하면
        /// 이미 다른 레벨업 컷이 지나갔거나 겹쳤을 수 있다(GO가 실제로
        /// 겪은 함정과 같은 종류).</summary>
        private static bool CheckLevelUpCut()
        {
            var cam = StoryCameraFollow.Instance;
            if (cam == null)
            {
                Debug.LogError("[PlaytestStorySlice] 성장 연출 검증용 StoryCameraFollow를 못 찾음");
                return false;
            }

            var zField = typeof(StoryCameraFollow).GetField("_zDistance", BindingFlags.NonPublic | BindingFlags.Instance);
            float before = (float)zField.GetValue(cam);

            StoryJobState.GainExp(StoryCombat.ExpNeed(StoryJobState.Level) + 1f);

            float after = (float)zField.GetValue(cam);
            if (Mathf.Approximately(after, before))
            {
                Debug.LogError($"[PlaytestStorySlice] 레벨업 직후 카메라 거리(zDistance)가 안 바뀜 — {after}");
                return false;
            }
            Debug.Log($"[PlaytestStorySlice] level-up cut OK - 레벨업 직후 zDistance {before:F2}→{after:F2}");
            return true;
        }

        /// <summary>PLAN.md 101-3 G "지형 반응"(2026-09-18 STORY 이식) — GO
        /// `PlaytestHeadless.CheckGroundDecal()`과 같은 결, "최대 32" 캡이
        /// 지켜지는지 직접 40개를 스폰해 확인한다.</summary>
        private static bool CheckGroundDecalCap()
        {
            for (int i = 0; i < 40; i++)
            {
                StoryGroundDecal.Spawn(Vector3.zero, StoryGroundDecal.Kind.HitMark);
            }
            if (StoryGroundDecal.ActiveCount > 32)
            {
                Debug.LogError($"[PlaytestStorySlice] 지형 데칼 최대 32 캡이 안 지켜짐 — ActiveCount={StoryGroundDecal.ActiveCount}");
                return false;
            }
            Debug.Log($"[PlaytestStorySlice] ground decal cap OK - ActiveCount={StoryGroundDecal.ActiveCount}(≤32)");
            return true;
        }

        /// <summary>PLAN.md 101-3 G "장비 가시화"(2026-09-18, 사용자 선택
        /// "직업별 무기 소켓") — 전직 전엔 맨손(`StoryWeaponVisual.
        /// CurrentWeaponRoot`가 null)이어야 한다. `CheckWeaponVisualAfterJob()`
        /// 과 짝(전/후 비교) — GO `CheckWeaponVisual()`이 등급 전/후 칼날
        /// 크기를 비교하는 것과 같은 결.</summary>
        private static bool CheckWeaponVisualBeforeJob()
        {
            var weaponVisual = Object.FindFirstObjectByType<StoryWeaponVisual>();
            if (weaponVisual == null)
            {
                Debug.LogError("[PlaytestStorySlice] 무기 가시화 검증용 StoryWeaponVisual을 못 찾음");
                return false;
            }
            if (weaponVisual.CurrentWeaponRoot != null)
            {
                Debug.LogError("[PlaytestStorySlice] 전직 전인데 이미 무기가 들려 있음(맨손이어야 함)");
                return false;
            }
            return true;
        }

        /// <summary>전직(무사) 직후 검 모양(자루+칼날 둘)이 실제로 소켓 밑에
        /// 생겼는지 본다.</summary>
        private static bool CheckWeaponVisualAfterJob()
        {
            var weaponVisual = Object.FindFirstObjectByType<StoryWeaponVisual>();
            var root = weaponVisual != null ? weaponVisual.CurrentWeaponRoot : null;
            if (root == null)
            {
                Debug.LogError("[PlaytestStorySlice] 전직(warrior) 후에도 무기가 안 생김");
                return false;
            }
            if (root.childCount < 2)
            {
                Debug.LogError($"[PlaytestStorySlice] 검(무사) 무기에 부품이 모자람 — childCount={root.childCount}(기대≥2, 자루+칼날)");
                return false;
            }
            Debug.Log($"[PlaytestStorySlice] weapon visual OK - 전직(warrior) 후 검 모양 생김(부품 {root.childCount}개)");
            return true;
        }

        /// <summary>2026-09-23 발견 — 에디터 빌드가 `onClick.AddListener`(런타임 전용)로 건
        /// 리스너는 씬 저장 때 안 남아, 저장된 씬의 버튼이 전부 먹통이었다. 지금까지의 진단은
        /// 핸들러를 리플렉션으로 직접 불러 이걸 못 잡았다 — 여기선 **진짜 `Button.onClick`**을
        /// 눌러 본다. 상태를 바꾸는 버튼(교대·저장·무예 칸)은 영속 리스너 수만 본다.</summary>
        private static bool CheckButtonWiring()
        {
            // (a) 공격 버튼 — 눌러서 실제로 공격 쿨다운이 걸리는지.
            var attackButton = GameObject.Find("ActionButton_공격")?.GetComponent<Button>();
            if (attackButton == null) { Debug.LogError("[PlaytestStorySlice] ActionButton_공격 Button 없음"); return false; }
            // 시작 자리 옆 잡졸을 진짜로 베어 KillEnemies의 "잡졸 10" 전제를 깨뜨린 적이 있어
            // (실제로 겪음) 모든 적에게서 멀리 옮겨 누르고 같은 틱 안에 되돌린다.
            Vector3 startPos = _player.position;
            float minEnemyX = float.MaxValue;
            foreach (var e in StoryEnemy.All) minEnemyX = Mathf.Min(minEnemyX, e.transform.position.x);
            TeleportPlayer(new Vector3(minEnemyX - 10f, startPos.y, 0f));
            SetPrivate(_storyController, "_attackCooldownLeft", 0f);
            attackButton.onClick.Invoke();
            TeleportPlayer(startPos);
            if ((float)GetPrivate(_storyController, "_attackCooldownLeft") <= 0f)
            {
                Debug.LogError("[PlaytestStorySlice] 공격 버튼 onClick을 눌러도 공격이 안 나감(리스너가 씬에 안 남음)");
                return false;
            }
            SetPrivate(_storyController, "_attackCooldownLeft", 0f);

            // (b) 씬 빌더가 건 나머지 버튼 — 영속 리스너가 실제로 저장됐는지.
            string[] persistentNames =
            {
                "ActionButton_점프", "ActionButton_횡소", "ActionButton_기탄", "ActionButton_기합",
                "ActionButton_선봉", "ActionButton_유격", "ActionButton_호법", "ActionButton_무예", "ActionButton_소환", "SaveButton",
                "SkillSlot_0", "SkillSlot_1", "SkillSlot_2", "SkillSlot_3",
            };
            foreach (var name in persistentNames)
            {
                var b = GameObject.Find(name)?.GetComponent<Button>();
                if (b == null || b.onClick.GetPersistentEventCount() < 1)
                {
                    Debug.LogError($"[PlaytestStorySlice] {name} 버튼이 없거나 영속 onClick 리스너가 없음");
                    return false;
                }
            }

            // (c) 스스로 UI를 짓는 컴포넌트 — Awake()가 건 리스너로 실제로 열고 닫히는지.
            var settings = Object.FindFirstObjectByType<StorySettingsPanel>();
            var settingsToggle = settings != null ? (Button)GetPrivate(settings, "_toggleButton") : null;
            var settingsClose = settings != null ? (Button)GetPrivate(settings, "_closeButton") : null;
            var settingsPanel = settings != null ? (GameObject)GetPrivate(settings, "_panel") : null;
            if (settingsToggle == null || settingsClose == null || settingsPanel == null)
            {
                Debug.LogError("[PlaytestStorySlice] StorySettingsPanel 버튼 참조가 씬에 안 남음");
                return false;
            }
            settingsToggle.onClick.Invoke();
            bool openedBySettingsButton = settingsPanel.activeSelf;
            settingsClose.onClick.Invoke();
            if (!openedBySettingsButton || settingsPanel.activeSelf)
            {
                Debug.LogError($"[PlaytestStorySlice] 설정 버튼 onClick으로 안 열리거나 안 닫힘 — opened={openedBySettingsButton} stillOpen={settingsPanel.activeSelf}");
                return false;
            }

            var jobUi = Object.FindFirstObjectByType<StoryJobChoiceUi>();
            var jobButtons = jobUi != null ? (Button[])GetPrivate(jobUi, "_jobButtons") : null;
            if (jobButtons == null || jobButtons.Length != StoryCombat.JobOrder.Length)
            {
                Debug.LogError("[PlaytestStorySlice] StoryJobChoiceUi 직업 버튼 참조가 씬에 안 남음");
                return false;
            }
            string chosen = null;
            jobUi.Show("버튼 배선 확인", k => chosen = k);
            jobButtons[1].onClick.Invoke();
            if (chosen != StoryCombat.JobOrder[1] || jobUi.IsShowing)
            {
                Debug.LogError($"[PlaytestStorySlice] 전직 버튼 onClick이 콜백을 안 부르거나 안 닫힘 — chosen={chosen} showing={jobUi.IsShowing}");
                return false;
            }

            var skillUi = StorySkillPanelUi.Instance;
            var skillClose = skillUi != null ? (Button)GetPrivate(skillUi, "_closeButton") : null;
            if (skillClose == null)
            {
                Debug.LogError("[PlaytestStorySlice] StorySkillPanelUi(또는 닫기 버튼 참조)가 씬에 없음");
                return false;
            }
            GameObject.Find("ActionButton_무예").GetComponent<Button>().onClick.Invoke();
            bool openedBySkillButton = skillUi.IsShowing;
            skillClose.onClick.Invoke();
            if (!openedBySkillButton || skillUi.IsShowing)
            {
                Debug.LogError($"[PlaytestStorySlice] 무예 버튼 onClick으로 안 열리거나 닫기 버튼으로 안 닫힘 — opened={openedBySkillButton} stillOpen={skillUi.IsShowing}");
                return false;
            }

            var labyUi = StoryLabyrinthMapUi.Instance;
            var abandon = labyUi != null ? (Button)GetPrivate(labyUi, "_abandonButton") : null;
            var mapPanel = labyUi != null ? (GameObject)GetPrivate(labyUi, "_mapPanel") : null;
            if (abandon == null || mapPanel == null)
            {
                Debug.LogError("[PlaytestStorySlice] StoryLabyrinthMapUi 포기 버튼 참조가 씬에 안 남음");
                return false;
            }
            mapPanel.SetActive(true);
            abandon.onClick.Invoke(); // 회차 밖이라 AbandonRun()은 no-op, Close()만 탄다.
            if (mapPanel.activeSelf)
            {
                Debug.LogError("[PlaytestStorySlice] 비경 포기 버튼 onClick으로 지도가 안 닫힘");
                return false;
            }

            Debug.Log("[PlaytestStorySlice] button wiring OK - real onClick fired for attack/settings/job/skill/labyrinth, persistent listeners saved for the rest");
            return true;
        }

        /// <summary>PLAN.md 101-2 STORY 5-2 1단계(2026-09-23) — 직업 무예·SP. 무사로 막
        /// 전직한 직후 부른다: (a) 데이터 무결성, (b) SP 파생값·찍기·거절 사유, (c) 자동 무예 칸,
        /// (d) 효과 일곱 갈래(근접·범위·돌진·강화·관통·화살·연사, 퇴보사 후퇴) 실제 시전,
        /// (e) 쿨다운·기력 부족 거절, (f) 무예 패널 줄·찍기 버튼 경로.</summary>
        private static bool CheckJobSkills()
        {
            // (a)
            var seen = new System.Collections.Generic.HashSet<string>();
            foreach (var sk in StorySkillData.All)
            {
                if (!seen.Add(sk.Key)) { Debug.LogError($"[PlaytestStorySlice] 무예 키 중복 {sk.Key}"); return false; }
                if (!StoryCombat.TryGetJob(sk.Job, out _)) { Debug.LogError($"[PlaytestStorySlice] 무예 {sk.Key} 직업 {sk.Job} 없음"); return false; }
                if (StorySkillData.GetSchool(sk.School) == null) { Debug.LogError($"[PlaytestStorySlice] 무예 {sk.Key} 유파 {sk.School} 없음"); return false; }
                if (sk.Need != null && (StorySkillData.Get(sk.Need) == null || StorySkillData.Get(sk.Need).School != sk.School))
                {
                    Debug.LogError($"[PlaytestStorySlice] 무예 {sk.Key} 선행 {sk.Need}가 없거나 유파가 다름");
                    return false;
                }
            }
            foreach (var job in StoryCombat.JobOrder)
            {
                int n = StorySkillData.OfJob(job).Count;
                if (n < 5) { Debug.LogError($"[PlaytestStorySlice] {job} 무예 {n}개(기대 ≥5)"); return false; }
            }

            // (b)
            StorySkillState.Restore(null, null);
            int expectTotal = (StoryJobState.Level - 1) * StorySkillState.SpPerLevel;
            if (StorySkillState.SpTotal != expectTotal || StorySkillState.SpLeft != expectTotal || expectTotal < 12)
            {
                Debug.LogError($"[PlaytestStorySlice] SP 파생값 이상 — total={StorySkillState.SpTotal} left={StorySkillState.SpLeft}(기대={expectTotal}, ≥12)");
                return false;
            }
            if (StorySkillState.SlotSkill(0) != null) { Debug.LogError("[PlaytestStorySlice] 안 찍었는데 무예 칸 0이 참"); return false; }
            if (StorySkillState.CanRaise("a_shot") != "skill.why_other_job") { Debug.LogError($"[PlaytestStorySlice] 남의 직업 무예 거절 사유 이상 — {StorySkillState.CanRaise("a_shot")}"); return false; }
            if (!StorySkillState.Raise("w_cut") || StorySkillState.LevelOf("w_cut") != 1 || StorySkillState.SpLeft != expectTotal - 1)
            {
                Debug.LogError($"[PlaytestStorySlice] 참격 찍기 이상 — lv={StorySkillState.LevelOf("w_cut")} left={StorySkillState.SpLeft}");
                return false;
            }
            var wCut = StorySkillData.Get("w_cut");
            StorySkillState.Raise("w_cut");
            StorySkillState.Raise("w_cut");
            if (!Mathf.Approximately(StorySkillState.MulOf(wCut), wCut.MulBase + 2 * wCut.MulPerLevel))
            {
                Debug.LogError($"[PlaytestStorySlice] 참격 Lv.3 배율 이상 — {StorySkillState.MulOf(wCut)}(기대={wCut.MulBase + 2 * wCut.MulPerLevel})");
                return false;
            }
            StorySkillState.Restore(new[] { "w_cut" }, new[] { 10 });
            if (StorySkillState.CanRaise("w_cut") != "skill.why_maxed") { Debug.LogError($"[PlaytestStorySlice] 만렙 거절 사유 이상 — {StorySkillState.CanRaise("w_cut")}"); return false; }
            // 점수를 딱 다 쓴 상태 — 무예 하나 상한이 10이라 여러 무예에 나눠 채운다(w_rush는 남겨 둠).
            string[] fillKeys = { "w_cut", "w_whirl", "w_iron", "w_edge" };
            var fillLevels = new int[fillKeys.Length];
            int remaining = expectTotal;
            for (int i = 0; i < fillKeys.Length && remaining > 0; i++) { fillLevels[i] = Mathf.Min(10, remaining); remaining -= fillLevels[i]; }
            StorySkillState.Restore(fillKeys, fillLevels);
            if (remaining > 0 || StorySkillState.SpLeft != 0 || StorySkillState.CanRaise("w_rush") != "skill.why_no_sp")
            {
                Debug.LogError($"[PlaytestStorySlice] 점수 없음 거절 사유 이상 — left={StorySkillState.SpLeft} why={StorySkillState.CanRaise("w_rush")}");
                return false;
            }

            // (c) 표 순서 자동 배치 — 무사 다섯 중 앞 넷(참격·선풍·돌진·철갑), 파공검은 칸 밖.
            StorySkillState.Restore(new[] { "w_edge", "w_iron", "w_rush", "w_whirl", "w_cut" }, new[] { 1, 1, 1, 1, 1 });
            string[] expectSlots = { "w_cut", "w_whirl", "w_rush", "w_iron" };
            for (int i = 0; i < expectSlots.Length; i++)
            {
                var s = StorySkillState.SlotSkill(i);
                if (s == null || s.Key != expectSlots[i]) { Debug.LogError($"[PlaytestStorySlice] 무예 칸 {i}={s?.Key}(기대={expectSlots[i]})"); return false; }
            }

            // (d) 실제 시전 — facing은 이 테스트 내내 +1(오른쪽).
            var castMethod = typeof(StoryPlayerController).GetMethod("TryCastJobSkill", BindingFlags.NonPublic | BindingFlags.Instance);
            var cds = (System.Collections.Generic.Dictionary<string, float>)GetPrivate(_storyController, "_skillCooldownLeft");

            TeleportPlayer(new Vector3(5f, 0.1f, 0f));
            var meleeDummy = SpawnDummyEnemy(new Vector3(6f, 0.1f, 0f));
            StoryCombat.RestoreMp(StoryCombat.MpMax);
            _storyController.TriggerJobSkill(0); // 참격
            if (!meleeDummy.IsDead || !Mathf.Approximately(StoryCombat.Mp, StoryCombat.MpMax - wCut.Cost) || _storyController.JobSkillCooldownLeft("w_cut") <= 0f)
            {
                Debug.LogError($"[PlaytestStorySlice] 참격(근접) 시전 이상 — dead={meleeDummy.IsDead} mp={StoryCombat.Mp} cd={_storyController.JobSkillCooldownLeft("w_cut")}");
                return false;
            }
            float mpAfterFirst = StoryCombat.Mp;
            _storyController.TriggerJobSkill(0); // 쿨다운 중 — 기력이 안 빠져야 한다.
            if (!Mathf.Approximately(StoryCombat.Mp, mpAfterFirst)) { Debug.LogError("[PlaytestStorySlice] 참격 쿨다운 중인데 또 나감"); return false; }

            var aoeDummy = SpawnDummyEnemy(new Vector3(3.5f, 0.1f, 0f)); // 등 뒤 1.5m — 범위는 앞뒤를 안 가린다.
            StoryCombat.RestoreMp(StoryCombat.MpMax);
            _storyController.TriggerJobSkill(1); // 선풍
            if (!aoeDummy.IsDead) { Debug.LogError("[PlaytestStorySlice] 선풍(범위) 뒤에도 등 뒤 더미가 안 죽음"); return false; }

            float xBeforeDash = _player.position.x;
            var dashDummy = SpawnDummyEnemy(new Vector3(7f, 0.1f, 0f));
            StoryCombat.RestoreMp(StoryCombat.MpMax);
            _storyController.TriggerJobSkill(2); // 돌진
            float dashed = _player.position.x - xBeforeDash;
            if (dashed < 2f || !dashDummy.IsDead)
            {
                Debug.LogError($"[PlaytestStorySlice] 돌진 이상 — 이동={dashed:0.00}m(기대≈{StorySkillData.Get("w_rush").DistM:0.00}) dead={dashDummy.IsDead}");
                return false;
            }

            StoryCombat.RestoreMp(StoryCombat.MpMax);
            _storyController.TriggerJobSkill(3); // 철갑
            var buffAtk = (float)GetPrivate(_storyController, "_buffAtk");
            var buffUntil = (float)GetPrivate(_storyController, "_buffUntilTime");
            if (!Mathf.Approximately(buffAtk, 1.2f) || buffUntil < Time.time + 8.5f)
            {
                Debug.LogError($"[PlaytestStorySlice] 철갑(강화) 이상 — atk={buffAtk}(기대=1.2) until={buffUntil}(now={Time.time})");
                return false;
            }

            int boltsBefore = Object.FindObjectsByType<StoryBolt>(FindObjectsSortMode.None).Length;
            StoryCombat.RestoreMp(StoryCombat.MpMax);
            castMethod.Invoke(_storyController, new object[] { StorySkillData.Get("w_edge") }); // 칸 밖이어도 레벨 1이면 나간다.
            var boltsNow = Object.FindObjectsByType<StoryBolt>(FindObjectsSortMode.None);
            if (boltsNow.Length != boltsBefore + 1) { Debug.LogError($"[PlaytestStorySlice] 파공검(관통) 투사체 수 {boltsNow.Length - boltsBefore}(기대=1)"); return false; }

            // 궁수 무예 — 상태만 궁수 레벨로 채워 투사체 모양(관통 여부·발 수)과 후퇴를 본다.
            StorySkillState.Restore(new[] { "a_shot", "a_double", "a_retreat" }, new[] { 1, 1, 1 });
            cds.Clear();
            int piercingBefore = 0, nonPiercingBefore = 0;
            foreach (var b in Object.FindObjectsByType<StoryBolt>(FindObjectsSortMode.None)) { if (b.Pierce) piercingBefore++; else nonPiercingBefore++; }
            StoryCombat.RestoreMp(StoryCombat.MpMax);
            castMethod.Invoke(_storyController, new object[] { StorySkillData.Get("a_shot") });
            castMethod.Invoke(_storyController, new object[] { StorySkillData.Get("a_double") });
            int nonPiercingNow = 0;
            foreach (var b in Object.FindObjectsByType<StoryBolt>(FindObjectsSortMode.None)) { if (!b.Pierce) nonPiercingNow++; }
            if (nonPiercingNow - nonPiercingBefore != 1 + StorySkillData.Get("a_double").Shots)
            {
                Debug.LogError($"[PlaytestStorySlice] 사격+연사 비관통 투사체 {nonPiercingNow - nonPiercingBefore}(기대={1 + StorySkillData.Get("a_double").Shots})");
                return false;
            }
            float xBeforeRetreat = _player.position.x;
            StoryCombat.RestoreMp(StoryCombat.MpMax);
            castMethod.Invoke(_storyController, new object[] { StorySkillData.Get("a_retreat") });
            if (_player.position.x - xBeforeRetreat > -1f)
            {
                Debug.LogError($"[PlaytestStorySlice] 퇴보사가 뒤로 안 밀림 — Δx={_player.position.x - xBeforeRetreat:0.00}");
                return false;
            }

            // (e) 기력 부족 — 못 쓰고 쿨다운도 안 걸린다. 레벨 0 무예도 못 쓴다.
            cds.Clear();
            StoryCombat.RestoreMp(0f);
            bool castWithoutMp = (bool)castMethod.Invoke(_storyController, new object[] { StorySkillData.Get("a_shot") });
            StoryCombat.RestoreMp(StoryCombat.MpMax);
            bool castLevelZero = (bool)castMethod.Invoke(_storyController, new object[] { StorySkillData.Get("a_eye") });
            if (castWithoutMp || _storyController.JobSkillCooldownLeft("a_shot") > 0f || castLevelZero)
            {
                Debug.LogError($"[PlaytestStorySlice] 거절 이상 — 기력0 시전={castWithoutMp} 레벨0 시전={castLevelZero}");
                return false;
            }

            // (f) 무예 패널 — 무사 줄 수, 찍기 버튼 경로(ClickRaise = 줄 버튼 onClick).
            StorySkillState.Restore(null, null);
            var panel = StorySkillPanelUi.Instance;
            panel.Show();
            int expectRows = StorySkillData.OfJob("warrior").Count;
            if (panel.RowCount != expectRows) { Debug.LogError($"[PlaytestStorySlice] 무예 패널 줄 {panel.RowCount}(기대={expectRows})"); panel.Hide(); return false; }
            panel.ClickRaise("w_rush");
            if (StorySkillState.LevelOf("w_rush") != 1 || panel.RowCount != expectRows)
            {
                Debug.LogError($"[PlaytestStorySlice] 패널 찍기 뒤 레벨={StorySkillState.LevelOf("w_rush")}(기대=1) 줄={panel.RowCount}(다시 그려도 {expectRows}줄이어야 함 — DestroyImmediate)");
                panel.Hide();
                return false;
            }
            panel.Hide();
            cds.Clear();
            SetPrivate(_storyController, "_buffUntilTime", 0f);
            Debug.Log("[PlaytestStorySlice] job skills OK - SP derive/raise/refusals, auto slots, melee/aoe/dash/buff/bolt/arrow/volley/retreat cast, cooldown+mp refusals, panel rows");
            return true;
        }

        /// <summary>PLAN.md 101-2 STORY 5-2 2단계(2026-09-23) — 2차 전직·2차 무예·유파 세트. 무사로
        /// 전직해 CheckJobSkills를 마친 직후 부른다(레벨은 앞 단계 GainExp로 Lv.15 이상):
        /// (a) 전직 막힘 사유 둘(레벨·무예 5), (b) 전직관 ShowPromote → **진짜 선택 버튼 onClick**으로
        /// 장군이 되고 grow가 사슬로 더해지며 무기는 뿌리(검) 그대로, (c) 2차 무예 선행 조건,
        /// (d) 칸 자동 배치(윗자리부터 + 같은 유파 짝 먼저)·세트 판정, (e) 세트 보정 다섯
        /// (피해·범위·강화 지속·발수·dash 재사용 대기)이 실제 시전 값에 실리는지, (f) rain(앞만 맞음),
        /// (g) 패널 줄=사슬 무예 수, (h) 비경 경험치 식·체력 배율, 모르는 직업 키 로드.
        /// 끝나면 장군 상태로 남겨 뒤의 세이브 왕복이 2차 키도 확인하게 한다.</summary>
        private static bool CheckPromotionAndSchools()
        {
            const string T = "[PlaytestStorySlice]";
            int level = StoryJobState.Level;
            float exp = StoryJobState.Exp;
            if (StoryJobState.Job != "warrior" || level < StoryCombat.JobPromoteLevel)
            {
                Debug.LogError($"{T} 2차 전직 검사 전제 이상 — job={StoryJobState.Job} level={level}(기대 ≥{StoryCombat.JobPromoteLevel})");
                return false;
            }

            // (a)
            StorySkillState.Restore(new[] { "w_cut" }, new[] { StoryCombat.JobPromoteSkillLevel - 1 });
            if (StoryJobState.PromoteBlock() != "job.why_skill") { Debug.LogError($"{T} 무예 4인데 막힘 사유={StoryJobState.PromoteBlock()}(기대 job.why_skill)"); return false; }
            StoryJobState.Restore(StoryCombat.JobPromoteLevel - 1, 0f, "warrior");
            StorySkillState.Restore(new[] { "w_cut" }, new[] { StoryCombat.JobPromoteSkillLevel });
            if (StoryJobState.PromoteBlock() != "job.why_level") { Debug.LogError($"{T} Lv.14인데 막힘 사유={StoryJobState.PromoteBlock()}(기대 job.why_level)"); return false; }
            StoryJobState.Restore(level, exp, "warrior");
            if (!StoryJobState.CanPromote || StoryJobState.NextJob != "general") { Debug.LogError($"{T} 조건 채웠는데 전직 불가 — why={StoryJobState.PromoteBlock()} next={StoryJobState.NextJob}"); return false; }

            // (b) 진짜 버튼 — 전직관 → StoryChoiceUi 첫 버튼.
            var trainer = Object.FindFirstObjectByType<StoryJobTrainer>();
            var choice = StoryChoiceUi.Instance;
            var yes = choice != null ? GetPrivate(choice, "optionAButton") as Button : null;
            if (trainer == null || yes == null) { Debug.LogError($"{T} 전직관({trainer != null})·선택 UI 버튼({yes != null}) 없음"); return false; }
            trainer.ShowPromote();
            if (!choice.IsShowing) { Debug.LogError($"{T} ShowPromote()가 선택 UI를 안 띄움"); return false; }
            yes.onClick.Invoke();
            StorySkillPanelUi.Instance?.Hide();
            float expectAtk = StoryCombat.JobsTier1["warrior"].Atk + StoryCombat.JobsTier2["general"].Atk;
            if (StoryJobState.Job != "general" || StoryJobState.Tier != 2 || StoryJobState.Root != "warrior" ||
                !Mathf.Approximately(StoryJobState.AtkBonus, expectAtk) || StoryJobState.NextJob != "marshal" || choice.IsShowing)
            {
                Debug.LogError($"{T} 2차 전직 뒤 상태 이상 — job={StoryJobState.Job} tier={StoryJobState.Tier} root={StoryJobState.Root} atk+={StoryJobState.AtkBonus}(기대={expectAtk}) next={StoryJobState.NextJob} ui={choice.IsShowing}");
                return false;
            }
            var weapon = Object.FindFirstObjectByType<StoryWeaponVisual>();
            if (weapon == null || weapon.CurrentWeaponRoot == null || weapon.CurrentWeaponRoot.childCount < 2)
            {
                Debug.LogError($"{T} 장군 전직 뒤 손에 검이 없음(뿌리 무기 유지 실패)");
                return false;
            }

            // (c) 선행 조건 — 2차 무예는 같은 유파 1차 5가 먼저, 1차 무예도 계속 찍힌다.
            StorySkillState.Restore(new[] { "w_cut" }, new[] { 4 });
            if (StorySkillState.CanRaise("g_smash") != "skill.why_need") { Debug.LogError($"{T} 참격 4인데 패왕격 사유={StorySkillState.CanRaise("g_smash")}"); return false; }
            StorySkillState.Restore(new[] { "w_cut" }, new[] { 5 });
            if (StorySkillState.CanRaise("g_smash") != null || StorySkillState.CanRaise("w_whirl") != null || StorySkillState.CanRaise("s_rain") != "skill.why_other_job")
            {
                Debug.LogError($"{T} 장군 찍기 사유 이상 — 패왕격={StorySkillState.CanRaise("g_smash")} 선풍={StorySkillState.CanRaise("w_whirl")} 전우={StorySkillState.CanRaise("s_rain")}");
                return false;
            }

            // (d) 자동 배치 — 2차 둘 먼저, 남은 두 칸은 그 짝(같은 유파 1차)이 표 순서보다 앞선다.
            StorySkillState.Restore(
                new[] { "w_cut", "w_whirl", "w_rush", "w_iron", "w_edge", "g_smash", "g_edge" },
                new[] { 5, 1, 1, 1, 5, 1, 1 });
            string[] expectSlots = { "g_smash", "g_edge", "w_cut", "w_edge" };
            for (int i = 0; i < expectSlots.Length; i++)
            {
                var s = StorySkillState.SlotSkill(i);
                if (s == null || s.Key != expectSlots[i]) { Debug.LogError($"{T} 장군 무예 칸 {i}={s?.Key}(기대={expectSlots[i]})"); return false; }
            }
            if (StorySkillState.SchoolTier("w_jung") != 2 || StorySkillState.SchoolTier("w_pa") != 2 || StorySkillState.SchoolTier("w_pae") != 0)
            {
                Debug.LogError($"{T} 세트 판정 이상 — 정={StorySkillState.SchoolTier("w_jung")} 파={StorySkillState.SchoolTier("w_pa")} 패={StorySkillState.SchoolTier("w_pae")}(기대 2/2/0)");
                return false;
            }

            // (e) 세트 보정이 실제 시전에 실린다.
            var castMethod = typeof(StoryPlayerController).GetMethod("TryCastJobSkill", BindingFlags.NonPublic | BindingFlags.Instance);
            var cds = (System.Collections.Generic.Dictionary<string, float>)GetPrivate(_storyController, "_skillCooldownLeft");
            cds.Clear();
            TeleportPlayer(new Vector3(5f, 0.1f, 0f));
            StoryCombat.RestoreMp(StoryCombat.MpMaxCurrent);
            _storyController.TriggerJobSkill(0); // 패왕격(정 2세트 → 피해 ×1.15)
            var smash = StorySkillData.Get("g_smash");
            if (_storyController.LastCast.key != "g_smash" || !Mathf.Approximately(_storyController.LastCast.mul, StorySkillState.MulOf(smash) * 1.15f))
            {
                Debug.LogError($"{T} 정 2세트 피해 보정 안 실림 — key={_storyController.LastCast.key} mul={_storyController.LastCast.mul}(기대={StorySkillState.MulOf(smash) * 1.15f})");
                return false;
            }

            if (!CastWithSet(castMethod, cds, "general", new[] { "w_iron", "g_wall" }, "g_wall", out var wall)) return false;
            if (!Mathf.Approximately(wall.buffSec, 11f * 1.15f)) { Debug.LogError($"{T} 수 2세트 철벽 지속={wall.buffSec}(기대={11f * 1.15f})"); return false; }

            int boltsBefore = Object.FindObjectsByType<StoryBolt>(FindObjectsSortMode.None).Length;
            if (!CastWithSet(castMethod, cds, "sniper", new[] { "a_double", "s_split" }, "s_split", out var split)) return false;
            int boltsAdded = Object.FindObjectsByType<StoryBolt>(FindObjectsSortMode.None).Length - boltsBefore;
            if (split.shots != 5 || boltsAdded != 5) { Debug.LogError($"{T} 연 2세트 분시 발수={split.shots}/생긴 투사체={boltsAdded}(기대 5/5)"); return false; }

            if (!CastWithSet(castMethod, cds, "assassin", new[] { "r_step", "x_shadow" }, "x_shadow", out var shadow)) return false;
            if (!Mathf.Approximately(shadow.cooldown, 6f * 0.8f * StoryLabyrinthState.CooldownMul) || shadow.critForce)
            {
                Debug.LogError($"{T} 보 2세트 그림자밟기 재사용={shadow.cooldown}(기대={6f * 0.8f}) 급소확정={shadow.critForce}(2세트엔 false)");
                return false;
            }

            if (!CastWithSet(castMethod, cds, "sage", new[] { "m_bolt", "p_quake" }, "p_quake", out var quake)) return false;
            if (!Mathf.Approximately(quake.radius, StorySkillData.Get("p_quake").RadiusM * 1.15f)) { Debug.LogError($"{T} 진 2세트 지진 반경={quake.radius}"); return false; }

            // 세트가 없으면 보정도 없다(1차 하나만).
            StorySkillState.Restore(new[] { "m_bolt" }, new[] { 5 });
            var none = StorySkillState.BonusOf(StorySkillData.Get("m_bolt"));
            if (none.AoeMul != 1f || none.DmgMul != 1f || none.ShotsAdd != 0) { Debug.LogError($"{T} 세트 없는데 보정이 붙음"); return false; }

            // (f) rain — 앞 띠만 맞고 등 뒤는 안 맞는다.
            StoryJobState.Restore(level, exp, "sniper");
            StorySkillState.Restore(new[] { "s_rain" }, new[] { 1 });
            cds.Clear();
            TeleportPlayer(new Vector3(5f, 0.1f, 0f));
            SetPrivate(_storyController, "_facing", 1f);
            var front = SpawnDummyEnemy(new Vector3(8f, 0.1f, 0f));
            var behind = SpawnDummyEnemy(new Vector3(3f, 0.1f, 0f));
            StoryCombat.RestoreMp(StoryCombat.MpMaxCurrent);
            castMethod.Invoke(_storyController, new object[] { StorySkillData.Get("s_rain") });
            if (!front.IsDead || behind.IsDead) { Debug.LogError($"{T} 전우 판정 이상 — 앞 더미 죽음={front.IsDead} 뒤 더미 죽음={behind.IsDead}"); return false; }
            if (!behind.IsDead) Object.Destroy(behind.gameObject);

            // (g) 패널 — 3단계(차수 탭)부터 한 번에 한 차수만: 열면 지금 자리(2차) 탭, 1차 탭으로 바꾸면 무사 줄.
            StoryJobState.Restore(level, exp, "general");
            StorySkillState.Restore(null, null);
            var panel = StorySkillPanelUi.Instance;
            panel.Show();
            int rows2 = panel.RowCount, tab2 = panel.CurrentTab, tabs = panel.TabCount;
            panel.SelectTab(1);
            int rows1 = panel.RowCount;
            panel.Hide();
            if (tab2 != 2 || tabs != 2 || rows2 != StorySkillData.OfJob("general").Count || rows1 != StorySkillData.OfJob("warrior").Count)
            {
                Debug.LogError($"{T} 장군 무예 패널 — 탭 {tabs}개·연 탭 {tab2}(기대 2/2) 2차 줄 {rows2}(기대={StorySkillData.OfJob("general").Count}) 1차 줄 {rows1}(기대={StorySkillData.OfJob("warrior").Count})");
                return false;
            }

            // (h) 비경 경험치 식(lv=1은 옛 고정값과 같다)·체력 배율·모르는 직업 키.
            if (StoryCombat.EnemyExp(1, false) != StoryCombat.GruntExp || StoryCombat.EnemyExp(1, true) != StoryCombat.BossExp ||
                StoryCombat.EnemyExp(15, false) != 66f || StoryCombat.EnemyExp(15, true) != 990f)
            {
                Debug.LogError($"{T} 적 경험치 식 이상 — lv1={StoryCombat.EnemyExp(1, false)}/{StoryCombat.EnemyExp(1, true)} lv15={StoryCombat.EnemyExp(15, false)}/{StoryCombat.EnemyExp(15, true)}");
                return false;
            }
            float expectHpMul = (StoryCombat.StartAtk + StoryJobState.AtkBonus + StoryLabyrinthState.MemoryAtkBonus) / StoryCombat.StartAtk;
            if (!Mathf.Approximately(StoryLabyrinthRunner.PlayerPowerHpMul(), expectHpMul) || expectHpMul <= 1f)
            {
                Debug.LogError($"{T} 비경 체력 배율={StoryLabyrinthRunner.PlayerPowerHpMul()}(기대={expectHpMul}, >1)");
                return false;
            }
            StoryJobState.Restore(level, exp, "no_such_job");
            bool unknownOk = StoryJobState.Job == StoryJobState.NoJob;
            StoryJobState.Restore(level, exp, "general");
            if (!unknownOk) { Debug.LogError($"{T} 모르는 직업 키가 무명으로 안 돌아감"); return false; }

            StorySkillState.Restore(null, null);
            cds.Clear();
            SetPrivate(_storyController, "_buffUntilTime", 0f);
            Debug.Log("[PlaytestStorySlice] promotion + schools OK - 2차 전직(진짜 버튼)·선행·칸 배치·세트 5종(피해/지속/발수/재사용/반경)·전우·패널·비경 식");
            return true;
        }

        /// <summary>PLAN.md 101-2 STORY 5-2 3단계(2026-09-23) — 3·4차 전직과 무예 칸 고정. 장군 상태로
        /// CheckPromotionAndSchools를 마친 직후 부른다:
        /// (a) 3차 막힘 사유(Lv.20·2차 무예 8)와 사유 숫자 → 진짜 버튼으로 원수(grow 세 자리 합),
        /// (b) 4차 막힘 사유(Lv.25·3차 무예 10) → 진짜 버튼으로 전신, 더 오를 자리 없음, 무기는 뿌리(검),
        /// (c) 자동 배치만이면 4차 무예 넷(유파 전부 다름, 세트 0) — 3단계 칸 고정을 넣은 이유,
        /// (d) 칸 고정: 패널 "칸" 버튼 경로로 안 익힌 무예 거절·다섯째 거절·풀기 당김·고정 하나 + 자동 짝,
        /// (e) 정(正) 4세트(1~4차 고정) → 파멸격 피해 ×1.35가 실제 시전에, 보(步) 4세트 → 명계보
        ///     급소 확정 + 재사용 ×0.8, 무사 질(疾)은 무예 셋뿐이라 4세트 불가,
        /// (f) 패널 탭 넷·지금 자리 탭·칸 줄 글자, (g) 3·4차 무예 선행이 사슬 안에 있는지.
        /// 끝나면 전신 상태(레벨은 원래대로)로 남겨 뒤의 세이브 왕복이 4차 키와 칸 고정을 확인하게 한다.</summary>
        private static bool CheckUpperTiersAndPins()
        {
            const string T = "[PlaytestStorySlice]";
            int level = StoryJobState.Level;
            float exp = StoryJobState.Exp;
            var trainer = Object.FindFirstObjectByType<StoryJobTrainer>();
            var choice = StoryChoiceUi.Instance;
            var yes = choice != null ? GetPrivate(choice, "optionAButton") as Button : null;
            if (StoryJobState.Job != "general" || trainer == null || yes == null)
            {
                Debug.LogError($"{T} 3·4차 검사 전제 이상 — job={StoryJobState.Job}(기대 general) 전직관={trainer != null} 버튼={yes != null}");
                return false;
            }

            // (a) 3차 — 원수.
            StoryJobState.Restore(StoryCombat.JobPromoteLevel3 - 1, 0f, "general");
            StorySkillState.Restore(new[] { "w_cut", "g_smash" }, new[] { 5, StoryCombat.JobPromoteSkillLevel3 });
            if (StoryJobState.PromoteBlock() != "job.why_level" || StoryJobState.PromoteLevelNeeded != 20 || StoryJobState.NextJob != "marshal")
            {
                Debug.LogError($"{T} 장군 Lv.19 사유={StoryJobState.PromoteBlock()} 요구 Lv={StoryJobState.PromoteLevelNeeded}(기대 why_level/20) next={StoryJobState.NextJob}");
                return false;
            }
            StoryJobState.Restore(StoryCombat.JobPromoteLevel3, 0f, "general");
            StorySkillState.Restore(new[] { "w_cut", "g_smash" }, new[] { 10, StoryCombat.JobPromoteSkillLevel3 - 1 });
            if (StoryJobState.PromoteBlock() != "job.why_skill" || StoryJobState.PromoteSkillLevelNeeded != 8)
            {
                // 1차 무예(참격 10)는 안 센다 — 웹판 canJoin()도 바로 아랫자리(장군) 무예만 본다.
                Debug.LogError($"{T} 패왕격 7인데 사유={StoryJobState.PromoteBlock()} 요구={StoryJobState.PromoteSkillLevelNeeded}(기대 why_skill/8)");
                return false;
            }
            StorySkillState.Restore(new[] { "w_cut", "g_smash" }, new[] { 5, StoryCombat.JobPromoteSkillLevel3 });
            trainer.ShowPromote();
            if (!choice.IsShowing) { Debug.LogError($"{T} 3차 ShowPromote()가 선택 UI를 안 띄움"); return false; }
            yes.onClick.Invoke();
            StorySkillPanelUi.Instance?.Hide();
            float atk3 = StoryCombat.JobsTier1["warrior"].Atk + StoryCombat.JobsTier2["general"].Atk + StoryCombat.JobsTier3["marshal"].Atk;
            if (StoryJobState.Job != "marshal" || StoryJobState.Tier != 3 || StoryJobState.Root != "warrior" ||
                !Mathf.Approximately(StoryJobState.AtkBonus, atk3) || StoryJobState.NextJob != "warlord")
            {
                Debug.LogError($"{T} 3차 전직 뒤 — job={StoryJobState.Job} tier={StoryJobState.Tier} root={StoryJobState.Root} atk+={StoryJobState.AtkBonus}(기대={atk3}) next={StoryJobState.NextJob}");
                return false;
            }

            // (b) 4차 — 전신(3차 무예 하나를 10, 만렙).
            StoryJobState.Restore(StoryCombat.JobPromoteLevel4 - 1, 0f, "marshal");
            StorySkillState.Restore(new[] { "w_cut", "g_smash", "n_heaven" }, new[] { 5, 5, 10 });
            if (StoryJobState.PromoteBlock() != "job.why_level" || StoryJobState.PromoteLevelNeeded != 25)
            {
                Debug.LogError($"{T} 원수 Lv.24 사유={StoryJobState.PromoteBlock()} 요구 Lv={StoryJobState.PromoteLevelNeeded}(기대 why_level/25)");
                return false;
            }
            StoryJobState.Restore(StoryCombat.JobPromoteLevel4, 0f, "marshal");
            StorySkillState.Restore(new[] { "w_cut", "g_smash", "n_heaven" }, new[] { 5, 5, 9 });
            if (StoryJobState.PromoteBlock() != "job.why_skill" || StoryJobState.PromoteSkillLevelNeeded != 10)
            {
                Debug.LogError($"{T} 천붕격 9인데 사유={StoryJobState.PromoteBlock()} 요구={StoryJobState.PromoteSkillLevelNeeded}(기대 why_skill/10)");
                return false;
            }
            StorySkillState.Restore(new[] { "w_cut", "g_smash", "n_heaven" }, new[] { 5, 5, 10 });
            trainer.ShowPromote();
            if (!choice.IsShowing) { Debug.LogError($"{T} 4차 ShowPromote()가 선택 UI를 안 띄움"); return false; }
            yes.onClick.Invoke();
            StorySkillPanelUi.Instance?.Hide();
            float atk4 = atk3 + StoryCombat.JobsTier4["warlord"].Atk;
            var weapon = Object.FindFirstObjectByType<StoryWeaponVisual>();
            if (StoryJobState.Job != "warlord" || StoryJobState.Tier != 4 || StoryJobState.Root != "warrior" ||
                !Mathf.Approximately(StoryJobState.AtkBonus, atk4) || StoryJobState.NextJob != null ||
                StoryJobState.PromoteBlock() != "job.why_no_next" || weapon == null || weapon.CurrentWeaponRoot == null || weapon.CurrentWeaponRoot.childCount < 2)
            {
                Debug.LogError($"{T} 4차 전직 뒤 — job={StoryJobState.Job} tier={StoryJobState.Tier} root={StoryJobState.Root} atk+={StoryJobState.AtkBonus}(기대={atk4}) next={StoryJobState.NextJob} why={StoryJobState.PromoteBlock()} 검={weapon != null && weapon.CurrentWeaponRoot != null && weapon.CurrentWeaponRoot.childCount >= 2}");
                return false;
            }

            // (c) 자동 배치만이면 4차 무예 넷이 칸을 다 차지해 세트가 하나도 안 켜진다.
            string[] learned = { "w_cut", "w_whirl", "w_rush", "w_edge", "g_smash", "g_roar", "g_edge",
                "n_heaven", "n_quake", "n_charge", "n_edge", "o_ruin", "o_tremor", "o_smite", "o_edge" };
            int[] lvls = { 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1 };
            StorySkillState.Restore(learned, lvls);
            string[] autoSlots = { "o_ruin", "o_tremor", "o_smite", "o_edge" };
            for (int i = 0; i < autoSlots.Length; i++)
            {
                var s = StorySkillState.SlotSkill(i);
                if (s == null || s.Key != autoSlots[i]) { Debug.LogError($"{T} 전신 자동 칸 {i}={s?.Key}(기대={autoSlots[i]})"); return false; }
            }
            if (StorySkillState.SchoolTier("w_jung") != 0 || StorySkillState.SchoolTier("w_pa") != 0)
            {
                Debug.LogError($"{T} 자동 배치에서 세트가 켜짐 — 정={StorySkillState.SchoolTier("w_jung")} 파={StorySkillState.SchoolTier("w_pa")}");
                return false;
            }

            // (d) 칸 고정 — 패널 "칸" 버튼과 같은 경로(ClickPin).
            var panel = StorySkillPanelUi.Instance;
            panel.Show();
            panel.ClickPin("w_iron"); // 안 익힘
            if (StorySkillState.PinCount != 0) { Debug.LogError($"{T} 안 익힌 철갑이 고정됨"); panel.Hide(); return false; }
            panel.ClickPin("w_cut");
            // 참격 하나만 고정 → 칸0=참격, 남은 칸은 자동(4차부터, 같은 유파 파멸격이 먼저).
            string[] onePin = { "w_cut", "o_ruin", "o_tremor", "o_smite" };
            for (int i = 0; i < onePin.Length; i++)
            {
                var s = StorySkillState.SlotSkill(i);
                if (s == null || s.Key != onePin[i]) { Debug.LogError($"{T} 고정 하나 뒤 칸 {i}={s?.Key}(기대={onePin[i]})"); panel.Hide(); return false; }
            }
            if (StorySkillState.SchoolTier("w_jung") != 2) { Debug.LogError($"{T} 참격 고정으로 정 2세트가 안 켜짐({StorySkillState.SchoolTier("w_jung")})"); panel.Hide(); return false; }
            panel.ClickPin("g_smash");
            panel.ClickPin("n_heaven");
            panel.ClickPin("o_ruin");
            panel.ClickPin("o_edge"); // 다섯째 — 거절
            if (StorySkillState.PinCount != 4 || StorySkillState.PinIndex("o_edge") >= 0 || StorySkillState.SchoolTier("w_jung") != 4)
            {
                Debug.LogError($"{T} 고정 넷 — 수={StorySkillState.PinCount}(기대 4) 파천검 고정={StorySkillState.PinIndex("o_edge")}(기대 -1) 정 세트={StorySkillState.SchoolTier("w_jung")}(기대 4)");
                panel.Hide();
                return false;
            }
            string slotsText = panel.SlotsText;
            if (!slotsText.Contains(StoryLocalization.T("skill.o_ruin", "파멸격").Split('(')[0]) || panel.TabCount != 4 || panel.CurrentTab != 4 || panel.RowCount != StorySkillData.OfJob("warlord").Count)
            {
                Debug.LogError($"{T} 전신 패널 — 칸 줄=\"{slotsText}\" 탭 {panel.TabCount}(기대 4) 연 탭 {panel.CurrentTab}(기대 4) 줄 {panel.RowCount}(기대={StorySkillData.OfJob("warlord").Count})");
                panel.Hide();
                return false;
            }
            panel.ClickPin("g_smash"); // 풀기 — 뒤의 고정이 당겨진다
            if (StorySkillState.PinIndex("n_heaven") != 1 || StorySkillState.PinIndex("o_ruin") != 2 || StorySkillState.PinCount != 3)
            {
                Debug.LogError($"{T} 고정 풀기 뒤 당김 — 천붕격={StorySkillState.PinIndex("n_heaven")}(기대 1) 파멸격={StorySkillState.PinIndex("o_ruin")}(기대 2)");
                panel.Hide();
                return false;
            }
            panel.Hide();

            // (e) 4세트가 실제 시전에 실린다.
            var castMethod = typeof(StoryPlayerController).GetMethod("TryCastJobSkill", BindingFlags.NonPublic | BindingFlags.Instance);
            var cds = (System.Collections.Generic.Dictionary<string, float>)GetPrivate(_storyController, "_skillCooldownLeft");
            StorySkillState.Restore(learned, lvls, new[] { "w_cut", "g_smash", "n_heaven", "o_ruin" });
            cds.Clear();
            TeleportPlayer(new Vector3(5f, 0.1f, 0f));
            StoryCombat.RestoreMp(StoryCombat.MpMaxCurrent);
            _storyController.TriggerJobSkill(3); // 칸3 = 파멸격
            var ruin = StorySkillData.Get("o_ruin");
            if (_storyController.LastCast.key != "o_ruin" || !Mathf.Approximately(_storyController.LastCast.mul, StorySkillState.MulOf(ruin) * 1.35f))
            {
                Debug.LogError($"{T} 정 4세트 — key={_storyController.LastCast.key} mul={_storyController.LastCast.mul}(기대={StorySkillState.MulOf(ruin) * 1.35f})");
                return false;
            }
            int jilCount = 0;
            foreach (var sk in StorySkillData.All) if (sk.School == "w_jil") jilCount++;
            if (jilCount != 3) { Debug.LogError($"{T} 무사 질(疾) 무예 {jilCount}개(기대 3 — 2차가 없어 4세트 불가, 웹판 그대로)"); return false; }

            StoryJobState.Restore(StoryCombat.JobPromoteLevel4, 0f, "reaper");
            StorySkillState.Restore(new[] { "r_step", "x_shadow", "v_void", "d_veil" }, new[] { 5, 5, 5, 1 },
                new[] { "r_step", "x_shadow", "v_void", "d_veil" });
            cds.Clear();
            TeleportPlayer(new Vector3(5f, 0.1f, 0f));
            StoryCombat.RestoreMp(StoryCombat.MpMaxCurrent);
            bool veilOk = (bool)castMethod.Invoke(_storyController, new object[] { StorySkillData.Get("d_veil") });
            var veil = _storyController.LastCast;
            if (!veilOk || veil.key != "d_veil" || !veil.critForce || !Mathf.Approximately(veil.cooldown, 8f * 0.8f * StoryLabyrinthState.CooldownMul))
            {
                Debug.LogError($"{T} 보 4세트 명계보 — ok={veilOk} 급소확정={veil.critForce}(기대 true) 재사용={veil.cooldown}(기대={8f * 0.8f})");
                return false;
            }

            // (g) 3·4차 무예 — 선행이 자기 사슬의 아랫자리 무예인지, 차수 4 무예는 자리 넷 모두에.
            foreach (var sk in StorySkillData.All)
            {
                if (sk.Tier < 3) continue;
                var pre = StorySkillData.Get(sk.Need);
                if (pre == null || pre.Tier >= sk.Tier || StoryJobState.RootOf(pre.Job) != StoryJobState.RootOf(sk.Job))
                {
                    Debug.LogError($"{T} {sk.Key}(차수 {sk.Tier}) 선행 {sk.Need}가 없거나 사슬 밖/같은 차수");
                    return false;
                }
            }
            foreach (var key in StoryCombat.JobsTier4.Keys)
            {
                if (StorySkillData.OfJob(key).Count < 5) { Debug.LogError($"{T} 4차 {key} 무예 {StorySkillData.OfJob(key).Count}개(기대 ≥5)"); return false; }
            }

            StoryJobState.Restore(level, exp, "warlord");
            StorySkillState.Restore(null, null);
            cds.Clear();
            SetPrivate(_storyController, "_buffUntilTime", 0f);
            Debug.Log("[PlaytestStorySlice] upper tiers + pins OK - 3·4차 전직(진짜 버튼·Lv.20/25·무예 8/10)·자동 칸 세트 0·칸 고정(거절/당김/자동 짝)·정 4세트·보 4세트 급소확정·차수 탭");
            return true;
        }

        /// <summary>PLAN.md 101-3 G(2026-09-23, 웹판 jobLook 이식) — 전직 차수마다 옷 빛깔. 무명 0 →
        /// 1차 0.12 → 2차 0.24 → 4차 0.48, 갈래가 바뀌면 색도 바뀌고, 첫 옷 슬롯 색 = 원래 색과 갈래 색의
        /// 섞임, 피부 재질이 있으면 건너뛴다(Maria), 무명으로 돌리면 원래 색. 끝나면 전신 상태로 되돌린다.</summary>
        private static bool CheckOutfitTint()
        {
            const string T = "[PlaytestStorySlice]";
            var tint = Object.FindFirstObjectByType<StoryOutfitTint>();
            if (tint == null) { Debug.LogError($"{T} 플레이어에 StoryOutfitTint가 없음(씬 재빌드 필요?)"); return false; }
            int level = StoryJobState.Level;
            float exp = StoryJobState.Exp;
            string job = StoryJobState.Job;

            StoryJobState.Restore(level, exp, StoryJobState.NoJob);
            var original = tint.FirstTintedColor();
            if (tint.CurrentMix != 0f || original == null) { Debug.LogError($"{T} 무명 옷 — mix={tint.CurrentMix}(기대 0) 옷 슬롯={original != null}"); return false; }

            (string key, int tier, string root)[] steps = { ("warrior", 1, "warrior"), ("general", 2, "warrior"), ("warlord", 4, "warrior"), ("reaper", 4, "rogue") };
            foreach (var (key, tier, root) in steps)
            {
                StoryJobState.Restore(level, exp, key); // JobChosen → Refresh
                float mix = Mathf.Min(StoryOutfitTint.TintMax, tier * StoryOutfitTint.TintPerTier);
                var expect = Color.Lerp(original.Value, StoryOutfitTint.BranchColor(root), mix);
                var got = tint.FirstTintedColor();
                if (!Mathf.Approximately(tint.CurrentMix, mix) || tint.TintedSlots < 1 || got == null ||
                    Mathf.Abs(got.Value.r - expect.r) > 0.002f || Mathf.Abs(got.Value.g - expect.g) > 0.002f || Mathf.Abs(got.Value.b - expect.b) > 0.002f)
                {
                    Debug.LogError($"{T} {key} 옷 — mix={tint.CurrentMix}(기대 {mix}) 옷 슬롯={tint.TintedSlots} 색={got}(기대 {expect})");
                    return false;
                }
            }
            bool hasSkin = false;
            foreach (var r in _storyController.Visual.GetComponentsInChildren<Renderer>(true))
                foreach (var m in r.sharedMaterials)
                    if (m != null && m.name.IndexOf("Skin", System.StringComparison.OrdinalIgnoreCase) >= 0) hasSkin = true;
            if (hasSkin && tint.SkippedSkinSlots < 1) { Debug.LogError($"{T} 피부 재질이 있는데 건너뛴 슬롯 0 — 피부까지 물듦"); return false; }

            StoryJobState.Restore(level, exp, StoryJobState.NoJob);
            var back = tint.FirstTintedColor();
            StoryJobState.Restore(level, exp, job);
            if (back == null || back.Value != original.Value) { Debug.LogError($"{T} 무명으로 돌려도 옷 색이 안 돌아옴 — {back}(기대 {original})"); return false; }
            Debug.Log($"[PlaytestStorySlice] outfit tint OK - 무명 0·1차 0.12·2차 0.24·4차 0.48, 갈래 색, 피부 {tint.SkippedSkinSlots}슬롯 제외(Maria={hasSkin}), 되돌림");
            return true;
        }

        /// <summary>`job`으로 두고 `keys`(1차 5 + 2차 1)를 찍어 `cast`를 쏜 뒤 LastCast를 돌려준다.</summary>
        private static bool CastWithSet(MethodInfo castMethod, System.Collections.Generic.Dictionary<string, float> cds,
            string job, string[] keys, string cast,
            out (string key, float mul, float radius, int shots, float buffSec, float cooldown, bool critForce) last)
        {
            StoryJobState.Restore(StoryJobState.Level, StoryJobState.Exp, job);
            StorySkillState.Restore(keys, new[] { 5, 1 });
            cds.Clear();
            TeleportPlayer(new Vector3(5f, 0.1f, 0f));
            StoryCombat.RestoreMp(StoryCombat.MpMaxCurrent);
            bool ok = (bool)castMethod.Invoke(_storyController, new object[] { StorySkillData.Get(cast) });
            last = _storyController.LastCast;
            if (!ok || last.key != cast)
            {
                Debug.LogError($"[PlaytestStorySlice] {job} {cast} 시전 실패(ok={ok} last={last.key}) — 세트 {string.Join("+", keys)}");
                return false;
            }
            return true;
        }

        private static void Fail()
        {
            _hadError = true;
            EditorApplication.update -= Tick;
            EditorApplication.isPlaying = false;
        }

        /// <summary>PLAN.md 67~69장 "접근성"(2026-09-14) — GO
        /// `PlaytestHeadless.CheckSettingsPanel()`과 같은 결. 이 파일은
        /// 새 Phase를 안 늘리고 Init 안에서 한 번만 부른다(다단계 Phase
        /// 머신에 끼워 넣는 비용을 피한다 — 디버그 오버레이 확장 때와
        /// 같은 판단, docs/PROJECT_STATE.md 참고).</summary>
        private static bool CheckSettingsPanel()
        {
            var panel = Object.FindFirstObjectByType<StorySettingsPanel>();
            if (panel == null)
            {
                Debug.LogError("[PlaytestStorySlice] StorySettingsPanel 컴포넌트를 못 찾음");
                return false;
            }

            var panelGoField = typeof(StorySettingsPanel).GetField("_panel", BindingFlags.NonPublic | BindingFlags.Instance);
            var panelGo = panelGoField.GetValue(panel) as GameObject;
            if (panelGo == null)
            {
                Debug.LogError("[PlaytestStorySlice] StorySettingsPanel._panel이 null — 씬 재로드 후 참조가 안 살아남음");
                return false;
            }

            var toggleMethod = typeof(StorySettingsPanel).GetMethod("TogglePanel", BindingFlags.NonPublic | BindingFlags.Instance);
            toggleMethod.Invoke(panel, null); // 열기 — 여기서 NRE가 나면 그대로 테스트 실패로 드러난다.
            if (!panelGo.activeSelf)
            {
                Debug.LogError("[PlaytestStorySlice] TogglePanel() 호출 후에도 설정 패널이 안 열림");
                return false;
            }
            toggleMethod.Invoke(panel, null); // 닫기
            if (panelGo.activeSelf)
            {
                Debug.LogError("[PlaytestStorySlice] TogglePanel() 두 번째 호출 후에도 설정 패널이 안 닫힘");
                return false;
            }

            var sfxValueLabelField = typeof(StorySettingsPanel).GetField("_sfxValueLabel", BindingFlags.NonPublic | BindingFlags.Instance);
            var sfxValueLabel = sfxValueLabelField.GetValue(panel) as TextMeshProUGUI;
            if (sfxValueLabel == null)
            {
                Debug.LogError("[PlaytestStorySlice] StorySettingsPanel._sfxValueLabel이 null");
                return false;
            }

            bool sfxBefore = StorySettingsState.SfxOn;
            var chooseSfxMethod = typeof(StorySettingsPanel).GetMethod("ChooseSfx", BindingFlags.NonPublic | BindingFlags.Instance);
            chooseSfxMethod.Invoke(panel, null); // 실제 버튼 핸들러 — 상태를 뒤집고 Refresh()까지 그대로 탄다.
            string expectedText = StoryLocalization.T(StorySettingsState.SfxOn ? "state.on" : "state.off");
            if (StorySettingsState.SfxOn == sfxBefore || sfxValueLabel.text != expectedText)
            {
                Debug.LogError($"[PlaytestStorySlice] ChooseSfx() 이후 라벨이 실제로 안 바뀜 text=\"{sfxValueLabel.text}\"(기대=\"{expectedText}\")");
                return false;
            }
            chooseSfxMethod.Invoke(panel, null); // 원상복귀

            bool vibBefore = StorySettingsState.VibrationOn;
            StorySettingsState.VibrationOn = !vibBefore;
            if (StorySettingsState.VibrationOn == vibBefore)
            {
                Debug.LogError("[PlaytestStorySlice] 진동 토글이 안 바뀜");
                return false;
            }

            StorySettingsState.UiScaleMultiplier = 1.15f;
            var scaler = Saga.Core.SagaUi.FirstGameScaler(); // Ⅱ 단추 등 메뉴 캔버스는 뺀다(110 ⑤c)
            float expected = Saga.Core.SagaUi.GameReference.x / 1.15f; // 110 ⑤b 기준 1600×900
            if (scaler == null || Mathf.Abs(scaler.referenceResolution.x - expected) > 1f)
            {
                Debug.LogError($"[PlaytestStorySlice] UI 크기가 캔버스에 안 먹음 — got={(scaler == null ? "null" : scaler.referenceResolution.x.ToString())}");
                return false;
            }
            StorySettingsState.UiScaleMultiplier = 1f;

            StorySettingsState.HighGraphicsQuality = false;
            if (!Mathf.Approximately(QualitySettings.shadowDistance, 15f) || QualitySettings.antiAliasing != 0)
            {
                Debug.LogError($"[PlaytestStorySlice] 그래픽 품질(절약)이 QualitySettings에 안 먹음 — shadowDistance={QualitySettings.shadowDistance} aa={QualitySettings.antiAliasing}");
                return false;
            }
            StorySettingsState.HighGraphicsQuality = true;

            string langBefore = StoryLocalization.CurrentLanguage;
            string qualityLabelBefore = StorySettingsState.GraphicsQualityLabel();
            StoryLocalization.CycleLanguage();
            if (StoryLocalization.CurrentLanguage == langBefore
                || StorySettingsState.GraphicsQualityLabel() == qualityLabelBefore)
            {
                Debug.LogError("[PlaytestStorySlice] 언어 전환이 실제 문구를 안 바꿈");
                return false;
            }
            StoryLocalization.CurrentLanguage = langBefore;

            Debug.Log("[PlaytestStorySlice] settings panel OK - sfx/vibration/ui-scale/graphics-quality/language all verified");
            return true;
        }

        /// <summary>PLAN.md 67~69장 "Localization" 2차(2026-09-14) — StoryHud의
        /// MP 표시가 실제로 영어 문구를 보여주는지 본다.</summary>
        private static bool CheckPlayerHudLocalization()
        {
            var hudGo = GameObject.Find("StoryHudUI");
            var hud = hudGo != null ? hudGo.GetComponent<StoryHud>() : null;
            var label = hudGo != null ? hudGo.GetComponentInChildren<TextMeshProUGUI>() : null;
            if (hud == null || label == null)
            {
                Debug.LogError("[PlaytestStorySlice] StoryHudUI/Label을 못 찾음");
                return false;
            }

            string langBefore = StoryLocalization.CurrentLanguage;
            var method = typeof(StoryHud).GetMethod("Refresh", BindingFlags.NonPublic | BindingFlags.Instance);

            StoryLocalization.CurrentLanguage = "en";
            method.Invoke(hud, null);
            if (!label.text.Contains("MP"))
            {
                Debug.LogError($"[PlaytestStorySlice] StoryHud 영어 전환이 안 먹음 text=\"{label.text}\"");
                StoryLocalization.CurrentLanguage = langBefore;
                return false;
            }
            StoryLocalization.CurrentLanguage = langBefore;
            method.Invoke(hud, null);

            Debug.Log("[PlaytestStorySlice] player hud localization OK");
            return true;
        }

        /// <summary>2026-09-15 "모바일 액션 버튼 언어 전환 반응" —
        /// `LocalizedButtonLabel`(폴링, Update()는 private이라 리플렉션)이
        /// 실제로 씬 빌드 시점 이후에도 언어를 따라가는지 본다.</summary>
        private static bool CheckActionButtonLocalization()
        {
            var go = GameObject.Find("ActionButton_공격");
            var localized = go != null ? go.GetComponent<LocalizedButtonLabel>() : null;
            var label = go != null ? go.GetComponentInChildren<TextMeshProUGUI>() : null;
            if (localized == null || label == null)
            {
                Debug.LogError("[PlaytestStorySlice] ActionButton_공격/LocalizedButtonLabel을 못 찾음");
                return false;
            }

            string langBefore = StoryLocalization.CurrentLanguage;
            var method = typeof(LocalizedButtonLabel).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);

            StoryLocalization.CurrentLanguage = "en";
            method.Invoke(localized, null);
            if (label.text != "Attack")
            {
                Debug.LogError($"[PlaytestStorySlice] 액션 버튼 영어 전환이 안 먹음 text=\"{label.text}\"(기대=Attack)");
                StoryLocalization.CurrentLanguage = langBefore;
                return false;
            }
            StoryLocalization.CurrentLanguage = langBefore;
            method.Invoke(localized, null);
            if (label.text != (langBefore == "en" ? "Attack" : "공격"))
            {
                Debug.LogError($"[PlaytestStorySlice] 액션 버튼이 원래 언어로 안 돌아옴 text=\"{label.text}\"(기대=공격)");
                return false;
            }

            Debug.Log("[PlaytestStorySlice] action button localization OK");
            return true;
        }

        /// <summary>PLAN.md 101-2 "공통 선행" A·B(STORY 네 번째 이식) —
        /// `PlaytestHeadless.CheckGoalBoardAndSessionCard()`(GO)·DUNGEON·
        /// FOREST 버전과 같은 기준, 이 파일의 bool-반환 관례에 맞춰 옮김 —
        /// GoalBoard 세 줄이 실제로 채워지는지, Awake()의 IGoalSource 자동
        /// 재탐색이 동작하는지, SessionCard 가 뜨고 스스로 닫히는지를
        /// 직접 확인한다.</summary>
        private static bool CheckGoalBoardAndSessionCard()
        {
            var board = Object.FindFirstObjectByType<GoalBoard>();
            if (board == null)
            {
                Debug.LogError("[PlaytestStorySlice] GoalBoard 컴포넌트를 못 찾음");
                return false;
            }

            var sourceField = typeof(GoalBoard).GetField("_source", BindingFlags.NonPublic | BindingFlags.Instance);
            if (sourceField.GetValue(board) == null)
            {
                Debug.LogError("[PlaytestStorySlice] GoalBoard._source가 null — Awake() 자동 재탐색 실패");
                return false;
            }

            var labelField = typeof(GoalBoard).GetField("_label", BindingFlags.NonPublic | BindingFlags.Instance);
            var label = labelField.GetValue(board) as TextMeshProUGUI;
            if (label == null || !label.text.Contains(Saga.Core.SagaUi.L("지금", "Now") + " —") || !label.text.Contains(Saga.Core.SagaUi.L("이번 세션", "This session") + " —") || !label.text.Contains(Saga.Core.SagaUi.L("이번 주", "This week") + " —"))
            {
                Debug.LogError($"[PlaytestStorySlice] GoalBoard 세 줄이 안 채워짐 text=\"{(label == null ? "null" : label.text.Replace("\n", " | "))}\"");
                return false;
            }

            var card = Object.FindFirstObjectByType<SessionCard>();
            if (card == null)
            {
                Debug.LogError("[PlaytestStorySlice] SessionCard 컴포넌트를 못 찾음");
                return false;
            }
            if (card.IsShowing)
            {
                Debug.LogError("[PlaytestStorySlice] SessionCard가 세션 시작부터 떠 있음(기본은 숨김)");
                return false;
            }

            card.Show("테스트", "줄1", "줄2");
            if (!card.IsShowing)
            {
                Debug.LogError("[PlaytestStorySlice] SessionCard.Show() 호출 후에도 안 뜸");
                return false;
            }

            // 5초를 실제로 안 기다리고 _closeTimer를 만료 직전으로 돌린 뒤
            // Update()를 한 번 더 불러 자동 닫힘 경로를 확인한다.
            var closeTimerField = typeof(SessionCard).GetField("_closeTimer", BindingFlags.NonPublic | BindingFlags.Instance);
            closeTimerField.SetValue(card, 0.0001f);
            var updateMethod = typeof(SessionCard).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);
            updateMethod.Invoke(card, null);
            if (card.IsShowing)
            {
                Debug.LogError("[PlaytestStorySlice] SessionCard가 만료 후에도 자동으로 안 닫힘");
                return false;
            }

            if (Object.FindFirstObjectByType<StorySessionTracker>() == null)
            {
                Debug.LogError("[PlaytestStorySlice] StorySessionTracker 컴포넌트를 못 찾음");
                return false;
            }

            Debug.Log("[PlaytestStorySlice] goal board / session card OK - 3 lines filled, source auto-found, card shows and auto-closes");
            return true;
        }

        private static void TeleportPlayer(Vector3 position)
        {
            if (_playerController != null) _playerController.enabled = false;
            _player.position = position;
            if (_playerController != null) _playerController.enabled = true;
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

        private static void InvokePrivate(object target, string methodName)
        {
            var method = target.GetType().GetMethod(methodName, BindingFlags.NonPublic | BindingFlags.Instance);
            method?.Invoke(target, null);
        }
    }
}
