extends Node3D

## master.md 43·44절 — Vegetation/Rock 배치. 웹판 전체가 지키는 원칙
## ("자리는 시각의 순수 함수다" — SAGA-HANDOFF.md의 npc.js/land.js 규칙)을
## 그대로 따른다: 매 프레임 새로 뽑지 않고, 격자 좌표에서 결정적으로 해시해
## 늘 같은 자리에 같은 나무가 선다.
##
## 2026-09-11 — PLAN.md 43·44장(GLB 교체). 나무/바위 모두 CC0 Kenney
## Nature Kit(assets/vegetation·assets/rocks, ASSET_GUIDE.md 참고)의
## GLB 메시로 바꿨다. 각 GLB는 "루트 하나 + MeshInstance3D 하나"(나무는
## 몸통+수관이 한 Mesh 안에 표면 2장으로 이미 합쳐져 있다)라 primitive였을
## 때와 똑같이 MultiMesh 하나에 얹을 수 있다 — draw call 수는 그대로다
## (master.md 35장).

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const KeepSpots := preload("res://games/saga_go/world/keep_spots.gd")
const GLBUtils := preload("res://saga_core/world/glb_utils.gd")

## 2026-09-28 "그래픽 먼저" — 3 → 10. 숲 칸(48m)에 세 그루면 원신 숲이 아니라 들판에 나무 몇 그루였다(창 모드 촬영).
## 크기도 0.7~1.3 → 0.8~1.8배(약 4~10m, TREE_SCALE_MIN·SPAN). 상자·별조각·채집·이야기 칸 TREE_KEEP_M 안엔 안 심는다(keep_spots.gd).
const TREES_PER_FOREST_TILE := 10
const TREE_CHUNK_M := 48.0 # 09-29 나무 MultiMesh 를 이 크기 칸으로 쪼갠다(LOD·잘라내기가 칸마다)
const TREE_SCALE_MIN := 0.8
const TREE_SCALE_SPAN := 1.0
const TREE_KEEP_M := 4.0
const ROCKS_PER_MOUNTAIN_TILE := 1
## 2026-09-12 — 논밭(F) 타일 산포. 마을 사방 채집 밀도(§60)와는 무관하게
## 그냥 시각 채움이라, 숲보다 조금 더 촘촘하게 둬도 된다(밀 이랑 느낌).
const CROPS_PER_FARM_TILE := 6

## 원본 GLB는 이 세계 격자 단위보다 훨씬 작게 모델링돼 있다(실측:
## tree_oak ~1.2m, rock_largeA ~1.0m, crops_wheatStageB ~0.53m). 기존
## primitive가 만들던 나무·바위 크기(트렁크 높이 3·수관 반지름 2.2 / 바위
## 반지름 1.4)에 맞춰 스케일을 역산했다 — ASSET_GUIDE.md에 실측값과 계산
## 근거를 남겨 둠. 밀은 그런 primitive 선례가 없어 인물 키(character-a
## ×1.25 ≈ 3.4m)의 1/3 정도(허리~가슴 높이)를 목표로 새로 잡았다.
const CROP_SCALE := 2.5

## 2026-09-20 — Kenney tree_oak/rock_largeA를 Quaternius(103-5 팔레트
## 스냅 68종 완비)로 교체. Quaternius는 실척(=실제 미터) 모델이라 Kenney
## 저폴리(작게 만들고 크게 스케일)와 원본 크기가 전혀 달라 지역마다 같은
## `TREE_SCALE` 하나를 못 쓴다 — 종별 실측(trimesh, ASSET_GUIDE 해당
## 날짜)에서 옛 tree_oak 최종 높이(1.226×4.5≈5.52m, 승인판 그대로 유지)에
## 맞춰 역산한 배율을 종마다 둔다.
##
## 2026-09-23 — glb_utils 메시 누락 버그(HISTORY 09-23) 수정으로 CommonTree
## 계열이 전부 잎째로 그려지게 된 김에, 지금까지 종 하나(CommonTree_1·
## DeadTree_1)뿐이던 걸 같은 계열 5종(스냅 완비, ASSET_GUIDE 09-20)으로
## 늘렸다 — 전부 같은 목표 높이(5.52m)로 역산해 숲 실루엣·트렁크 충돌
## 체감은 그대로 두고 나무 모양만 다양해진다(트렁크 충돌 반지름·높이는
## `scales[i]`만 쓰고 종별 배율과 무관 — 아래 `_scatter_trees` 참고).
## 타일마다 해시로 종을 고른다. Pine·TwistedTree(스냅 완비)는 침엽수·
## 거목이라 계열이 달라 이번엔 안 섞는다.
const REGION_TREE_VARIANTS := {
	"village": [
		{"glb": "res://assets/world/tree_broadleaf_01.glb", "scale": 0.8371},
		{"glb": "res://assets/world/tree_broadleaf_02.glb", "scale": 0.9},
		{"glb": "res://assets/world/tree_broadleaf_03.glb", "scale": 0.7051},
		{"glb": "res://assets/world/tree_birch_01.glb", "scale": 0.8513},
	],
	## G-0017(2026-10-04) 나무는 K-0052/K-0058 통일 툰 GLB(`assets/world/`). 높이는 옛과 같은 5.52m 로 역산(AABB 실측: 활엽 6.594·5.575·7.829·자작 6.484 /
	## 소나무 8.334·7.941·8.026 / 고목 6.024; 활엽02 는 수관이 넓어 0.9). 눈은 여전히 셰이더(REGION_TREE_SNOW) — 새 재질도 표면마다 albedo_texture 라 바람 셰이더가 그대로 받는다.
	"frost": [
		{"glb": "res://assets/world/tree_pine_01.glb", "scale": 0.6623},
		{"glb": "res://assets/world/tree_pine_02.glb", "scale": 0.6951},
		{"glb": "res://assets/world/tree_pine_03.glb", "scale": 0.6878},
	],
	"ruins": [
		{"glb": "res://assets/world/tree_dead_01.glb", "scale": 0.9163},
	],
}
## 106장 ㊻-4 지역마다 나무에 얹는 눈(vegetation_wind.gdshader snow_amount). 없는 지역은 0.
const REGION_TREE_SNOW := {"frost": 0.7}
## 바위도 같은 이유로 Rock_Medium_1(큰)·Rock_Medium_2(작은, 모양만 다름)
## 로 교체 — Pebble·RockPath 계열은 103-3 스냅 때 이미 "산책로 장식" 용도로
## 못박아 뒀으니(HISTORY 09-20⑰) 산 바위 자리엔 안 쓴다. 옛 최종 높이
## (rock_largeA 0.675m·rock_smallA 0.669m)에 맞춰 역산.
const REGION_ROCK_LARGE_GLB := {
	"village": "res://assets/world/rock_large_01.glb",
	"coast": "res://assets/world/rock_large_01.glb",
	"ruins": "res://assets/world/rock_large_01.glb",
	"frost": "res://assets/world/rock_large_01.glb",
}
const REGION_ROCK_SMALL_GLB := {
	"village": "res://assets/world/rock_moss_01.glb",
	"coast": "res://assets/world/rock_moss_01.glb",
	"ruins": "res://assets/world/rock_moss_01.glb",
	"frost": "res://assets/world/rock_moss_01.glb",
}
const ROCK_LARGE_SCALE := 0.370  # rock_large_01 실측고 1.823 → 0.675/1.823 (G-0017)
const ROCK_SMALL_SCALE := 0.674  # rock_moss_01 실측고 0.993 → 0.669/0.993 (G-0017)
const CROP_GLB := "res://assets/vegetation/crops_wheatStageB.glb"

