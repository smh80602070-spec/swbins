extends Node
## GO 결말 뒤(PLAN 106장 52-5 — 밤의 잔불·이야기 보스 재대결) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_AFTERMATH_PROBE 가 있을 때만 단다.
##
##   SAGA_AFTERMATH_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## [1] 결말 전(29장 중) — 밤이어도 잔불 없음 · 재대결 입구 숨김·near_gate 안 잡힘·enter 안 됨
## [2] 결말 뒤 낮 — 잔불 없음 · 재대결 입구 넷 보임 · 입구·잔불 자리가 명소에 안 묻힘 · 지역 맞음
## [3] 결말 뒤 밤 — 잔불 일곱 · 먼 데선 잔당 안 섬 [4] 마을 잔불에 다가가면 잔당(kind 수) · 멀리 가면 거둠 · 다시 와서 다 쓰러뜨리면
## 꺼지고 보상·오늘 끈 목록 [5] 다음 날 다시 핌 [6] 재대결 먹구름 임금 참몸 — 입구 3m → 들어가 보스 하나(kind)·240초 · 쓰러뜨리고 보상(주간 할인 셈).
## 이야기·가방·원기·주간·잔불 상태는 끝에 되돌린다. 저장은 안 한다.

const Domains := preload("res://games/saga_go/data/domains.gd")
const NightEchoes := preload("res://games/saga_go/data/night_echoes.gd")
const Commissions := preload("res://games/saga_go/data/commissions.gd")
const NE := preload("res://games/saga_go/world/night_echoes.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")

const REMATCH := ["rematch_king", "rematch_fox", "rematch_crow", "rematch_colossus"]
## 55-5 — 2차 결말(38장) 뒤에만 열리는 재대결 둘
const REMATCH2 := ["rematch_first_crow", "rematch_garmuri"]
## 56-2 — 3차 결말(41장) 뒤에만 열리는 재대결 하나
const REMATCH3 := ["rematch_seed"]
## G-0076 — 13부(회차 전용) 끝(44장) 뒤에만 열리는 재대결 하나
const REMATCH4 := ["rematch_dawn"]
const BOSS_OF := {"rematch_king": "storm_king_true", "rematch_fox": "rift_fox", "rematch_crow": "rift_crow", "rematch_colossus": "dome_colossus", "rematch_dawn": "dawn_mask", "rematch_first_crow": "first_crow", "rematch_garmuri": "garmuri_true", "rematch_seed": "seed_giant"}

