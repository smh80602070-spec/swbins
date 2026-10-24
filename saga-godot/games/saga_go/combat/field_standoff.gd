extends Node

## G-0343 대치(고스트 오브 쓰시마 — 구조만) — 쉬는 무리(field_spawner CAMPS, meta go_camp — 전원 IDLE·체력 가득·깨어 있음) 곁으로
## 웅크리지 않고(웅크림은 G-0230 몰래 다가가기 길) 어그로 거리 + TRIGGER_PAD m 안에 들면 맞선다:
##   노려봄   무리에 meta "standoff" — field_enemy IDLE 이 어그로 안 하고 나를 본다. WAIT 1.0~2.2초.
##   헛몸짓   FEINT_P 확률로 한 마리가 움찔(예고 빛만 FEINT_SEC) — 그때 누르면 성급.
##   달려듦   가장 가까운 놈이 WINDOW 초 동안 내 앞으로 미끄러져 온다(예고 빛). 그 안에 평타(try_strike) → 한 칼(방패 0 · 남은 체력 +1 을 apply_damage
##            — go_rank·전리품·업적 고리 그대로) "일격!"·멈춤·흔들림 → GAP 뒤 다음 놈(창 ×CHAIN_MUL), 무리 전원까지.
##   깨짐     달려들기 전(WAIT·FEINT·GAP)에 누르면 "성급했다!"(평타는 그대로 나감) · 창을 놓치면 그 놈 한 방 · 무리 누가 맞거나 쫓기 시작하면 ·
##            맞선 자리에서 LEAVE_PAD m 벗어나면(조용히). 깨지면 남은 무리 CHASE, 그 무리는 COOL_SEC 동안 다시 안 맞섬.
## 자동 퀘스트·말 위·결투 중엔 안 한다. SAGA_STANDOFF=0 이면 안 붙는다.

const Toast := preload("res://saga_core/ui/toast.gd")
const CombatFx := preload("res://saga_core/combat_fx.gd")
const FeelTuning := preload("res://games/saga_go/combat/feel_tuning.gd")

const TRIGGER_PAD := 2.0
const LEAVE_PAD := 6.0
const SCAN_SEC := 0.1
const WAIT_MIN := 1.0
const WAIT_MAX := 2.2
const FEINT_P := 0.25
const FEINT_SEC := 0.35
const WINDOW := 0.45
const CHAIN_MUL := 0.85
const GAP_MIN := 0.5
const GAP_MAX := 1.0
const STOP_AT := 1.3   # 달려든 놈이 멈추는 내 앞 거리(m)
const COOL_SEC := 60.0
const RECOVER_SEC := 0.25
const STOP_MS := 120
const COLOR := Color(0.95, 0.95, 1.0)
const HASTY_COLOR := Color(1.0, 0.55, 0.45)

enum S { NONE, WAIT, FEINT, LUNGE, GAP }

var state := S.NONE
var camp := ""
var members: Array = []
var challenger: Node3D = null
var window := WINDOW
var _t := 0.0
var _scan_t := 0.0
var _from := Vector3.ZERO
var _anchor := Vector3.ZERO   # 맞선 자리 — 여기서 LEAVE_PAD m 넘게 벗어나면 조용히 끝
var _cool: Dictionary = {}   # camp id → 다시 맞설 수 있는 시각(ms)
var _rng := RandomNumberGenerator.new()
var _fc: Node = null
## 점검·통계
var started := 0
var kills := 0
var hasty := 0
var missed := 0
var sweeps := 0


static func attach(fc: Node) -> Node:
	if OS.get_environment("SAGA_STANDOFF") == "0":
		return null
	var n: Node = load("res://games/saga_go/combat/field_standoff.gd").new()
	n.name = "FieldStandoff"
	fc.add_child(n)
	return n


func _ready() -> void:
	add_to_group("go_field_standoff")
	_fc = get_parent()
	_rng.seed = 20260824


func _player() -> Node3D:
	return _fc.get("_player") as Node3D if _fc != null else null


