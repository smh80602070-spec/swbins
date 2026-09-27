using TMPro;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using Saga.Realm.Data;
using Saga.Realm.World;
using Saga.Realm.Player;
using Saga.Realm.UI;
using Saga.Realm.Audio;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// VERTICAL_SLICE_REALM.md 5절 완료 조건 + REALM 다음 조각 넷(명령
    /// 나머지 6종·여러 성 확장·무장 로스터/성 소속·전쟁 첫 슬라이스)을
    /// 실제 Play 모드에서 확인한다(`PlaytestStorySlice.cs`와 같은 결 —
    /// 컴포넌트/정적 API를 직접 불러 판정 경로만 본다, UI 버튼 클릭
    /// 시뮬레이션은 안 함).
    /// (1) 성 소속 게이트 — 무장이 없는 성에서 개발형 명령이 막히는지,
    /// (2) 조선 물길 게이트 — 뭍길 성에서 막히는지(게이트 실패는 그 달
    /// 명령 소진을 안 시키는지도 같이),
    /// (3) 개간·상업·정산(금 공식),
    /// (4) 기술·치안·축성·훈련 — 새 명령 넷이 해당 필드를 올리는지,
    /// (5) 징병 — 병력이 늘고 인구가 주는지,
    /// (6) 수색·등용 — 성마다 다른 재야, 등용된 무장이 그 성에 배치되는지,
    /// (7) 새로 배치된 무장이 그 성에서 개발형 명령을 실제로 쓸 수 있는지,
    /// (8) 전쟁 — 잘못된 성/병력 부족 전제조건, 약한 군대는 못 뺏고
    /// 돌아오는지, 압도적 물량은 함락시키는지, 함락한 성 재공격이 막히는지,
    /// (8-1) 51장 "대규모 콘텐츠"(2026-09-14) — 둘째 목표(정도, 복양에서만
    /// 출진)도 같은 Attack() 경로로 함락·편입되는지,
    /// (8-2) 51장 2차 확장(2026-09-15) — 진류의 첫 목표(낙양)와, 소패·정도를
    /// 함락한 뒤 이어지는 둘째 단계 목표(하비·업)까지 같은 Attack() 경로로
    /// 순서대로(선행 성을 먼저 편입해야 열리는지 포함) 함락·편입되는지,
    /// (8-3) 51장 3차 확장(2026-09-16) — 낙양·하비·업을 함락한 뒤 각자
    /// 이어지는 셋째 단계 목표(장안·수춘·진양)까지 같은 경로로 되는지,
    /// (8-4) 51장 4차 확장(2026-09-16, 같은 날) — 장안·수춘을 함락한 뒤
    /// 이어지는 넷째 단계 목표(한중·여남)까지 같은 경로로 되는지,
    /// (8-5) 51장 5차 확장(2026-09-16, 같은 날) — 한중·여남을 함락한 뒤
    /// 이어지는 다섯째 단계 목표(성도·강하)까지 같은 경로로 되는지,
    /// (8-6) 51장 6차 확장(2026-09-16, 같은 날) — 성도·강하를 함락한 뒤
    /// 이어지는 여섯째 단계 목표(강주·양양)까지 같은 경로로 되는지,
    /// (8-7) 51장 7차 확장(2026-09-16, 같은 날) — 강주·양양을 함락한 뒤
    /// 이어지는 일곱째 단계 목표(영안·강릉)까지 같은 경로로 되는지,
    /// (8-8) 51장 8차 확장(2026-09-16, 같은 날) — 강릉을 함락한 뒤
    /// 이어지는 여덟째 단계 목표(장사)까지 같은 경로로 되는지(영안은
    /// 이웃이 전부 이미 우리 성이라 막다른 가지 — 다음 단계 없음),
    /// (8-9) 51장 9차 확장(2026-09-16, 같은 날) — 장사를 함락한 뒤
    /// 이어지는 아홉째 단계 목표(시상)까지 같은 경로로 되는지,
    /// (9) 계략(유언비어·화계) — 허창 밖 게이트, 성공 시 소패 훈련도/병력
    /// 실제 하락,
    /// (10) 함락한 성 편입 — 함락 즉시 네 번째 성으로 들어가는지, 무장
    /// 없이는 명령이 막히는지,
    /// (11) 문답 — 정답/오답 채점·금 보상·학습 기록,
    /// (12) 저장/불러오기 — 성 넷·로스터·성 소속·소패 전황·문답 진행까지 왕복.
    /// </summary>
    public static class PlaytestRealmSlice
    {
        private const string ScenePath = "Assets/Scenes/TestCity.unity";
        private const int MaxHireAttempts = 30;

        private static bool _hadError;
        private static int _framesSeen;
        private static bool _origEnterPlayModeOptionsEnabled;
        private static EnterPlayModeOptions _origEnterPlayModeOptions;

        private enum Phase
        {
            Init, WorldMap, LocationGate, ShipsGate, Agri, SettleAfterAgri, Comm, SettleAfterComm,
            Tech, Sec, Wall, Train, Draft, SettleAfterDraft,
            SearchAtChenliu, Hire, AgriByNewOfficer,
            PlotGate, PlotRumor, PlotFire,
            AttackWrongCity, AttackTooFewTroops, AttackWeak, AttackOverwhelm,
            CapturedCityDevelop, AttackAgainBlocked, AttackLuoyang, AttackXiapi, AttackDingtao, AttackYe,
            AttackChangan, AttackShouchun, AttackJinyang, AttackYunzhong, AttackShangjun, AttackShuofang, AttackWuyuan, AttackBeidi, AttackYanmen, AttackDingxiang, AttackHanzhong, AttackRunan,
            AttackChengdu, AttackJiangxia, AttackJiangzhou, AttackXiangyang,
            AttackYongan, AttackJiangling, AttackChangsha, AttackChaisang, AttackJianye, AttackKuaiji,
            AttackTianshui, AttackNanhai, AttackZhuti, AttackCangwu, AttackJianning, AttackYulin, AttackYuexi,
            AttackZangke, AttackJiaozhi, AttackHepu, AttackJiuzhen, AttackYunnan, AttackRinan,
            AttackYongchang, AttackXianglin, AttackDianchong, AttackShendu,
            AttackBijing, AttackJiantuoluo, AttackLuorong, AttackJibin, AttackDaxia, AttackWuyishanli, AttackMoqietuo, AttackSheyi, AttackZhuwu, AttackXiquan, AttackQuzu,
            Eras,
            QuizCorrect, QuizWrong, QuizArchive,
            SaveLoad, Done,
        }
        private static Phase _phase = Phase.Init;
        private static int _hireAttempts;
        private static int _plotAttempts;
        private static int _goldBeforeSettle;
        private static int _foodBeforeSettle;

        [MenuItem("Saga/Playtest Realm Slice (Headless)")]
        public static void Run()
        {
            _origEnterPlayModeOptionsEnabled = EditorSettings.enterPlayModeOptionsEnabled;
            _origEnterPlayModeOptions = EditorSettings.enterPlayModeOptions;
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions =
                EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;

            // GameBootstrap.Awake()가 매번 TryLoad()를 불러 이전 헤드리스
            // 실행이 남긴 세이브를 그대로 읽어 버린다 — "새 게임" 전제인
            // Init 단계가 깨지지 않도록 먼저 지운다(RealmSaveState.cs
            // DeleteForTest() 주석 참고).
            RealmSaveState.DeleteForTest();

            // CheckSettingsPanel()이 설정 버튼을 "Btn_설정"(한국어 라벨)으로
            // 찾는다 — RealmCommandUi.Build()가 그 이름을 지을 때 쓰는
            // RealmLocalization.CurrentLanguage는 PlayerPrefs에 저장돼 이전
            // 실행(또는 사람이 에디터에서 언어를 바꾼 뒤 안 되돌리고 끈 세션)이
            // "en"을 남기면 이번 실행이 처음부터 어긋난 이름으로 시작해 버튼을
            // 영영 못 찾는다 — 위 세이브 삭제와 같은 이유로 여기서 먼저 고정한다.
            // 110 ⑤c-2c-2 — 영어 감시(HangulWatch)로 돌 때는 en 으로 박는다.
            RealmLocalization.CurrentLanguage = HangulWatch.Active ? "en" : "ko";
            Saga.Core.SagaUi.Lang = RealmLocalization.CurrentLanguage;
            EditorSceneManager.OpenScene(ScenePath);

            _hadError = false;
            _framesSeen = 0;
            _phase = Phase.Init;
            _hireAttempts = 0;
            _plotAttempts = 0;

            Application.logMessageReceived += OnLog;
            EditorApplication.playModeStateChanged += OnStateChanged;
            EditorApplication.isPlaying = true;
        }

        private static void OnLog(string condition, string stackTrace, LogType type)
        {
            if (type != LogType.Error && type != LogType.Exception) return;
            if (stackTrace.Contains("UnityEditor.Search.SearchInit.IndexationOnStartup")) return;

            _hadError = true;
            Debug.LogError($"[PlaytestRealmSlice] runtime error: {condition}\n{stackTrace}");
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
                    ? "[PlaytestRealmSlice] OK - world-map/location gate/ships gate/orders(10)/draft/search/hire/city-assignment/war/diplo(rumor+fire)/captured-city-absorb/multi-target-attack(16th)/multi-target-plot/chain-17th(cangwu+jianning)/chain-18th(yulin+yuexi)/chain-19th(jiaozhi+zangke)/chain-20th(hepu+jiuzhen)/chain-21st(yunnan+rinan)/chain-22nd(yongchang+xianglin)/chain-23rd(shendu+dianchong)/chain-24th(jiantuoluo+bijing)/chain-25th(luorong+jibin)/chain-26th(daxia)/chain-27th(wuyishanli)/chain-28th(moqietuo)/chain-29th(sheyi)/chain-30th(zhuwu)/quiz/save-load all verified, no errors"
                    : $"[PlaytestRealmSlice] FAIL - error={_hadError} phase={_phase} frames={_framesSeen}");
                EditorApplication.Exit(ok ? 0 : 1);
            }
        }

        private static void Tick()
        {
            _framesSeen++;
            if (_framesSeen > 3000)
            {
                Debug.LogError("[PlaytestRealmSlice] 프레임 예산 초과");
                Fail();
                return;
            }

            switch (_phase)
            {
                case Phase.Init:
                    var commandUi = Object.FindFirstObjectByType<RealmCommandUi>();
                    if (GameObject.Find("City") == null || GameObject.Find("RealmCameraRig") == null ||
                        Object.FindFirstObjectByType<RealmHud>() == null || commandUi == null)
                    {
                        Debug.LogError("[PlaytestRealmSlice] 씬 구성 못 찾음 — City/RealmCameraRig/RealmHud/RealmCommandUi 중 일부 없음");
                        Fail();
                        return;
                    }
                    // 2026-09-14 "사운드" — 이 테스트는 UI 버튼을 안 눌러(클래스
                    // 주석) RealmCommandUi.PlayOutcomeSfx()가 안 도는데, 씬
                    // 빌드가 confirm/error 클립을 실제로 채웠는지·헤드리스에서
                    // RealmAudio.PlaySfx가 예외 없이 도는지는 여기서 직접 본다
                    // (GO PlaytestHeadless의 GoAudio 스모크와 같은 결).
                    var confirmClip = GetPrivateField<AudioClip>(commandUi, "confirmClip");
                    var errorClip = GetPrivateField<AudioClip>(commandUi, "errorClip");
                    if (confirmClip == null || errorClip == null)
                    {
                        Debug.LogError("[PlaytestRealmSlice] RealmCommandUi confirm/error 클립 미배선");
                        Fail();
                        return;
                    }
                    RealmAudio.PlaySfx(confirmClip);
                    RealmAudio.PlaySfx(errorClip);
                    if (RealmCityState.Gold != RealmCityState.StartingGold || RealmCityState.RosterIds.Count != 1 ||
                        RealmCityState.CurrentCity != "xuchang")
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 시작 상태 이상 — gold={RealmCityState.Gold} roster={RealmCityState.RosterIds.Count} city={RealmCityState.CurrentCity}");
                        Fail();
                        return;
                    }
                    if (!CheckSettingsPanel()) { Fail(); return; }
                    if (!CheckButtonWiring()) { Fail(); return; }
                    if (!CheckRealmHudLocalization()) { Fail(); return; }
                    if (!CheckCommandUiPanelsWork()) { Fail(); return; }
                    if (!CheckGoalBoardAndSessionCard()) { Fail(); return; }
                    if (!CheckOfficerTraits()) { Fail(); return; }
                    if (!CheckTactic()) { Fail(); return; }
                    if (!CheckDuel()) { Fail(); return; }
                    if (!CheckDebateHire()) { Fail(); return; }
                    if (!CheckEventChain()) { Fail(); return; }
                    _phase = Phase.WorldMap;
                    break;

                case Phase.WorldMap:
                {
                    // VERTICAL_SLICE_REALM.md 2-8~2-10절 — 지도 토글·성표
                    // 위치·탭 선택·드래그 회전/줌 클램프까지, 컴포넌트를
                    // 직접 불러 판정 경로만 본다(다른 phase들과 같은 관행).
                    // GameObject.Find()는 비활성 오브젝트를 못 찾는다(WorldMap
                    // 쪽은 시작 시 꺼져 있다) — 컴포넌트를 FindObjectsInactive
                    // .Include로 찾은 뒤 그 gameObject를 쓴다.
                    var worldMap = Object.FindFirstObjectByType<RealmWorldMap>(FindObjectsInactive.Include);
                    var mapCam = Object.FindFirstObjectByType<RealmWorldMapCamera>(FindObjectsInactive.Include);
                    var dioramaCam = Object.FindFirstObjectByType<RealmOrbitCamera>(FindObjectsInactive.Include);
                    var mapCameraRigGo = mapCam != null ? mapCam.gameObject : null;
                    var dioramaRigGo = dioramaCam != null ? dioramaCam.gameObject : null;
                    if (worldMap == null || mapCam == null || mapCameraRigGo == null || dioramaRigGo == null)
                    {
                        Debug.LogError("[PlaytestRealmSlice] 월드맵 구성 못 찾음 — RealmWorldMap/RealmWorldMapCamera/WorldMapCameraRig/RealmCameraRig 중 일부 없음");
                        Fail();
                        return;
                    }

                    // 켜기 전엔 디오라마만 활성.
                    if (!dioramaRigGo.activeSelf || mapCameraRigGo.activeSelf)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 초기 상태 이상 — diorama={dioramaRigGo.activeSelf}(기대=true) mapCam={mapCameraRigGo.activeSelf}(기대=false)");
                        Fail();
                        return;
                    }

                    RealmMapState.Toggle();
                    if (!RealmMapState.ViewingMap || dioramaRigGo.activeSelf || !mapCameraRigGo.activeSelf)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 지도 토글 실패 — viewingMap={RealmMapState.ViewingMap} diorama={dioramaRigGo.activeSelf} mapCam={mapCameraRigGo.activeSelf}");
                        Fail();
                        return;
                    }

                    // 성표 위치 — 손 계산과 대조(허창(58,47)·진류(63,39)·
                    // 복양(68,33), 중심=(63, 39.667), WorldScale=14).
                    var (centerX, centerY) = RealmWorldMap.MapCenter(RealmCityState.ActiveCityIds);
                    if (Mathf.Abs(centerX - 63f) > 0.01f || Mathf.Abs(centerY - 39.667f) > 0.01f)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 지도 중심 불일치 — center=({centerX},{centerY}) 기대=(63, 39.667)");
                        Fail();
                        return;
                    }
                    var xuchangPos = RealmWorldMap.WorldPos(RealmCityData.Get("xuchang"), centerX, centerY);
                    var expectedXuchang = new Vector3((58f - centerX) * 14f, 0f, (centerY - 47f) * 14f);
                    if (Vector3.Distance(xuchangPos, expectedXuchang) > 0.01f)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 성표 위치 불일치 — xuchang={xuchangPos} 기대={expectedXuchang}");
                        Fail();
                        return;
                    }

                    // 탭 선택 — 지금 조망은 xuchang, 진류 성표를 탭하면 바뀌어야 한다.
                    var chenliuMarkerGo = GameObject.Find("Marker_chenliu");
                    if (chenliuMarkerGo == null)
                    {
                        Debug.LogError("[PlaytestRealmSlice] Marker_chenliu 못 찾음");
                        Fail();
                        return;
                    }
                    var mapCameraComponent = mapCam.GetComponentInChildren<Camera>(); // Camera는 rig의 자식에 있다.
                    Vector2 markerScreenPos = mapCameraComponent != null
                        ? (Vector2)mapCameraComponent.WorldToScreenPoint(chenliuMarkerGo.transform.position)
                        : Vector2.zero;
                    mapCam.DebugBeginDrag(markerScreenPos);
                    mapCam.DebugEndDrag(markerScreenPos); // 문지방 안 넘긴 손떼기 = 탭.
                    if (RealmCityState.CurrentCity != "chenliu")
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 성표 탭 선택 실패 — currentCity={RealmCityState.CurrentCity}(기대=chenliu)");
                        Fail();
                        return;
                    }
                    RealmCityState.SetCurrentCity("xuchang"); // 이후 phase들의 전제(허창 시작)로 되돌린다.

                    // 드래그 회전 + 클램프 — 문지방 넘는 이동은 yaw/pitch를
                    // 공식대로 바꾸고, 확정된 드래그 뒤의 손떼기는 탭으로
                    // 오판하면 안 된다(성이 안 바뀜).
                    float yawBefore = mapCam.DebugYaw;
                    float pitchBefore = mapCam.DebugPitch;
                    var dragStart = new Vector2(500f, 500f);
                    mapCam.DebugBeginDrag(dragStart);
                    var dragPos = dragStart + new Vector2(80f, 40f); // 문지방(10px) 훌쩍 넘는 이동.
                    mapCam.DebugApplyDrag(dragPos - dragStart, dragPos);
                    mapCam.DebugEndDrag(dragPos);
                    if (RealmCityState.CurrentCity != "xuchang")
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 드래그 확정 후 탭 오판 — currentCity={RealmCityState.CurrentCity}(기대=xuchang, 안 바뀌어야 함)");
                        Fail();
                        return;
                    }
                    float expectedYaw = yawBefore + 80f * 0.006f;
                    float expectedPitch = Mathf.Clamp(pitchBefore + 40f * 0.006f, 0.35f, 1.3f);
                    if (Mathf.Abs(mapCam.DebugYaw - expectedYaw) > 0.0001f ||
                        Mathf.Abs(mapCam.DebugPitch - expectedPitch) > 0.0001f)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 드래그 회전 공식 불일치 — yaw={mapCam.DebugYaw}(기대={expectedYaw}) pitch={mapCam.DebugPitch}(기대={expectedPitch})");
                        Fail();
                        return;
                    }
                    // 문지방 안 넘는 미세한 드래그는 안 잠겨야 한다.
                    float yawBeforeSmall = mapCam.DebugYaw;
                    var smallStart = new Vector2(200f, 200f);
                    mapCam.DebugBeginDrag(smallStart);
                    var smallPos = smallStart + new Vector2(3f, 2f); // 거리 3.6 < 10.
                    mapCam.DebugApplyDrag(smallPos - smallStart, smallPos);
                    if (Mathf.Abs(mapCam.DebugYaw - yawBeforeSmall) > 0.00001f)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 문지방 미만 드래그가 잠김 — yaw={mapCam.DebugYaw}(기대={yawBeforeSmall})");
                        Fail();
                        return;
                    }
                    mapCam.DebugEndDrag(smallPos); // 문지방 안 넘겼으니 탭 판정 — 빈 곳이라 성 안 바뀜.
                    if (RealmCityState.CurrentCity != "xuchang")
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 빈 곳 탭인데 성이 바뀜 — currentCity={RealmCityState.CurrentCity}");
                        Fail();
                        return;
                    }

                    Debug.Log("[PlaytestRealmSlice] world map OK - toggle/marker-position/tap-select/drag-rotate(threshold+clamp) all verified");

                    RealmMapState.ForceOff();
                    if (RealmMapState.ViewingMap || !dioramaRigGo.activeSelf || mapCameraRigGo.activeSelf)
                    {
                        Debug.LogError("[PlaytestRealmSlice] 지도 되돌리기 실패");
                        Fail();
                        return;
                    }
                    _phase = Phase.LocationGate;
                    break;
                }

                case Phase.LocationGate:
                {
                    // 진류엔 아직 아무도 배치돼 있지 않다 — 개발형 명령이 막혀야 한다.
                    RealmCityState.SetCurrentCity("chenliu");
                    int goldBefore = RealmCityState.Gold;
                    var result = RealmCityState.ExecuteOrder("agri");
                    RealmCityState.SetCurrentCity("xuchang");
                    if (result.Ok || RealmCityState.Gold != goldBefore)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 성 소속 게이트 실패 — ok={result.Ok} gold={RealmCityState.Gold}(기대={goldBefore}) msg={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] location gate OK - {result.Message}");
                    _phase = Phase.ShipsGate;
                    break;
                }

                case Phase.ShipsGate:
                {
                    // 허창은 뭍길(land:plain) — 조선이 막혀야 하고, 게이트
                    // 실패는 이 달 명령 소진을 안 시켜야 한다(바로 이어 개간 성공).
                    int goldBefore = RealmCityState.Gold;
                    var result = RealmCityState.ExecuteOrder("ships");
                    if (result.Ok || RealmCityState.Gold != goldBefore)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 조선 게이트 실패 — ok={result.Ok} gold={RealmCityState.Gold}(기대={goldBefore}) msg={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] ships gate OK - {result.Message}");
                    _phase = Phase.Agri;
                    break;
                }

                case Phase.Agri:
                {
                    int goldBefore = RealmCityState.Gold;
                    int agriBefore = RealmCityState.CityRecord("xuchang").Agri;
                    var result = RealmCityState.ExecuteOrder("agri");
                    if (!result.Ok || RealmCityState.Gold != goldBefore - RealmOrderData.Get("agri").Gold ||
                        RealmCityState.CityRecord("xuchang").Agri <= agriBefore)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 개간 실패 — ok={result.Ok} msg={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] agri OK - {result.Message} (게이트 실패 둘은 명령 소진 안 시킴 확인됨)");
                    // PLAN.md 109-13-2 — 이 달 명령이 태수 몸짓(괭이질)으로 잡히고, 달이 넘어가면 비는지.
                    if (!PlaytestRealmActors.CheckOrderGesture("xuchang", "agri", "hoe")) { Fail(); return; }
                    RealmCityState.NextMonth();
                    if (!PlaytestRealmActors.CheckOrderCleared("xuchang")) { Fail(); return; }
                    // PLAN 101-2 REALM 이식 — 무입력 대신 "다음 달"로 달이
                    // 실제로 넘어간 시점에 RealmSessionTracker 가 SessionCard 를
                    // 띄우는지 여기서 실제 트리거로 확인한다(GO 처럼 합성
                    // Show() 호출로 때우지 않는다 — CheckGoalBoardAndSessionCard()
                    // 는 구조만 본다).
                    {
                        var card = Object.FindFirstObjectByType<SessionCard>();
                        if (card == null || !card.IsShowing)
                        {
                            Debug.LogError("[PlaytestRealmSlice] 첫 '다음 달' 이후 SessionCard가 안 뜸(월간 트리거 실패)");
                            Fail();
                            return;
                        }
                    }
                    _phase = Phase.Comm;
                    break;
                }

                case Phase.Comm:
                {
                    int goldBefore = RealmCityState.Gold;
                    int commBefore = RealmCityState.CityRecord("xuchang").Comm;
                    var result = RealmCityState.ExecuteOrder("comm");
                    if (!result.Ok || RealmCityState.Gold != goldBefore - RealmOrderData.Get("comm").Gold ||
                        RealmCityState.CityRecord("xuchang").Comm <= commBefore)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 상업 실패 — ok={result.Ok} msg={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] comm OK - {result.Message}");
                    _goldBeforeSettle = RealmCityState.Gold;
                    _foodBeforeSettle = RealmCityState.CityRecord("xuchang").Food;
                    _phase = Phase.SettleAfterComm;
                    break;
                }

                case Phase.SettleAfterComm:
                {
                    // 시작 달(1월)에서 한 번 다음 달로 넘겼으니 지금은 2월 —
                    // 수확달(6·10월)이 아니고 병력도 아직 없어 군량은 그대로.
                    string summary = RealmCityState.NextMonth();
                    var xuchang = RealmCityState.CityRecord("xuchang");
                    // 세력 금고는 성 셋(허창·진류·복양) 소득의 합산이다(rtk.js
                    // settleMonth() "세력 금고" 루프 그대로) — 진류·복양은
                    // 아직 아무 명령도 안 받아 시작값 그대로지만 소득에는
                    // 잡힌다. 치안은 셋 다 시작값(60)에서 정확히 같은
                    // 횟수만큼만 깎였으므로(정산 이번 한 번뿐) +1로 되돌려
                    // 정산 전 값을 그대로 되짚을 수 있다.
                    int expectedIncome = 0;
                    foreach (var cityId in new[] { "xuchang", "chenliu", "puyang" })
                    {
                        var rec = RealmCityState.CityRecord(cityId);
                        float secMulBefore = 0.5f + Mathf.Clamp(rec.Sec + 1, 0, 100) / 200f;
                        expectedIncome += Mathf.RoundToInt(rec.Comm * 0.55f * secMulBefore);
                    }
                    int upkeep = RealmCityState.RosterIds.Count * RealmCityState.UpkeepPerOfficer;
                    int expectedGold = Mathf.Max(0, _goldBeforeSettle + expectedIncome - upkeep);
                    if (RealmCityState.Gold != expectedGold || xuchang.Food != _foodBeforeSettle)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 정산 불일치 — gold={RealmCityState.Gold}(기대={expectedGold}) food={xuchang.Food}(기대={_foodBeforeSettle}) summary={summary}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] settle OK - {summary}");
                    _phase = Phase.Tech;
                    break;
                }

                case Phase.Tech:
                {
                    int before = RealmCityState.CityRecord("xuchang").Tech;
                    var result = RealmCityState.ExecuteOrder("tech");
                    if (!result.Ok || RealmCityState.CityRecord("xuchang").Tech <= before)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 기술 실패 — ok={result.Ok} msg={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] tech OK - {result.Message}");
                    RealmCityState.NextMonth();
                    _phase = Phase.Sec;
                    break;
                }

                case Phase.Sec:
                {
                    int before = RealmCityState.CityRecord("xuchang").Sec;
                    var result = RealmCityState.ExecuteOrder("sec");
                    if (!result.Ok || RealmCityState.CityRecord("xuchang").Sec <= before)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 치안 실패 — ok={result.Ok} msg={result.Message} before={before} after={RealmCityState.CityRecord("xuchang").Sec}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] sec OK - {result.Message}");
                    RealmCityState.NextMonth();
                    _phase = Phase.Wall;
                    break;
                }

                case Phase.Wall:
                {
                    int before = RealmCityState.CityRecord("xuchang").Wall;
                    var result = RealmCityState.ExecuteOrder("wall");
                    if (!result.Ok || RealmCityState.CityRecord("xuchang").Wall <= before)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 축성 실패 — ok={result.Ok} msg={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] wall OK - {result.Message}");
                    RealmCityState.NextMonth();
                    _phase = Phase.Train;
                    break;
                }

                case Phase.Train:
                {
                    int before = RealmCityState.CityRecord("xuchang").Train;
                    var result = RealmCityState.ExecuteOrder("train");
                    if (!result.Ok || RealmCityState.CityRecord("xuchang").Train <= before)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 훈련 실패 — ok={result.Ok} msg={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] train OK - {result.Message}");
                    RealmCityState.NextMonth();
                    _phase = Phase.Draft;
                    break;
                }

                case Phase.Draft:
                {
                    var xuchang = RealmCityState.CityRecord("xuchang");
                    int popBefore = xuchang.Pop;
                    int goldBefore = RealmCityState.Gold;
                    var result = RealmCityState.ExecuteOrder("draft");
                    if (!result.Ok || xuchang.Troops <= 0 || xuchang.Pop >= popBefore ||
                        RealmCityState.Gold != goldBefore - RealmOrderData.Get("draft").Gold)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 징병 실패 — ok={result.Ok} troops={xuchang.Troops} pop={xuchang.Pop}(이전={popBefore}) msg={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] draft OK - {result.Message} (troops={xuchang.Troops}, pop={popBefore}->{xuchang.Pop})");
                    _phase = Phase.SettleAfterDraft;
                    break;
                }

                case Phase.SettleAfterDraft:
                {
                    // 병력이 생긴 뒤 첫 정산 — 군량을 먹는다(eatOf). 시작
                    // 군량이 0이라 즉시 굶주려 병사가 흩는 것까지가 정상
                    // 동작(rtk.js와 같은 결, "군량 없이 병력만 늘리면 안
                    // 지켜진다"). 음수로 안 남고(0 클램프) 병력이 음수가
                    // 안 되는지만 확인 — 정확한 감소량은 대성공 여부에
                    // 따라 갈리므로 손 계산은 안 한다.
                    var xuchang = RealmCityState.CityRecord("xuchang");
                    int troopsBefore = xuchang.Troops;
                    string summary = RealmCityState.NextMonth();
                    if (xuchang.Food < 0 || xuchang.Troops < 0 || xuchang.Troops > troopsBefore)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 군량 소비/굶주림 이상 — food={xuchang.Food} troops={xuchang.Troops}(이전={troopsBefore}) summary={summary}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] food upkeep OK - {summary} (troops {troopsBefore}->{xuchang.Troops})");
                    _phase = Phase.SearchAtChenliu;
                    break;
                }

                case Phase.SearchAtChenliu:
                {
                    // 수색·등용은 위치 무관 — 허창에 있는 현책이 진류를
                    // 대상으로 수색한다. 진류 재야 후보는 이도인 하나뿐이라
                    // reach가 항상 1 — 결과가 결정적이다.
                    RealmCityState.SetCurrentCity("chenliu");
                    var result = RealmCityState.ExecuteOrder("search");
                    if (!result.Ok || !RealmCityState.FoundIds.Contains("jp_musashi"))
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 수색 실패 — ok={result.Ok} found={RealmCityState.FoundIds.Count} msg={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] search OK - {result.Message}");
                    RealmCityState.NextMonth();
                    _phase = Phase.Hire;
                    break;
                }

                case Phase.Hire:
                {
                    int rosterBefore = RealmCityState.RosterIds.Count;
                    var result = RealmCityState.ExecuteOrder("hire");
                    if (result.Ok && RealmCityState.RosterIds.Count == rosterBefore + 1)
                    {
                        if (RealmCityState.OfficerCityId("jp_musashi") != "chenliu")
                        {
                            Debug.LogError($"[PlaytestRealmSlice] 등용된 무장 배치 이상 — officerCity={RealmCityState.OfficerCityId("jp_musashi")}(기대=chenliu)");
                            Fail();
                            return;
                        }
                        Debug.Log($"[PlaytestRealmSlice] hire OK (attempt {_hireAttempts + 1}) - {result.Message}");
                        _phase = Phase.AgriByNewOfficer;
                        break;
                    }
                    _hireAttempts++;
                    if (_hireAttempts >= MaxHireAttempts)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 등용이 {MaxHireAttempts}번 안에 성공 못 함(확률 판정) — last={result.Message}");
                        Fail();
                        return;
                    }
                    RealmCityState.NextMonth(); // 무장 done 초기화 + 금 보충, 다음 시도.
                    break;
                }

                case Phase.AgriByNewOfficer:
                {
                    // 이도인이 방금 진류에 배치됐다 — 같은 달 안에 바로
                    // 그 성에서 개발형 명령을 쓸 수 있어야 한다(등용은
                    // 현책의 이 달 몫을 썼을 뿐, 이도인은 아직 안 씀).
                    int before = RealmCityState.CityRecord("chenliu").Agri;
                    var result = RealmCityState.ExecuteOrder("agri");
                    if (!result.Ok || RealmCityState.CityRecord("chenliu").Agri <= before)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 새 배치 무장의 개간 실패 — ok={result.Ok} msg={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] new-officer agri OK - {result.Message}");
                    if (!CheckSuccession()) { Fail(); return; }
                    RealmCityState.SetCurrentCity("xuchang");
                    RealmCityState.NextMonth(); // 계략/전쟁 테스트를 위해 무장 done을 깨끗이 비운다.
                    _phase = Phase.PlotGate;
                    break;
                }

                case Phase.PlotGate:
                {
                    // 계략도 공격처럼 목표가 있는 성에서만 — 51장 2차 확장
                    // (2026-09-15)으로 진류도 낙양이라는 목표가 생겨 더 이상
                    // "목표 없는 성" 예시가 아니다. wan은 RealmCityData/
                    // RealmEnemyCity 어느 카탈로그에도 없는 성이라(51장이
                    // 몇 차까지 늘어나도 무관) 항상 안전하게 같은 게이트를
                    // 본다 — RealmEnemyCity.cs 클래스 주석의 영구 주의사항 참고.
                    var result = RealmWarState.Plot("rumor", "wan");
                    if (result.Ok)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 계략 성 밖 게이트 실패 — msg={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] plot wrong-city gate OK - {result.Message}");
                    _phase = Phase.PlotRumor;
                    break;
                }

                case Phase.PlotRumor:
                {
                    // 확률 판정이라 등용처럼 성공할 때까지 반복(최대
                    // MaxHireAttempts번, NextMonth로 명령 소진·금고를 되돌려
                    // 가며). 성공하면 소패 훈련도가 실제로 떨어져야 한다.
                    int goldBefore = RealmCityState.Gold;
                    int trainBefore = RealmWarState.Xiaopei.Train;
                    var result = RealmWarState.Plot("rumor", "xuchang");
                    if (!result.Ok || RealmCityState.Gold != goldBefore - RealmPlotData.Get("rumor").Gold)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 유언비어 실행 이상 — ok={result.Ok} gold={RealmCityState.Gold}(기대={goldBefore - RealmPlotData.Get("rumor").Gold}) msg={result.Message}");
                        Fail();
                        return;
                    }
                    if (RealmWarState.Xiaopei.Train < trainBefore)
                    {
                        Debug.Log($"[PlaytestRealmSlice] plot rumor OK (success, attempt {_plotAttempts + 1}) - {result.Message}");
                        _plotAttempts = 0;
                        RealmCityState.NextMonth();
                        _phase = Phase.PlotFire;
                        break;
                    }
                    if (RealmWarState.Xiaopei.Train != trainBefore)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 유언비어 실패인데 훈련도가 바뀜 — before={trainBefore} after={RealmWarState.Xiaopei.Train}");
                        Fail();
                        return;
                    }
                    _plotAttempts++;
                    if (_plotAttempts >= MaxHireAttempts)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 유언비어가 {MaxHireAttempts}번 안에 성공 못 함(확률 판정) — last={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] plot rumor miss (attempt {_plotAttempts}) - {result.Message}");
                    RealmCityState.NextMonth();
                    break;
                }

                case Phase.PlotFire:
                {
                    int goldBefore = RealmCityState.Gold;
                    int troopsBefore = RealmWarState.Xiaopei.Troops;
                    var result = RealmWarState.Plot("fire", "xuchang");
                    if (!result.Ok || RealmCityState.Gold != goldBefore - RealmPlotData.Get("fire").Gold)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 화계 실행 이상 — ok={result.Ok} gold={RealmCityState.Gold}(기대={goldBefore - RealmPlotData.Get("fire").Gold}) msg={result.Message}");
                        Fail();
                        return;
                    }
                    if (RealmWarState.Xiaopei.Troops < troopsBefore)
                    {
                        Debug.Log($"[PlaytestRealmSlice] plot fire OK (success, attempt {_plotAttempts + 1}) - {result.Message}");
                        // 소패 병력/훈련이 계략으로 흐트러진 채면 뒤의 약한
                        // 공격/압도적 공격 시나리오(고정 수치를 전제로 한
                        // 테스트)가 어긋난다 — 기준값으로 되돌려 둔다.
                        var xiaopeiDef = RealmEnemyCity.Get(RealmEnemyCity.XiaopeiId);
                        RealmWarState.Restore(RealmEnemyCity.XiaopeiId, xiaopeiDef.BaseWall, xiaopeiDef.BaseWall,
                            xiaopeiDef.BaseTroops, xiaopeiDef.BaseTrain, xiaopeiDef.BaseTech, false);
                        RealmCityState.NextMonth();
                        _phase = Phase.AttackWrongCity;
                        break;
                    }
                    if (RealmWarState.Xiaopei.Troops != troopsBefore)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 화계 실패인데 병력이 바뀜 — before={troopsBefore} after={RealmWarState.Xiaopei.Troops}");
                        Fail();
                        return;
                    }
                    _plotAttempts++;
                    if (_plotAttempts >= MaxHireAttempts)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 화계가 {MaxHireAttempts}번 안에 성공 못 함(확률 판정) — last={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] plot fire miss (attempt {_plotAttempts}) - {result.Message}");
                    RealmCityState.NextMonth();
                    break;
                }

                case Phase.AttackWrongCity:
                {
                    // 51장 2차 확장(2026-09-15)으로 진류도 낙양이라는 목표가
                    // 생겨 더 이상 "목표 없는 성" 예시가 아니다(PlotGate와 같은
                    // 이유) — wan은 어느 카탈로그에도 없어 항상 안전하다.
                    var result = RealmWarState.Attack("wan");
                    if (result.Ok || RealmWarState.Xiaopei.Captured)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 성 밖 공격 게이트 실패 — ok={result.Ok} msg={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] wrong-city attack gate OK - {result.Message}");
                    _phase = Phase.AttackTooFewTroops;
                    break;
                }

                case Phase.AttackTooFewTroops:
                {
                    // 병력 전제조건만 격리해서 본다 — 조작한 값이라 실제
                    // 징병 결과와 무관.
                    var xuchang = RealmCityState.CityRecord("xuchang");
                    xuchang.Troops = 100;
                    xuchang.Food = 1000;
                    var result = RealmWarState.Attack("xuchang");
                    if (result.Ok || xuchang.Troops != 100)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 병력 부족 게이트 실패 — ok={result.Ok} troops={xuchang.Troops}(기대=100) msg={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] too-few-troops attack gate OK - {result.Message}");
                    _phase = Phase.AttackWeak;
                    break;
                }

                case Phase.AttackWeak:
                {
                    // 소패(800명, 성벽 3600)에 한참 못 미치는 약한 군대 —
                    // 함락은 못 하고 살아남은 병력이 돌아와야 한다.
                    var xuchang = RealmCityState.CityRecord("xuchang");
                    xuchang.Troops = 600;
                    xuchang.Food = 1000;
                    var result = RealmWarState.Attack("xuchang");
                    if (!result.Ok || RealmWarState.Xiaopei.Captured || xuchang.Troops <= 0)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 약한 공격 실패 — ok={result.Ok} captured={RealmWarState.Xiaopei.Captured} troops={xuchang.Troops} msg={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] weak attack OK - {result.Message} (troops back={xuchang.Troops}, xiaopei troops={RealmWarState.Xiaopei.Troops})");
                    RealmCityState.NextMonth(); // 다음 공격을 위해 무장 done을 다시 비운다.
                    _phase = Phase.AttackOverwhelm;
                    break;
                }

                case Phase.AttackOverwhelm:
                {
                    // 압도적 물량 — 확실히 함락시킨다.
                    var xuchang = RealmCityState.CityRecord("xuchang");
                    xuchang.Troops = 100000;
                    xuchang.Food = 100000;
                    var result = RealmWarState.Attack("xuchang");
                    if (!result.Ok || !RealmWarState.Xiaopei.Captured)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 압도적 공격 실패 — ok={result.Ok} captured={RealmWarState.Xiaopei.Captured} msg={result.Message}");
                        Fail();
                        return;
                    }

                    // REALM 다음 조각 (2) — 함락한 성이 실제로 편입됐는지.
                    // RealmWarState.Xiaopei 스냅샷과 새로 생긴 RealmCityRecord가
                    // 정확히 같은 값을 들고 있어야 한다(AbsorbCity()가 그
                    // 자리에서 그대로 옮긴 것이므로).
                    var xiaopeiSnap = RealmWarState.Snapshot(RealmEnemyCity.XiaopeiId);
                    var xiaopeiRecord = RealmCityState.CityRecord(RealmEnemyCity.XiaopeiId);
                    var xiaopeiDef = RealmCityData.Get(RealmEnemyCity.XiaopeiId);
                    if (!RealmCityState.ActiveCityIds.Contains(RealmEnemyCity.XiaopeiId) || xiaopeiRecord == null ||
                        xiaopeiRecord.Wall != xiaopeiSnap.wall || xiaopeiRecord.Troops != xiaopeiSnap.troops ||
                        xiaopeiRecord.Train != xiaopeiSnap.train || xiaopeiRecord.Tech != xiaopeiSnap.tech ||
                        xiaopeiRecord.Sec != 30 || xiaopeiRecord.Agri != xiaopeiDef.BaseAgri || xiaopeiRecord.Comm != xiaopeiDef.BaseComm)
                    {
                        Debug.LogError("[PlaytestRealmSlice] 함락한 성 편입 값 불일치 (ActiveCityIds/필드 중 하나)");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] overwhelm attack + city absorb OK - {result.Message} (agri={xiaopeiRecord.Agri}, sec={xiaopeiRecord.Sec}, wall={xiaopeiRecord.Wall}, troops={xiaopeiRecord.Troops})");
                    _phase = Phase.CapturedCityDevelop;
                    break;
                }

                case Phase.CapturedCityDevelop:
                {
                    // 무장이 아직 아무도 없으니 개발형 명령이 막혀야 한다
                    // (진류가 처음에 그랬던 것과 같은 성 소속 게이트).
                    RealmCityState.SetCurrentCity(RealmEnemyCity.XiaopeiId);
                    var blocked = RealmCityState.ExecuteOrder("agri");
                    if (blocked.Ok)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 무장 없는 소패에서 개간이 성공해 버림 — msg={blocked.Message}");
                        Fail();
                        return;
                    }

                    // 무장 전임(성 사이 이동)은 이번 범위 밖(godot 3절 "뺀 것") —
                    // 테스트만을 위해 저장 스냅샷을 다시 불러오는 경로(Restore)로
                    // 현책을 소패에 심어, 새로 편입된 성에서도 개발형 명령이
                    // 실제로 도는지만 확인한다.
                    var roster = new List<string>(RealmCityState.RosterIds);
                    var officerCityIds = new List<string>();
                    var officerCityCities = new List<string>();
                    foreach (var id in roster)
                    {
                        officerCityIds.Add(id);
                        officerCityCities.Add(id == RealmOfficerPool.StartingOfficerId ? RealmEnemyCity.XiaopeiId : RealmCityState.OfficerCityId(id));
                    }
                    RealmCityState.Restore(RealmCityState.Gold, RealmCityState.Year, RealmCityState.Month,
                        RealmEnemyCity.XiaopeiId, roster, null, new List<string>(RealmCityState.FoundIds),
                        officerCityIds, officerCityCities, RealmCityState.SnapshotCities());

                    int before = RealmCityState.CityRecord(RealmEnemyCity.XiaopeiId).Agri;
                    var result = RealmCityState.ExecuteOrder("agri");
                    if (!result.Ok || RealmCityState.CityRecord(RealmEnemyCity.XiaopeiId).Agri <= before)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 소패 배치 후 개간 실패 — ok={result.Ok} msg={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] captured-city develop OK - {result.Message}");
                    RealmCityState.SetCurrentCity("xuchang");
                    _phase = Phase.AttackAgainBlocked;
                    break;
                }

                case Phase.AttackAgainBlocked:
                {
                    var result = RealmWarState.Attack("xuchang");
                    if (result.Ok)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 함락한 성 재공격이 안 막힘 — msg={result.Message}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] re-attack blocked OK - {result.Message}");
                    _phase = Phase.AttackLuoyang;
                    break;
                }

                case Phase.AttackLuoyang:
                {
                    // 51장 2차 확장(2026-09-15) — 진류(시작 성 셋 중 그때까지
                    // 목표가 없던 유일한 곳)의 첫 출진 목표.
                    if (!AttackChainStep("chenliu", RealmEnemyCity.LuoyangId, Phase.AttackXiapi)) return;
                    break;
                }

                case Phase.AttackXiapi:
                {
                    // 51장 2차 확장 — 소패를 함락한 뒤에도 계속 확장할 거리가
                    // 있도록 소패에 붙는 둘째 단계 목표(TargetFrom("xiaopei")).
                    if (!AttackChainStep(RealmEnemyCity.XiaopeiId, RealmEnemyCity.XiapiId, Phase.AttackDingtao)) return;
                    break;
                }

                case Phase.AttackDingtao:
                {
                    // 51장 "대규모 콘텐츠" — 정도(복양에서만 출진)도 소패와
                    // 같은 RealmWarState.Attack() 경로로 함락·편입되는지 확인.
                    if (!AttackChainStep("puyang", RealmEnemyCity.DingtaoId, Phase.AttackYe)) return;
                    break;
                }

                case Phase.AttackYe:
                {
                    // 51장 2차 확장 — 정도를 함락한 뒤 이어지는 둘째 단계
                    // 목표(TargetFrom("dingtao")).
                    if (!AttackChainStep(RealmEnemyCity.DingtaoId, RealmEnemyCity.YeId, Phase.AttackChangan)) return;
                    break;
                }

                case Phase.AttackChangan:
                {
                    // 51장 3차 확장(2026-09-16) — 낙양을 함락한 뒤 이어지는
                    // 셋째 단계 목표(TargetFrom("luoyang")).
                    if (!AttackChainStep(RealmEnemyCity.LuoyangId, RealmEnemyCity.ChanganId, Phase.AttackShouchun)) return;
                    break;
                }

                case Phase.AttackShouchun:
                {
                    // 51장 3차 확장 — 하비를 함락한 뒤 이어지는 셋째 단계
                    // 목표(TargetFrom("xiapi")).
                    if (!AttackChainStep(RealmEnemyCity.XiapiId, RealmEnemyCity.ShouchunId, Phase.AttackJinyang)) return;
                    break;
                }

                case Phase.AttackJinyang:
                {
                    // 51장 3차 확장 — 업을 함락한 뒤 이어지는 셋째 단계
                    // 목표(TargetFrom("ye")).
                    if (!AttackChainStep(RealmEnemyCity.YeId, RealmEnemyCity.JinyangId, Phase.AttackYunzhong)) return;
                    break;
                }

                case Phase.AttackYunzhong:
                {
                    // 51장 12차 확장(2026-09-17) — 진양을 함락한 뒤 이어지는
                    // 복양 사슬의 새 넷째 단계 목표(TargetFrom("jinyang")).
                    if (!AttackChainStep(RealmEnemyCity.JinyangId, RealmEnemyCity.YunzhongId, Phase.AttackShangjun)) return;
                    break;
                }

                case Phase.AttackShangjun:
                {
                    // 51장 13차 확장(2026-09-17, 같은 세션 "막북 안쪽으로
                    // 계속 이어해") — 운중의 첫째 목표(34~35차부터 안문·정양과
                    // 형제 가지가 돼 enemyId 명시).
                    if (!AttackChainStep(RealmEnemyCity.YunzhongId, RealmEnemyCity.ShangjunId, Phase.AttackShuofang, RealmEnemyCity.ShangjunId)) return;
                    break;
                }

                case Phase.AttackShuofang:
                {
                    // 51장 14차 확장(2026-09-17, 같은 세션 "묻지말고
                    // 이어해줘") — 상군의 첫째 목표(33차부터 북지와 형제
                    // 가지가 돼 enemyId 명시).
                    if (!AttackChainStep(RealmEnemyCity.ShangjunId, RealmEnemyCity.ShuofangId, Phase.AttackWuyuan, RealmEnemyCity.ShuofangId)) return;
                    break;
                }

                case Phase.AttackWuyuan:
                {
                    // 51장 15차 확장(2026-09-17, 같은 세션 "오원까지
                    // 마무리하고 이어해줘") — 삭방을 함락한 뒤 이어지는
                    // 복양 사슬의 새 일곱째·마지막 단계 목표
                    // (TargetFrom("shuofang")), 삭방 갈래는 여기서 끝.
                    if (!AttackChainStep(RealmEnemyCity.ShuofangId, RealmEnemyCity.WuyuanId, Phase.AttackBeidi)) return;
                    break;
                }

                case Phase.AttackBeidi:
                {
                    // 33차 확장(2026-09-19) — 상군의 둘째 목표(TargetFrom
                    // ("shangjun")), 원작에 더 뻗는 LINKS 없어(잎사귀) 상군
                    // 갈래가 이걸로 전부 닫힌다.
                    if (!AttackChainStep(RealmEnemyCity.ShangjunId, RealmEnemyCity.BeidiId, Phase.AttackYanmen, RealmEnemyCity.BeidiId)) return;
                    break;
                }

                case Phase.AttackYanmen:
                {
                    // 34차 확장(2026-09-19) — 운중의 둘째 목표(35차부터
                    // 정양과 형제 가지가 돼 enemyId 명시). 원작에 더 뻗는
                    // LINKS 없어(잎사귀) 이 가지는 여기서 끝.
                    if (!AttackChainStep(RealmEnemyCity.YunzhongId, RealmEnemyCity.YanmenId, Phase.AttackDingxiang, RealmEnemyCity.YanmenId)) return;
                    break;
                }

                case Phase.AttackDingxiang:
                {
                    // 35차 확장(2026-09-19) — 운중의 셋째이자 마지막 목표
                    // (TargetFrom("yunzhong")), 원작에 더 뻗는 LINKS
                    // 없어(잎사귀) 이걸로 운중 갈래·막북 전체가 완전히 닫힌다.
                    if (!AttackChainStep(RealmEnemyCity.YunzhongId, RealmEnemyCity.DingxiangId, Phase.AttackHanzhong, RealmEnemyCity.DingxiangId)) return;
                    break;
                }

                case Phase.AttackHanzhong:
                {
                    // 51장 4차 확장(2026-09-16) — 장안을 함락한 뒤 이어지는
                    // 넷째 단계 목표(TargetFrom("changan")).
                    if (!AttackChainStep(RealmEnemyCity.ChanganId, RealmEnemyCity.HanzhongId, Phase.AttackRunan)) return;
                    break;
                }

                case Phase.AttackRunan:
                {
                    // 51장 4차 확장 — 수춘을 함락한 뒤 이어지는 넷째 단계
                    // 목표(TargetFrom("shouchun")).
                    if (!AttackChainStep(RealmEnemyCity.ShouchunId, RealmEnemyCity.RunanId, Phase.AttackChengdu)) return;
                    break;
                }

                case Phase.AttackChengdu:
                {
                    // 51장 5차 확장(2026-09-16) — 한중을 함락한 뒤 이어지는
                    // 다섯째 단계 목표(TargetFrom("hanzhong")).
                    if (!AttackChainStep(RealmEnemyCity.HanzhongId, RealmEnemyCity.ChengduId, Phase.AttackJiangxia)) return;
                    break;
                }

                case Phase.AttackJiangxia:
                {
                    // 51장 5차 확장 — 여남을 함락한 뒤 이어지는 다섯째 단계
                    // 목표(TargetFrom("runan")).
                    if (!AttackChainStep(RealmEnemyCity.RunanId, RealmEnemyCity.JiangxiaId, Phase.AttackJiangzhou)) return;
                    break;
                }

                case Phase.AttackJiangzhou:
                {
                    // 51장 6차 확장(2026-09-16) — 성도를 함락한 뒤 이어지는
                    // 여섯째 단계 목표(TargetFrom("chengdu")).
                    if (!AttackChainStep(RealmEnemyCity.ChengduId, RealmEnemyCity.JiangzhouId, Phase.AttackXiangyang)) return;
                    break;
                }

                case Phase.AttackXiangyang:
                {
                    // 51장 6차 확장 — 강하를 함락한 뒤 이어지는 여섯째 단계
                    // 목표(TargetFrom("jiangxia")).
                    if (!AttackChainStep(RealmEnemyCity.JiangxiaId, RealmEnemyCity.XiangyangId, Phase.AttackYongan)) return;
                    break;
                }

                case Phase.AttackYongan:
                {
                    // 51장 7차 확장(2026-09-16) — 강주를 함락한 뒤 이어지는
                    // 일곱째 단계 목표(TargetFrom("jiangzhou")).
                    if (!AttackChainStep(RealmEnemyCity.JiangzhouId, RealmEnemyCity.YonganId, Phase.AttackJiangling)) return;
                    break;
                }

                case Phase.AttackJiangling:
                {
                    // 51장 7차 확장 — 양양을 함락한 뒤 이어지는 일곱째 단계
                    // 목표(TargetFrom("xiangyang")).
                    if (!AttackChainStep(RealmEnemyCity.XiangyangId, RealmEnemyCity.JianglingId, Phase.AttackChangsha)) return;
                    break;
                }

                case Phase.AttackChangsha:
                {
                    // 51장 8차 확장(2026-09-16) — 강릉을 함락한 뒤 이어지는
                    // 여덟째 단계 목표(TargetFrom("jiangling")). 영안(yongan)은
                    // 이웃이 전부 이미 우리 성이라 이번엔 다음 목표가 없다
                    // (TargetFrom("yongan") == null로 남는다 — 진양과 같은
                    // 막다른 가지).
                    if (!AttackChainStep(RealmEnemyCity.JianglingId, RealmEnemyCity.ChangshaId, Phase.AttackChaisang)) return;
                    break;
                }

                case Phase.AttackChaisang:
                {
                    // 51장 9차 확장(2026-09-16) — 장사를 함락한 뒤 이어지는
                    // 아홉째 단계 목표(TargetFrom("changsha")).
                    if (!AttackChainStep(RealmEnemyCity.ChangshaId, RealmEnemyCity.ChaisangId, Phase.AttackJianye)) return;
                    break;
                }

                case Phase.AttackJianye:
                {
                    // 51장 10차 확장(2026-09-16, "순서대로 이어해줘") —
                    // 시상을 함락한 뒤 이어지는 열째 단계 목표
                    // (TargetFrom("chaisang")), 원작 LINKS: chaisang-jianye
                    // ("오나라 도읍 자리 — 왕기가 있다 한다").
                    if (!AttackChainStep(RealmEnemyCity.ChaisangId, RealmEnemyCity.JianyeId, Phase.AttackKuaiji)) return;
                    break;
                }

                case Phase.AttackKuaiji:
                {
                    // 51장 11차 확장(2026-09-16, 같은 날 "순서대로 이어해줘")
                    // — 건업을 함락한 뒤 이어지는 열한째 단계 목표
                    // (TargetFrom("jianye")), 원작 LINKS: jianye-kuaiji
                    // ("강동의 끝"), 스물 중 가장 어렵다. 이 사슬의 마지막
                    // 칸 — 회계는 원작 LINKS상 더 이상 이웃이 없다.
                    if (!AttackChainStep(RealmEnemyCity.JianyeId, RealmEnemyCity.KuaijiId, Phase.AttackTianshui)) return;
                    break;
                }

                case Phase.AttackTianshui:
                {
                    // 51장 16차 확장(2026-09-18, PLAN.md Q-U2) — "성 하나당
                    // 목표 하나" 제약을 풀고 이미 목표(한중)가 있는 장안에
                    // 둘째 목표를 열었다. TargetsFrom("changan")이 정확히
                    // 둘(한중·천수)을 돌려주는지, 공격 UI가 목표 둘일 때
                    // 고르기 패널을 여는지부터 먼저 본다.
                    if (!CheckMultiTargetAttack()) { Fail(); return; }
                    if (!CheckMultiTargetPlot()) { Fail(); return; }
                    if (!AttackChainStep(RealmEnemyCity.ChanganId, RealmEnemyCity.TianshuiId, Phase.AttackNanhai, RealmEnemyCity.TianshuiId)) return;
                    break;
                }

                case Phase.AttackNanhai:
                {
                    // 16차 확장 — 장사의 둘째 목표(시상에 이어).
                    if (!AttackChainStep(RealmEnemyCity.ChangshaId, RealmEnemyCity.NanhaiId, Phase.AttackZhuti, RealmEnemyCity.NanhaiId)) return;
                    break;
                }

                case Phase.AttackZhuti:
                {
                    // 16차 확장 — 강주의 둘째 목표(영안에 이어).
                    if (!AttackChainStep(RealmEnemyCity.JiangzhouId, RealmEnemyCity.ZhutiId, Phase.AttackCangwu, RealmEnemyCity.ZhutiId)) return;
                    break;
                }

                case Phase.AttackCangwu:
                {
                    // 17차 확장(2026-09-18) — 남해를 함락한 뒤 이어지는
                    // 교주 사슬의 다음 단계. 20차부터 남해가 합포도 목표로
                    // 가져 목표가 둘이 됐으므로 enemyId를 명시해야 한다
                    // (changan과 같은 이유).
                    if (!AttackChainStep(RealmEnemyCity.NanhaiId, RealmEnemyCity.CangwuId, Phase.AttackHepu, RealmEnemyCity.CangwuId)) return;
                    break;
                }

                case Phase.AttackHepu:
                {
                    // 20차 확장(2026-09-18) — 남해의 둘째 목표(창오와
                    // 형제 가지, 19차 장가와 같은 결로 형제 가지 규칙을
                    // 또 한 번 확장).
                    if (!AttackChainStep(RealmEnemyCity.NanhaiId, RealmEnemyCity.HepuId, Phase.AttackJianning, RealmEnemyCity.HepuId)) return;
                    break;
                }

                case Phase.AttackJianning:
                {
                    // 17차 확장(2026-09-18) — 주제를 함락한 뒤 이어지는
                    // 남중 사슬의 다음 단계(TargetFrom("zhuti")).
                    if (!AttackChainStep(RealmEnemyCity.ZhutiId, RealmEnemyCity.JianningId, Phase.AttackYulin)) return;
                    break;
                }

                case Phase.AttackYulin:
                {
                    // 18차 확장(2026-09-18) — 창오를 함락한 뒤 이어지는
                    // 교주 사슬의 다음 단계(TargetFrom("cangwu")).
                    if (!AttackChainStep(RealmEnemyCity.CangwuId, RealmEnemyCity.YulinId, Phase.AttackYuexi)) return;
                    break;
                }

                case Phase.AttackYuexi:
                {
                    // 18차 확장(2026-09-18) — 건녕을 함락한 뒤 이어지는
                    // 남중 사슬의 다음 단계이자 막다른 끝(TargetFrom이었던
                    // 자리 — 19차부터 건녕이 장가도 목표로 가져 목표가
                    // 둘이 됐으므로 enemyId를 명시해야 한다, changan과
                    // 같은 이유).
                    if (!AttackChainStep(RealmEnemyCity.JianningId, RealmEnemyCity.YuexiId, Phase.AttackZangke, RealmEnemyCity.YuexiId)) return;
                    break;
                }

                case Phase.AttackZangke:
                {
                    // 19차 확장(2026-09-18) — 건녕의 둘째 목표(월수와 형제
                    // 가지, 16차 규칙을 원래 세 국경 성 밖으로 처음 확장).
                    if (!AttackChainStep(RealmEnemyCity.JianningId, RealmEnemyCity.ZangkeId, Phase.AttackYunnan, RealmEnemyCity.ZangkeId)) return;
                    break;
                }

                case Phase.AttackYunnan:
                {
                    // 21차 확장(2026-09-18) — 건녕의 셋째 목표(월수·장가와
                    // 형제 가지, 목표가 셋으로 늘어난 첫 사례).
                    if (!AttackChainStep(RealmEnemyCity.JianningId, RealmEnemyCity.YunnanId, Phase.AttackYongchang, RealmEnemyCity.YunnanId)) return;
                    break;
                }

                case Phase.AttackYongchang:
                {
                    // 22차 확장(2026-09-19) — 운남을 함락한 뒤 이어지는
                    // 남중 사슬의 다음 단계(TargetFrom("yunnan")).
                    if (!AttackChainStep(RealmEnemyCity.YunnanId, RealmEnemyCity.YongchangId, Phase.AttackShendu)) return;
                    break;
                }

                case Phase.AttackShendu:
                {
                    // 23차 확장(2026-09-19) — 영창을 함락한 뒤 이어지는
                    // 남중 사슬의 다음 단계(TargetFrom("yongchang")).
                    if (!AttackChainStep(RealmEnemyCity.YongchangId, RealmEnemyCity.ShenduId, Phase.AttackSheyi)) return;
                    break;
                }

                case Phase.AttackSheyi:
                {
                    // 29차 확장(2026-09-19) — 신독의 넷째 목표이자 마지막
                    // 이웃(건타라·대하·마게타와 형제 가지, 목표가 넷으로
                    // 늘어난 첫 사례). enemyId 명시 필요.
                    if (!AttackChainStep(RealmEnemyCity.ShenduId, RealmEnemyCity.SheyiId, Phase.AttackMoqietuo, RealmEnemyCity.SheyiId)) return;
                    break;
                }

                case Phase.AttackMoqietuo:
                {
                    // 28차 확장(2026-09-19) — 신독의 셋째 목표(건타라·대하와
                    // 형제 가지, 목표가 셋으로 늘어난 첫 사례 — jianning
                    // 21차와 같은 패턴). enemyId 명시 필요.
                    if (!AttackChainStep(RealmEnemyCity.ShenduId, RealmEnemyCity.MoqietuoId, Phase.AttackDaxia, RealmEnemyCity.MoqietuoId)) return;
                    break;
                }

                case Phase.AttackDaxia:
                {
                    // 26차 확장(2026-09-19) — 신독의 둘째 목표(건타라와
                    // 형제 가지, 목표가 둘이 됐으니 enemyId 명시 — xianglin
                    // 25차와 같은 이유).
                    if (!AttackChainStep(RealmEnemyCity.ShenduId, RealmEnemyCity.DaxiaId, Phase.AttackWuyishanli, RealmEnemyCity.DaxiaId)) return;
                    break;
                }

                case Phase.AttackWuyishanli:
                {
                    // 27차 확장(2026-09-19) — 대하를 함락한 뒤 이어지는
                    // 남중 사슬의 다음 단계이자 이 갈래의 끝
                    // (TargetFrom("daxia")).
                    if (!AttackChainStep(RealmEnemyCity.DaxiaId, RealmEnemyCity.WuyishanliId, Phase.AttackJiantuoluo)) return;
                    break;
                }

                case Phase.AttackJiantuoluo:
                {
                    // 24차 확장(2026-09-19) — 신독의 첫째 목표(26차부터
                    // 대하와 형제 가지가 돼 enemyId 명시).
                    if (!AttackChainStep(RealmEnemyCity.ShenduId, RealmEnemyCity.JiantuoluoId, Phase.AttackJibin, RealmEnemyCity.JiantuoluoId)) return;
                    break;
                }

                case Phase.AttackJibin:
                {
                    // 25차 확장(2026-09-19) — 건타라를 함락한 뒤 이어지는
                    // 남중 사슬의 다음 단계이자 이 갈래의 끝
                    // (TargetFrom("jiantuoluo")).
                    if (!AttackChainStep(RealmEnemyCity.JiantuoluoId, RealmEnemyCity.JibinId, Phase.AttackJiaozhi)) return;
                    break;
                }

                case Phase.AttackJiaozhi:
                {
                    // 19차 확장(2026-09-18) — 울림을 함락한 뒤 이어지는
                    // 교주 사슬의 다음 단계(TargetFrom("yulin")).
                    if (!AttackChainStep(RealmEnemyCity.YulinId, RealmEnemyCity.JiaozhiId, Phase.AttackJiuzhen)) return;
                    break;
                }

                case Phase.AttackJiuzhen:
                {
                    // 20차 확장(2026-09-18) — 교지를 함락한 뒤 이어지는
                    // 교주 사슬의 다음 단계(TargetFrom("jiaozhi")).
                    if (!AttackChainStep(RealmEnemyCity.JiaozhiId, RealmEnemyCity.JiuzhenId, Phase.AttackRinan)) return;
                    break;
                }

                case Phase.AttackRinan:
                {
                    // 21차 확장(2026-09-18) — 구진을 함락한 뒤 이어지는
                    // 교주 사슬의 다음 단계(TargetFrom("jiuzhen")).
                    if (!AttackChainStep(RealmEnemyCity.JiuzhenId, RealmEnemyCity.RinanId, Phase.AttackXianglin)) return;
                    break;
                }

                case Phase.AttackXianglin:
                {
                    // 22차 확장(2026-09-19) — 일남을 함락한 뒤 이어지는
                    // 교주 사슬의 다음 단계(TargetFrom("rinan")).
                    if (!AttackChainStep(RealmEnemyCity.RinanId, RealmEnemyCity.XianglinId, Phase.AttackLuorong)) return;
                    break;
                }

                case Phase.AttackLuorong:
                {
                    // 25차 확장(2026-09-19) — 상림의 둘째 목표(전충과 형제
                    // 가지, 목표가 둘이 됐으니 enemyId 명시 — changan과
                    // 같은 이유).
                    if (!AttackChainStep(RealmEnemyCity.XianglinId, RealmEnemyCity.LuorongId, Phase.AttackZhuwu, RealmEnemyCity.LuorongId)) return;
                    break;
                }

                case Phase.AttackZhuwu:
                {
                    // 30차 확장(2026-09-19) — 노용을 함락한 뒤 이어지는
                    // 교주 사슬의 다음 단계이자 이 갈래의 끝
                    // (TargetFrom("luorong")).
                    if (!AttackChainStep(RealmEnemyCity.LuorongId, RealmEnemyCity.ZhuwuId, Phase.AttackDianchong)) return;
                    break;
                }

                case Phase.AttackDianchong:
                {
                    // 23차 확장(2026-09-19) — 상림의 첫째 목표(25차부터
                    // 노용과 형제 가지가 돼 enemyId 명시).
                    if (!AttackChainStep(RealmEnemyCity.XianglinId, RealmEnemyCity.DianchongId, Phase.AttackBijing, RealmEnemyCity.DianchongId)) return;
                    break;
                }

                case Phase.AttackBijing:
                {
                    // 24차 확장(2026-09-19) — 전충의 첫째 목표(31차부터
                    // 서권과 형제 가지가 돼 enemyId 명시 — xianglin과 같은
                    // 이유).
                    if (!AttackChainStep(RealmEnemyCity.DianchongId, RealmEnemyCity.BijingId, Phase.AttackXiquan, RealmEnemyCity.BijingId)) return;
                    break;
                }

                case Phase.AttackXiquan:
                {
                    // 31차 확장(2026-09-19) — 전충의 둘째 목표(32차부터
                    // 구속과 형제 가지가 돼 enemyId 명시 유지).
                    if (!AttackChainStep(RealmEnemyCity.DianchongId, RealmEnemyCity.XiquanId, Phase.AttackQuzu, RealmEnemyCity.XiquanId)) return;
                    break;
                }

                case Phase.AttackQuzu:
                {
                    // 32차 확장(2026-09-19) — 전충의 셋째이자 마지막 목표
                    // (TargetFrom("dianchong")), 원작에 더 뻗는 LINKS 없어
                    // 전충 갈래가 이걸로 전부 닫힌다.
                    if (!AttackChainStep(RealmEnemyCity.DianchongId, RealmEnemyCity.QuzuId, Phase.Eras, RealmEnemyCity.QuzuId)) return;
                    break;
                }

                case Phase.Eras:
                {
                    // PLAN.md 109-5 세 시대 — 전 적국 함락 뒤(관문 셋·시간 틈 성 아홉이 다 우리 것). 합류한 무장은 뒤 세이브 왕복이 본다.
                    if (!PlaytestRealmEras.Run()) { Fail(); return; }
                    // PLAN.md 109-13 ① 싸움터 땅 — 화면 층이라 판 상태를 안 건드린다.
                    if (!PlaytestRealmBattlefield.Run()) { Fail(); return; }
                    // PLAN.md 109-13-2 지도 위 인물 — 전 성이 우리 것일 때 상한·태수 자리·재야·월드맵 배우 층.
                    if (!PlaytestRealmActors.Run()) { Fail(); return; }
                    _phase = Phase.QuizCorrect;
                    break;
                }

                case Phase.QuizCorrect:
                {
                    var drawn = RealmQuizState.Draw();
                    if (drawn == null)
                    {
                        Debug.LogError("[PlaytestRealmSlice] 문답 출제 실패 — 문제은행이 비었나");
                        Fail();
                        return;
                    }
                    var p = drawn.Value;
                    int goldBefore = RealmCityState.Gold;
                    var result = RealmQuizState.Answer(p, p.CorrectIndex);
                    if (!result.Ok || !result.First || result.Gold <= 0 || RealmCityState.Gold != goldBefore + result.Gold)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 문답 정답 처리 이상 — ok={result.Ok} first={result.First} gold={result.Gold} 금고={RealmCityState.Gold}(기대={goldBefore + result.Gold})");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] quiz correct OK - {p.Q} (+{result.Gold}냥, {result.Why})");
                    _phase = Phase.QuizWrong;
                    break;
                }

                case Phase.QuizWrong:
                {
                    var drawn = RealmQuizState.Draw();
                    if (drawn == null)
                    {
                        Debug.LogError("[PlaytestRealmSlice] 문답 출제 실패(2)");
                        Fail();
                        return;
                    }
                    var p = drawn.Value;
                    int wrongIdx = (p.CorrectIndex + 1) % p.Choices.Length;
                    int goldBefore = RealmCityState.Gold;
                    var result = RealmQuizState.Answer(p, wrongIdx);
                    var progress = RealmQuizState.GetProgress();
                    if (result.Ok || RealmCityState.Gold != goldBefore || progress.Learned < 1 || progress.Answered < 2)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 문답 오답 처리 이상 — ok={result.Ok} gold={RealmCityState.Gold}(기대={goldBefore}) learned={progress.Learned} answered={progress.Answered}");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] quiz wrong OK - {p.Q} (정답은 \"{result.AnswerText}\") learned={progress.Learned}/{progress.Total}");
                    _phase = Phase.QuizArchive;
                    break;
                }

                case Phase.QuizArchive:
                {
                    // 서고 — QuizCorrect에서 익힌 문제 하나가 최근 순 목록
                    // 맨 앞(정확히 하나뿐)에 그대로 있는지 확인한다.
                    var list = RealmQuizState.LearnedList();
                    if (list.Count != 1)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 서고 목록 개수 이상 — count={list.Count}(기대=1)");
                        Fail();
                        return;
                    }
                    var entry = list[0];
                    if (string.IsNullOrEmpty(entry.Q) || string.IsNullOrEmpty(entry.AnswerText) || string.IsNullOrEmpty(entry.Why))
                    {
                        Debug.LogError("[PlaytestRealmSlice] 서고 항목 필드 비어 있음");
                        Fail();
                        return;
                    }
                    Debug.Log($"[PlaytestRealmSlice] quiz archive OK - {entry.Q} (정답: {entry.AnswerText})");
                    _phase = Phase.SaveLoad;
                    break;
                }

                case Phase.SaveLoad:
                {
                    int goldBeforeSave = RealmCityState.Gold;
                    int rosterBeforeSave = RealmCityState.RosterIds.Count;
                    int foundBeforeSave = RealmCityState.FoundIds.Count;
                    int yearBeforeSave = RealmCityState.Year;
                    int monthBeforeSave = RealmCityState.Month;
                    string currentCityBeforeSave = RealmCityState.CurrentCity;
                    int xuchangTechBefore = RealmCityState.CityRecord("xuchang").Tech;
                    int xuchangTroopsBefore = RealmCityState.CityRecord("xuchang").Troops;
                    int chenliuAgriBefore = RealmCityState.CityRecord("chenliu").Agri;
                    int puyangWallBefore = RealmCityState.CityRecord("puyang").Wall;
                    string musashiCityBefore = RealmCityState.OfficerCityId("jp_musashi");
                    string startOfficerCityBefore = RealmCityState.OfficerCityId(RealmOfficerPool.StartingOfficerId);
                    // RealmEnemyCity.AllIds를 도는 걸로 해 뒀다 — 51장이 더 늘려도
                    // (code-review 지적) 여기 손대는 걸 잊을 일이 없다.
                    var enemyAgriBefore = new Dictionary<string, int>();
                    var enemySnapBefore = new Dictionary<string, (int wall, int maxWall, int troops, int train, int tech, bool captured)>();
                    foreach (var enemyId in RealmEnemyCity.AllIds)
                    {
                        enemyAgriBefore[enemyId] = RealmCityState.CityRecord(enemyId).Agri;
                        enemySnapBefore[enemyId] = RealmWarState.Snapshot(enemyId);
                    }
                    var quizBefore = RealmQuizState.GetProgress();
                    // 101-2 5-5 "승리 조건"(2026-09-20) — 위 AttackXxx 단계들이
                    // RealmEnemyCity.AllIds 전부를 이미 함락했으니 이 시점엔
                    // 정복 승리가 확정돼 있어야 한다(RealmSessionTracker가
                    // RealmCityState.Changed마다 RealmVictoryState.CheckResult()를
                    // 부른다).
                    if (RealmVictoryState.Result != RealmVictoryState.Kind.Conquest)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 전 적국 함락 뒤인데 승리 조건이 정복이 아님(result={RealmVictoryState.Result})");
                        Fail();
                        return;
                    }

                    if (!RealmSaveState.Save())
                    {
                        Debug.LogError("[PlaytestRealmSlice] RealmSaveState.Save() 실패");
                        Fail();
                        return;
                    }

                    // 상태를 흩트린 뒤(성 다섯 — 함락한 소패·정도 포함 — 전부
                    // 엉터리 값으로) 다시 불러와 그대로 돌아오는지 확인.
                    var dummyCities = new List<RealmCityState.CitySnapshot>();
                    foreach (var id in RealmCityData.AllCityIds.Concat(RealmEnemyCity.AllIds))
                    {
                        dummyCities.Add(new RealmCityState.CitySnapshot
                        {
                            CityId = id, Agri = 1, Comm = 1, Tech = 1, Sec = 1, Wall = 1,
                            Train = 1, Ships = 1, Pop = 1, Troops = 1, Food = 1,
                        });
                    }
                    RealmCityState.Restore(999, 1, 1, "puyang",
                        new List<string> { "sg_zhugeliang" }, null, null,
                        new List<string> { "sg_zhugeliang" }, new List<string> { "xuchang" },
                        dummyCities);
                    foreach (var enemyId in RealmEnemyCity.AllIds) RealmWarState.Restore(enemyId, 1, 1, 1, 1, 1, false);
                    RealmQuizState.Restore(new List<string>(), null, null, 0, 0, 0, 0);
                    RealmVictoryState.Restore(null); // 101-2 5-5 — round-trip 검증을 위해 진짜로 흩트린다.

                    if (!RealmSaveState.TryLoad())
                    {
                        Debug.LogError("[PlaytestRealmSlice] RealmSaveState.TryLoad() 실패");
                        Fail();
                        return;
                    }
                    bool enemyMismatch = false;
                    foreach (var enemyId in RealmEnemyCity.AllIds)
                    {
                        if (RealmWarState.Snapshot(enemyId) != enemySnapBefore[enemyId] ||
                            !RealmCityState.ActiveCityIds.Contains(enemyId) ||
                            RealmCityState.CityRecord(enemyId).Agri != enemyAgriBefore[enemyId])
                        {
                            enemyMismatch = true;
                            break;
                        }
                    }
                    bool mismatch = RealmCityState.Gold != goldBeforeSave ||
                        RealmCityState.RosterIds.Count != rosterBeforeSave ||
                        RealmCityState.FoundIds.Count != foundBeforeSave ||
                        RealmCityState.Year != yearBeforeSave ||
                        RealmCityState.Month != monthBeforeSave ||
                        RealmCityState.CurrentCity != currentCityBeforeSave ||
                        RealmCityState.CityRecord("xuchang").Tech != xuchangTechBefore ||
                        RealmCityState.CityRecord("xuchang").Troops != xuchangTroopsBefore ||
                        RealmCityState.CityRecord("chenliu").Agri != chenliuAgriBefore ||
                        RealmCityState.CityRecord("puyang").Wall != puyangWallBefore ||
                        RealmCityState.OfficerCityId("jp_musashi") != musashiCityBefore ||
                        enemyMismatch ||
                        RealmCityState.OfficerCityId(RealmOfficerPool.StartingOfficerId) != startOfficerCityBefore ||
                        RealmVictoryState.Result != RealmVictoryState.Kind.Conquest;
                    var quizAfter = RealmQuizState.GetProgress();
                    bool quizMismatch = quizAfter.Learned != quizBefore.Learned || quizAfter.Answered != quizBefore.Answered ||
                        quizAfter.Correct != quizBefore.Correct || quizAfter.Streak != quizBefore.Streak ||
                        quizAfter.BestStreak != quizBefore.BestStreak;
                    if (mismatch || quizMismatch)
                    {
                        Debug.LogError($"[PlaytestRealmSlice] 로드 후 불일치 발생 (성 스물하나/로스터/성 소속/적국 열여덟 전황/문답 중 하나) — quizMismatch={quizMismatch}");
                        Fail();
                        return;
                    }

                    Debug.Log("[PlaytestRealmSlice] save/load round-trip OK (21 cities incl. captured xiaopei/dingtao/luoyang/xiapi/ye/changan/shouchun/jinyang/hanzhong/runan/chengdu/jiangxia/jiangzhou/xiangyang/yongan/jiangling/changsha/chaisang + roster + officer city assignment + quiz progress)");
                    EditorApplication.update -= Tick;
                    EditorApplication.isPlaying = false;
                    _phase = Phase.Done;
                    break;
                }
            }
        }

        /// <summary>51장 확장 사슬(AttackLuoyang~AttackJiangling)이 전부
        /// 쓰는 공용 트릭 — 무장 전임은 범위 밖이라(godot 3절 "뺀 것")
        /// RealmCityState.Restore()로 시작 무장을 fromCityId에 잠깐
        /// "심어" 출진 조건만 채우고, 병력·군량을 압도적으로 채운 뒤
        /// Attack()을 불러 함락·편입까지 확인한다. 실패하면 Fail()을
        /// 부르고 false를 반환하니 호출부는 `if (!AttackChainStep(...))
        /// return;` 한 줄이면 된다.
        /// (code-review 지적, 2026-09-16 — 14벌 거의 동일한 ~30줄
        /// 블록을 손으로 복사해 오던 것을 여기 하나로 모았다. 새 사슬을
        /// 늘릴 때 도시 id 하나 잘못 옮겨 적는 실수를 원천 차단한다.)
        /// <paramref name="enemyId"/>는 51장 16차 확장(2026-09-18)부터 —
        /// fromCityId가 목표를 둘 이상 가진 성이면 `RealmWarState.Attack()`
        /// 이 어느 쪽인지 모호해지니 명시한다(생략하면 옛날처럼
        /// `TargetFrom`의 단일 값에 맡긴다, 목표가 하나뿐인 성은 그대로
        /// 안전).</summary>
        private static bool AttackChainStep(string fromCityId, string expectedCapturedId, Phase nextPhase, string enemyId = null)
        {
            var roster = new List<string>(RealmCityState.RosterIds);
            var officerCityIds = new List<string>();
            var officerCityCities = new List<string>();
            foreach (var id in roster)
            {
                officerCityIds.Add(id);
                officerCityCities.Add(id == RealmOfficerPool.StartingOfficerId ? fromCityId : RealmCityState.OfficerCityId(id));
            }
            RealmCityState.Restore(RealmCityState.Gold, RealmCityState.Year, RealmCityState.Month,
                fromCityId, roster, null, new List<string>(RealmCityState.FoundIds),
                officerCityIds, officerCityCities, RealmCityState.SnapshotCities());

            var city = RealmCityState.CityRecord(fromCityId);
            city.Troops = 100000;
            city.Food = 100000;

            var result = RealmWarState.Attack(fromCityId, enemyId);
            if (!result.Ok || !result.Won || RealmCityState.CityRecord(expectedCapturedId) == null ||
                !RealmCityState.ActiveCityIds.Contains(expectedCapturedId))
            {
                string label = RealmEnemyCity.Get(expectedCapturedId)?.Name ?? expectedCapturedId;
                Debug.LogError($"[PlaytestRealmSlice] {label} 공략 실패 — ok={result.Ok} won={result.Won} msg={result.Message}");
                Fail();
                return false;
            }
            Debug.Log($"[PlaytestRealmSlice] {expectedCapturedId} attack + absorb OK - {result.Message}");
            RealmCityState.SetCurrentCity("xuchang");
            _phase = nextPhase;
            return true;
        }

        private static void Fail()
        {
            _hadError = true;
            EditorApplication.update -= Tick;
            EditorApplication.isPlaying = false;
        }

        private static T GetPrivateField<T>(object target, string fieldName) where T : class
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.NonPublic | BindingFlags.Instance);
            return field?.GetValue(target) as T;
        }

        /// <summary>PLAN.md 101-2 "공통 선행" A·B(REALM 다섯 번째·마지막 이식) —
        /// `PlaytestHeadless.CheckGoalBoardAndSessionCard()`(GO)·DUNGEON·
        /// FOREST·STORY와 같은 기준(구조만): GoalBoard 세 줄이 실제로
        /// 채워지는지, Awake()의 IGoalSource 자동 재탐색이 동작하는지,
        /// SessionCard가 세션 시작부터 떠 있진 않은지. "실제로 뜨는지"는
        /// 여기서 합성 Show()로 때우지 않고 Phase.Agri 의 첫 "다음 달" 뒤에서
        /// 진짜 트리거로 확인한다(REALM 은 무입력이 아니라 월간이 트리거라
        /// 이 구조 체크 시점엔 아직 안 떠 있는 게 정상).</summary>
        private static bool CheckGoalBoardAndSessionCard()
        {
            var board = Object.FindFirstObjectByType<GoalBoard>();
            if (board == null)
            {
                Debug.LogError("[PlaytestRealmSlice] GoalBoard 컴포넌트를 못 찾음");
                return false;
            }

            if (GetPrivateField<object>(board, "_source") == null)
            {
                Debug.LogError("[PlaytestRealmSlice] GoalBoard._source가 null — Awake() 자동 재탐색 실패");
                return false;
            }

            var label = GetPrivateField<TextMeshProUGUI>(board, "_label");
            if (label == null || !label.text.Contains(Saga.Core.SagaUi.L("지금", "Now") + " —") || !label.text.Contains(Saga.Core.SagaUi.L("이번 세션", "This session") + " —") || !label.text.Contains(Saga.Core.SagaUi.L("이번 주", "This week") + " —"))
            {
                Debug.LogError($"[PlaytestRealmSlice] GoalBoard 세 줄이 안 채워짐 text=\"{(label == null ? "null" : label.text.Replace("\n", " | "))}\"");
                return false;
            }

            var card = Object.FindFirstObjectByType<SessionCard>();
            if (card == null)
            {
                Debug.LogError("[PlaytestRealmSlice] SessionCard 컴포넌트를 못 찾음");
                return false;
            }
            if (card.IsShowing)
            {
                Debug.LogError("[PlaytestRealmSlice] SessionCard가 세션 시작부터 떠 있음(기본은 숨김)");
                return false;
            }

            if (Object.FindFirstObjectByType<RealmSessionTracker>() == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmSessionTracker 컴포넌트를 못 찾음");
                return false;
            }
            return true;
        }

        /// <summary>PLAN.md 101-2 5-1 "인물 특성·야망"(2026-09-20) — 값으로
        /// 확인 가능한 것만 본다(팝업·배지 문구 자체는 실기 확인 몫).
        /// ① 특성 결정성(같은 id → 같은 특성 조합, 두 번 불러도 같음),
        /// ② 계략 성공률 배율이 실제로 `RealmWarState.PreviewPlotChance`
        /// 값을 바꾸는지, ③ 금 5000 달성 시 "부귀" 야망이 실제로 완료
        /// 처리되고 보상이 한 번만 지급되는지(재확인해도 중복 지급 없음).</summary>
        private static bool CheckOfficerTraits()
        {
            var traitsA = RealmOfficerTraits.TraitsOf(RealmOfficerPool.StartingOfficerId);
            var traitsB = RealmOfficerTraits.TraitsOf(RealmOfficerPool.StartingOfficerId);
            if (traitsA.Length != 2 || traitsA[0] != traitsB[0] || traitsA[1] != traitsB[1])
            {
                Debug.LogError("[PlaytestRealmSlice] 특성이 결정적이지 않음(같은 id인데 두 번 다른 결과)");
                return false;
            }

            // 교활 특성이 있는 무장을 찾아(3명 중 최소 하나는 있어야 조합상
            // 보장된다 — TraitPairs 세 조합 중 Cunning이 없는 건 없음) 계략
            // 성공률 미리보기가 실제로 배율만큼 오르는지 본다.
            string cunningId = null;
            foreach (var id in new[] { "sg_zhugeliang", "kr_yisunsin", "jp_musashi" })
            {
                if (RealmOfficerTraits.Has(id, RealmOfficerTraits.Trait.Cunning)) { cunningId = id; break; }
            }
            if (cunningId == null)
            {
                Debug.LogError("[PlaytestRealmSlice] 시작 무장 셋 중 교활 특성 보유자가 없음(조합표가 깨졌을 가능성)");
                return false;
            }
            var officer = RealmOfficerPool.Get(cunningId);
            float baseChance = Mathf.Clamp(0.30f + (officer.Wisdom - 30) / 200f, 0.05f, 0.9f);
            float withTrait = Mathf.Clamp(baseChance * RealmOfficerTraits.PlotChanceMultiplier(cunningId), 0.05f, 0.9f);
            if (Mathf.Approximately(baseChance, withTrait) && baseChance < 0.9f)
            {
                Debug.LogError($"[PlaytestRealmSlice] 교활 특성이 계략 성공률에 안 반영됨 — base={baseChance} withTrait={withTrait}");
                return false;
            }

            // 야망 달성 — 로스터 유일 무장(허창의 현책)에게 배정된 야망이
            // "부귀"가 아니어도 AmbitionProgress()가 종류에 맞는 목표를
            // 돌려주는지만 우선 보고, 실제 완료는 금을 직접 채워 값으로 본다.
            string startId = RealmOfficerPool.StartingOfficerId;
            if (RealmOfficerTraits.IsAmbitionDone(startId))
            {
                Debug.LogError("[PlaytestRealmSlice] 새 게임인데 시작 무장 야망이 이미 달성 상태");
                return false;
            }

            var kind = RealmOfficerTraits.AmbitionOf(startId);
            if (kind == RealmOfficerTraits.Ambition.Wealth)
            {
                // 이미 배정된 야망이 "부귀"면 목표까지 직접 채워 달성 경로를 본다.
                RealmCityState.AddGold(6000);
                if (!RealmOfficerTraits.IsAmbitionDone(startId))
                {
                    Debug.LogError("[PlaytestRealmSlice] 금 6000을 채웠는데 부귀 야망이 완료되지 않음");
                    return false;
                }
                int goldAfterFirst = RealmCityState.Gold;
                RealmCityState.AddGold(1); // Changed를 한 번 더 울려도 중복 지급 없는지.
                if (RealmCityState.Gold != goldAfterFirst + 1)
                {
                    Debug.LogError("[PlaytestRealmSlice] 부귀 야망 보상이 중복 지급됨");
                    return false;
                }
            }
            else
            {
                // 다른 야망이 배정됐으면 진행도 API 자체가 예외 없이 도는지만
                // 확인한다(구체적 달성 경로는 위 부귀 분기가 이미 검증).
                var (current, target) = RealmOfficerTraits.AmbitionProgress(startId);
                if (target <= 0)
                {
                    Debug.LogError($"[PlaytestRealmSlice] 야망({kind}) 목표값이 0 이하 — current={current} target={target}");
                    return false;
                }
            }

            Debug.Log("[PlaytestRealmSlice] officer traits/ambition OK - 결정성·계략 배율·야망 달성+중복 방지 확인");
            return true;
        }

        /// <summary>PLAN.md 101-2 5-6 "지형·진형 전술 개입" — `ResolveTactic()`은
        /// private이라 리플렉션으로 직접 불러 순수 판정만 본다(사이드 이펙트
        /// 없음, 게임 진행 상태를 안 건드려 다른 phase와 안 부딪힌다).
        /// ① 평야 기병 돌격 — 무력 80 미만 조합은 배율 1, 80 이상 조합은
        /// 1.25, ② 강 화공 — 지력 60 미만은 배율 1, 60 이상은 defMul 0.85,
        /// ③ 힌트 문구가 성마다 지형에 맞게 나오는지.</summary>
        private static bool CheckTactic()
        {
            var method = typeof(RealmWarState).GetMethod("ResolveTactic", BindingFlags.NonPublic | BindingFlags.Static);
            if (method == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmWarState.ResolveTactic()을 리플렉션으로 못 찾음");
                return false;
            }

            // 현책(무력 38)만 있으면 기병 돌격 문턱 미달, 해장(무력 92)이 있으면 충족.
            var weakMight = new List<string> { "sg_zhugeliang" };
            var strongMight = new List<string> { "sg_zhugeliang", "kr_yisunsin" };
            var weakResult = ((float firstRoundMul, float defMul, string note))method.Invoke(null, new object[] { RealmLand.Plain, weakMight });
            var strongResult = ((float firstRoundMul, float defMul, string note))method.Invoke(null, new object[] { RealmLand.Plain, strongMight });
            if (!Mathf.Approximately(weakResult.firstRoundMul, 1f) || !Mathf.Approximately(strongResult.firstRoundMul, 1.25f))
            {
                Debug.LogError($"[PlaytestRealmSlice] 평야 기병 돌격 배율이 이상함 — 무력 부족={weakResult.firstRoundMul}(기대 1) 무력 충분={strongResult.firstRoundMul}(기대 1.25)");
                return false;
            }

            // 셋 다 지력 70 이상이라(현책 100·해장 98·이도인 70) 화공은 항상 성공한다 —
            // 문턱 미달 경로는 빈 리스트로 대신 본다(RealmOfficerPool.Get이 null을 걸러 bestWisdom=0).
            var noOfficer = new List<string>();
            var anyOfficer = new List<string> { "sg_zhugeliang" };
            var noneResult = ((float firstRoundMul, float defMul, string note))method.Invoke(null, new object[] { RealmLand.River, noOfficer });
            var fireResult = ((float firstRoundMul, float defMul, string note))method.Invoke(null, new object[] { RealmLand.River, anyOfficer });
            if (!Mathf.Approximately(noneResult.defMul, 1f) || !Mathf.Approximately(fireResult.defMul, 0.85f))
            {
                Debug.LogError($"[PlaytestRealmSlice] 강 화공 배율이 이상함 — 무장 없음={noneResult.defMul}(기대 1) 현책={fireResult.defMul}(기대 0.85)");
                return false;
            }

            string hint = RealmWarState.TacticHintFrom("xuchang");
            if (string.IsNullOrEmpty(hint))
            {
                Debug.LogError("[PlaytestRealmSlice] TacticHintFrom(xuchang)이 빈 문자열 — 허창은 소패(평야)를 쳐야 정상");
                return false;
            }

            Debug.Log($"[PlaytestRealmSlice] tactic OK - 평야 기병 돌격/강 화공 배율 문턱 확인, 힌트=\"{hint}\"");
            return true;
        }

        /// <summary>PLAN.md 101-2 5-3 "일기토" — ① 베기>막기·막기>찌르기·
        /// 찌르기>베기 순환과 비김 판정, ② 승/무/패 배율(1.3/1.0/0.8),
        /// ③ 3합 평균 배율 산술, ④ 그 배율(duelPowerMul)이 실제로
        /// RealmWar.Fight() 결과를 바꾸는지(같은 RNG 시드에서 배율만
        /// 다르게 — 사이드 이펙트 없는 합성 부대라 게임 진행 상태를
        /// 안 건드린다, CheckTactic()과 같은 관행)까지 본다.</summary>
        private static bool CheckDuel()
        {
            if (RealmDuelState.RoundResult("slash", "guard") != "win"
                || RealmDuelState.RoundResult("guard", "stab") != "win"
                || RealmDuelState.RoundResult("stab", "slash") != "win"
                || RealmDuelState.RoundResult("slash", "stab") != "lose"
                || RealmDuelState.RoundResult("slash", "slash") != "tie")
            {
                Debug.LogError("[PlaytestRealmSlice] 일기토 — 베기/찌르기/막기 순환 판정이 틀림");
                return false;
            }
            if (!Mathf.Approximately(RealmDuelState.RoundMul("win"), 1.3f)
                || !Mathf.Approximately(RealmDuelState.RoundMul("tie"), 1.0f)
                || !Mathf.Approximately(RealmDuelState.RoundMul("lose"), 0.8f))
            {
                Debug.LogError("[PlaytestRealmSlice] 일기토 — 승/무/패 배율이 웹판 수치(1.3/1.0/0.8)와 다름");
                return false;
            }
            float avg = RealmDuelState.AverageMul(new List<string> { "win", "tie", "lose" });
            if (!Mathf.Approximately(avg, (1.3f + 1.0f + 0.8f) / 3f))
            {
                Debug.LogError($"[PlaytestRealmSlice] 일기토 — 3합 평균 배율 계산이 틀림(avg={avg})");
                return false;
            }

            RealmArmy MakeAtk() => new RealmArmy { Troops = 3000, Start = 3000, Train = 50, Tech = 300, OfficerIds = new List<string> { RealmOfficerPool.StartingOfficerId }, Morale = 1f };
            RealmEnemyRecord MakeWallRef() => new RealmEnemyRecord { Wall = 50, MaxWall = 50, Troops = 3000, Train = 50, Tech = 300 };

            Random.InitState(20260920);
            var wallRefLow = MakeWallRef();
            var defLow = new RealmArmy { Troops = wallRefLow.Troops, Start = wallRefLow.Troops, Train = wallRefLow.Train, Tech = wallRefLow.Tech, OfficerIds = new List<string>(), Morale = 1f };
            var resultLow = RealmWar.Fight(MakeAtk(), defLow, wallRefLow, RealmLand.Plain, 1f, 1f, 0.8f);

            Random.InitState(20260920);
            var wallRefHigh = MakeWallRef();
            var defHigh = new RealmArmy { Troops = wallRefHigh.Troops, Start = wallRefHigh.Troops, Train = wallRefHigh.Train, Tech = wallRefHigh.Tech, OfficerIds = new List<string>(), Morale = 1f };
            var resultHigh = RealmWar.Fight(MakeAtk(), defHigh, wallRefHigh, RealmLand.Plain, 1f, 1f, 1.3f);

            if (resultHigh.LossD <= resultLow.LossD)
            {
                Debug.LogError($"[PlaytestRealmSlice] 일기토 — duelPowerMul이 커져도(0.8→1.3) 적 손실이 안 늘어남(low={resultLow.LossD}, high={resultHigh.LossD})");
                return false;
            }

            Debug.Log($"[PlaytestRealmSlice] duel OK - 순환·배율·평균 산술 확인, duelPowerMul이 Fight() 결과에 반영됨(적 손실 {resultLow.LossD}→{resultHigh.LossD})");
            return true;
        }

        /// <summary>PLAN.md 101-2 5-3 "설전" — ① 사자 지력에 따른 난도 상한
        /// (70+→3등급, 40+→2등급, 그 밖 1등급) 필터링, ② 정답 수(0~3) →
        /// 배율(0.8/0.95/1.1/1.3) 매핑, ③ RealmCityState.HireChance()가
        /// (private, ResolveTactic()과 같은 관행으로 리플렉션) debateMul을
        /// 실제로 곱해 같은 구간(0.05~0.9)으로 다시 눌러 담는지까지 본다.</summary>
        private static bool CheckDebateHire()
        {
            var lowDrawn = RealmDebateState.Draw(20);
            foreach (var q in lowDrawn)
            {
                if (RealmQuizData.ById(q.Id).Lv > 1)
                {
                    Debug.LogError($"[PlaytestRealmSlice] 설전 — 지력 20인데 Lv{RealmQuizData.ById(q.Id).Lv} 문제가 뽑힘(1등급만 나와야 함)");
                    return false;
                }
            }
            var highDrawn = RealmDebateState.Draw(90);
            bool sawLv3 = false;
            for (int i = 0; i < 20 && !sawLv3; i++)
            {
                foreach (var q in RealmDebateState.Draw(90)) if (RealmQuizData.ById(q.Id).Lv == 3) sawLv3 = true;
            }
            if (!sawLv3)
            {
                Debug.LogError("[PlaytestRealmSlice] 설전 — 지력 90인데 20회 추첨에도 Lv3 문제가 한 번도 안 나옴(3등급까지 열려야 함)");
                return false;
            }
            if (highDrawn.Count != RealmDebateState.Rounds)
            {
                Debug.LogError($"[PlaytestRealmSlice] 설전 — 3문이 아니라 {highDrawn.Count}문이 뽑힘");
                return false;
            }

            // Result() — 전부 정답(0번, Present()가 correctIndex를 알려준다)·
            // 전부 오답(correctIndex+1을 mod 4로 어긋나게)일 때 배율 매핑 확인.
            var allCorrect = new List<int>();
            var allWrong = new List<int>();
            foreach (var q in highDrawn)
            {
                allCorrect.Add(q.CorrectIndex);
                allWrong.Add((q.CorrectIndex + 1) % 4);
            }
            var (correctN, mulN) = RealmDebateState.Result(highDrawn, allCorrect);
            var (wrongN, mulW) = RealmDebateState.Result(highDrawn, allWrong);
            if (correctN != 3 || !Mathf.Approximately(mulN, 1.3f) || wrongN != 0 || !Mathf.Approximately(mulW, 0.8f))
            {
                Debug.LogError($"[PlaytestRealmSlice] 설전 — 정답 수→배율 매핑이 틀림(전정답 correct={correctN} mul={mulN}, 전오답 correct={wrongN} mul={mulW})");
                return false;
            }

            var method = typeof(RealmCityState).GetMethod("HireChance", BindingFlags.NonPublic | BindingFlags.Static);
            if (method == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCityState.HireChance()를 리플렉션으로 못 찾음");
                return false;
            }
            float baseChance = (float)method.Invoke(null, new object[] { 100, 2, 1f });
            float boosted = (float)method.Invoke(null, new object[] { 100, 2, 1.3f });
            float reduced = (float)method.Invoke(null, new object[] { 100, 2, 0.8f });
            float capped = (float)method.Invoke(null, new object[] { 100, 2, 5f }); // 극단값도 0.9를 못 넘어야.
            if (!(boosted > baseChance) || !(reduced < baseChance) || capped > 0.9f)
            {
                Debug.LogError($"[PlaytestRealmSlice] 설전 — debateMul이 등용 성공률에 안 반영되거나 상한을 넘음(base={baseChance} boosted={boosted} reduced={reduced} capped={capped})");
                return false;
            }

            Debug.Log($"[PlaytestRealmSlice] debate OK - 난도 문턱·3문 추첨·정답수→배율 매핑·HireChance() debateMul 반영·상한 클램프 전부 확인");
            return true;
        }

        /// <summary>PLAN.md 101-2 5-2 "관계·이벤트 체인"(2026-09-20) —
        /// ① 카드 7종 전부 제목·본문·선택지 3개가 채워지는지, ② 결투
        /// 신청(A)이 이길 때까지 반복하면 금이 늘고 3달 뒤 논공행상
        /// 체인이 예약되는지, ③ 월간 확률(18%)이 반복 호출하면 통계적으로
        /// 곧 하나는 뜨는지, ④ 응답 뒤 Current가 비워져 같은 카드가 다시
        /// 안 뜨는지. 시작 무장(현책) 하나로 Describe/Resolve를 직접
        /// 불러 확인한다(UI 버튼 클릭 시뮬레이션은 이 파일 관행대로 안 함).</summary>
        private static bool CheckEventChain()
        {
            foreach (RealmEventState.Kind kind in System.Enum.GetValues(typeof(RealmEventState.Kind)))
            {
                var card = new RealmEventState.Card(kind, RealmOfficerPool.StartingOfficerId);
                var (title, body, a, b, c) = RealmEventState.Describe(card);
                if (string.IsNullOrEmpty(title) || string.IsNullOrEmpty(body) ||
                    string.IsNullOrEmpty(a) || string.IsNullOrEmpty(b) || string.IsNullOrEmpty(c))
                {
                    Debug.LogError($"[PlaytestRealmSlice] 이벤트 카드({kind}) 서술 누락 — title/body/선택지 중 빔");
                    return false;
                }
            }

            RealmEventState.ClearForTest();
            var duelCard = new RealmEventState.Card(RealmEventState.Kind.BraveChallenge, RealmOfficerPool.StartingOfficerId);
            bool wonOnce = false;
            for (int i = 0; i < 200 && !wonOnce; i++)
            {
                int before = RealmCityState.Gold;
                RealmEventState.Resolve(duelCard, RealmEventState.Choice.A);
                if (RealmCityState.Gold > before) wonOnce = true;
            }
            if (!wonOnce)
            {
                Debug.LogError("[PlaytestRealmSlice] 결투 신청 200회 시도했는데 한 번도 안 이김(확률표 이상 의심)");
                return false;
            }
            if (!RealmEventState.HasPendingChain(RealmEventState.Kind.BraveReward))
            {
                Debug.LogError("[PlaytestRealmSlice] 결투 승리 뒤 논공행상 체인이 예약되지 않음");
                return false;
            }

            RealmEventState.ClearForTest();
            bool presented = false;
            for (int i = 0; i < 100 && !presented; i++)
            {
                RealmEventState.RollForMonth();
                presented = RealmEventState.Current != null;
            }
            if (!presented)
            {
                Debug.LogError("[PlaytestRealmSlice] RollForMonth 100회 중 카드가 한 번도 안 뜸(확률 이상 의심)");
                return false;
            }

            var current = RealmEventState.Current.Value;
            RealmEventState.Resolve(current, RealmEventState.Choice.B); // "거절/무시" 계열 — 효과 없이 안전하게 닫히는지.
            if (RealmEventState.Current != null)
            {
                Debug.LogError("[PlaytestRealmSlice] 이벤트 응답 뒤에도 Current가 안 비워짐");
                return false;
            }

            RealmEventState.ClearForTest();
            Debug.Log("[PlaytestRealmSlice] event chain OK - 카드 7종 서술·결투 승리 체인 예약·월간 확률·응답 뒤 카드 해제 확인");
            return true;
        }


        /// <summary>PLAN.md 101-2 5-8 "허창 자리 계승"(2026-09-20) — Phase
        /// .AgriByNewOfficer 시점(로스터가 방금 2명이 된 직후)에서 확인한다.
        /// 기본 꺼짐 토글을 테스트 동안만 켜고, 낮은 확률을 500회 반복으로
        /// 통계적으로 터뜨려 ① 허창 배치가 실제로 로스터의 다른 무장에게
        /// 넘어가는지 ② 허창 치안이 절반으로 깎이는지 ③ 안내 문구가 비지
        /// 않는지 본 뒤, 이후 phase에 영향이 없도록 배치·치안·토글을 전부
        /// 원래대로 되돌린다(맞바꾸기 자체가 자기 역인 연산이라 한 번 더
        /// 불러 복원).</summary>
        private static bool CheckSuccession()
        {
            bool originalToggle = RealmSettingsState.SuccessionOn;
            RealmSettingsState.SuccessionOn = true;

            string capitalId = null;
            foreach (var id in RealmCityState.RosterIds)
            {
                if (RealmCityState.OfficerCityId(id) == RealmOfficerPool.StartingOfficerCityId) { capitalId = id; break; }
            }
            string otherId = null;
            foreach (var id in RealmCityState.RosterIds)
            {
                if (id != capitalId) { otherId = id; break; }
            }
            if (capitalId == null || otherId == null)
            {
                Debug.LogError($"[PlaytestRealmSlice] 계승 검증 준비 실패 — capitalId={capitalId} otherId={otherId}(로스터 2명 이상 필요)");
                RealmSettingsState.SuccessionOn = originalToggle;
                return false;
            }

            string otherPrevCity = RealmCityState.OfficerCityId(otherId);
            int secBefore = RealmCityState.CityRecord(RealmOfficerPool.StartingOfficerCityId).Sec;

            string message = null;
            System.Action<string> handler = m => message = m;
            RealmSuccessionState.Occurred += handler;

            bool triggered = false;
            for (int i = 0; i < 500 && !triggered; i++)
            {
                RealmSuccessionState.RollForMonth();
                triggered = message != null;
            }
            RealmSuccessionState.Occurred -= handler;

            if (!triggered)
            {
                Debug.LogError("[PlaytestRealmSlice] 계승 500회 시도했는데 한 번도 안 일어남(확률표 이상 의심)");
                RealmSettingsState.SuccessionOn = originalToggle;
                return false;
            }
            if (string.IsNullOrEmpty(message) ||
                RealmCityState.OfficerCityId(otherId) != RealmOfficerPool.StartingOfficerCityId ||
                RealmCityState.OfficerCityId(capitalId) != otherPrevCity)
            {
                Debug.LogError($"[PlaytestRealmSlice] 계승 배치 결과가 이상함 — otherId 배치={RealmCityState.OfficerCityId(otherId)}(기대 허창) capitalId 배치={RealmCityState.OfficerCityId(capitalId)}(기대 {otherPrevCity}) msg=\"{message}\"");
                RealmSettingsState.SuccessionOn = originalToggle;
                return false;
            }
            int secAfter = RealmCityState.CityRecord(RealmOfficerPool.StartingOfficerCityId).Sec;
            if (secAfter != secBefore / 2)
            {
                Debug.LogError($"[PlaytestRealmSlice] 계승 뒤 허창 치안이 절반이 아님 — before={secBefore} after={secAfter}(기대 {secBefore / 2})");
                RealmSettingsState.SuccessionOn = originalToggle;
                return false;
            }

            // 이후 phase(계략·전쟁)가 원래 배치를 전제하므로 되돌린다 —
            // 맞바꾸기는 자기 역이라 같은 두 id로 한 번 더 부르면 원상복귀.
            RealmCityState.SwapOfficerCities(capitalId, otherId);
            RealmCityState.CityRecord(RealmOfficerPool.StartingOfficerCityId).Sec = secBefore;
            RealmSettingsState.SuccessionOn = originalToggle;

            Debug.Log($"[PlaytestRealmSlice] succession OK - 허창 배치 계승·치안 절반 하락·안내 문구 확인, 이후 phase용으로 배치·치안·토글 원복(\"{message}\")");
            return true;
        }

        /// <summary>PLAN.md 67~69장 "접근성"(2026-09-14) — GO
        /// `PlaytestHeadless.CheckSettingsPanel()`과 같은 결. 이 파일도
        /// STORY처럼 새 Phase를 안 늘리고 Init 안에서 한 번만 부른다.</summary>
        private static bool CheckSettingsPanel()
        {
            // REALM엔 GO/DUNGEON/FOREST/STORY 같은 독립 XxxSettingsPanel
            // GameObject가 없다 — RealmCommandUi가 스스로 짓는 캔버스 안에
            // "설정" 버튼+패널로 얹혀 있다(RealmCommandUi.Build() 참고).
            // 버튼은 이름이 "Btn_설정"이라 그걸로 찾는다.
            if (GameObject.Find("Btn_설정") == null)
            {
                Debug.LogError("[PlaytestRealmSlice] 설정 버튼(Btn_설정)을 못 찾음");
                return false;
            }

            bool sfxBefore = RealmSettingsState.SfxOn;
            RealmSettingsState.SfxOn = !sfxBefore;
            bool vibBefore = RealmSettingsState.VibrationOn;
            RealmSettingsState.VibrationOn = !vibBefore;
            if (RealmSettingsState.SfxOn == sfxBefore || RealmSettingsState.VibrationOn == vibBefore)
            {
                Debug.LogError("[PlaytestRealmSlice] 효과음/진동 토글이 안 바뀜");
                return false;
            }

            RealmSettingsState.UiScaleMultiplier = 1.15f;
            var scaler = Saga.Core.SagaUi.FirstGameScaler(); // Ⅱ 단추 등 메뉴 캔버스는 뺀다(110 ⑤c)
            float expected = Saga.Core.SagaUi.GameReference.x / 1.15f; // 110 ⑤b 기준 1600×900
            if (scaler == null || Mathf.Abs(scaler.referenceResolution.x - expected) > 1f)
            {
                Debug.LogError($"[PlaytestRealmSlice] UI 크기가 캔버스에 안 먹음 — got={(scaler == null ? "null" : scaler.referenceResolution.x.ToString())}");
                return false;
            }
            RealmSettingsState.UiScaleMultiplier = 1f;

            RealmSettingsState.HighGraphicsQuality = false;
            if (!Mathf.Approximately(QualitySettings.shadowDistance, 15f) || QualitySettings.antiAliasing != 0)
            {
                Debug.LogError($"[PlaytestRealmSlice] 그래픽 품질(절약)이 QualitySettings에 안 먹음 — shadowDistance={QualitySettings.shadowDistance} aa={QualitySettings.antiAliasing}");
                return false;
            }
            RealmSettingsState.HighGraphicsQuality = true;

            string langBefore = RealmLocalization.CurrentLanguage;
            string qualityLabelBefore = RealmSettingsState.GraphicsQualityLabel();
            RealmLocalization.CycleLanguage();
            if (RealmLocalization.CurrentLanguage == langBefore
                || RealmSettingsState.GraphicsQualityLabel() == qualityLabelBefore)
            {
                Debug.LogError("[PlaytestRealmSlice] 언어 전환이 실제 문구를 안 바꿈");
                return false;
            }
            RealmLocalization.CurrentLanguage = langBefore;

            Debug.Log("[PlaytestRealmSlice] settings panel OK - sfx/vibration/ui-scale/graphics-quality/language all verified");
            return true;
        }

        /// <summary>2026-09-15 발견 — RealmCommandUi의 패널/라벨 참조
        /// 필드가 전부 [SerializeField] 없이 Build()(에디터에서 딱 한 번)
        /// 로만 채워져 있어서, 씬을 저장·재로드한 뒤(=실제 플레이 환경)
        /// 전부 null이었다(리플렉션 덤프로 직접 확인). 그런데도
        /// CheckSettingsPanel()은 GameObject.Find로 버튼 "존재"만 보고
        /// ToggleSettingsPanel() 등 RealmCommandUi 자신의 메서드는 한 번도
        /// 안 불러서 이 문제를 못 잡고 있었다 — 실제로는 "설정" 버튼을
        /// 누르면 NullReferenceException으로 죽는 상태였다. [SerializeField]로
        /// 승격한 뒤, 이번엔 실제로 패널을 토글해서(리플렉션으로 private
        /// 메서드 호출) 열리는지까지 본다 — 존재 확인이 아니라 동작 확인.</summary>
        private static bool CheckCommandUiPanelsWork()
        {
            var ui = Object.FindFirstObjectByType<RealmCommandUi>();
            if (ui == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCommandUi 인스턴스를 못 찾음");
                return false;
            }

            var settingsPanelField = typeof(RealmCommandUi).GetField("_settingsPanel", BindingFlags.NonPublic | BindingFlags.Instance);
            var settingsPanel = settingsPanelField.GetValue(ui) as GameObject;
            if (settingsPanel == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCommandUi._settingsPanel이 null — 씬 재로드 후 참조가 안 살아남음");
                return false;
            }

            var toggleMethod = typeof(RealmCommandUi).GetMethod("ToggleSettingsPanel", BindingFlags.NonPublic | BindingFlags.Instance);
            toggleMethod.Invoke(ui, null); // 열기 — 여기서 NRE가 나면 그대로 테스트 실패로 드러난다.
            if (!settingsPanel.activeSelf)
            {
                Debug.LogError("[PlaytestRealmSlice] ToggleSettingsPanel() 호출 후에도 설정 패널이 안 열림");
                return false;
            }
            toggleMethod.Invoke(ui, null); // 다시 닫아 다른 검사에 영향 안 주게.
            if (settingsPanel.activeSelf)
            {
                Debug.LogError("[PlaytestRealmSlice] ToggleSettingsPanel() 두 번째 호출 후에도 설정 패널이 안 닫힘");
                return false;
            }

            // 여덟 상시 버튼(명령/성/계략/공격/다음달/문답/지도/서고)도
            // 같은 세션에서 같이 고친 언어 전환 반영을 확인한다.
            var ordersLabelField = typeof(RealmCommandUi).GetField("_ordersLabel", BindingFlags.NonPublic | BindingFlags.Instance);
            var ordersLabel = ordersLabelField.GetValue(ui) as TextMeshProUGUI;
            if (ordersLabel == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCommandUi._ordersLabel이 null");
                return false;
            }
            string langBefore = RealmLocalization.CurrentLanguage;
            var refreshMethod = typeof(RealmCommandUi).GetMethod("RefreshSettingsPanel", BindingFlags.NonPublic | BindingFlags.Instance);
            RealmLocalization.CurrentLanguage = "en";
            refreshMethod.Invoke(ui, null);
            if (ordersLabel.text != "Orders")
            {
                Debug.LogError($"[PlaytestRealmSlice] 명령 버튼 영어 전환이 안 먹음 text=\"{ordersLabel.text}\"(기대=Orders)");
                RealmLocalization.CurrentLanguage = langBefore;
                return false;
            }
            RealmLocalization.CurrentLanguage = langBefore;
            refreshMethod.Invoke(ui, null);
            if (ordersLabel.text != (langBefore == "en" ? "Orders" : "명령"))
            {
                Debug.LogError($"[PlaytestRealmSlice] 명령 버튼이 원래 언어로 안 돌아옴 text=\"{ordersLabel.text}\"(기대=명령)");
                return false;
            }

            // 저장 버튼(2026-09-15 신설 — REALM만 없던 저장 버튼을 이번에
            // 같이 채웠다) — 실제로 눌러서 파일이 생기는지까지 본다.
            var saveLabelField = typeof(RealmCommandUi).GetField("_saveLabel", BindingFlags.NonPublic | BindingFlags.Instance);
            var saveLabel = saveLabelField.GetValue(ui) as TextMeshProUGUI;
            if (saveLabel == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCommandUi._saveLabel이 null");
                return false;
            }
            RealmSaveState.DeleteForTest();
            var executeSaveMethod = typeof(RealmCommandUi).GetMethod("ExecuteSave", BindingFlags.NonPublic | BindingFlags.Instance);
            try
            {
                executeSaveMethod.Invoke(ui, null);
            }
            catch (System.Reflection.TargetInvocationException e)
            {
                Debug.LogError($"[PlaytestRealmSlice] ExecuteSave() 호출이 예외를 던짐 — {e.InnerException}");
                return false;
            }
            if (!RealmSaveState.TryLoad())
            {
                Debug.LogError("[PlaytestRealmSlice] 저장 버튼을 눌렀는데 세이브 파일을 못 읽음");
                return false;
            }

            RealmLocalization.CurrentLanguage = "en";
            refreshMethod.Invoke(ui, null);
            if (saveLabel.text != "Save")
            {
                Debug.LogError($"[PlaytestRealmSlice] 저장 버튼 영어 전환이 안 먹음 text=\"{saveLabel.text}\"(기대=Save)");
                RealmLocalization.CurrentLanguage = langBefore;
                return false;
            }
            RealmLocalization.CurrentLanguage = langBefore;
            refreshMethod.Invoke(ui, null);

            Debug.Log("[PlaytestRealmSlice] command UI panels OK - settings panel actually toggles, orders/save labels follow language, save button actually writes a file");
            return true;
        }

        /// <summary>PLAN.md 51장 16차 확장(2026-09-18, PLAN.md Q-U2 사용자
        /// 결정 "성 하나당 복수 목표 허용") — 장안(changan)이 실제로 목표를
        /// 둘(한중·천수) 갖는지, 조망 성을 장안으로 돌린 뒤 "공격" 버튼을
        /// 누르면(리플렉션으로 private ExecuteAttack() 직접 호출) 즉시
        /// 공격하는 대신 고르기 패널이 뜨는지 본다. **실제로 공격까지
        /// 하지는 않는다** — RealmCommandUi를 거치지 않는 AttackChainStep()
        /// 이 바로 다음에 진짜 함락을 수행하니, 여기서 먼저 함락해 버리면
        /// "이미 함락한 성입니다"로 그 단계가 깨진다. 그래서 패널만 열어
        /// 확인하고 바로 닫는다.</summary>
        private static bool CheckMultiTargetAttack()
        {
            var targets = RealmEnemyCity.TargetsFrom(RealmEnemyCity.ChanganId);
            if (targets.Count != 2 || !targets.Contains(RealmEnemyCity.HanzhongId) || !targets.Contains(RealmEnemyCity.TianshuiId))
            {
                Debug.LogError($"[PlaytestRealmSlice] TargetsFrom(\"changan\")이 기대와 다름 — count={targets.Count} [{string.Join(",", targets)}](기대=한중+천수 둘)");
                return false;
            }

            var ui = Object.FindFirstObjectByType<RealmCommandUi>();
            if (ui == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCommandUi 인스턴스를 못 찾음");
                return false;
            }

            RealmCityState.SetCurrentCity(RealmEnemyCity.ChanganId);

            var attackPanel = typeof(RealmCommandUi).GetField("_attackPanel", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(ui) as GameObject;
            if (attackPanel == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCommandUi._attackPanel이 null — 씬 재로드 후 참조가 안 살아남음");
                return false;
            }

            var executeMethod = typeof(RealmCommandUi).GetMethod("ExecuteAttack", BindingFlags.NonPublic | BindingFlags.Instance);
            executeMethod.Invoke(ui, null);

            if (!attackPanel.activeSelf)
            {
                Debug.LogError("[PlaytestRealmSlice] 목표가 둘인 성(장안)에서 공격 버튼을 눌렀는데 고르기 패널이 안 뜸 — 즉시 공격해 버렸을 위험");
                return false;
            }

            var buttonsRoot = typeof(RealmCommandUi).GetField("_attackButtonsRoot", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(ui) as Transform;
            if (buttonsRoot == null || buttonsRoot.childCount != 2)
            {
                Debug.LogError($"[PlaytestRealmSlice] 공격 고르기 패널의 버튼 개수 이상 — {(buttonsRoot == null ? "null" : buttonsRoot.childCount.ToString())}(기대=2)");
                return false;
            }

            attackPanel.SetActive(false); // 다음 단계(AttackChainStep)가 실제 함락을 수행하니 열어 둔 채로 넘기지 않는다.

            // 목표가 아닌 성 id를 강제로 넘기면 거절하는지(RealmWarState.Attack()
            // 의 TargetsFrom().Contains() 가드) — 회계(kuaiji)는 장안에서
            // 못 치는 성이다.
            var wrongResult = RealmWarState.Attack(RealmEnemyCity.ChanganId, RealmEnemyCity.KuaijiId);
            if (wrongResult.Ok)
            {
                Debug.LogError($"[PlaytestRealmSlice] 장안에서 회계(자기 목표가 아닌 성)를 공격했는데 안 막힘 — msg={wrongResult.Message}");
                return false;
            }

            Debug.Log("[PlaytestRealmSlice] multi-target attack UI OK - changan(2 targets: hanzhong+tianshui) opens a picker with 2 buttons instead of attacking immediately, wrong enemyId rejected");
            return true;
        }

        /// <summary>51장 16차 확장의 "알려진 틈" 후속(2026-09-18) — 계략도
        /// 목표가 둘인 성(장안)에서 "계략×목표" 조합 버튼(2종×2목표=4개)을
        /// 내는지 본다. CheckMultiTargetAttack()과 같은 이유로 **실제로
        /// 계략을 걸지는 않는다** — 걸면 금 소모·enemy stat 변화가 다음
        /// AttackChainStep()의 전투 결과에 영향을 줘 그 단계가 깨질 수
        /// 있다. 패널만 열어 버튼 개수를 보고 바로 닫는다.</summary>
        private static bool CheckMultiTargetPlot()
        {
            var ui = Object.FindFirstObjectByType<RealmCommandUi>();
            if (ui == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCommandUi 인스턴스를 못 찾음");
                return false;
            }

            RealmCityState.SetCurrentCity(RealmEnemyCity.ChanganId);

            var plotPanel = typeof(RealmCommandUi).GetField("_plotPanel", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(ui) as GameObject;
            if (plotPanel == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmCommandUi._plotPanel이 null — 씬 재로드 후 참조가 안 살아남음");
                return false;
            }

            var toggleMethod = typeof(RealmCommandUi).GetMethod("TogglePlotPanel", BindingFlags.NonPublic | BindingFlags.Instance);
            toggleMethod.Invoke(ui, null);

            if (!plotPanel.activeSelf)
            {
                Debug.LogError("[PlaytestRealmSlice] 목표가 둘인 성(장안)에서 계략 버튼을 눌렀는데 패널이 안 뜸");
                return false;
            }

            var buttonsRoot = typeof(RealmCommandUi).GetField("_plotButtonsRoot", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(ui) as Transform;
            if (buttonsRoot == null || buttonsRoot.childCount != 4)
            {
                Debug.LogError($"[PlaytestRealmSlice] 계략 고르기 패널의 버튼 개수 이상 — {(buttonsRoot == null ? "null" : buttonsRoot.childCount.ToString())}(기대=4, 계략 2종×목표 2곳)");
                return false;
            }

            plotPanel.SetActive(false); // 실제로 계략을 걸면 다음 AttackChainStep()의 전투 결과가 흔들린다 — 열어서 확인만 하고 닫는다.

            // 목표가 아닌 성 id를 강제로 넘기면 거절하는지(RealmWarState.Plot()
            // 의 TargetsFrom().Contains() 가드) — 회계(kuaiji)는 장안에서
            // 못 거는 성이다.
            var wrongResult = RealmWarState.Plot("rumor", RealmEnemyCity.ChanganId, RealmEnemyCity.KuaijiId);
            if (wrongResult.Ok)
            {
                Debug.LogError($"[PlaytestRealmSlice] 장안에서 회계(자기 목표가 아닌 성)에 계략을 걸었는데 안 막힘 — msg={wrongResult.Message}");
                return false;
            }

            Debug.Log("[PlaytestRealmSlice] multi-target plot UI OK - changan(2 targets: hanzhong+tianshui) opens a 4-button (2 kinds x 2 targets) picker, wrong enemyId rejected");
            return true;
        }

        /// <summary>PLAN.md 67~69장 "Localization" 2차(2026-09-14) — RealmHud의
        /// 개간/상업/병력 등 상태 표시가 실제로 영어 문구를 보여주는지 본다.</summary>
        private static bool CheckRealmHudLocalization()
        {
            var hudGo = GameObject.Find("RealmHudUI");
            var hud = hudGo != null ? hudGo.GetComponent<RealmHud>() : null;
            var label = hudGo != null ? hudGo.GetComponentInChildren<TextMeshProUGUI>() : null;
            if (hud == null || label == null)
            {
                Debug.LogError("[PlaytestRealmSlice] RealmHudUI/Label을 못 찾음");
                return false;
            }

            string langBefore = RealmLocalization.CurrentLanguage;
            var method = typeof(RealmHud).GetMethod("Refresh", BindingFlags.NonPublic | BindingFlags.Instance);

            RealmLocalization.CurrentLanguage = "en";
            method.Invoke(hud, null);
            if (!label.text.Contains("Farming") || !label.text.Contains("Troops"))
            {
                Debug.LogError($"[PlaytestRealmSlice] RealmHud 영어 전환이 안 먹음 text=\"{label.text}\"");
                RealmLocalization.CurrentLanguage = langBefore;
                return false;
            }
            RealmLocalization.CurrentLanguage = langBefore;
            method.Invoke(hud, null);

            Debug.Log("[PlaytestRealmSlice] realm hud localization OK");
            return true;
        }

        /// <summary>2026-09-23 "모바일 버튼 먹통" 회귀 — 씬의 버튼 전부에 리스너가 있는지 +
        /// 명령·설정 버튼을 진짜 onClick으로 열고 닫아 본다(ButtonWiringCheck.cs 주석 참고).</summary>
        private static bool CheckButtonWiring()
        {
            const string Tag = "PlaytestRealmSlice";
            bool ok = ButtonWiringCheck.CheckNoDeadButtons(Tag);
            var ui = Object.FindFirstObjectByType<RealmCommandUi>();
            var root = ui != null ? ui.transform : null;
            var orderPanel = ui != null ? GetPrivateField<GameObject>(ui, "_orderPanel") : null;
            var settingsPanel = ui != null ? GetPrivateField<GameObject>(ui, "_settingsPanel") : null;
            ok &= ButtonWiringCheck.PressOpensAndCloses(Tag, "명령 버튼",
                ButtonWiringCheck.FindByLabel(root, RealmLocalization.T("command.orders")),
                orderPanel != null ? ButtonWiringCheck.FindByLabel(orderPanel.transform, RealmLocalization.T("settings.close")) : null,
                orderPanel);
            ok &= ButtonWiringCheck.PressOpensAndCloses(Tag, "설정 버튼",
                ButtonWiringCheck.FindByLabel(root, RealmLocalization.T("settings.title")),
                settingsPanel != null ? ButtonWiringCheck.FindByLabel(settingsPanel.transform, RealmLocalization.T("settings.close")) : null,
                settingsPanel);
            return ok;
        }

    }
}
