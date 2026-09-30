extends Node3D

## 신수 알 · 동행 신수 (2026-09-30) — 규칙·수치는 data/eggs.gd, 상태는 PartyState.eggs. test_village.gd 가 붙인다.
##   · 걸음 — 플레이어가 움직인 거리(m)를 부화기의 알에 준다(순간이동은 안 센다). 다 차면 부화 → 신수 도감에 도장.
##   · 화면 — I(터치 "신수 알" 단추): 부화기 칸(진행 막대)·알 주머니(넣기)·동행 신수 고르기. 열려 있는 동안 플레이어는 얼음.
##   · 알 얻기 — 상자·의뢰·비경·보스 꽃이 그룹 "go_eggs" 의 award(곳, 열쇠)를 부른다.
##   · 동행 — 고른 신수가 뒤따라 걷는다(CreatureBuilder.build_pet). 탈것을 타면 숨는다.

signal hatched(pet_id: String, dup: bool)
signal egg_gained(tier_id: String)
signal changed()

const Eggs := preload("res://games/saga_go/data/eggs.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")
const Pets := preload("res://saga_core/data/pets.gd")
const CreatureBuilder := preload("res://games/saga_go/world/creature_builder.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const BUDDY_HEIGHT := 1.05
const FOLLOW_GAP := 2.4
const FOLLOW_SPEED := 9.0
const SNAP_DIST := 16.0

var is_open := false
var announced_hatch := 0 # 점검용

var _player: Node3D
var _last_pos := Vector3.INF
var _dir := Vector3(0, 0, 1)
var _frozen_before := false
var _layer: CanvasLayer
var _panel: PanelContainer
var _title: Label
var _body: VBoxContainer
var _prompt_btn: Button
var _refresh_t := 0.0
var _buddy: Node3D
var _buddy_id := ""
var _buddy_anim := ""


func _ready() -> void:
	add_to_group("go_eggs")
	if not InputMap.has_action("go_eggs"):
		InputMap.add_action("go_eggs")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_I
		InputMap.action_add_event("go_eggs", ev)
	_build_screen()


# ---------------------------------------------------------------- 알 얻기

## 곳(data/eggs.gd SOURCES)에서 알이 나왔는지 굴려 주머니에 넣는다. 그룹 "go_eggs" 로 부른다.
func award(source: String, key: String = "") -> void:
	for t in Eggs.roll(source, key):
		var td := Eggs.tier(t)
		if Eggs.add_egg(t) == "ok":
			Toast.show(self, "%s %s 을(를) 얻었다 — 알 주머니 (I)" % [td.emoji, td.name], 3.0)
			egg_gained.emit(t)
		else:
			PartyState.add_items({"mora": Eggs.DUP_MORA})
			Toast.show(self, "알 주머니가 가득 차 %s 대신 냥 %d" % [td.name, Eggs.DUP_MORA], 3.0)
	changed.emit()
	if is_open:
		_refresh()


# ---------------------------------------------------------------- 걸음 · 동행

func _physics_process(delta: float) -> void:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
		_last_pos = Vector3.INF
		return
	var p := _player.global_position
	if _last_pos != Vector3.INF:
		var moved := Vector2(p.x - _last_pos.x, p.z - _last_pos.z).length()
		if moved > 0.001 and moved <= Eggs.STEP_CAP_M:
			_walk(moved)
			var flat := Vector3(p.x - _last_pos.x, 0, p.z - _last_pos.z)
			if flat.length() > 0.005:
				_dir = flat.normalized()
	_last_pos = p
	_update_buddy(delta)
	_prompt_btn.visible = not is_open and not bool(_player.get("frozen")) and (Eggs.state().bag as Array).size() + (Eggs.state().inc as Array).size() > 0
	_prompt_btn.text = "신수 알 (I)"
	if is_open:
		_refresh_t -= delta
		if _refresh_t <= 0.0:
			_refresh_t = 0.5
			_refresh()


func _walk(meters: float) -> void:
	var lv0 := PartyState.buddy_level()
	var out := Eggs.walk(meters)
	var lv1 := PartyState.buddy_level()
	if lv1 != lv0:
		PartyState.refresh_power()
		Toast.show(self, "🐾 %s 와(과) 친밀 Lv %d/10 — %s (지금 +%.1f%%)" % [Eggs.pet_name(String(Eggs.state().buddy)), lv1, Eggs.bonus_label(String(Eggs.state().buddy)), 100.0 * maxf(PartyState.buddy_bonus("atk"), maxf(PartyState.buddy_bonus("exp"), PartyState.buddy_bonus("def")))], 3.5)
		changed.emit()
		if is_open:
			_refresh()
	for h in out:
		announced_hatch += 1
		var pname := Eggs.pet_name(String(h.pet))
		if bool(h.dup):
			Toast.show(self, "🐣 %s 이(가) 부화했다 — 이미 아는 신수라 냥 %d·경험 %d" % [pname, Eggs.DUP_MORA, int(Eggs.DUP_EXP)], 4.0)
		else:
			Toast.show(self, "🐣 새 신수 %s 이(가) 부화했다! 도감에 올랐다" % pname, 4.5)
		hatched.emit(String(h.pet), bool(h.dup))
	if not out.is_empty():
		changed.emit()
		if is_open:
			_refresh()


func _update_buddy(delta: float) -> void:
	var want := String(Eggs.state().buddy)
	if want != _buddy_id:
		_buddy_id = want
		if _buddy != null:
			_buddy.queue_free()
			_buddy = null
		if want != "":
			_buddy = CreatureBuilder.build_pet(want, BUDDY_HEIGHT)
			add_child(_buddy)
			_buddy.global_position = _player.global_position - _dir * FOLLOW_GAP
			_buddy_anim = ""
	if _buddy == null:
		return
	var mount := _player.get_node_or_null("Mount")
	_buddy.visible = not (mount != null and bool(mount.call("is_riding")))
	var target := _player.global_position - _dir * FOLLOW_GAP
	var cur := _buddy.global_position
	var gap := Vector2(target.x - cur.x, target.z - cur.z)
	var moving := false
	if gap.length() > SNAP_DIST:
		cur = target
	elif gap.length() > 0.35:
		var step := minf(gap.length(), FOLLOW_SPEED * delta * clampf(gap.length() / 1.5, 0.6, 3.0))
		var d := gap.normalized() * step
		cur.x += d.x
		cur.z += d.y
		moving = true
		_buddy.rotation.y = lerp_angle(_buddy.rotation.y, atan2(d.x, d.y), 0.25)
	var p := Vector3(cur.x, 0, cur.z)
	var region := TestMap.region_at(p)
	cur.y = TerrainBuilder.height_at(region, p) if region != "" else _player.global_position.y
	_buddy.global_position = cur
	var anim := "walk" if moving else "idle"
	if anim != _buddy_anim:
		var ap := _buddy.get_node_or_null("AnimationPlayer") as AnimationPlayer
		if ap != null and ap.has_animation(anim):
			ap.play(anim)
			_buddy_anim = anim


# ---------------------------------------------------------------- 화면

func _unhandled_input(event: InputEvent) -> void:
	if is_open:
		if event.is_action_pressed("go_eggs") or (event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE):
			close_screen()
			get_viewport().set_input_as_handled()
	elif event.is_action_pressed("go_eggs"):
		if open_screen():
			get_viewport().set_input_as_handled()


func open_screen() -> bool:
	if is_open or _player == null or _player.get("frozen"):
		return false
	if get_tree().get_nodes_in_group("duel_active").size() > 0:
		return false
	is_open = true
	_panel.visible = true
	add_to_group("ui_modal")
	_frozen_before = bool(_player.get("frozen"))
	_player.set("frozen", true)
	_refresh()
	return true


func close_screen() -> void:
	if not is_open:
		return
	is_open = false
	_panel.visible = false
	remove_from_group("ui_modal")
	if _player:
		_player.set("frozen", _frozen_before)


func _build_screen() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = 6
	add_child(_layer)
	_prompt_btn = Button.new()
	_prompt_btn.anchor_left = 1.0
	_prompt_btn.anchor_right = 1.0
	_prompt_btn.anchor_top = 0.0
	_prompt_btn.anchor_bottom = 0.0
	_prompt_btn.offset_left = -170
	_prompt_btn.offset_right = -20
	_prompt_btn.offset_top = 96
	_prompt_btn.offset_bottom = 136
	_prompt_btn.visible = false
	_prompt_btn.pressed.connect(func() -> void: open_screen())
	_layer.add_child(_prompt_btn)
	_panel = PanelContainer.new()
	_panel.anchor_left = 0.5
	_panel.anchor_right = 0.5
	_panel.anchor_top = 0.5
	_panel.anchor_bottom = 0.5
	_panel.offset_left = -340
	_panel.offset_right = 340
	_panel.offset_top = -300
	_panel.offset_bottom = 300
	_panel.visible = false
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.07, 0.09, 0.93)
	sb.set_corner_radius_all(10)
	sb.content_margin_left = 16
	sb.content_margin_right = 16
	sb.content_margin_top = 12
	sb.content_margin_bottom = 12
	_panel.add_theme_stylebox_override("panel", sb)
	_layer.add_child(_panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	_panel.add_child(box)
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 19)
	_title.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5))
	box.add_child(_title)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(0, 470)
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(scroll)
	_body = VBoxContainer.new()
	_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_body.add_theme_constant_override("separation", 6)
	scroll.add_child(_body)
	var close := Button.new()
	close.text = "닫기 (I)"
	close.custom_minimum_size = Vector2(0, 40)
	close.pressed.connect(close_screen)
	box.add_child(close)


