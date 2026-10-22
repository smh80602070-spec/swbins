extends Node3D

## PLAN 106장 ⑱ — 원신식 채집(들판에 난 재료·지역 특산물). 표는 data/cooking.gd PATCHES.
##   세 지역 24무리 55개 — 일반 재료 다섯(박하·꿀꽃·산사과·송이버섯·바지락)과 특산물 넷(청하란·갯소라·재꽃·고원 눈꽃, 옅게 빛남).
##   1.5m 안에 들면 줍는다(별조각·상자와 같은 "다가가면" 문법 — 이 판엔 줍기 단추가 없다). 캔 때를
##   PartyState.gather_t 에 적고, 일반 30분·특산물 1시간(실제 시각) 뒤 그 자리에 다시 난다.
## 모양은 코드로 그린 작은 풀·열매·조개(충돌 없음). test_village.gd 가 로드 뒤에 짓는다.

const Cooking := preload("res://games/saga_go/data/cooking.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

signal gathered(item: String)

const PICK_M := 1.5
const PICK_DY := 2.2
const CHECK_SEC := 1.0

var _nodes: Dictionary = {} # 채집물 id → Node3D(지금 나 있는 것만)
var _player: Node3D = null
var _check_t := 0.0

func _ready() -> void:
	add_to_group("go_gathering")
	_player = get_tree().get_first_node_in_group("player")
	refresh()

## 모든 채집물 [id, 채집물, 지역, 자리].
static func all_nodes() -> Array:
	var out: Array = []
	for row in Cooking.PATCHES:
		var n: int = row[4]
		for k in n:
			out.append([String(row[0]) + "_%d" % k, row[1], row[2], pos_of(row, k)])
	return out

static func pos_of(patch: Array, k: int) -> Vector3:
	var g: Vector2 = patch[3]
	var p := TestMap.world_pos(g.x, g.y, patch[2]) + Cooking.node_offset(k, int(patch[4]))
	p.y = TerrainBuilder.height_at(patch[2], p)
	return p

static func is_grown(id: String, item: String) -> bool:
	if not PartyState.gather_t.has(id):
		return true
	return Cooking.now() - float(PartyState.gather_t[id]) >= Cooking.respawn_sec(item)

## 다시 자란 것을 짓고 캔 것을 치운다(불러오기 뒤·시계를 돌린 점검 뒤에도 부른다).
func refresh() -> void:
	for row in all_nodes():
		var id: String = row[0]
		var grown := is_grown(id, row[1])
		if grown and not _nodes.has(id):
			_build(id, row[1], row[3])
		elif not grown and _nodes.has(id):
			(_nodes[id] as Node3D).queue_free()
			_nodes.erase(id)

func grown_count(item: String = "") -> int:
	if item == "":
		return _nodes.size()
	var n := 0
	for id in _nodes:
		if (_nodes[id] as Node3D).get_meta("item") == item:
			n += 1
	return n

## 지금 자라 있는 그 채집물 중 from 에 가장 가까운 자리(없으면 INF) — 이야기 임무 gather 목표(106장 ㉗).
func nearest(item: String, from: Vector3) -> Vector3:
	var best := Vector3.INF
	for id in _nodes:
		var n: Node3D = _nodes[id]
		if n.get_meta("item") == item and (best == Vector3.INF or from.distance_to(n.global_position) < from.distance_to(best)):
			best = n.global_position
	return best

func node_pos(id: String) -> Vector3:
	return (_nodes[id] as Node3D).global_position if _nodes.has(id) else Vector3.INF

func _physics_process(delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		return
	var p := _player.global_position
	for id in _nodes.keys():
		var n: Node3D = _nodes[id]
		var d := n.global_position - p
		if absf(d.y) <= PICK_DY and Vector2(d.x, d.z).length() <= PICK_M:
			pick(id)
	_check_t -= delta
	if _check_t <= 0.0:
		_check_t = CHECK_SEC
		refresh()

func pick(id: String) -> bool:
	if not _nodes.has(id):
		return false
	var n: Node3D = _nodes[id]
	var item: String = n.get_meta("item")
	PartyState.gather_t[id] = Cooking.now()
	var got := preload("res://games/saga_go/data/go_starchart.gd").herb_count(1)   # G-0215 성도 채집(무욕 ×0.5 — 0 이면 빈손)
	if got > 0:
		PartyState.add_items({item: got})
	CombatFeel.pickup(n, "%s +%d" % [Cooking.GATHER[item].name, got])
	if Cooking.is_special(item):
		Toast.show(self, "특산물 %s — 가진 것 %d (인물 돌파에 쓴다)" % [Cooking.GATHER[item].name, PartyState.count(item)], 2.2)
	_nodes.erase(id)
	n.queue_free()
	if _player != null and _player.has_method("play_once"):
		_player.call("play_once", "gather", 0.9)   # G-0282
	gathered.emit(item)
	return true

# ---------------------------------------------------------------- 모양

func _build(id: String, item: String, pos: Vector3) -> void:
	var root := Node3D.new()
	root.name = "Gather_" + id
	root.set_meta("item", item)
	add_child(root)
	root.global_position = pos
	root.rotation.y = float(hash(id) % 628) / 100.0
	var c: Color = Cooking.GATHER[item].color
	match item:
		"mint":
			for i in 5:
				var a := TAU * i / 5.0
				_blob(root, Vector3(cos(a) * 0.12, 0.16 + 0.04 * (i % 2), sin(a) * 0.12), Vector3(0.14, 0.05, 0.08), c, a)
		"honey_flower", "orchid", "ash_flower", "snow_bloom":
			for i in 3:
				var off := Vector3(cos(i * 2.1) * 0.16, 0.0, sin(i * 2.1) * 0.16)
				var h := 0.32 + 0.08 * i
				_stem(root, off, h, {"ash_flower": Color(0.45, 0.45, 0.42), "snow_bloom": Color(0.55, 0.7, 0.68)}.get(item, Color(0.3, 0.55, 0.25)))
				for pi in 5:
					var a := TAU * pi / 5.0
					_blob(root, off + Vector3(cos(a) * 0.06, h, sin(a) * 0.06), Vector3(0.06, 0.025, 0.06), c, a)
				_blob(root, off + Vector3(0.0, h + 0.01, 0.0), Vector3(0.035, 0.035, 0.035), Color(1.0, 0.95, 0.6), 0.0)
		"apple":
			for i in 2:
				_blob(root, Vector3(0.1 * i - 0.05, 0.1, 0.06 * i), Vector3(0.11, 0.1, 0.11), c, 0.0)
				_blob(root, Vector3(0.1 * i - 0.05, 0.21, 0.06 * i), Vector3(0.05, 0.015, 0.03), Color(0.3, 0.6, 0.25), 0.4)
		"mushroom":
			for i in 3:
				var off := Vector3(cos(i * 2.4) * 0.14, 0.0, sin(i * 2.4) * 0.14)
				var h := 0.14 + 0.05 * i
				_stem(root, off, h, Color(0.93, 0.9, 0.82), 0.035)
				_blob(root, off + Vector3(0.0, h, 0.0), Vector3(0.12, 0.06, 0.12), c, 0.0)
		"clam":
			for i in 3:
				_blob(root, Vector3(cos(i * 2.0) * 0.14, 0.03, sin(i * 2.0) * 0.14), Vector3(0.09, 0.035, 0.07), c, i * 0.7)
		"conch":
			var cone := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = 0.0
			cm.bottom_radius = 0.12
			cm.height = 0.3
			cm.radial_segments = 7
			cone.mesh = cm
			cone.material_override = _mat(c)
			cone.rotation = Vector3(0.0, 0.0, deg_to_rad(70.0))
			cone.position = Vector3(0.0, 0.1, 0.0)
			root.add_child(cone)
	if Cooking.is_special(item):
		## 특산물 — 옅은 빛무리(멀리서 보이게, 별조각보다 작게).
		var halo := MeshInstance3D.new()
		var hm := SphereMesh.new()
		hm.radius = 0.45
		hm.height = 0.9
		halo.mesh = hm
		var hmat := StandardMaterial3D.new()
		hmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		hmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		hmat.albedo_color = Color(c.r, c.g, c.b, 0.16)
		halo.material_override = hmat
		halo.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		halo.position = Vector3(0.0, 0.35, 0.0)
		root.add_child(halo)
	_nodes[id] = root

func _mat(c: Color, glow := false) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.8
	if glow:
		m.emission_enabled = true
		m.emission = c * 0.5
	return m

func _blob(root: Node3D, at: Vector3, scale: Vector3, c: Color, yaw: float) -> void:
	var mi := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = 1.0
	s.height = 2.0
	s.radial_segments = 8
	s.rings = 4
	mi.mesh = s
	mi.material_override = _mat(c, Cooking.is_special(String(root.get_meta("item"))))
	mi.scale = scale
	mi.position = at
	mi.rotation.y = yaw
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(mi)

func _stem(root: Node3D, at: Vector3, h: float, c: Color, r: float = 0.012) -> void:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = r
	cm.bottom_radius = r
	cm.height = h
	cm.radial_segments = 5
	mi.mesh = cm
	mi.material_override = _mat(c)
	mi.position = at + Vector3(0.0, h * 0.5, 0.0)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(mi)
