extends Node

## G-0303 들판이 받아치는 원소(웹 W-0374 field-env 짝) — 원소 반응은 적 몸에만 걸리니 땅도 한 번 더 부른다.
##   불: 불(화) 타격·연소가 풀 땅(칸 . 들·T 숲·F 논밭) 위 적에 닿으면 발밑에 불길 — LIFE 초 동안 반경 RADIUS 안 적에게
##       초당 DPS_MUL × 그 타격 기본 피해(불 원소 묻힘), SPREAD_AT 초 뒤 SPREAD_M 옆 풀 땅 한 곳으로 한 번 번짐(번진 불은 안 번짐).
##   물벼락: 번개(뇌) 타격이 물 위(fishing.is_water 와 같은 식) 적에 닿으면 SHOCK_R 안 물 위 다른 적에게 같은 기본 피해 한 번(감전 배율 그대로).
##   물(수) 타격은 반경 DOUSE_R 불길을 끈다. 주인공은 안 다친다. 고돗 칸은 48m 라 웹(2D 칸)과 달리 **땅 위 자리**로 센다.
## 땅 피해는 field_combat._splash_damage(반응·되부름 없음)라 다시 여기로 안 온다. SAGA_FIELD_ENV=0 이면 안 붙는다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")
const CombatFx := preload("res://saga_core/combat_fx.gd")

const GRASS := [".", "T", "F"]
const LIFE := 3.0
const RADIUS := 2.5
const DPS_MUL := 0.3
const TICK := 0.5
const SPREAD_AT := 0.5
const SPREAD_M := 4.0
const MAX_FIRES := 12
const SHOCK_R := 8.0
const DOUSE_R := 3.0
const FIRE_COLOR := Color(1.0, 0.45, 0.15)

var _fc: Node = null
## {pos, t(산 초), tick, base, spread(번질 수 있나), node(불꽃 몸)}
var _fires: Array = []


static func attach(fc: Node) -> Node:
	if OS.get_environment("SAGA_FIELD_ENV") == "0":
		return null
	var n: Node = load("res://games/saga_go/combat/field_env.gd").new()
	n.name = "FieldEnv"
	fc.add_child(n)
	return n


func _ready() -> void:
	add_to_group("go_field_env")
	_fc = get_parent()


func fires() -> Array:
	return _fires


static func is_grass(p: Vector3) -> bool:
	var region := TestMap.region_at(p)
	if region == "":
		return false
	var g := TestMap.grid_at(region, p)
	return GRASS.has(TestMap.tile_at(g.x, g.y, region)) and not _water(region, p)


## 물 위 — world/fishing.gd is_water 와 같은 식(그 스크립트는 autoload 를 써서 여기선 안 부른다).
static func _water(region: String, p: Vector3) -> bool:
	return TerrainBuilder.height_at(region, p) < TerrainBuilder.WATER_LEVEL - 0.3


static func is_wet(p: Vector3) -> bool:
	var region := TestMap.region_at(p)
	if region == "":
		return false
	var g := TestMap.grid_at(region, p)
	return TestMap.tile_at(g.x, g.y, region) == "~" or _water(region, p)


## field_combat._deal 이 한 번 친 뒤 부른다(element = 친 원소, reaction = 걸린 반응).
func on_hit(enemy: Node, base: float, element: String, reaction: String) -> void:
	if enemy == null or not is_instance_valid(enemy):
		return
	var p: Vector3 = (enemy as Node3D).global_position
	if element == "water":
		douse(p)
	elif element == "fire" or reaction == "burning":
		if is_grass(p):
			ignite(p, base, true)
	elif element == "thunder" and is_wet(p):
		shock(enemy, base)


func ignite(p: Vector3, base: float, spread: bool) -> void:
	for f: Dictionary in _fires:
		if (f.pos as Vector3).distance_to(p) < RADIUS:
			f.t = 0.0   # 같은 자리는 다시 타오름만
			return
	if _fires.size() >= MAX_FIRES:
		_drop(_fires.pop_front())
	_fires.append({"pos": p, "t": 0.0, "tick": 0.0, "base": base, "spread": spread, "node": _flames(p)})
	if _fc and _fc.has_method("_reaction_text") and spread:
		var holder := Node3D.new()
		add_child(holder)
		holder.global_position = p
		_fc.call("_reaction_text", holder, "들불", FIRE_COLOR)
		get_tree().create_timer(1.2).timeout.connect(holder.queue_free)
	CombatFx.element_burst(self, p + Vector3.UP * 0.2, 1.2, FIRE_COLOR, 0.5, "fire", false, 0.6)


func douse(p: Vector3) -> int:
	var keep: Array = []
	for f: Dictionary in _fires:
		if (f.pos as Vector3).distance_to(p) > DOUSE_R:
			keep.append(f)
		else:
			_drop(f)
	var n := _fires.size() - keep.size()
	_fires = keep
	return n


func shock(enemy: Node, base: float) -> int:
	var hit := 0
	var p: Vector3 = (enemy as Node3D).global_position
	for other in _fc.call("_enemies_near", p, SHOCK_R):
		if other == enemy or not is_wet((other as Node3D).global_position):
			continue
		_fc.call("_splash_damage", other, base * float(Elements.REACTION_INFO["electro"].mul), (other as Node3D).global_position - p, "thunder")
		CombatFx.element_burst(self, (other as Node3D).global_position + Vector3.UP * 0.6, 1.0, Elements.color_of("thunder"), 0.35, "thunder", false, 0.6)
		hit += 1
	if hit > 0 and _fc.has_method("_reaction_text"):
		_fc.call("_reaction_text", enemy, "물벼락", Elements.color_of("thunder"))
	return hit


