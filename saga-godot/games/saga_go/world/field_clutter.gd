extends Node3D

## G-0227 1만리 빈 들판 채우기 — 플레이어 둘레에만 덤불·풀포기·꽃무리·고사리를 더 흩어 '눈 둘 데' 를 만든다(멀리는 그대로).
## 그림은 자체툴 K-0104 사진 결 잎(assets/world/foliage/<id>.gltf, 공용 아틀라스 한 장) — 새 그림을 만들지 않는다.
## grass_field.gd 와 같은 틀: CHUNK_M 조각마다 흔든 격자 자리를 해시로 정하고(다시 와도 같은 자리), 길 띠·눈 칸·땅 아닌 것(받침·다리·집 바닥) 위는 비운다.
## 그리기를 줄이려 조각마다 노드를 두지 않고 **종류마다 MultiMesh 하나**를 활성 조각 전부로 다시 채운다(조각이 바뀔 때만) — 그리기 = 종류 수.
## 그림자는 덤불만(작은 풀포기·꽃은 끔). 10-13 첫 시도는 옛 로우폴리 덤불·잔돌이라 땅과 따로 놀아 되돌렸다(티켓 메모) — 이번은 KINDS 표만 갈았다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const RoadBuilder := preload("res://games/saga_go/world/road_builder.gd")
const GLBUtils := preload("res://saga_core/world/glb_utils.gd")
const DIR := "res://assets/world/foliage/"

## [id, 무게, 크기 배율 최소, 최대, 그림자]
## 종류 = 그리기 수(+ 그림자 드리우는 덤불 둘) — 10-19 PERF: 일곱이면 마을 그리기 평균 250→259(예산 260)라 다섯으로(고사리·꽃무리 둘째 뺌 — 고사리는 촬영에서 검은 점으로 읽혔다).
const KINDS := [
	["grass_clump_01", 30.0, 0.8, 1.25, false],
	["grass_clump_02", 22.0, 0.8, 1.2, false],
	["flower_clump_01", 18.0, 0.85, 1.25, false],
	["bush_leafy_01", 9.0, 0.8, 1.2, true],
	["bush_leafy_02", 9.0, 0.8, 1.2, true],
]
## 칸 글자 → 심는 비율(들판이 주인공 — 숲 바닥은 고사리·풀포기, 마을 마당·사당 터는 아주 조금).
const TILES := {".": 1.0, "T": 0.7, "K": 0.8, "R": 0.35, "S": 0.25, "H": 0.08}
const CHUNK_M := 16.0
const SPACING_M := 2.6
const ROAD_CLEAR_M := 5.7          # grass_field.gd 와 같은 길 띠 비움
## [반경 m, 심는 확률 배율]
const PROFILE_PC := [52.0, 0.62]
const PROFILE_MOBILE := [32.0, 0.45]
const BUILDS_PER_FRAME := 2

var _radius := 52.0
var _rate := 0.62
var _meshes: Array = []            # KINDS 같은 차례 — Mesh(없으면 null)
var _mmis: Array = []              # 종류마다 MultiMeshInstance3D
var _chunks: Dictionary = {}       # Vector2i → [[kind, Transform3D], …] (재 둔 조각)
var _active: Dictionary = {}       # Vector2i → true
var _queue: Array[Vector2i] = []
var _dirty := false
var _last_key := Vector2i(1 << 30, 0)
var _player: Node3D
var _weight_sum := 0.0


func _ready() -> void:
	var mobile := OS.has_feature("mobile") or OS.has_feature("web") \
		or RenderingServer.get_current_rendering_method() == "mobile"
	var prof: Array = PROFILE_MOBILE if mobile else PROFILE_PC
	_radius = prof[0]
	_rate = prof[1]
	for k: Array in KINDS:
		_weight_sum += float(k[1])
		var path := DIR + String(k[0]) + ".gltf"
		var mesh: Mesh = null
		var ps: PackedScene = load(path) as PackedScene if ResourceLoader.exists(path) else null
		if ps != null:   # 임포트 캐시가 없는 PC(.godot/imported)에선 null — 그 종류만 빈다
			mesh = GLBUtils.extract_mesh_from_scene(ps)
		_meshes.append(mesh)
		var mmi := MultiMeshInstance3D.new()
		mmi.name = "Clutter_" + String(k[0])
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = mesh
		mmi.multimesh = mm
		if mesh != null:
			mmi.material_override = _leaf_material(mesh)
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if bool(k[4]) else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mmi)
		_mmis.append(mmi)


## 잎 재질 복사본(그림 파일은 그대로) — 첫 촬영(10-19)에서 고사리·풀포기가 밝은 잔디 위 검은 점으로 읽혔다(해를 등진 잎 면이 그늘).
## 랩 조명으로 그늘 쪽을 덜 죽이고, 해가 잎 뒤에 있으면 투과광(backlight)으로 비치게 한다.
static var _mat_cache := {}
static func _leaf_material(mesh: Mesh) -> Material:
	var src := mesh.surface_get_material(0) as StandardMaterial3D
	if src == null:
		return null
	if _mat_cache.has(src):
		return _mat_cache[src]
	var m := src.duplicate() as StandardMaterial3D
	m.diffuse_mode = BaseMaterial3D.DIFFUSE_LAMBERT_WRAP
	m.backlight_enabled = true
	m.backlight = Color(0.35, 0.42, 0.22)
	m.albedo_color = Color(1.15, 1.18, 1.08)
	_mat_cache[src] = m
	return m


