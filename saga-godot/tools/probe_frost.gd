extends Node
## GO 넷째 지역 서리봉 고원(PLAN 106장 ㊺, world/region4_frost.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_FROST_PROBE 가 있을 때만 단다.
##
##   SAGA_FROST_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 표(9×9·고개 칸 맞물림·지역 판정) ② 지형(메시·충돌·눈밭 높이·경계벽이 고개를 안 막음)
## ③ 걸어서 넘기 — 마을 역참 북쪽 → 굴 옆 → 고개 → 고원 가운데 → 관측소, 1m 마다 턱 0.5m 이하·막힘 없음
## ④ 순간이동 지점 셋(신상 하나)·신상 켜면 지도 드러남 ⑤ 들판 무리 넷(열한 마리, 땅 위)
## ⑥ 상자 다섯·별조각 셋·채집 셋이 고원에, 명소 충돌에 안 묻힘 ⑦ 탐험도 칸 수(지점 3 + 상자 5 + 별조각 3)
## ⑧ 발견 지점 열셋(옛 산성 터 들어서면 도감) ⑨ 눈 — 고원 안에서만 ⑩ 지도 이름·지역 이름.
## 지점·도감·위치는 끝에 되돌린다. 저장은 안 한다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Waypoints := preload("res://games/saga_go/world/waypoints.gd")
const TreasureSpawner := preload("res://games/saga_go/world/treasure_spawner.gd")
const StarShards := preload("res://games/saga_go/world/star_shards.gd")
const Gathering := preload("res://games/saga_go/world/gathering.gd")
const WorldMap := preload("res://games/saga_go/ui/world_map.gd")
const Frost := preload("res://games/saga_go/world/region4_frost.gd")
const FieldBosses := preload("res://games/saga_go/data/field_bosses.gd")
const FieldSpawner := preload("res://games/saga_go/combat/field_spawner.gd")

