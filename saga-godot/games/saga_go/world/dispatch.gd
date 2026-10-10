extends Node3D

## PLAN 106장 ㊹ — 원신식 탐사 파견(표·수치는 data/dispatch.gd, 상태는 PartyState.dispatch). test_village.gd 가 붙인다.
##   마을 역참 곁 "탐사 파견" 게시판 둘레 BOARD_M 안에서 F(터치 "탐사 파견") → 화면:
##   탐사지 여섯(지역 신상을 켜야 열림)마다 비었으면 "보내기" → 시간 넷·보낼 동료(들판 명단에 없고 탐사 안 나간) 고르기,
##   나가 있으면 남은 시간과 "부르기"(보상 없이 돌아옴), 다 됐으면 "받기". 아래 "모두 받기".
##   시간은 이 기기 실제 시각(끈 동안에도 흐른다). 다 된 탐사는 한 번 알린다(불러온 직후엔 모아서 한 줄).

signal sent(spot: String, member: String, hours: int)
signal claimed(spot: String, items: Dictionary)
signal changed()

const Dispatch := preload("res://games/saga_go/data/dispatch.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")
const Growth := preload("res://games/saga_go/data/growth.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const Story := preload("res://games/saga_go/data/story.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Waypoints := preload("res://games/saga_go/world/waypoints.gd")
const WorldMap := preload("res://games/saga_go/ui/world_map.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const CHECK_SEC := 1.0

## 점검이 시각을 돌릴 때(초).
static var time_offset := 0.0

var is_open := false
var announced := 0 # 점검용 — 다 됐다고 알린 탐사 수
var pick_spot := "" # 보내기 고르는 중인 탐사지
var pick_hours := 20
var _notified := {} # 이번에 켠 뒤 알린 탐사지(보낸 시각까지 — 다시 보내면 또 알림)
var _first_check := true
var _check_t := 0.0
var _player: Node3D = null
var _frozen_before := false
var _layer: CanvasLayer
var _panel: PanelContainer
var _title: Label
var _list: VBoxContainer
var _pick_box: VBoxContainer
var _pick_label: Label
var _hours_row: HBoxContainer
var _members: GridContainer
var _claim_all: Button
var _prompt_btn: Button


func _ready() -> void:
	add_to_group("go_dispatch")
	if not InputMap.has_action("go_dispatch"):
		InputMap.add_action("go_dispatch")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_F
		InputMap.action_add_event("go_dispatch", ev)
	_build_board()
	_build_screen()

static func now() -> float:
	return Time.get_unix_time_from_system() + time_offset

static func board_pos() -> Vector3:
	var p := TestMap.world_pos(Dispatch.BOARD_CELL.x, Dispatch.BOARD_CELL.y, Dispatch.BOARD_REGION) + Dispatch.BOARD_OFFSET
	p.y = TerrainBuilder.height_at(Dispatch.BOARD_REGION, p)
	return p

func near_board() -> bool:
	if _player == null:
		return false
	var b := board_pos()
	return Vector2(b.x - _player.global_position.x, b.z - _player.global_position.z).length() <= Dispatch.BOARD_M \
		and absf(b.y - _player.global_position.y) < 2.5

# ---------------------------------------------------------------- 상태

func _out() -> Dictionary:
	if not PartyState.dispatch.has("out"):
		PartyState.dispatch["out"] = {}
	return PartyState.dispatch.out

func slots() -> int:
	return Dispatch.slots_for_ar(Adventure.ar())

func used() -> int:
	return _out().size()

func unlocked(spot: String) -> bool:
	return Waypoints.is_active(String(WorldMap.REGION_STATUE.get(String(Dispatch.spot(spot).get("region", "")), "")))

func member_at(spot: String) -> String:
	return String((_out().get(spot, {}) as Dictionary).get("id", ""))

func remaining(spot: String) -> float:
	var o: Dictionary = _out().get(spot, {})
	if o.is_empty():
		return 0.0
	return maxf(float(o.start) + float(o.hours) * 3600.0 - now(), 0.0)

func is_done(spot: String) -> bool:
	return _out().has(spot) and remaining(spot) <= 0.0

func affinity(spot: String, member: String) -> bool:
	return Elements.element_of(member) == String(Dispatch.spot(spot).get("element", ""))

## 그 탐사에서 받을 것(보낸 인물·시간으로).
func reward_at(spot: String) -> Dictionary:
	var o: Dictionary = _out().get(spot, {})
	if o.is_empty():
		return {}
	return Dispatch.reward_of(spot, int(o.hours), affinity(spot, String(o.id)))

## 보낼 수 없는 까닭(보낼 수 있으면 "").
func why_not(member: String) -> String:
	if member == "self" or not PartyState.members.has(member):
		return "동료가 아니다"
	if PartyState.in_party(member):
		return "들판 명단에 있다"
	if PartyState.is_away(member):
		return "이미 탐사 중"
	return ""

## 보낼 수 있는 동료(등용한 순서).
func candidates() -> Array[String]:
	var out: Array[String] = []
	for id in PartyState.members:
		if not out.has(id) and why_not(id) == "":
			out.append(id)
	return out

## 보낸다 — 못 보내면 그 까닭, 보냈으면 "".
func send(spot: String, member: String, hours: int) -> String:
	if not Dispatch.SPOTS.has(spot):
		return "없는 탐사지"
	if not unlocked(spot):
		return "그 지역 신상을 먼저 켜야 한다"
	if _out().has(spot):
		return "이미 누가 가 있다"
	if used() >= slots():
		return "지금은 %d명까지 보낼 수 있다(모험 등급이 오르면 늘어난다)" % slots()
	if not Dispatch.HOURS.has(hours):
		return "시간은 4·8·12·20시간"
	var why := why_not(member)
	if why != "":
		return why
	_out()[spot] = {"id": member, "hours": hours, "start": now()}
	_notified.erase(spot)
	CombatFeel.ui()
	sent.emit(spot, member, hours)
	changed.emit()
	return ""

## 도중에 부른다 — 보상 없이 돌아온다. 다 된 탐사는 받기로(부르기 아님).
func recall(spot: String) -> bool:
	if not _out().has(spot) or is_done(spot):
		return false
	var who := member_at(spot)
	_out().erase(spot)
	CombatFeel.ui()
	Toast.show(self, "%s 이(가) 탐사를 그만두고 돌아왔다" % _name(who), 2.0)
	changed.emit()
	if is_open:
		_refresh()
	return true

## 다 된 탐사를 받는다 — 받은 것 {칸: 수}(아직이면 빈 사전).
func claim(spot: String) -> Dictionary:
	if not is_done(spot):
		return {}
	var got := reward_at(spot)
	var who := member_at(spot)
	PartyState.add_items(got)
	_out().erase(spot)
	_notified.erase(spot)
	PartyState.dispatch["done"] = int(PartyState.dispatch.get("done", 0)) + 1
	CombatFeel.ui()
	Toast.show(self, "탐사 보상 — %s  (%s 돌아옴)" % [_items_text(got), _name(who)], 2.5)
	claimed.emit(spot, got)
	changed.emit()
	if is_open:
		_refresh()
	return got

func claim_all() -> Dictionary:
	var got := {}
	for spot in Dispatch.ORDER:
		var r := claim(spot)
		for k in r:
			got[k] = int(got.get(k, 0)) + int(r[k])
	return got

func done_count() -> int:
	var n := 0
	for spot in _out():
		if is_done(spot):
			n += 1
	return n

## 새로 다 된 탐사를 알린다 — 불러온 직후 첫 확인은 모아서 한 줄.
func check() -> void:
	var fresh: Array[String] = []
	for spot in _out():
		var key := "%s@%s" % [spot, str(_out()[spot].get("start", 0))]
		if is_done(spot) and not _notified.has(key):
			_notified[key] = true
			fresh.append(spot)
	if fresh.is_empty():
		return
	announced += fresh.size()
	if _first_check or fresh.size() > 1:
		Toast.show(self, "🧭 탐사가 끝난 동료 %d — 마을 역참 곁 탐사 게시판에서 받기" % fresh.size(), 3.0)
	else:
		Toast.show(self, "🧭 %s 이(가) %s 탐사를 마쳤다 — 역참 곁 게시판에서 받기" % [_name(member_at(fresh[0])), Dispatch.spot(fresh[0]).name], 3.0)
	changed.emit()
	if is_open:
		_refresh()

func _physics_process(delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player") as Node3D
		return
	_check_t -= delta
	if _check_t <= 0.0:
		_check_t = CHECK_SEC
		check()
		_first_check = false
		if is_open:
			_refresh_times()
	var d := done_count()
	_prompt_btn.visible = not is_open and near_board() and not _player.get("frozen")
	_prompt_btn.text = "탐사 파견 (F)" + (" ●%d" % d if d > 0 else "")

# ---------------------------------------------------------------- 화면

func _unhandled_input(event: InputEvent) -> void:
	if is_open:
		if event.is_action_pressed("go_dispatch") or (event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE):
			close_screen()
			get_viewport().set_input_as_handled()
	elif event.is_action_pressed("go_dispatch") and near_board():
		if open_screen():
			get_viewport().set_input_as_handled()

func open_screen() -> bool:
	if is_open or _player == null or _player.get("frozen"):
		return false
	if get_tree().get_nodes_in_group("duel_active").size() > 0:
		return false
	is_open = true
	pick_spot = ""
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
	pick_spot = ""
	_panel.visible = false
	remove_from_group("ui_modal")
	if _player:
		_player.set("frozen", _frozen_before)

## 보내기 고르기 — 탐사지를 고르면 아래에 시간·동료.
func begin_pick(spot: String) -> void:
	pick_spot = spot
	_refresh()

func pick_member(member: String) -> void:
	var err := send(pick_spot, member, pick_hours)
	if err != "":
		Toast.show(self, err, 2.0)
		return
	Toast.show(self, "%s 을(를) %s 에 %d시간 보냈다" % [_name(member), Dispatch.spot(pick_spot).name, pick_hours], 2.0)
	pick_spot = ""
	_refresh()

func _build_board() -> void:
	var root := Node3D.new()
	root.name = "DispatchBoard"
	add_child(root)
	root.position = board_pos()
	root.rotation.y = PI * 0.25
	var wood := StandardMaterial3D.new()
	wood.albedo_color = Color(0.42, 0.28, 0.16)
	var paper := StandardMaterial3D.new()
	paper.albedo_color = Color(0.88, 0.8, 0.6)
	for x in [-0.8, 0.8]:
		var post := MeshInstance3D.new()
		var pm := BoxMesh.new()
		pm.size = Vector3(0.14, 2.3, 0.14)
		post.mesh = pm
		post.material_override = wood
		post.position = Vector3(x, 1.15, 0.0)
		root.add_child(post)
	var plank := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(1.8, 1.1, 0.08)
	plank.mesh = bm
	plank.material_override = wood
	plank.position = Vector3(0.0, 1.5, 0.0)
	root.add_child(plank)
	## 가운데 지도 한 장 + 세 지역 깃발(마을 초록·포구 파랑·폐허 잿빛).
	var map := MeshInstance3D.new()
	var mm := BoxMesh.new()
	mm.size = Vector3(1.3, 0.8, 0.02)
	map.mesh = mm
	map.material_override = paper
	map.position = Vector3(0.0, 1.5, 0.05)
	root.add_child(map)
	var flags := [[Vector3(-0.35, 1.62, 0.07), Color(0.35, 0.7, 0.35)], [Vector3(0.3, 1.38, 0.07), Color(0.3, 0.55, 0.9)], [Vector3(0.1, 1.72, 0.07), Color(0.6, 0.6, 0.62)]]
	for f in flags:
		var pin := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.06
		sm.height = 0.12
		pin.mesh = sm
		var mat := StandardMaterial3D.new()
		mat.albedo_color = f[1]
		pin.material_override = mat
		pin.position = f[0]
		root.add_child(pin)
	var roof := MeshInstance3D.new()
	var rm := PrismMesh.new()
	rm.size = Vector3(2.2, 0.4, 0.5)
	roof.mesh = rm
	roof.material_override = wood
	roof.position = Vector3(0.0, 2.3, 0.0)
	root.add_child(roof)
	var label := Label3D.new()
	label.text = "탐사 파견"
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 44
	label.outline_size = 8
	label.pixel_size = 0.006
	label.modulate = Color(1.0, 0.9, 0.62)
	label.position = Vector3(0, 2.85, 0)
	root.add_child(label)

func _build_screen() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = 6
	add_child(_layer)
	_prompt_btn = Button.new()
	_prompt_btn.text = "탐사 파견 (F)"
	_prompt_btn.anchor_left = 0.5
	_prompt_btn.anchor_right = 0.5
	_prompt_btn.anchor_top = 1.0
	_prompt_btn.anchor_bottom = 1.0
	_prompt_btn.offset_left = -90
	_prompt_btn.offset_right = 90
	_prompt_btn.offset_top = -222
	_prompt_btn.offset_bottom = -178
	_prompt_btn.visible = false
	_prompt_btn.pressed.connect(func() -> void: open_screen())
	_layer.add_child(_prompt_btn)
	_panel = PanelContainer.new()
	_panel.anchor_left = 0.5
	_panel.anchor_right = 0.5
	_panel.anchor_top = 0.5
	_panel.anchor_bottom = 0.5
	_panel.offset_left = -360
	_panel.offset_right = 360
	_panel.offset_top = -290
	_panel.offset_bottom = 290
	_panel.visible = false
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.07, 0.09, 0.92)
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
	_title.add_theme_font_size_override("font_size", 24)
	_title.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5))
	_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(_title)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(0, 250)
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 6)
	scroll.add_child(_list)
	_pick_box = VBoxContainer.new()
	_pick_box.add_theme_constant_override("separation", 6)
	box.add_child(_pick_box)
	_pick_label = Label.new()
	_pick_label.add_theme_font_size_override("font_size", 19)
	_pick_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_pick_box.add_child(_pick_label)
	_hours_row = HBoxContainer.new()
	_pick_box.add_child(_hours_row)
	for h in Dispatch.HOURS:
		var b := Button.new()
		b.custom_minimum_size = Vector2(100, 38)
		var hh: int = h
		b.pressed.connect(func() -> void:
			pick_hours = hh
			_refresh())
		_hours_row.add_child(b)
	var ms := ScrollContainer.new()
	ms.custom_minimum_size = Vector2(0, 110)
	_pick_box.add_child(ms)
	_members = GridContainer.new()
	_members.columns = 2
	_members.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ms.add_child(_members)
	var foot := HBoxContainer.new()
	box.add_child(foot)
	_claim_all = Button.new()
	_claim_all.text = "모두 받기"
	_claim_all.add_theme_font_size_override("font_size", 22)   # G-0167
	_claim_all.custom_minimum_size = Vector2(160, 40)
	_claim_all.pressed.connect(func() -> void: claim_all())
	foot.add_child(_claim_all)
	var close := Button.new()
	close.text = "닫기 (F·Esc)"
	close.add_theme_font_size_override("font_size", 22)   # G-0167
	close.custom_minimum_size = Vector2(160, 40)
	close.pressed.connect(close_screen)
	foot.add_child(close)

