extends Node3D

## G-0345 콤보 킬(메이플스토리 콤보 킬 구슬 — 구조만) — 처치가 WINDOW 초 안에 이어지면 수가 오른다(끊기면 1부터).
##   글     SHOW_FROM 부터 그 자리에 "콤보 킬 n"(10·30·50 넘으면 색이 진해짐).
##   구슬   ORB_EVERY 마다 파란 경험치 구슬 — MAGNET_M 안이면 끌려와 EAT_M 안에서 먹음: 그 적 경험치 × orb_mul(콤보) · "EXP +n". LIFE_SEC 뒤 사라짐.
##   기록   best = 이번 실행 최고(저장 안 함). SAGA_COMBO_KILL=0 이면 셈·글·구슬 없음.

const StoryCombat := preload("res://games/saga_story/data/story_combat.gd")

const WINDOW := 5.0
const SHOW_FROM := 3
const ORB_EVERY := 10
const MAGNET_M := 3.5
const EAT_M := 0.8
const PULL_SPEED := 10.0
const LIFE_SEC := 20.0
const RADIUS := 0.3
const COLOR := Color(0.3, 0.65, 1.0)
const TIERS := [[50, Color(1.0, 0.35, 0.9)], [30, Color(1.0, 0.55, 0.2)], [10, Color(1.0, 0.85, 0.3)], [0, Color(0.9, 0.95, 1.0)]]

static var count := 0
static var best := 0
static var orbs := 0   # 점검용 — 떨군 구슬
static var eaten := 0
static var _last_ms := -100000
static var _label: Label3D = null   # 콤보 글은 하나만(광역으로 한꺼번에 잡으면 겹쳐 뭉개짐 — 촬영 lg_st_combo)

var exp_amount := 0
var _age := 0.0
var _mesh: MeshInstance3D = null


static func on() -> bool:
	return OS.get_environment("SAGA_COMBO_KILL") != "0"


## 구슬 배율 — 3 + 콤보/10, 최대 8
static func orb_mul(n: int) -> int:
	return mini(3 + n / 10, 8)


static func tier_color(n: int) -> Color:
	for t in TIERS:
		if n >= int(t[0]):
			return t[1]
	return Color.WHITE


## 처치 한 번(story_enemy _die) — 지금 콤보 수(꺼짐이면 0). now_ms 는 점검이 넣는다.
static func on_kill(parent: Node, pos: Vector3, enemy_lv: float, is_boss: bool, now_ms: int = -1) -> int:
	if not on() or parent == null or not parent.is_inside_tree():
		return 0
	var now := Time.get_ticks_msec() if now_ms < 0 else now_ms
	count = count + 1 if now - _last_ms <= int(WINDOW * 1000.0) else 1
	_last_ms = now
	best = maxi(best, count)
	if count >= SHOW_FROM:
		if is_instance_valid(_label):
			_label.queue_free()
		_label = _float(parent, pos + Vector3.UP * 2.6, "콤보 킬 %d" % count, tier_color(count), 52 + mini(count, 50) / 5 * 2, 0.01)
	if count % ORB_EVERY == 0:
		var o: Node3D = load("res://games/saga_story/world/story_combo_kill.gd").new()
		o.name = "ComboOrb"
		o.set("exp_amount", StoryCombat.enemy_exp(is_boss, enemy_lv) * orb_mul(count))
		parent.add_child(o)
		o.global_position = pos + Vector3.UP * 0.2
		orbs += 1
	return count


static func _float(parent: Node, at: Vector3, t: String, col: Color, size: int, px: float = 0.006) -> Label3D:
	var l := Label3D.new()
	l.text = t
	l.modulate = col
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.font_size = size
	l.outline_size = 10
	l.pixel_size = px
	parent.add_child(l)
	l.global_position = at
	var tw := l.create_tween()
	tw.set_parallel(true)
	tw.tween_property(l, "global_position:y", at.y + 0.9, 0.9)
	tw.tween_property(l, "modulate:a", 0.0, 0.9).set_delay(0.35)
	tw.chain().tween_callback(l.queue_free)
	return l


func _ready() -> void:
	add_to_group("story_combo_orb")
	_mesh = MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = RADIUS
	sm.height = RADIUS * 2.0
	_mesh.mesh = sm
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = COLOR
	mat.emission_enabled = true
	mat.emission = COLOR
	mat.emission_energy_multiplier = 3.0
	_mesh.material_override = mat
	_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_mesh.position.y = 0.5
	add_child(_mesh)


func _physics_process(delta: float) -> void:
	_age += delta
	_mesh.position.y = 0.5 + sin(_age * 3.0) * 0.1
	if _age > LIFE_SEC:
		queue_free()
		return
	var pl := get_tree().get_first_node_in_group("player") as Node3D
	if pl == null:
		return
	var to := pl.global_position - global_position
	to.y = 0.0
	var d := to.length()
	if d <= EAT_M:
		eat()
	elif d <= MAGNET_M:
		global_position += to / d * minf(PULL_SPEED * delta, d)


func eat() -> void:
	if is_queued_for_deletion():
		return
	StorySaveState.add_exp(exp_amount)
	eaten += 1
	var pl := get_tree().get_first_node_in_group("player") as Node3D
	if pl != null and get_parent() != null:
		_float(get_parent(), pl.global_position + Vector3.UP * 2.2, "EXP +%d" % exp_amount, COLOR, 44)
	queue_free()
