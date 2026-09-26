extends Node
## GO 일곱째 지역 잠긴 도읍(PLAN 106장 ㊿, world/region7_sunken.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_SUNKEN_PROBE 가 있을 때만 단다.
##
##   SAGA_SUNKEN_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 표(9×9·포구 (1,8) 고개와 (1,0) 맞물림·양옆 산·지역 판정·겹침 없음) ② 지형(메시·충돌·모래 높이·돔 바닥 −10·돔 안 물 없음·바다 물 있음)
## ③ 해무 문 — 5부 전엔 닫힘(막·충돌이 고개 폭 세 줄을 막음) ④ 5부 뒤 걷힘 → 포구 → 고개 → 모래밭 → 돌다리 → 궁궐 기단, 1m 마다 턱 0.5m 이하·막힘 없음
## ⑤ 기지 경사로 → 갑판 → 잔교 → 돔 받침 → 문 앞(22장 전엔 문이 막음) ⑥ 22장 뒤 문 → 층계참 → 경사로 → 마른 바닥
## ⑦ 순간이동 지점 셋(신상 하나)·신상 켜면 지도 드러남 ⑧ 들판 무리 셋(여덟 마리, 땅 위)
## ⑨ 상자 다섯·별조각 셋·채집 아홉, 명소 충돌에 안 묻힘 ⑩ 탐험도 칸 수(지점 3 + 상자 5 + 별조각 3)
## ⑪ 발견 지점 열여섯(궁궐 기단에 서면 도감) ⑫ 지도 이름·지도 범위
## ⑬ 명소 — 기단 윗면·디딤 지붕 셋(헤엄쳐 넘어오를 높이)·받침 윗면·등대 난간 판·헤엄 구간 가장 긴 곳 ≤ 55m(궁궐→돔→등대)·등대 불(23장 뒤).
## 이야기·지점·도감·위치는 끝에 되돌린다. 저장은 안 한다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Waypoints := preload("res://games/saga_go/world/waypoints.gd")
const TreasureSpawner := preload("res://games/saga_go/world/treasure_spawner.gd")
const StarShards := preload("res://games/saga_go/world/star_shards.gd")
const Gathering := preload("res://games/saga_go/world/gathering.gd")
const WorldMap := preload("res://games/saga_go/ui/world_map.gd")
const Sunken := preload("res://games/saga_go/world/region7_sunken.gd")

const R := "sunken"
const SWIM_RUN_MAX := 55.0

