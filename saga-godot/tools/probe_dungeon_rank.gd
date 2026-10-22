extends SceneTree

## G-0312 한 판 결과 등급 공용(saga_core/data/runrank.gd) + 2나락 어댑터(data/dungeon_rank.gd) 점검 — 웹 W-0378 짝.
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_rank.gd   → "PROBE dungeon_rank OK" / "FAIL n"
## ① 공용 rank_of = 4종횡 StorySaveState.rank_of(같은 값 표) ② Counter: 처치 3 미만 등급 없음 · 연속(2.5초 안)·피격 끊김 · 덤 S/A/B ·
##   쓰러지면 덤 0 ③ 2나락: 급(난도·부적) · 판 끝 덤 금이 지갑에 · 난도별 최고 기록 · 글 ④ SAGA_RUNRANK=0 → 셈 안 함
## ⑤ 저장 왕복·옛 세이브 빈 것 ⑥ 배선(평타·무예 hit·피격 hurt·처치 kill·입장 begin·마지막 방 finish·쓰러짐 finish(true)). 진짜 세이브는 안 건드린다.

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var RR: GDScript = load("res://saga_core/data/runrank.gd")
	var DR: GDScript = load("res://games/saga_dungeon/data/dungeon_rank.gd")
	var SS: Node = root.get_node("StorySaveState")
	var G: Node = root.get_node("DungeonGoldState")
	var Save: Node = root.get_node("DungeonSaveState")
	var Mode: GDScript = load("res://games/saga_dungeon/data/dungeon_mode.gd")
	var saved := {"gold": G.gold, "best": (DR.get("best") as Dictionary).duplicate(), "chosen": Mode.get("chosen"), "run": Mode.get("run_mode")}

	# ① 공용 = 4종횡
	var same := true
	for c in [[100.0, 0, 25, 20, 1], [400.0, 5, 6, 3, 2], [200.0, 2, 12, 15, 3], [900.0, 20, 0, 3, 5], [170.0, 4, 9, 4, 1]]:
		same = same and RR.rank_of(c[0], c[1], c[2], c[3], c[4]) == SS.rank_of(c[0], c[1], c[2], c[3], c[4])
	check(same and RR.rank_of(100.0, 0, 25, 20, 1) == "S" and RR.rank_of(900.0, 20, 0, 3, 5) == "D", "① 공용 rank_of = 4종횡 식(다섯 경우)")

	# ② Counter
	var c: RefCounted = RR.Counter.new()
	c.call("begin", 0, 1)
	c.call("kill")
	c.call("kill")
	check((c.call("finish", 100, false) as Dictionary).is_empty(), "② 처치 둘 → 등급 없음")
	c.call("begin", 0, 1)
	for i in 6:
		c.call("hit")
	c.call("hurt")
	c.call("hit")
	for i in 15:
		c.call("kill")
	var r: Dictionary = c.call("finish", 1000, false)
	# 피격 1 → 2 · 연속 6 → 1 · 시간 짧음 → 2 · 처치 15 → 1 = 6 → A
	check(String(r.rank) == "A" and int(r.combo) == 6 and int(r.hits) == 1 and int(r.bonus_gold) == 200, "② 연속 6·피격 1·처치 15 → A · 덤 1000×0.2=%d" % int(r.get("bonus_gold", -1)))
	c.call("begin", 0, 1)
	for i in 4:
		c.call("kill")
	var rd: Dictionary = c.call("finish", 1000, true)
	check(not rd.is_empty() and int(rd.bonus_gold) == 0 and bool(rd.dead), "② 쓰러진 판 — 등급 %s · 덤 0" % String(rd.get("rank", "")))

	# ③ 2나락
	Mode.set("run_mode", "hard")
	check(int(DR.tier_now()) == 2, "③ 급: 험 = 2")
	DR.set("best", {})
	G.gold = 500
	DR.begin()
	for i in 20:
		DR.hit()
	for i in 15:
		DR.kill()
	G.gold = 1500   # 판에서 1000 벎
	var d1: Dictionary = DR.finish(false)
	# 피격 0 → 3 · 연속 20 → 3 · 시간 → 2 · 처치 15 → 1 = 9 → S · 덤 1000×0.5
	check(String(d1.rank) == "S" and int(d1.bonus_gold) == 500 and int(G.gold) == 2000 and bool(d1.best) and String((DR.get("best") as Dictionary).get("hard", "")) == "S",
		"③ 한 판 S · 덤 +500 지갑에 · 험 첫 기록 S")
	var tx: String = DR.text(d1)
	check(tx.contains("⭐ 이번 판 등급 S") and tx.contains("🪙 등급 덤 +500") and tx.contains("🏆 첫 기록 S"), "③ 글: %s" % tx.replace("\n", " / "))
	DR.begin()
	for i in 3:
		DR.kill()
	DR.hurt()
	var d2: Dictionary = DR.finish(true)
	check(not bool(d2.get("best", true)) and String((DR.get("best") as Dictionary).hard) == "S" and DR.text(d2).contains("쓰러져 덤 없음"), "③ 낮은 판은 최고 그대로 · 쓰러짐 글")

	# ④ 끄기
	OS.set_environment("SAGA_RUNRANK", "0")
	DR.begin()
	for i in 5:
		DR.kill()
	check((DR.finish(false) as Dictionary).is_empty(), "④ SAGA_RUNRANK=0 → 셈 없음")
	OS.set_environment("SAGA_RUNRANK", "")

	# ⑤ 저장
	var old_path: String = Save.path_override
	Save.path_override = "user://probe_dungeon_rank_tmp.json"
	var body := Node3D.new()
	root.add_child(body)
	Save.save(body)
	DR.set("best", {})
	var ld: bool = Save.try_load()
	check(ld and String((DR.get("best") as Dictionary).get("hard", "")) == "S", "⑤ 저장 왕복 %s" % str(DR.get("best")))
	var d: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(Save.save_path()))
	d.erase("rank_best")
	var f := FileAccess.open(Save.save_path(), FileAccess.WRITE)
	f.store_string(JSON.stringify(d))
	f.close()
	check(Save.try_load() and (DR.get("best") as Dictionary).is_empty(), "⑤ 옛 세이브(칸 없음) = 빈 것")
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_dungeon_rank_tmp.json"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_dungeon_rank_tmp.json.bak"))
	Save.path_override = old_path
	body.queue_free()

	# ⑥ 배선
	var src := {}
	for p in ["player/melee_attack.gd", "player/skill_caster.gd", "player/player_health.gd", "world/dungeon_enemy.gd", "world/test_room.gd"]:
		src[p] = FileAccess.get_file_as_string("res://games/saga_dungeon/" + p)
	check(String(src["player/melee_attack.gd"]).contains("dungeon_rank.gd\").hit()") and String(src["player/skill_caster.gd"]).contains("dungeon_rank.gd\").hit()")
		and String(src["player/player_health.gd"]).contains(".hurt()") and String(src["player/player_health.gd"]).contains(".finish(true)")
		and String(src["world/dungeon_enemy.gd"]).contains(".kill()") and String(src["world/test_room.gd"]).contains("dungeon_rank.gd\").begin()")
		and String(src["world/test_room.gd"]).contains(".finish(false) if is_final"), "⑥ 배선 일곱 자리")

	G.gold = saved.gold
	DR.set("best", saved.best)
	Mode.set("chosen", saved.chosen)
	Mode.set("run_mode", saved.run)
	print("PROBE dungeon_rank ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
