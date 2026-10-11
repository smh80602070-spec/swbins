extends Node3D

## G-0184 — 1만리 "젤다 읽힘새"(웹 W-0162 의 고돗 짝): 야숨의 "저기 보이는 곳으로 간다".
## 열 지역 모두 멀리서 보이는 높은 실루엣(18m 이상)이 하나씩 서고, 그 꼭대기에 이름표가 뜬다 — 400m 밖이면 "이름 · 1.2km".
##   이미 높은 명소가 있는 지역(서리봉 성루 FortKeep 24m · 잠긴 도읍 다층탑 PalacePagoda)은 이름표만 그 위에.
##   나머지 여덟은 산 테두리(^) 칸 — 어차피 못 들어가는 자리 — 위에 코드 도형 실루엣 하나(거목·바위기둥·첨탑·망루). 한 메시(정점색) = 그리기 1, 충돌 없음.
##   높이 80~90m — 지역을 두른 절벽(보이는 높이 40m 넘음)보다 확실히 솟아야 이웃 지역에서 보인다(창 모드 촬영: 26m·44m 는 절벽에 가렸다).
## 이름표 거리는 0.5초마다 한 번 잰다(매 틱 셈 금지). 가까우면(40m 안) 숨긴다 — 그 자리에선 명소 자체가 보인다.
## 이름은 전부 가상(이름 정책). 새 에셋 없음.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")

const FAR_M := 400.0          # 이 밖이면 거리 글
const NEAR_HIDE_M := 40.0     # 이 안이면 이름표 숨김
const MAX_SHOW_M := 2000.0
const TICK_SEC := 0.5
const LABEL_LIFT := 2.5
const LABEL_AT := 0.55   # 새 실루엣 이름표 높이 = 높이 × 이 값

## region · name · (cell·kind·h·col[·roof]) 또는 (node·top) — cell 은 그 지역 격자 좌표(칸 가운데 = +0.5)
const READS := [
	{"region": "village", "name": "청하 거목", "cell": Vector2(2.5, 0.5), "kind": "tree", "h": 84.0, "col": Color(0.33, 0.5, 0.29)},
	{"region": "coast", "name": "갯바람 바위기둥", "cell": Vector2(2.5, 0.5), "kind": "spire", "h": 90.0, "col": Color(0.56, 0.53, 0.48)},
	{"region": "ruins", "name": "잿빛 첨탑", "cell": Vector2(1.5, 0.5), "kind": "spire", "h": 86.0, "col": Color(0.43, 0.41, 0.41)},
	{"region": "frost", "name": "옛 산성 성루", "node": "FortKeep", "top": 26.0},
	{"region": "skyport", "name": "은하 나루 등탑", "cell": Vector2(8.5, 1.5), "kind": "tower", "h": 80.0, "col": Color(0.72, 0.75, 0.82), "roof": Color(0.32, 0.48, 0.86)},
	{"region": "crossing", "name": "틈새 시계탑", "cell": Vector2(8.5, 8.5), "kind": "tower", "h": 84.0, "col": Color(0.62, 0.55, 0.48), "roof": Color(0.4, 0.3, 0.25)},
	{"region": "sunken", "name": "잠긴 궁궐 탑", "node": "PalacePagoda", "top": 32.0},
	{"region": "amber", "name": "굳은 거목", "cell": Vector2(8.5, 2.5), "kind": "tree", "h": 80.0, "col": Color(0.82, 0.6, 0.24)},
	{"region": "vault", "name": "갈무리 첨탑", "cell": Vector2(0.5, 1.5), "kind": "spire", "h": 90.0, "col": Color(0.5, 0.55, 0.63)},
	{"region": "fork", "name": "세갈래 망루", "cell": Vector2(2.5, 8.5), "kind": "tower", "h": 82.0, "col": Color(0.58, 0.5, 0.42), "roof": Color(0.56, 0.25, 0.2)},
]

var labels: Array = []      # [{label: Label3D, name: String, at: Vector3}]
var silhouettes: Array = [] # MeshInstance3D(새로 세운 것)
var _acc := 0.0


## 거리 글 — 순수 함수(점검 대상)
static func label_text(name: String, dist_m: float) -> String:
	if dist_m > FAR_M:
		return "%s · %.1fkm" % [name, dist_m / 1000.0]
	return name


static func base_of(entry: Dictionary) -> Vector3:
	var region := String(entry.region)
	var c: Vector2 = entry.cell
	var p := TestMap.world_pos(c.x, c.y, region)
	p.y = TerrainBuilder.height_at(region, p)
	return p


func _ready() -> void:
	name = "LandmarkReads"
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 1.0
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED   # 손으로 감은 면 — 양면(조명은 앞뒤 법선을 엔진이 뒤집는다)
	for e: Dictionary in READS:
		var top := Vector3.ZERO
		if e.has("node"):
			var host := get_parent().find_child(String(e.node), true, false) as Node3D
			if host == null:
				continue
			top = host.global_position + Vector3(0, float(e.top), 0)
		else:
			var base := base_of(e)
			var mi := MeshInstance3D.new()
			mi.name = "Read_%s" % e.region
			mi.mesh = build_mesh(String(e.kind), float(e.h), e.col, e.get("roof", e.col))
			mi.material_override = mat
			mi.position = base
			add_child(mi)
			silhouettes.append(mi)
			top = base + Vector3(0, float(e.h) * LABEL_AT, 0)   # 꼭대기(80~90m)면 가까이선 화면 밖 — 몸통 중간에
		var l := Label3D.new()
		l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		l.no_depth_test = true
		l.fixed_size = true
		l.pixel_size = 0.001
		l.font_size = 26
		l.outline_size = 9
		l.modulate = Color(1.0, 0.95, 0.82)
		l.text = String(e.name)
		l.position = top + Vector3(0, LABEL_LIFT + 5.0 * float(labels.size() % 3), 0)   # 같은 쪽 이름표가 한 줄에 겹치지 않게 엇갈림
		add_child(l)
		labels.append({"label": l, "name": String(e.name), "at": l.position})
	_update_labels()


