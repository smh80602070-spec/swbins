extends Camera3D

## VERTICAL_SLICE_STORY.md 2절 — "플레이어는 X만 따라가고(Y는 완만하게
## 보간), Z는 항상 같은 거리". DUNGEON의 SpringArm3D 고정각(회전은
## 있되 각도 고정)과 달리 이 판은 **회전 자체가 없다** — 플레이어를
## 자식으로 안 두고 독립 노드로 둔 이유도 그거다(자식으로 두면 부모
## 위치를 그대로 따라가 Y 보간을 못 한다).

const Y_OFFSET := 2.6
const Z_DISTANCE := 12.5   # G-0187 — 16 → 12.5: 몸 배율 1.6(data/story_look.gd)과 함께 인물이 화면 높이 약 1/7(메이플 크기)
const Y_LERP_RATE := 3.0

var _player: Node3D = null
## G-0192 — 세계 흔들림(웹 W-0166 ①). saga_core/combat_feel.gd 가 "camera_rig" 그룹 첫 노드의 shake() 를 부른다 — 이 판엔 그 그룹이 없어
## 때려도 맞아도 화면이 안 흔들렸다. dungeon_camera_rig.gd shake() 와 같은 꼴(겹치면 더 센·더 긴 쪽), 카메라 자리에 x·y 노이즈만 얹는다.
var _shake_amp_m := 0.0
var _shake_until_msec := 0
var _base := Vector3.ZERO   # 흔들림 뺀 자리(점검용)
var _inited := false


func _ready() -> void:
	add_to_group("camera_rig")
	position.z = Z_DISTANCE
	rotation = Vector3.ZERO  # -Z를 바라본다 — 플레이어는 항상 Z=0 평면 위


func _process(delta: float) -> void:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player")
		if _player == null:
			return
	if not _inited:
		_base = global_position
		_inited = true
	_base.x = _player.global_position.x
	_base.y = lerp(_base.y, _player.global_position.y + Y_OFFSET, Y_LERP_RATE * delta)
	_base.z = Z_DISTANCE
	var off := Vector3.ZERO
	if Time.get_ticks_msec() < _shake_until_msec:
		off = Vector3(randf_range(-_shake_amp_m, _shake_amp_m), randf_range(-_shake_amp_m, _shake_amp_m), 0.0)
	else:
		_shake_amp_m = 0.0
	global_position = _base + off


## combat_feel.gd _do_shake() 가 부른다 · 나도 맞으면 부른다(story_player.gd take_damage)
func shake(amp_m: float, dur_sec: float) -> void:
	_shake_until_msec = maxi(_shake_until_msec, Time.get_ticks_msec() + int(dur_sec * 1000.0))
	_shake_amp_m = maxf(_shake_amp_m, amp_m)


func is_shaking() -> bool:
	return Time.get_ticks_msec() < _shake_until_msec
