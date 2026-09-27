extends Node
## GO 이야기 7부(PLAN 106장 51, 24장~) 자동 점검 — 평소엔 안 붙는다. 6부 probe_story6.
## test_village.gd 가 SAGA_STORY7_PROBE 가 있을 때만 단다.
##
##   SAGA_STORY7_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## 24장 "하늘 사당의 바람 방울"(51-2, world/sky_route.gd shrine): [1] 표·자리(새벽 과거 · 별배 내리는 자리·인물 자리·졸개·석등 가운데가 사당 섬 윗면 ·
## 명소에 안 묻힘 · 항로 보임 · 사당 먹구름 · 선장·반디는 모래밭) [2] 선장 → 별배 [3] 별배 타기(사당 섬 윗면에 내림)
## [4] 새벽(섬 위) → 졸개 [5] 졸개 넷이 섬 위 [6] 새벽 → 석등 [7] 바람 방울 석등 — 섬 높이·섬 안·차례(틀리면 꺼짐) → 먹구름 걷힘
## [8] 새벽 → 24장 끝·보상·바람 기둥 둘(등대·사당) 서고 잔해 기둥은 아직.
## 이야기 상태·부대 경험·가방은 끝에 되돌린다. 저장은 안 한다.

const Story := preload("res://games/saga_go/data/story.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const SkyRoute := preload("res://games/saga_go/world/sky_route.gd")

const CH24 := 23 # 24장(0부터)
const R := "sunken"

var _p: CharacterBody3D
var _sq: Node
var _sr: Node
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
		_sr = get_tree().get_first_node_in_group("go_sky_route")
		_frame = 0
		return
	if _frame < 3 and _step == 0:
		return
	match _step:
		0: # 준비 — 24장 처음, 모험 등급 55
			_saved = {"story": PartyState.story.duplicate(true), "members": PartyState.members.duplicate(), "exp": PartyState.exp, "level": PartyState.level,
				"bag": PartyState.bag.duplicate(true), "ar_paid": PartyState.ar_paid, "resolved": EventState.resolved.duplicate(), "pos": _p.global_position, "wq": PartyState.world_quests.duplicate(true)}
			PartyState.exp = maxf(PartyState.exp, 55.0 * PartyState.EXP_PER_LEVEL)
			PartyState.level = maxi(PartyState.level, 55)
			PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
			PartyState.story = {"ch": CH24, "step": 0}
			_sq.call("set_track", "")
			_sq.call("_enter_step")
			_next()
		1: # [1] 표·자리
			if _frame < 70: # 항로·먹구름은 30프레임마다 본다
				return
			var c := Story.chapter(CH24)
			var steps: Array = c.steps
			var bad: Array = []
			if String(c.get("id", "")) != "ch24" or int(c.ar) <= int(Story.chapter(CH24 - 1).ar) or int(_sq.call("ch")) != CH24 or bool(_sq.call("locked")) or steps.size() != 7:
				bad.append("chapter ch=%d locked=%s steps=%d" % [_sq.call("ch"), _sq.call("locked"), steps.size()])
			var info: Dictionary = Story.NPCS.saebyeok
			if String(info.get("era", "")) != "과거" or bool(_sq.call("npc_visible", "saebyeok")):
				bad.append("saebyeok info/visible at st0")
			## 사당 섬 윗면 자리 — 별배 내리는 자리·졸개·석등 가운데·새벽·선장·반디(섬 칸).
			var spots: Array = [steps[1].to, steps[3], steps[5]]
			spots += Story.windows(info.appear)
			spots += Story.windows(Story.NPCS.hanbyeol.appear).filter(func(w: Dictionary) -> bool: return w.has("isle"))
			spots += Story.windows(Story.STATIONS.bandi).filter(func(w: Dictionary) -> bool: return w.has("isle"))
			for d in spots:
				var sp := _spot(d)
				var cc := SkyRoute.center("shrine")
				if String(d.get("isle", "")) != "shrine" or absf(sp.y - SkyRoute.top_y("shrine")) > 0.01 or _flat(sp, cc) > SkyRoute.radius("shrine") - 2.0:
					bad.append("spot %s" % [d.cell])
				elif not _hits(sp).is_empty():
					bad.append("buried %s %s" % [d.cell, _hits(sp)])
			if not bool(_sr.call("is_shown")) or not bool(_sr.call("gloom_visible")):
				bad.append("route shown=%s gloom=%s" % [_sr.call("is_shown"), _sr.call("gloom_visible")])
			if TestMap.region_at(_sq.call("npc_pos", "hanbyeol")) != R or _flat(_sq.call("npc_pos", "bandi"), _cell_any(R, Vector2(3.1, 1.55))) > 1.0:
				bad.append("hanbyeol/bandi at beach")
			_check("ch24_table", bad.is_empty(), str(bad))
			_next()
		2: # [2] 선장(모래밭) → 별배
			_talk("hanbyeol", 1, "ch24_hanbyeol", Vector2.INF)
		3: # [3] 별배 타기 — 선장에게 F → 사당 섬 윗면
			if _frame == 1:
				_near_npc("hanbyeol")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 30:
				var ok: bool = int(_sq.call("st")) == 2 and SkyRoute.on_isle("shrine", _p.global_position) and absf(_p.global_position.y - SkyRoute.top_y("shrine")) < 1.0
				_check("ch24_ship", ok, "st=%d pos=%s" % [_sq.call("st"), _p.global_position])
				_next()
		4: # [4] 새벽(섬 위) → 졸개
			if _frame == 1:
				var sp: Vector3 = _sq.call("npc_pos", "saebyeok")
				_v = bool(_sq.call("npc_visible", "saebyeok")) and absf(sp.y - SkyRoute.top_y("shrine")) < 0.1
			_talk("saebyeok", 3, "ch24_saebyeok", Vector2(6.4063, 7.2542), "on_isle=%s" % _v, bool(_v), 1)
		5: # [5] 졸개 넷 — 섬 위
			if _frame == 1:
				_put(_target() + Vector3(0, 0, 6))
			if _frame == 10:
				var es: Array = _sq.call("alive_quest_enemies")
				var on := es.filter(func(e: Node) -> bool: return SkyRoute.on_isle("shrine", (e as Node3D).global_position, 2.0)).size()
				_v = {"n": es.size(), "on": on}
				for e in es:
					e.call("_die")
			if _frame == 16:
				_check("ch24_kill", int(_v.n) == 4 and int(_v.on) == 4 and int(_sq.call("st")) == 4, "n=%d on=%d st=%d" % [_v.n, _v.on, _sq.call("st")])
				_next()
		6: # [6] 새벽 → 석등
			_talk("saebyeok", 5, "ch24_saebyeok2", Vector2(6.4063, 7.2542))
		7: # [7] 바람 방울 석등 — 섬 높이·섬 안, 해 먼저(틀림) → 별 → 해 → 달 → 먹구름 걷힘
			var cc := SkyRoute.center("shrine")
			if _frame == 1:
				_put(_target() + Vector3(0.0, 0.0, 3.0))
				_v = {"lit": [], "ys": [], "rs": []}
			if _frame == 6:
				for mk in ["sun", "star", "moon"]:
					var lp: Vector3 = _sq.call("seal_lamp_pos", mk)
					_v.ys.append(snappedf(lp.y - SkyRoute.top_y("shrine"), 0.01))
					_v.rs.append(snappedf(_flat(lp, cc), 0.1))
				for mk in ["sun", "star", "sun", "moon"]:
					_sq.call("receive_element", _sq.call("seal_lamp_pos", mk), 0.5, "wind")
					_v.lit.append(int(_sq.call("seal_lit")))
			if _frame == 150: # 다 켜진 뒤 넘어가고, 먹구름은 30프레임마다 본다
				var ys_ok := (_v.ys as Array).all(func(y: float) -> bool: return absf(y) < 0.2)
				var rs_ok := (_v.rs as Array).all(func(r: float) -> bool: return r < SkyRoute.radius("shrine") - 2.0)
				var ok: bool = _v.lit == [0, 1, 2, 3] and int(_sq.call("st")) == 6 and ys_ok and rs_ok and not bool(_sr.call("gloom_visible"))
				_check("ch24_seal", ok, "lit=%s st=%d ys=%s rs=%s gloom=%s" % [_v.lit, _sq.call("st"), _v.ys, _v.rs, _sr.call("gloom_visible")])
				_next()
		8: # [8] 새벽 → 24장 끝 · 바람 기둥
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("saebyeok")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame < 16:
				return
			_dismiss_prompts()
			if _frame < 60:
				return
			_sq.call("toggle_journal")
			var jt: String = _sq.call("journal_text")
			_sq.call("toggle_journal")
			var drafts := range(3).filter(func(i: int) -> bool: return bool(_sr.call("draft_active", i)))
			var ok: bool = int(_sq.call("ch")) == CH24 + 1 and jt.contains("✔ 제24장") and PartyState.count("mora") >= int(_v.mora) + 120000 \
				and drafts == [0, 1] and bool(_sq.call("npc_visible", "saebyeok")) and not bool(_sr.call("gloom_visible"))
			_check("chapter24", ok, "ch=%d mora +%d drafts=%s" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora), drafts])
			_next()
		9:
			PartyState.story = _saved.story
			PartyState.members.assign(_saved.members)
			PartyState.exp = _saved.exp
			PartyState.level = _saved.level
			PartyState.bag = _saved.bag
			PartyState.ar_paid = _saved.ar_paid
			EventState.resolved.assign(_saved.resolved)
			PartyState.world_quests = _saved.wq
			_p.global_position = _saved.pos
			print("STORY7_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _talk(npc: String, want_st: int, name: String, next_cell: Vector2, extra := "", extra_ok := true, from := 0) -> void:
	if _frame == 2 + from * 2:
		_near_npc(npc)
	if _frame == 10 + from * 2:
		_sq.call("interact")
		_drain()
	if _frame == 14 + from * 2:
		var tgt_ok := next_cell == Vector2.INF or _flat(_target(), TestMap.world_pos(next_cell.x, next_cell.y, R)) < 0.5
		_check(name, int(_sq.call("st")) == want_st and tgt_ok and extra_ok, "st=%d target=%s %s" % [_sq.call("st"), _target(), extra])
		_next()

func _target() -> Vector3:
	return _sq.call("target_pos")

func _cell_any(region: String, cell: Vector2) -> Vector3:
	var p := TestMap.world_pos(cell.x, cell.y, region)
	p.y = TerrainBuilder.height_at(region, p)
	return p

## 단계·인물 칸 자리(isle 이면 섬 윗면).
func _spot(d: Dictionary) -> Vector3:
	if d.has("isle"):
		var p := TestMap.world_pos(d.cell.x, d.cell.y, String(d.region))
		p.y = SkyRoute.top_y(String(d.isle))
		return p
	return _cell_any(String(d.region), d.cell) + Vector3(0, float(d.get("lift", 0.0)), 0)

## 그 자리 1.2m 위에 걸리는 구름 위 항로 명소 충돌(섬 윗면 판은 그 아래라 안 걸린다).
func _hits(pos: Vector3) -> Array:
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
		if c is Node and _sr.is_ancestor_of(c as Node):
			out.append(String((c as Node).name))
	return out

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
	print("STORY7_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
