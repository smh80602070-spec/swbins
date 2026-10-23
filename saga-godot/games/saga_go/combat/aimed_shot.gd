extends Node

## PLAN 106장 ㊵ — 활 조준 사격(원신 조준 모드 문법). field_combat.gd 의 자식으로 붙는다(GO 만).
##   R / 터치 "조준"          조준 켜고 끔 — 활을 든 인물만. 걷거나 뛰거나 활 아닌 인물로 바꾸면 풀린다.
##   조준 중 왼쪽(공격) 누르기  충전을 시작하고 떼면 쏜다 — CHARGE_FULL_SEC 전이면 물리 ×AIM_MUL,
##                            넘기면 그 인물 원소 ×CHARGED_MUL(충전 사격)
##   (조준 밖) 활 인물이 공격을 길게  강공격 대신 조준으로 들어가 충전 — 떼면 쏘고 나온다(원신 활 강공격)
## 카메라는 오른 어깨 너머(camera_rig.set_aim), 화면 가운데 조준점 + 충전 고리.
## 화살은 물리 몸체 없이 프레임마다 날아간다(ARROW_SPEED, ARROW_GRAVITY 로 조금 떨어짐 — 쏠 때 그만큼
## 들어 올려 조준점엔 정확히 닿는다). 땅·벽·몸체는 레이어 1 광선, 들판 적은 **보이는 몸** 높이 원기둥
## (물리 캡슐이 짐승 몸보다 작다), 과녁은 판 둘레 공, 그룹 "arrow_stop"(석등 머리)은 거기서 멎는다. 적 몸 위쪽 WEAK_FRAC 부터는 급소 — 반드시 치명타.
## 충전 화살(원소)은 멈춘 자리 둘레 RECEIVE_RADIUS 로 element_receiver(석등·옛 제단)도 밝힌다.

