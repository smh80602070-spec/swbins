# PROJECT_STATE — saga-unity (상태만, ≤15KB, 덮어쓴다)

**규칙**(SAGA-DESIGN §9): 지금 상태만, 세션 끝에 덮어쓴다. 경위·이유는 `docs/HISTORY.md` 에 append.
마지막 갱신: 2026-09-27 (110 ⑤c-3 놀다가 켜지는 UI 배치 — ③ 폰 결과 대기).

## 캐릭터 자산 — 이 PC 기준 (2026-09-19)

Maria·Abe·Brute + Skeleton·Paladin·PeasantMan·PeasantGirl·Archer·두목 Maw·Ganfaul·Ninja·Demon·AlienSoldier·Morak + FOREST 몸 여섯(Goblin·Hulk·Warrok·Parasite·Nightshade·Jolleen) + 세 시대 GO 아홉(`SetupEraBodies`)·DUNGEON 여덟(Brian·XBot·Swat·YBot·Boss·Zlorp·Leonard·Astra, `SetupDungeonEraBodies`)·STORY 열(Racer·Dummy·Warzombie·Mremireh·Jody·Yaku·Steve·Mannequin·Olivia·Ely, `SetupStoryEraBodies`)·FOREST 여섯(CastleGuard·Pelegrini·Pete·Sophie·Uriel·Jennifer, `SetupForestEraBodies`)·GO 인물 여덟(Kachujin·Arissa·Eve·Dreyar·CastleGuard02·Heraklios·Brady·Joe, `SetupHeroBodies`) — `Assets/Art/CharactersRealistic/`(gitignore, 4.2GB). **새 PC 는 `bash tools/realistic-pack.sh fetch` 한 방(OneDrive/saga-assets)**(다시 받기는 GUID 가 바뀜), 몸을 고치면 `manifest`·`pack`·`Write Asset Gate Deps`·커밋. 빌드는 `SagaAssetGate` 가 목록과 다르거나 폴백이면 막는다. GUI 확인: Maria·Abe 만.

## 완료 요약 — 다섯 게임 × 진척

| 게임 | 씬 | Vertical Slice(Phase 1~8) | 51장 콘텐츠 확장 | 44장 에셋 교체 | 공통(66-2 라이팅·67~69 사운드/설정/Localization) |
|---|---|---|---|---|---|
| GO | `TestVillage` | 완료 — 도적의 습격(이동·촌장·상인·나그네·조우·전투·등용·EXP·장비·루트·저장 v13) | 동물 Group·나그네·은닉 보물·산신당·행운 돌탑·동굴 유물·채집 · 101-2 ④⑦③: 일과판·승급 3택·75초 토벌 · ①⑥⑧: 봉수대·인연·패배 비용·회수 · ②: 사당 시련(파도 3·인장 조각) · **107 ①~⑥ (2026-09-24)** 들판 전투 + 이동 + 지역 지도(세이브 v14) + 보물 상자 16 + 원소 쓰는 적 8 + 동료 몸 교체 · **107-7** 망루 수호장(v15)·106-9 등장 컷 · **107-8** 지역 사명 사슬(v16) · **108 ①** 지역 한자·사연·위험 1~3·몬스터 명단 + **지역 소품 무더기 9**(Poly Haven) · **109-1** 세 시대 적(무리 4/9)·역참 사람 15·소품 현대 13·시간 틈 잔해 9 · **109-6~9** 도감 105·싸워서 등용(v17)·몸 17×모양 다섯(`GoHeroLooks`)·스킬 모양 넷·정상 28(v18)·폭포·지붕 카메라 | Player·주요 Enemy·Environment·Building 전부 GLB/PBR, Props Kenney 넷 + Poly Haven 스캔 열 벌(108 ①), Rocks/Vegetation은 procgen 트라이플레이너(102-4) | 전부 붙음. 목표판/세션카드(A·B). 101-3 C·F·G 전부 완료 |
| DUNGEON | `TestDungeon` | 완료 — 첫 방→무리·엘리트/보스·방 종류·회피·강공격·필드·동행 | 마을 넷·층 진행·매복·구출·수수께끼·은닉 창고·빌드·도감·보석/영웅 상태 · **101-2 전부 완료** · **106-5 탐험** 점프 F·담쟁이 등반·옛 감시탑 뜰 · **106-6** 무사·술사 파티, 명령 1·2, 소환 V · **106-7** 층 두목 등장 컷 · **108 ③** 명소 층 여섯(5~30층 고정 방 다섯·층 주인·첫 토벌 무기, v10) · **109-2a** 잡졸 41% 시대 적 8·행상·손님 4 · **109-2b** 명소 층 여섯·마을 다섯 꾸밈에 현대·미래 조각(69 중 41%) · **109-10** 비결(K)·빛기둥(v11)·비전·시련(v12)·지역 아홉(3×3 칸 배너·땅빛·M 지도) | Player·잡졸·미니보스/두목·Environment·Building · 103-1 방 셸 마모 3단 | 전부 붙음. 목표판/세션카드. 101-3 C·F·G 전부 완료 |
| FOREST | `TestVillageForest` | 완료(이동 전용) — 마을·집·주민 | 벽지/장판·가구 배치·생물·과일나무·채집·좌판·밀어내기 전투 · **101-2 전부 완료**(번들·채집 손맛·평가·택배 사슬·축제) · **108 ②** 존 한자·사연·짐승 명단·명소 넷·존 자막·존 소품 무더기 8 · **짐승 여덟 사실 모델**(Mixamo 몸 + 빛깔·꾸밈) · **109-4** 존 소품 38% 현대·미래·마을 사람 여섯 | Environment 완료, 과일나무 procgen(102-4) | 전부 붙음. 목표판/세션카드. 101-3 해당 없음 |
| STORY | `TestField` | 완료 — 2.5D 횡스크롤(Z 고정)·잡졸 10·두목·사명 2·볼트·로프 | 척후병 NPC·사건·관계·선택·전직 · 관문 대장(5-4)·비경(5-3)·동료 교대(5-8) · **106-8 두목 등장 컷** · **106-10 교대 셋이 곁에서 싸움**(Paladin·Archer·Peasant Girl) + 소환 우레뿔 거수(V) · **5-2 전부**: 무예 1~4차(`StorySkillData`·`StorySkillState`·패널 K·칸 4 자동/고정)·전직 1~4차(Lv.10/15/20/25)·유파 세트·옷 빛깔(차수×12%) · **109-3** 시대 적 여덟(들판 4/10·비경 40%)·손님 둘 | 척후병·전직관·마을 사람·숲지기 Mixamo(106-4) | 전부 붙음. 목표판/세션카드. 101-3 C·F·G 전부 완료 |
| REALM | `TestCity` | 완료(경영형) — 명령·계략·문답 36·서고·월드맵·전투·함락 편입 | 적국 55·성 58 · 5-1·5-6·5-2·5-8·5-3·5-5 — **101-2 REALM 전부 완료**(5-4 제외 확정) · **109-5** 시간 틈 아홉(적국 성에 재야)·퓨전 사연 셋(관문 운중·오원·일남) | 도시 Environment/Building · 103-1 성벽 3단 | 전부 붙음. 목표판/세션카드. 101-3 해당 없음 |

