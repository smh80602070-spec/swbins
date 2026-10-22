extends SceneTree

## G-0308 2나락 지도 장치(부적 새김, 웹 W-0298 짝) — 화면 없는 규칙 점검.
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_atlas.gd
## ① 새김 값 150×티어×(새긴 수+1) · 금 빠짐 · 결정적(같은 id·같은 새긴 수 = 같은 변형자) · 이미 걸린 것 안 겹침
## ② 최대 3 · 금 모자라면 거절(금 그대로) · 켠 부적엔 못 새김
## ③ 켜면 새긴 것이 has_mod 로 걸림 · 새긴 resist_boost 원소 · 금 배율 ×(1+0.2×n)
## ④ 단추 줄(inscribe_label) · SAGA_ATLAS=0 이면 새김·배율 끔 ⑤ 저장 왕복(extra 남음)·옛 세이브(extra 없음 = 빈 것)
## 진짜 세이브는 안 건드린다(path_override). 끝에 "PROBE dungeon_atlas OK" 또는 "FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var S: Node = root.get_node("DungeonSigilState")
	var G: Node = root.get_node("DungeonGoldState")
	var Save: Node = root.get_node("DungeonSaveState")
	var Btn: GDScript = load("res://games/saga_dungeon/ui/sigil_button.gd")
	var saved := {"sigils": S.sigils.duplicate(true), "active": S.active_index, "best": S.best_tier_cleared, "next": S._next_id, "gold": G.gold}
	S.restore([], -1, 0, 1)

	# ① 새김 값·금·결정적·안 겹침
	var a: Dictionary = S.add_sigil(2)
	var b: Dictionary = S.add_sigil(2)
	var dup: Dictionary = a.duplicate(true)
	check(S.inscribe_cost(a) == 300, "티어 2 첫 새김 = 150×2×1 = 300")
	G.gold = 10000
	var r: Dictionary = S.inscribe(0)
	check(bool(r.ok) and G.gold == 9700 and S.extra_of(S.sigils[0]).size() == 1, "새김 → 금 −300 · extra 1")
	check(str(r.key) == S.next_mod(dup), "새긴 것 = 새기기 전 next_mod(결정적)")
	check(not (a.get("mods", []) as Array).has(r.key), "이미 굴린 변형자와 안 겹침")
	check(S.inscribe_cost(S.sigils[0]) == 600, "둘째 새김 = 150×2×2 = 600")
	var c2: Dictionary = S.add_sigil(2)
	c2["id"] = a.id   # 같은 id·같은 새긴 수 → 같은 다음 변형자
	c2["mods"] = (a.get("mods", []) as Array).duplicate()
	c2["extra"] = S.extra_of(S.sigils[0]).duplicate()
	check(S.next_mod(c2) == S.next_mod(S.sigils[0]), "같은 id·같은 새긴 수 = 같은 다음 변형자")
	S.sigils.pop_back()

	# ② 최대·금 모자람·켠 부적
	var guard := 0
	while S.inscribe(0).get("ok", false) and guard < 10:
		guard += 1
	var n0: int = S.extra_of(S.sigils[0]).size()
	var all0: Array = S.all_mods(S.sigils[0])
	var uniq := {}
	for k in all0:
		uniq[k] = true
	check(n0 <= S.ATLAS_MAX_EXTRA and uniq.size() == all0.size(), "새김 최대 3 · 전부 겹침 없음(%d개 새김, 합 %d)" % [n0, all0.size()])
	var full: Dictionary = S.inscribe(0)
	check(not bool(full.ok) and str(full.reason) in ["max", "none"], "가득이면 거절(%s)" % str(full.get("reason", "")))
	G.gold = 5
	var poor: Dictionary = S.inscribe(1)
	check(not bool(poor.ok) and str(poor.reason) == "gold" and G.gold == 5 and S.extra_of(S.sigils[1]).is_empty(), "금 모자라면 거절 · 금 그대로")
	G.gold = 10000

	# ③ 켜면 걸림·배율
	S.activate(0)
	var on_ok := true
	for k in S.extra_of(S.sigils[0]):
		on_ok = on_ok and S.has_mod(k)
	check(on_ok, "켠 부적의 새긴 변형자가 has_mod 로 걸림")
	check(not bool(S.inscribe(0).ok), "켠 부적엔 못 새김")
	var base_m: float = (1.0 + S.REWARD_MULT_PER_TIER * 2) * (1.5 if S.all_mods(S.sigils[0]).has("treasure") else 1.0)
	var rolled_m: float = (1.0 + S.REWARD_MULT_PER_TIER * 2) * (1.5 if (S.sigils[0].get("mods", []) as Array).has("treasure") else 1.0)
	check(absf(S.gold_mult() - base_m * (1.0 + 0.2 * n0)) < 0.001, "금 배율 ×(1+0.2×%d) = %.3f" % [n0, S.gold_mult()])
	S.deactivate()
	var rs: Dictionary = S.add_sigil(1)
	rs["mods"] = ["swift", "regen"]
	rs["resist_el"] = ""
	rs["extra"] = ["resist_boost"]
	S.activate(S.sigils.size() - 1)
	check(S.has_mod("resist_boost") and S.resist_boost_el() == S.roll_resist_el(int(rs.id)), "새긴 resist_boost — 원소 id 로 결정적(%s)" % S.resist_boost_el())
	S.deactivate()

	# ④ 단추 줄·끄기
	var lbl: String = Btn.inscribe_label(S.sigils[1])
	check(lbl.begins_with("✒️ 변형자 새기기 300금 (0/3)") and lbl.contains("×1.2"), "단추 줄: " + lbl)
	check(Btn.inscribe_label(S.sigils[0]) == "", "가득 찬 부적은 줄 없음")
	OS.set_environment("SAGA_ATLAS", "0")
	check(not bool(S.inscribe(1).ok) and Btn.inscribe_label(S.sigils[1]) == "", "SAGA_ATLAS=0 → 새김 끔")
	S.activate(0)
	var off_ok := true
	for k in S.extra_of(S.sigils[0]):
		if not (S.sigils[0].get("mods", []) as Array).has(k):
			off_ok = off_ok and not S.has_mod(k)
	check(off_ok and absf(S.gold_mult() - rolled_m) < 0.001, "SAGA_ATLAS=0 → 새긴 것·배율 안 걸림")
	S.deactivate()
	OS.set_environment("SAGA_ATLAS", "")

	# ⑤ 저장 왕복·옛 세이브
	var old_path: String = Save.path_override
	Save.path_override = "user://probe_dungeon_atlas_tmp.json"
	var body := Node3D.new()
	root.add_child(body)
	var ex_before: Array = S.extra_of(S.sigils[0]).duplicate()
	Save.save(body)
	S.restore([], -1, 0, 1)
	check(Save.try_load() and S.sigils.size() == 3 and S.extra_of(S.sigils[0]) == ex_before, "저장 왕복: 새긴 것 남음 %s" % str(ex_before))
	var d: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(Save.save_path()))
	for s in d.get("sigils", []):
		(s as Dictionary).erase("extra")
	var f := FileAccess.open(Save.save_path(), FileAccess.WRITE)
	f.store_string(JSON.stringify(d))
	f.close()
	check(Save.try_load() and S.extra_of(S.sigils[0]).is_empty() and S.inscribe_cost(S.sigils[0]) == 300, "옛 세이브(extra 없음) = 빈 것")
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_dungeon_atlas_tmp.json"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_dungeon_atlas_tmp.json.bak"))
	Save.path_override = old_path
	body.queue_free()

	S.restore(saved.sigils, saved.active, saved.best, saved.next)
	G.gold = saved.gold
	print("PROBE dungeon_atlas ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