const Elements := preload("res://games/saga_go/combat/elements.gd")
const Weapons := preload("res://games/saga_go/data/weapons.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const CHARGE_FULL_SEC := 1.4
const AIM_MUL := 0.45
const CHARGED_MUL := 1.25
const SHOT_GAP := 0.3
const ARROW_SPEED := 60.0
const ARROW_GRAVITY := 4.0
const ARROW_LIFE := 1.6
const AIM_RANGE := 110.0
const WEAK_FRAC := 0.7
const RECEIVE_RADIUS := 1.2
const MOVE_EXIT := 0.3
const STICK_SEC := 2.0
const CHEST_H := 1.35
const WEAK_COLOR := Color(1.0, 0.88, 0.35)
const ARROW_WOOD := Color(0.92, 0.86, 0.66)
const ENERGY_PER_HIT := 5.0 # field_combat.gd ENERGY_PER_HIT 와 같게(서로 preload 하면 돌고 돈다)

signal weak_hit() # 106장 ㊸ 업적(명사수)이 센다

var active := false
var hold := false # 길게 눌러 들어온 조준 — 떼면 쏘고 나간다
var charging := false
var charge_t := 0.0
var shots := 0
var last_hit: Dictionary = {} # 점검용 {kind, weak, dealt, el, pos, node}
var _gap := 0.0
var _fc: Node
var _player: CharacterBody3D
var _arrows: Array = [] # {node, pos, vel, left, el, amount, full, id}
var _cross: Crosshair


func _ready() -> void:
	_fc = get_parent()
	_player = _fc.get("_player")
	_build_hud()


func bow_active() -> bool:
	return Weapons.type_of(_fc.call("active_id")) == "bow"


func can_aim() -> bool:
	if _player == null or _player.get("frozen") or _fc.call("_duel_open"):
		return false
	return bow_active() and bool(_player.call("can_aim"))


func toggle() -> bool:
	if active:
		exit()
		return false
	return enter(false)


func enter(hold_mode := false) -> bool:
	if active:
		return true
	if not can_aim():
		if not hold_mode and not bow_active():
			Toast.show(_fc, "조준은 활을 든 인물만 — 지금 %s(%s)" % [_fc.call("display_name", _fc.call("active_id")), Weapons.TYPE_NAMES[Weapons.type_of(_fc.call("active_id"))]], 2.0)
		return false
	active = true
	hold = hold_mode
	charging = hold_mode
	charge_t = 0.0
	_player.set("aiming", true)
	var rig := _rig()
	if rig:
		rig.call("set_aim", true)
	_cross.visible = true
	return true


func exit() -> void:
	if not active:
		return
	active = false
	hold = false
	charging = false
	charge_t = 0.0
	_player.set("aiming", false)
	var rig := _rig()
	if rig:
		rig.call("set_aim", false)
	_cross.visible = false


func begin_charge() -> bool:
	if not active or _gap > 0.0:
		return false
	charging = true
	charge_t = 0.0
	return true


## 공격 단추를 뗌 — 충전 중이었으면 쏜다.
func release() -> bool:
	if not active or not charging:
		return false
	charging = false
	fire_at(aim_point(), charge_t >= CHARGE_FULL_SEC)
	if hold:
		exit()
	return true


func charge_ratio() -> float:
	return clampf(charge_t / CHARGE_FULL_SEC, 0.0, 1.0)


## 화면 가운데가 가리키는 자리 — 카메라에서 곧게, 땅·몸체(광선)와 적·과녁(보이는 몸) 중 가까운 것.
func aim_point() -> Vector3:
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return _player.global_position + (_player.call("facing") as Vector3) * 30.0 + Vector3.UP * CHEST_H
	var dir := -cam.global_basis.z
	var from := cam.global_position + dir * 0.5
	var to := cam.global_position + dir * AIM_RANGE
	var h := first_hit(from, to)
	return to if h.is_empty() else h.pos


## 쏜다 — point 로 가는 화살 하나. full 이면 원소 충전 사격. 쏜 화살 정보를 돌려준다(점검용).
func fire_at(point: Vector3, full: bool) -> Dictionary:
	_gap = SHOT_GAP
	shots += 1
	var id: String = _fc.call("active_id")
	var el: String = _fc.call("active_element") if full else _fc.call("_normal_el")
	var from := _player.global_position + Vector3.UP * CHEST_H
	_player.call("face_toward", point)
	_player.call("play_action", "attack", 0.3, 0.0)
	var dist := maxf(from.distance_to(point), 0.5)
	var vel := (point - from).normalized() * ARROW_SPEED
	vel.y += 0.5 * ARROW_GRAVITY * dist / ARROW_SPEED # 떨어지는 만큼 들어 쏜다 — 조준점엔 정확히
	var amount: float = float(_fc.call("_normal_atk")) * (CHARGED_MUL if full else AIM_MUL)
	var a := {"node": _arrow_mesh(el, full), "pos": from, "vel": vel, "left": ARROW_LIFE, "el": el, "amount": amount, "full": full, "id": id}
	_arrows.append(a)
	_place(a)
	return a


func _physics_process(delta: float) -> void:
	_gap = maxf(_gap - delta, 0.0)
	if active:
		if not can_aim():
			exit()
		elif not hold and (_player.call("_movement_input") as Vector2).length() > MOVE_EXIT:
			exit()
		else:
			var cam := get_viewport().get_camera_3d()
			if cam:
				var f := -cam.global_basis.z
				f.y = 0.0
				if f.length() > 0.01:
					_player.call("face_toward", _player.global_position + f)
			if charging:
				var was := charge_t >= CHARGE_FULL_SEC
				charge_t += delta
				if not was and charge_t >= CHARGE_FULL_SEC:
					CombatFeel.ui()
	var i := 0
	while i < _arrows.size():
		if _step(_arrows[i], delta):
			_arrows.remove_at(i)
		else:
			i += 1
	if _cross.visible:
		_cross.ratio = charge_ratio() if charging else 0.0
		_cross.color = Elements.color_of(_fc.call("active_element")) if charge_t >= CHARGE_FULL_SEC and charging else Color.WHITE
		_cross.queue_redraw()


## 화살 한 걸음 — 끝났으면 true.
func _step(a: Dictionary, delta: float) -> bool:
	var p0: Vector3 = a.pos
	var v: Vector3 = a.vel
	v.y -= ARROW_GRAVITY * delta
	var p1 := p0 + v * delta
	a.vel = v
	var h := first_hit(p0, p1)
	if not h.is_empty():
		_impact(a, h)
		return true
	a.pos = p1
	a.left = float(a.left) - delta
	if float(a.left) <= 0.0:
		(a.node as Node3D).queue_free()
		return true
	_place(a)
	return false


func _impact(a: Dictionary, h: Dictionary) -> void:
	var el: String = a.el
	var dealt := 0.0
	match String(h.kind):
		"enemy":
			var e: Node3D = h.node
			_fc.set("_crit_id", String(a.id))
			_fc.set("force_crit", bool(h.weak))
			dealt = _fc.call("_deal", e, float(a.amount), el, a.vel as Vector3)
			_fc.set("force_crit", false)
			_fc.set("_crit_id", "")
			if h.weak:
				_fc.call("_reaction_text", e, "급소!", WEAK_COLOR)
				weak_hit.emit()
				if e.has_method("part_hit"):
					e.call("part_hit", dealt)   # G-0342 보스 약점 부수기
			_fc.call("_gain_energy", ENERGY_PER_HIT)
			_fc.call("_rain_follow")
		"target":
			(h.node as Node).call("strike", el)
	if a.full and el != "":
		get_tree().call_group("element_receiver", "receive_element", h.pos as Vector3, RECEIVE_RADIUS, el)
		_fc.call("_ring_fx", h.pos as Vector3, 0.9, Elements.color_of(el), 0.3)
	last_hit = {"kind": h.kind, "weak": h.get("weak", false), "dealt": dealt, "el": el, "pos": h.pos, "node": h.get("node")}
	var node: Node3D = a.node
	if String(h.kind) == "world":
		## 박힌 화살 — 잠깐 꽂혀 있다 사라진다.
		node.global_position = h.pos
		var tw := node.create_tween()
		tw.tween_interval(STICK_SEC)
		tw.tween_property(node, "scale", Vector3.ONE * 0.01, 0.2)
		tw.tween_callback(node.queue_free)
	else:
		node.queue_free()

# ---------------------------------------------------------------- 맞는 자리

## 선분 p0→p1 에서 처음 닿는 것 {kind: world/enemy/target, pos, node, weak, s} — 없으면 {}.
func first_hit(p0: Vector3, p1: Vector3) -> Dictionary:
	var out := {}
	var best := 2.0
	var seg := p1 - p0
	var seg_len := seg.length()
	if seg_len < 0.0001:
		return out
	var q := PhysicsRayQueryParameters3D.create(p0, p1, 1)
	q.exclude = [_player.get_rid()]
	var r := _player.get_world_3d().direct_space_state.intersect_ray(q)
	if not r.is_empty():
		var col: Object = r.collider
		best = p0.distance_to(r.position) / seg_len
		if col is Node and (col as Node).is_in_group("field_enemy"):
			var en := col as Node3D
			out = {"kind": "enemy", "pos": r.position, "node": en, "weak": _is_weak(en, r.position), "s": best}
		else:
			out = {"kind": "world", "pos": r.position, "s": best}
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if e.call("is_dead"):
			continue
		var en := e as Node3D
		var hb := _hitbox(en)
		var base := en.global_position
		var flat := Vector2(base.x - p0.x, base.z - p0.z).length()
		if flat > seg_len + hb.x + 1.0:
			continue
		var s := _seg_cylinder(p0, seg, base, hb.x, hb.y)
		if s >= 0.0 and s < best:
			best = s
			var pos := p0 + seg * s
			out = {"kind": "enemy", "pos": pos, "node": en, "weak": _is_weak(en, pos), "s": s}
	## 몸체 없는 것 중 화살이 멎는 것(석등 머리 등 — 노드 meta arrow_y·arrow_r).
	for n in get_tree().get_nodes_in_group("arrow_stop"):
		var sc: Vector3 = (n as Node3D).global_position + Vector3.UP * float(n.get_meta("arrow_y", 1.0))
		if sc.distance_to(p0) > seg_len + 2.0:
			continue
		var s := _seg_sphere(p0, seg, sc, float(n.get_meta("arrow_r", 0.4)))
		if s >= 0.0 and s < best:
			best = s
			out = {"kind": "world", "pos": p0 + seg * s, "s": s}
	for t in get_tree().get_nodes_in_group("shoot_target"):
		var c: Vector3 = t.call("center")
		if c.distance_to(p0) > seg_len + 2.0:
			continue
		var s := _seg_sphere(p0, seg, c, float(t.get("radius")))
		if s >= 0.0 and s < best:
			best = s
			out = {"kind": "target", "pos": p0 + seg * s, "node": t, "s": s}
	return out


## 적 몸 판정 원기둥(반지름, 높이) — 보이는 몸 기준(field_enemy._build_overhead 와 같은 높이 셈).
func _hitbox(e: Node3D) -> Vector2:
	var def: Dictionary = e.get("def")
	var h := 1.0
	if e.get("kind") == "bandit" or def.get("vroid", false):
		h = 1.75 * float(def.get("size", 1.0))
	elif def.has("height"):
		h = float(def.height)
	var r := maxf(float(def.get("body_r", 0.45)), h * 0.28)
	return Vector2(r, h)


func _is_weak(e: Node3D, pos: Vector3) -> bool:
	return pos.y - e.global_position.y >= _hitbox(e).y * WEAK_FRAC


## 선분(p0 + seg·s, s∈[0,1])이 공에 처음 닿는 s — 없으면 -1.
static func _seg_sphere(p0: Vector3, seg: Vector3, c: Vector3, r: float) -> float:
	var m := p0 - c
	var a := seg.dot(seg)
	var b := m.dot(seg)
	var cc := m.dot(m) - r * r
	if cc <= 0.0:
		return 0.0
	var disc := b * b - a * cc
	if disc < 0.0:
		return -1.0
	var s := (-b - sqrt(disc)) / a
	return s if s >= 0.0 and s <= 1.0 else -1.0


## 선분이 선 원기둥(바닥 가운데 base, 반지름 r, 높이 h)에 처음 닿는 s — 없으면 -1.
static func _seg_cylinder(p0: Vector3, seg: Vector3, base: Vector3, r: float, h: float) -> float:
	## 옆으로(xz) 원 안에 있는 구간 [s0, s1]
	var mx := p0.x - base.x
	var mz := p0.z - base.z
	var a := seg.x * seg.x + seg.z * seg.z
	var b := mx * seg.x + mz * seg.z
	var c := mx * mx + mz * mz - r * r
	var s0 := 0.0
	var s1 := 1.0
	if a < 0.000001:
		if c > 0.0:
			return -1.0
	else:
		var disc := b * b - a * c
		if disc < 0.0:
			return -1.0
		var sq := sqrt(disc)
		s0 = maxf((-b - sq) / a, 0.0)
		s1 = minf((-b + sq) / a, 1.0)
	## 높이 안에 있는 구간
	var y0 := base.y
	var y1 := base.y + h
	if absf(seg.y) < 0.000001:
		if p0.y < y0 or p0.y > y1:
			return -1.0
	else:
		var ta := (y0 - p0.y) / seg.y
		var tb := (y1 - p0.y) / seg.y
		s0 = maxf(s0, minf(ta, tb))
		s1 = minf(s1, maxf(ta, tb))
	return s0 if s0 <= s1 and s0 <= 1.0 else -1.0

# ---------------------------------------------------------------- 모양

func _rig() -> Node:
	return get_tree().get_first_node_in_group("camera_rig")


func _arrow_mesh(el: String, full: bool) -> Node3D:
	var root := Node3D.new()
	root.name = "Arrow"
	var col := Elements.color_of(el) if el != "" else ARROW_WOOD
	var shaft := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.02
	cyl.bottom_radius = 0.02
	cyl.height = 0.8
	cyl.radial_segments = 5
	shaft.mesh = cyl
	shaft.rotation_degrees = Vector3(90, 0, 0) # 몸 축을 앞(-Z)으로
	shaft.position = Vector3(0, 0, 0.4)
	shaft.material_override = _glow(col.lerp(ARROW_WOOD, 0.5), 1.0)
	root.add_child(shaft)
	var head := MeshInstance3D.new()
	var cone := CylinderMesh.new()
	cone.top_radius = 0.0
	cone.bottom_radius = 0.06
	cone.height = 0.16
	cone.radial_segments = 6
	head.mesh = cone
	head.rotation_degrees = Vector3(-90, 0, 0)
	head.position = Vector3(0, 0, -0.06)
	head.material_override = _glow(col, 1.0)
	root.add_child(head)
	if full:
		var glow := MeshInstance3D.new()
		var sph := SphereMesh.new()
		sph.radius = 0.14
		sph.height = 0.28
		glow.mesh = sph
		glow.material_override = _glow(col, 0.55)
		root.add_child(glow)
	for mi in root.get_children():
		(mi as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	get_tree().current_scene.add_child(root)
	return root


func _place(a: Dictionary) -> void:
	var n: Node3D = a.node
	var p: Vector3 = a.pos
	var v: Vector3 = a.vel
	n.global_position = p
	if v.length() > 0.01:
		var up := Vector3.UP if absf(v.normalized().y) < 0.98 else Vector3.RIGHT
		n.look_at(p + v, up)


func _glow(color: Color, alpha: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(color.r, color.g, color.b, alpha)
	if alpha < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	return m


func _build_hud() -> void:
	var layer := CanvasLayer.new()
	layer.name = "AimHUD"
	add_child(layer)
	_cross = Crosshair.new()
	_cross.set_anchors_preset(Control.PRESET_FULL_RECT)
	_cross.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_cross.visible = false
	layer.add_child(_cross)


## 화면 가운데 조준점 — 흰 테·가운데 점, 충전은 바깥 고리가 차오르고 다 차면 인물 원소 색.
class Crosshair extends Control:
	var ratio := 0.0
	var color := Color.WHITE

	func _draw() -> void:
		var c := size * 0.5
		var shade := Color(0, 0, 0, 0.45)
		draw_arc(c, 14.0, 0.0, TAU, 32, shade, 4.0)
		draw_arc(c, 14.0, 0.0, TAU, 32, Color(1, 1, 1, 0.85), 2.0)
		draw_circle(c, 2.5, color)
		for k in 4:
			var d := Vector2.RIGHT.rotated(PI * 0.5 * k)
			draw_line(c + d * 18.0, c + d * 26.0, Color(1, 1, 1, 0.85), 2.0)
		if ratio > 0.0:
			draw_arc(c, 32.0, -PI * 0.5, -PI * 0.5 + TAU * ratio, 48, color, 4.0)
