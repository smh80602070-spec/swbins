extends Node3D

## saga-godot 2026-09-28 "그래픽 먼저" — 마을 채우기. 마을 집 칸(H, 96×48m)에 집이 두 채뿐이라 원신 들판 마을처럼 보이지 않았다(창 모드 촬영).
## 가장자리에 오두막(house_builder.gd)을 더 세우고, 길가 등롱·장터 좌판·텃밭 울타리·상자·통을 놓는다.
##   · 자리는 아래 표(월드 m, 마을 원점 기준)로 고정 — 결정적. 광장 가운데와 남북 길(x = 0 ± ROAD_HALF)은 비운다.
##   · 짓기 직전(씬이 다 선 뒤) 그 자리 둘레 KEEP_M 안에 상호작용 물건(Area3D·인물 몸·신상·솥·게시판·상자)이나
##     이야기·세계 임무·채집·비경 입구 칸이 있으면 **그 자리는 건너뛴다**(tools/probe_village.gd 가 다시 확인).
##   · 오두막은 충돌 상자(벽), 좌판은 판대만 충돌. 소품(등롱·울타리·상자·통)은 전부 메시 하나로 합쳐 draw call 한 번, 충돌 없음.
##   · 밤(21~4시)이면 집 창·등롱 유리가 따뜻하게 빛난다(house_builder 공유 재질 night — night_visual.gd 가 켠다, 조명은 안 늘린다).

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const HouseBuilder := preload("res://games/saga_go/world/house_builder.gd")
const KeepSpots := preload("res://games/saga_go/world/keep_spots.gd")

const KEEP_M := 7.0
const ROAD_HALF := 7.0
## [x, z, 가로, 벽 높이, 세로, 앞이 볼 쪽(도)] — 앞(문) = +Z 를 이 각도만큼 돌린다(0 = 남, 90 = 동, 180 = 북, 270 = 서).
const HOUSES := [
	[-60.0, -2.0, 8.0, 3.5, 8.0, 90.0],
	[-60.0, 15.0, 9.0, 4.0, 7.0, 90.0],
	[-42.0, 17.0, 7.0, 3.0, 7.0, 180.0],
	[-30.0, 10.0, 9.0, 3.5, 8.0, 180.0],
	[15.0, 11.0, 8.0, 3.5, 8.0, 180.0],
	[17.0, -4.0, 8.0, 4.0, 9.0, 270.0],
	[-48.0, -38.0, 7.0, 3.0, 7.0, 0.0],
]
## 장터 좌판 [x, z, 돌림(도)].
const STALLS := [[-13.0, -8.0, 90.0], [-13.0, 4.0, 90.0], [11.0, -15.0, 270.0]]
## 텃밭 울타리 [x, z, 가로, 세로].
const GARDENS := [[-43.0, 2.0, 10.0, 7.0]]

var _keep: Array[Vector3] = []


func _ready() -> void:
	name = "VillageDressing"
	_build.call_deferred()


