extends Node
## GO 이야기 16부(G-0079, 51장~ — 회차 4 전용) 자동 점검 — 평소엔 안 붙는다. 15부 probe_story15.
## test_village.gd 가 SAGA_STORY16_PROBE 가 있을 때만 단다.
##
##   SAGA_STORY16_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## [1] 표·자리 — 본편 41장·전체 53장 · 51·52·53장 단계 종류·장 id·ar 85·cycle 4 · 보스 "선로를 감은 번개 이무기"(뇌·serpent, 방패는 불로 깨짐)
##     · 단계 자리(지역 안·충돌에 안 묻힘)
## [2] 잠금 — 회차 3 이면 51장 잠김·추적 글 "별배 재출항(4회차)"·일지 같은 글 · 회차 4 면 열림
## [3] 51장부터 53장 끝까지 단계마다 자동으로 밟는다(talk·go·kill·climb·light·duel) — 장 끝 보상
## [4] 끝 — ch=53·일지 ✔ 제53장·모라 · G-0075 보스 곁에선 금빛 빛기둥 숨김(50m 밖에선 보임)
## 이야기 상태·회차·부대 경험·가방은 끝에 되돌린다. 저장은 안 한다.

const Story := preload("res://games/saga_go/data/story.gd")
const Cycle := preload("res://games/saga_go/data/cycle.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")
const EraSites := preload("res://games/saga_go/world/era_sites.gd")

const CH42 := 50 # 51장(0부터) — 상수 이름은 13부 점검과 같게 둔다
const CH44 := 52
const STEP_FRAMES := 900

