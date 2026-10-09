extends Node3D

## VERTICAL_SLICE.md 27절 — TestMap의 글자 지도를 읽어 색칠한 바닥을 세운다.
## 칸마다 MeshInstance3D를 만들지 않는다 — 지역 전체를 메시 한 장으로 합친다
## (사가마을 웹판 village-view3d.js의 InstancedMesh 원칙과 같다).
##
## 2026-09-16, GO "진짜 두 번째 지역" — `region_id`(export, 기본 "village")로
## test_map.gd REGIONS 어떤 지역이든 그린다.
##
## 2026-09-23, 원신 기준 이동(점프·등반·활공·수영, go_player.gd) 첫 단계 —
## 옛 지형은 산이 2.5m 판 + 투명 6m 벽, 강은 통째로 막힌 벽이라 오를 것도
## 헤엄칠 것도 없었다. 이렇게 바꿨다:
##   · 산(^) 칸은 10~30m 고원 + 가운데 봉우리(노이즈), 이웃보다 높은 변마다
##     수직 절벽 옆면을 메시에 넣는다(트라이플레이너가 경사면을 돌로 칠한다).
##     지도 테두리 산은 더 높게(22~30m) — 분지를 둘러싼 산맥처럼.
##   · 강(~) 바닥을 -1.0 → -3.0 으로 파서 수면(WATER_LEVEL -0.45, 예전과
##     같은 높이) 아래 2.5m 물이 생긴다. 물은 막지 않고 헤엄친다.
##   · 충돌은 칸마다 상자 대신 **보이는 메시 그대로**(trimesh) — 102-5
##     "충돌 바닥도 같은 메시에서" 처방. 다리 널판만 예전 상자 그대로.
##   · 지도 밖으로 활공·등반해 나가지 않게 테두리에 보이지 않는 벽(충돌
##     레이어 2 — 카메라 SpringArm·등반 판정은 레이어 1만 보므로 안 걸린다).
##   · 수면마다 Area3D(레이어 WATER_LAYER, 그룹 "water") — go_player.gd 가
##     여기 들어가면 헤엄친다. 수면 높이는 메타 "surface_y".
## `walkable` 값은 그대로 둔다(스폰·발견 밀도 판정용 — 산·강에 사건을 두지
## 않는다는 뜻이지 못 간다는 뜻이 아니게 됐다).

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const WATER_SHADER := preload("res://saga_core/shaders/water_toon.gdshader")

@export var region_id := "village"

## height — 사가마을 웹판 village-view3d.js가 "물은 12cm 낮춘다"고 한 것과
## 같은 원칙. 산(^)의 height 는 이제 "안쪽 산 최저값"이고 실제 높이는
## tile_base_height() 가 칸마다 정한다.
const LEGEND := {
	"^": {"name": "mountain", "color": Color(0.55, 0.53, 0.5), "walkable": false, "height": 10.0},
	"T": {"name": "forest", "color": Color(0.16, 0.32, 0.14), "walkable": true, "height": 0.15},
	"~": {"name": "river", "color": Color(0.3, 0.26, 0.18), "walkable": false, "height": -3.0},
	"=": {"name": "path", "color": Color(0.62, 0.5, 0.32), "walkable": true, "height": 0.05},
	"H": {"name": "village", "color": Color(0.78, 0.68, 0.42), "walkable": true, "height": 0.1},
	"F": {"name": "farmland", "color": Color(0.55, 0.58, 0.22), "walkable": true, "height": 0.05},
	".": {"name": "plains", "color": Color(0.38, 0.55, 0.24), "walkable": true, "height": 0.0},
	"C": {"name": "cave", "color": Color(0.2, 0.2, 0.22), "walkable": true, "height": 0.2},
	"S": {"name": "shrine", "color": Color(0.5, 0.42, 0.3), "walkable": true, "height": 0.2},
	"R": {"name": "ruins", "color": Color(0.45, 0.42, 0.4), "walkable": true, "height": 0.2},
	"B": {"name": "bridge", "color": Color(0.5, 0.36, 0.2), "walkable": true, "height": -1.0},
	"W": {"name": "waterfall", "color": Color(0.3, 0.42, 0.48), "walkable": true, "height": 0.3},
	## 2026-09-16, "coast" 지역 신규 — region2_coast.gd가 primitive
	## PlaneMesh(SAND_COLOR)로 자급자족하던 모래밭을 같은 색으로 옮긴다.
	"D": {"name": "sand", "color": Color(0.76, 0.68, 0.5), "walkable": true, "height": 0.05},
	## 106장 ㊲ 바위섬 — 기준 높이는 바다 밑(가장자리에 절벽이 안 선다), 가운데로 ISLET_RISE 만큼 둥글게 솟는다(vertex_height).
	## 물은 이 칸에도 깐다(_build_water) — 물 밑 비탈이 드러나지 않게.
	"K": {"name": "islet", "color": Color(0.4, 0.5, 0.3), "walkable": true, "height": -3.0},
	## 106장 ㊺ 서리봉 고원 — 눈밭(숲과 같은 높이 — 길과의 턱을 작게)·얼어붙은 호수(걸을 수 있는 얼음, 물 레이어 없음).
	"N": {"name": "snow", "color": Color(0.86, 0.89, 0.93), "walkable": true, "height": 0.15},
	"I": {"name": "ice", "color": Color(0.62, 0.78, 0.88), "walkable": true, "height": 0.0},
	## 106장 ㊽ 은하 나루 — 별배 나루 금속 포장 바닥(길과 턱 5cm). 셰이더는 모래와 같은 "정점색 그대로" 갈래(.b)로 칠한다.
	"M": {"name": "metal", "color": Color(0.5, 0.54, 0.6), "walkable": true, "height": 0.1},
	## 106장 ㊿ 잠긴 도읍 — 빛 돔이 물을 밀어낸 마른 바닥(바다 밑보다 7m 낮다, 물은 안 깐다). 둘레 바다 칸 절벽은 돔 받침(region7_sunken.gd) 안에 묻힌다.
	"U": {"name": "dome_floor", "color": Color(0.64, 0.62, 0.58), "walkable": true, "height": -10.0},
}
## 106장 ㊺ 지역마다 같은 글자의 색을 바꾼다 — 서리봉 고원의 산은 눈 덮인 흰 산, 숲 바닥은 서늘한 침엽수 빛.
## 흰 정점색(세 채널 모두 밝음)은 terrain_triplanar.gdshader 가 풀 텍스처 대신 눈으로 칠한다(다른 지역 글자엔 해당 없음).
## 2026-09-30 — 풀 텍스처가 초록이라 정점색을 누렇게 해도 땅이 초록 그대로였다(창 모드 w_plain). 가을빛 지역은 텍스처의 색기를 빼고(밝기만 남기고) 정점색이 빛깔을 정하게 한다.
const REGION_TEX_DESAT := {"amber": 0.85, "vault": 0.9, "fork": 0.6}
const REGION_COLORS := {
	"frost": {"^": Color(0.84, 0.87, 0.91), "T": Color(0.2, 0.3, 0.26)},
	## 106장 ㊾ 틈새 갈림길 — 시간 틈 안쪽이라 풀빛이 푸르스름하게 바래고, 산은 보랏빛 돌.
	"crossing": {".": Color(0.34, 0.5, 0.4), "T": Color(0.16, 0.26, 0.26), "^": Color(0.46, 0.42, 0.54)},
	## 106장 ㊿ 잠긴 도읍 — 잿빛 모래·푸른 바위 산·바다 밑은 청록 돌.
	"sunken": {"D": Color(0.5, 0.52, 0.46), "^": Color(0.42, 0.47, 0.5), "~": Color(0.22, 0.3, 0.3), "T": Color(0.18, 0.3, 0.24)},
	## 106장 53 굳은 거리 — 포장은 아스팔트 잿빛, 풀은 호박빛으로 바랜 누런 풀, 산은 황토빛 돌, 장터 바닥은 다진 흙.
	"amber": {"M": Color(0.3, 0.3, 0.32), ".": Color(0.74, 0.58, 0.24), "T": Color(0.28, 0.27, 0.15), "^": Color(0.56, 0.48, 0.38), "H": Color(0.62, 0.5, 0.34)},
	## 106장 54 갈무리 벌 — 가을 벌판·누런 밭·밝은 잿빛 금고·야적장 포장·마른 흙빛 곳간 마당.
	"vault": {".": Color(0.78, 0.64, 0.22), "F": Color(0.72, 0.62, 0.3), "M": Color(0.58, 0.61, 0.66), "^": Color(0.5, 0.47, 0.44), "H": Color(0.64, 0.54, 0.38), "T": Color(0.3, 0.34, 0.16)},
	## 106장 55 세갈래 고을 — 멈춘 늦여름 풀빛(호박빛이 살짝 도는)·흙 마당·자갈 공사장·누런 밭.
	"fork": {".": Color(0.66, 0.6, 0.24), "F": Color(0.74, 0.62, 0.3), "M": Color(0.5, 0.48, 0.45), "^": Color(0.48, 0.44, 0.4), "H": Color(0.66, 0.55, 0.4), "T": Color(0.3, 0.34, 0.16)},
}

