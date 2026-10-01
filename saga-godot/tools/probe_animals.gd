extends Node
## GO 마을 동물(world/animal_builder.gd — 사슴·까치·잉어·소 + 도감 "beast" 발견) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_ANIMALS_PROBE 가 있을 때만 단다. 진짜 세이브는 안 건드린다(도감·시각·플레이어 자리는 끝에 되돌림).
##
##   SAGA_ANIMALS_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 마릿수: 사슴 3·까치 자리 2·잉어 3·소 자리 2 ② 낮에 가까이 가면 각 종이 도감(beast)에 처음 한 번 찍힘 — 사슴·잉어는 사람에게서 달아나고,
## 까치는 날아가(숨고 쿨다운) 소는 제자리 ③ 낮엔 넷 다 보이고, 밤엔 사슴·까치·소는 숨고 잉어만 남는다(웹판 only:'day' 규칙).
## 끝에 ANIMALS_PROBE_DONE fails=N.

const Builder := preload("res://games/saga_go/world/animal_builder.gd")

var _scene: Node
var _p: Node3D
var _a: Node
var _fails := 0


func _ready() -> void:
	Weather.force("clear")
	_scene = get_tree().current_scene
	_p = get_tree().get_first_node_in_group("player")
	_run.call_deferred()


func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("ANIMALS_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _builder() -> Node:
	for c in _scene.get_children():
		var s: Script = c.get_script()
		if s != null and s.resource_path.ends_with("/animal_builder.gd"):
			return c
	return null


func _dist(n: Node3D) -> float:
	return n.global_position.distance_to(_p.global_position)


func _run() -> void:
	await _frames(4)
	_a = _builder()
	var saved_book: Dictionary = CodexState.book.duplicate()
	var saved_pos := _p.global_position
	var saved_exp: float = PartyState.exp
	_p.set_physics_process(false)  # 점검이 자리를 정한다(중력·입력이 끼어들지 않게)

	# ① 마릿수
	_check("counts", _a != null and _a._deer.size() == Builder.DEER_COUNT and _a._magpies.size() == Builder.MAGPIE_HOMES.size() \
		and _a._carps.size() == Builder.CARP_COUNT and _a._oxen.size() == Builder.OX_HOMES.size(), "사슴 %d·까치 %d·잉어 %d·소 %d" % [_a._deer.size(), _a._magpies.size(), _a._carps.size(), _a._oxen.size()])

	# ③ 낮·밤 보임(멀리 떨어뜨려 놓고)
	_p.global_position = Vector3(5000, 0, 5000)
	TimeOfDay.force(false)
	await _frames(3)
	var day_ok: bool = _a._deer[0].node.visible and _a._magpies[0].node.visible and _a._carps[0].node.visible and _a._oxen[0].node.visible
	_check("day_visible", day_ok, "낮 — 넷 다 보임")
	TimeOfDay.force(true)
	await _frames(3)
	var night_ok: bool = (not _a._deer[0].node.visible) and (not _a._magpies[0].node.visible) and _a._carps[0].node.visible and (not _a._oxen[0].node.visible)
	_check("night_visible", night_ok, "밤 — 잉어만 남음")
	TimeOfDay.force(false)
	await _frames(2)

	# ② 가까이 — 종마다
	CodexState.restore({})
	var deer: Node3D = _a._deer[0].node
	_p.global_position = deer.global_position + Vector3(5, 0, 0)
	var d0 := _dist(deer)
	await get_tree().create_timer(1.0).timeout
	_check("deer", CodexState.has("beast", "deer") and _dist(deer) > d0 + 1.5, "발견 %s · 거리 %.1f→%.1f" % [CodexState.has("beast", "deer"), d0, _dist(deer)])

	CodexState.restore({})
	var carp: Node3D = _a._carps[0].node
	_p.global_position = carp.global_position + Vector3(4, 0, 0)
	var c0 := _dist(carp)
	await get_tree().create_timer(1.0).timeout
	_check("carp", CodexState.has("beast", "carp") and _dist(carp) > c0 + 1.0, "발견 %s · 거리 %.1f→%.1f" % [CodexState.has("beast", "carp"), c0, _dist(carp)])

	CodexState.restore({})
	var mag: Node3D = _a._magpies[0].node
	_p.global_position = mag.global_position + Vector3(4, 0, 0)
	await _frames(4)
	_check("magpie", CodexState.has("beast", "magpie") and not mag.visible and float(_a._magpies[0].cooldown) > 15.0, "발견 · 숨음 · 쿨다운 %.1f" % float(_a._magpies[0].cooldown))

	CodexState.restore({})
	var ox: Node3D = _a._oxen[0].node
	var ox_pos := ox.global_position
	_p.global_position = ox_pos + Vector3(5, 0, 0)
	await get_tree().create_timer(0.5).timeout
	_check("ox", CodexState.has("beast", "ox") and ox.global_position.distance_to(ox_pos) < 0.01, "발견 · 제자리")

	# 되돌리기
	TimeOfDay.force(null)
	CodexState.restore(saved_book)
	PartyState.exp = saved_exp
	_p.global_position = saved_pos
	_p.set_physics_process(true)
	print("ANIMALS_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
