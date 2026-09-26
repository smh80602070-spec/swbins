extends RefCounted

## VERTICAL_SLICE.md 27절의 테스트 지역. saga-go 웹판 js/land.js의 글자 지도
## 방식을 그대로 따른다 — 좌표가 아니라 눈으로 읽는 그림으로 지형을 정의한다.
##
## 2026-09-11㉒ — 사용자 지시로 7×7(336m 사방, 웹판 21×21=1008m의 1/3)에서
## 11×11(528m 사방, 웹판의 절반쯤)로 넓혔다. VERTICAL_SLICE.md 27절 자체가
## "축소해 시작해 검증 후 넓힌다"고 이미 적어 뒀던 다음 단계다(가볍게 결정할
## 일은 아니라고 미뤄 뒀었는데, 사용자가 지금 하기로 결정).
##
## **기존 마을·사건 배치는 그대로 두고 사방에 2칸씩 테를 둘렀다** — 새
## 좌표는 옛 좌표 + (2,2)다. 이렇게 대칭으로 넓히면 마을의 월드 좌표(원점
## 기준)는 하나도 안 바뀐다(world_pos()가 칸 수 절반을 원점으로 잡는 공식이라,
## 안쪽 내용물과 칸 수를 함께 +2 밀면 상대 위치가 정확히 그대로 남는다) —
## 그래서 Player.tscn 스폰 위치 등 월드 좌표를 쓰는 자리는 하나도 안 고쳤다.
## 격자 좌표를 쓰는 자리(TestVillage.tscn의 사건 노드 grid, npc_builder.gd의
## VILLAGERS grid, landmarks_builder.gd의 굴/마을/폐허/다리 좌표)는 전부
## +2,+2로 옮겼다.
##
## 새로 두른 테에 §27이 원래 요구했지만 옛 7×7엔 없었던 것도 채웠다 — "논밭
## 약간"(F, 남쪽 (8,9)(9,9))과 도감에 있었지만 안 쓰던 S(옛 사당, 북서쪽
## 숲 모퉁이 (2,1)). 새 지형 글자를 추가한 게 아니라 원래 LEGEND에 있었는데
## 안 쓰던 걸 처음 쓴 것이다(terrain_builder.gd 참고).
##
## ^ 산   T 숲   ~ 강   = 길   H 마을   F 논밭   . 들
## C 굴 입구   S 옛 사당   R 폐허   B 다리   W 폭포
##
## 2026-09-12⑩ — 산 타일 하나(옛 (8,3))를 폭포(W)로 바꿨다. 굴(C)이 산을
## 파고든 것과 같은 방식 — 새 칸을 늘리지 않고 기존 산 자리 하나를 깎았다.
const ROWS := [
	"^^^^^=^^^^^",
	"^TS^^=^^TT^",
	"TT^^^C^^^TT",
	"TT^TT=TTWTT",
	"TTT..=..TTT",
	"TTT.HH.RTTT",
	"TTT..=..TTT",
	"~~~~~B~~~~~",
	"^^^^^=^^^^^",
	"^TT^^=^^FF^",
	"^^^^^=^^^^^",
]

const TILE_SIZE := 48.0

