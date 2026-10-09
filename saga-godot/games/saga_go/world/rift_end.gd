extends Node3D

## PLAN 106장 ㊾-3 — 이야기 20장 "갈림길 끝". 틈새 갈림길(REGIONS["crossing"]) 첫 정거장 동남쪽 하늘에 뜬 섬 — 틈이 처음 찢어진 곳.
##   첫 정거장 차막이 너머 선로가 틈에 들려 하늘로 끊겨 이어지고(떠 있는 선로 조각 — 보기만), 섬 위에서 세 갈래로 갈린다:
##   옛 나무 선로(과거, 북동) · 쇠 선로(현대, 북서 — 막차가 들어오는 갈래, 끝에 차막이) · 빛 선로(미래, 남).
##   갈래 끝마다 시대 닻(석등·신호기·빛 기둥), 한가운데 위로 세로로 찢어진 틈.
##   섬은 늘 떠 있다(갈림길에서 올려다보이는 표지). 틈은 20장 매듭을 다 밝히면(SEAL_DONE_STEP) 오므라들고, 20장이 끝나면 닫혀 고요한 별빛만 남는다.
##   바람 기둥(구름섬 world/sky_isle.gd 와 같은 틀)은 20장이 풀린 뒤부터 — 섬에서 떨어져도 다시 오른다. 섬 둘레엔 낮은 난간(1m, 충돌).
## 자리: 기둥 칸 DRAFT_CELL 땅 높이 + RISE 가 섬 윗면. 이야기 단계·인물 칸의 rift_end = true 는 그 높이(world/story_quest.gd _spot_pos).
## 세이브 없음(보이는 것만 이야기 진행 PartyState.story 를 읽는다).

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")
const Story := preload("res://games/saga_go/data/story.gd")
const IsleRock := preload("res://games/saga_go/world/isle_rock.gd")

const REGION := "crossing"
const CELL := Vector2(6.3, 2.6) # 섬 가운데
const DRAFT_CELL := Vector2(6.3, 3.1) # 바람 기둥(섬 남쪽 가장자리 밖 24m)
const RISE := 46.0
const RADIUS := 20.0
const RIM_H := 1.0 # 나는 넘고(턱 넘기 1.3m) 적은 못 넘는다
const DRAFT_R := 3.5
const DRAFT_OVER := 9.0
const DRAFT_VY := 9.0
const CH20 := 19 # 20장(0부터)
const TRAIN_STEP := 2 # 막차가 닿은 뒤
const SEAL_DONE_STEP := 6 # 매듭 셋을 다 밝힌 뒤 — 닻이 켜지고 틈이 오므라든다
## 세 갈래 — [이름, 방위(도, 북쪽 0·시계 방향), 시대]
const BRANCHES := [["옛 나무 선로", 60.0, "past"], ["쇠 선로", 300.0, "now"], ["빛 선로", 180.0, "future"]]
const ANCHOR_R := 17.2

const STONE := Color(0.5, 0.49, 0.5)
const STONE_DARK := Color(0.34, 0.33, 0.36)
const ALLOY := Color(0.74, 0.77, 0.83)
const ALLOY_DARK := Color(0.26, 0.29, 0.36)
const WOOD := Color(0.4, 0.25, 0.15)
const RUST := Color(0.5, 0.3, 0.2)
const GLOW := Color(0.55, 0.85, 1.0)
const RIFT := Color(0.72, 0.5, 1.0)
const LAMP := Color(1.0, 0.78, 0.4)
const STAR := Color(1.0, 0.94, 0.72)

var _body: StaticBody3D = null
var _draft: Node3D = null
var _tear: Node3D = null
var _calm: Node3D = null
var _lit: Array = [] # 닻의 켜진 빛(매듭을 다 밝힌 뒤 보임)
var _floaters: Array = [] # [node, base_y, phase]
var _player: Node3D = null
var _t := 0.0

