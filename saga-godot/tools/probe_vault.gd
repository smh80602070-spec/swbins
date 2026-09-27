extends Node
## GO 아홉째 지역 갈무리 벌(PLAN 106장 54-1, world/region9_vault.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_VAULT_PROBE 가 있을 때만 단다.
##
##   SAGA_VAULT_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## [1] 표 — 9×9 · 서리봉 고원 (8,3) 고개 = 이 지역 (0,3) 길, 두 변이 맞닿음 · 도감 place 144 이상 · 발견 지점 열여섯
## [2] 9부 전(ch 31) — 빛 울타리가 서 있고, 고개를 걸어가도 못 넘는다
## [3] 9부 뒤(ch 32) — 울타리가 꺼지고, 고원에서 걸어 고개를 넘어 갈무리 벌에 들어선다
## [4] 명소 — 기록 기둥 윗면에 선다 · 금고 문 닫힘(문 자리에 충돌) · 동력 기둥 둘·핵 켜짐 · 해미 진열장·곳간 문 그대로
## [5] 이야기 상태 — 34장 곳간 문 · 동력 기둥 차례로 꺼짐 · 금고 문 열림 · 35장 핵 꺼짐 · 해미 진열장 깨짐
## [6] 자리 — 순간이동 지점·상자·기둥 앞·곳간 앞·창고 앞·열린 문·진열장 사이 길이 명소에 안 묻힘.
## 이야기 상태·자리는 끝에 되돌린다. 저장은 안 한다.

