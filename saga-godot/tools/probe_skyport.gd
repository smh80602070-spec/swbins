extends Node
## GO 다섯째 지역 은하 나루(PLAN 106장 ㊽, world/region5_skyport.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_SKYPORT_PROBE 가 있을 때만 단다.
##
##   SAGA_SKYPORT_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 표(9×9·틈 고개 칸 맞물림·지역 판정·겹침 없음) ② 지형(메시·충돌·금속 바닥 높이)
## ③ 시간 틈 문 — 15장 전엔 닫힘(막·충돌이 고개를 막음) ④ 15장 뒤 열림 → 마을 서쪽 숲 끝 → 고개 → 나루 → 역, 1m 마다 턱 0.5m 이하·막힘 없음
## ⑤ 순간이동 지점 셋(신상 하나)·신상 켜면 지도 드러남 ⑥ 들판 무리 셋(여덟 마리, 땅 위)
## ⑦ 상자 다섯·별조각 셋·채집 아홉(자리 넷)이 나루에, 명소 충돌에 안 묻힘 ⑧ 탐험도 칸 수(지점 3 + 상자 5 + 별조각 3)
## ⑨ 발견 지점 열여섯(옛 절터 들어서면 도감) ⑩ 지도 이름·지도 범위.
## 이야기·지점·도감·위치는 끝에 되돌린다. 저장은 안 한다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Waypoints := preload("res://games/saga_go/world/waypoints.gd")
const TreasureSpawner := preload("res://games/saga_go/world/treasure_spawner.gd")
const StarShards := preload("res://games/saga_go/world/star_shards.gd")
const Gathering := preload("res://games/saga_go/world/gathering.gd")
const WorldMap := preload("res://games/saga_go/ui/world_map.gd")
const Skyport := preload("res://games/saga_go/world/region5_skyport.gd")

const R := "skyport"

