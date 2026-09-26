extends CanvasLayer

## PLAN 106장 ⑨ — 원신식 지도. test_village.gd 가 한 번 붙인다(GO 만).
##   미니맵: 왼쪽 위 원형, 북쪽이 위(원신과 같다). 가운데 화살표 = 인물이 보는 쪽, 옅은 부채꼴 = 카메라.
##   지도 화면(M · 미니맵 누르기): 세 지역을 한 장으로, 끌어 옮기고 휠로 확대. 활성 순간이동 지점을
##   누르면 아래 "순간이동" 단추. 오른쪽에 지역별 탐험도(순간이동 지점 + 보물 상자).
##   지역 지도 밝히기: 그 지역 신상을 활성화하기 전엔 구름에 덮여 어둡다(원신 신상 문법).
##   지역 이름: 지역 경계를 넘으면 화면 위 가운데에 크게 떴다 사라진다.
## 그림은 terrain_builder 의 지형 색(LEGEND)과 height_at 으로 음영을 넣어 코드로 굽는다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Waypoints := preload("res://games/saga_go/world/waypoints.gd")
const TreasureSpawner := preload("res://games/saga_go/world/treasure_spawner.gd")
const StarShards := preload("res://games/saga_go/world/star_shards.gd")
const FieldBosses := preload("res://games/saga_go/world/field_bosses.gd") # 106장 ㉓ 들판 보스 표시(신상을 켠 지역만)
const FishingSpots := preload("res://games/saga_go/world/fishing.gd") # 106장 ㊷ 낚시터 표시(신상을 켠 지역만)
const FishingData := preload("res://games/saga_go/data/fishing.gd")

const M_PER_PX := 3.0
const MINI_SIZE := 190.0
const MINI_SPAN_M := 220.0 # 미니맵 지름에 담기는 거리
const FOG := Color(0.16, 0.2, 0.27)
const OUTSIDE := Color(0.13, 0.17, 0.23)
## LEGEND 의 ~·W 는 강바닥 색이다(물은 따로 메시) — 지도엔 물빛으로.
const WATER := Color(0.36, 0.62, 0.84)
const BANNER_SEC := 2.8

const REGION_NAMES := {"village": "청하 마을", "coast": "갯바람 포구", "ruins": "잿빛 폐허", "frost": "서리봉 고원", "skyport": "은하 나루", "crossing": "틈새 갈림길", "sunken": "잠긴 도읍"}
## 지역마다 지도를 밝히는 신상(waypoints.gd POINTS 의 신상 id).
## 106장 ㊶ 임무 표식 색(story_quest.gd WQ_BLUE 와 같게).
const STORY_GOLD := Color(1.0, 0.84, 0.35)
const WQ_BLUE := Color(0.45, 0.8, 1.0)
const REGION_STATUE := {"village": "v_statue", "coast": "c_dock", "ruins": "r_statue", "frost": "f_statue", "skyport": "s_statue", "crossing": "x_statue", "sunken": "u_statue"}

var map_texture: ImageTexture = null
var shown_image: Image = null # map_texture 에 올린 그림(구름까지) — 점검이 읽는다
var bounds := Rect2() # 월드 xz → 지도 전체가 덮는 사각형(m)
var is_open := false
var current_region := ""

var _base: Image = null
var _player: Node3D = null
var _cam: Node3D = null
var _wps: Node = null
var _mini: ColorRect = null
var _mini_overlay: Control = null
var _banner: Label = null
var _banner_t := 0.0
var _screen: Control = null
var _view: MapView = null
var _explore_label: Label = null
var _select_label: Label = null
var _warp_button: Button = null
var _selected := ""
var _selected_mark: Dictionary = {} # 106장 ㊶ 지도에서 누른 임무 표식(map_marks 한 칸)
var _track_button: Button = null
var _frozen_before := false

func _ready() -> void:
	layer = 5
	add_to_group("go_world_map")
	_ensure_action()
	_bake_base()
	_rebuild_texture()
	_build_minimap()
	_build_banner()
	_build_screen()
	_player = get_tree().get_first_node_in_group("player")
	_make_room_under_minimap()

## 왼쪽 위 글자들(대화·부대·사명·도감·날씨, MobileHUD.tscn)을 미니맵 아래로 — 원신도 미니맵 밑에
## 임무 추적이 있다. 씬 파일은 그대로 두고 여기서 한 번 옮긴다(GO 만).
const HUD_LEFT_NODES := ["DialoguePanel", "DialogueLabel", "PartyLabel", "QuestLabel", "CodexLabel", "WeatherLabel"]

func _make_room_under_minimap() -> void:
	var hud := get_tree().current_scene.find_child("MobileHUD", true, false)
	if hud == null:
		return
	var shift := MINI_SIZE + 12.0
	for n in HUD_LEFT_NODES:
		var c := hud.get_node_or_null(n) as Control
		if c and c.anchor_top == 0.0:
			c.offset_top += shift
			c.offset_bottom += shift

