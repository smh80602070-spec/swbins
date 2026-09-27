extends Node3D

## PLAN 106장 ⑨ — 원신식 순간이동 지점과 신상. test_village.gd 가 한 번 짓는다.
##   순간이동 지점: 가까이(ACTIVATE_M) 가면 활성화 → 지도(world_map.gd)에서 눌러 그 자리로 이동.
##   신상(지역마다 하나, 순간이동 지점을 겸함): 둘레 HEAL_M 안에 서 있거나 신상으로 순간이동하면
##   쓰러진 인물까지 모두 가득(field_combat.revive_all).
## 활성화는 EventState `wp_<id>` 로 남는다(보물 상자 `chest_<id>` 와 같은 자리 — 세이브 스키마 그대로).
## 모양은 코드로 그린다(creature_builder 셀 셰이더 재사용). 이름은 이 판 것.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const CreatureBuilder := preload("res://games/saga_go/world/creature_builder.gd")
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
		_cyl(root, 1.6, 1.9, 0.5, Vector3(0, 0.25, 0), STATUE_STONE)
		_cyl(root, 1.1, 1.3, 0.4, Vector3(0, 0.7, 0), STATUE_STONE.darkened(0.1))
		CreatureBuilder._capsule(root, 0.45, 2.6, Vector3(0, 2.2, 0), Vector3.ZERO, STATUE_STONE.lightened(0.1))
		CreatureBuilder._sphere(root, 0.38, Vector3(0, 3.75, 0), STATUE_STONE.lightened(0.15))
		## 두 팔을 앞으로 모아 구슬을 받든 모양.
		CreatureBuilder._capsule(root, 0.14, 1.1, Vector3(-0.35, 2.6, 0.4), Vector3(70, 0, 20), STATUE_STONE.lightened(0.1))
		CreatureBuilder._capsule(root, 0.14, 1.1, Vector3(0.35, 2.6, 0.4), Vector3(70, 0, -20), STATUE_STONE.lightened(0.1))
		gem = CreatureBuilder._sphere(root, 0.3, Vector3(0, 2.75, 0.85), INACTIVE, false)
		var halo := TorusMesh.new()
		halo.inner_radius = 0.55
		halo.outer_radius = 0.65
		CreatureBuilder._add(root, halo, Vector3(0, 3.8, -0.15), Vector3(90, 0, 0), STATUE_GOLD, false)
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
	label.position = Vector3(0, 4.6 if statue else 3.7, 0)
	label.visible = false
	root.add_child(label)
	_nodes[id] = {"root": root, "gem": gem, "pos": pos, "statue": statue, "region": region, "name": row[4], "label": label}
	_paint(id)

func _cyl(p: Node3D, top: float, bottom: float, h: float, pos: Vector3, color: Color) -> void:
	var m := CylinderMesh.new()
	m.top_radius = top
	m.bottom_radius = bottom
	m.height = h
	m.radial_segments = 10
	CreatureBuilder._add(p, m, pos, Vector3.ZERO, color, true)

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
	var target: Vector3 = n.pos + Vector3(0.0, 0.4, 2.2)
	_player.global_position = target
	_player.set("velocity", Vector3.ZERO)
	if _player.has_method("respawn_safe"):
		_player.set("_last_safe", target)
	if n.statue:
		heal_at_statue()
	Toast.show(self, "순간이동 — %s" % n.name, 2.0)
	return true
