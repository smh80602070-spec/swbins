extends Node3D

## G-0305 쉼터(웹 W-0297 rest-site 짝) — 지역마다 모닥불 자리 하나. 다가가 앉으면(SIT_R 안·싸움 중 아님)
##   ① 명단 모두 회복(field_combat.revive_all) ② 부활 자리(PartyState.rest.at)가 그 쉼터로 ③ 그 지역의 쓰러진 잡몹이 바로 다시 선다
##   (들판 보스·드랍 없는 적은 그대로). 처음 앉으면 "불을 지핀다"(rest.lit) — 지핀 쉼터만 불꽃·지도 아이콘.
## 다시 앉으려면 LEAVE_R 밖으로 한 번 나갔다 와야 한다. 다 쓰러지면(party_wiped) 부활 자리 쉼터 옆에서 일어난다(없으면 옛대로).
## 자리 = 그 지역 가운데에서 가장 가까운 풀·모래 칸(. T D — 물·마을·길 아님) 가운데 + SIDE_M 옆(해시 없이 늘 같음).
## SAGA_REST=0 이면 안 붙는다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const GRASS := [".", "T", "D"]   # 들·숲·모래밭(포구는 풀 칸이 없다)
const SIDE_M := 6.0
const SIT_R := 3.5
const LEAVE_R := 12.0
const TICK := 0.4
const FIRE := Color(1.0, 0.55, 0.18)

var _t := 0.0
var _armed := {}       # 쉼터 id → 다시 앉을 수 있나
var _sitting := ""
var _nodes := {}       # 쉼터 id → {root, fire(Node3D), label(Label3D)}
var _fc: Node = null
static var _flame_mat: StandardMaterial3D = null


static func attach(parent: Node) -> Node:
	if OS.get_environment("SAGA_REST") == "0":
		return null
	var n: Node = load("res://games/saga_go/world/rest_sites.gd").new()
	n.name = "RestSites"
	parent.add_child(n)
	return n


## 지역 id → 쉼터 자리(월드). 풀 칸이 없는 지역은 빠진다.
## G-0393 — 열 지역 모든 칸을 훑어 한 번에 15~19ms. 지도는 고정이라 처음 한 번만 세고 그 뒤엔 같은 표(읽기만 — 고치지 말 것).
## 미니맵(world_map)이 그릴 때마다 불러 1만리 프레임마다 15ms 를 먹었다.
static var _sites_cache: Dictionary = {}


static func sites() -> Dictionary:
	if not _sites_cache.is_empty():
		return _sites_cache
	_sites_cache = _scan_sites()
	return _sites_cache


static func _scan_sites() -> Dictionary:
	var out := {}
	for rid: String in TestMap.REGIONS:
		var s := TestMap.size(rid)
		var c := Vector2((s.x - 1) * 0.5, (s.y - 1) * 0.5)
		var best := Vector2i(-1, -1)
		var bd := INF
		for y in s.y:
			for x in s.x:
				if not GRASS.has(TestMap.tile_at(x, y, rid)):
					continue
				var p := TestMap.world_pos(x, y, rid)
				if _wet(rid, p) or _wet(rid, p + Vector3(SIDE_M, 0, 0)):
					continue
				var d := Vector2(x, y).distance_to(c)
				if d < bd:
					bd = d
					best = Vector2i(x, y)
		if best.x < 0:
			continue
		var q := TestMap.world_pos(best.x, best.y, rid) + Vector3(SIDE_M, 0, 0)
		q.y = TerrainBuilder.height_at(rid, q)
		out[rid] = q
	return out


static func _wet(rid: String, p: Vector3) -> bool:
	return TerrainBuilder.height_at(rid, p) < TerrainBuilder.WATER_LEVEL - 0.3


func _rest() -> Dictionary:
	if typeof(PartyState.rest) != TYPE_DICTIONARY or not PartyState.rest.has("lit"):
		PartyState.rest = {"lit": [], "at": ""}
	return PartyState.rest


func is_lit(id: String) -> bool:
	return (_rest().lit as Array).has(id)


func _ready() -> void:
	add_to_group("go_rest_sites")
	var all := sites()
	for id: String in all:
		_armed[id] = true
		_build(id, all[id])
	_refresh()
	_fc = get_tree().get_first_node_in_group("go_field_combat")
	if _fc == null:
		_wire.call_deferred()
	else:
		_wire()


func _wire() -> void:
	if _fc == null:
		_fc = get_tree().get_first_node_in_group("go_field_combat")
	if _fc != null and not _fc.is_connected("party_wiped", _on_wiped):
		_fc.connect("party_wiped", _on_wiped)


func _process(delta: float) -> void:
	_t -= delta
	if _t > 0.0:
		return
	_t = TICK
	var pl := get_tree().get_first_node_in_group("player") as Node3D
	if pl == null:
		return
	for id: String in _nodes:
		var p: Vector3 = (_nodes[id].root as Node3D).global_position
		var d := Vector2(pl.global_position.x - p.x, pl.global_position.z - p.z).length()
		if d > LEAVE_R:
			_armed[id] = true
		if _sitting == id and d > SIT_R:
			_sitting = ""
			if pl.has_method("unhold"):
				pl.call("unhold")
		if d <= SIT_R and bool(_armed[id]):
			if _fc != null and bool(_fc.call("in_combat")):
				continue
			sit(id)