## PLAN.md 102-5 "초목·지형·애니" — 나무 수관 흔들림(2026-09-21, 순수
## 추가). 원본 StandardMaterial3D 값을 그대로 복사해 셰이더로 바꿔치기
## 하므로(_apply_wind_shader) 겉모습은 그대로고 정점만 흔들린다.
const WIND_SHADER := preload("res://saga_core/shaders/vegetation_wind.gdshader")

## 2026-09-20 — 103-5 잔디꽃 22종 스냅 완비분 중 첫 실사용. 평지("." 타일)에
## 성긴 지면 장식 하나만 얹는다(순수 시각, 충돌 없음 — FOREST forest_biome_
## scatter.gd DENSITY 방식과 같은 결). 옛 참조 크기가 없어(신규 장식) 실측
## 30cm 안팎(사람 발목 높이)을 목표로 새로 잡았다.
const REGION_CLUTTER_GLB := {
	"village": "res://assets/world/grass_tuft_01.glb",
	"coast": "res://assets/world/grass_tuft_01.glb",
	"ruins": "res://assets/world/grass_tuft_02.glb",
}
const REGION_CLUTTER_SCALE := {
	"village": 0.414,  # grass_tuft_01 실측고 0.724 → 0.3/0.724 (G-0017)
	"coast": 0.414,
	"ruins": 0.274,    # grass_tuft_02 실측고 1.095 → 0.3/1.095
}
const CLUTTER_DENSITY := 6  # 평지 칸 6개 중 1개꼴에만 놓는다(FOREST DENSITY=10과 같은 결)

## PLAN 103-3 "포구·폐허 빈 칸 채우기" — procgen.py 비석(stele, 2026-09-20⑥
## 신설, 그동안 씬에 안 물렸다)을 폐허(ruins)에만 순수 시각 장식으로
## 흩뿌린다. 나무·바위와 달리 별도 스케일 역산이 필요 없다 — make_stele()이
## 이미 실제 미터(기본 높이 1.6m)로 지어 102-1 "사람 1.7m" 세계에 그대로
## 맞는다. 두 씨앗(s1·s2)을 섞어 전부 똑같은 비석으로 안 보이게 한다.
const STELE_GLB_A := "res://assets/generated/props/stele_s1_01.glb"
const STELE_GLB_B := "res://assets/generated/props/stele_s2_02.glb"
const STELE_COLOR := Color(0.55, 0.53, 0.5)  # rock 회색과 같은 톤(102-1 팔레트 확정 전 임시)
## 폐허 바닥(R)은 지역 전체에 21칸뿐(7×7 지도, 실측)이라 clutter 1/6
## 비율로는(실측: 헤드리스로 직접 세어 봄) 겨우 1개만 나온다 — 표본이
## 작아 기대값 언저리에서도 쉽게 빈다. 1/3로 올려 실측 5개로 확인.
const RUINS_DEBRIS_DENSITY := 3

## 2026-09-23 — HISTORY 09-22 재감사에서 나온 "실제로 안 쓰인" procgen
## 산출물 중 rock(노이즈 바위)·fence/wall(울타리·돌담) 마저 배선한다
## (stele만 먼저 됐던 이유는 없음, 그냥 순서 문제). 103-3 표의 지정
## 용도 그대로 "폐허 빈 칸 채우기" — stele(비석, 순수 발견 primitive와
## 안 겹치는 R 칸)와 구별되는 두 자리에 놓는다:
## ① rock — R 바닥에 stele와 같이 흩어지는 저상 잔해(돌무더기, 비석보다
##    낮고 넓어 한눈에 구별된다). ② wall/fence — 산(^) 테두리에 "무너진
##    담장·울타리"로, 이미 있는 Rock_Medium(_scatter_rocks)과 섞여 서서
##    "폐허를 둘러싼 담이 무너져 바위처럼 나뒹군다"는 그림을 만든다.
const RUBBLE_ROCK_GLB := [
	"res://assets/generated/props/rock_s1_01.glb",
	"res://assets/generated/props/rock_s2_02.glb",
	"res://assets/generated/props/rock_s3_03.glb",
	"res://assets/generated/props/rock_s4_04.glb",
]
const RUBBLE_DENSITY := 4  # R 칸 1/4 — stele(1/3)보다 성기게, 화면이 안 빽빽하게
const WALL_FENCE_GLB := [
	"res://assets/generated/props/wall_s1_01.glb",
	"res://assets/generated/props/wall_s2_02.glb",
	"res://assets/generated/props/fence_s1_01.glb",
	"res://assets/generated/props/fence_s2_02.glb",
]
const WALL_FENCE_DENSITY := 3  # ^ 테두리 1/3
const RUBBLE_COLOR := Color(0.4, 0.37, 0.34)

## PLAN 105 Q-d 5단계 — 09-20⑮에서 "마을 정원길 후보로 쓸 만함"으로만
## 못박아 두고 안 물렸던 Pebble_Square_1·RockPath_Square_Wide(go_village
## 스냅)를 마을(village)에만 순수 시각 장식으로 놓는다. clutter와 같은
## "." 칸을 스캔하되 별도 salt(950번대)를 써 자리가 안 겹치고, 밀도는
## clutter(1/6)보다 성기게(1/12) 해 "가끔 놓인 디딤돌" 느낌으로 남긴다
## — 실측(trimesh) 결과 두 GLB 모두 이미 사람 스케일에 맞는 실제 크기라
## (RockPath_Square_Wide 2.05×0.18×1.99m, Pebble_Square_1 0.43×0.13×0.44m)
## 별도 배율 역산이 필요 없다(scale=1.0).
##
## 2026-09-23 — 105 Q-d 남은 바위 종(24종 전부 스냅 완비, ASSET_GUIDE 09-20)
## 중 "산책로" 계열(Pebble_Square·RockPath_*)을 마저 다 얹었다. 전부
## trimesh 재확인(0.28~2.09m 사방, 이미 같은 사람 스케일) — scale=1.0
## 그대로, 코드 변경 없이 배열만 늘렸다(선택 로직이 배열 크기에 안 묶임).
const VILLAGE_PATH_GLB := [
	"res://assets/generated/variants/RockPath_Square_Wide__go_village.glb",
	"res://assets/generated/variants/Pebble_Square_1__go_village.glb",
	"res://assets/generated/variants/Pebble_Square_2__go_village.glb",
	"res://assets/generated/variants/Pebble_Square_3__go_village.glb",
	"res://assets/generated/variants/Pebble_Square_4__go_village.glb",
	"res://assets/generated/variants/Pebble_Square_5__go_village.glb",
	"res://assets/generated/variants/Pebble_Square_6__go_village.glb",
	"res://assets/generated/variants/RockPath_Round_Small_1__go_village.glb",
	"res://assets/generated/variants/RockPath_Round_Small_2__go_village.glb",
	"res://assets/generated/variants/RockPath_Round_Small_3__go_village.glb",
	"res://assets/generated/variants/RockPath_Round_Thin__go_village.glb",
	"res://assets/generated/variants/RockPath_Square_Small_1__go_village.glb",
	"res://assets/generated/variants/RockPath_Square_Small_2__go_village.glb",
	"res://assets/generated/variants/RockPath_Square_Small_3__go_village.glb",
	"res://assets/generated/variants/RockPath_Square_Thin__go_village.glb",
]
const VILLAGE_PATH_DENSITY := 12  # "." 칸 1/12

