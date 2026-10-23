extends SceneTree

## G-0330 3마을 집 꾸미기 계절 심사 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_forest_hha.gd   → "PROBE forest_hha OK" / "FAIL n"
## ① 계절: 4월 봄·7월 여름·10월 가을·1월 겨울 · 12월은 다음 해 겨울 열쇠 ② 주제 덤: 그 계절 갈래 하나 +25·둘 +40·없음 0
## ③ 별: 문턱 30·80·160·280·450 ④ 심사: 처음 ★3 → 금 +900 · 같은 계절 다시 ★3 → 0 · ★4 로 오르면 차이 +300 · 새 계절은 새로
## ⑤ SAGA_HHA=0 → 심사 없음 ⑥ 저장 왕복·옛 세이브 빈 것 ⑦ 배선(집 평가).

const TMP_SAVE := "user://probe_forest_hha_tmp.json"

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var F: Node = root.get_node("ForestSaveState")
	var H: GDScript = load("res://games/saga_forest/data/forest_hha.gd")
	var FH: GDScript = load("res://games/saga_forest/data/forest_home.gd")
	var saved := {"hha": (F.hha as Dictionary).duplicate(true), "gold": F.gold, "path": F.path_override}

	# ①
	check(H.season_idx(20270415) == 0 and H.season_idx(20270715) == 1 and H.season_idx(20271015) == 2 and H.season_idx(20270115) == 3
		and H.season_key(20271215) == "2028-3" and H.season_key(20280110) == "2028-3", "① 계절 넷 · 12월은 다음 해 겨울 열쇠")

	# ②
	var furn := func(k: String) -> Dictionary: return FH.furn(k)
	var one := [{"key": "bangseok"}]
	var two := [{"key": "bangseok"}, {"key": "bandaji"}, {"key": "jokja"}]
	check(H.theme_bonus(one, 3, furn) == 25 and H.theme_bonus(two, 3, furn) == 40 and H.theme_bonus(two, 1, furn) == 0, "② 겨울(안방) 하나 +25·둘 +40 · 여름(부엌) 0")

	# ③
	check(H.stars_of(29) == 0 and H.stars_of(80) == 2 and H.stars_of(450) == 5, "③ 별 문턱")

	# ④
	F.hha = {}
	var g0: int = F.gold
	var r1: Dictionary = H.judge(F, 140, 25, 20270115)
	var r2: Dictionary = H.judge(F, 140, 25, 20270120)
	var r3: Dictionary = H.judge(F, 260, 40, 20270201)
	var r4: Dictionary = H.judge(F, 100, 0, 20270401)
	check(int(r1.stars) == 3 and int(r1.gold) == 900 and int(r2.gold) == 0 and int(r3.stars) == 4 and int(r3.gold) == 300 and int(r4.gold) == 600 and F.gold == g0 + 1800 and String(F.hha.season) == "2027-0",
		"④ 첫 ★3 +900 · 다시 0 · ★4 차이 +300 · 새 계절(봄) ★2 +600")
	check(String(H.text(r1, 3)).contains("★★★☆☆") and String(H.text(r2, 3)).contains("최고 ★3"), "④ 알림 글 「%s」" % String(H.text(r1, 3)).replace("\n", " / "))

	# ⑤
	OS.set_environment("SAGA_HHA", "0")
	var gx: int = F.gold
	check(H.judge(F, 500, 0, 20270501).is_empty() and F.gold == gx, "⑤ SAGA_HHA=0 → 심사 없음")
	OS.set_environment("SAGA_HHA", "")

	# ⑥
	F.path_override = TMP_SAVE
	var body := Node3D.new()
	body.add_to_group("player")
	root.add_child(body)
	var saved_ok: bool = F.save()
	F.hha = {}
	check(saved_ok and F.try_load() and String(F.hha.get("season", "")) == "2027-0" and int(F.hha.best) == 2, "⑥ 저장 왕복 %s" % str(F.hha))
	var d: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(F.save_path()))
	d.erase("hha")
	var fw := FileAccess.open(F.save_path(), FileAccess.WRITE)
	fw.store_string(JSON.stringify(d))
	fw.close()
	check(F.try_load() and (F.hha as Dictionary).is_empty(), "⑥ 옛 세이브(칸 없음) = 심사 없음")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP_SAVE))
	body.queue_free()

	# ⑦
	var fh := FileAccess.get_file_as_string("res://games/saga_forest/world/forest_house.gd")
	check(fh.contains("HHA.judge(ForestSaveState, int(sc.total)"), "⑦ 집 평가 배선")

	F.hha = saved.hha
	F.gold = saved.gold
	F.path_override = saved.path
	print("PROBE forest_hha ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
