# U-0023 Unity 사가고 지역 다섯을 지역 배치표(layout.json)로 짠다 — 코드만
종류: 새기능 · 유니티      상태: **완료**(2026-10-04 사용자 "비교 없어도 됨" · 착수 2026-10-03, 사용자 "이어해" 반복 = 판정 전 착수) — G-0015 와 같은 에셋·같은 배치표, Unity 노선(U-0022 툰)      등급 목표: D2

**목표(한 줄)**: `Assets/SagaCore/Resources/Regions/`(`Pieces/`·`Village/`·`GalaxyFerry/`·`FrostPeak/`·`TimeRift/`·`Crossroads/`)의 에셋과 `layout.json` 으로 지역 다섯을 Godot(G-0015) 과 같은 배치로 짠다. 재질·셰이더는 U-0022 의 툰 규칙을 따른다.

**파일(확인함)**: 지역별 `layout.json`·`*_scenery.glb`·`tex/*.jpg`·`Pieces/*.glb` · 시안 `tools/world-forge/_out/hero_<지역>_pbr.png` · 코드는 새 `RegionLoader.cs`(예정)

**단계**
1. `layout.json` 읽기 + 좌표 변환(Blender x·y·z → Unity x·z·y, 미터) — 조각 반복은 GPU 인스턴싱.
2. 지형 높이 격자 → 메시 한 장 + 땅 재질 섞기(`materials`: 높이·경사로 low↔high), 길 띠, 풍경 메시, 물, 하늘·안개·효과.
3. 빛은 가까운 몇 개만(모바일) — G-0015 단계 3 과 같은 규칙.
4. 진단: 조각 수 = 배치표 수 · 컴파일 오류 0.
5. 실기 발열·프레임은 사용자 몫(몰아서).

**검증**: Unity 로그 오류 0(`unity-batch.sh`) · 진단 일치 · 드로우콜 수 기록 · `precheck` OK.

**완료 조건**: 단계 1~4 + 시안과 같은 구도(사용자 눈).

**불변 규칙**: 에셋 수정 금지 · 이름 정책 · 다른 세션이 Unity 를 쓰는 중이면 기다린다 · 화질 안 깎고 낭비만 줄인다.

**메모**: U-0022 사용자 판정(셰이더 노선)이 끝난 뒤 시작. `.meta` 는 Unity 가 한 번 임포트하며 만든다.

**메모(체크포인트)**: ✔ 단계 1~4 코드분(2026-10-03). `Assets/SagaCore/Region/`(RegionJson·RegionLayout·RegionMeshes·RegionMaterials·RegionLoader·RegionInstancer·RegionLightPool·RegionFx) · `Assets/Shaders/RegionGround.shader`(+Input.hlsl, low/high 섞기 — CelToon 은 안 고침)·`RegionSpark.shader` · `Resources/RegionMaterials/*.mat` 7 · `Editor/PlaytestRegions`(진단 + 재질 만들기 + 미리보기 메뉴). 배치 진단 `[PlaytestRegions] OK`(컴파일 오류 0). 드로우콜 추정/삼각형: 마을 83/168180(나무 130·꽃 238 코드 메시)·은하 나루 22/23310·서리봉 26/28084·시간 틈 30/27504·갈림길 49/33898. 풍경 GLB 가 길을 품은 지역은 길 메시를 다시 안 만든다. 시간 틈 안개(0.035)는 짙은 부피라 전역 안개를 건너뜀. 마을은 배치표에 광원이 없다.
**남은 것: 사용자 눈** — 메뉴 `Saga/Regions/Preview …` 로 시안과 구도 대조(광원 세기·하늘 방향·안개·땅 섞기). U-0022 판정 전 착수라 툰 셰이더가 바뀌면 재질 쪽만 손본다. 이름 정책: 이 티켓의 코드에 표시 글자 없음. 마을 나무 삼각형(≈12.6만)은 실기 발열이 나쁘면 잎덩이 분할 2→1 로 줄일 수 있다(`MeshBuilder.Ico` 반복 횟수). K 갈래 에셋의 `.meta` 131개는 Unity 가 임포트하며 만든 것(코드 커밋과 따로).

