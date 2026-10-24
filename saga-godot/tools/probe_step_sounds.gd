extends SceneTree

## G-0369 발소리(2나락·3마을·4종횡) 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_step_sounds.gd   → "PROBE step_sounds OK" / "FAIL n"
## ① surface_of: 2나락 돌 · 3마을 풀 · 4종횡 풀 · 4종횡 굴 돌
## ② 세 판 씬: 주인공 밑에 StepSounds 하나(MoveSounds 없음) · 소리 11개 불러옴(땅 넷 × 둘 + 물 튐 · G-0370 점프·착지)
## ④ G-0370 위 속도가 확 오르면 점프 1 · 공중(직전 낙하 −10) → 바닥이면 착지 1(바닥에 섰을 때만)
## ③ 바닥에 선 주인공에게 걷는 속도를 주고 한 걸음 셈 → 발소리 1 · 속도 0 이면 안 셈. 헤드리스라 소리는 안 들리고 counts 만.

const StepSounds := preload("res://saga_core/audio/step_sounds.gd")
const SCENES := {"dungeon": "res://games/saga_dungeon/world/TestRoom.tscn", "forest": "res://games/saga_forest/world/TestVillageForest.tscn",
	"story": "res://games/saga_story/world/TestField.tscn"}

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _init() -> void:
	await process_frame
	var sf := [StepSounds.surface_of(SCENES.dungeon), StepSounds.surface_of(SCENES.forest), StepSounds.surface_of(SCENES.story),
		StepSounds.surface_of("res://games/saga_story/world/CaveHuntGround.tscn")]
	if sf != ["stone", "grass", "grass", "stone"]:
		_fail("① surface_of %s" % [sf])
	for g in SCENES:
		var sc := (load(SCENES[g]) as PackedScene).instantiate()
		root.add_child(sc)
		current_scene = sc
		for _i in 60:
			await physics_frame
		var p := get_first_node_in_group("player") as CharacterBody3D
		var st: Node = p.get_node_or_null("StepSounds") if p else null
		if st == null or p.get_node_or_null("MoveSounds") != null:
			_fail("② %s StepSounds %s" % [g, st != null])
		else:
			var n := (st.get("_streams") as Dictionary).size()
			if n != 11:
				_fail("② %s 소리 %d != 11" % [g, n])
			var c0 := int((st.get("counts") as Dictionary).step)
			st.set("_t", 0.0)
			p.velocity = Vector3.ZERO
			st.call("_physics_process", 0.016)
			var c1 := int((st.get("counts") as Dictionary).step)
			var floor_ok := p.is_on_floor()
			p.velocity = Vector3(3.0, 0.0, 0.0)
			st.set("_t", 0.0)
			st.call("_physics_process", 0.016)
			var c2 := int((st.get("counts") as Dictionary).step)
			var cnt := st.get("counts") as Dictionary
			var j0 := int(cnt.jump)
			st.set("_last_vy", 0.0)
			p.velocity = Vector3(0.0, 15.0, 0.0)
			st.call("_physics_process", 0.016)
			var j1 := int((st.get("counts") as Dictionary).jump)
			var l0 := int((st.get("counts") as Dictionary).land)
			st.set("_was_floor", false)
			st.set("_last_vy", -10.0)
			p.velocity = Vector3.ZERO
			st.call("_physics_process", 0.016)
			var l1 := int((st.get("counts") as Dictionary).land)
			p.velocity = Vector3.ZERO
			print("STEPSND %s surface=%s floor=%s 섬 %d→%d→%d 점프 %d→%d 착지 %d→%d" % [g, st.get("surface"), floor_ok, c0, c1, c2, j0, j1, l0, l1])
			if j1 != j0 + 1 or (floor_ok and l1 != l0 + 1):
				_fail("④ %s 점프 %d→%d 착지 %d→%d" % [g, j0, j1, l0, l1])
			if c1 != c0 or (floor_ok and c2 != c1 + 1):
				_fail("③ %s 걸음 셈 %d→%d→%d" % [g, c0, c1, c2])
		paused = false
		sc.queue_free()
		for _k in 3:
			await process_frame
	print("PROBE step_sounds ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
