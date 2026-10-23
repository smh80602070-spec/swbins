extends SceneTree

## G-0333 4종횡 문파 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_story_guild.gd   → "PROBE story_guild OK" / "FAIL n"
## ① 들기·나가기(공 0) · 문파 없으면 곱 1 ② 공: 처치 +1 · 오늘 의뢰 사냥터 ×2 · 보스 +10 · 단계 문턱(100 → 제자) ③ 덤: 검각 공격·상단 금(add_gold)·서원 경험 — 단계마다 +2%, 남의 갈래는 1
## ④ 의뢰 사냥터는 날·문파마다 돌아감 ⑤ SAGA_GUILD=0 → 문파 없음 ⑥ 세이브 왕복(공 정수)·옛 26 → 문파 없음·판 27 ⑦ 배선(처치·보스·금·경험·공격·HUD 메뉴).

const SAVED_VARS := ["guild", "gold", "path_override"]

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
	var G: GDScript = load("res://games/saga_story/data/story_guild.gd")
	var saved := {}
	for v in SAVED_VARS:
		saved[v] = S.get(v)
		if saved[v] is Dictionary:
			saved[v] = (saved[v] as Dictionary).duplicate(true)
	var dk := 20271023

	# ①
	S.guild = {}
	var none_mul: float = G.mul(S, "atk")
	var e1: String = G.join(S, "blade")
	var e2: String = G.join(S, "blade")
	check(is_equal_approx(none_mul, 1.0) and e1 == "" and e2.contains("이미") and G.joined(S) == "blade", "① 들기 · 같은 문파 거절 · 없으면 곱 1")

	# ②
	var h: String = G.hunt_today("blade", dk)
	var other := "field" if h != "field" else "forest"
	G.on_kill(S, other, false, dk)
	var p1: int = G.pts(S)
	G.on_kill(S, h, false, dk)
	var p2: int = G.pts(S)
	G.on_kill(S, "", true, dk)
	var p3: int = G.pts(S)
	S.guild.pts = 99
	var up: int = G.on_kill(S, other, false, dk)
	check(p1 == 1 and p2 == 3 and p3 == 13 and up == 1 and G.rank(S) == 1, "② 처치 +1 · 의뢰 사냥터(%s) ×2 · 보스 +10 · 100 → 제자" % h)

	# ③
	S.guild.pts = 1500   # 부문주(4단) +8%
	var atk_m: float = G.mul(S, "atk")
	var gold_other: float = G.mul(S, "gold")
	S.guild = {"id": "merchant", "pts": 3000}
	var g0: int = S.gold
	S.add_gold(100)
	var gain: int = S.gold - g0
	check(is_equal_approx(atk_m, 1.08) and is_equal_approx(gold_other, 1.0) and gain == 110, "③ 검각 부문주 공격 ×%.2f · 남의 갈래 1 · 상단 문주 금 +100 → +%d" % [atk_m, gain])

	# ④
	check(G.hunt_today("blade", dk) != G.hunt_today("merchant", dk) and G.hunt_today("blade", dk) != G.hunt_today("blade", dk + 1), "④ 의뢰 사냥터 날·문파마다 다름")

	# ⑤
	OS.set_environment("SAGA_GUILD", "0")
	check(G.joined(S) == "" and is_equal_approx(G.mul(S, "gold"), 1.0) and G.on_kill(S, "field", false, dk) == -1, "⑤ SAGA_GUILD=0 → 문파 없음")
	OS.set_environment("SAGA_GUILD", "")

	# ⑥
	var dummy := Node3D.new()
	dummy.add_to_group("player")
	root.add_child(dummy)
	S.path_override = "user://probe_story_guild_rt.json"
	S.guild = {"id": "academy", "pts": 321}
	var sv: bool = S.save()
	S.guild = {}
	var ld: bool = S.try_load()
	check(sv and ld and String(S.guild.id) == "academy" and typeof(S.guild.pts) == TYPE_INT and int(S.guild.pts) == 321, "⑥ 저장 왕복 %s" % str(S.guild))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(S.path_override))
	S.path_override = "user://probe_story_guild_old.json"
	var f := FileAccess.open(S.path_override, FileAccess.WRITE)
	f.store_string(JSON.stringify({"version": 26, "level": 5, "exp": 0, "gold": 10, "player_pos": [0.0, 0.1, 0.0]}))
	f.close()
	S.guild = {"id": "x"}
	var ld_old: bool = S.try_load()
	check(ld_old and (S.guild as Dictionary).is_empty() and S.save_version() >= 27, "⑥ 옛 26 → 문파 없음 · 판 %d" % S.save_version())
	DirAccess.remove_absolute(ProjectSettings.globalize_path(S.path_override))
	dummy.queue_free()

	# ⑦
	var ss := FileAccess.get_file_as_string("res://games/saga_story/data/story_save_state.gd")
	var pb := FileAccess.get_file_as_string("res://games/saga_story/player/story_player_base.gd")
	var hud := FileAccess.get_file_as_string("res://games/saga_story/ui/StoryHUD.tscn")
	check(ss.contains("story_guild.gd\").on_kill(self, stage_key, false") and ss.contains("story_guild.gd\").on_kill(self, \"\", true") and ss.contains("story_guild.gd\").mul(self, \"gold\")") and ss.contains("story_guild.gd\").mul(self, \"exp\")")
		and pb.contains("story_guild.gd\").mul(StorySaveState, \"atk\")") and hud.contains("\"GuildButton|🏯|문파\""), "⑦ 배선 여섯")

	for v in SAVED_VARS:
		S.set(v, saved[v])
	await process_frame
	print("PROBE story_guild ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
