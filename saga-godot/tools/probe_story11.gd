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
## 37장 "세 갈래 길"(55-3): [8] 표·자리(단계 여덟 talk·light·talk·defend·light·climb·light·talk · light = 격자 말뚝 LATTICE_OFF_FROM ·
##   종루 말뚝 높이 = 종루 윗면 · climb = 종루 TOWER_H · 지키기 자리·물결 나오는 자리·인물 자리가 명소에 안 걸림 · 나래 아직 없음·말뚝 셋 켜짐)
## [9] 벼리 → 말뚝(벼리는 길목으로) [10] 역참길 말뚝 — 먼 원소는 안 됨 → 꺼짐·나래 보임 [11] 나래 → 기관차(나래는 기관차 곁)
## [12] 기관차 지키기(물결 셋) [13] 선로 말뚝 [14] 종루 — 발치에선 안 넘어가고 윗면에서 넘어감 [15] 종루 말뚝 → 셋 다 꺼짐·별까마귀는 그대로
## [16] 벼리(길목) → 37장 끝·보상.
## 이야기 상태·부대 경험·가방·순간이동 지점은 끝에 되돌린다. 저장은 안 한다.

const Story := preload("res://games/saga_go/data/story.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Fork := preload("res://games/saga_go/world/region10_fork.gd")
const Vault := preload("res://games/saga_go/world/region9_vault.gd")
const Waypoints := preload("res://games/saga_go/world/waypoints.gd")

const CH36 := 35 # 36장(0부터)
const CH37 := 36
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
		8: # [8] 37장 표·자리
			if _frame < 80:
				return
			var c := Story.chapter(CH37)
			var steps: Array = c.steps
			var bad: Array = []
			if String(c.get("id", "")) != "ch37" or int(c.ar) <= int(Story.chapter(CH36).ar) or int(_sq.call("ch")) != CH37 or bool(_sq.call("locked")):
				bad.append("chapter ch=%d locked=%s" % [_sq.call("ch"), _sq.call("locked")])
			var types := steps.map(func(sd: Dictionary) -> String: return String(sd.type))
			if types != ["talk", "light", "talk", "defend", "light", "climb", "light", "talk"]:
				bad.append("types %s" % [types])
			if Fork.CH37 != CH37:
				bad.append("Fork.CH37 %d" % Fork.CH37)
			for k in 3:
				var lt: Dictionary = steps[int(Fork.LATTICE_OFF_FROM[k]) - 1]
				if String(lt.get("type", "")) != "light" or lt.cell != Fork.LATTICES[k][1] or not bool(lt.get("bare", false)) \
						or absf(_sq.call("_spot_pos", lt).y - Fork.lattice_pos(k).y) > 0.3:
					bad.append("lattice %d" % k)
			var cl: Dictionary = steps[5]
			if cl.cell != Fork.TOWER_CELL or not is_equal_approx(float(cl.above), Fork.TOWER_H):
				bad.append("climb")
			var df: Dictionary = steps[3]
			var dc := _cell("fork", df.cell)
			if not _hits(dc).is_empty():
				bad.append("defend spot %s" % [_hits(dc)])
			for d in df.dirs: # 물결이 나오는 자리 — 세갈래 고을 안, 명소에 안 걸림
				var a := deg_to_rad(float(d))
				var wp := dc + Vector3(sin(a), 0.0, -cos(a)) * Story.DEFEND_RING
				wp.y = TerrainBuilder.height_at("fork", wp)
				if TestMap.region_at(wp) != "fork" or not _hits(wp).is_empty():
					bad.append("wave dir %d %s" % [d, _hits(wp)])
			for pt in [Vector2(6.8, 4.6), Vector2(6.0, 3.1), Vector2(4.35, 3.8)]:
				if not _hits(_cell("fork", pt)).is_empty():
					bad.append("npc spot %s %s" % [pt, _hits(_cell("fork", pt))])
			var lit := range(3).filter(func(k: int) -> bool: return bool(_fr.call("lattice_lit", k)))
			if bool(_sq.call("npc_visible", "narae")) or lit.size() != 3:
				bad.append("world at st0 narae=%s lit=%s" % [_sq.call("npc_visible", "narae"), lit])
			_check("ch37_table", bad.is_empty(), str(bad))
			_next()
		9: # [9] 벼리 → 역참길 말뚝 — 벼리는 길목으로
			if _frame == 12:
				_v = _flat(_sq.call("npc_pos", "byeori"), _cell("fork", Vector2(4.35, 3.8))) < 0.5
			_talk("byeori", 1, "ch37_byeori", "fork", Fork.LATTICES[0][1], 0, "byeori_at_junction=%s" % _v, _v == true)
		10: # [10] 역참길 말뚝 — 먼 원소는 안 됨 → 꺼짐·나래가 풀려남
			var tp := Fork.lattice_pos(0)
			if _frame == 1:
				_put(tp + Vector3(0, 0, 3.0))
			if _frame == 4:
				_sq.call("receive_element", tp + Vector3(15, 0, 0), 3.0, "fire")
			if _frame == 8:
				_v = int(_sq.call("st"))
				_sq.call("receive_element", tp + Vector3(0.4, 0, 0.4), 3.0, "fire")
			if _frame == 150:
				var lit := range(3).filter(func(k: int) -> bool: return bool(_fr.call("lattice_lit", k)))
				var ok: bool = int(_v) == 1 and int(_sq.call("st")) == 2 and lit == [1, 2] and bool(_sq.call("npc_visible", "narae"))
				_check("ch37_lattice_w", ok, "far_st=%d st=%d lit=%s narae=%s" % [_v, _sq.call("st"), lit, _sq.call("npc_visible", "narae")])
				_next()
		11: # [11] 나래 → 기관차 — 나래는 기관차 곁으로
			if _frame == 12:
				_v = _flat(_sq.call("npc_pos", "narae"), _cell("fork", Vector2(6.0, 3.1))) < 0.5
			_talk("narae", 3, "ch37_narae", "fork", Vector2(6.2, 3.094), 0, "narae_at_loco=%s" % _v, _v == true)
		12: # [12] 멈춘 기관차 지키기 — 물결 셋
			if _frame == 1:
				_put(_target() + Vector3(0.0, 0.0, 3.0))
				_v = {"n": 0, "waves": 0, "label": "", "fork": true}
			if _frame > 4 and _frame % 6 == 0 and int(_sq.call("st")) == 3:
				var lbl := _sq.get("_defend_label") as Label3D
				if lbl and String(_v.label) == "":
					_v.label = lbl.text
				for e in _sq.call("alive_quest_enemies"):
					_v.n += 1
					_v.fork = bool(_v.fork) and TestMap.region_at(e.global_position) == "fork"
					e.call("_die")
				_v.waves = maxi(int(_v.waves), int(_sq.call("defend_wave")) + 1)
			if _frame > 4 and (int(_sq.call("st")) != 3 or _frame > 600):
				var ok: bool = int(_sq.call("st")) == 4 and int(_v.n) == 12 and int(_v.waves) == 3 and String(_v.label).begins_with("멈춘 기관차") and bool(_v.fork)
				_check("ch37_defend", ok, "st=%d n=%d waves=%d label='%s' fork=%s frames=%d" % [_sq.call("st"), _v.n, _v.waves, _v.label, _v.fork, _frame])
				_next()
		13: # [13] 선로 말뚝
			_off(1, 5, [2], "ch37_lattice_e")
		14: # [14] 종루 — 발치에선 안 넘어가고 윗면에 서면 넘어감
			if _frame == 1:
				_put(_cell("fork", Fork.TOWER_CELL + Vector2(0.0, 3.5 / TestMap.TILE_SIZE)))
			if _frame == 20:
				_v = int(_sq.call("st"))
				_put(Fork.tower_top() + Vector3(1.2, 0.3, 1.2))
			if _frame == 60:
				var ok: bool = int(_v) == 5 and int(_sq.call("st")) == 6 and absf(_p.global_position.y - Fork.tower_top().y) < 0.6
				_check("ch37_climb", ok, "base_st=%d st=%d y=%.2f/%.2f" % [_v, _sq.call("st"), _p.global_position.y, Fork.tower_top().y])
				_next()
		15: # [15] 종루 말뚝 → 셋 다 꺼짐(별까마귀는 아직 멈춤)
			_off(2, 7, [], "ch37_lattice_tower", bool(_fr.call("crow_visible")))
		16: # [16] 벼리(길목) → 37장 끝
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
			var ok: bool = int(_sq.call("ch")) == CH37 + 1 and jt.contains("✔ 제37장") and PartyState.count("mora") >= int(_v.mora) + 165000 \
				and _flat(_sq.call("npc_pos", "byeori"), _cell("fork", Vector2(4.35, 3.8))) < 0.5 and bool(_sq.call("npc_visible", "narae"))
			_check("chapter37", ok, "ch=%d mora +%d byeori=%s" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora), _sq.call("npc_pos", "byeori")])
			_next()
		17:
			_finish()

## light bare 한 번 — 격자 말뚝 k 에 원소, 다음 단계 want_st 로 넘어가고 아직 켜진 말뚝이 lit 이면 통과.
func _off(k: int, want_st: int, lit: Array, name: String, extra_ok := true) -> void:
	var tp := Fork.lattice_pos(k)
	if _frame == 1:
		_put(tp + Vector3(0, 0.3, 3.0) if k < 2 else tp + Vector3(1.2, 0.3, 1.2))
		if _flat(_target(), tp) > 0.5:
			_check(name + "_target", false, "target=%s want=%s" % [_target(), tp])
	if _frame == 6:
		_sq.call("receive_element", tp + Vector3(0.4, 0, 0.4), 3.0, "water")
	if _frame == 150:
		var now := range(3).filter(func(j: int) -> bool: return bool(_fr.call("lattice_lit", j)))
		_check(name, int(_sq.call("st")) == want_st and now == lit and extra_ok, "st=%d lit=%s extra=%s" % [_sq.call("st"), now, extra_ok])
		_next()

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