렌더러: 66-1장 PC(Forward+·MSAA 4)/Mobile(Forward·MSAA 2) + `FF16Volume_*` + 데칼. 아트 방향 **사실적 PBR(FF16 톤)** — 66-2장·102장. Maria 피부 SSS는 `BuildMariaSssShaderGraph.cs`. DUNGEON 카메라는 `CameraRig`→가상 카메라 `PlayerView`→`CinemachineBrain`(106-3), 컷은 `Cinematics/Timelines/Temple_*.playable`.

## 다음 작업 (우선순위, 상세는 PLAN 해당 장)

0. **다음 = PLAN 110 ⑥ 마감**(크레딧·버전·앱 id·아이콘·영어 검수 목록·충돌 로그·AAB 나누기) — ③b 폰 결과 대기. 글자 TMP(`SagaWorldText`·`TmpEffect`), HUD `SagaUi.ApplyGameScaler`(1600×900 Expand, 가로 고정)·Ⅱ `SagaPauseButton`·언어 `SagaUi.Lang`·구운 글 `XxxLocalization.RelocalizeScene`, 점검 `UiLayoutCheck`(첫 화면·패널·상태 38, `-uiHidden`)·`HangulWatch`, 재빌드 `SagaRebuildScenes`. 109 멈춤.
0-1. **남은 것**: en 번역 검수 전. GO 동료 몸 Maria.controller 리타깃·무기는 주인공 손에만.
1. STORY 판수(15→20 약 11판·20→25 약 28판)가 무거우면 `JobPromoteLevel3/4`만.
2. **101-2·104-1 잔여(보류)** — GO⑤·Kenney 폴백·헤어카드.
3. **시나리오**(09-26, `../scenario/`) — 다섯 판 모두 0장: 판별 장 카드·트랙 메모대로 1부부터(README §6). 110 뒤, 판 순서는 사용자.


## 알려진 오류

