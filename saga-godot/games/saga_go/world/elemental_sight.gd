extends CanvasLayer

## PLAN 106장 ⑬ — 원신식 원소 시야. test_village.gd 가 한 번 붙인다(GO 만).
##   마우스 가운데(휠 누르기) / V 를 누르고 있는 동안 켜진다(원신 PC 와 같은 "누르고 있기").
##   터치 기기는 오른쪽 "시야" 단추로 켜고 끈다.
##   켜지면 화면이 잿빛으로 가라앉고(가장자리 어둡게, 켜는 순간 가운데서 퍼지는 물결), 반경 45m 안에서
##   아직 안 연 보물 상자(금빛) · 안 주운 별조각(하늘빛) · 꺼진 석등(그 원소 색) · 안 켠 순간이동 지점(흰빛) ·
##   들판 적(원소 괴물은 그 원소 색, 나머지는 붉게)이 벽 너머로도 빛난다. 그리고 80m 안에서 가장 가까운
##   상자나 별조각 쪽으로 땅 위에 빛 발자국이 흐른다(원신 시야의 "흔적 따라가기" 문법).
## 빛은 잿빛 막 위 2D 로 그린다 — 3D 로 그리면 막이 그것까지 잿빛으로 덮는다. 이동·전투는 막지 않는다.
## 창(ui_modal)·결투·frozen 이면 저절로 꺼진다. 세이브에 남는 것 없음.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Waypoints := preload("res://games/saga_go/world/waypoints.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")

const RADIUS := 45.0
const TRAIL_RADIUS := 80.0
const TRAIL_STEP := 2.2
const TRAIL_MAX := 14
const FADE_PER_SEC := 5.0
const PULSE_SEC := 0.7
const SCAN_SEC := 0.25

const CHEST := Color(1.0, 0.78, 0.3)
const SHARD := Color(0.55, 0.9, 1.0)
const WAYPOINT := Color(0.85, 0.95, 1.0)
const ENEMY := Color(1.0, 0.36, 0.3)
const TARGET := Color(1.0, 0.95, 0.8)
const TRAIL := Color(0.75, 0.95, 1.0)

const SCREEN_SHADER := """
shader_type canvas_item;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform float strength = 0.0;
uniform float pulse = 1.0;
uniform vec4 tint : source_color = vec4(0.55, 0.75, 1.0, 1.0);

void fragment() {
	vec3 c = texture(screen_tex, SCREEN_UV).rgb;
	float g = dot(c, vec3(0.299, 0.587, 0.114));
	vec3 grey = mix(vec3(g), vec3(g) * tint.rgb * 1.3, 0.35) * 0.7;
	vec2 d = (SCREEN_UV - 0.5) * vec2(SCREEN_PIXEL_SIZE.y / SCREEN_PIXEL_SIZE.x, 1.0);
	float r = length(d);
	grey *= 1.0 - smoothstep(0.3, 0.85, r) * 0.5;
	float wave = 0.0;
	if (pulse < 1.0) {
		float e = (r - pulse * 1.0) * 12.0;
		wave = exp(-e * e) * (1.0 - pulse);
	}
	vec3 outc = mix(c, grey, strength) + tint.rgb * wave * 0.6 * strength;
	COLOR = vec4(outc, 1.0);
}
"""

## 빛 하나 {pos: Vector3, color: Color, kind: String}. 점검이 읽는다.
var targets: Array = []
## 흔적이 가리키는 자리(없으면 null)와 땅 위 점들.
var trail_target: Variant = null
var trail_points: Array[Vector3] = []
var active := false
var strength := 0.0

var _player: Node3D = null
var _cam: Camera3D = null
var _veil: ColorRect = null
var _mat: ShaderMaterial = null
var _marks: Control = null
var _touch: Button = null
var _pulse := 1.0
var _scan_t := 0.0
var _time := 0.0

