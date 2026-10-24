extends Node3D

## G-0242 3마을 땅 아래 층(웹 W-0285 의 고돗 짝) — 마을 동쪽 바위 아치(GATE_GRID)에서 [G] → 세상 밖 먼 좌표(CAVE_ORIGIN)의 평평한 방.
##   방 하나를 층마다 다시 짓는다(구면 투영 안 씀 — 집 안 forest_house.gd INTERIOR_ORIGIN 과 같은 길, 평범한 StandardMaterial3D).
##   결   0~1층 흙 · 2~3층 석회 · 4~5층 용암(색 도형 — 새 에셋 없음).
##   사물 data/forest_cave.gd SPOT(웹 방 타일 좌표) × CELL 미터. 북쪽 벽 사다리 = 위로(0층이면 마을로).
##   어둠 들 때 해·환경광을 낮추고(darken_scene) 나갈 때 되돌린다. 플레이어 손 불빛 OmniLight = 어둠 LIGHT_DARK / 횃불 LIGHT_LIT.
##   글자·불빛은 0.25초마다만 고친다(매 틱 셈 안 함).
## darken_scene 은 saga_go cave_interior.gd 의 같은 이름 함수와 같은 계약 — 판끼리 서로 못 불러(check_refs) 여기 둔다.

const Cave := preload("res://games/saga_forest/data/forest_cave.gd")
const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const TerrainBuilder := preload("res://games/saga_forest/world/forest_terrain_builder.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const GATE_GRID := Vector2i(27, 11)   # 길 남쪽 동편 — 마을 사람·채집 자리·제작대·집·빈 집 자리와 2칸 넘게 떨어진 빈 칸
const CAVE_ORIGIN := Vector3(-500, 0, 500)   # 집 안(500,0,500)과 반대편 — 마을·집 안과 안 겹친다
const CELL := 1.5            # 웹 방 타일 1 칸 → 1.5m (방 8×9 칸 = 12×13.5m)
const ROOM := Vector2(8, 9)
const WALL_H := 3.0
const GATE_M := 2.6          # 바깥 아치 곁
const REACH := 1.8           # 안의 사물 곁
const LIGHT_DARK := 2.5
const LIGHT_LIT := 9.0
const DARK_SUN := 0.05
const DARK_AMBIENT := 0.12
const CURVE_AMOUNT := 0.004
const MOODS := [
	{"floor": Color(0.36, 0.27, 0.18), "wall": Color(0.30, 0.22, 0.15)},   # 흙
	{"floor": Color(0.62, 0.60, 0.55), "wall": Color(0.52, 0.50, 0.46)},   # 석회
	{"floor": Color(0.22, 0.16, 0.14), "wall": Color(0.34, 0.14, 0.08)},   # 용암
]

var inside := false
var run: Dictionary = Cave.new_run()
var gate_pos := Vector3.ZERO
var player_light: OmniLight3D = null

var _player: Node3D = null
var _room: Node3D = null
var _objs: Dictionary = {}     # 사물 id → {node, label, o}
var _dark_saved: Dictionary = {}
var _hud: Label = null
var _tick := 0.0


func _ready() -> void:
	name = "ForestCave"
	var ground: float = TerrainBuilder.LEGEND["."].height
	gate_pos = ForestMap.world_pos(GATE_GRID.x, GATE_GRID.y) + Vector3(0, ground, 0)
	_build_gate()
	var layer := CanvasLayer.new()
	add_child(layer)
	_hud = Label.new()
	_hud.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_hud.position = Vector2(-220, 64)
	_hud.size = Vector2(440, 30)
	_hud.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hud.add_theme_font_size_override("font_size", 22)
	_hud.add_theme_color_override("font_outline_color", Color.BLACK)
	_hud.add_theme_constant_override("outline_size", 6)
	_hud.visible = false
	layer.add_child(_hud)


func _build_gate() -> void:
	var g := Node3D.new()
	g.name = "CaveGate"
	g.position = gate_pos
	add_child(g)
	var rock := Color(0.42, 0.40, 0.37)
	for sx: float in [-1.1, 1.1]:
		_curved_box(g, Vector3(0.7, 2.4, 0.8), Vector3(sx, 1.2, 0), rock)
	_curved_box(g, Vector3(3.0, 0.7, 0.9), Vector3(0, 2.6, 0), rock.darkened(0.1))
	_curved_box(g, Vector3(1.5, 2.2, 0.1), Vector3(0, 1.1, -0.3), Color(0.04, 0.03, 0.03))   # 어두운 굴 입
	var body := StaticBody3D.new()
	for sx: float in [-1.1, 1.1]:
		var cs := CollisionShape3D.new()
		var sh := BoxShape3D.new()
		sh.size = Vector3(0.7, 2.4, 0.8)
		cs.shape = sh
		cs.position = Vector3(sx, 1.2, 0)
		body.add_child(cs)
	g.add_child(body)
	g.add_child(_label("⛏ 땅 아래 굴 [G]", Vector3(0, 3.4, 0), 24))


func _curved_box(parent: Node3D, size: Vector3, pos: Vector3, c: Color) -> void:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.position = pos
	mi.material_override = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.95, c)
	parent.add_child(mi)


