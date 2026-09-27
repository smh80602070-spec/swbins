extends Node
## GO 이야기 11부(PLAN 106장 55, 36장~) 자동 점검 — 평소엔 안 붙는다. 10부 probe_story10 · 무대 probe_fork.
## test_village.gd 가 SAGA_STORY11_PROBE 가 있을 때만 단다.
##
##   SAGA_STORY11_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## 36장 "가장 깊은 진열장"(55-2): [1] 표·자리(단계 여섯 talk·sail·talk·kill·follow·talk · CH36 · 해미는 금고 해미 진열장 자리 ·
##   가장 깊은 진열장 봉인 · 벼리는 성문 안쪽(보임) · 내리는 자리가 고을 어귀 순간이동 지점 ACTIVATE_M 안·아직 안 켜짐 ·
##   성문 앞·따라가기 길·화덕 앞이 세갈래 고을 안·명소에 안 걸림) [2] 해미 → 진열장(sail)
## [3] 해미에게 F → 세갈래 고을 성문 앞에 내림·고을 어귀 순간이동 지점이 켜짐 [4] 벼리 → 성문 앞 [5] 성문 앞 결정 짐승 넷
## [6] 벼리 따라 대장간(길 끝) [7] 벼리 → 36장 끝·보상(벼리는 화덕 앞).
## 이야기 상태·부대 경험·가방·순간이동 지점은 끝에 되돌린다. 저장은 안 한다.

const Story := preload("res://games/saga_go/data/story.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Fork := preload("res://games/saga_go/world/region10_fork.gd")
const Vault := preload("res://games/saga_go/world/region9_vault.gd")
const Waypoints := preload("res://games/saga_go/world/waypoints.gd")

const CH36 := 35 # 36장(0부터)
const ARRIVE := Vector2(4.0, 7.15)
const FORGE_SPOT := Vector2(2.45, 5.45)

var _p: CharacterBody3D
var _sq: Node
var _fr: Node
var _vr: Node
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
		_fr = get_tree().get_first_node_in_group("go_fork_region")
		_vr = get_tree().get_first_node_in_group("go_vault_region")
		_frame = 0
		return
	if _frame < 3 and _step == 0:
		return
	match _step:
		0: # 준비 — 36장 처음, 모험 등급 79
			_saved = {"story": PartyState.story.duplicate(true), "members": PartyState.members.duplicate(), "exp": PartyState.exp, "level": PartyState.level,
				"bag": PartyState.bag.duplicate(true), "ar_paid": PartyState.ar_paid, "resolved": EventState.resolved.duplicate(), "pos": _p.global_position,
				"wq": PartyState.world_quests.duplicate(true), "party_size": PartyState.party_size}
			PartyState.exp = maxf(PartyState.exp, 78.0 * PartyState.EXP_PER_LEVEL)
			PartyState.level = maxi(PartyState.level, 78)
			PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
			PartyState.story = {"ch": CH36, "step": 0}
			EventState.resolved.erase("wp_h_gate")
			_sq.call("set_track", "")
			_sq.call("_enter_step")
			_next()
		1: # [1] 표·자리
			if _frame < 80: # 두 지역은 1초마다 이야기 상태를 본다
				return
			var c := Story.chapter(CH36)
			var steps: Array = c.steps
			var bad: Array = []
			if String(c.get("id", "")) != "ch36" or int(c.ar) <= int(Story.chapter(CH36 - 1).ar) or int(_sq.call("ch")) != CH36 or bool(_sq.call("locked")):
				bad.append("chapter ch=%d locked=%s" % [_sq.call("ch"), _sq.call("locked")])
			var types := steps.map(func(s: Dictionary) -> String: return String(s.type))
			if types != ["talk", "sail", "talk", "kill", "follow", "talk"]:
				bad.append("types %s" % [types])
			if Fork.CH36 != CH36:
				bad.append("Fork.CH36 %d" % Fork.CH36)
			if _flat(_sq.call("npc_pos", "haemi"), Vault.case_pos(Vault.HAEMI_CASE_DEG)) > 0.5 or String(_vr.call("deep_case_state")) != "sealed":
				bad.append("haemi/deep %s %s" % [_sq.call("npc_pos", "haemi"), _vr.call("deep_case_state")])
			if _flat(Vault.case_pos(Vault.HAEMI_CASE_DEG), Vault.deep_case_pos()) > 8.0:
				bad.append("deep case far from haemi")
			if not bool(_sq.call("npc_visible", "byeori")) or _flat(_sq.call("npc_pos", "byeori"), _cell("fork", Vector2(4.0, 5.95))) > 0.5:
				bad.append("byeori %s" % _sq.call("npc_pos", "byeori"))
			var sl: Dictionary = steps[1]
			var gate_wp := _wp("h_gate")
			if String(sl.to.region) != "fork" or sl.to.cell != ARRIVE or gate_wp == Vector3.INF or _cell("fork", ARRIVE).distance_to(gate_wp) > Waypoints.ACTIVATE_M - 1.0 \
					or Waypoints.is_active("h_gate"):
				bad.append("arrive/wp %s %s active=%s" % [sl.to, gate_wp, Waypoints.is_active("h_gate")])
			var spots: Array = (steps[4].path as Array).duplicate()
			spots.append_array([steps[3].cell, ARRIVE, FORGE_SPOT])
			for pt in spots:
				var wp := _cell("fork", pt)
				if TestMap.region_at(wp) != "fork" or not _hits(wp).is_empty():
					bad.append("spot %s %s" % [pt, _hits(wp)])
			_check("ch36_table", bad.is_empty(), str(bad))
			_next()
		2: # [2] 해미 → 진열장
			_talk("haemi", 1, "ch36_haemi", "vault", Story.NPCS.haemi.cell)
		3: # [3] 해미에게 F → 세갈래 고을 성문 앞
			if _frame == 2:
				_near_npc("haemi")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 40:
				var ok: bool = int(_sq.call("st")) == 2 and TestMap.region_at(_p.global_position) == "fork" \
					and _flat(_p.global_position, _cell("fork", ARRIVE)) < 1.5 and Waypoints.is_active("h_gate")
				_check("ch36_sail", ok, "st=%d region=%s pos=%s wp=%s" % [_sq.call("st"), TestMap.region_at(_p.global_position), _p.global_position, Waypoints.is_active("h_gate")])
				_next()
		4: # [4] 벼리 → 성문 앞
			_talk("byeori", 3, "ch36_byeori", "fork", Vector2(4.0, 6.75))
		5: # [5] 성문 앞 결정 짐승 넷
			if _frame == 1:
				_put(_target() + Vector3(0, 0, 6))
			if _frame == 10:
				var es: Array = _sq.call("alive_quest_enemies")
				_v = {"n": es.size(), "fork": es.all(func(e: Node3D) -> bool: return TestMap.region_at(e.global_position) == "fork")}
				for e in es:
					e.call("_die")
			if _frame == 16:
				_check("ch36_kill", int(_v.n) == 4 and bool(_v.fork) and int(_sq.call("st")) == 4, "%s st=%d" % [_v, _sq.call("st")])
				_next()
		6: # [6] 벼리 따라 대장간
			var w: Vector3 = _sq.call("npc_pos", "byeori")
			if _frame == 1:
				_sq.set("follow_speed_mul", 20.0)
			if int(_sq.call("st")) == 4 and _frame < 1500:
				_put(w + Vector3(0.0, 0.0, 3.0))
				return
			_sq.set("follow_speed_mul", 1.0)
			_check("ch36_follow", int(_sq.call("st")) == 5 and _flat(w, _cell("fork", FORGE_SPOT)) < 1.0, "st=%d frames=%d to_end=%.1f" % [_sq.call("st"), _frame, _flat(w, _cell("fork", FORGE_SPOT))])
			_next()
		7: # [7] 벼리 → 36장 끝
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("byeori")
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
			var ok: bool = int(_sq.call("ch")) == CH36 + 1 and jt.contains("✔ 제36장") and PartyState.count("mora") >= int(_v.mora) + 160000 \
				and bool(_sq.call("npc_visible", "byeori")) and _flat(_sq.call("npc_pos", "byeori"), _cell("fork", FORGE_SPOT)) < 0.5
			_check("chapter36", ok, "ch=%d mora +%d byeori=%s" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora), _sq.call("npc_pos", "byeori")])
			_next()
		8:
			_finish()

