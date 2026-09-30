extends Node

## 주간 도전 (2026-09-30) — 규칙·표는 data/weekly_goals.gd, 상태는 PartyState.weekly_goals. test_village.gd 가 붙인다.
##   Z(왼쪽 위 "주간 도전" 단추) → 이번 주 도전 다섯: 이름·설명·진척 막대·"받기". 다섯을 다 받으면 "완주 보상"(인연 매듭·견문록·연마석 + 빛나는 신수 알).
##   진척이 목표에 닿으면 알린다(2초마다 살핌). 셈은 업적 노드(value_of)와 알 상태(걸음·부화)에서 읽는다.

signal completed(id: String)
signal claimed(id: String)

const Weekly := preload("res://games/saga_go/data/weekly_goals.gd")
const Growth := preload("res://games/saga_go/data/growth.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const POLL_SEC := 2.0

var is_open := false

var _player: Node3D
var _frozen_before := false
var _poll := 0.0
var _notified := {}
var _layer: CanvasLayer
var _panel: PanelContainer
var _title: Label
var _body: VBoxContainer
var _btn: Button


func _ready() -> void:
	add_to_group("go_weekly_goals")
	if not InputMap.has_action("go_weekly_goals"):
		InputMap.add_action("go_weekly_goals")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_Z
		InputMap.action_add_event("go_weekly_goals", ev)
	_build()


## 셈 값 — 업적 노드가 있으면 그것(상태에서 읽는 것 포함), 걸음·부화는 알 상태.
func provider(stat: String) -> int:
	match stat:
		"walk":
			return int(float(PartyState.eggs.get("walk", 0.0)))
		"hatched":
			return int(PartyState.eggs.get("hatched", 0))
	var ach := get_tree().get_first_node_in_group("go_achievements")
	return int(ach.call("value_of", stat)) if ach != null else 0


func _prov() -> Callable:
	return Callable(self, "provider")


func claimable_count() -> int:
	var n := Weekly.claimable(_prov()).size()
	if Weekly.all_claimed() and not bool(PartyState.weekly_goals.get("bonus", false)):
		n += 1
	return n


func do_claim(id: String) -> bool:
	if not Weekly.claim(id, _prov()):
		return false
	Toast.show(self, "📅 주간 도전 「%s」 보상: 냥 %d · 짧은 견문록 %d" % [Weekly.name_of(id), int(Weekly.REWARD.mora), int(Weekly.REWARD.book_s)], 3.0)
	claimed.emit(id)
	_refresh()
	return true


func do_claim_bonus() -> bool:
	if not Weekly.claim_bonus():
		return false
	get_tree().call_group("go_eggs", "award", "weekly_goal", str(Weekly.week()))
	Toast.show(self, "📅 이번 주 도전을 모두 마쳤다! 인연 매듭 %d · 견문록 %d · 연마석 %d" % [int(Weekly.BONUS.fate_knot), int(Weekly.BONUS.book_m), int(Weekly.BONUS.polish)], 4.0)
	claimed.emit("")
	_refresh()
	return true


func _physics_process(delta: float) -> void:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
	var n := claimable_count() if _player != null else 0
	_btn.visible = not is_open and _player != null and not bool(_player.get("frozen"))
	_btn.text = "주간 도전 (Z)" + (" ●%d" % n if n > 0 else "")
	_poll += delta
	if _poll >= POLL_SEC and _player != null:
		_poll = 0.0
		_check()


## 새로 목표에 닿은 도전을 한 번 알린다.
func _check() -> void:
	Weekly.ensure(_prov())
	for id in Weekly.picks(Weekly.week()):
		var key := "%d|%s" % [Weekly.week(), id]
		if Weekly.done(id, _prov()) and not Weekly.claimed(id) and not _notified.has(key):
			_notified[key] = true
			Toast.show(self, "📅 주간 도전 「%s」 달성 — Z 에서 보상 받기" % Weekly.name_of(id), 3.0)
			completed.emit(id)
	if is_open:
		_refresh()


# ---------------------------------------------------------------- 화면

func _unhandled_input(event: InputEvent) -> void:
	if is_open:
		if event.is_action_pressed("go_weekly_goals") or (event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE):
			close_screen()
			get_viewport().set_input_as_handled()
	elif event.is_action_pressed("go_weekly_goals"):
		if open_screen():
			get_viewport().set_input_as_handled()


func open_screen() -> bool:
	if is_open or _player == null or _player.get("frozen"):
		return false
	if get_tree().get_nodes_in_group("duel_active").size() > 0:
		return false
	is_open = true
	_panel.visible = true
	_frozen_before = bool(_player.get("frozen"))
	_player.set("frozen", true)
	_refresh()
	return true


func close_screen() -> void:
	if not is_open:
		return
	is_open = false
	_panel.visible = false
	if _player:
		_player.set("frozen", _frozen_before)


func _build() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = 6
	add_child(_layer)
	_btn = Button.new()
	## 화면 기준 크기(1920×1280) 좌표 — 사냥 기록 단추 오른쪽.
	_btn.offset_left = 990
	_btn.offset_right = 1250
	_btn.offset_top = 70
	_btn.offset_bottom = 108
	_btn.add_theme_font_size_override("font_size", 15)
	_btn.visible = false
	_btn.pressed.connect(func() -> void: open_screen())
	_layer.add_child(_btn)
	_panel = PanelContainer.new()
	_panel.anchor_left = 0.5
	_panel.anchor_right = 0.5
	_panel.anchor_top = 0.5
	_panel.anchor_bottom = 0.5
	_panel.offset_left = -360
	_panel.offset_right = 360
	_panel.offset_top = -250
	_panel.offset_bottom = 250
	_panel.visible = false
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.07, 0.1, 0.95)
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
	_body = VBoxContainer.new()
	_body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_body.add_theme_constant_override("separation", 8)
	box.add_child(_body)
	var close := Button.new()
	close.text = "닫기 (Z)"
	close.custom_minimum_size = Vector2(0, 40)
	close.pressed.connect(close_screen)
	box.add_child(close)