func _refresh() -> void:
	var s := slots()
	var next := ""
	for a in Dispatch.SLOT_AR:
		if Adventure.ar() < int(a):
			next = " · 모험 등급 %d 에 한 자리 더" % int(a)
			break
	_title.text = "탐사 파견 — 보낸 동료 %d/%d%s\n들판 명단에 없는 동료를 보내면 실제 시각이 흐른 뒤 재료를 가져온다" % [used(), s, next]
	for c in _list.get_children():
		_list.remove_child(c)
		c.queue_free()
	for spot in Dispatch.ORDER:
		var d := Dispatch.spot(spot)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		var l := Label.new()
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.add_theme_font_size_override("font_size", 19)
		var el := String(d.element)
		var head := "%s  [%s · %s] %s 잘 맞음" % [d.name, WorldMap.REGION_NAMES.get(d.region, d.region), d.era, Elements.name_of(el)]
		var b := Button.new()
		b.custom_minimum_size = Vector2(170, 40)
		var sid: String = spot
		if not unlocked(spot):
			l.text = "%s\n%s 신상을 켜면 열린다" % [head, WorldMap.REGION_NAMES.get(d.region, d.region)]
			l.modulate = Color(0.6, 0.6, 0.6)
			b.text = "잠김"
			b.disabled = true
		elif not _out().has(spot):
			l.text = "%s\n%s — 4시간에 %s" % [head, d.desc, _items_text(Dispatch.reward_of(spot, 4, false))]
			b.text = "▶ 고르는 중" if pick_spot == spot else "보내기"
			b.disabled = used() >= s and pick_spot != spot
			b.pressed.connect(func() -> void: begin_pick(sid))
		elif is_done(spot):
			l.text = "%s\n%s 돌아올 채비 — %s" % [head, _name(member_at(spot)), _items_text(reward_at(spot))]
			l.add_theme_color_override("font_color", Color(0.75, 0.95, 0.7))
			b.text = "받기"
			b.pressed.connect(func() -> void: claim(sid))
		else:
			l.text = "%s\n%s 탐사 중 — 남은 %s" % [head, _name(member_at(spot)), Dispatch.time_text(remaining(spot))]
			b.text = "부르기 (보상 없음)"
			b.pressed.connect(func() -> void: recall(sid))
		l.set_meta("spot", spot)
		row.add_child(l)
		row.add_child(b)
		_list.add_child(row)
	_claim_all.disabled = done_count() == 0
	_refresh_pick()