func _ready() -> void:
	layer = -1
	add_to_group("go_elemental_sight")
	if not InputMap.has_action("go_sight"):
		InputMap.add_action("go_sight")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_V
		InputMap.action_add_event("go_sight", ev)
		var mb := InputEventMouseButton.new()
		mb.button_index = MOUSE_BUTTON_MIDDLE
		InputMap.action_add_event("go_sight", mb)
	_veil = ColorRect.new()
	_veil.set_anchors_preset(Control.PRESET_FULL_RECT)
	_veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_mat = ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = SCREEN_SHADER
	_mat.shader = sh
	_veil.material = _mat
	_veil.visible = false
	add_child(_veil)
	_marks = Marks.new()
	_marks.sight = self
	_marks.set_anchors_preset(Control.PRESET_FULL_RECT)
	_marks.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_marks.visible = false
	add_child(_marks)
	if DisplayServer.is_touchscreen_available():
		var top := CanvasLayer.new()
		top.layer = 5
		add_child(top)
		_touch = Button.new()
		_touch.text = "시야"
		_touch.toggle_mode = true
		_touch.anchor_left = 1.0
		_touch.anchor_right = 1.0
		_touch.anchor_top = 1.0
		_touch.anchor_bottom = 1.0
		_touch.offset_left = -280
		_touch.offset_right = -190
		_touch.offset_top = -420
		_touch.offset_bottom = -330
		_touch.toggled.connect(func(on: bool) -> void: set_active(on))
		top.add_child(_touch)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("go_sight"):
		set_active(true)
	elif event.is_action_released("go_sight"):
		set_active(false)

func set_active(on: bool) -> void:
	if on and _blocked():
		on = false
	if on == active:
		return
	active = on
	if _touch and _touch.button_pressed != on:
		_touch.set_pressed_no_signal(on)
	if on:
		_pulse = 0.0
		_scan_t = 0.0
		rescan()
		CombatFeel.ui()

func _blocked() -> bool:
	if get_tree().get_nodes_in_group("duel_active").size() > 0:
		return true
	for n in get_tree().get_nodes_in_group("ui_modal"):
		if _node_is_visible(n):
			return true
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
	return _player == null or bool(_player.get("frozen"))

func _node_is_visible(node: Node) -> bool:
	if node is CanvasItem:
		return (node as CanvasItem).is_visible_in_tree()
	if node is CanvasLayer:
		return (node as CanvasLayer).visible
	if node is Window:
		return (node as Window).visible
	return true

func _process(delta: float) -> void:
	_time += delta
	if active and _blocked():
		set_active(false)
	strength = move_toward(strength, 1.0 if active else 0.0, FADE_PER_SEC * delta)
	_pulse = minf(_pulse + delta / PULSE_SEC, 1.0)
	var shown := strength > 0.001
	_veil.visible = shown
	_marks.visible = shown
	if not shown:
		return
	_mat.set_shader_parameter("strength", strength)
	_mat.set_shader_parameter("pulse", _pulse)
	if active:
		_scan_t -= delta
		if _scan_t <= 0.0:
			_scan_t = SCAN_SEC
			rescan()
	_marks.queue_redraw()

# ---------------------------------------------------------------- 무엇을 짚나

