extends Node
## GO 이야기 9부(PLAN 106장 53, 30장~) 자동 점검 — 평소엔 안 붙는다. 8부 probe_story8 · 무대 probe_amber.
## test_village.gd 가 SAGA_STORY9_PROBE 가 있을 때만 단다.
##
##   SAGA_STORY9_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## 30장 "멈춘 거리"(53-2): [1] 표·자리(단계 여덟 talk·go·kill·talk·light·light·light·talk · light 칸 = 굳은 자리 셋 · 녹는 단계 = CRYSTAL_OFF_FROM ·
##   한별·반디는 은하 나루 착륙판 곁 · 초롱은 시계방 앞) [2] 한별 → 고개 [3] 고개 어귀에 들어섬(반디는 굳은 거리로) [4] 네거리 결정 짐승 넷
## [5] 초롱 → 첫 굳은 자리 [6] 신호등 앞 — 먼 원소는 안 됨 → 녹음(나머지 둘은 그대로) [7] 정류장 [8] 우체통 → 셋 다 녹음·신호등은 빨강
## [9] 초롱 → 30장 끝·보상.
## 이야기 상태·부대 경험·가방은 끝에 되돌린다. 저장은 안 한다.

const Story := preload("res://games/saga_go/data/story.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Amber := preload("res://games/saga_go/world/region8_amber.gd")

const CH30 := 29 # 30장(0부터)

var _p: CharacterBody3D
var _sq: Node
var _am: Node
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
		_am = get_tree().get_first_node_in_group("go_amber_region")
		_frame = 0
		return
	if _frame < 3 and _step == 0:
		return
	match _step:
		0: # 준비 — 30장 처음, 모험 등급 67
			_saved = {"story": PartyState.story.duplicate(true), "members": PartyState.members.duplicate(), "exp": PartyState.exp, "level": PartyState.level,
				"bag": PartyState.bag.duplicate(true), "ar_paid": PartyState.ar_paid, "resolved": EventState.resolved.duplicate(), "pos": _p.global_position,
				"wq": PartyState.world_quests.duplicate(true), "party_size": PartyState.party_size}
			PartyState.exp = maxf(PartyState.exp, 66.0 * PartyState.EXP_PER_LEVEL)
			PartyState.level = maxi(PartyState.level, 66)
			PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
			PartyState.story = {"ch": CH30, "step": 0}
			_sq.call("set_track", "")
			_sq.call("_enter_step")
			_next()
		1: # [1] 표·자리
			if _frame < 80: # 굳은 거리는 1초마다 이야기 상태를 본다
				return
			var c := Story.chapter(CH30)
			var steps: Array = c.steps
			var bad: Array = []
			if String(c.get("id", "")) != "ch30" or int(c.ar) <= int(Story.chapter(CH30 - 1).ar) or int(_sq.call("ch")) != CH30 or bool(_sq.call("locked")):
				bad.append("chapter ch=%d locked=%s" % [_sq.call("ch"), _sq.call("locked")])
			var types := steps.map(func(s: Dictionary) -> String: return String(s.type))
			if types != ["talk", "go", "kill", "talk", "light", "light", "light", "talk"]:
				bad.append("types %s" % [types])
			if Amber.CH30 != CH30:
				bad.append("Amber.CH30 %d" % Amber.CH30)
			for k in 3:
				var st := int(Amber.CRYSTAL_OFF_FROM[k]) - 1 # 녹는 단계 = 그 light 를 마친 다음
				var sd: Dictionary = steps[st] if st >= 0 and st < steps.size() else {}
				if String(sd.get("type", "")) != "light" or String(sd.get("region", "")) != "amber" or sd.get("cell") != Amber.CRYSTALS[k][1] or not bool(sd.get("bare", false)):
					bad.append("crystal %d step %d" % [k, st])
			if not bool(_sq.call("npc_visible", "chorong")) or _flat(_sq.call("npc_pos", "chorong"), _cell("amber", Vector2(6.25, 5.3))) > 0.5:
				bad.append("chorong %s" % _sq.call("npc_pos", "chorong"))
			if _flat(_sq.call("npc_pos", "hanbyeol"), _cell("skyport", Vector2(5.2, 1.95))) > 0.5:
				bad.append("hanbyeol %s" % _sq.call("npc_pos", "hanbyeol"))
			if TestMap.region_at(_sq.call("npc_pos", "bandi")) != "skyport":
				bad.append("bandi %s" % _sq.call("npc_pos", "bandi"))
			if not range(3).all(func(k: int) -> bool: return bool(_am.call("crystal_visible", k))):
				bad.append("crystals not all frozen")
			_check("ch30_table", bad.is_empty(), str(bad))
			_next()
		2: # [2] 한별 → 고개
			_talk("hanbyeol", 1, "ch30_hanbyeol", "amber", Vector2(3.0, 7.5))
		3: # [3] 고개 어귀
			if _frame == 1:
				_put(_target() + Vector3(0, 0, -2))
			if _frame == 20:
				var ok: bool = int(_sq.call("st")) == 2 and TestMap.region_at(_sq.call("npc_pos", "bandi")) == "amber" \
					and _flat(_target(), _cell("amber", Vector2(4.3, 4.2))) < 0.5
				_check("ch30_pass", ok, "st=%d bandi=%s" % [_sq.call("st"), _sq.call("npc_pos", "bandi")])
				_next()
		4: # [4] 네거리 결정 짐승 넷
			if _frame == 1:
				_put(_target() + Vector3(0, 0, 6))
			if _frame == 10:
				var es: Array = _sq.call("alive_quest_enemies")
				_v = es.size()
				for e in es:
					e.call("_die")
			if _frame == 16:
				_check("ch30_kill", int(_v) == 4 and int(_sq.call("st")) == 3, "n=%d st=%d" % [_v, _sq.call("st")])
				_next()
		5: # [5] 초롱 → 첫 굳은 자리
			_talk("chorong", 4, "ch30_chorong", "amber", Amber.CRYSTALS[0][1])
		6: # [6] 신호등 앞 — 먼 원소는 안 됨
			var tp := Amber.crystal_pos(0)
			if _frame == 1:
				_put(tp + Vector3(0, 0, 3.0))
			if _frame == 4:
				_sq.call("receive_element", tp + Vector3(15, 0, 0), 3.0, "fire")
			if _frame == 8:
				_v = int(_sq.call("st"))
				_sq.call("receive_element", tp + Vector3(0.4, 0, 0.4), 3.0, "fire")
			if _frame == 150:
				var vis := range(3).filter(func(k: int) -> bool: return bool(_am.call("crystal_visible", k)))
				var ok: bool = int(_v) == 4 and int(_sq.call("st")) == 5 and vis == [1, 2]
				_check("ch30_melt1", ok, "far_st=%d st=%d frozen=%s" % [_v, _sq.call("st"), vis])
				_next()
		7: # [7] 버스 정류장
			_melt(1, 6, [2], "ch30_melt2")
		8: # [8] 우체통 — 셋 다 녹아도 신호등은 빨강
			_melt(2, 7, [], "ch30_melt3", not bool(_am.call("lamp_green")))
		9: # [9] 초롱 → 30장 끝
			if _frame == 1:
				_v = {"mora": PartyState.count("mora")}
				_near_npc("chorong")
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
			var ok: bool = int(_sq.call("ch")) == CH30 + 1 and jt.contains("✔ 제30장") and PartyState.count("mora") >= int(_v.mora) + 140000 \
				and bool(_sq.call("npc_visible", "chorong"))
			_check("chapter30", ok, "ch=%d mora +%d" % [_sq.call("ch"), PartyState.count("mora") - int(_v.mora)])
			_next()
		10:
			_finish()

## light bare 한 번 — 굳은 자리 k 에 원소, 다음 단계 want_st 로 넘어가고 아직 굳은 것이 frozen 이면 통과.
func _melt(k: int, want_st: int, frozen: Array, name: String, extra_ok := true) -> void:
	var tp := Amber.crystal_pos(k)
	if _frame == 1:
		_put(tp + Vector3(0, 0, 3.0))
		if _flat(_target(), tp) > 0.5:
			_check(name + "_target", false, "target=%s want=%s" % [_target(), tp])
	if _frame == 6:
		_sq.call("receive_element", tp + Vector3(0.4, 0, 0.4), 3.0, "water")
	if _frame == 150:
		var vis := range(3).filter(func(j: int) -> bool: return bool(_am.call("crystal_visible", j)))
		_check(name, int(_sq.call("st")) == want_st and vis == frozen and extra_ok, "st=%d frozen=%s extra=%s" % [_sq.call("st"), vis, extra_ok])
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
	print("STORY9_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()

func _talk(npc: String, want_st: int, name: String, next_region: String, next_cell: Vector2) -> void:
	if _frame == 2:
		_near_npc(npc)
	if _frame == 10:
		_sq.call("interact")
		_drain()
	if _frame == 14:
		var tgt_ok := _flat(_target(), TestMap.world_pos(next_cell.x, next_cell.y, next_region)) < 0.5
		_check(name, int(_sq.call("st")) == want_st and tgt_ok, "st=%d target=%s" % [_sq.call("st"), _target()])
		_next()

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
	print("STORY9_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
