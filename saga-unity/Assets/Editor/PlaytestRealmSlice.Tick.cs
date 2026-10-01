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
    /// <summary>`PlaytestRealmSlice` 의 일부(partial) — tasks U-0010 분할.</summary>
    public static partial class PlaytestRealmSlice
    {
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
                    // PLAN.md 109-15 명마·비행 — 장착·고르기·지도 보기·세이브 상태를 되돌린다.
                    if (!PlaytestRealmMount.Run()) { Fail(); return; }
                    // PLAN.md 109-16 시나리오 「천하와 균열」 — 끝나면 세이브 JSON 으로 판 상태를 되돌린다.
                    if (!PlaytestRealmScenario.Run()) { Fail(); return; }
                    // PLAN.md 109-16b 회차 — 끝나면 세이브 JSON·회차·최고 기록으로 되돌린다.
                    if (!PlaytestRealmRound.Run()) { Fail(); return; }
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
    }
}
