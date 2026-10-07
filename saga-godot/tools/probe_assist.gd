extends Node
## G-0071 협공(games/saga_go/combat/field_assist.gd) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가
## SAGA_ASSIST_PROBE 가 있을 때만 단다.
##
##   SAGA_ASSIST_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 고르기 표(방패 깨기·잇기 순위·깔기·고를 것 없음) ② 실제 들판 — 명단 [나(화)·수·뇌·빙] 으로 늑대를
## 치면 몇 초 안에 협공이 나고 반응 잇기가 반응을 낸다, 협공은 지금 인물이 친 것으로 안 센다
## ③ GAP·동료 재사용 대기 ④ 내가 안 치면(WINDOW 지남) 안 끼어든다 ⑤ enabled=false(SAGA_NO_ASSIST) 면 0번
## ⑥ 쓰러진 동료는 안 끼어든다. 명단을 잠깐 바꿨다가 되돌린다. 저장은 안 한다.

const Elements := preload("res://games/saga_go/combat/elements.gd")
const FieldAssist := preload("res://games/saga_go/combat/field_assist.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const Kits := preload("res://games/saga_go/data/kits.gd")

var _p: CharacterBody3D
var _fc: Node
var _as: Node
var _frame := 0
var _step := 0
var _fails := 0
var _target: Node = null
var _members0: Array[String] = []
var _party0 := 0
var _hero := {} # 원소 → 인물 id
var _seen: Array = [] # [id, rule, reaction, since_hit]

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _fc == null:
		_fc = get_tree().get_first_node_in_group("go_field_combat")
		if _fc:
			_as = _fc.get("assist")
		return
	match _step:
		0: # ① 고르기 표
			var a := {"id": "a", "el": "thunder"}
			var w := {"id": "w", "el": "water"}
			var wd := {"id": "wd", "el": "wind"}
			var rk := {"id": "rk", "el": "rock"}
			var fi := {"id": "fi", "el": "fire"}
			var ic := {"id": "ic", "el": "ice"}
			var c1 := FieldAssist.choose({"shielded": true, "shield_el": "fire", "aura": "water"}, "fire", [a, w])
			var c2 := FieldAssist.choose({"aura": "fire"}, "thunder", [a, w])
			var c3 := FieldAssist.choose({"aura": "water"}, "fire", [wd, a])
			var c4 := FieldAssist.choose({"aura": "water"}, "fire", [wd])
			var c5 := FieldAssist.choose({"aura": ""}, "fire", [wd, rk, w])
			var c6 := FieldAssist.choose({"aura": ""}, "fire", [rk, fi])
			var c7 := FieldAssist.choose({"shielded": true, "shield_el": "fire"}, "water", [fi, a])
			var c8 := FieldAssist.choose({"aura": "ice"}, "ice", [a, fi])
			var ok: bool = c1.get("id") == "w" and c1.get("rule") == "break" \
				and c2.get("id") == "w" and c2.get("rule") == "chain" and c2.get("reaction") == "vaporize" \
				and c3.get("id") == "a" and c3.get("reaction") == "electro" \
				and c4.get("id") == "wd" and c4.get("reaction") == "swirl" \
				and c5.get("id") == "w" and c5.get("rule") == "prime" \
				and c6.is_empty() and c7.is_empty() \
				and c8.get("id") == "fi" and c8.get("reaction") == "melt"
			_check("choose", ok, "%s|%s|%s|%s|%s|%s|%s|%s" % [c1, c2, c3, c4, c5, c6, c7, c8])
			for el in ["water", "thunder", "ice"]:
				_hero[el] = _hero_of(el)
			_check("setup", _as != null and _hero.water != "" and _hero.thunder != "" and _hero.ice != "", "assist=%s heroes=%s" % [_as, _hero])
			_next()
		1: # ② 실제 들판 — 화 스킬·기본 공격으로 늑대를 치면 협공이 끼어든다
			if _frame == 1:
				_members0 = PartyState.members.duplicate()
				_party0 = PartyState.party_size
				PartyState.party_size = PartyState.PARTY_MAX
				PartyState.members.assign([_hero.water, _hero.thunder, _hero.ice])
				_fc.set("active", 0)
				_fc.call("revive_all")
				_fc.set("_skill_cd", {})
				_as.set("_cd", {})
				_as.set("_gap", 0.0)
				_as.set("count", 0)
				_as.connect("assisted", _on_assisted)
				_target = _plain_enemy(TestMap.world_pos(1, 4))
				_place_facing(_target)
				_fc.call("skill")
			elif _frame % 20 == 0 and _frame < 900:
				if _target == null or _target.call("is_dead"):
					_target = _plain_enemy(TestMap.world_pos(1, 4))
				_place_facing(_target)
				_fc.call("revive_all")
				_fc.call("attack")
			var chained := _seen.filter(func(x: Array) -> bool: return x[1] == "chain" and x[2] != "")
			if _seen.size() >= 2 and not chained.is_empty():
				var bench := [_hero.water, _hero.thunder, _hero.ice]
				var ids_ok := _seen.all(func(x: Array) -> bool: return bench.has(x[0]))
				## 협공이 친 것은 지금 인물이 친 것으로 안 센다 — 협공 직후 since_hit 은 0 으로 안 돌아간다(마지막 공격 뒤 흐른 만큼).
				_check("fires", ids_ok and int(_as.get("count")) >= 2, "seen=%s f=%d" % [_seen, _frame])
				_check("reaction", chained.size() >= 1, "chained=%s" % [chained])
				_next()
			elif _frame == 1200:
				_check("fires", false, "timeout seen=%s count=%d" % [_seen, int(_as.get("count"))])
				_next()
		2: # ③ GAP·재사용 대기 — 방금 끼어든 직후엔 안 끼어들고, GAP 를 지우면 다른 동료가
			_fc.call("revive_all")
			_as.set("_cd", {})
			_as.set("_gap", 0.0)
			_fc.set("since_hit", 0.0)
			_fc.set("last_target", null)
			var e := _plain_enemy(TestMap.world_pos(1, 4))
			_place_facing(e)
			e.call("set_aura", "fire")
			var first: Dictionary = _as.call("try_assist")
			var blocked: Dictionary = _as.call("try_assist")
			var cd: Dictionary = _as.get("_cd")
			_as.set("_gap", 0.0)
			e.call("set_aura", "fire")
			var second: Dictionary = _as.call("try_assist")
			_check("gap_cd", not first.is_empty() and blocked.is_empty() and float(cd.get(first.get("id", ""), 0.0)) > 9.0
				and not second.is_empty() and second.get("id") != first.get("id"), "first=%s blocked=%s second=%s" % [first, blocked, second])
			_next()
		3: # ④ 내가 안 친 지 WINDOW 가 지나면 안 끼어든다
			_as.set("_cd", {})
			_as.set("_gap", 0.0)
			_fc.set("since_hit", FieldAssist.WINDOW + 0.5)
			var r: Dictionary = _as.call("try_assist")
			_check("idle", r.is_empty(), "r=%s" % [r])
			_next()
		4: # ⑤ enabled=false 면 싸우는 중이어도 0번
			if _frame == 1:
				_as.set("enabled", false)
				_as.set("_cd", {})
				_as.set("_gap", 0.0)
				_as.set("count", 0)
			_fc.set("since_hit", 0.0)
			if _frame == 90:
				_check("disabled", int(_as.get("count")) == 0, "count=%d" % int(_as.get("count")))
				_as.set("enabled", true)
				_next()
		5: # ⑥ 쓰러진 동료는 안 끼어든다 — 수(증발)를 쓰러뜨리면 빙(융해)이 잇는다
			_fc.call("revive_all")
			_as.set("_cd", {})
			_as.set("_gap", 0.0)
			_fc.set("since_hit", 0.0)
			var e := _plain_enemy(TestMap.world_pos(1, 4))
			_place_facing(e)
			_fc.set("last_target", e)
			e.call("set_aura", "fire")
			(_fc.get("_hp") as Dictionary)[_hero.water] = 0.0
			var r: Dictionary = _as.call("try_assist")
			_check("downed", r.get("id") == _hero.ice and r.get("reaction") == "melt", "r=%s" % [r])
			_next()
		6:
			_fc.call("revive_all")
			PartyState.members.assign(_members0)
			PartyState.party_size = _party0
			_as.set("_cd", {})
			print("ASSIST_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _on_assisted(id: String, rule: String, reaction: String) -> void:
	_seen.append([id, rule, reaction, float(_fc.get("since_hit"))])

func _hero_of(el: String) -> String:
	for h in Characters.HEROES:
		if Elements.element_of(h.id) == el and not Kits.has_kit(h.id):
			return h.id
	return ""

## 방패 없는 산 적 중 pos 에 가장 가까운 것.
func _plain_enemy(pos: Vector3) -> Node:
	var best: Node = null
	var best_d := 1e9
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if e.call("is_dead") or e.call("is_shielded"):
			continue
		var d := ((e as Node3D).global_position - pos).length()
		if d < best_d:
			best_d = d
			best = e
	return best

func _place_facing(e: Node) -> void:
	var ep: Vector3 = (e as Node3D).global_position
	_p.global_position = ep + Vector3(0, 0.3, 1.6)
	_p.velocity = Vector3.ZERO
	_p.call("face_toward", ep)

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("ASSIST_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
