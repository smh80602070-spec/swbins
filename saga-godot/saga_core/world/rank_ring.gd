extends RefCounted

## G-0288 발밑 금테(웹 W-0237 rankDeco 짝) — 단(승급·전직 등)이 지도 위 몸에 보이게. 그림 파일 없이 도형만.
##   1 가는 테 · 2 굵은 테 · 3 + 안쪽 금빛 원 · 4 + 바깥 테 · 5 + 별 여섯 · 6 + 별 열둘(고돗 1만리 승급 끝 6)
## 몸 루트(발이 원점)에 "RankRing" 자식 하나 — set(몸, 단) 이 단이 바뀔 때만 다시 짓는다. 0 이면 지움.
## 빛·그림자 안 받음(unshaded·cast off), 땅에 묻히지 않게 살짝 띄움.
## G-0289 tint — 테 빛깔(4종횡 전직 갈래 색), 별·안쪽 빛은 늘 금빛. 같은 단이라도 빛깔이 바뀌면 다시 짓는다.

const NAME := "RankRing"
const GOLD := Color(1.0, 0.82, 0.32, 0.9)
const GLOW := Color(1.0, 0.86, 0.45, 0.16)
const LIFT := 0.04
const R := 0.62   # 발밑 그림자 원(blob_shadow 0.55)보다 조금 바깥


## 몸에 단을 건다 — 같은 단이면 그대로(다시 안 지음). 돌려준 노드는 RankRing(0 이면 null).
static func set_rank(body: Node3D, rank: int, tint := GOLD) -> Node3D:
	if body == null:
		return null
	var old := body.get_node_or_null(NAME) as Node3D
	if old != null and int(old.get_meta("rank", -1)) == rank and old.get_meta("tint", GOLD) == tint:
		return old
	if old != null:
		body.remove_child(old)
		old.queue_free()
	if rank <= 0:
		return null
	var n := build(rank, tint)
	body.add_child(n)
	return n


## 단 하나의 도형 묶음(몸에 안 붙인 것 — 점검이 부른다).
static func build(rank: int, tint := GOLD) -> Node3D:
	var root := Node3D.new()
	root.name = NAME
	root.set_meta("rank", rank)
	root.set_meta("tint", tint)
	root.position.y = LIFT
	_ring(root, R, 0.025 if rank == 1 else 0.05, tint)
	if rank >= 3:
		_disc(root, R * 0.92, GLOW)
	if rank >= 4:
		_ring(root, R * 1.22, 0.03, tint)
	if rank >= 5:
		var n := 6 if rank == 5 else 12
		for i in n:
			var a := TAU * float(i) / float(n)
			var s := _star(0.09 if i % 2 == 0 else 0.07)
			s.position = Vector3(cos(a), 0.01, sin(a)) * R * 1.42
			root.add_child(s)
	return root


static func _mat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = c
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m


static func _mi(mesh: Mesh, c: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = _mat(c)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi


static func _ring(root: Node3D, radius: float, width: float, c: Color) -> void:
	var t := TorusMesh.new()
	t.inner_radius = radius - width * 0.5
	t.outer_radius = radius + width * 0.5
	t.rings = 48
	t.ring_segments = 4
	var mi := _mi(t, c)
	mi.scale = Vector3(1.0, 0.15, 1.0)   # 납작하게(땅에 그린 테처럼)
	root.add_child(mi)


static func _disc(root: Node3D, radius: float, c: Color) -> void:
	var cyl := CylinderMesh.new()
	cyl.top_radius = radius
	cyl.bottom_radius = radius
	cyl.height = 0.004
	cyl.radial_segments = 40
	root.add_child(_mi(cyl, c))


## 다섯 꼭지 별(평면, 위를 봄)
static func _star(size: float) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pts: Array[Vector3] = []
	for i in 10:
		var a := TAU * float(i) / 10.0 - PI * 0.5
		var r := size if i % 2 == 0 else size * 0.45
		pts.append(Vector3(cos(a) * r, 0.0, sin(a) * r))
	for i in 10:
		st.add_vertex(Vector3.ZERO)
		st.add_vertex(pts[i])
		st.add_vertex(pts[(i + 1) % 10])
	return _mi(st.commit(), GOLD)
