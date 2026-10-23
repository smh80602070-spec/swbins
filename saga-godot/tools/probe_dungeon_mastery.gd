extends SceneTree

## G-0317 2나락 장비 숙련(써서 오르는 장비) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_mastery.gd   → "PROBE dungeon_mastery OK" / "FAIL n"
## ① 단계 문턱 10·30·60·100·150 · 최고 5 · 빈 칸은 안 쌓임 ② 무기 숙련 → atk_pct_bonus +3/단 · 「내 정보」 ★
## ③ 갑주 숙련 → 받는 피해 −2%/단 ④ 교체: 무기 말고 부위는 옛 숙련 절반 물려받기 · 무기는 을로 내려가 그대로
## ⑤ SAGA_MASTERY=0 → 쌓기·효과 없음 ⑥ 저장 왕복(물건 칸 mxp) ⑦ 배선(처치·피격·장착).

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var M: GDScript = load("res://games/saga_dungeon/data/dungeon_mastery.gd")
	var EQ: Node = root.get_node("DungeonEquipmentState")
	var saved := {}
	for s: String in EQ.SLOT_NAMES:
		saved[s] = EQ.item_for(s)
	var saved_w2: Dictionary = EQ.weapon2

	# ①
	var lv_ok: bool = M.level_of(9) == 0 and M.level_of(10) == 1 and M.level_of(59) == 2 and M.level_of(150) == 5 and M.level_of(999) == 5
	var w := {"base": "probe", "main": 0}
	var ups: Array = []
	for i in 200:
		var u: int = M.gain(w)
		if u > 0:
			ups.append(u)
	var empty := {}
	M.gain(empty)
	check(lv_ok and ups == [1, 2, 3, 4, 5] and int(w.mxp) == 150 and empty.is_empty(), "① 문턱 · 단계 오름 %s · 상한 150 · 빈 칸 안 쌓임" % str(ups))

	# ②
	EQ.restore({})
	var base: float = EQ.atk_pct_bonus()
	EQ.equip("weapon", {"base": "probe", "main": 0, "mxp": 60})
	var with3: float = EQ.atk_pct_bonus()
	var MA: GDScript = load("res://games/saga_dungeon/ui/me_adapter.gd")
	var star := false
	for sl: Dictionary in (MA.model(null).slots as Array):
		if String(sl.item).ends_with("★3"):
			star = true
	check(is_equal_approx(with3 - base, 9.0) and star, "② 무기 3단 → 공격 +%.0f%% · 「내 정보」 ★3" % (with3 - base))

	# ③
	check(is_equal_approx(M.guard_mul({"mxp": 100}), 0.92) and is_equal_approx(M.guard_mul({}), 1.0), "③ 갑주 4단 → 받는 피해 ×0.92")

	# ④
	EQ.equip("armor", {"base": "a1", "mxp": 100})
	var neu := {"base": "a2", "mxp": 0}
	EQ.equip("armor", neu)
	var w_old: Dictionary = EQ.weapon
	var w_new := {"base": "w2", "main": 0}
	EQ.pick_weapon(w_new)
	check(int(EQ.armor.mxp) == 50 and M.xp(w_new) == 0 and EQ.weapon2 == w_old and M.xp(EQ.weapon2) == 60, "④ 갑주 교체 → 50 물려받음 · 무기는 을로 그대로(60)")

	# ⑤
	OS.set_environment("SAGA_MASTERY", "0")
	var off := {"mxp": 60}
	check(M.gain(off) == 0 and int(off.mxp) == 60 and is_equal_approx(M.atk_pct(off), 0.0) and is_equal_approx(M.guard_mul(off), 1.0), "⑤ SAGA_MASTERY=0 → 쌓기·효과 없음")
	OS.set_environment("SAGA_MASTERY", "")

	# ⑥
	var j: Variant = JSON.parse_string(JSON.stringify({"armor": EQ.armor}))
	EQ.restore({"armor": (j as Dictionary).armor})
	check(M.level(EQ.armor) == 2, "⑥ 저장 왕복(JSON) → 숙련 2단 그대로")

	# ⑦
	var en := FileAccess.get_file_as_string("res://games/saga_dungeon/world/dungeon_enemy.gd")
	var ph := FileAccess.get_file_as_string("res://games/saga_dungeon/player/player_health.gd")
	var eq := FileAccess.get_file_as_string("res://games/saga_dungeon/data/dungeon_equipment_state.gd")
	check(en.contains("dungeon_mastery.gd\").gain(DungeonEquipmentState.weapon)") and ph.contains("dungeon_mastery.gd\").guard_mul(DungeonEquipmentState.armor)") and eq.contains("dungeon_mastery.gd\").inherit(slot_name"), "⑦ 배선 셋")

	EQ.restore(saved)
	EQ.weapon2 = saved_w2
	print("PROBE dungeon_mastery ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