func rescan() -> void:
	targets.clear()
	trail_target = null
	trail_points.clear()
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		if _player == null:
			return
	var p := _player.global_position
	var near: Array[Vector3] = [] # 흔적 후보(상자·별조각)
	for c in get_tree().get_nodes_in_group("treasure_chest"):
		if c.get("is_open"):
			continue
		var cp: Vector3 = (c as Node3D).global_position
		near.append(cp)
		_add(p, cp + Vector3.UP * 0.5, CHEST, "chest")
		for t in c.call("unlit_torches"):
			_add(p, t.pos + Vector3.UP * 1.3, Elements.color_of(t.element), "torch")
		for tp in c.call("unhit_targets"): # 106장 ㊵ 아직 안 맞힌 과녁
			_add(p, tp, TARGET, "target")
	## 이야기 seal(106장 ㉚) — 다음 차례 석등만(흔적 후보는 아님, 금빛 기둥이 제단을 이미 짚는다).
	var story := get_tree().get_first_node_in_group("go_story")
	if story:
		for t in story.call("seal_hint"):
			_add(p, t.pos + Vector3.UP * 1.5, t.color, "torch")
	var shards := get_tree().get_first_node_in_group("go_star_shards")
	if shards:
		for sp in shards.call("remaining_positions"):
			near.append(sp)
			_add(p, sp, SHARD, "shard")
	var wps := get_tree().get_first_node_in_group("go_waypoints")
	if wps:
		for id in Waypoints.point_ids():
			if not Waypoints.is_active(id):
				_add(p, wps.call("world_pos_of", id) + Vector3.UP * 1.6, WAYPOINT, "waypoint")
	for e in get_tree().get_nodes_in_group("field_enemy"):
		if e.call("is_dead"):
			continue
		var el: String = e.get("element")
		_add(p, (e as Node3D).global_position + Vector3.UP * 1.0, Elements.color_of(el) if el != "" else ENEMY, "enemy")
	var best := TRAIL_RADIUS
	for q in near:
		var d := Vector2(q.x - p.x, q.z - p.z).length()
		if d < best:
			best = d
			trail_target = q
	if trail_target != null:
		_build_trail(p, trail_target)

func _add(from: Vector3, pos: Vector3, color: Color, kind: String) -> void:
	if from.distance_to(pos) <= RADIUS:
		targets.append({"pos": pos, "color": color, "kind": kind})

func count_of(kind: String) -> int:
	var n := 0
	for t in targets:
		if t.kind == kind:
			n += 1
	return n

## 인물 발밑에서 과녁 쪽으로 TRAIL_STEP 마다 땅 위 점(과녁 바로 앞까지, TRAIL_MAX 개).
func _build_trail(from: Vector3, to: Vector3) -> void:
	var flat := Vector3(to.x - from.x, 0.0, to.z - from.z)
	var dist := flat.length()
	if dist < TRAIL_STEP:
		return
	var dir := flat / dist
	var n := mini(int(dist / TRAIL_STEP), TRAIL_MAX)
	for i in range(1, n + 1):
		var q := from + dir * TRAIL_STEP * float(i)
		var region := TestMap.region_at(q)
		q.y = (TerrainBuilder.height_at(region, q) if region != "" else from.y) + 0.15
		trail_points.append(q)

# ---------------------------------------------------------------- 그리기

class Marks extends Control:
	var sight: Node = null

	func _draw() -> void:
		var cam := get_viewport().get_camera_3d()
		if cam == null or sight == null:
			return
		var s: float = sight.strength
		for t in sight.targets:
			var pos: Vector3 = t.pos
			if cam.is_position_behind(pos):
				continue
			var sp := cam.unproject_position(pos)
			var d := cam.global_position.distance_to(pos)
			var r := clampf(700.0 / maxf(d, 1.0), 9.0, 46.0)
			var col: Color = t.color
			if t.kind == "enemy":
				r *= 0.7
			for i in 3:
				var k := 1.0 - float(i) * 0.3
				draw_circle(sp, r * (1.0 + float(i) * 0.6), Color(col.r, col.g, col.b, 0.28 * k * s))
			draw_arc(sp, r * 0.55, 0.0, TAU, 32, Color(col.r, col.g, col.b, 0.95 * s).lightened(0.3), 2.5, true)
		var time: float = sight.get("_time")
		var pts: Array[Vector3] = sight.trail_points
		for i in pts.size():
			var q: Vector3 = pts[i]
			if cam.is_position_behind(q):
				continue
			var sp := cam.unproject_position(q)
			var d := cam.global_position.distance_to(q)
			var wave := 0.5 + 0.5 * sin(time * 5.0 - float(i) * 0.7)
			var r := clampf(260.0 / maxf(d, 1.0), 3.0, 14.0) * (0.8 + 0.4 * wave)
			var a := (0.35 + 0.6 * wave) * s
			draw_circle(sp, r * 1.8, Color(TRAIL.r, TRAIL.g, TRAIL.b, a * 0.3))
			draw_circle(sp, r, Color(TRAIL.r, TRAIL.g, TRAIL.b, a))
