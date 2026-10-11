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


func _ready() -> void:
	position.z = Z_DISTANCE
	rotation = Vector3.ZERO  # -Z를 바라본다 — 플레이어는 항상 Z=0 평면 위


func _process(delta: float) -> void:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player")
		if _player == null:
			return
	global_position.x = _player.global_position.x
	global_position.y = lerp(global_position.y, _player.global_position.y + Y_OFFSET, Y_LERP_RATE * delta)
	global_position.z = Z_DISTANCE