## 쉼터에 앉는다 — 처음이면 불을 지피고, 회복·부활 자리·그 지역 잡몹 다시 섬.
func sit(id: String) -> void:
	if not _nodes.has(id):
		return
	_armed[id] = false
	_sitting = id
	var r := _rest()
	var first := not (r.lit as Array).has(id)
	if first:
		(r.lit as Array).append(id)
	r.at = id
	if _fc != null:
		_fc.call("revive_all")
		_fc.call("_refresh_hud")
	var n := 0
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if int(e.get("ai")) != 6 or not bool(e.get("respawns")) or not bool(e.get("drops")):   # AI.DEAD
			continue
		var s: Script = e.get_script()
		if s != null and String(s.resource_path).ends_with("field_boss.gd"):
			continue
		if TestMap.region_at((e as Node3D).global_position) != id and TestMap.region_at(e.get("home")) != id:
			continue
		e.set("_t", 0.0)
		n += 1
	var pl := get_tree().get_first_node_in_group("player") as Node3D
	if pl != null and pl.has_method("hold"):
		pl.call("hold", "sit_ground")
	_refresh()
	Toast.show(self, ("🔥 불을 지폈다 — " if first else "🔥 ") + "쉬었다 · 여기서 다시 일어난다" + (" · 들판에 기척 %d" % n if n > 0 else ""), 2.6)


func _on_wiped() -> void:
	var at := String(_rest().get("at", ""))
	if at == "" or not _nodes.has(at):
		return
	var pl := get_tree().get_first_node_in_group("player") as Node3D
	if pl == null:
		return
	var p: Vector3 = (_nodes[at].root as Node3D).global_position + Vector3(0, 0.4, 2.2)
	pl.global_position = p
	pl.set("velocity", Vector3.ZERO)
	pl.set("_last_safe", p)
	_armed[at] = false
	Toast.show(self, "쉼터에서 정신을 차렸다", 2.5)


func _refresh() -> void:
	var at := String(_rest().get("at", ""))
	for id: String in _nodes:
		var lit := is_lit(id)
		(_nodes[id].fire as Node3D).visible = lit
		(_nodes[id].light as Light3D).visible = lit
		(_nodes[id].label as Label3D).text = ("✦ 쉼터" if id == at else "쉼터") if lit else "꺼진 모닥불"


# ---------------------------------------------------------------- 모양

func _build(id: String, p: Vector3) -> void:
	var root := Node3D.new()
	root.name = "Rest_" + id
	add_child(root)
	root.global_position = p
	var stone := StandardMaterial3D.new()
	stone.albedo_color = Color(0.42, 0.4, 0.37)
	var wood := StandardMaterial3D.new()
	wood.albedo_color = Color(0.32, 0.2, 0.12)
	for i in 8:
		var a := i * TAU / 8.0
		var m := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.22
		sm.height = 0.3
		sm.radial_segments = 8
		sm.rings = 4
		m.mesh = sm
		m.material_override = stone
		m.position = Vector3(cos(a) * 0.75, 0.08, sin(a) * 0.75)
		root.add_child(m)
	for i in 3:
		var lg := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.07
		cm.bottom_radius = 0.08
		cm.height = 1.0
		cm.radial_segments = 6
		lg.mesh = cm
		lg.material_override = wood
		lg.rotation = Vector3(PI * 0.5, i * TAU / 3.0, 0.25)
		lg.position = Vector3(0, 0.12, 0)
		root.add_child(lg)
	var fire := Node3D.new()
	fire.name = "Fire"
	root.add_child(fire)
	if _flame_mat == null:
		_flame_mat = StandardMaterial3D.new()
		_flame_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_flame_mat.albedo_color = Color(1.0, 0.55, 0.15, 0.85)
		_flame_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_flame_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	for i in 4:
		var f := MeshInstance3D.new()
		var fm := CylinderMesh.new()
		fm.top_radius = 0.0
		fm.bottom_radius = 0.22 if i == 0 else 0.14
		fm.height = 1.0 if i == 0 else 0.6
		fm.radial_segments = 6
		fm.rings = 1
		f.mesh = fm
		f.material_override = _flame_mat
		f.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		var a := i * TAU / 3.0
		f.position = Vector3(cos(a) * (0.0 if i == 0 else 0.2), fm.height * 0.5 + 0.1, sin(a) * (0.0 if i == 0 else 0.2))
		fire.add_child(f)
	var light := OmniLight3D.new()
	light.light_color = FIRE
	light.light_energy = 1.6
	light.omni_range = 7.0
	light.shadow_enabled = false
	light.position.y = 0.8
	root.add_child(light)
	var label := Label3D.new()
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 40
	label.outline_size = 10
	label.position.y = 2.2
	label.no_depth_test = false
	root.add_child(label)
	_nodes[id] = {"root": root, "fire": fire, "light": light, "label": label}


func _physics_process(_delta: float) -> void:
	## 불혀 일렁임 — 지핀 것만, 가까울 때만(먼 쉼터는 안 셈).
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return
	var tt := Time.get_ticks_msec() * 0.001
	for id: String in _nodes:
		var fire := _nodes[id].fire as Node3D
		if not fire.visible or fire.global_position.distance_to(cam.global_position) > 60.0:
			continue
		for i in fire.get_child_count():
			(fire.get_child(i) as Node3D).scale = Vector3(1, 0.8 + 0.3 * sin(tt * 9.0 + i * 1.9), 1)
