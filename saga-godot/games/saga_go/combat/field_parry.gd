extends Node

## G-0304 쳐내기(웹 W-0375 field-parry 짝) — 적 예고(field_enemy AI.WINDUP)의 남은 PARRY_WIN 초 안에 평타를 누르고
## 그 적이 사거리(무기 reach + REACH_PAD) 안이면: 그 공격은 안 나가고(무피해) 적은 비틀(STAG, 보스 BOSS_STAG — stagger 재사용,
## 그동안 받는 피해 ×STAG_TAKEN) · 다음 내 한 타 ×NEXT_MUL(한 번만). 이르면 그냥 평타.
## 자동 퀘스트가 켜져 있으면 안 쓴다(자동은 그대로). SAGA_PARRY=0 이면 안 붙는다.

const Elements := preload("res://games/saga_go/combat/elements.gd")
const CombatFx := preload("res://saga_core/combat_fx.gd")

const PARRY_WIN := 0.25
const REACH_PAD := 0.5
const STAG := 1.2
const BOSS_STAG := 0.5
const STAG_TAKEN := 1.2
const NEXT_MUL := 2.0
const RECOVER_SEC := 0.2   # 쳐낸 뒤 다음 평타까지
const STOP_MS := 90
const COLOR := Color(1.0, 0.92, 0.55)

var _fc: Node = null
var _next := false
var parries := 0   # 점검·통계


static func attach(fc: Node) -> Node:
	if OS.get_environment("SAGA_PARRY") == "0":
		return null
	var n: Node = load("res://games/saga_go/combat/field_parry.gd").new()
	n.name = "FieldParry"
	fc.add_child(n)
	return n


func _ready() -> void:
	add_to_group("go_field_parry")
	_fc = get_parent()


static func window_open(e: Node) -> bool:
	return int(e.get("ai")) == 2 and float(e.get("_t")) <= PARRY_WIN   # AI.WINDUP


static func is_boss(e: Node) -> bool:
	var s: Script = e.get_script()
	return s != null and String(s.resource_path).ends_with("field_boss.gd")


func _auto_on() -> bool:
	var aq := get_tree().get_first_node_in_group("go_autoquest")
	var q: Variant = aq.get("q") if aq else null
	return q != null and bool(q.get("on"))


## 평타 첫머리 — 쳐냈으면 true(평타 대신).
func try_parry(reach: float) -> bool:
	if _auto_on():
		return false
	var pl := _fc.get("_player") as Node3D
	if pl == null:
		return false
	var best: Node3D = null
	var bd := INF
	for e in _fc.call("_enemies_near", pl.global_position, reach + REACH_PAD):
		if not window_open(e) or bool(e.get("_hit_siege")):
			continue
		var d := pl.global_position.distance_to((e as Node3D).global_position)
		if d < bd:
			bd = d
			best = e
	if best == null:
		return false
	var sec := BOSS_STAG if is_boss(best) else STAG
	best.call("stagger", sec)
	best.set_meta("parried_until", Engine.get_physics_frames() + int(sec * Engine.physics_ticks_per_second))
	_next = true
	parries += 1
	pl.call("face_toward", best.global_position)
	pl.call("play_action", "attack", 0.3, 0.0)
	_fc.set("_attack_t", RECOVER_SEC)
	CombatFx.spark(_fc, best.global_position + Vector3.UP * 1.0, COLOR, true, 1.6)
	if _fc.has_method("_reaction_text"):
		_fc.call("_reaction_text", best, "쳐냄!", COLOR)
	var feel := get_node_or_null("/root/CombatFeel")
	if feel:
		feel.call("_do_hitstop", true, STOP_MS)
	var rig := get_tree().get_first_node_in_group("camera_rig")
	if rig:
		rig.call("shake", 0.1, 0.18)
	get_tree().call_group("go_sfx", "play", "block")   # 막는 쇳소리
	return true


## _deal 의 피해 배율 — 다음 한 타 ×NEXT_MUL(한 번 쓰고 끔) · 비틀 중인 적 ×STAG_TAKEN.
func mul(enemy: Node) -> float:
	var m := 1.0
	if _next:
		_next = false
		m *= NEXT_MUL
	if Engine.get_physics_frames() < int(enemy.get_meta("parried_until", 0)):
		m *= STAG_TAKEN
	return m
