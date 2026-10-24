# PROJECT_STATE — saga-unity (상태만, ≤15KB, 덮어쓴다)

> 기능 %: `features.json` → `docs/STATE.md`(생성 — 10-20 GO 96.6·DUNGEON 97.3·FOREST 93.8·STORY 100·REALM 94.4%, D0 다섯은 전부 에셋 줄 `un.*.assets`·`un.go.animals` = K 몫)

**규칙**(SAGA-DESIGN §9): 지금 상태만, 세션 끝에 덮어쓴다. 경위·이유는 `docs/HISTORY.md`·티켓 메모·커밋 메시지.
마지막 갱신: 2026-10-22 (U-0153·0154·0155·R-5).

## 지금 (2026-10-25)

- **큐**(`tasks/unity/QUEUE.md`): U-0226 1만리 본 지도 12구역(폰 발열) → U-0227~0231 웹 W-0420~0429·고돗 G-0379~0383 짝(판마다 한 장) → U-0232 몰래 다가가 등용 · U-0233 얼굴 깜박임 · U-0234 판별 폰 예산.
- **10-25 끝**: U-0224 5천하 일꾼(디오라마 바닥 반지름 7→13 덤) · U-0225 구역 넘김 막 `SagaCore/ZoneCut`(다섯 판 순간이동 16곳)·주머니 땅 `SagaCore/PocketVisibility`(렌더러·조명만 끔).
- **함정**: 군중 몸(`CrowdBodyAnimator`)이 `UnityEngine.Random` 을 꺼내 쓴다 — 5천하 달 넘김 사건 굴림이 밀려 슬라이스 Agri FAIL. 몸을 세울 땐 `Random.state` 저장·복원, 새 굴림은 해시로.
- **대기(K)**: 큐 머리 "대기" 절 — 2나락 짐승 몸·말굽 소리(K-0189)·자연물 사실판(K-0190)·얼굴 SDF(K-0191) 등.
- 확인은 사람 시트 없이 QC+Claude 눈(W-0312).

## 검증 명령(배치 — `-quit` 주지 않는다)

`bash tools/unity-batch.sh -- "<Unity.exe>" -batchmode -nographics -projectPath <경로> -logFile <로그> -executeMethod Saga.EditorTools.<이름>` — 이름: `UiLayoutCheck.Run` · `PlaytestHeadless.Run`(1만리) · `PlaytestDungeonHeadless.Run` · `PlaytestForestHeadless.Run` · `PlaytestStorySlice.Run` · `PlaytestRealmSlice.Run`. 로그에서 `] OK`/`FAIL` 줄을 본다(exit 0 만 믿지 않는다). 숲·천하 진단은 실제 세이브를 지우므로 `LocalLow/SAGA Games/SAGA/save*.json` 을 먼저 떠 두고 되돌린다.

## 완료 요약 — 다섯 게임 × 진척

