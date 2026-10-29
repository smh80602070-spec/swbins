extends Node
## GO 활 조준 사격·과녁 퍼즐(PLAN 106장 ㊵, combat/aimed_shot.gd · world/shoot_target.gd) 자동 점검 —
## 평소엔 안 붙는다. test_village.gd 가 SAGA_ARCHERY_PROBE 가 있을 때만 단다.
##
##   SAGA_ARCHERY_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 과녁 상자 둘·과녁 셋씩·높이·봉인·둘레 적/상자와 거리 ② 선분-공·원기둥 셈 ③ 활 아닌 인물은 조준 못 함
## → 활 인물은 조준(시점·제자리) ④ 충전 1.4초·떼면 쏨 ⑤ 화살이 과녁에 닿아 켜짐 → 셋 다 → 봉인 풀림
## ⑥ 과녁은 10초 뒤 꺼짐·봉인 그대로 ⑦ 떠 있는 과녁이 오감 ⑧ 법구 기본 공격이 가까운 과녁을 침
## ⑨ 적 급소(몸 위쪽)는 치명타·몸통은 급소 아님 ⑩ 충전 화살 = 인물 원소 부착 ⑪ 충전 화살이 먼 석등을 켬
## ⑫ 걷기·활 아닌 인물로 바꾸면 조준이 풀림 ⑬ 터치 입구(_act)로 조준·쏘기 ⑭ 길게 눌러 조준(떼면 쏘고 나옴).
## 명단·적 체력은 끝에 되돌린다. 저장은 안 한다.

const Characters := preload("res://saga_core/data/characters.gd")
const Weapons := preload("res://games/saga_go/data/weapons.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")
const AimedShot := preload("res://games/saga_go/combat/aimed_shot.gd")
const CombatMotion := preload("res://games/saga_go/combat/combat_motion.gd")

