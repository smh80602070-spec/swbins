class_name RegionLoader
extends Node3D

## G-0015 — 지역 배치표(`assets/regions/<지역>/layout.json`)를 읽어 지역 한 곳을 짠다. 로더는 하나, 지역은 데이터.
## 배치표는 Blender 좌표(x 오른쪽·y 안쪽·z 위, 미터)라 `conv()` 로 (x, z, -y) 로 바꿔 쓴다.
## 있는 키만 읽고 없으면 건너뛴다(지역마다 모양이 다르다 — village 는 옛 모양, 나머지는 schema 1).

const REGION_DIR := "res://assets/regions/"
const REGIONS := ["village", "galaxy_ferry", "frost_peak", "time_rift", "crossroads"]
const GROUND_SHADER := preload("res://saga_core/shaders/region_ground.gdshader")

## village 의 trees[4] 종류 0·1·2 → 기존 CC0 나무 GLB(미터 단위 배율은 vegetation_builder 와 같은 값).
const TREE_GLBS := [
	["res://assets/generated/variants/CommonTree_1__go_village.glb", 0.759830],
	["res://assets/generated/variants/CommonTree_2__go_village.glb", 0.722230],
	["res://assets/generated/variants/Pine_1__go_village.glb", 0.754416],
]
const FLOWER_GLB := "res://assets/generated/variants/Flower_3_Single__go_village.glb"
const FLOWER_SCALE := 0.218

## 빛 예산(G-0015 R-0): 점광원은 구경 카메라에서 가까운 순으로 이만큼만 켠다. 그림자는 해·달(SUN)만.
const LIGHT_BUDGET_MOBILE := 8
const LIGHT_BUDGET_PC := 16
## Blender 점광원 와트 → Godot omni 세기·범위(눈대중 — 실기에서 맞춘다). 시간 틈 4000W 같은 튀는 값은 상한으로 누른다.
const WATT_TO_ENERGY := 1.0 / 80.0
const ENERGY_MAX := 6.0

var region := ""
var layout: Dictionary = {}
var dir := ""
## 진단이 읽는 계수 — 짠 것의 수.
var stats := {"pieces": 0, "piece_kinds": 0, "multimeshes": 0, "trees": 0, "flowers": 0, "roads": 0, "terrain_tris": 0, "scenery": 0, "water": 0, "lights": 0, "suns": 0, "particles": 0, "errors": 0}

var _heights := PackedFloat32Array()
var _t0 := Vector2.ZERO   # 격자 시작(Blender x, y)
var _step := 1.0
var _nx := 0
var _ny := 0


## Blender (x, y, z) → Godot (x, z, -y).
static func conv(p: Array) -> Vector3:
	return Vector3(float(p[0]), float(p[2]), -float(p[1]))


static func has_layout(id: String) -> bool:
	return FileAccess.file_exists("%s%s/layout.json" % [REGION_DIR, id])


func build(id: String) -> bool:
	region = id
	dir = "%s%s/" % [REGION_DIR, id]
	var f := FileAccess.open(dir + "layout.json", FileAccess.READ)
	if f == null:
		push_error("RegionLoader: 배치표 없음 — %s" % id)
		stats.errors += 1
		return false
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	if not (parsed is Dictionary):
		push_error("RegionLoader: 배치표 해석 실패 — %s" % id)
		stats.errors += 1
		return false
	layout = parsed
	name = "Region_" + id
	_build_terrain()
	_build_plaza()
	_build_roads()
	_build_pieces()
	_build_trees()
	_build_flowers()
	_build_scenery()
	_build_water()
	_build_lights()
	_build_fx()
	return stats.errors == 0


# ---------------------------------------------------------------- 지형

## 배치표 격자에서 (Blender x, y) 의 높이(쌍선형). 격자 밖은 가장자리 값.
func height_at(bx: float, by: float) -> float:
	if _heights.is_empty():
		return 0.0
	var fx := clampf((bx - _t0.x) / _step, 0.0, float(_nx - 1))
	var fy := clampf((by - _t0.y) / _step, 0.0, float(_ny - 1))
	var ix := mini(int(fx), _nx - 2)
	var iy := mini(int(fy), _ny - 2)
	var tx := fx - float(ix)
	var ty := fy - float(iy)
	var h00 := _heights[iy * _nx + ix]
	var h10 := _heights[iy * _nx + ix + 1]
	var h01 := _heights[(iy + 1) * _nx + ix]
	var h11 := _heights[(iy + 1) * _nx + ix + 1]
	if is_nan(h00 + h10 + h01 + h11):
		# 구멍 가장자리 — 있는 모서리의 평균(하나도 없으면 0).
		var sum := 0.0
		var n := 0
		for h in [h00, h10, h01, h11]:
			if not is_nan(h):
				sum += h
				n += 1
		return sum / float(n) if n > 0 else 0.0
	return lerpf(lerpf(h00, h10, tx), lerpf(h01, h11, tx), ty)