func _ensure_action() -> void:
	if InputMap.has_action("go_map"):
		return
	InputMap.add_action("go_map")
	var ev := InputEventKey.new()
	ev.physical_keycode = KEY_M
	InputMap.action_add_event("go_map", ev)

## waypoints.gd 가 먼저 지어져 있어야 한다(test_village.gd 순서).
func bind_waypoints(wps: Node) -> void:
	_wps = wps
	wps.connect("activated", func(_id: String) -> void:
		_rebuild_texture()
		_refresh_screen())

# ---------------------------------------------------------------- 그림 굽기

func _bake_base() -> void:
	var first := true
	for id in TestMap.REGIONS:
		var s := TestMap.size(id)
		var ts := TestMap.tile_size_of(id)
		var o := TestMap.origin_of(id)
		var r := Rect2(o.x - s.x * ts * 0.5, o.z - s.y * ts * 0.5, s.x * ts, s.y * ts)
		bounds = r if first else bounds.merge(r)
		first = false
	var w := int(ceil(bounds.size.x / M_PER_PX))
	var h := int(ceil(bounds.size.y / M_PER_PX))
	var heights := PackedFloat32Array()
	heights.resize(w * h)
	var regions := PackedStringArray()
	regions.resize(w * h)
	for py in h:
		for px in w:
			var world := _px_to_world(Vector2(px + 0.5, py + 0.5))
			var rid := TestMap.region_at(world)
			regions[py * w + px] = rid
			heights[py * w + px] = TerrainBuilder.height_at(rid, world) if rid != "" else 0.0
	_base = Image.create(w, h, false, Image.FORMAT_RGBA8)
	for py in h:
		for px in w:
			var i := py * w + px
			var rid := regions[i]
			if rid == "":
				_base.set_pixel(px, py, OUTSIDE)
				continue
			var world := _px_to_world(Vector2(px + 0.5, py + 0.5))
			var g := TestMap.grid_at(rid, world)
			var ch := TestMap.tile_at(g.x, g.y, rid)
			var col: Color = TerrainBuilder.color_of(rid, ch) if TerrainBuilder.LEGEND.has(ch) else OUTSIDE
			if ch == "~" or ch == "W":
				_base.set_pixel(px, py, WATER)
				continue
			## 북서쪽 빛 음영 — 원신 지도처럼 산이 도드라지게.
			var hl := heights[py * w + maxi(px - 1, 0)]
			var hu := heights[maxi(py - 1, 0) * w + px]
			var shade := clampf(1.0 + (heights[i] - hl + heights[i] - hu) * 0.035, 0.7, 1.25)
			col = Color(col.r * shade, col.g * shade, col.b * shade)
			## 칸 경계를 살짝 흐리게 — 바둑판 대신 손그림 느낌.
			var edge := _edge_line(rid, world)
			if edge > 0.0:
				col = col.darkened(0.12 * edge)
			_base.set_pixel(px, py, col)

func _edge_line(rid: String, world: Vector3) -> float:
	## 물과 땅이 맞닿는 물가만 옅은 흰 줄 대신 어두운 줄(해안선).
	var ts := TestMap.tile_size_of(rid)
	var local := world - TestMap.origin_of(rid)
	var s := TestMap.size(rid)
	var gx := local.x / ts + s.x * 0.5 + 0.5
	var gy := local.z / ts + s.y * 0.5 + 0.5
	var fx := gx - floorf(gx)
	var fy := gy - floorf(gy)
	var near_edge := minf(minf(fx, 1.0 - fx), minf(fy, 1.0 - fy)) < (M_PER_PX / ts)
	if not near_edge:
		return 0.0
	var here := TestMap.tile_at(int(floorf(gx)), int(floorf(gy)), rid)
	var nx := int(floorf(gx + (0.5 if fx > 0.5 else -0.5)))
	var ny := int(floorf(gy + (0.5 if fy > 0.5 else -0.5)))
	var there := TestMap.tile_at(nx, int(floorf(gy)), rid) if minf(fx, 1.0 - fx) < minf(fy, 1.0 - fy) else TestMap.tile_at(int(floorf(gx)), ny, rid)
	return 1.0 if (here == "~") != (there == "~") else 0.0

## 신상을 안 밝힌 지역은 구름(어둡게)으로 덮는다.
func _rebuild_texture() -> void:
	var img := _base.duplicate() as Image
	for rid in TestMap.REGIONS:
		if revealed(rid):
			continue
		var r := _region_px_rect(rid)
		for py in range(int(r.position.y), int(r.end.y)):
			for px in range(int(r.position.x), int(r.end.x)):
				if px < 0 or py < 0 or px >= img.get_width() or py >= img.get_height():
					continue
				var c := img.get_pixel(px, py)
				var n := 0.5 + 0.5 * sin(px * 0.21) * cos(py * 0.17)
				img.set_pixel(px, py, c.lerp(FOG, 0.72 + 0.12 * n))
	shown_image = img
	if map_texture == null:
		map_texture = ImageTexture.create_from_image(img)
	else:
		map_texture.update(img)

