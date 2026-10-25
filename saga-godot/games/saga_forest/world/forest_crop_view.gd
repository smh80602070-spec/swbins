extends Node3D

## G-0391 — 집 앞 밭(data/forest_crops.gd)을 (15,12) 에 세운다: 2×2 두둑(칸 1.3m, 코드 흙 상자 — 물 받은 칸은 짙은 흙) +
## 단계 모델 씨 = 없음 · 싹 wheat_sprout_01 · 자람 wheat_growing_01 · 다 자람 wheat_ripe_01(있는 GLB, 새 에셋 없음).
## 곁에서 [G] → 칸마다 씨 뿌리기·물 주기·거두기 창. 1초마다: 날 바뀜(advance)·비면 씨 뿌린 칸 저절로 물(weather_visual key "rain").
## 자리는 제작대·집·박물관·낚시터·우리·빈 집·채집·주민 자리와 2칸 넘게(길 남쪽, 집 바로 앞). 충돌 없음.

const Crops := preload("res://games/saga_forest/data/forest_crops.gd")
const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const TerrainBuilder := preload("res://games/saga_forest/world/forest_terrain_builder.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")
const GLBUtils := preload("res://saga_core/world/glb_utils.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const GRID := Vector2i(15, 12)
const CELL := 1.3
const RADIUS := 3.2
const CURVE_AMOUNT := 0.004
const SOIL := Color(0.45, 0.31, 0.2)
const SOIL_WET := Color(0.27, 0.18, 0.12)
const STAGE_GLB := ["", "res://assets/world/wheat_sprout_01.glb", "res://assets/world/wheat_growing_01.glb", "res://assets/world/wheat_ripe_01.glb"]
const FOOT := 1.0   # 모델 바닥 폭(m) — 칸 안에 들게

var _shown := ""
var _in_range := false
var _tick := 0.0
var _meshes := {}   # 단계 → Mesh(한 번 읽음)


func _ready() -> void:
	name = "CropView"
	add_to_group("forest_crop_view")
	position = ForestMap.world_pos(GRID.x, GRID.y) + Vector3(0, TerrainBuilder.LEGEND["."].height, 0)
	var area := Area3D.new()
	var cs := CollisionShape3D.new()
	var sph := SphereShape3D.new()
	sph.radius = RADIUS
	cs.shape = sph
	area.add_child(cs)
	add_child(area)
	area.body_entered.connect(func(b: Node3D) -> void:
		if b.is_in_group("player") and Crops.has_field(ForestSaveState):
			_in_range = true
			Toast.show(self, "🌾 밭 — [G] 씨 뿌리기·물 주기·거두기", 2.5))
	area.body_exited.connect(func(b: Node3D) -> void:
		if b.is_in_group("player"):
			_in_range = false)
	sync()


func _process(delta: float) -> void:
	if _in_range and Input.is_action_just_pressed("forest_gather") and Crops.has_field(ForestSaveState) and not preload("res://games/saga_forest/world/forest_bees.gd").any_gathering(get_tree()):
		open_menu()
	_tick += delta
	if _tick < 1.0:
		return
	_tick = 0.0
	if Crops.has_field(ForestSaveState):
		var adv := Crops.advance(ForestSaveState)
		if not adv.is_empty() and String(adv.text) != "":
			Toast.show(self, String(adv.text), 3.0)
		var wv := get_tree().get_first_node_in_group("saga_weather_visual")
		if wv != null and String(wv.get("key")) == "rain" and Crops.rain_water(ForestSaveState) > 0:
			Toast.show(self, "🌧 비가 밭에 물을 줬다", 2.0)
	sync()


## 밭·칸 단계·물이 바뀌었을 때만 다시 세운다. 세운 작물 모델 수를 돌려준다(점검용).
func sync() -> int:
	var key := "off"
	if Crops.has_field(ForestSaveState):
		var bits: Array = []
		for p: Dictionary in Crops.plots(ForestSaveState):
			bits.append("%d%s" % [int(p.st), "w" if bool(p.wet) else ""])
		key = ",".join(PackedStringArray(bits))
	if key == _shown:
		return _count()
	_shown = key
	for c in get_children():
		if c is Area3D:
			continue
		c.queue_free()
		remove_child(c)
	if key == "off":
		return 0
	var list := Crops.plots(ForestSaveState)
	for i in list.size():
		var p: Dictionary = list[i]
		var at := Vector3((float(i % 2) - 0.5) * CELL, 0, (float(i >> 1) - 0.5) * CELL)
		var bed := _bed(bool(p.wet) and int(p.st) >= 0)
		bed.name = "Bed%d" % i
		bed.position = at
		add_child(bed)
		var s := int(p.st)
		if s >= 1:
			var crop := _crop(s)
			if crop != null:
				crop.name = "Crop%d" % i
				crop.position = at + Vector3(0, 0.12, 0)
				add_child(crop)
		elif s == 0:
			var seed_mark := Node3D.new()   # 고랑 위 씨앗 여섯 알(작은 볏짚색 점)
			seed_mark.name = "Seed%d" % i
			seed_mark.position = at
			for k in 6:
				seed_mark.add_child(_part(_box(Vector3(0.07, 0.05, 0.07)), Vector3((float(k % 3) - 1.0) * 0.35, 0.14, -0.3 + 0.6 * float(k / 3)), Color(0.86, 0.74, 0.46)))
			add_child(seed_mark)
	var l := Label3D.new()
	l.name = "Name"
	l.text = "🌾 밭 [G]"
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.fixed_size = true
	l.pixel_size = 0.0012
	l.font_size = 22
	l.outline_size = 6
	l.position = Vector3(0, 1.6, 0)
	add_child(l)
	return _count()


func _count() -> int:
	var n := 0
	for c in get_children():
		if String(c.name).begins_with("Crop"):
			n += 1
	return n


## 두둑 — 흙 상자 + 고랑 둘(조금 낮은 짙은 줄)
func _bed(wet: bool) -> Node3D:
	var root := Node3D.new()
	var col := SOIL_WET if wet else SOIL
	root.add_child(_part(_box(Vector3(CELL - 0.12, 0.2, CELL - 0.12)), Vector3(0, 0.02, 0), col))
	for z in [-0.3, 0.3]:
		root.add_child(_part(_box(Vector3(CELL - 0.2, 0.03, 0.08)), Vector3(0, 0.13, z), col.darkened(0.3)))
	return root


func _crop(s: int) -> Node3D:
	if not _meshes.has(s):
		var m: Mesh = GLBUtils.extract_mesh(String(STAGE_GLB[s]))
		_meshes[s] = WorldCurveMaterial.textured_surfaces(m, CURVE_AMOUNT, 0.9) if m != null else null
	var mesh: Mesh = _meshes[s]
	if mesh == null:
		return null
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	var bb := mesh.get_aabb()
	var w := maxf(0.01, maxf(bb.size.x, bb.size.z))
	var sc := FOOT / w
	mi.scale = Vector3.ONE * sc
	mi.position = Vector3(-(bb.position.x + bb.size.x * 0.5) * sc, -bb.position.y * sc, -(bb.position.z + bb.size.z * 0.5) * sc)
	var root := Node3D.new()
	root.add_child(mi)
	return root


func _part(m: Mesh, at: Vector3, col: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = m
	mi.position = at
	mi.material_override = WorldCurveMaterial.vertex_color_material(CURVE_AMOUNT, 0.95, col)
	return mi


func _box(size: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = size
	return b


## 칸마다 한 단추 — 빈 두둑 = 씨 · 자라는 중 = 물(이미 줬으면 표시만) · 다 자람 = 거두기
func menu_lines() -> Array:
	var F := ForestSaveState
	var out: Array = []
	for i in Crops.PLOTS:
		var s := Crops.stage(F, i)
		var act := "plant" if s < 0 else ("harvest" if s >= Crops.RIPE else ("water" if not bool(Crops.plots(F)[i].wet) else ""))
		var tail: String = {"plant": "▶ 씨 뿌리기(%s 1, 가방 %d)" % [Crops.FRUIT, F.item_count(Crops.FRUIT)], "water": "▶ 물 주기",
			"harvest": "▶ 거두기(%s +%d)" % [Crops.FRUIT, Crops.HARVEST], "": "오늘 물 줌 — 내일 아침 자란다"}[act]
		out.append({"act": act, "i": i, "label": "%d번 칸 · %s — %s" % [i + 1, Crops.plot_text(F, i), tail]})
	return out


func open_menu() -> void:
	var box := {}
	var choices: Array = []
	for l: Dictionary in menu_lines():
		var line := l
		choices.append({"label": String(l.label), "cb": func() -> void:
			(box["layer"] as CanvasLayer).queue_free()
			_act(line)})
	choices.append({"label": "닫기", "cb": func() -> void: (box["layer"] as CanvasLayer).queue_free()})
	box["layer"] = ChoicePrompt.build(self, "🌾 밭 — 물 받은 칸만 다음 날 한 단계 · 물 준 날 %d → 다 자람 · 비 오면 저절로 물" % Crops.RIPE, choices)


func _act(l: Dictionary) -> void:
	var r := {}
	match String(l.act):
		"plant":
			r = Crops.plant(ForestSaveState, int(l.i))
		"water":
			r = Crops.water(ForestSaveState, int(l.i))
		"harvest":
			r = Crops.harvest(ForestSaveState, int(l.i))
			if bool(r.get("ok", false)):
				Toast.show(self, "🌾 거뒀다 — %s +%d" % [Crops.FRUIT, int(r.got)], 2.0)
	if not r.is_empty() and not bool(r.get("ok", false)):
		Toast.show(self, String(r.why), 2.0)
	sync()
	if String(l.act) != "":
		open_menu()