func _process(_delta: float) -> void:
	var c := _center()
	if c == Vector3.INF:
		return
	var key := Vector2i(floori(c.x / CHUNK_M), floori(c.z / CHUNK_M))
	if key != _last_key:
		_last_key = key
		_replan(c)
	var built := 0
	while built < BUILDS_PER_FRAME and not _queue.is_empty():
		var k: Vector2i = _queue.pop_front()
		if not _chunks.has(k):
			_chunks[k] = _measure(k)
		_active[k] = true
		_dirty = true
		built += 1
	if _dirty and _queue.is_empty():
		_dirty = false
		_refill()


func _center() -> Vector3:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
	if _player:
		return _player.global_position
	var cam := get_viewport().get_camera_3d()
	return cam.global_position if cam else Vector3.INF


## 다른 조각으로 넘어가면 — 반경 안 조각을 가까운 순으로 줄 세우고, 벗어난 조각은 활성에서 뺀다(잰 자리는 기억).
func _replan(c: Vector3) -> void:
	var reach := ceili(_radius / CHUNK_M)
	var want: Array = []
	var keep := {}
	for dz in range(-reach, reach + 1):
		for dx in range(-reach, reach + 1):
			var k := Vector2i(_last_key.x + dx, _last_key.y + dz)
			var d := _chunk_dist(k, c)
			if d <= _radius:
				want.append([d, k])
				keep[k] = true
	want.sort_custom(func(a, b): return a[0] < b[0])
	_queue.clear()
	for w in want:
		if not _active.has(w[1]):
			_queue.append(w[1])
	for k in _active.keys():
		if not keep.has(k):
			_active.erase(k)
			_dirty = true
	if _queue.is_empty() and _dirty:
		_dirty = false
		_refill()


func _chunk_dist(k: Vector2i, c: Vector3) -> float:
	var x0 := k.x * CHUNK_M
	var z0 := k.y * CHUNK_M
	var dx := maxf(maxf(x0 - c.x, 0.0), c.x - (x0 + CHUNK_M))
	var dz := maxf(maxf(z0 - c.z, 0.0), c.z - (z0 + CHUNK_M))
	return sqrt(dx * dx + dz * dz)


## 종류마다 MultiMesh 를 활성 조각 전부로 다시 채운다.
func _refill() -> void:
	var per: Array = []
	for i in KINDS.size():
		per.append([])
	for k in _active.keys():
		for e: Array in _chunks.get(k, []):
			(per[int(e[0])] as Array).append(e[1])
	for i in KINDS.size():
		var mm: MultiMesh = (_mmis[i] as MultiMeshInstance3D).multimesh
		var list: Array = per[i]
		mm.instance_count = 0 if _meshes[i] == null else list.size()
		for j in mm.instance_count:
			mm.set_instance_transform(j, list[j])


func instance_total() -> int:
	var n := 0
	for m: MultiMeshInstance3D in _mmis:
		n += m.multimesh.instance_count
	return n


func _pick_kind(r: float) -> int:
	var acc := 0.0
	for i in KINDS.size():
		acc += float(KINDS[i][1]) / _weight_sum
		if r <= acc:
			return i
	return KINDS.size() - 1


## 조각 하나의 자리 — [[종류, Transform3D], …].
func _measure(key: Vector2i) -> Array:
	var out: Array = []
	var space := get_world_3d().direct_space_state
	var steps := int(CHUNK_M / SPACING_M)
	var step := CHUNK_M / float(steps)
	var q := PhysicsRayQueryParameters3D.new()
	q.collision_mask = 1
	for iz in steps:
		for ix in steps:
			var gx := key.x * steps + ix
			var gz := key.y * steps + iz
			var p := Vector3(key.x * CHUNK_M + (ix + _hash(gx, gz, 31)) * step, 0.0,
				key.y * CHUNK_M + (iz + _hash(gx, gz, 32)) * step)
			var region := TestMap.region_at(p)
			if region == "":
				continue
			var g := TestMap.grid_at(region, p)
			var ch := TestMap.tile_at(g.x, g.y, region)
			var rate: float = TILES.get(ch, 0.0)
			if ch == "=" and _road_region(region):
				rate = 1.0 if RoadBuilder.dist_to_road(region, p) > ROAD_CLEAR_M else 0.0
			elif _road_region(region) and RoadBuilder.dist_to_road(region, p) <= ROAD_CLEAR_M:
				rate = 0.0
			if rate <= 0.0 or _hash(gx, gz, 33) > rate * _rate:
				continue
			if TerrainBuilder.surface_of(region, ch).r > 0.3:   # 눈 칸
				continue
			p.y = TerrainBuilder.height_at(region, p)
			q.from = p + Vector3(0, 6.0, 0)
			q.to = p - Vector3(0, 0.5, 0)
			var hit := space.intersect_ray(q)
			if hit.is_empty() or (hit.collider as Node).name != "TerrainCollision":
				continue
			p.y = hit.position.y - 0.03
			var kind := _pick_kind(_hash(gx, gz, 34))
			## 숲 바닥(T)엔 덤불 대신 큰 풀포기 — 나무 밑동과 겹쳐 덩어리지지 않게.
			if ch == "T" and String(KINDS[kind][0]).begins_with("bush"):
				kind = 1
			var k: Array = KINDS[kind]
			var s := lerpf(float(k[2]), float(k[3]), _hash(gx, gz, 35))
			var b := Basis(Vector3.UP, _hash(gx, gz, 36) * TAU).scaled(Vector3(s, s * (0.9 + _hash(gx, gz, 37) * 0.2), s))
			out.append([kind, Transform3D(b, p)])
	return out


static func _hash(gx: int, gy: int, salt: int) -> float:
	return TerrainBuilder._hash(gx, gy, salt)


static var _road_cache := {}
static func _road_region(region: String) -> bool:
	if not _road_cache.has(region):
		_road_cache[region] = RoadBuilder.wants(region)
	return bool(_road_cache[region])
