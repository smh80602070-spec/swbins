extends Node3D

## saga-godot 2026-09-28 "그래픽 먼저" — 원신식 풀잎 밭. 칸 하나가 48m 라 평지가 수백 m 씩 흐린 초록 판이었다(09-28 창 모드 촬영).
## 지도 전체에 깔면 삼각형이 수백만 개라, 플레이어 둘레 반경 안만 CHUNK_M 조각으로 깔고 멀어진 조각은 걷는다.
##   · 자리는 조각 좌표 해시로 결정적 — 다시 와도 같은 풀이 같은 자리에 선다(vegetation_builder.gd 원칙). 한 번 잰 자리는 기억해 둔다.
##   · 풀은 GRASS_TILES 칸에만(길·밭·모래·눈·물·산 제외). 칸 경계는 JITTER_M 만큼 흔든 자리로 한 번 더 물어 들쭉날쭉하게 끊는다.
##   · 위에서 광선을 쏴 땅(TerrainCollision)이 아닌 것에 먼저 닿으면 안 심는다 — 석상 받침·다리·집 바닥을 뚫고 풀이 솟지 않게.
##   · 색 = 그 칸 땅 정점색(인스턴스 색), 가장자리는 셰이더가 눌러 없앤다(grass_blades.gdshader).
##   · 가까운 조각만 잎을 다 세우고 먼 조각은 덤불마다 잎 절반 — 멀리선 눈에 같은데 삼각형이 반.
## 그림자는 안 드리운다(받기만) — 잎 수만큼 그림자 패스가 는다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const SHADER := preload("res://saga_core/shaders/grass_blades.gdshader")

## 칸 글자 → 심는 비율(숲 바닥은 나무 그늘이라 성기게, 폐허·사당 터는 돌 틈으로 듬성듬성, 마을 마당은 조금).
const GRASS_TILES := {".": 1.0, "T": 0.6, "K": 0.9, "R": 0.55, "S": 0.4, "H": 0.15}
const GRASS_COLOR_TILES := [".", "T", "K"]
const CHUNK_M := 16.0
const SPACING_M := 1.35          # 덤불 간격(흔든 격자)
const JITTER_M := 5.0            # 칸 경계 들쭉날쭉
## [가까운 잎 수, 먼 잎 수, 반경 m, 가까운 반경 m]
const PROFILE_PC := [11, 6, 40.0, 20.0]   # G-0142 잎이 세 마디(5 세모)가 돼 14 → 11장(세모 42 → 55)
const PROFILE_MOBILE := [5, 3, 26.0, 13.0]
const BUILDS_PER_FRAME := 2

var _radius := 40.0
var _near := 20.0
var _mesh_near: ArrayMesh
var _mesh_far: ArrayMesh
var _mat: ShaderMaterial
var _chunks: Dictionary = {}     # Vector2i → MultiMeshInstance3D(풀 없는 조각은 null)
var _cache: Dictionary = {}      # Vector2i → [xforms, cols] — 한 번 잰 자리
var _queue: Array[Vector2i] = []
var _last_key := Vector2i(1 << 30, 0)
var _player: Node3D


func _ready() -> void:
	var mobile := OS.has_feature("mobile") or OS.has_feature("web") \
		or RenderingServer.get_current_rendering_method() == "mobile"
	var prof: Array = PROFILE_MOBILE if mobile else PROFILE_PC
	_mesh_near = _clump_mesh(prof[0])
	_mesh_far = _clump_mesh(prof[1])
	_radius = prof[2]
	_near = prof[3]
	_mat = ShaderMaterial.new()
	_mat.shader = SHADER
	_mat.set_shader_parameter("fade_start", _radius - 10.0)
	_mat.set_shader_parameter("fade_end", _radius - 1.0)


func _process(_delta: float) -> void:
	var c := _center()
	if c == Vector3.INF:
		return
	_mat.set_shader_parameter("fade_center", c)
	var key := Vector2i(floori(c.x / CHUNK_M), floori(c.z / CHUNK_M))
	if key != _last_key:
		_last_key = key
		_replan(c)
	var built := 0
	while built < BUILDS_PER_FRAME and not _queue.is_empty():
		var k: Vector2i = _queue.pop_front()
		if _chunks.has(k):
			continue
		_chunks[k] = _make_chunk(k, _chunk_dist(k, c) <= _near)
		built += 1


## 풀 밭의 가운데 = 플레이어(카메라는 한 바퀴 돌 때마다 자리가 바뀌어 조각을 헛짓는다). 없으면 카메라.
func _center() -> Vector3:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
	if _player:
		return _player.global_position
	var cam := get_viewport().get_camera_3d()
	return cam.global_position if cam else Vector3.INF


