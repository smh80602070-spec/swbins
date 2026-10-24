extends SceneTree
## G-0345 4종횡 콤보 킬 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_combo_kill.gd   → "PROBE combo_kill OK" / "FAIL n"
## ① 5초 안 처치는 이어지고 넘으면 1부터 · 최고 기록 ② 10마다 구슬 하나(배율 3 + 콤보/10, 최대 8)
## ③ 구슬이 끌려와 먹음 → 경험치 = 적 경험치 × 배율 ④ 멀리 있으면 안 끌림 · 수명 끝 사라짐 ⑤ SAGA_COMBO_KILL=0 → 셈 없음 ⑥ 적 쓰러짐 고리

var Combo: GDScript = null   # autoload(StorySaveState)을 쓰는 스크립트라 const preload 말고 실행 뒤 load
const StoryCombat := preload("res://games/saga_story/data/story_combat.gd")

var fails := 0


func check(ok: bool, msg: String) -> void:
	print("  %s %s" % ["OK  " if ok else "FAIL", msg])
	if not ok:
		fails += 1


func _initialize() -> void:
	_run.call_deferred()


func _orbs() -> Array:
	return get_nodes_in_group("story_combo_orb")


func _clear() -> void:
	for o in _orbs():
		o.remove_from_group("story_combo_orb")
		o.queue_free()


func _run() -> void:
	var sc := (load("res://games/saga_story/world/TestField.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 30:
		await process_frame
	Combo = load("res://games/saga_story/world/story_combo_kill.gd")
	var S: Node = root.get_node("StorySaveState")
	var pl := get_first_node_in_group("player") as Node3D
	if pl == null:
		check(false, "준비 player 없음")
		_finish()
		return
	pl.set_physics_process(false)
	var far := pl.global_position + Vector3(30, 0, 0)

	# ①
	var t := 1000000
	var a: int = int(Combo.call("on_kill", sc, far, 5.0, false, t))
	var b: int = int(Combo.call("on_kill", sc, far, 5.0, false, t + 4000))
	var c: int = int(Combo.call("on_kill", sc, far, 5.0, false, t + 9500))
	check(a == 1 and b == 2 and c == 1 and int(Combo.get("best")) == 2, "① 이어짐 %d→%d · 5.5초 끊김 → %d · 최고 %d" % [a, b, c, int(Combo.get("best"))])

	# ②
	_clear()
	var o0 := int(Combo.get("orbs"))
	for i in 29:
		Combo.call("on_kill", sc, far, 5.0, false, t + 10000 + i * 1000)
	var n := int(Combo.get("count"))
	var made := int(Combo.get("orbs")) - o0
	var ex: int = int(_orbs()[0].get("exp_amount")) if not _orbs().is_empty() else -1
	check(n == 30 and made == 3 and ex == StoryCombat.enemy_exp(false, 5.0) * 4 and int(Combo.call("orb_mul", 80)) == 8, "② 콤보 %d · 구슬 %d · 첫 구슬 EXP %d(×4) · 최대 ×%d" % [n, made, ex, int(Combo.call("orb_mul", 80))])

	# ④ 멀리
	for _i in 10:
		await physics_frame
	check(_orbs().size() == 3, "④ 멀리 있으면 그대로 %d" % _orbs().size())

	# ③
	var o1: Node3D = _orbs()[0]
	var want := int(o1.get("exp_amount"))
	for o in _orbs().slice(1):
		o.remove_from_group("story_combo_orb")
		o.queue_free()
	o1.global_position = pl.global_position + Vector3(2.0, 0, 0)
	var lv0 := int(S.level)
	var e0 := int(S.exp)
	var eat0 := int(Combo.get("eaten"))
	for _i in 30:
		await physics_frame
	var gained := int(S.exp) - e0
	check(int(Combo.get("eaten")) == eat0 + 1 and _orbs().is_empty() and (gained > 0 or int(S.level) > lv0), "③ 끌려와 먹음 EXP +%d(구슬 %d, 성좌·문파 배율 뒤)" % [gained, want])

	# ④ 수명
	for i in 10:
		Combo.call("on_kill", sc, far, 5.0, false, t + 100000 + i * 500)
	var o4: Node = _orbs()[0] if not _orbs().is_empty() else null
	if o4 != null:
		o4.set("_age", float(Combo.get("LIFE_SEC")) + 0.1)
	var had := o4 != null
	for _i in 3:
		await physics_frame
	check(had and _orbs().is_empty(), "④ 수명 끝 → 사라짐")

	# ⑤
	OS.set_environment("SAGA_COMBO_KILL", "0")
	check(Combo.call("on_kill", sc, far, 5.0, false, t + 101000) == 0, "⑤ SAGA_COMBO_KILL=0 → 셈 없음")
	OS.set_environment("SAGA_COMBO_KILL", "")

	# ⑥
	var src := FileAccess.get_file_as_string("res://games/saga_story/world/story_enemy.gd")
	check(src.contains("story_combo_kill.gd\").on_kill(get_parent(), global_position, enemy_lv, is_boss)"), "⑥ 적 쓰러짐 → 콤보 킬")
	_finish()


func _finish() -> void:
	print("PROBE combo_kill %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
