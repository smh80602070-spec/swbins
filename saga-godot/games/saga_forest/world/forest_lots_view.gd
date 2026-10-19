extends Node3D

## G-0237 — 작은 빈 집에 눌러앉은 손님을 마을 빈 자리에 세운다(data/forest_lots.gd). 집 모형·손님 고유 몸은 K 몫이라
## 몸은 기존 주민 npc_* 대역(VroidBody, 구면 곡률 재질 — villager_builder._build_body 와 같은 법) + 이름표 + 말 한 줄.
## 자리는 주민 grid·채집 자리·제작대(17,7)·집(15,9)·흙길 10행·박물관(12,6)·낚시터(22,5)를 피한 셋(집 i → SPOTS[i]).

const Lots := preload("res://games/saga_forest/data/forest_lots.gd")
const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const TerrainBuilder := preload("res://games/saga_forest/world/forest_terrain_builder.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")
const VroidBody := preload("res://saga_core/world/vroid_body.gd")

const SPOTS := [Vector2i(3, 5), Vector2i(26, 13), Vector2i(21, 15)]
const CURVE_AMOUNT := 0.004

var _shown := ""


func _ready() -> void:
	name = "LotsView"
	sync()


func _process(_delta: float) -> void:
	if Engine.get_process_frames() % 30 == 0:
		sync()


## 눌러앉은 손님 목록이 바뀌었을 때만 다시 세운다
func sync() -> void:
	var key := ",".join(PackedStringArray(_whos()))
	if key == _shown:
		return
	_shown = key
	for c in get_children():
		c.queue_free()
	var whos := _whos()
	for i in mini(whos.size(), SPOTS.size()):
		if String(whos[i]) != "":
			add_child(_guest(i, String(whos[i])))


func _whos() -> Array:
	var out: Array = []
	for lot: Dictionary in Lots.lots(ForestSaveState):
		out.append(String(lot.get("who", "")))
	return out


func _guest(i: int, who: String) -> Node3D:
	var g := Lots.guest(who)
	var spot: Vector2i = SPOTS[i]
	var root := Node3D.new()
	root.name = "Guest_%s" % who
	root.position = ForestMap.world_pos(spot.x, spot.y) + Vector3(0, TerrainBuilder.LEGEND["."].height, 0)
	var body := VroidBody.build(String(g.get("body", "npc_wanderer")), 2)
	for mi in body.find_children("*", "MeshInstance3D", true, false):
		var m := (mi as MeshInstance3D).mesh
		if m == null:
			continue
		for s in m.get_surface_count():
			var src := m.surface_get_material(s) as BaseMaterial3D
			if src == null or src.albedo_texture == null:
				continue
			var cut := src.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED
			(mi as MeshInstance3D).set_surface_override_material(s, WorldCurveMaterial.cutout_material(src.albedo_texture, CURVE_AMOUNT, 0.9, 0.3) if cut else WorldCurveMaterial.textured_material_from(src.albedo_texture, CURVE_AMOUNT))
	root.add_child(body)
	root.add_child(_label("Name", "🏡 %s" % Lots.guest_label(who), 2.3, 26))
	root.add_child(_label("Line", String(g.get("line", "")), 2.75, 20))
	return root


func _label(nm: String, text: String, y: float, size: int) -> Label3D:
	var l := Label3D.new()
	l.name = nm
	l.text = text
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.fixed_size = true
	l.pixel_size = 0.0012
	l.font_size = size
	l.outline_size = 7
	l.position = Vector3(0, y, 0)
	return l
