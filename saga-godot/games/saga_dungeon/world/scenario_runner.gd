extends Node
## G-0085 — 사가나락 이야기 엔진. test_room.gd 가 세이브를 불러온 뒤 붙인다. 표·규칙은 data/scenario.gd, 진행은 DungeonSaveState.scenario.
##   · 대화 — 지금 단계가 talk 면 창을 띄운다(선택 창[ui_modal]·멈춤·난입 중이면 기다림). 창이 떠 있는 동안 게임을 멈춘다.
##     "다음 ▶"(Space·Enter·누르기)로 한 줄씩, 끝 줄 뒤 닫히면 다음 단계.
##   · 셈 — 나오는 적(dungeon_enemy.gd, 난입·월드 보스 포함)의 died 를 이어 처치·보스 합계를 올린다. 층 단계는 rooms_cleared 를 본다.
##   · 구출 — rescue 단계 동안만 그 방 북쪽에 "⌛ 갇힌 열두시" 표지(코드 도형)를 세운다. 닿으면 구출.
##   · 장이 끝나면 금 보상·알림, 단계가 바뀔 때마다 저장(DungeonSaveState.save) · 목표판 다시 그림(부모 _refresh_goal_board).

const Scenario := preload("res://games/saga_dungeon/data/scenario.gd")
const DungeonEnemy := preload("res://games/saga_dungeon/world/dungeon_enemy.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const CHECK_SEC := 0.3
const RESCUE_RADIUS := 1.8

var st: Dictionary = {}
var _layer: CanvasLayer
var _name_label: Label
var _text_label: Label
var _next_btn: Button
var _lines: Array = []
var _line_i := 0
var _paused_by_me := false
var _marker: Node3D
var _marker_room := -1
var _t := 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS   # 대화 중(멈춤)에도 창 입력을 받는다
	st = Scenario.normalize(DungeonSaveState.scenario)
	DungeonSaveState.scenario = st
	get_tree().node_added.connect(_on_node_added)
	for e in get_tree().get_nodes_in_group("dungeon_enemy"):
		_hook_enemy(e)
	_apply(Scenario.check(st, DungeonSaveState.rooms_cleared))


func _process(delta: float) -> void:
	if _layer != null:
		return
	_t += delta
	if _t < CHECK_SEC:
		return
	_t = 0.0
	if get_tree().paused:
		return
	var done := Scenario.check(st, DungeonSaveState.rooms_cleared)
	if not done.is_empty():
		_apply(done)
	_sync_marker()
	## 난입(파도) 중엔 끝날 때까지 기다린다 — 싸움 한가운데 창이 끼어들지 않게.
	if Scenario.pending_scene(st) != "" and get_tree().get_nodes_in_group("ui_modal").is_empty() and not DungeonHordeState.active:
		open_talk()


## 지금 목표 한 줄(목표판). 다 끝났으면 "".
func objective() -> String:
	return Scenario.objective(st)


func is_talking() -> bool:
	return _layer != null


# ---------------------------------------------------------------- 셈

func _on_node_added(n: Node) -> void:
	if n.get_script() == DungeonEnemy:
		_hook_enemy(n)


func _hook_enemy(n: Node) -> void:
	if n.has_signal("died") and not n.is_connected("died", _on_enemy_died):
		n.connect("died", _on_enemy_died.bind(n))


func _on_enemy_died(n: Node) -> void:
	st.kills = int(st.kills) + 1
	if is_instance_valid(n) and n.is_in_group("dungeon_boss"):
		st.boss_kills = int(st.boss_kills) + 1
	_after_count()


func _after_count() -> void:
	_apply(Scenario.check(st, DungeonSaveState.rooms_cleared))
	_refresh_board()


# ---------------------------------------------------------------- 단계·보상

func _apply(done_chapters: Array) -> void:
	for ch: Dictionary in done_chapters:
		var gold := int(ch.get("gold", 0))
		if gold > 0:
			DungeonGoldState.add(gold)
		Toast.show(get_parent(), "📜 제%d장 「%s」 끝 — 금 +%d" % [int(ch.no), String(ch.title), gold], 4.0)
	if not done_chapters.is_empty():
		_save()
	_refresh_board()


func _save() -> void:
	DungeonSaveState.scenario = st
	var p := get_tree().get_first_node_in_group("player") as Node3D
	if p != null:
		DungeonSaveState.save(p)


func _refresh_board() -> void:
	var parent := get_parent()
	if parent != null and parent.has_method("_refresh_goal_board"):
		parent.call("_refresh_goal_board")


# ---------------------------------------------------------------- 구출 표지

func _sync_marker() -> void:
	var s := Scenario.step(st)
	var want := int(s.get("room", -1)) if String(s.get("t", "")) == "rescue" else -1
	if want == _marker_room:
		return
	if _marker != null and is_instance_valid(_marker):
		_marker.queue_free()
	_marker = null
	_marker_room = want
	if want < 0:
		return
	var origins: Array = get_parent().get("_room_origin_z") if get_parent() != null else []
	if want >= origins.size():
		return
	_marker = _build_marker()
	get_parent().add_child(_marker)
	_marker.global_position = Vector3(0.0, 0.0, float(origins[want]) - 3.5)


func _build_marker() -> Node3D:
	var root := Node3D.new()
	root.name = "ScenarioRescue"
	var mi := MeshInstance3D.new()
	var cap := CapsuleMesh.new()
	cap.radius = 0.35
	cap.height = 1.6
	mi.mesh = cap
	mi.position.y = 0.8
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.55, 0.75, 1.0)
	mat.emission_enabled = true
	mat.emission = Color(0.4, 0.65, 1.0)
	mat.emission_energy_multiplier = 1.2
	mi.material_override = mat
	root.add_child(mi)
	var cage := MeshInstance3D.new()   # 빛 비석 우리 — 둘레 고리
	var torus := TorusMesh.new()
	torus.inner_radius = 0.7
	torus.outer_radius = 0.82
	cage.mesh = torus
	cage.position.y = 0.15
	cage.material_override = mat
	root.add_child(cage)
	var light := OmniLight3D.new()
	light.light_color = Color(0.5, 0.7, 1.0)
	light.omni_range = 5.0
	light.position.y = 1.8
	root.add_child(light)
	var label := Label3D.new()
	label.text = "⌛ 갇힌 열두시"
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 48
	label.outline_size = 10
	label.position.y = 2.2
	root.add_child(label)
	var area := Area3D.new()
	var cs := CollisionShape3D.new()
	var sph := SphereShape3D.new()
	sph.radius = RESCUE_RADIUS
	cs.shape = sph
	cs.position.y = 0.8
	area.add_child(cs)
	area.body_entered.connect(_on_rescue_touched)
	root.add_child(area)
	return root