- **사실 몸 묶음이 없는 PC 에서 `SagaRebuildScenes` 금지** — 씬이 폴백 몸으로 지어진다(`realistic-pack.sh verify` 먼저). 그런 PC 의 판별 진단은 Missing Prefab 로 FAIL(코드 탓 아님). 구운 UI 자리는 런타임 `ApplyLayout()`(빌더·`Awake` 공용)이라 재빌드 없이 맞는다.
- **씬 빌더(에디터)에서 건 `onClick.AddListener`는 저장 안 된다** — 새 버튼은 `Saga.Core.ButtonWiring.Wire(button, 메서드)`(에디터면 영속·Play면 런타임, 인자 하나는 string/int 오버로드). 람다 불가(경고 남김) → 이름 있는 메서드로. 정적 메서드는 대상 컴포넌트 하나(`XxxSaveButton`). STORY는 `[SerializeField]`+`Awake()` 방식(둘 다 유효). 진단은 `Editor/ButtonWiringCheck.cs`(씬 전체 죽은 버튼 + 진짜 onClick).
- 영속 리스너 메서드 이름을 바꾸면 **씬 재빌드** 필요 — 안 하면 먹통(`ButtonWiringCheck`가 대상 메서드 존재까지 보니 진단이 잡는다).
- **`Destroy()`로 자식을 지우고 같은 프레임에 다시 그리면 쌓인다** — onClick 중이면 `DestroyImmediate` 말고 떼어 내고(`SetParent(null)`)·끄고 `Destroy`(`StoryLabyrinthMapUi.ClearChildren`).
- **씬 재빌드가 컷 타임라인(`*.playable`)을 새 트랙 ID 로 다시 쓴다 — 되돌리지 말고 씬과 같이 커밋한다.** 씬의 PlayableDirector 바인딩이 그 ID 를 가리켜, 타임라인만 되돌리면 컷이 빈 트랙을 튼다(DUNGEON 이름표·레터박스·컷 카메라 진단이 깨진다).
- **함정**: Unity 6000.3.24f1 > 프로젝트 6000.3.23f1 → 배치/GUI 실행이 ProjectSettings/Packages를 조용히 고친다. `tools/unity-batch.sh --`로 부르면 자동 원복(`*_RPAsset` v13·GUI 실행은 수동 checkout).
- `GetBoneTransform()`은 `isHuman` 먼저. Mixamo 몸 일부는 휴머노이드 실패(Prisoner·Survivor·의족 Pirate) — 다른 카드로.
- 정적 상태 `Restore()` 는 관련 이벤트(`JobChosen` 등)를 쏴야 UI 가 안 낡는다.
- URP 런타임 타입엔 asmdef에 `Unity.RenderPipelines.Universal.Runtime`(SagaDungeon·SagaGo, Story 는 asmdef 없음).
- 레벨업 컷 체크는 세션 첫 레벨업. `GroundDecal` 캡 테스트는 델타 루프 밖.
- `PlaytestXxx`류는 `-quit` 없이 부른다. 에디터 빌드가 채우는 참조는 `[SerializeField]` 필수. `animator?.` 대신 `if (animator != null)`.
- 헤드리스가 진짜 버튼·공격을 누를 땐 적에게서 떨어져서. 두목 등장 컷은 진단 앞쪽에서 한 번 틀어 둔다.
- REALM 새 성은 `RealmEnemyCity.cs`·`RealmCityData.cs` 둘 다. DUNGEON 확인용 텔레포트는 `floorRunner.enabled=false` 먼저, `CameraRig` 확인용은 `_zoom`≤3·`_pitchDeg`≤30.
- 헤드리스가 `SaveState.Save()` 를 부르면 실제 파일이 남는다 — try/finally 로 복원.
- Shader Graph internal API는 리플렉션 우회(`BuildMariaSssShaderGraph.cs`) — 매번 `ShaderHasError`, 재빌드 뒤 GUI idle 900프레임.
- 가끔 실패 → 재실행: STORY `PartySwapWait` · 배치 시작 `Failed to resolve packages`. `CaptureScreenshot()` 은 세팅·캡처를 다른 tick 에.

## 테스트 상태 (배치 모드, Unity 6000.3.24f1)

