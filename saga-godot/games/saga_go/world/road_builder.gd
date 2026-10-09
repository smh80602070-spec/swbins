extends RefCounted

## G-0136 — 길(=) 칸의 흙길 띠. 예전엔 48m 칸 하나가 통째로 흙빛 정점색 + 풀 텍스처라 흐린 진흙 사각형이었다
## (정점 간격 6m 라 정점색으로는 좁은 길을 못 그린다). terrain_builder 가 길 칸 바닥을 들판빛으로 두고, 이 띠를 얹는다:
## 칸 가운데 → 이어진 이웃(LINK 글자·지도 밖 고개) 쪽 변 가운데까지, 지형 높이 + LIFT 에 폭 WIDTH(+ 양쪽 FRINGE 흐림).
## 굽이침은 월드 좌표 노이즈라 이웃 칸 띠와 변에서 딱 맞는다(가로 방향은 축 기준 — 양쪽 칸이 같은 쪽으로 민다).
## 메시·재질 하나(그리기 +1), 충돌 없음, 그림자 안 드리움. 서리봉처럼 "=" 표시(밟힌 눈)가 있는 지역은 짓지 않는다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const SHADER := preload("res://saga_core/shaders/road_dirt.gdshader")
const DIRT := preload("res://assets/generated/tiles/dirt_512.png")

const LINK := ["=", "B", "H", "C", "S", "R", "M", "D"]
const WIDTH := 4.5
const FRINGE := 1.3
const LIFT := 0.06
const STEP := 1.5
const WOBBLE := 1.1 # 굽이침 최대(m)
const CENTER_CALM := 7.0 # 칸 가운데서 이 거리까지는 굽이침을 줄인다(가운데 마당에서 갈래가 모이게)


## 이 지역에 길 띠를 짓는가 — "=" 칸이 있고 "=" 에 지역 표시(눈길 등)가 없을 때.
static func wants(region: String) -> bool:
	if (TerrainBuilder.REGION_SURFACES.get(region, {}) as Dictionary).has("="):
		return false
	for row in TestMap.rows_of(region):
		if String(row).contains("="):
			return true
	return false


static func build(parent: Node3D, region: String) -> MeshInstance3D:
	var rows: Array = TestMap.rows_of(region)
	var half := TestMap.tile_size_of(region) * 0.5
	var tint := TerrainBuilder.color_of(region, "=")
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var count := 0
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			if row[x] != "=":
				continue
			var c := TestMap.world_pos(x, y, region)
			for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
				var nx: int = x + d.x
				var ny: int = y + d.y
				var outside: bool = ny < 0 or ny >= rows.size() or nx < 0 or nx >= String(rows[ny]).length()
				if not outside and not LINK.has(String(rows[ny])[nx]):
					continue
				var dir := Vector3(d.x, 0.0, d.y)
				_strip(st, region, c, c + dir * half, dir, tint)
			_hub(st, region, c, tint)
			count += 1
	if count == 0:
		return null
	var m := ShaderMaterial.new()
	m.shader = SHADER
	m.set_shader_parameter("dirt_albedo", DIRT)
	var mi := MeshInstance3D.new()
	mi.name = "Roads"
	mi.mesh = st.commit()
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi


## G-0146 — p 가 길(=) 칸이면 그 칸 흙길 중심선(칸 가운데 → 이어진 변 가운데 선분들·가운데 마당)까지 수평 거리(m).
## 길 칸이 아니면 INF. 풀(grass_field)이 띠 둘레만 비우고 심을 때 쓴다(굽이침은 셈하지 않으니 부르는 쪽이 여유를 둔다).
static func dist_to_road(region: String, p: Vector3) -> float:
	var g := TestMap.grid_at(region, p)
	var rows: Array = TestMap.rows_of(region)
	if TestMap.tile_at(g.x, g.y, region) != "=":
		return INF
	var c := TestMap.world_pos(g.x, g.y, region)
	var half := TestMap.tile_size_of(region) * 0.5
	var q := Vector2(p.x, p.z)
	var best := Vector2(c.x, c.z).distance_to(q)
	for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
		var nx: int = g.x + d.x
		var ny: int = g.y + d.y
		var outside: bool = ny < 0 or ny >= rows.size() or nx < 0 or nx >= String(rows[ny]).length()
		if not outside and not LINK.has(String(rows[ny])[nx]):
			continue
		var a := Vector2(c.x, c.z)
		var b := a + Vector2(d.x, d.y) * half
		best = minf(best, Geometry2D.get_closest_point_to_segment(q, a, b).distance_to(q))
	return best