## 2026-09-16, GO "진짜 두 번째 지역" 착수 — region2_coast.gd가 지금까지
## primitive(PlaneMesh 사각형+박스 벽)로 자급자족하던 포구를, 마을과 같은
## 글자 지도+terrain_builder.gd 파이프라인으로 다시 짓는다. 이 파일을
## 마을 하나만 아는 상태에서 **여러 지역을 아는 레지스트리**로 넓히되,
## 기존 정적 API(ROWS·TILE_SIZE 상수, 인자 없는 size()/tile_at()/world_pos())는
## 전부 그대로 남긴다(마을 쪽 호출부 전부가 여전히 이 형태로 부른다) — 새
## `region_id` 인자를 덧붙이는 오버로드만 얹는다(기본값 "village" = 지금
## ROWS 그대로, 딱 하나뿐이던 지역).
##
## 지역마다 원점이 다르다(region2_coast.gd REGION_ORIGIN=(8000,0,0)과 같은
## 발상 — 마을 지형과 절대 안 겹치는 먼 좌표). 마을은 원점 0 그대로라
## 기존 월드 좌표(Player.tscn 스폰 등)가 하나도 안 바뀐다.
const REGIONS := {
	"village": {"rows": ROWS, "tile_size": TILE_SIZE, "origin": Vector3.ZERO},
	## "coast" — region2_coast.gd 참고. 9×9(432m 사방, 마을 11×11의 8할쯤).
	## 북쪽은 바다(~, 통행 불가 — 마을의 강과 같은 규칙), 남쪽은 모래밭(D,
	## 새 지형 글자 — terrain_builder.gd LEGEND에 추가), 가운데 한 칸(B,
	## 다리)이 물가에서 모래로 건너오는 선착장 자리다. 사방 산(^) 테두리로
	## 막는다 — 마을과 같은 원칙(다리로만 강을 건너듯, 여긴 애초에 물에
	## 접한 칸이 딱 하나뿐이라 건널 필요조차 없다, 선착장은 순수 장식+
	## 발견 지점).
	## 106장 ㊲ — (6,2) K = 앞바다 바위섬(칸 가운데 = 칸 좌표 (6.0,2.0))(terrain_builder ISLET_*, 이야기 8장 다섯째 제단). 둥근 둔덕이라 칸 가장자리는 바다 밑과 같은 높이.
	"coast": {
		"rows": [
			"^^^^^^^^^",
			"^~~~~~~~^",
			"^~~~~~K~^",
			"^~~~B~~~^",
			"^DDDDDDD^",
			"DDDDDDDD^",
			"^DDDDDDD^",
			"^DDDDDDD^",
			"^D^^^^^^^",
		],
		"tile_size": TILE_SIZE,
		## PLAN 106장 ⑤ — 마을 동쪽 변(x=240)에 서쪽 변을 붙였다. (0,5) 모래 한 칸이
		## 마을 (10,6) 숲과 맞닿는 고개다(옛 원점 8000m, 순간이동으로만 오갔다).
		## 106장 ㊿ — (1,8) 산을 모래 고개로 — 남쪽 잠긴 도읍 (1,0) 과 맞닿는다.
		"origin": Vector3(480.0, 0.0, 0.0),
	},
	## "ruins" — region3_ruins.gd 참고. 2026-09-16, GO 진짜 세 번째 지역
	## (REGIONS 레지스트리 재설계의 실제 payoff — 새 항목 하나 + 새 파일
	## 하나면 됐다는 게 이번에 실제로 확인됐다). 7×7, 물이 아예 없어
	## terrain_builder.gd _build_water()는 할 일이 없다(강이 하나도
	## 없으니 안전하게 지나간다). R(폐허 바닥)이 주가 되고 T(숲)를
	## 군데군데 섞었다 — 사방은 마을·포구와 같은 산(^) 테두리. 원점을
	## 아예 다른 축(Z)으로 멀리 둬 절대 안 겹친다.
	"ruins": {
		"rows": [
			"^^^=^^^",
			"^RRRRR^",
			"^RTRTR^",
			"^RRRRR^",
			"^RTRTR^",
			"^RRRRR^",
			"^^^^^^^",
		],
		"tile_size": TILE_SIZE,
		## PLAN 106장 ⑤ — 마을 남쪽 변(z=240)에 북쪽 변을 붙였다. (3,0) 길 한 칸이
		## 마을 (5,10) 길과 이어지는 산 사이 고개다(옛 원점 z 8000m).
		"origin": Vector3(0.0, 0.0, 432.0),
	},
	## "frost" — PLAN 106장 ㊺ 이야기 2부 무대, 넷째 지역 "서리봉 고원"(world/region4_frost.gd). 9×9.
	## 마을 북쪽 변(z=-288)에 남쪽 변을 붙였다 — (4,8) 길 한 칸이 마을 (5,0) 북쪽 산길 어귀(돌무더기)와
	## 이어지는 고개다. N 눈밭 · I 얼어붙은 호수(걸을 수 있음) · T 침엽수 숲 · R 옛 산성 터.
	## 과거(옛 산성)·현대(기상 관측소)·미래(추락한 비행선)가 한 고원에(SAGA-DESIGN §12 전체 퓨전).
	"frost": {
		"rows": [
			"^^^^^^^^^",
			"^^NNNN^^^",
			"^NNIINNT^",
			"^TNNNNNN^",
			"^NNR=NNT^",
			"^NNN=NNN^",
			"^TNN=NTN^",
			"^^NN=NN^^",
			"^^^^=^^^^",
		],
		"tile_size": TILE_SIZE,
		"origin": Vector3(0.0, 0.0, -480.0),
	},
	## "skyport" — PLAN 106장 ㊽ 이야기 4부 무대, 다섯째 지역 "은하 나루"(world/region5_skyport.gd). 9×9.
	## 마을 서쪽 변(x=−264)에 동쪽 변을 붙였다(포구의 거울 자리) — (8,3) 길 한 칸이 마을 (0,4) 숲 칸과 맞닿는 틈 고개다
	## (15장을 마치기 전엔 시간 틈 문이 막는다). M 별배 나루 금속 바닥 · R 옛 절터 · H 은하역 · F 태양광 밭.
	## 미래(나루)가 중심, 과거(절터)·현대(역·전지판)가 한 땅에(SAGA-DESIGN §13 전체 퓨전).
	"skyport": {
		"rows": [
			"^^^^^^^^^",
			"^TT.MMM^^",
			"^T...MM.^",
			"^.RR..===",
			"^.RR.=.T^",
			"^T..=H..^",
			"^..FF=.T^",
			"^^T..=^^^",
			"^^^^^=^^^",
		],
		"tile_size": TILE_SIZE,
		"origin": Vector3(-480.0, 0.0, 0.0),
	},
	## "crossing" — PLAN 106장 ㊾ 이야기 5부 무대, 여섯째 지역 "틈새 갈림길"(world/region6_crossing.gd). 9×9.
	## 은하 나루 남쪽 변(z=192)에 북쪽 변을 붙였다 — 은하역 선로가 나루 (5,8) 고개를 지나 이 지역 (5,0) 선로 칸으로 이어진다
	## (4부를 마치기 전엔 시간 틈 문이 막는다). 동쪽 끝 (8,0) 은 마을 (0,10) 산과 맞닿아 산으로 둔다.
	## H 첫 정거장 · R 뒤엉킨 성문 · M 떠 있는 섬돌 틈 수정 바닥. 시간 틈 안쪽 — 과거·현대·미래가 가장 심하게 뒤엉킨 땅.
	"crossing": {
		"rows": [
			"^^^^^=^^^",
			"^T.T.=.T^",
			"^...TH..^",
			"^T...=.T^",
			"^.RR.=..^",
			"^TRR.=..^",
			"^....=..^",
			"^TMM...T^",
			"^^^^^^^^^",
		],
		"tile_size": TILE_SIZE,
		"origin": Vector3(-480.0, 0.0, 432.0),
	},
	## "sunken" — PLAN 106장 ㊿ 이야기 6부 무대, 일곱째 지역 "잠긴 도읍"(world/region7_sunken.gd). 9×9.
	## 포구 남쪽 변(z=192)에 북쪽 변을 붙였다(틈새 갈림길의 거울 자리) — 포구 (1,8) 모래 고개가 이 지역 (1,0) 과 이어진다
	## (5부를 마치기 전엔 해무가 막는다). 북쪽 모래밭 · 가운데~남쪽 바다(~, 헤엄) · U 빛 돔 안 마른 바닥(−10, 물 없음) · K 옛 등대 바위섬.
	## 틈이 닫히며 바다 밑에 굳은 시대 조각 — 과거(잠긴 궁궐)·현대(해저 연구 기지·잠수정 선착장)·미래(빛 돔)가 한 바다에.
	"sunken": {
		"rows": [
			"^D^^^^^^^",
			"^DDDDDTT^",
			"^TDDDDDD^",
			"^DD~~~DD^",
			"^~~~~~~~^",
			"^~~~~~~~^",
			"^~~~~U~~^",
			"^~~~~~~K^",
			"^^^^^^^^^",
		],
		"tile_size": TILE_SIZE,
		"origin": Vector3(480.0, 0.0, 432.0),
	},
}

