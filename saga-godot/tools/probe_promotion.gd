extends Node
## GO 승급 3택(101-2 ②: data/perks.gd 특성 12 · PartyState.add_perk·배율 · test_village.gd::_on_party_level_up 카드) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_PROMOTION_PROBE 가 있을 때만 단다. 진짜 세이브는 안 건드린다(특성·경험치는 끝에 되돌림).
##
##   SAGA_PROMOTION_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 표: 특성 12 = 축 셋(공·수·보)×4 · id 겹침 0 · 효과는 배율만(양수) ② roll_three: 아무것도 없으면 축마다 하나 3장 · 가진 것·가진 축 풀 소진은 빼고 ·
## 12 다 가지면 빈 배열(무작위 300회) ③ 효과: add_perk 가 그 축 배율만 올리고(공격 +8%) 두 번 줘도 한 번 ④ 카드: 레벨업 신호가 이어져 있고
## 카드 4장(특성 3+거절)이 뜨며 특성을 고르면 더해지고 · 거절하면 경험치만 오르고 · 풀을 다 가졌으면 카드가 안 뜬다. 끝에 PROMOTION_PROBE_DONE fails=N.

const Perks := preload("res://games/saga_go/data/perks.gd")
const TRIALS := 300

var _scene: Node
var _fails := 0


func _ready() -> void:
	Weather.force("clear")
	_scene = get_tree().current_scene
	_run.call_deferred()


func _frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("PROMOTION_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _layers() -> Array:
	var out := []
	for c in _scene.get_children():
		if c is CanvasLayer and c.find_children("*", "Button", true, false).size() >= 2:
			out.append(c)
	return out


func _run() -> void:
	await _frames(4)
	seed(20260824)
	var saved_perks: Array = PartyState.perks.duplicate()
	var saved_exp: float = PartyState.exp

	# ① 표
	var per_axis := {"attack": 0, "defense": 0, "support": 0}
	var ids := {}
	var mul_ok := true
	for p in Perks.PERKS:
		per_axis[p.axis] = int(per_axis.get(p.axis, 0)) + 1
		ids[p.id] = true
		mul_ok = mul_ok and float(p.mul) > 0.0 and Perks.AXIS_LABEL.has(p.axis)
	_check("table", Perks.PERKS.size() == 12 and ids.size() == 12 and per_axis.values() == [4, 4, 4] and mul_ok, str(per_axis))

	# ② roll_three
	var all_ids: Array = Perks.PERKS.map(func(p: Dictionary) -> String: return p.id)
	var ok_rules := true
	var ok_empty3 := true
	for i in TRIALS:
		var have: Array = []
		for id in all_ids:
			if randf() < 0.35:
				have.append(id)
		var got: Array = Perks.roll_three(have)
		var axes := {}
		for g in got:
			ok_rules = ok_rules and not have.has(g.id) and not axes.has(g.axis)
			axes[g.axis] = true
		ok_rules = ok_rules and got.size() <= 3
		var none: Array = Perks.roll_three([])
		ok_empty3 = ok_empty3 and none.size() == 3
	var attack_ids: Array = all_ids.slice(0, 4)
	var no_attack: Array = Perks.roll_three(attack_ids)
	var attack_skipped := no_attack.size() == 2
	for g in no_attack:
		attack_skipped = attack_skipped and g.axis != "attack"
	_check("roll_three", ok_rules and ok_empty3 and attack_skipped and Perks.roll_three(all_ids).is_empty(), "%d회 · 아무것도 없으면 3장 · 공격 풀 소진 → %d장 · 다 가지면 빈 배열" % [TRIALS, no_attack.size()])

	# ③ 효과
	PartyState.perks.clear()
	PartyState.add_perk("cheolbyeok")  # 수 — 공격엔 영향 없어야 한다
	var atk0: float = PartyState.atk_mul()
	var def0: float = PartyState.def_mul()
	PartyState.add_perk("gangyeok")
	PartyState.add_perk("gangyeok")
	var up_atk := PartyState.atk_mul() / atk0
	_check("perk_effect", absf(up_atk - 1.08 / 1.0) < 0.0001 and is_equal_approx(PartyState.def_mul(), def0) and PartyState.perks.count("gangyeok") == 1, "공격 배율 ×%.3f · 수비 불변 · 중복 없음" % up_atk)

	# ④ 카드
	PartyState.perks.clear()
	_check("signal_wired", PartyState.level_up.is_connected(_scene._on_party_level_up), "PartyState.level_up → _on_party_level_up")
	var before := _layers().size()
	_scene._on_party_level_up(5)
	await _frames(2)
	var layers := _layers()
	var card: CanvasLayer = layers[layers.size() - 1] if layers.size() > before else null
	var btns: Array = card.find_children("*", "Button", true, false) if card != null else []
	_check("card_shown", card != null and btns.size() == 4, "버튼 %d개(특성 3 + 거절)" % btns.size())
	if btns.size() == 4:
		btns[0].emit_signal("pressed")
		await _frames(2)
		_check("pick", PartyState.perks.size() == 1 and (not is_instance_valid(card) or card.is_queued_for_deletion()), str(PartyState.perks))
		var exp_before: float = PartyState.exp
		var perks_before := PartyState.perks.size()
		_scene._on_party_level_up(6)
		await _frames(2)
		layers = _layers()
		var card2: CanvasLayer = layers[layers.size() - 1]
		var btns2: Array = card2.find_children("*", "Button", true, false)
		btns2[btns2.size() - 1].emit_signal("pressed")  # 거절
		await _frames(2)
		_check("reject", PartyState.perks.size() == perks_before and PartyState.exp >= exp_before + PartyState.REJECT_EXP - 0.01, "경험치 +%.1f" % (PartyState.exp - exp_before))
	PartyState.perks.assign(all_ids)
	var n_before := _layers().size()
	_scene._on_party_level_up(7)
	await _frames(2)
	_check("pool_exhausted", _layers().size() == n_before, "12 다 가지면 카드 없음")

	PartyState.perks.assign(saved_perks)
	PartyState.call("_recompute")  # 되돌린 특성으로 배율 다시 계산
	PartyState.exp = saved_exp
	print("PROMOTION_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