## 같은 105 Q-d 5단계, 해변(coast) 몫. coast 지도엔 "." 칸이 아예 없다
## (전부 ^·~·D·B — REGION_CLUTTER_GLB["coast"]가 있어도 실제론 죽은
## 설정이었다, 확인함) — 대신 모래밭("D")에 조약돌을 흩뿌린다. 09-20⑮에서
## "Pebble_Round×go_coast는 스냅 후 갈색 모래톤이 돼 해변에 더 맞게
## 고쳐졌다"로 이미 무난 판정. 실측(trimesh) Pebble_Round_1 0.50×0.10×0.37m
## — 사람 스케일이라 배율 역산 불필요. 2026-09-23 — 나머지 두 종(4·5)도
## 마저 얹음(0.41×0.10×0.45m·0.42×0.10×0.35m, 같은 스케일).
const COAST_PEBBLE_GLB := [
	"res://assets/generated/variants/Pebble_Round_1__go_coast.glb",
	"res://assets/generated/variants/Pebble_Round_2__go_coast.glb",
	"res://assets/generated/variants/Pebble_Round_3__go_coast.glb",
	"res://assets/generated/variants/Pebble_Round_4__go_coast.glb",
	"res://assets/generated/variants/Pebble_Round_5__go_coast.glb",
]
const COAST_PEBBLE_DENSITY := 10  # "D" 칸 1/10

## 같은 5단계, 마을 숲("T") 하층 식생 — 나무 밑이 맨바닥이던 자리에 고사리·
## 버섯(go_village 스냅, alphaMode MASK/불투명 그대로 임포트돼 GO 기본
## 머티리얼로 컷아웃이 된다 — FOREST 곡률 셰이더 같은 제약이 없다)을 얹는다.
## 폐허 숲은 DeadTree라 고사리가 어울리지 않아 village만. 순수 시각(충돌 없음 —
## 나무 줄기 충돌은 _scatter_trees가 이미 가진다). 배율: 이 판 인물 키(≈3.4m,
## glb_utils.gd fit_height 주석) 기준 고사리는 무릎(원본 0.84m 그대로 ×1.0),
## 버섯은 clutter와 같은 발목 0.3m(실측 0.463m → ×0.65).
##
## 2026-09-23 — 남은 잔디·꽃 8종 중 숲 하층에 어울리는 셋을 더 얹었다.
## Grass_Common/Wispy_Tall(둘 다 alphaMode OPAQUE, 컷아웃 불필요)은 고사리와
## 같은 "무릎" 범주로 목표 0.84m. Mushroom_Laetiporus(선반버섯류, 실측
## 0.767m 낮고 넓적)는 Mushroom_Common과 같은 "발목" 0.3m — 종류가 다른
## 버섯 둘이 섞이게. chance는 기존 둘(0.5·0.25)보다 낮게 잡아(잔디 0.3,
## 버섯 0.15) 하층이 갑자기 빽빽해지지 않게 했다. 나머지 5종
## (Plant_1/1_Big/7/7_Big·Flower_4_Group)은 실측 1~2.5m로 이 층("발목~
## 무릎")보다 커서 관목급 새 배치가 필요해 안 건드림(PROJECT_STATE).
const UNDERSTORY := [
	{"glb": "res://assets/generated/variants/Fern_1__go_village.glb", "scale": 1.0, "chance": 0.5},   # 짝 없음(고사리) — 옛 그대로
	{"glb": "res://assets/world/mushroom_01.glb", "scale": 0.6, "chance": 0.25},        # 0.5m → 0.3m
	{"glb": "res://assets/world/grass_tuft_02.glb", "scale": 0.767, "chance": 0.3},     # 1.095m → 0.84m
	{"glb": "res://assets/world/grass_tuft_01.glb", "scale": 1.16, "chance": 0.3},      # 0.724m → 0.84m
	{"glb": "res://assets/world/mushroom_01.glb", "scale": 0.5, "chance": 0.15},        # 0.5m → 0.25m (작은 버섯)
]

## 같은 5단계, 마을 평지 들꽃. 이 판 칸은 48m라 clutter(칸 6개에 하나)는
## 마을 "." 10칸 전체에 실측 2개뿐 — 거의 안 보인다. 밀 이랑(칸당 6)처럼
## 칸마다 여러 개를 까는 층을 따로 둔다(기존 Clover_1 clutter는 그대로).
## 종은 해시로 섞고, 크기는 풀·클로버 발목 0.3m·꽃 정강이 0.45m ÷ 실측고.
##
## 2026-09-23 — 남은 잔디·꽃 13종(ASSET_GUIDE 09-20) 중 "Petal"(꽃송이
## 뭉치) 5종을 마저 얹었다 — Flower_3/4_Single과 같은 "꽃" 범주라 같은
## 목표 높이 0.45m로 역산, `WILDFLOWERS_PER_TILE`이 칸당 고정(4)이라
## 정원길·조약돌 때처럼 총량은 그대로고 섞이는 종만 늘어난다. 나머지
## 8종 중 Grass_Common/Wispy_Tall·Mushroom_Laetiporus 3종은 숲 하층
## `UNDERSTORY`(무릎~발목 범주)로, Plant_1/1_Big/7/7_Big·Flower_4_Group
## 5종은 아래 새 `SHRUBS`(관목 범주)로 나눠 마저 배치했다.
const WILDFLOWERS := [
	{"glb": "res://assets/world/grass_tuft_01.glb", "scale": 0.414},     # 0.3m
	{"glb": "res://assets/world/grass_tuft_02.glb", "scale": 0.274},     # 0.3m
	{"glb": "res://assets/world/flower_patch_01.glb", "scale": 0.8},     # 0.45m
	{"glb": "res://assets/world/flower_patch_01.glb", "scale": 0.65},    # 0.36m
	{"glb": "res://assets/world/flower_patch_01.glb", "scale": 0.95},    # 0.53m
]
const WILDFLOWERS_PER_TILE := 4

