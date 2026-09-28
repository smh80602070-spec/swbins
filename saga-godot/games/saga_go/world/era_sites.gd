extends Node3D

## PLAN 106장 ㊼ 이야기 3부 — "별배 날개 조각 셋이 여러 시대에 흩어졌다"(12장 끝 실마리)의 세 자리.
## 탐사 파견(data/dispatch.gd)이 이미 이름만 쓰던 자리를 실제 명소로 세운다:
##   ㊼-1 갯바람 포구 동쪽 물가 "녹슨 조선소"(현대) — 13장. 바다로 내려가는 선대·짓다 만 배 뼈대·올라갈 수 있는 문형 기중기.
##   ㊼-2 잿빛 폐허 서쪽 "시간 틈 관측소"(미래) — 14장. 땅엔 부서진 탑 터·틈(보랏빛 금), 24m 위에 떠 있는 관측대(난간·관측경 돔),
##        남쪽에 시간 기둥(상승 기류, sky_isle.gd 바람 기둥과 같은 틀) — 14장 석등을 켠 뒤(DRAFT_FROM_STEP)부터 선다.
##   ㊼-3 청하 마을 남쪽 산골 "옛 역참 길"(과거) — 15장. 골짜기 길(폭 48m, 양옆 절벽) 서쪽에 돌담 두른 역참 터·초가 마구간·구유·
##        역참 깃대, 골짜기 북쪽 어귀에 돌장승 둘, 마구간에 역마 한 마리(15장 쫓기 동안만 비운다). 한가운데 이정표(landmarks_builder)는 그대로.
## 모양은 코드로 그린 상자·원기둥(고원 명소 region4_frost.gd 와 같은 결). 기중기 다리 바깥면은 들보 끝면과 같은 면이라
## 다리를 타고 오르면 그대로 들보 위로 넘어선다(벽 타기 — 정적 몸체 옆면).

