extends Area3D

## **2026-09-13 추가 — 원거리 적(1절 "제외" 목록의 "원거리 적").**
## data-side.js RANGED_WEAPON.bow + side.js eshot(투사체) 포트. 이 포트는
## 잡졸이 추격을 안 해(story_enemy.gd 머리말) 원작의 "사거리 안이면
## 멈춰서 쏜다/다가온다"(holding) 갈래는 필요 없다 — 제자리에서 사거리
## 안이면 그냥 쏜다.
##
## story_enemy.gd가 set_script로 직접 만든다(story_enemy_spawner.gd가
## story_enemy.gd를 만드는 것과 같은 배선) — 별도 static 팩토리 없이
## 호출 쪽이 dir/speed/damage/life_left를 채운 뒤 add_child한다.

var dir := 1.0
var speed := 0.0
var damage := 0.0
var life_left := 2.4  # side.js eshot life:2.4 그대로(초 단위라 px 환산 불필요)
## G-0210 마법형 구슬(웹 side.js 1755) — 켜지면 y 를 플레이어 가슴 높이 쪽으로 HOME_M 씩 따라간다. 활·조총은 꺼진 채 직선.
const HOME_M := 140.0 * 0.02
const CHEST_M := 0.9
var homing := false
var color := Color(0.85, 0.72, 0.3)


func _ready() -> void:
	_spawn_visual()
	body_entered.connect(_on_body_entered)


func _spawn_visual() -> void:
	var mi := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = 0.12
	mesh.height = 0.24
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.emission_enabled = true
	mat.emission = mat.albedo_color
	mat.emission_energy_multiplier = 1.2
	mi.material_override = mat
	add_child(mi)
	if homing:
		## G-0210 — 웹 side-view.js 350: 구슬은 활·탄환(5px)보다 큰 7px 에 옅은 보랏빛 테(쫓아온다는 느낌). 인물을 크게 그려(G-0187) 그만큼 키움.
		mesh.radius = 0.15
		mesh.height = 0.3
		mat.albedo_color = color.lightened(0.45)
		mat.emission = mat.albedo_color
		var halo := MeshInstance3D.new()
		var hm := SphereMesh.new()
		hm.radius = 0.28
		hm.height = 0.56
		halo.mesh = hm
		var hmat := StandardMaterial3D.new()
		hmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		hmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		hmat.albedo_color = Color(color, 0.55)
		halo.material_override = hmat
		halo.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(halo)

	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 0.2
	cs.shape = shape
	add_child(cs)


func _physics_process(delta: float) -> void:
	life_left -= delta
	if life_left <= 0.0:
		queue_free()
		return
	global_position.x += dir * speed * delta
	if homing:
		var p := get_tree().get_first_node_in_group("player") as Node3D
		if p != null:
			global_position.y = move_toward(global_position.y, p.global_position.y + CHEST_M, HOME_M * delta)


func _on_body_entered(body: Node3D) -> void:
	if body.is_in_group("player") and body.has_method("take_damage"):
		body.take_damage(damage)
		queue_free()