func revealed(rid: String) -> bool:
	return Waypoints.is_active(REGION_STATUE.get(rid, ""))

func _region_px_rect(rid: String) -> Rect2:
	var s := TestMap.size(rid)
	var ts := TestMap.tile_size_of(rid)
	var o := TestMap.origin_of(rid)
	var a := world_to_px(Vector3(o.x - s.x * ts * 0.5, 0, o.z - s.y * ts * 0.5))
	var b := world_to_px(Vector3(o.x + s.x * ts * 0.5, 0, o.z + s.y * ts * 0.5))
	return Rect2(a, b - a)

func world_to_px(world: Vector3) -> Vector2:
	return Vector2((world.x - bounds.position.x) / M_PER_PX, (world.z - bounds.position.y) / M_PER_PX)

func _px_to_world(px: Vector2) -> Vector3:
	return Vector3(bounds.position.x + px.x * M_PER_PX, 0.0, bounds.position.y + px.y * M_PER_PX)

# ---------------------------------------------------------------- 탐험도

## 지역 탐험도(0~1) — 그 지역의 순간이동 지점 활성화 + 보물 상자 열기 + 별조각 줍기(106장 ⑪).
static func exploration(rid: String) -> float:
	var total := 0
	var done := 0
	for row in Waypoints.POINTS:
		if row[1] == rid:
			total += 1
			if Waypoints.is_active(row[0]):
				done += 1
	for row in TreasureSpawner.CHESTS:
		if row[1] == rid:
			total += 1
			if EventState.is_resolved("chest_" + String(row[0])):
				done += 1
	for row in StarShards.in_region(rid):
		total += 1
		if EventState.is_resolved("shard_" + String(row[0])):
			done += 1
	return float(done) / float(total) if total > 0 else 0.0

# ---------------------------------------------------------------- 미니맵

const MINI_SHADER := """
shader_type canvas_item;
uniform sampler2D map_tex : filter_linear, repeat_disable;
uniform vec2 center_uv;
uniform vec2 span_uv;
void fragment() {
	vec2 d = UV - vec2(0.5);
	float r = length(d);
	if (r > 0.5) discard;
	vec2 uv = center_uv + d * span_uv;
	vec4 c = texture(map_tex, uv);
	if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) c = vec4(0.13, 0.17, 0.23, 1.0);
	float rim = smoothstep(0.44, 0.5, r);
	COLOR = mix(c, vec4(0.93, 0.88, 0.74, 1.0), rim);
}
"""

func _build_minimap() -> void:
	_mini = ColorRect.new()
	_mini.position = Vector2(20, 20)
	_mini.size = Vector2(MINI_SIZE, MINI_SIZE)
	var sh := Shader.new()
	sh.code = MINI_SHADER
	var mat := ShaderMaterial.new()
	mat.shader = sh
	mat.set_shader_parameter("map_tex", map_texture)
	_mini.material = mat
	_mini.gui_input.connect(func(ev: InputEvent) -> void:
		if (ev is InputEventMouseButton and (ev as InputEventMouseButton).pressed and (ev as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT) \
				or (ev is InputEventScreenTouch and (ev as InputEventScreenTouch).pressed):
			open_map())
	add_child(_mini)
	_mini_overlay = MiniOverlay.new()
	_mini_overlay.map = self
	_mini_overlay.position = _mini.position
	_mini_overlay.size = _mini.size
	_mini_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_mini_overlay)

