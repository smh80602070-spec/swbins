extends RefCounted
## G-0059 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 플레이어 앞(카메라가 보는 -z 쪽) 7m 에 들판 여덟 종을
## 한 줄로 세운다(AI 끔 — 카메라 쪽을 본 채 서기 애니만). SAGA_GLB_MONSTERS=1 로 띄우면 GLB 몸(후 사진), 없으면 코드 짐승(기본).

const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const KINDS := ["wolf", "thunder_cat", "ice_fox", "rock_bear", "wind_hawk", "grass_snake", "fire_imp", "water_turtle"]

static func line_up(tree: SceneTree) -> void:
	var p := tree.get_first_node_in_group("player") as Node3D
	if p == null:
		return
	var i := 0
	for k in KINDS:
		var e := FieldEnemy.new()
		e.name = "ShotMonster_%d" % i
		e.setup(k, p.global_position + Vector3((float(i) - 3.5) * 1.9, 0.0, -4.5), 20260824 + i)
		e.respawns = false
		tree.current_scene.add_child(e)
		e.set_physics_process(false)
		i += 1
