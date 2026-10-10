extends Node3D

## PLAN 106장 ⑳ — 원신식 비경(입구·도전·보상 나무). 규칙·표는 data/domains.gd.
##   입구 셋(폐허 무덤·마을 서당·포구 쇠부리 터) + 주간 보스(먹구름 제단) + 52-5 재대결 넷(1차 결말 뒤에만 입구가 보이고 열린다 — Domains.domain_open) — 3m 안에서 F(터치는 뜨는 "비경" 단추)로 단계 고르기 창.
##   "들어가기" → 세상 밖 원판으로 옮겨져 3초 뒤 파도 둘, 120초 안에 다 쓰러뜨리면 가운데 보상 나무 —
##   다가가면 원기 20 을 쓰고 보상(모자라면 못 받음), 2.5초 뒤 입구로 돌아간다. 명단이 다 쓰러지거나 시간이
##   다 되거나 "나가기"면 실패(원기 안 씀). 안에 있는 동안 그룹 go_domain_active — 지도(순간이동)가 안 열린다.
## 비경 적은 field_enemy 를 그대로 쓰되 되살아나지 않고 전리품·경험이 없다(보상은 끝에 한꺼번에).
## 세이브 스키마: PartyState.resin·resin_t 두 필드만(진행 중 도전은 저장 안 함 — 원신도 나가면 처음부터).