func _process(delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		if _player == null:
			return
	if _cam == null:
		_cam = get_tree().get_first_node_in_group("camera_rig")
	var tex_size := Vector2(_base.get_width(), _base.get_height())
	var mat := _mini.material as ShaderMaterial
	mat.set_shader_parameter("center_uv", world_to_px(_player.global_position) / tex_size)
	mat.set_shader_parameter("span_uv", Vector2(MINI_SPAN_M / M_PER_PX, MINI_SPAN_M / M_PER_PX) / tex_size)
	_mini_overlay.queue_redraw()
	_tick_region(delta)
	if is_open:
		_view.queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("go_map"):
		if is_open:
			close_map()
		else:
			open_map()
		get_viewport().set_input_as_handled()
	elif is_open and event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE:
		close_map()
		get_viewport().set_input_as_handled()

## 화면 방향: 위 = 북(-z), 오른쪽 = 동(+x). 월드 xz 벡터 → 화면 각도.
static func screen_angle(v: Vector3) -> float:
	return atan2(v.z, v.x)

func facing_dir() -> Vector3:
	if _player and _player.has_method("facing"):
		return _player.call("facing")
	return Vector3.FORWARD

func camera_dir() -> Vector3:
	return -_cam.global_transform.basis.z if _cam else Vector3.FORWARD

class MiniOverlay extends Control:
	var map: Node = null

	static func _ang(v: Vector3) -> float:
		return atan2(v.z, v.x)

	func _draw() -> void:
		if map == null or map.get("_player") == null:
			return
		var c := size * 0.5
		var px_per_m: float = size.x / MINI_SPAN_M
		## 카메라 부채꼴.
		var ca: float = _ang(map.camera_dir())
		var pts := PackedVector2Array([c])
		for i in 9:
			var a := ca - 0.5 + float(i) / 8.0
			pts.append(c + Vector2(cos(a), sin(a)) * 46.0)
		draw_colored_polygon(pts, Color(1, 1, 1, 0.18))
		## 순간이동 지점·신상.
		var wps: Node = map.get("_wps")
		var me: Vector3 = map.get("_player").global_position
		if wps:
			for row in Waypoints.POINTS:
				var p: Vector3 = wps.call("world_pos_of", row[0])
				var d := Vector2(p.x - me.x, p.z - me.z) * px_per_m
				if d.length() > size.x * 0.5 - 10.0:
					continue
				map.draw_waypoint_icon(self, c + d, row[3], Waypoints.is_active(row[0]), 1.0)
		for id in FieldBosses.FB.ORDER:
			var bp: Vector3 = FieldBosses.home_of(id)
			var bd := Vector2(bp.x - me.x, bp.z - me.z) * px_per_m
			if bd.length() <= size.x * 0.5 - 10.0 and map.call("revealed", FieldBosses.FB.BOSSES[id].region):
				map.draw_boss_icon(self, c + bd, 1.0)
		for fid in FishingData.SPOT_ORDER:
			var fp: Vector3 = FishingSpots.stand_pos(fid)
			var fd := Vector2(fp.x - me.x, fp.z - me.z) * px_per_m
			if fd.length() <= size.x * 0.5 - 10.0 and map.call("revealed", FishingData.spot(fid).region):
				map.draw_fish_icon(self, c + fd, 1.0)
		## 106장 ㉕·㊶ 임무 표식 — 따라가는 임무는 멀면 미니맵 가장자리에 붙이고(원신과 같다),
		## 맡을 수 있는 !·안 따라가는 임무는 둘레 안에 있을 때만.
		var lim := size.x * 0.5 - 10.0
		for mk in map.call("quest_marks"):
			var mp: Vector3 = mk.pos
			var sd := Vector2(mp.x - me.x, mp.z - me.z) * px_per_m
			if sd.length() > lim:
				if not map.call("is_tracked_kind", String(mk.kind)):
					continue
				sd = sd.normalized() * lim
			map.draw_quest_icon(self, c + sd, String(mk.kind), 1.0)
		## 인물 화살표.
		var fa: float = _ang(map.facing_dir())
		var tip := c + Vector2(cos(fa), sin(fa)) * 11.0
		var l := c + Vector2(cos(fa + 2.5), sin(fa + 2.5)) * 8.0
		var r := c + Vector2(cos(fa - 2.5), sin(fa - 2.5)) * 8.0
		draw_colored_polygon(PackedVector2Array([tip, l, c, r]), Color(1.0, 0.92, 0.55))
		draw_polyline(PackedVector2Array([tip, l, c, r, tip]), Color(0.2, 0.15, 0.05), 1.5)
		draw_string(ThemeDB.fallback_font, Vector2(c.x - 6, 16), "N", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.25, 0.2, 0.1))

## 아이콘 — 신상은 금빛 원, 순간이동 지점은 마름모. 꺼진 것은 회색.
func draw_waypoint_icon(ci: CanvasItem, at: Vector2, statue: bool, on: bool, s: float) -> void:
	var col := Waypoints.ACTIVE if on else Color(0.55, 0.58, 0.62)
	if statue:
		ci.draw_circle(at, 8.0 * s, Color(0.12, 0.1, 0.05, 0.85))
		ci.draw_circle(at, 6.0 * s, Waypoints.STATUE_GOLD if on else col)
	else:
		var pts := PackedVector2Array([at + Vector2(0, -8) * s, at + Vector2(6, 0) * s, at + Vector2(0, 8) * s, at + Vector2(-6, 0) * s])
		ci.draw_colored_polygon(pts, col)
		ci.draw_polyline(PackedVector2Array([pts[0], pts[1], pts[2], pts[3], pts[0]]), Color(0.08, 0.1, 0.12), 1.5)