func _build_terrain() -> void:
	var t: Variant = layout.get("terrain")
	if not (t is Dictionary):
		return
	_t0 = Vector2(float(t.x0), float(t.y0))
	_step = float(t.step)
	_nx = int(t.nx)
	_ny = int(t.ny)
	_heights = PackedFloat32Array()
	for h in t.heights as Array:
		_heights.append(NAN if h == null else float(h))   # null = 땅 없음(물·허공) — 풍경 메시가 덮는다
	if _heights.size() != _nx * _ny:
		push_error("RegionLoader: 지형 격자 크기가 안 맞는다 — %s" % region)
		stats.errors += 1
		return
	var verts := PackedVector3Array()
	var norms := PackedVector3Array()
	verts.resize(_nx * _ny)
	norms.resize(_nx * _ny)
	for j in _ny:
		for i in _nx:
			var h := _heights[j * _nx + i]
			if is_nan(h):
				h = 0.0
			verts[j * _nx + i] = Vector3(_t0.x + float(i) * _step, h, -(_t0.y + float(j) * _step))
	for j in _ny:
		for i in _nx:
			var hc := verts[j * _nx + i].y
			var hl := _h_or(j * _nx + maxi(i - 1, 0), hc)
			var hr := _h_or(j * _nx + mini(i + 1, _nx - 1), hc)
			var hd := _h_or(maxi(j - 1, 0) * _nx + i, hc)
			var hu := _h_or(mini(j + 1, _ny - 1) * _nx + i, hc)
			var dx := float(mini(i + 1, _nx - 1) - maxi(i - 1, 0)) * _step
			var dy := float(mini(j + 1, _ny - 1) - maxi(j - 1, 0)) * _step
			# Blender y 가 늘면 Godot z 가 줄어든다 → 법선 z 성분 부호 주의.
			norms[j * _nx + i] = Vector3(-(hr - hl) / dx, 1.0, (hu - hd) / dy).normalized()
	var idx := PackedInt32Array()
	for j in _ny - 1:
		for i in _nx - 1:
			var a := j * _nx + i
			var b := a + 1
			var c := a + _nx
			var d := c + 1
			if is_nan(_heights[a] + _heights[b] + _heights[c] + _heights[d]):
				continue   # 한 모서리라도 땅이 없으면 칸을 비운다
			idx.append_array([a, c, b, b, c, d])   # Godot 앞면 = 시계 방향
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_NORMAL] = norms
	arrays[Mesh.ARRAY_INDEX] = idx
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	mesh.surface_set_material(0, _ground_material(t.get("materials")))
	var mi := MeshInstance3D.new()
	mi.name = "Terrain"
	mi.mesh = mesh
	add_child(mi)
	stats.terrain_tris = idx.size() / 3


func _h_or(i: int, fallback: float) -> float:
	var h := _heights[i]
	return fallback if is_nan(h) else h


func _tex(rel: String) -> Texture2D:
	var p := dir + rel
	var tex := load(p) as Texture2D
	if tex == null:
		push_error("RegionLoader: 그림 없음 — %s" % p)
		stats.errors += 1
	return tex


func _color3(v: Variant, fallback: Color = Color.WHITE) -> Color:
	if v is Array and (v as Array).size() >= 3:
		return Color(float(v[0]), float(v[1]), float(v[2]))
	return fallback


func _ground_material(m: Variant) -> ShaderMaterial:
	var sm := ShaderMaterial.new()
	sm.shader = GROUND_SHADER
	if m is Dictionary:
		var md := m as Dictionary
		sm.set_shader_parameter("low_tex", _tex(String(md.get("low", "tex/ground_grass.jpg"))))
		var high: Variant = md.get("high")
		sm.set_shader_parameter("high_tex", _tex(String(high if high != null else md.get("low", "tex/ground_grass.jpg"))))
		sm.set_shader_parameter("use_high", 1.0 if high != null else 0.0)
		sm.set_shader_parameter("tint_low", _color3(md.get("tint_low")))
		sm.set_shader_parameter("tint_high", _color3(md.get("tint_high")))
		for k in ["tile_low", "tile_high", "z0", "z1", "slope0", "slope1"]:
			if md.has(k):
				sm.set_shader_parameter(k, float(md[k]))
	else:
		# village 처럼 materials 가 없으면 풀 한 장.
		var grass := _tex("tex/ground_grass.jpg")
		sm.set_shader_parameter("low_tex", grass)
		sm.set_shader_parameter("high_tex", grass)
		sm.set_shader_parameter("use_high", 0.0)
		sm.set_shader_parameter("tile_low", 5.0)
	return sm


