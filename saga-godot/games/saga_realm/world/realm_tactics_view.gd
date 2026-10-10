extends Node3D

## G-0183 — 사가천하 전술판 3D(파이어 엠블렘 풍화설월 3D, 웹 tactics-view3d.js 의 고돗 짝). 출진 상자에서 "♟ 전술판"을 고르면 열린다.
## 규칙은 games/saga_realm/data/realm_tactics.gd(G-0182) 하나 — 이 노드는 판을 그리고, 고른 칸을 그 함수에 넘기고, 바뀐 것을 연출할 뿐이다(판정 두 벌 금지).
## 적 차례·맡기기는 "규칙을 먼저 돌리고 → 전후 차이(자리·기록)를 한 동작씩 연출"한다 — 연출이 규칙을 앞서거나 바꾸지 않는다.
##
##   판      성 화면과 떨어진 자리(ORIGIN)에 칸 8×6(칸 2m) — 평지 모래빛·숲 짙은 초록+원뿔 나무·강 파랑(낮음)·성벽 회색(높음), 웹과 같은 색
##   카메라  판 남쪽 위 3/4(pitch 50°), 장수를 고르면 0.3초 당김 · 닫으면 성 화면 카메라로 돌아간다
##   유닛    장수 = 그 인물 몸(VroidBody) · 부대 = 무리 몸 0.7배 + 깃발 · 발밑 편 색 원판 · 머리 위 이름·hp
##   조작    칸 클릭/터치 · 키보드·패드 = 방향(ui_*)으로 커서, 결정(ui_accept)·취소(ui_cancel) · 단추 "턴 끝"·"맡기기"·"물러나기"
##   끝      결과 넷(대승·승·무승부·패)을 띄우고 1.4초 뒤 닫으며 done(apply 보정값)을 부른다. 물러나기(Esc)면 done({}) — 보정 없이 그냥 출진.

const RealmTactics := preload("res://games/saga_realm/data/realm_tactics.gd")
const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const ORIGIN := Vector3(3000.0, 0.0, 0.0)   # 성 화면(원점 둘레)과 겹치지 않는 자리
const CELL := 2.0
const TOP := {"plain": 0.2, "forest": 0.2, "river": -0.05, "wall": 1.0}   # 칸 윗면 높이
const COL := {"plain": Color("c8b47a"), "forest": Color("5f8446"), "river": Color("4f86b3"), "wall": Color("857563")}
const HI_MOVE := Color(0.5, 0.82, 1.0, 0.42)
const HI_ATTACK := Color(1.0, 0.36, 0.3, 0.5)
const HI_SEL := Color(1.0, 0.88, 0.54, 0.85)
const HI_CURSOR := Color(1.0, 1.0, 1.0, 0.5)
const SIDE_COL := {"me": Color(0.35, 0.62, 1.0), "foe": Color(0.95, 0.35, 0.3)}
const CAM_PITCH := 50.0
const CAM_DIST := 17.0
const CAM_NEAR := 12.0
const STEP_SEC := 0.25   # 칸 하나 걷기
const SWING_SEC := 0.4
const END_SEC := 1.4

var board: Dictionary = {}
var enemy_id := ""
var instant := false   # 점검용 — 연출 기다림을 건너뛴다
var _done_cb: Callable
var _units := {}   # uid -> {node, label, ap}
var _hi := {}      # "x,y" -> MeshInstance3D(칸 위 얇은 판)
var _cam: Camera3D
var _prev_cam: Camera3D
var _hud_hidden: Array = []
var _paused_cams: Array = []   # 성 카메라(realm_camera.gd)는 매 프레임 current 를 다시 잡는다 — 판이 열린 동안 멈춘다
var _ui: CanvasLayer
var _title: Label
var _hint: Label
var _buttons: Array = []
var _sel := ""
var _cursor := Vector2i(1, 1)
var _busy := false
var _closed := false
var _foe_turn := false   # 제목 "적 차례" 표시용(규칙의 board.side 와 따로)