## 2026-09-23 — 105 Q-d 남은 잔디·꽃 마지막 5종. Plant_1/1_Big·Plant_7/
## 7_Big·Flower_4_Group은 실측 1.0~2.5m로 들꽃(WILDFLOWERS)·숲 하층
## (UNDERSTORY) 어느 범주에도 안 맞아 "관목" 새 범주를 둔다 — 마을
## 정원의 어쩌다 있는 landmark 느낌으로, WILDFLOWERS처럼 칸마다 채우지
## 않고 clutter처럼 "." 칸 하나에 하나(칸당 1개 상한)만 확률로 놓는다.
## 목표 높이: Plant_1 허리 1.0m·Plant_1_Big 가슴 1.6m(더 큰 랜드마크
## 느낌)·Plant_7/7_Big 낮고 넓은 화단 0.4~0.45m·Flower_4_Group 꽃덤불
## 1.2m. `SHRUB_CHANCE`(칸당 40%)는 마을 "." 10칸 기준 대략 4그루꼴 —
## clutter·wildflowers와 이미 같은 칸을 나눠 쓰지만(자리 겹침은 여러
## 장식이 같이 있는 정원처럼 자연스러워 문제 삼지 않는다, 09-20 관례와
## 같음), salt 대역(1030번대)만 분리했다. 순수 시각(충돌 없음 — 나무만
## 충돌을 가진다는 기존 원칙 그대로).
const SHRUBS := [
	{"glb": "res://assets/world/bush_01.glb", "scale": 0.84},            # 1.0m
	{"glb": "res://assets/world/bush_02.glb", "scale": 1.2},             # 1.28m
	{"glb": "res://assets/world/bush_01.glb", "scale": 1.1},             # 1.31m
	{"glb": "res://assets/world/bush_02.glb", "scale": 0.7},             # 0.75m
	{"glb": "res://assets/world/flower_patch_01.glb", "scale": 2.1},     # 1.17m 꽃덤불
]
const SHRUB_CHANCE := 0.4  # "." 칸당 1개 상한, 40% 확률

var region_id := "village"

## 09-30 평지 기복 — 칸 (x, y) 중심에서 off 만큼 떨어진 자리를 실제 지면 높이에 앉힌다(예전엔 LEGEND 평탄 값).
func _on_ground(x: int, y: int, off: Vector3) -> Vector3:
	var p := TestMap.world_pos(x, y, region_id) + off
	p.y = TerrainBuilder.height_at(region_id, p)
	return p


func _ready() -> void:
	_scatter_trees()
	_scatter_rocks()
	_scatter_crops()
	_scatter_clutter()
	_scatter_village_path()
	_scatter_coast_pebbles()
	_scatter_understory()
	_scatter_wildflowers()
	_scatter_meadow()
	_scatter_shrubs()
	_scatter_ruins_debris()
	_scatter_ruins_rubble()
	_scatter_ruins_wall_fence()


## 정수 좌표 + salt에서 결정적으로 0~1 값을 뽑는다. core.hash2와 같은 정신 —
## Math.random을 쓰지 않는다(무작위면 다시 켤 때마다 숲이 바뀐다).
static func _hash(gx: int, gy: int, salt: int) -> float:
	var h := (gx * 374761393) ^ (gy * 668265263) ^ (salt * 2246822519)
	h = (h ^ (h >> 13)) * 1274126177
	h = h ^ (h >> 16)
	return float(h & 0x7fffffff) / float(0x7fffffff)


## 원본 StandardMaterial3D 의 텍스처·알파 시저·러프니스·스페큘러 값을
## 그대로 읽어 wind_sway 셰이더 쪽으로 옮긴다 — 하드코딩하지 않아 원본
## 에셋이 나중에 바뀌어도 이 값들이 따로 안 어긋난다. transparency 가
## ALPHA_SCISSOR 가 아니면(DeadTree 처럼 opaque) 컷아웃을 걸지 않는다.
func _apply_wind_shader(mesh: Mesh, surface_idx: int) -> void:
	var orig := mesh.surface_get_material(surface_idx)
	if not (orig is BaseMaterial3D):
		return
	var bm := orig as BaseMaterial3D
	var mat := ShaderMaterial.new()
	mat.shader = WIND_SHADER
	mat.set_shader_parameter("albedo_texture", bm.albedo_texture)
	var scissor := bm.alpha_scissor_threshold if bm.transparency == BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR else 0.0
	mat.set_shader_parameter("alpha_scissor_threshold", scissor)
	mat.set_shader_parameter("roughness_value", bm.roughness)
	mat.set_shader_parameter("specular_value", bm.metallic_specular)
	mat.set_shader_parameter("snow_amount", float(REGION_TREE_SNOW.get(region_id, 0.0)))
	mesh.surface_set_material(surface_idx, mat)


func _scatter_trees() -> void:
	var variants: Array = REGION_TREE_VARIANTS.get(region_id, REGION_TREE_VARIANTS["village"])
	var positions: Array[Vector3] = []
	var scales: Array[float] = []
	var yaws: Array[float] = []
	var species: Array[int] = []
	var rows := TestMap.rows_of(region_id)
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			if row[x] != "T":
				continue
			for i in TREES_PER_FOREST_TILE:
				var jx := (_hash(x, y, i * 2) - 0.5) * TestMap.TILE_SIZE * 0.9
				var jz := (_hash(x, y, i * 2 + 1) - 0.5) * TestMap.TILE_SIZE * 0.9
				var s := TREE_SCALE_MIN + _hash(x, y, i * 2 + 100) * TREE_SCALE_SPAN
				var tp := _on_ground(x, y, Vector3(jx, 0.0, jz))
				if KeepSpots.near(region_id, tp, TREE_KEEP_M):
					continue
				positions.append(tp)
				scales.append(s)
				yaws.append(_hash(x, y, i * 2 + 200) * TAU)
				## 종 선택(salt 300대, 기존 0·1·100·200 대역과 안 겹침).
				species.append(int(_hash(x, y, i * 2 + 300) * variants.size()) % variants.size())

	if positions.is_empty():
		return

	var trunks := StaticBody3D.new()
	trunks.name = "TreeTrunkCollisions"
	add_child(trunks)

	## 잎(캐노피)까지 막지 않는다 — 줄기만 막아야 나무 사이를 지날 때
	## 자연스럽다. GLB 몸통 폭보다 얇게 잡아(0.4·1.3 unscaled) 스치는
	## 정도로는 안 걸리게 한다. 값은 GLB 실측 기반이 아니라 primitive
	## 시절 충돌 크기를 그대로 유지한 것 — 걷는 느낌이 에셋 교체로
	## 갑자기 바뀌지 않게 하려는 의도적 선택. `scales[i]`(0.7~1.3 잡음)만
	## 쓰고 종별 배율(아래)과는 무관 — 종을 섞어도 충돌 체감은 그대로다.
	for i in positions.size():
		var cs := CollisionShape3D.new()
		var shape := CylinderShape3D.new()
		shape.radius = 0.4 * scales[i]
		shape.height = 3.0 * scales[i]
		cs.shape = shape
		cs.position = positions[i] + Vector3(0, 1.5 * scales[i], 0)
		trunks.add_child(cs)

	## 시각은 종별로 나눠 그린다 — MultiMesh 하나엔 Mesh 하나만 얹을 수
	## 있어(_scatter_wildflowers와 같은 패턴), 종 수만큼 MultiMeshInstance3D
	## 를 만들고 해당 종 자리만 그 안에 담는다.
	## 2026-09-29 — 종마다 지역 전체를 MultiMesh 하나로 그렸더니 Godot 가 LOD 를 그 덩어리(지역 전체 크기) 거리로 골라
	## 늘 가장 자세한 나무가 그려졌다(PERF 폐허 37.0만 중 나무 14.5만, SAGA_PERF_HIDE=Trees). 종 × 칸(TREE_CHUNK_M) 으로 쪼개
	## 칸마다 LOD·화면 밖 잘라내기가 걸리게 한다. 이름 Trees<종>_<칸x>_<칸z>.
	var xf_by_key := {}
	for i in positions.size():
		var region_tree_scale: float = variants[species[i]].scale
		var s: float = scales[i] * region_tree_scale
		var basis := Basis(Vector3.UP, yaws[i]).scaled(Vector3(s, s, s))
		var key := Vector3i(species[i], floori(positions[i].x / TREE_CHUNK_M), floori(positions[i].z / TREE_CHUNK_M))
		if not xf_by_key.has(key):
			var fresh: Array[Transform3D] = []
			xf_by_key[key] = fresh
		(xf_by_key[key] as Array[Transform3D]).append(Transform3D(basis, positions[i]))

	var meshes := {}
	for key in xf_by_key:
		var k: int = (key as Vector3i).x
		if not meshes.has(k):
			var m := GLBUtils.with_lods(GLBUtils.extract_mesh(variants[k].glb))
			if m != null:
				## 표면 전부(스냅 CommonTree는 줄기·잎 둘, DeadTree는 하나) — 예전엔
				## "스냅본은 한 표면"으로 잘못 알고 0번(줄기)만 걸었다(glb_utils 09-23 주석).
				for si in m.get_surface_count():
					_apply_wind_shader(m, si)
			meshes[k] = m
		var tree_mesh: Mesh = meshes[k]
		if tree_mesh == null:
			continue
		var xforms: Array[Transform3D] = xf_by_key[key]
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = tree_mesh
		mm.instance_count = xforms.size()
		for i in xforms.size():
			mm.set_instance_transform(i, xforms[i])

		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.name = "Trees%d_%d_%d" % [k, (key as Vector3i).y, (key as Vector3i).z]
		add_child(mmi)