func _on_rescue_touched(body: Node3D) -> void:
	if body.is_in_group("player"):
		rescue()


## 구출 하나(표지에 닿음 — 점검도 부른다).
func rescue() -> void:
	if String(Scenario.step(st).get("t", "")) != "rescue":
		return
	st.rescues = int(st.rescues) + 1
	Toast.show(get_parent(), "⌛ 빛 비석 우리에 갇혀 있던 시간 여행자를 풀어 주었다.", 3.0)
	_after_count()
	_sync_marker()
	_save()


# ---------------------------------------------------------------- 대화 창

func open_talk() -> void:
	var scene := Scenario.pending_scene(st)
	if scene == "" or _layer != null:
		return
	_lines = Scenario.SCENES.get(scene, [])
	_line_i = 0
	_build_layer()
	if not get_tree().paused:
		get_tree().paused = true
		_paused_by_me = true
	_show_line()


func _build_layer() -> void:
	_layer = CanvasLayer.new()
	_layer.name = "ScenarioTalk"
	_layer.layer = 40
	_layer.process_mode = Node.PROCESS_MODE_ALWAYS
	_layer.add_to_group("ui_modal")
	var panel := PanelContainer.new()
	panel.anchor_left = 0.05
	panel.anchor_right = 0.95
	panel.anchor_top = 0.66
	panel.anchor_bottom = 0.96
	var box := StyleBoxFlat.new()
	box.bg_color = Color(0.06, 0.05, 0.08, 0.92)
	box.border_color = Color(0.85, 0.7, 0.4)
	box.set_border_width_all(2)
	box.set_corner_radius_all(10)
	box.set_content_margin_all(18)
	panel.add_theme_stylebox_override("panel", box)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	var ch := Scenario.chapter(st)
	var title := Label.new()
	title.text = "📜 제%d장 · %s" % [int(ch.get("no", 0)), String(ch.get("title", ""))]
	title.add_theme_font_size_override("font_size", 20)
	title.add_theme_color_override("font_color", Color(0.85, 0.7, 0.4))
	v.add_child(title)
	_name_label = Label.new()
	_name_label.add_theme_font_size_override("font_size", 28)
	_name_label.add_theme_color_override("font_color", Color(1.0, 0.92, 0.7))
	v.add_child(_name_label)
	_text_label = Label.new()
	_text_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_text_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_text_label.add_theme_font_size_override("font_size", 27)
	v.add_child(_text_label)
	_next_btn = Button.new()
	_next_btn.text = "다음 ▶"
	_next_btn.size_flags_horizontal = Control.SIZE_SHRINK_END
	_next_btn.custom_minimum_size = Vector2(150, 48)
	_next_btn.add_theme_font_size_override("font_size", 24)
	_next_btn.pressed.connect(next_line)
	v.add_child(_next_btn)
	panel.add_child(v)
	_layer.add_child(panel)
	get_parent().add_child(_layer)
	_next_btn.grab_focus()   # Space·Enter 가 이 단추를 누른다


func _show_line() -> void:
	var line: Array = _lines[_line_i] if _line_i < _lines.size() else ["me", ""]
	_name_label.text = Scenario.speaker(String(line[0]))
	_text_label.text = String(line[1])
	_next_btn.text = "다음 ▶" if _line_i < _lines.size() - 1 else "닫기 ✓"


## 다음 줄(끝 줄이면 닫고 다음 단계).
func next_line() -> void:
	if _layer == null:
		return
	_line_i += 1
	if _line_i < _lines.size():
		_show_line()
		return
	_layer.queue_free()
	_layer = null
	if _paused_by_me:
		get_tree().paused = false
		_paused_by_me = false
	_apply(Scenario.finish_talk(st, DungeonSaveState.rooms_cleared))
	_sync_marker()
	_save()
