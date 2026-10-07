extends Node
## GO 이야기 13부(G-0074, 42장~ — 회차 전용) 자동 점검 — 평소엔 안 붙는다. 12부 probe_story12.
## test_village.gd 가 SAGA_STORY13_PROBE 가 있을 때만 단다.
##
##   SAGA_STORY13_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## [1] 표·자리 — 본편 41장(MAIN_CHAPTERS)·전체 44장 · 42·43·44장 단계 종류·장 id·ar 85·cycle 1 · 보스 "그날의 검은 가면"(뇌, 방패는 불로 깨짐)
##     · 단계 자리(지역 안·충돌에 안 묻힘)
## [2] 잠금 — 회차 0 이면 42장 잠김·추적 글 "별배 재출항(1회차)"·일지 같은 글 · 그래도 재출항은 막히지 않음(본편 41장 끝) · 회차 1 이면 열림
## [3] 42장부터 44장 끝까지 단계마다 자동으로 밟는다(talk·go·kill·light·climb·duel·sail) — 장 끝 보상
## [4] 끝 — ch=44·일지 ✔ 제44장·모라
## 이야기 상태·회차·부대 경험·가방은 끝에 되돌린다. 저장은 안 한다.

const Story := preload("res://games/saga_go/data/story.gd")
const Cycle := preload("res://games/saga_go/data/cycle.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")

const CH42 := 41 # 42장(0부터)
const CH44 := 43
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
			PartyState.cycle = 0
			PartyState.story = {"ch": CH42, "step": 0}
			_sq.call("set_track", "")
			_sq.call("_enter_step")
			_mora0 = PartyState.count("mora")
			_next()
		1: # [1] 표·자리
			if _frame < 60:
				return
			var bad: Array = []
			if Story.MAIN_CHAPTERS != 41 or Story.CHAPTERS.size() != 44 or not Story.main_done(41) or Story.main_done(40):
				bad.append("count main=%d all=%d" % [Story.MAIN_CHAPTERS, Story.CHAPTERS.size()])
			var want := {"ch42": ["talk", "talk", "go", "kill", "light", "talk"], "ch43": ["talk", "climb", "talk", "duel", "talk", "talk"],
				"ch44": ["talk", "sail", "kill", "talk", "sail", "talk"]}
			for i in 3:
				var c := Story.chapter(CH42 + i)
				var types: Array = (c.steps as Array).map(func(sd: Dictionary) -> String: return String(sd.type))
				var cid := "ch%d" % (42 + i)
				if String(c.get("id", "")) != cid or types != want[cid] or int(c.ar) != 85 or int(c.get("cycle", 0)) != 1 or c.has("join"):
					bad.append("chapter %d %s ar=%s cycle=%s" % [42 + i, types, c.get("ar"), c.get("cycle")])
				for si in (c.steps as Array).size():
					var sd: Dictionary = c.steps[si]
					if sd.has("npc") and not Story.NPCS.has(String(sd.npc)):
						bad.append("npc %s" % sd.npc)
					if sd.has("region"):
						var pos := _cell(String(sd.region), sd.cell)
						if TestMap.region_at(pos) != String(sd.region):
							bad.append("region ch%d/%d" % [42 + i, si])
						if not _hits(pos).is_empty():
							bad.append("buried ch%d/%d %s" % [42 + i, si, _hits(pos)])
			var boss: Dictionary = FieldEnemy.KINDS.get("dawn_mask", {})
			if String(boss.get("element", "")) != "thunder" or float(boss.get("phase_shield", 0.0)) <= 0.0 or Elements.SHIELD_COUNTER.get("thunder", "") != "fire" \
					or not bool(boss.get("vroid", false)):
				bad.append("boss")
			_check("tables", bad.is_empty(), str(bad))
			_next()
		2: # [2] 잠금 — 회차 0 → 잠김, 재출항은 열림 · 회차 1 → 열림
			if _frame == 5:
				_sq.call("toggle_journal")
				var jt: String = _sq.call("journal_text")
				_sq.call("toggle_journal")
				var tt: String = _sq.call("tracker_text")
				var ok: bool = bool(_sq.call("locked")) and tt.contains("별배 재출항(1회차)") and jt.contains("제42장 · 되읽는 항해 일지  (별배 재출항(1회차)") \
					and Cycle.story_done() and Cycle.blocker() == ""
				_check("locked_until_cycle", ok, "locked=%s tracker='%s' blocker='%s'" % [_sq.call("locked"), tt.replace("\n", " / "), Cycle.blocker()])
				PartyState.cycle = 1
				_sq.call("_enter_step")
			if _frame == 30:
				var tt2: String = _sq.call("tracker_text")
				_check("open_on_cycle", not bool(_sq.call("locked")) and not tt2.contains("열린다"), "tracker='%s'" % tt2.replace("\n", " / "))
				_next()
		3: # [3] 42~44장을 자동으로 밟는다
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
			var ok: bool = int(_sq.call("ch")) == CH44 + 1 and jt.contains("✔ 제44장") and PartyState.count("mora") >= _mora0 + 240000 + 270000 + 360000
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
			print("STORY13_PROBE_DONE fails=%d" % _fails)
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
		"go", "climb":
			if _sf == 2:
				_put(_target())
		"light":
			if _sf == 2:
				_put(_target() + Vector3(0.0, 0.0, 3.0))
			if _sf == 10:
				_sq.call("receive_element", _target() + Vector3(0.4, 0.0, 0.4), 3.0, "fire")
		"kill", "defend", "duel":
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
	print("STORY13_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
	_pressed.clear()
