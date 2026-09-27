extends Node
## GO 들판 전투(games/saga_go/combat/) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가
## SAGA_COMBAT_PROBE 가 있을 때만 단다.
##
##   SAGA_COMBAT_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 반응 표 ② 적 무리 수 ③ 기본 공격으로 늑대를 잡으면 경험치 ④ 증발 ×1.5
## ⑤ 과부하 광역 ⑥ 감전 지속 ⑦ 가만히 서 있으면 적에게 맞는다 ⑧ 회피 중 무적
## ⑨ 쓰러지면 안전한 곳에서 체력 가득 ⑩ 인물 교체 명단 ⑪ 원소 방패(106장 ⑦): 같은 원소 면역·
## 물리 0.4·상성 ×2.5·깨지면 비틀거림·그 뒤 체력·부착 ⑫ 원소 적에게 맞으면 화상·젖음·감전.
## 106장 ⑧: ⑬ 강공격 ⑭ 낙하 공격 ⑮ 인물마다 체력·쓰러지면 교체 ⑯ 원소 공명 ⑰ 원소별 스킬 모양·
## 대기 인물 기력 ⑱ 폭발이 남기는 효과. 명단을 잠깐 바꿨다가 되돌린다. 저장은 안 한다.

const Elements := preload("res://games/saga_go/combat/elements.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const Characters := preload("res://saga_core/data/characters.gd")

var _p: CharacterBody3D
var _fc: Node
var _frame := 0
var _step := 0
var _fails := 0
var _target: Node = null
var _exp0 := 0.0
var _hp0 := 0.0
var _members0: Array[String] = []

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _fc == null:
		_fc = get_tree().get_first_node_in_group("go_field_combat")
		return
	match _step:
		0:
			var ok := Elements.reaction_of("water", "fire") == "vaporize" \
				and Elements.reaction_of("fire", "thunder") == "overload" \
				and Elements.reaction_of("thunder", "water") == "electro" \
				and Elements.reaction_of("fire", "fire") == "" and Elements.reaction_of("", "fire") == ""
			_check("reaction_table", ok, "")
			var n := get_tree().get_nodes_in_group("field_enemy").size()
			_check("spawn_count", n == 84, "n=%d" % n) # 들판 적 29 + 들판 보스 4(106장 ㉓·고원 곰왕) + 서리봉 고원 무리 넷 11(106장 ㊺-1) + 은하 나루 무리 셋 8(㊽-1) + 틈새 갈림길 무리 셋 8(㊾-1) + 잠긴 도읍 무리 셋 8(㊿-1)
			_next()
		1: # ③ 마을 서쪽 늑대 무리 한 마리 앞에 서서 기본 공격 연타
			if _frame == 1:
				_target = _enemy_near(TestMap.world_pos(1, 4))
				_exp0 = PartyState.exp
				_place_facing(_target)
			if _frame > 1 and _frame % 20 == 0 and not _target.call("is_dead"):
				_place_facing(_target)
				_fc.call("attack")
			if _target.call("is_dead"):
				_check("kill_exp", PartyState.exp > _exp0, "exp %.1f→%.1f f=%d" % [_exp0, PartyState.exp, _frame])
				_next()
			elif _frame == 1200:
				_check("kill_exp", false, "timeout hp=%.1f" % float(_target.get("hp")))
				_next()
		2: # ④ 증발 — 수 부착 뒤 화 한 방
			var e := _enemy_near(TestMap.world_pos(1, 4))
			e.call("set_aura", "water")
			var dealt: float = _fc.call("_deal", e, 20.0, "fire", Vector3.FORWARD)
			_check("vaporize", is_equal_approx(dealt, 30.0) and _fc.get("last_reaction") == "vaporize" and e.get("aura") == "", "dealt=%.1f" % dealt)
			_next()
		3: # ⑤ 과부하 — 뇌 부착 적을 화로 치면 둘레의 다른 적도 맞는다
			var e := _enemy_near(TestMap.world_pos(1, 4))
			var others: Array = []
			for o in get_tree().get_nodes_in_group("field_enemy"):
				if o != e and not o.call("is_dead"):
					others.append(o)
			var o: Node3D = others[0]
			o.global_position = (e as Node3D).global_position + Vector3(1.5, 0, 0)
			var hp_before: float = o.get("hp")
			e.call("set_aura", "thunder")
			_fc.call("_deal", e, 20.0, "fire", Vector3.FORWARD)
			_check("overload", _fc.get("last_reaction") == "overload" and float(o.get("hp")) < hp_before, "other %.1f→%.1f" % [hp_before, float(o.get("hp"))])
			_next()
		4: # ⑥ 감전 — 2초 동안 체력이 계속 준다
			if _frame == 1:
				_target = _enemy_near(TestMap.world_pos(9, 5))
				_target.call("set_aura", "water")
				_fc.call("_deal", _target, 10.0, "thunder", Vector3.FORWARD)
				_hp0 = _target.get("hp")
			if _frame == 150:
				var hp: float = _target.get("hp")
				_check("electro_dot", _hp0 - hp > 10.0, "hp %.1f→%.1f" % [_hp0, hp])
				_next()
		5: # ⑦ 도적 앞에 가만히 서 있기
			if _frame == 1:
				_hp0 = _fc.get("hp")
				_place_facing(_target)
			if _frame == 360:
				var hp: float = _fc.get("hp")
				_check("take_hit", hp < _hp0, "hp %.1f→%.1f" % [_hp0, hp])
				_next()
		6: # ⑧ 회피 중엔 안 맞는다
			if _frame == 1:
				_p.stamina = _p.STAMINA_MAX
				var ok: bool = _p.call("start_dodge")
				_hp0 = _fc.get("hp")
				_fc.call("take_damage", 50.0, null)
				var hp: float = _fc.get("hp")
				_check("dodge_iframe", ok and is_equal_approx(hp, _hp0), "started=%s hp %.1f→%.1f" % [ok, _hp0, hp])
			if _frame == 30:
				_next()
		7: # ⑨ 쓰러짐 → 안전한 곳에서 가득
			_fc.set("hp", 1.0)
			_fc.call("take_damage", 500.0, null)
			var full: bool = is_equal_approx(float(_fc.get("hp")), float(_fc.get("max_hp")))
			_check("down_respawn", full, "hp=%.1f" % float(_fc.get("hp")))
			_next()
		8: # ⑩ 명단 — 나 + 등용한 동료 앞 셋
			var r: Array = _fc.call("roster")
			var uniq: Array = []
			for m in PartyState.members:
				if not uniq.has(m):
					uniq.append(m)
			var want := 1 + mini(3, uniq.size())
			_check("roster", r.size() == want and r[0] == "self", "size=%d want=%d" % [r.size(), want])
			_next()
		9: # ⑪ 원소 방패 — 포구 불도깨비(방패 150)
			var e := _enemy_kind("fire_imp")
			var hp0: float = e.get("hp")
			var immune: float = _fc.call("_deal", e, 50.0, "fire", Vector3.FORWARD)
			var phys: float = _fc.call("_deal", e, 50.0, "", Vector3.FORWARD)
			var counter: float = _fc.call("_deal", e, 50.0, "water", Vector3.FORWARD)
			var still: bool = e.call("is_shielded")
			_fc.call("_deal", e, 50.0, "water", Vector3.FORWARD)
			var broke: bool = not e.call("is_shielded") and int(e.get("ai")) == 4 # AI.RECOVER
			var hp_kept: bool = is_equal_approx(float(e.get("hp")), hp0)
			_check("shield_rules", immune == 0.0 and is_equal_approx(phys, 20.0) and is_equal_approx(counter, 125.0) and still and broke and hp_kept,
				"immune=%.1f phys=%.1f counter=%.1f still=%s broke=%s hp_kept=%s" % [immune, phys, counter, still, broke, hp_kept])
			_fc.call("_deal", e, 20.0, "fire", Vector3.FORWARD)
			_check("after_break", is_equal_approx(float(e.get("hp")), hp0 - 20.0) and e.get("aura") == "fire", "hp %.1f→%.1f aura=%s" % [hp0, float(e.get("hp")), e.get("aura")])
			_next()
		10: # ⑫ 원소 공격 효과
			_fc.set("hp", _fc.get("max_hp"))
			_p.stamina = _p.STAMINA_MAX
			_fc.call("take_damage", 10.0, _enemy_kind("water_turtle"))
			var soaked: bool = _p.stamina <= _p.STAMINA_MAX - 24.0
			_fc.call("take_damage", 10.0, _enemy_kind("fire_imp"))
			var burning: bool = int(_fc.get("_burn_left")) == 3
			_fc.set("energy", 50.0)
			_fc.call("take_damage", 10.0, _enemy_kind("thunder_cat"))
			var shocked: bool = is_equal_approx(float(_fc.get("energy")), 25.0)
			_fc.call("take_damage", 10.0, _enemy_kind("wolf"))
			_check("elemental_hits", soaked and burning and shocked, "stamina=%.1f burn=%d energy=%.1f" % [_p.stamina, int(_fc.get("_burn_left")), float(_fc.get("energy"))])
			_next()
		11: # ⑬ 강공격(106장 ⑧) — 앞쪽 넓게, 스태미나 20
			if _frame == 1:
				_fc.set("hp", _fc.get("max_hp"))
				_target = _enemy_kind("bandit")
				_place_facing(_target)
				_p.stamina = _p.STAMINA_MAX
			if _frame == 5:
				var hp0: float = _target.get("hp")
				var ok: bool = _fc.call("charged_attack")
				var dealt := hp0 - float(_target.get("hp"))
				_check("charged", ok and dealt > float(_fc.call("char_atk", "self")) * 1.2 and _p.stamina <= _p.STAMINA_MAX - 19.0,
					"ok=%s dealt=%.1f st=%.1f" % [ok, dealt, _p.stamina])
				_next()
		12: # ⑭ 낙하 공격 — 8m 위에서 내리꽂으면 땅에 닿을 때 둘레를 친다
			if _frame == 1:
				_target = _enemy_kind("bandit")
				_hp0 = _target.get("hp")
				var ep: Vector3 = (_target as Node3D).global_position
				_p.global_position = ep + Vector3(0.8, 8.0, 0.0)
				_p.velocity = Vector3.ZERO
				_p.call("_set_mode", 1) # Mode.AIR
			if _frame == 2:
				_check("plunge_start", _p.call("start_plunge"), "mode=%d" % _p.mode)
			if _frame > 2 and not _p.call("is_plunging"):
				var dealt := _hp0 - float(_target.get("hp"))
				_check("plunge_land", dealt > float(_fc.call("char_atk", "self")) * 1.4 and _p.mode == 0, "dealt=%.1f f=%d" % [dealt, _frame])
				_next()
			elif _frame == 240:
				_check("plunge_land", false, "timeout mode=%d y=%.1f" % [_p.mode, _p.global_position.y])
				_next()
		13: # ⑮ 인물마다 체력 — 지금 인물이 쓰러지면 다음 인물로, 다 쓰러지면 모두 가득
			_members0 = PartyState.members.duplicate()
			PartyState.members.assign([_hero_of("water"), _hero_of("thunder")])
			_fc.set("active", 0)
			_fc.call("revive_all")
			_fc.set("hp", 1.0)
			_fc.call("take_damage", 500.0, null)
			var switched := int(_fc.get("active")) == 1 and float(_fc.call("hp_of", "self")) <= 0.0 \
				and is_equal_approx(float(_fc.get("hp")), float(_fc.get("max_hp")))
			var blocked: bool = not _fc.call("switch_to", 0, true) # 쓰러진 인물로는 못 바꾼다
			for i in 2:
				_fc.set("hp", 1.0)
				_fc.call("take_damage", 500.0, null)
			var all_full := true
			for id in _fc.call("roster"):
				all_full = all_full and is_equal_approx(float(_fc.call("hp_of", id)), float(_fc.call("max_hp_of", id)))
			_check("per_char_hp", switched and blocked and all_full, "switched=%s blocked=%s all_full=%s" % [switched, blocked, all_full])
			_next()
		14: # ⑯ 원소 공명 — 화 둘이면 공격 +25%
			PartyState.members.assign([_hero_of("fire")])
			var mul_fire: float = _fc.call("_power_mul", "self")
			PartyState.members.assign([_hero_of("water")])
			var mul_none: float = _fc.call("_power_mul", "self")
			_check("resonance", _fc.call("resonance") == "" and is_equal_approx(mul_none, 1.0) and is_equal_approx(mul_fire, 1.25),
				"fire=%.2f none=%.2f" % [mul_fire, mul_none])
			_next()
		15: # ⑰ 원소마다 스킬 모양 — 수: 모두 회복 · 뇌: 가까운 적 셋에 낙뢰 · 기력은 대기 인물도 60%
			PartyState.members.assign([_hero_of("water"), _hero_of("thunder")])
			_fc.call("revive_all")
			_fc.set("_energy", {})
			_fc.set("_skill_cd", {})
			_fc.set("active", 1) # 수
			var half: float = float(_fc.get("max_hp")) * 0.5
			var hp_dict: Dictionary = _fc.get("_hp")
			hp_dict["self"] = half
			_fc.call("skill")
			var healed: bool = float(_fc.call("hp_of", "self")) > half + 1.0
			## 앞 단계에서 적들이 쫓아다녀 제자리에 없을 수 있다 — 방패 없는 적 셋을 불러 세운다.
			var pack := _plain_enemies(3)
			var stand: Vector3 = _p.global_position
			for i in pack.size():
				(pack[i] as Node3D).global_position = stand + Vector3(2.0 * (i - 1), 0.0, -2.5)
			_fc.set("active", 2) # 뇌
			_fc.set("_energy", {})
			var hp_before: Array = []
			for e in pack:
				hp_before.append(float(e.get("hp")))
			_fc.call("skill")
			var hit := 0
			for i in pack.size():
				if float(pack[i].get("hp")) < hp_before[i] or pack[i].call("is_dead"):
					hit += 1
			var want := mini(3, pack.size())
			var e_now: float = _fc.call("energy_of", _hero_of("thunder"))
			var e_off: float = _fc.call("energy_of", "self")
			_check("kits", healed and hit == want and e_now > 0.0 and is_equal_approx(e_off, e_now * 0.6),
				"healed=%s hit=%d/%d energy now=%.1f off=%.1f" % [healed, hit, want, e_now, e_off])
			_next()
		16: # ⑱ 폭발이 남기는 효과 — 화 폭발 뒤 불 고리가 계속 친다(주인공은 고유 폭발이라 화 기본 인물로)
			if _frame == 1:
				PartyState.members.assign([_hero_of("fire")])
				_fc.set("active", 1) # 화 기본
				_fc.set("energy", 100.0)
				_target = _plain_enemies(1)[0]
				(_target as Node3D).global_position = _p.global_position + Vector3(0.0, 0.0, -1.6)
				_p.call("face_toward", (_target as Node3D).global_position)
				_target.set("hp", 5000.0) # 폭발 한 방에 쓰러지면 여운을 못 본다
				_fc.call("burst")
				_hp0 = _target.get("hp")
			if _frame == 70:
				var fx: Array = _fc.get("_effects")
				_check("burst_linger", float(_target.get("hp")) < _hp0 and fx.size() == 1, "hp %.1f→%.1f fx=%d" % [_hp0, float(_target.get("hp")), fx.size()])
				PartyState.members.assign(_members0)
				_fc.set("active", 0)
				_fc.call("revive_all")
				_next()
		17:
			print("COMBAT_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _enemy_kind(kind: String) -> Node:
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if e.get("kind") == kind and not e.call("is_dead"):
			return e
	return null

## 원소가 el 인 도감 인물 하나(Elements.element_of 는 id 해시라 고정).
## 그 원소의 첫 인물 — 원소 기본 스킬을 보므로 고유·갈래 스킬(106장 ㉔ data/kits.gd)이 있는 인물은 뺀다(지략 인물).
func _hero_of(el: String) -> String:
	for h in Characters.HEROES:
		if Elements.element_of(h.id) == el and not preload("res://games/saga_go/data/kits.gd").has_kit(h.id):
			return h.id
	return ""

func _plain_enemies(n: int) -> Array:
	var out: Array = []
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if out.size() < n and not e.call("is_dead") and not e.call("is_shielded"):
			out.append(e)
	return out

func _alive_near(pos: Vector3, radius: float) -> Array:
	var out: Array = []
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if not e.call("is_dead") and ((e as Node3D).global_position - pos).length() <= radius:
			out.append(e)
	return out

func _enemy_near(pos: Vector3) -> Node:
	var best: Node = null
	var best_d := 1e9
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if e.call("is_dead"):
			continue
		var d := ((e as Node3D).global_position - pos).length()
		if d < best_d:
			best_d = d
			best = e
	return best

## 적 바로 앞 1.6m 에 세우고 적 쪽을 보게.
func _place_facing(e: Node) -> void:
	var ep: Vector3 = (e as Node3D).global_position
	_p.global_position = ep + Vector3(0, 0.3, 1.6)
	_p.velocity = Vector3.ZERO
	_p.call("face_toward", ep)

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("COMBAT_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
