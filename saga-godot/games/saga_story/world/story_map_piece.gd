extends RefCounted

## G-0309 지도 조각 — 사냥터(story_field.gd)가 _ready 에서 attach. 아직 안 주운 조각만 발판 위에 세운다.
## story_gold_pickup.gd 와 같은 뼈대(Area3D, 닿으면 줍기). 그림은 코드 도형(빛나는 두루마리 판 + 천천히 돎).

const Toast := preload("res://saga_core/ui/toast.gd")
const Stagemap := preload("res://games/saga_story/data/story_stagemap.gd")

const TRIGGER_RADIUS := 0.8
const PIECE_COLOR := Color(0.55, 0.85, 1.0)


static func attach(field: Node) -> void:
	if not Stagemap.on():
		return
	var sp := field.get_node_or_null("EnemySpawner")
	var path := String(sp.get("map_path")) if sp != null and sp.get("map_path") != null else "res://games/saga_story/data/field_map.gd"
	var map := load(path) as GDScript
	if map == null or not map.has_method("stage_key"):
		return
	var key := String(map.stage_key())
	var have := Stagemap.got(StorySaveState.stage_maps, key)
	var ps := Stagemap.pieces(map)
	for i in range(ps.size()):
		if not have.has(i):
			_spawn(field, ps[i], key, i)


static func _spawn(parent: Node, pos: Vector3, key: String, idx: int) -> void:
	var area := Area3D.new()
	area.name = "MapPiece%d" % idx
	area.position = pos
	area.add_to_group("story_map_piece")
	var mi := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.36, 0.46, 0.06)
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = PIECE_COLOR
	mat.emission_enabled = true
	mat.emission = PIECE_COLOR
	mat.emission_energy_multiplier = 1.6
	mi.material_override = mat
	area.add_child(mi)
	var tw := mi.create_tween().set_loops()
	tw.tween_property(mi, "rotation:y", TAU, 2.4).from(0.0)
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = TRIGGER_RADIUS
	cs.shape = shape
	area.add_child(cs)
	parent.add_child(area)
	area.body_entered.connect(func(body: Node3D) -> void:
		if body.is_in_group("player"):
			pick(area, key, idx)
	)


## 줍기(점검도 부른다) — 새로 주웠으면 알림·조각 지움
static func pick(area: Node, key: String, idx: int) -> bool:
	if not Stagemap.add(StorySaveState.stage_maps, key, idx):
		return false
	var n := Stagemap.got(StorySaveState.stage_maps, key).size()
	if Stagemap.done(StorySaveState.stage_maps, key):
		Toast.show(area, "🗺️ 지도 완성 — 이 사냥터 문에서 가운데·끝으로 바로 갈 수 있다", 3.5)
	else:
		Toast.show(area, "🗺️ 지도 조각 %d/%d" % [n, Stagemap.PIECES], 2.5)
	area.queue_free()
	return true
