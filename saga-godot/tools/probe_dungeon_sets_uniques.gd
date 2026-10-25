extends SceneTree

## G-0398 2나락 세트 무예 + 고유(웹 W-0435 하위 짝) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_sets_uniques.gd   → "PROBE dungeon_sets_uniques OK" / "FAIL n"
## ① 세트 무예 표 10(세트마다 하나)·반경 환산(nova 160px → 4.71m)·key set_<세트> ② 세 점 다 걸침 → full_set_key · 한 점 빼면 ""
## ③ 시전: 철옹 세 점 → T 무예 철옹성(buff guardPct +45) · 쿨다운 20 · 쿨다운 중 다시 안 됨 · 세트 없으면 무예 없음
## ④ 고유 30(웹 표 그대로) · 전설(4)만 · 고유면 접사 안 굴림·이름 ★ · 수준 40 이면 flat ×1.7 · % 그대로 ⑤ 걸치면 효과(원소 피해 불 14)
## ⑥ SAGA_UNIQUES=0 → 고유 없음 ⑦ 배선: HUD T 단추(slot 4)·입력 dungeon_set_skill(T). 장비 칸은 끝에 되돌린다.

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _item(base: String, set_key: String, uniq := "") -> Dictionary:
	var it := {"base": base, "tier": 3, "ilvl": 20, "main": 10.0, "aff": [], "sock": [], "set": set_key, "unid": false}
	if uniq != "":
		it["uniq"] = uniq
	it["dur"] = 999
	return it


func _initialize() -> void:
	await process_frame
	var DI: GDScript = load("res://games/saga_dungeon/data/dungeon_items.gd")
	var ES: Node = root.get_node("DungeonEquipmentState")
	var RS: Node = root.get_node("DungeonRunState")
	var slots := ["weapon", "armor", "helm", "glove", "boot", "ring", "neck", "charm"]
	var saved := {}
	for s: String in slots:
		saved[s] = (ES.get(s) as Dictionary).duplicate(true)
		ES.set(s, {})

	# ①
	var sets_ok := true
	for s: Dictionary in DI.SETS:
		sets_ok = sets_ok and DI.SET_SKILLS.has(s.key)
	var cm: Dictionary = DI.set_skill("chungmu")
	check(DI.SET_SKILLS.size() == 10 and sets_ok and String(cm.key) == "set_chungmu" and absf(float(cm.r) - 4.705) < 0.01 and float(cm.grow) == 0.0 and DI.set_skill("nope").is_empty(),
		"① 세트 무예 10 · 귀선포 반경 %.2fm · key %s" % [float(cm.r), String(cm.key)])

	# ②
	ES.set("weapon", _item("w_hwando", "chungmu"))
	ES.set("armor", _item("a_dujeong", "chungmu"))
	ES.set("charm", _item("c_hopae", "chungmu"))
	var full: String = ES.full_set_key()
	ES.set("charm", {})
	var part: String = ES.full_set_key()
	check(full == "chungmu" and part == "", "② 세 점 → %s · 두 점 → \"%s\"" % [full, part])

	# ③
	var pl := Node3D.new()
	root.add_child(pl)
	current_scene = pl   # 시전 그림(_burst)이 현재 씬에 붙는다
	var caster: Node = (load("res://games/saga_dungeon/player/skill_caster.gd") as GDScript).new()
	pl.add_child(caster)
	await process_frame
	var none: Dictionary = caster.set_skill()
	ES.set("armor", _item("a_jichap", "cheolong"))
	ES.set("helm", _item("h_tumo", "cheolong"))
	ES.set("neck", _item("n_geumpae", "cheolong"))
	ES.set("weapon", {})
	var g0: float = RS._sum_eff("guardPct")
	var sk: Dictionary = caster.set_skill()
	var ok1: bool = caster.try_set_skill()
	var g1: float = RS._sum_eff("guardPct")
	var cd: float = caster.cooldown_left("set_cheolong")
	var ok2: bool = caster.try_set_skill()
	check(none.is_empty() and String(sk.get("name", "")) == "철옹성(鐵甕城)" and ok1 and is_equal_approx(g1 - g0, 45.0) and absf(cd - 20.0) < 0.1 and not ok2,
		"③ 철옹 세 점 → T 무예 %s · 막기 +%.0f · 쿨다운 %.1f · 다시 안 됨" % [String(sk.get("name", "")), g1 - g0, cd])

	# ④
	var rolled := {}
	var low_uniq := 0
	for i in 300:
		var it4: Dictionary = DI.roll(20, "", 4)
		if str(it4.get("uniq", "")) != "":
			rolled = it4
		if str(DI.roll(20, "", 3).get("uniq", "")) != "":
			low_uniq += 1
	var u: Dictionary = DI.unique_by_key("u_ssanggeom")
	var e20: Array = DI.unique_effects({"uniq": "u_ssanggeom", "ilvl": 20})
	var e40: Array = DI.unique_effects({"uniq": "u_ssanggeom", "ilvl": 40})
	var unid_nm: String = DI.item_name(rolled) if not rolled.is_empty() else ""
	if not rolled.is_empty():
		rolled["unid"] = false   # 확인하면 고유 이름(미확인이면 밑감 이름만 — 원작대로)
	var nm: String = DI.item_name(rolled) if not rolled.is_empty() else ""
	check(DI.UNIQUES.size() == 30 and not rolled.is_empty() and (rolled.aff as Array).is_empty() and nm.begins_with("★") and not unid_nm.begins_with("★") and low_uniq == 0
		and is_equal_approx(float(e20[0].v), 22.0) and is_equal_approx(float(e40[0].v), roundf(22.0 * 1.7)) and is_equal_approx(float(e40[2].v), 9.0),
		"④ 고유 %d · 전설에서 「%s」 · 접사 없음 · 보물 등급 고유 %d · 수준 40 flat %.0f · %% 그대로" % [DI.UNIQUES.size(), nm, low_uniq, float(e40[0].v)])

	# ⑤
	for s: String in slots:
		ES.set(s, {})
	ES.set("weapon", _item("w_hwando", "", "u_ssanggeom"))
	var fire := 0.0
	for e: Dictionary in ES._affix_and_socket_effects():
		if String(e.kind) == "eldmg" and String(e.get("el", "")) == "fire":
			fire += float(e.v)
	check(is_equal_approx(fire, 14.0) and String(u.base) == "w_hwando", "⑤ 쌍룡도 걸침 → 불 피해 +%.0f" % fire)

	# ⑥
	OS.set_environment("SAGA_UNIQUES", "0")
	var off := 0
	for i in 100:
		off += 1 if str(DI.roll(20, "", 4).get("uniq", "")) != "" else 0
	OS.set_environment("SAGA_UNIQUES", "")
	check(off == 0, "⑥ SAGA_UNIQUES=0 → 고유 0")

	# ⑦
	var hud := FileAccess.get_file_as_string("res://games/saga_dungeon/ui/DungeonHUD.tscn")
	var proj := FileAccess.get_file_as_string("res://project.godot")
	check(hud.contains("name=\"SetSkillButton\"") and hud.contains("slot = 4") and proj.contains("dungeon_set_skill=") and InputMap.has_action("dungeon_set_skill"), "⑦ HUD T 단추 · 입력 dungeon_set_skill")

	for s: String in slots:
		ES.set(s, saved[s])
	pl.queue_free()
	await process_frame
	print("PROBE dungeon_sets_uniques ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
