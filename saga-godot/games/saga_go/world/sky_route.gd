extends Node3D

## PLAN 106장 51-1 — 이야기 7부 "구름 위 항로"의 무대. 잠긴 도읍(REGIONS["sunken"]) 남쪽 바다 위 하늘에 뜬 섬 셋.
## 23장 등대에 불이 들어온 뒤(region7_sunken.gd light_on) 보이고 밟힌다 — 켜진 등대 빛줄기가 가리키는 하늘 항로.
## 섬은 서쪽으로 갈수록 높다. 섬과 섬은 바람 기둥(구름섬 world/sky_isle.gd·갈림길 끝 world/rift_end.gd 와 같은 틀)으로 오르고 활공으로 건넌다:
##   과거 — 하늘 사당(shrine, 윗면 60m): 기와 사당·바람 방울 장대. 첫 섬엔 별배로만 간다(24장), 24장 뒤엔 등대 섬에서 바람 기둥.
##   현대 — 기상 비행선 잔해(wreck, 82m): 찢어진 기낭·조종실·프로펠러. 사당 서쪽 가장자리 바람 기둥(24장 뒤)으로.
##   미래 — 궤도 정거장 조각(orbit, 104m): 합금 원판(육각 빛 줄)·태양 날개·안테나·구름 씨앗 장치 셋(26장에 하나씩 끈다). 잔해 서쪽 가장자리 바람 기둥(25장 뒤)으로.
## 바람 기둥은 섬 가장자리에서 3.5m 안 — 다음 섬 윗면 + DRAFT_OVER 까지 올려 주고, 다음 섬 가장자리까지는 활공 약 12m.
## 떨어지면 아래는 바다(헤엄)나 산. 섬 둘레엔 낮은 난간(1m, 충돌 — 나는 넘고 적은 못 넘는다).
## 이야기 단계·인물 칸의 isle = "<id>" 는 그 섬 윗면 높이(world/story_quest.gd _spot_pos). 세이브 없음(이야기 진행 PartyState.story 만 읽는다).

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Sunken := preload("res://games/saga_go/world/region7_sunken.gd")
const IsleRock := preload("res://games/saga_go/world/isle_rock.gd")

const REGION := "sunken"
## [id, 가운데 칸, 윗면 높이(월드 y), 반지름, 이름, 도감 place id]
const ISLES := [
	["shrine", Vector2(6.4063, 7.2542), 60.0, 18.0, "하늘 사당", "sky_shrine"],
	["wreck", Vector2(5.4688, 7.4209), 82.0, 20.0, "비행선 잔해", "sky_wreck"],
	["orbit", Vector2(4.573, 7.1709), 104.0, 16.0, "궤도 정거장 조각", "sky_orbit"],
]
## 등대 섬 바람 기둥 자리(K 바위섬 평평한 꼭대기 반지름 7.7m 안 — 등대에서 서남서 7m, 기둥이 탑에 안 닿게) — 하늘 사당 가장자리 밖 6m.
const LIGHT_DRAFT_CELL := Vector2(6.8646, 7.0542)
const RIM_H := 1.0
const DRAFT_R := 3.5
const DRAFT_IN := 3.5 # 섬 위 기둥 — 가장자리에서 이만큼 안
const DRAFT_OVER := 9.0
const DRAFT_VY := 9.0
## 바람 기둥이 서는 장(0부터) — 24장(23)을 마치면 등대·사당 기둥, 25장(24)을 마치면 잔해 기둥.
const CH25 := 24
const CH26 := 25
## 하늘 사당 먹구름 — 24장(23) 바람 방울을 다 울리기 전엔 사당 위에 내려앉아 있고 방울이 흐리다(SHRINE_CLEAR_STEP 단계부터 걷힘).
const CH24 := 23
const SHRINE_CLEAR_STEP := 6
## 구름 씨앗 장치 셋(방위 0·120·240 차례) — 26장(25) 원소로 끈 뒤 단계부터 꺼진다(북 5 · 남동 4 · 남서 6 — 남동 → 북 → 남서 차례로 끈다).
const SEEDER_DEGS := [0.0, 120.0, 240.0]
const SEEDER_OFF_FROM := [5, 4, 6]