const Vault := preload("res://games/saga_go/world/region9_vault.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Waypoints := preload("res://games/saga_go/world/waypoints.gd")
const TreasureSpawner := preload("res://games/saga_go/world/treasure_spawner.gd")

var _p: CharacterBody3D
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
	if _vr == null:
		_vr = get_tree().get_first_node_in_group("go_vault_region")
		_frame = 0
		return
	match _step:
		0:
			_saved = {"story": PartyState.story.duplicate(true), "pos": _p.global_position}
			PartyState.story = {"ch": 31, "step": 0}
			_next()
		1: # [1] 표
			if _frame < 5:
				return
			var bad: Array = []
			var s := TestMap.size("vault")
			if s != Vector2i(9, 9):
				bad.append("size %s" % [s])
			if TestMap.tile_at(8, 3, "frost") != "=" or TestMap.tile_at(0, 3, "vault") != "=":
				bad.append("pass tiles %s %s" % [TestMap.tile_at(8, 3, "frost"), TestMap.tile_at(0, 3, "vault")])
			var a := TestMap.world_pos(0.0, 3.0, "vault")
			var b := TestMap.world_pos(8.0, 3.0, "frost")
			if absf(a.z - b.z) > 0.01 or absf((a.x - b.x) - TestMap.TILE_SIZE) > 0.01:
				bad.append("edge a=%s b=%s" % [a, b])
			if TestMap.region_at(Vault.cell_pos(Vector2(4, 4))) != "vault":
				bad.append("region_at")
			for other in ["village", "coast", "frost"]:
				if TestMap.region_at(TestMap.world_pos(4.0, 4.0, other)) != other:
					bad.append("overlap %s" % other)
			if int(CodexState.TOTAL.place) < 144:
				bad.append("codex %d" % CodexState.TOTAL.place)
			var disc := _vr.find_children("Discover_vault_*", "Area3D", false, false).size()
			if disc != 16:
				bad.append("discoveries %d" % disc)
			_check("table", bad.is_empty(), str(bad))
			_next()
		2: # [2] 9부 전 — 울타리가 막는다
			_walk_pass(false)
		3: # [3] 9부 뒤 — 걸어 넘는다
			if _frame == 1:
				PartyState.story = {"ch": 32, "step": 0}
			_walk_pass(true)
		4: # [4] 명소
			if _frame == 1:
				_put(Vault.pillar_top() + Vector3(0.8, 0.5, 0.8))
			if _frame == 60:
				var y_ok := absf(_p.global_position.y - Vault.pillar_top().y) < 0.6 and _p.is_on_floor()
				var door_hits := _hits(_door_pos())
				var pylons := range(2).filter(func(k: int) -> bool: return bool(_vr.call("pylon_lit", k)))
				var ok: bool = y_ok and not bool(_vr.call("is_door_open")) and not door_hits.is_empty() and pylons.size() == 2 \
					and bool(_vr.call("core_lit")) and bool(_vr.call("haemi_sealed")) and bool(_vr.call("granary_locked"))
				_check("landmarks", ok, "top=%s y=%.2f/%.2f door=%s pylons=%s core=%s haemi=%s granary=%s" % [y_ok, _p.global_position.y, Vault.pillar_top().y,
					door_hits, pylons, _vr.call("core_lit"), _vr.call("haemi_sealed"), _vr.call("granary_locked")])
				_next()
		5: # [5] 이야기 상태
			var seq := [[Vault.CH34, 2], [Vault.CH34, 5], [Vault.CH34, 6], [Vault.CH35, 5], [Vault.CH35, 6]]
			var i := int((_frame - 1) / 70)
			if i < seq.size() and (_frame - 1) % 70 == 0:
				PartyState.story = {"ch": seq[i][0], "step": seq[i][1]}
				if i == 0:
					_v = []
			if i <= seq.size() and _frame > 1 and (_frame - 1) % 70 == 69:
				_v.append([bool(_vr.call("granary_locked")), range(2).filter(func(k: int) -> bool: return bool(_vr.call("pylon_lit", k))),
					bool(_vr.call("is_door_open")), bool(_vr.call("core_lit")), bool(_vr.call("haemi_sealed"))])
			if _frame == 70 * seq.size() + 2:
				var want := [[false, [0, 1], false, true, true], [false, [1], false, true, true], [false, [], true, true, true],
					[false, [], true, false, true], [false, [], true, false, false]]
				_check("story_states", str(_v) == str(want), "got=%s" % [_v])
				_next()
		6: # [6] 자리가 명소에 안 묻힘(문은 열린 상태)
			var bad: Array = []
			for w in Waypoints.POINTS:
				if String(w[1]) == "vault":
					var p := _cell(String(w[1]), w[2])
					if not _hits(p).is_empty():
						bad.append("wp %s %s" % [w[0], _hits(p)])
			for row in TreasureSpawner.CHESTS:
				if String(row[1]) == "vault" and String(row[3]) != "exquisite":
					var p := _cell("vault", row[2])
					if not _hits(p).is_empty():
						bad.append("chest %s %s" % [row[0], _hits(p)])
			for k in 2:
				if not _hits(Vault.pylon_pos(k) + Vector3(0, 0, 2.5)).is_empty():
					bad.append("pylon front %d" % k)
			var fronts := {"granary": Vault.cell_pos(Vault.GRANARY_CELL) + Vector3(0, 0, Vault.GRANARY_SIZE.z * 0.5 + 2.0),
				"warehouse": Vault.cell_pos(Vault.WAREHOUSE_CELL) + Vector3(0, 0, Vault.WAREHOUSE_SIZE.z * 0.5 + 2.5),
				"door": _door_pos(), "inside": Vault.cell_pos(Vault.VAULT_CELL) + Vector3(0, 0, 4.0),
				"haemi": Vault.case_pos(Vault.HAEMI_CASE_DEG) + Vector3(0, 0, 1.6)}
			for k in fronts:
				if not _hits(fronts[k]).is_empty():
					bad.append("%s %s" % [k, _hits(fronts[k])])
			_check("spots_clear", bad.is_empty(), str(bad))
			_next()
		7:
			PartyState.story = _saved.story
			_p.global_position = _saved.pos
			Input.action_release("move_forward")
			print("VAULT_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

## 금고 남쪽 문 한가운데(월드).
func _door_pos() -> Vector3:
	return Vault.cell_pos(Vault.VAULT_CELL) + Vector3(0, 0, Vault.VAULT_R)

## 서리봉 고원 (7.65,3) 에서 동쪽으로 걷는다 — open 이면 갈무리 벌에 들어서야, 아니면 고원에 남아야.
func _walk_pass(open: bool) -> void:
	var start := _cell("frost", Vector2(7.65, 3.0))
	if _frame == 40:
		_put(start)
		_v = {"gate": bool(_vr.call("is_gate_open"))}
	if _frame > 40 and _frame < 700:
		_p.set("stamina", float(_p.get("stamina_max")))
		var rig := get_tree().get_first_node_in_group("camera_rig") as Node3D
		if rig:
			rig.global_rotation = Vector3(rig.global_rotation.x, -PI * 0.5, 0.0) # 동쪽(+x)
		Input.action_press("move_forward")
	if _frame == 700:
		Input.action_release("move_forward")
		var reg := TestMap.region_at(_p.global_position)
		var ok: bool = bool(_v.gate) == open and (reg == "vault") == open
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
	print("VAULT_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])