static func top_y() -> float:
	return TerrainBuilder.height_at(REGION, TestMap.world_pos(DRAFT_CELL.x, DRAFT_CELL.y, REGION)) + RISE

static func center() -> Vector3:
	var p := TestMap.world_pos(CELL.x, CELL.y, REGION)
	p.y = top_y()
	return p

static func draft_base() -> Vector3:
	var p := TestMap.world_pos(DRAFT_CELL.x, DRAFT_CELL.y, REGION)
	p.y = TerrainBuilder.height_at(REGION, p)
	return p

## 섬 가운데에서 방위 deg(북쪽 0·시계 방향)로 r m 떨어진 윗면 자리(월드).
static func at(deg: float, r: float) -> Vector3:
	var a := deg_to_rad(deg)
	return center() + Vector3(sin(a), 0.0, -cos(a)) * r

## 섬 윗면 위에 서 있는가(가로 반지름 안·윗면 근처).
static func on_isle(p: Vector3, slack := 1.5) -> bool:
	var c := center()
	return Vector2(p.x - c.x, p.z - c.z).length() <= RADIUS and p.y >= c.y - slack and p.y <= c.y + 8.0

## 20장이 풀렸거나 지났는가 — 바람 기둥이 선다.
static func draft_open() -> bool:
	var ch := int(PartyState.story.get("ch", 0))
	if ch > CH20:
		return true
	var c := Story.chapter(CH20)
	return ch == CH20 and not c.is_empty() and Adventure.ar() >= int(c.ar)

## 틈 — 0 찢어져 있음 · 1 오므라듦(20장 매듭을 다 밝힘) · 2 닫힘(20장 끝).
static func tear_state() -> int:
	var ch := int(PartyState.story.get("ch", 0))
	if ch > CH20:
		return 2
	if ch == CH20 and int(PartyState.story.get("step", 0)) >= SEAL_DONE_STEP:
		return 1
	return 0

func _ready() -> void:
	add_to_group("go_rift_end")
	_build_isle()
	_build_branches()
	_build_tear()
	_build_hanging_rails()
	_build_draft()
	_add_discovery()
	_refresh()

func draft_active() -> bool:
	return _draft != null and _draft.visible

func tear_visible() -> bool:
	return _tear != null and _tear.visible

func tear_scale() -> float:
	return _tear.scale.x if _tear else 0.0

func anchors_lit() -> bool:
	return not _lit.is_empty() and (_lit[0] as Node3D).visible

func _refresh() -> void:
	var ts := tear_state()
	if _draft:
		_draft.visible = draft_open()
	_tear.visible = ts < 2
	_tear.scale = Vector3.ONE * (0.5 if ts == 1 else 1.0)
	_calm.visible = ts == 2
	for n in _lit:
		(n as Node3D).visible = ts >= 1

func _process(delta: float) -> void:
	_t += delta
	for f in _floaters:
		(f[0] as Node3D).position.y = float(f[1]) + sin(_t * 0.5 + float(f[2])) * 0.3
	if _tear.visible:
		_tear.rotation.y += delta * 0.15

