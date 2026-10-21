extends Node3D

## G-0277 밤 불빛(다섯 판 공용) — K-0155 자체 GLB 규약: 불 면 재질 `glow_fire`·`glow_lamp`(emission) · 빈 노드 `light_point` · 창 `glass`.
##   ① GLBUtils.extract_mesh 가 메시를 뽑을 때 adopt(mesh, root) — 그 재질을 원본마다 한 벌 복제해 갈아 끼우고(같은 GLB 여럿이 나눠 씀),
##      light_point 자리(뿌리 기준)를 메시 메타 "light_points" 로 남긴다(MultiMesh 로 깔아도 자리가 남게).
##      3마을 곡률 재질(WorldCurveMaterial.textured_surfaces)은 셰이더 emission 자리로 register_shader 한다.
##   ② set_night(b 0~1, 씬 노드) — 불 면 세기 낮 DAY_GLOW → 밤 NIGHT_GLOW, 창은 밤에 따뜻한 빛. 1만리 night_visual·세 판 day_light 가 부른다.
##   ③ 밤(b > 0.05)이면 씬에 이 노드를 하나 달아 PICK_SEC 마다 카메라 가까운 MAX_LIGHTS 개 light_point 에 OmniLight3D(그림자 끔)를 옮긴다.
## 손잡이: SAGA_NIGHT_GLOW=0 이면 아무것도 안 바꾸고 안 단다. 에셋·해·하늘 값은 안 건드린다.

const KINDS := ["glow_fire", "glow_lamp", "glass"]
const DAY_GLOW := 0.3
const NIGHT_GLOW := 3.0
const GLASS_COLOR := Color(1.0, 0.72, 0.42)
const GLASS_NIGHT := 1.4
const LIGHT_COLOR := Color(1.0, 0.74, 0.46)
const LIGHT_ENERGY := 1.6
const LIGHT_RANGE := 6.0
const MAX_LIGHTS := 8
const NEAR_M := 45.0
const PICK_SEC := 0.5
const RESCAN_SEC := 4.0
const NODE_NAME := "NightGlowLights"

static var _night := 0.0
static var _dup := {}            # 원본 재질 instance_id → 복제본
static var _mats: Array = []     # [재질, 종류] — StandardMaterial3D
static var _shaders: Array = []  # [ShaderMaterial, 종류] — 곡률 셰이더(emission_color·emission_energy)

var _lights: Array[OmniLight3D] = []
var _points: PackedVector3Array = PackedVector3Array()
var _pick_t := 0.0
var _scan_t := 0.0


static func enabled() -> bool:
	return OS.get_environment("SAGA_NIGHT_GLOW") != "0"


## 재질 이름 → 종류("glow_fire"·"glow_lamp"·"glass") 아니면 "". Blender 꼬리 ".001" 은 뗀다.
static func kind_of(m: Material) -> String:
	if m == null:
		return ""
	var n := m.resource_name.get_slice(".", 0)
	return n if KINDS.has(n) else ""


## 뽑은 메시의 불 면·창 재질을 갈아 끼우고 light_point 자리를 메타로. root = 그 GLB 를 인스턴스한 뿌리(자리 기준).
static func adopt(mesh: Mesh, root: Node) -> void:
	if not enabled() or mesh == null:
		return
	for s in mesh.get_surface_count():
		var m := mesh.surface_get_material(s)
		var k := kind_of(m)
		if k == "" or m.has_meta("night_glow") or not (m is StandardMaterial3D):
			continue
		var id := m.get_instance_id()
		if not _dup.has(id):
			var d := (m as StandardMaterial3D).duplicate() as StandardMaterial3D
			d.set_meta("night_glow", k)
			_dup[id] = d
			_mats.append([d, k])
			_set_mat(d, k, _night)
		mesh.surface_set_material(s, _dup[id])
	if root != null and not mesh.has_meta("light_points"):
		var pts := PackedVector3Array()
		for n in root.find_children("light_point*", "", true, false):
			if n is Node3D:
				pts.append(_rel(root, n as Node3D).origin)
		if not pts.is_empty():
			mesh.set_meta("light_points", pts)


## 곡률 셰이더 재질(curved_textured)도 밤에 빛나게 — 종류는 원본(복제본) 메타.
static func register_shader(sm: ShaderMaterial, kind: String) -> void:
	_shaders.append([sm, kind])
	_set_shader(sm, kind, _night)