## 플레이어가 다른 조각으로 넘어갈 때만 — 필요한 조각을 가까운 순으로 줄 세우고, 한 조각 넘게 멀어진 것은 걷고, 가깝/먼 잎 수를 맞춘다.
func _replan(c: Vector3) -> void:
	var reach := ceili(_radius / CHUNK_M)
	var want: Array = []
	for dz in range(-reach, reach + 1):
		for dx in range(-reach, reach + 1):
			var k := Vector2i(_last_key.x + dx, _last_key.y + dz)
			var d := _chunk_dist(k, c)
			if d <= _radius:
				want.append([d, k])
	want.sort_custom(func(a, b): return a[0] < b[0])
	_queue.clear()
	for w in want:
		if not _chunks.has(w[1]):
			_queue.append(w[1])
	for k in _chunks.keys():
		var n: MultiMeshInstance3D = _chunks[k]
		var d := _chunk_dist(k, c)
		if d > _radius + CHUNK_M:
			if n != null:
				n.queue_free()
			_chunks.erase(k)
		elif n != null:
			n.multimesh.mesh = _mesh_near if d <= _near else _mesh_far


## 조각 사각형에서 c 까지 가장 가까운 거리(0 = 안).
func _chunk_dist(k: Vector2i, c: Vector3) -> float:
	var x0 := k.x * CHUNK_M
	var z0 := k.y * CHUNK_M
	var dx := maxf(maxf(x0 - c.x, 0.0), c.x - (x0 + CHUNK_M))
	var dz := maxf(maxf(z0 - c.z, 0.0), c.z - (z0 + CHUNK_M))
	return sqrt(dx * dx + dz * dz)


func _make_chunk(key: Vector2i, near: bool) -> MultiMeshInstance3D:
	if not _cache.has(key):
		_cache[key] = _measure(key)
	var data: Array = _cache[key]
	var xforms: Array = data[0]
	if xforms.is_empty():
		return null
	var cols: Array = data[1]
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = _mesh_near if near else _mesh_far
	mm.instance_count = xforms.size()
	for i in xforms.size():
		mm.set_instance_transform(i, xforms[i])
		mm.set_instance_color(i, cols[i])
	var mmi := MultiMeshInstance3D.new()
	mmi.name = "Grass_%d_%d" % [key.x, key.y]
	mmi.multimesh = mm
	mmi.material_override = _mat
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mmi)
	return mmi


## 조각 하나의 덤불 자리·색을 잰다 — [transforms, colors].
func _measure(key: Vector2i) -> Array:
	var space := get_world_3d().direct_space_state
	var xforms: Array = []
	var cols: Array = []
	var steps := int(CHUNK_M / SPACING_M)
	var step := CHUNK_M / float(steps)
	var q := PhysicsRayQueryParameters3D.new()
	q.collision_mask = 1
	for iz in steps:
		for ix in steps:
			var gx := key.x * steps + ix
			var gz := key.y * steps + iz
			var p := Vector3(key.x * CHUNK_M + (ix + _hash(gx, gz, 1)) * step, 0.0,
				key.y * CHUNK_M + (iz + _hash(gx, gz, 2)) * step)
			var region := TestMap.region_at(p)
			if region == "":
				continue
			var g := TestMap.grid_at(region, p)
			var ch := TestMap.tile_at(g.x, g.y, region)
			var rate: float = GRASS_TILES.get(ch, 0.0)
			if rate <= 0.0 or _hash(gx, gz, 3) > rate:
				continue
			## 눈 덮인 칸(서리봉 숲 바닥 등, terrain_builder surface_of .r)엔 안 심는다 — 눈 위로 초록 풀이 솟았다(09-28 촬영).
			if TerrainBuilder.surface_of(region, ch).r > 0.3:
				continue
			## 경계 들쭉날쭉 — 흔든 자리도 풀 칸이어야 한다.
			var jp := p + Vector3((_hash(gx, gz, 4) - 0.5) * 2.0 * JITTER_M, 0.0, (_hash(gx, gz, 5) - 0.5) * 2.0 * JITTER_M)
			var jr := TestMap.region_at(jp)
			if jr == "":
				continue
			var jg := TestMap.grid_at(jr, jp)
			if not GRASS_TILES.has(TestMap.tile_at(jg.x, jg.y, jr)):
				continue
			p.y = TerrainBuilder.height_at(region, p)
			q.from = p + Vector3(0, 6.0, 0)
			q.to = p - Vector3(0, 0.5, 0)
			var hit := space.intersect_ray(q)
			if hit.is_empty() or (hit.collider as Node).name != "TerrainCollision":
				continue
			p.y = hit.position.y
			var s := 0.75 + _hash(gx, gz, 6) * 0.55
			xforms.append(Transform3D(Basis.from_scale(Vector3(s, s * (0.85 + _hash(gx, gz, 7) * 0.4), s)), p))
			## 풀빛은 들판·숲 바닥 색만 따른다 — 폐허(잿빛)·사당·마당 칸 색을 따르면 회보라 풀이 됐다(09-28 촬영). 그 칸들은 그 지역 들판 색.
			cols.append(TerrainBuilder.color_of(region, ch if ch in GRASS_COLOR_TILES else "."))
	return [xforms, cols]


