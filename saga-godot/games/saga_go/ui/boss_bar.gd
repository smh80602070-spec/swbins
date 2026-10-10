extends CanvasLayer

## G-0161 — 보스전 화면 위 보스 바(원신식). 머리 위 3D 이름표(field_enemy.gd)는 가로 창에서 약 5px 라 안 읽혔다.
## 보스(combat/field_boss.gd — 들판 보스·주간 보스·이야기 결투 보스, 그룹 "go_boss")에서 ENGAGE_M 안이면
## 위 가운데에 "이름 · Lv" + 체력 바, 2단계면 방패 바·"2단계". 멀어지거나 쓰러지면 숨긴다.
## 고르기는 PICK_SEC 마다만(매 프레임 그룹 순회 안 함), 고른 보스의 값만 매 프레임 읽는다.
## test_village.gd 가 단다.

const Adventure := preload("res://games/saga_go/data/adventure.gd")

const ENGAGE_M := 20.0
const PICK_SEC := 0.25
const WIDTH := 760.0
const TOP := 150.0   # 기준 1920×1280 — 지역 이름 배너(90~150) 아래, 알림 띠(약 240~) 위 — 전체 높이 약 70
const NAME_FONT := 26

var _boss: Node3D = null
var _pick_t := 0.0
var _root: Control
var _name: Label
var _hp: ProgressBar
var _shield: ProgressBar


func _ready() -> void:
	layer = 4
	_root = Control.new()
	_root.anchor_left = 0.5
	_root.anchor_right = 0.5
	_root.offset_left = -WIDTH * 0.5
	_root.offset_right = WIDTH * 0.5
	_root.offset_top = TOP
	_root.offset_bottom = TOP + 80.0
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.visible = false
	add_child(_root)

	_name = Label.new()
	_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_name.anchor_right = 1.0
	_name.offset_bottom = NAME_FONT * 1.4
	_name.add_theme_font_size_override("font_size", NAME_FONT)
	_name.add_theme_color_override("font_color", Color(1.0, 0.9, 0.7))
	_name.add_theme_color_override("font_outline_color", Color(0, 0, 0, 1))
	_name.add_theme_constant_override("outline_size", 3)
	var band := StyleBoxFlat.new()   # G-0157 HUD 띠와 같은 결
	band.bg_color = Color(0, 0, 0, 0.38)
	band.set_corner_radius_all(8)
	_name.add_theme_stylebox_override("normal", band)
	_name.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_name)

	_hp = _bar(Color(0.86, 0.22, 0.2), NAME_FONT * 1.4 + 4.0, 16.0)
	_shield = _bar(Color(0.55, 0.85, 1.0), NAME_FONT * 1.4 + 23.0, 8.0)


func _bar(color: Color, y: float, h: float) -> ProgressBar:
	var bar := ProgressBar.new()
	bar.anchor_right = 1.0
	bar.offset_top = y
	bar.offset_bottom = y + h
	bar.show_percentage = false
	bar.max_value = 1.0
	bar.step = 0.0
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0, 0, 0, 0.55)
	bg.border_color = Color(0.85, 0.7, 0.4, 0.8)
	bg.set_border_width_all(1)
	bg.set_corner_radius_all(4)
	var fill := StyleBoxFlat.new()
	fill.bg_color = color
	fill.set_corner_radius_all(4)
	bar.add_theme_stylebox_override("background", bg)
	bar.add_theme_stylebox_override("fill", fill)
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(bar)
	return bar


func _process(delta: float) -> void:
	_pick_t -= delta
	if _pick_t <= 0.0:
		_pick_t = PICK_SEC
		_boss = _pick()
	if _boss == null or not is_instance_valid(_boss) or bool(_boss.call("is_dead")):
		_root.visible = false
		return
	_root.visible = true
	var lv := ""
	var wl := int(_boss.get("world_lv")) if _boss.get("world_lv") != null else -1   # 비경 보스는 -1(Lv 표시 없음)
	if wl >= 0:
		lv = " · Lv.%d" % Adventure.enemy_level(wl)
	var phase := int(_boss.get("phase"))
	_name.text = "%s%s%s" % [String((_boss.get("def") as Dictionary).get("name", "")), lv, "  — 2단계" if phase >= 2 else ""]
	_hp.value = clampf(float(_boss.get("hp")) / maxf(float(_boss.get("max_hp")), 1.0), 0.0, 1.0)
	var sh := float(_boss.get("shield"))
	var sh_max := float(_boss.get("max_shield")) if _boss.get("max_shield") != null else 0.0
	_shield.visible = sh > 0.0 and sh_max > 0.0
	if _shield.visible:
		_shield.value = clampf(sh / sh_max, 0.0, 1.0)


func _pick() -> Node3D:
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if player == null:
		return null
	var best: Node3D = null
	var best_d := ENGAGE_M
	for b in get_tree().get_nodes_in_group("go_boss"):
		var n := b as Node3D
		if n == null or not n.is_inside_tree() or bool(n.call("is_dead")):
			continue
		var d := n.global_position.distance_to(player.global_position)
		if d < best_d:
			best_d = d
			best = n
	return best