## 눈·얼음·모래 표시(정점 CUSTOM0 .r = 눈 · .g = 얼음 · .b = 모래) — terrain_triplanar.gdshader 가 이 값으로 칠한다.
## 모래는 표시가 없으면 풀 텍스처에 모래색만 곱해져 포구 모래밭이 누런 풀밭으로 보였다(2026-09-26 촬영, 땅 뒷면을 고쳐 밝아진 뒤 드러남).
## 예전엔 셰이더가 정점색 밝기(가장 어두운 채널 0.78~0.83)로 눈을 알아봤는데, 눈 색(0.86)과 여유가 0.03 뿐이라
## 길·숲·산성·호수와 맞닿은 칸 가장자리(칸의 34% 섞임)가 모두 풀로 칠해졌다(2026-09-26 창 모드 촬영에서 발견).
## .b 는 모래·금속 포장(M) 같이 — 풀 텍스처 없이 정점색 그대로(흙 무늬 조금).
const SURFACES := {"N": Color(1, 0, 0, 0), "I": Color(0, 1, 0, 0), "D": Color(0, 0, 1, 0), "M": Color(0, 0, 1, 0), "U": Color(0, 0, 1, 0)}
## 고원은 길(밟힌 눈 반)·숲 바닥·산성 터에도 눈이 덮인다 — 48m 칸 하나가 통째로 풀빛이면 눈 고원 한가운데 초록 띠가 된다.
const REGION_SURFACES := {"frost": {"^": Color(1, 0, 0, 0), "=": Color(0.5, 0, 0, 0), "T": Color(0.85, 0, 0, 0), "R": Color(0.7, 0, 0, 0)}}

static func surface_of(region: String, ch: String) -> Color:
	var over: Dictionary = REGION_SURFACES.get(region, {})
	if over.has(ch):
		return over[ch]
	return SURFACES.get(ch, Color(0, 0, 0, 0))

static func color_of(region: String, ch: String) -> Color:
	var over: Dictionary = REGION_COLORS.get(region, {})
	if over.has(ch):
		return over[ch]
	return LEGEND[ch].color if LEGEND.has(ch) else Color(0, 0, 0)

const ISLET_RISE := 6.0     # 바다 밑(-3)에서 꼭대기까지 — 꼭대기 3m, 물 위 반지름 약 16m
const ISLET_TOP_R := 0.16   # 칸 비율 — 이 안은 평평한 꼭대기(약 7.7m)
const ISLET_SHORE_R := 0.47 # 이 밖은 바다 밑
const ISLET_BUMP := 0.6     # 꼭대기 울퉁불퉁

## 수면 높이. 예전 식(강바닥 -1.0 + WATER_HEIGHT_ABOVE_BED 0.55)과 같은 값을
## 상수로 못박았다 — 바닥을 파도 물 높이는 그대로다.
const WATER_LEVEL := -0.45
## 다리(B) 칸 아래 수면 계산용으로만 남는다(-1.0 + 0.55 = WATER_LEVEL).
const WATER_HEIGHT_ABOVE_BED := 0.55

## 다리 널판이 강바닥 위로 뜨는 높이. landmarks_builder.gd의 다리도
## 이 상수를 그대로 가져다 쓴다 — 두 파일이 각자 값을 정하면 어긋난다.
const BRIDGE_CLEARANCE := 2.0
## G-0115 "B" 칸 걷는 바닥 너비 = 그 위 널판 폭(landmarks_builder _add_bridge 6m · region2_coast _build_dock 4m). 표에 없으면 칸 전체.
const BRIDGE_WALK_WIDTH := {"village": 6.0, "coast": 4.0}

## 산 높이(m). 2m 계단으로 끊어 이웃 산끼리도 절벽 단이 생기게 한다.
const MOUNTAIN_INNER_MIN := 10.0
const MOUNTAIN_INNER_MAX := 18.0
const MOUNTAIN_EDGE_MIN := 22.0
const MOUNTAIN_EDGE_MAX := 30.0
const MOUNTAIN_STEP := 2.0
## 고원 가운데 봉우리 높이 — 칸 가장자리로 갈수록 0(절벽 테두리는 평평).
## 2026-09-28 "그래픽 먼저" — 9m·0.38 이면 산이 평평한 탁자(절벽 위 풀밭)로 보였다(창 모드 촬영). 가장자리 높이는 그대로 두고
## (절벽·폭포·등반 꼭대기 판정이 tile_base_height 를 쓴다) 평평한 턱(PEAK_RIM) 뒤 10m 안에서 솟는 봉우리로.
const MOUNTAIN_PEAK_AMP := 18.0
## 절벽 위 평평한 턱(칸 비율, 약 6m) — 오른 뒤 넘어설 자리(등반 mantle)·바람 기둥(sky_isle DRAFT_CELL 가장자리 5m 안쪽)이 기울지 않게.
## 턱 없이 바로 솟게 하면(09-28 시도) 가파를 땐 비탈을 이어 타고, 덜 가파를 땐 벽도 턱도 아닌 비탈에서 손을 놓고 떨어졌다(probe_traversal climb_top).
const PEAK_RIM := 0.12
const PEAK_FALLOFF := 0.2

