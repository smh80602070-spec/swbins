extends Node3D

## G-0387 1만리 들판 수수께끼(젤다 야숨 코록 · 웹 W-0426 짝) — 지역마다 여섯(외딴 돌 둘·꽃 고리 둘·바람개비 둘), 풀면 「🌰 씨앗」+1.
##   외딴 돌   1.4m 안에 STONE_HOLD 초 머물면 들춤(1만리엔 따로 집기 키가 없다 — 별조각처럼 다가가면)
##   꽃 고리   둘레 RING_R 에 선 꽃 다섯을 RING_SEC 초 안에 모두 밟음(밟은 꽃은 고개 숙임)
##   바람개비  받침이 보는 쪽(바람 받는 쪽) ±30°·1.2~3.5m 에 PIN_HOLD 초 서면 돎
## 씨앗 5·15·30·60 마다 별조각 +1(고돗 1만리엔 가방 칸 상한이 없어 웹의 가방 칸 대신 — 신상 스태미나 길 star_shards.gd 그대로).
## 자리는 지역 id·번호 md5 로 결정적, 걸을 수 있는 칸·물 아닌 곳·지역 테두리 1칸 안쪽(칸 안에서도 흩음, 서로 25m 넘게). 세이브 = EventState `riddle_<id>`·`shard_rd<n>`(스키마 그대로).
## 몸은 K-0195 GLB(assets/world/puzzle_stone_01·flower_ring_01·pinwheel_01*)가 임포트돼 있으면 그것, 아니면 코드 도형.
## SAGA_RIDDLES=0 이면 안 붙는다. test_village.gd 가 지역들 뒤에 단다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const PER_KIND := 2
const KINDS := ["stone", "ring", "pin"]
const STONE_M := 1.4
const STONE_HOLD := 0.5
const RING_R := 2.6
const RING_STEP_M := 0.8
const RING_SEC := 8.0
const PIN_MIN := 1.2
const PIN_MAX := 3.5
const PIN_HOLD := 2.0
const PIN_CONE := 30.0
const NEAR_M := 40.0
const TICK := 0.1
const SEED_SHARDS := [5, 15, 30, 60]
const GLB := {
	"stone": "res://assets/world/puzzle_stone_01.glb", "stone_open": "res://assets/world/puzzle_stone_01_open.glb",
	"ring": "res://assets/world/flower_ring_01.glb", "pin": "res://assets/world/pinwheel_01.glb",
	"pin_blades": "res://assets/world/pinwheel_01_blades.glb",
}

static var _spots_cache: Array = []

var _nodes := {}        # id → {node, kind, pos, yaw, t, steps:Array[bool], blades}
var _player: Node3D
var _t := 0.0


static func attach(parent: Node) -> Node:
	if OS.get_environment("SAGA_RIDDLES") == "0":
		return null
	var n: Node3D = load("res://games/saga_go/world/go_field_riddles.gd").new()
	n.name = "FieldRiddles"
	parent.add_child(n)
	return n


## 열 지역 × 여섯 자리 — [{id, region, kind, pos, yaw}] (결정적·한 번 셈).
static func spots() -> Array:
	if not _spots_cache.is_empty():
		return _spots_cache
	var out: Array = []
	for rid: String in TestMap.REGIONS:
		var s := TestMap.size(rid)
		var used: Array[Vector3] = []
		for k in KINDS.size():
			for j in PER_KIND:
				var id := "%s_%s%d" % [rid, KINDS[k], j]
				var p := _pick_pos(rid, s, id, used)
				if p.x == INF:
					continue
				used.append(p)
				var h := String(id).md5_text()
				out.append({"id": id, "region": rid, "kind": KINDS[k], "pos": p, "yaw": float(h.substr(6, 4).hex_to_int() % 360)})
	_spots_cache = out
	return out


## 지역 격자는 9×9 남짓(한 칸 48m)이라 칸 안에서도 자리를 흩는다 — 걸을 칸·물 아님·다른 수수께끼와 SPACING_M 넘게. 못 찾으면 x = INF.
const SPACING_M := 25.0