# ---------------------------------------------------------------- 광장·길

func _flat_material(rel: String, tint: Color = Color.WHITE) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = _tex(rel)
	mat.albedo_color = tint
	mat.roughness = 1.0
	mat.texture_repeat = true
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	return mat


func _build_plaza() -> void:
	var p: Variant = layout.get("plaza")
	if not (p is Dictionary):
		return
	var c := Vector2(float(p.center[0]), float(p.center[1]))
	var r := float(p.radius)
	const RINGS := 6
	const SEGS := 48
	const TILE := 3.0
	var verts := PackedVector3Array()
	var uvs := PackedVector2Array()
	var norms := PackedVector3Array()
	verts.append(_lifted(c.x, c.y))
	uvs.append(Vector2(c.x, -c.y) / TILE)
	for ring in range(1, RINGS + 1):
		var rr := r * float(ring) / float(RINGS)
		for s in SEGS:
			var a := TAU * float(s) / float(SEGS)
			var bx := c.x + cos(a) * rr
			var by := c.y + sin(a) * rr
			verts.append(_lifted(bx, by))
			uvs.append(Vector2(bx, -by) / TILE)
	norms.resize(verts.size())
	norms.fill(Vector3.UP)
	var idx := PackedInt32Array()
	for s in SEGS:
		idx.append_array([0, 1 + (s + 1) % SEGS, 1 + s])   # 시계 방향(위에서 봤을 때 Godot 앞면)
	for ring in range(1, RINGS):
		var o0 := 1 + (ring - 1) * SEGS
		var o1 := 1 + ring * SEGS
		for s in SEGS:
			var s2 := (s + 1) % SEGS
			idx.append_array([o0 + s, o0 + s2, o1 + s])
			idx.append_array([o0 + s2, o1 + s2, o1 + s])
	_add_surface("Plaza", verts, norms, uvs, idx, _flat_material("tex/plaza_cobble.jpg"))


func _lifted(bx: float, by: float, lift: float = 0.06) -> Vector3:
	return Vector3(bx, height_at(bx, by) + lift, -by)


func _build_roads() -> void:
	var roads: Variant = layout.get("roads")
	if not (roads is Array):
		return
	for r: Dictionary in roads:
		var p0 := Vector2(float(r.from[0]), float(r.from[1]))
		var p1 := Vector2(float(r.to[0]), float(r.to[1]))
		var w := float(r.width)
		var rel := "tex/road_asphalt.jpg" if String(r.get("mat", "dirt")) == "asphalt" else "tex/road_dirt.jpg"
		var seg_len := p0.distance_to(p1)
		var dir2 := (p1 - p0) / maxf(seg_len, 0.001)
		var side := Vector2(-dir2.y, dir2.x) * (w * 0.5)
		var n := maxi(2, int(seg_len / 1.5))
		var verts := PackedVector3Array()
		var uvs := PackedVector2Array()
		var norms := PackedVector3Array()
		var idx := PackedInt32Array()
		for k in n + 1:
			var c := p0.lerp(p1, float(k) / float(n))
			var l := c - side
			var rr := c + side
			verts.append(_lifted(l.x, l.y, 0.05))
			verts.append(_lifted(rr.x, rr.y, 0.05))
			var v := float(k) / float(n) * seg_len / 4.0
			uvs.append(Vector2(0.0, v))
			uvs.append(Vector2(w / 4.0, v))
			norms.append(Vector3.UP)
			norms.append(Vector3.UP)
			if k < n:
				var a := k * 2
				# l(a) r(a+1) 다음 줄 l(a+2) r(a+3). 위에서 봤을 때 시계 방향이 되게.
				idx.append_array([a, a + 2, a + 1, a + 1, a + 2, a + 3])
		_add_surface("Road%d" % int(stats.roads), verts, norms, uvs, idx, _flat_material(rel))
		stats.roads += 1


func _add_surface(node_name: String, verts: PackedVector3Array, norms: PackedVector3Array, uvs: PackedVector2Array, idx: PackedInt32Array, mat: Material) -> void:
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_NORMAL] = norms
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	arrays[Mesh.ARRAY_INDEX] = idx
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	mesh.surface_set_material(0, mat)
	var mi := MeshInstance3D.new()
	mi.name = node_name
	mi.mesh = mesh
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)


