extends Node
## GO 이야기 6부(PLAN 106장 ㊿, 21장~) 자동 점검 — 평소엔 안 붙는다. 5부 probe_story5.
## test_village.gd 가 SAGA_STORY6_PROBE 가 있을 때만 단다.
##
##   SAGA_STORY6_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## 21장 "바다 밑 등불"(㊿-2, world/region7_sunken.gd): [1] 표·자리(여울 현대·잠수 마스크 · 선착장 칸 = dock_pos · 판 위·기단 위 자리 높이 ·
## 무리 칸이 모래 · 자리가 명소에 안 묻힘 · 물속 불빛이 20장 뒤에 켜짐 · 선장은 은하 나루 별배 곁) [2] 선장 → 별배
## [3] 별배 타기(잠긴 도읍 모래밭에 내림) [4] 반디(모래밭) → 기지 앞 [5] 물짐승 넷이 모래 위 [6] 잔교 끝 선착장 판에 서면 넘어간다(헤엄 아님)
## [7] 여울(판 위) → 잠수정 [8] 잠수정 타기(궁궐 기단 위에 내려 섬) [9] 여울(기단 위) → 21장 끝·보상·✔ 제21장·자리(ch_to).
## 이야기 상태·부대 경험·가방은 끝에 되돌린다. 저장은 안 한다.