## 지도 테두리 밖 절벽이 떠 보이지 않게 내려 긋는 깊이.
const OUTER_SKIRT_Y := -8.0
## 보이지 않는 경계벽 높이·두께. 테두리 산 꼭대기(최대 30+9m)보다 넉넉히.
const BORDER_WALL_HEIGHT := 120.0
const BORDER_WALL_THICK := 4.0

## 충돌 레이어(비트 값). 1 = 지형·건물(기본), 2 = 경계벽, 4 = 물.
const BORDER_LAYER := 2
const WATER_LAYER := 4

## 칸 하나를 몇 조각으로 쪼갤지. 봉우리 굴곡 때문에 4 → 8(6m 간격)로 늘렸다.
## 경계 색 섞기(EDGE_BLEND_MARGIN)는 u,v 비율로 계산해 조각 수와 무관하다.
const SUB := 8
const EDGE_BLEND_MARGIN := 0.34

## 09-28 0.5,0.48,0.45 → 따뜻한 황갈색 — 회색 돌 텍스처와 곱해져 절벽이 잿빛 벽으로 보였다(창 모드 촬영).
const CLIFF_COLOR := Color(0.62, 0.53, 0.42)
const CLIFF_SEG_M := 12.0
const CLIFF_JAG_M := 4.5
const LOW_STEP_M := 0.6 # 이보다 낮은 턱 옆면은 땅처럼 칠한다(_add_cliffs)

static var _noise: FastNoiseLite = null
static var _relief_noise: FastNoiseLite = null

## 2026-09-30 "빈 들판" — 평지가 자로 잰 듯 평평해 넓은 들이 판때기 같았다. 완만한 물결 기복(파장 ~125m, ±RELIEF_AMP)을 얹는다.
## 대상은 이어진 "평지 글자"(RELIEF_FLAT: 풀·숲 바닥·밭·길) — 이 글자끼리 이웃한 변에선 같은 함수라 칸 이음이 그대로,
## 다른 글자(물·산·다리·집터·모래…)와 맞닿는 변에선 RELIEF_FADE_M 안에서 0 으로 잦아든다(기준 높이·절벽 판정은 tile_base_height 그대로).
## **지면에 물건을 앉힐 때는 LEGEND 값이 아니라 height_at() 을 쓴다**(안 그러면 진폭만큼 뜨거나 묻힌다).
const RELIEF_AMP := 2.4
## 게임이 손으로 놓은 자리(순간이동 지점·이야기 인물/도주 길/결투장·지역 명소)는 평탄해야 한다(도주 길·결투장은 점검이 1m 이내 평탄을 전제로 삼는다).
## 그 둘레 RELIEF_SITE_R 안은 기복 0, 그 밖 RELIEF_SITE_FADE 에 걸쳐 서서히 올라온다.
const RELIEF_SITE_R := 18.0
const RELIEF_SITE_FADE := 26.0
const RELIEF_SITE_SCRIPTS := {
	"village": ["landmarks_builder", "era_sites", "village_dressing", "npc_builder", "fishing", "dispatch"],
	"coast": ["region2_coast"], "ruins": ["region3_ruins"], "frost": ["region4_frost"], "skyport": ["region5_skyport"],
	"crossing": ["region6_crossing"], "sunken": ["region7_sunken"], "amber": ["region8_amber"], "vault": ["region9_vault"],
	"fork": ["region10_fork"],
}
## G-0122 — 다른 지역 칸을 가리키는 상수(이동 목적지·역참 재계산)는 그 지역 자리로.
const SITE_REGION_BY_NAME := {"VILLAGE_WAYSTATION_GRID": "village", "RUINS_ENTRY_GRID": "ruins", "HARBOR_GATE_GRID": "coast"}
static var _sites: Dictionary = {}   # 지역 → {Vector2i 칸 → PackedVector2Array(칸 좌표)}
static var _sites_ready := false
const RELIEF_FADE_M := 14.0
const RELIEF_FLAT := [".", "T", "F", "="]
## 평지 글자끼리는 기준 높이를 하나로(LEGEND 의 0~0.15 계단이 기복 위에서 균열·떠 있는 옆면이 되지 않게).
const RELIEF_BASE := 0.05
const RELIEF_REGIONS := ["village", "ruins", "frost", "skyport", "crossing", "sunken", "amber", "vault", "fork"]

func _ready() -> void:
	_build()
	_build_water()
	_build_collision()
	_build_cliff_rocks()
	_build_border()

# ---------------------------------------------------------------- 높이 API

## 칸의 기준 높이. 산은 씨앗 해시로 2m 계단, 나머지는 LEGEND 값.
static func tile_base_height(region: String, x: int, y: int) -> float:
	var ch := TestMap.tile_at(x, y, region)
	if ch in RELIEF_FLAT and region in RELIEF_REGIONS:
		return RELIEF_BASE
	if ch != "^":
		return LEGEND[ch].height if LEGEND.has(ch) else 0.0
	var s := TestMap.size(region)
	var edge := x == 0 or y == 0 or x == s.x - 1 or y == s.y - 1
	var lo := MOUNTAIN_EDGE_MIN if edge else MOUNTAIN_INNER_MIN
	var hi := MOUNTAIN_EDGE_MAX if edge else MOUNTAIN_INNER_MAX
	var steps := int((hi - lo) / MOUNTAIN_STEP)
	var k := int(_hash(x, y, 901) * float(steps + 1)) % (steps + 1)
	return lo + float(k) * MOUNTAIN_STEP

## 칸 안 (u,v)(0~1) 자리의 실제 지면 높이. 산만 봉우리가 솟는다.
static func vertex_height(region: String, x: int, y: int, u: float, v: float) -> float:
	var base := tile_base_height(region, x, y)
	var tch := TestMap.tile_at(x, y, region)
	if tch in RELIEF_FLAT and region in RELIEF_REGIONS:
		return base + _relief(region, x, y, u, v)
	if tch == "K":
		var r := Vector2(u - 0.5, v - 0.5).length()
		var fk := 1.0 - smoothstep(ISLET_TOP_R, ISLET_SHORE_R, r)
		var tsk := TestMap.tile_size_of(region)
		var nk := _peak_noise().get_noise_2d((x + u) * tsk, (y + v) * tsk) * 0.5 + 0.5
		return base + ISLET_RISE * fk + ISLET_BUMP * nk * fk * fk
	if tch != "^":
		return base
	var d: float = min(min(u, 1.0 - u), min(v, 1.0 - v))
	var f := smoothstep(PEAK_RIM, PEAK_RIM + PEAK_FALLOFF, d)
	var ts := TestMap.tile_size_of(region)
	var n := _peak_noise().get_noise_2d((x + u) * ts, (y + v) * ts) * 0.5 + 0.5
	return base + MOUNTAIN_PEAK_AMP * pow(n, 1.4) * f

