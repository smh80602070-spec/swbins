extends SceneTree

## G-0255 전투 효과 셰이더 미리 데우기 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_fx_warm.gd   → "PROBE fx_warm OK" / "FAIL n"
## TestCity 를 띄워 데움이 끝난 프레임(실은 뒤 0.5초)에 CombatFx.last_warm.nodes ≥ 5 · 다음 프레임에 궤적·충격파 노드가 아직 있음(그려질 틈) · 1.0초 뒤 씬에 궤적·충격파 재질 노드 0(스스로 지움) ·
## 두 씬째(SinyaField)는 nodes 0(프로세스에 한 번) · SAGA_FX_WARM=0 이면 last_warm 빔. 헤드리스는 더미 렌더러라 노드 수만 — 그림은 촬영 몫.

const CombatFx := preload("res://saga_core/combat_fx.gd")
const SCENE_A := "res://games/saga_realm/world/TestCity.tscn"
const SCENE_B := "res://games/saga_story/world/SinyaField.tscn"

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _load(path: String) -> Node:
	var scene := (load(path) as PackedScene).instantiate()
	root.add_child(scene)
	current_scene = scene
	for _i in 3:
		await process_frame
	return scene


func _unload(scene: Node) -> void:
	scene.queue_free()
	await process_frame
	await process_frame


func _fx_left(scene: Node) -> int:
	var n := 0
	for c in scene.get_children():
		if c is GeometryInstance3D and (c as GeometryInstance3D).material_override is ShaderMaterial:
			var sh := ((c as GeometryInstance3D).material_override as ShaderMaterial).shader
			if sh == CombatFx.SLASH_SHADER or sh == CombatFx.RING_SHADER or sh == CombatFx.PILLAR_SHADER:
				n += 1
	return n


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var old := OS.get_environment("SAGA_FX_WARM")
	OS.set_environment("SAGA_FX_WARM", "")
	var a: Node = await _load(SCENE_A)
	var w0 := Time.get_ticks_msec()
	while CombatFx.last_warm.is_empty() and Time.get_ticks_msec() - w0 < 3000:
		await process_frame
	await process_frame
	var n := int(CombatFx.last_warm.get("nodes", -1))
	if n < 5:
		_fail("첫 씬 데운 노드 %d < 5 (%s)" % [n, CombatFx.last_warm])
	var left0 := _fx_left(a)
	if left0 < 1:
		_fail("데운 다음 프레임에 궤적·충격파 노드 없음 — 그려지기 전에 지워짐")
	var t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 1000:
		await process_frame
	var left := _fx_left(a)
	if left != 0:
		_fail("1초 뒤 궤적·충격파 노드 %d 남음" % left)
	print("FXWARM first nodes=%d fx_at_3f=%d fx_after_1s=%d" % [n, left0, left])
	await _unload(a)
	var b: Node = await _load(SCENE_B)
	var n2 := int(CombatFx.last_warm.get("nodes", -1))
	if n2 != 0:
		_fail("두 씬째 데운 노드 %d (한 번만이어야)" % n2)
	print("FXWARM second nodes=%d" % n2)
	await _unload(b)
	# 끄기 손잡이 — 처음 상태로 되돌려 다시 싣는다.
	OS.set_environment("SAGA_FX_WARM", "0")
	CombatFx._warmed = false
	CombatFx.last_warm = {}
	var c: Node = await _load(SCENE_B)
	var w2 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - w2 < 1000:
		await process_frame
	if not CombatFx.last_warm.is_empty():
		_fail("SAGA_FX_WARM=0 인데 last_warm %s" % CombatFx.last_warm)
	await _unload(c)
	OS.set_environment("SAGA_FX_WARM", old)
	print("PROBE fx_warm ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
