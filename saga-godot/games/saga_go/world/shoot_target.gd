extends Node3D

## PLAN 106장 ㊵ — 과녁 하나(원신 "과녁 맞히기" 퍼즐 문법). 보물 상자 잠금 "target" 이 셋씩 세운다
## (treasure_chest.gd). 맞으면 hold_sec 동안 금빛으로 켜져 있고, 그 안에 한 상자의 과녁을 다 켜면 봉인이 풀린다.
## 맞히는 것: 활 조준 화살(combat/aimed_shot.gd — 공처럼 둘레 radius 안을 지나면) · 법구·활 기본 공격
## (가까운 적이 없을 때 사거리 안 과녁을 친다, field_combat.attack). 몸 판정은 물리 몸체 없이 거리로만 —
## 사람·적 길을 막지 않는다.
##   sway > 0 이면 기둥 없이 떠서 좌우로 sway m 오간다(SWAY_PERIOD 초 한 번).

signal struck(target: Node3D)

const CreatureBuilder := preload("res://saga_core/world/creature_builder.gd")

const BOARD_R := 0.6
const SWAY_PERIOD := 4.0
const LIT_COLOR := Color(1.0, 0.82, 0.3)

var hold_sec := 10.0
var radius := BOARD_R + 0.15 # 화살 판정은 판보다 조금 너그럽게
var height := 3.0
var sway := 0.0
var lit_t := 0.0
var keep_lit := false # 봉인이 풀린 뒤엔 켜진 채로
var _base := Vector3.ZERO
var _phase := 0.0
var _t := 0.0
var _board: Node3D
var _face_mats: Array[ShaderMaterial] = []
var _face_cols: Array[Color] = []


## 좌표는 모두 부모(상자) 기준 — add_child 전에 부른다(_ready 가 이 값으로 짓는다).
func setup(ground_pos: Vector3, board_h: float, face_to: Vector3, sway_m: float, phase: float) -> void:
	height = board_h
	sway = sway_m
	_phase = phase
	position = ground_pos
	var d := face_to - ground_pos
	rotation.y = atan2(d.x, d.z)


func _ready() -> void:
	add_to_group("shoot_target")
	_base = position
	var wood := Color(0.5, 0.36, 0.22)
	if sway <= 0.0:
		var post := CylinderMesh.new()
		post.top_radius = 0.07
		post.bottom_radius = 0.1
		post.height = height - BOARD_R * 0.5
		CreatureBuilder._add(self, post, Vector3(0, post.height * 0.5, 0), Vector3.ZERO, wood, true)
	_board = Node3D.new()
	_board.name = "Board"
	_board.position = Vector3(0, height, 0)
	add_child(_board)
	## 앞(+Z)을 보는 둥근 판 — 테 흰·붉은 셋에 한가운데 붉은 점.
	var rings := [[BOARD_R, Color(0.95, 0.93, 0.86)], [0.44, Color(0.82, 0.2, 0.16)], [0.28, Color(0.95, 0.93, 0.86)], [0.13, Color(0.82, 0.2, 0.16)]]
	for i in rings.size():
		var cyl := CylinderMesh.new()
		cyl.top_radius = rings[i][0]
		cyl.bottom_radius = rings[i][0]
		cyl.height = 0.08
		cyl.radial_segments = 20
		var mi: MeshInstance3D = CreatureBuilder._add(_board, cyl, Vector3(0, 0, 0.012 * i), Vector3(90, 0, 0), rings[i][1], i == 0)
		_face_mats.append(mi.material_override as ShaderMaterial)
		_face_cols.append(rings[i][1])
	if sway > 0.0:
		## 떠 있는 과녁 — 판 뒤 바람 고리(퓨전 — 원작 그림 아님).
		var ring := MeshInstance3D.new()
		var tor := TorusMesh.new()
		tor.inner_radius = BOARD_R + 0.08
		tor.outer_radius = BOARD_R + 0.16
		tor.rings = 24
		tor.ring_segments = 6
		ring.mesh = tor
		var gm := StandardMaterial3D.new()
		gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		gm.albedo_color = Color(0.7, 0.95, 0.9, 0.6)
		ring.material_override = gm
		ring.rotation_degrees = Vector3(90, 0, 0)
		ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_board.add_child(ring)


## 물리 틱으로 센다(벽시계가 아니라 — 점검이 판마다 같게).
func _physics_process(delta: float) -> void:
	_t += delta
	if sway > 0.0:
		var s := sin(TAU * (_t / SWAY_PERIOD) + _phase)
		position = _base + basis.x * (s * sway)
	if lit_t > 0.0 and not keep_lit:
		lit_t -= delta
		if lit_t <= 0.0:
			_paint(false)


## 판 한가운데(화살 판정 자리).
func center() -> Vector3:
	return _board.global_position if _board else global_position + Vector3.UP * height


func is_lit() -> bool:
	return keep_lit or lit_t > 0.0


## 맞음 — 이미 켜져 있어도 시간을 새로 채운다. element 는 지금 쓰지 않는다(어느 원소든, 물리든).
func strike(_element: String = "") -> bool:
	if keep_lit:
		return false
	var was := lit_t > 0.0
	lit_t = hold_sec
	_paint(true)
	if not was and _board:
		var tw := _board.create_tween()
		tw.tween_property(_board, "scale", Vector3.ONE * 1.25, 0.08)
		tw.tween_property(_board, "scale", Vector3.ONE, 0.18)
	struck.emit(self)
	return true


func lock_lit() -> void:
	keep_lit = true
	_paint(true)


func _paint(on: bool) -> void:
	## 켜지면 흰 테는 금빛, 붉은 테는 금빛이 도는 주황(셀 셰이더 틴트만 바꾼다).
	for i in _face_mats.size():
		var c: Color = LIT_COLOR.lerp(_face_cols[i], 0.3 * float(i % 2)) if on else _face_cols[i]
		_face_mats[i].set_shader_parameter("albedo_tint", c)
