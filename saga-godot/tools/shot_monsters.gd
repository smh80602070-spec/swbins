extends RefCounted
## G-0059 촬영 도우미 — shot_scene.gd 의 static 단계가 부른다. 플레이어 앞(카메라가 보는 -z 쪽) 7m 에 들판 여덟 종을
## 한 줄로 세운다(AI 끔 — 카메라 쪽을 본 채 서기 애니만). G-0082 — 기본은 종 GLB 몸(mon_sp_), SAGA_CODE_CREATURES=1 이면 코드 짐승.
## line_up_bosses(tree, part) — 보스 열여섯을 넷씩(part 0~3) 더 멀리·넓게.

const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const KINDS := ["wolf", "thunder_cat", "ice_fox", "rock_bear", "wind_hawk", "grass_snake", "fire_imp", "water_turtle"]
const BOSSES := ["ember_king", "gale_roc", "tide_turtle", "snow_bear_king", "storm_serpent", "rift_fox", "rift_fox_ember", "moss_serpent",
	"rift_crow", "abyss_angler", "dome_colossus", "amber_turtle", "first_crow", "garmuri_true", "seed_giant", "vault_queen"]

static func line_up(tree: SceneTree) -> void:
	_row(tree, KINDS, 1.9, -4.5)

static func line_up_bosses(tree: SceneTree, part: int) -> void:
	_row(tree, BOSSES.slice(part * 4, part * 4 + 4), 5.2, -8.0)

static func _row(tree: SceneTree, kinds: Array, gap: float, dz: float) -> void:
	var p := tree.get_first_node_in_group("player") as Node3D
	if p == null:
		return
	var i := 0
	for k in kinds:
		var e := FieldEnemy.new()
		e.name = "ShotMonster_%d" % i
		e.setup(k, p.global_position + Vector3((float(i) - (kinds.size() - 1) * 0.5) * gap, 0.0, dz), 20260824 + i)
		e.respawns = false
		tree.current_scene.add_child(e)
		e.set_physics_process(false)
		print("SHOT_MONSTER %s %s" % [k, e.glb_path if e.glb_path != "" else "code"])
		i += 1