## 밀은 나무처럼 줄기가 굵지 않아 충돌을 안 붙인다 — 숲의 캐노피처럼
## "스쳐도 안 걸린다" 쪽이 논밭 한가운데를 걸어 지날 때 자연스럽다
## (다른 지면 장식인 vegetation 없음, 새로 만든 첫 예외).
func _scatter_crops() -> void:
	var positions: Array[Vector3] = []
	var scales: Array[float] = []
	var yaws: Array[float] = []
	var rows := TestMap.rows_of(region_id)
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			if row[x] != "F":
				continue
			for i in CROPS_PER_FARM_TILE:
				var jx := (_hash(x, y, i * 2 + 700) - 0.5) * TestMap.TILE_SIZE * 0.85
				var jz := (_hash(x, y, i * 2 + 701) - 0.5) * TestMap.TILE_SIZE * 0.85
				var s := 0.8 + _hash(x, y, i * 2 + 800) * 0.4
				positions.append(_on_ground(x, y, Vector3(jx, 0.0, jz)))
				scales.append(s)
				yaws.append(_hash(x, y, i * 2 + 900) * TAU)

	if positions.is_empty():
		return

	var crop_mesh := GLBUtils.with_lods(GLBUtils.extract_mesh(CROP_GLB))
	if crop_mesh == null:
		return

	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = crop_mesh
	mm.instance_count = positions.size()

	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.name = "Crops"
	add_child(mmi)

	for i in positions.size():
		var s: float = scales[i] * CROP_SCALE
		var basis := Basis(Vector3.UP, yaws[i]).scaled(Vector3(s, s, s))
		mm.set_instance_transform(i, Transform3D(basis, positions[i]))


func _scatter_rocks() -> void:
	var positions: Array[Vector3] = []
	var use_large: Array[bool] = []
	var yaws: Array[float] = []
	var rows := TestMap.rows_of(region_id)
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			if row[x] != "^":
				continue
			for i in ROCKS_PER_MOUNTAIN_TILE:
				var jx := (_hash(x, y, i * 3 + 500) - 0.5) * TestMap.TILE_SIZE * 0.6
				var jz := (_hash(x, y, i * 3 + 501) - 0.5) * TestMap.TILE_SIZE * 0.6
				## 2026-09-23 산이 10~30m 고원+봉우리가 됐다 — 그 자리 지면 높이에 앉힌다.
				var rp := TestMap.world_pos(x, y, region_id) + Vector3(jx, 0, jz)
				rp.y = TerrainBuilder.height_at(region_id, rp)
				positions.append(rp)
				use_large.append(_hash(x, y, i * 3 + 502) > 0.5)
				yaws.append(_hash(x, y, i * 3 + 503) * TAU)

	if positions.is_empty():
		return

	## 큰 바위·작은 바위 두 GLB를 섞어 산 능선이 다 똑같아 보이지 않게 한다
	## — MultiMesh는 메시 하나당 하나라 종류별로 둘을 만든다(draw call 2회,
	## 여전히 칸마다 노드를 만드는 것보단 훨씬 싸다).
	var large_mesh := GLBUtils.with_lods(GLBUtils.extract_mesh(REGION_ROCK_LARGE_GLB.get(region_id, REGION_ROCK_LARGE_GLB["village"])))
	var small_mesh := GLBUtils.with_lods(GLBUtils.extract_mesh(REGION_ROCK_SMALL_GLB.get(region_id, REGION_ROCK_SMALL_GLB["village"])))

	var large_positions: Array[Transform3D] = []
	var small_positions: Array[Transform3D] = []
	for i in positions.size():
		var basis: Basis
		var xf: Transform3D
		if use_large[i]:
			basis = Basis(Vector3.UP, yaws[i]).scaled(Vector3.ONE * ROCK_LARGE_SCALE)
			xf = Transform3D(basis, positions[i])
			large_positions.append(xf)
		else:
			basis = Basis(Vector3.UP, yaws[i]).scaled(Vector3.ONE * ROCK_SMALL_SCALE)
			xf = Transform3D(basis, positions[i])
			small_positions.append(xf)

	if large_mesh != null and not large_positions.is_empty():
		add_child(_build_rock_multimesh(large_mesh, large_positions, "RocksLarge"))
	if small_mesh != null and not small_positions.is_empty():
		add_child(_build_rock_multimesh(small_mesh, small_positions, "RocksSmall"))


func _build_rock_multimesh(mesh: Mesh, transforms: Array[Transform3D], node_name: String) -> MultiMeshInstance3D:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = transforms.size()
	for i in transforms.size():
		mm.set_instance_transform(i, transforms[i])

	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.name = node_name
	return mmi


