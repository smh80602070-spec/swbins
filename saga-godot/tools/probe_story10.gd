extends Node
## GO 이야기 10부(PLAN 106장 54, 33장~) 자동 점검 — 평소엔 안 붙는다. 9부 probe_story9 · 무대 probe_vault.
## test_village.gd 가 SAGA_STORY10_PROBE 가 있을 때만 단다.
##
##   SAGA_STORY10_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## 33장 "지도 가장자리 너머"(54-2): [1] 표·자리(단계 여섯 talk·talk·go·kill·chase·talk · CH33 · 고개 울타리 꺼짐 ·
##   반디는 굳은 거리 · 하람은 고원 관측소 앞 · 마루는 창고 앞(보임) · 드론 길 점·야적장·마루 자리가 갈무리 벌 안·명소에 안 걸림)
## [2] 반디 → 하람(반디는 고원으로) [3] 하람 → 벌 어귀(반디는 갈무리 벌로) [4] 벌 어귀에 들어섬 [5] 야적장 결정 짐승 넷
## [6] 운반 드론 쫓기(드론 몸·갈무리 벌 안) [7] 마루 → 33장 끝·보상.
## 이야기 상태·부대 경험·가방은 끝에 되돌린다. 저장은 안 한다.

const Story := preload("res://games/saga_go/data/story.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Vault := preload("res://games/saga_go/world/region9_vault.gd")

const CH33 := 32 # 33장(0부터)

var _p: CharacterBody3D
var _sq: Node
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
		_vr = get_tree().get_first_node_in_group("go_vault_region")
		_frame = 0
		return
	if _frame < 3 and _step == 0:
		return
	match _step:
		0: # 준비 — 33장 처음, 모험 등급 73
			_saved = {"story": PartyState.story.duplicate(true), "members": PartyState.members.duplicate(), "exp": PartyState.exp, "level": PartyState.level,
				"bag": PartyState.bag.duplicate(true), "ar_paid": PartyState.ar_paid, "resolved": EventState.resolved.duplicate(), "pos": _p.global_position,
				"wq": PartyState.world_quests.duplicate(true), "party_size": PartyState.party_size}
			PartyState.exp = maxf(PartyState.exp, 72.0 * PartyState.EXP_PER_LEVEL)
			PartyState.level = maxi(PartyState.level, 72)
			PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
			PartyState.story = {"ch": CH33, "step": 0}
			_sq.call("set_track", "")
			_sq.call("_enter_step")
			_next()
		1: # [1] 표·자리
			if _frame < 80: # 갈무리 벌은 1초마다 이야기 상태를 본다
				return
			var c := Story.chapter(CH33)
			var steps: Array = c.steps
			var bad: Array = []
			if String(c.get("id", "")) != "ch33" or int(c.ar) <= int(Story.chapter(CH33 - 1).ar) or int(_sq.call("ch")) != CH33 or bool(_sq.call("locked")):
				bad.append("chapter ch=%d locked=%s" % [_sq.call("ch"), _sq.call("locked")])
			var types := steps.map(func(s: Dictionary) -> String: return String(s.type))
			if types != ["talk", "talk", "go", "kill", "chase", "talk"]:
				bad.append("types %s" % [types])
			if Vault.CH33 != CH33 or not bool(_vr.call("is_gate_open")):
				bad.append("CH33 %d gate=%s" % [Vault.CH33, _vr.call("is_gate_open")])
			if TestMap.region_at(_sq.call("npc_pos", "bandi")) != "amber":
				bad.append("bandi %s" % _sq.call("npc_pos", "bandi"))
			if _flat(_sq.call("npc_pos", "haram"), _cell("frost", Vector2(3.85, 1.7))) > 0.5:
				bad.append("haram %s" % _sq.call("npc_pos", "haram"))
			if not bool(_sq.call("npc_visible", "maru")) or _flat(_sq.call("npc_pos", "maru"), _cell("vault", Vector2(6.2, 5.2))) > 0.5:
				bad.append("maru %s" % _sq.call("npc_pos", "maru"))
			var spots: Array = (steps[4].path as Array).duplicate()
			spots.append_array([steps[2].cell, steps[3].cell, Vector2(6.2, 5.2), Vector2(6.0, 5.3)])
			for pt in spots:
				var wp := _cell("vault", pt)
				if TestMap.region_at(wp) != "vault" or not _hits(wp).is_empty():
					bad.append("spot %s %s" % [pt, _hits(wp)])
			_check("ch33_table", bad.is_empty(), str(bad))
			_next()
		2: # [2] 반디 → 하람 — 반디는 고원 관측소로 먼저
			_talk("bandi", 1, "ch33_bandi", "frost", Vector2(3.85, 1.7))
		3: # [3] 하람 → 벌 어귀 — 반디는 갈무리 벌로
			if _frame == 1:
				_v = TestMap.region_at(_sq.call("npc_pos", "bandi")) == "frost"
			if _frame == 32: # 하람과 이야기를 마친 뒤(interact 는 30)
				_v = bool(_v) and TestMap.region_at(_sq.call("npc_pos", "bandi")) == "vault"
			_talk("haram", 2, "ch33_haram", "vault", Vector2(0.9, 3.0), 10, "bandi_moved=%s" % _v, _v == true)
		4: # [4] 벌 어귀
			if _frame == 1:
				_put(_target() + Vector3(0, 0, -2))
			if _frame == 20:
				var ok: bool = int(_sq.call("st")) == 3 and _flat(_target(), _cell("vault", Vector2(5.6, 4.6))) < 0.5
				_check("ch33_pass", ok, "st=%d target=%s" % [_sq.call("st"), _target()])
				_next()
		5: # [5] 야적장 결정 짐승 넷
			if _frame == 1:
				_put(_target() + Vector3(0, 0, 6))
			if _frame == 10:
				var es: Array = _sq.call("alive_quest_enemies")
				_v = {"n": es.size(), "vault": es.all(func(e: Node3D) -> bool: return TestMap.region_at(e.global_position) == "vault")}
				for e in es:
					e.call("_die")
			if _frame == 16:
				_check("ch33_kill", int(_v.n) == 4 and bool(_v.vault) and int(_sq.call("st")) == 4, "%s st=%d" % [_v, _sq.call("st")])
				_next()
		6: # [6] 운반 드론 쫓기 — 달아나다 따라잡힘
			if _frame == 1:
				var th := _sq.get("_thief") as Node3D
				if th:
					_put(th.global_position + Vector3(0.0, 0.0, 6.0))
			if _frame == 40:
				var cs: Dictionary = _sq.call("chase_state")
				var th := _sq.get("_thief") as Node3D
				_v = {"run": bool(cs.run), "vault": th != null and TestMap.region_at(th.global_position) == "vault", "drone": th != null and th.find_child("Mask", true, false) == null}
				_put(Vector3(cs.pos) + Vector3(0.0, 0.5, 1.0))
			if _frame == 52:
				var ok: bool = bool(_v.run) and bool(_v.vault) and bool(_v.drone) and int(_sq.call("st")) == 5 and _sq.get("_thief") == null
				_check("ch33_chase", ok, "%s st=%d thief=%s" % [_v, _sq.call("st"), _sq.get("_thief") != null])
				_next()
		7: # [7] 마루 → 33장 끝
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("maru")
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
			var ok: bool = int(_sq.call("ch")) == CH33 + 1 and jt.contains("✔ 제33장") and PartyState.count("mora") >= int(_v.mora) + 150000 \
				and bool(_sq.call("npc_visible", "maru")) and TestMap.region_at(_sq.call("npc_pos", "bandi")) == "vault"
			_check("chapter33", ok, "ch=%d mora +%d bandi=%s" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora), TestMap.region_at(_sq.call("npc_pos", "bandi"))])
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
	print("STORY10_PROBE_DONE fails=%d" % _fails)
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

## 그 자리 1.6m 위 반지름 1.2 에 걸리는 충돌(집·금고·창고·컨테이너) — probe_story9 와 같다.
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
	print("STORY10_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
	_v = null
	_pressed.clear() # 장 끝 카드는 같은 노드가 다시 뜬다 — 단계마다 다시 누를 수 있게
