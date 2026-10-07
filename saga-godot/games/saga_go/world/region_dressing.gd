extends Node3D

## G-0038 — 휑한 지역 꾸밈(굳은 거리·갈무리 벌·세갈래 고을). 이미 있는 `assets/world/<id>.glb` 소품을 지역의 시대 결에 맞춰 무리로 깐다.
## 지역 스크립트(region8_amber·region9_vault·region10_fork)가 `_ready` 에서 region_id 를 정해 자식으로 붙인다 — 그 부모 스크립트의 상수
## (DISCOVERIES·SMALL·*_CELL 등)와 아래 SCAN 표들(순간이동·들판 무리·상자·별조각·채집·NPC·이야기 자리)에서 그 지역 칸을 모아 둘레를 비운다.
## 놓는 규칙(점검 probe_dressing 이 그대로 다시 잰다):
##   · 산(^)·길(=) 칸 밖. 큰 것(solid)은 발판 네 모서리가 다 그 밖.
##   · 표 자리 둘레 밖 — 작은 것 KEEP_CLUTTER m, 큰 것 KEEP_SOLID m (+ 제 반지름).
##   · 서로 안 겹침(반지름 합 + GAP). 땅 높이에 앉힘(큰 것은 네 모서리 중 낮은 쪽 — 뜨지 않게 조금 묻힘).
## 그리기: GLB 를 합친 메시로(region_loader.gd 와 같은 GLBUtils.extract_mesh) 종류당 MultiMesh 하나 · 보이는 거리 VIS_END · 키 1.2m 밑은 그림자 끔.
## 큰 것은 상자 충돌(StaticBody3D 하나에 모양 여럿). 씨앗 고정(지역 이름 + 20260824) — 매번 같은 자리.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const GLBUtils := preload("res://saga_core/world/glb_utils.gd")

const DIR := "res://assets/world/"
const VIS_END := 220.0
const KEEP_CLUTTER := 5.0
const KEEP_SOLID := 12.0
const GAP := 0.6
const SHADOW_MIN_H := 1.2
const TRIES := 14

## 큰 것(충돌 상자를 준다). 나머지는 보기만.
const SOLID := ["barn_01", "caravan_wagon_01", "jp_minka_01", "silkroad_house_01", "chinese_hall_01", "tent_large_01", "inn_01", "future_dome_01",   # G-0062
	"modern_block_01", "hanok_01", "haystack_01", "crate_stack_01", "ox_cart_01", "sack_pile_01", "street_lamp_01",
	"stone_lantern_01", "signal_pylon_01", "notice_board_01", "rubble_wall_01", "mine_cart_01", "handcart_01", "well_01", "scarecrow_01"]

## 표 자리를 모을 스크립트(상수만 읽는다) — Dictionary {"region": R, "cell": Vector2} 또는 R 과 Vector2(i) 가 같이 든 배열.
const SCAN := [
	"res://games/saga_go/world/waypoints.gd", "res://games/saga_go/combat/field_spawner.gd", "res://games/saga_go/world/treasure_spawner.gd",
	"res://games/saga_go/world/star_shards.gd", "res://games/saga_go/data/cooking.gd", "res://games/saga_go/data/story.gd",
	"res://games/saga_go/data/story_chapters_3.gd", "res://games/saga_go/data/story_chapters_4.gd", "res://games/saga_go/data/night_echoes.gd",
	"res://games/saga_go/data/domains.gd",
]