## 덤불 하나 = 잎 n 장. G-0142 — 잎마다 세 마디(5 삼각형): 밑동에서 끝으로 가늘어지고, 위로 갈수록 한쪽으로 휘어 처진다(사실적 들풀).
## 법선 = 잎 면(휜 방향 반영) — 셰이더가 위쪽과 섞어 포기가 둥글게 빛을 받고, 해가 잎 뒤면 끝이 비친다.
## UV.x = 잎 가로(−1 왼 가장자리 ~ 1 오른), UV.y = 밑동 0 → 끝 1, UV2.x = 잎마다 난수(색 흔들기).
## 먼 덤불은 같은 씨앗의 앞 n 장이라 모양이 이어진다.
const SEGS := 3
static func _clump_mesh(n: int) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in n:
		var a := _hash(i, 0, 11) * TAU
		var r := sqrt(_hash(i, 0, 12)) * 0.6
		var o := Vector3(cos(a) * r, 0.0, sin(a) * r)
		var face := _hash(i, 0, 13) * TAU
		var side := Vector3(cos(face), 0.0, sin(face))
		var fwd := Vector3(-side.z, 0.0, side.x)              # 잎 면이 보는 쪽 = 휘는 쪽
		var bend := 0.15 + _hash(i, 0, 14) * 0.45            # 끝이 앞으로 처지는 정도(키 배수)
		var h := (0.4 + _hash(i, 0, 15) * 0.45) * 0.72
		var w := 0.034 + _hash(i, 0, 16) * 0.022   # 0.022~0.038 은 너무 가늘어 들판이 성겨 보였다
		var shade := 0.8 + _hash(i, 0, 17) * 0.2
		var col := Color(shade, shade, shade * (0.92 + _hash(i, 0, 18) * 0.08))
		var rnd := _hash(i, 0, 19)
		## 마디 점 — t 를 따라 위로 올라가며 fwd 쪽으로 t² 만큼 처진다(높이도 그만큼 줄어든다).
		var rows: Array = []
		for s in SEGS + 1:
			var t := float(s) / float(SEGS)
			var c := o + Vector3(0, h * (t - 0.35 * bend * t * t), 0) + fwd * h * bend * t * t
			var hw := w * (1.0 - t * 0.85)
			var tang := (Vector3(0, h * (1.0 - 0.7 * bend * t), 0) + fwd * h * bend * 2.0 * t).normalized()
			var nrm := side.cross(tang).normalized()
			if nrm.dot(fwd) < 0.0:
				nrm = -nrm
			rows.append([c - side * hw, c + side * hw, t, nrm])
		var tip := o + Vector3(0, h * (1.0 - 0.35 * bend) + 0.02, 0) + fwd * (h * bend + 0.02)
		for s in SEGS:
			var r0: Array = rows[s]
			var r1: Array = rows[s + 1]
			if s == SEGS - 1:
				## 마지막 마디는 뾰족하게 — 세모 하나.
				_blade_vert(st, r0[0], -1.0, r0[2], r0[3], col, rnd)
				_blade_vert(st, r0[1], 1.0, r0[2], r0[3], col, rnd)
				_blade_vert(st, tip, 0.0, 1.0, r1[3], col, rnd)
				continue
			_blade_vert(st, r0[0], -1.0, r0[2], r0[3], col, rnd)
			_blade_vert(st, r0[1], 1.0, r0[2], r0[3], col, rnd)
			_blade_vert(st, r1[0], -1.0, r1[2], r1[3], col, rnd)
			_blade_vert(st, r0[1], 1.0, r0[2], r0[3], col, rnd)
			_blade_vert(st, r1[1], 1.0, r1[2], r1[3], col, rnd)
			_blade_vert(st, r1[0], -1.0, r1[2], r1[3], col, rnd)
	return st.commit()


static func _blade_vert(st: SurfaceTool, p: Vector3, across: float, t: float, nrm: Vector3, col: Color, rnd: float) -> void:
	st.set_color(col)
	st.set_normal(nrm)
	st.set_uv(Vector2(across, t))
	st.set_uv2(Vector2(rnd, 0.0))
	st.add_vertex(p)


static func _hash(gx: int, gy: int, salt: int) -> float:
	return TerrainBuilder._hash(gx, gy, salt)