**메모(R-5 코드 리뷰, 2026-10-03)**: `/code-review high c65f8b66` 지적 10건 → 고침 8: ① 안개·하늘이 앞 지역에서 새던 것(Apply 때 먼저 끔) ② 원본 반투명 재질(창문 BLEND, 15개 조각)이 인스턴싱 꺼진 채 `RenderMeshInstanced` 로 가던 것(인스턴서가 사본을 켠다 — 원본 에셋은 안 고침) ③ 광원 풀의 없어진 Light 예외 ④ 만든 메시·재질·그림이 안 지워지던 것(`RegionResources`, 뿌리 지우면 같이) ⑤ 걸러내기 상자를 조각 위치에서 구함·행렬은 뿌리가 움직일 때만 다시 곱함·통계는 필요할 때만 셈 ⑥ 빈 재질·뼈대 조각은 인스턴싱 건너뜀 ⑦ 알파 컷아웃 속성 이름(`alphaCutoff`+`_ALPHATEST_ON`, 지금 에셋엔 MASK 없음) ⑨ 눈발 수명 = 상자 높이/낙하 속도(땅 밑을 안 그림) ⑩ JSON 잘림→FormatException·NaN/Infinity 읽기. 안 고침 1: ⑧ 지형 구멍(높이 None)에서 길·광장 높이 0 — Blender 본보기(`ground_z` None → 0.0)와 같고 구멍 있는 지역엔 길이 풍경 GLB 에 구워져 있어 지금은 안 닿음(잠복). 진단에 위 고침 확인 추가, `[PlaytestRegions] OK`.

**메모(화면 대조, 2026-10-03)**: 시안과 나란히 보며 고친 것(진단 `ChecksVillageGround`·`ChecksFogLid`·`ChecksSceneryFacing`):
① 마을 높이는 집·나무 꼭대기가 구워져 있어 `materials` 없는 배치표만 반경 8m 열림+풀 초록(Godot 과 같음, 오차 0.84m) ② 새 모양 세 지역 높이는 `fog.box` 윗면(10·8·5m)으로 덮여 카메라·조각이 땅 아래 → 상자 안 윗면 이상 칸을 지우고 기슭 8m 안 근거+조각 높이 중앙값(물 있으면 호수 바닥)으로 채움(`TerrainSpec.RemoveFogLid`) ③ **풍경 GLB 가 z 로 뒤집힘**(glTF z=−Blender y, glTFast 는 x 만 뒤집음) → 풍경 뿌리 Y 180° ④ 달(`sky.moon`)·밝은 기본색+약한 발광 재질(구름바다) 규칙. 시간 틈 큰 고리는 GLB 에 이미 있다.
편집 모드 캡처는 `RegionInstancer`·`RegionLightPool` 의 Update 를 직접 불러야 반복 조각이 보인다. Godot `region_loader.gd` 는 ②③을 안 다룸 — G 쪽에 알릴 것.
**남은 차이**: 서리봉 숙소 모양(지붕·창 어긋남 — 에셋 품질 의심, K 요청 판단) · 서리봉 하늘이 밝음 · 은하 나루 안개 짙음 · 달이 가장자리에서 타원 · 시간 틈 큰 고리 색(시안 흰색, 여기 GLB 청록·노랑).

**메모(2026-10-04)**: 사용자 "비교 없어도 됨" — 시안 대조 눈 확인 없이 닫는다. 남은 차이(서리봉 숙소 모양·하늘 밝기·은하 나루 안개·달 타원·시간 틈 고리 색)는 에셋·값 손질거리라 이 티켓 밖(K 요청·후속).
