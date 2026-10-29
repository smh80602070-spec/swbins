extends Node
## GO 무기(106장 ⑯) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_WEAPON_PROBE 가 있을 때만 단다.
##
##   SAGA_WEAPON_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 표(종류 5·종류마다 인물·★4 Lv90 공격력·상자 무기) ② 수련용 기본(공격 23·치명 5%/50%)
## ③ 얻기·쥐기 → 공격력·치명 확률, 또 얻으면 재련 ④ 다른 종류는 못 듦·한 자루 무기를 옮기면 먼저 인물은 수련용
## ⑤ 강화석 → 상한 20 멈춤, 무기 돌파 → 40 ⑥ 종류마다 기본 공격(활은 14m, 한손검은 10m 밖 못 침, 법구는 원소)
## ⑦ 치명타 확률·배율 ⑧ 기력 획득 부옵션 ⑨ 진귀 상자에서 ★3 무기 ⑩ restore(무기·쥔 것, 옛 세이브는 수련용)
## ⑪ 인물 화면 "무기 바꾸기".
## 명단·성장·가방·무기를 잠깐 바꿨다가 되돌린다. 저장은 안 한다.

const Weapons := preload("res://games/saga_go/data/weapons.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const CombatMotion := preload("res://games/saga_go/combat/combat_motion.gd")

var _p: CharacterBody3D
var _fc: Node
var _frame := 0
var _step := 0
var _fails := 0
var _saved := {}
var _e: Node = null
var _kit_i := 0
var _kit_ok := true
var _kit_detail := ""
var _kit_waiting := false
var _kit_setup_needed := true
var _player_was_frozen := false

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _step == 5 and _p != null:
		_p.velocity = Vector3.ZERO
		_p.set("auto_dir", Vector3.ZERO)
		for joystick in get_tree().get_nodes_in_group("virtual_joystick"):
			joystick.set("value", Vector2.ZERO)
	if _fc == null:
		_fc = get_tree().get_first_node_in_group("go_field_combat")
		if _fc:
			_saved = {"members": PartyState.members.duplicate(), "growth": PartyState.growth.duplicate(true), "bag": PartyState.bag.duplicate(true),
				"weapons": PartyState.weapons.duplicate(true), "equip": PartyState.equip.duplicate(true)}
			PartyState.members.assign([])
			PartyState.growth.clear()
			PartyState.bag.clear()
			PartyState.weapons.clear()
			PartyState.equip.clear()
		return
	match _step:
		0: # ① 표
			var types_ok := true
			for t in Weapons.TYPES:
				if _hero_of_type(t, "") == "":
					types_ok = false
			var a90 := Weapons.atk_at("w_sword_4", 90, 6)
			var ok: bool = types_ok and Weapons.type_of("self") == "sword" and is_equal_approx(a90, 44.0 * (1.0 + 0.12 * 89 + 0.3 * 6)) \
				and Weapons.chest_weapon("x", "precious").ends_with("_3") and Weapons.chest_weapon("x", "luxurious").ends_with("_4") \
				and Weapons.chest_weapon("x", "common") == ""
			_check("tables", ok, "types=%s a90=%.1f" % [types_ok, a90])
			_next()
		1: # ② 수련용 기본
			var ok: bool = PartyState.weapon_of("self") == "w_sword_0" and is_equal_approx(PartyState.weapon_atk("self"), 23.0) \
				and is_equal_approx(PartyState.crit_rate("self"), 0.05) and is_equal_approx(PartyState.crit_dmg("self"), 0.5)
			_check("default", ok, "w=%s atk=%.1f" % [PartyState.weapon_of("self"), PartyState.weapon_atk("self")])
			_next()
		2: # ③ 얻기·쥐기·재련
			var atk0 := PartyState.char_atk("self")
			var got := PartyState.add_weapon("w_sword_4")
			var eq := PartyState.equip_weapon("self", "w_sword_4")
			var atk1 := PartyState.char_atk("self")
			var p1 := PartyState.passive_mul("self", "skill")
			var again := PartyState.add_weapon("w_sword_4")
			var p2 := PartyState.passive_mul("self", "skill")
			var ok: bool = got == "new" and eq and is_equal_approx(atk1 - atk0, 44.0 - 23.0) and is_equal_approx(PartyState.crit_rate("self"), 0.09) \
				and is_equal_approx(p1, 1.16) and again == "refine" and is_equal_approx(p2, 1.2) and int(PartyState.weapon_state("w_sword_4").ref) == 2
			_check("obtain_refine", ok, "got=%s eq=%s atk %.1f→%.1f p %.3f→%.3f again=%s" % [got, eq, atk0, atk1, p1, p2, again])
			_next()
		3: # ④ 종류 제한·옮기기
			PartyState.add_weapon("w_bow_3")
			var wrong := not PartyState.equip_weapon("self", "w_bow_3")
			var swordie := _hero_of_type("sword", "")
			var moved := PartyState.equip_weapon(swordie, "w_sword_4")
			var ok: bool = wrong and moved and PartyState.weapon_of(swordie) == "w_sword_4" and PartyState.weapon_of("self") == "w_sword_0"
			PartyState.equip_weapon("self", "w_sword_4")
			_check("equip_rules", ok and PartyState.weapon_of(swordie) != "w_sword_4", "wrong=%s moved=%s" % [wrong, moved])
			_next()
		4: # ⑤ 강화석 → 20 멈춤, 무기 돌파 → 40
			PartyState.add_items({"ore_l": 5, "mora": 20000})
			PartyState.weapon_use_ore("w_sword_4", "ore_l", 5)
			var w := PartyState.weapon_state("w_sword_4")
			var at_cap := int(w.lv) == 20 and float(w.exp) == 0.0 and PartyState.count("ore_l") >= 1
			var blocked := not PartyState.weapon_ascend("w_sword_4")
			PartyState.add_items(Weapons.ascend_cost("w_sword_4", 0))
			var up := PartyState.weapon_ascend("w_sword_4")
			_check("ore_ascend", at_cap and blocked and up and PartyState.weapon_cap("w_sword_4") == 40,
				"lv=%d exp=%.0f ore_l=%d blocked=%s up=%s" % [int(w.lv), float(w.exp), PartyState.count("ore_l"), blocked, up])
			_next()
		5: # ⑥ 종류마다 기본 공격
			var cases := [["sword", 1.6, true], ["sword", 10.0, false], ["claymore", 1.6, true], ["polearm", 2.5, true], ["catalyst", 5.0, true], ["bow", 10.0, true]]
			if _frame == 1:
				_kit_i = 0
				_e = _plain_enemy()
				_player_was_frozen = bool(_p.get("frozen"))
				for action in ["move_left", "move_right", "move_forward", "move_back", "run"]:
					Input.action_release(action)
				## 둘레에 다른 적이 없는 포구 모래밭으로 옮긴다(활·법구가 더 가까운 무리 동료를 겨누지 않게).
				var spot := TestMap.world_pos(3, 4, "coast")
				spot.y = TerrainBuilder.height_at("coast", spot) + 0.3
				(_e as Node3D).global_position = spot
				_e.set("home", spot)
				for other in get_tree().get_nodes_in_group("field_enemy"):
					if other != _e and not other.call("is_dead"):
						(other as Node3D).global_position += Vector3(1000.0, 0.0, 0.0)
						other.set_physics_process(false)
			if _kit_i < cases.size():
				var c: Array = cases[_kit_i]
				if not _kit_waiting:
					if _kit_setup_needed:
						_p.set("frozen", false)
						var need_el := "attach" if c[0] == "catalyst" else ""
						PartyState.members.assign([_hero_of_type(c[0], need_el)])
						_fc.set("active", 0)
						_fc.call("switch_to", 1, true)
						_prep(_e)
						var ep: Vector3 = (_e as Node3D).global_position
						_p.global_position = ep + Vector3(0, 0.3, float(c[1]))
						_p.velocity = Vector3.ZERO
						_p.call("face_toward", ep)
						_p.set("frozen", true)
						_kit_setup_needed = false
					else:
						_fc.set("_attack_t", 0.0)
						var hp0 := float(_e.get("hp"))
						var start_gap := _p.global_position.distance_to((_e as Node3D).global_position)
						var accepted: bool = _fc.call("attack")
						var delays := {"sword": 0.32, "claymore": 0.55, "polearm": 0.26, "catalyst": 0.34, "bow": 0.30}
						var ap := _p.get("_anim") as AnimationPlayer
						var delay := CombatMotion.strike_delay(_p, ap.current_animation, float(delays[c[0]]))
						_kit_waiting = true
						get_tree().create_timer(delay + 0.05).timeout.connect(_finish_weapon_kit_case.bind(c, hp0, accepted, start_gap))
			else:
				_p.set("frozen", _player_was_frozen)
				_check("weapon_kits", _kit_ok, _kit_detail)
				_next()
		6: # ⑦ 치명타
			PartyState.members.assign([])
			_fc.set("active", 0)
			_fc.set("_crit_id", "self")
			var n := 0
			var mul_ok := true
			for i in 4000:
				var m: float = _fc.call("_crit_roll")
				if m > 1.0:
					n += 1
					mul_ok = mul_ok and is_equal_approx(m, 1.5)
			_fc.set("_crit_id", "")
			var rate := float(n) / 4000.0
			var want := PartyState.crit_rate("self")
			_check("crit", want > 0.05 and absf(rate - want) < 0.015 and mul_ok and float(_fc.call("_crit_roll")) == 1.0, "rate=%.3f want=%.3f" % [rate, want])
			_next()
		7: # ⑧ 기력 획득 부옵션(장병기 ★4 기력 6.7%)
			var pole := _hero_of_type("polearm", "")
			PartyState.members.assign([pole])
			PartyState.add_weapon("w_polearm_4")
			PartyState.equip_weapon(pole, "w_polearm_4")
			_fc.set("active", 1)
			(_fc.get("_energy") as Dictionary).clear()
			_fc.call("_gain_energy", 10.0)
			var got: float = _fc.call("energy_of", pole)
			_check("energy_sub", is_equal_approx(got, 10.0 * 1.067) and is_equal_approx(float(_fc.call("energy_of", "self")), 6.0), "got=%.3f" % got)
			_fc.set("active", 0)
			PartyState.members.assign([])
			_next()
		8: # ⑨ 진귀 상자 → ★3 무기
			var chest: Node = null
			for c in get_tree().get_nodes_in_group("treasure_chest"):
				if c.get("grade") == "precious" and not c.get("is_open"): # 진귀는 모두 잠금이 있다 — 풀고 연다
					chest = c
					break
			var want := Weapons.chest_weapon(String(chest.get("chest_id")), "precious") if chest else ""
			var had := PartyState.weapons.has(want)
			if chest:
				chest.call("unseal")
				chest.call("open")
			_check("chest_weapon", chest != null and want.ends_with("_3") and not had and PartyState.weapons.has(want), "want=%s" % want)
			_next()
		9: # ⑩ restore
			var w := PartyState.weapons.duplicate(true)
			var eq := PartyState.equip.duplicate(true)
			var members: Array[String] = PartyState.members.duplicate()
			var perks: Array[String] = PartyState.perks.duplicate()
			PartyState.restore(members, PartyState.exp, perks, PartyState.growth.duplicate(true), PartyState.bag.duplicate(true), w, eq)
			var kept: bool = PartyState.weapon_of("self") == "w_sword_4" and int(PartyState.weapon_state("w_sword_4").lv) == 20 and int(PartyState.weapon_state("w_sword_4").ref) == 2
			PartyState.restore(members, PartyState.exp, perks, PartyState.growth.duplicate(true), PartyState.bag.duplicate(true))
			var legacy: bool = PartyState.weapon_of("self") == "w_sword_0" and PartyState.equip.is_empty()
			PartyState.restore(members, PartyState.exp, perks, PartyState.growth.duplicate(true), PartyState.bag.duplicate(true), w, eq)
			_check("restore", kept and legacy, "kept=%s legacy=%s" % [kept, legacy])
			_next()
		10: # ⑪ 인물 화면 "무기 바꾸기"
			var cs := get_tree().get_first_node_in_group("go_character_screen")
			cs.call("open_screen")
			cs.call("select", "self")
			var before := PartyState.weapon_of("self")
			var btn: Button = cs.get("_weapon_swap_btn")
			var on := not btn.disabled
			btn.emit_signal("pressed")
			var after := PartyState.weapon_of("self")
			var label_ok := String(cs.get("_weapon_label").text).contains(Weapons.info(after).name)
			cs.call("close_screen")
			_check("screen", on and before != after and label_ok, "%s→%s label=%s" % [before, after, label_ok])
			PartyState.members.assign(_saved.members)
			PartyState.growth = _saved.growth
			PartyState.bag = _saved.bag
			PartyState.weapons = _saved.weapons
			PartyState.equip = _saved.equip
			_fc.set("active", 0)
			_next()
		11:
			print("WEAPON_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

## 무기 종류 t 인 인물 — need_el 이 "attach" 면 붙는 원소(풍·암 아님)인 사람으로.
func _hero_of_type(t: String, need_el: String) -> String:
	for h in Characters.HEROES:
		if Weapons.type_of(h.id) != t:
			continue
		if need_el == "attach" and not Elements.attaches(Elements.element_of(h.id)):
			continue
		return h.id
	return ""

func _plain_enemy() -> Node:
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if not e.call("is_dead") and not e.call("is_shielded"):
			return e
	return null

func _prep(e: Node) -> void:
	e.set("max_hp", 99999.0)
	e.set("hp", 99999.0)
	e.call("set_aura", "")
	e.call("unfreeze")
	e.set_physics_process(false)

func _finish_weapon_kit_case(c: Array, hp0: float, accepted: bool, start_gap: float) -> void:
	var hit := float(_e.get("hp")) < hp0
	var aura_ok: bool = c[0] != "catalyst" or _e.get("aura") == _fc.call("active_element")
	if not accepted or hit != bool(c[2]) or not aura_ok:
		_kit_ok = false
		var gap := _p.global_position.distance_to((_e as Node3D).global_position)
		_kit_detail += "%s@%.1f accepted=%s hit=%s aura=%s hp=%.1f→%.1f gap=%.2f→%.2f anim=%s " % [c[0], c[1], accepted, hit, _e.get("aura"), hp0, _e.get("hp"), start_gap, gap, (_p.get("_anim") as AnimationPlayer).current_animation]
	_kit_i += 1
	_kit_waiting = false
	_kit_setup_needed = true

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("WEAPON_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
