extends Node

## G-0306 말 위 전투(웹 W-0304 mount-combat 짝) — 지상 탈것을 탄 채:
##   평타 = 말 위 베기(field_combat.attack 그대로, 피해 ×(1 + SPEED_BONUS × 빠르기 비율) — 비율 = 지금 수평 빠르기 ÷ 탄 뒤 잰 최고)
##   E(combat_ult) = 돌진: 앞 CHARGE_R 안 적 ×CHARGE_MUL + 넘어뜨림(밀침·비틀 1초), 쿨 CHARGE_CD
##   맞으면 낙마 — 내리고 FALL_SEC 동안 못 침. 나는 탈것 위에선 치지 않는다(내리지도 않음).
## 다른 전투 입력(원소 폭발·회피·조준·잡기)은 탈 때 그대로 막힌다. 포획은 조우 창이 내리게 둔다(옛 길).
## mount.gd 는 이 노드(go_field_mount)가 있으면 "공격 = 내림"을 안 한다. SAGA_MOUNT_FIGHT=0 이면 안 붙는다(옛 길).

const Toast := preload("res://saga_core/ui/toast.gd")
const CombatFx := preload("res://saga_core/combat_fx.gd")

const SPEED_BONUS := 0.5
const CHARGE_R := 3.5
const CHARGE_MUL := 1.6
const CHARGE_CD := 6.0
const CHARGE_STAG := 1.0
const FALL_SEC := 0.8
const MIN_TOP := 4.0   # 처음 탄 뒤 최고 빠르기의 바닥(서서 치면 비율 0)

var _fc: Node = null
var _top := MIN_TOP
var charge_cd := 0.0
var _rode := false


static func attach(fc: Node) -> Node:
	if OS.get_environment("SAGA_MOUNT_FIGHT") == "0":
		return null
	var n: Node = load("res://games/saga_go/combat/field_mount.gd").new()
	n.name = "FieldMount"
	fc.add_child(n)
	return n


func _ready() -> void:
	add_to_group("go_field_mount")
	_fc = get_parent()


func _pl() -> Node3D:
	return _fc.get("_player") as Node3D if _fc else null


## 탈것 조종 노드(saga_core/player/mount.gd — 주인공 자식, dismount 를 가진 것).
func _mount() -> Node:
	var p := _pl()
	if p == null:
		return null
	for c in p.get_children():
		if c.has_method("dismount") and c.has_method("is_riding"):
			return c
	return null


func riding() -> bool:
	var p := _pl()
	return p != null and bool(p.get("mounted"))


func flying() -> bool:
	var p := _pl()
	return riding() and (bool(p.get("fly_on")) or (p.has_method("is_flying_now") and bool(p.call("is_flying_now"))))


func speed_now() -> float:
	var p := _pl() as CharacterBody3D
	return Vector2(p.velocity.x, p.velocity.z).length() if p else 0.0


func _process(delta: float) -> void:
	charge_cd = maxf(charge_cd - delta, 0.0)
	if riding():
		if not _rode:
			_top = MIN_TOP
		_rode = true
		_top = maxf(_top, speed_now())
	else:
		_rode = false


## 빠르기 배율 — 지상 탈것 위에서만(아니면 1).
func mul() -> float:
	if not riding() or flying():
		return 1.0
	return 1.0 + SPEED_BONUS * clampf(speed_now() / maxf(_top, 0.01), 0.0, 1.0)


## field_combat._unhandled_input 이 탈 때 묻는다 — true 면 그 입력을 평소대로(평타만). 돌진은 여기서 하고 false.
func allows(event: InputEvent) -> bool:
	if event.is_action_pressed("combat_ult"):
		if not flying():
			charge()
		return false
	if event.is_action("combat_quick"):
		if flying():
			if event.is_pressed():
				Toast.show(_fc, "나는 동안엔 칠 수 없다", 1.2)
			return false
		return true
	return false


## 돌진 — 앞의 적을 쳐 넘긴다. 쿨이면 false.
func charge() -> bool:
	if not riding() or flying() or charge_cd > 0.0:
		if charge_cd > 0.0:
			Toast.show(_fc, "돌진 %.0f초" % ceilf(charge_cd), 1.0)
		return false
	var p := _pl()
	var fwd: Vector3 = p.call("facing")
	var center := p.global_position + fwd * (CHARGE_R * 0.6)
	charge_cd = CHARGE_CD
	_fc.call("_ring_fx", center, CHARGE_R, Color(0.95, 0.85, 0.6), 0.35)
	CombatFx.slash(p, fwd, CHARGE_R, CombatFx.PHYSICAL, 3, true)
	p.call("play_action", "strong", 0.45, 1.0)
	var hits := 0
	_fc.set("_crit_id", _fc.call("active_id"))
	for e in _fc.call("_enemies_near", center, CHARGE_R):
		var dir: Vector3 = (e as Node3D).global_position - p.global_position
		dir.y = 0.0
		_fc.call("_deal", e, float(_fc.call("_normal_atk")) * CHARGE_MUL, "", dir)
		if not e.call("is_dead"):
			e.call("knockback", dir if dir.length() > 0.1 else fwd, 9.0)
			e.call("stagger", CHARGE_STAG)
		hits += 1
	var rig := get_tree().get_first_node_in_group("camera_rig")
	if rig:
		rig.call("shake", 0.14, 0.25)
	if hits > 0 and _fc.has_method("_reaction_text"):
		_fc.call("_reaction_text", p, "돌진!", Color(1.0, 0.85, 0.5))
	return true


## field_combat.take_damage 가 맞은 뒤 부른다 — 탄 채 맞으면 낙마.
func on_hurt() -> void:
	if not riding():
		return
	var m := _mount()
	if m != null:
		m.call("dismount", "낙마!")
	_fc.set("_attack_t", maxf(float(_fc.get("_attack_t")), FALL_SEC))
