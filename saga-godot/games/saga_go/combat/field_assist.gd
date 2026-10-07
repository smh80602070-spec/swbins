extends Node

## G-0071 협공(SAGA-BACKLOG §4.1 "동행 AI 한 단계") — 들판 전투(field_combat.gd)의 자식.
## 내가 싸우는 동안(최근 WINDOW 초 안에 지금 인물이 적을 쳤을 때) 명단의 대기 동료가
## 원소를 노려 한 번씩 끼어든다. 고르는 순서:
##   ③ 방패 깨기 — 적에 원소 방패가 있으면 상성 원소(Elements.shield_mul > 1)인 동료가 친다(×1.0)
##   ① 반응 잇기 — 적에 원소가 붙어 있으면 반응이 나는 동료(증발·융해 > 그 밖 > 확산·결정, ×0.8)
##   ② 반응 깔기 — 원소가 안 붙어 있으면, 붙는 원소이면서 내 원소가 그 위에 반응을 내는 동료가
##      원소만 깔아 둔다(×0.4)
## 협공 사이 GAP 초, 동료마다 규칙별 재사용 대기(CD). 피해·치명타·원소 보너스는 그 동료 것
## (_crit_id 를 빌린다 — 대기 인물의 비 화살 _rain_follow 와 같은 길). 지금 인물이 친 것으로는
## 안 센다. 환경 SAGA_NO_ASSIST=1 이면 끼어들지 않는다(전후 비교용). 저장할 것 없음.

const Elements := preload("res://games/saga_go/combat/elements.gd")
const CombatFx := preload("res://games/saga_go/combat/combat_fx.gd")

const TICK := 0.25
const WINDOW := 3.0 # 지금 인물이 마지막으로 친 뒤 이 초 안이면 싸우는 중
const GAP := 2.0 # 협공 사이 최소 간격
const RANGE := 10.0 # 내게서 이 거리 안의 적만
const CD := {"chain": 10.0, "prime": 12.0, "break": 8.0}
const MUL := {"chain": 0.8, "prime": 0.4, "break": 1.0}
const RULE_NAMES := {"chain": "반응 잇기", "prime": "반응 깔기", "break": "방패 깨기"}
## 반응 잇기에서 고르는 순위(없으면 2) — 배율 반응이 먼저, 확산·결정은 나중.
const RANK := {"vaporize": 3, "melt": 3, "swirl": 1, "crystallize": 1}

signal assisted(id: String, rule: String, reaction: String)

var enabled := true
var beam_sec := 0.4 # 빛줄기가 남는 초(촬영 컷은 길게 잡는다)
var count := 0 # 이번 실행에서 협공한 수(점검이 읽는다)
var last: Dictionary = {} # 마지막 협공 {id, rule, el, reaction}
var _fc: Node = null
var _t := 0.0
var _gap := 0.0
var _cd: Dictionary = {} # 동료 id → 남은 초

func _ready() -> void:
	_fc = get_parent()
	enabled = OS.get_environment("SAGA_NO_ASSIST") == ""

## 고르기(화면 없이 점검). target = {aura, shielded, shield_el} · active_el = 지금 인물 원소 ·
## bench = [{id, el}] — 이미 대기·살아 있음·재사용 대기 끝난 동료만, 명단 순서. 없으면 {}.
static func choose(target: Dictionary, active_el: String, bench: Array) -> Dictionary:
	if bool(target.get("shielded", false)):
		var sel := String(target.get("shield_el", ""))
		for b in bench:
			if Elements.shield_mul(sel, String(b.el)) > 1.0:
				return {"id": String(b.id), "rule": "break", "el": String(b.el)}
		return {}
	var aura := String(target.get("aura", ""))
	if aura != "":
		var best: Dictionary = {}
		var best_rank := 0
		for b in bench:
			var r := Elements.reaction_of(aura, String(b.el))
			if r == "":
				continue
			var rank := int(RANK.get(r, 2))
			if rank > best_rank:
				best_rank = rank
				best = {"id": String(b.id), "rule": "chain", "el": String(b.el), "reaction": r}
		return best
	for b in bench:
		var el := String(b.el)
		if Elements.attaches(el) and Elements.reaction_of(el, active_el) != "":
			return {"id": String(b.id), "rule": "prime", "el": el}
	return {}

func _physics_process(delta: float) -> void:
	for k in _cd.keys():
		_cd[k] = maxf(float(_cd[k]) - delta, 0.0)
	_gap = maxf(_gap - delta, 0.0)
	_t -= delta
	if _t > 0.0:
		return
	_t = TICK
	if enabled:
		try_assist()