## 월드 좌표의 지면 높이(바위·소품을 산 위에 앉힐 때).
static func height_at(region: String, world: Vector3) -> float:
	var g := _grid_of(region, world)
	return vertex_height(region, int(g.x), int(g.y), g.z, g.w)

## 월드 → (칸 x, 칸 y, u, v). world_pos() 의 역함수.
static func _grid_of(region: String, world: Vector3) -> Vector4:
	var s := TestMap.size(region)
	var ts := TestMap.tile_size_of(region)
	var local := world - TestMap.origin_of(region)
	var gx := local.x / ts + s.x * 0.5 + 0.5
	var gy := local.z / ts + s.y * 0.5 + 0.5
	var ix := clampi(int(floor(gx)), 0, s.x - 1)
	var iy := clampi(int(floor(gy)), 0, s.y - 1)
	return Vector4(ix, iy, clampf(gx - ix, 0.0, 1.0), clampf(gy - iy, 0.0, 1.0))

## 평탄해야 하는 자리들을 한 번 모은다 — 순간이동 지점 표(waypoints.gd POINTS) + 이야기 자료(story.gd 의 region·cell·path) +
## 지역 스크립트의 칸 좌표 상수(Vector2). 스크립트는 로드 순환을 피하려고 런타임에 load() 한다.
static func _collect_sites() -> void:
	_sites_ready = true
	_border_road_sites()
	var wp: Script = load("res://games/saga_go/world/waypoints.gd")
	for p in wp.get_script_constant_map().get("POINTS", []):
		_add_site(String(p[1]), p[2] as Vector2)
	var story: Script = load("res://games/saga_go/data/story.gd")
	for k in story.get_script_constant_map():
		_walk_sites(story.get_script_constant_map()[k], "village")
	for region in RELIEF_SITE_SCRIPTS:
		for name in RELIEF_SITE_SCRIPTS[region]:
			var s: Script = load("res://games/saga_go/world/%s.gd" % name)
			if s == null:
				continue
			var cm := s.get_script_constant_map()
			for k in cm:
				_walk_sites(cm[k], String(SITE_REGION_BY_NAME.get(k, region)))

## 지도 가장자리 길 칸(고개 — 이웃 지역과 이어지는 문·시간 틈 문이 서는 자리)도 평탄해야 한다.
static func _border_road_sites() -> void:
	for region in RELIEF_REGIONS:
		var rows: Array = TestMap.rows_of(region)
		for y in rows.size():
			var row: String = rows[y]
			for x in row.length():
				if row[x] != "=":
					continue
				if x == 0 or y == 0 or x == row.length() - 1 or y == rows.size() - 1:
					_add_site(region, Vector2(x, y))

static func _add_site(region: String, c: Vector2) -> void:
	if c.x < -0.5 or c.y < -0.5 or c.x > 12.5 or c.y > 12.5:
		return
	if not _sites.has(region):
		_sites[region] = {}
	var key := Vector2i(floori(c.x), floori(c.y))
	var arr: PackedVector2Array = (_sites[region] as Dictionary).get(key, PackedVector2Array())
	arr.append(c)
	(_sites[region] as Dictionary)[key] = arr

static func _walk_sites(v: Variant, region: String) -> void:
	if v is Vector2:
		_add_site(region, v)
	elif v is Vector2i:   # G-0122 — 손 놓은 칸 상수 대부분이 Vector2i(grid)인데 예전엔 버려 그 자리에 기복이 얹혔다
		_add_site(region, Vector2(v))
	elif v is Dictionary:
		var r := String(v.get("region", region))
		if not r in RELIEF_REGIONS:
			r = region
		for k in v:
			_walk_sites(v[k], r)
	elif v is Array:
		for e in v:
			_walk_sites(e, region)

## (칸 좌표 gx, gy — 칸 중심이 정수인 world_pos 좌표계) 에서 가장 가까운 손으로 놓은 자리까지의 칸 단위 거리(둘레 3×3 칸만 본다).
static func _site_dist_tiles(region: String, gx: float, gy: float) -> float:
	var grid: Dictionary = _sites.get(region, {})
	var best := 99.0
	var cx := floori(gx)
	var cy := floori(gy)
	for dy in [-1, 0, 1]:
		for dx in [-1, 0, 1]:
			var arr: PackedVector2Array = grid.get(Vector2i(cx + dx, cy + dy), PackedVector2Array())
			for c in arr:
				best = minf(best, Vector2(gx, gy).distance_to(c))
	return best

static func _relief(region: String, x: int, y: int, u: float, v: float) -> float:
	var ts := TestMap.tile_size_of(region)
	if _relief_noise == null:
		_relief_noise = FastNoiseLite.new()
		_relief_noise.seed = 20260930
		_relief_noise.frequency = 0.014
		_relief_noise.fractal_octaves = 2
	## 잦아듦은 "가장 가까운 비평지 칸까지의 거리"로 — 칸 변마다 따로 계산하면 이웃한 평지 두 칸이 모서리에서 다른 값을 내 이음에 틈이 났다.
	var f := 1.0
	var px := (x + u) * ts
	var pz := (y + v) * ts
	for dy in [-1, 0, 1]:
		for dx in [-1, 0, 1]:
			if TestMap.tile_at(x + dx, y + dy, region) in RELIEF_FLAT:
				continue
			var rx := maxf(maxf((x + dx) * ts - px, 0.0), px - (x + dx + 1) * ts)
			var rz := maxf(maxf((y + dy) * ts - pz, 0.0), pz - (y + dy + 1) * ts)
			f = minf(f, smoothstep(0.0, RELIEF_FADE_M, sqrt(rx * rx + rz * rz)))
	if f <= 0.0:
		return 0.0
	if not _sites_ready:
		_collect_sites()
	var dm := _site_dist_tiles(region, x + u - 0.5, y + v - 0.5) * ts
	f *= smoothstep(RELIEF_SITE_R, RELIEF_SITE_R + RELIEF_SITE_FADE, dm)
	if f <= 0.0:
		return 0.0
	## 지역마다 다른 결 — 지역 이름 해시로 잡음 위치를 옮긴다.
	var off := float(region.hash() & 0xffff)
	## 솟기만 한다(0~RELIEF_AMP) — 꺼지는 쪽은 물길·다리 높이(-1m 안팎)와 겹치고 기존 점검(물 아님·상자 높이)이 깨진다.
	return (_relief_noise.get_noise_2d((x + u) * ts + off, (y + v) * ts + off * 0.7) * 0.5 + 0.5) * RELIEF_AMP * f

static func _peak_noise() -> FastNoiseLite:
	if _noise == null:
		_noise = FastNoiseLite.new()
		_noise.seed = 20260923
		_noise.frequency = 0.035
		_noise.fractal_octaves = 3
	return _noise

## vegetation_builder.gd _hash() 와 같은 식(칸 좌표 결정적 해시).
static func _hash(gx: int, gy: int, salt: int) -> float:
	var h := (gx * 374761393) ^ (gy * 668265263) ^ (salt * 2246822519)
	h = (h ^ (h >> 13)) * 1274126177
	h = h ^ (h >> 16)
	return float(h & 0x7fffffff) / float(0x7fffffff)

