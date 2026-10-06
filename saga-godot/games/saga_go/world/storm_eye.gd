extends Node3D

## PLAN 106장 52-1 — 이야기 8부 "먹구름의 근원"의 무대. 새 고정 지역 없이 첫 지역들로 돌아온다(시나리오 `scenario/saga-go.md` 8부).
##   여섯 매듭 — 1부 여섯 제단 자리(폐허·서쪽 옛길·북쪽 봉우리·물마루 곶·바위섬·구름섬)마다 금줄 감은 매듭 돌.
##     27장(CH27)부터 보인다. 풀린 매듭은 먹구름 연기를 뿜고, 다시 묶이면(KNOTS 의 장·단계부터) 불이 붙고 하늘로 금빛 줄이 선다.
##     여섯이 다 묶이면(28장 8단계) 줄이 먹구름 눈 가운데 매듭 등불 한 점으로 모이고, 눈이 걷히면(eye_clear) 줄은 거두고 불만 남는다.
##     매듭 돌은 이야기 제단 칸에서 북쪽 KNOT_OFF m — 단계가 세우는 제단(반지름 0.85)·석등 고리(6m)와 안 겹치게. 보기만(충돌 없음).
##   먹구름 눈 — 구름섬(world/sky_isle.gd) 서쪽 EYE_WEST m·윗면 EYE_RISE m 위에 뜬 판(반지름 EYE_R). 28장 가면 그림자가 올라간 뒤(EYE_FROM) 보이고 밟힌다.
##     구름섬 서쪽 가장자리 바람 기둥(29장부터 — 구름섬·구름 위 항로와 같은 틀)으로 올라 활공 약 10m. 둘레 먹구름 소용돌이 벽, 가운데 매듭 등불.
##     29장 이야기 보스를 쓰러뜨리면(EYE_CLEAR_STEP) 소용돌이가 걷혀 "맑은 하늘 뜰"로 남는다(기둥도 남아 다시 올 수 있다). 둘레 낮은 난간(1m, 충돌 — 나는 넘고 적은 못 넘는다).
## 이야기 단계·인물 칸의 eye = true 는 먹구름 눈 윗면 높이(world/story_quest.gd _spot_pos). 세이브 없음(이야기 진행 PartyState.story 만 읽는다).

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const SkyIsle := preload("res://games/saga_go/world/sky_isle.gd")

const CH27 := 26 # 27장(0부터)
const CH28 := 27
const CH29 := 28
## 여섯 매듭 — [region, 이야기 제단 칸, 구름섬 위인가, 이름, 묶이는 장(0부터), 그 장 단계(이 단계부터 묶임)].
const KNOTS := [
	["ruins", Vector2(2.75, 2.7), false, "첫째 매듭", CH27, 4],
	["village", Vector2(1.15, 1.3), false, "둘째 매듭", CH27, 5],
	["village", Vector2(7.0, 1.3), false, "셋째 매듭", CH27, 8],
	["coast", Vector2(3.0, 4.5), false, "넷째 매듭", CH28, 3],
	["coast", Vector2(6.0, 2.0), false, "다섯째 매듭", CH28, 5],
	["village", Vector2(7.1, 1.0), true, "여섯째 매듭", CH28, 8],
]
const KNOT_OFF := Vector3(0.0, 0.0, -2.4)
const BEAM_UP := 90.0 # 묶인 매듭 줄 — 다 묶이기 전엔 곧게 위로
## 먹구름 눈 — 28장(CH28) 9단계(가면 그림자가 올라간 뒤)부터 보인다 · 바람 기둥은 29장부터 · 29장이 끝나면 맑은 하늘 뜰.
const EYE_FROM_STEP := 9
## 29장(CH29) 이야기 보스를 쓰러뜨린 뒤(6단계)부터 소용돌이가 걷힌다.
const EYE_CLEAR_STEP := 6
const EYE_WEST := 36.5
const EYE_RISE := 24.0
const EYE_R := 18.0 # 29장 매듭 등불 지키기 물결 둘레(DEFEND_RING 15m)가 난간 안쪽
const LANTERN_H := 3.6 # 매듭 등불 알 높이(윗면 위)
const RIM_H := 1.0
const DRAFT_R := 3.5
const DRAFT_IN := 3.5 # 구름섬 가장자리에서 이만큼 안
const DRAFT_OVER := 9.0
const DRAFT_VY := 9.0
const PLACE_ID := "storm_eye"