func _label(text: String, pos: Vector3, size := 20) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.fixed_size = true
	l.pixel_size = 0.0012
	l.font_size = size
	l.outline_size = 7
	l.position = pos
	return l


func near_gate() -> bool:
	if _player == null or inside:
		return false
	var d := _player.global_position - gate_pos
	return Vector2(d.x, d.z).length() <= GATE_M


func _process(delta: float) -> void:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player")
		if _player == null:
			return
		rescue_if_stranded()
	if Input.is_action_just_pressed("forest_gather"):
		if inside:
			var r := use_nearest()
			if not r.is_empty():
				Toast.show(self, String(r.text), 2.5)
		elif near_gate():
			enter()
	_tick -= delta
	if inside and _tick <= 0.0:
		_tick = 0.25
		refresh()


## 굴 안에서 저장(자동 저장·유물)한 세이브를 불러오면 방이 없는 먼 좌표에 선다 → 아치 앞으로(지금 층은 저장 안 함).
func rescue_if_stranded() -> bool:
	if inside or _player == null or _player.global_position.distance_to(CAVE_ORIGIN) > 40.0:
		return false
	_teleport(gate_pos + Vector3(0, 0.1, 2.0))
	return true


## 들어간다 — 0층 북쪽 사다리 앞으로.
func enter() -> void:
	if inside:
		return
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
	preload("res://saga_core/ui/zone_cut.gd").begin(get_tree())   # G-0384 넘김 막 — 굴 짓는 동안 덮음
	inside = true
	run = Cave.new_run()
	_darken(true)
	player_light = OmniLight3D.new()
	player_light.name = "CaveHandLight"
	player_light.position = Vector3(0, 1.6, 0)
	player_light.light_color = Color(1.0, 0.78, 0.5)
	player_light.light_energy = 1.4
	player_light.shadow_enabled = false
	if _player:
		_player.add_child(player_light)
	_build_floor()
	_teleport(_spot("door") + Vector3(0, 0.1, 1.4))
	_hud.visible = true
	refresh()
	Toast.show(self, "⛏ 굴 안으로 — 땅 아래는 어둡다. 횃불 받침에 솔방울 하나면 2분 밝다.", 3.0)


## 나간다 — 마을 아치 앞으로, 해·환경광 되돌림.
func leave() -> void:
	if not inside:
		return
	preload("res://saga_core/ui/zone_cut.gd").begin(get_tree())
	inside = false
	_darken(false)
	if player_light and is_instance_valid(player_light):
		player_light.queue_free()
	player_light = null
	if _room:
		_room.queue_free()
	_room = null
	_objs.clear()
	_hud.visible = false
	_teleport(gate_pos + Vector3(0, 0.1, 2.0))


## 가장 가까운 사물(사다리 위로 포함)을 쓴다 → 결과(없으면 {}).
func use_nearest() -> Dictionary:
	if not inside or _player == null:
		return {}
	var best := ""
	var bd := REACH
	var p := _player.global_position
	for id: String in _objs.keys():
		var n: Node3D = _objs[id].node
		var d := Vector2(n.global_position.x - p.x, n.global_position.z - p.z).length()
		if d < bd:
			bd = d
			best = id
	var dp := _spot("door")
	if Vector2(dp.x - p.x, dp.z - p.z).length() < bd:
		best = "door"
	return act_id(best) if best != "" else {}