func _physics_process(_delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		return
	_refresh()
	if not draft_active() or not _player.has_method("updraft"):
		return
	var b := draft_base()
	var pp := _player.global_position
	if Vector2(pp.x - b.x, pp.z - b.z).length() <= DRAFT_R and pp.y >= b.y - 1.0 and pp.y <= top_y() + DRAFT_OVER:
		_player.call("updraft", DRAFT_VY)

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

## 충돌 상자(body 는 섬 StaticBody3D) + 보이는 상자.
func _solid(body: StaticBody3D, parent: Node3D, size: Vector3, pos: Vector3, mat: Material) -> void:
	_box(parent, size, pos, mat)
	var bs := BoxShape3D.new()
	bs.size = size
	var cs := CollisionShape3D.new()
	cs.shape = bs
	cs.transform = parent.transform * Transform3D(Basis(), pos) if parent != body else Transform3D(Basis(), pos)
	body.add_child(cs)

func _build_isle() -> void:
	_body = StaticBody3D.new()
	_body.name = "RiftEnd"
	_body.collision_layer = 1
	add_child(_body)
	_body.global_position = center()
	## 윗면 — 옛 돌과 앞날의 쇠가 반씩 뒤엉킨 원판(두께 1.4m), 밑은 거꾸로 선 바위 뿔(충돌 볼록).
	var top := CylinderMesh.new()
	top.top_radius = RADIUS
	top.bottom_radius = RADIUS - 1.2
	top.height = 1.4
	top.radial_segments = 32
	_mesh(_body, top, _mat(STONE), Vector3(0.0, -0.7, 0.0))
	var ts := CylinderShape3D.new()
	ts.radius = RADIUS
	ts.height = 1.4
	var tcs := CollisionShape3D.new()
	tcs.shape = ts
	tcs.position = Vector3(0.0, -0.7, 0.0)
	_body.add_child(tcs)
	## 윗면 무늬 — 쇠 판 여섯(보기만, 윗면에 0.02m 얹음).
	for i in 6:
		var a := TAU * i / 6.0 + 0.3
		var plate := _box(_body, Vector3(5.0, 0.04, 3.2), Vector3(cos(a), 0.0, sin(a)) * (8.5 + 3.0 * (i % 2)) + Vector3.UP * 0.02, _mat(ALLOY_DARK, 0.5), false)
		plate.rotation.y = -a
	var cone := CylinderMesh.new()
	cone.top_radius = RADIUS - 1.2
	cone.bottom_radius = 2.0
	cone.height = 16.0
	cone.radial_segments = 14
	cone.rings = 1
	IsleRock.add(_body, cone, Color(0.4, 0.37, 0.42), Vector3(0.0, -9.4, 0.0), 63)   # G-0130 — 바위 밑동(층·뿌리)
	var ccs := CollisionShape3D.new()
	ccs.shape = cone.create_convex_shape()
	ccs.position = Vector3(0.0, -9.4, 0.0)
	_body.add_child(ccs)
	## 뿔 밑 틈 수정 셋(보랏빛 — 틈이 처음 찢어진 흔적)
	for k in 3:
		var cr := CylinderMesh.new()
		cr.top_radius = 0.0
		cr.bottom_radius = 1.0 - k * 0.2
		cr.height = 4.0 - k * 0.8
		cr.radial_segments = 6
		var mi := _mesh(_body, cr, _emit(RIFT, 1.6), Vector3((k - 1) * 1.6, -18.0 + k * 0.6, (k % 2) * 1.2), false)
		mi.rotation = Vector3(PI, 0.0, (k - 1) * 0.3)
	## 난간 — 보이는 돌 고리 + 기둥 열둘, 충돌은 상자 스무 조각.
	var stone := _mat(STONE_DARK)
	var rim := TorusMesh.new()
	rim.inner_radius = RADIUS - 0.7
	rim.outer_radius = RADIUS - 0.2
	rim.rings = 40
	var rmi := _mesh(_body, rim, stone, Vector3(0.0, RIM_H * 0.55, 0.0))
	rmi.scale = Vector3(1.0, 1.6, 1.0)
	var post := BoxMesh.new()
	post.size = Vector3(0.5, RIM_H + 0.5, 0.5)
	for i in 12:
		var a := TAU * i / 12.0
		_mesh(_body, post, stone, Vector3(cos(a), 0.0, sin(a)) * (RADIUS - 0.45) + Vector3.UP * (RIM_H + 0.5) * 0.5)
	var seg_n := 20
	var seg_len := TAU * (RADIUS - 0.45) / seg_n + 0.3
	for i in seg_n:
		var a := TAU * (i + 0.5) / seg_n
		var bs := BoxShape3D.new()
		bs.size = Vector3(seg_len, RIM_H, 0.4)
		var cs := CollisionShape3D.new()
		cs.shape = bs
		cs.position = Vector3(cos(a), 0.0, sin(a)) * (RADIUS - 0.45) + Vector3.UP * RIM_H * 0.5
		cs.rotation.y = -a + PI * 0.5
		_body.add_child(cs)
	var l := Label3D.new()
	l.text = "갈림길 끝"
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.font_size = 48
	l.outline_size = 8
	l.pixel_size = 0.01
	l.modulate = Color(0.9, 0.84, 1.0)
	l.position = Vector3(0.0, 22.0, 0.0)
	_body.add_child(l)

## 섬 가운데 기준 방위 deg 로 r m 인 로컬 자리.
static func _local(deg: float, r: float) -> Vector3:
	var a := deg_to_rad(deg)
	return Vector3(sin(a), 0.0, -cos(a)) * r

## 세 갈래 선로(보기만 — 윗면에 얇게, 걷는 데 안 걸린다) + 갈래 끝 시대 닻(충돌).
func _build_branches() -> void:
	for b in BRANCHES:
		var deg := float(b[1])
		var era := String(b[2])
		var g := Node3D.new()
		g.name = "Branch_" + era
		g.rotation.y = -deg_to_rad(deg) # 로컬 -z 가 그 방위
		_body.add_child(g)
		var run := RADIUS - 3.0
		var mid := -(2.5 + run) * 0.5
		var span := run - 2.5
		match era:
			"past": # 옛 나무 선로 — 굵은 나무 침목·나무 레일
				for dx in [-0.75, 0.75]:
					_box(g, Vector3(0.16, 0.12, span), Vector3(dx, 0.08, mid), _mat(WOOD.darkened(0.15)), false)
				for k in int(span / 1.6):
					_box(g, Vector3(2.3, 0.07, 0.45), Vector3(0.0, 0.035, -2.5 - 0.8 - k * 1.6), _mat(WOOD), false)
			"now": # 쇠 선로 — 녹슨 레일·검은 침목, 끝에 차막이
				for dx in [-0.75, 0.75]:
					_box(g, Vector3(0.12, 0.12, span), Vector3(dx, 0.08, mid), _mat(RUST, 0.6), false)
				for k in int(span / 1.9):
					_box(g, Vector3(2.4, 0.06, 0.35), Vector3(0.0, 0.03, -2.5 - 0.95 - k * 1.9), _mat(Color(0.28, 0.24, 0.2)), false)
			"future": # 빛 선로 — 빛 띠 둘·육각 받침
				for dx in [-0.7, 0.7]:
					_box(g, Vector3(0.14, 0.06, span), Vector3(dx, 0.05, mid), _emit(GLOW, 1.4), false)
				for k in int(span / 2.4):
					var hx := CylinderMesh.new()
					hx.top_radius = 0.5
					hx.bottom_radius = 0.5
					hx.height = 0.05
					hx.radial_segments = 6
					_mesh(g, hx, _mat(ALLOY, 0.4), Vector3(0.0, 0.025, -2.5 - 1.2 - k * 2.4), false)
		_build_anchor(era, deg)

## 시대 닻 — 갈래 끝(ANCHOR_R). 켜진 빛(_lit)은 매듭을 다 밝힌 뒤에만 보인다.
func _build_anchor(era: String, deg: float) -> void:
	var r := Node3D.new()
	r.name = "Anchor_" + era
	r.position = _local(deg, ANCHOR_R)
	r.rotation.y = -deg_to_rad(deg)
	_body.add_child(r)
	var lit := Node3D.new()
	lit.name = "Lit"
	match era:
		"past": # 큰 돌 석등(4m)
			_solid(_body, r, Vector3(1.4, 0.5, 1.4), Vector3(0, 0.25, 0), _mat(STONE_DARK))
			_solid(_body, r, Vector3(0.5, 2.2, 0.5), Vector3(0, 1.6, 0), _mat(STONE))
			_box(r, Vector3(1.3, 1.0, 1.3), Vector3(0, 3.2, 0), _mat(STONE))
			_box(r, Vector3(1.8, 0.3, 1.8), Vector3(0, 3.85, 0), _mat(STONE_DARK))
			_box(r, Vector3(0.9, 0.6, 1.32), Vector3(0, 3.2, 0), _mat(Color(0.2, 0.18, 0.16)))
			_box(lit, Vector3(0.9, 0.6, 1.34), Vector3(0, 3.2, 0), _emit(LAMP, 2.4), false)
		"now": # 신호기 + 차막이
			_solid(_body, r, Vector3(0.3, 5.0, 0.3), Vector3(1.8, 2.5, 0), _mat(ALLOY_DARK))
			_box(r, Vector3(0.7, 1.6, 0.4), Vector3(1.8, 4.6, 0), _mat(Color(0.12, 0.12, 0.14)))
			_box(r, Vector3(0.36, 0.36, 0.42), Vector3(1.8, 5.0, 0.02), _mat(Color(0.3, 0.12, 0.1)))
			_box(lit, Vector3(0.36, 0.36, 0.44), Vector3(1.8, 4.2, 0.02), _emit(Color(0.35, 1.0, 0.5), 2.4), false)
			_solid(_body, r, Vector3(3.0, 1.2, 0.8), Vector3(0, 0.6, -0.8), _mat(Color(0.75, 0.2, 0.15)))
			_box(r, Vector3(2.6, 0.2, 0.1), Vector3(0, 1.0, -0.35), _mat(Color(0.95, 0.9, 0.3)))
		"future": # 빛 기둥(7m) + 떠 도는 고리
			_solid(_body, r, Vector3(1.0, 0.4, 1.0), Vector3(0, 0.2, 0), _mat(ALLOY_DARK, 0.4))
			_solid(_body, r, Vector3(0.4, 6.0, 0.4), Vector3(0, 3.4, 0), _mat(ALLOY, 0.3))
			var ring := TorusMesh.new()
			ring.inner_radius = 0.7
			ring.outer_radius = 0.85
			var ri := _mesh(lit, ring, _emit(GLOW, 2.2), Vector3(0, 5.2, 0), false)
			_floaters.append([ri, 5.2, deg])
			_box(lit, Vector3(0.44, 6.0, 0.44), Vector3(0, 3.4, 0), _emit(GLOW, 0.9), false)
	r.add_child(lit)
	_lit.append(lit)

## 한가운데 위 세로로 찢어진 틈(5~17m, 톱니 조각 일곱 + 옅은 막) · 닫힌 뒤의 고요한 별빛.
func _build_tear() -> void:
	_tear = Node3D.new()
	_tear.name = "Tear"
	_tear.position = Vector3(0.0, 10.5, 0.0)
	_body.add_child(_tear)
	var glow := _emit(RIFT, 2.6)
	for k in 7:
		var h := 2.2 - absf(k - 3) * 0.25
		var seg := _box(_tear, Vector3(0.35, h, 0.2), Vector3((k % 2) * 0.7 - 0.35, -5.2 + k * 1.75, 0.0), glow, false)
		seg.rotation.z = 0.35 if k % 2 == 0 else -0.35
	var veil := QuadMesh.new()
	veil.size = Vector2(3.2, 12.5)
	_mesh(_tear, veil, _veil(Color(0.4, 0.2, 0.7), 0.35), Vector3.ZERO, false)
	## 틈에서 흩어진 시대 조각 넷(기와·톱니바퀴·빛 판·시계 문자판) — 떠 돈다.
	var bits := [[Vector3(3.0, 2.0, 1.0), Color(0.24, 0.25, 0.3)], [Vector3(-3.2, -1.0, -0.8), RUST], [Vector3(2.4, -3.5, -1.5), GLOW], [Vector3(-2.2, 3.8, 1.4), Color(0.95, 0.9, 0.75)]]
	for i in bits.size():
		var bit := _box(_tear, Vector3(0.9, 0.9, 0.12), bits[i][0], _emit(bits[i][1], 0.6), false)
		bit.rotation = Vector3(i * 0.5, i * 0.9, 0.3)
		_floaters.append([bit, float((bits[i][0] as Vector3).y), float(i)])
	_calm = Node3D.new()
	_calm.name = "Calm"
	_calm.position = Vector3(0.0, 9.0, 0.0)
	_body.add_child(_calm)
	var star := SphereMesh.new()
	star.radius = 0.8
	star.height = 1.6
	_mesh(_calm, star, _emit(STAR, 2.4), Vector3.ZERO, false)
	var halo := TorusMesh.new()
	halo.inner_radius = 1.6
	halo.outer_radius = 1.75
	var hm := _mesh(_calm, halo, _emit(STAR, 1.2), Vector3.ZERO, false)
	hm.rotation.x = PI * 0.5
	_floaters.append([_calm, 9.0, 0.0])

## 틈에 들려 끊긴 쇠 선로 조각 — 섬 쇠 갈래(북서) 끝에서 첫 정거장 쪽으로 내려간다(보기만).
func _build_hanging_rails() -> void:
	var deg := float(BRANCHES[1][1])
	for k in 6:
		var g := Node3D.new()
		g.name = "HangingRail%d" % k
		g.position = _local(deg, RADIUS + 3.0 + k * 5.5) + Vector3.UP * (-2.0 - k * 6.0)
		g.rotation = Vector3(0.12 * (k % 2) - 0.06, -deg_to_rad(deg) + 0.1 * (k - 2), 0.08 * k)
		_body.add_child(g)
		for dx in [-0.75, 0.75]:
			_box(g, Vector3(0.12, 0.12, 4.0), Vector3(dx, 0.08, 0), _mat(RUST, 0.6), false)
		for z in [-1.4, 0.0, 1.4]:
			_box(g, Vector3(2.4, 0.08, 0.35), Vector3(0, 0.0, z), _mat(Color(0.28, 0.24, 0.2)), false)
		_box(g, Vector3(1.8, 0.04, 3.2), Vector3(0, -0.12, 0), _emit(RIFT, 0.8), false)

func _build_draft() -> void:
	_draft = Node3D.new()
	_draft.name = "Updraft"
	add_child(_draft)
	var b := draft_base()
	_draft.global_position = b
	var h := top_y() + DRAFT_OVER - b.y
	var col := CylinderMesh.new()
	col.top_radius = DRAFT_R
	col.bottom_radius = DRAFT_R
	col.height = h
	col.radial_segments = 20
	col.rings = 1
	col.cap_top = false
	col.cap_bottom = false
	_mesh(_draft, col, _veil(Color(0.8, 0.7, 1.0), 0.1), Vector3.UP * h * 0.5, false)
	var ring := TorusMesh.new()
	ring.inner_radius = DRAFT_R - 0.35
	ring.outer_radius = DRAFT_R
	var rm := _veil(Color(0.88, 0.8, 1.0), 0.45)
	for i in 4:
		var mi := _mesh(_draft, ring, rm, Vector3.UP * (h * i / 4.0), false)
		mi.scale = Vector3(1.0, 0.2, 1.0)
		var tw := mi.create_tween().set_loops()
		var from := h * i / 4.0
		tw.tween_property(mi, "position:y", h, (h - from) / 12.0)
		tw.tween_property(mi, "position:y", 0.0, 0.0)
		tw.tween_property(mi, "position:y", from, maxf(from / 12.0, 0.05))

## 도감 place "crossing_end" — 섬 윗면에 서면(codex_state.gd TOTAL 에 더함).
func _add_discovery() -> void:
	var area := Area3D.new()
	area.name = "Discover_crossing_end"
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = RADIUS + 4.0
	cs.shape = shape
	area.add_child(cs)
	area.add_to_group("codex_discoverable")
	add_child(area)
	area.global_position = center()
	area.body_entered.connect(func(body: Node3D) -> void:
		if body.is_in_group("player"):
			CodexState.discover("place", "crossing_end"))