const STONE := Color(0.5, 0.49, 0.46)
const STRAW := Color(0.86, 0.74, 0.46)
const PAPER := Color(0.96, 0.95, 0.9)
const FLAME := Color(1.0, 0.72, 0.3)
const BEAM := Color(1.0, 0.86, 0.45)
const GLOOM := Color(0.2, 0.18, 0.26)
const SLATE := Color(0.3, 0.3, 0.36)
const SLATE_DARK := Color(0.2, 0.2, 0.25)
const CLOUD := Color(0.93, 0.95, 0.98)
const STORM := Color(0.62, 0.42, 0.95)

var _knots: Array = [] # [{root, flame, smoke, beam(MeshInstance3D), base(Vector3)}]
var _eye: StaticBody3D = null
var _vortex: Node3D = null
var _calm: Node3D = null
var _orb_mat: StandardMaterial3D = null
var _label: Label3D = null
var _draft: Node3D = null
var _floaters: Array = [] # [node, base_y, phase]
var _player: Node3D = null
var _state := "" # 바뀔 때만 다시 그린다
var _t := 0.0

static func _ch() -> int:
	return int(PartyState.story.get("ch", 0))

static func _st() -> int:
	return int(PartyState.story.get("step", 0))

## (ch, step) 에 닿았거나 지났는가.
static func _reached(ch: int, step: int) -> bool:
	var c := _ch()
	return c > ch or (c == ch and _st() >= step)

## 매듭 돌이 보이는가 — 27장부터.
static func knots_shown() -> bool:
	return _ch() >= CH27

static func knot_tied(k: int) -> bool:
	return _reached(int(KNOTS[k][4]), int(KNOTS[k][5]))

static func all_tied() -> bool:
	for k in KNOTS.size():
		if not knot_tied(k):
			return false
	return true

## 매듭 k 금빛 줄 — "" 없음 · "up" 곧게 위로 · "eye" 매듭 등불로(여섯 다 묶인 뒤 29장이 끝나기 전).
static func beam_mode(k: int) -> String:
	if not knot_tied(k) or eye_clear():
		return ""
	return "eye" if all_tied() else "up"

## 매듭 k 돌 자리(월드 — 돌 밑동).
static func knot_pos(k: int) -> Vector3:
	var r: Array = KNOTS[k]
	var p := TestMap.world_pos(r[1].x, r[1].y, String(r[0])) + KNOT_OFF
	p.y = SkyIsle.top_y() if bool(r[2]) else TerrainBuilder.height_at(String(r[0]), p)
	return p

static func eye_shown() -> bool:
	return _reached(CH28, EYE_FROM_STEP)

static func draft_open() -> bool:
	return _ch() >= CH29

## 29장 이야기 보스를 쓰러뜨렸거나 지났는가 — 소용돌이가 걷힌 맑은 하늘 뜰.
static func eye_clear() -> bool:
	return _reached(CH29, EYE_CLEAR_STEP)

static func top_y() -> float:
	return SkyIsle.top_y() + EYE_RISE

static func center() -> Vector3:
	var p := SkyIsle.center() + Vector3(-EYE_WEST, 0.0, 0.0)
	p.y = top_y()
	return p

static func lantern_pos() -> Vector3:
	return center() + Vector3.UP * LANTERN_H

## 가운데에서 방위 deg(북쪽 0·시계 방향)로 m m 떨어진 윗면 자리(월드).
static func at(deg: float, m: float) -> Vector3:
	var a := deg_to_rad(deg)
	return center() + Vector3(sin(a), 0.0, -cos(a)) * m

## 먹구름 눈 윗면 위에 서 있는가(가로 반지름 안·윗면 근처).
static func on_eye(p: Vector3, slack := 1.5) -> bool:
	var c := center()
	return Vector2(p.x - c.x, p.z - c.z).length() <= EYE_R and p.y >= c.y - slack and p.y <= c.y + 8.0

## 바람 기둥 밑동 — 구름섬 윗면 서쪽 가장자리 DRAFT_IN m 안.
static func draft_base() -> Vector3:
	return SkyIsle.center() + Vector3(-(SkyIsle.RADIUS - DRAFT_IN), 0.0, 0.0)

func _ready() -> void:
	add_to_group("go_storm_eye")
	for k in KNOTS.size():
		_build_knot(k)
	_build_eye()
	_build_draft()
	_add_discovery()
	_refresh()

