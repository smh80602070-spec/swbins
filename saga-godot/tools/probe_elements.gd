extends Node
## GO 원소 일곱·반응(106장 ⑭) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_ELEMENT_PROBE 가 있을 때만 단다.
##
##   SAGA_ELEMENT_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 표(원소 7·원소마다 인물이 있음·반응 쌍·풍/암 안 붙음) ② 융해 ×1.5 ③ 빙결 — 멈춤, 강공격이면 쇄빙 ×1.5·풀림
## ④ 초전도 — 둘레 물리 ×1.4 ⑤ 확산 — 옆 적에게 원소가 옮겨 붙음 ⑥ 결정 — 보호막이 받는 피해를 막음
## ⑦ 개화 — 1.5초 뒤 씨앗이 터짐 ⑧ 연소 — 지속 피해 ⑨ 촉진 → 활성 ×1.25 ⑩ 새 원소 넷의 스킬이 적을 맞힘·
## 암 폭발 보호막 ⑪ 풍 공명 — 스태미나 소모 ×0.85.
## 106장 ⑮ 새 원소 괴물: ⑫ 넷 다 들판에 방패를 두르고 섬 ⑬ 방패 상성(풍←암·빙←화·암←초·초←풍, 바위 방패 물리 ×1.0)
## ⑭ 잡으면 그 원소 결정 ⑮ 맞으면 휘말림·한기·짓눌림·중독.
## 명단·성장을 잠깐 바꿨다가 되돌린다. 저장은 안 한다.

const Elements := preload("res://games/saga_go/combat/elements.gd")
const Characters := preload("res://saga_core/data/characters.gd")

