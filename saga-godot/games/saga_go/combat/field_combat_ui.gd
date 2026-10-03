extends Node

## 들판 전투(field_combat.gd)의 앞쪽 부모 — 연출(원환·빛줄기·낙뢰·반응 글자)과 HUD 틀(원·막대·명단 줄).
## 상태(체력·쿨·기력)를 읽는 _refresh_hud 는 파생 쪽(field_combat.gd)에 있다. 이 파일은 상태를 모른다 — 필요한 건 아래 변수와 _act 뿐.
## 호출부 변경 0: 오토로드는 field_combat.gd 그대로, 여기 함수·변수는 상속으로 읽힌다.

const Elements := preload("res://games/saga_go/combat/elements.gd")
const CombatFx := preload("res://games/saga_go/combat/combat_fx.gd")

var _player: CharacterBody3D = null
var _aim_hint: Label = null
var _hud: Control = null
var _hp_bar: ProgressBar = null
var _status_label: Label = null
var _roster_box: VBoxContainer = null
var _roster_sig := ""
var _roster_rows: Array = [] # [{label, bar}]
var _skill_orb: Orb = null
var _burst_orb: Orb = null
var _touch_buttons: Dictionary = {}


## 터치 단추가 부른다 — 파생 쪽(field_combat.gd)이 덮어쓴다.
func _act(_action: String, _pressed: bool) -> void:
	pass


# ---------------------------------------------------------------- 연출

## 09-28 — 얇게 퍼지는 원환 하나이던 것을 바닥 충격파 + 원소별 입자(+폭발은 빛기둥)로(combat_fx.gd element_burst).
## 색이 원소 색표와 같으면 그 원소로 알아본다(반응 색은 일반 불빛). 0.6초 넘게 도는 큰 고리 = 원소 폭발.
func _ring_fx(center: Vector3, radius: float, color: Color, sec: float) -> void:
	CombatFx.element_burst(self, center, radius, color, sec, CombatFx.element_of_color(color, Elements.INFO), sec >= 0.6)

## 법구·활 기본 공격 — 인물 가슴에서 적까지 가는 빛줄기(0.15초).
func _shot_fx(to: Vector3, color: Color) -> void:
	var from := _player.global_position + Vector3.UP * 1.2
	var target := to + Vector3.UP * 0.8
	var d := from.distance_to(target)
	if d < 0.2:
		return
	var mi := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.04
	cyl.bottom_radius = 0.04
	cyl.height = d
	cyl.radial_segments = 5
	mi.mesh = cyl
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = color
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	get_tree().current_scene.add_child(mi)
	mi.global_position = (from + target) * 0.5
	var up := (target - from).normalized()
	var side := up.cross(Vector3.FORWARD if absf(up.dot(Vector3.FORWARD)) < 0.9 else Vector3.RIGHT).normalized()
	mi.global_basis = Basis(side, up, side.cross(up)).orthonormalized()
	var tw := mi.create_tween()
	tw.tween_property(mat, "albedo_color:a", 0.0, 0.15)
	tw.tween_callback(mi.queue_free)

## 낙뢰 — 하늘에서 적 머리로 떨어지는 가는 기둥.
func _bolt_fx(pos: Vector3) -> void:
	var mi := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.08
	cyl.bottom_radius = 0.18
	cyl.height = 9.0
	cyl.radial_segments = 6
	mi.mesh = cyl
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = Elements.color_of("thunder").lightened(0.3)
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	get_tree().current_scene.add_child(mi)
	mi.global_position = pos + Vector3.UP * 4.5
	var tw := mi.create_tween()
	tw.tween_property(mat, "albedo_color:a", 0.0, 0.25)
	tw.tween_callback(mi.queue_free)

func _reaction_text(target: Node3D, text: String, color: Color) -> void:
	var l := Label3D.new()
	l.text = text
	l.modulate = color
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.font_size = 64
	l.outline_size = 10
	l.pixel_size = 0.006
	get_tree().current_scene.add_child(l)
	l.global_position = target.global_position + Vector3.UP * 2.4
	var tw := l.create_tween()
	tw.set_parallel(true)
	tw.tween_property(l, "global_position:y", l.global_position.y + 1.0, 0.8)
	tw.tween_property(l, "modulate:a", 0.0, 0.8).set_delay(0.3)
	tw.chain().tween_callback(l.queue_free)

# ---------------------------------------------------------------- HUD

## 106장 ⑧ 원신 배치 — 아래 가운데 지금 인물 체력, 오른쪽 명단(인물마다 원소색·체력 막대),
## 오른쪽 아래 E(스킬 쿨)·Q(폭발 기력) 원.
class Orb extends Control:
	var ratio := 1.0
	var key_text := ""
	var sub_text := ""
	var color := Color.WHITE
	var glow := false

	func _draw() -> void:
		var c := size * 0.5
		var r := minf(size.x, size.y) * 0.5 - 3.0
		draw_circle(c, r, Color(0, 0, 0, 0.55))
		if ratio > 0.0:
			draw_arc(c, r - 2.0, -PI * 0.5, -PI * 0.5 + TAU * clampf(ratio, 0.0, 1.0), 48, color, 4.0, true)
		if glow:
			draw_arc(c, r + 1.0, 0.0, TAU, 48, color.lightened(0.4), 2.0, true)
		var font := ThemeDB.fallback_font
		draw_string(font, Vector2(0, c.y + 7), key_text, HORIZONTAL_ALIGNMENT_CENTER, size.x, 22, Color.WHITE)
		if sub_text != "":
			draw_string(font, Vector2(0, c.y + 24), sub_text, HORIZONTAL_ALIGNMENT_CENTER, size.x, 12, Color(1, 1, 1, 0.85))