func knot_lit(k: int) -> bool:
	return k < _knots.size() and (_knots[k].flame as Node3D).is_visible_in_tree()

func knot_smoking(k: int) -> bool:
	return k < _knots.size() and (_knots[k].smoke as Node3D).is_visible_in_tree()

func beam_visible(k: int) -> bool:
	return k < _knots.size() and (_knots[k].beam as Node3D).is_visible_in_tree()

## 줄 끝(월드) — 보이는 줄의 윗끝.
func beam_end(k: int) -> Vector3:
	var b: MeshInstance3D = _knots[k].beam
	return b.global_position + b.global_basis.y.normalized() * ((b.mesh as CylinderMesh).height * 0.5)

func is_shown() -> bool:
	return _eye != null and _eye.visible and _eye.collision_layer == 1

func vortex_visible() -> bool:
	return _vortex != null and _vortex.is_visible_in_tree()

func draft_active() -> bool:
	return _draft != null and _draft.visible

func _refresh() -> void:
	var key := "%d:%d" % [_ch(), _st()]
	if key == _state:
		return
	_state = key
	var shown := knots_shown()
	for k in _knots.size():
		var kn: Dictionary = _knots[k]
		(kn.root as Node3D).visible = shown
		var tied := knot_tied(k)
		(kn.flame as Node3D).visible = tied
		(kn.smoke as Node3D).visible = not tied
		_aim_beam(k, beam_mode(k))
	var es := eye_shown()
	_eye.visible = es
	_eye.collision_layer = 1 if es else 0
	var clear := eye_clear()
	_vortex.visible = not clear
	_calm.visible = clear
	_orb_mat.albedo_color = FLAME if clear or all_tied() else GLOOM
	_orb_mat.emission = _orb_mat.albedo_color
	_orb_mat.emission_energy_multiplier = 2.0 if clear or all_tied() else 0.4
	_label.text = "맑은 하늘 뜰" if clear else "먹구름 눈"
	_draft.visible = es and draft_open()

func _aim_beam(k: int, mode: String) -> void:
	var b: MeshInstance3D = _knots[k].beam
	b.visible = mode != ""
	if mode == "":
		return
	var from: Vector3 = _knots[k].base + Vector3.UP * 2.0
	var to := lantern_pos() if mode == "eye" else from + Vector3.UP * BEAM_UP
	var d := to - from
	(b.mesh as CylinderMesh).height = d.length()
	b.global_transform = Transform3D(Basis(Quaternion(Vector3.UP, d.normalized())), from + d * 0.5)

func _process(delta: float) -> void:
	_t += delta
	for f in _floaters:
		(f[0] as Node3D).position.y = float(f[1]) + sin(_t * 0.7 + float(f[2])) * 0.3
	if _vortex and _vortex.visible:
		_vortex.rotation.y = fmod(_t * 0.25, TAU)

