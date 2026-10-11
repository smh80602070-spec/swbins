extends Node3D

## 2026-09-30 탈것 — GO 플레이어(go_player.gd)의 자식. 데이터는 data/mounts.gd.
##   [  마지막에 쓴 탈것 타기/내리기    ]  다음 탈것으로 바꿔 타기    (사가나락은 - · =, 터치 화면이면 단추도 — _build_touch)
## G-0119 — 예전 V·B 는 사가나락 기술 4·5, 사가종횡 직업 기술, 사가만리 시야·가방과 겹쳐 한 번에 둘 다 일어났다(사용자 10-09 결정).
## 타는 동안: 땅 탈것은 달리기 배율·스태미나 안 씀·점프 배율·등반 못 함, 나는 탈것은 떠올라 난다(go_player Mode.FLY).
## 전투는 못 한다 — 공격(combat_quick)을 누르면 내린다. 깊은 물에 들면 내린다.
## 몸은 신수 모습(CreatureBuilder.build_pet)을 그대로 쓴다(따로 탈것 그림을 만들지 않는다).

const Mounts := preload("res://saga_core/data/mounts.gd")
const CreatureBuilder := preload("res://saga_core/world/creature_builder.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const SeatPose := preload("res://saga_core/player/seat_pose.gd")
## 앉으면 엉덩이가 내려온다 — 서 있을 때 발 높이(ride)에서 이만큼 뺀다.
const SEAT_DROP := 0.5
## 기수 엉덩이를 안장 윗면보다 이만큼 위에(엉덩이 두께).
const SEAT_CLEAR := 0.06

signal mounted_changed(id: String)

## 공격을 누르면 내린다 — 판마다 다른 공격 액션(없는 것은 건너뜀).
const ATTACK_ACTIONS := ["combat_quick", "dungeon_attack"]
const CONFIG_PATH := "user://mount.cfg"
const MODE_SWIM := 4  # go_player.gd Mode enum 값 (GROUND0 AIR1 GLIDE2 CLIMB3 SWIM4 MANTLE5 FLY6)
const MODE_FLY := 6
## 판별 탈것 키 [타기/내리기, 다음 탈것] — 판마다 빈 키(사가나락은 글자·숫자·[ ] 를 다 써서 - =).
const KEYS := {"saga_dungeon": [KEY_MINUS, KEY_EQUAL]}
const KEYS_DEFAULT := [KEY_BRACKETLEFT, KEY_BRACKETRIGHT]

var current := ""            # 타고 있는 탈것 id("" = 안 탐)
var last_id := ""            # 마지막에 쓴 탈것
var _player: CharacterBody3D
var _body: Node3D = null
var _anim: AnimationPlayer = null # 신수 몸이 지닌 idle(느린 날갯짓·숨쉬기)/walk(다리 걸음·빠른 날갯짓)
var _def: Dictionary = {}
var _t := 0.0

func _ready() -> void:
	_player = get_parent() as CharacterBody3D
	name = "Mount"
	var keys: Array = keys_for(_game_path())
	_ensure_action("go_mount", keys[0])
	_ensure_action("go_mount_next", keys[1])
	## 마지막에 쓴 탈것은 설치마다 기억한다(세이브 밖 — 세이브 스키마를 건드리지 않는다).
	var cf := ConfigFile.new()
	if cf.load(CONFIG_PATH) == OK:
		last_id = String(cf.get_value("mount", "last", ""))
	if DisplayServer.is_touchscreen_available():
		_build_touch()

## 씬 경로(games/saga_* 를 담은)로 그 판의 탈것 키.
static func keys_for(scene_path: String) -> Array:
	for g in KEYS:
		if scene_path.contains("/games/%s/" % g):
			return KEYS[g]
	return KEYS_DEFAULT

## 어느 판인지 — 조상 가운데 씬 파일 경로가 games/saga_* 인 첫 노드(플레이어 씬 자신 또는 판 씬). 점검 호스트처럼 current_scene 이 다른 씬이어도 맞는다.
func _game_path() -> String:
	var n: Node = self
	while n != null:
		if n.scene_file_path.contains("/games/saga_"):
			return n.scene_file_path
		n = n.get_parent()
	return ""

static func _ensure_action(action: String, key: Key) -> void:
	if InputMap.has_action(action):
		return
	InputMap.add_action(action)
	var ev := InputEventKey.new()
	ev.physical_keycode = key
	InputMap.action_add_event(action, ev)

## 터치 단추 — "탈것"(타기/내리기)과, 나는 탈것을 타는 동안만 보이는 "내려가기"(Shift/story_dash 와 같은 입력).
var _touch_down: Button = null

func _build_touch() -> void:
	var layer := CanvasLayer.new()
	layer.name = "MountTouch"
	add_child(layer)
	var b := Button.new()
	b.name = "MountButton"
	b.text = "탈것"
	b.anchor_left = 1.0
	b.anchor_right = 1.0
	b.anchor_top = 1.0
	b.anchor_bottom = 1.0
	b.offset_left = -440
	b.offset_right = -320
	b.offset_top = -170
	b.offset_bottom = -50
	b.pressed.connect(toggle)
	layer.add_child(b)
	_touch_down = Button.new()
	_touch_down.name = "MountDownButton"
	_touch_down.text = "내려가기"
	_touch_down.visible = false
	_touch_down.anchor_left = 1.0
	_touch_down.anchor_right = 1.0
	_touch_down.anchor_top = 1.0
	_touch_down.anchor_bottom = 1.0
	_touch_down.offset_left = -440
	_touch_down.offset_right = -320
	_touch_down.offset_top = -300
	_touch_down.offset_bottom = -190
	_touch_down.button_down.connect(func() -> void: _hold_down(true))
	_touch_down.button_up.connect(func() -> void: _hold_down(false))
	layer.add_child(_touch_down)

func _hold_down(on: bool) -> void:
	for a in ["run", "story_dash"]:
		if InputMap.has_action(a):
			if on:
				Input.action_press(a)
			else:
				Input.action_release(a)

func is_riding() -> bool:
	return current != ""

func is_flying_mount() -> bool:
	return is_riding() and String(_def.get("kind", "")) == "fly"

func owned() -> Array:
	return Mounts.unlocked(int(_player.call("mount_chapter")) if _player.has_method("mount_chapter") else game_progress())

## 판마다 진행을 이야기 장(mounts.gd req_ch 2·5·8·10·16·26)에 맞춘 값으로 — 조상 가운데 `mount_progress()` 를 가진 첫 노드가 준다
## (사가나락 test_room 방 ×4 · 사가마을 forest_village 부탁 ×5 · 사가종횡 story_player 사명 ×2). 없는 곳은 전부 열림(99).
## G-0121 — 예전엔 여기서 판 세이브(Dungeon/Forest/StorySaveState)를 직접 읽었다(saga_core 는 판을 안 부른다).
func game_progress() -> int:
	var n: Node = get_parent()
	while n != null:
		if n.has_method("mount_progress"):
			return int(n.call("mount_progress"))
		n = n.get_parent()
	return 99

func _unhandled_input(event: InputEvent) -> void:
	if _player == null or _player.get("frozen") == true:
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
	var cf := ConfigFile.new()
	cf.set_value("mount", "last", id)
	cf.save(CONFIG_PATH)
	var pet: Variant = null
	for p in preload("res://saga_core/data/pets.gd").PETS:
		if p.id == id:
			pet = p
	_body = CreatureBuilder.build_pet(id, float(_def.height) * _k())
	_body.name = "MountBody"
	add_child(_body)
	_anim = _body.get_node_or_null("AnimationPlayer") as AnimationPlayer
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

func _seat(on: bool) -> bool:
	var vis := _player.get("visual") as Node3D
	if vis == null:
		return false
	for s in vis.find_children("*", "Skeleton3D", true, false):
		var sp := SeatPose.attach(s as Skeleton3D)
		if sp != null:
			sp.call("set_seated", on)
			return true
	return false

## 기수 발 높이. 안장 자리(seat_y)가 있으면 엉덩이가 등 윗면에 닿게(몸마다 엉덩이 높이가 다르니 기수 몸에서 잰다), 없으면 예전 ride - SEAT_DROP.
## G-0187 — 기수 그림 배율(플레이어 메타 body_scale, 4종횡 1.6 · 다른 판은 없음 = 1). 탈것 몸·안장 높이·앞뒤 자리를 같은 배율로 — 큰 기수가 탈것 속으로 꺼지지 않게.
func _k() -> float:
	return float(_player.get_meta("body_scale", 1.0)) if _player != null else 1.0

func _ride_height(seated: bool) -> float:
	if seated and _def.has("seat_y"):
		return float(_def.seat_y) * _k() + SEAT_CLEAR - _rider_hips_h()
	return float(_def.get("ride", 0.0)) * _k() - (SEAT_DROP if seated else 0.0)

## 기수 몸의 엉덩이 높이(발 기준, 몸 배율 포함). 뼈를 못 찾으면 0.92.
func _rider_hips_h() -> float:
	var vis := _player.get("visual") as Node3D
	if vis == null:
		return 0.92
	for s in vis.find_children("*", "Skeleton3D", true, false):
		var sk := s as Skeleton3D
		for nm in ["J_Bip_C_Hips", "pelvis", "Hips"]:
			var i := sk.find_bone(nm)
			if i >= 0:
				return sk.get_bone_global_rest(i).origin.y * vis.scale.y
	return 0.92

## 탄 채로 기수 몸이 바뀌었을 때 — 다시 앉히고 높이를 다시 잰다.
func reseat() -> void:
	if not is_riding() or _player == null:
		return
	var seated := _seat(true)
	_player.set("ride_height", _ride_height(seated))

func _apply_to_player(on: bool) -> void:
	var seated := _seat(on)
	_player.set("mounted", on)
	_player.set("mount_speed_mul", float(_def.get("speed", 1.0)) if on else 1.0)
	_player.set("mount_jump_mul", float(_def.get("jump", 1.0)) if on else 1.0)
	_player.set("ride_height", _ride_height(seated) if on else 0.0)
	_player.set("mount_fly_speed", float(_def.get("fly_speed", 0.0)) if on else 0.0)
	if on and String(_def.get("kind", "")) == "fly":
		_player.call("begin_fly")
	elif not on and _player.has_method("is_flying_now") and _player.call("is_flying_now"):
		_player.call("end_fly")

func _physics_process(delta: float) -> void:
	if _touch_down != null:
		_touch_down.visible = is_flying_mount()
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
		_body.position = Vector3(0.0, bob, -float(_def.get("seat_z", 0.0)) * _k())   # 안장이 기수 아래에 오게 몸을 앞뒤로
		var fly_now: bool = _player.has_method("is_flying_now") and _player.call("is_flying_now")
		if _anim != null:
			## 나는 동안엔 늘 빠른 날갯짓(walk 클립), 땅에선 움직일 때만 다리 걸음.
			var want := "walk" if (fly_now or speed_h > 1.0) else "idle"
			if _anim.current_animation != want and _anim.has_animation(want):
				_anim.play(want, 0.15)
			_anim.speed_scale = clampf(speed_h / 7.0, 0.7, 2.2) if not fly_now else 1.4
		_body.rotation.z = lerpf(_body.rotation.z, 0.0 if not fly_now else sin(_t * 2.0) * 0.06, 0.1)
		_body.rotation.x = lerpf(_body.rotation.x, clampf(-_player.velocity.y * 0.03, -0.35, 0.35) if fly_now else 0.0, 0.1)