# ---------------------------------------------------------------- 메시

## 칸마다 딱 잘린 단색 사각형을 따로 그리면 경계가 바둑판처럼 갈라져 보인다
## (2026-09-11, 사용자 실기 확인 지적). **한 장의 메시로 합쳐 모서리 쪽 색만
## 이웃 칸과 섞는다** — 칸을 SUB개로 쪼개 중심 쪽 EDGE_BLEND_MARGIN 안쪽은
## 제 색 그대로, 가장자리 쪽만 이웃과 번진다. 높이는 안 섞는다 — 높이가 다른
## 이웃과의 경계엔 _add_cliffs() 가 수직 옆면을 세운다.
func _build() -> void:
	var rows := TestMap.rows_of(region_id)

	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_custom_format(0, SurfaceTool.CUSTOM_RGBA8_UNORM)

	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			var ch: String = row[x]
			if not LEGEND.has(ch):
				push_warning("terrain_builder: 모르는 지형 글자 '%s'" % ch)
				continue
			var own_color: Color = color_of(region_id, ch)
			var col00 := _corner_color(rows, x, y)
			var col10 := _corner_color(rows, x + 1, y)
			var col01 := _corner_color(rows, x, y + 1)
			var col11 := _corner_color(rows, x + 1, y + 1)
			var surf := [surface_of(region_id, ch), _corner_color(rows, x, y, true), _corner_color(rows, x + 1, y, true),
				_corner_color(rows, x, y + 1, true), _corner_color(rows, x + 1, y + 1, true)]
			_add_tile_quads(st, x, y, own_color, col00, col10, col01, col11, surf)
			_add_cliffs(st, x, y)

	var mesh := st.commit()
	## PLAN 102-5 실물판 — 103 tilegen 잔디·흙·돌 3장을 쓰는
	## terrain_triplanar.gdshader(정점색·지형 판정은 그대로, 경사면은 돌).
	var mat := ShaderMaterial.new()
	mat.shader = load("res://saga_core/shaders/terrain_triplanar.gdshader")
	mat.set_shader_parameter("grass_albedo", load("res://assets/generated/tiles/grass_512.png"))
	mat.set_shader_parameter("grass_normal", load("res://assets/generated/tiles/grass_512_n.png"))
	mat.set_shader_parameter("grass_rough", load("res://assets/generated/tiles/grass_512_r.png"))
	mat.set_shader_parameter("dirt_albedo", load("res://assets/generated/tiles/dirt_512.png"))
	mat.set_shader_parameter("dirt_normal", load("res://assets/generated/tiles/dirt_512_n.png"))
	mat.set_shader_parameter("dirt_rough", load("res://assets/generated/tiles/dirt_512_r.png"))
	mat.set_shader_parameter("stone_albedo", load("res://assets/generated/tiles/stone_512.png"))
	mat.set_shader_parameter("stone_normal", load("res://assets/generated/tiles/stone_512_n.png"))
	mat.set_shader_parameter("stone_rough", load("res://assets/generated/tiles/stone_512_r.png"))
	mat.set_shader_parameter("hue_desat", float(REGION_TEX_DESAT.get(region_id, 0.0)))

	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.name = "Ground"
	mi.material_override = mat
	add_child(mi)

## 칸 하나를 SUB×SUB 조각으로 나눠 그린다. (u,v)는 칸 안의 상대 위치.
## 법선은 높이 함수의 차분으로 직접 구한다(generate_normals 를 쓰면 절벽
## 테두리 정점까지 뭉개져 가장자리 음영이 번진다).
func _add_tile_quads(st: SurfaceTool, x: int, y: int, own: Color,
		col00: Color, col10: Color, col01: Color, col11: Color, surf: Array) -> void:
	var center := TestMap.world_pos(x, y, region_id)
	var half := TestMap.tile_size_of(region_id) * 0.5
	var grid := _height_grid(x, y)
	for j in SUB:
		var v0 := float(j) / SUB
		var v1 := float(j + 1) / SUB
		for i in SUB:
			var u0 := float(i) / SUB
			var u1 := float(i + 1) / SUB

			var p00 := _grid_point(center, half, grid, i, j)
			var p10 := _grid_point(center, half, grid, i + 1, j)
			var p01 := _grid_point(center, half, grid, i, j + 1)
			var p11 := _grid_point(center, half, grid, i + 1, j + 1)

			var cc00 := _tile_vertex_color(own, col00, col10, col01, col11, u0, v0)
			var cc10 := _tile_vertex_color(own, col00, col10, col01, col11, u1, v0)
			var cc01 := _tile_vertex_color(own, col00, col10, col01, col11, u0, v1)
			var cc11 := _tile_vertex_color(own, col00, col10, col01, col11, u1, v1)
			var ss00 := _tile_vertex_color(surf[0], surf[1], surf[2], surf[3], surf[4], u0, v0)
			var ss10 := _tile_vertex_color(surf[0], surf[1], surf[2], surf[3], surf[4], u1, v0)
			var ss01 := _tile_vertex_color(surf[0], surf[1], surf[2], surf[3], surf[4], u0, v1)
			var ss11 := _tile_vertex_color(surf[0], surf[1], surf[2], surf[3], surf[4], u1, v1)

			var n00 := _grid_normal(grid, i, j)
			var n10 := _grid_normal(grid, i + 1, j)
			var n01 := _grid_normal(grid, i, j + 1)
			var n11 := _grid_normal(grid, i + 1, j + 1)

			# 위(+Y)에서 봤을 때 시계 방향 = Godot 의 앞면 — 00,10,11 / 00,11,01.
			# (2026-09-26 까지는 반시계 00,11,10 이라 땅 전체가 뒷면이었다. 셰이더가 cull_disabled 라 보이긴 했지만
			# 뒷면은 법선을 뒤집어 아래를 보게 해서 햇빛을 못 받고 하늘빛만 받았다 — 창 모드 촬영에서 발견.)
			st.set_normal(n00); st.set_color(cc00); st.set_custom(0, ss00); st.add_vertex(p00)
			st.set_normal(n10); st.set_color(cc10); st.set_custom(0, ss10); st.add_vertex(p10)
			st.set_normal(n11); st.set_color(cc11); st.set_custom(0, ss11); st.add_vertex(p11)

			st.set_normal(n00); st.set_color(cc00); st.set_custom(0, ss00); st.add_vertex(p00)
			st.set_normal(n11); st.set_color(cc11); st.set_custom(0, ss11); st.add_vertex(p11)
			st.set_normal(n01); st.set_color(cc01); st.set_custom(0, ss01); st.add_vertex(p01)

## 칸 하나의 높이를 (SUB+3)² 격자로 한 번만 구한다 — 바깥 한 줄(halo)은
## 법선 차분용(가장자리 밖은 봉우리 굴곡이 0 이라 기준 높이가 나온다).
func _height_grid(x: int, y: int) -> PackedFloat32Array:
	var n := SUB + 3
	var grid := PackedFloat32Array()
	grid.resize(n * n)
	for j in n:
		for i in n:
			grid[j * n + i] = vertex_height(region_id, x, y, float(i - 1) / SUB, float(j - 1) / SUB)
	return grid

