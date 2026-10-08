extends Node3D

## G-0061 — 사가만리 집 안. 마을 집 문 앞에서 F → 세상 밖에 놓은 실내 껍데기(int_* 12, 집마다 하나)로 들어간다.
##   문 열둘: 마을집 House_4·5 · 역참 Waystation · 마을 꾸밈 오두막 VHouse_0~5(village_dressing.gd — 자리가 막혀 안 선 집은 빠짐,
##            6번은 늘 막혀 뺐다) · 옛 사당(제단 곁)·폐허(기둥 무리 곁)·녹슨 조선소 창고 "안으로" 표지. 집 문은 house_builder 대로 앞(+Z, 돌림 반영) 가운데.
##   껍데기 = 바닥·벽·문틀·창·벽난로… + 천장 판·천장 등(위쪽 표면). 천장 쪽 표면은 그리기·충돌에서 빼서 위에서 내려다보는
##   "인형의 집" 시점(3인칭 카메라가 천장에 안 막힌다). 앞(+Z)이 트여 있어 보이지 않는 벽으로 막는다. 면이 뒤집혀 있어 충돌은 backface_collision.
##   안: 가운데 따뜻한 등·"한숨 돌리기 [F]"(들어갈 때마다 한 번, 명단 체력 가득) · 처음 들어간 집마다 작은 보물(한 번 실행에 한 번 — 저장 안 함).
##   나감 = 문 안쪽 빛 원판에서 F 또는 "집 나가기". 들어간 동안 해·환경광을 낮춘다(cave_interior.darken_scene).

