extends Node3D

## PLAN 106장 ⑱ — 요리 냄비·조리·먹기(규칙). 표는 data/cooking.gd, 화면은 ui/cooking_screen.gd.
##   냄비 셋 — 신상마다 곁(waypoints.gd 신상 자리 + 3.5m). 냄비 3m 안에서 F(또는 화면 단추)로 요리 화면.
##   조리 cook(요리, 품질): 재료를 쓰고 가방에 "dish_<요리>_<품질>" 하나, 숙련 +1. 숙련 5 면 auto_cook(보통).
##   먹기 eat(dish, 인물): 회복 셋은 그 인물 포만감 +35(100 넘으면 못 먹음, 초마다 1 줄어듦) — 한 인물 회복·
##   명단 모두 회복·쓰러진 인물 되살리기. 버프 다섯은 명단 전체 300초, 계열(공격·방어·모험)마다 하나.
## 포만감·버프는 세션 한정(저장 안 함) — 원신도 버프는 곧 끝난다.

const Cooking := preload("res://games/saga_go/data/cooking.gd")
const Waypoints := preload("res://games/saga_go/world/waypoints.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const RenderBudget := preload("res://games/saga_go/world/render_budget.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

signal changed()
signal cooked(recipe: String, q: int) # 106장 ⑲ 의뢰가 센다

const POT_M := 3.0
const POT_OFFSET := Vector3(3.5, 0.0, 1.5)

var fullness: Dictionary = {} # 인물 id → 0~100
var _pots: Array[Vector3] = []
var _player: Node3D = null

func _ready() -> void:
	add_to_group("go_kitchen")
	_player = get_tree().get_first_node_in_group("player")
	if not InputMap.has_action("go_cook"):
		InputMap.add_action("go_cook")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_F
		InputMap.action_add_event("go_cook", ev)
	for row in Waypoints.POINTS:
		if row[3]:
			var g: Vector2 = row[2]
			var p := TestMap.world_pos(g.x, g.y, row[1]) + POT_OFFSET
			p.y = TerrainBuilder.height_at(row[1], p)
			_pots.append(p)
			_build_pot(p)

func pots() -> Array[Vector3]:
	return _pots

func near_pot() -> bool:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
	if _player == null:
		return false
	for p in _pots:
		if _player.global_position.distance_to(p) <= POT_M:
			return true
	return false

func _process(delta: float) -> void:
	PartyState.tick_food(delta)
	for id in fullness.keys():
		fullness[id] = maxf(float(fullness[id]) - Cooking.FULL_DECAY * delta, 0.0)
		if fullness[id] <= 0.0:
			fullness.erase(id)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("go_cook") and near_pot():
		var scr := get_tree().get_first_node_in_group("go_cooking_screen")
		if scr and not scr.get("is_open"):
			scr.call("open_screen")
			get_viewport().set_input_as_handled()

# ---------------------------------------------------------------- 조리

static func can_cook(recipe: String) -> bool:
	return PartyState.has_items(Cooking.RECIPES[recipe].ing)

static func prof(recipe: String) -> int:
	return int(PartyState.cook_prof.get(recipe, 0))

## 재료를 쓰고 품질 q 요리 하나. 재료가 모자라면 false.
func cook(recipe: String, q: int) -> bool:
	if not PartyState.spend_items(Cooking.RECIPES[recipe].ing):
		return false
	PartyState.add_items({Cooking.dish_id(recipe, q): 1})
	PartyState.cook_prof[recipe] = mini(prof(recipe) + 1, Cooking.PROF_MAX)
	get_tree().call_group("go_sfx", "play", "cook_done")   # G-0177
	cooked.emit(recipe, q)
	changed.emit()
	return true

## 숙련이 다 찼으면 n 번 한꺼번에(보통). 만든 수.
func auto_cook(recipe: String, n: int = 1) -> int:
	if prof(recipe) < Cooking.PROF_MAX:
		return 0
	var made := 0
	for i in n:
		if not cook(recipe, 1):
			break
		made += 1
	return made

# ---------------------------------------------------------------- 먹기

func full_of(id: String) -> float:
	return float(fullness.get(id, 0.0))

func _combat() -> Node:
	return get_tree().get_first_node_in_group("go_field_combat")

## 이 요리를 이 인물에게 먹일 수 있나 — 못 먹는 까닭(빈 문자열이면 된다).
func eat_block(dish: String, id: String) -> String:
	if PartyState.count(dish) <= 0:
		return "없음"
	var parts := dish.split("_")
	var recipe := "_".join(parts.slice(1, parts.size() - 1))
	var r: Dictionary = Cooking.RECIPES[recipe]
	if Cooking.uses_fullness(recipe) and full_of(id) + Cooking.FULL_PER_DISH > Cooking.FULL_MAX:
		return "배부름"
	var fc := _combat()
	if fc == null:
		return "" if r.effect == "buff" else "전투 없음"
	var hp: float = fc.call("hp_of", id)
	match String(r.effect):
		"heal":
			if hp <= 0.0:
				return "쓰러짐"
			if hp >= float(fc.call("max_hp_of", id)):
				return "체력 가득"
		"revive":
			if hp > 0.0:
				return "쓰러진 인물만"
	return ""

## 먹는다. 된 효과 한 줄(못 먹으면 빈 문자열).
func eat(dish: String, id: String) -> String:
	if eat_block(dish, id) != "":
		return ""
	var parts := dish.split("_")
	var q := int(parts[parts.size() - 1])
	var recipe := "_".join(parts.slice(1, parts.size() - 1))
	var r: Dictionary = Cooking.RECIPES[recipe]
	var fc := _combat()
	PartyState.spend_items({dish: 1})
	if Cooking.uses_fullness(recipe):
		fullness[id] = full_of(id) + Cooking.FULL_PER_DISH
	var msg := "%s — %s" % [Cooking.dish_name(recipe, q), Cooking.effect_text(recipe, q)]
	match String(r.effect):
		"heal":
			fc.call("heal_member", id, float(r.ratio[q]), float(r.flat[q]))
		"heal_all":
			fc.call("heal_all", float(r.ratio[q]))
		"revive":
			fc.call("revive_member", id, float(r.ratio[q]))
		"buff":
			var old: Variant = PartyState.food_buffs.get(r.cat, null)
			PartyState.set_food_buff(r.cat, recipe, q, r.stat, float(r.value[q]), Cooking.BUFF_SEC)
			if old != null and old.recipe != recipe:
				msg += " (%s 요리 갈아 끼움)" % Cooking.CAT_NAMES[r.cat]
	CombatFeel.ui()
	Toast.show(self, msg, 2.5)
	changed.emit()
	return msg

# ---------------------------------------------------------------- 모양

func _build_pot(p: Vector3) -> void:
	var root := Node3D.new()
	root.name = "CookingPot_%d" % _pots.size()   # G-0114 — 같은 이름이면 둘째부터 @Node3D@ 로 바뀌어 render_budget 의 "솥 그림자 끔" 에서 빠졌다
	add_child(root)
	root.global_position = p
	var iron := StandardMaterial3D.new()
	iron.albedo_color = Color(0.18, 0.17, 0.16)
	iron.metallic = 0.4
	iron.roughness = 0.6
	var pot := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = 0.45
	s.height = 0.7
	pot.mesh = s
	pot.material_override = iron
	pot.position = Vector3(0.0, 0.62, 0.0)
	root.add_child(pot)
	var rim := MeshInstance3D.new()
	var t := TorusMesh.new()
	t.inner_radius = 0.34
	t.outer_radius = 0.42
	rim.mesh = t
	rim.material_override = iron
	rim.position = Vector3(0.0, 0.92, 0.0)
	root.add_child(rim)
	var wood := StandardMaterial3D.new()
	wood.albedo_color = Color(0.42, 0.28, 0.16)
	for i in 3:
		var a := TAU * i / 3.0
		var leg := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.04
		cm.bottom_radius = 0.05
		cm.height = 1.3
		leg.mesh = cm
		leg.material_override = wood
		leg.position = Vector3(cos(a) * 0.55, 0.6, sin(a) * 0.55)
		leg.rotation = Vector3(sin(a) * 0.35, 0.0, -cos(a) * 0.35)
		root.add_child(leg)
	RenderBudget.merge_children(root)   # G-0114 — 솥·테(쇠)·다리 셋(나무)을 재질마다 한 메시로
	## 장작불 — 주황 빛 원뿔 + 가벼운 흔들림.
	var fire := MeshInstance3D.new()
	var fm := CylinderMesh.new()
	fm.top_radius = 0.0
	fm.bottom_radius = 0.28
	fm.height = 0.45
	fire.mesh = fm
	var fmat := StandardMaterial3D.new()
	fmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	fmat.albedo_color = Color(1.0, 0.55, 0.15)
	fmat.emission_enabled = true
	fmat.emission = Color(1.0, 0.45, 0.1)
	fire.material_override = fmat
	fire.position = Vector3(0.0, 0.22, 0.0)
	fire.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(fire)
	var tw := fire.create_tween().set_loops()
	tw.tween_property(fire, "scale", Vector3(1.1, 1.25, 1.1), 0.35).set_trans(Tween.TRANS_SINE)
	tw.tween_property(fire, "scale", Vector3(0.95, 0.9, 0.95), 0.35).set_trans(Tween.TRANS_SINE)
	var light := OmniLight3D.new()
	light.light_color = Color(1.0, 0.6, 0.3)
	light.light_energy = 0.8
	light.omni_range = 4.0
	light.position = Vector3(0.0, 0.5, 0.0)
	root.add_child(light)
