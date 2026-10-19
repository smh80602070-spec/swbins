extends SceneTree

## G-0242 3마을 땅 아래 층(games/saga_forest/data/forest_cave.gd · world/forest_cave_view.gd) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_forest_cave.gd
## 표·규칙(여기서): ① 층마다 광석 쌍이 다르고 5층은 유물·0층엔 짐승 없음 ② 캐기 하루 한 번(같은 날 거절·다음 날 다시) ③ 횃불이면 ×2(120초 뒤 꺼짐)
## ④ 솔방울 없으면 횃불 거절·있으면 1 씀·타는 중 거절 ⑤ 짐승 쫓기 전 사다리 막힘·0층 사다리는 열림·deepest ⑥ 5층 유물 한 번(화석 +1)
## ⑦ 저장 왕복·옛 세이브(칸 없음) = 빈 굴 기록.
## 씬(scene_probe_host 로 tools/scene_probes/forest_cave.gd): 들고남·불빛 범위·나가면 해 되돌림·층 다시 짓기.
## 시각·날짜·세이브 칸은 끝에 되돌린다. 끝에 "PROBE forest_cave OK|FAIL n".

const Cave := preload("res://games/saga_forest/data/forest_cave.gd")
const Day := preload("res://games/saga_forest/data/forest_day.gd")
const TMP_SAVE := "user://probe_forest_cave.json"
const T0 := 1_900_000_000.0
const DAY0 := 20261019

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _ore(f: int, i: int) -> Dictionary:
	return {"t": "ore", "id": "ore%d" % i, "key": String(Cave.ores_of(f)[i])}


