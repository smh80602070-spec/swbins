extends Node3D

## G-0347 ② 지역 단위 전략 지도(웹 W-0400 짝) — 월드맵(realm_worldmap.gd) 자식. 한 화면 = 한 지역(data/realm_regions.gd).
##   거르기   성표 107 은 지금처럼 다 세워 두고(기둥 몇 개라 가볍다) 지금 지역 것만 보인다 — 기둥·깃발·괴물·탭 영역.
##   지역     RealmSaveState.view_region(저장) — "" 이거나 모르는 값이면 지금 성(current_city) 지역. 성표를 눌러 성을 바꿔도 지역은 그대로.
##   화살표   지역 가장자리에 길로 이어진 이웃 지역마다 "▶ 중원" — 누르면 그 지역(view_region).
##   천하도   지도를 보는 동안 왼쪽 위 「🗺 천하도」 — 지역 카드(이름·성 수·우리 성·⚔ 적 성) 창, 누르면 그 지역.
##   카메라   realm_worldmap_camera 가 focus()(지역 가운데)·fit_radius()(지역+화살표가 들어오는 거리, 세로면 더 멀리)를 본다.
## SAGA_REALM_SRPG=0 이면 안 붙는다(옛 길 — 성 107 한 판).

const Regions := preload("res://games/saga_realm/data/realm_regions.gd")
const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")

const ARROW_PAD := 40.0
const ARROW_COLOR := Color(1.0, 0.92, 0.6)

var _map: Node3D = null
var _shown_region := ""
var _shown_count := -1
var _shown_cur := ""
var _arrows: Array = []
var _names := {}   # city_id → Label3D(성 이름 — 기둥은 지도 카메라 거리에서 점이라 글로 읽힘, 촬영 rk_map_wide)
var _ui: CanvasLayer = null
var _btn: Button = null
var _cards: PanelContainer = null
var applied := 0   # 점검용 — 거르기를 몇 번 했나


static func on() -> bool:
	return OS.get_environment("SAGA_REALM_SRPG") != "0"


static func attach(map: Node3D) -> Node3D:
	if not on():
		return null
	var n: Node3D = load("res://games/saga_realm/world/realm_region_view.gd").new()
	n.name = "RegionView"
	map.add_child(n)
	return n


func _ready() -> void:
	add_to_group("realm_region_view")
	_map = get_parent() as Node3D
	_build_ui()


## 지금 지역 id
func region() -> String:
	var r := String(RealmSaveState.view_region)
	if Regions.by_id(r).is_empty():
		r = Regions.region_of(String(RealmSaveState.current_city))
	return r


func set_region(r: String) -> void:
	if Regions.by_id(r).is_empty():
		return
	if r != RealmSaveState.view_region:
		preload("res://saga_core/ui/zone_cut.gd").begin(get_tree())   # G-0384 넘김 막 — 다른 지역으로
	RealmSaveState.view_region = r
	_cards.visible = false


## 카메라 초점
func focus() -> Vector3:   # 늘 지역 가운데(지금 성은 ★ 글로 — 지금 성에 맞추면 세로 폰에서 반대쪽 성이 잘렸다, 촬영 lg_rk_region 720×1280)
	return center(region())


static func center(r: String) -> Vector3:
	var ids: Array = Regions.cities_of(r)
	if ids.is_empty():
		return Vector3.ZERO
	var c := Vector3.ZERO
	for cid: String in ids:
		c += RealmCities.world_pos(cid)
	return c / float(ids.size())


## 지역 성·화살표가 다 들어오는 지도 카메라 반지름(세로 화면이면 더 멀리) — 카메라 시야 70° 근사
func fit_radius(view: Vector2) -> float:
	var aspect := view.x / maxf(view.y, 1.0)
	var need := span(region()) + ARROW_PAD + 20.0
	return need * 1.6 / minf(aspect, 1.0)


static func span(r: String) -> float:
	var c := center(r)
	var far := 0.0
	for cid: String in Regions.cities_of(r):
		far = maxf(far, (RealmCities.world_pos(cid) - c).length())
	return far


func _process(_delta: float) -> void:
	var showing := bool(RealmSaveState.viewing_map)
	_btn.visible = showing
	if not showing:
		_cards.visible = false
	var markers: Dictionary = _map.get("_markers")
	var r := region()
	if r == _shown_region and markers.size() == _shown_count and String(RealmSaveState.current_city) == _shown_cur:
		return
	_shown_region = r
	_shown_count = markers.size()
	_shown_cur = String(RealmSaveState.current_city)
	apply()


## 지금 지역 성표만 보이게 + 화살표 다시
func apply() -> void:
	applied += 1
	var r := region()
	for dict_name in ["_markers", "_flags", "_monsters", "_areas"]:
		var d: Dictionary = _map.get(dict_name)
		for cid: String in d:
			var n: Node3D = d[cid]
			if not is_instance_valid(n):
				continue
			var mine := Regions.region_of(cid) == r
			n.visible = mine
			if n is Area3D:
				(n as Area3D).input_ray_pickable = mine and bool(RealmSaveState.viewing_map)
	_build_names(r)
	_build_arrows(r)


