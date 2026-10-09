extends Node3D

## PLAN 106장 ㊳ — 이야기 9장 "먹구름 위 여섯째 자리". 북쪽 봉우리 꼭대기 옆 하늘에 뜬 구름섬 + 봉우리에서 솟는 바람 기둥(원신 상승 기류).
##   섬은 늘 떠 있다(마을에서 올려다보이는 표지) — 9장이 끝나기 전엔 위에 먹구름이 덮여 있고, 끝나면 걷힌다.
##   바람 기둥은 9장이 풀린 뒤부터(끝난 뒤에도 남아 다시 오를 수 있다): 기둥 안 공중이면 저절로 활공, 활공이면 위로 솟는다
##   (go_player.gd `updraft`). 땅에 서 있으면 안 뜬다 — 뛰어오르면 탄다.
##   섬 둘레엔 낮은 돌 난간(1m, 충돌) — 적은 못 넘고 나는 넘어 활공으로 내려간다.
## 자리: 봉우리 칸 DRAFT_CELL 땅 높이 + RISE 가 섬 윗면. 섬 가운데는 봉우리에서 북쪽으로 CELL 만큼(가로 24m).
## 세이브 없음(보이는 것만 이야기 진행 PartyState.story 를 읽는다).

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")
const Story := preload("res://games/saga_go/data/story.gd")
const IsleRock := preload("res://games/saga_go/world/isle_rock.gd")

const REGION := "village"
const CELL := Vector2(7.1, 1.0) # 섬 가운데
const DRAFT_CELL := Vector2(7.1, 1.5) # 바람 기둥(봉우리 꼭대기)
const RISE := 40.0 # 봉우리 땅 위로 섬 윗면까지
const RADIUS := 14.0 # 섬 윗면 반지름
const RIM_H := 1.0 # 난간 높이 — 나는 넘고(턱 넘기 1.3m) 적은 못 넘는다
const DRAFT_R := 3.5
const DRAFT_OVER := 9.0 # 섬 윗면보다 이만큼 위까지 솟는다
const DRAFT_VY := 9.0
const STORY_CH := 8 # 9장(0부터)

var _draft: Node3D = null
var _gloom: Node3D = null
var _player: Node3D = null

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

## 섬 윗면 위에 서 있는가(가로 반지름 안·윗면 근처).
static func on_isle(p: Vector3, slack := 1.5) -> bool:
	var c := center()
	return Vector2(p.x - c.x, p.z - c.z).length() <= RADIUS and p.y >= c.y - slack and p.y <= c.y + 6.0

## 9장이 풀렸거나 지났는가 — 바람 기둥이 선다.
static func draft_open() -> bool:
	var ch := int(PartyState.story.get("ch", 0))
	if ch > STORY_CH:
		return true
	var c := Story.chapter(STORY_CH)
	return ch == STORY_CH and not c.is_empty() and Adventure.ar() >= int(c.ar)

func _ready() -> void:
	add_to_group("go_sky_isle")
	_build_isle()
	_build_draft()
	_refresh()

func draft_active() -> bool:
	return _draft != null and _draft.visible

func gloom_visible() -> bool:
	return _gloom != null and _gloom.visible

func _refresh() -> void:
	if _draft:
		_draft.visible = draft_open()
	if _gloom:
		_gloom.visible = int(PartyState.story.get("ch", 0)) <= STORY_CH

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

func _glow(c: Color, alpha: float) -> StandardMaterial3D:
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