## region_id 오타 하나가 "Invalid get index 'rows' (on base: 'Nil')" 같은
## 엉뚱한 자리의 에러 대신 여기서 곧바로 분명한 메시지로 걸리게 한다
## (2026-09-16, GO 진짜 두 번째 지역 재감사 — 지금은 호출부가 "village"·
## "coast" 둘뿐이라 실제 버그는 아니지만, 지역이 늘수록 오타 위험도 는다).
## 월드 좌표가 어느 지역 격자 안인지(없으면 ""). 지역을 붙인 뒤(106장 ⑤)
## 경계벽·절벽 옆면이 "옆 지역과 맞닿은 변"을 알아야 해서 생겼다.
static func region_at(world: Vector3) -> String:
	for id in REGIONS:
		var s := size(id)
		var ts: float = tile_size_of(id)
		var local: Vector3 = world - origin_of(id)
		var gx := local.x / ts + s.x * 0.5 + 0.5
		var gy := local.z / ts + s.y * 0.5 + 0.5
		if gx >= 0.0 and gy >= 0.0 and gx < s.x and gy < s.y:
			return id
	return ""

## 월드 좌표 → 그 지역의 칸(region_at 이 돌려준 지역 기준).
static func grid_at(region_id: String, world: Vector3) -> Vector2i:
	var s := size(region_id)
	var ts: float = tile_size_of(region_id)
	var local: Vector3 = world - origin_of(region_id)
	return Vector2i(int(floor(local.x / ts + s.x * 0.5 + 0.5)), int(floor(local.z / ts + s.y * 0.5 + 0.5)))