## 지역별 무리. ["c", 종류, 칸 중심, 개수, 반지름 m] = 원 안에 흩음 · ["l", 종류, 칸 a, 칸 b, 간격 m] = 줄(길 옆 등, 줄을 보게 돌림).
const PLAN := {
	"amber": [
		# 현대 번화가 — 길(x=3) 양옆 건물 줄·동쪽 가로등 줄 · 네거리 둘레 벤치·우체통·게시판 · 남동 빈터에도 건물
		["l", "modern_block_01", Vector2(2.05, 4.6), Vector2(2.05, 7.4), 20.0],
		["l", "modern_block_01", Vector2(3.95, 5.3), Vector2(3.95, 7.4), 20.0],
		["l", "street_lamp_01", Vector2(3.55, 4.0), Vector2(3.55, 7.4), 14.0],
		["l", "street_lamp_01", Vector2(4.6, 2.6), Vector2(6.6, 2.6), 16.0],
		["c", "modern_block_01", Vector2(6.0, 6.6), 3, 40.0],
		["c", "bench_01", Vector2(4.6, 4.8), 14, 50.0],
		["c", "mailbox_01", Vector2(4.8, 5.2), 6, 50.0],
		["c", "notice_board_01", Vector2(4.4, 3.6), 4, 40.0],
		["c", "crate_stack_01", Vector2(5.6, 4.0), 8, 46.0],
		["c", "barrel_01", Vector2(5.4, 5.6), 8, 50.0],
		# 과거 장터 — 짐 더미
		["c", "sack_pile_01", Vector2(1.6, 3.8), 8, 40.0],
		["c", "jar_01", Vector2(1.4, 4.2), 16, 40.0],
		["c", "barrel_01", Vector2(2.0, 3.4), 10, 40.0],
		["c", "handcart_01", Vector2(2.2, 4.4), 4, 40.0],
		["c", "crate_small_01", Vector2(1.8, 3.6), 14, 36.0],
		# 미래 탑 둘레
		["c", "signal_pylon_01", Vector2(4.6, 1.8), 8, 56.0],
		["c", "holo_panel_01", Vector2(3.6, 1.8), 8, 48.0],
		["c", "terminal_01", Vector2(5.0, 1.6), 6, 48.0],
		# 셋이 섞인 거리 — 무너진 담·바위·덤불
		["c", "rubble_wall_01", Vector2(5.6, 5.8), 6, 70.0],
		["c", "rubble_pillar_01", Vector2(2.4, 6.2), 6, 60.0],
		["c", "rock_small_01", Vector2(4.0, 4.0), 30, 170.0],
		["c", "bush_01", Vector2(4.0, 4.0), 24, 170.0],
		["c", "bush_02", Vector2(4.0, 4.0), 20, 170.0],
		# G-0062 — 과거 장터 주막 · 미래 탑 둥근 지붕·홀로 지구본
		["c", "inn_01", Vector2(1.4, 4.8), 1, 50.0],
		["c", "future_dome_01", Vector2(5.6, 1.4), 1, 50.0],
		["c", "hologram_globe_01", Vector2(4.2, 1.6), 3, 40.0],
	],
	"vault": [
		# 과거 곳간 마을·밭
		["c", "haystack_01", Vector2(2.4, 6.4), 9, 46.0],
		["c", "scarecrow_01", Vector2(2.6, 7.0), 3, 30.0],
		["c", "vegetable_row_01", Vector2(2.4, 7.0), 20, 36.0],
		["l", "wood_fence_01", Vector2(1.6, 7.4), Vector2(3.4, 7.4), 3.8],
		["c", "jar_01", Vector2(1.2, 5.0), 14, 34.0],
		["c", "keg_01", Vector2(1.8, 5.8), 8, 34.0],
		["c", "ox_cart_01", Vector2(2.6, 5.6), 2, 34.0],
		["c", "log_01", Vector2(1.6, 6.2), 8, 40.0],
		["c", "sack_pile_01", Vector2(2.0, 5.2), 5, 34.0],
		# 현대 야적장 — 궤짝·광차·통·자루
		["c", "crate_stack_01", Vector2(6.4, 4.6), 16, 56.0],
		["c", "crate_small_01", Vector2(6.0, 5.2), 16, 50.0],
		["c", "mine_cart_01", Vector2(6.8, 4.2), 5, 46.0],
		["c", "barrel_01", Vector2(5.8, 4.4), 12, 50.0],
		["c", "sack_pile_01", Vector2(6.8, 5.4), 5, 40.0],
		["l", "street_lamp_01", Vector2(4.6, 3.6), Vector2(4.6, 6.4), 18.0],
		["l", "street_lamp_01", Vector2(0.6, 2.45), Vector2(3.4, 2.45), 20.0],
		# 미래 금고 앞
		["c", "terminal_01", Vector2(4.0, 2.4), 6, 44.0],
		["c", "holo_panel_01", Vector2(3.2, 2.0), 6, 44.0],
		["c", "signal_pylon_01", Vector2(5.2, 2.2), 6, 50.0],
		# 벌판
		["c", "rock_small_01", Vector2(4.0, 4.0), 26, 170.0],
		["c", "bush_01", Vector2(4.0, 4.0), 24, 170.0],
		["c", "stump_01", Vector2(3.0, 4.6), 10, 100.0],
		["c", "haystack_01", Vector2(5.4, 6.8), 4, 50.0],
		# G-0062 — 밭에 밀(자람·새싹) · 곳간 · 짐수레 · 모닥불 · 이정표
		["c", "wheat_growing_01", Vector2(2.0, 7.0), 16, 40.0],
		["c", "wheat_sprout_01", Vector2(2.8, 7.2), 12, 36.0],
		["c", "barn_01", Vector2(5.8, 7.0), 1, 80.0],   # 마을 서쪽은 빈터가 좁아 남동 벌판(볏가리 곁)
		["c", "caravan_wagon_01", Vector2(3.0, 5.4), 1, 40.0],
		["c", "campfire_logs_01", Vector2(5.4, 6.4), 2, 40.0],
		["c", "signpost_01", Vector2(3.4, 3.2), 2, 50.0],
	],
	"fork": [
		# 옛 고을 마당 — 한옥·장독·돌담·볏가리
		["c", "hanok_01", Vector2(2.2, 4.8), 8, 90.0],
		["c", "hanok_01", Vector2(2.6, 2.0), 2, 40.0],
		["c", "jar_01", Vector2(2.0, 4.4), 22, 70.0],
		["c", "low_stone_wall_01", Vector2(2.2, 4.8), 22, 80.0],
		["c", "haystack_01", Vector2(1.6, 5.6), 6, 50.0],
		["c", "wood_fence_01", Vector2(2.6, 2.2), 8, 36.0],
		["c", "well_01", Vector2(1.6, 4.2), 1, 30.0],
		["c", "ox_cart_01", Vector2(3.0, 6.2), 2, 30.0],
		# 세 갈래 길 — 석등 줄(성문길·종루길 동쪽, 역참길 남쪽)
		["l", "stone_lantern_01", Vector2(4.55, 4.4), Vector2(4.55, 7.6), 18.0],
		["l", "stone_lantern_01", Vector2(3.45, 4.4), Vector2(3.45, 7.6), 18.0],
		["l", "stone_lantern_01", Vector2(4.55, 1.2), Vector2(4.55, 2.6), 18.0],
		["l", "stone_lantern_01", Vector2(1.2, 3.55), Vector2(3.4, 3.55), 18.0],
		# 현대 선로 공사장
		["c", "mine_cart_01", Vector2(6.6, 4.4), 6, 46.0],
		["c", "log_01", Vector2(6.2, 5.0), 12, 46.0],
		["c", "crate_stack_01", Vector2(6.8, 5.2), 8, 46.0],
		["c", "barrel_01", Vector2(5.8, 4.2), 8, 46.0],
		["c", "sack_pile_01", Vector2(6.4, 2.6), 6, 44.0],
		["c", "signal_pylon_01", Vector2(6.6, 3.2), 3, 40.0],
		# 밭
		["c", "vegetable_row_01", Vector2(6.0, 7.0), 12, 22.0],
		["c", "scarecrow_01", Vector2(6.0, 7.0), 1, 16.0],
		# 들
		["c", "rock_small_01", Vector2(4.0, 4.0), 24, 170.0],
		["c", "bush_01", Vector2(4.0, 4.0), 24, 170.0],
		["c", "stump_01", Vector2(4.0, 4.0), 10, 170.0],
		# G-0062 — 세 갈래 = 세 땅: 일본 민가·비단길 집·중국 전각 · 대숲 · 갈림길 깃대·횃대 · 공사장 천막
		["c", "jp_minka_01", Vector2(2.0, 6.6), 1, 60.0],
		["c", "silkroad_house_01", Vector2(6.4, 6.4), 1, 60.0],
		["c", "chinese_hall_01", Vector2(1.8, 2.6), 1, 60.0],
		["c", "bamboo_clump_01", Vector2(1.4, 5.4), 8, 70.0],
		["c", "banner_pole_01", Vector2(4.0, 4.0), 6, 40.0],
		["c", "torch_stand_01", Vector2(3.8, 3.8), 6, 40.0],
		["c", "tent_large_01", Vector2(6.4, 2.2), 1, 50.0],
		["c", "tent_small_01", Vector2(6.8, 3.0), 2, 40.0],
	],
}