var _p: CharacterBody3D
var _sq: Node
var _frame := 0
var _step := 0
var _fails := 0
var _saved := {}
var _key := ""
var _sf := 0 # 단계 안 프레임
var _log: Array = []
var _mora0 := 0
var _pressed: Array = []
var _mk := {} # G-0075 보스 곁 빛기둥 {near: 숨김?, far: 보임?}

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
		0:
			_saved = {"story": PartyState.story.duplicate(true), "members": PartyState.members.duplicate(), "exp": PartyState.exp, "level": PartyState.level,
				"bag": PartyState.bag.duplicate(true), "ar_paid": PartyState.ar_paid, "resolved": EventState.resolved.duplicate(), "pos": _p.global_position,
				"wq": PartyState.world_quests.duplicate(true), "party_size": PartyState.party_size, "cycle": PartyState.cycle}
			PartyState.exp = maxf(PartyState.exp, 86.0 * PartyState.EXP_PER_LEVEL)
			PartyState.level = maxi(PartyState.level, 86)
			PartyState.ar_paid = maxi(PartyState.ar_paid, PartyState.level + 1)
			PartyState.cycle = 3
			PartyState.story = {"ch": CH42, "step": 0}
			_sq.call("set_track", "")
			_sq.call("_enter_step")
			_mora0 = PartyState.count("mora")
			_next()
		1: # [1] 표·자리
			if _frame < 60:
				return
			var bad: Array = []
			if Story.MAIN_CHAPTERS != 41 or Story.CHAPTERS.size() != 53 or not Story.main_done(41) or Story.main_done(40):
				bad.append("count main=%d all=%d" % [Story.MAIN_CHAPTERS, Story.CHAPTERS.size()])
			var want := {"ch51": ["talk", "talk", "kill", "climb", "talk"], "ch52": ["talk", "light", "kill", "talk"],
				"ch53": ["talk", "go", "duel", "talk", "talk"]}
			for i in 3:
				var c := Story.chapter(CH42 + i)
				var types: Array = (c.steps as Array).map(func(sd: Dictionary) -> String: return String(sd.type))
				var cid := "ch%d" % (51 + i)
				if String(c.get("id", "")) != cid or types != want[cid] or int(c.ar) != 85 or int(c.get("cycle", 0)) != 4 or c.has("join"):
					bad.append("chapter %d %s ar=%s cycle=%s" % [51 + i, types, c.get("ar"), c.get("cycle")])
				for si in (c.steps as Array).size():
					var sd: Dictionary = c.steps[si]
					if sd.has("npc") and not Story.NPCS.has(String(sd.npc)):
						bad.append("npc %s" % sd.npc)
					if sd.has("region"):
						var pos := _cell(String(sd.region), sd.cell)
						if TestMap.region_at(pos) != String(sd.region):
							bad.append("region ch%d/%d" % [51 + i, si])
						## 구조물이 목표인 단계(계류 탑 오르기·종각 종·넓은 도착 구역)는 4부와 같은 자리라 묻힘 검사에서 뺀다.
						var on_structure: bool = String(sd.type) == "climb" or bool(sd.get("bell", false)) or (String(sd.type) == "go" and float(sd.get("radius", 0.0)) >= 10.0)
						if not on_structure and not _hits(pos).is_empty():
							bad.append("buried ch%d/%d %s" % [51 + i, si, _hits(pos)])
			var boss: Dictionary = FieldEnemy.KINDS.get("rail_serpent", {})
			if String(boss.get("element", "")) != "thunder" or float(boss.get("phase_shield", 0.0)) <= 0.0 or Elements.SHIELD_COUNTER.get("thunder", "") != "fire" \
					or String(boss.get("shape", "")) != "serpent":
				bad.append("boss")
			_check("tables", bad.is_empty(), str(bad))
			_next()
		2: # [2] 잠금 — 회차 3 → 잠김 · 회차 4 → 열림
			if _frame == 5:
				_sq.call("toggle_journal")
				var jt: String = _sq.call("journal_text")
				_sq.call("toggle_journal")
				var tt: String = _sq.call("tracker_text")
				var ok: bool = bool(_sq.call("locked")) and tt.contains("별배 재출항(4회차)") and jt.contains("제51장 · 기다림의 첫날  (별배 재출항(4회차)") \
					and Cycle.story_done()
				_check("locked_until_cycle", ok, "locked=%s tracker='%s' blocker='%s'" % [_sq.call("locked"), tt.replace("\n", " / "), Cycle.blocker()])
				PartyState.cycle = 4
				_sq.call("_enter_step")
			if _frame == 30:
				var tt2: String = _sq.call("tracker_text")
				_check("open_on_cycle", not bool(_sq.call("locked")) and not tt2.contains("열린다"), "tracker='%s'" % tt2.replace("\n", " / "))
				_next()
		3: # [3] 51~53장을 자동으로 밟는다
			var ch := int(_sq.call("ch"))
			if ch > CH44:
				_check("playthrough", true, "log=%s" % [_log])
				_next()
				return
			_dismiss_prompts()
			var st := int(_sq.call("st"))
			var key := "%d/%d" % [ch, st]
			if key != _key:
				_key = key
				_sf = 0
				_log.append(key)
			_sf += 1
			if _sf > STEP_FRAMES:
				_check("playthrough", false, "stuck %s type=%s log=%s" % [key, Story.step_of(ch, st).get("type", "?"), _log])
				_step = 4
				_frame = 0
				return
			_drive(Story.step_of(ch, st))
		4: # [4] 끝
			if _frame < 30:
				return
			_dismiss_prompts()
			if _frame < 60:
				return
			_sq.call("toggle_journal")
			var jt: String = _sq.call("journal_text")
			_sq.call("toggle_journal")
			var ok: bool = int(_sq.call("ch")) == CH44 + 1 and jt.contains("✔ 제53장") and PartyState.count("mora") >= _mora0 + 700000 + 750000 + 840000
			_check("marker_fight", bool(_mk.get("near", false)) and bool(_mk.get("far", false)), "%s" % [_mk])
			_check("finished", ok, "ch=%d mora +%d" % [_sq.call("ch"), PartyState.count("mora") - _mora0])
			_next()
		5:
			PartyState.story = _saved.story
			PartyState.members.assign(_saved.members)
			PartyState.exp = _saved.exp
			PartyState.level = _saved.level
			PartyState.bag = _saved.bag
			PartyState.ar_paid = _saved.ar_paid
			PartyState.cycle = _saved.cycle
			EventState.resolved = _saved.resolved
			PartyState.world_quests = _saved.wq
			PartyState.party_size = _saved.party_size
			_p.global_position = _saved.pos
			print("STORY16_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

## 이 단계를 한 걸음 밟는다(프레임마다 불림).
func _drive(sd: Dictionary) -> void:
	match String(sd.type):
		"talk":
			if _sf == 2:
				_near_npc(String(sd.npc))
			if _sf == 10:
				_sq.call("interact")
				_drain()
		"sail":
			if _sf == 2:
				_near_npc(String(sd.npc))
			if _sf == 10:
				_sq.call("interact")
				_drain()
		"seal": # 석등을 차례(order)대로
			if _sf == 2:
				_put(_target() + Vector3(0.0, 0.0, 3.0))
			for k in (sd.order as Array).size():
				if _sf == 10 + k * 6:
					_sq.call("receive_element", _sq.call("seal_lamp_pos", String(sd.order[k])), 0.5, "fire")
		"climb": # 51장 — 계류 탑 윗면(칸 땅높이 + above - CLIMB_SLACK + 0.6 = 탑 윗면 바로 위에서 내려앉음)
			if _sf == 2:
				_put(_target() + Vector3(0.0, float(sd.get("above", 0.0)) - Story.CLIMB_SLACK + 0.6, 0.0))
		"go":
			if _sf == 2:
				_put(_target())
		"light":
			if _sf == 2:
				_put(_target() + Vector3(0.0, 0.0, 3.0))
			if _sf == 10:
				_sq.call("receive_element", _target() + Vector3(0.4, 0.0, 0.4), 3.0, "fire")
		"duel": # G-0075 — 곁(3m)에선 빛기둥 숨김, 50m 밖에선 보임, 그다음 쓰러뜨림
			if _sf == 2:
				_put(_target() + Vector3(0.0, 0.0, 3.0))
			if _sf == 5:
				_mk.near = not (_sq.get("_marker") as Node3D).visible
				_put(_target() + Vector3(0.0, 40.0, 50.0))
			if _sf == 8:
				_mk.far = (_sq.get("_marker") as Node3D).visible
				_put(_target() + Vector3(0.0, 0.0, 3.0))
			if _sf > 10 and _sf % 6 == 0:
				for e in _sq.call("alive_quest_enemies"):
					e.call("_die")
		"kill", "defend":
			if _sf == 2:
				_put(_target() + Vector3(0.0, 0.0, 3.0))
			if _sf > 4 and _sf % 6 == 0:
				for e in _sq.call("alive_quest_enemies"):
					e.call("_die")

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

func _dismiss_prompts() -> void:
	for n in get_tree().get_nodes_in_group("ui_modal"):
		if n == _sq or n.get("visible") == false or _pressed.has(n):
			continue
		_pressed.append(n)
		var btns := (n as Node).find_children("*", "Button", true, false)
		if not btns.is_empty():
			(btns[0] as Button).pressed.emit()

func _drain() -> void:
	var guard := 0
	while _sq.call("is_dialogue_open") and guard < 60:
		guard += 1
		if _sq.get("_dlg_waiting_choice"):
			_sq.call("choose", 0)
		else:
			_sq.call("next_line")

func _near_npc(id: String) -> void:
	_dismiss_prompts()
	_put(_sq.call("npc_pos", id) + Vector3(0.0, 0.3, 1.5))

func _put(pos: Vector3) -> void:
	_p.global_position = pos + Vector3(0.0, 0.3, 0.0)
	_p.velocity = Vector3.ZERO

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("STORY16_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
	_pressed.clear()