func _process(delta: float) -> void:
	_acc += delta
	if _acc < TICK_SEC:
		return
	_acc = 0.0
	_update_labels()


func _update_labels() -> void:
	var p := get_tree().get_first_node_in_group("player") as Node3D
	if p == null:
		return
	for r: Dictionary in labels:
		var d := p.global_position.distance_to(r.at)
		var l: Label3D = r.label
		l.visible = d > NEAR_HIDE_M and d < MAX_SHOW_M
		if l.visible:
			l.text = label_text(String(r.name), d)


# ── 한 메시 실루엣(정점색) ─────────────────────────────

static func build_mesh(kind: String, h: float, col: Color, roof: Color) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	match kind:
		"tree":   # 거목 — 굵은 줄기 + 잎 원뿔 셋
			_box(st, Vector3(0, h * 0.2, 0), Vector3(h * 0.05, h * 0.4, h * 0.05), Color(0.36, 0.26, 0.17))
			_cone(st, Vector3(0, h * 0.3, 0), h * 0.22, h * 0.38, 10, col)
			_cone(st, Vector3(0, h * 0.52, 0), h * 0.16, h * 0.32, 10, col.lightened(0.08))
			_cone(st, Vector3(0, h * 0.74, 0), h * 0.1, h * 0.26, 10, col.lightened(0.16))
		"spire":  # 바위기둥·첨탑 — 좁아지는 세 토막 + 뾰족한 끝
			_box(st, Vector3(0, h * 0.22, 0), Vector3(h * 0.12, h * 0.44, h * 0.12), col.darkened(0.12))
			_box(st, Vector3(h * 0.008, h * 0.6, -h * 0.006), Vector3(h * 0.085, h * 0.32, h * 0.085), col)
			_box(st, Vector3(-h * 0.004, h * 0.84, h * 0.004), Vector3(h * 0.052, h * 0.16, h * 0.052), col.lightened(0.1))
			_cone(st, Vector3(-h * 0.004, h * 0.92, h * 0.004), h * 0.036, h * 0.08, 8, col.lightened(0.15))
		_:        # tower — 망루·등탑 — 기둥 + 처마 판 + 지붕 원뿔
			_box(st, Vector3(0, h * 0.4, 0), Vector3(h * 0.1, h * 0.8, h * 0.1), col)
			_box(st, Vector3(0, h * 0.8, 0), Vector3(h * 0.14, h * 0.012, h * 0.14), col.darkened(0.2))
			_cone(st, Vector3(0, h * 0.806, 0), h * 0.09, h * 0.194, 8, roof)
	st.generate_normals()
	return st.commit()


static func _quad(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color) -> void:
	st.set_color(col)
	st.add_vertex(a)
	st.add_vertex(b)
	st.add_vertex(c)
	st.add_vertex(a)
	st.add_vertex(c)
	st.add_vertex(d)


static func _box(st: SurfaceTool, center: Vector3, size: Vector3, col: Color) -> void:
	var h := size * 0.5
	var p := [center + Vector3(-h.x, -h.y, -h.z), center + Vector3(h.x, -h.y, -h.z), center + Vector3(h.x, -h.y, h.z), center + Vector3(-h.x, -h.y, h.z),
		center + Vector3(-h.x, h.y, -h.z), center + Vector3(h.x, h.y, -h.z), center + Vector3(h.x, h.y, h.z), center + Vector3(-h.x, h.y, h.z)]
	_quad(st, p[4], p[5], p[6], p[7], col.lightened(0.06))   # 위
	_quad(st, p[0], p[4], p[7], p[3], col.darkened(0.08))    # -x
	_quad(st, p[1], p[2], p[6], p[5], col.darkened(0.04))    # +x
	_quad(st, p[0], p[1], p[5], p[4], col.darkened(0.12))    # -z
	_quad(st, p[3], p[7], p[6], p[2], col)                   # +z


static func _cone(st: SurfaceTool, base: Vector3, r: float, h: float, segs: int, col: Color) -> void:
	var tip := base + Vector3(0, h, 0)
	for i in segs:
		var a0 := TAU * float(i) / float(segs)
		var a1 := TAU * float(i + 1) / float(segs)
		var p0 := base + Vector3(cos(a0) * r, 0, sin(a0) * r)
		var p1 := base + Vector3(cos(a1) * r, 0, sin(a1) * r)
		st.set_color(col.darkened(0.1 * (0.5 + 0.5 * sin(a0))))
		st.add_vertex(p0)
		st.add_vertex(tip)
		st.add_vertex(p1)
		st.set_color(col.darkened(0.25))
		st.add_vertex(p0)
		st.add_vertex(p1)
		st.add_vertex(base)