func _scatter_clutter() -> void:
	var positions: Array[Vector3] = []
	var yaws: Array[float] = []
	var rows := TestMap.rows_of(region_id)
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			if row[x] != ".":
				continue
			if _hash(x, y, 600) >= 1.0 / float(CLUTTER_DENSITY):
				continue
			var jx := (_hash(x, y, 601) - 0.5) * TestMap.TILE_SIZE * 0.7
			var jz := (_hash(x, y, 602) - 0.5) * TestMap.TILE_SIZE * 0.7
			positions.append(_on_ground(x, y, Vector3(jx, 0.0, jz)))
			yaws.append(_hash(x, y, 603) * TAU)

	if positions.is_empty():
		return

	var glb: String = REGION_CLUTTER_GLB.get(region_id, REGION_CLUTTER_GLB["village"])
	var clutter_mesh := GLBUtils.with_lods(GLBUtils.extract_mesh(glb))
	if clutter_mesh == null:
		return
	var s: float = REGION_CLUTTER_SCALE.get(region_id, REGION_CLUTTER_SCALE["village"])

	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = clutter_mesh
	mm.instance_count = positions.size()

	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.name = "Clutter"
	add_child(mmi)

	for i in positions.size():
		var basis := Basis(Vector3.UP, yaws[i]).scaled(Vector3.ONE * s)
		mm.set_instance_transform(i, Transform3D(basis, positions[i]))


## _scatter_clutter()와 같은 "." 칸 스캔이지만 별도 salt(950번대)로
## 자리가 안 겹치게 한다. village 지역에만 놓는다 — "정원길"은 마을
## 맥락이라 coast·ruins엔 안 맞는다(ruins는 이미 wall_fence·rubble로
## 다른 결의 바위 장식이 있다).
func _scatter_village_path() -> void:
	if region_id != "village":
		return
	var xf_by_variant: Array[Array] = []
	for i in VILLAGE_PATH_GLB.size():
		var arr: Array[Transform3D] = []
		xf_by_variant.append(arr)
	var rows := TestMap.rows_of(region_id)
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			if row[x] != ".":
				continue
			if _hash(x, y, 950) >= 1.0 / float(VILLAGE_PATH_DENSITY):
				continue
			var jx := (_hash(x, y, 951) - 0.5) * TestMap.TILE_SIZE * 0.6
			var jz := (_hash(x, y, 952) - 0.5) * TestMap.TILE_SIZE * 0.6
			var pos := _on_ground(x, y, Vector3(jx, 0.0, jz))
			var yaw := _hash(x, y, 953) * TAU
			var variant := int(_hash(x, y, 954) * VILLAGE_PATH_GLB.size()) % VILLAGE_PATH_GLB.size()
			(xf_by_variant[variant] as Array[Transform3D]).append(Transform3D(Basis(Vector3.UP, yaw), pos))

	for i in VILLAGE_PATH_GLB.size():
		var xforms: Array[Transform3D] = xf_by_variant[i]
		if xforms.is_empty():
			continue
		var mesh := GLBUtils.with_lods(GLBUtils.extract_mesh(VILLAGE_PATH_GLB[i]))
		if mesh == null:
			continue
		add_child(_build_rock_multimesh(mesh, xforms, "VillagePath%d" % i))


## village 정원길과 같은 취지, coast 몫(salt 960번대) — "D"(모래) 칸을
## 스캔해 조약돌 3종을 섞어 흩뿌린다. 순수 시각(충돌 없음).
func _scatter_coast_pebbles() -> void:
	if region_id != "coast":
		return
	var xf_by_variant: Array[Array] = []
	for i in COAST_PEBBLE_GLB.size():
		var arr: Array[Transform3D] = []
		xf_by_variant.append(arr)
	var rows := TestMap.rows_of(region_id)
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			if row[x] != "D":
				continue
			if _hash(x, y, 960) >= 1.0 / float(COAST_PEBBLE_DENSITY):
				continue
			var jx := (_hash(x, y, 961) - 0.5) * TestMap.TILE_SIZE * 0.7
			var jz := (_hash(x, y, 962) - 0.5) * TestMap.TILE_SIZE * 0.7
			var pos := _on_ground(x, y, Vector3(jx, 0.0, jz))
			var yaw := _hash(x, y, 963) * TAU
			var variant := int(_hash(x, y, 964) * COAST_PEBBLE_GLB.size()) % COAST_PEBBLE_GLB.size()
			(xf_by_variant[variant] as Array[Transform3D]).append(Transform3D(Basis(Vector3.UP, yaw), pos))

	for i in COAST_PEBBLE_GLB.size():
		var xforms: Array[Transform3D] = xf_by_variant[i]
		if xforms.is_empty():
			continue
		var mesh := GLBUtils.with_lods(GLBUtils.extract_mesh(COAST_PEBBLE_GLB[i]))
		if mesh == null:
			continue
		add_child(_build_rock_multimesh(mesh, xforms, "CoastPebble%d" % i))


## "T" 칸마다 UNDERSTORY 종별로 chance 확률(salt 980+종 번호×10)로 하나씩.
func _scatter_understory() -> void:
	if region_id != "village":
		return
	var rows := TestMap.rows_of(region_id)
	for k in UNDERSTORY.size():
		var spec: Dictionary = UNDERSTORY[k]
		var salt := 980 + k * 10
		var s: float = spec.scale
		var xforms: Array[Transform3D] = []
		for y in rows.size():
			var row: String = rows[y]
			for x in row.length():
				if row[x] != "T":
					continue
				if _hash(x, y, salt) >= float(spec.chance):
					continue
				var jx := (_hash(x, y, salt + 1) - 0.5) * TestMap.TILE_SIZE * 0.8
				var jz := (_hash(x, y, salt + 2) - 0.5) * TestMap.TILE_SIZE * 0.8
				var pos := _on_ground(x, y, Vector3(jx, 0.0, jz))
				var basis := Basis(Vector3.UP, _hash(x, y, salt + 3) * TAU).scaled(Vector3.ONE * s)
				xforms.append(Transform3D(basis, pos))
		if xforms.is_empty():
			continue
		var mesh := GLBUtils.with_lods(GLBUtils.extract_mesh(spec.glb))
		if mesh == null:
			continue
		add_child(_build_rock_multimesh(mesh, xforms, "Understory%d" % k))


## "." 칸마다 WILDFLOWERS_PER_TILE개, 종은 해시로 고른다(salt 1000번대 +
## 개체 번호×5). 종별 MultiMesh 하나씩. 순수 시각(충돌 없음).
func _scatter_wildflowers() -> void:
	if region_id != "village":
		return
	var xf_by_kind: Array[Array] = []
	for k in WILDFLOWERS.size():
		var arr: Array[Transform3D] = []
		xf_by_kind.append(arr)
	var rows := TestMap.rows_of(region_id)
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			if row[x] != ".":
				continue
			for i in WILDFLOWERS_PER_TILE:
				var salt := 1000 + i * 5
				var kind := int(_hash(x, y, salt) * WILDFLOWERS.size()) % WILDFLOWERS.size()
				var jx := (_hash(x, y, salt + 1) - 0.5) * TestMap.TILE_SIZE * 0.85
				var jz := (_hash(x, y, salt + 2) - 0.5) * TestMap.TILE_SIZE * 0.85
				var pos := _on_ground(x, y, Vector3(jx, 0.0, jz))
				var s: float = WILDFLOWERS[kind].scale
				var basis := Basis(Vector3.UP, _hash(x, y, salt + 3) * TAU).scaled(Vector3.ONE * s)
				(xf_by_kind[kind] as Array[Transform3D]).append(Transform3D(basis, pos))

	for k in WILDFLOWERS.size():
		var xforms: Array[Transform3D] = xf_by_kind[k]
		if xforms.is_empty():
			continue
		var mesh := GLBUtils.with_lods(GLBUtils.extract_mesh(WILDFLOWERS[k].glb))
		if mesh == null:
			continue
		add_child(_build_rock_multimesh(mesh, xforms, "Wildflowers%d" % k))


