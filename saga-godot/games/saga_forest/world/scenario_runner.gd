extends Node
## G-0086 — 사가마을 이야기 엔진. forest_village.gd 가 세이브를 불러온 뒤 붙인다. 표·규칙은 data/scenario.gd, 진행은 ForestSaveState.scenario.
##   · 대화 — 지금 단계가 talk 면 공용 창(saga_core/ui/talk_box.gd)을 띄운다(선택 창[ui_modal]·멈춤 중이면 기다림). 고르기 답은 choices 에.
##   · 셈 — 이 판은 신호가 없어(폴링 판) 0.3초마다 지금 모습(가구 수·주민/명소 곁·바이옴·하트·사고 기증)을 모아 단계를 본다.
##     채집만 CombatFeel.pickup_triggered("꽃 +1" 꼴)를 받아 갈래별로 센다(보유 수는 팔거나 기증하면 줄어서).
##   · 명소 표지 — spot 단계 동안만 그 명소 곁에 표지(코드 도형, 예 "📮 옛 우체통")를 세운다.
##   · 장이 끝나면 금·알림, 기념 놀이(fest)는 알림, 단계가 바뀌면 저장(ForestSaveState.save).

const Scenario := preload("res://games/saga_forest/data/scenario.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const TalkBox := preload("res://saga_core/ui/talk_box.gd")
const VillagerBuilder := preload("res://games/saga_forest/world/villager_builder.gd")

const CHECK_SEC := 0.3
const NEAR_M := 4.0
const MAP_W := 30
const MAP_H := 20

var st: Dictionary = {}
var _layer: CanvasLayer
var _marker: Node3D
var _marker_key := ""
var _t := 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	st = Scenario.normalize(ForestSaveState.scenario)
	ForestSaveState.scenario = st
	CombatFeel.pickup_triggered.connect(_on_pickup)


func _exit_tree() -> void:
	if CombatFeel.pickup_triggered.is_connected(_on_pickup):
		CombatFeel.pickup_triggered.disconnect(_on_pickup)


func _process(delta: float) -> void:
	if _layer != null:
		return
	_t += delta
	if _t < CHECK_SEC:
		return
	_t = 0.0
	if get_tree().paused:
		return
	tick()


## 한 번 보기(점검도 부른다): 단계 넘김·표지·대화 열기.
func tick() -> void:
	_apply(Scenario.check(st, context()))
	_sync_marker()
	if Scenario.pending_scene(st) != "" and _layer == null and get_tree().get_nodes_in_group("ui_modal").is_empty():
		open_talk()


func objective() -> String:
	return Scenario.objective(st)


func is_talking() -> bool:
	return _layer != null


# ---------------------------------------------------------------- 지금 모습

func context() -> Dictionary:
	var p := get_tree().get_first_node_in_group("player") as Node3D
	var near := {}
	var biome := ""
	if p != null:
		for path in ["Villager/Villager_npc_keeper", "Landmarks/Landmark_forest_shrine_stone"]:
			var n := get_parent().get_node_or_null(path) as Node3D
			if n != null:
				near[String(path).get_slice("/", 1).trim_prefix("Villager_").trim_prefix("Landmark_")] = _flat_dist(p.global_position, n.global_position) <= NEAR_M
		var gx := roundi(p.global_position.x / 3.0 + MAP_W / 2.0)
		var gy := roundi(p.global_position.z / 3.0 + MAP_H / 2.0)
		if gx >= 0 and gx < MAP_W and gy >= 0 and gy < MAP_H:   # 집 안(먼 자리)은 바이옴 없음
			biome = String(ForestBiome.biome_at(gx, gy).get("key", ""))
	var max_heart := 0
	for v: Dictionary in VillagerBuilder.VILLAGERS:
		max_heart = maxi(max_heart, ForestSaveState.heart(String(v.id)))
	return {"home_items": ForestSaveState.home_items.size(), "near": near, "biome": biome,
		"max_heart": max_heart, "donated": ForestSaveState.museum_donated_by_cat}


static func _flat_dist(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()


func _on_pickup(label: String) -> void:
	var cat := label.get_slice(" ", 0)
	if cat == "":
		return
	Scenario.add_gather(st, cat)


# ---------------------------------------------------------------- 단계·보상

func _apply(results: Array) -> void:
	var changed := false
	for r: Dictionary in results:
		changed = true
		if r.has("fest"):
			Toast.show(get_parent(), "🌸 숲지기가 %s를 열었다 — 호연이 꽃 좌판을 펼친다." % Scenario.FEST_NAMES.get(String(r.fest), String(r.fest)), 4.0)
		if r.has("chapter"):
			var ch: Dictionary = r.chapter
			var gold := int(ch.get("gold", 0))
			if gold > 0:
				ForestSaveState.add_gold(gold)
			Toast.show(get_parent(), "📜 봄 %d장 「%s」 끝 — 골드 +%d" % [int(ch.no), String(ch.title), gold], 4.0)
	if changed:
		_save()


func _save() -> void:
	ForestSaveState.scenario = st
	ForestSaveState.save()


# ---------------------------------------------------------------- 명소 표지

func _sync_marker() -> void:
	var s := Scenario.step(st)
	var want := String(s.get("key", "")) if String(s.get("t", "")) == "spot" else ""
	if want == _marker_key:
		return
	if _marker != null and is_instance_valid(_marker):
		_marker.queue_free()
	_marker = null
	_marker_key = want
	if want == "":
		return
	var lm := get_parent().get_node_or_null("Landmarks/Landmark_" + want) as Node3D
	if lm == null:
		return
	_marker = _build_postbox(String(s.get("label", "")))
	get_parent().add_child(_marker)
	_marker.global_position = lm.global_position + Vector3(1.6, 0.0, 0.0)


func _build_postbox(label_text: String) -> Node3D:
	var root := Node3D.new()
	root.name = "ScenarioSpot"
	var red := StandardMaterial3D.new()
	red.albedo_color = Color(0.78, 0.16, 0.12)
	var dark := StandardMaterial3D.new()
	dark.albedo_color = Color(0.2, 0.16, 0.12)
	var post := MeshInstance3D.new()
	var pm := BoxMesh.new()
	pm.size = Vector3(0.18, 1.0, 0.18)
	post.mesh = pm
	post.position.y = 0.5
	post.material_override = dark
	root.add_child(post)
	var box := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.6, 0.7, 0.5)
	box.mesh = bm
	box.position.y = 1.3
	box.material_override = red
	root.add_child(box)
	var slot := MeshInstance3D.new()   # 편지 넣는 틈
	var sm := BoxMesh.new()
	sm.size = Vector3(0.36, 0.05, 0.02)
	slot.mesh = sm
	slot.position = Vector3(0.0, 1.45, 0.26)
	slot.material_override = dark
	root.add_child(slot)
	var light := OmniLight3D.new()   # 빛 편지
	light.light_color = Color(1.0, 0.85, 0.5)
	light.omni_range = 4.0
	light.position.y = 1.8
	root.add_child(light)
	var label := Label3D.new()
	label.text = label_text
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 48
	label.outline_size = 10
	label.position.y = 2.2
	root.add_child(label)
	return root


# ---------------------------------------------------------------- 대화

func open_talk() -> void:
	var scene := Scenario.pending_scene(st)
	if scene == "" or _layer != null:
		return
	var def: Dictionary = Scenario.SCENES.get(scene, {})
	var lines: Array = []
	for l: Array in def.get("lines", []):
		lines.append([Scenario.speaker(String(l[0])), String(l[1])])
	var ch := Scenario.chapter(st)
	_layer = TalkBox.open(get_parent(), "📜 봄 %d장 · %s" % [int(ch.get("no", 0)), String(ch.get("title", ""))], lines, _on_talk_done, def.get("choice", {}))


## 지금 창의 다음 줄 / 고르기(점검·흉내용).
func next_line() -> void:
	if _layer != null and is_instance_valid(_layer):
		_layer.call("next_line")


func pick(key: String) -> void:
	if _layer != null and is_instance_valid(_layer):
		_layer.call("pick", key)


func _on_talk_done(answer: String) -> void:
	_layer = null
	_apply(Scenario.finish_talk(st, context(), answer))
	_sync_marker()
	_save()