## 들판 보스 — 붉은 원에 뿔 둘.
func draw_boss_icon(ci: CanvasItem, at: Vector2, s: float) -> void:
	var horn := Color(1.0, 0.92, 0.8)
	ci.draw_colored_polygon(PackedVector2Array([at + Vector2(-6, -3) * s, at + Vector2(-8, -12) * s, at + Vector2(-2, -6) * s]), horn)
	ci.draw_colored_polygon(PackedVector2Array([at + Vector2(6, -3) * s, at + Vector2(8, -12) * s, at + Vector2(2, -6) * s]), horn)
	ci.draw_circle(at, 8.0 * s, Color(0.1, 0.04, 0.06, 0.9))
	ci.draw_circle(at, 6.0 * s, Color(0.78, 0.22, 0.3))

## 106장 ㊷ 낚시터 — 물빛 원에 흰 물고기(몸통 + 꼬리).
func draw_fish_icon(ci: CanvasItem, at: Vector2, s: float) -> void:
	ci.draw_circle(at, 8.0 * s, Color(0.04, 0.12, 0.2, 0.9))
	ci.draw_circle(at, 6.5 * s, Color(0.3, 0.62, 0.86))
	ci.draw_colored_polygon(PackedVector2Array([at + Vector2(-4, 0) * s, at + Vector2(0, -2.4) * s, at + Vector2(3, 0) * s, at + Vector2(0, 2.4) * s]), Color(1, 1, 1))
	ci.draw_colored_polygon(PackedVector2Array([at + Vector2(2.5, 0) * s, at + Vector2(5, -2.2) * s, at + Vector2(5, 2.2) * s]), Color(1, 1, 1))

## 이야기 임무 목표 — 금빛 마름모.
func draw_story_icon(ci: CanvasItem, at: Vector2, s: float) -> void:
	draw_quest_icon(ci, at, "story", s)

## 106장 ㊶ 임무 표식(story_quest.map_marks 의 kind) — 이야기 금빛·세계 임무 푸른빛, 따라가는 것은 찬 마름모,
## 안 따라가는 것은 빈 마름모, 맡을 수 있는 세계 임무는 둥근 판에 "!".
func draw_quest_icon(ci: CanvasItem, at: Vector2, kind: String, s: float) -> void:
	var col := STORY_GOLD if kind.begins_with("story") else WQ_BLUE
	var ink := Color(0.25, 0.15, 0.02) if kind.begins_with("story") else Color(0.04, 0.14, 0.24)
	if kind == "wq_open":
		ci.draw_circle(at, 9.0 * s, Color(0.04, 0.1, 0.18, 0.9))
		ci.draw_circle(at, 7.5 * s, col)
		ci.draw_rect(Rect2(at + Vector2(-1.3, -5.2) * s, Vector2(2.6, 6.4) * s), ink)
		ci.draw_circle(at + Vector2(0, 3.8) * s, 1.5 * s, ink)
		return
	var pts := PackedVector2Array([at + Vector2(0, -10) * s, at + Vector2(7, 0) * s, at + Vector2(0, 10) * s, at + Vector2(-7, 0) * s])
	var ring := PackedVector2Array([pts[0], pts[1], pts[2], pts[3], pts[0]])
	if is_tracked_kind(kind):
		ci.draw_colored_polygon(pts, col)
		ci.draw_polyline(ring, ink, 2.0)
	else:
		ci.draw_colored_polygon(pts, Color(ink.r, ink.g, ink.b, 0.55))
		ci.draw_polyline(ring, col, 2.2)

func is_tracked_kind(kind: String) -> bool:
	return kind == "story" or kind == "wq_track"

## 지금 지도에 그릴 임무 표식(story_quest.map_marks) — 이야기 노드가 없으면 [].
## 신상을 안 켠 지역(구름)엔 맡을 수 있는 !·안 따라가는 표식을 안 그린다 — 따라가는 목표는 늘 보인다.
func quest_marks() -> Array:
	var story := get_tree().get_first_node_in_group("go_story")
	if story == null:
		return []
	var out: Array = []
	for mk in story.call("map_marks"):
		if not is_tracked_kind(String(mk.kind)):
			var rid := TestMap.region_at(mk.pos)
			if rid != "" and not revealed(rid):
				continue
		out.append(mk)
	return out

# ---------------------------------------------------------------- 지역 이름

func _build_banner() -> void:
	_banner = Label.new()
	_banner.anchor_left = 0.5
	_banner.anchor_right = 0.5
	_banner.offset_left = -300
	_banner.offset_right = 300
	_banner.offset_top = 90
	_banner.offset_bottom = 150
	_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner.add_theme_font_size_override("font_size", 40)
	_banner.add_theme_constant_override("outline_size", 10)
	_banner.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.6))
	_banner.add_theme_color_override("font_color", Color(1.0, 0.96, 0.86))
	_banner.modulate.a = 0.0
	_banner.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_banner)