var _p: CharacterBody3D
var _sk: Node
var _frame := 0
var _step := 0
var _fails := 0
var _saved := {}

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player") as CharacterBody3D

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _sk == null:
		_sk = get_tree().get_first_node_in_group("go_skyport_region")
		_frame = 0
		return
	if _frame < 5 and _step == 0:
		return
	match _step:
		0: # ① 표
			_saved = {"story": PartyState.story.duplicate(true), "resolved": EventState.resolved.duplicate(), "book": CodexState.book.duplicate(), "pos": _p.global_position}
			var s := TestMap.size(R)
			var bad: Array = []
			if s != Vector2i(9, 9):
				bad.append("size %s" % s)
			if TestMap.tile_at(8, 3, R) != "=" or TestMap.tile_at(0, 4, "village") != "T":
				bad.append("pass tiles")
			var a := TestMap.world_pos(8, 3, R)
			var b := TestMap.world_pos(0, 4, "village")
			if absf(a.z - b.z) > 0.01 or absf((b.x - a.x) - TestMap.TILE_SIZE) > 0.01:
				bad.append("seam a=%s b=%s" % [a, b])
			if TestMap.region_at(a) != R or TestMap.region_at(b) != "village" or TestMap.region_at(Vector3((a.x + b.x) * 0.5 - 1.0, 0, a.z)) != R:
				bad.append("region_at")
			for rid in TestMap.REGIONS:
				if rid != R and TestMap.region_at(TestMap.world_pos(0, 0, rid)) != rid:
					bad.append("overlap " + rid)
			_check("tables", bad.is_empty(), str(bad))
			_next()
		1: # ② 지형
			var t := _sk.get_node_or_null("SkyportTerrain")
			var mesh_ok := false
			var col_ok := false
			if t:
				for c in t.get_children():
					if c is MeshInstance3D and (c as MeshInstance3D).mesh != null:
						mesh_ok = true
					if c is StaticBody3D:
						col_ok = true
			var h := TerrainBuilder.height_at(R, TestMap.world_pos(5, 2, R))
			var ray: Variant = _ray_down(TestMap.world_pos(6.2, 2.2, R))
			_check("terrain", mesh_ok and col_ok and absf(h - 0.1) < 0.01 and ray != null and absf(float(ray) - 0.1) < 0.3, "mesh=%s col=%s h=%.2f ray=%s" % [mesh_ok, col_ok, h, ray])
			_next()
		2: # ③ 시간 틈 문 — 15장 전
			if _frame == 1:
				PartyState.story = {"ch": 14, "step": 0}
			if _frame == 70: # 1초마다 본다 — 고개 칸 폭(북쪽 끝·가운데·남쪽 끝 세 줄)이 모두 문 자리(월드 x −288, 86m 중 43m)에서 막힌다
				var hits: Array = []
				for y in [2.62, 3.0, 3.38]:
					hits.append(snappedf(_cast(TestMap.world_pos(0.4, y + 1.0, "village"), TestMap.world_pos(7.6, y, R)), 0.01))
				var veil := _sk.find_child("Veil", true, false) as Node3D
				_check("gate_closed", not bool(_sk.call("is_gate_open")) and veil.visible and hits.all(func(h: float) -> bool: return h > 0.4 and h < 0.52),
					"open=%s veil=%s hits=%s" % [_sk.call("is_gate_open"), veil.visible, hits])
				_next()
		3: # ④ 15장 뒤 — 문이 열리고 걸어서 넘는다
			if _frame == 1:
				PartyState.story = {"ch": 15, "step": 0}
			if _frame < 70:
				return
			var pts := [TestMap.world_pos(0.3, 4.0, "village"), TestMap.world_pos(7.6, 3.0, R), TestMap.world_pos(6.2, 3.0, R),
				TestMap.world_pos(5.0, 3.0, R), TestMap.world_pos(5.0, 2.2, R), TestMap.world_pos(5.0, 4.2, R), TestMap.world_pos(4.1, 5.0, R),
				TestMap.world_pos(4.2, 6.9, R)]
			var worst := 0.0
			var blocked: Array = []
			var n := 0
			for i in range(pts.size() - 1):
				var from: Vector3 = pts[i]
				var to: Vector3 = pts[i + 1]
				var steps := int(from.distance_to(to))
				var prev_h := _surface(from)
				for k in range(1, steps + 1):
					var p0 := from.lerp(to, float(k - 1) / steps)
					var p1 := from.lerp(to, float(k) / steps)
					var h1 := _surface(p1)
					worst = maxf(worst, absf(h1 - prev_h))
					if _cast_at(p0, p1, maxf(prev_h, h1)) < 1.0:
						blocked.append("%s" % TestMap.region_at(p1) + " (%.0f,%.0f)" % [p1.x, p1.z])
					prev_h = h1
					n += 1
			var veil := _sk.find_child("Veil", true, false) as Node3D
			_check("gate_open_walk", bool(_sk.call("is_gate_open")) and not veil.visible and worst <= 0.5 and blocked.is_empty() and n > 300,
				"open=%s samples=%d worst_step=%.2f blocked=%s" % [_sk.call("is_gate_open"), n, worst, blocked.slice(0, 6)])
			_next()
		4: # ⑤ 순간이동 지점·지도 드러남
			var ids: Array = []
			var statues := 0
			for row in Waypoints.POINTS:
				if row[1] == R:
					ids.append(row[0])
					if row[3]:
						statues += 1
			var map := get_tree().get_first_node_in_group("go_world_map")
			EventState.resolved.erase("wp_s_statue")
			var hidden_before := not bool(map.call("revealed", R))
			get_tree().get_first_node_in_group("go_waypoints").call("activate", "s_statue")
			var shown := bool(map.call("revealed", R))
			_check("waypoints", ids.size() == 3 and statues == 1 and hidden_before and shown and WorldMap.REGION_STATUE.skyport == "s_statue", "ids=%s statues=%d hidden=%s shown=%s" % [ids, statues, hidden_before, shown])
			_next()
		5: # ⑥ 들판 무리
			var n := 0
			var bad: Array = []
			for e in get_tree().get_nodes_in_group("field_enemy"):
				var home: Vector3 = e.get("home")
				if TestMap.region_at(home) != R:
					continue
				n += 1
				var gy := TerrainBuilder.height_at(R, (e as Node3D).global_position)
				if (e as Node3D).global_position.y < gy - 0.6:
					bad.append("%s under %.1f<%.1f" % [e.name, (e as Node3D).global_position.y, gy])
			_check("camps", n == 8 and bad.is_empty(), "n=%d bad=%s" % [n, bad])
			_next()
		6: # ⑦ 상자·별조각·채집이 나루에, 명소 충돌에 안 묻힘
			var spots: Array = []
			for row in TreasureSpawner.CHESTS:
				if row[1] == R:
					var p := TestMap.world_pos(row[2].x, row[2].y, R)
					p.y = TerrainBuilder.height_at(R, p)
					spots.append(["chest " + String(row[0]), p])
			for row in StarShards.in_region(R):
				var p := TestMap.world_pos(row[2].x, row[2].y, R)
				p.y = TerrainBuilder.height_at(R, p)
				spots.append(["shard " + String(row[0]), p])
			var g := 0
			for nd in Gathering.all_nodes():
				if nd[2] == R:
					g += 1
					spots.append(["gather " + String(nd[0]), nd[3]])
			for row in Waypoints.POINTS:
				if row[1] == R:
					var p := TestMap.world_pos(row[2].x, row[2].y, R)
					p.y = TerrainBuilder.height_at(R, p)
					spots.append(["wp " + String(row[0]), p])
			var buried: Array = []
			for s in spots:
				var q := PhysicsShapeQueryParameters3D.new()
				var sph := SphereShape3D.new()
				sph.radius = 0.5
				q.shape = sph
				q.collision_mask = 1
				q.exclude = [_p.get_rid()]
				q.transform = Transform3D(Basis(), (s[1] as Vector3) + Vector3(0, 1.2, 0))
				for hit in _p.get_world_3d().direct_space_state.intersect_shape(q, 4):
					var c: Object = hit.collider
					if c is Node and _sk.is_ancestor_of(c as Node) and not String((c as Node).get_parent().name).begins_with("Skyport"):
						buried.append("%s in %s" % [s[0], (c as Node).get_parent().name])
			var nc := spots.filter(func(s: Array) -> bool: return String(s[0]).begins_with("chest")).size()
			var ns := spots.filter(func(s: Array) -> bool: return String(s[0]).begins_with("shard")).size()
			_check("pickups", nc == 5 and ns == 3 and g == 9 and buried.is_empty(), "chests=%d shards=%d gather=%d buried=%s" % [nc, ns, g, buried])
			_next()
		7: # ⑧ 탐험도 칸 수
			var total := 0
			for row in Waypoints.POINTS:
				if row[1] == R:
					total += 1
			for row in TreasureSpawner.CHESTS:
				if row[1] == R:
					total += 1
			total += StarShards.in_region(R).size()
			var e := WorldMap.exploration(R)
			_check("exploration", total == 11 and e >= 0.0 and e < 1.0, "total=%d exploration=%.2f" % [total, e])
			_next()
		8: # ⑨ 발견 지점
			if _frame == 1:
				var areas := 0
				for c in _sk.get_children():
					if c is Area3D and String(c.name).begins_with("Discover_skyport_"):
						areas += 1
				_saved["areas"] = areas
				CodexState.book.erase("place:skyport_temple")
				_p.global_position = Skyport.cell_pos(Vector2(2.5, 3.9)) + Vector3(0, 1.0, 0)
			if _frame == 20:
				_check("discovery", int(_saved.areas) == 16 and CodexState.has("place", "skyport_temple") and int(CodexState.TOTAL.place) >= 75, "areas=%d temple=%s" % [_saved.areas, CodexState.has("place", "skyport_temple")])
				_next()
		9: # ⑩ 이름·지도 범위
			var map := get_tree().get_first_node_in_group("go_world_map")
			var b: Rect2 = map.get("bounds")
			var sk := Rect2(-696.0, -216.0, 432.0, 432.0)
			_check("names", WorldMap.REGION_NAMES.get(R, "") == "은하 나루" and b.encloses(sk.grow(-1.0)), "bounds=%s" % b)
			_next()
		10:
			PartyState.story = _saved.story
			EventState.resolved.assign(_saved.resolved)
			CodexState.book = _saved.book
			_p.global_position = _saved.pos
			print("SKYPORT_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

## from → to 캡슐 한 번 밀기(발 높이 + 0.95) — 1.0 이면 안 막힘.
func _cast(from: Vector3, to: Vector3) -> float:
	var h := maxf(_surface(from), _surface(to))
	return _cast_at(from, to, h)

func _cast_at(p0: Vector3, p1: Vector3, foot: float) -> float:
	var excl: Array[RID] = [_p.get_rid()]
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if e is CollisionObject3D:
			excl.append((e as CollisionObject3D).get_rid())
	## 09-28 숲을 짙게 한 뒤(칸당 나무 10) 마을 숲 칸에서 출발하는 줄이 문보다 앞 나무 줄기에 걸렸다 — 이 쓸기는 문 자리를 보는 것이라 줄기는 뺀다(사람은 돌아 지나간다).
	for t in get_tree().current_scene.find_children("TreeTrunkCollisions", "StaticBody3D", true, false):
		excl.append((t as CollisionObject3D).get_rid())
	var q := PhysicsShapeQueryParameters3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.35
	cap.height = 1.2
	q.shape = cap
	q.collision_mask = 1 | TerrainBuilder.BORDER_LAYER
	q.exclude = excl
	q.transform = Transform3D(Basis(), Vector3(p0.x, foot + 0.95, p0.z))
	q.motion = Vector3(p1.x - p0.x, 0, p1.z - p0.z)
	var r := _p.get_world_3d().direct_space_state.cast_motion(q)
	return float(r[0]) if r.size() > 0 else 1.0

func _surface(p: Vector3) -> float:
	var r: Variant = _ray_down(p)
	return float(r) if r != null else TerrainBuilder.height_at(TestMap.region_at(p), p)

func _ray_down(p: Vector3) -> Variant:
	var q := PhysicsRayQueryParameters3D.create(Vector3(p.x, 80.0, p.z), Vector3(p.x, -20.0, p.z), 1)
	q.exclude = [_p.get_rid()]
	var hit := _p.get_world_3d().direct_space_state.intersect_ray(q)
	return (hit.position as Vector3).y if not hit.is_empty() else null

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("SKYPORT_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