## 연다 — host 는 씬 안 아무 노드(토스트·트리 찾기용), tb = RealmSaveState.tactics_board() 결과, done(grid: Dictionary).
static func open(host: Node, p_enemy_id: String, tb: Dictionary, done: Callable, p_instant := false) -> Node3D:
	var v: Node3D = load("res://games/saga_realm/world/realm_tactics_view.gd").new()
	v.name = "TacticsView"
	v.board = tb.board
	v.enemy_id = p_enemy_id
	v._done_cb = done
	v.instant = p_instant
	v.set_meta("mine", tb.get("mine", []))
	var scene := host.get_tree().current_scene if host.get_tree().current_scene != null else host.get_tree().root
	scene.add_child(v)
	return v


## 화면 좌표 광선 → 칸 (x, y). 판 밖·위를 보는 광선이면 (-1, -1). 순수 함수(점검 대상)
static func ray_to_cell(ray_origin: Vector3, ray_dir: Vector3, center: Vector3, top_y: float = 0.2) -> Vector2i:
	if ray_dir.y >= -0.0001:
		return Vector2i(-1, -1)
	var t := (top_y - ray_origin.y) / ray_dir.y
	var p := ray_origin + ray_dir * t
	var x := int(floor((p.x - center.x) / CELL + RealmTactics.COLS * 0.5))
	var y := int(floor((p.z - center.z) / CELL + RealmTactics.ROWS * 0.5))
	if x < 0 or y < 0 or x >= RealmTactics.COLS or y >= RealmTactics.ROWS:
		return Vector2i(-1, -1)
	return Vector2i(x, y)


static func cell_center(x: int, y: int) -> Vector3:
	return ORIGIN + Vector3((float(x) - RealmTactics.COLS * 0.5 + 0.5) * CELL, 0.0, (float(y) - RealmTactics.ROWS * 0.5 + 0.5) * CELL)


func _ready() -> void:
	add_to_group("ui_modal")   # 이야기 카드(scenario_runner)·다른 창이 판 위로 안 뜨게
	_build_ground()
	_build_cells()
	_build_units()
	_build_camera()
	_build_ui()
	_hide_hud(true)
	_refresh()


# ── 짓기 ──────────────────────────────────────────

func _mat(c: Color, unshaded := false) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	if c.a < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.no_depth_test = false
	if unshaded:
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	return m


