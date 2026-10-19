extends Node
## GO 몰래 다가가 포획(G-0230 · world/pet_encounter.gd · player/go_player.gd 웅크리기) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_SNEAK_CATCH_PROBE 가 있을 때만 단다.
##
##   SAGA_SNEAK_CATCH_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 확률식(몰래 +15%p·상한 95%·몰래 아니면 원래 식) ② 시야 부채꼴(앞 100°·12m) ③ 표 temper 둘 다 있음
## ④ 앞 8m 달림 → 들킴 · 걸음 → 안 들킴 · 등 뒤 → 안 들킴·몰래 ⑤ 웅크리면 진짜 입력으로도 달리기가 안 되고 느려짐
## ⑥ timid: 시야 안을 달려 지나가면 ❗ → 1초 뒤 사라짐 ⑦ fierce: 들킴 → "성난 <신수>" 들판 적 → 쓰러뜨리면 신수가 다시 나타남.
## EventState·플레이어 자리·입력은 끝에 되돌린다.

const PetEnc := preload("res://games/saga_go/world/pet_encounter.gd")
const Pets := preload("res://saga_core/data/pets.gd")

var _p: CharacterBody3D
var _fails := 0


func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player") as CharacterBody3D
	_run.call_deferred()


func _frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("SNEAK_CATCH_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _pet_of(temper: String) -> Node3D:
	for n in get_tree().get_nodes_in_group("go_pets"):
		var pet: Variant = n.get("_pet")
		if pet is Dictionary and String((pet as Dictionary).get("temper", "")) == temper and n.visible:
			return n as Node3D
	return null


func _flat_speed() -> float:
	return Vector2(_p.velocity.x, _p.velocity.z).length()


func _run() -> void:
	await _frames(4)
	var start := _p.global_position
	var resolved_before: Array[String] = EventState.resolved.duplicate()

	# ① 확률식
	var c0 := PetEnc.catch_chance(0.2, 1.0, false)
	var c1 := PetEnc.catch_chance(0.2, 1.0, true)
	var c2 := PetEnc.catch_chance(0.9, 1.0, true)
	var c3 := PetEnc.catch_chance(0.2, 1.5, false)
	_check("chance", is_equal_approx(c0, 0.2) and is_equal_approx(c1, 0.35) and is_equal_approx(c2, 0.95) and is_equal_approx(c3, 0.3),
		"base=%.2f sneak=%.2f cap=%.2f star=%.2f" % [c0, c1, c2, c3])

	# ② 시야
	var o := Vector3.ZERO
	var h := Vector3(0, 0, 1)
	var f := [PetEnc.in_fov(o, h, Vector3(0, 3, 8)), PetEnc.in_fov(o, h, Vector3(0, 0, 13)), PetEnc.in_fov(o, h, Vector3(0, 0, -5)),
		PetEnc.in_fov(o, h, Vector3(sin(deg_to_rad(45.0)) * 8.0, 0, cos(deg_to_rad(45.0)) * 8.0)),
		PetEnc.in_fov(o, h, Vector3(sin(deg_to_rad(60.0)) * 8.0, 0, cos(deg_to_rad(60.0)) * 8.0))]
	_check("fov", f == [true, false, false, true, false], "front/far/behind/45°/60° = %s" % [f])

	# ③ 표
	var tempers := {}
	for pt: Dictionary in Pets.PETS:
		tempers[String(pt.get("temper", "?"))] = true
	_check("temper", tempers.keys().size() == 2 and tempers.has("timid") and tempers.has("fierce"), "%s" % [tempers.keys()])

	var timid := _pet_of("timid")
	var fierce := _pet_of("fierce")
	if timid == null or fierce == null:
		_check("pets", false, "timid=%s fierce=%s" % [timid, fierce])
		print("SNEAK_CATCH_PROBE_DONE fails=%d" % _fails)
		get_tree().quit()
		return

	# ④ 판정
	var hd: Vector3 = timid.call("heading")
	var front := timid.global_position + hd * 8.0
	var back := timid.global_position - hd * 8.0
	var n_run := bool(timid.call("notices", front, true))
	var n_walk := bool(timid.call("notices", front, false))
	var n_back := bool(timid.call("notices", back, true))
	var s_back := bool(timid.call("sneaking", back))
	var s_front := bool(timid.call("sneaking", front))
	_check("notice", n_run and not n_walk and not n_back and s_back and s_front == PetEnc.in_grass(front),
		"run=%s walk=%s back=%s sneak_back=%s sneak_front=%s grass=%s" % [n_run, n_walk, n_back, s_back, s_front, PetEnc.in_grass(front)])

	# ⑤ 웅크리기(진짜 입력) — 달리기 → 웅크림 → 달리기가 꺼지고 느려진다
	_p.global_position = start
	Input.action_press("move_forward")
	await _frames(6)
	Input.action_press("run")
	await _frames(40)
	var ran := bool(_p.get("is_running"))
	var v_run := _flat_speed()
	_p.call("set_crouch", true)
	await _frames(30)
	var ran_c := bool(_p.get("is_running"))
	var v_c := _flat_speed()
	_check("crouch", ran and not ran_c and bool(_p.get("crouching")) and v_c < v_run * 0.5 and v_c > 0.5,
		"run=%s v=%.1f → crouch run=%s v=%.1f" % [ran, v_run, ran_c, v_c])
	_p.call("set_crouch", false)
	await _frames(30)

	# ⑥ timid — 달리는 채로 앞 6m 에 놓으면 다음 틱에 들킨다(조우 원 9m 안이라 창이 열려도 닫는다)
	var tname := String(timid.name)
	_p.global_position = timid.global_position + hd * 6.0 + Vector3.UP * 0.5
	await _frames(3)
	var spotted := bool(timid.get("_spotted"))
	var mark := timid.get_node_or_null("SpotMark") != null
	var layer_closed := timid.get("_layer") == null
	Input.action_release("run")
	Input.action_release("move_forward")
	_p.global_position = start
	await get_tree().create_timer(1.3).timeout
	_check("timid", spotted and mark and layer_closed and not is_instance_valid(timid) and EventState.is_resolved(tname),
		"spotted=%s mark=%s closed=%s gone=%s resolved=%s" % [spotted, mark, layer_closed, not is_instance_valid(timid), EventState.is_resolved(tname)])

	# ⑦ fierce — 들킴 → 성난 들판 적 → 쓰러뜨리면 다시 나타남
	_p.global_position = start
	fierce.call("spot")
	await _frames(2)
	var foe: Node = fierce.get("foe")
	var foe_ok := foe != null and foe.is_in_group("field_enemy") and String(foe.get("def").name).begins_with("성난 ")
	var hidden := not fierce.visible
	if foe != null:
		foe.set("drops", false)
		foe.call("_die")
	await _frames(2)
	_check("fierce", foe_ok and hidden and fierce.visible and fierce.get("foe") == null and not is_instance_valid(foe),
		"foe=%s hidden=%s back=%s" % [foe_ok, hidden, fierce.visible])

	EventState.restore(resolved_before)
	_p.global_position = start
	print("SNEAK_CATCH_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
