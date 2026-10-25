extends SceneTree

## G-0400 1만리 고유 보패·보패 세트 기술·무리 습격(웹 W-0438 짝) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_go_artifact_raid.gd   → "PROBE go_artifact_raid OK" / "FAIL n"
## ① 고유 보패: ★5 의 약 8% · ★4 는 0 · 같은 씨앗 같은 결과 · 능력치·4 세트급 한 줄 · 이름 ⭐ ② 인물 능력치 합(stat·set4)에 고유가 얹힘
## ③ 세트 기술: 떠돌이 무사 네 점 → 칼바람 베기(둘레 3m 적 피해 = 공격 ×2.2) · 쿨 9 · 둘레에 적 없으면 안 터짐 · 세 점이면 없음
## ④ 무리 습격(SAGA_RAID=1·N=2): 처치 둘째 → 파도 1(4) → 다 잡으면 6 → 8 → 끝 냥 +480 · 습격 무리 처치는 안 셈 · 시간 다하면 흩어짐
## ⑤ 헤드리스 기본 끔(SAGA_RAID 없음) · 손잡이 0 = 끔 ⑥ 배선. 명단·보패는 끝에 되돌린다(세이브는 안 씀).

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var PS: Node = root.get_node("PartyState")
	var AU: GDScript = load("res://games/saga_go/data/artifact_unique.gd")
	var AR: GDScript = load("res://games/saga_go/data/artifacts.gd")
	var SK: GDScript = load("res://games/saga_go/world/go_art_skill.gd")
	var RD: GDScript = load("res://games/saga_go/world/go_raid.gd")
	var FE: GDScript = load("res://games/saga_go/combat/field_enemy.gd")
	var saved := {"arts": (PS.artifacts as Dictionary).duplicate(true), "items": (PS.bag as Dictionary).duplicate(true)}

	# ①
	var n5 := 0
	var n4 := 0
	for s in 2000:
		n5 += 1 if AU.roll(s, 5) != "" else 0
		n4 += 1 if AU.roll(s, 4) != "" else 0
	var same: bool = AU.roll(777, 5) == AU.roll(777, 5)
	var art := {"set": "gladiator", "uq": "uq_mugwang"}
	check(n5 > 100 and n5 < 220 and n4 == 0 and same and is_equal_approx(AU.stat(art, "atk_pct"), 0.12) and is_equal_approx(AU.four(art, "normal_melee"), 0.2) and AU.name_prefix(art) == "⭐ 무광 비녀 · ",
		"① ★5 고유 %d/2000 · ★4 %d · 같은 씨앗 같음 · 능력치·4 세트급·이름" % [n5, n4])
	var with_uq := {}
	for s in 4000:
		var g: Dictionary = AR.generate(s, 5)
		if g.has("uq"):
			with_uq = g
			break
	check(not with_uq.is_empty() and AU.UQ.has(String(with_uq.uq)), "① 보패 생성에 고유 칸(%s)" % String(with_uq.get("uq", "-")))

	# ②
	var id := "probe_hero"
	PS.artifacts = {}
	var base_atk: float = PS.stat(id, "atk_pct")
	var base_nm: float = PS.set4(id, "normal_melee")
	PS.artifacts = {"a1": {"set": "depth", "slot": "flower", "rarity": 5, "lv": 0, "exp": 0.0, "total": 0.0, "main": "hp", "subs": [], "seed": 1, "owner": id, "uq": "uq_mugwang"}}
	check(is_equal_approx(float(PS.stat(id, "atk_pct")) - base_atk, 0.12) and is_equal_approx(float(PS.set4(id, "normal_melee")) - base_nm, 0.2), "② 인물 능력치 합에 고유(공격 +12% · 기본 공격 +20%)")

	# ③
	var stage := Node3D.new()
	root.add_child(stage)
	current_scene = stage
	var gs := GDScript.new()
	gs.source_code = "extends Node\nvar hp := 100.0\nsignal party_wiped\nfunc active_id() -> String:\n\treturn \"probe_hero\"\nfunc char_atk(_id: String) -> float:\n\treturn 100.0\nfunc can_be_targeted() -> bool:\n\treturn false\nfunc take_damage(_a: float, _s: Node) -> void:\n\tpass\n"
	gs.reload()
	var fc := Node.new()
	fc.set_script(gs)
	fc.add_to_group("go_field_combat")
	stage.add_child(fc)
	var pl := CharacterBody3D.new()
	pl.add_to_group("player")
	stage.add_child(pl)
	PS.artifacts = {}
	for i in 4:
		PS.artifacts["g%d" % i] = {"set": "gladiator", "slot": AR.SLOTS[i], "rarity": 5, "lv": 0, "exp": 0.0, "total": 0.0, "main": "hp", "subs": [], "seed": i, "owner": id}
	var three := false
	var sk: Node = SK.attach(stage)
	sk.set_process(false)   # 점검은 손으로 tick
	var wolf: Node3D = FE.new()
	wolf.name = "ProbeWolf"
	wolf.call("setup", "wolf", Vector3(2.0, 0.3, 0.0), 1)
	wolf.set("respawns", false)
	stage.add_child(wolf)
	await process_frame
	var far: Node3D = FE.new()
	far.call("setup", "wolf", Vector3(30.0, 0.3, 0.0), 2)
	stage.add_child(far)
	await process_frame
	wolf.set("max_hp", 5000.0)   # 한 방에 안 쓰러지게(쓰러지면 respawns 없이 풀린다)
	wolf.set("hp", 5000.0)
	var h0: float = float(wolf.get("hp"))
	var hf0: float = float(far.get("hp"))
	var f1: int = sk.call("tick", 0.1)
	var h1: float = float(wolf.get("hp"))
	var f2: int = sk.call("tick", 0.1)
	var cdv: float = float((sk.get("cds") as Dictionary).get("probe_hero|gladiator", 0.0))
	PS.artifacts.erase("g3")
	three = SK.skills_of(id).is_empty()
	check(f1 == 1 and h1 < h0 and float(far.get("hp")) == hf0 and f2 == 0 and absf(cdv - 8.9) < 0.05 and three, "③ 네 점 → 칼바람 베기 · 둘레 적 체력 %.0f → %.0f · 먼 적 그대로 · 쿨 %.1f · 세 점 없음" % [h0, h1, cdv])
	far.queue_free()
	wolf.queue_free()

	# ④
	OS.set_environment("SAGA_RAID", "1")
	OS.set_environment("SAGA_RAID_N", "2")
	var rd: Node = RD.attach(stage)
	rd.set_process(false)
	var dummies: Array = []
	for i in 2:
		var d: Node3D = FE.new()
		d.name = "ProbeDummy%d" % i
		d.call("setup", "wolf", Vector3(40.0 + i, 0.3, 0.0), 10 + i)
		stage.add_child(d)
		dummies.append(d)
	await process_frame
	rd.call("watch")
	var mora0 := int(PS.call("count", "mora"))
	for d: Node in dummies:
		d.emit_signal("died", d)
	rd.call("tick", 0.1)
	await process_frame
	var sizes: Array = [int(rd.call("alive_count"))]
	for w in range(1, RD.WAVES + 1):
		for e in stage.get_children():
			if e.has_meta("raid") and float(e.get("hp")) > 0.0:
				e.set("hp", 0.0)
				e.call("_die")
		await process_frame
		rd.call("tick", 0.1)
		await process_frame
		if w < RD.WAVES:
			sizes.append(int(rd.call("alive_count")))
	var mora1 := int(PS.call("count", "mora"))
	check(sizes == [4, 6, 8] and not bool(rd.get("active")) and int(rd.get("finished")) == 1 and mora1 - mora0 == RD.reward() and int(rd.get("kills")) == 2,
		"④ 처치 둘째 → 파도 %s · 끝 냥 +%d · 습격 무리 처치는 안 셈(셈 %d)" % [str(sizes), mora1 - mora0, int(rd.get("kills"))])
	rd.set("pending", true)
	rd.call("tick", 0.1)
	await process_frame
	var a0: int = rd.call("alive_count")
	rd.call("tick", 200.0)
	await process_frame
	check(a0 == 4 and not bool(rd.get("active")) and int(rd.call("alive_count")) == 0, "④ 시간 다하면 흩어짐")

	# ⑤
	OS.set_environment("SAGA_RAID", "")
	var headless_off: bool = not RD.on()
	OS.set_environment("SAGA_RAID", "0")
	OS.set_environment("SAGA_ART_SKILL", "0")
	OS.set_environment("SAGA_ART_UNIQUE", "0")
	check(headless_off and RD.attach(Node.new()) == null and SK.attach(Node.new()) == null and AU.roll(777, 5) == "" and AU.stat(art, "atk_pct") == 0.0, "⑤ 헤드리스 기본 끔 · 손잡이 0 = 끔")
	for k in ["SAGA_RAID", "SAGA_RAID_N", "SAGA_ART_SKILL", "SAGA_ART_UNIQUE"]:
		OS.set_environment(k, "")

	# ⑥
	var tv := FileAccess.get_file_as_string("res://games/saga_go/world/test_village.gd")
	var ps := FileAccess.get_file_as_string("res://games/saga_go/data/party_state.gd")
	var cs := FileAccess.get_file_as_string("res://games/saga_go/ui/character_screen.gd")
	check(tv.contains("go_art_skill.gd\").attach(self)") and tv.contains("go_raid.gd\").attach(self)") and ps.count("artifact_unique.gd\")") == 2 and cs.contains("artifact_unique.gd\").name_prefix(a)"), "⑥ 배선(마을·능력치 합·인물 창 이름)")

	PS.artifacts = saved.arts
	PS.bag = saved.items
	stage.queue_free()
	await process_frame
	print("PROBE go_artifact_raid ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