## 이 지역 성 이름(우리 금·적 붉은·보스 보라 — 월드맵 기둥 색 그대로) · 지금 성은 ★
func _build_names(r: String) -> void:
	var base: Dictionary = _map.get("_base_color")
	for cid: String in _names:
		(_names[cid] as Label3D).visible = Regions.region_of(cid) == r
	for cid: String in Regions.cities_of(r):
		if not (_map.get("_markers") as Dictionary).has(cid):
			continue
		if not _names.has(cid):
			var l := Label3D.new()
			l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			l.no_depth_test = true
			l.fixed_size = true
			l.pixel_size = 0.0014
			l.font_size = 26
			l.outline_size = 8
			add_child(l)
			l.global_position = RealmCities.world_pos(cid) + Vector3.UP * 4.5
			_names[cid] = l
		var lb: Label3D = _names[cid]
		var ours := RealmSaveState.cities.has(cid)
		lb.text = ("★ " if cid == String(RealmSaveState.current_city) else ("🏯 " if ours else "⚔ ")) + String(RealmCities.any_by_id(cid).get("name", cid))
		lb.modulate = Color(1.0, 0.86, 0.4) if ours else (base.get(cid, Color(0.95, 0.4, 0.35)) as Color).lightened(0.35)
		lb.visible = true


func _build_arrows(r: String) -> void:
	for a in _arrows:
		if is_instance_valid(a):
			(a as Node).queue_free()
	_arrows.clear()
	var c := center(r)
	var reach := span(r) + ARROW_PAD
	for o: String in Regions.neighbors(r):
		var dir := center(o) - c
		dir.y = 0.0
		if dir.length() < 0.01:
			continue
		dir = dir.normalized()
		var root := Node3D.new()
		root.name = "Arrow_" + o
		root.set_meta("region", o)
		add_child(root)
		root.global_position = c + dir * reach + Vector3.UP * 6.0
		var l := Label3D.new()
		l.text = "▶ %s" % Regions.name_of(o)
		l.modulate = ARROW_COLOR
		l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		l.no_depth_test = true
		l.fixed_size = true
		l.pixel_size = 0.0016
		l.font_size = 30
		l.outline_size = 8
		root.add_child(l)
		var area := Area3D.new()
		var cs := CollisionShape3D.new()
		var sh := SphereShape3D.new()
		sh.radius = 14.0
		cs.shape = sh
		area.add_child(cs)
		area.input_ray_pickable = true
		area.input_event.connect(_on_arrow_input.bind(o))
		root.add_child(area)
		_arrows.append(root)


func _on_arrow_input(_camera: Node, event: InputEvent, _pos: Vector3, _normal: Vector3, _shape_idx: int, o: String) -> void:
	if not visible or not bool(RealmSaveState.viewing_map):
		return
	var pressed := (event is InputEventMouseButton and (event as InputEventMouseButton).pressed and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT) \
		or (event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed)
	if pressed:
		set_region(o)


## ── 천하도 ──

func _build_ui() -> void:
	_ui = CanvasLayer.new()
	_ui.layer = 12
	add_child(_ui)
	_btn = Button.new()
	_btn.text = "🗺 천하도"
	_btn.position = Vector2(16, 136)   # 위 자원 줄(y≈84) 아래
	_btn.custom_minimum_size = Vector2(150, 52)
	_btn.add_theme_font_size_override("font_size", 22)
	_btn.visible = false
	_btn.pressed.connect(func() -> void:
		_fill_cards()
		_cards.visible = not _cards.visible)
	_ui.add_child(_btn)
	_cards = PanelContainer.new()
	_cards.anchor_left = 0.5
	_cards.anchor_right = 0.5
	_cards.anchor_top = 0.5
	_cards.anchor_bottom = 0.5
	_cards.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_cards.grow_vertical = Control.GROW_DIRECTION_BOTH
	_cards.visible = false
	_ui.add_child(_cards)


## 카드 — "중원 · 성 8 · 우리 3 · ⚔ 5"(지금 지역은 ●)
func card_text(r: String) -> String:
	var ids: Array = Regions.cities_of(r)
	var ours := 0
	var foes := 0
	for cid: String in ids:
		if RealmSaveState.cities.has(cid):
			ours += 1
		elif RealmSaveState.enemies.has(cid) and not bool(RealmSaveState.enemies[cid].get("captured", false)):
			foes += 1
	return "%s%s · 성 %d · 우리 %d%s" % ["● " if r == region() else "", Regions.name_of(r), ids.size(), ours, (" · ⚔ %d" % foes) if foes > 0 else ""]


func _fill_cards() -> void:
	for ch in _cards.get_children():
		ch.queue_free()
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	_cards.add_child(box)
	var title := Label.new()
	title.text = "🗺 천하도 — 지역을 고르면 그 지역 지도"
	title.add_theme_font_size_override("font_size", 24)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 8)
	box.add_child(grid)
	for rg: Dictionary in Regions.REGIONS:
		var b := Button.new()
		b.text = card_text(String(rg.id))
		b.custom_minimum_size = Vector2(300, 52)
		b.add_theme_font_size_override("font_size", 20)
		b.pressed.connect(set_region.bind(String(rg.id)))
		grid.add_child(b)
