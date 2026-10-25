extends SceneTree

## G-0397 1만리 등용 「⚔️ 무로 겨루자」 = 실시간 결투(웹 W-0430 짝) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_hero_duel.gd   → "PROBE hero_duel OK" / "FAIL n"
## ① 판: ★1·2 인물만 · ★3 졸개 하나 · ★5 둘 · 체력·공격 = 웹 식(220×(1.6+0.7★)·14×(0.9+0.12★))
## ② 결과: 인물 쓰러짐 = win · 명단 전멸 = lose · 30m 넘게 멀어짐 = flee · 아니면 ""
## ③ 실제 조우: 무 → 설득 창 닫힘·판(인물 몸 = 그 인물 이름표·졸개) 섬·서 있던 몸 숨김 · 지·덕은 옛 굴림(판 없음)
## ④ 인물 쓰러뜨리면 등용·판 걷힘 · ⑤ 멀어지면 물러남(몸 다시 보임·다시 다가가면 처음부터) · ⑥ 전멸이면 떠남 · ⑦ SAGA_HERO_DUEL=0 → 옛 굴림.
## 들판 전투 노드는 대역(그룹 go_field_combat + 신호 party_wiped). 진짜 세이브는 안 건드린다(PartyState 명단 되돌림).

const HD := preload("res://games/saga_go/data/hero_duel.gd")
var ENC: GDScript   # 자동 로드 쓰는 스크립트라 실행 때 load()

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _enc(stage: Node3D, hero: String, pl: CharacterBody3D) -> Node:
	var e: Node3D = ENC.new()
	e.name = "Enc_" + hero
	e.set("hero_id", hero)
	stage.add_child(e)
	pl.global_position = e.global_position + Vector3(0, 0, 3)
	e.call("_on_body_entered", pl)
	return e


func _initialize() -> void:
	await process_frame
	ENC = load("res://games/saga_go/world/hero_encounter.gd")
	# ①
	var c1 := HD.camp(1)
	var c3 := HD.camp(3)
	var c5 := HD.camp(5)
	check((c1.minions as Array).is_empty() and (c3.minions as Array).size() == 1 and (c5.minions as Array).size() == 2
		and is_equal_approx(float(c3.hp), roundf(220.0 * 3.7)) and is_equal_approx(float(c5.atk), roundf(14.0 * 1.5)),
		"① ★1 졸개 0 · ★3 하나 · ★5 둘 · ★3 체력 %d · ★5 공격 %d" % [int(c3.hp), int(c5.atk)])
	# ②
	check(HD.result(false, false, 5.0) == "win" and HD.result(true, true, 5.0) == "lose" and HD.result(true, false, 31.0) == "flee" and HD.result(true, false, 10.0) == "",
		"② 쓰러짐 win · 전멸 lose · 31m flee · 그 밖 \"\"")

	var stage := Node3D.new()
	stage.name = "DuelStage"
	root.add_child(stage)
	current_scene = stage
	var fc := Node.new()
	fc.name = "FakeFieldCombat"
	var gs := GDScript.new()   # 들판 적이 부르는 함수만(맞아도 아무 일 없음)
	gs.source_code = "extends Node
signal party_wiped
func can_be_targeted() -> bool:
	return false
func take_damage(_a: float, _s: Node) -> void:
	pass
"
	gs.reload()
	fc.set_script(gs)
	fc.add_to_group("go_field_combat")
	stage.add_child(fc)
	var pl := CharacterBody3D.new()
	pl.add_to_group("player")
	stage.add_child(pl)
	var PS: Node = root.get_node("PartyState")
	var saved_members: Array = (PS.members as Array).duplicate(true)
	var hero := "kr_yisunsin"
	var rarity := int((preload("res://saga_core/data/characters.gd").find(hero) as Dictionary).rarity)

	# ③
	var enc := _enc(stage, hero, pl)
	enc.call("_do_appeal", "might")
	await process_frame
	var foe := stage.get_node_or_null(hero)
	var lab: String = ""
	if foe != null:
		for l in foe.find_children("*", "Label3D", true, false):
			lab += (l as Label3D).text + " "
	var body: Node3D = enc.get("_body")
	var layer: Variant = enc.get("_layer")
	check(foe != null and int(enc.call("duel_count")) == 1 + (HD.camp(rarity).minions as Array).size() and lab.contains(String(enc.get("_hero").name)) and not body.visible and (layer == null or not is_instance_valid(layer)),
		"③ 무 → 판 %d(★%d) · 이름표 「%s」 · 서 있던 몸 숨김 · 창 닫힘" % [int(enc.call("duel_count")), rarity, lab.strip_edges()])
	var enc2 := _enc(stage, "sg_guanyu", pl)
	enc2.call("_do_appeal", "wisdom")
	check(int(enc2.call("duel_count")) == 0 and int(enc2.get("_persuade").round_num) >= 1, "③ 지 → 옛 굴림(판 없음)")
	enc2.queue_free()

	# ④
	foe.set("hp", 0.0)
	foe.call("_die")
	await process_frame
	await process_frame
	check(PS.members.has(hero) and not is_instance_valid(enc) and stage.get_node_or_null(hero) == null, "④ 인물 쓰러뜨림 → 등용 · 판 걷힘")

	# ⑤
	var enc3 := _enc(stage, "sg_zhangfei", pl)
	enc3.call("_do_appeal", "might")
	await process_frame
	var n3: int = enc3.call("duel_count")
	pl.global_position = enc3.global_position + Vector3(40, 0, 0)
	await process_frame
	await process_frame
	check(n3 >= 1 and int(enc3.call("duel_count")) == 0 and (enc3.get("_body") as Node3D).visible and not bool(enc3.get("_triggered")) and is_instance_valid(enc3),
		"⑤ 40m 멀어짐 → 물러남(몸 다시·처음부터)")

	# ⑥
	pl.global_position = enc3.global_position + Vector3(0, 0, 3)
	enc3.call("_on_body_entered", pl)
	enc3.call("_do_appeal", "might")
	await process_frame
	fc.emit_signal("party_wiped")
	await process_frame
	await process_frame
	check(not is_instance_valid(enc3) and not PS.members.has("sg_zhangfei"), "⑥ 명단 전멸 → 떠남(등용 없음)")

	# ⑦
	OS.set_environment("SAGA_HERO_DUEL", "0")
	var enc4 := _enc(stage, "sg_zhaoyun", pl)
	enc4.call("_do_appeal", "might")
	OS.set_environment("SAGA_HERO_DUEL", "")
	check(int(enc4.call("duel_count")) == 0, "⑦ SAGA_HERO_DUEL=0 → 무도 옛 굴림")

	PS.members = saved_members
	stage.queue_free()
	await process_frame
	print("PROBE hero_duel ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