| 게임 | 씬 | Vertical Slice(Phase 1~8) | 51장 콘텐츠 확장 | 44장 에셋 교체 | 공통(66-2 라이팅·67~69 사운드/설정/Localization) |
|---|---|---|---|---|---|
| GO | `TestVillage` | 완료 — 도적의 습격(이동·촌장·상인·나그네·조우·전투·등용·EXP·장비·루트·저장 v13) | 동물 Group·나그네·은닉 보물·산신당·행운 돌탑·동굴 유물·채집 · 101-2 ④⑦③: 일과판·승급 3택·75초 토벌 · ①⑥⑧: 봉수대·인연·패배 비용·회수 · ②: 사당 시련(파도 3·인장 조각) · **107 ①~⑥ (2026-09-24)** 들판 전투 + 이동 + 지역 지도(세이브 v14) + 보물 상자 16 + 원소 쓰는 적 8 + 동료 몸 교체 · **107-7** 망루 수호장(v15)·106-9 등장 컷 · **107-8** 지역 사명 사슬(v16) · **108 ①** 지역 한자·사연·위험 1~3·몬스터 명단 + **지역 소품 무더기 9**(Poly Haven) · **109-1** 세 시대 적(무리 4/9)·역참 사람 15·소품 현대 13·시간 틈 잔해 9 · **109-6~9** 도감 105·싸워서 등용(v17)·몸 17×모양 다섯(`GoHeroLooks`)·스킬 모양 넷·정상 28(v18)·폭포·지붕 카메라 · **109-14** 웹 ⑲-1~22 — 원소 7~이야기 9장·세계 임무·조준·표식·낚시·업적(v28) | Player·주요 Enemy·Environment·Building 전부 GLB/PBR, Props Kenney 넷 + Poly Haven 스캔 열 벌(108 ①), Rocks/Vegetation은 procgen 트라이플레이너(102-4) | 전부 붙음. 목표판/세션카드(A·B). 101-3 C·F·G 전부 완료 |
| DUNGEON | `TestDungeon` | 완료 — 첫 방→무리·엘리트/보스·방 종류·회피·강공격·필드·동행 | 마을 넷·층 진행·매복·구출·수수께끼·은닉 창고·빌드·도감·보석/영웅 상태 · **101-2 전부 완료** · **106-5 탐험** 점프 F·담쟁이 등반·옛 감시탑 뜰 · **106-6** 무사·술사 파티, 명령 1·2, 소환 V · **106-7** 층 두목 등장 컷 · **108 ③** 명소 층 여섯(5~30층 고정 방 다섯·층 주인·첫 토벌 무기, v10) · **109-2a** 잡졸 41% 시대 적 8·행상·손님 4 · **109-2b** 명소 층 여섯·마을 다섯 꾸밈에 현대·미래 조각(69 중 41%) · **109-10** 비결(K)·빛기둥(v11)·비전·시련(v12)·지역 아홉(3×3 칸 배너·땅빛·M 지도)·위험도·우두머리 아홉(표식 밟기·빌린 몸, v13)·지역 사연(v14)·몸짓·동행 서명·주인 수·몰이 사냥 | Player·잡졸·미니보스/두목·Environment·Building · 103-1 방 셸 마모 3단 | 전부 붙음. 목표판/세션카드. 101-3 C·F·G 전부 완료 |
| FOREST | `TestVillageForest` | 완료(이동 전용) — 마을·집·주민 | 벽지/장판·가구 배치·생물·과일나무·채집·좌판·밀어내기 전투 · **101-2 전부 완료**(번들·채집 손맛·평가·택배 사슬·축제) · **108 ②** 존 한자·사연·짐승 명단·명소 넷·존 자막·존 소품 무더기 8 · **짐승 여덟 사실 모델**(Mixamo 몸 + 빛깔·꾸밈) · **109-4** 존 소품 38% 현대·미래·마을 사람 여섯 · **109-12** 방문객 여덟·단골·몸짓·이웃(v9) | Environment 완료, 과일나무 procgen(102-4) | 전부 붙음. 목표판/세션카드. 101-3 해당 없음 |
| STORY | `TestField` | 완료 — 2.5D 횡스크롤(Z 고정)·잡졸 10·두목·사명 2·볼트·로프 | 척후병 NPC·사건·관계·선택·전직 · 관문 대장(5-4)·비경(5-3)·동료 교대(5-8) · **106-8 두목 등장 컷** · **106-10 교대 셋이 곁에서 싸움**(Paladin·Archer·Peasant Girl) + 소환 우레뿔 거수(V) · **5-2 전부**: 무예 1~4차(`StorySkillData`·`StorySkillState`·패널 K·칸 4 자동/고정)·전직 1~4차(Lv.10/15/20/25)·유파 세트·옷 빛깔(차수×12%) · **109-3** 시대 적 여덟(들판 4/10·비경 40%)·손님 둘 · **109-11** 체력·보스 패턴전·고유 기술·그로기·주간 관문 대장 | 척후병·전직관·마을 사람·숲지기 Mixamo(106-4) | 전부 붙음. 목표판/세션카드. 101-3 C·F·G 전부 완료 |
| REALM | `TestCity` | 완료(경영형) — 명령·계략·문답 36·서고·월드맵·전투·함락 편입 | 적국 55·성 58 · 5-1·5-6·5-2·5-8·5-3·5-5 — **101-2 REALM 전부 완료**(5-4 제외 확정) · **109-5** 시간 틈 아홉(적국 성에 재야)·퓨전 사연 셋(관문 운중·오원·일남) · **109-13** 싸움터·지도 위 인물(대역) | 도시 Environment/Building · 103-1 성벽 3단 | 전부 붙음. 목표판/세션카드. 101-3 해당 없음 |

렌더러: 66-1장 PC(Forward+·MSAA 4)/Mobile(Forward·MSAA 2) + `FF16Volume_*` + 데칼. 아트 방향 **사실적 PBR(FF16 톤)** — 66-2장·102장. Maria 피부 SSS는 `BuildMariaSssShaderGraph.cs`. DUNGEON 카메라는 `CameraRig`→가상 카메라 `PlayerView`→`CinemachineBrain`(106-3), 컷은 `Cinematics/Timelines/Temple_*.playable`.