const STONE := Color(0.56, 0.55, 0.53)
const STONE_DARK := Color(0.36, 0.36, 0.38)
const CLOUD := Color(0.93, 0.95, 0.98)
const PILLAR := Color(0.64, 0.2, 0.15)
const ROOF := Color(0.24, 0.27, 0.32)
const PLASTER := Color(0.86, 0.82, 0.72)
const BELL := Color(0.95, 0.8, 0.4)
const STEEL := Color(0.66, 0.68, 0.7)
const STEEL_DARK := Color(0.28, 0.3, 0.33)
const FABRIC := Color(0.88, 0.86, 0.78)
const HAZARD := Color(0.95, 0.55, 0.12)
const ALLOY := Color(0.82, 0.87, 0.92)
const PANEL := Color(0.16, 0.26, 0.5)
const GLOW := Color(0.5, 0.88, 1.0)
const GLOOM := Color(0.2, 0.18, 0.26)

var _bodies := {} # id → StaticBody3D
var _drafts: Array = [] # [Node3D, base Vector3, top y, open_ch]
var _floaters: Array = [] # [node, base_y, phase]
var _gloom: Node3D = null
var _bell_mat: StandardMaterial3D = null
var _clear := false
var _seeders: Array = [] # [먹구름 알 MeshInstance3D, 위 먹구름 Node3D]
var _player: Node3D = null
var _shown := true
var _t := 0.0

static func _row(id: String) -> Array:
	for r in ISLES:
		if String(r[0]) == id:
			return r
	return []

static func top_y(id: String) -> float:
	var r := _row(id)
	return float(r[2]) if not r.is_empty() else 0.0

static func radius(id: String) -> float:
	var r := _row(id)
	return float(r[3]) if not r.is_empty() else 0.0

static func center(id: String) -> Vector3:
	var r := _row(id)
	if r.is_empty():
		return Vector3.ZERO
	var p := TestMap.world_pos(r[1].x, r[1].y, REGION)
	p.y = float(r[2])
	return p

## 섬 가운데에서 방위 deg(북쪽 0·시계 방향)로 m m 떨어진 윗면 자리(월드).
static func at(id: String, deg: float, m: float) -> Vector3:
	var a := deg_to_rad(deg)
	return center(id) + Vector3(sin(a), 0.0, -cos(a)) * m

## 그 섬 윗면 위에 서 있는가(가로 반지름 안·윗면 근처).
static func on_isle(id: String, p: Vector3, slack := 1.5) -> bool:
	var c := center(id)
	return Vector2(p.x - c.x, p.z - c.z).length() <= radius(id) and p.y >= c.y - slack and p.y <= c.y + 8.0

## 하늘 항로가 보이는가 — 23장 등대에 불이 들어온 뒤.
static func route_shown() -> bool:
	return Sunken.light_on()

static func _ch() -> int:
	return int(PartyState.story.get("ch", 0))

## 바람 기둥 셋 — [이름, 밑동(월드), 윗면 섬 id, 서는 장(0부터)]. 등대 섬 → 사당 · 사당 → 잔해 · 잔해 → 정거장.
static func drafts() -> Array:
	var lp := TestMap.world_pos(LIGHT_DRAFT_CELL.x, LIGHT_DRAFT_CELL.y, REGION)
	lp.y = TerrainBuilder.height_at(REGION, lp)
	return [["light", lp, "shrine", CH25], ["shrine", _edge_toward("shrine", "wreck"), "wreck", CH25], ["wreck", _edge_toward("wreck", "orbit"), "orbit", CH26]]

## 섬 a 윗면에서 섬 b 쪽 가장자리 DRAFT_IN m 안.
static func _edge_toward(a: String, b: String) -> Vector3:
	var ca := center(a)
	var cb := center(b)
	var dir := Vector3(cb.x - ca.x, 0.0, cb.z - ca.z).normalized()
	return ca + dir * (radius(a) - DRAFT_IN)

## 24장 바람 방울을 다 울렸거나 지났는가 — 사당 위 먹구름이 걷혀 있다.
static func shrine_clear() -> bool:
	var ch := _ch()
	return ch > CH24 or (ch == CH24 and int(PartyState.story.get("step", 0)) >= SHRINE_CLEAR_STEP)

