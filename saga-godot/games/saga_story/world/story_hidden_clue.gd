extends RefCounted

## G-0319 숨은 우두머리 옛 비문 — 사냥터(story_field.gd)가 _ready 에서 attach. 보스가 서는 사냥터(보스 스포너가 있는 곳)만.
## 그림은 코드 도형(낮은 돌판 + 보라 글줄 빛), story_map_piece.gd 와 같은 뼈대(Area3D, 닿으면 읽기). 규칙은 data/story_hidden.gd.

const Toast := preload("res://saga_core/ui/toast.gd")
const Hidden := preload("res://games/saga_story/data/story_hidden.gd")

const TRIGGER_RADIUS := 1.0
const READ_GAP_MS := 8000


static func _boss_spawner(field: Node) -> Node:
	for c in field.get_children():
		var sc := c.get_script() as Script
		if sc != null and sc.resource_path.ends_with("story_boss_spawner.gd"):
			return c
	return null


static func attach(field: Node) -> Node:
	if not Hidden.on():
		return null
	var sp := _boss_spawner(field)
	if sp == null:
		return null
	var path := String(sp.get("map_path"))
	var map := load(path) as GDScript
	if map == null or not Hidden.is_hunt_map(path):
		return null
	var key := String(map.stage_key())
	var area := Area3D.new()
	area.name = "HiddenClue"
	area.position = Vector3(float(map.width_m()) - Hidden.CLUE_INSET_M, 0.0, 0.0)
	area.add_to_group("story_hidden_clue")
	var stone := MeshInstance3D.new()
	var sm := BoxMesh.new()
	sm.size = Vector3(0.7, 1.0, 0.22)
	stone.mesh = sm
	stone.position = Vector3(0, 0.5, -0.3)
	var smat := StandardMaterial3D.new()
	smat.albedo_color = Color(0.46, 0.44, 0.42)
	smat.roughness = 0.95
	stone.material_override = smat
	area.add_child(stone)
	var glyph := MeshInstance3D.new()
	var gm := BoxMesh.new()
	gm.size = Vector3(0.42, 0.5, 0.02)
	glyph.mesh = gm
	glyph.position = Vector3(0, 0.55, -0.18)
	var gmat := StandardMaterial3D.new()
	gmat.albedo_color = Hidden.COLOR
	gmat.emission_enabled = true
	gmat.emission = Hidden.COLOR
	gmat.emission_energy_multiplier = 0.6 if Hidden.clue_read(StorySaveState.hidden, key) else 1.8
	glyph.material_override = gmat
	area.add_child(glyph)
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = TRIGGER_RADIUS
	cs.shape = shape
	cs.position = Vector3(0, 0.6, 0)
	area.add_child(cs)
	field.add_child(area)
	area.body_entered.connect(func(body: Node3D) -> void:
		if body.is_in_group("player"):
			read(area, key)
	)
	return area


## 읽기(점검도 부른다) — 새로 읽었으면 true. 이미 읽었으면 글만 다시(READ_GAP_MS 에 한 번).
static func read(area: Node, key: String) -> bool:
	var fresh := Hidden.read_clue(StorySaveState.hidden, key)
	var now := Time.get_ticks_msec()
	if fresh or now - int(area.get_meta("read_ms", -READ_GAP_MS)) >= READ_GAP_MS:
		area.set_meta("read_ms", now)
		Toast.show(area, Hidden.CLUE_TEXT + (" (기록했다)" if fresh else ""), 4.0)
	return fresh