## 알려진 오류

- **사실 몸 묶음이 없는 PC 에서 `SagaRebuildScenes` 금지** — 씬이 폴백 몸으로 지어진다(`realistic-pack.sh verify` 먼저). 그런 PC 의 판별 진단은 Missing Prefab 로 FAIL(코드 탓 아님). 구운 UI 자리는 런타임 `ApplyLayout()`(빌더·`Awake` 공용)이라 재빌드 없이 맞는다.
- **씬 빌더(에디터)에서 건 `onClick.AddListener`는 저장 안 된다** — 새 버튼은 `Saga.Core.ButtonWiring.Wire(button, 메서드)`(에디터면 영속·Play면 런타임, 인자 하나는 string/int 오버로드). 람다 불가(경고 남김) → 이름 있는 메서드로. 정적 메서드는 대상 컴포넌트 하나(`XxxSaveButton`). STORY는 `[SerializeField]`+`Awake()` 방식(둘 다 유효). 진단은 `Editor/ButtonWiringCheck.cs`(씬 전체 죽은 버튼 + 진짜 onClick).
- 영속 리스너 메서드 이름을 바꾸면 **씬 재빌드** 필요 — 안 하면 먹통(`ButtonWiringCheck`가 대상 메서드 존재까지 보니 진단이 잡는다).
- **`Destroy()`로 자식을 지우고 같은 프레임에 다시 그리면 쌓인다** — onClick 중이면 `DestroyImmediate` 말고 떼어 내고(`SetParent(null)`)·끄고 `Destroy`(`StoryLabyrinthMapUi.ClearChildren`).
- **씬 재빌드가 컷 타임라인(`*.playable`)을 새 트랙 ID 로 다시 쓴다 — 되돌리지 말고 씬과 같이 커밋한다.** 씬의 PlayableDirector 바인딩이 그 ID 를 가리켜, 타임라인만 되돌리면 컷이 빈 트랙을 튼다(DUNGEON 이름표·레터박스·컷 카메라 진단이 깨진다).
- **함정**: 프로젝트 = 설치판 6000.3.24f1(U-0012 승격 — 배치가 설정을 안 고친다). 폰트 SDF 3개는 Playtest 가 동적 아틀라스를 부풀려 `tools/unity-batch.sh --` 가 원복(GUI 실행은 수동 checkout).
- `GetBoneTransform()`은 `isHuman` 먼저. Mixamo 몸 일부는 휴머노이드 실패(Prisoner·Survivor·의족 Pirate) — 다른 카드로.
- 정적 상태 `Restore()` 는 관련 이벤트를 쏴야 UI 가 안 낡는다.
- URP 런타임 타입엔 asmdef에 `Unity.RenderPipelines.Universal.Runtime`(SagaDungeon·SagaGo, Story 는 asmdef 없음).
- 레벨업 컷 체크는 세션 첫 레벨업. `GroundDecal` 캡 테스트는 델타 루프 밖.
- `PlaytestXxx`류는 `-quit` 없이 부른다. 에디터 빌드가 채우는 참조는 `[SerializeField]` 필수. `animator?.` 대신 `if (animator != null)`.
- 헤드리스가 진짜 버튼·공격을 누를 땐 적에게서 떨어져서(사거리 밖). 두목 컷은 진단 앞쪽에서 한 번.
- REALM 새 성은 `RealmEnemyCity.cs`·`RealmCityData.cs` 둘 다. DUNGEON 확인용 텔레포트는 `floorRunner.enabled=false` 먼저, `CameraRig` 확인용은 `_zoom`≤3·`_pitchDeg`≤30.
- 헤드리스가 `SaveState.Save()` 를 부르면 실제 파일이 남는다 — try/finally 로 복원.
- Shader Graph internal API는 리플렉션 우회(`BuildMariaSssShaderGraph.cs`) — 매번 `ShaderHasError`, 재빌드 뒤 GUI idle 900프레임.
- **메인 트리 커밋이 남의 미커밋 에셋(크레딧·범주) 탓에 막히면** origin/main worktree 에서 `PRECHECK_PATHS="<내 경로>" bash tools/precheck.sh && git commit --pathspec-from-file` (U-0153).
- 가끔 실패 → 재실행: STORY `PartySwapWait` · 배치 시작 `Failed to resolve packages`.
