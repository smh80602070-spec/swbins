extends Node3D

## G-0208 — 2나락 원거리 잡몹(활·지팡이)의 화살·탄환. 웹 dungeon.js run.foeShots 그대로:
## 곧게 날아가고(spd 260px → 10.5m/s), 수명 1.8초, 플레이어와 (P_R+8)px(0.85m) 안이면
## hurtPlayer(dmg, el, from, '화살·탄환') 후 사라지고, 벽에 닿으면 사라진다.
## 몸은 코드로 지은 작은 원소 색 빛 공(새 에셋 없음).

const SPEED := 10.5
const LIFE := 1.8
const HIT_R := 0.85
const RADIUS := 0.16

var dir := Vector3.FORWARD
var dmg := 0.0
var el := "phys"
var from_label := ""   # 사망 카드 "누구에게" — 쏜 적 이름(쏜 적이 먼저 쓰러져도 남는다)
var how := "화살"
var life := LIFE
var hit := false   # 점검용 — 플레이어를 맞혔는지
var _player: Node3D
var _exclude: Array[RID] = []


static func fire(host: Node, from_pos: Vector3, target: Vector3, damage: float, element: String, color: Color, who: String, what: String, shooter: CollisionObject3D = null) -> Node3D:
	var s: Node3D = (load("res://games/saga_dungeon/world/dungeon_shot.gd") as GDScript).new()
	var d := target - from_pos
	d.y = 0.0
	s.dir = d.normalized() if d.length_squared() > 0.0001 else Vector3.FORWARD
	s.dmg = damage
	s.el = element
	s.from_label = who
	s.how = what
	if shooter != null:
		s._exclude.append(shooter.get_rid())
	s._build(color)
	host.add_child(s)
	s.global_position = from_pos
	return s


func _build(color: Color) -> void:
	add_to_group("dungeon_shot")
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = RADIUS
	sm.height = RADIUS * 2.0
	sm.radial_segments = 8
	sm.rings = 4
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = color.lightened(0.25)
	sm.material = mat
	mi.mesh = sm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)


func _ready() -> void:
	_player = get_tree().get_first_node_in_group("player") as Node3D
	if _player is CollisionObject3D:
		_exclude.append((_player as CollisionObject3D).get_rid())


## 사망 카드 "누구에게" — 웹 hurtPlayer(…, fsh.from, '화살·탄환')
func who_label() -> String:
	return "%s(%s)" % [from_label, how] if from_label != "" else how


func _physics_process(delta: float) -> void:
	var step := dir * SPEED * delta
	var next := global_position + step
	life -= delta
	if _player != null and is_instance_valid(_player):
		var to := _player.global_position - next
		to.y = 0.0
		if to.length() < HIT_R:
			var ph := _player.get_node_or_null("PlayerHealth")
			if ph != null:
				ph.take_damage(dmg, self, el)
			hit = true
			queue_free()
			return
	## 벽이면 사라짐 — 적·플레이어 몸은 지나간다(웹 화살도 다른 적을 뚫고 간다)
	var space := get_world_3d().direct_space_state if is_inside_tree() else null
	if space != null:
		var q := PhysicsRayQueryParameters3D.create(global_position, next)
		q.exclude = _exclude
		var r := space.intersect_ray(q)
		if not r.is_empty():
			var c: Object = r.collider
			if c is Node and ((c as Node).is_in_group("dungeon_enemy") or (c as Node).is_in_group("player")):
				_exclude.append((c as CollisionObject3D).get_rid())
			else:
				queue_free()
				return
	global_position = next
	if life <= 0.0:
		queue_free()
