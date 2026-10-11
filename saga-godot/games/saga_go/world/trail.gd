extends Node3D

## G-0195 — 1만리 사냥 의뢰 루프 화면 쪽(규칙은 data/trail.gd). 웹 W-0101 의 고돗 짝.
##   흔적: 네 지역 들판에 작은 표식(흙빛 원판 + 종류 색 꼭지) — 모두 한 MultiMesh(그리기 1). 읽은 것은 크기 0 으로 숨긴다.
##   읽기: 3m 안에서 F(go_domain, 들판 보스 보상 꽃과 같은 키 — 둘 다 거리로 갈라 받는다) 또는 화면 단추 "🐾 흔적 읽기".
##   같은 날 셋 → 그 지역 들판 보스가 "오늘의 큰 짐승": 미니맵(world_map quest_marks 의 trail_track — 멀면 가장자리에 붙음)·목표판 "지금" 줄.
##   쓰러뜨리면(world/field_bosses.gd boss_died) 부위 수만큼 광석. 0.2초마다 가까운 흔적을 본다(매 틱 셈 금지).

const Trail := preload("res://games/saga_go/data/trail.gd")
const FB := preload("res://games/saga_go/data/field_bosses.gd")
const FieldBossesWorld := preload("res://games/saga_go/world/field_bosses.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const Commissions := preload("res://games/saga_go/data/commissions.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

signal changed

const TICK_SEC := 0.2

var cells: Array = []        # Trail.all_cells()
var near_key := ""
var _near_idx := -1
var _mm: MultiMesh
var _btn: Button
var _player: Node3D
var _acc := 0.0


func _ready() -> void:
	name = "Trail"
	add_to_group("go_trail")
	if not InputMap.has_action("go_domain"):
		InputMap.add_action("go_domain")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_F
		InputMap.action_add_event("go_domain", ev)
	cells = Trail.all_cells()
	_build_marks()
	_build_button()
	var fb := get_tree().get_first_node_in_group("go_field_bosses")
	if fb != null and fb.has_signal("boss_died"):
		fb.connect("boss_died", _on_boss_died)
	_refresh_hidden()


func state() -> Dictionary:
	Trail.ensure_day(PartyState.trail, Commissions.today())
	return PartyState.trail


func _build_marks() -> void:
	var cm := CylinderMesh.new()
	cm.top_radius = 0.55
	cm.bottom_radius = 0.6
	cm.height = 0.08
	cm.radial_segments = 10
	cm.rings = 1
	_mm = MultiMesh.new()
	_mm.transform_format = MultiMesh.TRANSFORM_3D
	_mm.use_colors = true
	_mm.mesh = cm
	_mm.instance_count = cells.size()
	for i in cells.size():
		var c: Dictionary = cells[i]
		_mm.set_instance_transform(i, Transform3D(Basis.IDENTITY, (c.pos as Vector3) + Vector3(0, 0.06, 0)))
		_mm.set_instance_color(i, Trail.KIND_COL[Trail.KINDS.find(String(c.kind))])
	var mmi := MultiMeshInstance3D.new()
	mmi.name = "TrailMarks"
	mmi.multimesh = _mm
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.emission_enabled = true
	m.emission = Color(0.25, 0.18, 0.08)
	mmi.material_override = m
	mmi.visibility_range_end = 120.0   # 흔적은 가까이 와야 보인다(멀리서 들판이 점투성이가 되지 않게)
	add_child(mmi)


func _build_button() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 5
	add_child(layer)
	_btn = Button.new()
	_btn.text = "🐾 흔적 읽기 (F)"
	_btn.anchor_left = 0.5
	_btn.anchor_right = 0.5
	_btn.anchor_top = 1.0
	_btn.anchor_bottom = 1.0
	_btn.offset_left = -90
	_btn.offset_right = 90
	_btn.offset_top = -224
	_btn.offset_bottom = -178
	_btn.visible = false
	_btn.pressed.connect(read_near)
	layer.add_child(_btn)


func _refresh_hidden() -> void:
	var rd: Array = state().get("read", [])
	for i in cells.size():
		var c: Dictionary = cells[i]
		var t := Transform3D(Basis.IDENTITY, (c.pos as Vector3) + Vector3(0, 0.06, 0))
		if rd.has(String(c.key)):
			t = t.scaled_local(Vector3.ONE * 0.001)
		_mm.set_instance_transform(i, t)


func _physics_process(delta: float) -> void:
	_acc += delta
	if _acc < TICK_SEC:
		return
	_acc = 0.0
	tick()


## 한 번 셈 — 가까운 안 읽은 흔적(점검도 부른다)
func tick() -> void:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player")
		if _player == null:
			return
	var rd: Array = state().get("read", [])
	near_key = ""
	_near_idx = -1
	var best := Trail.READ_M
	var pp := _player.global_position
	for i in cells.size():
		var c: Dictionary = cells[i]
		var p: Vector3 = c.pos
		var d := Vector2(p.x - pp.x, p.z - pp.z).length()
		if d <= best and not rd.has(String(c.key)):
			best = d
			near_key = String(c.key)
			_near_idx = i
	_btn.visible = near_key != "" and not _modal_open()


func _modal_open() -> bool:
	for n in get_tree().get_nodes_in_group("ui_modal"):
		if n.get("visible") != false:
			return true
	return false


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("go_domain") and near_key != "":
		read_near()
		get_viewport().set_input_as_handled()


func read_near() -> void:
	if _near_idx < 0:
		return
	var c: Dictionary = cells[_near_idx]
	var r := Trail.read(PartyState.trail, Commissions.today(), String(c.key), String(c.region))
	if not bool(r.ok):
		return
	var boss := String(r.boss)
	if boss != "":
		Toast.show(self, "🐾 흔적이 이어진다 — 오늘의 큰 짐승: %s (미니맵)" % _boss_name(boss), 3.5)
	else:
		Toast.show(self, "🐾 %s — 흔적 %d/%d" % [String(c.kind), int(r.count), Trail.NEED], 2.0)
	_refresh_hidden()
	near_key = ""
	_near_idx = -1
	changed.emit()


static func _boss_name(id: String) -> String:
	return String(FieldEnemy.KINDS[FB.BOSSES[id].kind].name)


## 오늘 쫓는 큰 짐승(없으면 "")
func hunted() -> String:
	var st := state()
	return "" if bool(st.get("done", false)) else String(st.get("boss", ""))


## 목표판 "지금" 줄 — 쫓는 중이면 "🐾 큰 짐승을 쫓는다 — 이름 · n m", 읽는 중이면 "🐾 흔적 n/3", 아니면 ""
func now_line() -> String:
	var b := hunted()
	if b != "":
		var d := 0.0
		if _player != null:
			var hp := FieldBossesWorld.home_of(b)
			d = Vector2(hp.x - _player.global_position.x, hp.z - _player.global_position.z).length()
		return "🐾 큰 짐승을 쫓는다 — %s · %dm" % [_boss_name(b), int(d)]
	var n := (state().get("read", []) as Array).size()
	if n > 0 and not bool(state().get("done", false)):
		return "🐾 흔적 %d/%d" % [n, Trail.NEED]
	return ""


## 미니맵 표식(world_map quest_marks 가 읽는다) — 쫓는 큰 짐승 자리 하나
func map_marks() -> Array:
	var b := hunted()
	if b == "":
		return []
	return [{"pos": FieldBossesWorld.home_of(b), "kind": "trail_track"}]


func _on_boss_died(id: String, e: Node) -> void:
	var reached2: bool = e != null and int(e.get("phase")) >= 2
	var broken: bool = reached2 and e != null and float(e.get("shield")) <= 0.0
	var items := Trail.on_kill(PartyState.trail, Commissions.today(), id, Trail.parts_of(reached2, broken))
	if items.is_empty():
		return
	PartyState.add_items(items)
	Toast.show(self, "🐾 큰 짐승 사냥 끝 — 부위 %d · 작은 광석 %d · 중간 광석 %d (무기 벼림 재료)" % [int(items.ore_s) / Trail.ORE_PER_PART, int(items.ore_s), int(items.ore_m)], 4.0)
	changed.emit()
