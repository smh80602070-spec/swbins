extends Node
## GO 열째 지역 세갈래 고을(PLAN 106장 55-1, world/region10_fork.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_FORK_PROBE 가 있을 때만 단다.
##
##   SAGA_FORK_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## [1] 표 — 9×9 · 서리봉 고원 (4,0) 고개 = 이 지역 (4,8) 길, 두 변이 맞닿음 · 다른 지역과 안 겹침 · 도감 place 160 이상 · 발견 지점 열여섯
## [2] 순간이 풀리기 전(38장 3) — 호박 장막이 서 있고, 고원에서 북쪽으로 걸어가도 못 넘는다
## [3] 풀린 뒤(38장 4) — 장막이 걷히고, 고원에서 걸어 고개를 넘어 세갈래 고을에 들어선다
## [4] 명소 — 종루 윗면에 선다 · 기관차·성문 문루 충돌 · 격자 말뚝 셋·멈춘 별까마귀·하늘 틈·알갱이 그대로(10부 끝 뒤)
## [5] 이야기 상태 — 37장 격자 말뚝 차례로 꺼짐 · 38장 별까마귀 깨어남 · 순간이 풀림(틈·알갱이 사라짐·장막 걷힘) ·
##     금고 가장 깊은 진열장(10부 전 숨음 → 봉인 → 깨짐)
## [6] 자리 — 순간이동 지점·상자·말뚝 앞·대장간 앞·성문 사이·기관차 앞·종루 앞·진열장 속 들어오는 자리가 명소에 안 묻힘.
## 이야기 상태·자리는 끝에 되돌린다. 저장은 안 한다.

