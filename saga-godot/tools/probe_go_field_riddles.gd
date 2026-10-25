extends SceneTree

## G-0387 1만리 들판 수수께끼(world/go_field_riddles.gd) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_go_field_riddles.gd   → "PROBE go_field_riddles OK" / "FAIL n"
## ① 자리: 열 지역 × 여섯(54 이상) · 두 번 셈 같음 · 모두 걸을 칸·물 위 아님 ② 마을에 붙음
## ③ 외딴 돌: 1.4m 안에 서면 들춤 ④ 꽃 고리: 다섯을 차례로 밟으면 풂 ⑤ 바람개비: 바람 받는 쪽 2m 에 2초 서면 풂
## ⑥ 씨앗 5 에 별조각 shard_rd5 ⑦ 「오늘」 창 줄 ⑧ 손잡이 0 = 안 붙음. 넣은 EventState 기록은 끝에 지운다(세이브 오염 막기).

const TM := preload("res://games/saga_go/data/test_map.gd")
const TB := preload("res://games/saga_go/world/terrain_builder.gd")
## 판 스크립트는 자동 로드(EventState 등)를 써서 const preload 면 컴파일이 깨진다 — _initialize 에서 load().
var FR: GDScript
var GA: GDScript
var ES: Node

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _wait(sec: float) -> void:
	await create_timer(sec).timeout


func _put(pl: Node3D, p: Vector3) -> void:
	pl.global_position = p + Vector3(0, 0.6, 0)
	pl.set("velocity", Vector3.ZERO)


func _initialize() -> void:
	await process_frame
	FR = load("res://games/saga_go/world/go_field_riddles.gd")
	GA = load("res://games/saga_go/ui/goals_adapter.gd")
	ES = root.get_node("EventState")
	var before: Array = ES.resolved.duplicate()
	var sp: Array = FR.spots()
	var bad := 0
	for s: Dictionary in sp:
		var p: Vector3 = s.pos
		var g := TM.grid_at(String(s.region), p)
		if not TB.LEGEND[TM.tile_at(g.x, g.y, String(s.region))].walkable or p.y < TB.WATER_LEVEL - 0.1:
			bad += 1
	check(sp.size() >= 54 and bad == 0, "① 자리 %d 개 · 걸을 칸 아님 %d" % [sp.size(), bad])
	FR.set("_spots_cache", [])
	var sp2: Array = FR.spots()
	check(sp2.size() == sp.size() and (sp2[0].pos as Vector3).is_equal_approx(sp[0].pos), "① 두 번 셈 같음(결정적)")

	var sc := (load("res://games/saga_go/world/TestVillage.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for i in 8:
		await process_frame
	paused = false
	var fr := sc.get_node_or_null("FieldRiddles")
	var pl := get_first_node_in_group("player") as Node3D
	check(fr != null and pl != null, "② 마을에 붙음")
	if fr == null or pl == null:
		print("PROBE go_field_riddles FAIL %d" % fails)
		quit(1)
		return
	var pick := func(kind: String) -> Dictionary:
		for s: Dictionary in sp:
			if s.region == "village" and s.kind == kind and not FR.solved(String(s.id)):
				return s
		return {}
	var n0: int = FR.seeds()

	var st: Dictionary = pick.call("stone")
	_put(pl, st.pos)
	await _wait(0.9)
	check(FR.solved(String(st.id)), "③ 외딴 돌 들춤(%s)" % st.id)

	var rg: Dictionary = pick.call("ring")
	for i in 5:
		_put(pl, FR.ring_flower_pos(rg.pos, float(rg.yaw), i))
		await _wait(0.25)
	await _wait(0.2)
	check(FR.solved(String(rg.id)), "④ 꽃 고리 다섯 밟음(%s)" % rg.id)

	var pn: Dictionary = pick.call("pin")
	var a := deg_to_rad(float(pn.yaw))
	_put(pl, (pn.pos as Vector3) + Vector3(sin(a), 0, cos(a)) * 2.0)
	await _wait(2.6)
	check(FR.solved(String(pn.id)), "⑤ 바람개비 앞 2초(%s)" % pn.id)

	check(FR.seeds() == n0 + 3, "③④⑤ 씨앗 %d → %d" % [n0, FR.seeds()])
	var k := 0
	for s: Dictionary in sp:
		if FR.seeds() >= 5:
			break
		if not FR.solved(String(s.id)):
			fr.call("solve", String(s.id))
			k += 1
	check(ES.is_resolved("shard_rd5"), "⑥ 씨앗 5 → 별조각 shard_rd5")

	var model: Dictionary = GA.model(sc)
	var has_line := false
	for row: Dictionary in model.today:
		if String(row.label).contains("들판 수수께끼"):
			has_line = true
	check(has_line, "⑦ 「오늘」 창 줄")

	OS.set_environment("SAGA_RIDDLES", "0")
	check(FR.attach(Node.new()) == null, "⑧ 0 = 안 붙음")
	OS.set_environment("SAGA_RIDDLES", "")

	ES.resolved.assign(before)
	print("PROBE go_field_riddles ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