func _label(text: String, size := 15, color := Color(0.92, 0.92, 0.92)) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_body.add_child(l)
	return l


func _refresh() -> void:
	if _body == null:
		return
	for c in _body.get_children():
		c.queue_free()
	var s := Eggs.state()
	var slots := Eggs.slots_for_ar(Adventure.ar())
	_title.text = "🥚 신수 알 · 동행 — 신수 %d/%d · 걸은 거리 %.1fkm · 부화 %d" % [Eggs.owned_count(), Pets.PETS.size(), float(s.walk) / 1000.0, int(s.hatched)]
	_label("부화기 (%d/%d칸) — 걸으면 찬다" % [(s.inc as Array).size(), slots], 17, Color(1.0, 0.9, 0.6))
	for i in slots:
		if i < (s.inc as Array).size():
			var e: Dictionary = (s.inc as Array)[i]
			var t := Eggs.tier(String(e.tier))
			var row := HBoxContainer.new()
			_body.add_child(row)
			var l := Label.new()
			l.text = "%s %s" % [t.emoji, t.name]
			l.custom_minimum_size = Vector2(150, 0)
			row.add_child(l)
			var bar := ProgressBar.new()
			bar.max_value = float(t.need)
			bar.value = float(e.walked)
			bar.custom_minimum_size = Vector2(300, 22)
			bar.show_percentage = false
			var fill := StyleBoxFlat.new()
			fill.bg_color = Color(0.45, 0.85, 0.4)
			fill.set_corner_radius_all(4)
			var back := StyleBoxFlat.new()
			back.bg_color = Color(0.2, 0.2, 0.24)
			back.set_corner_radius_all(4)
			bar.add_theme_stylebox_override("fill", fill)
			bar.add_theme_stylebox_override("background", back)
			row.add_child(bar)
			var cnt := Label.new()
			cnt.text = " %d/%dm" % [int(float(e.walked)), int(t.need)]
			row.add_child(cnt)
			var b := Button.new()
			b.text = "빼기"
			var idx := i
			b.pressed.connect(func() -> void: _do(Eggs.stop(idx)))
			row.add_child(b)
		else:
			_label("· 빈 칸", 15, Color(0.6, 0.6, 0.65))
	if slots < Eggs.SLOT_AR.size():
		_label("칸이 더 열리는 모험 등급: %s" % ", ".join(Eggs.SLOT_AR.map(func(a): return str(a))), 13, Color(0.6, 0.6, 0.65))
	_label("알 주머니 (%d/%d)" % [(s.bag as Array).size(), Eggs.BAG_MAX], 17, Color(1.0, 0.9, 0.6))
	if (s.bag as Array).is_empty():
		_label("· 알이 없다 — 상자·오늘의 의뢰·비경·보스 꽃에서 나온다", 14, Color(0.6, 0.6, 0.65))
	for i in (s.bag as Array).size():
		var t2 := Eggs.tier(String((s.bag as Array)[i]))
		var b2 := Button.new()
		b2.text = "%s %s (%dm) — 부화기에 넣기" % [t2.emoji, t2.name, int(t2.need)]
		b2.alignment = HORIZONTAL_ALIGNMENT_LEFT
		var bi := i
		b2.pressed.connect(func() -> void: _do(Eggs.start(bi, Adventure.ar())))
		_body.add_child(b2)
	_label("동행 신수 — 함께 %dm 걸을 때마다 냥 %d · %dm 마다 친밀 +1(최대 10)" % [int(Eggs.BUDDY_M), Eggs.BUDDY_MORA, int(PartyState.BUDDY_LEVEL_M)], 17, Color(1.0, 0.9, 0.6))
	var cur := String(s.buddy)
	if cur != "":
		var fm := float((s.get("friend", {}) as Dictionary).get(cur, 0.0))
		_label("지금 %s — 친밀 Lv %d/10 (%dm) · %s" % [Eggs.pet_name(cur), PartyState.buddy_level(), int(fm), Eggs.bonus_label(cur)], 15, Color(0.7, 0.95, 0.75))
	var grid := GridContainer.new()
	grid.columns = 4
	_body.add_child(grid)
	var none := Button.new()
	none.text = "동행 안 함" + (" ✔" if String(s.buddy) == "" else "")
	none.pressed.connect(func() -> void: _do(Eggs.set_buddy("")))
	grid.add_child(none)
	for p in Pets.PETS:
		if not CodexState.has("pet", String(p.id)):
			continue
		var pb := Button.new()
		pb.text = "%s %s%s
%s" % [p.emoji, p.name, " ✔" if String(s.buddy) == String(p.id) else "", Eggs.bonus_label(String(p.id))]
		var pid: String = p.id
		pb.pressed.connect(func() -> void: _do(Eggs.set_buddy(pid)))
		grid.add_child(pb)


func _do(err: String) -> void:
	if err != "":
		Toast.show(self, err, 2.0)
	changed.emit()
	_refresh()