var _p: CharacterBody3D
var _fc: Node
var _aim: Node
var _frame := 0
var _step := 0
var _fails := 0
var _saved_members: Array[String] = []
var _bow := ""
var _cat := ""
var _chest: Node3D = null
var _shots0 := 0
var _e: Node3D = null
var _dealt_weak := 0.0
var _v0 := Vector3.ZERO
var _gate_no := false

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _fc == null:
		_fc = get_tree().get_first_node_in_group("go_field_combat")
		if _fc:
			_aim = _fc.get("aim")
			_saved_members = PartyState.members.duplicate()
			_bow = _hero("bow", ["fire", "water", "thunder"])
			_cat = _hero("catalyst", [])
		return
	match _step:
		0: # ① 자리
			var bad: Array = []
			for id in ["c_target_dune", "r_target_court"]:
				var c := _chest_of(id)
				if c == null:
					bad.append("%s 없음" % id)
					continue
				var ts: Array = c.call("targets")
				if ts.size() != 3 or not c.get("sealed") or not String(c.call("lock_hint")).contains("과녁"):
					bad.append("%s n=%d sealed=%s" % [id, ts.size(), c.get("sealed")])
				for t in ts:
					var h: float = (t.call("center") as Vector3).y - (t as Node3D).global_position.y
					if h < 2.5 or h > 9.0:
						bad.append("%s 판 높이 %.1f" % [id, h])
				var cp := c.global_position
				for e in get_tree().get_nodes_in_group("field_enemy"):
					var hm: Vector3 = e.get("home")
					if Vector2(hm.x - cp.x, hm.z - cp.z).length() < 20.0:
						bad.append("%s 적 %.0fm" % [id, Vector2(hm.x - cp.x, hm.z - cp.z).length()])
				for o in get_tree().get_nodes_in_group("treasure_chest"):
					if o != c and (o as Node3D).global_position.distance_to(cp) < 20.0:
						bad.append("%s 상자 %s" % [id, o.get("chest_id")])
			_check("layout", bad.is_empty() and _bow != "" and _cat != "", "%s bow=%s cat=%s" % [", ".join(bad), _bow, _cat])
			_next()
		1: # ② 셈
			var s1 := AimedShot._seg_sphere(Vector3.ZERO, Vector3(10, 0, 0), Vector3(5, 0, 0), 1.0)
			var s2 := AimedShot._seg_sphere(Vector3.ZERO, Vector3(10, 0, 0), Vector3(5, 2, 0), 1.0)
			var s3 := AimedShot._seg_cylinder(Vector3(0, 1, 0), Vector3(10, 0, 0), Vector3(5, 0, 0), 0.5, 1.5)
			var s4 := AimedShot._seg_cylinder(Vector3(0, 2, 0), Vector3(10, 0, 0), Vector3(5, 0, 0), 0.5, 1.5)
			var s5 := AimedShot._seg_cylinder(Vector3(5, 5, 0), Vector3(0, -10, 0), Vector3(5, 0, 0), 0.5, 1.5)
			var ok := is_equal_approx(s1, 0.4) and s2 < 0.0 and is_equal_approx(s3, 0.45) and s4 < 0.0 and is_equal_approx(s5, 0.35)
			_check("geometry", ok, "%.3f %.3f %.3f %.3f %.3f" % [s1, s2, s3, s4, s5])
			_next()
		2: # ③ 문 — 주인공(한손검)은 못 하고 활 인물은 함
			if _frame == 1:
				_fc.set("active", 0)
				_chest = _chest_of("c_target_dune")
				_p.global_position = _chest.global_position + Vector3(0, 0.5, -5.0)
				_p.velocity = Vector3.ZERO
			if _frame == 30:
				_gate_no = not _aim.call("toggle")
				PartyState.members.assign([_bow])
				_fc.call("switch_to", 1, true)
			if _frame == 45:
				var yes: bool = _aim.call("enter", false)
				var rig := get_tree().get_first_node_in_group("camera_rig")
				_check("gate", _gate_no and yes and bool(_p.get("aiming")) and bool(rig.get("aiming")), "sword_no=%s enter=%s aiming=%s rig=%s" % [_gate_no, yes, _p.get("aiming"), rig.get("aiming")])
			if _frame == 75:
				var arm: SpringArm3D = get_tree().get_first_node_in_group("camera_rig").get("spring_arm")
				_check("aim_camera", arm.spring_length < 3.5 and arm.position.x > 0.4 and _p.velocity.length() < 0.5, "len=%.2f off=%s v=%.2f" % [arm.spring_length, arm.position, _p.velocity.length()])
				_next()
		3: # ④ 충전
			if _frame == 1:
				_shots0 = int(_aim.get("shots"))
				_aim.call("begin_charge")
			if _frame == 40:
				_check("charge_half", float(_aim.call("charge_ratio")) > 0.3 and float(_aim.call("charge_ratio")) < 0.9, "r=%.2f" % float(_aim.call("charge_ratio")))
			if _frame == 95:
				var r: float = _aim.call("charge_ratio")
				var fired: bool = _aim.call("release")
				_check("charge_full", is_equal_approx(r, 1.0) and fired and int(_aim.get("shots")) == _shots0 + 1 and bool(_aim.get("active")), "r=%.2f fired=%s shots=%d" % [r, fired, int(_aim.get("shots")) - _shots0])
				_next()
		4: # ⑤ 과녁 셋 — 화살로 차례로
			var ts: Array = _chest.call("targets")
			if _frame == 1:
				_aim.set("last_hit", {})
				_aim.call("fire_at", ts[0].call("center"), false)
			if _frame == 30:
				var lh: Dictionary = _aim.get("last_hit")
				_check("arrow_hits_target", String(lh.get("kind", "")) == "target" and lh.get("node") == ts[0] and bool(ts[0].call("is_lit")) and _chest.get("sealed"), "hit=%s lit=%s" % [lh.get("kind", "-"), ts[0].call("is_lit")])
				_aim.call("fire_at", ts[1].call("center"), false)
			if _frame == 50:
				_aim.call("fire_at", ts[2].call("center"), true)
			if _frame == 80:
				_check("targets_unseal", not _chest.get("sealed") and int(_chest.call("hit_count")) == 3, "sealed=%s hits=%d" % [_chest.get("sealed"), int(_chest.call("hit_count"))])
				_next()
		5: # ⑥ 꺼짐 — 폐허 과녁 하나만 맞히고 시간 보내기
			if _frame == 1:
				_chest = _chest_of("r_target_court")
				var t0: Node = _chest.call("targets")[0]
				t0.call("strike", "")
				t0.set("lit_t", 0.05)
			if _frame == 10:
				_check("target_expires", int(_chest.call("hit_count")) == 0 and _chest.get("sealed"), "hits=%d" % int(_chest.call("hit_count")))
				_v0 = _chest.call("targets")[2].call("center")
			if _frame == 70: # ⑦ 떠 있는 셋째
				var moved: float = (_chest.call("targets")[2].call("center") as Vector3).distance_to(_v0)
				_check("sway_moves", moved > 0.3, "%.2fm" % moved)
				_next()
		6: # ⑧ 법구 기본 공격 — 첫 과녁 발밑에서
			if _frame == 1:
				_aim.call("exit")
				PartyState.members.assign([_cat])
				_fc.call("switch_to", 1, true)
				var t0: Node3D = _chest.call("targets")[0]
				_p.global_position = t0.global_position + Vector3(1.5, 0.5, 0)
				_p.velocity = Vector3.ZERO
			if _frame == 40:
				var t0: Node = _chest.call("targets")[0]
				var near: Node = _fc.call("nearest_target", 7.0)
				_fc.set("_attack_t", 0.0)
				var did: bool = _fc.call("attack")
				var ap := _p.get("_anim") as AnimationPlayer
				var delay := CombatMotion.strike_delay(_p, ap.current_animation, 0.34)
				get_tree().create_timer(delay + 0.05).timeout.connect(_check_catalyst_target.bind(did, near == t0, t0))
		7: # ⑨ 급소 — 적 하나를 활 인물 앞 12m 에 세워 얼린다
			if _frame == 1:
				PartyState.members.assign([_bow])
				_fc.call("switch_to", 1, true)
				_e = _plain_enemy()
				_p.global_position = _e.global_position + Vector3(0, 0.5, 12.0)
				_p.velocity = Vector3.ZERO
			if _frame == 30:
				_prep(_e)
				_e.call("freeze", 5.0)
				_aim.call("enter", false)
			if _frame == 35:
				var hb: Vector2 = _aim.call("_hitbox", _e)
				_aim.set("last_hit", {})
				_aim.call("fire_at", _e.global_position + Vector3.UP * hb.y * 0.9, false)
			if _frame == 60:
				var lh: Dictionary = _aim.get("last_hit")
				_dealt_weak = float(lh.get("dealt", 0.0))
				var weak_ok: bool = String(lh.get("kind", "")) == "enemy" and lh.get("node") == _e and bool(lh.get("weak", false))
				var hb: Vector2 = _aim.call("_hitbox", _e)
				_aim.set("last_hit", {})
				_prep(_e)
				_e.call("freeze", 5.0)
				_aim.call("fire_at", _e.global_position + Vector3.UP * hb.y * 0.3, false)
				if not weak_ok:
					_check("weak_spot", false, "lh=%s" % [lh])
			if _frame == 85:
				var lh: Dictionary = _aim.get("last_hit")
				var body := float(lh.get("dealt", 0.0))
				_check("weak_spot", String(lh.get("kind", "")) == "enemy" and not bool(lh.get("weak", true)) and _dealt_weak > body and body > 0.0,
					"weak=%.1f body=%.1f" % [_dealt_weak, body])
				_next()
		8: # ⑩ 충전 화살 = 원소 부착
			if _frame == 1:
				_prep(_e)
				_e.call("unfreeze")
				_e.call("freeze", 5.0)
				_e.call("set_aura", "")
				var hb: Vector2 = _aim.call("_hitbox", _e)
				_aim.call("fire_at", _e.global_position + Vector3.UP * hb.y * 0.5, true)
			if _frame == 25:
				var el := Elements.element_of(_bow)
				var aura: String = _e.get("aura")
				_check("charged_element", aura == el, "el=%s aura=%s" % [el, aura])
				_e.call("unfreeze")
				_next()
		9: # ⑪ 먼 석등 — 마을 석등 상자(화·수·뇌)에서 활 인물 원소 석등을 15m 밖에서
			var c := _chest_of("v_torch_ruin")
			if c == null:
				_check("arrow_lights_torch", true, "skip — 상자를 이미 엶")
				_next()
				return
			var el := Elements.element_of(_bow)
			var torch: Dictionary = {}
			for t in c.get("_torches"):
				if t.element == el:
					torch = t
			var tp: Vector3 = (torch.node as Node3D).global_position
			if _frame == 1:
				_p.global_position = tp + Vector3(0, 0.5, 15.0)
				_p.velocity = Vector3.ZERO
			if _frame == 30:
				_aim.call("enter", false)
				_aim.call("fire_at", tp + Vector3.UP * 1.2, true)
			if _frame == 60:
				_check("arrow_lights_torch", float(torch.lit_t) > 0.0 and bool((torch.flame as Node3D).visible), "el=%s lit_t=%.1f" % [el, float(torch.lit_t)])
				_next()
		10: # ⑫ 풀림 — 걸으면 · 활 아닌 인물이면
			if _frame == 1:
				_aim.call("enter", false)
				Input.action_press("move_forward")
			if _frame == 4:
				Input.action_release("move_forward")
				var walked_out: bool = not _aim.get("active")
				_fc.call("switch_to", 0, true)
				_aim.call("enter", false) # 주인공은 안 들어감
				var sword_out: bool = not _aim.get("active")
				var rig := get_tree().get_first_node_in_group("camera_rig")
				_check("aim_exit", walked_out and sword_out and not _p.get("aiming") and not rig.get("aiming"), "walk=%s sword=%s" % [walked_out, sword_out])
				_next()
		11: # ⑬ 터치 입구 — _act 로 조준 켜고 누르고 떼기
			if _frame == 1:
				_fc.call("switch_to", 1, true)
			if _frame == 20:
				_shots0 = int(_aim.get("shots"))
				_fc.call("_act", "go_aim", true)
				_fc.call("_act", "go_aim", false)
				_fc.call("_act", "combat_quick", true)
			if _frame == 30:
				_fc.call("_act", "combat_quick", false)
				_check("touch_act", bool(_aim.get("active")) and int(_aim.get("shots")) == _shots0 + 1, "active=%s shots=%d" % [_aim.get("active"), int(_aim.get("shots")) - _shots0])
				_fc.call("_act", "go_aim", true)
				_next()
		12: # ⑭ 길게 눌러 조준 — 조준 밖에서 공격을 누르고 있으면 들어가고, 떼면 쏘고 나온다
			if _frame == 1:
				_shots0 = int(_aim.get("shots"))
				_fc.set("_attack_t", 0.0)
				_fc.call("press_attack")
			if _frame == 40:
				var in_hold: bool = bool(_aim.get("active")) and bool(_aim.get("hold"))
				_fc.call("release_attack")
				_check("hold_aim", in_hold and not _aim.get("active") and int(_aim.get("shots")) == _shots0 + 1, "hold=%s active=%s shots=%d" % [in_hold, _aim.get("active"), int(_aim.get("shots")) - _shots0])
				_next()
		13:
			PartyState.members.assign(_saved_members)
			_fc.set("active", 0)
			print("ARCHERY_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

## 무기 종류 t 인 인물 — els 가 비지 않으면 그 원소 가운데 하나인 사람으로.
func _hero(t: String, els: Array) -> String:
	for h in Characters.HEROES:
		if Weapons.type_of(h.id) != t:
			continue
		if not els.is_empty() and not els.has(Elements.element_of(h.id)):
			continue
		return h.id
	return ""

func _chest_of(id: String) -> Node3D:
	for c in get_tree().get_nodes_in_group("treasure_chest"):
		if c.chest_id == id:
			return c
	return null

func _plain_enemy() -> Node3D:
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if not e.call("is_dead") and not e.call("is_shielded") and not e.get("def").has("rotation"):
			return e
	return null

func _prep(e: Node) -> void:
	e.set("max_hp", 99999.0)
	e.set("hp", 99999.0)
	e.call("set_aura", "")

func _check_catalyst_target(did: bool, near: bool, target: Node) -> void:
	_check("catalyst_hits_target", did and near and bool(target.call("is_lit")), "did=%s near=%s lit=%s" % [did, near, target.call("is_lit")])
	_next()

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("ARCHERY_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])

func _next() -> void:
	_step += 1
	_frame = 0