var _p: CharacterBody3D
var _fr: Node
var _frame := 0
var _step := 0
var _fails := 0
var _saved := {}

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player") as CharacterBody3D

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _fr == null:
		_fr = get_tree().get_first_node_in_group("go_frost_region")
		_frame = 0
		return
	if _frame < 5 and _step == 0:
		return
	match _step:
		0: # ① 표
			var s := TestMap.size("frost")
			var bad: Array = []
			if s != Vector2i(9, 9):
				bad.append("size %s" % s)
			if TestMap.tile_at(4, 8, "frost") != "=" or TestMap.tile_at(5, 0, "village") != "=":
				bad.append("pass tiles")
			## 고개 칸 두 개가 같은 x 폭으로 맞닿는다.
			var a := TestMap.world_pos(4, 8, "frost")
			var b := TestMap.world_pos(5, 0, "village")
			if absf(a.x - b.x) > 0.01 or absf((b.z - a.z) - TestMap.TILE_SIZE) > 0.01:
				bad.append("seam a=%s b=%s" % [a, b])
			if TestMap.region_at(a) != "frost" or TestMap.region_at(b) != "village" or TestMap.region_at(Vector3(a.x, 0, (a.z + b.z) * 0.5 - 1.0)) != "frost":
				bad.append("region_at")
			## 다른 지역과 안 겹친다.
			for rid in TestMap.REGIONS:
				if rid != "frost" and TestMap.region_at(TestMap.world_pos(0, 0, rid)) != rid:
					bad.append("overlap " + rid)
			_check("tables", bad.is_empty(), str(bad))
			_next()
		1: # ② 지형
			var t := _fr.get_node_or_null("FrostTerrain")
			var mesh_ok := false
			var col_ok := false
			if t:
				for c in t.get_children():
					if c is MeshInstance3D and (c as MeshInstance3D).mesh != null:
						mesh_ok = true
					if c is StaticBody3D:
						col_ok = true
			var h := TerrainBuilder.height_at("frost", TestMap.world_pos(2, 5, "frost"))
			var ray: Variant = _ray_down(TestMap.world_pos(2, 5, "frost"))
			_check("terrain", mesh_ok and col_ok and absf(h - 0.15) < 0.01 and ray != null and absf(float(ray) - 0.15) < 0.3, "mesh=%s col=%s h=%.2f ray=%s" % [mesh_ok, col_ok, h, ray])
			_next()
		2: # ③ 걸어서 넘기
			var pts := [TestMap.world_pos(5.3, 3.4, "village"), TestMap.world_pos(5.3, 0.3, "village"), TestMap.world_pos(4.3, 7.7, "frost"),
				TestMap.world_pos(4.3, 4.8, "frost"), TestMap.world_pos(3.5, 1.7, "frost")]
			var worst := 0.0
			var blocked: Array = []
			var n := 0
			var excl: Array[RID] = [_p.get_rid()]
			for e in get_tree().get_nodes_in_group("field_enemy"):
				if e is CollisionObject3D:
					excl.append((e as CollisionObject3D).get_rid())
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
					var q := PhysicsShapeQueryParameters3D.new()
					var cap := CapsuleShape3D.new()
					cap.radius = 0.35
					cap.height = 1.2
					q.shape = cap
					q.collision_mask = 1 | TerrainBuilder.BORDER_LAYER
					q.exclude = excl
					q.transform = Transform3D(Basis(), Vector3(p0.x, maxf(prev_h, h1) + 0.95, p0.z))
					q.motion = Vector3(p1.x - p0.x, 0, p1.z - p0.z)
					var r := _p.get_world_3d().direct_space_state.cast_motion(q)
					if r.size() > 0 and float(r[0]) < 1.0:
						blocked.append("%s" % TestMap.region_at(p1) + " (%.0f,%.0f)" % [p1.x, p1.z])
					prev_h = h1
					n += 1
			_check("walk_over", worst <= 0.5 and blocked.is_empty() and n > 300, "samples=%d worst_step=%.2f blocked=%s" % [n, worst, blocked.slice(0, 6)])
			_next()
		3: # ④ 순간이동 지점·지도 드러남
			_saved = {"resolved": EventState.resolved.duplicate(), "book": CodexState.book.duplicate(), "pos": _p.global_position}
			var ids: Array = []
			var statues := 0
			for row in Waypoints.POINTS:
				if row[1] == "frost":
					ids.append(row[0])
					if row[3]:
						statues += 1
			var map := get_tree().get_first_node_in_group("go_world_map")
			EventState.resolved.erase("wp_f_statue")
			var hidden_before := not bool(map.call("revealed", "frost"))
			get_tree().get_first_node_in_group("go_waypoints").call("activate", "f_statue")
			var shown := bool(map.call("revealed", "frost"))
			_check("waypoints", ids.size() == 3 and statues == 1 and hidden_before and shown and WorldMap.REGION_STATUE.frost == "f_statue", "ids=%s statues=%d hidden=%s shown=%s" % [ids, statues, hidden_before, shown])
			_next()
		4: # ⑤ 들판 무리
			var n := 0
			var bad: Array = []
			for e in get_tree().get_nodes_in_group("field_enemy"):
				var home: Vector3 = e.get("home")
				if TestMap.region_at(home) != "frost":
					continue
				n += 1
				var gy := TerrainBuilder.height_at("frost", (e as Node3D).global_position)
				if (e as Node3D).global_position.y < gy - 0.6:
					bad.append("%s under %.1f<%.1f" % [e.name, (e as Node3D).global_position.y, gy])
			_check("camps", n == 12 and bad.is_empty(), "n=%d bad=%s" % [n, bad]) # 무리 넷 열한 마리 + 들판 보스
			## 들판 보스 자리 — 반경 12m 가 평평하고(높이 차 1m 안), 상자·순간이동·별조각·무리·채집·명소에서 1칸(48m)+.
			var bc: Vector2 = FieldBosses.BOSSES.snow_bear_king.cell
			var bp := TestMap.world_pos(bc.x, bc.y, "frost")
			var hs: Array = []
			for k in 16:
				for r in [0.0, 6.0, 12.0]:
					var q: Vector3 = bp + Vector3(cos(TAU * k / 16.0), 0.0, sin(TAU * k / 16.0)) * float(r)
					hs.append(TerrainBuilder.height_at("frost", q))
			var near: Array = []
			var others: Array = []
			for row in TreasureSpawner.CHESTS:
				if row[1] == "frost":
					others.append(["chest " + String(row[0]), row[2]])
			for row in Waypoints.POINTS:
				if row[1] == "frost":
					others.append(["wp " + String(row[0]), row[2]])
			for row in StarShards.in_region("frost"):
				others.append(["shard " + String(row[0]), row[2]])
			for row in FieldSpawner.CAMPS:
				if row[0] == "frost":
					others.append(["camp", Vector2(row[1])])
			for nd in Gathering.all_nodes():
				if nd[2] == "frost":
					var g := TestMap.grid_at("frost", nd[3])
					others.append(["gather " + String(nd[0]), Vector2(g)])
			for c in [Vector2(3.0, 4.0), Vector2(4.4, 1.2), Vector2(6.45, 5.25), Vector2(3.5, 2.0)]:
				others.append(["landmark", c])
			for o in others:
				if (o[1] as Vector2).distance_to(bc) < 1.0:
					near.append("%s %.2f" % [o[0], (o[1] as Vector2).distance_to(bc)])
			var boss: Node3D = get_tree().get_first_node_in_group("go_field_bosses").call("boss", "snow_bear_king")
			var fb_ok: bool = boss != null and TestMap.region_at(boss.global_position) == "frost" and hs.max() - hs.min() < 1.0 and near.is_empty()
			_check("field_boss", fb_ok, "boss=%s flat=%.2f near=%s" % [boss != null, hs.max() - hs.min(), near])
			_next()
		5: # ⑥ 상자·별조각·채집이 고원에, 명소 충돌에 안 묻힘
			var spots: Array = []
			for row in TreasureSpawner.CHESTS:
				if row[1] == "frost":
					var p := TestMap.world_pos(row[2].x, row[2].y, "frost")
					p.y = TerrainBuilder.height_at("frost", p)
					spots.append(["chest " + String(row[0]), p])
			for row in StarShards.in_region("frost"):
				var p := TestMap.world_pos(row[2].x, row[2].y, "frost")
				p.y = TerrainBuilder.height_at("frost", p)
				spots.append(["shard " + String(row[0]), p])
			var g := 0
			for nd in Gathering.all_nodes():
				if nd[2] == "frost":
					g += 1
					spots.append(["gather " + String(nd[0]), nd[3]])
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
					if c is Node and _fr.is_ancestor_of(c as Node) and not String((c as Node).get_parent().name).begins_with("Frost"):
						buried.append("%s in %s" % [s[0], (c as Node).get_parent().name])
			var nc := spots.filter(func(s: Array) -> bool: return String(s[0]).begins_with("chest")).size()
			var ns := spots.filter(func(s: Array) -> bool: return String(s[0]).begins_with("shard")).size()
			var nodes := get_tree().get_nodes_in_group("treasure_chest").filter(func(c: Node) -> bool: return TestMap.region_at((c as Node3D).global_position) == "frost").size()
			_check("pickups", nc == 5 and ns == 3 and g == 13 and buried.is_empty() and nodes + _opened_frost_chests() == 5, "chests=%d(nodes %d) shards=%d gather=%d buried=%s" % [nc, nodes, ns, g, buried])
			_next()
		6: # ⑦ 탐험도 칸 수
			var total := 0
			for row in Waypoints.POINTS:
				if row[1] == "frost":
					total += 1
			for row in TreasureSpawner.CHESTS:
				if row[1] == "frost":
					total += 1
			total += StarShards.in_region("frost").size()
			var e := WorldMap.exploration("frost")
			_check("exploration", total == 11 and e > 0.0 and e < 1.0, "total=%d exploration=%.2f" % [total, e])
			_next()
		7: # ⑧ 발견 지점
			if _frame == 1:
				var areas := 0
				for c in _fr.get_children():
					if c is Area3D and String(c.name).begins_with("Discover_frost_"):
						areas += 1
				_saved["areas"] = areas
				CodexState.book.erase("place:frost_fort")
				_p.global_position = Frost.cell_pos(Vector2(3.0, 4.35)) + Vector3(0, 1.0, 0)
			if _frame == 20:
				_check("discovery", int(_saved.areas) == 13 and CodexState.has("place", "frost_fort") and int(CodexState.TOTAL.place) >= 56, "areas=%d fort=%s" % [_saved.areas, CodexState.has("place", "frost_fort")])
				_next()
		8: # ⑨ 눈
			if _frame == 1:
				_saved["inside"] = bool(_fr.call("player_inside"))
			if _frame == 5:
				var snow := _fr.get_node("Snowfall") as CPUParticles3D
				_saved["em_in"] = snow.emitting
				var sq := snow.mesh as QuadMesh
				_check("snow_mat", sq != null and (sq.material as BaseMaterial3D).billboard_mode == BaseMaterial3D.BILLBOARD_PARTICLES and sq.size.x <= 0.4, "size=%s" % (sq.size if sq != null else Vector2.ZERO))
				_p.global_position = TestMap.world_pos(5.3, 3.4, "village") + Vector3(0, 1.0, 0)
			if _frame == 12:
				var snow := _fr.get_node("Snowfall") as CPUParticles3D
				_check("snow", bool(_saved.inside) and bool(_saved.em_in) and not snow.emitting and not bool(_fr.call("player_inside")), "inside=%s em_in=%s em_out=%s" % [_saved.inside, _saved.em_in, snow.emitting])
				_next()
		9: # ⑩ 이름
			var map := get_tree().get_first_node_in_group("go_world_map")
			var b: Rect2 = map.get("bounds")
			var fr := Rect2(-216.0, -696.0, 432.0, 432.0)
			_check("names", WorldMap.REGION_NAMES.get("frost", "") == "서리봉 고원" and b.encloses(fr.grow(-1.0)), "bounds=%s" % b)
			_next()
		10:
			EventState.resolved.assign(_saved.resolved)
			CodexState.book = _saved.book
			_p.global_position = _saved.pos
			print("FROST_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _opened_frost_chests() -> int:
	var n := 0
	for row in TreasureSpawner.CHESTS:
		if row[1] == "frost" and EventState.is_resolved("chest_" + String(row[0])):
			n += 1
	return n

## 그 자리 실제 충돌 윗면(없으면 계산 높이).
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
	print("FROST_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])

func _next() -> void:
	_step += 1
	_frame = 0