## 사물 id 로 쓴다(점검도 부른다). door = 위로(0층이면 마을로).
func act_id(id: String) -> Dictionary:
	if not inside:
		return {}
	var F: Node = ForestSaveState
	if id == "door":
		var u: Dictionary = Cave.up(run)
		if String(u.kind) == "leave":
			leave()
		else:
			_build_floor()
			_teleport(_spot("ladder") + Vector3(0, 0.1, -1.4))
		return u
	if not _objs.has(id):
		return {}
	var r: Dictionary = Cave.act(F, run, _objs[id].o)
	if String(r.kind) == "down":
		_build_floor()
		_teleport(_spot("door") + Vector3(0, 0.1, 1.4))
	elif bool(r.ok) and String(r.kind) == "relic":
		F.save()
	refresh()
	return r


func _spot(id: String) -> Vector3:
	var s: Vector2 = Cave.SPOT[id]
	return CAVE_ORIGIN + Vector3((s.x - ROOM.x * 0.5) * CELL, 0, (s.y - ROOM.y * 0.5) * CELL)


func _teleport(p: Vector3) -> void:
	if _player == null:
		return
	_player.global_position = p
	_player.set("velocity", Vector3.ZERO)


func _mood() -> Dictionary:
	return MOODS[clampi(floori(int(run.floor) / 2.0), 0, 2)]   # 0·1 흙 · 2·3 석회 · 4·5 용암


## 지금 층 방을 (다시) 짓는다.
func _build_floor() -> void:
	if _room:
		_room.queue_free()
	_objs.clear()
	_room = Node3D.new()
	_room.name = "CaveFloor_%d" % int(run.floor)
	_room.position = CAVE_ORIGIN
	add_child(_room)
	var mood := _mood()
	var w := ROOM.x * CELL
	var h := ROOM.y * CELL
	_flat_box(_room, Vector3(w, 0.2, h), Vector3(0, -0.1, 0), mood.floor, true)
	_flat_box(_room, Vector3(w + 0.4, WALL_H, 0.2), Vector3(0, WALL_H * 0.5, -h * 0.5 - 0.1), mood.wall, true)
	_flat_box(_room, Vector3(w + 0.4, WALL_H, 0.2), Vector3(0, WALL_H * 0.5, h * 0.5 + 0.1), mood.wall, true)
	_flat_box(_room, Vector3(0.2, WALL_H, h), Vector3(-w * 0.5 - 0.1, WALL_H * 0.5, 0), mood.wall, true)
	_flat_box(_room, Vector3(0.2, WALL_H, h), Vector3(w * 0.5 + 0.1, WALL_H * 0.5, 0), mood.wall, true)
	# 북쪽 벽 사다리(위로)
	var door := Node3D.new()
	door.position = _spot("door") - CAVE_ORIGIN
	_room.add_child(door)
	_ladder(door, 2.6)
	door.add_child(_label("🧗 위로%s [G]" % (" — 마을로" if int(run.floor) == 0 else ""), Vector3(0, 2.9, 0)))
	for o: Dictionary in Cave.objects(int(run.floor)):
		var n := Node3D.new()
		n.name = "Cave_" + String(o.id)
		n.position = _spot(String(o.id)) - CAVE_ORIGIN
		_room.add_child(n)
		match String(o.t):
			"torch":
				_flat_box(n, Vector3(0.18, 1.2, 0.18), Vector3(0, 0.6, 0), Color(0.35, 0.25, 0.15), false)
				var fl := OmniLight3D.new()
				fl.name = "Flame"
				fl.position = Vector3(0, 1.4, 0)
				fl.light_color = Color(1.0, 0.6, 0.3)
				fl.omni_range = 6.0
				n.add_child(fl)
			"ore":
				var mi := MeshInstance3D.new()
				mi.name = "Rock"
				var sm := SphereMesh.new()
				sm.radius = 0.55
				sm.height = 0.8
				mi.mesh = sm
				mi.position = Vector3(0, 0.3, 0)
				mi.material_override = _mat(_ore_color(String(o.key)))
				n.add_child(mi)
			"beast":
				var bm := MeshInstance3D.new()
				bm.name = "Body"
				var cm := CapsuleMesh.new()
				cm.radius = 0.35
				cm.height = 1.0
				bm.mesh = cm
				bm.rotation_degrees = Vector3(0, 0, 90)
				bm.position = Vector3(0, 0.4, 0)
				bm.material_override = _mat(Color(0.16, 0.14, 0.14))
				n.add_child(bm)
			"ladder":
				_flat_box(n, Vector3(1.2, 0.05, 1.2), Vector3(0, 0.01, 0), Color(0.02, 0.02, 0.02), false)   # 아래로 뚫린 구멍
				_ladder(n, 1.0)
			"relic":
				_flat_box(n, Vector3(0.7, 0.5, 0.7), Vector3(0, 0.25, 0), mood.wall.lightened(0.2), false)
				var urn := MeshInstance3D.new()
				urn.name = "Urn"
				var um := CylinderMesh.new()
				um.top_radius = 0.15
				um.bottom_radius = 0.25
				um.height = 0.45
				urn.mesh = um
				urn.position = Vector3(0, 0.72, 0)
				urn.material_override = _mat(Color(0.72, 0.52, 0.3))
				n.add_child(urn)
		var l := _label("", Vector3(0, 1.9, 0))
		n.add_child(l)
		_objs[String(o.id)] = {"node": n, "label": l, "o": o}