const Fork := preload("res://games/saga_go/world/region10_fork.gd")
const Vault := preload("res://games/saga_go/world/region9_vault.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Waypoints := preload("res://games/saga_go/world/waypoints.gd")
const TreasureSpawner := preload("res://games/saga_go/world/treasure_spawner.gd")

var _p: CharacterBody3D
var _fr: Node
var _vr: Node
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
	if _fr == null:
		_fr = get_tree().get_first_node_in_group("go_fork_region")
		_vr = get_tree().get_first_node_in_group("go_vault_region")
		_frame = 0
		return
	match _step:
		0:
			_saved = {"story": PartyState.story.duplicate(true), "pos": _p.global_position}
			PartyState.story = {"ch": Fork.CH38, "step": Fork.MOMENT_FREE_STEP - 1}
			_next()
		1: # [1] 표
			if _frame < 5:
				return
			var bad: Array = []
			var s := TestMap.size("fork")
			if s != Vector2i(9, 9):
				bad.append("size %s" % [s])
			if TestMap.tile_at(4, 0, "frost") != "=" or TestMap.tile_at(4, 8, "fork") != "=":
				bad.append("pass tiles %s %s" % [TestMap.tile_at(4, 0, "frost"), TestMap.tile_at(4, 8, "fork")])
			var a := TestMap.world_pos(4.0, 8.0, "fork")
			var b := TestMap.world_pos(4.0, 0.0, "frost")
			if absf(a.x - b.x) > 0.01 or absf((b.z - a.z) - TestMap.TILE_SIZE) > 0.01:
				bad.append("edge a=%s b=%s" % [a, b])
			if TestMap.region_at(Fork.cell_pos(Vector2(4, 4))) != "fork":
				bad.append("region_at")
			for other in ["village", "frost", "vault", "amber"]:
				if TestMap.region_at(TestMap.world_pos(4.0, 4.0, other)) != other:
					bad.append("overlap %s" % other)
			for corner in [Vector2(0, 0), Vector2(8, 0), Vector2(0, 8), Vector2(8, 8)]:
				if TestMap.region_at(TestMap.world_pos(corner.x, corner.y, "fork")) != "fork":
					bad.append("corner %s" % corner)
			if int(CodexState.TOTAL.place) < 160:
				bad.append("codex %d" % CodexState.TOTAL.place)
			var disc := _fr.find_children("Discover_fork_*", "Area3D", false, false).size()
			if disc != 16:
				bad.append("discoveries %d" % disc)
			_check("table", bad.is_empty(), str(bad))
			_next()
		2: # [2] 풀리기 전 — 장막이 막는다
			_walk_pass(false)
		3: # [3] 풀린 뒤 — 걸어 넘는다
			if _frame == 1:
				PartyState.story = {"ch": Fork.CH38, "step": Fork.MOMENT_FREE_STEP}
			_walk_pass(true)
		4: # [4] 명소(10부 끝 뒤, 11부 처음)
			if _frame == 1:
				PartyState.story = {"ch": Fork.CH36, "step": 0}
				_put(Fork.tower_top() + Vector3(1.2, 0.5, 1.2))
			if _frame == 70:
				var y_ok := absf(_p.global_position.y - Fork.tower_top().y) < 0.6 and _p.is_on_floor()
				var loco := _hits(Fork.cell_pos(Fork.LOCO_CELL))
				var gate_tower := _hits(Fork.cell_pos(Fork.GATE_TOWN_CELL) + Vector3(4.0, 0, 0))
				var lit := range(3).filter(func(k: int) -> bool: return bool(_fr.call("lattice_lit", k)))
				var ok: bool = y_ok and not loco.is_empty() and not gate_tower.is_empty() and lit.size() == 3 and bool(_fr.call("crow_visible")) \
					and bool(_fr.call("rift_visible")) and bool(_fr.call("specks_visible")) and not bool(_fr.call("is_gate_open"))
				_check("landmarks", ok, "top=%s y=%.2f/%.2f loco=%s gate=%s lit=%s crow=%s rift=%s specks=%s" % [y_ok, _p.global_position.y, Fork.tower_top().y,
					loco, gate_tower, lit, _fr.call("crow_visible"), _fr.call("rift_visible"), _fr.call("specks_visible")])
				_next()
		5: # [5] 이야기 상태
			var seq := [[Vault.CH35, 0], [Fork.CH36, 0], [Fork.CH37, 2], [Fork.CH37, 5], [Fork.CH37, 7], [Fork.CH38, 1], [Fork.CH38, 4]]
			var i := int((_frame - 1) / 70)
			if i < seq.size() and (_frame - 1) % 70 == 0:
				PartyState.story = {"ch": seq[i][0], "step": seq[i][1]}
				if i == 0:
					_v = []
			if i <= seq.size() and _frame > 1 and (_frame - 1) % 70 == 69:
				_v.append([range(3).filter(func(k: int) -> bool: return bool(_fr.call("lattice_lit", k))), bool(_fr.call("crow_visible")),
					bool(_fr.call("rift_visible")), bool(_fr.call("specks_visible")), bool(_fr.call("is_gate_open")), String(_vr.call("deep_case_state"))])
			if _frame == 70 * seq.size() + 2:
				var want := [[[0, 1, 2], true, true, true, false, "hidden"], [[0, 1, 2], true, true, true, false, "sealed"],
					[[1, 2], true, true, true, false, "sealed"], [[2], true, true, true, false, "sealed"], [[], true, true, true, false, "sealed"],
					[[], false, true, true, false, "sealed"], [[], false, false, false, true, "broken"]]
				_check("story_states", str(_v) == str(want), "got=%s" % [_v])
				_next()
		6: # [6] 자리가 명소에 안 묻힘
			var bad: Array = []
			for w in Waypoints.POINTS:
				if String(w[1]) == "fork":
					var p := _cell(String(w[1]), w[2])
					if not _hits(p).is_empty():
						bad.append("wp %s %s" % [w[0], _hits(p)])
			for row in TreasureSpawner.CHESTS:
				if String(row[1]) == "fork" and String(row[3]) != "exquisite":
					var p := _cell("fork", row[2])
					if not _hits(p).is_empty():
						bad.append("chest %s %s" % [row[0], _hits(p)])
			for k in 2:
				if not _hits(Fork.lattice_pos(k) + Vector3(0, 0, 2.5)).is_empty():
					bad.append("lattice front %d" % k)
			var fronts := {"forge": Fork.cell_pos(Fork.FORGE_CELL) + Vector3(-1.0, 0, Fork.FORGE_SIZE.z * 0.5 + 1.5),
				"town_gate": Fork.cell_pos(Fork.GATE_TOWN_CELL), "arrive": _cell("fork", Vector2(4.0, 7.0)),
				"junction": Fork.cell_pos(Fork.JUNCTION_CELL) + Vector3(2.0, 0, 2.0), "works": Fork.cell_pos(Fork.WORKS_CELL),
				"loco_front": Fork.cell_pos(Fork.LOCO_CELL) + Vector3(0, 0, Fork.LOCO_SIZE.z * 0.5 + 2.5),
				"tower_front": Fork.cell_pos(Fork.TOWER_CELL) + Vector3(0, 0, Fork.TOWER_W * 0.5 + 2.0),
				"deep_case": Vault.deep_case_pos() + Vector3(0, 0, 1.8)}
			for k in fronts:
				if not _hits(fronts[k]).is_empty():
					bad.append("%s %s" % [k, _hits(fronts[k])])
			_check("spots_clear", bad.is_empty(), str(bad))
			_next()
		7:
			PartyState.story = _saved.story
			_p.global_position = _saved.pos
			Input.action_release("move_forward")
			print("FORK_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

## 서리봉 고원 (4,0.3) 에서 북쪽으로 걷는다 — open 이면 세갈래 고을에 들어서야, 아니면 고원에 남아야.
func _walk_pass(open: bool) -> void:
	var start := _cell("frost", Vector2(4.0, 0.3))
	if _frame == 40:
		_put(start)
		_v = {"gate": bool(_fr.call("is_gate_open"))}
	if _frame > 40 and _frame < 700:
		_p.set("stamina", float(_p.get("stamina_max")))
		var rig := get_tree().get_first_node_in_group("camera_rig") as Node3D
		if rig:
			rig.global_rotation = Vector3(rig.global_rotation.x, 0.0, 0.0) # 북쪽(−z)
		Input.action_press("move_forward")
	if _frame == 700:
		Input.action_release("move_forward")
		var reg := TestMap.region_at(_p.global_position)
		var ok: bool = bool(_v.gate) == open and (reg == "fork") == open
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
	print("FORK_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])