func _tick_region(delta: float) -> void:
	var rid := TestMap.region_at(_player.global_position)
	if rid != "" and rid != current_region:
		var first := current_region == ""
		current_region = rid
		if not first:
			show_banner(REGION_NAMES.get(rid, rid))
	if _banner_t > 0.0:
		_banner_t -= delta
		var t := BANNER_SEC - _banner_t
		_banner.modulate.a = clampf(minf(t / 0.5, _banner_t / 0.8), 0.0, 1.0)

func show_banner(text: String) -> void:
	_banner.text = "— %s —" % text
	_banner_t = BANNER_SEC

# ---------------------------------------------------------------- 지도 화면

class MapView extends Control:
	var map: Node = null

	static func _ang(v: Vector3) -> float:
		return atan2(v.z, v.x)
	var zoom := 1.6
	var offset := Vector2.ZERO
	var _drag := false
	var _moved := 0.0

	func center_on(world: Vector3) -> void:
		var px: Vector2 = map.world_to_px(world)
		offset = size * 0.5 - px * zoom

	func _gui_input(ev: InputEvent) -> void:
		if ev is InputEventMouseButton:
			var mb := ev as InputEventMouseButton
			if mb.button_index == MOUSE_BUTTON_LEFT:
				if mb.pressed:
					_drag = true
					_moved = 0.0
				else:
					_drag = false
					if _moved < 6.0:
						map.call("_pick_at", (mb.position - offset) / zoom)
			elif mb.pressed and (mb.button_index == MOUSE_BUTTON_WHEEL_UP or mb.button_index == MOUSE_BUTTON_WHEEL_DOWN):
				var old := zoom
				zoom = clampf(zoom * (1.15 if mb.button_index == MOUSE_BUTTON_WHEEL_UP else 1.0 / 1.15), 0.8, 5.0)
				offset = mb.position - (mb.position - offset) * (zoom / old)
			accept_event()
		elif ev is InputEventMouseMotion and _drag:
			var rel := (ev as InputEventMouseMotion).relative
			offset += rel
			_moved += rel.length()
			accept_event()
		elif ev is InputEventScreenDrag:
			offset += (ev as InputEventScreenDrag).relative
			accept_event()
		elif ev is InputEventScreenTouch and not (ev as InputEventScreenTouch).pressed:
			map.call("_pick_at", ((ev as InputEventScreenTouch).position - offset) / zoom)

	func _draw() -> void:
		var tex: Texture2D = map.get("map_texture")
		draw_rect(Rect2(Vector2.ZERO, size), Color(0.1, 0.13, 0.18))
		draw_texture_rect(tex, Rect2(offset, tex.get_size() * zoom), false)
		var font := ThemeDB.fallback_font
		for rid in REGION_NAMES:
			var r: Rect2 = map.call("_region_px_rect", rid)
			var at: Vector2 = offset + r.get_center() * zoom
			## 이름 한 줄 + 안 밝힌 지역은 작은 둘째 줄(한 줄로 이으면 이웃 지역 이름과 겹쳐 잘렸다 — 2026-09-26 촬영).
			draw_string(font, at - Vector2(160, 0), String(REGION_NAMES[rid]), HORIZONTAL_ALIGNMENT_CENTER, 320, 20, Color(1, 0.97, 0.88, 0.9))
			if not map.call("revealed", rid):
				draw_string(font, at + Vector2(-160, 18), "신상을 켜면 밝아진다", HORIZONTAL_ALIGNMENT_CENTER, 320, 13, Color(1, 0.97, 0.88, 0.7))
		var wps: Node = map.get("_wps")
		if wps:
			for row in Waypoints.POINTS:
				var p: Vector3 = wps.call("world_pos_of", row[0])
				var at: Vector2 = offset + map.world_to_px(p) * zoom
				map.draw_waypoint_icon(self, at, row[3], Waypoints.is_active(row[0]), 1.4)
				if row[0] == map.get("_selected"):
					draw_arc(at, 16.0, 0.0, TAU, 32, Color(1, 1, 1), 2.0)
		for id in FieldBosses.FB.ORDER:
			if map.call("revealed", FieldBosses.FB.BOSSES[id].region):
				map.draw_boss_icon(self, offset + map.world_to_px(FieldBosses.home_of(id)) * zoom, 1.4)
		for fid in FishingData.SPOT_ORDER:
			if map.call("revealed", FishingData.spot(fid).region):
				map.draw_fish_icon(self, offset + map.world_to_px(FishingSpots.stand_pos(fid)) * zoom, 1.4)
		var sel: Dictionary = map.get("_selected_mark")
		for mk in map.call("quest_marks"):
			var qat: Vector2 = offset + map.world_to_px(mk.pos) * zoom
			map.draw_quest_icon(self, qat, String(mk.kind), 1.4)
			if not sel.is_empty() and sel.kind == mk.kind and sel.quest == mk.quest:
				draw_arc(qat, 17.0, 0.0, TAU, 32, Color(1, 1, 1), 2.0)
		var me: Node3D = map.get("_player")
		if me:
			var at: Vector2 = offset + map.world_to_px(me.global_position) * zoom
			var fa: float = _ang(map.facing_dir())
			var tip := at + Vector2(cos(fa), sin(fa)) * 14.0
			var l := at + Vector2(cos(fa + 2.5), sin(fa + 2.5)) * 10.0
			var r := at + Vector2(cos(fa - 2.5), sin(fa - 2.5)) * 10.0
			draw_colored_polygon(PackedVector2Array([tip, l, at, r]), Color(1.0, 0.92, 0.55))