func _ladder(parent: Node3D, height: float) -> void:
	var wood := Color(0.5, 0.36, 0.2)
	for sx: float in [-0.3, 0.3]:
		_flat_box(parent, Vector3(0.07, height, 0.07), Vector3(sx, height * 0.5, 0), wood, false)
	var rungs := int(height / 0.35)
	for i in rungs:
		_flat_box(parent, Vector3(0.6, 0.05, 0.05), Vector3(0, 0.25 + i * 0.35, 0), wood, false)


func _ore_color(key: String) -> Color:
	match key:
		"iron": return Color(0.45, 0.42, 0.4)
		"copper": return Color(0.62, 0.38, 0.22)
		"silver": return Color(0.78, 0.8, 0.82)
		"oldcoin": return Color(0.7, 0.58, 0.25)
		"shard": return Color(0.6, 0.42, 0.3)
	return Color(0.55, 0.52, 0.42)


func _mat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.9
	return m


func _flat_box(parent: Node3D, size: Vector3, pos: Vector3, c: Color, solid: bool) -> void:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.position = pos
	mi.material_override = _mat(c)
	parent.add_child(mi)
	if solid:
		var body := StaticBody3D.new()
		var cs := CollisionShape3D.new()
		var sh := BoxShape3D.new()
		sh.size = size
		cs.shape = sh
		body.position = pos
		body.add_child(cs)
		parent.add_child(body)


## 글자·불빛·사물 모양을 지금 상태에 맞춘다(0.25초마다 · 쓴 직후).
func refresh() -> void:
	if not inside:
		return
	var F: Node = ForestSaveState
	var is_lit: bool = Cave.lit(F)
	if player_light:
		player_light.omni_range = LIGHT_LIT if is_lit else LIGHT_DARK
	var got := Cave.dug(F)
	var shooed: Dictionary = run.shooed
	for id: String in _objs.keys():
		var e: Dictionary = _objs[id]
		(e.label as Label3D).text = Cave.label_of(F, run, e.o)
		var n: Node3D = e.node
		match String(e.o.t):
			"torch":
				(n.get_node("Flame") as OmniLight3D).visible = is_lit
			"ore":
				var done := got.has("%d:%s" % [int(run.floor), id])
				(n.get_node("Rock") as Node3D).scale = Vector3.ONE * (0.55 if done else 1.0)
			"beast":
				(n.get_node("Body") as Node3D).visible = not shooed.has(int(run.floor))
			"relic":
				(n.get_node("Urn") as Node3D).visible = not bool(Cave.st(F).relic)
	_hud.text = Cave.hud(F, run)


func _darken(on: bool) -> void:
	darken_scene(get_parent(), on, _dark_saved, DARK_SUN, DARK_AMBIENT)


## 해·환경광을 낮추거나(on — 원래 값을 saved 에) 되돌린다(saga_go cave_interior.gd 와 같은 계약).
static func darken_scene(scene: Node, on: bool, saved: Dictionary, sun_mul: float, ambient_mul: float) -> void:
	if scene == null:
		return
	var sun := scene.get_node_or_null("Sun") as DirectionalLight3D
	var we := scene.get_node_or_null("WorldEnvironment") as WorldEnvironment
	var env: Environment = we.environment if we else null
	if on:
		saved.clear()
		if sun:
			saved["sun"] = sun.light_energy
			sun.light_energy *= sun_mul
		if env:
			saved["ambient"] = env.ambient_light_energy
			env.ambient_light_energy *= ambient_mul
		return
	if sun and saved.has("sun"):
		sun.light_energy = float(saved.sun)
	if env and saved.has("ambient"):
		env.ambient_light_energy = float(saved.ambient)
	saved.clear()