## 월드 좌표 노이즈 — 굽이침·폭 흔들림(같은 자리면 어느 칸에서 재도 같은 값).
static func _wob(p: Vector3) -> float:
	return sin(p.x * 0.071 + p.z * 0.049) * 0.6 + sin(p.x * 0.023 - p.z * 0.037 + 1.7) * 0.4


static func _vert(st: SurfaceTool, region: String, p: Vector3, col: Color, a: float) -> void:
	p.y = TerrainBuilder.height_at(region, p) + LIFT
	st.set_color(Color(col.r, col.g, col.b, a))
	st.set_normal(Vector3.UP)
	st.add_vertex(p)


## 칸 가운데 a → 변 가운데 b. 가로(side)는 축 기준이라 이웃 칸 띠와 같은 쪽으로 굽는다.
static func _strip(st: SurfaceTool, region: String, a: Vector3, b: Vector3, dir: Vector3, col: Color) -> void:
	var side := Vector3(absf(dir.z), 0.0, absf(dir.x))
	var length := a.distance_to(b)
	var n := int(ceil(length / STEP))
	var prev: Array = []
	for k in n + 1:
		var t := length * float(k) / float(n)
		var base := a + dir * t
		var w := _wob(base)
		var off := side * w * WOBBLE * smoothstep(0.0, CENTER_CALM, t)
		var hw := WIDTH * 0.5 + _wob(base * 1.9 + Vector3(13.0, 0.0, 7.0)) * 0.45
		var mid := base + off
		var cur := [mid - side * (hw + FRINGE), mid - side * hw, mid + side * hw, mid + side * (hw + FRINGE)]
		if not prev.is_empty():
			var alpha := [0.0, 1.0, 1.0, 0.0]
			for i in 3:
				_quad(st, region, prev[i], prev[i + 1], cur[i + 1], cur[i], [alpha[i], alpha[i + 1], alpha[i + 1], alpha[i]], col)
		prev = cur


## 칸 가운데 둥근 마당 — 갈래가 모이는 자리(굽이침 0).
static func _hub(st: SurfaceTool, region: String, c: Vector3, col: Color) -> void:
	var seg := 16
	var r := WIDTH * 0.5 + 0.4
	for i in seg:
		var a0 := TAU * float(i) / float(seg)
		var a1 := TAU * float(i + 1) / float(seg)
		var d0 := Vector3(cos(a0), 0.0, sin(a0))
		var d1 := Vector3(cos(a1), 0.0, sin(a1))
		_vert(st, region, c, col, 1.0)
		_vert(st, region, c + d0 * r, col, 1.0)
		_vert(st, region, c + d1 * r, col, 1.0)
		_quad(st, region, c + d0 * r, c + d0 * (r + FRINGE), c + d1 * (r + FRINGE), c + d1 * r, [1.0, 0.0, 0.0, 1.0], col)


static func _quad(st: SurfaceTool, region: String, p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, a: Array, col: Color) -> void:
	_vert(st, region, p0, col, a[0])
	_vert(st, region, p1, col, a[1])
	_vert(st, region, p2, col, a[2])
	_vert(st, region, p0, col, a[0])
	_vert(st, region, p2, col, a[2])
	_vert(st, region, p3, col, a[3])