var _p: CharacterBody3D
var _su: Node
var _frame := 0
var _step := 0
var _fails := 0
var _saved := {}

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player") as CharacterBody3D

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _su == null:
		_su = get_tree().get_first_node_in_group("go_sunken_region")
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
			if TestMap.tile_at(1, 8, "coast") != "D" or TestMap.tile_at(1, 0, R) != "D":
				bad.append("pass tiles")
			if TestMap.tile_at(0, 0, R) != "^" or TestMap.tile_at(2, 0, R) != "^" or TestMap.tile_at(0, 8, "coast") != "^" or TestMap.tile_at(2, 8, "coast") != "^":
				bad.append("pass sides")
			var a := TestMap.world_pos(1, 8, "coast")
			var b := TestMap.world_pos(1, 0, R)
			if absf(a.x - b.x) > 0.01 or absf((b.z - a.z) - TestMap.TILE_SIZE) > 0.01:
				bad.append("seam a=%s b=%s" % [a, b])
			if TestMap.region_at(a) != "coast" or TestMap.region_at(b) != R or TestMap.region_at(Vector3(a.x, 0, (a.z + b.z) * 0.5 + 1.0)) != R:
				bad.append("region_at")
			for rid in TestMap.REGIONS:
				if rid != R and TestMap.region_at(TestMap.world_pos(0, 0, rid)) != rid:
					bad.append("overlap " + rid)
			_check("tables", bad.is_empty(), str(bad))
			_next()
		1: # ② 지형
			var t := _su.get_node_or_null("SunkenTerrain")
			var mesh_ok := false
			var col_ok := false
			if t:
				for c in t.get_children():
					if c is MeshInstance3D and (c as MeshInstance3D).mesh != null:
						mesh_ok = true
					if c is StaticBody3D:
						col_ok = true
			var h := TerrainBuilder.height_at(R, TestMap.world_pos(3, 1, R))
			var ray: Variant = _ray_down(TestMap.world_pos(3.3, 1.2, R))
			var fl := Sunken.dome_floor()
			var floor_hit: Variant = _ray_from(fl + Vector3(-8.0, 0, 0), 0.0)
			var dry := not _in_water(fl + Vector3(-8.0, 1.0, 0))
			var wet := _in_water(Sunken.at(Vector2(3.0, 5.0), -1.5))
			_check("terrain", mesh_ok and col_ok and absf(h - 0.05) < 0.01 and ray != null and absf(float(ray) - 0.05) < 0.3 \
				and floor_hit != null and absf(float(floor_hit) + 10.0) < 0.05 and dry and wet,
				"mesh=%s col=%s h=%.2f ray=%s floor=%s dry=%s wet=%s" % [mesh_ok, col_ok, h, ray, floor_hit, dry, wet])
			_next()
		2: # ③ 해무 문 — 5부 전
			if _frame == 1:
				PartyState.story = {"ch": 19, "step": 0}
			if _frame == 70:
				var hits: Array = []
				for x in [0.62, 1.0, 1.38]:
					hits.append(snappedf(_cast(TestMap.world_pos(x, 7.6, "coast"), TestMap.world_pos(x, 0.4, R)), 0.01))
				var veil := _su.find_child("Veil", true, false) as Node3D
				_check("gate_closed", not bool(_su.call("is_gate_open")) and veil.visible and hits.all(func(h: float) -> bool: return h > 0.4 and h < 0.52),
					"open=%s veil=%s hits=%s" % [_su.call("is_gate_open"), veil.visible, hits])
				_next()
		3: # ④ 5부 뒤 — 걸어서 고개를 넘어 돌다리로 궁궐 기단까지
			if _frame == 1:
				PartyState.story = {"ch": 20, "step": 0}
			if _frame < 70:
				return
			var pts := [TestMap.world_pos(1.0, 6.6, "coast"), TestMap.world_pos(1.0, 7.8, "coast"), TestMap.world_pos(1.0, 0.3, R),
				TestMap.world_pos(1.3, 1.4, R), TestMap.world_pos(2.0, 2.6, R), Sunken.at(Sunken.CAUSEWAY_FROM, 0), Sunken.at(Sunken.CAUSEWAY_TO, 0),
				Sunken.at(Sunken.PALACE_CELL + Vector2(0.15, -0.14), 0)] # 기단 북동 — 지붕 처마(뒤 6m) 밖
			var r := _walk(pts, 80.0)
			var veil := _su.find_child("Veil", true, false) as Node3D
			_check("gate_open_walk", bool(_su.call("is_gate_open")) and not veil.visible and r.worst <= 0.5 and r.blocked.is_empty() and r.n > 250,
				"open=%s samples=%d worst_step=%.2f blocked=%s" % [_su.call("is_gate_open"), r.n, r.worst, r.blocked.slice(0, 6)])
			_next()
		4: # ⑤ 기지 → 잔교 → 돔 받침 → 문 앞(22장 전엔 문이 막는다)
			var c := Sunken.dome_center()
			var base := Sunken.at(Sunken.BASE_CELL, 0)
			var ends := Sunken.pier_ends()
			var pts := [TestMap.world_pos(6.5, 2.6, R), base + Vector3(0, 0, -10.0), base + Vector3(0, 0, -5.0), base + Vector3(0.5, 0, 0.0), ends[0], ends[1]]
			var p1: Vector3 = ends[1]
			var a0 := atan2(p1.z - c.z, p1.x - c.x)
			var a1 := -PI * 0.5
			for k in range(1, 9):
				var a := lerp_angle(a0, a1, float(k) / 8.0)
				pts.append(c + Vector3(cos(a), 0, sin(a)) * 28.0)
			var r := _walk(pts, 80.0)
			var front := c + Vector3(0, 0, -28.0)
			var inside := c + Vector3(0, 0, -19.6)
			var door := _cast_at(front, inside, Sunken.DECK_Y)
			var dv := _su.find_child("DoorVeil", true, false) as Node3D
			_check("pier_walk", r.worst <= 0.5 and r.blocked.is_empty() and r.n > 150 and not bool(_su.call("is_dome_open")) and dv.visible and door < 0.9,
				"samples=%d worst_step=%.2f blocked=%s door=%.2f veil=%s" % [r.n, r.worst, r.blocked.slice(0, 6), door, dv.visible])
			_next()
		5: # ⑥ 22장 뒤 — 문 → 층계참 → 경사로 → 마른 바닥
			if _frame == 1:
				PartyState.story = {"ch": 22, "step": 0}
			if _frame < 70:
				return
			var c := Sunken.dome_center()
			var pts := [c + Vector3(0, 0, -28.0), c + Vector3(0, 0, -19.6), c + Vector3(0, 0, -17.2), c + Vector3(0, 0, Sunken.RAMP_END_Z + 0.5),
				c + Vector3(-8.0, 0, 6.0), c + Vector3(-8.0, 0, 0.0)]
			var r := _walk(pts, Sunken.DECK_Y + 2.0)
			var end_h: Variant = _ray_from(c + Vector3(-8.0, 0, 0.0), 0.0)
			var dv := _su.find_child("DoorVeil", true, false) as Node3D
			_check("dome_walk", bool(_su.call("is_dome_open")) and not dv.visible and r.worst <= 0.5 and r.blocked.is_empty() and r.n > 30 \
				and end_h != null and absf(float(end_h) + 10.0) < 0.05,
				"open=%s samples=%d worst_step=%.2f blocked=%s end=%s" % [_su.call("is_dome_open"), r.n, r.worst, r.blocked.slice(0, 6), end_h])
			_next()
		6: # ⑦ 순간이동 지점·지도 드러남
			var ids: Array = []
			var statues := 0
			for row in Waypoints.POINTS:
				if row[1] == R:
					ids.append(row[0])
					if row[3]:
						statues += 1
			var map := get_tree().get_first_node_in_group("go_world_map")
			EventState.resolved.erase("wp_u_statue")
			var hidden_before := not bool(map.call("revealed", R))
			get_tree().get_first_node_in_group("go_waypoints").call("activate", "u_statue")
			var shown := bool(map.call("revealed", R))
			_check("waypoints", ids.size() == 3 and statues == 1 and hidden_before and shown and WorldMap.REGION_STATUE.sunken == "u_statue", "ids=%s statues=%d hidden=%s shown=%s" % [ids, statues, hidden_before, shown])
			_next()
		7: # ⑧ 들판 무리
			var n := 0
			var bad: Array = []
			for e in get_tree().get_nodes_in_group("field_enemy"):
				var home: Vector3 = e.get("home")
				if TestMap.region_at(home) != R:
					continue
				n += 1
				var gy := TerrainBuilder.height_at(R, (e as Node3D).global_position)
				if (e as Node3D).global_position.y < gy - 0.6 or gy < TerrainBuilder.WATER_LEVEL:
					bad.append("%s y=%.1f ground=%.1f" % [e.name, (e as Node3D).global_position.y, gy])
			_check("camps", n == 8 and bad.is_empty(), "n=%d bad=%s" % [n, bad])
			_next()
		8: # ⑨ 상자·별조각·채집·지점이 도읍에, 명소 충돌에 안 묻힘(물 밑 아님 — 돔 안 상자만 −10)
			var spots: Array = []
			for row in TreasureSpawner.CHESTS:
				if row[1] == R:
					spots.append(["chest " + String(row[0]), _cell3(row[2])])
			for row in StarShards.in_region(R):
				spots.append(["shard " + String(row[0]), _cell3(row[2])])
			var g := 0
			for nd in Gathering.all_nodes():
				if nd[2] == R:
					g += 1
					spots.append(["gather " + String(nd[0]), nd[3]])
			for row in Waypoints.POINTS:
				if row[1] == R:
					spots.append(["wp " + String(row[0]), _cell3(row[2])])
			var buried: Array = []
			var sunk: Array = []
			for s in spots:
				var pos: Vector3 = s[1]
				var q := PhysicsShapeQueryParameters3D.new()
				var sph := SphereShape3D.new()
				sph.radius = 0.5
				q.shape = sph
				q.collision_mask = 1
				q.exclude = [_p.get_rid()]
				q.transform = Transform3D(Basis(), pos + Vector3(0, 1.2, 0))
				for hit in _p.get_world_3d().direct_space_state.intersect_shape(q, 4):
					var c: Object = hit.collider
					if c is Node and _su.is_ancestor_of(c as Node) and not String((c as Node).get_parent().name).begins_with("Sunken"):
						buried.append("%s in %s" % [s[0], (c as Node).get_parent().name])
				if not String(s[0]).begins_with("shard") and String(s[0]) != "chest u_dome" and pos.y < TerrainBuilder.WATER_LEVEL:
					sunk.append("%s %.1f" % [s[0], pos.y])
			var nc := spots.filter(func(s: Array) -> bool: return String(s[0]).begins_with("chest")).size()
			var ns := spots.filter(func(s: Array) -> bool: return String(s[0]).begins_with("shard")).size()
			_check("pickups", nc == 5 and ns == 3 and g == 9 and buried.is_empty() and sunk.is_empty(), "chests=%d shards=%d gather=%d buried=%s sunk=%s" % [nc, ns, g, buried, sunk])
			_next()
		9: # ⑩ 탐험도 칸 수
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
		10: # ⑪ 발견 지점 — 궁궐 기단 북쪽(뒷벽 뒤)에 선다
			if _frame == 1:
				var areas := 0
				for c in _su.get_children():
					if c is Area3D and String(c.name).begins_with("Discover_sunken_"):
						areas += 1
				_saved["areas"] = areas
				CodexState.book.erase("place:sunken_palace")
				_p.global_position = Sunken.at(Sunken.PALACE_CELL + Vector2(0.0, -0.12), Sunken.TERRACE_Y + 1.0)
			if _frame == 20:
				_check("discovery", int(_saved.areas) == 16 and CodexState.has("place", "sunken_palace") and int(CodexState.TOTAL.place) >= 108, "areas=%d palace=%s" % [_saved.areas, CodexState.has("place", "sunken_palace")])
				_next()
		11: # ⑫ 이름·지도 범위
			var map := get_tree().get_first_node_in_group("go_world_map")
			var b: Rect2 = map.get("bounds")
			var sr := Rect2(240.0, 192.0, 432.0, 432.0)
			_check("names", WorldMap.REGION_NAMES.get(R, "") == "잠긴 도읍" and b.encloses(sr.grow(-1.0)), "bounds=%s" % b)
			_next()
		12: # ⑬ 명소
			if _frame == 1:
				PartyState.story = {"ch": 22, "step": 0}
			if _frame < 70:
				return
			var bad: Array = []
			var terr: Variant = _ray_down(Sunken.at(Sunken.PALACE_CELL, 0) + Vector3(10.0, 0, 7.0))
			if terr == null or absf(float(terr) - Sunken.TERRACE_Y) > 0.05:
				bad.append("terrace %s" % terr)
			## 디딤 지붕 — 윗면이 물 위 0.3m 이상, 헤엄 넘어오르기(발 −1.7 + 2.45 = +0.75) 이하.
			for s in Sunken.STEPS:
				var top: Variant = _ray_down(Sunken.at(s[0], 0))
				if top == null or float(top) < TerrainBuilder.WATER_LEVEL + 0.3 or float(top) > 0.75:
					bad.append("step %s top=%s" % [s[0], top])
			var c := Sunken.dome_center()
			var ring: Variant = _ray_down(c + Vector3(0, 0, 28.0))
			if ring == null or absf(float(ring) - Sunken.DECK_Y) > 0.05 or Sunken.DECK_Y > 0.75:
				bad.append("ring %s" % ring)
			var lt := Sunken.light_top()
			var gal: Variant = _ray_down(lt + Vector3(Sunken.LIGHT_R + 0.5, 0, 0))
			if gal == null or absf(float(gal) - lt.y) > 0.1:
				bad.append("gallery %s want %.2f" % [gal, lt.y])
			## 헤엄 구간 — 궁궐 → 곁채 지붕 → 돔, 돔 → 석탑 → 등대 섬. 물 위에 발 디딜 곳 없는 가장 긴 줄.
			var chain := [Sunken.at(Sunken.PALACE_CELL, 0), Sunken.at(Sunken.STEPS[0][0], 0), c, Sunken.at(Sunken.STEPS[2][0], 0), Sunken.at(Sunken.LIGHT_CELL, 0)]
			var longest := 0.0
			var run := 0.0
			for i in range(chain.size() - 1):
				var from: Vector3 = chain[i]
				var to: Vector3 = chain[i + 1]
				var steps := int(from.distance_to(to))
				for k in steps:
					var sp := from.lerp(to, float(k) / steps)
					if _surface(sp) < TerrainBuilder.WATER_LEVEL:
						run += 1.0
						longest = maxf(longest, run)
					else:
						run = 0.0
			if longest > SWIM_RUN_MAX:
				bad.append("swim run %.0fm" % longest)
			if bool(_su.call("is_light_on")):
				bad.append("light on before ch23")
			_saved["swim"] = longest
			_check("landmarks", bad.is_empty(), "%s swim_max=%.0f" % [bad, longest])
			_next()
		13: # ⑭ 23장 뒤 등대 불
			if _frame == 1:
				PartyState.story = {"ch": 23, "step": 0}
			if _frame == 70:
				var beam := _su.find_child("Beam", true, false) as Node3D
				_check("light_on", bool(_su.call("is_light_on")) and beam.visible, "on=%s beam=%s" % [_su.call("is_light_on"), beam.visible])
				_next()
		14:
			PartyState.story = _saved.story
			EventState.resolved.assign(_saved.resolved)
			CodexState.book = _saved.book
			_p.global_position = _saved.pos
			print("SUNKEN_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

## pts 를 1m 마다 걸으며 바닥 턱(가장 큰 높이 차)과 막힘을 잰다. top 은 바닥을 재는 광선 시작 높이(돔 안은 유리 밑에서).
func _walk(pts: Array, top: float) -> Dictionary:
	var worst := 0.0
	var blocked: Array = []
	var n := 0
	for i in range(pts.size() - 1):
		var from: Vector3 = pts[i]
		var to: Vector3 = pts[i + 1]
		var steps := maxi(int(Vector2(to.x - from.x, to.z - from.z).length()), 1)
		var prev_h := _surface_from(from, top)
		for k in range(1, steps + 1):
			var p0 := from.lerp(to, float(k - 1) / steps)
			var p1 := from.lerp(to, float(k) / steps)
			var h1 := _surface_from(p1, top)
			worst = maxf(worst, absf(h1 - prev_h))
			if _cast_at(p0, p1, maxf(prev_h, h1)) < 1.0:
				blocked.append("%s" % TestMap.region_at(p1) + " (%.0f,%.0f)" % [p1.x, p1.z])
			prev_h = h1
			n += 1
	return {"worst": worst, "blocked": blocked, "n": n}

func _cell3(c: Vector2) -> Vector3:
	var p := TestMap.world_pos(c.x, c.y, R)
	p.y = TerrainBuilder.height_at(R, p)
	return p

func _in_water(p: Vector3) -> bool:
	var q := PhysicsPointQueryParameters3D.new()
	q.position = p
	q.collide_with_areas = true
	q.collide_with_bodies = false
	q.collision_mask = TerrainBuilder.WATER_LAYER
	return not _p.get_world_3d().direct_space_state.intersect_point(q, 1).is_empty()

## from → to 캡슐 한 번 밀기(발 높이 + 0.95) — 1.0 이면 안 막힘.
func _cast(from: Vector3, to: Vector3) -> float:
	var h := maxf(_surface(from), _surface(to))
	return _cast_at(from, to, h)

func _cast_at(p0: Vector3, p1: Vector3, foot: float) -> float:
	var excl: Array[RID] = [_p.get_rid()]
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if e is CollisionObject3D:
			excl.append((e as CollisionObject3D).get_rid())
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
	return _surface_from(p, 80.0)

func _surface_from(p: Vector3, top: float) -> float:
	var r: Variant = _ray_from(p, top)
	return float(r) if r != null else TerrainBuilder.height_at(TestMap.region_at(p), p)

func _ray_down(p: Vector3) -> Variant:
	return _ray_from(p, 80.0)

func _ray_from(p: Vector3, top: float) -> Variant:
	var q := PhysicsRayQueryParameters3D.create(Vector3(p.x, top, p.z), Vector3(p.x, -20.0, p.z), 1)
	q.exclude = [_p.get_rid()]
	var hit := _p.get_world_3d().direct_space_state.intersect_ray(q)
	return (hit.position as Vector3).y if not hit.is_empty() else null

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("SUNKEN_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