static var _mesh_cache := {}

var region_id := ""
var keep_cells: Array = []          # 표 자리(칸). 부모가 안 주면 _ready 에서 모은다
## 점검용 — 놓인 것 [{kind, pos(Vector3), yaw, r, solid}]
var records: Array = []
var shapes := 0


func _ready() -> void:
	name = "Dressing"
	top_level = true   # 월드 좌표 그대로(부모 지역 노드 위치와 무관)
	if OS.get_environment("SAGA_NO_DRESSING") != "":   # 전후 촬영 비교용(probe_shots g38_*)
		return
	if keep_cells.is_empty():
		keep_cells = collect_keep_cells(region_id, get_parent().get_script() if get_parent() != null else null)
	build()


static func mesh_of(kind: String) -> Mesh:
	if not _mesh_cache.has(kind):
		_mesh_cache[kind] = GLBUtils.extract_mesh(DIR + kind + ".glb")
	return _mesh_cache[kind]


## 발판 반지름(가로·세로 중 긴 쪽 절반).
static func radius_of(kind: String) -> float:
	var m := mesh_of(kind)
	if m == null:
		return 0.5
	var a := m.get_aabb()
	return maxf(a.size.x, a.size.z) * 0.5


static func cell_world(region: String, c: Vector2) -> Vector3:
	return TestMap.world_pos(c.x, c.y, region)