func _box(size: Vector3, pos: Vector3, c: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = _mat(c)
	mi.position = pos
	add_child(mi)
	return mi


func _build_ground() -> void:
	var field := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(80, 80)
	field.mesh = pm
	field.material_override = _mat(Color("5d6b42"))
	field.position = ORIGIN + Vector3(0, -0.3, 0)
	add_child(field)
	_box(Vector3(RealmTactics.COLS * CELL + 0.6, 0.5, RealmTactics.ROWS * CELL + 0.6), ORIGIN + Vector3(0, -0.2, 0), Color("3b3326"))   # 판 테두리(웹 frame)


func _build_cells() -> void:
	var trunk := _mat(Color("5a4127"))
	var leaf := _mat(Color("2f5a2c"))
	for y in RealmTactics.ROWS:
		for x in RealmTactics.COLS:
			var t := RealmTactics.cell_at(board, x, y)
			var top: float = TOP.get(t, 0.2)
			var c := cell_center(x, y)
			var h := top + 0.25
			_box(Vector3(CELL - 0.06, h, CELL - 0.06), c + Vector3(0, top - h * 0.5, 0), COL.get(t, COL.plain))
			if t == "forest":   # 원뿔 나무 둘(코드 도형)
				for k in 2:
					var off := Vector3(-0.45 + 0.9 * k, 0, -0.35 + 0.7 * ((x + y + k) % 2))
					var tr := MeshInstance3D.new()
					var cy := CylinderMesh.new()
					cy.top_radius = 0.08
					cy.bottom_radius = 0.1
					cy.height = 0.5
					tr.mesh = cy
					tr.material_override = trunk
					tr.position = c + off + Vector3(0, top + 0.25, 0)
					add_child(tr)
					var cone := MeshInstance3D.new()
					var cm := CylinderMesh.new()
					cm.top_radius = 0.0
					cm.bottom_radius = 0.42
					cm.height = 1.3
					cone.mesh = cm
					cone.material_override = leaf
					cone.position = c + off + Vector3(0, top + 1.1, 0)
					add_child(cone)
			var hi := MeshInstance3D.new()
			var hp := PlaneMesh.new()
			hp.size = Vector2(CELL - 0.2, CELL - 0.2)
			hi.mesh = hp
			hi.position = c + Vector3(0, top + 0.03, 0)
			hi.visible = false
			add_child(hi)
			_hi["%d,%d" % [x, y]] = hi


func _unit_name(u: Dictionary) -> String:
	if String(u.kind) == "troop":
		return "부대"
	var h = Characters.find(String(u.id))
	return String(h.name) if h != null else String(u.id)


func _build_units() -> void:
	for u: Dictionary in board.units:
		var root := Node3D.new()
		root.name = String(u.uid).replace(":", "_")
		add_child(root)
		var body: Node3D
		if String(u.kind) == "officer":
			body = VroidBody.build(String(u.id), 3)
		else:
			body = VroidBody.build_pool(VroidBody.BANDIT_POOL, String(u.uid), 2)
			body.scale *= 0.7
			var pole := _box(Vector3(0.05, 1.6, 0.05), Vector3.ZERO, Color(0.35, 0.25, 0.15))
			remove_child(pole)
			root.add_child(pole)
			pole.position = Vector3(-0.45, 0.8, 0)
			var flag := _box(Vector3(0.02, 0.4, 0.55), Vector3.ZERO, SIDE_COL[u.side])
			remove_child(flag)
			root.add_child(flag)
			flag.position = Vector3(-0.45, 1.4, 0.28)
		root.add_child(body)
		var disc := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.7
		cm.bottom_radius = 0.7
		cm.height = 0.04
		disc.mesh = cm
		disc.material_override = _mat(Color(SIDE_COL[u.side], 0.55), true)
		disc.position = Vector3(0, 0.03, 0)
		root.add_child(disc)
		var label := Label3D.new()
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.no_depth_test = true
		label.fixed_size = true
		label.pixel_size = 0.0011
		label.font_size = 24
		label.outline_size = 7
		label.modulate = SIDE_COL[u.side].lightened(0.35)
		label.position = Vector3(0, 2.15 if String(u.kind) == "officer" else 1.75, 0)
		root.add_child(label)
		var aps := body.find_children("*", "AnimationPlayer", true, false)
		_units[String(u.uid)] = {"node": root, "label": label, "ap": aps[0] if not aps.is_empty() else null, "hp": float(u.hp)}
		_place(String(u.uid), int(u.x), int(u.y))
		_face(String(u.uid), Vector3(1, 0, 0) if u.side == "me" else Vector3(-1, 0, 0))
		_set_label(String(u.uid))


func _build_camera() -> void:
	_prev_cam = get_viewport().get_camera_3d()
	var scene := get_tree().current_scene
	if scene != null:
		for c in scene.find_children("*", "Camera3D", true, false):
			if c.is_processing():
				c.set_process(false)
				_paused_cams.append(c)
	_cam = Camera3D.new()
	_cam.fov = 50.0
	add_child(_cam)
	_aim_camera(ORIGIN, CAM_DIST)
	_cam.current = true


func _aim_camera(focus: Vector3, dist: float) -> void:
	var p := deg_to_rad(CAM_PITCH)
	_cam.position = focus + Vector3(0, sin(p) * dist, cos(p) * dist)
	_cam.look_at(focus, Vector3.UP)


func _build_ui() -> void:
	_ui = CanvasLayer.new()
	_ui.layer = 20
	add_child(_ui)
	var top := PanelContainer.new()
	top.anchor_left = 0.0
	top.anchor_right = 1.0
	top.offset_left = 16
	top.offset_right = -16
	top.offset_top = 12
	_ui.add_child(top)
	var col := VBoxContainer.new()
	top.add_child(col)
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 26)
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(_title)
	_hint = Label.new()
	_hint.add_theme_font_size_override("font_size", 20)
	_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(_hint)
	var row := HBoxContainer.new()
	row.anchor_left = 0.0
	row.anchor_right = 1.0
	row.anchor_top = 1.0
	row.anchor_bottom = 1.0
	row.offset_top = -84
	row.offset_bottom = -16
	row.offset_left = 16
	row.offset_right = -16
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 16)
	_ui.add_child(row)
	for spec: Array in [["⏭ 턴 끝", _on_end_turn], ["🤖 맡기기", _on_auto], ["↩ 물러나기", _on_cancel]]:
		var b := Button.new()
		b.text = spec[0]
		b.custom_minimum_size = Vector2(190, 64)
		b.add_theme_font_size_override("font_size", 24)
		b.pressed.connect(spec[1])
		row.add_child(b)
		_buttons.append(b)


