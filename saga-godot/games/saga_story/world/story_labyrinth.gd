extends Node3D

## PLAN.md 101-2 STORY ⑤(비경, 2026-09-18) — story_labyrinth.gd(데이터)·
## story_labyrinth_state.gd(회차 상태) 머리말 참고. §10 Q5 "발판 기반 노드
## 지도"의 실제 씬 — 층마다 넓은 바닥(허브) 위에 노드 종류 수만큼 **발판**
## (받침대)을 나란히 세운다. 올라서서 K를 누르면 그 노드로 확정되고 나머지
## 발판은 사라진다. 5층(마지막)은 선택 없이 곧바로 보스가 선다.
##
## **재해석 — 죽음.** story_player.gd take_damage() 머리말 "죽음은 이번에도
## 범위 밖"(부활·게임오버 없음) — 이 판 전체의 설계 결정이라 건드리지 않는다.
## 대신 이 씬만 매 프레임 hp<=0을 관찰해 "패퇴"(비경 전용 판정)로 다룬다 —
## 새 전역 죽음 시스템을 만들지 않고, 관찰자를 이 씬 안에 좁혀 둔다.

const StoryEnemyScene := preload("res://games/saga_story/world/story_enemy.gd")
const StoryGoldPickup := preload("res://games/saga_story/world/story_gold_pickup.gd")
const StoryGearPickup := preload("res://games/saga_story/world/story_gear_pickup.gd")
const StoryCombat := preload("res://games/saga_story/data/story_combat.gd")
const StoryLabyrinth := preload("res://games/saga_story/data/story_labyrinth.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const TOWN_SCENE := "res://games/saga_story/world/HeodoField.tscn"
const TOWN_ARRIVAL_X := 24.0

const GROUND_Y := 0.0
const PLATFORM_THICKNESS := 0.4
const PLATFORM_DEPTH := 4.0
const GROUND_COLOR := Color(0.16, 0.08, 0.2)
const PEDESTAL_HEIGHT := 0.5
const PEDESTAL_SIZE := 3.0
const NODE_START_X := 6.0
const NODE_SPACING := 6.0
const PLAYER_START_X := 1.5
const WALL_HEIGHT := 20.0

const NODE_COLOR := {
	"battle": Color(0.55, 0.18, 0.18), "elite": Color(0.6, 0.35, 0.05),
	"treasure": Color(0.75, 0.65, 0.15), "rest": Color(0.2, 0.55, 0.3),
	"event": Color(0.35, 0.25, 0.6),
}

var _floor_root: Node3D
var _pedestals: Array[Dictionary] = []  # {type, x}
var _in_range_index := -1
var _committed := false
var _node_enemies_left := 0
var _defeated := false
var _finished := false


func _ready() -> void:
	preload("res://saga_core/audio/bgm.gd").play(self, "story-battle")
	if not StoryLabyrinthState.in_run:
		StoryLabyrinthState.start_run()  # 씬을 직접 열었을 때(진단 등)도 스스로 돈다
	_build_floor(StoryLabyrinthState.floor_index)
	_prompt_blessing(Callable())


func _process(_delta: float) -> void:
	if _finished:
		return
	var player := get_tree().get_first_node_in_group("player")
	if player == null:
		return
	if not _defeated and float(player.hp) <= 0.0:
		_on_defeated()
		return
	if not _committed and _in_range_index >= 0 and Input.is_action_just_pressed("story_interact"):
		_commit_node(_in_range_index)


## ---------- 층 짓기 ----------

func _build_floor(idx: int) -> void:
	if _floor_root != null and is_instance_valid(_floor_root):
		_floor_root.queue_free()
	_floor_root = Node3D.new()
	_floor_root.name = "Floor%d" % idx
	add_child(_floor_root)
	_pedestals.clear()
	_in_range_index = -1
	_committed = false
	_node_enemies_left = 0

	var player := get_tree().get_first_node_in_group("player")
	if player != null:
		player.global_position = Vector3(PLAYER_START_X, 0.1, 0)

	if idx >= StoryLabyrinth.FLOOR_COUNT - 1:
		var width := NODE_START_X + NODE_SPACING + 6.0
		_build_ground(width)
		_build_boundary_walls(width)
		_spawn_boss(idx)
	else:
		var types := StoryLabyrinth.roll_floor_nodes()
		var width := NODE_START_X + float(maxi(types.size() - 1, 0)) * NODE_SPACING + 6.0
		_build_ground(width)
		_build_boundary_walls(width)
		for i in types.size():
			var t: String = types[i]
			var x: float = NODE_START_X + float(i) * NODE_SPACING
			_build_pedestal(i, x, t)
			_pedestals.append({"type": t, "x": x})
		Toast.show(self, "🗺️ %d층 — 발판 %d개 중 하나를 골라 K로 확정" % [idx + 1, types.size()], 3.0)


func _build_ground(width: float) -> void:
	var body := StaticBody3D.new()
	body.name = "Ground"
	body.position = Vector3(width * 0.5, -PLATFORM_THICKNESS * 0.5, 0)
	_floor_root.add_child(body)
	var mi := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(width, PLATFORM_THICKNESS, PLATFORM_DEPTH)
	mi.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = GROUND_COLOR
	mi.material_override = mat
	body.add_child(mi)
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = box.size
	cs.shape = shape
	body.add_child(cs)


func _build_boundary_walls(width: float) -> void:
	for x: float in [-0.5, width + 0.5]:
		var body := StaticBody3D.new()
		body.name = "Boundary"
		body.position = Vector3(x, WALL_HEIGHT * 0.5, 0)
		var cs := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = Vector3(1.0, WALL_HEIGHT, PLATFORM_DEPTH)
		cs.shape = shape
		body.add_child(cs)
		_floor_root.add_child(body)


func _build_pedestal(index: int, x: float, node_type: String) -> void:
	var body := StaticBody3D.new()
	body.name = "Pedestal%d" % index
	body.position = Vector3(x, PEDESTAL_HEIGHT * 0.5, 0)
	_floor_root.add_child(body)

	var mi := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(PEDESTAL_SIZE, PEDESTAL_HEIGHT, PEDESTAL_SIZE)
	mi.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = NODE_COLOR.get(node_type, Color(0.5, 0.5, 0.5))
	mat.emission_enabled = true
	mat.emission = mat.albedo_color
	mat.emission_energy_multiplier = 0.5
	mi.material_override = mat
	body.add_child(mi)

	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = box.size
	cs.shape = shape
	body.add_child(cs)

	var label := Label3D.new()
	label.text = "%s %s" % [String(StoryLabyrinth.NODE_ICON.get(node_type, "?")), String(StoryLabyrinth.NODE_LABEL.get(node_type, node_type))]
	label.position = Vector3(x, PEDESTAL_HEIGHT + 1.4, 0)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_floor_root.add_child(label)

	var area := Area3D.new()
	area.name = "PedestalArea%d" % index
	var acs := CollisionShape3D.new()
	var ashape := BoxShape3D.new()
	ashape.size = Vector3(PEDESTAL_SIZE, 3.0, PEDESTAL_SIZE)
	acs.shape = ashape
	area.add_child(acs)
	area.position = Vector3(x, 1.5, 0)
	area.body_entered.connect(_on_pedestal_entered.bind(index))
	area.body_exited.connect(_on_pedestal_exited.bind(index))
	_floor_root.add_child(area)


func _on_pedestal_entered(body: Node3D, index: int) -> void:
	if not body.is_in_group("player"):
		return
	_in_range_index = index
	if not _committed:
		Toast.show(self, "K: 이 발판으로 확정한다", 1.6)


func _on_pedestal_exited(body: Node3D, index: int) -> void:
	if not body.is_in_group("player"):
		return
	if _in_range_index == index:
		_in_range_index = -1


## ---------- 노드 확정 ----------

func _commit_node(index: int) -> void:
	_committed = true
	var chosen: Dictionary = _pedestals[index]
	var node_type: String = String(chosen.type)
	var x: float = float(chosen.x)
	for child in _floor_root.get_children():
		if child.name.begins_with("Pedestal") or (child is Label3D):
			child.queue_free()
	Toast.show(self, "%s %s 확정" % [String(StoryLabyrinth.NODE_ICON.get(node_type, "")), String(StoryLabyrinth.NODE_LABEL.get(node_type, node_type))], 2.0)
	match node_type:
		"battle":
			_spawn_battle(x, false)
		"elite":
			_spawn_battle(x, true)
		"treasure":
			_grant_treasure(x)
			_on_node_cleared()
		"rest":
			_grant_rest()
			_on_node_cleared()
		"event":
			_grant_event(x)
			_on_node_cleared()


func _floor_enemy_lv() -> float:
	return maxf(1.0, float(StorySaveState.level)) + float(StoryLabyrinthState.floor_index) * 2.0


func _spawn_battle(x: float, elite: bool) -> void:
	var count := 1 if elite else 2
	_node_enemies_left = count
	for i in count:
		var enemy := Node3D.new()
		enemy.set_script(StoryEnemyScene)
		enemy.enemy_lv = _floor_enemy_lv() + (3.0 if elite else 0.0)
		enemy.enemy_color = NODE_COLOR.get("elite" if elite else "battle")
		enemy.position = Vector3(x + (float(i) - float(count - 1) * 0.5) * 1.5, GROUND_Y, 0)
		_floor_root.add_child(enemy)
		enemy.died.connect(_on_node_enemy_died.bind(elite))


func _on_node_enemy_died(is_elite: bool) -> void:
	_node_enemies_left = maxi(0, _node_enemies_left - 1)
	if _node_enemies_left > 0:
		return
	if is_elite:
		_prompt_blessing(_on_node_cleared)
	else:
		_on_node_cleared()


func _grant_treasure(x: float) -> void:
	var amount := roundi((40.0 + float(StoryLabyrinthState.floor_index) * 20.0) * StoryLabyrinthState.reward_mult())
	StoryGoldPickup.spawn_at(_floor_root, Vector3(x, 0, 0), amount)


func _grant_rest() -> void:
	var player := get_tree().get_first_node_in_group("player")
	if player != null:
		player.heal_pct(1.0)
		player.mp = player.max_mp
	Toast.show(self, "🏕️ 야영 — 체력과 기력을 모두 채웠다", 2.5)


func _grant_event(x: float) -> void:
	if randf() < 0.5:
		var amount := roundi((20.0 + float(StoryLabyrinthState.floor_index) * 10.0) * StoryLabyrinthState.reward_mult())
		StoryGoldPickup.spawn_at(_floor_root, Vector3(x, 0, 0), amount)
		Toast.show(self, "❓ 낡은 상자를 뒤져 금을 찾았다", 2.5)
	else:
		var exp := roundi(30.0 * StoryLabyrinthState.reward_mult())
		StorySaveState.add_exp(exp)
		Toast.show(self, "❓ 옛 수련 흔적에서 깨달음을 얻었다 · 경험 +%d" % exp, 2.5)


## ---------- 축복(은사) ----------

func _prompt_blessing(on_done: Callable) -> void:
	var choice := StoryLabyrinthState.roll_choice()
	if choice.is_empty():
		if on_done.is_valid():
			on_done.call()
		return
	var layer_box := {}
	var axis_icons := {"atk": "⚔️", "def": "🛡️", "util": "🌀"}
	var rarity_tags := {"common": "", "rare": "[희귀] "}
	var choices: Array = []
	for key in choice:
		var b := StoryLabyrinth.by_key(key)
		var axis_icon: String = axis_icons.get(str(b.get("axis", "")), "")
		var rarity_tag: String = rarity_tags.get(str(b.get("rarity", "common")), "")
		choices.append({
			"label": "%s %s%s %s — %s" % [axis_icon, rarity_tag, b.emoji, b.name, b.desc],
			"cb": func() -> void: _on_blessing_picked(key, layer_box, on_done),
		})
	layer_box["layer"] = ChoicePrompt.build(self, "💠 비경의 축복을 고르세요", choices)


func _on_blessing_picked(key: String, layer_box: Dictionary, on_done: Callable) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	StoryLabyrinthState.apply_boon(key)
	if on_done.is_valid():
		on_done.call()


## ---------- 층 진행 ----------

func _on_node_cleared() -> void:
	StoryLabyrinthState.on_node_cleared()
	await get_tree().create_timer(1.0).timeout
	if _finished:
		return
	StoryLabyrinthState.floor_index += 1
	_build_floor(StoryLabyrinthState.floor_index)


## ---------- 보스(5층) ----------

func _spawn_boss(idx: int) -> void:
	var x := NODE_START_X * 0.5 + 3.0
	var boss := Node3D.new()
	boss.set_script(StoryEnemyScene)
	boss.is_boss = true
	boss.enemy_lv = _floor_enemy_lv() + 4.0
	boss.boss_hp_mul = 3.0 * StoryLabyrinthState.weekly_enemy_hp_mult()
	boss.boss_dmg_mul = 1.8
	boss.enemy_color = Color(0.5, 0.1, 0.6)
	boss.position = Vector3(x, GROUND_Y, 0)
	_floor_root.add_child(boss)
	boss.died.connect(_on_boss_died.bind(x))
	Toast.show(self, "🐲 비경 5층 — 마지막 파수꾼이 나타났다", 3.0)


func _on_boss_died(boss_x: float) -> void:
	if _finished:
		return
	_finished = true
	var uniq_keys := StoryCombat.UNIQUE_ITEMS.keys()
	if uniq_keys.size() > 0:
		var picked: String = uniq_keys[randi() % uniq_keys.size()]
		StoryGearPickup.spawn_at(_floor_root, Vector3(boss_x, 0, 0.6), picked)
	StorySaveState.grant_labyrinth_scroll()
	var frags := StoryLabyrinthState.end_run(true)
	Toast.show(self, "🎉 비경 완주! 기억 조각 %d개를 얻었다" % frags, 3.5)
	await get_tree().create_timer(2.2).timeout
	_return_to_town()


## ---------- 패퇴 ----------

func _on_defeated() -> void:
	if _finished:
		return
	_defeated = true
	_finished = true
	var frags := StoryLabyrinthState.end_run(false)
	Toast.show(self, "💀 패퇴 — 기억 조각 %d개를 챙겨 마을로 돌아간다" % frags, 3.0)
	await get_tree().create_timer(1.5).timeout
	_return_to_town()


func _return_to_town() -> void:
	StorySaveState.set_pending_spawn(TOWN_ARRIVAL_X)
	get_tree().change_scene_to_file(TOWN_SCENE)