static func tile_of(region: String, p: Vector3) -> String:
	var g := TestMap.grid_at(region, p)
	return TestMap.tile_at(g.x, g.y, region)


static func open_ground(region: String, p: Vector3) -> bool:
	var t := tile_of(region, p)
	return t != "^" and t != "="


## 그 지역 표 자리(칸 좌표) — SCAN 표들 + 지역 스크립트 상수.
static func collect_keep_cells(region: String, region_script: Script) -> Array:
	var out: Array = []
	for path in SCAN:
		var s := load(String(path)) as Script
		if s == null:
			continue
		for v in s.get_script_constant_map().values():
			_collect(v, region, out)
	if region_script != null:
		var cm := region_script.get_script_constant_map()
		for k: String in cm:
			var v: Variant = cm[k]
			if v is Vector2 and k.ends_with("_CELL"):
				out.append(v)
			elif v is Array:
				for e in v:
					if e is Array:
						for x in e:
							if x is Vector2:
								out.append(x)
								break
	return out


static func _collect(v: Variant, region: String, out: Array) -> void:
	if v is Dictionary:
		var d: Dictionary = v
		if String(d.get("region", "")) == region and (d.get("cell") is Vector2):
			out.append(d.cell)
		for val in d.values():
			if val is Array or val is Dictionary:
				_collect(val, region, out)
	elif v is Array:
		var has_r := false
		var cell: Variant = null
		for e in v:
			if e is String and e == region:
				has_r = true
			elif cell == null and (e is Vector2 or e is Vector2i):
				cell = Vector2(e)
		if has_r and cell != null:
			out.append(cell)
		for e in v:
			if e is Array or e is Dictionary:
				_collect(e, region, out)


## 모서리 넷(돌린 발판) 월드 좌표.
static func corners(kind: String, pos: Vector3, yaw: float) -> Array:
	var m := mesh_of(kind)
	var a := m.get_aabb() if m != null else AABB(Vector3(-0.5, 0, -0.5), Vector3.ONE)
	var b := Basis(Vector3.UP, yaw)
	var out := []
	for cx in [a.position.x, a.end.x]:
		for cz in [a.position.z, a.end.z]:
			out.append(pos + b * Vector3(cx, 0.0, cz))
	return out