var _p: CharacterBody3D
var _ne: Node
var _dm: Node
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
	if _ne == null:
		_ne = get_tree().get_first_node_in_group("go_night_echoes")
		_dm = get_tree().get_first_node_in_group("go_domains")
		_frame = 0
		return
	match _step:
		0:
			_saved = {"story": PartyState.story.duplicate(true), "bag": PartyState.bag.duplicate(true), "resin": PartyState.resin, "resin_t": PartyState.resin_t,
				"weekly": PartyState.weekly.duplicate(true), "ne": PartyState.night_echo.duplicate(true), "pos": _p.global_position, "level": PartyState.level}
			PartyState.night_echo = {}
			PartyState.weekly = {}
			PartyState.resin_t = 0.0
			PartyState.level = maxi(PartyState.level, 60)
			PartyState.story = {"ch": 28, "step": 3}
			TimeOfDay.force(true)
			_next()
		1: # [1] 결말 전
			if _frame == 40:
				_put(_dm.call("gate_pos", "rematch_king") + Vector3(0, 0, 1.0))
			if _frame == 45:
				var embers := NightEchoes.ECHOES.filter(func(r: Array) -> bool: return bool(_ne.call("ember_visible", String(r[0]))))
				var gates := REMATCH.filter(func(id: String) -> bool: return _gate_node(id).visible)
				var near: String = _dm.call("near_gate")
				var entered: bool = _dm.call("enter", "rematch_king", 0)
				_check("before_ending", embers.is_empty() and gates.is_empty() and near == "" and not entered and not NightEchoes.unlocked(),
					"embers=%d gates=%s near=%s entered=%s" % [embers.size(), gates, near, entered])
				PartyState.story = {"ch": 29, "step": 0}
				TimeOfDay.force(false)
				_next()
		2: # [2] 결말 뒤 낮
			if _frame < 40:
				return
			var bad: Array = []
			for r in NightEchoes.ECHOES:
				var id := String(r[0])
				if bool(_ne.call("ember_visible", id)):
					bad.append("ember by day %s" % id)
				var ep := NE.pos_of(id)
				if TestMap.region_at(ep) != String(r[1]):
					bad.append("region %s" % id)
				if not _hits(ep).is_empty():
					bad.append("ember buried %s %s" % [id, _hits(ep)])
			for id in REMATCH:
				var d: Dictionary = Domains.DOMAINS[id]
				if not _gate_node(id).visible or not Domains.domain_open(id) or not bool(d.get("boss", false)) or String(d.waves[0][0]) != String(BOSS_OF[id]):
					bad.append("gate %s" % id)
				var gp: Vector3 = _dm.call("gate_pos", id)
				if TestMap.region_at(gp) != String(d.gate[0]):
					bad.append("gate region %s" % id)
				if not _hits(gp).is_empty():
					bad.append("gate buried %s %s" % [id, _hits(gp)])
			for id in REMATCH2 + REMATCH3:
				if _gate_node(id).visible or Domains.domain_open(id):
					bad.append("gate2 early %s" % id)
			_check("after_ending_day", bad.is_empty(), str(bad))
			TimeOfDay.force(true)
			_put(NE.pos_of("village") + Vector3(0, 0, 40.0))
			_next()
		3: # [3] 밤 — 잔불 열, 먼 데선 잔당 안 섬
			if _frame < 40:
				return
			var lit := NightEchoes.ECHOES.filter(func(r: Array) -> bool: return bool(_ne.call("ember_visible", String(r[0]))))
			var ok: bool = lit.size() == NightEchoes.ECHOES.size() and NightEchoes.ECHOES.size() == 10 and (_ne.call("foes", "village") as Array).is_empty()
			_check("night_embers", ok, "lit=%d foes=%d" % [lit.size(), (_ne.call("foes", "village") as Array).size()])
			_next()
		4: # [4] 마을 잔불 — 다가가면 잔당 · 멀리 가면 거둠 · 다시 와 다 쓰러뜨리면 꺼지고 보상
			if _frame == 1:
				_put(NE.pos_of("village") + Vector3(0, 0, 8.0))
				_v = {"mora": PartyState.count("mora"), "talent": PartyState.count("talent_2")}
			if _frame == 5:
				_v.n = (_ne.call("foes", "village") as Array).size()
				_put(NE.pos_of("village") + Vector3(0, 0, 80.0))
			if _frame == 8:
				_v.gone = (_ne.call("foes", "village") as Array).is_empty() and bool(_ne.call("ember_visible", "village"))
				_put(NE.pos_of("village") + Vector3(0, 0, 8.0))
			if _frame == 12:
				_v.n2 = (_ne.call("foes", "village") as Array).size()
				for e in _ne.call("foes", "village"):
					e.call("_die")
			if _frame == 20:
				var ok: bool = int(_v.n) == 3 and bool(_v.gone) and int(_v.n2) == 3 and not bool(_ne.call("ember_visible", "village")) \
					and PartyState.count("mora") == int(_v.mora) + 20000 and PartyState.count("talent_2") == int(_v.talent) + 1 \
					and NightEchoes.done_today() == ["village"] and bool(_ne.call("ember_visible", "coast"))
				_check("village_echo", ok, "%s mora+%d done=%s" % [_v, PartyState.count("mora") - int(_v.mora), NightEchoes.done_today()])
				Commissions.time_offset += 86400.0
				_next()
		5: # [5] 다음 날 — 다시 핀다
			if _frame < 40:
				return
			_check("next_day", bool(_ne.call("ember_visible", "village")) and NightEchoes.done_today().is_empty(), "done=%s" % [NightEchoes.done_today()])
			Commissions.time_offset -= 86400.0
			TimeOfDay.force(false)
			_next()
		6: # [6] 재대결 — 먹구름 임금 참몸
			if _frame == 1:
				_put(_dm.call("gate_pos", "rematch_king") + Vector3(0, 0, 1.0))
			if _frame == 4:
				_v = {"near": String(_dm.call("near_gate")), "entered": bool(_dm.call("enter", "rematch_king", 0)), "resin": Domains.resin_now(), "mat": PartyState.count("boss_mat")}
			if _frame == 200:
				var alive: Array = _dm.call("alive_enemies")
				_v.n = alive.size()
				_v.kind = String(alive[0].get("kind")) if alive.size() == 1 else ""
				_v.time = float(_dm.get("time_left"))
				for e in alive:
					e.call("_die")
			if _frame == 205:
				_p.global_position = Domains.DOMAINS.rematch_king.arena + Vector3(0.0, 0.6, 1.0)
				_p.velocity = Vector3.ZERO
			if _frame == 215:
				var ok: bool = _v.near == "rematch_king" and bool(_v.entered) and int(_v.n) == 1 and _v.kind == "storm_king_true" and float(_v.time) > 225.0 \
					and bool(_dm.get("claimed")) and Domains.resin_now() == int(_v.resin) - 30 and PartyState.count("boss_mat") == int(_v.mat) + 1 and Domains.weekly_claims() == 1
				_check("rematch_king", ok, "%s claimed=%s resin=%d mat=%d claims=%d" % [_v, _dm.get("claimed"), Domains.resin_now(), PartyState.count("boss_mat"), Domains.weekly_claims()])
			if _frame == 400:
				_next()
		7: # [7] 2차 결말(38장) 뒤 — 새 재대결 입구 둘 열림·자리 맞음, 처음의 별까마귀 재대결 입장
			if _frame == 1:
				PartyState.story = {"ch": 38, "step": 0}
			if _frame == 45:
				var bad: Array = []
				for id in REMATCH2:
					var d: Dictionary = Domains.DOMAINS[id]
					if not _gate_node(id).visible or not Domains.domain_open(id) or String(d.waves[0][0]) != String(BOSS_OF[id]):
						bad.append("gate2 %s" % id)
					var gp: Vector3 = _dm.call("gate_pos", id)
					if TestMap.region_at(gp) != String(d.gate[0]):
						bad.append("gate2 region %s" % id)
					if not _hits(gp).is_empty():
						bad.append("gate2 buried %s %s" % [id, _hits(gp)])
				for id in REMATCH3:
					if _gate_node(id).visible or Domains.domain_open(id):
						bad.append("gate3 early %s" % id) # 38장 뒤엔 아직 닫혀 있다
				_check("after_second_ending", bad.is_empty(), str(bad))
				_put(_dm.call("gate_pos", "rematch_first_crow") + Vector3(0, 0, 1.0))
			if _frame == 50:
				_v = {"near": String(_dm.call("near_gate")), "entered": bool(_dm.call("enter", "rematch_first_crow", 0))}
			if _frame == 250:
				var alive: Array = _dm.call("alive_enemies")
				_check("rematch_first_crow", _v.near == "rematch_first_crow" and bool(_v.entered) and alive.size() == 1 and String(alive[0].get("kind")) == "first_crow", "%s n=%d" % [_v, alive.size()])
				for e in alive:
					e.call("_die")
				_dm.call("leave") # 다음 입구에 들어가려면 이 비경에서 나와야 한다
			if _frame == 400:
				_next()
		8: # [8] 3차 결말(41장) 뒤 — 곳간 노래 재대결 입구가 열림·자리 맞음·입장
			if _frame == 1:
				PartyState.story = {"ch": 41, "step": 0}
			if _frame == 45:
				var bad: Array = []
				for id in REMATCH3:
					var d: Dictionary = Domains.DOMAINS[id]
					if not _gate_node(id).visible or not Domains.domain_open(id) or String(d.waves[0][0]) != String(BOSS_OF[id]):
						bad.append("gate3 %s" % id)
					var gp: Vector3 = _dm.call("gate_pos", id)
					if TestMap.region_at(gp) != String(d.gate[0]):
						bad.append("gate3 region %s" % id)
					if not _hits(gp).is_empty():
						bad.append("gate3 buried %s %s" % [id, _hits(gp)])
				for id in REMATCH4:
					if _gate_node(id).visible or Domains.domain_open(id):
						bad.append("gate4 early %s" % id) # 41장 뒤엔 아직 닫혀 있다(13부 끝 뒤)
				_check("after_third_ending", bad.is_empty(), str(bad))
				_put(_dm.call("gate_pos", "rematch_seed") + Vector3(0, 0, 1.0))
			if _frame == 50:
				_v = {"near": String(_dm.call("near_gate")), "entered": bool(_dm.call("enter", "rematch_seed", 0))}
			if _frame == 250:
				var alive: Array = _dm.call("alive_enemies")
				_check("rematch_seed", _v.near == "rematch_seed" and bool(_v.entered) and alive.size() == 1 and String(alive[0].get("kind")) == "seed_giant", "%s n=%d" % [_v, alive.size()])
				for e in alive:
					e.call("_die")
				_dm.call("leave") # 다음 입구에 들어가려면 이 비경에서 나와야 한다
			if _frame == 400:
				_next()
		9: # [9] G-0076 13부 끝(44장) 뒤 — 그날 노래의 메아리 입구가 열림·자리 맞음·입장
			if _frame == 1:
				PartyState.story = {"ch": 44, "step": 0}
			if _frame == 45:
				var bad: Array = []
				for id in REMATCH4:
					var d: Dictionary = Domains.DOMAINS[id]
					if not _gate_node(id).visible or not Domains.domain_open(id) or String(d.waves[0][0]) != String(BOSS_OF[id]):
						bad.append("gate4 %s" % id)
					var gp: Vector3 = _dm.call("gate_pos", id)
					if TestMap.region_at(gp) != String(d.gate[0]):
						bad.append("gate4 region %s" % id)
					if not _hits(gp).is_empty():
						bad.append("gate4 buried %s %s" % [id, _hits(gp)])
				_check("after_cycle_story", bad.is_empty(), str(bad))
				_put(_dm.call("gate_pos", "rematch_dawn") + Vector3(0, 0, 1.0))
			if _frame == 50:
				_v = {"near": String(_dm.call("near_gate")), "entered": bool(_dm.call("enter", "rematch_dawn", 0))}
			if _frame == 250:
				var alive: Array = _dm.call("alive_enemies")
				_check("rematch_dawn", _v.near == "rematch_dawn" and bool(_v.entered) and alive.size() == 1 and String(alive[0].get("kind")) == "dawn_mask", "%s n=%d" % [_v, alive.size()])
				for e in alive:
					e.call("_die")
				_dm.call("leave")
			if _frame == 400:
				_next()
		10:
			TimeOfDay.force(null)
			PartyState.story = _saved.story
			PartyState.bag = _saved.bag
			PartyState.resin = _saved.resin
			PartyState.resin_t = _saved.resin_t
			PartyState.weekly = _saved.weekly
			PartyState.night_echo = _saved.ne
			PartyState.level = _saved.level
			_p.global_position = _saved.pos
			print("AFTERMATH_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _gate_node(id: String) -> Node3D:
	return _dm.find_child("DomainGate_" + id, true, false) as Node3D

## 그 자리 1.2m 위에 걸리는 충돌(집·바위·명소) — 땅(지형)은 그 아래라 안 걸린다.
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

func _put(p: Vector3) -> void:
	_p.global_position = p + Vector3(0.0, 0.3, 0.0)
	_p.velocity = Vector3.ZERO

func _next() -> void:
	_step += 1
	_frame = 0

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("AFTERMATH_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])
