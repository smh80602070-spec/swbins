extends SceneTree

## G-0315 3마을 유적 발굴·복원(웹 W-0309 짝) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_forest_relics.gd   → "PROBE forest_relics OK" / "FAIL n"
## ① 굴림: 날·자리로 결정적 · 갈라진 자리 말고는 안 나옴 · 60일 중 나오는 비율 약 CHANCE ② 조각 넷 상한 · 다 모은 갈래는 안 나옴
## ③ 복원: 모자라면 거절 · 넷이면 금 +300·조각 0·전시 · 둘째 복원 거절 · 셋째에 옛터 잔치 +600 한 번
## ④ SAGA_RELICS=0 → 안 나옴·복원 거절 ⑤ 저장 왕복·옛 세이브 빈 것 ⑥ 배선(채집 꼬리·사고 창·전시대).
## 진짜 세이브는 안 건드린다(path_override).

const TMP_SAVE := "user://probe_forest_relics_tmp.json"

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
	var RL: GDScript = load("res://games/saga_forest/data/forest_relics.gd")
	var saved := {"gold": F.gold, "rl": (F.relics as Dictionary).duplicate(true), "path": F.path_override}
	F.relics = {}

	# ①
	var a: String = RL.roll(F, 20000, "gather_fossil")
	check(a == RL.roll(F, 20000, "gather_fossil") and RL.on_dig(F, 20000, "gather_tree") == "", "① 결정적 · 다른 자리는 안 나옴")
	var hit := 0
	for d in 60:
		if RL.roll(F, 20000 + d, "gather_fossil") != "":
			hit += 1
	check(hit >= 18 and hit <= 42, "① 60일 중 %d번 나옴(CHANCE %.1f)" % [hit, RL.CHANCE])

	# ②
	for i in 6:
		RL.add_piece(F, "bowl")
	check(RL.got(F, "bowl") == 4, "② 조각 넷 상한")
	var bowl_again := false
	for d in 60:
		if RL.roll(F, 20000 + d, "gather_fossil") == "bowl":
			bowl_again = true
	check(not bowl_again, "② 다 모은 갈래는 안 나옴")

	# ③
	var g0: int = F.gold
	check(not bool(RL.restore(F, "stele", 1).ok), "③ 모자라면 거절")
	var r: Dictionary = RL.restore(F, "bowl", 1)
	check(bool(r.ok) and F.gold == g0 + 300 and RL.got(F, "bowl") == 0 and RL.restored(F, "bowl") and not bool(r.feast), "③ 복원 → 금 +300 · 조각 0 · 전시")
	check(not bool(RL.restore(F, "bowl", 1).ok), "③ 둘째 복원 거절")
	for k in ["stele", "tile"]:
		for i in 4:
			RL.add_piece(F, k)
	RL.restore(F, "stele", 2)
	var g1: int = F.gold
	var r3: Dictionary = RL.restore(F, "tile", 3)
	check(bool(r3.feast) and F.gold == g1 + 900 and int(F.relics.feast) == 3, "③ 셋째 복원 → 옛터 잔치 +600 한 번")
	check(RL.roll(F, 20001, "gather_fossil") == "", "③ 다 복원하면 더 안 나옴")

	# ④
	F.relics = {}
	RL.add_piece(F, "bowl")
	for i in 3:
		RL.add_piece(F, "bowl")
	OS.set_environment("SAGA_RELICS", "0")
	var none := true
	for d in 30:
		if RL.on_dig(F, 20000 + d, "gather_fossil") != "":
			none = false
	check(none and not bool(RL.restore(F, "bowl", 1).ok) and RL.lines(F).is_empty(), "④ SAGA_RELICS=0 → 안 나옴·복원 거절·창 줄 없음")
	OS.set_environment("SAGA_RELICS", "")

	# ⑤
	F.path_override = TMP_SAVE
	var body := Node3D.new()
	body.add_to_group("player")
	root.add_child(body)
	var saved_ok: bool = F.save()
	F.relics = {}
	check(saved_ok and F.try_load() and RL.got(F, "bowl") == 4 and bool((RL.lines(F)[0] as Dictionary).ready), "⑤ 저장 왕복 · 창 줄 복원 가능")
	var d: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(F.save_path()))
	d.erase("relics")
	var fw := FileAccess.open(F.save_path(), FileAccess.WRITE)
	fw.store_string(JSON.stringify(d))
	fw.close()
	check(F.try_load() and RL.got(F, "bowl") == 0 and (F.relics as Dictionary).get("restored", []).is_empty(), "⑤ 옛 세이브(칸 없음) = 조각 없음")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP_SAVE))

	# ⑥
	var gb := FileAccess.get_file_as_string("res://games/saga_forest/world/gatherable_builder.gd")
	var mu := FileAccess.get_file_as_string("res://games/saga_forest/world/museum.gd")
	check(gb.contains("forest_relics.gd\").on_dig(ForestSaveState, today, String(d.id))") and mu.contains("Relics.lines(ForestSaveState)") and mu.contains("_spawn_relic(String(s.key))"), "⑥ 배선 셋")

	body.queue_free()
	F.gold = int(saved.gold)
	F.relics = saved.rl
	F.path_override = saved.path
	print("PROBE forest_relics ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
