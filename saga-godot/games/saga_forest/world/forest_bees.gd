extends Node3D

## G-0346 벌집(동물의숲 — 구조만, 웹 bug.js 벌떼) — 나무·소나무를 흔들 때 그날·그 나무 씨앗으로 HIVE_P 벌집이 떨어져 벌떼가 나온다.
##   쫓음   SPEED m/s 로 나를 쫓는다(걷기 6 < 7 < 달리기 10 — 달려야 떨어진다). GIVE_UP_SEC 동안 못 붙으면 흩어짐.
##   모임   NEAR_M 안에 붙으면 GATHER_SEC 모였다가(윙윙 떨림) 쏜다 — 그 사이 [G](forest_gather)면 잠자리채로 잡음: 곤충 +CATCH_N.
##   쏘임   놓치면 STING_SEC 동안 못 움직임(player.frozen)·"벌에 쏘였다!" — 그리고 흩어짐.
## SAGA_BEES=0 이면 벌집 없음.

const Toast := preload("res://saga_core/ui/toast.gd")

const HIVE_P := 20   # %
const TREES := ["gather_tree", "gather_pine"]
const SPEED := 7.0
const NEAR_M := 1.2
const GATHER_SEC := 0.6
const STING_SEC := 1.2
const GIVE_UP_SEC := 8.0
const CATCH_N := 2
const N_BEES := 8
const SWARM_R := 0.75   # 촬영 lg_fs_bees — 3마을 높은 카메라(14m)에서 0.5·알갱이 0.07 은 점 몇 개
const YELLOW := Color(1.0, 0.82, 0.1)
const DARK := Color(0.12, 0.1, 0.06)

enum S { CHASE, GATHER, DONE }

static var spawned := 0   # 점검용
static var caught := 0
static var stung := 0
static var fled := 0

var state := S.CHASE
var _t := 0.0
var _age := 0.0
var _bees: Array = []


static func on() -> bool:
	return OS.get_environment("SAGA_BEES") != "0"


## 그날·그 나무에 벌집이 떨어지나(씨앗 고정 — 다시 흔들어도 같음)
static func hive_roll(day: int, id: String) -> bool:
	if not TREES.has(id):
		return false
	return absi(hash("%d|%s|hive" % [day, id])) % 100 < HIVE_P


## 흔든 나무 자리에서 벌떼 — 나왔으면 그 노드
static func spawn(host: Node, pos: Vector3) -> Node3D:
	if not on() or host == null or not host.is_inside_tree():
		return null
	var n: Node3D = load("res://games/saga_forest/world/forest_bees.gd").new()
	n.name = "Bees"
	host.get_tree().current_scene.add_child(n)
	n.global_position = pos + Vector3.UP * 1.6
	spawned += 1
	Toast.show(host, "🐝 벌집이 떨어졌다! 벌떼가 쫓아온다 — 달리거나, 붙을 때 [G] 로 잡아라", 3.0)
	return n


func _ready() -> void:
	add_to_group("forest_bees")
	var rng := RandomNumberGenerator.new()
	rng.seed = 20260824
	for i in N_BEES:
		var b := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.12
		sm.height = 0.2
		b.mesh = sm
		var mat := StandardMaterial3D.new()
		mat.albedo_color = YELLOW if i % 3 != 0 else DARK
		mat.emission_enabled = i % 3 != 0
		mat.emission = YELLOW
		mat.emission_energy_multiplier = 1.5
		b.material_override = mat
		b.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		b.position = Vector3(rng.randf_range(-1, 1), rng.randf_range(-0.5, 0.5), rng.randf_range(-1, 1)).normalized() * SWARM_R
		b.set_meta("ph", rng.randf() * TAU)
		add_child(b)
		_bees.append(b)


func _player() -> Node3D:
	return get_tree().get_first_node_in_group("player") as Node3D


func _physics_process(delta: float) -> void:
	_age += delta
	var tight := 0.4 if state == S.GATHER else 1.0
	for b: MeshInstance3D in _bees:
		var ph := float(b.get_meta("ph")) + _age * (14.0 if state == S.GATHER else 7.0)
		b.position = Vector3(cos(ph), sin(ph * 1.7) * 0.5, sin(ph * 1.3)) * SWARM_R * tight
	if state == S.DONE:
		return
	var pl := _player()
	if pl == null:
		return
	var target := pl.global_position + Vector3.UP * 1.2
	var to := target - global_position
	var flat := Vector2(to.x, to.z).length()
	match state:
		S.CHASE:
			if _age > GIVE_UP_SEC:
				fled += 1
				Toast.show(self, "🐝 벌떼가 흩어졌다.", 1.5)
				_finish()
				return
			if flat <= NEAR_M:
				state = S.GATHER
				_t = GATHER_SEC
			else:
				global_position += to.normalized() * minf(SPEED * delta, to.length())
		S.GATHER:
			global_position = global_position.lerp(target, minf(1.0, delta * 6.0))
			_t -= delta
			if _t <= 0.0:
				sting(pl)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("forest_gather") and try_catch():
		get_viewport().set_input_as_handled()


## [G] — 모이는 중이면 잡음(true)
func try_catch() -> bool:
	if state != S.GATHER:
		return false
	caught += 1
	ForestSaveState.add_item("곤충", CATCH_N)
	var pl := _player()
	if pl != null and pl.has_method("play_once"):
		pl.call("play_once", "gather", 0.6)
	Toast.show(self, "🥅 벌떼를 잡았다! 곤충 +%d" % CATCH_N, 2.5)
	CombatFeel.pickup(self, "곤충 +%d" % CATCH_N)
	_finish()
	return true


func sting(pl: Node3D) -> void:
	stung += 1
	pl.set("frozen", true)
	Toast.show(self, "🐝 벌에 쏘였다! 😵", 2.0)
	var t := get_tree().create_timer(STING_SEC)
	t.timeout.connect(pl.set.bind("frozen", false))   # 벌떼 노드는 0.6초 뒤 지워진다 — 람다로 붙이면 같이 사라져 영영 못 움직임(점검 ④)
	_finish()


func _finish() -> void:
	state = S.DONE
	var tw := create_tween()
	tw.tween_property(self, "scale", Vector3.ONE * 3.0, 0.6)
	tw.parallel().tween_property(self, "global_position:y", global_position.y + 2.0, 0.6)
	tw.tween_callback(queue_free)