## 2026-09-30 "빈 들판" — 48m 칸 하나에 들꽃 4송이(village 한정)라 이야기 지역 들판이 풀밭 한 장으로 비었다(창 모드 x_first_stop·u_palace).
## 칸마다 꽃무리 몇 곳(MEADOW_PATCHES)을 잡고 무리 하나는 한 빛으로 반경 안에 촘촘히 — 멀리서도 색 얼룩으로 읽힌다.
## 꽃 에셋(Flower_*_Single 은 너무 작고, Petal 은 크고 살구빛 버섯 같았다)을 쓰지 않고 코드 꽃: 가는 줄기 + 납작한 꽃송이, 송이 색은 인스턴스 색(MultiMesh 둘).
## 눈밭(frost)은 뺀다.
const MEADOW_PATCHES := 4
const MEADOW_PER_PATCH := 14
const MEADOW_RADIUS := 4.5
const MEADOW_SKIP_REGIONS := ["frost"]
## 마을은 삼각형 예산(PLAN 104-7 평균 35만)이 빠듯해 칸당 무리 하나만(2곳이면 35.0만)(자기 들꽃이 이미 있다).
const MEADOW_PATCHES_BY_REGION := {"village": 1}
const MEADOW_COLORS := [
	Color(1.0, 0.95, 0.75), Color(1.0, 0.8, 0.15), Color(0.98, 0.5, 0.66),
	Color(0.72, 0.62, 0.98), Color(0.55, 0.78, 1.0), Color(1.0, 0.6, 0.3),
]

func _scatter_meadow() -> void:
	if region_id in MEADOW_SKIP_REGIONS:
		return
	var stems: Array[Transform3D] = []
	var heads: Array[Transform3D] = []
	var colors: Array[Color] = []
	var rows := TestMap.rows_of(region_id)
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			if row[x] != ".":
				continue
			for p in int(MEADOW_PATCHES_BY_REGION.get(region_id, MEADOW_PATCHES)):
				var ps := 1100 + p * 60
				var col: Color = MEADOW_COLORS[int(_hash(x, y, ps) * MEADOW_COLORS.size()) % MEADOW_COLORS.size()]
				var cx := (_hash(x, y, ps + 1) - 0.5) * TestMap.TILE_SIZE * 0.8
				var cz := (_hash(x, y, ps + 2) - 0.5) * TestMap.TILE_SIZE * 0.8
				for i in MEADOW_PER_PATCH:
					var a := _hash(x, y, ps + 3 + i * 3) * TAU
					var r := sqrt(_hash(x, y, ps + 4 + i * 3)) * MEADOW_RADIUS
					var pos := _on_ground(x, y, Vector3(cx + cos(a) * r, 0.0, cz + sin(a) * r))
					var s := 0.8 + 0.5 * _hash(x, y, ps + 5 + i * 3)
					stems.append(Transform3D(Basis.IDENTITY.scaled(Vector3(1, s, 1)), pos + Vector3(0, 0.3 * s, 0)))
					heads.append(Transform3D(Basis(Vector3.UP, a).scaled(Vector3.ONE * s), pos + Vector3(0, 0.6 * s, 0)))
					colors.append(col.lerp(Color.WHITE, 0.12 * _hash(x, y, ps + 6 + i * 3)))
	if stems.is_empty():
		return
	var stem_mesh := CylinderMesh.new()
	stem_mesh.top_radius = 0.015
	stem_mesh.bottom_radius = 0.022
	stem_mesh.height = 0.6
	stem_mesh.radial_segments = 4
	stem_mesh.rings = 1
	var stem_mat := StandardMaterial3D.new()
	stem_mat.albedo_color = Color(0.25, 0.5, 0.2)
	stem_mat.roughness = 0.9
	stem_mesh.material = stem_mat
	var head_mesh := SphereMesh.new()
	head_mesh.radius = 0.15
	head_mesh.height = 0.16
	head_mesh.radial_segments = 6
	head_mesh.rings = 2
	var head_mat := StandardMaterial3D.new()
	head_mat.vertex_color_use_as_albedo = true
	head_mat.roughness = 0.75
	head_mat.emission_enabled = true
	head_mat.emission = Color(0.08, 0.08, 0.08)
	head_mesh.material = head_mat
	var stem_mm := MultiMesh.new()
	stem_mm.transform_format = MultiMesh.TRANSFORM_3D
	stem_mm.mesh = stem_mesh
	stem_mm.instance_count = stems.size()
	var head_mm := MultiMesh.new()
	head_mm.transform_format = MultiMesh.TRANSFORM_3D
	head_mm.use_colors = true
	head_mm.mesh = head_mesh
	head_mm.instance_count = heads.size()
	for i in stems.size():
		stem_mm.set_instance_transform(i, stems[i])
		head_mm.set_instance_transform(i, heads[i])
		head_mm.set_instance_color(i, colors[i])
	for pair in [[stem_mm, "MeadowStems"], [head_mm, "MeadowHeads"]]:
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = pair[0]
		mmi.name = pair[1]
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mmi)


## "." 칸당 1개 상한(SHRUB_CHANCE 확률로 뽑힐지 먼저 정하고, 뽑히면 종을
## 고른다) — WILDFLOWERS처럼 칸마다 채우지 않는다. salt 1030번대(clutter
## 600·village_path 950·wildflowers 1000번대와 안 겹침).
func _scatter_shrubs() -> void:
	if region_id != "village":
		return
	var xf_by_kind: Array[Array] = []
	for k in SHRUBS.size():
		var arr: Array[Transform3D] = []
		xf_by_kind.append(arr)
	var rows := TestMap.rows_of(region_id)
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			if row[x] != ".":
				continue
			if _hash(x, y, 1030) >= SHRUB_CHANCE:
				continue
			var kind := int(_hash(x, y, 1031) * SHRUBS.size()) % SHRUBS.size()
			var jx := (_hash(x, y, 1032) - 0.5) * TestMap.TILE_SIZE * 0.6
			var jz := (_hash(x, y, 1033) - 0.5) * TestMap.TILE_SIZE * 0.6
			var pos := _on_ground(x, y, Vector3(jx, 0.0, jz))
			var s: float = SHRUBS[kind].scale
			var basis := Basis(Vector3.UP, _hash(x, y, 1034) * TAU).scaled(Vector3.ONE * s)
			(xf_by_kind[kind] as Array[Transform3D]).append(Transform3D(basis, pos))

	for k in SHRUBS.size():
		var xforms: Array[Transform3D] = xf_by_kind[k]
		if xforms.is_empty():
			continue
		var mesh := GLBUtils.with_lods(GLBUtils.extract_mesh(SHRUBS[k].glb))
		if mesh == null:
			continue
		add_child(_build_rock_multimesh(mesh, xforms, "Shrub%d" % k))


