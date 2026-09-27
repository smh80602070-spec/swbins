extends Node
## GO 여덟째 지역 굳은 거리(PLAN 106장 53-1, world/region8_amber.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_AMBER_PROBE 가 있을 때만 단다.
##
##   SAGA_AMBER_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## [1] 표 — 9×9 · 은하 나루 (3,0) 고개 = 이 지역 (3,8) 길, 두 변이 맞닿음 · 도감 place 128 · 발견 지점 열여섯
## [2] 결말 전(ch 28) — 결정 막이 서 있고, 고개를 걸어 올라가도 못 넘는다
## [3] 결말 뒤(ch 29) — 막이 풀리고, 은하 나루에서 걸어 고개를 넘어 굳은 거리에 들어선다
## [4] 명소 — 굳은 자리 셋·장터 결정·태엽 심장 보임·신호등 빨강 · 부양탑 윗면에 선다
## [5] 이야기 상태 — 30장 굳은 자리가 차례로 녹음 · 31장 장터 결정 깨짐 · 32장 심장 녹음·신호등 초록
## [6] 자리 — 순간이동 지점·상자·채집·결정·잔불 칸이 명소에 안 묻힘.
## 이야기 상태·자리는 끝에 되돌린다. 저장은 안 한다.

const Amber := preload("res://games/saga_go/world/region8_amber.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Waypoints := preload("res://games/saga_go/world/waypoints.gd")
const TreasureSpawner := preload("res://games/saga_go/world/treasure_spawner.gd")

var _p: CharacterBody3D
var _am: Node
var _frame := 0
var _step := 0
var _fails := 0
var _v: Variant = null
var _saved := {}

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player") as CharacterBody3D

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _am == null:
		_am = get_tree().get_first_node_in_group("go_amber_region")
		_frame = 0
		return
	match _step:
		0:
			_saved = {"story": PartyState.story.duplicate(true), "pos": _p.global_position}
			PartyState.story = {"ch": 28, "step": 0}
			_next()
		1: # [1] 표
			if _frame < 5:
				return
			var bad: Array = []
			var s := TestMap.size("amber")
			if s != Vector2i(9, 9):
				bad.append("size %s" % [s])
			if TestMap.tile_at(3, 0, "skyport") != "=" or TestMap.tile_at(3, 8, "amber") != "=":
				bad.append("pass tiles %s %s" % [TestMap.tile_at(3, 0, "skyport"), TestMap.tile_at(3, 8, "amber")])
			var a := TestMap.world_pos(3.0, 8.0, "amber")
			var b := TestMap.world_pos(3.0, 0.0, "skyport")
			if absf(a.x - b.x) > 0.01 or absf((b.z - a.z) - TestMap.TILE_SIZE) > 0.01:
				bad.append("edge a=%s b=%s" % [a, b])
			if TestMap.region_at(Amber.cell_pos(Vector2(4, 4))) != "amber":
				bad.append("region_at")
			if int(CodexState.TOTAL.place) < 128:
				bad.append("codex %d" % CodexState.TOTAL.place)
			var disc := _am.find_children("Discover_amber_*", "Area3D", false, false).size()
			if disc != 16:
				bad.append("discoveries %d" % disc)
			_check("table", bad.is_empty(), str(bad))
			_next()
		2: # [2] 결말 전 — 막이 막는다
			_walk_pass(false)
		3: # [3] 결말 뒤 — 걸어 넘는다
			if _frame == 1:
				PartyState.story = {"ch": 29, "step": 0}
			_walk_pass(true)
		4: # [4] 명소
			if _frame == 1:
				_put(Amber.tower_top() + Vector3(1.5, 0.5, 1.5))
			if _frame == 60:
				var y_ok := absf(_p.global_position.y - Amber.tower_top().y) < 0.6 and _p.is_on_floor()
				var crystals := range(3).filter(func(k: int) -> bool: return bool(_am.call("crystal_visible", k)))
				var ok: bool = y_ok and crystals.size() == 3 and bool(_am.call("market_sealed")) and bool(_am.call("heart_lit")) and not bool(_am.call("lamp_green"))
				_check("landmarks", ok, "top=%s y=%.2f/%.2f crystals=%s market=%s heart=%s" % [y_ok, _p.global_position.y, Amber.tower_top().y, crystals, _am.call("market_sealed"), _am.call("heart_lit")])
				_next()
		5: # [5] 이야기 상태
			var seq := [[Amber.CH30, 5], [Amber.CH30, 7], [Amber.CH31, 2], [Amber.CH32, 3], [Amber.CH32, 5]]
			var i := int((_frame - 1) / 70)
			if i < seq.size() and (_frame - 1) % 70 == 0:
				PartyState.story = {"ch": seq[i][0], "step": seq[i][1]}
				if i == 0:
					_v = []
			if i <= seq.size() and _frame > 1 and (_frame - 1) % 70 == 69:
				_v.append([range(3).filter(func(k: int) -> bool: return bool(_am.call("crystal_visible", k))), bool(_am.call("market_sealed")), bool(_am.call("heart_lit")), bool(_am.call("lamp_green"))])
			if _frame == 70 * seq.size() + 2:
				var want := [[[1, 2], true, true, false], [[], true, true, false], [[], false, true, false], [[], false, false, false], [[], false, false, true]]
				_check("story_states", str(_v) == str(want), "got=%s" % [_v])
				_next()
		6: # [6] 자리가 명소에 안 묻힘
			var bad: Array = []
			for w in Waypoints.POINTS:
				if String(w[1]) == "amber":
					var p := _cell(String(w[1]), w[2])
					if not _hits(p).is_empty():
						bad.append("wp %s %s" % [w[0], _hits(p)])
			for row in TreasureSpawner.CHESTS:
				if String(row[1]) == "amber" and String(row[3]) != "exquisite":
					var p := _cell("amber", row[2])
					if not _hits(p).is_empty():
						bad.append("chest %s %s" % [row[0], _hits(p)])
			for k in 3:
				if not _hits(Amber.crystal_pos(k) + Vector3(0, 0, 2.5)).is_empty():
					bad.append("crystal front %d %s" % [k, _hits(Amber.crystal_pos(k) + Vector3(0, 0, 2.5))])
			var front := _cell("amber", Vector2(6.25, 5.3))
			if not _hits(front).is_empty():
				bad.append("shop front %s" % [_hits(front)])
			_check("spots_clear", bad.is_empty(), str(bad))
			_next()
		7:
			PartyState.story = _saved.story
			_p.global_position = _saved.pos
			Input.action_release("move_forward")
			print("AMBER_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

## 은하 나루 (3,0.35) 에서 북쪽으로 400프레임 걷는다 — open 이면 굳은 거리 (3,7) 둘레까지 들어가야, 아니면 은하 나루에 남아야.
func _walk_pass(open: bool) -> void:
	var start := _cell("skyport", Vector2(3.0, 0.35))
	if _frame == 40:
		_put(start)
		_v = {"gate": bool(_am.call("is_gate_open"))}
	if _frame > 40 and _frame < 700:
		_p.set("stamina", float(_p.get("stamina_max")))
		var rig := get_tree().get_first_node_in_group("camera_rig") as Node3D
		if rig:
			rig.global_rotation = Vector3(rig.global_rotation.x, 0.0, 0.0) # 북쪽(−z)
		Input.action_press("move_forward")
	if _frame == 700:
		Input.action_release("move_forward")
		var reg := TestMap.region_at(_p.global_position)
		var ok: bool = bool(_v.gate) == open and (reg == "amber") == open
		_check("pass_open" if open else "pass_closed", ok, "gate=%s region=%s pos=%s" % [_v.gate, reg, _p.global_position])
		_next()

func _cell(region: String, c: Vector2) -> Vector3:
	var p := TestMap.world_pos(c.x, c.y, region)
	p.y = TerrainBuilder.height_at(region, p)
	return p

## 그 자리 1.6m 위 반지름 1.2 에 걸리는 충돌(집·탑·명소) — 땅은 그 아래라 안 걸린다.
func _hits(pos: Vector3) -> Array:
	var q := PhysicsShapeQueryParameters3D.new()
	var sph := SphereShape3D.new()
	sph.radius = 1.2
	q.shape = sph
	q.collision_mask = 1
	q.exclude = [_p.get_rid()]
	q.transform = Transform3D(Basis(), pos + Vector3(0, 1.6, 0))
	var out: Array = []
	for hit in _p.get_world_3d().direct_space_state.intersect_shape(q, 4):
		out.append(String((hit.collider as Node).name))
	return out

func _put(p: Vector3) -> void:
	_p.global_position = p + Vector3(0.0, 0.3, 0.0)
	_p.velocity = Vector3.ZERO

func _next() -> void:
	_step += 1
	_frame = 0

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("AMBER_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])
