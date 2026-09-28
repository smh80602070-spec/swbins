extends Node3D

## PLAN 106장 ㊺ — 넷째 지역 "서리봉 고원"(REGIONS["frost"], test_map.gd). 이야기 2부의 무대.
## 마을 북쪽 산길 어귀((5,0) 돌무더기)에서 고개 (4,8)을 넘어 걸어서 온다(106장 ⑤ 지역 잇기와 같은 원칙 — 한 좌표계).
## 이 파일이 짓는 것: 지형·식생(TerrainBuilder·VegetationBuilder region_id 인스턴스) · 고정 명소 다섯(과거·현대·미래 한 고원에)
## · 발견 지점 · 이 지역 안에서만 내리는 눈.
## 순간이동 지점·들판 무리·상자·별조각·채집은 각 표(waypoints·field_spawner·treasure_spawner·star_shards·cooking)에 "frost" 줄로.
##   과거 — 옛 산성 터(R (3,4)): 무너진 돌담 네 변과 문루, 망루 돌단
##   현대 — 기상 관측소((4.4,1.2)): 흰 원통 건물·둥근 지붕·전파 탑·돌아가는 풍속계·태양 전지판
##   미래 — 추락한 비행선((6.45,5.25)): 눈에 반쯤 묻힌 은빛 선체·꼬리 날개·푸른 빛줄
##   얼어붙은 호수((3.5,2.0) — I 두 칸, 걸을 수 있음)·고개 경계비((4.0,7.55))