func _hide_hud(hide: bool) -> void:
	if hide:
		var scene := get_tree().current_scene
		if scene != null:
			for c in scene.get_children():
				if c is CanvasLayer and c != _ui and (c as CanvasLayer).visible:
					(c as CanvasLayer).visible = false
					_hud_hidden.append(c)
	else:
		for c in _hud_hidden:
			if is_instance_valid(c):
				(c as CanvasLayer).visible = true
		_hud_hidden.clear()


# ── 그리기 갱신 ──────────────────────────────────────

func _place(uid: String, x: int, y: int) -> void:
	var t := RealmTactics.cell_at(board, x, y)
	(_units[uid].node as Node3D).position = cell_center(x, y) + Vector3(0, TOP.get(t, 0.2), 0)


func _face(uid: String, dir: Vector3) -> void:
	if dir.length() < 0.001:
		return
	(_units[uid].node as Node3D).rotation.y = atan2(dir.x, dir.z)


func _set_label(uid: String) -> void:
	var u := RealmTactics.unit(board, uid)
	var shown: float = _units[uid].hp
	(_units[uid].label as Label3D).text = "%s
%d/%d" % [_unit_name(u), int(ceil(shown)), int(u.max)]
	(_units[uid].label as Label3D).visible = shown > 0.0


func _play(uid: String, clip: String) -> void:
	var ap: AnimationPlayer = _units[uid].ap
	if ap != null and ap.has_animation(clip):
		ap.play(clip)


func _wait(sec: float) -> void:
	if instant or sec <= 0.0:
		return
	await get_tree().create_timer(sec).timeout


func _clear_hi() -> void:
	for k in _hi:
		(_hi[k] as MeshInstance3D).visible = false


func _show_hi(x: int, y: int, c: Color) -> void:
	var mi: MeshInstance3D = _hi.get("%d,%d" % [x, y])
	if mi == null:
		return
	mi.material_override = _mat(c, true)
	mi.visible = true


func _targets_of(uid: String) -> Array:
	var u := RealmTactics.unit(board, uid)
	var out: Array = []
	if u.is_empty() or bool(u.acted):
		return out
	for t: Dictionary in RealmTactics.alive(board, "foe"):
		if RealmTactics.in_range(u, t):
			out.append(t)
	return out