const Domains := preload("res://games/saga_go/data/domains.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const RenderBudget := preload("res://games/saga_go/world/render_budget.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const FieldBoss := preload("res://games/saga_go/combat/field_boss.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

signal state_changed(state: String)

enum S { OUTSIDE, STARTING, FIGHTING, CLEARED, LEAVING }

const TREE_M := 2.5
const EXIT_DELAY := 2.5
const SPAWN_R := 8.0

var state := S.OUTSIDE
var current := ""
var level := 0
var wave := 0
var time_left := 0.0
var claimed := false
var last_result := "" # "clear"·"fail_time"·"fail_wipe"·"quit"

var _player: Node3D = null
var _gates: Dictionary = {} # id → Vector3
var _gate_nodes: Dictionary = {} # id → Node3D(잠긴 입구는 숨김 — 52-5 재대결)
var _enemies: Array = []
var _start_t := 0.0
var _water_t := 0.0
var _leave_t := 0.0
var _return_pos := Vector3.ZERO
var _tree: Node3D = null
var _hud_layer: CanvasLayer = null
var _hud_label: Label = null
var _quit_btn: Button = null
var _gate_btn: Button = null
var _menu: Control = null
var _menu_title: Label = null
var _menu_body: Label = null
var _menu_levels: Array[Button] = []
var _menu_id := ""
var _menu_open := false
var _frozen_before := false

func _ready() -> void:
	add_to_group("go_domains")
	_player = get_tree().get_first_node_in_group("player")
	if not InputMap.has_action("go_domain"):
		InputMap.add_action("go_domain")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_F
		InputMap.action_add_event("go_domain", ev)
	for id in Domains.ORDER:
		var d: Dictionary = Domains.DOMAINS[id]
		var g: Vector2 = d.gate[1]
		var p := TestMap.world_pos(g.x, g.y, d.gate[0])
		p.y = TerrainBuilder.height_at(d.gate[0], p)
		_gates[id] = p
		_build_gate(id, p)
		_build_arena(d.arena)
	_build_hud()
	_build_menu()
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	if fc:
		fc.connect("party_wiped", func() -> void:
			if state == S.STARTING or state == S.FIGHTING:
				fail("fail_wipe"))

func gate_pos(id: String) -> Vector3:
	return _gates.get(id, Vector3.INF)

func state_name() -> String:
	return ["outside", "starting", "fighting", "cleared", "leaving"][state]

func alive_enemies() -> Array:
	return _enemies.filter(func(e: Variant) -> bool: return is_instance_valid(e) and not e.call("is_dead"))

## 3m 안 입구 id(없으면 "").
func near_gate() -> String:
	if _player == null or state != S.OUTSIDE:
		return ""
	for id in _gates:
		if Domains.domain_open(id) and _player.global_position.distance_to(_gates[id]) <= Domains.GATE_M:
			return id
	return ""

# ---------------------------------------------------------------- 도전

## 들어간다. 못 들어가면(단계 잠김·이미 안) false.
func enter(id: String, lv: int) -> bool:
	if state != S.OUTSIDE or not Domains.level_open(lv) or not Domains.domain_open(id):
		return false
	close_menu()
	current = id
	level = lv
	wave = 0
	claimed = false
	last_result = ""
	time_left = Domains.time_of(id)
	_start_t = Domains.START_DELAY
	_return_pos = _gates[id] + Vector3(0.0, 0.4, 3.5)
	var arena: Vector3 = Domains.DOMAINS[id].arena
	_teleport(arena + Vector3(0.0, 0.6, Domains.ARENA_R - 5.0))
	state = S.STARTING
	add_to_group("go_domain_active")
	_hud_layer.visible = true
	Toast.show(self, "%s %s — %s" % [Domains.DOMAINS[id].name, Domains.LEVELS[lv].name, Domains.DOMAINS[id].modifier_text], 3.0)
	state_changed.emit(state_name())
	_refresh_hud()
	return true

func _spawn_wave() -> void:
	var d: Dictionary = Domains.DOMAINS[current]
	var kinds: Array = d.waves[wave]
	var lvd: Dictionary = Domains.LEVELS[level]
	var arena: Vector3 = d.arena
	var boss: bool = d.get("boss", false)
	for i in kinds.size():
		var a := PI + (float(i) - (kinds.size() - 1) * 0.5) * 0.7 # 북쪽(플레이어 맞은편)
		var home := arena + Vector3(sin(a) * SPAWN_R, 0.6, cos(a) * SPAWN_R)
		## 주간 보스는 원판 가운데(집에서 26m 넘게 끌려 나가 체력을 채우는 일이 없게).
		if boss:
			home = arena + Vector3(0.0, 0.6, 0.0)
		var e: CharacterBody3D = FieldBoss.new() if boss else FieldEnemy.new()
		e.setup(kinds[i], home, 20260824 + wave * 31 + i)
		e.scale_stats(float(lvd.hp), float(lvd.atk) * (Domains.FURY_MUL if d.modifier == "fury" else 1.0))
		e.respawns = false
		e.drops = false
		e.name = "DomainEnemy_%d_%d" % [wave, i]
		add_child(e)
		e.connect("died", _on_enemy_died)
		_enemies.append(e)
	Toast.show(self, "파도 %d/%d" % [wave + 1, d.waves.size()], 1.5)

func _on_enemy_died(_e: Node) -> void:
	if Domains.DOMAINS.get(current, {}).get("modifier", "") == "energy":
		var fc := get_tree().get_first_node_in_group("go_field_combat")
		if fc:
			fc.call("_gain_energy", Domains.ENERGY_PER_KILL)

func _physics_process(delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		return
	if _gate_btn:
		_gate_btn.visible = near_gate() != "" and not _menu_open
	if Engine.get_physics_frames() % 30 == 0:
		for id in _gate_nodes:
			(_gate_nodes[id] as Node3D).visible = Domains.domain_open(id)
	match state:
		S.STARTING:
			_start_t -= delta
			if _start_t <= 0.0:
				state = S.FIGHTING
				_spawn_wave()
				state_changed.emit(state_name())
			_refresh_hud()
		S.FIGHTING:
			time_left -= delta
			if time_left <= 0.0:
				fail("fail_time")
				return
			if Domains.DOMAINS[current].modifier == "water":
				_water_t -= delta
				if _water_t <= 0.0:
					_water_t = Domains.WATER_EVERY
					for e in alive_enemies():
						if not e.call("is_shielded") and e.get("aura") == "":
							e.call("set_aura", "water")
			if alive_enemies().is_empty():
				_enemies.clear()
				wave += 1
				if wave >= (Domains.DOMAINS[current].waves as Array).size():
					_clear()
				else:
					_spawn_wave()
			_refresh_hud()
		S.CLEARED:
			if not claimed and _tree and _player.global_position.distance_to(_tree.global_position) <= TREE_M:
				claim()
		S.LEAVING:
			_leave_t -= delta
			if _leave_t <= 0.0:
				leave()

func _clear() -> void:
	state = S.CLEARED
	last_result = "clear"
	_tree = _build_tree(Domains.DOMAINS[current].arena)
	Toast.show(self, "도전 성공! 가운데 나무에서 보상 (원기 %d)" % Domains.cost_of(current), 3.0)
	state_changed.emit(state_name())
	_refresh_hud()

## 보상 나무 — 원기를 쓰고 받는다. 받았으면 true(모자라면 알리고 false — 나가기 단추로 나간다).
func claim() -> bool:
	if state != S.CLEARED or claimed:
		return false
	var cost := Domains.cost_of(current)
	if not Domains.spend_resin(cost):
		claimed = true # 한 번만 알린다
		Toast.show(self, "원기가 모자라다 (%d/%d) — 보상 없이 나간다" % [Domains.resin_now(), cost], 3.0)
		_begin_leave()
		return false
	claimed = true
	var d: Dictionary = Domains.DOMAINS[current]
	if d.get("boss", false):
		Domains.add_weekly_claim()
	PartyState.add_items(d.reward[level])
	PartyState.add_exp(Domains.REWARD_EXP[level])
	get_tree().call_group("go_eggs", "award", "weekly" if d.get("boss", false) else "domain", "%s|%d|%d" % [current, level, int(Time.get_unix_time_from_system() / 86400.0)])
	if d.has("artifacts"):
		var a: Array = d.artifacts[level]
		for r in [4, 5]:
			for i in int(a[r - 4]):
				PartyState.add_artifact(r, d.sets[PartyState.artifact_seq % 2])
	Toast.show(self, "보상: %s · 원기 %d/%d" % [Domains.reward_text(current, level), Domains.resin_now(), Domains.RESIN_MAX], 3.5)
	CombatFeel.pickup(_tree, "보상")
	_begin_leave()
	return true

func _begin_leave() -> void:
	state = S.LEAVING
	_leave_t = EXIT_DELAY
	state_changed.emit(state_name())
	_refresh_hud()

func fail(why: String) -> void:
	if state == S.OUTSIDE:
		return
	last_result = why
	var msg := {"fail_time": "시간이 다 됐다 — 도전 실패", "fail_wipe": "모두 쓰러졌다 — 도전 실패", "quit": "비경을 나왔다"}
	Toast.show(self, msg.get(why, "도전 실패"), 2.5)
	leave()

## 입구로 돌아간다(적·나무를 치우고).
func leave() -> void:
	for e in _enemies:
		if is_instance_valid(e):
			e.queue_free()
	_enemies.clear()
	if _tree:
		_tree.queue_free()
		_tree = null
	var was := state
	state = S.OUTSIDE
	remove_from_group("go_domain_active")
	_hud_layer.visible = false
	if was != S.OUTSIDE:
		_teleport(_return_pos)
	state_changed.emit(state_name())

func _teleport(p: Vector3) -> void:
	_player.global_position = p
	_player.set("velocity", Vector3.ZERO)
	if _player.has_method("respawn_safe"):
		_player.set("_last_safe", p)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("go_domain") and not _menu_open:
		var id := near_gate()
		if id != "":
			open_menu(id)
			get_viewport().set_input_as_handled()
	elif _menu_open and event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE:
		close_menu()
		get_viewport().set_input_as_handled()

# ---------------------------------------------------------------- 단계 고르기 창

func open_menu(id: String) -> void:
	if _menu_open or state != S.OUTSIDE:
		return
	for g in ["go_world_map", "go_character_screen", "go_cooking_screen"]:
		var other := get_tree().get_first_node_in_group(g)
		if other and other.get("is_open"):
			return
	_menu_id = id
	_menu_open = true
	_menu.visible = true
	add_to_group("ui_modal")
	_frozen_before = bool(_player.get("frozen"))
	_player.set("frozen", true)
	_refresh_menu()

func close_menu() -> void:
	if not _menu_open:
		return
	_menu_open = false
	_menu.visible = false
	remove_from_group("ui_modal")
	_player.set("frozen", _frozen_before)

func is_menu_open() -> bool:
	return _menu_open

func _refresh_menu() -> void:
	var d: Dictionary = Domains.DOMAINS[_menu_id]
	_menu_title.text = "%s — %s 비경" % [d.name, Domains.KIND_NAMES[d.kind]]
	var head := "보스 하나" if d.get("boss", false) else "파도 %d" % (d.waves as Array).size()
	var week := ""
	if d.get("boss", false):
		week = " · 이번 주 할인 %d/%d 남음" % [maxi(Domains.WEEKLY_DISCOUNTS - Domains.weekly_claims(), 0), Domains.WEEKLY_DISCOUNTS]
	_menu_body.text = "%s\n%s · 제한 %d초 · 보상을 받을 때 원기 %d%s\n원기 %d/%d (8분에 1)" % [d.modifier_text,
		head, int(Domains.time_of(_menu_id)), Domains.cost_of(_menu_id), week, Domains.resin_now(), Domains.RESIN_MAX]
	for lv in _menu_levels.size():
		var b := _menu_levels[lv]
		var lvd: Dictionary = Domains.LEVELS[lv]
		if Domains.level_open(lv):
			b.text = "%s 단계 (권장 Lv.%d) — %s" % [lvd.name, int(lvd.rec), Domains.reward_text(_menu_id, lv)]
			b.disabled = false
		else:
			b.text = "%s 단계 — 모험 등급 %d 에 열림" % [lvd.name, int(lvd.ar)]
			b.disabled = true

func _build_menu() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 6
	add_child(layer)
	_menu = Control.new()
	_menu.set_anchors_preset(Control.PRESET_FULL_RECT)
	_menu.visible = false
	layer.add_child(_menu)
	var dim := ColorRect.new()
	dim.color = Color(0.05, 0.05, 0.1, 0.8)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_menu.add_child(dim)
	## G-0164 — 판 없이 막 위에 바로·설명 16pt 라 가로 창에서 작고 뒤 알림 띠가 비쳤다 — choice_prompt 와 같은 진한 판·큰 글자.
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.07, 0.06, 0.09, 0.93)
	bg.border_color = Color(0.85, 0.7, 0.4, 0.8)
	bg.set_border_width_all(2)
	bg.set_corner_radius_all(14)
	bg.set_content_margin_all(18)
	panel.add_theme_stylebox_override("panel", bg)
	_menu.add_child(panel)
	var box := VBoxContainer.new()
	box.custom_minimum_size = Vector2(700, 0)
	box.add_theme_constant_override("separation", 10)
	panel.add_child(box)
	_menu_title = Label.new()
	_menu_title.add_theme_font_size_override("font_size", 30)
	_menu_title.add_theme_color_override("font_color", Color(1.0, 0.88, 0.6))
	box.add_child(_menu_title)
	_menu_body = Label.new()
	_menu_body.add_theme_font_size_override("font_size", 22)
	_menu_body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(_menu_body)
	for lv in Domains.LEVELS.size():
		var b := Button.new()
		b.custom_minimum_size = Vector2(0, 56)
		b.add_theme_font_size_override("font_size", 24)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		var l: int = lv
		b.pressed.connect(func() -> void: enter(_menu_id, l))
		box.add_child(b)
		_menu_levels.append(b)
	var close := Button.new()
	close.text = "닫기 (Esc)"
	close.custom_minimum_size = Vector2(0, 52)
	close.add_theme_font_size_override("font_size", 24)
	close.pressed.connect(close_menu)
	box.add_child(close)

# ---------------------------------------------------------------- 안내 글자

func _build_hud() -> void:
	var gate_layer := CanvasLayer.new()
	gate_layer.layer = 5
	add_child(gate_layer)
	_gate_btn = Button.new()
	_gate_btn.text = "비경 (F)"
	_gate_btn.anchor_left = 0.5
	_gate_btn.anchor_right = 0.5
	_gate_btn.anchor_top = 1.0
	_gate_btn.anchor_bottom = 1.0
	_gate_btn.offset_left = -70
	_gate_btn.offset_right = 70
	_gate_btn.offset_top = -170
	_gate_btn.offset_bottom = -124
	_gate_btn.visible = false
	_gate_btn.pressed.connect(func() -> void:
		var id := near_gate()
		if id != "":
			open_menu(id))
	gate_layer.add_child(_gate_btn)
	_hud_layer = CanvasLayer.new()
	_hud_layer.layer = 5
	_hud_layer.visible = false
	add_child(_hud_layer)
	_hud_label = Label.new()
	_hud_label.anchor_left = 0.5
	_hud_label.anchor_right = 0.5
	_hud_label.offset_left = -300
	_hud_label.offset_right = 300
	_hud_label.offset_top = 70
	_hud_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hud_label.add_theme_font_size_override("font_size", 18)
	_hud_label.add_theme_color_override("font_outline_color", Color(0, 0, 0))
	_hud_label.add_theme_constant_override("outline_size", 6)
	_hud_layer.add_child(_hud_label)
	_quit_btn = Button.new()
	_quit_btn.text = "나가기"
	_quit_btn.anchor_left = 0.5
	_quit_btn.anchor_right = 0.5
	_quit_btn.offset_left = 320
	_quit_btn.offset_right = 420
	_quit_btn.offset_top = 64
	_quit_btn.offset_bottom = 104
	_quit_btn.pressed.connect(func() -> void:
		if state == S.LEAVING or state == S.CLEARED:
			leave()
		else:
			fail("quit"))
	_hud_layer.add_child(_quit_btn)

func hud_text() -> String:
	return _hud_label.text

func _refresh_hud() -> void:
	if current == "":
		return
	var d: Dictionary = Domains.DOMAINS[current]
	var head := "%s %s" % [d.name, Domains.LEVELS[level].name]
	match state:
		S.STARTING:
			_hud_label.text = "%s — %d초 뒤 시작\n%s" % [head, ceili(_start_t), d.modifier_text]
		S.FIGHTING:
			if d.get("boss", false) and not alive_enemies().is_empty():
				var b: Node = alive_enemies()[0]
				var sh := ""
				if float(b.get("shield")) > 0.0:
					sh = " · 번개 방패 %d" % int(b.get("shield"))
				_hud_label.text = "%s — %s 체력 %d%%%s · %d초\n%s" % [head, b.get("def").name, ceili(float(b.get("hp")) / float(b.get("max_hp")) * 100.0),
					sh, ceili(time_left), d.modifier_text]
			else:
				_hud_label.text = "%s — 파도 %d/%d · 남은 적 %d · %d초\n%s" % [head, wave + 1, (d.waves as Array).size(),
					alive_enemies().size(), ceili(time_left), d.modifier_text]
		S.CLEARED:
			_hud_label.text = "%s — 성공! 가운데 나무로 (원기 %d/%d)" % [head, Domains.resin_now(), Domains.cost_of(current)]
		S.LEAVING:
			_hud_label.text = "%s — 곧 입구로 돌아간다" % head

# ---------------------------------------------------------------- 모양

func _stone() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.5, 0.48, 0.46)
	m.roughness = 0.9
	return m

