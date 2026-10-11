extends SceneTree

## G-0203 "내가 맞았다" 신호 자동 점검 — 2나락(player_health.gd)·4종횡(story_player.gd)이 saga_core/ui/hurt_vignette.gd 를 씬에 하나 붙이고 맞으면 쓰는지.
##   godot --headless --path saga-godot --script res://tools/probe_hurt_signal.gd
## ① 씬에 하나만 붙음(그룹 hurt_vignette·옛 go_hurt_vignette 둘 다) ② 2나락 맞으면 가장자리 번쩍·숫자 +1(player 조상이라 붉음)·체력 25% 면 맥박·회복해 50% 면 꺼짐
## ③ 4종횡 같은 것 + 받아치기 창 안에서 맞으면 신호 없음. 끝에 "PROBE hurt_signal OK" 또는 "PROBE hurt_signal FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var feel: Node = root.get_node("CombatFeel")
	var pops := [0]
	feel.popup_triggered.connect(func(_a, _c): pops[0] += 1)
	var stage := Node3D.new()
	root.add_child(stage)
	current_scene = stage

	# ② 2나락 — 플레이어 흉내(그룹 player · 형제 Visual) 밑에 진짜 PlayerHealth
	var dp := Node3D.new()
	dp.name = "Player"
	dp.add_to_group("player")
	var vis := Node3D.new()
	vis.name = "Visual"
	var mesh := MeshInstance3D.new()
	mesh.mesh = BoxMesh.new()
	vis.add_child(mesh)
	dp.add_child(vis)
	var ph: Node = (load("res://games/saga_dungeon/player/player_health.gd") as GDScript).new()
	dp.add_child(ph)
	stage.add_child(dp)
	await process_frame
	await process_frame
	var hvs := get_nodes_in_group("hurt_vignette")
	check(hvs.size() == 1 and hvs[0].is_in_group("go_hurt_vignette") and hvs[0].get_parent() == stage, "① 씬에 가장자리 신호 하나(두 그룹) %d" % hvs.size())
	var hv: Node = hvs[0] if hvs.size() > 0 else null
	ph.hp = ph.max_hp
	pops[0] = 0
	ph.take_damage(5.0)
	check(hv != null and hv._flash_t > 0.0 and pops[0] == 1 and feel._is_player(vis), "② 2나락 맞음: 번쩍 %.2f · 숫자 %d(붉음 = player 조상)" % [hv._flash_t if hv else -1.0, pops[0]])
	ph.take_damage(ph.hp - ph.max_hp * 0.25)
	var low_on: bool = hv._low
	ph.heal_by(ph.max_hp * 0.25)
	check(low_on and not hv._low, "② 2나락 체력 25% 맥박 켜짐 → 50% 꺼짐")
	dp.queue_free()
	await process_frame
	Engine.time_scale = 1.0

	# ③ 4종횡 — 진짜 StoryPlayer(씬에 이미 있는 신호를 같이 씀)
	var sp: Node = (load("res://games/saga_story/player/StoryPlayer.tscn") as PackedScene).instantiate()
	stage.add_child(sp)
	await process_frame
	await process_frame
	sp.set_physics_process(false)
	check(sp._hv == hv and get_nodes_in_group("hurt_vignette").size() == 1, "③ 4종횡도 같은 신호 하나를 씀")
	sp._invuln_time_left = 0.0
	sp.hp = sp.max_hp
	hv._flash_t = 0.0
	pops[0] = 0
	sp.take_damage(20.0)
	check(hv._flash_t > 0.0 and pops[0] == 1, "③ 4종횡 맞음: 번쩍 %.2f · 숫자 %d" % [hv._flash_t, pops[0]])
	sp.hp = sp.max_hp * 0.25
	var s_low: bool = hv._low
	sp.heal_pct(0.25)
	check(s_low and not hv._low, "③ 4종횡 체력 25% 맥박(hp setter) → 50% 꺼짐")
	hv._flash_t = 0.0
	pops[0] = 0
	sp._invuln_time_left = 0.0
	sp._parry_time_left = 0.2
	var hp_before: float = sp.hp
	sp.take_damage(20.0)
	check(hv._flash_t == 0.0 and pops[0] == 0 and sp.hp == hp_before, "③ 받아치기 창 안에서 맞으면 신호·피해 없음")
	sp.queue_free()
	Engine.time_scale = 1.0
	print("PROBE hurt_signal OK" if fails == 0 else "PROBE hurt_signal FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
