extends SceneTree

## G-0253 5천하 전술판 타격 VFX 자동 점검 — 공용 combat_fx(베기 궤적·불꽃·바닥 충격파)가 전술판 공격 연출에서 나오는지.
##   godot --headless --path saga-godot --script res://tools/probe_realm_tactics_fx.gd
## 판은 규칙 함수로 메모리에서만 만든다(세이브 안 건드림). 무대(current_scene)에 View 를 띄워 cut_cam=false 로 공격 기록 셋을 연출:
## ① 맞음 → 궤적 메시(SLASH_SHADER) 1 · 불꽃 입자 ≥1 · 충격파 0 ② 빗나감 → 궤적 1 · 불꽃 0 ③ 쓰러짐 → 충격파(RING_SHADER) 1
## ④ 실제 시간 1.2초 뒤 그림 노드 0(스스로 지움) ⑤ instant=true → 그림 노드 0 · 턴 끝만 돌린 결과 = 규칙만 돌린 결과
## 끝에 "PROBE realm_tactics_fx OK" 또는 "PROBE realm_tactics_fx FAIL n".

const SLASH_SHADER := preload("res://saga_core/shaders/slash_trail.gdshader")
const RING_SHADER := preload("res://saga_core/shaders/shock_ring.gdshader")
const STATS := {"sg_xiahoudun": {"might": 90, "wisdom": 50, "command": 80}, "sg_zhangliao": {"might": 85, "wisdom": 60, "command": 80}}

var fails := 0
var seen := {"slash": 0, "spark": 0, "ring": 0}


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _shader_of(n: Node) -> Shader:
	if n is MeshInstance3D and (n as MeshInstance3D).material_override is ShaderMaterial:
		return ((n as MeshInstance3D).material_override as ShaderMaterial).shader
	return null


func _kind(n: Node) -> String:
	if n is CPUParticles3D:
		return "spark"
	var sh := _shader_of(n)
	if sh == SLASH_SHADER:
		return "slash"
	if sh == RING_SHADER:
		return "ring"
	return ""


func _on_child(n: Node) -> void:
	var k := _kind(n)
	if k != "":
		seen[k] += 1


func _fx_alive(stage: Node) -> int:
	return stage.get_children().filter(func(c): return _kind(c) != "").size()


func _board() -> Dictionary:
	var T: GDScript = load("res://games/saga_realm/data/realm_tactics.gd")
	var b: Dictionary = T.make_board("g-0253", "plain", false)
	T.units_of(b, ["sg_xiahoudun"], ["sg_zhangliao"], [800], STATS)
	return b


func _reset_seen() -> void:
	for k in seen:
		seen[k] = 0


func _initialize() -> void:
	await process_frame
	seed(20260824)
	var View: GDScript = load("res://games/saga_realm/world/realm_tactics_view.gd")
	var T: GDScript = load("res://games/saga_realm/data/realm_tactics.gd")
	var stage := Node3D.new()
	root.add_child(stage)
	current_scene = stage
	stage.child_entered_tree.connect(_on_child)
	var saved_cut: bool = View.cut_cam
	View.cut_cam = false

	var b := _board()
	var view: Node = View.open(stage, "x", {"board": b, "mine": ["sg_xiahoudun"]}, func(_g: Dictionary) -> void: pass, false)
	await process_frame
	var me := "me:sg_xiahoudun"
	var foe := "foe:sg_zhangliao"
	var foe_max := float(T.unit(b, foe).max)
	var cam0: Transform3D = view._cam.global_transform
	_reset_seen()
	await view._anim_hit({"a": me, "to": foe, "hit": true, "dmg": int(foe_max * 0.4)})
	check(seen.slash == 1 and seen.spark >= 1 and seen.ring == 0, "① 맞음 → 궤적 %d · 불꽃 %d · 충격파 %d" % [seen.slash, seen.spark, seen.ring])
	check(view._cam.global_transform.is_equal_approx(cam0), "① cut_cam 끔 → 카메라 그대로(흔들림 없음)")
	_reset_seen()
	await view._anim_hit({"a": me, "to": foe, "hit": false, "dmg": 0})
	check(seen.slash == 1 and seen.spark == 0 and seen.ring == 0, "② 빗나감 → 궤적 %d · 불꽃 %d(없어야) · 충격파 %d" % [seen.slash, seen.spark, seen.ring])
	check(view._swing_n == 2, "② 연타 셈 %d = 2" % view._swing_n)
	_reset_seen()
	await view._anim_hit({"a": me, "to": foe, "hit": true, "dmg": int(foe_max)})
	var tn: Node3D = view._units[foe].node
	check(seen.slash == 1 and seen.spark >= 1 and seen.ring == 1 and not tn.visible, "③ 쓰러짐 → 궤적 %d · 불꽃 %d · 충격파 %d · 몸 숨김 %s" % [seen.slash, seen.spark, seen.ring, str(not tn.visible)])

	## create_timer 는 첫 프레임 delta 에 바로 끝날 수 있다 — 실제 시간으로 1.2초 프레임을 돈다(G-0200).
	var on := _fx_alive(stage)
	var t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 1200:
		await process_frame
	check(_fx_alive(stage) == 0, "④ 그림 노드는 1.2초 안에 스스로 지워짐 %d → %d" % [on, _fx_alive(stage)])
	view._on_cancel()
	await process_frame

	## ⑤ instant — 그림 0, 결과는 규칙만 돌린 것과 같다
	View.cut_cam = true
	var b2 := _board()
	var shadow: Dictionary = b2.duplicate(true)
	var guard := 0
	while T.outcome(shadow).is_empty() and guard < 10:
		guard += 1
		T.ai_turn(shadow)
	var expect: Dictionary = T.outcome(shadow)
	var got := {"grid": null}
	_reset_seen()
	var v2: Node = View.open(stage, "x", {"board": b2, "mine": ["sg_xiahoudun"]}, func(g: Dictionary) -> void: got.grid = g, true)
	await process_frame
	await v2._anim_hit({"a": me, "to": foe, "hit": true, "dmg": 1})
	await v2._anim_hit({"a": me, "to": foe, "hit": false, "dmg": 0})
	v2._units[foe].hp = float(foe_max)   # 화면 hp 만 되돌림(판 규칙은 그대로)
	for k in 6:
		if String(b2.done) != "" and got.grid != null:
			break
		await v2._on_end_turn()
	var o2: Dictionary = T.outcome(b2)
	check(seen.slash == 0 and seen.spark == 0 and seen.ring == 0 and v2.cut_count == 0, "⑤ instant → 그림 노드 0(궤적 %d·불꽃 %d·충격파 %d)·컷 %d" % [seen.slash, seen.spark, seen.ring, v2.cut_count])
	check(not expect.is_empty() and String(o2.get("kind", "?")) == String(expect.kind) and b2.log == shadow.log, "⑤ instant 결과 = 규칙만(%s · 기록 %d줄 같음)" % [expect.get("kind", "?"), (shadow.log as Array).size()])
	if is_instance_valid(v2) and not v2._closed:
		v2._on_cancel()
	await process_frame
	View.cut_cam = saved_cut
	print("PROBE realm_tactics_fx OK" if fails == 0 else "PROBE realm_tactics_fx FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
