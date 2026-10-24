extends Node

## G-0378 2나락 앞벽 걷어내기(디아블로식) — 방이 벽까지 한 메시(dungeon_room_*.glb)라 카메라 쪽 벽이 주인공·보스 예고 원을 가렸다(10-25 Forward+ 촬영 dg_boss_tell).
## 방·문·통로 PBR 재질(dungeon_real_surface — 양면 변종 셰이더)에 끼운 잘라 내기를 매 프레임 카메라·주인공 자리로 맞춘다:
##   카메라→주인공 가로 선분(xz)에서 CUT_R 안 · 주인공보다 카메라 쪽 · 바닥 위 조각은 버림(discard — 수치는 dungeon_real_surface CUT_*).
##   재질은 (mood, 재질 이름)마다 하나라 몇 개뿐 — 그것만 set_shader_parameter. 표 밖 원본 재질(용암 줄 등)은 안 잘린다.
## test_room 이 붙인다. SAGA_DG_CUTAWAY=0 이면 안 붙고 셰이더 기본값(cut_on 0)이라 옛 그림.

const RealSurface := preload("res://games/saga_dungeon/world/dungeon_real_surface.gd")

var _player: Node3D = null


static func enabled() -> bool:
	return OS.get_environment("SAGA_DG_CUTAWAY") != "0"


static func attach(room: Node) -> Node:
	if not enabled():
		return null
	var n := new()
	n.name = "DungeonCutaway"
	room.add_child(n)
	return n


func _process(_delta: float) -> void:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
	var cam := get_viewport().get_camera_3d()
	if _player == null or cam == null:
		return
	var c := cam.global_position
	var p := _player.global_position
	for m: ShaderMaterial in RealSurface.materials():
		m.set_shader_parameter("cut_on", 1.0)
		m.set_shader_parameter("cut_cam", c)
		m.set_shader_parameter("cut_player", p)