func _refresh() -> void:
	_clear_hi()
	var turn := mini(int(board.turn), RealmTactics.TURNS)
	_title.text = "♟ 전술판 — %d/%d턴 · %s" % [turn, RealmTactics.TURNS, "적 차례" if _foe_turn else "내 차례"]
	if _sel != "":
		var u := RealmTactics.unit(board, _sel)
		_show_hi(int(u.x), int(u.y), HI_SEL)
		if not bool(u.moved):
			for c: Dictionary in RealmTactics.moves(board, _sel):
				if int(c.x) != int(u.x) or int(c.y) != int(u.y):
					_show_hi(int(c.x), int(c.y), HI_MOVE)
		var tips: Array = []
		for t: Dictionary in _targets_of(_sel):
			_show_hi(int(t.x), int(t.y), HI_ATTACK)
			tips.append("%s %d%%" % [_unit_name(t), RealmTactics.hit_chance(u, t, RealmTactics.cover_at(board, int(t.x), int(t.y)))])
		_hint.text = "%s — 파란 칸으로 옮기고 붉은 칸을 친다%s" % [_unit_name(u), ("  (명중 " + " · ".join(tips) + ")") if not tips.is_empty() else ""]
	else:
		_hint.text = "내 장수를 고르세요 · 숲은 명중 −30% · 성벽은 −50% · 3턴 안에 적을 무너뜨리면 대승"
	var cur := _hi.get("%d,%d" % [_cursor.x, _cursor.y]) as MeshInstance3D
	if cur != null and not cur.visible:
		_show_hi(_cursor.x, _cursor.y, HI_CURSOR)
	for b: Button in _buttons:
		b.disabled = _busy


# ── 입력 ────────────────────────────────────────────

