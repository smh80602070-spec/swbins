extends SceneTree

## G-0372 2나락 현상금 게시판(data/dungeon_bounty.gd) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_bounty.gd   → "PROBE dungeon_bounty OK" / "FAIL n"
## ① pick: 씨앗마다 다섯 중 셋·같은 씨앗 같은 셋·씨앗 여럿이면 다섯 다 나옴 ② 셈: 처치·정예·통 — 문턱에서 한 번만 이름 ③ 끝: 적게 맞고·빨리(등급 결과)
##   살아 나오면 채운 수 × GOLD_PER × 급, 쓰러지면 0 · 끝나면 비움 ④ dungeon_rank 고리: begin 이 걸고 kill(true) 가 정예 셈·finish 가 덤 금을 지갑에 · 글
## ⑤ 「오늘」 어댑터 today 줄 셋 ⑥ SAGA_BOUNTY=0 손잡이 이름. 진짜 세이브는 안 건드린다(지갑 되돌림).

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _ids(a: Array) -> Array:
	return a.map(func(b): return String(b.id))


func _initialize() -> void:
	await process_frame
	var B: GDScript = load("res://games/saga_dungeon/data/dungeon_bounty.gd")
	var DR: GDScript = load("res://games/saga_dungeon/data/dungeon_rank.gd")
	var GA: GDScript = load("res://games/saga_dungeon/ui/goals_adapter.gd")
	var G: Node = root.get_node("DungeonGoldState")
	var gold0: int = G.gold
	var Save: Node = root.get_node("DungeonSaveState")
	var pending0: int = Save.bounty_pending_gold

	# ① pick
	var seen := {}
	var all3 := true
	for s in 40:
		var p: Array = B.pick(s)
		all3 = all3 and p.size() == 3
		for id in _ids(p):
			seen[id] = true
	check(all3 and seen.size() == 5 and _ids(B.pick(7)) == _ids(B.pick(7)), "① 셋씩·다섯 다 나옴(%d)·같은 씨앗 같은 셋" % seen.size())

	# ② 셈 — 다섯 다 걸어 본다
	B.set("active", B.pick(0))
	var full: Array = []
	for b in B.POOL:
		var row: Dictionary = b.duplicate()
		row["cur"] = 0
		row["done"] = false
		full.append(row)
	B.set("active", full)
	B.set("tier", 2)
	var names: Array = []
	for i in 19:
		names += B.kill(false)
	var at20: Array = B.kill(true)
	var el2: Array = B.kill(true)
	var more: Array = B.kill(true)
	var props := ""
	for i in 6:
		var nm: String = B.prop()
		if nm != "":
			props = nm
	check(names.is_empty() and at20 == ["적 쓰러뜨리기"] and el2 == ["정예 쓰러뜨리기"] and more.is_empty() and props == "통·항아리 부수기",
		"② 처치 20 째 한 번 %s · 정예 2 째 %s · 그 뒤 없음 · 통 6 %s" % [at20, el2, props])

	# ③ 끝
	var r: Dictionary = B.finish({"hits": 3, "sec": 300}, false)
	var gold_ok: bool = int(r.get("gold", -1)) == 5 * B.GOLD_PER * 2 and int(r.done) == 5
	var empty_after: bool = (B.get("active") as Array).is_empty()
	B.set("active", full.map(func(b): var d: Dictionary = b.duplicate(); d.cur = 0; d.done = false; return d))
	var r2: Dictionary = B.finish({"hits": 9, "sec": 999}, false)
	B.set("active", full.map(func(b): var d: Dictionary = b.duplicate(); d.cur = 0; d.done = false; return d))
	for i in 20:
		B.kill(false)
	var r3: Dictionary = B.finish({"hits": 0, "sec": 10}, true)
	check(gold_ok and empty_after and int(r2.done) == 0 and int(r3.gold) == 0 and int(r3.done) == 1 and B.finish({}, false).is_empty(),
		"③ 다섯 채움 금 %d · 끝나면 비움 · 많이 맞고 늦으면 0 · 쓰러지면 덤 0(%s)" % [int(r.get("gold", -1)), r3])

	# ④ dungeon_rank 고리
	DR.begin()
	var act: Array = B.get("active")
	(act[0] as Dictionary).done = true   # 하나는 채운 셈
	var g1: int = G.gold
	var pending_before: int = Save.bounty_pending_gold
	var fin: Dictionary = DR.finish(false)
	var got_gold: int = G.gold - g1
	var pending_added: int = int(Save.bounty_pending_gold) - pending_before
	var tx: String = DR.text(fin) if not fin.is_empty() else ""
	var claimed: int = Save.claim_bounty_gold()
	var duplicate_claim: int = Save.claim_bounty_gold()
	var rank_bonus := int(fin.get("bonus_gold", 0))
	var bounty_text: String = B.text({"done": 1, "of": 3, "gold": 450})
	check(act.size() == 3 and got_gold == rank_bonus and pending_added >= B.GOLD_PER and claimed == pending_added and duplicate_claim == 0 and G.gold - g1 == rank_bonus + claimed and (fin.is_empty() or tx.contains("📜 현상금")) and bounty_text.contains("받을 금 +450"), "④ 고리: 현상금 미수령(+%d) · 등급 덤 +%d 유지 · 한 번 받음(+%d) · 중복 0 · 결과 문구 받기" % [pending_added, rank_bonus, claimed])

	# ⑤ 어댑터
	B.begin(1, 3)
	var hud := Node.new()
	root.add_child(hud)
	var m: Dictionary = GA.model(hud)
	check((m.today as Array).size() == 3 and String(m.title).begins_with("이번 판 현상금"), "⑤ 「오늘」 위 칸 현상금 셋(%d)" % (m.today as Array).size())
	Save.bounty_pending_gold = 75
	m = GA.model(hud)
	var claim: Dictionary = m.get("claim", {})
	if claim.get("take", Callable()).is_valid():
		claim.take.call()
	check(bool(claim.get("ready", false)) and G.gold == gold0 + claimed + 75 and Save.bounty_pending_gold == 0, "⑤ 받기 단추가 미수령 금을 한 번 지급")
	hud.queue_free()

	# ⑥ 손잡이
	check(B.on(), "⑥ 기본 켜짐(SAGA_BOUNTY=0 이면 끔)")

	B.set("active", [])
	G.set("gold", gold0)
	Save.bounty_pending_gold = pending0
	print("PROBE dungeon_bounty ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
