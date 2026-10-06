extends RefCounted

## VERTICAL_SLICE_STORY.md 1절 "제외" 목록 "장비/노획"의 상점 걸음 —
## DUNGEON loot_pickup.gd의 _spawn_gold()와 같은 뼈대(Area3D 트리거,
## 닿으면 즉시 지갑에 더한다). story_gear_pickup.gd처럼 이 판 전용으로
## 따로 둔다(DUNGEON 파일을 직접 참조하지 않는다 — 다섯 판 공용 파일을
## 하나로 합치지 않는다는 저장소 규칙).

const Toast := preload("res://saga_core/ui/toast.gd")

const TRIGGER_RADIUS := 1.0
const GOLD_COLOR := Color(1.0, 0.84, 0.2)


static func spawn_at(parent: Node, pos: Vector3, amount: int) -> void:
	if amount <= 0:
		return

	var area := Area3D.new()
	area.name = "GoldPickup"
	area.position = pos

	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.3, 0.3, 0.3)
	mi.mesh = mesh
	mi.position = Vector3(0, 0.3, 0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = GOLD_COLOR
	mat.metallic = 0.5
	mi.material_override = mat
	area.add_child(mi)

	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = TRIGGER_RADIUS
	cs.shape = shape
	area.add_child(cs)

	parent.add_child(area)
	area.body_entered.connect(func(body: Node3D) -> void:
		if body.is_in_group("player"):
			StorySaveState.add_gold(amount)
			Toast.show(area, "💰 금 +%d" % amount, 2.0)
			area.queue_free()
	)
