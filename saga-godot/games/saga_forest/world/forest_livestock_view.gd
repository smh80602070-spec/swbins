extends Node3D

## G-0311 — 작은 우리(data/forest_livestock.gd)를 길 남쪽 (11,14) 에 세운다: 울타리 pen_fence_01 세 변 + 문 pen_gate_01(K-0181) ·
## 짐승은 우리 안을 천천히 돌아다님. 닭·염소 몸(saga-assets farm_hen·farm_goat)은 고돗에 아직 없어 코드 도형 대역(곡률 정점색 재질 —
## forest_creature.gd 와 같은 법) — 몸이 놓이면 _body 만 바꾼다(수신함 K). 자리는 제작대·집·박물관·낚시터·빈 집·굴 문·주민·채집 자리와 2칸 넘게.

const Livestock := preload("res://games/saga_forest/data/forest_livestock.gd")
const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const TerrainBuilder := preload("res://games/saga_forest/world/forest_terrain_builder.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")
const GLBUtils := preload("res://saga_core/world/glb_utils.gd")
const MonsterBody := preload("res://saga_core/world/monster_body.gd")   # G-0396 닭·염소 GLB(동작 일곱 — 들판 괴물과 같은 이름)

const GRID := Vector2i(11, 14)
const HALF := 2.4   # 우리 반 변(m)
const FENCE_GLB := "res://assets/world/pen_fence_01.glb"
const GATE_GLB := "res://assets/world/pen_gate_01.glb"
const CURVE_AMOUNT := 0.004
const WALK_SPEED := 0.35
## G-0396 K-0194 자체 몸(앞 +Z·발 0·Idle·Walk… 일곱). 임포트 안 된 PC 면 아래 코드 대역 그대로. SAGA_FARM_GLB=0 이면 대역.
const BODY_GLB := {"chick": "res://assets/creatures/farm_hen.glb", "goat": "res://assets/creatures/farm_goat.glb"}
const BODY_H := {"chick": 0.5, "goat": 0.95}   # 대역과 같은 키

var _shown := ""
var _pen: Node3D = null
var _beasts: Array = []   # [{node, target}]
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	name = "LivestockView"
	_rng.seed = 20260824
	position = ForestMap.world_pos(GRID.x, GRID.y) + Vector3(0, TerrainBuilder.LEGEND["."].height, 0)
	sync()


func _process(delta: float) -> void:
	if Engine.get_process_frames() % 30 == 0:
		sync()
	for b: Dictionary in _beasts:
		var n := b.node as Node3D
		if not is_instance_valid(n):
			continue
		var t: Vector3 = b.target
		var d := t - n.position
		if d.length() < 0.1:
			b["target"] = Vector3(_rng.randf_range(-HALF + 0.6, HALF - 0.6), 0, _rng.randf_range(-HALF + 0.6, HALF - 0.6))
			continue
		n.position += d.normalized() * minf(WALK_SPEED * delta, d.length())
		n.rotation.y = lerp_angle(n.rotation.y, atan2(d.x, d.z), 0.1)


## 우리·짐승 목록이 바뀌었을 때만 다시 세운다. 세운 짐승 수를 돌려준다(점검용).
func sync() -> int:
	var key := "off"
	if Livestock.on() and Livestock.has_pen(ForestSaveState):
		var names: Array = []
		for a: Dictionary in Livestock.animals(ForestSaveState):
			names.append("%s:%s" % [a.kind, a.name])
		key = "pen|" + ",".join(PackedStringArray(names))
	if key == _shown:
		return _beasts.size()
	_shown = key
	for c in get_children():
		c.queue_free()
	_pen = null
	_beasts.clear()
	if key == "off":
		return 0
	_pen = _build_pen()
	add_child(_pen)
	var list := Livestock.animals(ForestSaveState)
	for i in list.size():
		var a: Dictionary = list[i]
		var b := _body(String(a.kind))
		b.name = "Beast%d" % i
		b.position = Vector3(-HALF + 0.8 + float(i) * 1.0, 0, 0.3 * float(i % 2))
		b.add_child(_label("%s %s" % [String(Livestock.KINDS.get(String(a.kind), {}).get("emoji", "")), String(a.name)]))
		add_child(b)
		_beasts.append({"node": b, "target": b.position})
	return _beasts.size()


