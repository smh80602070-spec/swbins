extends Node3D

## G-0344 피 구슬(디아블로 3 체력 구슬 — 구조만) — 적이 쓰러진 자리에 붉게 빛나는 구슬(잡졸 CHANCE · 정예 1 · 우두머리 BOSS_N).
##   끌림   MAGNET_M 안에 들면 나에게 PULL_SPEED 로 다가오고, EAT_M 안이면 먹는다: 최대 체력 HEAL_PCT 회복·"+n" 글.
##   가득   체력이 가득이면 안 먹고 그 자리에 남는다(끌림도 멈춤 — 뒤에 쓰라고).
##   수명   LIFE_SEC 뒤 FADE_SEC 동안 흐려져 사라짐.
##   금강(경락 diamond)은 단약만 막는 규칙이라 구슬은 그대로 먹는다. SAGA_GLOBE=0 이면 안 떨군다.

const CHANCE := 0.22
const BOSS_N := 3
const HEAL_PCT := 12.0
const MAGNET_M := 3.0
const EAT_M := 0.7
const PULL_SPEED := 9.0
const LIFE_SEC := 25.0
const FADE_SEC := 1.5
const RADIUS := 0.3   # 촬영 lg_dg_globe — 0.2 는 2나락 먼 카메라에서 점 하나
const COLOR := Color(0.95, 0.12, 0.12)

static var dropped := 0   # 점검용
static var eaten := 0

var _age := 0.0
var _mat: StandardMaterial3D = null
var _mesh: MeshInstance3D = null
var _base_y := 0.0


static func on() -> bool:
	return OS.get_environment("SAGA_GLOBE") != "0"


## 쓰러진 적 자리에 — 떨군 수
static func drop(parent: Node, pos: Vector3, is_boss: bool, is_elite: bool) -> int:
	if not on() or parent == null or not parent.is_inside_tree():
		return 0
	var n := BOSS_N if is_boss else (1 if is_elite or randf() < CHANCE else 0)
	for i in n:
		var g: Node3D = load("res://games/saga_dungeon/world/health_globe.gd").new()
		g.name = "HealthGlobe"
		parent.add_child(g)
		var a := TAU * float(i) / float(maxi(n, 1))
		g.global_position = Vector3(pos.x, pos.y, pos.z) + (Vector3(cos(a), 0.0, sin(a)) * 0.8 if n > 1 else Vector3.ZERO)
		dropped += 1
	return n


func _ready() -> void:
	add_to_group("dungeon_health_globe")
	_base_y = global_position.y
	_mesh = MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = RADIUS
	sm.height = RADIUS * 2.0
	_mesh.mesh = sm
	_mat = StandardMaterial3D.new()
	_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_mat.albedo_color = COLOR
	_mat.emission_enabled = true
	_mat.emission = COLOR
	_mat.emission_energy_multiplier = 3.0
	_mesh.material_override = _mat
	_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF   # G-0269 작은 줍기는 그림자 없음
	_mesh.position.y = 0.45
	add_child(_mesh)


func _health() -> Node:
	return get_tree().get_first_node_in_group("player_health")


func _physics_process(delta: float) -> void:
	_age += delta
	_mesh.position.y = 0.45 + sin(_age * 3.0) * 0.08
	if _age > LIFE_SEC:
		var k := clampf((_age - LIFE_SEC) / FADE_SEC, 0.0, 1.0)
		_mat.albedo_color.a = 1.0 - k
		if k >= 1.0:
			queue_free()
			return
	var pl := get_tree().get_first_node_in_group("player") as Node3D
	var h := _health()
	if pl == null or h == null or float(h.get("hp")) >= float(h.get("max_hp")) or float(h.get("hp")) <= 0.0:
		return
	var to := pl.global_position - global_position
	to.y = 0.0
	var d := to.length()
	if d <= EAT_M:
		eat(h)
	elif d <= MAGNET_M:
		global_position += to / d * minf(PULL_SPEED * delta, d)


## 먹는다 — 회복량(가득이면 0, 구슬 남음)
func eat(h: Node) -> float:
	var hp := float(h.get("hp"))
	var mx := float(h.get("max_hp"))
	if hp >= mx or hp <= 0.0:
		return 0.0
	var amount := minf(mx * HEAL_PCT / 100.0, mx - hp)
	h.call("heal_by", amount)
	eaten += 1
	var pl := get_tree().get_first_node_in_group("player") as Node3D
	if pl != null:
		_float_text(pl, "+%d" % int(roundf(amount)))
	queue_free()
	return amount


func _float_text(at: Node3D, t: String) -> void:
	var l := Label3D.new()
	l.text = t
	l.modulate = Color(1.0, 0.45, 0.45)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.font_size = 48
	l.outline_size = 8
	l.pixel_size = 0.006
	get_tree().current_scene.add_child(l)
	l.global_position = at.global_position + Vector3.UP * 2.2
	var tw := l.create_tween()
	tw.set_parallel(true)
	tw.tween_property(l, "global_position:y", l.global_position.y + 0.8, 0.7)
	tw.tween_property(l, "modulate:a", 0.0, 0.7).set_delay(0.2)
	tw.chain().tween_callback(l.queue_free)