const Story := preload("res://games/saga_go/data/story.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Sunken := preload("res://games/saga_go/world/region7_sunken.gd")

const CH21 := 20 # 21장(0부터)
const R := "sunken"

var _p: CharacterBody3D
var _sq: Node
var _frame := 0
var _step := 0
var _fails := 0
var _v: Variant = null
var _saved := {}

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player") as CharacterBody3D

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _sq == null:
		_sq = get_tree().get_first_node_in_group("go_story")
		_frame = 0
		return
	if _frame < 3 and _step == 0:
		return
	match _step:
		0: # 준비 — 21장 처음, 모험 등급 49
			_saved = {"story": PartyState.story.duplicate(true), "members": PartyState.members.duplicate(), "exp": PartyState.exp, "level": PartyState.level,
				"bag": PartyState.bag.duplicate(true), "ar_paid": PartyState.ar_paid, "resolved": EventState.resolved.duplicate(), "pos": _p.global_position, "wq": PartyState.world_quests.duplicate(true)}
			PartyState.exp = maxf(PartyState.exp, 49.0 * PartyState.EXP_PER_LEVEL)
			PartyState.level = maxi(PartyState.level, 49)
			PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
			PartyState.story = {"ch": CH21, "step": 0}
			_sq.call("set_track", "")
			_sq.call("_enter_step")
			_next()
		1: # [1] 표·자리
			if _frame < 70: # 지역 파일은 1초마다 장을 본다
				return
			var c := Story.chapter(CH21)
			var steps: Array = c.steps
			var bad: Array = []
			if String(c.get("id", "")) != "ch21" or int(c.ar) <= int(Story.chapter(CH21 - 1).ar) or int(_sq.call("ch")) != CH21 or bool(_sq.call("locked")) or steps.size() != 8:
				bad.append("chapter ch=%d locked=%s steps=%d" % [_sq.call("ch"), _sq.call("locked"), steps.size()])
			var info: Dictionary = Story.NPCS.yeoul
			if String(info.region) != R or String(info.get("era", "")) != "현대" or not bool(info.get("goggles", false)):
				bad.append("yeoul info")
			var yo := _sq.find_child("StoryNpc_yeoul", true, false)
			if yo == null or yo.find_child("Goggles", true, false) == null:
				bad.append("yeoul body")
			## 선착장 — go 칸·여울 자리가 dock_pos 와 2m 안, 자리 높이가 판 윗면.
			var dock := Sunken.dock_pos()
			var go: Dictionary = steps[4]
			var yw: Array = Story.windows(Story.STATIONS.yeoul)
			if String(go.type) != "go" or _flat(_cell_any(R, go.cell), dock) > 2.0 or _flat(_spot(yw[0]), dock) > 2.0 or absf(_spot(yw[0]).y - Sunken.DECK_Y) > 0.1:
				bad.append("dock go=%s yeoul=%s dock=%s" % [_cell_any(R, go.cell), _spot(yw[0]), dock])
			## 잠수정 내리는 자리·기단 위 자리 높이 = 기단 윗면.
			var sub: Dictionary = steps[6]
			for d in [sub.to, yw[1], yw[2]]:
				if absf(_spot(d).y - Sunken.TERRACE_Y) > 0.1 or _surface(_spot(d)) < Sunken.TERRACE_Y - 0.1:
					bad.append("terrace spot %s y=%.2f surf=%.2f" % [d.cell, _spot(d).y, _surface(_spot(d))])
			var kill: Dictionary = steps[3]
			if TestMap.tile_at(roundi(kill.cell.x), roundi(kill.cell.y), R) != "D":
				bad.append("kill tile")
			## 자리가 명소 충돌에 안 묻힘(별배 내리는 자리·인물 칸 전부).
			var spots: Array = [_spot(steps[1].to), _spot(sub.to), _cell_any(R, info.cell)]
			for w in Story.windows(Story.NPCS.hanbyeol.appear).filter(func(w: Dictionary) -> bool: return int(w.ch) >= CH21) \
					+ Story.windows(Story.STATIONS.bandi).filter(func(w: Dictionary) -> bool: return int(w.ch) >= CH21) + yw:
				spots.append(_spot(w))
			for sp in spots:
				if not _hits(sp).is_empty():
					bad.append("buried %s %s" % [sp, _hits(sp)])
			var su := get_tree().get_first_node_in_group("go_sunken_region")
			var lights := su.find_child("SeaLights", true, false) as Node3D
			if lights == null or not lights.visible or not Sunken.sea_lights_on():
				bad.append("sea lights")
			if _flat(_sq.call("npc_pos", "hanbyeol"), _cell_any("skyport", Vector2(5.2, 1.95))) > 1.0 or not bool(_sq.call("npc_visible", "hanbyeol")):
				bad.append("hanbyeol at skyport %s" % _sq.call("npc_pos", "hanbyeol"))
			_check("ch21_table", bad.is_empty(), str(bad))
			_next()
		2: # [2] 선장(은하 나루) → 별배
			_talk("hanbyeol", 1, "ch21_hanbyeol", Vector2.INF)
		3: # [3] 별배 타기 — 선장에게 F → 잠긴 도읍 모래밭
			if _frame == 1:
				_near_npc("hanbyeol")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 20:
				var here := TestMap.region_at(_p.global_position)
				var ok: bool = int(_sq.call("st")) == 2 and here == R and _flat(_p.global_position, _cell_any(R, Vector2(2.9, 1.7))) < 1.5
				_check("ch21_ship", ok, "st=%d region=%s pos=%s" % [_sq.call("st"), here, _p.global_position])
				_next()
		4: # [4] 반디(모래밭) → 기지 앞
			if _frame == 1:
				_v = _flat(_sq.call("npc_pos", "bandi"), _cell_any(R, Vector2(3.1, 1.55)))
			_talk("bandi", 3, "ch21_bandi", Vector2(6.0, 2.55), "bandi_at_beach=%.1f" % float(_v), float(_v) < 1.0, 1)
		5: # [5] 물짐승 넷 — 모래 위
			if _frame == 1:
				_put(_target() + Vector3(0, 0, -6))
			if _frame == 10:
				var es: Array = _sq.call("alive_quest_enemies")
				var dry := es.filter(func(e: Node) -> bool: return TestMap.region_at((e as Node3D).global_position) == R \
					and TerrainBuilder.height_at(R, (e as Node3D).global_position) > TerrainBuilder.WATER_LEVEL).size()
				_v = {"n": es.size(), "dry": dry}
				for e in es:
					e.call("_die")
			if _frame == 16:
				_check("ch21_kill", int(_v.n) == 4 and int(_v.dry) == 4 and int(_sq.call("st")) == 4, "n=%d dry=%d st=%d" % [_v.n, _v.dry, _sq.call("st")])
				_next()
		6: # [6] 잔교 끝 선착장 — 기지 갑판에선 안 넘어가고, 판 위에 서면 넘어간다. 서서 헤엄이 아니라 걷는다.
			var dock := Sunken.dock_pos()
			if _frame == 1:
				_put(Sunken.at(Sunken.BASE_CELL, Sunken.DECK_Y))
			if _frame == 12:
				_v = {"deck_st": int(_sq.call("st"))}
				_put(dock + Vector3(-1.5, 0, 0))
			if _frame == 50:
				var yp: Vector3 = _sq.call("npc_pos", "yeoul")
				var ok: bool = int(_v.deck_st) == 4 and int(_sq.call("st")) == 5 and _p.is_on_floor() and _p.mode == _p.Mode.GROUND \
					and absf(_p.global_position.y - Sunken.DECK_Y) < 0.3 and absf(yp.y - Sunken.DECK_Y) < 0.1 and _flat(yp, dock) < 2.0
				_check("ch21_dock", ok, "deck_st=%d st=%d floor=%s mode=%d y=%.2f yeoul=%s" % [_v.deck_st, _sq.call("st"), _p.is_on_floor(), _p.mode, _p.global_position.y, yp])
				_next()
		7: # [7] 여울(판 위) → 잠수정
			_talk("yeoul", 6, "ch21_yeoul", Vector2.INF)
		8: # [8] 잠수정 타기 — 여울에게 F → 궁궐 기단 위에 내려 선다
			if _frame == 1:
				_near_npc("yeoul")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 60:
				var yp: Vector3 = _sq.call("npc_pos", "yeoul")
				var bp: Vector3 = _sq.call("npc_pos", "bandi")
				var ok: bool = int(_sq.call("st")) == 7 and TestMap.region_at(_p.global_position) == R and _p.is_on_floor() and _p.mode == _p.Mode.GROUND \
					and absf(_p.global_position.y - Sunken.TERRACE_Y) < 0.3 and _flat(_p.global_position, _cell_any(R, Vector2(2.3, 4.87))) < 1.5 \
					and absf(yp.y - Sunken.TERRACE_Y) < 0.1 and absf(bp.y - Sunken.TERRACE_Y) < 0.1
				_check("ch21_sub", ok, "st=%d pos=%s floor=%s mode=%d yeoul=%s bandi=%s" % [_sq.call("st"), _p.global_position, _p.is_on_floor(), _p.mode, yp, bp])
				_next()
		9: # [9] 여울(기단 위) → 21장 끝
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("yeoul")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame < 16:
				return
			_dismiss_prompts()
			if _frame < 22:
				return
			_sq.call("toggle_journal")
			var jt: String = _sq.call("journal_text")
			_sq.call("toggle_journal")
			var cap: Vector3 = _sq.call("npc_pos", "hanbyeol")
			var yp: Vector3 = _sq.call("npc_pos", "yeoul")
			var ok: bool = int(_sq.call("ch")) == CH21 + 1 and jt.contains("✔ 제21장") and PartyState.count("mora") >= int(_v.mora) + 105000 \
				and _flat(cap, _cell_any(R, Vector2(3.3, 1.8))) < 1.0 and absf(yp.y - Sunken.TERRACE_Y) < 0.1
			_check("chapter21", ok, "ch=%d mora +%d cap=%s yeoul=%s" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora), cap, yp])
			_next()
		10:
			PartyState.story = _saved.story
			PartyState.members.assign(_saved.members)
			PartyState.exp = _saved.exp
			PartyState.level = _saved.level
			PartyState.bag = _saved.bag
			PartyState.ar_paid = _saved.ar_paid
			EventState.resolved.assign(_saved.resolved)
			PartyState.world_quests = _saved.wq
			_p.global_position = _saved.pos
			print("STORY6_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _talk(npc: String, want_st: int, name: String, next_cell: Vector2, extra := "", extra_ok := true, from := 0) -> void:
	if _frame == 2 + from * 2:
		_near_npc(npc)
	if _frame == 10 + from * 2:
		_sq.call("interact")
		_drain()
	if _frame == 14 + from * 2:
		var tgt_ok := next_cell == Vector2.INF or _flat(_target(), TestMap.world_pos(next_cell.x, next_cell.y, _step_region(want_st))) < 0.5
		_check(name, int(_sq.call("st")) == want_st and tgt_ok and extra_ok, "st=%d target=%s %s" % [_sq.call("st"), _target(), extra])
		_next()

func _step_region(st: int) -> String:
	return String(Story.step_of(int(_sq.call("ch")), st).get("region", R))

func _target() -> Vector3:
	return _sq.call("target_pos")

func _cell_any(region: String, cell: Vector2) -> Vector3:
	var p := TestMap.world_pos(cell.x, cell.y, region)
	p.y = TerrainBuilder.height_at(region, p)
	return p

## 단계·인물 칸 자리(lift 포함).
func _spot(d: Dictionary) -> Vector3:
	return _cell_any(String(d.region), d.cell) + Vector3(0, float(d.get("lift", 0.0)), 0)

## 그 자리 1.2m 위에 걸리는 은하 나루·잠긴 도읍 명소 충돌(지형은 뺀다).
func _hits(pos: Vector3) -> Array:
	var regs := [get_tree().get_first_node_in_group("go_skyport_region"), get_tree().get_first_node_in_group("go_sunken_region")]
	var q := PhysicsShapeQueryParameters3D.new()
	var sph := SphereShape3D.new()
	sph.radius = 0.6
	q.shape = sph
	q.collision_mask = 1
	q.exclude = [_p.get_rid()]
	q.transform = Transform3D(Basis(), pos + Vector3(0, 1.2, 0))
	var out: Array = []
	for hit in _p.get_world_3d().direct_space_state.intersect_shape(q, 4):
		var c: Object = hit.collider
		var pn := String((c as Node).get_parent().name) if c is Node else ""
		if c is Node and regs.any(func(r: Node) -> bool: return r and r.is_ancestor_of(c as Node)) and not pn.begins_with("Skyport") and not pn.begins_with("Sunken"):
			out.append(pn)
	return out

func _surface(p: Vector3) -> float:
	var q := PhysicsRayQueryParameters3D.create(Vector3(p.x, p.y + 1.0, p.z), Vector3(p.x, -20.0, p.z), 1)
	q.exclude = [_p.get_rid()]
	var hit := _p.get_world_3d().direct_space_state.intersect_ray(q)
	return (hit.position as Vector3).y if not hit.is_empty() else -99.0

var _pressed: Array = []

func _dismiss_prompts() -> void:
	for n in get_tree().get_nodes_in_group("ui_modal"):
		if n == _sq or n.get("visible") == false or _pressed.has(n):
			continue
		_pressed.append(n)
		var btns := (n as Node).find_children("*", "Button", true, false)
		if not btns.is_empty():
			(btns[0] as Button).pressed.emit()

func _drain() -> int:
	var choices := 0
	var guard := 0
	while _sq.call("is_dialogue_open") and guard < 50:
		guard += 1
		if _sq.get("_dlg_waiting_choice"):
			_sq.call("choose", 0)
			choices += 1
		else:
			_sq.call("next_line")
	return choices

func _flat(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()

func _near_npc(id: String) -> void:
	_dismiss_prompts()
	_put(_sq.call("npc_pos", id) + Vector3(0.0, 0.3, 1.5))

func _put(pos: Vector3) -> void:
	_p.global_position = pos + Vector3(0.0, 0.3, 0.0)
	_p.velocity = Vector3.ZERO

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("STORY6_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
