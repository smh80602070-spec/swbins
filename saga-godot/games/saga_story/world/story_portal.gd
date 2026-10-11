extends Node3D

## VERTICAL_SLICE_STORY.md 15절 — 문(portal). data-side.js STAGES의
## `portals:[x, toKey]`를 옮긴다("↑ 를 누르면 그 사냥터로 걸어 넘어간다").
##
## **재해석** — 원작은 위 방향키 하나로 넘어가지만, 이 포트는 새 입력
## 액션을 늘리지 않고 상점(14절)과 같은 상호작용 키(K, story_interact)로
## 통일했다. 벽(story_terrain_builder.gd 경계벽)은 문이 있는 쪽도 그대로
## 남아 있다 — 그냥 걸어서는 못 나가고, 반드시 K를 눌러야 넘어간다.

const Toast := preload("res://saga_core/ui/toast.gd")

@export var target_scene: String = ""
@export var arrival_x_m: float = 0.0
@export var label_text: String = "문"

const SIZE := Vector3(1.4, 2.6, 1.6)

var _player_in_range := false


func _ready() -> void:
	_spawn_visual()
	_spawn_area()


func _spawn_visual() -> void:
	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = SIZE
	mi.mesh = mesh
	mi.position = Vector3(0, SIZE.y * 0.5, 0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.35, 0.25, 0.55)
	mat.emission_enabled = true
	mat.emission = Color(0.55, 0.32, 0.85)
	mat.emission_energy_multiplier = 0.6
	mi.material_override = mat
	add_child(mi)


func _spawn_area() -> void:
	var area := Area3D.new()
	area.name = "PortalRange"
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = SIZE
	cs.shape = shape
	area.add_child(cs)
	area.position = Vector3(0, SIZE.y * 0.5, 0)
	area.body_entered.connect(_on_range_entered)
	area.body_exited.connect(_on_range_exited)
	add_child(area)


func _on_range_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	_player_in_range = true
	Toast.show(self, "🚪 %s — K: 이동" % label_text, 2.0)


func _on_range_exited(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	_player_in_range = false


## story_merchant.gd와 같은 폴링 방식 — 이 판은 `_unhandled_input`
## 이벤트 콜백을 안 쓴다(story_player.gd `_physics_process()` 참고).
func _process(_delta: float) -> void:
	if not _player_in_range or target_scene.is_empty():
		return
	if Input.is_action_just_pressed("story_interact"):
		StorySaveState.set_pending_spawn(arrival_x_m)
		StorySaveState.end_run()   # G-0197 — 사냥터에서 나가면 등급(들어간 적 없으면 아무 일 없음)
		get_tree().change_scene_to_file(target_scene)
