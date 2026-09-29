extends Node3D

## 2026-09-30 탈것 — GO 플레이어(go_player.gd)의 자식. 데이터는 data/mounts.gd.
##   V  마지막에 쓴 탈것 타기/내리기    B  다음 탈것으로 바꿔 타기    (터치 단추는 아직 없다)
## 타는 동안: 땅 탈것은 달리기 배율·스태미나 안 씀·점프 배율·등반 못 함, 나는 탈것은 떠올라 난다(go_player Mode.FLY).
## 전투는 못 한다 — 공격(combat_quick)을 누르면 내린다. 깊은 물에 들면 내린다.
## 몸은 신수 모습(CreatureBuilder.build_pet)을 그대로 쓴다(따로 탈것 그림을 만들지 않는다).

const Mounts := preload("res://games/saga_go/data/mounts.gd")
const CreatureBuilder := preload("res://games/saga_go/world/creature_builder.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

signal mounted_changed(id: String)

## 공격을 누르면 내린다 — 판마다 다른 공격 액션(없는 것은 건너뜀).
const ATTACK_ACTIONS := ["combat_quick", "dungeon_attack"]
const MODE_SWIM := 4  # go_player.gd Mode enum 값 (GROUND0 AIR1 GLIDE2 CLIMB3 SWIM4 MANTLE5 FLY6)
const MODE_FLY := 6

var current := ""            # 타고 있는 탈것 id("" = 안 탐)
var last_id := ""            # 마지막에 쓴 탈것
var _player: CharacterBody3D
var _body: Node3D = null
var _def: Dictionary = {}
var _t := 0.0

func _ready() -> void:
	_player = get_parent() as CharacterBody3D
	name = "Mount"
	_ensure_action("go_mount", KEY_V)
	_ensure_action("go_mount_next", KEY_B)

static func _ensure_action(action: String, key: Key) -> void:
	if InputMap.has_action(action):
		return
	InputMap.add_action(action)
	var ev := InputEventKey.new()
	ev.physical_keycode = key
	InputMap.action_add_event(action, ev)

func is_riding() -> bool:
	return current != ""

func is_flying_mount() -> bool:
	return is_riding() and String(_def.get("kind", "")) == "fly"

func owned() -> Array:
	## GO 는 이야기 장으로 잠그고(go_player.mount_chapter), 다른 판은 아직 잠금 없이 전부(각 판 진행 연결은 다음 조각).
	return Mounts.unlocked(int(_player.call("mount_chapter")) if _player.has_method("mount_chapter") else 99)

func _unhandled_input(event: InputEvent) -> void:
	if _player == null or bool(_player.get("frozen")):
		return
	if event.is_action_pressed("go_mount"):
		toggle()
	elif event.is_action_pressed("go_mount_next"):
		cycle()
	elif is_riding():
		for a in ATTACK_ACTIONS:
			if InputMap.has_action(a) and event.is_action_pressed(a):
				dismount("전투는 내려서")
				return

func toggle() -> void:
	if is_riding():
		dismount("")
		return
	var list := owned()
	if list.is_empty():
		Toast.show(self, "아직 탈것이 없다 — 이야기를 더 진행하면 신수가 등을 내준다", 3.0)
		return
	mount(last_id if list.has(last_id) else String(list[0]))

func cycle() -> void:
	var list := owned()
	if list.is_empty():
		Toast.show(self, "아직 탈것이 없다", 3.0)
		return
	var i := list.find(current if is_riding() else last_id)
	mount(String(list[(i + 1) % list.size()]))

func mount(id: String) -> void:
	var def: Variant = Mounts.find(id)
	if def == null or _player == null:
		return
	dismount("", true)
	_def = def
	current = id
	last_id = id
	var pet: Variant = null
	for p in preload("res://saga_core/data/pets.gd").PETS:
		if p.id == id:
			pet = p
	_body = CreatureBuilder.build_pet(id, float(_def.height))
	_body.name = "MountBody"
	add_child(_body)
	_apply_to_player(true)
	Toast.show(self, "%s 에 올랐다%s" % [String(pet.name) if pet != null else id, " — 점프로 오르고 Shift 로 내려간다" if is_flying_mount() else ""], 3.0)
	mounted_changed.emit(id)

func dismount(reason: String, silent := false) -> void:
	if not is_riding():
		return
	current = ""
	if _body != null:
		_body.queue_free()
		_body = null
	_apply_to_player(false)
	if not silent and reason != "":
		Toast.show(self, "탈것에서 내렸다 (%s)" % reason, 3.0)
	mounted_changed.emit("")

func _apply_to_player(on: bool) -> void:
	_player.set("mounted", on)
	_player.set("mount_speed_mul", float(_def.get("speed", 1.0)) if on else 1.0)
	_player.set("mount_jump_mul", float(_def.get("jump", 1.0)) if on else 1.0)
	_player.set("ride_height", float(_def.get("ride", 0.0)) if on else 0.0)
	_player.set("mount_fly_speed", float(_def.get("fly_speed", 0.0)) if on else 0.0)
	if on and String(_def.get("kind", "")) == "fly":
		_player.call("begin_fly")
	elif not on and _player.has_method("is_flying_now") and _player.call("is_flying_now"):
		_player.call("end_fly")

func _physics_process(delta: float) -> void:
	if not is_riding() or _player == null:
		return
	_t += delta
	if _player.get("mode") != null and int(_player.get("mode")) == MODE_SWIM:
		dismount("물")
		return
	## 몸이 플레이어 발밑에서 같은 쪽을 본다 + 달릴 때 위아래 출렁임.
	## GO 는 _yaw, 다른 판은 visual 의 회전.
	var yaw: float = float(_player.get("_yaw")) if _player.get("_yaw") != null else float((_player.get("visual") as Node3D).rotation.y)
	rotation.y = yaw + float(_def.get("yaw", 0.0))
	var speed_h := Vector2(_player.velocity.x, _player.velocity.z).length()
	var bob := sin(_t * (6.0 + speed_h * 0.6)) * clampf(speed_h / 12.0, 0.0, 1.0) * 0.08
	if _body != null:
		_body.position = Vector3(0.0, bob, 0.0)
		var fly_now: bool = _player.has_method("is_flying_now") and _player.call("is_flying_now")
		_body.rotation.z = lerpf(_body.rotation.z, 0.0 if not fly_now else sin(_t * 2.0) * 0.06, 0.1)
		_body.rotation.x = lerpf(_body.rotation.x, clampf(-_player.velocity.y * 0.03, -0.35, 0.35) if fly_now else 0.0, 0.1)
