extends Node3D

## PLAN.md 101-2 STORY ⑤(비경, 2026-09-18) — 마을 문 하나(§5-3 "마을 문
## 하나가 비경 입구"). story_portal.gd와 같은 상호작용 키(K, story_interact)
## 지만 목적지가 하나가 아니라 ChoicePrompt로 "입장한다"/"기억을 새긴다"
## 둘을 고른다 — story_merchant.gd처럼 폴링 방식(이 판은 입력 콜백을 안 쓴다).

const Toast := preload("res://saga_core/ui/toast.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const StoryLabyrinth := preload("res://games/saga_story/data/story_labyrinth.gd")

@export var target_scene: String = "res://games/saga_story/world/StoryLabyrinth.tscn"
@export var label_text: String = "비경(祕境) 입구"

const SIZE := Vector3(1.6, 3.0, 1.6)

var _player_in_range := false
var _prompt_open := false


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
	mat.albedo_color = Color(0.15, 0.08, 0.22)
	mat.emission_enabled = true
	mat.emission = Color(0.65, 0.15, 0.75)
	mat.emission_energy_multiplier = 0.9
	mi.material_override = mat
	add_child(mi)


func _spawn_area() -> void:
	var area := Area3D.new()
	area.name = "GateRange"
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
	Toast.show(self, "🌀 %s — K: 살펴본다" % label_text, 2.0)


func _on_range_exited(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	_player_in_range = false


func _process(_delta: float) -> void:
	if not _player_in_range or _prompt_open:
		return
	if Input.is_action_just_pressed("story_interact"):
		_open_menu()


func _open_menu() -> void:
	_prompt_open = true
	var layer_box := {}
	var choices: Array = [
		{"label": "⚔️ 입장한다", "cb": func() -> void: _on_enter(layer_box)},
	]
	var tier: int = StorySaveState.memory_tier
	if tier < StoryLabyrinth.MEMORY_TIER_MAX:
		var cost := StoryLabyrinth.memory_upgrade_cost(tier)
		choices.append({
			"label": "💠 기억을 새긴다(%d/%d단, 조각 %d 필요 · 보유 %d)" % [tier, StoryLabyrinth.MEMORY_TIER_MAX, cost, StorySaveState.memory_fragments],
			"cb": func() -> void: _on_upgrade(layer_box),
		})
	choices.append({"label": "🚪 그만둔다", "cb": func() -> void: _close(layer_box)})
	layer_box["layer"] = ChoicePrompt.build(self, "🌀 %s" % label_text, choices)


func _on_enter(layer_box: Dictionary) -> void:
	_close(layer_box)
	StoryLabyrinthState.start_run()
	get_tree().change_scene_to_file(target_scene)


func _on_upgrade(layer_box: Dictionary) -> void:
	_close(layer_box)
	if StorySaveState.upgrade_memory():
		Toast.show(self, "💠 기억을 새겼다 · 최대 체력 +%d%%(%d/%d단)" % [int(StoryLabyrinth.MEMORY_HP_PCT_PER_TIER * StorySaveState.memory_tier), StorySaveState.memory_tier, StoryLabyrinth.MEMORY_TIER_MAX], 3.0)
	else:
		Toast.show(self, "💠 기억 조각이 모자라다 · 보유 %d" % StorySaveState.memory_fragments, 2.5)


func _close(layer_box: Dictionary) -> void:
	if layer_box.has("layer"):
		(layer_box["layer"] as CanvasLayer).queue_free()
	_prompt_open = false
