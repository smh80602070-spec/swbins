extends Node3D

## PLAN 106장 52-5 — 결말 뒤 "밤의 잔불"(표·규칙은 data/night_echoes.gd). 지역마다 잔불 하나(보라빛 불꽃 + 먹구름 고리 + 이름표):
##   피어 있을 때만 보인다(30프레임마다 본다). 가까이 오면 잔당이 둘레 SPREAD m 에 서고, 다 쓰러뜨리면 한 줄 + 보상, 오늘은 꺼진다.
##   잔당이 선 채로 멀어지거나(LEAVE_M) 잔불이 지면(낮이 됨) 잔당을 거둔다. 세이브는 PartyState.night_echo 만.

const NightEchoes := preload("res://games/saga_go/data/night_echoes.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const EMBER := Color(0.62, 0.42, 0.95)
const GLOOM := Color(0.2, 0.18, 0.26)

var _embers: Dictionary = {} # id → Node3D
var _foes: Dictionary = {} # id → Array(잔당)
var _player: Node3D = null

static func pos_of(id: String) -> Vector3:
	var r := NightEchoes.row(id)
	var p := TestMap.world_pos(r[2].x, r[2].y, String(r[1]))
	p.y = TerrainBuilder.height_at(String(r[1]), p)
	return p

func _ready() -> void:
	add_to_group("go_night_echoes")
	for r in NightEchoes.ECHOES:
		_build_ember(String(r[0]), String(r[3]))
	_refresh()

func ember_visible(id: String) -> bool:
	return _embers.has(id) and (_embers[id] as Node3D).visible

func foes(id: String) -> Array:
	return (_foes.get(id, []) as Array).filter(func(e: Variant) -> bool: return is_instance_valid(e) and not e.call("is_dead"))

func _refresh() -> void:
	for id in _embers:
		var on := NightEchoes.active(id)
		(_embers[id] as Node3D).visible = on
		if not on and _foes.has(id):
			_clear_foes(id)

func _physics_process(_delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		return
	if Engine.get_physics_frames() % 30 == 0:
		_refresh()
	for id in _embers:
		if not (_embers[id] as Node3D).visible:
			continue
		var d := _player.global_position.distance_to(pos_of(id))
		if not _foes.has(id):
			if d <= NightEchoes.START_M:
				_spawn(id)
		elif foes(id).is_empty():
			_finish(id)
		elif d > NightEchoes.LEAVE_M:
			_clear_foes(id)

func _spawn(id: String) -> void:
	var r := NightEchoes.row(id)
	var center := pos_of(id)
	var kinds: Array = r[4]
	var list: Array = []
	for i in kinds.size():
		var a := TAU * float(i) / float(kinds.size())
		var p := center + Vector3(cos(a), 0.0, sin(a)) * NightEchoes.SPREAD
		p.y = TerrainBuilder.height_at(String(r[1]), p) + 0.3
		var e: CharacterBody3D = FieldEnemy.new()
		e.name = "NightFoe_%s_%d" % [id, i]
		e.setup(String(kinds[i]), p, 20260824 + 1500 + i)
		e.respawns = false
		e.drops = false
		e.apply_world_level(Adventure.world_level())
		add_child(e)
		list.append(e)
	_foes[id] = list
	Toast.show(self, "%s — 먹구름 잔당이 일어선다!" % String(r[3]), 2.5)

func _finish(id: String) -> void:
	var r := NightEchoes.row(id)
	_foes.erase(id)
	NightEchoes.mark_done(id)
	PartyState.add_items(NightEchoes.REWARD)
	(_embers[id] as Node3D).visible = false
	Toast.show(self, "%s이(가) 꺼졌다 — %s: \"%s\" (모라 %d · 특성 재료)" % [String(r[3]), String(r[5]), String(r[6]), int(NightEchoes.REWARD.mora)], 4.0)

func _clear_foes(id: String) -> void:
	for e in _foes.get(id, []):
		if is_instance_valid(e):
			e.queue_free()
	_foes.erase(id)

## 잔불 — 보라빛 불꽃 알 · 밑 먹구름 고리 · 이름표(보기만, 멀리선 안 그림).
func _build_ember(id: String, title: String) -> void:
	var root := Node3D.new()
	root.name = "NightEcho_" + id
	add_child(root)
	root.global_position = pos_of(id)
	var fm := StandardMaterial3D.new()
	fm.albedo_color = EMBER
	fm.emission_enabled = true
	fm.emission = EMBER
	fm.emission_energy_multiplier = 2.5
	var orb := SphereMesh.new()
	orb.radius = 0.45
	orb.height = 1.1
	var om := MeshInstance3D.new()
	om.mesh = orb
	om.material_override = fm
	om.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	om.position = Vector3(0.0, 1.3, 0.0)
	root.add_child(om)
	var tw := om.create_tween().set_loops()
	tw.tween_property(om, "position:y", 1.6, 1.4).set_trans(Tween.TRANS_SINE)
	tw.tween_property(om, "position:y", 1.3, 1.4).set_trans(Tween.TRANS_SINE)
	var vm := StandardMaterial3D.new()
	vm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	vm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	vm.albedo_color = Color(GLOOM.r, GLOOM.g, GLOOM.b, 0.55)
	vm.cull_mode = BaseMaterial3D.CULL_DISABLED
	var ring := TorusMesh.new()
	ring.inner_radius = 0.9
	ring.outer_radius = 1.6
	var rm := MeshInstance3D.new()
	rm.mesh = ring
	rm.material_override = vm
	rm.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	rm.position = Vector3(0.0, 0.25, 0.0)
	rm.scale = Vector3(1.0, 0.4, 1.0)
	root.add_child(rm)
	var l := Label3D.new()
	l.text = title
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.font_size = 40
	l.outline_size = 8
	l.pixel_size = 0.01
	l.modulate = Color(0.85, 0.78, 1.0)
	l.position = Vector3(0.0, 2.6, 0.0)
	root.add_child(l)
	for n in root.find_children("*", "GeometryInstance3D", true, false):
		(n as GeometryInstance3D).visibility_range_end = 220.0
	root.visible = false
	_embers[id] = root
