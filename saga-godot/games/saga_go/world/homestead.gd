extends Node3D

## 쉼터 마당 (2026-09-30) — 규칙·수치는 data/homestead.gd, 상태는 PartyState.home. test_village.gd 가 붙인다.
##   마을 신상 곁 열린 풀밭에 표지(등롱 하나 + 돌 여덟 줄)로 마당을 그리고, 둘레 PROMPT_M 안에서 "쉼터 (T)" 단추/T → 화면:
##   소품 열두 종(냥) 중 하나를 골라 "여기에 놓기"(서 있는 자리·돌림 4방향) · "가까운 것 치우기"(절반 환불) · "수확"(쌓인 냥).
##   놓인 소품은 마당에 서 있다(충돌 없음, 세이브에 남는다). 안락도 등급이 오를수록 실제 시간으로 냥이 쌓인다.

signal changed()
signal harvested(mora: int)

const Homestead := preload("res://games/saga_go/data/homestead.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

var is_open := false
var rot := 0
var pick_id := "flowers"

var _player: Node3D
var _center := Vector3.ZERO
var _items_root: Node3D
var _cache := {}
var _layer: CanvasLayer
var _panel: PanelContainer
var _title: Label
var _body: VBoxContainer
var _prompt_btn: Button
var _refresh_t := 0.0
var _signature := ""
var _pend_t := 0.0 # G-0118 — 단추 글(쌓인 냥)은 보일 때만 0.25초마다(매 틱 pending() 이 소품×물건표를 훑었다)


func _ready() -> void:
	add_to_group("go_homestead")
	if not InputMap.has_action("go_homestead"):
		InputMap.add_action("go_homestead")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_T
		InputMap.action_add_event("go_homestead", ev)
	_items_root = Node3D.new()
	_items_root.name = "Items"
	add_child(_items_root)
	_build_screen()
	_build_marker.call_deferred()


## 마당 중심(세계) — 신상이 지어진 뒤에 잡는다.
func center() -> Vector3:
	return _center


func _resolve_center() -> void:
	var wps := get_tree().get_first_node_in_group("go_waypoints")
	var base := Vector3.ZERO
	if wps != null:
		base = wps.call("world_pos_of", Homestead.ANCHOR)
	_center = base + Homestead.ANCHOR_OFFSET
	_center.y = TerrainBuilder.height_at(Homestead.REGION, _center)


func near() -> bool:
	if _player == null:
		return false
	return Vector2(_player.global_position.x - _center.x, _player.global_position.z - _center.z).length() <= Homestead.PROMPT_M


func inside() -> bool:
	if _player == null:
		return false
	return Vector2(_player.global_position.x - _center.x, _player.global_position.z - _center.z).length() <= Homestead.RADIUS


# ---------------------------------------------------------------- 마당 그리기

func _build_marker() -> void:
	_resolve_center()
	var root := Node3D.new()
	root.name = "Marker"
	add_child(root)
	const STELE_OLD := "res://assets/generated/props/stele_s2_02.glb"
	const LAMP_OLD := "res://assets/generated/props/lamp_s2_02.glb"
	var stele := WorldAsset.load_scene(STELE_OLD)
	var lamp := WorldAsset.load_scene(LAMP_OLD)
	if lamp != null:
		var l := lamp.instantiate() as Node3D
		l.scale = Vector3.ONE * 0.8 * WorldAsset.k(LAMP_OLD)
		l.position = _center
		root.add_child(l)
	if stele != null:
		for i in 8:
			var a := TAU * float(i) / 8.0
			var s := stele.instantiate() as Node3D
			s.scale = Vector3.ONE * 0.9 * WorldAsset.k(STELE_OLD)
			var p := _center + Vector3(cos(a), 0, sin(a)) * Homestead.RADIUS
			p.y = TerrainBuilder.height_at(Homestead.REGION, p)
			s.position = p
			s.rotation.y = -a
			root.add_child(s)
	_rebuild()


func _item_scene(id: String) -> PackedScene:
	if not _cache.has(id):
		_cache[id] = WorldAsset.load_scene(String(Homestead.item(id).glb))
	return _cache[id]


func _rebuild() -> void:
	for c in _items_root.get_children():
		c.queue_free()
	for e in Homestead.state().items as Array:
		var it := Homestead.item(String(e.id))
		var ps := _item_scene(String(e.id))
		if it.is_empty() or ps == null:
			continue
		var n := ps.instantiate() as Node3D
		n.scale = Vector3.ONE * float(it.scale) * WorldAsset.k(String(it.glb))
		var p := Vector3(float(e.x), 0, float(e.z))
		p.y = TerrainBuilder.height_at(Homestead.REGION, p)
		n.position = p
		n.rotation.y = float(int(e.r)) * PI * 0.5
		_items_root.add_child(n)
	_signature = str((Homestead.state().items as Array).size())


# ---------------------------------------------------------------- 매 틱

func _physics_process(delta: float) -> void:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
		return
	_prompt_btn.visible = not is_open and not bool(_player.get("frozen")) and near() and not get_tree().has_group("go_hud_menu")
	_pend_t -= delta
	if _prompt_btn.visible and _pend_t <= 0.0:
		_pend_t = 0.25
		var pend := Homestead.pending()
		_prompt_btn.text = "쉼터 (T)" + (" ●%d냥" % pend if pend >= 100 else "")
	if is_open:
		_refresh_t -= delta
		if _refresh_t <= 0.0:
			_refresh_t = 0.5
			_refresh()


# ---------------------------------------------------------------- 행동 (화면 단추·점검이 함께 부른다)

func place_here() -> String:
	if _player == null:
		return "플레이어가 없다"
	var p := _player.global_position
	var err := Homestead.place(pick_id, p.x, p.z, rot, _center)
	if err != "":
		Toast.show(self, err, 2.2)
		return err
	_rebuild()
	Toast.show(self, "%s 을(를) 놓았다 — 안락도 %d" % [Homestead.item(pick_id).name, Homestead.comfort()], 2.2)
	changed.emit()
	_refresh()
	return ""


func remove_nearby() -> String:
	if _player == null:
		return ""
	var p := _player.global_position
	var id := Homestead.remove_near(p.x, p.z, 3.0)
	if id == "":
		Toast.show(self, "곁에 치울 소품이 없다 (3m 안)", 2.0)
		return ""
	_rebuild()
	Toast.show(self, "%s 을(를) 치웠다 — 냥 %d 돌려받음" % [Homestead.item(id).name, int(float(Homestead.item(id).cost) * Homestead.REFUND)], 2.2)
	changed.emit()
	_refresh()
	return id


func harvest() -> int:
	var n := Homestead.harvest()
	if n > 0:
		Toast.show(self, "🏡 쉼터에서 냥 %d 을(를) 거뒀다" % n, 2.5)
		harvested.emit(n)
		changed.emit()
	else:
		Toast.show(self, "아직 쌓인 냥이 없다", 1.8)
	_refresh()
	return n


# ---------------------------------------------------------------- 화면

func _unhandled_input(event: InputEvent) -> void:
	if is_open:
		if event.is_action_pressed("go_homestead") or (event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE):
			close_screen()
			get_viewport().set_input_as_handled()
	elif event.is_action_pressed("go_homestead") and near():
		if open_screen():
			get_viewport().set_input_as_handled()


func open_screen() -> bool:
	if is_open or _player == null or _player.get("frozen"):
		return false
	if get_tree().get_nodes_in_group("duel_active").size() > 0:
		return false
	is_open = true
	_panel.visible = true
	## 서서 소품을 놓아야 하니 플레이어를 얼리지 않는다(창이 열린 채 걸어 다니며 놓는다).
	_refresh()
	return true


func close_screen() -> void:
	if not is_open:
		return
	is_open = false
	_panel.visible = false


func _build_screen() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = 6
	add_child(_layer)
	_prompt_btn = Button.new()
	_prompt_btn.anchor_left = 1.0
	_prompt_btn.anchor_right = 1.0
	_prompt_btn.offset_left = -170
	_prompt_btn.offset_right = -20
	_prompt_btn.offset_top = 144
	_prompt_btn.offset_bottom = 184
	_prompt_btn.visible = false
	_prompt_btn.pressed.connect(func() -> void: open_screen())
	_layer.add_child(_prompt_btn)
	_panel = PanelContainer.new()
	## 오른쪽 아래에 붙는 작은 창 — 마당이 보이는 채로 걸어 다니며 놓는다.
	_panel.anchor_left = 1.0
	_panel.anchor_right = 1.0
	_panel.anchor_top = 0.0
	_panel.anchor_bottom = 1.0
	_panel.offset_left = -400
	_panel.offset_right = -10
	_panel.offset_top = 190
	_panel.offset_bottom = -90
	_panel.visible = false
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.07, 0.09, 0.9)
	sb.set_corner_radius_all(10)
	sb.content_margin_left = 12
	sb.content_margin_right = 12
	sb.content_margin_top = 10
	sb.content_margin_bottom = 10
	_panel.add_theme_stylebox_override("panel", sb)
	_layer.add_child(_panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	_panel.add_child(box)
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 17)
	_title.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5))
	_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(_title)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(scroll)
	_body = VBoxContainer.new()
	_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_body.add_theme_constant_override("separation", 5)
	scroll.add_child(_body)
	var close := Button.new()
	close.text = "닫기 (T)"
	close.pressed.connect(close_screen)
	box.add_child(close)