static func _pick_pos(rid: String, s: Vector2i, id: String, used: Array[Vector3]) -> Vector3:
	for attempt in 120:
		var h := ("%s#%d" % [id, attempt]).md5_text()
		var x := 1 + h.substr(0, 4).hex_to_int() % maxi(1, s.x - 2)
		var y := 1 + h.substr(4, 4).hex_to_int() % maxi(1, s.y - 2)
		if not TerrainBuilder.LEGEND[TestMap.tile_at(x, y, rid)].walkable:
			continue
		var fx := x + (h.substr(8, 4).hex_to_int() % 1000) / 1000.0 * 0.7 - 0.35   # 칸 가운데 ±0.35칸
		var fy := y + (h.substr(12, 4).hex_to_int() % 1000) / 1000.0 * 0.7 - 0.35
		var p := TestMap.world_pos(fx, fy, rid)
		var g := TestMap.grid_at(rid, p)
		if not TerrainBuilder.LEGEND[TestMap.tile_at(g.x, g.y, rid)].walkable:
			continue
		p.y = TerrainBuilder.height_at(rid, p)
		if p.y < TerrainBuilder.WATER_LEVEL - 0.1:
			continue
		var near := false
		for u in used:
			if Vector2(u.x - p.x, u.z - p.z).length() < SPACING_M:
				near = true
		if not near:
			return p
	return Vector3(INF, 0, 0)


static func solved(id: String) -> bool:
	return EventState.is_resolved("riddle_" + id)


static func seeds() -> int:
	var n := 0
	for key in EventState.resolved:
		if key.begins_with("riddle_"):
			n += 1
	return n


static func left_in(rid: String) -> int:
	var n := 0
	for sp: Dictionary in spots():
		if sp.region == rid and not solved(String(sp.id)):
			n += 1
	return n


func _ready() -> void:
	add_to_group("go_field_riddles")
	for sp: Dictionary in spots():
		if not solved(String(sp.id)):
			_build(sp)


func _process(delta: float) -> void:
	_t -= delta
	if _t > 0.0:
		return
	var dt := TICK - _t
	_t = TICK
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
		if _player == null:
			return
	var me := _player.global_position
	for id: String in _nodes.keys():
		var e: Dictionary = _nodes[id]
		var pos: Vector3 = e.pos
		var d := Vector2(me.x - pos.x, me.z - pos.z).length()
		if d > NEAR_M:
			if e.kind == "ring":
				e.t = 0.0
			continue
		match String(e.kind):
			"stone":
				e.t = e.t + dt if d <= STONE_M else 0.0
				if e.t >= STONE_HOLD:
					solve(id)
			"ring":
				_tick_ring(id, e, me, dt)
			"pin":
				var to := Vector3(me.x - pos.x, 0, me.z - pos.z)
				var facing := Vector3(sin(deg_to_rad(e.yaw)), 0, cos(deg_to_rad(e.yaw)))
				var ok: bool = d >= PIN_MIN and d <= PIN_MAX and rad_to_deg(facing.angle_to(to.normalized())) <= PIN_CONE
				e.t = e.t + dt if ok else maxf(0.0, e.t - dt)
				if e.blades:
					(e.blades as Node3D).rotate_object_local(Vector3.FORWARD, dt * (2.0 + e.t * 6.0))
				if e.t >= PIN_HOLD:
					solve(id)


func _tick_ring(id: String, e: Dictionary, me: Vector3, dt: float) -> void:
	var steps: Array = e.steps
	var any := steps.has(true)
	if any:
		e.t = e.t + dt
		if e.t > RING_SEC:
			_reset_ring(e)
			Toast.show(self, "꽃 고리 — 늦었다, 처음부터", 1.8)
			return
	for i in 5:
		if steps[i]:
			continue
		var fp := ring_flower_pos(e.pos, e.yaw, i)
		if Vector2(me.x - fp.x, me.z - fp.z).length() <= RING_STEP_M:
			steps[i] = true
			var fl: Node3D = (e.flowers as Array)[i]
			if fl:
				fl.scale = Vector3(1, 0.4, 1)
			if not any:
				e.t = 0.0
	if not steps.has(false):
		solve(id)


func _reset_ring(e: Dictionary) -> void:
	e.t = 0.0
	for i in 5:
		(e.steps as Array)[i] = false
		var fl: Node3D = (e.flowers as Array)[i]
		if fl:
			fl.scale = Vector3.ONE


static func ring_flower_pos(center: Vector3, yaw: float, i: int) -> Vector3:
	var a := deg_to_rad(yaw) + TAU * float(i) / 5.0
	return center + Vector3(cos(a), 0, sin(a)) * RING_R