static func _region(region_id: String) -> Dictionary:
	if not REGIONS.has(region_id):
		push_error("test_map.gd: 모르는 region_id '%s'" % region_id)
		return REGIONS["village"]
	return REGIONS[region_id]

static func rows_of(region_id: String = "village") -> Array:
	return _region(region_id).rows

static func tile_size_of(region_id: String = "village") -> float:
	return _region(region_id).tile_size

static func origin_of(region_id: String = "village") -> Vector3:
	return _region(region_id).origin

static func size(region_id: String = "village") -> Vector2i:
	var rows: Array = rows_of(region_id)
	return Vector2i(String(rows[0]).length(), rows.size())

static func tile_at(grid_x: int, grid_y: int, region_id: String = "village") -> String:
	var rows: Array = rows_of(region_id)
	if grid_y < 0 or grid_y >= rows.size():
		return "^"
	var row: String = rows[grid_y]
	if grid_x < 0 or grid_x >= row.length():
		return "^"
	return row[grid_x]

## 격자 좌표 → 월드 좌표(각 지역 원점 기준, 지역 안에서는 중심이 그 원점).
## land.js와 같은 규칙 — 지도의 그림과 걷는 자리가 같은 칸 크기를 쓴다.
static func world_pos(grid_x: float, grid_y: float, region_id: String = "village") -> Vector3:
	var s := size(region_id)
	var tile_size: float = tile_size_of(region_id)
	var half_w := s.x * 0.5
	var half_h := s.y * 0.5
	return origin_of(region_id) + Vector3((grid_x - half_w) * tile_size, 0.0, (grid_y - half_h) * tile_size)
