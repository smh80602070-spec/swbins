extends Node3D

## G-0407 4종횡 금 줍는 펫(메이플스토리 펫 — 따라다니며 떨어진 메소를 주워 옴). 몸은 공용 신수 구미호(CreatureBuilder.build_pet, 작게).
##   따라다님  주인공 뒤(바라보는 반대쪽 FOLLOW_BACK)·조금 앞쪽 깊이(FOLLOW_Z)로 SPEED m/s · 주인공 높이를 따라(뛰면 같이)
##   줍기     PICK_SEC 마다 주인공 PICK_R 안의 금(story_gold_pickup 의 "story_gold" 무리) 가장 가까운 것으로 달려가,
##            닿으면(GRAB_R) 그 금을 주인공 자리로 옮긴다 — 금 Area 가 주인공에 닿아 원래 길(StorySaveState.add_gold·알림)로 들어간다
##   장비는 안 줍는다(요구 레벨 게이트가 있어 스스로 골라 끼우는 맛을 남김). SAGA_STORY_PET=0 이면 없음. picked 는 점검용.

const CreatureBuilder := preload("res://saga_core/world/creature_builder.gd")

const PET_ID := "pt_gumiho"
const HEIGHT := 0.7
const FOLLOW_BACK := 1.3
const FOLLOW_Z := 0.6
const SPEED := 9.0
const PICK_SEC := 0.25
const PICK_R := 7.0
const GRAB_R := 0.6
const GROUP := "story_gold"

var picked := 0
var target: Node3D = null
var _player: Node3D = null
var _body: Node3D = null
var _anim: AnimationPlayer = null
var _scan := 0.0
var _face := 1.0
var _k := 1.0


static func enabled() -> bool:
	return OS.get_environment("SAGA_STORY_PET") != "0"


## 주인공 곁(scene 루트)에 하나만 붙인다.
static func attach(player: Node3D) -> Node3D:
	if not enabled() or player == null or player.get_parent() == null:
		return null
	var host := player.get_parent()
	if host.get_node_or_null("StoryPet") != null:
		return null
	var p := new()
	p.name = "StoryPet"
	p._player = player
	host.add_child.call_deferred(p)
	return p


func _ready() -> void:
	_k = float(_player.get_meta("body_scale", 1.0)) if _player != null else 1.0   # 4종횡은 인물을 크게 그린다(G-0187) — 펫도 같이
	_body = CreatureBuilder.build_pet(PET_ID, HEIGHT * _k)
	add_child(_body)
	_anim = _body.get_node_or_null("AnimationPlayer") as AnimationPlayer
	if _player != null:
		global_position = _player.global_position + Vector3(-FOLLOW_BACK, 0, FOLLOW_Z)


## 다음 금(순수에 가깝게 — 무리에서 주인공 PICK_R 안 가장 가까운 것)
func _nearest_gold() -> Node3D:
	var best: Node3D = null
	var bd := PICK_R
	for n in get_tree().get_nodes_in_group(GROUP):
		var a := n as Node3D
		if a == null or not is_instance_valid(a) or a.is_queued_for_deletion():
			continue
		var d := a.global_position.distance_to(_player.global_position)
		if d < bd:
			bd = d
			best = a
	return best


func _physics_process(delta: float) -> void:
	if _player == null or not is_instance_valid(_player):
		return
	var pv: Vector3 = _player.get("velocity") if _player.get("velocity") != null else Vector3.ZERO
	if absf(pv.x) > 0.3:
		_face = signf(pv.x)
	_scan -= delta
	if _scan <= 0.0:
		_scan = PICK_SEC
		if target == null or not is_instance_valid(target) or target.is_queued_for_deletion():
			target = _nearest_gold()
	var goal := _player.global_position + Vector3(-_face * FOLLOW_BACK * _k, 0.0, FOLLOW_Z)
	if target != null and is_instance_valid(target):
		goal = target.global_position
	var to := goal - global_position
	var step := SPEED * delta
	var moving := to.length() > 0.15
	global_position = goal if to.length() <= step else global_position + to.normalized() * step
	if absf(to.x) > 0.05:
		_body.rotation.y = PI * 0.5 if to.x > 0.0 else -PI * 0.5
	if _anim != null:
		var want := "walk" if moving and _anim.has_animation("walk") else ("idle" if _anim.has_animation("idle") else "")
		if want != "" and _anim.current_animation != want:
			_anim.play(want)
	if target != null and is_instance_valid(target) and global_position.distance_to(target.global_position) < GRAB_R:
		grab(target)


## 금을 주인공 자리로 — 금 Area 의 body_entered 가 원래 길로 받는다.
func grab(gold: Node3D) -> void:
	gold.remove_from_group(GROUP)
	gold.global_position = _player.global_position
	picked += 1
	target = null