## 밤 무게 b(0 낮 ~ 1 밤). at = 그 씬의 노드(밤이면 등 점광 관리 노드를 씬 뿌리에 단다).
static func set_night(b: float, at: Node = null) -> void:
	if not enabled():
		return
	b = clampf(b, 0.0, 1.0)
	_night = b
	for e in _mats:
		_set_mat(e[0], e[1], b)
	for e in _shaders:
		if is_instance_valid(e[0]):
			_set_shader(e[0], e[1], b)
	if at != null and at.is_inside_tree() and b > 0.05:
		var scene := at.get_tree().current_scene
		if scene != null and scene.get_node_or_null(NODE_NAME) == null:
			var n: Node3D = (load("res://saga_core/world/night_glow.gd") as GDScript).new()
			n.name = NODE_NAME
			scene.add_child(n)


static func night() -> float:
	return _night


static func _set_mat(m: StandardMaterial3D, k: String, b: float) -> void:
	if k == "glass":
		m.emission_enabled = b > 0.01
		m.emission = GLASS_COLOR
		m.emission_energy_multiplier = GLASS_NIGHT * b
	else:
		m.emission_enabled = true
		m.emission_energy_multiplier = lerpf(DAY_GLOW, NIGHT_GLOW, b)


static func _set_shader(sm: ShaderMaterial, k: String, b: float) -> void:
	if k == "glass":
		sm.set_shader_parameter("emission_color", GLASS_COLOR)
		sm.set_shader_parameter("emission_energy", GLASS_NIGHT * b)
	else:
		sm.set_shader_parameter("emission_color", LIGHT_COLOR)
		sm.set_shader_parameter("emission_energy", lerpf(DAY_GLOW, NIGHT_GLOW, b))


static func _rel(root: Node, n: Node3D) -> Transform3D:
	var xf := Transform3D.IDENTITY
	var cur: Node = n
	while cur != null and cur != root:
		if cur is Node3D:
			xf = (cur as Node3D).transform * xf
		cur = cur.get_parent()
	return xf


func _ready() -> void:
	for i in MAX_LIGHTS:
		var l := OmniLight3D.new()
		l.name = "NightLamp%d" % i
		l.light_color = LIGHT_COLOR
		l.omni_range = LIGHT_RANGE
		l.shadow_enabled = false
		l.visible = false
		add_child(l)
		_lights.append(l)
	_scan()


func _process(delta: float) -> void:
	_scan_t += delta
	if _scan_t >= RESCAN_SEC:
		_scan()
	_pick_t += delta
	if _pick_t >= PICK_SEC:
		pick_now()


## 씬의 light_point 자리(월드)를 다시 모은다 — 메시 메타를 가진 MeshInstance3D·MultiMeshInstance3D.
func _scan() -> void:
	_scan_t = 0.0
	_points = PackedVector3Array()
	var scene := get_parent()
	if scene == null:
		return
	for n in scene.find_children("*", "GeometryInstance3D", true, false):
		if not (n as Node3D).is_visible_in_tree():
			continue
		if n is MeshInstance3D:
			var m: Mesh = (n as MeshInstance3D).mesh
			if m != null and m.has_meta("light_points"):
				for p in m.get_meta("light_points") as PackedVector3Array:
					_points.append((n as Node3D).global_transform * p)
		elif n is MultiMeshInstance3D:
			var mm: MultiMesh = (n as MultiMeshInstance3D).multimesh
			if mm != null and mm.mesh != null and mm.mesh.has_meta("light_points"):
				var gx := (n as Node3D).global_transform
				for i in mm.visible_instance_count if mm.visible_instance_count >= 0 else mm.instance_count:
					for p in mm.mesh.get_meta("light_points") as PackedVector3Array:
						_points.append(gx * (mm.get_instance_transform(i) * p))


## 카메라 가까운 MAX_LIGHTS 개에 점광(밤 무게만큼 세기). 점검이 바로 부른다.
func pick_now() -> void:
	_pick_t = 0.0
	var cam := get_viewport().get_camera_3d() if is_inside_tree() else null
	var b := _night
	if cam == null or b <= 0.05 or _points.is_empty():
		for l in _lights:
			l.visible = false
		return
	var c := cam.global_position
	var near: Array = []
	for p in _points:
		var d := p.distance_to(c)
		if d <= NEAR_M:
			near.append([d, p])
	near.sort_custom(func(x: Array, y: Array) -> bool: return float(x[0]) < float(y[0]))
	for i in _lights.size():
		var l := _lights[i]
		l.visible = i < near.size()
		if l.visible:
			l.global_position = near[i][1]
			l.light_energy = LIGHT_ENERGY * b


## 점검용 — 켜진 점광 수·모은 자리 수.
func lit_count() -> int:
	var n := 0
	for l in _lights:
		if l.visible:
			n += 1
	return n


func point_count() -> int:
	return _points.size()