## 규칙 하나라도 어기면 "" 가 아닌 이유. 점검도 같은 함수로 잰다.
func violation(kind: String, pos: Vector3, yaw: float, keep_world: Array, others: Array) -> String:
	var solid := SOLID.has(kind)
	var r := radius_of(kind)
	if not open_ground(region_id, pos):
		return "산·길 칸"
	if solid:
		for c in corners(kind, pos, yaw):
			if not open_ground(region_id, c):
				return "발판 모서리가 산·길 칸"
	var keep := (KEEP_SOLID if solid else KEEP_CLUTTER) + r
	for k: Vector3 in keep_world:
		if Vector2(pos.x - k.x, pos.z - k.z).length() < keep:
			return "표 자리 둘레"
	for o: Dictionary in others:
		if Vector2(pos.x - (o.pos as Vector3).x, pos.z - (o.pos as Vector3).z).length() < r + float(o.r) + GAP:
			return "겹침"
	return ""


func keep_world_points() -> Array:
	var out := []
	for c in keep_cells:
		out.append(cell_world(region_id, Vector2(c)))
	return out


func build() -> void:
	records.clear()
	var plan: Array = PLAN.get(region_id, [])
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(region_id) + 20260824
	var keep_world := keep_world_points()
	var by_kind := {}
	for e: Array in plan:
		var kind := String(e[1])
		if mesh_of(kind) == null:
			push_error("RegionDressing: 소품을 못 열었다 — %s" % kind)
			continue
		var cands: Array = []   # 줄 자리 [pos(y 무시), yaw]
		if String(e[0]) == "l":
			var a := cell_world(region_id, e[2])
			var b := cell_world(region_id, e[3])
			var n := maxi(1, int(a.distance_to(b) / float(e[4])))
			var dir := (b - a).normalized()
			var yaw := atan2(dir.x, dir.z) + PI * 0.5
			for i in n + 1:
				cands.append([a.lerp(b, float(i) / float(n)), yaw])
		else:
			var center := cell_world(region_id, e[2])
			var want := int(e[3])
			var rad := float(e[4])
			var got := 0
			for t in want * TRIES:
				if got >= want:
					break
				var ang := rng.randf() * TAU
				var d := sqrt(rng.randf()) * rad
				var p := center + Vector3(cos(ang) * d, 0.0, sin(ang) * d)
				var yaw := rng.randf() * TAU
				if violation(kind, p, yaw, keep_world, records) == "":
					_place(kind, p, yaw, by_kind)
					got += 1
			continue
		for c: Array in cands:
			if violation(kind, c[0], c[1], keep_world, records) == "":
				_place(kind, c[0], c[1], by_kind)
	for kind: String in by_kind:
		_multimesh(kind, by_kind[kind])
	_build_collision()


func _place(kind: String, p: Vector3, yaw: float, by_kind: Dictionary) -> void:
	var solid := SOLID.has(kind)
	var y := TerrainBuilder.height_at(region_id, p)
	if solid:
		for c in corners(kind, p, yaw):
			y = minf(y, TerrainBuilder.height_at(region_id, c))
		y -= 0.05
	var pos := Vector3(p.x, y, p.z)
	records.append({"kind": kind, "pos": pos, "yaw": yaw, "r": radius_of(kind), "solid": solid})
	if not by_kind.has(kind):
		by_kind[kind] = [] as Array[Transform3D]
	(by_kind[kind] as Array[Transform3D]).append(Transform3D(Basis(Vector3.UP, yaw), pos))


func _multimesh(kind: String, xforms: Array[Transform3D]) -> void:
	var mesh := mesh_of(kind)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = xforms.size()
	for i in xforms.size():
		mm.set_instance_transform(i, xforms[i])
	var mmi := MultiMeshInstance3D.new()
	mmi.name = "Dress_" + kind
	mmi.multimesh = mm
	mmi.visibility_range_end = VIS_END
	if mesh.get_aabb().size.y < SHADOW_MIN_H:
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mmi)


func _build_collision() -> void:
	shapes = 0
	var body := StaticBody3D.new()
	body.name = "DressCollision"
	for rec: Dictionary in records:
		if not rec.solid:
			continue
		var a := mesh_of(String(rec.kind)).get_aabb()
		var box := BoxShape3D.new()
		box.size = a.size
		var cs := CollisionShape3D.new()
		cs.shape = box
		var basis := Basis(Vector3.UP, float(rec.yaw))
		cs.transform = Transform3D(basis, (rec.pos as Vector3) + basis * a.get_center())
		body.add_child(cs)
		shapes += 1
	add_child(body)