func _build_hud() -> void:
	var layer := CanvasLayer.new()
	layer.name = "FieldCombatHUD"
	add_child(layer)
	_hud = Control.new()
	_hud.set_anchors_preset(Control.PRESET_FULL_RECT)
	_hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(_hud)

	_hp_bar = _bar(Color(0.45, 0.85, 0.35), Vector2(360, 14), -64)

	_status_label = Label.new()
	_status_label.anchor_left = 0.5
	_status_label.anchor_right = 0.5
	_status_label.anchor_top = 1.0
	_status_label.anchor_bottom = 1.0
	_status_label.offset_left = -180
	_status_label.offset_right = 180
	_status_label.offset_top = -46
	_status_label.offset_bottom = -22
	_status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status_label.add_theme_font_size_override("font_size", 15)
	_status_label.add_theme_constant_override("outline_size", 5)
	_status_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	_hud.add_child(_status_label)

	_roster_box = VBoxContainer.new()
	_roster_box.anchor_left = 1.0
	_roster_box.anchor_right = 1.0
	_roster_box.anchor_top = 0.32
	_roster_box.offset_left = -210
	_roster_box.offset_right = -16
	_roster_box.add_theme_constant_override("separation", 8)
	_roster_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hud.add_child(_roster_box)

	if DisplayServer.is_touchscreen_available():
		## [글자, 동작, 오른쪽 끝 x, 위 y] — 106장 ㊵ "조준"은 공격 단추 바로 위(활 인물일 때만 보임).
		var specs := [["공격", "combat_quick", -170, -300], ["스킬", "combat_ult", -300, -300], ["폭발", "combat_burst", -430, -300], ["대시", "combat_dodge", -560, -300], ["조준", "go_aim", -170, -430]]
		for sp in specs:
			var b := Button.new()
			b.text = sp[0]
			b.custom_minimum_size = Vector2(110, 110)
			b.anchor_left = 1.0
			b.anchor_right = 1.0
			b.anchor_top = 1.0
			b.anchor_bottom = 1.0
			b.offset_left = sp[2] - 110
			b.offset_right = sp[2]
			b.offset_top = sp[3]
			b.offset_bottom = sp[3] + 110
			var action: String = sp[1]
			b.button_down.connect(func(): _act(action, true))
			b.button_up.connect(func(): _act(action, false))
			_hud.add_child(b)
			_touch_buttons[action] = b
	else:
		_skill_orb = _orb("E", -196)
		_burst_orb = _orb("Q", -108)
		## 106장 ㊵ — 활 인물일 때만 "R 조준".
		_aim_hint = Label.new()
		_aim_hint.text = "R 조준"
		_aim_hint.anchor_left = 1.0
		_aim_hint.anchor_right = 1.0
		_aim_hint.anchor_top = 1.0
		_aim_hint.anchor_bottom = 1.0
		_aim_hint.offset_left = -284
		_aim_hint.offset_right = -204
		_aim_hint.offset_top = -96
		_aim_hint.offset_bottom = -70
		_aim_hint.add_theme_font_size_override("font_size", 15)
		_aim_hint.add_theme_constant_override("outline_size", 5)
		_aim_hint.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
		_aim_hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_hud.add_child(_aim_hint)

func _orb(key: String, x: float) -> Orb:
	var o := Orb.new()
	o.key_text = key
	o.anchor_left = 1.0
	o.anchor_right = 1.0
	o.anchor_top = 1.0
	o.anchor_bottom = 1.0
	o.offset_left = x
	o.offset_right = x + 76
	o.offset_top = -120
	o.offset_bottom = -44
	o.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hud.add_child(o)
	return o

func _bar(color: Color, size: Vector2, y: float) -> ProgressBar:
	var bar := ProgressBar.new()
	bar.show_percentage = false
	bar.anchor_left = 0.5
	bar.anchor_right = 0.5
	bar.anchor_top = 1.0
	bar.anchor_bottom = 1.0
	bar.offset_left = -size.x * 0.5
	bar.offset_right = size.x * 0.5
	bar.offset_top = y
	bar.offset_bottom = y + size.y
	_style_bar(bar, color)
	_hud.add_child(bar)
	return bar

func _style_bar(bar: ProgressBar, color: Color) -> void:
	var fill := StyleBoxFlat.new()
	fill.bg_color = color
	fill.set_corner_radius_all(4)
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0, 0, 0, 0.55)
	bg.set_corner_radius_all(4)
	bar.add_theme_stylebox_override("fill", fill)
	bar.add_theme_stylebox_override("background", bg)
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE

func _rebuild_roster(r: Array[String]) -> void:
	for c in _roster_box.get_children():
		c.queue_free()
	_roster_rows.clear()
	for i in r.size():
		var row := VBoxContainer.new()
		row.add_theme_constant_override("separation", 2)
		row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var l := Label.new()
		l.add_theme_font_size_override("font_size", 17)
		l.add_theme_constant_override("outline_size", 6)
		l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
		row.add_child(l)
		var bar := ProgressBar.new()
		bar.show_percentage = false
		bar.custom_minimum_size = Vector2(150, 6)
		_style_bar(bar, Elements.color_of(Elements.element_of(r[i])))
		row.add_child(bar)
		_roster_box.add_child(row)
		_roster_rows.append({"label": l, "bar": bar})