const GLBUtils := preload("res://saga_core/world/glb_utils.gd")
const Landmarks := preload("res://games/saga_go/world/landmarks_builder.gd")
const VillageDressing := preload("res://games/saga_go/world/village_dressing.gd")
const CaveInterior := preload("res://games/saga_go/world/cave_interior.gd")
const EraSites := preload("res://games/saga_go/world/era_sites.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const DIR := "res://assets/world/"
const ORIGIN := Vector3(1400.0, 40.0, 300.0)   # 굴(z 0~120)보다 남쪽, 비경 원판(x −1400)과 먼 세상 밖
const GAP := 30.0                              # 껍데기 사이
const DOOR_M := 2.8                            # 문 앞 곁
const USE_M := 2.0
const CEIL_FRAC := 0.78                        # 이 높이(벽 꼭대기 비율) 위에서 시작하는 표면 = 천장 쪽 — 그리지 않는다
const FRONT_CUT := 0.4                         # 앞 가장자리에서 이만큼 안의 삼각형 = 앞벽 — 걷어낸다
const DARK_SUN := 0.45
const DARK_AMBIENT := 0.6
const FIRST_GIFT := {"mora": 300}

## 문 → 껍데기. kind: house(노드 이름 — 앞 +Z 문) · spot(Landmarks 정적 자리 + dx·dz).
const DOORS := [
	{"id": "house_4", "kind": "house", "node": "House_4", "shell": "int_hanok_01", "name": "마을 기와집"},
	{"id": "house_5", "kind": "house", "node": "House_5", "shell": "int_jp_minka_01", "name": "마을 너와집"},
	{"id": "waystation", "kind": "house", "node": "Waystation", "shell": "int_inn_01", "name": "역참 객사"},
	{"id": "vhouse_0", "kind": "house", "node": "VHouse_0", "shell": "int_forest_cottage_01", "name": "숲가 오두막"},
	{"id": "vhouse_1", "kind": "house", "node": "VHouse_1", "shell": "int_eu_house_01", "name": "벽돌 집"},
	{"id": "vhouse_2", "kind": "house", "node": "VHouse_2", "shell": "int_silkroad_house_01", "name": "흙벽 집"},
	{"id": "vhouse_3", "kind": "house", "node": "VHouse_3", "shell": "int_chinese_hall_01", "name": "넓은 대청"},
	{"id": "vhouse_4", "kind": "house", "node": "VHouse_4", "shell": "int_barn_01", "name": "헛간"},
	{"id": "vhouse_5", "kind": "house", "node": "VHouse_5", "shell": "int_future_dome_01", "name": "별배 손님의 방"},
	{"id": "shrine", "kind": "spot", "at": "shrine", "dx": 0.0, "dz": 3.0, "shell": "int_stone_tower_01", "name": "옛 사당 돌탑 안"},
	{"id": "ruins", "kind": "spot", "at": "ruins", "dx": 0.0, "dz": -6.0, "shell": "int_dungeon_gate_01", "name": "폐허 지하 문간"},
	## 녹슨 조선소(era_sites.gd) 창고 — 6×3.4×5m 상자(조선소 자리 + (7.5, 9.0)) 앞(+Z) 문. 바닥 콘크리트 판 0.3m 위.
	{"id": "shipyard_shed", "kind": "spot", "at": "shipyard", "dx": 7.5, "dz": 12.7, "shell": "int_modern_block_01", "name": "조선소 창고"},
]

## 가구 세 벌 — [파일, 기준 x(−1 왼벽·0 가운데·1 오른벽), 기준 z(−1 뒷벽·0 가운데·1 앞), dx, dz(안쪽으로), 돌림(도), 위 높이, 막음].
const SET_OLD := [
	["rug_round_01", 0, 0, 0.0, -0.3, 0.0, 0.0, false],
	["bed_futon_01", -1, -1, 0.75, 1.15, 0.0, 0.0, false],
	["low_table_01", 1, -1, -1.3, 0.9, 0.0, 0.0, true],
	["oil_lamp_01", 1, -1, -1.3, 0.9, 0.0, 0.35, false],
	["stool_01", 1, -1, -1.3, 1.6, 0.0, 0.0, false],
	["cabinet_low_01", 0, -1, -0.6, 0.35, 0.0, 0.0, true],
	["chest_01", -1, 1, 0.75, -1.6, 90.0, 0.0, true],
	["barrel_01", 1, 1, -0.6, -1.4, 0.0, 0.0, true],
]
const SET_NEW := [
	["rug_rect_01", 0, 0, 0.0, -0.3, 0.0, 0.0, false],
	["bed_wood_01", -1, -1, 0.75, 1.2, 0.0, 0.0, true],
	["table_round_01", 1, -1, -1.2, 1.2, 0.0, 0.0, true],
	["table_lamp_01", 1, -1, -1.2, 1.2, 0.0, 0.76, false],
	["chair_wood_01", 1, -1, -1.2, 2.05, 180.0, 0.0, false],
	["bookshelf_01", 0, -1, -0.3, 0.3, 0.0, 0.0, true],
	["stove_iron_01", -1, 0, 0.45, 0.6, 90.0, 0.0, true],
]
const SET_STORE := [
	["crate_stack_01", -1, -1, 1.1, 1.1, 0.0, 0.0, true],
	["barrel_01", 1, -1, -0.6, 0.6, 0.0, 0.0, true],
	["barrel_01", 1, -1, -1.5, 0.6, 0.0, 0.0, true],
	["map_table_01", 0, -1, 0.0, 1.0, 0.0, 0.0, true],
	["oil_lamp_01", 0, -1, 0.3, 1.0, 0.0, 0.89, false],
	["crate_small_01", 1, 1, -0.6, -1.5, 20.0, 0.0, true],
	["chest_01", -1, 1, 0.75, -1.6, 90.0, 0.0, true],
]
const FURNISH := {"int_eu_house_01": SET_NEW, "int_future_dome_01": SET_NEW,
	"int_barn_01": SET_STORE, "int_dungeon_gate_01": SET_STORE, "int_modern_block_01": SET_STORE}   # 나머지는 SET_OLD

var inside := ""                 # 들어가 있는 문 id("" = 밖)
var rested := false              # 이번 들어감에 쉬었나
var gifted: Dictionary = {}      # 처음 들어가 받은 집(한 번 실행 동안)
var used_files: Dictionary = {}  # 지은 껍데기(점검)

var _player: Node3D
var _doors: Dictionary = {}      # id → {pos(문 앞 바닥), fwd(문 밖 방향)}
var _rooms: Dictionary = {}      # id → {root, entry, exit, rest}
var _return_pos := Vector3.ZERO
var _dark_saved := {}
var _scan_t := 1.0
var _btn: Button
var _hud_layer: CanvasLayer
var _hud: Label


func _ready() -> void:
	add_to_group("go_house_interiors")
	_player = get_tree().get_first_node_in_group("player")
	if not InputMap.has_action("go_domain"):   # domains.gd·cave_interior.gd 와 같은 F
		InputMap.add_action("go_domain")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_F
		InputMap.action_add_event("go_domain", ev)
	_build_hud()


## 문 자리를 다시 찾는다(마을 꾸밈 집은 씬이 다 선 뒤 call_deferred 로 선다 — 첫 1초 뒤 한 번, 점검도 부른다).
func scan_doors() -> void:
	_doors.clear()
	var scene := get_tree().current_scene
	for d: Dictionary in DOORS:
		if String(d.kind) == "house":
			var n := scene.find_child(String(d.node), true, false) as Node3D if scene else null
			if n == null:
				continue
			var depth := _house_depth(String(d.node))
			var fwd := n.global_transform.basis.z.normalized()
			_doors[d.id] = {"pos": n.global_position + fwd * (depth * 0.5 + 1.2), "fwd": fwd}
		else:
			var base: Vector3
			match String(d.at):
				"shrine":
					base = Landmarks.shrine_pos()
				"ruins":
					base = Landmarks.ruins_pos()
				_:
					base = EraSites.cell_pos("coast", EraSites.SHIPYARD_CELL) + Vector3(0, 0.3, 0)
			_doors[d.id] = {"pos": base + Vector3(float(d.dx), 0, float(d.dz)), "fwd": Vector3(0, 0, 1)}
	for id in _doors:
		_add_sign(id)


func door_ids() -> Array:
	return _doors.keys()


func door_pos(id: String) -> Vector3:
	return (_doors.get(id, {}) as Dictionary).get("pos", Vector3.INF)


## 집 깊이(문 방향 길이, m).
static func _house_depth(node_name: String) -> float:
	if node_name.begins_with("VHouse_"):
		var i := int(node_name.substr(7))
		return float(VillageDressing.HOUSES[i][4]) if i < VillageDressing.HOUSES.size() else 8.0
	return Landmarks.WAYSTATION_FOOTPRINT.z if node_name == "Waystation" else Landmarks.WALL_FOOTPRINT.z


func near_door() -> String:
	if _player == null or inside != "":
		return ""
	for id in _doors:
		var d: Vector3 = _player.global_position - (_doors[id].pos as Vector3)
		d.y = 0.0
		if d.length() <= DOOR_M:
			return id
	return ""


func near_exit() -> bool:
	return inside != "" and _player.global_position.distance_to(_rooms[inside].exit) <= USE_M


func near_rest() -> bool:
	return inside != "" and not rested and _player.global_position.distance_to(_rooms[inside].rest) <= USE_M + 0.5


func room_info(id: String) -> Dictionary:
	return _rooms.get(id, {})


# ---------------------------------------------------------------- 들어감·나감

func enter(id: String) -> bool:
	if inside != "" or _player == null or not _doors.has(id):
		return false
	if not get_tree().get_nodes_in_group("go_domain_active").is_empty():
		return false
	var cave := get_tree().get_first_node_in_group("go_cave")
	if cave and bool(cave.get("inside")):
		return false
	var room := _ensure_room(id)
	if room.is_empty():
		return false
	_return_pos = (_doors[id].pos as Vector3) + (_doors[id].fwd as Vector3) * 0.8
	inside = id
	rested = false
	(room.root as Node3D).visible = true
	CaveInterior.darken_scene(get_parent(), true, _dark_saved, DARK_SUN, DARK_AMBIENT)
	_teleport((room.entry as Vector3) + Vector3(0, 0.3, 0))
	_hud_layer.visible = true
	var title := _door_name(id)
	if not gifted.has(id):
		gifted[id] = true
		PartyState.add_items(FIRST_GIFT)
		Toast.show(self, "🏠 %s — 처음 들어온 집, 서랍에서 모라 %d" % [title, int(FIRST_GIFT.mora)], 3.0)
	else:
		Toast.show(self, "🏠 %s" % title, 2.0)
	_refresh_hud()
	return true


func leave() -> void:
	if inside == "":
		return
	(_rooms[inside].root as Node3D).visible = false
	inside = ""
	CaveInterior.darken_scene(get_parent(), false, _dark_saved, DARK_SUN, DARK_AMBIENT)
	_hud_layer.visible = false
	_teleport(_return_pos + Vector3(0, 0.3, 0))


## 한숨 돌리기 — 들어갈 때마다 한 번, 명단 체력 가득.
func rest() -> bool:
	if inside == "" or rested:
		return false
	rested = true
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	if fc and fc.has_method("heal_all"):
		fc.call("heal_all", 1.0)
	Toast.show(self, "🍵 한숨 돌렸다 — 명단 체력 가득", 2.5)
	_refresh_hud()
	return true


func _door_name(id: String) -> String:
	for d: Dictionary in DOORS:
		if String(d.id) == id:
			return String(d.name)
	return id


func _teleport(p: Vector3) -> void:
	_player.global_position = p
	_player.set("velocity", Vector3.ZERO)
	if _player.has_method("respawn_safe"):
		_player.set("_last_safe", p)


func _physics_process(delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		return
	if _scan_t > 0.0:
		_scan_t -= delta
		if _scan_t <= 0.0:
			scan_doors()
	if _btn:
		var label := ""
		var near := near_door()
		if near != "":
			label = "🏠 %s (F)" % _door_name(near)
		elif near_rest():
			label = "한숨 돌리기 (F)"
		elif near_exit():
			label = "집 밖으로 (F)"
		_btn.visible = label != "" and get_tree().get_nodes_in_group("ui_modal").is_empty()
		_btn.text = label
	if inside != "" and _player.global_position.y < (_rooms[inside].entry as Vector3).y - 3.0:
		_teleport((_rooms[inside].entry as Vector3) + Vector3(0, 0.3, 0))


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("go_domain") and _use():
		get_viewport().set_input_as_handled()


func _use() -> bool:
	if not get_tree().get_nodes_in_group("ui_modal").is_empty():
		return false
	var near := near_door()
	if near != "":
		return enter(near)
	if near_rest():
		return rest()
	if near_exit():
		leave()
		return true
	return false


# ---------------------------------------------------------------- 짓기

func _shell_of(id: String) -> String:
	for d: Dictionary in DOORS:
		if String(d.id) == id:
			return String(d.shell)
	return ""


## 껍데기 하나를 처음 들어갈 때 짓는다(점검은 모두 짓게 build_all).
func _ensure_room(id: String) -> Dictionary:
	if _rooms.has(id):
		return _rooms[id]
	var file := _shell_of(id)
	var src := GLBUtils.extract_mesh(DIR + file + ".glb")
	if src == null:
		push_warning("실내 껍데기 없음: " + file)
		return {}
	used_files[file] = true
	var idx := 0
	for i in DOORS.size():
		if String(DOORS[i].id) == id:
			idx = i
	var o := ORIGIN + Vector3(0, 0, idx * GAP)
	var root := Node3D.new()
	root.name = "Interior_" + id
	root.visible = false
	add_child(root)
	root.global_position = o
	## 표면 나눔 — 천장 쪽(꼭대기 비율 위에서 시작)은 그리기·충돌에서 빼고, 앞벽(앞 가장자리 FRONT_CUT 안 삼각형)도 걷어낸다
	## (인형의 집 — 3인칭 카메라가 문 쪽 벽·문틀에 걸려 코앞으로 당겨지지 않게).
	var a := src.get_aabb()
	var top := a.end.y
	var cut_z := a.end.z - FRONT_CUT
	var keep := ArrayMesh.new()
	var faces := PackedVector3Array()
	for s in src.get_surface_count():
		var arr: Array = src.surface_get_arrays(s)
		var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var lo := INF
		for p in v:
			lo = minf(lo, p.y)
		if lo >= top * CEIL_FRAC:
			continue
		if arr[Mesh.ARRAY_INDEX] != null:
			var src_idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
			var idxs := PackedInt32Array()
			for t in range(0, src_idx.size(), 3):
				if v[src_idx[t]].z >= cut_z and v[src_idx[t + 1]].z >= cut_z and v[src_idx[t + 2]].z >= cut_z:
					continue
				idxs.append_array([src_idx[t], src_idx[t + 1], src_idx[t + 2]])
			if idxs.is_empty():
				continue
			arr[Mesh.ARRAY_INDEX] = idxs
			for k in idxs:
				faces.append(v[k])
		else:
			faces.append_array(v)
		keep.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		keep.surface_set_material(keep.get_surface_count() - 1, src.surface_get_material(s))
	var mi := MeshInstance3D.new()
	mi.name = file
	mi.mesh = keep
	root.add_child(mi)
	var shape := ConcavePolygonShape3D.new()
	shape.set_faces(faces)
	shape.backface_collision = true   # 면이 뒤집혀 있다(굴 조각과 같다, 10-08 실측)
	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	cs.shape = shape
	body.add_child(cs)
	root.add_child(body)
	## 트인 앞(+Z)을 막는 보이지 않는 벽 — 경계 층(플레이어는 막고 카메라 끈[층 1]은 지나간다, 아니면 등 뒤 벽에 카메라가 코앞으로 당겨진다).
	var front := StaticBody3D.new()
	front.collision_layer = TerrainBuilder.BORDER_LAYER
	front.collision_mask = 0
	var fs := BoxShape3D.new()
	fs.size = Vector3(a.size.x, 4.0, 0.4)
	var fcs := CollisionShape3D.new()
	fcs.shape = fs
	front.add_child(fcs)
	root.add_child(front)
	front.position = Vector3(a.get_center().x, 2.0, a.end.z + 0.2)
	## 자리 — 문 안쪽(앞 가장자리에서 2m — 카메라가 방을 내려다볼 틈), 가운데 쉬는 자리.
	var entry := o + Vector3(a.get_center().x, 0, a.end.z - 2.0)
	var exit := o + Vector3(a.get_center().x, 0, a.end.z - 0.7)
	var rest_at := o + Vector3(a.get_center().x, 0, a.get_center().z - 0.6)
	_add_disc(root, exit - o, Color(0.75, 0.9, 1.0), "집 밖으로 [F]")
	_add_disc(root, rest_at - o, Color(1.0, 0.8, 0.5), "한숨 돌리기 [F]")
	_furnish(root, a, file)
	## 방 밑·앞의 어두운 땅판(세상 밖이라 걷어낸 앞벽 너머로 하늘이 비치지 않게 — 그리기만).
	var ground := MeshInstance3D.new()
	var gm := BoxMesh.new()
	gm.size = Vector3(a.size.x + 16.0, 0.2, a.size.z + 20.0)
	ground.mesh = gm
	var gmat := StandardMaterial3D.new()
	gmat.albedo_color = Color(0.16, 0.13, 0.1)
	gmat.roughness = 1.0
	ground.material_override = gmat
	ground.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	ground.position = Vector3(a.get_center().x, -0.25, a.get_center().z + 5.0)
	root.add_child(ground)
	var lamp := OmniLight3D.new()
	lamp.light_color = Color(1.0, 0.78, 0.5)
	lamp.light_energy = 2.4
	lamp.omni_range = maxf(a.size.x, a.size.z) * 0.9
	lamp.shadow_enabled = false
	root.add_child(lamp)
	lamp.position = Vector3(a.get_center().x, top * 0.8, a.get_center().z)
	var room := {"root": root, "entry": entry, "exit": exit, "rest": rest_at}
	_rooms[id] = room
	return room


## 껍데기 상자 a 안에 가구 한 벌(가구 GLB 는 자체툴 것 그대로, 큰 것만 상자 충돌).
func _furnish(root: Node3D, a: AABB, shell: String) -> void:
	for f: Array in FURNISH.get(shell, SET_OLD):
		var m := GLBUtils.extract_mesh(DIR + String(f[0]) + ".glb")
		if m == null:
			continue
		var ax := [a.position.x, a.get_center().x, a.end.x][int(f[1]) + 1] as float
		var az := [a.position.z, a.get_center().z, a.end.z][int(f[2]) + 1] as float
		var at := Vector3(ax + float(f[3]), float(f[6]), az + float(f[4]))
		var mi := MeshInstance3D.new()
		mi.name = "Furn_" + String(f[0])
		mi.mesh = m
		mi.position = at
		mi.rotation_degrees.y = float(f[5])
		root.add_child(mi)
		if bool(f[7]):
			var box := m.get_aabb()
			var body := StaticBody3D.new()
			var bs := BoxShape3D.new()
			bs.size = box.size
			var cs := CollisionShape3D.new()
			cs.shape = bs
			cs.position = box.get_center()
			body.add_child(cs)
			body.position = at
			body.rotation_degrees.y = float(f[5])
			root.add_child(body)


func build_all() -> void:
	for d: Dictionary in DOORS:
		_ensure_room(String(d.id))


func _add_disc(root: Node3D, local: Vector3, c: Color, text: String) -> void:
	var mi := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.6
	cyl.bottom_radius = 0.6
	cyl.height = 0.04
	mi.mesh = cyl
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(c.r, c.g, c.b, 0.6)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = local + Vector3(0, 0.04, 0)
	root.add_child(mi)
	var label := Label3D.new()
	label.text = text
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 26
	label.outline_size = 8
	label.position = local + Vector3(0, 1.3, 0)
	root.add_child(label)


func _add_sign(id: String) -> void:
	var old := get_node_or_null("DoorSign_" + id)
	if old:
		old.free()
	var label := Label3D.new()
	label.name = "DoorSign_" + id
	label.text = "🏠 %s [F]" % _door_name(id)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 36
	label.outline_size = 8
	label.visibility_range_end = 30.0   # 마을 위로 표지가 빽빽하지 않게 — 가까이 와야 보인다
	add_child(label)
	label.global_position = (_doors[id].pos as Vector3) + Vector3(0, 2.6, 0)


func _build_hud() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 5
	add_child(layer)
	_btn = Button.new()
	_btn.anchor_left = 0.5
	_btn.anchor_right = 0.5
	_btn.anchor_top = 1.0
	_btn.anchor_bottom = 1.0
	_btn.offset_left = -100
	_btn.offset_right = 100
	_btn.offset_top = -222
	_btn.offset_bottom = -176
	_btn.visible = false
	_btn.pressed.connect(_use)
	layer.add_child(_btn)
	_hud_layer = CanvasLayer.new()
	_hud_layer.layer = 5
	_hud_layer.visible = false
	add_child(_hud_layer)
	_hud = Label.new()
	_hud.anchor_left = 0.5
	_hud.anchor_right = 0.5
	_hud.offset_left = -300
	_hud.offset_right = 300
	_hud.offset_top = 70
	_hud.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hud.add_theme_font_size_override("font_size", 18)
	_hud.add_theme_color_override("font_outline_color", Color(0, 0, 0))
	_hud.add_theme_constant_override("outline_size", 6)
	_hud_layer.add_child(_hud)
	var quit := Button.new()
	quit.text = "집 나가기"
	quit.anchor_left = 0.5
	quit.anchor_right = 0.5
	quit.offset_left = 320
	quit.offset_right = 430
	quit.offset_top = 64
	quit.offset_bottom = 104
	quit.pressed.connect(leave)
	_hud_layer.add_child(quit)


func hud_text() -> String:
	return _hud.text if _hud else ""


func _refresh_hud() -> void:
	if _hud and inside != "":
		_hud.text = "🏠 %s — %s" % [_door_name(inside), "쉬었다" if rested else "가운데에서 한숨 돌리기 [F]"]