## 울타리 세 변 + 앞(남쪽) 변 가운데 문. 조각 길이는 메시 상자로 재서 변을 채운다.
func _build_pen() -> Node3D:
	var root := Node3D.new()
	root.name = "Pen"
	var fence: Mesh = GLBUtils.extract_mesh(FENCE_GLB)
	var gate: Mesh = GLBUtils.extract_mesh(GATE_GLB)
	if fence == null:
		return root
	var fm := WorldCurveMaterial.textured_surfaces(fence, CURVE_AMOUNT, 0.9)
	var gm := WorldCurveMaterial.textured_surfaces(gate, CURVE_AMOUNT, 0.9) if gate != null else fm
	var seg := maxf(0.5, fence.get_aabb().size.x)
	var n := maxi(1, ceili(HALF * 2.0 / seg))
	var sc := HALF * 2.0 / (float(n) * seg)
	for side in 4:
		var rot := side * PI * 0.5
		var dir := Vector3(cos(rot), 0, -sin(rot))   # 변을 따라가는 방향
		var out := Vector3(sin(rot), 0, cos(rot)) * HALF   # 변 가운데(0 = 남쪽 앞)
		for k in n:
			var mi := MeshInstance3D.new()
			var is_gate := side == 0 and k == n / 2
			mi.name = "Gate" if is_gate else "Fence%d_%d" % [side, k]
			mi.mesh = gm if is_gate else fm
			mi.scale = Vector3(sc, 1, 1)
			mi.rotation.y = rot
			mi.position = out + dir * ((float(k) + 0.5) * seg * sc - HALF)
			root.add_child(mi)
	return root


## 몸 — GLB 가 있으면 그것(걷기 되풀이), 없으면 대역: 꼬꼬 흰 공 몸·작은 머리·빨간 볏·노란 부리 · 매매 흰 상자 몸·다리 넷·머리·뿔 둘
func _body(kind: String) -> Node3D:
	var root := Node3D.new()
	var glb := String(BODY_GLB.get(kind, ""))
	if glb != "" and OS.get_environment("SAGA_FARM_GLB") != "0" and ResourceLoader.exists(glb):
		var v := MonsterBody.build(glb, float(BODY_H[kind]))
		if v != null:
			var ap := v.get_node_or_null("AnimationPlayer") as AnimationPlayer
			if ap != null and ap.has_animation("Walk"):
				ap.play("Walk")
			root.add_child(v)
			return root
	if kind == "goat":
		root.add_child(_part(_box(Vector3(0.36, 0.34, 0.7)), Vector3(0, 0.55, 0), Color(0.93, 0.92, 0.88)))
		for x in [-0.12, 0.12]:
			for z in [-0.24, 0.24]:
				root.add_child(_part(_box(Vector3(0.08, 0.38, 0.08)), Vector3(x, 0.19, z), Color(0.85, 0.83, 0.78)))
		root.add_child(_part(_box(Vector3(0.22, 0.24, 0.3)), Vector3(0, 0.82, 0.42), Color(0.95, 0.94, 0.9)))
		for x in [-0.07, 0.07]:
			root.add_child(_part(_box(Vector3(0.04, 0.16, 0.04)), Vector3(x, 1.0, 0.36), Color(0.55, 0.47, 0.38)))
	else:
		root.add_child(_part(_sphere(0.2), Vector3(0, 0.24, 0), Color(0.97, 0.96, 0.93)))
		root.add_child(_part(_sphere(0.11), Vector3(0, 0.46, 0.14), Color(0.98, 0.97, 0.95)))
		root.add_child(_part(_box(Vector3(0.04, 0.08, 0.1)), Vector3(0, 0.58, 0.14), Color(0.86, 0.17, 0.15)))
		root.add_child(_part(_box(Vector3(0.05, 0.04, 0.08)), Vector3(0, 0.45, 0.27), Color(0.98, 0.72, 0.2)))
	return root


func _part(m: Mesh, at: Vector3, col: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = m
	mi.position = at
	mi.material_override = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.9, col)
	return mi


func _box(size: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = size
	return b


func _sphere(r: float) -> SphereMesh:
	var s := SphereMesh.new()
	s.radius = r
	s.height = r * 2.0
	s.radial_segments = 12
	s.rings = 6
	return s


func _label(text: String) -> Label3D:
	var l := Label3D.new()
	l.name = "Name"
	l.text = text
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.fixed_size = true
	l.pixel_size = 0.0012
	l.font_size = 20
	l.outline_size = 6
	l.position = Vector3(0, 1.3, 0)
	return l