func _build() -> void:
	_collect_keep()
	var props = HouseBuilder.new()
	var built := 0
	for i in HOUSES.size():
		var h: Array = HOUSES[i]
		var p := _ground(Vector3(h[0], 0, h[1]))
		var fp := Vector3(h[2], h[3], h[4])
		if not _free(p, maxf(fp.x, fp.z) * 0.5 + 1.5):
			print_verbose("VillageDressing skip house %d near %s" % [i, _near(p)])
			continue
		var node := Node3D.new()
		node.name = "VHouse_%d" % i
		node.position = p
		node.rotation_degrees.y = h[5]
		add_child(node)
		node.add_child(HouseBuilder.build(fp, i + 1))
		_solid(node, fp, Vector3(0, fp.y * 0.5, 0))
		## 문 앞 상자·통 한 무더기(소품 메시).
		var door := node.transform * Vector3(fp.x * 0.3, 0, fp.z * 0.5 + 1.4)
		_crates(props, _ground(door), i)
		built += 1
	for i in STALLS.size():
		var s: Array = STALLS[i]
		var p := _ground(Vector3(s[0], 0, s[1]))
		if not _free(p, 3.5):
			continue
		var node := Node3D.new()
		node.name = "VStall_%d" % i
		node.position = p
		node.rotation_degrees.y = s[2]
		add_child(node)
		node.add_child(_stall(i))
		_solid(node, Vector3(3.2, 1.0, 1.2), Vector3(0, 0.5, 0.4))
	for g in GARDENS:
		var c := _ground(Vector3(g[0], 0, g[1]))
		if _free(c, maxf(g[2], g[3]) * 0.5 + 1.0):
			_fence(props, c, g[2], g[3])
	## 길가 등롱 — 남북 길 양쪽, 12m 마다.
	for z in range(-30, 31, 12):
		for side: float in [-1.0, 1.0]:
			var lp := _ground(Vector3(side * (ROAD_HALF - 1.0), 0, float(z)))
			if _free(lp, 1.5):
				_lantern(props, lp)
	var mi: MeshInstance3D = props.to_instance("VillageProps", 0.025)
	mi.position = Vector3.ZERO
	add_child(mi)
	print_verbose("VillageDressing houses=%d" % built)


## 비워 둘 자리 — 장면의 상호작용 물건 + 데이터 칸(마을).
func _collect_keep() -> void:
	var root := get_parent()
	for n in root.find_children("*", "Area3D", true, false) + root.find_children("*", "CharacterBody3D", true, false):
		_keep.append((n as Node3D).global_position)
	for n in root.find_children("*", "Node3D", true, false):
		var nm := String(n.name)
		for pre in ["Waypoint_", "Villager_", "StoryNpc_", "Chest", "Pot", "Kitchen", "Board", "Gather", "Shard"]:
			if nm.begins_with(pre):
				_keep.append((n as Node3D).global_position)
				break
	_keep.append_array(KeepSpots.of("village"))


func _free(p: Vector3, r: float) -> bool:
	for k in _keep:
		if Vector2(k.x - p.x, k.z - p.z).length() < r + KEEP_M:
			return false
	return true


## 가장 가까운 비워 둘 자리(건너뛴 까닭 기록용).
func _near(p: Vector3) -> String:
	var best := Vector3.INF
	for k in _keep:
		if best == Vector3.INF or Vector2(k.x - p.x, k.z - p.z).length() < Vector2(best.x - p.x, best.z - p.z).length():
			best = k
	return "(%.0f,%.0f)" % [best.x, best.z]


func _cell(c: Vector2) -> Vector3:
	return _ground(TestMap.world_pos(c.x, c.y, "village"))


## 표 값은 월드 m — 마을 원점이 (0,0,0) 이라 그대로 쓴다(test_map.gd REGIONS village).
func _ground(p: Vector3) -> Vector3:
	return Vector3(p.x, TerrainBuilder.height_at("village", p), p.z)


func _solid(parent: Node3D, size: Vector3, local_pos: Vector3) -> void:
	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	cs.position = local_pos
	body.add_child(cs)
	parent.add_child(body)


## 좌판 — 판대·네 기둥·줄무늬 차양·판 위 과일 상자. 메시 하나.
func _stall(variant: int) -> MeshInstance3D:
	var b = HouseBuilder.new()
	var wood := HouseBuilder.WOOD
	var cloth: Color = [Color(0.85, 0.35, 0.3), Color(0.3, 0.55, 0.8), Color(0.9, 0.7, 0.25)][variant % 3]
	b._box(Vector3(0, 0.5, 0.4), Vector3(3.2, 1.0, 1.2), wood.lightened(0.15))
	for sx in [-1.5, 1.5]:
		for sz in [-0.1, 0.9]:
			b._box(Vector3(sx, 1.3, sz), Vector3(0.14, 2.6, 0.14), wood)
	for k in 5:
		var c := cloth if k % 2 == 0 else Color(0.96, 0.94, 0.88)
		b._box(Vector3(-1.44 + 0.72 * float(k), 2.65, 0.45), Vector3(0.72, 0.1, 1.9), c, Basis(Vector3.RIGHT, deg_to_rad(-12)))
	for k in 3:
		var fruit: Color = [Color(0.9, 0.3, 0.25), Color(0.98, 0.75, 0.25), Color(0.5, 0.75, 0.3)][(k + variant) % 3]
		b._box(Vector3(-0.9 + 0.9 * float(k), 1.12, 0.45), Vector3(0.7, 0.25, 0.6), wood.lightened(0.3))
		b._box(Vector3(-0.9 + 0.9 * float(k), 1.3, 0.45), Vector3(0.55, 0.14, 0.45), fruit)
	return b.to_instance("Stall", 0.025)