func _glow(c: Color, alpha: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(c.r, c.g, c.b, alpha)
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m

func _mesh(parent: Node3D, mesh: Mesh, mat: Material, pos: Vector3) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	parent.add_child(mi)
	return mi

func _build_gate(id: String, p: Vector3) -> void:
	var root := Node3D.new()
	root.name = "DomainGate_" + id
	add_child(root)
	_gate_nodes[id] = root
	root.visible = Domains.domain_open(id)
	root.global_position = p
	var stone := _stone()
	for x in [-1.4, 1.4]:
		var bm := BoxMesh.new()
		bm.size = Vector3(0.6, 3.6, 0.6)
		_mesh(root, bm, stone, Vector3(x, 1.8, 0.0))
	var top := BoxMesh.new()
	top.size = Vector3(4.0, 0.5, 0.8)
	_mesh(root, top, stone, Vector3(0.0, 3.8, 0.0))
	RenderBudget.merge_children(root)   # G-0114 — 기둥 둘·들보(같은 돌)를 한 메시로, 문 원판은 따로
	var disc := CylinderMesh.new()
	disc.top_radius = 1.1
	disc.bottom_radius = 1.1
	disc.height = 0.05
	var portal := _mesh(root, disc, _glow(Color(0.65, 0.5, 1.0), 0.55), Vector3(0.0, 1.8, 0.0))
	portal.rotation.x = PI * 0.5
	portal.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var tw := portal.create_tween().set_loops()
	tw.tween_property(portal, "scale", Vector3(1.08, 1.0, 1.08), 1.2).set_trans(Tween.TRANS_SINE)
	tw.tween_property(portal, "scale", Vector3(0.94, 1.0, 0.94), 1.2).set_trans(Tween.TRANS_SINE)
	var label := Label3D.new()
	label.text = Domains.DOMAINS[id].name
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 48
	label.outline_size = 10
	label.position = Vector3(0.0, 4.6, 0.0)
	root.add_child(label)

func _build_arena(center: Vector3) -> void:
	var body := StaticBody3D.new()
	body.name = "DomainArena"
	body.collision_layer = 1
	add_child(body)
	body.global_position = center
	var floor_mesh := CylinderMesh.new()
	floor_mesh.top_radius = Domains.ARENA_R
	floor_mesh.bottom_radius = Domains.ARENA_R
	floor_mesh.height = 1.0
	floor_mesh.radial_segments = 32
	var fm := _stone()
	fm.albedo_color = Color(0.38, 0.36, 0.42)
	_mesh(body, floor_mesh, fm, Vector3(0.0, -0.5, 0.0))
	var fs := CylinderShape3D.new()
	fs.radius = Domains.ARENA_R
	fs.height = 1.0
	var fcs := CollisionShape3D.new()
	fcs.shape = fs
	fcs.position = Vector3(0.0, -0.5, 0.0)
	body.add_child(fcs)
	var ring := TorusMesh.new()
	ring.inner_radius = 5.6
	ring.outer_radius = 6.0
	var rmi := _mesh(body, ring, _glow(Color(0.65, 0.5, 1.0), 0.5), Vector3(0.0, 0.03, 0.0))
	rmi.scale = Vector3(1.0, 0.05, 1.0)
	## 둘레 기둥 + 보이지 않는 벽(떨어지지 않게).
	var stone := _stone()
	for i in 16:
		var a := TAU * i / 16.0
		var at := Vector3(sin(a), 0.0, cos(a)) * (Domains.ARENA_R - 0.4)
		if i % 2 == 0:
			var pm := BoxMesh.new()
			pm.size = Vector3(0.8, 3.0, 0.8)
			_mesh(body, pm, stone, at + Vector3(0.0, 1.5, 0.0))
		var ws := BoxShape3D.new()
		ws.size = Vector3(7.2, 6.0, 0.6)
		var wcs := CollisionShape3D.new()
		wcs.shape = ws
		wcs.position = at + Vector3(0.0, 3.0, 0.0)
		wcs.rotation.y = a
		body.add_child(wcs)
	var light := OmniLight3D.new()
	light.light_color = Color(0.8, 0.75, 1.0)
	light.light_energy = 1.2
	light.omni_range = 26.0
	light.position = Vector3(0.0, 8.0, 0.0)
	body.add_child(light)

func _build_tree(center: Vector3) -> Node3D:
	var root := Node3D.new()
	root.name = "RewardTree"
	add_child(root)
	root.global_position = center
	var bark := StandardMaterial3D.new()
	bark.albedo_color = Color(0.42, 0.3, 0.2)
	var trunk := CylinderMesh.new()
	trunk.top_radius = 0.25
	trunk.bottom_radius = 0.4
	trunk.height = 2.2
	_mesh(root, trunk, bark, Vector3(0.0, 1.1, 0.0))
	var crown := SphereMesh.new()
	crown.radius = 1.4
	crown.height = 2.4
	var cm := StandardMaterial3D.new()
	cm.albedo_color = Color(0.95, 0.8, 0.35)
	cm.emission_enabled = true
	cm.emission = Color(0.95, 0.75, 0.3) * 0.6
	_mesh(root, crown, cm, Vector3(0.0, 2.8, 0.0))
	var halo := SphereMesh.new()
	halo.radius = 2.2
	halo.height = 4.4
	var h := _mesh(root, halo, _glow(Color(1.0, 0.85, 0.4), 0.14), Vector3(0.0, 2.6, 0.0))
	h.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return root