func _finish() -> void:
	PartyState.story = _saved.story
	PartyState.members.assign(_saved.members)
	PartyState.party_size = int(_saved.party_size)
	PartyState.exp = _saved.exp
	PartyState.level = _saved.level
	PartyState.bag = _saved.bag
	PartyState.ar_paid = _saved.ar_paid
	EventState.resolved.assign(_saved.resolved)
	PartyState.world_quests = _saved.wq
	_p.global_position = _saved.pos
	print("STORY11_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()

func _talk(npc: String, want_st: int, name: String, next_region: String, next_cell: Vector2, from := 0, extra := "", extra_ok := true) -> void:
	if _frame == 2 + from * 2:
		_near_npc(npc)
	if _frame == 10 + from * 2:
		_sq.call("interact")
		_drain()
	if _frame == 14 + from * 2:
		var tgt_ok := _flat(_target(), TestMap.world_pos(next_cell.x, next_cell.y, next_region)) < 0.5
		_check(name, int(_sq.call("st")) == want_st and tgt_ok and extra_ok, "st=%d target=%s %s" % [_sq.call("st"), _target(), extra])
		_next()

## 순간이동 지점 자리(월드) — 표에 없으면 INF.
func _wp(id: String) -> Vector3:
	for w in Waypoints.POINTS:
		if String(w[0]) == id:
			return _cell(String(w[1]), w[2])
	return Vector3.INF

## 그 자리 1.6m 위 반지름 1.2 에 걸리는 충돌 — probe_story10 과 같다.
func _hits(pos: Vector3) -> Array:
	var q := PhysicsShapeQueryParameters3D.new()
	var sph := SphereShape3D.new()
	sph.radius = 1.2
	q.shape = sph
	q.collision_mask = 1
	q.exclude = [_p.get_rid()]
	q.transform = Transform3D(Basis(), pos + Vector3(0, 1.6, 0))
	var out: Array = []
	for hit in _p.get_world_3d().direct_space_state.intersect_shape(q, 4):
		out.append(String((hit.collider as Node).name))
	return out

func _target() -> Vector3:
	return _sq.call("target_pos")

func _cell(region: String, cell: Vector2) -> Vector3:
	var p := TestMap.world_pos(cell.x, cell.y, region)
	p.y = TerrainBuilder.height_at(region, p)
	return p

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
	print("STORY11_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
	_v = null
	_pressed.clear() # 장 끝 카드는 같은 노드가 다시 뜬다 — 단계마다 다시 누를 수 있게
