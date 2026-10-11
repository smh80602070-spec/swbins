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
    public static partial class PlaytestStorySlice
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
                    // tasks U-0093 — 세이브 없이 뜬 새 판은 무예 3택이 켜진다(레벨업마다 창·피해 막기). 옛 단계 진단은 SP 판 그대로 돌게 끈다(3택은 PlaytestStoryPick3 몫).
                    StorySkillState.RestorePicks(0, 0, 0, 0);
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
                    // PLAN.md 109-16 — 새 판 첫 장면(허창 들판의 두목)이 다른 진단 앞에서 상자를 열지 않게 끈다. 시나리오 진단이 스스로 켜고 되돌린다.
                    StoryScenario.Enabled = false; StoryScenario.AbortScene(); StoryScenarioUi.Instance?.Hide();
                    Saga.Story.Data.StoryTutorial.Enabled = false; // tasks U-0020 — 목표판 진단이 첫 줄을 "지금 —" 로 기대한다
                    if (!CheckButtonWiring()) { Fail(); return; }
                    if (!CheckSettingsPanel()) { Fail(); return; }
                    if (!PlaytestSettingsVoice.Check("PlaytestStorySlice", typeof(Saga.Story.UI.StorySettingsPanel))) { Fail(); return; } // U-0075 음성 줄
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
                    if (!PlaytestStoryMount.Run()) { Fail(); return; } // PLAN.md 109-15 탈것·비행 — 레벨·직업·체력·탈것·자리를 되돌린다.
                    if (!PlaytestStoryScenario.Run()) { Fail(); return; } // PLAN.md 109-16 시나리오 — 레벨·직업·사명·비경 조각·자리를 되돌린다.
                    if (!PlaytestStoryRound.Run()) { Fail(); return; } // tasks U-0024 회차 — 회차·세이브·최고 기록을 되돌린다.
                    if (!PlaytestStoryPick3.Run()) { Fail(); return; } // tasks U-0093 무예 3택·판 등급 — 세이브 JSON·3택 몫을 되돌린다.
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
    }
}