func _initialize() -> void:
	await process_frame
	var F: Node = root.get_node("ForestSaveState")
	var saved := {"items": F.items.duplicate(true), "cave": F.cave.duplicate(true), "path": F.path_override}
	Day.force(DAY0)
	Cave.now_override = T0
	F.items = {"솔방울": 1}
	F.cave = {}

	# ① 표
	var pairs := {}
	var distinct := true
	for f in range(1, Cave.FLOORS + 1):
		var o: Array = Cave.ores_of(f)
		var k := "%s|%s" % [o[0], o[1]]
		distinct = distinct and not pairs.has(k) and o[0] != o[1] and Cave.ORE_INFO.has(o[0]) and Cave.ORE_INFO.has(o[1])
		pairs[k] = true
	var kinds0 := Cave.objects(0).map(func(x: Dictionary) -> String: return String(x.t))
	var kinds5 := Cave.objects(5).map(func(x: Dictionary) -> String: return String(x.t))
	var labels_ok := true
	for key: String in Cave.ORE_INFO.keys():
		labels_ok = labels_ok and String(Cave.ORE_INFO[key].label) in ["광석", "화석"]
	check(distinct and labels_ok and not kinds0.has("beast") and kinds0.has("ladder") and kinds5.has("relic") and not kinds5.has("ladder"),
		"표 — 층마다 광석 쌍 다름 %s · 0층 %s · 5층 %s" % [pairs.keys(), kinds0, kinds5])

	# ⑤ 0층 사다리 열림 → 1층 · 짐승 전 막힘
	var run := Cave.new_run()
	var d0: Dictionary = Cave.act(F, run, {"t": "ladder", "id": "ladder"})
	var blocked: Dictionary = Cave.act(F, run, {"t": "ladder", "id": "ladder"})
	var shoo: Dictionary = Cave.act(F, run, {"t": "beast", "id": "beast"})
	var shoo2: Dictionary = Cave.act(F, run, {"t": "beast", "id": "beast"})
	check(bool(d0.ok) and int(run.floor) == 1 and not bool(blocked.ok) and String(blocked.text).contains("지킨다") and bool(shoo.ok) and not bool(shoo2.ok)
		and int(Cave.st(F).deepest) == 1, "사다리 — 0층 열림·1층 짐승 전 막힘·쫓기 한 번 (%s / %s)" % [blocked.text, shoo.text])

	# ② 하루 한 번 · ③ 어둠 ×1
	var a1: Dictionary = Cave.act(F, run, _ore(1, 0))
	var a2: Dictionary = Cave.act(F, run, _ore(1, 0))
	var b1: Dictionary = Cave.act(F, run, _ore(1, 1))
	check(bool(a1.ok) and int(a1.n) == 1 and not bool(a2.ok) and bool(b1.ok) and F.item_count("광석") == 1 and F.item_count("화석") == 1,
		"캐기 — 어둠 ×1·같은 날 거절·짝은 따로 (광석 %d 화석 %d)" % [F.item_count("광석"), F.item_count("화석")])

	# ④ 횃불
	var t1: Dictionary = Cave.act(F, run, {"t": "torch", "id": "torch"})
	var t2: Dictionary = Cave.act(F, run, {"t": "torch", "id": "torch"})
	var pine_left: int = F.item_count("솔방울")
	Day.force(DAY0 + 1)
	var lit_ore: Dictionary = Cave.act(F, run, _ore(1, 0))
	Cave.now_override = T0 + Cave.TORCH_SEC + 1
	var out_lit: bool = Cave.lit(F)
	var t3: Dictionary = Cave.act(F, run, {"t": "torch", "id": "torch"})
	check(bool(t1.ok) and not bool(t2.ok) and pine_left == 0 and bool(lit_ore.ok) and int(lit_ore.n) == 2 and not out_lit
		and not bool(t3.ok) and String(t3.text).contains("솔방울"),
		"횃불 — 솔방울 1 씀·타는 중 거절·다음 날 다시 캐기 ×2·120초 뒤 꺼짐·솔방울 없으면 거절 (%s)" % t3.text)

	# ⑥ 5층 유물 한 번
	for f in range(1, Cave.FLOORS):
		run.shooed[f] = true
		Cave.act(F, run, {"t": "ladder", "id": "ladder"})
	var bottom: Dictionary = Cave.down(F, run)
	var fossil0: int = F.item_count("화석")
	var r1: Dictionary = Cave.act(F, run, {"t": "relic", "id": "relic"})
	var r2: Dictionary = Cave.act(F, run, {"t": "relic", "id": "relic"})
	var u: Dictionary = Cave.up(run)
	check(int(run.floor) == 4 and not bool(bottom.ok) and bool(r1.ok) and not bool(r2.ok) and F.item_count("화석") == fossil0 + 1
		and int(Cave.st(F).deepest) == 5 and String(u.kind) == "up",
		"유물 — 5층 한 번·화석 +1·맨 아래 더 못 감·deepest 5")
	var run0 := Cave.new_run()
	check(String(Cave.up(run0).kind) == "leave", "0층에서 위로 = 마을로")

	# ⑦ 저장 왕복 · 옛 세이브
	F.path_override = TMP_SAVE
	var body := Node3D.new()
	body.add_to_group("player")
	root.add_child(body)
	var want: Dictionary = F.cave.duplicate(true)
	var saved_ok: bool = F.save()
	F.cave = {}
	var loaded: bool = F.try_load()
	var rt: bool = saved_ok and loaded and int(F.cave.get("deepest", 0)) == 5 and bool(F.cave.get("relic", false)) \
		and is_equal_approx(float(F.cave.get("torch_until", 0)), float(want.torch_until)) and (F.cave.dug.got as Dictionary).has("1:ore0")
	var f := FileAccess.open(TMP_SAVE, FileAccess.READ)
	var raw: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	raw.erase("cave")
	var w := FileAccess.open(TMP_SAVE, FileAccess.WRITE)
	w.store_string(JSON.stringify(raw))
	w.close()
	var old_ok: bool = F.try_load() and F.cave.is_empty() and int(Cave.st(F).deepest) == 0 and not Cave.lit(F)
	check(rt and old_ok, "저장 — 왕복 %s · 옛 세이브 빈 굴 %s" % [rt, old_ok])
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP_SAVE))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP_SAVE + ".bak"))
	body.queue_free()

	F.items = saved.items
	F.cave = saved.cave
	F.path_override = String(saved.path)
	Cave.now_override = -1.0
	Day.force(null)

	# 씬 점검(오토로드가 필요한 뷰) — 호스트를 새 프로세스로
	var out: Array = []
	var rc := OS.execute(OS.get_executable_path(), ["--headless", "--path", ProjectSettings.globalize_path("res://"), "res://tools/scene_probe_host.tscn", "--", "res://tools/scene_probes/forest_cave.gd"], out, true)
	var got_line := false
	for chunk in out:
		for raw_line in String(chunk).split("\n"):
			var line := raw_line.trim_suffix("\r")
			if line.begins_with("  ok") or line.begins_with("  FAIL") or line.contains("SCRIPT ERROR"):
				print(line)
			if line.begins_with("PROBE forest_cave"):
				got_line = true
				if not line.ends_with("OK"):
					fails += maxi(1, int(line.get_slice(" ", 3)))
	if not got_line:
		fails += 1
		print("  FAIL 씬 점검 결과 줄 없음(rc %d)" % rc)

	print("PROBE forest_cave %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(1 if fails > 0 else 0)