| 검증 | 결과 |
|---|---|
| 재빌드·전체 | 배치 점검 3연속 OK(⑤c-3, 상태 38 포함) · 흐름·판별 다섯 3연속 OK(⑤c-2c-2) · 영어(`-hangulWatch`)로도 OK — DUNGEON·STORY 는 남은 고레벨 세이브면 실패, 빼고 돈다 |
| `PlaytestStorySlice` | **3연속 OK(2026-09-25)** — Eras·Companions·Summon·BossIntro·옷 빛깔·상위 차수·전직·ButtonWiring·JobSkills·무예 세이브 왕복·옛 형식 |
| `PlaytestDungeonHeadless` | **3연속 OK(2026-09-26, 지역 뒤)** — Regions·Trial·Secrets·EraDecor·Eras·Landmarks·BossIntro·Party·Explore·NpcModels·Temple(+컷)·LockOn·EnemyTelegraph. 같은 씬 `FloorProgression`·`OverworldMap` OK |
| GO `PlaytestHeadless` | **3연속 OK(2026-09-25)** — Peaks·SkillShapes·HeroLooks·HeroDex·Heroes·Eras·Region*·Guardian·SlopesBiome·PartyBodies·ElementalFoe·Treasure·WorldMap·Traversal·FieldCombat |
| `PlaytestForestHeadless` | **3연속 OK(2026-09-25, 세 시대 뒤)** — `PlaytestForestEras`(사람 6/6 몸·소품 38%·잔해 돎 6)·`Zones`·`ZoneProps` 포함 · `PlaytestForestCreatures` 3연속 · Finish·Furniture·HouseTransition OK |
| REALM 헤드리스 | **3연속 OK(2026-09-25, 세 시대 뒤)** — `PlaytestRealmEras`(전 성 함락 뒤·문답 앞)·`CheckButtonWiring` |
| GUI 실제 Play | GO 라이팅·Maria 동작·Dungeon 카메라(yaw=180)·SSS(Intensity=15) |

## 실기 확인 대기 (항목명만 — 경위는 HISTORY grep)

- GO: **정상·폭포·카메라(109-9)** · **스킬 모양(109-8)** · **인물 몸(109-7) — 꾸밈 자리·몸 너비** · **들판 인물(109-6a) — 겨루기 거리·★5 난이도·굴복 동작** · **세 시대(109-1) — 적 몸·역참 사람·잔해 크기** · 수호장 Maw 몸 · 마을 사람 셋 모델 · 지역 소품·식생·사명 · 망루 수호장·컷 · 동료 모델(Maria 리타깃·교체·날개) · 원소 쓰는 적 · 지역 지도 · 이동(등반·넘어오르기·활공·수영·스태미나·카메라 끼임) · 들판 전투(3타 간격·예고·HUD 자리), 옛 VS 항목 — 세부는 HISTORY grep · **폰에서 설정·승급 3택·저장 버튼**
- DUNGEON: **109-10 비결·비전·시련 체감, 지역 배너·땅빛·M 지도** · **꾸밈 시대 층(109-2b)** · **세 시대 잡졸 여덟·손님·행상** · 두목 전용 몸 넷 · 바위 거신 · 명소 층(108 ③) · 컷(106-3·106-7·능묘 셋) · 파티·소환(106-6) · 탐험(106-5) · 사실 모델 NPC · 잊힌 능묘 · 락온 · 옛 VS·101 항목 — 세부는 HISTORY grep · **폰에서 버튼 전부**
- FOREST: **세 시대(109-4) — 잔해 크기·뜬 높이, 덮개 차, 마을 사람 여섯 발·키·대사** · **숲지기 모델** · **존 소품 — 실측 크기·휨 따라 내림·걸림** · **짐승 여덟 모델 — 키·꾸밈 자리·안개유령 투명도·숲 톤** · **특색 존(108 ②) — 명소 크기·휨 따라 내림이 가까이서 튀는지·점광 세기·자막 세 줄**, 옛 101 항목(벽지·가구·생물·좌판·번들·채집·평가·택배·축제·톤 — 세부는 HISTORY grep), **폰에서 저장·설정·밀어내기 버튼**
- STORY: **세 시대(109-3) — 시대 적 키·타격감·알림·손님** · 두목 Morak(훅 박자) · 척후병·전직관 모델 · 곁의 동료·소환(106-10) · 두목 등장 컷(106-8) · 사건·관계·선택·전직 팝업·관문 대장·비경 · 무예 1~4차(패널 K·칸·손맛·판수·유파 세트·옷 빛깔) — 세부는 HISTORY grep · **폰에서 버튼 전부**
- REALM: **세 시대(109-5) — 사연 한 토막 줄바꿈·퓨전 카드 뜨는 빈도·이계 무장 셈** · 월드맵, 적국 사슬, 패널 여덟, 목표판/세션카드, 공격·계략, 특성·야망, 전술 토글, 서사 카드, 계승 토글, 일기토·설전, 승리 결과 카드, 성벽 실루엣, 오빗 카메라 pull-in, **폰에서 버튼 전부**
- 공통: **⑤c-3 새 자리 — GO 옛 결투 화면(레벨 줄 밑·속공 조이스틱 오른쪽)·DUNGEON/STORY 대사 줄 아래쪽·DUNGEON 지역 배너** · 그림 문자(Noto Emoji 흑백)·영어 대사, Ⅱ 단추·타이틀 설정·새 패널 배치(GO 지도·STORY 무예 2열·REALM 성 스크롤), 폰 발열(30fps·"저" 버튼), BGM 음량, 설정 패널 6줄, SessionCard DoF, 접지 blob 그림자(Mobile 품질), LUT 톤 5장, Screen Space Shadows, Maria 피부 SSS