func _grid_h(grid: PackedFloat32Array, i: int, j: int) -> float:
	return grid[(j + 1) * (SUB + 3) + (i + 1)]

func _grid_point(center: Vector3, half: float, grid: PackedFloat32Array, i: int, j: int) -> Vector3:
	var u := float(i) / SUB
	var v := float(j) / SUB
	return center + Vector3(lerp(-half, half, u), _grid_h(grid, i, j), lerp(-half, half, v))

func _grid_normal(grid: PackedFloat32Array, i: int, j: int) -> Vector3:
	var step := TestMap.tile_size_of(region_id) / SUB
	var hx := _grid_h(grid, i + 1, j) - _grid_h(grid, i - 1, j)
	var hz := _grid_h(grid, i, j + 1) - _grid_h(grid, i, j - 1)
	return Vector3(-hx, 2.0 * step, -hz).normalized()

## 이 칸이 이웃보다 높은 변마다 수직 옆면을 세운다(절벽·강둑). 봉우리
## 굴곡은 가장자리에서 0 이라 변의 높이는 늘 기준 높이 — 옆면은 사각형 한
## 장이면 틈 없이 맞는다. 지도 밖으로는 OUTER_SKIRT_Y 까지 내려 긋는다.
func _add_cliffs(st: SurfaceTool, x: int, y: int) -> void:
	st.set_custom(0, Color(0, 0, 0, 0)) # 옆면은 눈·얼음 없음(돌)
	var s := TestMap.size(region_id)
	var center := TestMap.world_pos(x, y, region_id)
	var half := TestMap.tile_size_of(region_id) * 0.5
	var top := tile_base_height(region_id, x, y)
	var own_ch := TestMap.tile_at(x, y, region_id)
	# (이웃 dx, dy, 변 시작 로컬, 변 끝 로컬, 바깥 법선)
	var edges := [
		[1, 0, Vector3(half, 0, -half), Vector3(half, 0, half), Vector3.RIGHT],
		[-1, 0, Vector3(-half, 0, half), Vector3(-half, 0, -half), Vector3.LEFT],
		[0, 1, Vector3(half, 0, half), Vector3(-half, 0, half), Vector3.BACK],
		[0, -1, Vector3(-half, 0, -half), Vector3(half, 0, -half), Vector3.FORWARD],
	]
	for e in edges:
		var nx: int = x + e[0]
		var ny: int = y + e[1]
		var outside := nx < 0 or ny < 0 or nx >= s.x or ny >= s.y
		var bottom := OUTER_SKIRT_Y if outside else tile_base_height(region_id, nx, ny)
		if outside:
			## 106장 ⑤ — 변 너머가 붙어 있는 다른 지역이면 그 칸 높이까지만.
			var probe: Vector3 = center + (e[4] as Vector3) * (half + 1.0)
			var other := TestMap.region_at(probe)
			if other != "" and other != region_id:
				var og := TestMap.grid_at(other, probe)
				bottom = tile_base_height(other, og.x, og.y)
		if top - bottom < 0.05:
			continue
		var a: Vector3 = center + e[2]
		var b: Vector3 = center + e[3]
		var n: Vector3 = e[4]
		## 2026-09-29 — 칸 사이 낮은 턱(길 0.1m 등)이 절벽 빛깔·돌로 칠해져 눈밭·풀밭에 검은 줄로 보였다(09-26 창 모드 촬영 ⑤).
		## 낮은 턱 옆면은 땅처럼 — 위를 보는 법선·그 칸 빛깔·그 칸 눈 표시. 모양(=충돌)은 그대로.
		if top - bottom < LOW_STEP_M:
			st.set_custom(0, surface_of(region_id, own_ch))
			var col := color_of(region_id, own_ch)
			var a0 := a + Vector3(0, bottom, 0)
			var b0 := b + Vector3(0, bottom, 0)
			var a1 := a + Vector3(0, top, 0)
			var b1 := b + Vector3(0, top, 0)
			for p in [a0, b0, b1, a0, b1, a1]:
				st.set_normal(Vector3.UP); st.set_color(col); st.add_vertex(p)
			st.set_custom(0, Color(0, 0, 0, 0))
			continue
		## 울퉁불퉁함은 산(^) 절벽에만 — 모래밭·길의 낮은 물가 둑은 평평하게.
		_add_cliff_face(st, a, b, bottom, top, n, CLIFF_JAG_M if TestMap.tile_at(x, y, region_id) == "^" else 0.0)

## 2026-09-28 "그래픽 먼저" — 절벽 한 변이 48m × 최대 30m 평판 하나라 멀리서 회색 상자 벽으로 보였다(창 모드 촬영).
## CLIFF_SEG_M 격자로 쪼개 **산 안쪽으로** 노이즈만큼 파고, 삼각형마다 제 법선(각진 바위 면)을 준다.
## 바깥으로 내밀면 절벽 곁에 붙여 둔 장치를 막았다 — 포구 조선소 기중기 다리와 절벽 사이 2.6m 틈이 닫혀 13장 오르기가 끼었다(probe_story3 ch13_climb).
## 안쪽으로만 파니 절벽 면은 원래 칸 경계보다 앞으로 나오지 않는다.
## 네 가장자리는 0 이라 윗면·이웃 변·땅과의 이음새는 그대로다. 기울기는 수직에서 ~25° 안 — 등반 판정(법선 y < 0.75)이 그대로 벽으로 본다.
## 충돌도 이 메시(trimesh)라 보이는 대로 붙는다.
func _add_cliff_face(st: SurfaceTool, a: Vector3, b: Vector3, bottom: float, top: float, n: Vector3, jag: float) -> void:
	var hs := maxi(2, ceili(a.distance_to(b) / CLIFF_SEG_M))
	var vs := maxi(1, ceili((top - bottom) / CLIFF_SEG_M))
	var pts: Array[Vector3] = []
	for j in vs + 1:
		var t := float(j) / float(vs)
		for i in hs + 1:
			var u := float(i) / float(hs)
			var p := a.lerp(b, u) + Vector3(0, lerpf(bottom, top, t), 0)
			var env := sqrt(sin(PI * u) * sin(PI * t))
			var nz := _peak_noise().get_noise_3d(p.x * 2.2, p.y * 2.8, p.z * 2.2) * 0.5 + 0.5
			pts.append(p - n * jag * env * nz)
	var w := hs + 1
	for j in vs:
		for i in hs:
			var p00 := pts[j * w + i]
			var p10 := pts[j * w + i + 1]
			var p01 := pts[(j + 1) * w + i]
			var p11 := pts[(j + 1) * w + i + 1]
			_cliff_tri(st, p01, p10, p11, n)
			_cliff_tri(st, p01, p00, p10, n)

func _cliff_tri(st: SurfaceTool, p0: Vector3, p1: Vector3, p2: Vector3, out: Vector3) -> void:
	var fn := (p1 - p0).cross(p2 - p0).normalized()
	if fn.dot(out) < 0.0:
		var tmp := p1
		p1 = p2
		p2 = tmp
		fn = -fn
	for p in [p0, p1, p2]:
		st.set_normal(fn); st.set_color(CLIFF_COLOR); st.add_vertex(p)