func _build_isle() -> void:
	var body := StaticBody3D.new()
	body.name = "SkyIsle"
	body.collision_layer = 1
	add_child(body)
	body.global_position = center()
	## 윗면 — 풀빛 원판(두께 1.2m), 밑은 거꾸로 선 바위 뿔(충돌 볼록).
	var top := CylinderMesh.new()
	top.top_radius = RADIUS
	top.bottom_radius = RADIUS - 1.0
	top.height = 1.2
	top.radial_segments = 28
	_mesh(body, top, _mat(Color(0.42, 0.56, 0.36)), Vector3(0.0, -0.6, 0.0))
	var ts := CylinderShape3D.new()
	ts.radius = RADIUS
	ts.height = 1.2
	var tcs := CollisionShape3D.new()
	tcs.shape = ts
	tcs.position = Vector3(0.0, -0.6, 0.0)
	body.add_child(tcs)
	var cone := CylinderMesh.new()
	cone.top_radius = RADIUS - 1.0
	cone.bottom_radius = 1.5
	cone.height = 13.0
	cone.radial_segments = 14
	cone.rings = 1
	IsleRock.add(body, cone, Color(0.46, 0.43, 0.42), Vector3(0.0, -7.7, 0.0), 71)   # G-0130 — 바위 밑동(층·뿌리)
	var ccs := CollisionShape3D.new()
	ccs.shape = cone.create_convex_shape()
	ccs.position = Vector3(0.0, -7.7, 0.0)
	body.add_child(ccs)
	## 난간 — 보이는 돌 고리 하나 + 기둥 여덟, 충돌은 상자 열여섯 조각.
	var stone := _mat(Color(0.62, 0.6, 0.58))
	var rim := TorusMesh.new()
	rim.inner_radius = RADIUS - 0.7
	rim.outer_radius = RADIUS - 0.2
	rim.rings = 32
	var rmi := _mesh(body, rim, stone, Vector3(0.0, RIM_H * 0.55, 0.0))
	rmi.scale = Vector3(1.0, 1.6, 1.0)
	var post := BoxMesh.new()
	post.size = Vector3(0.5, RIM_H + 0.5, 0.5)
	for i in 8:
		var a := TAU * i / 8.0
		_mesh(body, post, stone, Vector3(cos(a), 0.0, sin(a)) * (RADIUS - 0.45) + Vector3.UP * (RIM_H + 0.5) * 0.5)
	var seg_n := 16
	var seg_len := TAU * (RADIUS - 0.45) / seg_n + 0.3
	for i in seg_n:
		var a := TAU * (i + 0.5) / seg_n
		var bs := BoxShape3D.new()
		bs.size = Vector3(seg_len, RIM_H, 0.4)
		var cs := CollisionShape3D.new()
		cs.shape = bs
		cs.position = Vector3(cos(a), 0.0, sin(a)) * (RADIUS - 0.45) + Vector3.UP * RIM_H * 0.5
		cs.rotation.y = -a + PI * 0.5
		body.add_child(cs)
	## 여섯째 자리 — 북쪽 끝 돌 단(장식, 싸움터 가운데를 비워 둔다) + 보랏빛 고리.
	var dais := CylinderMesh.new()
	dais.top_radius = 2.0
	dais.bottom_radius = 2.3
	dais.height = 0.5
	dais.radial_segments = 16
	var dpos := Vector3(0.0, 0.25, -(RADIUS - 3.4))
	_mesh(body, dais, stone, dpos)
	var ring := TorusMesh.new()
	ring.inner_radius = 1.5
	ring.outer_radius = 1.75
	var ring_mi := _mesh(body, ring, _glow(Color(0.7, 0.55, 1.0), 0.6), dpos + Vector3.UP * 0.3, false)
	ring_mi.scale = Vector3(1.0, 0.1, 1.0)
	## 구름 — 흰 구름 띠(늘) + 먹구름 덮개(9장 끝나면 걷힘).
	var cloud := _mat(Color(0.95, 0.96, 1.0), 1.0)
	var puff := SphereMesh.new()
	puff.radius = 3.2
	puff.height = 3.0
	puff.radial_segments = 12
	puff.rings = 6
	for i in 10:
		var a := TAU * i / 10.0 + 0.2
		var mi := _mesh(body, puff, cloud, Vector3(cos(a), 0.0, sin(a)) * (RADIUS + 0.8) + Vector3.UP * -2.4, false)
		mi.scale = Vector3(1.3 + 0.2 * (i % 3), 0.55, 1.1)
	_gloom = Node3D.new()
	_gloom.name = "Gloom"
	body.add_child(_gloom)
	var dark := _mat(Color(0.2, 0.2, 0.27), 1.0)
	var big := SphereMesh.new()
	big.radius = 6.0
	big.height = 5.0
	big.radial_segments = 12
	big.rings = 6
	for i in 6:
		var a := TAU * i / 6.0
		var mi := _mesh(_gloom, big, dark, Vector3(cos(a), 0.0, sin(a)) * 8.0 + Vector3.UP * (16.0 + 1.5 * (i % 2)), false)
		mi.scale = Vector3(1.4, 0.5, 1.2)

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
	_mesh(_draft, col, _glow(Color(0.75, 0.95, 0.9), 0.1), Vector3.UP * h * 0.5, false)
	## 솟는 바람 고리 넷 — 밑에서 위로 흘러간다.
	var ring := TorusMesh.new()
	ring.inner_radius = DRAFT_R - 0.35
	ring.outer_radius = DRAFT_R
	var rm := _glow(Color(0.85, 1.0, 0.95), 0.45)
	for i in 4:
		var mi := _mesh(_draft, ring, rm, Vector3.UP * (h * i / 4.0), false)
		mi.scale = Vector3(1.0, 0.2, 1.0)
		var tw := mi.create_tween().set_loops()
		var from := h * i / 4.0
		tw.tween_property(mi, "position:y", h, (h - from) / 12.0)
		tw.tween_property(mi, "position:y", 0.0, 0.0)
		tw.tween_property(mi, "position:y", from, maxf(from / 12.0, 0.05))
