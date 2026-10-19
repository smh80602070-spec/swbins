extends Node

## G-0235 잡기·던지기(웹 W-0277 field-grab.js 이식 — 구조만, 이름·수치는 우리 것) — 들판 전투(field_combat.gd)의 자식.
## 5 키(패드 R3 · 폰 ✊ 단추)로 GRAB_R 안 가장 가까운 잡몹을 잡아(LIFT 초 머리 위로 들기) 바라보는 쪽 THROW_M 으로 던진다.
## 던진 몸은 속도+중력 move_and_slide 진짜 포물선(field_enemy.gd Grab.THROWN — 벽에 막히고 비탈에 내린다).
## 닿으면 던진 적에게 기본 공격력 ×MUL, 그다음 넘어뜨림 DOWN_T 초 + 떨어진 자리 LAND_R 안 다른 잡몹도 넘어짐.
## 보스는 잡히지 않고 밀쳐진다(SHOVE_M · SHOVE_STAGGER 초 휘청, 피해 없음). 쿨 CD 초 — 대상이 없으면 안 쓴다.
## 잡은 적이 죽거나 내가 맞으면(field_combat.take_damage) 놓는다. 탈것을 타면 놓는다. 저장할 것 없음.

const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")

const GRAB_R := 1.5
const CD := 6.0
const THROW_M := 5.0
const LAND_R := 2.0
const DOWN_T := 1.5
const MUL := 1.2
const SHOVE_M := 2.5
const SHOVE_STAGGER := 0.4
const LIFT := 0.3
const FLY := 0.45 # 머리 높이에서 THROW_M 앞 땅에 닿기까지(평지 기준) — 던지는 속도를 이것으로 정한다
const KNOCK_DECAY := 30.0 # field_enemy _knock 줄어드는 빠르기(m/s²) — 밀치기 거리 맞춤
const BUTTON_TICK := 0.2

var cd := 0.0
var held: Node = null
var last: Dictionary = {} # 점검용 — 마지막 결과 {kind: "throw"/"shove", base, dmg, downed}
var _fc: Node = null
var _t := 0.0
var _dir := Vector3.FORWARD
var _btn_t := 0.0

func _ready() -> void:
	_fc = get_parent()

func _player() -> CharacterBody3D:
	return _fc.get("_player") as CharacterBody3D

## 지금 잡을(밀칠) 적 — 쿨·이미 든 중·탈것이면 null.
func target() -> Node3D:
	var p := _player()
	if p == null or cd > 0.0 or held != null or bool(p.get("mounted")):
		return null
	var best: Node3D = null
	var best_d := GRAB_R
	for e in _fc.call("_enemies_near", p.global_position, GRAB_R):
		if int(e.get("grab_state")) != 0:
			continue
		var d := Vector2(e.global_position.x - p.global_position.x, e.global_position.z - p.global_position.z).length()
		if d <= best_d:
			best_d = d
			best = e
	return best

## 잡기(밀치기). 돌려주는 것: {ok, cd?, none?, shove?}.
func grab() -> Dictionary:
	var p := _player()
	if p == null or bool(p.get("mounted")):
		return {"ok": false}
	if cd > 0.0:
		return {"ok": false, "cd": cd}
	if held != null:
		return {"ok": false}
	var e := target()
	if e == null:
		return {"ok": false, "none": true}
	cd = CD
	var to := e.global_position - p.global_position
	to.y = 0.0
	if to.length() < 0.01:
		to = p.call("facing")
	if e.is_in_group("go_boss"):
		e.call("knockback", to, sqrt(2.0 * KNOCK_DECAY * SHOVE_M))
		e.call("stagger", SHOVE_STAGGER)
		_fc.call("_ring_fx", e.global_position, 1.2, Color(0.95, 0.9, 0.75), 0.3)
		last = {"kind": "shove", "uid": e.get_instance_id()}
		return {"ok": true, "shove": true}
	var f: Vector3 = p.call("facing")
	f.y = 0.0
	_dir = f.normalized() if f.length() > 0.01 else to.normalized()
	held = e
	_t = 0.0
	e.call("grab_by", p)
	p.call("play_action", "attack", LIFT, 0.2)
	return {"ok": true}

## 놓기(내가 맞음·탈것) — 던지지 않고 내려놓는다. 쿨은 그대로.
func release() -> void:
	if held != null and is_instance_valid(held):
		held.call("release_grab")
	held = null

func _physics_process(delta: float) -> void:
	cd = maxf(cd - delta, 0.0)
	if held != null:
		var p := _player()
		if not is_instance_valid(held) or held.call("is_dead") or int(held.get("grab_state")) != 1:
			held = null
		elif p == null or bool(p.get("mounted")):
			release()
		else:
			_t += delta
			if _t >= LIFT:
				_throw()
	_btn_t -= delta
	if _btn_t <= 0.0:
		_btn_t = BUTTON_TICK
		_refresh_button()

## 머리 높이(field_enemy HOLD_UP)에서 FLY 초 뒤 THROW_M 앞 같은 높이 땅에 닿게 — vy = (½gT² − h)/T.
func _throw() -> void:
	var e := held
	held = null
	var g := FieldEnemy.GRAVITY
	var h := FieldEnemy.HOLD_UP
	var v := _dir * (THROW_M / FLY)
	v.y = (0.5 * g * FLY * FLY - h) / FLY
	e.connect("thrown_landed", _on_landed, CONNECT_ONE_SHOT)
	e.call("throw_with", v)

func _on_landed(e: Node) -> void:
	if not is_instance_valid(e) or e.call("is_dead"):
		return
	var at: Vector3 = (e as Node3D).global_position
	## 맞힌 뒤 넘어뜨린다 — 넘어짐 보정이 생겨도 ×MUL 에 얹히지 않게(함정).
	var base: float = float(_fc.call("_normal_atk")) * MUL
	_fc.set("_crit_id", _fc.call("active_id"))
	var dealt: float = _fc.call("_deal", e, base, "", _dir)
	_fc.set("_crit_id", "")
	var downed := 0
	if not e.call("is_dead"):
		e.call("knock_down", DOWN_T)
		downed += 1
	for o in _fc.call("_enemies_near", at, LAND_R):
		if o == e or o.is_in_group("go_boss") or int(o.get("grab_state")) != 0:
			continue
		o.call("knock_down", DOWN_T)
		downed += 1
	_fc.call("_ring_fx", at, LAND_R, Color(0.9, 0.8, 0.6), 0.4)
	var rig := get_tree().get_first_node_in_group("camera_rig")
	if rig:
		rig.call("shake", 0.1, 0.2)
	last = {"kind": "throw", "uid": e.get_instance_id(), "base": base, "dmg": dealt, "downed": downed, "at": at}

## 폰 ✊ — 잡을 적이 가까우면 밝게, 쿨이면 흐리게.
func _refresh_button() -> void:
	var b: Control = (_fc.get("_touch_buttons") as Dictionary).get("go_grab", null)
	if b == null:
		return
	b.modulate.a = 0.35 if cd > 0.0 else (1.0 if target() != null else 0.6)
