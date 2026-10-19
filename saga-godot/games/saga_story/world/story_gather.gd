extends Node3D

## VERTICAL_SLICE_STORY.md 1절 — field_map.gd 머리말이 "이번 슬라이스에
## 안 옮긴다"고 적어 뒀던 셋(문·채집·보스) 중 채집을 채운다. side.js
## 필드 채집 그대로: 지나가면 자동으로 줍고(칸 제한 없음, 누적 카운터),
## GATHER_RESPAWN(45초) 뒤 같은 자리에 다시 돋는다 — 몬스터 드랍(loot_
## pickup.gd)과 달리 한 번 주우면 사라지는 게 아니다.

const Toast := preload("res://saga_core/ui/toast.gd")
const StoryCombat := preload("res://games/saga_story/data/story_combat.gd")
const StoryLife := preload("res://games/saga_story/data/story_life.gd")   # G-0238 채집 랭크

const VISUAL_COLOR := Color(0.85, 0.78, 0.25)  # data-side.js herb emoji 🌼 느낌

var kind := "herb"
var _alive := true
var _visual: MeshInstance3D
var _area: Area3D


func _ready() -> void:
	_spawn_visual()
	_spawn_area()


func _spawn_visual() -> void:
	_visual = MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = 0.25
	mesh.height = 0.5
	_visual.mesh = mesh
	_visual.position = Vector3(0, 0.3, 0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = VISUAL_COLOR
	_visual.material_override = mat
	add_child(_visual)


func _spawn_area() -> void:
	_area = Area3D.new()
	_area.name = "GatherArea"
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = StoryCombat.GATHER_RADIUS_M
	cs.shape = shape
	_area.add_child(cs)
	_area.position = Vector3(0, 0.3, 0)
	_area.body_entered.connect(_on_body_entered)
	add_child(_area)


func _on_body_entered(body: Node3D) -> void:
	if not _alive or not body.is_in_group("player"):
		return
	_gather()


func _gather() -> void:
	_alive = false
	_visual.hide()
	_area.set_deferred("monitoring", false)

	## G-0212 채집 보너스 지역(웹 side.js 1993 — 그 구간 안이면 ×2) — 사냥터 사건은 spawner 가 든다(그룹 story_hunt_events)
	var gain := 1
	var ev := get_tree().get_first_node_in_group("story_hunt_events") as Node3D
	if ev != null:
		gain = ev.forage_mul_at(global_position.x - ev.global_position.x)
	var lucky := gain > 1
	## G-0238 채집 랭크(웹 life.js gatherExtra·gain) — 🍀 ×2 뒤 +1 · 경험 1(🍀 2)
	var lxp := int(StorySaveState.life.get("gather", 0))
	gain += StoryLife.extra(StoryLife.rank_idx(lxp), StorySaveState.life_rng)
	StorySaveState.add_mat(kind, gain)
	var up: int = StorySaveState.add_life_xp("gather", 2 if lucky else 1)
	var info: Dictionary = StoryCombat.GATHER_INFO.get(kind, {})
	var label := String(info.get("name", kind))
	var emoji := String(info.get("emoji", ""))
	var msg := "%s %s +%d%s · %s" % [emoji, label, gain, " 🍀" if lucky else "", StoryLife.label("gather", int(StorySaveState.life["gather"]))]
	if up >= 0:   # 랭크 오름은 둘째 줄로 한 번 더(토스트 한 칸이라 따로 띄우면 앞 줄을 덮는다)
		msg += "\n" + StoryLife.rank_up_text("gather", up)
	Toast.show(self, msg, 2.5 if up >= 0 else 2.0)

	get_tree().create_timer(StoryCombat.GATHER_RESPAWN_SEC).timeout.connect(_respawn)


func _respawn() -> void:
	_alive = true
	_visual.show()
	_area.set_deferred("monitoring", true)
