extends Node
## G-0235 잡기·던지기(games/saga_go/combat/field_grab.gd) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가
## SAGA_GRAB_THROW_PROBE 가 있을 때만 단다.
##
##   SAGA_GRAB_THROW_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## 들판 늑대 자리(땅)에서 다른 적은 잠깐 치워 두고(그룹에서 빼고 멈춤) 점검용 늑대를 세운다(전리품·되살아남 없음).
## 적이 나를 노리지 않게 "duel_active" 더미를 단다(맞으면 놓기 점검 때만 뗀다).
## ① 먼 적 거절(쿨 안 씀) ② 1.5m 잡힘·머리 위 ③ 쿨 중 거절 ④ 던지기 — 5m 안팎 착지·×1.2·던진 적+2m 안 둘 넘어짐·먼 적 그대로
## ⑤ 보스 밀치기만(안 잡힘·피해 없음·밀려남·휘청) ⑥ 벽에 막힘 ⑦ 맞으면 놓음(충돌 층 되돌림)

const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const FieldGrab := preload("res://games/saga_go/combat/field_grab.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")

var _p: CharacterBody3D
var _fc: Node
var _g: Node
var _frame := 0
var _step := 0
var _fails := 0
var _anchor := Vector3.ZERO
var _parked: Array = []
var _mine: Array = []
var _dummy: Node = null
var _a: Node = null
var _b: Node = null
var _c: Node = null
var _d: Node = null
var _start := Vector3.ZERO
var _wall: StaticBody3D = null
var _boss: Node = null
var _boss_hp := 0.0
var _boss_pos := Vector3.ZERO

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _fc == null:
		_fc = get_tree().get_first_node_in_group("go_field_combat")
		if _fc:
			_g = _fc.get("grab")
		return
	match _step:
		0: # 준비 — 60틱 뒤(땅에 내려앉게) 늑대 자리를 닻으로, 나머지 적은 치운다
			if _frame < 60:
				return
			_check("setup", _g != null and _g is FieldGrab, "grab=%s" % [_g])
			var best: Node3D = null
			var best_d := 1e9
			var want := TestMap.world_pos(1, 4)
			for e in get_tree().get_nodes_in_group("field_enemy"):
				if e.is_in_group("go_boss"):
					continue
				var d := ((e as Node3D).global_position - want).length()
				if d < best_d and not e.call("is_dead"):
					best_d = d
					best = e
			_anchor = best.global_position if best else want
			for e in get_tree().get_nodes_in_group("field_enemy"):
				if e.is_in_group("go_boss"):
					continue
				e.remove_from_group("field_enemy")
				e.process_mode = Node.PROCESS_MODE_DISABLED
				_parked.append(e)
			_dummy = Node.new()
			_dummy.add_to_group("duel_active")
			add_child(_dummy)
			_stand()
			_next()
		1: # ① 먼 적 거절 — 3m 앞 늑대 하나뿐이면 안 잡히고 쿨도 안 돈다
			if _frame == 1:
				_d = _wolf(_start + Vector3(0, 0.5, -3.0))
			elif _frame == 20:
				var r: Dictionary = _g.call("grab")
				_check("far_reject", not bool(r.ok) and bool(r.get("none", false)) and float(_g.get("cd")) == 0.0 and _g.get("held") == null, "r=%s cd=%.2f" % [r, float(_g.get("cd"))])
				_kill(_d)
				_next()
		2: # ② 1.5m 잡힘 ③ 쿨 중 거절
			if _frame == 1:
				_stand()
				_a = _wolf(_start + Vector3(0, 0.5, -1.2))
			elif _frame == 20:
				_place(_a, _start + Vector3(0, 0.0, -1.2))
				var land := _start + Vector3(0, 0, -FieldGrab.THROW_M)
				_b = _wolf(land + Vector3(1.0, 0.5, 0.0))
				_c = _wolf(land + Vector3(-1.0, 0.5, 0.0))
				_d = _wolf(land + Vector3(0.0, 0.5, -6.0))
			elif _frame == 40:
				_stand()
				_place(_a, _start + Vector3(0, 0.0, -1.2))
				var r: Dictionary = _g.call("grab")
				var r2: Dictionary = _g.call("grab")
				_check("grab_near", bool(r.ok) and _g.get("held") == _a and int(_a.get("grab_state")) == FieldEnemy.Grab.HELD and not bool(r.get("shove", false)), "r=%s" % [r])
				_check("cd_reject", not bool(r2.ok) and float(r2.get("cd", 0.0)) > FieldGrab.CD - 0.1, "r2=%s" % [r2])
			elif _frame == 43:
				var up: float = (_a as Node3D).global_position.y - _p.global_position.y
				_check("held_overhead", absf(up - FieldEnemy.HOLD_UP) < 0.05 and int(_a.get("collision_layer")) == 0, "up=%.2f layer=%d" % [up, int(_a.get("collision_layer"))])
				_g.set("last", {})
			elif _frame > 43:
				var last: Dictionary = _g.get("last")
				if String(last.get("kind", "")) == "throw":
					_check_throw(last)
					_next()
				elif _frame > 300:
					_check("throw", false, "timeout state=%d" % int(_a.get("grab_state")))
					_next()
		3: # ⑤ 보스 밀치기만
			if _frame == 1:
				_cleanup_mine()
				_g.set("cd", 0.0)
				var fb := get_tree().get_first_node_in_group("go_field_bosses")
				_boss = fb.call("boss", "gale_roc") if fb else null
				if _boss == null:
					_check("boss", false, "no boss")
					_next()
					return
				_boss.set("skill_cd", 999.0)
				_boss.set("skill", "")
				var bp: Vector3 = (_boss as Node3D).global_position
				_p.global_position = bp + Vector3(0, 0.3, 1.3)
				_p.velocity = Vector3.ZERO
			elif _frame == 30:
				var bp: Vector3 = (_boss as Node3D).global_position
				_p.global_position = bp + Vector3(0, 0.3, 1.3)
				_p.velocity = Vector3.ZERO
				_p.call("face_toward", bp)
				_boss_hp = float(_boss.get("hp"))
				_boss_pos = bp
				var r: Dictionary = _g.call("grab")
				var stag: bool = int(_boss.get("ai")) == FieldEnemy.AI.RECOVER and float(_boss.get("_t")) >= FieldGrab.SHOVE_STAGGER - 0.01
				_check("boss_shove", bool(r.ok) and bool(r.get("shove", false)) and _g.get("held") == null and int(_boss.get("grab_state")) == 0 and stag, "r=%s ai=%d" % [r, int(_boss.get("ai"))])
			elif _frame == 70:
				var moved := Vector2((_boss as Node3D).global_position.x - _boss_pos.x, (_boss as Node3D).global_position.z - _boss_pos.z).length()
				_check("boss_pushed", moved >= 1.5 and moved <= 3.5 and is_equal_approx(float(_boss.get("hp")), _boss_hp), "moved=%.2f hp %.0f→%.0f" % [moved, _boss_hp, float(_boss.get("hp"))])
				_next()
		4: # ⑥ 벽에 막힘 — 앞 2m 벽으로 던지면 2.5m 못 간다
			if _frame == 1:
				_g.set("cd", 0.0)
				_stand()
				_a = _wolf(_start + Vector3(0, 0.5, -1.0))
				_wall = StaticBody3D.new()
				var cs := CollisionShape3D.new()
				var box := BoxShape3D.new()
				box.size = Vector3(8.0, 6.0, 0.4)
				cs.shape = box
				_wall.add_child(cs)
				get_tree().current_scene.add_child(_wall)
				_wall.global_position = _start + Vector3(0, 2.0, -2.2)
			elif _frame == 20:
				_stand()
				_place(_a, _start + Vector3(0, 0.0, -1.0))
				_g.set("last", {})
				var r: Dictionary = _g.call("grab")
				if not bool(r.ok):
					_check("wall", false, "grab failed r=%s" % [r])
					_next()
			elif _frame > 20:
				var last: Dictionary = _g.get("last")
				if String(last.get("kind", "")) == "throw":
					var at: Vector3 = last.at
					var dz := _start.z - at.z
					_check("wall", dz < 2.5, "dz=%.2f" % dz)
					_wall.queue_free()
					_next()
				elif _frame > 300:
					_check("wall", false, "timeout")
					_wall.queue_free()
					_next()
		5: # ⑦ 맞으면 놓음
			if _frame == 1:
				_cleanup_mine()
				_g.set("cd", 0.0)
				_stand()
				_a = _wolf(_start + Vector3(0, 0.5, -1.0))
			elif _frame == 20:
				_stand()
				_place(_a, _start + Vector3(0, 0.0, -1.0))
				var r: Dictionary = _g.call("grab")
				_dummy.remove_from_group("duel_active")
				_fc.call("take_damage", 1.0, null)
				_dummy.add_to_group("duel_active")
				_check("hit_release", bool(r.ok) and _g.get("held") == null and int(_a.get("grab_state")) == 0 and int(_a.get("collision_layer")) != 0, "r=%s state=%d" % [r, int(_a.get("grab_state"))])
				_fc.call("revive_all")
				_next()
		6:
			_cleanup_mine()
			for e in _parked:
				if is_instance_valid(e):
					e.add_to_group("field_enemy")
					e.process_mode = Node.PROCESS_MODE_INHERIT
			_g.set("cd", 0.0)
			print("GRAB_THROW_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _check_throw(last: Dictionary) -> void:
	var at: Vector3 = last.at
	var dist := Vector2(at.x - _start.x, at.z - _start.z).length()
	var want_base: float = float(_fc.call("_normal_atk")) * FieldGrab.MUL
	_check("throw_land", dist > 3.5 and dist < 6.5, "dist=%.2f dy=%.2f" % [dist, at.y - _start.y])
	_check("throw_mul", is_equal_approx(float(last.base), want_base) and float(last.dmg) > 0.0, "base=%.2f want=%.2f dmg=%.2f" % [float(last.base), want_base, float(last.dmg)])
	var near_ok: bool = bool(_a.call("is_downed")) and bool(_b.call("is_downed")) and bool(_c.call("is_downed")) and int(last.downed) == 3
	_check("throw_down", near_ok, "a=%s b=%s c=%s n=%d" % [_a.call("is_downed"), _b.call("is_downed"), _c.call("is_downed"), int(last.downed)])
	_check("far_untouched", not bool(_d.call("is_downed")), "d downed")
	_check("thrown_layer", int(_a.get("grab_state")) == 0 and int(_a.get("collision_layer")) != 0, "state=%d" % int(_a.get("grab_state")))

## 닻 자리에 서서 -Z 를 본다.
func _stand() -> void:
	_p.global_position = _anchor + Vector3(0, 0.3, 0)
	_p.velocity = Vector3.ZERO
	_p.call("face_toward", _anchor + Vector3(0, 0, -5.0))
	_start = _anchor

func _wolf(pos: Vector3) -> Node:
	var e := FieldEnemy.new()
	e.name = "GrabProbeWolf%d" % _mine.size()
	e.setup("wolf", pos, 7 + _mine.size())
	e.set("drops", false)
	e.set("respawns", false)
	get_tree().current_scene.add_child(e)
	_mine.append(e)
	return e

func _place(e: Node, pos: Vector3) -> void:
	(e as Node3D).global_position = Vector3(pos.x, (e as Node3D).global_position.y, pos.z)
	e.set("velocity", Vector3.ZERO)

func _kill(e: Node) -> void:
	if is_instance_valid(e):
		_mine.erase(e)
		e.queue_free()

func _cleanup_mine() -> void:
	for e in _mine:
		if is_instance_valid(e):
			e.queue_free()
	_mine.clear()

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("GRAB_THROW_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