func _unhandled_input(event: InputEvent) -> void:
	if _closed or _busy:
		return
	var press_pos := Vector2(-1, -1)
	if event is InputEventMouseButton and (event as InputEventMouseButton).pressed and (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
		press_pos = (event as InputEventMouseButton).position
	elif event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed:
		press_pos = (event as InputEventScreenTouch).position
	if press_pos.x >= 0.0:
		var cell := ray_to_cell(_cam.project_ray_origin(press_pos), _cam.project_ray_normal(press_pos), ORIGIN)
		if cell.x >= 0:
			_cursor = cell
			get_viewport().set_input_as_handled()
			pick_cell(cell.x, cell.y)
		return
	var d := Vector2i.ZERO
	if event.is_action_pressed("ui_left"):
		d = Vector2i(-1, 0)
	elif event.is_action_pressed("ui_right"):
		d = Vector2i(1, 0)
	elif event.is_action_pressed("ui_up"):
		d = Vector2i(0, -1)
	elif event.is_action_pressed("ui_down"):
		d = Vector2i(0, 1)
	if d != Vector2i.ZERO:
		_cursor = Vector2i(clampi(_cursor.x + d.x, 0, RealmTactics.COLS - 1), clampi(_cursor.y + d.y, 0, RealmTactics.ROWS - 1))
		get_viewport().set_input_as_handled()
		_refresh()
	elif event.is_action_pressed("ui_accept"):
		get_viewport().set_input_as_handled()
		pick_cell(_cursor.x, _cursor.y)
	elif event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		if _sel != "":
			_sel = ""
			_refresh()
		else:
			_on_cancel()


func _unit_at(x: int, y: int) -> Dictionary:
	for u: Dictionary in board.units:
		if float(u.hp) > 0.0 and int(u.x) == x and int(u.y) == y:
			return u
	return {}


## 칸 하나를 골랐다 — 내 장수 고르기 / 고른 장수 옮기기 / 적 치기 / 풀기. 점검·촬영도 이걸 부른다.
func pick_cell(x: int, y: int) -> void:
	if _busy or _closed or board.side != "me" or String(board.done) != "":
		return
	var there := _unit_at(x, y)
	if _sel == "":
		if not there.is_empty() and there.side == "me" and not bool(there.acted):
			_select(String(there.uid))
		return
	var u := RealmTactics.unit(board, _sel)
	if not there.is_empty() and there.side == "foe" and _targets_of(_sel).has(there):
		await _do_attack(_sel, String(there.uid))
		_sel = ""
	elif not there.is_empty() and there.side == "me":
		if String(there.uid) == _sel:
			_sel = ""
		elif not bool(there.acted):
			_select(String(there.uid))
			return
	elif there.is_empty() and not bool(u.moved):
		var from := Vector2i(int(u.x), int(u.y))
		if RealmTactics.move(board, _sel, x, y):
			await _anim_move(_sel, from, Vector2i(x, y))
			if _targets_of(_sel).is_empty():
				_sel = ""
	else:
		_sel = ""
	_refresh()
	_after_action()


func _select(uid: String) -> void:
	_sel = uid
	var n: Node3D = _units[uid].node
	if not instant:
		var tw := create_tween()
		tw.tween_method(func(k: float) -> void: _aim_camera(ORIGIN.lerp(n.position, 0.35 * k), lerpf(CAM_DIST, CAM_NEAR, k)), 0.0, 1.0, 0.3)
	_refresh()


# ── 연출 ────────────────────────────────────────────

func _anim_move(uid: String, from: Vector2i, to: Vector2i) -> void:
	if from == to:
		return
	var n: Node3D = _units[uid].node
	var dest := cell_center(to.x, to.y) + Vector3(0, TOP.get(RealmTactics.cell_at(board, to.x, to.y), 0.2), 0)
	_face(uid, dest - n.position)
	if instant:
		n.position = dest
		return
	_play(uid, "walk")
	var steps := absi(to.x - from.x) + absi(to.y - from.y)
	var tw := create_tween()
	tw.tween_property(n, "position", dest, STEP_SEC * float(steps))
	await tw.finished
	_play(uid, "idle")


func _float_text(at: Vector3, text: String, c: Color) -> void:
	if instant:
		return
	var l := Label3D.new()
	l.text = text
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.fixed_size = true
	l.pixel_size = 0.0022
	l.font_size = 34
	l.outline_size = 10
	l.modulate = c
	l.position = at + Vector3(0, 2.6, 0)
	add_child(l)
	var tw := create_tween()
	tw.tween_property(l, "position:y", l.position.y + 0.9, 0.8)
	tw.parallel().tween_property(l, "modulate:a", 0.0, 0.8)
	tw.tween_callback(l.queue_free)


func _anim_hit(entry: Dictionary) -> void:
	var a := String(entry.a)
	var t := String(entry.to)
	var an: Node3D = _units[a].node
	var tn: Node3D = _units[t].node
	_face(a, tn.position - an.position)
	_play(a, "attack")
	await _wait(SWING_SEC * 0.6)
	if bool(entry.hit):
		_units[t].hp = maxf(0.0, float(_units[t].hp) - float(entry.dmg))
		_float_text(tn.position, "-%d" % int(entry.dmg), Color(1, 0.85, 0.4))
		if not instant:
			var base := tn.position
			var tw := create_tween()
			for k in 3:
				tw.tween_property(tn, "position", base + Vector3(0.12 * (1 - 2 * (k % 2)), 0, 0), 0.04)
			tw.tween_property(tn, "position", base, 0.04)
	else:
		_float_text(tn.position, "빗나감", Color(0.8, 0.85, 0.9))
	_set_label(t)
	await _wait(SWING_SEC * 0.4)
	_play(a, "idle")
	if float(_units[t].hp) <= 0.0:
		_play(t, "death")
		var ap: AnimationPlayer = _units[t].ap
		if not instant and (ap == null or not ap.has_animation("death")):
			tn.rotation.x = -PI * 0.5   # 쓰러짐 클립이 없으면 눕힌다
		await _wait(0.5)
		if not instant:
			var tw2 := create_tween()
			tw2.tween_property(tn, "scale", Vector3.ONE * 0.01, 0.35)
			await tw2.finished
		tn.visible = false


func _do_attack(uid: String, tuid: String) -> void:
	_busy = true
	_refresh()
	var n0 := (board.log as Array).size()
	var r: Dictionary = RealmTactics.attack(board, uid, tuid)
	if bool(r.get("ok", false)):
		for i in range(n0, (board.log as Array).size()):
			await _anim_hit(board.log[i])
	_busy = false


## 규칙을 이미 돌린 뒤 — 전 상태(snap)와 지금 판의 차이를 차례대로 연출(유닛마다 옮김 → 그 유닛의 공격)
func _play_diff(snap: Dictionary, log0: int) -> void:
	var moved := {}
	var logs: Array = (board.log as Array).slice(log0)
	for e: Dictionary in logs:
		var a := String(e.a)
		if not moved.has(a):
			moved[a] = true
			var u := RealmTactics.unit(board, a)
			await _anim_move(a, snap[a], Vector2i(int(u.x), int(u.y)))
		await _anim_hit(e)
	for u: Dictionary in board.units:
		var uid := String(u.uid)
		if not moved.has(uid) and snap.has(uid) and snap[uid] != Vector2i(int(u.x), int(u.y)):
			await _anim_move(uid, snap[uid], Vector2i(int(u.x), int(u.y)))


func _snap() -> Dictionary:
	var s := {}
	for u: Dictionary in board.units:
		s[String(u.uid)] = Vector2i(int(u.x), int(u.y))
	return s


func _on_end_turn() -> void:
	if _busy or _closed or String(board.done) != "":
		return
	_busy = true
	_sel = ""
	_foe_turn = true
	_refresh()
	var snap := _snap()
	var log0 := (board.log as Array).size()
	RealmTactics.ai_turn(board)
	await _play_diff(snap, log0)
	_foe_turn = false
	_busy = false
	_refresh()
	_after_action()


func _on_auto() -> void:
	if _busy or _closed or String(board.done) != "":
		return
	_busy = true
	_sel = ""
	_refresh()
	var snap := _snap()
	var log0 := (board.log as Array).size()
	RealmTactics.auto_side(board, "me")
	RealmTactics.check(board)
	await _play_diff(snap, log0)
	_busy = false
	if String(board.done) == "":
		await _on_end_turn()
	else:
		_after_action()


func _on_cancel() -> void:
	if _closed:
		return
	_finish({})


func _after_action() -> void:
	var out := RealmTactics.outcome(board)
	if out.is_empty():
		return
	_busy = true
	_title.text = "♟ 전술판 — %s" % String(out.name)
	var lines: Array = ["공 위력 %s%d%%" % ["+" if int(out.winPct) >= 0 else "", int(out.winPct)]]
	if float(out.lossMul) != 1.0:
		lines.append("받는 피해 ×%.1f" % float(out.lossMul))
	for id: String in out.fallen:
		lines.append("⚰ %s 쓰러짐" % _unit_name({"kind": "officer", "id": id}))
	for id: String in out.wounded:
		lines.append("🩹 %s 중상" % _unit_name({"kind": "officer", "id": id}))
	_hint.text = " · ".join(lines)
	_refresh_buttons_off()
	await _wait(END_SEC)
	var grid := RealmTactics.apply(out, enemy_id)
	grid["mine"] = get_meta("mine", [])
	_finish(grid)


func _refresh_buttons_off() -> void:
	for b: Button in _buttons:
		b.disabled = true


func _finish(grid: Dictionary) -> void:
	if _closed:
		return
	_closed = true
	_hide_hud(false)
	for c in _paused_cams:
		if is_instance_valid(c):
			c.set_process(true)
	if _prev_cam != null and is_instance_valid(_prev_cam):
		_prev_cam.current = true
	var cb := _done_cb
	queue_free()
	if cb.is_valid():
		cb.call(grid)