## 구름 씨앗 장치 k(SEEDER_DEGS 차례)가 꺼졌는가 — 26장에 원소로 끈 뒤·26장 뒤.
static func seeder_off(k: int) -> bool:
	var ch := _ch()
	return ch > CH26 or (ch == CH26 and int(PartyState.story.get("step", 0)) >= int(SEEDER_OFF_FROM[k]))

## 구름 씨앗 장치 k 자리(월드, 섬 윗면).
static func seeder_pos(k: int) -> Vector3:
	return at("orbit", float(SEEDER_DEGS[k]), 9.0)

static func draft_open(i: int) -> bool:
	return route_shown() and _ch() >= int(drafts()[i][3])

func _ready() -> void:
	add_to_group("go_sky_route")
	for r in ISLES:
		_build_isle(String(r[0]), float(r[3]), String(r[4]))
	_build_shrine()
	_build_wreck()
	_build_orbit()
	for i in drafts().size():
		_build_draft(i)
	for r in ISLES:
		_add_discovery(String(r[5]), center(String(r[0])), float(r[3]) + 4.0)
	_refresh()

func is_shown() -> bool:
	return _shown

func seeder_lit(k: int) -> bool:
	return k < _seeders.size() and (_seeders[k][1] as Node3D).visible

func gloom_visible() -> bool:
	return _gloom != null and _gloom.is_visible_in_tree()

func draft_active(i: int) -> bool:
	return i < _drafts.size() and (_drafts[i][0] as Node3D).visible

func _refresh() -> void:
	var s := route_shown()
	if s != _shown:
		_shown = s
		for id in _bodies:
			var b: StaticBody3D = _bodies[id]
			b.visible = s
			b.collision_layer = 1 if s else 0
	for i in _drafts.size():
		(_drafts[i][0] as Node3D).visible = draft_open(i)
	var c := shrine_clear()
	if c != _clear or _gloom.visible == c:
		_clear = c
		_gloom.visible = not c
		_bell_mat.emission_energy_multiplier = 1.4 if c else 0.15
	for k in _seeders.size():
		var on := not seeder_off(k)
		(_seeders[k][1] as Node3D).visible = on
		((_seeders[k][0] as MeshInstance3D).material_override as StandardMaterial3D).emission_energy_multiplier = 0.6 if on else 0.0

func _process(delta: float) -> void:
	_t += delta
	for f in _floaters:
		(f[0] as Node3D).position.y = float(f[1]) + sin(_t * 0.6 + float(f[2])) * 0.25

