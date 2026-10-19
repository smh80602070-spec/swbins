extends Node
## G-0242 3마을 땅 아래 층 뷰(world/forest_cave_view.gd) 점검 — 러너 tools/probe_forest_cave.gd 가 scene_probe_host 로 부른다.
## ① 마을에 바위 아치(지도 안)·곁이면 near_gate ② 들면 먼 평평한 방·해/환경광 낮춤·손 불빛 2.5m·0층엔 짐승 없음
## ③ 가까운 사물 쓰기(횃불) → 불빛 9m·받침 불 켜짐 ④ 사다리 → 1층 다시 짓기(짐승·광석 둘) ⑤ 위로 두 번 → 마을 아치 앞·해/환경광 되돌림·손 불빛 치움
## ⑥ 굴 좌표에서 불러온 세이브 → 아치 앞으로. 세이브 칸·시각·날짜는 끝에 되돌린다.

const View := preload("res://games/saga_forest/world/forest_cave_view.gd")
const Cave := preload("res://games/saga_forest/data/forest_cave.gd")
const ForestMap := preload("res://games/saga_forest/data/village_map.gd")

var fails := 0


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		fails += 1
		print("  FAIL ", name, " ", detail)
	else:
		print("  ok   ", name, " ", detail)


func run() -> int:
	var F: Node = ForestSaveState
	var saved := {"items": F.items.duplicate(true), "cave": F.cave.duplicate(true)}
	F.items = {"솔방울": 1}
	F.cave = {}
	Cave.now_override = 1_900_000_000.0
	ForestDay.force(20261019)

	var scene := Node3D.new()
	add_child(scene)
	var sun := DirectionalLight3D.new()
	sun.name = "Sun"
	sun.light_energy = 1.1
	scene.add_child(sun)
	var we := WorldEnvironment.new()
	we.name = "WorldEnvironment"
	we.environment = Environment.new()
	we.environment.ambient_light_energy = 1.0
	scene.add_child(we)
	var player := CharacterBody3D.new()
	player.add_to_group("player")
	scene.add_child(player)
	var view: Node3D = View.new()
	scene.add_child(view)
	await get_tree().process_frame

	# ①
	var half := Vector2(ForestMap.size()) * 0.5 * ForestMap.TILE_SIZE
	player.global_position = view.gate_pos + Vector3(0, 0.1, 2.0)
	var gate := view.get_node_or_null("CaveGate")
	_check("gate", gate != null and absf(view.gate_pos.x) < half.x and absf(view.gate_pos.z) < half.y and view.near_gate(),
		"gate=%s near=%s" % [view.gate_pos, view.near_gate()])

	# ②
	view.enter()
	await get_tree().process_frame
	var floor0 := view.get_node_or_null("CaveFloor_0")
	var lt: OmniLight3D = view.player_light
	_check("enter", view.inside and player.global_position.distance_to(View.CAVE_ORIGIN) < 12.0 and floor0 != null
		and is_equal_approx(sun.light_energy, 1.1 * View.DARK_SUN) and is_equal_approx(we.environment.ambient_light_energy, View.DARK_AMBIENT)
		and lt != null and lt.get_parent() == player and is_equal_approx(lt.omni_range, View.LIGHT_DARK) and floor0.get_node_or_null("Cave_beast") == null,
		"pos=%s sun=%.3f amb=%.3f light=%s" % [player.global_position, sun.light_energy, we.environment.ambient_light_energy, lt.omni_range if lt else -1.0])

	# ③ 횃불 — 받침 곁에서 가까운 것 쓰기
	player.global_position = view._spot("torch") + Vector3(0.3, 0.1, 0)
	var r: Dictionary = view.use_nearest()
	var flame := floor0.get_node("Cave_torch/Flame") as OmniLight3D
	_check("torch", String(r.get("kind", "")) == "torch" and is_equal_approx(lt.omni_range, View.LIGHT_LIT) and flame.visible and F.item_count("솔방울") == 0,
		"r=%s light=%.1f flame=%s" % [r.get("text", ""), lt.omni_range, flame.visible])

	# ④ 사다리 → 1층
	var dn: Dictionary = view.act_id("ladder")
	await get_tree().process_frame
	var floor1 := view.get_node_or_null("CaveFloor_1")
	_check("down", String(dn.kind) == "down" and floor1 != null and view.get_node_or_null("CaveFloor_0") == null and floor1.get_node_or_null("Cave_beast") != null
		and floor1.get_node_or_null("Cave_ore0") != null and floor1.get_node_or_null("Cave_ore1") != null and int(view.run.floor) == 1,
		"kind=%s floor=%d" % [dn.kind, int(view.run.floor)])

	# ⑤ 위로 두 번 → 마을
	view.act_id("door")
	var lv: Dictionary = view.act_id("door")
	await get_tree().process_frame
	var back := Vector2(player.global_position.x - view.gate_pos.x, player.global_position.z - view.gate_pos.z).length()
	_check("leave", not view.inside and String(lv.kind) == "leave" and is_equal_approx(sun.light_energy, 1.1) and is_equal_approx(we.environment.ambient_light_energy, 1.0)
		and not is_instance_valid(lt) and view.player_light == null and back < View.GATE_M and view.get_node_or_null("CaveFloor_0") == null,
		"sun=%.2f amb=%.2f back=%.2f" % [sun.light_energy, we.environment.ambient_light_energy, back])

	# ⑥ 굴 좌표에서 불러온 세이브
	player.global_position = View.CAVE_ORIGIN + Vector3(1, 0.1, 1)
	var rescued: bool = view.rescue_if_stranded()
	_check("rescue", rescued and player.global_position.distance_to(view.gate_pos) < 3.0, "pos=%s" % player.global_position)

	scene.queue_free()
	F.items = saved.items
	F.cave = saved.cave
	Cave.now_override = -1.0
	ForestDay.force(null)
	return fails
