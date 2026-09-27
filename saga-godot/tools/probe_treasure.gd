extends Node
## GO 보물 상자(PLAN 106장 ⑥, games/saga_go/world/treasure_*.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_TREASURE_PROBE 가 있을 때만 단다.
##
##   SAGA_TREASURE_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 상자 18(106장 ㊵ 과녁 둘 포함)·등급 분포·봉인 7 ② 자리 높이(정교 = 산 턱 9m+, 나머지 = 땅) ③ 걸어 다가가면 열림
## →경험치·EventState ④ 무리 잠금: 봉인 중엔 안 열림 → 무리 전멸 뒤 풀림 ⑤ 석등: 먼 곳·다른
## 원소는 안 켜짐, 시간이 지나면 꺼짐, 셋 다 켜면 풀림 ⑥ 실제 원소 스킬(K)이 석등을 켬
## ⑦ 다시 지으면 연 상자는 안 생김. 저장은 안 한다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TreasureSpawner := preload("res://games/saga_go/world/treasure_spawner.gd")

var _p: CharacterBody3D
var _fc: Node
var _frame := 0
var _step := 0
var _fails := 0
var _exp0 := 0.0
var _target: Node3D = null

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
			var chests := get_tree().get_nodes_in_group("treasure_chest")
			var by_grade := {}
			var sealed := 0
			for c in chests:
				by_grade[c.grade] = by_grade.get(c.grade, 0) + 1
				if c.sealed:
					sealed += 1
			var ok: bool = chests.size() == 53 and by_grade.get("common", 0) == 21 and by_grade.get("exquisite", 0) == 12 \
				and by_grade.get("precious", 0) == 11 and by_grade.get("luxurious", 0) == 9 and sealed == 20 # 55 세갈래 고을 다섯 · 106장 ㊺ 고원 다섯 · ㊽ 은하 나루 다섯 · ㊾ 틈새 갈림길 다섯 · ㊿ 잠긴 도읍 다섯 더함
			_check("chest_count", ok, "n=%d grades=%s sealed=%d" % [chests.size(), by_grade, sealed])
			var bad: Array = []
			for c in chests:
				var y: float = (c as Node3D).global_position.y
				## 106장 ㊿ 잠긴 도읍 — 등대 바위섬 꼭대기(헤엄쳐 가는 정교 상자, 약 3m)·빛 돔 안 마른 바닥(−10)은 제자리 높이로 본다.
				if c.chest_id == "u_islet" or c.chest_id == "u_dome":
					var want := 3.0 if c.chest_id == "u_islet" else -10.0
					if absf(y - want) > 0.6:
						bad.append("%s y=%.1f" % [c.chest_id, y])
				elif c.grade == "exquisite" and c.lock != "target": # 106장 ㊵ 과녁 상자는 모래밭
					if y < 9.0:
						bad.append("%s y=%.1f" % [c.chest_id, y])
				elif y < -0.6 or y > 2.5:
					bad.append("%s y=%.1f" % [c.chest_id, y])
			_check("chest_heights", bad.is_empty(), ", ".join(bad))
			_next()
		1: # ③ 평범한 상자 앞 1m 에 세우면 저절로 열린다
			if _frame == 1:
				_target = _chest("v_forest_w")
				_exp0 = PartyState.exp
				_p.global_position = _target.global_position + Vector3(0, 0.4, 1.0)
				_p.velocity = Vector3.ZERO
			if _target.get("is_open"):
				_check("walk_open", PartyState.exp > _exp0 and EventState.is_resolved("chest_v_forest_w") \
					and TreasureSpawner.opened_count() == 1, "exp %.1f→%.1f f=%d" % [_exp0, PartyState.exp, _frame])
				_next()
			elif _frame == 120:
				_check("walk_open", false, "timeout")
				_next()
		2: # ④ 무리 잠금
			if _frame == 1:
				_target = _chest("v_camp_bandit")
				var early: float = _target.call("open")
				var n := 0
				for e in get_tree().get_nodes_in_group("field_enemy"):
					var home: Vector3 = e.get("home")
					if Vector2(home.x - _target.global_position.x, home.z - _target.global_position.z).length() <= 12.0:
						e.call("apply_damage", 99999.0, false)
						n += 1
				_check("camp_sealed", early == 0.0 and n == 2 and _target.get("sealed"), "early=%.1f camp=%d" % [early, n])
			if not _target.get("sealed"):
				var got: float = _target.call("open")
				_check("camp_unseal", got == 30.0, "got=%.1f f=%d" % [got, _frame])
				_next()
			elif _frame == 120:
				_check("camp_unseal", false, "still sealed")
				_next()
		3: # ⑤ 석등 — 폐허 화 셋
			var c := _chest("r_torch_fire")
			var torches: Array = c.get("_torches")
			var t0: Vector3 = (torches[0].node as Node3D).global_position
			c.call("receive_element", t0 + Vector3(9, 0, 0), 4.0, "fire")
			var far: int = c.call("lit_count")
			c.call("receive_element", t0, 4.0, "water")
			var wrong: int = c.call("lit_count")
			c.call("receive_element", t0, 4.0, "fire")
			var one: int = c.call("lit_count")
			c.call("_tick_torches", 21.0)
			var expired: int = c.call("lit_count")
			_check("torch_rules", far == 0 and wrong == 0 and one == 1 and expired == 0 and c.get("sealed"),
				"far=%d wrong=%d one=%d expired=%d" % [far, wrong, one, expired])
			for t in torches:
				c.call("receive_element", (t.node as Node3D).global_position, 4.0, "fire")
			_check("torch_unseal", not c.get("sealed") and int(c.call("lit_count")) == 3, "lit=%d" % int(c.call("lit_count")))
			_next()
		4: # ⑥ 실제 원소 스킬 — 마을 석등(화·수·뇌) 첫째(화) 옆에서 K
			var c := _chest("v_torch_ruin")
			var torches: Array = c.get("_torches")
			if _frame == 1:
				_fc.set("active", 0)
				_p.global_position = (torches[0].node as Node3D).global_position + Vector3(1.5, 0.5, 0)
				_p.velocity = Vector3.ZERO
			if _frame == 40:
				var used: bool = _fc.call("skill")
				var lit: int = c.call("lit_count")
				_check("skill_lights_torch", used and lit == 1 and bool(torches[0].flame.visible), "used=%s lit=%d" % [used, lit])
				_next()
		5: # ⑦ 다시 지으면 연 상자(둘)는 빠진다
			var sp := TreasureSpawner.new()
			add_child(sp)
			var n := sp.get_child_count()
			sp.free()
			_check("persist_skip", n == 51 and TreasureSpawner.opened_count() == 2, "rebuilt=%d opened=%d" % [n, TreasureSpawner.opened_count()])
			_next()
		6:
			print("TREASURE_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _chest(id: String) -> Node3D:
	for c in get_tree().get_nodes_in_group("treasure_chest"):
		if c.chest_id == id:
			return c
	return null

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("TREASURE_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])

func _next() -> void:
	_step += 1
	_frame = 0
