extends SceneTree

## G-0319 4종횡 숨은 우두머리 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_story_hidden.gd   → "PROBE story_hidden OK" / "FAIL n"
## ① 규칙: 비문 한 번 · 안 읽으면·60초 넘으면·안 맞았으면 안 섬 · 보상 40 × lv
## ② 굴혈 씬: 비문이 끝자락에 섬 · 닿기 읽기(새로 한 번)
## ③ 실제 보스: 비문 읽고 첫 타 뒤 곧바로 쓰러뜨리면 2초 뒤 숨은 우두머리(체력 ×2.5·짙은 보라·관문 대장 아님) · 잡으면 금 + 기록
## ④ 비문 안 읽은 땅은 안 섬 ⑤ SAGA_HIDDEN=0 → 비문·숨은 우두머리 없음 ⑥ 저장 왕복·옛 24 → 빈 칸 · 판 25 ⑦ 배선.

const SAVED_VARS := ["hidden", "gold", "has_pending_spawn", "pending_spawn_x", "path_override"]

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _hidden_boss(sp: Node) -> Node:
	for c in sp.get_children():
		if c.get("boss_name") != null and str(c.get("boss_name")).begins_with("숨은 ") and not bool(c.get("_dead")):
			return c
	return null


func _initialize() -> void:
	await process_frame
	var S: Node = root.get_node("StorySaveState")
	var H: GDScript = load("res://games/saga_story/data/story_hidden.gd")
	var Clue: GDScript = load("res://games/saga_story/world/story_hidden_clue.gd")
	var saved := {}
	for v in SAVED_VARS:
		saved[v] = S.get(v)
		if saved[v] is Dictionary:
			saved[v] = (saved[v] as Dictionary).duplicate(true)

	# ①
	var hd := {}
	var r1: bool = H.read_clue(hd, "cave")
	var r2: bool = H.read_clue(hd, "cave")
	check(r1 and not r2 and not H.should_rise(hd, "forest", 10.0) and H.should_rise(hd, "cave", 30.0) and not H.should_rise(hd, "cave", 61.0) and not H.should_rise(hd, "cave", -1.0) and H.beat(hd, "cave", 14) == 560 and int(hd.cave.beaten) == 1,
		"① 비문 한 번 · 안 읽음/61초/안 맞음 안 섬 · 보상 40×14")

	# ②
	S.hidden = {}
	S.has_pending_spawn = true
	S.pending_spawn_x = 3.0
	var sc: Node = (load("res://games/saga_story/world/CaveHuntGround.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	for _i in 3:
		await process_frame
	var clue: Node3D = sc.get_node_or_null("HiddenClue")
	var cave_map: GDScript = load("res://games/saga_story/data/cave_map.gd")
	check(clue != null and is_equal_approx(clue.position.x, float(cave_map.width_m()) - H.CLUE_INSET_M) and Clue.read(clue, "cave") and not Clue.read(clue, "cave") and H.clue_read(S.hidden, "cave"),
		"② 굴혈 끝자락 비문(x %.1f) · 닿기 읽기 한 번" % (clue.position.x if clue else -1.0))

	# ③
	var sp: Node = sc.get_node("BossSpawner")
	var boss: Node = sp.get("_boss")
	boss.set("hp", float(boss.get("max_hp")) - 1.0)
	sp._process(0.016)
	var g0: int = S.gold
	boss.call("_die")
	await create_timer(H.RISE_SEC + 0.4).timeout
	var hb := _hidden_boss(sp)
	var base_mul: float = float(cave_map.boss_hp_mul())
	check(hb != null and is_equal_approx(float(hb.get("boss_hp_mul")), base_mul * H.HP_MUL) and Color(hb.get("enemy_color")).is_equal_approx(H.COLOR) and not bool(hb.get("is_champion")),
		"③ 빨리 잡으면 숨은 우두머리 섬(체력 ×%.1f)" % (float(hb.get("boss_hp_mul")) / base_mul if hb else 0.0))
	var g1: int = S.gold
	if hb != null:
		hb.call("_die")
	await process_frame
	check(int(S.hidden.cave.beaten) == 1 and S.gold - g1 >= 40 * int(cave_map.enemy_lv()) and g1 >= g0, "③ 숨은 우두머리 처치 → 기록 1 · 금 +%d" % (S.gold - g1))
	sc.queue_free()
	await process_frame

	# ④
	S.hidden = {}
	var sc2: Node = (load("res://games/saga_story/world/CaveHuntGround.tscn") as PackedScene).instantiate()
	root.add_child(sc2)
	for _i in 3:
		await process_frame
	var sp2: Node = sc2.get_node("BossSpawner")
	var b2: Node = sp2.get("_boss")
	b2.set("hp", float(b2.get("max_hp")) - 1.0)
	sp2._process(0.016)
	b2.call("_die")
	await create_timer(H.RISE_SEC + 0.4).timeout
	check(_hidden_boss(sp2) == null, "④ 비문 안 읽은 땅 → 안 섬")
	sc2.queue_free()
	await process_frame

	# ⑤
	OS.set_environment("SAGA_HIDDEN", "0")
	var sc3: Node = (load("res://games/saga_story/world/CaveHuntGround.tscn") as PackedScene).instantiate()
	root.add_child(sc3)
	for _i in 3:
		await process_frame
	check(sc3.get_node_or_null("HiddenClue") == null and not H.read_clue({}, "cave") and not H.should_rise({"cave": {"clue": true}}, "cave", 5.0), "⑤ SAGA_HIDDEN=0 → 비문·숨은 우두머리 없음")
	sc3.queue_free()
	OS.set_environment("SAGA_HIDDEN", "")
	await process_frame

	# ⑥
	var dummy := Node3D.new()
	dummy.add_to_group("player")
	root.add_child(dummy)
	S.path_override = "user://probe_story_hidden_rt.json"
	S.hidden = {"cave": {"clue": true, "beaten": 2}}
	var sv: bool = S.save()
	S.hidden = {}
	var ld: bool = S.try_load()
	check(sv and ld and H.clue_read(S.hidden, "cave") and int(S.hidden.cave.beaten) == 2, "⑥ 저장 왕복 %s" % str(S.hidden))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(S.path_override))
	S.path_override = "user://probe_story_hidden_old.json"
	var f := FileAccess.open(S.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify({"version": 24, "level": 5, "exp": 0, "gold": 10, "player_pos": [0.0, 0.1, 0.0]}))
	f.close()
	S.hidden = {"x": {"clue": true}}
	var ld_old: bool = S.try_load()
	check(ld_old and S.hidden.is_empty() and S.save_version() >= 25, "⑥ 옛 24 세이브 → 빈 칸 · 판 %d" % S.save_version())
	DirAccess.remove_absolute(ProjectSettings.globalize_path(S.path_override))
	dummy.queue_free()

	# ⑦
	var fd := FileAccess.get_file_as_string("res://games/saga_story/world/story_field.gd")
	var bs := FileAccess.get_file_as_string("res://games/saga_story/world/story_boss_spawner.gd")
	check(fd.contains("story_hidden_clue.gd\").attach(self)") and bs.contains("Hidden.should_rise(StorySaveState.hidden"), "⑦ 배선 둘")

	for v in SAVED_VARS:
		S.set(v, saved[v])
	await process_frame
	print("PROBE story_hidden ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
