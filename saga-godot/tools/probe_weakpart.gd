extends SceneTree

## G-0342 1만리 보스 약점 부수기(combat/field_boss.gd part_hit·ensure_part_mark) 점검.
##   godot --headless --path saga-godot --script res://tools/probe_weakpart.gd   → "PROBE weakpart OK" / "FAIL n"
## ① 들판 보스마다 빛나는 약점 표식(몸 높이 0.85) ② 급소 피해가 약점 체력(max_hp × 0.12)에 못 미치면 그대로 ③ 넘으면 부서짐 —
## 예고 끊김·비틀(RECOVER)·공격 ×0.85·표식 꺼짐·"약점 파괴!" · 두 번은 없음 ④ 되돌아가면(_on_reset) 다시 섬 ⑤ 공격 배율이 실제 피해에
## ⑥ SAGA_WEAKPART=0 → 안 부서짐 ⑦ 배선(조준 급소 화살 → part_hit)

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _frames(n: int) -> void:
	for _i in n:
		await process_frame


func _initialize() -> void:
	await process_frame
	var sc := (load("res://games/saga_go/world/TestVillage.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	await _frames(40)
	var bosses: Array = []
	for b in get_nodes_in_group("go_boss"):
		if not b.call("is_dead") and b.has_method("part_hit"):
			bosses.append(b)
	if bosses.is_empty():
		check(false, "준비 — 보스 없음")
		_end()
		return
	var b: Node3D = bosses[0]

	# ①
	var marks := 0
	for x in bosses:
		var mk := (x as Node).get_node_or_null("WeakPart") as MeshInstance3D
		if mk != null and mk.visible:
			marks += 1
	var mk0 := b.get_node_or_null("WeakPart") as MeshInstance3D
	var h := float((b.get("def") as Dictionary).get("height", 2.0))
	check(marks == bosses.size() and mk0 != null and is_equal_approx(mk0.position.y, h * 0.85), "① 보스 %d 모두 약점 표식 · 높이 %.2f" % [bosses.size(), mk0.position.y if mk0 else -1.0])

	# ②
	var need: float = float(b.get("max_hp")) * float(b.get("PART_FRAC"))
	b.set("skill", "slam")
	check(not bool(b.call("part_hit", need * 0.5)) and not bool(b.get("part_broken")) and float(b.get("part_hp")) > 0.0, "② 급소 %.0f(약점 %.0f 의 절반) → 그대로" % [need * 0.5, need])

	# ③
	var broke: bool = b.call("part_hit", need)
	check(broke and bool(b.get("part_broken")) and String(b.get("skill")) == "" and int(b.get("ai")) == 4 and is_equal_approx(float(b.get("part_dmg_mul")), 0.85)
		and not mk0.visible, "③ 부서짐 — 예고 끊김·비틀·공격 ×0.85·표식 꺼짐")
	check(not bool(b.call("part_hit", need * 5.0)), "③ 두 번은 없음")
	b.call("_on_reset")
	b.set("skill_cd", 0.0)
	b.call("part_hit", need)
	check(float(b.get("skill_cd")) >= float(b.get("PART_STAGGER")), "③ 패턴 사이에 부서져도 비틀 동안 새 패턴 없음(쿨 %.1f)" % float(b.get("skill_cd")))

	# ⑤ 공격 배율이 실제 피해에
	var fc := get_first_node_in_group("go_field_combat")
	var src_fb := FileAccess.get_file_as_string("res://games/saga_go/combat/field_boss.gd")
	var src_fe := FileAccess.get_file_as_string("res://games/saga_go/combat/field_enemy.gd")
	check(src_fb.contains("def.atk * mul * dmg_mul * part_dmg_mul") and src_fe.contains("def.atk * dmg_mul * part_dmg_mul, self)") and fc != null, "⑤ 패턴·물기·공성 피해에 약점 배율")

	# ④
	b.call("_on_reset")
	check(not bool(b.get("part_broken")) and float(b.get("part_hp")) < 0.0 and is_equal_approx(float(b.get("part_dmg_mul")), 1.0) and mk0.visible, "④ 되돌아가면 약점 다시 섬")

	# ⑥
	OS.set_environment("SAGA_WEAKPART", "0")
	check(not bool(b.call("part_hit", need * 5.0)) and not bool(b.get("part_broken")), "⑥ SAGA_WEAKPART=0 → 안 부서짐")
	OS.set_environment("SAGA_WEAKPART", "")

	# ⑦
	var src_as := FileAccess.get_file_as_string("res://games/saga_go/combat/aimed_shot.gd")
	check(src_as.contains("e.call(\"part_hit\", dealt)"), "⑦ 조준 급소 화살 → part_hit")
	_end()


func _end() -> void:
	print("PROBE weakpart ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