func _refresh() -> void:
	if _body == null:
		return
	for c in _body.get_children():
		c.queue_free()
	var st := Homestead.state()
	var c := Homestead.comfort()
	var t := Homestead.tier()
	var tier: Dictionary = Homestead.TIERS[t]
	var nxt := ""
	if t + 1 < Homestead.TIERS.size():
		nxt = " · 다음 등급까지 안락도 %d" % (int(Homestead.TIERS[t + 1].min) - c)
	_title.text = "🏡 쉼터 마당 — %s\n안락도 %d%s\n소품 %d/%d · 시간당 냥 %d (상한 %d시간)" % [tier.name, c, nxt, (st.items as Array).size(), Homestead.MAX_ITEMS, int(tier.income), int(Homestead.CAP_HOURS)]
	var pend := Homestead.pending()
	var hv := Button.new()
	hv.text = "수확 — 쌓인 냥 %d" % pend
	hv.disabled = pend <= 0
	hv.pressed.connect(func() -> void: harvest())
	_body.add_child(hv)
	var row := HBoxContainer.new()
	_body.add_child(row)
	var place_btn := Button.new()
	place_btn.text = "여기에 놓기 (%s)" % Homestead.item(pick_id).name
	place_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	place_btn.pressed.connect(func() -> void: place_here())
	row.add_child(place_btn)
	var rot_btn := Button.new()
	rot_btn.text = "돌림 %d°" % (rot * 90)
	rot_btn.pressed.connect(func() -> void:
		rot = (rot + 1) % 4
		_refresh())
	row.add_child(rot_btn)
	var rm := Button.new()
	rm.text = "가까운 것 치우기 (3m 안 · 절반 환불)"
	rm.pressed.connect(func() -> void: remove_nearby())
	_body.add_child(rm)
	var here := Label.new()
	here.text = "지금 자리: " + ("마당 안" if inside() else "마당 밖 — 표지 돌 안쪽에서 놓는다")
	here.add_theme_font_size_override("font_size", 13)
	here.add_theme_color_override("font_color", Color(0.6, 0.95, 0.65) if inside() else Color(0.95, 0.7, 0.5))
	_body.add_child(here)
	var mora := PartyState.count("mora")
	for it in Homestead.ITEMS:
		var b := Button.new()
		b.text = "%s%s — 냥 %d · 안락 +%d" % ["▶ " if pick_id == String(it.id) else "", it.name, int(it.cost), int(it.comfort)]
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.disabled = mora < int(it.cost)
		var iid: String = it.id
		b.pressed.connect(func() -> void:
			pick_id = iid
			_refresh())
		_body.add_child(b)