func _build_screen() -> void:
	_screen = Control.new()
	_screen.set_anchors_preset(Control.PRESET_FULL_RECT)
	_screen.visible = false
	add_child(_screen)
	_view = MapView.new()
	_view.map = self
	_view.set_anchors_preset(Control.PRESET_FULL_RECT)
	_screen.add_child(_view)

	var side := PanelContainer.new()
	side.anchor_left = 1.0
	side.anchor_right = 1.0
	side.offset_left = -260
	side.offset_right = -20
	side.offset_top = 20
	side.offset_bottom = 330
	_screen.add_child(side)
	var box := VBoxContainer.new()
	side.add_child(box)
	var title := Label.new()
	title.text = "탐험도"
	title.add_theme_font_size_override("font_size", 20)
	box.add_child(title)
	_explore_label = Label.new()
	box.add_child(_explore_label)
	var legend := Label.new()
	legend.text = "◆ 따라가는 임무(금 이야기·푸른 세계)\n◇ 진행 중 · ! 맡을 수 있는 세계 임무"
	legend.add_theme_font_size_override("font_size", 13)
	box.add_child(legend)
	var hint := Label.new()
	hint.text = "M·Esc 닫기 · 끌기 옮기기 · 휠 확대"
	hint.add_theme_font_size_override("font_size", 13)
	box.add_child(hint)

	var bottom := PanelContainer.new()
	bottom.anchor_left = 1.0
	bottom.anchor_right = 1.0
	bottom.anchor_top = 1.0
	bottom.anchor_bottom = 1.0
	bottom.offset_left = -360
	bottom.offset_right = -20
	bottom.offset_top = -168
	bottom.offset_bottom = -20
	_screen.add_child(bottom)
	var bbox := VBoxContainer.new()
	bottom.add_child(bbox)
	_select_label = Label.new()
	_select_label.text = "순간이동 지점을 누르세요"
	bbox.add_child(_select_label)
	_warp_button = Button.new()
	_warp_button.text = "순간이동"
	_warp_button.disabled = true
	_warp_button.custom_minimum_size = Vector2(0, 44)
	_warp_button.pressed.connect(func() -> void: warp_selected())
	bbox.add_child(_warp_button)
	_track_button = Button.new()
	_track_button.text = "따라가기"
	_track_button.visible = false
	_track_button.custom_minimum_size = Vector2(0, 44)
	_track_button.pressed.connect(func() -> void: track_selected())
	bbox.add_child(_track_button)

	var close := Button.new()
	close.text = "닫기"
	close.anchor_left = 0.0
	close.offset_left = 20
	close.offset_top = 20
	close.offset_right = 110
	close.offset_bottom = 64
	close.pressed.connect(close_map)
	_screen.add_child(close)

func _refresh_screen() -> void:
	if _explore_label == null:
		return
	var lines: Array[String] = []
	for rid in REGION_NAMES:
		lines.append("%s  %d%%" % [REGION_NAMES[rid], int(round(exploration(rid) * 100.0))])
	lines.append("")
	lines.append("신상 Lv.%d · 별조각 %d/%d (바친 것 %d)" % [StarShards.statue_level(), StarShards.collected(), StarShards.total(), StarShards.offered()])
	_explore_label.text = "\n".join(lines)
	_track_button.visible = not _selected_mark.is_empty()
	if not _selected_mark.is_empty():
		_refresh_mark_selection()
		return
	_warp_button.text = "순간이동"
	if _selected == "":
		_select_label.text = "순간이동 지점·임무 표식을 누르세요"
		_warp_button.disabled = true
		return
	var row := Waypoints.row_of(_selected)
	var on := Waypoints.is_active(_selected)
	_select_label.text = "%s%s" % [row[4], "" if on else " — 아직 활성화 안 됨(가까이 가면 켜진다)"]
	_warp_button.disabled = not on

