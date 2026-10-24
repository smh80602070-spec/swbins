extends Node3D

## G-0380 2나락 저주받은 상자(디아블로 3 — 열면 둘레에 적이 몰려오고, 정해진 시간을 버티면 큰 보상). 한 판에 하나:
##   자리   싸움 방(ROOM_KINDS "fight" — 셋째·여섯째 방) 중 하나, 방 왼쪽 뒤(CHEST_OFF) · 보랏빛 상자(코드 도형 — 에셋 없음)
##   열기   다가가면(OPEN_R) 저절로 열리고 SURVIVE_SEC 동안 WAVE_EVERY 초마다 WAVE_N 마리가 상자 둘레(SPAWN_R)에 선다(방 적과 같은 _spawn_enemy_at)
##   버팀   시간이 다 될 때까지 상자 STAY_R 안에 있으면 성공 — 전리품 REWARD_DROPS 개(정예 굴림) + 금 GOLD × 층
##   실패   STAY_R 밖으로 나가거나 쓰러지면 "저주가 풀리지 않았다" — 상자는 사라짐(다시 못 엶)
##   셈     현상금(G-0372) 처치·등급(G-0312)은 방 적과 같은 길로 저절로 센다. SAGA_CURSED=0 이면 상자 없음.

const LootPickup := preload("res://games/saga_dungeon/world/loot_pickup.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const FIGHT_ROOMS := [2, 5]
const CHEST_OFF := Vector3(-3.4, 0.0, -2.6)
const OPEN_R := 2.2
const STAY_R := 9.0
const SPAWN_R := 5.0
const SURVIVE_SEC := 24.0
const WAVE_EVERY := 6.0
const WAVE_N := 2
const REWARD_DROPS := 3
const GOLD := 60

enum S { IDLE, ACTIVE, DONE }

var state := S.IDLE
var floor_num := 1
var _room: Node = null
var _left := 0.0
var _wave_t := 0.0
var _player: Node3D = null
var _box: MeshInstance3D = null
var _lid: MeshInstance3D = null
var _ring: MeshInstance3D = null
var spawned := 0   # 점검용


static func enabled() -> bool:
	return OS.get_environment("SAGA_CURSED") != "0"


## 몇째 방에 둘지(순수 — 씨앗이 정한다).
static func room_for(seed_value: int) -> int:
	return FIGHT_ROOMS[posmod(seed_value, FIGHT_ROOMS.size())]


static func attach(room: Node, origins: Array, seed_value: int) -> Node3D:
	if not enabled() or origins.size() <= FIGHT_ROOMS.max():
		return null
	var i := room_for(seed_value)
	var c := new()
	c.name = "CursedChest"
	c.floor_num = i + 1
	c._room = room
	room.add_child(c)
	c.position = Vector3(0.0, 0.0, float(origins[i])) + CHEST_OFF
	return c


func _ready() -> void:
	_box = _part(Vector3(1.1, 0.7, 0.75), Vector3(0, 0.35, 0), Color(0.22, 0.08, 0.3))
	_lid = _part(Vector3(1.15, 0.22, 0.8), Vector3(0, 0.81, 0), Color(0.35, 0.12, 0.45))
	var glow := OmniLight3D.new()
	glow.light_color = Color(0.7, 0.3, 1.0)
	glow.light_energy = 1.6
	glow.omni_range = 4.0
	glow.position = Vector3(0, 1.2, 0)
	add_child(glow)


func _part(size: Vector3, pos: Vector3, col: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var m := BoxMesh.new()
	m.size = size
	mi.mesh = m
	var mat := StandardMaterial3D.new()
	mat.albedo_color = col
	mat.emission_enabled = true
	mat.emission = col.lightened(0.3)
	mat.emission_energy_multiplier = 0.6
	mi.material_override = mat
	mi.position = pos
	add_child(mi)
	return mi


func _player_ref() -> Node3D:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
	return _player


func _physics_process(delta: float) -> void:
	var p := _player_ref()
	if p == null or state == S.DONE:
		return
	var d := Vector2(p.global_position.x - global_position.x, p.global_position.z - global_position.z).length()
	match state:
		S.IDLE:
			if d < OPEN_R:
				open()
		S.ACTIVE:
			var ph := p.get_node_or_null("PlayerHealth")
			if d > STAY_R or (ph != null and bool(ph.get("_dead"))):
				fail()
				return
			_left -= delta
			_wave_t -= delta
			if _wave_t <= 0.0 and _left > WAVE_EVERY * 0.5:
				_wave_t = WAVE_EVERY
				_wave()
			if _left <= 0.0:
				succeed()


func open() -> void:
	if state != S.IDLE:
		return
	state = S.ACTIVE
	_left = SURVIVE_SEC
	_wave_t = 0.0
	_lid.position.y += 0.3
	_lid.rotation_degrees.x = -35.0
	_ring = MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = STAY_R - 0.15
	tm.outer_radius = STAY_R
	_ring.mesh = tm
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(0.7, 0.25, 1.0, 0.6)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_ring.material_override = mat
	_ring.position = Vector3(0, 0.05, 0)
	add_child(_ring)
	Toast.show(self, "💀 저주받은 상자 — %d초 버텨라! (보랏빛 고리 밖으로 나가면 실패)" % int(SURVIVE_SEC), 3.5)


func _wave() -> void:
	if _room == null or not _room.has_method("_spawn_enemy_at"):
		return
	for k in WAVE_N:
		var a := randf() * TAU
		var pos := global_position + Vector3(cos(a), 0.0, sin(a)) * SPAWN_R
		_room.call("_spawn_enemy_at", pos, floor_num, false, false, false)
		spawned += 1


func succeed() -> void:
	state = S.DONE
	for k in REWARD_DROPS:
		LootPickup.spawn_at(get_parent(), global_position + Vector3(1.2 + float(k) * 0.9, 0.0, 0.8), floor_num, false, true, 1.0, true)
	DungeonGoldState.add(GOLD * floor_num)
	Toast.show(self, "💀 저주를 이겨냈다! — 전리품 %d · 금 +%d" % [REWARD_DROPS, GOLD * floor_num], 3.5)
	_end()


func fail() -> void:
	state = S.DONE
	Toast.show(self, "💀 저주가 풀리지 않았다 — 상자가 재가 되어 흩어진다", 3.0)
	_end()


func _end() -> void:
	if _ring != null:
		_ring.queue_free()
		_ring = null
	var tw := create_tween()
	tw.tween_property(self, "scale", Vector3(0.01, 0.01, 0.01), 0.6)
	tw.tween_callback(queue_free)
