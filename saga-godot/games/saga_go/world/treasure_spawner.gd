extends Node3D

## PLAN 106장 ⑥ — 세 지역에 보물 상자 16개(㊵ 과녁 잠금 둘을 더해 18). 원신 들판처럼 "걷다 보면 눈에 띄는 것"
## (평범) · "올라가야 닿는 것"(정교, 산 테두리 턱) · "무리를 쓸어야 풀리는 것"(적 무리 옆)
## · "원소로 푸는 것"(석등)을 섞었다. 자리는 글자 지도 칸(소수 = 칸 안 위치) — 칸 가운데를
## 쓰는 사건·발견 지점과 비껴 놓았다. test_village.gd 가 SaveState 로드와 FieldSpawner
## 뒤에 붙인다(camp 잠금이 적의 home 을 봐야 하고, 연 상자는 로드된 EventState 로 거른다).

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const TreasureChest := preload("res://games/saga_go/world/treasure_chest.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

## [id, 지역, 칸(소수 — 반올림한 정수 칸 안, 가운데에서 소수만큼 비킴), 등급, 잠금, 석등 원소 또는 과녁(target)]
const CHESTS := [
	## 마을 11×11
	["v_forest_w", "village", Vector2(1.2, 3.3), "common", "none", []],
	["v_forest_e", "village", Vector2(9.4, 6.4), "common", "none", []],
	["v_forest_s", "village", Vector2(1.7, 9.3), "common", "none", []],
	["v_ridge_n", "village", Vector2(3.0, 2.38), "exquisite", "none", []],   # (3,2) 산 남쪽 턱, 10~18m
	["v_ridge_river", "village", Vector2(7.0, 7.62), "exquisite", "none", []], # (7,8) 산 북쪽 턱 — 강을 헤엄쳐 건너 오른다
	["v_camp_bandit", "village", Vector2(9.05, 5.05), "precious", "camp", []], # 들판 무리 (9,5) 도적 둘
	["v_torch_ruin", "village", Vector2(7.0, 5.15), "luxurious", "torch", ["fire", "water", "thunder"]], # 동료 원소가 갖춰져야
	## 포구 9×9
	["c_sand_w", "coast", Vector2(1.4, 7.4), "common", "none", []],
	["c_sand_e", "coast", Vector2(6.5, 4.3), "common", "none", []],
	["c_ridge_s", "coast", Vector2(4.0, 7.62), "exquisite", "none", []],      # 남쪽 테두리 산 턱, 22~30m
	["c_camp_wolf", "coast", Vector2(2.05, 6.05), "precious", "camp", []],    # 들판 무리 (2,6) 늑대 둘
	## 106장 ㊵ 과녁 — 여섯째 칸이 과녁 [각도°(0 = 남쪽 +Z), 상자에서 m, 판 높이 m, 흔들림 m]
	["c_target_dune", "coast", Vector2(5.6, 5.4), "exquisite", "target", [[0, 9.0, 3.0, 0.0], [120, 11.0, 5.5, 0.0], [240, 10.0, 8.0, 0.0]]],
	## 폐허 7×7
	["r_floor_sw", "ruins", Vector2(1.4, 5.4), "common", "none", []],
	["r_floor_ne", "ruins", Vector2(4.7, 1.3), "common", "none", []],
	["r_ridge_e", "ruins", Vector2(5.62, 3.0), "exquisite", "none", []],      # (6,3) 동쪽 테두리 산 턱
	["r_torch_fire", "ruins", Vector2(3.0, 4.0), "precious", "torch", ["fire", "fire", "fire"]], # 주인공 혼자서도
	["r_target_court", "ruins", Vector2(3.9, 5.2), "precious", "target", [[60, 9.0, 4.0, 0.0], [180, 10.0, 6.5, 0.0], [300, 11.0, 5.0, 2.5]]], # 셋째는 떠서 오간다
	["r_camp_bandit", "ruins", Vector2(2.05, 2.05), "luxurious", "camp", []], # 들판 무리 (2,2) 도적 셋
	## 서리봉 고원 9×9(106장 ㊺)
	["f_snow_w", "frost", Vector2(1.4, 4.6), "common", "none", []],
	["f_snow_e", "frost", Vector2(6.4, 2.4), "common", "none", []],
	["f_ridge_n", "frost", Vector2(6.0, 1.38), "exquisite", "none", []],    # (6,1) 산 남쪽 턱 — 눈 덮인 벽 타기
	["f_camp_fox", "frost", Vector2(2.05, 3.05), "precious", "camp", []],   # 들판 무리 (2,3) 눈여우 셋
	["f_torch_lake", "frost", Vector2(4.4, 2.25), "luxurious", "torch", ["fire", "fire", "fire"]], # 얼음 호수 석등 — 불로 녹인다(주인공 혼자서도)
	## 은하 나루 9×9(106장 ㊽)
	["s_field_w", "skyport", Vector2(1.4, 4.2), "common", "none", []],
	["s_field_e", "skyport", Vector2(6.3, 4.4), "common", "none", []],
	["s_ridge_n", "skyport", Vector2(7.0, 1.38), "exquisite", "none", []],   # (7,1) 산 남쪽 턱 — 벽 타기
	["s_camp_cat", "skyport", Vector2(2.05, 2.05), "precious", "camp", []],  # 들판 무리 (2,2) 번개살쾡이 둘+매
	["s_torch_temple", "skyport", Vector2(2.1, 4.35), "luxurious", "torch", ["fire", "fire", "fire"]], # 옛 절터 석등(주인공 혼자서도)
	## 틈새 갈림길 9×9(106장 ㊾)
	["x_field_n", "crossing", Vector2(3.0, 2.2), "common", "none", []],
	["x_field_e", "crossing", Vector2(7.0, 4.6), "common", "none", []],
	["x_ridge_w", "crossing", Vector2(0.38, 5.0), "exquisite", "none", []],  # (0,5) 서쪽 테두리 산 턱 — 벽 타기
	["x_camp_fox", "crossing", Vector2(2.05, 2.05), "precious", "camp", []], # 들판 무리 (2,2) 눈여우 둘+매
	["x_torch_gate", "crossing", Vector2(3.4, 5.3), "luxurious", "torch", ["fire", "fire", "fire"]], # 뒤엉킨 성문 등롱(주인공 혼자서도)
	## 잠긴 도읍 9×9(106장 ㊿)
	["u_sand_n", "sunken", Vector2(3.6, 1.3), "common", "none", []],
	["u_sand_e", "sunken", Vector2(7.4, 3.2), "common", "none", []],
	["u_islet", "sunken", Vector2(7.15, 7.12), "exquisite", "none", []],      # 등대 바위섬 — 헤엄쳐서
	["u_camp_turtle", "sunken", Vector2(2.05, 2.05), "precious", "camp", []], # 들판 무리 (2,2) 물거북 둘+매
	["u_dome", "sunken", Vector2(4.75, 5.85), "luxurious", "none", []],       # 빛 돔 안 마른 바닥 — 22장 문 자물쇠를 지켜 내야
	## 굳은 거리 9×9(106장 53)
	["a_street", "amber", Vector2(5.4, 6.2), "common", "none", []],
	["a_road", "amber", Vector2(2.4, 6.3), "common", "none", []],
	["a_ridge_n", "amber", Vector2(6.0, 0.38), "exquisite", "none", []],    # (6,0) 북쪽 테두리 산 턱 — 벽 타기
	["a_camp_bear", "amber", Vector2(1.05, 6.05), "precious", "camp", []],  # 들판 무리 (1,6) 바위곰+살쾡이
	["a_torch_market", "amber", Vector2(2.3, 4.3), "luxurious", "torch", ["fire", "fire", "fire"]], # 장터 좌판 등(주인공 혼자서도)
	## 갈무리 벌 9×9(106장 54)
	["g_field", "vault", Vector2(2.3, 2.2), "common", "none", []],
	["g_yard", "vault", Vector2(7.0, 5.3), "common", "none", []],
	["g_ridge_n", "vault", Vector2(2.0, 0.38), "exquisite", "none", []],   # (2,0) 북쪽 테두리 산 턱 — 벽 타기
	["g_camp_hawk", "vault", Vector2(1.05, 2.05), "precious", "camp", []], # 들판 무리 (1,2) 매+살쾡이
	["g_torch_granary", "vault", Vector2(2.3, 5.3), "luxurious", "torch", ["fire", "fire", "fire"]], # 곳간 마을 등(주인공 혼자서도)
	## 세갈래 고을 9×9(106장 55)
	["h_road", "fork", Vector2(1.9, 3.3), "common", "none", []],
	["h_works", "fork", Vector2(6.9, 5.4), "common", "none", []],
	["h_ridge_n", "fork", Vector2(6.0, 0.38), "exquisite", "none", []],   # (6,0) 북쪽 테두리 산 턱 — 벽 타기
	["h_camp_imp", "fork", Vector2(2.05, 2.05), "precious", "camp", []],  # 들판 무리 (2,2) 도깨비+곰
	["h_torch_forge", "fork", Vector2(3.3, 5.8), "luxurious", "torch", ["fire", "fire", "fire"]], # 대장간 앞 고을 등(주인공 혼자서도)
]


func _ready() -> void:
	for row in CHESTS:
		var id: String = row[0]
		if EventState.is_resolved("chest_" + id):
			continue
		var region: String = row[1]
		var g: Vector2 = row[2]
		var pos := TestMap.world_pos(g.x, g.y, region)
		pos.y = TerrainBuilder.height_at(region, pos) - 0.03
		var c := TreasureChest.new()
		c.name = "Chest_" + id
		c.setup(id, row[3], row[4], region, pos, row[5])
		## 상자 앞(+Z)이 지역 가운데를 보게 — 산 턱 상자가 절벽 쪽으로 등을 돌린다.
		var center := TestMap.origin_of(region)
		c.rotation.y = atan2(center.x - pos.x, center.z - pos.z)
		c.opened.connect(_on_opened)
		add_child(c)


func _on_opened(chest: Node3D) -> void:
	var g: Dictionary = TreasureChest.GRADES[chest.get("grade")]
	Toast.show(self, "✦ %s — 경험치 +%d  (보물 %d/%d)" % [g.name, int(g.exp), opened_count(), total()], TreasureChest.TOAST_SEC)


## 지금까지 연 상자 수(EventState 의 "chest_" 항목).
static func opened_count() -> int:
	var n := 0
	for key in EventState.resolved:
		if key.begins_with("chest_"):
			n += 1
	return n


static func total() -> int:
	return CHESTS.size()
