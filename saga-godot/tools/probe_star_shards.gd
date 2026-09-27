extends Node
## GO 별조각·신상 봉헌(106장 ⑪) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_SHARD_PROBE 가 있을 때만 단다.
##
##   SAGA_SHARD_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 20개·세 지역·자리(산꼭대기는 땅보다 높이, 물 위는 수면 위) ② 가까이 가면 줍기(EventState shard_<id>)·탐험도↑
## ③ 신상 곁에서 저절로 바침 — 하나로는 Lv 그대로 ④ 둘째를 바치면 신상 Lv.1 → 스태미나 상한 108·냥 1000·견문록 2
## ⑤ 스태미나가 새 상한까지 찬다 ⑥ 다시 지으면(불러오기 흉내) 주운 것은 안 생기고 상한도 그대로.
## 저장은 안 한다.

const StarShards := preload("res://games/saga_go/world/star_shards.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const WorldMap := preload("res://games/saga_go/ui/world_map.gd")

var _p: CharacterBody3D
var _ss: Node
var _wps: Node
var _frame := 0
var _step := 0
var _fails := 0
var _ex0 := 0.0
var _mora0 := 0

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _ss == null:
		_ss = get_tree().get_first_node_in_group("go_star_shards")
		_wps = get_tree().get_first_node_in_group("go_waypoints")
		return
	match _step:
		0: # ① 개수·자리
			var regions := {}
			var placed := true
			for row in StarShards.SHARDS:
				regions[row[1]] = int(regions.get(row[1], 0)) + 1
				var p := StarShards.pos_of(row)
				match row[3]:
					"peak": placed = placed and p.y > TerrainBuilder.height_at(row[1], p) + 1.0
					"water": placed = placed and absf(p.y - (TerrainBuilder.WATER_LEVEL + 0.6)) < 0.01
			var nodes: Dictionary = _ss.get("_nodes")
			_check("layout", StarShards.total() == 41 and regions.size() == 10 and placed and nodes.size() == 41 and StarShards.collected() == 0,
				"regions=%s placed=%s nodes=%d" % [regions, placed, nodes.size()])
			_next()
		1: # ② 줍기
			if _frame == 1:
				_ex0 = WorldMap.exploration("village")
				_touch("v_grove")
			if _frame == 5:
				var nodes: Dictionary = _ss.get("_nodes")
				_check("pick", StarShards.collected() == 1 and EventState.is_resolved("shard_v_grove") and not nodes.has("v_grove") \
					and WorldMap.exploration("village") > _ex0, "collected=%d explore %.2f→%.2f" % [StarShards.collected(), _ex0, WorldMap.exploration("village")])
				_next()
		2: # ③ 신상 곁 — 하나만으로는 Lv 그대로
			if _frame == 1:
				_stand_statue()
			if _frame == 45:
				_check("offer_one", StarShards.offered() == 1 and StarShards.statue_level() == 0 and is_equal_approx(float(_p.get("stamina_max")), 100.0),
					"offered=%d lv=%d max=%.0f" % [StarShards.offered(), StarShards.statue_level(), float(_p.get("stamina_max"))])
				_next()
		3: # ④ 둘째 → 신상 Lv.1
			if _frame == 1:
				_mora0 = PartyState.count("mora")
				_touch("v_river")
			if _frame == 5:
				_stand_statue()
			if _frame == 50:
				var ok := StarShards.statue_level() == 1 and is_equal_approx(float(_p.get("stamina_max")), 108.0) \
					and PartyState.count("mora") == _mora0 + 1000
				_check("offer_level", ok, "lv=%d max=%.0f mora %d→%d" % [StarShards.statue_level(), float(_p.get("stamina_max")), _mora0, PartyState.count("mora")])
				_next()
		4: # ⑤ 새 상한까지 찬다
			if _frame == 1:
				_p.stamina = 100.0
			if _frame == 150:
				_check("stamina_fill", _p.stamina > 107.9 and _p.stamina <= 108.0, "st=%.1f" % _p.stamina)
				_next()
		5: # ⑥ 다시 짓기
			var again: Node3D = StarShards.new()
			_p.set("stamina_max", 100.0)
			get_tree().current_scene.add_child(again)
			var nodes: Dictionary = again.get("_nodes")
			var ok := nodes.size() == 39 and is_equal_approx(float(_p.get("stamina_max")), 108.0)
			_check("rebuild", ok, "nodes=%d max=%.0f" % [nodes.size(), float(_p.get("stamina_max"))])
			again.queue_free()
			_next()
		6:
			print("SHARD_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _touch(id: String) -> void:
	var nodes: Dictionary = _ss.get("_nodes")
	var mi: Node3D = nodes[id]
	_p.global_position = mi.global_position - Vector3.UP * 0.9
	_p.velocity = Vector3.ZERO

func _stand_statue() -> void:
	var at: Vector3 = _wps.call("world_pos_of", "v_statue")
	_p.global_position = at + Vector3(0.0, 0.4, 2.5)
	_p.velocity = Vector3.ZERO

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("SHARD_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