func _pick_at(px: Vector2) -> void:
	if _wps == null:
		return
	var best := ""
	var best_d := 18.0 / _view.zoom
	for row in Waypoints.POINTS:
		var d := world_to_px(_wps.call("world_pos_of", row[0])).distance_to(px)
		if d < best_d:
			best_d = d
			best = row[0]
	## 106장 ㊶ — 임무 표식이 더 가까우면 그것.
	var mark: Dictionary = {}
	for mk in quest_marks():
		var d := world_to_px(mk.pos).distance_to(px)
		if d < best_d:
			best_d = d
			mark = mk
	_selected = "" if not mark.is_empty() else best
	_selected_mark = mark
	_refresh_screen()

func select(id: String) -> void:
	_selected = id
	_selected_mark = {}
	_refresh_screen()

## 106장 ㊶ 임무 표식 고르기(점검·지도 누르기) — kind·quest 가 같은 표식을 찾아서.
func select_mark(kind: String, quest: String) -> bool:
	for mk in quest_marks():
		if String(mk.kind) == kind and String(mk.quest) == quest:
			_selected = ""
			_selected_mark = mk
			_refresh_screen()
			return true
	return false

## 고른 표식 글자·단추 — 따라가기(맡은 임무·이야기, 이미 따라가면 막음) · 순간이동 = 표식에서 가장 가까운 켠 지점.
func _refresh_mark_selection() -> void:
	var mk := _selected_mark
	var kind := String(mk.kind)
	var head := "이야기 임무" if kind.begins_with("story") else "세계 임무"
	var near := nearest_active_point(mk.pos)
	var near_txt := ""
	if near != "":
		near_txt = "\n가까운 지점: %s (%dm)" % [Waypoints.row_of(near)[4], int(_flat_dist(_wps.call("world_pos_of", near), mk.pos))]
	_select_label.text = "%s · %s\n▶ %s%s" % [head, mk.name, mk.text, near_txt]
	_track_button.disabled = kind == "wq_open" or is_tracked_kind(kind)
	_track_button.text = "맡은 뒤 따라갈 수 있다" if kind == "wq_open" else ("따라가는 중" if is_tracked_kind(kind) else "따라가기")
	_warp_button.text = "가까운 지점으로 순간이동"
	_warp_button.disabled = near == ""

## 표식 자리에서 가장 가까운 켠 순간이동 지점 id — 없으면 "".
func nearest_active_point(world: Vector3) -> String:
	if _wps == null:
		return ""
	var best := ""
	var best_d := INF
	for row in Waypoints.POINTS:
		if not Waypoints.is_active(row[0]):
			continue
		var d := _flat_dist(_wps.call("world_pos_of", row[0]), world)
		if d < best_d:
			best_d = d
			best = row[0]
	return best

static func _flat_dist(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()

## 고른 표식의 임무를 따라간다(story_quest.set_track) — 지도는 열어 둔 채 글자만 새로.
func track_selected() -> bool:
	if _selected_mark.is_empty():
		return false
	var kind := String(_selected_mark.kind)
	if kind == "wq_open" or is_tracked_kind(kind):
		return false
	var story := get_tree().get_first_node_in_group("go_story")
	if story == null or not story.call("set_track", String(_selected_mark.quest)):
		return false
	var q := String(_selected_mark.quest)
	var want := "story" if q == "" else "wq_track"
	if not select_mark(want, q):
		_selected_mark = {}
		_refresh_screen()
	return true

func warp_selected() -> bool:
	if not _selected_mark.is_empty():
		var near := nearest_active_point(_selected_mark.pos)
		if near == "":
			return false
		_selected = near
		_selected_mark = {}
	if _wps == null or _selected == "" or not Waypoints.is_active(_selected):
		return false
	var ok: bool = _wps.call("teleport", _selected)
	if ok:
		close_map()
	return ok

func open_map() -> void:
	if is_open or _player == null:
		return
	if get_tree().get_nodes_in_group("duel_active").size() > 0:
		return
	## 비경 안에선 지도(순간이동)를 안 연다(106장 ⑳ — 원신도 그렇다).
	if get_tree().get_nodes_in_group("go_domain_active").size() > 0:
		return
	## 다른 화면(인물·요리)이 열려 있으면 안 연다 — frozen 되돌림이 엇갈린다.
	for g in ["go_character_screen", "go_cooking_screen"]:
		var other := get_tree().get_first_node_in_group(g)
		if other and other.get("is_open"):
			return
	is_open = true
	_screen.visible = true
	_mini.visible = false
	_mini_overlay.visible = false
	add_to_group("ui_modal")
	_frozen_before = bool(_player.get("frozen"))
	_player.set("frozen", true)
	_view.center_on(_player.global_position)
	_selected = ""
	_selected_mark = {}
	_refresh_screen()

func close_map() -> void:
	if not is_open:
		return
	is_open = false
	_screen.visible = false
	_mini.visible = true
	_mini_overlay.visible = true
	remove_from_group("ui_modal")
	if _player:
		_player.set("frozen", _frozen_before)