## (u,v) 자리의 실제 정점 색. 네 모서리 사이를 이중선형보간한 "이웃과 섞은
## 색"과 "제 색"을 가장자리까지 남은 거리(d)로 섞는다.
func _tile_vertex_color(own: Color, c00: Color, c10: Color, c01: Color, c11: Color,
		u: float, v: float) -> Color:
	var corner_blend := c00.lerp(c10, u).lerp(c01.lerp(c11, u), v)
	var d: float = min(min(u, 1.0 - u), min(v, 1.0 - v))
	var t: float = clamp((EDGE_BLEND_MARGIN - d) / EDGE_BLEND_MARGIN, 0.0, 1.0)
	return own.lerp(corner_blend, t)

## 격자 교차점(cx, cy)에 맞닿은 칸(최대 4개)의 색을 평균낸다. surface 면 색 대신 눈·얼음 표시를.
func _corner_color(rows: Array, cx: int, cy: int, surface := false) -> Color:
	var total := Color(0, 0, 0, 0)
	var n := 0
	for dy in [-1, 0]:
		for dx in [-1, 0]:
			var ty: int = cy + dy
			var tx: int = cx + dx
			if ty < 0 or ty >= rows.size():
				continue
			var row: String = rows[ty]
			if tx < 0 or tx >= row.length():
				continue
			var ch: String = row[tx]
			if not LEGEND.has(ch):
				continue
			total += surface_of(region_id, ch) if surface else color_of(region_id, ch)
			n += 1
	if n == 0:
		return Color(0, 0, 0)
	return total / float(n)

# ---------------------------------------------------------------- 물

## 강(~)·다리 밑(B) 칸 위에 반투명 수면을 한 겹 얹고, 같은 자리에 헤엄
## 판정용 Area3D 를 둔다(다리 밑은 널판이 칸 전체를 덮어 실제론 못 들어간다).
func _build_water() -> void:
	var rows := TestMap.rows_of(region_id)
	var tile_size := TestMap.tile_size_of(region_id)
	var positions: Array[Vector3] = []
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			var ch: String = row[x]
			if ch != "~" and ch != "B" and ch != "K":
				continue
			positions.append(TestMap.world_pos(x, y, region_id) + Vector3(0, WATER_LEVEL, 0))

	if positions.is_empty():
		return

	var quad := PlaneMesh.new()
	quad.size = Vector2(tile_size, tile_size)
	quad.subdivide_width = 7 # 잔물결(정점 흔들림)용
	quad.subdivide_depth = 7

	## PLAN 106장 ② — 반투명 단색 → 툰 물(깊이 두 단·물가 거품·흐르는 띠).
	var mat := ShaderMaterial.new()
	mat.shader = WATER_SHADER

	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = quad
	mm.instance_count = positions.size()

	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.name = "WaterSurface"
	mmi.material_override = mat
	add_child(mmi)

	for i in positions.size():
		mm.set_instance_transform(i, Transform3D(Basis(), positions[i]))

	var area := Area3D.new()
	area.name = "WaterVolume"
	area.collision_layer = WATER_LAYER
	area.collision_mask = 0
	area.monitoring = false
	area.add_to_group("water")
	area.set_meta("surface_y", WATER_LEVEL)
	add_child(area)
	var depth := WATER_LEVEL - LEGEND["~"].height
	for p in positions:
		var cs := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(tile_size, depth, tile_size)
		cs.shape = box
		cs.position = p - Vector3(0, depth * 0.5, 0)
		area.add_child(cs)

# ---------------------------------------------------------------- 절벽 윗바위

## 2026-09-29 "그래픽 먼저" — 산 절벽 윗선이 48m 칸 경계를 따라 자로 그은 직선이라 멀리서 잿빛 판자벽이었다(창 모드 v_cliff_*).
## 산(^) 칸의 5m 넘게 떨어지는 변마다 윗가장자리를 따라 각진 바위 덩이(폭 2.5~7m·높이 1.5~6.5m, 8.5m 남짓 간격)를 반쯤 묻어 얹는다.
## 지면과 같은 재질 — 위를 보는 면은 산 윗면 빛깔(서리봉은 눈 표시), 옆면은 절벽 빛깔이라 셰이더가 바위 판·틈을 그린다.
## **충돌 없음**(_build_collision 뒤에 짓는다) — 등반 꼭대기·활공·지역 점검이 보는 땅은 그대로다. 메시 하나라 draw call 1.
const RIM_ROCK_MIN_DROP := 5.0
const RIM_ROCK_GAP_M := 8.5

func _build_cliff_rocks() -> void:
	var ground := get_node_or_null("Ground") as MeshInstance3D
	if ground == null:
		return
	var rows := TestMap.rows_of(region_id)
	var s := TestMap.size(region_id)
	var half := TestMap.tile_size_of(region_id) * 0.5
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_custom_format(0, SurfaceTool.CUSTOM_RGBA8_UNORM)
	var count := 0
	for y in rows.size():
		for x in (rows[y] as String).length():
			if TestMap.tile_at(x, y, region_id) != "^":
				continue
			var center := TestMap.world_pos(x, y, region_id)
			var top := tile_base_height(region_id, x, y)
			var top_col := color_of(region_id, "^")
			var surf := surface_of(region_id, "^")
			var edges := [
				[1, 0, Vector3(half, 0, -half), Vector3(half, 0, half), Vector3.RIGHT],
				[-1, 0, Vector3(-half, 0, half), Vector3(-half, 0, -half), Vector3.LEFT],
				[0, 1, Vector3(half, 0, half), Vector3(-half, 0, half), Vector3.BACK],
				[0, -1, Vector3(-half, 0, -half), Vector3(half, 0, -half), Vector3.FORWARD],
			]
			for ei in edges.size():
				var e: Array = edges[ei]
				var nx: int = x + e[0]
				var ny: int = y + e[1]
				## 지도 바깥을 향한 변(테두리 산의 뒷면)은 안에서 안 보여 뺀다 — 붙은 지역이 있어도 그쪽 테두리 산이 가린다.
				if nx < 0 or ny < 0 or nx >= s.x or ny >= s.y:
					continue
				var bottom := tile_base_height(region_id, nx, ny)
				if top - bottom < RIM_ROCK_MIN_DROP:
					continue
				var a: Vector3 = center + e[2]
				var b: Vector3 = center + e[3]
				var n: Vector3 = e[4]
				var length := a.distance_to(b)
				var k := int(length / RIM_ROCK_GAP_M)
				for i in k:
					var salt := 5000 + ei * 97 + i * 13
					var u := (float(i) + 0.2 + 0.6 * _hash(x, y, salt)) / float(k)
					var w := lerpf(2.5, 7.0, pow(_hash(x, y, salt + 1), 1.5))
					var h := lerpf(1.5, 6.5, pow(_hash(x, y, salt + 2), 2.0))
					var d := lerpf(2.5, 4.5, _hash(x, y, salt + 3))
					var p := a.lerp(b, u) + Vector3(0, top + h * 0.2, 0) - n * d * 0.55
					var yaw := atan2(n.x, n.z) + (_hash(x, y, salt + 4) - 0.5) * 0.8
					var basis := Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, (_hash(x, y, salt + 5) - 0.5) * 0.35)
					_rock(st, p, Vector3(w, h, d) * 0.5, basis, top_col, surf, salt)
					count += 1
	if count == 0:
		return
	var mi := MeshInstance3D.new()
	mi.name = "CliffRocks"
	mi.mesh = st.commit()
	mi.material_override = ground.material_override
	## 그림자 패스(캐스케이드마다 다시 그림)를 빼면 삼각형이 크게 준다 — 절벽 위 바위의 그림자는 절벽 윗면에만 떨어져 거의 안 보인다.
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	## 지역 하나가 메시 하나 — 그 지역 한가운데서 380m 넘게 떨어지면(다른 지역에 있을 때) 안 그린다. 그 거리는 안개가 거의 덮는다.
	mi.visibility_range_end = 380.0
	add_child(mi)

