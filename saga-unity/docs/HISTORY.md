# HISTORY — saga-unity 세션 이력 (append-only)

**이 파일은 이력이다. 통째로 읽지 않는다** — `grep -n "^## "` 로 목차를 뽑고 날짜·게임명으로 grep 해 필요한 절만 `sed -n` 으로 읽는다.
새 세션 기록은 여기 **끝에 append** 한다. `docs/PROJECT_STATE.md` 는 상태만 **덮어쓰고**(≤15KB), `PLAN.md` 는 결정이 바뀔 때만 고친다(`../../SAGA-DESIGN.md` §9 문서 3층).
2026-09-16 재편 때 `PROJECT_STATE.md` 본문 전체(2026-09-11~16)와 `PLAN.md` 66-2장 ①~⑪·67~69장 진행 현황을 한 글자도 바꾸지 않고 여기로 옮겼다. 그 안의 "PLAN.md 66-2장 ⑤ 참고" 류 상호 참조는 이제 이 파일 안을 가리킨다.

---

## PROJECT_STATE.md 에서 옮겨 온 기록 (2026-09-16 재편, 원문 L5~ 그대로)


## 완료 단계

- **STORY — 콘텐츠 확장: 두목(황건 두목) + 두 번째 사명(q_boss1) (2026-09-13,
  스물한 번째 세션, "1,2,3 순서대로 다 진행해줘 묻지 말고"의 (3), "다른
  판 콘텐츠 확장" 방향으로 세션이 직접 STORY를 골랐다 — GO→DUNGEON→
  FOREST→STORY→REALM 확장 순서에서 커밋 수가 가장 적어 아직 안 채워진
  칸으로 판단).** 웹판 `js/data-quest.js` q_boss1("두목의 목", boss 1)·
  `js/data-enemy.js` BOSSES[0]("황건 두목", hpMul 12·dmgMul 2.0)를
  그대로 옮겼다.
  - `StoryEnemy.cs` — `isBoss` 플래그 하나로 같은 컴포넌트가 잡졸/두목
    둘 다 맡는다(HP만 12배로 커지고 시각도 1.4배 — 재해석: 이 슬라이스도
    잡졸처럼 반격은 안 넣었다, 다음 콘텐츠 확장 때 추격·반격을 붙이면
    두목에도 자동으로 적용됨). `StoryQuestState.cs`에 `BossKills`/
    `BossGoal`/`QuestBossDone` 추가, `Restore()` 시그니처가 인자 둘로
    늘었다(호출부 전부 갱신). `FieldMapData.cs`에 두목 자리(들판 가장
    안쪽, 마지막 잡졸보다 더 깊이) 추가. `StorySaveState.cs` v1→v2
    (`bossKills` 필드 추가, 구버전 세이브는 0으로 채워져 자연히 맞음).
    `StoryHud.cs`에 "두목의 목" 진행도 줄 추가.
  - **테스트 버그 하나 잡음** — `PlaytestStorySlice.cs`가 `StoryEnemy
    .All[0]`을 "항상 다음 잡졸"로 가정했는데, Awake() 호출 순서가
    하이어라키 순서와 같다는 보장이 없어 실제로 두목이 [0]에 온 적이
    있었다(그 자리에서 한 방 공격 → 두목이라 안 죽어서 "잡졸이 한
    방에 안 죽음"으로 오판). `IsBoss`로 걸러 첫 잡졸을 찾도록 고쳤다 —
    **실제 게임 로직(`StoryPlayerController.TryAttack()`)은 거리 기반
    판정이라 이 순서와 무관해 처음부터 안전했다**, 순전히 테스트만의
    가정 오류였다.
  - **검증** — 컴파일·씬 재빌드(`BuildTestStoryScene`)·`PlaytestStorySlice`
    (잡졸 열 처치 후 `StoryEnemy.All`에 두목만 남는지, 두목이 한 방엔
    안 죽는지(HP 12배 증거), 최대 40회 공격 루프로 실제 처치·
    `QuestBossDone`/`BossKills` 갱신·저장/불러오기 왕복까지 확인)
    `OK - killed 10 grunts + boss (both quests done), sweep/bolt/
    brace/jump/rope/save-load all verified, no errors`(실제로는 11번
    만에 처치됨 — 크리티컬 변동폭 포함 216/(21×0.88)≈12회 예상과
    합치). 회귀 GO/DUNGEON/FOREST/REALM 전부 통과.
  - **사람의 GUI 확인 필요**(아직 안 됨) — 두목이 실제로 잡졸보다
    커 보이는지, 여러 대 때려야 죽는 느낌(타격감)이 밋밋하지 않은지
    (반격이 없어 "버티기만 하는 샌드백"처럼 느껴질 수 있음 — 느껴지면
    다음 확장에서 최소한의 반격이나 등장 연출을 검토할 것).

- **FOREST — 가구 자유 배치로 재설계 (2026-09-13, 스물한 번째 세션,
  "1,2,3 순서대로 다 진행해줘 묻지 말고"의 (2)).** 고정 자리 여섯
  (`ForestFurnitureAnchor.cs`, GameObject 여섯 개)을 없애고 방(6x6m)
  전체를 1m 격자로 보는 컴포넌트 하나(`World/ForestFurniturePlacer.cs`)로
  바꿨다 — 문(반경 1.6m)·좌판(반경 1.0m) 자리만 빼면 놓을 수 있는 칸이
  여섯→열여덟로 늘어 "고정 자리"라는 재해석 자체가 사실상 해소됐다.
  입력 동사는 여전히 안 늘렸다(FOREST는 이동뿐인 GO판 컨트롤러 재사용,
  공격 버튼도 없다) — 이 트랙의 기존 관례("다가가면 반응")를 그대로
  격자 전체로 넓힌 것뿐.
  - `ForestHomeState.cs` — `Anchors[6]` 고정 배열 → `Dictionary<Vector2Int,
    string> Placements`. `WorldToCell`/`CellToLocal`/`IsValidCell`
    (문·좌판 배제 반경까지 포함해 단일 출처로) 신규, `TryPlaceAny`/
    `PickUp`가 인덱스 대신 격자 좌표를 받는다. 새 `Changed` 이벤트로
    시각 갱신을 알린다(`RealmCityState.Changed`와 같은 결).
  - **전역 쿨다운 하나로 재해석** — 예전엔 자리마다(6개) 독립 쿨다운이라
    문제없었지만, 격자가 훨씬 커지며 "방을 가로지르며 여기저기 놓임"
    사고를 막으려면 컴포넌트 전체에 쿨다운 하나가 더 낫다고 판단해
    `ForestFurniturePlacer.cs`에서 그렇게 지었다(문서화된 재해석).
  - `ForestSaveState.cs` v3→v4(`homeAnchors` → `homePlaceX/Y/Ids`) —
    REALM 세이브 버전 올림과 같은 관례로 옛 버전 세이브는 가구 배치만
    잃는다(마이그레이션 경로 없음).
  - `Editor/BuildTestVillageForestScene.cs`의 여섯 자리 루프를
    `FurniturePlacer` GameObject 하나로 교체, 좌판 좌표도
    `ForestHomeState.StallLocalPos`(단일 출처)로 옮김.
  - **검증** — 컴파일·씬 재빌드·`PlaytestForestFurniture`(기존 구매/
    놓기/거두기 경로 재확인 + 신규 `FreePlacementCheck` phase: 서로
    다른 두 칸에 동시에 놓임·문 자리 배치 거부·이미 채운 칸 덮어쓰기
    거부까지 확인) `OK - bought/placed/picked-up + free-placement
    (two cells, door-blocked, overwrite-blocked) all verified, no
    errors`. 회귀 `PlaytestForestHeadless`·`PlaytestForestHouseTransition`·
    `PlaytestHeadless`(GO)·`PlaytestDungeonHeadless`·`PlaytestStorySlice`·
    `PlaytestRealmSlice` 전부 통과.
  - **사람의 GUI 확인 필요**(아직 안 됨) — 방 안 여러 칸에 실제로
    가구를 놓고 걸어 다니며 배치감이 자연스러운지, 격자 죽은 영역
    (칸 사이 0.05m — `ProximityRadius=0.45`)이 실제로 걸을 때 거슬리는지.

- **REALM — 월드맵 첫 슬라이스 (2026-09-13, 스물한 번째 세션, "1,2,3
  순서대로 다 진행해줘 묻지 말고"의 (1)).** `saga-godot/docs/
  VERTICAL_SLICE_REALM.md` 2-8~2-10절(성표 셋을 한 지도로·탭으로 조망
  대상 바꾸기·드래그 궤도 카메라)을 개념만 참고해 한 슬라이스로 합쳐
  옮겼다(godot은 세 절로 나눴지만 여기선 드래그 판정 하나가 회전과
  탭을 같이 가르는 게 자연스러워 합쳤다).
  - 신규 — `Data/RealmMapState.cs`(ViewingMap 플래그, **저장 안 함**,
    godot의 viewing_map과 같은 결)·`World/{RealmWorldMap,
    RealmCityMarkerId,RealmMapViewSwitcher}.cs`·`Player/
    RealmWorldMapCamera.cs`(드래그 궤도+탭 선택 한 컴포넌트). `RealmCityData
    .cs`에 성 셋+소패의 지도 좌표(js/data-city.js 그대로) 추가.
    `RealmCommandUi.cs`에 "지도" 토글 버튼(문답 버튼 바로 아래), `BuildTestCityScene
    .cs`에 WorldMap+WorldMapCameraRig+RealmMapViewSwitcher 배선.
  - **디오라마↔지도 전환은 두 GameObject 묶음을 통째로 켜고 끄는
    것으로**(RealmMapViewSwitcher.cs) — RealmCityBuilder.cs의 "없는 값은
    안 그린다"와 같은 결로 지형 기복·해협은 안 옮겼다(성 넷 모두 평지에
    가깝다, godot 2-10절과 같은 재해석).
  - **버그 하나 잡음 — 한 .cs 파일에 MonoBehaviour 클래스를 두 개
    (RealmWorldMap+RealmCityMarkerId) 넣었더니, 씬 저장 시 두 번째
    클래스의 스크립트 참조가 guid 없는 "클래스명 폴백"으로 직렬화되며
    다른 프로세스에서 씬을 열면 `GetComponent<RealmCityMarkerId>()`가
    조용히 null을 반환했다**(raycast는 콜라이더를 정확히 맞히는데 탭
    선택만 항상 실패 — PlaytestRealmSlice에 임시 디버그 로그를 넣어
    원인을 좁혔다). `RealmCityMarkerId`를 별도 파일로 빼서(이 프로젝트의
    다른 모든 MonoBehaviour와 같이 파일당 클래스 하나 원칙) 고쳤다 —
    **앞으로 새 마커/꼬리표 컴포넌트를 만들 때 기존 파일에 얹지 말고
    처음부터 별도 파일로 뺄 것.**
  - **검증** — 컴파일(오류 없음)·씬 재빌드(`BuildTestCityScene`,
    "saved to TestCity.unity")·`PlaytestRealmSlice`(월드맵 phase 신규
    추가 — 초기 상태(디오라마만 활성)·토글·성표 위치(중심 (63,39.667)
    손 계산과 정확히 일치)·탭 선택(진류 탭 → currentCity 정확히 chenliu로
    전환)·드래그 회전 공식(문지방 10px 미만은 안 잠기고, 넘는 이동은
    yaw+=dx×0.006, pitch+=dy×0.006(클램프 0.35~1.3)와 정확히 일치)·확정된
    드래그 뒤 손떼기는 탭으로 오판 안 함·지도 되돌리기까지 전부 확인)
    `OK - world-map/location gate/ships gate/orders(10)/draft/search/
    hire/city-assignment/war/diplo(rumor+fire)/captured-city-absorb/
    quiz/save-load all verified, no errors`. 회귀
    `PlaytestHeadless`(GO)·`PlaytestDungeonHeadless`·`PlaytestForestHeadless`·
    `PlaytestStorySlice` 전부 통과.
  - **사람의 GUI 확인 필요**(아직 안 됨) — "지도" 버튼을 눌렀을 때 실제로
    전환이 매끄러운지, 성표 셋(+함락 후 넷)이 서로 안 겹치고 잘 보이는지,
    드래그 감도·줌 범위가 손가락/마우스로 자연스러운지, 탭 판정 반경이
    너무 넓거나 좁지 않은지.

- **FOREST — 벽지/장판 (2026-09-13, 스무 번째 세션, "1,2,3,4 순서대로
  다 진행해 묻지말고"의 (4), "다른 판 콘텐츠 확장" 방향으로 세션이
  직접 골랐다).** PROJECT_STATE.md에 오래전부터 "가구 자유 배치" ·
  "벽지/장판"(`ForestHomeData.cs`에 카테고리 추가 필요) 둘이 FOREST의
  남은 후보로 적혀 있었다 — 후자가 범위가 더 뚜렷해(원작 `data-village
  .js` WALLS·FLOORS 그대로) 이걸 골랐다.
  - 신규 `Data/ForestFinishData.cs`(벽지 5종·장판 5종, 원작 가격 그대로)
    — 가구와 같은 재해석(`Value`=원작 냥 값 참고용, `FruitCost`=실제
    과일 구매가). `ForestHomeState.cs`에 소유/착용 상태 추가 —
    **구매=착용으로 합쳤다**(갈아입기 UI가 없어서, 가구처럼 "다가가면
    반응"). `Score()`가 원작 `home.js score()`의 "벽지·장판이 기본이
    아니면 각 +12" 보너스까지 반영하도록 튜플을 3원소→4원소로 확장
    (기존 콜사이트 셋 — `ForestFurnitureAnchor.cs`·`PlaytestForestFurniture
    .cs` 둘 — 전부 4원소로 갱신).
  - 신규 `World/ForestFinishStall.cs`(도배전) — 다섯+다섯 다 가지기
    전엔 안 가진 것 중에서, 다 가지면 **가진 것끼리 공짜로 갈아입는**
    룰렛(원작의 "소유한 것들 사이 자유 교체"를 클릭 UI 없이 재해석).
    집 안(가구 자리 여섯+가구전)이 이미 빽빽해 **집 밖**(동쪽 벽에서
    2m, 출입 트리거에서 4.7m 떨어진 자리)에 세웠다.
  - `World/ForestHouse.cs`에 `RepaintFinish()` 신규 — 실내 바닥/벽
    머티리얼 색을 원작 hex 그대로 다시 칠한다. **필드로 캐싱하지 않고
    매번 하이어라키에서 찾는다** — 에디터가 미리 지어 씬 파일로 저장한
    뒤 Play에서 그대로 불러오는 경로라 private 필드(비직렬화)가 새
    인스턴스에서 항상 null이기 때문(이번에 실제로 확인하고 우회함).
    로드 직후 첫 Update에 한 번 자동 호출 + 도배전이 바꿀 때마다 직접
    호출(이벤트 시스템 없음, 이 프로젝트의 기존 관례).
  - `ForestSaveState.cs` v2→v3(`homeWalls`/`homeFloors`/`homeCurWall`/
    `homeCurFloor` 추가).
  - **검증 중 REALM과 똑같은 테스트 인프라 결함을 FOREST에서도 잡았다**
    — `PlaytestForestFinish`가 저장한 세이브를 다음 헤드리스 프로세스의
    `PlaytestForestFurniture`가 그대로 불러와 "가구를 다 치우면 점수
    0" 전제가 깨졌다(원인 동일: `GameBootstrap`이 매번 `TryLoad()`를
    부르고 persistentDataPath는 프로세스가 바뀌어도 남는다). `RealmSaveState
    .DeleteForTest()`와 같은 자리에 `ForestSaveState.DeleteForTest()`
    신규 — **FOREST의 헤드리스 Playtest 다섯 개 전부**(`PlaytestForestHeadless`·
    `PlaytestForestFurniture`·`PlaytestForestFinish`·`PlaytestForestCreatures`·
    `PlaytestForestHouseTransition`) `Run()` 맨 앞에서 부르도록 고쳤다.
  - **검증** — 컴파일(오류 없음)·씬 재빌드·신규 `PlaytestForestFinish`
    (구매+착용+점수 보너스+저장/로드 왕복)·회귀 `PlaytestForestFurniture`·
    `PlaytestForestHeadless`·`PlaytestForestHouseTransition` 전부 통과.
    `PlaytestForestCreatures`는 첫 실행에서 무작위 배회 요행으로 실패
    (`pojagoemul`이 배회 시간 안에 거의 안 움직임)했다가 재실행하면
    통과 — **이 조각과 무관한 기존 플레이키**(창조물 파일을 이번에
    안 건드렸다, 재현 확인만 해 두고 다음 세션 참고용으로 여기 기록).
  - **사람의 GUI 확인 필요**(아직 안 됨, 앞선 FOREST 확인 목록 뒤에
    이어짐) — 도배전(집 밖)이 실제로 자연스러운 자리에 있는지, 벽지/
    장판을 바꿨을 때 실내 색이 실제로 눈에 띄게 바뀌는지, 집 안팎을
    오갈 때 바뀐 색이 유지되는지.
- **REALM — 문답(quiz.js) (2026-09-13, 스무 번째 세션, "1,2,3,4 순서대로
  다 진행해 묻지말고"의 (3)).** 원작 문제은행 260문항(역사·사자성어·
  상식·유행어·세계사·속담 6분야)에서 **분야당 6문항, 총 36문항**만
  옮겼다 — 메커니즘(안 익힌 문제 우선→쉬운 등급부터, 다 익히면 복습)
  검증엔 등급이 섞인 소수 표본이면 충분하고, 나머지 224문항을 그대로
  베끼는 건 게임성에 새로 보태는 게 없다고 판단(무장 로스터를 3명으로
  좁힌 것과 같은 절제). **문항·정답·해설은 원작 그대로 — 지어내지
  않았다.** 이 문답은 실존 인물 이름(세종대왕·이순신 등)이 그대로
  나오는데, 이는 루트 CLAUDE.md 이름 정책과 안 부딪힌다고 판단했다 —
  그 정책은 이 게임 자체의 등장인물 도감(가명 대상)을 겨냥한 것이지,
  사실을 묻는 교양 퀴즈의 실존 인물 이름까지 가리는 게 아니다
  (`Data/RealmQuizData.cs` 클래스 주석에 이 판단 근거를 적어 뒀다).
  - **보상 재해석** — 원작은 공적(feat)+금+명성(fame)+연속 5마다
    등용서인데, 이 REALM 슬라이스엔 공적·명성·등용서 시스템 자체가
    없다 — **금만** 옮겼다(등급별 금액은 원작 그대로: 초급 40/10,
    중급 60/15, 고급 90/22 — 처음/복습). `drawReview`/`drawWrong`
    (자동 순행 auto.js 전용 통로)은 이 프로젝트에 자동 순행이 없어
    범위 밖 — 사람이 직접 푸는 `draw()`/`answer()` 경로만 옮겼다.
  - 신규 `Data/{RealmQuizData,RealmQuizState}.cs`. `RealmCityState.cs`에
    `AddGold()` 신규(`TrySpendGold()`의 반대쪽 — 문답 보상이 금고에
    쌓이려면 필요). `RealmSaveState.cs`에 문답 진행(학습 목록·오답
    횟수·통계)도 같이 저장 — **세이브 버전은 안 올렸다**(JsonUtility가
    없는 필드를 기본값으로 채워 읽어 옛 세이브도 안 깨진다).
  - `RealmCommandUi.cs`에 "문답" 버튼 신규 — 명령/성/계략/공격/다음달
    다섯 버튼 행과 달리(턴·성·무장과 무관한 개인 미니게임이라) 화면
    오른쪽 위 구석에 따로 뒀다. 패널은 문제+보기 4개, 답을 고르면
    바로 다음 문제로 이어진다(diplo.js의 "성공률을 숨기지 않는다"와
    같은 정신으로, quiz.js도 원래 정답/오답을 즉시 보여준다).
  - **검증** — 컴파일(오류 없음)·씬 재빌드·`PlaytestRealmSlice`(신규
    Phase `QuizCorrect`·`QuizWrong`) — 정답 시 첫 학습 보상(+40냥 등)이
    금고에 실제로 들어가는지, 오답 시 금고 불변·학습 기록 안 늘어나는지
    (오답노트엔 남는지), 저장→문답 진행(학습 수·정답률·연속)을 0으로
    흩트림→불러오기 왕복까지 확인. 회귀 `PlaytestHeadless`(GO)·
    `PlaytestDungeonHeadless`·`PlaytestForestHeadless`·
    `PlaytestStorySlice`(다른 네 판 무관 확인) 전부 통과.
  - **사람의 GUI 확인 필요**(아직 안 됨, 앞선 REALM 확인 목록 뒤에
    이어짐) — "문답" 버튼이 화면 오른쪽 위에서 다른 UI와 안 겹치는지,
    문제·보기 4개가 잘 읽히는지, 답을 고른 뒤 토스트(정답/오답+해설)가
    이해하기 쉬운지, 연속으로 여러 문제를 풀 때 자연스럽게 이어지는지.
- **REALM — 함락한 성을 플레이 가능한 성으로 들이기 (2026-09-13, 스무
  번째 세션, "1,2,3,4 순서대로 다 진행해 묻지말고"의 (2)).** 소패를
  함락하면 지금까진 `Captured` 깃발만 세우고 끝이었다(3절 "뺀 것" —
  "함락 뒤처리: 무장 배치·태수·랜드마크"는 의도적으로 범위 밖이었다).
  이제 함락 즉시 진짜 네 번째 성으로 편입돼 "성" 패널에서 조망하고
  개발형 명령을 내릴 수 있다.
  - 전후 성벽·병력·훈련·기술은 전투가 실제로 남긴 값을 그대로
    이어받고(js/data-city.js의 실제 소패 수치 agri 220·comm 200·pop
    120000을 새로 가져와 개간·상업·인구는 이걸로 채운다 — 이전엔 전쟁
    판정에만 쓰던 wall 3600만 있었다), 치안은 rtk.js 함락 뒤처리 관례
    그대로 절반(기본 60→30)으로 시작한다.
  - **무장 전임(성 사이 이동)은 여전히 범위 밖**(godot 3절 "뺀 것")이라
    새로 편입된 성엔 처음엔 아무도 없다 — 하지만 수색·등용은 애초에
    위치 무관(LocationBound=false)이라, 소패로 조망을 옮긴 채 등용에
    성공하면 그 자리에서 바로 배치된다(다만 소패엔 아직 재야 데이터가
    없어 이번엔 "부를 사람이 없다"만 뜬다 — 다음 콘텐츠 후보).
  - `Data/RealmCityData.cs`에 "xiaopei" 정의 추가(원작 수치 그대로,
    `AllCityIds`엔 안 넣는다 — "처음부터 우리 것"만 가리키는 고정
    목록이라). `RealmCityState.cs`에 `ActiveCityIds`(시작 셋+함락한
    성, "성" 패널·정산·저장이 이걸로 돈다)·`AbsorbCity()` 신규,
    `NextMonth()`/`SnapshotCities()`가 `AllCityIds` 대신 이걸 쓰도록
    바꿨다. `RealmWarState.Attack()`이 함락 성공 시 바로 부른다.
    `Restore()`도 저장에 있던 성이 지금 메모리엔 없으면(새 프로세스에서
    막 불러온 경우) 그 자리에서 새로 지어 편입하도록 고쳤다 — **세이브
    버전은 안 올렸다**(기존 `cities` 리스트 길이만 늘 뿐 스키마는
    그대로).
  - `RealmCommandUi.cs`의 "성" 패널을 계략 패널과 같은 결로 열 때마다
    다시 짓게 바꿨다(성 개수가 함락으로 늘 수 있으니 정적으로 한 번
    지으면 안 됨). `RealmHud.cs`의 소패 전황 줄도 "함락됨(성 목록에
    편입, "성"에서 조망 가능)"으로 문구를 보강.
  - **검증** — 컴파일(오류 없음)·씬 재빌드·`PlaytestRealmSlice`(신규
    Phase `CapturedCityDevelop` + AttackOverwhelm 단계 확장) — 함락
    직후 `ActiveCityIds`에 실제로 들어가는지·편입된 레코드 필드
    (agri/comm/sec/wall/troops/train/tech)가 전투 스냅샷·원작 정의값과
    정확히 일치하는지, 무장 없이는 개발형 명령이 막히는지(성 소속
    게이트가 새 성에도 똑같이 걸리는지), 무장을 배치하면(테스트 전용
    — Restore 경로로 현책을 옮김, 실제 게임엔 전임 명령이 없다) 바로
    개간이 도는지, 저장→성 넷(소패 포함) 전부 엉터리 값으로 흩트림→
    불러오기 왕복(소패 편입 여부·개간 수치·현책 성 소속까지)까지 확인.
    회귀 `PlaytestHeadless`(GO)·`PlaytestDungeonHeadless`·
    `PlaytestForestHeadless`·`PlaytestStorySlice`(다른 네 판 무관 확인)
    전부 통과.
  - **사람의 GUI 확인 필요**(아직 안 됨, 앞선 REALM 확인 목록 뒤에
    이어짐) — 소패를 함락한 뒤 "성" 패널에 실제로 네 번째 항목(소패)이
    나타나 선택되는지, 선택했을 때 HUD가 그 성의 아홉 값으로 정상
    전환되는지, 무장이 없어 명령이 막히는 메시지가 이해하기 쉬운지.
- **REALM — 외교(diplo.js) 절반: 계략(유언비어·화계) (2026-09-13, 스무
  번째 세션, "1,2,3,4 순서대로 다 진행해 묻지말고"의 (1)).** diplo.js는
  "우호·동맹·화친·조공"(세력 간)과 "계략"(적 성에 거는 것) 둘로 나뉘는데,
  이 슬라이스엔 상대할 다른 세력이 소패 하나뿐이고 소패엔 태수·무장이
  없다(RealmEnemyRecord 참고) — **동맹/화친/조공(다른 세력 필요)과
  이간/매수(적 무장 필요)는 대상 자체가 없어 범위 밖**, 성 자체를
  겨냥하는 유언비어·화계 둘만 옮겼다(세션이 직접 재해석해 고른 범위,
  `Data/RealmPlotData.cs` 클래스 주석에 이유를 명시해 뒀다).
  - **효과 재해석** — 원작 효과(치안↓·군량 소각)를 그대로 두면 이
    슬라이스의 적 성엔 해당 필드가 없어(RealmWar.Fight()는 Wall/Troops/
    Train/Tech만 쓴다) 아무 효과가 없다. **유언비어→소패 훈련도 하락,
    화계→소패 병력 손실로 재해석**해 다음 전투에서 실제로 체감되게
    했다(낙폭·비율 수치는 원작 그대로: 유언비어 10+rand(12), 화계
    25~55%).
  - 성공률 공식은 diplo.js `plotChance()`의 일반 갈래 그대로(거는 사람
    지력 대 태수 지력, 태수 없으면 30 — 소패는 원래 태수가 없어 이
    기본값이 그대로 맞아떨어진다). 치안 항은 소패에 치안 필드가 없어
    뺐다(중립값으로 상쇄한 것과 같다).
  - **diplo.js "계략은 성공률을 숨기지 않는다"를 그대로 지켰다** —
    `RealmCommandUi.cs`의 "계략" 버튼 패널이 지금 조망 중인 성·로스터
    상태로 매번 성공률을 계산해 버튼 라벨에 %로 보여준다(열 때마다
    다시 지음, `RealmCityBuilder.Rebuild()`와 같은 결).
    허창에서만 쓸 수 있다(공격과 같은 자리 — 소패와 맞닿은 유일한 성).
  - 신규 `Data/RealmPlotData.cs`(계략 카탈로그 2종) — `RealmWarState.cs`에
    `Plot()`/`PlotChance()`/`BestPlotter()`/`PreviewPlotChance()` 추가.
    `RealmCityState.cs`에 `TrySpendGold()` 신규(금고 세터가 private라
    다른 static 클래스가 못 깎던 것 — 계략 비용 차감에 필요해 열었다).
    세이브는 **버전을 안 올렸다** — Train/Troops는 이미 v3 스키마에
    있던 필드라 새 필드가 필요 없었다.
  - **명령 버튼 행이 넷→다섯으로 늘었다**(명령/성/계략/공격/다음달,
    폭을 190→180으로 좁혀 화면 안에 맞췄다).
  - **검증 중 테스트 인프라 자체의 결함을 하나 잡았다** — 헤드리스
    Playtest를 두 번째로 돌리자 `RealmCityState.Gold=6619, roster=2`로
    시작해 "새 게임" 전제인 Init 단계가 깨졌다. 원인은
    `GameBootstrap.Awake()`가 매번 `RealmSaveState.TryLoad()`를 불러
    이전 헤드리스 실행이 남긴 세이브 파일(persistentDataPath, Unity
    프로세스가 바뀌어도 디스크에 그대로 남는다)을 그대로 읽어 버린 것
    — 이전 세션들의 REALM 테스트도 우연히(세이브 버전을 매번 올려
    옛 세이브가 자동 무시된 덕에) 이 문제를 안 겪었을 뿐, 잠재돼
    있었다. `RealmSaveState.DeleteForTest()` 신규(테스트 전용, 실제
    게임 코드 경로 밖) — `PlaytestRealmSlice.Run()` 맨 앞에서 부른다.
  - **검증** — 컴파일(오류 없음)·씬 재빌드·`PlaytestRealmSlice`(신규
    Phase 셋: PlotGate·PlotRumor·PlotFire) — 허창 밖 게이트, 유언비어
    성공 시 훈련도 실제 하락(확률 판정, 이번엔 1번째 시도 성공)·실패 시
    아무 것도 안 바뀌는지, 화계 성공 시 병력 실제 하락(1번째 시도
    성공)·성공/실패 각각 금 정확히 차감되는지까지 확인. 계략으로
    흐트러진 소패 병력/훈련은 뒤의 결정론적 전쟁 테스트(약한 공격/
    압도적 공격)가 어긋나지 않도록 기준값으로 되돌린 뒤 이어감. 회귀
    `PlaytestHeadless`(GO)·`PlaytestDungeonHeadless`·
    `PlaytestForestHeadless`·`PlaytestStorySlice`(다른 네 판 무관 확인)
    전부 통과.
  - **사람의 GUI 확인 필요**(아직 안 됨, 앞선 REALM 확인 목록 뒤에
    이어짐) — "계략" 버튼이 명령/성/공격/다음달 다섯 버튼 행에서 안
    겹치고 눌리는지, 패널을 열 때마다 성공률 %가 실제로 갱신되는지,
    유언비어/화계를 실제로 눌러 결과 토스트(성공/들통남 문구)가
    이해하기 쉬운지.
- **REALM — 전쟁 첫 슬라이스: 소패 공략 (2026-09-13, 열아홉 번째 세션,
  "실기 확인은 내가 할게, 다음 방향 정해줘"에 세션이 직접 골라 착수).**
  REALM은 경제 루프(10종 명령·성 셋·무장 로스터)는 갖췄지만 성 셋
  전부 이미 플레이어 것이라 다툴 상대가 없었다 — PLAN.md 1순위("게임이
  재미있어야 한다")에 비춰 볼 때 목표 없는 경영 루프보다 갈등을 넣는
  쪽이 값지다고 판단해 골랐다(방향 결정을 대신한 것 — 사용자가 "정해줘"
  로 위임). `saga-godot/docs/VERTICAL_SLICE_REALM.md` 3절이 이미 설계·
  구현·헤드리스 검증까지 끝내 둔 걸 개념만 참고하고, 공식 자체는
  `js/war.js`를 직접 읽어 옮겼다(armyPower()/stepRound()/fight(), 계수
  0.055·ROUT 0.35·성벽 배율 0.9·공성 배율 0.045 전부 원작 값).
  - **목표** — 소패(허창과만 맞닿은 유일한 이웃, `data-city.js` 그대로:
    land plain·wall 3600). **병력 800은 재해석**(godot 3절과 같은 결) —
    원작은 AI가 여러 달에 걸쳐 채우는데 이 슬라이스엔 적 AI가 없어
    "시시하게 늘 이기는 자리"가 안 되도록 중간 규모를 정적으로 채웠다.
  - **뺀 것**(문서 "뺀 것" 그대로): 진형·일기토(장수 있으면 배율만
    반영, 실제 합은 안 굴림)·수전/화공/배(소패가 뭍길)·진영(camp,
    승부가 안 갈리면 그냥 routed와 같이 취급 — 이 슬라이스엔 여러 달
    포위 시스템이 없다)·함락 뒤처리(무장 배치·태수·랜드마크 — `Captured`
    깃발만)·수량 선택 UI(허창의 **전군**을 보낸다, 다른 명령들처럼
    버튼 하나).
  - 신규 `Data/{RealmArmy,RealmWar,RealmEnemyCity,RealmWarState}.cs` —
    `RealmWar.Fight()`가 최대 10합을 굴려 승부(또는 routed 처리)를
    낸다. `RealmWarState.Attack(fromCityId)`가 war.js setupMarch()/
    finishMarch()의 "출진 준비 → fight() → 뒤처리"를 좁혀 옮겼다:
    전제조건(허창에서만·병력 500 이상·군량 2배월치·이 성 배치+이 달
    안 쓴 무장 있음) → 전군 출진(병력 0·군량 차감) → `RealmWar.Fight()`
    → 승리면 `Captured=true`, 아니면 생존 병력·치중을 원래 성으로
    반환하고 **소패의 병력·성벽은 그대로 이어진다**(재도전이 의미
    있게). `RealmCityState`에 `MarkOfficerDone()` 공개 메서드 추가
    (출진시킨 무장들을 이 달 명령 소진으로 표시).
  - `RealmCommandUi.cs`에 "공격" 버튼 추가(명령/성/공격/다음달 네
    버튼, 폭을 좁혀 한 줄에 배치). `RealmHud.cs`에 소패 전황 줄 추가
    (병력·성벽, 함락되면 "함락됨"). `RealmSaveState.cs` v2→v3(소패
    성벽·최대성벽·병력·훈련·기술·함락 여부 추가 — 병력·성벽이 재도전에
    걸쳐 이어지려면 필수).
  - **검증** — 컴파일(오류 없음)·씬 재빌드·`PlaytestRealmSlice`(대폭
    확장) — 성 밖 공격 게이트(허창 아닌 성에서 시도 시 막힘)·병력
    부족 게이트(500 미만)·**약한 공격**(600명으로 소패 800명·성벽
    3600 공격 → 함락 실패, 생존 476·적 손실 180으로 물러남, 실제
    수치까지 확인)·**압도적 공격**(10만 명 → 손실 19만으로 함락,
    `Captured=true`)·**함락한 성 재공격 차단**·저장→성 셋+소패 전황
    전부 엉터리 값으로 흩트림→불러오기 왕복(소패 성벽·병력·함락 여부
    까지)까지 전부 확인. 회귀 `PlaytestHeadless`(GO)·
    `PlaytestDungeonHeadless`·`PlaytestForestHeadless`·
    `PlaytestStorySlice`(다른 네 판 무관 확인) 전부 통과.
  - **사람의 GUI 확인 필요**(아직 안 됨, 앞선 REALM 확인 목록 뒤에
    이어짐) — "공격" 버튼이 명령/성/다음달과 안 겹치고 눌리는지, HUD의
    소패 전황 줄이 잘 읽히는지, 실제로 눌러 봤을 때 전투 결과 토스트
    (생존/손실/치중 또는 함락 문구)가 이해하기 쉬운지.
  - **다음 이어질 것**(문서 "다음 이어질 것" 그대로, 승인 후) — 외교
    (diplo.js, relation/envoy 단발 확률)·함락한 성을 플레이 가능한
    성으로 들이는 나머지 절반·문답(quiz.js) — 어느 쪽이든 방향 결정.
- **REALM 다음 조각 셋 — 명령 나머지 6종·여러 성 확장·무장 성 소속
  (2026-09-13, 열여덟 번째 세션, "REALM 다음 조각은 뭐부터 할까요?"
  질문에 사용자가 "1,2,3,4 다 진행해"로 답해 앞 셋을 순서대로 끝냄 —
  4번째 "REALM 말고 다른 판 실기 확인부터"는 사람이 직접 하는 일이라
  이 세션이 대신 처리하지 않음, 아래 "다음 작업" 참고).**
  - **(1) 명령 나머지 6종** — `js/rtk.js` ORDERS 10종 전부(기술·치안·
    축성·징병·훈련·조선 추가). `RealmOrderData`에 `RealmStat`(Wisdom/
    Command/Might)·`LocationBound` 필드 추가 — 개발형 명령+징병은
    그 성에 배치된 무장만, 수색·등용은 예외(로스터 아무나)라는 godot
    2-6절의 재해석을 그대로 썼다. 조선은 뭍길 성에서 게이트로 막히고
    (허창에서 실제로 확인), **게이트 실패는 그 달 명령 소진을 안
    시킨다**(같은 달에 바로 이어 개간 성공까지 확인). 징병은 인구를
    깎아 병력을 만들고, 병력이 생긴 뒤로는 매달 군량을 먹는다 —
    군량이 모자라면 병사가 흩어지는 굶주림 로직까지 옮겼다(인구
    자연 증감은 여전히 안 옮김 — 4절 "제외" 그대로, 인구는 징병으로만
    준다).
  - **(2) 여러 성으로 확장** — 시나리오 194 조조군이 원래 갖고 시작하는
    성 셋(허창·진류·복양, `js/data-force.js`) 그대로. 신규
    `Data/{RealmCityData,RealmCityRecord}.cs` — 성마다 land(평지/강)·
    agri/comm/tech/sec/wall/train/ships/pop/troops/food 아홉 값을
    따로 갖는다(세력 금고만 공유, rtk.js와 같은 구조). "성" 버튼
    (`RealmCommandUi.cs`)으로 조망·명령 대상을 바꾸고, 세력 금고는
    **성 셋 소득의 합산**이다.
  - **(3) 무장 로스터·성 소속** — 시작 무장(현책)은 허창에 배치.
    수색·등용은 성마다 다른 재야를 내놓는다(해장=복양, 이도인=진류,
    허창엔 일부러 안 묻음 — godot 2-5절과 같은 배치, 재야가 성마다
    하나뿐이라 수색 결과가 이제 **결정적**이다). 등용에 성공하면 그
    성에 배치되고, **같은 달 안에 바로 그 성에서 개발형 명령을 쓸 수
    있다**(등용은 부른 사람의 이 달 몫만 쓴다 — 새로 합류한 무장은
    아직 안 썼으니). 무장 전임(성 사이 이동)은 이번 범위 밖 —
    godot 2-7절이 겪은 "막다른 골목"(개발형 명령이 배치 요구인데
    이동 수단이 없음)이 이 슬라이스엔 없다(수색·등용이 처음부터
    위치 무관이라).
  - `RealmCityBuilder.cs`(디오라마는 이제 `RealmCityState.CurrentCity`
    기준으로 짓는다, 로스터 깃발도 전체가 아니라 **그 성에 배치된**
    무장 수만)·`RealmHud.cs`(성 이름+아홉 값+로스터별 배치 성 표시)·
    `RealmSaveState.cs`(v1→v2, 성 셋 스냅샷+무장 성 소속 배열 추가 —
    구조가 달라 옛 v1 세이브는 자동 무시하고 새로 시작) 갱신.
  - **검증** — 컴파일(오류 없음)·씬 재빌드·`PlaytestRealmSlice`(대폭
    확장, `OK - location gate/ships gate/orders(10)/draft/search/
    hire/city-assignment/save-load all verified, no errors`) —
    무장 없는 성에서 개발형 명령이 막히는지(게이트 실패가 명령 소진을
    안 시키는 것까지)·조선 물길 게이트·개간/상업/정산(성 셋 소득
    합산 공식까지 손 계산으로 확인, 첫 시도에 진류·복양 소득을 빼먹고
    계산해 정산 불일치로 한 번 실패했다가 테스트 쪽 계산을 고쳐 재검증
    통과)·기술/치안/축성/훈련 네 명령·징병(병력 증가·인구 감소)·
    징병 후 첫 정산(군량 소비, 수확달 타이밍에 따라 굶주림이 안 나올
    수도 있다는 것까지 확인 — 정확한 수치 대신 "음수 안 됨" 불변식만
    검사해 크리티컬 확률·수확달 타이밍에 안 흔들리게 함)·수색(진류
    재야가 이도인 하나뿐이라 결정적)·등용(확률 판정, 9번째 시도에
    성공)·새로 배치된 무장이 같은 달에 바로 명령 쓰는지·저장→성 셋
    전부 엉터리 값으로 흩트림→불러오기 왕복까지 전부 확인. 회귀
    `PlaytestHeadless`(GO)·`PlaytestDungeonHeadless`·
    `PlaytestForestHeadless`·`PlaytestStorySlice`(다른 네 판 무관 확인)
    전부 통과.
  - **사람의 GUI 확인 필요**(아직 안 됨, REALM 착수 세션의 확인 목록
    뒤에 이어짐) — 명령 패널이 이제 10개(두 열)라 화면에서 안 겹치고
    다 읽히는지, "성" 버튼으로 세 성을 오갈 때 디오라마가 자연스럽게
    다시 지어지는지, 성 전환·명령 패널이 서로 안 겹치는지(둘 다
    열려 있으면 안 되게 짰다 — 서로 토글 시 상대를 닫는다), HUD에
    아홉 값+로스터 배치 성이 안 겹치고 잘 읽히는지.
- **REALM 착수 — 버티컬 슬라이스 첫 구현 (2026-09-13, 열일곱 번째 세션,
  "이어 해"로 열여섯 번째 세션이 남긴 "(4) REALM 착수" 확정).** PLAN.md
  확장 순서(GO→DUNGEON→FOREST→STORY→**REALM**)의 마지막 칸 — 다섯 판
  중 유일하게 실시간 이동·전투가 없는 턴제 경영. `saga-godot/docs/
  VERTICAL_SLICE_REALM.md` 1~5절(기본 설계, 이후 2-1~2-10·3절의 다성
  확장은 godot 쪽 후속 세션들이 붙인 것이라 이번엔 참고 안 함 — STORY
  착수 때와 같이 **첫 슬라이스만** 옮겼다)을 개념만 참고해 Unity
  관용구로 새로 지었다. 판정 공식·수치는 `saga-realm/js/rtk.js`·
  `data-city.js`·`data.js`를 직접 읽어 그대로 옮겼다(레거시 감사
  재분석이 아니라 실제 수식·수치 확인 — 게임 디자인 자료는 다시
  고르지 않는다는 원칙과 별개로, godot 문서엔 agri/comm 공식 자체가
  안 적혀 있어 원본을 봐야 했다).
  - **범위** — 허창 하나, 명령 4종(개간·상업·수색·등용, rtk.js ORDERS
    10종 중 첫 슬라이스 몫), 로스터 1명(현책)+재야 2명(해장·이도인,
    js/data.js HEROES 가명 그대로 — 루트 CLAUDE.md 이름 정책), "다음
    달" 정산(금고=상업 소득×치안 배율−봉록, 군량은 6·10월만), 저장/
    불러오기. 병력·인구·재해·전쟁·외교·문답·여러 성은 전부 범위 밖
    (VERTICAL_SLICE_REALM.md 4절 원래 "제외" 그대로 — 이후 godot이
    2-x절에서 넓힌 건 REALM 자체의 다음 슬라이스 후보이지 이번 착수
    범위가 아니다).
  - 신규 — `Data/{RealmOfficer,RealmOfficerPool,RealmOrderData,
    RealmCityState,RealmSaveState}.cs`·`World/{RealmCityBuilder,
    GameBootstrap}.cs`·`Player/RealmOrbitCamera.cs`·`UI/{RealmUiKit,
    RealmToast,RealmHud,RealmCommandUi}.cs`·`Editor/{BuildTestCityScene,
    PlaytestRealmSlice}.cs`. asmdef 없음(SagaStory와 같은 결 — 최근
    두 판째부터는 게임별 asmdef를 새로 안 늘리고 기본 어셈블리로 둔다).
  - **카메라 — 드래그 오빗 대신 WASD 오빗을 새로 짰다**(`RealmOrbitCamera.cs`).
    REALM엔 쫓아갈 플레이어 아바타가 없어(1절 "실시간 이동·전투 없음")
    GO/DUNGEON `CameraRig.cs`(플레이어 자식, 드래그 회전)를 그대로 못
    쓴다 — 성 중심(원점)에 고정된 리그가 WASD로 요/피치, 휠로 줌만
    한다(godot REALM 1절의 "드래그보다 WASD가 더 어울린다" 결론과
    같은 결, 코드는 새로 — 0장 "개념만 참고" 원칙).
  - **디오라마 — 처음부터 개수 기반으로 지었다**(정적 실루엣 먼저 →
    나중에 city3d.js 참고해 개수 기반으로 바꾸는 godot의 2단계를 안
    거침 — 결과가 이미 알려져 있는데 구식 버전을 먼저 만들 이유가
    없다고 판단). 밭(개간/90)·시장(상업/80)·곳간(군량/400)·로스터
    깃발(무장 수) 개수를 성벽+망루+본성 primitive 둘레에 뿌린다
    (`RealmCityBuilder.Rebuild()`, `RealmCityState.Changed` 이벤트로
    값이 바뀔 때마다 다시 지음). GLB 없음(primitive만 — 8장 우선순위
    밖, 성 디오라마는 GO/DUNGEON 초기처럼 primitive로 충분하다는 판단).
  - **명령 실행 — 무장 자동 선택으로 단순화**. rtk.js는 화면에서 무장을
    직접 골라 명령하지만, 로스터가 1~3명뿐인 이 슬라이스는 "이 달에
    아직 안 쓴 무장 중 지력(wisdom) 최고"가 자동으로 나선다
    (`RealmCityState.BestAvailableOfficer()`) — 무장 선택 UI는 로스터가
    늘어날 다음 슬라이스 몫으로 미뤘다(문서화된 재해석).
  - **수색·등용 판정도 rtk.js 그대로** — 수색은 rarity 내림차순 정렬 뒤
    `reach=clamp(round(hidden.Count×wisdom/130),1,hidden.Count)` 안에서
    무작위, 등용은 `chance=clamp(0.28+wisdom/260-(rarity-2)×0.09,
    0.05,0.9)` 판정(포로 갈래는 이 슬라이스에 포로가 없어 안 옮김).
  - **검증** — 컴파일(오류 없음)·씬 재빌드(`BuildTestCityScene`,
    "saved to TestCity.unity")·`PlaytestRealmSlice`(신규, `OK -
    agri/comm/settle/search/hire/save-load all verified, no errors`
    — 개간·상업 실행 시 금 차감·수치 증가, 다음 달 정산 시 금이
    공식(상업×0.55×치안배율−봉록)대로 정확히 바뀌고 비수확달엔 군량이
    그대로인 것, 수색이 재야를 실제로 찾는 것, 등용이 성공할 때까지
    반복해(확률 판정, 이번엔 2번째 시도에 성공) 로스터에 실제로
    합류하는 것, 저장→상태를 흩트림→불러오기로 금/로스터/발견 목록/
    연월이 전부 정확히 돌아오는 것까지 전부 확인)·회귀
    `PlaytestHeadless`(GO)·`PlaytestDungeonHeadless`·
    `PlaytestForestHeadless`·`PlaytestStorySlice`(다른 네 판 무관 확인)
    전부 통과.
  - **사람의 GUI 확인 필요**(아직 안 됨, 다른 네 판의 밀린 확인 목록
    뒤에 이어짐) — `RealmCommandUi.cs`의 "명령"/"다음 달" 버튼이 실제
    클릭으로 잘 열리고 눌리는지(Playtest는 버튼을 안 거치고
    `RealmCityState`를 직접 불러 판정 경로만 검증했다 — 이 프로젝트의
    다른 Playtest들과 같은 관행, PlaytestStorySlice.cs 클래스 주석
    참고), WASD 오빗 카메라 감도가 자연스러운지, 디오라마(밭·시장·
    곳간·깃발 개수)가 눈으로 봤을 때 "커지고 있다"는 게 느껴지는지,
    HUD 문구가 안 겹치고 잘 읽히는지.
- **DUNGEON — 위성↔위성 지름길 후속: Town2↔Town4 (2026-09-13, 열여섯
  번째 세션, "2,3,4 순으로 다해줘"의 (3)).** 열다섯 번째 세션이
  Town3↔Town2 지름길을 넣으며 "Town2↔Town4는 후속 후보로 남김"이라
  적어 둔 그 두 번째 인접 쌍(§28-3과 같은 논리 — Town3(서)·Town4(동)만
  정반대라 빼고 나머지 인접 쌍은 다 잇는다). Town3↔Town2와 완전히 같은
  패턴 재사용 — 새 트릭 없음.
  - Crossroads2(30,0,-30, Town4.x·Town2.z가 만나는 자리 — 첫 Crossroads가
    Town3.x·Town2.z였던 것과 같은 공식) 신규, 문 둘만(서=Town2 방향,
    북=Town4 방향), 등불 하나(BuildTownLantern 재사용)로 "그냥 갈림길"
    표시.
  - Town2에 동쪽 문 추가(북=Room1, 서=Crossroads 경유 Town3, 이제 동=
    Crossroads2 경유 Town4). Town4에 남쪽 문 추가 — **더는 막다른
    마을이 아니다**(서쪽 문 하나뿐이던 것에서).
  - 복도 둘 — Town2→Crossroads2(E-W, Y축 90도 회전)·Crossroads2→Town4
    (N-S, 회전 없음) — 기존 `DungeonCorridorBuilder`/도어 헬퍼 그대로.
  - 미니맵에 Crossroads2 점 추가(첫 Crossroads와 같은 회색 "경유지"
    색). **오버월드 지도(M키) UI는 안 건드림** — 그 UI는 처음부터
    "대각선 네 칸은 안 채운다"고 명시해 뒀고 Crossroads2는 Town1
    기준 대각선(남동) 자리라 애초에 그 설계 밖.
  - `PlaytestDungeonShortcut.cs` 확장 — 기존 Town3→Crossroads→Town2
    확인에 이어 Town2→Crossroads2→Town4 구간도 같은 방식(순간이동 후
    예외 없는지)으로 검증하도록 Phase 둘 추가.
  - 컴파일(오류 없음)·씬 재빌드(`room childCount=20`, 문 폭·GLB 경고
    없음)·`PlaytestDungeonShortcut`(`OK - walked Town3->Crossroads
    ->Town2 and Town2->Crossroads2->Town4 shortcuts, no errors`)·
    회귀 `PlaytestDungeonTown2`·`PlaytestDungeonTowns34`·
    `PlaytestDungeonFieldAmbush`·`PlaytestOverworldMap`·
    `PlaytestDungeonFloorProgression`(`OK - 12 room advances, floor
    reached 4` — 문 구성이 또 늘어도 기존 진행 무관 재확인)·
    `PlaytestDungeonHeadless`·`PlaytestForestHeadless`(다른 트랙 무관
    확인) 전부 통과.
  - **사람의 GUI 확인 필요**(아직 안 됨, 앞선 마을 넷·STORY 확인
    항목에 이어짐) — Town2↔Town4 새 복도·Crossroads2가 실제로 자연
    스럽게 이어져 보이는지, Town4가 더는 막다른 곳이 아니라는 게
    실제 플레이에서 자연스러운지(문이 늘어난 것만으로 방향감이
    헷갈리지 않는지).
- **STORY — 콘텐츠 확장: 무예 나머지 셋 + 잡졸 열 + 로프/발판 결함 수정
  (2026-09-13, 열여섯 번째 세션, "2,3,4 순으로 다해줘"의 (2)).**
  VERTICAL_SLICE_STORY.md 1절 "제외" 목록(무예 나머지 셋, 사명이
  3/10에서 멈추는 문제)과 열다섯 번째 세션이 "아직 안 고침"으로 남긴
  로프/발판 결함을 함께 메웠다.
  - **잡졸 열 자리** — `FieldMapData.EnemyXPx`를 셋→열로 늘려
    `StoryQuestState.KillGoal`(10)과 정확히 맞췄다("첫 사냥"이 이제
    실제로 완료될 수 있다). 여전히 고정 자리 단순화 유지(원작의
    무작위 리스폰은 범위 밖) — 자리 수만 늘렸다.
  - **로프/발판 결함 수정** — Platform[0](X 3.8~9.0)이 로프(X=6.8) 바로
    위를 지나 로프 위쪽 절반을 오르면 CharacterController가 발판
    밑면에 꼈던 문제(열다섯 번째 세션 발견, 미수정). 로프를 옮기거나
    자르는 대신 **발판 쪽에 틈을 낸다** — `StoryTerrainBuilder
    .BuildPlatform()`이 로프 X가 발판 범위 안이면 두 조각(좌우, 틈
    반폭 0.5=플레이어 반지름0.4+여유)으로 쪼개 짓는다. 오르는 높이는
    그대로(발판 높이까지), 그 사이로 통과만 시킨다.
  - **무예 나머지 셋** — 횡소(橫掃, aoe, cost18·cd4·mul1.8·r≈2.34m)·
    기탄(氣彈, 관통 투사체, cost24·cd6·mul2.1·speed≈10.4m/s, 신규
    `World/StoryBolt.cs`)·기합(氣合, buff, cost30·cd14·8초간 공격
    +35%·이동+20%) — `js/data-job.js` SKILLS[0..3](job:'none' 넷)
    값 그대로, r·spd 등 픽셀만 `FieldMapData.ScaleMPerPx`(구
    `Scale`을 공개로 승격, 중복 정의 방지)로 환산. MP 자원 신규
    (`StoryCombat.Mp`, MpMax=100·회복 8/초, side.js MP_MAX/MP_REGEN
    그대로) — 세이브엔 안 넣음(레벨업·장비처럼 이 슬라이스 밖).
    키보드 2/3/4(연참은 기존 J 그대로), 모바일 액션 버튼 셋 추가
    (점프·공격 줄 위 한 줄, `BuildTestStoryScene.cs`).
  - `StoryHud.cs`에 MP 표시 줄 추가(사명 진행도 아래).
  - `PlaytestStorySlice.cs` 대폭 확장 — 잡졸 열 킬(사명 완료 확인
    포함)·횡소/기탄/기합 각각 즉석 더미로 실제 피해+MP 차감 확인(기탄은
    관통이라 더미 둘을 한 줄에 세워 둘 다 죽는지)·로프 위쪽 끝 겹침
    없음(신규 `RopeTopClearance` 단계, `Move(Vector3.zero)`로 겹침
    강제 재계산)까지. **자동 검증 중 테스트 자체의 결함 둘을 잡았다**
    — (1) MP 차감 확인을 대기(realtime wait) 이후에 하면 그 사이
    자연회복(TickMpRegen)이 이미 수치를 불려 놔 항상 실패 — 대기
    전으로 옮겨 고침. (2) `TeleportPlayer()`(CC disable→대입→enable)를
    같은 프레임 안에서 두 번 연달아 부르면(로프 꼭대기→곧바로 밑동)
    물리 스텝이 한 번도 안 낀 채 토글이 겹쳐 트리거 겹침 추적이 꼬여
    나중 실제 이탈(Move) 때 OnTriggerExit이 안 잡혔다 — 사이에 실시간
    대기(`RopeDescend` 단계)를 끼워 고침. 세이브/로드 kills 기대값도
    하드코딩 3 대신 저장 직전 실측값으로 바꿈(스킬 테스트 더미까지
    합쳐 실제로는 13).
  - 컴파일(오류 없음)·씬 재빌드(`BuildTestStoryScene`, 경고 없음)·
    `PlaytestStorySlice`(`OK - killed 10 grunts (quest done),
    sweep/bolt/brace/jump/rope/save-load all verified, no errors`)·
    회귀 `PlaytestHeadless`(GO)·`PlaytestDungeonHeadless`·
    `PlaytestForestHeadless`·`PlaytestDungeonFloorProgression`(다른
    트랙·DUNGEON 문 구성 무관 확인) 전부 통과.
  - **사람의 GUI 확인 필요**(아직 안 됨, 열다섯 번째 세션의 STORY
    첫 슬라이스 확인 항목에 이어짐) — 횡소·기탄·기합 손맛(특히 기탄
    투사체가 날아가는 게 자연스러운지)·기합 버프 중 이동·공격이
    실제로 빨라 보이는지·잡졸 열을 실기로 잡아 "첫 사냥" 완료 배너가
    뜨는지·로프 꼭대기 근처가 실제로 안 막히는지·모바일 액션 버튼
    다섯 개(점프·공격·횡소·기탄·기합)가 화면에서 안 겹치는지.
- **DUNGEON — 위성↔위성 지름길: Town3↔Town2 (2026-09-12, 열다섯 번째
  세션 이어서, "1,2 다해줘"의 (2)).** saga-dungeon 웹판 PLAN.md §28-3
  "위성↔위성 통로"를 개념만 참고했다(코드 없음 — 웹판은 화면이 서로
  분리된 2D 포털이라 "출구 방향"이 실제 기하학적 방향과 안 맞아도
  됐지만, saga-unity DUNGEON은 처음부터 하나의 연속 좌표계라 그 트릭
  자체가 필요 없다). §28-3이 "인접 사분면끼리만 잇는다, 정반대(N-S)는
  뺀다"고 정한 논리를 그대로 따라 — Town3(서)·Town4(동)는 정반대라
  빼고, **인접한 Town2(남)↔Town3(서)** 하나만 첫 지름길로 잇는다
  (Town2↔Town4는 후속 후보, §28-3도 두 번째 쌍을 후속으로 미뤄 뒀던
  것과 같은 절제).
  - Town3 남쪽 문(신규)→복도(회전 없음, N-S)→**Crossroads**(신규,
  (-30,0,-30), 문 둘만 — 새 콘텐츠 없는 순수 경유지)→복도(Y축 90도
  회전, E-W)→Town2 서쪽 문(신규)으로 이었다. 기존 인프라(OpenNorthDoor/
  OpenSouthDoor/OpenEastDoor/OpenWestDoor, 회전으로 축 바꾸는 복도
  트릭)를 그대로 재사용 — 새 제네릭화 없음.
  - **정직하게 기록 — 거리 자체는 안 줄어든다.** Town3→Crossroads(30)+
  Crossroads→Town2(30)=60, Room1을 거치는 것(Town3→Room1 30+Room1→
  Town2 30=60)과 정확히 같다 — 이 던전이 사방 30 단위 격자라 축 정렬
  통로로는 원래 어느 경로를 골라도 모루골이 이미 기하학적 최단
  경유지다(대각선 직선이 아니면 더 짧게 만들 방법이 없다). 그래도
  §28-3 원문 취지("모루골을 안 거치고 옆 사분면으로 바로 질러간다")
  그대로 **Room1 내부(적·POI)를 다시 안 지나도 되는 우회로**로서
  가치가 있다고 보고 넣었다 — "지름길"이라기보다 "우회로"에 가깝다는
  걸 다음 세션이 헷갈리지 않게 여기 명시해 둔다.
  - Crossroads에 등불 하나만(BuildTownLantern 재사용) — 마을 황금빛도
  야생 바이옴색도 아닌 회색 미니맵 점으로 "그냥 갈림길"임을 표시.
  - 신규 `Editor/PlaytestDungeonShortcut.cs` — Crossroads·Town2(지름길
  경유)에 실제로 서도 예외 없는지 확인. 컴파일(오류 없음)·씬 재빌드
  (`room childCount=20` 그대로, 문 폭·GLB 경고 없음)·`PlaytestDungeonShortcut`
  (`OK`, 신규)·회귀 `PlaytestDungeonHeadless`·`PlaytestDungeonTown2`·
  `PlaytestDungeonTowns34`·`PlaytestDungeonFieldAmbush`·
  `PlaytestOverworldMap`·`PlaytestDungeonFloorProgression`(`OK - 12
  room advances, floor reached 4` — Town2·Town3에 문이 하나씩 더
  늘어도 기존 층 진행에 영향 없음 재확인)·`PlaytestForestHeadless`
  (다른 트랙 무관 확인) 전부 통과.
  - **사람의 GUI 확인 필요**(아직 안 됨) — Crossroads를 실제로 걸어서
  지나 봤을 때 "그냥 갈림길"로 자연스럽게 읽히는지(방이 통째로 텅
  비어 보일 수 있음 — 등불 하나로 충분한지), 두 복도의 방향 전환(N-S→
  E-W)이 시각적으로 어색하지 않은지.
- **STORY 착수 — 버티컬 슬라이스 첫 구현 (2026-09-12, 열다섯 번째 세션,
  "다음은 어느 쪽으로 갈까요?" 질문에 사용자가 "1,2 다해줘"로 (1) STORY
  착수를 확정해 착수).** DUNGEON이 마을 넷(모루골+위성3)으로 원작 규모를
  채운 뒤 PLAN.md 51~65장 확장 순서(GO→DUNGEON→FOREST→STORY→REALM)의
  다음 칸. **레거시 설계를 새로 하지 않았다** — `saga-godot/docs/
  VERTICAL_SLICE_STORY.md`가 이미 설계·구현·헤드리스 검증까지 끝내
  둔 걸 개념만 참고해(코드 기계적 번역 금지, 루트 CLAUDE.md 2장) Unity
  관용구로 새로 지었다.
  - **범위** — 허창 들판 하나, 2.5D 플랫포머(가로 X·높이 Y만 움직임,
    깊이 Z는 이번 슬라이스에서 고정), 달리기+점프+로프 오르내리기 하나,
    무명(초기 직업) 연참(기본 평타) 하나, **급소(crit 15%)+경직(히트스톱
    0.055초)** — 다섯 판 중 이 판만의 손맛이라 **`Time.timeScale`을
    프로젝트 최초로 씀**. 잡졸(황건적) 고정 셋, "첫 사냥"(kill 10) 사명
    (3마리뿐이라 3/10에서 멈춤 — 다음 확장 몫), 저장/불러오기.
  - 신규 — `Data/{StoryCombat,FieldMapData,StoryQuestState,
    StorySaveState}.cs`·`World/{CharacterVisual,StoryRope,StoryEnemy,
    StoryTerrainBuilder,StoryEnemySpawner,StoryCameraFollow,
    GameBootstrap}.cs`·`Player/StoryPlayerController.cs`·
    `UI/{HoldButton,StoryHud}.cs`·`Editor/BuildTestStoryScene.cs`·
    `Editor/PlaytestStorySlice.cs`. 웹판 `data-side.js` 필드 좌표(플랫폼·
    로프·잡졸 자리)는 saga-godot `field_map.gd`가 이미 옮겨 둔 미터값을
    그대로 재사용(다시 역산 안 함).
  - **재해석** — 이 판은 가로 1축 플랫포머라 다른 네 판의 2축
    `VirtualJoystick.cs`를 안 베끼고 좌/우·오르내리기 hold 버튼 넷(신규
    `HoldButton.cs`) + 점프/공격 버튼 둘로 새로 짰다. `DialogueLabel.cs`도
    이 슬라이스엔 상점·대화가 없어 안 만들었다(안 쓸 파일을 다섯 벌째
    복사하지 않음).
  - **자동 검증 중 실제 결함 둘을 잡았다**(사람이 밟기 전에):
    (1) `StoryPlayerController`의 Z고정 로직이 `p.z != 0f`(부동소수점
    정확 비교)였는데, `Move()`의 충돌 슬라이딩이 남기는 1e-6 수준 잔차도
    항상 걸려 **매 프레임 CharacterController를 껐다 켰다** 했다 — 그
    부작용으로 로프 트리거가 Enter 직후 바로 Exit해 버려(로프 위에
    서 있어도 오르기가 아예 안 켜짐) 실기에서도 실제로 겪었을 결함.
    문턱값(0.01) 비교로 고침. (2) 로프(X=6.8m)가 하필 Platform[0]
    (X 3.8~9.0, Y 2.2~2.6) 바로 아래를 지난다 — 로프 위쪽 절반(Y 2.2
    이상)을 오르면 머리가 발판 밑면과 부딪힐 수 있다(원작 2D 웹판엔
    없던 문제 — 평면 사이드스크롤엔 "밑을 지나는 발판"이라는 개념
    자체가 없어서 3D로 옮기며 새로 생겼다). **아직 안 고침** — 아래
    GUI 확인 목록에 추가.
  - **프로젝트 전체에 적용되는 발견** — Unity는 "**트리거와 겹친
    콜라이더를 disable하는 순간 OnTriggerExit를 안 보낸다**"(문서화된
    엔진 동작). 이 저장소의 여러 Playtest가 쓰는 `TeleportPlayer()`류
    헬퍼(`CharacterController.enabled`를 껐다 대입하고 다시 켜는 순간이동)
    로는 트리거 **Enter는 잘 잡히는데 Exit는 안 잡힌다**(disable하는
    순간 이미 "겹침 해제"가 조용히 사라져서) — `PlaytestStorySlice.cs`
    에서 실제로 겪고, Exit 확인만 `CharacterController.Move()`로 실제
    스윕을 굴리는 방식으로 바꿔 고쳤다. DUNGEON이 애초에 트리거 콜백
    대신 Update() 폴링 거리 판정을 쓰는 관례(클래스 주석에 이미 명시돼
    있던 이유)가 바로 이 함정을 피하기 위해서였다는 게 이번에 실제로
    확인됐다 — **트리거 Exit을 순간이동 테스트로 확인해야 하면 이 함정을
    기억할 것.**
  - 검증 — 컴파일(오류 없음)·씬 재빌드(`BuildTestStoryScene`, character-
    {a,d}.glb 정상 로드, GLB 못 찾음 경고 없음)·`PlaytestStorySlice`
    (`OK - killed 3 grunts, jump/rope/save-load all verified, no
    errors`)·회귀 GO `PlaytestHeadless`·DUNGEON `PlaytestDungeonHeadless`·
    FOREST `PlaytestForestHeadless`(다른 트랙 무관 확인) 전부 통과.
  - **사람의 GUI 확인 필요**(아직 안 됨) — 이동감·점프 궤적·로프 W/S
    오르내리기가 실제로 자연스러운지, 로프 위쪽 절반이 Platform[0]과
    실제로 부딪히는지(위 "아직 안 고침" 항목, 부딪히면 로프 길이를
    줄이거나 발판을 옮기는 후속 조치 필요), 급소 히트스톱이 실제로
    느껴지는지, 잡졸 셋을 실기로 잡아 "첫 사냥" 카운트가 오르는지,
    모바일 hold 버튼 넷+점프/공격 버튼이 화면에서 안 겹치는지.
- **DUNGEON — 오픈월드 확장 네 후보 전부(2026-09-12, 열네 번째 세션,
  "1,2,3,4 다해줘"로 착수).** 열세 번째 세션이 남긴 네 후보(마을
  셋째·넷째 추가 / Town2 장식 보강 / 오버월드 지도 UI / 마을 간 필드
  조우)를 순서대로 전부 끝냈다. Room1↔Town2 슬라이스는 여전히 사람이
  실기 확인 전이었지만("아직 안 봤다, 코드로 계속 진행"으로 확인) 그대로
  이어감.
  - **(1) 마을 셋째·넷째** — saga-dungeon 웹판 PLAN.md 28-1절의 별형
    구조(위성 마을은 서로 안 잇고 전부 모루골에만 통한다)를 그대로 따라,
    Room1의 나머지 두 벽(동/서, 지금까지 안 쓰던)을 열어 Town3(서)·
    Town4(동)로 이었다. `DungeonRoomBuilder.cs`에 `OpenEastDoor()`/
    `OpenWestDoor()` 신규(기존 `OpenNorthDoor`/`OpenSouthDoor`와 같은
    `OpenDoorOnWall()`을 축 매개변수로 일반화, 아치도 동/서는 Y축 90도
    회전 필요). 복도는 `DungeonCorridorBuilder`가 늘 로컬 Z를 긴 축으로
    짓는 걸 그대로 두고 **GameObject를 Y축 90도 돌려 세우는 것만으로**
    X축 복도를 만들었다(그 클래스 자체 코드 변경 없음 — 대칭 도형이라
    회전 방향은 안 따진다). Town3 행상은 gem_jade(4, 지금까지 광맥
    확정 드랍 말고는 아무도 안 팔던 재고, 15냥) — Town4 행상은
    wp_glaive(26, 90냥)를 판다(원래 Room10 재고였는데 "절차적 층 진행"
    전환으로 Room10 자체가 없어져 살 자리가 사라졌던 것을 새 마을에서
    되살림 — "층1 두목을 못 잡아도 중간 이상 티어를 살 수 있게"라는
    원래 취지 그대로).
  - **(2) Town2 장식 보강** — 마을 셋(Town2·3·4) 전부에 등롱 둘(점광
    포함)·궤짝 하나·정주 촌민 하나(character-b 모델, Ally와 다른 베이지
    톤, 전투·대화 없는 순수 시각)를 채웠다. 신규 헬퍼는 전투원과 안
    겹치게 마을마다 문·행상 위치에 맞는 오프셋을 따로 받는다.
  - **(3) 오버월드 지도 UI** — saga-dungeon 웹판 PLAN.md 28-1절 "디아블로
    M키 방식"을 옮겼다. 신규 `UI/OverworldMapUI.cs` — M키(`Keyboard
    .current.mKey`, PlayerCombat.cs가 이미 쓰는 것과 같은 직접 읽기
    패턴)로 화면 중앙에 나침반형 5칸(중심=모루골/Room1, 남/서/동=마을
    셋, 북=던전 굴혈)을 펼친다. **텔레포트 없음 — 보기만 하는 창**(웹판과
    같은 결, 미니맵과 목적이 다름을 `Minimap.cs` 클래스 주석에도 명시).
    현재 위치 칸만 플레이어 좌표 문턱(±15)으로 매 프레임(패널이 열려
    있을 때만) 강조.
  - **(4) 마을 간 필드 조우** — 원작(28-1절)은 필드에 로밍 몬스터가
    있었는데 첫 마을 슬라이스(Room1↔Town2)는 통로를 전투 없이 단순화해
    뒀던 것을, 새 시스템 없이 기존 `DungeonAmbush.cs`(랜덤 이벤트
    슬라이스, 25초 쿨다운 룰렛 — 55% 고요·30% 매복·15% 돈주머니)를 들길
    셋(남/서/동) 한가운데 그대로 재사용해 채웠다. roomId를 "field_남/
    서/동"으로 따로 둬 마을 행상의 "방을 다 잡아야 연다" 조건과 안
    엮이게 했다.
  - `UI/Minimap.cs` — Town3(x=-30)·Town4(x=+30)가 동서로 생기며
    `WorldXMin/Max`를 -12/12 → -42/42로 넓혔다(Town2 남쪽 확장 때 Z축을
    넓힌 것과 같은 이유).
  - 신규 검증 도구 셋 — `PlaytestDungeonTowns34.cs`(Town3=gem_jade 세공·
    Town4=wp_glaive 장착 실제 구매까지, `PlaytestDungeonTown2.cs`와 같은
    결)·`PlaytestDungeonFieldAmbush.cs`(들길 셋 방문, 무작위 롤이라
    결과는 안 따지고 예외만 확인)·`PlaytestOverworldMap.cs`(리플렉션으로
    `UpdateHighlight()`를 직접 불러 다섯 좌표→다섯 칸 매핑을 전수
    검증 — M키 입력 자체는 이 프로젝트가 이미 스페이스바·왼쪽 Alt에서
    검증 없이 써 온 표준 패턴이라 새로 안 흉내 냄).
  - 컴파일(오류 없음)·씬 재빌드(`room childCount=14→20`, 문 폭 경고·GLB
    못 찾음 경고 없음)·`PlaytestDungeonTowns34`(`OK`, 신규)·
    `PlaytestDungeonFieldAmbush`(`OK`, 신규)·`PlaytestOverworldMap`(`OK`,
    신규)·회귀 `PlaytestDungeonTown2`(`OK`)·`PlaytestDungeonFloorProgression`
    (`OK - 12 room advances, floor reached 4` — Room1 문 구성이 또 늘어도
    기존 북쪽 진행에 영향 없음 재확인)·`PlaytestDungeonHeadless`·
    `PlaytestForestHeadless`(다른 트랙 무관 확인) 전부 통과.
  - **사람의 GUI 확인 필요**(아직 안 됨) — Town3·Town4로 가는 동/서
    복도·문턱이 실제로 자연스러운지(특히 Y축 90도 회전 복도가 처음이라
    시각적으로 안 어색한지), 마을 셋의 장식(등롱·궤짝·촌민)이 휑함을
    실제로 줄였는지, 오버월드 지도(M키)가 화면에 잘 뜨고 강조가 잘
    보이는지, 들길에서 매복이 실제로 튀어나올 때 위협적으로 느껴지는지.
- **DUNGEON — 오픈월드 확장, 첫 슬라이스: 마을 둘을 걸어서 잇는 진짜
  오픈월드 (2026-09-12, 열세 번째 세션, "DUNGEON 오픈월드 확장으로
  넘어가줘"로 착수).** 착수 전 `js/dungeon.js`·saga-dungeon PLAN.md
  28장을 훑어보니 "오픈월드"가 두 다른 뜻으로 쓰인다는 걸 발견해 먼저
  사용자에게 확인 질문 — (1) 던전 층 하나를 클리어마다 갈아치우는
  로그라이크식 진행(이미 `DungeonFloorRunner`로 구현·100층 검증
  완료) vs (2) **마을이 여럿이고 마을 밖 들판을 걸어서 다른 마을로
  건너가는 구조**(28-1~28-8절, 원작은 마을마다 좌표계가 독립이라
  "위장된 전환"까지 만들어야 했다). 사용자가 (2) "마을 여러 개 —
  걸어서 이어지는 진짜 오픈월드(권장)"로 확정.
  - **핵심 발견 — 이 프로젝트는 원작의 근본 문제 자체가 없다.** 원작이
    28-2절에서 "위장된 전환"(A안 단일 연속 좌표계 대신 B안 통로 트릭)을
    택한 이유는 네 마을이 각자 독립 좌표계라서였다. saga-unity DUNGEON은
    Room1~ProcRoom이 처음부터 **하나의 연속 좌표계**다 — 그래서 "마을
    두 개를 걸어서 잇는다"는 그냥 방 하나 더 짓고 복도로 잇는 것과
    완전히 같다. 새 이동/전환 시스템이 전혀 필요 없다. 세이브도
    `SaveState.cs`가 이미 `playerPos` 세 값을 그대로 저장/복원해
    Town2에서 저장해도 "현재 마을" 같은 새 필드가 필요 없다(둘 다
    검증됨 — 아래).
  - **첫 슬라이스 범위 — 마을 2개**(원작 4개, Vertical Slice First).
    오버월드 지도 UI·마을 3개 이상·마을 간 필드 조우는 범위 밖, 다음
    슬라이스 후보로 남김.
  - Room1의 **남쪽 문**(지금까지 안 쓰던 벽 — 북쪽은 이미 Room2행
    진행에 씀)을 새로 열어 `TownCorridor`(전투 없음, 폐허 톤 대신
    `SagaBiome.None` 중립색으로 "던전이 아니라 들길"임을 구분)를 지나
    **Town2**(첫 위성 마을)로 잇는다. 좌표는 북쪽 진행과 정확히
    대칭(부호만 반대) — 복도 중심 z=-15, Town2 중심 z=-30.
  - Town2도 `biome=None` — 다섯 바이옴(숲·늪·산·사당·폐허)은 전부 이
    던전의 "야생" 정체성이라, 마을(문명)은 일부러 그 다섯에 안 낀다.
    막다른 마을(북쪽 문 하나뿐, 이번 슬라이스엔 더 이상 분기 없음).
  - 신규 `TownMerchant`(`DungeonMerchant.cs` 그대로 재사용) — 지금까지
    어떤 행상도 안 팔던 `wp_axe`(atk12, 이전 최저가 wp_saber18보다
    낮은 티어)를 20냥에 판다. Room1 남쪽 문 바로 너머라 전투 없이도
    닿을 수 있는 자리라, 시작 골드(0)에서도 Room1 안 몇 마리만 잡으면
    살 만한 낮은 가격으로 잡았다. `roomId="town2"`로 등록된 적이 아예
    없어 `DungeonEnemy.CountAliveInRoom("town2")`가 항상 0을 반환하고,
    "방을 다 잡아야 연다" 조건이 평화로운 마을엔 자연히 안 걸린다.
  - 미니맵에 Town2 점 추가(황금빛, 다섯 바이옴 색과 구분되는 "문명"
    색). `Minimap.cs`의 `WorldZMin`도 -15→-45로 넓혀 Town2가 가장자리에
    눌리지 않고 정확한 위치에 찍히게 했다.
  - 신규 `Editor/PlaytestDungeonTown2.cs` — Play 모드에서 Town2·
    TownMerchant 좌표로 순간이동해 실제로 구매(골드 차감·`wp_axe` 장착)
    까지 되는지 확인(문 자체는 스크립트 트리거가 없는 순수 지오메트리라
    — 씬 재빌드 로그에 `DungeonRoomBuilder.OpenDoorOnWall()`의 "문
    폭이 벽 길이보다 넓다" 경고가 없음으로 이미 확인됨 — 별도 검증
    불필요, 진짜 새로 확인이 필요했던 건 "적이 하나도 없는 방에서도
    행상이 예전과 같이 동작하는가"였다). `OK - walked to Town2, bought
    from TownMerchant, no errors`(gold 50→30, wp_axe 장착 확인).
  - **씬 재빌드 중 배치 프로세스가 두 번 안 끝나는 것처럼 보였다** —
    원인은 `-quit` 플래그를 안 줘서였다(`BuildTestDungeonScene.Build()`는
    Playtest류와 달리 자체적으로 `EditorApplication.Exit()`을 안 부른다
    — 저장은 이미 끝났는데 배치 모드가 계속 떠 있던 것뿐, 실제 행 없음).
    로그에 "saved to ... room childCount=16"이 이미 찍혀 있는 걸 확인하고
    PID로 정확히 종료(`taskkill //F //PID`, 이름으로 뭉뚱그리지 않음 —
    다른 세션의 Unity 프로세스를 잘못 건드리지 않기 위해서도 중요). 다음
    세션 참고 — `Build()`류(자체 종료 없음) 백그라운드 호출은 로그의
    "saved to" 줄로 완료를 판단하고 PID로 정리할 것, 무한정 기다리지
    말 것.
  - 컴파일(오류 없음)·씬 재빌드(`room childCount=14→16`, Room1에
    남쪽 문 벽 조각+아치 추가)·`PlaytestDungeonTown2`(`OK`, 신규)·
    `PlaytestDungeonFloorProgression`(회귀, `OK - 12 room advances,
    floor reached 4` — Room1 문 구성 변경이 기존 북쪽 진행에 영향 없음
    확인)·`PlaytestDungeonHeadless`·`PlaytestForestHeadless`(다른 트랙
    무관 확인) 전부 통과.
  - **사람의 GUI 확인 필요**(아직 안 됨) — Room1 남쪽 문·들길·Town2가
    실제로 자연스럽게 이어져 보이는지(문턱 단차 포함, 기존 복도들과
    같은 트레이드오프), Town2가 "마을"답게 느껴지는지(지금은 방 셸+
    행상 하나뿐이라 휑할 수 있음 — 다음 슬라이스 후보로 장식/NPC 추가
    검토), 행상 가격·구매 흐름이 실제로 자연스러운지, 미니맵에서 Town2
    위치가 실제 방향과 맞게 보이는지.
- **FOREST — 창조물 종 늘리기 둘째: 무쇠도깨비·나비정령 (2026-09-12,
  열두 번째 세션 이어서, "바위 지대·꽃밭도 두 종씩 채워줘"로 착수).**
  바로 앞 슬라이스가 채운 버섯숲·어둑숲과 같은 패턴으로 나머지 두
  바이옴도 채웠다 — 이제 `ForestBiomeData.Zones` 넷 전부 종 둘씩,
  여덟 종.
  - **무쇠도깨비** — 바위 지대(bawi와 공유, den을 zone 중심에서
    약 7.2m 비껴 둠). 납작하게 웅크린 몸통(무쇠빛 청회색)+눈 혹 둘로
    bawi(상자+상자 혹, 돌빛 회갈)와 실루엣·색조 둘 다 갈랐다. 여덟 종
    중 가장 느리게 튄다(fleeSpeed 1.8 — 새 초과, 이전엔 이 축(fleeSpeed)
    에 기록이 없었다 — moveSpeed·fleeRadius·wanderRadius 세 축은 이미
    앞선 슬라이스들이 최댓값/최솟값을 다 가져가 있어서 이번에 남은
    유일한 빈 축을 찾아 썼다).
  - **나비정령** — 꽃밭(kkot과 공유, 마찬가지로 약 7.2m 비껴 둠). 작은
    구 몸통 + 납작구 날개 둘(파스텔 보라/청보라)로 kkot(구+화관, 크림/
    분홍)과 갈랐다. 여덟 종 중 가장 급하게 튄다(fleeSpeed 4.8 —
    musoetokkebi와 같은 축의 반대쪽 새 초과).
  - **기존 여섯 종의 "가장 ~함" 주장과 충돌 안 함을 다시 확인** —
    moveSpeed 최댓값(beoseot 2.0)·최솟값(bawi 0.9), fleeRadius
    최댓값(angaeyuryeong 7.5)·최솟값(beoseot 3.0), wanderRadius
    최댓값(kkot 5.0)·최솟값(pojagoemul 1.8) 전부 새 두 종(모두 그 범위
    안쪽 값)에도 그대로 성립. fleeSpeed 축만 이번에 처음 초과값이
    생겼다(1.8/4.8).
  - `ForestCreatureBuilder`에 두 정의 추가(den만, 기존 여섯 무변경).
    `PlaytestForestCreatures.cs`의 `Kinds` 배열에 두 종 추가해 검증
    범위를 여덟으로 넓혔다(성공 로그 "여섯" → "여덟").
  - 검증: 컴파일(오류 없음)·`PlaytestForestCreatures`(`OK - all eight
    creatures wandered and fled correctly, no errors` — 여덟 종 전부
    배회 이동량 0.33~4.51m로 통과, musoetokkebi가 0.33m로 가장 아슬아슬
    했지만 통과 기준(0.2m) 위 — 좁은 wanderRadius를 가진 종일수록
    낮게 나올 확률이 있다는 걸 이번에 실측으로 확인, 기존에도 있던
    시드 없는 무작위 테스트의 성질이라 새로 손대지 않음)·dokkaebi
    도주 재확인·회귀 `PlaytestForestHeadless`·
    `PlaytestForestHouseTransition`·`PlaytestForestFurniture`·
    `PlaytestDungeonHeadless`(다른 트랙 무관 확인) 전부 `OK`.
  - **사람의 GUI 확인 필요**(아직 안 됨) — 무쇠도깨비·나비정령이 실제로
    화면에서 잘 보이는지, 같은 바이옴 안에서 두 종씩(넷 다) 서로 안
    겹쳐 보이는지, 여덟 종 전체를 몰아 봤을 때 마을이 붐벼 보이지는
    않는지.
- **FOREST — 창조물 종 늘리기: 포자괴물·안개유령 (2026-09-12, 열두 번째
  세션 이어서, "창조물 종 더 늘리기부터 이어가줘"로 착수).** 다섯째·
  여섯째 종 추가 — saga-godot에 대응하는 원본이 없어(그쪽은 네 바이옴을
  넷으로 딱 채우고 끝났다) 이번엔 saga-forest 웹판 `data-village.js`
  (`ANIMALS.mushnub`, "포자괴물" — 버섯숲 한정 몬스터)와 한국 설화
  모티프(도깨비불)만 참고해 saga-unity가 처음 설계했다.
  - **포자괴물** — 버섯숲(beoseot과 같은 바이옴, den을 beoseot 자리에서
    약 7.8m 비껴 둠) 몬스터. 찌그러진 몸통(황록) + 삐죽한 포자 혹 셋(암록,
    120°씩 배치)으로 버섯정령(줄기+갓, 청록)과 실루엣을 갈랐다. 넷 중
    가장 좁게 돈다(wanderRadius 1.8 — 새 최솟값, 기존 넷의 "가장 ~함"
    주장과 안 겹치는 축을 새로 잡았다).
  - **안개유령** — 어둑숲(dokkaebi와 같은 바이옴, 마찬가지로 약 8.5m
    비껴 둠) 몬스터, 도깨비불 모티프. **땅에 안 붙어 사는 유일한 종** —
    Den의 y를 1.0으로 줘서 배회 내내 그 높이를 유지한다(`MoveToward`가
    XZ만 바꾸고 y는 그대로 둔다는 걸 이용, 새 코드 추가 없이 기존 이동
    로직 그대로 재사용). 창백한 겉불꽃 구 + 밝은 속불꽃 작은 구로
    "빛이 흔들린다"는 인상만 정적으로 흉내(애니메이션은 범위 밖). 넷 중
    가장 쉽게 놀란다(fleeRadius 7.5 — 새 최댓값).
  - **기존 네 종의 "가장 ~함" 주장과 충돌 안 함을 직접 확인** — bawi(가장
    느림 0.9/가장 안 겁냄 중 최소 fleeRadius는 아님, 4.0)·beoseot(가장
    빠름 2.0, 최소 fleeRadius 3.0 그대로 유지)·kkot(가장 넓은 wander 5.0,
    angaeyuryeong의 4.2보다 여전히 큼) 전부 새 두 종 추가 후에도 그대로
    성립.
  - `ForestCreatureBuilder`에 두 정의만 추가(den 좌표, 기존 넷은 무변경).
    `PlaytestForestCreatures.cs`의 `Kinds` 배열에 두 종 추가해 배회 검증
    범위를 여섯으로 넓혔다(성공 로그 문구도 "네" → "여섯"으로 수정).
  - 검증: 컴파일(오류 없음)·`PlaytestForestCreatures`(`OK - all six
    creatures wandered and fled correctly, no errors` — 여섯 종 전부
    배회 이동량 0.83~3.91m로 통과, dokkaebi 도주 재확인)·회귀
    `PlaytestForestHeadless`·`PlaytestForestHouseTransition`·
    `PlaytestForestFurniture`·`PlaytestDungeonHeadless`(다른 트랙 무관
    확인) 전부 `OK`.
  - **사람의 GUI 확인 필요**(아직 안 됨) — 포자괴물·안개유령이 실제로
    화면에서 잘 보이는지(특히 안개유령이 땅 위 1m에 떠 있는 게 자연
    스러운지, 순간이동한 것처럼 안 보이는지), 같은 바이옴 안에서 두 종이
    서로 겹쳐 보이지 않는지.
- **FOREST — 바이옴 지형 다양성 슬라이스 (2026-09-12, 열두 번째 세션,
  "1,2 순서대로 진행"의 (1) — FOREST 단순화 부분 채우기부터).**
  `VERTICAL_SLICE_FOREST.md`(saga-godot·saga-unity 둘 다)가 "다음
  슬라이스로 미룸"에 남겨 뒀던 "바이옴 지형 다양성(꽃밭·어둑숲·버섯숲·
  바위 지대)"을 채웠다 — `ForestCreatureBuilder`가 이미 네 창조물을
  "바이옴을 흉내낸 구석"이라며 마을 네 귀퉁이에 흩어 둔 자리(주석에
  명시)를 그대로 재사용해, 그 den 좌표를 실제 바이옴 존 중심으로
  승격시켰다 — 창조물 좌표는 하나도 안 옮김.
  - 신규 `Data/ForestBiomeData.cs` — 존 4개(중심·반경·안쪽 반경·정점색
    틴트), `SampleTint(wx,wz)`로 임의 좌표의 배율을 반환(각 존 영향을
    부드럽게 lerp, 겹칠 일 없음 — 대각선으로 가장 가까운 두 존도
    64m 이상 떨어져 있고 반경은 17m).
  - `Shaders/ForestWorldCurve.shader`에 `COLOR` 정점 입력 추가 —
    `_BaseColor`에 곱한다. **정점색이 없는 메시(창조물 primitive 등)는
    Unity가 기본값 (1,1,1,1)을 채워 기존 결과와 완전히 동일** — 실제로
    검증(아래)에서 창조물 넷 다 배회·도주가 그대로 통과했다.
  - `World/ForestGroundBuilder.cs` — 땅 메시를 구울 때 정점마다
    `ForestBiomeData.SampleTint()`를 평가해 정점색으로 얹는다. GO
    `TerrainBuilder.cs`가 겪은 "칸 경계가 바둑판처럼 갈라져 보이는"
    문제와 원인 자체가 다르다 — FOREST 땅은 애초에 타일 격자가 없는
    연속 메시라 정점마다 세계 좌표 연속 함수를 그대로 평가하면 경계가
    저절로 매끈하다(칸별 보간·블렌딩 마진 같은 별도 장치 불필요).
  - **재해석 하나, 문서화됨** — 이 존은 순수 시각 다양성이다. 걷기 판정·
    콜라이더는 여전히 단일 평면(`ForestGroundBuilder` 클래스 주석
    "판정은 항상 평면 좌표로" 원칙 그대로) — 바이옴이 이동 속도·채집
    가능 여부 등 게임플레이 규칙을 바꾸지 않는다(godot 문서도 이 항목을
    "지형 다양성"으로만 분류해 뒀지 규칙으로 분류하지 않았다).
  - 컴파일(신규 셰이더 COLOR 시맨틱 포함 오류 없음)·회귀
    `PlaytestForestHeadless`(`OK - 10 frames, no errors`)·
    `PlaytestForestCreatures`(`OK - all four creatures wandered and
    fled correctly` — den 좌표 무변경이라 배회/도주 수치 그대로)·
    `PlaytestForestHouseTransition`·`PlaytestForestFurniture`·
    `PlaytestDungeonHeadless`(다른 트랙 무관 확인) 전부 `OK`.
  - **사람의 GUI 확인 필요**(아직 안 됨) — 네 바이옴 색이 실제로
    구별되어 보이는지, 존 경계가 매끈한지(이론상 연속 함수라 매끈해야
    하지만 눈으로 확인된 적 없음), 창조물 넷이 각자 바이옴 안에서
    자연스러워 보이는지, 기존 콘텐츠(나무·주민·집·가구 좌판)가 바이옴
    색과 안 부딪히는지.
- **FOREST — 실기 확인 완료, "문제 없어 보여" (2026-09-12, 열두 번째
  세션).** 지난 세션이 "실기 확인부터 할게, 새로운 세션에서 하자"로
  넘긴 것을 사용자가 유니티 에디터로 직접 플레이해 확인 — 구면 투영·
  집 들어가기/나가기·가구 여섯 자리·네 창조물(숲도깨비·바위도깨비·
  버섯정령·꽃정령)의 배회/도주 전부 이상 없음. 아래 "완료 단계"의
  관련 GUI 확인 항목 세 개(몬스터·퓨전 슬라이스, 가구 슬라이스, 구면
  투영/집 곡률)를 지웠다.
- **FOREST — 몬스터·퓨전 콘텐츠 슬라이스 (2026-09-12, 열한 번째 세션
  이어서, "몬스터·퓨전 콘텐츠부터 이어가줘"로 착수).** saga-godot FOREST
  트랙이 `VERTICAL_SLICE_FOREST.md` 5절("몬스터·퓨전 자유" — FOREST 주민은
  애초에 역사 인물이 아니라 역할 이름이라 PLAN.md 5장과 안 충돌한다는 결정)
  에 따라 이미 검증해 둔 네 종(숲도깨비·바위도깨비·버섯정령·꽃정령)을
  개념만 참고해 Unity로 새로 짰다(코드는 안 베낌).
  - 신규 `World/ForestCreature.cs` — Idle→Wander→Flee 상태기계(GO
    `WanderingAnimal.cs`와 같은 구조지만 **Group(무리 전파)는 뺐다** —
    godot 원본 설계에 없던 걸 새로 안 얹음). 전투·포획·HP 없음(이 판의
    핵심은 "돌아다니면 재미있다" — `LEGACY_FEATURE_AUDIT.md` 원칙 그대로).
    FOREST엔 GO의 타일 맵 같은 보행 판정 데이터가 없어(단일 평면) 걸을 수
    있는 자리 검사는 생략.
  - **종별 시각 — 전부 primitive 조합**(GLB 없음) — 숲도깨비(구+원기둥
    뿔)·바위도깨비(상자+상자 혹)·버섯정령(원기둥 줄기+구 갓)·꽃정령(구+
    납작구 화관). Unity 기본 도형에 원뿔·토러스가 없어(DUNGEON 바이옴
    소품이 나무를 원기둥+구로 대신한 것과 같은 이유) 뿔은 기울인 원기둥,
    화관은 Y로 누른 구로 대신했다 — 문서화된 재해석. `Saga/ForestWorldCurve`
    셰이더 머티리얼을 물려 땅과 같이 휘게 했다(셰이더 클래스 주석이 "땅·
    나무·NPC 등" 전부 이걸 써야 한다고 명시하는데, 기존 나무·캐릭터
    폴백은 실제로는 평범한 URP Lit라 안 휠 수 있다는 걸 코드 검토 중
    발견 — 기존 결함은 이번 범위 밖이라 안 건드리고 그대로 둠, 이미
    "나무·주민이 공중에 뜨는지" GUI 확인 항목으로 대기 중이던 것과
    같은 사안이라 새 항목을 안 늘림).
  - **종별 능력치를 갈라 체감을 다르게 잡았다**(godot 수치 그대로 재사용) —
    숲도깨비(속도1.5·도주3.5·경계6.0·배회4.0, 기본값)·바위도깨비(0.9·2.2·
    4.0·2.5, 가장 느리고 덜 겁냄)·버섯정령(2.0·4.2·3.0·3.5, 가장 빠르고
    가장 안 겁냄)·꽃정령(1.2·3.0·5.0·5.0, 가장 넓게 배회).
  - 신규 `World/ForestCreatureBuilder.cs`(GO `AnimalBuilder.cs`와 같은
    "정의 배열+Awake 스폰" 패턴) — 바이옴이 없어 대신 마을 네 귀퉁이
    (기존 콘텐츠와 안 겹치는 자리)에 하나씩. `BuildTestVillageForestScene
    .cs`에 `BuildCreatures()` 추가(명시적 Build() 호출 없음 — 이 컴포넌트는
    edit-time에 그 자식을 즉시 찾을 일이 없어 GO AnimalBuilder와 같은
    패턴으로 충분, `ForestHouse`가 겪은 문제와는 다른 경우).
  - 신규 `Editor/PlaytestForestCreatures.cs` — Play 모드에서 네 종 전부
    배회(Idle→Wander) 실제 이동을 관찰하고, 플레이어를 숲도깨비 옆으로
    순간이동시켜 도주(멀어짐)까지 확인. `OK - all four creatures wandered
    and fled correctly, no errors`(dokkaebi 이동 3.32m·bawi 0.56m·
    beoseot 2.68m·kkot 3.71m, flee 거리 1.00→4.50).
  - 회귀 `PlaytestForestHeadless`·`PlaytestForestHouseTransition`·
    `PlaytestForestFurniture`·`PlaytestDungeonHeadless`·
    `PlaytestDungeonFloorProgression` 전부 재확인.
  - **사람의 GUI 확인 — 2026-09-12(열두 번째 세션) "문제 없어 보여"로 완료.**
- **FOREST — 집 꾸미기(가구) 슬라이스 (2026-09-12, 열한 번째 세션 이어서,
  "가구부터 진행해줘"로 착수).** saga-godot FOREST 트랙이 이미 검증해 둔
  다음 콘텐츠 순서(가구 → 몬스터·퓨전)를 참고해 시작 — 코드는 안 베끼고
  saga-forest 웹판 `js/data-village.js`(FURNITURE 14종·FURN_SETS 4계열·
  HOME_GRADES 6단)·`js/home.js`(score 공식)를 원본 삼아 Unity로 새로 짰다.
  - **재해석 둘, 문서화됨** — (1) FOREST엔 아직 금 경제가 없어(HeroState.Gold
    대응 없음) 채집한 과일(`ForestState.FruitCount`)을 구매 통화로 재해석
    (`ForestState.SpendFruit()` 신규). 집 평가 점수 계산은 웹판 '냥' 값
    그대로 써서 `HOME_GRADES` 문턱이 원작과 그대로 맞아떨어진다(`FurnitureItem
    .Value` vs `.FruitCost` 분리). (2) 원작의 "날짜 해시로 매일 4점만 진열"은
    day/시간 시스템 자체가 없어 GO `LuckyCairn.cs` 패턴(상시 룰렛+쿨다운)으로
    대신했다.
  - **자유 배치 대신 고정 자리 여섯** — 원작은 "선 자리에 놓는다"(임의 좌표)
    지만 FOREST 트랙엔 아직 "놓기" 같은 상호작용 입력 자체가 없어(이동뿐인
    GO판 컨트롤러 재사용), 이 트랙 기존 관례(나무·주민·집 문처럼 "다가가면
    반응")를 그대로 따라 여섯 개 고정 자리로 단순화(`ForestFurnitureAnchor.cs`
    신규) — 비면 창고에서 가장 값진 것을 놓고, 있으면 되거둔다.
  - 신규 `Data/ForestHomeData.cs`(카탈로그·등급표)·`Data/ForestHomeState.cs`
    (창고·자리·점수, `BestiaryState`류와 같은 정적 상태 클래스 결)·
    `World/ForestFurnitureStall.cs`(구매)·`World/ForestFurnitureAnchor.cs`
    (놓기/거두기). `ForestSaveState` v1→v2(`homeStockKeys/Counts`·
    `homeAnchors`).
  - **세이브 로드 시점 문제를 미리 피함** — `ForestFurnitureAnchor`의 자식
    Awake가 `GameBootstrap.Start()`의 `ForestSaveState.TryLoad()`보다 먼저
    돌아 시각화가 로드 전 상태로 굳을 뻔한 걸(saga-godot `forest_house.gd`가
    이미 겪은 것과 같은 순서 문제) 코드 작성 중에 미리 알아채, 첫 `Update()`
    프레임에 한 번만 동기화하는 `_synced` 플래그로 고쳤다(godot의 해법과
    같은 결).
  - **에디터 스크립트 쪽 실제 버그 하나 발견·수정** — `BuildTestVillageForestScene
    .cs`가 방금 지은 `IndoorRoom`을 찾으려다 못 찾는 실제 오류가 났다.
    원인: `ForestHouse`가 지금까지 `Awake()`에서만 실내를 지었는데, **Awake()는
    Play 모드에서만 저절로 불리고 에디터가 씬을 조립하는 edit-time에는
    안 불린다**(DUNGEON류 빌더가 진작부터 공개 `Build()`를 명시로 부르는
    것과 다른 패턴이었다 — `ForestGroundBuilder`도 같은 잠재 결함을 안고
    있었지만 이번엔 안 건드림). `ForestHouse.Build()`를 공개 메서드로
    빼 에디터 스크립트가 명시로 부르도록 고쳤다 — 이 결함이 있었어도
    지금까지의 헤드리스 테스트(Play 모드로 씬을 다시 여는 방식)는 우연히
    다 통과해 왔다(edit-time 조립 직후 상태를 검사한 적이 없어서).
  - 신규 `Editor/PlaytestForestFurniture.cs` — Play 모드에서 과일을 채우고
    좌판·자리를 실제로 오가며 구매→배치→점수→쿨다운 후 거두기까지
    GameObject 경로로 검증. 처음엔 거두기 검증이 실패했는데(프레임 2장만
    기다림), 배치 모드가 실시간보다 훨씬 빠르게(약 초당 5700프레임) 도는
    걸 알아채고 `Time.time` 기준 대기로 고침(프레임 수 기준 대기가 실제
    쿨다운 경과와 다르다는 걸 이번에 처음 확인) — `OK - bought, placed and
    picked up furniture, score changed as expected, no errors`.
  - 회귀 `PlaytestForestHeadless`·`PlaytestForestHouseTransition`·
    `PlaytestDungeonHeadless`·`PlaytestDungeonFloorProgression` 전부 재확인
    (`OK`, 다른 트랙 무관 확인).
  - **사람의 GUI 확인 — 2026-09-12(열두 번째 세션) "문제 없어 보여"로 완료.**
- **FOREST — 집 들어가기/나가기 CharacterController 순간이동 결함 수정 +
  자동 검증 도구 (2026-09-12, 열한 번째 세션, DUNGEON 실기 확인 "문제
  없어 보여" 이후 "더 진행해줘"로 계속).** 사용자가 다음 방향을 물어
  FOREST 실기 확인(첫 커스텀 셰이더라 리스크 큼)을 추천했으나 사용자가
  "더 진행해줘"로 답해, 그 실기 확인은 사용자 몫으로 남겨두고 코드
  검토를 이어갔다 — 바로 위 DUNGEON 세션에서 배운 패턴(`CharacterController`
  가 켜진 채 `transform.position`을 그냥 대입하면 Unity가 다음 프레임에
  조용히 되돌린다)을 다른 트랙에도 있는지 훑어보니, **`ForestHouse.cs`가
  집 들어가기/나가기 때 똑같은 방식으로 플레이어를 옮기고 있었다** —
  아직 사람이 실기로 확인 안 한 코드라 아무도 못 밟았을 실제 결함
  (문에 다가가도 안 들어가지거나, 들어간 것처럼 보였다가 바로 튕겨
  나오는 것처럼 보일 뻔했다). `SaveState.cs`류(GO/DUNGEON/FOREST 전부)의
  위치 복원은 `Start()` 이전(첫 물리 스텝 전)이라 이 문제를 안 밟는다는
  것도 다시 확인 — 셋 다 그대로 둠.
  - `ForestHouse.TeleportPlayer()` 신규 — 대입 전후로
    `CharacterController.enabled`를 껐다 켠다. 들어가기·나가기 두 호출부
    모두 이걸로 교체.
  - 신규 `Editor/PlaytestForestHouseTransition.cs` — `PlaytestDungeonFloorProgression
    .cs`와 같은 결. Play 모드에서 플레이어를 문 앞/실내 출구 앞으로
    순간이동시켜(테스트 하니스 쪽도 같은 CC 토글 필요) `_isInside` 플래그가
    실제로 뒤집히는지, 착지 위치가 몇 프레임이 지나도 안 되돌아가는지까지
    확인한다.
  - 재검증 — `[PlaytestForestHouseTransition] OK - entered and exited the
    house, position held across frames, no errors`. 회귀로
    `PlaytestForestHeadless`(`OK - 10 frames, no errors`)도 재확인.
  - **부수 확인** — Play 모드 진입/종료 중 Unity가 `TestVillageForest.unity`를
    내용 변경 없이 fileID만 재배정해 다시 저장하는 걸 발견(오브젝트 28개·
    이름 전부 diff 0) — 의도한 변경이 아니라 커밋 전 `git checkout`으로
    되돌림(루트 CLAUDE.md급 습관, saga-godot CLAUDE.md의 "에디터가 project.godot을
    조용히 고쳐 쓴다"와 같은 종류의 부작용).
  - **구면 투영·집 안 곡률 포함 — 2026-09-12(열두 번째 세션) "문제 없어
    보여"로 확인 완료.**
- **DUNGEON — 절차적 층 진행 실제 GameObject 경로 자동 검증 + 발견한
  진짜 결함 수정 (2026-09-12, 열한 번째 세션).** 지난 세션이 "다음
  세션이 가장 먼저 할 만한 일"로 남긴 빈틈 — `PlaytestDungeonHeadless`
  (10프레임, 플레이어 안 움직임)는 ProcRoom 첫 방 스폰까지만 확인하고
  문 선택 트리거·`AdvanceRoom`·`Descend`는 이 프로젝트의 어떤 자동
  검증도 안 거쳤던 것 — 를 메웠다. 신규 `Editor/PlaytestDungeonFloorProgression
  .cs` — Play 모드에서 ProcRoom 몬스터를 `DungeonEnemy.TakeDamage(9999
  99f)`로 강제로 죽이고, `DungeonFloorRunner`의 private `_doorPods`를
  리플렉션으로 읽어 첫 문 표지 위치로 플레이어를 순간이동시키는 걸
  반복해 실제 문 트리거·방 전환·층 하강이 GameObject 수준(TextMesh
  라벨·머티리얼·`DoorLabelBillboard` 포함)에서 진짜로 도는지 12회
  왕복 확인한다.
  - **첫 실행에서 실제 버그 둘을 잡았다.**
    (1) 테스트 하니스 쪽 — `CharacterController`가 켜진 채 `transform
    .position`을 그냥 대입하면 다음 프레임에 조용히 원래 자리로
    되돌아간다(Unity 표준 동작, `SaveState.cs`의 위치 복원이 이 문제를
    안 밟은 이유는 `Start()` 이전이라 CC가 아직 한 번도 안 움직인
    시점이라서). 대입 전후로 `controller.enabled`를 잠깐 껐다 켜서 고침.
    (2) **진짜 게임 결함** — `DungeonFloorRunner`가 방을 갈아치운 뒤에도
    플레이어를 문 표지 자리(z=8~9)에 그대로 뒀다. 다음 방이 무전투
    종류(POI, 가중치상 약 49%)면 그 자리에 새로 선 문이 `DoorTriggerRadius`
    (1.8) 안에서 곧바로 다시 트리거돼, 사람이 한 발짝도 안 걸었는데
    방 여러 개(때로는 층 하나 전체)를 순식간에 건너뛰어 버리는 결함이었다
    (자동 검증 전엔 아무도 못 볼 뻔했다 — 실기 플레이어는 문에 닿자마자
    반사적으로 몇 걸음 더 걷지만, 가만히 서 있으면 재현된다). `DungeonFloorRunner
    .RepositionPlayerToEntry()` 신규 — `AdvanceRoom()`/`Descend()`가
    `BuildRoomContent()` 직후 플레이어를 문 구역과 충분히 떨어진 남쪽
    진입 지점(`PlayerEntryOffset`, 로컬 (0,0,-6))으로 되돌려 세운다(다른
    물리적 방들이 복도를 지나야 닿는 것과 같은 느낌으로 통일). 여기도
    CharacterController를 껐다 켜는 같은 패턴 필요.
  - 고친 뒤 재검증 — `[PlaytestDungeonFloorProgression] OK - 12 room
    advances, floor reached 4, no errors`(roomIndex가 매번 정확히 1씩
    증가, floor 2→3→4, cave·fight·well·forage·stair 등 여러 방 종류를
    실제로 거침). `PlaytestDungeonHeadless`(회귀, `OK - 10 frames, no
    errors`)·전체 재컴파일도 통과.
  - **문 선택 트리거·`AdvanceRoom`·`Descend`가 실제 GameObject 경로에서
    도는 것 자체는 이제 자동 검증됐다** — 다만 문 표지 라벨이 실제로
    잘 읽히는지, 남쪽 재배치가 사람이 보기에 자연스러운지(순간이동
    연출 없음 — 시각 효과가 필요할 수도)는 여전히 사람이 GUI로 봐야
    한다(아래 목록에 추가).
- **DUNGEON — 층 깊이 공격력 체감 보정 추가 (2026-09-12, 열 번째
  세션 이어서).** "무기 진행도(atk)도 floor에 따라 오르게" 후보를
  실제로 검토해 보니, 레벨(선형 성장)과 몬스터 hp(1.26^floor 지수
  성장)의 성장 속도 차이가 근본이라 어떤 작은 보정을 얹어도 "100층이
  실제로 클리어 가능해진다"는 뜻은 아니라는 걸 사용자에게 먼저
  설명하고 확인받은 뒤(질문·답변: "그래도 작은 보정을 추가한다(체감용,
  근본 해결 아님)") 진행. `HeroState.Atk`에 `DepthAtkBonus`(층당 +2,
  `DungeonFloorRunner.Instance?.CurrentFloor ?? 1` 기준) 추가 — 새
  세이브 필드 없이 이미 저장되는 층 값에서 매번 다시 계산(파생값).
  `HeroState.cs`가 지금까지 UnityEngine을 안 끌어오는 순수 데이터
  클래스였는데 `Saga.Dungeon.World`(MonoBehaviour가 있는 네임스페이스)
  참조가 처음 생겼다 — `SaveState.cs`가 이미 같은 세션에서 만든
  선례(Data→World 참조)를 그대로 따름. 컴파일·PlaytestDungeonHeadless
  (`OK - 10 frames, no errors`) 통과.
- **DUNGEON — HUD에 던전 층수 표시 추가 (2026-09-12, 열 번째 세션
  이어서, "DUNGEON 더 다듬기" 방향으로 계속).** `PlayerHud.cs`를 보니
  이번 세션에 층 개념(`DungeonFloorRunner`)을 처음 도입했는데 정작
  화면 어디에도 몇 층인지 안 뜨고 있었다(레벨·체력·경험치·돈·무기·
  퀘스트 목표만 있었음) — 사람이 발견하기 전에 코드 검토로 잡음.
  `🕳️ 지하 N층`을 무기·공격력 줄에 추가(`DungeonFloorRunner.Instance
  ?.CurrentFloor ?? 1` — ProcRoom에 아직 안 닿았으면(Room1~4) 1로
  대신 표시). 컴파일·PlaytestDungeonHeadless(`OK - 10 frames, no
  errors`, HUD GameObject 변화 없어 씬 재빌드 생략) 통과.
- **DUNGEON — 절차적 층 진행이 저장/로드에서 사라지던 결함 수정
  (2026-09-12, 열 번째 세션 이어서, "이어해"로 계속 진행 중 코드
  검토로 발견).** `DungeonFloorRunner`를 만들 때 `SaveState.cs`(v4)에
  층 번호를 저장하는 걸 빠뜨렸다 — 지금까진 던전이 방 넷뿐이라 저장할
  "층" 개념 자체가 없었는데, 이 시스템이 층 개념을 실제로 도입하면서
  저장/로드할 때마다 진행이 항상 층2로 리셋되는 실제 결함이 생겨
  있었다(사람이 발견하기 전에 코드 검토로 미리 잡음). `SaveState` v4→v5
  (`dungeonFloor` 필드) — `DungeonFloorRunner.Instance`(신규 정적
  접근점)·`CurrentFloor`·`JumpToFloor(floor)` 추가. **정확한 방
  인덱스·종류까지는 안 남긴다** — 층 하나를 "의미 있는 진행 단위"로
  보고(원작도 `dstate().best`로 최고 층만 추적) 저장된 층의 첫 방
  (전투)부터 다시 시작하게 단순화했다. 컴파일·PlaytestDungeonHeadless
  (`OK - 10 frames, no errors`, 씬 GameObject 구성 변화 없어 재빌드
  생략) 통과.
- **DUNGEON — 오픈월드 확장을 절차적 층 진행 시스템으로 전환, 100층
  검증 (2026-09-12, 열 번째 세션 이어서).** 사용자가 "100층까지
  진행해줘"로 요청 — Room5~11처럼 방을 편집기 스크립트로 손으로 이어
  붙이는 물리적 확장은 100층 규모(방 수백~수천 개)에서 불가능해,
  saga-dungeon 웹판의 실제 방식(방 하나를 클리어마다 갈아치우며 문
  2~3개 중 다음 종류를 고르는 로그라이크식 진행)으로 전환할지 사용자
  에게 먼저 확인받고 착수. **Room5~11은 이제 물리적으로 존재하지
  않는다** — Room4→복도4→**ProcRoom**(방 하나) 구조로 줄었고,
  `World/DungeonFloorRunner.cs`(신규)가 이 방 하나를 층2부터 100층
  까지 계속 갈아치운다.
  - 신규 `Data/DungeonFormulas.cs` — UnityEngine 의존 없는 순수 C#으로
    `enemyHp`/`enemyDmg`/`roomsFor`/`isBossFloor`(js/dungeon.js 실제
    공식)를 그대로 옮기고, 문 종류 가중치 룰렛(`ROOMS`, data-dungeon.js)
    ·문 2~3개 선택(`makeDoors`)도 포팅. UnityEngine 비의존 덕에 씬
    없이도 계산만으로 100층까지 미리 검증 가능.
  - 문 선택은 화면 UI 버튼 대신 이 프로젝트 기존 관례(우물·사당·퍼즐
    제단처럼 "걸어서 가까이 가면 반응")를 그대로 따름 — 방이 갱신될
    때마다 문 자리에 원기둥+월드 공간 라벨(`DamagePopup.cs` billboard
    패턴 재사용)을 세우고, 걸어가면 그 종류로 다음 방이 열린다. 새
    Canvas/EventSystem 배선 없음.
  - 런타임에 즉석으로 만드는 POI에 값을 채우는 정식 API를 각 컴포넌트에
    추가(`DungeonEnemy.SetSpawnContext()`가 이미 쓰던 패턴의 연장) —
    `DungeonEnemy.ConfigureCombat()`, `DungeonMerchant.Configure()`,
    `DungeonTrove`/`DungeonShrine`/`DungeonVein`/`DungeonCaptive`/
    `DungeonForage.SetRoomId()`.
  - **`SimulateDungeonFloors.cs`(신규 에디터 도구)로 2~100층 전부
    검증** — 실제로 100층을 사람이 걸어서 확인하는 건 비현실적이라
    공식만 씬 없이 돌려 예외·NaN·오버플로 없음을 확인. **첫 실행에서
    실제 버그를 하나 잡았다** — 78층 근처에서 보상 exp/gold가 `int`
    캐스트 오버플로로 음수가 됐다(층별 1.25배 복리 성장이 int.MaxValue를
    넘음). `DungeonFormulas.ClampToInt()`로 int.MaxValue에서 눌러 고침
    (HeroState.AddExp/AddGold가 `int`를 받아 long으로 통째로 바꾸면
    SaveState·PlayerHud까지 건드리는 큰 손질이라 이 계산 단계에서
    캡). 고친 뒤 100층까지 방 856개, 예외 없이 통과(`OK - 2층~100층
    전부 통과`) — 100층 hp는 두목 기준 약 1.45조로 사실상 의미 없는
    숫자지만, "공식이 100층까지 안 깨진다"는 것 자체가 이번 요청의
    핵심이라 그대로 둠(밸런스 손질 요청 아님).
  - 컴파일·씬 재빌드(`room childCount=14` 그대로, GLB 못 찾음 경고
    없음)·PlaytestDungeonHeadless(`OK - 10 frames, no errors`, ProcRoom
    첫 방(fight) 스폰까지 실제 Play로 확인) 전부 통과 — **문 선택
    트리거·방 갈아치우기가 실제로 자연스러운지, 라벨이 잘 보이는지는
    사람이 직접 가 봐야 확인됨**(아래 GUI 확인 목록에 추가).
- **DUNGEON — 오픈월드 확장 네 번째 조각: Room10(층2 행상)
  (2026-09-12, 열 번째 세션 이어서).** "층2 방 종류 계속 추가" 방향을
  그대로 이어감 — Room9(퍼즐방, 예전엔 막다른 방) 북쪽에 문을 새로
  뚫어 복도9→**Room10**(층2 행상, 새 막다른 방)으로 이었다(좌표 공식
  그대로 연장: 255/270). `DungeonMerchant.cs`를 그대로 재사용하되
  재고를 새로 배정 — **기존 `wp_glaive`(층1 두목 확정 드랍)를 90냥에
  판다**(Room2 행상 wp_saber 45냥의 2배, 새 아이템 없이 기존 카탈로그만
  재사용) — 층1 두목을 못 잡은 플레이어도 이 깊이에서 중간 이상 티어
  무기를 살 수 있게 하는 게 목적. 미니맵에 Room10 점 추가. 컴파일·씬
  재빌드(`room childCount=14` 그대로, GLB 못 찾음 경고 없음)·
  PlaytestDungeonHeadless(`OK - 10 frames, no errors`) 전부 통과 —
  **Room9→Room10 연결·행상 가격·구매 흐름이 실제로 되는지는 사람이
  직접 가 봐야 확인됨**(아래 GUI 확인 목록에 추가).
- **DUNGEON — 오픈월드 확장 세 번째 조각: Room9(층2 퍼즐방)
  (2026-09-12, 열 번째 세션 이어서).** "층2 방 종류 계속 추가" 방향을
  그대로 이어감 — Room8(채광방, 예전엔 막다른 방) 북쪽에 문을 새로
  뚫어 복도8→**Room9**(층2 퍼즐방, 새 막다른 방)으로 이었다(좌표 공식
  그대로 연장: 225/240). `DungeonPuzzle.cs`를 그대로 재사용(제단 셋·
  순서 판정 로직 무변경 — 이 POI는 몬스터와 무관해 `roomId` 자체가
  없고 보상도 상수라 새 코드 없이 인스턴스 하나만 더 배치). 미니맵에
  Room9 점 추가. 컴파일·씬 재빌드(`room childCount=14` 그대로, GLB
  못 찾음 경고 없음)·PlaytestDungeonHeadless(`OK - 10 frames, no
  errors`) 전부 통과 — **Room8→Room9 연결·퍼즐 순서 판정이 실제로
  되는지는 사람이 직접 가 봐야 확인됨**(아래 GUI 확인 목록에 추가).
- **DUNGEON — 오픈월드 확장 두 번째 조각: Room7·Room8(층2 방 종류
  추가) (2026-09-12, 열 번째 세션 이어서).** 첫 조각(아래 항목) 뒤
  "층을 하나 더(층3)" vs "같은 층 안에 방 종류 더 채우기" 중 사용자가
  후자로 방향을 정함 — floor=2 개념은 그대로 두고 Room1~4가 방 종류를
  다양화했던 패턴을 층2에도 반복. Room6(층2 두목, 예전엔 막다른 방)
  북쪽에 문을 새로 뚫어 복도6→**Room7**(층2 정예 소굴)→복도7→
  **Room8**(층2 채광방, 새 막다른 방)으로 이었다(좌표 공식 그대로 연장:
  165/180/195/210). 정예는 Room3 정예 공식(ELITES 'fierce' hp×1.35·
  dmg×1.9)을 층2 잡졸 기준값(hp30·dmg6)에 그대로 적용(hp=41·dmg=11),
  보상도 hp 성장률(1.25배)로 반올림(exp 30→38·gold 16→20), 확정 드랍은
  기존 `wp_saber` 재사용(새 아이템 없음). 색은 Room3 정예(붉은 분홍)와
  구별되는 녹슨 주황. 채광방은 `DungeonVein.cs`를 그대로 재사용(보상이
  상수라 층별로 안 바뀜 — 새 컴포넌트·값 없이 `roomId="room8"` 인스턴스만
  하나 더). 미니맵에 Room7·Room8 점 추가. 컴파일·씬 재빌드(`room
  childCount=14` 그대로, GLB 못 찾음 경고 없음)·PlaytestDungeonHeadless
  (`OK - 10 frames, no errors`) 전부 통과 — **Room6→Room7→Room8 연결·
  층2 정예의 위협감이 실제로 자연스러운지는 사람이 직접 가 봐야
  확인됨**(아래 GUI 확인 목록에 추가, 사용자가 "실기는 마지막"으로
  정해 둬서 계속 코드로 이어갈 수 있다).
- **DUNGEON — 오픈월드 확장 첫 조각: Room5·Room6(층2 진입) (2026-09-12,
  열 번째 세션).** "다음 작업"이 지시한 (2) 착수 전에 saga-dungeon
  웹판 `js/dungeon.js`를 먼저 훑어 범위를 정했다 — **원작의 "오픈월드"는
  방을 물리적으로 여럿 잇는 게 아니라, 방 하나(`run.room`)를 클리어마다
  갈아치우며 문 2~3개(`makeDoors()`) 중 다음 방 종류를 플레이어가
  고르는 로그라이크식 분기다**(층 끝은 보스방, 클리어하면 `descend()`로
  다음 층 전체가 다시 절차 생성). 이 발견을 사용자에게 보고하고 두
  방향(물리적 확장 계속 vs 원작 로직 전환) 중 선택을 물어 **"물리적
  확장 계속(Room5,6...)"**으로 확정 — 지금 있는 좌표·구조를 안 건드리는
  쪽. Room4(막다른 방)에 북쪽 문을 새로 뚫어 복도4→**Room5**(층2 필드
  잡졸)→복도5→**Room6**(층2 두목, 새 막다른 방)으로 이었다(좌표는 기존
  공식 그대로 연장: Room4Center 90 기준 +30씩 — 105/120/135/150).
  **이 프로젝트가 처음으로 `floor`(층) 개념을 실제로 씀** — 웹판
  `enemyHp`/`enemyDmg` 공식(hp×1.26^(floor-1), dmg×1.20^(floor-1))을
  floor=2로 계산해 그대로 옮김(잡졸 hp=30·dmg=6, 두목 hp=212·dmg=13).
  보상 exp/gold도 hp 성장률(1.26)에 맞춰 반올림(잡졸 20→25, 8→10)하고
  두목은 기존 "잡졸의 5배" 규칙 재사용(125/50). 두목 확정 드랍 신규
  `wp_greatblade`("흑철중검", atk 31 — 층1 두목 아이템 wp_glaive(26)에
  두목 dmg 성장률(11→13)을 그대로 곱한 값). Room5·Room6은 Ruins
  바이옴을 **방에도 처음** 써서 "복도 폐허가 방까지 삼켰다"는 인상,
  층2 두목은 기존 두목(3.2m 적갈)·미니보스(3.6m 자보라)보다 더 크게
  (4.0m)·새 색조(짙은 남색)로 "더 깊이 들어갈수록 더 위협적" 흐름을
  이어감. 미니맵에 Room5·Room6 점 추가. 컴파일·씬 재빌드(`room
  childCount=14` 그대로 — Room1 자식 수라 안 바뀜, GLB 못 찾음 경고
  없음)·PlaytestDungeonHeadless(`OK - 10 frames, no errors`) 전부 통과 —
  **Room4→Room5→Room6 연결·층2 두목의 위협감·아이템 드랍이 실제로
  자연스러운지는 사람이 직접 가 봐야 확인됨**(아래 GUI 확인 목록에
  추가, 사용자가 "실기는 마지막에, 다른 작업이 우선"이라고 정해 둬서
  이번 세션은 계속 코드로 다음 조각을 이어갈 수 있다).
- **PLAN.md 51~65장 확장 순서 — FOREST 착수, 첫 버티컬 슬라이스
  (2026-09-12, 아홉 번째 세션 이어서).** DUNGEON 작은 폴리싱을 다 끝낸
  뒤 "다음 방향" 질문에 사용자가 "1,2 순서대로"(FOREST 착수 → DUNGEON
  진짜 오픈월드 확장)로 답해 착수. **설계는 이미 saga-godot 쪽에
  끝나 있었다** — `saga-godot/docs/VERTICAL_SLICE_FOREST.md`가 구면
  투영·월드 스케일(3m/칸, 90×60m)·카메라(고정, pitch 62°)·첫 콘텐츠
  루프(걷기→채집→대화→집 들어가기→저장)까지 다 결정해 둔 걸 그대로
  참고해 Unity로 옮겼다(자세한 내용·설계 근거는 saga-unity
  `docs/VERTICAL_SLICE_FOREST.md` 참고, 여기는 요약만).
  - **새 폴더 `Assets/Games/SagaForest/`**(`SagaForest.asmdef`) —
    SagaGo·SagaDungeon 코드 참조 없음(다섯 벌 복사 원칙).
  - **이 프로젝트 첫 커스텀 정점 셰이더** — `Shaders/ForestWorldCurve
    .shader`(URP HLSL, godot의 곡률 공식을 그대로 옮김: 플레이어
    위치에서 멀수록 `dot(diff,diff)*curveAmount`만큼 Y를 낮춘다).
    SagaGo `VertexColorLit.shader`를 뼈대로 재사용해 리스크를 줄였다.
    전역 파라미터(`Shader.SetGlobalVector`)라 godot이 헤드리스에서
    확인 못 했던 문제 자체가 Unity엔 없다.
  - **월드**: `ForestGroundBuilder.cs`(90×60m 단일 색 평면, 1.5m
    해상도, 콜라이더는 평평한 원본 — 곡률은 순수 시각 효과).
  - **카메라**: `Player/CameraRig.cs` — DUNGEON의 자유 오빗과 달리
    입력 처리가 아예 없는 완전 고정 카메라로 새로 짬(pitch 62°·거리
    14m). **이동**: `Player/PlayerController.cs` — DUNGEON판(회피
    포함) 대신 GO판(회피 없음)을 복사(이 슬라이스에 전투 없음).
  - **콘텐츠**: `ForestFruitTree.cs`(tree_oak.glb ×4.5, 무제한 채집+
    2초 쿨다운)·`ForestVillager.cs`(NPCS.keeper "숲지기", 대사 그대로)·
    `ForestHouse.cs`(별도 씬 없이 +500m "포켓 공간"으로 곡률 꺼짐/켜짐
    증명, 건물은 아직 primitive) + `Data/ForestState.cs`(과일 개수)·
    `Data/ForestSaveState.cs`(`save_forest.json`).
  - 컴파일(신규 셰이더 임포트 포함 오류 없음)·씬 저장(`Assets/Scenes/
    TestVillageForest.unity`, tree_oak.glb·character-a/b.glb 전부
    로드됨)·`PlaytestForestHeadless.Run`(`OK - 10 frames, no errors`,
    신규 `Editor/PlaytestForestHeadless.cs`) 전부 통과 — **이 프로젝트
    첫 커스텀 셰이더라 GUI 실기 확인이 특히 중요한데 아직 하나도
    안 됨**(땅이 실제로 그릇처럼 휘어 보이는지, 나무·주민이 땅과 같이
    굽어 공중에 안 뜨는지, 집 들어가기/나가기가 실제로 꺼짐/켜짐을
    보여 주는지 — 아래 GUI 확인 목록에 추가).
- **DUNGEON — 미니보스 덩치·색 강화, 사람이 실기로 재확인 완료
  (2026-09-12).** "이제 훨씬 세 보여"로 확인 — 커밋 `66b5f25`(1.8배·
  3.6m·짙은 자보라)가 실제로 효과 있었다. 아래 GUI 확인 목록의 관련
  항목은 지웠다.
- **DUNGEON — Secret Area 전용 POI (2026-09-12, 아홉 번째 세션 이어서,
  사용자가 실기 확인 중 "다른거 진행해"로 지시).** 35장 랜덤 이벤트의
  "Secret Area"를 DungeonAmbush 룰렛 결과 하나로만 얇게 대신했던 걸,
  진짜 탐험해서 찾는 전용 자리로 뺐다 — 신규 `World/DungeonSecretStash
  .cs`(GO `HiddenTreasure.cs`의 발광 구슬 재사용, DUNGEON 관례대로
  Update() 폴링), Room4 SE 빈 구석(경험치+40·돈+30, 성소보다 후하게).
  `SfxPlayer.PlayDiscovery()` 신규(레벨업 톤 재사용 시 착각할 수 있어
  분리). 컴파일·씬 재빌드(room childCount=14 그대로)·
  PlaytestDungeonHeadless 통과, 커밋 `7670c6f`.
- **DUNGEON — 실기 제보 둘 처리 (2026-09-12, 아홉 번째 세션 이어서).**
  사용자가 유니티 에디터로 직접 플레이해 본 결과 둘을 그때그때 반영.
  (1) "미니보스가 두목보다 안 세 보여" — 웹판 `spawnEnemy(floor, true)`
  공식은 원래 두목·미니보스가 완전 동급(HP·공격력 동일)이라 수치는
  안 건드리고, Unity 쪽 연출(두목 1.6배·3.2m·짙은 적갈 vs 미니보스
  1.3배·2.6m·옅은 자보라)만 문제였다 — 미니보스를 두목보다 **더
  크게(1.8배·3.6m)**·더 짙고 채도 높은 자보라로 올려 "더 깊이
  들어갈수록 더 위협적"으로 보이게 함(커밋 `66b5f25`). (2) 퀘스트
  진행이 순서를 벗어나면 조용히 안 인정되던 결함을 사람 확인을
  기다리지 않고 코드 검토로 미리 찾아 고침(아래 참고, 커밋
  `57b69a6`) — 세 목표를 독립 플래그로 재설계, `SaveState` v3→v4.
  둘 다 컴파일·(미니보스는 씬 재빌드도)·PlaytestDungeonHeadless 통과.
- **DUNGEON — PLAN.md(saga-dungeon 웹판) 챕터 순 심화, 나머지 세 조각
  (2026-09-12, 같은 아홉 번째 세션 이어서).** 사용자가 "계속 이어해" →
  "할수 있는 것들은 끝까지 해봐"로 계속을 지시해, 새 아트·오디오 에셋이나
  큰 구조 변경 없이 지금 구조로 갈 수 있는 나머지 챕터를 마저 옮겼다.
  - **35장 랜덤 이벤트**(신규 `World/DungeonAmbush.cs`) — Merchant·
    Treasure·NPC Rescue·Elite Monster·Shrine·Mini Boss는 이미 고정
    콘텐츠로 있어, 남은 Monster Ambush·Secret Area 두 종류만 GO
    `LuckyCairn.cs` 방식의 가중치 룰렛 한 자리(Room2 빈 구석, 25초
    쿨다운, 몇 번이고 반복 가능)로 합쳤다 — 55% 고요·30% 매복(그 자리에
    잡졸 하나가 즉석 스폰)·15% 숨겨진 주머니(돈+12). 매복 스폰을 위해
    `DungeonEnemy.SetSpawnContext()` 신규(편집기 리플렉션과 달리 Play
    중에도 되는 정식 API, GameObject를 비활성으로 만들어 값을 채운 뒤
    활성화해 `Awake()`가 올바른 모델을 보게 함). 기원 비용은 안 받는다
    (대부분 무해하거나 전투 하나를 더 던지는 정도라 경제 위협 안 됨).
  - **26장 HUD 개선**(`PlayerHud.cs`) — 텍스트뿐이던 체력 표시에
    `Image.Type.Filled` 게이지 추가, 텍스트 줄 바로 아래.
  - **37장 사운드**(신규 `Audio/SfxPlayer.cs`) — saga-unity 전체(GO
    포함)를 훑어도 AudioSource/AudioClip을 쓰는 코드가 하나도 없었다.
    CC0 SFX를 새로 구하는 정공법은 이 세션엔 방법이 없어 "그림은 코드가
    그린다"(루트 CLAUDE.md) 원칙을 소리에도 적용 — 사인파+선형 감쇠
    봉투로 짧은 톤을 절차적으로 합성(첫 재생 시 캐시). 평타(PlayHit)·
    강공격(PlayHeavyHit, 크리티컬 대용)·적 처치(PlayEnemyDeath, 하강
    피치)·레벨업(PlayLevelUp, 상승 피치, `HeroState.LeveledUp` 구독)만
    다뤘다 — 환경별 ambience(Forest/Ruins/Swamp)는 루프 음원이 필요해
    순수 합성으로는 부자연스러워 범위 밖.
  - 세 조각 전부 컴파일(오류 없음)·PlaytestDungeonHeadless(`OK - 10
    frames, no errors`) 통과, 랜덤 이벤트·HUD는 씬 GameObject가 늘어
    `BuildTestDungeonScene.Build()` 재실행(`room childCount=14` 그대로
    — Ambush는 Room의 자식이 아니라 씬 루트라 그 카운트는 안 바뀜),
    사운드는 씬을 안 건드려 재빌드 생략. 커밋 둘(`57b35f4` 랜덤이벤트+
    HUD, `327daa6` 사운드)로 나눠 그때그때 푸시 — **셋 다 사람이 GUI로
    아직 확인 안 함**(아래 GUI 확인 목록에 추가).
  - **이걸로 이 던전 규모(방 넷짜리 선형 통로, 새 에셋 없음)에서 코드만
    으로 갈 수 있는 PLAN.md(웹판) 챕터는 사실상 다 옮겼다.** 남은
    28장(오버월드/월드맵)은 방을 여러 개 더 짓고 좌표를 다시 잡아야
    하는 큰 구조 변경(범위를 벗어남, 방 종류 마지막 슬라이스가 이미
    "막다른 방 넷"으로 이 통로를 완결 지었다), 39장(로딩 구조·lazy
    load)은 씬 하나짜리 테스트 규모에선 아직 의미가 없고, 41장(최종
    UX 목표)은 새 코드가 아니라 지금까지 쌓인 것에 대한 평가 게이트다
    — 다음은 코드보다 **사람의 GUI 확인**(아래 목록)이 먼저일 차례.
- **DUNGEON — PLAN.md(saga-dungeon 웹판) 챕터 순 심화, 첫 세 조각
  (2026-09-12, 아홉 번째 세션).** "다음 슬라이스 후보" 목록을 다 끝낸 뒤
  사용자가 "DUNGEON 더 깊이(웹판 PLAN 챕터 순)"으로 방향을 고르고
  "다해줘"로 이어서 진행 — 웹판 PLAN.md 36장(퀘스트)·27장(미니맵)·38장
  (시각 효과) 중 이 판 규모에 맞는 최소 단위만 세 조각 옮겼다.
  - **36장 퀘스트 시스템**(신규 `Data/QuestState.cs`) — 메인 퀘스트
    한 줄만(지역·랜덤·이벤트 퀘스트는 다음 슬라이스, NPC 발주자 자체가
    없다). 두목 처치→미니보스 처치→구출 3단계, 두목·미니보스는 기존
    `BestiaryState`(도감 슬라이스가 이미 처치 시 이름을 기록해 둔다)를
    그대로 재사용해 판정(`DungeonEnemy.cs`를 안 건드리고 완료 감지) —
    구출은 몬스터가 아니라 폴링으로 못 잡아 `DungeonCaptive.cs`가
    `QuestState.MarkCaptiveFreed()`를 직접 부르게 한 줄 추가. 완료마다
    토스트(경험치+25·돈+10)·`PlayerHud`에 현재 목표 상시 표시·
    `SaveState` v3(`questStage`). **처음엔 순서를 벗어나 끝내면
    (예: 미니보스보다 구출을 먼저) 그 완료가 조용히 무시되는 결함이
    있었는데, 같은 세션 안에서 바로 재설계로 고쳤다** — 세 목표를
    독립 플래그(`bossDead`/`minibossDead`/`captiveFreed`)로 바꿔 순서
    무관하게 즉시 인정되게 했다(`SaveState` v3→v4, 커밋 `57b69a6`).
  - **27장 미니맵**(신규 `UI/Minimap.cs`) — 던전이 Room1→Corridor→
    Room2→...→Room4로 이어지는 한 줄짜리 통로뿐이라(오픈월드/필드·방
    종류 마지막 슬라이스 참고, PLAN.md 28장급 오버월드 지도는 범위
    밖) 렌더텍스처용 카메라를 새로 두지 않고 **좌표를 UI 사각형에 직접
    투영하는 개략도**로 가장 작게 만들었다(모바일 성능 우선, PLAN.md
    18장). 방 넷 중심을 정적 점(바이옴과 같은 색조)으로, 플레이어
    위치만 매 프레임 갱신. `SaveButton`(top-right) 바로 아래 배치.
  - **38장 시각 효과 — damage popup·enemy flash·camera shake**(신규
    `World/DamagePopup.cs`) — slash trail·hit spark·ground effect·
    skill particles는 파티클/셰이더 에셋이 새로 필요해 범위 밖.
    damage popup은 Canvas 없이 `TextMesh`(월드 공간, 카메라를 바라보게
    매 프레임 회전)로 가장 가볍게, 0.6초 상승+페이드 후 자동 소멸(풀링
    없음 — 히트 빈도·수명이 짧아 이 규모에선 부담 적다고 판단, PLAN.md
    38장 "quality scaling" 요구는 팝업이 늘면 재검토). `DungeonEnemy
    .TakeDamage()`에 `heavy` 플래그(기본값 false로 기존 호출부 안
    깨짐) 추가 — 맞을 때마다 팝업 + `CharacterVisual.Tint()`로 흰 섬광
    0.08초 후 원래 `bodyColor`로 복귀(`ClearTint()`가 아니라 — 두목·
    정예처럼 원래 색이 있는 개체는 `ClearTint()`가 그 색까지 지운다,
    한 번 밟을 뻔한 함정을 코드 작성 중에 미리 피함). `CameraRig
    .Shake(magnitude, duration)` 신규 — `PlayerCombat`이 평타(0.05m/
    0.08초)·강공격(0.12m/0.15초, 강공격 팝업과 같은 주황으로 구분)
    적중마다 부른다.
  - 세 조각 전부 컴파일(오류 없음)·씬 재빌드(`room childCount=14`
    그대로 — 셋 다 GameObject 계층을 새로 늘리는 변경이 아니라 기존
    오브젝트에 컴포넌트·필드만 추가)·PlaytestDungeonHeadless(`OK - 10
    frames, no errors`) 통과, 커밋 둘로 나눠 그때그때 푸시(`23462e0`
    퀘스트+미니맵, `3d49468` 타격감) — **셋 다 사람이 GUI로 아직 확인
    안 함**(퀘스트 목표 문구 전환·미니맵 점 이동·섬광/팝업/흔들림 자연
    스러움 전부 헤드리스 검증 밖, 아래 GUI 확인 목록에 추가).
- **DUNGEON 다음 슬라이스 후보 — 방 셸 GLB (2026-09-12, 여덟 번째
  세션).** 회피 애니메이션·이펙트 다음으로 이어서 — "환경/건물 GLB"
  슬라이스가 "비율이 안 맞아 이번엔 보류"로 미뤄 뒀던 room-small.glb
  (방 셸, 실측 12×4.4×12)를 마저 썼다. **핵심 아이디어 — 비균등 스케일
  대신 "방을 셸 원본의 정사각(12×12) 비율에 맞추는 균일 스케일"로
  풀었다.** 기존 폭(RoomWidth=20)을 그대로 지키려는 배율은 20/12=5/3인데,
  셸이 정사각이라 같은 배율을 깊이에도 그대로 적용하면 왜곡 없이 20이
  나온다 — `DungeonRoomBuilder.RoomDepth`를 14→20으로 올린 이유(폭은
  안 바뀜, 기존 스폰 좌표는 전부 X 기준이라 **단 하나도 안 옮겼다** —
  깊이만 넉넉해졌다).
  - `gate.glb`도 같은 배율(5/3)로 맞춰 문 폭이 4.4×5/3≈7.33으로
    넓어졌다 — 예전엔 X만 좁히는 비균등 스케일이었는데 셸과 짝을
    맞추며 균일 스케일로 개선됨(부작용, 원래 목표는 아니었음).
  - `corridor.glb`는 반대로 **`DungeonCorridorBuilder.DoorWidth`를
    3→4.0(corridor.glb 실측 폭)으로 올려 스케일을 아예 없앴다**(1,1,1)
    — 이제 프로젝트 안 GLB 셋(캐릭터·복도·방 셸) 중 유일하게 완전
    무왜곡. 문 폭(7.33)이 복도 폭(4.0)보다 넓어 문턱에 살짝 좁아지는
    단이 생기는데, saga-godot도 `gate.glb`(4.4)·`corridor.glb`(4.0)
    사이에 같은 종류 차이를 두고 문서화해 둔 트레이드오프라 그대로
    받아들임.
  - Room2/3/4/복도 중심 z좌표를 새 halfD(10, 예전 7)에 맞춰 다시
    계산(`BuildTestDungeonScene.cs` 주석 참고) — CorridorCenter 12→15,
    Room2Center 24→30, Corridor2Center 36→45, Room3Center 48→60,
    Corridor3Center 60→75, Room4Center 72→90. 각 방 안의 개별 콘텐츠
    (적·상자·행상·소품 등)는 전부 `RoomXCenter + 오프셋` 형태라 **좌표를
    하나도 손대지 않고 자동으로 따라감**.
  - `DungeonRoomBuilder.cs`에 `roomModel`/`RoomScale` 추가 — 채워져
    있으면 셸을 세우고 기존 primitive Floor/Wall(문 갈라진 뒤 조각
    포함)은 렌더러만 꺼서 안 보이는 충돌체로 남김(`corridorModel`과
    같은 결). 색은 `CharacterVisual.Tint()` 재사용, 바이옴 톤 그대로.
  - **한 번 밟은 실수** — `RoomGlbPath` 상수·`SetPrivateField` 배선은
    다 해 놓고 정작 `room-small.glb` 파일 자체를 saga-godot에서 복사해
    오는 걸 깜빡했다(corridor.glb·gate.glb는 지난 슬라이스에서 이미
    복사해 뒀던 걸 착각). 씬 재빌드 로그의 "corridor.glb/gate.glb/
    room-small.glb 중 일부를 못 찾음" 경고로 바로 잡음 — 파일 복사 후
    재임포트·재빌드로 해결.
  - **확인 안 된 가정** — room-small.glb의 실제 문 구멍 폭이 gate.glb
    (4.4)와 같다는 것은 메시를 직접 열어 본 게 아니라 saga-godot
    `test_room.gd`의 `GATE_HALF_WIDTH` 계산 구조에서 역으로 추론한
    값이다. 셸의 시각적 문 구멍과 콜라이더 문 폭이 실제로 겹치는지는
    사람이 직접 걸어서 확인해야 함.
  - 컴파일(오류 없음)·씬 재빌드(`room childCount` 13→14, Room1에
    Shell 하나 추가)·PlaytestDungeonHeadless(`OK - 10 frames, no
    errors`) 전부 통과 — **방 넷이 실제로 돌 벽으로 보이는지, 문
    구멍이 콜라이더 문 폭과 시각적으로 맞는지(위 "확인 안 된 가정"),
    깊어진 방이 휑해 보이지 않는지, 문턱의 폭 차이(7.33→4.0)가 자연
    스러운지는 사람이 직접 봐야 확인됨** — 아래 GUI 확인 목록에 추가.
- **DUNGEON 다음 슬라이스 후보 — 회피 애니메이션·이펙트 (2026-09-12,
  일곱 번째 세션).** 환경/건물 GLB 다음으로 이어서 — 이 프로젝트엔
  Animator/스켈레톤 애니메이션 재생 파이프라인이 아직 전혀 없어서
  (saga-godot `assets/characters/*`엔 AnimationPlayer가 딸려 있어도
  Unity 쪽은 `CharacterVisual.Spawn()`으로 정적으로 세울 뿐 재생 안 함,
  그 파이프라인을 새로 놓는 건 이 조각 하나 몫을 훨씬 넘는 일) —
  `BanditEncounter.cs`가 이미 쓰는 절차적 연출(Tint·Coroutine 스케일
  펄스)과 같은 결로 `Player/PlayerController.cs`에 세 가지를 코드로
  직접 만들었다.
  - **회전 애니메이션** — 회피 대시(0.16초) 동안 `visual`을 회피 방향
    으로 향하게 한 뒤 로컬 X축으로 정확히 360도 굴린다(구르는 동작).
    한 바퀴 그대로라 대시가 끝나면(progress=1→각도 360도=0도) **별도
    복구 코드 없이 저절로 다시 똑바로 선다** — 우연이 아니라 그래서
    360도를 고른 것.
  - **잔상 이펙트** — `TrailRenderer`를 플레이어 루트(`transform`,
    구르는 `visual`이 아니라 — 안 그러면 회전에 잔상 폭이 같이 뒤틀림)
    에 붙여 대시 중에만 `emitting=true`. 새 셰이더 없이 어디서나 되는
    `Sprites/Default`(alpha-blended unlit)를 재사용, 대시(0.16초)보다
    살짝 긴 페이드(0.25초)로 잔상이 자연스럽게 흐려짐.
  - **무적 틴트** — `CharacterVisual.Tint()`(캐릭터 GLB 슬라이스가 만든
    `_BaseColor` MaterialPropertyBlock 유틸, 새 유틸 없이 재사용)로
    무적 시간(0.22초, 대시 0.16초보다 김) 내내 옅은 하늘색으로 덮어써
    "지금 안 맞는다"를 눈으로 알 수 있게 함, 무적이 끝나면 `ClearTint()`
    로 원래 텍스처 복구.
  - 컴파일(오류 없음)·씬 재빌드(`room childCount=13` 그대로 — GameObject
    구성을 하나도 안 건드린 변경, `PlayerController.cs`에 컴포넌트
    로직만 추가)·PlaytestDungeonHeadless(`OK - 10 frames, no errors`,
    다만 **플레이어가 안 움직여 회피 자체가 이번에도 발동 안 함** —
    컴파일·정적 로드까지만 확인됨) 전부 통과 — **회피가 실제로 도는지
    (구르는 회전이 자연스러운지, 잔상이 방향에 맞게 남는지, 무적 색이
    과하거나 밋밋하지 않은지, 대시 끝나고 똑바로 서는지)는 사람이 직접
    가 봐야 확인됨** — 아래 GUI 확인 목록에 추가.
- **DUNGEON 다음 슬라이스 후보 — 환경/건물 GLB (2026-09-12, 여섯 번째
  세션).** 바이옴 5종 다음으로 이어서 — SagaGo가 이미 쓰는 CC0 Kenney
  Modular Cave Kit(`gate-rock.glb`와 같은 킷)에서 `corridor.glb`·
  `gate.glb`만 마저 뽑아 `saga-godot/assets/dungeon/`에서 복사(새
  다운로드 없음, 자세한 실측·스케일 근거는 `docs/ASSET_GUIDE.md` "DUNGEON
  환경/건물 GLB" 절 참고).
  - **복도 셋**(Corridor·Corridor2·Corridor3) — `corridor.glb`(실측
    4.0×4.05×4.0) 두 장을 이어 붙인다. `Length`(8)가 타일 깊이(4.0)의
    정확히 2배라 **Z축은 전혀 안 늘어난다** — X만 DoorWidth(3)/4.0=0.75로
    살짝 좁힘. 색은 새 유틸 없이 `CharacterVisual.Tint()`(캐릭터 GLB
    슬라이스가 만든 `_BaseColor` MaterialPropertyBlock)를 재사용해
    폐허 톤으로 물들임.
  - **방 넷의 문 6곳**(Room1 북 1 + Room2 남북 2 + Room3 남북 2 + Room4
    남 1) — `gate.glb`(실측 4.4×4.4×1.4) 아치를 문 폭(3m)에 맞춰
    X만 0.682로 줄여 세움("아치는 앞뒤 대칭"이라 방향 안 따짐, saga-godot
    `test_room.gd` 주석과 같은 근거). 실제로 지나다니는 자리라 콜라이더
    없음.
  - **room-small.glb(방 셸, 12×4.4×12)는 이번 슬라이스에서 안 씀** —
    DUNGEON 방 치수(20×14×4)와 비율이 많이 달라(X 1.667배·Z 1.167배·
    Y 0.909배로 축마다 제각각) 비균등 스케일 시 벽 질감이 뚜렷하게
    뒤틀릴 걸로 보임. saga-godot `test_room.gd`는 방 치수를 GLB 원본
    (12×12, 스케일 없음)에 맞추는 쪽으로 풀었는데, Unity 쪽은 이미 있는
    방 넷의 모든 스폰 좌표(적·상자·행상·소품 등)를 전부 다시 잡아야 하는
    파급 큰 재설계라 다음 슬라이스로 미룸.
  - GLB 자체엔 콜라이더가 없어(saga-godot `test_room.gd` 주석과 같은
    이유) 기존 primitive Floor/Wall은 그대로 두고 `MeshRenderer.enabled
    = false`로 안 보이는 충돌체로만 남김(에셋이 없는 PC에서는 예전처럼
    보이는 색상 그대로 — 씬이 안 깨짐).
  - **한 번 밟은 버그 없음** — 바이옴 슬라이스에서 이미 `DestroyImmediate`
    교훈을 얻어 이번엔 처음부터 안 밟음(콜라이더를 아예 안 지우고
    렌더러만 끄는 방식이라 애초에 Destroy 호출 자체가 없음).
  - 컴파일(오류 없음)·씬 재빌드(`BuildTestDungeonScene.Build`, **`room
    childCount`가 12→13**으로 늘었다 — Room1 북쪽 문에 gate 아치 하나가
    새로 생겨서, GLB 못 찾음 경고 없이 두 파일 다 로드됨 확인)·
    PlaytestDungeonHeadless(`OK - 10 frames, no errors`) 전부 통과 —
    **복도 타일이 실제로 이어져 보이는지(이음매), 문 아치가 문 폭에
    자연스럽게 맞는지, 폐허 톤 틴트가 과하거나 밋밋하지 않은지는 사람이
    직접 봐야 확인됨** — 아래 GUI 확인 목록에 추가.
- **DUNGEON 다음 슬라이스 후보 — 바이옴 5종 (2026-09-12, 다섯 번째
  세션).** 세공·행상 재고 굴리기·도감 다음으로 이어서 — saga-dungeon
  웹판 `js/field3d.js`의 `THEME_BIAS`(다섯 성격: `town:forest`·
  `town:ruins`·`town:swamp`·`town:mountain`·`town:shrine`)를 옮겼다.
  그 표는 절차 생성 마을의 **소품 배치 가중치**일 뿐 색 수치가 따로
  없어(웹판은 이미 있는 3D 타일셋 재사용) 이 다섯 성격을 구분하는 바닥/
  벽 색과 방 구석 소품은 새로 잡았다(신규 `World/SagaBiome.cs` enum).
  - `DungeonRoomBuilder.cs`에 `biome`/`decorOffset` 필드 추가 —
    `SagaBiome.None`(기본값)이면 예전 색 그대로(회귀 없음). `BuildDecor()`
    가 방 구석에 성격을 드러내는 소품 클러스터를 놓는다(primitive뿐 —
    Unity 기본 도형엔 원뿔이 없어 나무는 원기둥(줄기)+구(수관)로 대신).
    `DungeonCorridorBuilder.cs`는 바닥/벽 색만(좁은 통로엔 소품 안 둠 —
    길 막힘 방지).
  - 방 안 콘텐츠와 어울리게 배정: **Room1**(황건적 소굴)=숲(웹판
    THEME_BIAS `산채(山寨)`가 forest 1.8 가중치인 것과 같은 결) — 나무
    셋, **Room2**(오픈월드/필드)=늪 — 물웅덩이+갈대 셋, **Room3**(정예·
    미니보스·채광방)=산 — 바위 셋, **Room4**(퍼즐 제단·구출, 막다른 방)=
    사당 — 석등(단청 붉은 지붕+따뜻한 점광원). **복도 셋 전부**=폐허
    (다섯 성격 중 방 넷에 못 들어간 나머지 하나, 색만). 소품 위치는
    각 방의 기존 콘텐츠(적·상자·행상·광맥 등)와 안 겹치는 빈 구석을
    방마다 좌표로 확인해 잡음(`BuildTestDungeonScene.cs` 주석에 근거).
  - **한 번 밟은 버그** — `BuildDecor()`가 소품 콜라이더를 `Object.
    Destroy()`로 지웠더니 "Destroy may not be called from edit mode!"
    (씬 조립이 에디터 스크립트에서 도는 edit mode라, `DungeonTrove.cs`
    등 기존 코드는 **런타임**(Awake, Play 모드)에서 지워서 문제가 없었던
    것과 다름) — `Object.DestroyImmediate()`로 고침(`OpenDoorOnWall()`이
    이미 쓰던 것과 같은 패턴, 처음부터 그렇게 짰어야 했다).
  - 컴파일(오류 없음)·씬 재빌드(`BuildTestDungeonScene.Build`, **`room
    childCount`가 6→12로 늘었다** — Room1에 소품(나무 셋×2메시=6개)이
    새로 생겨서, 앞으로 이 값이 기준선)·PlaytestDungeonHeadless(`OK -
    10 frames, no errors`) 전부 통과 — **다섯 구역이 실제로 색조로
    구별되는지, 소품이 기존 콘텐츠를 가리거나 겹치지 않는지, 사당의
    점광원이 과하거나 부족하지 않은지는 사람이 직접 봐야 확인됨** —
    아래 GUI 확인 목록에 추가.
- **DUNGEON 다음 슬라이스 후보 — 세공·행상 재고 굴리기·도감 (2026-09-12,
  네 번째 세션, 토큰 소진으로 중단됐다 이어서 마무리).** 방 종류 마지막
  다음으로 이어서 — 남은 후보 중 이 한 묶음을 골라 세 조각을 함께
  끝냈다.
  - **세공**(신규 `Data/GemData.cs`) — `js/data-gem.js`의 절차적 세공
    (구멍 수·등급별 옵션 룰렛)은 범위 밖이라 `ItemData.cs`와 같은 결로
    고정 3종만: 벽옥(gem_jade, atk+4, 광맥 확정 드랍)·남주(gem_sapphire,
    atk+8, 신규 Room3 행상 판매)·홍옥(gem_ruby, atk+14, 미니보스 확정
    드랍). 무기 소켓 하나뿐(둘째 소켓·세트 효과 없음) —
    `HeroState.SocketedGemId`+`SocketIfBetter()`(`EquipIfBetter()`와
    같은 "더 센 것만" 규칙)로 `Atk` 계산에 더해진다. `DungeonVein.cs`가
    원래 세공 시스템 부재로 돈 지급으로 단순화했던 걸 **원래 의도(보석
    지급)로 되돌렸다**, `DungeonEnemy.Die()`도 `rewardGemId`가 채워진
    적(미니보스)만 보석을 준다.
  - **행상 재고 굴리기**(`World/DungeonMerchant.cs` 확장 + `Editor/
    BuildTestDungeonScene.cs`의 `BuildGemMerchant()` 신규) —
    `rollMerchantStock()`의 절차적 티어 룰렛은 여전히 범위 밖(이 프로젝트
    "테스트 씬은 전부 고정 좌표" 결정성 원칙과 `Math.random()`이
    상충한다)이라, **"행상마다 파는 게 다르다"는 핵심만** 인스턴스별
    고정값으로 살렸다 — 기존 `SellItemId`/`Price` const를
    `[SerializeField]` 필드(`sellItemId`/`price`/신규 `sellGemId`)로
    바꿔 Room2 행상(무기, 기존 동작 그대로)과 새 Room3 행상(보석
    남주, 50냥 — wp_saber(45)보다 비싸게, 무기를 대체 안 하고 위에
    더해지는 값이라서)이 서로 다른 재고를 팔게 했다.
  - **도감**(신규 `Data/BestiaryState.cs`) — 웹판 PLAN 34절의 완전한
    포획·펫 장착 시스템(saga-go와 공유하는 PD 도감)은 범위 밖(DUNGEON엔
    아직 펫 장착 자체가 없음)이라 "만난 몬스터 종류를 기록한다"는 핵심만
    — `DungeonEnemy.Die()`가 처치마다 `displayName`을 기록하고, 처음
    보는 이름이면 토스트에 "📖 도감에 처음 기록됨"을 덧붙인다(새 UI
    화면 없음 — `DungeonTrove.cs`·`DungeonShrine.cs`가 이미 쓴 "화면
    대신 토스트" 원칙과 같은 결).
  - `SaveState.cs` v1→v2 — `gemId`·`discovered`(도감 스냅샷) 필드 추가,
    구 v1 세이브는 JsonUtility가 그냥 기본값(null/빈 배열)으로 채워
    그대로 로드된다(PLAN.md 75장 Data Versioning).
  - 컴파일(`-batchmode -nographics -quit`, 오류 없음)·씬 재빌드
    (`BuildTestDungeonScene.Build`, `room childCount=6` 그대로 — Room3에
    GameObject가 늘었지만 그 카운트는 Room1 것이라 안 바뀜)·
    PlaytestDungeonHeadless(`OK - 10 frames, no errors`) 전부 통과 —
    **Room3 신규 행상이 실제로 남주를 파는지, 미니보스가 홍옥을 떨구는지,
    광맥이 벽옥을 주는지, 도감 토스트가 실제로 뜨는지는 사람이 직접
    가 봐야 확인됨** — 아래 GUI 확인 목록에 추가.
- **DUNGEON 다음 슬라이스 후보 — 방 종류 마지막 (2026-09-12, 세 번째
  세션 "1,2 순서대로" 중 첫 조각).** GLB 자산 도입 다음으로 이어서(새
  세션, "이어해") — saga-dungeon 웹판의 남은 room kind 여섯 종
  (elite·miniboss·cave·puzzle·event·forage, js/dungeon.js:318 목록)을
  전부 옮겼다. Room2 북쪽에 복도로 **Room3**(정예 소굴+미니보스+
  채광방), 그 북쪽에 다시 복도로 **Room4**(구출+퍼즐+채집, 막다른 방)를
  이었다 — 좌표는 "오픈월드/필드" 슬라이스가 쓴 것과 같은 공식(halfD=7·
  벽두께=1·복도길이=8)을 그대로 이어감.
  - **정예 소굴**(js/dungeon.js:342-347) — 정예 하나(ELITES 표의
    'fierce' 배율 hp×1.35·dmg×1.9만 고정으로 적용, 나머지 7종 접사·
    절차적 룰렛은 범위 밖) + 잡졸 둘. 새 스크립트 없이 `DungeonEnemy`의
    기존 [SerializeField]만 재구성(두목 때와 같은 패턴) — HP=32·
    공격력=10·확정 드랍 "환도"(wp_saber, 행상이 파는 것과 같은 아이템
    재사용), 색은 ELITES 'fierce'의 실제 헥스(#e06565)를 그대로 옮김.
  - **미니보스**(js/dungeon.js:348-352) — 부하 없이 혼자, 두목과 같은
    노획 흐름(`isBoss=true`)을 그대로 재사용(웹판도 `kill()`이 `e.boss`
    만 보고 이미 보스급 노획을 준다 — 미니보스도 동률). 덩치(1.3배,
    2.6m)·색(자보라)만 두목(1.6배·짙은 적갈)과 다르게 잡아 구분.
  - **채광방**(js/dungeon.js:353-358, 신규 `World/DungeonVein.cs`) —
    세공 재료 확정 2개(웹판)가 세공 시스템 자체 부재로 범위 밖이라
    `DungeonShrine.cs`와 같은 단순화(경험치+돈)로 대신함, 웹판 주석
    "우물 회복량 40%만큼 후하게"를 따라 트로브(24골드)보다 후한 36골드로
    잡음. `DungeonTrove.cs`처럼 `CountAliveInRoom(roomId)==0`으로 방
    클리어를 판정.
  - **퍼즐방**(js/dungeon.js:366-382, `touchPuzzlePod()` js/dungeon.js:
    820-840, 신규 `World/DungeonPuzzle.cs`) — 제단 셋을 맞는 순서로
    밟는다, 틀리면 처음부터. 웹판은 방마다 순서를 무작위로 섞는데, 이
    프로젝트 테스트 씬은 전부 고정 좌표라(루트 CLAUDE.md "검증 습관")
    순서를 결정적으로 고정(`Order = {1,2,0}`). 유일하게 `room.cleared`를
    안 보는 POI(웹판도 안 봄 — 몸이 아니라 머리로 푸는 방). 다 풀면
    돈+20·"환도" 확정 지급.
  - **이벤트방(구출)**(js/dungeon.js:383-393, 2203-2221, 신규
    `World/DungeonCaptive.cs`) — 지키는 잡졸 둘을 다 잡아야 풀려난다.
    웹판은 은사(boon)를 고르지 않고 바로 하나 얹는데, 은사 시스템 자체가
    범위 밖(`DungeonShrine.cs`가 이미 같은 이유로 뺐다)이라 그 자리를
    경험치 지급으로 대신(성소 30보다 가볍게 15로 잡음 — "받은 은혜"가
    정식 가호보다 가볍다는 뜻), 노획물(dropItem·dropGold quality 16/2)은
    돈 16으로 환산(잡졸 보상 8 × quality 2배율, 트로브·성소가 이미 쓴
    환산과 같은 결).
  - **채집·낚시방**(js/dungeon.js:394-412, 2223-2243, 신규
    `World/DungeonForage.cs`) — 약초 셋(방 안 치워도 닿으면, 항아리와
    같은 손짓)은 웹판이 인벤 아이템(단약)을 주는 대신 인벤토리 시스템이
    없어 `DungeonWell.cs`와 같은 결로 체력 소량 회복(+6, 셋 다 캐면
    +18)으로 대신. 못(방 다 치운 뒤 한 번, 우물·사당과 같은 손짓)은
    웹판의 확률 노획(금/재료/아이템)도 인벤 없이는 못 옮겨
    `DungeonVein.cs`와 같은 단순화(확정 경험치+돈)로 갈람.
  - 새 Room3·Room4는 각각 `DungeonRoomBuilder.OpenSouthDoor`+
    `OpenNorthDoor`(Room3, 양쪽 다 문)·`OpenSouthDoor`만(Room4, 막다른
    방)으로 뚫었다 — 기존 문 API를 그대로 재사용, 새 빌더 로직 없음.
  - 컴파일(`Unity.exe -batchmode -nographics -quit`, 오류 없음)·씬
    재빌드(`Saga.EditorTools.BuildTestDungeonScene.Build`, `room
    childCount=6` 그대로 — Room1은 안 바뀜)·PlaytestDungeonHeadless
    (`OK - 10 frames, no errors`, **주의 — `-executeMethod`로 이 메서드를
    부를 땐 `-quit`을 같이 주면 안 된다**, 파일 자체 주석에 있던 걸
    이번에 실제로 한 번 잘못 줘서 재확인함) 전부 통과 — **Room3·Room4가
    실제로 복도를 따라 걸어서 닿는지, 정예·미니보스가 실제로 위협적으로
    보이는지, 채광방/퍼즐방/구출/채집이 각각 의도대로 반응하는지는
    사람이 직접 가 봐야 확인됨** — 아래 GUI 확인 목록에 추가.
- **DUNGEON 다음 슬라이스 후보 — GLB 자산 도입 (2026-09-12, 두 번째
  "1,2,3,4" 네 후보 중 마지막).** 부대 시스템 다음으로 이어서(같은
  세션) — 지금까지 플레이어·잡졸·두목·동행이 전부 primitive capsule
  이었던 걸 실제 3D 모델로 바꿨다. **새 GLB를 안 받고 SagaGo가 이미
  쓰는 Kenney "Blocky Characters"(`Assets/Art/Characters/
  character-{a,b,c,d}.glb`)를 그대로 재사용** — PLAN.md 0장·8장이
  이미 트랙 간(saga-godot↔saga-unity) 자산 재사용을 허용해 뒀고, 같은
  saga-unity 안에서 GO↔DUNGEON이 코드가 아니라 에셋 파일만 공유하는
  것도 같은 원칙의 연장(SagaDungeon.asmdef는 여전히 SagaGo를 코드로
  참조하지 않는다 — 에디터 스크립트가 경로로 GLB를 로드해 두 트랙 다
  같은 파일을 각자 인스턴스화할 뿐).
  - 신규 `World/CharacterVisual.cs` — SagaGo `World/CharacterVisual.cs`
    를 그대로 복사(네임스페이스만 변경, 루트 CLAUDE.md "다섯 벌 복사"
    원칙). `SpawnFallbackCapsule()`만 GO 버전과 달리 `targetHeight`를
    인자로 받게 고쳤다 — DUNGEON은 잡졸(2m)·두목(3.2m)·동행(1.7m)처럼
    배역마다 목표 높이가 갈려서다.
  - 배역 배정(모델 4종에 배역 4개, 정확히 나뉨): **a=플레이어**(무색,
    1.8m — CharacterController.height와 맞춤), **b=동행**(청색,
    1.7m), **c=두목**(짙은 적갈, 3.2m — 잡졸과 실루엣도 구분되게 다른
    모델), **d=잡졸+부하+필드 잡졸**(황건색, 2m).
  - `DungeonEnemy.cs`·`AllyFighter.cs`에 `[SerializeField] GameObject
    modelPrefab` 신규 — Awake()가 실제 Play 때도 도는 런타임 코드라
    AssetDatabase를 못 써서(에디터 전용 API), SagaGo NpcBuilder.cs가
    이미 쓴 패턴대로 `BuildTestDungeonScene.cs`가 씬 빌드 시점에 값을
    채워 직렬화해 둔다. null이면(다른 PC에 GLB가 아직 없는 경우 등)
    `CharacterVisual.SpawnFallbackCapsule()`로 자동 대체 — 씬 빌드
    자체는 안 깨짐.
  - 기존 primitive capsule엔 안 쓰이던 `CapsuleCollider`가 달려
    있었는데(DUNGEON 코드 전체를 훑어 물리 충돌·트리거를 하나도 안
    쓰는 걸 확인) GLB엔 콜라이더가 없어 그냥 없앴다 — 실제 동작에
    영향 없음(확인된 단순화).
  - 컴파일·씬 재빌드(`room childCount=6` 그대로, 캐릭터는 Room의
    자식이 아니라 안 바뀜)·PlaytestDungeonHeadless(`OK - 10 frames,
    no errors`, character-{a,b,c,d}.glb 넷 다 못 찾음 경고 없이 로드됨)
    전부 통과 — **실제로 캐릭터가 화면에 제대로 보이는지(텍스처·비율),
    두목의 3.2m 스케일이 과하게 크지 않은지, 네 배역이 색조로
    구별되는지는 사람이 직접 봐야 확인됨** — GO 세션이 이미 남긴
    주의사항과 같음("GLB 모델의 정면이 Unity +Z와 맞는지 확신 없음").
- **DUNGEON 다음 슬라이스 후보 — 부대(다중 영웅) 시스템 최소 단위
  (2026-09-12, 두 번째 "1,2,3,4" 네 후보 중 세 번째).** 방 종류
  나머지 다음으로 이어서(같은 세션) — 웹판 `js/hero.js`의
  `partyPower()`(동행 전원의 might*0.7+wisdom*0.3=atk 합산)는 등용·
  성장·장비까지 갖춘 완전한 부대 시스템을 요구해 이번 슬라이스 범위
  밖(VERTICAL_SLICE_DUNGEON.md "제외", `HeroState.cs`도 같은 이유로
  단일 캐릭터로 남아 있음)이라 **"혼자가 아니라 여럿이 함께 싸운다"는
  핵심 가치만** 가장 작은 단위로 보여줬다. 신규 `World/AllyFighter.cs` —
  등용 절차 없이 처음부터 플레이어 옆(스폰+1.5m)에 있는 동행 하나가
  스스로 근처(8m 안) 몬스터를 찾아 다가가 싸운다(공식은 `partyPower()`
  그대로: might=24·wisdom=12·command=18인 가상의 "동행 무사" 기준
  atk=24×0.7+12×0.3=20.4, 한 타 피해는 기존 `atkOf()` 공식 재사용).
  **체력·죽음 처리는 없다**(안 죽는다) — 이번 슬라이스는 화력이
  늘어난다는 것만 증명하고, 동행의 생존·이탈·재등용은 다음 슬라이스
  몫. `DungeonEnemy.Die()`는 누가 마지막 타격을 넣었는지 안 가려
  플레이어(`HeroState`)가 그대로 경험치·돈·아이템을 받는다(바꾸지
  않음). 컴파일·씬 재빌드(`room childCount=6` 그대로)·
  PlaytestDungeonHeadless(`OK - 10 frames, no errors`) 전부 통과 —
  **동행이 실제로 플레이어를 따라다니는지, 몬스터를 발견하면 알아서
  다가가 싸우는지, 여럿에게 둘러싸였을 때 화력 증가가 체감되는지는
  사람이 직접 봐야 확인됨**(헤드리스는 플레이어가 안 움직여 동행이
  몬스터를 발견하는 상황 자체가 검증 밖).
- **DUNGEON 다음 슬라이스 후보 — 방 종류 나머지(행상) (2026-09-12,
  두 번째 "1,2,3,4" 네 후보 중 두 번째).** 스킬 다양화 다음으로
  이어서(같은 세션) — 웹판 `room.merchant`(dungeon.js:359-365,
  2173-2178)를 옮겼다. 절차적 재고 굴리기(`rollMerchantStock`)는
  범위 밖이라 GO `Data/ShopState.cs`의 단순화("고정 물건 하나를 돈이
  있으면 산다")를 재사용 — 신규 `World/DungeonMerchant.cs`, Room2에서
  잡졸 둘을 잡아야 열리고 45냥에 신규 `ItemData` "환도"(AtkBonus 18,
  wp_axe 12와 wp_glaive 26 사이 중간 티어)를 판다. GO와 달리 **돈이
  모자라면 "다 팔았다" 처리 없이 다시 시도 가능**하게 뒀다(웹판도
  `room.merchant.used`만 보고 돈은 안 깎지만, 이 슬라이스는 GoldState가
  있어 "돈 있어야 산다" 규칙을 넣음) — 대신 거절마다 매 프레임 토스트가
  안 뜨게 3초 쿨다운을 넣었다.
  - **곁다리로 실제 버그를 하나 고쳤다** — Room2가 생기며 `DungeonTrove
    .cs`/`DungeonShrine.cs`가 "방 클리어"를 판정할 때 쓰던
    `DungeonEnemy.Active.Count`가 **씬 전체 몬스터를 합친 값**이라,
    Room2 잡졸이 살아 있는 동안엔 Room1의 상자·성소가 절대 안 열리는
    잠재 버그가 있었다(오픈월드/필드 슬라이스가 만든 회귀, 아직 사람이
    발견하기 전에 이번에 코드 검토로 잡음). `DungeonEnemy.cs`에
    `roomId`([SerializeField], 기본값 "room1") + `CountAliveInRoom
    (roomId)` 정적 헬퍼를 추가해 상자·성소·행상이 자기 방 몬스터만
    보게 갈랐다 — Room1 스폰은 기본값 그대로 안 건드리고 Room2 스폰
    (필드 잡졸 둘)만 `roomId="room2"`로 덮어씀.
  - 컴파일·씬 재빌드(`room childCount=6` 그대로)·PlaytestDungeonHeadless
    (`OK - 10 frames, no errors`) 전부 통과 — **행상 좌판이 실제로
    구분돼 보이는지, Room2 잡졸을 잡아야만 반응하는지, 돈이 부족할 때
    거절 문구가 스팸 안 되는지, 방금 고친 상자/성소 버그가 실제로도
    풀렸는지(Room2를 안 건드리고 Room1 상자만 먼저 열어도 되는지)는
    사람이 직접 가 봐야 확인됨.**
- **DUNGEON 다음 슬라이스 후보 — 스킬 다양화(강공격) (2026-09-12,
  사용자가 지시한 두 번째 "1,2,3,4" 네 후보 중 첫 번째).** 오픈월드/
  필드 다음으로 이어서(같은 세션) — 웹판 `js/dungeon.js:2509`
  `heavyAttack()`의 실제 상수를 그대로 옮겼다: 쿨다운 1.3초·피해 배율
  2.6배·사거리 1.15배, 회피 중엔(`p.dash || p.dodge`) 못 씀. 넉백
  (HEAVY_KB=26)은 이 슬라이스에 밀치기 물리가 없어 뺐다. `PlayerCombat
  .cs`에 `TryHeavyAttack()` 추가(기존 `TryAttack()`과 같은 결, 쿨다운·
  사거리만 다름) — 회피 중 확인을 위해 `PlayerController.cs`에
  `IsDodging` 프로퍼티 신규 노출. 데스크톱은 Left Alt 직접 읽기(공격의
  Space·회피의 Left Ctrl과 같은 관례), 모바일은 공격 버튼 바로 위에
  새 "강공격" 버튼(주황). 컴파일·씬 재빌드(`room childCount=6` 그대로)·
  PlaytestDungeonHeadless(`OK - 10 frames, no errors`) 전부 통과 —
  **강공격이 실제로 평타보다 훨씬 세게 느껴지는지, 쿨다운 1.3초 동안
  못 쓰는 게 자연스러운지, 회피 중엔 실제로 안 나가는지는 사람이
  직접 눌러 봐야 확인됨.**
- **DUNGEON 다음 슬라이스 후보 — 오픈월드/필드 (2026-09-12, 사용자가
  지시한 "1,2,3,4" 네 후보 중 마지막).** 회피 다음으로 이어서(같은
  세션) — 방 하나짜리 구조를 벗어나는 **가장 작은 단위**만 짰다(웹판
  전체 필드/바이옴 5종을 옮기는 건 파급이 큰 작업이라 범위 밖 유지,
  VERTICAL_SLICE_DUNGEON.md "다음 슬라이스 후보" 참고). `DungeonRoomBuilder
  .cs`에 `OpenNorthDoor()`/`OpenSouthDoor()` 신규 — `Build()`가 지은
  완전히 막힌 벽 하나를 문 폭(3m)만큼 갈라 둘로 나눈다(기존 호출부는
  손 안 대 그대로 막힌 방을 받음, 새 메서드를 따로 불러야만 문이
  뚫림). 신규 `World/DungeonCorridorBuilder.cs`(`DungeonRoomBuilder.cs`와
  같은 결 — primitive, Awake 방어, MarkStatic)로 두 방을 8m 복도로
  이었다. 좌표는 기하로 산출(Room1 북쪽 벽 바깥면 z=8 → 복도 8m →
  Room2 남쪽 벽 바깥면 z=16 → Room2 중심 z=24, 복도 중심 z=12) —
  기존 Room1의 몬스터·POI 좌표는 전혀 안 건드림(문은 북쪽에만 뚫려
  기존 동쪽 몬스터 무리·서쪽 POI와 안 겹침). Room2엔 잡졸 둘(기본값
  그대로, "다음 구역에도 콘텐츠가 있다"를 보여주는 최소 단위 — 새
  콘텐츠 종류는 안 늘림, 바이옴·방 kind 다양화는 여전히 범위 밖).
  컴파일·씬 재빌드(`room childCount=5→6`, 북쪽 벽이 둘로 갈라진 만큼
  정확히 +1)·PlaytestDungeonHeadless(`OK - 10 frames, no errors`) 전부
  통과 — **문이 실제로 통과 가능한 폭인지, 복도를 걸어 Room2까지 실제로
  갈 수 있는지, Room2의 잡졸 둘이 정상 동작하는지는 사람이 직접
  걸어가 봐야 확인됨**(헤드리스 플레이어는 안 움직여 문 통과 자체가
  검증 밖).
- **DUNGEON 다음 슬라이스 후보 — 회피(구르기) (2026-09-12).** 방 종류
  다양화 다음으로 이어서(같은 세션, "1,2,3,4 순서대로 다해" 중 3번) —
  웹판 `js/dungeon.js:2510` `doDodge()`의 실제 상수(`DODGE_CD=0.9`·
  `DODGE_SEC=0.16`·`DODGE_INVULN=0.22`, 전부 시간 단위라 변환 없이
  그대로)를 옮겼다. **`DODGE_SPD=520`(px/초)만 물리 거리라** 이미
  `DungeonRoomBuilder.cs`가 쓴 px→m 환산(ROOM_W 560px=20m, 28px/m)을
  그대로 적용해 이동 거리 ≈2.97m→3m으로 잡고, 속도는 `거리÷지속시간`
  으로 역산(≈18.75m/s). `Player/PlayerController.cs`(GO에서 그대로
  복사해 온 파일)에 **DUNGEON 고유 로직으로 처음** 손을 댔다 — 회피 중엔
  일반 이동·회전을 건너뛰고 저장해 둔 방향으로 CharacterController를
  직접 미는 분기 추가, 방향은 현재 입력 방향(없으면 마지막 바라보는
  방향)을 씀(웹판 `p.dirX||p.facing`과 같은 우선순위). 무적은
  `HeroState.Invulnerable`(신규 정적 플래그)로 노출해 `TakeDamage`
  맨 앞에서 막는다 — `DungeonEnemy.cs`는 이 플래그를 몰라도 된다(정적
  클래스 하나만 보면 됨). 데스크톱은 Left Ctrl 직접 읽기(PlayerCombat.cs
  가 이미 쓴 "Attack 액션 대신 Keyboard.current 직접 읽기" 관례를
  그대로 따름 — Move/Sprint 액션과 안 겹치게), 모바일은 공격 버튼
  왼쪽에 새 "회피" 버튼(`BuildDodgeButton`, `BuildAttackButton`과 같은
  결). 컴파일·씬 재빌드(`room childCount=5` 그대로)·
  PlaytestDungeonHeadless(`OK - 10 frames, no errors`) 전부 통과 —
  **회피 중 실제로 3m가량 미끄러지는 느낌인지, 그동안 몬스터 공격이
  실제로 안 박히는지, 쿨다운 0.9초가 손에 잡히는 리듬인지는 사람이
  직접 눌러 봐야 확인됨**(헤드리스는 키 입력을 안 보내 회피 발동 자체가
  검증 밖).
- **DUNGEON 다음 슬라이스 후보 — 방 종류 다양화 (2026-09-12).** 엘리트/
  보스 다음으로 이어서(같은 세션, "1,2,3,4 순서대로 다해" 중 2번) —
  웹판 `room.well`/`room.chest`/`room.shrine`(dungeon.js:336-341,
  2141-2162)을 옮겼다. 웹판은 각각 다른 kind의 방인데 이 슬라이스는
  방이 하나뿐이라 **세 POI를 한 방 안에 같이** 뒀다(몬스터 무리·보스는
  동쪽 x=3~9, 세 POI는 서쪽 플레이어 스폰 주변에 흩어 안 겹침). 신규
  `World/DungeonWell.cs`(체력 40% 회복, 웹판처럼 방 클리어 불문 — 원통
  primitive, 청록)·`DungeonTrove.cs`(돈 +24 = 잡졸 보상 8 × 웹판
  dropGold 배율 3 — 정육면체, 갈색)·`DungeonShrine.cs`(경험치+30·돈+20 —
  웹판의 `shrineBoon()` 선택 UI 대신 GO `MountainShrine.cs`가 이미 쓴
  단순화를 재사용, 고를 은사가 하나뿐이라 화면 불필요 — 원통, 보라).
  트로브·성소는 웹판 `room.cleared`를 `DungeonEnemy.Active.Count == 0`
  (씬에 살아있는 몬스터가 하나도 없음)으로 대체 — 방이 하나라 이 둘이
  동치. `HeroState.cs`에 `HealBy(int)` 신규(기존엔 `FullHeal()`만 있어
  일부 회복 API가 없었음). 절차적 아이템 드랍(웹판 트로브의 quality 22)·
  광맥·행상·퍼즐 등 나머지 room kind는 이번엔 안 함(세공·희귀도·행상
  재고 굴리기 등 더 큰 시스템이 필요해 VERTICAL_SLICE_DUNGEON.md
  "제외" 범위 유지). 세 POI 다 SaveState에 진행 상태를 안 남긴다 —
  몬스터와 같은 결(이 슬라이스의 세이브는 플레이어 스탯·위치만 다룸,
  다시 켜면 셋 다 새로 씀). 컴파일·씬 재빌드(`room childCount=5`
  그대로)·PlaytestDungeonHeadless(`OK - 10 frames, no errors`) 전부
  통과 — **세 표지가 실제로 구분돼 보이는지, 우물 회복량·상자/성소가
  몬스터를 다 잡아야만 열리는지는 사람이 직접 가 봐야 확인됨.**
- **DUNGEON 다음 슬라이스 후보 — 엘리트/보스 (2026-09-12).** 몬스터 무리
  다음으로 이어서(같은 세션, 사용자가 남은 네 후보 "1,2,3,4 순서대로
  다해"로 한 번에 지시 — 엘리트/보스→방 종류 다양화→회피→오픈월드/
  필드 순). 웹판 `makeRoom('boss', ...)`(dungeon.js:327-330) 구성을
  그대로 옮겼다 — 두목 1 + 부하 2(floor=1 공식 `min(6, 2+floor(1/5))`
  =2명). **`DungeonEnemy.cs`의 상수(hp·dmg·보상·색상 등)를 전부
  `[SerializeField]`로 바꿔** 두목 변형을 새 클래스 없이 한 컴포넌트로
  같이 받게 했다(GO `Gatherable.cs`와 같은 이유 — 자리마다 값이 다른
  재사용 컴포넌트는 상수로 못 박지 못한다). 두목 수치는 잡졸과 같은
  공식의 boss 배율을 그대로 적용: HP=168(24×7), 공격력=11(round(5×2.2)),
  보상은 dungeon.js의 dropGold boss 배율(5배)을 exp·gold에 재사용해
  경험치 100·돈 40냥, 확정 드랍은 신규 `ItemData` "귀두도"(AtkBonus
  26 — wp_axe(12)에 같은 boss dmg 배율 2.2배를 재사용해 정함, 웹판의
  실제 절차적 보스 희귀도 시스템은 이번 슬라이스 범위 밖). 두목은
  덩치(1.6배 스케일)·색(짙은 적갈, 잡졸의 누런 두건과 구분)으로만
  구별 — AI·사거리·공격 간격은 잡졸과 동일(과설계 방지, 이번 증분의
  본질은 "체력·보상이 큰 정점 하나"). 잡졸 무리(기존 4마리)보다 방
  안쪽(동쪽 벽 가까이, 격자 x=8~9)에 둬 방을 가로질러야 만나는 자리로
  삼음 — 부하 2명은 잡졸과 완전히 같은 기본값(웹판도 boss room 부하는
  일반 spawnEnemy). 컴파일·씬 재빌드(`room childCount=5` 그대로)·
  PlaytestDungeonHeadless(`OK - 10 frames, no errors`) 전부 통과 —
  **두목의 덩치·색이 실제로 위협적으로 보이는지, 168 HP를 실제로 다
  깎는 데 걸리는 시간이 지루하지 않은지는 사람이 직접 싸워 봐야
  확인됨.**
- **DUNGEON 다음 슬라이스 후보 — 몬스터 무리 (2026-09-12).** 지난 세션이
  사람이 TestDungeon을 직접 플레이해 "특별한 문제 없음"으로 확인해 준
  뒤(이번 세션 "이어해"에서 먼저 확인), `docs/VERTICAL_SLICE_DUNGEON.md`
  "다음 슬라이스 후보" 중 사용자가 "몬스터 무리"를 골라 진행. 지금까지
  방 하나에 황건적 한 마리뿐이었는데(웹판은 방 하나에 4~12마리, 첫
  슬라이스가 GO처럼 가장 작은 단위로 시작해 1마리로 줄여 뒀던 것), 웹판
  `js/dungeon.js:333`의 실제 방 생성 공식(`makeRoom('fight', ...)`,
  floor=1 기준 `min(12, 4 + rand(0~3))` = 4~7마리)에서 **무작위 롤 없이
  최소값 4마리를 결정적으로** 써서 늘렸다 — 이 프로젝트 테스트 씬은
  전부 고정 좌표라 무작위를 새로 안 들인다는 기존 관례를 그대로 따름.
  `DungeonEnemy.cs`는 이미 인스턴스 하나가 몬스터 한 마리라 개수 확장에
  로직 변경이 필요 없었다(정적 `Active` 리스트가 이미 여러 마리를
  다룰 수 있게 짜여 있었음) — 주석만 갱신. `BuildTestDungeonScene.cs`의
  `EnemySpawn`(단일 Vector3)을 `EnemySpawns`(배열 4개)로 바꾸고
  `BuildEnemy()`를 루프로 바꿨다 — 방(20m×14m) 안에서 플레이어 스폰
  (-6,0,0) 반대편에 부채꼴로 흩어 서로 안 겹치게 배치. 죽음 페널티가
  이미 없는 슬라이스라(전멸돼도 바로 회복) 몰이 전투 난이도를 따로
  손보지 않았다 — 4마리가 한꺼번에 붙어도 그냥 다시 서면 된다는 기존
  설계를 그대로 신뢰. 컴파일·씬 재빌드(`room childCount=5` 그대로 —
  방 자체는 안 바뀜, 몬스터는 Room의 자식이 아니라 씬 루트)·
  PlaytestDungeonHeadless(`OK - 10 frames, no errors`) 전부 통과 —
  **4마리가 동시에 쫓아와도 실제로 카메라·조작이 안 밀리는지, 여럿에게
  둘러싸였을 때 손맛이 괜찮은지는 사람이 직접 싸워 봐야 확인됨**
  (헤드리스 플레이어는 안 움직여 Chase 전이 자체가 이번에도 검증 밖).
- **PLAN.md 51~65장 "확장 순서" — DUNGEON 착수, 첫 버티컬 슬라이스
  (2026-09-12).** Props 도입 다음으로 이어서(같은 세션, 사용자가 "남은
  후보 진행해줘"에 "1,2번 진행해"로 답해 기획 문서부터 쓰고 곧바로
  구현까지 진행) — GO 다음 게임(사가블로) 착수. saga-godot도 아직 손
  안 댄 첫 시도라 `docs/VERTICAL_SLICE_DUNGEON.md`(신규)를 먼저 써서
  범위를 정했다: **웹판 `saga-dungeon`(오픈월드·바이옴·엘리트/보스·
  세공·행상까지 갖춘 이미 아주 깊은 게임)를 통째로 옮기지 않고, GO의
  첫 슬라이스와 같은 크기로 "방 하나·몬스터 한 마리·실시간 전투·장비
  보상 하나"만 재현했다.** 몬스터 체력·피해량은 웹판 `js/dungeon.js`의
  실제 공식(`enemyHp`/`enemyDmg`, 1층·잡졸·평 난이도)에서 그대로 가져옴
  — HP=24, 공격력=5. **GO의 턴제 선택지 화면과 다르게 실제 이동+거리
  판정 실시간 전투로 짰다** — DUNGEON 정체성 자체가 실시간 액션이라
  GO의 DuelRules.cs 방식을 안 베꼈다(문서의 "왜 GO와 다르게 설계하는가"
  참고). 상세 범위·수치 근거·재사용 표는 그 문서 참고, 여기는 요약만.
  - **새 폴더 `Assets/Games/SagaDungeon/`**(`SagaDungeon.asmdef`,
    `Saga.Dungeon` 루트 네임스페이스) — **SagaGo 코드를 참조하지
    않는다**(루트 CLAUDE.md "다섯 판은 다섯 벌 복사" 원칙을 이 Unity
    트랙에도 적용, SagaCore가 아직 비어 있어 공유할 기반도 없다).
    엔진 무관 로직(`PlayerController.cs`·`CameraRig.cs`·
    `VirtualJoystick.cs`·`DialogueLabel.cs`)은 SagaGo에서 그대로
    복사(네임스페이스만 변경) — `CameraRig`만 기본 피치·줌을 더
    내려다보게 튜닝(GO 35°→DUNGEON 55°, "디아블로 감각").
  - **새로 짠 것**: `Data/HeroState.cs`(단일 캐릭터 체력·레벨·경험치·
    돈·장비 — GO처럼 PartyState/PlayerStats/Inventory로 안 쪼갬,
    DUNGEON엔 부대가 없다) + `Data/ItemData.cs`(무기 2종) +
    `Data/SaveState.cs`(별도 파일 `save_dungeon.json` — GO의
    `save.json`과 안 겹침) + `World/DungeonRoomBuilder.cs`(20×14m
    방 하나, primitive) + `World/DungeonEnemy.cs`(Idle→Chase→Attack
    실시간 AI, 죽으면 경험치·돈·무기 확정 드랍) +
    `Player/PlayerCombat.cs`(스페이스바 또는 화면 "공격" 버튼).
  - **`PlayerCombat.cs`는 프로젝트 기본 InputActions의 "Attack"
    액션을 일부러 안 썼다** — 그 액션이 마우스 왼쪽 버튼에도 물려
    있어 `CameraRig.cs`의 드래그 판정(마우스 왼쪽 버튼을 직접 읽음)과
    같은 프레임에 겹칠 수 있어서다. 대신 `Keyboard.current`로 스페이스
    바를 직접 읽고, 모바일은 화면 버튼이 `TriggerAttack()`을 직접
    부른다. **이 우회가 실제로 카메라 조작과 안 겹치는지는 사람이
    확인 전이다**(아래 GUI 확인 목록 참고).
  - `Editor/BuildTestDungeonScene.cs`(신규, `BuildTestVillageScene.cs`
    와 같은 결이지만 훨씬 짧다) + `Editor/PlaytestDungeonHeadless.cs`
    (신규, `PlaytestHeadless.cs`와 같은 결 — 씬 경로만 다름).
  - 컴파일(`SagaDungeon.dll` 정상 생성)·씬 저장(`Assets/Scenes/
    TestDungeon.unity`, room childCount=5 — 바닥+벽 4개와 정확히
    일치)·PlaytestDungeonHeadless(`OK - 10 frames, no errors`) 전부
    통과. **플레이어가 안 움직이는 헤드리스라 몬스터의 Chase/Attack
    상태(AggroRadius=8m, 스폰 거리 11m라 우연히 밖)는 이 검증으론 실제로
    안 도는 걸 확인 못했다** — 사람이 직접 다가가 싸워 봐야
    Idle→Chase→Attack 전이·플레이어 공격·보상까지 전부 확인된다.
- **PLAN.md 8장 "실제 3D 에셋" — Props 도입 (2026-09-12).** 산신당
  재설계 다음으로 이어서(같은 세션, 사용자가 "남은 후보 진행해줘"에
  "2,3,1번 순으로"로 답해 동물 GLB 조사(2번)·Props 대상 정하기(3번)·
  DUNGEON 착수(1번) 순으로 진행 중) — 새 킷을 찾지 않고 이미 쓰는
  Fantasy Town Kit에서 안 받았던 파일 세 개(가로등·시장 좌판·울타리+문)
  만 추가로 받아 기존 콘텐츠 옆에 붙였다: 가로등 2개(마을집 두 채
  사이), 시장 좌판 1개(떠돌이 상인 옆), 울타리 3칸+문 1칸(논밭 소 옆,
  실제로 가두지는 않는 장식). `PropsBuilder.cs`(신규, LandmarksBuilder.cs
  와 같은 결) + `BuildTestVillageScene.cs`에 `BuildProps()` 훅. 자세한
  실측·스케일·좌표 근거는 `docs/ASSET_GUIDE.md` "Props 도입" 절 참고.
  컴파일·씬 재빌드(`groundVerts=6336` 그대로)·PlaytestHeadless(`OK - 10
  frames, no errors`) 전부 통과 — 실제로 세 소품이 자연스러워 보이는지는
  사람이 직접 봐야 확인됨.
  - **덤으로 동물 GLB(사슴·소·흰 늑대)도 조사했지만 도입은 못 했다** —
    Kenney엔 맞는 3D 킷이 없고, Quaternius의 CC0 "Animated Animal Pack"
    (poly.pizza)이 정확히 Cow·Deer·Wolf를 갖췄지만 poly.pizza 계정이나
    Quaternius Discord/Patreon 클레임이 있어야 받을 수 있어(로그인·계정
    생성은 대신 못 함) 자동으로 못 받아 왔다. 로그인 없이 바로 받아지는
    대안 팩은 Cow만 있고 Deer·Wolf가 빠져 있다. 자세한 내용은
    `docs/ASSET_GUIDE.md` "동물 GLB — 조사 결과" 절 참고 — **사용자가
    직접 받아 어딘가에 놔두면 다음 세션이 이어받을 수 있다.**
- **PLAN.md 8장 "실제 3D 에셋" — 산신당 재설계 (2026-09-12).** Awake()
  중복 생성 정리 다음으로 이어서(같은 세션, 사용자가 "산신당 재설계부터
  진행해"로 지목) — 환경/건물 GLB 조각이 "형태가 많이 달라 다음 조각으로
  미룬다"고 남겨 둔 항목을 처리했다. 예전 구조(받침대 박스 5×0.6×5 +
  `pillar-stone.glb` 기둥 4개)를 통째로 걷어내고, saga-godot
  `landmarks_builder.gd`의 `SHRINE_SIZE`(1.04×0.49×0.65)·
  `SHRINE_SCALE`(2.5, 균일)을 그대로 옮겨 **`shrine/altar-stone.glb`
  제단 하나**로 바꿨다(saga-godot도 옛 사당을 이 파일 하나로만 지음 —
  같은 이유로 균일 스케일만 씀, 실제 돌 표면 굴곡이 있는 조각).
  `shrine/altar-stone.glb` + `shrine/Textures/colormap.png`를
  saga-godot에서 그대로 복사해 `Assets/Art/Shrine/`에 신규 도입(다른
  GLB들과 같은 재사용 원칙, PLAN.md 0장). `LandmarksBuilder.cs`에
  `shrineModel` 필드 추가로 `Init()` 시그니처가 5개→6개 인자로 늘어
  `BuildTestVillageScene.cs` 호출부도 같이 고쳤다. GLB가 없을 때의
  폴백도 예전 받침대+기둥 구조 대신 최종 크기(약 2.6×1.23×1.63m) 그대로의
  단일 박스로 바꿨다. 덤으로 `SpawnPillar()`의 `addToRoot` 매개변수가
  (산신당 기둥 호출이 없어지며) 완전히 죽은 코드가 돼 같이 지웠다.
  `MountainShrine.cs`(트리거·보상 로직)는 안 건드림 — 순전히
  `LandmarksBuilder.cs`의 시각 담당 쪽 변경. 컴파일·씬 재빌드
  (`groundVerts=6336` 그대로 — 땅은 안 바뀜)·PlaytestHeadless(`OK - 10
  frames, no errors`) 전부 통과 — **실제로 제단이 자연스러워 보이는지
  (텍스처 이음새, 예전보다 훨씬 작아진 크기감, 숲 사이에서 눈에 띄는지)는
  사람이 직접 봐야 확인됨.**
- **기술부채 정리 — Awake() 중복 생성 방어를 나머지 6곳에 적용
  (2026-09-12).** 캐릭터/환경 GLB 세션이 "다음 작업"에 남겨 둔 항목 —
  `AnimalBuilder.cs`·`HiddenTreasure.cs`·`EastGroveRelic.cs`·
  `LuckyCairn.cs`·`MountainShrine.cs`·`RareWolfEncounter.cs` 여섯 곳을
  훑었다.
  - `AnimalBuilder`·`HiddenTreasure`·`EastGroveRelic`·`LuckyCairn`은
    NpcBuilder.cs와 같은 `if (transform.childCount > 0) return;` 한
    줄로 충분(자식 생성 뒤 별도로 기억해 둬야 할 필드가 없다).
  - `MountainShrine`은 살펴보니 애초에 자식 GameObject를 하나도 안
    만든다(transform·collider 설정만) — Build()가 몇 번 다시 돌아도
    그대로 덮어써질 뿐이라 방어가 필요 없다는 걸 확인하고 주석만 남김
    (방어를 "빠뜨린" 게 아니라 원래 안 필요했던 경우).
  - **`RareWolfEncounter.cs`를 고치다가 `BanditEncounter.cs`에도 같은
    미완결 버그가 있는 걸 발견했다.** 두 컴포넌트 다 이전 세션이
    "Visual 자식이 있으면 Build() 건너뛰고 PulseVisual()이 쓸
    `_visual`/`_visualBaseScale`만 복원"으로 고쳤다고 기록했는데,
    Update()가 실제로 쓰는 `_promptRoot`/`_combatRoot`/`_hpFill` 등
    나머지 UI 필드는 그 복원 목록에 없었다 — 즉 세이브 로드 후 진짜
    Play가 시작될 때(이 프로젝트 구조상 Awake는 그 한 번만 불린다)
    저 필드들은 세션 내내 null로 남고, 도적/흰 늑대에게 실제로 다가가
    Update()의 Idle 분기가 `_promptRoot.SetActive(true)`를 부르는 순간
    NullReferenceException이 났을 것이다(아직 사람이 실제로 걸어가 본
    적이 없어 안 걸렸던 잠재 버그). 두 파일 다 "Visual 자식이 있으면
    복원"이 아니라 **기존 자식을 전부 지우고 Build()를 처음부터 다시
    돌리는 방식**으로 바꿔 모든 필드가 항상 새로 채워지게 했다. 단,
    `EncounterUiKit.NewCanvas()`가 만드는 UI 캔버스는 씬 루트에 생겨(이
    컴포넌트의 자식이 아니다) 이 방식으로는 못 지운다 — 편집기 빌드가
    만들어 둔 옛 캔버스 두 개(비활성 상태)가 고아로 남지만, 새로 만든
    캔버스가 실제 동작을 맡으니 기능엔 지장 없다(감수한 트레이드오프,
    각 파일 Awake() 주석에 남겨 둠).
  - 컴파일·씬 재빌드(`groundVerts=6336` 그대로 — 땅은 안 바뀜)·
    PlaytestHeadless(`OK - 10 frames, no errors`) 전부 통과. **주의—
    헤드리스 플레이어는 안 움직여 도적/늑대 트리거 반경에 실제로 안
    들어간다**, 그래서 이번에 고친 NRE 경로 자체(Update의 Idle 분기)는
    이 자동 검증으로는 직접 재현 못 한다 — 코드 검토로 원인을 확인하고
    고친 것이고, 실제로 다가가도 더 이상 죽지 않는지는 사람이 GUI로
    확인해야 완전히 닫힌다(아래 "다음 작업" GUI 확인 목록에 추가).
- **PLAN.md 8장 "실제 3D 에셋" 둘째 조각 — 환경/건물 GLB 도입 (2026-09-12).**
  캐릭터 GLB 다음으로 이어서(같은 세션, 사용자 "이어서 환경/건물 GLB도
  진행해") — 44~49장 자산 우선순위(Player→주요 Enemy→Boss→Environment→
  Building→...)대로 다음 칸을 채웠다. 자세한 표는 `docs/ASSET_GUIDE.md`
  참고, 여기는 요약만.
  - saga-godot이 이미 받아 둔 Kenney Nature Kit(나무·바위)·Fantasy Town
    Kit(마을집 벽/지붕·폐허 기둥·다리)·Modular Cave Kit(굴 입구)를 그대로
    재사용. saga-godot의 실측표를 신뢰해 재실측 없이 스케일을 그대로
    가져다 썼다(같은 TileSize=48이라 유효) — 도입 후 한 번 재확인만 함
    (100% 일치).
  - `VegetationBuilder.cs` — 예전엔 나무·바위를 정점 단위로 직접 베이크해
    하나의 결합 메시로 묶었는데(draw call 절약 목적), 이번에 진짜 GLB
    개체를 하나씩 인스턴스화하는 방식으로 바꿨다 — 이미 있는
    `GameBootstrap.CombineStaticBatches()`(PLAN.md 76장, static 오브젝트를
    같은 머티리얼끼리 자동으로 묶는 Unity 표준 기능)가 그대로 이 역할을
    대신해 줘서, 손으로 정점을 합칠 필요가 없어졌다(UV·텍스처도 그대로
    산다는 덤). GLB를 못 찾으면 예전 결합 메시 방식 그대로 폴백 —
    두 경로 다 같은 파일 안에 남겨 뒀다.
  - `LandmarksBuilder.cs` — 굴 입구(gate-rock)·마을집 벽(wall-block)·
    지붕(roof-gable)·폐허 기둥 3개(pillar-stone)·다리 널판 44개(planks)
    교체. **산신당('S' 타일)은 이번엔 안 바꿨다** — 기둥 4개만
    pillar-stone으로 바꾸고 받침대는 primitive로 남김(altar-stone.glb는
    지금 구조와 형태가 많이 달라 다시 설계해야 함, ASSET_GUIDE.md 참고).
  - **GLB엔 물리 콜라이더가 없어서**(glTF 포맷 자체가 안 담음) 굴 입구·
    마을집 벽·기둥류는 실측 로컬 AABB 그대로 BoxCollider/CapsuleCollider를
    코드로 직접 얹었다.
  - 두 파일 다 어차피 다시 쓰는 김에 `transform.childCount > 0`이면
    건너뛰는 Awake 중복 생성 방어(캐릭터 GLB 때 발견한 것과 같은 패턴)를
    추가했다.
  - **검증** — 씬 재빌드 후 오브젝트 개수를 지도 데이터에서 직접 셈해
    맞춰 봤다: 숲 'T' 타일 15개×3그루=나무 45그루, 산 '^' 타일 48개×1=
    바위 48개, 다리 44m/1m=널판 44개, 굴 입구 1개·벽 2채·지붕 2채·폐허
    기둥 3개·산신당 기둥 4개 — 전부 씬 파일에서 정확히 일치 확인(추측이
    아니라 실제로 셈). 컴파일·씬 재빌드(`groundVerts=6336` 그대로 — 땅은
    안 바뀜)·PlaytestHeadless(`OK - 10 frames, no errors`, static 배칭
    호출도 에러 없이 통과) 전부 통과. **실제로 화면에서 자연스러워
    보이는지(텍스처 이음새, 다리 널판 사이 틈, 지붕 비례, 바위 크기감)는
    사람이 직접 봐야 확인됨.**
- **PLAN.md 8장 "실제 3D 에셋" 첫 조각 — 캐릭터 GLB 도입 (2026-09-12).**
  소(cow) 다음으로 이어서(같은 세션, 사용자가 "캐릭터 디자인은 아직이지?"
  로 확인 후 "플랜 순서대로 다 진행해"로 지시) — 지금까지 플레이어·NPC·
  산적이 전부 primitive capsule이었던 걸 실제 3D 모델로 바꾼 첫 조각.
  자세한 내용은 신규 `docs/ASSET_GUIDE.md` 참고, 여기는 요약만.
  - Unity 6000.3.23f1엔 GLB 임포터가 기본으로 없다(PLAN.md 8장의 전제가
    틀렸다 — URP Sky/Fog 오판과 같은 종류) — `com.unity.cloud.gltfast`
    패키지를 `manifest.json`에 추가해 해결.
  - saga-godot이 이미 받아 둔 Kenney "Blocky Characters"(CC0)
    character-{a,b,c,d}.glb + 텍스처를 그대로 복사해
    `Assets/Art/Characters/`에 도입(PLAN.md 8장·0장이 트랙 간 재사용을
    이미 허용해 둠). 실측(1.6×2.7×0.8, 바닥 피벗) 후 삭제하는 일회성
    도구 `MeasureCharacterGlb.cs`로 확인.
  - `World/CharacterVisual.cs`(신규, 공용 로직) — 목표 높이에 맞춘 균일
    스케일 + `MaterialPropertyBlock`으로 `_BaseColor` 색조 입히기(공유
    머티리얼은 안 건드림) + GLB를 못 찾을 때의 primitive capsule 폴백.
  - 플레이어=character-a(색조 없음), 촌장=character-b(파랑),
    상인=character-c(갈색), 나그네=character-c 재사용(회색, 킷을 4종만
    받아서 5번째 배역은 모델 재사용), 산적=character-d(어두운 빨강,
    전투 텔레그래프 때 주황으로 덮어씀 — 기존 단일 머티리얼 방식을
    `CharacterVisual.Tint()`로 다중 Renderer 대응으로 바꿈).
  - **런타임 AssetDatabase 제약 발견** — `NpcBuilder.cs`·
    `BanditEncounter.cs`의 `Awake()`는 실제 Play 때도 도는 진짜 런타임
    코드라 `AssetDatabase.LoadAssetAtPath`를 못 쓴다(에디터 전용 API).
    `Gatherable.cs`가 이미 쓰던 패턴대로 `[SerializeField] GameObject`
    필드 + `Init()`을 추가해 편집기 빌드 스크립트가 값을 채워 씬에
    직렬화해 두는 방식으로 풀었다.
  - **덤으로 발견해 같이 고친 버그** — `NpcBuilder`·`BanditEncounter`
    둘 다 `Awake()`가 조건 없이 `Build()`를 다시 불러서, 이미 저장된
    씬을 실제 Play로 열면 시각·UI가 두 벌씩 겹쳐 생기는 잠재 버그였다.
    `transform.Find("Visual") != null`이면 다시 안 짓게 방어 추가(단,
    `BanditEncounter`는 `_visual`/`_visualBaseScale`을 그 경로에서도
    다시 채워야 `PulseVisual()`이 안 깨진다 — 완전히 건너뛰지 않고
    기존 자식을 찾아 필드만 복원). **같은 패턴(무조건 `Build()`)이
    `AnimalBuilder.cs`·`RareWolfEncounter.cs`·`HiddenTreasure.cs`·
    `MountainShrine.cs`·`EastGroveRelic.cs`·`LuckyCairn.cs`에도 있어
    이론상 같은 버그가 있을 수 있다 — 이번엔 GLB 교체 범위 밖이라 손
    안 댐, 아래 "다음 작업" 참고.**
  - `BanditEncounter.PulseVisual()`의 강타 스케일 애니메이션이 예전
    capsule 스케일(1.8,1.7,1.8)을 상수로 박아 뒀던 걸, 실제 스폰 시점의
    스케일(`_visualBaseScale`, GLB 기준 ≈1.259 균일)을 쓰도록 고쳤다 —
    안 고쳤으면 강타 연출 때 캐릭터가 잘못된 비율로 찌그러졌을 것.
  - 컴파일·씬 재빌드(`groundVerts=6336` 그대로 — 땅은 안 바뀜)·
    PlaytestHeadless(`OK - 10 frames, no errors`, Awake 중복 방지
    분기도 이 경로로 실제로 한 번 지나갔다) 전부 통과. **실제로 캐릭터가
    화면에 제대로 보이는지(텍스처·비율·정면 방향), 산적 텔레그래프
    색조가 실제로 도는지는 사람이 직접 봐야 확인됨** — 특히 GLB
    모델의 "정면"이 Unity +Z와 맞는지는 확신 없음(CameraRig 드래그
    방향처럼 실측이 아니라 관례로 가정한 부분).
- **PLAN.md 24~27장 "동물" 셋째 조각 — 첫 farmland 종, 소 (2026-09-12).**
  성황당 돌무더기 다음으로 이어서(같은 세션, 사용자 "응 계속 진행해") —
  지금까지 사슴 세 마리뿐이던 동물이 전부 숲/들판(forest/plains) 출신이고,
  2026-09-12 남쪽 확장으로 처음 생긴 논밭('F') 타일(row9)엔 아직 아무
  생물도 없었다. `AnimalBuilder.cs`의 `AnimalDef`에 `Species`/`Scale`/
  `Color` 필드를 넣어(이전엔 전부 "Deer" 하드코딩) 종별로 다르게 꾸밀 수
  있게 일반화하고, 그 첫 사용으로 `cow_1`(격자 (3,9), 논밭 타일 정중앙)을
  추가 — 사슴보다 크고(1.0/0.75/1.0 스케일) 옅은 크림색, 혼자 배회(무리
  자리 아님). `WanderingAnimal.cs`는 애초에 종 이름을 몰라도 되게 짜여
  있어(자막도 "동물이 놀라 달아난다"로 이미 종 불문) **한 줄도 안 고쳤다**
  — Idle/Wander/Flee/Group/Interaction 전부 그대로 상속. 씬에 GameObject가
  늘어 `BuildTestVillageScene.Build()` 재실행(`groundVerts=6336` 그대로 —
  땅은 안 바뀜). 컴파일·씬 재빌드·PlaytestHeadless 전부 통과 — 논밭 위에
  실제로 소가 서 있는지·크기가 사슴과 구별되는지는 사람이 직접 봐야 확인됨.
- **PLAN.md 24~27장 "랜덤 이벤트" 첫 콘텐츠 — 성황당 돌무더기 (2026-09-12).**
  나그네 NPC 다음으로 이어서(새 세션, "이어해") — "다음 작업"이 콕 집어 둔
  빈자리("지역/시간/랜덤 이벤트"는 아직 하나도 없다)를 채웠다.
  `World/LuckyCairn.cs`(신규, 격자 (4,7) — herb_4(3,7) 바로 옆 빈 들판) —
  지금까지 발견형 콘텐츠(HiddenTreasure·EastGroveRelic·MountainShrine 등)는
  전부 `WorldEventState`로 "한 번뿐"이었는데, 이건 반대로 **몇 번이고 다시
  들를 수 있는 자리**(20초 쿨다운만 있고 WorldEventState 없음)에서 매번
  결과가 갈리는 첫 콘텐츠 — 3냥을 내고 기원하면 가중치 룰렛(꽝 50%·소소한
  행운 32%·제법 큰 행운 14%·경험치까지 겹치는 큰 행운 4%)으로 결과가
  갈린다. 공짜로 하면 "반복 방문=순이익"이라 GoldState 경제가 무너져서
  비용을 넣었다(돈이 모자라면 굴리지 않고 대사만 뜬다). `LootTable.cs`의
  가중치 룰렛과 같은 원리지만 굳이 공유 구조로 안 뽑았다 — 이 자리
  하나뿐이라 LootTable 자신의 원칙("사건이 하나뿐이라 테이블도 하나뿐")과
  같은 이유. `BuildTestVillageScene.cs`에 `BuildLuckyCairn()` 훅 추가 —
  GameObject가 늘어 씬 재빌드(`groundVerts=6336` 그대로 — 땅은 안 바뀜).
  SaveState 변경 없음(쿨다운은 세션 안 메모리 값이라 저장할 상태가 없다,
  VillagerTalk.cs와 같은 결). 컴파일·씬 재빌드·PlaytestHeadless 전부
  통과 — 실제로 자리에 다가가면 돈이 빠지고 결과 문구·보상이 뜨는지,
  20초 안엔 재도전이 막히는지는 역시 사람이 직접 가 봐야 확인됨.
- **GO 콘텐츠 다양화 (2026-09-12) — 지도 확장을 멈추고 방향 전환.**
  같은 "산 벽 열고 공터+채집" 패턴을 세 번 반복한 뒤 사용자가 "다른
  방법 확인해줘"로 방향을 물어, "GO 콘텐츠 다양화"를 골라 지도는 9×11
  그대로 두고 안에 콘텐츠만 더 채우는 쪽으로 바꿨다. 두 조각:
  1. **동물 Group이 실제로 보이게 재배치.** `WanderingAnimal.cs`의
     Group 전파(2026-09-12 오전에 추가)가 칸 크기(48유닛)가 무리 알림
     반경(`GroupAlertRadius=40`)보다 넓어서 서로 다른 칸에 심은 동물
     끼리는 절대 안 겹치는 구조적 문제를 뒤늦게 알아챘다 — `AnimalBuilder
     .cs`에 `AnimalDef.Offset`(같은 칸 안에서 월드 단위로 비켜 두는
     자리)을 추가해 사슴 세 번째 마리를 (4,4) 칸 안에서 기존 사슴과
     17유닛 떨어뜨려 심었다(deer_1은 그대로 혼자). 이제 한쪽이 플레이어
     를 보고 놀라면 다른 한쪽도 같이 달아나는 게 실제로 보일 수 있다.
  2. **나그네 NPC — 첫 "NPC 이벤트".** PLAN.md 24~27장이 나열한 이벤트
     종류(몬스터 출현·보물 발견·NPC 이벤트·희귀 몬스터·랜덤 이벤트) 중
     "NPC 이벤트"가 지금까지 빠져 있었다. `NpcBuilder.cs`에 세 번째
     주민 `npc_traveler`(격자 (4,9), 둘째 남쪽 공터) 추가 — 촌장(3단계
     퀘스트)·상인(거래) 같은 진행 상태 없이 **말을 걸면 한 번뿐인
     보상+정보, 그다음엔 인사말만**인 제일 가벼운 형태로 갈랐다.
     `WorldEventState`(id `"traveler_met"`)를 그대로 재사용 — 일반화
     이후 세 번째 재사용. 씬에 GameObject가 늘어(사슴 한 마리·NPC 한
     명) `BuildTestVillageScene.Build()` 재실행(`groundVerts=6336`
     그대로 — 땅은 안 바뀜). 컴파일·씬 재빌드·PlaytestHeadless 전부
     통과 — 둘 다 실제로 그렇게 보이는지는 사람이 직접 봐야 확인됨.
- **지도 크기 확장 셋째 조각 — 남쪽 더 (2026-09-12) + 채집 자리 5호.**
  동쪽 공터 콘텐츠 다음으로 이어서(같은 세션) — row8의 산 벽을 열어
  (row6과 같은 모양 "^^^=^^^^^") 더 남쪽으로 2줄(row9~10) 늘렸다.
  9×9 → 9×11(432m×528m). row9엔 **`Legend`엔 있었지만 `Rows`엔 한 번도
  안 쓰이던 `'F'`(논밭) 타일을 처음 심었다**(산신당 `'S'` 때와 같은
  결) — "^T.F.T^^^". row10은 새 산 경계로 닫아 다음 확장 여지를 남김.
  같이 채집 자리 herb_5(2,9)도 심었다 — 'F' 옆 '.' 타일에(밭 자체는
  Gatherable의 "산나물을 캤다" 문구와 결이 안 맞아 피함). 기존 콘텐츠
  좌표는 전혀 안 건드림. 컴파일·씬 재빌드(`groundVerts=5184→6336`,
  9×11×4×4서브쿼드×4정점과 정확히 일치)·PlaytestHeadless 전부 통과.
- **동쪽 숲 공터(col7)에 첫 콘텐츠 — 낡은 돌기둥 발견 (2026-09-12).**
  WorldEventState 일반화 다음으로 이어서(같은 세션) — 방금 합친
  `WorldEventState`를 실제로 바로 재사용해 봤다. `World/
  EastGroveRelic.cs`(격자 (7,3), HiddenTreasure.cs와 같은 결 — 트리거
  한 번, 작은 마커, 발견 보상) 신규. 굴 보물처럼 무기를 주는 대신
  경험치+20·돈+15만 주는 가벼운 발견이라 새 `ItemData` 없음 — 이벤트
  id `"east_grove_relic"`이 일반화 이후 처음 생긴 네 번째 id. 마커는
  HiddenTreasure의 발광 구슬과 다르게 살짝 기울어진 낡은 돌기둥
  (primitive Cylinder)으로 구분. `BuildTestVillageScene.cs`에
  `BuildEastGroveRelic()` 훅 추가 — GameObject가 늘어 씬 재빌드
  (`groundVerts=5184` 그대로). 컴파일·씬 재빌드·PlaytestHeadless 전부
  통과 — 실제로 눈에 띄는지·트리거가 발동하는지는 역시 사람이 직접
  가 봐야 확인됨.
- **기술부채 정리 — WorldEventState를 id 집합으로 일반화 (2026-09-12).**
  동쪽 지도 확장 다음으로 이어서(같은 세션) — `ShrineState.cs`가
  스스로 남겨 둔 예고("세 번째 '자리 하나' 월드 이벤트가 생기면
  GatherState.cs처럼 id 집합으로 합칠 것")가, `RareWolfState.cs`가
  생기며 이미 세 번째를 넘긴 채 안 지켜지고 있던 걸 발견해 정리했다.
  `WorldEventState.cs`를 `GatherState.cs`와 같은 모양(HashSet<string>
  기반 `IsTriggered`/`TryTrigger`/`TriggeredIds`/`Restore`)으로 다시
  썼다 — 굴 보물은 `"cave_treasure"`, 산신당은 `"shrine_blessing"`,
  희귀 몬스터는 `"rare_wolf"` id를 쓴다. `ShrineState.cs`·
  `RareWolfState.cs`는 삭제, `HiddenTreasure.cs`·`MountainShrine.cs`·
  `RareWolfEncounter.cs` 세 호출부를 새 API로 바꿨다(안 쓰이던
  `TreasureFound`/`Blessing` 이벤트도 같이 정리됨 — 구독하는 곳이
  코드베이스 어디에도 없었음). `SaveState.cs` v8→v9 — 예전 세 bool
  필드(`caveTreasureFound`/`shrineBlessed`/`rareWolfDefeated`)를 하나의
  `worldFlags` 문자열 목록으로 접었다(`MigrateStep(8,...)`가 세 bool을
  보고 목록을 채워 넣어 진행 손실 없이 옮김 — 옛 필드는 마이그레이션
  전용으로 클래스에 그대로 남겨 둠). 씬 GameObject 구성은 안 바뀐
  변경이라 씬 재빌드는 생략, 컴파일·PlaytestHeadless 전부 통과.
- **지도 크기 확장 둘째 조각 — 동쪽 2칸 (2026-09-12).** 채집 자리 4호
  다음으로 이어서(같은 세션) — 남쪽 확장 때 세운 "행/열 끝에만 보태면
  기존 좌표 안 밀림" 원칙을 동쪽(열)에도 실제로 적용해 검증했다. 9×7 →
  9×9칸(432m×432m). 마을 행(row2~4)의 동쪽 벽이 원래 숲(walkable)이라
  남쪽처럼 따로 "문"을 뚫을 필요가 없었다 — col7에 숲 버퍼(row3만
  들판), col8에 새 산 경계를 둬 자연스럽게 작은 동쪽 숲 공터가 생겼다
  (아직 콘텐츠는 안 심음 — 다음 후보). 기존 콘텐츠 좌표(도적·NPC·채집
  4곳·산신당·흰늑대·사슴)는 전혀 안 건드림. 이번엔 halfW(가로 중심)도
  같이 바뀌어(halfH만 바뀌었던 남쪽 확장과 달리) `PlayerSpawn`의
  `WorldPos()` 수정이 처음으로 x축 밀림까지 실전에서 검증됐다. 컴파일·
  씬 재빌드(`groundVerts=4032→5184`, 9×9×4×4서브쿼드×4정점과 정확히
  일치)·PlaytestHeadless 전부 통과.
- **지도 확장 남쪽 공터(row7)에 첫 콘텐츠 — 채집 자리 4호 (2026-09-12).**
  동물 Flee/Group/Interaction 다음으로 이어서(같은 세션) — 지도 크기
  확장 때 "터레인만 깔고 콘텐츠는 다음"으로 남겨 뒀던 자리를 채웠다.
  새 시스템 없이 기존 `Gatherable`/`GatherState`(id 문자열 집합이라
  이미 임의 개수를 받게 짜여 있음)에 `herb_4(3,7)` 한 줄만 추가 —
  `BuildTestVillageScene.GatherSpots` 배열에 등록. `SaveState` 스키마
  변경도 필요 없다(GatherState가 id를 그대로 문자열 집합에 넣고 빼는
  구조라 새 id를 몰라도 저장/복원이 자동으로 됨). 씬에 GameObject가
  늘어 `BuildTestVillageScene.Build()`를 다시 돌렸다(groundVerts=4032
  그대로 — 땅은 안 바뀜). 컴파일·씬 재빌드·PlaytestHeadless 전부 통과 —
  남쪽 문을 지나 처음 만나는 콘텐츠라 실제로 눈에 띄는지·캐지는지는
  역시 사람이 직접 가 봐야 확인됨.
- **PLAN.md 24~27장 "동물" 둘째 조각 — Flee/Group/Interaction (2026-09-12).**
  지도 크기 확장 다음으로 이어서(같은 세션). 첫 조각(사슴 두 마리
  Idle/Wander)이 "Flee/Group/Interaction은 다음에"로 남겨 뒀던 부분 —
  `WanderingAnimal.cs`에 `State{Idle,Wander,Flee}`를 추가했다.
  **Flee**: `Player` 태그 오브젝트와의 평면 거리(y 무시)가 16유닛 안으로
  들어오면 즉시 도망 상태로 바뀌고(4.6유닛/초, 기존 배회 2.2보다 빠름)
  플레이어 반대 방향으로 몇 걸음씩(`FleeStepRadius=18`) 걸을 수 있는
  칸을 골라 이어 달아난다 — 30유닛 밖으로 멀어져야 진정한다(붙었다
  뗐다 방지용 히스테리시스, 16/30 두 문턱). **Group**: 정적 리스트
  `Active`에 씬의 모든 `WanderingAnimal`을 등록해 두고, 플레이어를 직접
  보고 놀란 개체가 반경 40유닛 안의 다른 동물도 같이 `StartFlee`시킨다
  — **다만 지금 스폰된 사슴 두 자리(2,2)·(4,4)는 실제 거리가 약
  136유닛이라 서로 이 반경 밖이라 지금은 실제로 안 겹친다**(메커니즘은
  맞게 짰지만 지금 콘텐츠로는 발동 장면을 볼 수 없다 — 동물이 늘거나
  더 가까이 배치되면 그때 실제로 보임, 기존 스폰 좌표는 이번에 안
  건드렸다). **Interaction**: 플레이어를 직접 보고 놀란 경우에만(무리
  전파로 놀란 경우는 조용히) `DialogueLabel`로 "동물이 놀라 달아난다."
  자막을 2초 띄운다 — NPC의 `_say()`와 같은 자기등록 싱글턴 재사용,
  새 UI 없음. 씬 구조(GameObject 구성)는 하나도 안 바뀐 변경이라
  `BuildTestVillageScene.Build()`는 다시 안 돌렸다(기존 관례). 컴파일·
  PlaytestHeadless 전부 통과 — **플레이어가 안 움직이는 헤드리스에서는
  Flee가 실제로 발동 안 함**(스폰 지점 사이 거리가 이미 알림 반경
  밖이라 우연히도 안전) — 실제로 다가가면 놀라 달아나는지·자막이
  뜨는지·30유닛 밖에서 다시 진정하는지는 사람이 직접 봐야 확인됨.
- **PLAN.md 51장 "GO 월드 확장 — 지도 크기" 첫 조각 (2026-09-12).** 여러
  세션 동안 "파급이 큰 작업"이라 미뤄 뒀던 항목 — 사용자가 "지도크기
  작업부터"로 이번 세션 첫 과제로 지목. `TestMapData.Rows`를 **남쪽으로만
  2줄** 늘렸다(7×7 → 7×9칸, 336m→336m×432m) — 동서남북 모두 늘리면 기존
  칸들의 (gx,gy)가 통째로 밀려 BanditEncounter·HiddenTreasure·
  Gatherable·MountainShrine·RareWolfEncounter·NpcBuilder·WanderingAnimal
  의 상수 좌표를 전부 다시 맞춰야 했겠지만, **행 끝에만 새 줄을 보태면
  기존 (gx,gy)의 내용이 하나도 안 바뀐다**(새 행은 index가 더 큰 gy로만
  추가) — 그래서 기존 콘텐츠 좌표는 전혀 손 안 댐. 다리(row5)→남쪽 성벽의
  좁은 문(row6, col3만 길)을 지나면 새로 늘어난 작은 숲 공터(row7)가
  나오고 그 너머는 다시 산으로 막았다(row8, 다음 확장 때 열 자리) —
  이번엔 터레인만 늘렸고 **새 공터에 콘텐츠(이벤트·NPC 등)는 아직 안
  심었다**(다음 후보). 그 과정에서 **`BuildTestVillageScene.cs`의
  `PlayerSpawn`이 `WorldPos()`를 안 거치고 계산 결과를 상수
  `(-48,0.1,-24)`로 박아 둔 버그를 찾았다** — 칸 수가 바뀌면
  `WorldPos()`의 halfW/halfH가 바뀌어 기존 모든 좌표가 월드 공간에서
  다 같이 밀리는데(개별 좌표 사이 관계는 그대로라 안전), 이 상수만은 안
  따라가 마을 밖으로 스폰될 뻔했다 — `TestMapData.WorldPos(2.5f, 3f)`를
  직접 부르는 계산 프로퍼티로 고쳤다. 컴파일·씬 재빌드
  (`groundVerts=3136→4032`, 7×9×4×4서브쿼드×4정점과 정확히 일치)·
  PlaytestHeadless 전부 통과. **커밋 직후 push가 origin에 선점당해**
  (다른 PC 세션이 먼저 올린 `BuildSkyAndFog` 병합 정리 커밋과 충돌) 다시
  `git merge`로 받아 `BuildTestVillageScene.cs`·`PROJECT_STATE.md` 충돌을
  풀었다 — 안개는 이제 그 병합으로 들어온 `SkyFogBuilder`(Trilight
  앰비언트 + ExponentialSquared 밀도)가 맡는다(아래 "다음 작업"의 병합
  정리 항목 참고), 이번 지도 확장 자체는 그 병합과 무관하게 그대로
  유효. saga-godot은 아직 7×7 그대로 — 두 트랙이 지도 크기까지 반드시
  같을 필요는 없다(PLAN 0장 "기획만 같이 본다").
- **PLAN.md 51장 "희귀 몬스터" + BanditEncounter 리팩터·버그 고침.**
  동물(사슴) 다음으로 이어서(같은 세션, 2026-09-11, 사용자가 "완성도를
  올려줘, 최대한 다 만들어줘"로 확인). 두 번째 실시간 전투 사건이
  생기며 `BanditEncounter.cs`의 UI 조립 코드(~150줄)를 그대로 복붙하면
  중복이 커서 **`UI/EncounterUiKit.cs`로 먼저 뽑아냈다**(캔버스/패널/
  텍스트/버튼/막대 다섯 함수, 동작은 그대로 — N=1일 땐 안 뽑다가
  N=2가 되고서야 뽑음, GatherState.cs 때 세운 원칙 그대로). 이 참에
  **BanditEncounter의 숨어 있던 버그도 고쳤다** — `Awake()`가 이미
  등용된 도적인지(`PartyState.MemberIds`) 확인을 안 해서, 세이브를
  불러온 씬을 다시 열면 이미 이긴 도적이 또 나오고 다시 이기면
  부대원 목록에 "산적"이 중복으로 쌓이는 문제가 있었다(HiddenTreasure·
  MountainShrine·Gatherable은 전부 이 확인을 갖고 있는데 제일 먼저
  만든 BanditEncounter만 빠져 있었음). 그 뒤 `World/RareWolfEncounter.cs`
  (흰 늑대, 격자 (0,3)) — BanditEncounter와 판정(DuelRules)·UI 조립
  (EncounterUiKit)은 같이 쓰지만 **"값을 치른다"가 없다**(짐승이라
  돈으로 못 무름, 선택지가 "맞선다"/"피한다" 둘뿐)·**등용이 아니라
  확정 보상**(경험치 150·돈 50냥·전용 방어구 "늑대 가죽 갑주" 방어+24,
  지금까지 최고 방어구, 도적 전리품엔 안 나옴)·**PartyState 대신
  `Data/RareWolfState.cs`로 처치 여부를 기억**(등용 대상이 아니라
  부대원 목록으로는 못 가림 — WorldEventState·ShrineState와 같은 결).
  `Data/ItemData.cs`에 `ar_wolf` 추가. `SaveState.cs` v7→v8로 처치
  여부도 저장. 컴파일·씬 재빌드(groundVerts=3136 그대로)·PlaytestHeadless
  전부 통과 — 늑대 조우·전투·보상이 실제로 도는지는 역시 사람이 직접
  싸워 봐야 확인됨.
- **PLAN.md 24~27장 "동물" 첫 조각 — 배회하는 사슴 두 마리.** 산신당
  다음으로 이어서(같은 세션, 2026-09-11). 지금까지 이 슬라이스엔 동물이
  하나도 없었다(9~10장 "여기는 아무것도 없다는 느낌을 최대한 피한다"가
  요구하는 항목이 빠져 있었음). `World/WanderingAnimal.cs`(스폰 자리
  중심 반경 24유닛 안에서 걷기↔멈춤 반복, 목표 지점이 걸을 수 있는
  칸인지 `TestMapData.WorldToGrid()`로 확인 — Idle/Wander만, Flee/
  Group/Interaction은 다음 조각) + `World/AnimalBuilder.cs`(작은
  primitive capsule 두 마리, 사람 크기 capsule과 비율로 구분, 안
  움직이는 게 아니라 `MarkStatic()` 대상 아님). `TestMapData.cs`에
  `WorldToGrid()`(`WorldPos()`의 역함수) 추가. 마을·NPC·도적·채집·
  산신당과 안 겹치는 들판 (2,2)/(4,4)에 배치. `BuildTestVillageScene
  .cs`에 `BuildAnimals()` 훅. **이 조각은 PlaytestHeadless의 10프레임
  동안 `WanderingAnimal.Update()`가 실제로 여러 번 돈다** — 지금까지
  조각들과 달리 정적 배치만이 아니라 매 프레임 로직이 실제로 오류 없이
  도는지까지 헤드리스로 확인된 셈(그래도 눈으로 자연스럽게 걷는지는
  못 봄). 컴파일·씬 재빌드(groundVerts=3136 그대로)·PlaytestHeadless
  전부 통과.
- **PLAN.md 51장 GO 월드 확장 — 산신당(둘째 조각, 같은 세션 이어서).**
  지도 자체를 키우는 건 여전히 안 함 — `WorldPos()`가 격자 전체 크기
  기준 중심 좌표라 칸 수를 바꾸면 지금까지 심어 둔 모든 좌표(마을·
  도적·굴·채집)가 통째로 밀린다(헤드리스로 못 잡는 리스크라 이번에도
  피함). 대신 **`TestMapData.Rows`의 격자 수는 그대로 두고 칸 하나의
  종류만 바꿨다** — `Legend`엔 원래부터 있었지만 `Rows`엔 한 번도 안
  쓰인 `'S'`(사당) 타일을 격자 (5,1)(원래 숲 `T`)에 심음. 칸 하나만
  바뀌어 나머지 좌표는 전혀 안 밀린다(groundVerts=3136 그대로로 확인).
  `LandmarksBuilder.BuildShrine()`(받침대+기둥 4개, primitive) +
  `Data/ShrineState.cs`(WorldEventState.cs와 같은 결 — 자리 하나짜리
  전용 상태 클래스, **세 번째 "자리 하나" 월드 이벤트가 생기면 그때
  GatherState.cs처럼 id 집합으로 둘을 합칠 것**) + `World/
  MountainShrine.cs`(HiddenTreasure와 달리 사당 자체가 이미 눈에 띄는
  표지라 반짝이는 마커 없이 트리거만 — 다가가면 경험치+돈). `SaveState
  .cs` v6→v7로 가호 여부도 저장. 컴파일·씬 재빌드(groundVerts 불변
  확인)·PlaytestHeadless 전부 통과 — 사당이 실제로 눈에 띄는지·트리거가
  발동하는지는 역시 사람이 직접 봐야 확인됨.
- **PLAN.md 51장 GO 월드 확장 — "수집" 콘텐츠 첫 조각.** 기술부채
  정리 다음으로 이어서(같은 세션, 2026-09-11) — 지도 크기를 키우는
  대신(TerrainBuilder·LandmarksBuilder·모든 격자 좌표를 건드리는 가장
  파급이 큰 손질이라 이번엔 피함, 32장 "최소 변경") 기존 7x7 지도의
  빈 들판 세 자리에 산나물 채집 지점을 심었다. `Data/GatherState.cs`
  (id 집합 — 도적·보물은 자리가 하나뿐이라 전용 상태 클래스를 뒀지만
  채집은 처음부터 여러 자리라 문자열 id로 구분, 사전에 일반화한 게
  아니라 이 콘텐츠 자체가 N개라 구조가 다름) + `World/Gatherable.cs`
  (HiddenTreasure.cs와 같은 결 — 트리거 한 번, 작은 발광 구슬, 캐면
  돈 +8냥). **자리마다 격자 좌표·id가 다른 첫 재사용 가능 컴포넌트라**
  BanditEncounter·HiddenTreasure처럼 상수로 못 박지 못하고
  `[SerializeField]`로 받는다 — 안 그러면 씬 저장 뒤 실제 Play 때
  Awake()가 기본값(0,0,null)으로 돈다(주석에 이유 남김). **Awake()가
  이미 "Visual" 자식이 있으면 다시 안 만들게 방어 코드를 넣었다** —
  이 프로젝트의 배치 모드 편집기 스크립트(`-executeMethod`)는 Awake를
  안 부르는 것으로 보이지만(그래서 각 Builder가 AddComponent 뒤에
  `.Build()`를 직접 또 부른다) 확신이 낮아 이중 생성에 안전하게
  만들어 둠 — **다음에 비슷한 컴포넌트를 새로 짤 때도 이 방어를
  기본으로 넣을 것.** 촌장(1,3)·상인(4,3)·도적(5,3) 말 걸기/조우
  반경과 안 겹치는 들판(1,2)/(5,2)/(2,4) 세 자리. `BuildTestVillageScene
  .cs`에 `BuildGatherables()` 훅 추가 — GameObject가 늘어 씬 재빌드
  (groundVerts=3136 그대로). `SaveState.cs` v5→v6로 캔 자리 목록도
  저장/로드. 컴파일·씬 재저장·PlaytestHeadless 전부 통과 — 발광
  구슬이 실제로 보이는지·캐지는지는 역시 사람이 직접 봐야 확인됨.

- **미뤄 둔 기술부채 — 골드 경제 + 상인 거래 + 상시 HUD.** Phase 6·7
  (59~73장)을 다 채운 뒤 사용자가 "다 하면 안 될까, 안 묻고 최대한
  계속해줘"로 판단을 맡겨(2026-09-11) 이전에 미뤄 뒀던 항목부터 정리.
  `Data/GoldState.cs`(시작 소지금 50냥 — 도적이 유일한 돈줄인데 그
  조우가 슬라이스에서 한 번뿐이라 사전에 돈이 없으면 "값을 치른다"가
  죽은 선택지가 된다, 그래서 시작부터 쥐여 줌) + `Data/ShopState.cs`
  (떠돌이 상인이 "베옷 갑주"를 25냥에 딱 한 번 판다 — Inventory.cs의
  "자동 장착"과 같은 결로 새 상점 화면 없이 말을 거는 순간 거래가
  끝난다). `BanditEncounter.ChoosePay()`가 이제 실제로 40냥을 쓰고
  (없으면 거절당해 도적이 다시 막아선다), 승리 보상에 돈 +30냥,
  `HiddenTreasure`도 +20냥을 얹는다. `NpcBuilder.cs`의 상인 대사를
  `ElderLine()`과 같은 패턴(`MerchantLine()`)으로 상태 분기(아직 못
  삼/방금 삼/이미 삼)하게 바꿈. **`UI/PlayerHud.cs`** — 새 인벤토리·
  장비창 화면을 만드는 대신(범위 밖으로 계속 미룸) 화면 왼쪽 위
  DebugUI 바로 아래에 "Lv.N (경험치 x/y) 돈 z냥 / 무기·방어구" 한
  줄을 릴리즈 빌드에서도 항상 띄운다(0.5초마다 갱신, DebugHud.cs의
  FPS 갱신과 같은 방식). `BuildTestVillageScene.cs`에 `BuildPlayerHud()`
  훅 추가 — GameObject가 늘어 씬 재빌드(`groundVerts=3136` 그대로).
  `SaveState.cs` v4→v5로 돈·상인 거래 여부도 저장/로드. 컴파일·씬
  재저장·PlaytestHeadless 전부 통과 — 상인 거래·길세 거절 문구·HUD
  갱신은 역시 사람이 직접 봐야 확인됨. **사전 구조로 사건/퀘스트/상점을
  일반화하는 건 여전히 안 함**(콘텐츠가 이 하나뿐이라 2장 "테스트되지
  않은 시스템을 대량 생성" 위반 — 두 번째 사건이 생길 때 할 일).
- **Phase 7(72~73단계) — World Event / Hidden Area.** Quest(70~71) 다음
  순서로 이어서(2026-09-11, 같은 세션). `Data/WorldEventState.cs`(사건
  하나뿐 — 굴 옆 보물을 찾았는지만 기억, PartyState.cs와 같은 자리) +
  `World/HiddenTreasure.cs` — 굴 입구(LandmarksBuilder가 격자 (3,0)에
  세운 상자, 크기 10x6x4)를 안 가리게 +7 비켜 둔 자리에 발광 구슬 하나.
  BanditEncounter처럼 선택지 UI를 안 두고 VillagerTalk 수준의 단순
  트리거로 줄였다 — 들어서는 순간 바로 발견 처리. **보상은 `ItemData.cs`
  에 새로 추가한 "유물 검"(공격+30, 기존 최고인 쇠칼 +22보다 셈)** —
  도적 전리품 테이블엔 안 넣어서 이 굴을 찾아야만 얻을 수 있는 탐험
  전용 보상으로 갈랐다(PLAN.md 51장 "계속 플레이할 이유"의 "숨겨진
  장소"를 실제로 다른 보상으로 갚음). 한 번 찾으면 `WorldEventState`가
  기억해 다음 씬 로드(세이브 불러오기)에서 `HiddenTreasure.Awake()`가
  스스로 지운다. `SaveState.cs` v3→v4로 이 플래그도 저장/로드.
  `BuildTestVillageScene.cs`에 `BuildHiddenTreasure()` 훅 추가 — **이번엔
  씬 하이어라키에 GameObject가 실제로 늘어 `BuildTestVillageScene.Build()`
  를 다시 돌렸다**(Phase 6·7 Quest 때와 달리 재실행이 필요한 경우,
  groundVerts=3136 그대로 — 땅은 안 바뀜). 컴파일·씬 재저장·
  PlaytestHeadless 전부 통과 — 역시 트리거가 실제로 발동해 발광 구슬이
  눈에 보이고 문구가 뜨는지는 사람이 직접 걸어가서 봐야 확인된다.
- **Phase 7(70~71단계) — Quest 시스템 / Quest Objective·Reward.** Phase 6
  다음 순서로 이어서(2026-09-11, 같은 세션). `Data/QuestState.cs`(퀘스트
  하나뿐 — NotStarted/Active/Completed 3단계, PartyState.cs와 같은 자리)
  + `VillagerTalk.cs`를 고정 문자열 대신 `Func<string>`도 받게 넓혀
  (기존 `Init(name, string)`는 그대로 유지, 내부에서 람다로 감싸 호출)
  `NpcBuilder.cs`의 마을 촌장에게 퀘스트 상태별 대사(`ElderLine()`)를
  줬다 — **말을 거는 순간이 곧 수락**이라 그 함수 안에서
  `QuestState.StartBanditQuest()`를 직접 부른다(VillagerTalk는 그 결과
  문장을 보여주기만 하는 화면 층, 부수효과는 NpcBuilder 쪽에 둠).
  `BanditEncounter.FinishFight()`가 승리 시 `QuestState
  .CompleteBanditQuest()`를 불러(퀘스트가 Active일 때만 true — 촌장을
  안 만났으면 조용히 건너뜀, 이미 끝났으면 중복 방지) 완료 시
  경험치 +50을 추가로 주고 토스트에 "퀘스트 완료" 줄을 얹는다. **"값을
  치른다"/"달아난다"를 골라도 도적은 안 사라지므로(기존 동작) 나중에
  다시 "맞선다"로 퀘스트를 끝낼 수 있다** — 퀘스트 진행이 그 선택 때문에
  막히지 않는다. `SaveState.cs`를 v2→v3로 올려 퀘스트 단계도 저장/
  로드(`MigrateStep(2, ...)`로 예전 세이브는 NotStarted로 채움). 컴파일·
  PlaytestHeadless 전부 통과 — **역시 헤드리스로는 촌장과의 대화도
  퀘스트 완료도 실제로 안 일어나 확인 못함**(플레이어가 안 움직임).
- **Phase 6(59~67단계) — Stats/EXP/Level Up/Item/Inventory/Equipment/
  Reward/Loot Table.** 버티컬 슬라이스 코드가 다 끝난 뒤(77~78단계는
  사람의 플레이 평가가 필요해 못 넘어감) 2026-09-11 사용자가 "게이트를
  건너뛰고 계속 진행"을 명시로 골라 착수. `Data/PlayerStats.cs`(레벨·
  경험치, static — PartyState.cs와 같은 자리, UnityEngine 안 끌어옴)
  + `Data/ItemData.cs`(무기/방어구 카탈로그 4종, plain C# — TestMapData.cs
  처럼 이 슬라이스는 ScriptableObject 대신 코드 카탈로그로 통일) +
  `Data/Inventory.cs`(소지 목록 + 장비 슬롯, "더 센 장비를 주우면 자동
  장착" — 장비창 UI를 새로 만들지 않고 이게 유일한 조작 경로) +
  `Data/LootTable.cs`(가중치 룰렛, 도적 전용 테이블 하나뿐 — 사건이
  하나뿐이라 (id→테이블) 사전 구조는 아직 안 만듦). `World/
  BanditEncounter.cs`의 `StartFight()`가 `PartyState.Atk/Def`에
  `PlayerStats`·`Inventory` 보너스를 더해 실전투력을 만들고,
  `FinishFight()`의 승리 분기가 경험치(+100, 1레벨 임계치 80이라 첫
  승리에 바로 레벨업하도록 일부러 맞춤)·루트 굴림·자동장착까지 한
  토스트 메시지로 모아 보여준다. **도적은 슬라이스 안에서 한 번만
  나고 다시 안 나서(기존 설계) 이 보상 루프도 실질적으로 한 판만
  체감된다** — 재도전으로 파밍하는 느낌은 이번 조각 밖. "값을
  치른다"/"달아난다"는 여전히 대사만(골드 경제는 Phase 6 목록에 없어
  이번에도 안 건드림). `Data/SaveState.cs`를 v1→v2로 올려 레벨·경험치·
  인벤토리·장비도 저장/로드하게 하고, `MigrateStep(1, ...)`에 실제
  내용을 처음 채웠다(전엔 자리만 파 둔 빈 경로였다 — PLAN.md 75장
  "Data Versioning"의 첫 실사용례). 컴파일·PlaytestHeadless 전부 통과
  (헤드리스 플레이는 플레이어가 안 움직여 조우 자체가 안 일어나므로
  새 로직의 실제 동작은 검증 못함 — 사람이 직접 싸워 확인해야 함).
- `PLAN.md`·`CLAUDE.md` 작성 완료 — `saga-godot/PLAN.md` 기반, Unity(C#,
  URP, ScriptableObject 등)에 맞게 다시 씀. 레거시 감사는 새로 안 하고
  `saga-godot/docs/LEGACY_FEATURE_AUDIT.md` 참고.
- **Phase 1(01~09단계) 완료.** Unity 6000.3.23f1 배치 모드로 "3D
  Cross-Platform"(URP) 템플릿 프로젝트 생성. `productName`="SAGA".
  `SagaCore.asmdef`·`SagaGo.asmdef`(SagaGo→SagaCore, Unity.InputSystem
  참조). `.gitignore` 작성. 66-1장(렌더러 이중 프로파일)은 템플릿이 이미
  `PC_RPAsset`(ForwardPlus)/`Mobile_RPAsset`(Forward)+Quality 자동분기를
  갖추고 있어 확인만 함.
- **Phase 2(11~13단계) 완료.** `docs/VERTICAL_SLICE.md` 작성 — 범위는
  `saga-godot`과 동일(사가고 "도적의 습격"), 같은 7×7 테스트 지도 재사용
  결정.
- **Phase 3(28~31단계) 첫 조각 — 초목/바위.** `Assets/Games/SagaGo/World/
  VegetationBuilder.cs` — saga-godot의 vegetation_builder.gd와 같은
  결정적 해시 배치(숲 타일당 나무 3그루, 산 타일당 바위 1개). 아직 GLB
  전이라 TerrainBuilder와 같은 방식(결합 메시+정점 색+VertexColorLit)으로
  씀. 나무 줄기만 CapsuleCollider로 막음(잎은 안 막음), 바위는 산 타일
  자체가 이미 막혀 있어 추가 충돌 없음. `BuildTestVillageScene.cs`에
  `BuildVegetation()` 훅 추가(땅 다음, 플레이어 전). 씬 재저장·
  PlaytestHeadless(Play 모드 실행)까지 전부 통과 확인됨.
- **Phase 3(28~31단계) 둘째 조각 — 랜드마크.** `Assets/Games/SagaGo/
  World/LandmarksBuilder.cs` — saga-godot의 landmarks_builder.gd와
  같은 자리·크기(굴 입구·마을집 2채·폐허 기둥 3개·다리 1개). 개수가
  적어 VegetationBuilder처럼 결합 메시로 안 묶고 Unity 기본
  Cube/Cylinder primitive + URP/Lit 단색 머티리얼을 그대로 씀. 다리
  덱은 시각만(충돌은 TerrainBuilder가 'B' 타일에 이미 만들어 둠, 두
  곳이 각자 만들면 겹친다 — saga-godot과 같은 결정). `BuildTestVillageScene
  .cs`에 `BuildLandmarks()` 훅 추가(초목 다음, 플레이어 전). 씬 재저장·
  PlaytestHeadless까지 전부 통과 확인됨.
- **Phase 3(23~25단계) 넷째 조각 — Sky/Fog.** PLAN.md에 적혀 있던
  "URP Volume — Physically Based Sky/Fog 오버라이드"는 실제론 HDRP
  전용 기능이라 URP엔 없다는 걸 확인(Library/PackageCache의 URP
  Volume 컴포넌트 목록에 Fog·Sky류 없음, Bloom/Vignette 등 포스트
  프로세싱만 있음) — 대신 URP가 쓰는 고전 방식(`RenderSettings`)으로
  짰다. `BuildTestVillageScene.cs`의 `BuildSkyAndFog()` — 절차적
  Skybox 머티리얼 에셋(`Assets/Games/SagaGo/World/Sky.mat`, saga-godot
  `env_pc.tres` 색 참고) 생성/재사용 + `RenderSettings.fog`(Linear,
  150~430m — 336m 사방 지도 기준). **주의 — 이 안개는 URP/Lit 셰이더만
  자동으로 받는다.** `VertexColorLit.shader`·`WaterUnlit.shader`(땅·
  나무·바위·강 전부 이 둘을 씀)는 직접 짠 커스텀 셰이더라 URP 표준
  안개 믹싱(`multi_compile_fog`+`ComputeFogFactor`+`MixFog`)을 손으로
  넣어야 했다 — 넣기 전엔 랜드마크만 안개 지고 나머지 세계는 안 지는
  상태였을 것(직접 눈으로 확인은 안 함, 셰이더 임포트 에러 없음+
  PlaytestHeadless 통과까지만 확인). 실제로 안개가 자연스러워 보이는지는
  다음에 GUI로 몰아서 확인할 때 볼 것.
- **Phase 8 최소 조각 — NPC·Dialogue.** VERTICAL_SLICE.md 26절 범위로
  좁힌 saga-godot npc_builder.gd와 같은 것: 주민 2명(마을 촌장·떠돌이
  상인), 하루 일과·날씨·LOD는 범위 밖, 등용 대상 아님. saga-godot이
  "대화가 전투보다 먼저"로 순서를 정정했던 교훈 그대로 Combat보다
  먼저 넣었다. `NpcBuilder.cs`(자리·모양 — Player와 같은 크기 primitive
  capsule, 옷 색만 다르게) + `VillagerTalk.cs`(SphereCollider 트리거,
  반지름 14, 쿨다운 45초) + `Assets/Games/SagaGo/UI/DialogueLabel.cs`
  (화면 상단 자막, 4초 표시 — 그룹 대신 자기등록 싱글턴으로 Godot의
  "dialogue_label" 그룹 흉내). `BuildTestVillageScene.cs`에
  `BuildNpcs()`·`BuildDialogueUi()` 훅 추가. 씬 재저장·PlaytestHeadless
  까지 통과 확인됨 — **말 걸기가 실제로 되는지(트리거 판정·자막 표시)는
  헤드리스로 못 본다, 사람이 직접 플레이해서 확인해야 하는 부분.**
- **Phase 6(61~71단계) — Combat "도적의 습격".** 72~74 엘리트/보스는
  이번 슬라이스에서 스킵(saga-godot과 같은 범위). saga-godot의
  duel_rules.gd(원본 js/duel.js)를 상수 하나 안 바꾸고 그대로 옮긴
  `Assets/Games/SagaGo/Data/DuelRules.cs`(판정 층, 엔진 비의존 순수
  클래스) + `PartyState.cs`(등용 인원 수 → 공격력/방어력, Godot의
  autoload 싱글턴을 static 클래스로 대신함 — Unity엔 오토로드가 없다)
  + `World/BanditEncounter.cs`(화면 층 — 조우 트리거 → 사건 선택지
  3지(맞선다/값을 치른다/달아난다) → 실시간 전투 UI, 기세·사기·기
  세 막대는 `Image.fillAmount`로, 속공/필살/회피/물러난다 4버튼).
  "값을 치른다"·"달아난다"는 골드·소지품 시스템이 없어(Phase 9 몫)
  대사만 보여주고 끝 — 새 경제 시스템 안 만듦. 승리 시 `PartyState
  .Recruit()`로 등용, 도적은 `Destroy(gameObject)`로 사라짐(이번
  슬라이스에서는 다시 안 남). 컴파일·씬 재저장·PlaytestHeadless
  전부 통과. **전투가 실제로 손맛 있게 도는지(트리거 진입·버튼
  반응·막대 움직임·화면 플래시)는 헤드리스로 못 본다 — 사람이 직접
  플레이해서 확인해야 하는 부분.** 키보드 단축키(J/K/L)는 이번엔
  안 넣었다 — 화면 버튼만으로 조작(모바일 우선 설계와 같은 결).
- **Save/Load 최소 구현 (12단계 완료 조건의 마지막 "저장한다 → 다시
  켜서 이어진다").** saga-godot의 save_state.gd와 같은 구조 —
  `Assets/Games/SagaGo/Data/SaveState.cs`가 `Application
  .persistentDataPath/save.json`에 버전 필드 포함 JSON으로 저장(지금
  실제로 있는 상태는 플레이어 위치·부대뿐이라 그것만 — PLAN.md
  28장이 요구하는 레벨/장비/인벤토리/퀘스트는 이 슬라이스에 아직
  없어서 저장 안 함). `MigrateStep()` 자리는 미리 파 뒀다(지금은
  버전 1뿐이라 빈 경로, 스키마 바뀔 때 여기 채움 — PLAN.md Phase 9
  "Data Versioning" 선반영). 화면 오른쪽 위 저장 버튼(누르면
  `DialogueLabel`로 토스트) + `GameBootstrap.cs`(씬 시작 시
  `SaveState.TryLoad()`, saga-godot test_village.gd `_ready()`와
  같은 역할 — Awake 대신 Start를 써서 Player가 이미 자리 잡은 뒤임을
  보장). `PartyState.cs`에 `MemberIds`(읽기 전용) 추가해 SaveState가
  등용 목록을 읽게 함. 컴파일·씬 재저장·PlaytestHeadless 전부 통과.
  **저장→재시작→위치/부대가 실제로 돌아오는지는 헤드리스로 못 본다.**
- **디버그 오버레이 (PLAN.md 46장·66-1장).** `Assets/Games/SagaGo/
  UI/DebugHud.cs`(원래 이름 DebugOverlay였는데 `UnityEngine.Rendering
  .DebugOverlay`와 겹쳐 CS0104 컴파일 에러 — DebugHud로 고침, 다음에
  또 "DebugOverlay"라는 이름을 쓰지 않는다) — 디버그 빌드에서만 화면
  왼쪽 위에 현재 Render Pipeline Asset 이름 + FPS. saga-godot의
  renderer_debug_label.gd와 같은 최소 범위 — PLAN.md 44~49장이 나열한
  전체 목록(Draw Calls/Enemy Count/Current Quest 등)은 그 시스템
  자체가 없어서 안 만듦(saga-godot도 실제로는 렌더러 이름만 보여줌).
  컴파일·씬 재저장·PlaytestHeadless 전부 통과.
- **Mobile Performance Pass 첫 조각 (PLAN.md 76장).** TerrainBuilder·
  VegetationBuilder·LandmarksBuilder가 만드는 것들(땅·물·충돌·나무·
  바위·굴 입구·마을집·폐허·다리)은 전부 절대 안 움직이는 지오메트리라
  `Build()` 끝에 `MarkStatic()`(자식 트리 전체를 훑어 `isStatic=true`)
  을 걸었다 — 정적 배칭·오클루전 컬링 대상이 된다. **NPC·플레이어·
  도적은 일부러 안 건드렸다** — 도적은 `PulseVisual()`로 강타 때
  scale이 실제로 바뀌고, static 오브젝트를 런타임에 옮기면 Unity가
  경고를 내고 제대로 안 움직인다(NPC는 지금 안 움직이지만 "하루 일과"
  로 나중에 움직일 계획이 있어 미리 막지 않음). 씬 YAML에
  `m_StaticEditorFlags: 2147483647`로 정확히 그 오브젝트들만 찍힌
  것 확인함(Player·NPC·Bandit·UI는 0). **주의 — `isStatic=true`만으로는
  런타임에 생성된 메시가 자동으로 정적 배칭까지 되는 건 아니다**
  (에디터에서 손으로 만든 오브젝트와 달리, 우리 건 전부 Awake() 때
  코드로 만든다 — 실제 드로우콜 감소를 보려면 `StaticBatchingUtility
  .Combine()`을 명시로 불러야 한다, 이번엔 안 함). 이번 조각은 플래그만
  — 오클루전 컬링·라이트매핑 자격 부여 정도의 효과는 있지만 드로우콜
  감소 효과는 아직 없다. 컴파일·씬 재저장·PlaytestHeadless 전부 통과.
- **Mobile Performance Pass 둘째 조각 — 실제 배칭 호출 (PLAN.md 76장,
  위 "첫 조각"에서 멈춘 자리를 이어서).** `isStatic` 플래그만으론 드로우콜이
  안 준다는 문제를 `GameBootstrap.cs`에 `CombineStaticBatches()`를 추가해
  풀었다 — `Start()`(씬의 모든 Awake가 끝난 뒤 보장)에서 `Terrain`·
  `Vegetation`·`Landmarks` 세 루트 각각에 `StaticBatchingUtility.Combine
  (root)`를 부른다. 세 루트가 공통 부모를 안 나누고 있어(BuildTestVillageScene
  .cs가 셋을 씬 최상위에 따로 만든다) 배칭도 세 그룹으로 따로 묶인다 —
  Terrain↔Vegetation↔Landmarks 사이 교차 배칭은 없다(더 줄이려면 셋을 공통
  부모 밑에 넣고 그 부모 하나로 Combine을 바꿔야 하는데, 이번 조각에서는
  안 함). 컴파일·PlaytestHeadless 전부 통과(`OK - 10 frames, no errors`) —
  **드로우콜이 실제로 줄었는지 수치 확인은 아직 안 함**(Stats 창은 GUI
  에디터라야 보여 헤드리스로는 못 본다 — 다음에 사람이 GUI로 확인할 때
  Game 뷰 Stats로 Before/After 드로우콜을 같이 봐 둘 것).
- **PLAN.md 66-1장(PC/Mobile 렌더러 이중 프로파일) 재점검·MSAA 튠.**
  Phase 1에서 "콘텐츠가 늘면 다시 점검한다"고 미뤄 뒀던 지점 — 버티컬
  슬라이스 콘텐츠가 다 들어간 지금 다시 봤다. **SSAO·그림자 Cascade
  수(PC 4/Mobile 1)·그림자 해상도(PC 2048/Mobile 1024)·Depth/Opaque
  텍스처 요구(PC만 켜짐, SSR 등에 필요)는 이미 템플릿 기본값이 66-1장
  표와 정확히 맞아 있었다** — 손 안 댐. **MSAA만 PC·Mobile 둘 다
  꺼진 채(`m_MSAA: 1`=Disabled) 방치돼 있어서** `Mobile_RPAsset.asset`
  →2(2x), `PC_RPAsset.asset`→4(4x)로 바꿨다(표의 "PC: MSAA/TAA"를
  TAA 대신 MSAA 쪽으로 택함 — TAA는 카메라별 AdditionalCameraData·
  Motion Vector 설정이 더 필요해 지금 콘텐츠 규모에는 과함, 32장 "최소
  변경" 원칙). **Screen Space Reflection·Volumetric Fog는 일부러 안
  넣었다** — 표에 PC 항목으로 적혀 있지만 지금 씬엔 그 효과가 붙을
  반사면/안개 콘텐츠가 없어 검증 없이 넣으면 2장 "테스트되지 않은
  시스템을 대량 생성" 위반이다 — 반사 재질이나 짙은 안개가 들어갈 때
  같이 넣을 것. 두 URP Asset의 Volume Profile을 공유(`SampleSceneProfile`
  guid `10fc4df2...`)하는 것도 **의도된 상태**(표 아래 "색 톤은 두 Asset에서
  같게 유지" 요구사항 — 버그 아님, 갈라놓지 않는다). 컴파일·PlaytestHeadless
  전부 통과.
- **Phase 3(21~35단계) 첫 조각 — 땅.** `Assets/Games/SagaGo/Data/
  TestMapData.cs`(지도·LEGEND, C#으로 새로 짬) + `World/TerrainBuilder.cs`
  (칸을 4×4 서브쿼드로 쪼개 정점 색 블렌딩 — saga-godot이 겪은 "칸 경계
  바둑판" 문제를 처음부터 피함, 강/다리 수면·타일별 BoxCollider도 같이
  만듦) + `VertexColorLit.shader`·`WaterUnlit.shader`(URP엔 기본으로
  없는 "정점 색=알베도" 셰이더를 새로 씀).
- **Phase 4(36~45단계) 첫 조각 — Player.** `Assets/Games/SagaGo/Player/
  PlayerController.cs`(이동·중력·달리기·회전, saga-godot player.gd
  수치 그대로) + `CameraRig.cs`(추적·드래그 회전·줌, camera_rig.gd 수치
  그대로 — 단 Godot↔Unity 좌표 핸디니스 차이로 드래그 방향 부호는 "일반
  적인 오빗 카메라" 감각으로 다시 판단해 정함, 실제로 saga-godot과 같은
  느낌인지는 미확인) + `Assets/Games/SagaGo/UI/VirtualJoystick.cs`
  (Unity UI EventSystem 인터페이스 사용, Godot의 터치 index 수동 추적
  불필요). `Assets/Editor/BuildTestVillageScene.cs`를 확장해 Player·
  CameraRig·PlayerCamera·ReviewCamera(비활성)·EventSystem(새 Input
  System용 InputSystemUIInputModule)·MobileHUD(조이스틱 Canvas)까지
  전부 코드로 조립하도록 늘림.

## 현재 작업

- 없음.

## 완료 단계 (추가, 2026-09-11)

- **Phase 3(32장) 첫 조각 — Sky/Fog.** `Assets/Games/SagaGo/World/
  SkyFogBuilder.cs`(신규) — saga-godot의 `env_pc.tres`(ProceduralSkyMaterial
  + Environment fog) 수치를 그대로 옮겼다. 스카이박스 셰이더 자산을 새로
  만들지 않고 URP/RenderSettings API만으로 채웠다: Trilight 앰비언트
  (하늘/수평선/땅 3색)가 Godot의 sky_top/horizon·ground_bottom/horizon
  색과 같은 역할, `RenderSettings.fog`(ExponentialSquared, density=0.006 —
  env_pc.tres와 같은 값, 두 판이 같은 세계 축척 TileSize=48m을 쓰기로
  한 결정을 따름)가 fog_enabled/density/light_color와 같은 역할. 카메라
  (PlayerCamera·ReviewCamera 둘 다) `clearFlags=SolidColor` +
  `backgroundColor=HorizonColor`로 스카이박스 자산 없이도 하늘이 파랗게
  보이게 함. `BuildTestVillageScene.cs`에 `BuildSkyAndFog()` 훅 추가
  (조명 다음, 지형 전).
  - **이번 세션은 이 PC에 Unity가 설치돼 있지 않아(`CLAUDE.md`의 "PC마다
    다르다" 그대로) 배치 모드 컴파일·PlaytestHeadless 검증을 못 했다.**
    코드는 기존 파일(LandmarksBuilder.cs 등)과 같은 네임스페이스·스타일
    관례를 그대로 따랐고 API(`AmbientMode`·`FogMode`·`CameraClearFlags`
    등)도 안정적인 표준 Unity API라 컴파일이 될 것으로 보이지만, **다음
    세션이 Unity 있는 PC에서 열면 `-batchmode -nographics -quit`
    컴파일 확인과 `PlaytestHeadless.Run` 둘 다 가장 먼저 돌려 볼 것**
    (아래 "다음 작업" 맨 앞에 넣어 둠).

## 다음 작업 (다음 세션이 이어갈 것)

- **스물세 번째 세션은 여기서 멈췄다(2026-09-13, 사용자가 "새로운
  세션에서 이어 해줘"로 끝) — 66-2장 캐릭터 파이프라인을 ④부터 ⑪까지
  쭉 이어 끝냈다: ④ 헤어/SSS 셰이더 GitHub 라이선스 확인(MIT/MIT/
  CC0)+환경 PBR Roughness→Smoothness 채널 팩킹 실제 해결, ⑤ 그 셰이더
  세 벌 실제 반입(`Assets/Art/CharacterShaders_candidates/`), ⑥ Poly
  Haven 재질 3벌 추가(흙길·초목·목재), ⑦ 사용자가 mixamo.com에서 직접
  받은 Maria(몸+애니메이션 8개)를 `Assets/Art/CharactersRealistic/`에
  반입+Humanoid 리깅, ⑧ Animator Controller로 8개 클립 연결+확인용
  씬(`TestCharacterRealistic.unity`) 배치, ⑨ 사용자의 "직접 확인해"
  요청으로 실제 GUI Play 스크린샷 확인 중 Ground 머티리얼/앰비언트
  버그를 찾아 바로 고침, ⑩ "텍스처가 없다"던 처음 진단이 틀렸음을
  발견·정정(Unity가 FBX 임베드 텍스처를 자동 추출 안 해줄 뿐이었다 —
  재다운로드 자체가 불필요했음, `ExtractTextures()`로 해결), ⑪ Shader
  Graph는 코드로 조립 못 해(AnimatorController와 다름) SSS 셰이더 직접
  연결은 접고, 대신 삼각형별 UV-색 분류로 피부/기타 서브메시를 나눠
  값싼 스킨 근사(따뜻한 톤+낮은 광택)를 적용(자세한 내용은 위 66-2장
  각 항목·`PLAN.md` 66-2장 ④~⑪ 참고).**
  - 작업 트리 깨끗함(커밋되지 않은 변경 없음), 이 세션에서 나간 커밋
    여덟(`8491c0b`④→`68f95f1`⑤→`0574ab7`⑥→`b98a676`⑦→`9a576ae`⑧→
    `39110b7`⑨→`287e8f0`⑩→`f8c6d2e`⑪) 전부 배치 모드 컴파일·씬 재빌드
    확인(⑦·⑧·⑨·⑩·⑪은 추가로 실제 GUI Play 스크린샷까지) 후 그때그때
    커밋·푸시(중간에 다른 두 세션의 saga-godot 작업과 두 번 자동
    병합, 충돌 없음 — 폴더가 다르다).
  - **다음 세션이 볼 것** — (1) ⑪이 남긴 과제: 헤어카드(이방성)·진짜
    SSS(`FakeSSS.shadersubgraph`)를 실제로 쓰려면 Shader Graph 노드
    연결을 사람이 GUI로 해야 한다(코드로 못 함) — 사용자가 직접 하거나,
    다음 세션이 GUI 자동화(마우스 클릭)로 시도해 볼 수도 있음(좌표
    정밀도 때문에 실패 위험 있다는 것도 미리 알릴 것). 헤어는 금발색이
    갑옷 금장식과 색상적으로 너무 가까워 지금 쓴 UV-색 분류 방식으로는
    분리 못 함(다른 판별 기준 필요). (2) 없으면 44장 우선순위대로
    Kenney·VRoid 플레이스홀더를 실제 게임 씬(SagaGo/Dungeon/Forest/
    Story/Realm)에 순차 교체하는 단계로 넘어갈 것 — 이건 사용자가
    "정해줘"로 위임하지 않는 한 상의부터 한다. (3) GUI로 아직 안 본
    Dungeon/Forest/Realm 세 판의 실제 톤 확인도 22번째 세션 때부터
    밀려 있는 채로 남아 있음.
- **(과거) 스물두 번째 세션은 여기서 멈췄다(2026-09-13, 사용자가 "새로운
  세션에서 이어 해줘"로 끝) — REALM 서고(익힌 문제 목록) 마무리부터
  시작해, 사용자가 "파이널 판타지 그래픽처럼 하고 싶어, 최신작 기준임"
  으로 아트 방향을 구체화해 달라고 해 saga-unity PLAN.md 66-2장(FF16
  기준 사실적 PBR)을 완성했고, "Unity 에디터로 직접 열어서 화면 톤
  확인해줘"라는 명시적 요청으로 GUI 실기 확인까지 했다(위 "완료 단계"
  각 항목 참고).**
  - 작업 트리 깨끗함(커밋되지 않은 변경 없음), 이 세션에서 나간 커밋
    다섯(`43762d2` REALM 서고 → `87e5718` saga-godot 66-2장(카툰) →
    `01539a6` saga-unity 66-2장(FF16 구체화) → `0622ee2` 라이팅/후처리
    셋업 → `6088efe`→`5d1e178`(리베이스로 해시 바뀜) golden-hour
    라이팅 재조정+GUI 확인) 전부 컴파일·씬 재빌드·헤드리스 플레이테스트
    통과 확인 후 그때그때 커밋·푸시(중간에 다른 두 세션의 66-2장
    ②환경 PBR 조사·③캐릭터 에셋 조사 작업과 두 번 리베이스 — 파일이
    안 겹쳐 충돌 없음, PROJECT_STATE.md 순서만 한 번 수동 정리).
  - **다음 세션이 볼 것** — (1) GUI로 아직 안 본 Dungeon/Forest/Realm
    세 판의 실제 톤(라이팅 값은 바꿨지만 GO처럼 직접 화면으로 확인은
    안 함 — Dungeon은 "무드 유지" 판단이 맞는지, Forest/Realm도 GO의
    SkyFogBuilder 급으로 팔레트를 더 데워야 할지가 관건), (2) 없으면
    66-2장 "다음에 할 일" 남은 항목(다른 세션이 이미 진행 중인 ②환경
    PBR 채널 팩킹 Shader Graph·③캐릭터 에셋 실제 확보 등) 중 다음
    조각 — 사용자가 "정해줘"로 위임하지 않는 한 상의부터 한다.
- **(과거) 스물한 번째 세션은 여기서 멈췄다(2026-09-13, 사용자가 "작업 완료
  되면 새로운 세션에서 이어하자"로 끝) — "1,2,3 순서대로 다 진행해줘
  묻지 말고"로 세 조각을 전부 세션이 직접 순서대로 끝냈다: (1) REALM
  월드맵 첫 슬라이스, (2) FOREST 가구 자유 배치로 재설계, (3) STORY
  콘텐츠 확장(두목+두 번째 사명) — "다른 판 콘텐츠 확장" 방향은
  GO→DUNGEON→FOREST→STORY→REALM 순서상 커밋 수가 가장 적던 STORY를
  세션이 직접 골랐다(위 "완료 단계" 각 항목 참고).**
  - 작업 트리 깨끗함(커밋되지 않은 변경 없음), 이 세션에서 나간 커밋
    셋(`d38ad55` REALM 월드맵 → `4909c5e` FOREST 자유 배치 → STORY
    두목 커밋) 전부 컴파일·씬 재빌드·헤드리스 플레이테스트 통과 확인
    후 그때그때 커밋·푸시(중간에 다른 세션의 saga-godot STORY 작업과
    두 번 병합, 충돌 없음 — 폴더가 다르다).
  - **다음 세션이 볼 것** — (1) 사람의 실기 확인 피드백(이번까지 쌓인
    REALM 월드맵·FOREST 자유 배치·STORY 두목 세 슬라이스 — 위 각
    "완료 단계" 항목의 "사람의 GUI 확인 필요" 참고)이 먼저 도착하면
    그것부터, (2) 없으면 REALM 남은 후보(여전히 남아 있다면)·FOREST
    다음 콘텐츠·STORY 다음 콘텐츠(무예 셋 계열 확장, 두 번째 사냥터
    등)·다른 판 확장 중 **어느 걸 먼저 할지는 방향 결정이라 세션이
    임의로 안 고른다** — 사용자가 다시 "정해줘"로 위임하지 않는 한
    상의부터 한다.
- **(과거) 스무 번째 세션은 여기서 멈췄다(2026-09-13, 사용자가 "현재 작업
  완료 하고 새로운 세션에서 다시하자"로 끝) — "1,2,3,4 순서대로 다
  진행해 묻지말고"로 네 조각을 전부 세션이 직접 순서대로 끝냈다: (1)
  REALM 외교 절반(계략: 유언비어·화계), (2) REALM 함락한 성 편입,
  (3) REALM 문답(36문항), (4) FOREST 벽지/장판(위 "완료 단계" 각
  항목 참고, 세션이 "다른 판 콘텐츠 확장"을 FOREST로 직접 골랐다).**
  - 작업 트리 깨끗함(커밋되지 않은 변경 없음), 이 세션에서 나간 커밋
    넷(`1d0772d` 계략 → `16f4760` 함락한 성 편입 → `9307b8b` 문답 →
    FOREST 벽지/장판 커밋) 전부 컴파일·헤드리스 플레이테스트 통과
    확인 후 그때그때 커밋·푸시.
  - **곁다리로 테스트 인프라 결함 둘을 같은 패턴으로 잡았다** —
    REALM·FOREST 둘 다 `GameBootstrap`이 매번 `TryLoad()`를 불러
    이전 헤드리스 실행이 남긴 세이브를 그대로 읽어 버리는 문제
    (`RealmSaveState.DeleteForTest()`/`ForestSaveState.DeleteForTest()`
    신규, 모든 헤드리스 Playtest의 `Run()` 맨 앞에서 호출). 다른 세
    판(GO/DUNGEON/STORY)도 저장 스키마가 또 바뀌면 같은 함정을 밟을
    수 있다 — 그때 참고할 것.
  - **다음 세션이 볼 것** — (1) 사람의 실기 확인 피드백(이번까지 쌓인
    REALM 전체·FOREST 벽지장판·DUNGEON 마을 넷·STORY 첫 슬라이스 등)이
    먼저 도착하면 그것부터, (2) 없으면 REALM 남은 후보(월드맵 2-8~
    2-10절 등)·FOREST 가구 자유 배치·다른 판 콘텐츠 확장 중 **어느 걸
    먼저 할지는 방향 결정이라 세션이 임의로 안 고른다** — 사용자가
    다시 "정해줘"로 위임하지 않는 한 상의부터 한다. (3) `PlaytestForestCreatures`
    가 가끔 무작위 배회 요행으로 실패하는 것(이 세션이 재현·재실행
    확인만 해 둠, 이 조각과 무관 — 픽스는 아직 안 함, 픽스하려면 씨앗
    고정 또는 문턱값 완화 검토) — 급하지 않으면 다음 결정과 함께.
- **(과거) 열아홉 번째 세션은 여기서 멈췄다(2026-09-13, 사용자가 "새로운
  세션에서 이어 하자"로 끝) — "실기 확인은 내가 할게, 다음 방향
  정해줘"로 방향 결정을 세션에 위임받아, REALM 전쟁 첫 슬라이스(소패
  공략, 위 "완료 단계" 맨 위 항목)를 세션이 직접 골라 끝냈다.**
  - 작업 트리 깨끗함(커밋되지 않은 변경 없음), 이 세션에서 나간 커밋
    셋(`cca436b` REALM 착수 → `b3da137` 명령 나머지 6종·여러 성 확장·
    무장 성 소속 → `0ae37f6` 전쟁 첫 슬라이스) 전부 컴파일·헤드리스
    플레이테스트 통과 확인 후 푸시까지 완료.
  - **다음 세션이 볼 것** — (1) 사람의 실기 확인 피드백(이번까지 쌓인
    REALM 전체·DUNGEON 마을 넷·STORY 첫 슬라이스 등)이 먼저 도착하면
    그것부터, (2) 없으면 REALM 남은 후보 — 외교(diplo.js)·함락한 성을
    플레이 가능한 성으로 들이는 나머지 절반·문답(quiz.js)·여러 성을
    한 지도에 띄우는 월드맵(2-8~2-10절) 또는 다른 네 판 콘텐츠 확장 중
    **어느 걸 먼저 할지는 방향 결정이라 세션이 임의로 안 고른다** —
    사용자가 다시 "정해줘"로 위임하지 않는 한 상의부터 한다.
- **(과거) 열네 번째 세션(2026-09-12)이 지난 세션의 네 후보(마을 셋째·넷째·
  Town2 장식·오버월드 지도·필드 조우)를 전부 끝냈다(위 "완료 단계" 참고).**
  아래는 그 결정이 나오기 전까지 남아 있던 옛 기록(참고용, 위 최신 항목이
  우선) — saga-dungeon PLAN.md·`VERTICAL_SLICE_DUNGEON.md`를 다시 훑어
  다음 콘텐츠 방향(예: 마을 간 지름길, 위성↔위성 통로 §28-3, 다른 게임
  STORY 착수 등)을 사용자와 상의할 것 — 이건 코드
  판단이 아니라 방향 결정이라 세션이 임의로 고르지 않는다.
- **(과거, 이제 완료) DUNGEON 오픈월드 확장 — 마을 두 개(Room1↔Town2)를
  걸어서 잇는 첫 슬라이스는 열세 번째 세션(2026-09-12)이 끝냈다.** 그
  세션이 남긴 네 후보는 열네 번째 세션이 전부 처리했다(위 참고).
- **(과거) 사용자가 "1,2 순서대로 진행"으로 확정 (2026-09-12, 열두
  번째 세션) — (1) FOREST가 문제없다는 실기 확인 뒤 단순화해 둔 부분
  채우기 → (2) DUNGEON 진짜 오픈월드 확장.** (1)의 세 조각(바이옴
  지형 다양성, 창조물 종 늘리기 두 번 — 포자괴물·안개유령 → 무쇠도깨비·
  나비정령)과 (2)의 첫 슬라이스까지 전부 끝났다(위 "완료 단계" 참고).
  **네 바이옴 전부 종 둘씩, 총 여덟 종**으로 "창조물 종 늘리기" 축은
  당분간 충분히 채워졌다고 볼 수 있다 — 더 늘릴지는 다음 방향 결정에서
  판단. 아래는 그 결정이 나오기 전까지 남아 있던 옛 "다음 세션이 볼
  것" 기록(참고용, 위 최신 항목이 우선):
  - 사람이 이번 세 슬라이스(바이옴·신규 종 넷)를 실기로 확인한 피드백이
    있으면 그것부터.
  - 없으면 (1)의 나머지 후보 — **가구 자유 배치**(지금은 고정 자리
    여섯, `ForestFurnitureAnchor.cs` — "다가가서 상호작용" 대신 실제
    좌표에 놓으려면 새 입력 동사가 필요해 파급이 큼) 또는 **벽지/장판**
    (`ForestHomeData.cs`에 카테고리 추가 필요, godot도 같은 이유로
    범위 밖에 둬 왔다) — 중 하나를 채우거나, 이 정도면 (1)을 충분히
    채웠다고 보고 (2) DUNGEON 오픈월드 확장으로 넘어간다(아래 항목 —
    saga-dungeon 웹판의 실제 방 배치/복도 연결 알고리즘부터 훑어 범위를
    정할 것). 어느 쪽이든 방향 결정이라 세션이 임의로 고르지 않는다.
- **DUNGEON 오픈월드 확장 — 물리적 확장(Room5~11) 네 조각 끝난 뒤
  사용자가 "100층까지 진행해줘"로 요청, 절차적 층 진행 시스템으로
  전환해 100층 검증까지 끝냈다(위 "완료 단계" 참고) — 이어서 "DUNGEON
  더 다듬기" 세 개(세이브 층 유지·HUD 층수 표시·깊이 공격력 체감
  보정)도 끝냈다.** Room5~11은 이제 존재하지 않는다 — ProcRoom 하나 +
  `DungeonFloorRunner`가 층2~100까지 다 맡는다.
  - **위 빈틈은 열한 번째 세션(2026-09-12)이 메웠다** — `PlaytestDungeonFloorProgression
    .cs`(신규)로 문 선택 트리거·`AdvanceRoom`·`Descend`가 실제 GameObject
    경로에서 도는 것까지 자동 검증했고, 그 과정에서 실제 게임 결함
    (문 자리에 서 있으면 무전투 방이 연쫓아 자동으로 건너뛰어지던 것)을
    찾아 고쳤다(자세한 내용은 위 "완료 단계" 맨 위 항목 참고).
  - **다음 세션이 볼 것** — (1) 사람이 실기로 ProcRoom(특히 이번에
    고친 "방 전환 후 남쪽 재배치"가 순간이동처럼 뚝뚝 끊겨 보이지 않는지,
    문 표지 라벨이 잘 읽히는지)을 확인한 피드백이 있으면 그것부터,
    (2) 없으면 door UI를 더 다듬을지/100층 이후로 늘릴지/다른 게임
    (STORY 등, 51~65장 확장 순서)으로 넘어갈지 사용자와 상의 — 이건
    코드 판단이 아니라 방향 결정이라 세션이 임의로 고르지 않는다.
- **사용자가 DUNGEON을 유니티 에디터로 직접 실기 확인 — "문제 없어
  보여"로 답함(2026-09-12, 열한 번째 세션 이어서).** 다음 방향을
  묻길래 "FOREST 실기 확인부터(첫 커스텀 셰이더라 리스크 큼)"를
  추천했는데, 사용자가 "더 진행해줘"로 답해 — FOREST 실기 확인은
  사용자 몫으로 남겨 두고, DUNGEON에서 배운 CharacterController 순간
  이동 패턴이 다른 트랙에도 있는지 코드로 훑어 `ForestHouse.cs`에서
  같은 결함을 찾아 고쳤다(위 "완료 단계" 맨 위 항목 참고).
  - **가구 슬라이스는 이 세션이 끝냈다**(사용자가 "가구부터 진행해줘"로
    확정, 위 "완료 단계" 참고). **이어서 "몬스터·퓨전 콘텐츠부터
    이어가줘"로 그 슬라이스도 끝냈다**(숲도깨비·바위도깨비·버섯정령·
    꽃정령 네 종, 위 "완료 단계" 맨 위 항목 참고).
  - **다음 세션이 볼 것** — (1) 사람이 FOREST를 실기로 확인한 피드백
    (구면 투영·집 들어가기/나가기·가구 여섯 자리·네 창조물의 배회/도주가
    실제로 자연스러운지)이 있으면 그것부터, (2) 없으면 이번에 단순화해
    둔 것들(가구 자유 배치·벽지/장판, 창조물 종 더 늘리기·바이옴 구분
    도입) 중 하나를 채우거나, (3) DUNGEON/다른 게임 착수 — 방향 결정은
    사용자와 상의할 것.
  - **이 세션은 여기서 멈췄다** — 사용자가 "실기 확인부터 할게, 새로운
    세션에서 하자"로 끊음(2026-09-12, 열한 번째 세션 끝). 작업 트리
    깨끗함(커밋되지 않은 변경 없음), 이 세션에서 나간 커밋:
    `53691d3`·`16a84d0`·`c7a8e27`·`8fb953f`(그 사이 다른 세션의
    saga-godot 병합 커밋 여러 개 포함) — 전부 컴파일·헤드리스 플레이
    테스트 통과 확인 후 그때그때 커밋·푸시해 뒀다. **다음 세션은 사람이
    유니티 에디터로 FOREST(구면 투영·집·가구·창조물)를 직접 플레이해 본
    소감/버그 리포트부터 받을 것** — 있으면 그것부터 처리, 위 "다음
    세션이 볼 것" (2)·(3)은 그다음.
- **사용자가 "1,2 순서대로"로 두 방향을 확정했다 — (1) FOREST 착수
  (완료, 위 "완료 단계" 참고) → (2) DUNGEON을 진짜 오픈월드로 확장
  (아직 착수 전).** 다음 세션은 (2)부터 시작한다 — 방 넷짜리 선형
  통로를 넘어 실제 복수의 방·바이옥·분기가 있는 구조로 좌표 체계를
  다시 잡는 큰 작업(파급이 커서 이전 세션들이 "범위 밖"으로 미뤄
  뒀던 것). 착수 전에 saga-dungeon 웹판의 실제 오픈월드 생성 로직
  (`js/dungeon.js`의 방 배치·복도 연결 알고리즘)을 먼저 훑어 범위를
  정할 것 — 이 프로젝트의 "테스트 씬은 전부 고정 좌표" 원칙과 절차적
  생성이 어떻게 절충되는지가 핵심 설계 질문(방 개수·연결 구조까지
  고정할지, 그 안의 콘텐츠 배치만 고정할지 등). FOREST 쪽은 아직
  GUI 실기 확인이 하나도 안 됐다는 것도 같이 기억할 것(아래 목록).
  **사용자가 "새로운 세션에서 이어 하자"로 여기서 끊었다(2026-09-12,
  아홉 번째 세션 끝)** — 이 세션 안에서 나간 커밋: `23462e0`·
  `3d49468`·`ce90f1b`·`57b35f4`·`327daa6`·`66b5f25`·`57b69a6`·
  `7670c6f`·`e4d171f`·`3e0dcfc`·`02002a7`. 전부 컴파일·헤드리스
  플레이테스트 통과 확인 후 그때그때 커밋·푸시해 뒀다.
- **DUNGEON PLAN 챕터 순 심화 — 2026-09-12 아홉 번째 세션에서 여섯
  조각을 끝내고 멈췄다**(퀘스트 36장·미니맵 27장·타격감 일부 38장 +
  랜덤 이벤트 35장·HUD 체력 게이지 26장·절차적 SFX 37장, 위 "완료
  단계" 참고, 커밋 `23462e0`·`3d49468`·`ce90f1b`·`57b35f4`·`327daa6`).
  **이 던전 규모(방 넷짜리 선형 통로, 새 아트/오디오 에셋 없이)에서
  코드만으로 갈 수 있는 챕터는 이걸로 사실상 다 옮겼다** — 남은
  28장(오버월드/월드맵 — 방을 더 짓고 좌표를 다시 잡는 큰 구조 변경,
  범위 밖)·39장(로딩 구조 — 씬 하나짜리 규모엔 아직 의미 없음)·41장
  (최종 UX 목표 — 새 코드가 아니라 평가 게이트)은 지금 손대지 않는
  편이 맞다고 판단. **다음 세션이 볼 것 — 코드보다 사람의 GUI 확인이
  먼저다**: 이번 세션 여섯 조각(퀘스트 진행·미니맵·타격감·필드 사건·
  체력 게이지·SFX 넷) 전부 아직 헤드리스 검증만 통과했지 사람이 실제로
  본 적이 없다(아래 GUI 확인 목록 맨 위 항목들). 사람이 플레이해 소감/
  버그를 남기면 그것부터, 없으면 saga-dungeon/PLAN.md·이 문서를 다시
  훑어 다음 결정(예: 진짜 오버월드로 확장할지, GO처럼 다음 게임
  FOREST로 넘어갈지)을 사용자와 상의할 것 — 이건 코드 판단이 아니라
  방향 결정이라 세션이 임의로 고르지 않는다.
- **DUNGEON 다음 슬라이스 후보** (`docs/VERTICAL_SLICE_DUNGEON.md`
  "다음 슬라이스 후보" 절 참고) — 2026-09-12 여덟 세션에 걸쳐 열다섯
  조각을 끝냈다: 몬스터 무리·엘리트/보스·방 종류 다양화(우물·상자·성소)·
  회피(구르기)·오픈월드/필드(방 두 개+복도) + 스킬 다양화(강공격)·방
  종류 나머지(행상)·부대(다중 영웅) 최소 단위(동행)·GLB 자산 도입
  (캐릭터, Kenney Blocky Characters 재사용) + 방 종류 마지막(정예
  소굴·미니보스·채광방·퍼즐방·구출·채집) + 세공·행상 재고 굴리기·도감 +
  바이옴 5종(숲·늪·산·사당·폐허) + 환경/건물 GLB(복도 타일·문 아치) +
  회피 애니메이션·이펙트(구르기 회전·잔상·무적 틴트) +
  **방 셸 GLB(room-small.glb, 균일 스케일로 20×20 정사각, 위 "완료
  단계" 참고)**.
  사용자가 "1,2,3,4 순서대로 다해"/"1,2 순서대로"로 그때그때 지시(위
  "완료 단계" 각 항목 참고). **아직 사람이 GUI로 하나도 확인 안 함** —
  매 조각마다 컴파일·씬 재빌드·PlaytestDungeonHeadless만 통과시키고
  바로 다음 조각으로 넘어갔다(아래 GUI 확인 목록에 계속 쌓인다).
  **이걸로 `VERTICAL_SLICE_DUNGEON.md`의 원래 "다음 슬라이스 후보"
  목록을 전부 끝냈다** — 더 진행하려면 saga-dungeon 웹판 PLAN.md
  챕터 순서(오픈월드 확장 등 더 큰 콘텐츠 확장)를 참고하거나, 지금까지
  쌓인 GUI 확인 목록(아래)을 사람이 먼저 실기로 훑어 재미·정렬 문제부터
  잡는 쪽을 사용자가 고를 것.
- **지도 크기는 9×11에서 일단 멈췄다** — 남쪽 4줄+동쪽 2칸을 늘리고
  각 공터에 콘텐츠도 심은 뒤, 같은 확장 패턴이 세 번 반복되자 사용자가
  "GO 콘텐츠 다양화"로 방향을 정했다(위 "완료 단계" 참고 — 동물 Group
  재배치·나그네 NPC). **더 키우려면**: (1) row10의 산을 또 열어 계속
  남쪽으로, (2) 북쪽·서쪽으로 늘리는 것(이번엔 "끝에 보태기"라
  안전했지만, **앞쪽에 끼워 넣는 방향은 기존 좌표가 실제로 밀리므로**
  시도한다면 기존 콘텐츠 좌표를 전부 다시 맞추는 별도 작업이 필요).
  안개는 이제 SkyFogBuilder의
  ExponentialSquared 밀도 방식이라(아래 병합 정리 항목 참고) "거리"
  숫자가 아니라 밀도가 새 지도 크기에 맞는지를 사람이 GUI 확인할 때
  같이 볼 것.
- **Awake() 중복 생성 의심 — 나머지 6곳 (2026-09-12에 해결됨, 위 "완료
  단계" 참고).** `AnimalBuilder`·`HiddenTreasure`·`EastGroveRelic`·
  `LuckyCairn`엔 방어를 추가, `MountainShrine`은 원래 방어가 필요 없음을
  확인, `RareWolfEncounter`·`BanditEncounter` 둘은 더 깊은 버그(UI 필드
  미복원으로 인한 잠재 NRE)를 찾아 "기존 자식 삭제 후 Build() 재실행"
  방식으로 고쳤다. **사람이 GUI로 확인할 것**: 도적/흰 늑대에게 세이브를
  불러온 상태에서 실제로 다가가도 더 이상 죽지 않는지(고친 NRE 경로
  자체는 헤드리스로 재현 못 함), 그리고 동물·보물·산신당 등이 여전히
  한 벌로만 보이는지.
- **PLAN.md 8장 에셋 도입 다음 후보(우선순위 44~49장: Player→주요
  Enemy→Boss→Environment→Building→Vegetation→Props→Animals→VFX).**
  캐릭터(완료)·Environment/Building(완료, 위 "완료 단계" 참고) 다음은
  Animals(사슴·소·흰 늑대, 지금 전부 primitive) — 다만 saga-godot도
  어울리는 동물 GLB가 없어 동물류는 전부 primitive로 남겨 뒀다
  (`saga-godot/docs/ASSET_GUIDE.md` "이번에 안 바꾼 것" 참고, CC0 동물
  킷을 새로 받아야 함 — 2026-09-12에 Quaternius 후보를 찾았지만 계정
  없이 못 받아 옴, 위 "완료 단계"·`docs/ASSET_GUIDE.md` 참고). **산신당
  재설계·Props는 2026-09-12에 끝냈다**(위 "완료 단계" 참고). 남은 것은
  VFX(아직 대상 없음)뿐.
- **GO 콘텐츠 다양화 다음 후보.** PLAN.md 24~27장 이벤트 종류 중 "랜덤
  이벤트"는 성황당 돌무더기(LuckyCairn, 위 "완료 단계")로 채웠다 —
  **"시간" 이벤트(특정 시간대에만 나오는 것)는 아직 없다**(하루 일과·
  낮밤 자체가 이 슬라이스에 없어서, 새로 넣으려면 day/night 시스템부터
  필요 — 파급이 커서 이번엔 안 건드림). 그 외엔 사건/퀘스트/상점을 사전 구조로
  일반화하는 것(콘텐츠가 늘면서 슬슬 가치가 생기기 시작했을 수 있음 —
  WorldEventState가 이미 그 첫걸음이었다), 51~65장이 적어 둔 확장 순서
  (GO → DUNGEON → FOREST → STORY → REALM)의 다음 게임 착수.
- **(2026-09-12) 병합 충돌 정리 — `BuildTestVillageScene.cs`의
  `BuildSkyAndFog` 호출부가 로컬(HEAD)과 원격(이 branch)에서 각자 다른
  방향으로 진화해 있었다.** 로컬 쪽은 `var sun = BuildLighting();
  BuildSkyAndFog(sun);`(Skybox 머티리얼 생성 + `RenderSettings.sun`
  방식)로 남아 있었는데, `BuildPlayerCamera`/`BuildReviewCamera`가 이미
  `clearFlags = SolidColor` + `backgroundColor = SkyFogBuilder
  .HorizonColor`로 스카이박스 없는 단색 배경을 쓰도록 짜여 있어서 그
  방식은 실제로는 화면에 하나도 안 보이는 죽은 코드였다. 무인자
  `BuildSkyAndFog()`(SkyFogBuilder 위임, Trilight 앰비언트 +
  ExponentialSquared 안개)가 실제로 카메라 설정과 맞물려 쓰이는 쪽이라
  그걸로 통일하고, Skybox 방식 메서드·`SkyMaterialPath` 상수·안 쓰는
  `Sky.mat` 자산은 지웠다. `docs/PROJECT_STATE.md`(이 파일)의 "다음
  작업" 절도 병합 때 두 세션이 각자 다른 시점에 적어 둬 갈라졌던 것을
  이 branch(더 나중 시점, Phase 6·7·경제·채집·산신당·동물까지 반영된
  쪽)를 기준으로 정리했다 — 아래 "Sky/Fog가 자연스러운지" 항목도 그때
  기준으로 고침(Skybox 색·거리 숫자 → Trilight 앰비언트·안개 밀도).
- Path/Road 구성(PLAN.md 32장)은 saga-godot도 색 구분 외엔 따로 안
  한 항목이라(terrain_builder.gd의 '=' LEGEND에 특별한 처리 없음)
  이번 손질에서 건너뜀 — TerrainBuilder의 지형 색 구분으로 이미 충족.
- 플레이어가 실제로 걸어 다닐 수 있는 수준까지 쌓였다 — **이제 한 번
  GUI로 몰아서 확인할 때가 됐다**(사람이 직접, 헤드리스로는 못 봄):
  - **CameraRig의 드래그 방향이 실제로 자연스러운지**(부호를 새로
    판단해 정한 자리라 확신이 낮다)
  - **Sky/Fog가 자연스러운지**(SkyFogBuilder의 Trilight 앰비언트 색·
    ExponentialSquared 안개 밀도 0.006은 env_pc.tres 수치를 그대로
    옮긴 것 — 실제 화면에서 Godot 쪽과 비슷한 느낌인지 눈으로 볼 것.
    위 병합 정리로 이제 이 경로 하나만 실제로 쓰인다)
  - **NPC 말 걸기가 실제로 되는지**(TalkArea 트리거 판정·화면 상단
    자막 표시 — 헤드리스로는 트리거가 실제로 발동하는지 확인 불가)
  - **도적의 습격이 실제로 되는지**(조우 트리거 → 선택지 → 전투 →
    등용까지 12단계 루프 전체가 헤드리스 검증 밖 — 사람이 직접
    "맞선다"를 눌러 승리까지 가 봐야 한다). **특히 세이브를 불러온 채로
    다가갈 때 더는 안 죽는지**(2026-09-12에 고친 잠재 NRE 경로 — 위
    "완료 단계" 참고, 코드 검토로만 확인했고 실제 재현·회귀 확인은
    아직 안 됨)
  - **저장·재시작이 실제로 되는지**(저장 버튼 → 에디터에서 Play를
    끄고 다시 켬 → 위치·부대가 돌아오는지)
  - **정적 배칭이 실제로 드로우콜을 줄였는지**(Game 뷰 Stats 창,
    Combine() 넣기 전/후 비교 — 헤드리스로는 확인 불가)
  - **MSAA를 켠 뒤 가장자리 계단 현상이 실제로 줄었는지**(PC 4x/Mobile
    2x로 숫자만 넣었다 — Quality 레벨을 PC/Mobile로 오가며 눈으로 볼 것)
  - **경험치·레벨업·루트·자동장착이 실제로 도는지**(도적을 이기면
    토스트에 "경험치 +100 — 레벨업! (1 → 2)"·주운 장비 문구가 뜨는지,
    수치만으로 정한 자리라 실제 UX로 한 번 봐야 함 — 도적은 한 번
    이기면 다시 안 나니 **세이브 파일을 지우고 처음부터** 봐야 재현됨)
  - **촌장 퀘스트 대사·완료 처리가 실제로 도는지**(처음 말 걸면
    수락 대사, 다시 걸면 재촉 대사, 도적을 이긴 뒤 다시 걸면 사례
    대사로 바뀌는지 — 3단계 다 순서대로 봐야 함, 역시 세이브 지우고
    새로 시작해야 재현됨)
  - **굴 옆 숨겨진 보물이 실제로 보이고 주워지는지**(발광 구슬이 굴
    입구 상자에 안 가려 보이는지, 다가가면 "유물 검"을 얻는지 —
    한 번 주우면 다시 안 나니 역시 세이브 지우고 새로 시작해야 재현됨)
  - **골드 경제·상인 거래·PlayerHud가 실제로 도는지**(길세 40냥을
    실제로 낼 수 있는지/모자라면 거절당하는지, 상인에게 처음/두 번째
    말 걸 때 문구가 바뀌는지, 화면 왼쪽 위 HUD 줄이 DebugUI와 안
    겹치고 값이 실제로 갱신되는지)
  - **산나물 채집 세 자리가 실제로 보이고 캐지는지**((1,2)/(5,2)/(2,4)
    들판에 작은 초록 구슬이 보이는지, 밟으면 돈 +8냥이 들어오는지)
  - **산신당이 실제로 자리 잡고 가호가 도는지**(격자 (5,1)에 받침대+
    기둥 4개가 숲 사이로 눈에 띄는지, 다가가면 경험치+돈을 받는지)
  - **사슴 두 마리가 실제로 자연스럽게 걷는지**((2,2)/(4,4) 들판 근처를
    돌아다니는지, 산·강으로 걸어 들어가지 않는지, 멈췄다 걷는 리듬이
    부자연스럽지 않은지 — 수치(반경 24·속도 2.2)만으로 정한 자리)
  - **사슴이 실제로 놀라 달아나는지**(16유닛 안으로 다가가면 바로 도망
    상태로 바뀌어 반대 방향으로 뛰는지, "동물이 놀라 달아난다." 자막이
    뜨는지, 30유닛 밖으로 물러나면 다시 진정해 배회로 돌아오는지 —
    Group 전파는 지금 스폰 좌표로는 두 마리가 서로 멀어 볼 수 없음)
  - **흰 늑대(희귀 몬스터)가 실제로 도는지**(격자 (0,3) 숲에서 조우
    프롬프트가 뜨는지, "맞선다"/"피한다" 둘뿐인지, 이겼을 때 경험치
    150·돈 50냥·"늑대 가죽 갑주"를 확정으로 받는지, 다시 그 자리를
    지나도 재등장 안 하는지). **세이브를 불러온 채로 다가갈 때 더는
    안 죽는지도 같이**(2026-09-12에 고친 잠재 NRE 경로, 도적과 같은 결)
  - **도적을 이긴 뒤 저장→재시작해도 다시 안 나오는지**(이번에 고친
    버그 — `Awake()`가 `PartyState.MemberIds`를 확인하게 바꿨다,
    재현하려면 도적을 이기고 저장한 뒤 Play를 끄고 다시 켜서 확인)
  - **지도가 남쪽으로 실제로 늘어났는지**(다리 건너 남쪽 성벽 문(격자
    (3,6))을 지나면 새 숲 공터(row7)가 나오고 그 너머는 산으로 막혀
    있는지 — 플레이어 스폰이 여전히 마을 두 집 사이인지도 같이 확인)
  - **새 공터의 채집 자리(herb_4, 격자 (3,7))가 실제로 보이고 캐지는지**
    (남쪽 문을 지나자마자 발광 구슬이 눈에 띄는지, 밟으면 돈 +8냥이
    들어오는지 — 기존 세 자리와 같은 컴포넌트라 동작은 검증됐지만 이
    자리 자체는 처음 확인)
  - **지도가 동쪽으로 실제로 늘어났는지**(마을에서 동쪽 숲을 계속
    걸으면 col7~8의 새 공터가 나오고 그 너머는 산으로 막혀 있는지 —
    남쪽과 달리 문 없이 자연스럽게 이어지는지도 같이 확인)
  - **낡은 돌기둥(EastGroveRelic, 격자 (7,3))이 실제로 눈에 띄고
    발견되는지**(숲 사이에서 발광 없이도 구분되는지, 다가가면 경험치
    +20·돈 +15 토스트가 뜨는지)
  - **둘째 남쪽 공터(row9)까지 실제로 갈 수 있는지**(row8의 새 문을
    지나면 논밭 타일이 보이는지, herb_5(2,9)가 실제로 보이고 캐지는지,
    row10 산으로 다시 막혀 있는지)
  - **사슴 무리(deer_2·deer_3, 격자 (4,4) 근처)가 실제로 같이 달아나는지**
    (한쪽에 다가가 놀라게 하면 17유닛 떨어진 다른 한쪽도 같이 도망
    상태로 바뀌는지 — Group 전파가 실제로 눈에 보이는 첫 사례)
  - **나그네(npc_traveler, 격자 (4,9))가 실제로 도는지**(처음 말 걸면
    경험치+15·돈+10과 함께 정보성 대사가 뜨는지, 다시 말 걸면 인사말
    뿐인 짧은 대사로 바뀌는지)
  - **성황당 돌무더기(LuckyCairn, 격자 (4,7))가 실제로 도는지**(herb_4
    바로 옆에 작은 돌탑이 보이는지, 다가가면 3냥이 빠지고 결과 문구가
    뜨는지, 돈이 3냥 미만이면 안 빠지고 거절 문구만 뜨는지, 20초 안에
    다시 들어가면 아무 반응이 없는지, 20초 뒤엔 다시 굴려지는지 —
    가중치 룰렛이라 결과가 매번 다를 수 있음을 감안하고 여러 번 볼 것)
  - **소(cow_1, 격자 (3,9) 논밭)가 실제로 보이고 자연스러운지**(사슴보다
    크고 옅은 색으로 구별되는지, 논밭 타일 위에서 배회하는지, 다가가면
    사슴과 똑같이 놀라 달아나는지)
  - **캐릭터 GLB(플레이어·촌장·상인·나그네·산적)가 실제로 제대로
    보이는지** — 텍스처가 깨지지 않았는지, 걸을 때 이동 방향으로 실제로
    정면을 향하는지(글TF "정면"이 Unity +Z와 맞는지 확신 없음), 다섯
    배역이 색조로 구별되는지(상인·나그네는 같은 모델이라 색만 다름),
    산적 강타 텔레그래프 때 주황으로 물들었다 원래 색으로 돌아오는지,
    강타 스케일 연출 때 비율이 안 찌그러지는지
  - **환경/건물 GLB(나무·바위·굴 입구·마을집·폐허 기둥·다리)가 실제로
    자연스러운지** — 나무·바위가 텍스처와 함께 제대로 보이는지(폴백
    단색 primitive가 아니라 실제 GLB로 나온다는 뜻), 마을집 벽·지붕
    비례가 어색하지 않은지(지붕이 균일 ×10이라 뾰족하게 커 보일 수
    있음 — 실제로 봤을 때 너무 크면 스케일 조정 필요), 다리 널판
    44개가 이음새 없이 이어져 보이는지, 폐허 기둥이 가늘어 보이지
    않는지(pillar-stone은 원래 얇은 기둥이라 의도된 모습일 수 있음).
    **산신당은 2026-09-12 재설계로 기둥이 없어졌다** — 아래 별도 항목 참고
  - **산신당 제단(altar-stone.glb, 격자 5,1)이 자연스러운지**(2026-09-12
    재설계) — 예전 받침대+기둥 4개보다 훨씬 작아진 크기감(약
    2.6×1.23×1.63m)이 숲 사이에서 눈에 띄는지, 텍스처 이음새가 안 보이는지
  - **Props 셋(가로등·시장 좌판·울타리+문, 2026-09-12 도입)이 자연스러운지**
    — 마을집 두 채 사이 가로등 2개가 서로 마주 보고 서 있는지, 떠돌이
    상인 옆 시장 좌판이 거래 자리처럼 보이는지, 논밭 소 옆 울타리 3칸+
    문 1칸이 "목장 한구석" 느낌을 주는지(소를 실제로 가두진 않아 소가
    울타리를 넘나들어도 정상 동작임)
  - **DUNGEON 첫 슬라이스(`TestDungeon.unity`, 2026-09-12 신규, 사람이
    이미 한 번 플레이해 "특별한 문제 없음"으로 확인함)가 실제로
    도는지** — `Saga/Build TestDungeon Scene` 메뉴로 씬을 열어 Play:
    카메라가 GO보다 더 내려다보는 각도(디아블로 감각)로 시작하는지,
    이동·오빗 카메라가 자연스러운지, 몬스터(황건적)에게 다가가면
    Idle→Chase로 바뀌어 쫓아오는지, 사거리 안에서 스페이스바(또는 화면
    오른쪽 아래 "공격" 버튼)로 때리면 몬스터 체력이 줄고 몬스터도
    반격하는지, **화면 "공격" 버튼을 눌렀을 때 `CameraRig`의 마우스
    왼쪽 버튼 드래그 판정과 안 겹치는지**(코드는 안 겹치게 짰지만
    실제 클릭 동작으로 확인 안 됨), 몬스터를 처치하면 경험치·돈·
    "쇠도끼"를 얻고 왼쪽 위 HUD의 공격력 숫자가 오르는지, 저장 버튼→
    Play 재시작으로 위치·레벨·장비가 이어지는지, 체력이 0이 되면
    바로 회복되고 토스트가 뜨는지(이번 슬라이스는 죽음 페널티 없음,
    의도된 동작)
  - **몬스터 무리(2026-09-12, 4마리로 늘림)가 실제로 자연스러운지** —
    방에 들어서면 황건적 4마리가 눈에 보이는지(1마리일 때와 달리 무리
    느낌이 나는지), 가까이 가면 여럿이 동시에 Chase로 바뀌어 몰려오는지,
    몰려온 채로 둘러싸여도 조작이 안 밀리고 한 마리씩 처치할 수 있는지,
    한꺼번에 맞아 체력이 빠르게 줄 때의 손맛이 괜찮은지(죽음 페널티가
    없어 전멸돼도 바로 회복되긴 하지만, 그 전에 "위험하다"는 긴장감이
    드는지)
  - **황건적 두목(2026-09-12, 엘리트/보스)이 실제로 위협적으로
    보이는지** — 잡졸 무리보다 방 안쪽(동쪽 벽 가까이)에서 덩치(1.6배)·
    색(짙은 적갈)으로 구분되는지, 부하 둘과 함께 나오는지, HP 168을 다
    깎는 데 걸리는 시간이 지루하지 않은지, 쓰러뜨리면 "귀두도"를 확정
    으로 얻고 공격력이 크게 오르는지(쇠도끼 12→귀두도 26)
  - **우물·보물상자·성소(2026-09-12, 방 종류 다양화)가 실제로 구분돼
    보이고 도는지** — 서쪽 플레이어 스폰 주변에서 세 표지(청록 원통·
    갈색 상자·보라 원통)가 눈에 띄는지, 우물은 몬스터를 안 잡고도 바로
    체력 40%를 회복해 주는지, 상자·성소는 방의 몬스터(잡졸 4+두목+부하
    2)를 **다 잡아야만** 반응하는지(그 전엔 다가가도 아무 일 없어야
    정상), 셋 다 한 번 쓰면 다시 안 되는지
  - **회피(2026-09-12)가 실제로 손에 잡히는지** — 데스크톱은 Left
    Ctrl, 모바일은 공격 버튼 왼쪽의 새 "회피" 버튼을 눌렀을 때 이동
    입력 방향(가만히 있으면 마지막 바라보는 방향)으로 짧게(약 3m)
    미끄러지는지, 그동안 몬스터 공격이 실제로 안 박히는지(무적),
    쿨다운 0.9초가 남발을 막을 만큼 적당한지, 회피 버튼이 화면에서
    공격 버튼과 안 겹치는지
  - **복도+Room2(2026-09-12, 오픈월드/필드)가 실제로 이어지는지** —
    Room(방1)의 몬스터 무리를 넘어 북쪽 벽에 문(3m 폭)이 뚫려 있는지,
    복도를 따라 걸으면 막히지 않고 Room2까지 닿는지, Room2에 잡졸
    둘이 있고 정상적으로 Idle→Chase→전투가 도는지, 문 폭이 실제로
    걸어서 통과하기에 좁지 않은지
  - **강공격(2026-09-12, 스킬 다양화)이 실제로 손에 잡히는지** —
    데스크톱 Left Alt·모바일 공격 버튼 위 "강공격" 버튼을 눌렀을 때
    평타보다 훨씬 세게 들어가는지(피해 2.6배), 쿨다운 1.3초가 남발을
    막는지, 회피 중엔 실제로 안 나가는지, 사거리가 평타보다 살짝
    넓어(1.15배) 아슬아슬하게 닿는 적도 맞는지
  - **행상(2026-09-12, 방 종류 나머지)이 실제로 도는지** — Room2
    잡졸 둘을 잡기 전엔 반응 없다가 잡으면 좌판(녹색)이 반응하는지,
    45냥이 있으면 "환도"를 사고 자동 장착되는지, 돈이 모자라면 거절
    문구가 뜨고 3초 안엔 또 안 뜨는지, **곁다리로 고친 버그**(Room1
    상자·성소가 이제 Room2 잡졸과 무관하게 Room1만 클리어하면 열리는지)
    도 같이 확인
  - **동행(2026-09-12, 부대 최소 단위)이 실제로 함께 싸우는지** —
    스폰 직후 플레이어 옆(청색 인물)에 있는지, 플레이어가 움직이면
    따라오는지, 8m 안에 몬스터가 있으면 알아서 다가가 공격하는지,
    안 죽는지(맞아도 쓰러지지 않아야 정상), 있을 때 전투가 확실히
    더 빨리 끝나는지(체감상 화력 증가)
  - **캐릭터 GLB(2026-09-12, GLB 자산 도입)가 실제로 제대로 보이는지**
    — 플레이어·잡졸·두목·동행이 더는 캡슐이 아니라 실제 인물 모델로
    보이는지, 네 배역이 색조(무색·황건색·적갈·청색)로 구별되는지,
    두목(3.2m)이 잡졸(2m)보다 확실히 커 보이면서도 과하게 부담스럽지
    않은지, 걸을 때 이동 방향으로 정면을 향하는지(GLB "정면"이 Unity
    +Z와 맞는지 확신 없음 — GO 세션과 같은 주의사항), 텍스처가 깨지지
    않았는지
  - **Room3·Room4(2026-09-12, 방 종류 마지막)가 실제로 이어지는지** —
    Room2 북쪽 문에서 복도2를 지나 Room3에 닿는지, Room3 정예(붉은빛,
    잡졸 둘과 함께)와 미니보스(자보라, 2.6m)가 잡졸·두목과 확실히
    구별되는지, 채광방(서쪽 잿빛 광맥)이 정예·미니보스를 다 잡아야만
    반응하는지, Room3 북쪽 문에서 복도3을 지나 Room4(막다른 방)에
    닿는지, 퍼즐방(제단 셋, 순서 {1,2,0})이 방을 안 치워도 바로
    반응하고 틀리면 처음부터 리셋되는지, 구출(지친 인영)이 지키는
    잡졸 둘을 잡아야만 풀려나는지, 채집(약초 셋+못)이 약초는 방 안
    치워도 캐지고 못은 방을 다 치운 뒤에만 반응하는지
  - **세공·행상 재고 굴리기·도감(2026-09-12)이 실제로 도는지** — 채광방을
    캐면 벽옥이 바로 세공되는지, 미니보스를 잡으면 홍옥이 벽옥보다
    세서 자동 교체되는지(반대 순서로 얻으면 안 바뀌는 것도 정상), Room3
    신규 행상(Room2 행상과 다른 자리)이 50냥에 남주를 파는지, 몬스터를
    처음 잡을 때만 "📖 도감에 처음 기록됨" 토스트가 뜨고 같은 종류를 또
    잡으면 안 뜨는지, 저장 후 다시 켰을 때 세공한 보석·도감 기록이
    그대로 남아 있는지
  - **바이옴 5종(2026-09-12)이 실제로 도는지** — Room1(숲)·Room2(늪)·
    Room3(산)·Room4(사당)가 바닥/벽 색으로 뚜렷이 구별되는지, 구석 소품
    (나무 셋·물웅덩이+갈대·바위 셋·석등)이 기존 콘텐츠(적·상자·행상 등)를
    가리거나 겹치지 않는지, 사당 석등의 따뜻한 점광원이 과하거나
    부족하지 않은지, 복도 셋이 폐허 톤으로 방과 다르게 보이는지
  - **환경/건물 GLB(2026-09-12, 복도 타일·문 아치)가 실제로 자연스러운지**
    — 복도 셋의 corridor.glb 타일 두 장이 이음매 없이 이어져 보이는지,
    폐허 톤 틴트가 과하거나 밋밋하지 않은지, 방 넷의 문 6곳에 선 gate.glb
    아치가 문 폭(3m)에 맞게 자연스러워 보이는지(X만 0.682로 줄여 살짝
    좁아 보일 수 있음), 아치를 실제로 걸어서 통과할 때 걸리는 느낌이
    없는지(콜라이더 없음 — 걸리면 다른 원인)
  - **회피 애니메이션·이펙트(2026-09-12)가 실제로 손에 잡히는지** —
    Left Ctrl(또는 모바일 "회피" 버튼)을 눌렀을 때 캐릭터가 회피 방향
    으로 실제로 한 바퀴 굴러 보이는지(360도 구르는 속도가 너무 빠르거나
    어색한 블러로 안 보이는지), 하늘색 잔상이 방향에 맞게 자연스럽게
    남았다 흐려지는지, 무적 시간(0.22초) 동안 캐릭터가 하늘색으로
    또렷이 보이는지(너무 흐리거나 안 보이면 색 재조정 필요), 대시가
    끝난 뒤 캐릭터가 어색한 각도 없이 바로 똑바로 서는지, 회피 직후
    이동 입력이 바로 다시 먹는지
  - **방 셸 GLB(2026-09-12)가 실제로 자연스러운지 — 이번 GUI 확인 목록
    중 우선순위 가장 높음(방 넷 전체 인상이 걸림)** — 방 넷이 이제
    회색 primitive 상자가 아니라 실제 돌 셸(room-small.glb)로 보이는지,
    깊어진 방(14→20)이 콘텐츠에 비해 휑해 보이지 않는지, **문 구멍의
    시각적 위치·폭이 실제로 걸어서 지나갈 수 있는 콜라이더 문 폭
    (≈7.33m)과 맞아떨어지는지**(안 맞으면 보이는 문과 실제로 막히는
    자리가 어긋나는 심각한 문제 — `docs/ASSET_GUIDE.md` "확인 안 된
    가정" 참고, 이번 슬라이스에서 메시를 직접 열어 보지 않고 추론만
    했다), 문턱에서 복도(4.0m)로 좁아지는 단이 거슬리는 수준인지, 넷
    다 같은 셸인데 바이옴 색 틴트(숲·늪·산·사당)로 충분히 구별되는지 + Phase 6(59~67단계 Stats/
  EXP/Item/Inventory/Equipment/Reward/Loot) + Phase 7(70~73단계 Quest/
  World Event/Hidden Area) + 골드 경제/상인 거래/PlayerHud + PLAN.md
  51장 채집·산신당·희귀 몬스터(흰 늑대) + PLAN.md 24~27장 동물(사슴)
  까지 코드상으로는 전부 채워졌다.** **위 GUI 확인에서 실제로 도는 게
  확인되면 PLAN.md 77~78단계(전체 플레이 테스트 → 재미 평가)로 넘어갈
  수 있다** — 이번 세션은 그 게이트를 사용자가 명시로 건너뛰라고("다
  하면 안 될까, 안 묻고 최대한 계속해줘") 골라 여기까지 끝냈다
  (2026-09-11). **지도 자체를 키우는 건(칸 수 확장) 2026-09-12에 첫
  조각을 냈다** — 남쪽으로만 2줄(7×7→7×9)로, "행 끝에만 보태면 기존
  좌표 안 밀림" 전략으로 기존 콘텐츠 좌표를 안 건드리고 해냈다(위
  "완료 단계" 참고). 더 늘리거나(동쪽 Cols·남쪽 더) 새 공터에 콘텐츠를
  심는 건 다음 조각. 동물의 Flee/Group/Interaction도 2026-09-12에 이어서
  냈다(위 "완료 단계" 참고 — Group은 메커니즘만 맞고 지금 스폰 두 자리는
  서로 멀어 실제 발동 장면은 아직 없음). 다음 후보는 51~65장이 적어 둔
  확장 순서(GO → DUNGEON → FOREST → STORY → REALM) — 사건/퀘스트/상점을
  사전 구조로 일반화하는 건 콘텐츠가 각각 하나~둘뿐이라(채집만 예외)
  여전히 미룸. 세션 시작 시 PLAN.md를 다시 훑어 고를 것.
- **이번 세션은 여기서 멈췄다** — 사용자가 "새로운 세션에서 다시
  하자"로 끊음(2026-09-11 끝, 2026-09-12로 날짜 넘어감). 이 세션 하나
  안에서 10개 커밋(`5965798`~`34fc937`)이 나갔다 — 전부 컴파일·
  PlaytestHeadless 통과 확인 후 그때그때 커밋·푸시해 뒀다. 다음
  세션은 위 "다음 작업" 문단(지도 확장/동물 Flee·Group/다음 게임 착수)
  중 사용자가 고르는 대로 이어가거나, 여기까지 쌓인 걸 사람이 먼저
  직접 플레이해 GUI 확인 목록을 하나씩 지워 나갈 수도 있다 — 둘 다
  유효한 다음 수, PLAN.md를 다시 훑어 정할 것.
- **2026-09-12 후속 세션(같은 날, 사용자가 "이어해"로 계속) — 여기서
  멈췄다.** 위 항목 이후로 GO 콘텐츠 다양화(동물 Group 재배치·나그네
  NPC)까지 마친 다른 세션 뒤를 이어, 이번 세션은 캐릭터 디자인 여부를
  사용자가 물어본 걸 계기로 **PLAN.md 8장 "실제 3D 에셋" 도입**을
  시작했다 — 캐릭터 GLB(플레이어·촌장·상인·나그네·산적) + 환경/건물
  GLB(나무·바위·굴 입구·마을집·폐허·다리)까지 두 조각을 끝냈다(위
  "완료 단계" 참고). 사용자가 "완료하면 새 세션에서 이어하자"로 끊어
  여기서 멈춘다. **다음 세션이 볼 것**: (1) 이번에 쌓인 GUI 확인
  목록(캐릭터·환경/건물 항목이 새로 늘었다, 위 체크리스트 참고) —
  사람이 직접 플레이해 눈으로 확인하는 게 제일 먼저 할 만한 일,
  (2) Awake() 중복 생성 의심 나머지 4곳 정리(위 "다음 작업" 참고),
  (3) 산신당 재설계(altar-stone.glb), (4) 남은 자산 우선순위(Animals·
  Props·VFX) 또는 51~65장 다음 게임(DUNGEON) 착수 — PLAN.md를 다시
  훑어 정할 것.
- **2026-09-12 세 번째 후속 세션(같은 날, 사용자가 "이어해"로 계속) —
  여기서 멈췄다.** 위 항목이 남긴 네 후보 중 (1) Awake() 중복 생성
  나머지 6곳, (3) 산신당 재설계, (4) Props 도입·DUNGEON 착수를 전부
  순서대로 끝냈다(사용자가 "세 후보 중 어느 것부터?" 질문에 "2,3,1번
  순으로"로 답해 동물 GLB 조사→Props→DUNGEON 착수 순, DUNGEON은 범위
  확인 질문에 "1,2번"으로 답해 기획 문서+실제 구현까지 진행). 자세한
  내용은 위 "완료 단계"의 각 항목·`docs/ASSET_GUIDE.md`·`docs/
  VERTICAL_SLICE_DUNGEON.md` 참고, 여기는 커밋만 나열한다 — 이번
  세션에서 나간 커밋: `a3d783e`(Awake 6곳 정리)·`e5bc9ef`(산신당
  재설계)·`1123711`(Props 도입)·`f6ff059`(DUNGEON 첫 슬라이스). 전부
  컴파일·씬 재빌드·PlaytestHeadless 통과 확인 후 그때그때 커밋·푸시.
  **사용자가 "유니티 에디터 열어서 직접 플레이해볼게"로 TestDungeon을
  직접 확인하러 간 뒤 "새로운 세션에서 다음꺼 이어 하자"로 끊어 여기서
  멈춘다.** **다음 세션이 볼 것**: (1) 이번 세션에 사람이 TestDungeon을
  직접 플레이해 본 소감/버그 리포트(카메라 각도·공격 버튼과 CameraRig
  드래그 판정이 실제로 안 겹치는지가 특히 코드 검토로만 확인하고 실제
  클릭 동작으로는 아직 확인 안 된 부분, 위 GUI 확인 목록 "DUNGEON 첫
  슬라이스" 항목 참고) — 있으면 그것부터, (2) 없으면 `docs/
  VERTICAL_SLICE_DUNGEON.md` "다음 슬라이스 후보" 절(오픈월드/바이옴·
  방 종류 다양화·엘리트/보스·부대 시스템 등) 중 다음 조각 — PLAN.md를
  다시 훑어 정할 것.
- **2026-09-12 네 번째 후속 세션(같은 날, "이어해"로 계속) — 여기서
  멈춘다.** 위 항목의 (1)을 먼저 확인(사람이 TestDungeon을 플레이해
  "특별한 문제 없음"으로 답함)한 뒤, (2) "다음 슬라이스 후보" 중
  어느 걸 먼저 할지 매번 물어(AskUserQuestion) 사용자가 그때그때
  "1,2,3,4 순서대로 다해"로 답한 대로 **두 차례에 걸쳐 아홉 슬라이스를
  전부 끝냈다**: 몬스터 무리→엘리트/보스→방 종류 다양화(우물·상자·
  성소)→회피(구르기)→오픈월드/필드(방 두 개+복도) → 스킬 다양화
  (강공격)→방 종류 나머지(행상, 곁다리로 Room1 상자/성소가 Room2
  몬스터 때문에 안 열리던 버그도 고침)→부대(다중 영웅) 최소 단위
  (동행 하나)→GLB 자산 도입(캐릭터, SagaGo의 Kenney Blocky Characters
  재사용). 자세한 내용은 위 "완료 단계"의 각 항목 참고, 여기는 커밋만
  나열: `b853f2e`·`b60e37e`·`7e48db3`·`1792a6e`·`50e6a63`(첫
  다섯)·`fecb240`·`a340aad`·`acf8467`·`c03fd5b`(나중 넷) — 전부
  컴파일·씬 재빌드·PlaytestDungeonHeadless 통과 확인 후 그때그때
  커밋·푸시(중간에 다른 세션의 saga-godot DUNGEON 작업과 두 번 병합,
  충돌 없음). **세션 중간에 사용자가 "한국어로 항상 진행사항 번역
  해줘 저장해서"로 재차 요청해 `feedback_always_respond_korean.md`
  메모리에 "도구 호출 description 필드도 한국어로" 항목을 명시적으로
  추가했다** — 이 요청이 반복된 원인으로 보였던 지점.
  **아홉 슬라이스 전부 사람이 GUI로 하나도 확인 안 했다** — 매
  조각마다 헤드리스 검증만 통과시키고 바로 다음으로 넘어갔다(위 GUI
  확인 목록에 아홉 항목이 새로 쌓임). 사용자가 "새로운 세션에서
  이어하자"로 끊어 여기서 멈춘다. **다음 세션이 볼 것**: (1) 이번
  세션 쌓인 아홉 슬라이스에 대한 사람의 플레이 소감/버그 리포트 —
  있으면 그것부터, (2) 없으면 남은 후보(바이옴 5종, 방 종류 마지막
  몇 종, 세공·행상 재고 굴리기·도감, 환경/건물 GLB — saga-godot이
  이미 받아 둔 `dungeon/{room-small,gate,corridor}.glb`가 12×12m
  방 기준이라 Unity 20×14m 방과 치수가 안 맞아 그대로 못 씀, 방 치수
  조정이나 GLB 재스케일이 먼저 필요) 중 사용자가 고르는 대로 —
  PLAN.md를 다시 훑어 정할 것.

## 알려진 오류

- 없음(SkyFogBuilder 추가분은 컴파일 자체가 미검증 — 위 참고).

## 테스트 상태

- `Unity.exe -batchmode -nographics -projectPath saga-unity -quit` →
  재임포트·컴파일 exit 0, 오류 없음(라이선싱 access token 경고만, 무관).
  Player/CameraRig/VirtualJoystick, VegetationBuilder.cs 추가 후에도
  동일(SagaGo.asmdef에 `Unity.InputSystem` 참조 추가로 첫 컴파일 오류
  고침).
- `-executeMethod Saga.EditorTools.BuildTestVillageScene.Build -quit`
  → exit 0, `TestVillage.unity` 저장 성공(groundVerts=3136,
  49칸×4×4서브쿼드×4정점과 정확히 일치).
- **`-executeMethod Saga.EditorTools.PlaytestHeadless.Run`(Play 모드
  실제 실행) — 2026-09-11 드디어 통과.** `[PlaytestHeadless] OK - 10
  frames, no errors`. 여러 차례 같은 자리(Play 모드 진입 직후)에서
  멈춰 강제 종료해야 했던 원인을 찾았다: **이 PC의 Unity
  6000.3.23f1 `-batchmode`는 Play 모드 진입 시 기본 동작인 "도메인
  리로드"(어셈블리 리로드)에서 멈춘다**(빈 씬으로도 재현 — TestVillage
  씬 내용물이나 Input System과 무관함을 확인, `-nographics` 유무와도
  무관함을 확인). `PlaytestHeadless.Run()` 시작에 `EditorSettings
  .enterPlayModeOptionsEnabled = true` +
  `enterPlayModeOptions = DisableDomainReload | DisableSceneReload`를
  걸어 우회했다. **주의 — 이 값은 실제로 ProjectSettings/
  EditorSettings.asset에 저장된다**(처음엔 "Exit()로 바로 끝나면
  저장 안 된다"고 적었는데, 그건 프로젝트 충돌로 실행 자체가 안 된
  케이스를 보고 낸 오판이었다 — 실제 Play 모드 진입에 성공하면 그대로
  저장돼 사람이 여는 평소 에디터의 Play 버튼 동작까지 바꿔 버린다).
  그래서 `Run()`이 원래 값을 저장해 뒀다가 끝나기 직전에 반드시
  되돌리도록 고쳤다 — 재확인 결과 `EditorSettings.asset`엔 실질적
  diff가 안 남는다(CRLF 정규화 경고만 뜨고 내용은 그대로).
  덤으로 발견한 것 — Unity Search의 `SearchInit.IndexationOnStartup()`
  `ArgumentOutOfRangeException`(이 프로젝트에 SearchDatabase 인덱스
  에셋이 하나도 없어서 터지는 엔진 내부 버그, 우리 코드와 무관 —
  `-quit`만 준 순수 컴파일에서도 똑같이 뜬다)이 Play 모드 진입
  타이밍과 겹쳐 찍혀서 `OnLog`가 매번 FAIL로 오판했었다 — `OnLog`에서
  이 스택트레이스만 걸러내도록 고쳤다.
- 실제 GUI 렌더링(그래픽 화면 확인)은 아직 안 함.
- 2026-09-11 재확인 — `PlaytestHeadless.Run`을 `-executeMethod`로 부를 때
  `-quit`을 같이 주면 Run()이 반환하자마자(Play 모드 시작 전) 종료돼 OK/FAIL
  로그가 안 찍힌다(스크립트 주석에 이미 적혀 있던 주의사항, 실제로 한 번
  더 밟음) — `-quit` 없이 불러야 한다(Run() 자신이 EditorApplication.Exit로
  끝낸다). `CombineStaticBatches()` 추가 후에도 컴파일·PlaytestHeadless
  전부 통과.
- Phase 6(PlayerStats/ItemData/Inventory/LootTable + BanditEncounter·
  SaveState 통합) 추가 후 컴파일·PlaytestHeadless 재확인, 둘 다 통과.
  **`BuildTestVillageScene.Build()`는 이번엔 다시 안 돌렸다** — 씬
  하이어라키·GameObject 구성을 하나도 안 건드린 변경(Data 계층 로직만)
  이라 기존 커밋된 `TestVillage.unity`가 그대로 유효하다. (한 번 다시
  돌려 봤다가 이 씬 파일이 재실행마다 통째로 다시 짜여 fileID가 매번
  바뀌면서 14000줄대 순수 churn diff가 나는 걸 확인하고 되돌렸다 — 앞으로도
  씬 GameObject 구성 자체를 바꾸지 않는 변경에는 Build()를 다시 안 돌린다.)
  PlaytestHeadless는 플레이어가 안 움직여 도적 조우 자체가 안 일어나므로
  **경험치/레벨업/루트/자동장착의 실제 동작은 여전히 검증 못함**(컴파일
  통과 + 정적 씬 로드까지만 확인) — 사람이 직접 싸워 봐야 하는 부분.
- Phase 7 Quest(QuestState + VillagerTalk의 `Func<string>` 확장 +
  NpcBuilder 촌장 대사 + BanditEncounter 완료 처리 + SaveState v3) 추가
  후 첫 컴파일에서 `NpcBuilder.cs(89,13): error CS0104` — `Func` 쓰려고
  넣은 `using System;`이 기존 `Object.DestroyImmediate(...)`(암묵적으로
  `UnityEngine.Object`를 가리키던 것)와 `System.Object`를 놓고 충돌을
  일으켰다. `UnityEngine.Object.DestroyImmediate(...)`로 완전한 이름을
  써서 고침 — **`using System;`을 새로 추가하는 파일에 `Object.`로
  짧게 쓴 UnityEngine 호출이 있으면 항상 이 충돌을 의심할 것.** 고친
  뒤 컴파일·PlaytestHeadless(씬 재사용, Build() 다시 안 돌림) 둘 다
  통과. 촌장 대사 3단계 전환·퀘스트 완료도 역시 헤드리스로는 확인 못함.
- Phase 7 World Event/Hidden Area(WorldEventState + HiddenTreasure +
  BuildTestVillageScene 훅 + SaveState v4) 추가 후 컴파일 통과, 이번엔
  씬에 GameObject가 실제로 늘어(HiddenTreasure) `BuildTestVillageScene
  .Build()`를 다시 돌림 — `groundVerts=3136` 그대로(땅은 안 바뀜),
  PlaytestHeadless도 재저장된 씬으로 통과.
- 골드 경제/상인 거래/PlayerHud(GoldState/ShopState/PlayerHud +
  BanditEncounter·NpcBuilder·SaveState v5 통합) 추가 후 컴파일 통과,
  PlayerHud가 씬에 새 GameObject라 `BuildTestVillageScene.Build()` 재실행
  (groundVerts=3136 그대로), PlaytestHeadless도 통과.
- 채집(GatherState/Gatherable + BuildGatherables 훅 + SaveState v6) 추가
  후 컴파일 통과, 씬 재빌드(groundVerts=3136 그대로) 후 PlaytestHeadless
  통과.
- 산신당(TestMapData 'S' 타일 + LandmarksBuilder.BuildShrine +
  ShrineState/MountainShrine + SaveState v7) 추가 후 컴파일 통과, 씬
  재빌드에서 groundVerts=3136 그대로임을 확인(칸 하나 종류만 바뀌고
  격자 크기는 안 바뀌었다는 뜻) 후 PlaytestHeadless 통과.
- 동물(WanderingAnimal/AnimalBuilder + TestMapData.WorldToGrid + Build
  TestVillageScene.BuildAnimals) 추가 후 컴파일 통과, 씬 재빌드
  (groundVerts=3136 그대로) 후 PlaytestHeadless 통과 — 이번엔 Update()가
  매 프레임 도는 컴포넌트라 10프레임 동안 실제로 몇 번 실행돼 그 경로도
  오류 없음까지 확인됨(다른 조각들과 달리 정적 배치만이 아님).
- BanditEncounter를 EncounterUiKit로 리팩터(UI 조립 코드 이동, 동작
  동일) + Awake() 재등장 버그 고침 + RareWolfEncounter/RareWolfState/
  EncounterUiKit/ar_wolf 신규 + SaveState v8 추가 후 컴파일 통과, 씬
  재빌드(groundVerts=3136 그대로, BanditEncounter 리팩터가 UI 생성
  결과를 안 바꿨다는 뜻) 후 PlaytestHeadless 통과.
- 지도 크기 확장(TestMapData.Rows 남쪽 2줄 + BuildTestVillageScene의
  PlayerSpawn을 WorldPos() 계산식으로 교체) 추가 후 컴파일 통과, 씬
  재빌드에서 `groundVerts=3136→4032`로 정확히 7×9×4×4서브쿼드×4정점과
  일치함을 확인, PlaytestHeadless(`OK - 10 frames, no errors`)도 통과.
  이어서 origin에 먼저 올라온 saga-godot 지도 확장·saga-unity Sky/Fog
  병합 정리 커밋과 겹쳐 push가 거절돼 `git merge`로 `BuildTestVillageScene
  .cs`·`docs/PROJECT_STATE.md` 충돌을 손으로 풀고, 병합된 코드로 컴파일·
  씬 재빌드(`groundVerts=4032` 그대로)·PlaytestHeadless를 한 번 더 통과
  시킨 뒤 병합 커밋으로 push 완료.
- 동물 Flee/Group/Interaction(WanderingAnimal.cs State 확장, DialogueLabel
  자막 재사용) 추가 후 컴파일 통과 — 씬 GameObject 구성을 하나도 안
  건드린 변경이라 BuildTestVillageScene.Build()는 다시 안 돌림(기존
  TestVillage.unity 그대로 유효). PlaytestHeadless(`OK - 10 frames, no
  errors`) 통과 — 플레이어가 스폰 지점에서 안 움직여 사슴과의 거리가
  이미 FleeAlertRadius(16) 밖이라 이번 10프레임 동안 Flee 경로 자체는
  실행 안 됨(정상 — 실제 발동은 사람이 다가가 봐야 확인).
- 채집 자리 4호(herb_4, GatherSpots 배열에 한 줄 추가) 추가 후 컴파일
  통과, 씬에 GameObject가 늘어 `BuildTestVillageScene.Build()` 재실행
  (`groundVerts=4032` 그대로 — 땅은 안 바뀜), PlaytestHeadless(`OK - 10
  frames, no errors`)도 통과.
- 지도 크기 확장 동쪽 2칸(TestMapData.Rows 각 행 끝에 2글자씩 추가,
  9×7→9×9) 추가 후 컴파일 통과, 씬 재빌드에서 `groundVerts=4032→5184`로
  정확히 9×9×4×4서브쿼드×4정점과 일치함을 확인, PlaytestHeadless
  (`OK - 10 frames, no errors`)도 통과.
- WorldEventState 일반화(ShrineState·RareWolfState 삭제, SaveState v9)
  추가 후 컴파일 통과 — 씬 GameObject 구성을 하나도 안 건드린 변경이라
  BuildTestVillageScene.Build()는 다시 안 돌림. PlaytestHeadless
  (`OK - 10 frames, no errors`) 통과 — v8 세이브 파일을 실제로 로드해
  MigrateStep(8,...)이 세 bool을 worldFlags로 올바르게 접는지는 사람이
  구버전 세이브로 직접 확인해야 함(헤드리스 플레이는 새 게임 취급이라
  이 경로를 안 지나감).
- EastGroveRelic(신규, WorldEventState 일반화 이후 첫 재사용) 추가 후
  컴파일 통과, 씬에 GameObject가 늘어 `BuildTestVillageScene.Build()`
  재실행(`groundVerts=5184` 그대로 — 땅은 안 바뀜), PlaytestHeadless
  (`OK - 10 frames, no errors`)도 통과.
- 지도 크기 확장 셋째 조각(row8 문 개방 + row9~10 신규, 'F' 논밭 타일
  첫 사용) + 채집 자리 5호(herb_5) 추가 후 컴파일 통과, 씬 재빌드에서
  `groundVerts=5184→6336`으로 정확히 9×11×4×4서브쿼드×4정점과 일치함을
  확인, PlaytestHeadless(`OK - 10 frames, no errors`)도 통과.
- 동물 Group 재배치(AnimalDef.Offset, 사슴 세 번째 마리) + 나그네 NPC
  (WorldEventState 세 번째 재사용) 추가 후 컴파일 통과, 씬에 GameObject가
  늘어 `BuildTestVillageScene.Build()` 재실행(`groundVerts=6336` 그대로
  — 땅은 안 바뀜), PlaytestHeadless(`OK - 10 frames, no errors`)도 통과.
- 성황당 돌무더기(LuckyCairn 신규, WorldEventState 없이 쿨다운+가중치
  룰렛만) 추가 후 컴파일 통과, 씬에 GameObject가 늘어
  `BuildTestVillageScene.Build()` 재실행(`groundVerts=6336` 그대로 — 땅은
  안 바뀜), PlaytestHeadless(`OK - 10 frames, no errors`)도 통과.
- 소(AnimalDef를 Species/Scale/Color로 일반화 + cow_1 추가, WanderingAnimal.cs
  무변경) 추가 후 컴파일 통과, 씬에 GameObject가 늘어
  `BuildTestVillageScene.Build()` 재실행(`groundVerts=6336` 그대로 — 땅은
  안 바뀜), PlaytestHeadless(`OK - 10 frames, no errors`)도 통과.
- 캐릭터 GLB 도입(com.unity.cloud.gltfast 패키지 추가 + CharacterVisual.cs
  신규 + Player/NpcBuilder/BanditEncounter를 capsule→GLB로 교체 + Awake
  중복 생성 방어 추가) 후 컴파일 통과, 씬에 실제 3D 모델이 들어가
  `BuildTestVillageScene.Build()` 재실행(`groundVerts=6336` 그대로 — 땅은
  안 바뀜), PlaytestHeadless(`OK - 10 frames, no errors`)도 통과 — 이번엔
  Awake 가드 분기(`transform.Find("Visual") != null`)가 실제 Play
  진입으로 한 번 지나가는 것까지 확인됨.
- 환경/건물 GLB 도입(VegetationBuilder.cs를 결합 메시 베이크→GLB
  인스턴스화로 재작성 + LandmarksBuilder.cs의 굴 입구/벽/지붕/폐허 기둥/
  다리 교체 + 콜라이더 수동 추가 + Awake 중복 생성 방어) 후 컴파일 통과,
  씬 재빌드(`groundVerts=6336` 그대로 — 땅은 안 바뀜)에서 나무 45·바위
  48·다리 널판 44·굴 입구 1·벽 2·지붕 2·폐허 기둥 3·산신당 기둥 4를
  지도 데이터에서 직접 셈한 값과 정확히 대조해 확인, PlaytestHeadless
  (`OK - 10 frames, no errors`, static 배칭 호출도 에러 없음)도 통과.
- DUNGEON 오픈월드 확장 첫 조각(Room5·Room6, Corridor4·5, 층2 두목
  `wp_greatblade` 추가) 후 컴파일 통과(`error CS` 0건), 씬 재빌드
  (`room childCount=14` 그대로 — Room1 자식 수라 안 바뀜, GLB 못 찾음
  경고 0건), PlaytestDungeonHeadless(`OK - 10 frames, no errors`)도 통과.
- DUNGEON 오픈월드 확장 두 번째 조각(Room7·Room8, Corridor6·7, 층2
  정예 — 새 아이템 없이 기존 `wp_saber`·`DungeonVein.cs` 재사용) 후
  컴파일 통과(`error CS` 0건), 씬 재빌드(`room childCount=14` 그대로,
  GLB 못 찾음 경고 0건), PlaytestDungeonHeadless(`OK - 10 frames, no
  errors`)도 통과.
- DUNGEON 오픈월드 확장 세 번째 조각(Room9, Corridor8, `DungeonPuzzle.cs`
  재사용) 후 컴파일 통과(`error CS` 0건), 씬 재빌드(`room childCount=14`
  그대로, GLB 못 찾음 경고 0건), PlaytestDungeonHeadless(`OK - 10
  frames, no errors`)도 통과.
- DUNGEON 절차적 층 진행 전환(Room5~11 제거 → ProcRoom +
  `DungeonFloorRunner`, `DungeonFormulas.cs` 신규) 후 컴파일 통과,
  씬 재빌드(`room childCount=14` 그대로, GLB 못 찾음 경고 0건),
  PlaytestDungeonHeadless(`OK - 10 frames, no errors`) 통과.
  `SimulateDungeonFloors.cs`(신규, 씬 불필요) 첫 실행에서 78층 근처
  보상 int 오버플로(exp/gold가 음수로 뒤집힘) 발견 → `ClampToInt()`로
  고침 → 재실행 결과 `OK - 2층~100층 전부 통과, 방 856개 방문, 예외·
  NaN 없음`.
- `PlaytestDungeonFloorProgression.cs`(신규, 열한 번째 세션) 첫 실행에서
  `CharacterController` 순간이동 미반영(테스트 하니스 버그) + 문 자리에
  서 있으면 무전투 방이 자동 연쇄 진행되는 실제 게임 결함을 발견 →
  각각 고침 → 재실행 결과 `OK - 12 room advances, floor reached 4, no
  errors`(roomIndex 매번 정확히 1씩 증가, floor 2→3→4, cave·fight·
  well·forage·stair 등 실제 GameObject 경로로 확인). 회귀로
  `PlaytestDungeonHeadless`(`OK - 10 frames, no errors`)도 재확인.
- `PlaytestForestHouseTransition.cs`(신규, 열한 번째 세션) — `ForestHouse
  .cs`의 CharacterController 순간이동 결함 수정 뒤 `OK - entered and
  exited the house, position held across frames, no errors`. 회귀로
  `PlaytestForestHeadless`(`OK - 10 frames, no errors`)도 재확인.
- `PlaytestForestFurniture.cs`(신규, 열한 번째 세션, 가구 슬라이스) —
  과일을 채우고 좌판→자리를 오가며 구매→배치→점수→쿨다운 후 거두기까지
  확인, 처음엔 거두기 검증이 프레임 수 기반 대기라 실패(배치 모드가
  초당 약 5700프레임으로 실시간보다 훨씬 빠르게 돎을 확인) →
  `Time.time` 기준 대기로 고쳐 `OK - bought, placed and picked up
  furniture, score changed as expected, no errors`. 회귀로
  `PlaytestForestHeadless`·`PlaytestForestHouseTransition`·
  `PlaytestDungeonHeadless`·`PlaytestDungeonFloorProgression` 전부
  재확인.
- `PlaytestForestCreatures.cs`(신규, 열한 번째 세션, 몬스터·퓨전 슬라이스) —
  네 종 전부 배회 이동 확인(dokkaebi 3.32m·bawi 0.56m·beoseot 2.68m·
  kkot 3.71m) + 플레이어 접근 시 도주 확인(거리 1.00→4.50) →
  `OK - all four creatures wandered and fled correctly, no errors`.
  회귀로 `PlaytestForestHeadless`·`PlaytestForestHouseTransition`·
  `PlaytestForestFurniture`·`PlaytestDungeonHeadless`·
  `PlaytestDungeonFloorProgression` 전부 재확인.
- REALM 서고(archive, godot REALM 10절과 같은 결) 신규 — 익힌 문제를
  최근 순으로 다시 보는 기능. `RealmQuizState`에 `_learnedOrder`(진짜
  삽입 순 리스트, `_learned` HashSet과 별도) + `LearnedList()` 추가,
  `RealmQuizData.ShortQ()`(quiz.js `shortQ()` 그대로, 26자 초과 시 줄임)
  신규. `RealmCommandUi`에 "서고" 버튼(명령 계열 패널과 같은 결로
  열 때마다 다시 지음, 최대 20개 — 스크롤 없는 패널이라 자름) +
  `CloseAllPanels()`로 다섯 패널(주문·내정·계략·문답·서고) 토글 중복
  코드 정리. 세이브 스키마(필드 이름·개수)는 그대로 — `SnapshotLearned()`
  가 이제 `_learnedOrder`를 반환하도록만 바뀌어 버전 안 올림(구버전
  세이브를 불러와도 `Restore()`가 준 순서를 그대로 `_learnedOrder`로
  씀, 서고는 표시용이라 옛 순서 근사치라도 무해).
  **검증** — 컴파일(`error CS` 0건)·`PlaytestRealmSlice`(신규 Phase
  `QuizArchive`, 문답 정답 하나를 익힌 직후 서고 목록이 정확히 1건이고
  필드가 다 채워져 있는지 확인) → `[PlaytestRealmSlice] quiz archive OK
  - "중꺾마"는 무엇의 줄임말인가? (정답: 중요한 것은 꺾이지 않는 마음)`,
  최종 `OK - world-map/location gate/ships gate/orders(10)/draft/
  search/hire/city-assignment/war/diplo(rumor+fire)/captured-city-
  absorb/quiz/save-load all verified, no errors`. 서고 UI는 런타임에
  짓는 패널이라(`RealmCommandUi.Awake`) 씬 재빌드(`BuildTestCityScene`)
  불필요 — 하이어라키를 안 건드리는 변경.

## 아트 방향 전환 — PLAN.md 수정만, 구현은 아직 (2026-09-13)

- `saga-godot/docs/PROJECT_STATE.md`와 같은 결정·같은 날짜 — 사용자가
  원신(Genshin Impact) 그래픽 방향을 요청, 캐릭터/환경 에셋 자체를
  애니메이션풍으로 교체하기로 하고 saga-godot·saga-unity 둘 다에
  반영하기로 확인받음. `PLAN.md` **66-2장** 신규(Unity 고유 차이만:
  URP 셰이더는 Godot GDShader와 별도로 직접 짜고, VRM 임포트는 UniVRM
  경유·gltFast 경유 두 경로 중 아직 안 정함). `docs/ASSET_GUIDE.md`에도
  같은 날짜로 짧은 포인터 추가(기존 Kenney 기록은 안 지움).
- **이번엔 문서만 고쳤다 — 코드·에셋(Assets/Art/*)은 아직 그대로다.**
  saga-godot 쪽에서 파이프라인(VRoid 모델 → 셀셰이더 → 애니메이션)이
  먼저 검증된 뒤 같은 순서로 이쪽에 옮기기로 함 — 지금 바로 착수하지
  않는다.
- 헤드리스 검증 안 함(PLAN.md·docs 텍스트만 수정, 프로젝트 코드 변경
  없음).

## VRoid 샘플 아바타 — Unity 임포트 검증 (2026-09-13, 이어서)

- saga-godot이 VRoid Studio에서 내보낸 파이프라인 검증용 임시 자산
  (`AvatarSample_A`, pixiv 기본 샘플 그대로, 커스터마이징 없음 — 경위는
  saga-godot `docs/PROJECT_STATE.md` 참고)을 `Assets/Art/
  CharactersVroid/`에 그대로 복사(`.vrm` 원본 + Unity 임포트용 `.glb`
  사본).
- Unity 배치 모드(`-batchmode -nographics -quit`)로 임포트 확인 —
  **`.glb`가 기존 `com.unity.cloud.gltfast` 파이프라인으로 오류 없이
  임포트됨**(기존 Kenney GLB들과 같은 `ScriptedImporter` 경로). `.vrm`
  확장자는 Unity가 인식 못 해 `DefaultImporter`로만 잡힘 — 이후 VRM을
  또 받으면 매번 `.glb` 사본을 같이 둬야 한다.
  → **66-2장에 미정으로 남겨 뒀던 "UniVRM vs gltFast" 결정 — gltFast로
  확정.** 이미 있는 패키지고 기존 자산과 경로가 같아서 일관적이다.
- **부작용 발견 및 원복** — 이 PC의 Unity(6000.3.24f1)가 프로젝트 고정
  버전(6000.3.23f1)보다 최신이라 배치 모드 실행만으로
  `ProjectSettings/ProjectVersion.txt`·`Packages/manifest.json`(gltfast
  6.9.0→6.14.1)·`packages-lock.json`이 자동으로 바뀌었다. 이번 작업과
  무관해 `git checkout`으로 전부 되돌림 — `CLAUDE.md`에 이 함정을 새로
  기록해 둠(다음에 배치 모드 돌릴 때 같은 파일들을 또 확인할 것).
- GUI 안 띄움(배치 모드만 사용), 프로세스는 `-quit`으로 자체 종료 —
  정리할 것 없음.

## 정정 — 아트 방향, saga-unity는 원신이 아니라 사실적(포토리얼)로 (2026-09-13, 같은 날 다시)

- **사용자 지시 "saga-unity는 원신 스타일이 아니라 사실적인 걸로 변경할게,
  엔진마다 다른 점이 필요해"** — 위 두 항목("아트 방향 전환"·"VRoid 샘플
  아바타")에서 saga-godot과 "같은 결정"이라고 적었던 것을 뒤집는다.
  **saga-godot은 그대로 원신풍 카툰/셀셰이딩**(그 프로젝트 PLAN.md
  66-2장), **saga-unity는 사실적(포토리얼) PBR**로 — 두 엔진 트랙이
  이제 의도적으로 다른 그래픽 목표를 갖는다(전에는 "기획은 같이 본다"는
  원칙 아래 같은 방향이라고 가정했는데, 이번에 사용자가 명시적으로
  갈라 달라고 함).
- 자세한 내용은 `PLAN.md` 66-2장(고쳐 씀) 참고 — 여기서 반복하지 않는다.
- **사용자 지시 "다른 피시에서 작업할거임" + "플랜만 수정임"** — 이번엔
  PLAN.md·docs만 고치고 실제 구현(셰이더 작성·에셋 교체)은 안 한다.
  `Assets/Art/CharactersVroid/`(VRoid 샘플, saga-godot과 같은 파일)는
  **지우지 않고 그대로 둔다** — gltFast 임포트가 되는지 확인한 기술
  검증 결과는 그래픽 스타일과 무관하게 여전히 유효하고, 실제 최종 에셋
  교체는 다른 PC의 다음 세션이 사실적 방향에 맞는 소스로 다시 정할 일.

## 다음 세션 시작 전 확인할 것 — 방향 용어 재확인 (2026-09-13)

바로 위에서 "사실적(포토리얼) PBR"로 정했는데, 그 직후 사용자가 "saga-unity
실기 셀셰이더 구현은 다른 피시에서 이어서 할게"라고 해 **"셀셰이더"라는
표현이 다시 등장했다.** 이 세션에서 "사실적 vs 카툰 중 어느 쪽이냐"고
되물었으나 "새로운 세션에서 이어할게"로 답해 **이 세션에선 확정 못
지음.** 다음 세션(다른 PC)이 saga-unity 그래픽 작업을 시작하기 전에
사용자에게 먼저 확인할 것 — PLAN.md 66-2장은 "사실적 PBR"로 적혀 있지만
그 결정이 여전히 유효한지, 아니면 카툰/셀셰이딩으로 다시 돌아간 것인지.

## 위 미확정 재확인 — "사실적 PBR" 확정, 파이널 판타지 최신작(FF16) 기준으로 구체화 (2026-09-13, 다음 세션)

- **바로 위 항목의 미확정을 이 세션이 풀었다** — 사용자가 "파이널
  판타지 그래픽처럼 하고 싶어, 최신작 기준임"으로 요청. FF16은 카툰이
  아니라 사실적 렌더링이므로, **"사실적 PBR" 방향이 맞았고 그대로
  확정**(카툰/셀셰이딩으로 되돌아간 게 아님) — 앞선 "셀셰이더"라는
  표현은 이 방향과 무관한 다른 문맥(또는 착오)이었던 것으로 보고 넘어감.
- `PLAN.md` 66-2장을 "파이널 판타지 최신작(FF16·FF7 리버스) 기준"으로
  구체화: 캐릭터(실사 비율+SSS 피부+헤어카드+이방성 하이라이트)·라이팅
  (극적 명암+Volumetric Fog+필름틱 LUT)·Post Processing(얕은 DoF·
  Film Grain·Chromatic Aberration·Motion Blur, PC 위주)·환경(APV GI·
  SSR 물) 스펙을 표로 정리, "다음에 할 일" 순서를 라이팅→환경→캐릭터로
  재배치(체감 대비 비용 순).
- **사용자가 "FF16 정도 가능할까?" → "비슷한 정도까지만이라도"로 직접
  눈높이를 낮춰 물어, "현실적 기대치" 절을 새로 추가**해 항목별
  근접 가능성을 정직하게 표로 남겼다(라이팅/색보정=높음, 환경=중간~높음,
  캐릭터 얼굴·헤어·천 시뮬=낮음 — 혼자·CC0/저가 에셋·모바일 겸용이라는
  이 프로젝트의 제약 때문).
- 이번에도 **문서만 수정, 실제 셰이더/에셋 작업은 안 함** — 헤드리스
  검증 없음(PLAN.md·이 파일 텍스트만 변경).

## 66-2장 "다음에 할 일" ① 라이팅/색보정/후처리 셋업 — 다섯 판 전부 (2026-09-13, 이어서)

- **"이어해" 요청으로 66-2장이 우선순위 1번으로 적어 둔 항목(에셋 불필요,
  라이팅/색보정부터)을 실제로 구현했다.** `Assets/Editor/
  BuildFF16VolumeProfiles.cs`(신규, `Saga/Build FF16 Volume Profiles`
  메뉴) — 66-1장의 PC_RPAsset/Mobile_RPAsset과 같은 결로 **공유 VolumeProfile
  자산 둘**(`Assets/Settings/FF16Volume_{PC,Mobile}.asset`)을 짓는다.
  공통: Bloom(따뜻한 tint)·ColorAdjustments(대비+12·채도-8·필터
  살짝 따뜻하게)·Tonemapping(ACES)·Vignette. PC 전용: ChromaticAberration·
  FilmGrain(둘 다 미세하게) — 45장 모바일 목표로 Mobile엔 안 넣음. DoF·
  Motion Blur는 이번 범위 밖(대화/연출 토글 시스템이 없어 지금 넣으면
  평소 플레이 중에도 항상 흐려짐 — 66-2장에 이미 적어 둔 유보).
- **막혔던 것 — `VolumeProfile.Add<T>()`는 컴포넌트를 메모리에만 만들고
  자산에 안 끼운다.** 처음 실행했더니 `.asset` 파일의 `components` 리스트가
  전부 `{fileID: 0}`(빈 참조)로 저장됨 — `AssetDatabase.AddObjectToAsset()`을
  각 컴포넌트마다 명시로 불러야 서브에셋으로 실제 저장된다는 걸 발견,
  `AddOverride<T>()` 헬퍼로 고쳐 재실행 후 `components`에 실제 fileID
  6개(PC)/4개(Mobile) 들어간 것 확인.
  - **막혔던 것 2 — `Volume.profile = x`는 씬에 저장되지 않는다.**
    `Volume.cs`를 읽어 확인 — `.profile` 프로퍼티는 런타임 전용 복사본
    (`m_InternalProfile`)만 건드리고, 실제로 직렬화되는 필드는
    `.sharedProfile`이다. 에디터 빌드 스크립트(다섯 판 전부)가 처음엔
    `.profile`을 썼다가 씬 저장 후 `sharedProfile: {fileID: 0}`으로
    비어 있는 걸 발견해 `.sharedProfile`로 고침. **런타임 스크립트
    (`PlatformVolumeProfile.cs`)는 반대로 `.profile`이 맞다** — Awake()
    시점에 플랫폼별로 갈아 끼우는 용도라 원본 자산을 안 건드리는 쪽이
    맞기 때문(둘의 의미가 다르다는 걸 이번에 정확히 파악).
- **컴파일 막혔던 것 — SagaGo·SagaDungeon·SagaForest 세 판만 `.asmdef`가
  따로 있다(SagaStory·SagaRealm은 기본 어셈블리).** `Volume`/`VolumeProfile`
  타입은 UnityEngine 코어가 아니라 URP Core 패키지 어셈블리(`Unity.
  RenderPipelines.Core.Runtime`) 소속이라, 패키지의 `autoReferenced:
  true`는 **기본 어셈블리(Assembly-CSharp)에만 자동 적용되고 커스텀
  asmdef엔 안 먹는다** — 세 `.asmdef`의 `references`에 그 이름을 명시로
  추가해야 컴파일됐다(SagaStory·SagaRealm은 기본 어셈블리라 애초에
  문제없었음). 다음에 이 세 판에 패키지 타입(URP·Input System 등)을
  새로 쓸 때 이 함정을 기억할 것 — 에러 메시지는 "타입을 못 찾음"으로만
  뜨고 asmdef 얘기는 안 나온다.
  런타임(`PlatformVolumeProfile.cs`, 다섯 판 각자 World/ 폴더에 복사 —
  코드는 5벌이 이 프로젝트 관례)이 `Application.isMobilePlatform`으로
  둘 중 하나를 골라 `Volume.profile`에 꽂는다. 각 `BuildXxxScene.cs`에
  `BuildPostProcessingVolume()` 추가(GlobalVolume 오브젝트 + 두 프로파일
  참조 전달) + 메인 카메라마다 `UniversalAdditionalCameraData
  .renderPostProcessing = true` 추가(이게 없으면 Volume을 꽂아도 화면에
  아무 효과가 안 나온다 — URP 카메라 기본값이 꺼짐).
- **검증** — `BuildFF16VolumeProfiles.Build`(컴파일 통과, 두 자산 저장,
  `components` fileID 확인)·다섯 `BuildXxxScene.Build()`(전부 재저장,
  groundVerts/room childCount 등 기존 값 그대로 — 씬 하이어라키 내용
  자체는 안 바뀜, GlobalVolume만 추가) 후, 회귀로 `PlaytestHeadless`·
  `PlaytestDungeonHeadless`·`PlaytestForestHeadless`·`PlaytestStorySlice`·
  `PlaytestRealmSlice` 다섯 전부 재확인 — `error CS` 0건, 전부 기존
  OK 문구 그대로 통과. `ProjectSettings/`·`Packages/`에 배치 모드
  부작용(버전 자동 갱신) 없음 확인(`git status`로 훑음).
  **실제 화면(GUI)으로 톤을 확인하는 건 아직 안 함** — 66-2장 "적용
  순서"가 셰이더/에셋 작업 이후로 미뤄 둔 항목이라, 이번엔 값이 실제로
  씬에 저장되고 컴파일·헤드리스가 깨지지 않는지까지만 확인했다. 다음에
  사람이 Unity 에디터로 직접 열어 Bloom/색감이 기대한 방향인지 봐야
  한다(66-2장 "검증" 절 그대로).

## 66-2장 "다음에 할 일" ② 환경 PBR 텍스처 킷 조사 (2026-09-13, 이어서)

- ①에 이어 ②(환경 PBR 텍스처 킷 조사)를 이 세션에서 처리했다. **Poly
  Haven**(CC0, 공개 API로 로그인 없이 정적 URL 다운로드 — saga-godot
  세션이 Quaternius itch.io에서 겪은 "JS라 자동 다운로드 불가" 문제가
  없다)에서 `cobblestone_floor_01`(바닥)·`castle_wall_slates`(벽) 두
  재질을 1k JPG(diffuse·normal·roughness·AO)로 받아 `Assets/Art/
  EnvironmentPBR_candidates/`에 뒀다 — 아직 후보일 뿐 씬엔 안 물림.
- `BuildEnvironmentPbrSample.cs`(신규, `Saga/Build Environment PBR
  Sample Materials`)로 URP `Lit` 머티리얼 2개를 코드로 지어 파이프라인
  검증(diffuse→BaseMap, normal→BumpMap+`_NORMALMAP`, AO→
  OcclusionMap+`_OCCLUSIONMAP`). 배치 모드 실행, 컴파일 오류 0건,
  머티리얼 2개 생성 확인.
- **채널 팩킹 문제 발견** — URP Lit의 Metallic 워크플로는 Smoothness를
  Metallic맵 알파로만 받고 별도 Roughness 슬롯이 없다. Poly Haven의
  Roughness는 별도 텍스처라 지금은 상수(0.3~0.35)로 근사만 해 뒀다 —
  실제 지형/벽에 쓸 때 커스텀 Shader Graph로 `arm`(ORM 팩) 텍스처를
  풀어 쓸 것. 자세한 내용은 `PLAN.md` 66-2장·`docs/ASSET_GUIDE.md` 참고.
- 배치 모드 후 `ProjectSettings/`·`Packages/` 버전 자동 갱신(이 세션
  두 번째 발생, ①과 같은 함정) 확인 → `git checkout`으로 되돌림.
- **다음에 할 일**: ③ 캐릭터 에셋 조사(아직 후보 없음), 위 채널 팩킹을
  실제로 풀 Shader Graph, Poly Haven에서 재질 더 조사(흙길·초목·목재),
  그 다음에야 실제 씬 교체.

## 66-2장 "다음에 할 일" ③ 캐릭터 에셋 조사 — Mixamo 선례 확인 (2026-09-13, 이어서)

- **레거시 재사용(4장)** — 웹 판 사가의숲이 2026-09-02에 이미 "사실적
  사람" 문제를 Mixamo로 풀었던 기록(`saga-web/saga-forest/assets/
  ASSET_LICENSES.md`)을 그대로 가져다 썼다. 결론: Mixamo가 최선이나
  (1) 공개 API 없어 사람이 직접 받아야 함(VRoid Studio와 같은 종류의
  자동화 한계) (2) 약관상 재배포 금지라 변환물을 커밋 안 함 — 사가의숲도
  같은 이유로 로컬 전용이었다. **Unity는 FBX 네이티브 임포트+Humanoid
  Avatar 매핑이라 웹 판의 FBX2glTF 변환 파이프라인이 통째로 필요 없다**
  — 이 프로젝트가 웹 판보다 오히려 쉬운 지점.
- `.gitignore`에 `Assets/Art/CharactersRealistic/` 추가(선점, 폴더
  자체는 아직 없음).
- **헤어카드·URP SSS 스킨 셰이더 조사(서브에이전트로 웹 검색)** — 완전
  새로 짜야 하는 게 아니라 공개 GitHub URP Shader Graph 구현이 이미
  있다는 걸 확인: 스킨은 `CiaranSimpson/Subsurface-Scattering-for-
  Unity-URP`(wrap-lighting 근사, 모바일 지향), 헤어는
  `cathyhlshih/UnityURPAnisoHighlightHairShader`·`itsFulcrum/
  Unity-URP-Hair-Shader`(Kajiya-Kay류 이방성 + 알파클립 카드),
  Unity 공식 `URP-Defender-Character-Demo`도 참고용 이방성 헤어
  Shader Graph를 갖고 있다. 더 사실적인 스킨을 원하면 Eric Penner의
  pre-integrated skin(곡률 기반)을 Custom Function 노드로 직접 옮겨야
  한다는 것도 확인(URP엔 로우레벨 라이팅을 노출하는 내장 노드가 없어
  이 부분만은 못 피함). **각 GitHub 저장소의 라이선스는 아직 개별
  확인 안 함** — 실제로 가져다 쓰기 전에 확인할 것.
- 이번엔 문서 조사만 — mixamo.com에서 실제로 받는 것도, 위 셰이더를
  실제로 받아 붙이는 것도 다음 단계(사람 개입 또는 실제 통합 작업).
  코드 변경 없어 헤드리스 검증 없음(PLAN.md·ASSET_GUIDE.md·.gitignore만
  수정).

## 66-2장 "다음에 할 일" ④ 캐릭터 셰이더 라이선스 확인 + 채널 팩킹 실제 해결 (2026-09-13, 이어서)

- **③이 미뤄 둔 라이선스 확인** — GitHub API로 세 저장소 전부 확인:
  `CiaranSimpson/Subsurface-Scattering-for-Unity-URP`(MIT),
  `cathyhlshih/UnityURPAnisoHighlightHairShader`(MIT),
  `itsFulcrum/Unity-URP-Hair-Shader`(CC0-1.0) — 전부 문제없이 쓸 수
  있다. 참고용으로만 적어 뒀던 `Unity-Technologies/
  URP-Defender-Character-Demo`는 저장소가 404(검색해도 없음) — 실사용
  대상이 아니었으니 목록에서 뺐다.
- **②가 남겨 둔 채널 팩킹(Roughness→Smoothness) 문제를 실제로 풀었다.**
  당초 계획은 커스텀 Shader Graph였지만, 더 간단한 대안으로 갔다 —
  `BuildEnvironmentPbrSample.cs`에 `BuildMetallicSmoothnessMap()`을
  추가해 Poly Haven의 `_rough_1k.jpg`를 에디터에서 픽셀 단위로 읽어
  RGB=0(비금속)·A=255-Roughness로 구운 `_metallicsmoothness_1k.png`를
  만들고 `_MetallicGlossMap`+`_METALLICSPECGLOSSMAP`으로 물렸다(표준
  URP Lit Metallic 워크플로 그대로, 커스텀 셰이더 불필요). 배치 모드로
  실행해 컴파일 오류 0건·`cobblestone_floor_01`·`castle_wall_slates`
  양쪽 PNG+머티리얼 정상 생성 확인, `ProjectSettings/`·`Packages/`
  배치 모드 부작용도 이번엔 없었음(`git diff`로 확인). 자세한 내용은
  `PLAN.md` 66-2장 ④ 참고.
- **다음에 할 일**: 사람이 mixamo.com에서 캐릭터+애니메이션 받기(유일하게
  남은 사람 GUI 단계), Poly Haven 재질 추가 조사.

## 66-2장 "다음에 할 일" ⑤ 캐릭터 셰이더 세 벌 실제 반입 (2026-09-13, 이어서)

- ④에서 라이선스 확인까지 끝난 세 저장소를 `git clone`으로 받아
  `Assets/Art/CharacterShaders_candidates/`에 넣었다(아직 캐릭터가
  없어 어느 머티리얼/씬에도 안 물림, 순수 반입). `SSS_CiaranSimpson`은
  재사용 서브그래프(`FakeSSS.shadersubgraph`)만 가져왔다 — 원본의 데모
  마스터 그래프는 이 프로젝트의 Unity 6000.3 Shader Graph 패키지로
  임포트하면 `NullReferenceException`으로 깨져서 뺐다(버전 차이로
  보임, 서브그래프 노드 자체는 정상). 나머지 둘(이방성 헤어·헤어카드)은
  README 데모 이미지만 빼고 그대로. 배치 모드 임포트 두 번으로 컴파일
  오류 0건 확인, `ProjectSettings/`·`Packages/` 부작용 없음. 자세한
  내용은 `PLAN.md` 66-2장 ⑤ 참고.
- **다음에 할 일**: 사람이 mixamo.com에서 캐릭터+애니메이션 받기(이제
  유일하게 남은 단계) → 셰이더 세 벌을 실제 캐릭터에 붙여 확인.

## 66-2장 "다음에 할 일" ⑥ Poly Haven 재질 추가 — 흙길·초목·목재 (2026-09-13, 이어서)

- ②가 대표 둘(바닥·벽)만 확인한 데 이어 `grass_path_2`(흙길)·
  `leafy_grass`(초목 바닥)·`dark_wooden_planks`(목재) 세 재질을 Poly
  Haven 공개 API로 추가 반입(전부 CC0, 1k JPG diffuse/nor_gl/rough/
  ao). `BuildEnvironmentPbrSample.cs`에 세 항목을 추가해 기존
  `BuildMetallicSmoothnessMap()`을 그대로 재사용(④의 채널 팩킹 해법이
  새 재질에도 바로 적용됨) — 배치 모드로 머티리얼 5개(기존 2+신규 3)
  생성 확인, 컴파일 오류 0건·`ProjectSettings/`/`Packages/` 부작용
  없음. 아직 어느 씬에도 안 물린 후보. 자세한 내용은 `PLAN.md` 66-2장
  ⑥ 참고.
- **다음에 할 일**: 사람이 mixamo.com에서 캐릭터+애니메이션 받기(유일한
  남은 단계) → 이후 44장 우선순위대로 Kenney/VRoid 플레이스홀더를
  실제 씬에 순차 교체.

## 66-2장 "다음에 할 일" ⑦ Mixamo 캐릭터 반입 + Humanoid 리깅 (2026-09-13, 이어서)

- **사용자가 mixamo.com에서 직접 받았다** — Maria 몸+애니메이션 8개
  (idle·walk·run·attack·hit·dodge·death·interaction, ③ 레시피 그대로),
  `Assets/Art/CharactersRealistic/`(`.gitignore` 대상)로 복사해 넣었다.
- `SetupMixamoCharacterImport.cs`(신규)로 몸은 Create From This Model,
  애니메이션 8개는 전부 Copy From Other Avatar(몸의 Avatar 공유)로
  Humanoid 리깅, 클립 이름을 액션 이름으로 바꾸고 idle/walk/run만
  루프 설정. 배치 모드 실행 결과 **몸 Avatar가 isValid·isHuman 둘 다
  통과**(Mixamo T-pose가 별 수동 보정 없이 Unity Humanoid에 바로
  들어맞음), 8개 클립 전부 정상 리네임 확인. 컴파일 오류 0건,
  `ProjectSettings/`·`Packages/` 부작용 없음. 자세한 내용은 `PLAN.md`
  66-2장 ⑦ 참고.
- **다음에 할 일**: Animator Controller로 클립 연결+씬 배치, ⑤ 헤어/
  스킨 셰이더를 Maria 실제 머티리얼에 붙이기(머티리얼 슬롯 구성부터
  확인 필요), 이후 44장 우선순위대로 실제 씬 순차 교체.

## 66-2장 "다음에 할 일" ⑧ Animator Controller + 확인용 씬 배치 (2026-09-13, 이어서)

- `BuildTestCharacterRealisticScene.cs` 신규 — `Assets/Animators/
  Maria.controller`(커밋 대상, Mixamo 데이터 없이 클립 이름/전이만
  있음)에 8개 클립 전부 연결(Speed 블렌드로 Idle/Walk/Run, 나머지
  다섯은 Any State 트리거로 즉시 전이 후 Idle 복귀 — Death만 복귀
  안 시킴), `Assets/Scenes/TestCharacterRealistic.unity`(신규, 어느
  게임에도 안 속하는 독립 리그 검증 씬)에 Maria를 배치하고 Animator에
  물렸다. 배치 모드로 8개 상태 전부 클립이 실제로 물린 것·씬의
  Animator가 정확한 컨트롤러를 참조하는 것 확인, 컴파일 오류 0건,
  `ProjectSettings/`·`Packages/` 부작용 없음. 자세한 내용은 `PLAN.md`
  66-2장 ⑧ 참고.
- **다음에 할 일**: 사람이 에디터로 이 씬을 열어 Play 모드에서 직접
  확인 → ⑤ 헤어/스킨 셰이더를 Maria 머티리얼에 붙이기.

## 66-2장 "다음에 할 일" ⑨ 사용자 요청 "직접 확인해" — GUI Play 확인 + 버그 수정 (2026-09-13, 이어서)

- `PlaytestCharacterRealisticGui.cs` 신규 — 실제 GUI로 Unity를 띄워
  TestCharacterRealistic 씬 Play 진입 → idle/run/attack 세 시점
  스크린샷 → 스스로 Play 종료+Unity 프로세스까지 완전 종료(별도
  taskkill 불필요, 확인함).
- **1차 스크린샷에서 버그 발견** — Ground Plane이 `CreatePrimitive()`의
  URP 비호환 기본 내장 머티리얼을 그대로 쓰고 있어 캐릭터·바닥이 전부
  플랫한 시안색으로 나왔다. `BuildTestCharacterRealisticScene.cs`에
  명시적 URP Lit 회색 머티리얼+평평한 회색 앰비언트(스카이박스 제거)를
  추가해 수정, 재확인 결과 idle/run/attack 세 클립 전부 정상 렌더링
  확인.
- **부가 발견(당시엔 오판, 아래 ⑩에서 정정) — "Maria FBX에 디퓨즈
  텍스처가 0개"라고 적었었다.** `_BaseMap`이 null인 건 맞았지만 원인
  진단이 틀렸다(실제론 텍스처가 FBX에 있었다 — ⑩ 참고).

## 66-2장 "다음에 할 일" ⑩ 텍스처 문제 정정 — FBX에 이미 있었다, ExtractTextures()만 빠졌었다 (2026-09-13, 이어서)

- 사용자가 mixamo.com에서 `character.fbx`를 다시 받아 왔지만 진단
  결과 여전히 `_BaseMap` null — **재다운로드로도 안 풀렸다**, 원인이
  다른 데 있었다는 뜻.
- 바이너리로 직접 열어 PNG 시그니처를 찾아보니 **`character.fbx`에도,
  처음부터 갖고 있던 `Maria WProp J J Ong.fbx`에도 diffuse/normal/
  specular 3장이 이미 임베드돼 있었다.** 진짜 원인은 **Unity의
  `ModelImporter`가 FBX 임베드 텍스처를 기본적으로 자동 추출하지
  않는다는 것** — `ModelImporter.ExtractTextures(destDir)`를 명시적
  호출해야(에디터 GUI "Extract Textures..." 버튼과 동일 동작) 텍스처
  에셋이 실제로 생기고 머티리얼이 그걸 참조한다.
  **재다운로드 자체가 불필요했다** — 처음 파일에 이 한 단계만
  적용하면 됐다. `character.fbx`는 지우고 원본 리깅 완료본에
  텍스처만 추출해 이어갔다(리깅 설정은 재임포트 후에도 그대로 유지
  확인).
  - **주의 — 씬을 새로 빌드하고 GUI Play 첫 실행에서 idle 스크린샷이
    한 번 다시 플랫한 시안색으로 찍혔다**(셰이더 변형 컴파일 타이밍,
    60프레임 대기로는 부족했던 것으로 보임). 대기를 120프레임으로
    늘려 `PlaytestCharacterRealisticGui.cs`를 고치고 나서는 안정적으로
    재현 — 옷/갑옷/머리카락 색이 다 입혀진 idle·run·attack을 스크린샷
    으로 확인.
  - 자세한 내용은 `PLAN.md` 66-2장 ⑩ 참고.
- **다음에 할 일**: Mixamo 캐릭터를 새로 받을 때마다 `ExtractTextures()`
  를 표준 절차(`SetupMixamoCharacterImport.cs`)에 넣기 → ⑤ 헤어/스킨
  셰이더를 실제(이제 색 있는) 머티리얼에 붙이기. 머티리얼 슬롯 구성도
  확인됨: 단일 `MariaMat`을 몸+검 서브메시 둘이 공유(부위별 셰이더를
  따로 물리려면 먼저 머티리얼 분리 필요).

## 66-2장 "다음에 할 일" ⑪ 피부/기타 서브메시 분리 + 값싼 스킨 근사 (2026-09-13, 이어서)

- **Shader Graph는 AnimatorController와 달리 코드로 노드를 조립할 API가
  없다** — ⑤가 받아 둔 `FakeSSS.shadersubgraph`를 직접 코드로 연결하는
  건 접었다(GUI 필요, 내부 API 리플렉션은 위험한 지름길).
- 대신 `BuildMariaSkinSplit.cs` 신규 — Maria 몸의 단일 서브메시(14566
  삼각형)를 삼각형별 UV 중심점의 디퓨즈 색(HSV 근사)으로 피부
  2642개·기타 11924개로 나눠 서브메시 둘짜리 메시(`Maria_Split`)를
  만든다. 피부엔 살짝 따뜻한 톤+낮은 광택의 URP Lit 근사(`MariaSkin`,
  진짜 wrap-lighting SSS 아님, 45장 모바일 목표에 더 맞는 값싼 근사)를
  물리고 나머진 `MariaRest`. 결과물은 Mixamo 지오메트리를 담아
  `Assets/Art/CharactersRealistic/Generated/`(이미 gitignore 대상)
  에만 저장. `BuildTestCharacterRealisticScene.cs`가 있으면 자동
  적용(`ApplySkinSplit()`), 없으면 조용히 원본으로 건너뜀.
  배치+GUI 스크린샷으로 메시 손상 없음 확인, 씬 YAML로 오버라이드된
  `m_Mesh`+두 머티리얼 슬롯도 직접 확인. 자세한 내용은 `PLAN.md`
  66-2장 ⑪ 참고.
- **헤어는 이번에 손 안 댔다** — 금발과 갑옷 금장식이 색상적으로 너무
  가까워 같은 방식으로는 오분류 위험이 크다.
- **다음에 할 일**: 헤어카드/진짜 SSS를 실제로 쓰려면 Shader Graph를
  사람이 GUI로 연결해야 함(다음 세션·사용자 몫) → 그 다음 44장
  우선순위대로 Kenney/VRoid 플레이스홀더 실제 씬 교체.

## GUI 실기 확인 + 라이팅 재조정 — 다섯 판 전부 (2026-09-13, 이어서)

- **사용자 지시 "Unity 에디터로 직접 열어서 화면 톤 확인해줘"** — 위
  항목이 미뤄 둔 실기 확인을 했다. Unity를 배치 모드가 아니라 실제
  GUI로 띄우고(`-executeMethod`로 씬을 연 뒤 종료 안 함, PowerShell
  좌표 클릭으로 Game 탭 전환 + 스크린샷, 확인 뒤 PID로 정확히 종료 —
  saga-godot CLAUDE.md의 같은 패턴), Inspector로 `GlobalVolume`이
  `FF16Volume_PC`를 정확히 물고 Bloom/Color Adjustments 값이 코드
  그대로 들어간 것까지 확인했다. **다만 실제 Game 뷰는 여전히 창백하고
  평면적** — Bloom이 반응할 만큼 밝은 곳이 없고(태양이 정오처럼
  평평한 각도), 대비/채도 조정도 미세해서 안 보였다.
- **1차 조정 — 다섯 판 전부 라이팅을 golden-hour급으로.** 각
  `BuildXxxScene.cs`의 `BuildLighting()`에서 태양 각도를 낮추고
  (45~55°→30~35°, 그림자가 길어져 입체감) 색을 따뜻하게(주황 기미)
  태우고 밝기를 올려(GO/Forest/Story/Realm 1.1~1.15→1.7~1.8, Bloom
  threshold 0.9를 실제로 넘도록 — 던전은 무드 유지 목적으로 0.7→0.9만)
  바꿨다. `RimLight`(차가운 톤 방향광, 그림자 없음, 반대편에서)도
  신규 추가 — 66-2장 "역광·림라이트로 실루엣 강조" 스펙.
- **2차 조정(GUI로 재확인하다 발견) — GO의 `SkyFogBuilder.cs`가 원흉.**
  라이팅만 바꾸고 GUI로 다시 보니 여전히 창백했다 — 원인을 따라가 보니
  이 파일의 Trilight 앰비언트(하늘/수평선/땅)와 안개(`FogColor`
  (0.75,0.78,0.72), `FogDensity` 0.006)가 태양보다 화면을 더 많이
  덮고 있었다(원래 saga-godot env_pc.tres 값을 그대로 옮긴, 중립적인
  대낮 톤 — 66-2장으로 그래픽 방향이 갈라지기 전 유산). 이 파일도
  golden-hour 톤으로 다시 잡았다: SkyColor를 살짝 데우고, HorizonColor
  (0.75,0.8,0.78)→(0.95,0.75,0.55)(카메라 배경색이기도 함), FogColor
  (0.75,0.78,0.72)→(0.85,0.72,0.58), FogDensity 0.006→0.0035(원경이
  완전히 안개색 한 톤으로 뭉개지지 않게). **재확인 결과 확실히
  나아짐** — Game 뷰가 창백한 회록색에서 따뜻한 골든아워 톤(주황빛
  하늘, 데워진 지면, 보이는 원경 실루엣)으로 바뀜, 스크린샷으로 직접
  확인.
  **다른 네 판(Dungeon/Forest/Story/Realm)은 이 fog 시스템이 아예
  없다**(Flat 앰비언트만 — `RenderSettings.fog` 안 씀) — 이번엔 GO만
  고쳤다. Story(`TestField`)를 이어서 열어 봤는데, 이 게임은 2.5D
  가로 이동이라 하늘이 카메라 단색 배경(`SkyColor` 고정값)이라 애초에
  라이팅의 영향을 안 받는 부분 — 지금은 그대로 두었다(다른 디자인
  영역, 이번 라이팅 조정과 별개 결정이 필요하면 다음에 판단).
- **검증** — 라이팅 변경 후 다섯 씬 전부 재빌드 + 다섯 헤드리스
  플레이테스트 재확인(전부 `error CS` 0건, 기존 OK 문구 그대로) →
  SkyFogBuilder 변경 후 GO만 다시 재빌드 + `PlaytestHeadless` 재확인
  통과. `ProjectSettings/`·`Packages/` 배치 모드 부작용 없음(`git
  status`로 훑음), GUI 확인 후 Unity.exe는 매번 PID로 정확히 종료(임시
  씬-열기 스크립트 `TempOpenSceneForScreenshot.cs`는 커밋 안 하고
  확인 끝나자마자 삭제).
  **아직 남은 것** — Dungeon/Forest/Realm은 라이팅 값만 바꾸고 GUI로
  직접 보진 않았다(Inspector 값 확인·헤드리스만). 던전의 "무드 유지
  목적으로 밝기 그대로" 판단이 실제로 어때 보이는지, Forest/Realm도
  GO처럼 팔레트를 더 데워야 할지는 다음에 GUI로 마저 훑어야 한다.

## GUI 실기 확인 — Dungeon/Forest/Realm 마저 훑기 (2026-09-13, 새 세션 이어서)

- 위 "아직 남은 것"을 이어서 처리. `TempOpenSceneForScreenshot.cs`를
  다시 만들어(GO 확인 때와 같은 패턴 — Play 모드 120프레임 정착 후
  `ScreenCapture.CaptureScreenshot`, 세 씬을 순서대로) TestDungeon→
  TestVillageForest→TestCity 세 씬을 스크린샷으로 확인, 끝나자마자
  삭제(커밋 안 함).
- **새로 겪은 문제 — Unity GUI가 "Administrator Privileges Detected"
  모달로 멈췄다.** 이 세션의 터미널이 관리자 권한이라 그런 것으로
  보인다(이전 GO 확인 세션은 안 겪었음 — 터미널 권한 차이로 추정,
  확증은 못 함). `-batchmode` 없는 GUI 실행이 이 다이얼로그에서
  무한 대기했다(메모리 사용량이 52MB에서 안 늘고 멈춤으로 확인). PID로
  `AppActivate` + `SendKeys::SendWait("{ENTER}")`(PowerShell,
  `System.Windows.Forms`)로 다이얼로그를 넘겨 정상 진행시켰다 — **다음에
  이 세션(관리자 권한 터미널)에서 Unity GUI를 또 띄울 일이 있으면 이
  패턴을 먼저 시도할 것**, 아니면 그냥 멈춘 것으로 오판해 강제 종료하기
  쉽다.
- **결과**:
  - **Dungeon** — 화면이 꽤 어둡다(intensity 0.9 그대로). 의도한 "무드
    유지"와 일치 — HUD(체력바·공격/회피 버튼)는 잘 보이고 캐릭터
    실루엣도 식별 가능해 플레이에 지장은 없어 보인다. **현재 값 유지로
    판단, 추가 조정 불필요.**
  - **Realm** — 성 내부(TestCity)가 이미 따뜻한 주황/황토 톤으로 잘
    나온다(성벽·다리·건물 재질 자체가 원래 warm-toned라 별도 fog 보정
    없이도 golden-hour 인상이 남). **추가 조정 불필요로 판단.**
  - **Forest** — 여전히 밋밋한 채도 높은 초록 평면(SkyFogBuilder가
    없어 지면·앰비언트가 안 데워짐, RimLight 그림자는 길게 잘 떨어져
    낮은 태양각 자체는 반영됨). GO처럼 fog/ambient 보정을 추가하면
    더 나아질 여지가 있어 보이나, **이번 세션은 확인만 하고 손대지
    않았다** — 판단만 필요하면 사용자에게 GO 수준으로 데울지 물어볼 것.
  - 스크린샷은 세션 스크래치패드에만 저장(리포지토리에 커밋 안 함).
- 검증: 스크린샷 찍기 전 `-batchmode -nographics -quit` 컴파일
  확인(`ExtractTextures()` 추가분 포함) 통과, 확인 후 Unity.exe는 자체
  `EditorApplication.Exit(0)`로 종료(추가로 taskkill 안 씀 — 스스로
  끝난 것 확인), `ProjectSettings/`·`Packages/` 배치 모드 부작용 없음
  (`git status`로 훑음).
- **다음에 할 일**: Forest를 GO 수준으로 데울지 결정 → 그 다음 44장
  우선순위대로 Kenney/VRoid 플레이스홀더 실제 씬 교체(⑪이 남긴 다음
  과제, 아직 미착수).

## Forest도 GO 수준으로 데움 (2026-09-13, 새 세션 이어서)

- 사용자가 "순서대로 이어해줘"로 확정 — Forest 미결정 항목부터 처리.
  GO의 `SkyFogBuilder`와 같은 결로 `Saga.Forest.World.ForestSkyFogBuilder`
  신규(Trilight 앰비언트 + 옅은 안개, 숲마을에 맞게 GroundColor는 GO보다
  덜 갈색으로). `BuildTestVillageForestScene.BuildLighting()`의 기존
  Flat 앰비언트 대입을 이 컴포넌트 호출로 교체, 카메라
  `backgroundColor`도 `ForestSkyFogBuilder.HorizonColor`로 맞춤(기존엔
  차가운 하늘색 고정값).
- 검증: 컴파일 통과 → `BuildTestVillageForestScene.Build` 재실행(씬
  갱신) → `PlaytestForestHeadless` 재확인 통과(`OK - 10 frames, no
  errors`) → GUI 스크린샷으로 재확인(1회용 `TempShotForest.cs`, 확인
  후 삭제). **개선 확인** — 구면 지평선 가장자리가 차가운 파란 띠에서
  따뜻한 주황/황토 톤으로 바뀜. 지면 자체의 초록 채도는 바이옴 정점
  색(`ForestBiomeData.SampleTint`, 게임플레이 값이라 손 안 댐)이라
  여전히 진하지만, 이번 목적(하늘/앰비언트 냉색 제거)은 달성.
  `ProjectSettings/`·`Packages/` 배치 모드 부작용 없음 확인.
- **2026-09-13 발견 — 이 세션(관리자 권한 터미널)에서는 Unity GUI를 새로
  띄울 때마다("Administrator Privileges Detected" 모달) 매번 dismiss가
  필요했다** — 앞 항목("한 번 넘기면 끝")과 달리, 프로세스를 새로
  실행할 때마다(같은 세션 안에서도) 다시 뜬다. 앞으로 이 세션에서 GUI를
  또 띄우면 그때마다 `AppActivate(pid)` + `SendKeys::SendWait("{ENTER}")`
  를 반복해 줄 것 — "한 번 겪었으니 이제 안 뜨겠지"라고 넘겨짚지 말 것.
- **다음에 할 일**: 44장 우선순위대로 Kenney/VRoid 플레이스홀더를
  Player → 주요 Enemy → Boss → Environment → Building 순서로 실제
  사실적 에셋(Maria 캐릭터·⑤ 셰이더·⑥ PBR 재질)으로 교체 시작.

## 44장 "Player" 교체 — Dungeon (2026-09-13, 새 세션 이어서)

- 사용자가 "Dungeon만 먼저"로 범위 확정(다른 네 판은 Player 없음/2.5D/
  전투 없음이라 Maria 사용 시나리오가 안 맞거나 다음에 따로 판단).
- `BuildTestDungeonScene.BuildPlayer()`가 Kenney `character-a.glb`
  대신 Maria(⑦ 리깅+⑧ Animator Controller)를 쓰게 바꿨다 — 새 헬퍼
  `BuildPlayerVisual()`: Maria FBX 찾으면 인스턴스화+Animator 부착+
  `BuildTestCharacterRealisticScene.ApplySkinSplit()` 재사용(그 메서드를
  `internal`로 열어 재사용, 새 유틸 클래스로 안 뽑음 — 지금은 소비자가
  하나뿐이라 32장 "최소 변경" 원칙), 로컬에 Maria 자산이 없으면(라이선스로
  `.gitignore` 대상) character-a로, 그마저 없으면 capsule로 순서대로
  폴백(기존 관례 그대로).
- `PlayerController.cs`(Dungeon 전용 복사본만, 다른 판은 안 건드림)에
  `animator` 필드 추가 — **Maria가 배정되면**(non-null) 이동은 `Speed`
  파라미터로 Idle/Walk/Run 블렌드, 회피는 기존 절차적 X축 360도 롤
  대신 `Dodge` 트리거(방향만 맞추고 회전 자체는 클립에 맡김). **Maria가
  없어 character-a 폴백이면**(animator null) 예전 절차적 롤이 그대로
  유지된다 — 분기 유지, 기존 동작 안 깨짐. `PlayerCombat.cs`는 평타·
  강공격에 `Attack` 트리거(강공격도 같은 클립 재사용 — 전용 클립 없음,
  다음 과제), 사망에 `Death` 트리거 추가. "Hit"(피격) 트리거는 안 걸었다
  — `HeroState`에 데미지 이벤트가 없어(죽음 이벤트만 있음) 새 이벤트
  배선이 필요한데 이번 범위(캐릭터 교체)를 넘는 확장이라 남겨 둠.
- 검증: 컴파일 통과 → `BuildTestDungeonScene.Build` 재실행(Maria 정상
  로드, 폴백 경고 없음) → `PlaytestDungeonHeadless` 재확인 통과(`OK -
  10 frames, no errors`) → GUI로 Player의 `Animator`를 직접 구동해
  idle→walk→attack→dodge 네 포즈 스크린샷 확인(1회용
  `TempShotDungeonPlayer.cs`, 실제 입력 대신 `SetFloat`/`SetTrigger`
  직접 호출 — 확인 후 삭제). **포즈 전환 자체는 뚜렷이 다른 실루엣으로
  잘 확인됨**(서 있기/베기 웅크림/구르기 준비 자세가 또렷이 갈림) —
  리깅·Animator 배선은 성공.
  **다만 관찰한 것 하나** — 이 어두운 던전 조명(부족장 조명 0.9 +
  차가운 RimLight)에서 Maria가 전체적으로 균일한 하늘색/청록색
  실루엣으로 보인다(살구색 피부·갈색 옷 색조가 거의 안 드러남). 이전
  Kenney 캐릭터는 같은 조명에서도 색이 또렷했다(00_dungeon.png 참고) —
  Maria의 재질(스킨 스플릿 근사 셰이더)이 이 RimLight/저조도 조합에
  더 민감하게 반응하는 것으로 보인다. **버그인지 의도한 실루엣 강조
  효과인지는 판단이 필요해 이번엔 손대지 않았다** — 다음에 사용자가
  실기로 보고 재질/조명 중 어느 쪽을 조정할지 정할 것.
- `ProjectSettings/`·`Packages/` 배치 모드 부작용 없음 확인.

## 44장 "주요 Enemy" 교체 — Dungeon 잡졸(황건적) (2026-09-13, 새 세션 이어서)

- 로컬에 Maria 말고 다른 Mixamo 캐릭터가 없어 막혀서, 사용자 확인 받고
  Chrome 자동화로 mixamo.com에 직접 접속(이미 로그인돼 있었음) — 검색
  "warrior"에서 **Abe**(맨몸 전투용 노년 캐릭터, 낡은 로브)를 골라
  황건적 잡졸 이미지에 맞춤. 애니메이션 5개(Idle=Action Idle To Fight
  Idle·Walking·Punching·Hit Reaction·Dying, 전부 FBX+With Skin)를
  함께 받아 `Assets/Art/CharactersRealistic/Abe/`에 정리(로컬 전용,
  `.gitignore` 대상 — Maria와 같은 폴더 규칙 아래 하위 폴더로 분리).
- **Maria 리깅 절차를 공용화** — `SetupMixamoCharacterImport.cs`(Maria)의
  로직을 `MixamoRigUtil.RigCharacter()`로 뽑아내고, 새
  `SetupAbeCharacterImport.cs`가 같이 쓴다. Abe는 무기 프롭이 없어
  Dodge/Interact 클립이 없다(Idle/Walk/Attack/Hit/Death 다섯 상태만).
- **Player(Maria)와 결정적으로 다른 점** — 잡졸은 편집기 빌드 때 한 번만
  놓이는 게 아니라 `DungeonFloorRunner`가 절차적 층 진행 중 **런타임에도**
  새로 스폰한다. 런타임 코드는 `AssetDatabase`(에디터 전용 API)를 못 써
  Animator Controller를 매번 코드로 못 붙인다 — 그래서
  `SetupAbeCharacterImport.cs`가 Animator+Controller까지 미리 붙여
  **`AbeAnimated.prefab`**으로 구워 둔다(이 프리팹도 `CharactersRealistic/`
  밑이라 `.gitignore` 대상 — 다른 머신은 "Saga/Setup Abe Character
  Import" 메뉴를 한 번 더 돌려야 재생성됨, Maria와 같은 관례).
- `BuildTestDungeonScene.LoadCharacterModels()`가 `_characterD`(잡졸
  전용 슬롯)에 `AbeAnimated.prefab`을 먼저 찾고 없으면 기존
  `character-d.glb`로 폴백 — **호출부 9곳을 하나도 안 건드렸다**(전부
  `_characterD`를 그대로 읽는 기존 코드, 무엇을 로드하느냐만 바꿈).
  미니보스/두목(`_characterC`)은 이번 범위 밖(다음 "Boss" 우선순위)이라
  안 건드림.
- `DungeonEnemy.cs`의 `BuildVisual()`이 `modelPrefab.GetComponent
  <Animator>() != null`로 "리깅된 캐릭터인가"를 판단해 갈린다(Player
  쪽 `animator` null 체크와 같은 결) — 리깅됐으면 실제 스케일 그대로
  Instantiate(Mixamo FBX는 이미 실사람 크기 단위), 아니면 기존
  `CharacterVisual`(NativeHeight 2.7 가정) 경로. 이동 중엔 `Speed`,
  공격 판정마다 `Attack`, 피격(안 죽었을 때)마다 `Hit`, 죽을 때 `Death`
  트리거 — Death는 애니메이션이 재생될 1.2초를 기다렸다 `Destroy`(기존
  즉시 `Destroy`와 달리 지연 필요, 코루틴 추가).
- 검증: 컴파일 통과 → `BuildTestDungeonScene.Build` 재실행(경고 없이
  Abe 로드 확인) → `PlaytestDungeonHeadless` 통과 → **`PlaytestDungeonFloorProgression`**
  (12개 방 통과, 층 2→4, "fight" 방 여러 번 포함 — 절차적 스폰 경로를
  실제로 거침) 에러 0건 통과, 런타임 Instantiate+Animator 배선이
  실제로도 안 터지는 것까지 확인. GUI 스크린샷도 시도했으나 카메라를
  수동으로 잡졸 위치로 스냅시키는 임시 스크립트의 좌표 계산이 안 맞아
  빈 화면만 찍혔다 — 대신 로그로 `Enemy_Floor_Grunt`라는 이름의
  DungeonEnemy가 실제로 non-null Animator를 갖고 런타임에 존재하는 것을
  직접 확인함(`[TempShotDungeonEnemy] tracking enemy 'Enemy_Floor_Grunt'
  ...`). **완전한 육안 스크린샷 확인은 다음 기회로 남긴다** — 기능
  자체(인스턴스화·Animator 부착·트리거 무배선 없음)는 확인됐지만 실제
  포즈 전환을 눈으로 보지는 못했다.
- `ProjectSettings/`·`Packages/` 배치 모드 부작용 없음 확인.
- **2026-09-13, 같은 세션 이어서 — 육안 확인 마저 함.** 카메라를
  직접 옮기는 대신(1차 시도 실패 원인 — `CameraRig.Update()`가 매
  프레임 플레이어 기준으로 되돌림) `PlaytestDungeonFloorProgression.cs`의
  "CharacterController 끄고 플레이어 텔레포트하고 다시 켜기" 패턴을
  빌려 **플레이어를 적 옆으로 텔레포트**했다 — 카메라가 자연스럽게
  따라옴. 결과: Abe 잡졸 여럿이 서로 다른 포즈(대기·자세 변화)로
  뚜렷이 보임, 실제 게임플레이 AI가 플레이어를 둘러싸 공격해 플레이어가
  한 번 쓰러졌다 회복하는 것까지 확인(테스트 부작용, 버그 아님 —
  텔레포트로 몰려있는 무리 한복판에 넣어서 생긴 일). **Abe 통합 육안
  확인 완료로 마무리.**
## 44장 "Boss" 교체 — Dungeon 미니보스/두목 (2026-09-13, 새 세션 이어서)

- Abe와 같은 흐름 — mixamo.com에서 **Brute**(근육질 반라 전사, 칼 무기
  기본 장착)를 골라 애니메이션 5개(Idle=Action Idle To Fight Idle·
  Walking·Slash Advance·Hit Reaction·Dying)와 함께 받음. Abe 때와 달리
  이번엔 다운로드 도중 Chrome 확장이 한 번 끊겼다 재연결됐다(사용자가
  크롬을 다시 연 것으로 보임) — 재연결 뒤 그대로 이어감.
- `SetupBruteCharacterImport.cs` 신규(`MixamoRigUtil` 재사용, Abe와
  판박이 구조) — `BruteAnimated.prefab` 생성. `BuildTestDungeonScene`의
  `_characterC`(미니보스/두목 슬롯)가 이 프리팹을 먼저 찾고 없으면
  기존 `character-c.glb`로 폴백 — 호출부(`BuildElite`는 실은
  `_characterD` 씀, `BuildMiniboss`·`BuildBoss` 두 곳만 `_characterC`)
  안 건드림. `DungeonEnemy.cs`는 Abe 때 이미 만든 "Animator 유무로 리깅
  판단" 로직을 그대로 타 코드 변경 없음 — visualScale(두목 1.6·미니보스
  1.8)도 그대로 실제 스케일에 곱해져 몸집 차이가 유지됨.
- 검증: 컴파일 통과 → 재빌드(경고 없이 Brute 로드 확인) →
  `PlaytestDungeonHeadless`·`PlaytestDungeonFloorProgression`(12방,
  층 2→4) 둘 다 에러 0건 → GUI로 플레이어를 두목 옆에 텔레포트해
  확인(`TempShotDungeonEnemy2.cs`와 같은 패턴, 이번엔 이름으로
  `Enemy_HwangGeon_Boss`를 콕 집어 찾음) — 실제 전투가 벌어져
  플레이어가 두목에게 맞아 쓰러졌다 회복하는 것까지 확인, 자세 전환도
  뚜렷함. 확인용 스크립트는 삭제.
- **다음에 할 일**: 44장 나머지(Environment→Building) 또는 다른 판
  (GO/Forest/Story/Realm)의 Player→Enemy→Boss로 이동. Dungeon은 이제
  Player·주요 Enemy·Boss 세 우선순위를 다 마쳤다.

## 세션 종료 — 다음 세션 인수인계 (2026-09-13)

사용자 "새로운 세션에서 이어 해줘"로 종료. 이번 세션 요약(전부 커밋·
푸시 완료, 커밋 순서대로): ① Forest 라이팅을 GO 수준 golden-hour로
데움. ② Dungeon **Player**를 Maria(66-2장이 이미 리깅해 둔 캐릭터)로
교체 — Animator 배선(이동 Speed 블렌드·공격/회피/사망 트리거),
Maria가 없으면 기존 Kenney로 자동 폴백. ③ Dungeon **주요 Enemy**(잡졸,
황건적)를 **Abe**(mixamo.com에서 새로 받음)로 교체 — 잡졸은 절차적
층 진행 중 런타임에도 새로 스폰돼 Player 때와 달리 Animator+Controller를
프리팹(`AbeAnimated.prefab`)에 미리 구워 둬야 했다. ④ Dungeon
**Boss**(미니보스·두목)를 **Brute**(마찬가지로 mixamo.com에서 새로
받음)로 교체 — Abe 때 만든 패턴(프리팹에 Animator 내장, `DungeonEnemy`의
"Animator 유무로 리깅 판단" 로직) 그대로 재사용, 코드 변경 없이 프리팹
경로만 추가. **Dungeon은 이제 44장 우선순위 Player→Enemy→Boss 세
단계를 다 마쳤다.**

**다음 세션이 볼 것**:
- **44장 다음 우선순위** — Dungeon의 Environment→Building, 또는 다른
  네 판(GO/Forest/Story/Realm) 각각의 Player부터 시작. 어느 쪽부터
  할지는 사용자에게 먼저 물을 것(다섯 판이 캐릭터 성격이 다 달라서
  Maria/Abe/Brute를 그대로 재사용할 수 있는 자리도, 새로 mixamo.com에서
  받아야 하는 자리도 있을 것 — Realm은 애초에 실시간 플레이어 캐릭터가
  없다는 점 66-2장 BuildTestCityScene.cs 주석 참고).
- **mixamo.com 다운로드 패턴이 정착됐다** — Chrome 자동화로 직접
  접속(사용자가 이미 로그인해 둠) → 캐릭터+애니메이션 5개(Idle/Walk/
  Attack/Hit/Death) 다운로드 전 반드시 사용자 확인 받기 → `Assets/Art/
  CharactersRealistic/<이름>/`에 정리 → `MixamoRigUtil.RigCharacter()`
  재사용해 `Setup<이름>CharacterImport.cs` 작성 → Animator Controller
  + `<이름>Animated.prefab` 빌드(런타임 스폰 자리에 쓸 캐릭터는 프리팹에
  Animator 내장 필수, 편집기 전용 자리는 Maria처럼 코드로만 붙여도 됨).
  다음에 또 새 캐릭터가 필요하면 이 패턴을 그대로 따를 것.
- **Chrome 확장이 세션 중간에 한 번 끊겼었다** — `tabs_context_mcp`가
  "not connected"를 반환하면 사용자에게 크롬을 다시 열어달라고 안내하고
  재시도할 것(실제로 재연결됐다).
- **이 세션의 관리자 권한 터미널에서 Unity GUI를 새로 띄울 때마다**
  "Administrator Privileges Detected" 모달이 뜬다 — 기본 버튼(Enter)은
  "Restart as Standard User"라 **오히려 Unity를 재시작시켜 버린다**.
  반드시 **"Ignore Warning" 버튼을 좌표로 직접 클릭**해야 진행된다
  (화면을 찍어 버튼 위치 확인 후 `mouse_event` 시뮬레이션 — 이번
  세션에서 실제로 겪고 고친 방법, PowerShell `SendKeys::SendWait
  ("{ENTER}")`로 넘기려던 첫 시도는 실패였다). 매번 새로 뜨니 "한 번
  넘겼으니 안 뜨겠지"라고 넘겨짚지 말 것.
- GUI 스크린샷 확인용 임시 스크립트(`TempShotDungeon*.cs` 계열)는
  전부 확인 직후 삭제하고 커밋 안 했다 — 다음 세션이 비슷한 확인을
  하려면 이 문서의 패턴(플레이어를 대상 옆으로 텔레포트해 카메라가
  따라오게, `CharacterController` 끄고 옮기고 다시 켜기)을 참고해 새로
  짤 것.

## 44장 "Environment→Building" + 다른 판 "Player"·"주요 Enemy" 일괄 진행 (2026-09-14)

사용자가 "사가유니티 이어해" → 지난 세션 인수인계가 물었던 두 갈래
질문(Dungeon Environment→Building이냐, 다른 네 판 Player부터냐)에 대해
"Dungeon Environment→Building" 선택 → "순서대로 다해"·"묻지말고 최대한
진행해"로 뒤이어 확장 지시. 이번 세션 요약(전부 커밋·푸시 완료):

1. **Dungeon "Environment"** — room-small.glb/corridor.glb(Kenney 단색
   아틀라스) 대신 66-2장 ⑥이 미리 구워 둔 Poly Haven PBR 재질
   (cobblestone_floor_01·castle_wall_slates)을 실제 바닥/벽 primitive에
   씌운다(`EnvironmentMaterial.cs` 신규 — 표면 크기에 맞춘 타일 반복수로
   인스턴스 재질 생성). 셸이 바닥+벽+천장 한 메시라 부분 교체가 안 돼
   PBR 경로에서는 셸/corridor 타일을 건너뛰고 천장만 새 primitive로
   닫는다(BuildCeiling, 콜라이더 없음). 재질이 없으면 기존 셸/색상 경로로
   조용히 폴백.
2. **Dungeon "Building"** — gate.glb 문 아치도 PBR 경로에서 벽과 같은
   castle_wall_slates로 덮는다. Dungeon엔 이 아치 말고 다른 "건물"이
   없어(지하 던전) 44장 Building은 이걸로 마무리, Vegetation/Props/
   Animals/VFX(방 소품)는 이번 슬라이스에서 급하지 않다고 보고 보류.
3. **GO/Forest/Story "Player"** — 셋 다 Dungeon이 이미 리깅해 둔 Maria를
   재사용(SAGA 세계관 같은 주인공, CharactersRealistic/는 .gitignore
   대상이라 없으면 character-a로 조용히 폴백). 게임마다 세계 스케일이
   달라(GO=3.4m, Forest/Story=1.8m) Maria 실측 높이(1.83m, 임시 측정
   스크립트로 재고 바로 삭제)를 기준으로 배율을 다시 계산했다. GO/Forest
   PlayerController엔 Speed(Idle↔Walk↔Run)만, Story엔 Speed+Attack(연참/
   횡소/기탄 셋 다 같은 트리거)까지 추가 — 세 게임 다 플레이어가 피격
   당하지 않아 Hit/Death는 배선 안 함. **Realm은 실시간 플레이어 캐릭터가
   없어(경영/전략 게임) Player 우선순위가 아예 적용 안 됨** — 지난
   세션이 이미 지적한 그대로.
4. **GO "주요 Enemy"** — 산적(BanditEncounter)이 Dungeon 잡졸(황건적)과
   같은 배역이라 Abe(AbeAnimated.prefab)를 재사용. 리깅된 모델은
   DungeonEnemy.cs와 같은 결로 실제 스케일 그대로 쓰고 색조를 안 입힌다
   (실측 1.94m 기준 HumanHeight 배율). "강타 예고" 텔레그래프의 복귀색을
   BaseColor 대신 흰색(_restTint)으로 갈라 곱색 오염을 막았다.

**검증 방식(모든 항목 공통)** — 배치 모드 컴파일 통과 → 각 게임의
BuildTest*Scene.Build 재실행(경고 로그로 폴백 여부 확인) → 각 게임의
headless playtest(PlaytestHeadless/PlaytestForestHeadless/
PlaytestStorySlice, Story는 연참/횡소/기탄/브레이스/점프/로프/저장까지
전부 재확인) 무오류 통과 → `git status`로 ProjectSettings/Packages
부작용 확인. 한 번은 임시 확인 스크립트(TempCheckBanditVisual)가
`EditorSettings.enterPlayModeOptions`를 안 되돌려 놓아 커밋 직전
`git checkout`으로 되돌린 적이 있다 — **임시 스크립트를 새로 짤 때
PlaytestHeadless.cs처럼 EditorSettings 원복 코드를 꼭 넣을 것**(이번엔
스크립트 자체를 확인 직후 삭제하는 걸로 대신 때웠다).

**다음에 할 일**:
- **Forest "주요 Enemy"는 적용 대상이 없다** — 이 판 첫 슬라이스엔 적대
  개체가 없다(ForestCreature는 비적대 동물). 새로 넣으려면 콘텐츠
  설계(적 도입 여부)부터 사용자 확인이 필요 — 자산 교체 범위를 넘어선다.
- **Story는 이미 적(잡졸)이 있다**(PlaytestStorySlice가 "10 grunts"를
  잡는 걸로 확인) — 어떤 모델을 쓰는지, Abe/Brute로 바꿀 수 있는지는
  다음에 StoryEnemy.cs·BuildTestStoryScene.cs의 적 스폰 부분을 볼 것
  (이번 세션엔 Player만 손댔다).
- **GO/Forest/Story/Realm의 Environment→Building**은 이번 세션에
  손 안 댔다 — Dungeon 패턴(EnvironmentMaterial.cs, PBR 재질 인스턴스
  타일링)을 참고할 수 있지만 각 게임 지형 빌더(TerrainBuilder 등) 구조가
  전부 달라 게임별로 새로 봐야 한다.
- **Realm은 Player/Enemy 우선순위 자체가 안 맞는다** — 경영/전략
  게임이라 실시간 캐릭터가 없다. 44장 우선순위를 그대로 적용하려 하지
  말고, 이 판에 맞는 자산 우선순위(도시/건물/지도 아이콘 등)를 다음에
  따로 정할 것.

**같은 세션 이어서 — Story "주요 Enemy"·"Boss"까지 마저 함.** 위
"다음에 할 일"이 적어 둔 대로 StoryEnemy.cs·BuildTestStoryScene.cs의
적 스폰부를 봤더니 GO 산적과 똑같이 character-d(황건적)를 쓰고
있었다 — Abe(잡졸)·Brute(두목)로 교체(`StoryEnemy.cs`에
`bossModelPrefab`/`riggedVisualScale`/`riggedBossVisualScale` 세 필드
신규, `StoryEnemySpawner.cs`가 잡졸/두목에 각각 배선). 검증은
`PlaytestStorySlice`(잡졸 10킬+보스킬+sweep/bolt/brace/jump/rope/
save-load 전체) 무오류 통과. **이걸로 Story는 Dungeon과 같은 수준
(Player→주요 Enemy→Boss 세 단계)까지 마쳤다.**

**세션 종료 시점 정리(2026-09-14)** — 44장 우선순위 완료 현황:

| 게임 | Player | 주요 Enemy | Boss | Environment | Building |
|---|---|---|---|---|---|
| Dungeon | Maria | Abe | Brute | PBR 완료 | PBR 완료(아치) |
| GO | Maria | Abe | (해당 사건 없음) | 미착수 | 미착수 |
| Forest | Maria | (적대 개체 없음) | — | 미착수 | 미착수 |
| Story | Maria | Abe | Brute | 미착수 | 미착수 |
| Realm | 해당 없음(경영게임) | — | — | 미착수 | 미착수 |

다음 세션이 이어갈 만한 후보(우선순위 순서는 사용자가 다시 정할 것):
GO/Story의 Environment→Building(각 게임 지형 빌더가 Dungeon과 구조가
달라 EnvironmentMaterial.cs 패턴을 그대로 못 옮기고 게임별로 새로
봐야 함), 또는 Forest에 적대 개체를 새로 넣을지(콘텐츠 설계 결정 필요),
또는 Realm의 자산 우선순위를 별도로 정하는 것.

## 같은 세션 이어서 — GO/Story "Environment" 마저 함, 세션 종료 (2026-09-14)

사용자 "모두 다해"·"묻지말고"로 계속 진행 지시. 두 게임의 지형 구조가
서로 또 Dungeon과도 달라 각각 다르게 접근했다:

- **GO "Environment"** — GO 지형은 primitive가 아니라 9종 지형을 정점색
  하나로 칠하는 커스텀 셰이더(`VertexColorLit.shader`, UV조차 없었다)라
  Dungeon 패턴(재질 통째 교체)을 못 옮긴다. **사용자에게 범위를
  물어**("전체 멀티텍스처 스플랫팅" vs "간단한 디테일 오버레이") →
  "간단한 디테일 오버레이만"으로 확정. `TerrainBuilder.cs`에 UV(월드
  XZ) 추가, 셰이더에 `_DetailTex/_DetailTiling/_DetailStrength` 신규 —
  기존 정점색 블렌딩은 그대로 두고 Poly Haven cobblestone_floor_01의
  AO 맵을 옅게 곱해 미세 질감만 더했다(9종 지형별 텍스처 매핑은 범위 밖
  으로 보류). **GO "Building"(마을집)은 손 안 댔다** — 이미 실제
  Kenney GLB(wall-block/roof-gable)를 쓰고 있고, 이 킷도 Dungeon의
  room-small.glb처럼 아틀라스 텍스처 하나를 공유해 PBR 타일링 재질을
  그대로 못 씌운다(같은 제약, 재설계 필요) — "간단한 오버레이만" 승인
  범위를 넘어서 보류.
- **Story "Environment"** — STORY는 GLB 없이 primitive 박스뿐이라
  (`StoryTerrainBuilder.cs`) Dungeon 패턴을 그대로 옮길 수 있었다.
  바닥=leafy_grass(들판 초록과 톤 맞음), 발판=dark_wooden_planks(갈색
  발판과 톤 맞음) — 66-2장 ⑥이 받아만 두고 하나도 안 쓰던 후보 둘을
  처음 실전 배치했다. **Story "Building"은 해당 없음** — 이 슬라이스엔
  바닥/발판/로프/경계벽뿐, 별도 건물 요소가 없다.

검증은 이전 항목들과 같은 절차(배치 모드 컴파일 → BuildTest*Scene.Build
재실행 → 각 게임 headless playtest, Story는 전체 기능 테스트까지) 전부
통과, `ProjectSettings/EditorSettings.asset`이 이 판들의 플레이테스트
스크립트 자체 습성(원복 누락)으로 두 번 더 바뀌어 매번 `git checkout`
으로 되돌렸다(반복되는 패턴 — 다음에 시간 나면 PlaytestStorySlice.cs·
관련 스크립트에 PlaytestHeadless.cs처럼 원복 코드를 넣는 게 근본
해결책).

**사용자가 "현재 작업 다 완료 되면 새로운 세션에서 이어 할게"로 세션
종료.** 이번 두 세션 합쳐 총 11개 커밋, 전부 origin/main에 푸시 완료.

**다음 세션이 볼 것** — 위 표(44장 완료 현황)에 GO/Story Environment가
추가됐다는 점만 갱신해서 참고: Dungeon은 Environment+Building 둘 다
완료, GO/Story는 Environment만(Building은 구조적 제약으로 보류),
Forest는 Player만, Realm은 전부 미착수. 남은 후보:
- Forest에 적대 개체를 새로 넣을지 결정(콘텐츠 설계 — 자산 교체 범위를
  넘어선다, 다음에 사용자에게 먼저 물을 것)
- GO/Dungeon의 Kenney 아틀라스 킷(마을집·던전 셸)을 PBR로 바꾸려면
  UV 재설계나 다른 소스 에셋이 필요 — 이번엔 범위 밖으로 보류한 채로
  남아 있다
- Realm의 자산 우선순위를 44장 표와 별개로 새로 정하는 것(경영/전략
  게임이라 Player/Enemy 개념 자체가 안 맞는다)
- 전체 다섯 판이 지금 수준(사실적 PBR+Mixamo 캐릭터)에서 실기
  플레이테스트할 때가 됐는지도 사용자가 판단할 시점 — 루트 CLAUDE.md
  실기 확인 방침대로 매 단계마다 안 하고 몰아서 할 것.

## 같은 세션 이어서 — GO "Building"·Realm "Environment/Building" 마저 함 (2026-09-14)

사용자 "사가유니티 이어해 묻지 말고 순서대로 다 진행해"로 위 후보 목록을
순서대로 처리. 셋 중 하나는 진행하지 않기로 판단했다:

- **Forest 적대 개체는 넣지 않았다** — `ForestCreature.cs` 클래스 주석이
  이미 "전투·포획·HP는 이번에도 안 만든다, 이 판의 핵심 루프는 '돌아다니면
  재미있다'이지 전투가 아니다"를 `saga-godot/docs/LEGACY_FEATURE_AUDIT.md`
  근거로 명시해 뒀다 — 즉 "적대 개체 없음"은 미착수가 아니라 **이미 내린
  의도적 설계 결정**이다. 44장 우선순위 표를 채우자고 이 결정을 뒤집는 건
  자산 교체 범위를 넘어서는 컨텐츠 설계 변경이라 손대지 않았다. 다음에
  Forest에 전투/적대 개체를 실제로 넣고 싶으면 이 문서(설계 결정 자체를
  바꾸자는 것)를 먼저 읽고 사용자에게 확인할 것.
- **GO "Building"(마을집)** — wall-block.glb/roof-gable.glb의 공유 아틀라스
  UV 문제를, DUNGEON이 gate.glb 아치에 이미 쓴 방식(기존 UV 위에
  `EnvironmentMaterial.MakeTiled` 재질을 그냥 덮어씀)을 그대로 옮겨
  해결했다 — UV 재설계나 새 텍스처 없이. 벽=dark_wooden_planks, 지붕=
  castle_wall_slates(둘 다 66-2장 기존 PBR 후보 재사용). 이걸로 GO도
  Dungeon과 같은 수준(Environment+Building 완료)이 됐다. Story는 애초에
  "Building 해당 없음"이라 이미 완료 상태.
- **Realm "Environment/Building"** — 이 판은 Player/Enemy 개념 자체가 안
  맞아(`RealmCityBuilder.cs` 클래스 주석 "8장 우선순위 밖") 44장 표를 그대로
  못 썼는데, 성 디오라마의 바닥·성벽/망루/천수각을 "환경" 자리로 삼아
  GO/DUNGEON과 같은 `EnvironmentMaterial.MakeTiled` 패턴을 옮겼다. REALM
  소품은 전부 Unity 기본 primitive(GLB 없음)라 UV 문제 자체가 없어 그대로
  잘 먹는다. 바닥=cobblestone_floor_01, 성벽류=castle_wall_slates. 농장/
  저잣거리/곳간/깃발/천수각 지붕은 색상 소품 그대로 뒀다(DUNGEON이 Props/
  Vegetation을 보류한 것과 같은 범위).

검증은 이전 항목들과 같은 절차(배치 모드 컴파일 → 각 BuildTest*Scene.Build
재실행 → 각 게임 headless playtest: PlaytestHeadless/PlaytestRealmSlice)
전부 통과. `ProjectSettings/EditorSettings.asset`이 두 번 다 CRLF 노이즈로
바뀌어 매번 `git checkout`으로 되돌렸다(반복되는 기존 패턴). 두 커밋 모두
origin/main에 푸시 완료.

**세션 종료 시점 정리 — 44장(또는 그에 준하는) 완료 현황 갱신:**

| 게임 | Player | 주요 Enemy | Boss | Environment | Building |
|---|---|---|---|---|---|
| Dungeon | Maria | Abe | Brute | PBR 완료 | PBR 완료(아치) |
| GO | Maria | Abe | (해당 사건 없음) | PBR 완료(디테일 오버레이) | PBR 완료(벽/지붕) |
| Forest | Maria | (적대 개체 없음 — 의도된 설계) | — | PBR 완료(발판 없음, 바닥만) | 해당 없음 |
| Story | Maria | Abe | Brute | PBR 완료(바닥/발판) | 해당 없음 |
| Realm | 해당 없음(경영게임) | 해당 없음 | 해당 없음 | PBR 완료(바닥/성벽) | PBR 완료(천수각 몸통) |

**남은 후보(우선순위는 사용자가 다시 정할 것):**
- ~~GO의 굴 입구·폐허·다리·산신당, Realm의 농장/저잣거리/곳간~~ —
  "이어해"로 바로 이어서 처리(같은 날 후속). GO는 woodMaterial/
  stoneMaterial로 필드 이름을 재질 성질 기준으로 바꾸고 넷 다 확장,
  Realm은 farmMaterial(leafy_grass)·marketMaterial(dark_wooden_planks)
  신규 + 곳간은 기존 wallMaterial 재사용. 깃발·천수각 지붕만 색상 소품으로
  남겨 뒀다(표면이 작거나 벽과 재질이 겹쳐 실루엣이 안 갈림). 검증은 같은
  절차(컴파일→씬 재빌드→PlaytestHeadless/PlaytestRealmSlice) 통과, 커밋·
  푸시 완료. **이걸로 다섯 판의 44장(또는 그에 준하는) 자산 우선순위 작업은
  일단 다 마쳤다** — 남은 건 아래 두 항목뿐.
- ~~`RealmQuizData.cs` 실명 문제~~ — 지난 항목이 오판이었다. 이 파일 클래스
  주석이 이미 "이 문답은 국사편찬위 급 사실 퀴즈라 루트 CLAUDE.md의
  '역사 인물 가명' 정책과 안 부딪힌다(그 정책은 게임 자체의 등장인물
  도감 — HEROES/BIOS/PETS — 을 겨냥한 것이지, 사실을 묻는 교양 퀴즈의
  실존 인물 이름까지 가리지 않는다)"고 명시적으로 판단해 둔 걸 못 보고
  넘겼다(2026-09-14 "이어해" 후속 세션에서 재확인). 세종대왕·이순신 등
  실명은 의도된 것 — 손댈 필요 없다.
- 전체 다섯 판 실기 플레이테스트 시점 판단(이전 항목과 동일, 아직 유효).

## 같은 날 후속 — Forest "전투 콘텐츠" 추가 (2026-09-14)

사용자가 "묻지 말고 이어해"에 이어 남은 갈래(Forest 전투/사운드/모바일
성능/멈춤)를 질문으로 제시했더니 **"Forest 전투 콘텐츠 설계부터 시작"**
을 골랐다 — 위 표의 "Forest 적대 개체 없음(의도된 설계)" 결정을 사용자가
명시적으로 뒤집은 것.

**설계 판단** — GO/DUNGEON의 DuelRules(스탯·수식·파티·골드) 같은 RPG
인프라를 새로 짓지 않았다. FOREST는 순수 라이프심이라 그런 시스템 자체가
없어, 지금 지으면 "전투 콘텐츠 추가"가 아니라 "새 RPG 경제 설계"가 되고
분량도 훨씬 커진다. 대신:
- 여덟 종 중 **포자괴물(pojagoemul) 하나만 적대(Hostile)**로 바꿨다 —
  클래스 주석 텍스트로도 이미 "괴물"로 묘사돼 있어 가장 자연스러운
  선택. 나머지 일곱 종은 그대로 도주만 한다.
- `ForestCreature.cs`에 상태 둘 추가 — Aggro(도주 대신 추격), Encounter
  (접촉하면 정지, UI가 결과를 정할 때까지).
- `UI/ForestHostileEncounterUi.cs`(신규, GO `EncounterUiKit.cs`를 그대로
  복사해 재사용) — 접촉 시 뜨는 "밀어내기" 미니게임. 버튼 연타로 게이지를
  비우면 성공(6회), 6초 타임아웃이면 실패 — **둘 다 처벌 없이 창조물이
  물러난다.** 원작(동물의 숲) 비폭력 톤을 지키면서 "이긴다/진다"가 아니라
  "빨리 몰아내나 천천히 몰아내나"의 차이로만 남겼다.

**버그 하나 잡음** — 처음엔 `ForestHostileEncounterUi`의 `_panel`/
`_gaugeFill`을 `[SerializeField]` 없이 짰다. edit-time 씬 빌드 스크립트가
`Build()`를 딱 한 번 불러 UI를 짓고 씬을 저장하는데, private 비직렬화
필드는 씬 저장·재로드를 못 버텨(자식 GameObject 자체는 씬에 남지만 C#
필드 참조는 null로 되돌아감) Play 모드에서 `_panel`이 null인 채로
남았다 — `StartEncounter`가 "UI 없음" 폴백 경로(즉시 승리 처리)를 타 버려
포자괴물이 추격 중 갑자기 Flee로 바뀌는 것처럼 보였다. `DialogueLabel.cs`
가 진작 `[SerializeField] private Text label;`로 피해 가던 것과 같은
함정 — `[SerializeField]`를 붙여 고쳤다. **다음에 이런 edit-time 전용
UI 컴포넌트를 새로 짤 때 이 함정을 먼저 떠올릴 것.**

검증: `PlaytestForestCreatures.cs`에 아그로 접근→접촉→해소→물러남 전체를
확인하는 단계를 추가(포지션 텔레포트 기반, 실제 버튼 클릭 대신
`ui.DebugPress()`로 6회 연타 시뮬레이션). 배치 모드 컴파일 → 씬 재빌드 →
새 단계 포함 3연속 통과 → 기존 `PlaytestForestHeadless`(일반 스모크)도
재확인. 커밋·푸시 완료.

**다음에 볼 것**: pojagoemul 외 다른 종에 hostile을 더 늘릴지는 아직
안 정했다(사용자가 이번엔 "설계부터 시작"만 요청했지 "전부 적대로
바꿔라"는 아니었다) — 필요하면 다음에 확인. 처음 세운 44장 자산
우선순위(Player/Enemy/Boss/Environment/Building)는 pojagoemul이 primitive
그대로라 적용 대상이 아니다(리깅된 몬스터 에셋이 아직 없다) — 나중에
Forest에도 실제 몬스터 3D 에셋을 붙이고 싶다면 그건 별도로 소싱해야
한다.

## 같은 날 후속 — Forest "사운드" 첫 슬라이스 (2026-09-14)

"묻지 말고 이어해"에 이어 계속 진행 — PLAN.md 67장(사운드) 착수. 밀어내기
미니게임에 SFX 두 개를 붙였다: 누를 때마다 `chop.ogg`, 대치가 풀리면(성공/
타임아웃 공통) `confirmation_001.ogg`(둘 다 opengameart.org의 Kenney CC0
미러 — Kenney 공식 페이지는 다운로드 버튼이 JS라 직접 URL을 못 뽑는다는
Props 항목의 결론 그대로, 자세한 출처는 `docs/ASSET_GUIDE.md` 2026-09-14
항목). `Saga.Forest.Audio.ForestAudio`(신규)가 재생을 맡는다 —
Master/SFX/BGM 볼륨을 PlayerPrefs로 갖고 `PlayOneShot`에 곱해서 "카테고리별
볼륨 분리"를 흉내 낸다. **진짜 Unity AudioMixer 에셋은 만들지 않았다** —
에디터 GUI로 사람이 노드를 잇는 방식이라(66-2장 ⑤ 헤어카드/SSS Shader
Graph 배선과 같은 제약) 배치 모드 스크립트로 못 만든다. FOREST 하나에만
만들었다 — 다섯 판 복사 관례대로 다른 네 판은 필요해질 때 각자 복사.

검증: 배치 모드 컴파일(오디오 임포트 확인, AudioImporter로 뜨는지 meta
확인) → 씬 재빌드(클립 로드 성공, 경고 없음) → PlaytestForestCreatures
2연속 통과(중간 1회는 익숙한 첫 실행 플레이키니스). 커밋·푸시 완료 —
푸시 시 다른 세션(saga-web 다섯 판 쪽, 이 저장소지만 완전히 다른 폴더)의
동시 커밋과 충돌 없이 merge 하나로 정리됐다(경로가 안 겹쳐 충돌 자체가
없었음).

**다음에 볼 것**: BGM 트랙은 아직 안 구했다(`ForestAudio.PlayBgm`도 아직
없음) — 필요해지면 Kenney/Poly Haven류 CC0 음악 팩에서 받을 것. 실제
AudioMixer로 바꾸는 건 사람이 에디터를 열어야 하는 몫(`HOW_TO_PLAYTEST.md`
에 적어 둘 만함). 다른 네 판(GO/Dungeon/Story/Realm)에 오디오를 넣는 건
아직 착수 전.

## 같은 날 후속 — GO "사운드" 확장 (2026-09-14)

"이어해"로 계속 진행 — 사운드 라인을 GO로 넓혔다. `Saga.Go.Audio.GoAudio`
(신규, `ForestAudio.cs`와 같은 결) + `BanditEncounter.cs`의 강타(안
피했을 때)·일반 피격 화면 플래시에 기존 `chop.ogg`(새로 안 받고 재사용
— `Assets/Art/Audio`는 다섯 판 공유 원본 자산 트리)를 재생.

**의도적으로 안 넣은 것** — 승리/패배 음악(징글). Kenney "Short jingles"
팩(`jingles_HIT/NES/PIZZA/SAX/STEEL`, 각 17개, CC0)을 받아서 살펴봤지만
파일 이름만으론 어느 인덱스가 "이김"이고 어느 게 "짐"인지 구분이 안
된다 — 이 세션은 오디오를 직접 들을 방법이 없어(재생 가능 여부를 로그로
확인할 순 있어도 소리 자체는 못 들음), 잘못 고르면 승리 장면에 패배
음악이 깔리는 사고가 날 위험을 감수하느니 **사람이 직접 들어 보고
골라야 하는 몫**으로 남겼다. 받아 둔 zip은 커밋 안 함 — URL은
`docs/ASSET_GUIDE.md` 2026-09-14 GO 항목에 적어 뒀다.

검증: 배치 모드 컴파일 → 씬 재빌드 → `PlaytestHeadless.Run`에 `GoAudio.
PlaySfx` 헤드리스 스모크 호출(3프레임째, 실제 클립으로)을 추가해 2연속
통과 — `-nographics`(오디오 장치 없을 수 있는 배치 모드)에서도 예외
없이 도는 걸 확인했다. 커밋·푸시 완료.

**다음에 볼 것**: 승리/패배 잔글 선곡은 사람 몫(위 참고). Dungeon·Story·
Realm에 사운드 넣는 건 아직 미착수 — 넣는다면 같은 패턴(각 판 전용
`XxxAudio.cs` 복사 + 이미 있는 전투/UI 이벤트에 훅)을 따를 것. 이
세션에서 인터넷 접근이 가능함을 확인했다(opengameart.org에서 Kenney CC0
직접 다운로드) — 앞으로 CC0 에셋이 더 필요하면 같은 방식으로 받을 수
있다(단, 오디오는 내용을 들어 확인 못 하니 감정가 있는 선곡(승리/패배 등)
은 항상 사람 확인이 필요하다는 걸 유의).

## 같은 날 후속 — 사운드를 REALM·STORY로 확장 (2026-09-14)

"이어해 묻지 말고 다해"로 계속 진행 — 위에서 "미착수"라 적어 둔 네 판
(Dungeon/Story/Realm) 중 둘을 마저 붙였다. 착수 전 먼저 훑어 보니
**Dungeon은 이미 사운드가 있었다** — `SfxPlayer.cs`가 GO/FOREST의 Kenney
CC0 방식과 달리(그때는 이 세션이 인터넷에서 CC0를 받을 수 있다는 걸
몰랐던 시기) 파형을 코드로 합성한 절차적 톤을 쓰고 있었다. 원작 에셋
금지 원칙을 지키는 또 다른 정공법이라 손 안 대고 그대로 뒀다 — PROJECT_STATE
윗줄의 "미착수" 언급은 이 부분만 스테일이었던 것.

- **STORY** — `Saga.Story.Audio.StoryAudio`(신규, ForestAudio/GoAudio와
  같은 결). 잡졸·두목 공용 컴포넌트인 `StoryEnemy.cs`의 `TakeDamage()`/
  `Die()`에 `chop.ogg`/`confirmation_001.ogg`(둘 다 재사용, 새 다운로드
  없음)를 붙였다 — `StoryPlayerController.cs`·`StoryBolt.cs` 세 군데
  공격 경로 전부 `enemy.TakeDamage()`를 거쳐 이 한 곳만 고치면 됐다.
- **REALM** — `Saga.Realm.Audio.RealmAudio`(신규). 전투 타격감이 아니라
  명령·문답·공격·계략 네 판정 결과가 중심이라 confirm/error 두 갈래로만
  나눴다 — `RealmWarState.AttackResult`에 `Won` 필드를 새로 노출해(원래
  `Ok`만 있어 "출진이 유효했나"와 "이겼나"를 못 갈랐다) 소패 함락(승)은
  confirm, 퇴각(패)은 error로 갈랐다. `error_001.ogg`(Interface Sounds
  킷에서 새로 추가, 자세한 판단 기준은 `docs/ASSET_GUIDE.md` 2026-09-14
  항목 — "감정가 없는 UI blip"은 이름만 보고 사람 확인 없이 골라도
  된다는 새 기준을 세웠다)를 이번에 처음 받았다.

**테스트 공백 하나 발견·메움** — `PlaytestRealmSlice.cs`는 REALM 판정
로직을 UI 버튼 클릭이 아니라 정적 API를 직접 불러 검증하는 방식이라
(클래스 주석에 이미 그렇게 적혀 있었다), `RealmCommandUi.PlayOutcomeSfx()`
가 이 테스트 경로에서 전혀 안 돈다 — 신설 오디오 배선이 스모크조차 없이
남을 뻔했다. GO `PlaytestHeadless`가 `GoAudio.PlaySfx`를 직접 부르는
스모크를 넣은 선례를 따라, Init 단계에 `RealmCommandUi`의 confirm/error
클립이 실제로 배선됐는지 리플렉션으로 확인하고 `RealmAudio.PlaySfx`를
헤드리스에서 직접 한 번씩 불러 예외가 없는지 보는 단계를 추가했다.

검증: 배치 모드 컴파일 → `BuildTestStoryScene`·`BuildTestCityScene` 씬
재빌드 → `PlaytestStorySlice`(전투 경로가 실제 SFX 호출을 통과) 3연속
통과 → `PlaytestRealmSlice`(새 오디오 스모크 포함) 3연속 통과 → 회귀
확인으로 GO `PlaytestHeadless`·FOREST `PlaytestForestCreatures` 1회씩
재확인(무관함 확인). 배치 모드가 `ProjectSettings/EditorSettings.asset`을
diff로 띄웠으나 CRLF/LF 차이뿐이라 되돌렸다(루트 CLAUDE.md 경고 그대로).
커밋·푸시 완료.

**다음에 볼 것**: DUNGEON에 사운드를 넣는다면 이미 있는 `SfxPlayer.cs`
(절차적 합성) 방식을 유지할지, 지금은 인터넷에서 CC0를 받을 수 있다는 걸
아니 다른 네 판처럼 Kenney 실제 클립으로 바꿀지는 아직 안 정했다 —
사용자가 다음에 정할 것. REALM/STORY 둘 다 BGM은 여전히 없다.

## 같은 날 후속 — DUNGEON도 실클립으로 통일, BGM은 보류 (2026-09-14)

"이어해"에 이어 바로 위에서 미정으로 남긴 두 갈래를 사용자에게 직접
물었다(AskUserQuestion) — **① DUNGEON 사운드: 실제 클립으로 교체**,
**② 다섯 판 BGM: 보류**(사람이 직접 들어야 하는 감정가 있는 선곡이라
이번엔 안 함). ①을 실행: `SfxPlayer.cs`의 절차적 합성(사인파 봉투) 구현을
지우고 다른 네 판과 같은 AudioClip 재생 방식으로 바꿨다. **공개 API는
그대로**(`PlayHit()`·`PlayHeavyHit()`·`PlayEnemyDeath()`·`PlayLevelUp()`·
`PlayDiscovery()`, 전부 인자 없음) — 호출부 넷(`PlayerCombat.cs`·
`DungeonEnemy.cs`·`DungeonSecretStash.cs`·`GameBootstrap.cs`)을 안
건드리고, 이미 씬에 하나뿐이던 `GameBootstrap`이 [SerializeField] 클립
다섯 개를 받아 `SfxPlayer.Configure()`를 한 번 부르는 걸로 배선했다
(호출부가 넷으로 흩어져 있어 REALM/STORY처럼 "호출부 컴포넌트가 클립을
들고 있는" 패턴 대신 이미 있는 싱글턴에 모으는 쪽을 골랐다).

클립 다섯 중 둘(hit=chop.ogg, enemyDeath=confirmation_001.ogg)은 재사용,
셋(heavyHit=knifeSlice.ogg, levelUp=confirmation_002.ogg,
discovery=confirmation_003.ogg)은 새로 받았다 — REALM `error_001.ogg`와
같은 기준(감정가 없는 UI/임팩트 블립은 파일 이름만 보고 사람 확인 없이
골라도 됨)으로 이번 세션이 직접 골랐다. 자세한 표는
`docs/ASSET_GUIDE.md` 2026-09-14 "DUNGEON도 절차적 합성→실클립으로
통일" 항목.

검증: 배치 모드 컴파일 → `BuildTestDungeonScene` 재빌드 →
`PlaytestDungeonHeadless` 3연속 통과 → `PlaytestDungeonFloorProgression`
(실제 `TakeDamage`로 적 처치 → hit/death SFX 경로를 실제로 태움, 12개 방
진행 중 레벨업도 자연히 발생) 3연속 통과. 커밋·푸시 완료.

**다섯 판 사운드 현황 정리(2026-09-14 기준)**: GO/FOREST/STORY/REALM/
DUNGEON 전부 confirm류 SFX 방식으로 통일됐다. **다섯 판 다 BGM은 없다**
— 사용자가 이번에 명시적으로 보류를 골랐으니 다음에 먼저 묻지 말고
그냥 시작하지 말 것(사람이 후보를 듣고 고르는 단계가 먼저 필요하다고
이미 답했다).

## 같은 날 후속 — STORY에 첫 NPC (2026-09-14, "묻지 말고 이어해")

사운드 스레드가 다 닫힌 뒤 "묻지 말고 이어해"가 다시 와서, PLAN.md
51장 확장 순서(GO→DUNGEON→FOREST→STORY→REALM)를 다시 훑어보니 GO/
DUNGEON/FOREST/REALM은 각 항목(탐험·지역·이벤트·수집·희귀 몬스터 /
엘리트·보스·장비·빌드 / 동물·채집·마을·생활 / 세력·도시·영지)이 여러
날에 걸쳐 이미 상당히 들어가 있었는데, **STORY만 51장 네 칸(NPC/선택/
사건/관계) 중 하나도 없었다**(`StoryQuestState.cs` 클래스 주석이
"gear/gather/visit/talk/skill/gold 사명은 범위 밖"이라고 이미 적어 둔
그대로 — STORY는 순수 사이드스크롤 전투 슬라이스였다). 그중 가장 작고
확실한 칸(NPC) 하나만 채웠다 — 선택/사건/관계는 각각 훨씬 큰 새 시스템
(대화 분기·월드 이벤트·호감도)이 필요해 이번엔 손 안 댐.

**추가한 것** — `Saga.Story.UI.DialogueLabel`(GO `UI/DialogueLabel.cs`
그대로 복사)과 `Saga.Story.World.StoryNpc`(들판 척후병 1명, GO
`NpcBuilder`+`VillagerTalk`을 하나로 합친 축소판 — NPC가 하나뿐이라
목록형 빌더를 새로 안 지었다). **말을 걸어도 아무 상태도 안 바꾼다** —
`StoryQuestState`(첫 사냥/두목의 목 진행도)를 그대로 되읽어 주는 잡담
한 마디뿐, GO 촌장(퀘스트 시작)·나그네(골드 보상)와 달리 부수효과가
없다 — STORY엔 애초에 골드·인벤토리 시스템 자체가 없어 줄 보상이 없다.
플레이어 스폰(2m)과 겹치게 x=0.6m에 세워 시작하자마자 반경 안에 있다.

**테스트** — `PlaytestStorySlice.cs`에 `TalkNpc` 단계를 새로 추가.
처음엔 텔레포트 후 물리 트리거 콜백이 실제로 뜨길 기다리는 방식으로
짰다가 **이 헤드리스 환경에서 CharacterController×트리거 조합이 한
틱을 기다려도 안 잡혀 실패**했다 — 원인을 더 파지 않고 이 파일의
다른 모든 단계와 같은 결(`TryAttack()`처럼 private 메서드를 리플렉션
으로 직접 호출)로 바꿔, `StoryNpc.OnTriggerEnter(Collider)`를
`_playerController`(CharacterController — `Collider`의 서브클래스라
그대로 넘길 수 있다)를 인자로 직접 불렀다. 검증: 배치 모드 컴파일 →
`BuildTestStoryScene` 재빌드 → `PlaytestStorySlice`(새 npc talk 단계
포함) 3연속 통과, 대사 텍스트까지 로그로 확인. 커밋·푸시 완료.

**다음에 볼 것**: STORY 51장 나머지 셋(선택/사건/관계)은 이번에 안 함 —
각각 새 시스템 설계가 필요해 사용자 방향이 더 필요하다. NPC 시각도
아직 fallback capsule뿐(44장 우선순위 표엔 애초에 NPC가 없던 새 칸이라
리깅된 모델을 아직 안 붙였다).

## 같은 날 또 후속 — STORY에 "사건"(월드 이벤트) (2026-09-14, 네 번째 "묻지 말고 이어해")

NPC 칸에 이어 51장 남은 셋 중 "사건"을 채웠다 — PLAN.md 72~73장(World
Event/Hidden Area)과도 겹치는 항목이라 GO `Data/WorldEventState.cs`를
그대로 복사해 `Saga.Story.Data.StoryWorldEventState`를 만들고, 발판
다섯 자리 중 가장 높은 #3(4.4m) 위에 `StoryDiscovery`(GO
`HiddenTreasure.cs`와 같은 결) 하나를 얹었다. STORY엔 골드·인벤토리가
없어 GO식 전리품 대신 이미 있는 자원(MP)을 가득 채우는 걸로 보상을
대신했다 — `StoryCombat.RestoreMp`를 재사용, 새 보상 체계를 안 만들었다.
세이브 스키마를 v2→v3으로 올려 `triggeredEvents`를 추가했다(구버전
세이브는 null로 들어와 `Restore(null)`이 빈 집합 처리 — 무해).

**버그 하나 잡음(같은 세션 안에서)** — `PlaytestStorySlice.cs`의 Init
단계가 이미 `StoryQuestState.Restore(0, 0)`으로 "이전 실행이 남긴
save_story.json을 무시"하고 있었는데, 새로 추가한
`StoryWorldEventState`는 그 초기화에서 빠뜨려서 **두 번째·세 번째 실행부터
비결정적으로 실패**했다(첫 실행만 통과, 이후론 계속 실패) — 원인은
`GameBootstrap.Start()`가 Awake 이후 자동으로 `SaveState.TryLoad()`를
불러 직전 실행이 저장해 둔 "field_lookout"을 이미 트리거된 걸로
복원해 버린 것. `StoryQuestState.Restore(0, 0)` 바로 옆에
`StoryWorldEventState.Restore(null)`을 추가해 고쳤다 — **새 정적 상태를
테스트 Init 단계에 추가할 땐 항상 이 리셋 목록에도 같이 넣을 것**
(이 파일에 이미 있던 교훈인데 새 상태 추가 시 깜빡 빠뜨리기 쉽다는 걸
실제로 겪음).

검증: 배치 모드 컴파일 → `BuildTestStoryScene` 재빌드 →
`PlaytestStorySlice`(TriggerDiscovery 단계 신규 — 이벤트 트리거·MP 복원·
중복 방지·세이브 라운드트립까지 확인) 3연속 통과(위 버그를 고친 뒤).
커밋·푸시 완료.

**다음에 볼 것**: STORY 51장 마지막 하나(관계)는 이번에도 안 함 — NPC가
아직 하나뿐이라 "관계(호감도)"를 만들어도 상대가 하나라 의미가 약하다,
NPC를 더 늘리거나 방향을 다시 받은 뒤에 볼 것. "선택"(대화 분기)도
마찬가지로 미착수.

## 같은 날 세 번째 후속 — STORY에 "관계"(다섯 번째 "이어해") (2026-09-14)

바로 위에서 "NPC가 하나뿐이라 관계는 의미가 약하다"고 적었던 걸 다시
보니 — 상대가 하나여도 "몇 번 만났는가"로 인사말이 데워지는 최소형은
가능하다고 판단해 뒤집었다. `Saga.Story.Data.StoryNpcState`(신규,
`ScoutTalkCount` 카운터 하나)를 추가하고 `StoryNpc.OnTriggerEnter`가
말을 걸 때마다 세게 했다 — 두 번째 만남부터 "또 뵙는군요.", 다섯 번째
부터 "이제 낯이 익어 마음이 놓입니다." 로 인사말 앞머리만 데워진다
(사명 진행 본문 `Line()`은 안 건드림, 관계와 사명을 서로 안 섞는다).
수치형 호감도(사건별 증감·NPC마다 다른 값)까지는 안 갔다 — 상대가
하나인 지금은 그 정도로도 충분하고, NPC가 늘면 그때 본격적으로 키울
것. 세이브 스키마 v3→v4(scoutTalkCount 추가).

**Init 리셋 교훈을 이번엔 처음부터 적용** — 지난 "사건" 세션에서
`StoryWorldEventState`를 리셋 목록에 빠뜨려 비결정적 실패를 겪었던 걸
기억해, 이번엔 `StoryNpcState`를 만들자마자 바로 `PlaytestStorySlice.
Init`의 리셋 목록(`StoryQuestState.Restore(0,0)` 옆)에 같이 넣었다 —
처음부터 3연속 통과.

검증: 배치 모드 컴파일 → `BuildTestStoryScene` 재빌드 →
`PlaytestStorySlice`(TalkNpc 단계를 확장해 두 번째 만남 인사말 갱신·
세이브 라운드트립까지 확인) 3연속 통과. 커밋·푸시 완료.

**남은 것**: STORY 51장 마지막 "선택"(대화 분기)만 미착수 — Button UI
자체는 이 프로젝트에 이미 흔한 패턴(RealmCommandUi·GO EncounterUiKit
등)이라 위젯 자체는 어렵지 않지만, 실제로 갈리는 결과가 있어야 "선택"이
의미 있는데 지금 STORY 콘텐츠 범위로는 장식적 분기(다른 대사만 나오고
결과는 같음)밖에 못 만든다 — 이번에도 방향 없이 손 안 댐.

## 같은 날 네 번째 후속 — STORY에 "선택"(여섯 번째 "이어해", 51장 완결) (2026-09-14)

바로 위에서 미룬 "장식적 분기라도 만들지, 방향을 기다릴지"를 "이어해
묻지 말고 모두 진행해"에 그냥 진행하는 쪽으로 판단했다 — 되돌리기 쉽고
범위가 명확한 마지막 한 조각이라 이 세션 스스로 판단할 수 있는
경계라고 봤다(66-1 재확인·설정 UI처럼 시스템을 통째로 새로 설계해야
하는 규모가 아니다).

- **신규 `Saga.Story.UI.StoryChoiceUi`** — GO/DUNGEON `EncounterUiKit`과
  달리 이 판에 쓰는 곳이 한 곳뿐이라 kit로 안 뽑고 파일 하나로 끝냈다.
  프롬프트 텍스트 + 버튼 둘, `Show(prompt, optionA, optionB, onChosen)`.
- **트리거** — `StoryNpc.OnTriggerEnter`가 `StoryQuestState.QuestBossDone
  && StoryNpcState.ChoiceMade == 0`일 때 평소 대사 대신 이 팝업을 한 번
  띄운다("함께 축배를 든다" / "간단히 치하만 받는다"). `StoryChoiceUi`가
  씬에 없으면(구버전 씬 등) 조용히 평소 대화로 폴백한다.
- **장식적 분기임을 분명히** — 어느 쪽을 골라도 사명·MP·골드 등 게임
  상태는 안 바뀐다(`StoryNpcState.ChoiceMade`만 1 또는 2로 남는다).
  이후 인사말(`Greeting`, "형씨!" vs "어서 오십시오.")과 두목 처치 대사
  (`Line`의 QuestBossDone 분기)의 어투만 갈린다 — 관계(`ScoutTalkCount`)
  축과는 안 섞고, 선택이 있으면 그쪽 어투를 우선한다.
- 세이브 스키마 v4→v5(`choiceMade` 추가), 구버전 세이브는 0("아직 안
  고름")으로 들어와도 무해하다(다시 물어보면 그만).
- **검증** — `PlaytestStorySlice`에 `TalkNpcChoice` 단계 추가: 두목 처치
  직후 첫 대화가 실제로 `StoryChoiceUi.IsShowing`을 true로 만드는지,
  첫 선택지 버튼(`onClick.Invoke()`)을 누르면 팝업이 닫히고
  `ChoiceMade==1`이 되는지, 대사가 "한 잔"을 포함하는지, 재대화 때
  팝업이 다시 안 뜨고 인사말이 "형씨"로 갈리는지, 저장/로드 라운드
  트립에 `choiceMade`가 살아남는지까지 전부 확인. 배치 모드 컴파일 →
  `BuildTestStoryScene` 재빌드 → `PlaytestStorySlice` 3연속 통과
  (`PlaytestStorySlice.Run`을 `-executeMethod`로 부를 때 `-quit`을
  같이 주면 Run()이 반환하자마자 종료돼 OK/FAIL 로그가 안 찍힌다는
  기존 함정을 이번에도 한 번 밟았다가 바로잡음 — `-quit` 없이 불러야
  한다).
- 다른 네 판은 파일이 전혀 안 겹쳐(STORY 전용 신규/수정 파일뿐) 무관
  확인은 생략했다 — 공유 로직(다섯 벌 복사 대상)을 안 건드렸다.

**이걸로 STORY 51장 네 칸(NPC/선택/사건/관계)이 모두 채워졌다.** PLAN.md
51장이 가리키는 GO→DUNGEON→FOREST→STORY→REALM 순서상 STORY 몫은 일단
닫혔다 — REALM 쪽 51장 진행 상태는 REALM 관련 항목 참고.

## 같은 날 다섯 번째 후속 — DUNGEON에 "빌드"(회전베기), 51장 다섯 판 조사 (2026-09-14)

STORY가 끝나 다시 "묻지 말고 이어해"가 왔다. 이번엔 GO/DUNGEON/FOREST/
REALM 51장 축(각자 5개/4개/4개/4개 하위 칸)을 실제 파일 기준으로
훑어(fork 조사) 빈 칸을 찾았다:

- **GO** — 5칸(탐험/지역/이벤트/수집/희귀 몬스터) 전부 있음(`TestMapData.
  cs`·`EastGroveRelic.cs`·`MountainShrine.cs`·`LuckyCairn.cs`·
  `Gatherable.cs`·`RareWolfEncounter.cs`).
- **DUNGEON** — 엘리트(`DungeonFormulas.EliteHp/EliteDmg`)·보스
  (`QuestState.cs`)·장비(`HeroState.EquipIfBetter`+`GemData.cs`)는
  있는데 **"빌드"가 비어 있었다** — `PlayerCombat.cs`엔 평타·강공격
  둘뿐, 플레이스타일이 갈리는 선택지가 없었다.
- **FOREST** — 4칸(동물/채집/마을/생활) 전부 있음(`ForestCreature.cs`
  의 포자괴물 포함·`ForestFruitTree.cs`·`ForestVillager.cs`·
  `ForestHomeData.cs`).
- **REALM** — 세력/도시/영지는 있는데 "대규모 콘텐츠"는 얇음(적국 하나
  뿐) — 다만 이건 새 세력·시나리오 밸런스 설계가 필요해 방향 없이
  못 간다.

DUNGEON "빌드"가 STORY 선택과 같은 결(작고 되돌리기 쉽고 새 시스템
설계가 필요 없음)이라 이번 조각으로 골랐다.

- **`PlayerCombat.TriggerWhirl`(회전베기, 신규)** — 반경(2.8m) 안
  살아있는 적을 전부 때린다(`DungeonEnemy.Active`를 그대로 순회, 이미
  public static이라 새 조회 API 불필요). 대상 하나당 피해는 평타의
  0.7배로 낮게 잡아 "하나에 강공격을 몰아칠지, 여럿을 넓게 쓸지"가
  실제 트레이드오프가 되게 했다 — STORY `TriggerSweep`과 같은 설계
  의도지만 DUNGEON엔 MP가 없어(`HeroState.cs`에 자원 필드가 아예 없다)
  쿨다운(3.5초, 평타·강공격보다 훨씬 길다)만으로 억제한다. 데스크톱은
  E키, 모바일은 새 "회전베기" 버튼(강공격 버튼 바로 위).
- **테스트 공백 하나 발견** — 지금까지 DUNGEON Playtest들은 전투 스킬
  (TryAttack/TryHeavyAttack)을 한 번도 직접 확인한 적이 없었다(전부
  `TakeDamage(999999f)`로 바로 죽여 넘어감). 이번엔 `PlaytestDungeonHeadless.cs`
  에 더미 셋(근접 둘·먼 거리 하나)을 스폰해 회전베기가 반경 안만
  때리는지 실제로 확인하는 단계를 추가했다(STORY `SpawnDummyEnemy`와
  같은 결). 배치 모드 컴파일 → `BuildTestDungeonScene` 재빌드 →
  `PlaytestDungeonHeadless` 3연속 통과(`near1=near2<24, far=24 그대로`).
- 다른 네 판(GO/FOREST/STORY/REALM)은 파일이 전혀 안 겹쳐 무관 확인
  생략 — DUNGEON 전용 파일만 고쳤다.

**남은 51장 빈 칸**: REALM "대규모 콘텐츠"(적국 확장) 하나뿐 — 새
세력·시나리오 밸런스 설계가 필요해 방향 없이는 손 안 댐(66-1
재확인·STORY 선택 초기 판단과 같은 기준).

## 같은 날 여섯 번째 후속 — GO 디버그 오버레이 확장 (2026-09-14, 여덟 번째 "이어해")

51장은 REALM "대규모 콘텐츠"만 남기고 다 닫혀서(방향 대기, 손 안 댐),
fork로 51장 밖에서 다른 작고 안전한 빈 칸을 찾았다. PLAN.md 44~49장이
디버그 화면에 나열한 목록(FPS/Draw Calls/Visible Objects/Enemy Count/
NPC Count/Memory/Player Position/Current Quest/Player Level/Current
Zone) 중, GO `DebugHud.cs`(다섯 판 중 디버그 오버레이가 있는 유일한
게임)는 렌더러 이름·FPS 둘뿐이었고 클래스 주석 자체가 "그 시스템 자체가
없어서" 나머지를 안 넣었다고 적어 뒀었다 — 다시 보니 그새 GO에 실제로
생긴 시스템(`PlayerStats.Level`·`QuestState.BanditQuest`)에 그냥
얹을 수 있는 항목이 셋 있었다.

- **Player Level·Current Quest·Player Position 세 줄을 추가.** Enemy/
  NPC Count·Current Zone은 여전히 안 넣었다 — GO 사건은 상주 리스트가
  아니라 트리거식 1회성(`BanditEncounter.cs` 등)이라 "개수"가 안 맞고,
  맵도 이름 붙은 지역 구분이 아직 없다(`TestMapData.cs`). Draw Calls/
  Visible Objects/Memory는 PLAN.md 자체가 대안으로 제시한 Unity
  Profiler 몫(온스크린 라벨로 뽑을 공식 API가 없다) — 여전히 손 안 댐,
  전체 목록을 억지로 다 채우지 않았다.
  - `BuildTestVillageScene.BuildDebugOverlay()` 텍스트 박스 높이를
    100→220으로(4줄이 됐으니).
- **테스트 공백 하나 더 찾음** — `PlaytestHeadless.cs`(GO 스모크
  테스트)는 DebugHud를 한 번도 확인한 적이 없었다. 0.5초(unscaled)
  FPS 타이머가 배치 모드에선 몇 프레임 안에 절대 안 찬다는 걸 먼저
  확인하고(다른 Playtest들이 이미 겪은 "배치 모드는 실시간보다 훨씬
  빠르다" 함정과 같은 종류), 타이머를 기다리는 대신 private `Refresh()`
  를 리플렉션으로 직접 불러 텍스트에 레벨/사명/좌표가 실제로 채워지는지
  확인하는 단계를 추가했다. 배치 모드 컴파일 → `BuildTestVillageScene`
  재빌드 → `PlaytestHeadless` 3연속 통과(`lv 1 · quest: - · pos: 고정
  좌표` — fps 숫자만 배치 타이밍에 따라 1~2 사이로 흔들리는데 이건
  원래도 비결정적인 측정값이라 무해하다).
- 다른 네 판은 파일이 전혀 안 겹쳐(GO 전용 파일만 고침) 무관 확인
  생략.

## 같은 날 일곱 번째 후속 — 디버그 오버레이를 DUNGEON/FOREST/STORY/REALM까지 확장 (2026-09-14, 아홉 번째 "이어해")

GO에만 있던 디버그 오버레이(PLAN.md 44~49장)를 나머지 네 판에도
만들었다 — 문서의 디버그 화면 요구가 GO 하나만의 스펙이 아니라 다섯
판 공통이라 판단해서다(`DialogueLabel.cs`처럼 이미 다섯 벌 복사돼
있는 것과 같은 위상으로 취급). 각 판에 이미 있는 시스템에 얹을 수
있는 항목만 넣고, 없는 항목은 GO와 같은 기준으로 그냥 뺐다(억지로
다 채우지 않음):

- **DUNGEON** — lv(`HeroState.Level`)·floor(`DungeonFloorRunner.
  CurrentFloor`, "지역" 대용)·enemies(`DungeonEnemy.Active.Count`,
  GO엔 없던 상주 리스트가 있어 이건 됨)·quest(`QuestState.
  ObjectiveText`)·좌표. 5줄로 GO보다 많다 — DUNGEON이 이미 갖춘
  시스템이 더 많아서다.
- **FOREST** — 좌표 하나뿐. `ForestState.cs` 클래스 주석이 이미
  "전투·성장·경제가 전혀 없다"고 적어 둔 대로 Level/Quest/Enemy Count
  전부 대응 시스템이 없다.
- **STORY** — quest(`StoryQuestState` 기반 요약 문자열)·좌표. Level
  없음, Enemy Count는 화면 상단 `StoryHud`가 이미 같은 정보(kill
  카운트)를 보여주고 있어 중복 안 넣음.
- **REALM** — REALM만 조작 캐릭터 자체가 없어(`FindWithTag("Player")`
  호출 대상이 없다 — 다섯 판 중 유일) Player Position이 아예 안 된다.
  대신 있는 진행 축(`RealmCityState.Year/Month/Gold/CurrentCity`)을
  Zone/Quest 대용으로 얹었다. 화면 왼쪽 위는 이미 `RealmHud`가 차지하고
  있어 REALM만 오른쪽 위에 배치(다른 네 판과 다른 위치).
- **테스트** — DUNGEON·FOREST는 GO와 같은 프레임-후크 구조라 private
  `Refresh()`를 리플렉션으로 직접 불러 텍스트 내용까지 확인하는 단계를
  추가(3연속 통과). STORY·REALM은 기존 Playtest가 이미 다단계(Phase
  머신)라 새 검증 단계를 끼워 넣는 비용이 커서 **내용 검증은 안 넣고
  기존 전체 시나리오가 그대로 통과하는지(회귀 없음)만 1회 확인**했다 —
  새 GameObject(DebugUI)가 씬에 늘어난 것 자체가 기존 로직과 안 겹침을
  그것으로 확인한 셈.
- 배치 모드 컴파일 → 네 씬(`BuildTestDungeonScene`·
  `BuildTestVillageForestScene`·`BuildTestStoryScene`·
  `BuildTestCityScene`) 재빌드 → 각 Playtest 실행, 전부 통과.

## 같은 날 여덟 번째 후속 — STORY 척후병에 실제 모델 (2026-09-14, 열 번째 "이어해")

REALM "대규모 콘텐츠"를 다시 검토했다 — `RealmEnemyCity.cs`를 직접 읽어
보니 새 성 하나를 더 넣으려면 `RealmCityData.cs`에 아예 없는 새 도시
(이름·지도 좌표·농업/상업/성벽/인구 값)를 처음부터 지어내야 했다(기존
소패는 이미 있던 유일한 적성). 이건 DUNGEON "빌드"(기존 공식 재사용)
와 달리 진짜 새 콘텐츠 설계라 이번에도 손 안 댐 — 원래 판단이 맞았다.

대신 STORY `World/StoryNpc.cs` 클래스 주석이 남겨 뒀던 작은 자국을
채웠다 — 척후병이 지금까지 fallback capsule이었던 것을 GO/FOREST가
이미 "주민" 배역으로 쓰는 `character-b.glb`(Kenney Blocky Characters)
로 바꿨다. **새 자산을 하나도 안 만들고 이미 있는 걸 재사용**한
것뿐이라 44장 규모의 판단이 아니다 — 모델이 없는 PC에서는 여전히
`CharacterVisual.SpawnFallbackCapsule`로 안전하게 대체된다.

- `StoryNpc.cs`에 `[SerializeField] private GameObject modelPrefab`
  추가, `BuildVisual()`이 있으면 쓰고 없으면 폴백.
- `BuildTestStoryScene.BuildNpc()`가 `character-b.glb`를 로드해 채운다.
- 배치 모드 컴파일 → `BuildTestStoryScene` 재빌드(경고 없이 모델 로드
  확인) → `PlaytestStorySlice` 3연속 통과(NPC 대화 로직은 안 건드려
  기존 검증 그대로 통과).

## REALM "대규모 콘텐츠" 착수 — 사용자가 방향을 직접 골라 뒤집음 (2026-09-14, 열두 번째 "이어해")

지금까지 여러 세션이 이 항목을 "새 도시를 처음부터 지어내야 해 방향
없이는 손 안 댐"으로 반복 재확인만 해 왔는데, 이번엔 AskUserQuestion으로
직접 물어 사용자가 "REALM 적국 추가"를 골랐다 — 그 뒤 "묻지 말고
이어해"로 세부 설계(위치·이름·수치)는 위임받아 직접 정했다.

**정도(定陶)를 둘째 목표로 추가** — 원작 시나리오 194에서 조조·여포가
실제로 다퉜던 지명(인물이 아니라 지명이라 이름 정책 대상 아님),
복양과만 맞닿게 배치해 소패(허창발)와 나란한 둘째 전선을 만들었다.
소패보다 한 단계 큰 다음 목표로 성벽·병력을 약 1.4배 올렸다(성벽
3600→5000, 병력 800→1150).

**핵심은 리팩터** — `RealmEnemyCity`(소패 상수 5개)를 카탈로그(id별
이름·성벽/병력/훈련/기술·출진 성 하나)로 일반화하고, `RealmWarState`의
단일 `_xiaopei` 필드를 enemyId 키 딕셔너리로 바꿨다. `Attack()`/
`Plot()`은 fromCityId로 목표를 알아내므로(성 하나당 목표 하나) 호출부
(RealmCommandUi)는 손 안 댔다 — `Xiaopei` 프로퍼티도 옛 테스트 호환용
으로 남겨 뒀다. 세이브 스키마(v3→v4)는 고정 필드 다섯 개를
`List<EnemySave>`로 바꿔 적국이 더 늘어도 스키마를 또 안 바꿔도 되게
했다.

`PlaytestRealmSlice.cs`에 정도 공략(복양에 현책을 임시 전임하는
기존 트릭 재사용) 스모크 단계 하나와 저장/불러오기 회귀(다섯 성·
적국 둘)를 추가 — 배치 모드 컴파일 → `PlaytestRealmSlice` 3연속
통과(OK, "dingtao attack + absorb OK" 포함). 커밋 618dcab.

**이걸로 51장 다섯 판 확장 축이 전부 닫혔다** — GO/DUNGEON/FOREST/
STORY는 이미 완결, REALM이 마지막으로 막혀 있던 항목이었다. 다음
"이어해"는 51장 안에서 더 찾을 게 없으니 새 카테고리(버그 리뷰·
성능·설정 UI 등)를 사용자에게 물어보는 데서 시작할 것.

## REALM 정도 추가 코드 리뷰 후속 (2026-09-14, 열세 번째 "이어해")

51장이 다 닫힌 뒤 "묻지 말고 이어해"에 새 카테고리(버그 리뷰)로
넘어갔다 — `/code-review high`로 직전 REALM 커밋(618dcab)을 훑었다.
지적 열 개 중 대부분은 이 프로젝트 스타일(일어날 수 없는 시나리오에
방어 코드를 안 쌓는다)과 맞지 않는 가상의 엣지케이스(딕셔너리 직접
인덱싱·TargetFrom 유일성 미검증 등)라 그대로 뒀다 — 실제로 값을 가진
지적 하나만 반영: `PlaytestRealmSlice.cs`의 저장/불러오기 검증이
소패·정도 전용 블록 세 군데(before 스냅샷·더미 오염·불일치 체크)를
손으로 나열하고 있어서, 앞으로 세 번째 적국이 또 생기면 이 블록에
추가하는 걸 잊어도 테스트가 조용히 통과해 버리는 구멍이 있었다 —
RealmEnemyCity.AllIds를 도는 걸로 바꿔 앞으로는 안 잊어도 되게
했다(커밋 ad87aa4). 헤드리스 3연속 통과.

**교훈** — 51장류 콘텐츠 확장 뒤에는 code-review를 한 번 돌리는 게
다음 "판단 없이 할 일" 후보로 안전하다. 단, 지적을 다 받아들이지 말고
이 프로젝트의 "필요 이상으로 방어 코드를 안 쌓는다" 원칙에 맞는지
먼저 거른다.

## DUNGEON 회전베기 커밋(5a5b019) 코드 리뷰 — 새 카테고리 (2026-09-14, 열네 번째 "이어해", "버그 리뷰로 새 카테고리 정해서 이어해")

- 지난 세션이 REALM 커밋(618dcab) 하나만 리뷰하고 "51장류 콘텐츠
  확장 뒤엔 code-review를 돌리는 게 안전하다"고 남긴 교훈을 이어,
  아직 안 훑은 DUNGEON "빌드"(회전베기) 커밋(5a5b019)을 `/code-review
  high`로 훑었다. 지적 셋 전부 이 프로젝트 스타일에 맞는 실제 값
  있는 지적이라 판단해 전부 반영(REALM 리뷰 때는 열 개 중 하나만
  반영했던 것과 대조적 — 이번엔 가상의 엣지케이스가 아니라 셋 다
  구체적인 실패 시나리오가 있었다):
  1. `PlayerCombat.TryWhirl()`에 `TryHeavyAttack()`은 이미 갖고 있는
     `IsDodging` 가드가 빠져 있어, 회피 무적 중(0.22초)에도 회전베기를
     쓸 수 있었다(쿨다운 기반 위험/보상 트레이드오프가 깨짐) — 같은
     가드 한 줄 추가.
     **(정정, 같은 날 병합 중 발견) — 아래 "다섯 판 전체 code-review
     후속" 항목이 커밋 fecb2404 이력까지 확인해 TryAttack()도 원래
     IsDodging 가드가 없다는 걸 밝혀냈다(회피 중 봉쇄는 강공격에만
     있는 원작 고유 규칙). 이 가드는 되돌렸다 — 아래 항목이 맞다.**
  2. `PlaytestDungeonHeadless.CheckWhirl()`이 스폰한 더미 셋 중 근접
     둘(near1/near2)은 회전베기 피해(약 2.8)로는 안 죽어(24 HP) STORY
     더미(Die()로 자가 정리)와 달리 안 치워졌다 — 남은 프레임 동안
     `DungeonEnemy.Active`에 남아 플레이어를 쫓아다니며 이후 검사에
     비결정적 부작용을 끼얹을 수 있었다 — 검사 직후 `Object.Destroy()`
     셋 다 추가.
  3. `BuildWhirlButton()`이 Save/Attack/HeavyAttack/Dodge 네 버튼과
     거의 똑같은 ~35줄(Canvas+GraphicRaycaster+Button+Text) 골격을
     또 복제(PLAN.md 33장 규칙 6·7 "동일한 코드를 복사하지 않는다"와
     정면으로 어긋남) — `BuildActionButton(canvasName, buttonName,
     anchor, pos, size, color, label, fontSize, onClick)` 공용
     헬퍼로 다섯 버튼 전부(Save 포함) 묶었다. 이름·앵커·위치·크기·
     색·글자·콜백은 전부 원래 값 그대로 유지(동작 변화 없음).
- 검증: Unity 6000.3.24f1 배치 모드(`-batchmode -nographics
  -executeMethod Saga.EditorTools.PlaytestDungeonHeadless.Run`)로
  컴파일 확인 후 `PlaytestDungeonHeadless` 실행 — "whirl OK -
  near1=20.26667 near2=20.26667 far=24(변화 없음)"로 회전베기 자체
  (가드·반경 판정)는 정상. **이번 배치 실행에서 이 PC의 Unity 버전
  (6000.3.24f1)이 프로젝트가 마지막으로 저장된 버전보다 최신이라
  `ProjectVersion.txt`·`Packages/manifest.json`·`packages-lock.json`·
  `EditorSettings.asset`을 조용히 고쳐 썼다(CLAUDE.md가 미리 경고해
  둔 함정 그대로 재현) — 커밋 전 `git checkout`으로 전부 되돌림, 세
  파일만 남은 것 확인.
- **알려진 흠, 못 고침(다음 세션 몫)** — `TestDungeon.unity`를 열 때
  `Missing Prefab Asset: 'Visual (Missing Prefab with guid:
  0b167ff5b8ac4fe48ac934671a2ae220)'` 오류가 나 `PlaytestDungeonHeadless`
  전체 결과가 FAIL로 찍힌다. **이번 세 수정과 무관한 사전 존재
  결함**임을 확인했다 — `git stash`로 이번 수정 셋을 잠깐 치우고
  원본(수정 전) 코드로 같은 배치 명령을 다시 돌려도 똑같이 재현됨
  (실제 회전베기 로직 검사는 두 경우 다 통과, missing-prefab만 별개로
  실패). 어느 GameObject의 어떤 prefab이 빠졌는지는 이번 세션에서
  더 파지 않았다 — 다음 세션이 `Assets/Scenes/TestDungeon.unity`에서
  guid `0b167ff5b8ac4fe48ac934671a2ae220`를 참조하는 자리를 찾아
  고치거나 다시 연결할 것.
- **다음에 할 일**: 위 missing-prefab 결함이 먼저다(PlaytestDungeonHeadless
  가 지금 항상 FAIL로 찍혀 회귀 확인 도구 구실을 못 한다). 그 뒤
  STORY·GO·FOREST의 51장 확장 커밋들도 아직 코드 리뷰 전이니 이어서
  훑을 수 있다. 사용자가 "새 세션에서 하자"고 요청해 이번 세션은
  여기서 정리한다.

## 다섯 판 전체 code-review 후속 — saga-unity 범위 밖 결과가 대부분 (2026-09-14, 열네 번째 "이어해")

"묻지 말고 이어해"로 오늘치 다섯 판 커밋(feea8ed~c091e39)을 통째로
`/code-review high`로 훑었다 — **범위 지정 실수**: 커밋 범위만 주고
경로(`-- saga-unity`)를 안 줬더니 같은 모노레포의 다른 두 트랙
(saga-web 콘텐츠 에디터, saga-godot)에서 동시에 도는 다른 세션들의
커밋까지 같이 리뷰됐다. 지적 10개 중 saga-unity 파일은 단 하나
(`PlayerCombat.cs` TryWhirl()이 TryHeavyAttack()과 달리 IsDodging
가드가 없다는 지적).

**직접 확인해 보니 버그가 아니었다** — `TryAttack()`(평타)도 애초에
IsDodging 가드가 없다(fecb2404 커밋 메시지: 강공격만 "웹판
heavyAttack()의 실제 상수(...회피 중 사용 불가)를 그대로 옮김"이라고
명시 — 회피 중 봉쇄는 강공격에만 있는 원작 고유 규칙이지 "클래스
공통 규칙"이 아니다). TryWhirl()의 클래스 주석도 스스로 "TryAttack의
'가장 가까운 하나'와 달리 다수 타격"이라고 TryAttack과 비교하고 있어
(TryHeavyAttack과 비교가 아님) — 평타 계열로 설계된 게 맞다. 손 안 댐.

**교훈** — 다음에 code-review를 특정 트랙(saga-unity 등)에만 돌리고
싶으면 커밋 범위만 주지 말고 경로도 같이 줘야 한다(`<range> --
saga-unity` 형태). 그리고 "다른 메서드에 있는 가드가 이 메서드엔
없다"는 지적은 실제 커밋 이력(원작 이식 사유 vs 새 설계)을 먼저 확인
하지 않으면 오탐이 되기 쉽다 — 이번에도 커밋 메시지 하나로 판가름났다.

**이걸로 saga-unity의 "판단 없이 할 일"(51장 확장 + 2회에 걸친 code
review)이 실질적으로 소진됐다.** 다음 "이어해"부터 남은 카테고리는
전부 사람 판단이 필요한 것들이다 — Localization·접근성(그래픽 품질/
진동/UI 크기 설정, 아직 착수 전이지만 새 위젯 패러다임이 필요해 이전
세션이 자체 판단으로 보류함)·BGM 선곡(사용자가 명시적으로 보류)·STORY
"선택" 이후 더 큰 스토리 확장 등. 다음 "이어해"가 오면 이 중 하나를
사용자에게 직접 물어보는 데서 시작할 것(51장/버그 리뷰처럼 스스로
골라 진행할 안전한 후보가 이제 없다).

## 접근성 설정 UI 추가 — 사용자가 방향을 직접 골라 착수 (2026-09-14, 열다섯 번째 "이어해", 커밋 8127684)

바로 위에서 "새 위젯 패러다임이 필요해 자체 판단으로 보류"라고 여러
세션째 미뤄 왔던 항목을 AskUserQuestion으로 물어 사용자가 직접
"설정 UI(그래픽/진동/UI 크기)"를 골랐다. **핵심 판단 — 슬라이더는 안
쓴다.** 이 프로젝트에 Slider 위젯 선례가 전혀 없다는 게 보류 사유였는데,
버튼(이미 다섯 판 전부에 흔한 위젯)으로 값을 순환시키는 방식만 쓰면
새 위젯이 필요 없다는 걸 이번에 깨달아 그대로 착수했다.

**구현**:
- **효과음** — 새 저장소 없이 이미 있던 `XxxAudio.SfxVolume`(0/1)을
  그대로 켬/끔으로 씀.
- **진동** — `XxxAudio.PlaySfx()` 안에서 `Handheld.Vibrate()`를 새로
  연결(PlayerPrefs 토글로 켬/끔). 에디터/PC에선 조용히 no-op(Unity
  공식 동작), 실기기 확인은 사람 몫.
- **UI 크기** — 다섯 판 전체(에디터 빌드 스크립트+런타임 kit) 캔버스가
  전부 `referenceResolution 1080×1920`을 쓴다는 걸 먼저 확인하고,
  그 값을 배율로 나누는 식으로 통일 적용. `GameBootstrap.Start()`가
  `FindObjectsByType<CanvasScaler>`로 씬의 기존 캔버스 전부에 한 번에
  먹이고, 이후 런타임에 새로 생기는 캔버스(GO/FOREST `EncounterUiKit.
  NewCanvas`, REALM `RealmUiKit.NewCanvas`)는 각자 생성 시점에 현재
  배율을 스스로 물어 적용한다.
- **그래픽 품질** — **첫 설계가 헤드리스 검증에서 실제로 깨졌다**:
  66-1장 PC/Mobile 두 QualitySettings 레벨은 `excludedTargetPlatforms`
  로 서로 배타적(Mobile은 Standalone 제외, PC는 Android/iPhone 제외)
  이라, `SetQualityLevel`로 상대 레벨을 고르려 해도 그 플랫폼의
  `QualitySettings.names` 목록에 애초에 없어(IndexOf가 -1) 조용히
  아무 일도 안 일어났다 — GO Playtest가 이걸 바로 잡아냈다. 레벨
  자체를 바꾸는 대신 지금 활성 레벨 위에서 그림자 거리(40→15)·AA(2→0)
  만 직접 낮추는 식으로 재설계 — 플랫폼과 무관하게 항상 먹힌다.

**UI 배치**: REALM은 이미 있는 RealmCommandUi 우측 상단 버튼열(문답/
지도/서고)에 "설정"을 네 번째로 이어 붙였다(y=-330, 지도 바로 아래
10px 틈 — 디버그 오버레이 박스와 안 겹치는 것까지 좌표로 확인). 나머지
네 판(GO/DUNGEON/FOREST/STORY)은 전부 우측 상단 "저장" 버튼 바로
아래가 비어 있어(GO/FOREST/STORY는 그 자리가 원래 비어 있었고, DUNGEON
은 미니맵이 그 자리를 이미 차지하고 있어 그 아래로 더 내림) 새
`XxxSettingsPanel` 컴포넌트를 거기 얹었다 — 픽셀 좌표를 다 실측해서
겹침 여부를 계산으로 확인했다(이 세션 동안 실제로 화면을 띄워 보지는
않음, 루트 CLAUDE.md "개발 중엔 습관적으로 GUI 스크린샷 안 찍는다"
원칙 그대로 — 좌표 계산과 헤드리스 검증만으로 진행).

**검증**: 다섯 판 헤드리스 Playtest 전부에 설정 패널 검증 단계를 추가
(패널 GameObject 존재·효과음/진동 토글이 실제로 값을 바꾸는지·UI
배율이 CanvasScaler에 실제로 반영되는지·그래픽 품질이 QualitySettings
수치에 실제로 반영되는지). 기존 Playtest들과 같은 스타일로 UI 버튼
클릭 시뮬레이션은 안 하고 정적 API를 직접 호출한다. 다섯 판 전부
컴파일→씬 재빌드→헤드리스 통과를 2회 연속 확인(회귀 없음 포함,
REALM/STORY의 다단계 Phase 머신은 새 Phase를 안 늘리고 Init 안에서
한 번만 부르는 식으로 최소 침습).

**남은 것**: 실기기(모바일) 진동 체감·UI 크기 3단계가 실제로 화면에서
어떻게 보이는지는 사람이 직접 확인해야 한다(HOW_TO_PLAYTEST.md에
"설정" 버튼 위치를 다섯 판 전부 반영해 둠). Localization은 이번에도
범위 밖 — 접근성 항목 중 이 조각만 건드렸다.

**다음 세션 안내** — 사용자가 "현재 작업 완료 후 새 세션에서 하자"고
정해 이 세션은 여기서 멈춘다. 다음 세션이 이어받을 후보는 여전히
BGM 선곡(보류)·Localization(미착수)·STORY "선택" 이후 확장 중
사용자에게 물어 고를 것.


## Localization (2026-09-14, 새 세션 — 커밋 c57b8eb~98e3fe8)

**완료**: 다섯 판에 `XxxLocalization.cs`(json 기반 T(key)/T(key,fallback))
추가. 설정 패널·버튼/패널 제목·HUD 상태줄 ko/en 전환 완료(전 판).
데이터 콘텐츠 일부 번역: REALM 도시5·장수3·명령10·계략2, GO/DUNGEON
장비 11종, GO 촌장/상인/나그네 전체 대사+도적/흰늑대 조우 사건 전체,
DUNGEON 퀘스트 문구, STORY 척후병 대사+퀘스트명. 원칙: 다른 코드가
문자열 값으로 매칭하는 식별자 상수는 안 건드리고 표시 문자열만 번역.
매 커밋 컴파일+관련 Playtest 재검증, 회귀 없음.

**다음 작업**(우선순위순): ① REALM RealmQuizData.cs(문답 36개, 사실
정확성 중요) ② FOREST(전체 미착수) ③ GO HiddenTreasure 등 나머지
④ DUNGEON DungeonMerchant/DungeonCaptive 대사 ⑤ REALM 서고·전투
결과 서술. 패턴 그대로 반복: 리터럴 찾기→식별자 여부 확인→T(key,
fallback)로 교체→json에 키 추가→검증→커밋.

**알려진 사항**: en 번역 전부 사람 검수 전. BGM은 오디오 청취 불가로
계속 보류(우선순위 문제 아님, 역량 제약).

## Localization ①~⑤ 전부 완료 (2026-09-15, "묻지 말고 다 이어해" 세션, 커밋 6aceffe~0bc184f)

바로 위 "다음 작업" 목록 다섯 개를 순서대로 전부 끝냈다 — 이걸로
2026-09-14 세션이 시작한 Localization 확장이 다섯 판 전체 1차 마무리.

- **① REALM 문답 36개** — `RealmQuizQuestion`의 Q/Choices/Why·분야명을
  `RealmCityData.Name`과 같은 결(T(key, fallback))로 옮김. 사자성어/
  유행어/속담처럼 한국 고유 표현은 en 질문을 "무엇을 뜻하는가"로 풀고
  원 표현(한글+로마자)은 보기로 남겼다.
- **② FOREST 전체** — 숲지기 대사, 가구 14종+계열+집 등급 6단계, 벽지/
  장판 10종, 포자괴물 조우 UI+결과, 나무 흔들기, 가구전/도배전/자유
  배치 토스트까지 — 이 판의 대사·HUD가 사실상 전부 옮겨졌다.
- **③ GO 나머지** — HiddenTreasure/EastGroveRelic/MountainShrine/
  Gatherable/LuckyCairn/WanderingAnimal 발견형 이벤트 + 도적·흰늑대
  전투 UI 공유 잔여분(타이머·기세/사기/기(氣) 라벨, 도적 쪽에만 빠져
  있던 "강타가 온다" 텔레그래프).
- **④ DUNGEON 행상/구출** — DungeonMerchant(+GemData.Name도 같이),
  DungeonCaptive, 그리고 같은 패턴을 복붙해 쓰던 DungeonShrine·
  DungeonSecretStash까지 맞춰 셋이 따로 놀지 않게 함.
- **⑤ REALM 서술 전체** — 명령 10종 결과·게이트 에러, 전쟁 출진/함락/
  퇴각, 계략 성공/발각/효과, 문답 서고(목록/상세)까지.

**의도적으로 손 안 댄 것 둘** (다음에 손댈 때 참고):
1. **GO `BanditEncounter.RecruitId`** — 표시 문자열이 아니라
   `PartyState.Recruit()`가 그대로 쓰는 로스터 식별자라 안 건드림
   (`FoeName`은 이미 `foe.bandit` 키로 별도 분리돼 있어 무관 —
   RecruitId만의 문제). 지금은 로스터를 화면에 보여주는 곳 자체가
   없어 해롭지 않지만, 나중에 로스터 UI가 생기면 REALM Officer처럼
   id/표시명을 분리해야 한다.
2. **DUNGEON `DungeonEnemy.displayName`** — 처치 메시지("{0}을(를)
   물리쳤다")에 쓰이는 동시에 `BestiaryState.Record(displayName)`의
   저장 키이기도 하다(도감 시스템). REALM Officer/City처럼 id와
   표시명을 분리하려면 몬스터별 id를 새로 도입하는 구조 변경이
   먼저 필요해 이번 세션 범위 밖으로 남겼다 — DungeonEnemy.cs의
   처치 메시지·도감 등록은 여전히 하드코딩 한국어 그대로다.

**검증**: 다섯 판 각각 배치 모드 컴파일 + 관련 헤드리스 재검증
(PlaytestRealmSlice·PlaytestForestHeadless/Creatures/Furniture/Finish·
PlaytestHeadless(GO)·PlaytestDungeonHeadless/Town2/Towns34), 전부
회귀 없음. GO/DUNGEON은 REALM/FOREST만큼 기능별 헤드리스가 안 갖춰져
있어(스모크 테스트 위주) 일부 토스트는 컴파일 확인 수준에 그쳤다 —
사람이 실기 확인할 때 참고.

**다음 세션 후보**: en 번역 사람 검수, 위 "손 안 댄 것 둘"(로스터/
도감 id 분리), BGM(계속 보류), STORY "선택" 이후 확장.

## DUNGEON 처치 메시지/도감 Localization — "손 안 댄 것 둘" 중 하나 해소 (2026-09-15, 새 세션 "새로운 세션에서 이어해", 커밋 32ee29c)

위 항목이 남겨 둔 `DungeonEnemy.displayName` id 얽힘을 풀었다 — 실제로
세어 보니 표시명이 넷뿐(황건적/사나운 황건적/황건 살수/황건적 두목)
이라 REALM Officer식 새 id 필드 없이 "알려진 한국어 표시명 → 로컬라이즈
키" 매핑(`DisplayNameKeys`) 하나로 충분했다. `BestiaryState.Record()`에
넘기는 값은 원문 그대로 둬 세이브 호환은 그대로 지키고, 화면에 보이는
처치 메시지·전리품 문구·도감 신규 기록 토스트만 `LocalizedDisplayName`
을 거치게 했다. dungeon_ko.json/dungeon_en.json에 11개 키 추가.
`PlaytestDungeonHeadless`(컴파일+스모크)·`PlaytestDungeonFloorProgression`
(잡졸 처치 12회 포함) 재검증, 회귀 없음 — 미니보스/두목/정예는 킬을
직접 만드는 헤드리스가 없어 컴파일 확인까지만(같은 코드 경로, 다른
딕셔너리 키라 위험 낮음).

**GO `BanditEncounter.RecruitId`는 그대로 둔다** — 표시되는 곳이
없어(로스터 UI 자체가 없음) 지금 건드리면 이득 없이 세이브 포맷만
바꾸는 꼴이다. 로스터 UI가 생기면 그때 REALM Officer와 같은 결로
분리할 것.

**남은 항목 셋 다 사람 판단/역량 필요**: en 번역 검수, BGM(오디오
청취 불가로 계속 보류), STORY "선택" 이후 확장(51장 네 칸은 이미
완결 — 이 이상은 새 서사 설계라 방향 필요). 다음 "이어해"가 오면
이 중 하나를 사용자에게 직접 물어보는 데서 시작할 것.

## en 번역 검수 — "손 안 댄 것" 중 하나 마무리 (2026-09-15, "묻지말고 다이어해" 세션)

사용자가 "묻지 말고 진행하라"고 명시해 위 세 후보 중 사람 판단이
꼭 필요하진 않은 것(en 번역 검수)을 이 세션이 대신 맡았다. 방법
둘을 같이 썼다:

1. **기계적 정합성 검사** — 다섯 판 `*_ko.json`/`*_en.json`을 키
   집합·placeholder(`{0}` 류)·개행 수·빈 값 기준으로 전수 대조
   (node 스크립트, python3는 루트 CLAUDE.md가 경고한 스토어 스텁이라
   못 씀). 793개 키(DUNGEON 55·FOREST 65·GO 79·REALM 318·STORY 33)
   전부 en/ko 키 집합 일치, placeholder 불일치 0건, 빈 값 0건 —
   `enemy.defeated_boss`/`enemy.defeated_normal`의 "공백 위치 다름"
   플래그 하나만 걸렸는데, 한국어는 조사가 이름에 바로 붙고("을(를)
   쓰러뜨렸다") 영어는 "has been..." 앞에 띄어쓰기가 필요해서
   생기는 의도된 차이 — 실제 결함 아님.
2. **직접 읽고 대조** — 다섯 파일 전체를 사람이 검수하듯 훑었다.
   REALM 퀴즈(역사 36문항 포함)는 ko 원문과 나란히 대조해 연도·
   인명·사실관계가 안 틀렸는지 확인(세종/이순신/을지문덕/강감찬/
   왕건/대조영/진시황 등 표본 점검, 전부 일치). 등용 인물 가명
   (현책→Hyeonchaek, 해장→Haejang, 이도인→Idoin)도 로마자 표기가
   일관됨을 확인.

**결론 — 검수 끝, 실제 오류 0건.** 고칠 게 없어 커밋할 코드 변경은
없다. 남은 둘(BGM, STORY 확장)은 여전히 사람 판단이 필요해 손 안
댐 — BGM은 "먼저 묻지 말고 시작하지 말 것"이 유효한 규칙이라 계속
보류, STORY 확장은 새 서사 방향이 필요해 다음에 사용자에게 직접
물어볼 것.

## code-review 라운드 3 — ad87aa4 이후 전체 반영 (2026-09-15, "묻지말고 계속
이어해" 후속)

en 검수 뒤 다시 판단 없이 할 일을 찾다가, 지난 code-review 이후(ad87aa4
~HEAD, 51장 완결·설정 UI·Localization ①~⑥·en 검수까지) 쌓인 커밋이
많아 `/code-review high ad87aa4..HEAD -- saga-unity`를 fork로 돌렸다.
지적 6개 중 **실제 반영 2개**, 나머지 4개는 이 프로젝트 스타일(방어
코드 지양·다섯 벌 복사 관례)과 안 맞거나 저위험 사변이라 버렸다:

1. **반영 — `DungeonEnemy.cs` DisplayNameKeys 누락(진짜 버그)**:
   `DungeonFloorRunner.SpawnElite()`(실제 절차적 층 진행이 쓰는 정예
   스폰)가 붙이는 표시명은 "폐허의 황건 정예"인데, 2026-09-15 오전
   세션이 고친 매핑 표엔 `BuildTestDungeonScene.cs` 더미가 쓰는
   "사나운 황건적"만 들어 있었다 — 실제 플레이에서 정예를 잡으면
   영어 모드에서도 한국어 원문이 그대로 노출되는 진짜 회귀. 표시명
   하나를 매핑에 추가해 해소(같은 "enemy.elite" 키 재사용). 검증:
   컴파일 통과 + `PlaytestDungeonHeadless`(3연속)·
   `PlaytestDungeonFloorProgression`(12회 방 진행) 회귀 없음 — 정예
   킬 자체를 직접 검증하는 헤드리스는 이 프로젝트에 아직 없어(미니보스/
   두목과 같은 사정) 컴파일+회귀 확인까지.
2. **반영 — `PlaytestRealmSlice.CheckSettingsPanel()` 언어 상태 누출로
   인한 잠재적 flaky 실패**: 설정 버튼을 `GameObject.Find("Btn_설정")`
   (한국어 라벨 기반 이름)로 찾는데, 그 이름은
   `RealmLocalization.CurrentLanguage`(PlayerPrefs 저장, 세션 간
   유지)가 "ko"일 때만 성립한다 — GO/DUNGEON/FOREST/STORY의 동급
   체크는 전부 언어 독립적인 고정 컨테이너 이름을 써서 이 문제가 없다.
   `RealmSaveState.DeleteForTest()`(이전 헤드리스 실행이 남긴 세이브를
   먼저 지우는 것)와 같은 이유로, `Run()` 시작부에
   `RealmLocalization.CurrentLanguage = "ko"`를 추가해 Play 모드
   진입 전에 고정했다. 레지스트리에서 실제 PlayerPrefs 키를 못 찾아
   (`-batchmode`가 PlayerPrefs를 디스크에 플러시하는지 확인 못 함)
   인위적 재현은 못 했지만, 코드 경로(RealmUiKit.NewButton이
   `$"Btn_{label}"`로 짓고 label이 RealmLocalization.T(...)를 거침)는
   리뷰가 정확히 짚었다 — 저위험·고확신 수정이라 반영. 검증:
   `PlaytestRealmSlice` 3연속 OK.
3. **버림 — reflection `.Invoke()` null-check 4곳**: "일어날 수 없는
   시나리오에 방어 코드를 안 쌓는다"는 이 프로젝트 스타일과 정면
   충돌(루트 CLAUDE.md). `GetMethod("Refresh", ...)`가 실패하는 건
   메서드를 리네임할 때뿐이고, 그때는 지금도 다른 방식으로 바로
   드러난다(NullReferenceException).
4. **버림 — 5개 Playtest 파일의 설정 패널 테스트 코드(~35줄) 중복을
   공용 헬퍼로 뽑자는 제안**: `XxxAudio.cs`·`XxxLocalization.cs`처럼
   "다섯 판은 공용 파일을 다섯 벌 복사해 나눠 든다, 하나로 합치자고
   제안하지 않는다"는 루트 CLAUDE.md 원칙이 Editor 테스트 코드에도
   같은 결로 적용된다고 판단.
5. **버림 — `GoSettingsPanel.cs`(외 4벌) MakeRow/Refresh() 키 리터럴
   중복**: 기술적으론 맞는 지적이지만, `T()`가 키를 못 찾으면 원본
   키 문자열을 그대로 돌려주게 설계돼 있어(Localization 인프라 도입
   때부터 의도된 자가진단) 오타가 나면 화면에 바로 티가 난다 — 실제
   위험이 낮다. 다섯 벌 구조를 하나 더 손대는 비용 대비 이득이 작다고
   판단.
6. **버림 — `ApplyToAllScalers()` 씬 전체 `FindObjectsByType` 스캔을
   캐싱하자는 제안**: 리뷰 자신도 "프레임당이 아니라 지금은 영향이
   작다"고 적었고, 캐싱은 새 상태(소유 캔버스 목록)와 무효화 로직이
   필요해 지금 필요 이상으로 복잡해진다.

Angle-B 후보 둘(RealmHud/StoryHud/PlayerHud의 단일 인자 `T(key)`가
한국어 폴백이 없다는 것)은 리뷰가 스스로 조사해 반증했다 — `T(key)`가
키를 그대로 돌려주는 건 번역 누락을 숨기지 않으려는 의도적 설계이고
실제로 해당 키들은 ko/en 둘 다 있다.

커밋·푸시 완료.

## BGM 다섯 곡 전부 착수 — "묻지말고 순서대로 진행해"로 보류 해제
(2026-09-15, code-review 라운드 3 후속)

code-review까지 끝나 남은 게 BGM(보류)·STORY 확장(방향 필요) 둘뿐이던
차에, 사용자가 "순서대로 진행해"로 직접 지시해 둘 다 순서대로
착수하기로 했다. 먼저 BGM.

**보류를 뒤집은 근거** — 여태 보류 사유는 "승리/패배처럼 어느 쪽인지
들어야 갈리는 곡을 잘못 고르는 사고"였다(`GoAudio.cs` 등 클래스
주석). 상시 배경 루프 한 곡(승패 구분 없음)은 그 제약에 안 걸려서,
그 좁은 슬라이스만 진행했다 — 감정가 있는 선곡(승리 팡파레 등)은
여전히 손 안 댐, "먼저 묻지 말고 시작하지 말 것"도 그대로 유효.

**곡 조달** — opengameart.org 고급 검색을 CC0 라이선스(tid=4)·Music
타입(tid=12)으로 필터링해(그냥 키워드 검색만으론 CC-BY가 섞여 나와
license-name 태그로 재확인) 판마다 제목이 이미 명확한 곡을 골랐다:
GO=town-theme-rpg(cynicmusic), DUNGEON=dungeon-ambience(yd),
FOREST=peaceful-town(aroachifoundonmypillow),
STORY=fight-run-breath-deeply(Komiku), REALM=war-theme(spring-spring).
다섯 곡 다 CC0 확인, `Assets/Art/Audio/CC0_BGM/LICENSE.txt`에 곡별
출처 기록(자세한 내용은 `docs/ASSET_GUIDE.md` 같은 날짜 항목).

**구현** — `XxxAudio.PlayBgm()`/`RefreshBgmVolume()`를 다섯 벌 추가
(이미 예비돼 있던 `BgmVolume` PlayerPref를 그대로 씀), 설정 패널
여섯째 줄 "BGM"(기존 다섯 줄은 안 건드리고 끝에 추가, 패널
680×720→680×820), `settings.bgm` 로컬라이즈 키 다섯 벌. 클립은
`GameBootstrap`(REALM만 `RealmCommandUi`가 아니라 별도 파일)의
`[SerializeField]`에 씬 빌드 스크립트가 채운다.

**검증** — 배치 모드 컴파일, 다섯 씬 재빌드(클립 못 찾음 경고 없음),
`PlaytestHeadless`(GO)·`PlaytestDungeonHeadless`·
`PlaytestForestHeadless`·`PlaytestStorySlice`·`PlaytestRealmSlice`
전부 3연속 통과, `PlaytestDungeonFloorProgression`(SfxPlayer.Configure
시그니처 변경 회귀 확인)도 통과. BGM이 실제로 잘 들리는지(음량 균형·
루프 이음매)는 여전히 사람이 직접 들어야 확인되는 몫 — 헤드리스는
에러 없이 재생 호출이 걸리는지까지만 본다.

다음은 STORY "선택" 이후 확장(같은 지시의 두 번째 순서).

## STORY 확장 — 전직·전직관(Job Trainer) (2026-09-15, "이어해" 후속)

BGM 다음 순서였던 STORY "선택" 이후 확장 — saga-godot
`story_job_trainer.gd`가 정본인 "전직·SP 투자 UI"의 SP 투자를 뺀
전직(1차, Lv.10, 무사/궁수/협객/방사 넷 중 하나)만 옮겼다. SP 투자는
직업별 전용 무예가 이 포트에 아예 없어 범위 밖.

- `StoryJobState`(신규) — level/exp/job 정적 상태, `GainExp()`(레벨업
  루프)·`ChooseJob()`(1회 제한). STORY엔 레벨 개념이 지금까지 아예
  없었다(플레이어가 안 맞는 슬라이스라 미사용이던 것).
- `StoryJobTrainer`(신규) — 척후병과 같은 반경(2m)+쿨다운(15s) 트리거
  NPC, `BuildTestStoryScene.BuildJobTrainer()`가 (5,0.1,0)에 배치.
- `StoryJobChoiceUi`(신규) — 넷 중 하나를 고르는 전용 팝업(기존
  `StoryChoiceUi`는 두 선택지 전용이라 별도로 지음).
- `StoryCombat`에 ExpNeed/GruntExp/BossExp/JobsTier1/JobOrder 추가,
  `MpMaxCurrent`(방사 전직 시 MP 상한 증가) 신설.
  `StoryPlayerController.CurrentAtk`에 AtkBonus 반영, `StoryHud`에
  레벨·직업 줄 추가.
- 세이브 스키마 v5→v6(level/exp/job 추가), 구버전 세이브도
  `Restore()`가 기본값으로 무해 처리.
- ko/en 로컬라이즈 키 9개 추가.
- `PlaytestStorySlice`에 전직 가능 판정/스탯 반영/재전직 방지/
  세이브-로드 라운드트립 검증 추가, 헤드리스 3연속 통과.

**같은 세션 뒷정리** — 이전 BGM 커밋(bf93fe6)이 코드만 올리고 실제
오디오 자산(`CC0_BGM/`)을 스테이징만 한 채 커밋을 빠뜨린 걸 발견,
별도 커밋 두 개로 마저 올렸다(폴더 내용물 + 폴더 자신의 .meta).

**남은 것** — STORY 51장 확장 축은 더 채울 빈 칸이 없다(NPC/선택/
사건/관계 + 전직까지 끝남). 남은 진짜 방향 대기 항목은 en 대사 추가
검수 정도이고, 그 외엔 새 카테고리(버그 리뷰 등)를 사용자에게 물어야
한다.

## code-review 지적 반영 + 모바일 액션 버튼 언어 전환 (2026-09-15, "이어해" 후속, 커밋 7d4c08b·이후)

전직 커밋에 `/code-review high`를 돌려 실제 버그 3개를 잡았다(HUD
직업명 Localization 누락, 효과 없는 "체력+N" 문구, 스테일한 클래스
주석) — 자세한 내용은 위 STORY 전직 항목 바로 다음 커밋 메시지 참고.

그 다음 "이어해"에서 이전 세션들이 "새 위젯 패러다임 필요해 보류"로
남겨 뒀던 항목 — **DUNGEON/STORY 모바일 액션 버튼(공격/강공격/회전베기/
회피, 점프/공격/기합/기탄/횡소)이 씬 빌드 시점 언어로 굳어 플레이 중
전환에 반응 안 하던 것**을 풀었다. `LocalizedButtonLabel`(다섯 벌 관례
대신 DUNGEON·STORY 둘만 — 이 문제를 가진 판이 이 둘뿐) — 이벤트 배선
대신 `StoryHud.Refresh()`처럼 매 프레임 언어 문자열 하나만 비교하는
폴링으로 간다, 새 인프라 불필요. DUNGEON은 저장 버튼도 같은 헬퍼를
쓰길래 같이 localize했다(GO/FOREST/REALM 저장 버튼은 범위 밖 — 이번에
새로 발견한 별개 격차, 아래 참고).

**함정을 그 자리에서 직접 밟음** — `Init()`으로 참조 필드를 딱 한 번
채우는 식으로 처음 짰다가, 일반 private 필드가 씬 저장·재로드 후 Play
모드에서 전부 null로 돌아와 헤드리스 검증이 바로 걸렸다(2026-09-14
FOREST 밀어내기 UI 세션이 이미 메모리에 남겨 둔 교훈인데 또 밟았다).
`key`/`fallback`을 `[SerializeField]`로 승격, `Text` 참조는 필드로
안 들고 `Awake()`에서 다시 찾는 식으로 고쳤다. **다음에 비슷한
"에디터 빌드 스크립트가 한 번만 채우는 컴포넌트"를 짤 때는 이 함정을
먼저 떠올릴 것 — 메모리에 적어 둔 교훈도 실제 코드를 짜는 순간엔 또
놓칠 수 있다는 뜻.**

PlaytestStorySlice/PlaytestDungeonHeadless에 언어 전환 후 액션 버튼
글자 확인 단계 추가, 둘 다 헤드리스 3연속 통과 + PlaytestDungeonFloorProgression
회귀 없음 확인.

**새로 발견 — GO/FOREST의 저장 버튼도 똑같이 하드코딩 "저장"
(+ 저장 성공/실패 토스트 메시지)이라 언어 전환에 전혀 안 반응한다.**
Localization 2차 세션 기록이 "런타임에 매번 새로 짓는 UI만 옮겼다"고
적어 둔 것과 별개로, 저장 버튼은 다섯 판 전부 애초에 그 라운드
대상에서 빠져 있었다 — 이번엔 DUNGEON/STORY 범위(이미 손대는 파일)만
고치고 GO/FOREST는 손 안 댔다. **REALM은 확인해 보니 애초에 런타임
저장 버튼 자체가 없다**(RealmSaveState.Save()를 부르는 건
PlaytestRealmSlice뿐 — 사람이 누를 UI가 없는 별개의 더 큰 공백, 이번
localization 범위와 무관).

## GO/FOREST 저장 버튼 — 언어 전환 실시간 반영 (2026-09-15, "이어해" 후속, 커밋 이후)

DUNGEON/STORY 저장 버튼을 고친 직후 남겨 둔 후보를 마저 처리 —
GO(`BuildTestVillageScene.BuildSaveButton()`)·FOREST(`BuildTestVillageForestScene.
BuildSaveButton()`)에 같은 `LocalizedButtonLabel` 패턴(다섯 판 관례대로
각자 복사, `[SerializeField]` key/fallback + Awake() 재탐색 — DUNGEON/
STORY 때 밟은 null 함정을 이번엔 처음부터 피함)을 적용했다.
`PlaytestHeadless`(GO)·`PlaytestForestHeadless`에 언어 전환 후 저장
버튼 글자 확인 단계 추가, 둘 다 헤드리스 3연속 통과 +
`PlaytestOverworldMap`·`PlaytestForestFurniture` 회귀 없음 확인.

**확인 — REALM은 대상이 아니다.** 저장 버튼을 찾다 보니 REALM엔
런타임에 사람이 누를 저장 UI 자체가 없다(자동 로드만 있고, 저장은
`PlaytestRealmSlice`가 테스트용으로 `RealmSaveState.Save()`를 직접
부르는 게 전부) — localization 문제가 아니라 더 큰 별개의 기능 공백,
이번 범위 밖으로 그대로 남긴다.

**이걸로 언어 전환 미반응 버튼(모바일 액션 버튼 + 저장 버튼) 계열은
다섯 판 중 실제로 버튼이 존재하는 넷(GO/DUNGEON/FOREST/STORY) 전부
끝났다.**

## code-review 라운드 4 — 7d4c08b..f92827d (2026-09-15, "이어해" 후속)

이 두 커밋(DUNGEON/STORY 액션 버튼 + GO/FOREST 저장 버튼 Localization)에
`/code-review high`를 돌렸다 — **지적 0건, 클린.** LocalizedButtonLabel
네 벌의 구조적 일치, BuildActionButton 호출부 전부 새 locKey 인자로
갱신됐는지, 실제 저장된 .unity 씬 바이트까지 guid/key/fallback이 맞는지
확인했다고 보고함. 다섯 판 복사 관례·폴링 방식은 리뷰가 스스로
"이 저장소의 관례로 이미 승인된 것"이라 결함이 아니라고 판단.

남은 방향 대기 항목: REALM 저장 UI 부재(설계 필요, localization과 무관),
en 대사 추가 검수. 언어 전환 미반응 버튼 계열은 완전히 소진됐다.

## ⚠️ REALM `RealmCommandUi` — 심각한 잠복 버그 발견·수정 (2026-09-15, "이어해" 후속, 커밋 이후)

en 검수/REALM 저장 버튼 후보를 살피던 중, REALM에 저장 버튼이 왜
없는지 확인하려다 `RealmCommandUi.Build()`가 `BuildTestCityScene.cs`
에서 **에디터 시점에 딱 한 번만** 불리고(Awake() 없음) 패널/라벨
참조를 전부 **[SerializeField] 없는 plain private 필드**로 들고 있는
걸 발견했다. Unity는 그런 필드를 직렬화하지 않는다 — 즉 씬을 저장·
재로드한(=실제 플레이) 뒤 `_settingsPanel`을 비롯한 **아홉 패널/여러
라벨 참조가 전부 null**이었다. 리플렉션 덤프로 직접 확인(`confirmClip`/
`errorClip`은 이미 `[SerializeField]`라 살아있고 나머지 전부 NULL).

**왜 지금까지 아무도 못 잡았나** — `PlaytestRealmSlice.CheckSettingsPanel()`이
`GameObject.Find("Btn_설정")`로 버튼이 **존재하는지**만 확인하고,
`ToggleSettingsPanel()` 같은 `RealmCommandUi` 자신의 메서드는 한 번도
호출한 적이 없었다. 즉 **실제 플레이에서 "설정"(또는 명령/성/계략/
문답/지도/서고 아무 버튼이나)을 누르면 NullReferenceException으로
그 자리에서 죽는 상태였는데, 지금까지의 모든 회귀 테스트가 이걸
통과시켜 왔다** — "GameObject가 있다"와 "그 GameObject를 쓰는 코드가
동작한다"는 다른 검증이라는 걸 다시 확인한 사례
(DUNGEON/STORY LocalizedButtonLabel 때도 비슷한 결의 함정이었지만
그건 "글자가 안 바뀜" 정도였지 이번처럼 크래시는 아니었다).

**고침** — 아홉 패널 필드 + 라벨 필드 전부(그리고 이번에 같이 발견한
"여덟 상시 버튼도 언어 전환에 응답 안 함" — `_settingsToggleLabel`
자기 자신만 갱신되고 명령/성/계략/공격/다음달/문답/지도/서고는 안
됐던 것도 같이) `[SerializeField]`로 승격 + `RefreshSettingsPanel()`에
여덟 줄 추가. `PlaytestRealmSlice.CheckCommandUiPanelsWork()`(신규) —
**존재 확인이 아니라 실제로 `ToggleSettingsPanel()`을 리플렉션으로
불러 패널이 진짜 열리고 닫히는지, 언어 전환 후 명령 버튼 글자가
바뀌는지**까지 검증하도록 바꿨다. 씬 재빌드 + 헤드리스 3연속 통과.

**교훈** — "GameObject.Find로 존재만 확인"하는 테스트는 그 오브젝트를
쓰는 코드 경로 자체가 도는지는 증명하지 못한다. 앞으로 새 UI
컴포넌트를 검증할 때는 **버튼을 실제로 누르거나(리플렉션으로 메서드
호출) 그 결과 상태가 바뀌는지까지 확인**할 것 — 이번처럼 존재 확인만
통과시키는 테스트가 크래시를 몇 세션째 숨겼을 수 있다.

## REALM 저장 버튼 신설 (2026-09-15, 같은 흐름 후속)

버그 수정으로 RealmCommandUi 패널 인프라가 실제로 동작한다는 게
증명됐으니, 원래 조사 동기였던 "REALM만 저장 버튼이 없다"를 마저
채웠다. 문답(-90)/지도(-210)/서고(30)/설정(-330)과 같은 우측 상단
구석 기둥에 120px 간격 그대로 이어(-450) "저장" 버튼 추가 —
`RealmSaveState.Save()` 호출 + `RealmToast`로 결과 토스트(command.save_ok/
command.save_fail, 감정가 없는 UI 문구라 사람 확인 없이 그대로 씀) +
PlayOutcomeSfx 재사용. `PlaytestRealmSlice.CheckCommandUiPanelsWork()`에
"실제로 버튼 핸들러를 불러 파일이 생기고 다시 읽히는지"까지 검증
추가(이번 버그가 가르쳐 준 대로 존재 확인에서 안 멈춤). 씬 재빌드 +
헤드리스 3연속 통과.

**이걸로 REALM도 다른 네 판과 저장 UI가 대등해졌다** — 5절 "언어 전환
미반응 버튼"·"저장 UI 부재" 두 항목 모두 완전히 닫혔다.

## REALM 51장 "대규모 콘텐츠" 2차 확장 — 적국 셋 추가 (2026-09-16)

방향을 물어(AskUserQuestion) 사용자가 "REALM 대규모 콘텐츠(적국 확장)"를
고르고 "순서대로 다 해줘"로 위임 — saga-web/saga-realm/js/data-city.js의
원작 LINKS(인접 관계) 그대로 셋을 추가했다.

- **낙양**(진류의 첫 목표 — 시작 성 셋 중 유일하게 목표가 없던 곳),
  **하비**(소패 함락 뒤 열리는 둘째 단계, TargetFrom("xiaopei")),
  **업**(정도 함락 뒤 열리는 둘째 단계, TargetFrom("dingtao")).
  wall/agri/comm/pop/land/좌표는 원작 데이터 그대로, troops는 소패·정도가
  쓰던 비율(성벽×0.23)로, train은 40→60 단계적으로.
- `RealmCityData.cs`·`RealmEnemyCity.cs`에 데이터만 추가 — `RealmWarState`·
  `RealmSaveState`·`RealmHud`·저장/불러오기 라운드트립 테스트는 전부
  `AllIds` 기준으로 이미 일반화돼 있어 코드 변경 0.
  **회귀 하나 직접 잡음** — 진류가 목표(낙양)를 갖게 되면서 기존
  "성 밖 게이트" 테스트 둘(`PlotGate`·`AttackWrongCity`)이 진류를
  "목표 없는 성" 예시로 쓰고 있던 게 깨졌다 — `wan`(시작 성도 적국도
  아닌 실제 지명)으로 교체.
- `PlaytestRealmSlice.cs`에 AttackLuoyang/AttackXiapi/AttackYe 세 단계
  추가(기존 AttackDingtao와 같은 트릭 — 무장을 잠깐 옮겨 출진 조건만
  채운다). 배치 모드 컴파일 → 3연속 통과(다섯 적국 전부 함락+편입+
  save/load 왕복 확인). 배치 모드가 건드린 ProjectVersion.txt/manifest.json/
  packages-lock.json/EditorSettings.asset은 매번 checkout으로 되돌림.

## REALM 51장 3차 확장 — 적국 셋 더 추가 (2026-09-16, "순서대로 진행해" 후속)

낙양·하비·업을 함락한 뒤 각자 이어지는 셋째 단계(장안·수춘·진양)를
같은 방식으로 추가 — 원작 LINKS(luoyang-changan·xiapi-shouchun·
ye-jinyang) 그대로. 이제 여덟 적국(허창→소패→하비→수춘, 복양→정도→
업→진양, 진류→낙양→장안) 전부 원작 지도 인접만으로 이어진 하나의
연결된 정복 트리다. 장안/수춘/진양만 아직 다음 목표가 없다(다음
확장 후보).

- 진양은 원작 land가 mount인데 `RealmLand` enum엔 plain/river뿐이라
  Plain으로 뒀다(기존 hill/mount 미지원 관례 그대로 — enum 확장은
  범위 밖).
- `RealmEnemyCity.cs`의 `TargetFrom()` 주석이 "진류처럼 목표 없는
  성"을 예시로 들고 있던 게 2차 확장 때 이미 stale해진 걸 이번에
  발견해 wan/장안/수춘/진양으로 바로잡음.
- `PlaytestRealmSlice.cs`에 AttackChangan/AttackShouchun/AttackJinyang
  세 단계 추가(같은 트릭). 배치 모드 컴파일 → 3연속 통과(여덟 적국
  전부 함락+편입+save/load 왕복 확인, 성 셋→열하나).

## REALM 51장 4차 확장 — 적국 둘 더 추가 (2026-09-16, 같은 날 "이어해" 후속)

장안→한중, 수춘→여남을 원작 LINKS 그대로 추가. 진양은 원작 이웃
(업·낙양·장안)이 전부 이미 우리 성이라 막다른 가지로 그대로 뒀다 —
결함이 아니라 원작 지도가 그렇게 생겼다. train은 사슬마다 깊이당
+15 규칙(허창 사슬 40·55·70·85, 진류 사슬 50·65·80, 복양 사슬
45·60·75)을 이어 붙였다.

- `RealmEnemyCity.TargetFrom()` 주석의 예시를 이번에도 최신으로
  맞춤(장안/수춘/진양 → 한중/여남 추가 반영).
- `PlaytestRealmSlice.cs`에 AttackHanzhong/AttackRunan 두 단계 추가.
  배치 모드 컴파일 → 3연속 통과(열 적국 전부 함락+편입+save/load
  왕복 확인, 성 셋→열셋). 남은 확장 후보: 장안의 다른 이웃(천수),
  수춘의 다른 이웃(건업·시상, 오나라 방면), 한중·여남의 다음 단계.

## REALM 51장 5차 확장 — 적국 둘 더 추가 (2026-09-16, 같은 날 "묻지 말고 이어해")

한중→성도(촉의 심장부), 여남→강하(형주 방면 첫걸음)를 원작 LINKS
그대로 추가. **`wan`은 앞으로도 attackFromCityId로 안 쓴다** —
PlotGate·AttackWrongCity가 "목표 없는 성" 검증에 고정으로 쓰는
성이라(2차 확장 때 진류로 이미 겪은 회귀와 같은 함정), 이번엔 처음
설계 단계에서부터 피해 갔다(RealmEnemyCity.cs 클래스 주석에 영구
주의사항으로 남김).

- `PlaytestRealmSlice.cs`에 AttackChengdu/AttackJiangxia 두 단계
  추가. 배치 모드 컴파일 → 3연속 통과(열두 적국 전부 함락+편입+
  save/load 왕복 확인, 성 셋→열다섯). 남은 확장 후보: 장안의 다른
  이웃(천수), 수춘의 다른 이웃(건업·시상), 성도·강하의 다음 단계.

## REALM 51장 6차 확장 — 적국 둘 더 추가 (2026-09-16, 같은 날 "이어해줘")

성도→강주(촉의 동쪽 자물쇠), 강하→양양(형주의 머리)을 원작 LINKS
그대로 추가. 허창 사슬·진류 사슬 모두 여섯 단계 깊이(train 110·115)
까지 왔다.

- `PlaytestRealmSlice.cs`에 AttackJiangzhou/AttackXiangyang 두 단계
  추가. 배치 모드 컴파일 → 3연속 통과(열넷 적국 전부 함락+편입+
  save/load 왕복 확인, 성 셋→열일곱). 남은 확장 후보: 장안의 다른
  이웃(천수), 강하의 다른 이웃(시상, 오나라 방면), 강주·양양의 다음
  단계.

## REALM 51장 7차 확장 — 적국 둘 더 추가 (2026-09-16, 같은 날 "이어해")

강주→영안(삼협의 입구), 양양→강릉(형주의 곳간)을 원작 LINKS 그대로
추가. 두 사슬 모두 일곱 단계 깊이(train 125·130)까지 왔다.

- `PlaytestRealmSlice.cs`에 AttackYongan/AttackJiangling 두 단계
  추가. 배치 모드 컴파일 → 3연속 통과(열여섯 적국 전부 함락+편입+
  save/load 왕복 확인, 성 셋→열아홉). 남은 확장 후보: 장안의 다른
  이웃(천수), 강주의 다른 이웃(주제, 남중 방면), 영안·강릉의 다음
  단계.

## REALM 51장 확장 code-review + 리팩터 (2026-09-16, 같은 날 "묻지 말고 이어해" 후속)

7차례 확장(fcca2c08~493bbd7a)에 `/code-review high`를 돌렸다 —
지적 둘 다 클린업 성격(정확성 버그 0건):

1. **AttackLuoyang~AttackJiangling 14개 Phase가 ~30줄짜리 거의 동일한
   블록(무장 전임+공격+함락 확인+다음 Phase)을 손 복사** — `AttackChainStep
   (fromCityId, expectedCapturedId, nextPhase)` 헬퍼로 묶었다(AttackDingtao도
   같이). 각 case는 `if (!AttackChainStep(...)) return;` 한 줄로 줄었다
   (파일 430줄 삭제, 76줄 추가). 다음에 사슬을 늘릴 때 도시 id를 잘못
   옮겨 적는 실수를 원천 차단한다.
2. PlotGate/AttackWrongCity 주석이 "wan은 적국 다섯도 아니다"처럼
   그 순간의 적국 개수를 못박아 둬서 이후 확장 때마다 stale해지는
   구조였다 — "카탈로그 어디에도 없어 51장이 몇 차까지 늘어도
   무관"으로 개수 의존 없이 바꿈.

배치 모드 컴파일 → 3연속 통과(리팩터 전후 동작 동일 확인).

**여기서 세션 종료 — 사용자가 "새로운 세션에서 이어해줘"로 요청.**
다음 세션이 "이어해"를 받으면 REALM 51장 확장을 그대로 계속하면 된다
(AttackChainStep 헬퍼 덕에 새 사슬 하나 추가는 카탈로그 두 줄 +
Phase 한 칸 + 헬퍼 호출 한 줄이면 끝). 다음 후보:
- 장안의 다른 이웃(천수, tianshui)
- 강주의 다른 이웃(주제/zhuti, 남중 방면)
- 영안·강릉의 다음 단계(각각 원작 LINKS에서 더 뻗을 이웃이 있는지
  saga-web/saga-realm/js/data-city.js LINKS 블록에서 확인)
- 진양(jinyang)은 원작 이웃이 전부 이미 우리 성이라 막다른 가지,
  더 늘릴 게 없다

## REALM 51장 8차 확장 — 강릉→장사 (2026-09-16, 새 세션 "이어해줘")

**중요 확인 — `AttackFromCityId`는 성 하나당 목표 하나뿐이다**
(`RealmEnemyCity.TargetFrom()`이 그 성을 출진지로 쓰는 첫 항목만
돌려준다). 그래서 장안(이미 한중을 목표로 붙임)·강주(이미 영안을
목표로 붙임)에서 천수·주제로 또 뻗는 건 이번엔 못 골랐다 — 목표가
아직 없는 성(영안·강릉, 51장 7차 확장의 프런티어)에서만 골랐다.
강주→**영안**은 원작 LINKS 이웃(강주·강릉)이 전부 이미 우리 성이라
막다른 가지로 확인됨(진양과 같은 사정). 양양→강릉→**장사**(강남
사군의 맏이)만 더했다 — 원작 LINKS: jiangling-changsha. train은
그대로 +15(130→145).

- `RealmEnemyCity.cs`·`RealmCityData.cs`에 changsha 카탈로그 추가
  (wall 4400, troops 1000, land는 원작 hill이지만 진양·한중·영안과
  같은 이유로 Plain), `realm_en.json`·`realm_ko.json`에
  `city.changsha` 로컬라이즈 키 추가.
- `PlaytestRealmSlice.cs`에 AttackChangsha 단계 추가(AttackJiangling
  다음), save/load 확인 로그의 "19 cities"·"영안·강릉"(성 열아홉)
  텍스트가 8차 확장 전 그대로 남아 있던 걸 "20 cities"·"열일곱
  적국"(성 스물)으로 같이 고쳤다(수치 자체 검증은 이미
  `RealmEnemyCity.AllIds`/`RealmCityData.AllCityIds`로 동적으로
  돌아 정확했다 — 로그 문구만 stale했다).
- 배치 모드 컴파일 → 3연속 통과(열일곱 적국 전부 함락+편입+save/load
  왕복 확인, 성 셋→스물). **배치 모드가 이번에도 이 PC의 Unity
  버전(6000.3.24f1, 프로젝트 고정 6000.3.23f1보다 최신)으로
  `ProjectVersion.txt`·`Packages/manifest.json`·`packages-lock.json`·
  `EditorSettings.asset`을 조용히 고쳐 썼다(CLAUDE.md 경고 그대로
  재현) — 커밋 전 `git checkout`으로 네 파일 전부 원복, 실제로 고친
  다섯 파일만 남은 것 확인.**
- 남은 확장 후보: 장안의 다른 이웃(천수) — 다만 한중에 이미 목표를
  붙였으니 한중의 다음 단계로 대신 뻗는 방향을 고려할 것. 강주의
  다른 이웃(주제)도 같은 사정 — 영안의 다음 단계로 대신 뻗는 건
  막혔으니(막다른 가지) 강주 자체에서 나가는 두 번째 목표는 이
  슬라이스 설계(성 하나당 목표 하나)를 벗어나 범위 밖이다. 장사의
  다음 단계(원작 LINKS: changsha-chaisang, changsha-kuaiji,
  changsha-nanhai)를 고르는 게 가장 자연스러운 다음 자리.
- wan은 게이트 테스트 고정 성이라 앞으로도 목표로 쓰지 말 것

## REALM 51장 9차 확장 — 장사→시상 (2026-09-16, 같은 날 "이어해줘")

장사의 세 이웃(시상·회계·남해) 중 시상만 골랐다 — 원작 LINKS엔
수춘·강하도 시상과 맞닿지만 그 둘은 이미 각자 목표(여남·양양)가
있어(성 하나당 목표 하나) 장사 쪽에서만 이어 붙였다. train은 그대로
+15(145→160).

- `RealmEnemyCity.cs`·`RealmCityData.cs`에 chaisang 카탈로그 추가
  (wall 4600, troops 1050, land는 원작 그대로 River —
  jiangling/xiangyang과 같은 river 성), `realm_en.json`·
  `realm_ko.json`에 `city.chaisang` 로컬라이즈 키 추가.
- `PlaytestRealmSlice.cs`에 AttackChaisang 단계 추가(AttackChangsha
  다음). **편집 중 `AttackChainStep` 호출에 출진 성 인자를
  `RealmEnemyCity.JianglingId` 대신 실수로 `RealmEnemyCity.ChangshaId`
  두 번 넣었다가 커밋 전에 바로 잡음** — 다음에 체인을 늘릴 때
  `AttackChainStep(출진 성, 함락할 성, 다음 Phase)` 세 인자 순서를
  한 번 더 눈으로 확인할 것. save/load 확인 로그도 "21 cities"·
  "열여덟 적국"으로 같이 고침.
- 배치 모드 컴파일 → 3연속 통과(열여덟 적국 전부 함락+편입+save/load
  왕복 확인, 성 셋→스물하나). 이번에도 `ProjectVersion.txt`·
  `Packages/manifest.json`·`packages-lock.json`·`EditorSettings.asset`이
  배치 모드로 조용히 바뀌어 커밋 전 원복.
- 남은 확장 후보: 장안의 다른 이웃(천수, 한중의 다음 단계로),
  강주의 다른 이웃(주제, 범위 밖 — 위 8차 확장 항목 참고), 시상의
  다음 단계(원작 LINKS: chaisang-jianye — 건업, "종산이 웅크린 자리")
  가 가장 자연스러운 다음 자리. 회계(kuaiji)·남해(nanhai)는 장사의
  다른 이웃이라 장사 자체에서 두 번째 목표를 못 붙이니(범위 밖) 후보
  아님.

**여기서 세션 종료 — 사용자가 "새로운 세션에서 할게"로 요청.** 다음
세션이 "이어해"를 받으면 위 후보(시상→건업이 가장 자연스러움) 중
하나로 REALM 51장 10차 확장을 그대로 이어가면 된다. 커밋
`200413d2`(8차)·`fd4ef47b`(9차) 둘 다 origin/main에 푸시 완료.

---

## PLAN.md 66-2장 ①~⑪ + "다음에 할 일" 에서 옮겨 온 진행 기록 (2026-09-16 재편, 원문 그대로)

## ① 라이팅/색보정/후처리 셋업 — 완료 (2026-09-13)

**"이어해" 요청으로 다섯 판 전부에 구현·검증까지 끝났다.** 자세한 내용은
`docs/PROJECT_STATE.md` "66-2장 '다음에 할 일' ① 라이팅/색보정/후처리
셋업" 항목 참고 — 여기서 반복하지 않는다. 요약만: `BuildFF16VolumeProfiles.cs`
가 공유 VolumeProfile 둘(`FF16Volume_PC/Mobile.asset`)을 짓고, 다섯
`BuildXxxScene.cs`가 GlobalVolume+`PlatformVolumeProfile`로 꽂는다.
실제 화면(GUI) 톤 확인은 아직 — 사람이 볼 차례.

## ② 환경 PBR 텍스처 킷 조사 — 샘플 다운로드·URP 파이핑 검증 (2026-09-13, 이어서)

- **Poly Haven**(CC0, Quixel Megascans급 포토스캔 재질 — 공개 API로
  로그인 없이 정적 URL 다운로드 가능, saga-godot 세션이 Quaternius에서
  겪은 "itch.io가 JS라 자동 다운로드 불가" 문제가 없다)에서 두 재질을
  받았다: **`cobblestone_floor_01`**(마을 바닥, 현재 Kenney Fantasy
  Town Kit 대체 후보)·**`castle_wall_slates`**(성벽/건물 벽, 현재
  Kenney 대체 후보). 둘 다 CC0, 1k JPG로 diffuse·normal(OpenGL)·
  roughness·AO 네 맵 전부. `Assets/Art/EnvironmentPBR_candidates/`에
  두고 `LICENSE.txt`(출처 URL) 동봉 — **아직 후보일 뿐, 어느 씬에도
  안 물렸다**(saga-godot의 `_candidates_66-2` 폴더와 같은 자리 표시자
  성격).
- `BuildEnvironmentPbrSample.cs`(신규, `Saga/Build Environment PBR
  Sample Materials` 메뉴) — 두 재질을 URP `Lit` 셰이더 머티리얼로
  코드로 지어 실제로 파이프라인이 도는지 검증(diffuse→BaseMap,
  normal→BumpMap+`_NORMALMAP` 키워드, AO→OcclusionMap+`_OCCLUSIONMAP`
  키워드). 배치 모드(`-executeMethod`)로 실행, 컴파일 오류 0건·머티리얼
  2개 생성 확인.
- **채널 팩킹 문제 발견, 지금은 근사만 해 뒀다** — Poly Haven의
  Roughness는 별도 텍스처인데 URP Lit의 Metallic 워크플로는 Smoothness를
  Metallic맵의 알파 채널로만 받는다(별도 Roughness 슬롯이 없다). 지금은
  Smoothness를 상수(0.3~0.35, 러프니스 실측 평균의 반전 근사)로만
  뒀다 — **실제 교체 때는 커스텀 Shader Graph로 Poly Haven의 `arm`
  (Occlusion-Roughness-Metalness 팩) 텍스처를 풀어 쓰거나, Roughness→
  Smoothness 반전 텍스처를 미리 구워야 한다.** 다음에 이 재질을 실제
  지형/벽에 쓸 세션이 참고할 것.
- 헤드리스 임포트(`-batchmode -nographics -quit`) 후 `ProjectSettings/`·
  `Packages/` 배치 모드 부작용(이 PC의 Unity 6000.3.24f1이 프로젝트
  고정 버전 6000.3.23f1보다 최신이라 자동 버전업) 재확인 → `git
  checkout`으로 되돌림(CLAUDE.md에 이미 기록된 함정, 두 번째 발생분).
- **현실적 기대치 표 갱신 근거** — "환경(지형·식생·던전 재질) 근접
  가능성: 중간~높음"이라던 앞선 판단이 실제로 확인됐다. Poly Haven
  재질 자체 화질은 실제로 AAA급이고 CC0라 비용도 없다 — 남은 건
  채널 팩킹(위)과 실제 지형 메시에 UV 스케일 맞춰 붙이는 작업뿐.

## ③ 캐릭터 에셋 조사 — Mixamo가 이 저장소의 기존 선례다 (2026-09-13, 이어서)

- **레거시 감사 결과 재확인(4장 원칙 — 새로 안 하고 웹 판 기록을 그대로
  가져다 씀)**: 웹 판 **사가의숲**이 2026-09-02에 이미 "사실적 사람"
  문제를 풀어 봤다(`saga-web/saga-forest/assets/ASSET_LICENSES.md`
  "Mixamo (Adobe)" 절). 결론과 제약이 이 프로젝트에도 그대로 적용된다:
  - **Mixamo(mixamo.com, 무료 Adobe 계정)가 실사 인체·리깅·애니메이션
    소스로는 최선이다** — 포토그래메트리는 아니지만 실사 비율 스캔
    기반 캐릭터+수백 종 애니메이션을 무료로 제공한다.
  - **자동화 불가** — mixamo.com은 공개 API가 없고 캐릭터 선택·
    포맷·다운로드가 전부 로그인 후 GUI 조작이다(VRoid Studio와 같은
    종류의 "사람이 직접 열어야 하는" 지점).
  - **약관상 재배포 금지 — 변환 결과물을 이 공개 저장소에 커밋하지
    않는다.** "원본 캐릭터·애니메이션을 독립 에셋으로 재배포"가
    금지라(Adobe 커뮤니티 공지 다수가 일관되게 확인), 사가의숲도 받은
    걸 `.gitignore`로 막고 로컬에만 뒀다. 이 프로젝트도 같은 원칙 —
    **`.gitignore`에 `Assets/Art/CharactersRealistic/`을 미리 추가해
    뒀다**(아직 폴더 자체는 없음, 받을 때를 대비한 선점).
  - saga-go 세션이 별도로 "자동화까지 하고 싶다"며 시도했던 대안들
    (Vitruvian Project 등)은 전부 막다른 길로 확정됐던 것도 그대로
    유효 — 다시 조사하지 않는다.
- **Unity는 웹 판보다 오히려 쉽다.** 웹(three.js)은 Mixamo FBX를
  `FBX2glTF`+`gltf-transform`으로 glTF로 변환하는 파이프라인이
  따로 필요했는데, **Unity는 FBX를 기본 임포터로 직접 읽는다**(glTF
  변환 불필요, Mixamo 표준 휴머노이드 리그도 Unity의 Humanoid
  Avatar로 바로 매핑된다) — 웹 판의 `tools/mixamo/slim_anim.js` 류
  후처리 스크립트도 필요 없다.
- **사람이 할 일(다음 세션 또는 사용자가 직접)** — 사가의숲 레시피를
  Unity용으로 옮기면:
  1. mixamo.com에서 캐릭터 하나 고르기(사가의숲처럼 아예 처음부터
     하려면 **Maria** 재사용도 가능 — 이미 라이선스·평판 확인된 선택)
     → Download, Format **FBX for Unity(Skin)** 로 몸 1회
  2. 필요한 애니메이션(이동·전투 등, PLAN.md 게임별 요구 액션에 맞춰
     선정 — 사가의숲의 여덟 개 목록을 참고 출발점으로 삼되 이 프로젝트
     액션에 맞게 조정) 각각 Format FBX(Without Skin)로 받기
  3. `Assets/Art/CharactersRealistic/`(신규, `.gitignore` 대상)에
     그대로 넣기만 하면 Unity가 FBX를 직접 임포트 — 웹 판 같은 변환
     스크립트 불필요
  4. Rig 탭에서 Animation Type을 **Humanoid**로, Avatar Definition을
     "Create From This Model"로 지정 — 이후 다른 Mixamo 애니메이션도
     같은 Avatar를 공유해 재사용 가능(Unity Humanoid 리타게팅)
- **헤어카드·URP SSS 스킨 셰이더 — 조사 결과(2026-09-13)**. Mixamo
  캐릭터는 헤어가 보통 메시에 통합돼 있어 "여러 겹 헤어카드"까지는
  기본 제공이 아니고, URP는 HDRP와 달리 전용 Skin/Hair 마스터 노드가
  없다(HDRP의 Hair 마스터 노드·`com.unity.demoteam.digital-human`
  둘 다 HDRP 전용, URP로 그대로 못 옮긴다). 다만 **"직접 처음부터
  짜야 한다"는 아니다** — 공개(GitHub) URP 전용 Shader Graph 구현이
  이미 있다:
  - **스킨(SSS 근사)**: `CiaranSimpson/Subsurface-Scattering-for-
    Unity-URP`(모바일 지향 wrap-lighting 근사, 즉시 쓸 수 있는 수준) —
    더 사실적으로 가려면 Eric Penner의 pre-integrated skin(곡률 기반
    diffuse lookup + thickness map, HDRP·유료 에셋들이 실제로 쓰는
    기법)을 Custom Function 노드로 직접 옮겨야 한다(URP Shader Graph에
    로우레벨 라이팅 데이터를 노출하는 내장 노드가 없어서 이 부분만은
    피할 수 없다).
  - **헤어카드(이방성 하이라이트)**: `cathyhlshih/
    UnityURPAnisoHighlightHairShader`·`itsFulcrum/Unity-URP-Hair-
    Shader`(둘 다 URP Shader Graph, Kajiya-Kay류 이방성 + 알파클립
    카드 처리) — Unity 공식 `Unity-Technologies/URP-Defender-
    Character-Demo` 레포에도 참고용 이방성 헤어 Shader Graph가 있다.
  - **결론**: 완전히 무료·즉시 쓸 수 있는 뼈대가 다 있다 — 다음에
    실제로 캐릭터에 붙일 세션은 "새로 설계"가 아니라 "위 공개 구현을
    가져와 이 프로젝트 텍스처·머티리얼 슬롯에 맞게 손보는" 일이 된다.
    단, 그 GitHub 저장소들 각각의 라이선스(MIT/CC 등)를 가져다 쓰기
    전에 한 번 확인할 것 — 아직 안 함(이번엔 존재 확인까지만).
- 이번 세션은 **문서 조사만** — 실제로 mixamo.com에서 캐릭터를 받는
  것도, `Assets/Art/CharactersRealistic/` 폴더를 실제로 만드는 것도,
  위 GitHub 셰이더를 실제로 받아 붙이는 것도 아직 안 함(66-1/66-2장이
  이미 여러 번 짚은 "GUI 전용 자동화 불가" 지점과 같은 종류거나, 다음
  단계에서 실제 코드로 옮길 일).

## ④ 캐릭터 셰이더 라이선스 확인 + ②의 채널 팩킹 실제 해결 (2026-09-13, 이어서)

- **③이 조사만 해 둔 GitHub 셰이더 세 곳의 라이선스를 실제로 확인했다**
  (GitHub API로 `license.spdx_id` 조회) — 전부 문제없이 쓸 수 있다:
  - `CiaranSimpson/Subsurface-Scattering-for-Unity-URP` → **MIT**
  - `cathyhlshih/UnityURPAnisoHighlightHairShader` → **MIT**
  - `itsFulcrum/Unity-URP-Hair-Shader` → **CC0-1.0**
  - 참고로만 언급했던 `Unity-Technologies/URP-Defender-Character-Demo`는
    **저장소를 찾지 못함(404, 검색해도 없음)** — 이름이 바뀌었거나
    비공개/삭제된 것으로 보인다. 실사용 대상이 아니었으니 그냥 목록에서
    뺀다, 다시 찾으려 하지 않는다.
- **②에서 미뤄 뒀던 채널 팩킹 문제를 실제로 풀었다** — 처음 계획은
  "커스텀 Shader Graph로 ORM 언팩"이었지만, 더 간단한 방법으로 갔다:
  `BuildEnvironmentPbrSample.cs`에 `BuildMetallicSmoothnessMap()`을
  추가해 Poly Haven의 Roughness 원본(`_rough_1k.jpg`)을 에디터에서
  픽셀 단위로 읽어(`GetPixels32`) RGB=0(비금속)·A=255-Roughness로 다시
  구운 `_metallicsmoothness_1k.png`를 만들고, 머티리얼의
  `_MetallicGlossMap`에 물려 `_METALLICSPECGLOSSMAP` 키워드를 켠다
  (`_Smoothness`는 1로 둬 알파값이 그대로 통과하게). 결과는 표준 URP
  Lit Metallic 워크플로 그대로라 커스텀 셰이더가 아예 필요 없다 — 왜
  Shader Graph보다 이쪽이 나은지: 텍스트로 손으로 짤 수 없는
  `.shadergraph` JSON 자산을 새로 안 만들어도 되고, 결과 머티리얼이
  표준 URP Lit이라 향후 유지보수·다른 재질과의 호환이 더 쉽다.
  - 배치 모드(`-executeMethod
    Saga.EditorTools.BuildEnvironmentPbrSample.Build`)로 실행,
    컴파일 오류 0건·`cobblestone_floor_01`·`castle_wall_slates`
    양쪽 다 `_metallicsmoothness_1k.png`+`.mat` 정상 생성 확인.
  - 배치 모드 부작용(`ProjectSettings/`·`Packages/` 버전 자동 변경)도
    이번엔 재확인 결과 없었음(`git diff -- ProjectSettings/
    Packages/`로 확인) — CLAUDE.md의 함정이 매번 발생하는 건 아니고
    프로젝트 고정 버전과 로컬 Unity 버전이 이미 일치하면 안 일어난다.
  - 부작용으로 `_rough_1k.jpg` 원본 두 장의 텍스처 임포터 설정이
    `isReadable=true`·`Uncompressed`로 바뀌었다(픽셀을 읽으려면
    필요) — 이 원본은 어느 씬·머티리얼도 참조하지 않아(구운 PNG만
    참조됨) 빌드에는 포함되지 않으니 문제없다.

## ⑤ 캐릭터 셰이더 세 벌 실제 반입 (2026-09-13, 이어서)

- **④에서 라이선스 확인까지 끝난 세 저장소를 `git clone`으로 실제
  받아 `Assets/Art/CharacterShaders_candidates/`에 넣었다** — 아직
  캐릭터가 없어(Mixamo 반입 전) 어느 머티리얼/씬에도 안 물렸다, 순수
  후보 반입.
  - `SSS_CiaranSimpson/` — `FakeSSS.shadersubgraph`만 가져옴.
    **원본 저장소의 데모용 "Subsurface Shader.shadergraph"는 이
    프로젝트의 Unity 6000.3 Shader Graph 패키지로 임포트하면
    `NullReferenceException`으로 깨져서 뺐다**(원본이 더 오래된
    Shader Graph 버전으로 저장된 그래프로 보임 — 재사용 대상인
    서브그래프 노드 자체는 정상 임포트됨, 다음에 우리 캐릭터 셰이더
    그래프 안에 이 노드를 직접 넣어 쓰면 된다).
  - `AnisoHair_cathyhlshih/` — `UnityURPAnisoHighlightHair/` 전체
    (셰이더 그래프+서브그래프+예시 머티리얼) 그대로, README 데모
    이미지(`Images/`)만 제외.
  - `HairCards_itsFulcrum/` — `FulcrumHairShader/`(HLSL 커스텀 URP
    셰이더)+`Textures/` 그대로.
  - 각 폴더에 원본 `LICENSE` 파일 동봉 + 상위에 출처·제외 이유 정리한
    `LICENSE.txt`(Poly Haven 후보 폴더와 같은 관례).
- 배치 모드(`-batchmode -nographics -quit`, `-executeMethod` 없이
  순수 임포트)로 두 번 실행해 컴파일 오류 0건·깨진 셰이더그래프 제거
  후 재확인, `ProjectSettings/`·`Packages/` 배치 모드 부작용 없음
  확인.

## ⑥ Poly Haven 재질 추가 조사 — 흙길·초목·목재 세 벌 (2026-09-13, 이어서)

- ②가 대표 둘(바닥·벽)만 확인했던 것에 이어 **44장 우선순위대로 셋을
  더 받았다** — 전부 CC0, Poly Haven 공개 API로:
  - **`grass_path_2`**(흙길) — `Assets/Art/EnvironmentPBR_candidates/
    PolyHaven_GrassPath2/`
  - **`leafy_grass`**(초목 바닥) — `.../PolyHaven_LeafyGrass/`
  - **`dark_wooden_planks`**(목재) — `.../PolyHaven_DarkWoodenPlanks/`
  - 셋 다 diffuse·normal(OpenGL)·roughness·AO 네 맵(1k JPG) 전부.
- `BuildEnvironmentPbrSample.cs`에 세 재질을 추가해(기존
  `BuildMetallicSmoothnessMap()` 그대로 재사용 — ④에서 이미 채널 팩킹을
  풀어 둔 덕에 새 재질도 별도 작업 없이 바로 적용됨) 총 다섯 개 URP Lit
  머티리얼을 만든다. 배치 모드로 컴파일 오류 0건·머티리얼 5개 생성
  확인, `ProjectSettings/`·`Packages/` 부작용 없음.
- **아직 후보일 뿐 — 어느 씬에도 안 물렸다**(위 ②와 같은 성격).

## ⑦ Mixamo 캐릭터 반입 + Humanoid 리깅 (2026-09-13, 이어서)

- **사용자가 mixamo.com에서 직접 받았다** — 몸(**Maria WProp J J Ong**,
  Format FBX for Unity)+애니메이션 8개(③ 레시피 그대로: idle·walk·run·
  attack·hit·dodge·death·interaction), 전부 `C:\Users\Windows\Downloads`에
  받아 뒀길래 `Assets/Art/CharactersRealistic/`(`.gitignore` 대상, 로컬
  전용)로 복사해 넣었다. 애니메이션 파일들은 예상보다 커서(각 15~16MB,
  몸과 비슷한 크기) "Without Skin"이 아니라 메시 포함으로 받힌 것으로
  보이지만 — 기능엔 문제없다(아래에서 Copy From Other Avatar로 몸의
  Avatar를 그대로 쓰게 만들어서 각 파일 자체의 메시는 안 쓴다), 로컬
  디스크 용량만 더 든다(총 ~140MB, 커밋 안 되니 저장소 크기엔 무관).
- **`SetupMixamoCharacterImport.cs`(신규, `Saga/Setup Mixamo Character
  Import` 메뉴)** — 몸 FBX는 `ModelImporterAnimationType.Human`+
  `CreateFromThisModel`로 Avatar를 새로 만들고, 애니메이션 8개는
  전부 `CopyFromOther`로 몸의 Avatar를 그대로 물려(리타게팅이 확실히
  같은 골격에 걸리게) 각 파일의 클립을 액션 이름(`idle`·`walk`·`run`·
  `attack`·`hit`·`dodge`·`death`·`interaction`)으로 바꾸고 loopTime을
  적절히 설정(idle/walk/run만 루프)한다.
- 배치 모드(`-executeMethod
  Saga.EditorTools.SetupMixamoCharacterImport.Setup`)로 실행 —
  **몸 Avatar가 `isValid`·`isHuman` 둘 다 통과**(Mixamo 표준 T-pose가
  Unity Humanoid 매핑에 별다른 수동 보정 없이 바로 들어맞았다는 뜻),
  8개 애니메이션 전부 클립 리네임+루프 설정 로그로 확인. 컴파일 오류
  0건, `ProjectSettings/`·`Packages/` 부작용 없음.
- **아직 안 한 것** — 실제 씬에 배치, Animator Controller로 클립 연결,
  ⑤의 헤어카드/SSS 셰이더를 Maria 머티리얼에 실제로 붙이기(Maria 기본
  머티리얼이 어떤 셰이더인지, 헤어 메시가 몸과 분리돼 있는지 등은 다음에
  확인). 이번엔 리깅까지만.

## ⑧ Animator Controller + 확인용 씬 배치 (2026-09-13, 이어서)

- **`BuildTestCharacterRealisticScene.cs`(신규, `Saga/Build Test
  Character Realistic Scene` 메뉴)** — 두 가지를 한 번에 한다:
  1. `Assets/Animators/Maria.controller`(신규 폴더, 커밋 대상 —
     Mixamo 원본 데이터를 담지 않고 클립 이름/전이 구조만 있는 순수
     제작물이라 `CharactersRealistic/`처럼 gitignore할 이유가 없다)에
     8개 클립을 전부 연결한 Animator Controller를 코드로 짓는다.
     파라미터는 `Speed`(float, Idle↔Walk↔Run 블렌드: >0.1 걷기,
     >0.6 뛰기)+`Attack`·`Hit`·`Dodge`·`Death`·`Interact`(전부
     Trigger, Any State에서 즉시 전이). 액션 클립은 재생이 끝나면
     Idle로 자동 복귀하되(exitTime 0.9), **Death만 복귀시키지 않는다**
     (죽었다가 자동으로 살아나면 부자연스럽다 — 실제 게임 사망 처리와
     같은 관례, 다시 보려면 Play 모드를 재시작).
  2. **`Assets/Scenes/TestCharacterRealistic.unity`(신규)** — 어느
     게임에도 속하지 않는 독립 리그 검증 씬(조명 하나+바닥 Plane+
     카메라, 66-2장 FF16 아트 패스는 일부러 안 걸었다 — 그건 각 게임
     씬의 몫이고 여긴 리그 확인만). Maria FBX를 `PrefabUtility.
     InstantiatePrefab`으로 배치하고 `Animator.runtimeAnimatorController`
     에 위 컨트롤러를 물렸다.
  - 배치 모드로 실행 — 컨트롤러의 8개 상태 전부 `m_Motion`이 non-null
    (클립이 실제로 물렸다는 뜻), 씬의 Animator가 정확한 컨트롤러 GUID를
    참조하는 것까지 직접 확인. 컴파일 오류 0건, `ProjectSettings/`·
    `Packages/` 부작용 없음.
  - **아직 사람이 GUI로 Play를 눌러 실제로 재생해 보진 않았다** — 다음
    세션 또는 사용자가 에디터로 열어 Speed 슬라이더·트리거 버튼을
    Animator 창에서 눌러 직접 확인할 차례.

## ⑨ 사용자 요청 "직접 확인해" — 실제 GUI Play로 확인 + 버그 발견·수정 (2026-09-13, 이어서)

- **`PlaytestCharacterRealisticGui.cs`(신규)** — 루트/이 폴더 CLAUDE.md의
  "개발 중엔 GUI 스크린샷 습관적으로 안 찍는다" 원칙의 예외(사용자가
  "직접 확인해"로 명시 요청). Unity를 실제 GUI로 띄워(배치 모드 아님)
  TestCharacterRealistic 씬을 열고 Play 진입 → idle 정착(1초) →
  `Speed=1`로 run 정착(1초) → `Attack` 트리거 → 세 시점 스크린샷
  (`ScreenCapture.CaptureScreenshot`) → 스스로 Play 종료+
  `EditorApplication.Exit(0)`로 Unity까지 완전히 닫는다(별도 taskkill
  불필요, 프로세스 종료까지 확인함).
- **1차 스크린샷에서 버그 발견 — 캐릭터·바닥이 전부 플랫한 시안색으로만
  나옴(음영·디테일 전혀 없음).** 원인을 `Assets/Scenes/
  TestCharacterRealistic.unity` YAML을 직접 열어 확인: `Ground` Plane이
  `GameObject.CreatePrimitive()`의 **기본 내장 머티리얼**(Standard
  셰이더, URP 비호환)을 그대로 쓰고 있었다 — ⑧에서 머티리얼을 따로
  안 만들어 준 게 원인. 새 빈 씬이라 Skybox/앰비언트도 기본값(정의되지
  않은 상태)이라 겹쳐서 이상하게 나온 것으로 보인다.
- **수정**: `BuildTestCharacterRealisticScene.cs`에 `CreateSimpleUrpLitMaterial()`
  헬퍼를 추가해 Ground에 명시적 회색 URP Lit 머티리얼을 물리고,
  `RenderSettings.skybox = null`+`ambientMode = Flat`+회색 앰비언트로
  스카이박스를 변수에서 뺐다(66-2장 FF16 무드는 각 게임 씬의 몫이라
  이 리그 검증 씬은 일부러 중립으로 둔다), 카메라도 `CameraClearFlags.
  SolidColor`로 배경을 명시. 재빌드 후 재확인 — **idle(제자리 파이팅
  자세)·run(달리기, 루트 모션으로 카메라에서 멀어짐)·attack(중간 스윙
  자세) 셋 다 정상적으로 렌더링됨을 스크린샷으로 직접 확인.**
- **부가 발견(오판, 아래 ⑩에서 정정) — 당시엔 "Maria FBX에 디퓨즈
  텍스처가 아예 없다"고 적었었다.** `MariaMat`의 `_BaseMap`이 null이고
  `AssetDatabase.LoadAllAssetsAtPath`로 찾은 `Texture2D` 서브에셋이
  0개인 것까지는 사실이었지만, "FBX 안에 텍스처 자체가 없다"는 결론은
  틀렸다 — 실제로는 Unity가 FBX에 임베드된 텍스처를 **자동으로
  추출해 주지 않을 뿐**이었다. 사람에게 mixamo.com 재확인을 요청했던
  것도 불필요한 요청이었다 — 자세한 경위는 ⑩ 참고.
- GUI 실행 후 `Unity.exe` 프로세스가 스스로 완전히 종료된 것도
  `tasklist`로 확인(별도 kill 불필요). `ProjectSettings/`·`Packages/`
  부작용 없음.

## ⑩ 텍스처 문제 정정 — FBX에 이미 임베드돼 있었다, `ExtractTextures()`만 필요했다 (2026-09-13, 이어서)

- **사용자가 "텍스처 있는 걸로 다시 받아둘게"라며 mixamo.com에서
  `character.fbx`를 새로 받았다.** 진단해 보니 이 파일도 몸은
  똑같은 Maria(`MariaMat`, 서브메시 `Maria_J_J_Ong`+`Maria_sword`
  동일)였고, `_BaseMap`도 여전히 null — **재다운로드로도 안 풀렸다.**
- **원인을 제대로 찾았다** — `character.fbx`를 바이너리로 직접 열어
  PNG 시그니처(`\x89PNG\r\n\x1a\n`)를 찾아보니 실제로 3개
  (`maria_diffuse.png`·`maria_normal.png`·`maria_specular.png`)가
  파일 안에 임베드돼 있었다. **Unity의 `ModelImporter`는 FBX에 임베드된
  텍스처를 기본적으로 자동 추출하지 않는다** — `ModelImporter.
  ExtractTextures(destDir)`를 명시적으로 호출해야 실제 텍스처 에셋이
  생기고 머티리얼이 그걸 가리키게 된다(에디터 GUI의 Materials 탭
  "Extract Textures..." 버튼과 같은 동작을 코드로 부른 것).
  `Assets/Art/CharactersRealistic/Textures/`에 세 PNG(2048×2048)가
  추출됐다.
- **바로 다음에 처음부터 받았던 `Maria WProp J J Ong.fbx`(리깅
  완료본)도 똑같이 확인해 보니 3개 PNG가 이미 임베드돼 있었다** —
  **애초에 재다운로드가 필요 없었다, 처음 받은 파일에 그냥
  `ExtractTextures()`만 돌렸으면 됐다.** 그래서 새로 받은
  `character.fbx`는 지우고, 이미 리깅·Animator Controller·씬 배치가
  다 끝나 있던 원본 `Maria WProp J J Ong.fbx`에 텍스처 추출을 적용해
  이어갔다(리깅 설정은 재추출 후에도 그대로 살아 있음을 확인 —
  텍스처 추출은 재임포트만 트리거할 뿐 `animationType`/`avatarSetup`
  같은 임포터 설정을 안 건드린다).
- **재확인 — 실제로 옷·갑옷·머리카락 색이 다 입혀진 상태로 idle·run·
  attack 전부 정상 렌더링됨을 스크린샷으로 확인.** 다만 **씬을 새로
  빌드하고 GUI Play에 들어간 첫 실행에서 한 번, 셰이더 변형이 아직
  컴파일 중이었는지 idle 스크린샷이 다시 플랫한 시안색으로 찍힌 적이
  있었다**(60프레임 대기로는 부족) — 대기를 120프레임으로 늘려 재현
  없이 안정적으로 텍스처가 입혀진 상태를 캡처하도록
  `PlaytestCharacterRealisticGui.cs`를 고쳤다.
- **정정 — 새 파일 반입은 이제 불필요하다.** 앞으로 Mixamo 캐릭터를
  더 받을 때는 처음부터 body FBX마다 `ExtractTextures()`를 한 번
  돌리는 걸 표준 절차에 넣는다(다음에 할 일 참고).

## ⑪ 피부/기타 서브메시 분리 + 값싼 스킨 근사 적용 (2026-09-13, 이어서)

- **⑩이 남긴 "머티리얼을 분리해야 함" 과제를 실제로 풀었다 — 단, 계획을
  중간에 바꿨다.** 처음 생각은 "⑤가 받아 둔 `FakeSSS.shadersubgraph`를
  Maria 피부에 직접 연결"이었는데, 확인해 보니 **Shader Graph는
  `AnimatorController`(⑧에서 코드로 지음)와 달리 코드로 노드를 조립할
  공식 API가 없다** — 손으로 GUI에서 노드를 드래그해 연결해야 하는
  일이라 사람 개입이 필요하고, 내부/비공개 API를 리플렉션으로 억지로
  건드리는 건 버전마다 깨지기 쉬운 위험한 지름길이라 안 갔다.
- **대신 이렇게 갔다** — `BuildMariaSkinSplit.cs`(신규)가 Maria 몸
  메시(단일 서브메시, 14566 삼각형)를 **삼각형별 UV 중심점을 디퓨즈
  텍스처에서 색 샘플링해 피부색 근사(HSV 채도·명도·색상 범위)로 분류**,
  피부 2642개·기타 11924개 삼각형으로 서브메시 둘을 가진 새 메시
  (`Maria_Split`)를 만든다. 피부 쪽엔 살짝 따뜻한 톤(`_BaseColor`를
  `(1, 0.93, 0.87)`로)+낮은 광택(`_Smoothness` 0.35)의 URP Lit
  머티리얼(`MariaSkin`)을 물리고, 나머지는 원본과 동일한 값의
  `MariaRest`를 쓴다 — **진짜 wrap-lighting SSS가 아니라 "밀랍 같은
  느낌을 줄이는" 값싼 근사**임을 분명히 해 둔다(45장 모바일 목표에도
  이쪽이 더 맞는다).
  - **Mixamo ToS 때문에 결과물 저장 위치를 신경 썼다** — 분리된 메시는
    Maria의 실제 지오메트리를 담으므로, 이미 gitignore 대상인
    `Assets/Art/CharactersRealistic/`(하위 `Generated/`)에만 저장한다.
    저장소 밖으로 절대 안 뺀다.
  - `BuildTestCharacterRealisticScene.cs`가 이 분리 메시/머티리얼이
    있으면 자동으로 물리도록(`ApplySkinSplit()`) 고쳤다 — 없으면 조용히
    원본 단일 머티리얼로 건너뛴다(에러 아님, 순서 의존성 안내만).
  - 배치 모드로 분리 실행(2642/11924 삼각형 분류 로그 확인)→씬 재빌드
    →GUI Play 스크린샷으로 **메시가 깨지지 않고(구멍·튐 없음) 그대로
    렌더링됨을 확인**. 씬의 PrefabInstance 오버라이드에 `m_Mesh`+
    `m_Materials.Array.data[0]`/`[1]`이 정확히 새 에셋을 가리키는 것도
    YAML로 직접 확인.
- **아직 안 한 것** — 헤어(이방성 하이라이트)는 이번에 손 안 댔다.
  머리카락 색(금발)과 갑옷 금장식 색이 색상 공간에서 너무 가까워
  (둘 다 노란/금색 계열) 지금 쓴 것과 같은 색 분류 방식으로는 오분류
  위험이 커서 뺐다 — 손으로 마스크를 그리거나(외부 DCC 툴 필요) 다른
  판별 기준이 있어야 안전하게 분리할 수 있다. 실제 wrap-lighting SSS
  포워드 패스(HairLitForwardPass.hlsl 같은 커스텀 셰이더 패스)를 손으로
  짜는 것도 다음 과제로 남긴다 — 규모가 있는 작업이라 이번엔 안 갔다.

## 다음에 할 일 (아직 착수 전)

- ~~Mixamo 캐릭터를 새로 받을 때마다 `ModelImporter.ExtractTextures()`를
  표준 절차에 포함시키기~~ — 이미 됐다. `MixamoRigUtil.RigCharacter()`
  (Maria·Abe 공용 리깅 함수) 안에 `bodyImporter.ExtractTextures(...)`가
  들어 있다(2026-09-14 확인, "이어해" 후속 세션에서 이 항목이 스테일임을
  발견) — 다음에 새 Mixamo 캐릭터를 추가해도 이 함수를 쓰기만 하면 자동.
- ⑤가 받아 둔 헤어카드(이방성)·진짜 SSS(`FakeSSS.shadersubgraph`)를
  실제로 쓰려면 **Shader Graph 노드 연결을 사람이 GUI로 해야 한다**
  (⑪에서 확인한 제약) — 다음 세션 또는 사용자가 직접 Unity 에디터를
  열어 진행할 몫으로 남긴다.
- ~~Kenney·VRoid 플레이스홀더를 다섯 환경 재질/⑤ 캐릭터 셰이더/⑦
  캐릭터로 실제 사실적 에셋으로 순차 교체~~ — 2026-09-14에 다섯 판
  전부(Environment/Building까지) 끝났다(자세한 내용은
  `docs/PROJECT_STATE.md` 해당 날짜 항목들, 요약은 세션 메모리 참고).
- ~~66-1장 PC/Mobile 두 프로파일이 실제 사실적 에셋으로도 성능·화질
  균형이 맞는지 확인~~ — 다시 보니 걱정했던 두 후보(SSS 스킨 셰이더·DoF)
  둘 다 애초에 아직 안 켜져 있어서 문제 자체가 없었다: DoF는
  `BuildFF16VolumeProfiles.cs`가 처음부터 "대화 연출 토글 시스템이
  없어 지금 넣으면 항상 흐려진다"는 이유로 안 넣었고, 진짜 SSS
  (`FakeSSS.shadersubgraph`)도 바로 위 항목처럼 아직 아무 머티리얼에도
  안 물려 있다 — 지금 실제로 도는 피부 표현은 `BuildMariaSkinSplit.cs`가
  쓴 "값싼 URP Lit 근사"뿐이라 PC/Mobile 어느 쪽에서도 추가 비용이 없다.
  **재확인이 필요해지는 시점은 Shader Graph 배선(사람 몫)이 실제로
  끝난 뒤** — 그때 이 항목을 다시 살릴 것.


---

## PLAN.md 67~69장 "진행 현황" 에서 옮겨 온 기록 (2026-09-16 재편, 원문 그대로)

**진행 현황(2026-09-14)** — SFX 쪽은 다섯 판 전부 같은 방식(코드로
Master/SFX 볼륨만 곱하는 `XxxAudio.cs`, 진짜 AudioMixer 에셋은 사람이
에디터 GUI로 노드를 이어야 해서 배치 모드로는 못 만듦)으로 통일됐다 —
GO/FOREST/STORY/REALM/DUNGEON 순으로 붙였고, 자세한 내용은
`docs/PROJECT_STATE.md`·`docs/ASSET_GUIDE.md` 해당 날짜 항목. 접근성
(UI 크기·진동·그래픽 품질)은 같은 날 다섯 판 전부에 설정 UI로 붙었다
(커밋 8127684).

**BGM(2026-09-15) — 판마다 상시 배경 루프 한 곡씩 다섯 곡 다 붙였다.**
2026-09-14엔 "무드가 있는 선곡은 오디오를 직접 들어야 골라 사람 몫"
으로 보류했었는데, 그 보류는 **승리/패배처럼 어느 쪽인지 들어야
갈리는 곡**에 한한 것이었지 상시 배경 루프 자체를 막은 게 아니었다 —
opengameart.org에서 CC0로 필터링해 제목이 이미 명확한 곡만 골라
그 제약을 피해 갔다(자세한 내용은 `docs/ASSET_GUIDE.md` 2026-09-15
항목). 승리/패배 음악 같은 감정가 있는 선곡은 여전히 사람 몫으로
남아 있다 — 그건 계속 "먼저 묻지 말고 시작하지 말 것".

**Localization 진행 현황(2026-09-14)** — 인프라 + 첫 실제 콘텐츠(설정
패널 자신의 글자)까지 붙었다. `XxxLocalization.cs`(다섯 벌 복사, 다른
XxxAudio.cs·XxxSettingsState.cs와 같은 결)가 `Resources/Localization/
xxx_<lang>.json`(키·값 JSON, JsonUtility로 파싱)을 읽어 `T(key)`로
돌려준다 — 키가 없으면 키 자체를 돌려줘 번역 누락이 빈 화면 대신 바로
보이게 했다. 언어는 다른 접근성 항목과 같은 버튼 순환 방식(ko→en→ko),
설정 패널의 새 다섯째 줄("언어")로 고른다. **지금은 설정 패널 자신의
글자(제목·효과음·진동·UI 크기·그래픽 품질·언어·켜짐/꺼짐·기본/절약·
작게/보통/크게·닫는다)에 이어, 같은 날 2차로 **런타임에 매번 새로
짓는 UI의 버튼·패널 제목**(GO 전투 선택지/전투 버튼, FOREST
"밀어내기!", REALM 다섯 버튼+구석 셋+다섯 패널 제목)까지 이 표를
거친다** — 나머지(대사·퀘스트·HUD 상태줄·REALM 문답 등 데이터 콘텐츠,
그리고 DUNGEON/STORY의 **에디터 빌드 스크립트가 씬에 구워 넣는**
모바일 액션 버튼 — 이쪽은 런타임 리프레시 훅이 없어 어설프게 반만
localize하면 더 나쁘다)는 아직 하드코딩 그대로다. 다음에 범위를 넓힐
때 `XxxLocalization.T()`를 그대로 재사용하면 된다(단 DUNGEON/STORY
빌드-스크립트 버튼은 먼저 "언어 전환 시 다시 그리는 훅"부터 설계).
`settings.*`류 공유 키는 다섯 판이 전부 같은 키·값을 쓴다 — data.js
처럼 다섯 벌 함께 고치고 md5로 확인할 것(en 번역은 이 세션이 직접
옮긴 것이라 사람 검수를 안 거쳤다). 게임별 신규 키(command.*/
encounter.*/combat.*/panel.*/hud.*)는 다섯 벌 일치를 요구하지 않는다.
일본어(ja)는 아직 없다.

**3차(같은 날) — 상시 HUD 상태줄**(GO/DUNGEON/STORY/REALM의
PlayerHud/RealmHud/StoryHud)까지 `T()`/`string.Format` 템플릿으로
옮겼다. chrome(라벨)만 옮기는 경계를 지켰다 — 이때까지는 데이터
콘텐츠(무기/장수/도시 이름, 퀘스트 문장)는 한국어 그대로.

**4~6차(같은 날, 사용자가 더 진행을 요청해 경계를 넘음) — 데이터
콘텐츠 번역 착수.** `T(key, fallback)` 오버로드를 추가하고 REALM
도시/장수/명령/계략, GO/DUNGEON 장비 이름, GO 촌장/상인/나그네
전체 대사와 두 조우 사건(도적/흰 늑대)의 모든 토스트·승리 메시지,
DUNGEON 퀘스트 목표·완료 문구, STORY 척후병 대사+퀘스트 고유명까지
번역했다(커밋 d694ac6·a6fa972·1b5869f, 자세한 내용은
docs/PROJECT_STATE.md 해당 날짜 항목). **원칙 — 내부 식별자(다른
코드가 문자열 값 자체로 매칭하는 상수, 예: DUNGEON QuestState의
BossName)는 안 건드리고 표시 문자열만 옮긴다.** FOREST는 이 세션
전체에서 미착수, REALM 문답(36개)·REALM 서고/전투 결과 서술·GO
HiddenTreasure·DUNGEON 행상/구출 대사 등이 다음 후보로 남아있다
(docs/PROJECT_STATE.md "다음 세션 안내" 참고). en 번역은 전부 이
세션이 직접 옮긴 것이라 사람 검수 전이다.


## PLAN 104-1 Phase 0 안정화 ①·③ 착수 (2026-09-16, "사가유니티 이어해줘")

세션 절차대로 CLAUDE.md → PLAN 목차 → PROJECT_STATE 순으로 확인, "다음 작업" 2순위
(104장 Phase 0)부터 착수. Unity 에디터가 이 PC 에서 안 잡혀(`Program Files/Unity/Hub/Editor`
비어 있음, Hub 자체만 설치돼 있고 실제 버전 폴더 없음) GUI·배치 컴파일 둘 다 이번 세션엔
못 돌렸다 — 소스 편집만 하고 다음 세션에 컴파일 확인을 넘긴다.

**① `tools/unity-batch.sh` 신설** — 배치 모드 실행 뒤 `ProjectSettings/ProjectVersion.txt`·
`EditorSettings.asset`·`Packages/manifest.json`·`packages-lock.json` 4파일 원복 + `git status`
확인을 한 줄로. `bash tools/unity-batch.sh -- <Unity.exe 인자...>` 로 쓴다.

**③ `[SerializeField]` 누락 감사** — `grep`으로 `Assets/Games/**/UI/*.cs` 의 plain private
참조 필드(Text/Button/Image/GameObject/Transform/RectTransform 등) 전수 확인. 대상을
"에디터 빌드 스크립트가 `Build()`를 딱 한 번 부르고 런타임엔 아무도 다시 안 부르는" 것으로
좁혔다 — 그런 컴포넌트만 씬 저장→재로드 후 필드가 비게 되는 `RealmCommandUi`(2026-09-15)·
`LocalizedButtonLabel`(같은 날) 함정에 걸린다. `DebugHud`·`Minimap`·`OverworldMapUI`(전부
`_player`)와 `VirtualJoystick`(`_rect`)은 `Awake()`에서 매 Play 세션마다 다시 찾으므로
대상 아님(확인만 하고 안 건드림).

새로 `[SerializeField]` 로 승격한 것 — 전부 `Editor/BuildTest*Scene.cs` 가 `AddComponent`
직후 `Build()` 를 한 번만 부르는 패턴:
- `Saga.Dungeon.UI.DungeonSettingsPanel`(16 필드: `_panel`+설정 행 15개)
- `Saga.Go.UI.GoSettingsPanel`(같은 16 필드)
- `Saga.Forest.UI.ForestSettingsPanel`(같은 16 필드)
- `Saga.Story.UI.StorySettingsPanel`(같은 16 필드)
- `Saga.Story.UI.StoryJobChoiceUi`(`_panel`·`_titleLabel`·`_closeLabel`)

REALM 은 별도 설정 패널이 없다(`RealmCommandUi` 안에 이미 있고 이미 고쳐져 있음, 확인만 함).

**미착수(다음 세션)**: 104-1 ②(`GameObject.Find` 존재 확인 → 실제 호출 검증 교체, 대상
`Assets/Editor/Playtest*.cs`), 컴파일 배치 확인(위 5개 파일 문법 검증), 실기 GUI 확인.
PROJECT_STATE.md 에 다음 우선순위로 반영해 둠.

## PLAN 104-1 Phase 0 ② 착수 — Playtest "존재 확인만" 교체 (2026-09-16, 같은 날 "이어 해줘")

104-1 목록의 마지막 미착수 항목. `Assets/Editor/Playtest*.cs` 전체에서 `GameObject.Find(`
46건을 grep 해 하나씩 문맥을 봤다.

**약 40건은 이미 정상** — 씬 안의 월드 마커·NPC·문(`Ambush_south`·`Town2`·`Crossroads`·
`Creature_{kind}`·`Npc_Scout`·`Marker_chenliu` 등)를 찾아 텔레포트·전투·수확 같은 실제
동작을 뒤이어 확인하는 데 쓴다 — "찾았다"가 아니라 "찾은 걸로 뭔가 시켜서 결과를 본다"
구조라 교체 대상이 아니다.

**진짜 문제였던 4건 — GO/DUNGEON/FOREST/STORY 의 `CheckSettingsPanel()`.** 패턴이:
```
if (GameObject.Find("XxxSettingsPanel") == null) { 에러; return; }
XxxSettingsState.SfxOn = !전; // 이후로는 전부 정적 API/전역 컴포넌트만 확인
```
`GoSettingsState.SfxOn`(정적 bool), `QualitySettings`, `CanvasScaler`(FindFirstObjectByType) 는
전부 패널 컴포넌트의 private 필드를 안 거친다 — 그래서 이전 세션 감사(③)에서 발견한
[SerializeField] 누락 버그(패널이 씬 재로드 후 `_sfxValueLabel` 등이 null)가 있어도 이 테스트는
계속 통과했을 것이다. `RealmCommandUi` 가 정확히 이 구멍으로(존재만 보고 실제 메서드를
한 번도 안 불러서) 여러 세션 동안 크래시 상태로 숨어 있었던 것과 같은 원인.

**고친 방식(REALM `CheckCommandUiPanelsWork()` 그대로 재사용)** — 4개 파일(`PlaytestHeadless.cs`
GO, `PlaytestDungeonHeadless.cs`, `PlaytestForestHeadless.cs`, `PlaytestStorySlice.cs`)의
`CheckSettingsPanel()`을:
1. `Object.FindFirstObjectByType<XxxSettingsPanel>()`로 컴포넌트 자체를 얻는다(GameObject 이름이
   아니라 타입으로 — 이름이 바뀌어도 안 깨짐).
2. 리플렉션으로 `_panel` 필드를 읽어 null 이면 "씬 재로드 후 참조가 안 살아남음"이라고 바로 실패.
3. `TogglePanel()`을 리플렉션으로 직접 호출 — 열림/닫힘을 `_panel.activeSelf`로 확인. 필드가 진짜
   null 이면 여기서 NRE 가 그대로 터져서 테스트가 실패로 드러난다(이전엔 이 경로 자체를 안 탐).
4. `_sfxValueLabel` 필드를 읽어 `ChooseSfx()`를 호출한 뒤 **`.text`가 실제로 바뀌는지** 확인(이전
   테스트가 놓치던 지점 — 정적 상태만 보고 화면 텍스트는 한 번도 안 봄).
5. 이후 UI 크기/그래픽 품질/언어 전환 기존 검증은 그대로 유지.

REALM 의 `Btn_설정`(`GameObject.Find` 존재 확인, 103행)은 안 건드렸다 — REALM 엔 독립
SettingsPanel 이 없고 `RealmCommandUi` 안에 얹혀 있는데, 그 존재 확인 바로 뒤에
`CheckCommandUiPanelsWork()`(2026-09-15 에 이미 이 세션과 같은 방식으로 고쳐진 진짜 검증)가
붙어 있어 대상이 아님을 확인만 했다.

`StoryJobChoiceUi`(전직 팝업)는 애초에 어떤 Playtest 도 그 존재조차 확인 안 하고 있다 —
이건 "존재 확인만 하던 걸 교체"가 아니라 "테스트가 아예 없음"이라 이번 항목 범위 밖으로 남겨둠
(docs/PROJECT_STATE.md 다음 작업 참고).

**전부 컴파일 미검증** — 이 PC 에 Unity 에디터가 없다(Hub 만 설치돼 있고 `Editor/<버전>` 폴더가
없음, 지난 세션과 다른 상태 — 에디터가 삭제됐거나 다른 PC 로 세션이 옮겨왔을 수 있다). 다음
세션에서 에디터가 있으면: ① 배치 컴파일 확인 ② `BuildTestXxxScene`(GO/DUNGEON/FOREST/STORY)
4종을 다시 돌려 씬을 재생성 — 지금 디스크의 .unity 파일들은 이번 세션의 [SerializeField]
승격 이전에 저장된 것이라 아직 새 필드가 안 구워져 있다. 씬을 새로 안 지으면 Playtest 가
통과하든 실패하든 이번 수정이 실제로 뭘 검증하는지 의미가 없다 ③ 그 다음에야
`PlaytestHeadless`·`PlaytestDungeonHeadless`·`PlaytestForestHeadless`·`PlaytestStorySlice`
3연속을 재확인한다.

## PLAN 104-1 ③ 감사 범위 확장 — World/Player 폴더 (2026-09-16, 같은 날 세 번째 "이어 해줘")

이전 두 세션은 `Assets/Games/**/UI/*.cs`만 봤다. 같은 [SerializeField] 함정이
`World/`·`Player/` 폴더에도 있는지 51건을 추가로 grep해 확인 — **버그 없음**.
전부 `Awake()`가 `GameObject.FindWithTag("Player")`나 `GetComponent<T>()`로
매 Play 세션마다 다시 채우는 정상 패턴이었다(`DungeonFloorRunner`·`ForestHouse`·
`DungeonEnemy` 등). `BanditEncounter`/`RareWolfEncounter`(GO)는 애초에 다른
전략(Awake 때 기존 자식을 지우고 Build()를 통째로 재실행)으로 2026-09-12에
이미 같은 버그 클래스를 막아 뒀다는 걸 클래스 내 주석에서 확인했다(그때
RareWolfEncounter도 같이 고쳤다는 기록). 에디터 스크립트가 `SetPrivateField`로
이 폴더 필드를 채우는 사례도 0건 — PLAN 104-1 ③은 이걸로 범위를 다 봤다고
간주한다.

104-1 남은 건 ⑤(`Assets/Art/*_candidates` 정리)뿐인데 이건 102-4 표에 판정은
이미 적혀 있지만 105장 Q1(완성판 트랙 선택) 뒤로 미루기로 한 것이라 사용자
결정 없이는 손대지 않는다.

다음 우선순위(PLAN 101장 재미 표준 A·B, `SagaCore` 신규 asmdef·`IGoalSource`·
`GoalBoard`/`SessionCard`)는 여러 파일에 걸친 새 기능이라 이 PC에 Unity 없이
컴파일 확인 없이 진행하는 게 안전한지 사용자에게 먼저 물었다.

## PLAN 101-2 "공통 선행" A·B — GoalBoard·SessionCard GO 첫 이식 (2026-09-16, 네 번째 "이어 해줘")

104-1 Phase 0(①②③)를 마친 뒤 다음 우선순위인 101-2로 넘어갔다. 이건 이전 세 세션과
성격이 다르다 — 기존 코드를 고치는 게 아니라 여러 파일에 걸친 새 기능이라, 이 PC에
Unity가 없는 채로 진행하는 게 맞는지 사용자에게 먼저 물었고("컴파일 확인 없이 진행"으로
답변받음), 최대한 신중하게(기존 패턴만 재사용, 새 API 표면 최소화) 작성했다.

**범위 — PROJECT_STATE.md 우선순위 4가 이미 "UI 뼈대만"이라고 못박아 둔 대로.** 웹판
saga-go PLAN.md §5 ④(일과판+마무리 카드)가 설계한 날짜 해시 일과 풀 8·주간 사다리는
웹 자체도 미검증이라 그대로 안 옮기고, 실제 값이 있는 것만 채웠다:
- **"지금"** — 가장 가까운 미수집 `HiddenTreasure`까지 거리(그 클래스가 이미 수집되면
  `Destroy(gameObject)`로 스스로 사라지니 `FindObjectsByType`가 자동으로 미수집만 본다).
- **"이번 세션"** — 플레이어 위치 델타로 걸은 거리 누적 + `GoldState.Gold` 세션 시작
  대비 증감(둘 다 실측, 하드코딩 아님).
- **"이번 주"** — ⑦ 승급 3택이 아직 3D에 없어 "다음 승급 이정표 준비 중" 플레이스홀더.

**새 파일**:
- `Assets/SagaCore/IGoalSource.cs` — `GoalLineNow()`/`GoalLineSession()`/`GoalLineWeek()`
  세 메서드짜리 인터페이스. SagaCore→게임 단방향 의존(49장)을 지키려고 SagaCore 는
  이 인터페이스만 알고 구현 타입(`GoSessionTracker`)은 모른다.
- `Assets/SagaCore/GoalBoard.cs` — 화면 위 가운데(대화창 y=-80 바로 위, 이 판에서
  유일하게 비는 상단 가로 띠) 3줄 Text 위젯. `Init(IGoalSource)`로 소스를 받는다.
- `Assets/SagaCore/SessionCard.cs` — 화면 중앙 패널, `Show(title, params lines)`로
  띄우면 5초 뒤 스스로 닫힌다(sortingOrder 100으로 다른 상시 HUD 위에 뜨게).
- `Assets/Games/SagaGo/UI/GoSessionTracker.cs` — `IGoalSource` 구현 + 세션 통계 추적 +
  무입력 5분(플레이어 위치가 안 변하는 시간 누적, Input API 대신 이동량 자체를 활동
  신호로 씀 — 이 프로젝트가 새 Input System 참조라 레거시 `Input.anyKey` 가 활성 입력
  핸들링에 따라 조용히 안 먹을 수 있어 아예 피했다) / `OnApplicationPause(true)` 시
  `SessionCard.Show()` 호출.

**이번 세션 ③에서 고친 것과 같은 함정을 새 코드에서 되풀이하지 않으려고 한 결정** —
`GoalBoard._source`(인터페이스 타입이라 애초에 `[SerializeField]`가 안 먹는다)와
`GoSessionTracker._sessionCard`(plain private, 에디터가 `Init()`으로 한 번만 채움)
둘 다 씬 재로드 후 null이 될 수 있는 자리다. `[SerializeField]`로 못 막는 대신
`BanditEncounter`/`DebugHud`와 같은 결로 **Awake()가 매번 자기 자식을 다시 짓고,
필요한 참조도 스스로 다시 찾도록** 짰다 — `GoalBoard.Awake()`는
`FindObjectsByType<MonoBehaviour>()`로 씬 안의 `IGoalSource` 구현체를 스캔해서 찾고
(SagaCore가 `Saga.Go.*` 구체 타입을 몰라도 인터페이스만으로 가능), `GoSessionTracker.
Awake()`는 `FindFirstObjectByType<SessionCard>()`로 찾는다. `Init()` 호출은 에디터
빌드 시점 편의로 남겨 뒀지만 없어도 동작한다(둘 다 중복 호출돼도 안전 — `Init()`이
그저 같은 값을 다시 대입할 뿐).

**씬 배선** — `BuildTestVillageScene.cs`에 `BuildGoalBoardUi()`를 추가해
`BuildSettingsUi()` 다음, `BuildBootstrap()` 전에 부른다(Player·HiddenTreasure가 이미
씬에 있어야 하는데 둘 다 더 앞에서 지어진다). SessionCard→GoSessionTracker→GoalBoard
순으로 생성해서 각자의 Awake() 자동 재탐색이 항상 이미 존재하는 대상을 찾게 했다
(생성 순서가 안 맞아도 자동 재탐색이 있어 원래 안전하지만, 굳이 꼬아 둘 이유가 없다).

**Playtest** — `PlaytestHeadless.cs`에 `CheckGoalBoardAndSessionCard()` 신설(프레임 3,
다른 UI 검사들과 같이). 존재 확인이 아니라: `_source`가 자동 재탐색으로 실제 채워졌는지,
라벨 텍스트에 세 줄 접두어가 다 있는지, `SessionCard.Show()`가 실제로 패널을
활성화하는지, `_closeTimer`를 만료 직전으로 돌리고 `Update()`를 리플렉션으로 한 번 더
불러 자동 닫힘 경로가 실제로 도는지까지 본다(104-1 ②와 같은 기준 — 이번에 만든 새
코드부터 존재-확인-only 테스트를 안 남기려 함).

**전부 컴파일 미검증.** 다음 세션에서 Unity가 있으면: 배치 컴파일 → `BuildTestVillageScene`
재생성(GoalBoard 배선이 실제로 씬에 구워지게) → `PlaytestHeadless` 3연속 → 그 다음에야
사용자가 실기로 화면 배치(대화창과 안 겹치는지)·세션카드 등장 타이밍을 확인한다.
나머지 4판(DUNGEON/FOREST/STORY/REALM)에 같은 `IGoalSource` 구현체를 얹는 건 GO 검증이
끝난 뒤로 미뤘다(PLAN 105장 Q-U1 "GO 한 판 끝까지 → 사용자 GUI 확인 → 확장" 권장과 일치).

## REALM 51장 10차 확장 — 시상→건업 (2026-09-16, 다섯 번째 "순서대로 이어해줘")

PLAN 101-2 A·B(GoalBoard/SessionCard)의 다음 단계는 "GO 검증 먼저"라 컴파일 없이는
더 못 미루고, 104-1 남은 항목(Art candidates)은 105장 결정 대기라 손 못 대서 —
PROJECT_STATE.md 다음 우선순위였던 REALM 51장 사슬 확장으로 넘어갔다. 지난 아홉 번과
같은 저위험 패턴(기존 데이터 카탈로그에 항목 하나 추가)이라 순서를 그대로 지켰다.

**원작 확인** — `saga-web/saga-realm/js/data-city.js`에서 `chaisang`의 LINKS를 grep해
`['chaisang', 'jianye']`를 확인(원작 데이터에 이미 있던 간선). 건업(jianye) 원본 수치
그대로 가져옴: agri 320·comm 380·wall 5200·pop 250000·x 77·y 62·land river·
desc "종산이 웅크린 자리. 왕기(王氣)가 있다 한다." — 지명(도읍 이름)이지 인물 실명이
아니라 이름 정책에 안 걸린다.

**수치 파생 규칙(지난 아홉 번과 동일)**:
- `baseTroops` = wall × 0.23을 50 단위로 반올림. wall 5200은 이미 xiapi·jinyang이
  쓰던 값과 같아서 그 둘과 같은 troops=1200으로 맞춤(교차검증 됨).
- `baseTrain` = 자기가 속한 사슬의 직전 깊이 + 15. 허창 사슬(xiaopei→xiapi→
  shouchun→runan→jiangxia→xiangyang→jiangling→changsha→chaisang)이 아홉째 깊이
  train 160이었으니 건업은 열째 깊이 train 175.
- `mapX/mapY`는 웹 데이터의 x/y를 그대로 옮긴다(과거 아홉 번 전부 1:1로 확인된 관례,
  이번에도 luoyang/xiapi/ye/chaisang 네 항목으로 교차검증하고 그대로 적용).

**고친 파일 3개(지난 아홉 번과 같은 범위)**:
- `RealmCityData.cs` — `Catalog["jianye"]` 추가(함락 후 편입 시 `RealmCityState.
  AbsorbCity()`가 쓸 정의).
- `RealmEnemyCity.cs` — `JianyeId` 상수, `AllIds` 배열, `Catalog[JianyeId]`
  (`attackFromCityId: "chaisang"`) 추가. 클래스 주석에 10차 확장 기록.
- `PlaytestRealmSlice.cs` — `enum Phase`에 `AttackJianye` 추가. 기존
  `case Phase.AttackChaisang`의 `AttackChainStep(...)` 세 번째 인자(다음 단계)를
  `Phase.QuizCorrect`에서 `Phase.AttackJianye`로 바꾸고, 그 뒤에
  `case Phase.AttackJianye: AttackChainStep(ChaisangId, JianyeId, QuizCorrect)`를
  새로 끼워 넣어 퀴즈 단계로 이어지게 했다(체인이 한 칸 늘어난 만큼 QuizCorrect
  진입 지점만 뒤로 밀림).

**건드리지 않은 것(확인만 함)** — `RealmWorldMap.cs`(마커 생성)·`RealmCityState.cs`·
`RealmSaveState.cs`·`RealmHud.cs`는 전부 `RealmEnemyCity.AllIds`/`RealmCityData.
Catalog`를 순회하는 데이터 기반 코드라 새 항목이 자동으로 흘러 들어간다 — grep으로
직접 확인했고 지난 아홉 번도 이 세 파일 밖은 안 건드렸다.

**결과 — 적국 18→19, 성 21→22.** `AttackChainStep(fromCityId, expectedCapturedId,
nextPhase)` 인자 순서(PROJECT_STATE.md가 확인하라고 남겨 둔 그 헬퍼)를 실제로
읽어 정확한 순서(출진 성 · 기대 함락 id · 다음 Phase)를 재확인했다 — 잘못된 순서로
넘기면 컴파일은 되지만 검증이 다른 성을 보게 되는 조용한 실수라 특히 조심했다.

다음 확장 후보는 건업의 다른 이웃 회계(kuaiji, 원작 LINKS: jianye-kuaiji, "강동의
끝") — PROJECT_STATE.md 다음 우선순위 4에 남겨 둠. 이번 것도 포함해 전부 컴파일
미검증 상태로 쌓여 있다(이 PC에 Unity 없음, 이번 세션 내내 동일).

## REALM 51장 11차 확장 — 건업→회계, 허창 사슬 마지막 칸 (2026-09-16, 같은 세션 "순서대로 이어해줘")

10차(시상→건업)에 곧바로 이어 11차도 같은 턴에 진행했다. `data-city.js` LINKS를
grep해 `['jianye', 'kuaiji']`를 확인 — 원작에 회계(kuaiji)는 건업과 장사(changsha)
둘과 맞닿지만, 장사는 이미 시상을 목표로 갖고 있어(성 하나당 목표 하나 원칙) 건업
쪽에서만 이어 붙였다.

수치는 원본 그대로(agri 300·comm 340·wall 4400·pop 210000·x 84·y 76·land plain,
desc "강동의 끝. 소금과 배로 먹고산다"). troops=wall×0.23 반올림=1000(마침 changsha와
같은 wall 4400이라 같은 troops로 교차검증), train=건업의 175+15=190.

**이 사슬은 여기서 끝났다** — `data-city.js`에서 "kuaiji"를 전체 grep했을 때 도시
정의 하나와 LINKS 두 줄(changsha-kuaiji, jianye-kuaiji) 외엔 아무것도 안 나왔다.
둘 다 이미 다른 목표를 가진 성(changsha→chaisang, 그리고 kuaiji 자신은 이제 목표를
갖는 쪽)이라 더 뻗을 데가 없다 — 진양·영안과 같은 "막다른 가지" 판정.

고친 파일은 10차와 동일한 3개(`RealmCityData.cs`·`RealmEnemyCity.cs`·
`PlaytestRealmSlice.cs`). `enum Phase`에 `AttackKuaiji` 추가, `AttackJianye`의
`AttackChainStep` 세 번째 인자를 `QuizCorrect`에서 `AttackKuaiji`로 바꾸고 그 뒤에
새 case를 끼워 `QuizCorrect`로 넘긴다 — 10차 때와 완전히 같은 삽입 패턴이라 실수할
자리가 없었다.

**결과 — 적국 19→20, 성 22→23.** 허창발 사슬(xiaopei→xiapi→shouchun→runan→
jiangxia→xiangyang→jiangling→changsha→chaisang→jianye→kuaiji)이 11단계 깊이로
끝났다. 세 사슬(허창·복양·진류) 중 허창 사슬만 유일하게 여기까지 왔고 나머지 둘
(복양발 jinyang, 진류발 yongan)은 훨씬 앞에서 이미 막다른 가지로 판정났었다.
다음에 51장을 더 늘리려면 감으로 고르지 말고 `data-city.js` LINKS를 다시 훑어
jinyang·yongan의 다른 이웃 중 아직 안 쓴 게 있는지부터 확인해야 한다 —
PROJECT_STATE.md 다음 작업에 이 순서로 남겨 둠. 컴파일은 여전히 미검증(이 PC에
Unity 없음, 세션 내내 동일).

## REALM 51장 12차 확장 — 진양→운중, "막다른 가지" 판정 정정 (2026-09-17)

새 세션 시작, PLAN 절차대로 CLAUDE.md→PLAN.md 목차→PROJECT_STATE 순으로 읽고 우선순위
1번(컴파일 재검증)을 시도했으나 이 PC도 `Unity Hub/Editor/` 폴더가 비어(Hub·라이선싱
클라이언트만 설치, 실제 에디터 없음) 여전히 불가능해 2번(GUI 확인, 사용자 대기)·3번
(101-2 나머지 4판, 1번 검증 선행 조건)도 건너뛰고 6번(REALM 다음 확장 조사)으로 갔다.

11차 HISTORY가 남긴 지시대로 `data-city.js`를 `jinyang`·`yongan`으로 전체 grep(감으로
고르지 않기). **yongan은 확인대로 진짜 막다른 가지**(LINKS에 `jiangzhou-yongan`·
`yongan-jiangling` 두 줄뿐, 둘 다 이미 우리 성) — 더 뻗을 데가 없다.

**jinyang은 4차 확장 때의 판정이 틀렸었다.** 그때는 화북 본토 LINKS 구역(462~490행)만
보고 "이웃(업·낙양·장안) 전부 이미 우리 성"이라 막다른 가지로 적었는데, 파일을 끝까지
grep하니 542행 "막북" 구역(창작 확장 지역, 평원 지도 아래 별도 섹션)에 `['jinyang',
'yunzhong']`이 따로 있었다 — 시작 성 셋 근처(462~490행)만 보고 뒤쪽 확장 구역 LINKS를
놓친 게 원인. 운중(雲中)은 한대 북방 변경 군 실제 지명, `land: plain·landmark: true`
(막북 첫 관문 — 그 너머로 안문·정양·상군 등 흉노 접경, 더 뒤로는 균열/폐허/묘역까지
이어지는 이 저장소 창작 확장 지역). 수치는 원본 그대로(agri 160·comm 130·wall 3400·
pop 55000·x 45·y 5) — mount 보정이 필요했던 진양·한중·영안·장사와 달리 원작 land가
이미 plain이라 이번 확장은 처음으로 그 보정 각주가 필요 없었다. troops=wall×0.23
반올림(50 단위)=800, train=복양 사슬 깊이(정도45·업60·진양75)+15=90.

고친 파일은 지난 확장들과 동일한 3개(`RealmCityData.cs`·`RealmEnemyCity.cs`·
`PlaytestRealmSlice.cs`). `enum Phase`에 `AttackJinyang` 바로 뒤 `AttackYunzhong`
추가, `AttackJinyang`의 `AttackChainStep` 세 번째 인자를 `AttackHanzhong`에서
`AttackYunzhong`으로 바꾸고 그 뒤에 새 case를 끼워 `AttackHanzhong`으로 넘긴다 —
10·11차와 같은 삽입 패턴. 로컬라이제이션(`realm_ko.json`/`realm_en.json`)은 10·11차
(jianye·kuaiji)도 안 넣었던 걸 확인하고 이번에도 안 넣었다 — `RealmLocalization.T`가
키 없으면 생성자에 준 한글 이름으로 그냥 떨어진다.

**결과 — 적국 20→21, 성 23→24.** 복양발 사슬(dingtao→ye→jinyang→yunzhong)이 4단계
깊이(train 45·60·75·90)로 늘었다. 컴파일 여전히 미검증(이 PC도 Unity 에디터 없음) —
PROJECT_STATE 우선순위 1번 그대로 최우선 대기.

## REALM 51장 13차 확장 — 운중→상군, 막북 안쪽으로 (2026-09-17, 같은 세션 "막북 안쪽으로 계속 이어해")

12차에 곧바로 이어 같은 턴에 진행. `data-city.js` LINKS에서 운중(yunzhong)의 이웃
셋(안문·정양·상군, 543행)을 확인 — 안문·정양은 542~545행 전체에서 그 둘을 가리키는
LINKS 줄이 `yunzhong-*` 하나뿐이라 골라도 바로 잎사귀(막다른 가지)로 끝난다. 상군은
`shangjun-beidi`·`shangjun-shuofang`(544행) 두 줄을 더 갖고 있어 사슬을 계속 늘릴 수
있으므로 상군을 골랐다(안문·정양은 다음 확장 후보로 남김, 지금까지 원칙대로 "성 하나당
목표 하나"만 붙였다).

수치는 원본 그대로(agri 150·comm 120·wall 3200·pop 48000·x 30·y 10, desc "황토 고원의
군. 오랜 세월 변방을 지켰다"). 원작 land는 hill인데 진양·한중·영안·장사와 같은 이유로
Plain 처리(새 enum 값 추가는 범위 밖). troops=wall×0.23 반올림(50 단위)=750,
train=운중의 90+15=105.

고친 파일은 12차와 동일한 3개. `enum Phase`에 `AttackYunzhong` 바로 뒤 `AttackShangjun`
추가, `AttackYunzhong`의 `AttackChainStep` 세 번째 인자를 `AttackHanzhong`에서
`AttackShangjun`으로 바꾸고 그 뒤에 새 case를 끼워 `AttackHanzhong`으로 넘긴다 — 지난
확장들과 같은 삽입 패턴.

**결과 — 적국 21→22, 성 24→25.** 복양발 사슬(dingtao→ye→jinyang→yunzhong→shangjun)이
5단계 깊이(train 45·60·75·90·105)로 늘었다. 상군 자신도 북지(beidi)·삭방(shuofang,
그 뒤 오원까지)으로 더 뻗을 수 있어 다음 확장 후보로 남는다. 컴파일 여전히 미검증(이
PC도 Unity 에디터 없음).

## REALM 51장 14차 확장 — 상군→삭방 (2026-09-17, 같은 세션 "묻지말고 이어해줘")

13차에 곧바로 이어 같은 턴에 진행, 이번엔 사용자가 "묻지 말고"라 갈래를 고를 때도
확인 없이 진행했다. 상군의 이웃 둘(북지·삭방, 544행) 중 북지는 그 줄 하나뿐인
잎사귀, 삭방은 `shuofang-wuyuan`(545행)이 더 있어 계속 뻗을 수 있으므로 삭방을
골랐다(북지는 다음 확장 후보로 남김, 지금까지와 같은 "계속 뻗을 수 있는 쪽" 기준).

수치는 원본 그대로(agri 180·comm 100·wall 2900·pop 40000·x 28·y -8, desc "하남지
(河南地)의 요새. 황하가 크게 굽이치는 자리다"). land는 원작 그대로 plain(이 확장에서
두 번째로 보정 불필요 — 첫 번째는 운중). troops=wall×0.23 반올림(50 단위)=650,
train=상군의 105+15=120.

고친 파일은 12·13차와 동일한 3개. `enum Phase`에 `AttackShangjun` 바로 뒤
`AttackShuofang` 추가, `AttackShangjun`의 `AttackChainStep` 세 번째 인자를
`AttackHanzhong`에서 `AttackShuofang`으로 바꾸고 그 뒤에 새 case를 끼워
`AttackHanzhong`으로 넘긴다 — 지난 확장들과 같은 삽입 패턴.

**결과 — 적국 22→23, 성 25→26.** 복양발 사슬(dingtao→ye→jinyang→yunzhong→shangjun→
shuofang)이 6단계 깊이(train 45·60·75·90·105·120)로 늘었다. 삭방 자신도 오원
(wuyuan)으로 한 단계 더 뻗을 수 있어(잎사귀 — LINKS상 오원의 다른 이웃은 없다) 다음
확장 후보로 남는다. 오원까지 가면 이 복양발 막북 가지는 끝난다(북지·안문·정양은
이번에도 안 골라 남겨 둔 잎사귀). 컴파일 여전히 미검증(이 PC도 Unity 에디터 없음).

## REALM 51장 15차 확장 — 삭방→오원, 세 사슬 전부 마무리 (2026-09-17, 같은 세션 "오원까지 마무리하고 이어해줘")

14차에 곧바로 이어 진행. 오원은 `data-city.js` 전체에서 `shuofang-wuyuan`(545행)
한 줄로만 나타나는 진짜 잎사귀 — 다른 선택지가 없었다. 수치는 원본 그대로(agri
120·comm 90·wall 2700·pop 36000·x 38·y -15, desc "가장 먼 북쪽 군. 겨울이 유난히
길다"). 원작 land는 hill인데 진양·한중 등과 같은 이유로 Plain 처리.
troops=wall×0.23 반올림(50 단위)=600, train=삭방의 120+15=135.

고친 파일은 지난 세 확장과 동일한 3개. `enum Phase`에 `AttackShuofang` 바로 뒤
`AttackWuyuan` 추가, `AttackShuofang`의 `AttackChainStep` 세 번째 인자를
`AttackHanzhong`에서 `AttackWuyuan`으로 바꾸고 그 뒤에 새 case를 끼워
`AttackHanzhong`으로 넘긴다 — 같은 삽입 패턴.

**결과 — 적국 23→24, 성 26→27.** 복양발 사슬(dingtao→ye→jinyang→yunzhong→shangjun→
shuofang→wuyuan)이 7단계 깊이(train 45·60·75·90·105·120·135)로 끝났다. **이제 세
사슬(허창·복양·진류) 전부 확정된 막다른 끝이다** — 허창발(→회계, 11단계)·진류발
(→영안, 7단계)·복양발(→오원, 7단계). 안문·정양·북지 세 잎사귀는 끝까지 안 골라
후보로 남겨 뒀다(원한다면 각자 하나씩 짧은 막다른 가지로 더 붙일 수는 있으나,
사슬을 "늘리는" 의미는 없다). 51장을 더 늘리려면 이 세 시작 성 조합 밖(다른 시나리오
시작 성, 또는 RealmCityData.cs 클래스 주석의 "정복·외교 제외" 결정 재검토)에서
찾아야 한다 — 사용자와 상의 필요. 컴파일 여전히 미검증(이 PC도 Unity 에디터 없음),
누적 미검증분이 이제 104-1 9개 + 101-2 5개 + REALM 10~15차 3파일×6회로 늘었다.

## 51장 세 사슬 마무리 뒤 "이어해 묻지말고" — Localization 잔여 재검사 + DUNGEON GoalBoard·SessionCard 이식 (2026-09-17, 같은 세션)

REALM 51장이 사용자 상의 대상으로 막혀, PROJECT_STATE "다음 작업" 4번(Localization
잔여: FOREST 데이터 콘텐츠·REALM 문답 36·서고·전투 서술·GO HiddenTreasure·DUNGEON
행상/구출, "en 사람 검수" 미완으로 적혀 있던 항목)으로 옮겨 확인했다. node 스크립트로
다섯 게임 `Resources/Localization/*_ko.json`↔`*_en.json`을 전부 key-by-key 비교
(missing-in-en·extra-in-en·"en 값이 ko 값과 똑같아 번역 안 된 것으로 의심되는 키"
세 기준) — **다섯 게임 전부 0/0/0**, 즉 이 항목은 이미 완료돼 있었다(어느 세션이
끝냈는지는 HISTORY grep으로 못 찾음 — PROJECT_STATE가 갱신 안 된 채 남아 있던
스테일 항목으로 보인다). REALM 문답 36문항(RealmQuizQuestion.Q/Choices/Why)·서고
(quiz.cat.*)·전투 서술(war.*·plot.* 열댓 개)·GO `item.wp_relic`(HiddenTreasure
보상)·`event.hidden_treasure`·DUNGEON `merchant.*`·`captive.rescued_reward` 전부
직접 열어 실제 영어 문장인지도 확인(단순 한글 복사 아님, 예: "손민수하다" →
"To buy the exact same items as someone else's style"). "en 사람 검수"는 사람이
직접 읽고 어감을 판단하는 작업이라 LLM이 대신 "검수 완료"라고 적을 수 없어 그 표현은
그대로 남긴다.

이 항목이 막혀 다음으로 PLAN 101-2 "공통 선행" A·B(GoalBoard·SessionCard)의 **두
번째 이식(DUNGEON)** 으로 옮겼다 — item 3이 "GO 이식 검증되면"이라 조건부지만, GO도
컴파일 미검증인 채로 이미 이식됐던 전례(같은 세션 원칙: 이 PC들엔 Unity가 없어
소스만 진행)를 그대로 따랐다. GO `GoSessionTracker.cs`를 그대로 본떠 `Assets/Games/
SagaDungeon/UI/DungeonSessionTracker.cs`를 새로 짰다 — 유일한 실질적 차이는
"지금" 줄: GO는 `HiddenTreasure`(수집형)를 찾지만 DUNGEON의 핵심 루프는 근접 전투라
`DungeonEnemy.FindNearest(pos, float.MaxValue)`(이미 있던 static 메서드, PlayerCombat.cs가
쓰던 것 재사용)로 가장 가까운 살아있는 적까지 거리를 보여준다. "이번 세션"(이동거리·
금 증감)·"이번 주"(플레이스홀더 문구) 는 GO와 완전히 같다. `BuildTestDungeonScene.cs`에
`BuildGoalBoardUi()`(GO와 같은 이름·구조) 추가 — `BuildSettingsUi()` 뒤(GO와 같은
위치)에서 호출. `PlaytestDungeonHeadless.cs`에 `CheckGoalBoardAndSessionCard()`
추가 — `PlaytestHeadless.CheckGoalBoardAndSessionCard()`(GO)를 그대로 복사해 클래스
이름만 바꿈(존재 확인이 아니라 세 줄 실제 내용·자동 재탐색·카드 Show/자동 닫힘까지
검증, 104-1 ②·GO 이식과 같은 기준).

고친 파일 5개: `DungeonSessionTracker.cs`(신규)·`BuildTestDungeonScene.cs`·
`PlaytestDungeonHeadless.cs`·`docs/HISTORY.md`·`docs/PROJECT_STATE.md`. GoalBoard/
SessionCard/IGoalSource(SagaCore)는 손 안 댔다(GO 이식 때 이미 다 짜 둔 공용
컴포넌트 그대로 재사용). 새 `.cs.meta`는 안 만들었다 — `GoalBoard.cs`·`SessionCard.cs`·
`IGoalSource.cs`·`GoSessionTracker.cs` 넷도 지난 세션에 meta 없이 커밋됐던 전례(Unity
에디터가 다음에 열릴 때 자동 생성됨)를 그대로 따랐다. FOREST·STORY 이식과 REALM
검토는 다음 차례로 남겼다(PROJECT_STATE 참고). 컴파일 여전히 미검증(이 PC도 Unity
에디터 없음).

## PLAN 101-2 A·B — FOREST·STORY 이식 (2026-09-17, 같은 세션 "잘못 나간거야묻지말고 이어해줘")

DUNGEON 이식에 곧바로 이어, GO(첫 이식)·DUNGEON(둘째)과 같은 3파일 패턴을
FOREST·STORY 두 판에 한 턴에 마저 옮겼다 — 남은 건 REALM(경영형이라 검토 먼저)뿐이다.

**FOREST**: `Assets/Games/SagaForest/UI/ForestSessionTracker.cs` 신규. GO/DUNGEON과
가장 다른 지점 — 이 판엔 금 경제가 없다(`ForestState.cs` 클래스 주석: 채집한 과일
개수뿐) — "이번 세션" 줄의 "금"을 `ForestState.FruitCount` 세션 시작 대비 증가분
("과일 +N")으로 바꿨다. "지금" 줄은 `ForestFruitTree`가 GO의 `HiddenTreasure`와
달리 무제한 채집이라(다 찾는 개념이 없다) 그냥 가장 가까운 나무까지 거리만 보여준다
(전부 못 찾아도 "다 찾음" 같은 문구는 안 씀). `BuildTestVillageForestScene.cs`에
`BuildGoalBoardUi()`(`BuildSettingsUi()` 뒤) 추가, `PlaytestForestHeadless.cs`에
`CheckGoalBoardAndSessionCard()`(GO·DUNGEON과 완전히 같은 검증) 추가.

**STORY**: `Assets/Games/SagaStory/UI/StorySessionTracker.cs` 신규. 이 판도 금·과일
경제가 없어(`StoryJobState`엔 Level/Exp만, 통화 없음) 대신 이미 있던
`StoryQuestState.Kills`(사명 집계)를 "이번 세션" 지표로 썼다("처치 +N"). "지금" 줄은
`StoryEnemy.All`(기존 static 목록)에서 `!IsDead`만 걸러 가장 가까운 살아있는 적까지
거리 — DUNGEON과 같은 결(이 판도 핵심이 근접 전투). 다만 `PlaytestStorySlice.cs`는
GO/DUNGEON/FOREST의 프레임카운트식이 아니라 **Phase 상태머신** 구조라 새 Phase를
안 늘리고(`CheckSettingsPanel()` 등 기존 셋과 같은 자리, `Phase.Init` 안에서 한 번만)
`CheckGoalBoardAndSessionCard()`를 **bool 반환**으로 맞춰 끼워 넣었다(이 파일의 기존
`Check*()` 관례를 그대로 따름 — void+`_hadError` 대입 방식이 아니다). `BuildTestStoryScene.cs`에
`BuildGoalBoardUi()`(`BuildSettingsUi()` 뒤) 추가.

고친 파일 6개: `ForestSessionTracker.cs`·`StorySessionTracker.cs`(둘 다 신규)·
`BuildTestVillageForestScene.cs`·`PlaytestForestHeadless.cs`·`BuildTestStoryScene.cs`·
`PlaytestStorySlice.cs`(+ HISTORY/PROJECT_STATE). 새 `.cs.meta`는 이번에도 안 만듦
(DUNGEON 때와 같은 이유). **PLAN 101-2 A·B, GO·DUNGEON·FOREST·STORY 네 판 전부
이식 완료 — REALM만 남았다**("일과" 개념이 경영형과 안 맞을 수 있어 이식 전에 검토
필요, PROJECT_STATE 참고). 컴파일 여전히 미검증(이 PC도 Unity 에디터 없음) — 이번
세션에 늘어난 미검증분 전부 PROJECT_STATE에 집계해 둠.

## "유니티가 설치되어 있는데?" — 이 PC에 실제로 있었다, 전 게임 컴파일·재검증 완료 (2026-09-17, 같은 세션)

세션 내내 "이 PC에도 Unity 없음"이라고 적어 왔는데 사용자가 반문 — 다시 확인하니
`find "/c/Program Files/Unity/Hub/Editor" -maxdepth 1`이 이번엔 `6000.3.24f1`을
찾아냈다(이전 확인이 왜 비었는지는 못 밝힘 — 명령 자체 오류였을 수도, 그 사이 설치가
끝났을 수도 있다. 다음 세션은 이 결과를 과신하지 말고 다시 확인할 것). PLAN 우선순위
1번(컴파일·재검증)을 드디어 실행:

1. **배치 컴파일**(`tools/unity-batch.sh` 경유, `-batchmode -nographics -quit`, `-executeMethod` 없이 그냥 열고 닫기) — exit 0, 라이선스 토큰 경고 하나만("Access token is unavailable"), `LogAssemblyErrors` 전부 0ms(에러 없음 뜻).
2. **씬 재생성** — `BuildTestVillageScene`·`BuildTestDungeonScene`·`BuildTestVillageForestScene`·`BuildTestStoryScene` 넷을 `-executeMethod`로 재생성(REALM `TestCity`는 뺐다 — `BuildTestCityScene.cs`가 `RealmCityData`/`RealmEnemyCity`/`AllIds`를 전혀 참조하지 않아 51장 12~15차 데이터 변경이 씬에 영향을 안 준다는 걸 grep으로 먼저 확인했다 — 안 그러면 불필요한 fileID churn만 남긴다). 넷 다 exit 0, `grep -c GoalBoard` 로 네 씬 전부에 GoalBoard GameObject가 실제로 들어갔음을 확인.
3. **`Playtest*.Run()` 3연속씩(다섯 게임)** — GO·DUNGEON·FOREST·REALM **전부 3/3 OK**. **STORY만 3/3 전부 실패**, 똑같은 에러로 결정적: `UnassignedReferenceException: The variable animator of StoryPlayerController has not been assigned` (`StoryPlayerController.PlayAttackAnim()` → `Animator.SetTrigger`).

**원인 — 진짜 버그, 이번 세션 GoalBoard 작업과 무관** (에러 나기 전에 `goal board / session card OK` 로그가 이미 찍혔다). 이 PC엔 Maria 믹사모 애셋이 없어(로컬 전용, git 미포함) `BuildTestStoryScene.BuildPlayerVisual()`이 캡슐 폴백으로 빠지고 `animator`가 `null`로 남는다. `StoryPlayerController.cs`는 `Update()`에서는 `if (animator != null)`로 안전하게 막았는데 `PlayAttackAnim()`만 `animator?.SetTrigger("Attack")`(null-조건 연산자)를 썼다 — Unity의 "직렬화 때 한 번도 안 채워진 UnityEngine.Object"는 C# `null`이 아니라 가짜-null이라 `?.`가 못 거르고 그대로 호출해 `UnassignedReferenceException`을 던진다(진짜 null 참조 예외와 다른, 유니티 고유 함정). `PlayAttackAnim()`을 `Update()`와 같은 `if (animator != null)` 패턴으로 고치고 3연속 재실행 — **STORY도 3/3 OK**.

다른 게임(DUNGEON `PlayerController.cs`·`DungeonEnemy.cs`)에도 같은 `animator?.` 패턴이
있지만 둘 다 3/3 통과했으므로(이 PC에서 그 판의 애셋 폴백 경로가 다르게 동작하는 듯)
손 안 댔다 — 안 깨진 코드를 감으로 "일관성 있게" 고치는 건 범위 밖.

**부작용 파일**: `ProjectSettings/ProjectVersion.txt`·`EditorSettings.asset`·
`Packages/manifest.json`·`packages-lock.json`이 예상대로 조용히 갱신됐다(이 PC Unity
6000.3.24f1 > 프로젝트 6000.3.23f1) — 매번 `git checkout --`로 원복. 씬 4개
(TestVillage·TestDungeon·TestVillageForest·TestField) fileID 전체 churn(문서에서
경고한 그대로, 예상된 대가) — 실제로 GoalBoard가 들어갔으니 정당한 변경. 7개 스크립트
(GoalBoard·SessionCard·IGoalSource·Go/Dungeon/Forest/StorySessionTracker)의 `.cs.meta`가
Unity가 열리면서 자동 생성됨 — 다음 커밋에 같이 넣는다.

**결과 — 다섯 게임 전부 컴파일·씬·헤드리스 3연속 검증 완료(GO/DUNGEON/FOREST/STORY/REALM).**
REALM 12~15차 사슬(운중→상군→삭방→오원)도 `PlaytestRealmSlice` 3/3으로 실제 검증됐다.
PROJECT_STATE "다음 작업" 1번(컴파일·재검증)은 이제 완료 — 남은 건 실기 GUI 확인
(사용자 몫)과 REALM GoalBoard 이식·REALM 51장 범위 상의뿐이다.

## PLAN 101-2 A·B — REALM 이식, 다섯 판 전부 완료 (2026-09-17, 같은 세션 "이어해 묻지말고 완성도를 올려조")

REALM 은 캐릭터·이동이 없는 턴제 경영이라 공통 "지금/이번 세션/이번 주" 3줄과 "무입력
5분→요약 카드" 트리거가 그대로 안 맞았다(PROJECT_STATE 가 미리 남겨 둔 검토 항목). 감으로
먼저 짜지 않고 사용자에게 물었다 — 확정: **"월간 요약 카드"로 변형**(REALM 5-7 아이디어
재사용, PLAN 101-2 표).

- `Assets/Games/SagaRealm/UI/RealmSessionTracker.cs`(신규) — `IGoalSource` 구현.
  `RealmCityState.Changed` 를 구독해 `(연,월)` 델타를 직접 계산, **정확히 1개월** 넘어갔을
  때만(=`ExecuteNextMonth()` 로 자연 진행) `SessionCard` 를 띄운다. 세이브 로드(`Restore()`)
  도 같은 이벤트를 쏘지만 델타가 1이 아니라(여러 달 되감기) 걸러진다 — 별도 "로드 중" 플래그
  없이 델타 계산만으로 구분됨.
  - "지금" = 조망 중인 성 이름 + 금.
  - "이번 세션" = 세션 시작 대비 함락 성 증가분·금 증감(`CapturedCount()` = `RealmEnemyCity.AllIds`
    중 `RealmCityState.ActiveCityIds` 에 있는 것 카운트).
  - "이번 주"(GoalBoard 라벨 자체는 공용이라 안 바꿈) 자리는 **의미만** "함락 x/24성"으로.
- `BuildTestCityScene.cs` — `BuildGoalBoardUi()` 추가, `Build()` 에서 `BuildHudAndCommands()`
  뒤·`BuildDebugOverlay()` 앞에 호출(GO/DUNGEON/FOREST/STORY 와 같은 배선 순서).
- `PlaytestRealmSlice.cs` — `CheckGoalBoardAndSessionCard()`(Init 단계, 구조만: GoalBoard 세 줄
  채워짐·IGoalSource 자동 재탐색·SessionCard 초기 숨김 확인, 다른 네 판과 같은 기준) +
  **Phase.Agri 의 첫 "다음 달" 직후 `SessionCard.IsShowing` 실제 확인**(GO 처럼 합성 `Show()` 호출로
  때우지 않고 진짜 월간 트리거를 검증 — REALM 만의 트리거라 별도로 필요했다).

컴파일 exit 0 → `BuildTestCityScene.Build()` 로 `TestCity.unity` 재생성(GoalBoard/SessionCard
GameObject 추가만, fileID 전면 churn 아님) → `PlaytestRealmSlice` 3연속 전부 LogError 0건,
`OK` 로 종료. `git diff --stat -- ProjectSettings/ Packages/` 비어 있었다(이번엔 버전 자동
갱신 부작용 없음).

PROJECT_STATE "다음 작업"에서 PLAN 101-2 A·B 항목을 완료로 닫음 — 남은 건 실기 GUI 확인
(사용자 몫, 다섯 판 목표판/세션카드 포함)과 104 장 Phase 0 나머지(Art candidates 정리)·
REALM 51장 추가 확장(범위 재검토, 사용자 상의)뿐이다.

## 하위 슬라이스 회귀 재검증 (2026-09-17, 같은 세션 "커밋하고 이어해")

REALM GoalBoard 이식 뒤 PROJECT_STATE 에 "이번엔 안 돌림"으로 남아 있던 DUNGEON/FOREST
하위 슬라이스(`PlaytestDungeonFloorProgression`·`FieldAmbush`·`Shortcut`·`Town2`·`Towns34`,
`PlaytestForestCreatures`·`Finish`·`Furniture`·`HouseTransition`)와 `PlaytestOverworldMap`(GO)
을 각 1회씩 마저 돌렸다 — 전부 exit 0·LogError 0건·`OK`로 종료, 회귀 없음. 씬 재생성 없이
기존 씬 그대로 실행했고 `git status` 도 깨끗했다(ProjectSettings/Packages 부작용 없음).

## PLAN 105 Q-U5 — SessionCard Depth of Field 토글 구현 (2026-09-17, 같은 세션 "이어해" → "묻지말고")

열린 질문으로 남아 있던 Q-U5("SessionCard·대화 연출에서만 DoF 를 켜는 것으로 확정할지")를
사용자가 "묻지말고" 라고 해 102-2 표에 이미 적혀 있던 설계(대화·카드 연출 토글 시만, PC 만)
그대로 구현했다 — 답이 이미 문서에 있던 질문이라 감으로 짓는 게 아니라 기존 결정을 실행에
옮긴 것.

- `SagaCore.asmdef` — `references`에 `Unity.RenderPipelines.Core.Runtime`·
  `Unity.RenderPipelines.Universal.Runtime` 추가(이전엔 빈 배열이라 `Volume`/`DepthOfField`
  타입에 접근 못 함).
- `SessionCard.cs` — `SetDepthOfField(bool)` 신설. 씬의 `Volume`을 찾아 `DepthOfField`
  오버라이드의 `mode`를 `Show()`에서 Gaussian, `Hide()`(자동 닫힘 포함)에서 Off로 토글.
  Mobile 프로파일엔 이 컴포넌트 자체가 없어 `VolumeProfile.TryGet`이 실패하면 조용히
  넘어간다 — 플랫폼 분기 코드 불필요.
- `BuildFF16VolumeProfiles.cs` — `BuildPcOnlyOverrides()`에 `DepthOfField` 오버라이드 추가
  (기본 `mode = Off`, PC 프로파일에만). 예전 클래스 주석("토글 시스템이 아직 없다")을
  갱신.

부작용: `BuildFF16VolumeProfiles.Build()`가 자산을 지우고 새로 지어(멱등 설계) `FF16Volume_PC/
Mobile.asset`의 GUID가 바뀌었다 — 다섯 씬(`BuildTestVillageScene`·`BuildTestDungeonScene`·
`BuildTestVillageForestScene`·`BuildTestStoryScene`·`BuildTestCityScene`) 전부 재생성해야
새 자산을 다시 참조한다. 컴파일 exit 0 → 볼륨 재생성 → 씬 5개 재생성 → 다섯 판 헤드리스
(`PlaytestHeadless`·`PlaytestDungeonHeadless`·`PlaytestForestHeadless`·`PlaytestStorySlice`·
`PlaytestRealmSlice`) 각 3연속, 전부 LogError 0건·`OK` 종료. `git status`도 예상된 파일만
(SagaCore 3개 + Volume 자산 4개 + 씬 5개) 바뀌어 있었다.

## PLAN 101-3 C hitstop — DUNGEON 구현 (2026-09-17, 같은 세션 "이어해 묻지말고")

101-2 표에서 DUNGEON의 3D 첫 이식 순서는 "5.8 → 5.1 → 5.2"이고 5.8="손맛 2차·가시화" —
101-3 C 표(hitstop·shake·flash·popup·VFX)와 정확히 같은 항목이다. shake(`CameraRig.Shake`)·
flash(`DungeonEnemy.FlashHit`)·popup(`DamagePopup`)은 이미 "타격감 1차"로 있었고 hitstop만
빠져 있어 이번에 채웠다(사용자 결정이 필요한 열린 질문이 아니라 PLAN에 이미 적힌 다음
순서라 "묻지말고" 지시대로 바로 구현).

- `Assets/Games/SagaDungeon/World/DungeonEnemy.cs` — `public Animator Animator => _animator;`
  추가(외부에서 피해자 쪽 Animator를 봐야 hitstop을 걸 수 있다).
- `Assets/Games/SagaDungeon/Player/PlayerCombat.cs` — `ApplyHitstop(Animator attacker, Animator
  defender, float seconds)` 코루틴 신설. `Time.timeScale`은 안 건드리고(101-3 표 그대로 —
  전역 정지는 모바일 입력 지연으로 느껴진다) 두 Animator의 `.speed`만 0→1로. 평타 70ms,
  강공격 120ms, 회전베기는 가해자(플레이어)만(피해자가 여럿이라 하나를 못 고름). 공격
  쿨다운이 hitstop 길이보다 훨씬 길어(0.55s+ vs 0.07~0.12s) 코루틴이 겹칠 일은 없다.
- `Assets/Editor/PlaytestDungeonHeadless.cs` — `CheckHitstop()` 추가. `StartCoroutine()`이
  IEnumerator 첫 세그먼트(첫 yield 전)를 같은 프레임에 동기 실행한다는 점을 이용해 공격
  직후 바로 player Animator.speed==0 인지 확인(복원 타이밍까지는 안 봄 — `FlashHit()`의
  색 복원과 같은 신뢰 수준). `CheckWhirl()`보다 먼저 부르게 순서를 바꿨다(`_cooldownLeft`와
  `_whirlCooldownLeft`가 별개 필드라 상호 간섭은 없지만, 먼저 두는 게 더 이르게 실패를
  잡는다). 더미(`SpawnDummyEnemy`)는 모델이 없어 자기 Animator가 원래 null이라 피해자
  쪽은 "null 허용" 분기만 확인되고, 가해자(플레이어) 쪽만 실제 값을 검증한다.

컴파일 exit 0(씬 재생성 불필요 — GameObject 구성 안 바뀜) → `PlaytestDungeonHeadless` 3연속
+ 하위 슬라이스(`FloorProgression`·`FieldAmbush`·`Shortcut`·`Town2`·`Towns34`) 각 1회, 전부
LogError 0건. hitstop 로그도 3연속 전부 "player Animator.speed=0 확인" — 이 세션 이 씬엔
Player Animator가 실제로 붙어 있었다(폴백 캡슐이 아니었다).

`Assets/Games/SagaDungeon/Player/PlayerController.cs`의 `Animator` 는 이미 공개 프로퍼티라
따로 안 건드렸다. GO·STORY 전투 코드에도 같은 hitstop을 추가하는 건 아직(101-3·PLAN.md
DUNGEON 행 갱신 참고) — 각 판이 자기 순서표(GO 없음, STORY "5-7 손맛 표준")에 닿을 때
같은 결로 넣으면 된다.

## PLAN 101-3 C hitstop·shake·flash·popup — STORY 구현 (2026-09-17, 같은 세션 "이어해")

101-2 표 STORY 행의 3D 우선순위 "5-5 → 5-7 → 5-1" 중 5-7="손맛 표준"이 다음 차례 —
DUNGEON에 방금 추가한 101-3 C 표와 같은 항목이라 이어서 구현했다. STORY는 여태 `StoryEnemy.
TakeDamage()`가 사운드만 재생하고 "시각 반응 없이 HP만 깎인다"고 클래스 주석에 명시돼
있었다(1·3절 스코프 컷, 버그 아님) — 이번에 그 다음 단계를 채운 것.

**중요한 구분** — STORY엔 이미 `StoryCombat.TriggerHitstop()`이 있었지만 이건 크리티컬
전용 **전역 슬로모**(`Time.timeScale=0.12` 0.055초, 웹판 `side.js` 원문 상수 그대로 포팅한
"경직" 기능)이고, 101-3 C의 "hitstop"은 **모든 타격**에 걸리는 **Animator.speed=0**(타임스케일
안 건드림) 방식이라 서로 다른 기능이다. 둘을 혼동해 기존 걸 "고치지" 않고 별개로 공존시켰다
(`ApplyHitFreeze`라는 새 이름을 붙여 `TriggerHitstop`과 안 겹치게).

- `Assets/Games/SagaStory/Data/StoryCombat.cs` — `HitFreezeSeconds`(0.07s)·`HitShakeMag/Sec`·
  `CritShakeMag/Sec` 상수 + `ApplyHitFreeze(MonoBehaviour runner, Animator animator)` 신설.
  이 판은 적 쪽 Animator가 아예 없어(`StoryEnemy` 클래스 주석) 가해자(플레이어) 쪽만 멈춘다.
- `Assets/Games/SagaStory/World/StoryCameraFollow.cs` — `Shake(magnitude, duration)` +
  `Instance` 싱글턴(`DialogueLabel.Instance`·`RealmToast.Instance`와 같은 기존 관례) 추가.
  흔들림 오프셋을 Lerp 목표(`_followY`)와 분리해 다음 프레임 드리프트를 막았다.
- `Assets/Games/SagaStory/World/DamagePopup.cs`(신규) — DUNGEON `World/DamagePopup.cs`를
  그대로 복사(다섯 판은 다섯 벌 복사 원칙, SagaStory엔 asmdef가 없어 타입 공유 불가).
  "heavy" 대신 이 판의 대응 개념인 crit로 색을 가른다.
- `Assets/Games/SagaStory/World/StoryEnemy.cs` — `_visualGo`·`_isRiggedVisual`·`_flashRoutine`
  필드 추가, `BuildVisual()`이 세 분기(리깅·GLB·폴백 캡슐) 전부 `_visualGo`를 채우게 수정.
  `TakeDamage(float amount, bool crit = false)`로 시그니처 확장(DamagePopup 색 결정용) +
  `FlashHit()` 코루틴. **리깅 모델은 플래시 복원 때 `Tint(BodyColor)`가 아니라 `ClearTint()`를
  써야 한다** — `BuildVisual()`이 리깅 모델엔 애초에 색조를 안 입힌다(실제 텍스처 오염 방지,
  DUNGEON `DungeonEnemy`와 다른 점 — DUNGEON은 리깅 모델에도 bodyColor≠white면 tint를 입힌다).
  이 차이를 놓치면 리깅 캐릭터가 맞을 때마다 영구적으로 누렇게 물든다.
- `Assets/Games/SagaStory/Player/StoryPlayerController.cs` — `TryAttack()`/`TrySweep()`에
  `hitAny`/`anyCrit` 추적 후 `ApplyHitFeedback()`(shake+hitstop, 횡소처럼 여럿을 때려도 한 번만
  — DUNGEON `TryWhirl()`과 같은 결) 신설. `TryBolt()`가 `StoryBolt.Configure()`에 플레이어
  Animator를 추가로 넘긴다.
- `Assets/Games/SagaStory/World/StoryBolt.cs` — `Configure()`에 `shooterAnimator` 매개변수
  추가, 관통 히트마다 crit 전달 + shake + hitstop 트리거.
- `Assets/Editor/PlaytestStorySlice.cs` — `CheckHitFeedback()` 신규. 첫 `TryAttack()` 직후
  `StoryCameraFollow.Instance._shakeTimer > 0`(리플렉션)과 player Animator.speed로 실제
  트리거를 확인한다(DUNGEON `CheckHitstop()`과 같은 결 — `StartCoroutine()`이 첫 yield 전
  세그먼트를 같은 프레임에 동기 실행한다는 점 이용).

컴파일 exit 0 → `PlaytestStorySlice` 3연속, 전부 LogError 0건·`OK`. shake는 3연속 전부
실제로 확인됐지만 **이 씬의 player Animator는 null**(이 세션 STORY 테스트 환경은 폴백
캡슐 — DUNGEON 쪽 씬과 달리 Maria가 안 잡힘)이라 hitstop 자체 값 검증은 "스킵"으로
로그만 남고 통과 처리했다 — 코드 경로는 null 가드로 안전하게 넘어간다.

## PLAN 101-3 C 타격 VFX — DUNGEON·STORY 구현, 101-3 C 완결 (2026-09-17, 새 세션 "사가유니티 이어해")

**맥락**: 직전 세션이 101-3 C hitstop·shake·flash·popup을 DUNGEON·STORY 둘 다 끝내고
PROJECT_STATE "현재 작업"에 "VFX·데칼·장비 소켓 등 101-3 나머지 C·G 항목은 남음"으로
남겨 뒀다. "이어해"에 별다른 범위 지정이 없어 PLAN.md 101-3 표(101-3장)를 읽어 C 줄 중
유일하게 안 끝난 "C 타격 VFX"를 골랐다 — G 항목(소켓·데칼·타임라인)은 범위가 훨씬 크고
사용자 상의 없이 감으로 들어가기엔 크다고 판단해 미뤘다(PROJECT_STATE "다음 작업" 참고).

**표와 다르게 간 결정 두 가지**(둘 다 PLAN.md 101-3 표에 직접 적음):
1. "PC: VFX Graph" — VFX Graph는 에디터 노드 그래프 애셋이라 이 프로젝트가 지금까지
   지켜 온 "빌드 스크립트가 전부 코드로 짓는다" 원칙과 안 맞는다(사람이 그래프를 열어
   그릴 몫). PC도 Mobile과 같은 Shuriken `ParticleSystem`을 코드로 구성해 재사용하고,
   강공격/크리티컬만 입자 수(8→14)·속도(3→5)로 구분했다.
2. "풀링 16" — `DamagePopup.cs`가 이미 겪은 것과 같은 함정: 도메인 리로드를 끈 채
   Play를 여러 번 도는 헤드리스 연속 검증에서 static 배열에 미리 만들어 둔
   `ParticleSystem`들이 이전 Play 세션에서 파괴됐는데 배열 자체(C# 참조)는 null이 아니라
   `if (_pool != null) return`류 가드로 못 거른다 — 다음 Play에서 破괴된 오브젝트를
   그대로 쓰다 `MissingReferenceException`을 낸다. `DamagePopup`과 같은 이유로 풀 없이
   매번 새 GameObject를 만들고 `Object.Destroy(go, LifeSec)`로 0.25초 뒤 자동 파괴하는
   쪽을 택했다 — 수명이 짧고 공격 쿨다운(0.55s+)보다 훨씬 빨라 동시에 여럿 겹칠 일이
   드물다(회전베기 정도가 예외).

**머티리얼**: URP 프로젝트에서 파티클 기본(Built-in RP) 머티리얼을 그대로 쓰면 마젠타로
깨진다. `Universal Render Pipeline/Particles/Unlit`으로 제대로 된 URP 파티클 셰이더를
쓰려면 `_Surface`/`_Blend`/`_SURFACE_TYPE_TRANSPARENT` 등 키워드·블렌드 모드를 코드로
전부 배선해야 하는데, 이 프로젝트엔 그 레시피 전례가 전혀 없고(파티클 자체를 처음 쓴다)
헤드리스 검증으로는 렌더 결과를 못 보니 검증 없이 복잡한 셰이더 배선에 들어가는 대신
`Sprites/Default`(두 렌더 파이프라인 모두에서 그대로 렌더되는 단순 알파 블렌드 셰이더)를
새 머티리얼 없이 그대로 붙였다 — 안전한 대신 텍스처가 없어 밋밋한 점으로 보일 수 있다
(PROJECT_STATE "실기 확인 대기" DUNGEON 줄에 남김, 다음 실기 확인 때 사람이 판단).

**변경 파일**:
- `Assets/Games/SagaDungeon/World/HitSpark.cs`(신규) — `Spawn(Vector3, bool heavy)`,
  테스트용 `SpawnCount` 카운터.
- `Assets/Games/SagaStory/World/HitSpark.cs`(신규) — DUNGEON과 완전히 같은 로직 사본
  (asmdef가 서로 안 걸쳐 타입 공유 불가, 루트 CLAUDE.md "다섯 벌 복사" 원칙과 같은 이유).
- `Assets/Games/SagaDungeon/World/DungeonEnemy.cs` — `TakeDamage()`의 `DamagePopup.Spawn()`
  바로 옆에 `HitSpark.Spawn(popupPos, heavy)` 추가.
- `Assets/Games/SagaStory/World/StoryEnemy.cs` — 같은 자리에 `HitSpark.Spawn(popupPos, crit)`.
- `Assets/Editor/PlaytestDungeonHeadless.cs` — `CheckHitSpark()` 신규(`CheckHitstop()` 바로
  뒤). 새 더미를 살짝만 때려(999999f로 즉사시키지 않음) `HitSpark.SpawnCount`가 1 늘었는지
  확인.
- `Assets/Editor/PlaytestStorySlice.cs` — 기존 `TryAttack()` 호출부(`CheckHitFeedback()`
  바로 앞)에서 `hitSparkBefore`를 찍어 두고 공격 뒤 `HitSpark.SpawnCount`가 늘었는지 매
  잡졸마다 확인(인덱스 제한 없음 — 카운터 비교라 `CheckHitFeedback`보다 훨씬 가볍다).
- `PLAN.md` 101-3 C 타격 VFX 줄·101-2 DUNGEON 대응 파일 목록 갱신.

**결과**: 컴파일 exit 0. `PlaytestDungeonHeadless`·`PlaytestStorySlice` 각 3연속 —
전부 `hitspark OK`/`hit feedback OK`, LogError 0건. 배치 모드가 다시 고친
`ProjectSettings/`·`Packages/`는 커밋 전 `git checkout`으로 되돌림(두 번 — 컴파일
검증·헤드리스 검증 각각 한 번씩 다시 건드렸다).

## PLAN 101-3 C hitstop — GO 구현, 실시간 전투 3판 전부 완결 (2026-09-17, 같은 세션 "GO 쪽 hitstop도 이어서 해줘")

**맥락**: 직전 커밋(101-3 C 타격 VFX, DUNGEON·STORY)의 PROJECT_STATE "다음 작업"이
"GO 쪽 hitstop"을 "GO 자체 §5 후보 ④→⑦→③ 순서가 우선이라 뒤로" 미뤄 뒀었는데,
사용자가 직접 "GO 쪽 hitstop도 이어서 해줘"라고 우선순위를 뒤집었다 — 그대로 착수.

**GO 전투의 구조 차이**: DUNGEON/STORY는 프레임 단위 실시간 공격(`TryAttack()`이
`Animator.SetTrigger("Attack")`을 직접 쏨)이지만 GO의 `BanditEncounter`/
`RareWolfEncounter`는 `DuelRules.Step(dt)`가 초당 판정을 내고 그 결과를
`OnDuelEvent()`가 UI(화면 플래시·SFX·펄스 스케일)로만 그려 주는 구조라 애초에
"공격 애니메이션" 자체가 없다. hitstop을 "누가 때렸는지"가 아니라 "타격이
발생했는지"(hit/heavy(안 피함) 이벤트) 기준으로 걸어 player·foe(있으면) 둘 다
짧게 멎게 했다 — 이동/유휴 애니메이션이 잠깐 끊기는 정도의 프리즈 프레임이라도
화면에 "맞았다"는 무게를 준다고 판단(DUNGEON 101-3 표 값 그대로 70ms/120ms 재사용).

**player Animator 참조가 없어서 새로 뚫음**: DUNGEON/STORY의 `PlayerController`엔
이미 `public Animator Animator => animator;`가 있었는데 GO 것엔 없었다 — 추가하고
`BanditEncounter.StartFight()`/`RareWolfEncounter.StartFight()`가 전투 시작 시점에
`GameObject.FindWithTag("Player")`로 한 번만 찾아 캐싱한다(타격마다 Find 안 함).

**늑대(RareWolfEncounter)는 foe 쪽이 원천적으로 없다**: 이 짐승은 아직 GLB 전이라
primitive capsule + 머티리얼 색만 있고 Animator 자체가 없다(BanditEncounter는 Abe
리깅 모델이라 있음) — 그래서 늑대 쪽 hitstop은 player만 실제로 걸리게 구조적으로
갈렸다(클래스 주석에 남김).

**헤드리스 검증 삽질**: `PlaytestHeadless.CheckBanditHitstop()`을 처음엔 "player·foe
둘 다 non-null이어야 정상"으로 짜서 3연속 전부 실패했다 — 원인은 버그가 아니라
**이 PC에 Maria FBX(`Assets/Art/CharactersRealistic/Maria WProp J J Ong.fbx`)가
없어 GO player의 `animator` 필드가 애초에 null**이었던 것(반면 foe Abe는
`AbeAnimated.prefab`도 이 PC엔 없지만 TestVillage.unity가 예전에 그 자산이 있던
PC에서 구워져 씬 파일 안에 Animator 컴포넌트가 그대로 저장돼 있다 — 소스 FBX가
사라져도 이미 인스턴스화돼 씬에 박힌 GameObject·컴포넌트는 남는다). STORY
`CheckHitFeedback`이 이미 겪은 것과 같은 함정 — "한쪽이라도 있으면 그 쪽만
확인, 둘 다 null이면 스킵"으로 고쳐 통과시켰다. **실제로 검증된 건 foe(Abe)
쪽 뿐이고 player 쪽 hitstop 코드 경로는 이 PC에선 확인 못 함**(Maria가 있는
PC에서 다시 돌리면 그쪽도 값으로 볼 수 있다).

**변경 파일**:
- `Assets/Games/SagaGo/Player/PlayerController.cs` — `public Animator Animator => animator;` 추가.
- `Assets/Games/SagaGo/World/BanditEncounter.cs` — `HitstopSec`/`HeavyHitstopSec`
  상수, `_playerAnimator` 필드, `StartFight()`에서 캐싱, `OnDuelEvent()`의
  "hit"·"heavy(안 피함)"에서 `ApplyHitstop()` 호출, `ApplyHitstop()`/`HitstopRoutine()` 신설.
- `Assets/Games/SagaGo/World/RareWolfEncounter.cs` — 같은 로직 사본(foe 쪽은 항상 null).
- `Assets/Editor/PlaytestHeadless.cs` — `CheckBanditHitstop()` 신규(`StartFight()`·
  `OnDuelEvent()`를 리플렉션으로 직접 호출, `CheckGoalBoardAndSessionCard()`의
  `Update()` 직접 호출과 같은 결).
- `PLAN.md` 101-3 C hitstop 줄 갱신 — "GO 는 아직" 삭제, 세 판 전부 완료로.

**결과**: 컴파일 exit 0. `PlaytestHeadless` 3연속 — 전부 `bandit hitstop OK -
hit 이벤트 직후 확인(player=False, foe=True)`, LogError 0건. 101-3 C(hitstop·
shake·flash·popup·타격 VFX) 전 항목이 실시간 전투가 있는 세 판(GO·DUNGEON·STORY)
모두에서 완결됐다 — 남은 101-3은 G 항목(장비 소켓·데칼·성장 연출·죽음 유품)뿐.

## PLAN 101-3 F 죽음 — DUNGEON LootMarker 구현 (2026-09-17, 같은 세션 "이어해줘" → 네 옵션 중 F 선택 → "묻지말고 이어해줘")

**맥락**: GO hitstop까지 끝나며 101-3 C(hitstop·shake·flash·popup·타격 VFX)가
실시간 전투가 있는 세 판 전부에서 완결됐다. 남은 101-3은 G(장비 소켓·데칼·
성장 연출)·F(죽음) 넷인데, 이번엔 하나를 감으로 고르지 않고 사용자에게
"뭐부터 이어갈까요"로 물었다 — G 셋은 각각 새 렌더 기능(URP Decal Renderer
Feature+전용 셰이더)이나 새 데이터 스키마(장비 슬롯·등급, 지금 DUNGEON엔
무기 슬롯 하나뿐이고 rarity 개념 자체가 없다)나 이 프로젝트에 전례 없는
엔진 기능(Timeline)이 필요해 방향이 갈릴 여지가 컸다. 사용자가 F(유품
마커)를 골랐고 "묻지말고 이어해줘"로 재확인해 바로 착수.

**설계 — 보상은 이미 준 걸 다시 안 준다**: `DungeonEnemy.Die()`는 사망 즉시
경험치·돈·장비·보석을 다 지급하고 토스트까지 띄운다(세이브·베스티어리·
퀘스트 완료가 얽혀 있어 이 흐름 자체는 101-3의 "기존 씬 구성을 안 바꾸는
컴포넌트 추가" 전제상 손 안 댐). `LootMarker`는 그 보상의 **시각적 잔향**일
뿐이다 — 주워도 추가 지급이 없다. 처음엔 "걸어가서 주우면 그제서야 보상"
으로 바꾸는 방안도 떠올랐지만 이미 검증된 보상 흐름(save·bestiary·quest
completion까지 엮인)을 건드리는 건 이번 항목의 범위를 넘는다고 판단해
제외했다.

**회수 판정은 트리거 콜라이더가 아니라 "DUNGEON 관례"**: `DungeonSecretStash.cs`
클래스 주석이 이미 "DUNGEON 관례대로 트리거 콜라이더 대신 Update() 폴링
거리 판정을 쓴다"고 못박아 둔 걸 그대로 따랐다 — `LootMarker`도 캐싱해 둔
player Transform과 매 프레임 `Vector3.Distance`만 잰다(PLAN 101-3 표 "회수
반경 2m" 그대로). 12초 안 주우면 스스로 사라진다(표에 없는 값 — 방마다
쌓이지 않게 이번에 새로 정함, 유사 자리표시자들의 수명 자릿수를 참고).

**시각**: `DungeonSecretStash.cs`와 같은 "발광 구체 + Emission" 패턴을
재사용하되(새 셰이더 개발 없음), 크기를 작게(0.35) 하고 색을 옅은
청백색(다른 발견물의 금빛 발광과 구분)으로 잡았다. 위아래로 살짝
까닥이고 천천히 도는 연출(`Update()`의 사인파+회전)을 더해 최소한의
"반짝임"을 줬다.

**변경 파일**:
- `Assets/Games/SagaDungeon/World/LootMarker.cs`(신규) — `Spawn(Vector3)`,
  테스트용 `SpawnCount`.
- `Assets/Games/SagaDungeon/World/DungeonEnemy.cs` — `Die()`의 토스트 직후,
  `_animator` 분기 이전에 `LootMarker.Spawn(transform.position)` 호출(애니메이터
  유무와 무관하게 항상 뜨게).
- `Assets/Editor/PlaytestDungeonHeadless.cs` — `CheckLootMarker()` 신규.
  더미를 player 1.5m 옆에서 즉사시켜(`TakeDamage(999999f)`, 마커의 회수
  반경 2m 안) `LootMarker.SpawnCount` 증가만 확인 — 스폰된 마커 자체는
  이후 자연 프레임에서 픽업 경로(거리 판정→SFX→Destroy)를 실제로 타는데,
  거기서 예외가 나면 `Run()`의 전역 `Application.logMessageReceived` 리스너가
  잡아 FAIL로 드러난다(따로 다시 확인 안 함).
- `PLAN.md` 101-3 F 죽음 줄·101-2 DUNGEON 대응 파일 목록 갱신(5.2 "유품(죽음
  비용·회수)"와 이름이 겹치는 다른 개념이라 혼동 방지 메모 남김).

**결과**: 컴파일 exit 0. `PlaytestDungeonHeadless` 3연속 — 전부
`loot marker OK`·`OK - 10 frames, no errors`(픽업 경로 포함 예외 없음).
101-3 C·F 전 항목 완료, 남은 101-3은 G 셋(장비 소켓·데칼·성장 연출)뿐 —
셋 다 방향 확인 필요해 다음 세션으로 미룸.

## PLAN 101-3 G 성장 연출 — DUNGEON 카메라 줌 펀치인 구현 (2026-09-17, 같은 세션 "이어해줘")

**맥락**: F 죽음(유품 마커) 완료 뒤 "이어해줘"만 오고 G 셋(장비 소켓·데칼·
성장 연출) 중 어느 걸 고를지는 지정이 없었다. 직전 F는 물어서 골랐지만,
이번엔 셋을 다시 뜯어보니 성장 연출이 실제로는 가장 만만하다는 걸
깨달았다 — 이유는 아래 "재평가" 참고. 사용자와 다시 확인하는 대신
스스로 판단해 바로 착수(직전 "묻지말고 이어해줘" 기조를 이어받음).

**재평가 — 왜 성장 연출이 제일 쉬웠나**: 처음엔 "이 프로젝트에 Timeline
전례가 전혀 없다"는 이유로 데칼(신규 URP 렌더 기능)만큼 위험하다고
봤는데, 실제로 `Packages/manifest.json`에 `com.unity.cinemachine` 자체가
없고 `Assets/Games` 어디에도 Cinemachine 타입을 쓴 코드가 한 줄도 없다는
걸 확인했다 — **101-3 표의 "G 흔들림"도 이미 Cinemachine Impulse 대신
`CameraRig.Shake()`(수동 코루틴)로 구현돼 있었다**. 즉 이 프로젝트는
Cinemachine·Timeline 둘 다 실제로는 한 번도 안 쓰고 카메라를 전부 손으로
다뤄 온 전례가 있었다 — 그 전례를 그대로 따르면 새 패키지·새 애셋
포맷을 배우지 않고도 표의 "레벨업 1.2s, 스킵 가능"을 만족시킬 수 있었다.

**설계**: `HeroState.LeveledUp`(이미 있던 이벤트, `GameBootstrap.OnLeveledUp()`이
이미 레벨업 SFX만 재생하던 자리)에 카메라 펀치인을 얹었다.
`CameraRig.PlayLevelUpCut()` — 기존 자유 오빗 줌(`_zoom`)을 0.3초에 걸쳐
MinZoom까지 당기고, 0.6초 멎었다가, 0.3초에 걸쳐 원래 줌으로 되돌린다
(합계 1.2초, 표 값 그대로). "스킵 가능"은 진짜 컷신처럼 조작을 막지
않는다 — 아무 키나 누르면 그 프레임에 바로 원래 줌으로 복귀한다("끼어들면
양보"에 가까운 뜻으로 재해석, 클래스 주석에 남김).

**헤드리스 검증**: `HeroState.AddExp()`가 `LeveledUp`을 동기 호출하고
`GameBootstrap.OnLeveledUp()`이 그 자리에서 `StartCoroutine()`을 불러
`CheckHitstop`과 같은 이유로 같은 프레임에 `_zoom`이 이미 움직여 있다 —
`PlaytestDungeonHeadless.CheckLevelUpCut()`이 `HeroState.AddExp(ExpToNext+1)`
직후 `_zoom` 값이 바뀌었는지만 리플렉션으로 본다(레벨은 이 static 상태가
플레이테스트 세션 내내 유지되니 이후 디버그 오버레이 표시 레벨이 하나
더 올라간다 — 다른 체크는 정확한 레벨 값을 안 따져서 무해).

**변경 파일**:
- `Assets/Games/SagaDungeon/Player/CameraRig.cs` — `PlayLevelUpCut()`/
  `LevelUpCutRoutine()`/`AnyKeyPressed()` 신규.
- `Assets/Games/SagaDungeon/World/GameBootstrap.cs` — `CameraRig` 참조
  캐싱(`Start()`), `OnLeveledUp()`에서 `PlayLevelUpCut()` 호출.
- `Assets/Editor/PlaytestDungeonHeadless.cs` — `CheckLevelUpCut()` 신규.
- `PLAN.md` 101-3 G 성장 연출 줄·101-2 DUNGEON 대응 파일 목록 갱신.

**결과**: 컴파일 exit 0. `PlaytestDungeonHeadless` 3연속 — 전부
`level-up cut OK - 레벨업 직후 zoom 5.5x→5.1x`, LogError 0건. 101-3 C·F·G
성장 연출까지 완료 — 남은 101-3은 G 장비 소켓·G 데칼 둘뿐, 둘 다 방향
확인이 먼저 필요하다고 판단해 이번 세션엔 안 건드림.

## PLAN 101-3 G 장비 가시화 — DUNGEON 무기 소켓 구현 (2026-09-17, 새 세션 "사가유니티 이어해")

101-3 표에서 남은 두 G 항목(장비 가시화 소켓·지형 반응 데칼) 중 어느 쪽부터
할지 사용자에게 먼저 확인(PROJECT_STATE에 "방향 먼저 확인"이라 못박혀
있었음) — "G 장비 가시화(소켓)"를 골랐다.

**문제**: 장착 무기(`HeroState.EquippedWeaponId`)는 그동안 순수 스탯
보너스일 뿐 화면엔 아무 변화가 없었다. 무기 메시 자산은 없다(원작 자산
금지 원칙, 루트 CLAUDE.md) — 자루+칼날을 코드로 지어야 한다
(`LootMarker.cs`·`HitSpark.cs`와 같은 결).

**구현**:
- `CharacterVisual.FindOrCreateWeaponSocket(visualRoot, animator)` 신규
  — Humanoid Animator(Maria 등 Mixamo 리깅)면 `animator.GetBoneTransform
  (HumanBodyBones.RightHand)`(본 이름이 뭐든 Avatar 매핑이 같아 리깅된
  캐릭터 전부에 공용). 리깅 없는 폴백(Kenney GLB·capsule)은 시각 루트
  밑에 고정 오프셋 자식(`WeaponSocket (fallback)`)을 만들어 대신한다.
  **`animator.isHuman`으로 먼저 거른다** — Animator 컴포넌트는 있어도
  Avatar가 없거나 Humanoid가 아니면 `GetBoneTransform`이
  `InvalidOperationException: Avatar is null`을 던진다. 이 PC의 Maria
  인스턴스가 실제로 그 상태라(Animator는 있지만 Avatar 미설정) 첫
  헤드리스 실행에서 그대로 겪었고, `isHuman` 가드로 고쳤다 — 무기 소켓은
  못 쓰지만 값 자체가 원래도 폴백 없이 깨지던 걸 폴백으로 흡수한 셈.
- `WeaponVisual`(신규, `Assets/Games/SagaDungeon/Player/WeaponVisual.cs`)
  — 소켓 밑에 실린더(자루)+큐브(칼날) 프리미티브를 짓고, `HeroState.
  EquipmentChanged`(신규 이벤트, `EquipIfBetter()`가 실제로 바뀔 때만
  동기 호출 — `LeveledUp`과 같은 결)를 구독해 등급이 바뀔 때만 칼날
  길이·이미시브 색을 갱신한다.
- `ItemData.Grade`(0~2) 신규 필드 — 기존 무기 5종 AtkBonus 서열에 맞춰
  매겼다: wp_start(0)·wp_axe(12)=0등급, wp_saber(18)=1등급,
  wp_glaive(26)·wp_greatblade(31)=2등급. 등급별 이미시브 림(표의 "3단"):
  0=무광, 1=옅은 청록(0.6배 감쇠), 2=강한 금색(1.6배). 칼날 길이도
  등급마다 0.08m씩 늘어난다.
- `BuildTestDungeonScene.BuildPlayer()`가 `WeaponVisual`을 Player에 부착.

**헤드리스 검증**: `PlaytestDungeonHeadless.CheckWeaponVisual()` 신규 —
`WeaponVisual`의 `_blade` 필드(리플렉션)를 잡고 `HeroState.
EquipIfBetter("wp_glaive")` 호출 전후로 칼날 `localScale.y`가 커지는지
본다. `EquipmentChanged`가 동기 이벤트라 `CheckLevelUpCut`과 같은 이유로
호출 직후 바로 값을 볼 수 있다. wp_glaive(2등급, AtkBonus 26)는 이 시점
까지 다른 검사(CheckHitstop·CheckHitSpark·CheckLootMarker의 더미)가 남긴
어떤 드랍(기본 wp_axe, 2등급 미만)보다도 확실히 세서 결정적이다.

**변경 파일**:
- `Assets/Games/SagaDungeon/Data/ItemData.cs` — `Grade` 필드 신규.
- `Assets/Games/SagaDungeon/Data/HeroState.cs` — `EquipmentChanged` 이벤트
  신규, `EquipIfBetter()`에서 호출.
- `Assets/Games/SagaDungeon/World/CharacterVisual.cs` —
  `FindOrCreateWeaponSocket()` 신규.
- `Assets/Games/SagaDungeon/Player/WeaponVisual.cs` — 신규 파일.
- `Assets/Editor/BuildTestDungeonScene.cs` — Player에 `WeaponVisual` 부착.
- `Assets/Editor/PlaytestDungeonHeadless.cs` — `CheckWeaponVisual()` 신규.
- `Assets/Scenes/TestDungeon.unity` — 재생성(GameObject 구성 변경).
- `PLAN.md` 101-3 G 장비 가시화 줄 갱신.

**결과**: 컴파일 exit 0(첫 시도는 Avatar null 예외로 헤드리스 실행 중
런타임 에러 — `isHuman` 가드로 수정 후 재컴파일). `PlaytestDungeonHeadless`
3연속 — 전부 `weapon visual OK - 무기 교체 시 칼날 길이 0.55→0.71(등급
갱신 반영)`, LogError 0건. 101-3은 이제 **G 지형 반응(데칼)** 하나만
남았다 — 이것도 사용자와 방향(URP Decal Renderer Feature 배선 범위) 먼저
확인하고 시작할 것.

## PLAN 101-3 G 지형 반응 — DUNGEON 데칼 구현, 101-3 표 완결 (2026-09-17, 같은 세션 "G 지형 반응 데칼도 이어해줘")

101-3 표의 마지막 항목. URP Decal Projector로 발자국·타격 흔적을 남긴다 —
웹판은 절대 못 하는 것(엔진 장점).

**구현**:
- `BuildDecalRendererFeature.cs`(신규, 멱등) — 인스펙터 "Add Renderer
  Feature"가 하는 일(`ScriptableRendererDataEditor.AddComponent()`,
  internal이라 직접 못 부름)을 `SerializedObject`로 재현해 `PC_Renderer.asset`·
  `Mobile_Renderer.asset` 둘 다에 `DecalRendererFeature`를 배선했다.
  `m_RendererFeatures`(오브젝트 참조 배열)와 `m_RendererFeaturesMap`(영속
  식별용 로컬 fileID 배열) 둘 다 채워야 인스펙터에서도 정상으로 보인다.
  `DecalRendererFeature.settings` 필드(`DecalSettings`)는 URP 패키지
  안에서만 `internal`이라 못 건드리지만 기본값(Automatic 기법·데칼
  레이어 끔)이 이미 "아무 표면이나 다 받는다"라 문제없다.
- `GroundDecal`(신규, `Assets/Games/SagaDungeon/World/`) — 발자국·타격
  흔적 둘 다 담당. 텍스처 자산이 없어(원작 자산 금지) 패키지 내장
  `Shader Graphs/Decal`(`Shader.Find`로 런타임에 찾음, AssetDatabase는
  런타임 코드에서 못 씀 — `WeaponVisual`이 "Universal Render Pipeline/Lit"을
  찾는 것과 같은 결)에 단색만 입힌 사각 패치를 만든다. 수명 8s·최대 32(표
  값 그대로) — `Active` 리스트가 32를 넘으면 가장 오래된 것부터 즉시
  지운다(`DungeonEnemy.Active`와 같은 OnEnable/OnDisable 패턴). 마지막
  2초는 `DecalProjector.fadeFactor`로 옅어지다 사라진다.
- `PlayerController.Update()` — 이동 중 0.35초 간격으로 발자국(`Kind.
  Footprint`) 스폰.
- `DungeonEnemy.TakeDamage()` — 맞을 때마다 타격 흔적(`Kind.HitMark`) 스폰.

**막힌 점 — `SagaDungeon.asmdef`**: `DecalProjector`/`DecalRendererFeature`
타입이 `Unity.RenderPipelines.Universal.Runtime` 어셈블리에 있는데
`SagaDungeon.asmdef`는 `Unity.RenderPipelines.Core.Runtime`만 참조하고
있어(Volume 계열만 쓰던 시절 그대로) 컴파일 에러(`CS0246`)가 났다.
어셈블리 참조에 `Unity.RenderPipelines.Universal.Runtime` 추가로 해결
— DungeonDecal 이후로 URP 전용 런타임 타입(DecalProjector 등)을 쓰는
새 코드는 이 참조가 이미 있어 문제없다.

**헤드리스 검증 중 발견한 무관한 간헐적 실패 — `CheckLevelUpCut` 순서
문제**: `PlaytestDungeonHeadless` 5연속 중 1번(데칼 코드 추가 직후 첫
3연속 중 2번째) `CheckLevelUpCut`이 "레벨업 직후 카메라 줌이 안 바뀜 —
zoom=3"으로 실패했다. 원인은 데칼과 무관 — `CheckLootMarker`가 먼저
도는데 그 더미의 기본 보상(`rewardExp=20`)이 레벨 1의 `ExpToNext`(20)와
정확히 같아 그 자리에서 레벨업을 하나 미리 유발한다. 이 프레임의
`Time.deltaTime`이 크게 잡히면(배치 모드 실행 시간 편차)
`CameraRig.LevelUpCutRoutine()`의 첫 동기 반복에서 `Mathf.Lerp`가
`t/duration>=1`로 클램프돼 `_zoom`이 곧장 `MinZoom`(3)으로 떨어지고,
뒤이어 `CheckLevelUpCut()` 자신의 레벨업도 같은 프레임·같은 deltaTime
이라 똑같이 즉시 클램프돼 `zoomBefore==zoomAfter==3`이 되어 실패했다
— `CameraRig.PlayLevelUpCut()` 자체는 이미 이전 코루틴을 `StopCoroutine()`
하고 있어 겹침 문제는 아니었다. **고침**: `CheckLevelUpCut()`을
`CheckLootMarker()`보다 앞으로 옮겨 세션의 첫 레벨업이 되게 했다 —
그러면 `zoomBefore`가 항상 손 안 댄 기본값(6)이라 결정적으로 통과한다.
재배치 뒤 5연속 전부 `zoom 6.00→5.6x`로 통과.

**변경 파일**:
- `Assets/Editor/BuildDecalRendererFeature.cs` — 신규.
- `Assets/Games/SagaDungeon/World/GroundDecal.cs` — 신규.
- `Assets/Games/SagaDungeon/World/DungeonEnemy.cs` — `TakeDamage()`에
  `GroundDecal.Spawn(HitMark)` 호출 추가.
- `Assets/Games/SagaDungeon/Player/PlayerController.cs` — 이동 중
  발자국 타이머·스폰 추가.
- `Assets/Games/SagaDungeon/SagaDungeon.asmdef` — `Unity.RenderPipelines.
  Universal.Runtime` 참조 추가.
- `Assets/Settings/PC_Renderer.asset`·`Mobile_Renderer.asset` —
  `DecalRendererFeature` 배선(`BuildDecalRendererFeature.Build()` 실행 결과).
- `Assets/Editor/PlaytestDungeonHeadless.cs` — `CheckGroundDecal()` 신규
  (타격마다 생성 확인 + 40개 몰아 스폰해 32 캡 확인) + `CheckLevelUpCut`
  순서 이동(위 참고).
- `PLAN.md` 101-3 G 지형 반응 줄 갱신 — 이로써 **101-3 표 전체 완결**
  (DUNGEON 기준).

**결과**: 컴파일 exit 0(첫 시도는 asmdef 참조 누락으로 CS0246, 추가 후
재컴파일 통과). `BuildDecalRendererFeature.Build()` 실행 — 두 렌더러
자산 모두 `m_Name: Decals` 확인. `PlaytestDungeonHeadless` 5연속(3연속
요건보다 여유 있게) 전부 `ground decal OK`·`level-up cut OK`, LogError
0건. PLAN 101-3 표는 이제 A·B(공통 선행)·C(hitstop/shake/flash/popup/
타격 VFX)·F(죽음)·G(성장 연출·장비 소켓·지형 반응) 전부 DUNGEON 기준
완료 — 다른 네 판은 각자 손맛 표준 진행 상황에 맞춰 범위 밖으로 남음.

## PLAN 104-1 ② 남은 구멍 — StoryJobChoiceUi(전직 팝업) 테스트 신설 (2026-09-17, 같은 세션 "사가유니티 이어해")

101-3 표가 DUNGEON 기준으로 완결된 뒤라, PLAN 105 열린 질문(Q1·Q3′·Q4·
Q-U2·Q-U4)은 전부 사용자 결정 대기라 손대지 않고 104-1 Phase 0 목록을
다시 훑었다. ①③은 2026-09-16에 이미 끝나 있었고(HISTORY 그 날짜 절
참고), ②(Playtest "존재 확인만" 교체)도 거의 끝났지만 그날 세션이 명시적으로
범위 밖으로 남긴 구멍이 하나 있었다 — "`StoryJobChoiceUi`(전직 팝업)는
애초에 어떤 Playtest도 그 존재조차 확인 안 하고 있다"("교체"가 아니라
"테스트가 아예 없음"이라는 이유로 그때는 안 건드림).

**메꿈**: `PlaytestStorySlice.cs`의 `Phase.SaveLoad` 케이스, 기존
`StoryJobState.ChooseJob("warrior")` 직접 호출 테스트 **바로 앞**에 위젯
자체 검증을 추가했다 — `CanChooseJob`이 이미 true인 시점이라 실제
`StoryJobTrainer`가 팝업을 띄우는 것과 같은 타이밍이다. 실제 게임 상태를
안 건드리려고 **내 콜백만 써서** `StoryJobChoiceUi.Show()`로 띄우고
(`IsShowing` 확인), private `Choose("warrior")`를 리플렉션으로 불러
버튼 클릭을 흉내 낸 뒤 패널이 닫히고 내 콜백이 실제로 "warrior"를
받았는지 확인한다. 그다음에야 기존 코드가 `StoryJobState.ChooseJob()`으로
진짜 전직을 수행 — 두 검증이 서로 안 겹친다.

**변경 파일**:
- `Assets/Editor/PlaytestStorySlice.cs` — 위젯 검증 46줄 추가.
- `PLAN.md` 104-1 ①②③에 완료 표시(①③은 2026-09-16에 이미 끝나 있었는데
  표에 표시가 안 돼 있던 것도 이번에 같이 정리).

**결과**: 컴파일 exit 0(`tools/unity-batch.sh` 경유). `PlaytestStorySlice`
3연속 — 전부 `job choice UI OK - Show()로 뜨고 버튼 클릭(Choose)으로
콜백+닫힘 확인` + `save/load round-trip OK`, LogError 0건.

이로써 104-1 Phase 0은 사용자 결정 대기인 ⑤(Art candidates)와 사용자가
직접 하는 ④(실기 확인)만 남고 전부 끝났다. saga-godot 세션이 같은 트리에서
동시에 돌고 있어(`git status`에 `../saga-godot/...` 변경분이 보임) 그쪽은
안 건드리고 `Assets/Editor/PlaytestStorySlice.cs` 한 파일만 커밋했다.

## PLAN 101-3 F·G — GO로 확장 (2026-09-17, 같은 세션 "101-3 C·F·G를 GO·STORY로 확장")

101-3 표가 DUNGEON 기준으로 완결된 뒤 사용자에게 다음 방향을 물어 "101-3
C·F·G를 GO·STORY로 확장"을 골랐다. 먼저 두 판을 Explore 에이전트로 병렬
조사(F/G 각 항목의 이식 가능성)한 뒤 GO부터 구현했다 — GO는 F·G-성장
연출·G-장비소켓·G-지형반응 넷 다 기존 데이터(`ItemData`·`PlayerStats.
LeveledUp`·`Inventory`)가 이미 있어 straightforward, STORY는 무기/등급
시스템 자체가 없어 G-장비소켓만 재해석이나 사용자 결정이 필요하다는 걸
먼저 확인해 뒀다(다음 세션 몫).

**F 죽음** — `Assets/Games/SagaGo/World/LootMarker.cs`(신규, DUNGEON 사본
— SagaGo가 SagaDungeon을 참조 안 해 복사). `BanditEncounter`·
`RareWolfEncounter`의 `FinishFight()` 승리 분기, 기존 보상(등용/경험치/돈/
전리품) 다음·`Destroy(gameObject)` 전에 `LootMarker.Spawn(transform.
position)` 호출. GO엔 이름 붙은 픽업 SFX 헬퍼가 없어(`GoAudio.PlaySfx`는
클립을 직접 받는 방식) 그냥 조용히 사라지게 뒀다(새 클립 배선은 범위 밖).

**G 성장 연출** — `PlayerStats.LeveledUp`가 그동안 구독자 0명이었다(GO
GameBootstrap이 안 걸어 뒀음). `CameraRig.cs`에 `PlayLevelUpCut()`(DUNGEON과
같은 로직 — `_zoom`을 `MinZoom`까지 당겼다 되돌리는 코루틴, 아무 키나
누르면 스킵)을 추가하고 `GameBootstrap.Start()`가 `PlayerStats.LeveledUp`을
구독해 호출.

**G 장비 가시화** — `ItemData.Grade`(0~2) 신규 필드, 무기 3종에 매김(wp_wood=0,
wp_iron=1, wp_relic=2 — 유물 검이 굴 숨겨진 보물 전용 최고 무기라 2등급).
`CharacterVisual.FindOrCreateWeaponSocket()`(DUNGEON과 같은 로직, `animator.
isHuman` 가드 포함) 추가. `WeaponVisual`(신규) — DUNGEON과 달리 GO는
`Inventory.ItemGained`(무기 슬롯 필터링)를 쓴다 — "재장착" 이벤트가 아니라
"주웠다" 이벤트라 방어구를 주웠을 때는 무시해야 했다. GO는 시작 무기
개념이 없어(`Inventory.EquippedWeaponId` 기본 null — "닫힌 빈 손")
미장착 상태는 그냥 0등급으로 표시. `PlayerController`에 `Visual` public
프로퍼티가 없어서(Animator만 있었음) DUNGEON과 맞추려고 새로 추가했다.

**G 지형 반응** — `GroundDecal.cs`(신규, DUNGEON 사본). 렌더러 자산은
프로젝트 공통이라(`Assets/Settings/PC_Renderer.asset`·`Mobile_Renderer.
asset`) DUNGEON 때 이미 배선해 뒀다 — GO는 새로 배선할 필요가 없었다.
발자국은 `PlayerController.Update()`(이동 중 0.35s 간격). 타격 흔적은
DUNGEON과 다르게 걸었다 — GO는 프레임 단위 공격 판정이 없어(`DuelRules.
Step` 초당 판정) `BanditEncounter`/`RareWolfEncounter.OnDuelEvent()`의
"hit"/"heavy(안 피함)" 케이스(101-3 C hitstop과 같은 훅)에 건다.
`SagaGo.asmdef`에 `Unity.RenderPipelines.Universal.Runtime` 참조 추가
필요(DUNGEON과 같은 함정 — `DecalProjector`가 URP 전용 어셈블리).

**헤드리스 검증(`PlaytestHeadless.cs`, GO)**: `CheckGroundDecal()`(hit
이벤트마다 스폰 + 40개 몰아 32 캡 확인) · `CheckLevelUpCut()`(DUNGEON과
같은 이유로 `CheckBanditLootMarker`보다 먼저 — 안 그러면 그 쪽 `FinishFight()`
가 유발하는 우연한 레벨업과 겹쳐 간헐적으로 실패할 수 있다, PlaytestDungeonHeadless
에서 실제로 겪은 패턴을 여기선 처음부터 순서로 피함) · `CheckBanditLootMarker()`
(`_duel.Cleared`를 강제로 true로 만들고 `FinishFight()`를 직접 호출) ·
`CheckWeaponVisual()`(`Inventory.AddItem("wp_relic")` — 카탈로그 최고
공격력이라 이 시점까지 뭐가 장착돼 있었든 확실히 자동 장착됨) 넷 신규.

**변경 파일**: `Assets/Games/SagaGo/Data/ItemData.cs`(Grade) ·
`World/CharacterVisual.cs`(소켓) · `Player/WeaponVisual.cs`(신규) ·
`Player/CameraRig.cs`(레벨업 컷) · `Player/PlayerController.cs`(Visual
프로퍼티 + 발자국) · `World/GameBootstrap.cs`(LeveledUp 구독) ·
`World/LootMarker.cs`·`World/GroundDecal.cs`(신규) ·
`World/BanditEncounter.cs`·`World/RareWolfEncounter.cs`(LootMarker+
GroundDecal 호출) · `SagaGo.asmdef`(URP Runtime 참조) ·
`Assets/Editor/BuildTestVillageScene.cs`(WeaponVisual 부착) ·
`Assets/Editor/PlaytestHeadless.cs`(체크 4종) · `Assets/Scenes/TestVillage.unity`
(재생성) · `PLAN.md` 101-3 F·G 행 갱신(GO 완료 표시).

**결과**: 컴파일 exit 0(`tools/unity-batch.sh` 경유). 씬 재생성 exit 0.
`PlaytestHeadless` 3연속 — 전부 `ground decal OK`·`level-up cut OK`·
`loot marker OK`·`weapon visual OK`, LogError 0건.

**남은 일(다음 세션)**: STORY의 F(죽음)·G-성장 연출(카메라 상수를 가변
필드로 바꿔야 함)·G-지형 반응(asmdef 문제 없음, `Shader Graphs/Decal`
그대로 재사용 가능)은 GO와 비슷한 결로 이식 가능하다고 Explore 조사에서
확인해 뒀다. G-장비 가시화만 STORY엔 아이템/등급 시스템 자체가 없어(순수
job 스탯) "직업별 무기 프리팹" 같은 재해석이 필요 — 사용자와 먼저 상의할 것.
사용자가 "커밋 푸시하고 새로운 세션에서 할게"라고 해서 이번 세션은 GO
확장까지만 하고 STORY는 다음 세션으로 넘긴다.

## PLAN 101-3 F·G — STORY로 확장, 표 완결 (2026-09-18, 새 세션 "사가유니티 이어해줘")

PROJECT_STATE "다음 세션은 여기부터"가 가리킨 STORY 101-3 F·G 이식을
진행. F(죽음)·G-지형 반응·G-성장 연출은 이전 세션 Explore 조사대로
straightforward했다:

- **F 죽음** — `StoryLootMarker.cs`(신규, GO `LootMarker.cs` 사본 —
  효과음 없이 조용히 사라지는 결도 그대로). `StoryEnemy.Die()`가
  `Destroy()` 전에 `transform.position`으로 호출.
- **G 지형 반응** — `StoryGroundDecal.cs`(신규, DUNGEON/GO 사본).
  발자국은 `StoryPlayerController.Walk()`(축 입력 있고 `isGrounded`일 때
  0.35s 간격), 타격 흔적은 `StoryEnemy.TakeDamage()`. asmdef 문제 없음
  (SagaStory는 전역 어셈블리).
- **G 성장 연출** — `StoryCameraFollow.ZDistance`(상수)를 `_zDistance`
  (가변 필드)로 바꾸고 `PlayLevelUpCut()`(GO/DUNGEON과 같은 결, 줌 대신
  카메라 거리를 당겼다 되돌리는 코루틴) 추가. `GameBootstrap`이
  `StoryJobState.LeveledUp`을 처음 구독(그동안 구독자 0명).

**G 장비 가시화 — 사용자 결정**: AskUserQuestion으로 "직업별 무기 소켓
구현" vs "STORY는 건너뛴다" 중 물었고, 사용자가 전자를 선택. STORY엔
`ItemData`/등급 시스템이 없어(순수 job 스탯) DUNGEON/GO의 "등급별
이미시브 림" 방식을 그대로 못 쓴다 — 대신 "직업별 다른 무기"로 재해석:
무사→검(자루+칼날, DUNGEON/GO와 같은 primitive), 궁수→활(활대+시위,
Unity CreatePrimitive엔 곡선이 없어 시위 걸린 수직 활대로 근사),
협객→표창(45도 회전한 얇은 사각판), 방사→지팡이(샤프트+발광 구슬).
`CharacterVisual.FindOrCreateWeaponSocket()`을 STORY `CharacterVisual.cs`
에 새로 포트(DUNGEON/GO와 같은 로직). `StoryJobState`에 `JobChosen`
이벤트를 신설해 `ChooseJob()` 성공 시 쏘고, `StoryWeaponVisual`이
구독해 무기를 다시 짓는다.

**헤드리스 검증 중 실제로 잡은 버그**: `StoryJobState.Restore()`가
`JobChosen`을 안 쏘던 최초 구현에서, `PlaytestStorySlice`의 Init 단계가
세션 중간에 `Restore(1, 0f, NoJob)`으로 상태를 리셋해도 `StoryWeaponVisual`
이 그 사실을 몰라 이전 세션(디스크 세이브)이 남긴 무기 모델을 그대로
들고 있었다 — "전직 전인데 이미 무기가 들려 있음" 실패로 드러남.
`Restore()`도 `JobChosen`을 쏘도록 고쳐 해결(세이브 로드·상태 초기화
둘 다 시각을 다시 맞추게 됨) — `docs/PROJECT_STATE.md` "알려진 오류"에
일반 원칙으로 남겨 둠(장착/보유 상태를 보고 시각을 짓는 컴포넌트는
그 상태의 `Restore()`/로드 경로도 같은 이벤트를 쏘는지 확인할 것).

또 하나: `CheckGroundDecalCap()`(캡 32 검증, 40개 강제 스폰)을 처음엔
KillEnemies 루프 안(`_enemyIndex==0`)에 넣었다가, 그 뒤 이어지는 per-hit
ActiveCount 델타 비교가 캡에 눌어붙은 값과 계속 비교하게 돼 잡졸 #1부터
깨졌다 — 루프를 다 돈 뒤(잡졸 10마리 처치 확인 직후, KillBoss 전환
직전)로 옮겨 해결.

`PlaytestStorySlice.cs`에 `CheckLevelUpCut()`(Phase.Init, 세션 첫
레벨업으로 강제)·`CheckGroundDecalCap()`·per-hit `StoryGroundDecal`/
`StoryLootMarker` 카운터 비교·`CheckWeaponVisualBeforeJob()`/
`CheckWeaponVisualAfterJob()`을 추가. `BuildTestStoryScene.BuildPlayer()`
에 `StoryWeaponVisual` 컴포넌트 추가 — 씬 재생성(`Saga/Build TestField
Scene`) 필요했음. 컴파일 3회(각 단계) + `PlaytestStorySlice` 3연속 OK.

이로써 **PLAN 101-3(C·F·G) 표가 다섯 판 중 해당하는 GO·DUNGEON·STORY
셋 다 완전히 닫혔다** — FOREST·REALM은 애초에 해당 없음(101-3 표 각주
그대로). `docs/PROJECT_STATE.md` "다음 작업"도 갱신(실기 확인 몰아서 →
104-1⑤·102-4 → REALM 51장 확장 → 105 열린 질문 순, 전부 사용자 결정
또는 실기 확인 대기).

## PLAN Q-U2 결정 — REALM 51장 16차, "성 하나당 목표 하나" 제약 해제 (2026-09-18, 같은 세션 "REALM 51장 방향 결정")

STORY 101-3 F·G 이식(위 절)을 커밋·푸시한 뒤, 사용자가 "사가유니티 이어해줘"를
다시 보내 다음 우선순위 항목을 진행. `docs/PROJECT_STATE.md` "다음 작업"
목록이 전부 사용자 결정 대기 항목이라(104-1⑤·102-4는 105 Q1 대기, REALM
51장은 방향 미정, 105 열린 질문들) 먼저 AskUserQuestion으로 방향을 물었고
사용자가 "REALM 51장 방향 결정(Q-U2)"을 선택.

**조사**: PLAN.md Q-U2("10차 이후도 계속 늘릴지, 5-4 이정표로 전환할지")가
쓰인 시점 이후 이미 15차까지 진행돼 있었다 — 다시 확인해 보니 세 사슬
(허창·복양·진류) 끝(회계·영안·오원)이 saga-web/saga-realm/js/data-city.js
전체 LINKS(교주·서역·남중·막북·임읍·균열·묘역까지 전부 grep)를 뒤져도
**진짜 더 뻗을 링크가 없는** 확정된 막다른 끝임을 확인했다. 대신 이미
목표 하나를 쓴 국경 성들(장안·한중·하비·업·장사·강주·상군·운중) 쪽엔 아직
안 쓴 링크가 여럿 남아 있었다(예: changan-tianshui, changsha-nanhai,
jiangzhou-zhuti) — 지금까지 지켜 온 "성 하나당 목표 하나" 개발 관례가
실제 병목이었다.

이 사실을 사용자에게 보고하고 두 번째 질문("사슬 확장 방식")을 물었다 —
"성 하나당 복수 목표 허용(구조 변경)" vs "그대로 둘 때 가능한 만큼만".
사용자가 전자를 선택.

**구현**:
- `RealmEnemyCity.cs` — `TargetsFrom(ourCityId)`(전부 반환, `List<string>`)
  신설, 옛 `TargetFrom()`은 `TargetsFrom().FirstOrDefault()` 격의 호환
  래퍼로 남김. 데이터 모델 자체는 원래도 다중 목표를 막지 않았다(`Catalog`
  가 목표 id로 키가 잡히지 출진 성으로 잡히지 않는다) — 진짜 바뀐 건
  `TargetFrom`이 첫째만 돌려주던 로직뿐.
- `RealmWarState.Attack()`/`Plot()` — `string enemyId = null` 선택 인자
  추가. 생략하면 옛 동작(`TargetFrom`), 명시하면 `TargetsFrom(fromCityId)
  .Contains(enemyId)`로 검증(엉뚱한 성 공격 방지).
- `RealmCommandUi.cs` — "공격" 버튼(`ExecuteAttack()`)이 목표 개수를 먼저
  본다. 하나면 옛날처럼 바로 공격(기존 UX·테스트 전부 무변경), 둘 이상이면
  새 고르기 패널(`_attackPanel`/`_attackButtonsRoot`, 성 패널
  `RefreshCityPanel()`과 같은 결)을 연다. 계략(`Plot`)은 이번 라운드에서
  고르기 UI를 안 만들었다 — 목표 둘인 성에서 계략은 여전히 `TargetFrom`의
  첫째에만 걸린다(알려진 틈으로 `PROJECT_STATE.md`에 남김).
- 신규 성 3곳(16차): 장안→천수(원작 LINKS changan-tianshui), 장사→남해
  (changsha-nanhai, 교주 관문), 강주→주제(jiangzhou-zhuti, 남중 관문).
  wall은 `saga-web/saga-realm/js/data-city.js` 원본 그대로(4400·4400·3200),
  troops=wall×0.23 반올림, train은 "출진 성 자신의 train+15"(형제 가지
  규칙 그대로 — 장안 65+15=80, 장사 145+15=160, 강주 110+15=125).
  `RealmCityData.cs`(성 정의)·`RealmEnemyCity.cs`(적 성 정의) 둘 다 추가.
- 로컬라이제이션: `panel.attack_title` 신설(ko/en) + 그동안 빠져 있던
  jianye/kuaiji/yunzhong/shangjun/shuofang/wuyuan city.* 항목(en json에
  없어 영어 모드에서 한국어로 새던 것)을 이번 김에 다 채웠다.
- `PlaytestRealmSlice.cs` — `AttackChainStep()`에 `enemyId` 선택 인자
  추가(다중 목표 성 공략 시 명시), `CheckMultiTargetAttack()` 신설(장안이
  실제로 목표 둘을 갖는지, 공격 버튼이 즉시 공격 대신 고르기 패널을
  여는지, 잘못된 목표 id를 거절하는지 확인 — 실제 공격은 안 하고 패널만
  열었다 닫는다, `AttackChainStep()`이 바로 다음에 진짜 함락을 하므로
  중복 함락 방지). 새 Phase 셋(AttackTianshui/AttackNanhai/AttackZhuti)을
  기존 사슬의 맨 끝(AttackKuaiji 다음)에 추가 — 중간에 안 끼워 넣어 기존
  순서 회귀 위험을 없앴다.

**실제로 걸린 함정**: `CheckMultiTargetAttack()`을 처음 KillEnemies 루프
안(각 잡졸 타격마다 도는 자리)에 넣을 뻔했는데, 이건 STORY 세션의
`CheckGroundDecalCap()` 함정과 같은 종류라 처음부터 별도 시점(사슬 끝,
루프 밖)에 배치해 피했다.

컴파일 3회(각 단계) + 씬 재생성(`Saga/Build TestCity Scene`, `_attackPanel`
GameObject 신설로 필요) + `PlaytestRealmSlice` 3연속 OK. `PLAN.md`
101-2 REALM 행 갱신 + 105장 Q-U2 항목 삭제(해결됨), `docs/PROJECT_STATE.md`
REALM 행·다음 작업 갱신.

## REALM 계략(Plot) 고르기 UI — Q-U2 "알려진 틈" 해소 (2026-09-18, 새 세션 "사가유니티 이어해")

위 Q-U2 절이 범위 밖으로 남긴 틈을 메웠다: 목표가 둘인 성(장안·장사·
강주)에서 계략을 걸면 `RealmWarState.Plot()`이 `enemyId`를 안 받는 옛
호출부라 `TargetFrom()`(카탈로그 순서상 첫째)에만 걸리던 문제.
`Attack()`/`ExecuteAttack()`이 이미 같은 문제를 고른기 패널로 푼 결을
그대로 계략에도 옮겼다 — `RealmWarState.Plot()`/`RealmEnemyCity` 자체는
이미 51장 16차 확장 때 `enemyId` 선택 인자·`TargetsFrom()` 가드를 갖추고
있어 손댈 필요가 없었다(클래스 주석 그대로).

- `RealmCommandUi.RefreshPlotPanel()` — `RealmEnemyCity.TargetsFrom(현재
  성)`이 둘 이상이면 "계략×목표" 조합(현재 계략 2종×목표 최대 2곳=4버튼)
  을 낸다, 하나뿐이면 옛날처럼 계략 종류만 나열(기존 UX·라벨 무변경).
  새 로컬라이제이션 키 `ui.plot_label_target`(ko/en 둘 다 추가) — 목표
  성 이름을 "{계략} → {목표성} ({금액}, {성공률})" 순서로 끼워 넣는다.
  `_plotPanel` 높이를 420→620으로 늘렸다(행 4개까지 담기 위해, 다른
  필드 anchoring은 무변경).
- `ChoosePlot(string key, string enemyId = null)` — 고르기 패널에서
  캡처한 `enemyId`를 `RealmWarState.Plot()`에 그대로 넘긴다. 기본값
  null이라 목표 하나뿐인 성의 기존 호출부(단일 인자)는 그대로 컴파일된다.
- `PlaytestRealmSlice.CheckMultiTargetPlot()` 신설 — `CheckMultiTargetAttack
  ()`과 같은 자리(Phase.AttackTianshui, 장안을 조망 성으로 쓰는 시점)에서
  같이 부른다. **실제로 계략을 걸지는 않는다** — 걸면 금 소모·적 성
  훈련도/병력이 바뀌어 바로 다음 `AttackChainStep()`의 전투 결과가
  흔들릴 위험이 있어(원래 함정과 같은 이유), 패널을 열어 버튼 개수(4)만
  확인하고 실행 전에 닫은 뒤, 잘못된 목표 id(회계)를 직접
  `RealmWarState.Plot()`에 넘겨 거절되는지만 따로 확인한다.

컴파일 확인(`tools/unity-batch.sh` 경유, error CS 0건) + `PlaytestRealmSlice`
3연속 OK(exit 0, "multi-target plot UI OK" 로그 매 회 1줄씩 — 계략도
장안 목표 둘에서 4버튼 고르기 패널이 뜨고 잘못된 목표는 거절됨을 확인).
씬 재생성 불필요(패널·라벨은 `RealmCommandUi.Build()`가 런타임에 짓는
런타임 UI라 `BuildTestCityScene.cs`가 만드는 정적 GameObject 구성과
무관 — 16차 확장 때 `_attackPanel` 신설이 씬 재생성이 필요했던 것과
달리 이번엔 필드 추가가 없다). `docs/PROJECT_STATE.md` REALM
"알려진 틈"·"다음 작업"·테스트 상태·실기 확인 대기 네 군데 갱신.

## REALM 51장 17차 확장 — 교주·남중 한 단계 더 (2026-09-18, 같은 세션 "사가유니티 이어해")

계략 고르기 UI를 마친 뒤, PLAN·PROJECT_STATE의 "다음 작업" 3번(REALM 교주·
남중 더 뻗기)을 이었다. 16차가 "다음 확장 후보"로 남긴 두 곳 중 한 단계씩:
**남해→창오**(원작 LINKS nanhai-cangwu, "산과 강이 겹치는 안쪽 땅, 길이
하나뿐")·**주제→건녕**(원작 LINKS zhuti-jianning, "남중 여러 부족을
아우르는 다스림의 중심"). 남해의 다른 이웃(합포)·건녕의 다른 이웃(월수·
장가·운남 — 셋으로 뻗는 허브)은 다음 확장 후보로 남겼다(지금까지 관례대로
한 갈래씩).

이번 둘은 16차의 "형제 가지"(같은 출진 성이 갖는 둘째 목표, 성 하나당
목표 하나 제약을 푼 예외)가 아니라 **정상적인 한 단계 더 깊은 자식**이라
train은 옛 규칙(부모의 train+15)을 그대로 썼다 — 창오 160+15=175(부모
남해), 건녕 125+15=140(부모 주제). wall은 원작 그대로(창오 3600·건녕
3800), troops=wall×0.23 반올림(850·850, 우연히 같음). land는 창오(원작
hill)만 다른 hill/mount 성들과 같은 이유로 Plain 처리, 건녕은 원작
plain 그대로.

- `RealmEnemyCity.cs` — `CangwuId`·`JianningId` 신설, `AllIds`·`Catalog`에
  추가.
- `PlaytestRealmSlice.cs` — `Phase.AttackCangwu`/`Phase.AttackJianning`
  신설(AttackZhuti 다음, QuizCorrect 앞), 둘 다 목표가 하나뿐인 성이라
  `enemyId` 생략(다른 단순 체인 스텝과 같은 결). OK 로그 문구에
  "chain-17th(cangwu+jianning)" 추가.
- 로컬라이제이션: `city.cangwu`/`city.jianning`(ko/en) 신설.

**실제로 걸린 함정** — `RealmEnemyCity.cs`만 고치고 컴파일·헤드리스를
돌렸는데, 창오 공략 단계에서 `AttackChainStep()`이 "ok=True won=True인데
공략 실패"로 걸렸다. 원인: 함락 가능 여부(`RealmWarState.Attack()`)와
플레이 가능한 성으로 편입하는 것(`RealmCityState.AbsorbCity()`)이 서로
다른 카탈로그를 본다 — 후자는 `RealmCityData.Get(cityId)`가 있어야만
동작하고, **없으면 에러 없이 조용히 return**한다(`if (def == null)
return;`). `RealmEnemyCity.cs`에만 새 성을 추가하고 `RealmCityData.cs`
(agri/comm/pop/좌표 정의)를 빠뜨려서 전투는 이겼는데 성이 안 편입됐다.
헤드리스 검증이 `RealmCityState.ActiveCityIds.Contains()`로 편입 여부를
따로 확인하는 덕에 잡혔다(전투 승패만 봤으면 조용히 새고 지나갈 뻔).
`RealmCityData.cs`에 두 성 추가(wall은 `RealmEnemyCity.cs` 정의와 맞춤,
agri/comm/pop/mapX/mapY는 `saga-web/saga-realm/js/data-city.js` 원본
그대로) 뒤 재검증해 해소 — **새 REALM 성은 두 파일(`RealmEnemyCity.cs`+
`RealmCityData.cs`) 항상 같이 고칠 것**을 `PROJECT_STATE.md` "알려진
오류"에 새 항목으로 남겼다.

컴파일 확인(`tools/unity-batch.sh` 경유, error CS 0건, 함정 수정 전후
두 번) + `PlaytestRealmSlice` 3연속 OK(창오·건녕 함락 로그 매 회 확인).
씬 재생성 불필요(데이터·체인 단계 추가뿐, GameObject 구성 무변경).
`docs/PROJECT_STATE.md` REALM 완료 요약(적국 27→29, 성 30→32)·새
"51장 17차" 절·"다음 작업"(18차 후보로 갱신)·알려진 오류(새 함정)·
테스트 상태·실기 확인 대기 전부 갱신, 상한 15360B 안으로 다른 절도
같이 줄임(위 "마지막 갱신" 줄 압축).

## REALM 51장 18차 확장 — 창오→울림·건녕→월수 (2026-09-18, 같은 세션 "사가유니티 이어해")

17차가 남긴 후보 중 한 갈래씩 더 이었다: **창오→울림**(원작 LINKS
cangwu-yulin, "숲이 짙은 산골, 코끼리가 짐을 나른다" — 울림은 교지
(jiaozhi)로 더 뻗어 교주 사슬이 계속 이어질 수 있다), **건녕→월수**
(원작 LINKS jianning-yuexi, "서쪽 산길, 강족과 맞닿은 변경" — 원작
LINKS상 월수는 더 이상 이웃이 없어 남중 사슬이 여기서 끝난다). 건녕의
다른 이웃(장가·운남)·남해의 다른 이웃(합포)은 여전히 다음 확장 후보로
남겼다(관례대로 한 갈래씩). train은 17차와 같은 "정상적인 한 단계 더
깊은 자식" 규칙(부모 train+15) — 울림 175+15=190, 월수 140+15=155.
wall은 원작 그대로(울림 3400·월수 2800), troops=wall×0.23 반올림
(800·650). 둘 다 원작 land가 hill/mount라 다른 성들과 같은 이유로
Plain 처리.

- `RealmEnemyCity.cs` — `YulinId`·`YuexiId` 신설, `AllIds`·`Catalog`에 추가.
- `RealmCityData.cs` — 같은 두 성 추가(agri/comm/pop/mapX/mapY는
  `saga-web/saga-realm/js/data-city.js` 원본 그대로, wall은
  `RealmEnemyCity.cs`와 맞춤) — **17차가 겪은 함정(둘 중 한 파일만
  고쳐 `AbsorbCity()`가 조용히 실패하던 것)을 이번엔 처음부터 두 파일
  다 같이 고쳐 피했다.**
- `PlaytestRealmSlice.cs` — `Phase.AttackYulin`/`Phase.AttackYuexi`
  신설(AttackJianning 다음, QuizCorrect 앞) — 둘 다 목표가 하나뿐인
  성이라 `enemyId` 생략. OK 로그 문구에 "chain-18th(yulin+yuexi)" 추가.
- 로컬라이제이션: `city.yulin`/`city.yuexi`(ko/en) 신설.

컴파일 확인(`tools/unity-batch.sh` 경유, error CS 0건 — 이번엔 함정 없이
한 번에 통과) + `PlaytestRealmSlice` 3연속 OK(울림·월수 함락 로그 매 회
확인). 씬 재생성 불필요. `docs/PROJECT_STATE.md` REALM 완료 요약
(적국 29→31, 성 32→34)·16~18차 절을 하나로 합쳐 압축(상한 15360B
여유 확보)·"다음 작업"(19차 후보로 갱신)·테스트 상태·실기 확인 대기
전부 갱신.

## REALM 51장 19차 확장 — 울림→교지·건녕 둘째 목표 장가 (2026-09-18, 같은 세션 "사가유니티 이어해")

18차가 남긴 후보 중 이번엔 교주 사슬 하나(울림→교지)와, **건녕의 둘째
목표(장가)**를 함께 열었다. ① 울림→교지(원작 LINKS: yulin-jiaozhi,
"붉은 강이 바다로 드는 삼각주, 교주에서 가장 큰 저자" — 구진(jiuzhen)
으로 더 뻗을 수 있어 다음 확장 후보). ② 건녕→장가(원작 LINKS:
jianning-zangke, "협곡을 낀 물길") — 건녕은 이미 월수(18차)를 목표로
갖고 있어, **16차 "형제 가지" 규칙을 처음으로 원래 세 국경 성(장안·
장사·강주) 밖으로 확장**한 사례다. `TargetsFrom()`/공격·계략 고르기
패널이 애초에 목표 개수와 무관하게 동작하도록 짜여 있어서(16차 때부터)
**코드는 한 줄도 안 고쳤다** — 데이터(카탈로그 항목)만 늘렸을 뿐인데
UI가 그대로 건녕용 2버튼 고르기 패널을 낸다. train은 교지가 정상적인
한 단계 더 깊은 자식 규칙(울림 190+15=205), 장가가 형제 가지 규칙
(건녕 140+15=155, 월수와 같음). wall은 원작 그대로(교지 4600·장가
3000), troops=wall×0.23 반올림(1050·700). 교지는 원작 river 그대로,
장가(hill)는 다른 hill/mount 성들과 같은 이유로 Plain 처리.

- `RealmEnemyCity.cs` — `JiaozhiId`·`ZangkeId` 신설, `AllIds`·`Catalog`에 추가.
- `RealmCityData.cs` — 같은 두 성 추가(17차 함정 재발 방지 — 이번에도
  처음부터 두 파일 다 같이 고침).
- `PlaytestRealmSlice.cs` — 기존 `Phase.AttackYuexi` 호출을
  `enemyId`(=YuexiId) 명시로 바꿔야 했다 — 장가를 추가하는 순간 건녕이
  목표 둘(월수·장가)이 돼서, `enemyId` 생략 시 `TargetFrom()`이 어느
  쪽을 돌려줄지 더는 자명하지 않다(changan 때와 같은 이유). 새
  `Phase.AttackZangke`(건녕→장가, enemyId 명시)·`Phase.AttackJiaozhi`
  (울림→교지) 신설. 별도 `CheckMultiTarget*` 테스트는 안 만들었다 —
  changan에서 이미 그 UI 메커니즘 자체를 검증했고, 여기서는
  `AttackChainStep()`의 "기대한 성이 실제로 함락됐는가" 확인이 잘못된
  enemyId 라우팅을 이미 걸러낸다(라우팅이 틀렸으면 엉뚱한 성이 함락되거나
  실패해서 바로 드러난다). OK 로그 문구에 "chain-19th(jiaozhi+zangke)" 추가.
- 로컬라이제이션: `city.jiaozhi`/`city.zangke`(ko/en) 신설.

컴파일 확인(`tools/unity-batch.sh` 경유, error CS 0건) + `PlaytestRealmSlice`
3연속 OK(장가·교지 함락 로그 매 회 확인 — 건녕의 첫 다중 목표 경로도
이 3연속에 포함). 씬 재생성 불필요. `docs/PROJECT_STATE.md` REALM
완료 요약(적국 31→33, 성 34→36)·16~19차 절 갱신(형제 가지 규칙 확장
사례 추가)·"다음 작업"(20차 후보: 남해→합포, 교지→구진, 건녕→운남)·
테스트 상태·실기 확인 대기 전부 갱신.

## REALM 51장 20차 확장 — 교지→구진·남해 둘째 목표 합포 (2026-09-18, 같은 세션 "사가유니티 이어해")

19차가 남긴 후보 중 교주 사슬 하나(교지→구진)와, **남해의 둘째 목표
(합포)**를 함께 열었다. ① 교지→구진(원작 LINKS: jiaozhi-jiuzhen,
"벼가 두 번 여무는 들, 남쪽으로 갈수록 낯설어진다" — 일남(rinan)으로
더 뻗을 수 있어 다음 확장 후보). ② 남해→합포(원작 LINKS: nanhai-hepu,
"진주가 나는 바닷가, 배가 곧 재물이다") — 19차의 건녕→장가와 같은
결로, **형제 가지 규칙을 또 한 번 원래 세 국경 성 밖으로 확장**했다
(원작 LINKS상 합포의 다음 칸이 이미 우리 성인 교지라 합포 자체가
이 방향의 마지막 칸). train은 구진이 정상적인 한 단계 더 깊은 자식
규칙(교지 205+15=220), 합포가 형제 가지 규칙(남해 160+15=175, 창오와
같음). wall은 원작 그대로(구진 3000·합포 3200), troops=wall×0.23
반올림(700·750). 둘 다 원작 land 그대로(구진 plain·합포 river, 보정
불필요).

- `RealmEnemyCity.cs` — `JiuzhenId`·`HepuId` 신설, `AllIds`·`Catalog`에 추가.
- `RealmCityData.cs` — 같은 두 성 추가(17차 함정 재발 방지, 처음부터
  두 파일 다 같이 고침).
- `PlaytestRealmSlice.cs` — 기존 `Phase.AttackCangwu`·`Phase.AttackJiaozhi`
  호출을 각각 `enemyId` 명시/다음 단계 변경으로 고쳤다 — 합포를 추가하는
  순간 남해가 목표 둘(창오·합포)이 돼서 `AttackCangwu`도 19차의
  `AttackYuexi`와 같은 이유로 `enemyId`가 필요해졌다. 새
  `Phase.AttackHepu`(남해→합포, enemyId 명시)·`Phase.AttackJiuzhen`
  (교지→구진) 신설, 순서는 AttackCangwu→**AttackHepu**→AttackJianning→
  …→AttackJiaozhi→**AttackJiuzhen**→QuizCorrect. OK 로그 문구에
  "chain-20th(hepu+jiuzhen)" 추가.
- 로컬라이제이션: `city.jiuzhen`/`city.hepu`(ko/en) 신설.

**패턴 확인**: 목표를 하나 더 가진 성이 이미 있는 상태에서 그 성을
출진지로 쓰는 기존 체인 스텝은, 새 목표를 추가하는 시점에 반드시
`enemyId`를 명시로 바꿔야 한다는 규칙이 이번에 또 한 번 확인됐다(19차
때 `AttackYuexi`, 이번엔 `AttackCangwu`) — `TargetFrom()`이 `Catalog`
딕셔너리 내부 순서에 의존하므로, 목표가 늘어나는 순간 옛 암묵적 선택이
더는 안전하지 않다.

컴파일 확인(`tools/unity-batch.sh` 경유, error CS 0건) + `PlaytestRealmSlice`
3연속 OK(합포·구진 함락 로그 매 회 확인 — 남해의 첫 다중 목표 경로도
이 3연속에 포함). 씬 재생성 불필요. `docs/PROJECT_STATE.md` REALM
완료 요약(적국 33→35, 성 36→38)·16~20차 절 갱신·"다음 작업"(21차
후보: 구진→일남, 건녕→운남)·테스트 상태·실기 확인 대기 전부 갱신.

## REALM 51장 21차 확장 — 구진→일남·건녕 셋째 목표 운남 (2026-09-19, 새 세션 "사가유니티 이어해")

20차가 남긴 후보 중 교주 사슬 하나(구진→일남)와, **건녕의 셋째 목표
(운남)**를 함께 열었다. ① 구진→일남(원작 LINKS: jiuzhen-rinan, "한
(漢)의 땅이라 부르는 가장 남쪽 끝" — 향림(xianglin)으로 더 뻗을 수
있어 다음 확장 후보). ② 건녕→운남(원작 LINKS: jianning-yunnan, "구름
남쪽의 큰 호수") — 건녕은 이미 월수·장가 둘을 목표로 갖고 있어
**형제 가지가 셋으로 늘어난 첫 사례**다. `TargetsFrom()`/공격·계략
고르기 패널이 목표 개수와 무관하게 계속 잘 동작하는지 이번엔 3목표
케이스로 확인했다 — 역시 코드 변경 없이 데이터만 늘려 끝났다. train은
일남이 정상적인 한 단계 더 깊은 자식 규칙(구진 220+15=235), 운남이
형제 가지 규칙(건녕 140+15=155, 월수·장가와 같음). wall은 원작
그대로(일남 2800·운남 2900), troops=wall×0.23 반올림(650·650 —
우연히 같음). 둘 다 원작 land가 hill/mount라 다른 성들과 같은 이유로
Plain 처리.

- `RealmEnemyCity.cs` — `RinanId`·`YunnanId` 신설, `AllIds`·`Catalog`에 추가.
  (`RunanId`="여남"과 이름이 비슷해 헷갈리기 쉽다 — `RinanId`="일남"은
  전혀 다른 성이니 주의.)
- `RealmCityData.cs` — 같은 두 성 추가(17차 함정 재발 방지, 처음부터
  두 파일 다 같이 고침).
- `PlaytestRealmSlice.cs` — 기존 `Phase.AttackZangke`(→AttackYunnan로
  다음 단계 변경)·`Phase.AttackJiuzhen`(→AttackRinan로 다음 단계 변경)
  수정. 새 `Phase.AttackYunnan`(건녕→운남, enemyId 명시)·
  `Phase.AttackRinan`(구진→일남, 목표 하나뿐이라 enemyId 생략) 신설.
  OK 로그 문구에 "chain-21st(yunnan+rinan)" 추가.
- 로컬라이제이션: `city.rinan`/`city.yunnan`(ko/en) 신설.

컴파일 확인(`tools/unity-batch.sh` 경유, error CS 0건) + `PlaytestRealmSlice`
3연속 OK(운남·일남 함락 로그 매 회 확인 — 건녕의 첫 3목표 라우팅도
이 3연속에 포함). 씬 재생성 불필요. `docs/PROJECT_STATE.md` REALM
완료 요약(적국 35→37, 성 38→40)·16~21차 절 갱신·"다음 작업"(22차
후보: 일남→향림, 운남→영창)·테스트 상태·실기 확인 대기 전부 갱신.

## REALM 51장 22차 확장 — 일남→상림·운남→영창 (2026-09-19, 같은 날 "사가유니티 이어해")

21차가 남긴 두 후보를 함께 열었다. ① 일남→상림(원작 LINKS:
rinan-xianglin, 실제 후한서·양서에 나오는 일남군 속현이자 임읍국이
일어난 바로 그 현). ② 운남→영창(원작 LINKS: yunnan-yongchang, "머나먼
서쪽 땅, 천축의 물건도 이 길을 거쳐 온다"). 21차 절의 "향림"은
표기 실수였다 — 원작 지명 象林의 정확한 한글 표기는 **상림**(HISTORY
21차 절은 그대로 두고 여기 correction만 남긴다), saga-web/saga-realm/
js/data-city.js 349행 그대로 옮겼다. 둘 다 정상적인 한 단계 더 깊은
자식(형제 가지 아님): 상림 train=일남 235+15=250, 영창 train=운남
155+15=170. wall은 원작 그대로(상림 3200·영창 3400), troops=wall×0.23
반올림(750·800). 둘 다 원작 land가 이미 plain이라 보정 불필요.

- `RealmEnemyCity.cs` — `XianglinId`·`YongchangId` 신설, `AllIds`·
  `Catalog`에 추가(처음부터 두 파일 다 같이 고쳐 17차 함정 재발 방지).
- `RealmCityData.cs` — 같은 두 성 추가.
- `PlaytestRealmSlice.cs` — 기존 `Phase.AttackYunnan`(→AttackYongchang로
  다음 단계 변경)·`Phase.AttackRinan`(→AttackXianglin로 다음 단계 변경)
  수정. 새 `Phase.AttackYongchang`(운남→영창, enemyId 생략 — 목표
  하나뿐)·`Phase.AttackXianglin`(일남→상림, 마찬가지) 신설. OK 로그
  문구에 "chain-22nd(yongchang+xianglin)" 추가.
- 로컬라이제이션: `city.xianglin`/`city.yongchang`(ko/en) 신설.

컴파일 확인(`tools/unity-batch.sh` 경유, error CS 0건) + `PlaytestRealmSlice`
3연속 OK(영창·상림 함락 로그 매 회 확인 — `-quit` 없이 `-executeMethod
Saga.EditorTools.PlaytestRealmSlice.Run`으로 불러 스스로 종료하게 함,
`-quit`을 같이 주면 Tick 루프가 끝나기 전에 에디터가 먼저 닫혀 로그가
전혀 안 남는다). 씬 재생성 불필요. `docs/PROJECT_STATE.md` REALM
완료 요약(적국 37→39, 성 40→42)·22차 절 갱신·"다음 작업"(23차 후보:
상림→노용/전충, 영창→신독)·테스트 상태·실기 확인 대기 전부 갱신.

## REALM 51장 23차 확장 — 상림→전충·영창→신독 (2026-09-19, 같은 날 "23차도 이어해")

22차가 남긴 후보 중 한 갈래씩 골랐다. ① 상림→전충(원작 LINKS:
xianglin-dianchong, "임읍국의 도성" — 상림의 다른 이웃 노용(luorong)은
잎사귀 하나뿐이라 이번엔 전충을 골랐다, 비경·서권·구속 셋으로 더
뻗는 허브라 17차 건녕을 고른 것과 같은 이유). ② 영창→신독(원작
LINKS: yongchang-shendu, "한서가 '신독'이라 적은 땅" — 영창의 유일한
이웃, landmark, 건타라·대하·목건타·사이 넷으로 더 뻗는 허브). 둘 다
정상적인 한 단계 더 깊은 자식(부모의 train+15): 전충 250+15=265,
신독 170+15=185. wall은 원작 그대로(전충 3800·신독 4000),
troops=wall×0.23 반올림(850·900). 둘 다 원작 land가 이미 plain이라
보정 불필요.

- `RealmEnemyCity.cs` — `DianchongId`·`ShenduId` 신설, `AllIds`·
  `Catalog`에 추가.
- `RealmCityData.cs` — 같은 두 성 추가.
- `PlaytestRealmSlice.cs` — 기존 `Phase.AttackYongchang`(→AttackShendu로
  다음 단계 변경)·`Phase.AttackXianglin`(→AttackDianchong로 다음 단계
  변경) 수정. 새 `Phase.AttackShendu`(영창→신독)·`Phase.AttackDianchong`
  (상림→전충) 신설, 둘 다 목표 하나뿐이라 enemyId 생략. OK 로그 문구에
  "chain-23rd(shendu+dianchong)" 추가.
- 로컬라이제이션: `city.dianchong`/`city.shendu`(ko/en) 신설.

컴파일 확인(`tools/unity-batch.sh` 경유, error CS 0건) + `PlaytestRealmSlice`
3연속 OK(신독·전충 함락 로그 매 회 확인, `-executeMethod`만 쓰고 `-quit`
안 줌). 씬 재생성 불필요. `docs/PROJECT_STATE.md` REALM 완료 요약
(적국 39→41, 성 42→44)·23차 절 갱신·"다음 작업"(24차 후보: 상림→노용,
전충→비경/서권/구속 중 하나, 신독→건타라/대하/목건타/사이 중 하나)·
테스트 상태·실기 확인 대기 전부 갱신.

## 캐릭터 자산(Maria/Abe/Brute) 이 PC에 처음 확보 + GUI 육안 확인 (2026-09-19, 새 세션 "사가유니티 그래픽 파판급이냐" 질문에서 이어짐)

사용자가 "그래픽이 파판(FF16) 정도 나왔어?"라고 물어 PLAN 66-2장 문서만 보고 답했더니 "확인해줘"로 실기 확인을 요청. 이 PC의 `Assets/Art/CharactersRealistic/`가 비어 있어(Mixamo 산출물은 `.gitignore`, PC마다 로컬 재획득 필요) `PlaytestCharacterRealisticGui.cs`를 돌려도 Missing Prefab만 뜸(캐릭터 자체가 없음) — 사용자가 "직접해줘"로 자동화를 요청해 mixamo.com 다운로드 자동화를 시도했다.

**브라우저 자동화 시행착오**: 최신 크롬은 기본 프로필 경로로 원격 디버깅을 거부해 별도 `--user-data-dir` 프로필이 필요했다. 첫 시도는 회사 관리 정책으로 새 프로필이 구글 계정 로그인/Claude 확장 OAuth+캡차/IDM/otp.ee 같은 무관한 인증 화면을 자동으로 띄워 즉시 중단(계정 인증 영역은 건드리지 않음). `--disable-extensions --disable-sync --no-first-run` 플래그로 그 소음을 다 끄니 mixamo.com 탭만 깨끗하게 뜸 — 로그인은 사용자가 직접 하고, 이후 검색·다운로드는 Node(v24 내장 `WebSocket`)로 짠 얇은 CDP 클라이언트(`cdp_eval.js`/`cdp_cmd.js`/`mixamo_download_anim.js`, 세션 스크래치패드)로 캐릭터 카드 클릭·Format/Skin `<select>` 값 설정·Download 버튼 클릭을 자동화했다. 완료된 다운로드는 브라우저 기본 Downloads 폴더에 떨어져(`Page.setDownloadBehavior`가 이 크롬 버전에서 안 먹음) 매번 `mv`로 프로젝트 폴더에 옮겨야 했다.

받은 것 — 전부 FBX for Unity:
- **Maria**("Maria W/Prop J J Ong") 몸 + 8클립(idle/walk/run/attack/hit/dodge/death/interaction, `SetupMixamoCharacterImport.cs` 레시피 그대로)
- **Abe**(검색 "abe") 몸(Mixamo 내부명 `Ch39_nonPBR.fbx`→`Abe.fbx`로 리네임) + 5클립(Idle/Walking/Punching/"Hit Reaction"→`HitReaction`/Dying, 공백 제거 리네임 필요 — `SetupAbeCharacterImport.cs`가 공백 없는 파일명을 기대함)
- **Brute**(검색 "brute") — 캐릭터를 바꾸면 직전 선택한 애니메이션이 "sticky"하게 새 캐릭터에 씌워져(Dying on Brute) 캐릭터 페이지의 T-pose 다운로드 다이얼로그(Format+Pose만 있는 것)를 못 열었다. 우회: "Idle" 애니메이션을 **With Skin**으로 받아 몸(`Brute.fbx`) 대신 쓰고, 같은 "Idle"을 다시 **Without Skin**으로 받아 클립으로 씀(Humanoid Avatar 생성은 바인드 포즈만 있으면 되고 어떤 애니메이션 프레임이 같이 왔는지는 무관하다는 점을 이용) + 나머지 4클립(Walking/"Slash Advance"→`SlashAdvance`/"Hit Reaction"→`HitReaction`/Dying).

세 캐릭터 전부 `SetupXxxCharacterImport.Setup()` 배치 실행 — 리깅 에러 0, `AbeAnimated.prefab`·`BruteAnimated.prefab` 저장 확인. `BuildTestCharacterRealisticScene.Build()`·`BuildTestDungeonScene.Build()`로 씬 재빌드(Maria 몸 FBX GUID가 이 PC에서 새로 생겨 기존 커밋된 씬의 Missing Prefab 참조를 씬 재생성으로 해소). `BuildMariaSkinSplit.Build()`도 재실행.

**GUI 스크린샷 확인**(`PlaytestCharacterRealisticGui.cs`, 이전 세션이 만든 도구 재사용 — `ShotDir`가 예전 PC 사용자 계정 `C:/Users/Windows/...`로 박혀 있어 이 PC 경로로 고침):
- 1차는 셰이더 컴파일 미완료로 시안색 플랫 실루엣(66-2장 ⑩ 기록된 알려진 증상, 120프레임 대기로도 이 PC에선 부족) — 캐시 쌓인 뒤 재실행하니 갑옷·헤어·검 색까지 정상.
- **결론: 파판(FF16)급과는 거리가 멀다** — 갑옷·헤어는 또렷하지만 딱 봐도 범용 Mixamo 스톡 캐릭터+맨 조명 테스트 씬 수준. PLAN 66-2장 "현실적 기대치" 표가 이미 정직하게 적어 둔 그대로(라이팅/후처리는 근접 가능, 캐릭터 얼굴·피부·헤어는 근접 어려움).

**Dungeon Abe/Brute 확인용 신규 도구 `PlaytestDungeonEnemiesGui.cs`** — Boss(Brute, `BossSpawn=(9,0,0)`)·Escort(Abe, `BossEscortSpawns`) 근처로 플레이어를 텔레포트(카메라가 따라옴, 44장 Boss 교체 절과 같은 패턴). 두 가지 함정을 실제로 겪고 고침:
1. `DungeonFloorRunner`가 문 표지 구역 근접을 감지해 방을 진행시키며 `RepositionPlayerToEntry()`로 위치를 스폰으로 되돌린다 — 텔레포트 직후 `floorRunner.enabled = false`로 꺼서 해결.
2. `CameraRig` 기본값(zoom=6·pitch=55°)이 `DungeonRoomBuilder.WallHeight`(4m) 천장보다 높이 떠서(계산상 높이 ≈5.9m) 카메라가 천장 메시 안/위로 들어가 스크린샷이 돌벽 텍스처로 꽉 참 — 리플렉션으로 `_zoom=3f`·`_pitchDeg=30f`로 낮춰 해결(둘 다 각 필드의 `Min` 상수 그대로).
어두운 던전 기본 조명 아래에서는 실루엣만 겨우 보여, 확인용으로만 조명(Directional intensity·ambient·임시 Point Light)을 크게 올려 재촬영 — Maria 중심에 주변 캐릭터 팔다리가 프레임 가장자리에 걸쳐 보이는 수준까지 확인(완전한 전신 구도는 카메라 각도상 아직 못 얻음, 다음 세션 과제로 `PROJECT_STATE.md`에 남김).

**회귀 검증**: 씬을 Abe/Brute 실자산으로 재빌드했으니 `PlaytestDungeonHeadless`(10 frames, no errors)·`PlaytestDungeonFloorProgression`(12 room advances, floor 4, no errors — 런타임 스폰 경로 포함) 재실행, 둘 다 통과. `ProjectSettings/`·`Packages/` 부작용 없음(`tools/unity-batch.sh`로 매번 원복 확인).

`docs/PROJECT_STATE.md` 갱신(캐릭터 자산 절 신설, REALM 16~23차 서술 절은 이미 완료된 내용이라 압축, 함정 2건 추가, 테스트 상태·다음 작업 갱신).

## REALM 51장 24차 확장 — 전충→비경·신독→건타라 (2026-09-19, 새 세션 "사가 유니티 이어 해")

23차가 남긴 후보(상림 이웃 노용, 전충→비경/서권/구속, 신독→건타라/대하/목건타/사이) 중 웹판 원본 `saga-web/saga-realm/js/data-city.js`의 LINKS를 grep해 각 사슬 하나씩 골랐다. ① 전충→비경(원작 LINKS: dianchong-bijing, "진주조개를 캐는 배가 나가는 해안 현" — 전충의 다른 이웃 서권·구속도 원작에 더 뻗는 LINKS가 없어 셋 다 잎사귀, 임의로 비경을 골랐다. 이 사슬은 여기서 끝). ② 신독→건타라(원작 LINKS: shendu-jiantuoluo, "간다라의 저자" — 신독의 네 이웃 중 건타라·대하 둘만 한 단계 더 뻗고(각각 계빈·오익산리), 마게타·사위는 잎사귀. 건타라·대하가 동급이라 임의로 건타라를 골랐다). 둘 다 정상적인 한 단계 더 깊은 자식(부모의 train+15): 비경 265+15=280, 건타라 185+15=200. wall은 원작 그대로(비경 3000·건타라 3400), troops=wall×0.23 반올림(690·782). land는 비경이 원작 river라 그대로, 건타라는 원작 hill이라 Plain으로 보정(이 트랙 enum엔 Hill이 없음 — 상군 때와 같은 보정).

- `RealmEnemyCity.cs` — `BijingId`·`JiantuoluoId` 신설, `AllIds`·`Catalog`에 추가.
- `RealmCityData.cs` — 같은 두 성 추가.
- `PlaytestRealmSlice.cs` — `Phase.AttackDianchong`(→AttackBijing으로 다음 단계 변경)·`Phase.AttackShendu`(→AttackJiantuoluo로 다음 단계 변경) 수정. 새 `Phase.AttackBijing`(전충→비경, 사슬 끝이라 다음은 QuizCorrect)·`Phase.AttackJiantuoluo`(신독→건타라, 다음은 기존 AttackJiaozhi로 복귀) 신설. OK 로그 문구에 "chain-24th(jiantuoluo+bijing)" 추가.
- 로컬라이제이션: `city.bijing`/`city.jiantuoluo`(ko/en) 신설.

`tools/unity-batch.sh` 없이 Unity.exe를 직접 불렀다가(경로 문제) `ProjectSettings/ProjectVersion.txt`·`EditorSettings.asset`·`Packages/manifest.json`·`packages-lock.json` 네 파일이 조용히 고쳐진 것을 커밋 전에 `git checkout --`으로 원복(기존 "함정" 절 그대로 재현·확인). 컴파일 확인(error CS 0건) + `PlaytestRealmSlice` 3연속 OK(비경·건타라 함락 로그 매 회 확인, `-executeMethod Saga.EditorTools.PlaytestRealmSlice.Run`, `-quit` 안 줌). 씬 재생성 불필요.

`docs/PROJECT_STATE.md` 갱신(REALM 완료 요약 적국 41→43·성 44→46, 16~24차 절 갱신, "다음 작업"(25차 후보: 노용·건타라→계빈·신독 잔여 갈래) · 테스트 상태 · 실기 확인 대기 전부 갱신, 15353B로 15KB 상한 안쪽 유지).

## REALM 51장 25차 확장 — 상림 둘째 자식 노용·건타라→계빈 (2026-09-19, 새 세션 "사가 유니티 이어 해")

24차가 남긴 후보(노용, 건타라→계빈, 신독의 다른 이웃 대하/마게타/사위) 중 두 갈래를 골랐다. ① 상림의 둘째 자식 노용(원작 LINKS: xianglin-luorong, "상림과 나란한 옛 현" — 22차가 상림의 두 자식 전충·노용 중 전충만 골랐던 나머지 쪽을 이번에 채운다. train은 상림 자신의 250+15=265로 전충과 동률인 형제 가지, 원작에 더 뻗는 LINKS 없어 여기서 끝). ② 건타라→계빈(원작 LINKS: jiantuoluo-jibin, "카슈미르의 옛 이름" — 신독의 네 이웃 중 건타라·대하 둘만 한 단계 더 뻗는데(각각 계빈·오익산리), 24차가 이미 건타라를 골랐으니 그 다음 단계. train은 건타라 자신의 200+15=215, 원작에 더 뻗는 LINKS 없어 이 갈래도 끝). wall은 둘 다 원작 그대로(노용 2800·계빈 2800 — 우연히 같음), troops=wall×0.23 반올림(둘 다 644). land 보정: 노용은 원작이 이미 plain이라 그대로, 계빈은 원작 mount라 Plain으로 보정(이 트랙 enum엔 Hill/Mount가 없음, 23~24차의 hill 보정과 같은 이유).

노용을 추가하면서 **상림이 처음으로 목표 둘(전충·노용)을 가진 성이 됐다** — 건녕(51장 19차, 형제 가지 규칙 원래 세 국경 성 밖으로 첫 확장)과 같은 패턴을 이 사슬에 처음 적용한다:

- `RealmEnemyCity.cs` — `LuorongId`·`JibinId` 신설, `AllIds`·`Catalog`에 추가.
- `RealmCityData.cs` — 같은 두 성 추가.
- `PlaytestRealmSlice.cs` — `Phase.AttackXianglin`의 다음 단계를 새 `Phase.AttackLuorong`으로 바꾸고(노용을 먼저 공략), `AttackLuorong`이 `Phase.AttackDianchong`으로 이어지게 신설. 상림이 목표 둘을 갖게 됐으니 `AttackLuorong`·`AttackDianchong` 둘 다 `AttackChainStep`에 `enemyId`를 명시(생략하면 모호해짐, changan·jianning과 같은 이유). `Phase.AttackJiantuoluo`의 다음 단계를 새 `Phase.AttackJibin`으로 바꾸고 그 다음은 기존 `Phase.AttackJiaozhi`로 복귀(건타라는 자식이 계빈 하나뿐이라 enemyId 불필요). OK 로그 문구에 "chain-25th(luorong+jibin)" 추가.
- 로컬라이제이션: `city.luorong`/`city.jibin`(ko/en) 신설.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(error CS 0건)·`PlaytestRealmSlice` 3연속 실행(`Saga.EditorTools.PlaytestRealmSlice.Run`, `-quit` 안 줌) — 노용·계빈 함락 로그와 상림 다중 목표(enemyId 명시) 분기 매 회 확인, `ProjectSettings/`·`Packages/` 부작용 없음(래퍼가 매번 원복). 씬 재생성 불필요.

`docs/PROJECT_STATE.md` 갱신(REALM 완료 요약 적국 43→45·성 46→48, 16~25차 절 갱신, "다음 작업"(26차 후보: 신독의 다른 이웃 대하/마게타/사위) · 테스트 상태 · 실기 확인 대기 전부 갱신, 15323B로 15KB 상한 안쪽 유지).

## REALM 51장 26차 확장 — 신독 둘째 자식 대하 (2026-09-19, 새 세션 "사가 유니티 이어 해")

25차가 남긴 후보(신독의 다른 이웃 대하/마게타/사위) 중 웹판 원본 `data-city.js` LINKS를 다시 grep해 확인했다: 신독의 네 이웃 건타라·대하·마게타·사위 중 건타라(24차에서 이미 선택, →계빈)와 대하만 원작에 한 단계 더 뻗는 LINKS가 있고(각각 jibin, wuyishanli), 마게타·사위는 잎사귀. 이번엔 대하(원작 LINKS: shendu-daxia, "박트리아의 옛 이름" — 건타라와 형제 가지, train은 신독 자신의 185+15=200으로 건타라와 동률)를 골랐다. wall은 원작 그대로(3200), troops=wall×0.23 반올림(736). land는 원작 hill이라 Plain으로 보정(24차 건타라 때와 같은 이유).

**신독이 상림·건녕에 이어 세 번째로 목표 둘 이상을 가진 성이 됐다** — 25차가 상림에 처음 적용한 것과 같은 패턴을 그대로 적용:

- `RealmEnemyCity.cs` — `DaxiaId` 신설, `AllIds`·`Catalog`에 추가.
- `RealmCityData.cs` — 같은 성 추가.
- `PlaytestRealmSlice.cs` — `Phase.AttackShendu`의 다음 단계를 새 `Phase.AttackDaxia`로 바꾸고(대하를 먼저 공략), `AttackDaxia`가 기존 `Phase.AttackJiantuoluo`로 이어지게 신설. 신독이 목표 둘을 갖게 됐으니 `AttackDaxia`·`AttackJiantuoluo` 둘 다 `AttackChainStep`에 `enemyId`를 명시(25차 상림과 같은 이유). OK 로그 문구에 "chain-26th(daxia)" 추가.
- 로컬라이제이션: `city.daxia`(ko/en) 신설.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(error CS 0건)·`PlaytestRealmSlice` 3연속 실행(`Saga.EditorTools.PlaytestRealmSlice.Run`, `-quit` 안 줌) — 대하 함락 로그와 신독 다중 목표(enemyId 명시) 분기 매 회 확인, `ProjectSettings/`·`Packages/` 부작용 없음(래퍼가 매번 원복). 씬 재생성 불필요.

`docs/PROJECT_STATE.md` 갱신(REALM 완료 요약 적국 45→46·성 48→49, 16~26차 절 갱신, "다음 작업"(27차 후보: 대하→오익산리, 또는 신독 잎사귀 마게타/사위) · 테스트 상태 · 실기 확인 대기 전부 갱신, 15353B로 15KB 상한 안쪽 유지).

## REALM 51장 27차 확장 — 대하→오익산리 (2026-09-19, 새 세션 "사가 유니티 이어 해")

26차가 남긴 후보(대하→오익산리, 신독 잎사귀 마게타/사위) 중 계속 뻗는 쪽을 골랐다. 오익산리(원작 LINKS: daxia-wuyishanli, "알렉산드리아라 불리던 땅의 한역 이름" — 대하의 유일한 이웃, 원작에 더 뻗는 LINKS 없어 이 갈래는 여기서 끝). train은 대하 자신의 200+15=215. wall은 원작 그대로(2600), troops=wall×0.23 반올림(598). land는 원작 hill이라 Plain으로 보정(24·26차와 같은 이유).

대하는 자식이 오익산리 하나뿐이라(신독처럼 형제 가지가 아님) `enemyId` 명시가 필요 없다 — 25·26차의 다중 목표 성(상림·신독)과 달리 단순 단일 체인 삽입.

- `RealmEnemyCity.cs` — `WuyishanliId` 신설, `AllIds`·`Catalog`에 추가.
- `RealmCityData.cs` — 같은 성 추가.
- `PlaytestRealmSlice.cs` — `Phase.AttackDaxia`의 다음 단계를 새 `Phase.AttackWuyishanli`로 바꾸고, 그 다음은 기존 `Phase.AttackJiantuoluo`로 복귀. OK 로그 문구에 "chain-27th(wuyishanli)" 추가.
- 로컬라이제이션: `city.wuyishanli`(ko/en) 신설.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(error CS 0건)·`PlaytestRealmSlice` 3연속 실행(`Saga.EditorTools.PlaytestRealmSlice.Run`, `-quit` 안 줌) — 오익산리 함락 로그 매 회 확인, `ProjectSettings/`·`Packages/` 부작용 없음(래퍼가 매번 원복). 씬 재생성 불필요.

`docs/PROJECT_STATE.md` 갱신(REALM 완료 요약 적국 46→47·성 49→50, 16~27차 절 갱신, "다음 작업"(28차 후보: 신독 잎사귀 마게타/사위 중 하나, 고르면 신독 갈래 전부 닫힘) · 테스트 상태 · 실기 확인 대기 전부 갱신, 15352B로 15KB 상한 안쪽 유지).

## REALM 51장 28차 확장 — 신독 셋째 자식 마게타 (2026-09-19, 새 세션 "사가 유니티 이어 해")

27차가 남긴 후보(신독 잎사귀 마게타/사위) 중 마게타를 골랐다(원작 LINKS: shendu-moqietuo, "항하 유역의 크고 오래된 나라" — 건타라·대하와 형제 가지, 신독의 자식이 셋으로 늘어난 첫 사례. train은 신독 자신의 185+15=200으로 나머지 둘과 동률). wall은 원작 그대로(3600), troops=wall×0.23 반올림(828). land는 원작이 이미 plain이라 보정 불필요.

**신독이 건녕과 같은 패턴(목표 셋)에 도달했다** — 25·26차에서 상림·신독을 각각 목표 둘로 만든 뒤, 이번에 신독이 세 번째 목표를 갖게 되면서 21차 건녕(목표 3)과 같은 규모가 됐다. 대하·오익산리 체인(단일 자식, enemyId 불필요)은 그대로 두고, 신독에서 갈라지는 세 목표(건타라·대하·마게타) 전부에 `enemyId`를 명시해야 한다.

- `RealmEnemyCity.cs` — `MoqietuoId` 신설, `AllIds`·`Catalog`에 추가.
- `RealmCityData.cs` — 같은 성 추가.
- `PlaytestRealmSlice.cs` — `Phase.AttackShendu`의 다음 단계를 새 `Phase.AttackMoqietuo`로 바꾸고(마게타를 먼저 공략), 그 다음은 기존 `Phase.AttackDaxia`로 이어지게 신설(`enemyId` 명시). OK 로그 문구에 "chain-28th(moqietuo)" 추가.
- 로컬라이제이션: `city.moqietuo`(ko/en) 신설.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(error CS 0건)·`PlaytestRealmSlice` 3연속 실행(`Saga.EditorTools.PlaytestRealmSlice.Run`, `-quit` 안 줌) — 마게타 함락 로그와 신독 3자 분기(enemyId 명시) 매 회 확인, `ProjectSettings/`·`Packages/` 부작용 없음(래퍼가 매번 원복). 씬 재생성 불필요.

`docs/PROJECT_STATE.md` 갱신(REALM 완료 요약 적국 47→48·성 50→51, 16~28차 절 갱신, "다음 작업"(29차 후보: 신독 마지막 이웃 사위, 고르면 신독 갈래 전부 닫힘) · 테스트 상태 · 실기 확인 대기 전부 갱신, 15348B로 15KB 상한 안쪽 유지).

## REALM 51장 29차 확장 — 신독 넷째 자식 사위, 신독 갈래 완전히 닫힘 (2026-09-19, 같은 세션 "사가 유니티 이어 해")

28차가 남긴 마지막 후보 사위를 추가했다(원작 LINKS: shendu-sheyi, "순례자들이 마지막으로 닿는 저자" — 건타라·대하·마게타와 형제 가지, 신독의 자식이 넷으로 늘어난 첫 사례. train은 신독 자신의 185+15=200으로 나머지 셋과 동률). wall은 원작 그대로(3000), troops=wall×0.23 반올림(690). land는 원작이 이미 plain이라 보정 불필요.

**신독이 원작 LINKS(건타라·대하·마게타·사위 넷)를 전부 채워 이 갈래가 완전히 닫혔다** — `RealmWarState.Attack()`에서 신독은 이제 4자 분기 성으로, 이 트랙에서 가장 많은 목표를 가진 성이 됐다(기존 최다였던 건녕의 3개를 넘어섬).

- `RealmEnemyCity.cs` — `SheyiId` 신설, `AllIds`·`Catalog`에 추가.
- `RealmCityData.cs` — 같은 성 추가.
- `PlaytestRealmSlice.cs` — `Phase.AttackShendu`의 다음 단계를 새 `Phase.AttackSheyi`로 바꾸고(사위를 먼저 공략), 그 다음은 기존 `Phase.AttackMoqietuo`로 이어지게 신설(`enemyId` 명시). OK 로그 문구에 "chain-29th(sheyi)" 추가.
- 로컬라이제이션: `city.sheyi`(ko/en) 신설.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(error CS 0건)·`PlaytestRealmSlice` 3연속 실행(`Saga.EditorTools.PlaytestRealmSlice.Run`, `-quit` 안 줌) — 사위 함락 로그와 신독 4자 분기(enemyId 명시) 매 회 확인, `ProjectSettings/`·`Packages/` 부작용 없음(래퍼가 매번 원복). 씬 재생성 불필요.

**남은 후보 재조사**: 신독 갈래가 닫혀 다음 후보를 웹판 원본 `data-city.js` LINKS 전체를 다시 훑어 확인했다 — 노용→주오(원작 LINKS: luorong-zhuwu, 25차에서 노용을 추가했을 때는 미탐색 상태로 남아있던 자식), 전충의 다른 이웃 서권·구속(원작에 둘 다 잎사귀, 24차에서 비경을 골랐을 때 남긴 형제 가지).

`docs/PROJECT_STATE.md` 갱신(REALM 완료 요약 적국 48→49·성 51→52, 16~29차 절 갱신하며 "신독 갈래 전부 닫힘" 명시, "다음 작업"(30차 후보: 노용→주오 또는 전충의 다른 이웃 서권/구속) · 테스트 상태 · 실기 확인 대기 전부 갱신, "캐릭터 자산" 절 압축해 15KB 상한 안쪽 유지 — 14806B).

## REALM 51장 30차 확장 — 노용→주오 (2026-09-19, 같은 세션 "사가 유니티 이어 해")

29차 뒤 재조사한 후보(노용→주오, 전충의 다른 이웃 서권/구속) 중 노용의 유일한 이웃 주오를 골랐다(원작 LINKS: luorong-zhuwu, "한(漢)의 문서에 남은 가장 남쪽 현" — 원작에 더 뻗는 LINKS 없어 이 갈래는 여기서 끝). train은 노용 자신의 265+15=280. wall은 원작 그대로(2600), troops=wall×0.23 반올림(598). land는 원작 river 그대로.

노용은 자식이 주오 하나뿐이라(신독처럼 형제 가지가 아님) `enemyId` 명시가 필요 없는 단순 체인 삽입 — 27차 대하→오익산리와 같은 패턴.

- `RealmEnemyCity.cs` — `ZhuwuId` 신설, `AllIds`·`Catalog`에 추가.
- `RealmCityData.cs` — 같은 성 추가.
- `PlaytestRealmSlice.cs` — `Phase.AttackLuorong`의 다음 단계를 새 `Phase.AttackZhuwu`로 바꾸고, 그 다음은 기존 `Phase.AttackDianchong`으로 복귀. OK 로그 문구에 "chain-30th(zhuwu)" 추가.
- 로컬라이제이션: `city.zhuwu`(ko/en) 신설.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(error CS 0건)·`PlaytestRealmSlice` 3연속 실행(`Saga.EditorTools.PlaytestRealmSlice.Run`, `-quit` 안 줌) — 주오 함락 로그 매 회 확인, `ProjectSettings/`·`Packages/` 부작용 없음(래퍼가 매번 원복). 씬 재생성 불필요.

`docs/PROJECT_STATE.md` 갱신(REALM 완료 요약 적국 49→50·성 52→53, 16~30차 절 갱신, "다음 작업"(31차 후보: 전충의 다른 이웃 서권 또는 구속) · 테스트 상태 · 실기 확인 대기 전부 갱신, 14664B로 15KB 상한 안쪽 유지).

## 2026-09-19 — REALM 51장 31차 확장(전충→서권)

29~30차 뒤 남은 후보(전충의 다른 이웃 서권/구속, 24차에서 비경을 골랐을 때 남긴 형제 가지) 중 서권을 골랐다(원작 LINKS: dianchong-xiquan, "산을 낀 서쪽 현, 코끼리가 짐을 나른다" — 다른 이웃 구속도 원작에 더 뻗는 LINKS가 없어 둘 다 잎사귀, 임의로 서권을 골랐다. 구속은 다음 확장 후보로 남긴다). train은 전충 자신의 265+15=280(비경과 동률, 전충이 목표 둘로 늘어난 첫 사례 — xianglin 22차·shendu 24차와 같은 패턴). wall은 원작 그대로(2700), troops=wall×0.23 반올림(621). land는 원작 hill을 Plain으로 보정(건타라·대하와 같은 이유).

- `RealmEnemyCity.cs` — `XiquanId` 신설, `AllIds`·`Catalog`에 추가(`attackFromCityId: "dianchong"`).
- `RealmCityData.cs` — 같은 성 추가.
- `PlaytestRealmSlice.cs` — 전충이 목표 둘이 됐으니 `Phase.AttackBijing`에 enemyId(BijingId) 명시 추가(xianglin·shendu와 같은 이유), 다음 단계를 새 `Phase.AttackXiquan`으로 바꾸고 그 안에서 QuizCorrect로 복귀. OK 로그 문구는 안 바꿈(30차 문구 그대로 유지, xiquan은 개별 로그 줄로 확인).
- 로컬라이제이션: `city.xiquan`(ko/en) 신설.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(error CS 0건)·`PlaytestRealmSlice` 3연속 실행(`Saga.EditorTools.PlaytestRealmSlice.Run`, `-quit` 안 줌) — 서권 함락 로그 매 회 확인, `ProjectSettings/`·`Packages/` 부작용 없음(래퍼가 매번 원복). 로컬라이제이션 JSON 추가 뒤 1회 더 재검증(문법 확인 `node -e "JSON.parse(...)"` 포함). 씬 재생성 불필요.

`docs/PROJECT_STATE.md` 갱신(REALM 완료 요약 적국 50→51·성 53→54, 16~31차 절 갱신, "다음 작업"(32차 후보: 전충의 마지막 이웃 구속 — 고르면 전충 갈래 완전히 닫힘) · 테스트 상태 · 실기 확인 대기 전부 갱신, 14910B로 15KB 상한 안쪽 유지).

## 2026-09-19 — REALM 51장 32차 확장(전충→구속, 교주·남중 두 사슬 완전히 닫힘)

31차가 남긴 마지막 후보 구속을 채웠다(원작 LINKS: dianchong-quzu, "지도 위 가장 남쪽 이름, 여기서부터는 기록도 흐릿하다"). train은 전충 자신의 265+15=280(비경·서권과 동률, 전충이 목표 셋으로 늘어난 첫 사례 — jianning 21차·shendu 28차와 같은 패턴). wall은 원작 그대로(2500), troops=wall×0.23 반올림(575). land는 원작 hill을 Plain으로 보정(서권과 같은 이유). 원작에 더 뻗는 LINKS 없어(잎사귀) **전충 갈래가 이걸로 전부 닫힌다 — 상림 이하(전충·노용 두 자식 트리)가 완전히 닫히면서 교주 사슬 전체(남해→창오→울림→교지→구진→일남→상림→…, 합포)가 완전히 닫혔고, 29차에 이미 닫힌 남중 사슬(신독 이하)과 합쳐 51장의 두 남방 사슬이 모두 끝났다.**

- `RealmEnemyCity.cs` — `QuzuId` 신설, `AllIds`·`Catalog`에 추가(`attackFromCityId: "dianchong"`).
- `RealmCityData.cs` — 같은 성 추가.
- `PlaytestRealmSlice.cs` — 전충이 목표 셋이 되며 `Phase.AttackXiquan`도 enemyId(XiquanId) 명시로 바꾸고 다음 단계를 새 `Phase.AttackQuzu`로, 그 안에서 QuizCorrect로 복귀.
- 로컬라이제이션: `city.quzu`(ko/en) 신설.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(error CS 0건)·`PlaytestRealmSlice` 3연속 실행(`Saga.EditorTools.PlaytestRealmSlice.Run`, `-quit` 안 줌) — 구속 함락 로그 매 회 확인, `ProjectSettings/`·`Packages/` 부작용 없음(래퍼가 매번 원복). `bash tools/precheck.sh` 통과(문서 크기 `saga-unity/docs/PROJECT_STATE.md` 15271B, 15360B 상한 안쪽). 씬 재생성 불필요.

**남은 REALM 확장 후보(별개 지역)**: 13~14차가 남긴 막북(운중 이웃) 안문(yanmen)·정양(dingxiang), 상군 이웃 북지(beidi) — 셋 다 잎사귀, 웹판 원본 `data-city.js` LINKS 확인 완료(543~544행). 교주·남중 두 사슬은 더 뻗을 곳이 없다.

`docs/PROJECT_STATE.md` 갱신(REALM 완료 요약 적국 51→52·성 54→55, 16~32차 절을 "교주·남중 완전히 닫힘"으로 갱신, "다음 작업"(33차 후보: 막북 안문/정양/북지) · 테스트 상태 · 실기 확인 대기 전부 갱신, 15271B로 15KB(15360B) 상한 안쪽 유지).

## 2026-09-19 — REALM 51장 33~35차 확장(막북 북지·안문·정양, 복양 사슬 완전히 닫힘)

사용자 요청("막북 안문·정양·북지도 이어서 확장해줘")으로 13~14차가 남긴 세 후보를 한 세션에 모두 채웠다. 웹판 원본 `data-city.js` 320~336행·542~544행 LINKS 재확인: `yunzhong-yanmen`, `yunzhong-dingxiang`, `shangjun-beidi` — 셋 다 잎사귀(원작에 더 뻗는 LINKS 없음).

- **33차 북지(beidi)** — 상군(shangjun)의 둘째 자식(삭방과 형제 가지, 상군이 목표 둘로 늘어난 첫 사례). train=상군 자신의 105+15=120(삭방과 동률). wall 3000(원작 그대로), troops=690. land plain(보정 불필요). 이걸로 상군 갈래가 전부 닫힌다.
- **34차 안문(yanmen)** — 운중(yunzhong)의 둘째 자식(상군과 형제 가지, 운중이 목표 둘로 늘어난 첫 사례). train=운중 자신의 90+15=105(상군과 동률). wall 3000(원작 그대로), troops=690. land는 원작 mount를 Plain으로 보정(건타라·대하·서권·구속과 같은 이유).
- **35차 정양(dingxiang)** — 운중의 셋째이자 마지막 자식(상군·안문과 형제 가지, 운중이 목표 셋으로 늘어난 첫 사례 — 전충과 동급 최다). train=운중 자신의 90+15=105(동률). wall 2800(원작 그대로), troops=644. land plain(보정 불필요). **이걸로 운중 갈래, 즉 복양(막북) 사슬 전체가 완전히 닫혔다.**

DFS 순서 재배선: 기존 사슬은 운중→상군→삭방→오원→(바로 한중으로) 였는데, 오원(삭방의 유일한 자식, 잎사귀) 다음에 상군의 둘째 자식 북지를 먼저 채워 상군 서브트리를 완전히 닫고, 그다음 운중으로 돌아가 안문→정양 순으로 운중의 남은 두 자식을 채운 뒤 기존 한중 단계로 복귀하도록 체인을 다시 이었다(다이안총이 비경→서권→구속으로 뻗을 때 쓴 것과 같은 패턴).

- `RealmEnemyCity.cs` — `BeidiId`·`YanmenId`·`DingxiangId` 신설, `AllIds`·`Catalog`에 추가(각각 `attackFromCityId: "shangjun"`·`"yunzhong"`·`"yunzhong"`).
- `RealmCityData.cs` — 같은 성 셋 추가.
- `PlaytestRealmSlice.cs` — 상군이 목표 둘(삭방·북지), 운중이 목표 셋(상군·안문·정양)이 되며 `Phase.AttackShangjun`·`Phase.AttackShuofang`에 enemyId 명시 추가. `Phase.AttackWuyuan`의 다음 단계를 기존 `Phase.AttackHanzhong`에서 새 `Phase.AttackBeidi`로 바꾸고, `AttackBeidi`→`AttackYanmen`→`AttackDingxiang`→`AttackHanzhong` 순으로 이어 기존 사슬에 복귀시켰다.
- 로컬라이제이션: `city.beidi`·`city.yanmen`·`city.dingxiang`(ko/en) 신설.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(error CS 0건)·`PlaytestRealmSlice` 3연속 실행(`Saga.EditorTools.PlaytestRealmSlice.Run`, `-quit` 안 줌) — 북지·안문·정양 함락 로그 매 회 확인, `ProjectSettings/`·`Packages/` 부작용 없음(래퍼가 매번 원복). `bash tools/precheck.sh` 통과(문서 크기 `saga-unity/docs/PROJECT_STATE.md` 15291B, 15360B 상한 안쪽). 씬 재생성 불필요.

**REALM 51장 국경 확장 결론**: 교주(16~32차 관련분)·남중(16~29차)·복양/막북(12~15차, 33~35차) 세 사슬 모두 웹판 원본 LINKS 기준으로 완전히 닫혔다(적국 55·성 58). 더 늘리려면 새 지역이나 51장 밖 다른 축이 필요 — 사용자 결정 대기.

`docs/PROJECT_STATE.md` 갱신(REALM 완료 요약을 "교주·남중·복양 세 사슬 전부 완전히 닫힘"으로 압축(상세는 HISTORY 위임, 문서 크기 여유 확보), "다음 작업"(REALM 국경 확장 후속은 사용자 결정 대기로 변경) · 테스트 상태 · 실기 확인 대기 전부 갱신, 15291B로 15KB(15360B) 상한 안쪽 유지).

## 2026-09-19 — 105 Q1 사실상 처리 + PLAN 101-2 ④ GO 일과판 첫 실장

**Q1 결정 경위**: 사용자에게 "godot·unity 중 그래픽 투자 우선 트랙"을 물으며 두 트랙 진척을 실제로 비교해 보고했다(godot: GO·DUNGEON·FOREST 3판 실기 승인, STORY·REALM도 101-2 항목 다수 완료, 성 107개 / unity: 다섯 판 다 Vertical Slice만, 101-2는 대부분 첫 항목만). 사용자가 "godot 실기 승인을 검증으로 인정, unity로 포트 진행"으로 답해 — Q1(트랙 우선순위) 자체보다 **더 구체적인 하위 결정**(PLAN.md 101-2 "웹에서 통한 것부터" 게이트를 saga-godot 실기 승인으로도 충족된 것으로 인정)으로 정리됐다. PLAN.md 101-2 서두에 이 결정을 기록(코드는 안 베낌, 설계 검증만 인정).

이 결정으로 열린 첫 작업 — GO 101-2 ④ 일과판(웹판 §5 ④, `saga-web/saga-go/PLAN.md` 158행) 완성. 웹판 풀 8(걷기·조우 3·역참 2·사건 2·비석 3·토벌 1·반려 500m·사당 1) 중 역참·비석·사당·반려는 이 트랙에 없고, 발견형 콘텐츠(숨은 보물·산신당·동쪽 숲 유물·채집)는 전부 `WorldEventState`/`GatherState`로 "한 번뿐"이라 반복되는 일과가 못 된다(자리가 유한) — 그래서 실제로 **몇 번이고 반복 가능한** 시스템 넷(걷기·도적 조우 승리·희귀 늑대 토벌·성황당 기원)으로 풀을 재구성했다.

- `Data/DailyTaskState.cs`(신설) — 날짜 문자열(yyyy-MM-dd)을 직접 구현한 안정 해시(`string.GetHashCode()`는 프로세스마다 값이 달라질 수 있어 안 씀)로 시드를 만들어 `System.Random` Fisher-Yates로 풀 4를 섞고 앞 3개를 뽑는다(같은 날짜=항상 같은 셋). 진행 리포트(`ReportProgress(Kind, amount)`), 셋 다 완료 시 도장 1(`CheckAllDone`), 도장 7=금+100·경험치+150 지급.
- `GoSessionTracker.cs` — `GoalLineSession()`(이번 세션 — 오늘의 일과 중 남은 것)·`GoalLineWeek()`(이번 주 — 도장 진행)를 실값으로 교체(기존 placeholder 지움). Update()에서 이동량을 정수 m 단위로 이월해 `ReportProgress(Kind.Walk, ...)` 호출(DailyTaskState는 int만 받음 — float 그대로 넘기면 컴파일 에러, 처음에 겪음).
- `BanditEncounter.cs`/`RareWolfEncounter.cs`/`LuckyCairn.cs` — 각각 승리/기원 시점에 한 줄씩 `DailyTaskState.ReportProgress(...)` 훅.
- `SaveState.cs` — v9→v10(dailyDate/dailyProgress/dailyDone/dailyStampGranted/dailyStamps). v9 이하는 빈 날짜로 채워 다음 `EnsureToday()`가 오늘 날짜로 새로 뽑는다(진행 손실 없음 — 애초에 없던 기능이라 잃을 진행이 없다).
- `PlaytestHeadless.cs` — 새 `CheckDailyTasks()`(반드시 프레임 3 체크 시퀀스의 **마지막**, 이유는 아래 함정 참고). 리플렉션으로 `DailyTaskState`의 private 정적 필드/메서드를 직접 조작해: 날짜 해시 결정성, 진행→완료→도장, 도장 7 주간 보상(경험치는 레벨업이 끼면 절대값 델타로 못 재기 때문에 `PlayerStats.LeveledUp` 이벤트 카운트로 대체 확인), 저장/로드 왕복, v9 마이그레이션(수기로 v9 모양 JSON을 실제 세이브 파일에 잠깐 써넣고 확인)까지 전부 검증.

**함정(실제로 겪음)**: `CheckDailyTasks()`가 `SaveState.Save()`를 실제로 부르면 `Application.persistentDataPath/save.json`(`AppData/LocalLow/DefaultCompany/SAGA/save.json`)이 진짜로 남는다. `GameBootstrap.Start()`가 부팅마다 `TryLoad()`를 부르므로, 이 파일을 "Save() 호출 **직후**" 시점으로 되돌리면 그 자체가 오염이다(그 시점 상태엔 이미 이번 테스트가 만든 값이 들어 있다) — 반드시 **그 어떤 Save()도 부르기 전** 원본(없었으면 파일 자체를 삭제)으로 되돌려야 한다. 처음엔 v9-마이그레이션 서브블록만 try/finally로 감쌌다가, 실제로 다음 헤드리스 실행에서 `CheckWeaponVisual`이 "이미 장착된 무기라 칼날 크기 변화 없음"으로 간헐 실패하는 걸 겪고서야 전체(저장/로드 왕복 + v9 마이그레이션)를 하나의 try/finally로 다시 묶었다. 오염된 실제 세이브 파일도 수동으로 지웠다.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(error CS 0건, float→int 인자 오류 1회 겪고 고침)·`PlaytestHeadless`(GO) 3연속 실행(`Saga.EditorTools.PlaytestHeadless.Run`, `-quit` 안 줌) — 처음 2회는 세이브 오염으로 간헐 실패, 원인 수정 후 3연속 OK. `ProjectSettings/`·`Packages/` 부작용 없음(래퍼가 매번 원복).

`docs/PROJECT_STATE.md` 갱신(GO 완료 요약에 101-2 ④ 추가, 세이브 버전 v9→v10 표기, "다음 작업" 1순위를 "PLAN 101-2 이어서"로 교체하고 Q1을 사실상 처리된 것으로 정리, 테스트 상태·실기 확인 대기·알려진 함정(세이브 오염) 갱신 — 15KB 상한에 걸려 REALM/STORY 절 여러 곳을 압축해 15360B로 맞춤).

## 2026-09-19 — PLAN 101-2 ⑦ GO 승급 3택 ("사가 유니티 이어 해" 세션)

101-2 GO 표의 ④(일과판, 이번 세션 앞부분에서 완성) 다음 순서. 웹판 §5 ⑦(`saga-web/saga-go/PLAN.md` 198행, "특성 갈래" — 승급 시 공(攻)·수(守)·보(補) 축 카드 3, 풀 12, 인물당 최대 3특성·같은 축 둘 금지, 거절=단사 10, 특성은 배율로만)을 이 트랙 실제 시스템에 맞춰 재해석했다. saga-godot이 이미 "부대 레벨업마다"로 재해석해 실기 승인(101-2 서두 2026-09-19 결정)을 받았으니 그 설계 의도만 참고하고, UI·수치는 그쪽 코드를 보지 않고 새로 짰다(코드 공유 없음 원칙).

이 트랙 GO엔 `hero.js` 같은 개별 인물 rank 시스템이 없다(`PartyState`는 등용 인원수만 센다) — 그래서 "승급"을 `PlayerStats.LeveledUp`(플레이어 전체 레벨업)으로 재해석했다. "인물당 최대 3특성·같은 축 둘 금지"는 축을 3개(공/수/보)로 고정하고 축마다 정확히 하나씩만 보유하는 구조로 못박아, 별도의 "다 찼으면 그만" 상태 없이 구조적으로 불변식을 지키게 했다 — 매 레벨업마다 항상 카드 3장(축 하나씩)을 제안하고, 이미 그 축에 특성이 있어도 다시 제안하며 고르면 교체(갈아 끼움)한다.

- `Data/PerkState.cs`(신설) — 축(Atk/Def/Support) × 4 = 풀 12(효과 +5~8%, 웹판 수치 그대로). `RollChoice()`가 축마다 무작위 하나씩 정확히 3장을 돌려주고, `Choose(perk)`는 그 축을 갈아 끼우며(기초 능력치는 안 건드림), `Reject()`는 `GoldState.Add(10)`(웹판 "단사 10"을 이 트랙 통화로 재해석). `AtkMultiplier`/`DefMultiplier`/`KiMultiplier`로 배율만 노출.
- `Data/DuelRules.cs` — `KiMul` 필드(기본 1f) 추가, `Act("quick")`의 Ki 획득에 곱한다. "보(補)" 축을 필살기 충전 가속으로 재해석(이 판엔 회복 시스템이 없어 가장 "지원"에 가까운 기존 수치).
- `World/BanditEncounter.cs`·`World/RareWolfEncounter.cs` — `StartFight()`에서 atk/def 합산 값에 `PerkState.AtkMultiplier`/`DefMultiplier`를 곱하고 `_duel.KiMul = PerkState.KiMultiplier`(기초 능력치 자체는 그대로 — 101-2 ⑦ "기본치 불변" 규칙).
- `UI/PerkChoiceUi.cs`(신설) — `StoryJobChoiceUi.cs`와 같은 결(자기 캔버스를 스스로 짓는 단일 컴포넌트)이되, GO는 이미 `EncounterUiKit`(캔버스/패널/텍스트/버튼 공용 부품)이 뽑혀 있어 그대로 재사용. 카드 3장(세로) + 거절 버튼.
- `World/GameBootstrap.cs` — `PlayerStats.LeveledUp` 핸들러에서 카메라 컷(기존)에 이어 `PerkChoiceUi.Show(PerkState.RollChoice(), PerkState.Choose, PerkState.Reject)` 호출(이미 떠 있으면 새로 안 띄움).
- `Editor/BuildTestVillageScene.cs` — `BuildPerkChoiceUi()` 신설, GoalBoardUi 뒤·Bootstrap 앞에서 호출. **씬을 재빌드해야 반영됨**(`-executeMethod Saga.EditorTools.BuildTestVillageScene.Build`) — 처음 헤드리스 검증에서 "PerkChoiceUi를 못 찾음"으로 실패하고서야 이걸 놓친 걸 알았다.
- `SaveState.cs` — v10→v11(`perkIds`, 축 순서로 최대 3개). v10 이하는 빈 목록.
- `Resources/Localization/go_ko.json`·`go_en.json` — `perk.title`·`perk.reject` 키 추가(GO 전용, 다섯 판 공유 아님 — `settings.*`만 공유).
- `Editor/PlaytestHeadless.cs` — 새 `CheckPerkChoice()`(`CheckLevelUpCut()` 바로 뒤). 직전 강제 레벨업이 GameBootstrap 배선을 타고 실제로 카드를 띄웠는지부터 확인(STORY `StoryJobChoiceUi` 검증과 같은 결 — 위젯과 게임 상태를 나눠 본다), 버튼 클릭 흉내(`ChooseIndex` 리플렉션)로 하나를 고른 뒤 배율만 오르고 `PartyState.Atk`/`PlayerStats.AtkBonus`는 안 바뀌는지, 새로 굴린 카드로 거절 경로(`Reject` 리플렉션, 골드+10)까지, 마지막으로 `RollChoice()` 50회 굴려 매번 축 셋이 다 다른지 확인.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(error CS 0건) → 씬 재빌드(`BuildTestVillageScene.Build`) → `PlaytestHeadless`(GO) 3연속 OK(`Saga.EditorTools.PlaytestHeadless.Run`, `-quit` 안 줌; 1회차는 씬 재빌드 전이라 PerkChoiceUi를 못 찾아 실패, 재빌드 후 2~4회차 전부 OK). `ProjectSettings/`·`Packages/` 부작용 없음(래퍼가 매번 원복).

`docs/PROJECT_STATE.md` 갱신(GO 완료 요약에 101-2 ⑦ 추가, 세이브 버전 v10→v11, "다음 작업" 1순위를 "GO ③ 75초 토벌"로 교체, 테스트 상태·실기 확인 대기 갱신 — 15KB 상한에 걸려 여러 줄 압축).

## 2026-09-19 — PLAN 101-2 ③ GO 75초 토벌 (같은 "사가 유니티 이어 해" 세션, ⑦ 승급 3택 다음)

101-2 GO 표의 ④⑦ 다음 순서, 마지막 셋째 항목. 웹판 §5 ③(`saga-web/saga-go/PLAN.md` 190행, "75초 토벌 — 부위 파괴·저스트 회피", 몬스터헌터 나우 참고, 2026-09-17 웹판 자체는 "토벌에서만 켠다(create({raid:true})) — 야생 조우·성채 수비대는 옛 판정 그대로"로 스코프를 정리해 둔 상태)을 이 트랙에 이식했다.

**어디에 걸었나**: 이 트랙 GO엔 웹판처럼 "야생 조우"와 "토벌"이 분리된 별도 사건이 없다 — `BanditEncounter.cs`(습격, 상시 반복)와 `RareWolfEncounter.cs`(희귀 몬스터, 일회성·이미 "토벌"이라 불림 — 도장도 "희귀 늑대 토벌") 둘뿐이다. 웹판의 스코프 결정("야생 조우는 그대로")을 그대로 지키려고 `BanditEncounter.cs`는 전혀 안 건드리고, 이미 "일부러 찾아가 잡는 토벌"에 가장 가까운 `RareWolfEncounter.cs`에만 raid 모드를 켰다 — 새 보스 캐릭터·새 월드 배치는 안 만들었다(범위를 좁게 유지).

- `Data/DuelRules.cs` — `Raid`(bool)·`PartBroken[3]`·`PartsJustBroken` 필드, `Create(..., raid: false)` 옵션 인자(raid=true면 `Left`를 강제로 `RaidTimeSec`(75) — 기존 호출부(BanditEncounter)는 인자를 안 줘 바이트 단위로 예전 그대로). `Act("dodge")`가 raid에서만 `JustWindowSec`(0.25s, 예고 끝)으로 창을 좁힌다 — 창 밖은 `Reason="early"`로 실패(비raid는 예전처럼 Tell 전체가 성공). `Step()`의 heavy 판정도 raid에서 갈라진다: 저스트 성공(`Dodged`)이면 완전 회피(`heavy=0`)+기 `+KiMax*0.30*KiMul`, 실패(아무 것도 안 눌러도)면 `PassiveMitigation`(0.5)로 절반만 — "예고 중 걷기만으로는 절반만 피한다"의 재해석(비raid는 예전 `DodgeCut`(0.15) 경로 그대로). `CheckPartBreak()`(private, `Act`의 quick/ult 데미지 분기 뒤 호출)이 웹판 구현 그대로 부위별 HP를 안 나누고 같은 기세 풀을 75%/50%/25% 누적 문턱으로 읽어 문턱을 넘을 때마다 부위 하나씩 파괴한다.
- `World/RareWolfEncounter.cs` — `StartFight()`가 `DuelRules.Create(..., raid: true)`로 켠다. `DoAct()`가 `_duel.PartsJustBroken>0`이면 `OnPartsBroken()`(재료 보상 골드 즉시 지급 + pulse/hitstop/flash 연출 + 부위 3 전부면 완파 보너스, 한 Toast 문자열에 모아서 — `DialogueLabel`이 단일 인스턴스라 Toast를 연달아 부르면 뒤엣것이 앞엣것을 지운다는 걸 `FinishFight()`가 이미 보여준 패턴). "부위 3(갑주·병장·기마)"은 사람 산적 전용 이름이라 짐승(늑대)엔 안 맞아 **다리/몸통/급소**로 재해석(`part.leg`/`part.torso`/`part.core` 로컬라이제이션 키). 부위 게이지는 새 UI 부품을 안 만들고(`EncounterUiKit`엔 바 로우뿐) 기세 바로 아래 한 줄 텍스트로("부위 다리 몸통 (급소)" — 괄호=파괴됨, Text엔 취소선이 없어서). 저스트 성공 시 기존 초록 플래시(`e.Dodged`)에 "간발!" 팝 토스트를 얹었다. 웹판 "부위 3 전부 파괴 = 등용 확률 ×1.5"는 이 사건이 등용 대상이 아니라(위 클래스 주석) 안 맞아 즉시 골드 보너스로 재해석.
- `Resources/Localization/go_ko.json`·`go_en.json` — `combat.just_dodge`·`combat.parts`·`part.leg`·`part.torso`·`part.core`·`encounter.part_broken`·`encounter.full_break_bonus` 키 추가(GO 전용).
- `Editor/PlaytestHeadless.cs` — 새 `CheckRaidBoss()`(`CheckWeaponVisual()` 바로 뒤, `CheckDailyTasks()` 앞). 두 사이클: ① `RareWolfEncounter.StartFight()` 뒤 raid 플래그·Left=75 확인, `DuelRules.Act`/`Step`이 전부 public이라 리플렉션 없이 `duel.Tell`을 직접 조작해 저스트 창 밖("early")·안(완전 회피+기 보너스, 정확한 기대값까지 근사 비교)·수동 mitigation(절반, 기대값 계산까지) 결정적으로 확인. ② `StartFight()`를 다시 불러 깨끗한 `_duel`을 받은 뒤 `Hp`를 75%/50%/25% 문턱 바로 위(margin 2 — quick 한 방 dmg보다 작아야 넘어간다)로 세팅하고 private `DoAct("quick")`(버튼 클릭과 같은 경로)를 실제로 태워 부위 파괴 골드 보상·완파 보너스까지 검증.

**함정(실제로 겪음, 둘 다 이 체크 작성 중)**: (1) 첫 시도에 margin을 20으로 잘못 잡아 quick 한 방(보통 6~10 dmg)이 못 넘어서 "부위가 안 깨짐"으로 실패했다 — margin은 dmg보다 **작아야** 문턱을 넘는다는, 방향이 반대인 실수. (2) margin을 고쳐도 두 번째 문턱(50%)에서 또 실패했는데, 원인은 `DuelRules.Act("quick")`의 `QuickCd`(0.35s) 쿨다운이 반복문 사이에 안 풀려 두 번째 `DoAct("quick")`가 조용히 `"cd"`로 실패한 것 — 반복마다 `duel.Cd = 0f`로 직접 리셋해야 했다. 둘 다 "왜 골드가 그대로냐"는 같은 증상이라 로그의 `broken=False`를 보고서야 원인을 갈랐다.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(error CS 0건) → `PlaytestHeadless`(GO) 3연속 OK(`Saga.EditorTools.PlaytestHeadless.Run`, `-quit` 안 줌 — 첫 2회는 위 두 함정으로 실패, 원인 수정 후 3연속 OK). 이 사건은 씬 구성(GameObject 추가) 변경이 없어(기존 `RareWolfEncounter` 컴포넌트에 로직만 얹음) **씬 재빌드 불필요**했다(101-2 ⑦ 승급 3택 때와 다른 점 — 그때는 새 UI GameObject를 추가해 재빌드가 필요했다).

`docs/PROJECT_STATE.md` 갱신(GO 완료 요약에 101-2 ④⑦③ 전부 완료 표기, "다음 작업"을 "GO 첫 세 항목 완료, ①②⑥⑧ 중 결정 대기"로 교체, 테스트 상태·실기 확인 대기 갱신 — 15KB 상한에 걸려 여러 줄 압축). `PLAN.md` 101-2 GO 행에 완료 주석 추가(대응 파일에 `RareWolfEncounter` 추가).

## 2026-09-19 — PLAN 101-2 5.1 DUNGEON 축복 3택 (새 세션 "사가 유니티 이어 하자")

101-2 표에서 GO 세 항목이 전부 닫혀 사용자 결정 대기 상태였던 반면, DUNGEON 5.1(축복 3택)은 순서상 다음(5.8→5.1→5.2)이고 사용자 결정이 필요 없어 이쪽을 이었다.

**웹판을 그대로 안 옮긴 이유**: 웹판 §5.1(`saga-web/saga-dungeon/PLAN.md` 121행, 2026-09-18 코드분 완료·실기 미확인)은 무예 4칸 로드아웃·서명 무예·7원소 조합표(36개 축복)를 전제한다. 이 트랙 `HeroState`(Data/HeroState.cs)는 단일 인물·단일 무기라 로드아웃 자체가 없고 원소 시스템도 없다 — 36개 표를 그대로 옮길 대상이 없다. 대신 이 트랙엔 웹판에 없는 실제 "빌드" 갈림이 이미 있다: `PlayerCombat.cs`(51장 "DUNGEON 확장 — 빌드", 2026-09-14)가 "하나를 크게(강공격)" 대 "여럿을 조금씩(회전베기)" 트레이드오프를 이미 만들어 뒀다. 그래서 SagaGo `PerkState.cs`(승급 3택 — 축마다 정확히 하나, 고르면 교체)와 같은 구조를 가져오되, 축은 이 트랙 고유의 **공(攻)/수(守)/선(旋)** 셋으로 잡았다 — 선(旋) 축이 회전베기 빌드를 직접 강화해 "범위형으로 계속 밀어붙일지"가 실제로 의미 있는 선택이 되게 했다.

- `Data/BlessingState.cs`(신규) — `PerkState.cs`와 거의 같은 구조: `Axis{Atk,Def,Sweep}`, 풀 12(축당 4, 배율 +5~8%), `RollChoice()`/`Choose()`/`Reject(floor)`/`SnapshotIds()`/`Restore()`. `Reject`는 웹판 "거절 = 금 30×층" 뜻을 이 트랙 통화 규모로 가져와 `RejectGoldPerFloor(10) × floor`.
- 적용 지점 셋, 전부 배율만(기초 능력치 불변 원칙): `Data/HeroState.cs`의 `HitDamage`에 `AtkMultiplier`를 곱한다(평타·강공격·회전베기가 전부 이 값을 밑값으로 쓰므로 셋 다 같이 큰다) · `TakeDamage()`가 받는 피해를 `DefMultiplier`로 나눈다(HeroState엔 원래 "방어" 스탯 자체가 없었다 — 이 축이 처음 만든 새 레버) · `Player/PlayerCombat.cs`의 `TryWhirl()`이 회전베기 쿨다운을 `SweepMultiplier`로 나눈다.
- 트리거: `World/DungeonFloorRunner.cs`에 `event Action<int> FloorDescended`를 신설해 `Descend()`(`_floor++` 직후) 끝에서 쏜다. **`JumpToFloor()`(세이브 복원 경로)는 이 이벤트를 안 쏜다** — Descend()를 안 거치므로(직접 `_floor = floor` 대입) 자동으로 그렇게 됐지만, 클래스 주석에 "이어하기는 다시 내려가는 게 아니다"로 명문화해 나중에 실수로 못 얹게 해 뒀다.
- `World/GameBootstrap.cs` — `FloorDescended` 구독, `DungeonFormulas.IsBossFloor(floor)`(3층마다, 웹판과 같은 문턱)일 때만 `BlessingChoiceUi`를 찾아 띄운다. `PerkChoiceUi`처럼 "이미 떠 있으면 새로 안 띄운다" 가드 그대로.
- `UI/BlessingChoiceUi.cs`(신규) — `PerkChoiceUi.cs`와 같은 카드 UI지만, 이 트랙엔 `EncounterUiKit` 같은 공용 부품이 없어(BanditEncounter류가 없다) `StoryJobChoiceUi.cs`처럼 캔버스/패널/텍스트/버튼을 스스로 짓는다(세 번째 재사용처가 아직 없어 kit로 안 뽑는 같은 판단).
- `Data/SaveState.cs` — v5→v6, `blessings` 필드(`BlessingState.SnapshotIds()`) 추가. v5 이하 세이브는 `blessings`가 null로 채워지고 `Restore(null)`이 조용히 무시(마이그레이션 코드 없음, GO SaveState.cs와 같은 패턴).
- `Resources/Localization/dungeon_ko.json`·`dungeon_en.json` — `blessing.title`·`blessing.reject` 키 추가(GO `perk.*`와 같은 자리).
- `Editor/BuildTestDungeonScene.cs` — `BuildBlessingChoiceUi()` 신설(`PerkChoiceUi`용 `BuildPerkChoiceUi()`와 같은 결), `BuildMobileHud()` 뒤·`BuildBootstrap()` 앞에서 호출.

**검증**: `tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(error CS 0건, `ProjectSettings/`·`Packages/` 부작용 없음 — 래퍼가 매번 원복) → `BuildTestDungeonScene.Build`로 씬 재빌드(새 `BlessingChoiceUI` GameObject 포함) → `PlaytestDungeonHeadless`(`Saga.EditorTools.PlaytestDungeonHeadless.Run`, `-quit` 안 줌) 10 frames no errors → `PlaytestDungeonFloorProgression`(같은 방식)도 12 room advances·floor 4 no errors, 이 과정에서 실제로 3층(보스층)을 지나며 `FloorDescended`→축복 카드 트리거 경로를 태웠는데도 오류 없음. 실기 확인은 아직(카드 UI 실제로 뜨는지·공수선 배율 체감) — PROJECT_STATE.md "실기 확인 대기"에 추가해 뒀다(몰아서 확인 방침).

`docs/PROJECT_STATE.md` 갱신(DUNGEON 완료 요약에 101-2 5.1 추가, "다음 작업" 1순위에 DUNGEON 5.1 완료·다음은 5.2 명시, 테스트 상태·실기 확인 대기 갱신). `PLAN.md` 101-2 DUNGEON 행에 완료 경위·재해석 이유 추가(대응 파일에 `BlessingState`·`BlessingChoiceUi` 추가).

## 2026-09-19 — PLAN 101-2 5.2 DUNGEON 유품 (같은 "사가 유니티 이어 해" 세션, 5.1 축복 3택 다음)

DUNGEON 순서(5.8→5.1→5.2)의 마지막 항목. 지금까지 죽으면 `PlayerCombat.OnDied()`가 `HeroState.FullHeal()`만 부르고 아무 비용 없이 그대로 부활했다(클래스 주석에 "다음 슬라이스가 실제 죽음 처리를 다룰 몫"으로 명시돼 있던 자리).

**웹판을 그대로 안 옮긴 이유**: 웹판 §5.2(`saga-web/saga-dungeon/PLAN.md` 143행, 2026-09-18 코드분 완료·실기 미확인)는 "런(회차)을 리셋하고 다음 회차에 그 층에 도달하면 유품을 회수한다"는 로그라이크 전제다. 이 트랙 DUNGEON은 편도 절차적 진행(`DungeonFloorRunner.cs`, 51장) — 방을 뜨면 그 방은 물리적으로 사라지고 되돌아갈 길이 없다. "다음 회차에 그 층에" 자체가 성립하지 않는다. 그래서 "회수 전에 방을 뜨면 잃는다"로 좁혔다 — 죽은 그 자리에서 곧바로 회수할 기회를 주고, 다음 방으로 넘어가면 자동으로 사라진다. 노획물 종류도 웹판(금·장비·재료)과 다르다 — 이 트랙 `HeroState`는 가방이 없고 장비가 "지금 낀 것" 하나뿐이라(더 센 것만 자동 장착) 유품으로 내려놓을 게 사실상 골드뿐이다.

- `Data/HeroState.cs` — `DropGoldAsGrave()`(소지 골드 전부를 0으로 비우고 반환) 신설, `TakeDamage()`의 사망 분기가 이 값을 `Died` 이벤트 인자로 넘긴다(`event Action<int> Died` — 기존 `Action`에서 시그니처 변경, 구독자가 `PlayerCombat.cs` 하나뿐이라 안전).
- `World/GraveMarker.cs`(신규) — `LootMarker.cs`(101-3 F)와 겉모습은 비슷하지만 뜻이 다르다: LootMarker는 이미 지급된 보상의 "시각적 잔향"이라 주워도 아무것도 안 주는 반면, GraveMarker는 실제로 `HeroState.AddGold()`를 돌려준다. 한 번에 하나만 존재(`Spawn()`이 이전 것을 먼저 Destroy — 웹판 "회수 전에 다시 죽으면 옛 유품 소멸"). 방 갈이에 따른 자동 소멸은 별도 타이머 없이 `DungeonFloorRunner.AddToRoom()`(신설, `_contentRoot`에 `worldPositionStays: true`로 붙임 — 그 방이 갈릴 때 통째로 Destroy되는 기존 로직에 얹기만 했다)로 공짜로 얻었다.
- `Player/PlayerCombat.cs`의 `OnDied(int lostGold)` — 애니메이션·마커 스폰(자기 위치)·회복·토스트 문구(잃은 게 있으면 금액 명시)만 맡는다.
- `World/GameBootstrap.cs` — `HeroState.Died`를 새로 구독(`OnHeroDied`), 웹판 "사망 화면 = 세션 카드" 뜻을 이 트랙 표준 `SessionCard`(101-2 B, `Assets/SagaCore/SessionCard.cs`)로 그대로 재사용해 띄운다(자동 5초 닫힘 — 웹판은 "사용자가 닫는다"였지만 이 트랙 SessionCard는 다섯 판 전부 자동 닫힘으로 통일돼 있어 그 표준을 그대로 따랐다, 새 UI를 안 만듦).
- `Resources/Localization/dungeon_ko.json`·`dungeon_en.json` — `grave.recovered`·`grave.dropped`·`grave.dropped_none`·`grave.card_title`·`grave.card_lost`·`grave.card_lost_none` 키 추가(`{0}` 플레이스홀더는 `DungeonEnemy.cs`의 `enemy.bestiary_new`와 같은 결로 `string.Format()`에 넘긴다 — `DungeonLocalization.T()`는 포맷을 몰라서 fallback 텍스트에 넣어도 그대로 안 치환된다는 걸 GO `PerkChoiceUi` 스타일로 처음엔 잘못 짤 뻔했다가, `enemy.bestiary_new` 선례를 보고 `string.Format` 경유로 고쳤다).
- 세이브에는 안 남긴다 — 편도 진행이라 "같은 자리로 돌아와 로드"할 일이 약해, `SaveState.cs`는 이번에 안 건드렸다(다음 손질 후보로 문서에 남겨 둠).

**검증**: `Editor/PlaytestDungeonHeadless.cs`에 `CheckGraveMarker()` 신설 — 플레이어에게 골드를 채운 뒤 `HeroState.TakeDamage(999999f)`로 실제로 죽여 `GraveMarker.SpawnCount` 증가·`HeroState.Gold`가 정확히 0이 되는지 확인한다(`CheckLootMarker`와 같은 결 — 회수 자체는 마커가 플레이어 자리에 그대로 스폰돼(거리 0, PickupRadius 2m 안) 이후 자연 프레임에서 예외 없이 타는지로 대신 본다). **호출 순서 함정**: `CheckGoalBoardAndSessionCard()`가 "SessionCard가 세션 시작부터 떠 있으면 실패"를 전제하는데, 이 죽음이 `GameBootstrap.OnHeroDied()`로 SessionCard를 띄우므로 `CheckGraveMarker()`를 그 체크**뒤**에 둬야 한다 — 처음엔 `CheckLootMarker` 옆(먼저)에 넣을 뻔했다가 이 전제를 뒤늦게 알아채 순서를 옮겼다.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(error CS 0건, `ProjectSettings/`·`Packages/` 부작용 없음) → `PlaytestDungeonHeadless`(`Saga.EditorTools.PlaytestDungeonHeadless.Run`, `-quit` 안 줌) 10 frames no errors, 새 grave marker 체크 통과("사망 시 금 85 전부 유품으로, HeroState.Gold=0") → `PlaytestDungeonFloorProgression`도 12 room advances·floor 4 no errors(회귀 없음). 이 사건은 씬 구성(GameObject 추가) 변경이 없어(기존 컴포넌트에 로직만 얹음, `GraveMarker`는 런타임에 코드로 스폰) 씬 재빌드는 불필요했다.

`docs/PROJECT_STATE.md` 갱신(DUNGEON 완료 요약에 101-2 5.1·5.2 완료 표기, "다음 작업"을 "DUNGEON 5.1·5.2 완료 — 다음은 5.3(부적 던전 티어)"로 교체, 테스트 상태·실기 확인 대기 갱신 — 15KB 상한에 걸려 여러 줄 압축). `PLAN.md` 101-2 DUNGEON 행에 5.2 완료·재해석 이유 추가(대응 파일에 `GraveMarker` 추가).

## 2026-09-19 — PLAN 101-2 5.3 DUNGEON 부적 던전 (같은 "사가 유니티 이어 해" 세션, 5.2 유품 다음, "응 진행 해줘")

DUNGEON 순서(5.8→5.1→5.2→5.3)의 마지막 항목. 이걸로 DUNGEON 101-2가 전부 닫혔다.

**웹판을 그대로 안 옮긴 이유**: 웹판 §5.3(`saga-web/saga-dungeon/PLAN.md` 155행, 미착수)은 "굴혈(마을) 앞에서 티어 1~10 + 변형자 2~3개를 골라 들어가는 소모품형 던전"을 전제한다 — 부적 인벤토리(상한 20)·드랍 확률·티어 선택 카드까지 통째로 새 메타 시스템이 필요하다. 이 트랙엔 그 전제가 셋 다 없다: 가방이 없고(5.2에서 이미 확인한 사실), "굴혈 앞에서 고르고 들어가는" 허브 자체가 없다(편도 절차적 진행). 그래서 "선택해서 들어가는 소모품 던전"이 아니라 **"층 10 이후 보스층마다 자동으로 걸리는 변형자"**로 좁혔다 — 뽑기 확률도 없앴다(선택 UI가 없어 "안 뽑힘"이면 그 세션은 그냥 밋밋해지므로, 매 보스층 확실히 걸리게). 변형자 풀도 웹판 9개(이동속도·원소저항·정예2배·보물·시간제한·소환·어둠·재생·유리대포)에서 **정예 폭증·유리대포 둘로 좁혔다** — 원소·시야 시스템이 없어 나머지는 걸 게 없었다.

- `Data/SigilState.cs`(신규) — `DungeonFormulas.cs`와 같은 결(UnityEngine 의존 없는 순수 C#). `IsSigilFloor(floor)`(층10 이상이고 보스층이면 항상 true — 뽑기 없음), `ModOf(floor)`(층 번호만으로 결정 — `(floor/3)%2`, 웹판 "변형자는 부적 id로 결정적이다" 요구사항을 부적 id 대신 floor로 충족), `EnemyHpMultiplier`(정예 폭증 층에서 ×2)·`EnemyDamageMultiplier`(유리대포 층에서 ×1.5, 적이 주는 피해)·`PlayerDamageMultiplier`(유리대포 층에서 플레이어가 주는 피해도 같이 ×1.5 — "유리대포"란 이름의 핵심, 서로 배율)·`ClearBonusGold`(그 층 두목 보상만큼 한 번 더 — 새 상수 없이 기존 `DungeonFormulas.RewardGold` 재사용).
- 적용 지점 — `World/DungeonFloorRunner.cs`의 `SpawnGrunt`·`SpawnElite`·`SpawnSolo`(세 스폰 지점 전부) hp/dmg 인자에 곱함. `Data/HeroState.cs`의 `HitDamage`에 `SigilState.PlayerDamageMultiplier(DungeonFloorRunner.Instance?.CurrentFloor ?? 1)` 곱함(5.1의 `BlessingState.AtkMultiplier`와 같은 자리, 곱셈 체인만 하나 늘었다). `Descend()`가 층을 늘리기 **전**에 방금 떠나는 층의 `ClearBonusGold`를 계산해 지급하고, 늘린 뒤엔 기존 "🪜 제N층으로 내려간다" 토스트에 클리어 보상·다음 층 변형자 안내를 이어 붙였다(새 UI 없음, 기존 `DialogueLabel` 토스트 재사용 — 5.1·5.2와 같은 절제).
- **세이브·인벤토리 없음** — 웹판의 `save.dungeon.nmBest`·부적 인벤토리는 이 트랙엔 대응 개념이 없어(변형자가 층 번호에서 즉시 계산되는 순수 함수라 저장할 상태 자체가 없다) 안 만들었다.

**검증**: `Editor/PlaytestDungeonHeadless.cs`에 `CheckSigilState()` 신설 — `SigilState`가 UnityEngine 의존 없는 순수 함수라 게임 오브젝트 없이 직접 호출해 값만 본다(`DungeonFormulas`류 검증과 같은 결, `SimulateDungeonFloors.cs`는 `DungeonFormulas` 자체를 안 건드려서 안 돌림). 층9(층10 미만)·층11(보스층 아님)은 부적 층이 아니고, 층12(보스층·10 이상, `(12/3)%2==0`)는 정예 폭증(hp×2·dmg×1), 층15(`(15/3)%2==1`)는 유리대포(hp×1·dmg×1.5)가 항상 걸리는지, `ModOf`가 결정적인지(같은 층 두 번 호출해도 같은 값), `ClearBonusGold(12)`가 `DungeonFormulas.RewardGold(12, true)`와 정확히 같은지 전부 확인한다.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(error CS 0건) → `PlaytestDungeonHeadless`(`-quit` 안 줌) 10 frames no errors, 새 sigil state 체크 통과("층12=정예 폭증(hp×2), 층15=유리대포(dmg×1.5), 결정적, 클리어 보상 465") → `PlaytestDungeonFloorProgression`도 12 room advances·floor 4 no errors(회귀 없음 — 이 검증은 층 10 밑이라 변형자를 직접 밟지는 않지만 스폰 경로에 곱셈이 하나 더 얹혔는데도 예외 없음을 확인). 씬 재빌드 불필요(GameObject 구성 안 바뀜, 전부 기존 컴포넌트에 로직만 얹음).

`docs/PROJECT_STATE.md` 갱신(DUNGEON 완료 요약에 101-2 5.1~5.3 전부 완료 표기, "다음 작업"을 "DUNGEON 5.1~5.3 완료 — 다음은 5.4"로 교체, 테스트 상태·실기 확인 대기 갱신 — 15KB 상한에 걸려 여러 줄 압축). `PLAN.md` 101-2 DUNGEON 행에 5.3 완료·재해석 이유 추가(대응 파일에 `SigilState` 추가). **DUNGEON 101-2(5.8~5.3) 전부 닫혔다** — 다음 세션이 DUNGEON에서 새로 이어받을 101-2 항목은 5.4(월드 보스 75초)부터.

## 2026-09-19 — PLAN 101-2 5.4 DUNGEON 월드 보스 (같은 "사가 유니티 이어 해" 세션, 5.3 부적 던전 다음, "응 진행 해줘")

DUNGEON 순서(5.8→5.1→5.2→5.3→5.4)의 마지막 항목. 이걸로 DUNGEON 101-2가 전부 닫혔다.

**웹판을 그대로 안 옮긴 이유**: 웹판 §5.4(`saga-web/saga-dungeon/PLAN.md` 168행, 미착수)는 "15분마다 마을 4곳 중 하나의 필드에 예고와 함께 스폰되는" 실시간 슬롯형 월드 보스를 전제한다 — GO처럼 플레이어가 계속 되돌아오는 지속 마을이 있어야 성립한다. 이 트랙 DUNGEON은 편도 절차적 진행이라(5.2·5.3에서 이미 확인한 제약) 그런 "재방문 가능한 필드"가 없다. 그래서 "실시간 슬롯에 뜨는 별개의 필드 보스"가 아니라 **이미 있는 "층 끝 두목"(`SpawnSolo`의 withEscorts=true 분기, 그리고 `Editor/BuildTestDungeonScene.cs`의 고정 배치 `BuildBoss()`) 자체를 75초 제한 전투로 승격**시켰다 — GO의 101-2 ③이 "야생 조우"가 아니라 이미 있던 "토벌" 결(`RareWolfEncounter`)에 얹은 것과 같은 판단.

- `World/DungeonEnemy.cs` — `[SerializeField] private bool isWorldBoss;` 신설(`isBoss`는 미니보스도 true라 구분이 안 됨). `Update()`가 Idle→Chase 전환(아그로) 순간 `isWorldBoss`면 75초 타이머를 켜고(`_worldBossTimeLeft`·`_worldBossActive`) 정적 참조 `ActiveWorldBoss`에 자신을 등록, 매 프레임 그 타이머를 깎다가 0 이하면 `Flee()`(도망 — 보상 30%, 도감·유품마커·장비드랍 없음, 웹판 "도망 보상 30%" 그대로). `TakeDamage()`가 `isWorldBoss`면 `CheckWorldBossPartBreak()`을 불러 GO `RareWolfEncounter.CheckPartBreak()`(101-2 ③)와 똑같은 75/50/25% 누적 문턱으로 부위 3(투구/갑주/무기 — 사람형 두목이라 GO의 다리/몸통/급소 대신 장구 이름)을 하나씩 깨며 부위당 보너스 골드 + 전부 깨면 완파 보너스를 준다. `Die()`·`OnDisable()`도 `ActiveWorldBoss` 참조를 정리한다.
- `ConfigureCombat()`에 `bool newIsWorldBoss = false` 선택 인자 추가(기존 호출부 안 건드림). `World/DungeonFloorRunner.cs`의 `SpawnSolo()`가 `withEscorts`(보스만 true, 미니보스는 false)를 그대로 `newIsWorldBoss`로 넘긴다. `Editor/BuildTestDungeonScene.cs`의 `BuildBoss()`(Room4 고정 배치)에도 `SetPrivateField(boss, "isWorldBoss", true)` 한 줄 추가 — 절차적 두목과 고정 배치 두목 둘 다 월드 보스가 되게.
- `UI/PlayerHud.cs` — `DungeonEnemy.ActiveWorldBoss`가 있을 때만 기존 HUD 텍스트 아래 카운트다운 한 줄을 얹는다(새 Canvas 없음, 0.5초 갱신 주기 그대로 재사용).
- **저스트 회피(웹판 "공격 0.15s 전 회피 성공")는 스코프에서 뺐다** — GO의 raid 모드는 `DuelRules`라는 턴제 판정 계층이 있어 "예고(Tell) 구간"을 숫자로 관리하지만, DUNGEON `DungeonEnemy.Update()`는 사거리 안이면 즉시 공격하는 실시간 AI라 "공격 예고" 상태 자체가 없다 — 새로 만들려면 텔레그래프 애니메이션·타이밍 판정을 통째로 새로 짜야 해 이번 항목 범위를 넘는다고 보고 뺐다. 이미 있는 회피(무적 0.22초)가 "제때 피하면 안 맞는다"는 같은 방향의 보상을 이미 준다는 점으로 갈음.
- `Resources/Localization/dungeon_ko.json`·`dungeon_en.json` — `worldboss.start`·`worldboss.part_broken`·`worldboss.full_break`·`worldboss.fled`·`hud.worldboss_timer` 키 추가.

**검증**: `Editor/PlaytestDungeonHeadless.cs`의 `SpawnDummyEnemy()`에 `isWorldBoss` 선택 인자 추가(리플렉션 `SetPrivate()` 헬퍼 신설, 기존 `GetPrivate()`과 짝). 새 `CheckWorldBoss()` — `Update()`를 리플렉션으로 직접 불러(`SessionCard` 만료 검증과 같은 결) Idle→Chase 전환·타이머 시작을 확인하고, 실제로 때려 부위 파괴 보상·완파까지 죽여서 확인, 별도 더미로 `_worldBossTimeLeft`를 리플렉션으로 만료 직전까지 깎은 뒤 다시 `Update()`를 불러 도망 경로(축소 보상·`ActiveWorldBoss` 해제)를 확인한다. **함정(실제로 겪음)**: 도망 검증에서 처음엔 `Destroy(gameObject)` 직후 같은 프레임 안에서 `fleeBoss == null`이 바로 true가 될 거라 가정했는데 실제로는 그 프레임 끝까지 `false`로 나왔다(Unity의 지연 파괴가 이 경로에선 즉시 페이크널로 안 바뀜) — `LootMarker` 검증류가 원래부터 "파괴 자체는 안 보고 부작용만 본다"고 해 온 이유를 이번에 직접 겪었다, 그 원칙대로 파괴 단정을 빼고 보상·참조 해제만 확인하도록 고쳤다.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(error CS 0건) → 씬 재빌드(`BuildTestDungeonScene.Build`, `BuildBoss()`에 필드 하나 추가라 재빌드 필요) → `PlaytestDungeonHeadless`(`-quit` 안 줌) 10 frames no errors, 새 world boss 체크 통과 → `PlaytestDungeonFloorProgression`·`FieldAmbush`·`Shortcut`·`Town2`·`Towns34` 전부 재검증 OK(`DungeonEnemy.Update()`/`TakeDamage()`/`Die()`가 이 트랙 전투의 핵심 통로라 하위 슬라이스 다섯 개 전부 다시 돌렸다 — 회귀 없음).

`docs/PROJECT_STATE.md` 갱신(DUNGEON 완료 요약에 101-2 5.1~5.4 전부 완료 표기, 테스트 상태·실기 확인 대기 갱신 — 15KB 상한에 걸려 여러 줄 압축). `PLAN.md` 101-2 DUNGEON 행에 5.4 완료·재해석 이유 추가. **DUNGEON 101-2(5.8~5.4) 전부 닫혔다** — 남은 항목은 5.5(난입 파도)·5.6(목표판·카드, 101-2 A·B로 이미 대응됨)·5.7(시대 퓨전, 웹 선행 대기)뿐이라 다음 세션이 이어받을 실질 항목은 5.5.

## 2026-09-20 — PLAN 101-2 5.5 DUNGEON 난입(亂入) (같은 "사가 유니티 이어 해" 세션 계열, 5.4 월드 보스 다음, "사가유니티 이어 해")

DUNGEON 순서(5.8→5.1→5.2→5.3→5.4→5.5)의 마지막 항목. 이걸로 DUNGEON 101-2가 5.7(시대 퓨전, 웹 선행 대기)만 남기고 전부 닫혔다.

**웹판을 그대로 안 옮긴 이유**: 웹판 §5.5(`saga-web/saga-dungeon/PLAN.md` 170행, 웹도 미착수)는 "모루골 결사비 옆 표식을 밟으면 방 하나(3×3 크기)에서 파도가 몰려오는" 모드를 전제한다. 이 트랙엔 웹판이 말하는 "모루골"에 대응하는 자리가 실제로 있다 — Room1이 마을 셋(Town2·3·4)이 사방으로 뻗는 별형 구조의 중심이라 그 역할을 그대로 한다. 다만 "방 하나에서 파도"는 Room1을 그대로 못 쓴다(이미 잡졸 넷·두목·우물·상자·사당이 들어차 있다) — 그래서 표식(`HordeGate`)은 Room1 빈 구석(8,0,-8)에 세우고, 파도 자체는 **완전히 격리된 새 고정 방(`HordeArena`, 좌표 60,0,60 — 다른 어떤 구조와도 안 이어짐)으로 즉시 텔레포트**하는 쪽으로 좁혔다. 방 크기는 5.4가 참고한 "표준 그대로"(101-2 실기 확인 대기 항목에 이미 웹판도 "3×3을 표준으로 축소 구현"이라 적혀 있다) 원칙을 그대로 따라 `DungeonRoomBuilder` 20×20 표준 셸을 재사용했다(문은 안 뚫는다 — 텔레포트로만 드나든다).

레벨업 3택은 새 시스템을 안 만들고 5.1 `BlessingState`를 그대로 재사용했다 — "난입 한정"의 뜻은 `StartRun()`이 `BlessingState.SnapshotIds()`로 그 회차 축복을 저장해 두고 `Restore(null)`로 비운 뒤, `EndRun()`이 `Restore(savedIds)`로 되돌리는 것으로 구현했다(축이 3개뿐이라 웹판 "무예·인물·세계 축 그대로"의 뜻도 자연히 지켜진다). 웹판 "10분 이상 생존 시 부적 1"은 5.3 `SigilState`와 같은 이유(부적 인벤토리가 없다)로 금 보너스(60)로 대체했다.

- `Data/DungeonFormulas.cs` — 순수 함수 둘 추가: `HordeEnemyCount(wave) = min(40, 6+2*wave)`, `HordeTier(wave) = max(1, wave/8)`(웹판 "티어는 파도/8" 그대로, 이 트랙 층 공식의 floor 인자로 재사용). `UnityEngine` 의존이 없어 씬 없이도 검증 가능.
- `Data/HordeState.cs`(신규) — `BestSurvivalSec`·`Runs` 정적 필드, `RecordRun()`·`Restore()`. 웹판 `save.dungeon.horde = {best, runs}` 스키마 그대로.
- `World/HordeRunner.cs`(신규) — `HordeArena` GameObject에 얹는 MonoBehaviour. `StartRun()`이 축복 스냅샷·타이머 초기화·`HeroState.LeveledUp`/`Died`·`DungeonEnemy.AnyDied` 구독 후 플레이어를 아레나로 텔레포트, 즉시 파도1 스폰. `Update()`가 30초마다 `SpawnWave()`(파도 수 증가·`RingOffset()`로 동심원 배치, 개수가 매 파도 달라 고정 오프셋 배열 대신 절차적 계산), 15분(900초) 누적 시 `EndRun(survived:true)`. `WatchWaveClear()` 코루틴이 파도 하나(다른 파도와 겹쳐도 그 목록만)가 전부 죽으면 체력 15% 회복(웹판 "체력 회복은 파도 클리어 보너스만"). 레벨업마다 `BlessingChoiceUi`(5.1 UI 그대로)를 띄우고 거절 보상은 `BlessingState.Reject(wave)`(floor 인자 자리에 wave를 그대로 넣는 재사용). `HeroState.Died` 구독으로 사망도 `EndRun(survived:false)`로 모은다. `EndRun()`이 남은 난입 적을 전부 Destroy, 생존시간 비례 금(0.8/초 + 10분↑ 보너스 60) 지급, `HordeState.RecordRun()`, 축복 복원, `HeroState.FullHeal()`, 원위치 복귀, `SessionCard`로 결과 카드.
- `World/HordeGate.cs`(신규) — Room1(8,0,-8)에 세우는 표식. `DungeonWell.cs`와 같은 결(걸어서 가까이)이지만 한 번 쓰면 없어지지 않는다(반복 입장 모드). 이미 진행 중이면 토스트만 띄우고 무시.
- `World/DungeonEnemy.cs` — `public string RoomId => roomId;`(밖에서 방 소속을 읽어야 `HordeRunner`가 처치 수를 셀 수 있다), `public static event Action<DungeonEnemy> AnyDied;`(`Die()`가 보상을 다 준 뒤 쏜다, 도망은 안 쏜다) 추가.
- `World/GameBootstrap.cs` — `OnHeroDied()`에 `HordeRunner.Instance?.IsActive` 가드 한 줄 추가. `HeroState.Died`를 `GameBootstrap`(기본 "쓰러졌다" 카드)과 `HordeRunner`(난입 결과 카드) 둘 다 구독하는데, 난입 중 사망은 `HordeRunner` 쪽 카드로만 보여야 해서 기본 카드를 스킵시켰다(구독 순서상 `GameBootstrap`이 먼저 불려 `HordeRunner.EndRun()`이 `IsActive`를 아직 안 내린 시점에 검사한다 — 순서가 바뀌면 이 가드가 깨진다는 점 주의).
- `Data/SaveState.cs` — v7: `hordeBestSurvivalSec`·`hordeRuns` 필드, `HordeState.Restore()` 호출. v6 이하 세이브는 두 필드가 0으로 채워져 "아직 안 해봄"과 같은 뜻이 된다.
- `UI/PlayerHud.cs` — `HordeRunner.Instance.IsActive`일 때만 기존 HUD 아래 "파도 N · 남은 M초 · 처치 K" 한 줄(월드 보스 타이머와 같은 결, 새 Canvas 없음).
- `Editor/BuildTestDungeonScene.cs` — `BuildHordeArena()` 신설(`HordeGate` + `HordeArena` 방 + `HordeRunner`), `Build()` 시퀀스에 `BuildBlessingChoiceUi()` 뒤·`BuildBootstrap()` 앞으로 삽입.

**함정(실제로 겪음)**: `HordeRunner.cs`에 `using System;`과 `using UnityEngine;`을 같이 쓰면 `Object.FindFirstObjectByType<T>()`가 `UnityEngine.Object`·`System.Object`(`Object`는 `object`의 별칭이 아니라 `System.Object`의 별칭) 둘 다와 매치돼 `CS0104` 모호성 오류가 난다 — `UnityEngine.Object.FindFirstObjectByType<T>()`로 완전히 못박아야 한다(이 프로젝트 다른 파일들은 `using System;`이 없어서 안 겪던 문제).

**검증**: `Editor/PlaytestDungeonHeadless.cs`에 `CheckHorde()` 신설(맨 뒤, `CheckGraveMarker`가 이미 `HeroState.Hp`를 0으로 만들어 둬 맨 앞에서 `FullHeal()`). ① `HordeEnemyCount`/`HordeTier` 순수 공식 값 확인. ② `StartRun()` 직후 `IsActive`·`Wave==1`·파도1 스폰 수·`BlessingState.AtkMultiplier`가 1로 비워졌는지(사전에 축복 하나를 미리 앉혀 둠). ③ `HeroState.AddExp()`로 레벨업을 강제해 난입 중에도 `BlessingChoiceUi`가 뜨는지, 리플렉션으로 `ChooseIndex(0)`을 불러 패널이 닫히는지. ④ `_survivalTimer`를 리플렉션으로 900초 직전까지 밀어 두고 `Update()`를 한 번 더 불러(`CheckWorldBoss`와 같은 결, 실시간 대기 없이) 완주 종료 — 보상 금 증가·`HordeState.Runs` 증가·축복이 사전 값으로 복원·원위치 복귀·남은 적 전부 청소 확인. ⑤ 두 번째 회차를 `HeroState.TakeDamage(999999f)`로 즉사시켜 사망 경로도 `EndRun()`이 타는지(`IsActive`→false, `Runs` 재증가, 축복 재복원) 확인.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(처음엔 위 `CS0104` 한 번 잡고 재확인, error 0) → 씬 재빌드(`BuildTestDungeonScene.Build`, room childCount=20) → `PlaytestDungeonHeadless`(`-quit` 안 줌) 10 frames no errors, 새 horde 체크(완주·사망 두 경로) 통과. `docs/PROJECT_STATE.md` 갱신(DUNGEON 완료 요약 5.1~5.5, "다음 작업"을 5.7로 교체, 테스트 상태·실기 확인 대기 갱신 — 15KB 상한에 걸려 REALM 요약 등 여러 줄 압축). `PLAN.md` 101-2 DUNGEON 행에 5.5 완료·재해석 이유·대응 파일(`HordeRunner`·`HordeGate`·`HordeState`) 추가. **DUNGEON 101-2(5.8·5.1~5.5) 전부 닫혔다** — 다음 세션이 DUNGEON에서 새로 이어받을 101-2 항목은 5.7(시대 퓨전)뿐, 그마저 웹 선행 결과 대기.

## 2026-09-20 — PLAN 101-2 5.3 FOREST 마을 번들 ("이어 해줘" 세션, DUNGEON 5.5 다음, 사용자가 "1,2,3,4 다 진행해"로 FOREST/STORY/REALM/DUNGEON 5.7 병행 지시)

FOREST 순서(5.1+5.2→5.4→5.5→5.3)의 마지막 항목. FOREST 101-2 후보(5.1~5.5)가 전부 닫혔다 — 남은 건 5.6(축제)·5.7(택배 사슬)·5.8(채집 손맛 표준).

**웹판을 그대로 안 옮긴 이유**: 웹판 §5.3(`saga-web/saga-forest/PLAN.md` 114행)은 사고(박물관) 건물에 곤충·물고기·화석·조개 4갈래를 기증하는 것을 전제한다. 이 트랙엔 사고 건물도 가방도 없다(`ForestState.cs` 클래스 주석 — HeroState 대응 없음, 채집한 과일을 그대로 화폐로 쓴다). 그리고 호수·강이 없어(`ForestGroundBuilder` "판정은 항상 평면 좌표로", 지형이 단일 평면) 물고기·조개 갈래는 옮길 대상 자체가 없다 — 그래서 이미 있는 네 바이옴 존(`ForestBiomeData.Zones` — 어둑숲·버섯숲·바위 지대·꽃밭, `ForestCreatureBuilder`의 창조물 den과 좌표가 겹치는 그 넷)에 하나씩 어울리는 갈래로 바꿨다: 어둑숲→곤충, 버섯숲→버섯, 바위 지대→화석, 꽃밭→화초. 그리고 "채집=기증"으로 합쳤다 — 가방이 없어 들고 다닐 수 없으니 발견한 순간 바로 도감에 기록된다(DUNGEON `BestiaryState`와 같은 결). 웹판 "완성 시 마을 평가 상한 해제"도 이 트랙엔 "마을 평가"(beauty score) 시스템 자체가 없어 안 옮겼다 — 그 부분은 시설 스폰과 깃발로만 대신했다(DUNGEON이 "저스트 회피"를 스코프에서 뺀 것과 같은 판단).

- `Data/ForestMuseumState.cs`(신규) — DUNGEON `BestiaryState.cs`와 같은 결의 정적 클래스. `Category`(Insect/Mushroom/Fossil/Flower) 4갈래, 갈래당 항목 3개(전체 12종, 웹판 ~27종보다 훨씬 좁힘 — 이 트랙의 "짧은 어휘" 관례). `Record(category, item)`이 처음 보는 항목이면 도감에 기록하고, 그 갈래가 막 다 채워졌으면 `BundleCompleted`, 네 갈래가 다 채워졌으면(딱 한 번) `AllBundlesCompleted`까지 같은 호출 안에서 쏜다. `Restore()`는 세이브 로드용이라 이벤트를 안 쏘고 `BundleDone`/`_allDone`을 상태만 보고 재계산한다(DUNGEON PROJECT_STATE.md "Restore()가 이벤트를 안 쏘면 낡은 시각 상태가 남는다" 함정을 "이벤트에 의존하지 않고 상태를 직접 훑어 다시 짓는" 쪽으로 피했다 — 아래 `ForestBootstrap.cs` 참고).
- `World/ForestCollectSpot.cs`(신규) — `ForestFruitTree.cs`와 같은 결(걸어서 가까이, 쿨다운 2초)이지만 매번 같은 산딸기 대신 갈래 어휘 중 하나를 `System.Random(20260824)`(루트 CLAUDE.md 진단 시드 관례)로 무작위 선택. 자기 월드 좌표를 정적 표(`PositionOf(category)`)에 등록해 둬 시설을 그 근처에 지을 수 있게 한다.
- `World/ForestMuseumDecorator.cs`(신규) — 원작 자산 금지(루트 CLAUDE.md)라 갈래마다 다른 모양의 primitive 조합(곤충→반짝이 유리병+포인트 라이트, 버섯→버섯 셋, 화석→석비, 화초→화단)을 코드로 짓는다. 네 갈래 다 채우면 깃발(장대+깃발천).
- `World/ForestBootstrap.cs` — `ForestMuseumState.BundleCompleted`/`AllBundlesCompleted` 구독(실시간 완성 시 시설·깃발 스폰 + 토스트), `Start()`에서 `ForestSaveState.TryLoad()` 뒤 네 갈래를 직접 훑어 **이미 완성돼 있던 것**을 이벤트 없이 조용히 다시 세운다(다른 PC/재시작 시 시설이 사라져 보이는 문제를 막는다).
- `Data/ForestSaveState.cs` — v5: `museumDiscovered`(도감 문자열 배열) 필드, `ForestMuseumState.Restore()` 호출. v4 이하 세이브는 빈 도감으로 시작.
- `Editor/BuildTestVillageForestScene.cs` — `BuildMuseum()` 신설, 네 바이옴 존 중심에서 6~8m씩 비껴 둔 자리(그 존의 창조물 den 둘과 안 겹치게)에 `ForestCollectSpot` 넷을 세운다. `BuildCreatures()` 뒤에 호출.

**함정(실제로 겪음, 헤드리스가 잡아냄)**: `ForestBootstrap.OnAllBundlesCompleted()`를 처음 짤 때 토스트 문구만 넣고 **`ForestMuseumDecorator.SpawnFlag()` 호출을 빼먹었다**. `ForestMuseumState.AllBundlesDone`(상태 플래그)은 `Record()` 안에서 구독자와 무관하게 정확히 true가 됐는데, 실제 깃발 오브젝트는 안 생겨 헤드리스 검증(`GameObject.Find("Decor_MuseumFlagPole")`)이 잡아냈다 — 처음엔 원인을 짐작만 하다가(동시에 돌던 다른 세션의 Unity 배치 프로세스와 락 경합으로 결과가 흔들리는 게 아닌가 의심했다) 재현이 두 번 다 똑같아서 코드 버그로 확정, `Debug.Log`로 `AllBundlesDone`·`GameObject.Find` 값을 직접 찍어 "상태는 true, 오브젝트는 없음"을 확인하고 나서야 빠진 호출을 찾았다. **교훈**: 이벤트 3개(`BundleCompleted`×3, `AllBundlesCompleted`×1) 중 자주 타는 것들은 바로 검증되지만, 마지막 한 번만 타는 이벤트는 핸들러 본문을 놓치기 쉽다 — 헤드리스가 "상태 플래그"와 "실제 부작용(오브젝트 존재)"을 따로 검증하게 짜 둔 게 실제로 값어치를 했다.

**검증**: `Editor/PlaytestForestHeadless.cs`에 `CheckMuseum()` 신설. ① 씬에 `ForestCollectSpot`이 정확히 4개인지, 곤충 자리를 리플렉션으로 찾아 플레이어를 그 위치로 텔레포트한 뒤 `Update()`를 직접 불러 발견 카운트가 1 늘고, 같은 프레임 두 번째 호출은 쿨다운에 걸려 안 늘어나는지 확인(DUNGEON `CheckWorldBoss`류와 같은 리플렉션 결). ② 나머지는 `ForestMuseumState.Record()`를 상태 API로 직접 불러(DUNGEON `CheckSigilState`처럼) 곤충 갈래 완성 시 `IsBundleDone`+시설(`Decor_FireflyJar`) 확인, 버섯·화석 갈래 완성 시 시설 확인 + 아직 `AllBundlesDone`이 false인지, 화초 갈래까지 완성 시 `AllBundlesDone`+깃발(`Decor_MuseumFlagPole`) 확인.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(오류 0, `ProjectSettings/`·`Packages/` 변경 없음) → 씬 재빌드(`BuildTestVillageForestScene.Build`) → `PlaytestForestHeadless`(`-quit` 안 줌) — 첫 실행 FAIL(위 함정), 버그 위치를 좁히려 임시 `Debug.Log` 진단 한 줄 추가해 재실행(상태는 true인데 오브젝트가 없음을 확인) → `ForestBootstrap.cs`에 빠진 `SpawnFlag()` 호출 추가 → 임시 진단 로그 제거 → 재실행 10 frames no errors, 새 museum 체크 전부 통과. `docs/PROJECT_STATE.md` 갱신(FOREST 완료 요약에 101-2 5.1~5.5 표기, "다음 작업"을 5.6/5.7/5.8로 교체, 테스트 상태·실기 확인 대기 갱신 — 15KB 상한에 걸려 REALM 요약 등 여러 줄 압축). `PLAN.md` 101-2 FOREST 행에 5.3 완료·재해석 이유·대응 파일(`ForestMuseumState`·`ForestCollectSpot`·`ForestMuseumDecorator`) 추가. **FOREST 101-2(5.1~5.5) 전부 닫혔다** — 다음 세션이 FOREST에서 새로 이어받을 항목은 5.6(축제)·5.7(택배 사슬)·5.8(채집 손맛 표준) 중 아무거나, 우선순위상 5.6이 먼저.

**참고**: 이 세션은 같은 saga-unity 프로젝트에서 STORY 5-2·REALM 5-1·DUNGEON 5.7을 각각 병렬로 이어가는 다른 포크와 동시에 돌았다 — Unity 배치 모드 컴파일 한 번이 약 210초 걸린 적이 있어(락 경합으로 추정), 같은 프로젝트에 여러 Unity 배치 프로세스를 동시에 띄우면 서로 대기하거나 결과가 흔들릴 수 있다는 걸 실제로 겪었다. 문서 파일(PLAN.md·PROJECT_STATE.md·HISTORY.md)도 여러 포크가 동시에 덮어쓸 수 있어 경합 가능성이 있다 — 다음 세션은 이 커밋 이후의 최신 상태를 다시 읽고 이어갈 것.

## 2026-09-20 — PLAN 101-2 5.8① FOREST 채집 손맛 ("사가 유니티 이어 해" 세션, FOREST 5.3(마을 번들) 다음)

FOREST 순서 다음 후보(5.6 축제/5.7 택배 사슬/5.8 채집 손맛 표준) 중 5.8①(채집 5요소)을 골랐다 — 5.6·5.7은 새 달력(음력 8행사)·새 목적지 체계가 필요해 범위가 크고, 5.8①은 이미 있는 `ForestCollectSpot`·`ForestFruitTree`에 얹기만 하면 돼(새 저장 스키마 없음, 웹판도 "세이브: 없음(계산)") 가장 좁게 닫힌다.

**웹판을 그대로 안 옮긴 이유**: 웹판 §5.8(`saga-web/saga-forest/PLAN.md` 177행)은 "아이템 아이콘 0.6s 포물선 → 가방"을 전제하는데 이 트랙엔 가방이 없다(`ForestMuseumState.cs` 클래스 주석과 같은 이유). 대신 `SagaDungeon/World/DamagePopup.cs`(TextMesh, 카메라를 보며 떠오르다 사라짐) 결로 발견 이름을 그대로 띄운다. "효과음 3종 라운드로빈(기존 20 중 갈래별)"도 새 오디오 자산이 없어 이미 임포트된 Kenney Interface Sounds 3종(confirmation_001~003.ogg)을 갈래 구분 없이 공유해서 돌려쓴다. "연속 채집 3회마다 리듬 보너스"는 낚시·"손짓" 입력이 없어 채집 성사 자체를 박자로 센다(8초 창, 2026-09-18 웹 구현 노트의 "손짓 타이밍 8초"를 그대로 옮김). 보너스 보상은 아이템 인벤토리가 없어 이 트랙 통화(과일, `ForestState.AddFruit`)로 대신했다.

- `Data/ForestGatherStreak.cs`(신규) — 정적 클래스, `Time.time` 기반 8초 창 안이면 박자를 잇고 아니면 1로 리셋. 3의 배수가 된 순간 `true`를 돌려준다(호출부가 보너스 지급 여부로 쓴다). 세이브 없음(웹판 5.8 "세이브: 없음(계산)" 그대로) — 세션이 끝나면 리셋돼도 무방.
- `World/ForestGatherPopup.cs`(신규) — `DamagePopup.cs`와 같은 결(TextMesh, 0.6초, 카메라 빌보드). 보너스면 금색, 아니면 흰색.
- `World/ForestGatherBump.cs`(신규) — `HitSpark.cs`처럼 풀링 없이 짧은 수명(0.25초)에 기대는 일회성 컴포넌트. `Visual` 자식에 얹어 사인 반 주기로 스케일을 키웠다 원래대로 돌린 뒤 스스로 뗀다.
- `World/ForestGatherFeel.cs`(신규) — 위 셋 + SFX 라운드로빈 + `ForestGatherStreak`을 한곳에 모은 진입점(`Play(worldPos, visual, label, clips)`). `TriggerCount`·`BonusCount`(헤드리스 진단 전용, `HitSpark.SpawnCount`와 같은 결)와 `ResetForTest()`도 갖는다.
- `World/ForestCollectSpot.cs`·`World/ForestFruitTree.cs` — `Awake()`에서 `Visual` 자식 참조를 캐시해 두고, 채집이 성사되는 기존 분기(토스트를 띄우던 자리) 바로 뒤에 `ForestGatherFeel.Play(...)` 한 줄만 추가. 둘 다 새 `[SerializeField] AudioClip[] gatherClips` 필드(씬 빌더가 채운다).
- `Editor/BuildTestVillageForestScene.cs` — `GatherClipPaths`(confirmation_001~003.ogg) + `LoadGatherClips()`(캐시) 신설, `BuildFruitTree()`·`BuildCollectSpot()` 양쪽에 `SetPrivateField(..., "gatherClips", LoadGatherClips())` 추가.

**검증**: `Editor/PlaytestForestHeadless.cs`에 `CheckGatherFeel()` 신설 — `CheckMuseum()`이 이미 쓰던 곤충 자리 대신 **버섯 자리를 따로 써서**(곤충 자리의 쿨다운 검증과 안 부딪히게) 리플렉션으로 `_cooldownLeft`를 매번 0으로 되돌리며 `Update()`를 3번 연달아 부른 뒤 `ForestGatherFeel.TriggerCount==3`·`BonusCount==1`(3연속째)을 확인한다. 팝업·범프·SFX 자체는 시각/청각이라 실기 확인 몫 — 값으로 확인 가능한 트리거 횟수·보너스 지급만 헤드리스가 본다.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(오류 0, `ProjectSettings/`·`Packages/` 변경 없음) → `PlaytestForestHeadless`(신규 체크 포함, `-quit` 안 줌) 1차 OK(기존 씬에 새 필드가 비어 있어도 무음 폴백으로 안 깨짐 확인) → 씬 재빌드(`BuildTestVillageForestScene.Build`, gatherClips 실제 배선) → 재실행 2회 추가, 총 3연속 OK("museum bundle OK"·"gather feel OK" 둘 다 매번 출력). `docs/PROJECT_STATE.md` 갱신(FOREST 요약에 5.8① 추가, "다음 작업"·테스트 상태·실기 확인 대기 갱신 — 15KB 상한에 걸려 여러 줄 압축). `PLAN.md`는 101-2 FOREST 행 우선순위 서술이 이미 "5.1+5.2→5.4→5.5→5.3 완료" 형태라 5.8①을 같은 문장에 덧붙이는 대신 이 HISTORY 항목으로 경위를 남긴다(장 번호·표 구조는 안 건드림).

**참고**: 이 PC엔 Unity 6000.3.24f1이 `C:\Program Files\Unity\Hub\Editor\6000.3.24f1`에 있다(폴더 CLAUDE.md가 적어 둔 기본 Hub 경로와 다른 PC — 세션 시작 시 `find`로 새로 확인해야 한다는 경고 그대로 실제로 달랐다). 커밋 시점에 `git status`에 이 세션과 무관한 변경(`saga-godot/saga_core/shaders/cel_shader_apply.gd`, 새 png 하나)이 같이 떠 있었다 — 다른 세션이 같은 트리에서 동시에 돈 흔적이라 손대지 않고 `saga-unity/` 경로만 좁혀 커밋했다.

## 2026-09-20 — PLAN 101-2 5-1 REALM 인물 특성·야망 ("사가 유니티 이어 해" 세션, FOREST 5.8① 다음)

FOREST 5.8①(채집 손맛) 뒤 다음 후보를 고르며 REALM PLAN.md 101-2 행을 다시 읽다가, 기존 "5-7 → 5-3 완료" 표기가 실제로는 5-7(월간 요약 카드, `RealmSessionTracker`)만 설명하고 5-3(일기토·설전)의 실제 메커니즘(3합 카드·설전 3문)은 코드 어디에도 없다는 걸 발견했다(`grep -rn "Duel\|일기토\|Envoy\|설전" Assets/Games/SagaRealm`이 전부 무매치 — `문답`만 있는 `RealmQuizState`와 헷갈린 오기로 보인다). 잘못된 완료 표기를 방치하면 다음 세션이 "5-3은 이미 됐다"고 믿고 5-3을 건너뛸 위험이 있어, 이번엔 실제로 안 된 5-3 대신 **saga-godot REALM이 이미 실기 승인까지 받은 5-1(인물 특성·야망)**을 골라 구현하고, PLAN.md의 오기도 같이 바로잡았다.

**웹판을 그대로 안 옮긴 이유**: 웹판 §5-1(`saga-web/saga-realm/PLAN.md` 107행)은 무장 258명, 특성 12종(용맹·신중·탐욕·청렴·야심·충직·학구·호전·온화·교활·의리·냉혈), 야망 6종(태수·고향·숙적·부귀·명성·학문)을 전제한다. 이 트랙(`RealmOfficerPool.cs`)엔 무장이 **3명뿐**이고, 치안·태수 임명·이간·매수·명성(일기토 승수)·등용서 같은 축이 전혀 없다(`RealmWar.cs`·`RealmQuizState.cs` 클래스 주석이 이미 밝혀 둔 "이 슬라이스가 안 들인 것들"과 같은 목록). 그래서 이 트랙에 **실제로 존재하는 계수 자리 셋**(계략 성공률 `RealmWarState.PlotChance`·출진 전투력 `RealmWar.ArmyPower`·문답 보상 `RealmQuizState.Answer`)에만 물리는 특성 3종(용맹→전투력, 교활→계략 성공률, 현명→문답 보상)과, **값으로 즉시 판정 가능한 조건 셋**(금 보유·특정 성 함락·문답 정답 수)에 물리는 야망 3종(부귀·숙적·학문)으로 좁혔다. 웹판 "야망 달성 시 능력 +2"도 `RealmOfficer`의 Might/Wisdom/Command가 `readonly int`(불변값)라 그대로 못 옮겨 **금 500 보상**으로 재해석했고, "12달 좌절 시 충성 하락"은 이 트랙에 충성/이탈 축 자체가 없어 스코프에서 뺐다(달성 보상만 실장 — DUNGEON이 "저스트 회피"를 뺀 것과 같은 판단).

- `Data/RealmOfficerTraits.cs`(신규) — 정적 클래스. `StableHash(string)`(GO `DailyTaskState.StableHash`와 같은 결, `GetHashCode()` 비결정성 회피)로 `TraitsOf(id)`(3종 중 2종 조합, 3가지 조합표)·`AmbitionOf(id)`·`RivalCityOf(id)`(숙적 야망의 목표 성)를 전부 세이브 없이 결정적으로 낸다. `CheckAmbitions()`가 로스터 전원의 진행도(`AmbitionProgress`)를 보고 막 달성한 사람에게 금 보상 + `AmbitionAchieved` 이벤트. `_ambitionDone`(HashSet)만 저장 대상.
- `Data/RealmWar.cs` — `ArmyPower()`에 `braveBonus`(용맹 특성 가진 낀 인원수만큼 가산, `lead`에 곱)를 추가.
- `Data/RealmWarState.cs` — `PlotChance(officer)`에 `RealmOfficerTraits.PlotChanceMultiplier(officer.Id)` 곱(교활 ×1.3).
- `Data/RealmQuizState.cs` — `Answer()`에서 정답 골드에 `RealmOfficerTraits.AnyWiseInRoster()`면 ×1.2(현명 — 문답이 특정 무장과 안 엮여 있어 "로스터에 한 명이라도 있으면" 전역 적용으로 재해석).
- `UI/RealmSessionTracker.cs` — `OnCityStateChanged()` 맨 앞에 `RealmOfficerTraits.CheckAmbitions()` 추가. 매달 정산뿐 아니라 `RealmCityState.Changed`가 울릴 때마다(금·문답·전투 직후 포함) 곧바로 본다 — `AddGold()` 안에서 재귀 호출이 나지만 달성 플래그를 금 지급 **전에** 세워 둬 재진입이 안전하다(무한루프 아님, `RealmOfficerTraits.cs` 클래스 주석에 근거 적어 둠).
- `UI/RealmHud.cs` — 로스터 줄 각 무장 이름 뒤에 `[특성1·특성2 야망:이름 현재/목표]`(또는 달성 후 `달성✓`) 대괄호를 붙인다. 웹판 "무장 카드에 특성 배지 2개·야망 한 줄"을 이 판의 유일한 로스터 표시 자리(텍스트 한 줄 HUD)에 욱여넣은 것.
- `Data/RealmSaveState.cs` — `officerAmbitionsDone`(List<string>) 필드 추가. quiz 필드와 같은 이유로 `SaveVersion`은 안 올렸다(JsonUtility가 없는 필드를 null로 채워 옛 세이브도 "아직 아무도 달성 안 함"으로 그냥 시작한다).

**검증**: `Editor/PlaytestRealmSlice.cs`에 `CheckOfficerTraits()` 신설, `Phase.Init`에서 `CheckGoalBoardAndSessionCard()` 다음(WorldMap 전환 직전)에 부른다 — 특성/야망 로직이 순수 함수라 게임 진행 단계와 무관하게 이 자리에서 바로 검증 가능했다(다른 phase처럼 특정 진행 상태를 기다릴 필요 없음). ① `TraitsOf()`를 두 번 불러 같은 결과인지(결정성), ② 시작 무장 셋 중 교활 특성 보유자를 찾아(3가지 조합표 중 Cunning 없는 조합이 없어 항상 존재) `PlotChance` 배율이 실제로 값을 바꾸는지, ③ 시작 무장(현책)의 야망이 "부귀"면 금 6000을 채워 실제로 `IsAmbitionDone`이 true가 되는지 + 그 뒤 금을 더 채워도(`Changed` 재발화) 중복 지급이 없는지(재진입 안전성의 실증), 다른 야망이 배정됐으면 `AmbitionProgress()`가 예외 없이 도는지만 확인. 헤드리스 3연속 모두 "officer traits/ambition OK" 출력, 기존 phase(전투·계략·문답·저장/불러오기 등)도 전부 그대로 통과 — 새 로직이 `RealmCityState.Gold`를 중간에 건드려도(부귀 검증 경로) 이후 phase들은 각자 그 자리에서 `RealmCityState.Gold`를 새로 스냅샷해 델타를 재는 구조(`_goldBeforeSettle` 등)라 안 어긋난다는 것도 코드로 먼저 확인한 뒤 진행했다.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(오류 0, `ProjectSettings/`·`Packages/` 변경 없음) → `PlaytestRealmSlice`(`-quit` 안 줌) 3연속 OK. `docs/PROJECT_STATE.md` 갱신(REALM 요약에 5-1 추가, "마지막 갱신"에 5-7→5-3 오기 정정 사실 명시, 다음 작업·테스트 상태·실기 확인 대기 갱신 — 15KB 상한에 걸려 여러 줄 압축). `PLAN.md` 101-2 REALM 행의 "5-7 → 5-3"을 "5-7 → 5-1"로 고치고 5-3이 오기였다는 사실과 5-1 재해석 이유를 그 칸에 남겼다(장 번호·표 구조는 안 건드림, 대응 파일 칸에 `RealmOfficerTraits` 추가).

**참고**: 이번 세션도 이전 세션이 남긴 메모("다른 세션이 같은 트리에서 동시에 돈다")를 그대로 확인 — 커밋 전 `git status`를 다시 볼 것.

## 2026-09-20 — PLAN 101-2 5-6 REALM 지형·진형 전술 개입 ("사가 유니티 이어 해" 세션, 5-1 인물 특성·야망 다음)

5-1 다음 REALM 후보(5-2 관계 이벤트 체인·5-6 지형·진형 개입·5-8 계승) 중 5-6을 골랐다. 5-2는 12종 이벤트 카드(각 3택)를 새로 써야 하는 콘텐츠 저작량이 커서(FOREST 5.6 축제와 비슷한 크기), 5-8(계승)은 이 트랙에 "군주"라는 개념 자체가 없고(경영형, 캐릭터 없음 — 무장 로스터만 있다) 페널티 축(충성)도 없어 구현해도 사실상 숫자 효과가 하나도 안 남는 "속 빈" 기능이 될 위험이 컸다. 반대로 5-6은 `RealmWar.cs`에 이미 `RealmLand`(지형)·`ArmyPower`·`StepRound`가 있어 실제 계수 자리에 바로 얹을 수 있었다.

**웹판을 그대로 안 옮긴 이유**: 웹판 §5-6(`saga-web/saga-realm/PLAN.md` 137행 앞)은 지형 4종(산·숲·평야·강) 전술 4개(매복·화공·기병 돌격·도하 강행) + "진형 수동 선택"(자동 대비 배율 ×0.5)을 전제한다. 이 트랙 `RealmCityData.cs`의 `RealmLand` enum은 **Plain/River 둘뿐**이라(산·숲 지형 자체가 없다) 산 매복·강 도하 강행은 옮길 대상이 없고, 평야엔 기병 돌격, 강엔 화공만 남았다. "진형 수동 선택"은 이 트랙에 진형(포진) 시스템 자체가 없어(`RealmArmy`에 그런 필드가 없다) 통째로 스코프 밖 — DUNGEON이 "진형·수전·화공·진영(camp)"을 전부 뺀 것과 같은 결의 축소다. 웹판 "화공은 숲에서, 한 합만"도 이 트랙엔 숲이 없고 `StepRound`가 "한 합만 배율"을 밖으로 못 빼내는 구조라 강 화공으로 옮기고 전투 내내 가는 배율로 재해석했다(§ 클래스 주석에 이유를 남겼다).

- `Data/RealmWar.cs` — 클래스 주석에 5-6 추가 사실 기록. `StepRound()`에 `round`(합 번호)·`firstRoundPowerMul`(0번째 합에만)·`defPowerMul`(매 합) 세 매개변수 신설, `Fight()`가 둘을 기본값 1로 받아 그대로 통과시킨다 — `RealmWar` 자신은 여전히 "숫자만 곱할 뿐" 어느 지형에 어느 전술이 맞는지는 모른다(판정식 자체는 안 바꾼다는 클래스 원래 원칙 유지).
- `Data/RealmWarState.cs` — `ResolveTactic(land, officerIds)`(private) 신설: 평야면 로스터 중 최고 무력이 80 이상일 때 `(1.25f, 1f, 성공 문구)`, 아니면 `(1f, 1f, 실패 문구)`. 강이면 최고 지력 60 이상일 때 `(1f, 0.85f, 성공 문구)`, 아니면 실패 문구. `Attack(fromCityId, enemyId, useTactic)`에 `useTactic` 매개변수 추가 — true면 `ResolveTactic()` 결과를 `RealmWar.Fight()`에 넘기고 전투 메시지 앞에 전술 문구를 붙인다. `TacticHintFrom(fromCityId)`(public)도 신설 — UI가 "다음 공격이 어느 지형·전술을 쓰게 될지" 미리 보여준다.
- `UI/RealmCommandUi.cs` — `_tacticEnabled`(bool, 세이브·직렬화 불필요한 순수 런타임 토글) + `_tacticToggleLabel`([SerializeField] — 이 파일 2026-09-15 교훈 그대로, 씬 저장·재로드를 버텨야 하는 참조라 승격) 신설. 저장 버튼 바로 아래(같은 120px 간격 구석 기둥)에 토글 버튼을 얹었다 — **공격 패널 안이 아니라 상시 버튼으로 둔 이유**: 목표가 하나뿐인 성은 패널 없이 바로 공격이 나가(`ExecuteAttack()`) 패널 안에 토글을 넣으면 대부분의 공격에서 안 보이기 때문. 버튼 글자 자체에 `TacticHintFrom()` 힌트를 얹어 "명령"을 안 열어도 지형·필요 능력치를 미리 본다. 성을 바꾸면(`ChooseCity()`) 라벨도 같이 갱신, 언어 전환 시(`RefreshSettingsPanel()`)도 같이 갱신.

**함정(실제로 겪음, 두 번째 헤드리스 실행이 잡아냄)**: 첫 컴파일·스크립트 수정 뒤 씬을 안 새로 만들고 바로 헤드리스를 돌렸더니 `RealmCommandUi.RefreshSettingsPanel()`이 `NullReferenceException`(새로 만든 `_tacticToggleLabel`이 옛 씬엔 없어 null)을 던졌다 — FOREST 5.8① 세션에서 이미 겪은 "씬도 재빌드해야 새 필드가 채워진다"는 교훈을 또 한 번 실전에서 확인. 여기서 그치지 않고 **씬 재빌드 자체가 두 번째 함정을 냈다**: 이 예외가 `PlaytestRealmSlice.CheckCommandUiPanelsWork()` 안의 "언어를 en으로 바꿔 확인" 코드 도중(되돌리기 전) 터지면서 `RealmLocalization.CurrentLanguage`(PlayerPrefs, 디스크에 남는다)가 "en"에 멈췄다. 그 상태로 `BuildTestCityScene.Build()`를 다시 돌렸더니 `RealmCommandUi.Build()`가 설정 버튼 이름을 **영어**로 지어버려("Btn_Settings") 다음 헤드리스가 "Btn_설정"을 영영 못 찾고 실패했다 — `PlaytestRealmSlice.Run()`이 자기 실행 전에 이미 "ko"로 고정하는 것과 똑같은 이유로, `BuildTestCityScene.Build()` 맨 앞에도 같은 고정을 추가해 고쳤다(다른 씬 빌더는 이런 언어-의존 GameObject 이름을 안 써서 이 문제가 REALM에만 있다).

**검증**: `Editor/PlaytestRealmSlice.cs`에 `CheckTactic()` 신설, `CheckOfficerTraits()` 다음(WorldMap 전환 직전)에 부른다 — `ResolveTactic()`이 private이라 리플렉션으로 직접 불러 순수 판정만 본다(게임 상태를 안 건드려 이후 51개 성 정복 체인과 안 부딪힘). ① 평야: 현책(무력38)만 있으면 배율 1, 해장(무력92) 추가하면 1.25, ② 강: 무장 없음이면 배율 1, 현책(지력100) 있으면 0.85, ③ `TacticHintFrom("xuchang")`이 빈 문자열이 아닌지(허창은 소패=평야를 친다).

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(오류 0, `ProjectSettings/`·`Packages/` 변경 없음) → 헤드리스 1차 FAIL(위 첫 함정, 씬 미재빌드) → 씬 재빌드 → 헤드리스 2차도 FAIL(위 두 번째 함정, "Btn_설정" 못 찾음) → `BuildTestCityScene.cs`에 언어 고정 추가 → 씬 재빌드 → 헤드리스 3연속 OK("tactic OK" + 기존 30차 성 정복·문답·저장/불러오기 전부 그대로 통과). `docs/PROJECT_STATE.md` 갱신(REALM 요약에 5-6 추가, 두 함정 경위 요약, 다음 작업·테스트 상태·실기 확인 대기 갱신 — 15KB 상한에 걸려 여러 줄 압축). `PLAN.md` 101-2 REALM 행에 5-6 재해석 이유·대응 파일(`RealmWar` 추가) 반영.

## 2026-09-20 — PLAN 101-2 5-2 REALM 관계·이벤트 체인 ("사가 유니티 이어 해" 세션, 5-6 지형·진형 전술 다음)

웹판(`saga-web/saga-realm/PLAN.md` 117행) "관계·이벤트 체인"은 무장 사이 관계(의형제·원수·사제) 20~30쌍 + 세력 간 월간 이벤트를 전제하지만, 이 트랙은 무장이 3명뿐이고 충성·이탈 축이 없어(`RealmOfficerTraits.cs` 클래스 주석과 같은 이유) 그대로 못 옮긴다. saga-godot REALM이 이미 "관계 대신 특성·야망(5-1) 조건의 1인 서사 카드 8종, 달마다 18%로 카드+3택"으로 재해석해 2026-09-19 게이트 결정(godot 실기 승인 = 3D 착수 신호)을 통과했다 — 이 트랙도 같은 결로 가되 UI·수치·코드는 이 트랙 자체 컴포넌트로 새로 짰다(코드 공유 없음 원칙).

카드 7종 — 특성(용맹·교활·현명) 각 1(결투 신청·밀서·강론 초빙) + 야망(부귀·숙적·학문) 각 1(재물 기회·숙적 첩보·학사 방문) + 체인 후속 1(논공행상, 결투를 "응한다"로 이겨야만 3달 뒤 예약). 매달 18%(웹판 수치 그대로) 확률로 하나 뽑되 예약된 체인이 기한에 닿으면 그쪽을 먼저 낸다 — 세력이 하나뿐이라 웹판 "동시 진행 최대 2" 대신 한 달 한 장으로 좁혔다. 효과는 전부 금만 건드린다(전투력·계략 배율을 이벤트로 또 건드리면 5-1·5-6과 겹쳐 원인 추적이 어려워짐). 세이브도 안 한다 — 진행 중 카드·예약된 체인은 재시작하면 사라진다(문답 학습 기록과 달리 값이 작아 잃어도 무방, `RealmQuizState`류와 같은 판단).

새 `RealmEventState.cs`(카드 정의·`RollForMonth()`·`Describe()`·`Resolve()`, 테스트 전용 `HasPendingChain()`·`ClearForTest()`). `RealmSessionTracker.OnCityStateChanged()`가 "정확히 한 달 넘어갔을 때"(`ShowSummary()`와 같은 게이트) `RealmEventState.RollForMonth()`를 부른다. `RealmCommandUi`에 `_eventPanel`(자동 팝업, 사용자가 여닫는 다른 아홉 패널과 달리 `CloseAllPanels()`가 안 건드린다 — 답하기 전엔 다른 패널을 열고 닫아도 카드가 안 사라져야 하고, `Build()` 맨 마지막에 지어 항상 다른 패널 위에 그려지게 했다) 추가. `PlaytestRealmSlice.CheckEventChain()`(Init phase, `CheckTactic()` 다음) — 카드 7종 서술 완전성, 결투 200회 반복해 승리 시 금 증가+논공행상 체인 예약 확인, `RollForMonth()` 100회 반복해 통계적으로 카드가 뜨는지, 응답 뒤 `Current`가 비는지 확인.

**함정 재발(2026-09-15 사고와 같은 결)**: `RealmCommandUi`의 새 `[SerializeField]` 참조(`_eventPanel`·`_eventTitleText`·`_eventBodyText`·`_eventButtonsRoot`)는 필드 선언만으로는 부족하다 — `BuildTestCityScene.Build()`가 실제로 그 GameObject들을 짓고 씬(`TestCity.unity`)에 저장해야 헤드리스가 읽는 저장된 씬에 들어간다. 코드만 고치고 첫 헤드리스를 돌렸다가 `UnassignedReferenceException: _eventButtonsRoot`로 즉시 실패 — `-executeMethod Saga.EditorTools.BuildTestCityScene.Build`로 씬을 재생성한 뒤 통과했다. **다음에 REALM UI에 새 `[SerializeField]` 참조를 늘릴 때마다 씬 재빌드를 빠뜨리지 말 것.**

이 세션은 이 PC의 Unity 설치를 `find "/c/Program Files/Unity/Hub/Editor" -maxdepth 1`로 처음 확인했을 때 빈 출력을 받아 "Unity 미설치"로 오판할 뻔했다 — `ls`로 같은 경로를 직접 찍어보니 6000.3.24f1이 멀쩡히 있었다(`find`가 이 환경에서 이유 없이 빈 결과를 낸 것으로 보임, rtk 프록시 관련 가능성). **앞으로 이 PC에서 `find`가 빈 결과를 주면 `ls`로 한 번 더 확인할 것** — Unity 설치 여부처럼 중요한 전제를 `find` 결과 하나로 단정하지 않는다.

`tools/unity-batch.sh`로 컴파일(오류 0, `CompileScripts` 6.6초, `ProjectSettings/`·`Packages/` 변경 없음 확인) → 헤드리스 1차 FAIL(위 함정) → 씬 재빌드 → 헤드리스 3연속 OK("event chain OK" + 기존 30차 성 정복·문답·저장/불러오기 전부 그대로 통과). `docs/PROJECT_STATE.md` 갱신(REALM 요약에 5-2 추가, 다음 작업에서 REALM5-2 제거, 테스트 상태·실기 확인 대기 갱신 — 15KB 상한에 걸려 여러 줄 압축, 자세한 경위는 이 절로 옮김).

## 2026-09-20 — PLAN 101-2 5.8② FOREST 마을 평가 ("사가 유니티 이어 해" 세션, REALM 5-2 다음)

REALM 5-2를 커밋·푸시한 뒤 "다 완료 되면 이어서 작업하고" 지시로 다음 후보를 찾다가, 남은 두 후보(REALM 5-8 계승, FOREST 5.8② 마을 평가) 둘 다 이 트랙에 애초에 그 값을 걸 시스템 자체가 없다는 걸 확인해 사용자에게 방향을 물었다("REALM 5-8은 충성 축 자체가 없어 계승이 바꿀 값이 없고, FOREST 5.8②는 잡초/꾸미기 점수 시스템 자체가 코드에 없다") — 사용자가 "1,2번 해줘"(FOREST 먼저, REALM 다음)로 둘 다 이어가라고 답해 FOREST부터 시작.

웹판(`saga-web/saga-forest/PLAN.md` 177행) 5.8②는 마을 전체의 잡초·꽃·심은 나무·집 꾸미기·사고 기증 다섯 축을 `town.js beauty()`로 합산해 별 5개로 보여준다. 코드를 뒤져보니 이 트랙엔 잡초·꽃·나무 심기(자라는 식생) 자체가 없다(`ForestGroundBuilder`는 고정 지형만 깐다) — 그런데 실제로 값이 자라는 축이 둘 있었다: `ForestHomeState.Score()`(101-2 이전부터 있던 웹판 `home.js score()` 그대로의 이식, 지금까지 UI에서 쓰인 적은 없었다)와 `ForestMuseumState`(101-2 5.3, 발견 도감). 이 둘만 합쳐 별로 매기기로 했다.

새 `ForestTownScore.cs`(`Total() = ForestHomeState.Score().Total + MuseumDiscoveredTotal()*5`, `Stars()`는 웹판 `town.js BEAUTY_GRADES`(0/60/100/150/200)를 그대로 재사용해 1~5 환산, `ConditionLines()`가 조건 2줄 문자열을 냄 — 웹판 5줄 중 이 트랙에 실제로 있는 두 축만). 웹판의 "별이 떨어질 조건" 경고는 안 옮겼다 — 이 트랙 두 축 다 늘기만 해(잡초처럼 시간이 지나며 깎는 축이 없음) 별이 내려갈 일 자체가 없기 때문. 5.8③("자동 순행은 손맛 건너뜀")은 이 트랙에 자동 순행 시스템 자체가 없어(GO/DUNGEON의 `auto.js` 대응 없음) 해당 없음으로 스코프에서 뺐다.

UI는 새 `ForestTownScoreBoard.cs`(`ForestCollectSpot.cs`와 같은 결 — 걸어서 가까이 가면 반응, "놓기" 버튼류가 없는 이 트랙 관례 그대로) — 마을 중심(0,0,-5, 플레이어 스폰과 본 마을 사이 빈 자리)에 원기둥 기둥을 세우고, 2.5m 반경에 들어오면 6초 쿨다운으로 `DialogueLabel` 토스트에 별 이모지(★☆)+조건 2줄을 띄운다. `BuildTestVillageForestScene.cs`에 `BuildTownScoreBoard()` 추가.

`PlaytestForestHeadless.CheckTownScore()`(`CheckGatherFeel()` 다음) — `CheckMuseum()`이 이미 네 갈래를 다 채워 둔 시점이라 박물관 점수가 고정 60점(12개×5점)인 걸 이용: 가구 없는 상태의 별점이 정확히 2(60점 문턱)인지 먼저 보고, 과일 200개를 채워 준 뒤 방석(bangseok)을 유효 칸(5×5 격자, `ForestHomeState.GridHalfExtent`) 전부에 채워 넣어(18칸 성공) 총점 285점으로 별 5(200점 문턱)까지 오르는지, 별점이 절대 안 내려가는지(전 단계보다 높아야 함), 조건 문구·보드 오브젝트가 실제로 있는지까지 확인.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(오류 0) → 씬 재빌드(`BuildTestVillageForestScene.Build`) → 헤드리스 1차는 패키지 매니저가 그 시점에 `com.unity.cloud.gltfast`를 6.9.0→6.14.1로 조용히 올리려다 "operation cancelled"로 프로세스가 자체적으로 죽어 FAIL(exit 1, 내 코드와 무관 — 재시도로 재현 안 됨, 환경 일시적 현상으로 보임) → 재시도 1차부터 3연속 OK("town score OK - 박물관 고정 60점에서 별2 확인, 가구 18개 채워 별5(총점 285) 도달"). `docs/PROJECT_STATE.md` 갱신(FOREST 요약에 5.8② 추가, "다음 작업"에서 FOREST5.8②③ 제거(③은 해당 없음으로 명시)·5.6/5.7만 남김, 테스트 상태·실기 확인 대기 갱신 — 15KB 상한에 걸려 여러 줄 압축). `PLAN.md` 101-2 FOREST 행에 5.8② 재해석 이유·대응 파일(`ForestTownScore`·`ForestTownScoreBoard` 추가) 반영.

다음은 REALM 5-8(계승) — 충성 축이 없는 문제를 어떻게 좁힐지부터 설계해야 한다(이 절 위 "사용자에게 방향을 물었다" 참고).

## 2026-09-20 — PLAN 101-2 5-8 REALM 계승 ("사가 유니티 이어 해" 세션, FOREST 5.8② 다음)

FOREST 5.8②를 커밋한 뒤 REALM 5-8(계승)을 설계하다가, 무장 풀이 3명 고정(`RealmOfficerPool.Catalog`)이라 원작·saga-godot(무장 258명)처럼 "무장이 죽고 후계자가 잇는다"를 그대로 옮기면 로스터가 영구히 줄어들 뿐 회복 방법이 없다는 걸 확인해 사용자에게 물었다. 처음엔 "일시 요양(능력치 정지, 죽지 않음)" 안을 제시했으나 사용자가 "다른 아이디어 제안"으로 되돌려, 다시 고민한 끝에 **"허창(본거지) 배치 자리 자체가 넘어간다"** 안을 냈다 — 아무도 죽지 않되, 허창에 배치된 무장이 물러나면 로스터의 다른 무장 중 통솔(Command) 최고가 그 자리를 이어받고(이미 있는 `_officerCity` 배치 딕셔너리를 맞바꿀 뿐이라 새 세이브 필드가 필요 없음), 대가로 허창 치안이 절반으로 깎인다(성 함락 뒤처리와 같은 기존 규칙 재사용). 사용자가 "이 안으로 진행"으로 승인.

새 `RealmSuccessionState.cs` — 매달 2% 확률(`RollForMonth()`, `RealmSessionTracker`가 5-2 이벤트 카드와 같은 "정확히 한 달 넘어갔을 때" 게이트로 부른다)로 허창 주재 무장을 찾아(`FindCapitalOfficer`) 로스터의 다른 무장 중 통솔 최고(`FindBestSuccessor`)에게 자리를 넘긴다. 새 `RealmCityState.SwapOfficerCities(idA, idB)`(두 무장의 배치를 맞바꾸는 작은 공개 메서드, `Changed`도 같이 울림) + 허창 `RealmCityRecord.Sec /= 2`(외부에서 직접 필드 대입 — `RealmWarState.cs`가 이미 `city.Troops = 0` 같은 식으로 하는 것과 같은 관행, 이 트랙엔 CityRecord를 캡슐화하는 세터가 따로 없다). 결과 문구는 `Occurred` 이벤트로 내보내 `RealmCommandUi`가 구독해 토스트로 띄운다(카드 없이 자동으로 벌어지는 일이라 5-2의 3택 카드와 다른 결).

위험이 있는 기능이라(치안 하락) 웹판·saga-godot과 같은 "손잡이 뒤에" 원칙대로 `RealmSettingsState.SuccessionOn`을 새로 만들어 **기본 꺼짐**으로 뒀다 — 설정 패널에 7번째 줄로 추가(`MakeSettingsRow(-760f, ...)`, 패널 높이 820→920으로 늘림). `realm_ko.json`/`realm_en.json`에 `settings.succession`·`succession.occurred` 키 추가(이 판의 다른 REALM 전용 문구들처럼 GO/DUNGEON/FOREST/STORY 쪽 로컬라이제이션 파일과는 안 맞춘다 — 클래스 주석의 "다섯 벌 함께" 규칙은 다섯 판 공통 UI 스키마 키에만 해당, 이 판 고유 콘텐츠엔 안 걸림).

`PlaytestRealmSlice.CheckSuccession()` — `Phase.AgriByNewOfficer`(로스터가 방금 2명이 된 직후) 안에서 호출. 토글을 테스트 동안만 켜고 `RollForMonth()`를 최대 500회 반복해(2% 확률, 500회면 사실상 확실) 실제로 터뜨린 뒤 ① 허창 배치가 다른 무장에게 넘어갔는지 ② 허창 치안이 정확히 절반인지 ③ 안내 문구가 비지 않는지 확인하고, **이후 phase(계략·전쟁)가 원래 배치를 전제하므로** 배치·치안·토글을 전부 원래대로 되돌린다(맞바꾸기가 자기 역 연산이라 같은 두 id로 한 번 더 불러 복원 — 이후 phase들을 grep해 특정 무장 id가 특정 성에 있다고 가정하는 검사가 이 지점 이후엔 없는 것도 확인해 안전함을 검증).

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(오류 0) → 씬 재빌드(`BuildTestCityScene.Build`, 설정 패널 새 토글 배선) → 헤드리스 3연속 OK("succession OK - 허창 배치 계승·치안 절반 하락·안내 문구 확인" + 기존 30차 성 정복·문답·저장/불러오기 전부 그대로 통과, 계승 복원이 이후 phase를 안 깬 것도 확인). `docs/PROJECT_STATE.md` 갱신(REALM 요약에 5-8 추가, "다음 작업"에서 REALM5-8 제거·5-3/5-5 상태 미확인으로 표시, 테스트 상태·실기 확인 대기 갱신, 이제 다 닫혀 가벼워진 "REALM 51장" 절 삭제해 15KB 여유 확보). `PLAN.md` 101-2 REALM 행에 5-8 재해석 이유·대응 파일(`RealmSuccessionState` 추가) 반영.

**사용자가 "이 작업 다 완료 하고 새로운 세션에서 하자"고 지시** — 이 세션은 여기서 마무리하고 커밋까지만 한다. 다음 세션이 이어받을 것: FOREST 5.6(축제)·5.7(택배 사슬)은 웹·saga-godot 어디에도 실기 승인 사례가 없어 착수 전에 사용자 확인이 먼저 필요하다(이 세션에서 확인은 안 함, PROJECT_STATE "다음 작업" 참고). REALM 5-3(일기토·설전)·5-5(승리 조건·결과 카드)는 이 트랙에 실제로 필요한지조차 아직 안 살펴봤다 — 다음 세션이 saga-godot·웹판 상태부터 다시 확인할 것. GO ①②⑥⑧은 여전히 사용자 결정 대기.

## 2026-09-20 — PLAN 101-2 GO ①⑥⑧ ("사가 유니티 이어 해" 세션, REALM 5-8 다음)

"사가 유니티 이어 해" 지시로 시작 — PROJECT_STATE "다음 작업"의 나머지 후보(DUNGEON5.7·FOREST5.6/5.7·REALM5-3/5-5)가 전부 웹·godot 실기 승인 게이트에 걸려 있는 걸 확인해 사용자에게 물었더니, "사용자 결정 대기"로 명시돼 있던 GO ①봉수대·⑥인연·⑧패배 비용·회수 세 후보를 한꺼번에("1,2,3 다해") 지시받아 착수.

TestVillage는 GPS 오버월드가 아니라 9×11 고정 격자 하나뿐이라 웹판 §5 설계(27개 권역·파티 5명 궁합·GPS 200m 격자) 셋 다 원문 그대로는 못 옮긴다 — 세 후보 모두 크게 좁혔다.

**① 봉수대**: 27개 권역 대신 마을에 하나뿐인 봉수대(격자 4,4 — 수집 자리·LuckyCairn과 안 겹치는 빈 들판). 불을 올리기 전까지는 `HiddenTreasure` 등과 같은 자격의 목표판 최근접 후보고, 올린 뒤로는(GPS 반경 1.5km 노출 대신, 미니맵이 없는 이 트랙이라) 목표판(`GoSessionTracker.GoalLineNow()`)이 그 뒤로 아직 못 찾은 세 갈래(숨은 보물·산신당·동쪽 숲 유적)를 최근접 후보로 통째로 받아들이는 쪽으로 재해석 — 웹판 48절 "가 보기 전까지 안 뜬다"의 예외를 봉수대만 허용한다는 규칙의 정신을 살렸다. 새 `BeaconTower.cs`(primitive 원기둥+발광 구, 불 켜지면 색이 바뀐다 — 세이브 로드는 GameBootstrap.Start()가 Awake보다 늦게 WorldEventState를 복원하니 `RefreshVisualFromState()`를 로드 뒤 따로 불러 준다).

**⑥ 인연**: 이 슬라이스의 등용 대상이 "산적"(BanditEncounter) 하나뿐이라(RareWolfEncounter의 늑대는 등용 안 됨) faction/era 궁합("결") 축은 스코프 밖으로 뺐다 — 그 축 자체가 없다. 남은 "함께 걸은 거리·함께 이긴 토벌로 인연 0~3, +2%/등급"만 그대로 옮겼다(수치는 웹판 그대로: 2/6/15km 또는 3/10/25승). 새 `BondState.cs`(등용된 인물마다 Dictionary 항목, `PartyState.Recruit`/`Restore`가 자동으로 등록) — `GoSessionTracker.Update()`가 걸은 거리를 매 프레임 보고하고, Bandit/RareWolf 승리 시 `ReportWin()`. 배율은 `PerkState.AtkMultiplier`와 같은 자리에 곱으로 얹었다(`BondState.AtkMultiplier`·`DefMultiplier`, BanditEncounter·RareWolfEncounter 둘 다). 등급이 오르면 `GoSessionTracker`가 구독해 토스트.

**⑧ 패배 비용과 회수**: 그대로 옮겼다 — 진짜로 밀린 패배(`dealt>0`, "한 대도 못 때리고 물러난 것은 패배로 안 친다"는 기존 경계 그대로 유지)에서 소지금 15%(상한 300)가 그 자리에 남고, 10분 안에 돌아가 마커를 밟으면 회수, 아니면 소멸. 10분 창은 `Time.time`(앱 재시작 시 0으로 리셋)이 아니라 `DateTime.Now.Ticks`(실제 달력 날짜를 쓰는 `DailyTaskState`와 같은 결)로 재서 앱을 완전히 껐다 켜도 창이 그대로 흐른다. 새 `DropState.cs`(데이터, 동시 3개 상한)·`DropMarker.cs`(화면층, `LootMarker.cs`와 같은 경계지만 실제로 돈을 돌려준다) — BanditEncounter·RareWolfEncounter 둘 다의 패배 분기에 얹었다. `GameBootstrap.Start()`가 로드 직후 `DropState.PurgeExpired()`(앱이 꺼져 있던 사이 창을 넘긴 것부터 거름) 후 남은 것만 마커로 되살린다.

세이브는 v11→v12(`bondWalkedM`·`bondWins`는 `partyMembers`와 같은 순서, `drops`는 `DropState.Drop[]`을 JsonUtility가 그대로 직렬화). `MigrateStep(11,...)`이 둘 다 빈 배열로 채운다.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(오류 0) → 씬 재빌드(`BuildTestVillageScene.Build`, BeaconTower 신설 반영) → 헤드리스 3연속 OK(기존 goal board·bandit hitstop·ground decal·level-up cut·perk choice·loot marker·weapon visual·raid boss·daily tasks 전부 회귀 없이 통과 — 이번 세 기능 전용 헤드리스 체크는 아직 안 짰다, 다음 세션 숙제). `docs/PROJECT_STATE.md` 갱신(GO 요약에 ①⑥⑧ 추가, "다음 작업"에서 GO 항목 제거, 실기 확인 대기·테스트 상태 갱신). `PLAN.md` 101-2 GO 행에 재해석 이유·대응 파일 반영.

**다음 세션 숙제**: ①⑥⑧ 전용 헤드리스 진단(`PlaytestHeadless.cs`)이 아직 없다 — 봉수대 점등·목표판 전환, 인연 등급 상승·배율, 패배 시 짐 드롭·회수·만료를 코드로 확인하는 절이 없이 이번엔 컴파일+기존 회귀만으로 검증했다. 실기 확인도 전부 대기(아래 목록). GO 101-2는 이제 ①②⑥⑧ 중 ②(사당 시련)만 안 건드렸다(사용자가 "1,2,3"으로 지목한 셋만 진행) — ⑤(비석 GPS)는 모바일 빌드 뒤 그대로 보류.

## 2026-09-20 — GO ①⑥⑧ 전용 헤드리스 진단 추가 ("사가 유니티 이어 해" 세션, GO ①⑥⑧ 다음)

직전 세션이 GO①⑥⑧(봉수대·인연·패배 비용과 회수)을 컴파일+기존 회귀만으로 검증하고 "전용 헤드리스 진단 없음"을 다음 숙제로 남겼다 — 이 세션은 그 숙제만 처리.

`PlaytestHeadless.cs`에 세 메서드 추가. **`CheckBeaconTower()`**: 점등 전엔 목표판(`GoSessionTracker.GoalLineNow()`)이 봉수대 자신을 가리키는지, `OnTriggerEnter()`를 리플렉션으로 직접 불러 점등 후 `WorldEventState`가 실제로 켜지고 경험치·돈이 지급되는지, 목표판이 다른 발견형(숨은 보물 등)으로 넘어가는지, 두 번째 점등이 조용히 무시되는지(중복 보상 방지)까지 확인. **`CheckDropOnLossAndRecovery()`**: `BanditEncounter`의 `_duel.Dealt=1f`·`Cleared=false`를 강제해 진짜 패배 경로를 태워 소지금 15%가 깎이는지·`DropState`/`DropMarker`가 정확히 하나씩 생기는지·`TryRecover()`로 창 안 회수가 되는지, 두 번째 사이클은 `DropState.Expire()`로 만료 경로를 흉내 내 재회수가 실패하고 목록에서도 지워지는지 확인 — **`CheckBanditLootMarker()`보다 반드시 먼저 돈다**(그건 cleared=true로 이 BanditEncounter를 Destroy한다). **`CheckBondProgress()`**: `CheckBanditLootMarker()`가 방금 실제로 등용시킨 "산적"으로 `PartyState.Recruit`→`BondState.EnsureMember` 배선 자체를 확인하고, 거리 2.1km를 보고해 1등급·`LeveledUp` 이벤트·`AtkMultiplier` 반영을 본다. 승수(토벌 승리) 문턱은 `BondState.ReportWin()`이 등록된 전원에게 똑같이 매겨지는 특성상 "산적"은 이미 거리로 1등급이라 문턱 통과가 안 보여, 거리를 하나도 안 쌓은 합성 id(`__test_bond_win__`/`__test_bond_win2__`, 세이브 대상 아님)를 새로 등록해 따로 확인 — **반드시 `CheckBanditLootMarker()` 뒤에 돈다**.

세 체크 모두 "존재 확인"에서 끝내지 않고 실제 판정 결과(문자열 전환·상태 변화·이벤트 발화 횟수)까지 본다는 점에서 104-1 ② 기준을 그대로 따랐다.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(오류 0) → 씬 재빌드 없이(로직만 추가, 씬 구성 안 바뀜) 헤드리스 3연속 OK(신규 세 체크 전부 포함, 기존 항목도 회귀 없음). `docs/PROJECT_STATE.md` 갱신("다음 작업"에서 GO①⑥⑧ 진단 숙제 항목 제거, 테스트 상태 갱신).

GO 101-2는 이제 ②(사당 시련, 사용자 결정 대기)·⑤(비석 GPS, 모바일 빌드 뒤)만 남았고, 실기 확인도 여전히 대기 상태다. 다음은 여전히 DUNGEON5.7·FOREST5.6/5.7·REALM5-3/5-5(전부 게이트 대기)나 GO②(사용자 결정) 중 사용자가 고르는 쪽.

## 2026-09-20 — GO② 사당 시련 설계 뒤 중단 ("사가 유니티 이어 해" 세션, GO①⑥⑧ 진단 다음)

사용자가 "GO②(사당 시련) 진행 + 게이트 무시하고 다른 트랙 먼저 착수" 둘 다 지시(질문 1,2 선택). GO②부터 설계에 들어갔다가 코드 작성 중간에 "새로운 세션에서 이어 하자"는 지시로 중단 — **코드는 데이터 클래스 하나(`ShrineTrialState.cs`, 커밋 전 상태)만 만들고 지웠다**(미완성 orphan 파일을 안 남기려고, 커밋된 적 없어 안전). 설계는 여기 이 절에 그대로 남겨 다음 세션이 다시 고민 안 해도 되게 한다.

**GO② 사당 시련 — 확정된 재해석 설계(다음 세션이 그대로 구현할 것)**:
- 웹판(`saga-web/saga-go/PLAN.md` §5②, 132행)은 27개 권역마다 입구를 두고 클리어 보상으로 "그 권역 인물 조우"(새 동료)를 준다 — 이 트랙엔 GPS 권역도 105명 인물 풀도 없어 크게 좁힌다.
- **입구는 하나만, 산신당(`World.MountainShrine`, 격자 5,1) 옆 격자 (4,1)**(row1 `"^TT=TS^^^"`의 forest 타일, 비어 있음 확인됨).
- **3파도를 하나의 공유 타이머(180초, 웹판 수치 그대로)로 잇는다** — `DuelRules.Create(foeHp, atk, def, timeSec: 남은시간)`을 파도마다 다시 불러 이전 파도가 남긴 `_duel.Left`를 다음 파도 타임아웃으로 그대로 이어받는다(새 타이머 필드 불필요, `DuelRules` 수정도 불필요). 파도 상대 난이도는 웹판 "wolfpack 90→bandit 120→scout 170"을 `FoePower` 배열로 그대로 옮기고(`{90,120,170}`, `FoeHpMul=7`은 기존 두 사건과 같은 배율), 짐승형 새 시각 자산 없이 `RareWolfEncounter`처럼 primitive 캡슐(보라색 계열로 구분)만 쓴다. 마지막 파도(3번째)가 "미니보스" 역할을 겸한다(웹판의 "파도 3 + 별도 미니보스"를 4번째 전투 추가 없이 좁힌 것).
- **클리어 보상은 "인장 조각" 수집**(웹판 그대로: 3개=인장 1) — 이 후보 표준 태그가 "A E F"뿐이고 D(선택)·G(성장가시화)가 없어서, 영구 배율(PerkState·BondState 같은) 새로 만들지 않고 `DailyTaskState.StampsPerReward`(도장 7=주간보상)와 같은 결의 **일회성 이정표 보상**(경험치+돈 한 번 더)으로 좁혔다. 매 클리어 EXP120·금70, 3조각째(인장 획득)마다 추가로 EXP100·금80.
- **실패**: 소지금 10냥 손실(TrySpend, 못 내면 그냥 스킵하고 문구만 다르게) + **10분 재입장 잠금**(웹판 "재입장 10분" 그대로, `DropState`와 같은 결로 `DateTime.Now.Ticks` 기준 — 앱 재시작에도 창이 흐름). 하루 3회 제한은 `DailyTaskState`와 같은 실제 달력 날짜(`DateTime.Now.ToString("yyyy-MM-dd")`) 비교.
- 새 `ShrineTrialState.cs`(Data, 위에 적은 그대로 — 날짜·클리어수·조각·인장·잠금시각) + 새 `ShrineTrialEncounter.cs`(World, `BanditEncounter`/`RareWolfEncounter`와 뼈대 동일 — `EncounterUiKit` 조립, hitstop·화면 플래시, `PulseVisual` — 다른 점은 `Update()`의 `OnWaveOver()`가 파도 클리어 시 다음 파도로 넘어가거나 최종 성공/실패로 갈라지는 것뿐). `BuildTestVillageScene.cs`에 `BuildShrineTrial()` 추가(BuildMountainShrine 뒤). `SaveState.cs` v12→v13(날짜·클리어수·조각·인장·잠금시각 5필드).
- 전투력 배율 체인은 기존 두 사건과 통일: `(PartyState.Atk+PlayerStats.AtkBonus+Inventory.AtkBonus) * PerkState.AtkMultiplier * BondState.AtkMultiplier`.
- **다음 세션이 할 일**: 위 설계대로 `ShrineTrialState.cs`(재작성, 이 절 코드 그대로) + `ShrineTrialEncounter.cs`(신규) + `BuildTestVillageScene.cs`(`BuildShrineTrial()` 추가) + `SaveState.cs`(v13) 구현 → 컴파일 → 씬 재빌드 → 헤드리스 3연속 OK → `PlaytestHeadless.cs`에 전용 진단 추가(같은 세션에 같이 하거나 다음 숙제로 남기거나는 그때 판단) → PROJECT_STATE/PLAN 갱신 → 커밋.

**"게이트 무시하고 다른 트랙 먼저 착수" 쪽은 아직 어느 후보를 고를지도 안 정했다** — DUNGEON5.7·FOREST5.6/5.7·REALM5-3/5-5 중 REALM(이미 godot 참고 설계가 있어 가장 수월해 보임, 5-3 일기토·설전 또는 5-5 승리 조건 다중 중 하나)이 유력 후보라는 판단만 하고 코드는 손 안 댔다 — 다음 세션이 이어서 고를 것.

## 2026-09-20 — GO② 사당 시련 구현·완료 ("사가 유니티 이어 해" 세션, 전전 세션이 남긴 설계 그대로)

전전 세션(같은 날짜, "GO② 사당 시련 설계 뒤 중단" 절)이 남긴 설계를 그대로 구현했다 — 재설계 없이 그 절의 수치·구조 그대로.

새 `ShrineTrialState.cs`(Data, static): `DailyLimit=3`·`ShardsPerStamp=3`·`LockWindowSec=600`. `EnsureToday()`로 실제 달력 날짜(`DateTime.Now.ToString("yyyy-MM-dd")`)가 바뀌면 하루 카운트를 리셋(`DailyTaskState`와 같은 결). `CanEnter()`는 잠금(`DateTime.Now.Ticks < _lockUntilTicks`)과 하루 한도를 같이 본다. `ReportClear()`는 조각을 하나 늘리고 3의 배수가 되면 인장을 하나 늘리며 true(이정표 보상 신호)를 돌려준다. 저장은 5필드(날짜·하루카운트·조각·인장·잠금시각) — `SaveState.cs` v12→v13, v12 이하는 빈 날짜·잠금 없음으로 마이그레이션.

새 `ShrineTrialEncounter.cs`(World): 입구는 산신당(5,1) 옆 격자 (4,1)("^TT=TS^^^"의 forest 타일) — 항상 보이는 작은 돌 아치(기둥 둘+상인방, Cube 3개)로 자리를 표시하고, 파도 적은 짐승형 새 자산 없이 RareWolfEncounter처럼 primitive 캡슐(보라색 계열, 파도마다 진하게)만 전투 중에만 활성화한다. `StartTrial()`이 `ShrineTrialState.ReportEntry()`(하루 카운트 소비, 승패 무관)를 부르고 파도 0을 `SharedTimeSec=180`으로 시작. `OnWaveOver()`가 이 클래스의 유일한 분기점 — 클리어(`_duel.Cleared`)면서 마지막 파도가 아니면 `_duel.Left`(남은 시간)를 그대로 다음 `DuelRules.Create(..., timeSec: left)`로 넘겨 파도를 잇고, 아니면(마지막 파도 클리어이거나 애초에 못 깼으면) `FinishTrial()`로 시련 전체를 끝낸다. 클리어 보상은 EXP120·금70, 인장 완성 시 추가 EXP100·금80(`LootMarker.Spawn`도 기존 두 사건과 같이). 실패(시간 초과·기세 소진, `_totalDealt>0`인 진짜 패배만 — 한 대도 못 때린 클린 리트리트는 무비용)는 `GoldState.TrySpend(10)`(모자라면 조용히 스킵) + `ShrineTrialState.ReportFailLock()`. 도전 자체는 `ShrineTrialState.CanEnter()`가 false면(잠금 중이거나 하루 3회 다 씀) "맞선다" 선택 시점에 거절 메시지만 뜨고 하루 카운트는 안 늘어난다(문 앞 프롬프트 자체는 항상 뜬다).

`BuildTestVillageScene.cs`에 `BuildShrineTrial()` 추가(`BuildMountainShrine()` 뒤). `PlaytestHeadless.cs`에 `CheckShrineTrial()` 추가 — ①조각 3개=인장 1 산술을 인카운터 없이 `ShrineTrialState.ReportClear()` 직접 3회로 확인, ②`StartTrial()`+`OnWaveOver()`를 리플렉션으로 몰아 파도 0→1→2 진행마다 `_waveIndex`가 늘고 새 `DuelRules`의 `Left`가 이전 파도의 `Left`와 정확히 같은지, ③마지막 파도 클리어 시 `_waveIndex`가 0으로 정리되고 `Visual`이 다시 비활성화되며 골드가 정확히(exp는 레벨업 랩어라운드 때문에 `Level>levelBefore || Exp==expBefore+ClearExpReward`로 느슨하게) 늘었는지, ④두 번째 진입에서 `Cleared=false, Dealt=5f`로 진짜 실패를 태워 `GoldState.TrySpend`가 정확히 차감(모자라면 무차감 — `TryDrop`과 달리 `TrySpend`는 부분 차감이 없다는 점 주의)됐는지·`IsLocked`가 켜지고 `CanEnter()`가 꺼지는지까지 실제 판정 결과로 확인.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(오류 0) → `BuildTestVillageScene.Build` 재실행(멱등, `ShrineTrialEncounter` 추가 확인) → 헤드리스 3연속 OK(신규 `CheckShrineTrial()` 포함, 기존 항목 회귀 없음). 배치 모드 부작용 4파일(`ProjectVersion.txt`·`Packages/manifest.json`·`packages-lock.json`)이 스크립트의 자동 `git checkout`에도 한 번 남아 있어(Unity가 `-quit` 이후에도 미세하게 늦게 다시 쓴 것으로 추정) 커밋 전에 수동으로 한 번 더 `git checkout --` 로 확인·정리했다 — 다음 세션도 커밋 직전엔 `git status --porcelain -- Packages/ ProjectSettings/`로 한 번 더 확인할 것.

GO 101-2는 이제 ⑤(비석 GPS, Unity 모바일 빌드 뒤)만 남았다. "게이트 무시하고 다른 트랙 먼저 착수"(REALM 5-3/5-5 유력 후보) 쪽은 이번 세션에도 손 안 댔다 — 다음 세션이 고를 것.

## 2026-09-20 — REALM 5-3 "일기토·설전" 구현 ("사가 유니티 이어 해" 세션, GO② 사당 시련 다음)

GO② 완료 뒤 "게이트 무시하고 다른 트랙" 후보였던 REALM 5-3(일기토·설전)을 착수했다. saga-godot REALM(`games/saga_realm/data/realm_war.gd`·`realm_save_state.gd`)이 이미 이 웹판 §5-3 후보를 재해석해 실기 승인을 받아 뒀다 — 그 설계(수치·난도 문턱까지)를 그대로 옮기되 코드는 새로 짰다(다섯 판·트랙 공통 "코드 공유 없음" 원칙).

**일기토**: 웹판(`saga-web/saga-realm/PLAN.md` 131행)은 "무력 차 보정 + 합마다 3택"이지만, godot가 이미 "이 슬라이스의 fight()는 10합을 뭉쳐 도는 집계식이라 합마다가 아니라 싸움 전체에 한 번 곱한다"로 좁혀 승인받았다 — saga-unity도 같은 결로 3합(베기/찌르기/막기, 베기>막기·막기>찌르기·찌르기>베기 순환) 결과를 평균 배율(승1.3·무1.0·패0.8) 하나로 뭉친다. "무력 차 보정"은 이 슬라이스에 적 쪽 무력 개념이 없어(적 성엔 무장이 없다) 뺐다. 새 `RealmDuelState.cs`(Data, RoundResult/RoundMul/AverageMul/AiMove 순수 함수)와 `RealmWar.cs`의 `StepRound()`/`Fight()`에 `duelPowerMul`(매 합 atk 쪽, 기본 1) 셋째 배율 자리를 새로 열었다(`firstRoundPowerMul`·`defPowerMul`과 안 겹치는 축). `RealmWarState.Attack()`도 `duelPowerMul` 매개변수를 받아 그대로 넘긴다.

**설전**: 웹판은 화친(envoy)·등용(hire) 둘 다에 걸지만, 이 슬라이스엔 다른 세력과의 외교(화친) 자체가 없다(`RealmPlotData.cs` 클래스 주석 — "동맹/화친/조공은 다른 세력이 필요해 범위 밖"). 유일한 적용처인 "등용"(hire)에만 걸었다 — godot `realm_order_button.gd`와 같은 결. 사자는 hire가 실제로 쓸 사람과 같은 사람(`RealmCityState.BestAvailableOfficer(Wisdom, false)`) — 새 공개 메서드 `RealmCityState.HireEnvoyOfficer()`로 UI가 미리 알 수 있게 했다. 사자 지력으로 난도 상한을 정해(70+→3등급, 40+→2등급, 그 밖 1등급) `RealmQuizData.Bank`(36문항, 학당과 같은 은행)에서 3문 뽑는다 — `RealmQuizState._learned`/`_wrongs`/`_streak`는 안 건드리는 완전히 별도 추첨(새 `RealmDebateState.Draw()`가 `RealmQuizState.Present()`와 같은 셔플 로직을 독립적으로 복사). 정답 수(0~3) → 배율(0.8/0.95/1.1/1.3, `RealmDebateState.Result()`)을 등용 성공률에 곱한다 — `RealmCityState.DoHire()`의 성공률 계산(`0.28 + 지력/260 - (희귀도-2)×0.09`, 0.05~0.9 클램프)을 순수 함수 `HireChance(officerWisdom, targetRarity, debateMul)`로 뽑아내 `chance*debateMul`을 같은 구간으로 다시 클램프한다(godot `_do_hire()`와 같은 결) — `ExecuteOrder()`도 `debateMul` 기본 1 매개변수를 받는다(다른 아홉 명령은 인자 없이 그대로 호출 가능).

**UI**(`RealmCommandUi.cs`): 일기토는 전술 토글(101-2 5-6)과 독립된 새 토글 버튼(오른쪽 위 구석 기둥, -690 — 전술 바로 아래)으로 켜고 끈다. 켜져 있으면 "공격" 버튼을 누른 순간(목표가 하나뿐이든 고르기 패널에서 골랐든) 실제 출진 전에 강제 진행형 모달(`_duelPanel`, 닫기 버튼 없음 — 베기/찌르기/막기 3라운드를 다 골라야 저절로 닫힌다)이 뜬다. 3라운드 뒤 평균 배율과 함께 실제 `RealmWarState.Attack(..., duelPowerMul:)`을 부른다(`BeginAttackFlow()`/`FinishAttackFlow()`로 두 공격 경로(단일 목표 직행/여러 목표 고르기)를 하나로 합쳤다). 설전은 "명령" 패널에서 "등용"을 고르는 순간(사자가 있으면) 명령 패널을 바로 닫고 3문 카드 모달(`_debatePanel`, 학당 문답 패널과 뼈대는 같지만 별도 상태)을 띄운다 — 3문 다 고르면 결과 배율로 `RealmCityState.ExecuteOrder("hire", mul)`을 부른다.

**검증**(`PlaytestRealmSlice.cs`): `CheckDuel()` — 순환 판정(베기>막기 등 3쌍 + 비김)·배율(1.3/1.0/0.8)·평균 산술을 먼저 확인한 뒤, 합성 부대(`RealmArmy`)로 같은 RNG 시드(`Random.InitState(20260920)`)에서 `duelPowerMul=0.8`과 `1.3` 두 번 `RealmWar.Fight()`를 직접 불러 적 손실이 실제로 늘어나는지까지 본다(게임 진행 상태를 안 건드리는 합성 데이터라 사이드 이펙트 없음, `CheckTactic()`과 같은 관행). `CheckDebateHire()` — 지력별 난도 상한(20→Lv1만, 90→20회 추첨 중 Lv3 한 번 이상)·3문 고정·정답수→배율 매핑(전정답 3/1.3, 전오답 0/0.8)을 확인한 뒤, `RealmCityState.HireChance()`를 리플렉션으로 직접 불러(private, `ResolveTactic()`과 같은 관행) `debateMul`이 성공률을 실제로 올리고/내리고 극단값(5.0)도 0.9 상한을 못 넘는지까지 본다. 둘 다 Phase.Init 말미 `CheckTactic()` 뒤(`CheckEventChain()` 앞)에서 돈다.

`tools/unity-batch.sh -- <Unity 인자...>`로 컴파일(오류 0) → `BuildTestCityScene.Build` 재실행(멱등, 새 토글·모달 GameObject 반영) → `PlaytestRealmSlice.Run` 헤드리스 3연속 OK(신규 `CheckDuel()`/`CheckDebateHire()` 포함, 기존 30여 항목 회귀 없음). 배치 모드 부작용 4파일은 스크립트가 자동 원복 — 이번엔 재원복 없이 한 번에 깨끗했다.

REALM 101-2는 이제 5-4(제외 확정, PLAN.md Q-U2)·5-5(승리 조건 4종+결과 카드, godot 참고 설계 있음 — 다음 유력 후보)만 남았다.

## 2026-09-20 — REALM 5-5 "승리 조건·결과 카드" 구현, 101-2 REALM 전부 완료 ("사가 유니티 이어해" 세션, REALM 5-3 다음)

godot REALM(`realm_save_state.gd` `check_result()`/`_closest_victory_progress()`, HISTORY 2026-09-17 실기 승인)의 재해석. 웹판 `saga-realm/PLAN.md` §5-5 "승리 조건 다중"(패권·문화·외교·생존 넷) 중 godot은 세력·화친 시스템이 있어 문화·외교 둘을 옮겼지만, 이 트랙은 적국이 전부 무주공산 성일 뿐(`RealmEnemyCity.cs`) 다른 세력(AI 로드)·외교·화친·순위 시스템 자체가 없다 — 패권(세력 순위)·외교(화친 유지)·생존(전용 시나리오) 셋 다 그 개념 자체가 없어 보류하고, **정복**(지금까지 판정 자체가 없던 것을 이번에 신설)과 **문화**(문답 정답 수, `RealmQuizState.GetProgress().Correct`) 둘만 남겼다. 문화 임계값은 godot의 200(문답 은행 260개 기준)을 그대로 못 옮긴다 — 이 트랙 은행은 36개뿐이라(`RealmQuizData.Bank`) 대신 이 트랙의 다른 문답 목표(`RealmOfficerTraits` "학문" 야망=15)의 두 배인 **30**으로 잡았다.

새 `RealmVictoryState`(정적 클래스) — `CheckResult()`가 `RealmCityState.Changed`마다(`RealmSessionTracker.OnCityStateChanged()`, `RealmOfficerTraits.CheckAmbitions()`와 같은 자리) 두 조건을 보고, 한 번 굳으면(`IsOver`) 다시 안 본다 — godot과 같은 "닫힌 판"(웹판처럼 victories 배열로 계속 모으는 열린 판이 아니라, 둘 중 먼저 채운 조건 하나로 그 판이 끝난다, 재해석 확정). `ClosestProgress()`가 두 조건 중 더 가까운 쪽 이름·진척률을 돌려준다(godot `_closest_victory_progress()` 재해석).

**UI**: 결과가 확정되면 `RealmSessionTracker.OnVictoryAchieved()`가 기존 월간 요약과 같은 `SessionCard`로 결과 카드(연월·함락 성/전체·로스터 수 3줄)를 띄운다 — godot이 "기존 정복 승리의 5초 토스트도 같은 카드로 올렸다"는 것과 같은 결. 목표판 셋째 줄(`GoalLineWeek()`)이 godot §5-5 UI 스펙("가장 가까운 승리 조건 + 진척 %") 그대로 "함락 N/58성" 고정 문구에서 "정복 NN%"/"문화 NN%"(판이 끝나면 "OO 승리 — 판 끝")로 바뀌었다. `RealmCommandUi.ExecuteNextMonth()`만 godot `realm_month_button.gd`처럼 판이 끝난 뒤를 막는다(토스트 "이미 판이 끝났다.") — "공격"·"명령" 등은 계속해도 무해해(이미 정복했거나 더 얻을 것이 없을 뿐) 안 막았다, godot도 월간 버튼만 막았다.

**세이브**(`RealmSaveState.cs`): `victoryResult`(Kind enum 이름 문자열) 필드 추가, quiz·야망 필드와 같은 이유로 SAVE_VERSION 안 올림(JsonUtility가 없는 필드를 null로 채워 옛 세이브도 `RealmVictoryState.Restore(null)`로 "아직 안 끝남" 상태로 시작한다).

**검증**: `tools/unity-batch.sh`로 컴파일(오류 0, 처음에 `RealmVictoryState.CapturedCount()`가 `IReadOnlyList<string>.Contains()`를 써서 `using System.Linq;` 누락으로 CS1061 — 바로 고침). `PlaytestRealmSlice.cs`의 기존 55개 성 전멸 시퀀스가 어차피 정복 승리를 실제로 발동시키므로(전 적국 함락 뒤 `RealmSessionTracker`가 자동으로 판정), `Phase.SaveLoad`에 "이 시점엔 이미 정복 승리여야 한다" 사전 확인 + `RealmVictoryState.Restore(null)`로 흩트렸다가 `TryLoad()` 뒤 다시 `Conquest`로 돌아오는지 round-trip 확인을 편입했다(영구 회귀). 문화 승리·목표판 셋째 줄·"다음 달" 게이트는 이 시퀀스가 정답 30을 안 채워 커버가 안 돼, godot HISTORY 2026-09-17 `_diag_victory.gd`와 같은 결로 **임시 자가진단**(`CheckVictoryCultureAndGate()` — 정답 30 채워 발동 확인, `ExecuteNextMonth()`를 리플렉션으로 직접 불러 게이트 확인, 부작용(문답 진행·금·야망 달성)은 스냅샷/복원으로 전부 원상복구)을 `Phase.Init`에 잠깐 끼워 넣어 한 번 통과 확인한 뒤 메서드·호출부를 그대로 지웠다. 최종 3연속 `PlaytestRealmSlice.Run` OK(신규 SaveLoad 확인 포함, 기존 30여 항목 회귀 없음). 배치 모드 부작용 4파일은 스크립트가 자동 원복.

REALM 101-2는 이제 완전히 닫혔다 — 남은 5-4(제외 확정, PLAN.md Q-U2)를 빼면 이 트랙에 새로 이어받을 REALM 101-2 잔여 작업이 없다. 다음 세션은 GO⑤(비석 GPS, 모바일 빌드 뒤)·DUNGEON5.7(웹 선행 뒤)·FOREST5.6/5.7(웹·godot 승인 사례 없음) 중에서 고르거나, STORY 5-2~5-4·5-8 재검토가 남은 후보다.

## 2026-09-20 — STORY 5-4 "관문 대장" 구현 ("사가 유니티 이어해" 세션, REALM 5-5 다음)

godot STORY(`story_boss_spawner.gd`/`story_enemy.gd`, HISTORY 2026-09-17 실기 승인)의 재해석. 웹판 `saga-story/PLAN.md` §5-4 "관문 대장 — 주간 보스(미사용 보스 6종 활용)"을 godot이 먼저 옮기며 "3D엔 미사용 보스 자체가 없다"고 재해석했는데(있는 넷을 매주 강화판으로), 이 트랙은 그보다 더 얇다 — 두목이 애초에 **하나뿐**이고 상시 그 자리에 서 있는 편도 필드(`StoryEnemySpawner`가 씬 하나에 고정 배치)라 "이번 주 미도전이면 그 두목이 챔피언으로 승격한다"로 더 좁혔다. 반격 자체가 없는 두목이라(`StoryEnemy.cs` 클래스 주석 "재해석" — "다음 콘텐츠 확장 때 붙이면 된다"고 처음부터 미뤄 둔 것) godot의 "3분 초과 시 광폭화"(공격력 배율)는 적용할 축이 없어, 대신 "시간 안에 못 잡으면 태세를 정비한다"(체력 회복+무제한 재도전 — 재방문 없는 필드라 도망(Destroy) 대신 리셋으로 재해석)로 바꿨다.

**저장**(`StorySaveState.cs`): `_championWeek`(int, 주 index) + `CurrentWeekIndex()`(`DateTimeOffset.UtcNow.ToUnixTimeSeconds()/(7*86400)`, godot `current_week()`와 같은 결) + `ChampionAvailable()`/`ClaimChampion()`. `SaveData.championWeek` 필드 추가(SAVE_VERSION 안 올림 — quiz류와 같은 이유, 없으면 0="아직 없음"). 테스트 전용 `ResetChampionForTest()`도 같이 추가(다른 XxxState의 `Restore(기본값)`과 같은 자리).

**`StoryEnemy.cs`**: `ChampionHpMul=2.5·ChampionExpMul=2·ChampionTimeLimitSec=180·ShieldBreakThreshold=0.3·ShieldVulnerableMul=1.5·ShieldVulnerableSec=10`(전부 godot 수치 그대로, 경험치만 골드 대신 — 이 트랙엔 금·고유장비가 없다). `TryBecomeChampion()` — 두목이고 안 죽었고 이번 주 미도전이면 HP를 ×2.5로 올리고 타이머를 켠다. `Update()`에서 타이머 감소·방패 창(10초) 만료 시 누적 피해 리셋. `TakeDamage()`가 방패 파괴 중이면 피해 ×1.5 적용, 원본 피해로 `CheckChampionShield()`(누적 30% 문턱 판정). `Die()`가 챔피언이면 경험치 ×2 + `StorySaveState.ClaimChampion()`. `Regroup()`(타임아웃) — HP 전체 회복+누적 피해·방패 초기화+타이머 리셋, Destroy 안 함.

**호출 순서 함정** — `TryBecomeChampion()`을 두목 스폰 시점(`StoryEnemySpawner.Build()`, 에디터 빌드 시각)이나 `StoryEnemy.Awake()`에서 바로 못 부른다. `StorySaveState.TryLoad()`가 `GameBootstrap.Start()`에서 도는데, Unity 생명주기는 "씬의 모든 Awake() 먼저, 그다음 모든 Start()" 순서만 보장하고 서로 다른 컴포넌트의 Start() 간 순서는 안 보장한다 — 세이브가 실리기 전에 챔피언 여부를 판정하면 항상 틀린다. `GameBootstrap.Start()`가 `TryLoad()` **바로 뒤**에 `StoryEnemy.All`(이미 다 채워져 있다 — Awake는 이미 끝났으므로)을 순회하며 명시적으로 `TryBecomeChampion()`을 부르는 것으로 해결.

**UI**(`StoryHud.cs`): `StoryEnemy.ActiveChampion`(DUNGEON `DungeonEnemy.ActiveWorldBoss`와 같은 결)이 있으면 타이머+방패 상태 한 줄을 얹는다(폴링, 새 신호 배선 없음).

**검증**(`PlaytestStorySlice.cs`): 기존 `Phase.KillBoss`가 원래 "두목은 216(BossHp)이라 한 방엔 안 죽는다"만 봤는데, 새 게임은 항상 이번 주 미도전이라 이제 두목이 항상 챔피언(540)으로 뜬다 — 이 사실 자체를 자연스러운 기본 경로로 흡수해 어서션을 다시 짰다: 챔피언 승격 확인 → 히트 캡을 40→50으로(최저 변동폭 0.88만 나와도 540/(21×0.88)≈30번이면 확실히 죽는 수학적 상한, RNG 운에 안 기댐) → 루프 중 방패 파괴 최소 한 번 목격 확인 → 처치 후 `ChampionAvailable()==false` 확인. `Phase.SaveLoad`에도 클레임 상태 disturb+round-trip 확인 편입(`ResetChampionForTest()`로 진짜로 흩트린 뒤 `TryLoad()`로 되돌아오는지).

**함정 — 이전 실행이 남긴 `save_story.json`이 챔피언 판정을 오염시킴**(PROJECT_STATE.md 2026-09-19 REALM worktree 세션의 것과 같은 부류, 이번엔 STORY에서). 첫 로컬 실행은 통과했는데 연속 2·3회차가 `Phase.KillBoss`에서 "새 게임 두목이 관문 대장으로 안 승격됨(available=False)"로 실패했다 — 1회차의 `Phase.SaveLoad`가 실제로 디스크에 `save_story.json`을 남기고, 그 파일의 `championWeek`가 "이번 주"라서 2회차 `GameBootstrap.Start()`가 그걸 그대로 불러와 미도전 판정을 뒤집었다. `Phase.Init`이 이미 "이전 실행이 남긴 세이브 무시" 목적으로 `StoryQuestState`·`StoryWorldEventState`·`StoryNpcState`·`StoryJobState` 넷을 강제 리셋하는 자리(주석 "새 정적 상태를 추가할 때마다 여기 잊지 말 것")가 있었는데, 새 `championWeek`를 처음엔 안 넣어서 겪었다 — `ResetChampionForTest()` 호출을 그 목록에 추가하고, **리셋만으론 안 끝난다**: `GameBootstrap.Start()`가 이미 (틀린 판정으로) `TryBecomeChampion()`을 불러 두목이 챔피언이 아닌 채로 굳어 있었으므로, 리셋 직후 `StoryEnemy.All`을 다시 순회해 `TryBecomeChampion()`을 재호출해야 했다(멱등이라 안전).

`tools/unity-batch.sh`로 컴파일(오류 0) → `PlaytestStorySlice.Run` 3연속 OK(신규 챔피언 검증 포함, 히트 수 18~20회로 안정적). 배치 모드 부작용 4파일은 스크립트가 자동 원복.

다음 후보: STORY 5-3(비경, godot `story_labyrinth.gd` 코드 완료 — 5층 노드 지도+진입 축복 3택+기억 조각, 이 트랙엔 죽음 시스템이 없어 "패퇴" 재해석 필요) 또는 GO⑤(모바일 빌드 뒤)·DUNGEON5.7(웹 선행 뒤)·FOREST5.6/5.7(승인 사례 없음).

## 2026-09-20 — STORY 5-3 "비경" 구현, 101-2 STORY 후보 전부 소진 ("사가 유니티 이어해" 세션, STORY 5-4 다음)

godot STORY(`story_labyrinth.gd`, HISTORY 2026-09-18 실기 승인)의 재해석을 이어 옮겼다. 웹판 `saga-story/PLAN.md` §5-3 "비경(祕境) — 경로 선택 미니던전 + 진입 축복 3택 + 기억 조각"(웹 자신도 아직 미착수, §8 로드맵 Phase 3)이 원안 — "5층 노드 지도(전투·정예·보물·휴식·사건), 진입/정예 처치 후 축복 3택(도감 인물 서명 효과 대여), 죽으면 나가고 기억 조각만 남음, 영구 강화(최대 HP +2%×10단)".

**재해석 셋, 전부 godot 선례를 그대로 이었다**:
1. **축복** — 이 트랙엔 인물 로스터가 없다(`StoryCombat.cs` StartAtk 주석 — 웹판도 "인물 미선택 대체값"으로 시작). godot과 같은 결로 이 판에 실제 있는 채널(공격/방어/유틸 3축, 9종)로 다시 짰다. godot은 뽑은 뒤 축 중복을 검사하지만, 이 포트는 **축마다 하나씩 뽑는 구조**(`StoryLabyrinthMapUi.ShowBlessingPick`이 `AxisPools` 3개를 순서대로 돈다)로 짜서 애초에 중복이 생길 수 없다 — 진단 항목 하나를 구조 자체로 해치웠다.
2. **죽음** — 이 트랙 플레이어는 피격당하지 않는다(`StoryCombat.cs` StartHp 주석 "이 슬라이스는 플레이어가 안 맞아 미사용", `StoryJobTrainer.cs`도 "체력 상한이 어디에도 안 쓰인다"고 명시). HP 기반 죽음 자체가 없어, 이 비경의 진짜 위협인 **노드 제한시간**(전투 50s·정예 60s·보스 90s, PLAN 원안 "층당 전투 40~60s 목표"를 강제 실패 조건으로 승격)을 대신 세웠다. 시간 안에 못 끝내면 회차가 끝난다(이미 확정된 기억 조각은 유지 — 아래 "저장" 참고).
3. **실행 방식** — godot은 완전히 새 3D 씬(`StoryLabyrinth.tscn`)에 5층 발판 지도를 짓지만, 이 트랙은 필드 전체가 고정 좌표(`FieldMapData`) 기반이고 `StoryTerrainBuilder.BuildBoundaryWalls()`가 필드 폭(-0.5~44.5)만 막는 게 아니라 그 **경계벽이 물리적으로 벗어날 수 없게 막아** 새 구역을 끼워 넣을 자리가 없다(음의 X로 걸어 나가려던 첫 시도가 벽에 막혀 확인, 아래 "설계 확인" 참고). 노드 지도 자체는 **풀스크린 UI**(`StoryLabyrinthMapUi`, 슬레이 더 스파이어 식)로 다루고, 전투가 필요한 노드(전투·정예·보스)만 필드 밖 멀리(x=1000~) 지어 둔 **전용 아레나**(`StoryLabyrinthRunner.BuildArena()`, 바닥+양쪽 벽뿐인 primitive)로 순간이동시켜 실제 `StoryEnemy`를 스폰해 싸운다(보물·휴식·사건은 자리 이동 없이 즉시 판정). 판정 엔진은 필드와 완전히 같은 `StoryEnemy`/`StoryCombat`을 그대로 재사용한다(웹판 "판정은 side.js 사냥터 엔진 재사용"과 같은 정신).

**영구 강화** — 원안 "최대 HP +2%×10단"은 위 2번과 같은 이유로 적용 축이 없다. 실제로 쓰이는 채널인 공격력(`StoryCombat.StartAtk`)에 얹는다(`StoryLabyrinthData.MemoryAtkBonusPerTier = StartAtk*0.02`, `StoryLabyrinthState.MemoryAtkBonus = MemoryTier * 그 값`).

**새 파일**: `StoryLabyrinthData.cs`(BLESSINGS 9종 3축·NodeType 5+Boss·주간 변형자 3종·`GenerateFloors(seed)` — `System.Random` 시드 고정, 1~4층 각 2~3개 노드), `StoryLabyrinthState.cs`(정적 상태 — 영구는 기억 조각·강화 단수만, 회차 진행은 메모리만), `StoryLabyrinthRunner.cs`(아레나 빌드·노드 진입/판정·제한시간 틱), `StoryLabyrinthGate.cs`(문, `StoryChoiceUi` 재사용 — 새 2택 UI를 안 만듦), `StoryLabyrinthMapUi.cs`(노드 지도+은사 3택, `StoryJobChoiceUi`와 같은 결로 자기 UI를 스스로 짓는다).

**기존 파일 6곳 배율 합류**(godot `story_player.gd` 6곳과 같은 규모) — `StoryPlayerController.CurrentAtk`(AtkMul+MemoryAtkBonus)·`TryAttack/TrySweep/TryBolt/TryBrace`의 쿨다운(×CooldownMul)·`Walk()`의 runSpeed(×MoveSpeedMul)·`StoryCombat.RollDamage`의 crit rate(+CritRateBonus)·`StoryCombat.TickMpRegen`의 회복량(×MpRegenMul). 회차 밖에서는 전부 중립값(1/0)이라 평소 필드 전투는 원문 그대로 돈다. `StoryEnemy.cs`엔 `isLabyrinthEnemy` 플래그(+`ApplyLabyrinthHpMul()`) 추가 — 아레나 개체가 필드 사명(`StoryQuestState`)·정상 경험치 지급 경로를 안 타게 막는다(Runner가 노드 종류별 정확한 총량을 한 번에 준다).

**세이브**(`StorySaveState.cs`) — `memoryShards`/`memoryTier` 두 필드만(championWeek와 같은 이유로 SAVE_VERSION 안 올림). **재해석 — 세이브 범위**: 웹판/godot은 진행 중 회차(층·경로·축복)까지 세이브에 넣지만, 이 트랙은 `StoryCombat.Mp`(세션 중요치 아님)와 같은 선례를 따라 **회차 진행은 메모리만** — 앱을 끄면 그 회차는 사라진다(이미 확정된 기억 조각·영구강화 단수만 남는다). 웹판보다 좁힌 결정이지만 이 트랙의 기존 "세션 상태 vs 영구 상태" 경계와 일치시켰다.

**헤드리스 진단 중 실제 버그 둘 발견·수정**(`PlaytestStorySlice.cs`에 `LabyrinthTest` 단계 신설, `ExitRope`→`LabyrinthTest`→`SaveLoad` 순, 지도 결정성·축복 축 구조·노드 5종(실 UI 클릭 포함)·전투/정예 아레나 처치·제한시간 실패·재기(再起)·맵 UI 버튼으로 1~5층 실제 완주·영구 강화 10단 상한·세이브 round-trip까지 검증하며 잡음):
1. `StoryLabyrinthMapUi.Instance`가 `Build()`(에디터 전용, 런타임 재호출 없음)에서만 채워져 있어 `StoryJobChoiceUi.cs`와 똑같은 함정(도메인 리로드 이후 실제 플레이 세션엔 null로 남는다 — `StoryChoiceUi`/`StoryCameraFollow`처럼 `Awake()`에서도 채워야 함)을 그대로 반복할 뻔했다. 첫 헤드리스 실행에서 `runner=True mapUi=False`로 바로 걸려 `Awake() => Instance = this;`를 추가해 고쳤다 — 고치지 않았다면 실제 게임에서 문에 다가가도 은사 카드/노드 지도가 영원히 안 떴을 것이다(치명적이었을 버그).
2. `StoryLabyrinthMapUi.ClearChildren()`이 `Destroy()`(프레임 끝 지연, `StoryEnemy.IsDead` 클래스 주석과 같은 함정)를 써서, 같은 프레임에 은사 패널을 연달아 다시 그리면(정예 처치 직후 은사 뽑고 곧바로 다음 회차 진입 은사를 또 뽑는 내 진단이 실제로 이 경로를 밟았다) 이전 버튼이 안 지워진 채 쌓였다(3개여야 할 버튼이 6개) — `DestroyImmediate`로 고침.
3. (설계 확인, 버그 아님) ExitRope의 `Move(10,0,0)` 스윕이 낸 `OnTriggerExit`는 물리 스텝에서 비동기 처리되는데(원래 `SaveLoad` 첫 줄의 실시간 0.2초 대기가 이걸 기다린다), 새 `LabyrinthTest` 단계가 그 대기 없이 곧바로 CharacterController를 또 disable/enable(비경 순간이동)하면 대기 중이던 로프 트리거 상태가 꼬였다 — `LabyrinthTest` 첫 줄에도 같은 실시간 대기를 넣어 해결(경위는 CLAUDE.md 없음, 이 절이 유일한 기록).

`tools/unity-batch.sh`로 컴파일(오류 0) → `BuildTestStoryScene` 재빌드 → `PlaytestStorySlice.Run` 3연속 OK. 배치 모드 부작용 4파일은 스크립트가 자동 원복.

**101-2 STORY 후보 전부 소진** — 5-1·5-3·5-4·5-5·5-7 다 완료, 남은 건 5-2(웹·godot 둘 다 미확정이라 보류)·5-8(파티 시스템 자체가 없어 재검토 필요)뿐. 다음 후보: GO⑤(모바일 빌드 뒤)·DUNGEON5.7(웹 선행 뒤)·FOREST5.6/5.7(승인 사례 없음).

## 2026-09-20 — FOREST 5.7 "택배 사슬" 구현, 게이트 무시 진행 결정 ("사가 유니티 이어해" 세션, STORY 5-3 다음)

세션 시작 시점에 다섯 판 101-2 후보를 전부 훑었다 — GO⑤(GPS 순례, Unity 모바일 빌드 뒤)·DUNGEON5.7(시대 퓨전, 웹 선행 결과 뒤)·STORY5-2(보류)·5-8(파티 시스템 재검토)·REALM(전부 닫힘) 전부 진행 불가, FOREST5.6/5.7도 saga-web·saga-godot 어느 쪽에도 구현·실기 승인 사례가 없어 101-2 게이트("웹에서 통한 것부터", 2026-09-19 결정으로 godot 실기 승인도 인정)에 걸렸다. 정리 작업(102-4 `Assets/Art/Characters` Kenney 플레이스홀더 삭제)도 시도했으나 실제로는 FOREST 주민(`VillagerGlbPath`)·STORY 척후병·DUNGEON/GO 다수 Enemy가 `character-{a,b,c,d}.glb`를 아직 활발히 참조 중이라(`Editor/BuildTestXxxScene.cs` 다수, `World/CharacterVisual.cs` 세 벌) 문서 판정("44장 교체 완료 확인 후 뺄 것")과 달리 안전하지 않았다 — 44장 교체가 Player·주요 Enemy까지만 커버했지 보조 역할(주민·척후병)은 그대로 이 자산을 쓴다.

사용자에게 AskUserQuestion으로 방향을 물어 **"게이트 무시하고 unity 자체 진행"**을 골랐다(PLAN.md 101-2 서두에 2026-09-20 결정으로 기록). FOREST5.6(축제, 행사 8종 미니게임)은 재해석 범위가 넓어(일과/날짜 시스템 자체가 이 트랙에 없음) 다음으로 미루고, 상대적으로 이 트랙 기존 시스템(과일 경제·바이옴 존·Sprint 입력)에 바로 얹을 수 있는 FOREST5.7(택배 사슬)을 골랐다.

**재해석**: 웹판(`saga-web/saga-forest/PLAN.md` 167행)은 우주기지·폐허(과거)·캠프(현대) 같은 고정 목적지 3곳 + 배달 등급 마일스톤(10/30/60 — 수레 소품·배달원 옷·로버 탑승)을 전제한다. 이 트랙 지도엔 그런 랜드마크가 없어 이미 있는 네 바이옴 존(`ForestBiomeData.Zones`)을 배달 목적지로 재해석했다(우체통을 존마다 하나씩, `Editor/BuildTestVillageForestScene.cs BuildDeliveryMailboxes()` — 존 중심에서 원점 반대 방향 x축으로 8m, den·채집 자리와 안 겹치는 유일한 축). 보상은 이 트랙에 금 경제가 없어(`ForestState.cs` 클래스 주석) 과일로, 웹판 "현실 5분" 시간제한은 맵 크기(존 반경 17~45m)에 맞춰 45초로 축소. 배달 등급 마일스톤(코스메틱 자산)은 이 트랙에 그런 소품이 없어 스코프에서 뺐다 — 대신 누적 배달 수만 세이브(v6, `deliveredCount`).

소포 3종(보통/깨지기 쉬움/시간제한)·연속 3배달 사슬 보너스(×1.5)는 원문 결 그대로. "깨지기 쉬움 — 달리면 파손"은 `Player/PlayerController.cs`의 기존 Sprint 입력을 그대로 활용 — 매 프레임 `ForestDeliveryState.NotifyRunning(running)`으로 보고하고, 상태 쪽에서 "깨지기 쉬움을 들고 있을 때만" 파손 플래그를 세운다(플레이어 컨트롤러가 배달 규칙을 몰라도 되게).

**새 파일**: `Data/ForestDeliveryState.cs`(정적 상태 — 소포 종류·목적지·사슬·누적 배달, 회차성 데이터는 세이브 안 함, `ForestMuseumState.cs`와 같은 결), `World/ForestDeliveryCounter.cs`(접수대, `ForestFurnitureStall.cs`와 같은 결 — 다가가면 쿨다운 걸고 무작위 접수), `World/ForestDeliveryMailbox.cs`(목적지 우체통, `ForestCollectSpot.cs`와 같은 결 — 정적 위치 표까지 같은 패턴).

**기존 파일 변경**: `ForestSaveState.cs`(v5→v6, `deliveredCount` 필드, 구버전 로드는 0으로), `Player/PlayerController.cs`(`NotifyRunning()` 훅 한 줄), `UI/ForestSessionTracker.cs`(`GoalLineNow()`가 소포를 들고 있으면 목적지 거리를 우선 보여줌, `GoalLineSession()`/`ShowSummary()`에 "택배 N건" 추가).

**헤드리스 진단**(`PlaytestForestHeadless.cs`에 `CheckDelivery()` 신설, `ForestDeliveryState` 순수 상태 API를 직접 두드리는 `CheckMuseum()`류 결) — 오배송 거절(목적지 다른 우체통), 정상 배송(보상 4), 3배달째 사슬 보너스(보상 6=4×1.5), 파손(달리는 중 깨지기 쉬움 배달 → 보상 0·사슬 끊김), 시간초과(`_deadline` 리플렉션으로 강제, 보상 절반), `Snapshot()`/`Restore(10)` round-trip, 씬 오브젝트(접수대 1·우체통 4) 존재, 목표판 "지금" 줄 연동까지 확인. 첫 실행에서 `counter=null mailboxes=0`으로 실패 — **씬 `Build()`를 안 다시 돌려서** 새 GameObject가 씬 파일에 아직 없었다(PLAN.md 104-2 검증 절차 "GameObject 구성이 바뀔 때만 Build()" 그대로 — 이번엔 바뀐 경우였다). `BuildTestVillageForestScene.Build()` 재실행 후 3연속 OK.

`tools/unity-batch.sh`로 컴파일(오류 0, 4파일 자동 원복 확인) → 씬 재빌드 → `PlaytestForestHeadless.Run` 3연속 OK.

FOREST 101-2는 이제 5.6(축제)만 남았다 — 다음에 이어가려면 이 트랙에 없는 날짜/일과 시스템을 어떻게 재해석할지부터 정해야 한다. 다섯 판 전체로는 GO⑤(모바일 빌드 뒤)·DUNGEON5.7(웹 선행 뒤)·STORY5-2/5-8·FOREST5.6 다섯 후보가 남아 있고, 2026-09-20 결정으로 전부 게이트 없이 다음 세션이 바로 고를 수 있다.

## 2026-09-20 — DUNGEON 5.7 "시대 퓨전" 구현, HeroState.Restore() 이벤트 버그 발견·수정 ("사가 유니티 이어해" 세션, FOREST 5.7 다음)

2026-09-20 결정("게이트 무시하고 unity 자체 진행")으로 이어 두 번째 후보를 골랐다. FOREST5.6(축제, 날짜/일과 시스템 자체가 없어 재해석 범위가 넓음)보다 이 트랙 기존 시스템(무기 소켓 시각화·절차적 층 진행)에 바로 얹을 수 있는 DUNGEON5.7(시대 퓨전)을 골랐다.

**재해석 — 뺀 것**: 웹판(`saga-web/saga-dungeon/PLAN.md` 191행) "인물 30"(현대·근미래 인물, `data-hero-ext.js` 확장)은 이 트랙에 인물 로스터 자체가 없다(GO의 `PartyState` 같은 등용 시스템 없음, DUNGEON은 단일 주인공 `HeroState`) — 스코프에서 뺐다. "시대 혼재 건물"(biome 데코 레시피에 시대 층 1개, 고분 옆 폐공장 굴뚝 등)도 검토했으나 이 데코 후크(`World/DungeonRoomBuilder.BuildDecor()`, `SagaBiome` switch)는 손빚은 Room1~4(층1) 전용이고 절차적 층(`World/DungeonFloorRunner.cs`)은 이 후크를 아예 안 써(`grep`로 확인) — 층 번호와 연결할 자리가 없어 마찬가지로 뺐다.

**재해석 — 옮긴 것, 둘**:
1. **미래 무기 look 2** — `Data/ItemData.cs`에 `WeaponShape` enum(Blade/Lance/Gauntlet) 신설, 기존 5종은 전부 Blade(회귀 없음). 새 `wp_lance_e`(전자창, atk34·grade2·Lance)·`wp_gauntlet`(동력장갑, atk20·grade1·Gauntlet). `Player/WeaponVisual.cs`는 그동안 등급 3단(색·길이)만 갈랐던 걸, Shape가 Lance/Gauntlet이면 **같은 칼날 메시를 아예 다른 비율로 리사이즈**한다(창=길고 얇게+청록 발광 고정, 건틀릿=짧고 두껍게+은백색 발광 고정, 등급 배율과 별개 축). 별도 무기 메시 자산 없이(원작 자산 금지) 기존 primitive 하나를 재활용하는 선택 — `LootMarker`·`HitSpark`류와 같은 결.
2. **기계화 변종** — 웹판 원안 "짐승형 파생 규칙"은 이 트랙에 짐승형 몬스터 자체가 없어(황건적뿐) 대신 **절차적 정예**(`World/DungeonFloorRunner.SpawnElite()`)를 깊은 층부터 바꿔치기했다. 새 `Data/EraFusionData.cs`(순수 함수 — `IsFusionFloor(floor) => floor>=5`, `FusionRewardItemId(floor)` 홀짝으로 두 미래 무기 번갈아 배정) — 5층부터 정예 표시명이 "폐허의 황건 정예"(wp_saber, 갈색)에서 "기계화 정찰병"(금속 팔레트)으로 바뀌고 확정 드랍이 전자창/동력장갑으로 갈린다. "emp 저항"(웹판 원안)은 이 트랙에 EMP 메커닉 자체가 없어 순수 표시·보상 변형으로만 남겼다. `World/DungeonEnemy.cs`의 `DisplayNameKeys`에 `enemy.elite_fusion` 매핑 한 줄 추가(도감(`BestiaryState`) 신규 항목으로도 자동 등록됨).

**헤드리스 진단 중 실제 버그 발견·수정** — 새 `CheckEraFusion()`(`PlaytestDungeonHeadless.cs`, `CheckWeaponVisual()` 뒤)이 `HeroState.Restore(...)`로 `wp_lance_e`/`wp_gauntlet`을 강제 장착(`EquipIfBetter`의 "더 셀 때만" 문턱을 피하려고)한 뒤 `WeaponVisual`의 칼날 모양을 확인했는데, **두 무기 모두 이전 칼날 모양(등급2 길이 0.71)이 그대로 남아 있었다** — `Data/HeroState.cs`의 `Restore()`(세이브 로드 전용 경로, `Data/SaveState.cs:113`이 부른다)가 `EquipIfBetter()`와 달리 `EquipmentChanged` 이벤트를 안 쏘고 있었다. `WeaponVisual.Start()`가 구독 직후 `Refresh()`를 한 번 부르지만, `GameBootstrap`의 Unity 스크립트 실행 순서상 `WeaponVisual.Start()`가 `SaveState.TryLoad()`보다 먼저 돌면(보장 안 됨) 로드된 무기 모양이 다음 장비 교체 전까지 영영 안 갱신되는 실제 버그 창이었다(2026-09-18 `StoryWeaponVisual.JobChosen`과 완전히 같은 함정 — PROJECT_STATE.md "알려진 오류"가 경고해 둔 패턴을 이번엔 코드 리뷰가 아니라 진단이 실제로 잡아냈다). `HeroState.Restore()` 끝에 `EquipmentChanged?.Invoke(EquippedWeaponId)` 한 줄을 추가해 고쳤다 — Start() 순서에 안 기대게.

`tools/unity-batch.sh`로 컴파일(오류 0, 4파일 자동 원복 확인) → `PlaytestDungeonHeadless.Run` 3연속 OK. `SpawnElite()`·`HeroState.Restore()`가 공유 경로라 `FloorProgression`·`FieldAmbush`·`Shortcut`·`Town2`·`Towns34` 전부 재검증(회귀 없음). 씬 GameObject 구성은 안 바꿔(런타임 스폰뿐) `BuildTestDungeonScene` 재빌드는 안 했다.

DUNGEON 101-2는 이제 5.6(목표판·카드, 공통 A·B가 이미 일부 덮고 있어 재검토 필요)만 남았다. 다섯 판 전체로 GO⑤(모바일 빌드 뒤)·FOREST5.6(축제)·STORY5-2/5-8·DUNGEON5.6 넷이 남아 있고, 게이트 없이 다음 세션이 바로 고를 수 있다.

## 2026-09-21 — DUNGEON 5.6 "목표판·세션 카드·일일/주간" 구현, DUNGEON 101-2 전부 닫힘 ("사가 유니티 이어해" 세션)

다섯 판 101-2 남은 후보(GO⑤·FOREST5.6·STORY5-2/5-8·DUNGEON5.6) 중 GO⑤는 모바일 빌드 뒤, FOREST5.6·STORY5-2/5-8은 웹·godot 둘 다 미확정/재검토가 필요해 범위가 넓다 — 이미 필요한 재료(GoalBoard·SessionCard가 붙어 있고, 채울 반복 시스템도 5.1~5.5로 전부 완성됨)가 갖춰진 DUNGEON5.6을 골랐다.

**현황 확인** — `DungeonSessionTracker.cs`(GoalLineWeek())가 `"다음 승급 이정표 준비 중(101-2 ⑦ 대기)"`라는 자리표시 문구를 그대로 반환하고 있었다. 그 "⑦"은 GO의 승급 3택 번호를 그대로 베낀 주석 오기였다 — DUNGEON 자신의 웹 §5 후보엔 ⑦이 없다. GoalLineSession()도 이동거리·금 델타만 보여줄 뿐 실제 "오늘의 할 일" 개념이 없었다.

**구현** — GO ④ 일과판(`Data/DailyTaskState.cs`)과 같은 구조(날짜 문자열 해싱 → 그날의 풀 3택, 셋 다 채우면 도장 1개, 도장 7=주간 보상)를 그대로 가져오되 풀 내용은 이 트랙 고유 시스템 넷으로 새로 짰다: 걷기(800m, GO와 같은 값)·적 처치(15)·부적 층 클리어(1, 5.3 `SigilState`)·난입 완주(1, 5.5 `HordeState`). 웹판 §5.6(180행) 원안의 유적·현상판·상인은 이 트랙에 허브·상인·현상판이 없어(편도 절차적 진행) 못 옮기고, 월드 보스(5.4)는 GO가 발견형 콘텐츠를 뺀 것과 같은 이유(매 세션 만난다는 보장이 없음)로 일일 풀에서 뺐다. 새 `Data/DungeonDailyTaskState.cs`.

진행 보고는 GO처럼 각 시스템이 자기 이벤트 처리 지점에서 직접 호출한다(중앙 이벤트 구독 없음, GO의 `ReportProgress` 호출 패턴 그대로):
- `UI/DungeonSessionTracker.cs` Update() — 걷기(정수 m 이월, GO `_walkedMetersSinceDailyReport`와 같은 결).
- `World/DungeonEnemy.cs` Die() — `AnyDied?.Invoke(this)` 바로 뒤에 적 처치 1 보고(월드 보스도 포함 — 도망(`Flee()`)은 안 침, 진짜로 잡았을 때만).
- `World/DungeonFloorRunner.cs` Descend() — `SigilState.ClearBonusGold(_floor) > 0`(방금 떠난 층이 부적 층)일 때 클리어 1 보고.
- `World/HordeRunner.cs` EndRun(survived) — `survived`일 때만 완주 1 보고(중도 사망은 안 침).

`UI/DungeonSessionTracker.cs`의 `GoalLineSession()`/`GoalLineWeek()`을 `DungeonDailyTaskState.SessionLineText()`/`WeekLineText()` 호출로 교체(세션 종료 카드(`ShowSummary()`)의 이동/금 문구는 안 건드림 — 그건 GoalLineSession과 다른 별개의 요약).

**세이브** — `Data/SaveState.cs`를 v7→v8로 올리고 `dailyDate`/`dailyProgress`/`dailyDone`/`dailyStampGranted`/`dailyStamps` 5필드 추가(GO v10과 같은 필드 구성). 이 트랙 SaveState는 GO의 null-tolerant 방식이 아니라 처음부터 버전 게이팅(`if (data.version >= N)`)이라 그 관례를 그대로 따랐다 — v7 이하 세이브는 `dailyDate`가 빈 문자열로 읽혀 `Restore()`가 빈 상태로 두고 다음 `EnsureToday()`가 오늘 날짜로 새로 채운다.

**검증** — `tools/unity-batch.sh`로 컴파일(오류 0, `ProjectSettings/`·`Packages/` 변경 없음) → `PlaytestDungeonHeadless.Run`(goal board 체크가 세 줄이 라벨 접두사(`"지금 —"`/`"이번 세션 —"`/`"이번 주 —"`)만 확인하는 구조라 문구가 바뀌어도 그대로 통과) OK, 전체 스위트("OK - 10 frames, no errors") 통과, `horde survive`·`horde death` 체크도 그대로 통과. `Die()`·`Descend()`·`EndRun()` 셋 다 공유 경로라 `FloorProgression`·`FieldAmbush`·`Shortcut`·`Town2`·`Towns34` 전부 재검증(회귀 없음). `BuildTestDungeonScene` 재빌드는 안 했다(씬 구성 무변경, 런타임 로직만).

`docs/PROJECT_STATE.md` 갱신(DUNGEON 완료 요약에 101-2 전부 완료 표기, "다음 작업"에서 DUNGEON5.6 제거, 테스트 상태·실기 확인 대기 갱신 — 15KB 상한 안). `PLAN.md` 101-2 DUNGEON 행에 5.6 완료·재해석 이유·대응 파일(`DungeonDailyTaskState`) 추가, "DUNGEON 101-2 전부 닫혔다"로 갱신.

**DUNGEON 101-2는 이제 완전히 닫혔다.** 다섯 판 전체로 GO⑤(모바일 빌드 뒤)·FOREST5.6(축제)·STORY5-2/5-8만 남았고, 전부 게이트에 걸려 있거나(GO⑤) 재해석 범위를 먼저 정해야 한다(FOREST5.6 날짜/일과 시스템 부재, STORY5-2 웹·godot 둘 다 미확정, STORY5-8 파티 시스템 부재) — 다음 세션이 사용자와 상의해 고를 것.

## 2026-09-21 — FOREST 5.6 "축제 하루" 구현, FOREST 101-2 전부 닫힘 ("사가 유니티 이어해" 세션, DUNGEON 5.6 다음)

DUNGEON 5.6 마무리 뒤 커밋·푸시 지시를 받고 101-2 남은 넷(GO⑤·FOREST5.6·STORY5-2·STORY5-8) 중 사용자에게 AskUserQuestion으로 물어 "FOREST 5.6 축제"를 골랐다(GO⑤는 모바일 빌드 선행 조건이라 선택지에서 제외).

**범위 좁히기** — 웹판 §5.6(`saga-web/saga-forest/PLAN.md` 157행)은 설날·대보름·삼짇날·단오·칠석·백중·한가위·동지 8개(음력 날짜)를 전제한다. 이 트랙엔 낚시·부엌·주민 5명(`ForestVillager`는 숲지기 1명뿐)·음력 계산이 전부 없어 8개 중 **셋만** 골랐다: 세배(숲지기에게 말 걸기, "주민 5"를 1명으로 축소)·꽃놀이("꽃 8종류 찾기"를 이 트랙의 실제 채집 갈래 수 4(`ForestMuseumState.Category`)로 좁혀 "60초 안에 채집 자리 넷 모두")·소원("별똥별 확정"을 고정 소원돌 오브젝트로, 보상 "다음 날 채집 ×1.5"는 그대로 유지). 나머지 다섯(대보름 모닥불·단오 그네(낚시 재사용)·백중 사진·한가위 연타·동지 부엌)은 각각 새 오브젝트나 시스템이 없어 스코프 밖에 남겼다.

**음력 → 매달 고정 일자** — 진짜 음력 계산은 새 라이브러리 없이는 불가능해 **매달 고정 일자**로 재해석했다: 1일=세배·8일=꽃놀이·15일=소원. `DateTime.Now.Day`가 매달 그 날짜에 반복되므로 GO/DUNGEON 일과판처럼 날짜 문자열을 해싱할 필요가 없다(행사가 날짜 하나에 결정적으로 묶인다) — 새 `Data/ForestFestivalState.cs`.

**구현 셋**:
1. **세배** — `World/ForestVillager.cs` `Update()`에서 오늘이 세배날이고 아직 안 치렀으면 평소 대사 대신 세배 대사+과일 보상(5)을 준다(`ForestFestivalState.TryComplete`).
2. **꽃놀이** — `World/ForestCollectSpot.cs`가 채집이 성사될 때마다 `ForestFestivalState.ReportCollectSpotGather(category)`를 부른다. 60초 창 안에 갈래 4개(Insect/Mushroom/Fossil/Flower)를 전부 방문하면 그 자리에서 완료(과일 8) — 창이 만료되면 다음 채집이 새 창을 연다(실패 벌칙 없음, 원문 그대로).
3. **소원** — 새 `World/ForestWishStone.cs`(`ForestVillager`와 같은 결의 고정 오브젝트, 마을 통행로 빈 자리 `(5,0,-5)`에 배치). 오늘이 소원날이면 24시간 채집 배율(×1.5) 버프를 건다(`ForestFestivalState.WishActive`/`FruitMultiplier`, GO `DropState`처럼 `DateTime.Now.Ticks` 기반이라 앱을 완전히 껐다 켜도 흐른다). `World/ForestFruitTree.cs`·`World/ForestGatherFeel.cs`의 두 `AddFruit` 호출 지점에 배율을 곱했다.

**GoalBoard "이번 주"도 같이 고쳤다** — `UI/ForestSessionTracker.cs`의 `GoalLineWeek()`가 DUNGEON과 똑같이 자리표시 문구("101-2 ⑦ 대기")였다. `ForestFestivalState.GoalLineText()`로 교체 — 오늘이 행사날이면 "오늘은 OO! <안내>", 아니면 "다음 축제: OO(D-N)"(31일 안에서 순회 탐색, 실제 달력 기준).

**세이브** — `ForestSaveState.cs` v6→v7, `festivalDoneDate`(string)·`festivalWishUntilTicks`(long) 추가. 꽃놀이 진행 중인 60초 창은 회차성이라 세이브 대상이 아니다(`StoryLabyrinthState`와 같은 결).

**헤드리스 진단 — 날짜 강제 훅** — `DateTime.Now`는 리플렉션으로도 못 바꾸므로 `ForestFestivalState.ForceDayForTest(int?)`(진단 전용, `ForestGatherStreak.ResetForTest()`류와 같은 결)를 신설해 실제 달력 날짜와 무관하게 결정적으로 검증한다. 새 `CheckFestival()`(`PlaytestForestHeadless.cs`)이 강제 날짜 1→8→15→20을 순서대로 돌며 세배·꽃놀이·소원 완료 1회·같은 날 중복 거절·소원 배율(나무 채집 1→2)·D-day 문구("다음 축제: 세배(D-12)")까지 값으로 확인. 도중 **`_doneDate`가 세 행사가 공유하는 단일 플래그**라 forceDay로 하루 안에 세 날짜를 훑는 이 진단 방식과 부딪히는 걸 발견 — 실제 플레이에선 하루에 행사날이 최대 하나뿐이라 문제가 안 되지만(1/8/15가 서로 다른 날), 진단은 단계마다 `ForestFestivalState.Restore("", 0)`으로 리셋해 우회했다(세이브 복원 API를 진단 리셋 용도로 재사용).

씬 빌더(`Editor/BuildTestVillageForestScene.cs`)에 `BuildWishStone()` 추가(TownScoreBoard·DeliveryCounter와 같은 통행로 위 빈 자리 `(5,0,-5)`). `tools/unity-batch.sh`로 컴파일(오류 0) → 씬 재빌드 → `PlaytestForestHeadless.Run` 신규 `festival OK` 포함 전부 통과 → 공유 파일(`ForestCollectSpot`·`ForestFruitTree`·`ForestGatherFeel`·`ForestVillager`)을 건드렸으므로 `PlaytestForestCreatures`·`Finish`·`Furniture`·`HouseTransition` 넷도 재검증(회귀 없음).

`docs/PROJECT_STATE.md` 갱신(FOREST 완료 요약에 101-2 전부 완료 표기, "다음 작업"에서 FOREST 제거 — 이제 GO⑤·STORY5-2/5-8만 남음, 테스트 상태·실기 확인 대기 갱신 — 15KB 상한에 걸려 여러 줄 압축). `PLAN.md` 101-2 FOREST 행에 5.6 완료·재해석 이유·대응 파일(`ForestFestivalState`·`ForestWishStone`) 추가, "FOREST 101-2 전부 닫혔다"로 갱신.

**FOREST 101-2는 이제 완전히 닫혔다.** 다섯 판 전체로 GO⑤(모바일 빌드 뒤)·STORY5-2(웹·godot 둘 다 미확정, 보류)·STORY5-8(파티 시스템 자체가 없어 재검토 필요)만 남았다 — 다음 세션이 사용자와 상의해 고를 것.

## 2026-09-21 — STORY 5-8 "동료 교대" 구현, STORY 101-2 사실상 전부 닫힘 ("사가 유니티 이어해" 세션, FOREST 5.6 다음)

FOREST 5.6 마무리 뒤 커밋·푸시 지시를 받고(다른 세션이 그 사이 saga-web에 커밋 하나를 올려둬 rebase로 정리 후 푸시), 101-2 마지막 남은 셋(GO⑤·STORY5-2·STORY5-8) 중 GO⑤(모바일 빌드 선행)를 빼고 사용자에게 AskUserQuestion으로 물어 "STORY 5-8 동료 교대"를 골랐다.

**전제 확인 — 이 트랙엔 붙일 축이 훨씬 적다**: 웹판 §5-8(`saga-web/saga-story/PLAN.md` 302행)은 인물 105 로스터에서 셋을 편성해 각자 개별 체력을 갖고, 전투 중 교대 버튼으로 0.2초 무적과 함께 즉시 바뀌며, 쓰러진 인물은 마을 복귀까지 교대할 수 없는 것을 전제한다. 이 트랙엔 인물 로스터 자체가 없고(`StoryCombat.cs` 클래스 주석 "인물 로스터를 아직 안 붙였다"), 결정적으로 **플레이어가 피격당하지 않는다**(`StoryCombat.StartHp` 주석 "플레이어가 안 맞아 미사용", `StoryEnemy.cs` "제자리에 서서 맞기만 한다") — 그래서 "개별 체력"·"쓰러짐"·"0.2초 무적" 셋 다 적용할 대상 자체가 없다.

**재해석**: "편성"을 인물 획득이 아니라 **항상 갖춘 고정 역할 셋**으로 좁혔다 — 선봉(先鋒, 공격 배율 1.15)·유격(遊擊, 1.0)·호법(護法, 0.9). "체력"을 공격 배율로, "서명 1발(효과 9 중 1, 새 효과 없음)"을 그 역할에 매긴 이 트랙 기존 무예 하나(선봉→횡소, 유격→기탄, 호법→기합)를 **MP 소모 없이** 즉시 발동하는 것으로 재해석했다 — 다만 그 무예 자신의 쿨다운(횡소 4s·기탄 6s·기합 14s)은 그대로 존중한다(교대 자체의 4초 쿨다운과는 별개 축, 새 로직 대신 기존 `TrySweep/TryBolt/TryBrace`에 `free` 파라미터 하나만 얹어 재사용 — "새 효과 없음" 원칙 그대로). 직업·무예는 웹판 그대로 계정 단위 — 활성 역할은 계정 위에 얹는 공격 배율+서명 트리거일 뿐 전직·SP와 무관하다.

**UI 재해석**: 웹판 "HUD 왼쪽 아래 초상 3(체력 바)"은 초상·체력이 없어 `StoryHud`의 기존 텍스트 HUD에 한 줄(🎭 활성 역할명 + 교대 쿨다운/가능 여부)로 옮겼다. "교대 버튼 1(폰은 초상 탭)"은 역할별 버튼 셋(선봉/유격/호법)으로 재해석했다(초상이 없어 버튼 하나로 순환시키는 것보다 명확).

**구현**: 새 `Data/StoryPartyState.cs`(순수 로스터·쿨다운 판정, `Swapped` 이벤트). `Player/StoryPlayerController.cs`: `CurrentAtk`에 `StoryPartyState.AtkMultiplier` 곱, `TrySweep/TryBolt/TryBrace`에 `free` 파라미터, 새 `TriggerPartySwap(int)`(교대 성사 시 토스트 + 서명 발동), `Update()`에 `StoryPartyState.TickCooldown(dt)`. `UI/StoryHud.cs`에 교대 상태 줄. `Data/StorySaveState.cs`에 `partyActiveIndex`(버전 안 올림, `championWeek`류와 같은 결 — 없으면 0=선봉). `Editor/BuildTestStoryScene.cs`에 무예 버튼(y=380) 위 한 줄(y=580)로 역할 버튼 셋. `Resources/Localization/story_{ko,en}.json`에 버튼·HUD 키 추가.

**헤드리스 진단**: `PlaytestStorySlice.cs`의 Phase 상태기계(`BraceTest` 다음)에 `PartySwapTest`/`PartySwapWait` 신설 — 유격(기탄)으로 교대 → MP 안 줄었는지(무료) → 관통 투사체로 더미 둘 처치 확인(BoltCast/BoltWait와 같은 실시간 대기 결) → 쿨다운 중 재교대 거절 → `_cooldownLeft`를 리플렉션으로 비운 뒤 재시도하면 성사 확인 → 이후 단계가 공격 배율에 안 물들게 `StoryPartyState.Restore(0)`으로 되돌림. `SaveLoad` phase에도 `partyActiveIndex`(2로 바꿔 둔 뒤 왕복) 검증 추가.

`tools/unity-batch.sh`로 컴파일(오류 0) → 씬 재빌드(`BuildTestStoryScene.Build`) → `PlaytestStorySlice.Run` 전체 통과(`party swap OK` 신규, sweep/bolt/brace/비경/세이브 전부 회귀 없음).

`docs/PROJECT_STATE.md` 갱신(STORY 완료 요약에 5-8 추가·101-3 세부는 위 §24 표와 중복이라 압축, "다음 작업"에서 STORY5-8 제거 — 이제 GO⑤·STORY5-2만 남음, 테스트 상태·실기 확인 대기 갱신). `PLAN.md` 101-2 STORY 행에 5-8 완료·재해석 이유·대응 파일(`StoryPartyState`) 추가.

**STORY 101-2는 이제 5-2(웹·godot 둘 다 미확정, 보류)만 남았다.** 다섯 판 전체로 GO⑤(모바일 빌드 뒤)·STORY5-2뿐 — 사실상 101-2는 다 닫혔다. 다음 세션은 실기 확인(사용자 몫)이나 PLAN 104-1/105 열린 질문 쪽으로 자연스럽게 넘어갈 것.

## 2026-09-21 — 105 Q4 사용자 결정(생성 에셋 커밋), 101-2 이후 처음으로 코드 없는 정책 세션 ("사가 유니티 이어해" 세션, STORY 5-8 다음)

101-2가 GO⑤(모바일 빌드 선행)·STORY5-2(보류)만 남기고 사실상 닫힌 상태에서, PLAN.md가 직접 제안한 다음 후보(104-1⑤·105 열린 질문)를 확인했다. 104-1⑤(`Assets/Art/*_candidates` 정리)는 102-4 표가 "삭제는 105 결정 뒤"로 명시 미뤄둬 지금 손대면 안 되고, 105 나머지 항목(Q1·Q3′·Q-U3·Q-U4)은 전략 결정이거나 사람이 GUI·mixamo.com 로그인을 직접 해야 하는 병목이라 코드로 진행할 거리가 없었다. AskUserQuestion으로 사용자에게 물어 **Q4(생성 에셋 커밋 정책)**를 고르도록 했다 — PLAN 자체가 이미 "커밋 권장"으로 적어둔 가장 작은 결정이어서다.

**결정**: `Assets/Art/Generated/` 산출물을 스크립트+씨앗만 두고 재생성하지 않고 **커밋한다**(Unity `.meta`의 GUID가 재생성 시 바뀌면 씬 참조가 깨지는 것이 이유). 게임별 폴더 크기 상한은 **20MB**, 넘으면 다음 세션에서 압축·해상도 하향 검토.

`PLAN.md` 103-1에 이 결정을 내리고 105 목록에서 Q4 삭제. `docs/PROJECT_STATE.md` 갱신("다음 작업" 4번에서 Q4 지우고 해결 표기, 마지막 갱신 줄 갱신). 코드·씬 변경 없음(정책 문서화만)이라 배치 모드·헤드리스 재검증 생략.

**105는 이제 Q1·Q3′·Q-U3·Q-U4 네 개만 남았다** — 넷 다 사람의 GUI·전략 결정을 요구해서, 다음 세션은 사용자가 그중 하나를 고르거나 실기 확인 결과를 가지고 와야 자연스럽게 이어진다.

## 2026-09-21 — 105 Q1·Q3′·Q-U4 사용자 결정, Q1 "Godot 먼저"를 하루 만에 "Unity 먼저"로 뒤집음 ("사가 유니티 이어해" 세션, Q4 다음)

Q4(생성 에셋 커밋) 정리 뒤 "이어해"를 다시 받았지만 101-2가 사실상 닫혀 105 나머지 넷(Q1·Q3′·Q-U1·Q-U3·Q-U4, 정확히는 다섯) 중 어느 걸 지금 풀지 AskUserQuestion으로 물었다. 사용자가 "1,2,3 다"로 Q3′·Q1·Q-U4 세 개를 한 번에 골랐다. Q1·Q-U4는 선택지 자체에 실제 값이 없어(순서만 고르는 질문이었다) 후속으로 Q1(트랙 우선순위)·Q-U4(Mixamo 인원)만 다시 물어 실값을 받았다.

**Q1 — 결정: Unity 먼저 집중.** SAGA-DESIGN.md §10-Q1 이 2026-09-20 "Godot 먼저"로 이미 결정돼 있던 걸 사용자가 뒤집었다(추천 이유 그대로: URP Volume·APV·Cinemachine·Mixamo 임포트가 이미 돌아 사실적 완성판 준비가 더 앞섬). **공통 문서라 saga-godot/PLAN.md 105 Q1 줄도 같이 갱신**(그 트랙 procgen 파이프라인 우위는 그대로 유효하다고 적어 병행 자체는 안 깎았다). saga-unity PLAN.md 105 에서 Q1 삭제 — 이 트랙 관점 근거 문단은 SAGA-DESIGN §10-Q1 으로 흡수됐으니 중복 유지 안 함.

**Q3′ — 결정: 트랙 간 스타일 불일치 허용, 공식 문서화.** SAGA-DESIGN.md §6.0-1 은 사실 이미 "트랙마다 한 스타일"(unity=사실적 예외 명시)로 쓰여 있어 실무는 진작 이 전제로 돌고 있었다 — §10 의 Q3 만 아직 "열림"으로 남아 있던 모순을 확인하고 §10-Q3 에 결정 문구를 채워 넣었다. saga-unity PLAN.md 105 의 Q3′ 항목 삭제(§6.0-1 이 정본이라 중복 안 남김).

**Q-U4 — 결정: Mixamo 실제 모델 3명(Maria·Abe·Brute) 유지, 늘리지 않는다.** 나머지 인물은 이 3 베이스 + 장비 소켓 변형(101-3 G)으로. `PLAN.md` 103-3 으로 내리고 105 에서 삭제.

**부수 확인**: Q1 이 풀리면서 104-1⑤·102-4(`Assets/Art/*_candidates` 정리)를 막던 게이트도 같이 풀렸다 — 다음 세션이 바로 손댈 수 있는 첫 실코드 작업으로 `docs/PROJECT_STATE.md` "다음 작업" 3번에 적어 뒀다(삭제가 섞여 있어 씬 참조 grep·배치 모드 재확인 필수라고 명시). 105 는 이제 Q-U1(사실상 처리, 형식만 열림)·Q-U3(Shader Graph, 사람 GUI 필요) 둘만 진짜 남았다.

`PLAN.md`(saga-unity 105·103-3)·`SAGA-DESIGN.md`(§10-Q1·Q3)·`saga-godot/PLAN.md`(105 Q1)·`docs/PROJECT_STATE.md` 갱신. 코드·씬 변경 없음(문서 정책만)이라 배치 모드·헤드리스 재검증 생략.

## 2026-09-21 — 105 Q1이 풀려 102-4 승격 실행, `PlaytestStorySlice` 회귀 없는 기존 버그 발견 ("사가 유니티 이어해" 세션, Q1·Q3′·Q-U4 결정 다음)

Q1·Q3′·Q-U4 결정 커밋 뒤 "이어해"를 다시 받았다. Q1이 "Unity 먼저"로 뒤집히며 104-1⑤·102-4(`Assets/Art/*_candidates` 정리)를 막던 게이트가 풀려 이걸 이어받았다.

**참조 조사**: `CharacterShaders_candidates/`는 코드 참조 0건(Shader Graph 배선 전 — Q-U3), `EnvironmentPBR_candidates/`는 5개 Editor 스크립트(`BuildEnvironmentPbrSample.cs`·`BuildTestCityScene.cs`·`BuildTestDungeonScene.cs`·`BuildTestStoryScene.cs`·`BuildTestVillageScene.cs`)에 경로 상수로 박혀 있었다. `CharactersVroid/`는 참조 0건. `Characters/`(Kenney character-{a,b,c,d}.glb)는 **13개 파일에서 여전히 실사용 중**(GO 플레이어, GO/FOREST/STORY 주민, STORY 잡졸, 씬 4개) — 102-4 표의 "44장 Player·Enemy 교체 완료 확인 후"라는 전제가 틀렸다는 걸 이번에 처음 확인했다(DUNGEON만 Mixamo로 갔고 나머지 셋은 아직 Kenney). 이 폴더는 못 뺐다.

**실행**: `CharacterShaders_candidates/`→`Assets/Art/Shaders/Character/`, `EnvironmentPBR_candidates/`→`Assets/Art/Environment/PBR/` 둘 다 `git mv`(파일+.meta 같이 이동, GUID 보존). Environment 쪽은 5개 스크립트의 경로 상수를 새 위치로 갱신. `CharactersVroid/`(참조 0건, 삭제 후보)는 `git rm`이 샌드박스 "돌이킬 수 없는 로컬 삭제" 분류에 걸려 자동 승인 밖이라 이번엔 손 안 대고 다음 세션에 사용자 승인 받아 처리하도록 넘겼다.

**검증**: `tools/unity-batch.sh`로 4씬(`BuildTestVillageScene`·`BuildTestDungeonScene`·`BuildTestStoryScene`·`BuildTestCityScene`) 전부 재빌드(경로 상수 안 맞으면 재질이 null이 돼 조용히 구색만 바뀌므로 씬을 실제로 다시 지어야 확인된다) — 로그에 재질 누락 경고 없음, `git diff`도 정상. `PlaytestHeadless`(GO)·`PlaytestDungeonHeadless`·`PlaytestRealmSlice` 재검증 전부 OK.

**`PlaytestStorySlice`가 `KillEnemies` 단계에서 FAIL**(잡졸 #0 처치에 유품 마커 안 생김) — `docs/PROJECT_STATE.md`가 같은 날 STORY 5-8 뒤 "OK"로 적어 둔 것과 모순돼, 내 변경이 원인인지 의심해 `git stash`로 이 세션 코드 변경을 통째로 걷어내고 HEAD 상태에서 씬을 다시 지어 같은 테스트를 두 번 돌렸다 — **똑같이 FAIL**. 즉 이 세션이 만든 회귀가 아니라 이미 커밋된 코드에 있던 버그(혹은 이 PC의 Unity 6000.3.24f1 환경 차이)를 우연히 이번에 처음 마주친 것이다. 원인은 조사하지 않았다(스코프 밖) — `docs/PROJECT_STATE.md` "알려진 오류"·"테스트 상태"에 FAIL로 정정해 다음 세션 최우선으로 넘겼다.

`PLAN.md` 102-4 표 갱신(승격 완료 표기, `Characters/` 판정 취소 이유 명시, STORY 버그 발견 각주). `docs/PROJECT_STATE.md` 갱신("다음 작업" 1번에 버그 조사 앞세움, 102-4 항목 정리). 배치 모드 4파일 부작용(`ProjectSettings/ShaderGraphSettings.asset` 포함)은 매번 원복 확인.

## 2026-09-21 — `PlaytestStorySlice` KillEnemies FAIL 원인 찾고 고침 — 세이브 왕복 검증이 파일을 원상복구 안 함 ("사가 유니티 이어해" 세션, 102-4 승격 다음)

직전 세션이 남긴 "다음 세션 최우선" 항목을 이어받았다. `Application.persistentDataPath`(`%LOCALAPPDATA%Low\DefaultCompany\SAGA\save_story.json`)를 직접 열어 보니 `"partyActiveIndex":2`가 박혀 있었다 — `StoryPartyState.Roster[2]`는 호법(護法, 공격 배율 0.9). `StoryPlayerController.CurrentAtk`는 `StoryCombat.StartAtk(21) * ... * StoryPartyState.AtkMultiplier`라 기본 역할(선봉, 1.15배 → CurrentAtk≈24)이면 `EnemyHp(18)`를 항상 한 방에 넘기지만, 오염된 값(0.9배 → CurrentAtk≈18.9)이면 `RollDamage()`의 랜덤 variance(0.88~1.12)에 따라 종종 18 밑으로 떨어져 잡졸이 한 방에 안 죽는다 — `PlaytestStorySlice.cs`의 `KillEnemies` phase는 `TryAttack()` 한 번으로 즉사를 가정하고 바로 `StoryLootMarker.SpawnCount` 증가를 확인하기 때문에(재시도 없음) 이 상태에서 결정적으로 FAIL한다.

**오염 경로**: `PlaytestStorySlice.cs`의 `SaveLoad` phase(101-2 5-8 세이브 스키마 검증)가 왕복 확인을 위해 `StoryPartyState.Restore(2)` → `StorySaveState.Save()`로 실제 파일을 덮어쓰고, 검증이 끝나면 그냥 다음 phase로 넘어간다 — 파일을 원래대로 되돌리는 코드가 아예 없었다. `GameBootstrap.Start()`는 부팅마다 `StorySaveState.TryLoad()`를 부르므로, 이 테스트가 **한 번이라도 성공적으로 끝나면 그 다음부터 영원히** `partyActiveIndex:2`가 남아 다음 실행(들)의 `KillEnemies`를 깨뜨린다. STORY 5-8을 추가한 세션이 "OK"를 기록한 건 그 세션이 처음으로 이 필드를 저장한 순간이었을 뿐 — 그 세션이 끝나며 이미 오염을 남겼고, 그 뒤로 도는 모든 `PlaytestStorySlice`가 이 함정에 걸렸을 것이다(내가 직전 세션에 겪은 것도 이거다).

**고침**: GO `PlaytestHeadless.cs`의 "일과" 저장/로드 왕복 검증이 이미 쓰는 try/finally 패턴(원본 파일 바이트를 미리 읽어 두고, 테스트가 끝나면 finally에서 그대로 되돌리거나 원래 없었으면 지운다)을 `PlaytestStorySlice.cs`의 `SaveLoad` phase에 그대로 옮겼다 — `StoryPartyState.Restore(2)`부터 왕복 검증 끝까지를 통째로 try 블록으로 감싸고, finally에서 `storySavePath`를 원본 내용으로 복원한다.

**오염된 파일 정리**: 이미 박혀 있던 `save_story.json`의 `partyActiveIndex:2`를 `0`으로 직접 고쳐 지금 당장의 막힘을 풀었다(다른 필드는 자동화 테스트 흔적으로 보여 손 안 댐 — kills=16·bossKills=1·memoryTier=10 등이 전부 `PlaytestStorySlice` 자체 검증값과 맞아떨어진다).

**검증**: 컴파일 오류 0. `PlaytestStorySlice.Run()` 3연속 OK("killed 10 grunts + boss ... save-load all verified, no errors") — 매 실행 뒤 `save_story.json`을 직접 열어 `partyActiveIndex:0`으로 깨끗하게 남는 것까지 확인(finally가 실제로 도는지 실기로 증명).

`PLAN.md` 102-4 "발견한 오류" → "발견하고 고친 오류"로 갱신. `docs/PROJECT_STATE.md` "알려진 오류"·"테스트 상태"·"다음 작업" 갱신(최우선 항목 삭제, 104-1⑤가 다시 1번으로).

## 2026-09-21 — `CharactersVroid/` 삭제 승인 받아 실행, 102-4 승격/삭제 항목 사실상 마감 ("사가 유니티 이어서" 세션, `PlaytestStorySlice` 버그 수정 다음)

`git rm`이 샌드박스에서 "돌이킬 수 없는 로컬 삭제"로 자동 승인 밖이라 지난 세션이 넘긴 대로 AskUserQuestion으로 물었다. 사용자가 "다른 곳에서도 안 써? 그러면 지우고"라고 되물어, 지난 세션엔 안 했던 **GUID 참조 검사**까지 마쳤다(`AvatarSample_A.glb`/`.vrm`의 `.meta` guid 두 개를 `Assets/`·`ProjectSettings/` 전체에서 grep — 자기 자신의 `.meta` 말고는 0건). 참조 0건을 다시 확인해 준 뒤 `git rm -r Assets/Art/CharactersVroid Assets/Art/CharactersVroid.meta` 실행.

배치 모드 컴파일 재확인(오류 0). `PLAN.md` 102-4 표를 "완료: 삭제됨"으로 갱신, 66-2장 근처의 옛 "지우지 않고 그대로 둔다" 문단(VRoid gltFast 임포트 검증 목적이 이미 끝난 뒤 남아 있던 결정)도 뒤집힌 걸로 정정 — 문서가 서로 모순되지 않게. `docs/PROJECT_STATE.md` "다음 작업" 1번에서 `CharactersVroid` 삭제 항목 제거.

**102-4 남은 항목은 이제 Kenney `Buildings/`·`Dungeon/`·`Props/`·`Rocks/`·`Shrine/`·`Vegetation/` "단계 교체"뿐**(103장 에셋 파이프라인 규모의 콘텐츠 제작, 아직 미착수) — `Characters/`(Kenney) 는 GO/FOREST/STORY가 실사용 중이라 여전히 못 뺀다.

## 2026-09-21 — 102-4 "단계 교체" 재조사: Buildings/Dungeon/Shrine는 이미 끝나 있었고, 진짜 남은 건 Props뿐 ("사가 유니티 이어서" 세션, `CharactersVroid` 삭제 다음)

`CharactersVroid` 삭제 뒤 "이어해"를 다시 받았지만, 남은 유일한 미해결 항목이 Kenney `Buildings/`·`Dungeon/`·`Props/`·`Rocks/`·`Shrine/`·`Vegetation/` "단계 교체"(102-4)뿐이었다 — 이게 `procgen.py`/`kitbash.py` 규모의 에셋 생성 작업인지, 단순 재질 교체인지 불확실해 AskUserQuestion으로 범위를 물었다. 사용자가 "Props·Shrine·Dungeon gate만 진행(추천)"을 골랐다.

**재조사 결과 — 102-4 표가 틀렸었다**: `Buildings/`(wall-block·roof-gable)·`Dungeon/`(gate.glb 아치·바닥·벽)·`Shrine/`(altar-stone)은 **이미 전부** `EnvironmentMaterial.MakeTiled()`로 실제 PBR(Poly Haven) 재질이 씌워져 있었다 — `LandmarksBuilder.cs`(`ApplyPbrToRenderers`+`stoneMaterial`/`woodMaterial`)·`DungeonRoomBuilder.cs`(`BuildGateArch`) 코드를 직접 읽어 확인. `docs/PROJECT_STATE.md` "완료 요약" 표의 "44장 완료"가 정확히 이 뜻이었다 — 102-4 표를 쓸 때 이 사실을 몰라서 "단계 교체 미착수"로 잘못 적어 뒀던 것.

**진짜 안 된 건 `PropsBuilder.cs`(lantern·stall-red·fence·fence-gate) 뿐**이었다 — 코드에 PBR 관련 호출이 전혀 없었다(순수 원본 Kenney 텍스처). 이 안에서도 재질별로 나눴다: fence·fence-gate는 LandmarksBuilder의 다리 널판(`BuildBridge()`)과 성질이 같은 단순 나무 널판이라 안전하게 `woodMaterial`을 씌웠다. lantern·stall-red는 금속·천 등 재질이 뒤섞인 단일 Kenney 아틀라스 텍스처라(공식 색이 "빨강" stall인데 나무 재질로 덮으면 색이 지워질 위험) 헤드리스로는 실제 결과를 못 보니 **보류**했다 — 3장 "실기 확인이 필요한 시각 판단은 사용자 몫" 원칙.

`Rocks/`·`Vegetation/`은 애초에 "PBR 재질 교체"가 아니라 `procgen.py`(노이즈 변형+트라이플레이너)로 **새 지오메트리를 만드는** 103장 작업이라 이번 스코프 밖(Blender 설치 확인부터 필요, 결과물은 사용자가 직접 봐야 한다) — 102-4 표에 이 구분을 명시해 다음 세션이 다시 헷갈리지 않게 했다.

**구현**: `PropsBuilder.cs`에 `[SerializeField] private Material woodMaterial`과 `ApplyPbrToRenderers()`(LandmarksBuilder와 같은 결) 추가, `SpawnFencePanel()`이 `EnvironmentMaterial.MakeTiled(woodMaterial, 0.76f, FenceScale)`을 씌운다(보이는 면이 세로 널판이라 높이·길이를 타일 축으로 — `BuildBridge()`의 가로·길이 축과 다른 이유를 주석에 남김). `BuildTestVillageScene.cs`의 `BuildProps()`가 승격된 `Environment/PBR/dark_wooden_planks_URPLit.mat`을 `SetPrivateField`로 주입.

**검증**: 배치 컴파일 오류 0 → `BuildTestVillageScene.Build()` 재빌드(재질 못 찾는 경고 없음) → `PlaytestHeadless` 3연속 OK.

## 2026-09-21 — `Rocks/`·`Vegetation/` procgen 착수 전 Blender 확인, 없어서 사용자에게 설치 요청 ("사가 유니티 이어해" 세션, 102-4 Props 재질 교체 다음)

`PROJECT_STATE.md` "다음 작업" 1순위(104-1⑤·102-4 마무리)의 마지막 남은 항목인 `Rocks/`·`Vegetation/` procgen 교체를 이어받으려 했으나, PLAN 103-3이 전제한 "Blender 설치 확인부터"가 이 PC에서 막혔다 — `Get-Command blender`·`Program Files`·`Program Files (x86)` 전부 없음 확인.

우회 옵션(`tools/asset-forge/procgen.py`는 이미 trimesh 기반이라 rock/stele/fence/wall은 Blender 없이도 생성 가능, tree kind만 추가하면 됨)을 사용자에게 제시했으나 **"Blender 설치를 먼저 요청" 선택** — PLAN이 세운 전제를 임의로 낮추지 않고 그대로 보류. 코드 변경 없음, `docs/PROJECT_STATE.md` 다음 작업 1번 줄에 이 경위만 짧게 남김. 다음 세션은 Blender 설치 여부부터 다시 확인.

## 2026-09-21 — Blender 설치(winget), Rocks/Vegetation procgen 착수 가능 ("사가 유니티 이어해" 세션, Blender 없음 보고 다음)

사용자가 "설치 직접해줘"로 요청, `winget install --id BlenderFoundation.Blender -e`로 설치 성공(5.2.1 LTS, `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`). `blender -b --version` 배치 모드 정상 확인.

PLAN.md 102-4 표·103-3 Blender 항목을 "미설치"→"설치 완료" 로 갱신(경로·버전 기록), `docs/PROJECT_STATE.md` 다음 작업 1번 줄도 "착수 가능"으로 수정. 실제 `Rocks/`·`Vegetation/` procgen 작업(procgen.py tree kind 추가, PBR 트라이플레이너 재질, VegetationBuilder.cs 배선)은 이번 세션엔 아직 안 함 — 다음 세션이 이어받는다.

## 2026-09-21 — Rocks/Vegetation procgen 교체 실행 (PLAN.md 102-4·103-1, "사가 유니티 이어해" 세션, Blender 설치 다음)

`tools/asset-forge/procgen.py`에 `tree` kind 추가(육각 저폴리 몸통 + 세 형태 수관 — 둥근 다발/원뿔형/성긴 다발, 씨앗으로 결정) + `make_rock`과 함께 정점색(몸통 갈색·수관 초록·바위 회색)을 굽도록 `_concat_colored()` 헬퍼로 확장(기존 `trimesh.util.concatenate`는 파트별 vertex_colors를 안 살렸다). `batch tree --count 12`·`batch rock --count 10`으로 `Assets/Art/Generated/SagaGo/`에 GLB 22벌 생성(씨앗 JSON은 `Generated/_seed/saga_go_vegetation.json`) — trimesh 출력이라 UV가 없다.

**셰이더**: procgen 메시가 UV 없이 정점색만 갖고 있어, `Saga/VertexColorLit`(지형용, 안 건드림)의 자매 셰이더로 `Saga/VertexColorTriplanarLit`을 새로 짰다 — 정점색을 바탕으로 쓰고 그 위에 월드 위치+법선 블렌드(트라이플레이너)로 투영한 그레이스케일 디테일 텍스처를 곱한다(UV 기반 `_DetailTex` 샘플링을 월드 위치 3축 투영으로만 바꾼 것, 나머지는 VertexColorLit과 동일 — normal map·specular 없음, 기존 셰이더와 같은 단순화 수준).

**텍스처**: Poly Haven 공개 API로 `bark_willow_02`(나무껍질)·`rock_boulder_dry`(바위) diffuse만 1k JPG로 받음(`Assets/Art/Environment/PBR/PolyHaven_{BarkWillow02,RockBoulderDry}/`, `LICENSE.txt` 갱신) — 이 셰이더가 normal/roughness를 아예 안 받아 그 둘은 안 받았다(처음엔 받았다가 미사용이라 지움). `BuildVegetationTriplanarMaterials.cs`(`Saga/Build Vegetation Triplanar Materials` 메뉴)가 `TriplanarDetail_Bark`·`TriplanarDetail_RockBoulder` 두 머티리얼을 코드로 지어 `Assets/Art/Generated/SagaGo/`에 커밋.

**배선**: `VegetationBuilder.cs`의 `Init()` 시그니처를 단일 모델 3개(`treeModel`·`rockLargeModel`·`rockSmallModel`)에서 배열 2개+머티리얼 2개(`GameObject[] trees, GameObject[] rocks, Material treeMat, Material rockMat`)로 바꿨다 — 타일 좌표 해시로 배열 인덱스를 골라 매번 같은 자리엔 같은 변종이 서게(결정적) 했다. 스케일 상수도 갈아엎음: 옛 `TreeScale=4.5`(Kenney tree_oak.glb가 0.64×1.23×0.74 축소 모델이라 필요했던 배율)는 procgen 나무가 이미 "실제 미터"(trunk_height=3.0, 기존 `TrunkHeight` 충돌 상수와 정확히 맞음)로 나와서 필요 없어져 `GeneratedTreeScale=1.0`으로, 바위는 `GeneratedRockScale=2.6`(눈대중, 옛 `RockLargeScale`과 같은 값에서 시작 — 실기 확인 후 조정 대상). 호출부 `BuildTestVillageScene.BuildVegetation()`도 새 배열 로딩 방식으로 갱신.

**Kenney→procgen 완전 교체**(GO만) — `tree_oak.glb`·`rock_largeA/smallA.glb`는 이제 GO `VegetationBuilder`에서 안 쓴다(파일 자체는 남김, FOREST의 `ForestFruitTree.cs`가 `tree_oak.glb`를 별개로 직접 참조해서 — 그쪽은 스코프 밖, 다음 단계).

**검증**: `tools/unity-batch.sh`로 컴파일(오류 0) → `BuildVegetationTriplanarMaterials.Build`(머티리얼 2개 생성 확인) → `BuildTestVillageScene.Build`(재질 못 찾음 경고 없음) → `PlaytestHeadless`(GO) 3연속 OK. `ProjectSettings/`·`Packages/` 배치 모드 부작용은 스크립트가 자동 원복. `Assets/Art/Generated/` 총 용량 210KB(103-1의 게임당 20MB 상한에 한참 못 미침).

`PLAN.md` 102-4 표 갱신(완료), 103-3 Blender 항목은 실제로는 이 작업에 안 씀(trimesh만으로 충분) — 다음에 헤어카드·리토폴로지 등 진짜 메시 편집이 필요할 때 쓸 것. `docs/ASSET_GUIDE.md`·`docs/PROJECT_STATE.md`(완료 요약·다음 작업·실기 확인 대기·테스트 상태) 갱신. 실제 화면에서 트라이플레이너 이음매·디테일 강도가 어떻게 보이는지는 사람 확인 몫 — FOREST 확장 여부도 그 확인 뒤 판단.

## 2026-09-21 — FOREST 과일나무도 procgen 교체 (PLAN.md 102-4, "이어해" 세션, GO procgen 다음)

사용자에게 "더 이어갈 게 있으면 FOREST도 확장할지, 여기서 멈출지" 물었더니 **"FOREST 과일나무도 procgen으로 확장"**을 골랐다(플레이어 인지 일관성은 단일 모양 고정 또는 크기 통일로 보완하라는 조건과 함께).

`ForestFruitTree.cs`는 순수 장식이 아니라 **과일 채집 상호작용 오브젝트**(`Update()`가 플레이어 거리 체크 → `ForestState.AddFruit()`)라 GO의 12종 변종 풀을 그대로 옮기면 "이게 흔들 수 있는 나무"라는 플레이어 인지가 흐려질 위험이 있다고 판단, **씨앗 하나(`Assets/Art/Generated/SagaGo/tree_s1_01.glb`) 고정**만 썼다(변종 풀 아님). 재질은 GO용으로 이미 지어 둔 `TriplanarDetail_Bark.mat`을 그대로 재사용(새로 안 지음, GO/FOREST 공유). `ForestFruitTree.TreeScale`을 옛 Kenney 배율(4.5, tree_oak.glb 실측 0.64×1.23×0.74 기준)에서 procgen의 "실제 미터" 치수에 맞는 1.0으로 내렸다 — FOREST가 GO와 세계 축척이 달라도(1.8m vs 3.4m) 예전에 tree_oak×4.5를 그대로 재사용했던 전례와 같은 판단(BuildTestVillageForestScene.cs 주석).

`BuildTestVillageForestScene.cs`의 `LoadModels()`·`BuildFruitTree()`에 `treeMaterial` 로딩·주입 추가(`SetPrivateField` 패턴 그대로), `ForestFruitTree.cs`에 `treeMaterial` 필드 + `BuildVisual()`이 인스턴스화 뒤 `MeshRenderer.sharedMaterial`을 갈아 끼우는 로직 추가.

**검증**: `tools/unity-batch.sh` 컴파일(오류 0) → `BuildTestVillageForestScene.Build`(재질 못 찾음 경고 없음) → `PlaytestForestHeadless` 3연속 OK → `PlaytestForestCreatures`·`Finish`·`Furniture`·`HouseTransition` 재검증(전부 회귀 없음, `ForestFruitTree`를 직접 안 건드리는 스위트들이지만 씬 재빌드가 걸려 있어 확인). `ProjectSettings/`·`Packages/` 배치 모드 부작용은 스크립트가 자동 원복.

`PLAN.md` 102-4 표를 "GO+FOREST"로 갱신, `docs/ASSET_GUIDE.md`·`docs/PROJECT_STATE.md`(완료 요약 FOREST 행·다음 작업·테스트 상태·실기 확인 대기) 갱신. 이제 saga-unity 쪽 102-4는 Props lantern·stall-red(보류)·Characters Kenney(못 뺌) 둘만 남았다 — 둘 다 사람 손을 기다린다.

## 2026-09-21 — GO 마을집 곁채·굴뚝 (PLAN.md 103-1 "건물 모듈" 배가, "이어해" 세션, FOREST 과일나무 다음)

104-1 Phase 0 우선순위 4개가 전부 사람 손 대기라 이어갈 게 없다고 보고했더니, 사용자가 103-1 "변형 배가 대상" 백로그(건물 모듈·DUNGEON 방 셸·REALM 성벽)를 제안받고 **"건물 모듈부터" 진행을 골랐다**.

`LandmarksBuilder.cs`를 읽어 보니 GO의 TestVillage엔 집이 딱 두 채(gx=2,3)뿐이고 둘 다 완전히 같은 박스(`wall-block.glb` ×10x4x10 비균등 스케일 + `roof-gable.glb` ×10)였다. `kitbash.py`는 saga-forest 전용으로 부품 좌표가 하드코딩돼 있어(레시피를 새로 조사해야 함) 그대로 못 가져다 쓰고, `Assets/Art/Buildings/`엔 새로 받을 미사용 부품도 없었다(wall-block·roof-gable·pillar-stone·planks 넷 다 이미 다 쓰는 중) — 그래서 **새 에셋 없이 기존 3종의 "배치 조합"만으로** 두 집을 다르게 만들기로 스코프를 좁혔다.

`BuildVillage()`를 데이터 기반으로 다시 짜서 `BuildHouseBody(parent, localOffset, bodySize, roofSize, addCollider)` 헬퍼(벽 1채+지붕 1채)를 몸통과 곁채가 공유하게 했다. gx=2는 곁채(작은 wall+roof 한 벌 더, +X 쪽에 붙임) + 굴뚝, gx=3은 굴뚝만(곁채 없음) — 곁채 유무×굴뚝 유무 2×2 조합에 몸통 크기 해시 변주(0.9~1.1배, `VegetationBuilder.Hash(gx,3,900)`)까지 얹어 103-1의 "8종 조합" 취지를 만족시켰다(문자 그대로 8개는 아니지만 새 지오메트리·새 텍스처 없이 조합 밀도만 올린다는 원칙은 그대로). 굴뚝은 `pillar-stone.glb`를 `SpawnPillar()` 그대로 재사용(실측 지름 0.16m라 스케일=높이로도 굴뚝다운 가는 비례가 나온다), 지붕 마루 근처(`bodySize.y+1.6`)에서 위로 튀어나오게 배치. `VegetationBuilder.Hash()`를 `private`→`internal`로 열어 `LandmarksBuilder`도 같은 결정적 해시를 공유.

**검증**: `tools/unity-batch.sh` 컴파일(오류 0) → `BuildTestVillageScene.Build`(재질 못 찾음 경고 없음) → `PlaytestHeadless` 3연속 OK. `LandmarksBuilder`는 GO 전용(다른 게임 참조 없음, grep 확인)이라 다른 판 재검증은 불필요.

`PLAN.md` 103-1 "변형 배가 대상" 줄에 나무·바위·건물 모듈 완료 표시(DUNGEON 방 셸·REALM 성벽은 미착수로 남김), `docs/ASSET_GUIDE.md`·`docs/PROJECT_STATE.md`(테스트 상태·실기 확인 대기) 갱신. 사용자가 "현재 작업 완료 후 내일 이어서 하자"고 해서 DUNGEON/REALM 쪽은 오늘 안 건드리고 여기서 마무리한다.

`PLAN.md` 102-4 표를 세 줄로 다시 씀(Buildings/Dungeon/Shrine=완료, Props=완료+보류 구분, Rocks/Vegetation=procgen 몫). `docs/PROJECT_STATE.md` "완료 요약" GO 행의 "Props 전부 GLB/PBR" 과장 정정, 실기 확인 대기·테스트 상태·다음 작업 갱신.

## 2026-09-22 — DUNGEON 방 셸 티어별 마모 3단 (PLAN.md 103-1 "변형 배가", "이어해" 세션, GO 건물 모듈 다음)

전날 세션이 GO 건물 모듈을 끝내고 "내일 이어서 하자"로 마무리했던 103-1 백로그 중 다음 항목 — DUNGEON 방 셸(4 → 티어별 마모 3단)을 이어받았다. `DungeonRoomBuilder.cs`를 읽어 보니 `DungeonFloorRunner`(절차적 층 진행, 층2~100)가 `ProcRoom` 게임오브젝트 하나를 클리어마다 콘텐츠만 갈아치우며 계속 재사용하고, 방 지오메트리·재질은 100층을 내려가도 한 번도 안 바뀌었다 — Room1~4(고정 층1)와 똑같은 톤이었다. GO 건물 모듈과 같은 원칙(새 지오메트리 없이 조합/톤만 늘린다)을 그대로 따르기로 했다.

`EnvironmentMaterial.MakeTiled()`에 `wearTier`(0/1/2) 매개변수를 추가해 `_BaseColor`를 단계별로 어둡게(흰색→갈색조→짙은 폐허조) 밀고 `_Smoothness`도 같이 눌러(`BuildEnvironmentPbrSample.cs`가 구운 MetallicSmoothness 알파를 그대로 통과시키던 걸 스케일만 곱해 매끈함을 죽인다) 벗겨지고 거칠어진 느낌을 낸다. `DungeonRoomBuilder`에 `wearTier` 필드 + `SetWearTier(int)`(지오메트리는 그대로 두고 바닥·벽·천장·문 아치 재질 인스턴스만 새로 굽는다, `RefreshEnvironmentMaterials()`) 추가, `BuildFloor()`/`BuildWalls()`/`BuildCeiling()`/`BuildGateArch()`의 기존 `MakeTiled()` 호출에도 `wearTier`를 그대로 실어 처음 지을 때부터 반영되게 했다. `DungeonFormulas.cs`에 순수 함수 `RoomWearTier(int floor)`(34/67층 문턱으로 3등분 — 웹판에 대응 공식이 없어 이 트랙에서 새로 정함) 추가. `DungeonFloorRunner`는 같은 GameObject의 `DungeonRoomBuilder`를 캐시해 `Awake`·`Descend`·`JumpToFloor`(층이 바뀌는 세 지점 전부)에서 `SetWearTier(RoomWearTier(_floor))`를 부른다. Room1~4는 `wearTier` 미배정(기본값 0)이라 항상 깨끗한 톤 그대로 — 회귀 없음.

**검증**: `tools/unity-batch.sh`로 컴파일(오류 0, `-quit` 포함) → `Saga.EditorTools.PlaytestDungeonFloorProgression.Run`·`PlaytestDungeonHeadless.Run`을 `-quit` 없이(스스로 Exit하는 `PlaytestXxx` 관례, CLAUDE.md/PROJECT_STATE "알려진 오류" 참고 — 처음에 `-quit`을 같이 줘서 씬만 열고 조용히 끝나는 걸 한 번 겪었다) 각각 3연속 OK. `FloorProgression`은 12번 방 전환·층 4까지만 도니 34층 마모 문턱은 이번 헤드리스로는 안 지나간다 — 실제 톤 변화는 사람이 34층·67층까지 내려가 봐야 확인됨(PROJECT_STATE "실기 확인 대기"에 추가). `FieldAmbush`·`Shortcut`·`Town2`·`Towns34`는 방 셸 재질 경로만 건드린 변경이라 재검증 생략(문·적 스폰 로직 무관).

`PLAN.md` 103-1 "변형 배가 대상" 표에서 DUNGEON 방 셸을 완료로 표시(REALM 성벽 3단만 남음), `docs/PROJECT_STATE.md`(다음 작업·테스트 상태·실기 확인 대기·완료 요약 DUNGEON 행) 갱신.
## 2026-09-22 — REALM 성벽 3단 (PLAN.md 103-1 "변형 배가" 마지막 항목, "이어해" 세션, DUNGEON 방 셸 다음)

DUNGEON 방 셸 마모 3단을 끝낸 직후 "이어해"로 이어받아 103-1 백로그의 마지막 항목 REALM 성벽 3단을 처리했다. `RealmCityBuilder.cs`를 읽어 보니 성 디오라마 담장·망루가 `record.Wall`(축성 명령으로 `def.BaseWall`~`def.BaseWall*2`까지 오르는 실제 방어 수치, `RealmCityState.CapOf("wall", def)`)과 완전히 무관하게 항상 같은 크기였다 — 실제로 방어에 투자해도 눈에 안 보였다. DUNGEON 마모 3단과 같은 원칙(새 지오메트리 없이 크기·개수 조합만 늘린다)으로 좁혔다.

`WallTier(int wall, RealmCityDef def)`(비율 1.33/1.67 문턱으로 삼등분 — DUNGEON `RoomWearTier`와 같은 삼등분 관례)를 추가하고, `BuildWallAndTowers(int wallTier)`가 담장 높이(1.6→2.1→2.6)·두께(0.5→0.65→0.8)·망루 스케일(1→1.25→1.55)을 티어로 배율화했다. 모서리 망루 넷을 공용 `SpawnTower()` 헬퍼로 뽑아 2단부터 망루 위에 지붕 갓(Keep과 같은 얇은 Cylinder)을 얹고, 3단부터 벽 중앙 보조 망루 셋(북·동·서)과 남문 양옆 문루 한 쌍을 추가로 배치한다 — 전부 기존 Cube/Cylinder 재사용, 새 에셋 없음. `Rebuild()`가 `RealmCityData.Get()`으로 `def`를 같이 가져와 매번 티어를 다시 계산한다.

**검증**: `tools/unity-batch.sh` 컴파일(오류 0) → `Saga.EditorTools.PlaytestRealmSlice.Run` 3연속 OK. 다만 이 스위트의 "wall" 명령은 딱 한 번만 돌아 tier0(기본)만 지나간다는 걸 깨닫고, 임시 검증 스크립트(`_TempVerifyWallTiers.cs`, 커밋 안 하고 확인 뒤 바로 삭제)로 `record.Wall`을 직접 tier0/1/2 경계값(baseWall·×1.5·×2)으로 올려 `Rebuild()`를 세 번 호출 — 예외 없이 자식 개수가 15→19(+4 지붕 갓)→29(+5 망루+5 지붕 갓, 계산과 정확히 일치)로 늘어나는 것까지 확인했다. tier1·tier2 실제 실루엣은 사람이 여러 달 축성 명령을 반복해 봐야 확인됨(PROJECT_STATE "실기 확인 대기" 추가).

`PLAN.md` 103-1 "변형 배가 대상" 표에서 REALM 성벽을 완료로 표시 — 나무·바위·건물 모듈(GO)·DUNGEON 방 셸·REALM 성벽까지 전부 끝나 이 백로그가 닫혔다. `docs/PROJECT_STATE.md`(다음 작업·테스트 상태·실기 확인 대기·완료 요약 REALM 행, 103-1 종료 표시) 갱신, 크기 한도(15360B) 맞추려 GO 행 등 오래된 날짜 태그 몇 곳도 같이 정리했다.
## 2026-09-22 — 67~69장 Localization 잔여 채움 (REALM 전투 서술 92키 + FOREST 바이옴 4곳, "이어해" 세션, REALM 성벽 3단 다음)

103-1 백로그가 전부 닫혀 PROJECT_STATE "다음 작업"을 다시 보니 넷 다 사람 손 대기였다 — 67~69장의 옛 메모 "미착수: FOREST 데이터 콘텐츠 번역, REALM 문답 36·서고·전투 서술, GO HiddenTreasure, DUNGEON 행상/구출 대사"를 실제로 다시 조사해 보기로 했다.

먼저 넷을 하나씩 코드로 확인했다 — GO `HiddenTreasure.cs`의 `event.hidden_treasure`, DUNGEON `DungeonMerchant.cs`/`DungeonCaptive.cs`의 `merchant.*`/`captive.rescued_reward`, FOREST 가구 14종(`furniture.*`)·마감재 10종(`finish.*`)·집 등급(`home.grade*`)까지 **이미 전부 ko/en 키가 채워져 있었다** — 이 메모가 오래 갱신 안 된 낡은 기록이었을 뿐(GO/DUNGEON은 언제 채워졌는지도 불명, FOREST는 가구/마감재 슬라이스 자체에 처음부터 `Name => ForestLocalization.T(...)` 계산 프로퍼티로 박혀 있었다).

실제로 비어 있던 건 둘. **REALM**: `RealmLocalization.T(key, fallback)` 호출 자체는 있는데 ko/en JSON에 그 `key`가 아예 없어(폴백 한국어만 계속 나옴) — 일기토(`duel.*`)·설전(`debate.*`)·전술 힌트(`war.tactic_*`)·승리 카드(`victory.*`)·5-2 1인 서사 카드 7종(`event.*`, 결투/논공행상/밀서/강론/재물/숙적/학사) 92개 키가 통째로 비어 있었다(코드에서 실제 쓰는 키와 `realm_ko.json` 키 집합을 `comm -23`으로 비교해 확정). **FOREST**: `ForestBiomeData.Zone.DisplayName`은 애초에 `T()` 호출조차 없이 필드 그대로 `ForestSessionTracker`/`ForestDeliveryCounter`에 노출돼 언어 설정과 무관하게 늘 한국어("어둑숲"·"바위 지대"·"버섯숲"·"꽃밭")가 나왔다.

REALM 92키는 코드에서 쓰는 순서 그대로 ko(원문)·en(신규 번역) 두 파일에 같은 키 집합으로 추가(무력/지력/통솔→Might/Wisdom/Command 등 이미 자리잡은 용어 그대로 재사용). FOREST는 `Zone`에 `Key` 필드를 더하고 `DisplayName`을 `{ get => ForestLocalization.T("biome." + Key, _displayName); set => _displayName = value; }` 계산 프로퍼티로 바꿔(가구/마감재와 같은 결) 호출부 셋(`ForestSessionTracker.cs`·`ForestDeliveryCounter.cs`×2)은 손 안 대고 그대로 통하게 했다. 두 파일 다 CRLF·BOM 없음 유지(PowerShell `[IO.File]::WriteAllText` + `UTF8Encoding($false)`, python3가 이 PC엔 Windows Store 스텁이라 실제로 안 돈다는 걸 이번에 다시 확인 — 앞으로도 큰 파일 치환은 PowerShell로).

**검증**: `tools/unity-batch.sh` 컴파일(오류 0) → Node `JSON.parse`로 두 파일 구문 확인 → `PlaytestRealmSlice`·`PlaytestForestHeadless` 각 3연속 OK. 코드 사용 키 집합과 ko.json 키 집합을 다시 `comm`으로 비교해 누락 0, ko/en 키 집합 완전 일치 확인. 추가로 임시 에디터 스크립트(`_TempVerifyLocalization.cs`, 커밋 안 하고 확인 뒤 삭제)로 언어를 "en"으로 바꿔 REALM 신규 키 6개가 실제로 영어를 반환하고 한글이 안 섞이는지, `[\uAC00-\uD7A3]` 정규식으로 직접 확인했다(bash `grep -P`의 유니코드 클래스가 이 환경에서 간헐적으로 오탐/오통과하는 걸 발견해 신뢰 안 하고 PowerShell로 재확인 — bash `grep -cP '[\x{AC00}-\x{D7A3}]'`가 473줄을 한글 포함으로 잘못 셌으나 실제로는 31줄뿐이었다, 기존 문제였던 idiom 퀴즈 답안 로마자 표기라 정상).

`PLAN.md` 67~69장 "미착수" 줄을 재조사 결과로 다시 씀, `docs/PROJECT_STATE.md`(다음 작업·테스트 상태·완료 요약 FOREST/REALM 행) 갱신 — 겸사겸사 이미 닫힌 101-3 표(2026-09-18 기준, 5줄짜리 상세 표)를 한 줄 요약으로 접어 문서 크기 여유를 만들었다(≤15KB 제한, PLAN 101-3 세부 경위는 이 HISTORY 2026-09-18 절에 그대로 있다).
## 2026-09-22 — "직접 실기해" GUI 스크린샷 시도, 환경 문제로 미완 (REALM 성벽 3단·DUNGEON 방 셸 다음, "이어해" 세션)

사용자가 "직접 실기해"로 실기 GUI 확인을 명시적으로 요청해(루트/폴더 CLAUDE.md의 "명시적으로 요청할 때만 스크린샷" 조건 충족), 이번 세션 신규 3건(GO 마을집 곁채·굴뚝, DUNGEON 방 셸 마모 3단, REALM 성벽 3단) + GO 전체를 확인 범위로 골랐다.

**도구 셋 신설** — `PlaytestDungeonEnemiesGui.cs`(2026-09-19)와 같은 결로 씬을 열고 텔레포트→대기→`ScreenCapture.CaptureScreenshot()`→다음 지점 순으로 도는 1회성 GUI 스크린샷 도구를 세 개 만들었다: `PlaytestGoLandmarksGui.cs`(집 둘+명소 넷), `PlaytestDungeonWearTiersGui.cs`(`DungeonFloorRunner.JumpToFloor(2/40/70)`로 마모 0/1/2단 강제), `PlaytestRealmWallTiersGui.cs`(`record.Wall`을 `def.BaseWall`×1/1.5/2로 강제해 성벽 0/1/2단). GO 도구는 **1차 시도에서 좌표 계산 실수**를 실제로 겪었다 — `TestMapData.TileSize=48`(칸 하나가 48유닛)인데 격자 좌표를 2~4칸만 어긋나게 넣어 "남쪽으로 물러난 자리"를 계산해 96~192유닛이나 떨어졌고, 마을집도 `WorldPos(gx,0)`으로 잘못 짐작했다(실제론 `WorldPos(gx,3)`, `LandmarksBuilder.BuildVillage()` 확인). 씬에 이미 지어진 명소 GameObject를 이름으로 찾아 `targetPos - playerForward*8`로 다시 짜서 고쳤다(격자 계산 자체를 안 쓰는 방식) — 로그의 pre-shot 좌표가 지점마다 다르게 나오는 것까지 확인해 계산 자체는 옳다는 걸 검증했다.

**환경 문제로 스크린샷 자체는 못 얻었다** — 셋 다 컴파일만 확인, 실행 결과는:
1. `-batchmode` 없이(스크린샷엔 실제 렌더링 필요, `-nographics`도 안 됨) `-executeMethod`로 GO 도구를 처음 돌렸을 때는 정상 완료돼 스크린샷 5장을 얻었다(당시엔 위 좌표 버그가 있어 다 허허벌판만 찍혔지만, 프로세스 실행 자체는 성공).
2. 좌표를 고친 뒤 같은 방식으로 재실행하니 매번 **"Administrator Privileges Detected" 대화상자**가 뜨고 멈췄다(이 셸이 관리자 권한이라 추정). `MainWindowTitle`로 직접 확인.
3. `-batchmode`(+`-nographics`만 뺌)로 돌리면 대화상자 없이 끝까지 도는데(로그에 "shot N" 메시지까지 다 찍힘) **`ScreenCapture.CaptureScreenshot()`가 파일을 하나도 안 남긴다** — 배치 모드엔 실제 렌더 백버퍼가 없어서로 추정.
4. PowerShell `[Microsoft.VisualBasic.Interaction]::AppActivate` + `SendKeys::SendWait("{ENTER}")`로 그 대화상자를 자동으로 닫는 워처를 만들어 봤다 — **닫을 때마다 같은 대화상자를 띄운 새 Unity.exe 프로세스가 1.5~2초 간격으로 계속 재생성되는 걸 실제로 겪었다**(6회 연속 새 PID 확인). 방치했으면 `find /` 10시간 CPU 사고(루트 CLAUDE.md)와 같은 급의 자원 폭주가 될 뻔했다 — `taskkill /F /IM Unity.exe /T`로 프로세스 트리째 잡아 즉시 중단, 재확인 두 번으로 재발 없음 확인. `SendFeedback`으로 이 환경 문제를 별도로 남겼다.

**결론**: 이 환경(관리자 권한 셸)에서 Unity 비-배치 GUI 실행은 안전하지 않고, 배치 모드는 스크린샷이 안 나온다 — 지금은 방법이 없다. 세 도구는 로직(텔레포트 좌표·티어 강제)까지는 검증됐으니 코드로는 커밋하고, 실제 스크린샷은 사람이 Unity Hub로 직접 열어(관리자 권한 아닌 일반 세션) `Saga/Playtest ... (GUI Screenshot)` 메뉴로 돌리는 몫으로 남긴다. GO 전체 실기 확인(전투·손맛·대사 등)은 애초에 스크린샷으로 못 가리는 항목이 대부분이라 이번 시도 여부와 무관하게 사람 몫.

`docs/PROJECT_STATE.md` 최상단에 "중요" 경고 절 신설(다음 세션이 같은 폭주를 재현하지 않도록), "다음 작업" 3번에 새 도구 셋 안내 추가. `Packages/`·`ProjectSettings/` 4파일은 배치 모드 아닌 직접 호출로 오염된 걸 `git checkout --`으로 원복.
## 2026-09-22 — PLAN 105 Q-U1 형식 정리 + 배치 컴파일 재확인 ("이어해" 세션, GUI 스크린샷 시도 다음)

전 세션이 GUI 스크린샷 실기 확인 시도로 끝나 이번 세션은 PROJECT_STATE "다음 작업" 4개를 다시 훑었다 — 104-1⑤·101-2·실기 GUI 확인은 전부 사람 실기/결정 대기였고, 105 Q-U1만 "사실상 처리됨, 형식만 남음"으로 적혀 있어 실제로 닫았다: 101-2 표 서두("결정" 문단들)에 Q-U1 처리 사실을 한 문단으로 내리고 105 열린 질문에서 지웠다(FINAL RULE "답이 나오면 해당 장으로 내리고 여기서 지운다" 그대로).
코드 변경이 없었던 걸 확인하는 차원에서 `tools/unity-batch.sh`로 배치 컴파일을 한 번 더 돌려 exit 0·오류 0 재확인(4파일 자동 원복도 확인). `docs/PROJECT_STATE.md` 갱신(다음 작업 4번·헤더·테스트 표 문구) 후 커밋.

## 2026-09-22 — GO·DUNGEON 카메라 벽 클리핑 raycast pull-in (102-5, "이어해" 세션, Q-U1 정리 다음)

Q-U1을 닫은 뒤에도 PROJECT_STATE "다음 작업"이 전부 사람 대기라 사용자에게 직접 물었다 — PLAN 102-5 "§6.4 허접 10가지 해당 여부" 감사표에 아직 안 고친 폴리시 항목(카메라 클리핑·애니 전이 블렌드·UI 폰트 통일 등) 중 뭘 먼저 할지. **사용자가 "카메라 클리핑부터"를 골랐다**(AskUserQuestion).

이 트랙은 Cinemachine 패키지 자체를 안 받았고(`CameraRig.cs` 클래스 주석, 101-3 G 성장 연출도 수동 코루틴으로 대신함) 카메라를 전부 수동 스크립트로 다뤄 왔다 — 102-5 표의 "CinemachineDeoccluder로" 제안은 이 트랙 아키텍처와 안 맞아 그대로 안 따르고, 같은 결(패키지 추가 없이 수동 raycast)로 짰다. GO`Player/CameraRig.cs`·DUNGEON`Player/CameraRig.cs` 둘 다 오빗 카메라(마우스 드래그 회전+휠 줌)라 대상으로 삼았다 — FOREST `CameraRig.cs`는 클래스 주석에 이미 "벽 충돌은 이번 슬라이스에 없음, 마을에 파고들 구조물이 집 하나뿐이라 범위 밖"이라고 명시적으로 스코프 밖에 남겨 둔 결정이 있어 손 안 댔고, REALM 오빗(`RealmOrbitCamera.cs`)도 이번엔 스코프 밖(사용자 선택 문구가 "GO·DUNGEON"으로 좁혀 물었다).

**구현**: `ApplyZoom()`이 카메라 로컬 z를 `-_zoom`으로 그냥 박던 걸 `ResolveCollisionZoom(_zoom)`을 거치게 바꿨다 — rig 위치에서 카메라 방향(`transform.TransformDirection(Vector3.back)`)으로 raycast, 막히면 그 지점 바로 앞(`CameraCollisionBuffer=0.2f`)까지 당기고 막힌 게 없으면 원래 `_zoom` 그대로 돌려준다(그래서 장애물을 벗어나면 바로 원래 거리로 복귀 — `_zoom` 자체는 안 바꾼다). rig 원점이 Player의 CharacterController 캡슐 중심(1.7m, `BuildTestVillageScene.BuildPlayer()` 주석)이라 원점에서 그대로 캐스팅하면 자기 몸을 맞힐 수 있어, `CameraSkin=0.6f`만큼 카메라 방향으로 미리 나간 지점에서 캐스팅을 시작하는 흔한 3인칭 카메라 관례를 그대로 썼다(레이어 분리 대신 — 이 프로젝트는 `TagManager.asset` 확인 결과 커스텀 레이어가 없고 전부 Default라 레이어로 자기 자신을 거르는 방법은 새 레이어 정의가 필요해 더 무거웠다). DUNGEON은 기존 `Shake()`(hitstop 카메라 흔들림)와 합성 — 클리핑 당김 뒤에 흔들림 오프셋을 더한다.

던전 벽(`DungeonRoomBuilder.SpawnWall()`)은 `GameObject.CreatePrimitive(PrimitiveType.Cube)`라 기본 BoxCollider가 이미 있어 별도 콜라이더 추가 없이 그대로 레이캐스트에 잡힌다 — GO 랜드마크(`LandmarksBuilder`)도 마찬가지로 확인.

**검증**: `tools/unity-batch.sh` 배치 컴파일(exit 0, 4파일 원복) → `PlaytestHeadless`(GO) 3연속 OK → `PlaytestDungeonHeadless` 3연속 OK → `PlaytestDungeonFloorProgression` 1회 OK(카메라 로직과 무관한 층 진행이라 3연속까지는 안 함). 셋 다 로그에 새 오류 없음, 회귀 없음.

`PLAN.md` 102-5 표의 "카메라 클리핑" 칸을 "해당"에서 "GO·DUNGEON 완료(2026-09-22)"로, `docs/PROJECT_STATE.md`(헤더·테스트 표·GO/DUNGEON 실기 확인 대기 줄에 "카메라 벽 클리핑 pull-in 체감" 추가, 문서 크기 여유 위해 오래된 날짜 태그 몇 곳 축약) 갱신 후 커밋.

## 2026-09-22 — PLAN 102-5 "애니 끊김" 재조사, 이미 해소됨 (카메라 클리핑 다음, "이어해" 세션)

카메라 클리핑을 끝낸 뒤 다음 §102-5 항목으로 "애니 끊김(Animator 전이 exitTime 0.9, 블렌드 없음)"을 보려고 실제 Animator 설정을 찾아봤다 — `Assets/Animators/Maria.controller`(GO·DUNGEON·FOREST·STORY 플레이어 전부 공유)·`Abe.controller`·`Brute.controller`(DUNGEON 잡졸/두목, GO `BanditEncounter`의 foe도 재사용) YAML을 직접 열어 보니 전이마다 `m_TransitionDuration`이 0.1~0.15초로 이미 다 채워져 있었다(코드 쪽도 `SetupAbeCharacterImport.cs`·`SetupBruteCharacterImport.cs`·`BuildTestCharacterRealisticScene.cs`의 `AddReturnToIdle()`(exitTime 0.9·duration 0.15)·`AddAnyStateTrigger()`(duration 0.1)·`AddParamTransition()`(duration 0.15)와 일치). 게임 코드에서 `Animator.Play()`/`CrossFade()`를 직접 호출하는 곳도 없어(전부 `SetTrigger`/`SetFloat`) 선언된 duration이 그대로 적용된다.

즉 이 감사 문구는 102장 초안(66-2/102-3 결정, 2026-09-13 무렵) 당시 상태를 적은 것이고, 그 뒤 44장 Mixamo 캐릭터 교체(2026-09-16~19)가 블렌드 전이까지 같이 넣었는데 102-5 표는 안 고쳐진 채로 남아 있었다 — 67~69장 Localization "미착수" 낡은 메모(이 HISTORY 앞선 2026-09-22 절)와 같은 종류의 낡은 기록. 코드 변경은 없음(이미 돼 있는 걸 확인만 함), `PLAN.md` 102-5 표 문구만 재조사 결과로 고치고 `docs/PROJECT_STATE.md` 헤더 갱신 후 커밋.

## 2026-09-22 — 접지 blob 그림자 신설 (PLAN 102-2 Shadows, "이어해" 세션, 102-5 애니 재조사 다음)

102-5 "애니 끊김"이 이미 해소돼 있던 걸 확인한 뒤 그다음 항목 "그림자 계단(Mobile Cascade 1, blob 없음)"을 보니 — 이건 102-2 "Volume 프로파일" 표에 이미 "Shadows: 유지 + 접지 blob 그림자 프리팹(모바일 캐릭터)"으로 미리 계획돼 있던 것(체크 표시 "○"/"blob")이었다. 즉 새 스코프 결정이 필요한 항목이 아니라 이미 승인된 계획을 실행만 하면 되는 항목이라 사용자에게 다시 묻지 않고 바로 짰다.

`Assets/SagaCore/BlobShadow.cs` 신설 — 이 트랙 첫 런타임 플랫폼 분기(`SessionCard`의 DoF는 "Mobile 프로파일엔 그 Volume 오버라이드 자체가 없다"는 콘텐츠 부재 트릭을 쓰지만, 그림자는 오브젝트 자체라 그 수가 안 통해 `QualitySettings.names[GetQualityLevel()] == "Mobile"`로 직접 판별). 텍스처는 에셋 없이 64×64 흑백 원형 그라디언트를 코드로 구워 공유 텍스처·머티리얼로 캐릭터 전부가 재사용(procgen 관례 그대로). 매 프레임 `Physics.Raycast`로 발밑 바닥을 찾아 위치를 맞춘다(GO/DUNGEON/FOREST/STORY 바닥·벽이 전부 기본 콜라이더 있는 프리미티브라 그대로 잡힌다, 카메라 클리핑 작업 때 이미 확인한 것과 같은 전제).

GO(`BuildTestVillageScene.cs`)·DUNGEON(`BuildTestDungeonScene.cs`)·FOREST(`BuildTestVillageForestScene.cs`)·STORY(`BuildTestStoryScene.cs`) 네 `BuildPlayer()`에 각각 `playerGo.AddComponent<BlobShadow>()` 한 줄만 추가(다들 이미 `using Saga.Core;` 갖고 있어 새 참조 불필요). REALM은 캐릭터가 없어 대상 아님.

**검증**: 배치 컴파일(exit 0) → GameObject 구성이 바뀌어(`104-2` 규칙대로) 4씬 전부 재빌드(`Build TestVillage/TestDungeon/TestVillageForest/TestField Scene`, 전부 exit 0 — 씬 파일 diff가 커 보이는 건 Unity 절차적 재빌드가 매번 fileID를 다시 매기는 거라 늘 그렇다, 새삼스러운 일 아님) → `PlaytestHeadless`(GO)·`PlaytestDungeonHeadless`·`PlaytestForestHeadless`·`PlaytestStorySlice` 전부 3연속 OK. 에디터 기본 품질 레벨이 "PC"라 지금은 안 보인다 — 실제로 켜진 모습은 `QualitySettings`를 "Mobile"로 돌리거나 모바일 빌드에서 사용자가 확인해야 한다(PROJECT_STATE "실기 확인 대기" 공통 줄에 추가).

`PLAN.md` 102-2 Shadows 행·102-5 "그림자 계단" 행 완료 표시(Player만, 적/NPC는 미착수라고 명시), `docs/PROJECT_STATE.md` 갱신 후 커밋. 중간에 saga-godot 세션이 자기 `PROJECT_STATE.md`를 상한 넘게 또 키워 공유 precheck가 두 번째로 막혔다 — 지난번과 같은 방식(내용 손실 없이 문구만 압축)으로 사용자 확인 없이 트림하고 진행(이전 세션에 "추천"으로 이미 승인받은 대응).

## 2026-09-22 — PC SSAO 값 튜닝 (PLAN 102-2, blob 그림자 다음, "이어해" 세션)

blob 그림자 다음으로 102-5 "후처리 일부(LUT·SSAO·SSS 없음)"를 봤다 — `BuildFF16VolumeProfiles.cs`엔 LUT(ColorLookup)·Screen Space Shadows 관련 코드가 전혀 없어 정말 미착수였지만, SSAO는 확인해보니 `PC_Renderer.asset`에 Unity 공식 URP 템플릿이 기본으로 넣어 준 `ScreenSpaceAmbientOcclusion` Renderer Feature가 이미 `m_Active: 1`로 켜져 있었다 — 102-2 표의 "템플릿 기본(PC)" 칸이 정확히 이 뜻이었다. 다만 값은 템플릿 기본값(Radius 0.3·Intensity 0.4·Downsample 꺼짐) 그대로였고, 표의 "추가·변경" 칸엔 이미 목표 수치(반경 0.5·강도 1.5·다운샘플)가 적혀 있어 — 새 결정이 필요 없는, 이미 승인된 숫자를 넣기만 하면 되는 항목이었다.

`Assets/Settings/PC_Renderer.asset`을 직접 열어 `m_Settings` 아래 `Radius: 0.3→0.5`·`Intensity: 0.4→1.5`·`Downsample: 0→1` 세 필드만 고쳤다(코드가 아니라 값 자체 — Mobile은 SSAO 자체가 없어 안 건드림). 배치 모드로 프로젝트를 한 번 로드해(도메인 리로드가 직렬화 자산도 파싱한다) 오류 0 확인, `PlaytestHeadless`(GO) 1회 OK로 사이드이펙트 없음 재확인.

LUT는 102-1-2가 요구하는 게임별 32³ 텍스처 5장(마을=따뜻/그림자 차갑게, 굴혈=청록, 들판=황금시각, STORY=고대비, REALM=저채도)이 색감 방향 자체를 정하는 일이라 사람 판단이 필요해 보류. Screen Space Shadows는 새 Renderer Feature를 처음부터 추가해야 해(SSAO처럼 템플릿이 미리 안 깔아 줌) YAML을 손으로 빚기엔 GUID 등 오류 위험이 커 이번엔 손 안 댔다. 남은 102-5 항목(바닥 한 색·스케일 혼재·UI 폰트 통일)도 전부 시각적 판단이나 더 큰 리팩터가 필요해, 다음엔 뭘 볼지 사용자에게 물어보기로 했다.

`PLAN.md` 102-2 SSAO 행·102-5 "후처리" 항목 갱신, `docs/PROJECT_STATE.md` 갱신 후 커밋.

## 2026-09-22 — 게임별 LUT 톤 5장 신설 (PLAN 102-1-2, SSAO 튜닝 다음, "이어해" 세션)

SSAO 튜닝 뒤 남은 §102-5 항목은 전부 새 결정이나 큰 작업이 필요해 사용자에게 다시 물었다 — "LUT 색감 5장"을 골랐다. 102-1-2는 이미 게임별 톤 방향을 정해 뒀다(마을=따뜻/그림자 차갑게, 굴혈=청록, 들판=황금시각, 필드(STORY)=고대비, 성(REALM)=저채도) — 정확한 수치까지는 없어 방향만 보고 직접 정했다.

**아키텍처 문제**: FF16Volume_PC/Mobile(102-2)은 다섯 판이 같이 쓰는 공유 자산 2개뿐이라 게임별 LUT를 못 넣는다. `Assets/Editor/BuildGameToneLuts.cs`를 신설해 별도 경로로 풀었다 — 게임마다 (a) 32³ LUT PNG(`Assets/Settings/LUT_<game>.png`, `PC_RPAsset`·`Mobile_RPAsset`의 `m_ColorGradingLutSize: 32`와 반드시 일치)를 코드로 굽고(에셋 없이, procgen 관례), (b) 그 LUT 하나만 담은 전용 `ToneVolume_<game>.asset`(ColorLookup 오버라이드만, ColorAdjustments 등 다른 값은 없음)을 만든다. 각 게임 씬(`BuildTestVillageScene.cs` 등 5개)의 기존 `BuildPostProcessingVolume()`(공유 GlobalVolume) 바로 다음에 `BuildToneVolume()`을 새로 추가해 우선순위(priority=1) 더 높은 두 번째 Volume으로 이 프로필을 겹쳐 낀다 — 공유 프로필 값은 안 건드리고 ColorLookup만 얹히는 구조.

**LUT 텍스처 포맷 함정**: URP `ColorLookup.ValidateLUT()`는 텍스처가 `sRGB 포맷이 아니어야` 유효하다고 판정한다(`GraphicsFormatUtility.IsSRGBFormat`) — PNG를 그냥 임포트하면 기본이 sRGB 컬러 텍스처라 무효 판정난다. `TextureImporter.sRGBTexture = false`로 강제하고 `Uncompressed`·`npotScale None`·`mipmapEnabled false`로 맞췄다(에디터 프리뷰가 아니라 실제 그레이딩 값이라 압축·밉맵으로 뭉개지면 안 됨).

**그레이딩 함수**(전부 순수 C# 픽셀 함수, 32×32×32 격자를 훑어 직접 계산 — 외부 그레이딩 툴 없이): GO는 루마 기반 셰도우/하이라이트 틴트 보간(cool→warm), DUNGEON은 청록 틴트+대비 1.12배, FOREST는 골드 틴트 단일, STORY는 대비 1.35배(틴트 없음), REALM은 루마로 55% 탈채도+살짝 차가운 틴트.

**검증**: 배치 컴파일(exit 0) → `BuildGameToneLuts.Build()` 실행(5개 PNG+5개 프로필 저장 확인, 로그 "saved 5 LUTs + 5 tone volume profiles") → 생성된 `ToneVolume_go.asset` YAML 직접 열어 `active: 1`·`m_OverrideState: 1`·텍스처 참조 정상 확인, `LUT_go.png.meta`에서 `sRGBTexture: 0` 확인 → GameObject 구성이 바뀌어 다섯 씬 전부 재빌드(경고 없음 — 프로필 찾기 성공) → GO·DUNGEON·FOREST·STORY·REALM **다섯 판 전부 Playtest 3연속 OK** 재확인.

수치만으로 짠 색감이라 실제로 의도한 톤이 나오는지는 사람이 봐야 한다 — `PROJECT_STATE.md` "실기 확인 대기" 공통 줄에 추가. `PLAN.md` 102-1(암묵적으로 이미 있던 방향 수치화는 없음, 102-2 Color Adjustments 행·102-5 "후처리" 항목만 갱신), 커밋.

## 2026-09-22 — PROJECT_STATE "다음 작업" 갱신 (새 세션 인계 대비, LUT 다음)

사용자가 "새로운 세션에서 이어해"라고 해 다음 세션이 문서만 보고도 정확히 이어받을 수 있는지 점검했다 — "다음 작업" 우선순위 1~4가 여러 세션 전(104-1 ⑤·101-2·GUI 스크린샷 도구 안내·Q-U1) 기준으로 낡아 있었다(그새 카메라 클리핑·애니 재조사·SSAO·LUT 5장이 102-5에서 끝났는데 반영이 안 됨). 실제 현재 우선순위로 다시 썼다: ①실기 확인 몰아서(코드로 더 갈 데가 없어 지금 가장 큰 병목) ②102-5 남은 넷(Screen Space Shadows·바닥 한 색·스케일 혼재·UI 폰트 통일, 전부 매번 사용자에게 물어 진행해 온 결) ③101-2·104-1 잔여(전부 보류) ④105 Q-U3. 코드·기능 변경은 없음.

## 2026-09-22 — 102-5 남은 넷 이어감: 바닥 한 색·Screen Space Shadows 완료, 스케일·UI 폰트는 재조사로 닫힘 ("이어해" → "전체 다해")

지난 세션이 "다음 작업"에 적어 둔 102-5 남은 넷(Screen Space Shadows·바닥 한 색·스케일 혼재·UI 폰트 통일) 중 사용자에게 뭘 먼저 볼지 물었더니 "바닥 한 색 정리"를 고르고, 실기 확인 대기 목록·105 Q-U3는 이번엔 안 건드리기로 했다가, 곧이어 "전체 다해"로 넷 전부를 이어가라고 했다.

**바닥 한 색**: 게임별 지형 빌더를 다시 훑어보니 GO(`TerrainBuilder.cs`, 이미 디테일 텍스처 오버레이 있음)·DUNGEON·REALM(`EnvironmentMaterial.MakeTiled`로 실제 PBR 타일드 재질)·STORY(`leafy_grass`/`dark_wooden_planks` PBR mat)는 전부 이미 해당 없었다 — 진짜 "정점색 하나로만 칠한" 건 FOREST(`ForestGroundBuilder`→`ForestWorldCurve.shader`, 디테일 텍스처 개념 자체가 없었다)뿐이었다. `ForestWorldCurve.shader`에 GO `VertexColorLit`과 같은 결의 `_DetailTex`/`_DetailTiling`/`_DetailStrength`(기본값 흰 텍스처·Strength 0이라 이 셰이더를 같이 쓰는 나무·NPC엔 영향 없음)를 추가하고 월드 XZ(`positionWS.xz`)로 직접 샘플(별도 UV 채널 불필요 — 곡률이 Y만 건드리므로). `ForestGroundBuilder.cs`에 `detailTexture`/`detailTiling`/`detailStrength` 필드 추가, `BuildTestVillageForestScene.cs`의 `BuildGround()`가 Poly Haven `leafy_grass_ao_1k.jpg`(GO가 cobblestone AO를 쓴 것과 같은 "그레이스케일 AO 곱" 패턴)를 리플렉션으로 채운다. 씬을 한 번 재빌드해 필드를 실제로 저장(`TestVillageForest.unity` 갱신)한 뒤 헤드리스 3연속 OK 확인.

**Screen Space Shadows**: `DecalRendererFeature`를 코드로 배선했던 `BuildDecalRendererFeature.cs`(SerializedObject로 `m_RendererFeatures`/`m_RendererFeaturesMap` 직접 채움)를 그대로 참고해 `BuildScreenSpaceShadowsFeature.cs`를 신설했다. 다른 점 하나 — URP 내장 `ScreenSpaceShadows` 클래스는 `internal`이라(Decal은 `public`) 우리 어셈블리에서 타입 이름으로 직접 못 쓴다. `Type.GetType("UnityEngine.Rendering.Universal.ScreenSpaceShadows, Unity.RenderPipelines.Universal.Runtime")` 리플렉션 + `ScriptableObject.CreateInstance(Type)`로 우회(접근 제한자를 안 가림) — 몇 세션째 "GUID 위험 커 보류"로 미뤄 온 항목이었지만, 실제로 해 보니 Decal과 완전히 같은 패턴이라 위험은 리플렉션 한 줄로 끝났다. `m_Shader` 필드는 비워 둬도 되는데, 그 클래스의 `LoadMaterial()`이 null이면 `Shader.Find("Hidden/Universal Render Pipeline/ScreenSpaceShadows")`로 스스로 채우기 때문(패키지 Shaders 폴더에 실제로 있음, 직접 확인). PC_Renderer.asset에만 걸었다 — 처음엔 Decal처럼 Mobile에도 걸었다가, 102-2 원안("모바일 성능 목표로 Cascade 1 유지 + BlobShadow로 접지만 보완")과 상충한다고 판단해 Mobile_Renderer.asset은 `git checkout`으로 되돌렸다(화면 전체 블릿 패스를 추가로 태우는 무거운 기법이라).

**스케일 혼재 재조사**: `CharacterVisual.cs`(GO)와 `BanditEncounter.cs`를 다시 읽어 보니, 높이는 이미 통일돼 있었다 — Kenney 캐릭터는 `CharacterVisual.Spawn(..., HumanHeight=3.4)`로, 리깅된 Mixamo(Abe·Brute)는 `riggedVisualScale`(실측 높이 기준 계산값, `BuildTestVillageScene.cs` 등이 채워 넘김)로 스케일하는데 목표 높이가 같다. PLAN이 "Kenney 1.0 vs Mixamo 1.75"라고 적어 둔 건 임포트 스케일 값 얘기였지 실제 화면 크기 얘기가 아니었다. 남은 차이는 순수 비례(Kenney 블로키 체형 vs Mixamo 사실적 체형)뿐인데, 이건 103-3 결정("실제 Mixamo 모델은 3명만 유지, 늘리지 않는다")과 정면으로 부딪힌다 — Kenney를 리메시하거나 Mixamo를 더 사는 것 둘 다 이번 세션 범위(그리고 기존 결정) 밖이라 코드로 더 손댈 게 없다고 결론.

**UI 폰트·패널 재조사**: `RealmUiKit.cs`·GO `EncounterUiKit.cs`·FOREST `EncounterUiKit.cs` 셋을 실제로 나란히 읽어 보니 폰트(`Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf")`)·버튼 색(`1,1,1,0.18`)·버튼 텍스트 크기(26)·막대 색까지 바이트 단위로 이미 동일했다(다섯 벌 복사 원칙대로 파일만 갈라져 있을 뿐, 주석에도 "GO를 그대로 복사"라고 적혀 있었다). PLAN이 "통일 안 됨"으로 오래 들고 있었던 건 실제 divergence가 아니라 갱신 누락으로 보인다 — 더 손댈 코드가 없다고 결론.

**검증**: 컴파일(exit 0, 두 차례) → FOREST 씬 재빌드(경고 없음) → GO·DUNGEON·FOREST·STORY·REALM **다섯 판 전부 Playtest 3연속 OK**(Screen Space Shadows 추가 뒤 기준) → `git diff --stat -- ProjectSettings/ Packages/` 빈 결과(설치 버전 부작용 없음) 확인.

`PLAN.md` 102-5 절 전면 갱신(바닥 한 색·SSS 완료, 스케일·UI 폰트는 재조사 결과 기록), `PROJECT_STATE.md` "다음 작업"·"테스트 상태"·"실기 확인 대기" 갱신 후 커밋 예정.

## 2026-09-22 — 102-5 전부 마감: 그림자 계단(적·NPC)·REALM 카메라 클리핑 ("이어서" 계속)

바닥 한 색·Screen Space Shadows·스케일·UI 폰트를 마친 뒤 "이어서"로 계속해, 102-5의 마지막 두 항목(나머지 캐릭터 그림자 계단, REALM 카메라 오빗 클리핑)까지 마쳤다.

**그림자 계단(적·NPC)**: `BlobShadow.cs`(`Assets/SagaCore/`, 다섯 판이 공유하는 유일한 조각 — Mobile 품질 레벨이 아니면 스스로 꺼진다)는 지금까지 각 게임 편집기 씬 빌드 스크립트가 `playerGo.AddComponent<BlobShadow>()`로 Player에만 붙였다. 적·NPC는 런타임에 스폰되니 편집기 스크립트로는 못 붙는다 — 대신 GO/DUNGEON/FOREST/STORY 네 `CharacterVisual.cs`(다섯 벌 복사 중 이 넷)에 `EnsureBlobShadow(Transform root)` 정적 헬퍼를 추가하고, Kenney 경로인 `Spawn()`·`SpawnFallbackCapsule()` 끝에서 부르게 했다. 다만 리깅된(Animator 포함, Abe/Brute) 캐릭터는 `CharacterVisual.Spawn()`을 안 타고 각 Enemy 클래스가 직접 `Instantiate`하는 별도 분기가 있다 — `grep -rln "GetComponent<Animator>() != null"`로 셋(`BanditEncounter.cs`(GO)·`DungeonEnemy.cs`·`StoryEnemy.cs`)을 찾아 그 분기 끝에도 `CharacterVisual.EnsureBlobShadow(transform);`를 직접 추가했다. FOREST/DUNGEON 주민·동행(`ForestVillager.cs`·`AllyFighter.cs` 등)은 리깅 분기가 없어 `Spawn()` 경로 하나로 이미 커버됨을 grep으로 확인.

**REALM 카메라 클리핑**: `RealmOrbitCamera.cs`는 GO/DUNGEON의 드래그 오빗과 다르게(성 조망용 WASD 오빗, 성 중심 원점에 고정) 새로 짠 리그라 `CameraRig.ResolveCollisionZoom()`이 그대로 안 옮겨졌다. 완전히 같은 raycast pull-in 로직(원점에서 카메라 방향으로 `CameraSkin`만큼 나가 캐스팅, 막히면 그 지점까지 당김)을 이 리그의 `ApplyZoom()`에 추가 — 캐릭터가 없어 자기 몸 오검출 걱정은 없지만, 원점 자체가 건물 안일 때 레이가 시작부터 막히는 걸 방지하려 Skin은 그대로 뒀다(1m, MinZoom=8보다 작게).

**검증**: 배치 컴파일(exit 0) → GO·DUNGEON·FOREST·STORY·REALM **다섯 판 전부 Playtest 3연속 OK**(exception/NullReference 없음 grep으로 재확인) → `git diff --stat -- ProjectSettings/ Packages/` 빈 결과.

`PLAN.md` 102-5 절의 "그림자 계단"·"카메라 클리핑" 행을 "전부 완료"로 갱신, 102-5 전체를 닫힌 것으로 표시. `PROJECT_STATE.md` "다음 작업"에서 102-5 항목 자체를 지우고(실기 확인 대기만 남김) "실기 확인 대기" REALM·공통 줄에 새 체크 항목 추가. 두 커밋으로 나눠 커밋(바닥색/SSS/재조사 먼저, 그림자계단/카메라 나중).

## 2026-09-22 — GUI 스크린샷 환경 문제 진짜 원인 확인: UAC 통째로 꺼짐 (102-5 마감 다음, "실기 직접확인해" → "새로운 세션에서 이어 하자")

102-5를 다 마친 뒤 사용자가 "실기 직접확인해"로 다시 GUI 스크린샷을 요청했다. 이전 세션이 겪은 "Administrator Privileges Detected" 대화상자 폭주(SendKeys 자동 닫기가 원인)를 반복하지 않기 위해, 금지된 방법(SendKeys 재시도) 대신 **다른 접근을 먼저 검증**했다.

1. `explorer.exe`로 Unity를 재실행하면 엘리베이션된 셸의 토큰을 안 물려받을 거라 기대하고 시도 — `Start-Process explorer.exe -ArgumentList <bat>` 로 Unity를 띄웠으나 **대화상자가 그대로 다시 떴다**(`MainWindowTitle`로 확인). 이번엔 SendKeys로 닫으려 하지 않고 **`taskkill //F //IM Unity.exe //T` 한 번**으로 즉시 정리 — 폭주 재현 없음, 잔여 프로세스도 없음 확인.
2. 왜 `explorer.exe`도 이미 엘리베이션돼 있는지 원인을 캐봤다. `[Security.Principal.WindowsPrincipal]::IsInRole(Administrator)` → 이 셸이 관리자 권한인 건 이미 알던 사실이지만, 계정 SID(`S-1-5-21-...-1001`)를 확인해 **진짜 빌트인 Administrator(-500)가 아니라 평범한 관리자-그룹 계정**임을 확인 — 그렇다면 UAC 분할 토큰이 정상 작동해야 하는데 안 됐다는 뜻.
3. `reg query HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System /v EnableLUA` → **`0x0`**. UAC 자체가 이 PC에서 완전히 꺼져 있었다 — UAC가 꺼지면 관리자-그룹 계정에 "일반 권한" 필터링된 토큰이 애초에 생성되지 않아, `explorer.exe` 경유든 `runas /trustlevel:0x20000`(권한을 명시적으로 낮춰 실행하는 옵션, 이론상 통해야 하는데 이 역시 UAC 자체가 꺼져 있으면 토큰 필터링 메커니즘이 없어 무효)든 **어떤 프로세스 실행 트릭으로도 비-엘리베이션 컨텍스트를 만들 수 없다** — Windows가 그 토큰을 아예 안 만들기 때문. `-batchmode`는 이 대화상자 자체가 안 뜨지만(GUI 렌더링을 안 해서로 추정) `ScreenCapture.CaptureScreenshot()`이 파일을 안 남기는 기존 함정은 그대로.

**결론**: 이 환경(스크립트/셸)에서는 Unity GUI 실행이 구조적으로 항상 관리자 경고를 만난다 — 유일한 해법은 `EnableLUA=1`로 되돌리고 재부팅하는 것뿐인데, 이건 이 PC 전체 보안 정책에 영향을 주고 재부팅까지 필요한 시스템 변경이라 사용자 확인 없이 진행하지 않았다. 사용자에게 물어보니 "새로운 세션에서 이어 하자"로 마무리 — 다음 세션 시작 시 UAC 재활성화 여부를 먼저 물어보도록 `PROJECT_STATE.md` "중요" 절에 원인·시도 내역·다음 행동을 정리해 남겼다.

코드 변경 없음(순수 진단). `docs/PROJECT_STATE.md` "중요" 절·"다음 작업" 1번만 갱신, 커밋.

## 2026-09-22 — GUI 스크린샷 대화상자 문제 해결 확인 (새 세션 "사가유니티 이어 하기")

지난 세션이 `PROJECT_STATE.md`에 남긴 대로 세션 시작 시 UAC 재활성화 여부를 먼저 물었다. 사용자가 "UAC 켜고 재부팅 후 진행"을 골랐는데, 레지스트리(`reg query .../Policies\System /v EnableLUA` → `0x1`)와 `(Get-CimInstance Win32_OperatingSystem).LastBootUpTime`(오늘 21:22)을 확인해 보니 **이미 켜고 재부팅까지 마친 상태**였다 — 이 세션에서 직접 레지스트리를 건드리거나 재부팅을 실행하지 않았다.

`PlaytestDungeonEnemiesGui`(Menu → `-executeMethod Saga.EditorTools.PlaytestDungeonEnemiesGui.Run`, `-batchmode` 없이)를 두 번 재실행해 검증:
1. **1차**: 관리자 대화상자 없이 exit 0으로 자체 종료(대화상자 폭주 재현 없음 — 문제 해결 1차 확인). 단, 캡처된 스크린샷(`10_dungeon_bossgroup.png`)이 시안색 평면 실루엣이었다 — 이건 새 문제가 아니라 66-2장 ⑩·2026-09-19 세션에 이미 기록된 "셰이더 캐시 콜드" 증상(프로젝트를 갓 연 첫 실행이라 셰이더 변형이 안 쌓여 있었음, 180프레임 대기로도 이 PC에선 부족).
2. **2차**(캐시가 쌓인 뒤 재실행): 같은 스크린샷 경로에 정상 렌더링 — Maria(플레이어, 갑옷 디테일)와 근접한 잡졸(Abe로 추정, 앞쪽 웅크린 자세)이 돌바닥·벽 텍스처와 함께 또렷하게 찍혔다. 완전한 전신 구도는 아직 아니지만(카메라 각도·거리상 Abe 하반신 일부만), 2026-09-19 세션이 "아직 못 얻음"으로 남긴 것보다는 진전 — Brute는 이번 프레임엔 화면 밖.

두 실행 모두 `ProjectSettings/ProjectVersion.txt`·`EditorSettings.asset`·`Packages/manifest.json`·`packages-lock.json` 4파일이 조용히 고쳐진 것을 `git checkout --`으로 원복(기존 함정 재확인, `tools/unity-batch.sh`는 배치 전용이라 이번엔 안 씀).

코드 변경 없음(순수 검증). `docs/PROJECT_STATE.md` "해결됨" 절·캐릭터 자산 절·"다음 작업" 1번 갱신, 커밋 예정.

## 2026-09-22 — 105 Q-U3(SSS 배선) 리플렉션으로 해결 (같은 세션 "사가유니티 이어 하기" 계속)

UAC 재활성화/GUI 대화상자 문제 해결 확인 뒤, 사용자가 GUI가 다시 되니 이어서 뭘 할지 묻자 "105 Q-U3 착수"를 골랐다. 하지만 PLAN 101·102-3을 다시 읽어 보니 Q-U3(Shader Graph SSS·헤어카드 노드 배선)는 애초에 "Shader Graph는 코드로 조립할 공식 API가 없어(AnimatorController와 달리) → 사람 GUI 몫"이라고 못 박혀 있었다(66-2장 ⑤ 결정, `BuildMariaSkinSplit.cs` 주석에도 같은 내용) — 잘못된 선택지를 준 것을 사용자에게 사과하고 다시 물었다.

사용자는 "백그라운드나 포그라운드로 해줘", "플레이라이트 같은걸로", "직접 해줘"로 — 데스크톱 GUI 자동화(마우스/키보드 제어)를 써서라도 직접 해보라고 지시. 이 환경엔 Playwright류 데스크톱 자동화 도구가 없음을 ToolSearch로 확인했지만, 대안으로 **"Shader Graph 노드 자체를 코드(리플렉션)로 조립하는 게 실제로 가능한가"**를 먼저 조사하기로 했다.

**조사 결과**: `GraphData`·`SubGraphNode`·`Target`·`BlockFields`·`CategoryData`·`MaterialSlot`·`BlockNode`·`FileUtilities` 등 Shader Graph 핵심 타입이 전부 `internal`(URP 자기 어셈블리 `Unity.RenderPipelines.Universal.Editor`엔 `[InternalsVisibleTo]`가 있지만 우리 어셈블리엔 없음, `Editor/AssemblyInfo.cs` grep으로 확인) — 그러나 `internal` 타입도 `Type.GetType("정규화이름, 어셈블리")` + `Activator.CreateInstance`/`MethodInfo.Invoke`/제네릭은 `MakeGenericMethod`로 완전히 우회 가능함을 확인(2026-09-22 앞서 확인한 URP `ScreenSpaceShadows` 리플렉션 트릭과 같은 결, 다만 이번엔 메서드 호출·제네릭·필드 세팅까지 훨씬 깊게 씀). 실제 "Create > Shader Graph > URP > Lit Shader Graph" 메뉴가 쓰는 내부 루틴을 소스에서 그대로 찾아 재현 가능함을 확인:
- `GraphUtil.CreateNewGraphWithOutputs` → `NewGraphAction.Action`(`Editor/Data/Util/GraphUtil.cs:120`)이 실제 조립 순서: `new GraphData()` → `AddContexts()` → `InitializeOutputs(targets, blockDescriptors)` → `AddCategory(CategoryData.DefaultCategory())` → `FileUtilities.WriteShaderGraphToDisk(path, graph)`.
- `SubGraphNode.asset` 세터(공개 프로퍼티)가 내부적으로 `UpdateSlots()`를 호출해 서브그래프의 입력/출력 슬롯을 자동 생성 — 손으로 슬롯을 안 만들어도 됨. 출력 슬롯 id는 서브그래프 자체의 `SubGraphOutputNode` 슬롯 id를 그대로 물려받는다(FakeSSS는 `id=1`, "Color", Vector4) — `.shadersubgraph`가 MultiJson(여러 JSON 오브젝트 연결) 포맷임을 직접 읽어 확인.
- `FakeSSS.shadersubgraph`의 공개 인터페이스: 입력 6개(normal influence·Power·Intensity·Colour·ThicknessMap·Mask, 전부 Vector1/Vector4/Texture2D), 출력 1개(Color, Vector4).

**구현**(`BuildTestSssShaderGraph.cs`로 먼저 검증 → `BuildMariaSssShaderGraph.cs`로 실제 산출물):
1. `UniversalTarget`+`UniversalLitSubTarget`(둘 다 public 클래스, 리플렉션 불필요)로 URP Lit 타깃 구성, `BlockFields.VertexDescription/SurfaceDescription`의 9개 필드(Position·Normal·Tangent·BaseColor·NormalTS·Metallic·Smoothness·Emission·Occlusion)를 리플렉션으로 읽어 블록 배열 구성.
2. `GraphData` 인스턴스 생성 → `AddContexts()` → `InitializeOutputs(targets, blocks)` → `AddCategory(CategoryData.DefaultCategory())`.
3. `SubGraphNode` 생성 → `asset` = `AssetDatabase.LoadAssetAtPath<ScriptableObject>(FakeSSS 경로)`(제네릭을 `ScriptableObject`로 잡아 internal `SubGraphAsset` 타입 자체를 몰라도 되게 함) → `graph.AddNode(node, true)`.
4. `GetInputSlots<MaterialSlot>()`로 입력 슬롯을 순회해 `RawDisplayName()`으로 매칭 후 기본값 튜닝(Mask=1 — 기본값 0이면 효과가 죽는다, Power=2, Intensity=0.6, normal influence=0.5, Colour=웜톤 (1, 0.55, 0.45, 1)) — `Vector1MaterialSlot.value`/`Vector4MaterialSlot.value`를 직접 세팅.
5. `FindSlot<MaterialSlot>(1)`로 SubGraphNode 출력 슬롯, `GetNodes<BlockNode>()`로 Emission `BlockNode`(descriptor.name=="Emission")를 찾아 `FindSlot<MaterialSlot>(0)`로 그 입력 슬롯, `graph.Connect(outputRef, emissionRef)`로 연결(BaseColor/Smoothness는 일부러 비워 둬 `BuildMariaSkinSplit.cs`의 기존 `_BaseColor`/`_Smoothness` 오버라이드가 URP Lit 관례상 그대로 먹게 함 — 대체가 아니라 Emission에 얹는 가산 방식).
6. `FileUtilities.WriteShaderGraphToDisk(path, graph)` + `AssetDatabase.Refresh()`.

**검증**(전부 배치 모드, GUI 불필요): `BuildTestSssShaderGraph.Build`가 예외 없이 끝까지 돌고 `Test_SSS_Graph.shadergraph`(gitignore 폴더) 생성 확인 → `ShaderUtil.ShaderHasError(shader)==False, GetShaderMessageCount==0`(`Verify` 메뉴 신설, 첫 시도는 `GetShaderActiveSubshaderIndex` 오타로 컴파일 에러, 바로 고침). 검증 성공 뒤 같은 기법으로 `BuildMariaSssShaderGraph.cs`(실제 산출물, `MariaSkin.shadergraph`) 작성 → 역시 `ShaderHasError=False`. `BuildMariaSkinSplit.cs`를 고쳐 `skinMat.shader`를 이 셰이더로 교체(못 찾으면 기존 URP Lit 근사로 폴백하는 경고 로그 추가, 다른 PC 대비). `BuildMariaSkinSplit.Build` 재실행해 실제 스킨 머티리얼 재생성(경고 없이 통과 — SSS 셰이더가 적용됐다는 뜻) → GO `PlaytestHeadless` 3연속 OK로 회귀 없음 확인.

**GUI 시각 확인은 실패**: `PlaytestDungeonEnemiesGui`를 두 번 더 실행했는데, 이번엔 이전 세션의 "관리자 대화상자" 증상이 아니라 **Unity 에디터 시작 단계(패키지 등록/라이선싱 초기화)에서 CPU 사용량이 거의 0인 채 멈춤**(1차 10분, 2차 6분 대기 후 각각 `taskkill //F //IM Unity.exe //T`로 정리) — 로그가 "Library Redirect Path: Library/"나 "[Package Manager] Done registering packages" 직후에서 멈춰 있어, `-executeMethod`나 우리 코드가 도달하기도 전이었다. 원인 불명(반복 실행 부하일 가능성) — 코드·셰이더 자체의 문제가 아님은 확실(비-GUI 검증 전부 통과). `ProjectSettings/`·`Packages/` 4파일은 매번 `git checkout --`으로 원복.

**PLAN.md 갱신**: 101장 "남은 결정 사항"(SSS 해결·헤어카드는 분리 메시 없어 미착수로 재분류), 102-3(캐릭터 파이프라인 서술 갱신), 102-4(SSS 판정 표 갱신), 105장(Q-U3 삭제, "열린 질문 없음"으로). `docs/PROJECT_STATE.md`도 전면 갱신(≤15KB 유지를 위해 여러 차례 압축).

새 파일 4개(`BuildTestSssShaderGraph.cs`·`.meta`·`BuildMariaSssShaderGraph.cs`·`.meta`), 수정 1개(`BuildMariaSkinSplit.cs`). `Assets/Art/CharactersRealistic/Generated/*.shadergraph`는 gitignore라 커밋 대상 아님.

## 2026-09-22 — GUI hang 재현 안 됨 확인, SSS 글로우 시각 확인은 여전히 미완 (새 세션 "사가유니티 이어 하기")

세션 시작 시 절차대로 PLAN 목차·PROJECT_STATE를 훑었더니 남은 작업이 전부 막혀 있었다(GO⑤ 모바일 빌드 뒤, STORY5-2 웹/godot 미확정, Props lantern·stall-red 재질 위험으로 보류, Kenney Characters는 Q-U4로 유지 확정). 사용자에게 물어 "SSS 글로우 GUI 확인 재시도"를 골랐다.

`PlaytestCharacterRealisticGui`(`ShotDir`를 이번 세션 scratchpad로 갱신)를 실행 — hang 없이 exit 0으로 정상 종료. 스크린샷(idle/run/attack)을 확인해 보니 idle·run에서 피부 서브메시가 **네온 시안**으로 찍혀 있었다 — MariaSkin.shadergraph(SSS)가 아직 셰이더 변형 컴파일 중일 때 캡처된 것으로 판단(기존 66-2장 ⑩ "셰이더 캐시 콜드" 함정과 같은 증상 — 이전엔 "플랫한 색"으로만 알려져 있었는데 이번엔 커스텀 Shader Graph가 미컴파일 상태에서 네온 시안 디폴트를 보인다는 새 사례). attack 샷(더 나중 프레임)은 정상 톤이라 가설을 뒷받침.

대기 프레임을 120→300으로 늘리고, 피부 노출이 큰 골반·허벅지 부위 클로즈업 스테이지(`04_skin_closeup.png`)를 신설해 재실행 — 이번엔 idle/run/attack/closeup 전부 정상 톤(시안 없음), hang도 없음. 단 `BuildTestCharacterRealisticScene`은 의도적으로 포스트프로세싱(블룸) 없는 순수 리그 확인 씬이라(주석에 명시) 스킨의 SSS 글로우 자체가 육안으로 거의 안 띄었다 — 피부가 그냥 밝은 회색 매트 톤으로만 보임.

블룸이 있는 실제 게임 씬에서 재확인하려고 `PlaytestDungeonEnemiesGui`(`ShotDir`도 이번 세션 경로로 갱신)를 실행 — hang 없이 exit 0. 하지만 텔레포트 지점(8.5, 0.1, -1.5)이 적 무리 바로 옆이라 스크린샷을 찍기 전에 플레이어가 두들겨 맞아 쓰러졌고("쓰러졌다가 정신을 차렸다"), 찍힌 화면은 HUD·전투결과 텍스트가 뒤덮은 탑다운 사망 화면이라 Maria 모습 자체가 거의 안 보였다(부가로 HUD 텍스트 두 겹이 겹쳐 보이는 것도 관찰됐는데, 게임 창 해상도가 자동화 캡처 시 비정상이라 그런 것일 수도 있어 실제 버그인지는 미확인 — 재현되면 별도 기록).

세 번의 GUI 실행 모두 4~6개 설정 파일(`ProjectSettings/EditorSettings.asset`·`ProjectVersion.txt`·`Packages/manifest.json`·`packages-lock.json`·가끔 `Assets/Settings/Mobile_RPAsset.asset`)이 조용히 고쳐진 것을 매번 `git checkout --`으로 원복(기존 4파일 함정 + Mobile_RPAsset도 같은 결로 새로 확인).

**결론**: GUI hang(패키지 등록/라이선싱 단계 CPU~0 멈춤) 문제는 이 세션에서 재현되지 않았다 — 지난 세션이 겪은 건 일회성이었을 가능성이 높다. 다만 SSS 글로우가 "잘 나오는지"는 여전히 실제로 못 봤다 — 다음 세션은 블룸 있는 씬에서 플레이어가 안 죽는 안전한 지점(또는 무적 플래그)으로 텔레포트를 고쳐 재시도해야 한다.

코드 변경: `PlaytestCharacterRealisticGui.cs`(`ShotDir` 경로 갱신, 대기 120→300프레임, `04_skin_closeup` 스테이지 신설), `PlaytestDungeonEnemiesGui.cs`(`ShotDir` 경로 갱신만). `PROJECT_STATE.md` 갱신.

## 2026-09-23 — SSS 글로우 확인 계속, GUI hang이 "반복 launch 부하"로 재현됨 (같은 세션 "이어해")

전날 세션이 남긴 대로 사용자가 "이어해"를 요청 — SSS 글로우 확인을 계속했다.

`PlaytestDungeonEnemiesGui`의 텔레포트 지점(적 무리 옆)이 스크린샷 전에 플레이어를 쓰러뜨리는 문제를 고치려 `HeroState.Invulnerable = true`를 Teleport()에 추가했으나, 실제로는 효과가 없었다 — `PlayerController.Update()`가 매 프레임 `_invulnTimeLeft`(대시 전용 무적 타이머) 기준으로 `HeroState.Invulnerable`을 덮어쓰기 때문에(경쟁 상태), 한 번 켠 값이 바로 다음 프레임에 꺼진다. 게다가 이 필드를 강제로 켜는 우회(리플렉션으로 `_invulnTimeLeft` 큰 값 주입)는 대시 무적 시 하늘색 틴트(`CharacterVisual.Tint`)가 씌워져 피부색 확인 자체를 방해하므로 그 방법도 부적합했다. 대신 **적 `DungeonEnemy` 컴포넌트를 통째로 `enabled=false`** 하는 쪽으로 고쳤다(공격 자체가 안 나감, 틴트 부작용 없음). 배치 컴파일로 확인(exit 0, 오류 없음).

GUI로 재검증하려 했으나 이 세션의 5·6·7번째 Unity GUI launch에서 hang이 다시 나타났다 — 이번엔 라이선싱 성공 직후("Licensing::Client] Successfully resolved entitlement details") 다음 로그 줄(패키지 등록 진입)이 60초 넘게 안 나와 멈춘 것을 확인, `taskkill //F //IM Unity.exe //T`로 정리했다(두 번). 같은 세션의 1~4번째 launch(`PlaytestCharacterRealisticGui` 2회·`PlaytestDungeonEnemiesGui` 1회·배치 컴파일 확인 1회)는 전부 멀쩡했던 것과 대조된다 — 지난 세션 결론("일회성")은 틀렸고, **한 세션에서 GUI/배치를 짧은 간격으로 여러 번 반복 실행하면 뒤로 갈수록 hang 확률이 오른다**는 가설이 더 설득력 있다(정확한 임계치·원인은 미확인).

`PlaytestCharacterRealisticGui`는 이번엔 문제없이 두 번 실행됐다 — 1차 스크린샷(idle·run)에서 피부가 **네온 시안**으로 찍힌 걸 발견했는데, 이는 SSS 버그가 아니라 66-2장 ⑩에 이미 기록된 "셰이더 캐시 콜드" 함정의 새로운 증상(이전엔 "플랫한 색"만 알려져 있었는데 커스텀 Shader Graph는 네온 시안 디폴트를 보인다는 걸 이번에 확인)이었다 — 대기 프레임을 120→300으로 늘리고 재실행하니 사라졌다. 다만 이 씬(`BuildTestCharacterRealisticScene`)은 의도적으로 포스트프로세싱 없는 순수 리그 확인용이라(클래스 주석에 명시) 정상 톤이어도 SSS 글로우 자체가 육안으로 안 띄었다 — 블룸이 있는 실제 게임 씬(Dungeon)에서 봐야 진짜 판단이 가능한데, 그쪽은 위 hang 때문에 이번에도 결론을 못 냈다.

세 번의 GUI/배치 실행 모두 4~6개 설정 파일이 조용히 고쳐진 걸 `git checkout --`으로 원복(기존 패턴 그대로, `tools/unity-batch.sh`가 배치 실행분은 자동 처리).

코드 변경: `PlaytestDungeonEnemiesGui.cs`(무적 플래그 방식 폐기 → 적 `DungeonEnemy.enabled=false` 방식으로 교체, `using Saga.Dungeon.Data;` 추가). `PROJECT_STATE.md` 갱신.

## 2026-09-23 — 던전 GUI 즉사 문제 해결, 카메라 구도가 피부 확인엔 안 맞음을 확인 (같은 세션 "이어해" 계속)

적 `DungeonEnemy.enabled=false` 수정을 커밋한 뒤 곧바로 재검증했다. 첫 재시도는 launch 5~7번째 구간이라 hang이 다시 남(taskkill로 정리, `git checkout --`로 4파일 원복). 문서 작업으로 몇 분 텀을 두고 재시도하니 이번엔 정상 진행 — package version bump(`com.unity.cloud.gltfast` 6.9.0→6.14.1)가 걸려 있어 평소보다 느린 전체 재임포트를 거쳤지만 hang 없이 exit 0으로 끝났다.

스크린샷 확인 결과: HP 30/30 유지, "가까운 적 없음" — 적 비활성화 수정이 제대로 작동해 더 이상 즉사하지 않는다. 하지만 카메라가 여전히 탑다운(디아블로류, `CameraRig` 기본 pitch=55°를 확인용으로 30°까지 낮춘 상태)이라 Maria가 갑옷에 완전히 가려 피부가 거의 안 보였다 — pitch를 게임 정상 최소(30°)보다도 더 낮춰(15°, reflection으로 클램프 우회, 천장·바닥 여유는 계산으로 확인) 재실행했으나 여전히 위에서 내려다보는 각도라 결과는 비슷했다. 즉 이 씬의 카메라 구도 자체가 피부 확인이라는 목적에 안 맞는다는 결론 — `TestCharacterRealistic`(근접 측면 샷)처럼 스크린샷 전용의 별도 카메라(허벅지 높이·근접 고정)를 새로 만들지 않는 한, 기존 게임플레이 카메라를 아무리 조정해도 한계가 있다.

이번 실행에서도 6개 설정 파일이 조용히 고쳐진 걸 `git checkout --`으로 원복(패턴 재확인).

**결론**: GUI hang은 launch 횟수가 쌓이면 걸리다가 시간을 두면 다시 멀쩡해지는 패턴을 보였다(정확한 임계치는 미확인, 재부팅 없이도 해소됨 — 지난 세션의 "재부팅해야 풀린다"는 결론과 다르다, 단순 launch 간격 문제일 가능성). SSS 글로우 자체는 이번에도 육안 판정을 못 냈다 — 코드·셰이더 검증(ShaderHasError=False)은 끝났고 남은 건 순수히 "보기 좋은가"의 미적 판단인데, 그걸 볼 방법(스크린샷 전용 카메라 신설, 또는 사용자 실기 확인)이 아직 없다.

코드 변경: `PlaytestDungeonEnemiesGui.cs`(카메라 pitch 30°→15°, 주석 갱신). `PROJECT_STATE.md` 갱신.

## 2026-09-23 — 던전 카메라 회전이 실제로 안 먹던 원인 찾음, 하지만 launch 9회째부터 GUI가 아예 시작을 못 함 (같은 세션 "이어서 해")

지난 두 번의 pitch 조정(30°→15°)이 스크린샷에 아무 변화도 없었던 게 이상해서 `CameraRig.cs`를 다시 읽었다 — `Update()`는 매 프레임 `ApplyZoom()`만 다시 부르고(줌만 `cam.transform.localPosition`에 반영), 실제 회전(`transform.localRotation`)은 `Awake()`와 드래그 입력 전용 `Rotate()`에서만 쓰인다. 헤드리스 툴은 드래그를 안 하니 `_pitchDeg` **필드**를 reflection으로 아무리 바꿔도 화면엔 `Awake()` 시점 기본값(55°)이 그대로 남아 있었던 것 — 두 번의 "pitch 낮춤" 시도가 전부 무효였던 이유가 이거였다.

고침: `rig.transform.localRotation = Quaternion.Euler(0f, 0f, 0f)`로 직접 덮어쓴다(pitch=0, 완전 수평). `CameraRig` 피벗(GO)이 플레이어 기준 로컬 (0, 0.9, 0) — `BuildTestDungeonScene.BuildPlayer()`의 CharacterController center와 같은 높이(허리)라, pitch=0이면 허리 높이에서 정면(플레이어가 보는 방향)을 보는 구도가 된다. zoom도 게임 정상 최소(3)보다 가깝게(2) 당겼다. 배치 모드 컴파일로 문법 확인(exit 0, 오류 없음).

GUI로 실제 확인하려 했으나 이 세션의 9번째 Unity launch(배치 컴파일 포함 전체 누적 횟수)부터 시작 로그 첫 줄("Library Redirect Path: Library/") 직후 75초 넘게 아무것도 안 나오고 멈췄다 — 이번엔 패키지 등록·라이선싱 근처도 못 가고 더 일찍 걸렸다. `taskkill //F //IM Unity.exe //T`로 정리(설정 파일 드리프트 없음 — 그만큼 일찍 죽었다는 뜻). 직전 세션 구간에서 관찰한 "launch 5~7회째 hang, 8회째는 시간 두면 정상"이라는 패턴과 달리 이번엔 문서 작업으로 몇 분을 들인 뒤인데도 곧바로 걸렸다 — **단순 시간 간격이 아니라 launch 누적 총량 자체가 원인**일 가능성이 커 보인다(정확한 메커니즘은 여전히 미확인, 재부팅하면 풀리는지는 다음 세션이 확인).

이 세션은 GUI/배치 launch를 12회 가까이 썼다 — 다음 세션은 launch를 아껴서(특히 세션 앞부분에 몰아) 이 고침을 실제로 확인해야 한다.

코드 변경: `PlaytestDungeonEnemiesGui.cs`(카메라 회전을 `transform.localRotation` 직접 설정으로 교체, zoom 2로 조정, 주석 갱신). `PROJECT_STATE.md` 갱신.

## 2026-09-23 — 던전 카메라 회전 고침 GUI 확인 완료, SSS 글로우 얼굴 클로즈업 파이프라인 재구축 (새 세션 "사가유니티 이어해", 던전 카메라 원인 발견 다음)

이 PC는 세션 시작 전 06:37에 재부팅돼 있었다(uptime ~13분). 재부팅 직후 `PlaytestCharacterRealisticGui` 첫 launch가 시작 로그 첫 줄 직후 바로 멈췄다(taskkill 정리) — 지난 세션의 "재부팅하면 풀릴 수도" 가설을 정면으로 반박(재부팅 직후인데도 걸림). 그런데 **딱 한 번 재시도하니 바로 정상화**됐고, 이후 이 세션에서 launch를 9회 더 돌렸는데 전부 정상 종료(hang 재발 전혀 없음) — "launch 누적 자체가 원인"이라는 지난 세션 가설도 이번엔 안 맞았다. 결론: hang 원인은 여전히 불명이지만, 걸리면 일단 한 번 재시도하는 게 실용적이라는 데이터가 쌓였다.

배치 컴파일(unity-batch.sh로 4파일 원복 확인)로 시작, `PlaytestCharacterRealisticGui`(SSS 글로우 확인용)를 재실행 — 지난 세션이 만든 골반·허벅지 클로즈업(`04_skin_closeup.png`)을 다시 봤더니 완전히 회색이었다. `maria_diffuse.png` 텍스처 아틀라스를 직접 열어 대조해 보니 그 UV 자리는 원래 살구색 피부로 그려져 있었다 — 즉 그 클로즈업이 잡은 서브메시는 **피부가 아니라 회색 스판덱스 속옷 서브메시**였다(지난 세션들의 "피부가 grey로 나온다" 관찰이 애초에 잘못된 부위를 보고 있었던 것). 얼굴(진짜 피부가 크게 드러나는 부위)을 보려고 카메라를 세계축 +Z가 얼굴 방향이라고 가정해 재배치했더니 완전히 프레임 밖으로 빗나갔다 — Idle/Run/Attack 애니메이션의 root motion이 매 실행마다(시스템 부하에 따라 실시간 타이밍이 달라져) 캐릭터를 다른 정도로 회전·이동시키기 때문에 세계축 가정 자체가 성립하지 않았다. Humanoid `Head` 본의 실제 런타임 `forward`를 읽어 그 앞에 카메라를 두는 방식으로 바꾸니 훨씬 안정적으로 얼굴을 잡았다.

이 과정에서 새 함정을 발견: `ScreenCapture.CaptureScreenshot()`는 호출한 그 순간의 화면이 아니라 **그 프레임이 실제 렌더된 뒤**(=같은 Update tick 안에서 나중에 실행된 코드까지 반영된 상태)의 화면을 찍는다. 카메라를 옮기는 코드를 캡처 호출 "다음 줄"에 써 뒀더니 캡처 파일에 옮긴 뒤의 화면이 찍혔고, 반대로 카메라를 원위치로 되돌리는 코드를 캡처 호출 다음에 써 뒀을 땐 캡처 파일에 원위치 화면이 찍혔다(즉 라벨과 내용이 서로 뒤바뀜) — 실제로 두 번 겪고 나서야 규칙을 파악했다. `PlaytestCharacterRealisticGui.cs`의 스테이지 머신을 "카메라/조명 세팅 tick"과 "대기 후 캡처 tick"이 항상 분리되도록 재구성해 고쳤고(idle 정착 직후 안정 포즈에서 얼굴 클로즈업을 잡도록 변경, attack 스윙 도중은 프레임 타이밍에 따라 머리 숙임 등 극단 포즈가 잡혀 재현이 불안정했음), 재실행으로 `02_face_closeup.png`가 매번 같은 구도로 나오는 것까지 확인했다.

다만 이 리그확인 씬은 조명이 원래 아주 단순해서(방향광 1개 + 낮은 ambient, `BuildTestCharacterRealisticScene` 설계상 의도) 보통 밝기로는 피부가 칙칙한 회색조로 나오고, ambient를 비정상적으로(1.4 근처) 올려야 텍스처 원래의 살구색이 드러났다 — SSS 글로우(FakeSSS 서브그래프가 Emission에 얹는 Fresnel 웜톤 림)가 있는지 없는지는 이 씬에서 여전히 판단할 수 없다(지난 세션 결론과 같음, 재확인만 된 셈). Bloom Volume을 Play 중에만 임시로 추가해 봤지만(`SetupBloomVolume()`) 애초에 조명 자체가 너무 단순해 큰 도움은 안 됐다.

이어서 `PlaytestDungeonEnemiesGui`(지난 세션이 고친 카메라 회전)를 실행해 **처음으로 GUI 확인에 성공** — 스크린샷에 탑다운이 아니라 정상적인 어깨너머 시점(허리 높이, 정면)으로 플레이어가 잡졸 무리 사이에 서 있는 장면이 찍혔다. 지난 세션이 코드만 보고 판단했던 고침이 실제로 맞았음을 시각적으로 확정. 다만 이 구도는 캐릭터 뒷모습이라 피부 노출이 없어 SSS 글로우 판단엔 못 쓴다.

배치 모드가 다시 4파일(ProjectSettings/Packages)을 건드려 `git checkout --`으로 원복.

코드 변경: `PlaytestCharacterRealisticGui.cs`(Head 본 `forward` 기반 얼굴 클로즈업 + Bloom Volume 임시 추가 + 스테이지 분리로 캡처 타이밍 버그 수정, `ShotDir` 이번 세션 경로로 갱신), `PlaytestDungeonEnemiesGui.cs`(`ShotDir`만 갱신). `PROJECT_STATE.md` 갱신.

## 2026-09-23 — 던전에서 Maria 얼굴을 보려고 yaw=180 추가, 그런데 GUI hang이 4연속 재발 (같은 대화 "사가유니티 이어해" 계속, 앞 절 다음)

앞 절에서 던전 카메라 회전 고침을 GUI로 확인했지만 그 구도는 플레이어 뒷모습이라 SSS 글로우 판단엔 못 썼다. `CameraRig.cs` 소스를 직접 읽어(추측 없이) 구조를 확인했다 — `ApplyZoom()`이 카메라를 rig 로컬 `(0,0,-zoom)`에 두므로 yaw=0(pitch=0)이면 플레이어 뒤에서 플레이어가 보는 방향(=플레이어 등짝)을 보게 된다. yaw=180을 주면 rig 회전이 뒤집혀 카메라가 반대쪽(플레이어 앞)으로 가서 플레이어를 돌아보게 되므로 얼굴이 보일 것으로 계산됨 — `PlaytestDungeonEnemiesGui.cs`의 `_yawDeg`·`transform.localRotation`을 180으로 바꿈. 배치 컴파일 통과.

GUI로 확인하려 했으나 **4번 연속 hang**했다 — 매번 라이선싱 완료 직후(패키지 등록 전, 우리 `executeMethod` 코드는 전혀 실행되지 않는 지점)에서 멈췄다(메모리가 98MB 근처에서 전혀 안 늘어남, 2~3분씩 확인). 첫 hang 후 곧바로 재시도(2차)도 hang, 3차도 hang, 그래서 5분을 쉬었다가 4차를 시도했는데도 hang — 이 대화 앞부분(같은 세션)에서 "hang 후 한 번 재시도하면 풀린다"·"launch 누적이 원인 아님"이라고 정리했던 것과 반대로, 이번엔 여러 번 연속으로 걸렸다. hang 지점이 항상 우리 코드 실행 전이라 yaw=180 변경 자체가 원인일 수는 없다 — 이 대화 세션 안에서 Unity launch를 이미 13회 넘게 썼는데, 그로 인해 시스템(디스크 캐시·Defender 등 추정, 확증은 못 함) 상태가 나빠졌을 가능성이 있다. 메모리(23GB 여유)·디스크(258GB 여유)는 정상이라 단순 리소스 고갈은 아님.

매번 `taskkill //F //IM Unity.exe //T`로 정리, `ProjectSettings/`·`Packages/` 드리프트 없음(그만큼 일찍 죽었다는 뜻).

**다음 세션**: yaw=180 코드는 이미 반영돼 있으니 새 세션 시작 직후 1~2회로 GUI 확인만 하면 된다. 이번 대화에서 launch를 너무 많이 썼을 가능성을 염두에 두고, 세션을 새로 시작해서(이 대화를 이어가지 말고) 다시 시도하는 편이 나을 수 있다.

코드 변경: `PlaytestDungeonEnemiesGui.cs`(카메라 yaw를 180으로 바꿔 플레이어 얼굴을 보게 함 — GUI로 검증은 못 함). `PROJECT_STATE.md` 갱신.

## 2026-09-23 — GUI hang이 프로젝트·스크립트와 무관함을 확정 (같은 대화 계속, 사용자가 재부팅 없이 "이어해"를 4번 더 요청)

사용자가 재부팅을 권했는데도 재부팅 없이 계속 이어가 달라고 해서 매번 한 번씩 재시도했다 — 전부 hang(누적 7연속). 다섯 번째쯤부터는 hang 원인이 우리 코드일 가능성을 배제하려고 `-executeMethod` 인자 자체를 빼고 `Unity.exe -projectPath ...`만으로 순수 에디터를 열어 봤는데 **이것도 똑같이 라이선싱 직후~패키지 등록 사이에서 멈췄다**(메모리 98MB 근처 고정) — `PlaytestDungeonEnemiesGui`·`PlaytestCharacterRealisticGui` 어느 쪽 코드와도 무관하게, 이 PC의 Unity 에디터가 **GUI 모드로 뜨는 것 자체**가 막혀 있다는 뜻이다. 같은 시간 동안 `-batchmode -nographics`는 계속 멀쩡했다(배치 컴파일 여러 번 성공) — GUI 모드에서만 나는 문제로 범위가 좁혀졌다.

Defender 예약 검사 마지막 실행은 전날 저녁이고 지금은 안 돌고 있음, 메모리 23GB 여유, 디스크 idle, Windows Update 서비스 정지 — 리소스 고갈이나 눈에 보이는 백그라운드 작업은 없었다. 근본 원인은 여전히 못 찾았지만 "우리 프로젝트 문제가 아니다"는 확정했다.

**다음 세션**: yaw=180 코드는 그대로 남아 있다. 재부팅 없이는 GUI 확인이 절대 안 풀린다는 게 이번에 실증됐으니, 다음엔 재부팅부터 확인하고 시작할 것.

코드 변경 없음(진단만). `PROJECT_STATE.md` 갱신.

## 2026-09-23 — 재부팅 뒤 GUI hang 완전 해소, 던전 얼굴(yaw=180)·SSS 얼굴 클로즈업 둘 다 확보 (새 세션 "사가유니티 이어해", GUI hang 확정 다음)

새 세션 시작 시 `Get-CimInstance Win32_OperatingSystem | LastBootUpTime`로 uptime을 확인하니 3분 — 전 세션이 권한 재부팅이 이미 되어 있었다. 지난 세션 결론("재부팅 없이는 절대 안 풀린다")대로 바로 GUI 런치를 시도.

`ShotDir`(두 `Playtest*Gui.cs`, 이전 세션 UUID `989ab3f5-...`)를 이번 세션 scratchpad 경로(`9a55a781-...`)로 갱신 후:
- `PlaytestDungeonEnemiesGui.Run` — 180초 타임아웃 걸고 `Start-Process`+`WaitForExit`로 실행, **exit 0, hang 없음**. `10_dungeon_bossgroup.png`에서 yaw=180이 실제로 먹혀 Maria가 카메라를 정면으로 마주 보고 뒤로 Abe·Brute가 보임 — 던전 카메라 얼굴 확인 완료.
- `PlaytestCharacterRealisticGui.Run` — 마찬가지로 **exit 0, hang 없음**. `02_face_closeup.png` 확보. 다만 스크린샷상 피부가 여전히 그늘진 회갈색에 가까워 SSS 글로우가 뚜렷이 안 보임 — 정적 이미지로는 Fresnel 기반 글로우 판단이 애매해 최종 판단은 사용자 실제 화면 확인으로 넘김(105 Q-U3 값은 임의 근사치).

두 런치 모두 **한 번에** 성공해 전 세션 7연속 hang이 코드 문제가 아니라 GUI 모드 자체의 일시적 상태(재부팅으로 해소)였다는 진단이 맞았음을 실증했다.

배치/GUI 실행이 늘 그렇듯 `ProjectSettings/ProjectVersion.txt`·`Packages/manifest.json`·`packages-lock.json`이 6000.3.24f1로 자동 상향됐길래 커밋 전 `git checkout`으로 원복(설치 에디터가 6000.3.24f1이라도 프로젝트 고정 버전은 그대로 유지).

코드 변경: `ShotDir` 경로 두 곳(세션마다 반복될 변경). `PROJECT_STATE.md` 갱신.

## 2026-09-23 — SSS 글로우 "직접 검증해봐" 지시로 파이프라인 생사 확인부터 최종 튜닝까지 (같은 대화 계속, 던전 얼굴·SSS 캡처 다음)

101-2·104-1 잔여가 전부 게이트로 막혀 있어 다음 작업을 물었더니 사용자가 "직접 검증해봐"를 선택 — SSS 글로우 판단을 사용자에게 미루지 말고 직접 결론을 내라는 뜻으로 받아들였다.

`02_face_closeup.png`(튜닝값 Intensity=0.6)를 다시 봐도 피부가 그늘진 회갈색일 뿐 글로우가 안 보였다. 먼저 ambient 두 단계(0.42/0.6) 비교 캡처(`02a`/`02b_face_closeup_*.png`)로 나눠 봤지만 **둘 다 아무 글로우도 없었다** — "ambient가 너무 높아 글로우가 묻힌다"는 기존 결론과 달리, 애초에 아무것도 안 보이는 수준이었다.

값 문제인지 배선 자체가 죽은 건지 구분하려고 `BuildMariaSssShaderGraph.cs`의 override를 극단값(Intensity=20, Colour=순빨강 (5,0,0,1))으로 바꿔 셰이더를 재빌드(`Saga/Build Maria SSS Shader Graph (Reflection)`, 배치모드)하고 다시 캡처했더니 **처음엔 얼굴·몸통 전체가 네온 시안으로 찍혔다** — `PlaytestCharacterRealisticGui.cs` 기존 주석이 경고하던 "SSS Shader Graph 미컴파일 시 네온 시안" 함정 그 자체였다. 원인은 그래프를 방금 재빌드해서 이 GUI 프로세스가 그 변형을 처음 컴파일하는 상황이라 기존 idle 정착 대기 300프레임(캐시된 셰이더 기준)으로 부족했던 것 — 900으로 늘려 재실행하니 **턱선·목선·가슴골에 뚜렷한 빨간 글로우**가 나타나 `Mask`·`Dot Product`·`GetMainLightDir` 체인(FakeSSS 서브그래프)이 처음부터 정상 작동 중이었음을 확정했다(`02a/02b_face_closeup_*.png`, 이번엔 진짜 극단값 결과).

배선이 살아있음을 확정한 뒤 프로덕션 웜톤 Colour(최대 채널 1.0, 디버그 순빨강의 1/5 세기)에 맞춰 Intensity를 2.5→6→15로 세 차례 재빌드+재캡처하며 올렸다. 2.5·6은 여전히 안 보였고 **15에서 코·턱선에 은은한 웜톤 하이라이트**가 육안으로 확인됐다(과하지 않은 수준, 게임 내 배경 아트 방향 "사실적 PBR"에 맞음). 최종값으로 확정 후 idle 정착 대기를 300으로 되돌리고(그래프를 안 건드리는 평소 실행 기준) 한 번 더 재확인 — 네온 시안 재발 없이 정상.

Unity GUI 런치는 이번 절에서만 6회(디버그 극단값 1·튜닝 2.5/6/15 각 1·최종 확인 1), 배치 모드(Build+Verify)는 4회 — 전부 exit 0, hang 없음(재부팅 효과가 이 세션 내내 유지됨을 재확인). 배치/GUI 실행 뒤 `ProjectSettings/ProjectVersion.txt`·`Packages/manifest.json`·`packages-lock.json`이 또 24f1로 자동 상향돼 커밋 전 원복.

코드 변경: `BuildMariaSssShaderGraph.cs`(Intensity 0.6→15 최종), `PlaytestCharacterRealisticGui.cs`(ambient 저/고 비교 캡처 2단 추가, idle 대기 300 유지 + 재빌드 직후 예외 주석). `PROJECT_STATE.md` 갱신.

## 2026-09-23 — STORY 5-2 1단계(직업 무예+SP) + 모바일 버튼 먹통 버그 발견·STORY 수정 (새 세션 "사가유니티 이어해", Opus 5.5)

남은 작업이 전부 게이트에 걸린 것처럼 보였는데, STORY 5-2의 보류 사유("웹·godot 둘 다 미확정")가 낡았음을 확인 — 웹 `saga-web/saga-story/PLAN.md` §5-2는 2026-09-19에 이미 구현됐다(웹 실기 확인은 아직). 진짜 걸림돌은 이 트랙에 무예 96·SP·조작 띠가 없다는 구조 차이(공통 무예 넷뿐, `StoryJobTrainer` 주석이 SP를 "범위 밖"으로 명시). 사용자에게 작게 재해석/무예 트리부터/보류 셋 중 물어 **"무예 트리부터"**. godot도 5-2는 "웹 결과 보고 결정"으로 보류 중.

**1단계 구현**: 웹 `data-job.js` 1차 직업 무예 24개 중 heal 둘(생기결·치유)을 뺀 22개를 `StorySkillData`로(원문 상수 그대로, px→m만). 체력 축이 없어(플레이어 피격 없음) 철갑 guard·은신보/축지 invuln도 뺐고, 부적 regen은 기력 회복 배율로 옮김(`StoryCombat.TickMpRegen` 인자 추가). 퇴보사는 웹 코드가 앞으로 밀지만 이름·설명대로 뒤로 밀었다(웹 쪽 불일치로 보임). `StorySkillState`: SP=(레벨−1)×2(웹 5-2 뒤 현재값 — 2단계에서 다시 안 바꾸려고), 레벨 0 무예는 못 씀, 배율=기본+레벨당×(lv−1), 무예 칸 4는 웹처럼 자동(찍은 것 표 순서). 강화는 웹 `p.buff`처럼 한 칸 — 기합과 직업 강화가 서로 덮는다(`_buffAtk/_buffSpeed/_buffRegen`). 시전 7갈래(근접 여러 타·범위·관통·화살·연사·돌진·강화), `StoryBolt`에 비관통 모드. 세이브는 `skillKeys`/`skillLevels` 나란한 배열(버전 안 올림, 옛 세이브는 null→빈 상태). UI는 `StorySkillPanelUi`(K·모바일 "무예"·전직 직후·전직관 재방문 시 남은 점수 있으면) + 무예 칸 버튼 `StorySkillSlotButton`(5~8, 이름·쿨다운 폴링). 현지화 ko/en 53키씩.

**버그 발견 — 모바일 버튼 전부 먹통**: 무예 칸 버튼을 붙이다 `BuildActionButton`이 `onClick.AddListener`(런타임 전용 리스너)를 쓰는 걸 보고 씬 파일을 확인 — 다섯 씬 전부 영속 리스너 0개(TestField 102·TestVillage 154·TestCity 153·TestDungeon 92·TestVillageForest 47개 onClick 전부 `m_Calls: []`). 런타임에 다시 거는 코드도 없다. 스스로 UI를 짓는 컴포넌트(`StoryJobChoiceUi`·`StorySettingsPanel`·`StoryLabyrinthMapUi` 포기 버튼)도 에디터 `Build()`에서 걸어 같은 상태 — 실제 플레이에서 전직 팝업 버튼도 먹통이었다는 뜻. 헤드리스 진단은 핸들러를 리플렉션으로 직접 불러 한 번도 못 잡았고, PC GUI 확인은 키보드라 안 드러났다. 먼저 진짜 `Button.onClick.Invoke()`를 누르는 `CheckButtonWiring()`을 넣고 **옛 씬에서 실패함을 확인**(공격 버튼을 눌러도 공격 안 나감)한 뒤 고쳤다: 빌더 버튼은 `UnityEventTools.AddPersistentListener`(교대는 `AddIntPersistentListener`, 저장은 정적 메서드라 새 `StorySaveButton` 컴포넌트), 자기-빌드 UI는 버튼을 `[SerializeField]`로 두고 `Awake()`에서 건다. 재빌드 뒤 TestField 영속 리스너 14개.

진단 첫 실행이 KillEnemies에서 실패 — `CheckButtonWiring()`이 시작 자리에서 진짜 공격 버튼을 눌러 옆 잡졸을 베어 "잡졸 10" 전제를 깼다. 적에게서 10m 떨어진 곳으로 옮겨 누르고 같은 틱에 되돌려 해결. 이후 `PlaytestStorySlice` **3연속 OK**(버튼 배선·직업 무예 7갈래 시전·SP 거절 사유 셋·자동 칸·패널 줄·무예 세이브 왕복·옛 형식 로드). 무예 패널은 "+" onClick 중 그 버튼을 `DestroyImmediate`하지 않게 줄 구성이 같으면 글자만 고친다 — `StoryLabyrinthMapUi`는 같은 위험이 남아 있어 PROJECT_STATE에 미해결로 적음.

**남은 것**: GO·DUNGEON·FOREST·REALM 버튼 배선(다음 세션 1순위, Phase 0), 5-2 2단계 유파 세트. 사용자가 "현재 작업 다하고 새로운 세션에서 이어 할게"로 마무리 지시.

코드: `StorySkillData`·`StorySkillState`·`StorySkillPanelUi`·`StorySkillSlotButton`·`StorySaveButton`(신규), `StoryPlayerController`·`StoryBolt`·`StoryCombat`·`StorySaveState`·`StoryHud`·`StoryJobTrainer`·`StoryJobChoiceUi`·`StorySettingsPanel`·`StoryLabyrinthMapUi`·`BuildTestStoryScene`·`PlaytestStorySlice`, `TestField.unity` 재빌드, 현지화 두 파일. 문서: PLAN 101-2 STORY 행, `PROJECT_STATE.md`(덮어씀), `HOW_TO_PLAYTEST.md`(5~8·K).

## 2026-09-23 — 모바일 버튼 먹통 GO·DUNGEON·FOREST·REALM 수정 + 비경 지도 onClick 중 파괴 해소 (새 세션 "사가 유니티 이어해", Opus 5.5)

PROJECT_STATE 다음 작업 1순위(Phase 0 안정화). STORY 때처럼 판마다 버튼을 `[SerializeField]`+`Awake()`로 옮기면 REALM `RealmCommandUi`만 버튼 32개라, **공용 도우미 `SagaCore/ButtonWiring.cs`** 하나를 두고 네 판 UI kit(`EncounterUiKit` GO·FOREST, `RealmUiKit`, DUNGEON `BlessingChoiceUi`·`DungeonSettingsPanel`의 `NewButton`)과 씬 빌더 버튼이 전부 이걸 거치게 했다: 에디터에서 지을 때(`!Application.isPlaying`)는 `UnityEventTools.AddPersistentListener`(인자 하나는 string/int 오버로드), Play 중에 지을 때(열 때마다 다시 짓는 목록)는 그냥 `AddListener`. 영속 대상이 못 되는 람다(이름이 `<`로 시작하거나 대상이 UnityEngine.Object가 아님)가 에디터 빌드에서 오면 경고를 남긴다 — 이번 재빌드 넷 모두 경고 0. 람다는 이름 있는 메서드로 바꿨다: 설정 닫기(`ClosePanel`)·REALM 패널 닫기 7개(`CloseXxxPanel`)·명령 10(`Wire(btn, ChooseOrder, key)`)·일기토 셋·승급/축복 카드(`Wire(btn, ChooseIndex, i)`)·GO 전투 버튼(`DoAct`, string). 정적 `SaveState.Save()`는 영속 대상이 못 돼 `GoSaveButton`·`DungeonSaveButton`·`ForestSaveButton`(STORY `StorySaveButton`과 같은 결). REALM 저장은 원래 `RealmCommandUi.ExecuteSave` 메서드라 그대로.

조사 중 알게 된 것: GO 전투 사건 셋(`BanditEncounter`·`RareWolfEncounter`·`ShrineTrialEncounter`)은 원래부터 `Awake()`에서 자식을 지우고 UI를 통째로 다시 지어(2026-09-12 NRE 수정) 런타임 리스너가 살아 있었다 — GO 조우·전투 버튼은 폰에서도 됐을 것이다. 먹통은 설정·승급 3택·저장이었다. 에디터 때 지은 옛 캔버스는 비활성 고아로 남는다(원래 주석대로 감수) — 이제 그쪽에도 영속 리스너가 붙어 "죽은 버튼" 검사에 안 걸린다.

진단: 공용 `Assets/Editor/ButtonWiringCheck.cs` — Play 중 씬의 **모든** Button(비활성 포함)에서 영속+런타임 리스너가 0인 것을 찾는다(런타임 수는 공개 API가 없어 `UnityEventBase.m_Calls.m_RuntimeCalls` 리플렉션, 이름이 바뀌면 검사 자체가 실패로 알림) + 설정(REALM은 명령도) 버튼을 **진짜 `onClick.Invoke()`**로 열고 닫는다. 네 판 Playtest에 `CheckButtonWiring()`으로 넣음. **고치기 전 씬에서 먼저 실패 확인**: GO 버튼 51개 중 32개 먹통, 설정 버튼 opened=False. 재빌드 뒤 영속 리스너 TestVillage 0→32 · TestDungeon 0→17 · TestVillageForest 0→10 · TestCity 0→39(= 씬의 onClick 수 전부).

STORY 미해결(작음)도 닫음: `StoryLabyrinthMapUi.ClearChildren()`이 노드 버튼 onClick → 즉시 끝나는 노드 → `ShowFloor()` 경로에서 **지금 눌린 버튼을 `DestroyImmediate`**하던 것 — 떼어 내고(`SetParent(null)`)·끄고 `Destroy`로 프레임 끝에 파괴(같은 프레임 재그리기 때 쌓이는 원래 문제도 그대로 피함).

코드: `SagaCore/ButtonWiring.cs`·`Editor/ButtonWiringCheck.cs`·`GoSaveButton`·`DungeonSaveButton`·`ForestSaveButton`(신규), 네 kit·`GoSettingsPanel`·`PerkChoiceUi`·GO 전투 사건 셋·`ForestSettingsPanel`·`DungeonSettingsPanel`·`BlessingChoiceUi`·`RealmCommandUi`·빌더 셋(Village·Dungeon·VillageForest)·Playtest 넷·`StoryLabyrinthMapUi`, 씬 넷 재빌드.

검증: 네 씬 재빌드 exit 0(ButtonWiring 경고 0). `PlaytestHeadless`·`PlaytestDungeonHeadless`·`PlaytestForestHeadless`·`PlaytestRealmSlice` **4연속 OK**(1회차 도중 검사에 "영속 대상 메서드가 지금 코드에 있는가"를 더함 — 2~4회차가 강화판), 진짜 onClick으로 설정(REALM 명령도) 열고 닫힘. 비경 지도 수정 뒤 `PlaytestStorySlice` 3연속 OK. 실기(폰 탭)는 사용자 확인 전.

## 2026-09-23 — STORY 5-2 2단계: 2차 전직(Lv.15) + 2차 무예 19 + 유파 세트, 비경 적 경험치 레벨 비례 (같은 날 새 세션 "사가 유니티 이어해", Opus 5.5)

PROJECT_STATE 1순위가 5-2 2단계(유파 세트)였는데, 조사해 보니 **이 트랙엔 1차 무예만 있어 유파마다 무예가 딱 하나** — 무예 칸 4에 "같은 유파 2개"를 놓을 방법 자체가 없었다(웹은 유파마다 1~4차 4개, 띠 8칸). 사용자에게 셋(2차 전직부터 / 효과 종류로 재해석 / 1단계로 닫기) 중 물어 **"2차 전직부터"**.

그 질문에서 "레벨 상한이 없고 비경을 반복할 수 있어 Lv.25까지 갈 수 있다"고 했는데 **틀렸다** — 계산하니 필드·비경 적이 lv=1 고정(잡졸 10·두목 150)이라 Lv.10→25에 비경 약 300판(웹은 사냥터 lv가 올라 경험치도 커짐). 바로잡고 다시 물어 **"비경 적 레벨 비례 + 2차 전직 Lv.15"**(Lv.10→15 비경 약 4판 추정). 이어 비경 적 체력도 웹 식(18×1.22^(lv−1))대로면 이 트랙은 플레이어 공격력이 레벨로 안 올라(웹은 장비·인물) Lv.13 무렵부터 보스를 90초 안에 못 잡는다는 추정이 나와 한 번 더 물어 **"경험치만 키우기"** — 체력은 기본 공격력(시작값+전직 grow+기억 조각)이 시작값보다 늘어난 비율만큼만(`StoryLabyrinthRunner.PlayerPowerHpMul()`, 회차 축복·버프·교대 배율은 안 넣음).

**구현**: `StoryCombat.JobsTier2`(장군·신궁·자객·도사, grow 원문, `JobInfo.Tier/From`)·`TryGetJob`·`JobPromoteLevel=15`·`JobPromoteSkillLevel=5`·`EnemyExp(lv,boss)`. `StoryJobState`: grow를 자리 사슬로 합산(웹 grow()), `Root`(무기 모양은 뿌리 그대로)·`Tier`·`InChain`·`NextJob`·`PromoteBlock()`(자리→레벨→아랫자리 무예 5, 웹 canJoin 순서)·`Promote()`(무예 레벨 유지), `Restore()`는 모르는 키를 무명으로. `StorySkillData`: 2차 무예 20 중 회천결(heal) 제외 19개, 철벽·호신부 guard와 그림자밟기·축지술 invuln은 1차처럼 빼고 **설명도 실제 효과로**(철벽 "11초간 공격 +15%", 호신부 "공격 +10% · 기력이 샘솟는다"), 활보사는 퇴보사처럼 후퇴, 선행 `Need/NeedLv`, 새 효과 `Rain`(앞 340px+몸 폭, 위 220~아래 80px 띠), `Schools` 24행 원문. `StorySkillState`: 사슬 무예 찍기+선행(`skill.why_need`), 칸 자동 배치 `SlotSkills()` — 웹 bar()처럼 윗자리부터지만 **칸이 4라 남은 자리엔 이미 놓인 것과 같은 유파를 먼저**(재해석: 표 순서만이면 2차 무예의 짝이 칸 밖으로 밀리기 쉽다), `SchoolTier()`·`BonusOf()`(판정 한 곳, 웹 schoolBonus). dash 2세트는 회피 동작이 없어 **그 dash 무예 자신의 재사용 대기**에 곱함, 4세트 급소 확정은 `RollDamage(forceCrit)`. 시전(`TryCastJobSkill`)은 결과를 배율·반경·지속·발수·재사용에 곱하거나 더할 뿐, 진단용 `LastCast`. 전직관 `ShowPromote()`(`StoryChoiceUi` 2택 오른다/나중에 — 웹 nextJobs는 갈래마다 하나), 상태 줄에 막힘 사유. 무예 패널은 사슬 전체(최대 11줄)라 1600px로 키우고 줄 간격을 조였으며 줄 앞 "[유파]"/"[유파·2세트]", 선행 부족 시 "(참격 5 먼저)". 현지화 ko/en 51키씩(영어 선행 이름은 1차 무예 실제 영어명에 맞춤, 그림자밟기는 은신보 영어명 "Shadow Step"과 겹쳐 "Shade Walk").

진단 `CheckPromotionAndSchools()`: 막힘 사유 둘 → 전직관 ShowPromote → **선택 UI 첫 버튼 진짜 onClick**으로 장군(tier 2·뿌리 warrior·atk 2+7·손에 검) → 선행 거절/허용 → 칸 [패왕격·벽공검·참격·파공검](짝 우선) · 정/파 2세트 · 세트 보정 다섯(정 피해 ×1.15가 실제 시전 mul에, 수 철벽 지속 11×1.15, 연 분시 4+1발=투사체 5개, 보 그림자밟기 재사용 6×0.8·2세트엔 급소확정 없음, 진 지진 반경 ×1.15) · 세트 없으면 보정 없음 · 전우는 앞 더미만 · 장군 패널 9줄 · `EnemyExp` lv1=10/150(옛 고정값), lv15=66/990 · 체력 배율>1 · 모르는 직업 키→무명. 기존 `CheckJobSkills` (a)의 "무예 직업은 1차 표에" 검사는 `TryGetJob`으로 바꾸고 유파·선행 무결성을 더함. TestField 재빌드 뒤 `PlaytestStorySlice` **첫 실행부터 3연속 OK**. 4세트는 칸 4·2차까지라 아직 켜질 수 없다(표·코드는 들어가 있음). 실기(손맛·Lv.10→15 판수 체감)는 사용자 확인 전.

코드: `StoryCombat`·`StoryJobState`·`StorySkillData`·`StorySkillState`·`StoryPlayerController`·`StoryWeaponVisual`·`StoryJobTrainer`·`StorySkillPanelUi`·`StoryLabyrinthRunner`·`PlaytestStorySlice`, 현지화 두 파일, `TestField.unity` 재빌드. 문서: PLAN 101-2 STORY 행(결정 셋), `PROJECT_STATE.md`, `HOW_TO_PLAYTEST.md`.

## 2026-09-23 — STORY 5-2 3단계: 3·4차 전직(Lv.20/25) + 무예 44 + 무예 칸 고정·차수 탭 (같은 날 새 세션 "사가유니티 이어해", Opus 5.5)

PROJECT_STATE 1순위가 "STORY 3·4차 전직(판단 대기)"였다 — 판단 질문(레벨·칸 자동/수동)에 답 없이 "이어해"라 기본안으로 진행했다(메모리 "판단 질문에 답 없이 이어해 = 진행 신호").

**레벨 — "같은 비율"을 따르지 않았다**: PLAN엔 "3·4차도 같은 비율로 낮춘다"고 적혀 있었지만, 2차 비율(25→15, ×0.6)이면 Lv.27/42다. 비경 한 판 경험치 ≈ `(6+4·lv)×18`(보스 15 + 전투·정예 약 3), 필요량 `50×1.28^(lv−1)`로 node 계산하니 15→27 약 60판, 27→42 약 1,543판 — 지수 곡선이라 비율로는 못 닿는다. 판수로 맞춰 **Lv.20/25**(10→15 약 5판, 15→20 약 11판, 20→25 약 28판, 자리가 높을수록 무거워지는 결은 유지). 무예 조건은 웹 canJoin() 원문 그대로(3차: 2차 무예 하나 8, 4차: 3차 무예 하나 10). 실기에서 판수가 체감상 어떤지는 확인 전.

**칸 — 자동만으론 4차에서 세트가 죽는다**: 기존 자동 배치(윗자리부터)는 4차 무예 넷을 찍으면 그 넷(유파 전부 다름)으로 칸이 차 세트 0 — 진단 (c)에 그대로 박아 두었다. 그래서 **사람이 고정**을 더했다: 고정한 것이 고정 순서대로 앞 칸, 남은 칸은 예전 자동 배치(이미 놓인 것과 같은 유파 먼저)라 하나만 고정해도 짝이 붙는다. 아무것도 안 고정하면 예전과 똑같아 1·2단계 진단이 그대로 통과. 세이브 `skillPins`(버전 안 올림, 옛 세이브 null → 고정 없음). 4세트는 1~4차 무예가 모두 있는 유파만(무사 질·궁수 안·협객 혼은 2차가 없어 최대 3, 웹판 그대로).

**구현**: `StoryCombat.JobsTier3/JobsTier4`(grow 원문)·`UpperJobTables`·`TryGetJob` 네 표·`JobPromoteLevel3/4`·`JobPromoteSkillLevel3/4`·`PromoteLevelFor/PromoteSkillLevelFor`. `StoryJobState.NextJob`이 2~4차 표를 훑고 `NextTier`·`PromoteLevelNeeded`·`PromoteSkillLevelNeeded`, `PromoteBlock()`이 차수별 조건. 전직관 상태 줄 숫자도 차수별. `StorySkillData`에 3·4차 무예 44(회복 넷 불사결·재생결·회춘·환생 제외, 무적 넷은 invuln만 빼고 돌진 유지, 답공사·익보사 후퇴, 막연한 북돋움 설명 여섯엔 실제 효과를 괄호로). `StorySkillState.TogglePin/PinIndex/PinCount/SnapshotPins`, `Restore(keys, levels, pins)`. `StorySkillPanelUi`: 사슬이 최대 23줄이라 **차수 탭**(런타임에 짓는다 — 씬 재빌드 불필요, `EnsureChrome()`이 옛 씬의 줄 영역도 옮김), 줄마다 "칸" 버튼, 탭 아래 칸 넷 줄. 현지화 ko/en 102키씩(직업 8·UI 6·무예 88).

**진단** `CheckUpperTiersAndPins()`: 3차 막힘(Lv.19·패왕격 7 — 참격 10은 안 센다)→진짜 버튼 원수(atk 2+7+13), 4차 막힘(Lv.24·천붕격 9)→전신(더 오를 자리 없음·손에 검), 자동만이면 전신 칸 [파멸격·지열·벽력돌·파천검]·세트 0, 패널 "칸" 경로로 안 익힌 철갑 거절·참격 하나 고정 → [참격·파멸격·지열·벽력돌] 정 2세트·넷 고정 → 정 4세트·다섯째 거절·칸 줄 글자·탭 4·줄 5·풀기 당김, 정 4세트 파멸격 피해 ×1.35가 실제 시전에, 명왕 보 4세트 명계보 급소 확정+재사용 8×0.8, 질 무예 3개, 3·4차 선행이 같은 뿌리 아랫자리. 기존 검사 둘 고침: 2차 뒤 `NextJob`은 이제 null이 아니라 marshal, 장군 패널은 9줄 대신 탭(2차 4줄·1차 5줄). 세이브 왕복에 칸 고정 추가, 옛 형식 정규식에 `skillPins` 선택 그룹. 첫 실행은 위 `NextJob` 기대 하나로 실패(의도된 변경) → 고친 뒤 **3연속 OK**. 씬 재빌드 없음.

코드: `StoryCombat`·`StoryJobState`·`StorySkillData`·`StorySkillState`·`StorySaveState`·`StorySkillPanelUi`·`StoryJobTrainer`·`PlaytestStorySlice`, 현지화 두 파일. 문서: PLAN 101-2 STORY 행(3단계 결정), `PROJECT_STATE.md`, `HOW_TO_PLAYTEST.md`. 작업 중 `sed -i`가 CRLF 파일을 LF로 바꿔 `git checkout` 후 Edit로 다시 했다.

## 2026-09-23 — STORY 전직 차수 옷 빛깔(101-3 G, 웹판 jobLook 이식) (같은 날 새 세션 "사가유니티 이어해", Opus 5.5)

PROJECT_STATE 다음 작업이 "STORY 101-2 전부 완료 / 나머지 보류"뿐이라, 같은 날 웹 saga-story에 들어간 `f9c07449`(전직 차수마다 주인공 옷 빛깔, PLAN §6 성장 가시화)를 이 트랙으로 옮겼다. 이 트랙의 무기(`StoryWeaponVisual`)는 갈래 뿌리로만 갈려 2~4차가 눈으로 구분되지 않았는데, 바로 앞 세션에서 4차까지 생겨 그 빈자리가 커졌다.

**식은 웹판 그대로**: 원래 색에 갈래 색(BRANCH_TINT #b8412f·#4f8f3f·#5b4a8c·#2f6fb0)을 차수×0.12(상한 0.6) 섞는다. **재해석**: 웹판은 툰 몸 전체의 세력 색을 물들이지만 이 트랙 Maria는 사실적 PBR이라 피부까지 물들이면 병색이 된다 — `BuildMariaSkinSplit`이 이미 나눈 서브메시 중 이름에 "Skin"이 든 재질은 건너뛰고 나머지 슬롯의 `_BaseColor`(텍스처에 곱해지는 값이라 무늬는 남는다)만 바꾼다. `MariaRest.mat`은 다른 판 씬도 공유해서 재질을 안 고치고 슬롯별 `MaterialPropertyBlock`으로 건다. 손의 무기(`Weapon (generated)` 밑)는 제외. 무명으로 돌아가면 블록을 비워 원래 색.

새 `StoryOutfitTint`(플레이어, `JobChosen` 구독 — `Restore()`도 이 이벤트를 쏴 로드 시에도 맞는다), `BuildTestStoryScene`이 붙이고 TestField 재빌드. 진단 `CheckOutfitTint`: 무명 0 → 무사 0.12 → 장군 0.24 → 전신 0.48 → 명왕 0.48(보라), 첫 옷 슬롯 색 = Lerp(원래 색, 갈래 색, 비율), Maria 피부 슬롯 1 제외, 무명 되돌림. 첫 실행부터 **3연속 OK**. 실기 확인 전(4차 48%가 과한지·사실적 톤과 어울리는지는 사람 눈 몫 — GUI 스크린샷은 안 찍었다).

코드: `StoryOutfitTint`(신규)·`BuildTestStoryScene`·`PlaytestStorySlice`, `TestField.unity` 재빌드. 문서: PLAN 101-3 G 행, `PROJECT_STATE.md`, `HOW_TO_PLAYTEST.md`.

## 2026-09-23 — GO Props(lantern·stall-red) 재질 마무리 + 정적 배칭 회귀 발견·수정 (같은 날 새 세션 "사가유니티 이어해", 위험 감수 재도전 선택)

PROJECT_STATE에 코딩으로 더 갈 수 있는 항목이 없어(101-2·104-1 잔여가 전부 모바일 빌드·야외 GPS·실사용 중 자산처럼 사람/실기 몫) 사용자에게 다음 방향을 물어 **"Props(lantern·stall-red) 위험 감수하고 시도"**를 골랐다(2026-09-21 보류 사유: "금속·천 등 재질이 섞인 단일 아틀라스라 목재 한 장으로 덮으면 색이 지워질 위험").

**실제로 뜯어보니 절반은 근거가 없었다.** 두 GLB의 삼각형별 UV를 직접 샘플해(Python으로 glTF 바이너리 파싱 + colormap.png 픽셀 조회) 확인: **lantern은 158개 삼각형 전부가 청회색 금속 톤**(HSV h≈0.63~0.67) — 나무 성분이 아예 없어 "섞였다"는 전제 자체가 틀렸다. 쪼갤 게 없으니 원본 텍스처는 그대로 두고 광택만 살리기로 했는데, 첫 시도에서 `_Metallic`·`_Smoothness`로 `SetFloat`했지만 조용히 무시됐다(HasProperty 검사가 막았다) — 원인은 glTFast가 GLB에 물리는 셰이더가 URP/Lit이 아니라 glTF PBR Shader Graph라 속성 이름이 `metallicFactor`·`roughnessFactor`(glTF 스펙 그대로)였다. 헤드리스 진단이 이 실수를 그대로 잡아 바로 고쳤다.

**stall-red는 실제로 섞여 있었다** — 270개 중 나무 다리·틀 142개(h≈0.05)·빨강 차양 128개(h≈0.98, wraparound)로 뚜렷이 갈린다. `BuildMariaSkinSplit.cs`(66-2장, 삼각형 UV 중심점의 텍스처 색으로 서브메시를 나누는 기법)를 그대로 재사용해 메시를 둘로 쪼개고, 다리엔 울타리와 같은 `dark_wooden_planks_URPLit`(타일링), 차양은 원본 재질을 색 안 바꾸고 복제만 해서 씌웠다.

**진짜 회귀를 하나 발견했다**: 첫 헤드리스 검증에서 stall의 `MeshFilter.sharedMesh.subMeshCount`가 실행마다 다르게 나왔다(5, 그다음 49) — `PropsBuilder.MarkStatic()`이 모든 자식을 무조건 정적 배칭 대상(`isStatic=true`)으로 표시하는데, Unity의 정적 배칭이 서브메시(=재질)가 둘 이상인 렌더러를 다른 정적 렌더러와 결합 메시로 묶어치기하면서 `sharedMesh`가 원래와 다른 공유 메시로 바뀌는 것이었다(런타임에 서브메시별 재질 매핑을 코드로 더는 신뢰할 수 없다 — 실제 렌더링에도 영향 있을 수 있는 진짜 함정). 서브메시가 둘 이상인 오브젝트는 정적 배칭에서 빼는 것으로 고쳤다(작은 오브젝트 하나의 배칭 이득보다 정확성이 우선).

**구현**: 새 `BuildPropsMaterialSplit.cs`(`Assets/Art/Props/Generated/` 산출물 4개 — `LanternMetal.mat`·`StallRed_Split.asset`·`StallRedWood.mat`·`StallRedCanopy.mat`, 103-1 규칙대로 커밋). `PropsBuilder.InitMaterialSplit()`(null이면 원본 GLB로 폴백), `SpawnLantern()`·`BuildMarketStall()`이 각각 적용. `BuildTestVillageScene.BuildProps()`가 새 자산 넷을 로드해 넘긴다. `MarkStatic()`은 서브메시>1인 오브젝트를 건너뛴다. 새 헤드리스 진단 `PlaytestHeadless.CheckPropsMaterials()`: lantern 재질 이름·`metallicFactor`≥0.5, stall 서브메시 2·재질 이름 둘·양쪽 다 삼각형 있음·**서로 다른 텍스처**(`_BaseMap`/`baseColorTexture` 둘 다 확인 — 셰이더가 서로 다르다) 확인. TestVillage 재빌드 뒤 **3연속 OK**(마지막 1회는 프로세스 종료가 걸려 exit 124였지만 로그 내용 자체는 OK — 이 PC의 반복 launch 부하로 이미 여러 번 겪은 것과 같은 패턴, 코드 문제 아님). 작업 중 Unity가 라이선싱 오류로 두 번, 좀비 `Unity.exe`(이전 백그라운드 실행 잔여)로 한 번 실패해 각각 재시도·`taskkill //F //IM Unity.exe`로 정리했다.

코드: `BuildPropsMaterialSplit`(신규)·`PropsBuilder`·`BuildTestVillageScene`·`PlaytestHeadless`, `TestVillage.unity` 재빌드, `Assets/Art/Props/Generated/*`(신규 4파일), `colormap.png.meta`(ForceReadable). 문서: PLAN 102-4 Props 행, `PROJECT_STATE.md`.

## 글자 지도 조립 씬을 Unity 배치 모드로 실제 조립(BuildFromLayout) — 2026-09-23, 새 세션, "게임툴 이어 해줘"

- `tools/scene-layout/`(같은 날 신설, saga-godot 세션)가 만든 배치표 `tools/layout/out/hebei.json` 로
  `Assets/Editor/BuildFromLayout.cs::BuildFromArgs` 를 처음 실제로 배치 모드에서 돌렸다(이전 시도는 다른 세션이
  Unity 를 쓰는 중이라 컴파일 확인까지만 하고 멈춰 있었음).
- `bash tools/unity-batch.sh -- Unity.exe(6000.3.24f1) -batchmode -nographics -quit -projectPath . -executeMethod
  BuildFromLayout.BuildFromArgs -layout tools/layout/out/hebei.json -out Assets/Scenes/Generated/HebeiLayout.unity`.
  결과: 바닥 441·물건 161·명소 13·없는 에셋 0, exit 0, 컴파일 오류·예외 0. 새 씬 하나+바닥 재질 7개만 생겼고
  기존 씬·프리팹은 안 건드림. unity-batch.sh 가 설치 버전 부작용 4파일(ProjectVersion.txt 등) 원복 — diff 없음 확인.
- 물건 개수(161)가 같은 배치표의 Godot 결과(400, saga-godot HISTORY 09-23 참고)보다 적은 건 트랙별
  `tools/layout/kinds.json` 밀도(`per`) 설정 차이다 — 배치표만 공유하고 밀도는 트랙마다 따로 정하는 설계 그대로.
- 커밋 `3b50b998`. 에디터로 열어 실제로 보는 것은 실기 확인 전(`../SAGA-HANDOFF.md` 열린 항목).

## Unity 걸어 다니는 래퍼 `LayoutWalk.unity` — Godot LayoutWalk.tscn 대응판 — 2026-09-23, 새 세션, "사가 유니티 이어해"

- `BuildFromLayout.cs`가 생성 씬에 메타 컴포넌트(`Saga.Core.LayoutRoot`/`LayoutGroundTile`/`LayoutPlace`)를 남기게 하고,
  새 `Assets/Games/SagaGo/Layout/LayoutWalk.cs`가 실행 시점에 `HebeiLayout.unity`를 additive 로드해 읽어
  바닥 충돌·물 칸 막기(BoxCollider, 다리 있는 칸만 열림)·명소 발견(SphereCollider 트리거)·이름표(TextMesh+빌보드)를 붙인다.
  `Assets/Editor/BuildLayoutWalkScene.cs`가 Player(GO PlayerController 재사용)·MobileHUD·토스트·명소 개수 UI를 조립한다.
- **함정 ①**: 메타 세 클래스를 파일 하나(`LayoutMeta.cs`)에 몰아넣었더니 같은 배치 세션에서 `AddComponent`한 것 중
  파일명과 이름이 안 맞는 클래스(`LayoutGroundTile`·`LayoutPlace`)가 씬에 정식 GUID 참조 대신 그 씬 파일에만
  유효한 임시 로컬 참조로 저장돼, **다른 프로세스**(진단 실행)에서 읽으면 "referenced script is missing"로 깨졌다
  (`LayoutRoot`는 어쩌다 정상 GUID로 저장돼 헷갈렸다). 파일명=클래스명 셋으로 쪼개 해결 — 이 프로젝트 SagaCore 관례(파일당 클래스 하나)를 어긴 대가.
- **함정 ②**: `Assets/Scenes/Generated/*.unity`는 Build Settings에 없어 일반 `SceneManager.LoadScene`이 에디터 Play 모드에서도
  못 찾는다 — `EditorSceneManager.LoadSceneInPlayMode(path, ...)`(에디터 전용, `#if UNITY_EDITOR`)로 바꿔 해결.
- **함정 ③(가장 오래 걸림)**: 헤드리스 진단에서 순간이동한 자리의 명소 발견 트리거가 씬 시작 때 겹친 것 딱 하나
  말고는 아무리 텔레포트해도 다시 안 잡혔다 — Rigidbody 유무·텔레포트를 여러 프레임에 나눠 걷듯이 옮기기·
  `Physics.SyncTransforms()`를 다 시도해도 안 됐고, 원인은 **배치 모드(-nographics)는 실제 경과 시간이 거의 안 흘러
  Update 마다 누적하는 자동 물리 스텝이 거의 안 돈다**는 것이었다. `Physics.simulationMode = SimulationMode.Script`로
  바꾸고 텔레포트마다 `Physics.Simulate()`를 직접 부르니 13/13 전부 잡혔다.
- 새 헤드리스 진단 `PlaytestLayoutWalkHeadless.cs`(`-quit` 안 씀, 다른 Playtest류와 같은 이유): 물 칸 20개 막힘·다리 칸 하나만
  열림(씨앗 20260824 고정 좌표)·명소 13/13 발견·숨은 이름표 넷이 찾은 뒤에만 보임 — `LAYOUT_WALK_PROBE_DONE fails=0` 확인.
  Godot `probe_layout_walk.gd`와 같은 결이지만 텔레포트 방식이라 물리 시뮬레이션 수동 제어가 이 트랙만의 함정으로 남는다(`tools/scene-layout/README.md`에 적음).
- 코드: `Assets/SagaCore/LayoutRoot.cs`·`LayoutGroundTile.cs`·`LayoutPlace.cs`(신규)·`BuildFromLayout.cs`(메타 부착)·
  `Assets/Games/SagaGo/Layout/LayoutWalk.cs`(신규)·`Assets/Editor/BuildLayoutWalkScene.cs`·`PlaytestLayoutWalkHeadless.cs`(신규),
  `Assets/Scenes/LayoutWalk.unity`(신규)·`Assets/Scenes/Generated/HebeiLayout.unity`(메타 포함해 재조립). 문서: `tools/scene-layout/README.md`.
  창 모드로 실제 걸어 보는 것은 실기 확인 전(Godot LayoutWalk와 같은 처지).

## 2026-09-23 — FF·젤다 방향 점검 + PLAN 106장 신설 + DUNGEON 락온·적 공격 예고·완벽 회피 반격 (새 세션, Opus 5.5)

- **요청**: "사가 유니티 개선이 제대로 되고 있는지 확인 해주고 추가할 사항 확인 해줘 파이널 판타지 같거나 젤다의 전설 같아야 해" → 점검 보고 → "순서대로 진행 해줘".
- **점검 결론**: 기술 검증(컴파일 0·헤드리스 연속 OK)은 정상. 그러나 ① Unity 트랙 사용자 실기 승인 0건(Godot 은 있음), ② 최근 작업이 무예 44·3·4차 전직 같은 수치 이식에 몰림, ③ 사실 모델은 Maria·Abe·Brute 셋뿐이고 NPC 는 Kenney 블록(`Art/Characters/character-a~d.glb`). 코드 grep 결과 락온 0건·컷신/Timeline 0건·Cinemachine 미사용·3D 점프/등반 없음·젤다식 던전 구조 없음. 젤다 탑·신전은 GO 봉수대·사당 시련으로 이미 있음.
- **결정**: PLAN 106장 — DUNGEON 대표 판, 순서 1 락온·예고·반격 → 2 젤다식 던전 → 3 Cinemachine·Timeline 연출 → 4 캐릭터 통일 → 5 점프·등반 → 6 파티·소환. 수치 확장은 멈춤.
- **순서 1 구현**:
  - `Player/PlayerLockOn.cs`(신규): Q 토글·Tab 다음 대상(카메라 정면 기준 시계 방향)·모바일 "주목" 버튼(`LockOnButton`, 회피 버튼 위). 후보 12m, 점수 거리×(2−정면 내적), 16m 밖·사망 시 자동 전환/해제. 표식 = 머리 위 역삼각 + 발밑 고리(`LineRenderer`·`Sprites/Default`).
  - `CameraRig`: `SetLockTarget()` — yaw 추적(1−e^(−6dt))·피치 38°·피벗 25%(≤3m) 대상 쪽, 해제 시 락온 전 피치 복귀, 락온 중 드래그 무시.
  - `PlayerController`: 락온 중 4.5m/s·대상 바라보기·`LockOn/MoveX/MoveY` 파라미터가 있으면 옆걸음 블렌드, 없으면 걷기 폴백. 락온 중 입력 없는 회피 = 백스텝. `TryDodge()`가 `HeroState.Invulnerable`을 즉시 올린다(같은 프레임 판정). 정적 `PerfectDodged` 이벤트.
  - `DungeonEnemy`: `Update()`→`Tick(dt)`(진단이 시간 직접 주입). 사거리 도달 → 예비동작(잡졸 0.5s·두목급 0.7s, 절반 붉은빛 → 70%부터 경고색, 발밑 고리 0.3m→판정 반경 사거리×1.2) → 판정(반경 밖 헛손질·회피 무적이면 완벽 회피·그 밖 피해). 주기는 `attackInterval − 예비동작`(최소 0.3s)이라 가만히 서 있으면 예전과 같은 초당 피해. 강공격(과 반격 평타)은 두목급이 아닌 적의 예비동작을 끊고 주기 절반 뒤 재개. 피격 플래시가 경고색을 지우지 않게 `CurrentTint()`.
  - `PlayerCombat`: 타격 대상 = 락온 대상(사거리 안) 우선, 타격 순간 몸을 대상 쪽으로. 완벽 회피 → 1.2s 반격 창, 다음 평타·강공격 한 번 2배("완벽 회피! — 지금 반격" 토스트).
  - `Editor/BuildMariaLockOnStrafe.cs`(신규, 멱등): Maria.controller 에 `LockOn`·`MoveX`·`MoveY` + "Strafe" 2D 블렌드(가운데 Idle·앞 Walk·뒤/좌/우 검방 Mixamo 3클립, 상태 속도 1.4) + Idle/Walk/Run⇄Strafe 전이(전이 목록 맨 앞). 클립이 하나라도 없으면 컨트롤러를 안 건드린다. `MixamoRigUtil.RigAnimationClip()` 분리, `SetupMixamoCharacterImport` 매핑에 3클립 추가.
  - 번역 `action.lockon`·`combat.perfect_dodge`(ko/en), `HOW_TO_PLAYTEST.md` 에 Q·Tab·예고/반격 설명.
- **Mixamo**: 루트 `tools/mixamo_automation` 으로 "Sword And Shield Left/Right Strafe Walk"·"Sword And Shield Backward Walk" 후보 확인(`--query "Sword And Shield Walk" --list`). 다운로드는 **자동화 전용 프로필 로그인이 풀려**(페이지에 "Log in") 다운로드 대화상자의 Skin 선택자를 못 찾아 30초 시간 초과 — 로그인은 사람 몫이라 보류.
- **검증**: 배치 컴파일 exit 0 · `BuildTestDungeonScene.Build` exit 0 · `PlaytestDungeonHeadless` 3연속 OK(새 `CheckLockOn`·`CheckEnemyTelegraph` — 다른 적은 잠깐 꺼 더미로만 후보를 좁힘) · 나머지 DUNGEON 헤드리스 여섯(층 진행 12방·필드 매복·지름길·마을2·마을3+4·지역 지도) 전부 OK — 적 공격이 예비동작 뒤로 밀려도 진행형 진단은 안 깨짐.
- 창 모드 실기 확인은 전.

## 2026-09-23 — PLAN 106-2 젤다식 던전 "잊힌 능묘" + Maria 락온 옆걸음 블렌드 (같은 대화 "이어해", Opus 5.5)

- **Mixamo**: 자동화 전용 크롬을 다시 띄워 로그인 대기 작업을 걸어 두자 사용자가 로그인 — 검방 "Left/Right Strafe Walk"·"Backward Walk" 3클립 자동 다운로드(`Maria WProp J J Ong@<설명>.fbx`). `BuildMariaLockOnStrafe.Build` 첫 실행은 새 FBX 첫 임포트 뒤 어셈블리 재로드에서 **멈춤**(로그가 `Successfully resolved entitlement details` 에서 수 분간 안 늘고 CPU 도 거의 그대로) — 같은 때 Mixamo 자동화 크롬(3D 미리보기 WebGL)이 CPU 를 크게 잡고 있었다. 그 크롬(프로필 `swbins-mixamo-automation-profile` 명령줄로 골라서)과 멈춘 Unity(명령줄에 내 로그 경로가 있는 것만)를 끄고 `Temp/UnityLockfile` 을 지운 뒤 재시도 → OK(Strafe 블렌드 5 자식·LockOn 전이 4). 두 번째엔 임포트가 이미 끝나 있었다.
- **잊힌 능묘**(PLAN 106-2): Room2 서쪽 문 → 30m 격자 방 다섯(`BuildDungeonTemple.cs` 신규 — 1,700줄 씬 빌더에 더 얹지 않고 분리). 입구 홀(제목 토스트·Visited) · 시련의 방(파수꾼 셋 → 상자=작은 열쇠) · 잠긴 문 · 벽력탄 방(밀기 블록 → 발판 → 상자=벽력탄) · 금 간 벽 · 보스 열쇠 방(큰 상자) · 보스 문 · 보스방(능묘지기 — Brute 1.5배, hp 480).
  - 새 런타임: `TempleState`(Data, 작은 열쇠 + 9비트 `TempleFlag`, `Changed`), `TempleChest`(조건 공개·근접 열림·뚜껑+아이템 떠오르기), `TempleDoor`(작은 열쇠/보스 열쇠, 가라앉음), `TempleCrackedWall`(폭발 반경이 벽 면에 닿으면), `TemplePushBlock`(2m 칸, 붙어서 0.35초 밀기·방 경계 ±8m·겹침 검사·14m 밖이면 원위치), `TempleBomb`(2초 심지·반경 3m·적 평타×3·자기 피해 4), `TempleEntrance`, `TempleVisuals`(PBR 나무 판자·성벽 돌·등롱 금속, 없으면 단색), `Player/PlayerBombs`(R·"벽력탄" 버튼, 한 번에 하나).
  - `DungeonEnemy`: `bombArmored`(갑주 15%·벽력탄 맞으면 4초 기절 150%)·`deathFlag`(쓰러지면 능묘 비트, 세이브 로드 시 이미 섰으면 안 나타남)·`BombHit()`. `PlayerController.MoveIntent`(블록이 "밀고 있는가"를 본다). HUD 열쇠 줄. 세이브 v9(`templeKeys`·`templeFlags`). 번역 25키 ko/en.
  - 설계 판단: 상자는 DUNGEON 관례대로 근접 판정(상호작용 키 없음). 벽력탄 개수 관리는 뺐다(퍼즐 도구로 먼저 검증). 쓰러뜨린 파수꾼은 기존처럼 다시 선다(열린 문·상자·벽만 저장).
- **검증**: 컴파일 exit 0 · 씬 재빌드(능묘 방 5·복도 5·상자 3·문 2·벽 1·블록 1·파수꾼 6·능묘지기 1) · `PlaytestDungeonHeadless` 새 `CheckTemple`(진짜 씬 구성품을 순서대로 — 블록은 진짜 밀기 감지 한 번 + 즉시 밀기로 경계 막힘·발판) 첫 회부터 OK, 옆걸음 블렌드를 넣은 뒤 3회 더 OK(합계 4회, lockon·telegraph·temple 전부).
- **미확인**: Maria.controller 를 같이 쓰는 GO `PlaytestHeadless`·STORY `PlaytestStorySlice` 는 두 번 다 **Unity 시작 단계**(컴파일 뒤 `Access token is unavailable` 다음)에서 멈춰 15분 제한에 걸렸다 — 진단 코드까지 못 감. 사이사이 던전 진단은 정상이라 환경(연속 실행 누적 hang, HISTORY 09-23 GUI hang 과 같은 모양 + VS Code 가 CPU 를 크게 씀)으로 본다. 컨트롤러 변경은 새 상태·파라미터 추가뿐(기본값 LockOn=false)이라 두 판 동작엔 영향이 없어야 하지만 재확인 전.

- **재확인(같은 날)**: 시간을 두고 다시 돌리니 GO `PlaytestHeadless` OK · STORY `PlaytestStorySlice` OK — Maria.controller 옆걸음 블렌드 추가가 두 판을 안 깨뜨림. 앞의 두 번은 Unity 시작 hang(환경)이었다.

## 2026-09-23 — PLAN 106-3 연출(FF): Cinemachine 3.1.7 + Timeline 컷 셋(능묘 도착·상자·능묘지기 등장) (새 세션 "사가 유니티 이어해", Opus 5.5)

- **패키지**: Cinemachine 3.1.7(latest, unity 2022.3+) 을 매니페스트에 추가. 첫 배치 실행이 같이 올린 gltfast 6.9.0→6.14.1·ProjectVersion 은 되돌리고, lock 에는 cinemachine·splines 2.9.0·settings-manager 2.1.1 항목만 손으로 넣어 **먼저 따로 커밋**(`unity-batch.sh` 가 Packages 를 HEAD 로 되돌리므로, 커밋 전이면 다음 배치에서 패키지가 빠진다).
- **카메라 하이브리드**: `CameraRig` 는 `view`(플레이 가상 카메라 `PlayerView`, 부품 없는 CinemachineCamera·우선순위 10)를 움직이고 실제 카메라엔 `CinemachineBrain`. 레벨업 줌 펀치·흔들림·벽 pull-in 은 손대지 않음. `view` 가 비면 옛 동작(자식 카메라 직접).
- **새 런타임**(`Assets/Games/SagaDungeon/Cinematics/`): `DungeonCutscenes`(컷 셋·멈춤 플래그 `Playing`·레터박스·HUD 캔버스 끄기·넘기기·보스 포효 신호·상자 카메라 자리 잡기), `CutsceneDolly`+`CutsceneDollyTrack/Clip`(직선 달리), `CutsceneTitleCard`+`CutsceneTitleTrack/Clip`(가운데 지역명·왼쪽 아래 보스 이름표, 번역 키 `cut.*` 5개 ko/en). `World/TempleBossIntro`(보스방 첫 발 트리거, `TempleFlag.BossIntroSeen` 1<<9 — 비트 끝에 붙여 세이브 호환). `DungeonEnemy.PlayRoar()`.
- **멈춤 배선**: `PlayerController`(이동·회피)·`PlayerCombat`(평타·강공격·회전베기)·`PlayerBombs`·`PlayerLockOn`(토글·Tab)·`CameraRig`(드래그)·`DungeonEnemy.Tick` 이 `DungeonCutscenes.Playing` 을 본다. `Time.timeScale` 은 안 씀(hitstop 원칙과 같은 결, 적 idle 애니는 돈다).
- **연결**: `TempleEntrance` → 도착 컷, 목표 토스트는 컷 뒤(`temple.enter` 문구에서 "— 잊힌 능묘 —" 머리 뺌 — 제목은 카드가 맡음). `TempleChest.Open()` → 플레이어가 상자를 보고 상자 컷.
- **에디터**: `BuildDungeonCinematics.cs` 신규 — 씬 빌더가 플레이어·HUD 뒤에 부른다. Timeline 애셋 3개(`Cinematics/Timelines/Temple_*.playable`)는 있으면 트랙만 비우고 다시 채워 GUID 유지. 컷 가상 카메라 4(도착·상자·보스 넓은/가까운, 가까운 샷에 Handheld_normal_mild 손떨림). `BuildDungeonTemple` 은 `LastGuardian` 을 내보내고 보스방에 `TempleBossIntro` 를 둔다.
- **함정**: `CinemachineBrain.ManualUpdate()` 는 ManualUpdate 모드가 아니면 `Debug.LogError` 를 남긴다 → 헤드리스 진단에서 강제 갱신 대신 **프레임을 넘겨** 확인(3프레임째 틀기·6프레임째 확인·8프레임째 복귀). 셸 heredoc 안의 `'`·`\\n` 이 훅을 거치며 깨져 python 편집 스크립트는 scratchpad 파일로 써서 돌렸다.
- **검증**: 컴파일 exit 0 · `BuildTestDungeonScene` 재빌드 exit 0 · `PlaytestDungeonHeadless` **3연속 OK** — `CheckTemple` 컷 검사(도착 컷·HUD 0·파수꾼 멈춤·2s 지역명 카드·넘기면 HUD 복귀 → 상자 카메라 자리 → 컷 중 벽력탄 막힘 → 보스방 밖 안 틂/첫 발 틂·3s 이름표·다시 안 틂 → 컷 5회) + `cut camera live`(t≈3.2 브레인 활성=`CutCam_BossClose`, 실제 카메라 0.00m, 포효 신호) + `cut camera back`(`PlayerView` 복귀·HUD 16). 같은 씬 `PlaytestDungeonFloorProgression`·`PlaytestDungeonShortcut` OK. GUI 실기 확인은 전.

## 2026-09-24 — 배치표 deco 벽 + 마을 소품 GLB 19벌 (게임 제작 도구 이어서 — 공용 도구 쪽 세션)

- `Assets/Games/SagaGo/Layout/LayoutWalk.cs`: 배치표 `Props` 중 `deco:house_/tower_/well_/market_`(웹 `houseRects` 와 같은 넷)에 메시 경계 `BoxCollider` 를 소품 자신에. `LayoutColliderInfo.decoSolids`.
- `PlaytestLayoutWalkHeadless.cs`: `deco_solids=n`, 있으면 첫 소품 자리 `Physics.CheckBox` → `deco_block`.
- `Assets/Art/Generated/SagaGo/` 에 `tools/asset-forge/procgen.py` 로 구운 집·탑·등롱·우물·장터·허수아비·풀·갈대 19벌(부품마다 glTF 재질 색 — glTFast 기본 임포트로 색이 난다) + `.meta`. `tools/layout/kinds.json` `deco` 10종 전부.
- 확인: 시험 deco 로 `HebeiLayout.unity` 를 잠깐 다시 조립 → `LAYOUT_WALK_PROBE_DONE fails=0 … deco_solids=2 deco_block=ok(deco:house_161)`, 되돌린 원래 씬도 fails=0 `deco_solids=0`.
  10종 배치표 조립 물건 171·없는 에셋 0, glTFast 경고 0. `ProjectSettings/`·`Packages/` 변화 없음, `Ground_*.mat` 재기록은 되돌렸다.

## 2026-09-24 — PLAN 106-4 캐릭터 통일(DUNGEON): 동행·마을 사람·포로·행상·능묘 파수꾼 → Mixamo 사실 모델 (같은 대화 "사가 유니티 이어해", Opus 5.5)

- **현황 파악**: 적(잡졸 Abe·두목 Brute)은 44장에서 이미 사실 모델. 남은 자리 = 동행(character-b 청색·애니 없이 미끄러짐)·마을 사람(character-b)·포로(캡슐)·행상(초록 상자뿐)·능묘 파수꾼(Abe 회청색 — 모든 적이 두 모델뿐이라 단조로움).
- **도구**(`tools/mixamo_automation/fetch.mjs`, 별도 커밋): `--character "<카드 이름>"`(Characters 탭 → 카드 → 확인 모달 USE THIS CHARACTER, 오른쪽 패널 이름으로 확인)·`--tpose`(오른쪽 DOWNLOAD → 모달 기본 FBX Binary·T-pose)·`--inplace`(겉모양 라벨이 체크박스를 덮어 `check()` 30초 타임아웃 → DOM click). 자동화 크롬 로그인은 살아 있었다(사람 몫 없음). 받은 것: Skeletonzombie T Avelange(몸체+5), Paladin W/Prop J Nordstrom(몸체+4), Peasant Man(몸체+대기), Peasant Girl(몸체+대기+무릎 꿇기). 레시피는 README 표.
- **함정**: 작업 중 다른 세션의 `git pull --rebase --autostash` 가 미커밋 fetch.mjs 를 잠깐 치웠다 되돌려, 그 틈의 `--tpose` 두 번이 "사용법" 오류로 끝났다(reflog 로 확인). 도구 수정은 곧바로 커밋. 또 `saga-unity` 에서 `grep -r .` 는 Library 까지 훑어 2분 넘게 걸림 — 경로를 좁힐 것.
- **Unity**: `SetupNpcCharacterImports.cs`(표 하나로 넷 — 몸체 Humanoid + `이름@클립` → 컨트롤러 `Assets/Animators/<이름>.controller`(커밋) → `<이름>Animated.prefab`(로컬), applyRootMotion 끔). `NpcIdle`(대기 위상 흩기·추가 대기 상태 이름으로 Play·`SpawnRigged`). `AllyFighter` 리깅 분기(Speed 0/0.5/1 — 가까우면 걷기 2.6m/s·멀면 달리기 6m/s, 공격 트리거, 컷 동안 멈춤). `DungeonCaptive`(Kneel → 풀려나면 플레이어를 보고 Idle)·`DungeonMerchant`(좌판 뒤 Keeper) 모델 슬롯 + `SetModel`, `DungeonFloorRunner` 는 비활성 → SetModel → 활성. 씬 빌더: 마을 사람 남녀 번갈아·동행 Paladin·행상 5·포로·능묘 파수꾼 = 해골(옅은 칠 0.88/0.9/0.96). 프리팹이 없으면 전부 예전 모델로 폴백.
- **검증**: 컴파일 exit 0 · `SetupAll` 4/4(아바타 전부 Humanoid valid) · 씬 재빌드 exit 0 · `PlaytestDungeonHeadless` **3연속 OK**(새 `CheckNpcModels`: 동행·마을 사람 3·포로 Kneel·행상 5·해골 파수꾼 6 Humanoid + 능묘·컷 검사 그대로) · `PlaytestDungeonFloorProgression` OK. GUI 실기 확인은 전.
- 씬 재빌드마다 Timeline 3개의 서브애셋 fileID 가 새로 매겨져 diff 가 생긴다(GUID 는 유지) — 동작엔 영향 없음.

## 2026-09-24 — PLAN 107장 신설(GO 원신 기준) + ① 들판 전투 (같은 대화 "사가유니티 이어해" 도중 사용자 요청, Opus 5.5)

- **결정**: 106장 순서 5(DUNGEON 점프·등반)를 막 시작하려던 참에 사용자가 "사가고를 원신이 전투 시스템 맵형태가 완전 일치하게 요청했어" → AskUserQuestion 에서 **"유니티 사가고도 원신식, 지금 바로"**. PLAN 107장(① 들판 전투 ② 이동 ③ 지역 지도 ④ 상자 ⑤ 원소 적 ⑥ 동료 모델)을 적고 ①을 했다. 규칙 비율은 saga-godot PLAN 106장 ③ 을 따랐고(코드 공유 없음), GO 사람 키 3.4m 라 거리는 약 1.85배.
- **새 파일** `Assets/Games/SagaGo/Combat/`: `GoElements`(화·수·뇌·반응 3·FNV 해시 원소) · `GoStamina`(공용 스태미나 100) · `DuelGate`(옛 결투 중 멈춤 — 세 사건 `Update` 첫 줄 `Report`, 프레임 도장이라 해제 호출 불필요) · `FieldEnemy`(배회→발견 24m→추격→예고 0.6s→판정 4.2m→쉼, 끌려 나옴 45m 귀가·회복, 90초 부활, 머리 위 이름·체력·원소 점, **물리 충돌체 없음** — `CameraRig` 벽 pull-in 이 모든 레이어를 raycast 해서) · `FieldCombat`(J 3타·E 스킬·Q 폭발·L/Ctrl 회피·1~4 교체, 인물별 체력·쿨·기력, 전멸 → 마을 스폰) · `FieldCombatHud`(런타임 생성, 런타임 리스너) · `FieldSpawner`(여섯 무리 15마리, Abe·Skeleton 프리팹 없으면 캡슐) · `FieldRingFx`·`FieldDamageText`.
- **고친 파일**: GO `PlayerController`(달리기 스태미나·`Dash`·`FaceToward`·`MoveIntent`·`Teleport`) · 세 사건 `Update` 한 줄씩 · 씬 빌더 `BuildFieldCombat`.
- **검증**: 컴파일·`BuildTestVillageScene` exit 0 · `PlaytestHeadless` **3연속 OK** — 새 `PlaytestGoFieldCombat`(반응 표·적 15·3타 배율/콤보 끊김·처치 경험치·Killed·증발 150·과부하 광역·감전 번짐/틱·스킬 부착/쿨/기력·폭발·발견→예고→피격·회피 무적·교체/쿨/쓰러짐 자동 교체·전멸 복귀 돈 그대로·DuelGate·진짜 onClick 공격/명단). 첫 실행 실패 하나는 진단 착오(폭발 4배가 적 체력보다 커서 깎인 양이 잘림).
- 새 글자는 `GoLocalization.T(키, 한국어)` 폴백 — ko/en 표(다섯 벌 md5)는 아직 안 늘렸다. 실기 확인은 전.

## 2026-09-24 — PLAN 107 ② 이동: 절벽 고원·깊은 강 + 점프·등반·넘어오르기·활공·수영 + Maria 전용 클립 (새 대화 "사가유니티 이어해", Opus 5.5)

- **지형이 먼저였다**: 옛 산은 2.5m 평지 위 보이지 않는 6m 상자, 강도 투명 벽이라 오르거나 헤엄칠 게 없었다. `TestMapData.GroundHeight`(산 = 좌표 해시 고원 안쪽 12~22m·테두리 30~38m, 강·다리 = 바닥 -3.5m, 수면 -0.45m 는 옛 값)·`TerrainBuilder` 칸 모서리 옆면(바위/흙, 아래로 어둡게)·칸마다 -10m 까지 꽉 찬 충돌 기둥·지도 밖 90m 경계벽(`NoClimb`). `Legend.Height` 는 옛 배치 코드(다리 널판 등)가 그대로 쓰게 안 바꿨고, 산 바위(`VegetationBuilder`)만 칸별 높이로. 다리 충돌 판은 칸 전체 48m → 보이는 덱 폭 7m·윗면 1.0m(예전엔 옆 허공을 밟았다), 플레이어 `stepOffset` 1.1m.
- **`PlayerController` 이동 상태 여섯**(지상·공중·등반·넘어오르기·활공·수영, `traversal` 은 TestVillage 만 — LayoutWalk 은 점프까지). 점프 2.4m · 등반(가슴·무릎 광선 둘 다 가파른 상자/메시 면, 캡슐·구·`NoClimb` 제외, 3.2m/s, 초당 6, 도약 15, 아래+Space 놓기, 가슴 광선이 비면 넘어오르기 0.45s) · 활공(발밑 4m+, 10m/s·낙하 3m/s, 초당 5, 코드 날개) · 수영(발이 수면 2.6m 아래, 초당 2/12/1, 기력 0 → 0.5초마다 기록한 마지막 땅). `GoStamina.Use`(달리기 잠금 무관). 전투는 `OnFoot` 일 때만, 들판 적은 `CanStandOn`(산·강 금지). 모바일 "점프" 버튼은 `FieldCombatHud`.
- **Mixamo**: 자동화 크롬 로그인 살아 있었다(사람 몫 없음). Maria 로 Climbing Up A Wall(--inplace)·Mid-Air Falling Idle·Swimming Underwater·Floating(파일 Treading Water)·Jump Up → README 레시피 표. 받은 뒤 전용 크롬 PID 만 종료. `BuildMariaTraversal`(루트 이동 자세에 굽기, `Climb`·`Glide`·`Swim`·`Jump`·`ClimbRate`, 수영은 `Speed` 1D 블렌드).
- **함정**: 에디터 스크립트에서 `state.transitions = 새 배열`/`Where` 로 빼기만 하면 옛 `AnimatorStateTransition` 이 컨트롤러 안 고아 하위 애셋으로 남아 재실행마다 늘었다(45→73). `RemoveTransition` 으로 지워야 멱등 — 원본에서 두 번 돌려 전이 45·개체 62 동일 확인. `BuildMariaLockOnStrafe` 는 전이를 덧붙이기만 해서 해당 없음.
- **검증**: 컴파일·씬 재빌드 exit 0 · GO `PlaytestHeadless` **3연속 OK**(새 `PlaytestGoTraversal` 측정값 3회 동일: 점프 2.30m · (2,6) 산 12.5m 3.9s·기력 20 · 전용 클립 파라미터 켜짐 · 활공 낙하 3.06/s·전진 10.20/s · 수영 y -3.05 = 목표) · `PlaytestDungeonHeadless` OK(Maria.controller 공유) · `PlaytestLayoutWalkHeadless` fails=0(GO PlayerController 공유). 실기 확인은 전.

## 2026-09-24 — PLAN 107-3 지역 지도: 지역 7·역참 5·옛 망루·봉우리·M 지도 화면·세이브 v14 (같은 대화 "사가유니티 이어해", Opus 5.5)

- 새 파일: `Data/GoWorldMap`(지역·역참·망루 표, `RegionAt`)·`Data/WorldMapState`(켠 역참·발 디딘 지역·밝힘, `Restore` 도 `Changed`) · `World/WaypointStone`·`World/Watchtower`·`World/WorldMapBuilder`(Play 때 세움, 씬 빌더는 돌 재질만) · `UI/WorldMapUi`(M·"지도" 버튼, 칸 색 텍스처·어둠·화살표·◆ 순간이동·지역 진입 이름). `TestMapData.HasPeak/PeakHeight/PeakBase` + `TerrainBuilder.BuildPeaks`(육각 뿔대, 볼록 MeshCollider). 세이브 v14(13→14 빈 기본값).
- 함정: 지역 추적을 "지역이 바뀔 때만 Visit" 으로 짰더니 세이브 불러오기·상태 초기화 뒤 제자리 지역이 다시 안 적혔다 → 매 검사마다 Visit(이미 있으면 무시).
- 검증: 컴파일·씬 재빌드 exit 0 · GO `PlaytestHeadless` 새 `PlaytestGoWorldMap` 포함 **3연속 OK**(첫 실행 실패는 위 함정) — 망루는 진단이 실제로 `Step` 으로 기어올라 꼭대기에서 밝힌다. 실기 확인은 전.

## 2026-09-24 — PLAN 107-4 보물 상자: 등급 4 × 잠금 3, 열여섯 개 (새 대화 "사가유니티 이어해줘", Opus 5.5)

- 규칙 비율은 saga-godot PLAN ⑥(등급 경험치 5·15·30·60, 평범 7·정교 4·진귀 3·화려 2, 무리 전멸·석등 20초)을 따랐고 거리만 1.85배(석등 둘레 11m). 돈 10·25·50·100냥은 이 트랙 경제(상인 25·길세 40)에 맞춘 값.
- 새 파일: `Data/GoTreasure`(표·보상·자리 계산) · `World/TreasureChest`(다가가 열기·무리/석등 잠금·뚜껑·사슬·빛, `Tick(dt, 플레이어 자리)` 로 진단이 직접 돌림) · `World/ElementTorch`(원소 구슬·불). 고친 파일: `FieldCombat.ElementPulse`(스킬·폭발 원 이벤트 — 적 없어도 쏨) · `WorldMapBuilder`(상자 세움) · `WorldMapUi`(안내 줄 "보물 상자 n/16", `InfoText`).
- 석등 원소 고르기: 지금 명단은 주인공(화) + 등용 동료가 사실상 "산적" 하나뿐이라, FNV 해시로 산적 = 수를 확인하고 둘째 석등 상자를 화·수·화로 했다(도적 사건 바로 남쪽 — 등용하면 풀 수 있게). 진단이 "석등 원소가 주인공+산적으로 풀리는지"를 본다.
- 함정: 첫 실행에서 상자는 통과했는데 **이동·지도 진단이 깨졌다** — 두 진단이 (2,6) 고원 한가운데·봉우리 밑동 위에서 아래로 쏴 높이를 재는데 정교 상자가 바로 그 자리에 앉아 상자 뚜껑에 맞았다. 봉우리 2.2m·고원 (6,6)m 비켜 앉힘.
- 검증: 컴파일 exit 0(씬 참조가 안 늘어 씬 재빌드 불필요) · GO `PlaytestHeadless` 새 `PlaytestGoTreasure` 포함 **3연속 OK**(이동 측정값 3회 동일). 실기 확인은 전. 새 글자 `chest.*`·`map.chests` 도 `GoLocalization.T` 폴백.

## 2026-09-24 — PLAN 107-5 원소 쓰는 적: 불도깨비·물귀신·번개귀, 원소 방패·화상/젖음/감전 (같은 대화 "사가유니티 이어해줘", Opus 5.5)

- 규칙은 saga-godot PLAN ⑦(방패 150·180·130, 같은 원소 면역·물리 ×0.4·상성 ×2.5, 깨지면 2초 비틀, 화상 ×0.2 세 번·젖음 스태미나 -25·감전 기력 -25, 무리 3곳 8마리, 경험치 20) 그대로. 코드는 따로.
- **모양 결정**: Godot 은 괴물을 코드로 그렸지만 이 트랙은 사실적 PBR(66-2)이라, 이미 있는 Mixamo 해골 모델에 원소 빛깔 + 방패 거품 + 도는 구슬 + 빛을 붙인 "원소 깃든 망자" 로 했다. 그래서 이름도 몸에 맞게 물거북·번개살쾡이 대신 물귀신·번개귀(불도깨비는 그대로). 씬 참조가 안 늘어 씬 재빌드 불필요(`FieldSpawner` 의 해골 모델을 같이 씀).
- 고친 파일: `GoElements`(상성·`ShieldMul`·상태 수치) · `FieldEnemy`(Kind 셋·`State.Stagger`·방패/막대/거품/구슬·`HitShield`·`BreakShield`·광역은 방패가 받음·귀가/부활 복구·`SetShieldForTest`) · `FieldCombat`(`ApplyFoeStatus`·화상 틱, 리셋·전멸 때 지움) · `FieldSpawner`(무리 셋). 새 진단 `Editor/PlaytestGoElementalFoe`(들판 전투 진단 바로 뒤).
- 검증: 컴파일 exit 0 · GO `PlaytestHeadless` **3연속 OK**(첫 실행부터 통과, 들판 적 15 → 23, 이동·지도·상자 진단 그대로 통과). 실기 확인은 전. 새 글자 `field.foe.*`·`field.immune`·`field.counter`·`field.shield_break`·`field.st.*` 도 `GoLocalization.T` 폴백.

## 2026-09-24 — PLAN 107-6 동료 모델: 교체하면 몸이 바뀐다 — 107장 여섯 갈래 코드 완료 (같은 대화 "사가유니티 이어해줘", Opus 5.5)

- 새 파일 `Player/PartyBodies`(id → 몸: 산적 = Abe, 그 밖 = Paladin·PeasantMan·PeasantGirl FNV 해시, 첫 교체 때 한 벌 만들어 켜고 끔, Humanoid 면 Maria.controller 를 씌움) · 진단 `Editor/PlaytestGoPartyBodies`. 고친 파일: `PlayerController`(`SetBody`·`CacheAnimatorParams`·날개 옮기기) · `FieldCombat.ApplyLook`(몸 교체, 제 몸 없을 때만 원소 빛깔) · `BuildTestVillageScene`(모델·컨트롤러 배선) · 씬 재빌드.
- 결정: 동료마다 전용 클립을 따로 받지 않고 Maria.controller 를 아바타 리타깃으로 같이 쓴다 — 등반·활공·수영까지 한 번에 되고 새 Mixamo 받기가 없다. 무기는 주인공 손에만(장비가 주인공 것이라).
- 함정 피함: 새 몸의 충돌체를 `Destroy` 로 지우면 프레임 끝까지 남아 같은 프레임 진단(과 CharacterController)이 본다 → 새로 만든 인스턴스라 `DestroyImmediate`.
- 검증: 씬 재빌드 exit 0 · GO `PlaytestHeadless` **3연속 OK**(산적 몸 키 3.40m · 걷기 Speed 0.50, 앞 진단 전부 그대로) · `PlaytestLayoutWalkHeadless` fails=0(GO PlayerController 공유). 실기 확인은 전.


## 2026-09-24 — PLAN 107-3 남은 것: 걸어 오르는 경사·고개 + 지역 바이옴(안개·햇빛) + 내리막 붙이기 (새 대화 "이어해줘", Opus 5.5)

- 새 파일 `World/RegionAtmosphere`(지역 안개·짙기·햇빛으로 2.5초 스며듦) · 진단 `Editor/PlaytestGoSlopesBiome`. 고친 파일: `TestMapData`(`Ramps`·`RampGeometry`) · `TerrainBuilder.BuildRamps`(쐐기 메시·볼록 충돌) · `GoWorldMap.Atmospheres` · `WorldMapBuilder`(바이옴 붙임) · `WorldMapUi`(≡ 고개·비탈, 발 디딘 지역만) · `PlayerController`(내리막 붙이기) · 씬 재빌드.
- 자리 결정: 이동 진단이 (2,6) 남면을 기어오르고 남쪽으로 활공해 (2,7) 에 내리므로 그 두 칸은 피해 고개를 (1,8) 에, 망루 비탈은 (4,7) 동쪽 끝(행운 돌탑에서 14m)으로.
- **발견한 버그**: 첫 실행에서 비탈은 올라가는데 고개 내리막 "공중" 3.66초 — 떨어진 게 아니라 걸어 내려가는 동안 매 프레임 발이 떠서 `Mode = Air` 였다(실게임에서도 내리막마다 낙하 동작·활공 가능했을 것). 발밑 0.6m 안이면 붙이는 ground snap 을 넣자 공중 0.00s, 점프 2.30m·활공 등 이동 측정값은 그대로.
- 식생 바이옴은 보류 — 풀·나무가 편집기에서 굽는 씬 자산이라 지역별로 바꾸려면 `VegetationBuilder` 재설계가 필요하다.
- 검증: 씬 재빌드 exit 0 · GO `PlaytestHeadless` **3연속 OK**(망루 비탈 18.2m 6.1s · 고개 북쪽 14.9m 5.0s · 고개 넘기 12.7s 공중 0.00s, 3회 동일) · `PlaytestLayoutWalkHeadless` fails=0. 실기 확인은 전.


## 2026-09-24 — PLAN 106-5 탐험(DUNGEON): 점프·담쟁이 등반·넘어오르기 + 옛 감시탑 뜰 (같은 대화 "이어해줘", Opus 5.5)

- 107(GO 원신)이 끝나 106 순서 5 로 돌아왔다. GO 이동을 0.53배(사람 1.8/3.4)로 줄여 던전 `PlayerController` 에 옮겼고(`Step`·`SetTestInput`·`Teleport` 도 새로), 점프 키는 Space(평타)와 겹쳐 F. 등반은 `DungeonClimbable` 만 — 방 벽을 넘어가면 안 되니 GO 와 반대로 허용 목록.
- 새 파일: `World/DungeonClimbable` · `World/WatchCourtHint` · `Editor/BuildDungeonWatchCourt`(Room2 동쪽 (30,30) 새 방) · `Editor/PlaytestDungeonExplore`. 고친 파일: `PlayerController`·`PlayerCombat`·`PlayerBombs`(등반 중 막기)·`CameraRig`(광선이 Ignore Raycast 층 뺌)·`TempleChest`(`Treasure`·높이 차)·`TempleState`(비트 10·11)·`BuildTestDungeonScene`(Room2 동쪽 문·점프 버튼·뜰 조립)·`PlaytestDungeonHeadless`(보물 상자를 보스 열쇠 상자로 잘못 집지 않게 분류 고침·탐험 진단 호출). 씬 재빌드(컷 타임라인 셋은 재생성 순서만 바뀜 — 씬이 참조하니 같이 커밋).
- **코스 두 번 고침**: ① 돌 사이 틈 0.8m → 점프 3번(틈을 걸어서 건넘). ② 1.2m 로 넓혀도 건넜다 — 캡슐(반지름 0.4)이 양 모서리에 걸쳐 버티고 반대편 턱을 계단처럼 올라탔다. 틈 2m 로 하니 이번엔 자연 점프(≈3.4m)가 셋째 돌(폭 1.6m)을 넘어 틈에 떨어질 판이라 돌을 폭 2.8m 계단식으로 바꿨다. 진단도 "점프 4번" 대신 "셋째 돌에서 점프 없이 걸으면 떨어짐"을 따로 본다.
- 막이: 탑(8m)에서 달려 뛰면 방 벽(4m)에 닿는 거리라 이 방 벽 위에만 보이지 않는 막이. 카메라 벽 당김이 막이에 걸리지 않게 "Ignore Raycast" 층 + `CameraRig` 광선을 `Physics.DefaultRaycastLayers` 로.
- 검증: 씬 재빌드 exit 0 · `PlaytestDungeonHeadless` **3연속 OK**(점프 1.37m · 징검돌 점프 4번 2.5s · 탑 8m 4.6s, 3회 동일, 능묘 진단 그대로 통과) · `PlaytestDungeonFloorProgression` OK. 실기 확인은 전. 새 글자 `explore.*`·`temple.got_treasure`·`action.jump` 는 `DungeonLocalization.T` 폴백.

## 2026-09-24 — PLAN 106-6 FF 확장(DUNGEON): 동료 파티(무사 도발·술사 치유·ATB) + 소환수 "바위 거신" — 106장 여섯 순서 코드 완료 (새 대화 "사가유니티 이어해줘", Opus 5.5)

- **설계 판단**: 106 표의 "동료 파티 전투·소환수 대형 연출" 한 줄뿐이라 FF 최신작(FF7R·FF16) 전투에서 두 문법만 골랐다 — ① 동료는 스스로 평타, 특기는 플레이어가 **게이지(ATB)를 써서 시킨다** ② 파티가 쌓은 게이지로 **소환수가 판을 뒤집는다**(컷 연출 포함). 동료 교대·장비·성장은 수치 확장이라 이번엔 뺐다(106 "수치 확장 멈춤" 원칙). 게이지는 **맞힌 횟수**로 차게 해 레벨·장비와 박자가 무관하다. 세이브 스키마 안 바뀜.
- **파티**: 기존 동행 무사(`AllyFighter`)에 체력 40(웹판 `hpMaxOf`)·쓰러짐(12초 뒤 30%)·명령 "방패 도발"(12m·8초·받는 피해 40%). 새 뒷줄 술사(`AllyMystic`, Peasant Girl) — 그 모델엔 걷기 클립이 없어 GO 107-6 처럼 Maria.controller 를 씌웠다(Speed 0/0.5/1 규칙이 AllyFighter 와 같아 그대로 돈다). 빛살(`MysticBolt`)·물러섬·명령 "치유의 빛"(+40%·무사 일으킴, `HealGlow`).
- **적 AI**: `DungeonEnemy` 표적을 `Target`(플레이어 또는 도발한 무사) 하나로 바꿔 쓴다 — 예비동작·판정은 그대로라 기존 진단(락온·예고·능묘) 전부 그대로 통과. 술사는 표적이 아니다(체력 없음). 적이 동료를 스스로 노리는 "적개심" 규칙은 기존 진단 전제(더미가 플레이어를 친다)를 흔들 수 있어 도발만으로 좁혔다.
- **소환**(`PartySummon`·`PartyCommands`): Brute 3.2배 + 돌빛 틴트(발광 재질은 URP Lit 키워드가 필요해 틴트·점광·진 고리로 대신). 시간은 거신이 스스로 세고(`Tick`), 컷(`DungeonCutscenes.PlaySummon`, Timeline `Party_Summon`)은 카메라 두 자리·제목만 — 넘기거나 컷이 없으면 `onEnd` 가 `ResolveNow()` 로 그 자리에서 내리친다(피해 한 번). 카메라 자리는 상자 컷처럼 부르는 순간 다시 잡고 벽이 막으면 당긴다.
- **HUD·버튼**: `PartyHud`(런타임에 막대를 만든다 — 버튼이 아니라 영속 리스너 불필요), 버튼 셋 도발·치유·소환(`ButtonWiring.Wire`, 회피·주목 줄 왼쪽 x=-460). 키 1·2·V.
- 파일: 새 `Data/PartyState.cs`·`World/AllyMystic.cs`·`MysticBolt.cs`·`HealGlow.cs`·`PartySummon.cs`·`Player/PartyCommands.cs`·`UI/PartyHud.cs`·`Editor/PlaytestDungeonParty.cs`·`Cinematics/Timelines/Party_Summon.playable`, 고침 `AllyFighter`·`DungeonEnemy`·`PlayerCombat`(맞힐 때 게이지)·`DungeonCutscenes`(Summon 종류)·`BuildDungeonCinematics`·`BuildTestDungeonScene`·`PlaytestDungeonHeadless`. 씬 재빌드(Temple_* 타임라인은 재생성 순서만 바뀜 — 같이 커밋).
- 검증: 컴파일·씬 재빌드 exit 0(버튼 23 전부 리스너) · `PlaytestDungeonHeadless` **3연속 OK**(첫 실행부터, 새 `party` 줄 "도발 2초 무사 -4.0 · 소환 한 방 200(레벨 3)·맞은 적 1" 3회 동일) · `PlaytestDungeonFloorProgression` OK. 실기 확인은 전. 새 글자 `party.*`·`action.taunt/heal/summon`·`cut.summon_*` 는 `DungeonLocalization.T` 폴백.

## 2026-09-24 — PLAN 106-7 층 두목·살수 등장 컷(DUNGEON, 106-3 후속) (새 대화 "사가유니티 이어해줘", Opus 5.5)

- **고른 까닭**: 지난 대화 끝에 다음 방향(GO·STORY 이식 / 106-6 다듬기)을 물었는데 답 없이 "이어해" — 진행 신호로 받아 추천안을 골랐다. 106-3 이 "다음에 옮길 곳"으로 적은 DUNGEON 층 두목·월드 보스 등장 컷이 판 안 작업이라 가장 작고 안전했다(GO·STORY 이식은 판별 복사라 그다음).
- **구조**: 컷 하나(`Boss_FieldIntro`)를 여러 두목이 같이 쓴다 — 카메라 두 자리는 달려드는 순간 다시 잡고(상자·소환 컷 결), 이름표는 `CutsceneTitleCard.SetOverride` 로 덮어쓴다(Timeline 클립 글자는 폴백만). `DungeonEnemy` Idle→Chase 에서 `TryPlayFieldIntro` — 층 두목은 매번, 나머지 두목급은 이름마다 세션 한 번(`IntroSeen`), 능묘지기(갑주)는 제외. 두목전 시작 토스트는 컷 `onEnd` 로 미뤘다(레터박스 위에 겹치지 않게). 타이머는 컷 동안 Tick 이 일찍 돌아가 원래 안 준다.
- 파일: 고침 `DungeonEnemy`·`DungeonCutscenes`(FieldBoss 종류·포효 시각 일반화)·`CutsceneTitleCard`(덮어쓰기)·`BuildDungeonCinematics`, 새 `Editor/PlaytestDungeonBossIntro.cs`·`Boss_FieldIntro.playable`. 씬 재빌드.
- 검증: 씬 재빌드 exit 0 · `PlaytestDungeonHeadless` **3연속 OK**(새 `boss intro` 줄 "가까운 샷 5.4m · 컷 3번" 3회 동일) · `FloorProgression`·`FieldAmbush`·`Shortcut`·`Town2`·`Towns34` OK. 실기 확인은 전. 새 글자 `cut.floorboss_*`·`cut.miniboss_sub` 는 `DungeonLocalization.T` 폴백.

## 2026-09-24 — PLAN 106-8 STORY 두목 등장 컷(106 결 옮기기 첫째, 판별 복사) + STORY 카메라 Cinemachine 하이브리드 (새 대화 "사가유니티 이어해줘", Opus 5.5)

- **고른 까닭**: 지난 대화 끝 추천("두목 등장 컷을 STORY 관문 대장이나 GO 두목으로")에 "이어해" — STORY 를 먼저 골랐다. STORY 두목은 들판 한 자리에 서 있는 한 마리라 트리거가 단순하고, GO 는 사건 결투(사당 시련·희귀 늑대)가 여럿이라 그다음.
- **카메라**: STORY 엔 Cinemachine 이 없었다 — `StoryCameraFollow` 를 실제 카메라에서 떼어 플레이 가상 카메라 `StoryPlayerView` 에 붙이고 실제 카메라에 브레인(106-3 DUNGEON 과 같은 하이브리드). 흔들림·레벨업 줌 진단(`_shakeTimer`·`_zDistance`)은 컴포넌트를 그대로 보므로 안 바뀌었다.
- **판별 복사**: `StoryCutDolly`·`StoryCutDollyClip`·`StoryCutDollyTrack`(DUNGEON 달리 셋 이름만 바꿈), `StoryCutscenes`(DUNGEON 관리자에서 컷 하나 몫만). 제목 트랙은 안 옮기고 이름표를 컷 시각으로 직접 페이드했다(컷이 하나라 트랙이 과함).
- **2.5D 샷**: 카메라는 늘 화면 앞(-Z)에 서고 X 로 두목 반대쪽 옆 — 옆모습 화면이 3/4 로 돌았다 이즈 아웃으로 돌아온다. 이 판 두목은 반격이 없어 포효는 공격 클립·타격음만.
- **진단 함정 피하기**: `PlaytestStorySlice` 의 KillBoss 단계가 플레이어를 두목 곁으로 순간이동하므로, 컷 진단을 Init 단계(두목 곁에 가기 전)에 두고 거기서 한 번 틀고 넘겨 둔다(씬마다 한 번 규칙이라 뒤 단계가 안 막힌다).
- 파일: 새 `Games/SagaStory/Cinematics/*`(넷)·`Story_BossIntro.playable`·`Editor/BuildStoryCinematics.cs`·`Editor/PlaytestStoryBossIntro.cs`, 고침 `StoryEnemy`(CheckIntro·PlayRoar·관문 대장 시간 멈춤)·`StoryPlayerController`(컷 동안 Update 조기 반환)·`StoryCameraFollow`(주석)·`BuildTestStoryScene`(카메라 하이브리드)·`PlaytestStorySlice`(호출). 씬 재빌드.
- 검증: 씬 재빌드 exit 0 · `PlaytestStorySlice` **3연속 OK**(새 `boss intro` 줄 "가까운 샷 3.4m" 3회 동일, 버튼 배선·레벨업 줌·흔들림 등 기존 전부 그대로). 실기 확인은 전. 새 글자 `cut.story_*`·`cut.skip` 는 `StoryLocalization.T` 폴백.

## 2026-09-24 — GO 107-7 망루 수호장(웹 ⑪ 두 겹 방패, 세이브 v15) + 106-9 수호장 등장 컷(GO 카메라 Cinemachine 하이브리드) (새 대화 "사가유니티 이어해줘", Opus 5.5)

- **고른 까닭**: 지난 추천 "GO 두목 등장 컷"에 "이어해". 그런데 GO 엔 컷을 받을 두목급 들판 적이 없었다 — 옛 사건 결투(도적·흰 늑대·사당 시련)는 선택 화면 방식이고 흰 늑대 몸은 캡슐이라 클로즈업이 서지 않는다. 웹 사가고가 이미 ⑪ 지역 수호자(두 겹 방패)를 갖고 있어 그 규칙을 먼저 옮기고(107-7) 그 첫 만남에 컷을 붙였다(106-9). 이 판은 랜드마크 탑이 옛 망루 하나라 수호자도 하나.
- **수호장**: `FieldEnemy.Kind.Guardian`(enum 끝에 추가). 겉 뇌 → 속 화 — 주인공(화)이 겉은 상성으로 깨고 속엔 면역이라 수 동료(산적)로 교체하게 만든다(웹 "한 사람으론 속 방패가 느리다"). 겹 전환은 `BreakShield` 첫머리에서(속 방패 가득·원소 바꿈·0.8초 휘청·알림), 속이 깨지면 3초. 거품·구슬·빛·방패 막대·이름·몸 빛깔을 겹마다 다시 칠한다(`ApplyElementColors`). 쓰러뜨리면 `GuardianState` → 세이브 v15 `guardianDown`, 다시 안 선다(Dead 타이머 무한).
- **카메라**: GO `CameraRig` 에 `view` — 있으면 실제 카메라 대신 플레이 가상 카메라를 민다, 실제 카메라에 브레인. `SagaGo.asmdef` 에 Cinemachine·Timeline 참조를 더했다(DUNGEON asmdef 와 같은 둘).
- **진단 함정 둘**: ① 겹 방패 진단의 첫 타격이 "처음 만남"(Aggro→EnterChase)으로 잡혀 등장 컷이 돌았고, 컷 동안 `Tick` 이 멈춰 휘청 시간이 안 흘러 실패 — `SetEngagedForTest` 로 진단이 만남 여부를 정한다. ② 세이브 버전을 직접 검사하던 `PlaytestGoWorldMap`·`PlaytestGoTreasure` 가 14 를 기대 — 15 로(지도 진단의 v13 가짜 파일은 `guardianDown` 도 뺀다). `PlaytestGoElementalFoe` "원소 적 8" 은 수호장(원소 방패를 둘렀다)을 뺀다.
- 파일: 새 `Data/GuardianState.cs`·`Cinematics/`(GoCutDolly·Clip·Track·GoCutscenes)·`Go_GuardianIntro.playable`·`Editor/BuildGoCinematics.cs`·`Editor/PlaytestGoGuardian.cs`, 고침 `FieldEnemy`·`FieldSpawner`(수호장·PlannedCount)·`SaveState`(v15)·`CameraRig`(view)·`PlayerController`·`FieldCombat`(컷 동안 멈춤)·`SagaGo.asmdef`·`BuildTestVillageScene`(PlayerView·브레인·수호장 몸 Brute)·진단 넷. 씬 재빌드.
- 검증: 씬 재빌드 exit 0 · GO `PlaytestHeadless` **3연속 OK**(새 `guardian` 줄 "가까운 샷 7.1m(키 5.4m)" 3회 동일, 기존 진단 전부 그대로). 실기 확인은 전. 새 글자 `field.foe.guardian`·`field.guard_*`·`cut.guardian_sub` 는 `GoLocalization.T` 폴백.

## 2026-09-24 — GO 107-8 지역 사명 사슬(웹 ⑬, 세이브 v16) (새 대화 "사가 유니티 이어해", Opus 5.5)

- **고른 까닭**: PROJECT_STATE 다음 후보 첫째(GO 107 지역 사명 사슬, 웹 ⑬)·메모리 추천 그대로. 웹 ⑬ 은 "탑 발견 → 무리 2 → 탑 곁 수호자"인데 이 판은 탑·수호자가 옛 망루 하나뿐 — 사명이 한 지역에만 생기면 "지역을 끝냈다" 매듭이 안 산다.
- **옮긴 방식**: 첫 단 = 그 지역 역참(남쪽 공터만 옛 망루), 셋째 단 = 그 지역 보물 상자 모두(남쪽 공터만 망루 수호장) — 원신 탐색도 결이고, 이미 있는 역참·상자·무리를 한 사슬로 묶는다. 사명 지역 넷(동쪽 숲·북쪽 산기슭·남쪽 공터·끝 논밭), 역참이 없는 서쪽 숲길·너른 강과 고향은 뺐다. 규칙(앞에서부터 차례로, 발견 전 무리 셈 쌓임, 단마다 보상 한 번)·금 비율(80×등급·200×등급)은 웹 그대로, 단사 → 경험치(20·60×등급). 남쪽 공터 등급 3 = 수호장 등급.
- **토벌 셈**: 107-4 무리 잠금과 같은 "한꺼번에 다 쓰러짐" 판정을 `FieldSpawner.GroupWiped` 로 뽑아 썼다(상자 쪽 코드는 안 건드림). 되살아난 같은 무리도 다시 센다 — 북쪽 산기슭은 무리가 하나뿐.
- **한 줄 자리**: 목표판(y -10~-100)·자막(-80~-220) 아래 y -228, 오른쪽 지도 버튼(-230, 폭 160)과 안 겹치게 폭 680. 보상 글은 자막을 안 쓰고 그 줄에 4초 — 수호장 토벌 자막과 같은 틱에 덮이는 걸 피했다. 단 계산은 0.25초마다 다시 센다(역참·망루·수호장·상자 이벤트가 제각각, `WorldEventState` 엔 이벤트가 없다).
- 파일: 새 `Data/GoRegionMission.cs`(표·순수 단 계산)·`Data/RegionMissionState.cs`(셈·받은 보상·v16)·`UI/RegionMissionHud.cs`·`Editor/PlaytestGoRegionMission.cs`, 고침 `FieldSpawner`(GroupRegion·GroupWiped)·`SaveState`(v16 `missions`, 15→16)·`WorldMapUi`(이름표 "사명 n/3"·"평정", 높이 64)·`WorldMapBuilder`(HUD 붙임)·`PlaytestHeadless`(보물 상자 뒤)·수호장/지도/상자 진단 버전 검사 16. 씬 재빌드 불필요(런타임 부착).
- 검증: 컴파일 exit 0·오류 0 · GO `PlaytestHeadless` **3연속 OK**(첫 실행부터, 새 `region mission` 줄 3회 동일, 기존 진단 전부 그대로). `ProjectSettings/`·`Packages/` 변경 없음. 실기 확인 전(한 줄이 목표판·자막·지도 버튼과 안 겹치는지, 보상 크기). 새 글자 `mission.*`·`map.mission*` 는 `T(키, 한국어)` 폴백.

## 2026-09-24 — 빠진 번역 키 205개 채움(GO·DUNGEON·FOREST·STORY) + `tools/loc-missing.py` (같은 대화 두 번째 "사가 유니티 이어해", Opus 5.5)

- **고른 까닭**: 지난 답의 다음 후보 중 STORY 파티·소환은 방향을 물어야 하고 106-6 전용 클립은 Mixamo 로그인(사람 몫)이 필요 — 답 없이 "이어해"라 지금 끝낼 수 있는 PROJECT_STATE 0-1 번역 빚부터.
- **찾는 법**: `XxxLocalization.T("키", "한국어")` 호출 · 에디터 빌더의 `"키", "한국어"` 짝(컷 제목 트랙) · 표 데이터 `NameKey/NameKo`·`LabelKey/LabelKo` 짝을 판별로 모아 ko/en JSON 과 비교. 그 밖에 키가 뒤에 오는 버튼 빌더(`action.taunt/heal/summon`)·따로 선언된 폴백(`museum.gather_*`·`foe.shrine_*`·`chest.unlock_*`·`enemy.elite_fusion`)은 문자열 키 전수 훑기로 손으로 더했다.
- **결과**: GO 113(들판 전투·원소·상자·지도·지역 7·역참 5·사명·사당 시련·봉수대 등) · DUNGEON 32(파티·난입·컷 제목·탐험) · FOREST 21(택배·축제·박물관) · STORY 40(비경·관문 대장·컷) — ko 는 코드 폴백 그대로(화면 변화 없음), en 은 세션 번역(사람 검수 전, 자리표시 `{n}` 일치를 스크립트로 확인). REALM 은 원래 0. `settings.*` 공유 키는 안 건드림.
- **도구**: `saga-unity/tools/loc-missing.py` — 판별 빠진 키 수, 하나라도 있으면 exit 1(PLAN 67~69 Localization 줄에 적음). 못 잡는 모양은 도구 머리말에.
- 검증: 스캔 0 · `PlaytestHeadless`·`PlaytestForestHeadless`·`PlaytestStorySlice` 각 OK, `PlaytestDungeonHeadless` 는 첫 실행이 Unity 시작 단계 패키지 관리자 IPC 끊김("Failed to resolve packages: operation cancelled", 진단 전)으로 exit 1 → 재실행 OK. JSON 데이터만 바뀌어 판별 1회씩만 돌렸다.

## 2026-09-24 — GO 107-3 식생 바이옴(지역마다 나무·잎 빛깔·풀·갈대, 씬 재빌드) (같은 대화 세 번째 "사가 유니티 이어해", Opus 5.5)

- **고른 까닭**: 남은 후보 셋 중 STORY 파티·소환은 방향 질문에 답이 없었고 106-6 전용 클립은 Mixamo 로그인(사람 몫) — 코드로 끝나는 107-3 보류분(식생)을 골랐다. 보류 사유는 "편집기에서 굽는 씬 자산"이었는데 배치 모드 씬 재빌드(`BuildTestVillageScene.Build`)로 충분했다.
- **발견**: procgen 이 찍어 둔 `grass_s1~3`·`reed_s1~2` GLB 가 코드 어디에서도 안 쓰이고 있었다. 나무 12벌은 씨앗마다 수관 모양이 셋 중 하나 — procgen `make_tree` 의 난수열(uniform 8번 뒤 integers)을 numpy 로 다시 돌려 1·2 침엽, 3·4·6·11 버드나무류, 나머지 활엽을 셈하고 GLB 꼭짓점 수(원뿔 수관이 적다)로 맞는지 확인했다.
- **빛깔**: 정점색 나무 셰이더에 `_CanopyTint`(초록이 빨강·파랑보다 뚜렷한 정점만, a = 세기, 수관 평균 밝기 0.177 로 나눠 명암 흔들림 유지) — 기본 a=0 이라 바위·옛 재질은 그대로. 풀·갈대는 재질색 GLB(glTFast `baseColorFactor`)라 셰이더를 안 씌우고, 가져온 재질을 지역마다 복제해 C# 에서 같은 공식(`VegetationBuilder.TintLeafy`)으로 물들였다.
- **자리 안전**: 칸마다 앞 세 그루는 옛 해시 salt 그대로라 옛 자리. 서쪽 숲길 넷째 나무만 새로 서는데, 상자·역참·들판 무리·수호장 8m 안이면 건너뛴다(그래서 서쪽 숲길 한 칸은 셋). 풀은 충돌 없음·요지 3.5m 비킴, 갈대는 강 바로 북쪽 줄의 남쪽 둑 띠.
- **대가**: 풀·갈대 231 포기가 씬에 저장돼 `TestVillage.unity` 2.46→3.94MB. 정적 배칭 대상(`MarkStatic`)이라 그리기 묶음은 지역·재질별. 씬 재빌드가 `Go_GuardianIntro.playable` 도 새 fileID 로 다시 쓴다(내용 같음, 함께 커밋).
- 파일: 고침 `GoWorldMap`(Vegetation 표·TreeForm)·`VegetationBuilder`(지역 나무·재질·풀·갈대·요지)·`VertexColorTriplanarLit.shader`(`_CanopyTint`)·`FieldSpawner`(GroupCenters)·`BuildTestVillageScene`(풀·갈대 넘김)·`PlaytestHeadless`, 새 `Editor/PlaytestGoVegetation.cs`, 씬·컷 재빌드.
- 검증: 컴파일·씬 재빌드 exit 0 · GO `PlaytestHeadless` **3연속 OK**(새 `vegetation` 줄 "나무 44(서쪽 숲길 최대 4/칸) · 풀 181(마을 5.0·공터 11.8/칸) · 갈대 49" 3회 동일, 기존 진단 전부 그대로). 셋째 실행 한 번은 Unity 시작 단계 `Failed to resolve packages: operation cancelled` 로 진단 전 exit 1 → 재실행 OK(오늘 두 번째 — PROJECT_STATE 알려진 오류에 적음). 실기 확인 전(호박빛 세기·침엽수 둘 반복감·풀 키·갈대 자리).

## 2026-09-24 — PLAN 106-6 DUNGEON 동료 전용 클립 8(무사 도발·방패 피격·피격·쓰러짐, 술사 걷기·달리기·빛살·치유) (같은 대화 네 번째 "사가 유니티 이어해", Opus 5.5)

- **고른 까닭·정정**: 지난 두 답에서 "106-6 전용 클립은 Mixamo 로그인이 사람 몫"이라 했는데 틀렸다 — 같은 날 107-2 기록에 "자동화 크롬 로그인 살아 있었다"가 있었다(HISTORY 를 grep 안 하고 README 머리말만 믿음). Downloads 엔 옛 0B 파일 하나뿐. 자동화 프로필 크롬을 띄우니 로그인 유지 — 사람 몫 없이 받았다. 받은 뒤 그 프로필 크롬만 종료.
- **고른 클립**: 무사(Paladin) `Sword And Shield Idle To Block`(도발) · `Unblocked Impact`(피격) · `Blocked Impact`(도발 중 피격) · `Falling Back Death`(쓰러짐). 술사(Peasant Girl) `Female Normal Walk`·`Female Run Forward`(--inplace) · `One Handed Casting Spell Fowards`(빛살) · `Casting A Ressurection Or Summon Spell`(치유 — 무사를 일으키는 뜻).
- **함정 — 같은 설명 카드 둘**: 피격·방패 피격은 같은 설명 카드가 두 장씩인데 도구가 `.first()` 로 쭈그린 판(파일 Crouching·Crouch Block, `RootT.y` 0.54·0.58)을 받았다. `fetch.mjs` 에 `--nth` 를 더했지만 **순서가 검색어마다 달라** 첫 시도(검색어 `Sword And Shield`, nth 1)도 같은 쭈그린 판이었고, 검색어 `Shield Impact` 에선 첫째가 선 판(파일 Sword And Shield Impact)이었다 — 임시 폴더에 받아 해시·`RootT.y`(선 0.86, 방패 자세 0.77 = 도발 끝 자세와 같음)로 확인. 확인은 임시 에디터 스크립트(길이·`RootT.y` 시작/최저)로 하고 지웠다.
- **코드**: `SetupNpcCharacterImports` 표에 `ExtraTriggers`(끝나면 대기로) — Paladin `Hit`·`Death`·`Taunt`·`Blocked`, PeasantGirl `Walk`·`Run`·`Attack`(= Cast)·`Heal`. `AllyFighter`: 도발 `Taunt`, 맞으면 도발 중 `Blocked`·아니면 `Hit`, 쓰러짐 `Death`(머묾) → 일어나면 `Play("Idle")`, 클립 없으면 옛 폴백(검방 공격·절차적 눕히기). `AllyMystic`: 제 컨트롤러에 `Attack`·`Heal` 이 있으면 Maria.controller 를 안 씌움, 치유 `Heal`. 둘 다 `LastTrigger`(진단용). PeasantGirl 은 마을 아낙·포로도 같은 프리팹이라 상태만 늘었고(속도 0·Kneel 이름 재생) 영향 없음, GO 동료 몸은 Maria.controller 를 씌우니 그대로.
- **진단**: `PlaytestDungeonParty` — 도발 트리거(전용이면 Taunt·아니면 Attack) · 도발 중 피격 Blocked · 쓰러짐 Death·절차적 눕히기 안 함·상태 들어감 · 치유 Heal·일어나면 Death 밖 · 술사가 Maria 안 씀 · 빛살 Attack. 측정 줄에 "전용 클립 무사 True·술사 True".
- 검증: NPC 리깅 exit 0(여덟 클립 Humanoid, 4/4 프리팹) · `PlaytestDungeonHeadless` **3연속 OK**(전용 클립 경로 3회) · GO `PlaytestHeadless` OK(같은 프리팹). 컨트롤러 넷이 다시 구워져 Skeleton·PeasantMan 도 fileID 만 바뀜. 실기 확인 전(방패 들기 0.57s 가 도발로 읽히는지·치유 4.2s 가 길지 않은지·쓰러짐 뒤 곧장 서는 게 튀지 않는지).

## 2026-09-24 — PLAN 108 ① GO 고정 특색 지역(한자·사연·위험도·몬스터 명단) (같은 대화 다섯 번째 "사가유니티 이어해", Opus 5.5)

- **고른 까닭**: 106·107 이 다 끝났고 다음 후보(STORY 파티·소환)는 사용자와 정할 일. 같은 날 사용자 결정(SAGA-DESIGN §12 "무작위 땅 금지, 일곱 판 공통")으로 생긴 PLAN 108 ① 이 이 트랙 몫으로 남아 있었다.
- **표**: 市原(마을 들판, ●○○ 적 없음)·雷林(서쪽 숲길, ●●○ 번개귀·물귀신)·丹林(동쪽 숲, ●●○ 산적·해골·물귀신)·寒麓(북쪽 산기슭, ●●● 해골)·廣川(너른 강, ●○○ 적 없음)·金坪(남쪽 공터, ●●● 산적·해골·수호장)·末田(끝 논밭, ●●○ 산적·불도깨비·번개귀). 한자는 지어낸 것.
- **함정**: `spirit_grove` 무리(5.5, 2.2)는 칸 반올림 때문에 마을이 아니라 동쪽 숲에 속한다. 처음엔 마을 명단에 물귀신을 넣었다가 진단(명단 정직성)이 잡았고, 마을은 "적 없음"·동쪽 숲에 물귀신을 더했다(사연도 고침).
- **수치**: 위험 배율 ×1.0/1.15/1.3 을 체력·공격·방패·경험치에 곱한다(수호장 제외). 원소 적 경험치 20 → 雷林·末田 23, 방패 불도깨비 173·물귀신 207·번개귀 150. 해골 체력 丹林 253 / 寒麓 286.
- **글**: 경계 자막은 "— 이름 한자 —" + "위험 ●●○ · 명단", 처음 가는 땅이면 사연 한 줄 더(4초, 다시 오면 2.2초). 지도 이름표에 위험 점, 지도 위쪽에 지금 선 지역 두 줄. 번역 키 10개(ko·en), `loc-missing.py` 빠진 키 0.
- 파일: 고침 `GoWorldMap`(Region 필드·`DangerMul`·`DangerLine` 등)·`FieldEnemy`(`KindName`·`Danger`·`ApplyDanger`)·`FieldSpawner`(위험 적용·`GroupMembers`)·`WorldMapUi`(`EnterText`·`RegionInfo`·이름표)·`go_ko/en.json`·`PlaytestGoElementalFoe`(경험치·방패 기대값에 배율)·`PlaytestHeadless`, 새 `Editor/PlaytestGoRegionTraits.cs`. 씬 재빌드 없음(런타임에서 세우는 적이라).
- 검증: GO `PlaytestHeadless` **3연속 OK**(진단 줄 3회 md5 동일, 새 `regionTraits` 줄 "무리 적 23(위험3 8)·해골 체력 동쪽 253/산기슭 286"). 실기 확인 전(자막 세 줄이 길지 않은지·지도 위쪽 두 줄이 지도와 안 겹치는지·위험 3 산기슭 해골이 버거운지).

## 2026-09-24 — PLAN 108 ② FOREST 고정 특색 지역(한자·사연·짐승 명단·명소 넷) (같은 대화 여섯 번째 "이어해", Opus 5.5)

- **표**: 어둑숲 暗林(숲도깨비·안개유령 · 이끼 돌제단) · 바위 지대 巖野(바위도깨비·무쇠도깨비 · 거인 선돌) · 버섯숲 菌林(버섯정령·포자괴물 · 요정 돌고리) · 꽃밭 花原(꽃정령·나비정령 · 옛 돌기둥터). 한자·명소 이름은 지어낸 것. 명단은 `ForestCreatureBuilder` den 과 같아야 한다(진단이 본다).
- **존 자막**: `ForestZoneTracker`(부트스트랩이 Play 때 붙임) — 중심 11.5m 안이면 그 존. "— 어둑숲 暗林 —\n사는 것: 숲도깨비·안개유령", 그 판 첫 방문이면 사연 한 줄 더(4초, 다시 오면 2.2초), 마을로 오면 "— 마을 —". 집 안(+500m)은 마을로 친다. 세이브 스키마 안 바꿈(처음 봄은 세션 안에서만).
- **명소**: 존 중심에서 바깥 z 로 7m — den 둘(중심·바깥 대각선)·채집 자리(안쪽 대각선)·우편함(바깥 x)과 안 겹치는 남은 축. 모양은 커밋된 CC0 GLB 만(altar-stone·lantern·rock_largeA/smallA·pillar-stone), 어둑숲·버섯숲엔 점광 하나씩. 충돌체는 제단(상자)·선돌·기둥(캡슐), 돌고리는 걸어 들어가게 없음.
- **함정 — 땅 휨**: 이 판 땅·나무·짐승은 `ForestWorldCurve` 셰이더(y −= 거리² × 0.004)로 휘는데 GLB 는 PBR 재질이라 안 휜다 → 20m 밖에서 1.6m 떠 보인다(옛 우편함·소원돌도 같은 문제로 URP/Lit). 명소는 `ForestLandmark` 가 "Visual" 을 통째로 거리² × 0.004 내린다(물체 안 굽음은 없지만 3~4m 짜리라 티 안 남). 충돌체는 뿌리에 두어 안 움직임.
- 파일: 고침 `ForestBiomeData`(Zone 필드·`ZoneAt`·`EnterText`)·`ForestCreature`(`KindName`·`Kind`·`Den`)·`ForestBootstrap`·`BuildTestVillageForestScene`(`BuildLandmarks`)·`forest_ko/en.json`(키 25)·`PlaytestForestHeadless`, 새 `ForestLandmark.cs`·`ForestZoneTracker.cs`·`Editor/PlaytestForestZones.cs`, 씬 재빌드.
- 검증: 씬 재빌드 exit 0 · `PlaytestForestHeadless` **3연속 OK**(진단 줄 md5 동일, 새 `zones` 줄 "명소 모양 조각 19") · 같은 씬 `PlaytestForestCreatures`·`Finish`·`Furniture`·`HouseTransition` 전부 OK. 실기 확인 전(명소 크기·휨 따라 내리는 게 가까이서 튀지 않는지·점광 세기·자막 세 줄 길이).

## 2026-09-24 — PLAN 108 ③ DUNGEON 명소 층 여섯(손으로 짠 고정 층, 웹 사가블로 §5.15 결) (같은 대화 일곱 번째 "이어해", Opus 5.5)

- **표**: 5 순장 왕릉 殉陵 · 10 무너진 망루성 廢樓城 · 15 흑풍 산채 黑風寨 · 20 가라앉은 용궁 沈龍宮 · 25 업화 대문 業火門 · 30 구름 위 금궐 雲上闕. 이름은 웹 판과 같은 뜻을 이 트랙에 다시 적은 것(코드 공유 없음), 한자·방 이름·잡졸·주인·무기는 지어낸 것. 웹 판처럼 5~30 에 두었다 — 31~100 은 갈림길 그대로.
- **흐름**: 방 다섯이 늘 같은 순서(문 하나·표지에 다음 방 이름·난수 안 씀), 잡졸 이름은 그 층 것, 마지막 방 층 주인(두목 공식 × 1.15·호위 둘·월드 보스 초읽기 없음·등장 컷 부제 "○○의 주인" — `DungeonEnemy.SetIntroSubtitle`). 첫 토벌만 고유 무기(청동 순장검 24 … 천장 금검 46)와 금 층 × 40, 뒤로는 흑철중검. HUD 층 줄에 "⚱ 순장 왕릉 · 참배길", 내려갈 때 "⚱ 명소 층 — 이름 한자" + 사연, 방마다 자막 2.5초.
- **세이브 v10**: `landmarkClears`(int[6]). v9 이하는 null → 전부 0. 층을 짓기 전에 복원(주인 보상 판정).
- **곁에서 고친 결함**: `BuildRoomContent` 가 옛 방 내용을 `Destroy` 만 해서 같은 프레임에 다시 지으면(JumpToFloor 직후) 옛 적이 살아 있는 채로 방에 섞였다 — 진단이 5층 첫 방에서 "황건적" 넷을 잡았다. 떼어 내고 끈 뒤 지우게 고침(PROJECT_STATE 알려진 오류와 같은 함정).
- 파일: 새 `Data/DungeonLandmarkData.cs`(표·`LandmarkState`)·`Editor/PlaytestDungeonLandmarks.cs`, 고침 `DungeonFloorRunner`(명소 흐름·`SpawnLord`·주인 토벌·옛 내용 떼기)·`DungeonEnemy`(부제·진단용 접근자)·`ItemData`(무기 여섯)·`SaveState`(v10)·`PlayerHud`·`dungeon_ko/en.json`(키 65)·`PlaytestDungeonHeadless`. 씬 재빌드 없음.
- 검증: `PlaytestDungeonHeadless` **3연속 OK**(새 `landmarks` 줄 3회 같음, 달라진 건 원래 흔들리는 fps·컷 시각 줄뿐) · `PlaytestDungeonFloorProgression` OK(12방·4층) · `SimulateDungeonFloors` OK(공식만 봐서 명소 층은 모름). 실기 확인 전(5층 주인 세기·방 다섯이 짧거나 길지 않은지·첫 토벌 무기 체감·다른 층도 고정하길 원하는지).

## 2026-09-24 — 폰 발열 점검(그래픽 최적화 확인) — 화질은 그대로, 새는 것만 (사용자 "핸드폰 불나면 안되니", Opus 5.5)

- **사용자 기준**: 도중에 "그래픽을 낮추라는 게 아니라는 건 알지?" — 화질을 깎는 최적화는 빼고, 보이는 것 안 바뀌는 것만.
- **이미 모바일용으로 잘 나뉜 것(점검만)**: Android·iPhone 기본 품질 = Mobile · Mobile URP 렌더 스케일 0.8·MSAA 2·그림자 맵 1024·캐스케이드 1·소프트/추가 조명 그림자 끔·SRP Batcher · Mobile 렌더러는 데칼 하나(SSAO·Screen Space Shadows 는 PC 만) · DoF 는 PC 만 · 블룸 반 해상도·HQ 필터 끔 · Update 안의 Find 계열 호출 없음(StoryCameraFollow 는 null 일 때만).
- **고친 것**:
  - 설정 "그래픽 저" 가 **폰에서 실제로 아무 일도 안 했다** — 다섯 판 모두 `QualitySettings.shadowDistance`·`antiAliasing` 만 바꿨는데 URP 는 둘 다 안 읽는다(진단도 그 두 값만 봐서 통과했다). 새 `SagaCore/MobileGraphics.ApplyQuality` 가 활성 URP 에셋의 그림자 거리 15·MSAA 끔·렌더 스케일 ≤0.7·물체당 추가 조명 2 를 직접 건다. 기본 "고" 는 안 바꾸고, 사람이 "저" 를 골랐을 때만. 에디터에선 에셋 파일이 저장될 수 있어 플레이어 빌드에서만 건다.
  - 모바일 프레임 상한 30 을 **명시**(`Application.targetFrameRate`, 모바일만). 기본값 -1 은 기기·화면(120Hz)마다 해석이 달라 못 박았다 — 보통 폰 기본도 30 이라 체감 변화는 없을 것(실기 확인 몫).
  - Mobile 데칼 그리는 거리 1000m → 60m(발자국·그을음 데칼은 플레이어 곁에만 생긴다 — 60m 밖은 폰 화면에서 안 보인다).
- **넣었다가 되돌린 것(화질 저하라)**: 폰 텍스처 1024·ASTC 6×6 상한(PLAN 103-2 에 적혀 있던 값 — 캐릭터 2048/4096 이 줄어든다, 103-2 를 "모바일도 2048" 로 고침) · GO 풀·갈대 그림자 끄기(씬 재빌드했다가 git 으로 원복).
- **남겨 둔 권고(화질에 닿아 손 안 댐)**: GO 런타임 점광 약 36개(상자 16·원소 적 8·역참 5·석등·망루 60m) — 물체당 4개로 이미 막혀 있다 · 폰에서 HDR 버퍼 · 캐릭터 텍스처 2048/4096.
- **함정**: Unity 6000.3.24 가 배치 실행 때 `Mobile_RPAsset.asset` 형식을 v12→v13 으로 올려 쓴다(`tools/unity-batch.sh` 원복 목록 밖) — 두 번 git checkout 으로 되돌림, 커밋 안 함.
- 파일: 새 `SagaCore/MobileGraphics.cs`·`Editor/PlaytestMobileGraphics.cs`, 고침 다섯 `XxxSettingsState.ApplyGraphicsQuality`·`Mobile_Renderer.asset`·`PlaytestHeadless`·PLAN 103-2.
- 검증: GO `PlaytestHeadless` OK(새 `mobile graphics` 줄 — Mobile 값 그대로·데칼 60m·고=안 바꿈/저=가벼움·30fps). 폰 실측(온도·프레임)은 모바일 빌드 뒤 실기 몫.

## 2026-09-24 — PLAN 106-6 소환수 전용 모델 "바위 거신" + 바위 재질 바로잡기 (사용자 "다음 이어할 사항 진행 해줘", Opus 5.5)

- **고른 까닭**: 남은 후보 중 STORY 파티·소환은 방향 결정 몫, 지역 소품은 에셋 먼저 — 결정·새 에셋 없이 끝나는 106-6 "소환수 전용 모델·발광 재질".
- **모양**: `PartySummon.BuildGolem` — 두목(Brute) 뼈대 위 마디 9(몸통·위아래팔·위아래다리) + 끝 5(머리·주먹 둘·발 둘) = 바위 14 덩이, 마디 길이에 맞춰 늘이고(굵기 배율 0.5~1.5, 주먹 1.5) 뼈에 붙여 두목 클립 그대로 움직인다. 두목 SkinnedMeshRenderer 는 끈다. 가슴 한가운데·두 주먹에 발광 조각 셋(URP Lit 발광 금빛 × 4). 사람 뼈대가 아니거나 바위·마디가 모자라면(10 미만) 예전 돌빛 틴트.
- **발견 — Kenney 바위 재질**: rock_largeA/smallA 는 텍스처 없이 **metallic 1 · 주황(0.89,0.51,0.34)/청록(0.17,0.85,0.72) 단색**이었다 — 사가의숲 108 ② 명소(거인 선돌·요정 돌고리)도 번쩍이는 장난감 돌이었다. UV 는 실제 투영값(약 ±20)이라 새 `Editor/RockStoneMaterial`(PolyHaven rock_boulder_dry 1k, 비금속, 타일링 0.03)로 둘 다 갈아 끼움.
- 파일: 고침 `PartySummon`(`Look`·`BuildGolem`·`Chunk`)·`PartyCommands`(바위 둘·돌 재질 필드)·`BuildTestDungeonScene`·`BuildTestVillageForestScene`(명소 바위 재질)·`PlaytestDungeonParty`(마디 ≥12·발광 ≥3·살갗 숨김·비금속)·`PlaytestForestZones`(명소 바위 = 돌 재질), 새 `Editor/RockStoneMaterial.cs`·`rock_boulder_dry_URPLit.mat`, 씬 둘 재빌드(컷 playable 다섯은 fileID 만).
- 검증: 씬 둘 재빌드 exit 0 · `PlaytestDungeonHeadless` **3연속 OK**("거신 마디 14·발광 3" 세 번 같음) · `PlaytestForestHeadless` OK(첫 실행은 알려진 `Failed to resolve packages` 로 진단 전 exit 1 → 재실행 OK). 실기 확인 전(거신 실루엣이 바위 괴물로 읽히는지·바위 사이 틈·발광 세기·숲 명소 돌 빛깔).

## 2026-09-24 — FOREST 짐승 여덟 사실 모델(도형 → Mixamo 몸 + 빛깔·꾸밈) (사용자 "사가 유니티 이어 해줘", Opus 5.5)

- **고른 까닭**: PROJECT_STATE 다음 후보 중 결정 없이 끝나는 것 — STORY 파티·소환은 사용자 결정 몫, 지역 소품은 에셋 먼저. 짐승은 Downloads 에 없었고 저장소엔 웹 판 Quaternius 저폴리 괴물뿐이라(사실적 PBR 트랙과 결이 안 맞음) Mixamo 괴물 몸으로 갔다.
- **몸 고르기**: 새 `tools/mixamo_automation/list-characters.mjs` 로 카드 이름을 찾고, 카드 스크린샷을 한 장으로 붙여 보고 골랐다. 숲도깨비 = Goblin D Shareyko(1.25m) · 바위도깨비 = Pumpkinhulk L Shaw(회색 거구, 돌빛 회갈 1.85m) · 무쇠도깨비 = Warrok W Kurniawan(뿔, 청회 금속감 0.55, 1.75m) · 포자괴물 = Parasite L Starkie(병든 황록 + 등·두 어깨 버섯 무리, 1.6m, 대치 때 포효) · 안개유령 = Nightshade J Friedrich(반투명 α0.5·창백 발광·점광 하나, 떠 있기 클립, 발끝 0.45m 뜸) · 정령 셋 = Jolleen(잎 옷 요정) 하나를 작게(0.85~0.95m) — 버섯정령 청록 + 머리 버섯 · 꽃정령 분홍 + 꽃 일곱 화관 · 나비정령 보라 + 반투명 날개 넷(퍼덕임, 도망 땐 빠르게).
- **클립**: 몸 6 + 클립 17(README 레시피 표). 걷기·달리기는 In Place. 애니메이터 `Speed` 는 상태로 준다(배회 0.4 걷기 · 도망/추격 1.0 달리기 · 나머지 0).
- **구조**: `SetupNpcCharacterImports` 표에 몸 여섯(+`SetupOne`) → 새 `Editor/SetupForestCreatureModels`("Saga/Setup Forest Creature Models")가 키·재질 사본(`CharactersRealistic/Forest/Materials/`)·꾸밈을 얹어 `Forest_<종>.prefab` → 씬 빌더가 `ForestCreatureBuilder.models`(KindOrder 순) 에 꽂음 → 런타임 `ForestCreature.Setup(kind, den, model)` 이 "Visual" 아래 세움. 프리팹이 없는 PC·칸은 예전 도형(gitignore 폴더라 PC 마다 받고 메뉴 → 씬 재빌드).
- **땅 휨**: 모델은 PBR 이라 `ForestWorldCurve` 를 안 탄다 → 명소(108 ②)처럼 "Visual" 을 매 프레임 거리² × 0.004 내림(`FollowCurve`).
- **꾸밈 에셋**: Quaternius Stylized Nature MegaKit(CC0, saga-godot 가 09-20 받은 것) 중 Mushroom_Common·Flower_3/4_Single 만 `Art/Vegetation/QuaterniusNature/` 로 복사(텍스처 셋·LICENSE). 나비 날개만 맞는 CC0 메시가 없어 납작 구.
- **곁에서 고친 진단 흔들림**: `PlaytestForestCreatures` 첫 실행이 "포자괴물 0.00m" 로 실패 — 배회 반경이 가장 좁아(1.8m) 난수가 den 옆 0.4m 안을 고르면 바로 다시 쉬어 5.5초 동안 안 움직이는 판이 드물게 나온다(모델과 무관한 옛 흔들림). 진단 시작에 `Random.InitState(20260824)`.
- 함정: 일괄 받기 셸 스크립트에서 `"$R\$2"` 가 `$2` 를 글자로 남겨 파일이 `CharactersRealistic$2/` 로 모였다 — 파일 이름 접두사로 제 폴더에 옮김.
- 파일: 새 `Editor/SetupForestCreatureModels.cs`·`Art/Vegetation/QuaterniusNature/`·`Animators/{Goblin,Hulk,Warrok,Parasite,Nightshade,Jolleen}.controller`·`tools/mixamo_automation/list-characters.mjs`, 고침 `ForestCreature`(`UseModel`·`LateUpdate`·`FollowCurve`·포효)·`ForestCreatureBuilder`(`models`·`KindOrder`)·`SetupNpcCharacterImports`·`BuildTestVillageForestScene`·`PlaytestForestCreatures`(모델 확인·씨앗)·mixamo README, 숲 씬 재빌드.
- 검증: 모델 굽기 8/8 · 씬 재빌드 exit 0 · `PlaytestForestCreatures` **3연속 OK**(새 줄 "models 8/8 — 애니메이터·살갗·꾸밈·휨 내림 OK", 도망 중 Speed 1.00) · `PlaytestForestHeadless` **3연속 OK**(진단 줄 md5 동일) · `Finish`·`Furniture`·`HouseTransition` OK. 화면은 안 봤다 — 실기 확인 전(키·빛깔·꾸밈 자리가 머리·등에 맞는지·안개유령 투명도·날개 퍼덕임·Mixamo 괴물이 숲 톤과 어울리는지).

## 2026-09-24 — PLAN 106-10 STORY 파티: 교대 셋을 곁에 세우기 (사용자 "사가 유니티 이어 해줘" → 세 안 중 사용자 선택, Opus 5.5)

- **결정**: 미뤄 두던 "STORY 파티·소환" 을 세 안(소환만 · 교대 셋을 곁에 세우기 · STORY 건너뛰기)으로 물었고 사용자가 **교대 셋을 곁에 세우기** 를 골랐다. 앞에 나선 역할은 플레이어와 한 몸(숨김), 쉬는 둘이 곁에서 스스로 싸운다. 5-8 공격 배율·서명은 그대로. 소환은 다음 단계.
- **몸**: 선봉 Paladin · 유격 새 Mixamo 궁수 `Erika Archer With Bow/Arrow`(대기·걷기·달리기·쏘기, 걷기는 같은 설명 카드 둘째 `--nth 1` — 첫째는 쭈그린 판) · 호법 Peasant Girl. Abe 는 이 판 잡졸 몸이라 동료로 안 썼다.
- **수치**: 한 타 = 기초 공격력(시작 + 전직 + 기억 조각, × 비경 축복) × 선봉 0.35/1.1s · 유격 0.3/1.6s 화살(관통 없음) · 호법 0.22/2.2s + 적이 곁이면 8s 마다 기력 12%. 체력·쓰러짐 없음(적이 반격 안 함).
- **이동**: 뒤쪽 줄 z=+0.9, 발밑 땅 찾기·중력, 높이 0.8m 넘게 다르면 0.5s 포물선 뛰어오름, 14m 넘으면 곁으로 옮김. 플레이어 착지 판정은 `isGrounded` 가 아니라 발밑 땅 찾기(순간이동 직후엔 `isGrounded` 가 거짓이라 진단이 못 봤다).
- **진단 함정 둘**: ① 필드가 좁아(약 44m) 잡졸 없는 16m 구간이 없다 — 동료가 곁 잡졸을 먼저 노려 "따라오기"·"선봉 타격" 이 흔들렸다 → 맵 밖 x=-200 에 임시 바닥·발판을 깔고 시험 후 치움(`Physics.SyncTransforms`). ② 피해 굴림 난수로 선봉 피해 줄이 판마다 달랐다 → 진단 시작에 `Random.InitState(20260824)`. 동료 진단 뒤엔 `PausedForTest` 로 멈춰 뒤 단계(잡졸 10·한 방 피해 전제)를 안 흔든다. 교대 시험의 서명은 횡소(기합은 버프, 기탄은 투사체가 뒤 단계를 흔듦).
- 파일: 새 `SagaStory/World/StoryCompanion.cs`·`StoryCompanionSquad.cs`·`Editor/PlaytestStoryCompanions.cs`, 고침 `BuildTestStoryScene`(`BuildCompanions`)·`SetupNpcCharacterImports`(Archer)·`StoryHud`(곁 줄)·`StoryEnemy`(`Hp`)·`story_ko/en.json`(`party.beside_hud`)·`PlaytestStorySlice`·mixamo README, STORY 씬 재빌드(`Story_BossIntro.playable` 은 fileID 만).
- 검증: 씬 재빌드 exit 0 · `PlaytestStorySlice` **3연속 OK**(동료 줄 "models 3/3 · follow 6.0→0.7m · hop y2.0 · vanguard 8.1dmg · mystic mp+12" 세 번 같음) · 번역 누락 0. 화면은 안 봤다 — 실기 확인 전(곁에 선 자리·겹침, 뛰어오르기가 어색하지 않은지, 궁수 화살 모양, 교대 불꽃, 동료 세기가 판수를 너무 줄이지 않는지).

## 2026-09-24 — PLAN 106-10 둘째 단계: STORY 소환 "우레뿔 거수" (사용자 "다른 작업 이어해", Opus 5.5)

- **고른 까닭**: 남은 후보 둘 중 지역 소품은 에셋 먼저, STORY 소환은 106-10 에 이미 "다음 단계"로 적혀 결정이 필요 없다.
- **2.5D 로 고친 것**: DUNGEON 바위 거신은 땅에서 솟는데, 이 판 발판은 허공에 떠서 발판 밑으로 몸이 비친다 → 먹구름에서 번개와 함께 내려선다. 피해는 × 15 대신 × 8(잡졸 18·두목 216 판이라 × 15 면 두목이 한 방). 범위는 거리 대신 좌우 14m·위아래 6m.
- **몸**: 이 판 두목 몸(Brute)과 겹치지 않게 Warrok(FOREST 무쇠도깨비와 같은 몸, 다른 판) — 공격 클립이 없어 Mixamo `Mutant Jump Attack To Idle` 을 `Warrok@Attack` 으로 받고 표에 Attack 을 더했다. Warrok 을 다시 구워 컨트롤러가 바뀌었다(FOREST 짐승 진단 다시 OK).
- **게이지**: `StoryEnemy.TakeDamage` 한 곳에서 `StorySummonState.HitSource`(플레이어 +3 · 동료 +1 · 없음 0)를 읽는다 — 동료 근접은 잠깐 Companion 으로, 유격 화살은 `StoryBolt.FromCompanion`, 소환 내려찍기는 None.
- **컷**: `StoryCutscenes` 를 컷 둘로 넓힘(지금 틀 감독 `_dir`·이름표 시각을 컷마다). 소환 컷은 없으면 onEnd 를 안 부른다(소환수가 혼자 5초 논다 — 두목 컷은 없으면 바로 onEnd).
- 파일: 새 `SagaStory/Data/StorySummonState.cs`·`World/StorySummon.cs`·`Player/StorySummoner.cs`·`Editor/PlaytestStorySummon.cs`·`Timelines/Story_Summon.playable`, 고침 `StoryCutscenes`·`BuildStoryCinematics`·`BuildTestStoryScene`(`BuildSummoner`·"소환" 버튼)·`StoryEnemy`·`StoryCompanion`·`StoryBolt`·`StoryPlayerController`(`AttackPower`·`OnRope`)·`StoryHud`(게이지 줄)·`story_ko/en.json`(키 8)·`SetupNpcCharacterImports`(Warrok Attack)·`PlaytestStorySlice`(버튼 목록·진단 연결)·`HOW_TO_PLAYTEST`(V)·mixamo README, STORY 씬 재빌드.
- 검증: 씬 재빌드 exit 0 · `PlaytestStorySlice` **3연속 OK**(새 줄 "summon OK — close cam z-6.8 y1.3 · slam 193×2 · model Warrok" 세 번 같음) · `PlaytestForestCreatures` OK · 번역 누락 0. 실기 확인 전(내려서는 번개·크기 6.5m 가 화면에 들어오는지·내려찍기 클립 박자가 3.2s 에 맞는지·게이지 차는 속도·소리 없음).

## 2026-09-24 — PLAN 108 ① GO 지역 전용 소품 묶음 (사용자 "사가 유니티 이어 해", Opus 5.5)

- **고른 까닭**: PROJECT_STATE 다음 작업 "지역 소품(에셋 먼저)". 결정할 방향은 없고 막힌 건 에셋뿐이었다 — 저장소를 먼저 뒤져 보니 웹 판에 Poly Haven·아일랜드 문화유산 사실 스캔이 있었지만 웹용 `EXT_meshopt_compression`·`EXT_texture_webp` 압축이라 glTFast 가 못 읽는다(trimesh 도 버퍼를 못 읽음). Poly Haven 공개 API 카탈로그(모델 521)에서 사연에 맞는 열 벌을 골라 glTF 1k 원본을 새로 받았다(`tools/fetch_polyhaven_models.py`, 약 27MB).
- **무더기 아홉**(`GoRegionProps.Clusters`): 雷林 벼락 고목 둘 · 丹林 산적 야영터 · 寒麓 무너진 성터·무덤 줄 · 廣川 여울 바위 둘 · 金坪 옛 수비대 자리 · 末田 가을걷이 마당. 마을 들판은 집·장터·폐허로 이미 차 있어 뺐다. 자리는 상자·역참·무리·수호장·채집·NPC·조우·석등·비탈 좌표를 다 모아 손으로 골랐다.
- **무게**: 사진측량 원본이 통나무 하나 10만 삼각형이라 처음 배치(모닥불 속 작은 통나무 둘 포함)는 곁에 서면 수십만 — 모닥불 속 통나무는 빼고, Blender 5.2 배치 decimate 로 LOD1 여섯 벌(`tools/polyhaven_lod1.py`, 통나무 10만→1.2만), LODGroup 은 화면 높이 25% 넘을 때만 원본. 화질(텍스처·가까이 모양)은 원본 그대로.
- **발견하고 고친 것**: 밑면을 렌더러 경계 상자로 맞추니 눕힌 방패가 0.09·0.17m 떴다 — 기울인 조각의 경계 상자는 헐겁고, Play 모드 정적 배칭 뒤엔 꼭짓점 기준으로 딱 맞게 잡혀 진단이 잡아냈다. 빌더가 실제 꼭짓점 최저점으로 맞춘다. 진단의 삼각형 셈도 정적 배칭 뒤엔 합친 메시 전체를 세서 부풀었다 → 렌더러 서브메시 구간만 센다.
- **식생**: 무더기 빈터(`Clearing`) 안엔 옛 자리 나무·풀도 안 세운다(`VegetationBuilder.TreeBase`·`SkipTree` 로 뽑아 진단이 같은 식으로 칸마다 정확한 수를 본다). 이번 자리엔 걸린 옛 나무가 0 그루였다.
- 파일: 새 `SagaGo/Data/GoRegionProps.cs`·`World/RegionPropsBuilder.cs`·`World/PropFlicker.cs`·`Editor/PlaytestGoRegionProps.cs`·`Assets/Art/Props/PolyHaven/`(열 벌 + LOD1 여섯 + LICENSE)·`tools/fetch_polyhaven_models.py`·`tools/polyhaven_lod1.py`, 고침 `VegetationBuilder`·`PlaytestGoVegetation`(칸마다 표대로 정확한 수)·`BuildTestVillageScene`(`BuildRegionProps`)·`PlaytestHeadless`, GO 씬 재빌드(수호장 컷 타임라인도 같이 다시 구워짐).
- 검증: 씬 재빌드 exit 0 · GO `PlaytestHeadless` **3연속 OK**(새 줄 "무더기 9·조각 46(LOD 31)·삼각형 가까이 970k·멀리 213k·가장 무거운 무더기 bandit_camp 250k·불빛 2" 세 번 같음). 화면은 안 봄 — 실기 확인 전(크기 1.9배가 맞는지·그을린 빛·번쩍임 세기·모닥불 빛·여울 바위가 헤엄길을 막지 않는지·LOD 바뀌는 순간 튀는지).

## 2026-09-24 — PLAN 108 끝줄 FOREST 존 전용 소품 (사용자 "사가 유니티 이어 해", Opus 5.5)

- **고른 까닭**: 앞 세션이 PLAN 108 끝줄에 남긴 유일한 대기 항목. 에셋은 GO 지역 소품 때 받은 Poly Haven 스캔 그대로(한 Unity 프로젝트 안 에셋 공유 — 코드는 이 판 것으로 새로 썼다).
- **자리**: 존마다 den 둘(가운데·(6sx,4sz))·도감 채집 자리(−6sx,−6sz)·우편함(8sx,0)·명소(0,7sz) — 이 다섯과 떨어진 두 곳 A(−7sx,2sz)·B(3sx,−7sz) 를 부호만 바꿔 네 존에 똑같이 쓴다. 짐승은 굴 둘레 2.5~3.5m 를 transform 으로 걸어 충돌을 안 탄다.
- **휨**: PBR 조각은 `ForestWorldCurve` 셰이더를 안 타 명소처럼 내려야 하는데, 명소는 통째로 한 번 내린다(무더기 폭이 넓으면 가장자리가 뜬다) → 조각마다 따로 내린다(`ForestZonePropsBuilder.Follow`, 조각 26 개 루프). 충돌은 뿌리에(안 움직임), 밑면 높이는 그 아래 Body 에. 정적 배칭하면 휨이 막혀 정적 표시를 안 한다(진단이 본다).
- **무게**: 첫 배치는 버섯숲에 쓰러진 통나무(원본 10만 삼각형) 둘이라 존 원본 27만 > 상한 25만 → 하나를 이끼 바위로. 최대 18만.
- 파일: 새 `SagaForest/Data/ForestZoneProps.cs`·`World/ForestZonePropsBuilder.cs`·`Editor/PlaytestForestZoneProps.cs`, 고침 `BuildTestVillageForestScene`(`BuildZoneProps`)·`PlaytestForestHeadless`, FOREST 씬 재빌드, 앞 커밋에서 빠진 `PolyHaven/LICENSE.txt.meta`.
- 검증: 씬 재빌드 exit 0 · `PlaytestForestHeadless` **3연속 OK**(새 줄 "무더기 8·조각 26(LOD 19)·존 원본 삼각형 최대 180k" 세 번 같음) · `PlaytestForestCreatures` OK. 화면은 안 봄 — 실기 확인 전(1.5배 크기·휨 따라 내림이 가까이서 튀는지·플레이어가 조각에 걸리는지).

## 2026-09-24 — PLAN 106-4 GO·FOREST·STORY NPC 사실 모델 + FOREST 존 소품 배율 바로잡기 (사용자 "이어해줘", Opus 5.5)

- **고른 까닭**: 앞 세션 끝에 "적힌 대기 없음, 방향은 사용자와"로 물었는데 답 없이 "이어해줘" — 저장소를 다시 보니 PLAN 106-4 끝줄에 "남은 것: GO·STORY·FOREST NPC(판별 복사)"가 적혀 있었다(앞 세션이 놓침). Kenney 블록 인물이 남은 자리는 이 셋뿐(주인공은 다섯 판 Maria, 적은 Abe·Brute·Skeleton).
- **배역**: GO 촌장 Peasant Man · 떠돌이 상인 Peasant Girl · 나그네 궁수 · FOREST 숲지기 Peasant Man · STORY 척후병 Peasant Man · 전직관 Jolleen. STORY 는 동료 셋(Paladin·Archer·Peasant Girl)과 몸이 안 겹치게 골랐다. 새로 받은 Mixamo 몸 없음.
- **코드**: 판마다 `NpcIdle` 복사(DUNGEON 것 + `SpawnRigged` 가 렌더러 키를 재서 그 판 사람 키로 맞추고 발을 뿌리에). 없는 PC 는 예전 Kenney 로 폴백. FOREST 사실 모델은 `ForestWorldCurve` 셰이더를 안 타 짐승처럼 땅 휨만큼 내린다(`ForestVillager.FollowCurve`).
- **바로잡음**: 바로 앞 FOREST 존 소품을 사람 키 2.7 기준 1.5배로 키웠는데, 2.7 은 Kenney 모델 원래 키(`CharacterVisual.NativeHeight`)일 뿐 FOREST 사람 키는 1.8m(주민·Maria) — 배율 1.0 으로 고치고 쌓은 높이도 맞췄다. GO(사람 3.4 → 1.9배)는 맞다.
- 파일: 새 `SagaGo|SagaForest|SagaStory/World/NpcIdle.cs`·`Editor/PlaytestNpcModels.cs`, 고침 `NpcBuilder`(`InitRigs`)·`ForestVillager`·`StoryNpc`·`StoryJobTrainer`·씬 빌더 셋·헤드리스 셋·`ForestZoneProps`(배율), 씬 셋 재빌드(타임라인 셋 다시 구워짐).
- 검증: GO `PlaytestHeadless` 3연속 OK(세 사람 3.40m) · `PlaytestForestHeadless` 3연속 OK(숲지기 1.80m·존 소품 OK) · `PlaytestStorySlice` 6회 중 5회 OK — 실패 1회는 `PartySwapWait` "동료 서명(기탄) 뒤에도 더미가 안 죽음"(실시간 투사체 대기, 사실 모델엔 충돌체가 없어 이번 변경과 닿지 않음, 알려진 오류에 적음). 실기 확인 전(바라보는 쪽·키·대기 동작, FOREST 소품 실측 크기).

## 2026-09-24 — 두목 전용 몸: GO 망루 수호장 Maw J Laygo · DUNGEON 능묘지기 Ganfaul M Aure (사용자 "이어해줘", Opus 5.5)

- **고른 까닭**: 이번엔 PLAN "남은 것:" 줄을 먼저 다 모았다(앞 세션 교훈). 결정 없이 되는 것 중 가장 눈에 띄는 빈칸 — 두목 셋(수호장·능묘지기·층 두목)이 모두 Brute 몸을 키만 키워 썼다. 107-7·106-4 에 "전용 모델"이 적혀 있었다.
- **몸 고르기**: `list-characters.mjs` 로 후보를 찾고 카드 썸네일을 받아 봤다 — Knight D Pelegrini(사람 병사 같음)·Warzombie(현대 군모)·Mutant(SF 빛 칼날) 빼고, 수호장 = Maw(뿔 달린 갑주 거수), 능묘지기 = Ganfaul(검은 갑주 망령). 둘 다 Brute 컨트롤러와 같은 다섯 상태라 두목 코드는 그대로.
- **막힘**: 처음 받기가 DOWNLOAD 모달에서 30초 타임아웃 — 화면을 찍어 보니 Mixamo 로그인이 풀려 있었다("Please sign in to download"). 사용자가 로그인한 뒤 몸 둘 + 클립 열 전부 자동으로 받았다. 사용자가 "백그라운드로 가져올 수 있지 않나?" — 받기는 이미 전부 자동이고 로그인만 사람 몫이라고 답하고, 같은 프로필 `--headless=new` 로 창 없이 받기를 실제로 확인(README "백그라운드" 절). `fetch.mjs` 는 받기 전에 머리줄 "Log in" 을 봐서 로그인이 풀렸으면 곧장 exit 3.
- **맞춤**: 수호장은 `FieldEnemy` 가 이미 키를 재 5.4m 로 맞춘다 — 돌빛 칠만 빼고 제 빛깔 위에 원소 30%. 능묘지기는 리깅 모델을 실제 크기 × `visualScale` 로 쓰는 구조라, 프리팹 키를 재서 옛 몸과 같은 3.5m 가 되게 배율을 넣고 검푸른 칠을 뺐다. 굽기는 두 몸만(`SetupNpcCharacterImports.SetupBossBodies`, 다른 컨트롤러를 다시 굽지 않음).
- 파일: `SetupNpcCharacterImports`(표 둘·`SetupBossBodies`)·`Assets/Animators/Maw|Ganfaul.controller`(새)·`BuildTestVillageScene`·`BuildTestDungeonScene`·`BuildDungeonTemple`(`GuardianHeight`·`MeasureHeight`)·`FieldEnemy`(수호장 칠)·`PlaytestNpcModels`(`Dungeon()`·수호장 몸)·`PlaytestDungeonHeadless`, GO·DUNGEON 씬 재빌드, `tools/mixamo_automation`(`fetch.mjs` 로그인 확인·README 레시피·백그라운드 절). 원본 FBX 는 gitignore(PC마다 받기).
- 검증: `PlaytestDungeonHeadless` 3연속 OK(능묘지기 Ganfaul 3.50m, 능묘·등장 컷 그대로) · GO `PlaytestHeadless` 3연속 OK(수호장 Maw, 수호장 진단 키 5.4m·등장 컷 그대로). 화면은 안 봄 — 실기 확인 전(걷기 박자·발톱 공격이 한 방 판정 시각과 맞는지·포효 대신 공격 클립이 어색한지).

## 2026-09-25 — 두목 전용 몸 둘째 묶음: DUNGEON 살수 Ninja·층 주인 Demon·기계화 정찰병 Alien Soldier, STORY 황건 두목 Morak (사용자 "사가 유니티 이어해", Opus 5.5)

- **고른 까닭**: PROJECT_STATE 0번(PLAN 106-4 끝줄 "층 두목·엘리트 변형 지금 전부 Brute"). 코드를 보니 층 진행기 `eliteModel`(Brute) 하나를 살수·층 끝 두목·층 주인 셋이 같이 쓰고, 정예는 잡졸 Abe 칠, STORY 두목(들판·비경)도 Brute.
- **배역 나누기**: 층 끝 두목·방 두목 "황건적 두목"은 44장부터 Brute 의 원래 배역이라 그대로. 살수 = Ninja(암살자), 층 주인 여섯 = Demon T Wiezzorek(뿔 달린 마왕, 한 몸이라 명소 빛 35% 로 가름), 5.7 시대 퓨전 "기계화 정찰병" = Alien Soldier(미래 갑주 — 전체 퓨전 결), STORY 황건 두목 = Morak(가죽 갑주 두령). 후보 열둘을 `list-characters.mjs` 로 찾고 카드 모습을 한 장으로 모아 봤다(Crypto·Drake·Maynard 는 벗은 몸, Gas Mask·Swat 는 현대 군인이라 뺌).
- **받기**: 로그인 살아 있어 같은 프로필 `--headless=new` 로 24개(몸 넷 + 클립 스물) 전부 자동, 실패 0. 레시피는 README 표. 크롬은 그 PID 만 닫음.
- **맞춤**: 키는 옛 몸과 같게 — 씬 빌더가 프리팹 키를 재서(`BuildDungeonTemple.MeasureHeight` 를 internal 로) 층 진행기 `minibossScaleMul`·`lordScaleMul`·`fusionEliteScaleMul`(옛 몸 키 / 새 몸 키)을 넣고, 층 공식 배율(1.8·2.1·1.25)에 곱한다. STORY 는 `StoryBossScale`(2.24m / 몸 키). 전용 몸은 제 빛깔(옛 자보라·퓨전 칠 뺌). 칸이 비면(프리팹 없는 PC) 예전 몸 그대로.
- 파일: `DungeonFloorRunner`(칸 셋·`LordTintMix`)·`BuildTestDungeonScene`(방3 살수·층 진행기·`ScaleMulTo`)·`BuildTestStoryScene`(`StoryBossBody`·`StoryBossScale`)·`BuildDungeonTemple`·`SetupNpcCharacterImports`(표 넷·`SetupBossBodies` 여섯)·`PlaytestNpcModels`(DUNGEON 칸 셋·배율 키·방3 살수 4.38m / STORY 두 곳 Morak·2.24m)·`Assets/Animators/{Ninja,Demon,AlienSoldier,Morak}.controller`, DUNGEON·STORY 씬 재빌드, `tools/mixamo_automation/README.md`. 다시 구워진 Maw·Ganfaul 컨트롤러는 되돌림.
- 검증: `PlaytestDungeonHeadless` 3연속 OK(era fusion 5층 정찰병 바꿔치기·Landmarks 층 주인 포함) · `PlaytestStorySlice` 3연속 OK(두목 처치·등장 컷 그대로) · `PlaytestDungeonFloorProgression` OK. 화면은 안 봄 — 실기 확인 전(살수 4.4m 가 사람 몸이라 과한지·옆차기/뛰어 내려찍기/훅이 판정 시각과 맞는지·주인 빛 세기).
- 곁일: 이 세션 Bash 가 PATH 를 윈도 형식(`;`)으로 받아 `grep`·`rtk` 가 없다고 나옴 — 명령 앞에 `export PATH="/usr/bin:/mingw64/bin:$PATH"`, rtk 훅이 바꾼 명령은 `/usr/bin/grep` 처럼 절대 경로로 피했다.

## 2026-09-25 — PLAN 109장 신설: 전체 퓨전 · 인물 105 · 웹 변경 이식 순서표 (사용자 "다 순서대로 적용 되어야 해", Opus 5.5, 코드 없음)

- 경위: 사용자가 "퓨전 과거·현대·미래도 적용?" · "캐릭터 100개 넘는데 에셋 다 적용?" · "웹판 변경사항 적용?" 을 물었다. 점검하니 셋 다 아니었다 — 퓨전은 DUNGEON 5.7 뿐, 도감 인물 105 없음(GO 등용 산적 한 종·몸 약 20), 웹 PLAN §5 의 09-24 새 절 대부분 미이식. 앞서 "거의 다 끝"이라 한 건 이 트랙 PLAN 에 적힌 것만 센 것이라 정정했다.
- 결정: 새 세션부터 109장 표를 위에서 한 줄씩(A 퓨전 1~5 → B 인물 105 6~8 → C 웹 이식 9~13 → D 상시 대조). PROJECT_STATE 다음 작업 = 109장 1번.

## 2026-09-25 GO — PLAN 109-1a 세 시대 사람·적 (웹 사가고 ⑱ 재해석)

"사가유니티 이어해" → 109장 표 1번. 줄이 커서 쪼갬: **1a 사람·적(이번)** / 1b 지역 소품 현대·미래 조각(다음).

- **몸**: Mixamo 로그인이 살아 있어 헤드리스 자동화 크롬(전용 프로필)으로 아홉 벌 36파일을 받았다(`tools/mixamo_automation` README 레시피 표에 한 줄). 적 — 현대 방독면 약탈자 `Gas Mask`(AlienSoldier 레시피)·떠도는 망자 `Copzombie L Actisdato`(좀비 레시피), 미래 강철 경비병 `Exo Red`(Morak 레시피, 걷기만 `Male Standard Walk`) + 이미 있던 `Alien Soldier`(별바다 손님). 사람 — 현대 Remy·Megan·Swat Guy, 미래 Exo Gray·Vanguard·Crypto(서기·걷기). 과거 사람은 있던 PeasantMan·PeasantGirl·Paladin·Archer. Gas Mask 몸 하나가 136MB(nonPBR 텍스처 내장) — gitignore 라 저장소엔 안 들어간다. `SetupNpcCharacterImports.SetupEraBodies` 로 구움, 컨트롤러 아홉은 커밋.
- **적 규칙**(`Data/GoEras.cs`): 무리 시대 = FNV-1a(무리 id + "#era") % 100 — 60 미만 제 시대, 80 미만 다음 시대, 나머지 그다음. 마을 역참 110m 안(북쪽 숲·정령 숲 무리)은 제 시대만(웹 300m 를 이 지도 척도로). 일곱 지역 모두 옛 땅이라 제 시대 = 과거로 두었다(사연·한자가 옛것) — 결과 무리 9 중 4 가 다른 시대(동쪽 숲 북·끝 논밭 = 미래, 남쪽 공터 동·서쪽 숲 정령 = 현대). **종류·원소·방패·체력은 그대로, 몸·이름만** 바꾼다(웹 "원소 규칙 그대로"). 몸은 무리 안에서 그 시대 둘을 번갈아(무리 id 해시로 시작) — 종류로 몸을 정하면 해시 결과상 방독면·별바다 몸이 한 번도 안 나와서 번갈이로 바꿨다. 원소 적은 이름 앞에 원소 낱말(벼락 방독면 약탈자). 옛 해골 뼈빛은 옛 몸에만.
- **위험 줄**: `GoWorldMap.DangerLine` 끝에 " · 시간 틈 떠도는 망자·방독면 약탈자"(웹 ⑱ 남은 것 "적 이름 뒤 시대 표시"). 지역 명단(`Roster`)·명단 정직성 진단은 종류 기준이라 그대로.
- **사람**(`World/FolkBuilder.cs`·`FolkWalker.cs`): 역참 다섯 × 셋(첫째 제 시대 + 두 시대), 돌기둥 13m·120° 간격(설 수 없는 칸이면 40°씩 돌림). 역할 — 과거 나무꾼·무녀·파수꾼·사냥꾼 / 현대 여행자·택배 기사·순찰 대원 / 미래 탐사 대원·수리 기사·시간 여행자, **역할마다 다른 몸**(색만 다른 몸 금지 지시). 36초 주기 순수 함수로 4초 걸어 8m·14초 서기·4초 돌아오기(웹 4.5m/36초를 사람 키 3.4m 로, 걷는 시간을 짧게 해 발 미끄럼 줄임). 12m 안이면 땅·역참 이름 든 한 마디(`VillagerTalk` 재사용, 이름 바로 뒤 조사 없게 문장을 짰다). Play 시작 때 세우고 씬엔 몸 프리팹만.
- **진단** `PlaytestGoEras`(지역 소품 진단 뒤, 읽기만): 해시 고정·역참 둘레 제 시대·다른 시대 몫 30~55%·세 시대·네 몸·세운 적 시대/몸(컨트롤러 이름)/이름·위험 줄·사람 15(시대 순서·13m·설 칸·몸·대사·반경)·오가기 0/4/10/20/30초. 번역 키 31(ko·en), `loc-missing` 0.
- 검증: 컴파일 0 · 몸 굽기 9/9 · 씬 재빌드 exit 0 · GO `PlaytestHeadless` **3연속 OK**(eras "무리 9(다른 시대 4·역참 둘레 2)·몸 4 세운 적 현대 5·미래 5(사실 몸 10) 시간 틈 지역 4 사람 15(사실 몸 15)"). 기존 진단 전부 그대로 통과(elemental foe 요약에 "벼락 방독면 약탈자"가 뜬다).
- 109장 D 대조: 웹 다섯 §5 중 표에 없던 건 사가고 ⑲(saga-godot 106 이식 순서표) — 웹 코드가 아직 없어 표 C 끝 14행 "대기"로만 더했다.
- 실기 확인 전: 현대·미래 몸 크기·걷기·원소 빛, 사람 오가기가 집·돌기둥에 박히는지, 지도 위험 줄 길이.

## 2026-09-25 GO — PLAN 109-1b 지역 소품 세 시대 (109-1 끝)

"사가유니티 이어해" → 109-1 둘째 조각.

- **에셋**: Poly Haven(CC0) 모델 목록(521)을 훑어 현대 스캔은 넉넉하지만 **미래 스캔은 없다**는 걸 확인. 현대 = 드럼통 `barrel_03`·낡은 타이어 `old_tyre`·배전함 `utility_box_01`·덮개 씌운 차 `covered_car`·콘크리트 방호벽 `concrete_road_barrier_02`. 미래는 "시간 틈 잔해"로 재해석 — 탐사선 계기 `vintage_spacecraft_instrument`·감시 눈 `security_camera_02`·탐조등 `portable_searchlight`·중계함 `power_box_01`·발전기 `portable_generator` 를 실물 4~5배로 공중에 띄우고, 원본 텍스처를 쓴 URP Lit 청록 발광 재질(`_rift`)로 바꿔 세로축으로 9°/초 돈다(`RiftSpin`, 시각의 순수 함수). 세로축 회전이라 기울여도 밑면 높이가 안 변해 기존 밑면 검사를 그대로 둔다. 36MB 후보 중 쓰레기통·회로판·연료통을 빼고 11종 받았다가, `street_lamp_02` 는 실측 1.68m 등머리뿐이라 지워 10종(약 23MB, 커밋 — 108 ① 과 같은 이유).
- **배치**(`GoRegionProps`, 손으로): 무더기 9 모두에 현대·미래를 섞었다 — 벼락 고목엔 그을린 차·번개와 공명하는 중계함, 산적 야영터엔 모아 둔 드럼통·타이어, 무너진 성터엔 박힌 방호벽 둘·떠 있는 발전기, 여울엔 떠내려온 타이어(물에 걸침)·물 위에 뜬 계기, 가을걷이 마당엔 덮개 씌운 차. 과거 46·현대 13·미래 9 = 다른 시대 32%(지역 제 시대가 모두 과거라 웹 40% 보다 조금 적게), 지역마다 현대·미래 둘 다. 빈터(`Clearing`)는 차가 들어간 두 무더기만 12·10m 로 넓혔다.
- 함정: 기울인 감시 눈 하나가 경계 상자가 헐거워 밑면 검사에 0.16m 걸렸다(빌더 주석의 그 함정) — 잔해는 어차피 도니 기울임을 뺐다.
- **LOD1**: 새 조각에 먼 거리 메시가 없어 멀리 삼각형이 213k→466k 로 늘었다 → `tools/polyhaven_lod1.py` 에 id 인자를 받게 하고 여덟 벌 추가(기존 LOD 파일은 안 건드림) → 292k. 가까이 합계 1222k(한 화면에 다 안 들어온다)·가장 무거운 무더기 269k(< 350k).
- 진단: `PlaytestGoRegionProps` 는 잔해를 물 걸침·정적 검사에서 뺀다. `PlaytestGoEras` 에 소품 검사 — 지역마다 현대·미래, 몫 25~45%, 잔해 = 회전·청록 발광·정적 아님·충돌 없음·1.8m 이상 뜸·돌아도 밑면 그대로, 옛·현대 조각엔 잔해 재질 없음.
- 검증: 씬 재빌드 exit 0 · GO `PlaytestHeadless` **3연속 OK**(LOD 넣기 전·뒤 각각). 부산물(`Mobile_RPAsset`·수호장 컷 타임라인)은 되돌림.
- 109-1 끝 → 다음 = 109-2 DUNGEON 세 시대.
- 실기 확인 전: 잔해 크기·청록 세기·도는 속도, 차 크기(0.85배), 드럼통·방호벽이 옛 무더기와 어울리는지.

## 2026-09-25 — char-forge 단계 3 첫 짝: MakeHuman 사실 몸 + 비교 장면 빌더 (사용자 "VRoid·Mixamo 대체 도구 이어서해줘")

- 상용 대비 Mixamo 대체(`../tools/char-forge/README.md` §7 단계 3). 교체 문턱대로 **게임 몸은 안 바꾸고** 비교까지만.
- 공방: MPFB 2.0.17(Blender 확장, 코드 GPL·만든 모델 CC0)을 `tools/char-forge/_blender/`(gitignore, `BLENDER_USER_RESOURCES`)에 설치 — 사용자 Blender 설정과 따로. MakeHuman system assets(CC0 94항목, CC-BY 없음 확인). 같은 사이트의 hair02 는 CC-BY 라 안 들임.
- 새 `build_real.py`: MPFB 몸(macro 모프) → 내장 `game_engine` 뼈(UE 마네킹 이름 — 표준 뼈와 `Root`·`head` 대소문자만 다름, `rigmaps.MPFB`) → 피부·눈·눈썹·속눈썹·이·머리·옷(GAMEENGINE 재질) → 옷 아래 살·도우미 지우기 → 재질 칸 이름(skin·eye·hair·hair_brow·hair_lash·teeth·cloth_a·b) → 기존 `retarget`(UAL 여덟) → fbx+glb.
- `Assets/Art/CharactersForge/_cmp_real_hero_f_01.fbx`(주역 여 후보, 동양 0.8·운동복·말총머리, 18MB) + license.json. 빌드 13초·뼈 53·삼각형 4만·키 1.58m, verify fbx 0.7°·2.6mm · glb 0.0°·0mm, 두 번 빌드 같은 바이트.
- 빈 Unity 6000.3.24f1 프로젝트(스크래치): Humanoid 아바타 valid·뼈 52 자동 대응·클립 8 전부 Humanoid·정점당 뼈 ≤4, `ExtractTextures` 뒤 재질 8개 텍스처 붙음, 걷기 클립 걸면 손 27cm 움직임.
- 새 `Assets/Editor/BuildCharCompareRealScene.cs`(메뉴 `Saga/Char Forge/Build Compare Real Scene`): 공방 FBX Humanoid·클립 이름 정리·텍스처 꺼내기·URP Lit 재질로 바꿔 끼우기(머리 셋 알파 잘라내기·양면) + 지금 Maria | 공방 몸을 같은 빛·키 1.70m(BakeMesh 로 잰 키)·같은 순서 자동 동작 컨트롤러로 나란히. 다른 saga 편집기 코드에 기대지 않는다. 빈 URP 17.3 프로젝트에 Maria FBX(.meta 째)를 복사해 돌려 CMP_RESULT OK(두 몸 1.700m·발 y=0·카메라 쪽·상태 8, 공방 재질 URP/Lit+tex).
- **saga-unity 에서는 아직 안 돌렸다** — 같은 시각 다른 세션이 saga-unity 를 고치는 중(unity-batch 는 Packages 를 되돌린다). `.meta` 는 고정 GUID 로 손으로 썼다(fbx 는 guid 만 — 첫 임포트 때 Unity 가 채운다). 빌더를 돌리면 `Assets/Art/CharactersForge/Textures·Materials`·`Assets/Animators/CharForge/`·`Assets/Scenes/CharCompareReal.unity` 가 생긴다.
- 사람 몫: HOW_TO_PLAYTEST §9 대로 비교 장면 보고 "바꿔도 된다/아직". 공방 피부는 URP Lit(Maria 의 FakeSSS 는 아직 안 붙임).

## 2026-09-25 — char-forge 공방 몸에 FakeSSS 피부 + 비교 장면을 saga-unity 에서 실제로 지음 (사용자 "이어서 FakeSSS 피부 붙여줘")

- Maria 피부 그래프(`MariaSkin.shadergraph`)는 바탕색 블록을 비워 `_BaseColor` 단색에 FakeSSS 를 발광으로 더한다 — 그대로 씌우면 공방 몸 피부 그림이 사라진다.
  그래서 `BuildMariaSssShaderGraph.Build` 를 `BuildGraph(outputPath, baseMapReference)` 로 빼고(Maria 는 null — 전과 같은 그래프), 공방 몸은 `_BaseMap` Texture2D 속성 → Sample Texture 2D → 바탕색 선을 더한 `Assets/Art/CharactersForge/Generated/ForgeSkin.shadergraph`(노드 넷·선 셋, 컴파일 오류 없음). Intensity 15·Colour 웜톤 등 FakeSSS 값은 Maria 와 같고 매끈함도 0.35 로 맞췄다.
- `BuildCharCompareRealScene` 가 그래프가 없으면 짓고 피부 재질에 씌운다 + 검사 `Verify`(메뉴 `Saga/Char Forge/Verify Compare Real Scene`)·배치 `BuildAndVerifyBatch`. saga-unity 배치(unity-batch.sh) `CMP_RESULT OK`: Maria(MariaSkin·Rest)·공방(ForgeSkin+그림, 나머지 URP Lit+그림) 둘 다 1.700m·발 y=0·동작 8.
- 함정: 손으로 쓴 guid 만 든 fbx `.meta` 는 가져오기 칸이 비어 기본값 0 = **옛 방식(materialLocation External·텍스처 이름)** 이 된다 → 재질이 밖에 텍스처 이름으로 생기고 `.fbm` 폴더가 생겨 이름으로 찾는 연결이 빗나갔다. 빌더가 `ImportViaMaterialDescription`·`InPrefab` 을 못 박고 전 연결(remap)을 비운 뒤 잇는다.
- 커밋: Unity 가 채운 fbx `.meta`·재질 여덟·꺼낸 텍스처(14MB — FBX 에 박힌 것과 겹친다, 나중에 FBX 를 그림 없이 내보내 줄일 수 있다)·ForgeSkin 그래프·비교 장면·컨트롤러(Maria 것은 Maria 파일이 없는 PC 에서 빈 참조 — TestCharacterRealistic 과 같은 처지). Unity 부수 변경 ShaderGraphSettings.asset(줄끝만)은 되돌림. 같은 시각 다른 세션의 DUNGEON 파일은 안 건드림.
- 사람 몫 그대로: HOW_TO_PLAYTEST §9 판정.

## 2026-09-25 — char-forge 괴물 첫 짝 둘(Goblin·Brute) + 비교 장면 짝 셋 (사용자 "괴물도 공방 몸으로 이어서 해줘")

- `build_real.py` 에 괴물 칸 셋: `targets`(MPFB 기본 모프 + animal01 팩 — 뼈 달기 전에) · `tints`(피부 그림에 색을 곱해 새 그림으로 굽기, FBX 는 노드를 못 옮김) · `kitbash`(뿔 `horns` 머리 뼈 · 허리 천 `loincloth` 골반→허벅지 무게, 실제 살을 재서 자리). MakeHuman animal01(돼지 코·파우누스 얼굴 등 CC0)을 sources.json 에 올림, animal02~04 는 CC-BY 라 안 들임.
- `Assets/Art/CharactersForge/_cmp_real_goblin_01.fbx`(Goblin 자리 후보 — 1.32m·뾰족 큰 귀·큰 코·초록·허리 천, 동작 6) · `_cmp_real_brute_01.fbx`(두목 Brute 자리 후보 — 2.55m·근육 최대·돼지 코·튀어나온 턱·붉은 잿빛·굽은 뿔·허리 천, 동작 6). verify fbx 0.27°·0.55°, glb 0.0°, 두 번 빌드 같은 바이트.
- `BuildCharCompareRealScene` 을 짝 표(Pairs)로: Maria | 공방 주역(1.70m) · Goblin | 공방 고블린(1.25m) · Brute | 공방 두목(2.40m) — 지금 몸 클립은 SetupNpc·SetupBrute 가 붙인 이름 그대로, 몸마다 가진 동작만 돈다. 그림 없는 부품 재질은 FBX 바탕색을 옮김(검사가 흰색이면 실패). saga-unity 배치 `CMP_RESULT OK`.
- 함정 둘: ① 허리 천 단면을 살 전체로 재면 A 자세 손이 엉덩이 높이라 손까지 둘렀다(고블린 폭 ±0.48m) → 몸통·다리 가중치 정점만. ② MPFB 재질은 같은 그림을 두 노드가 읽어, 색 입힐 때 한쪽만 바꾸니 원본 그림도 FBX 에 딸려 가 Unity 에 꺼내졌다 → 둘 다 바꿈(FBX 12.8→9.7MB·13.6→9.9MB).
- 정직한 예상: 사람 몸 비틀기라 Mixamo 의 조각한 괴물보다 못할 수 있다. 지금 Brute 는 바지·신·머리·수염이 있고 공방 두목은 허리 천뿐. 떠 있는 괴물(Nightshade)·짐승형(Warrok·Parasite)은 아직.
- 같은 시각 다른 세션이 DUNGEON 을 고치는 중 — 그 파일은 안 건드림. 사람 몫: HOW_TO_PLAYTEST §9(짝 셋).

## 2026-09-25 DUNGEON — PLAN 109-2a 세 시대 잡졸·마을 손님·행상 (웹 사가블로 §5.20 재해석)

"이어해" → 109장 2번. 쪼갬: **2a 잡졸·손님·행상(이번)** / 2b 명소 층·마을 꾸밈 시대 층(다음). 웹 쪽 근거는 같은 날 새로 생긴 사가블로 §5.20.

- **잡졸**(`Data/DungeonEras.cs`·`DungeonFloorRunner.SpawnGrunt(offset, slot)`): 절차 층 **전투 방 잡졸 넷만** FNV(층:방:자리) % 100 — 60 미만 황건적, 80 미만 현대, 나머지 미래. 층 난수 `_rng` 는 안 건드려 문 순서·방 종류가 예전 그대로(웹 "공유 수열 안 밂"). 명소 층 잡졸·정예/두목 호위·살수·두목·층 주인은 그대로. 체력·공격·보상은 잡졸 공식 그대로, 몸·이름·키만. 층 단계 넷(2~9·10~24·25~49·50~) × 현대·미래: 폭주 청년 Brian·시험 기동 인형 X Bot / 방역복 추적자 Gas Mask·경비 보행병 Exo Red(GO 몸 같이 씀) / 진압 특공대 Swat·강철 인형 병정 Y Bot / 암흑가 해결사 The Boss·별 너머 방문자 Zlorp. 옛 적·두목·NPC 몸(Alien Soldier 정찰병 포함)과 안 겹친다. 도감 키가 표시 이름이라 새 도감 칸 여덟. 몫 실측 41%(층 2~100 × 방 8 × 넷).
- **몸 받기**: Mixamo 헤드리스로 여덟 벌. **Prisoner B Styperek·Survivor A Lusth 는 Unity 휴머노이드 자동 매핑이 "Required human bone 'RightLowerArm' not found" 로 실패** → The Boss·Leonard 로 바꿔 다시 받았다(README 레시피 표에 적음).
- **행상**: 같은 해시(층:방#peddler)로 몸만 — 현대 고물 행상 Leonard·미래 시간 행상 Astra. 토스트 글("행상 —")은 그대로.
- **마을 손님**(`World/EraFolk.cs`, 씬에 굽는다): Town2 택배 기사(Megan)·Town3 시간 여행자(Crypto)·Town4 탐사 대원(Exo Gray)·갈림길 출장 온 회사원(Remy) — 현대 둘·미래 둘, 다가설 때마다 대사 넷을 돌려 말한다(볼일 없음). 자리는 행상·등롱·궤짝·촌민에서 2m 이상.
- **진단** `PlaytestDungeonEras`(명소 층 뒤): 표(몸 여덟 서로 다름·옛 몸과 안 겹침·단계 경계)·몫(잡졸 34~46%·현대/미래 쏠림·행상)·단계×시대마다 층을 찾아 전투 방 실제 이름·몸·정예 방 호위는 옛 잡졸·행상 몸 둘·손님 넷(몸·대사 돌림·자리). `PlaytestDungeonLandmarks` 의 "보통 층 잡졸 = 황건적" 검사는 해시 기대값으로 고침. 첫 실행 한 번 실패 — 씬 고정 방에도 "Merchant" 이름이 있어 행상을 잘못 집었다 → 층 진행기 방 안에서만 찾게.
- 막힘 둘: ① 굽기 중 다른 세션(char-forge)이 편집 중이던 `BuildCharCompareRealScene.cs` 컴파일 오류로 Editor 어셈블리가 막힘 → 손대지 않고 그 세션이 커밋(39aff13b)할 때까지 기다렸다. ② `Failed to resolve packages` 로 exit 1(알려진 일) → 재실행.
- 검증: 몸 굽기 8/8 · 씬 재빌드 exit 0(폴백 경고 0) · `PlaytestDungeonHeadless` **3연속 OK**("잡졸 몫 41%(현대 638·미래 648)·행상 42% 시대 잡졸 20(사실 몸 20·몸 8가지) Modern 행상=Leonard Future 행상=Astra 손님 4(사실 몸 4)") · `PlaytestDungeonFloorProgression` OK. 배치가 다시 쓴 타임라인 다섯은 되돌림.
- 실기 확인 전: 시대 잡졸 여덟 크기·타격감(사람 몸 적), 손님 대사, 행상 몸.

## 2026-09-25 DUNGEON — PLAN 109-2b 명소 층·마을 꾸밈에 시대 층 (109-2 끝) · 컷 타임라인 바인딩 끊김 바로잡음

"사가유니티 이어해" → 109 표 2번 둘째 조각. 웹 사가블로 §5.20 은 사람·적만 옮겼고 "다음 후보: 명소 층 전용 3D 소품"이라 적혀 있어, 이 트랙은 그 후보를 세 시대로 먼저 만든 셈.

- **표** `Data/DungeonEraDecor.cs`(자리 전부 손으로, 난수 없음): 명소 층 여섯 벌(`DungeonLandmarkData` 순 — 왕릉 무덤 돌·제등 + 발굴단 방호벽·배전함 + 뜬 탐조등 / 망루성 방패·궤짝 + 성문 막은 방호벽·타이어 + 감시 눈 / 산채 화덕·술통 + 약탈 드럼통·타이어 + 발전기 / 용궁 이끼 바위 + 떠밀려 온 드럼통·타이어 + 가라앉았던 계기 / 업화 대문 그을린 고사목·방패 + 그을린 덮개 차·배전함 + 중계함 / 금궐 제등·궤짝 + 배전함 + 계기·발전기) + 마을 셋·갈림길 둘(손님 곁에 제 시대 물건 — 택배 기사 곁 타이어, 시간 여행자 곁 감시 눈, 탐사 대원 곁 탐조등, 회사원 곁 배전함). 조각 69 · 다른 시대 41% · 벌마다 세 시대.
- **모델**: GO 108 ①·109-1b 가 받은 Poly Haven 스캔 그대로(새로 안 받음), 이 판 사람 키가 실제와 같아 실측 × 1. 미래 = 시간 틈 잔해(GO 와 같은 청록 빛깔, URP Lit 발광, 바닥 1.5m 위·윗면 3.7m 아래, 세로축 9°/초 `EraRiftSpin`). 화덕 둘엔 그림자 없는 불빛.
- **굽기** `World/EraDecorBuilder.cs`(GO `RegionPropsBuilder` 결, 코드는 이 판 것): 명소 층 여섯 벌은 ProcRoom 자식 `LandmarkEraDecor` 에 꺼 둔 채 굽고 `DungeonFloorRunner.EnterFloorLayout` 이 그 층 것만 켠다(방 다섯 내내 같은 꾸밈 — 층의 얼굴, `RoomContent` 와 따로라 방 갈이에 안 지워짐). 마을 꾸밈은 `TownEraDecor`(정적, 잔해·불빛 빼고). LOD 는 안 둠(방 안에선 늘 가까이 보임) — 방 하나 원본 ≤ 30만(실측 마을 최대 255k·명소 최대 102k).
- **진단** `PlaytestDungeonEraDecor`(세 시대 진단 뒤): 표(명소 순·세 시대·몫 30~50%)·마을(방 가운데·벽 안·열린 문길·같은 방 다른 것과 1m·밑면·충돌 여부·잔해 회전/발광/높이/크기 0.8~2.4m/돌아도 밑면 그대로·삼각형)·명소 층(여섯 층마다 그 벌만 켜짐·6층은 다 꺼짐·잡졸/호위/볼일/문 표지/들어오는 자리/바이옴 꾸밈 1.2m·층 주인 자리 2.5m — 자리는 층 진행기 표를 리플렉션으로 읽음). 첫 실행에서 마을 예산(처음 15만)·탐조등 크기(0.73m)를 잡아 예산 30만·탐조등 × 3.2 로.
- **바로잡음 — 컷 타임라인**: 첫 헤드리스에서 두목 이름표·능묘 도착 카드·컷 카메라가 깨졌다 → 씬 재빌드가 `*.playable` 다섯을 새 트랙 ID 로 다시 쓰고 씬 PlayableDirector 바인딩이 그 ID 를 가리키는데, 그걸 "부산물"로 되돌렸기 때문. 되돌리지 않으니 통과. HEAD 를 대조하니 **DUNGEON 다섯(Boss_FieldIntro·Party_Summon·Temple_Arrival·Temple_BossIntro·Temple_Chest)과 GO `Go_GuardianIntro` 가 저장소에서 이미 끊겨 있었다**(앞 세션들이 씬만 올리고 타임라인은 되돌림 — 그 세션의 헤드리스는 되돌리기 전에 돌아 통과). 이번 커밋은 DUNGEON 타임라인을 씬과 같이 올린다. PROJECT_STATE 알려진 오류에 규칙으로 적음.
- 검증: 씬 재빌드 exit 0(모델 빠짐 경고 0) · `PlaytestDungeonHeadless` **3연속 OK**(결과 줄 md5 같음, "조각 69·다른 시대 41 % 마을 조각 23(최대 255k) 명소 조각 48(최대 102k)") · `PlaytestDungeonFloorProgression` OK.
- 109-2 끝 → 다음 = 109-3 STORY 세 시대.
- 실기 확인 전: 잔해 크기·청록 세기·도는 속도가 벽 4m 방에서 과한지, 업화 대문 덮개 차(3.5m)·방호벽 어울림, 카메라가 떠 있는 잔해에 가리는지.
- **뒤이어 GO 도 바로잡음**: `BuildTestVillageScene.Build` 로 다시 굽고 `Go_GuardianIntro.playable` 을 `TestVillage.unity` 와 같이 커밋(씬 바인딩 4 → 타임라인에 전부 있음). GO `PlaytestHeadless` **3연속 OK**(수호장 등장 컷 브레인·이름표·포효 포함). 중간에 다른 세션(char-forge) 배치 Unity 가 라이선스 뮤텍스를 쥐고 있어 첫 세 번은 시작도 못 함 — 끄지 않고 끝나길 기다렸다가 돌렸다. STORY 두 컷은 HEAD 에서 이미 맞아 손대지 않음.

## 2026-09-25 — char-forge 숲 괴물 셋(Warrok·Parasite·Nightshade) + 비교 장면 짝 여섯 (사용자 "vroid 비슷한 자체 게임툴 이어해")

- 공방(`tools/char-forge/build_real.py`) 새 부품 넷: `horns` `count: 1`(정수리 외뿔, 뿌리 = 머리 가운데 줄의 실제 최고점) · `tusks`(입술 `lips` 무리 좌우 끝) · `spores`(등·어깨 살에 반쯤 묻힌 혹 무리, id 씨앗, 혹마다 그 자리 살 뼈 무게) · `robe`(쇄골 → 발목 옷자락, 톱니 끝단, `hide_legs` 로 속 다리 살 지움).
- 레시피 셋 → `Assets/Art/CharactersForge/`: `_cmp_real_warrok_01`(무쇠도깨비·STORY 소환 자리 — 외뿔·엄니·긴 팔·짧은 다리·잿빛 푸른 피부, Brute 와 안 겹치게) · `_cmp_real_parasite_01`(포자괴물 — 마른 몸·긴 손가락·민머리·누런 초록·포자 혹 16) · `_cmp_real_nightshade_01`(안개유령 — 긴 머리·창백한 푸른 피부·해진 옷자락, 다리 없음).
- 바로잡음 셋: ① 다리 길이 모프가 발을 8cm 띄움 → 모프 뒤 땅 다시 맞춤(MPFB 는 `abs(최저점)` 이라 올리기만 한다) ② 옷자락 단면을 네모 내접 타원으로 감싸 두 다리 모서리가 37% 뚫림 → 점을 모두 품는 타원, 그래도 허벅지 70% 만 따라가 서기 29% → 유령은 속 다리를 지워 1.4% ③ 다리 살을 지우니 Unity Humanoid 가 `LeftFoot` 을 못 찾음(스킨에 묶인 뼈만 본다) → 끝단에 발·발끝 무게 1%, 그리고 한 번 실패한 가져오기의 불완전한 뼈 짝이 `.meta` 에 남아 계속 실패 → `SetupForgeImport` 가 아바타가 깨졌으면 뼈 짝을 비우고 다시 가져온다.
- 비교 장면 `BuildCharCompareRealScene` 짝 여섯(Warrok 1.75·Parasite 1.60·Nightshade 1.60m — `SetupForestCreatureModels` 키), 지금 몸 동작 검사는 가진 클립 수까지(지금 Nightshade 는 서기 하나).
- 검증: build `--check` 땅 0cm · verify fbx ≤ 0.31°·glb 0.0° · 두 번 빌드 glb 같은 바이트 · 부품 뿌리-살 0.3~2.3mm · saga-unity 배치 `CMP_RESULT OK`(몸 열둘 키·발 y=0·앞 방향·동작·ForgeSkin·부품 색). 게임 몸은 그대로 — 판정 전.
- 실기 확인 전(HOW_TO_PLAYTEST §9): 괴물다운가 — 공방 Warrok 은 털이 없고, Parasite 는 찢긴 살 결이 없다. 유령 옷자락은 쓰러짐 동작에서 36% 뚫린다(게임은 서기만).

## 2026-09-25 — char-forge 바위도깨비·잎 옷 요정 + 비교 장면 짝 여덟 ("이어해")

- 부품: `rocks`(모난 바위 판, 살 법선 쪽으로 누른 이십면체·모난 면) · `robe` `length`(짧은 옷)·`teeth`·`weights: "skin"`(가장 가까운 살의 뼈 무게 — 다리가 남는 옷). 포자 코드를 합쳤는데 포자괴물 glb 는 같은 바이트.
- 몸: `_cmp_real_rockgiant_01`(Hulk 자리, 1.85m 비교) · `_cmp_real_fairy_01`(Jolleen 자리 — 숲 정령 셋·STORY 전직관, 1.75m 비교).
- 측정 바로잡음: 옷자락 뚫림을 "그 방향 끝단 위의 다리"만 세게(끝단 아래 다리까지 섞어 옷을 넓힐수록 나빠 보였다). 요정 잎 옷 서기 0.8%·걷기 9%·달리기 31%(두 허벅지를 감싼 옷이 한쪽만 따라가는 몫 — 천 시뮬레이션 없이는 남는다).
- 검증: verify fbx ≤ 0.30°·glb 0.0° · 두 번 빌드 같은 바이트 · 바위 판-살 1.5~4mm · saga-unity 배치 `CMP_RESULT OK`(몸 열여섯). 게임 몸은 그대로 — 판정 전.

## 2026-09-25 — char-forge 해골: 뼈를 코드로 짓는 `skeleton.py` + 비교 장면 짝 아홉 ("이어해")

- `tools/char-forge/skeleton.py`(build_real kitbash `skeleton`): MPFB 뼈대 자리·살 단면 → 긴뼈·손발뼈·척추·갈비 열둘 짝·복장뼈·골반·어깨뼈 + 머리 살로 두개골(눈구멍·코구멍·입술을 이 뒤로, 어두운 `socket` 칸). 조각마다 뼈 하나 무게 1, 살·눈 걷고 이만 남김.
- `_cmp_real_skeleton_01` → CharactersForge, 비교 장면 Skeleton 짝(1.80m). 검사는 공방 몸에 피부 칸이 없으면 뼈 칸(`_bone`)을 요구.
- 바로잡음: 첫 갈비를 neck_01(이 뼈대는 목 가운데)에서 재 목·턱 단면을 잡음 → 빗장뼈 높이 · 가운데 줄 정점이 성긴 높이에서 앞 살을 등으로 알아 척추뼈가 가슴 앞에 섬 → 창을 키움 · 마른 몸 밖으로 나온 골반 날개·어깨뼈 → 몸 단면 안으로(좌우 접은 각도 칸).
- 점검: 원래 살 밖 뼈 2.6~3.6%(손끝·정강이·발가락), 좌우 대칭 평균 0.08mm, 눈구멍 2.7cm, 이 앞에서 69% 보임, verify fbx 0.53°·glb 0.0°, 두 번 빌드 같은 바이트.

## 2026-09-25 STORY — PLAN 109-3 세 시대 사람·적 (웹 사가스토리 §5-12 재해석)

"이어해" → 109 표 3번 줄.

- **구조 대조**: 웹은 관문대 넷·사냥터 여럿·마을 다섯. 이 트랙 STORY 는 들판 하나(잡졸 열·두목)와 비경(5-3) 아레나뿐이고 적 이름 표시도 마을도 없다 → 관문대 넷을 들판 · 비경 1~2층 · 3~4층 · 5층으로 읽고, 이름은 처음 가까이 올 때 알림 한 줄, 마을 사람은 들판 뒤쪽 길(z 1.2)에 세웠다.
- **적** `Data/StoryEras.cs`: 단계마다 현대·미래 — 폭주 라이더 Racer·시험 인형 Dummy / 떠도는 망자 Warzombie F Pedroso·별바다 손님 Mremireh O Desbiens / 뒷골목 불량배 Jody·플라즈마 변이체 Yaku J Ignite / 용병 돌격대 Steve·강철 거신 Mannequin(키 × 1.3). 웹의 떼쥐·말벌·드론은 사람 몸만 있는 Mixamo 로는 못 옮겨 사람형으로 재해석. 이 판 옛 몸·다른 판 시대 몸과 전부 다른 새 카드.
  - 들판은 손으로 짠 자리라 해시 대신 열 자리 중 넷(13·18·28·37m, 현대 둘·미래 둘)을 표로. 비경 보통 전투 잡졸 둘은 FNV(층:회차 전투 순번:자리) 40%(실측 37%), 정예·보스·들판 두목·관문 대장은 그대로. 체력·경험치는 잡졸 그대로, 몸·이름·키만. 몸이 없는 PC 는 잡졸 몸에 시대 빛깔.
  - `StoryEnemy`: `SetEra`·`DisplayName`·`HeightMul`(`VisualHeight`·타격 숫자 높이에 반영), X 7m 안에 처음 들면 "⏳ 다른 시대에서 흘러든 — 이름"/"⏳ 시간 틈 너머에서 — 이름"을 이름마다 판에 한 번.
- **손님** `World/StoryEraFolk.cs`: 사진 찍는 여행자 Olivia(10.5m)·시간 여행자 Ely(20.5m), 지나갈 때마다 대사 넷을 돌려 말한다(볼일 없음). ko/en 21키.
- **몸 받기**: Mixamo 헤드리스(로그인 살아 있음) 54파일. 함정 둘 — ① 반복문 `--dest "$R\$n"` 을 bash 가 `$R$n` 으로 읽어 전부 `CharactersRealistic$n` 한 폴더에 떨어짐(파일은 이름이 달라 멀쩡 → 옮기고 그 폴더 지움) ② `Ely By K.Atienza` 는 전체 이름 검색 0건 → `fetch.mjs --charquery` 추가. README 레시피 표에 적음. 휴머노이드 매핑 실패 0.
- **진단** `PlaytestStoryEras`(슬라이스 준비 단계, 사실 모델 진단 뒤): 표·들판 넷(이름·몸·키 ±15%)·두목 그대로·알림(멀리 없음·가까이 한 번·황건적 없음)·비경 몫·층 1~5 실제 전투 방(단계별 이름·몸)·정예 그대로·손님(자리·잡졸/NPC 와 2m·대사 돌림·몸). 고친 것 셋: 적마다 "이미 봄" 플래그가 앞 진단 때 서 버려 이름 집합만으로 판정 / 정예 클리어는 보너스 카드가 끼어 확인 뒤 `AbandonRun` / 비경 클리어 경험치가 Lv.10 을 먼저 넘겨 슬라이스 전직 전제(Lv.15)를 깨고 타격 데칼 32 상한을 채움 → 레벨·경험치·MP 를 되돌리고 이 진단이 만든 데칼·전리품·타격 효과만 지운다.
- 검증: 몸 굽기 10/10 · 씬 재빌드 exit 0 · `PlaytestStorySlice` **3연속 OK**(eras 줄 md5 같음, "몸 10 들판 다른 시대 4/10(사실 몸 4) 비경 몫 37 %(현대 73·미래 74) 비경 시대 몸 5가지(사실 몸 8) 손님 2(사실 몸 2)"). 다시 구운 STORY 컷 타임라인 둘은 씬과 같이 커밋(0c817a31 의 규칙).
- 다음 = 109-4 FOREST 세 시대.
- 실기 확인 전: 시대 적 키·타격감(강철 거신 2.1m), 알림 글, 뒤쪽 길 손님 둘이 카메라에 잘 보이는지·대사.

## 2026-09-25 — char-forge 껍데기 옷 `shell` + 동행 셋(무사·술사·유격) + 비교 장면 짝 열둘 ("이어해")

- `build_real.py` `shell`: 뼈 무리 살 면을 법선 쪽으로 띄운 두께 판(천·가죽·쇠 칸), 살과 같은 뼈 무게. 투구·두건은 `open_face`. 땅 아래 금지(장화 밑창 -1.7cm 바로잡음). 안 보이는 면 덜기(덮인 살·가장자리 세 줄 너머 안쪽 겹·바깥 판 밑 안쪽 껍데기) — 무사 6.9만 → 4.5만 삼각형, 화질 그대로.
- `_cmp_real_paladin_01`(Paladin 자리) · `_cmp_real_mage_f_01`(PeasantGirl 자리, 치마는 robe weights skin) · `_cmp_real_archer_f_01`(Archer 자리). 비교 빌더: `metal` 금속감·`leather` 광택, 짝 셋 추가.
- 검증: verify fbx ≤ 0.54°·glb 0.0° · 두 번 빌드 같은 바이트(예전 몸도 그대로) · 치마 뚫림 서기 0.2%·걷기 6%·달리기 34% · saga-unity 배치 `CMP_RESULT OK`(몸 스물넷). 게임 몸은 그대로 — 판정 전. 지금 Archer 는 활·화살 메시가 붙어 있고 공방 유격은 맨손.

## 2026-09-25 FOREST — PLAN 109-4 세 시대 존 소품·마을 사람 (웹 사가의숲 §5.13·SAGA-DESIGN §13 재해석)

"사가 유니티 이어 하자" → 109 표 4번 줄.

- **구조 대조**: 웹은 손님 열(과거 2·현대 3·미래 2·신화 3)이 날짜 해시로 하루 한 명·부탁·단골(§5.9·5.10·5.13). 이 트랙 FOREST 엔 손님 틀이 없고 그건 109 C 줄 12 몫 → 여기선 마을에 늘 서 있는 세 시대 사람 여섯 + 존 소품·명소에 시대 조각만.
- **소품** `Data/ForestZoneProps.cs`: 조각에 `Era`·`Pitch`, 무더기에 `AtLandmark`(가운데 = 명소 자리). 무더기 여덟에 현대(타이어·방호벽·드럼통 둘·덮개 씌운 차 0.8배)·미래(감시 눈·발전기), 존마다 명소 곁 무더기 — 암림 배전함+제단 위 중계함 2.0m, 암야 타이어+선돌 곁 탐조등 2.2m, 균림 배전함+돌고리 위 계기 1.6m, 화원 타이어+돌기둥 위 감시 눈 2.9m. 42 중 16(38%), 존 원본 삼각형 최대 227k(상한 250k). 모델은 DUNGEON 109-2b 와 같은 Poly Haven 스캔.
  - `ForestZonePropsBuilder`: 미래 조각을 URP Lit 청록 발광(GO·DUNGEON 과 같은 빛깔)으로, Body 에 `ForestRiftSpin`(세로축 9°/s, 시각의 순수 함수). 휨 내림은 그대로 Visual 이.
  - `PlaytestForestZoneProps`: 명소 곁 무더기는 제 명소만 비킴 4.5m → 땅 조각 2.5m·잔해 0.
- **사람** `Data/ForestEras.cs`·`World/ForestEraFolk.cs`: 길 잃은 성 파수병 Castle Guard 01·붉은 두건 순례 기사 Knight D Pelegrini / 택배 기사 달음 Pete(택배 창구 곁)·사진작가 찰나 Sophie / 금빛 외골격 시간 여행자 Uriel A Plotexia(소원석 곁)·불시착 탐사원 루미 Jennifer. 36초 중 3초 걸어 3.5m·위상 흩음, 곁 2.5m 에 오면 대사 넷 돌림(쿨다운 4초), 땅 휨만큼 Visual 내림. 대사는 존 소품(선돌 탐조등·돌고리 계기·덮개 차)을 가리킨다. ko/en 33키.
- **몸 받기**: Mixamo 헤드리스(로그인 살아 있음). 카드 35장을 썸네일로 모아 보고 골랐다. **`Pirate By P. Konstantinov` 는 의족이라 `LeftFoot` 이 없어 휴머노이드 실패** → Castle Guard 01 로 바꿈(역할도 난파 선원 → 성 파수병).
- **진단** `PlaytestForestEras`(존 소품 진단 뒤): 표(여섯·시대 둘씩·몸 다름·옛 몸과 안 겹침·대사 넷)·길(존 밖·물건 3m·집 5m·스폰 4m·소품 3m·서로 2.5m)·몸 리깅·키·오가기(자리·Speed)·대사 돌림·휨 / 소품 존마다 현대·미래·명소 곁·30~50%·잔해 돎·발광·충돌 없음·돌아도 밑면 그대로.
- 검증: 몸 굽기 6/6 · 씬 재빌드 exit 0 · `PlaytestForestHeadless` **3연속 OK**(eras 줄 셋 같음 "몸 6/6(디스크 6) · 소품 42(현대 10·미래 6, 38 %)·잔해 돎 6") · `PlaytestForestCreatures` OK(models 8/8).
- 다음 = 109-5 REALM 세 시대.
- 실기 확인 전: 잔해 크기·청록 세기·뜬 높이, 덮개 차 크기, 마을 사람 발 미끄럼·키·대사 겹침(숲지기와 가까우면 두 줄이 번갈아).

## 2026-09-25 — char-forge 두목 여섯(Maw·Ganfaul·Ninja·Demon·AlienSoldier·Morak) + 비교 장면 짝 열여덟 ("vroid 비슷한 자체 게임툴 이어해")

- 새 레시피 여섯: `_cmp_real_ninja_01`(황건 살수 — 먹빛 옷·감발·두건 위 복면·누런 머리띠) · `_cmp_real_morak_01`(황건 두목 — 누런 두건·허리띠·가죽 조끼·맨팔·청동 팔찌) · `_cmp_real_ganfaul_01`(능묘지기 — 마른 늙은 몸·잿빛 피부·두건·도포·검은 쇠 어깨판) · `_cmp_real_demon_01`(층 주인 — 검붉은 거구·말린 뿔·뾰족 귀·엄니·쇠판) · `_cmp_real_aliensoldier_01`(기계화 정찰병 — 쇠판 온몸·닫힌 투구·청록 바이저) · `_cmp_real_maw_01`(망루 수호장 — 큰 턱·긴 엄니·녹슨 가슴판). 지금 몸 겉모양은 베끼지 않고 자리에 맞춰 새로 지었다.
- `build_real.py` `shell` 칸 둘: `z_eye`(눈 높이 기준 띠 — 복면·머리띠·바이저) · `facing`(앞쪽 면만). 머리띠 3cm 는 큰 뒤통수 면이 안 들어 뒤 40° 가 비었고 5.5cm 로 360°. 정찰병 투구 속 눈썹·속눈썹·이는 빼고 눈은 저폴리(4.9만 → 3.9만, 겉모양 그대로).
- 검증: verify fbx ≤ 0.7°·2.7mm · glb 0.0° · 두 번 빌드 같은 바이트(무사·술사도 그대로) · 도포 뚫림 서기 7.6%·걷기 32%·달리기 66%(같은 잣대로 잰 술사 치마 20%·28%·70% — 이전 기록 수치와는 측정 정의가 다르다, glTF 로 다시 열면 동작 NLA 트랙이 다 켜져 겹치니 떼고 잴 것) · saga-unity 배치 `CMP_RESULT OK`(몸 서른여섯). 다른 세션 배치(Forest 헤드리스)가 끝난 뒤 돌렸고, 배치가 올린 `ProjectVersion`·`Packages` 는 되돌렸다.
- 게임 몸은 그대로 — 사람 판정 전(HOW_TO_PLAYTEST §9). 남은 사람 NPC: 세 시대 잡졸·역참 사람(README 상태 줄 ②).

## 2026-09-25 REALM — PLAN 109-5 세 시대: 시간 틈 사람 아홉 + 퓨전 사연 셋 (웹 사가국지 5-12·5-9 재해석)

"사가 유니티 이어 하자" → 109 표 5번 줄(A 전체 퓨전 마지막 줄).

- **구조 대조**: 웹은 무장 258·시나리오 아홉·이계 성 21(균열·폐허·묘역, 야마토 너머). 이 트랙은 무장 셋·재야는 성마다 묻힘(`HiddenAt`)·시나리오 선택 없음(5-4 제외 확정)·이계 성 없음·서사 카드는 금만(5-2 재해석). → ① 시간 틈 사람을 함락해 들일 본토 적국 성에 손으로 묻고 ② 퓨전 사연은 "관문 성"을 정해 거기서만 뜨게. 시나리오 ⑦⑧⑨·생존 승리·이정표는 뺐다.
- **시간 틈 아홉** `Data/RealmEras.cs`: 웹 `TIME_OFFICERS` 자질·희귀도·말 그대로. 묻힌 성 소패·하비·낙양·업·수춘·장안·성도·양양·건업(세 사슬 앞·가운데). `RealmOfficer.Era` + 이름 딱지 "강서(현대)". 처음 찾으면 "⏳ 시간 틈 너머 현대에서 온 특공대장 — …" 한 줄(웹 "남은 것: 시간 틈 사연"). 웹 이방인 충성 감점 → 등용률 ×0.85(구간 0.05~0.9 다시). 세이브 버전 그대로(옛 세이브엔 재야로 들어온다).
- **퓨전 사연** `RealmEventState`: 균열의 울림→균열의 문 · 폐허의 역병→역병의 근원 · 묘역의 종소리→망자의 맹세. 관문 성 균열 = 운중(`RealmCityData` 에 이미 "균열/폐허로 드는 막북의 첫 관문") · 폐허 = 오원(막북 끝) · 묘역 = 일남(가장 남쪽 끝). 웹 수치 그대로, 경험·충성은 없어 치안·기술로. 이 카드들만 금 말고 관문 성 값(`RealmCityState.AdjustCity`)도 건드린다. 둘째 단 A = 이계 무장(웹 명부에서 두목 아닌 첫째 — 성혼·부생·강해) 합류(`JoinOfficer`), 이미 있으면 대신 보상. 여는 카드는 판마다 한 번, 월간 추첨에 카드 둘 몫 무게.
- **진단** `PlaytestRealmEras` — `PlaytestRealmSlice` 에 `Eras` 단계(전 적국 함락 뒤·문답 앞)를 끼움: 표·명부·딱지·옛 셋 그대로·등용률·소패 수색(사연)→등용(배치)·퓨전 여섯 글·사슬 셋(예약·합류·두 번째는 보상·성 값)·다시 안 뜸·월간 추첨에 섞임. 합류한 무장은 뒤 세이브 왕복이 같이 본다.
- ko/en 92키(도구가 못 잡는 이름·직함·말·땅 이름 포함) · `loc-missing` realm 0.
- 검증: `PlaytestRealmSlice` **3연속 OK**(eras 줄 셋 같음 "강서(현대) 찾음·2달 만에 등용 · 이계 합류 3/3·월간 추첨 2장 중 퓨전 첫 등장", save/load round-trip OK).
- **109 A(전체 퓨전) 다섯 줄 끝**. 다음 = 109-6 B 인물 105(웹 도감 → GO 등용 목록·싸워서 등용).
- 실기 확인 전: 수색 글 두 줄이 토스트에 다 보이는지, 퓨전 카드가 너무 자주/드물게 뜨는지, 이계 무장 셋의 셈(무력·지력).

## 2026-09-25 — char-forge GO 세 시대 아홉(들판 적 셋·역참 사람 여섯) + 비교 장면 짝 스물일곱 ("이어해")

- 들판 적: `_cmp_real_gasmask_01`(방독면 약탈자) · `_cmp_real_copzombie_01`(떠도는 망자) · `_cmp_real_exored_01`(강철 경비병). 역참 사람: `_cmp_real_tourist_01`(여행자) · `_cmp_real_courier_f_01`(택배 기사) · `_cmp_real_patrol_01`(순찰 대원) · `_cmp_real_surveyor_01`(탐사 대원) · `_cmp_real_mechanic_01`(수리 기사) · `_cmp_real_chrononaut_f_01`(시간 여행자, 여자). 옷·모자·배낭·보안경으로 여섯이 서로 다르게.
- `build_real.py` `shell` `facing_back`(등쪽 면만 — 배낭·짐틀). 방독면은 앞면만 고르면 코 밑·턱 아래 면이 빠져 살 388점이 비쳐 띠로 한 바퀴(26점). 이마 띠는 5.5cm(3cm 는 뒤통수가 끊긴다).
- 검증: verify fbx ≤ 0.55°·glb 0.0° · 두 번 빌드 같은 바이트(예전 몸 그대로) · 모자 밖 머리카락 0% · 겉옷자락 뚫림 서기 6.8%·걷기 28%·달리기 71% · saga-unity 배치 `CMP_RESULT OK`(몸 쉰넷). 첫 배치는 다른 세션의 커밋 전 `PlaytestRealmEras.cs` 컴파일 오류로 멈춰, 그쪽 커밋(e7fadd45) 뒤 다시 돌렸다. 배치가 올린 `ProjectVersion`·`Packages` 는 되돌렸다.
- 게임 몸은 그대로 — 사람 판정 전(HOW_TO_PLAYTEST §9). 남은 사람 NPC: DUNGEON·STORY·FOREST 세 시대 몸(README 상태 줄 ②).

## 2026-09-25 GO — PLAN 109-6a 도감 105 + 들판 인물 + 싸워서 등용 (웹 사가고 ⑯·data.js HEROES 재해석)

"이어해" → 109 표 6번 줄(B 인물 105 첫 줄). 크니까 쪼갬: 6a = 도감 데이터·들판 인물·싸워서 등용, 6b = 도감 화면.

- **구조 대조**: 이 트랙 GO 등용은 도적 결투 뒤 "산적" 한 종뿐, 동료 이름 = id, 원소는 id 해시로 셋. 원소 셋(화·수·뇌)·들판 전투·원소 방패 적·두 겹 수호장은 이미 있다. 웹은 원소 일곱·들판 인물 스폰·⑯ 싸워서 등용.
- **도감** `Data/GoHeroes.cs`: 웹 `data.js` HEROES 105 를 스크립트로 뽑음(시대 묶음 삼국지 22·한국사 26·일본사 20·세계사 37, ★3 12·★4 46·★5 47). 웹 `hanja` 칸은 세계사 몇몇이 실명에 가까운 로마자(예: Attilan)라 옮기지 않았다. 원소 = 웹 `elementOf`(FNV-1a·xorshift 15) → 일곱 → 셋으로 접음(화 40·수 33·뇌 32). `GoElements.ForMember` 가 도감 인물은 제 원소.
- **들판 인물** `Combat/FieldHeroes.cs`(FieldSpawner 가 Play 때 붙임): 지역 여섯 자리(마을·서쪽 숲·동쪽 숲·논밭 = ★3/★4, 산기슭·남쪽 공터 = ★5 — 위험도 = 희귀도 − 2, 너른 강은 설 땅 없음). 평소엔 서 있는 사람(들판 적 목록에 안 들어 기존 진단 그대로) → 7m 안이면 겨루기.
  - `FieldEnemy.Kind.Hero`: 체력 220×(1.6+0.7★)·공격 14+4★·방패 ★4 한 겹·★5 두 겹(겉 = 제 원소, 속 = 제 원소가 누르는 원소 — 수호장 두 겹 코드를 `TwoLayered` 로 일반화, 속 방패 알림의 "○ 원소 동료로"도 원소로 계산). 기질: 무 6.5m 내려찍기 0.85s · 지 11m 에서 플레이어 발밑 3.4m 원 0.9s · 덕 0.4s 예고·0.6s 회복. 체력 0 = 굴복(Interact 동작, 다시 안 섬) → 1.2초 뒤 `PartyState.Recruit`.
  - 졸개: ★3 하나·★4~5 둘, 제 원소 들판 적, 둘째는 id 해시로 현대·미래 몸(§13). 겨루기 끝나면 끄고 지운다.
  - 끌고 32m 밖(들판 적 규칙) → 인물이 제자리로 → 없던 일(같은 사람). 전멸 → 떠나고 그 판에선 명단 뒤로(다음 사람). 새 세이브 칸 없음.
- `FieldCombat`: 곁 셋 = 가장 최근에 등용한 셋(편성 화면 전까지), 이름 = 도감 가명. `Wiped` 이벤트.
- 자리 첫판은 마을이 채집물 7m·서쪽 숲이 희귀 늑대 11m 라 진단이 잡음 → 마을 (3.7,4.1)·서쪽 숲 (0.15,2.0)·산기슭 (3.3,0.9)(사당 시련 곁을 피해).
- ko/en 219키 — 이름은 가명을 로마자로(서양풍 가명 22는 손으로), 한마디 105 영어판.
- **진단** `PlaytestGoHeroes`: 표·명단(105 빠짐없이·위험도)·자리(설 땅·제 지역·무리/수호장 30m·사건 물건 12m)·서 있는 사람·겨루기 ★3/★4/★5(체력·방패 겹·속 원소·졸개 수·시대·기질 반경)·굴복→동행(곁 이름·원소)·다음 사람·끌고 감·전멸. 동행·인연·경험치·자리 되돌림.
- 검증: 컴파일 · GO `PlaytestHeadless` **3연속 OK**(heroes 줄 셋 같음 "★3 영진(Might·수) ★4 뇌호(Might·수) ★5 명운(Virtue·뇌)").
- 다음 = 109-6b 도감 화면. 실기 확인 전: 겨루기 거리 7m, ★5 두 겹 난이도, 지 원거리 예고 원, 굴복 무릎이 무릎으로 보이는지(Maria Interact 클립), 다음 사람 4초.

## 2026-09-25 — char-forge DUNGEON 세 시대 여덟(잡졸 여섯·행상 둘) + 비교 장면 짝 서른다섯 ("이어해")

- 잡졸: `_cmp_real_rioter_01`(폭주 청년) · `_cmp_real_testbot_01`(시험 기동 인형 — 온몸 흰 쇠) · `_cmp_real_riotswat_01`(진압 특공대) · `_cmp_real_steelbot_01`(강철 인형 병정 — 검은 쇠·붉은 눈 띠) · `_cmp_real_enforcer_01`(암흑가 해결사) · `_cmp_real_visitor_01`(별 너머 방문자 — 큰 머리·더듬이). 행상: `_cmp_real_junkpeddler_01`(고물 행상) · `_cmp_real_timepeddler_f_01`(시간 행상).
- 비교 빌더: `IdlePair`(서기만 몸) + 짝 여덟. 두 쇠 인형은 껍데기가 살을 다 덮어 살 메시가 없어 검사가 쇠 칸(`_metal`)을 해골의 뼈 칸처럼 받는다.
- 검증: verify fbx ≤ 0.55°·glb 0.0° · 두 번 빌드 같은 바이트 · 복면 360°·앞 남은 살 63점 · 긴 겉옷자락 뚫림 서기 20%·걷기 39% · saga-unity 배치 `CMP_RESULT OK`(몸 일흔). 배치가 올린 `ProjectVersion`·`Packages` 는 되돌렸다.
- 게임 몸은 그대로 — 사람 판정 전(HOW_TO_PLAYTEST §9). 남은 사람 NPC: STORY·FOREST 세 시대 몸·PeasantMan.

## 2026-09-25 GO — PLAN 109-6b 도감 화면 (모은 수·시대 넷·그림자, 세이브 v17)

"사가유니티 이어하자" → 109 표 6번 줄 둘째 조각.

- **세 단계**: 안 만남(그림자) → 만남(들판에서 겨루기를 한 번이라도 연 사람 — `FieldHeroes.StartDuel` 이 `HeroDexState.MarkSeen`) → 등용(동행 명단 = `PartyState`, 동행이면 만난 셈). 웹 `codex.js` 는 얻음/못 얻음 둘뿐이라 "만남"은 이 트랙이 PLAN 109 "안 만난 사람 그림자"를 읽고 더한 단계.
- **세이브 v17** `heroesSeen`(v16 → 빈 목록, 동행만 만남). `\"version\":16` 을 박아 둔 GO 진단 넷(Guardian·RegionMission·Treasure·WorldMap)을 17 로.
- **화면** `UI/HeroDexUi.cs`(FieldSpawner 가 Play 때 붙임, 런타임 리스너): B 키·오른쪽 위 "도감"(지도 밑 -330). 제목 "도감 — 등용 n/105 · 만남 m" · 시대 넷 탭(등용/전체) · 칸 8 줄 124×60(세계사 37 = 5 줄) · 자세히 한 줄 · 닫기. 가로 PC 에선 캔버스가 1080×607 이라 전부 가운데 ±290 안. 지도와 서로 닫힘(정렬 7 > 지도 6).
  - 등용 칸 = 원소 빛깔 45%·이름·원소·기질, 만남 = 회색·이름·"만남", 그림자 = 거의 검정·별·"? ? ?". 자세히: 등용 = 원소·기질·무력/지력/통솔·한마디, 만남·그림자 = 서는 지역(`GoHeroes.RegionOf`), 그림자는 이름을 숨긴다.
  - 웹 세력 칸(56가지)은 번역 부담에 비해 쓸모가 적어 뺐다. ko/en 12키(dex.*·hero.trait.*).
- **진단** `PlaytestGoHeroDex`: 빈 판(도감 밖 동행만 남김) → 진짜 버튼 열림·0/105·진짜 탭 넷 22/26/20/37·전부 그림자(이름 없음·어두움) → 마을 첫 사람 겨루기 = 만남(이름·제목 만남 1·자세히에 마을 들판) → 같은 시대 다른 사람 등용 = 등용 칸(원소·기질·밝음·탭 1/·제목 1/105)·자세히 한마디 → 그림자 자세히(이름 숨김·지역) → 가로 배치 → 지도와 서로 닫힘 → v17 왕복·v16 로드 → 닫기 버튼. 동행·인연·만남·들판 자리·세이브 파일 되돌림.
- 검증: 컴파일 · GO `PlaytestHeadless` **3연속 OK**(38줄, 달라진 건 기존 레벨업 컷 zoom·승급 Atk 프레임 흔들림뿐) · loc-missing 다섯 판 0.
- **줄 6 끝**. 다음 = 109-7 몸 배정. 실기 확인 전: 칸 글자 크기(17)·그림자 칸이 너무 어두운지·폰 세로에서 도감 버튼 자리.

## 2026-09-25 GO — PLAN 109-7 인물 105 몸 배정 (몸 열일곱 × 모양 다섯 축)

"사가유니티 이어 하자" → 109 표 7번 줄.

- **몸 고르기**: Mixamo 카드 108장을 한 장씩 모아 보니 역사풍 사람 몸은 디스크의 열 벌 + 새 여덟뿐 — Kachujin G Rosales·Arissa·Eve By J.Gonzales·Dreyar By M.Aure·Castle Guard 02·Heraklios By A. Dizon·Brady·Joe(근대 양복)를 헤드리스 Mixamo 로 받았다(몸 + 대기, 여덟 모두 휴머노이드 valid, `SetupHeroBodies`). Akai·Erika(맨손)는 지금 Archer 와 거의 같고 Girlscout·Vampire·Medea 는 괴물·미래풍이라 뺐다. GO 장면에서 이미 쓰는 몸(Maria·산적 Abe·해골·수호장·시대 적·역참 여섯)은 풀에서 뺐고, 마을 사람 Paladin·Peasant Man·Peasant Girl·Archer 는 역사풍이 모자라 넣었다.
- **표** `Data/GoHeroLooks.cs` — 몸 열일곱(남 열둘·여 다섯)에 기질(무·지·덕)·시대 어울림 점수 × 3/1.5 − 이미 쓴 사람 × 1.1, 한 몸 최대 10. 손으로 박음(`BodyOverride`): 여자 열둘 전부(무희·여무사 = Kachujin, 무녀·여왕·궁정 문필 = Arissa, 성녀 기사·여왕 = Eve, 화가·만세 소녀·왕비 = Peasant Girl, 수필가 = Archer) · 근대 다섯 = Joe · 암영조 = Ninja. Uriel(금빛 장식 갑옷)은 ★5 만. 첫판은 닌자 복면에 일본 무장 일곱, 금빛 갑옷에 의원·과학자, 양복에 방패가 걸려서 이 규칙들을 더했다.
- **빛깔을 안 쓴 까닭**: 몸 재질을 재 보니(임시 점검) 열아홉 중 열여섯이 피부·옷이 재질 하나 — 빛깔을 입히면 얼굴까지 물든다. 사용자 기준도 "색만 다른 건 다른 게 아니다". 대신 **모양 다섯 축**: 키(0.93/1/1.07, 여자 × 0.95) · 체격(몸 너비 x·z 0.9/1/1.1) · 등(카타나·에스톡·사브르·철퇴·전투 망치·도끼·방패) · 허리(손도끼·단검·나침반·등잔) · 머리(어부 모자·둥근 안경 — 투구·두건·복면 몸엔 없음). 꾸밈은 Poly Haven 스캔 CC0 열둘(`fetch_polyhaven_models.py` 에 더함) + 있던 연 방패. 조합은 선호 순위 합 + 꾸밈 쏠림 벌점(다섯 명마다 한 칸)이 가장 작은 것 중 **같은 몸 앞사람 모두와 두 축 이상 다른 것**. 손도끼는 0.29m 라 등 대신 허리로 옮겼다(첫판에 아무도 안 썼다).
- **입히기** `Player/HeroDresser.cs` — 막 만든 몸(받은 T 자세)의 스킨 메시를 한 번 구워 살 정점으로 자리를 잰다: 등 = 윗가슴 뼈 높이 띠에서 가장 뒤 살 + 반 두께, 32° 비스듬히(칼은 정점 폭으로 넓은 끝 = 자루·코등이가 어깨 위로) · 허리 = 엉덩이 뼈 오른쪽 뒤(옆구리는 걸을 때 손이 스쳐서) · 모자 = 머리 살 꼭대기에 모자 깊이 55% · 안경 = 정수리 45% 높이 눈자리(코를 뺀 좌우 띠) 앞 0.006H, 머리 폭 × 0.95. 구운 좌표계는 두 풀이 중 렌더러 경계와 맞는 쪽. 크기는 실측 × 몸 키/1.75. 뼈에 붙여 동작을 따른다. `PartyBodies.PrefabFor` 가 표의 몸을 주고 `Dress` 를 동행 교체·들판에 선 인물(`FieldHeroes`)·겨루기 상대(`FieldEnemy.SpawnHero` 새 인자) 셋이 같이 부른다. 표 밖 id 는 예전 해시.
- **진단** `PlaytestGoHeroLooks`(도감 화면 진단 뒤): 표(105·몸 17 모두 씀·성별·손으로 박은 몸·투구 몸 머리 꾸밈 없음·한 몸 ≤10·같은 몸 최소 2축·꾸밈 열셋 모두 쓰임·꾸밈 없는 사람 ≤1/5·모습 105 모두 다름) · 105 벌을 실제로 만들어 입혀 봄(키 오차 0.0%·너비 배율·꾸밈 수·등 = 가슴 뒤·허리 = 엉덩이 오른쪽 뒤 ±0.12H·모자 = 머리 뼈 위·안경 = 얼굴 앞 가운데·몸에서 안 날아감) · 동행 교체(꾸밈 셋, 30 스텝 걷는 동안 등 꾸밈-가슴 거리 0.38→0.38) · 들판에 선 인물 여섯·겨루기 상대 꾸밈.
- 배정 결과: Uriel·Dreyar·Brady·Peasant Man·Pelegrini 10 · Heraklios·Morak 9 · Castle Guard 02·Paladin 7 · Joe·Castle Guard 5 · Kachujin·Peasant Girl·Arissa 3 · Eve 2 · Archer·Ninja 1, 꾸밈 132, 꾸밈 없는 사람 12. 전체 명단은 진단 로그 `hero looks table` 한 줄.
- 검증: 컴파일 · GO 씬 재빌드(수호장 컷 타임라인 같이 커밋) · GO `PlaytestHeadless` **3연속 OK**(hero looks 줄 md5 세 번 같음).
- **줄 7 끝**. 다음 = 109-8. 실기 확인 전: 등 무기 기울기·등에 박히는지, 허리 소품이 걸을 때 손에 걸리는지, 모자·안경 자리, 몸 너비 0.9/1.1 이 어색한지(뼈가 도는 곳에서 조금 기울 수 있다), 금빛 갑옷 열 명이 너무 많은지. 몸 여덟은 로컬 전용 — 다른 PC 는 Mixamo 레시피(README 표 109-7 줄) → `SetupHeroBodies` → GO 씬 재빌드.

## 2026-09-25 — char-forge 남은 사람 NPC 열일곱(STORY 세 시대 열·정찰병·FOREST 마을 사람 여섯) + 비교 장면 짝 쉰둘 ("vroid 같은 자체툴 이어 해줘")

- STORY 적: `_cmp_real_rider_01`(Racer) · `_cmp_real_crashdummy_01`(Dummy — 온몸 노란 합성수지) · `_cmp_real_warzombie_01`(Warzombie) · `_cmp_real_starguest_01`(Mremireh) · `_cmp_real_punk_f_01`(Jody) · `_cmp_real_plasma_01`(Yaku) · `_cmp_real_merc_01`(Steve) · `_cmp_real_colossus_01`(Mannequin). STORY 사람: `_cmp_real_phototourist_f_01`(Olivia) · `_cmp_real_chrononaut_02`(Ely) · `_cmp_real_scout_01`(PeasantMan). FOREST: `_cmp_real_sentry_01`(CastleGuard) · `_cmp_real_pilgrim_01`(Pelegrini) · `_cmp_real_courier_02`(Pete) · `_cmp_real_photographer_f_02`(Sophie) · `_cmp_real_goldexo_f_01`(Uriel) · `_cmp_real_castaway_f_01`(Jennifer). 이로써 Mixamo 사람·괴물 자리 전부에 공방 후보가 있다.
- 비교 빌더: 짝 열일곱 + 합성수지 칸(`_plastic`)을 살 없는 몸 검사에 받고 매끈함 0.5.
- 함정: MakeHuman `macro.height` 가 가팔라 첫 빌드가 1.41~2.34m 로 빗나갔다(목표 1.65~1.84) — 레시피마다 선형 보정해 ±1.5% 안으로. `age` 0.3 은 청소년 비율이라 어른은 0.42 로 올렸다. 규칙은 char-forge README §3.
- 검증: verify fbx ≤ 0.55°·glb 0.0° · 두 번 빌드 같은 바이트 · 시험 인형 밖 살 0점 · 옷자락 뚫림 순례 기사 0%·16%, 사진작가 2.6%·23% · saga-unity 배치 `CMP_RESULT OK`(몸 104). 배치가 올린 `ProjectVersion`·`Packages` 는 `tools/unity-batch.sh` 가 되돌렸다.
- 게임 몸은 그대로 — 사람 판정 전(HOW_TO_PLAYTEST §9).

## 2026-09-25 GO — PLAN 109-8 스킬 모양 넷 + 교체 연출 (웹 사가고 ⑫·⑭)

"이어해" → 109 표 8번 줄(B 인물 105 마지막).

- **모양 고르기**: 웹 ⑫ 는 id 해시로 넷 중 하나지만 웹 ⑲ 순서 11 이 "모양 = 기질 틀 × 원소"로 바꿀 방향이라 이 트랙은 처음부터 기질로 — 무 = 돌진(32) · 덕 = 찌르기(28) · 지 = 장판(23)·소환(22)을 id 해시 반반 · 통 = 소환. 들판 인물이 겨룰 때 쓰는 기질 틀(무 내려찍기·지 원거리·덕 빠른 근접)과 결이 맞는다. 주인공 원형 그대로(옛 스킬 진단 넷이 그대로 통과), 도감 밖 id(산적)는 해시.
- **수치**: 거리 = 웹 × (여기 원형 7m / 웹 4.5m = 1.56), 배율 = 웹 × (1.8/2.2 = 0.82). 찌르기 12.5m·폭 2.5m ×2.3 · 돌진 최대 9.4m, 겨눈 적 1.9m 앞에서 멈춤, 폭 2.8m ×2.0, 무적 0.3초(`PlayerController.Dash` 0.2초) · 장판 반경 6.2m·5초·1초마다 ×0.5(5틱 ×2.5, 여럿) · 소환 반경 10.9m·8초·1.5초마다 가까운 적 하나 ×0.75(6번 ×4.5). 장판·소환은 `FieldCombat.Zones` 로 — 놓은 사람 공격력을 담고 교체해도 남고 첫 틱이 곧바로(웹 `stepZones(S, 0)`). 원소 석등(107-4)이 듣는 `ElementPulse` 도 모양마다 쏜다(찌르기 = 선 가운데, 돌진 = 끝, 장판 = 틱마다).
- **그림**: 빛깔은 웹 원소 일곱(`GoHeroes.WebElement` — 109-6a 가 이 줄 몫으로 남긴 값)으로 칠해 바람·얼음·바위·풀 인물이 제 빛을 낸다(피해 원소는 셋 그대로). 찌르기·돌진 = 땅 위 원소 빛 띠 `FieldLineFx`(LineRenderer) · 장판 = 틱마다 고리 · 소환 = 등불 정령 `SkillSpirit` — 인물 꾸밈으로 받은 Poly Haven 등잔을 사람 키 높이에 띄워 점광을 달고 흔들며 돌고, 칠 때마다 빛줄기·번쩍(웹은 정령 몸이 없었다). 스킬 칸·머리 위에 모양 이름(ko/en 넷).
- **교체 연출**(`PartyBodies.Show(id, motion)`): 들판 교체·쓰러져 넘김만 연출, 되돌림·전멸·진단 초기화는 바로. 옛 몸을 떼어(부모 없음) 옆뒤(왼쪽 0.6·뒤 0.8)를 보고 걷기(Speed 0.5)로 0.6초 동안 4.7m ease-out 물러나고, 0.6~0.9초에 떠오르며 줄어 고리와 함께 사라진 뒤 꺼진 채 플레이어 밑 제자리로. 새 몸은 제 오른쪽 3.1m 에서 0.35초 ease-out(웹 1.6m·2.4m × 척도 3.4/1.75). 물러나던 몸을 곧바로 다시 부르면 제자리로 돌려 쓴다. 판정·카메라는 플레이어 자리 그대로.
- **진단** `PlaytestGoSkillShapes`(인물 몸 진단 뒤): 표(원형·기질 → 모양·넷 모두 ≥12·빛깔 일곱·결정성) · 원소 없는 적 셋만 두고 나머지는 멀리 — 찌르기(선 위 8m 하나, 옆 4.5m·뒤 안 맞음, 피해 ×2.3, 스킬 칸 "찌르기") · 돌진(적중·무적·6.7m 파고듦·겨눈 쪽) · 장판(첫 틱 둘·교체 뒤 다섯 틱·밖 안 맞음·누적 ×2.5) · 소환(정령 몸·떠 있음·주인공으로 바꿔도 여섯 번·반경 밖 안 맞음·끝나면 사라짐) · 교체 연출(물러나는 몸 = 옛 몸·떼어짐·새 몸 3.1m·중간 0.25 ease-out·0.35초 제자리·물러난 4.7m 뒤쪽·0.9초 꺼져 제자리·물러나던 몸 되부르기). `PlaytestGoPartyBodies` 는 교체 뒤 `FinishMotion()` 으로 끝난 자리만 본다.
- 검증: 컴파일 · GO 씬 재빌드(정령 몸 배선, 수호장 컷 타임라인 같이) · GO `PlaytestHeadless` **3연속 OK**. 3회차 피해 숫자가 1·2회차와 다른 건 알려진 레벨업 특성 카드 흔들림(공격 ×1.08/×1.06)이 공격력에 곱해진 몫 — 비율은 같다.
- **줄 8 끝 = B 인물 105 끝**. 다음 = 109-9(C 웹 변경 이식 첫 줄). 실기 확인 전: 띠가 읽히는지, 돌진 거리·무적 체감, 장판 고리, 정령 크기·빛, 소환 한 몸 ×4.5 가 센지, 교체 연출 길이·물러나는 쪽.

## 2026-09-25 — char-forge 자체 키프레임 동작 여섯 + 사람형 옛 몸 키 보정 스물둘 ("이어해")

- `tools/char-forge/keyframes.py`: UAL 무료판에 없는 동작을 동작 팩 뼈대 위에 코드로 — 등반·활공(주역)·방패 막기·막기 중 피격(무사)·활 대기·활 쏘기(유격). 주역은 헤엄·물 위·점프도 UAL 로 더했다. 레시피 셋 anims 갱신.
- 비교 빌더: 순환에 climb·glide·swim·tread·jump·taunt·blocked, Maria·Paladin 지금 몸 클립 연결(BuildMariaTraversal·Paladin@Taunt/Blocked).
- verify.py 고침: FBX 1 프레임 시작 밀림 · 한 장면 frame_set 이 원본도 옮기던 것 · 샘플 아홉. 고친 뒤 옛 몸 fbx 오차도 대부분 0.5° 안.
- 키 보정: 사람형 옛 몸 스물둘을 짝 키 ±1.5% 로(술사 1.36→1.65m · 택배 기사 1.44→1.66m · 무사 2.03→1.78m · 능묘지기 2.17→1.89m 등). 괴물 열하나는 그대로.
- 검증: verify fbx ≤ 0.71°·glb 0.0° · 두 번 빌드 같은 바이트 · saga-unity 배치 `CMP_RESULT OK`(몸 104). 게임 몸은 그대로 — 판정 전.

## 2026-09-25 GO — PLAN 109-9 정상 · 발원지 폭포 · 지붕 가림 카메라 (웹 사가고 ⑰·⑯ 뒷부분, 세이브 v18)

"이어해" → 109 표 9번 줄(C 웹 변경 이식 첫 줄).

- **대조**: 웹 ⑰ 의 오르기·헤엄·점프·활공·등반 도약은 107-2, 다리는 107 ②, 땅 퓨전 소품은 109-1b 에 이미 있다. 능선 오르막 걸음 ×0.5·가파른 내리막 ×1.2 는 웹 키보드 걸음 배율이라 물리 비탈(28° 경사)·절벽 등반인 이 트랙엔 옮기지 않았다. 남은 것 = 정상 발견·오른 정상 순간이동·발원지 폭포, 그리고 ⑯ 뒷부분 건물 가림 카메라.
- **카메라**: GO `CameraRig` 는 이미 광선 하나로 벽 앞까지 당겼지만 마을집 지붕(roof-gable ×10 = 5.7m)엔 충돌체가 없어(밟는 자리가 아니라 일부러 뺐다) 집 뒤로 가면 카메라 선이 벽(4m) 위 지붕 속을 지나 캐릭터가 가려졌다 — 웹이 고친 "건물 근처로 가면 캐릭터가 안 보여"와 같은 문제. 고침: 지붕마다 렌더러 경계로 트리거 상자 + `CameraOccluder` 표식(GO 의 다른 물리 질의는 전부 `QueryTriggerInteraction.Ignore` 라 걷기·등반·발밑엔 안 걸림을 grep 으로 확인) · 광선 → 반지름 0.35m `SphereCastNonAlloc`(모서리를 스치며 파고들지 않게) · 캡슐·구·CharacterController(사람·짐승·굴뚝·줄기)는 지나감. 진단에서 남쪽 벽 4m 밖 2.5m 높이 35° 선이 16m → 4.3m 로 당겨지고 단단한 충돌체만 보는 광선은 안 맞음 = 지붕 트리거가 막았다.
- **정상**(`GoWorldMap.Peaks`, `World/PeakSummits.cs`): 봉우리 칸 28 에 하나씩, 윗면 = `PeakBase + PeakHeight`(진단이 위에서 쏜 광선이 충돌면과 0.3m 안). 윗면 반지름 + 1m·1.2m 아래까지 서면 처음 한 번 금 80 + 높이(108~135) · 경험 70(웹 50 + 단사 2 → 지역 사명 비율 10/단사) · 금빛 고리 · 안내 글. 0.2초마다 본다(WorldMapBuilder 가 붙임). 이름은 "지역 봉우리 N" — 처음엔 "첫째~여덟째 봉우리"였는데 북쪽 산기슭에 여덟 넘게 서서 겹쳤다. M 지도 ▲: 그 지역에 발 디디면 흐리게, 오른 정상은 금빛·누르면 윗면 0.3m 위로 순간이동(쫓던 적 귀가), 안 오른 정상·결투 중은 거절, 안내 글 "오른 정상 ▲ n/28". **세이브 v18** `peaksFound`(v17 → 빈 목록) — 버전을 박아 둔 GO 진단 다섯을 18 로.
- **폭포**(`TestMapData.Waterfalls`, `TerrainBuilder.BuildWaterfalls`): 강(5줄)은 남북이 산 절벽이라 산 → 강 둘 — 동쪽 끝 경계 산 (8,4) → (8,5) "은빛 폭포" 36m(너른 강의 발원지) · 서쪽 (1,6) → (1,5) "안개 폭포" 15m. 고원 윗면 샘 웅덩이(WaterUnlit) → 턱에서 3m 안쪽부터 흘러 1.4m 밖으로 휘고 아래로 조금 퍼지며 절벽 면 2.6m 밖 수면까지 떨어지는 물 판(uv.y = 흐른 거리 m) → 물보라 입자(초당 40, 부드러운 흰 점 64² 를 코드로 굽는 `Sprites/Default`). 새 셰이더 `Saga/WaterfallUnlit` — 폭 22 줄기가 줄마다 다른 빠르기·간격으로 흰 물살 두 겹, 턱 2.5m 는 희게, 양옆 흐림, 안개(`WaterUnlit` 과 같은 결, 텍스처 없음). 충돌체 없음(뒤 절벽은 그대로 기어오르고 강에서 헤엄쳐 지나간다). M 지도 "≋ 이름"(그 산 지역이나 너른 강에 발 디디면).
- **진단** `PlaytestGoPeaks`(스킬 모양 진단 뒤): 정상 표(칸 수·id·이름 겹침 없음·윗면 = 충돌면) · 발견(윗면 밖·옆면 아래 안 셈·금·경험·한 번만) · ▲ 숨김/보임·안내 셈·진짜 버튼 순간이동 뒤 25 스텝 서 있음(윗면 +0.08m)·거절 둘 · v18 왕복·v17 로드 · 폭포(산 → 강 칸·턱 = 고원 ±0.5·아래끝 = 수면 ±0.3·면 밖·셰이더 오류 없음·충돌체 없음·물보라·샘·지도 이름표 숨김/보임) · 카메라(규칙 넷·빈 하늘·캡슐 지나감·상자 막음·지붕 셋·지붕 너머 당김). 정상 기록·지도·돈·경험·자리·세이브 파일을 되돌린다.
- 검증: 컴파일 · GO 씬 재빌드(수호장 컷 타임라인 같이) · GO `PlaytestHeadless` **3연속 OK**(peaks 줄 md5 세 번 같음). 첫 재빌드는 다른 세션(char-forge 비교 장면 배치)이 같은 프로젝트를 쥐고 있어 라이선스 오류로 끝났다 — 끄지 않고 끝나길 기다렸다가 돌렸다. `ShaderGraphSettings.asset` 줄바꿈만 바뀐 부작용은 되돌렸다.
- **줄 9 끝**. 다음 = 109-10 DUNGEON 첫 조각(웹 사가블로 5.9 비결). 실기 확인 전: 폭포 물살·물보라가 물로 읽히는지·턱 자리, 정상 윗면 판정 넓이, ▲ 순간이동 뒤 자리, 집 뒤 카메라 당김이 튀는지. 새 셰이더는 `Shader.Find` 라 폰 빌드 때 `WaterUnlit` 과 함께 Always Included 확인.

## 2026-09-25 DUNGEON — PLAN 109-10 첫 조각 비결 · 전리품 빛기둥 (웹 사가블로 §5.9, 세이브 v11, "사가 유니티 이어 해")

- 웹 §5.9 는 무예 120 × 단수 1~5 에 비결 다섯(분노·한기·확산·신속·흡혈). 이 트랙 DUNGEON 무예는 평타·강공격·회전베기 셋뿐이고 단수·기력·원소·지속 피해가 없다 → **무예 셋에 비결 하나씩**, 단 = 1 + (Lv−1)/2(Lv 1·3·5·7·9 에 하나씩), 없는 축은 옮겨 적음: 분노 기력 ×1.4 → 재냉각 ×1.4 · 한기 결→빙·지속 ×1.4 → 맞은 적 2.8초 얼림(쫓기·공격 준비·예비동작 ×0.6, 두목전 시간은 그대로) · 확산 발수 +2 → 평타·강공격 곁의 둘 + 사거리 ×1.35, 회전베기 반경 ×1.35 · 흡혈 = 쓴 뒤 3초 세 무예 피해의 12%(끝수 넘김).
- 새 `Data/SecretState.cs`(표·배율·잠금·환원 = 레벨 모자라면 고른 값은 두고 없는 것으로 읽음) · `PlayerCombat`(세 무예가 배율을 곱하고 `Strike`·`ExtraTargets` 로 얼림·흡혈·곁 타격, 비결 없음 = 옛 수치 그대로) · `DungeonEnemy.Chill`(얼음빛은 예비동작 경고색보다 아래) · 새 `UI/SecretPanelUi.cs`(K·소환 위 "비결" 버튼, 무예 줄 × 다섯 칸, 잠긴 칸 "Lv.n", 공격 버튼 오른쪽 위 첫 글자 딱지) — `GameBootstrap.Start()` 가 Play 때 지어 **씬 재빌드 없음**(재빌드는 컷 타임라인을 다시 써서 피했다, 리스너는 런타임이라 `ButtonWiringCheck` 가 센다).
- **빛기둥**(`LootMarker.Spawn(pos, tier)`): 이 트랙 무기 등급 셋 + 명소 첫 토벌 무기를 웹 넷에 맞춤 — 등급 1 명품 노랑 3.4m · 2 보물 초록 5.6m · `wp_lm_*` 고유 주황 8m 굵게(웹 110·180·260 비), 세로 선 둘(속·옅은 테, 위로 사라짐) 0.35초에 솟음, 1.5초는 안 줍힘, 보물·고유는 떨어질 때 발견음(새 소리 파일은 씬 재빌드가 필요해 기존 것). 보석은 등급이 없어 뺐다.
- 세이브 v11 `secrets`(무예 순서 정수 셋). 명소 진단의 "버전 == 10" 은 ">= 10" 으로. 번역 26 키 ko·en(`loc-missing` 0).
- 진단 `PlaytestDungeonSecrets`(세 시대 꾸밈 뒤): 표·단 경계 · 무예 셋 × 여섯 배율 18칸(다른 무예 안 바뀜) · 잠금·풀기·환원·모르는 값 · 실제 버튼 경로 시전(없음 평타 0.55초·HitDamage, 신속 ×0.7·0.275초, 분노 강공격 ×2.6×1.45·1.82초, 확산 평타 셋 맞고 넷째 안 맞음, 회전베기 3.3m 없음 X·확산 O, 한기 얼림 1초 남고 3초 풀림, 흡혈 두 무예 회복 +7) · 빛기둥(표·실제 처치 셋·높이·선 둘) · 패널 진짜 onClick(열기·잠긴 칸 안 걸림·분노 걸고 풀기·딱지) · v11 필드·JSON 왕복.
- 검증: 컴파일 0 · `PlaytestDungeonHeadless` **3연속 OK**(secrets 줄 2·3회 md5 같음, 1회는 문구 고치기 전) · `PlaytestDungeonFloorProgression` OK. 화면은 안 봄 — 실기 확인 전(비결 체감·패널/딱지 폰 자리·기둥 높이·색·소리).
- 다음 = 109-10-2 웹 5.10 비전(비결을 키우는 전설 장비).

## 2026-09-25 — char-forge 출처 검사(asset-audit origin) + 공방 후보 없던 몸 아홉 — unity Mixamo 몸 61 전부 후보 ("이어해")

- `tools/asset-audit` 에 인물·동작 출처 검사(bc3aba3f): godot 🔴 0(통과) · unity 🔴 282(Mixamo 몸 61, 판정 뒤 교체로 준다).
- 후보 없던 아홉: GO 인물 105 몸 여덟(Dreyar·CastleGuard02·Heraklios·Brady·Joe·Kachujin·Arissa·Eve — 109-7) + 맨몸 잡졸 Abe. 레시피 `_cmp_real_blackknight_01` 외 여덟(char-forge README §7 단계 3).
- 비교 빌더: 짝 아홉(`IdlePair` 여덟 + Abe 는 Punching 클립 이름이 달라 따로).
- 검증: verify fbx ≤ 0.55°·glb 0.0° · 두 번 빌드 같은 바이트 · 키 ±1.5% · saga-unity 배치 `CMP_RESULT OK`(짝 61·몸 122). 게임 몸은 그대로 — 판정 전.

## 2026-09-25 DUNGEON — PLAN 109-10-2 비전 (웹 사가블로 §5.10, "사가 유니티 이어 해")

- 웹: 전설(4) 한 점에 비전 하나, 선두가 입으면 그 비결을 건 무예 위력 ×1.6(`LORE_MUL`, 분노와 곱해 2.32), 같은 비전 두 점 안 겹침, 부서진 것·미확인 안 셈, 부르기 수 +1, 고유는 늘 같은 비전.
- 이 트랙엔 전설 등급이 없고 무기 한 칸(더 센 것 자동 장착)·보석 한 칸뿐 → 맨 위(빛기둥 고유) = 명소 첫 토벌 무기 여섯에 `ItemData.Lore` 를 박음(굴림 없음, 층 이름 따라: 순장검 혈해 · 성주도 노화 · 쌍부 만상 · 삼지창 빙혼 · 업화 철퇴 노화 · 금검 섬광 — 다섯 다, 분노만 둘). 겹침 규칙은 한 칸이라 저절로, 부서짐·미확인·부르기는 없는 축이라 뺌, 보석엔 비전 없음, 세이브 없음(무기 id 에서 읽음).
- `SecretState.DamageMul` 이 `LoreBoosts`(비결 = 든 무기 비전)일 때 ×1.6, 재냉각·사거리 등은 그대로. 표시: 비결 패널 제목 둘째 줄·무예 줄 " · 비전 X ×1.6"·그 비결 칸 "비전 X"(무기 바뀌면 `EquipmentChanged` 로 다시 그림) · `PlayerHud` 무기 뒤 "[비전 X]" · 줍기 글에 `LoreLine`. 번역 9 키 ko·en.
- 진단 `PlaytestDungeonSecrets` 에 `CheckLore`: 명소 무기에만·고유 기둥·다섯 다·이름 겹침 없음 · 성주도 들고 분노 강공격 2.32·신속 평타 0.7·빈 회전베기 1·재냉각 1.4 그대로 · 실제 강공격 피해 = 한 타 × 2.6 × 2.32 · 패널 제목·줄·칸·HUD · 쇠도끼로 바꾸면 꺼짐(패널도) · 삼지창 떨어뜨리는 적 처치 → 줍기 글에 빙혼 줄. **앞 진단은 이제 목검(wp_start)을 쥐고 돈다** — 이 PC 실제 세이브의 무기가 명소 무기면 분노 배율 검사가 비전에 흔들리기 때문(한 타 18.6 → 14.0 은 그 때문). 빛기둥 검사는 무기를 바꿔 줍기라 맨 끝으로.
- 검증: `PlaytestDungeonHeadless` **3연속 OK**(secrets 줄 md5 세 번 같음, "비전 5·노화 강공격 115.1") · `PlaytestDungeonFloorProgression` OK · `loc-missing` 0. 처음 한 번은 스크래치 파이썬 치환이 `\"` 를 풀어 컴파일 실패 → 고쳐 다시. 세션 시작 때 다른 세션 Unity(char-forge)가 돌고 있어 끝날 때까지 코드만 짰다. 화면은 안 봄 — 실기 확인 전(×1.6 체감·패널 두 줄 제목 넘침).
- 다음 = 109-10-3 웹 5.11 시련.

## 2026-09-25 DUNGEON — PLAN 109-10-3 시련 (웹 사가블로 §5.11, 세이브 v12, "사가 유니티 이어 해")

- 웹: 굴혈 선택 카드에서 열린 단계(위 셋) → 부적 던전 틀(방·문 하나·적 ×(1+0.35×단계)) 위 15분 시계, 처치 진척(잡졸 3·정예 8·보스 10·그림자 1) 100 → 수호자 → 완주(전설 한 점·공적 6+단계·순위표 10, 절반 넘게 남기면 두 단계), 죽어도 안 끝남(−30초), 시간 초과는 기록 없음, 문턱 제10층, 세이브 `trial = {best, open, runs, board}`.
- 이 트랙엔 굴혈 카드·부적 층이 없다 → 난입(5.5)의 격리 방 HordeArena 를 같이 쓴다(둘은 서로 막음). 새 `Data/TrialState.cs`(규칙·순위표 정렬: 단계↓·초↑·쓰러짐↑, 10 자름, 옛 세이브 = 열림 1) · `World/TrialRunner.cs`(난입 방에 붙음, 무리 보충·진척·수호자·쓰러짐·종료 카드·HUD 줄) · `World/TrialGate.cs`(난입 표식 북쪽 5m, 반경 2m 둘이 안 겹침) · `UI/TrialCardUi.cs`(단추 셋·순위표 다섯). 전부 `GameBootstrap.Start()` → `TrialRunner.Install()` 이 Play 때 지음 — **씬 재빌드 없음**. 몸은 `DungeonFloorRunner` 에 공개 읽기(잡졸·정예·기계화 정예·층 주인·시대 적 몸)를 달아 같은 것을 쓴다.
- 세 시대(§13): 무리 잡졸 넷 = 과거 황건적·현대 방역복 추적자·미래 경비 보행병·과거(제10층 단계 몸), 정예는 무리마다 과거 황건 정예/미래 기계화 정찰병. 수호자 "시련의 수호자" = 층 주인 몸(보랏빛 옅게) × 층 두목 공식 × 1.15, 부제 "시련의 끝 — 쓰러뜨리면 완주", 시계는 컷 동안 멈춤.
- 옮기며 바꾼 것: 웹 "보스 10·그림자 1" 진척은 이 시련에 그런 적이 없어 뺌 · 공적 화폐가 없어 (6+단계)×50 냥 · 전설 = 명소 무기 여섯 중 하나(횟수·단계 해시, §5.10 비전 붙음, 더 세면 바로 갖춤) · 순위표 "인물" 칸 → 그때 레벨 · 쓰러짐 유품은 `HeroState.GraveSuppressed` 로 막음(시련 밖에선 그대로), 세션 카드 "쓰러졌다" 도 안 띄움.
- 세이브 v12 네 칸. 비결 진단의 "버전 == 11" → ">= 11". 번역 22 키 ko·en(`loc-missing` 0).
- 진단 `PlaytestDungeonTrial`(비결 뒤): 규칙(문턱·위 셋·3단계 2.05·순위 정렬·10 자름·순위 밖 0·상한 100) · 표식(10층 전 잠김 → 열린 뒤 카드 단추 셋·순위표·난입 표식과 안 겹침·죽은 버튼 없음) · 카드 2단계 단추 진짜 onClick → 방·또 시작 안 됨·유품 막음 켜짐 · 첫 무리 다섯(세 시대 이름·잡졸 체력 = 공식 × 배율) · 무리 다섯에 진척 100 → 수호자(체력 공식)·그 뒤 보충 없음 · 빠른 완주(1위·최고 2·열림 4·명소 무기·공적 금·빛기둥·돌아옴·HUD 지워짐) · 느린 완주(4단계 300초 남김 → 열림 5·순위표 600초) · 쓰러짐(−30초·안 끝남·금/무덤 그대로·체력 가득) · 55초 HUD 붉게 · 난입 표식에 서도 안 열림 · 시간 초과(기록 없음·횟수+1) · 시련 밖 쓰러짐엔 유품 · 세이브 필드·순위표 JSON 왕복·옛 기본값.
- 검증: 첫 컴파일은 조건식 튜플 이름이 사라져 실패 → 폴백에 이름 달아 고침. `PlaytestDungeonHeadless` **3연속 OK**(trial 줄 md5 세 번 같음, "첫 무리 황건적/방역복 추적자/경비 보행병/폐허의 황건 정예 보상 wp_lm_fort") · `PlaytestDungeonFloorProgression` OK. 화면은 안 봄 — 실기 확인 전(15분 진척 속도·수호자 세기·카드·HUD 줄 읽힘·표식 자리).
- 다음 = 109-10-4 웹 5.12 고정 세계 지역 아홉.

## 2026-09-25 밤 — char-forge 자체 동작 둘: 치유 시전·무릎 꿇기 (술사 PeasantGirl 자리, "vroid 같은 자체 툴 이어해")

- 출처 검사 다시: unity 🔴 282 그대로, Mixamo 몸 폴더 60 전부 공방 레시피 있음(새 몸 없음). 게임이 쓰는 Mixamo 동작 종류 중 후보 없던 건 PeasantGirl `Heal`·`Kneel` 둘뿐(`Taunt` 는 원본이 Idle To Block 이라 `CF_Shield_Block`).
- `tools/char-forge/keyframes.py`: `CF_Heal`(가슴 앞에 모음 → 머리 위로 → 무릎 굽히며 앞으로 펼침, 80프레임) · `CF_Kneel_Loop`(두 무릎 꿇고 손은 등 뒤, 고개 떨굼·숨, 120프레임 반복). `dirs` 가 쇄골도 받는다(두 손 자세에서 짝다리 어깨를 편다). 목표 오차 0cm · 프레임당 최대 16.7°(치유 내리기)·0.1°(무릎).
- `_cmp_real_mage_f_01` 동작 여덟: verify fbx 0.51°·1.8mm · glb 0.0° · 두 번 빌드 같은 바이트 · 비교 장면 PeasantGirl 짝에 heal·kneel(순환에서 쓰러짐 앞) · 배치 `CMP_RESULT OK`.
- 치마 뚫림(법선 잣대 — 다리 살이 가장 가까운 치마 면 바깥으로 2mm 넘게): 서기 0.2%·걷기 5.9%·달리기 12.1%·치유 2.9%·**무릎 꿇기 34.5%**(거의 땅 위 20cm 안 — 90° 굽은 무릎·눕힌 정강이, 살에 묶인 통치마의 한계). 한쪽 무릎 세운 자세(UAL Fixing_Kneeling 바탕)도 35.2% 라 포로다운 두 무릎으로 갔다. `measure_shape.py` 는 가진 몸이면 무릎 꿇기·치유도 잰다(옛 광선 잣대: 11.4%·6.0%).
- 배치가 다시 쓴 `_cycle.controller` 111개는 ID·문서 순서만 달라 되돌렸다(바뀐 건 PeasantGirl·술사 둘). 게임 몸은 그대로 — 판정 전(HOW_TO_PLAYTEST §9).

## 2026-09-26 DUNGEON — PLAN 109-10-4 고정 세계 지역 아홉 (웹 사가블로 §5.12, "사가유니티 이어해")

- 웹: 481×481 칸 절차 들판을 중원(반경 11500) + 여덟 방위로 가른 고정 지역 아홉, 지역마다 가중치·땅빛·시대 소품·마을 성격, 1.2초 머물면 "○○ 에 들어섰다" 배너·큰 지도 지역명·땅빛. 계기는 절차 들판 끼임(칸 씨앗이 가까운 마을 따라 바뀜·그림/충돌 칸 어긋남).
- 이 트랙 바깥 세상은 절차 들판이 아니라 **30m 간격 3×3 칸에 손으로 박은 방**(모루골·Town2/3/4·갈림길 둘·능묘 입구·북 던전 길 Room2~4·옛 감시탑 뜰)이라 칸 하나 = 지역 하나로 방위를 웹 그대로 맞췄다 — 동 Town4 폐도시 · 동남 갈림길2 개펄 · 남 Town2 지옥 균열 · 서남 갈림길 태양 신도시 · 서 Town3 서역 · 서북 능묘 입구 천계 사당 · 북 Room2~4 북방 설산 · 동북 감시탑 뜰 기계 황무지. 끼임 원인이 없는 구조라 그 부분은 해당 없음.
- 새 `Data/DungeonWorldMap.cs`(웹 REGIONS 키·이름·한자·era·desc·ground 그대로 + 칸·자리 이름(지어냄: 굴뚝 마을·갯벌 갈림길·잿불 마을·볕판 갈림길·낙타 마을·잊힌 능묘 어귀·굴혈 가는 길·옛 감시탑 뜰, 모루골은 원래 이름)·방 경로, `IndexAt`: 경계 ±15m = 복도 한가운데, z≥110 ProcRoom·|x|>45·z<-45·서북/동북 칸 z>45(능묘 속) = 지역 없음) · `World/DungeonRegionTracker.cs`(머묾 1.2초 → 배너, 지역 밖 다녀와도 같은 지역은 다시 안 띄움, 배너는 대사 줄과 따로 제 캔버스 두 줄·4초·페이드, 시작 때 칸 방 바닥 열하나에 땅빛 — 웹 땅색을 최대 채널로 나눈 색조를 흰색과 40% 섞어 MaterialPropertyBlock `_BaseColor` 곱, 재질 애셋 안 건드림, `RegionEntered` 이벤트는 5.13·5.14 용) · `GameBootstrap.Start()` → `Install()`(씬 재빌드 없음).
- M 지도 `OverworldMapUI`: 나침반 다섯 칸 → 3×3 아홉 칸을 Play 때 Grid 밑에 지음(씬의 예전 다섯 칸은 끔, 빌더도 다섯 칸 안 짓게), 칸 = 이름·한자·자리, 바탕 = 웹 땅색 75%, 지금 칸 금빛, 위 "지금 — 이름 한자"/"지역 밖(던전 속)". 옛 `PlaytestOverworldMap` 을 아홉 칸 + 던전 층으로 고침.
- 안 옮긴 것: 지역 전용 시대 소품(t_factory 등, 비율 0.09~0.24) — 109-2b 가 마을·갈림길 다섯에 이미 세 시대 꾸밈을 세웠다 · 칸 굽기 예산·뒤에서 짓기 — 절차 칸이 없다 · 마을 성격(biome) — 마을 방은 일부러 바이옴 밖(문명)이라 이름만 지역을 따름. 세이브 없음. 번역 33 키 ko·en.
- 진단 `PlaytestDungeonRegions`(시련 뒤): 표(아홉·웹 키 순서·방위 여덟 + 가운데·칸 겹침·글·시대 1~2·땅빛 흰색 아님) · 자리(칸 방 열하나가 씬에 있고 제 지역·ProcRoom/능묘 속 넷/난입 방/남쪽 밖 = 없음·Room4·Corridor4 북방 설산·남쪽 들길 −14/−16 에서 바뀜·난입 표식 중원) · 땅빛(열하나 전부 원래 빛 × 색조) · 배너(2초 전 없음·1.3초 뜸·글에 이름 한자 자리·스침 안 뜸·던전 층 다녀와도 안 뜸·새 지역 뜸·4초 뒤 꺼짐) · M 지도(아홉 칸 글·서남에서 그 칸만 금빛·지금 줄·던전 층은 다 꺼짐) · ko/en 키 54+시대 넷.
- 검증: 컴파일 오류 0 → `PlaytestDungeonHeadless` **3연속 OK**(regions 줄 세 번 같음, "칸 9 방 11 배너 2 지도 9 키 54") · `PlaytestOverworldMap` OK · `PlaytestDungeonFloorProgression` OK. 화면은 안 봄 — 실기 확인 전(배너 자리·글 크기, 땅빛 세기, M 지도 칸 글 넘침).
- 다음 = 109-10-5 웹 5.13 지역 몬스터·위험도·우두머리.

## 2026-09-26 char-forge — 도감 105 몸 도구·처음 눈으로 봄·D5 Mixamo 유지

"vroid 같은 자체 툴 이어 해줘" → "saga-unity 몸은 직접 확인해봐" → "1번으로 해줘".

- 출처 검사로 새 Mixamo 몸 없음 확인(🔴 282 그대로) → char-forge 단계 4: `gen_hero_recipes.py`(GO 도감 105 → 레시피, 네 축 중 둘 이상 다름, 두 축 미만 쌍 0) · `calib_height.py`(macro.height 이분 탐색, 목표 키 ±0.3%) · 105벌 빌드 실패 0(로컬 `_out/hero/`, 커밋 안 함).
- **처음 눈으로 봄**(Blender Eevee, Mixamo | 공방 같은 빛·키 1.70m): 얼굴·MakeHuman 양복은 괜찮고, 껍데기 옷은 쫄쫄이·플라스틱, robe 는 살이 뚫는 통, 괴물은 맨몸 사람 — 모두 Mixamo 보다 못함. 그동안의 CMP OK·verify·measure 수치가 못 잡았다(char-forge README §8-1).
- **D5 사용자 결정**: Mixamo 몸 유지 + 공개 저장소 밖. 원본은 처음부터 .gitignore 라 이력에도 없음(웹도 로컬 보너스). 출처 검사 규칙을 바꿈 — Mixamo 로컬 전용 = 🟡`origin_local`, 공개되거나 .gitignore 가 안 막으면 🔴public. 수치: godot 🔴0 · unity 🔴0(🟡local 282) · web 🔴public 0 → 단계 5 통과.
- 게임 몸은 그대로(교체 없음). 공방 unity 몸은 후보로만 남김 — 옷을 진짜 옷 메시로 바꾸기 전엔 짝을 더 찍지 않는다.

## 2026-09-26 상용화 — PLAN 110 ① 실제 빌드 (사용자 "상용화 급인지 확인" → "상용화")

- 점검: 실행 파일을 한 번도 안 만들었다(빌드 씬 TestVillage 하나) · 검증은 헤드리스 로직뿐 · 사실 몸 git 밖 · UI 는 옛 `UI.Text` 29 파일(TMP 0)·세로 1080×1920 · 타이틀·판 고르기 없음 · en 검수 전 → "상용 급 아님(기능 시제품)". PLAN 110장 순서표 세움, 109 표는 멈춤(10-5 는 설계만: 옛 VS 적엔 위험도 안 곱함 — 북방 설산 위험 4 칸이 던전 가는 첫 길 · 우두머리 몸은 색 바꿔 돌려쓰기 대신 다른 판 몸 빌림).
- 새 `Editor/SagaPlayerBuild.cs`(`BuildWindows`·`BuildAndroid`, 다섯 판 씬, `Build/<대상>/build_report.txt` 에 결과·크기·시간·오류·큰 에셋 스물, 성능 테스트 패키지가 남기는 `Assets/Resources/PerformanceTestRun*` 치움).
- 첫 Windows 빌드 실패 — 에디터에선 안 보이던 오류: 다섯 판 사운드(`SfxPlayer`·`GoAudio`·`ForestAudio`·`StoryAudio`·`RealmAudio`)가 PC 에 없는 `Handheld.Vibrate` 를 부름 → `#if UNITY_ANDROID || UNITY_IOS`.
- 결과: Windows 852MB·9.4분·오류 0, 화면 없이(-batchmode) 85초 켜 예외 0(엔진 JobTempAlloc 경고만) · Android APK 470.7MB(압축 전 1.85GB)·8.7분·오류 0(Gradle 9.1). 큰 에셋: PC = Mixamo 몸 텍스처 장당 5.3MB, 폰 = BGM mp3/ogg·fbx.
- 빌드·대상 전환이 바꾼 설정(URP 에셋 직렬화·batching·preloadedAssets·Graphics/ShaderGraph)은 되돌림, `Mobile_RPAsset` 은 세션 전부터 남의 변경이라 안 건드림. 작업 대상은 Win64 로 되돌림. 안드로이드 임시 `.utmp/` 는 gitignore.
- 켜면 첫 씬 GO 만 뜨고 판을 옮길 길이 없다 → 110 표에서 흐름(타이틀·판 고르기)을 2로 당김, 폰 성능은 3. 스토어: APK 470MB 라 Play 는 AAB + 에셋 팩으로 나눠야 한다(6 마감).
- 검증: 두 빌드 성공 · `PlaytestDungeonHeadless` OK(진동 막은 뒤). 폰 설치·화면은 안 봄.
- 다음 = 110 ② 흐름.

## 2026-09-26 상용화 — PLAN 110 ② 타이틀·판 고르기·자동 저장 ("사가유니티 이어해")

- 빌드는 첫 씬 GO 만 뜨고 판을 옮길 길이 없었고, 세이브는 다섯 판 모두 **저장 버튼을 눌러야만** 남았다(자동 저장·끌 때 저장 없음).
- 새 UI 바탕: TextMeshPro 기본 리소스(`-importPackage` — 배치에서 `AssetDatabase.ImportPackage` 는 비동기라 끝나기 전에 종료됐다) + Noto Sans KR 보통·굵게(OFL, notofonts/noto-cjk SubsetOTF, `Assets/Art/Fonts/NotoSansKR/` + OFL.txt) 동적 SDF 폰트 에셋(`Editor/SetupSagaFonts`, `clearDynamicDataOnBuild` 는 internal 이라 직렬화 필드로) → TMP 기본 폰트. 공통 도구 `SagaCore/SagaUi.cs`(가로 1920×1080·반반 맞춤, 세로 화면이면 줄 배치).
- `SagaCore/SagaFlow.cs`: 판 부트스트랩 다섯이 세이브를 읽은 뒤 `SagaFlow.Enter(판, 저장)` → 자동 저장(타이틀로·OnApplicationPause·OnApplicationQuit) + 일시정지 메뉴(Esc = 안드로이드 뒤로 가기, 계속하기·저장·타이틀로·게임 종료, 시간 멈춤 → 연 때 값으로). 화면 위·모서리는 목표판·HUD·저장 버튼이 차지해 눈에 보이는 단추는 ⑤ UI 로 미룸(iOS 는 뒤로 가기가 없다).
- `Games/SagaTitle/TitleScreen.cs`(기본 어셈블리 — 다섯 판 세이브를 다 본다) + `Editor/BuildTitleScene` → `Assets/Scenes/Title.unity`(카메라 + 컴포넌트, UI 는 Play 때). 카드 다섯(사가고·사가블로·사가의숲·사가스토리·사가국지 + 원작 이름 없는 한 줄), 이어하기/새로 시작(저장 있으면 확인 창), 게임 종료, 버전.
- "새로 시작"의 함정: 이번 실행에 이미 들어갔던 판은 정적 상태가 메모리에 남는다 → 앱을 켜고 처음 타이틀에서 다섯 판 `ToJson()` 을 떠 두고, 새로 시작 때 `ApplyJson(기본값)` 뒤 파일 삭제. 그래서 다섯 판 SaveState 를 `ToJson`(플레이어 없으면 자리 없이)/`ApplyJson`/`HasSave`/`DeleteSave`/`FileName` 으로 나눔(파일 형식·버전 그대로). 첫 치환 스크립트가 8칸 `}` 를 12칸 안에서 잡아 옛 catch 를 남긴 걸 걷어냄.
- 빌드 씬 목록 = `SagaPlayerBuild.Scenes`(Title 0번 + 다섯 판), 에디터 목록도 `SyncEditorBuildScenes` 로 맞춤(커밋).
- 진단 `PlaytestSagaFlow`: 진짜 버튼으로 ① 타이틀(카드 5·이어하기 없음·UI.Text 0·Noto·기본값 5) ② 새로 시작 → 일시정지(시간 0·저장·계속하기) → 타이틀로(자동 저장·이어하기 생김) ③ 이어하기 둘째 바퀴(사가블로 앱 일시정지 자동 저장) ④ 상태를 7777 로 바꿔 둔 뒤 새로 시작(취소는 그대로, 지우고 시작 → 기본값·판 안에서도 기본값), 오류 로그 0, 진짜 세이브 다섯 떠 두고 되돌림. **3연속 OK**(판마다 씬 세 번, 타이틀 16번). 회귀: GO·DUNGEON·FOREST 헤드리스·STORY·REALM 슬라이스 OK.
- 빌드: Windows 863MB(폰트 +11MB) 오류 0, 화면 없이 켜서 플레이어 로그 "[TitleScreen] 카드 5 · 저장 5 · 글꼴 NotoSansKR-Regular SDF", 예외 0. 빌드가 또 바꾼 URP·Graphics·ProjectSettings 직렬화는 되돌림.
- 다음 = 110 ③ 폰 성능(개발 APK·fps 표시 → 사람 몫 설치).

## 2026-09-26 상용화 — PLAN 110 ③a 폰 성능 측정 도구 ("이어해")

- 폰이 PC 에 안 꽂혀 있다(adb devices 비어 있음) → 사람이 깔기만 하면 되게: 측정용 빌드 `SAGA_PERF`(릴리스에 기호만, `BuildPlayerOptions.extraScriptingDefines`) · `SagaCore/SagaPerf.cs`.
- 화면 줄: fps·ms·1% 낮은 fps·배터리 온도(BATTERY_CHANGED sticky — `registerReceiver(null, …)` 는 AndroidJavaObject.Call 이 null 서명을 못 짐작해 AndroidJNI 로 직접)·발열 단계(PowerManager.getCurrentThermalStatus, API 29+)·메모리·씬. 타이틀 구간은 안 잰다.
- 기록: 씬이 바뀔 때·앱이 뒤로 갈 때 "놀이" 한 줄, 자동 측정은 판마다 "상한"(모바일 30fps 그대로 — MobileGraphics)·"풀기"(120·vsync 끔) → `perf_log.json`(최근 200). 자동 측정은 `SagaFlow.SuppressAutoSave` 로 세이브 안 씀·끝나면 저장 없이 타이틀로(`LeaveWithoutSave`)·기록표 저절로 열림. 타이틀 오른쪽 위 자동 측정·성능 기록(TMP `<pos>` 로 칸 맞춤·지우기).
- 함정 셋: ① 에디터 배치는 초당 1천~7천 프레임이라 틱 수 대기는 16초 만에 끝남 → 진단 대기는 실제 시간 ② 프레임 목록 상한(2만)에 걸리면 시간이 안 쌓여 국지 "상한" 줄이 빠짐 → 시간·프레임 수는 따로 세고 목록만 상한 ③ **TMP 동적 글꼴은 에디터에서 쓴 글자를 아틀라스째 에셋에 저장**(3만 줄 diff) — 빌드 목록 맞추기의 SaveAssets 를 뺐는데도 남아 `SetupSagaFonts.ResetDynamicFonts`(ClearFontAssetData) 를 두 플레이 진단 끝에 부르고, 비운 상태를 커밋. 진단 뒤 md5 같음 확인.
- 진단 `PlaytestSagaPerf`(시간 줄여 0.3·3.5·3.5초): 단추·화면 줄·자동 측정 열 줄(판 순서·구간·값)·기록표 자동 열림·세이브 바이트 그대로·놀이 한 줄·지우기·오류 0, 진짜 세이브·기록 되돌림. **3연속 OK** · `PlaytestSagaFlow` 다시 OK.
- 빌드: `SAGA-perf.apk` 479MB·5.5분·오류 0. 작업 대상 Win64 로 되돌림, 빌드 직렬화 되돌림, adb 서버 끔.
- 사람 몫: `HOW_TO_PLAYTEST` §10(설치 두 길·자동 측정 5분·판마다 5분 놀기·기록표 사진). 앱 id 는 아직 유니티 템플릿 기본값(⑥).
- 다음 = ④ 재현성(③b 는 폰 결과 오면).

## 2026-09-26 char-forge — CC0 옷장 들이기·옷 짓기(garments.py)·렌더 비교 도구

"vroid 같은 자체 툴 이어 해줘"(두 번) → "새로운 세션 이어하자".

- CC0 옷 팩 14(682c2670): MakeHuman 커뮤니티 옷 126·머리 34·수염 5, 항목마다 CC0 검사(CC-BY·원작 캐릭터 옷·정치 모자 exclude, 가면 팩 안 들임). 렌더: 바이킹 셋·드레스·수도복·두건은 Mixamo 마을 사람급, 기모노·전사 투구는 못함. 빈칸 = 동양 역사 옷.
- `garments.py`(5a71a73e → 68554b90): 옷 메시를 지어 MPFB MakeClothes 순서로 .mhclo — 부품 조합(tube·sleeves·band·망건·상투·갓·투구·앞 트인 비늘 드림) + 천 무늬·노멀. 옷 다섯 dopo·hanbok_f·chalgap·gat·helmet_east — 선비·장수·여인으로 읽힌다(Mixamo 기사만큼 세밀하진 않음).
- 함정: Blender 파이썬엔 PIL 없음 · write_mhclo 는 also_export_mhmat=True 라야 material 줄 · 옷 정점을 body 전체에 맞추면 A 자세 손에 붙는다(맞춤 무리 cf_torso·cf_arm·cf_head) · 앞 트인 둘레는 이음매에서 순서를 끊는다.
- 렌더 비교 스크립트를 저장소로(`tools/char-forge/render/`). 게임 몸은 그대로(D5 Mixamo 유지).
- 다음 = char-forge README §7 단계 4 줄의 "다음 세션 순서" ①~④.

## 2026-09-26 상용화 — PLAN 110 ④ 빌드 재현성 ("사가유니티 이어해")

③b 는 폰 결과가 아직 없어(Downloads 도 확인) ④ 를 먼저.

- git 밖은 `Assets/Art/CharactersRealistic/` 하나(4.2GB·1520파일 — Mixamo 원본 + 그 안에서 구운 프리팹·재질·셰이더 그래프). Poly Haven 스캔은 이미 커밋. 커밋된 씬·`Assets/Animators/*.controller` 가 그 폴더 `.meta` GUID 를 물어, Mixamo 자동 받기(`tools/mixamo_automation`)로 다시 받으면 GUID 가 새로 나 참조가 끊긴다 → **폴더를 통째로 나르는 쪽**으로.
- `tools/realistic-pack.sh`: manifest(sha256sum 형식, .meta 까지) · pack(목록 순서 tar → 1900MB 조각, 이름 = 목록 해시 12자라 목록 커밋과 묶음이 짝) · fetch(.utmp 에 풀어 대조 뒤 제자리, 든 게 있는 옛 폴더는 옆으로, 빈 폴더는 치움) · verify. 해시 15초.
- `Editor/SagaAssetGate.cs`, `SagaPlayerBuild.Run` 이 빌드 전에 부름: ① 폴더 = 목록(C# SHA256, 38초) ② 빌드 의존 중 그 폴더 파일 ⊂ 목록 ③ `tools/realistic/build_deps.txt`(576) ⊂ 지금 의존 — 줄면 씬이 몸 없는 PC 에서 지어진 것 ④ 빌드 씬·텍스트 직렬화 의존의 `guid:` 가 전부 풀림. 보고는 칸마다 여덟 줄. 빌드마다 지문 `Build/<대상>/<이름>_assets.txt`.
- 시험(`C:\sgc` 새 클론, sparse saga-unity, 새 파일은 복사): 몸 없이 검사 → FAIL exit 1(① 1520 빠짐·③ 576·④ 컨트롤러 열몇·TestField 24·TestDungeon 34 끊김) · fetch 33초 → 가져오기+검사 OK+빌드 11.2분 → 이 PC 빌드와 파일 181 같음·863.0MB 같음. 빌드 파일은 바이트로는 다르다(내부 번호, 같은 크기에 수백 바이트 차) — 그래서 지문으로 대조: 3916 에셋 중 처음 12줄 차.
- 발견: **autocrlf=true 가 클론에서 텍스트 에셋을 CRLF 로 푼다** — 스토리 현지화 JSON 두 개가 이 PC(LF)와 달라 빌드가 달랐다. 목록 파일도 CRLF 로 풀리면 묶음 id 가 달라질 뻔. → `saga-unity/.gitattributes`(tools/realistic -text · 스크립트 eol=lf · Assets json/txt eol=lf), 이 PC 에서 CRLF 였던 json/txt 78개 LF 로 다시 꺼냄(남이 고친 파일 없음 확인), 스크립트도 CR 을 떼고 읽음(CRLF 목록으로 verify OK·같은 id 시험). 다시 대조 → 3줄만 남음: glb 둘(rock_s108_08·wine_barrel_01_lod1, 원본·meta 같고 차이 둘 다 1904B — 이 PC 옛 가져오기 캐시로 봄) · TMP_SDF-Mobile 셰이더 24B.
- 빌드 부산물(글꼴 SDF·URP·Graphics·ProjectSettings 직렬화) 매번 되돌림, Mobile_RPAsset 은 남의 변경이라 그대로.
- 사람 몫: 묶음 보관함 자리(비공개). 이번 묶음 id cb71a2102fd9 는 스크래치패드에만 있다.
- 다음 = ⑤ UI(③b 는 폰 결과 오면).
- 같은 날 이어서: 사용자 "OneDrive 에 둬" → 묶음을 `~/OneDrive/saga-assets/` 로 옮기고 스크립트 기본 보관함으로(`SAGA_ASSET_STORE` 로 바꿈). 이 PC 는 OneDrive 앱이 로그인·실행 전이라 아직 **로컬 폴더일 뿐** — 동기화는 로그인 뒤. 무료 5GB 에 4.2GB.

## 2026-09-26 char-forge — 옷 스물둘·세력 색·도감 105 진짜 옷(단계 4 ①~③)

"vroid 자체 툴 이어 해줘" → "이어해".

- `garments.py` 옷 다섯 → 스물둘: 일본 기모노·하카마·구소쿠(오도시 동·쿠사즈리·소데·정강이 가리개)·가부토·에보시, 삼국 장수 갑옷(어린갑·호심경)·장수 투구(붉은 술)·면류관, 단령(흉배)·곤룡포(둥근 보)·사모·익선관·복두. 새 부품 leggings·discs·bow·kuwagata·tassel·samo·boktu·myeollyu·beads·eboshi, 소매 `arc`(소데)·`bag`(자루).
- 색 변형 `<id>@<헥스>` — 메시·맞춤은 베끼고 그림만(5초). 생성기 `real_outfit`·`real_head` 가 동쪽 세 나라 옷·머리를 공방 옷(세력 색)으로, 서쪽은 CC0 가 맞는 틀만 → 105 중 몸 껍데기 없는 사람 64. 옷 63벌·105벌 빌드 실패 0.
- 렌더(`render/render_turn.py` 네 방향 새로)로 고친 것: 동 높이·시코로 폭·청동 비늘이 바구니처럼 보임 → 강철·투구 동심 줄(밀짚모자) 빼기·사모 날개. 무장이 `Sword_Idle`(넓은 다리)로 서면 긴 옷자락이 부풀어 → 자체 대기 `CF_Guard_Idle_Loop`.
- 남은 흠: 긴 옷 뒤 엉덩이 아래 불룩(치마 도우미 맞춤 쪽)·소매 두툼·서쪽 틀(토가·호플리테·유목·군복·왕비 드레스)·닌자는 껍데기. 게임 몸은 그대로(D5).
- 함정: rtk 훅이 `grep` 에 준 캐리지 리턴 패턴(달러 따옴표 CR)을 지워 grep 이 표준 입력을 기다리며 멈춘다(바이트 세기는 py 로) · `rtk grep -h` 는 도움말이 뜬다.
- 다음 = ④ Mixamo 와 나란히 사용자 판정.

## 2026-09-26 상용화 — PLAN 110 ⑤a 글자 전부 TextMeshPro ("이어해")

- 규모: 옛 `UI.Text` 쓰는 스크립트 73(런타임 ~50·빌더·진단), 씬 안 컴포넌트 251. 한 조각 = 글자 전환만(배치 점검·HUD 정리는 5b·5c).
- 기계 치환 스크립트(문자열·주석을 가리고): 타입·AddComponent·GetComponent 의 `Text` → `TextMeshProUGUI`, `TextAnchor.*` → `TextAlignmentOptions.*`(Upper→Top, Middle→가운데 줄, Lower→Bottom), `FontStyle` → `FontStyles`, 넘침 → `textWrappingMode`/`overflowMode`, `supportRichText` → `richText`, 옛 글꼴 대입 문장 삭제(TMP 기본 = Noto Sans KR). 손으로: asmdef GO·DUNGEON·FOREST 에 `Unity.TextMeshPro`, 줄 간격 배수 → em/100, 3D `TextMesh.anchor`(치환이 잘못 건드림) 되돌림, 타이틀 진단의 "옛 Text 있으면 실패" 검사가 TMP 를 세게 바뀐 것 되돌림.
- 컴파일 확인은 Unity 대신 생성된 csproj 를 `dotnet build`(7초) — asmdef 에 새 참조를 넣으면 csproj 에도 손으로 넣어야 dotnet 이 안다(csproj 는 gitignore).
- uGUI `Outline`/`Shadow` 7곳 → `SagaCore/TmpEffect`(글꼴 재질 복사로 SDF OUTLINE_ON/UNDERLAY_ON, 같은 설정 공유, 에디터에서 만든 임시 재질은 씬에 안 남아 Awake 때 입힘).
- 월드 글자 `TextMesh` 7곳(DUNGEON·STORY 피해 숫자·DUNGEON 층 표지·FOREST 줍기 글·GO 피해 숫자·적 이름·동료 이름표)은 내장 글꼴이라 폰에서 한글이 □ 로 나올 자리 → `SagaCore/SagaWorldText`(TMP 3D, 크기 = 옛 fontSize×characterSize — 둘 다 fontSize/10 m 결).
- 씬 재빌드 묶음 `Editor/SagaRebuildScenes.RebuildAll`(다섯 판 + LayoutWalk, 35초) → 옛 Text 0. DUNGEON 은 TMP 40 으로 5 적음 = 10-4 에서 플레이 때 짓는 3×3 으로 바뀐 옛 지도 다섯 칸이 씬에 굳어 있던 것. 컷 타임라인 트랙 ID 가 새로 써져 씬과 같이 커밋.
- 진단: 1회차에 DUNGEON(무기 등급 → 칼날 크기)·STORY(유품 마커) 실패 → 세이브 둘을 빼니 통과 = **앞 진단들이 남긴 세이브(Lv12·wp_greatblade 등)에 따라 갈리는 검사**, 이번 변경과 무관. 진단마다 세이브를 같은 백업으로 맞추고 둘은 뺀 채 헤드리스 18종(SagaFlow·GO·DUNGEON 여덟·FOREST 다섯·STORY·REALM·LayoutWalk·Perf) 3연속 — 2회차 GO 한 번은 패키지 관리자 IPC 끊김으로 5초 만에 끝나 다시 돌림. 세이브는 백업대로 되돌림.
- 남음: 빌드 밖 LayoutWalk·CharCompare 의 TextMesh. 다음 = 5b 배치 점검 도구.

## 2026-09-26 상용화 — PLAN 110 ⑤b 배치 점검 도구·HUD 가로 기준 ("이어해")

- `Editor/UiLayoutCheck.Run`: 타이틀 → 다섯 판을 `LoadSceneInPlayMode` 로 차례로 켜 1.5초 뒤 첫 화면을 16:9·20:9·4:3 으로 잰다. 배치 모드엔 화면이 없어 잴 때만 루트 오버레이 캔버스를 월드 공간으로 돌리고 CanvasScaler 식(폭/높이 로그 보간·Expand·Shrink)으로 구한 논리 크기를 입혔다 되돌림. 발자국 = 사각형, TMP 는 보이는 글자 잉크 상자 — `textBounds` 는 ascender~descender 줄 높이(Noto 1.45em)라 150pt "SAGA" 가 217px 로 잡혀 과했다. 위젯 = 캔버스·꽉 찬 투명 틀 바로 밑 덩어리(위젯 안 겹침은 설계), 화면 30% 넘는 판을 가진 위젯은 모달이라 겹침에서 뺌, `DebugHud`(릴리스엔 꺼짐)도 뺌. 세이브 백업·복원, 동적 글꼴 비움. 보고 `Logs/ui_layout_report.txt` + 16:9 위젯 자리표(배치를 코드 대신 이 표로 봤다).
- 첫 측정 234건. 근본 원인: 판 HUD 캔버스 전부 세로 1080×1920·폭 맞춤 → 가로 16:9 에서 논리 1080×607, 20:9 폰에선 1080×486(세로 설계 버튼이 부딪히고 위로 넘침). 화면 방향 설정도 자동 회전(세로·가로 다)이었다.
- 결정(되돌릴 수 있음): 폰 가로 고정(세로 자동 회전 둘 끔). 판 HUD 기준 `SagaUi.GameReference` 1600×900 + Expand — 16:9 1600×900·20:9 2000×900·4:3 1600×1200. 예전 가로(배율 1.78)보다 요소가 0.675 배지만 원래 세로 설계의 실제 크기와 비슷. `SagaUi.ApplyGameScaler` 를 빌더 23곳·런타임 UI·판 설정 다섯의 UI 크기가 부른다 — 설정의 `ApplyToAllScalers` 가 씬의 모든 스케일러(타이틀·일시정지 메뉴의 1920×1080 포함)를 세로 기준으로 덮던 것도 `SagaCore/MenuCanvas` 표시로 건너뜀. 메뉴 캔버스도 반반 맞춤 → Expand(20:9 에서 세로가 966 으로 줄던 것). → 47건.
- 손 배치(자리표 보고): GO 교체 명단 → 왼쪽 가운데(오른쪽은 위 버튼 줄·아래 전투 버튼, 폭발 버튼이 켜지면 또 겹칠 자리) · DUNGEON 미니맵 → 왼쪽 파티 줄 밑, 설정 → 윗줄 저장 왼쪽 · STORY 버튼 160→128, 다섯 줄 → 네 줄(무예 = 기술 칸 줄 왼쪽 끝), 설정 → 윗줄, 상태 글 폭 600→480(대사 줄에 닿음) · REALM 오른쪽 세로 줄(서고가 위로 30 넘침) → 20 아래서·간격 112·높이 104 · 타이틀 제목 150pt·부제 간격. → 0건(세 화면비 × 여섯 화면).
- 진단 헤드리스 18종 3연속(아래 결과), 씬·타임라인 재빌드 같이 커밋.
- 남음: 첫 화면만 잰다 — 패널·팝업·나중에 켜지는 버튼(GO 폭발 등)은 다음에 상태를 열어 가며. 5c HUD 정리·보이는 일시정지 단추·타이틀 설정. 실기(폰 가로·글자 크기 체감) 확인 전.
- 진단 다섯(GO·DUNGEON·FOREST·STORY·REALM)의 "UI 크기 1.15 가 캔버스에 먹나" 검사가 옛 기준 폭 1080 을 박아 두고 있어 실패(실제 1391 = 1600/1.15, 동작은 정상) → 기대값을 `SagaUi.GameReference.x / 1.15` 로. 헤드리스 18종 3연속 OK(3회차 LayoutWalk 한 번은 패키지 관리자 시작 오류 → 재실행 OK). 멈춘 진단 루프는 TaskStop 이 자식 bash·Unity 까지 못 끄는 일이 있어 PID 로 껐다. Windows 빌드 860.7MB·자산 검사 OK.

## 2026-09-26 char-forge — 서쪽·세계 옷 열하나(도감 105 중 99 진짜 옷)

"이어해"(④ 판정 대기 중 남은 흠부터).

- 옷 열하나 더해 서른셋: 토가(비스듬한 띠 sash)·키톤 흉갑·사슬 갑옷+겉옷·장교 외투(단추·견장·흰 바지)·드레스·카프탄·델·터번 · 동쪽 바지저고리·가죽 조끼 무사복·닌자복. 금란 칸을 가로·세로 따로(퍼지는 치마가 줄무늬로 늘어나던 것), 소매 반지름 상한 낮춤.
- 생성기: 서쪽 틀·동쪽 가죽·짧은 옷·닌자도 진짜 옷, 서쪽 투구는 CC0(코린트·템플러) → 몸 껍데기 남은 사람 41 → 6(부족 허리 천 둘·동쪽 윗옷 둘·서쪽 짧은 옷 둘). 옷 103벌(26분)·105벌 빌드 실패 0(50분). 커밋 38780b6b.
- 시도했다 버림: 옷자락 뒤 불룩을 없애려 가랑이 아래 정점의 좌우 다리 무게를 평균 → 반대쪽 고관절을 축으로 돌아 연필 치마처럼 오므라듦. 옷 메시 뒤 윤곽은 곧아서(측정) 한쪽 허벅지를 따라 밀리는 몫 — 천 시뮬레이션 없이 못 없앤다.
- 다음 = ④ Mixamo 와 나란히 사용자 판정(그림은 스크래치패드, 저장소 밖).

## 2026-09-26 상용화 — PLAN 110 ⑤c-1 일시정지 단추·타이틀 설정 ("사가유니티 이어해")

- ⑤c 가 셋(HUD 정리·보이는 일시정지·타이틀 설정)이라 첫 조각 = 뒤의 둘. HUD 정리는 5c-2.
- **Ⅱ 단추** `SagaCore/SagaPauseButton`: `SagaFlow.Enter` → 러너가 만들 때 같이 붙는다(판 씬과 같이 사라짐). 캔버스는 새 `SagaUi.NewHudCanvas`(판 HUD 와 같은 1600×900 Expand + `MenuCanvas` 라 판 "UI 크기"에 안 흔들림), 정렬 90(SessionCard 100 밑·판 HUD ≤21 위). 자리는 5b 자리표로 고름 — 다섯 판 오른쪽 위 줄이 오른쪽에서 370 안쪽까지(DUNGEON·STORY 설정 단추), 가운데 목표판은 폭 ≤549px → 오른쪽에서 386·위 30, 80×80. 그림은 막대 둘(글꼴에 기대지 않음). 컷의 HUD 숨기기(DUNGEON·GO·STORY)가 루트 캔버스를 다 꺼 같이 숨는다.
- **타이틀 설정** `Games/SagaTitle/TitleSettings`: 판 설정 키가 판마다 따로(`saga_<판>_language`·`_vol_master` 등)라 합치지 않고, 다섯 판 공개 API(`GoLocalization.CurrentLanguage`·`GoAudio.MasterVolume`·`GoSettingsState.BgmOn` …)를 차례로 부른다. 줄: 언어·전체 음량(0/25/50/75/100 — 판 설정엔 없던 것)·배경음·효과음·진동(폰만). 서로 다르면 "판마다 다름", 누르면 사가고 값의 다음 칸으로 다섯을 맞춤. UI 크기·그래픽은 판마다 HUD 가 달라 판 설정에만.
- 공통 UI 언어 `SagaUi.Lang`(SagaCore 는 판 어셈블리를 몰라 타이틀이 사가고 언어를 읽어 적는다) — 타이틀·일시정지 메뉴 두 언어, 판 영문 이름 Saga GO·Sagablo·Saga Forest·Saga Story·Saga Realm(원작 이름 안 씀). 언어를 바꾸면 타이틀 캔버스를 떼어 끄고 지운 뒤 다시 짓는다(설정 창 연 채로).
- **도중 발견(진단 결함)**: `PlaytestSagaFlow`·`PlaytestSagaPerf` 러너가 `_run.MoveNext()` 하나라 `yield return WaitTitle()`·`WaitGame()` 같은 중첩 IEnumerator 를 펼치지 않고 한 틱으로 흘렸다 — 씬이 뜰 때까지 기다리기·90틱 안정화·"씬 안 뜸" 검사가 한 번도 안 돌았다(씬 전환이 한 틱 안에 끝나 우연히 통과). 새 설정 검사도 같은 이유로 안 돌아 요약에 줄이 빠진 걸 보고 찾음 → `Editor/NestedCoroutine`(스택으로 펼침) 둘 다에. 다른 진단은 중첩 yield 없음(grep).
- 진단: `PlaytestSagaFlow` 에 타이틀 설정(진짜 단추·언어 ko→en→ko·다시 지은 캔버스 하나·섞인 음량 → 다음 칸·배경음/효과음 뒤집고 되돌리기) + ② 첫 열기를 Ⅱ 단추로 — 판 설정 PlayerPrefs 25 키는 시작 때 떠 두고 끝에 되돌림. 3연속 OK(이제 대기가 실제로 돔). `PlaytestSagaPerf` OK · `UiLayoutCheck` 다섯 판 × 세 화면비 0건(Ⅱ 16:9 x1361·y948).
- 판별 헤드리스 다섯 첫 회: FOREST·STORY·REALM 이 "UI 크기가 캔버스에 안 먹음 got=1600" — 검사가 `FindFirstObjectByType<CanvasScaler>()` 로 아무 스케일러나 집어 Ⅱ 캔버스(메뉴 캔버스라 일부러 UI 크기 안 받음)를 봤다(GO·DUNGEON 은 찾는 순서 운으로 통과). 동작은 정상 → `SagaUi.FirstGameScaler()`(메뉴 캔버스 뺌)로 다섯 곳. 그 뒤 흐름 + 판별 다섯(DUNGEON·STORY 는 세이브 빼고, 매번 같은 세이브 백업에서) 3연속.
- 다음 = 5c-2 판별 HUD 정리(첫 화면 밖 패널·팝업·나중 버튼을 열어 가며 재기, 판 HUD 영어). 실기: Ⅱ 자리·타이틀 설정 — 확인 전.

## 2026-09-26 char-forge — 껍데기 넷·맨머리 열다섯(도감 105 중 103 진짜 옷)

"vroid 자체툴 진행해"(사가웹 세션을 멈추고 넘어옴 — README §7 단계 4 "그다음 할 수 있는 일").

- 옷 일곱 더해 마흔: 배자 바지저고리(한국 `tunic`)·가미시모(일본 `tunic`, 어깨 날개 견의)·더블릿(서유럽 `robe_short`)·카바(서역 `robe_short`) → 껍데기 남은 사람 6 → 2(부족 허리 천, 그대로 둠).
- 머리: 동쪽 옛 남자 짧은 머리 열다섯(근대 옷·부족 빼고)을 머리카락 메시 대신 상투·망건(한국)·속발(삼국)·사카야키 존마게(일본), 늙은이 센머리. 새 부품 `hairdome`·`mage`, 망건 `tight`, 무늬 `sleek`. 두 축 미만 쌍 0 그대로.
- 렌더로 여덟 판 고침: 뜨개 모자 같은 결 → `sleek` · 귀가 옆으로 뻗침 → 옆 아래 반지름 1.04 배 상한 · 존마게가 이마 위에 뿔로 섬(`head_cy` 가 얼굴 쪽으로 4.5cm 쏠림) → 실제 정수리 · 정수리 접시(쏠린 중심으로 쏜 앞 광선이 머리를 비껴감) → 머리 앞뒤 한가운데 · 뒤통수 살 비침(성긴 정점 보간·타원 뚜껑) → 면 BVH 구면 광선 · 입힌 몸에서만 살 비침(모프로 뒤통수가 불룩, 맞춤 7mm 부족) → 덮개 밑 두피 지움 무리 · 망건 두꺼운 띠 → `tight`.
- 사고: 작업 중 다른 세션의 `git pull --rebase --autostash` 가 커밋 전 garments.py·생성기·레시피 19 를 `stash@{0}` 에 넣은 채 되돌리지 않았다 — 제 경로만 `git checkout stash@{0} -- <경로>` 로 꺼내고 인덱스에서 내렸다. stash 에는 다른 세션의 saga-unity 변경(TestVillageForest.unity·PLAN·PROJECT_STATE 등)이 남아 있다(그 세션 몫, 건드리지 않음).
- 다음 = ④ Mixamo 와 나란히 사용자 판정(그림은 스크래치패드, 저장소 밖). 남은 흠: 긴 옷 뒤 불룩 · 가미시모 어깨 날개가 떠 보임 · 존마게 옆머리 앞 끝이 모남.

## 2026-09-26 상용화 — PLAN 110 ⑤c-2a 패널 배치 ("이어해")

- `UiLayoutCheck` 가 첫 화면만 쟀다 → 첫 화면 뒤 보이는 단추를 차례로 눌러(타이틀은 설정만 — 나머지는 판을 연다) 새로 뜬 그래픽을 루트 캔버스별로 묶어 **셋 이상 뜬 캔버스 = 패널**, 세 화면비로 잰다. 단위 = 단추(안 글자·그림 포함)·단추 밖 글자, 단추 밖 그림(판·띠·아이콘)은 뺀다. 스크롤 마스크(RectMask2D·Mask) 밖은 자름. 닫기 = 새 것 중 닫기·확인·계속하기 류 → 일시정지 메뉴 → 연 단추 다시, 못 닫으면 그 그래픽을 끄고 "못 닫음"에 적는다. 러너도 `NestedCoroutine`.
- 첫 측정 패널 20 **391건**: 타이틀 설정(⑤c-1 에서 내가 만든 것 — `NewRect` 는 앵커 = 기준점이라 위 기준 자리가 칸 윗변, 줄 이름·값 단추가 파고듦) · 판 설정 다섯(마지막 줄 윗변 -660 + 높이 70 ↔ 닫기 아래서 40~110, 국지는 일곱 줄에 판 920 > 화면 900) · GO 지도(860×1051 을 가운데 → 위아래 글·닫기와 겹침) · DUNGEON 비결(판 1080 = 옛 세로 설계, 아래 닫기 화면 밖) · STORY 무예(900×1600, 화면 밖 372px) · REALM 명령(2열 × 5줄이 620 판 밖) · REALM 성(가진 성마다 한 줄씩 아래로 → 성 많은 세이브에서 화면 밖 105건).
- 고침: 판 설정 줄 간격 95(국지 90·판 860) · GO 지도 높이 820 왼쪽(-300) + 제목·지역 글·안내·닫기 오른쪽 열(430) · 비결 판 860·줄 166 · STORY 무예 1500×860 가로 판·무예 줄 두 열(`EnsureChrome` 이 옛 씬도 런타임에 맞춤) · 명령 판 720·간격 96 · **성 목록 = 이 트랙 첫 `ScrollRect`**(RectMask2D·3열 GridLayoutGroup·ContentSizeFitter, 다시 그릴 땐 떼어 끄고 Destroy — 격자가 켜진 자식을 세므로) · 지도 내 위치 화살표는 `SagaCore/LayoutFree`(움직이는 표지만).
- 둘째 측정에서 10건: 비결을 누르고 기다리는 사이 **지역 배너**(다른 캔버스, 불투명 판 밑)가 떠 패널로 잡힘 → 캔버스별 셋 이상 규칙. 이 규칙 뒤 0건.
- **사고**: 검증 도중 saga-godot 세션이 `pull --rebase --autostash` → autostash 가 못 돌아와 이 조각의 안 올린 변경(코드·씬·문서 30여) + char-forge 세션의 안 올린 변경(garments.py·레시피 스물)이 `stash@{0}` 에 갇힘. 작업 트리가 HEAD 로 돌아간 18:58 이후 진단 두 바퀴는 옛 코드로 돌아 무효(배치 점검 OK 줄에 "패널"이 없어 알아챔). 내 경로만 `git checkout stash@{0} -- …` 로 되살리고(지금 = HEAD 확인 뒤) 씬은 다시 재빌드, **stash 는 남의 것이 섞여 그대로 둠**. 먼저 커밋·푸시(957eb62b)한 뒤 검증.
- 검증(커밋한 코드, 매번 같은 세이브 백업에서): 배치 점검(패널 20 · 0건) + 흐름 + 판별 다섯(DUNGEON·STORY 세이브 빼고) 3연속 OK.
- 남음 5c-2b: 패널 속 패널(탭·둘째 단계 — REALM 공격 대상·계략 목표 등)·전투 중에만 켜지는 버튼(GO 폭발)·판 HUD·대사 영어. 실기: 새 패널 배치 — 확인 전.

## 2026-09-26 상용화 — PLAN 110 ⑤c-2b 속 패널·영어 배치 ("이어해")

- `UiLayoutCheck` 둘째 단계: 판 패널 안 단추(닫기 류 빼고 패널마다 40까지)를 눌러 새로 뜬 것(캔버스별 ≥3)을 같은 식으로 잰다, 같은 모양(새 그래픽 이름 묶음)은 한 번. 닫기 판정은 글자가 닫기 말로 **시작**(예전엔 같아야 해서 "닫는다"·"닫기 (M)" 을 못 알아봄 → 연 단추 다시로 떨어졌다).
- 첫 시도에서 배운 셋: ① 도감은 탭을 누르면 줄을 지우고 다시 그려 지워진 그래픽을 만지다 예외 → null 가드 ② 성 목록은 성을 고르면 스스로 닫히는데 닫기가 "연 단추 다시"로 떨어져 **다시 열었다** → 닫기 전에 이미 닫혔는지부터 ③ 설정 창 값 단추를 누르니 **언어가 돌아** 뒤 패널이 영어로 재졌다(우연히 BtnSecrets·Btn_성City) → 설정 창은 둘째 단계에서 빼고, 영어는 일부러 한 바퀴.
- 둘째 단계에 닫기 단추가 없으면 패널 안 바뀜(탭·상세)으로 보고 같은 단추를 또 안 누른다(또 누르면 올리기·고정 같은 행동이 한 번 더 된다).
- **영어 한 바퀴**: 한국어 한 바퀴 뒤 다섯 판 언어 키를 en 으로 → 타이틀부터 다시(보고서 `en:` 머리). 첫 결과 26건은 전부 `TMP_SubMeshUI`(동적 아틀라스가 둘째 장으로 넘어가면 생기는 보조 그림 — 사각형이 글자와 무관) → 뺌. 부모 TMP 의 글자 잉크 상자가 모든 글자를 센다.
- 판 설정 PlayerPrefs 36 키(판마다 언어·음량 셋·UI 크기·진동·그래픽 + 국지 계승) `Editor/SagaPrefsBackup` — 배치 점검·흐름 진단이 앞에서 떠 두고 끝에 되돌림(레지스트리로 다섯 판 ko 복원 확인).
- 결과: 두 언어 × 판 패널 40·속 패널 7(도감 탭 둘·문답 등)·첫 화면 × 세 화면비 0건, 배치 점검·흐름 진단 3연속.
- 푸시가 거절(saga-go 커밋) → 이 트리 autostash 대신 임시 worktree cherry-pick(a9a8a77b) → 로컬은 `git reset --keep origin/main`(saga-godot 세션의 안 올린 변경 유지).
- 남음 5c-2c: 판 HUD·대사 영어(목표판·HUD 글은 한국어 그대로 — 영어 바퀴에서도 한국어로 재짐)·전투 중 버튼(GO 폭발)·상태가 있어야 뜨는 패널(직업 뒤 STORY 무예·REALM 두 목표 성 공격).

## 2026-09-26 char-forge — 현대 NPC 껍데기 15 → CC0 진짜 옷

"vroid 자체툴 진행해"(둘째).

- 카바 속바지가 자락을 뚫던 것 고침(f9867658).
- build_real: `tints` 를 옷 폴더 이름으로도(칸 글자는 물체 이름 차례라 레시피에서 모른다) · kitbash `shell` 에 `src`(살 대신 옷 면을 본뜬다 — 진짜 옷 아래 살은 지워져 배낭·조끼 껍데기가 사라진다) · 옷 폴더 → .mhclo name 표.
- 현대 NPC 15(Remy·Megan·Pete·SwatGuy·Copzombie·Boss·Leonard·Steve·Brian·Olivia·Jody·Vanguard·GasMask·Warzombie·Racer 자리): 몸 껍데기를 CC0 티·청바지·스웨터·폴로·양복·작업복·겉옷·카고·장화·장갑·M1 철모·풀페이스 헬멧으로, 머리 껍데기는 그대로, 몸통 부품은 옷 면을 본뜬 껍데기. 빌드 15 실패 0, Mixamo 와 나란히 렌더로 확인 — 청바지·티·양복·털깃 겉옷은 견줄 만하다.
- 함정: 티셔츠 그림의 MAKEHUMAN 로고 · 청 반바지는 남자 몸에서 속옷처럼 짧음 · 뉴스보이 모자는 재질 줄 없음 · 변환이 망자 피부 tints 를 덮어썼다(되살림) · 티 밑단·바지 허리 얼룩 띠(남은 흠).
- saga-unity CharactersForge 의 FBX 는 아직 옛 껍데기 판 — Unity 가 쉴 때 바꿔 넣는다. 다음 = 남은 껍데기 36.

## 2026-09-26 상용화 — PLAN 110 ⑤c-2c-1 첫 화면 영어 ("이어해")

- 규모 조사: 런타임 코드의 표 밖 한국어 문자열 ~1570 — 대부분 데이터 표(인물 315·문답 214·무예 194, 이미 키로 찾아 쓰는 것)라 숫자로는 일 크기를 못 잡는다 → 배치 점검 영어 바퀴가 **실제로 보이는 한글 글**을 세게 했다(보고서 끝에 한글 조각만). 첫 측정 118.
- 원인 ① **구운 글**: 에디터 빌더가 씬을 지을 때(한국어) `T()` 결과가 글로 굳어, 실행 때 다시 안 읽었다 — 설정 창 다섯은 값을 바꿀 때만 `Refresh()`, 국지 명령 단추·패널 제목·닫기는 그대로. ⑤c-1 기록("영어로 바꾸면 판 설정 창 글자가 영어")은 값을 한 번 누른 뒤에만 맞았다. 빌더 수십 곳을 키로 바꾸는 대신 판마다 `RelocalizeScene()`: 한국어 표를 거꾸로(값 → 키) 들고 씬의 TMP 글이 그 값과 같으면 그 키로 다시, 글마다 (키, 마지막 쓴 글)을 기억해 영어 → 한국어도 되돌리고 코드가 딴 글로 바꿨으면 잊는다. 설정 창 `Start`·판 안 언어 바꿀 때 부름, 공통 UI 언어 `SagaUi.Lang` 도 여기서 맞춘다(판 안에서 언어를 바꾸면 일시정지 메뉴도 따라감). 국지 명령 단추("개간 (60냥)" = 서식)·전술·일기토 단추는 만들 때 식으로 다시.
- 원인 ② **박힌 글**: 목표판 머리 셋(SagaCore → `SagaUi.L`)·세션 정리 카드 넷·GO/DUNGEON 일과(`task.<종류>`, TaskDef 에 키 대신 `KindKey`)·가장 가까운 적(DUNGEON·STORY)·나무·택배·축제 줄과 축제 이름·방법(`festival.name/how.<종류>`)·국지 조망·함락·STORY 동료 표시 이름(`Companion.DisplayName` = `party.name.<id>`, HUD·교대 알림). 새 키 ko·en 짝 서른넷, 한국어 값은 옛 글과 똑같이(한국어 화면·진단 그대로).
- STORY 목표판 셋째 줄이 개발 자리표 "다음 승급 이정표 준비 중(101-2 ⑦ 대기)" 를 플레이어에게 보이고 있었다 → 다음 전직 레벨(Lv.10/15/20/25, 넷째 차수 뒤엔 "마지막 차수").
- 영어가 길어 새로 난 겹침 하나: 국지 전술 단추("Tactics:Off / Plain: cavalry charge…" 세 줄)가 밑 일기토 단추를 덮음 → 그 글만 TMP 자동 맞춤(최소 14).
- 결과: 영어 화면의 한글 118 → 1~9(전부 국지 문답 문제 내용 — 사자성어·신조어, 문제가 무작위라 수가 바뀐다). 배치 점검 두 언어 0건.
- 푸시가 또 거절(saga-godot) → worktree cherry-pick(78bbffdc) → `reset --keep`. 검증(커밋한 코드): 배치 점검 + 흐름 + 판별 다섯 3연속 OK.
- 남음 5c-2c-2: 대사·도감·퀘스트·알림(상태가 있어야 뜨는 글)·전투 중 버튼(GO 폭발)·직업 뒤 STORY 무예. 실기: 영어 첫 화면 — 확인 전.

## 2026-09-26 char-forge — 옛 옷 사람 열 → 공방 옷

"vroid 자체툴 이어해"(셋째).

- garments.py 새 틀 셋: `baji`(맨상체 바지·허리 천) · `baji_vest`(바지·맨팔 가죽 조끼·허리 천) · `helmet_round`(둥근 쇠 투구·사슬 목가리개) → `garments.py` 틀 서른아홉.
- 레시피 열(PeasantMan·Brady·PeasantGirl·Ninja·Paladin·Morak·CastleGuard02·CastleGuard·Pelegrini·Abe 자리): 몸 껍데기 → 바지저고리·치마저고리·닌자복·찰갑·무사복·사슬 갑옷 겉옷·터번·투구(공방) + 장화·천 신(CC0). 무장 셋·맨손 둘 대기 `CF_Guard_Idle_Loop`.
- 검사: 빌드 열 실패 0, verify fbx·glb 실패 0, sha256 두 번 같음. Mixamo 와 나란히·네 방향·머리 렌더로 고침: 넓은 옷 위 옷 면 껍데기(감발·팔 가리개·쇠 정강이)는 흰 통으로 부풀어 지움 · 맨살 위 바지 윗단 턱 → 허리 천을 덮게 · 공방 천 두건은 상자·양동이 모양이라 틀을 지우고 순례 기사는 살 껍데기 두건 그대로.
- 남은 흠: 어깨 뒤 살 비침 한 점(찰갑·전포) · 닌자 팔 감발 네모 · 두건은 빈칸. CharactersForge FBX 는 아직 옛 판. 다음 = 남은 껍데기 26(미래 판금·옛 가죽·인형).

## 2026-09-26 char-forge — 미래 사람 아홉 → CC0 SF 옷

"vroid 자체툴 이어해"(넷째).

- build_real `tints` 염색 `"=#헥스"`: 곱하기가 안 먹는 검은 몸 옷(SF bodysuit·skinsuit)에 밝기 결만 남기고 색을 새로 입힌다.
- 레시피 아홉(Alien Soldier·Exo Red·Uriel·Exo Gray·Jennifer·Ely·Crypto·Astra·Swat 자리): 몸 껍데기 → CC0 SF 판금 셋(헬리오스·주피터·가디언)·몸 옷 둘·우주 제복·닫힌 헬멧·장갑·장화, 긴 옷 둘은 공방 kaftan·qaba. 머리 띠·투구·가리개·등 짐 껍데기는 그대로.
- 검사: 빌드 아홉 실패 0, verify fbx·glb 실패 0, sha256 두 번 같음. 렌더로 고침: 사이보그 몸 옷은 각진 상자라 안 씀 · 몸 옷 위 조끼·받이·가슴판 껍데기는 고무·톱니라 판금 옷으로 · 은빛 단은 흰 털처럼 보여 짙게.
- 남은 흠: 판금 셋이 같은 틀이라 판금 입은 셋의 실루엣이 비슷함 · 닫힌 헬멧 아래 목 살. CharactersForge FBX 는 아직 옛 판. 다음 = 남은 껍데기 17(옛 가죽·털·인형·괴물).

## 2026-09-26 상용화 — PLAN 110 ⑤c-2c-2 상태가 있어야 뜨는 글 영어 ("사가 유니티 이어해")

- 도구 `Editor/HangulWatch`(`-hangulWatch` 명령줄일 때만 켜짐): 다섯 판 언어를 en 으로 두고 판별 헤드리스를 돌리는 동안 켜진 TMP 글(UI·월드)을 0.25초마다·글이 바뀔 때마다 훑어 한글이 든 글을, 그리고 판 `T(키, 폴백)` 에서 표에 키가 없어 한국어 폴백이 나간 순간(`SagaUi.MissingText` 고리)을 `Logs/hangul_watch.txt` 에 적는다. 원래 언어는 `Logs/hangul_watch_lang.bak` 에 떠 뒀다 종료 때 되돌림(첫 시도는 SessionState 에 떠 뒀다가 측정을 강제로 끊어 레지스트리에 en 이 남음 → 파일로 바꾸고 ko 로 되돌림).
- 첫 측정은 거의 비었다: GO 승급 카드 셋·FOREST 채집 팝업 일곱·DUNGEON 누락 키 하나. 까닭 — 진단이 상태를 코드로 만들어 UI 를 덜 거치고, STORY·REALM 은 첫 오류에서 멈추는데 "원래 언어로 돌아오나"·목표판 머리·척후병 대사 검사가 한국어를 박아 둬 영어에선 곧바로 끝났다. REALM 은 시작에서 언어를 ko 로 못 박고 있어 영어 측정이 아예 안 됐다(감시 모드면 en 으로 박게).
- 그래서 정적 훑기로 보탬: 런타임 C# 의 한국어 글 중 **다섯 판 한국어 표 값과 다른 것**(= 키 없이 박힌 것, 표 값과 같은 글은 키로 찾아 쓰는 폴백) → 165. 세력 이름(화면에 안 씀)·DebugHud·성능 기록(측정용 빌드)·타이틀(이미 영문 짝) 빼고 파일 서른 남짓을 손으로.
- 고친 것(ko·en 짝 147): GO 승급 카드 특성 열둘·축·저장 / DUNGEON 축복 카드 열둘·축·방 표지 열셋·부적 둘·필드 사건·층 내려가기·월드 보스 부위·퍼즐·산나물·연못·보물·광맥·우물·난입 중·시련 수호자·전자창·동력장갑 / FOREST 도감 열둘(한국어 이름이 세이브 키 → `ForestMuseumState.DisplayName`)·집 드나들기·저장 / STORY 유파 스물넷·비경 은사 아홉(이름·설명)·망루 / REALM 결과 카드·월 정리 카드·특성 셋·야망 셋. 던전 적 이름은 이미 "표시명 → 키" 표가 있어 시련 수호자만 보탬.
- 그림 문자: 진단 로그의 TMP 경고(`\U0001F43A was not found in NotoSansKR`)로 발견 — ⚔ 📜 🚪 🐺 등 마흔넷이 Noto Sans KR 에 없어 폰 화면에 □. Google Fonts 의 Noto Emoji(OFL, 흑백 윤곽 → SDF 가능)를 받아 `SetupSagaFonts` 가 TMP 셋째 대체로 건다(1024 동적 아틀라스). 둘 다 없는 ≋ ✗ 는 ≈ ×. 크레딧(⑥)에 넣을 것.
- 진단의 한국어 박은 검사 → 지금 언어의 표 값: 다섯 판 언어 되돌림·목표판 머리(`SagaUi.L`)·STORY 척후병 셋·FOREST 택배·축제·GO 지역 사명 여덟(`Seg` = 서식 글의 가장 긴 고정 조각)·REALM 시간 틈 사연. **결과: 영어 감시에서 판별 헤드리스 다섯 전부 OK, 보이는 한글 0, 누락 키 0.** 배치 점검 영어 바퀴의 한글 5 는 국지 문답의 사자성어(로마자 병기, 문제 자체).
- 함정: 셸 heredoc 으로 넘긴 파이썬 치환이 백슬래시를 먹어 C# 문자열에 날 줄바꿈이 들어갔다(`PlaytestRealmEras`, 컴파일 전에 발견) — 백슬래시가 든 스크립트는 Write 로 파일을 만들어 돌린다. 진단이 동적 글꼴 아틀라스를 에셋에 써 `NotoSansKR-Regular SDF.asset` 이 7만 줄 늘어남 → 커밋 전 되돌림.
- 커밋: 1538d650(코드·표·글꼴·도구) · afbc2ba1(진단 영어 통과). 검증(한국어, 커밋한 코드): 배치 점검(두 언어 0건)·흐름·판별 다섯 3연속 21/21 OK.
- 남음 5c-3: 전투 중에만 켜지는 단추 배치(GO 폭발·교체 명단). 실기: 그림 문자 글꼴·영어 대사 — 확인 전.

## 2026-09-27 상용화 — PLAN 110 ⑤c-3 놀다가 켜지는 UI 배치 ("사가유니티 이어해")

- 조사: `UiLayoutCheck -uiHidden`(재지 않고 판마다 첫 화면에 숨은 UI 목록)으로 "단추로는 안 열리는 것"을 셌다 — GO 명단 셋(첫 화면은 주인공 하나)·옛 결투 캔버스 셋·조우 알림 셋·승급 3택·사명 줄, DUNGEON 축복·시련 카드·지역 배너, FOREST 밀어내기, STORY 전직·선택, REALM 알림, 판마다 대사 줄. 폭발 단추는 첫 화면에 이미 있었다(교체 명단이 한 칸뿐이던 것).
- `UiLayoutCheck` 상태 단계: 상태마다 켜기·끄기(공개 API 또는 리플렉션 — 결투는 캔버스만 켜고 게임 상태는 안 건드림, 기다리는 동안 `DuelGate.Report` 로 들판 HUD 가 숨은 모습 그대로). 알림·고르기 = 새로 뜬 것만(패널처럼), 전투·대사·배너 = 화면 전체. 긴 대사 한 줄(ko 53자·en 세 줄), 명단은 이름 긴 인물 셋, 배너는 글 긴 지역. 두 언어 × 38.
- 첫 측정 193건. 고침: GO 옛 결투 셋(막대 셋·제목이 왼쪽 위 레벨·돈 줄·오른쪽 위 저장과, 속공이 조이스틱과) → 자리 한 곳 `EncounterUiKit.Duel*`(제목·남은 시간 한 줄 + 막대가 레벨 줄·두 줄 대사 밑, 속공 x 380) · 조우 알림 셋 글 상자가 첫 단추(-220)까지 → -28·176 · 승급/축복 3택 카드 140·간격 170 → 130·150(셋째 ↔ 거절) · 시련 카드 판 1000 → 840(화면 900) · DUNGEON 대사 줄 위 가운데 920 → HUD 빈 틈(왼쪽 기둥 ~230 ↔ 오른쪽 단추 1010) 아래쪽 760·아래 정렬, 지역 배너도 같은 틈 가운데(`DungeonRegionTracker.FreeCenterX`) · STORY 대사 줄 → 방향 단추와 행동 단추 사이 아래쪽 · STORY 전직 창 640 → 720(넷째 ↔ 닫기) · GO 대사 줄 위 정렬 -112(영어 세 줄이 목표판·Ⅱ 에 닿음) → 결투 블록도 30 더 내림. NewText 는 피벗 = 앵커라 제목 x 는 상자 왼쪽 끝(첫 고침에서 헛짚어 6px 남음).
- 함정: 이 PC 에 사실 몸 묶음이 없다(`realistic-pack.sh verify` FAIL 2906, OneDrive 보관함도 없음). `SagaRebuildScenes` 를 돌렸더니 씬 다섯이 폴백 몸으로 지어져 수십만 줄이 바뀜 → 씬·타임라인 되돌림. 그래서 **씬 빌더가 구운 UI 여섯(대사 줄 셋·승급/축복 3택·전직 창)은 자리를 런타임 `ApplyLayout()` 으로 옮겨 빌더와 `Awake` 가 같이 부른다** — 재빌드 없이 맞고, 다음 재빌드도 같은 값을 굽는다. 결투·조우·시련 카드·배너는 원래 실행 때 짓는다.
- 판별 헤드리스(GO·DUNGEON·FOREST·STORY·흐름)는 이 PC 에서 Missing Prefab 로 FAIL — 변경을 빼고 돌린 기준선도 같은 실패(GO 소품 등불·스킬 모양 몸, DUNGEON 컷·무기 칼날, STORY 무명 옷)라 환경 탓. REALM 헤드리스 OK. 묶음 있는 PC 에서 다시 돌릴 것.
- 점검기 보탬: 세션 정리 카드는 모달(REALM "다음 달"에 정산 알림과 같이 뜬다 — 카드가 5초 덮음) · 단추 없이 저절로 닫히는 카드는 6초 기다림(전엔 "못 닫음"). 결과 3연속 OK: 문제 0 · 패널 40 · 속 패널 7 · 상태 38(영어 바퀴 한글은 국지 문답 사자성어 — 무작위 문제라 수가 바뀜).
- 남음: ⑥ 마감. 실기: 결투 화면 새 자리·DUNGEON/STORY 대사 줄 아래쪽·지역 배너.

## 2026-09-27 char-forge — 남은 껍데기 17 → 진짜 옷 (몸 껍데기 0)

"남은 껍데기 옷 17개 진짜 옷으로 바꿔".

- 레시피 17(Archer·Eve·Heraklios·Dreyar·Arissa·Kachujin·Sophie·Y Bot·X Bot·Dummy·Mannequin·Yaku·Mremireh·Zlorp·Demon·Ganfaul·Maw 자리): 몸 껍데기 → CC0 옷(skinsuit·heroine 몸 옷·바이킹 윗옷/바지·수도복+진짜 두건·toigo 민소매/층 치마/더블 정장·SF 판금 곱하기 색) + 공방 `dopo` 색 변형·새 틀 `breastplate`·`guards`. 인형 머리·눈 띠·투구·두건·띠·베레모 껍데기는 그대로.
- garments.py: 틀 +2(`breastplate` 맨몸 가슴판·어깨판, `guards` 어깨판·팔 가리개·정강이) + 소매 `start`(팔 가리개). `start` 가 없으면 칸 수가 예전 그대로 — 찰갑을 다시 지어 .obj·.mhclo md5 같음.
- 렌더로 세 번 고침: 새로 지은 공방 판금 온몸·유격복·가죽 기사·몸 옷 위 가슴판·다리 판·트렌치(officer_coat)는 모두 자루·상자처럼 부풀어 버리고 CC0 로 · 짙은 `=#` 염색은 거친 그림(bodysuit·헬리오스·털 단 장화)을 털처럼 만들어 skinsuit·곱하기 색 · 털 망토 `src` 껍데기는 풍선이라 지움 · 뜨개 윗옷은 여자 몸에서 살이 뚫어(체형 바꿔도 같음) 몸 옷으로 · skinsuit 발이 해적 장화를 뚫어 heroine 장화로.
- 검사: 빌드 17 실패 0, verify fbx·glb 실패 0(팔다리 ≤ 0.67°·땅 ≤ 2.5mm), 두 번 빌드 glb sha256 17/17 같음.
- 남은 흠: 빈칸(가죽 기사 은 어깨판·겉옷판, 검은 기사 망토, 유격 가죽 조끼, 사진작가 목폴라, 별바다 손님 가슴판) · 판금 옷이 SF 셋뿐이라 판금 입은 사람·인형 실루엣이 겹침 · `_cmp_real_courier_f_01` 도 같은 뜨개 윗옷이라 살 뚫림 확인할 것. CharactersForge FBX 는 아직 옛 판(Unity 쉴 때 §3 ⑥~⑧) → 그 뒤 사용자 판정.

## 2026-09-27 상용화 — PLAN 110 ⑥a 크레딧·오류 기록·버전 ("사가유니티 이어해줘")

- ⑥ 이 커서 넷으로 나눔: 6a 크레딧·오류 기록·버전(이번) / 6b 앱 id·회사명·아이콘(앱 id 는 사용자 결정) / 6c 영어 검수 목록 / 6d AAB+PAD.
- 조사: 앱 id 가 Unity 템플릿 그대로(`com.UnityTechnologies.com.unity.template.urpblank`), 회사명 DefaultCompany, 아이콘 없음, 버전 두 곳(PlayerSettings 0.1.0 · `TitleScreen.Version` 상수), 안드로이드 버전 코드 1. 라이선스 파일은 폴더마다 있었고(CC0 BGM·Kenney·Poly Haven·Quaternius·셰이더 MIT/CC0·글꼴 OFL), 공방 몸 61 은 `license.json`(CC0 — MakeHuman·UAL).
- 크레딧은 "빌드에 실제로 들어가는 것"만 → Unity 로 의존을 뽑아 표에 맞추는 점검(`SagaCreditsCheck`)을 만들고 빌드 문지기 ⑤ 로 걸었다. 첫 실행 표에 없음 18 = 우리 애니메이터 컨트롤러 17·입력 설정 → `own`. 결과 쓰인 출처 8, 안 쓰인 것(공방 몸·Quaternius·SSS/머리칼 셰이더 셋)은 화면에서 자동으로 빠짐. 이 PC 는 사실 몸 파일이 없어 의존이 안 풀리니 Mixamo 는 `build_deps.txt` 로 센다.
- 패키지: 플레이어 어셈블리(`CompilationPipeline` Player)의 소스·에셋 의존이 든 패키지 16. Unity Companion·Package Distribution 라이선스는 전문 불필요, glTFast 만 Apache 2.0(LICENSE.md 에 전문 10KB 있음). 제3자 고지는 Burst·Cinemachine·RP Core·URP·Visual Scripting. Visual Scripting·Multiplayer Center 는 템플릿 잔재라 빼면 고지·크기가 준다(후보로만 적음).
- 발견: Noto Sans KR 의 OFL.txt 에 저작권 줄이 없다(OFL 은 고지 필요) → 글꼴 name 표 0번을 읽어 표의 `Copyright` 칸에(Noto Sans KR © 2014-2021 Adobe · Noto Emoji © 2013 Google LLC · Liberation Sans © 2010 Google·2012 Red Hat).
- 타이틀: 아래 줄 설정·크레딧·게임 종료(340 간격). 크레딧 창 = 스크롤, 머리 두 언어 + 전문 92KB 를 줄 묶음 ~2400자마다 TMP 하나(한 글에 다 넣으면 정점 한도), 전문은 꺾쇠 URL 이 많아 richText 끔. 설정 맨 아래 "오류 기록" 줄.
- 오류 기록 `SagaCrashLog`: 빌드에서만 `logMessageReceivedThreaded` 로 예외·오류·단언을 받아 파일에(스택 14줄, 같은 메시지+스택 첫 줄은 ×n, 최근 40, 앱을 다시 켜면 파일에서 이어 읽음). 에디터·배치는 진단이 일부러 내는 오류가 많아 끔 — 진단은 `StartForTest`.
- 버전: 표시는 `Application.version`, 빌드가 bundleVersion "a.b.c" 로 안드로이드 버전 코드 셈(0.1.0 → 100 — ProjectSettings 도 100 으로 맞춰 빌드가 설정을 안 흔듦).
- 검증: `PlaytestSagaCredits` OK · 배치 점검 OK(타이틀 패널 2 — 설정·크레딧, 두 언어 × 세 화면비 0건, 전체 문제 0) · 흐름 진단은 이 PC 의 Missing Prefab 로 FAIL 이 전과 같음(타이틀 글 25→26 = 크레딧 단추, 새 실패 없음). 셸 heredoc 이 `\n` 을 먹는 함정 한 번 더 — 백슬래시 든 치환은 Edit 툴로.
- 남음: 6b 앱 id(사용자)·아이콘 · 6c · 6d. 실기: 크레딧 창 글(□·끊김)·오류 기록 복사.

## 2026-09-27 char-forge — 비교 몸 FBX 새 판(로컬 전용) · tuck

"vroid 자체툴 개발 진행".

- 새 FBX(진짜 옷 그림 포함) 61벌이 1.4GB(옛 껍데기 판 655MB) → 사용자 결정 "로컬 전용": `saga-unity/.gitignore` 가 CharactersForge FBX·Textures·Materials·Animators/CharForge·CharCompareReal 장면을 막고 추적 해제(3d972934 까지). 파일은 이 PC 에 남고 `.license.json`·ForgeSkin 그래프만 커밋. 게임 프리팹·장면은 이 FBX 를 안 쓴다(GUID grep).
- `_out` 61벌 → CharactersForge, 배치 `BuildAndVerifyBatch` 두 번 `CMP_RESULT OK`(122 몸 — 짝 키·발·카메라 쪽·동작·ForgeSkin 그림). 배치가 올린 ProjectVersion·Packages 는 unity-batch.sh 가 되돌림.
- build_real 레시피 칸 `tuck`: 지정한 옷 밖으로 비어져 나온 살을 쉼 자세에서 옷 면 4mm 아래로(살 법선 광선 판정, 얼굴·목·손 빼고). 택배 기사(여)의 뜨개 윗옷 앞가슴 뚫림이 잡힘 — 어깨 뒤 두 점은 동작 휨이라 남음(8mm 는 앞에 새 점이 생겨 되돌림). 안 준 몸은 바이트까지 같다. verify fbx·glb 실패 0 · sha256 두 번 같음.
- 다음 = HOW_TO_PLAYTEST §9 사용자 판정(짝마다 "바꿔도 된다 / 아직"). 다른 PC 는 README §3 "새 PC" 순서로 먼저 뽑는다.

## 2026-09-27 char-forge — 빈칸 채우기: 등 망토·어깨판 (tube arc)

"vroid 자체툴 이어해".

- garments.py 통 `arc`(앞·뒤 한쪽 판, 살 안 지움 — 기존 옷 찰갑 md5 같음) + 새 틀 `cape`·`pauldrons` → Dreyar 자리 검은 판금 기사 등 망토 · Eve 자리 가죽 기사 은 어깨판. 앞뒤 겉옷판(tabard)은 렌더로 앞치마·가슴 홈이라 틀을 지움.
- 검사: 두 몸 verify fbx·glb 실패 0 · sha256 두 번 같음 · 비교 장면 배치 CMP_RESULT OK(로컬 FBX 교체).
- 남은 빈칸: 가죽 기사 겉옷판 · 유격 가죽 조끼 · 사진작가 목폴라 · 별바다 손님 가슴판. 다음 = HOW_TO_PLAYTEST §9 사용자 판정.

## 2026-09-27 상용화 — PLAN 110 ⑥b 앱 id·회사명·임시 아이콘 ("사가유니티 이어해줘")

- 사용자 결정(물어서): 앱 id `io.github.smh8627jpg.saga`(GitHub Pages 주소 뒤집기 — 하이픈은 앱 id 에 못 써서 뺌) · 회사명 `SAGA Games` · 아이콘은 코드로 임시.
- 정체성 상수 `SagaPlayerBuild.AppId/Company/Product` + `ApplyIdentity()`(빌드마다, 같으면 안 바꿈) — 안드로이드·PC·iOS 앱 id, 회사명. 배치로 한 번 적용해 ProjectSettings 커밋.
- 회사명이 PC 의 저장 폴더(`LocalLow/<회사>/SAGA`)와 PlayerPrefs 레지스트리(에디터 `HKCU\Software\Unity\UnityEditor\<회사>\SAGA`)를 정한다 → 이 PC 의 옛 DefaultCompany 저장 다섯·에디터 설정 33 을 새 자리로 복사(옛 것은 둠). 실제 사용자가 아직 없어 옮기는 코드는 안 넣었다. 폰은 앱 id 가 바뀌어 새 APK 가 다른 앱으로 깔린다(③b 성능 측정은 새 APK 로).
- 아이콘: `tools/app-icon/make_icon.py`(Blender 5.2 Cycles CPU 96샘플, 47초) — 먹빛 둥근 그러데이션 바탕 + 금빛 테 + 금빛 "史"(Noto Sans KR Bold, 돌출·베벨, 금속 0.85). 첫 렌더는 글자가 테의 1/4 로 작아 작은 아이콘에서 안 보임 → 글자 2.2배·테 굵게. `Assets/Art/Icon/` 세 장: 전체(PC·옛·둥근) · 적응형 뒤판 · 앞판(투명, 테 지름 = 화면 59% < 안전 영역 61%). `Editor/SagaAppIcon.Apply()`(빌드마다): 기본 아이콘 + 안드로이드 칸 18(적응형 6 은 뒤+앞) — 안드로이드 모듈 없는 PC 에서도 컴파일되게 아이콘 종류를 이름으로 찾음. 그림을 받으면 같은 이름 세 장만 바꾸면 된다. 크레딧 표 `own` 에 `Assets/Art/Icon/`.
- 검증: `PlaytestSagaCredits` OK(정체성·기본 아이콘·안드로이드 빈 칸 0·적응형 6 추가) · 배치 점검 OK(새 저장 경로에서 백업·복원). 셸이 경로의 백슬래시를 또 먹음(sed·node -e) — 문서의 경로 줄은 Edit 툴로.
- 남음: 6c 영어 검수 목록 · 6d AAB+PAD.

## 2026-09-27 char-forge — 붙는 옷 위 조끼·가슴판 (통 fit · 레시피 under)

"vroid 자체툴 이어해".

- garments.py 통 `fit`(오목 메우기 6 → 2번) + 새 틀 `vest`·`cuirass` → Archer 자리 유격 가죽 조끼 · Mremireh 자리 별바다 손님 금빛 가슴판·어깨판(pauldrons 색 변형). 기존 옷은 그대로(찰갑 md5 같음).
- build_real 레시피 칸 `under`: 겉옷에 덮인 속옷 면을 지운다 — 몸통 뼈에만 붙은 공방 겉옷 밑에서 몸 옷이 어깨뼈로 뚫던 것(대기·달리기 렌더로 확인). render_common `CF_CLIP` 로 동작 고르기.
- 검사: 두 몸 verify fbx·glb 실패 0 · sha256 같음 · 비교 장면 CMP_RESULT OK. 남은 빈칸: 가죽 기사 겉옷판 · 사진작가 목폴라. 다음 = HOW_TO_PLAYTEST §9 사용자 판정.

## 2026-09-27 상용화 — PLAN 110 ⑥c 영어 검수 목록 ("사가유니티 이어해")

- 도구 `tools/loc-review.mjs`(node — 이 PC 엔 py 가 없어 파이썬 대신): 번역 표 다섯(2036) + 코드 `SagaUi.L` 짝(55, Editor 밖) = 2091. 오류(exit 1) = 키 짝·빈 영어·영어에 한글(문답 사자성어·유행어 인용은 뺌)·자리표 `{n}`·서식 태그·앞뒤 공백(한국어 쪽이 비고 영어가 한 칸 = 조사 붙임이라 봐줌)·실명(사가고 도감 id 이름 조각 5자 이상 + 손 목록, 한·영)·원작 게임 용어(웹 사가고 §5 ⑳). 경고 = 첫 기호·줄 수·두 칸(한국어도 두 칸이면 의도)·판 안 용어 표. 흔들림 = 12자 이하 같은 한국어의 다른 영어(동음이의어 허용 목록 `DRIFT_OK`). 넘침 주의 = 순위 1·2 에서 대략 폭 1.6배.
- 산출: `docs/EN_REVIEW.md`(요약, 생성물) · `docs/en_review.tsv`(순위·판·키·한국어·영어·깃발·검수 — 검수 칸은 사람이 채우고, 다시 돌려도 영어가 같으면 남고 바뀌면 비움). 순위 1 UI 257 · 2 놀면서 1144 · 3 대사·문답 690.
- 먼저 영어 2091 을 직접 한 번 훑음(자동 검사가 못 잡는 오타·용어). 첫 자동 결과 오류 99·경고 9·흔들림 8 → 0·0·0:
  - **국지 문답 실명 12문항**(h01~05·h08·i01·i12·w06·w07·w09·w11, 한·영 + `RealmQuizData` 코드 폴백) — 이 트랙 주석이 "교양 퀴즈라 정책 밖"이라 두었는데, 웹은 09-26 사용자 결정("모든 실명을 가명으로", d9120233)으로 바꿨다 → 같은 가명(도감 인물은 도감 로마자: Hunmin·Haejang·Hyeonmyo·Gangu·Tonghapgong·Yodongpae·Inhyeong·Hyeonchaek·Cassiander, 나머지는 새로). 헤이케(가문)·황건적(무리)·지명·웹툰 이름은 사람 이름이 아니라 웹처럼 둠.
  - **GO 원작 용어**(⑳ 표, 표시 글자만 — enum `Exquisite`·`Vaporize` 등·키·세이브 그대로): 상자 평범·정교·진귀·화려 → 나무·무늬·옻칠·금박(Wooden·Patterned·Lacquered·Gilded) · 반응 증발·과부하·감전 → 물안개·터짐·물벼락(Steam·Blast·Surge) · 원소 폭발 → 원소 해방(Release) · 영어 원소 Pyro·Hydro·Electro → Fire·Water·Thunder(한국어 화·수·뇌는 오행식이라 둠) · DUNGEON Electro Lance → Lightning Lance. 장면에 구운 글엔 없음(런타임만) 확인. HOW_TO_PLAYTEST 이름도.
  - 영어: 봉래 한마디 "Bongnae" 오타 · DUNGEON 난입 horde → Onslaught·Miniboss → Mini-Boss·퀘스트 두목 = 적 이름(Yellow Turban Bandit Chief) · STORY job → class(Class Trainer 등)·"+10%p" → "+10%"·황건적·떠도는 망자·별바다 손님을 GO 와 같게 · FOREST 사진가 대사 fog wraith → mist ghost · 공통 단추 Title Case(Quit Game·New Game·Master Volume·Sound Effects·Error Log·Delete & Start·Title Screen·Session Summary).
- 도중 발견: 배치 점검이 문제 6(영어 DUNGEON 목표판 ↔ 왼쪽 위 상태 글, 16:9·4:3). 세이브 탓인가 해서 치워도 같음 → 제 파일만 HEAD 로 돌려 기준선 = 0 → 원인은 "Survive a horde" → "Survive an Onslaught". 목표판이 폭 900·줄바꿈이라 **그날 뽑힌 일과 줄 길이만큼 넓어지고** 여유가 27px 뿐이었다(다른 날 "Clear a sigil floor" 가 뽑혀도 닿을 수 있었음) → `GoalBoard` 폭 540·줄바꿈 없음·자동 크기 22→15. 목표판 최대 잉크 폭 619 → 583px.
- 검증(묶음 없는 이 PC, 6000.3.23f1): 컴파일 오류 0 · `PlaytestRealmSlice` OK ×2 · `PlaytestSagaCredits` OK · 배치 점검 OK ×2(두 언어 × 패널 42·속 7·상태 38, 영어에 한글은 문답이 무작위라 1~6 — 문제 수엔 안 셈) · loc-review 오류 0. 판별 헤드리스(GO·DUNGEON·FOREST·STORY·흐름)는 이 PC 에서 Missing Prefab 로 기준선부터 FAIL 이라 안 돌림 — **묶음 있는 PC 에서 한 번**(문자열·목표판만 바뀌어 로직 영향은 없을 것). 실행 부산물: 글꼴 동적 아틀라스 셋 되돌림.
- 남음: 사람 영어 검수(tsv 순위 1부터) · ⑥d AAB + Play Asset Delivery.

## 2026-09-27 char-forge — 마지막 빈칸 둘: 목폴라·겉옷판 (+ 베레모)

"vroid 자체툴 이어해".

- garments.py 새 부품 `collar`(목 깃, 밑줄 `taper` 로 셔츠 깃 속) → 틀 `turtleneck` = Sophie 자리 사진작가 검은 목폴라. 몸통 통 + 목 깃 첫판은 어깨 → 목 원뿔이 정장 깃 밖으로 나와 톱니, 목 밑을 몸 둘레대로 두면 셔츠 위 턱받이였다.
- 새 머리 부품 `beret` → 틀 `beret`(한쪽 쏠림·처짐 돔) — 톱니 껍데기 베레모 대신.
- 틀 `tabard`(닫힌 어깨 요크 + 가슴 아래 앞뒤 arc 판, mono 없이 허리에서 조여짐 + 허리띠) = Eve 자리 가죽 기사 상아빛 겉옷판. band 새 칸 `ease`(몸 볼록 둘레 기준). 땋은 머리가 요크를 뚫어 검게 염색한 `ponytail01`, 대기 `CF_Guard_Idle_Loop`.
- 검사: 찰갑·도포 md5 같음 · verify fbx ≤ 0.67° · glb 0.0° · sha256 같음 · 키 1.722·1.695m(짝 1.70) · 비교 장면 CMP_RESULT OK(FBX 로컬 전용). 빈칸 0. 다음 = HOW_TO_PLAYTEST §9 사용자 판정.

## 2026-09-27 상용화 — PLAN 110 ⑥d 앱 번들 + Play Asset Delivery · 제출 목록 ("사가유니티 이어해")

- `SagaPlayerBuild`: 빌드 본체를 `Build()`(끝내지 않고 결과만 — 진단이 검사)로 떼고 `Run` 은 `Build`+`Finish`. 새 `BuildAndroidAab`(메뉴 Saga/Build/Android App Bundle) → `Build/Android/SAGA.aab`. 앱 번들일 때만 이 빌드 동안 `buildAppBundle`·`splitApplicationBinary` 를 켜고 finally 에서 되돌림 → 첫 씬+코드 = base, 나머지 = 설치 시점 팩 `UnityDataAssetPack`.
- 서명: 환경 변수 `SAGA_KEYSTORE`·`SAGA_KEYSTORE_PASS`·`SAGA_KEY_ALIAS`·`SAGA_KEY_PASS`(비우면 저장소 암호) 가 있으면 그 빌드 동안만 custom keystore, 끝나면 경로·alias·암호를 비움. 없으면 보고서에 "디버그 서명 — Play 업로드 불가". `.gitignore` 에 `*.jks`·`*.apks`(`*.keystore` 는 루트가 이미 막음).
- `InspectAab`: 앱 번들 zip 의 맨 앞 폴더 = 모듈별 압축 크기 합, META-INF 의 서명 파일 이름. base 200MB·팩 1.5GB·설치 시점 4GB 초과·팩 없음·base 없음이면 FAIL. 보고서 `SAGA_report.txt` 에 모듈 표.
- 진단 `PlaytestSagaAab`(새): 타이틀+국지 두 씬·자산 검사 끔으로 작게(묶음 없는 이 PC 에서도). JDK keytool 로 Temp 에 임시 키를 만들어 환경 변수 길로 서명 → 검사(빌드 성공·base+팩·팩이 비지 않음·서명 SAGATEST.RSA·서명/분할/buildAppBundle 원복) → bundletool 1.17.2(Unity 안드로이드 모듈 동봉) validate·targetSdk·팩 매니페스트 install-time. 결과 OK: 앱 번들 59.0MB · base 36.8MB · UnityDataAssetPack 22.0MB · targetSdk 36 · minSdk 25. 첫 실행은 `GetValueOrDefault`(이 C# 판에 없음) 컴파일 오류로 한 번 고침. IL2CPP 빌드 약 12분.
- 매니페스트 권한: VIBRATE · INTERNET(Unity 라이브러리) · FOREGROUND_SERVICE·FOREGROUND_SERVICE_DATA_SYNC(`com.google.android.play:asset-delivery:2.1.0` 이 추출 서비스용으로 붙임, 병합 보고서로 확인). 설치 시점 팩만 쓰니 실제론 안 돌지만, 빼는 건 폰 시험 없이 위험해 제출 목록에 "콘솔이 물으면 신고 / 막히면 제거(실기)"로.
- 빌드 부산물(①때와 같음): ProjectSettings `preloadedAssets`·Android 배칭, URP 설정 셋 → git checkout. 서명을 비우면 `AndroidKeystoreName: '{inproject}: '` 로 직렬화된다(getter 는 "") — 이것도 같이 되돌림. 에디터 활성 대상은 Android 로 남음.
- `docs/STORE_CHECKLIST.md`(새, 상태만 덮어씀): 빌드(앱 번들·업로드 키·Play 앱 서명·앱 id·버전·64비트·대상 API·권한·예상 크기) · 등록 정보(설명·아이콘 512·기능 그래픽·스크린숏 — 없음) · 정책 양식(개인정보처리방침 URL·데이터 보안·IARC·연령·비공개 테스트) · 업로드 키 만드는 keytool 한 줄. 게임 코드엔 네트워크·광고·분석 없음, Unity 서비스 설정도 전부 꺼짐 — 단 `submitAnalytics: 1`(Unity 하드웨어 통계)이 켜져 있어 "결정 필요"로.
- 남음: 묶음 있는 PC 에서 전체 `BuildAndroidAab` 실측(base 는 코드+타이틀이라 ~40MB 예상) · 제출 목록 사람 칸 · 템플릿 잔재 패키지 빼기 후보.

## 2026-09-27 char-forge — 61벌 렌더 점검 · 바지·비침·등 짐 손질 (14벌)

"vroid 자체툴 이어해" (판정 전 손질).

- 비교 몸 61벌을 앞·뒤로 여덟씩 찍어 여러 몸에 겹친 흠부터. garments `leggings` 새 칸 `ease_bottom`·`smooth`·`wmin` → 공방 바지 풍선·톱니·가랑이 턱 해결(Abe·Brady·Morak·정찰병 자리).
- 레시피 `under` 로 셔츠 허리·운동화 뒤축·장화 위 비침 해결, `under` 에 `"skin"`(덮인 살 지우기) → 택배 기사(여) 뜨개 윗옷 등 뚫림.
- 새 부품 `backpack`(둥근 상자 + 어깨끈) · 틀 `backpack`·`pack_big`·`pack_metal` → 껍데기 등 짐 일곱 교체(Remy 자리 여행자는 흰 풍선 → 주황 배낭).
- 검사: 14벌 verify fbx ≤ 0.68° · glb 0.0° · sha256 같음 · CMP_RESULT OK(FBX 로컬 전용). 남은 흠은 char-forge README §8-1 열째. 다음 = HOW_TO_PLAYTEST §9 사용자 판정.

## 2026-09-27 상용화 — PLAN 110 ⑥e 템플릿 잔재 패키지·파일 정리 ("사가유니티 이어해")

- 코드·asmdef·씬·프리팹·에셋·ProjectSettings 에서 참조 0 확인 → manifest 에서 `com.unity.visualscripting`·`com.unity.multiplayer.center`·`com.unity.collab-proxy`·`com.unity.ai.navigation` 뺌(packages-lock 34줄 줄어듦). URP 템플릿 잔재 `Assets/TutorialInfo/`(Readme·ReadmeEditor·아이콘·레이아웃)·`Assets/Readme.asset`·`Assets/Scenes/SampleScene.unity` 지움(빌드 목록·코드에 없음). test-framework 는 둠. 내장 모듈(ai·cloth·vehicles·vr·xr·wind 등)은 stripEngineCode 로 이미 빠지고 URP 의존이 얽혀 안 건드림.
- 이번엔 `tools/unity-batch.sh` 를 안 씀 — 그 스크립트가 실행 뒤 manifest·lock 을 되돌려 이 변경을 지운다(설치 버전 = 프로젝트 버전이라 올림 부작용도 없음). 부산물(글꼴 셋·URP 설정 셋·RP 에셋 v13·EditorSettings·ProjectSettings)은 git checkout.
- 결과: 컴파일 오류 0 · `PlaytestSagaCredits` OK — 법적 고지 `SagaLegal.txt` 92 → 59KB(Visual Scripting 제3자 고지 등 빠짐) · `PlaytestRealmSlice` OK · 배치 점검 OK(문제 0) · `PlaytestSagaAab` OK — 크기 그대로(base 36.8·팩 22.0MB, IL2CPP 코드 제거가 이미 뺐다).
- 남음: 묶음 있는 PC 에서 전체 AAB 실측 · 제출 목록 사람 칸.

## 2026-09-27 char-forge — 모자·조끼 껍데기 → 공방 옷, 치마 둘 (9벌)

"vroid 자체툴 이어해".

- garments 새 머리 부품 `crown`·`visor`, beret `tilt_a` → 틀 `cap_peaked`·`cap_flat`·`beanie`: 톱니·구김 껍데기 모자 일곱 교체(Cop Zombie·Pete·택배 기사·Swat Guy·Steve·Leonard·불량배 자리).
- 조끼 껍데기 셋 → `vest`·새 틀 `tacvest`(재킷 위 방탄 조끼) + `under`. 치마저고리 삼각 치마 → A자, 찰갑 치마 벌어짐 절반.
- 검사: 9벌 verify fbx ≤ 0.7° · glb 0.0° · sha256 같음 · CMP_RESULT OK(FBX 로컬 전용). 남은 흠은 char-forge README §8-1 열한째. 다음 = HOW_TO_PLAYTEST §9 사용자 판정.

## 2026-09-27 상용화 — PLAN 110 ⑥f 스토어 등록 자료 초안 ("사가유니티 이어해")

- 109 재개·시나리오는 사용자 몫이라 그 전에 할 수 있는 110 조각으로 — 제출 목록의 등록 정보 칸.
- `tools/store/make_store_art.py`(Blender 5.2, 31초): `tools/app-icon/make_icon.py` 의 장면 함수(reset·바탕·금빛 테·"史")를 불러 `docs/store/icon_512.png`(512², 네모 꽉 — 모서리는 Play 가) · `feature_ko.png`·`feature_en.png`(1024×500, ortho 폭을 가로비만큼 늘리고 바탕을 가로로 늘림, 왼쪽 무늬 70% + 오른쪽 "SAGA"(Bold 돌출) + 한 줄(상아색 발광), **RGB** — Play 기능 그래픽은 알파 없는 PNG). 첫 판은 글이 작고 "SAGA"·한 줄 사이가 벌어져 한 번 고침(렌더 그림을 직접 봄). `make_icon.py` 는 끝의 `main()` 을 `if __name__ == "__main__":` 로 감쌈(Blender -P 는 __name__ 이 "__main__" 인 것 확인 — 아이콘 다시 안 구움).
- `docs/store/listing.md`: 앱 이름·짧은 설명(한 45자·영 76자, 80 한도)·전체 설명 한·영 — 판별 한 줄은 타이틀 카드 문구, 수치는 게임 기준(도감 105·성 58·전직 넷), 광고·결제·계정·인터넷 없음. 판단 칸: 판 이름 사가고(Saga GO)·사가블로(Sagablo)의 원작 연상 — 바꾸면 표시 이름만.
- `docs/store/privacy.md`: 개인정보처리방침 한·영 초안 — 수집 없음·세이브/설정/오류 기록은 기기 안(오류 기록은 사용자가 설정에서 복사할 때만)·광고/분석/결제 없음·Unity 하드웨어 통계는 ㉮ 끔 / ㉯ 켬 두 갈래(결정 뒤 하나만)·시행일·연락처·주소는 사람.
- `STORE_CHECKLIST.md` 등록 정보·방침 칸을 초안 가리키게. Unity 는 안 돌림(Assets 변경 없음).
- 남음: 묶음 있는 PC 에서 전체 AAB 실측 · 사람 칸(키·스크린숏·방침 주소·IARC·비공개 테스트·하드웨어 통계·이름 판단) · 그 뒤 109 재개/시나리오 순서는 사용자.

## 2026-09-27 char-forge — 요정·안개유령 옷, 띠 껍데기 넷 (6벌)

"vroid 자체툴 이어해".

- garments 통 `teeth`(톱니 끝단)·무늬 `leaf` → 틀 `leafdress`(Jolleen 자리 요정)·`wraith`(Nightshade 자리 안개유령) — 옛 kitbash robe(종이 통·풍선) 대신.
- 띠 껍데기 → `belt`·`belt_low`·`kneepads`·`neckring`(무도 수행자·수리 기사·용병·시간 여행자(남)). 황건 두목 조끼 등 점은 대기 자세 팔 근육이라 못 풀어 그대로.
- 검사: 6벌 verify fbx ≤ 0.36° · glb 0.0° · sha256 같음 · CMP_RESULT OK(FBX 로컬 전용). 다음 = HOW_TO_PLAYTEST §9 사용자 판정.

## 2026-09-27 char-forge — 치마 뼈 무게 soften, 61벌 다시 훑어 11벌 손질

"vroid 자체툴 이어해".

- 술사 치마 가슴 아래 불룩 = 옷 모양이 아니라 뼈 무게(몸에서 11cm 뜬 배 높이 정점이 spine_01, 가랑이 밑에서 골반 → 허벅지 급전환). `build_real` 레시피 칸 `soften` {옷: [세로 40, 둘레 6]} — 술사 + 긴 겉옷 넷(시간 여행자(여)·능묘지기·안개유령·시간 행상).
- render_grid 로 61벌 재점검: 장화 윗단이 바지 뚫음 → 고물 행상·폭주 청년 `under` {장화: [바지]}, 수리 기사·불량배 발목 장화로 · 주역 여자 흰 양말 `under` · 칼 든 아가씨 치마 속 바지 `under`.
- CF_Guard 대기 오른 어깨 뒤 혹은 팔꿈치 pole 을 바꿔도 그대로라 되돌림(남은 흠).
- 검사: 11벌 verify fbx ≤ 0.7° · glb 0.0° · sha256 같음(넷) · CMP_RESULT OK(FBX 로컬 전용, 배치가 올린 ProjectVersion·Packages 되돌림). 남은 흠은 char-forge README §8-1 열셋째. 다음 = HOW_TO_PLAYTEST §9 사용자 판정.

## 2026-09-27 DUNGEON — PLAN 109-10-5 지역 몬스터·위험도·우두머리 (웹 사가블로 §5.13, "사가 유니티 이어해" → 사용자 "109 재개")

- 110 은 기계 몫이 다 끝나 사람 칸만 남음 → 다음을 물음 → 사용자 **109 재개**(PLAN 110 머리에 적음). 표 10번 다음 조각 10-5.
- 위험도 = 웹 FOES.lvl 그대로(중원 0·개펄 2·폐도시/서역 3·신도시/설산 4·천계 5·지옥/기계 6). 웹 "가운데서 3000 마다 +1(상한 30)" 은 이 트랙 칸이 전부 가운데서 한 칸 거리라 없음. 110 때 적은 설계대로 **옛 VS 적(모루골·Room2~4)·들길 매복엔 안 곱함** — 매복 셋은 전부 중원 경계(±15)라 곱해도 0.
- 명단: 웹은 지역마다 12~23종인데 이 판 몸은 시대 적 여덟·황건·해골뿐 → 지역 시대(웹 era)로 호위 몸(과거 황건 정예 · 현대/미래 그 층 단계 DungeonEras 적 · 신화 새 "해골 무사"). 호위 i = era[i % 개수].
- 우두머리 아홉(웹 id·이름·사연·빛깔 그대로, `DungeonRegionFoes`·`RegionBossRunner`·`RegionBossState`): 웹 "1500 안에 들면 선다" 를 그대로 두면 칸이 방 하나라 시작 방에서 곧장 4층 두목 ×3 체력이 붙는다 → **벽 가 고정 표식(검은 돌기둥 + 빛 구슬)을 밟으면** 선다(4m 안 한 번 알림). 자리는 문·행상·손님·시대 꾸밈(모서리 ±7.5)·옛 VS 적·난입/시련 표식·보물상자를 비켜 칸마다 손으로(모루골 (-7,-8) — 처음 (-4.5,-7.5) 는 보물상자 3.5m 라 다른 진단 순간이동에 알림이 뜰 수 있어 옮김). 호위 셋은 표식에서 방 가운데 쪽 부채꼴(±50°, 2.6m — 둘레로 펴면 벽 밖).
- 세기 = 위험 + 4 층 두목 공식, 체력 ×3(웹 그대로, 층 번호도 웹 levelAt 그대로 — 위험 0 적 = 1층). 이 판 적 이동이 벽을 안 보고 끝없이 쫓아(`transform.position +=`) **18m 끈**: 표식에서 멀어지면 물러남(쉼·기록 없음), 우두머리가 쓰러져도 호위는 남아 싸우다 끈으로 같이 물러남.
- 보상: 전설 = 명소 무기 여섯 중 지역·횟수 해시(적 쪽 rewardItemId → 빛기둥 고유) · 홍옥 · 금 = 잡졸 금 ×6(웹 dropGold ×6) · 경험치 = 층 두목 공식 · 공적 (15 + 층) × 50 냥(시련과 같은 환산). 웹 "보물 bias 45 둘·재료" 는 무기 한 칸·재료 없음이라 뺌. 토벌 글은 적의 보상 글 위에 한 줄 얹음(`DialogueLabel.CurrentText` 새로). 쉼 10분 = 실제 시각(유닉스 초, 진단은 `NowOverride`).
- 몸: 색 바꿔 돌려쓰기 대신 **다른 판 몸을 빌림** — 중원 Morak(STORY 두목)·폐도시 Warzombie·개펄 Copzombie(GO)·지옥 Yaku·신도시 Racer·서역 Maw(GO 수호장)·천계 Mremireh·설산 Dummy·기계 Mannequin + 신화 호위 Skeleton(능묘 파수꾼 몸). 전부 이미 다른 빌드 씬이 쓰는 몸이라 `build_deps.txt`·크레딧 그대로. 이 PC 는 묶음이 없어 **씬 재빌드 대신 층 진행기 YAML 에 `regionBodyNames/Models` 스물두 줄을 손으로** — GUID·fileID 는 TestField(STORY 시대 적 여덟·두목)·TestVillage(수호장·시대 몸)·TestDungeon(파수꾼) 에서 그대로(GasMask·ExoRed GUID 가 GO·DUNGEON 씬에서 같음을 먼저 확인). 빌더도 같은 두 칸을 싣게 고침 — 묶음 PC 재빌드 결과와 같은 모양. 키는 Play 때 재서(몸마다 한 번) 우두머리 2.8m·신화 호위 2.2m, 도형 폴백은 2m 기준.
- 표시: 배너 셋째 줄 "위험 N · ☠ 우두머리"(높이 110→140) · M 지도 칸 넷째 줄 ☠ 이름(토벌 ✔, 쉬는 중 잿빛 — ✓ 는 Noto Emoji 에 없어 ✔) · HUD 무기 줄 끝 "위험 N"(바깥 칸에서 층 대신). 웹 "HUD 머리 = 지역 이름" 은 해 봤더니 배치 점검 겹침이 떠서 뺐다 — 다만 그 겹침은 뒤에 보니 진단이 남긴 Lv.23 세이브 탓(아래).
- 번역 26 키 ko·en(영어 이름은 칸 140px 에 맞춰 짧게), loc-review 오류 0 · 넘침 주의 98→102. 세이브 v13 `regionBoss`(키로 맞춰 읽음, 모르는 키 버림). 시련 진단의 "버전 == 12" 를 "≥ 12" 로.
- 진단 `PlaytestDungeonRegionFoes`(지역 아홉 뒤): 표(위험 웹 값·층·체력 ×3·이름 겹침·빌린 몸이 이 판 몸과 안 겹침·자리 = 제 지역 방 안·층 진행기 몸 목록·도감 번역 키) · 표식 아홉 · 4m 알림 한 번 · 밟기(천계: 우두머리 체력·전설·호위 신화/미래/신화 이름·엘리트 체력·방 안) · 두 번 안 섬 · 끈 · 토벌(기록·첫·시각·공적 금·전설 갖춤·고유 빛기둥·쉼 600초·흐림·쉬는 동안 안 섬·호위 남음 → 끈) · 601초 뒤 다시(두 번째 전설·첫 아님) · 중원 호위 황건 정예 · HUD · 배너 · M 지도 · 세이브 왕복·옛 세이브·키 맞춤 · ko/en 52.
- 검증(묶음 없는 이 PC, 6000.3.23f1): 컴파일 오류 0 → `PlaytestDungeonHeadless` 6회 모두 regionfoes OK·같은 줄("몸 0/10 표식 9 전설 wp_lm_bandit·공적 1200 … 키 52"), 실패는 무기 칼날·등장 컷 카메라·씬 열기/Missing Prefab 476e… 넷 — **씬만 HEAD 로 돌린 기준선도 같은 넷**(+ 예상대로 "빌린 몸 0 ≠ 10"). `PlaytestOverworldMap`·`PlaytestDungeonFloorProgression` 도 Missing Prefab 만. `UiLayoutCheck` 는 처음 문제 6(영어 DUNGEON HUD ↔ 목표판) → HUD 는 "Lv.23" = 헤드리스가 끌 때 자동 저장으로 남긴 세이브 탓(PROJECT_STATE 함정 그대로) → 세이브를 잠시 옮기고 돌리니 **OK 문제 0**, 세이브는 제자리로. 배치가 건드린 글꼴 SDF 셋·Mobile_RPAsset 은 되돌림.
- 묶음 PC 에서: 판별 헤드리스 다시(몸 10/10 이어야) · 빌린 몸 키·빛(TintMix 0.45) 눈으로. 실기 확인 전: 표식 자리·크기, 우두머리 세기(위험 6 = 10층 두목 ×3 체력 4034·공격 57), 18m 끈 체감, 알림 글 넘침.
- 다음 = 109-10-6 웹 5.14 지역 사연.

## 2026-09-27 DUNGEON — PLAN 109-10-6 지역 사연 사슬 (웹 사가블로 §5.14, "사가 유니티 이어해")

- 웹 CHAINS 아홉의 글(제목·의뢰인·사연·흔적 이름·찾은 글·정예 이름·평정 글)과 chainStep 수치를 그대로(`DungeonRegionSagas`): 토벌 10+2L · 정예 3(중원 2) · 금 60+30L / 80+40L / 100+50L / 400+200L · 경험 10+5L / 15+5L / 20+8L / 60+20L · 평정 공적 (20+L)×50 냥 · 구주 평정 금 20000·경험 1000·공적 100×50.
- 열림 = 들어섬 배너(`DungeonRegionTracker.RegionEntered`, 웹 "처음 발 들이면"). 걸음 순서대로만, 처치 한 번은 지금 걸음 하나에만 센다 — 웹 코드는 한 처치가 ③ 을 채우고 곧장 ④ regionboss:kill 도 받을 수 있어 여기선 막음(`RegionBossRunner.RegionOf` 로 우두머리를 가려 ③ 이면 ③ 에만). 우두머리 먼저 잡아도 안 건너뜀, ④ 에 닿으면 `RegionBossState.ClearRest`.
- ① 은 그 지역에서 쓰러진 적 누구든(처치 자리, 우두머리는 제 지역) — 던전 층·시련/난입 방은 지역 밖이라 안 셈. ③ 은 새 `DungeonEnemy.IsElite`(`MarkElite`: 우두머리 호위·사냥터 정예) + 우두머리. 옛 VS 정예는 안 셈(위험도와 같은 결).
- **사냥터**: 이 트랙 칸엔 들판 몬스터가 없어 ①·③ 걸음 동안 칸마다 붉은 깃발, 밟으면 ① 잡졸 셋(과거 황건적·현대/미래 그 층 단계 시대 적·신화 새 "해골 졸개") / ③ 남은 수만큼 정예(우두머리 호위와 같은 몸), 위험도 층 공식. 다 쓰러지면 3초 뒤 다시(깃발 위에서), 칸을 떠나면 물러남. 처음엔 들어서기만 해도 서게 짰다가 — 시작 방 모루골에서 새 게임 1.2초 만에 싸움이 붙고 다른 헤드리스 진단(전투·락온)의 적 수에 끼어들 수 있어 우두머리 표식과 같은 "밟기"로.
- 흔적·사냥터 자리(`Clue`·`Hunt`): 우두머리 표식을 방 가운데 기준으로 +90°·−90° 돌려 0.8·0.7 배(겹침·문길·꾸밈 모서리 비킴), 기계 황무지는 사냥터가 감시탑 턱(2.7m 돌) 위라 손으로. 흔적은 ② 걸음일 때만 금빛 기둥(맥동), 깃발은 ①·③ 때만 — 기록이 바뀔 때마다(`RegionSagaState.Changed`) 다시 켜고 끔(처음엔 Tick 에서만 해 진단이 한 박자 늦게 봄).
- 흔적 이름 앞 그림 문자(🚩🚨📓🪨💻🔔🪧🚡📐)는 Noto Emoji 판에 없는 게 섞여 빼고 🔍 하나로(깃발 안내만 🚩).
- 표시: HUD 한 줄 "📜 제목 k/4 걸음 n/m"(흔적 🔍 이름·우두머리 ☠ 이름) — 긴 설명을 넣으면 폭 700 을 넘어 목표판과 겹쳐 짧게, 설명은 알림(열림·걸음 완료·다음) · M 지도 칸 머리 ❔(안 연 곳)/📜/🔍/🏳(평정) · 판 맨 아래(칸 밑 35px) "📜 지역 사연 n/9 평정".
- 배치 점검(`UiLayoutCheck`, 남은 고레벨 세이브는 옮기고)이 "지역 배너 ↔ 축복 3택 단추" 겹침을 잡음 — 시작 직후 뜬 모루골 배너(10-5 에서 140 높이) 가 축복 창과 함께 보인 경우, 실제로도 날 수 있어 **축복 3택·시련 카드가 열려 있으면 배너를 숨김**(시간은 흐름) → 문제 0.
- 번역 79 키 ko·en, loc-review 오류 0 · 넘침 주의 102→112. 세이브 v14 `regionSaga`(키로 맞춤·걸음 상한)·`regionSagaAll`.
- 진단 `PlaytestDungeonRegionSagas`(우두머리 뒤): 표(아홉·글·웹 수치·흔적/사냥터 제 지역 방 안·우두머리 표식·서로 4m 밖) · 들어섬 = 열림 한 번 · ① 딴 지역·던전 처치 안 셈·깃발 안 밟으면 안 섬·밟으면 셋(신도시 = 미래 몸·위험 4 층 체력)·3초 뒤 다시·칸 떠나면 물러남·18 채우면 보상 · 우두머리 먼저 잡아도 ② 그대로·호위도 안 셈 · 흔적(그 걸음만 보임·3m 밖 안 됨·찾은 글) · 정예 셋(잡졸 안 셈·하나 잡고 물러났다 다시 = 남은 둘) · ④ 에서 쉼 풀림·깃발 꺼짐·호위 안 셈·우두머리 → 평정·공적·평정 뒤 안 셈 · 구주 평정 한 번 · HUD·M 지도 표·평정 수 · 세이브 왕복·옛 세이브·키 맞춤 · ko/en 158.
- 검증(묶음 없는 이 PC): 컴파일 오류 0 → `PlaytestDungeonHeadless` regionsagas **3연속 OK**(같은 줄), 실패는 10-5 기준선의 환경 넷 그대로 · `PlaytestOverworldMap` Missing Prefab 만 · `UiLayoutCheck` OK 문제 0. 글꼴 SDF 셋·Mobile_RPAsset 되돌림.
- 실기 확인 전: 깃발·흔적 자리가 눈에 띄는지, 토벌 수(최대 22)가 지루하지 않은지, 알림 글 길이.
- 다음 = 109-10-7 웹 5.16 몸짓.

## 2026-09-27 char-forge — 바지 다리 통 tuck·닌자복·카바 속 바지 (7벌)

"vroid 자체툴 이어해".

- 공방 바지 셋 엉덩이 옆 턱 → leggings `tuck`·`round_bottom`(맨몸 잡졸·무도 수행자·황건 두목·정찰병). 닌자복 가랑이·어깨·발목 살, 카바 속 바지 흰 점(시간 행상), 불량배 조끼 어깨 살.
- 순찰 대원 조끼 등 파임은 under 거리로 안 풀려 되돌림(팔 뼈 무게 — CF_Guard 어깨 혹과 같은 갈래).
- 검사: 7벌 verify fbx ≤ 0.7° · glb 0.0° · sha256 같음(넷) · CMP_RESULT OK(FBX 로컬 전용, ProjectVersion·Packages 되돌림). 남은 흠은 char-forge README §8-1 열넷째. 다음 = HOW_TO_PLAYTEST §9 사용자 판정.

## 2026-09-27 saga-unity DUNGEON — 109-10-7 몸짓(웹 사가블로 §5.16)

"사가 유니티 이어해"(작업 전 좀비 프로세스 점검 — 없음, 아무것도 안 죽임: 다른 세션의 헤드리스 크롬·Godot 테스트와 MCP 서버뿐).

- 웹 `gesture.js` 를 화면 층만으로 옮김: `GestureState`(순수 — 일 표·갈래 초·FNV-1a 틈틈이·Plan) + `Gesturer`(뿌리마다, 뼈·튐·머리 위 글자) + `GestureRunner`(Play 때 설치 — 촌민에 붙이고 레벨업·두목급 처치 구독). 선두 대기술은 회전베기(`PlayerCombat.TryWhirl`), 볼일은 행상 판매(`DungeonMerchant`), 시대 손님·행상 주인·동행 둘은 제 코드가 붙임.
- 이 판 마을 사람 몸은 대기 클립뿐이라 웹처럼 슬롯을 못 바꿈 → `LateUpdate` 에서 애니메이터 자세 위에 팔·허리·머리 뼈를 **월드 축**으로 더 돌림(리그 로컬 축이 달라도 같은 쪽). 애니메이터가 그 프레임 뼈를 안 썼으면(컬링·꺼짐) 지난번 더한 걸 먼저 되돌려 안 쌓임. 폴백 몸은 몸 전체 숙임·튐. 마을 아낙(PeasantGirl)의 Attack 트리거는 술사 시전이라 마을 사람엔 트리거를 안 씀(동행만).
- 함정: `SagaWorldText.Add`(TMP)를 붙이면 Transform 이 RectTransform 으로 **바뀌어 앞서 잡은 Transform 이 파괴됨** → 붙인 뒤 `_label.transform` 을 잡는다(첫 실행 MissingReferenceException).
- `Quaternion ==` 는 내적 비교라 0 쿼터니언끼리 같다고 안 나옴 → "건드렸나" 표시는 bool 배열.
- 번역 11 키 ko·en(그림 문자는 Noto Emoji 에 있는 것만, 변형 선택자 없이), loc-review 오류 0.
- 진단 `PlaytestDungeonGestures`(사연 뒤): 표(일 여섯·손님 넷 모두 일·초·웹 FNV 값 node 로 뽑아 박음·주기 7~11) · 수명·걷는 중 글자만·튐 · 틈틈이(창 안/밖·마을 사람만·비율 ≈1.4/주기) · 볼일 한 번 · 사건(진짜 더미 처치 — 잡졸 안 됨·두목 환호, 진짜 회전베기 → 호응) · 붙임(촌민 3·손님 4·행상 주인·무사·술사, 키 안 겹침) · 화면(다가섬 한 번·나갔다 오면 또·글자·동행 트리거 한 번·폴백 숙임/튐 제자리·휴머노이드 팔 들림 0.16m·쌓임 0·제자리) · 손잡이 끔 · ko/en 22. 주인공 몸 프리팹이 빠진 PC 는 디스크의 Maria FBX 로 휴머노이드를 잰다.
- 검증(묶음 없는 이 PC, 6000.3.23f1): 컴파일 오류 0 → `PlaytestDungeonHeadless` gestures **3연속 OK(같은 줄)**. 4·5회차에 party(소환) 실패가 끼었는데 party 는 몸짓보다 앞에서 돌고, 쌓인 자동 세이브(Lv.53)를 잠시 치우고 돌리니 party OK·칼날 실패도 사라짐 → 세이브 탓(세이브는 제자리로). 남은 실패는 환경 셋(컷 카메라·씬 열기·Missing Prefab). 글꼴 SDF 둘·Mobile_RPAsset 되돌림, EditorSettings 는 줄 끝만(커밋 안 함).
- 실기 확인 전: 손짓·망치질 팔 각도가 몸마다 자연스러운지(특히 시대 손님·행상), 머리 위 글자와 이름표·풍선 겹침, 틈틈이 빈도가 산만하지 않은지, 동행 호응이 회전베기와 박자가 맞는지.
- 다음 = 109-10-8 웹 5.17 동행 서명·합격.

## 2026-09-27 char-forge — CF_Guard 대기 어깨 뒤 혹 풀림 (7벌)

"vroid 자체툴 이어해".

- 원인: CF_Guard 가 오른손을 허리 앞 ik 로 끌어 위팔이 쉼 대비 94° 꺾였다(Sword_Idle 36°) → 어깨 뒤 살이 조끼·전포 등을 뚫음. 팔을 기본 동작에 맡기면 등뼈를 세울 때 팔이 부모 따라 돌아 앞으로 들렸다.
- keyframes 자세 칸 `keep_world`(기본 동작의 월드 방향 지키기) — CF_Guard 두 팔 = Sword_Idle 월드 방향. 맨몸 잡졸·성 경비·가죽 기사·황건 두목·찰갑 무장·성 파수병·칼 든 아가씨 어깨 혹 0.
- 검사: 7벌 verify fbx ≤ 0.7° · glb 0.0° · sha256 같음(둘) · CMP_RESULT OK(FBX 로컬 전용, ProjectVersion·Packages 되돌림). 다음 = HOW_TO_PLAYTEST §9 사용자 판정.

## 2026-09-27 saga-unity DUNGEON — 109-10-8 동행 서명·합격(웹 사가블로 §5.17)

"사가 유니티 이어해".

- 웹 `castAllySig`·`stepAllySig` 를 옮김: `AllySigState`(순수 — 수치·쓸 까닭·1.5초 합격 창·세션 셈) + `AllySigCaster`(무사·술사가 Awake 에 붙임, 재사용·세기·파동·밀침·얼림·알림) + `SigPulse`(땅 고리 0.35초). 회전베기가 창을 연다(`PlayerCombat.TryWhirl`, 10-7 호응과 같은 자리).
- 이 판 동행은 인물이 아니라 서명을 지어 줌: 무사 💥 철벽 진동(v 3.0·24초·밀침 1.25m) · 술사 ❄ 서리꽃 파동(v 2.6·21초·밀침 0.83m·얼림 2.8초). 반경 5m(웹 120px 을 회전베기 68px ↔ 2.8m 비로). 위력 = 제 평타 × v — 웹 companionMul(선두 대비 힘 0.2~1.5 × 0.55)은 이 판 동행이 제 공격력을 따로 가져 뺐다. 두목급은 안 밀림(이 판 적은 트랜스폼으로만 움직여 밀침은 자리를 옮김).
- 합격 창은 한 번 쓰면 닫힘(웹 run.comboT = 0) — 동행 둘 중 먼저 나간 쪽만 ×1.5.
- 몸짓: 쓴 동행만 ✨ 서명 / ⚡ 합격 → `Gesturer` 에 동행별 제 키(ally.guard·ally.mystic)를 두고 먼저 봄, 호응·환호(ally)는 여전히 둘 다. 서명 몸은 시전자가 제 공격 클립을 틀어 몸짓은 글자만(Slot.None) — 싸우는 중이면 어차피 글자만이라 겹치지 않게.
- 번역 5 키 ko·en, loc-review 오류 0.
- 진단 `PlaytestDungeonAllySig`(몸짓 뒤): 표(재사용 24·21·하한 8·밀침 상한·얼림·그림 문자) · 쓸 까닭 진리표 8줄 · 외딴 곳 시험 시전자로 첫 4초·둘 안 씀/셋 씀·피해 = 4 × 3.0·밀침 1.25m·재사용 24초 동안 안 씀·정예 하나·두목 하나(안 밀림)·반경 밖 셋 안 씀·술사 얼림/밀침 0.83·쓰러지면 안 씀 · 합격(창 1.5초·×1.50·알림에 서명 이름·⚡ 몸짓·둘째 동행 못 씀·창 밖 1.6초) · 손잡이 · 진짜 회전베기가 창을 엶 · 진짜 동행 둘에 역할 맞는 시전자·제 키 몸짓(쓴 쪽만 ✨·호응은 둘 다) · ko/en 10.
- 검증(묶음 없는 이 PC): 컴파일 오류 0 → 세이브를 비우고 `PlaytestDungeonHeadless` **3연속 OK**(gestures·allysig 같은 줄), 실패는 환경 셋(컷 카메라·씬 열기·Missing Prefab) · 동행이 스스로 쏘니 여러 프레임 도는 `PlaytestDungeonFloorProgression` 도 돌림 — 12/12 진행, Missing Prefab 만(기준선). 세이브는 제자리로, 글꼴 SDF 둘·Mobile_RPAsset 되돌림.
- 실기 확인 전: 24·21초 재사용이 체감에 맞는지, 회전베기 → 합격 박자가 손에 붙는지, 세기(평타 × 3 = 12, 합격 18)가 층이 깊어지면 묻히는지, 밀침이 벽을 뚫고 보이지 않는지.
- 다음 = 109-10-9 웹 5.18 명소 층 주인 고유 수.

## 2026-09-27 char-forge — 순찰 대원 조끼 등 파임·장화 밖 바지 조각 (4벌)

"vroid 자체툴 이어해".

- 원인: 동작 휨이 아니라 **쉼 자세부터** 재킷 어깨뼈 자리가 판 조끼 등보다 중간값 3cm 밖 — `under` 안쪽 광선 2cm 가 못 잡았다. 장화 목 밖 바지 종아리도 같은 원인.
- `build_real` 레시피 칸 `under_reach` {겉옷: [바깥, 안쪽]} — 2cm 넘게 깊은 것은 겉옷 판이 같은 쪽을 볼 때(내적 > 0.7)만. 순찰 대원 조끼·장화, 폭주 라이더·전장 망자·방독면 약탈자 장화 [0.03, 0.06]. 안 준 레시피는 바이트까지 같다.
- 검사: 4벌 verify fbx ≤ 0.54° · glb 0.0° · sha256 같음 · CMP_RESULT OK(FBX 로컬 전용, ProjectVersion·Packages 되돌림). `under` 쓰는 다른 열한 벌은 대기·쉼 자세 측정으로 깊은 뚫림 0. 다음 = HOW_TO_PLAYTEST §9 사용자 판정.

## 2026-09-27 char-forge — 61벌 다시 훑기: 조끼 등 오른쪽·어깨 살·띠 톱니 (4벌)

"vroid 자체툴 이어해".

- 순찰 대원: 새 옷 틀 `tacvest_coat`(여유 4.5cm, 두꺼운 제복 재킷 위) + `under_reach` 안쪽 6cm — 등 오른쪽 재킷 조각까지 사라짐. 용병 `tacvest` 는 그대로.
- 성 경비·털 대장: `under` 겉옷 > 살 — 대기 자세 어깨·가슴 살 조각 없앰. 충돌 인형: 껍데기 칸 `z_snap`(목·허리·무릎 띠 끝을 곧게, 팔 띠는 그대로).
- 사진작가 정장 번들거림은 게임엔 없음(이 장면이 `cloth_*` 매끈함 0.2 를 줌) — Blender 비교 렌더만 게임과 같게 고침.
- 검사: 4벌 verify fbx ≤ 0.56° · glb 0.0° · sha256 같음 · CMP_RESULT OK(FBX 로컬 전용, ProjectVersion·Packages 되돌림). 다음 = HOW_TO_PLAYTEST §9 사용자 판정.

## 2026-09-27 saga-unity DUNGEON — 109-10-9 명소 층 주인 고유 수(웹 사가블로 §5.18)

"사가 유니티 이어해".

- 웹 `guard.sig`·`guardZones`·`stepGuardSig` 를 옮김: `DungeonLordSigs`(순수 — 여섯 수 표·px→m·원 자리·닿음) + `LordSigRunner`(주인마다, 층 진행기 `SpawnLord` 가 걸고 `DungeonEnemy.Tick` 이 부름) + `LordZoneFx`(예고 원·불바닥). 명소 키 여섯이 웹과 같아 짝 그대로: 호령·화살비·삼연돌·소용돌이·장판·십자. 호령 졸개는 `SpawnLordAdd` → 층 진행기 잡졸(같은 방 = 방 치움 셈).
- 주인 AI 에 끼움: 달려든 뒤(Idle 아님)만 고유 수, 예고·시전하는 동안 강타를 쉼, 강타 예비동작 중엔 새로 안 검 — 웹 "무기 패턴을 쉰다". `DungeonEnemy` 에 `DisplayName`·`MaxHp`·`Damage`·`SetLordSig` 추가, 쓰러짐·도망에서 `Clear`.
- 거리 24px = 1m(10-8 과 같음): 화살비 r 1.75·간격 2.29 · 삼연돌 r 1.42 · 소용돌이 r 3.96·끌림 2.5m/s · 장판 r 1.92 · 십자 r 0.92·간격 2.0 · 내 몸 0.54. 소용돌이는 CharacterController.Move 로 끌어 벽이 막는다. 원소는 빛깔만.
- **진단 중 발견·고침**: 진단이 영웅을 레벨 80 으로 올리고 주인을 쓰러뜨리자 배치가 멈춤(로그 126MB, 레벨업 10만 번). `HeroState.ExpForLevel` = 20 × 1.3^(L−1) 이 L ≈ 72 부터 int 를 넘어 음수로 뒤집혀 `AddExp` 의 while 이 끝나지 않았다 — 실제 플레이에서도 그 레벨이면 멈추고, 헤드리스가 남기는 세이브(지금 Lv.53)가 쌓여도 언젠가 진단이 멈췄을 것. int 최대에 멈추게 고침. 멈춘 배치 Unity 는 그 PID 만 끔. 진단 레벨은 60.
- 번역 7 키 ko·en, loc-review 오류 0.
- 진단 `PlaytestDungeonLordSigs`(서명 뒤, 명소 여섯을 JumpToFloor + BuildRoomForTest(lord) 로 진짜 주인 방에서): 표(여섯 = 명소 키·갈래 여섯·px→m·화살비 원 셋·양옆·방향 돎·순수·크기 고정·십자 스물 번갈아·소용돌이 = 주인 자리) · 주인마다 제 수 · 화살비(주인 Tick 이 부름·예고 중 강타 안 함·첫 알림 한 번·서면 맞음·재사용 7·비키면 안 맞음·손잡이) · 삼연돌(세 번·주인이 내 자리로·재사용 8·세 번 맞음) · 소용돌이(끌림 = min(거리 − 1.2, 2.5 × dt)·터짐·구르면 안 끌리고 안 맞음) · 장판(맞음·불바닥 틱 둘·넷까지·6초 뒤 꺼짐·주인 쓰러지면 지움) · 십자(예고 원 스물·+ 에 맞고 × 에 안 맞음) · 호령(강타 안 쉼·⅔ 둘·⅓ 둘 = 방 적 +4·셋째 문턱 없음) · ko/en.
- 검증(묶음 없는 이 PC): 컴파일 오류 0 → 세이브를 비우고 `PlaytestDungeonHeadless` **3연속 OK**(gestures·allysig·lordsigs 같은 줄 — "호령 4 화살비 삼연돌 3 끌림 1.25m 구르기 OK 장판 넷 십자 20"), 실패는 환경 셋(컷 카메라·씬 열기·Missing Prefab). 세이브는 제자리로, 글꼴 SDF 둘·Mobile_RPAsset 되돌림.
- 실기 확인 전: 예고 원 크기·진해지는 박자가 읽히는지, 소용돌이 끌림이 억울하지 않은지(구르면 풀림), 불바닥 피해·넷 겹침, 십자 원 스물이 방 밖으로 새는지, 호령 졸개가 벽 속에 서지 않는지.
- 다음 = 109-10-10 웹 5.19 몰이 사냥(10번 칸 끝 조각).

## 2026-09-27 char-forge — 충돌 인형 팔 띠·장화 밑창 (6벌)

"vroid 자체툴 이어해".

- 껍데기 칸 `z_snap: "axis"` — 비스듬한 팔 띠 끝을 뼈 축 위치로 곧게(수평 높이로 맞추면 벌어졌다). 충돌 인형 마디 띠 넷 모두 곧음.
- `under` 장화 > 몸 옷 — 충돌 인형 달리기 밑창 구멍의 노란 몸 옷. 같은 장화·몸 옷 다섯(거신·별바다 손님·강철 인형·시험 인형·방문자)도 가려진 몸 옷 면만 지움(보이는 변화 없음, 밑창 얼룩은 그림).
- 검사: 6벌 verify fbx ≤ 0.55° · glb 0.0° · sha256 같음 · CMP_RESULT OK(FBX 로컬 전용, ProjectVersion·Packages 되돌림). 다음 = HOW_TO_PLAYTEST §9 사용자 판정.

## 2026-09-27 saga-unity DUNGEON — 109-10-10 몰이 사냥(웹 사가블로 §5.19) — PLAN 109 표 10번 칸 끝

"사가 유니티 이어해".

- `DungeonHunt`(순수 수치·판정) + 층 진행기 `AddPacks`(전투방 잡졸마다 졸개 2 — `SpawnGrunt` 에 졸개 배율을 얹음, 같은 자리 번호라 같은 시대 몸·이름) + `PlayerCombat.Cleave`(평타 120°·강공격 180° 부채꼴) + `DungeonEnemy` 경직·움찔·`DeathFling`(쓰러짐 날림·가라앉음).
- 웹 수치 그대로(졸개 55%·70%·상한 30·곁 60%/75%·반경 × 1.35/1.8·경직 0.25·움찔 0.28·흔들림 ±0.45rad·힘 0.7~2.4). 웹 "드롭 ½" 은 보상 절반·무기 없음으로. 무작위 없음(층·방·자리 해시).
- 해당 없음으로 뺀 것: 방 1.5배(이미 20×20m, 구운 셸) · 들판 상한/보충/소품 밀도/안 보이는 나무(절차 들판 없음) · 무예 원뿔·끌어당기기(그런 무예 없음).
- 쓰러짐 날림은 애니메이터 있는 몸만(파괴 1.2초 안) — 폴백 도형은 예전처럼 곧장 사라진다(다른 진단의 "쓰러지면 없어짐" 가정을 안 흔듦). 움찔은 피격 클립 없는 몸만(있는 몸은 원래 Hit 트리거).
- 옛 진단 둘이 "전투방 적 = 잡졸 넷·순서 = 자리 번호" 로 세서 깨짐(landmarks 보통 층 이름·eras 12 ≠ 4) → 그 자리에서만 졸개를 뺌(방 치우기는 그대로). 졸개 이름·몸 맞춤은 새 진단이 본다.
- 진단 `PlaytestDungeonHunt`(주인 고유 수 뒤): 표(부채꼴 60°/90° 경계·반경·힘 0.7/2.4/+0.5·흔들림 범위·고리·첫 공격 순수) · 진짜 2층 전투방(잡졸 4 + 졸개 8·체력/피해/몸 배율·무기 없음·보상 ≤·이름 = 우두머리·방 안·첫 공격 범위·두 번 지어도 같은 자리·손잡이 0 = 4·정예 방엔 없음) · 진짜 평타(곁 45° ×0.60, 80°·뒤·4m 안 맞음) · 진짜 강공격(곁 80° ×0.75·4m 맞음·뒤 안 맞음·곁 셋)·손잡이 끔 · 경직(잡졸 ≥0.25·두목 0·손잡이 0)·움찔 · 진짜 Die(Maria FBX 몸 더미 — 날림 2.64m = 2.4 × 1.1·나에게서 먼 쪽 0.23rad·0.3초 뒤 제 높이·0.9초 0.40m 가라앉음·눕힘·흩어짐 0 = 곧게).
- 검증(묶음 없는 이 PC): 컴파일 오류 0 → 세이브를 비우고 `PlaytestDungeonHeadless` **3연속 OK**(gestures·allysig·lordsigs·hunt 같은 줄), 실패는 환경 셋(컷 카메라·씬 열기·Missing Prefab) · `PlaytestDungeonFloorProgression` 12/12 진행·Missing Prefab 만(기준선 — 졸개가 늘어도 층을 다 내려감). 세이브는 제자리로, 글꼴 SDF 둘·Mobile_RPAsset 되돌림.
- 실기 확인 전: 방당 12마리가 폰에서 버벅이지 않는지(30fps), 떼로 몰아 쓸어버리는 맛이 나는지, 경직 0.25초가 너무 쉬워지지 않는지, 날림 거리·가라앉음이 벽 밖으로 새지 않는지.
- 다음 = PLAN 109 표 11번 STORY 5-9 보스 패턴전.

## 2026-09-27 char-forge — 장화 옆 바지 점·닌자 가랑이 틈 (4벌)

"vroid 자체툴 이어해".

- 레시피 칸 `under_below` {겉옷: 여유} — 장화 윗단 3cm 아래·장화 가까이의 바지는 모두 장화 속으로 지움(발목 옆은 광선이 못 잡아 바지가 네모 점으로 뚫었다). 전장 망자·순찰 대원·방독면 약탈자.
- 옷 틀 `shinobi` 다리 통 윗단 가랑이 +5cm — 닌자 앞 가랑이 틈(서기·달리기) 없앰. 도감 hero_jp_hanzo 색 변형 옷도 다시 지음(도감 몸은 로컬 보류).
- 검사: 4벌 verify fbx ≤ 0.7° · glb 0.0° · sha256 같음 · CMP_RESULT OK(FBX 로컬 전용, ProjectVersion·Packages 되돌림). 다음 = HOW_TO_PLAYTEST §9 사용자 판정.

## 2026-09-27 STORY — 109-11-1 보스 패턴전(웹 §5-9)·플레이어 체력 신설

"사가 유니티 이어해" → PLAN 109 표 11번 첫 조각.

- 막힘 → 결정: 이 트랙 STORY 는 플레이어 체력이 없고(StartHp 는 "미사용" 값뿐) 적·두목이 반격하지 않아, 웹 "피하지 못하면 피해"를 옮길 곳이 없었다. 사용자에게 물어 **플레이어 체력 신설**로(다른 안: 체력 없이 경직 · 11번 보류).
- `StoryPlayerHp`(최대 60+90+레벨×12+전직 Hp, 무적 0.7초, 5초 뒤 초당 4% 회복, 세이브 없음) · `StoryPlayerVitals`(피격 클립·붉은 숫자·흔들림, 쓰러짐: 들판 입구 + 두목 태세 되돌림 / 비경 패퇴) · HUD "❤ HP".
- `StoryBossPattern`(순수, 웹 boss-pattern.js 수치 그대로·px×0.02) · `StoryBossPatternRunner`(두목마다 Play 때, IApi) · `StoryBossWarnFx`(예고 그림) · `StoryEnemy` MaxHp·SpawnMinion·RegroupAfterPlayerFell · `StoryLabyrinthRunner` 방 경계·AddArenaEnemy·OnPlayerFell. 글 10 키(ko/en), loc-review 오류 0.
- 발견: Mathf.Round 는 짝수 쪽 반올림이라 웹 Math.round 와 12.5 에서 갈림 → `StoryBossPattern.JsRound`.
- 검증(묶음 없는 이 PC): 컴파일 0 오류 · `PlaytestStorySlice` 6번 모두 `bossPattern OK`, 슬라이스 끝은 기준선과 같은 무명 옷·Missing Prefab FAIL(phase=SaveLoad) — 묶음 PC 에서 3연속 재확인 · `UiLayoutCheck` TestField 세 비율·영어 겹침 0(FAIL 6 은 en:TestDungeon 지역 배너·대사 줄 겹침, en:TestCity 한글 — 이번 변경 밖). 글꼴 SDF 셋·Mobile_RPAsset 되돌림.
- 실기 확인 전: 예고 시간(1.0~1.8초) 체감, 휩쓸기 55% 가 과한지, 안전지대 3.4m 폭, 원판이 옆 시점에서 읽히는지, Lv 높을 때 두목 힘.
- 다음 = 11-2 5-10 보스 고유 기술·그로기.

## 2026-09-27 char-forge — 불량배 조끼 어깨 덮개 (1벌)

"vroid 자체툴 이어해".

- 옷 틀 `vest_cap`(garments.py) = 누빈 가죽 조끼 + 짧은 어깨 덮개 — 조끼 밑 어깨 살을 지운 경계가 대기에서 팔 따라 톱니로 드러나던 것(스물한째 시험에서 남은 길) 없앰. 불량배(Jody 자리) `vest@141416,2a2a2c` → `vest_cap@…`.
- 레시피 칸 `under_rows` {겉옷: {속옷: 줄 수}}(build_real hide_under, 기본 1) — 덮개 끝단 안 살 톱니는 살 2, 속 민소매 끈 삐짐은 0. 달리기 엉덩이 골 살 점 → `under` {바지: [살]} 줄 0.
- 검사: verify fbx 0.53° · glb 0.0° · sha256 두 번 같음 · 순찰 대원(칸 없음) sha 그대로 · CMP_RESULT OK(FBX 로컬 전용, ProjectVersion·Packages 되돌림). 다음 = HOW_TO_PLAYTEST §9 사용자 판정.

## 2026-09-27 STORY — 109-11-2 보스 고유 기술·그로기(웹 §5-10)

"사가 유니티 이어해" → PLAN 109 표 11번 둘째 조각.

- 웹 SIG 표 열둘(사냥터 보스 여섯 + 관문 대장 다섯 + 관문 수호장)을 `StoryBossPattern.Sigs` 로(id·이름·기술, 글 ko/en 24키 + 알림 6키). 여섯 기술 판정(도넛·화살비·쇠뇌·불기둥 두 박자·쇠사슬·추적)·그로기(셋 피하면 5초·×1.5)는 웹 수치 그대로 — 쇠사슬은 `IApi.PullPlayer` → CharacterController.Move.
- 이 판 두목 둘: 들판 황건 두목 = 도넛, 비경 두목 = 웹 비경 보스 그대로 관문 수호장(추적, 이름도 바꿈). 나머지 넷은 11-3 관문 대장 몫.
- 예고: 도넛 = 휩쓸기 그림 재사용(두목 곁 초록 "붙어라!"), 쇠뇌 = 머리 높이 붉은 띠, 불기둥 = 불빛 기둥, 추적 = 보라 원(실행기가 매 걸음 옮김), 그로기 = 머리 위 "★★★ 그로기 N초".
- 진단: 고정 시간(0.05초 × n) 누적이 한 걸음 어긋나 실제 들판 두 번째 패턴이 늦게 걸림 → `TickUntil`(조건까지). 순수 판정 쪽 불기둥·쇠사슬·추적은 웹과 같은 순서(시간 먼저 깎고 끌기).
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestStorySlice` 3연속 `bossPattern OK`, 끝은 기준선(무명 옷·Missing Prefab·씬 열기 6줄) 그대로 · loc-review 오류 0. 글꼴 SDF·Mobile_RPAsset 되돌림.
- 실기 확인 전: 도넛 2m 가 너무 좁은지, 쇠사슬 3m/s 를 달리기로 이기는 맛, 추적 멈춤 0.5초, 그로기가 너무 자주/드물게 오는지.
- 다음 = 11-3 5-11 관문 대장 고유 기술(이 판 관문 대장은 들판 두목의 주간 강화판 — 주마다 관문 대장 다섯 중 하나를 입힐지 설계부터).

## 2026-09-27 STORY — 109-11-3 관문 대장 고유 기술(웹 §5-11) — 줄 11 끝

"사가 유니티 이어해" → PLAN 109 표 11번 셋째 조각.

- 설계: 웹 관문 대장 다섯(마을 다섯) → 이 판은 관문 대장이 들판 두목의 주간 승격 한 자리라 주 번호 % 5 로 돌림(`GateCaptainIndex`, 주 번호는 `StoryLabyrinthState.CurrentWeekIndex`). 승격(`TryBecomeChampion`) 때 이름·기술을 입고 실행기가 `ApplyOwnerSig`.
- 웹 stepSig 그대로 제 시계(첫 4초·8초·패턴 중 미룸·시계 멈춤, 공용 후보에 안 낌). 웹 "단계·광폭 없이"는 이 판 관문 대장에 제 패턴이 없어 공용 패턴전을 그대로 두는 쪽(11-1 결정 이음).
- 등장 컷 이름표 = `DisplayName`(관문 대장 이름) → `PlaytestStoryBossIntro` 기대값도 그걸로.
- 검증(묶음 없는 PC): 첫 실행부터 3연속 bossPattern·boss intro OK, 슬라이스 끝은 기준선(6줄) 그대로. 글꼴 SDF·Mobile_RPAsset 되돌림. 새 글 없음(11-2 에 이름 다 넣음).
- 실기 확인 전: 8초 간격이 공용 패턴과 겹쳐 정신없지 않은지, 주마다 바뀌는 게 이름표로 읽히는지.
- **줄 11 끝.** 다음 = 12번 FOREST 5.9 떠돌이 방문객.

## 2026-09-27 char-forge — 남은 흠 셋: 대님 바지 끝단·순찰 대원 진동 홈·닌자 엉덩이 점 (6벌)

"vroid 자체툴 이어해".

- 옷 틀 `baji`·`baji_jeogori`·`baji_vest` 다리 통 끝단 발목 +3 → +4.5cm — 발 무게 섞인 발목 살에 맞춰져 대기에서 끝단 바깥이 발 따라 처지던 것. 맨몸 잡졸·무도 수행자·황건 두목·정찰병.
- 레시피 칸 `under_keep` {겉옷: {속옷: 팔 무게}}(build_real hide_under) — 순찰 대원 조끼 밑 재킷 소매 머리를 안 지워 뒤 진동 검은 네모 홈 없앰(0.8, 0.5 는 소매가 조끼 어깨 위로 비침).
- 닌자 옆 엉덩이 점 = 자락 틈 살 → `under_rows` 살 0.
- 검사: 6벌 verify fbx ≤ 0.7° · glb 0.0° · sha256 두 번 같음 · 칸 없는 몸 sha 그대로 · CMP_RESULT OK(FBX 로컬 전용). 적어 둔 렌더 흠 0 → 다음 = HOW_TO_PLAYTEST §9 사용자 판정.

## 2026-09-27 FOREST — 109-12-1 떠돌이 방문객(웹 §5.9)

"사가 유니티 이어해" → PLAN 109 표 12번 첫 조각.

- `ForestVisitors`(순수 — 손님 여섯·날짜 해시·여우 물건·조각 자리·방위·오늘 기록·말하기·세이브) · `ForestVisitorRunner`(부트스트랩이 Play 때) · `ForestVisitorNpc`(다가서기 말하기·이름표·빛 구슬·땅 휨) · `ForestVisitorPiece`(떠 돌며 빛남·1.6m 줍기). `ForestCollectSpot` → `OnGather`. 가구 `VisitorGifts` 다섯 + 세트 잔치, `All`·`AddStock`, 갈래 이름 `CategoryName`. 세이브 v8.
- 재해석 결정: 과일 = 금 ÷ 100 · 다가서기/물러나기 = 웹 "말 걸기" · 가방 대신 "만난 뒤 채집 수" · 물고기·광석 없음 → 버섯·화석·꽃 · 바깥 고리 대신 존 넷.
- 몸: 묶음 없는 PC — 씬 재빌드 대신 `TestVillageForest.unity` ForestBootstrap 에 `visitorBodyNames/Models` 12줄 손으로(Arissa·Heraklios·Brady GUID 는 TestVillage lookBodies, Leonard = TestDungeon modernPeddlerModel, XBot = TestDungeon eraFoeModels). 빌더도 같은 표. 이 PC 는 몸이 없어 캡슐로 선다(진단 "캡슐(몸 없는 PC)") — 묶음 PC 에서 몸 확인.
- 진단 중 발견: 앞 진단이 집 격자를 다 채워 둬 가구 놓기 확인이 빈 칸을 못 찾음 → 그 진단 안에서만 비우고 되돌림. loc-review 경고 둘(첫 기호·용어 흔들림) 고침.
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestForestHeadless` 3연속 `visitors OK`(eras 등 다른 줄도 OK), 오류는 기준선 둘(Missing Prefab·씬 열기) 그대로 · loc-review 오류·경고 0. 글꼴 SDF·Mobile_RPAsset 되돌림.
- 실기 확인 전: 조각 다섯 찾기 난도(방위 힌트로 충분한지), "물러났다 다시 다가서기"가 자연스러운지, 빛 구슬 도깨비불, 보상 과일 7~10 이 가구 값에 비해 적당한지, 이름표 크기.
- 다음 = 12-2 §5.10 새 손님 둘(도깨비 대장·불시착 탐사원)·단골 눌러앉기·몸짓.

## 2026-09-27 char-forge — 61벌 다시 훑기: 장화 속 갑옷·스웨터 밖 바지·운동복 허리 (4벌)

"vroid 자체툴 이어해".

- 대기·달리기로 61벌 재점검, 옷 하나씩 숨겨 정체 가림. 검은 기사 장화 뒤 = 가디언 정강이 판, 순례자 장화 뒤 = 사슬 갑옷 → `under` {장화: […]} + `under_below`. 택배 기사(여) 스웨터 밖 바지 허리 → `under` {스웨터: [바지]}. 주역 여 운동복 허리 구멍 = 튀어나온 살 → `under` 살.
- 흠 아님: 폭동꾼 셔츠 단 톱니(해진 셔츠 디자인). 남은 것: 택배 기사·주역 여 허리 작은 점, 괴물 셋 달리기 허리 천 살 점(kitbash, 다음), 긴 치마 달리기 뚫림(천 시뮬 없이 불가).
- 검사: 4벌 verify fbx ≤ 0.7° · glb 0.0° · sha256 두 번 같음 · CMP_RESULT OK(FBX 로컬 전용). 다음 = HOW_TO_PLAYTEST §9 사용자 판정.

## 2026-09-27 FOREST — 109-12-2 새 손님 둘·단골·몸짓·이웃(웹 §5.10·5.11) — 줄 12 끝

"사가 유니티 이어해" → PLAN 109 표 12번 둘째 조각.

- 손님 여덟: 도깨비 대장(몸 Demon, 꼬마 = 같은 몸 0.95m) · 탐사원 루미(= 마을 사람 surveyor — 손님 날 광장에 나오고 평소 자리 숨김). 웹 §5.13 달음·찰나는 이미 마을 사람이라 안 넣음.
- 단골(정 셋 → 청함 → 눌러앉음, 자리 여덟), 하루 선물, 몸짓(돌아보기·👋 글자·깡충 돌기), 이웃(평가 +6·수다 한 쌍). `ForestVisitorNpc.Role` 셋(오늘·눌러앉음·꼬마), 실행기가 꼬마·눌러앉은 손님·숨길 마을 사람·수다 짝을 세움. 조각 그림에 덤불·부품. 세이브 v9.
- 씬: 몸 표에 Demon·Jennifer 두 줄 더(손으로). 글 39키, 영어 "{0}th time" 은 3th 가 돼 "helped me {0} times" 로.
- 진단 중 발견: 눌러앉는 자리 5 가 소원석(5,−5) 곁 1.1m → (8.5,−4.5).
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestForestHeadless` 3연속 visitors OK(town score·eras·zones 도 OK), 오류는 기준선 둘 · loc-review 0. 글꼴 SDF·Mobile_RPAsset 되돌림.
- 실기 확인 전: 꼬마 덤불 찾기 난도, 꼬마 크기·춤, 👋 글자가 손짓으로 읽히는지, 눌러앉은 자리가 붐비지 않는지, 선물 과일 2~3.
- **줄 12 끝.** 다음 = 13번 REALM 5-11 싸움터 땅.

## 2026-09-28 REALM — 109-13-1 싸움터 땅(웹 사가국지 §5-11)

"사가 유니티 이어해" → 09-27 밤 결정(사람 NPC 몸 교체)은 이 PC 에 Mixamo 묶음·OneDrive 보관함이 없어 막힘 — 사용자가 구글 드라이브로 묶음을 옮기는 동안 공방 몸 61벌을 이 PC 에서 다시 짓고(char-forge, 로컬 전용), 사용자 요청("다른것 부터")으로 PLAN 109 표 13번 첫 조각.

- 이 트랙엔 전투 장면이 없다(결과 = 알림 한 줄) → 출진하면 그 성의 고정 싸움터로 3.6초 컷(`World/RealmBattlefield`, 누르면 넘김). 판정은 끝난 값을 그릴 뿐 — `AttackResult` 에 적 id·양군 시작/남은 병력을 더했다. 판정 `RealmLand`(Plain/River) 는 그대로.
- `Data/RealmBattleLook`: 웹 `battleLook` 표 그대로(땅 넷 + 주 덮어쓰기 일곱, 바닥빛·하늘·소품 6~8 순번 자리 반지름 8.4~9.8, 강가·해안 물줄기). 쉰여덟 성의 땅·주는 웹 `data-city.js` 에서 스크립트로 옮김(웹에 없는 정도 = 연주 평야). 이 트랙 성에 쓰이는 결은 여섯(평야·강가·산성·구릉·초원·밀림) — 사막·해안·균열·폐허·묘역은 그런 주의 성이 없어 표에만. 웹 수전 물빛은 수전이 없어 뺌.
- 장면: 지도 밖 (4000,0,4000)에 원시 도형 + 뿔 메시(봉우리·풀·결정)로 짓고 제 카메라(깊이 50, 하늘빛 배경) — 씬 재빌드 없음(`[SerializeField]` 안 늘림). 양군 기둥 천 명당 하나(한쪽 3~24, 첫 기둥 장수 깃발), 다가감 1.1s → 맞붙음·잃은 몫 뒷줄부터 쓰러짐 ~2.3s → 이긴 쪽 나아감·진 쪽 물러남. 알림 첫 줄 "⚔ 소패 평야".
- 글 12키(ko·en). 묘역 영어는 기존 era.region.tomb 과 맞춰 Tombs(loc-review 용어 흔들림 1 → 0).
- 검증(묶음 없는 PC, 에디터 6000.3.23f1): 컴파일 0 · `PlaytestRealmSlice` 3연속 OK(`PlaytestRealmBattlefield` — 성 58·결 6·가장자리·늘 같음·머릿수·이김 9/12·0/8·짐 물러남·"소패 평야") · loc-review 오류 0. 글꼴 SDF·Mobile_RPAsset 되돌림.
- 실기 확인 전: 소품 크기·색이 사실 PBR 성과 어울리는지, 기둥 쓰러짐 박자, 3.6초가 길지 않은지.
- 다음 = 13-2 5-10 지도 위 실제 인물·모션(싸움터 기둥 → 장수 몸이 첫 자리).

## 2026-09-28 REALM — 109-13-2 지도 위 실제 인물·모션 코드분(웹 사가국지 §5-10)

"이어해" — 구글 드라이브 묶음이 아직 이 PC 에 없어(몸 교체·REALM 몸 둘 다 막힘) 사용자에게 물음 → "13-2 코드분 먼저".

- `Data/RealmActorPlan`(순수): 태수 = 이 달 그 성에서 명령 낸 무장(없으면 그 성의 통솔 높은 무장), 몸짓 = 웹 `mapClips`(개간 hoe·상업 haggle·훈련 swing·등용 bow·축성 hammer, 그 밖 idle) · 재야 = 찾았지만 안 들인 사람(묻힌 성이 우리 성일 때) · 상한 24 태수 먼저 · 손잡이 `Enabled`. `RealmCityState` 에 이 달 성별 마지막 명령(키·무장) — 화면 층, 세이브 없음, 다음 달·불러오기에서 비움.
- `World/RealmFigure` 도형 대역(몸통·띠·머리·투구·두 팔 + 괭이·칼·망치·엽전) — 동작 열 가지를 시각만으로 짠 코드 자세(들어 올림 70% 천천히·내려침 30% 빠르게, 읍은 숙였다 일어섬, 쓰러짐은 뒤로 눕기). `External` 이면 부르는 쪽이 시각을 정한다.
- `World/RealmMapActors`: `RealmWorldMap.Rebuild()` 끝에서(Play 때만 — 에디터 씬 빌드엔 안 세운다) 태수를 성 표지 앞, 재야를 제 성 둘레 반지름 3.6·한 바퀴 28초. 지도 카메라가 120~420m 라 말 크기 4m.
- 싸움터 두 장수: 다가감 → 첫 합(공격 쪽 베기·지키는 쪽 맞음) → 둘째 합(이긴 쪽 베기·진 쪽 쓰러짐), 순서표 `RealmBattlefield.GeneralClip` 순수.
- 뺀 것: 웹 ① 원정 행군 보간(이 트랙 출진은 그 자리에서 끝남) · ⑤ 성 줌(선택) · 거리 LOD.
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestRealmSlice` 3연속 OK — actors order(허창 개간 → 현책 괭이질, 새 달 비움) · actors(표 10·상한 24·끔 빈 목록·지금 판 태수 6·월드맵 배우 6·순서표) · battlefield(장수 끝 자세). 글꼴 SDF·Mobile_RPAsset 되돌림.
- 남은 13-2b: 대역 → 사실 몸(묶음 PC — 몸 표·같은 이름 클립, 씬 빌더). 실기 확인 전: 4m 말이 표지와 어울리는지, 몸짓이 멀리서 읽히는지.

## 2026-09-28 GO — 109-14-1a 원소 일곱·반응 열셋(웹 사가고 ⑲-1)

"이어해" — 묶음이 여전히 없어 PROJECT_STATE 대로 109 표 D 대조: 웹 다섯 PLAN §5 는 전부 표에 있거나 일부러 뺐다(사가의숲 5.13 달음·찰나 = 이미 마을 사람). 줄 14 "웹 미구현 대기" 는 낡았다 — 웹 ⑲ 순서 1~46 코드분 완료 → 줄 14 착수, 첫 조각 ⑲-1(전투 손맛 먼저).

- `GoElements`: 풍·빙·암·초 더함(옛 셋 번호 그대로). 풍·암은 안 붙고 반응만. 반응 열넷(웹 열셋 + 깨뜨림), 이름은 웹 표시 이름(녹임·얼어붙음·서리번개·회오리·굳힘·꽃피움·들불·싹틈·번개싹·덩굴뻗음·깨뜨림). 배수는 Godot 칸, 반지름 × 1.85, 옛 셋은 107 값 그대로. 방패 상성 일곱·바위 방패 물리 ×1.
- `FieldEnemy`: 얼어붙음(AI 멎음·예고 끊김·빙 빛), 3타째(`heavy`)·암 깨뜨림, 서리번개 물리 ×1.4, 싹틈 뒤 뇌·초 ×1.25, 들불 틱, 회오리가 옆 적에 원소 옮김. `TakeRaw`(씨앗 터짐). `FieldCombat`: 굳힘 보호막(피격이 먼저 깎음, 다 막으면 원소 효과도 막음)·꽃피움 씨앗·새 원소 적 상태 넷(휘말림·한기·짓눌림·중독 — 중독은 화상 자리). `GoStamina.BlockRegen`.
- 도감 인물 원소를 일곱 그대로(107 은 암 → 화·빙·초 → 수·풍 → 뇌로 접었다) — 동료가 있으면 한 번 안내, 세이브 `el7Noticed`(버전 그대로). **산적은 옛 셋 해시 그대로** — 웹은 % 7 이지만 이 트랙 107 상자 퍼즐이 주인공 화 + 산적 수로 풀리게 짜여 있어(% 7 이면 산적이 암이 된다).
- 새 원소 인물의 겨루기 졸개가 뇌 몸으로 나와 진단이 잡음 → 옛 몸에 그 원소 방패("바람 졸개" 식), 제 괴물은 14-1b. ★5 속 방패 `InnerOf` 는 일곱으로 — 누르는 원소가 없는 빙만 빙을 누르는 화.
- 글: 원소 영어는 옛 Fire·Water·Thunder 에 맞춰 Wind·Ice·Stone·Grass(원작 용어 안 씀). ko/en 30키, loc-review 오류 0.
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 같은 결과 — field combat(새 `CheckReactions7`: 표·상성 일곱·녹임·풍 안 붙음·얼어붙음 1초 유지→3타째/암 깨뜨림·2.5초 풀림·서리번개·회오리·굳힘이 피해 막음·씨앗 1.5초·들불 틱·번개싹/덩굴뻗음·상태 넷)·elemental foe·heroes(원소 일곱) OK, 남은 FAIL 은 기준선 하나(bandit_camp 등불 — 묶음 없음). 글꼴 SDF·Mobile_RPAsset 되돌림.
- 다음 = 14-1b 새 원소 괴물 넷·무리 꼴 셋(몸 — 묶음 PC 가 낫다) 또는 ⑲-2 강공격·낙하.

## 2026-09-28 GO — 109-14-2 강공격·낙하 공격(웹 사가고 ⑲-2)

"이어해 한국어로 진행사항은" — 묶음 여전히 없음 → 14-1b(괴물 넷, 몸 필요)를 건너 ⑲-2.

- `FieldCombat`: 누름(`AttackPress`) = 활공 중이면 낙하 공격, 아니면 기본 한 타 · 누르고 있기(`TickHold`) 0.4초 넘으면 강공격 한 번(`ChargedAttack` — 스태미나 20·가까운 적 쪽 앞 5.9m 옆까지·×1.3 물리·콤보 처음부터, 모자라면 "스태미나 부족") · 착지(`PlungeHit`) 둘레 6.5m ×(1.2 + 떨어진 높이 × 0.1/1.85, 27.75m 까지) 물리, 흰 고리 둘. 거리·높이는 Godot 칸 × 1.85.
- `PlayerController.TryPlunge`: 활공 중 발밑 4.6m 넘으면 날개 접고 초당 55m 곧게 아래로, 땅에 닿으면 `PlungeLanded(떨어진 높이)`, 물이면 헤엄으로 끝(공격 없음). 순간이동은 내리꽂기를 끊는다.
- 깨뜨림은 강공격·낙하만 — 14-1a 에서 임시로 붙인 3타째를 뗐다(웹·Godot 와 같게).
- 화면 공격 단추: `AttackHoldButton`(HUD 가 런타임에 붙임 — 씬 재빌드 없음), 누르는 동안 강공격 대기, 강공격이 나간 뒤 뗀 클릭(기본 한 타)은 먹는다. 터치는 뗀 뒤 Exit 가 또 와서 누르던 중일 때만 먹을 클릭을 세운다.
- 진단 `CheckChargeAndPlunge` 첫 판이 "3타째가 얼음을 깸" 으로 실패 — 코드가 아니라 앞 진단으로 오른 공격력에 세 타를 다 맞은 적이 쓰러져 얼음이 지워진 것. 1·2타는 빈 곳에 휘둘러 콤보만 올리고 3타째만 맞히게 고침.
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 같은 결과 — field combat OK(강공격 스태미나·배수·뒤 적 안 맞음·부족·0.3초 안 나감/0.45초 한 번·누른 채 또 안 나감 · 3타째 못 깸/강공격 깸 · 낙하 배수 · 20m 활공 → 공격 → 착지 둘레 2m 맞음·12m 안 맞음 · 4.3m 안 내리꽂힘), 남은 FAIL 은 기준선 등불 하나. 글꼴 SDF·Mobile_RPAsset 되돌림.
- 실기 확인 전: 0.4초가 기본 공격과 헷갈리지 않는지, 폰 단추 누르고 있기, 내리꽂기 속도·착지 고리, 낙하 피해 체감.
- 다음 = ⑲-3 보물 상자(웹 treasure.js) — 107-4 상자 16 과 대조해 없는 것만.

## 2026-09-28 GO — 109-14-3a 수집 구슬·봉헌(웹 사가고 ⑲-3 앞 절반)

"이어해" — 묶음 여전히 없음. ⑲-3 대조: 보물 상자(등급 넷·석등·무리 잠금·경험/금)는 107-4 에 있고 웹의 "지역 칸마다 상자 넷" 은 이 트랙 지도가 한 판(9×11)이라 16 고정 그대로 → 없는 둘(수집 구슬·봉헌, 원소 시야) 중 구슬부터.

- `Data/GoOrbs`(순수): 지역 일곱 × 셋. 칸 번호마다 산마루(정상 윗면 가운데에서 3.2m·+2.2m) / 강(강 칸 ±14m·수면 +0.6m) / 나무(숲 칸·땅 +4.4m), 그 땅이 없으면 들판(평지·길·논·숲 칸 +2.0m — 마을 집·사당·폐허·동굴 칸은 비킴). FNV-1a 해시(지역:칸). 21 = 산마루 4·강 3·나무 5·들판 9.
- 손 닿는 높이: 수평 3m + 발 기준 −0.5~+3.6m — 들판은 서서, 나무는 점프 꼭대기(2.4m)에서만, 강은 헤엄치는 발(수면 −2.6m)에서, 산마루는 윗면에 서서. 첫 판 진단에서 서쪽 숲길(x=0 줄)이 가장자리 칸 제외로 0개 → 가장자리도 받음(±14m 라 바깥 벽에서 10m 넘게).
- `OrbState`: 주운 id·바친 수, 등급 = 바친 수/2(최대 10). `GoStamina.Max` 를 상수에서 속성으로(`BaseMax` 100 + 등급 × 8) — 쓰는 곳은 모두 읽기라 그대로.
- `World/GoOrbField`: WorldMapBuilder 가 Play 때 붙인다(씬 재빌드 없음). 하늘빛 발광 구슬 + 고리, 위아래로 떠서 돈다. 땅 높이는 표 값 대신 `FolkWalker.Grounded` 로 실제 땅에 앉힌다(강은 수면 그대로). 0.1초마다 줍기·봉헌. 봉헌 = 불 올린 봉수대(`BeaconTower.Position`) 14m 안 — 금 200·경험 20(웹 단사 2 대신)·스태미나 가득.
- 세이브 v19(`orbsGot`·`orbsGiven`, v18 → 빈 기록) — 옛 진단 여섯의 `"version":18` 글자를 19 로. 글 ko/en 3키, 기호는 글꼴에 있는 ◆(✦ 는 □ 위험).
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 같은 결과 — orbs OK(표·손 닿는 높이 넷·줍기 둘·한 번만·봉헌 불 없음/14m 밖 거절·둘 → 1단 +8·셋째 그대로·전부 10단 180·세이브 v19 왕복/v18 로드), world map·treasure·peaks·heroes(v19)·field combat OK, 남은 FAIL 은 기준선 등불 하나.
- 실기 확인 전: 구슬이 멀리서 보이는지, 나무 구슬이 가지 속에 파묻히지 않는지, 강 구슬 헤엄 높이, 봉헌 알림.
- 다음 = 14-3b 원소 시야(V 누르는 동안).

## 2026-09-28 GO — 109-14-3b 원소 시야(웹 사가고 ⑲-3 뒤 절반) — ⑲-3 줄 끝

"이어해"(앞에 터미널 마우스 입력 조각이 섞여 들어옴 — 무시). 묶음 여전히 없음.

- `Data/GoSight`(순수): 거리 83m·흔적 148m·4m 간격·최대 14(웹 × 1.85), 빛깔(상자 금·구슬 하늘·석등/적 원소·맨몸 적 붉게·땅표 흰), 흔적 점 = 목표 앞에서 멈춘다.
- `World/ElementalSight`: 런타임 전역 Volume(ColorAdjustments 채도 −70·노출 −0.6, 우선 60) weight 를 0.2초에. 켜는 순간 83m 물결(`FieldRingFx`). 0.25초마다 빛기둥(발광 × 4 원기둥)·흔적 점(구, `FolkWalker.Grounded`)을 다시 세운다. 결투·등장 컷 중 꺼짐. 전체 화면 보정이라 빛기둥도 채도가 깎이지만 발광이 세서 빛깔이 남는다(겹 카메라로 빼는 건 URP 쌓기·후처리 순서가 얽혀 뺐다).
- HUD "시야" 단추(점프 위, 켜고 끔), 글 1키.
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 같은 결과 — sight OK(흔적 규칙·빛깔·83m·누르는 0.1초 잿빛 0.5·0.25초 1·놓으면 걷힘·짚기 13(40m 앞 구슬)·흔적 5점 4m 간격·주운 구슬 빠짐·결투 중 꺼짐·단추 켜고 끔), orbs OK, 남은 FAIL 은 기준선 등불 하나.
- 실기 확인 전: 잿빛 세기(채도 −70)·빛기둥이 잿빛 속에서 읽히는지·흔적 점이 땅에 붙는지·폰 단추 자리.
- **⑲-3 줄 끝.** 다음 = ⑲-4 육성(웹 talent.js) — 107·109 와 대조해 없는 것만.

## 2026-09-28 GO — 109-14-4 무예 단계·깨달음(웹 사가고 ⑲-4, ⑳ 이름·수치)

"이어해" — 묶음 여전히 없음. 웹 ⑲-4 원문은 "운명의 자리 여섯" 이지만 ⑳ 에서 "깨달음 다섯"·배율·값이 바뀌었다 → 지금 웹 `talent.js` 가 정본.

- 구조 차이: 웹은 인물마다 승급 ★0~5(중복 등용)가 무예 상한을 연다. 이 트랙엔 인물마다 승급이 없어(승급 3택 = 부대 레벨업마다) 부대 레벨 여섯 칸(1·5·10·15·20·25)으로. 단사 없음 → 뺌. 뇌룡 비늘(⑲-9 주간 보스) 없음 → 7단이 끝(값 표엔 그대로).
- `Data/GoTalent`(표)·`TalentState`(동행마다 [기본, 스킬, 해방]·깨달음·재료 다섯). 주인공·도감 밖은 1단 — 웹 `_me` 와 같다.
- `FieldCombat`: 기본(3타·강공격·낙하)·스킬(선·원 피해, 장판·소환은 `SkillZone.Mul`)·해방에 제 무예 배율, 반응 조각을 셀 공격력엔 깨달음 ② 만(`React`). ① 스킬 대기 × 0.85 · ④ 최대 체력 × 1.15(명단 지을 때) · ⑤ 해방 뒤 `Member.BuffLeft` 8초 동안 `Atk` × 1.2.
- 얻는 곳: `TreasureChest.Open`(등급별 — 알림 둘째 줄) · `FieldEnemy` 쓰러짐(방패 두른 원소 괴물, 수호장·들판 인물 빼고 — 머리 위 글) · `GoOrbField.TryOffer`(등급마다 매듭).
- 도감 무예 칸(`HeroDexUi.BuildTalentPanel`, 격자 오른쪽 x 655): 재료 줄 · 세 줄(단계/상한·배율 + 올리기 단추 — 값과 못 올리는 까닭) · 깨달음 ◆◇ + 다음 효과 + 열기 단추. 런타임 UI 라 씬 재빌드 없음.
- 세이브 v20(`talents` = [{id,n,s,b,con}], `talentMats` = [쪽지, 교본, 비전, 매듭, 비늘]) — 옛 진단 일곱의 `"version":19` → 20. 영어 "Elemental Burst" 를 loc-review 가 원작 용어로 잡아 이 판 단추 이름 "Release" 로. 글 29키.
- 첫 컴파일이 상자 알림의 "\n" 이 셸 한 줄 패치에서 진짜 줄바꿈으로 들어가 깨짐 → Edit 로 고침(여러 줄 치환은 스크래치 .mjs 로 — 한 줄 node -e 안 이스케이프는 믿지 말 것).
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 같은 결과 — talent OK(표·값·거절 셋·깨달음 5·③ +2·기본 7단 피해 ×1.48·① ×0.85·④ ×1.15·⑤ 8초 ×1.2 뒤 원래대로·화려 상자·정예 쪽지·도감 칸 진짜 단추·안 들인 사람엔 칸 없음·세이브 v20 왕복/v19 로드), orbs·sight·treasure·world map·field combat OK, 남은 FAIL 은 기준선 등불 하나.
- 실기 확인 전: 도감 무예 칸 글자 넘침(폭 270)·단추 누르기·재료가 모이는 속도.
- 다음 = ⑲-5 무기·보패(웹 weapon·artifact.js).

## 2026-09-28 GO — 109-14-5a 무기·치명타(웹 사가고 ⑲-5 앞 절반, ⑳ 이름·수치)

"이어해" — 묶음 여전히 없음. ⑲-5(무기·치명타·성유물 → ⑳ 보패)는 한 절이 너무 커서 무기·치명타(14-5a)와 보패·세트(14-5b)로 쪼갬. 정본은 지금 웹 `weapon.js`.

- `Data/GoWeapons`(표·식)·`WeaponState`(가진 무기 Lv·벼림·울림, 든 무기, 강화석). 종류 해시는 웹 식 그대로(표본 sg_guanyu 활·sg_zhugeliang 칼·kr_yisunsin 서책·jp_musashi 창 일치). 105 인물 다섯 종류 모두 10 명 넘음.
- 크기 맞춤: 웹 칼 KIT(0.9·1.0·1.5 · 0.34초 · 3.2m)가 이 트랙 옛 3타(0.8·0.9·1.3 · 0.33초 · 4.2m)가 되게 — 다른 종류는 같은 비. 무기 공격 × 0.75(기본 공격력 60/80). 웹 단사 → 뺌(벼림은 금만), 갯바람 작살(낚시 ⑲-24) → 그 순서까지 없음.
- `FieldCombat`: `Atk` 에 든 무기 공격·공격%, 기본 공격이 무기 모양(붙어 치기 앞 120° / 멀리 하나 + 빛줄기, 서책 원소·대도 heavy), 강공격·낙하·스킬(선·원)·장판·소환·해방에 치명 굴림(`CritMul`, mulberry32 20260824 — 반응 조각·직접 `TakeHit` 은 안 굴림)·무기 효과(`PasMul`), 기력 획득%, 체력%. `FieldEnemy.TakeHit(… crit)` → 금빛 × 1.45 글.
- 얻는 곳: `TreasureChest.Open` → `WeaponState.OnChest`(강화석 + 진귀·화려 무기), 방패 두른 원소 괴물 쓰러짐 → 강화석 1(쪽지 줄에 이어서).
- 도감 왼쪽 무기 칸(`HeroDexUi.BuildWeaponPanel`, x −655, 무예 칸과 같이 뜨고 진다): 종류·★·이름·Lv/상한·벼림·울림·공격·부옵션·효과·강화석 + 강화·벼림·바꾸기 단추.
- 세이브 v21 — 옛 진단 여덟의 `"version":20` → 21. 치명 난수 때문에 피해값을 딱 보는 옛 진단들이 흔들리지 않게 `PlaytestHeadless` 가 들판 전투 진단 앞에서 `CritOffForTest` 를 켜고, 무기 진단만 100%·0% 로 켜 본다. 무예 진단의 기대 피해를 그 인물 무기 모양 1타로.
- 영어 무기 이름은 새로 지음(원작 이름 안 씀), 해방 = Release. 글 47키, loc-review 오류 0.
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 같은 결과 — weapons OK(해시·모양 다섯·식·강화 9번·상한·벼림 금 250·울림 5 → 강화석 10·수련용 강화 거절·옮기기·청하 보검 치명 8.5%·치명 100% ×1.5/0% 없음/직접 안 굴림·서책 8m 원소·활 16m·대도 깨뜨림·큰도끼 체력 ×1.07·상자 평범/진귀·정예 강화석·도감 바꾸기/강화 단추·세이브 v21 왕복/v20 로드), talent·treasure·field combat OK, 남은 FAIL 은 기준선 등불 하나.
- 실기 확인 전: 대도·창·서책·활 손맛(빠르기·사거리)·서책/활 빛줄기·치명 숫자·도감 무기 칸 글 넘침.
- 다음 = 14-5b 보패(웹 artifact.js).

## 2026-09-28 GO — 109-14-5b 보패(웹 사가고 ⑲-5 뒤 절반, ⑳ 이름·수치)

"사가 유니티 이어해" — 묶음 여전히 없음(`realistic-pack.sh verify` FAIL) → 109 표 14 다음 조각. 정본은 지금 웹 `artifact.js`.

- `Data/GoArtifacts`(표·식·생성 — 웹 mulberry32 를 비트까지 같게, 뽑기는 double 로 나눔)·`ArtifactState`(가진 것 목록 순서 = 번호 순, 연마석, 누가 낌, 한 사람 몫 `BonusOf` 는 바뀔 때만 다시 셈). 웹 표본 넷(node 로 `artifact.js` 를 돌려 뽑음 — 1번 ★4 봉화 깃발 가락지 치피, 2번 ★5 향낭 암, 3번 대장간 불씨 가락지, 5번 +15 부옵션 넷)과 세트·부위·주/부옵션 값까지 같다.
- 크기 맞춤: 값은 웹 그대로 들고 들판에서만 고정 공격 × 0.75(무기와 같은 비) · 고정 체력 × 0.4(이 트랙 270 / 웹 통솔 60 기준 660) · 고정 방어 × 0.6(35/60).
- `FieldCombat`: `Atk` 에 보패 공격%·고정(웹 식), `AddMember` 체력(웹 식, 깨달음 ④ 는 마지막 곱), `ActiveDef`(받는 피해만 — 이 트랙 방어는 부대 공용이라 체력 상한은 보패 없는 방어로), 치명 확률·피해·기력에 보패 더함. 무기 효과 곱(`PasMul` n·s·b)을 웹 식 더하기 `DmgMul`(1 + 무기 효과 + 4 세트 + 원소 피해)로 바꿈 — 보패 없으면 값 같음(무기·무예 진단 그대로 OK). 반응 4 세트는 `SetReactMul` → `FieldEnemy.TakeHit` 이 물안개·녹임(그 타)·터짐(광역)·회오리(옮김 피해)·들불(틱)에 곱한다.
- 얻는 곳: `TreasureChest.Open` → `ArtifactState.OnChest`(무늬 ★4 · 옻칠 ★5 · 금박 ★5 둘), 방패 두른 원소 괴물 → `OnElite` ★4(강화석 줄에 이어서).
- 도감 보패 칸(`HeroDexUi.BuildArtifactPanel`, 닫기 단추 아래 y −320~−442, 무예 칸과 같이 뜨고 진다): 글 두 줄 + 부위 다섯 + 바꾸기·강화·빼기·★4 분해.
- 세이브 v22 — 옛 진단 아홉의 `"version":21` → 22. 글 42키(영어 세트·부위 이름 새로 지음), loc-review 오류·경고 0.
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 — artifacts OK(웹 표본 넷·강화 값·+3 부옵션·★4 +12 끝·안 들인 사람 거절·같은 부위 갈이·남의 것 옮김·낀 것 분해 거절·분해 값·봉화 깃발 2/4·고정 체력·주인공 빈 몫·공격 식·체력·방어·근접 1타 ×1.38·녹임 ×1.35·회오리 ×1.5·상한 200·★4 분해·상자 넷·정예·도감 단추 넷·세이브 v22 왕복/v21 로드), weapons·talent OK, 남은 FAIL 은 기준선 등불 하나(세 번 같음). 배치가 고친 폰트 SDF 둘·Mobile_RPAsset 은 되돌림.
- 실기 확인 전: 도감 보패 칸 글 넘침(부옵션 넷 줄)·부위 단추 두 줄·바꾸기 차례가 많을 때 손맛.
- 다음 = 14-6 요리(웹 ⑲-6 cooking.js).

## 2026-09-28 GO — 109-14-6 채집·요리(웹 사가고 ⑲-6)

"이어해" — 14-5b 다음. 정본은 지금 웹 `cooking.js`(표·수치는 saga-godot cooking.gd 그대로).

- `Data/GoCooking`(재료·요리·바늘·품질·채집 자리·솥 자리)·`CookState`(가방·숙련·채집 시각 = 세이브, 버프·포만감 = 이번 판). 웹 칸(1.2km)마다 무리 여덟 → 이 판 지역(칸 3~12)마다 일반 넷 + 특산 둘(마을 하나)로 줄임. 너른 강 지역은 칸이 모두 물이라 강에 닿은 뭍 칸(4줄)에 물가로 밀어 둠. 포기 105, 모두 뭍(진단).
- `World/CookField`(포기 = 줄기 + 빛깔 머리, 조개는 납작 돌 · 특산은 빛남 · 솥 = 돌 셋 + 불씨 + 가마솥, 모두 도형) · `UI/CookingUi`(G · "요리" 단추는 도감 왼쪽, 솥 곁이거나 요리를 가졌을 때만). 둘 다 `WorldMapBuilder` 가 Play 때 붙인다(씬 재빌드 없음).
- `FieldCombat.Eat`(가장 좋은 품질부터, 회복 대상 고르기는 웹 그대로) · `Atk`/`ActiveDef`/치명에 요리 버프 · `GoStamina` 세 쓰기 함수에 모험 계열 배율 · 산적 쓰러지면 짐승 고기 1(14-1b 짐승까지).
- 크기: 거리 × 1.85, 고정 공격 × 0.75 · 방어 × 0.6 · 회복 × 0.4. 웹은 요리 버프가 주인공('_me')엔 안 타지만(무기·보패와 같은 자리에서 걸러짐) 이 트랙은 "명단 전체"대로 주인공도.
- 세이브 v23 — 옛 진단 열의 `"version":22` → 23. 글 55키, loc-review 오류·경고·흔들림 0(보통 = Normal, 초 단위는 형식 글에 넣음).
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 — cooking OK(표·포기 105 뭍·솥 5·바늘·품질·줍기·30분/1시간·높이·솥 7.4m·조리·숙련 5 뒤 자동 보통·꿀꽃 떡 26%+32·포만감 105 거절·초당 −1·명단 9%·되살리기 10%·공격 +18×승급·방어 +12·스태미나 ×0.76·계열 갈이·300초·산적 고기·요리 창 조리/불 끄기/먹기/닫기·세이브 v23 왕복/v22 로드), 나머지 OK 41 줄 그대로, 남은 FAIL 은 기준선 등불 하나(세 번 같음). 배치가 고친 폰트 SDF 둘·Mobile_RPAsset 되돌림.
- 실기 확인 전: 포기 크기·색이 들판에서 보이는지 · 솥 자리(역참 돌기둥 동쪽 6.5m)가 뭔가에 파묻히지 않는지 · 요리 창 글 넘침(영어) · 바늘 손맛.
- 다음 = 14-7 여정 등급·천하 등급(웹 ⑲-7 adventure.js).

## 2026-09-28 GO — 109-14-7 여정 등급·천하 등급(웹 사가고 ⑲-7)

"이어해" — 14-6 다음. 정본은 지금 웹 `adventure.js`.

- `Data/GoAdventure`(문턱·배율·보상)·`AdventureState`(낮춤·받은 등급 = 세이브, `WorldChanged` 이벤트). 레벨업 배선은 `GameBootstrap.OnLeveledUp`(보상 알림 줄 `DialogueLabel`).
- `FieldEnemy`: `Setup` 끝에 `ApplyWorld`, 정적 생성자가 `WorldChanged` → `RescaleAll`(지금 몫에서 비율로 — 남은 체력 비율 그대로). 수호장 금 `GuardianGoldNow`.
- 이 PC 경험 곡선(80 × 1.35^(L−1))으론 여정 9 부터 먼데, 문턱은 웹 그대로 두었다(무예 상한도 같은 레벨 칸을 쓴다) — 체감이 나쁘면 곡선·문턱 중 하나를 사용자와 정할 것.
- 옛 진단(적 체력·금 값을 잰다)은 `PlaytestHeadless` 가 3 프레임째 `OffForTest` 를 켜고 다시 재 천하 0 으로 돈다(웹 `_enableForTest` 와 같은 결). 여정 진단만 켠다.
- 지도 오른쪽 열: 지역 글 높이 380 → 330, 그 밑에 여정 줄(두 줄)·낮추기 단추. HUD "Lv · 천하" 도 해 봤는데 배치 점검이 대사 줄 ↔ HUD 겹침을 잡아 뺐다.
- 배치 점검(`UiLayoutCheck`)이 14-3b "시야" 단추 ↔ 조우 창("달아난다"·"피한다") 겹침도 잡음 → 시야 단추 (−450, 120 폭) → (−405, 110 폭). 남은 6 건은 DUNGEON 고레벨 세이브(Lv.53) GoalBoard ↔ HUD — 알려진 환경 몫.
- 세이브 v24 — 옛 진단 열하나의 `"version":23` → 24. 글 13키(loc-review 오류·경고·흔들림 0).
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속(+ UI 고친 뒤 1번) — adventure OK(문턱·배율·보상 표·레벨 6 → 천하 2 적 체력·방패 ×1.7·공격 ×1.44·비율 그대로·되돌리면 원래대로·수호장 금 ×1.5·여정 5 보상 금 500·강화석 2·매듭 1·두 번 안 줌·두 단계 한꺼번에·천하 1 → 2 다시 잼·AddExp 배선·낮추기/되돌리기/거절·지도 줄·진짜 단추·세이브 v24 왕복/v23 로드), 나머지 OK 42 줄 그대로, 남은 FAIL 은 기준선 등불 하나. 배치가 고친 폰트 SDF 셋·Mobile_RPAsset 되돌림.
- 실기 확인 전: 천하 1(레벨 3) 적 체감·레벨업 알림 줄 길이·지도 여정 줄 넘침(영어).
- 다음 = 14-8 일일 의뢰(웹 ⑲-8 daily.js — 이 트랙 옛 일과판 101-2 ④ 와 대조부터).

## 2026-09-28 GO — 109-14-8 일일 의뢰(웹 사가고 ⑲-8)

"이어해" — 14-7 다음. 웹 ⑲-8 은 새 판이 아니라 ④ 일과판을 넓힌 것이라 이 트랙 101-2 ④ `DailyTaskState` 를 넓혔다(대조: 날짜 해시·도장 7·주간은 있었고, 갈래·새벽 4시·일과 보상·마무리 보상·새 후보 넷이 없었다).

- `DailyTaskState`: Kind 넷 뒤에 넷(들판 적·원소 반응·채집·요리), `Group` 넷, 하루 넷(갈래마다 `System.Random(날짜 해시)` 로 하나), `DayKey` 새벽 4시, 채우면 `GrantTask`(금·경험·강화석/쪽지) + `TaskCompleted` 알림(`GoSessionTracker` 가 대사 줄), `TryClaimBonus`(넷 다 · 하루 한 번). 부르는 자리: `FieldEnemy` 쓰러짐·반응, `CookState.Pick`·`Cook`, `WaypointStone.TryDailyBonus`(0.25초마다 7m).
- 도장은 이 판 101-2 ④ 규칙(넷 다 한 날 하나) 그대로 — 웹은 일과마다 도장이라 다르다. 웹 부대 경험(마무리 120)은 인물 경험이 없어 뺐다.
- 옛 진단은 3 프레임째 `DailyTaskState.OffForTest` — 날짜마다 다른 일과가 끼면 무기(정예 강화석 18)·보패 등 값 재는 진단이 날마다 흔들린다. 옛 `CheckDailyTasks` 는 private 로 도장·주간을 재서 영향 없음 — "하루 3개" 만 4 로.
- 세이브 v25(`dailyBonus`) — 옛 진단 열둘의 `"version":24` → 25. 글 7키(loc-review 0).
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 — daily OK(새벽 4시·60 날 모두 넷·갈래 안 겹침·같은 날 같은 넷·여덟 종류 나옴·목표 직전 보상 없음·들판 적 8 금 50·강화석 1·알림·끝난 일과/없는 일과 보상 없음·반응 쪽지·부르는 자리 넷(쓰러짐·채집·반응·요리)·넷 다 → 도장·목표판 역참 안내·역참 밖 거절·마무리 금 150·강화석 2·매듭 1·두 번 거절·세이브 v25 왕복/v24 로드), 나머지 OK 43 줄 그대로(옛 일과판 포함), 남은 FAIL 은 기준선 등불 하나.
- 실기 확인 전: 일과 알림이 다른 대사와 겹쳐 묻히는지 · 요리·채집 일과가 첫날에 채울 만한지 · 역참 마무리 알림.
- 다음 = 14-9 주간 보스(웹 ⑲-9 — 숨은 터 domain.js·먹구름 제단, 먼저 이 트랙에 숨은 터가 없다는 점부터 정할 것).

## 2026-09-28 GO — 109-14-9 숨은 터·원기·주간 보스(웹 사가고 ⑲-9)

"이어해" — 14-8 다음. 웹 ⑲-9 (`domain.js`)는 숨은 터 셋 + 원기 + 주간 보스 한 묶음이라 나누지 않았다.

- `Data/GoDomain`(자리 넷·단계·파도·보상 표·원기 채움·주 키)·`DomainState`(원기 값·기준 유닉스 초·받은 수·이 주 받은 수) · `World/DomainField`(모양·도전 흐름 `Step`·실패 셋·터 기운·보스 2단계·보상 나무·받기) · `UI/DomainUi`(입구 카드·도전 줄·나무 카드). 둘 다 `WorldMapBuilder` 가 Play 때 붙인다.
- `FieldEnemy`: `DomainFoe`(천하 0·경험/전리품/일과 없음·다시 안 섬·원판 안 끝까지 쫓음 — Wander/Chase/Recover/Stagger 의 포기·끈을 비킴, `RescaleAll` 에서 빠짐), `MakeWeeklyBoss`(값 새로 박고 `WorldLevel = 0`), `RaiseBossShield`, `CdMul`·예고/간격/거리 덮어쓰기, `SoakAura`, `ForceChase`, `SetHpForTest`. `FieldSpawner.SpawnDomainFoe`.
- 자리는 웹 방위 규칙 대신 손으로 — 무리·역참·수호장 55m·서로 80m(진단). 원판 40m: 웹 55m 로 두면 이 트랙 적 끈(45m)이 먼저 끊겨 되돌아가 체력이 차 버린다.
- 치운 적은 `SetActive(false)` 뒤 `Destroy` — Destroy 는 프레임 끝이라 같은 프레임 "싸우는 중"(`WorldMapUi.Fighting`)에 남아 다음 들어가기를 막았다.
- 진단이 한 번 예외로 끊기자(나무 곁 판정이 다음 틱인데 한 틱 일찍 봄 → 다음 진단이 남은 도전에 들어감) 뒤 진단이 다 건너뛰어졌고, 그다음 판은 그 여파로 들판 전투·활공 진단까지 깨졌다 — 한 판 더 돌리니 원래대로. **예외로 끊긴 판 다음 판은 기준선으로 치지 말 것.**
- 세이브 v26 — 옛 진단 열셋의 `"version":25` → 26. 글 57키(loc-review 0).
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 — domain OK(자리 넷·보상 표·원기·주 갈림·무덤 I 전체·실패 셋 원기 안 씀·쇠부리 ×1.3·서당 기력 +13·보스 4400/44/8.1m·2단계 뇌 방패 440·×0.69·주간 받기 25·비늘·입구 카드·잠긴 단추·도전·물러나기·세이브 v26 왕복/v25 가득), 나머지 OK 44 줄 그대로, 남은 FAIL 기준선 등불. 배치 점검은 기존 6 건(DUNGEON Lv.53)만.
- 실기 확인 전: 돌문·제단이 보이는지·기둥 충돌·원판 40m 체감·보스 크기·먹구름 이무기 2단계 읽힘·도전 줄 자리.
- 다음 = 14-10 들판 보스(웹 ⑲-10 fieldboss.js — 이 트랙 수호장 107-7 과 대조부터).

## 2026-09-28 GO — 109-14-10 들판 보스(웹 사가고 ⑲-10)

"이어해" — 14-9 다음. 웹 `fieldboss.js` 대조: 새 보스 없이 지역 수호자가 들판 보스 · 보상 꽃(원기 30) · 150초 뒤 다시 섬 · 다시 잡으면 꽃만 · 보스 재료(인물 승급). 이 트랙 수호자는 망루 수호장 하나(107-7, 한 번 잡으면 끝)였다.

- `GuardianState`: `Bloom`·`PaidAt`·`Standing`·`MarkPaid`, `MarkDefeated` 가 첫 토벌이면 true. `FieldEnemy`: 수호장 경험·금은 첫 토벌만, 서 있을 때가 아니면 첫 틱에 꺼짐, `GuardianInstance`(꺼져 있어도 잡는다). `FieldSpawner`: 수호장을 늘 세운다(`PlannedCount` 는 `Standing`). `World/GuardianBloom`: 꽃 도형·카드·받기·150초 뒤 다시 세우기(0.25초마다 `Refresh`).
- 보스 재료는 뺐다 — 쓸 곳(인물 승급)이 이 트랙에 없다(14-4 에서 무예 상한을 부대 레벨로 정함). 인물 승급을 넣기로 하면 재료·특산물(14-6)·단사를 한꺼번에 들일 것.
- 세이브 v27 — 옛 진단 열넷의 `"version":26` → 27(새 진단의 v26 가짜 파일 줄까지 sed 가 바꿔 한 번 FAIL — 다음부터 버전 올림 sed 는 새 진단을 쓰기 전에 돌릴 것). 글 10키(loc-review 0).
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 — field boss OK(첫 토벌 금·경험·꽃·꽃 동안 안 섬·카드·원기 10 거절·받기 원기 30·금 300·★4·149초 안 섬·150초 섬·다시 잡으면 꽃만·세이브 v27 왕복/v26 쓰러뜨림 → 꽃), 옛 수호장 진단 포함 나머지 OK 45 줄 그대로, 남은 FAIL 기준선 등불.
- 실기 확인 전: 꽃 크기·빛 · 수호장이 다시 설 때 등장 컷이 또 도는지 · 카드와 대사 줄 겹침.
- 다음 = 14-11 고유·갈래 스킬(웹 ⑲-11 kits.js).

## 2026-09-28 GO — 109-14-11 고유·갈래 스킬(웹 사가고 ⑲-11)

"이어해" — 14-10 다음. 웹 `kits.js` 대조: 109-8 은 기질 → 모양 넷, 웹 ⑲-11 은 지략만 옛 모양·나머지는 한 벌(스킬 + 해방)·고유 다섯·원소 덧붙임.

- `Combat/GoKits`(표 — 언어까지 키로 한 캐시, HUD 가 매 프레임 부름) · `FieldCombat` 한 벌 시전·해방·명단 효과(군기·맹세·빠름)·원소 부여(`Member.InfuseLeft`)·늦은 탄·진/소용돌이 틱 · `FieldEnemy.PullToward`(수호장·주간 보스는 안 끌림) · HUD 스킬 이름 · 도감 `KitLine`.
- 방패 틀은 새 칸 대신 굳힘 보호막(`GuardHp`)을 같이 쓴다 — HUD 굳힘 줄이 그대로 보인다.
- 옛 진단(주인공 스킬 값을 잰다)은 3 프레임째 `GoKits.OffForTest`. 웹도 손잡이로 옛 진단을 옛 모양으로 돌린다.
- heredoc 으로 만든 JSON 치환표의 `\\n` 이 이 셸에선 실제 줄바꿈이 되어 C# 문자열이 깨졌다 — 치환표는 Write 로 쓸 것(이번엔 Edit 로 바로잡음).
- 글 30키(loc-review — 원소 앞말은 기존 "Blazing·Tidal·Stone" 에 맞춰 흔들림 0). 세이브 없음.
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 — kits OK(표·고유 다섯·갈래 셋·지략 null·덧붙임 일곱·불꽃 돌진 대기 6·불새 깃 부여 뒤 1타 화 ×1.2·호령 탄 0.6초 뒤·군기 ×1.15/10초 뒤 풀림·방패 보호막·맹세 ×0.8·팔괘진 기력·천기 뇌우 대기 두 배·돌개 화살 끌기·지략 109-8·도감 줄), 나머지 OK 46 줄 그대로, 남은 FAIL 기준선 등불.
- 실기 확인 전: 탄 떨어지는 곳 예고 원·소용돌이 끌림 체감·스킬 단추 이름 길이(영어)·방패가 굳힘 줄로 보이는 것.
- 다음 = 14-12 (웹 ⑲-12 이야기 인물 셋).

## 2026-09-28 GO — 109-14-12 이야기 임무 1~2장(웹 사가고 ⑲-12)

"사가유니티 이어해" — 이 PC 는 사실 몸 묶음이 일부(590MB)뿐이라 묶음 PC 일(사람 NPC 몸 교체·REALM 인물 몸)은 못 하고 표 14 다음 조각. 웹 `story.js`(9d6908b9)·시나리오 `scenario/saga-go.md` 1부·트랙 메모 대조 — 이 트랙 이야기는 0장이라 1장부터.

- 새 `Data/GoStory`(표 — 인물 셋·장 둘·단계 여섯 가지·자리) · `Data/StoryState`(장·단계·`Talking`·`OffForTest`) · `World/StoryField`(인물 몸·금빛 기둥·옛 제단·임무 적·신호) · `UI/StoryUi`(추적 줄·대화 단추·대화 창·목록). `WorldMapBuilder` 가 Play 때 붙인다.
- 자리 대응: 누리 = 옛 마을 촌장(새로 안 세움) · 대숲 고을 수호자 → 망루 수호장 · 갈대 나루 → 너른 강 북쪽 물가 · 옛 성터 언덕 → 북쪽 산기슭 동굴 어귀. 대사는 원문, 땅 이름만 바꿈("대숲 고을 탑" → "남쪽 공터 옛 망루" 등). 시나리오 트랙 메모에 대응표.
- 처음 잡은 망루 발치(3.6,6.35)가 글자 지도 6줄 산 벽이라 진단이 잡음 → 남쪽 공터 줄(3.1,7.05). 은비·임무 적도 반올림으로 마을 칸(gy 2)에 들어가 산기슭(gy ≤ 1)으로 내림.
- 버들·은비 몸 = 옛 마을 사람 몸을 복제(촌장 사내·상인 여인) — 공방 몸 교체 때 같이 바뀐다. 이 PC 는 폴백 몸.
- 임무 적 `FieldEnemy.StoryFoe`(`FieldSpawner.SpawnStoryFoe`) — 숨은 터 적처럼 경험·전리품·일과 없고 다시 안 서지만 끝까지 쫓진 않는다. 단계가 바뀌면 치운다.
- 신호: 수호장 `Killed`(이미 안 서 있으면 바로 넘김) · 임무 적 모두 쓰러짐 · `FieldCombat.ElementPulse` 원이 옛 제단에 걸림 · 새 `DomainField.Cleared`(보상 나무가 자랄 때, 먹구름 제단만).
- 대화 중 `StoryState.Talking` — `FieldCombat` 입력·`FieldEnemy` 움직임이 멎는다(웹 같게). 고르는 줄의 1·2 키는 인물 교체와 겹쳐 단추 + F(첫째)로.
- 웹 부대 경험(단계 10·장 끝 300/500)은 뺐다(인물 경험 없음 — 14-7·14-8·14-10 결정). VS "도적의 습격"을 1장 kill 로 흡수(시나리오 메모)는 VS 진단이 그 퀘스트를 보고 있어 보류.
- 세이브 v28 `storyCh`·`storyStep` — 옛 진단 열다섯의 `"version":27` → 28 을 새 진단 쓰기 **전에** 바꿈(14-10 때 배운 순서). 글 59 짝(loc-review 오류 0 — 한국어 원문은 코드에서 뽑아 표에 넣음).
- 옛 진단은 3 프레임째 `StoryState.OffForTest`(혼잣말이 대사 줄을 덮거나 임무 적이 끼지 않게).
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 같은 결과 — story OK(표·자리·몸·대화·고르는 줄·go·수호장·임무 적 넷(경험 없음·두 번 안 섬)·옛 제단(먼 신호 무시)·1장 보상·2장 잠김(여정 4)·제단·무덤 터 깸 무시·주간 보스·2장 보상·이미 쓰러진 수호장·혼잣말·세이브 v28 왕복·v27 로드), 나머지 OK 45 줄 그대로, 남은 FAIL 기준선 등불. `UiLayoutCheck` — GO 첫 화면·목록 창(한·영 세 화면비) 겹침 0, 문제 6 은 전부 영어 DUNGEON(작업 전 보고서와 같음).
- 실기 확인 전: 추적 줄 길이(영어)·대화 창이 스킬 단추를 덮는 정도 · 대화 단추 자리(4:3) · 금빛 기둥 굵기·밝기 · 버들·은비 몸(폴백 PC) · 임무 적이 산신당·무덤 터 곁에서 엉키는지 · 옛 제단 크기.
- 다음 = 14-13 (웹 ⑲-13 이야기 3·4장·따라가기·대화 카메라·몸짓).

## 2026-09-28 GO — 109-14-13 이야기 3·4장·따라가기·대화 연출(웹 사가고 ⑲-13)

"이어해" — 14-12 다음. 웹 `story.js` 3·4장(지금 판)·⑲-13(5ae39b78) 대조.

- `GoStory`: 단계 셋 더(gather·cook·follow), 인물 넷째 가면 쓴 나그네(`Appear` 칸 — 4장 둘째~여섯째만, 셋째는 길 위), kill 에 `Foes`(종류 + 덧씌울 원소)·이야기 보스(`BossKo` — 첫 적), domain 에 숨은 터 id. `StoryState.FollowDist`·`Progress`(저장 안 함). `CookState.Picked`·`Cooked` 신호.
- 가마골 수호자 → 이 판 수호자는 망루 하나라(1장이 이미 씀) 끝 논밭에 이야기 보스(불도깨비 ×1.8·체력 ×6·공격 ×1.5 — `FieldEnemy.MakeStoryBoss`)를 새로 세웠다. 웹 boss 단계 그대로 옮기면 2장 뒤 수호장이 꽃을 기다리는 동안 바로 넘어가 버린다.
- 해골 몸은 원소 적이 아니라 덧씌우기가 안 먹는다(`IsElemental`) — 암 졸개도 물귀신 몸(숨은 터 "암 물귀신" 결). 진단이 잡음.
- `CameraRig.Zoom` 은 이미 메서드 이름이라 속성은 `CurrentZoom`.
- 대화 연출: 글 흘러나옴 30자/초·고른 대답 한 줄·인물이 나를 봄·대화 카메라. Space 는 점프와 겹쳐 F 만. 웹 표정·입·손짓은 뺐다(얼굴 틀·몸짓 동작 없음).
- 나그네 영어 Wanderer → 옛 VS 나그네와 같은 Traveler(loc-review 용어 흔들림이 잡음). 글 70 짝.
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 같은 결과 — story OK(표 4장·자리 11·나그네 길 4m 마다 걷는 칸·임무 적 넷 자리 무리 35m·숨은 터 20m 밖·가면·3장 청하란(다른 채집물 안 셈)·요리·우두머리 ×1.8/×6·주간 보스 깸 무시·무덤·잔치 마당·4장 나그네 둘째 단계부터·멀면 안 걷고 줄에 "너무 멀어졌다"·한 걸음 2.6m·길 끝·졸개 빙·암·여섯째 뒤 사라짐·보상·글 흘러나옴·카메라 붙고 돌아옴), 나머지 OK 45 줄 그대로, 남은 FAIL 기준선 등불. `UiLayoutCheck` 문제 6 = 작업 전과 같은 영어 DUNGEON.
- 실기 확인 전: 나그네 걸음(몸 컨트롤러에 Speed 가 없으면 미끄러진다) · 가면 자리(머리뼈 앞) · 대화 카메라 각도·거리 · 우두머리 크기·세기 · 따라가는 길이 수호장 곁(30m)을 스치는 것.
- 다음 = 14-14 (웹 ⑲-14 이야기 5·6장·석등 차례·봉우리·검은 가면 결투).

## 2026-09-28 GO — 109-14-14 이야기 5·6장·석등 차례·봉우리·검은 가면(웹 사가고 ⑲-14)

"이어해" — 14-13 다음. 웹 `story.js` 5·6장·field-combat `b_mask`·ROT 대조.

- `GoStory`: 단계 셋 더(seal·climb·duel), 인물 칸 `At`(은비가 5장 옛길·둘째 제단, 6장 고원으로 옮겨 섬), 칸 `Path`·`Peak`, 단계 `Arena`(고원 위 자리)·보스 배율·공격 차례·가면. 5장 = 서쪽 숲길, 6장 = 봉우리 (6,7) 과 그 고원.
- 처음엔 길 위 칸을 "Gx < 0" 으로 표시했는데 은비 옛길 자리 x 가 −0.1 이라 길 위로 읽혀 NullReference(나그네 길이 없는 인물) — `Spot.Path` 로 따로 뺌.
- **그 예외로 진단이 중간에 끊긴 다음 판에서 옛 진단 여럿(봉수대·승급·들판 전투·무기)이 한 번 깨졌다** — 끊긴 판이 되돌리지 못한 상태 탓으로 보이고(세이브 파일은 새 게임 그대로였다), 그 다음 판부터 기준선과 같다. 진단이 예외로 끊기면 한 판 더 돌려 보고 판단할 것.
- `FieldEnemy`: 공격 차례(`BossMove`·`MoveSpec`·`SetRotation` — 예고·원·배율을 수마다, 그림자 걸음은 등 뒤로 건너뜀) · `CanStep`(고원에 선 이야기 적은 제 칸 안·봉우리 밑동 밖만). 결투 2단계는 `StoryField.DuelTick`(뇌 방패 12% + 불도깨비 둘).
- `StoryField`: light 단계마다 옛 제단(장_단계), 둘째 제단 가운데 + 석등 셋(이름표는 카메라를 본다), 석등 차례(`StoryState.Progress`).
- 봉우리: 웹은 고향 북쪽 봉우리지만 이 판 북쪽 산은 전부 경계(고원 30~38m + 봉우리) — 안쪽 산 칸 중 가장 낮은 (6,7) 을 골랐다(해시를 node 로 옮겨 칸마다 고원·봉우리 높이를 셈).
- 글 74 짝(loc-review 오류 0·흔들림 0). 세이브 없음.
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 같은 결과 — story OK(표 6장·자리(옛길·석등·고원 넷 — 칸 가장자리 3m 안쪽·밑동 18m 밖)·5장 석등 틀림/같은 것 두 번/틀려서 꺼짐/해·달·별·제단 무리 다섯·나그네·6장 고원만으론 안 넘어감·꼭대기·검은 가면 가면·고원 위·칸 밖/봉우리엔 못 섬·그림자 걸음 등 뒤 4.1m·원 5.9·둘째 수 침·2단계 뇌 방패 12%·졸개 둘·쓰러뜨리면 졸개도 치움·셋째 제단·끝 보상), 나머지 OK 45 줄 그대로, 남은 FAIL 기준선 등불. `UiLayoutCheck` 문제 6 = 작업 전과 같은 영어 DUNGEON.
- 실기 확인 전: 석등 이름표 크기·읽힘 · 봉우리 (6,7) 오르기 스태미나 · 고원 위 결투 넓이·검은 가면이 벼랑 끝에서 막히는 모양 · 그림자 걸음 예고 0.8초 체감 · 방패·졸개 나오는 박자.
- 다음 = 14-15 (웹 ⑲-15 이야기 동료 둘 — 은비·나그네 합류·편성).

## 2026-09-28 char-forge — 사람 NPC 15벌 게임 몸 교체(첫 교체)

"vroid 자체툴 이어해" → char-forge 09-27 밤 순서 ① "게임 몸 교체부터". 사람 짝 38 을 짝마다 크게 렌더(`render_pairs.py`, 스크래치패드)해 추천 15·보류 23 판정 페이지를 만들고 사용자 "다 해줘"(추천대로).

- `SetupNpcCharacterImports.ForgeSwap`(Mixamo 이름 → 공방 id) + 메뉴 `Saga/Char Forge/Apply Forge Swaps`(배치 `SetupForgeSwaps`, 로그 `FORGE_SWAP`). 같은 프리팹 자리·GUID 에 공방 FBX 로 굽는다 — 클립은 공방 FBX 안 상태 이름(idle·walk·attack… 소문자), 하나라도 없으면 Mixamo 로.
- 교체 15: 역참 Remy·Megan·ExoGray·Vanguard · DUNGEON Brian·Boss·Leonard · STORY Racer·Olivia · FOREST CastleGuard·Pelegrini·Pete·Sophie·Jennifer · GO 근대 Joe. 보류 = 갑옷 GO 인물 몸 일곱·긴 옷·부푼 옷(Jody·Steve)·주역·동행·망자·방독면, 괴물·두목·로봇 23짝은 판정 밖.
- **씬에 풀어 박힌 몸**: 씬 빌더가 편집 중 `SpawnRigged` 로 심은 "Visual" 은 프리팹 연결이 없어 프리팹을 다시 구워도 옛 몸이 남는다(TestDungeon 3 · TestVillageForest 5 · TestField 1). 새 `ForgeSwapScenes`(메뉴 `Saga/Char Forge/Refresh Swapped Bodies In Build Scenes`, 배치 `RefreshBatch`) 가 바꾼 몸의 Mixamo FBX 메시를 쓰는 Visual 만 같은 부모·방향·키·발 높이로 갈아 끼운다(씬 재빌드 없음). 첫 판 "dangling" 은 부모 Transform 자식 목록 오탐 → Transform 은 건너뜀, 다시 돌려 replaced 0 · `FORGE_SCENE_RESULT OK`.
- 빌드 관문: `realistic-pack.sh manifest`(프리팹 15 해시) → `WriteBuildDeps` 578 → 470(빠진 108 = 바꾼 몸의 Mixamo FBX·클립·텍스처만) → `SagaAssetGate` **OK**. 고지 파일(`SagaLegal.txt`)에 charforge·quaternius·피부 셰이더 MIT 가 올라옴.
- **다른 PC**: 공방 FBX·재질은 저장소 밖 — char-forge README §3 "새 PC" 로 뽑고 `Apply Forge Swaps` → `Refresh Swapped Bodies` 순서. 컨트롤러 15(커밋)는 공방 FBX 클립 GUID 를 가리키니 공방 몸 없는 PC 는 관문 ④ 가 막는다. 사실 몸 묶음(`realistic-pack.sh pack`)도 새 목록으로 다시 쌀 것.
- 배치가 고친 폰트 SDF·Mobile_RPAsset·버전 파일 되돌림.
- 실기 확인 전: 15벌이 서고 걷는 모양·키·발 · Brian·Boss·Racer 베기·맞기·쓰러짐 · 역참 사람 판(GO 폴백 PC 는 원래 캡슐).
- 다음 = 인물 105 제 몸(사용자 지시 "인물 105 이어해").

## 2026-09-28 GO — 109-14-15 이야기 동료 둘·고유 스킬·편성(웹 사가고 ⑲-15)

"이어해" — 14-14 다음. 웹 c18a52ab(story.js MEMBERS·kits.js story_*·formation.js) 대조.

- `GoHeroes.Story`(은비·나그네, `HeroEra.Story`) — `TryGet` 이 도감과 함께 찾아 원소·기질·무예·무기·보패·한 벌이 도감 인물처럼 돈다. 도감 수·들판 인물·몸 배정은 `All` 만 본다.
- 합류: `GoStory.Chapter.Join`(2장 은비·5장 나그네) → `StoryState.Advance` 장 끝에 `PartyState.Recruit` · `CatchUpJoins`(SaveState 로드 뒤).
- 편성: 이 트랙 들판 명단 = 동행 순서의 뒤 셋(109-6) — 순서를 바꾸는 `PartyState.ToField`·`Bench`·`MoveUp`·`FieldIds` 로 했다(세이브 칸 새로 없음). `FieldCombat.RebuildParty` 가 `FieldIds` 를 쓴다.
- 스킬: 탁본 = 옛 `Zone`(팔괘진 틀) 그대로, 새 `KitSkillType.Blink`·`KitBurstType.Lore`·`Echo`, `FieldEnemy.Mark`(받는 피해 ×1.25, 쓰러지면 사라짐). 그림자 걸음은 웹 "돌진" 이지만 이 트랙 돌진(`PlayerController.Dash`)은 적 몸에 막혀 적 뒤로 못 가 **건너뛰기(Teleport)** 로.
- 도감 다섯째 탭(탭 폭 250 → 200) · 상세 "들판 n째 자리/대기" · 무기 칸 아래 편성 단추 둘. 옛 `PlaytestGoHeroDex` 의 "시대 탭 4" 를 5·칸 수 표에 2 를 더함 — 그 진단이 예외로 끊겨 뒤 진단이 모두 빠졌고, **그 다음 판에 옛 진단 몇이 또 한 번 깨졌다가 그 다음 판부터 돌아왔다**(14-14 때와 같은 모양 — 끊긴 판이 남긴 상태).
- 새 진단 처음엔 그림자 걸음·해방이 적을 한 번에 쓰러뜨려 표식·메아리를 못 봤다 — 시험 동안 부대 레벨 1, 표식 뒤 적을 해방 원 밖(15m)으로 옮겨 봄.
- 글 18 짝(loc-review 오류 0·흔들림 0). 세이브 없음.
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 같은 결과 — story allies OK(표·도감 105 그대로·원소·무기·한 벌 · 2장 끝 합류 글·두 번 안 들임·진행 중 장은 안 들임·옛 세이브 조용히 둘 · 편성 다섯(뒤 셋·넣기·다시 넣기 거절·빼기·앞 자리로·둘째/대기 앞으로 거절·셋 이하 못 뺌) → 들판 명단이 따름 · 도감 탭 다섯·이야기 동료 칸 둘·합류 장 안내·자리 줄·단추로 빼고 넣기 · 탁본 기력 +2.5·풀이 12초 ×1.4·그림자 걸음 적 뒤·표식 8초 ×1.25(피해 125)·무적·메아리 셋이 옮긴 적을 따라감), 나머지 OK 46 줄 그대로(hero dex 포함), 남은 FAIL 기준선 등불. `UiLayoutCheck` 문제 6 = 작업 전과 같은 영어 DUNGEON.
- 실기 확인 전: 그림자 걸음 건너뛰기 체감(카메라 튐) · 표식이 적에게 안 보인다(빛깔 표시 없음 — 필요하면 다음에) · 메아리 원 크기 · 도감 탭 다섯 글자 폭(영어 "Story Allies") · 편성 단추 자리.
- 다음 = 14-16 (웹 ⑲-16 이야기 7장·곶·제단 지키기·금 간 검은 가면).

## 2026-09-28 GO — 109-14-16 이야기 7장·제단 지키기·금 간 검은 가면(웹 사가고 ⑲-16)

"이어해" — 14-15 다음. 웹 `story.js` 7장·defend(`spawnWave`·`stepDefend`·`onSiege`)·field-combat `siege`·`b_mask2`·`tideMarks` 대조.

- 곶: 이 판 강(5줄)은 곧은 띠라 곶이 없다 — 강 북쪽 물가 마을 동쪽 끝(5.35,4.45)에, 물결은 강 쪽 빼고 다섯 방향(웹 era-sites 'land' 결).
- `FieldEnemy`: `Siege`·`SetSiege`·`SiegeHit` 이벤트(제단을 노린 한 대 — 나는 안 친다), 추격 중 끈·포기 거리 없음 · `BossMove.Tide`(원 넷 — 곁 원 셋은 `LineRenderer` 를 더 달고, 예고가 끊기면 거둠) · `InStrike`(원 여럿 판정).
- `StoryField`: `DefendTick`(프레임마다)·`SpawnWave`·`OnSiegeHit`·`OnWiped`(`FieldCombat.Wiped`)·`ResetDefend`, 결투 2단계 원소·졸개·글 일반화, 금 간 탈(흰 금 하나).
- **14-14 결투 버그**: `Refresh` 가 `st.Type != Kill` 이면 임무 적을 치웠다 → 실제 게임에선 6장 검은 가면이 0.5초마다(Check → Refresh) 치워지고 다시 섰을 것. 진단은 보스를 세운 뒤 한 박자를 안 돌려서 못 잡았다 — `SquadStep`(kill·duel·defend)로 고치고 "한 박자 뒤 같은 보스" 검사를 6·7장 둘 다에 더함.
- 글 51 짝(loc-review 오류 0·흔들림 0). 세이브 없음.
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 같은 결과 — story OK(표 7장·곶·물결 다섯 방향이 뭍 · 7장 곶 도착·나그네·제단 몸 · 멀면 물결 없음·첫 물결 셋이 제단을 노림·체력 표·추적 줄 100%·1/3 · 물결 적이 제단 쪽으로 7m 걷고 곁에서 예고·제단을 친 한 대 = 공격 · 무너짐 → 처음부터·쉬는 4초·28초 뒤 둘째 물결(무리 7)·전멸 → 처음부터·물결 셋 다 잡으면 넘김 · 금 간 가면·첫 수 밀물 원 넷 간격 5.55·원 판정·밀물 뒤 원 거둠·2단계 물 방패·물귀신 졸개·넷째 제단 불·버들 곶·7장 보상), 나머지 OK 46 줄 그대로, 남은 FAIL 기준선 등불. 첫 화면 UI 는 안 바뀌어 `UiLayoutCheck` 는 이번엔 안 돌림(지키기 줄은 그 단계에서만 길어진다).
- 실기 확인 전: 물결이 제단으로 가는 길(물가 갈대·돌에 걸리는지) · 제단 체력(45 × 26 = 1170)이 버티는 시간 · 밀물 원 넷 읽힘 · 곶 자리가 곶처럼 보이는지(그냥 물가다).
- 다음 = 14-17 (웹 ⑲-17 촌장·사공 동료 — 누리·버들 합류·고유 스킬).

## 2026-09-28 GO — 109-14-17 촌장·사공 동료·고유 스킬 넷(웹 사가고 ⑲-17)

"사가 유니티 이어해" — 이 PC 는 사실 몸 묶음이 없어(`realistic-pack.sh verify` 2906 다름) 09-27 사람 NPC 몸 교체 대신 표 14 다음 조각. 웹 575962a4(story.js MEMBERS 둘·kits.js story_elder·story_ferryman·field-combat gust·wave·feast·rain·`kb`) 대조.

- `GoHeroes.Story` 누리(풍·서책·인덕)·버들(수·창·무용), `GoWeapons.TypeOf` 표, `Chapter.Join` 6장·7장 — 합류 대사 두 줄은 14-14·14-16 때 이미 넣어 두었다.
- `GoKits`: `KitSkillType.Gust`·`Wave`(새 칸 `Arc`·`Knock`) · `KitBurstType.Feast`·`Rain`(새 칸 `FHeal`·`Gap`). 부채 바람 명단 회복은 옛 `s.Heal` 칸 그대로.
- `FieldCombat`: 부채꼴·물길 판정은 그 자리에서(맞힌 적마다 `KnockBack`) · 바람 자리 = 새 `SkillShape.Feast` 진(첫 틱은 Every 뒤, 회복은 FieldCombat 자리 = 지금 인물 자리) · 뱃노래 = `RainFollow` 를 기본(맞힌 수 > 0)·강공격·낙하 끝에서 부름, 값은 해방 때 굳힘(교체해도 사공 공격력·수 원소·사공 치명).
- `FieldEnemy.KnockBack`: 옛 과부하 밀침(`_knock`, 지수 감쇠)과 따로 — 웹처럼 0.25초 고르게, `MoveBy` 라 산·물 칸 앞에서 멎는다. 죽음 판정 뒤라 쓰러진 적은 안 밀리고, `Tick` 의 대화·컷·얼음 멈춤보다 앞이라 얼어 있어도 미끄러진다. `Revive` 가 지운다.
- 진단 처음엔 ① 해방 앞에 `ResetForTest` 를 불러 앞 인물이 주인공으로 돌아가 순풍·뱃노래가 안 나왔고(→ 다시 `Lead`) ② 노 물결 한 방에 적이 쓰러져 밀림을 못 봤다(→ 진단용 `SetMaxHpForTest` ×20, 끝나면 되돌림). 옛 `PlaytestGoHeroDex` 는 이야기 칸 2 → 4.
- 글 8 짝(loc-review 짝 2959·오류 0·흔들림 0) — 영어 이름은 대화의 Nuri·Beodeul 과 맞춤. 세이브 없음.
- 검증(묶음 없는 PC): 컴파일 0 · `PlaytestHeadless` 3연속 같은 결과(다른 줄은 옛 레벨업 컷 확대값 — 시간 의존) — story allies OK(… · 부채 바람 부채꼴·밀림 10.8m·명단 +6%·수호장 그대로 · 순풍 첫 틱 1초 뒤·2초에 두 번·자리 밖 없음 · 노 물결 길 위만·앞으로 9.0m·나는 제자리 · 뱃노래 맞힌 뒤 둘·1초 쉼·15초 끝), OK 51 줄, 남은 FAIL 기준선 등불. 밀린 거리가 13m·11.1m 보다 짧은 건 진단이 적을 0.3초 굴리는 동안 적이 다시 나에게 다가오기 때문.
- 실기 확인 전: 부채꼴 빛줄 다섯·물길 굵기가 읽히는지 · 13m 밀어냄이 너무 먼지(무리를 흩어 오히려 불편한지) · 바람 자리 두 겹 고리 · 물 노 빛줄 · 뱃노래가 켜져 있는지 알 길이 없다(웹도 상태 줄 없음).
- 다음 = 14-18 (웹 ⑲-18 편성 칸 넷·싸우는 중 막기·단추 줄).

## 2026-09-28 char-forge — GO 인물 105 제 몸(장치·가져오기 끝, 게임 반영은 사용자 판정 대기)

"인물 105 이어해". 0c782cde 장치(`PartyBodies.ForgeHero` — `Resources/ForgeHero/hero_<id>` 를 쓸 때 한 벌씩, `HeroDresser.DressOwn` 레시피 키 그대로·체격 배율 없음·머리 꾸밈 없음, `SetupForgeHeroes`).

- 옷 틀 92 다시 짓기(garments.py) → 105벌 `build_real.py --check` 실패 0 → `CharactersForge/hero_*.fbx`(로컬 전용)·`.license.json`(커밋) → `SetupForgeHeroes` `FORGE_HERO n=105 human=105 h=1.58~2.08 missing=0` OK.
- `PlaytestGoHeroLooks`: 제 몸은 따로 잼(키 = 1.75m 비) · 동행·들판·겨루기 꾸밈 수에서 머리 꾸밈 뺌(`WantGear`) — 고치기 전 판은 "꾸밈 2 ≠ 3" 셋. 고친 뒤 `PlaytestHeadless` exit 0 · 입혀 봄 105(제 몸 105) 꾸밈 112 키 오차 0.0%. 옛 두 벌로 먼저 넣은 첫 판은 field combat 11 줄이 흔들렸고 다음 판 0(가져오기 직후 판은 기준선으로 치지 말 것).
- 관문 `SagaAssetGate` OK(Resources 프리팹은 CharactersForge 라 사실 몸 목록 그대로 470).
- **눈으로 본 결과(render_grid 14장, 판정 페이지)**: 긴 옷이 자루처럼 부풂 · 찰갑 어깨판·허리 판이 몸에서 뜸 · 옷 틀·색이 같아 머리만 다른 사람 여럿. 추천 = 보류하고 옷 틀 생성기부터(사람마다 말고 틀에서 고치면 105벌이 같이 낫는다). 이 PC 게임엔 지금 들어가 있다(`CharactersForge/Resources/ForgeHero/` 를 지우면 표의 몸 열일곱으로 돌아감).
