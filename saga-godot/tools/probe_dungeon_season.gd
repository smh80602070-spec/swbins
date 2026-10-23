extends SceneTree

## G-0334 2나락 로컬 시즌·래더(data/dungeon_season.gd) 점검.
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_season.gd   → "PROBE dungeon_season OK" / "FAIL n"
## ① 시즌 번호(월요일 경계)·남은 날 ② 점수 = 등급 × 급 · 좋은 판 다섯 · 쓰러진 판 안 듦 ③ 단계·다음 단계 글
## ④ 주가 바뀌면 닫기 — 단계 금이 지갑에·지난 기록·래더 비움 · 처음엔 덤 없음 ⑤ 한 판 등급(finish) → 래더·글 줄
## ⑥ SAGA_SEASON=0 ⑦ 저장 왕복·옛 세이브 ⑧ 배선(입장 roll·창 단추·메뉴 칸). 진짜 세이브는 안 건드린다.

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var S: GDScript = load("res://games/saga_dungeon/data/dungeon_season.gd")
	var DR: GDScript = load("res://games/saga_dungeon/data/dungeon_rank.gd")
	var G: Node = root.get_node("DungeonGoldState")
	var Save: Node = root.get_node("DungeonSaveState")
	var Mode: GDScript = load("res://games/saga_dungeon/data/dungeon_mode.gd")
	var saved := {"gold": G.gold, "dump": (S.dump() as Dictionary).duplicate(true), "best": (DR.get("best") as Dictionary).duplicate(), "run": Mode.get("run_mode")}

	# ① 2026-10-19(월) 00:00 UTC = 1792368000 · 10-25(일) 23:59 같은 시즌 · 10-26(월) 다음
	var mon := 1792368000
	check(int(S.season_of(mon)) == int(S.season_of(mon + 6 * 86400 + 86399)) and int(S.season_of(mon + 7 * 86400)) == int(S.season_of(mon)) + 1
		and int(S.season_of(mon - 1)) == int(S.season_of(mon)) - 1, "① 월요일 경계 시즌 %d" % int(S.season_of(mon)))
	S.set("now_override", mon + 86400 * 2)   # 수요일
	check(int(S.days_left()) == 5, "① 수요일 남은 날 %d = 5" % int(S.days_left()))

	# ② 기록
	S.restore({})
	S.set("now_override", mon)
	check((S.roll() as Dictionary).is_empty() and int(S.get("id")) == int(S.season_of(mon)), "④ 처음 켠 기기 — 번호만, 덤 없음")
	var a: Dictionary = S.record({"rank": "S", "tier": 2, "sec": 200})
	check(int(a.pts) == 10 and bool(a.in) and int(S.score()) == 10 and int(a.tier) == 0 and bool(a.up), "② S × 2 = 10점 → 청동 · 올라감")
	check((S.record({"rank": "A", "tier": 1, "dead": true}) as Dictionary).is_empty(), "② 쓰러진 판 안 듦")
	for rk in ["D", "C", "B", "A", "A"]:
		S.record({"rank": rk, "tier": 1, "sec": 100})
	var rs: Array = S.get("runs")
	check(rs.size() == 5 and int(rs[0].pts) == 10 and int(rs[4].pts) == 2 and int(S.score()) == 10 + 4 + 4 + 3 + 2, "② 좋은 판 다섯만(D 밀려남) · 합 %d" % int(S.score()))
	var low: Dictionary = S.record({"rank": "D", "tier": 1})
	check(not bool(low.in) and String(S.line(low)).contains("못 듦"), "② 낮은 판은 못 듦: %s" % S.line(low))

	# ③ 단계 글
	check(int(S.tier_of(9)) == -1 and int(S.tier_of(25)) == 1 and int(S.tier_of(125)) == 4 and String(S.next_text(30)) == "황금까지 15" and String(S.next_text(100)) == "최고 단계",
		"③ 단계 문턱 · %s" % S.next_text(30))
	var ln: Array = S.lines()
	check(String(ln[0]).contains("23점") and String(ln[0]).contains("🥉 청동") and String(ln[1]).begins_with("1. S급 × 급수 2 = 10점"), "③ 창 줄: %s / %s" % [ln[0], ln[1]])

	# ④ 넘어감 — 23점 청동 → 100금
	G.gold = 50
	S.set("now_override", mon + 7 * 86400 + 10)
	var rr: Dictionary = S.roll()
	check(bool(rr.settled) and int(rr.gold) == 100 and int(G.gold) == 150 and (S.get("runs") as Array).is_empty() and (S.get("past") as Array).size() == 1
		and String(S.roll_text(rr)).contains("🥉 청동(23점)"), "④ 지난 시즌 닫기: %s" % S.roll_text(rr))
	check((S.roll() as Dictionary).is_empty(), "④ 같은 주 두 번째는 그대로")
	S.set("now_override", mon + 21 * 86400)   # 빈 시즌 지나 닫기
	var r0: Dictionary = S.roll()
	check(int(r0.gold) == 0 and int(r0.tier) == -1 and int(G.gold) == 150, "④ 빈 시즌은 덤 0")
	var id_now: int = S.get("id")
	S.set("now_override", mon)   # 시계를 뒤로
	check((S.roll() as Dictionary).is_empty() and int(S.get("id")) == id_now and int(G.gold) == 150, "④ 시계를 뒤로 돌리면 닫지 않음(번호 %d 그대로)" % id_now)
	S.set("now_override", mon + 21 * 86400)

	# ⑤ 한 판 등급에서
	Mode.set("run_mode", "hard")
	DR.set("best", {})
	G.gold = 0
	DR.begin()
	for i in 20:
		DR.hit()
	for i in 15:
		DR.kill()
	var d1: Dictionary = DR.finish(false)
	var tx: String = DR.text(d1)
	check(String(d1.rank) == "S" and int((d1.season as Dictionary).pts) == 10 and tx.contains("🏅 시즌 +10점 → 10점 🥉 청동"), "⑤ 한 판 S(험) → 시즌 10점: %s" % tx.replace("\n", " / "))
	DR.begin()
	for i in 4:
		DR.kill()
	var d2: Dictionary = DR.finish(true)
	check((d2.season as Dictionary).is_empty() and int(S.score()) == 10, "⑤ 쓰러진 판은 래더 그대로")

	# ⑥ 끄기
	OS.set_environment("SAGA_SEASON", "0")
	check((S.record({"rank": "S", "tier": 5}) as Dictionary).is_empty() and int(S.score()) == 10, "⑥ SAGA_SEASON=0 → 기록 없음")
	S.set("now_override", mon + 70 * 86400)
	check((S.roll() as Dictionary).is_empty(), "⑥ 끄면 넘어감도 없음")
	OS.set_environment("SAGA_SEASON", "")
	S.set("now_override", mon + 21 * 86400)

	# ⑦ 저장
	var old_path: String = Save.path_override
	Save.path_override = "user://probe_dungeon_season_tmp.json"
	var body := Node3D.new()
	root.add_child(body)
	Save.save(body)
	var want: Dictionary = (S.dump() as Dictionary).duplicate(true)
	S.restore({})
	check(Save.try_load() and int(S.get("id")) == int(want.id) and int(S.score()) == 10 and (S.get("past") as Array).size() == 2, "⑦ 저장 왕복 %s" % str(S.dump()))
	var d: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(Save.save_path()))
	d.erase("season")
	var f := FileAccess.open(Save.save_path(), FileAccess.WRITE)
	f.store_string(JSON.stringify(d))
	f.close()
	check(Save.try_load() and int(S.get("id")) == -1 and (S.get("runs") as Array).is_empty(), "⑦ 옛 세이브(칸 없음) = 번호 없음")
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_dungeon_season_tmp.json"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_dungeon_season_tmp.json.bak"))
	Save.path_override = old_path
	body.queue_free()

	# ⑧ 배선
	var tr := FileAccess.get_file_as_string("res://games/saga_dungeon/world/test_room.gd")
	var hud := FileAccess.get_file_as_string("res://games/saga_dungeon/ui/DungeonHUD.tscn")
	check(tr.contains("dungeon_season.gd\").roll()") and hud.contains("season_button.gd") and hud.contains("\"SeasonButton|🏆|시즌\""), "⑧ 입장 roll · 단추 · 메뉴 칸")

	S.set("now_override", -1)
	S.restore(saved.dump)
	G.gold = saved.gold
	DR.set("best", saved.best)
	Mode.set("run_mode", saved.run)
	print("PROBE dungeon_season ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
