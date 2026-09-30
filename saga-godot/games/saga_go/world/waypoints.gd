extends Node3D

## PLAN 106장 ⑨ — 원신식 순간이동 지점과 신상. test_village.gd 가 한 번 짓는다.
##   순간이동 지점: 가까이(ACTIVATE_M) 가면 활성화 → 지도(world_map.gd)에서 눌러 그 자리로 이동.
##   신상(지역마다 하나, 순간이동 지점을 겸함): 둘레 HEAL_M 안에 서 있거나 신상으로 순간이동하면
##   쓰러진 인물까지 모두 가득(field_combat.revive_all).
## 활성화는 EventState `wp_<id>` 로 남는다(보물 상자 `chest_<id>` 와 같은 자리 — 세이브 스키마 그대로).
## 모양은 코드로 그린다(creature_builder 셀 셰이더 재사용). 이름은 이 판 것.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const CreatureBuilder := preload("res://saga_core/world/creature_builder.gd")
const HouseBuilder := preload("res://games/saga_go/world/house_builder.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

signal activated(id: String)

const ACTIVATE_M := 5.0
const HEAL_M := 6.0
const HEAL_EVERY := 1.0

## [id, 지역, 칸(소수), 신상?, 이름]
const POINTS := [
	["v_statue", "village", Vector2(6.3, 4.3), true, "마을 신상"],
	["v_station", "village", Vector2(5.35, 3.0), false, "역참 앞"],
	["v_bridge", "village", Vector2(6.2, 6.4), false, "남쪽 다리목"],
	["c_dock", "coast", Vector2(4.4, 4.3), true, "포구 신상"],
	["c_pass", "coast", Vector2(1.3, 5.2), false, "서쪽 고개"],
	["c_isle", "coast", Vector2(5.95, 2.27), false, "앞바다 바위섬"], # 106장 ㊲ — 8장 배 댄 자리 곁(내리면 켜짐), 헤엄쳐 와도 된다
	["r_statue", "ruins", Vector2(3.5, 3.0), true, "폐허 신상"],
	["r_gate", "ruins", Vector2(3.3, 1.3), false, "폐허 어귀"],
	## 106장 ㊺ 서리봉 고원 — 고개 어귀·가운데 신상·북쪽 기상 관측소 곁.
	["f_pass", "frost", Vector2(4.35, 7.25), false, "서리 고개"],
	["f_statue", "frost", Vector2(5.0, 4.5), true, "고원 신상"],
	["f_observatory", "frost", Vector2(3.4, 1.35), false, "기상 관측소"],
	## 106장 ㊽ 은하 나루 — 틈 고개 안쪽·가운데 신상·별배 나루 곁.
	["s_pass", "skyport", Vector2(7.3, 3.05), false, "틈 고개"],
	["s_statue", "skyport", Vector2(4.4, 4.0), true, "나루 신상"],
	["s_port", "skyport", Vector2(4.35, 1.35), false, "별배 나루"],
	## 106장 ㊾ 틈새 갈림길 — 첫 정거장 곁·갈림목 신상·섬돌 곁.
	["x_stop", "crossing", Vector2(4.6, 1.1), false, "첫 정거장"],
	["x_statue", "crossing", Vector2(4.0, 3.6), true, "갈림길 신상"],
	["x_stones", "crossing", Vector2(4.1, 7.1), false, "떠 있는 섬돌"],
	## 106장 ㊿ 잠긴 도읍 — 고개 어귀·모래밭 신상·등대 바위섬(헤엄쳐 와야 켜진다).
	["u_pass", "sunken", Vector2(1.6, 1.25), false, "도읍 어귀"],
	["u_statue", "sunken", Vector2(4.0, 2.4), true, "도읍 신상"],
	["u_light", "sunken", Vector2(6.8, 6.82), false, "옛 등대"],
	## 106장 53 굳은 거리 — 고개 어귀·장터 곁 신상·부양탑 발치.
	["a_pass", "amber", Vector2(3.0, 6.6), false, "거리 어귀"],
	["a_statue", "amber", Vector2(2.5, 5.2), true, "거리 신상"],
	["a_tower", "amber", Vector2(5.2, 1.3), false, "부양탑 발치"],
	## 106장 54 갈무리 벌 — 고개 어귀·곳간 마을 곁 신상·금고 앞.
	["g_pass", "vault", Vector2(0.9, 3.0), false, "벌 어귀"],
	["g_statue", "vault", Vector2(2.6, 4.2), true, "벌 신상"],
	["g_vault", "vault", Vector2(4.0, 3.2), false, "금고 앞"],
	## 106장 55 세갈래 고을 — 성문 앞 어귀·대장간 곁 신상·세갈래 길목.
	["h_gate", "fork", Vector2(4.0, 7.2), false, "고을 어귀"],
	["h_statue", "fork", Vector2(2.8, 4.2), true, "고을 신상"],
	["h_junction", "fork", Vector2(4.7, 3.9), false, "세갈래 길목"],
]

const INACTIVE := Color(0.46, 0.5, 0.58)
const ACTIVE := Color(0.45, 0.95, 1.0)
const STATUE_STONE := Color(0.62, 0.6, 0.55)
const STATUE_GOLD := Color(0.95, 0.8, 0.4)
const STATUE_BASE_R := 2.5
const STATUE_TOP := 2.47 + 5.0

var _nodes: Dictionary = {} # id → {root, gem, pos, statue, region, name}
var _heal_t := 0.0
var _player: Node3D = null

func _ready() -> void:
	add_to_group("go_waypoints")
	for row in POINTS:
		_build(row)
	_player = get_tree().get_first_node_in_group("player")

static func point_ids() -> Array[String]:
	var out: Array[String] = []
	for row in POINTS:
		out.append(row[0])
	return out

static func row_of(id: String) -> Array:
	for row in POINTS:
		if row[0] == id:
			return row
	return []

static func is_active(id: String) -> bool:
	return EventState.is_resolved("wp_" + id)

func world_pos_of(id: String) -> Vector3:
	return _nodes[id].pos if _nodes.has(id) else Vector3.ZERO

func _build(row: Array) -> void:
	var id: String = row[0]
	var region: String = row[1]
	var g: Vector2 = row[2]
	var statue: bool = row[3]
	var pos := TestMap.world_pos(g.x, g.y, region)
	pos.y = TerrainBuilder.height_at(region, pos)
	var root := Node3D.new()
	root.name = "Waypoint_" + id
	add_child(root)
	root.global_position = pos
	var gem: MeshInstance3D
	if statue:
		gem = _build_statue(root)
	else:
		_cyl(root, 0.9, 1.1, 0.35, Vector3(0, 0.17, 0), STATUE_STONE)
		var pillar := BoxMesh.new()
		pillar.size = Vector3(0.38, 2.0, 0.38)
		CreatureBuilder._add(root, pillar, Vector3(0, 1.35, 0), Vector3(0, 45, 0), STATUE_STONE.lightened(0.05), true)
		var diamond := SphereMesh.new()
		diamond.radius = 0.32
		diamond.height = 0.9
		diamond.radial_segments = 4
		diamond.rings = 2
		gem = CreatureBuilder._add(root, diamond, Vector3(0, 2.9, 0), Vector3.ZERO, INACTIVE, false)
	## 보석은 천천히 돌고 오르내린다(활성화되면 빛색).
	var tw := gem.create_tween().set_loops()
	tw.tween_property(gem, "position:y", gem.position.y + 0.18, 1.2).set_trans(Tween.TRANS_SINE)
	tw.tween_property(gem, "position:y", gem.position.y, 1.2).set_trans(Tween.TRANS_SINE)
	var label := Label3D.new()
	label.text = row[4]
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 48
	label.outline_size = 8
	label.pixel_size = 0.006
	label.position = Vector3(0, STATUE_TOP + 1.0 if statue else 3.7, 0)
	label.visible = false
	root.add_child(label)
	_nodes[id] = {"root": root, "gem": gem, "pos": pos, "statue": statue, "region": region, "name": row[4], "label": label}
	_paint(id)

## 2026-09-28 "그래픽 먼저" — 신상. 예전엔 캡슐 셋·공 둘(높이 4m)이라 멀리서 눈사람으로 보였다(창 모드 촬영).
## 원신 신상의 문법만 따른다: 금테 두른 팔각 계단 받침 위에 두건 쓴 망토 인물이 가슴 앞에 빛 구슬을 받쳐 들고,
## 등 뒤로 깃 날개가 펴지고, 머리 뒤에 금빛 고리. 몸·망토·두건은 옆모습 선을 돌려 만든 매끈한 몸(_lathe)이다. 높이 약 8.5m.
## 부품은 house_builder.gd 로 모아 메시 하나(정점색)로 합친다 — 따로 그리면 신상 하나에 draw call 60 가까이 늘었다(PERF 최댓값 276).
## 빛 구슬만 따로(활성화 때 색이 바뀐다 — _paint).
## 받침 반지름은 STATUE_BASE_R — 곁의 솥(kitchen.gd POT_OFFSET 3.8m)과 순간이동 착지(teleport)가 이 값 밖이다.
func _build_statue(root: Node3D) -> MeshInstance3D:
	var mb = HouseBuilder.new()
	var stone := STATUE_STONE.lightened(0.12)
	## 받침 — 팔각 세 단 + 금테.
	_cyl(mb, STATUE_BASE_R - 0.15, STATUE_BASE_R, 0.55, Vector3(0, 0.275, 0), STATUE_STONE, 8)
	_cyl(mb, STATUE_BASE_R - 0.1, STATUE_BASE_R - 0.1, 0.08, Vector3(0, 0.58, 0), STATUE_GOLD, 8)
	_cyl(mb, 1.85, 2.0, 0.5, Vector3(0, 0.87, 0), STATUE_STONE.darkened(0.06), 8)
	_cyl(mb, 1.25, 1.45, 1.1, Vector3(0, 1.67, 0), STATUE_STONE, 8)
	_cyl(mb, 1.5, 1.35, 0.25, Vector3(0, 2.345, 0), STATUE_STONE.lightened(0.05), 8)
	_cyl(mb, 1.46, 1.46, 0.07, Vector3(0, 2.2, 0), STATUE_GOLD, 8)
	var up := Vector3(0, 2.47, 0)
	## 망토(밑단이 퍼진 종 모양) → 허리 → 가슴 → 어깨 → 목. [반지름, 높이]
	mb.add_mesh(_lathe([[1.2, 0.0], [1.15, 0.25], [0.95, 1.1], [0.72, 2.0], [0.6, 2.55], [0.66, 3.05], [0.74, 3.45], [0.66, 3.7], [0.3, 3.85], [0.24, 4.0]], 14),
		Transform3D(Basis(), up), stone)
	## 허리띠.
	_cyl(mb, 0.63, 0.61, 0.12, up + Vector3(0, 2.5, 0), STATUE_GOLD, 14)
	## 머리 + 두건(뒤로 늘어진 고깔).
	mb.add_mesh(_ball(0.34), Transform3D(Basis(), up + Vector3(0, 4.3, 0.1)), stone.lightened(0.08))
	mb.add_mesh(_lathe([[0.0, 4.95], [0.2, 4.8], [0.42, 4.45], [0.46, 4.15], [0.42, 3.9], [0.3, 3.82]], 12),
		Transform3D(Basis(), up + Vector3(0, 0, -0.24)), stone.darkened(0.04))
	## 팔 — 어깨에서 가슴 앞으로 모아 구슬을 받든다(윗팔·아래팔·손).
	for side: float in [-1.0, 1.0]:
		var sh := up + Vector3(0.62 * side, 3.5, 0.0)
		var el := up + Vector3(0.62 * side, 2.8, 0.42)
		var hand := up + Vector3(0.26 * side, 2.95, 0.78)
		_limb(mb, sh, el, 0.19, stone)
		_limb(mb, el, hand, 0.16, stone)
		mb.add_mesh(_ball(0.15), Transform3D(Basis().scaled(Vector3(1.0, 0.7, 1.2)), hand), stone)
		## 날개 — 어깨 뒤에서 위·옆으로 펴진 깃 다섯.
		for k in 5:
			var t := float(k) / 4.0
			var ang := lerpf(18.0, 72.0, t) * side
			var flen := lerpf(2.9, 1.7, t)
			var feather := CapsuleMesh.new()
			feather.radius = 0.22
			feather.height = flen
			feather.radial_segments = 8
			feather.rings = 2
			var base := up + Vector3(0.35 * side, 3.55 - 0.18 * float(k), -0.45 - 0.05 * float(k))
			var dir := Vector3(sin(deg_to_rad(ang)), cos(deg_to_rad(ang)), -0.25).normalized()
			mb.add_mesh(feather, Transform3D(Basis(Quaternion(Vector3.UP, dir)).scaled(Vector3(1.0, 1.0, 0.28)), base + dir * flen * 0.5),
				stone.lightened(0.04 * float(k)))
	## 머리 뒤 금빛 고리.
	var halo := TorusMesh.new()
	halo.inner_radius = 0.68
	halo.outer_radius = 0.8
	halo.rings = 24          # 기본값(64×32 = 4천 삼각형)은 외곽선까지 두 번 그려 마을 평균이 3만 늘었다
	halo.ring_segments = 8
	mb.add_mesh(halo, Transform3D(Basis(Vector3.RIGHT, PI * 0.5), up + Vector3(0, 4.4, -0.42)), STATUE_GOLD)
	root.add_child(mb.to_instance("Statue", 0.03))
	## 받쳐 든 빛 구슬(활성화되면 빛색 — _paint).
	return CreatureBuilder._sphere(root, 0.36, up + Vector3(0, 3.1, 0.92), INACTIVE, false)

func _ball(r: float) -> SphereMesh:
	var m := SphereMesh.new()
	m.radius = r
	m.height = r * 2.0
	m.radial_segments = 12
	m.rings = 6
	return m

## 두 점 사이 캡슐 — 팔.
func _limb(mb, a: Vector3, b: Vector3, r: float, color: Color) -> void:
	var m := CapsuleMesh.new()
	m.radius = r
	m.height = a.distance_to(b) + r * 2.0
	m.radial_segments = 10
	m.rings = 3
	mb.add_mesh(m, Transform3D(Basis(Quaternion(Vector3.UP, (b - a).normalized())), (a + b) * 0.5), color)

## 옆모습 선 [[반지름, 높이], …] 을 Y 축으로 돌린 매끈한 몸.
func _lathe(profile: Array, seg: int) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in profile.size() - 1:
		var r0: float = profile[i][0]
		var y0: float = profile[i][1]
		var r1: float = profile[i + 1][0]
		var y1: float = profile[i + 1][1]
		for j in seg:
			var a0 := TAU * float(j) / float(seg)
			var a1 := TAU * float(j + 1) / float(seg)
			var q := [Vector3(cos(a0) * r0, y0, sin(a0) * r0), Vector3(cos(a1) * r0, y0, sin(a1) * r0),
				Vector3(cos(a1) * r1, y1, sin(a1) * r1), Vector3(cos(a0) * r1, y1, sin(a0) * r1)]
			for k in [0, 1, 2, 0, 2, 3]:
				st.add_vertex(q[k])
	st.index()
	st.generate_normals()
	return st.commit()

## 받침 팔각·띠 — 신상은 모은 메시(mb)로, 순간이동 지점은 따로 그린다(p 가 Node3D).
func _cyl_mesh(top: float, bottom: float, h: float, seg: int) -> CylinderMesh:
	var m := CylinderMesh.new()
	m.top_radius = top
	m.bottom_radius = bottom
	m.height = h
	m.radial_segments = seg
	m.rings = 0   # 곧은 옆면 — 기본 4단 가로 분할은 삼각형만 늘린다
	return m

func _cyl(p, top: float, bottom: float, h: float, pos: Vector3, color: Color, seg := 10) -> void:
	var m := _cyl_mesh(top, bottom, h, seg)
	if p is Node3D:
		CreatureBuilder._add(p, m, pos, Vector3.ZERO, color, true)
	else:
		p.add_mesh(m, Transform3D(Basis(), pos), color)

func _paint(id: String) -> void:
	var n: Dictionary = _nodes[id]
	var on := is_active(id)
	var mat: ShaderMaterial = (n.gem as MeshInstance3D).material_override
	mat.set_shader_parameter("albedo_tint", ACTIVE if on else INACTIVE)
	(n.label as Label3D).visible = on

func _physics_process(delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		return
	var p := _player.global_position
	for id in _nodes:
		var n: Dictionary = _nodes[id]
		if not is_active(id) and p.distance_to(n.pos) <= ACTIVATE_M:
			activate(id)
	_heal_t -= delta
	if _heal_t <= 0.0:
		_heal_t = HEAL_EVERY
		for id in _nodes:
			var n: Dictionary = _nodes[id]
			if n.statue and p.distance_to(n.pos) <= HEAL_M:
				heal_at_statue()
				break

func activate(id: String) -> void:
	if is_active(id):
		return
	EventState.mark_resolved("wp_" + id)
	_paint(id)
	CombatFeel.pickup(_nodes[id].root, "활성화")
	var n: Dictionary = _nodes[id]
	Toast.show(self, "%s 활성화 — 지도(M)에서 이곳으로 순간이동할 수 있다" % ("신상" if n.statue else "순간이동 지점"), 3.0)
	activated.emit(id)

## 신상 — 쓰러진 인물까지 모두 가득. 이미 다 가득이면 아무 말 없이.
func heal_at_statue() -> bool:
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	if fc == null:
		return false
	var hurt := false
	for rid in fc.call("roster"):
		if float(fc.call("hp_of", rid)) < float(fc.call("max_hp_of", rid)):
			hurt = true
	if not hurt:
		return false
	fc.call("revive_all")
	Toast.show(self, "신상의 빛 — 모두 회복했다", 2.0)
	return true

## 지도에서 누른 활성 지점으로. 신상이면 도착해서 회복. 이동했으면 true.
func teleport(id: String) -> bool:
	if not _nodes.has(id) or not is_active(id) or _player == null:
		return false
	var n: Dictionary = _nodes[id]
	## 신상은 받침(반지름 STATUE_BASE_R) 앞에 내린다 — 받침 안에 서지 않게.
	var target: Vector3 = n.pos + Vector3(0.0, 0.4, STATUE_BASE_R + 0.9 if n.statue else 2.2)
	_player.global_position = target
	_player.set("velocity", Vector3.ZERO)
	if _player.has_method("respawn_safe"):
		_player.set("_last_safe", target)
	if n.statue:
		heal_at_statue()
	Toast.show(self, "순간이동 — %s" % n.name, 2.0)
	return true