## 푼다(점검도 부른다) — 씨앗 +1, 문턱이면 별조각. 이미 풀었으면 false.
func solve(id: String) -> bool:
	if solved(id):
		return false
	EventState.mark_resolved("riddle_" + id)
	var n := seeds()
	var msg := "🌰 씨앗 %d" % n
	for th: int in SEED_SHARDS:
		if n == th:
			EventState.mark_resolved("shard_rd%d" % th)
			msg += " — 숲 정령의 별조각 +1(신상에 바치면 스태미나)"
	if _nodes.has(id):
		var e: Dictionary = _nodes[id]
		var nd: Node3D = e.node
		if e.kind == "stone" and _has(GLB.stone_open):
			var open := (load(GLB.stone_open) as PackedScene).instantiate() as Node3D
			open.global_transform = nd.global_transform
			add_child(open)
		nd.queue_free()
		_nodes.erase(id)
	Toast.show(self, msg, 2.5)
	return true


static func _has(path: String) -> bool:
	return ResourceLoader.exists(path)


func _build(sp: Dictionary) -> void:
	var root := Node3D.new()
	root.name = "Riddle_" + String(sp.id)
	add_child(root)
	root.global_position = sp.pos
	root.rotation.y = deg_to_rad(float(sp.yaw))
	var e := {"node": root, "kind": sp.kind, "pos": sp.pos, "yaw": float(sp.yaw), "t": 0.0, "blades": null, "steps": [], "flowers": []}
	match String(sp.kind):
		"stone":
			root.add_child(_glb_or(GLB.stone, _stone_mesh()))
		"ring":
			var steps: Array = []
			var flowers: Array = []
			for i in 5:
				var fp := ring_flower_pos(sp.pos, float(sp.yaw), i)
				var fl := _flower_mesh(i)
				add_child(fl)
				fl.global_position = Vector3(fp.x, TerrainBuilder.height_at(String(sp.region), fp), fp.z)
				fl.reparent(root, true)
				steps.append(false)
				flowers.append(fl)
			e.steps = steps
			e.flowers = flowers
		"pin":
			if _has(GLB.pin) and _has(GLB.pin_blades):
				root.add_child((load(GLB.pin) as PackedScene).instantiate())
				var bl := (load(GLB.pin_blades) as PackedScene).instantiate() as Node3D
				bl.position = Vector3(0, 1.25, 0)
				root.add_child(bl)
				e.blades = bl
			else:
				var pole := _box(Vector3(0.08, 1.3, 0.08), Color(0.45, 0.32, 0.2))
				pole.position = Vector3(0, 0.65, 0)
				root.add_child(pole)
				var bl := Node3D.new()
				bl.position = Vector3(0, 1.3, 0.06)
				for k in 4:
					var vane := _box(Vector3(0.06, 0.36, 0.02), [Color(0.9, 0.3, 0.3), Color(0.95, 0.85, 0.3), Color(0.3, 0.6, 0.95), Color(0.4, 0.85, 0.45)][k])
					vane.position = Vector3(0, 0.18, 0)
					var arm := Node3D.new()
					arm.rotation.z = TAU * k / 4.0
					arm.add_child(vane)
					bl.add_child(arm)
				root.add_child(bl)
				e.blades = bl
	_nodes[String(sp.id)] = e


func _glb_or(path: String, fallback: Node3D) -> Node3D:
	if _has(path):
		fallback.free()
		return (load(path) as PackedScene).instantiate() as Node3D
	return fallback


func _stone_mesh() -> Node3D:
	var mi := MeshInstance3D.new()
	var m := SphereMesh.new()
	m.radius = 0.45
	m.height = 0.55
	mi.mesh = m
	mi.position = Vector3(0, 0.2, 0)
	mi.material_override = _mat(Color(0.52, 0.5, 0.46))
	return mi


func _flower_mesh(i: int) -> Node3D:
	var root := Node3D.new()
	var stem := _box(Vector3(0.04, 0.3, 0.04), Color(0.3, 0.6, 0.25))
	stem.position = Vector3(0, 0.15, 0)
	root.add_child(stem)
	var head := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.12
	sm.height = 0.12
	head.mesh = sm
	head.position = Vector3(0, 0.33, 0)
	head.material_override = _mat([Color(0.95, 0.5, 0.7), Color(0.98, 0.85, 0.3), Color(0.7, 0.55, 0.95), Color(0.95, 0.95, 0.95), Color(0.95, 0.45, 0.3)][i % 5])
	root.add_child(head)
	return root


func _box(size: Vector3, c: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	mi.mesh = b
	mi.material_override = _mat(c)
	return mi


func _mat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.9
	return m