## clutter와 달리 "." 평지가 아니라 폐허 바닥("R")을 스캔한다 — ruins
## 지도(test_map.gd REGIONS.ruins)엔 "." 타일이 아예 없다(전부 R·T·^뿐,
## 확인함). 충돌은 안 붙인다(rock·clutter와 같은 결 — 순수 시각).
func _scatter_ruins_debris() -> void:
	if region_id != "ruins":
		return
	var positions: Array[Vector3] = []
	var yaws: Array[float] = []
	var use_b: Array[bool] = []
	var rows := TestMap.rows_of(region_id)
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			if row[x] != "R":
				continue
			if _hash(x, y, 700) >= 1.0 / float(RUINS_DEBRIS_DENSITY):
				continue
			var jx := (_hash(x, y, 701) - 0.5) * TestMap.TILE_SIZE * 0.6
			var jz := (_hash(x, y, 702) - 0.5) * TestMap.TILE_SIZE * 0.6
			positions.append(_on_ground(x, y, Vector3(jx, 0.0, jz)))
			yaws.append(_hash(x, y, 703) * TAU)
			use_b.append(_hash(x, y, 704) > 0.5)

	if positions.is_empty():
		return

	var mesh_a := GLBUtils.with_lods(GLBUtils.extract_mesh(STELE_GLB_A))
	var mesh_b := GLBUtils.with_lods(GLBUtils.extract_mesh(STELE_GLB_B))
	var mat := StandardMaterial3D.new()
	mat.albedo_color = STELE_COLOR

	var xf_a: Array[Transform3D] = []
	var xf_b: Array[Transform3D] = []
	for i in positions.size():
		var basis := Basis(Vector3.UP, yaws[i])
		var xf := Transform3D(basis, positions[i])
		if use_b[i]:
			xf_b.append(xf)
		else:
			xf_a.append(xf)

	if mesh_a != null and not xf_a.is_empty():
		var mmi_a := _build_rock_multimesh(mesh_a, xf_a, "RuinsDebrisA")
		mmi_a.material_override = mat
		add_child(mmi_a)
	if mesh_b != null and not xf_b.is_empty():
		var mmi_b := _build_rock_multimesh(mesh_b, xf_b, "RuinsDebrisB")
		mmi_b.material_override = mat
		add_child(mmi_b)


## procgen.py make_rock() — 이코사구 노이즈 바위, 씨앗마다 정점색을 이미
## 구워 넣었다(_concat_colored, 103-1 헤더 참고) — stele·wall/fence와
## 달리 material_override를 씌우지 않는다(씌우면 그 정점색 변주가
## 사라진다). stele와 같은 R 바닥에 놓이지만 더 낮고(반지름 0.5 안팎)
## 넓어 비석과 한눈에 구별된다 — "무너진 건물 잔해 위에 뒹구는 돌무더기".
func _scatter_ruins_rubble() -> void:
	if region_id != "ruins":
		return
	var xf_by_variant: Array[Array] = []
	for i in RUBBLE_ROCK_GLB.size():
		var arr: Array[Transform3D] = []
		xf_by_variant.append(arr)
	var rows := TestMap.rows_of(region_id)
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			if row[x] != "R":
				continue
			if _hash(x, y, 720) >= 1.0 / float(RUBBLE_DENSITY):
				continue
			var jx := (_hash(x, y, 721) - 0.5) * TestMap.TILE_SIZE * 0.65
			var jz := (_hash(x, y, 722) - 0.5) * TestMap.TILE_SIZE * 0.65
			var pos := _on_ground(x, y, Vector3(jx, 0.0, jz))
			var yaw := _hash(x, y, 723) * TAU
			var variant := int(_hash(x, y, 724) * RUBBLE_ROCK_GLB.size()) % RUBBLE_ROCK_GLB.size()
			(xf_by_variant[variant] as Array[Transform3D]).append(Transform3D(Basis(Vector3.UP, yaw), pos))

	for i in RUBBLE_ROCK_GLB.size():
		var xforms: Array[Transform3D] = xf_by_variant[i]
		if xforms.is_empty():
			continue
		var mesh := GLBUtils.with_lods(GLBUtils.extract_mesh(RUBBLE_ROCK_GLB[i]))
		if mesh == null:
			continue
		add_child(_build_rock_multimesh(mesh, xforms, "RuinsRubble%d" % i))


## procgen.py make_wall()/make_fence() — 담장·울타리 한 칸씩(103-1 헤더
## 참고), 정점색 없이 임포트되니 stele처럼 flat material_override가
## 필요하다. _scatter_rocks()가 이미 세우는 Rock_Medium과 같은 "^"
## 테두리 칸에 섞어 놓아 "폐허를 둘러싼 담이 무너져 바위 사이에 뒹군다"는
## 그림을 만든다 — stele·rubble(R 바닥)과는 자리가 겹치지 않는다.
func _scatter_ruins_wall_fence() -> void:
	if region_id != "ruins":
		return
	var xf_by_variant: Array[Array] = []
	for i in WALL_FENCE_GLB.size():
		var arr: Array[Transform3D] = []
		xf_by_variant.append(arr)
	var rows := TestMap.rows_of(region_id)
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			if row[x] != "^":
				continue
			if _hash(x, y, 740) >= 1.0 / float(WALL_FENCE_DENSITY):
				continue
			var jx := (_hash(x, y, 741) - 0.5) * TestMap.TILE_SIZE * 0.5
			var jz := (_hash(x, y, 742) - 0.5) * TestMap.TILE_SIZE * 0.5
			var pos := TestMap.world_pos(x, y, region_id) + Vector3(jx, 0, jz)
			pos.y = TerrainBuilder.height_at(region_id, pos)
			var yaw := _hash(x, y, 743) * TAU
			var variant := int(_hash(x, y, 744) * WALL_FENCE_GLB.size()) % WALL_FENCE_GLB.size()
			(xf_by_variant[variant] as Array[Transform3D]).append(Transform3D(Basis(Vector3.UP, yaw), pos))

	var mat := StandardMaterial3D.new()
	mat.albedo_color = RUBBLE_COLOR
	for i in WALL_FENCE_GLB.size():
		var xforms: Array[Transform3D] = xf_by_variant[i]
		if xforms.is_empty():
			continue
		var mesh := GLBUtils.with_lods(GLBUtils.extract_mesh(WALL_FENCE_GLB[i]))
		if mesh == null:
			continue
		var mmi := _build_rock_multimesh(mesh, xforms, "RuinsWallFence%d" % i)
		mmi.material_override = mat
		add_child(mmi)