## 지금 끼어들 수 있으면 한 번 끼어들고 고른 것을 돌려준다(없으면 {}).
func try_assist() -> Dictionary:
	if _fc == null or _gap > 0.0 or float(_fc.get("since_hit")) > WINDOW:
		return {}
	if float(_fc.get("hp")) <= 0.0 or bool(_fc.call("_duel_open")):
		return {}
	var player: Node3D = _fc.get("_player")
	if player == null:
		return {}
	var target := _target(player)
	if target == null:
		return {}
	var now := String(_fc.call("active_id"))
	var bench: Array = []
	for id in _fc.call("roster"):
		if id == now or float(_cd.get(id, 0.0)) > 0.0 or float(_fc.call("hp_of", id)) <= 0.0:
			continue
		bench.append({"id": id, "el": Elements.element_of(id)})
	if bench.is_empty():
		return {}
	var pick := choose({"aura": String(target.get("aura")), "shielded": bool(target.call("is_shielded")),
		"shield_el": String(target.get("element"))}, Elements.element_of(now), bench)
	if pick.is_empty():
		return {}
	strike(pick, target, player)
	return pick

## 내가 마지막으로 친 적(살아 있고 RANGE 안), 아니면 RANGE 안 가장 가까운 적.
func _target(player: Node3D) -> Node3D:
	var t: Variant = _fc.get("last_target")
	if t is Node3D and is_instance_valid(t) and not (t as Node).call("is_dead") \
			and (t as Node3D).global_position.distance_to(player.global_position) <= RANGE:
		return t
	var near: Array = _fc.call("_nearest", player.global_position, RANGE, 1)
	return near[0] if not near.is_empty() else null

func strike(pick: Dictionary, enemy: Node3D, player: Node3D) -> void:
	var id := String(pick.id)
	var rule := String(pick.rule)
	var el := String(pick.el)
	var ep := enemy.global_position
	var color := Elements.color_of(el)
	var from := _slot_pos(player, id)
	CombatFx.spark(self, from, color, false)
	_beam(from, ep + Vector3.UP * 0.8, color)
	var was: String = _fc.get("_crit_id")
	_fc.set("_crit_id", id)
	_fc.call("_deal", enemy, float(_fc.call("char_atk", id)) * float(MUL[rule]), el, ep - player.global_position)
	_fc.set("_crit_id", was)
	var reaction := String(_fc.get("last_reaction")) if rule == "chain" else ""
	_cd[id] = float(CD[rule])
	_gap = GAP
	count += 1
	last = {"id": id, "rule": rule, "el": el, "reaction": reaction}
	_label(ep, "%s 협공" % String(_fc.call("display_name", id)), color)
	assisted.emit(id, rule, reaction)

## 끼어드는 동료 자리 — 뒤따르는 동행 실루엣(saga_core companion_follow.gd, 명단 둘째부터 차례로)의 가슴,
## 실루엣이 없으면 내 뒤 1.3m 왼쪽·가운데·오른쪽.
func _slot_pos(player: Node3D, id: String) -> Vector3:
	var r: Array = _fc.call("roster")
	var follow := get_tree().get_first_node_in_group("companion_follow")
	if follow:
		var fp: Variant = follow.call("follower_pos", r.find(id) - 1)
		if fp is Vector3:
			return fp
	var side := float(clampi(r.find(id), 1, 3) - 2) * 1.1
	var fwd: Vector3 = player.call("facing") if player.has_method("facing") else Vector3.FORWARD
	fwd.y = 0.0
	fwd = fwd.normalized() if fwd.length() > 0.01 else Vector3.FORWARD
	var right := fwd.cross(Vector3.UP).normalized()
	return player.global_position - fwd * 1.3 + right * side + Vector3.UP * 1.3

## 원소색 빛줄기(beam_sec) — field_combat_ui.gd _shot_fx 보다 굵고 길게 남는다.
func _beam(from: Vector3, to: Vector3, color: Color) -> void:
	var d := from.distance_to(to)
	if d < 0.2 or get_tree().current_scene == null:
		return
	var mi := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.09
	cyl.bottom_radius = 0.09
	cyl.height = d
	cyl.radial_segments = 6
	mi.mesh = cyl
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = color.lightened(0.25)
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	get_tree().current_scene.add_child(mi)
	mi.global_position = (from + to) * 0.5
	var up := (to - from).normalized()
	var side := up.cross(Vector3.FORWARD if absf(up.dot(Vector3.FORWARD)) < 0.9 else Vector3.RIGHT).normalized()
	mi.global_basis = Basis(side, up, side.cross(up)).orthonormalized()
	var tw := mi.create_tween()
	tw.tween_property(mat, "albedo_color:a", 0.0, beam_sec)
	tw.tween_callback(mi.queue_free)

## "<이름> 협공" — 반응 글자(머리 위 2.4m)와 안 겹치게 조금 더 위, 작게.
func _label(at: Vector3, text: String, color: Color) -> void:
	if get_tree().current_scene == null:
		return
	var l := Label3D.new()
	l.text = text
	l.modulate = color.lightened(0.2)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.font_size = 48
	l.outline_size = 10
	l.pixel_size = 0.006
	get_tree().current_scene.add_child(l)
	l.global_position = at + Vector3.UP * 3.1
	var tw := l.create_tween()
	tw.set_parallel(true)
	tw.tween_property(l, "global_position:y", l.global_position.y + 0.7, 0.9)
	tw.tween_property(l, "modulate:a", 0.0, 0.9).set_delay(0.4)
	tw.chain().tween_callback(l.queue_free)