func _crates(b, p: Vector3, seed: int) -> void:
	var wood := HouseBuilder.WOOD.lightened(0.25)
	b._box(p + Vector3(0, 0.35, 0), Vector3(0.7, 0.7, 0.7), wood, Basis(Vector3.UP, 0.3 * float(seed)))
	b._box(p + Vector3(0.75, 0.3, 0.2), Vector3(0.6, 0.6, 0.6), wood.darkened(0.1), Basis(Vector3.UP, -0.2))
	var barrel := CylinderMesh.new()
	barrel.top_radius = 0.34
	barrel.bottom_radius = 0.34
	barrel.height = 0.9
	barrel.radial_segments = 10
	barrel.rings = 0
	b.add_mesh(barrel, Transform3D(Basis(), p + Vector3(-0.6, 0.45, 0.35)), HouseBuilder.WOOD)


func _fence(b, c: Vector3, w: float, d: float) -> void:
	var wood := HouseBuilder.WOOD.lightened(0.2)
	var corners := [Vector3(-w, 0, -d) * 0.5, Vector3(w, 0, -d) * 0.5, Vector3(w, 0, d) * 0.5, Vector3(-w, 0, d) * 0.5]
	for i in 4:
		var a: Vector3 = c + corners[i]
		var e: Vector3 = c + corners[(i + 1) % 4]
		var n := int(ceil(a.distance_to(e) / 1.6))
		for k in n + 1:
			if i == 2 and k == n / 2:
				continue # 텃밭 문
			var q := a.lerp(e, float(k) / float(n))
			b._box(Vector3(q.x, c.y + 0.5, q.z), Vector3(0.14, 1.0, 0.14), wood)
		var mid := (a + e) * 0.5
		var along := (e - a).normalized()
		var basis := Basis(Vector3.UP, atan2(along.x, along.z))
		for y in [0.4, 0.8]:
			b._box(Vector3(mid.x, c.y + y, mid.z), Vector3(0.08, 0.1, a.distance_to(e)), wood, basis)
	## 밭고랑 — 흙 두둑 셋과 푸른 싹.
	for k in 3:
		var z := c.z - d * 0.3 + d * 0.3 * float(k)
		b._box(Vector3(c.x, c.y + 0.12, z), Vector3(w - 1.6, 0.24, 0.9), Color(0.45, 0.32, 0.22))
		for j in 5:
			b._box(Vector3(c.x - w * 0.35 + w * 0.175 * float(j), c.y + 0.35, z), Vector3(0.3, 0.3, 0.3), Color(0.35, 0.65, 0.3))


func _lantern(b, p: Vector3) -> void:
	var wood := HouseBuilder.WOOD
	b._box(p + Vector3(0, 1.3, 0), Vector3(0.16, 2.6, 0.16), wood)
	b._box(p + Vector3(0, 2.55, 0.3), Vector3(0.1, 0.1, 0.7), wood)
	b._box(p + Vector3(0, 2.2, 0.6), Vector3(0.36, 0.44, 0.36), Color(1.0, 0.82, 0.45), Basis(), true)
	b._box(p + Vector3(0, 2.46, 0.6), Vector3(0.46, 0.08, 0.46), wood.darkened(0.2))
