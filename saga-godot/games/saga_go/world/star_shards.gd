extends Node3D

## PLAN 106장 ⑪ — 원신식 수집 구슬("눈동자" 문법)과 신상 봉헌. 이름은 이 판 것: 별조각.
##   세 지역에 20개 — 산꼭대기·물 위·나무 위처럼 이동(등반·수영·점프·활공)을 써야 닿는 자리.
##   1.6m 안에 들면 줍는다(EventState `shard_<id>`). 신상(waypoints.gd) 둘레 6m 에 서면 가진 별조각을
##   저절로 바친다(`shardgive_<id>`). 두 개마다 신상 Lv +1 → 스태미나 상한 +8 + 냥 1000·짧은 견문록 2.
## 세이브 스키마는 그대로(EventState 항목만 는다). test_village.gd 가 로드 뒤에 짓는다 —
## 여기 _ready 가 플레이어 스태미나 상한을 앉힌다(go_player._ready 는 로드 전에 돈다).

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Waypoints := preload("res://games/saga_go/world/waypoints.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const GoPlayer := preload("res://games/saga_go/player/go_player.gd")

signal changed()

const PICK_M := 1.6
const OFFER_M := 6.0
const PER_LEVEL := 2
const STAMINA_PER_LEVEL := 8.0
const LEVEL_REWARD := {"mora": 1000, "book_s": 2, "fate_knot": 1} # 인연 매듭 — 운명의 자리(106장 ⑫)
const COLOR := Color(0.55, 0.9, 1.0)

## [id, 지역, 칸(소수), 자리] — 자리: "peak" 산꼭대기 위 1.2m · "water" 수면 위 0.6m · "air" 땅에서 2.6m
const SHARDS := [
	["v_peak_n", "village", Vector2(3.0, 1.0), "peak"],
	["v_peak_ne", "village", Vector2(7.0, 2.0), "peak"],
	["v_peak_w", "village", Vector2(2.0, 3.0), "peak"],
	["v_peak_sw", "village", Vector2(1.0, 8.0), "peak"],
	["v_peak_se", "village", Vector2(8.0, 8.0), "peak"],
	["v_peak_s", "village", Vector2(4.0, 9.0), "peak"],
	["v_river", "village", Vector2(2.0, 7.0), "water"],
	["v_grove", "village", Vector2(9.0, 4.0), "air"],
	["c_peak_w", "coast", Vector2(0.0, 3.0), "peak"],
	["c_peak_e", "coast", Vector2(8.0, 6.0), "peak"],
	["c_peak_s", "coast", Vector2(3.0, 8.0), "peak"],
	["c_peak_se", "coast", Vector2(6.0, 8.0), "peak"],
	["c_sea_w", "coast", Vector2(2.0, 2.0), "water"],
	["c_sea_e", "coast", Vector2(7.0, 3.0), "water"], # 106장 ㊲ (6,2) 가 바위섬이 돼 옆 바다 칸으로
	["c_dune", "coast", Vector2(5.0, 6.0), "air"],
	["r_peak_w", "ruins", Vector2(0.0, 2.0), "peak"],
	["r_peak_e", "ruins", Vector2(6.0, 5.0), "peak"],
	["r_peak_s", "ruins", Vector2(2.0, 6.0), "peak"],
	["r_tree_sw", "ruins", Vector2(2.0, 4.0), "air"],
	["r_tree_ne", "ruins", Vector2(4.0, 2.0), "air"],
	## 106장 ㊺ 서리봉 고원
	["f_peak_nw", "frost", Vector2(1.0, 1.0), "peak"],
	["f_peak_e", "frost", Vector2(8.0, 5.0), "peak"],
	["f_tree_ne", "frost", Vector2(7.0, 2.0), "air"],
	## 106장 ㊽ 은하 나루
	["s_peak_w", "skyport", Vector2(0.0, 4.0), "peak"],
	["s_peak_se", "skyport", Vector2(8.0, 6.0), "peak"],
	["s_tree_e", "skyport", Vector2(7.0, 4.0), "air"],
	## 106장 ㊾ 틈새 갈림길
	["x_peak_w", "crossing", Vector2(0.0, 3.0), "peak"],
	["x_peak_se", "crossing", Vector2(8.0, 6.0), "peak"],
	["x_tree_e", "crossing", Vector2(7.0, 3.0), "air"],
	## 106장 ㊿ 잠긴 도읍
	["u_peak_w", "sunken", Vector2(0.0, 5.0), "peak"],
	["u_peak_s", "sunken", Vector2(4.0, 8.0), "peak"],
	["u_sea", "sunken", Vector2(3.0, 6.0), "water"],
	## 106장 53 굳은 거리
	["a_peak_n", "amber", Vector2(2.0, 0.0), "peak"],
	["a_peak_e", "amber", Vector2(8.0, 5.0), "peak"],
	["a_air_cross", "amber", Vector2(5.2, 5.0), "air"],
	## 106장 54 갈무리 벌
	["g_peak_ne", "vault", Vector2(8.0, 1.0), "peak"],
	["g_peak_w", "vault", Vector2(0.0, 6.0), "peak"],
	["g_air_vault", "vault", Vector2(4.0, 3.0), "air"],
]

var _nodes: Dictionary = {} # id → MeshInstance3D
var _player: Node3D = null
var _offer_t := 0.0

func _ready() -> void:
	add_to_group("go_star_shards")
	for row in SHARDS:
		if not EventState.is_resolved("shard_" + String(row[0])):
			_build(row)
	_player = get_tree().get_first_node_in_group("player")
	apply_stamina()

## 아직 안 주운 별조각 자리(원소 시야 106장 ⑬ 이 짚는다).
func remaining_positions() -> Array[Vector3]:
	var out: Array[Vector3] = []
	for id in _nodes:
		out.append((_nodes[id] as Node3D).global_position)
	return out

static func total() -> int:
	return SHARDS.size()

static func collected() -> int:
	return _count("shard_")

static func offered() -> int:
	return _count("shardgive_")

static func _count(prefix: String) -> int:
	var n := 0
	for key in EventState.resolved:
		if key.begins_with(prefix):
			n += 1
	return n

static func statue_level() -> int:
	return floori(float(offered()) / PER_LEVEL)

static func stamina_bonus() -> float:
	return statue_level() * STAMINA_PER_LEVEL

static func in_region(rid: String) -> Array:
	return SHARDS.filter(func(row: Array) -> bool: return row[1] == rid)

static func pos_of(row: Array) -> Vector3:
	var region: String = row[1]
	var g: Vector2 = row[2]
	var p := TestMap.world_pos(g.x, g.y, region)
	match row[3]:
		"peak": p.y = TerrainBuilder.height_at(region, p) + 1.2
		"water": p.y = TerrainBuilder.WATER_LEVEL + 0.6
		_: p.y = TerrainBuilder.height_at(region, p) + 2.6
	return p

func apply_stamina() -> void:
	if _player == null:
		return
	var m: float = GoPlayer.STAMINA_MAX + stamina_bonus()
	_player.set("stamina_max", m)
	if float(_player.get("stamina")) > m:
		_player.set("stamina", m)

func _build(row: Array) -> void:
	var mi := MeshInstance3D.new()
	mi.name = "Shard_" + String(row[0])
	var m := SphereMesh.new()
	m.radius = 0.28
	m.height = 0.56
	m.radial_segments = 6
	m.rings = 3
	mi.mesh = m
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = COLOR
	mat.emission_enabled = true
	mat.emission = COLOR
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.global_position = pos_of(row)
	## 옅은 빛무리 — 멀리서도 보이게.
	var halo := MeshInstance3D.new()
	var hm := SphereMesh.new()
	hm.radius = 0.6
	hm.height = 1.2
	halo.mesh = hm
	var hmat := StandardMaterial3D.new()
	hmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	hmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	hmat.albedo_color = Color(COLOR.r, COLOR.g, COLOR.b, 0.18)
	halo.material_override = hmat
	halo.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.add_child(halo)
	var tw := mi.create_tween().set_loops()
	tw.tween_property(mi, "position:y", mi.position.y + 0.25, 1.1).set_trans(Tween.TRANS_SINE)
	tw.tween_property(mi, "position:y", mi.position.y, 1.1).set_trans(Tween.TRANS_SINE)
	var spin := mi.create_tween().set_loops()
	spin.tween_property(mi, "rotation:y", TAU, 3.0).from(0.0)
	_nodes[row[0]] = mi

func _physics_process(delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		return
	var p := _player.global_position + Vector3.UP * 0.9
	for id in _nodes.keys():
		var mi: MeshInstance3D = _nodes[id]
		if p.distance_to(mi.global_position) <= PICK_M:
			pick(id)
	_offer_t -= delta
	if _offer_t <= 0.0:
		_offer_t = 0.5
		var wps := get_tree().get_first_node_in_group("go_waypoints")
		if wps and collected() > offered():
			for row in Waypoints.POINTS:
				if row[3] and _player.global_position.distance_to(wps.call("world_pos_of", row[0])) <= OFFER_M:
					offer()
					break

func pick(id: String) -> void:
	if not _nodes.has(id):
		return
	var mi: MeshInstance3D = _nodes[id]
	EventState.mark_resolved("shard_" + id)
	CombatFeel.pickup(mi, "별조각")
	_nodes.erase(id)
	mi.queue_free()
	Toast.show(self, "별조각 %d/%d — 신상에 바치면 스태미나가 는다" % [collected(), total()], 2.5)
	changed.emit()

## 주운 별조각을 신상에 모두 바친다. 오른 신상 레벨 수를 돌려준다.
func offer() -> int:
	var before := statue_level()
	var n := 0
	for row in SHARDS:
		var id: String = row[0]
		if EventState.is_resolved("shard_" + id) and not EventState.is_resolved("shardgive_" + id):
			EventState.mark_resolved("shardgive_" + id)
			n += 1
	if n == 0:
		return 0
	var up := statue_level() - before
	for i in up:
		PartyState.add_items(LEVEL_REWARD)
	apply_stamina()
	var msg := "신상에 별조각 %d개를 바쳤다 — 신상 Lv.%d" % [n, statue_level()]
	if up > 0:
		msg += " · 스태미나 상한 %d · 냥 %d·짧은 견문록 %d·인연 매듭 %d" % [int(_player.get("stamina_max")), LEVEL_REWARD.mora * up, LEVEL_REWARD.book_s * up, LEVEL_REWARD.fate_knot * up]
	Toast.show(self, msg, 3.5)
	changed.emit()
	return up