func _refresh() -> void:
	if _body == null:
		return
	for c in _body.get_children():
		c.queue_free()
	Weekly.ensure(_prov())
	var picks := Weekly.picks(Weekly.week())
	var got := 0
	for id in picks:
		if Weekly.claimed(id):
			got += 1
	_title.text = "📅 주간 도전 — 이번 주 %d/%d 받음 (월요일 새벽 4시에 새로)" % [got, picks.size()]
	for id in picks:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		_body.add_child(row)
		var info := VBoxContainer.new()
		info.custom_minimum_size = Vector2(300, 0)
		row.add_child(info)
		var nm := Label.new()
		nm.text = Weekly.name_of(id)
		nm.add_theme_font_size_override("font_size", 16)
		nm.add_theme_color_override("font_color", Color(0.6, 0.9, 0.65) if Weekly.claimed(id) else Color(1.0, 0.92, 0.7))
		info.add_child(nm)
		var ds := Label.new()
		ds.text = Weekly.desc_of(id)
		ds.add_theme_font_size_override("font_size", 13)
		info.add_child(ds)
		var prog := Weekly.progress(id, _prov())
		var goal := Weekly.goal_of(id)
		var bar := ProgressBar.new()
		bar.max_value = float(goal)
		bar.value = float(mini(prog, goal))
		bar.show_percentage = false
		bar.custom_minimum_size = Vector2(190, 20)
		bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		var fill := StyleBoxFlat.new()
		fill.bg_color = Color(0.45, 0.8, 0.5) if prog < goal else Color(0.9, 0.75, 0.3)
		fill.set_corner_radius_all(3)
		var back := StyleBoxFlat.new()
		back.bg_color = Color(0.2, 0.2, 0.24)
		back.set_corner_radius_all(3)
		bar.add_theme_stylebox_override("fill", fill)
		bar.add_theme_stylebox_override("background", back)
		row.add_child(bar)
		var cnt := Label.new()
		cnt.text = "%d/%d" % [mini(prog, goal), goal]
		cnt.custom_minimum_size = Vector2(80, 0)
		row.add_child(cnt)
		var b := Button.new()
		if Weekly.claimed(id):
			b.text = "받음 ✔"
			b.disabled = true
		elif prog >= goal:
			b.text = "받기 ●"
		else:
			b.text = "—"
			b.disabled = true
		var pid: String = id
		b.pressed.connect(func() -> void: do_claim(pid))
		row.add_child(b)
	var sep := Label.new()
	sep.text = "다섯을 다 받으면 완주 보상: 인연 매듭 %d · 견문록 %d · 연마석 %d · 빛나는 신수 알" % [int(Weekly.BONUS.fate_knot), int(Weekly.BONUS.book_m), int(Weekly.BONUS.polish)]
	sep.add_theme_font_size_override("font_size", 14)
	sep.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_body.add_child(sep)
	var bb := Button.new()
	var bonus_done: bool = bool(PartyState.weekly_goals.get("bonus", false))
	bb.text = "완주 보상 받음 ✔" if bonus_done else "완주 보상 받기"
	bb.disabled = bonus_done or not Weekly.all_claimed()
	bb.custom_minimum_size = Vector2(0, 42)
	bb.pressed.connect(func() -> void: do_claim_bonus())
	_body.add_child(bb)
