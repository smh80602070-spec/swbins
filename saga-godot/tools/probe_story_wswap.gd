extends SceneTree

## G-0331 4종횡 무기 두 벌·바꿔치기 콤보 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_story_wswap.gd   → "PROBE story_wswap OK" / "FAIL n"
## ① 두 벌: 새 무기 끼우면 들던 무기(주문서 값·업횟과 함께)가 버금 · 같은 무기는 그대로 ② 바꾸기: 들던 것·버금 맞바꿈(주문서 따라감) · 쿨 1초 · 한 벌이면 거절
## ③ 콤보: 연속 2 이상·2.5초 안이면 다음 한 타 ×1.3 한 번 · 아니면 1 ④ G 액션 실행 때 등록 ⑤ SAGA_WSWAP=0 → 두 벌·바꾸기 없음
## ⑥ 세이브 왕복·옛 25 → 한 벌·판 26 ⑦ 배선(G 입력·근접 배율·장착).

const SAVED_VARS := ["equipped", "scroll_bonus", "scroll_left", "weapon2", "level", "run_combo", "_run_last_hit_ms", "path_override"]

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var S: Node = root.get_node("StorySaveState")
	var W: GDScript = load("res://games/saga_story/data/story_wswap.gd")
	var saved := {}
	for v in SAVED_VARS:
		saved[v] = S.get(v)
		if saved[v] is Dictionary:
			saved[v] = (saved[v] as Dictionary).duplicate(true)
	var ws := ["sword1", "sword2"]   # 목검·환도(story_combat_base GEAR_ITEMS)
	var a := String(ws[0])
	var b := String(ws[1])

	# ①
	S.level = 200
	S.equipped = {}
	S.weapon2 = {}
	S.scroll_bonus = {}
	S.scroll_left = {}
	S.equip_gear(a)
	S.scroll_bonus["weapon"] = {"atk": 7}
	S.scroll_left["weapon"] = 2
	S.equip_gear(b)
	var w2a: bool = String(S.weapon2.get("key", "")) == a and int(S.weapon2.sb.atk) == 7 and int(S.weapon2.sl) == 2
	S.equip_gear(b)
	check(w2a and String(S.weapon2.key) == a and String(S.equipped.weapon) == b, "① 새 무기 → 들던 %s(주문서 +7·업횟 2)가 버금 · 같은 무기는 그대로" % a)

	# ②
	W.reset_runtime()
	var r1: Dictionary = W.swap(S, 100000)
	var after_a: bool = String(S.equipped.weapon) == a and int(S.scroll_bonus.weapon.atk) == 7 and String(S.weapon2.key) == b
	var r2: Dictionary = W.swap(S, 100500)
	S.weapon2 = {}
	var r3: Dictionary = W.swap(S, 200000)
	check(bool(r1.ok) and after_a and not bool(r2.ok) and String(r2.why) == "cd" and String(r3.why) == "single", "② 맞바꿈(주문서 따라감) · 쿨 1초 · 한 벌 거절")

	# ③
	W.reset_runtime()
	S.weapon2 = {"key": b, "sb": {}, "sl": 0}
	S.run_combo = 3
	S._run_last_hit_ms = 300000
	var c1: Dictionary = W.swap(S, 301000)
	var m1: float = W.take_mul(301200)
	var m2: float = W.take_mul(301300)
	S.run_combo = 1
	var c2: Dictionary = W.swap(S, 400000)
	var m3: float = W.take_mul(400100)
	check(bool(c1.combo) and is_equal_approx(m1, 1.3) and is_equal_approx(m2, 1.0) and not bool(c2.combo) and is_equal_approx(m3, 1.0), "③ 연속 중 바꾸면 다음 한 타 ×1.3 한 번 · 연속 아니면 1")

	# ④
	W.ensure_action()
	var evs: Array = InputMap.action_get_events(W.ACTION)
	check(evs.size() == 1 and (evs[0] as InputEventKey).physical_keycode == KEY_G, "④ G 액션 실행 때 등록")

	# ⑤
	OS.set_environment("SAGA_WSWAP", "0")
	S.weapon2 = {}
	S.equip_gear(a)
	S.equip_gear(b)
	check((S.weapon2 as Dictionary).is_empty() and String(W.swap(S, 900000).why) == "off", "⑤ SAGA_WSWAP=0 → 버금 안 생김·바꾸기 없음")
	OS.set_environment("SAGA_WSWAP", "")

	# ⑥
	var dummy := Node3D.new()
	dummy.add_to_group("player")
	root.add_child(dummy)
	S.path_override = "user://probe_story_wswap_rt.json"
	S.weapon2 = {"key": a, "sb": {"atk": 3}, "sl": 1}
	var sv: bool = S.save()
	S.weapon2 = {}
	var ld: bool = S.try_load()
	check(sv and ld and String(S.weapon2.key) == a and typeof(S.weapon2.sl) == TYPE_INT, "⑥ 저장 왕복 %s" % str(S.weapon2))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(S.path_override))
	S.path_override = "user://probe_story_wswap_old.json"
	var f := FileAccess.open(S.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify({"version": 25, "level": 5, "exp": 0, "gold": 10, "player_pos": [0.0, 0.1, 0.0]}))
	f.close()
	S.weapon2 = {"key": "x"}
	var ld_old: bool = S.try_load()
	check(ld_old and (S.weapon2 as Dictionary).is_empty() and S.save_version() >= 26, "⑥ 옛 25 → 한 벌 · 판 %d" % S.save_version())
	DirAccess.remove_absolute(ProjectSettings.globalize_path(S.path_override))
	dummy.queue_free()

	# ⑦
	var sp := FileAccess.get_file_as_string("res://games/saga_story/player/story_player.gd")
	var pb := FileAccess.get_file_as_string("res://games/saga_story/player/story_player_base.gd")
	var ss := FileAccess.get_file_as_string("res://games/saga_story/data/story_save_state.gd")
	check(sp.contains("story_wswap.gd\").pressed()") and pb.contains("story_wswap.gd\").take_mul(") and ss.contains("story_wswap.gd\").stash(self, key)"), "⑦ 배선 셋")

	W.reset_runtime()
	for v in SAVED_VARS:
		S.set(v, saved[v])
	await process_frame
	print("PROBE story_wswap ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