const PropMaterial := preload("res://games/saga_go/world/prop_material.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const CreatureBuilder := preload("res://games/saga_go/world/creature_builder.gd")

const DISCOVER_R := 30.0
## 조선소 칸(바다 칸 (7,3) 남쪽 물가 — 북쪽 = 바다). 둘레 1칸 안의 가장 가까운 것: 조개 무리 (6.8,4.1) 29m · 쇠부리 터 비경 (7.3,4.6) 36m.
const SHIPYARD_CELL := Vector2(7.3, 3.85)
## 기중기 들보 윗면 높이(m, 땅에서) — 이야기 13장 climb 단계 above = 이 값 + CLIMB_SLACK - 0.5(들보 위에 올라서야 넘어간다).
const CRANE_TOP := 12.6
const CRANE_HALF := 7.0 # 들보 반 길이 — 다리 바깥면이 여기

## 시간 틈 관측소 — 폐허 서쪽 R 칸(가장 가까운 것: 잿빛 꽃 (1.4,3.0)·꿀꽃 (1.3,1.4)·기둥 유물 (1,3) 39~40m · 도적 야영 상자 (2.05,2.05) 41m).
const RIFT_CELL := Vector2(1.2, 2.2)
const OBS_RISE := 24.0 # 땅 위 관측대 윗면 높이 — 14장 kill lift·반디 자리 lift 와 같다, climb above = 이 값 + 2.0
const OBS_R := 9.0 # 관측대 윗면 반지름
const OBS_RIM_H := 1.0 # 난간 — 나는 넘고(턱 넘기 1.3m) 적은 못 넘는다
const PILLAR_R := 7.5 # 땅 위 부서진 탑 기둥 둘레(석등 둘레 Story.SEAL_RING 6m 보다 바깥)
const DRAFT_OFF := Vector3(0.0, 0.0, 13.0) # 시간 기둥 — 관측대 남쪽 바깥(가장자리에서 4m)
const DRAFT_R := 3.0
const DRAFT_OVER := 8.0 # 관측대 윗면보다 이만큼 위까지 솟는다
const DRAFT_VY := 9.0
const CH14 := 13 # 14장(0부터)
## 옛 역참 터 — 마을 남쪽 산골 길 (5,8)~(5,10) 서쪽(땅 높이 칸 x 4.5~5.4 가 평지). 이정표 (5,9) 에서 서북쪽 15m.
const STATION_CELL := Vector2(4.72, 8.8)
const CH15 := 14
const HORSE_AWAY_STEP := 3 # 15장 쫓기 단계 — 이때만 마구간이 빈다
const DRAFT_FROM_STEP := 6 # 석등(5)을 다 켠 뒤 단계부터

const RUST := Color(0.52, 0.3, 0.18)
const RUST_DARK := Color(0.34, 0.2, 0.13)
const CONCRETE := Color(0.62, 0.62, 0.6)
const CRANE_PAINT := Color(0.82, 0.62, 0.18)
const HULL_GRAY := Color(0.45, 0.47, 0.5)
const ALLOY := Color(0.74, 0.77, 0.82)
const ALLOY_DARK := Color(0.3, 0.33, 0.4)
const RIFT_GLOW := Color(0.72, 0.5, 1.0)
const DRAFT_GLOW := Color(0.6, 0.85, 1.0)
const FIELDSTONE := Color(0.55, 0.52, 0.47)
const THATCH := Color(0.66, 0.55, 0.32)
const TIMBER := Color(0.36, 0.25, 0.16)

var _horse: Node3D = null

var _draft: Node3D = null
var _player: Node3D = null

func _ready() -> void:
	add_to_group("go_era_sites")
	_build_shipyard()
	_build_observatory()
	_build_old_station()
	_refresh_draft()

static func cell_pos(region: String, c: Vector2) -> Vector3:
	var p := TestMap.world_pos(c.x, c.y, region)
	p.y = TerrainBuilder.height_at(region, p)
	return p

## 떠 있는 관측대 윗면 한가운데(월드).
static func obs_top() -> Vector3:
	return cell_pos("ruins", RIFT_CELL) + Vector3(0, OBS_RISE, 0)

static func draft_base() -> Vector3:
	var p := cell_pos("ruins", RIFT_CELL) + DRAFT_OFF
	p.y = TerrainBuilder.height_at("ruins", p)
	return p

## 관측대 윗면 위에 서 있는가(가로 반지름 안·윗면 근처).
static func on_obs(p: Vector3, slack := 1.5) -> bool:
	var c := obs_top()
	return Vector2(p.x - c.x, p.z - c.z).length() <= OBS_R and p.y >= c.y - slack and p.y <= c.y + 6.0

## 14장 석등을 켰거나 지났는가 — 시간 기둥이 선다(끝난 뒤에도 남아 다시 오를 수 있다).
static func draft_open() -> bool:
	var ch := int(PartyState.story.get("ch", 0))
	return ch > CH14 or (ch == CH14 and int(PartyState.story.get("step", 0)) >= DRAFT_FROM_STEP)

func draft_active() -> bool:
	return _draft != null and _draft.visible

func _refresh_draft() -> void:
	if _draft:
		_draft.visible = draft_open()
	if _horse:
		_horse.visible = horse_home()

## 마구간 역마가 제자리에 있는가 — 15장 쫓기(story_quest chase 가 따로 달리는 말을 세운다) 동안만 비운다.
static func horse_home() -> bool:
	return not (int(PartyState.story.get("ch", 0)) == CH15 and int(PartyState.story.get("step", 0)) == HORSE_AWAY_STEP)

## 시간 기둥 안 공중이면 솟는다(go_player.gd updraft — 땅에 서 있으면 안 뜬다, 뛰어오르면 탄다).
func _physics_process(_delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		return
	_refresh_draft()
	if not draft_active() or not _player.has_method("updraft"):
		return
	var b := draft_base()
	var pp := _player.global_position
	if Vector2(pp.x - b.x, pp.z - b.z).length() <= DRAFT_R and pp.y >= b.y - 1.0 and pp.y <= obs_top().y + DRAFT_OVER:
		_player.call("updraft", DRAFT_VY)

## 기중기 들보 윗면 한가운데(월드).
static func crane_top() -> Vector3:
	return cell_pos("coast", SHIPYARD_CELL) + Vector3(0, CRANE_TOP, -2.0)

func _build_shipyard() -> void:
	var root := Node3D.new()
	root.name = "Shipyard"
	add_child(root)
	root.position = cell_pos("coast", SHIPYARD_CELL)
	## 콘크리트 바닥 — 물가까지(북쪽 -z 가 바다).
	_solid_box(root, Vector3(18.0, 0.3, 14.0), Vector3(0, 0.15, 3.0), CONCRETE)
	## 선대 — 바닥 끝에서 바다로 내려가는 비탈(두 줄 레일).
	var slip := Node3D.new()
	slip.position = Vector3(0, -0.9, -14.0)
	slip.rotation.x = deg_to_rad(-9.0)
	root.add_child(slip)
	_box(slip, Vector3(8.0, 0.3, 18.0), Vector3.ZERO, CONCRETE.darkened(0.15))
	for x in [-2.2, 2.2]:
		_box(slip, Vector3(0.25, 0.25, 18.0), Vector3(x, 0.25, 0), RUST_DARK)
	## 짓다 만 배 — 용골 하나와 녹슨 늑골 여섯(선대 위, 뱃머리가 바다 쪽).
	_box(root, Vector3(0.5, 0.5, 11.0), Vector3(0, 0.55, -1.0), RUST_DARK)
	for k in 6:
		var z := -5.5 + k * 2.0
		var half_w := 2.6 - absf(k - 2.5) * 0.35
		for side in [-1.0, 1.0]:
			var rib := _box(root, Vector3(0.22, 3.2, 0.22), Vector3(side * half_w * 0.72, 2.0, z), RUST)
			rib.rotation.z = side * deg_to_rad(-22.0)
	_box(root, Vector3(4.6, 0.25, 3.0), Vector3(0, 3.4, 2.2), HULL_GRAY) # 반쯤 붙인 갑판 한 장
	## 문형 기중기 — 다리 둘(바깥면 = 들보 끝면, 타고 오른다)·들보·운전실·걸린 갈고리.
	for side in [-1.0, 1.0]:
		var leg_x: float = side * (CRANE_HALF - 0.6)
		_solid_box(root, Vector3(1.2, CRANE_TOP - 1.0, 1.2), Vector3(leg_x, (CRANE_TOP - 1.0) * 0.5, -2.0), CRANE_PAINT)
		for y in [3.0, 6.0, 9.0]:
			_box(root, Vector3(1.3, 0.12, 1.3), Vector3(leg_x, y, -2.0), RUST) # 녹슨 띠
	_solid_box(root, Vector3(CRANE_HALF * 2.0, 1.0, 1.6), Vector3(0, CRANE_TOP - 0.5, -2.0), CRANE_PAINT)
	_solid_box(root, Vector3(2.0, 1.6, 1.8), Vector3(3.2, CRANE_TOP - 1.8, -2.0), Color(0.72, 0.74, 0.7))
	_box(root, Vector3(0.06, 5.0, 0.06), Vector3(-1.5, CRANE_TOP - 3.5, -2.0), Color(0.2, 0.2, 0.22)) # 쇠줄
	_box(root, Vector3(0.6, 0.5, 0.3), Vector3(-1.5, CRANE_TOP - 6.2, -2.0), RUST_DARK) # 갈고리
	## 창고 — 골함석 지붕(남동쪽).
	_solid_box(root, Vector3(6.0, 3.4, 5.0), Vector3(7.5, 1.7, 9.0), Color(0.58, 0.5, 0.42))
	var roof := _box(root, Vector3(6.6, 0.2, 5.6), Vector3(7.5, 3.6, 9.0), RUST)
	roof.rotation.z = deg_to_rad(6.0)
	## 드럼통·쇠판 더미.
	for i in 3:
		var drum := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.4
		cm.bottom_radius = 0.4
		cm.height = 0.9
		drum.mesh = cm
		drum.material_override = _mat([RUST, Color(0.25, 0.4, 0.55), RUST_DARK][i])
		drum.position = Vector3(-7.0 + i * 0.9, 0.75, 8.5)
		root.add_child(drum)
	_box(root, Vector3(2.4, 0.6, 1.6), Vector3(-6.5, 0.6, 5.5), HULL_GRAY)
	_label(root, "녹슨 조선소", Vector3(0, CRANE_TOP + 2.2, -2.0), Color(1.0, 0.86, 0.6))
	_add_discovery("coast_shipyard", root.position, DISCOVER_R)

func _build_observatory() -> void:
	var root := Node3D.new()
	root.name = "RiftObservatory"
	add_child(root)
	root.position = cell_pos("ruins", RIFT_CELL)
	## 땅 — 탑이 뽑혀 나간 육각 쇠 바닥(얇은 판, 충돌 없음 — 석등·제단이 땅 높이에 선다) + 부서진 기둥 여섯.
	var floor_mi := MeshInstance3D.new()
	var fm := CylinderMesh.new()
	fm.top_radius = PILLAR_R + 0.8
	fm.bottom_radius = PILLAR_R + 0.8
	fm.height = 0.08
	fm.radial_segments = 6
	floor_mi.mesh = fm
	floor_mi.material_override = _mat(ALLOY_DARK)
	floor_mi.position = Vector3(0, 0.02, 0)
	root.add_child(floor_mi)
	var heights := [3.8, 1.6, 2.9, 1.2, 4.4, 2.2]
	for i in 6:
		var a := TAU * i / 6.0
		var h: float = heights[i]
		var pos := Vector3(cos(a), 0.0, sin(a)) * PILLAR_R
		_solid_box(root, Vector3(0.9, h, 0.9), pos + Vector3(0, h * 0.5, 0), ALLOY)
		_box(root, Vector3(1.0, 0.1, 1.0), pos + Vector3(0, h * 0.6, 0), RIFT_GLOW.darkened(0.3)) # 빛 띠
	## 틈 — 관측대 밑 허공에 선 보랏빛 금(충돌 없음). 둘레를 느리게 도는 고리 둘.
	var rift := MeshInstance3D.new()
	var rs := SphereMesh.new()
	rs.radius = 1.6
	rs.height = 6.0
	rs.radial_segments = 16
	rs.rings = 8
	rift.mesh = rs
	rift.material_override = _glow(RIFT_GLOW, 0.55)
	rift.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	rift.scale = Vector3(1.0, 1.0, 0.18)
	rift.position = Vector3(0, 10.0, 0)
	root.add_child(rift)
	var ring := TorusMesh.new()
	ring.inner_radius = 2.6
	ring.outer_radius = 2.8
	for k in 2:
		var rm := MeshInstance3D.new()
		rm.mesh = ring
		rm.material_override = _glow(RIFT_GLOW.lightened(0.2), 0.5)
		rm.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		rm.position = Vector3(0, 10.0, 0)
		rm.rotation = Vector3(deg_to_rad(70.0 + 40.0 * k), 0.0, deg_to_rad(20.0 * k))
		root.add_child(rm)
		var tw := rm.create_tween().set_loops()
		tw.tween_property(rm, "rotation:y", TAU * (1.0 if k == 0 else -1.0), 9.0 + 4.0 * k).as_relative()
	## 떠 있는 관측대 — 쇠 원판(두께 1.0m) + 밑의 거꾸로 선 쇠 뿔(충돌 볼록) + 난간 + 북쪽 관측경 돔.
	var body := StaticBody3D.new()
	body.name = "ObsDeck"
	body.collision_layer = 1
	body.position = Vector3(0, OBS_RISE, 0)
	root.add_child(body)
	var top := CylinderMesh.new()
	top.top_radius = OBS_R
	top.bottom_radius = OBS_R - 0.6
	top.height = 1.0
	top.radial_segments = 24
	var top_mi := MeshInstance3D.new()
	top_mi.mesh = top
	top_mi.material_override = _mat(ALLOY)
	top_mi.position = Vector3(0, -0.5, 0)
	body.add_child(top_mi)
	var ts := CylinderShape3D.new()
	ts.radius = OBS_R
	ts.height = 1.0
	var tcs := CollisionShape3D.new()
	tcs.shape = ts
	tcs.position = Vector3(0, -0.5, 0)
	body.add_child(tcs)
	var cone := CylinderMesh.new()
	cone.top_radius = OBS_R - 0.6
	cone.bottom_radius = 0.8
	cone.height = 6.0
	cone.radial_segments = 12
	cone.rings = 1
	var cone_mi := MeshInstance3D.new()
	cone_mi.mesh = cone
	cone_mi.material_override = _mat(ALLOY_DARK)
	cone_mi.position = Vector3(0, -4.0, 0)
	body.add_child(cone_mi)
	var ccs := CollisionShape3D.new()
	ccs.shape = cone.create_convex_shape()
	ccs.position = Vector3(0, -4.0, 0)
	body.add_child(ccs)
	## 윗면 빛줄 고리(장식) — 가장자리 안쪽 청록 띠.
	var inlay := TorusMesh.new()
	inlay.inner_radius = OBS_R - 1.6
	inlay.outer_radius = OBS_R - 1.35
	inlay.rings = 32
	var inlay_mi := MeshInstance3D.new()
	inlay_mi.mesh = inlay
	inlay_mi.material_override = _glow(DRAFT_GLOW, 0.7)
	inlay_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	inlay_mi.scale = Vector3(1.0, 0.1, 1.0)
	inlay_mi.position = Vector3(0, 0.02, 0)
	body.add_child(inlay_mi)
	## 난간 — 보이는 쇠 고리 하나 + 기둥 여덟, 충돌은 상자 열여섯 조각(sky_isle.gd 와 같은 틀).
	var rim := TorusMesh.new()
	rim.inner_radius = OBS_R - 0.6
	rim.outer_radius = OBS_R - 0.25
	rim.rings = 32
	var rim_mi := MeshInstance3D.new()
	rim_mi.mesh = rim
	rim_mi.material_override = _mat(ALLOY_DARK)
	rim_mi.scale = Vector3(1.0, 1.4, 1.0)
	rim_mi.position = Vector3(0, OBS_RIM_H * 0.55, 0)
	body.add_child(rim_mi)
	for i in 8:
		var a := TAU * i / 8.0
		_box(body, Vector3(0.4, OBS_RIM_H + 0.4, 0.4), Vector3(cos(a), 0.0, sin(a)) * (OBS_R - 0.42) + Vector3.UP * (OBS_RIM_H + 0.4) * 0.5, ALLOY)
	var seg_n := 16
	var seg_len := TAU * (OBS_R - 0.42) / seg_n + 0.3
	for i in seg_n:
		var a := TAU * (i + 0.5) / seg_n
		var bs := BoxShape3D.new()
		bs.size = Vector3(seg_len, OBS_RIM_H, 0.4)
		var cs := CollisionShape3D.new()
		cs.shape = bs
		cs.position = Vector3(cos(a), 0.0, sin(a)) * (OBS_R - 0.42) + Vector3.UP * OBS_RIM_H * 0.5
		cs.rotation.y = -a + PI * 0.5
		body.add_child(cs)
	## 관측경 돔 — 북쪽 끝(싸움터 가운데를 비워 둔다). 둥근 벽(충돌) + 반구 지붕 + 하늘로 기운 망원경.
	var dome_at := Vector3(0, 0, -(OBS_R - 2.7))
	var drum := CylinderMesh.new()
	drum.top_radius = 1.8
	drum.bottom_radius = 1.8
	drum.height = 1.6
	drum.radial_segments = 16
	var drum_mi := MeshInstance3D.new()
	drum_mi.mesh = drum
	drum_mi.material_override = _mat(ALLOY)
	drum_mi.position = dome_at + Vector3(0, 0.8, 0)
	body.add_child(drum_mi)
	var dcs := CollisionShape3D.new()
	var dsh := CylinderShape3D.new()
	dsh.radius = 1.8
	dsh.height = 1.6
	dcs.shape = dsh
	dcs.position = dome_at + Vector3(0, 0.8, 0)
	body.add_child(dcs)
	var cap := MeshInstance3D.new()
	var cap_m := SphereMesh.new()
	cap_m.radius = 1.8
	cap_m.height = 1.8
	cap_m.is_hemisphere = true
	cap.mesh = cap_m
	cap.material_override = _mat(Color(0.9, 0.92, 0.95))
	cap.position = dome_at + Vector3(0, 1.6, 0)
	body.add_child(cap)
	var scope := MeshInstance3D.new()
	var sc := CylinderMesh.new()
	sc.top_radius = 0.28
	sc.bottom_radius = 0.4
	sc.height = 3.0
	scope.mesh = sc
	scope.material_override = _mat(ALLOY_DARK)
	scope.position = dome_at + Vector3(0, 2.7, 0.6)
	scope.rotation.x = deg_to_rad(-35.0)
	body.add_child(scope)
	var lens := MeshInstance3D.new()
	var lm := CylinderMesh.new()
	lm.top_radius = 0.3
	lm.bottom_radius = 0.3
	lm.height = 0.06
	lens.mesh = lm
	lens.material_override = _glow(DRAFT_GLOW, 0.85)
	lens.position = Vector3(0, 1.52, 0)
	scope.add_child(lens)
	_label(root, "시간 틈 관측소", Vector3(0, OBS_RISE + 5.2, 0), Color(0.78, 0.9, 1.0))
	_add_discovery("ruins_rift_observatory", root.position, DISCOVER_R)
	_build_draft()

func _build_old_station() -> void:
	var root := Node3D.new()
	root.name = "OldStation"
	add_child(root)
	root.position = cell_pos("village", STATION_CELL)
	## 돌담 — 서·북·남 세 변(0.9m, 동쪽 = 길 쪽이 트였다). 서쪽 변 뒤는 절벽.
	_solid_box(root, Vector3(0.7, 0.9, 12.0), Vector3(-9.0, 0.45, 0.0), FIELDSTONE)
	_solid_box(root, Vector3(6.0, 0.9, 0.7), Vector3(-6.0, 0.45, -6.0), FIELDSTONE)
	_solid_box(root, Vector3(6.0, 0.9, 0.7), Vector3(-6.0, 0.45, 6.0), FIELDSTONE)
	_box(root, Vector3(1.4, 0.35, 0.7), Vector3(-2.4, 0.18, 6.0), FIELDSTONE.darkened(0.15)) # 무너진 담 끝
	## 초가 마구간 — 기둥 넷 + 기운 초가 지붕(보이는 것만) + 구유.
	for x in [-8.2, -3.8]:
		for z in [-4.4, -0.6]:
			_solid_box(root, Vector3(0.28, 2.6, 0.28), Vector3(x, 1.3, z), TIMBER)
	var roof := _box(root, Vector3(5.6, 0.35, 4.8), Vector3(-6.0, 2.85, -2.5), THATCH)
	roof.rotation.x = deg_to_rad(8.0)
	_solid_box(root, Vector3(2.2, 0.55, 0.7), Vector3(-6.0, 0.28, -3.6), TIMBER.lightened(0.1)) # 구유
	## 역참 깃대 — 장대 + 붉은 천.
	_box(root, Vector3(0.16, 6.0, 0.16), Vector3(-3.0, 3.0, 4.2), TIMBER)
	var flag := _box(root, Vector3(0.04, 1.1, 1.6), Vector3(-3.0, 5.2, 3.35), Color(0.72, 0.16, 0.14))
	flag.rotation.x = deg_to_rad(4.0)
	## 역마 — 마구간 앞(코드 몸 말, 앞 = +Z 를 길 쪽으로).
	_horse = CreatureBuilder.build("horse", [Color(0.42, 0.28, 0.18), Color(0.16, 0.12, 0.1), Color(0.1, 0.08, 0.06)])
	_horse.name = "StationHorse"
	_horse.position = Vector3(-5.2, 0.0, 1.6)
	_horse.rotation.y = PI * 0.5
	root.add_child(_horse)
	## 골짜기 북쪽 어귀 돌장승 둘 — 길 양쪽 가장자리.
	for cx in [4.58, 5.38]:
		var jp := cell_pos("village", Vector2(cx, 8.3))
		var pole := Node3D.new()
		pole.name = "Jangseung"
		add_child(pole)
		pole.position = jp
		_solid_box(pole, Vector3(0.7, 2.6, 0.7), Vector3(0, 1.3, 0), FIELDSTONE.lightened(0.08))
		_box(pole, Vector3(0.78, 0.5, 0.78), Vector3(0, 2.85, 0), FIELDSTONE.darkened(0.1)) # 머리 갓
		_box(pole, Vector3(0.5, 0.08, 0.05), Vector3(0, 2.1, 0.37), Color(0.2, 0.18, 0.16)) # 눈썹
		_box(pole, Vector3(0.3, 0.1, 0.05), Vector3(0, 1.55, 0.37), Color(0.55, 0.16, 0.12)) # 입
	_label(root, "옛 역참 터", Vector3(-6.0, 4.6, 0.0), Color(1.0, 0.86, 0.62))
	_add_discovery("village_old_road", root.position, DISCOVER_R)

## 시간 기둥 — 빛 원기둥 + 밑에서 위로 흘러가는 고리 넷(sky_isle.gd 바람 기둥과 같은 결, 빛깔만 청백).
func _build_draft() -> void:
	_draft = Node3D.new()
	_draft.name = "TimeDraft"
	add_child(_draft)
	var b := draft_base()
	_draft.position = b
	var h := obs_top().y + DRAFT_OVER - b.y
	var col := CylinderMesh.new()
	col.top_radius = DRAFT_R
	col.bottom_radius = DRAFT_R
	col.height = h
	col.radial_segments = 20
	col.rings = 1
	col.cap_top = false
	col.cap_bottom = false
	var col_mi := MeshInstance3D.new()
	col_mi.mesh = col
	col_mi.material_override = _glow(DRAFT_GLOW, 0.1)
	col_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	col_mi.position = Vector3.UP * h * 0.5
	_draft.add_child(col_mi)
	var ring := TorusMesh.new()
	ring.inner_radius = DRAFT_R - 0.35
	ring.outer_radius = DRAFT_R
	var rm := _glow(DRAFT_GLOW.lightened(0.3), 0.45)
	for i in 4:
		var mi := MeshInstance3D.new()
		mi.mesh = ring
		mi.material_override = rm
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.scale = Vector3(1.0, 0.2, 1.0)
		var from := h * i / 4.0
		mi.position = Vector3.UP * from
		_draft.add_child(mi)
		var tw := mi.create_tween().set_loops()
		tw.tween_property(mi, "position:y", h, (h - from) / 12.0)
		tw.tween_property(mi, "position:y", 0.0, 0.0)
		tw.tween_property(mi, "position:y", from, maxf(from / 12.0, 0.05))

# ---------------------------------------------------------------- 도우미(region4_frost.gd 와 같은 결)

func _mat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	return m

func _glow(c: Color, alpha: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(c.r, c.g, c.b, alpha)
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m

func _box(parent: Node3D, size: Vector3, pos: Vector3, color: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	PropMaterial.apply_box(mi, size, color) # 09-29 돌 결·모서리 선 셀 재질(prop_material.gd)
	mi.position = pos
	parent.add_child(mi)
	return mi

func _solid_box(parent: Node3D, size: Vector3, pos: Vector3, color: Color) -> void:
	_box(parent, size, pos, color)
	var body := StaticBody3D.new()
	body.position = pos
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	body.add_child(cs)
	parent.add_child(body)

func _label(parent: Node3D, text: String, pos: Vector3, color: Color) -> void:
	var l := Label3D.new()
	l.text = text
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.font_size = 44
	l.outline_size = 8
	l.pixel_size = 0.008
	l.modulate = color
	l.position = pos
	parent.add_child(l)

func _add_discovery(codex_id: String, pos: Vector3, radius: float) -> void:
	var area := Area3D.new()
	area.name = "Discover_" + codex_id
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = radius
	cs.shape = shape
	area.add_child(cs)
	area.position = pos
	area.add_to_group("codex_discoverable")
	add_child(area)
	area.body_entered.connect(func(body: Node3D) -> void:
		if body.is_in_group("player"):
			CodexState.discover("place", codex_id))