func _physics_process(_delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		return
	if Engine.get_physics_frames() % 30 == 0:
		_refresh()
	if not _player.has_method("updraft"):
		return
	var pp := _player.global_position
	for d in _drafts:
		if not (d[0] as Node3D).visible:
			continue
		var b: Vector3 = d[1]
		if Vector2(pp.x - b.x, pp.z - b.z).length() <= DRAFT_R and pp.y >= b.y - 1.0 and pp.y <= float(d[2]):
			_player.call("updraft", DRAFT_VY)
			return

# ---------------------------------------------------------------- 모양

func _mat(c: Color, rough := 0.9) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	return m

func _emit(c: Color, energy: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = energy
	return m

func _veil(c: Color, alpha: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(c.r, c.g, c.b, alpha)
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m

func _mesh(parent: Node3D, mesh: Mesh, mat: Material, pos: Vector3, shadow := true) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	if not shadow:
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi

func _box(parent: Node3D, size: Vector3, pos: Vector3, mat: Material, shadow := true) -> MeshInstance3D:
	var bm := BoxMesh.new()
	bm.size = size
	return _mesh(parent, bm, mat, pos, shadow)

## 충돌 상자(body 는 섬 StaticBody3D, parent 는 body 아래 돌려 놓은 묶음이어도 된다) + 보이는 상자.
func _solid(body: StaticBody3D, parent: Node3D, size: Vector3, pos: Vector3, mat: Material) -> void:
	_box(parent, size, pos, mat)
	var bs := BoxShape3D.new()
	bs.size = size
	var cs := CollisionShape3D.new()
	cs.shape = bs
	cs.transform = parent.transform * Transform3D(Basis(), pos) if parent != body else Transform3D(Basis(), pos)
	body.add_child(cs)

func _group(body: StaticBody3D, name: String, pos: Vector3, yaw_deg := 0.0) -> Node3D:
	var g := Node3D.new()
	g.name = name
	g.position = pos
	g.rotation.y = -deg_to_rad(yaw_deg)
	body.add_child(g)
	return g

func _label(parent: Node3D, text: String, pos: Vector3, col: Color) -> void:
	var l := Label3D.new()
	l.text = text
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.font_size = 48
	l.outline_size = 8
	l.pixel_size = 0.01
	l.modulate = col
	l.position = pos
	parent.add_child(l)

## 섬 바탕 — 윗면 원판(두께 1.4m — 충돌·난간이 둥글어 정거장도 둥글게, 육각은 빛 줄로만) · 밑은 거꾸로 선 바위 뿔(충돌 볼록) · 구름 띠 · 난간(충돌 상자 스무 조각).
func _build_isle(id: String, r: float, title: String) -> void:
	var body := StaticBody3D.new()
	body.name = "SkyIsle_" + id
	body.collision_layer = 1
	add_child(body)
	body.global_position = center(id)
	_bodies[id] = body
	var metal := id == "orbit"
	var top_col: Color = {"shrine": STONE, "wreck": Color(0.5, 0.48, 0.44), "orbit": ALLOY}[id]
	var top := CylinderMesh.new()
	top.top_radius = r
	top.bottom_radius = r - 1.2
	top.height = 1.4
	top.radial_segments = 32
	_mesh(body, top, _mat(top_col, 0.4 if metal else 0.9), Vector3(0.0, -0.7, 0.0))
	var ts := CylinderShape3D.new()
	ts.radius = r
	ts.height = 1.4
	var tcs := CollisionShape3D.new()
	tcs.shape = ts
	tcs.position = Vector3(0.0, -0.7, 0.0)
	body.add_child(tcs)
	var cone := CylinderMesh.new()
	cone.top_radius = r - 1.2
	cone.bottom_radius = 1.5
	cone.height = 14.0
	cone.radial_segments = 14
	cone.rings = 1
	if metal:
		_mesh(body, cone, _mat(STEEL_DARK), Vector3(0.0, -8.4, 0.0))
	else:
		IsleRock.add(body, cone, Color(0.42, 0.4, 0.42), Vector3(0.0, -8.4, 0.0), id.hash())   # G-0130 — 바위 밑동(층·뿌리)
	var ccs := CollisionShape3D.new()
	ccs.shape = cone.create_convex_shape()
	ccs.position = Vector3(0.0, -8.4, 0.0)
	body.add_child(ccs)
	## 섬 허리 구름 띠(보기만, 천천히 떠 돈다)
	var cl := TorusMesh.new()
	cl.inner_radius = r - 3.0
	cl.outer_radius = r + 2.5
	cl.rings = 24
	var cm := _mesh(body, cl, _veil(CLOUD, 0.35), Vector3(0.0, -4.0, 0.0), false)
	cm.scale = Vector3(1.0, 0.35, 1.0)
	_floaters.append([cm, -4.0, float(r)])
	## 난간
	var rail := _mat(STONE_DARK if id == "shrine" else STEEL_DARK)
	var post := BoxMesh.new()
	post.size = Vector3(0.4, RIM_H + 0.4, 0.4)
	var posts := 12
	for i in posts:
		var a := TAU * i / posts
		_mesh(body, post, rail, Vector3(cos(a), 0.0, sin(a)) * (r - 0.45) + Vector3.UP * (RIM_H + 0.4) * 0.5)
	var seg_n := 20
	var seg_len := TAU * (r - 0.45) / seg_n + 0.3
	for i in seg_n:
		var a := TAU * (i + 0.5) / seg_n
		var bs := BoxShape3D.new()
		bs.size = Vector3(seg_len, RIM_H, 0.4)
		var cs := CollisionShape3D.new()
		cs.shape = bs
		cs.position = Vector3(cos(a), 0.0, sin(a)) * (r - 0.45) + Vector3.UP * RIM_H * 0.5
		cs.rotation.y = -a + PI * 0.5
		body.add_child(cs)
		var bar := _box(body, Vector3(seg_len - 0.3, 0.14, 0.14), cs.position + Vector3.UP * RIM_H * 0.4, rail, false)
		bar.rotation.y = cs.rotation.y
	_label(body, title, Vector3(0.0, 13.0, 0.0), Color(0.92, 0.96, 1.0))

## 하늘 사당 — 북쪽 기와 사당(기단·붉은 기둥·뒷벽·맞배 지붕) · 둘레 바람 방울 장대 넷 · 가운데 반지름 8m 는 비운다(24장 방울 석등 자리).
func _build_shrine() -> void:
	var body: StaticBody3D = _bodies.shrine
	var hall := _group(body, "Shrine", Vector3(0.0, 0.0, -12.0))
	_solid(body, hall, Vector3(9.0, 0.4, 5.0), Vector3(0, 0.2, 0), _mat(STONE_DARK))
	for x in [-3.6, 3.6]:
		for z in [-1.8, 1.8]:
			_solid(body, hall, Vector3(0.45, 3.0, 0.45), Vector3(x, 1.9, z), _mat(PILLAR))
	_solid(body, hall, Vector3(7.6, 3.0, 0.3), Vector3(0, 1.9, -2.1), _mat(PLASTER))
	for s in [-1.0, 1.0]:
		var slab := _box(hall, Vector3(10.4, 0.3, 3.6), Vector3(0, 4.05, 1.4 * s), _mat(ROOF))
		slab.rotation.x = 0.42 * s
	_box(hall, Vector3(10.6, 0.35, 0.35), Vector3(0, 4.7, 0), _mat(ROOF.darkened(0.3)))
	_box(hall, Vector3(1.6, 0.9, 0.12), Vector3(0, 3.1, 2.0), _mat(Color(0.2, 0.28, 0.2))) # 편액
	## 바람 방울 장대 — 장대 끝 가로대에 방울 셋(흔들리는 빛 알 — 먹구름이 걷히기 전엔 흐리다).
	_bell_mat = _emit(BELL, 0.15)
	for deg in [45.0, 135.0, 225.0, 315.0]:
		var p := _group(body, "BellPole", Vector3(sin(deg_to_rad(deg)), 0.0, -cos(deg_to_rad(deg))) * 13.5, deg)
		_solid(body, p, Vector3(0.3, 5.0, 0.3), Vector3(0, 2.5, 0), _mat(Color(0.4, 0.28, 0.18)))
		_box(p, Vector3(2.2, 0.15, 0.15), Vector3(0, 4.8, 0), _mat(Color(0.4, 0.28, 0.18)), false)
		for k in 3:
			var bell := SphereMesh.new()
			bell.radius = 0.2
			bell.height = 0.4
			var bm := _mesh(p, bell, _bell_mat, Vector3(-0.8 + k * 0.8, 4.3, 0), false)
			_floaters.append([bm, 4.3, deg + k])
	## 사당 위 먹구름 — 검보랏빛 구름 덩이 아홉(보기만, 떠 돈다).
	_gloom = Node3D.new()
	_gloom.name = "Gloom"
	body.add_child(_gloom)
	var gm := _veil(GLOOM, 0.6)
	for k in 9:
		var a := TAU * k / 9.0
		var puff := SphereMesh.new()
		puff.radius = 3.5 + (k % 3) * 0.8
		puff.height = puff.radius * 1.2
		var pm := _mesh(_gloom, puff, gm, Vector3(cos(a) * (6.0 + (k % 2) * 4.0), 8.0 + (k % 3) * 1.2, sin(a) * (6.0 + (k % 2) * 4.0)), false)
		_floaters.append([pm, pm.position.y, float(k)])

## 비행선 잔해 — 기울어 처박힌 조종실(충돌) · 찢어진 기낭(보기만, 가장자리 밖으로 늘어짐) · 꼬리 날개 · 프로펠러 · 기상 관측 장비.
func _build_wreck() -> void:
	var body: StaticBody3D = _bodies.wreck
	var gon := _group(body, "Gondola", Vector3(-5.0, 0.0, 7.0), 20.0)
	_solid(body, gon, Vector3(9.0, 2.8, 3.4), Vector3(0, 1.4, 0), _mat(STEEL))
	_box(gon, Vector3(9.05, 0.3, 3.45), Vector3(0, 0.6, 0), _mat(HAZARD), false)
	for k in 4:
		_box(gon, Vector3(1.2, 0.9, 0.06), Vector3(-3.0 + k * 2.0, 1.9, 1.72), _emit(Color(0.55, 0.75, 0.9), 0.3), false)
	var env := CapsuleMesh.new()
	env.radius = 5.0
	env.height = 24.0
	var em := _mesh(body, env, _mat(FABRIC, 0.7), Vector3(4.0, 5.5, -6.0))
	em.rotation = Vector3(0.0, deg_to_rad(30.0), deg_to_rad(80.0))
	for k in 5: # 찢어진 천 조각 — 바람에 떠 돈다
		var rag := _box(body, Vector3(2.4, 0.05, 1.4), Vector3(-6.0 + k * 3.5, 3.0 + (k % 2) * 1.5, -12.0 + k * 1.2), _veil(FABRIC, 0.85), false)
		rag.rotation = Vector3(0.4 * k, 0.8 * k, 0.3)
		_floaters.append([rag, rag.position.y, float(k)])
	var tail := _group(body, "Tail", Vector3(12.0, 0.0, -2.0), 110.0)
	_solid(body, tail, Vector3(0.3, 4.0, 3.0), Vector3(0, 2.0, 0), _mat(STEEL_DARK))
	_box(tail, Vector3(0.32, 0.8, 3.02), Vector3(0, 3.2, 0), _mat(HAZARD), false)
	for s in [-1.0, 1.0]: # 프로펠러 둘
		var pr := _group(body, "Prop", Vector3(-10.0, 0.0, -4.0 + 8.0 * s))
		_solid(body, pr, Vector3(0.5, 2.6, 0.5), Vector3(0, 1.3, 0), _mat(STEEL_DARK))
		var hub := _group(body, "Blades", pr.position + Vector3(0, 2.8, 0))
		for k in 3:
			var ang := TAU * k / 3.0
			var bl := _box(hub, Vector3(0.08, 2.4, 0.3), Vector3(0, cos(ang) * 1.1, sin(ang) * 1.1), _mat(Color(0.3, 0.26, 0.22)), false)
			bl.rotation.x = ang
	## 기상 관측 장비(풍향계·안테나)
	var mast := _group(body, "WeatherMast", Vector3(6.0, 0.0, 9.0))
	_solid(body, mast, Vector3(0.25, 6.0, 0.25), Vector3(0, 3.0, 0), _mat(STEEL))
	_box(mast, Vector3(1.6, 0.1, 0.1), Vector3(0, 5.6, 0), _mat(STEEL), false)
	var cup := SphereMesh.new()
	cup.radius = 0.25
	cup.height = 0.5
	for x in [-0.8, 0.8]:
		_mesh(mast, cup, _mat(HAZARD), Vector3(x, 5.6, 0), false)

## 궤도 정거장 조각 — 합금 원판(육각 빛 줄) · 양쪽 태양 날개(보기만, 가장자리 밖) · 안테나 · 구름 씨앗 장치 셋(반지름 9m, 26장 원소로 끈다 — 먹구름 알).
func _build_orbit() -> void:
	var body: StaticBody3D = _bodies.orbit
	for i in 6: # 윗면 빛 줄
		var a := TAU * i / 6.0
		var ln := _box(body, Vector3(0.12, 0.03, 12.0), Vector3(cos(a), 0.0, sin(a)) * 6.5 + Vector3.UP * 0.02, _emit(GLOW, 1.2), false)
		ln.rotation.y = -a
	for s in [-1.0, 1.0]:
		var wing := _group(body, "SolarWing", Vector3(s * 23.5, -0.3, 0.0))
		_box(wing, Vector3(14.0, 0.15, 6.0), Vector3.ZERO, _mat(PANEL, 0.3), false)
		for k in 4:
			_box(wing, Vector3(0.08, 0.17, 6.0), Vector3(-5.25 + k * 3.5, 0.0, 0.0), _mat(ALLOY), false)
		_box(body, Vector3(6.0, 0.3, 0.4), Vector3(s * 16.0, -0.3, 0.0), _mat(ALLOY), false)
	var ant := _group(body, "Antenna", Vector3(0.0, 0.0, 0.0))
	_solid(body, ant, Vector3(0.6, 9.0, 0.6), Vector3(0, 4.5, 0), _mat(ALLOY, 0.3))
	var dish := CylinderMesh.new()
	dish.top_radius = 2.2
	dish.bottom_radius = 0.3
	dish.height = 0.8
	var dm := _mesh(ant, dish, _mat(ALLOY, 0.3), Vector3(0, 9.3, 0))
	dm.rotation.x = 0.5
	var ring := TorusMesh.new()
	ring.inner_radius = 1.2
	ring.outer_radius = 1.35
	var rm := _mesh(ant, ring, _emit(GLOW, 2.0), Vector3(0, 11.0, 0), false)
	_floaters.append([rm, 11.0, 0.0])
	for deg in SEEDER_DEGS:
		var sd := _group(body, "Seeder", Vector3(sin(deg_to_rad(deg)), 0.0, -cos(deg_to_rad(deg))) * 9.0, deg)
		_solid(body, sd, Vector3(1.4, 0.4, 1.4), Vector3(0, 0.2, 0), _mat(STEEL_DARK, 0.4))
		_solid(body, sd, Vector3(0.7, 2.6, 0.7), Vector3(0, 1.7, 0), _mat(ALLOY, 0.3))
		var orb := SphereMesh.new()
		orb.radius = 0.9
		orb.height = 1.8
		var om := _mesh(sd, orb, _emit(GLOOM, 0.6), Vector3(0, 3.8, 0), false)
		_floaters.append([om, 3.8, deg])
		## 알 위로 피어오르는 먹구름 셋(켜져 있을 때만)
		var puff := Node3D.new()
		puff.name = "SeedCloud"
		sd.add_child(puff)
		for k in 3:
			var pm := SphereMesh.new()
			pm.radius = 1.0 + k * 0.4
			pm.height = pm.radius * 1.3
			var pmi := _mesh(puff, pm, _veil(GLOOM, 0.55), Vector3((k - 1) * 0.8, 5.4 + k * 1.1, 0.0), false)
			_floaters.append([pmi, pmi.position.y, deg + k])
		_seeders.append([om, puff])

func _build_draft(i: int) -> void:
	var d: Array = drafts()[i]
	var base: Vector3 = d[1]
	var top := top_y(String(d[2])) + DRAFT_OVER
	var n := Node3D.new()
	n.name = "Updraft_" + String(d[0])
	add_child(n)
	n.global_position = base
	var h := top - base.y
	var col := CylinderMesh.new()
	col.top_radius = DRAFT_R
	col.bottom_radius = DRAFT_R
	col.height = h
	col.radial_segments = 20
	col.rings = 1
	col.cap_top = false
	col.cap_bottom = false
	_mesh(n, col, _veil(Color(0.8, 0.92, 1.0), 0.1), Vector3.UP * h * 0.5, false)
	var ring := TorusMesh.new()
	ring.inner_radius = DRAFT_R - 0.35
	ring.outer_radius = DRAFT_R
	var rmat := _veil(Color(0.86, 0.95, 1.0), 0.45)
	for k in 4:
		var mi := _mesh(n, ring, rmat, Vector3.UP * (h * k / 4.0), false)
		mi.scale = Vector3(1.0, 0.2, 1.0)
		var tw := mi.create_tween().set_loops()
		var from := h * k / 4.0
		tw.tween_property(mi, "position:y", h, (h - from) / 12.0)
		tw.tween_property(mi, "position:y", 0.0, 0.0)
		tw.tween_property(mi, "position:y", from, maxf(from / 12.0, 0.05))
	_drafts.append([n, base, top, int(d[3])])

## 도감 place — 섬 윗면 둘레에 들어서면(codex_state.gd TOTAL 에 더함). 항로가 안 보일 땐 안 걸린다(섬에 설 수 없으니).
func _add_discovery(id: String, pos: Vector3, r: float) -> void:
	var area := Area3D.new()
	area.name = "Discover_" + id
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = r
	cs.shape = shape
	area.add_child(cs)
	area.add_to_group("codex_discoverable")
	add_child(area)
	area.global_position = pos
	area.body_entered.connect(func(body: Node3D) -> void:
		if body.is_in_group("player") and _shown:
			CodexState.discover("place", id))