## 남은 시간 글자만 다시(1초마다).
func _refresh_times() -> void:
	for row in _list.get_children():
		var l := (row as HBoxContainer).get_child(0) as Label
		var spot := String(l.get_meta("spot", ""))
		if _out().has(spot) and not is_done(spot):
			var lines := l.text.split("\n")
			lines[1] = "%s 탐사 중 — 남은 %s" % [_name(member_at(spot)), Dispatch.time_text(remaining(spot))]
			l.text = "\n".join(lines)
		elif is_done(spot) and not (row as HBoxContainer).get_child(1).text.begins_with("받기"):
			_refresh()
			return

func _refresh_pick() -> void:
	_pick_box.visible = pick_spot != ""
	if pick_spot == "":
		return
	var d := Dispatch.spot(pick_spot)
	var cand := candidates()
	_pick_label.text = "%s 에 보낼 동료 — %d시간 · %s 인물이면 보상 +25%%" % [d.name, pick_hours, Elements.name_of(String(d.element))] \
		+ ("" if not cand.is_empty() else "\n보낼 수 있는 동료가 없다 — 들판 명단(인물 C)에서 빼면 보낼 수 있다")
	for i in Dispatch.HOURS.size():
		var hb := _hours_row.get_child(i) as Button
		var h: int = Dispatch.HOURS[i]
		hb.text = ("▶ %d시간" if h == pick_hours else "%d시간") % h
	for c in _members.get_children():
		_members.remove_child(c)
		c.queue_free()
	for id in cand:
		var b := Button.new()
		b.custom_minimum_size = Vector2(330, 40)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		var aff := affinity(pick_spot, id)
		b.text = "%s%s [%s] → %s" % ["★ " if aff else "", _name(id), Elements.name_of(Elements.element_of(id)), _items_text(Dispatch.reward_of(pick_spot, pick_hours, aff))]
		b.modulate = Elements.color_of(Elements.element_of(id)).lightened(0.5)
		var mid: String = id
		b.pressed.connect(func() -> void: pick_member(mid))
		_members.add_child(b)

func _name(id: String) -> String:
	var h: Variant = Characters.find(id)
	if h == null:
		h = Story.member(id)
	return String(h.name) if h != null else id

func _items_text(items: Dictionary) -> String:
	var out: Array[String] = []
	for k in items:
		out.append("%s %d" % [String(Growth.ITEMS.get(k, {}).get("name", k)), int(items[k])])
	return " · ".join(out)

## 점검용 — 탐사지 목록 줄 글.
func list_text() -> String:
	var out: Array[String] = []
	for row in _list.get_children():
		var hb := row as HBoxContainer
		out.append("%s | %s" % [(hb.get_child(0) as Label).text.replace("\n", " / "), (hb.get_child(1) as Button).text])
	return "\n".join(out)
