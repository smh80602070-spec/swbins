extends SceneTree

## G-0238 4종횡 채집 랭크(games/saga_story/data/story_life.gd · story_save_state life/add_life_xp · world/story_gather.gd _gather) 자동 점검.
##   godot --headless --path saga-godot --script res://tools/probe_story_life.gd
## ① xp 0=F · 19=F · 20=E · 939=2 · 940=1 · progress ② 랭크 F 는 늘 하나 · 랭크 1 은 늘 둘 · D(2) 는 seed 고정 1000 번에 ≈25%
## ③ 채집 — 경험 1(🍀 2)·토스트 꼬리 "🌿 채집 F 1/20"·랭크 오르면 둘째 줄 ④ 저장 왕복·옛 세이브(20) 는 0.
## 끝에 "PROBE story_life OK" 또는 "PROBE story_life FAIL n". 진짜 세이브는 임시 경로로 비킨다.

const SL := preload("res://games/saga_story/data/story_life.gd")
const TMP := "user://probe_story_life_tmp.json"

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _rm() -> void:
	for suffix in ["", ".bak", ".tmp"]:
		if FileAccess.file_exists(TMP + suffix):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP + suffix))


func _initialize() -> void:
	await process_frame
	var ss: Node = root.get_node("StorySaveState")
	var life0: Dictionary = (ss.life as Dictionary).duplicate(true)
	var mats0: Dictionary = (ss.mats as Dictionary).duplicate(true)

	# ① 랭크 표
	check(SL.rank_of(0) == "F" and SL.rank_of(19) == "F" and SL.rank_of(20) == "E" and SL.rank_of(939) == "2" and SL.rank_of(940) == "1" and SL.rank_of(5000) == "1",
		"xp 0/19=F · 20=E · 939=2 · 940=1 · 5000=1")
	var p: Dictionary = SL.progress(32)
	var pe: Dictionary = SL.progress(940)
	check(p.rank == "E" and p.xp == 12 and p.need == 40 and pe.rank == "1" and pe.need == 0 and SL.label("gather", 72) == "🌿 채집 D 12/60" and SL.label("gather", 940) == "🌿 채집 1",
		"progress(32) = E 12/40 · 끝 랭크 need 0 · 꼬리 \"%s\"" % SL.label("gather", 72))

	# ② 두 개 확률
	var rng := RandomNumberGenerator.new()
	rng.seed = 20260824
	var f_extra := 0
	var one_extra := 0
	var d_extra := 0
	for i in 1000:
		f_extra += SL.extra(0, rng)
		one_extra += SL.extra(8, rng)
		d_extra += SL.extra(2, rng)
	check(f_extra == 0 and one_extra == 1000, "랭크 F 는 늘 하나(+%d) · 랭크 1 은 늘 둘(+%d/1000)" % [f_extra, one_extra])
	check(d_extra >= 220 and d_extra <= 280, "랭크 D(2/8) 1000 번에 두 개 %d(≈250)" % d_extra)
	check(SL.rank_up_text("gather", 2) == "🌿 채집 랭크 D — 두 개 확률 2/8", "오름 알림 \"%s\"" % SL.rank_up_text("gather", 2))

	# ③ 채집 행동
	var lbl := Label.new()
	lbl.add_to_group("dialogue_label")
	root.add_child(lbl)
	var Gather: GDScript = load("res://games/saga_story/world/story_gather.gd")
	var g := Node3D.new()
	g.set_script(Gather)
	g.kind = "herb"
	root.add_child(g)
	ss.life = {"gather": 0}
	ss.mats = {}
	g._gather()
	var t1 := lbl.text
	check(int(ss.life.gather) == 1 and int(ss.mats.get("herb", 0)) == 1 and t1.ends_with("+1 · 🌿 채집 F 1/20"), "캐면 경험 1 · 하나 · 토스트 \"%s\"" % t1)
	ss.life = {"gather": 19}
	g._gather()
	var t2 := lbl.text
	check(int(ss.life.gather) == 20 and t2.ends_with("🌿 채집 E 0/40\n🌿 채집 랭크 E — 두 개 확률 1/8"), "19→20 랭크 E 둘째 줄 \"%s\"" % t2.c_escape())
	check(ss.add_life_xp("gather", 2) == -1 and int(ss.life.gather) == 22 and ss.add_life_xp("gather", 40) == 2, "add_life_xp — 안 오르면 -1 · 오르면 새 번호")
	ss.life = {"gather": 940}
	ss.mats = {}
	g._gather()
	check(int(ss.mats.get("herb", 0)) == 2, "랭크 1 채집은 둘(+%d)" % int(ss.mats.get("herb", 0)))
	g.free()
	lbl.free()

	# ④ 저장 왕복 · 옛 세이브
	var player := Node3D.new()
	player.add_to_group("player")
	root.add_child(player)
	var real_path := String(ss.save_path())
	var real_md5 := FileAccess.get_md5(real_path) if FileAccess.file_exists(real_path) else ""
	ss.path_override = TMP
	_rm()
	ss.life = {"gather": 77}
	var wrote: bool = ss.save()
	ss.life = {"gather": 3}
	var loaded: bool = ss.try_load()
	check(wrote and loaded and int(ss.life.gather) == 77, "저장 왕복 life.gather 77 → %d" % int(ss.life.gather))
	var f := FileAccess.open(TMP, FileAccess.WRITE)
	f.store_string(JSON.stringify({"version": 20, "player_pos": [0, 0, 0], "mats": {"herb": 4}}))
	f.close()
	ss.life = {"gather": 55}
	var old_ok: bool = ss.try_load()
	check(old_ok and int(ss.life.gather) == 0 and int(ss.mats.get("herb", 0)) == 4 and ss.SAVE_VERSION == 21, "옛 세이브(20) → life.gather 0 · mats 그대로 · 버전 21")
	_rm()
	ss.path_override = ""
	player.free()
	check((FileAccess.get_md5(real_path) if FileAccess.file_exists(real_path) else "") == real_md5, "진짜 세이브 파일 그대로")

	ss.life = life0
	ss.mats = mats0
	print("PROBE story_life ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
