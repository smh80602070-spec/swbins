extends SceneTree

## G-0407 4종횡 금 줍는 펫 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_story_pet.gd   → "PROBE story_pet OK" / "FAIL n"
## ① TestField: 주인공 곁에 StoryPet 하나(몸 있음) · 주인공 뒤 FOLLOW 안에 선다
## ② 주인공 앞 4m 금(10) → 펫이 주워 와 금 +10 쯤(상단 배율) · picked 1 · 금 Area 사라짐
## ③ 주인공에서 PICK_R 밖(12m) 금은 안 줍는다
## 저장은 안 한다(금은 메모리만 — add_gold 는 저장하지 않는다).

const PET := "res://games/saga_story/world/story_pet.gd"
const GOLD := "res://games/saga_story/world/story_gold_pickup.gd"
const FIELD := "res://games/saga_story/world/TestField.tscn"

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _init() -> void:
	await process_frame
	var sc := (load(FIELD) as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 60:
		await physics_frame
	var p := get_first_node_in_group("player") as Node3D
	var pet := sc.get_node_or_null("StoryPet") as Node3D
	if pet == null or pet.get_child_count() == 0:
		_fail("① StoryPet %s" % (pet != null))
		print("PROBE story_pet FAIL %d" % fails)
		quit(1)
		return
	for _i in 30:
		await physics_frame
	var near := pet.global_position.distance_to(p.global_position)
	if near > 2.5:
		_fail("① 펫이 멀다 %.2f" % near)
	var ss := root.get_node("StorySaveState")
	var Gold: GDScript = load(GOLD)
	var g0 := int(ss.get("gold"))
	Gold.spawn_at(sc, p.global_position + Vector3(4.0, 0.0, 0.0), 10)
	for _i in 120:
		await physics_frame
	var g1 := int(ss.get("gold"))
	var left := get_nodes_in_group("story_gold").size()
	print("PET near %.2f · 금 %d → %d · picked %d · 남은 금 %d" % [near, g0, g1, int(pet.get("picked")), left])
	if g1 < g0 + 10 or int(pet.get("picked")) != 1 or left != 0:
		_fail("② 줍기 금 %d → %d · picked %d · 남은 %d" % [g0, g1, int(pet.get("picked")), left])
	Gold.spawn_at(sc, p.global_position + Vector3(12.0, 0.0, 0.0), 10)
	for _i in 60:
		await physics_frame
	if int(pet.get("picked")) != 1 or get_nodes_in_group("story_gold").size() != 1:
		_fail("③ 먼 금을 주웠다 picked %d" % int(pet.get("picked")))
	sc.queue_free()
	for _k in 3:
		await process_frame
	print("PROBE story_pet ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
