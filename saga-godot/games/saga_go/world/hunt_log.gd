extends Node

## 사냥 기록 (2026-09-30) — 규칙·수치는 data/hunt.gd, 상태는 PartyState.hunt. test_village.gd 가 붙인다.
##   들판의 적이 쓰러질 때마다(FieldEnemy died) 그 종의 마릿수를 센다 — 지금 있는 적 + 나중에 생기는 적(node_added) 모두.
##   H(왼쪽 위 "사냥 기록" 단추) → 종 목록(만난 적 없으면 "???"): 이름·원소·마릿수·다음 단계 막대·"받기". 아래 "모두 받기".
##   새 단계에 닿으면 알린다.

signal recorded(kind: String, count: int)
signal tier_reached(kind: String, tier: int)
signal claimed(kind: String, items: Dictionary)

const Hunt := preload("res://games/saga_go/data/hunt.gd")
const Growth := preload("res://games/saga_go/data/growth.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

var is_open := false

var _player: Node3D
var _frozen_before := false
var _layer: CanvasLayer
var _panel: PanelContainer
var _title: Label
var _body: VBoxContainer
var _btn: Button


func _ready() -> void:
	add_to_group("go_hunt")
	if not InputMap.has_action("go_hunt"):
		InputMap.add_action("go_hunt")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_H
		InputMap.action_add_event("go_hunt", ev)
	_build()
	get_tree().node_added.connect(_on_node_added)
	_hook.call_deferred()


func _hook() -> void:
	for e in get_tree().get_nodes_in_group("field_enemy"):
		_hook_enemy(e)


func _on_node_added(n: Node) -> void:
	if n.is_in_group("field_enemy") or n.get("kind") != null and n.has_signal("died"):
		_hook_enemy(n)


func _hook_enemy(e: Node) -> void:
	if e.has_signal("died") and not e.is_connected("died", _on_died):
		e.connect("died", _on_died)


func _on_died(enemy: Node) -> void:
	on_kill(String(enemy.get("kind")))


## 한 마리 쓰러뜨림 — 점검이 직접 부르기도 한다.
func on_kill(kind: String) -> void:
	var before := Hunt.tier_reached(kind)
	var n := Hunt.record(kind)
	if n <= 0:
		return
	recorded.emit(kind, n)
	if n == 1:
		Toast.show(self, "📖 사냥 기록 — %s 을(를) 처음 쓰러뜨렸다 (H)" % Hunt.display_name(kind), 3.0)
	var after := Hunt.tier_reached(kind)
	if after > before:
		tier_reached.emit(kind, after)
		Toast.show(self, "📖 %s 사냥 기록 %d단계! — H 에서 보상 받기" % [Hunt.display_name(kind), after], 3.5)
	if is_open:
		_refresh()


func _physics_process(_delta: float) -> void:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
	_btn.visible = not is_open and _player != null and not bool(_player.get("frozen"))
	var c := Hunt.claimable_total()
	_btn.text = "사냥 기록 (H)" + (" ●%d" % c if c > 0 else "")


func do_claim(kind: String) -> Dictionary:
	var r := Hunt.claim(kind)
	if not r.is_empty():
		Toast.show(self, "%s 사냥 기록 보상: %s" % [Hunt.display_name(kind), _items_text(r)], 3.0)
		claimed.emit(kind, r)
	_refresh()
	return r


func do_claim_all() -> Dictionary:
	var r := Hunt.claim_all()
	if not r.is_empty():
		Toast.show(self, "사냥 기록 보상: %s" % _items_text(r), 3.5)
		claimed.emit("", r)
	_refresh()
	return r


func _items_text(items: Dictionary) -> String:
	var parts: Array[String] = []
	for k in items:
		parts.append("%s %d" % [String(Growth.ITEMS.get(k, {}).get("name", k)), int(items[k])])
	return " · ".join(parts)


# ---------------------------------------------------------------- 화면

func _unhandled_input(event: InputEvent) -> void:
	if is_open:
		if event.is_action_pressed("go_hunt") or (event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE):
			close_screen()
			get_viewport().set_input_as_handled()
	elif event.is_action_pressed("go_hunt"):
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
	## 화면 기준 크기(1920×1280) 좌표 — 왼쪽 위 단추 줄(…업적·도움말) 바로 아래.
	_btn.offset_left = 760
	_btn.offset_right = 970
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
	_panel.offset_left = -420
	_panel.offset_right = 420
	_panel.offset_top = -310
	_panel.offset_bottom = 310
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
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.custom_minimum_size = Vector2(0, 470)
	box.add_child(scroll)
	_body = VBoxContainer.new()
	_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_body.add_theme_constant_override("separation", 4)
	scroll.add_child(_body)
	var row := HBoxContainer.new()
	box.add_child(row)
	var all_btn := Button.new()
	all_btn.text = "모두 받기"
	all_btn.name = "ClaimAll"
	all_btn.pressed.connect(func() -> void: do_claim_all())
	row.add_child(all_btn)
	var close := Button.new()
	close.text = "닫기 (H)"
	close.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	close.pressed.connect(close_screen)
	row.add_child(close)


func _refresh() -> void:
	if _body == null:
		return
	for c in _body.get_children():
		c.queue_free()
	var sp := Hunt.species()
	_title.text = "📖 사냥 기록 — 만난 종 %d/%d" % [Hunt.found_count(), sp.size()]
	var boss_started := false
	for id in sp:
		if Hunt.is_boss(id) and not boss_started:
			boss_started = true
			var h := Label.new()
			h.text = "우두머리"
			h.add_theme_font_size_override("font_size", 16)
			h.add_theme_color_override("font_color", Color(1.0, 0.9, 0.6))
			_body.add_child(h)
		var n := Hunt.kills(id)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		_body.add_child(row)
		var nm := Label.new()
		var el := Hunt.element_name(id)
		nm.text = ("%s%s" % [Hunt.display_name(id), (" (%s)" % el) if el != "" else ""]) if n > 0 else "???"
		nm.custom_minimum_size = Vector2(190, 0)
		nm.add_theme_color_override("font_color", Color(0.92, 0.92, 0.92) if n > 0 else Color(0.5, 0.5, 0.55))
		row.add_child(nm)
		var tiers: Array = Hunt.tiers_of(id)
		var reached := Hunt.tier_reached(id)
		var goal: int = int(tiers[mini(reached, tiers.size() - 1)])
		var bar := ProgressBar.new()
		bar.max_value = float(goal)
		bar.value = float(mini(n, goal))
		bar.show_percentage = false
		bar.custom_minimum_size = Vector2(230, 20)
		var fill := StyleBoxFlat.new()
		fill.bg_color = Color(0.9, 0.75, 0.3) if reached >= tiers.size() else Color(0.45, 0.8, 0.5)
		fill.set_corner_radius_all(3)
		var back := StyleBoxFlat.new()
		back.bg_color = Color(0.2, 0.2, 0.24)
		back.set_corner_radius_all(3)
		bar.add_theme_stylebox_override("fill", fill)
		bar.add_theme_stylebox_override("background", back)
		row.add_child(bar)
		var cnt := Label.new()
		cnt.text = "%d/%d · %d단계" % [n, goal, reached] if reached < tiers.size() else "%d · 완성" % n
		cnt.custom_minimum_size = Vector2(120, 0)
		row.add_child(cnt)
		var c := Hunt.claimable(id)
		var b := Button.new()
		b.text = "받기 ●%d" % c if c > 0 else "—"
		b.disabled = c <= 0
		var kid: String = id
		b.pressed.connect(func() -> void: do_claim(kid))
		row.add_child(b)
	var all_btn := _panel.find_child("ClaimAll", true, false) as Button
	if all_btn:
		all_btn.disabled = Hunt.claimable_total() <= 0