# ---------------------------------------------------------------- 조각·식생(MultiMesh)

func _multimesh(node_name: String, mesh: Mesh, xforms: Array[Transform3D]) -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = xforms.size()
	for i in xforms.size():
		mm.set_instance_transform(i, xforms[i])
	var mmi := MultiMeshInstance3D.new()
	mmi.name = node_name
	mmi.multimesh = mm
	add_child(mmi)
	stats.multimeshes += 1


func _build_pieces() -> void:
	var pieces: Variant = layout.get("pieces")
	if not (pieces is Array):
		return
	var by_kind := {}
	for p: Dictionary in pieces:
		var kind := String(p.piece)
		if not by_kind.has(kind):
			by_kind[kind] = [] as Array[Transform3D]
		var pos := conv(p.pos as Array)
		var basis := Basis(Vector3.UP, float(p.get("rot", 0.0))).scaled(Vector3.ONE * float(p.get("scale", 1.0)))
		(by_kind[kind] as Array[Transform3D]).append(Transform3D(basis, pos))
		stats.pieces += 1
	for kind: String in by_kind:
		var path := "%spieces/%s.glb" % [REGION_DIR, kind]
		var mesh := GLBUtils.extract_mesh(path)
		if mesh == null:
			push_error("RegionLoader: 조각을 못 열었다 — %s" % path)
			stats.errors += 1
			continue
		_multimesh("Piece_" + kind, mesh, by_kind[kind] as Array[Transform3D])
		stats.piece_kinds += 1


func _build_trees() -> void:
	var trees: Variant = layout.get("trees")
	if not (trees is Array):
		return
	var by_kind := {}
	for t: Array in trees:
		var k := clampi(int(t[4]), 0, TREE_GLBS.size() - 1)
		if not by_kind.has(k):
			by_kind[k] = [] as Array[Transform3D]
		var s := float(TREE_GLBS[k][1]) * float(t[3])
		var yaw := fposmod(float(t[0]) * 12.9898 + float(t[1]) * 78.233, 1.0) * TAU
		var basis := Basis(Vector3.UP, yaw).scaled(Vector3.ONE * s)
		(by_kind[k] as Array[Transform3D]).append(Transform3D(basis, conv([t[0], t[1], t[2]])))
		stats.trees += 1
	for k: int in by_kind:
		var mesh := GLBUtils.with_lods(GLBUtils.extract_mesh(String(TREE_GLBS[k][0])))
		if mesh == null:
			stats.errors += 1
			continue
		_multimesh("Trees%d" % k, mesh, by_kind[k] as Array[Transform3D])


func _build_flowers() -> void:
	var flowers: Variant = layout.get("flowers")
	if not (flowers is Array) or (flowers as Array).is_empty():
		return
	var xforms: Array[Transform3D] = []
	for f: Array in flowers:
		var yaw := fposmod(float(f[0]) * 37.719 + float(f[1]) * 11.131, 1.0) * TAU
		xforms.append(Transform3D(Basis(Vector3.UP, yaw).scaled(Vector3.ONE * FLOWER_SCALE), conv(f)))
		stats.flowers += 1
	var mesh := GLBUtils.extract_mesh(FLOWER_GLB)
	if mesh == null:
		stats.errors += 1
		return
	_multimesh("Flowers", mesh, xforms)


# ---------------------------------------------------------------- 풍경·물·빛·효과

## 풍경 GLB(소나무·바위·갈대·부두·섬·구름바다·고리 …)는 월드 좌표로 구워져 있어 그대로 올린다(glTF 는 y 위라 변환 불필요).
func _build_scenery() -> void:
	var rel: Variant = layout.get("scenery")
	if rel == null:
		return
	var ps := load(dir + String(rel)) as PackedScene
	if ps == null:
		push_error("RegionLoader: 풍경을 못 열었다 — %s" % rel)
		stats.errors += 1
		return
	var n := ps.instantiate() as Node3D
	n.name = "Scenery"
	add_child(n)
	stats.scenery = GLBUtils.find_all_mesh_instances(n).size()


func _build_water() -> void:
	var w: Variant = layout.get("water")
	if not (w is Dictionary):
		return
	var plane := PlaneMesh.new()
	plane.size = Vector2.ONE * float(w.size)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = _color3(w.get("color"), Color(0.02, 0.06, 0.1))
	mat.roughness = float(w.get("roughness", 0.05))
	mat.metallic = 0.35
	var mi := MeshInstance3D.new()
	mi.name = "Water"
	mi.mesh = plane
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = Vector3(0.0, float(w.z), 0.0)
	add_child(mi)
	stats.water += 1