func _blocked(pl: Node3D) -> bool:
	if pl == null or bool(pl.get("mounted")) or bool(pl.get("crouching")) or bool(pl.get("frozen")):
		return true
	if not bool(_fc.call("can_be_targeted")):
		return true
	var aq := get_tree().get_first_node_in_group("go_autoquest")
	var q: Variant = aq.get("q") if aq else null
	return q != null and bool(q.get("on"))


func _alive(e: Node) -> bool:
	return is_instance_valid(e) and not bool(e.call("is_dead"))


func _living() -> Array:
	return members.filter(func(e: Node) -> bool: return _alive(e))


func _flat(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()


func _nearest(pl: Node3D, list: Array) -> Node3D:
	var best: Node3D = null
	var bd := INF
	for e in list:
		var d := _flat(pl.global_position, (e as Node3D).global_position)
		if d < bd:
			bd = d
			best = e
	return best


func _physics_process(delta: float) -> void:
	if state == S.NONE:
		_scan_t -= delta
		if _scan_t <= 0.0:
			_scan_t = SCAN_SEC
			scan()
		return
	tick(delta)


## 쉬는 무리 곁이면 대치를 연다 — 열었으면 true
func scan() -> bool:
	var pl := _player()
	if state != S.NONE or _blocked(pl):
		return false
	var camps := {}
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if e.has_meta("go_camp"):
			var id := String(e.get_meta("go_camp"))
			if not camps.has(id):
				camps[id] = []
			camps[id].append(e)
	var now := Time.get_ticks_msec()
	for id in camps:
		if now < int(_cool.get(id, 0)):
			continue
		var list: Array = camps[id]
		var live: Array = []
		var ok := true
		for e in list:
			if not _alive(e):
				continue
			if int(e.get("ai")) != 0 or bool(e.get("asleep")) or float(e.get("hp")) < float(e.get("max_hp")) - 0.01:
				ok = false
				break
			live.append(e)
		if not ok or live.is_empty():
			continue
		var near := _nearest(pl, live)
		if _flat(pl.global_position, near.global_position) < float((near.get("def") as Dictionary).get("aggro", 10.0)) + TRIGGER_PAD:
			begin(String(id), live)
			return true
	return false


func begin(id: String, list: Array) -> void:
	camp = id
	members = list.duplicate()
	window = WINDOW
	challenger = null
	started += 1
	if _player() != null:
		_anchor = _player().global_position
	for e in members:
		e.set_meta("standoff", true)
	_wait(_rng.randf_range(WAIT_MIN, WAIT_MAX))
	Toast.show(_fc, "⚔ 대치 — 달려드는 순간 공격!", 2.0)
	var pl := _player()
	if pl != null:
		var n := _nearest(pl, members)
		if _fc.has_method("_reaction_text"):
			_fc.call("_reaction_text", pl, "⚔ 대치", COLOR)
			if n != null:
				_fc.call("_reaction_text", n, "⚔", COLOR)


func _wait(sec: float) -> void:
	state = S.WAIT
	_t = sec


func tick(delta: float) -> void:
	var pl := _player()
	var live := _living()
	if pl == null or live.is_empty():
		_end(false)
		return
	## 무리 누가 맞았거나(쫓기 시작) — 달려드는 놈 빼고
	for e in live:
		if e != challenger and int(e.get("ai")) != 0:
			_end(true)
			return
	if state != S.LUNGE and (_blocked(pl) or _flat(pl.global_position, _anchor) > LEAVE_PAD):
		_end(false)
		return
	_t -= delta
	match state:
		S.WAIT, S.GAP:
			if _t <= 0.0:
				if state == S.WAIT and challenger == null and _rng.randf() < FEINT_P:
					challenger = _nearest(pl, live)
					_cue(challenger)
					state = S.FEINT
					_t = FEINT_SEC
				else:
					_lunge(_nearest(pl, live))
		S.FEINT:
			if _t <= 0.0:
				if is_instance_valid(challenger):
					challenger.call("_set_tell", false)
				_wait(_rng.randf_range(0.6, 1.4))
		S.LUNGE:
			if not _alive(challenger):
				_after_kill()
				return
			var to := pl.global_position + (_from - pl.global_position).normalized() * STOP_AT
			var k := clampf(1.0 - _t / window, 0.0, 1.0)
			var p := _from.lerp(to, k)
			challenger.global_position = Vector3(p.x, _from.y, p.z)
			challenger.call("_face", pl.global_position - challenger.global_position, 1.0)
			if _t <= 0.0:
				_miss()


func _lunge(e: Node3D) -> void:
	challenger = e
	_from = e.global_position
	e.set_physics_process(false)
	_cue(e)
	state = S.LUNGE
	_t = window


## 예고(! 글·몸 부풂·공격 몸짓) — 제자리 공격 부채꼴은 끈다(달려듦엔 안 맞는 자리 표시, 촬영 lg_go_standoff 에서 반대로 그려짐)
func _cue(e: Node) -> void:
	e.call("_set_tell", true)
	var fan: Variant = e.get("_tell_fan")
	if fan is Node3D and is_instance_valid(fan):
		(fan as Node3D).visible = false


## 평타 첫머리(field_combat attack) — 한 칼이면 true(평타 대신). 달려들기 전이면 성급(대치 깨고 false → 평타 그대로).
func try_strike() -> bool:
	if state == S.NONE:
		return false
	if state != S.LUNGE or not _alive(challenger):
		hasty += 1
		var me := _player()
		if me != null and _fc.has_method("_reaction_text"):
			_fc.call("_reaction_text", me, "성급했다!", HASTY_COLOR)
		_end(true)
		return false
	var e := challenger
	var pl := _player()
	e.set_physics_process(true)
	e.call("_set_tell", false)
	e.set("shield", 0.0)
	pl.call("face_toward", e.global_position)
	pl.call("play_action", "attack", 0.3, 0.0)
	_fc.set("_attack_t", RECOVER_SEC)
	kills += 1
	CombatFx.spark(_fc, e.global_position + Vector3.UP * 1.0, COLOR, true, 1.8)
	if _fc.has_method("_reaction_text"):
		_fc.call("_reaction_text", e, "일격!", COLOR)
	var feel := get_node_or_null("/root/CombatFeel")
	if feel:
		feel.call("_do_hitstop", true, STOP_MS)
	var rig := get_tree().get_first_node_in_group("camera_rig")
	if rig:
		rig.call("shake", 0.12, 0.2)
	get_tree().call_group("go_sfx", "play", "block")
	FeelTuning.kind = "finisher"
	e.call("apply_damage", float(e.get("hp")) + 1.0, true, e.global_position - pl.global_position)
	FeelTuning.kind = "normal"
	_after_kill()
	return true


func _after_kill() -> void:
	challenger = null
	if _living().is_empty():
		sweeps += 1
		Toast.show(_fc, "⚔ 대치 완승 — 일격 %d" % members.size(), 2.5)
		_end(false)
		return
	window *= CHAIN_MUL
	state = S.GAP
	_t = _rng.randf_range(GAP_MIN, GAP_MAX)


## 창을 놓침 — 그 놈 한 방 맞고 깨짐
func _miss() -> void:
	missed += 1
	var e := challenger
	if _alive(e):
		e.set_physics_process(true)
		e.call("_set_tell", false)
		if bool(_fc.call("can_be_targeted")):
			_fc.call("take_damage", float((e.get("def") as Dictionary).get("atk", 10.0)) * float(e.get("dmg_mul")) * float(e.get("part_dmg_mul")), e)
	_end(true)


## 대치를 닫는다 — fight 면 남은 무리가 쫓아온다
func _end(fight: bool) -> void:
	for e in members:
		if not is_instance_valid(e):
			continue
		e.remove_meta("standoff")
		if not e.is_physics_processing():
			e.set_physics_process(true)
		if _alive(e):
			e.call("_set_tell", false)
			if fight and int(e.get("ai")) == 0:
				e.set("ai", 1)   # AI.CHASE
	if camp != "":
		_cool[camp] = Time.get_ticks_msec() + int(COOL_SEC * 1000.0)
	state = S.NONE
	camp = ""
	members = []
	challenger = null
	_scan_t = SCAN_SEC