const PropMaterial := preload("res://games/saga_go/world/prop_material.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const VegetationBuilder := preload("res://games/saga_go/world/vegetation_builder.gd")
const Skyport := preload("res://games/saga_go/world/region5_skyport.gd")

const REGION := "frost"
const DISCOVER_R := 30.0

## [codex id, 칸(소수), 반지름] — CodexState "place"(codex_state.gd TOTAL 에 여섯 더함).
const DISCOVERIES := [
	["frost_plateau", Vector2(4.0, 5.0), 60.0],
	["frost_pass", Vector2(4.0, 7.55), DISCOVER_R],
	["frost_fort", Vector2(3.0, 4.0), DISCOVER_R],
	["frost_observatory", Vector2(4.4, 1.2), DISCOVER_R],
	["frost_airship", Vector2(6.45, 5.25), DISCOVER_R],
	["frost_lake", Vector2(3.5, 2.0), DISCOVER_R],
]
## 작은 발견 일곱(선택지 없는 순수 발견 — 폐허 잔해와 같은 결). 발견 밀도(104-5, 반경 60m)를 48.9% → 0% 로 덮는
## 자리를 칸 계산으로 골랐다(들판 무리·상자 한가운데는 비킴). [codex id, 칸, 모양]
const SMALL := [
	["frost_satellite", Vector2(6.2, 3.6), "satellite"],   # 미래 — 떨어진 위성 조각
	["frost_statue", Vector2(1.5, 2.0), "statue"],         # 과거 — 눈에 묻힌 장수 석상
	["frost_hut", Vector2(1.4, 5.0), "hut"],               # 과거 — 사냥꾼 오두막
	["frost_snowman", Vector2(2.4, 6.4), "snowman"],       # 현대 — 눈사람과 썰매
	["frost_cablecar", Vector2(5.3, 6.6), "cablecar"],     # 현대 — 멈춘 케이블카 칸
	["frost_icecave", Vector2(6.25, 1.9), "icecave"],      # 얼음굴 어귀
	["frost_beacon", Vector2(5.0, 3.2), "beacon"],         # 과거 — 옛 봉화 돌무더기
]
const SMALL_R := 14.0

const FORT_CELL := Vector2(3.0, 4.0)
const OBSERVATORY_CELL := Vector2(4.4, 1.2)
const AIRSHIP_CELL := Vector2(6.45, 5.25)
const LAKE_CELL := Vector2(3.5, 2.0)
const PASS_STONE_CELL := Vector2(4.0, 7.55)

const STONE := Color(0.6, 0.6, 0.62)
const STONE_DARK := Color(0.42, 0.42, 0.45)
const WHITE := Color(0.93, 0.94, 0.96)
const HULL := Color(0.72, 0.76, 0.82)
const GLOW := Color(0.35, 0.85, 1.0)

var _vane: Node3D = null
var _snow: CPUParticles3D = null
## 106장 ㊺-4 — 이야기 12장(별배 심장)을 마치면 눈이 잦아든다. PartyState.story.ch 가 이 값 이상이면 SNOW_CALM 알갱이.
const CALM_AFTER_CH := 12
## 106장 ㊼-3 — 이야기 15장(날개 조각 셋)을 마치면 추락한 비행선(별배)이 수평으로 서서 FLY_H m 위에 뜬다(충돌도 같이 — 활공으로 올라설 수 있다).
## 파편은 땅에 남는다. 장이 끝나는 걸 보고 있으면 FLY_SEC 초 동안 떠오르고, 불러올 땐 이미 떠 있다.
const FLY_AFTER_CH := 15
const FLY_H := 9.0
const FLY_SEC := 4.0
const SHIP_TILT := 0.18
var _ship: Node3D = null
var _hull: Node3D = null
var _wings: Node3D = null
var _ship_label: Label3D = null
var _ship_flown := false
const SNOW_FULL := 260
const SNOW_CALM := 60
var _calm_t := 0.0
var _player: Node3D = null


func _ready() -> void:
	add_to_group("go_frost_region")
	var terrain := Node3D.new()
	terrain.set_script(TerrainBuilder)
	terrain.name = "FrostTerrain"
	terrain.set("region_id", REGION)
	add_child(terrain)
	var veg := Node3D.new()
	veg.set_script(VegetationBuilder)
	veg.name = "FrostVegetation"
	veg.set("region_id", REGION)
	add_child(veg)
	_build_fort()
	_build_observatory()
	_build_airship()
	_build_lake()
	_build_pass_stone()
	for d in DISCOVERIES:
		_add_discovery(String(d[0]), _ground(d[1]), float(d[2]))
	for d in SMALL:
		_build_small(String(d[0]), d[1], String(d[2]))
		_add_discovery(String(d[0]), _ground(d[1]), SMALL_R)
	_build_snow()


static func cell_pos(c: Vector2) -> Vector3:
	var p := TestMap.world_pos(c.x, c.y, REGION)
	p.y = TerrainBuilder.height_at(REGION, p)
	return p

func _ground(c: Vector2) -> Vector3:
	return cell_pos(c)

# ---------------------------------------------------------------- 명소

## 옛 산성 터 — 한 변 16m 돌담(가운데가 무너져 드나듦), 남쪽 문루, 가운데 망루 돌단.
func _build_fort() -> void:
	var root := _root("OldFort", FORT_CELL)
	var half := 8.0
	var h := 2.6
	for side in 4:
		var n := [Vector3(0, 0, -1), Vector3(1, 0, 0), Vector3(0, 0, 1), Vector3(-1, 0, 0)][side] as Vector3
		var along := Vector3(-n.z, 0, n.x)
		## 변마다 두 토막(가운데 4m 는 비었거나 문) — 무너진 높이는 토막마다 다르게.
		for k in [-1, 1]:
			var seg_len := 6.0
			var center: Vector3 = n * half + along * (k * (2.0 + seg_len * 0.5))
			var hh := h * (0.55 if (side + k) % 3 == 0 else 1.0)
			var size := Vector3(seg_len, hh, 0.9) if n.x == 0 else Vector3(0.9, hh, seg_len)
			_solid_box(root, size, center + Vector3(0, hh * 0.5, 0), STONE)
			## 담 위 성가퀴 — 몇 개만 남았다.
			if hh > 2.0:
				for j in 3:
					var t: float = (j - 1) * 2.0
					_box(root, Vector3(0.7, 0.6, 1.0) if n.x == 0 else Vector3(1.0, 0.6, 0.7), center + along * t + Vector3(0, hh + 0.3, 0), STONE_DARK)
	## 남쪽 문루 기둥 둘 + 들보(지나갈 수 있다).
	for k in [-1, 1]:
		_solid_box(root, Vector3(1.0, 4.2, 1.0), Vector3(k * 2.2, 2.1, half), STONE_DARK)
	_box(root, Vector3(5.6, 0.7, 1.3), Vector3(0, 4.55, half), STONE_DARK)
	var roof := MeshInstance3D.new()
	var rm := PrismMesh.new()
	rm.size = Vector3(6.4, 1.0, 1.8)
	roof.mesh = rm
	roof.material_override = _mat(Color(0.3, 0.26, 0.24))
	roof.position = Vector3(0, 5.4, half)
	root.add_child(roof)
	## 가운데 망루 돌단(올라설 수 있는 두 단).
	_solid_box(root, Vector3(4.0, 1.0, 4.0), Vector3(0, 0.5, -1.5), STONE)
	_solid_box(root, Vector3(2.4, 1.0, 2.4), Vector3(0, 1.5, -1.5), STONE_DARK)
	_label(root, "옛 산성 터", Vector3(0, 6.6, half), Color(0.9, 0.85, 0.75))

## 기상 관측소 — 흰 원통 건물 + 둥근 지붕 + 전파 탑 + 풍속계(돈다) + 태양 전지판.
func _build_observatory() -> void:
	var root := _root("Observatory", OBSERVATORY_CELL)
	var body := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 3.0
	cm.bottom_radius = 3.2
	cm.height = 4.0
	body.mesh = cm
	body.material_override = _mat(WHITE)
	body.position = Vector3(0, 2.0, 0)
	root.add_child(body)
	_solid_cyl(root, 3.2, 4.0, Vector3(0, 2.0, 0))
	var dome := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 3.0
	sm.height = 3.6
	sm.is_hemisphere = true
	dome.mesh = sm
	dome.material_override = _mat(Color(0.82, 0.86, 0.9))
	dome.position = Vector3(0, 4.0, 0)
	root.add_child(dome)
	## 문 — 남쪽.
	_box(root, Vector3(1.3, 2.2, 0.2), Vector3(0, 1.1, 3.15), Color(0.3, 0.45, 0.62))
	## 전파 탑(격자 기둥 대신 가는 기둥 셋 + 가로대) — 동쪽.
	var mast := Vector3(5.0, 0, 0.5)
	for k in 3:
		var a := TAU * k / 3.0
		_box(root, Vector3(0.12, 10.0, 0.12), mast + Vector3(cos(a) * 0.5, 5.0, sin(a) * 0.5), Color(0.75, 0.3, 0.25) if k == 0 else Color(0.85, 0.85, 0.88))
	for y in [2.5, 5.0, 7.5]:
		_box(root, Vector3(1.2, 0.08, 1.2), mast + Vector3(0, y, 0), Color(0.85, 0.85, 0.88))
	var lamp := MeshInstance3D.new()
	var lm := SphereMesh.new()
	lm.radius = 0.22
	lm.height = 0.44
	lamp.mesh = lm
	var lmat := _mat(Color(1.0, 0.25, 0.2))
	lmat.emission_enabled = true
	lmat.emission = Color(1.0, 0.2, 0.15)
	lmat.emission_energy_multiplier = 2.0
	lamp.material_override = lmat
	lamp.position = mast + Vector3(0, 10.2, 0)
	root.add_child(lamp)
	## 풍속계 — 지붕 위 막대와 컵 셋(_process 에서 돈다).
	_box(root, Vector3(0.1, 1.6, 0.1), Vector3(0, 6.3, 0), Color(0.6, 0.6, 0.62))
	_vane = Node3D.new()
	_vane.position = Vector3(0, 7.1, 0)
	root.add_child(_vane)
	for k in 3:
		var a := TAU * k / 3.0
		_box(_vane, Vector3(0.9, 0.05, 0.05), Vector3(cos(a) * 0.45, 0, sin(a) * 0.45), Color(0.6, 0.6, 0.62)).rotation.y = -a
		var cup := MeshInstance3D.new()
		var cs := SphereMesh.new()
		cs.radius = 0.16
		cs.height = 0.32
		cup.mesh = cs
		cup.material_override = _mat(Color(0.95, 0.95, 0.97))
		cup.position = Vector3(cos(a) * 0.9, 0, sin(a) * 0.9)
		_vane.add_child(cup)
	## 태양 전지판 둘 — 서쪽.
	for k in 2:
		var panel := _box(root, Vector3(2.4, 0.08, 1.4), Vector3(-5.0, 1.2, -1.2 + k * 2.2), Color(0.12, 0.2, 0.38))
		panel.rotation.z = 0.5
		_box(root, Vector3(0.1, 1.2, 0.1), Vector3(-5.0, 0.6, -1.2 + k * 2.2), Color(0.6, 0.6, 0.62))
	_label(root, "기상 관측소", Vector3(0, 8.4, 0), Color(0.8, 0.92, 1.0))

## 추락한 비행선 — 기울어 눈에 박힌 은빛 선체, 꼬리 날개, 푸른 빛줄, 부서진 앞코.
func _build_airship() -> void:
	var root := _root("CrashedAirship", AIRSHIP_CELL)
	root.rotation.y = 0.6
	## 선체·충돌·이름표는 _ship 아래 — 15장 뒤 통째로 뜬다(파편은 root 에 남는다).
	_ship = Node3D.new()
	_ship.name = "Ship"
	root.add_child(_ship)
	var hull_node := Node3D.new()
	hull_node.rotation = Vector3(0.0, 0.0, SHIP_TILT)
	hull_node.position = Vector3(0, 1.0, 0)
	_ship.add_child(hull_node)
	_hull = hull_node
	var hull := MeshInstance3D.new()
	var cap := CapsuleMesh.new()
	cap.radius = 2.4
	cap.height = 16.0
	hull.mesh = cap
	var hm := _mat(HULL)
	hm.metallic = 0.7
	hm.roughness = 0.35
	hull.material_override = hm
	hull.rotation.z = PI * 0.5
	hull_node.add_child(hull)
	## 빛줄 — 선체 옆 두 줄(푸르게 빛남).
	for k in [-1, 1]:
		var strip := _box(hull_node, Vector3(11.0, 0.18, 0.1), Vector3(0.5, 0.6, k * 2.36), GLOW)
		var gm := _mat(GLOW) # 09-29 _box 는 공용 셀 재질이라 발광 재질은 따로
		strip.material_override = gm
		gm.emission_enabled = true
		gm.emission = GLOW
		gm.emission_energy_multiplier = 1.6
	## 꼬리 날개 셋.
	_box(hull_node, Vector3(2.4, 2.6, 0.2), Vector3(-7.4, 2.2, 0), HULL)
	_box(hull_node, Vector3(2.2, 0.2, 5.2), Vector3(-7.4, 0.2, 0), HULL)
	## 앞코는 깨져 검게 탔다.
	var nose := MeshInstance3D.new()
	var ns := SphereMesh.new()
	ns.radius = 2.0
	ns.height = 3.0
	nose.mesh = ns
	nose.material_override = _mat(Color(0.18, 0.18, 0.2))
	nose.position = Vector3(8.2, -0.2, 0)
	hull_node.add_child(nose)
	## 날개 셋(조각 셋을 끼운 모양) — 뜬 뒤에만 보인다. 양옆 빛 날개 + 등 지느러미.
	_wings = Node3D.new()
	_wings.name = "StarWings"
	hull_node.add_child(_wings)
	for k in [-1, 1]:
		var wing := _box(_wings, Vector3(5.0, 0.16, 4.2), Vector3(-0.5, 0.2, k * 4.3), GLOW)
		wing.rotation = Vector3(k * -0.12, 0.0, 0.0)
		var wm := _mat(GLOW)
		wing.material_override = wm
		wm.emission_enabled = true
		wm.emission = GLOW
		wm.emission_energy_multiplier = 1.2
	var fin := _box(_wings, Vector3(3.2, 1.8, 0.14), Vector3(0.8, 3.1, 0), GLOW.lightened(0.3))
	var fnm := _mat(GLOW.lightened(0.3))
	fin.material_override = fnm
	fnm.emission_enabled = true
	fnm.emission = GLOW
	fnm.emission_energy_multiplier = 1.0
	_wings.visible = false
	## 흩어진 파편.
	for k in 5:
		var a := 0.9 + k * 1.1
		var d := 6.0 + (k % 3) * 2.0
		var shard := _box(root, Vector3(1.2 - k * 0.12, 0.25, 0.8), Vector3(cos(a) * d, 0.15, sin(a) * d), HULL.darkened(0.25))
		shard.rotation = Vector3(0.3 * k, a, 0.2)
	## 충돌 — 선체를 감싸는 상자 하나(기울기는 무시, 올라설 수 있게 윗면 평평).
	_solid_box(_ship, Vector3(16.0, 4.2, 4.6), Vector3(0, 2.1, 0), Color(0, 0, 0), false)
	_label(_ship, "추락한 비행선", Vector3(0, 6.2, 0), Color(0.6, 0.95, 1.0))
	_ship_label = _ship.get_child(_ship.get_child_count() - 1) as Label3D
	_set_ship(flown(), false)
	_refresh_away()

## 106장 ㊽-2 — 16장에 별배가 은하 나루로 날아가면(region5_skyport ship_docked) 고원의 별배(선체·충돌·이름표)는 사라진다. 파편은 남는다.
func _refresh_away() -> void:
	var away := Skyport.ship_docked()
	_ship.visible = not away
	for c in _ship.get_children():
		if c is StaticBody3D:
			(c as StaticBody3D).collision_layer = 0 if away else 1

func ship_away() -> bool:
	return not _ship.visible

## 15장을 마쳤는가 — 별배가 떠 있다.
static func flown() -> bool:
	return int(PartyState.story.get("ch", 0)) >= FLY_AFTER_CH

func ship_up() -> bool:
	return _ship_flown

## 뜬 모양/내려앉은 모양. animate 면 FLY_SEC 초에 걸쳐 떠오른다.
func _set_ship(up: bool, animate: bool) -> void:
	_ship_flown = up
	_wings.visible = up
	_ship_label.text = "별배" if up else "추락한 비행선"
	var y := FLY_H if up else 0.0
	var tilt := 0.0 if up else SHIP_TILT
	if animate:
		var tw := _ship.create_tween().set_parallel()
		tw.tween_property(_ship, "position:y", y, FLY_SEC).set_trans(Tween.TRANS_SINE)
		tw.tween_property(_hull, "rotation:z", tilt, FLY_SEC * 0.6)
	else:
		_ship.position.y = y
		_hull.rotation.z = tilt

## 얼어붙은 호수 — 가장자리 얼음 결정 몇 개와 얼음 낚시 구멍.
func _build_lake() -> void:
	var root := _root("FrozenLake", LAKE_CELL)
	var ice := Color(0.75, 0.9, 1.0)
	for k in 7:
		var a := TAU * k / 7.0 + 0.3
		var d := 30.0 + (k % 3) * 4.0
		var crystal := MeshInstance3D.new()
		var pm := PrismMesh.new()
		pm.size = Vector3(1.2, 2.2 + (k % 3) * 0.8, 1.2)
		crystal.mesh = pm
		var m := _mat(ice)
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.albedo_color = Color(ice.r, ice.g, ice.b, 0.8)
		m.roughness = 0.1
		crystal.material_override = m
		crystal.position = Vector3(cos(a) * d, pm.size.y * 0.5, sin(a) * d * 0.5)
		crystal.rotation = Vector3(0.15 * (k % 2), a, 0.1)
		root.add_child(crystal)
	var hole := MeshInstance3D.new()
	var hm := CylinderMesh.new()
	hm.top_radius = 0.7
	hm.bottom_radius = 0.7
	hm.height = 0.04
	hole.mesh = hm
	hole.material_override = _mat(Color(0.06, 0.14, 0.24))
	hole.position = Vector3(-8.0, 0.03, 4.0)
	root.add_child(hole)

## 고개 경계비 — "서리봉 고원" 돌비석.
func _build_pass_stone() -> void:
	var root := _root("PassStone", PASS_STONE_CELL)
	root.position.x += 6.0
	_solid_box(root, Vector3(1.0, 2.4, 0.4), Vector3(0, 1.2, 0), STONE)
	_box(root, Vector3(1.3, 0.3, 0.6), Vector3(0, 2.5, 0), STONE_DARK)
	_label(root, "서리봉 고원", Vector3(0, 3.3, 0), Color(0.92, 0.95, 1.0))

## 작은 발견 — 모양마다 몇 개 도형. 오두막·케이블카 칸만 몸 충돌(나머지는 들판 무리 둘레라 막지 않게 없음).
func _build_small(id: String, c: Vector2, shape: String) -> void:
	var r := _root("Small_" + id, c)
	match shape:
		"satellite":
			var body := _box(r, Vector3(1.6, 1.0, 1.2), Vector3(0, 0.4, 0), HULL)
			body.rotation = Vector3(0.3, 0.4, 0.2)
			for k in [-1, 1]:
				var wing := _box(r, Vector3(2.2, 0.06, 1.0), Vector3(k * 1.8, 0.35, 0.2), Color(0.12, 0.2, 0.4))
				wing.rotation = Vector3(0.2, 0.4, k * 0.35)
			var dish := MeshInstance3D.new()
			var dm := CylinderMesh.new()
			dm.top_radius = 0.7
			dm.bottom_radius = 0.1
			dm.height = 0.3
			dish.mesh = dm
			dish.material_override = _mat(WHITE)
			dish.position = Vector3(0.2, 1.1, -0.2)
			dish.rotation = Vector3(0.6, 0, 0.3)
			r.add_child(dish)
		"statue":
			_box(r, Vector3(1.4, 0.5, 1.4), Vector3(0, 0.25, 0), STONE_DARK)
			_box(r, Vector3(0.8, 1.6, 0.5), Vector3(0, 1.3, 0), STONE)
			var head := MeshInstance3D.new()
			var hs := SphereMesh.new()
			hs.radius = 0.32
			hs.height = 0.64
			head.mesh = hs
			head.material_override = _mat(STONE)
			head.position = Vector3(0, 2.4, 0)
			r.add_child(head)
			_box(r, Vector3(0.9, 0.25, 0.7), Vector3(0, 2.75, 0), WHITE) # 머리에 쌓인 눈
			_box(r, Vector3(0.12, 2.2, 0.12), Vector3(0.6, 1.4, 0.2), STONE_DARK) # 창
		"hut":
			_solid_box(r, Vector3(3.6, 2.2, 3.0), Vector3(0, 1.1, 0), Color(0.42, 0.3, 0.2))
			var roof := MeshInstance3D.new()
			var rm := PrismMesh.new()
			rm.size = Vector3(4.2, 1.4, 3.6)
			roof.mesh = rm
			roof.material_override = _mat(WHITE)
			roof.position = Vector3(0, 2.9, 0)
			r.add_child(roof)
			_box(r, Vector3(0.9, 1.5, 0.1), Vector3(0, 0.75, 1.52), Color(0.25, 0.17, 0.1))
			_box(r, Vector3(0.4, 1.2, 0.4), Vector3(1.2, 3.6, -0.6), STONE_DARK) # 굴뚝
		"snowman":
			for k in 3:
				var ball := MeshInstance3D.new()
				var bs := SphereMesh.new()
				bs.radius = 0.55 - k * 0.15
				bs.height = bs.radius * 2.0
				ball.mesh = bs
				ball.material_override = _mat(WHITE)
				ball.position = Vector3(0, 0.5 + k * 0.72, 0)
				r.add_child(ball)
			_box(r, Vector3(0.08, 0.08, 0.35), Vector3(0, 1.95, 0.3), Color(0.95, 0.5, 0.15)) # 코
			_box(r, Vector3(0.9, 0.1, 0.18), Vector3(0, 1.6, 0), Color(0.8, 0.15, 0.15)) # 목도리
			var sled := _box(r, Vector3(0.7, 0.12, 1.6), Vector3(1.4, 0.15, 0.4), Color(0.75, 0.2, 0.15))
			sled.rotation.y = 0.4
		"cablecar":
			_solid_box(r, Vector3(2.6, 2.2, 2.0), Vector3(0, 1.1, 0), Color(0.85, 0.25, 0.2))
			_box(r, Vector3(2.4, 0.7, 2.05), Vector3(0, 1.5, 0), Color(0.55, 0.75, 0.9)) # 창
			_box(r, Vector3(0.1, 2.5, 0.1), Vector3(0, 3.4, 0), Color(0.5, 0.5, 0.52))
			var cable := _box(r, Vector3(40.0, 0.05, 0.05), Vector3(0, 4.6, 0), Color(0.2, 0.2, 0.22))
			cable.rotation.z = 0.12
		"icecave":
			var ice := Color(0.7, 0.88, 1.0)
			for k in 5:
				var a := PI * (0.15 + 0.175 * k)
				var cr := MeshInstance3D.new()
				var pm := PrismMesh.new()
				pm.size = Vector3(1.4, 3.2 - absf(k - 2) * 0.6, 1.0)
				cr.mesh = pm
				cr.material_override = _mat(ice)
				cr.position = Vector3(cos(a) * 2.6, pm.size.y * 0.5, -sin(a) * 1.2)
				cr.rotation.z = (a - PI * 0.5) * 0.5
				r.add_child(cr)
			_box(r, Vector3(2.4, 1.8, 0.2), Vector3(0, 0.9, -1.0), Color(0.08, 0.12, 0.18)) # 어귀 그늘
		"beacon":
			for k in 6:
				var a := TAU * k / 6.0
				_box(r, Vector3(0.7, 0.5, 0.7), Vector3(cos(a) * 0.8, 0.25, sin(a) * 0.8), STONE if k % 2 == 0 else STONE_DARK)
			_box(r, Vector3(1.0, 0.5, 1.0), Vector3(0, 0.75, 0), STONE)
			_box(r, Vector3(0.8, 0.12, 0.2), Vector3(0, 1.1, 0), Color(0.18, 0.12, 0.08)) # 탄 나무

# ---------------------------------------------------------------- 눈

## 이 지역 안에 있을 때만 플레이어 둘레에 눈이 내린다(CPU 파티클 하나, 멀리선 안 돈다).
func _build_snow() -> void:
	_snow = CPUParticles3D.new()
	_snow.name = "Snowfall"
	_snow.amount = SNOW_FULL
	_snow.lifetime = 5.0
	_snow.preprocess = 5.0
	_snow.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	_snow.emission_box_extents = Vector3(22, 1, 22)
	_snow.direction = Vector3(0.15, -1, 0.05)
	_snow.spread = 12.0
	_snow.gravity = Vector3(0, -1.2, 0)
	_snow.initial_velocity_min = 1.2
	_snow.initial_velocity_max = 2.0
	_snow.scale_amount_min = 0.06
	_snow.scale_amount_max = 0.12
	var q := QuadMesh.new()
	q.size = Vector2(1, 1)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(1, 1, 1, 0.85)
	q.material = m
	_snow.mesh = q
	_snow.emitting = false
	_snow.top_level = true
	add_child(_snow)

## 별배 심장이 켜졌는가(12장 끝) — 눈이 잦아든다.
static func calm() -> bool:
	return int(PartyState.story.get("ch", 0)) >= CALM_AFTER_CH

func snow_amount() -> int:
	return _snow.amount

func player_inside() -> bool:
	return _player != null and TestMap.region_at(_player.global_position) == REGION

func _process(delta: float) -> void:
	if _vane:
		_vane.rotation.y += delta * 2.4
	if _player == null:
		_player = get_tree().get_first_node_in_group("player") as Node3D
		return
	var inside := player_inside()
	_calm_t -= delta
	if _calm_t <= 0.0:
		_calm_t = 1.0
		var want := SNOW_CALM if calm() else SNOW_FULL
		if _snow.amount != want:
			_snow.amount = want
		if flown() != _ship_flown:
			_set_ship(flown(), true)
		_refresh_away()
	if _snow.emitting != inside:
		_snow.emitting = inside
	if inside:
		_snow.global_position = _player.global_position + Vector3(0, 14, 0)

# ---------------------------------------------------------------- 도우미

func _root(n: String, c: Vector2) -> Node3D:
	var r := Node3D.new()
	r.name = n
	add_child(r)
	r.position = cell_pos(c)
	return r

func _mat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
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

func _solid_box(parent: Node3D, size: Vector3, pos: Vector3, color: Color, visible_mesh: bool = true) -> void:
	if visible_mesh:
		_box(parent, size, pos, color)
	var body := StaticBody3D.new()
	body.position = pos
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	body.add_child(cs)
	parent.add_child(body)

func _solid_cyl(parent: Node3D, r: float, h: float, pos: Vector3) -> void:
	var body := StaticBody3D.new()
	body.position = pos
	var cs := CollisionShape3D.new()
	var shape := CylinderShape3D.new()
	shape.radius = r
	shape.height = h
	cs.shape = shape
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