## 구경 카메라 자리(Godot 좌표). 배치표에 카메라가 없으면 ZERO — 빛 고르기 기준일 뿐이다.
func camera_position() -> Vector3:
	var cam: Variant = layout.get("camera")
	return conv(cam.pos as Array) if cam is Dictionary else Vector3.ZERO


## Blender 오일러(XYZ, 라디안) 로 돌린 빛의 진행 방향을 Godot 방향으로. Blender 빛은 로컬 -Z 로 비춘다.
static func sun_direction(rot: Array) -> Vector3:
	var r := Basis(Vector3(0, 0, 1), float(rot[2])) * Basis(Vector3(0, 1, 0), float(rot[1])) * Basis(Vector3(1, 0, 0), float(rot[0]))
	var d := r * Vector3(0, 0, -1)
	return Vector3(d.x, d.z, -d.y).normalized()


func _build_lights() -> void:
	var lights: Variant = layout.get("lights")
	if not (lights is Array):
		return
	var points: Array = []
	for l: Dictionary in lights:
		if String(l.type) == "SUN":
			var sun := DirectionalLight3D.new()
			sun.name = "Sun%d" % int(stats.suns)
			sun.light_color = _color3(l.get("color"))
			sun.light_energy = float(l.energy)
			sun.shadow_enabled = int(stats.suns) == 0
			sun.transform.basis = Basis.looking_at(sun_direction(l.rot as Array), Vector3.UP)
			add_child(sun)
			stats.suns += 1
		else:
			points.append(l)
	var cam := camera_position()
	points.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return conv(a.pos as Array).distance_squared_to(cam) < conv(b.pos as Array).distance_squared_to(cam))
	var budget := LIGHT_BUDGET_MOBILE if OS.has_feature("mobile") else LIGHT_BUDGET_PC
	for i in mini(budget, points.size()):
		var l: Dictionary = points[i]
		var o := OmniLight3D.new()
		o.name = "Lamp%d" % i
		o.light_color = _color3(l.get("color"))
		o.light_energy = minf(float(l.energy) * WATT_TO_ENERGY, ENERGY_MAX)
		o.omni_range = clampf(sqrt(float(l.energy)) * 1.2, 6.0, 30.0)
		o.position = conv(l.pos as Array)
		add_child(o)
		stats.lights += 1


## 반딧불·눈발: area = [x0, x1, y0, y1, z0, z1](Blender, 미터). 빌보드 점 입자, 개수는 배치표 그대로.
func _build_fx() -> void:
	var fx: Variant = layout.get("fx")
	if not (fx is Dictionary):
		return
	if (fx as Dictionary).has("fireflies"):
		_particles("Fireflies", fx.fireflies as Dictionary, 0.08, Vector3(0, 0.15, 0), Vector3(0.5, 0.3, 0.5), 7.0)
	if (fx as Dictionary).has("snowfall"):
		_particles("Snowfall", fx.snowfall as Dictionary, 0.07, Vector3(0, -1.4, 0), Vector3(0.6, 0.2, 0.6), 7.0)


func _particles(node_name: String, d: Dictionary, size: float, velocity: Vector3, jitter: Vector3, life: float) -> void:
	var a: Array = d.area
	var lo := conv([a[0], a[2], a[4]])
	var hi := conv([a[1], a[3], a[5]])
	var center := (lo + hi) * 0.5
	var ext := ((hi - lo) * 0.5).abs()
	var p := CPUParticles3D.new()
	p.name = node_name
	p.amount = int(d.count)
	p.lifetime = life
	p.preprocess = life
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	p.emission_box_extents = ext
	p.direction = velocity.normalized() if velocity.length() > 0.0 else Vector3.UP
	p.spread = 25.0
	p.initial_velocity_min = velocity.length() * 0.7
	p.initial_velocity_max = velocity.length() * 1.3
	p.gravity = Vector3.ZERO
	p.position = center
	var col := _color3(d.get("color"), Color(0.95, 0.97, 1.0))
	var quad := QuadMesh.new()
	quad.size = Vector2.ONE * size
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	mat.albedo_color = col
	mat.emission_enabled = true
	mat.emission = col
	mat.emission_energy_multiplier = 2.0 if node_name == "Fireflies" else 0.6
	quad.material = mat
	p.mesh = quad
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(p)
	stats.particles += int(d.count)