var _p: CharacterBody3D
var _fc: Node
var _frame := 0
var _step := 0
var _fails := 0
var _e: Node = null
var _e2: Node = null
var _members0: Array[String] = []
var _growth0: Dictionary = {}
var _v := 0.0
var _pos0 := Vector3.ZERO
var _kit_i := 0
var _kit_ok := true
var _kit_detail := ""

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _fc == null:
		_fc = get_tree().get_first_node_in_group("go_field_combat")
		if _fc:
			if _fc.has_node("FieldEnv"):   # G-0303 — 들불(땅 반응)이 반응 수치 점검에 섞이지 않게
				_fc.get_node("FieldEnv").queue_free()
			_members0 = PartyState.members.duplicate()
			_growth0 = PartyState.growth.duplicate(true)
			PartyState.members.assign([])
			PartyState.growth.erase("self") # 운명의 자리 2(반응 +15%)가 섞이지 않게
		return
	match _step:
		0: # ① 표
			var heroes_ok := true
			for el in Elements.ORDER:
				if _hero_of(el) == "":
					heroes_ok = false
			var R := func(a: String, b: String) -> String: return Elements.reaction_of(a, b)
			var ok: bool = Elements.ORDER.size() == 7 and heroes_ok \
				and R.call("ice", "fire") == "melt" and R.call("water", "ice") == "frozen" and R.call("thunder", "ice") == "superconduct" \
				and R.call("fire", "wind") == "swirl" and R.call("ice", "rock") == "crystallize" and R.call("grass", "rock") == "" \
				and R.call("water", "grass") == "bloom" and R.call("grass", "fire") == "burning" and R.call("thunder", "grass") == "quicken" \
				and R.call("water", "fire") == "vaporize" and R.call("wind", "fire") == "" \
				and not Elements.attaches("wind") and not Elements.attaches("rock") and Elements.attaches("grass")
			_check("tables", ok, "heroes=%s" % heroes_ok)
			_next()
		1: # ② 융해
			var es := _plain_enemies(2)
			_e = es[0]
			_e2 = es[1]
			_prep(_e)
			_e.call("set_aura", "ice")
			var dealt: float = _fc.call("_deal", _e, 20.0, "fire", Vector3.FORWARD)
			_check("melt", is_equal_approx(dealt, 30.0) and _fc.get("last_reaction") == "melt" and _e.get("aura") == "", "dealt=%.1f" % dealt)
			_next()
		2: # ③ 빙결 → 쇄빙
			if _frame == 1:
				_prep(_e)
				_e.call("set_aura", "water")
				_fc.call("_deal", _e, 10.0, "ice", Vector3.FORWARD)
				_pos0 = (_e as Node3D).global_position
			if _frame == 30:
				var frozen: bool = _e.call("is_frozen")
				var moved := Vector2((_e as Node3D).global_position.x - _pos0.x, (_e as Node3D).global_position.z - _pos0.z).length()
				_fc.set("_heavy", true)
				var dealt: float = _fc.call("_deal", _e, 20.0, "", Vector3.FORWARD)
				_fc.set("_heavy", false)
				_check("frozen_shatter", frozen and moved < 0.05 and is_equal_approx(dealt, 30.0) and not _e.call("is_frozen"),
					"frozen=%s moved=%.3f dealt=%.1f" % [frozen, moved, dealt])
				_next()
		3: # ④ 초전도
			_prep(_e)
			_prep(_e2)
			(_e2 as Node3D).global_position = (_e as Node3D).global_position + Vector3(1.5, 0, 0)
			_e.call("set_aura", "ice")
			_fc.call("_deal", _e, 20.0, "thunder", Vector3.FORWARD)
			var v1 := float(_e.get("phys_vuln_t"))
			var v2 := float(_e2.get("phys_vuln_t"))
			var dealt: float = _fc.call("_deal", _e, 20.0, "", Vector3.FORWARD)
			_check("superconduct", v1 > 7.9 and v2 > 7.9 and is_equal_approx(dealt, 28.0), "vuln %.1f/%.1f dealt=%.1f" % [v1, v2, dealt])
			_next()
		4: # ⑤ 확산
			_prep(_e)
			_prep(_e2)
			(_e2 as Node3D).global_position = (_e as Node3D).global_position + Vector3(2.0, 0, 0)
			_e.call("set_aura", "fire")
			var hp2 := float(_e2.get("hp"))
			_fc.call("_deal", _e, 20.0, "wind", Vector3.FORWARD)
			_check("swirl", _fc.get("last_reaction") == "swirl" and _e2.get("aura") == "fire" and _e.get("aura") == "" \
				and is_equal_approx(float(_e2.get("hp")), hp2 - 12.0), "e2 aura=%s hp %.1f→%.1f" % [_e2.get("aura"), hp2, float(_e2.get("hp"))])
			_next()
		5: # ⑥ 결정 — 보호막
			_prep(_e)
			_fc.set("shield_hp", 0.0)
			_fc.call("revive_all")
			_e.call("set_aura", "water")
			_fc.call("_deal", _e, 20.0, "rock", Vector3.FORWARD)
			var sh := float(_fc.get("shield_hp"))
			var want := float(_fc.get("max_hp")) * 0.2
			var hp0 := float(_fc.get("hp"))
			_fc.call("take_damage", 10.0, null)
			var hp1 := float(_fc.get("hp"))
			_check("crystallize", is_equal_approx(sh, want) and is_equal_approx(hp1, hp0) and float(_fc.get("shield_hp")) < sh,
				"shield=%.1f want=%.1f hp %.1f→%.1f" % [sh, want, hp0, hp1])
			_fc.set("shield_hp", 0.0)
			_next()
		6: # ⑦ 개화 — 1.5초 뒤 씨앗
			if _frame == 1:
				_prep(_e)
				(_e2 as Node3D).global_position = (_e as Node3D).global_position + Vector3(20.0, 0, 0)
				_e.call("set_aura", "water")
				_fc.call("_deal", _e, 20.0, "grass", Vector3.FORWARD)
				_v = float(_e.get("hp"))
			if _frame == 110:
				_check("bloom", float(_e.get("hp")) <= _v - 29.9, "hp %.1f→%.1f" % [_v, float(_e.get("hp"))])
				_next()
		7: # ⑧ 연소
			_prep(_e)
			_e.call("set_aura", "grass")
			_fc.call("_deal", _e, 20.0, "fire", Vector3.FORWARD)
			var dots: Array = _e.get("_dots")
			_check("burning", _fc.get("last_reaction") == "burning" and dots.size() == 1 and int(dots[0].left) == 8, "dots=%d" % dots.size())
			_next()
		8: # ⑨ 촉진 → 활성
			_prep(_e)
			_e.call("set_aura", "thunder")
			_fc.call("_deal", _e, 20.0, "grass", Vector3.FORWARD)
			var q := float(_e.get("quicken_t"))
			var dealt: float = _fc.call("_deal", _e, 20.0, "thunder", Vector3.FORWARD)
			_check("quicken", q > 7.9 and _fc.get("last_reaction") == "aggravate" and is_equal_approx(dealt, 25.0) and _e.get("aura") == "thunder",
				"quicken=%.1f last=%s dealt=%.1f" % [q, _fc.get("last_reaction"), dealt])
			_next()
		9: # ⑩ 새 원소 넷 스킬 + 암 폭발 보호막
			var els := ["wind", "ice", "rock", "grass"]
			if _frame == 1:
				_kit_i = 0
			if _frame % 8 == 1 and _kit_i < els.size():
				var el: String = els[_kit_i]
				PartyState.members.assign([_hero_of(el)])
				_fc.set("active", 0)
				_fc.call("switch_to", 1, true)
				_prep(_e)
				_place_facing(_e)
			if _frame % 8 == 7 and _kit_i < els.size():
				var el: String = els[_kit_i]
				(_fc.get("_skill_cd") as Dictionary).clear()
				var hp0 := float(_e.get("hp"))
				var used: bool = _fc.call("skill")
				var hit := float(_e.get("hp")) < hp0
				if not (used and hit and _fc.call("active_element") == el):
					_kit_ok = false
					_kit_detail += "%s:used=%s hit=%s " % [el, used, hit]
				if el == "rock":
					_fc.set("shield_hp", 0.0)
					_fc.set("energy", 100.0)
					var burst_ok: bool = _fc.call("burst") and float(_fc.get("shield_hp")) > 0.0
					if not burst_ok:
						_kit_ok = false
						_kit_detail += "rock_burst "
					_fc.set("shield_hp", 0.0)
				_kit_i += 1
			if _kit_i >= els.size():
				_check("kits", _kit_ok, _kit_detail)
				_next()
		10: # ⑪ 풍 공명
			if _frame == 1:
				var winds: Array[String] = []
				for h in Characters.HEROES:
					if Elements.element_of(h.id) == "wind" and winds.size() < 2:
						winds.append(h.id)
				PartyState.members.assign(winds)
				_fc.set("active", 0)
			if _frame == 4:
				_check("wind_resonance", _fc.call("resonance") == "wind" and is_equal_approx(float(_p.get("stamina_cost_mul")), 0.85),
					"res=%s mul=%.2f" % [_fc.call("resonance"), float(_p.get("stamina_cost_mul"))])
				PartyState.members.assign(_members0)
				PartyState.growth = _growth0
				_fc.set("active", 0)
				_next()
		11: # ⑫ 새 괴물 넷
			var kinds := {"wind_hawk": "wind", "ice_fox": "ice", "rock_bear": "rock", "grass_snake": "grass"}
			var ok := true
			var detail := ""
			for k in kinds:
				var e := _enemy_kind(k)
				var good: bool = e != null and e.get("element") == kinds[k] and e.call("is_shielded")
				if not good:
					ok = false
					detail += "%s " % k
			_check("new_monsters", ok, detail)
			_next()
		12: # ⑬ 방패 상성
			var S := func(sh: String, inc: String) -> float: return Elements.shield_mul(sh, inc)
			var table_ok: bool = is_equal_approx(S.call("wind", "rock"), 2.5) and is_equal_approx(S.call("ice", "fire"), 2.5) \
				and is_equal_approx(S.call("rock", "grass"), 2.5) and is_equal_approx(S.call("grass", "wind"), 2.5) \
				and is_equal_approx(S.call("rock", ""), 1.0) and is_equal_approx(S.call("ice", ""), 0.4) and S.call("rock", "rock") == 0.0
			var bear := _enemy_kind("rock_bear")
			var s0 := float(bear.get("shield"))
			var dealt: float = _fc.call("_deal", bear, 20.0, "", Vector3.FORWARD)
			_check("shield_counter", table_ok and is_equal_approx(dealt, 20.0) and is_equal_approx(float(bear.get("shield")), s0 - 20.0),
				"table=%s dealt=%.1f" % [table_ok, dealt])
			_next()
		13: # ⑭ 잡으면 결정
			if _frame == 1:
				_v = 0.0
				for k in ["wind_hawk", "ice_fox", "rock_bear", "grass_snake"]:
					_v += PartyState.count("crystal_" + Elements.ORDER[["wind_hawk", "ice_fox", "rock_bear", "grass_snake"].find(k) + 3])
					var e := _enemy_kind(k)
					e.set("shield", 0.0)
					e.call("apply_damage", 99999.0, false, Vector3.FORWARD)
			if _frame == 3:
				var now := 0
				for el in ["wind", "ice", "rock", "grass"]:
					now += PartyState.count("crystal_" + el)
				_check("drops", now == int(_v) + 4, "crystals %d→%d" % [int(_v), now])
				_next()
		14: # ⑮ 맞으면 원소 효과
			var id: String = _fc.call("active_id")
			_fc.set("shield_hp", 0.0)
			_fc.call("revive_all")
			var effects := []
			var src := func(el: String) -> Node:
				for e in get_tree().get_nodes_in_group("field_enemy"):
					if e.get("element") == el:
						return e
				return null
			(_fc.get("_skill_cd") as Dictionary)[id] = 0.0
			_fc.call("take_damage", 10.0, src.call("wind"))
			effects.append(float((_fc.get("_skill_cd") as Dictionary).get(id, 0.0)) >= 1.99)
			_p.set("_regen_wait", 0.0)
			_fc.call("take_damage", 10.0, src.call("ice"))
			effects.append(float(_p.get("_regen_wait")) >= 2.99)
			var hp0 := float(_fc.get("hp"))
			var d := PartyState.char_def(id)
			var plain := 10.0 * (1.0 - d / (d + 120.0))
			_fc.call("take_damage", 10.0, src.call("rock"))
			effects.append(hp0 - float(_fc.get("hp")) > plain * 1.29)
			_fc.call("take_damage", 10.0, src.call("grass"))
			effects.append(int(_fc.get("_burn_left")) == 4)
			_fc.set("_burn_left", 0)
			_fc.call("revive_all")
			_check("hit_effects", not effects.has(false), "wind/ice/rock/grass=%s" % [effects])
			_next()
		15:
			print("ELEMENT_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

## 시험용 적 — 체력 넉넉히, 부착·상태 지움.
func _prep(e: Node) -> void:
	e.set("max_hp", 99999.0)
	e.set("hp", 99999.0)
	e.call("set_aura", "")
	e.call("unfreeze")
	e.set("phys_vuln_t", 0.0)
	e.set("quicken_t", 0.0)
	(e.get("_dots") as Array).clear()

func _enemy_kind(kind: String) -> Node:
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if e.get("kind") == kind and not e.call("is_dead"):
			return e
	return null

## 원소 기본 스킬을 보므로 고유·갈래 스킬(106장 ㉔ data/kits.gd)이 있는 인물은 뺀다(지략 인물).
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

func _place_facing(e: Node) -> void:
	var ep: Vector3 = (e as Node3D).global_position
	_p.global_position = ep + Vector3(0, 0.3, 1.6)
	_p.velocity = Vector3.ZERO
	_p.call("face_toward", ep)

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("ELEMENT_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
