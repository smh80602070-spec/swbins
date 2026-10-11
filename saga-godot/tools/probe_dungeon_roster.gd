extends SceneTree

## G-0207 2나락 잡몹 명단(games/saga_dungeon/data/dungeon_enemies.gd) 자동 점검 — 진짜 DungeonEnemy 를 세워 종·저항·몸·이름을 본다.
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_roster.gd
## ① 표 개수 = 웹 data-enemy.js ENEMIES(웹 파일이 있으면 세서 비교) · 단계 넷 풀이 비지 않음 · 1층 풀은 tier1 만·30층은 tier4 만
## ② 같은 층·순번이면 같은 종(결정적) · 잡몹은 종이 있고 보스·그림자 분신은 없음 ③ 종 저항이 resist_pct 에 반영(정예 아니면 그대로)
## ④ 몸 모양이 form 표대로 · 이름 = 종 이름(정예면 "꾸밈말 종") ⑤ 전역 난수 순서 불변 — 같은 seed 면 정예 결과가 옛 규칙(randf→randi)과 같음.
## 끝에 "PROBE dungeon_roster OK" 또는 "PROBE dungeon_roster FAIL n".

const DE := preload("res://games/saga_dungeon/data/dungeon_enemies.gd")

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var Enemy: GDScript = load("res://games/saga_dungeon/world/dungeon_enemy.gd")
	var stage := Node3D.new()
	root.add_child(stage)
	current_scene = stage

	# ①
	var web_n := -1
	var web_path := ProjectSettings.globalize_path("res://").path_join("../saga-web/saga-dungeon/js/data-enemy.js")
	if FileAccess.file_exists(web_path):
		var src := FileAccess.get_file_as_string(web_path)
		var block := src.substr(src.find("var ENEMIES = ["), src.find("var ERA_ENEMIES") - src.find("var ENEMIES = ["))
		web_n = RegEx.create_from_string("\\{ name: '").search_all(block).size()
	var tiers_ok := true
	for t in [1, 6, 13, 26]:
		tiers_ok = tiers_ok and not DE.pool_for(t).is_empty()
	check((web_n < 0 or web_n == DE.ENEMIES.size()) and DE.ENEMIES.size() == 134 and tiers_ok
		and DE.pool_for(1).all(func(e): return int(e.tier) == 1) and DE.pool_for(30).all(func(e): return int(e.tier) == 4),
		"① 표 %d종(웹 %d) · 단계 넷 풀 · 1층 tier1 만 · 30층 tier4 만" % [DE.ENEMIES.size(), web_n])

	# ②
	Enemy.set("_species_seq", 0)
	var a: Node = Enemy.new(3)
	Enemy.set("_species_seq", 0)
	var b: Node = Enemy.new(3)
	var boss: Node = Enemy.new(3, true)
	var shade: Node = Enemy.new(3, false, true)
	check(not a.species.is_empty() and a.species.name == b.species.name and boss.species.is_empty() and shade.species.is_empty() and int(a.species.tier) == 1,
		"② 같은 층·순번 = 같은 종(%s) · 보스·그림자 분신은 종 없음" % String(a.species.get("name", "")))
	for n in [a, b, boss, shade]:
		n.free()

	# ③·④ 종 저항·몸·이름 — 여러 층에서 세워 본다
	var res_ok := true
	var body_ok := true
	var name_ok := true
	var kinds := {}
	for fl in [1, 3, 8, 15, 30]:
		for i in 12:
			var e: Node = Enemy.new(fl)
			stage.add_child(e)
			var sp: Dictionary = e.species
			var form := String(sp.get("form", ""))
			var want_kind := String(Enemy.FORM_KIND.get(form, "goblin"))
			if form == "quad" and String(sp.name).contains("룡"):
				want_kind = "beast"
			body_ok = body_ok and e.body_kind == want_kind
			kinds[e.body_kind] = true
			if e.elite_key == "":
				for k in (sp.get("resist", {}) as Dictionary):
					res_ok = res_ok and is_equal_approx(float(e.resist_pct(k)), minf(float(sp.resist[k]), 75.0))
				name_ok = name_ok and e.who_label() == String(sp.name)
			else:
				name_ok = name_ok and e.who_label().ends_with(" " + String(sp.name))
			e.free()
	check(res_ok, "③ 종 저항이 resist_pct 에 반영")
	check(body_ok and kinds.size() >= 4, "④ 몸 모양이 form 표대로 — 나온 몸 %s" % str(kinds.keys()))
	check(name_ok, "④ 이름 = 종 이름(정예면 \"꾸밈말 종\")")

	# ⑤ 전역 난수 순서
	var chance: float = Enemy._elite_chance(10)
	seed(777)
	var old_keys: Array = []
	for i in 300:
		if randf() < chance:
			old_keys.append(String(Enemy.ELITES[randi() % Enemy.ELITES.size()].key))
		else:
			old_keys.append("")
	seed(777)
	var new_keys: Array = []
	for i in 300:
		var e: Node = Enemy.new(10)
		new_keys.append(e.elite_key)
		e.free()
	check(old_keys == new_keys, "⑤ 같은 seed 면 정예 결과가 옛 규칙과 같음(정예 %d/300)" % old_keys.filter(func(k): return k != "").size())

	print("PROBE dungeon_roster OK" if fails == 0 else "PROBE dungeon_roster FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