func _process(delta: float) -> void:
	if _fires.is_empty():
		return
	var born: Array = []
	for f: Dictionary in _fires:
		f.t = float(f.t) + delta
		f.tick = float(f.tick) + delta
		if f.tick >= TICK:
			f.tick = float(f.tick) - TICK
			for e in _fc.call("_enemies_near", f.pos, RADIUS):
				_fc.call("_splash_damage", e, float(f.base) * DPS_MUL * TICK, Vector3.ZERO, "fire")
				if not e.call("is_shielded") and String(e.get("aura")) == "":
					e.call("set_aura", "fire")
			CombatFx.element_burst(self, (f.pos as Vector3) + Vector3.UP * 0.2, RADIUS * 0.5, FIRE_COLOR, 0.45, "fire", false, 0.5)
		if bool(f.spread) and float(f.t) >= SPREAD_AT:
			f.spread = false
			var q := _spread_spot(f.pos)
			if q != Vector3.INF:
				born.append([q, f.base])
	var live: Array = []
	for f: Dictionary in _fires:
		if float(f.t) < LIFE:
			live.append(f)
			var fl := f.node as Node3D
			if fl != null and is_instance_valid(fl):   # 일렁임 + 끝 0.6초 사그라짐
				var k := clampf((LIFE - float(f.t)) / 0.6, 0.0, 1.0)
				for i in fl.get_child_count():
					var c := fl.get_child(i) as Node3D
					if c is MeshInstance3D and c.name.begins_with("Flame"):
						c.scale = Vector3(k, k * (0.8 + 0.3 * sin(float(f.t) * 11.0 + i * 1.7)), k)
		else:
			_drop(f)
	_fires = live
	for b: Array in born:
		ignite(b[0], b[1], false)


## 불꽃 몸 — 발밑 그을음 판 하나 + 빛나는 원뿔 다섯(그림자 없음). 머티리얼은 한 벌을 나눠 쓴다.
static var _flame_mat: StandardMaterial3D = null
static var _scorch_mat: StandardMaterial3D = null
static var _core_mat: StandardMaterial3D = null

func _flames(p: Vector3) -> Node3D:
	if _flame_mat == null:
		_flame_mat = StandardMaterial3D.new()
		_flame_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_flame_mat.albedo_color = Color(1.0, 0.55, 0.15, 0.85)
		_flame_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_flame_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		_core_mat = _flame_mat.duplicate() as StandardMaterial3D
		_core_mat.albedo_color = Color(1.0, 0.85, 0.35, 0.9)
		_core_mat.emission = Color(1.0, 0.8, 0.3)
		_flame_mat.emission_enabled = true
		_flame_mat.emission = Color(1.0, 0.45, 0.1)
		_flame_mat.emission_energy_multiplier = 2.5
		_scorch_mat = StandardMaterial3D.new()
		_scorch_mat.albedo_color = Color(0.08, 0.05, 0.03, 0.55)
		_scorch_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_scorch_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var root := Node3D.new()
	root.name = "FireSpot"
	add_child(root)
	root.global_position = p
	var disc := MeshInstance3D.new()
	var dm := CylinderMesh.new()
	dm.top_radius = RADIUS * 0.8
	dm.bottom_radius = RADIUS * 0.8
	dm.height = 0.02
	dm.radial_segments = 16
	disc.mesh = dm
	disc.material_override = _scorch_mat
	disc.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	disc.position.y = 0.05
	root.add_child(disc)
	for i in 5:
		var a := i * TAU / 5.0 + 0.4
		var r := 0.0 if i == 0 else RADIUS * 0.45
		var mi := MeshInstance3D.new()
		mi.name = "Flame%d" % i
		var cm := CylinderMesh.new()
		cm.top_radius = 0.0
		cm.bottom_radius = 0.28 if i == 0 else 0.18
		cm.height = 1.5 if i == 0 else 0.6 + 0.15 * i
		cm.radial_segments = 6
		cm.rings = 1
		mi.mesh = cm
		mi.material_override = _flame_mat
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.position = Vector3(cos(a) * r, cm.height * 0.5, sin(a) * r)
		root.add_child(mi)
		var core := MeshInstance3D.new()   # 노란 속불(밑동 쪽)
		var km := CylinderMesh.new()
		km.top_radius = 0.0
		km.bottom_radius = cm.bottom_radius * 0.55
		km.height = cm.height * 0.5
		km.radial_segments = 6
		km.rings = 1
		core.mesh = km
		core.material_override = _core_mat
		core.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		core.position.y = -cm.height * 0.25
		mi.add_child(core)
	return root

func _drop(f: Dictionary) -> void:
	var n: Variant = f.get("node")
	if n != null and is_instance_valid(n):
		(n as Node).queue_free()

## 옆 풀 땅 한 곳(넷 중 처음 맞는 것 — 자리로 돌려 정해 같은 불은 같은 쪽으로).
func _spread_spot(p: Vector3) -> Vector3:
	var k := int(absf(p.x * 7.0 + p.z * 13.0)) % 4
	for i in 4:
		var a := (k + i) * PI * 0.5
		var q := p + Vector3(cos(a), 0.0, sin(a)) * SPREAD_M
		if is_grass(q):
			var near := false
			for f: Dictionary in _fires:
				if (f.pos as Vector3).distance_to(q) < RADIUS:
					near = true
			if not near:
				q.y = TerrainBuilder.height_at(TestMap.region_at(q), q)   # 비탈에서도 땅 위
				return q
	return Vector3.INF