func _physics_process(_delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		return
	if Engine.get_physics_frames() % 30 == 0:
		_refresh()
	if not _draft.visible or not _player.has_method("updraft"):
		return
	var pp := _player.global_position
	var b := draft_base()
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

## G-0041 — 연기 입자(빌보드 한 장 + 둥근 흐림 무늬). 커지며 옅어진다. amount·수명·한 장 크기(m)·가장 짙을 때 불투명.
func _smoke(parent: Node3D, amount: int, life: float, size: float, alpha: float) -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.name = "SmokeParticles"
	p.amount = amount
	p.lifetime = life
	p.preprocess = life
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	p.mesh = q
	p.scale_amount_min = 0.7
	p.scale_amount_max = 1.3
	var grow := Curve.new()
	grow.add_point(Vector2(0, 0.45))
	grow.add_point(Vector2(1, 1.0))
	p.scale_amount_curve = grow
	p.angle_min = 0.0
	p.angle_max = 360.0
	var ramp := Gradient.new()
	ramp.set_color(0, Color(GLOOM.r, GLOOM.g, GLOOM.b, 0.0))
	ramp.set_color(1, Color(GLOOM.r * 0.8, GLOOM.g * 0.8, GLOOM.b * 0.9, 0.0))
	ramp.add_point(0.2, Color(GLOOM.r, GLOOM.g, GLOOM.b, alpha))
	ramp.add_point(0.7, Color(GLOOM.r * 0.9, GLOOM.g * 0.9, GLOOM.b, alpha * 0.6))
	p.color_ramp = ramp
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.vertex_color_use_as_albedo = true
	m.albedo_texture = _puff_texture()
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.billboard_keep_scale = true
	p.material_override = m
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(p)
	return p

static var _puff_tex: Texture2D = null

## 가운데가 짙고 가장자리로 사라지는 둥근 흐림(코드로 만든 무늬 — 에셋 파일 없음).
static func _puff_texture() -> Texture2D:
	if _puff_tex == null:
		var g := Gradient.new()
		g.set_color(0, Color(1, 1, 1, 1))
		g.set_color(1, Color(1, 1, 1, 0))
		g.add_point(0.45, Color(1, 1, 1, 0.75))
		var t := GradientTexture2D.new()
		t.gradient = g
		t.fill = GradientTexture2D.FILL_RADIAL
		t.fill_from = Vector2(0.5, 0.5)
		t.fill_to = Vector2(1.0, 0.5)
		t.width = 64
		t.height = 64
		_puff_tex = t
	return _puff_tex

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

func _label3d(parent: Node3D, text: String, pos: Vector3, col: Color, size := 48) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.font_size = size
	l.outline_size = 8
	l.pixel_size = 0.01
	l.modulate = col
	l.position = pos
	parent.add_child(l)
	return l

## 매듭 돌 — 선돌(1.7m) · 허리에 금줄 고리와 흰 종이 술 · 머리에 불(묶였을 때) · 둘레 먹구름 연기 셋(풀렸을 때) · 금빛 줄.
func _build_knot(k: int) -> void:
	var r: Array = KNOTS[k]
	var root := Node3D.new()
	root.name = "Knot_%d" % k
	add_child(root)
	var base := knot_pos(k)
	root.global_position = base
	_box(root, Vector3(0.75, 1.7, 0.55), Vector3(0, 0.85, 0), _mat(STONE))
	_box(root, Vector3(1.1, 0.25, 0.9), Vector3(0, 0.12, 0), _mat(STONE.darkened(0.25)))
	var rope := TorusMesh.new()
	rope.inner_radius = 0.5
	rope.outer_radius = 0.6
	var rm := _mesh(root, rope, _mat(STRAW), Vector3(0, 1.15, 0), false)
	rm.scale = Vector3(1.0, 0.6, 0.85)
	for i in 4:
		_box(root, Vector3(0.1, 0.32, 0.02), Vector3(-0.3 + i * 0.2, 0.92, 0.33), _mat(PAPER), false)
	var flame := MeshInstance3D.new()
	var fm := SphereMesh.new()
	fm.radius = 0.28
	fm.height = 0.7
	flame.mesh = fm
	flame.material_override = _emit(FLAME, 2.2)
	flame.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	flame.position = Vector3(0, 2.05, 0)
	root.add_child(flame)
	_floaters.append([flame, 2.05, float(k)])
	var smoke := Node3D.new()
	smoke.name = "Smoke"
	root.add_child(smoke)
	## G-0041 — 공 셋 대신 위로 오르며 퍼지고 옅어지는 연기 입자(처음부터 기둥이 서게 미리 채움).
	var sp := _smoke(smoke, 34, 3.6, 2.2, 0.85)
	sp.position = Vector3(0, 2.3, 0)
	sp.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	sp.emission_sphere_radius = 0.35
	sp.direction = Vector3.UP
	sp.spread = 14.0
	sp.initial_velocity_min = 0.9
	sp.initial_velocity_max = 1.5
	sp.gravity = Vector3(0.25, 0.15, 0.1)   # 살짝 바람에 기운다
	_label3d(root, String(r[3]), Vector3(0, 3.0, 0), Color(1.0, 0.92, 0.7), 40)
	var bm := CylinderMesh.new()
	bm.top_radius = 0.22
	bm.bottom_radius = 0.22
	bm.height = BEAM_UP
	bm.radial_segments = 8
	bm.rings = 1
	bm.cap_top = false
	bm.cap_bottom = false
	var beam := MeshInstance3D.new()
	beam.name = "Beam"
	beam.mesh = bm
	beam.material_override = _veil(BEAM, 0.45)
	beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(beam)
	## 돌·불·연기·이름표는 가까이서만(그리기 부담) — 멀리선 금빛 줄이 표지.
	for n in root.find_children("*", "GeometryInstance3D", true, false):
		if n != beam:
			(n as GeometryInstance3D).visibility_range_end = 180.0
	_knots.append({"root": root, "flame": flame, "smoke": smoke, "beam": beam, "base": base})

## 먹구름 눈 — 윗면 원판(두께 1.4m) · 밑 거꾸로 선 바위 뿔(충돌 볼록) · 난간(충돌 상자 스무 조각) · 가운데 매듭 등불 ·
## 둘레 먹구름 소용돌이 벽(보기만, 돈다) · 걷힌 뒤 흰 구름 띠.
func _build_eye() -> void:
	_eye = StaticBody3D.new()
	_eye.name = "StormEye"
	_eye.collision_layer = 1
	add_child(_eye)
	_eye.global_position = center()
	var top := CylinderMesh.new()
	top.top_radius = EYE_R
	top.bottom_radius = EYE_R - 1.2
	top.height = 1.4
	top.radial_segments = 32
	_mesh(_eye, top, _mat(SLATE), Vector3(0.0, -0.7, 0.0))
	var ts := CylinderShape3D.new()
	ts.radius = EYE_R
	ts.height = 1.4
	var tcs := CollisionShape3D.new()
	tcs.shape = ts
	tcs.position = Vector3(0.0, -0.7, 0.0)
	_eye.add_child(tcs)
	var cone := CylinderMesh.new()
	cone.top_radius = EYE_R - 1.2
	cone.bottom_radius = 1.5
	cone.height = 12.0
	cone.radial_segments = 14
	cone.rings = 1
	_mesh(_eye, cone, _mat(SLATE_DARK), Vector3(0.0, -7.4, 0.0))
	var ccs := CollisionShape3D.new()
	ccs.shape = cone.create_convex_shape()
	ccs.position = Vector3(0.0, -7.4, 0.0)
	_eye.add_child(ccs)
	## 윗면 빛 고리 — 여섯 매듭 방향 줄(보기만)
	for i in 6:
		var a := TAU * i / 6.0
		var ln := _box(_eye, Vector3(0.14, 0.03, 9.0), Vector3(sin(a), 0.0, -cos(a)) * 7.0 + Vector3.UP * 0.02, _emit(BEAM, 0.8), false)
		ln.rotation.y = -a
	## 난간
	var rail := _mat(SLATE_DARK)
	var post := BoxMesh.new()
	post.size = Vector3(0.4, RIM_H + 0.4, 0.4)
	for i in 12:
		var a := TAU * i / 12.0
		_mesh(_eye, post, rail, Vector3(cos(a), 0.0, sin(a)) * (EYE_R - 0.45) + Vector3.UP * (RIM_H + 0.4) * 0.5)
	var seg_n := 20
	var seg_len := TAU * (EYE_R - 0.45) / seg_n + 0.3
	for i in seg_n:
		var a := TAU * (i + 0.5) / seg_n
		var bs := BoxShape3D.new()
		bs.size = Vector3(seg_len, RIM_H, 0.4)
		var cs := CollisionShape3D.new()
		cs.shape = bs
		cs.position = Vector3(cos(a), 0.0, sin(a)) * (EYE_R - 0.45) + Vector3.UP * RIM_H * 0.5
		cs.rotation.y = -a + PI * 0.5
		_eye.add_child(cs)
		var bar := _box(_eye, Vector3(seg_len - 0.3, 0.14, 0.14), cs.position + Vector3.UP * RIM_H * 0.4, rail, false)
		bar.rotation.y = cs.rotation.y
	## 매듭 등불 — 받침·기둥(충돌)·알
	_box(_eye, Vector3(2.4, 0.3, 2.4), Vector3(0, 0.15, 0), _mat(SLATE_DARK))
	var pcs := CollisionShape3D.new()
	var ps := BoxShape3D.new()
	ps.size = Vector3(0.8, 3.0, 0.8)
	pcs.shape = ps
	pcs.position = Vector3(0, 1.5, 0)
	_eye.add_child(pcs)
	_box(_eye, Vector3(0.8, 3.0, 0.8), Vector3(0, 1.5, 0), _mat(STONE))
	var rope := TorusMesh.new()
	rope.inner_radius = 0.5
	rope.outer_radius = 0.62
	_mesh(_eye, rope, _mat(STRAW), Vector3(0, 2.2, 0), false)
	_orb_mat = _emit(GLOOM, 0.4)
	var orb := SphereMesh.new()
	orb.radius = 0.8
	orb.height = 1.6
	var om := _mesh(_eye, orb, _orb_mat, Vector3(0, LANTERN_H, 0), false)
	_floaters.append([om, LANTERN_H, 0.0])
	## 먹구름 소용돌이 — 반지름 20~25m 둘레 덩이 열여섯 + 보랏빛 번개 줄 넷(보기만, 통째로 돈다).
	_vortex = Node3D.new()
	_vortex.name = "Vortex"
	_eye.add_child(_vortex)
	## G-0041 — 공 열여섯 대신 고리(반지름 18~24m)에서 피어오르는 큰 연기 입자. local_coords 라 Vortex 와 같이 돈다.
	var vp := _smoke(_vortex, 280, 7.0, 13.0, 0.9)
	vp.local_coords = true
	vp.position = Vector3(0, 3.0, 0)
	vp.emission_shape = CPUParticles3D.EMISSION_SHAPE_RING
	vp.emission_ring_axis = Vector3.UP
	vp.emission_ring_radius = 24.0
	vp.emission_ring_inner_radius = 18.0
	vp.emission_ring_height = 6.0
	vp.direction = Vector3.UP
	vp.spread = 25.0
	vp.initial_velocity_min = 0.4
	vp.initial_velocity_max = 1.2
	vp.gravity = Vector3.ZERO
	for i in 4:
		var a := TAU * (i + 0.25) / 4.0
		var bolt := _box(_vortex, Vector3(0.18, 7.0, 0.18), Vector3(cos(a) * 19.0, 6.0, sin(a) * 19.0), _emit(STORM, 3.0), false)
		bolt.rotation.z = 0.35 * (1 if i % 2 == 0 else -1)
	## 걷힌 뒤 — 섬 허리 흰 구름 띠
	_calm = Node3D.new()
	_calm.name = "Calm"
	_eye.add_child(_calm)
	var cl := TorusMesh.new()
	cl.inner_radius = EYE_R - 3.0
	cl.outer_radius = EYE_R + 2.5
	cl.rings = 24
	var cm := _mesh(_calm, cl, _veil(CLOUD, 0.35), Vector3(0.0, -4.0, 0.0), false)
	cm.scale = Vector3(1.0, 0.35, 1.0)
	_label = _label3d(_eye, "먹구름 눈", Vector3(0.0, 13.0, 0.0), Color(0.92, 0.9, 1.0))

## 바람 기둥 — 구름섬 서쪽 가장자리에서 먹구름 눈 윗면 + DRAFT_OVER 까지(29장부터).
func _build_draft() -> void:
	_draft = Node3D.new()
	_draft.name = "Updraft_eye"
	add_child(_draft)
	var base := draft_base()
	_draft.global_position = base
	var h := top_y() + DRAFT_OVER - base.y
	var col := CylinderMesh.new()
	col.top_radius = DRAFT_R
	col.bottom_radius = DRAFT_R
	col.height = h
	col.radial_segments = 20
	col.rings = 1
	col.cap_top = false
	col.cap_bottom = false
	_mesh(_draft, col, _veil(Color(0.8, 0.92, 1.0), 0.1), Vector3.UP * h * 0.5, false)
	var ring := TorusMesh.new()
	ring.inner_radius = DRAFT_R - 0.35
	ring.outer_radius = DRAFT_R
	var rmat := _veil(Color(0.86, 0.95, 1.0), 0.45)
	for k in 4:
		var mi := _mesh(_draft, ring, rmat, Vector3.UP * (h * k / 4.0), false)
		mi.scale = Vector3(1.0, 0.2, 1.0)
		var tw := mi.create_tween().set_loops()
		var from := h * k / 4.0
		tw.tween_property(mi, "position:y", h, (h - from) / 12.0)
		tw.tween_property(mi, "position:y", 0.0, 0.0)
		tw.tween_property(mi, "position:y", from, maxf(from / 12.0, 0.05))

## 도감 place — 먹구름 눈 윗면 둘레에 들어서면(codex_state.gd TOTAL 에 더함). 안 보일 땐 안 걸린다.
func _add_discovery() -> void:
	var area := Area3D.new()
	area.name = "Discover_" + PLACE_ID
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = EYE_R + 4.0
	cs.shape = shape
	area.add_child(cs)
	area.add_to_group("codex_discoverable")
	add_child(area)
	area.global_position = center()
	area.body_entered.connect(func(body: Node3D) -> void:
		if body.is_in_group("player") and is_shown():
			CodexState.discover("place", PLACE_ID))