## 각진 바위 하나 — 낮은 분할 구를 노이즈로 찌그러뜨리고 면마다 제 법선(평면 음영).
func _rock(st: SurfaceTool, c: Vector3, r: Vector3, basis: Basis, top_col: Color, surf: Color, salt: int) -> void:
	var segs := 5
	var rings := 3
	var pts: Array[Vector3] = []
	for j in rings + 1:
		var phi := PI * float(j) / float(rings)
		for i in segs:
			var th := TAU * (float(i) + 0.5 * float(j % 2) + (_hash(salt, i, j + 40) - 0.5) * 0.5) / float(segs)
			var dir := Vector3(sin(phi) * cos(th), cos(phi), sin(phi) * sin(th))
			var q := dir * r
			var nz := _peak_noise().get_noise_3d(q.x * 3.0 + salt, q.y * 3.0, q.z * 3.0) * 0.45 + (_hash(salt, j, i) - 0.5) * 0.3
			if j == rings:
				q.y *= 0.6 # 밑은 납작하게(묻히는 쪽)
			pts.append(c + basis * (q * (1.0 + nz)))
	for j in rings:
		for i in segs:
			var p00 := pts[j * segs + i]
			var p10 := pts[j * segs + (i + 1) % segs]
			var p01 := pts[(j + 1) * segs + i]
			var p11 := pts[(j + 1) * segs + (i + 1) % segs]
			_rock_tri(st, p00, p10, p11, c, top_col, surf)
			_rock_tri(st, p00, p11, p01, c, top_col, surf)

func _rock_tri(st: SurfaceTool, p0: Vector3, p1: Vector3, p2: Vector3, c: Vector3, top_col: Color, surf: Color) -> void:
	var fn := (p1 - p0).cross(p2 - p0)
	if fn.length_squared() < 1e-8:
		return
	fn = fn.normalized()
	if fn.dot((p0 + p1 + p2) / 3.0 - c) < 0.0:
		var tmp := p1
		p1 = p2
		p2 = tmp
		fn = -fn
	var up := fn.y > 0.55
	## Godot 은 시계 방향이 앞면이다 — 바깥에서 반시계인 채로 두면 뒷면으로 쳐서 cull_disabled 셰이더가 법선을 뒤집어(해 받는 면이 까맣게) 그린다.
	for p in [p0, p2, p1]:
		st.set_normal(fn)
		st.set_color(top_col if up else CLIFF_COLOR)
		st.set_custom(0, surf if up else Color(0, 0, 0, 0))
		st.add_vertex(p)

# ---------------------------------------------------------------- 충돌

## 보이는 지면 메시 그대로 trimesh 충돌을 만든다 — 절벽을 오르고 봉우리를
## 걷는 자리가 그림과 1:1 이다. 감김 방향에 기대지 않게 양면 충돌.
## 다리 널판은 메시에 없으니 예전 상자를 그대로 둔다.
func _build_collision() -> void:
	var body := StaticBody3D.new()
	body.name = "TerrainCollision"
	add_child(body)

	var ground := get_node_or_null("Ground") as MeshInstance3D
	if ground != null and ground.mesh != null:
		var shape := ground.mesh.create_trimesh_shape() as ConcavePolygonShape3D
		shape.backface_collision = true
		var cs := CollisionShape3D.new()
		cs.name = "GroundShape"
		cs.shape = shape
		body.add_child(cs)

	var rows := TestMap.rows_of(region_id)
	var tile_size := TestMap.tile_size_of(region_id)
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			if row[x] != "B":
				continue
			var bridge_top: float = LEGEND["B"].height + BRIDGE_CLEARANCE
			var box := BoxShape3D.new()
			## G-0115 — 칸 전체(48m)를 깔면 널판 옆 강물 위도 걸어졌다. 보이는 널판 폭만(길이는 칸 전체 — 양쪽 뭍까지 잇는다).
			box.size = Vector3(float(BRIDGE_WALK_WIDTH.get(region_id, tile_size)), 0.6, tile_size)
			var bcs := CollisionShape3D.new()
			bcs.shape = box
			bcs.position = TestMap.world_pos(x, y, region_id) + Vector3(0, bridge_top, 0)
			body.add_child(bcs)

## 지도 네 변 바깥에 보이지 않는 벽(BORDER_LAYER). 플레이어만 이 레이어를
## 본다(go_player.gd) — 카메라·등반 판정·다른 몸체는 레이어 1만 본다.
## 106장 ⑤ — 칸 단위로 세우고, 변 너머가 붙어 있는 다른 지역이면 비운다
## (그 지역 쪽 산 테두리가 자연 경계가 되고, 고개 칸으로 걸어서 넘어간다).
func _build_border() -> void:
	var s := TestMap.size(region_id)
	var half := TestMap.tile_size_of(region_id) * 0.5
	var t := BORDER_WALL_THICK
	var body := StaticBody3D.new()
	body.name = "BorderWalls"
	body.collision_layer = BORDER_LAYER
	body.collision_mask = 0
	add_child(body)
	var dirs := [Vector3.RIGHT, Vector3.LEFT, Vector3.BACK, Vector3.FORWARD]
	for y in s.y:
		for x in s.x:
			var center := TestMap.world_pos(x, y, region_id)
			for n in dirs:
				var nx: int = x + int(n.x)
				var ny: int = y + int(n.z)
				if nx >= 0 and ny >= 0 and nx < s.x and ny < s.y:
					continue
				var probe: Vector3 = center + n * (half + 1.0)
				var other := TestMap.region_at(probe)
				if other != "" and other != region_id:
					continue
				var box := BoxShape3D.new()
				var along := half * 2.0 + t * 2.0
				box.size = Vector3(t if n.x != 0 else along, BORDER_WALL_HEIGHT, along if n.x != 0 else t)
				var cs := CollisionShape3D.new()
				cs.shape = box
				cs.position = center + n * (half + t * 0.5) + Vector3(0, BORDER_WALL_HEIGHT * 0.5 - 10.0, 0)
				body.add_child(cs)
