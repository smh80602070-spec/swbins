extends SceneTree

## G-0374 4종횡 괴물 카드 도감(data/story_monster_book.gd) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_story_monster_book.gd   → "PROBE story_monster_book OK" / "FAIL n"
## ① 종 = 잡몹 명단 + 세 시대(겹침 없음) ② 굴림: 씨앗 rng 로 보통 5% 근처 · 희귀 100% · 미니 50% 근처 · 명단 밖·다 모은 종은 안 나옴
## ③ 다섯 장 = 다 모음(set_done 한 번) · 공격 곱 1 + 0.2% × 다 모은 종 ④ 세이브 왕복(cards)·옛 세이브 빈 칸 ⑤ 손잡이 SAGA_MONSTER_BOOK=0 → 곱 1·안 셈
## ⑥ 배선(적 쓰러짐·공격 곱·「내 정보」 줄). 진짜 세이브는 안 건드린다(cards 되돌림).

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var MB: GDScript = load("res://games/saga_story/data/story_monster_book.gd")
	var EN: GDScript = load("res://games/saga_story/data/story_enemies.gd")
	var S: Node = root.get_node("StorySaveState")
	var saved: Dictionary = (S.get("cards") as Dictionary).duplicate()
	S.set("cards", {})

	# ① 종
	var sp: Array = MB.species()
	check(sp.size() == (EN.ENEMIES as Array).size() + (EN.ERA_ENEMIES as Array).size() and sp.size() >= 30, "① 종 %d" % sp.size())

	# ② 굴림
	var rng := RandomNumberGenerator.new()
	rng.seed = 20260824
	var got := 0
	for i in 2000:
		S.set("cards", {})
		got += 0 if MB.on_kill(S, sp[0], false, false, rng).is_empty() else 1
	var mini := 0
	for i in 400:
		S.set("cards", {})
		mini += 0 if MB.on_kill(S, sp[0], false, true, rng).is_empty() else 1
	S.set("cards", {})
	var rare: Dictionary = MB.on_kill(S, sp[1], true, false, rng)
	var outside: Dictionary = MB.on_kill(S, "없는 종", true, false, rng)
	check(got > 60 and got < 150 and mini > 150 and mini < 250 and not rare.is_empty() and outside.is_empty(),
		"② 보통 %d/2000 · 미니 %d/400 · 희귀 확정 · 명단 밖 없음" % [got, mini])

	# ③ 다 모음
	S.set("cards", {})
	var done_flags: Array = []
	for i in MB.SET:
		done_flags.append(bool(MB.on_kill(S, sp[2], true, false, rng).set_done))
	var after: Dictionary = MB.on_kill(S, sp[2], true, false, rng)
	var mul1: float = MB.atk_mul(S)
	for i in MB.SET:
		MB.on_kill(S, sp[3], true, false, rng)
	var mul2: float = MB.atk_mul(S)
	check(done_flags == [false, false, false, false, true] and after.is_empty() and is_equal_approx(mul1, 1.0 + MB.ATK_PER) and is_equal_approx(mul2, 1.0 + MB.ATK_PER * 2)
		and MB.complete_count(S) == 2 and MB.found_count(S) == 2, "③ 다섯째 장 다 모음 · 그 뒤 없음 · 공격 ×%.3f → ×%.3f" % [mul1, mul2])

	# ④ 세이브
	var d: Dictionary = S.call("to_dict") if S.has_method("to_dict") else {}
	var has_field := d.is_empty() or d.has("cards")
	var src := FileAccess.get_file_as_string("res://games/saga_story/data/story_save_state.gd")
	check(has_field and src.contains("\"cards\": cards") and src.contains("data.get(\"cards\", {})") and int(S.get("SAVE_VERSION")) >= 28, "④ 세이브 칸 cards · 옛 세이브 빈 칸 · 판 %d" % int(S.get("SAVE_VERSION")))

	# ⑤ 손잡이
	OS.set_environment("SAGA_MONSTER_BOOK", "0")
	var off_mul: float = MB.atk_mul(S)
	var off_roll: Dictionary = MB.on_kill(S, sp[5], true, false, rng)
	OS.set_environment("SAGA_MONSTER_BOOK", "")
	check(is_equal_approx(off_mul, 1.0) and off_roll.is_empty(), "⑤ 끄면 곱 1·안 셈")

	# ⑥ 배선
	var en_src := FileAccess.get_file_as_string("res://games/saga_story/world/story_enemy.gd")
	var pb_src := FileAccess.get_file_as_string("res://games/saga_story/player/story_player_base.gd")
	var me: Dictionary = (load("res://games/saga_story/ui/me_adapter.gd") as GDScript).call("model", null)
	var me_row := false
	for st in me.get("stats", []):
		me_row = me_row or String((st as Dictionary).get("label", "")).contains("카드 도감")
	check(en_src.contains("story_monster_book.gd") and pb_src.contains("story_monster_book.gd\").atk_mul(StorySaveState)") and me_row, "⑥ 배선 셋(쓰러짐·공격·내 정보)")

	S.set("cards", saved)
	print("PROBE story_monster_book ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
