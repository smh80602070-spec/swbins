extends Node3D

## PLAN 106장 ⑲ — 원신식 일일 의뢰(진척·보상·게시판·의뢰판). 표는 data/commissions.gd, 상태는 PartyState.commissions.
##   날마다(새벽 4시) 넷을 새로 굴린다 — 로드 뒤·놀이 중 날이 넘어가도(5초마다 본다).
##   진척: 토벌(field_enemy died) · 채집(gathering gathered) · 요리(kitchen cooked) · 원소 반응(field_combat reacted) ·
##   둘러보기(0.5초마다 그 자리 12m 안). 하나 끝나면 곧바로 보상, 넷 다 끝나면 마을 역참 옆 게시판 4m 안에서 추가 보상.
##   의뢰판: U · 왼쪽 위 "의뢰" 단추로 여닫는다(창이 아니라 안 멈춘다). 오른쪽 위 목표판 셋째 줄에 "의뢰 n/4".
## test_village.gd 가 로드 뒤, 채집·요리 뒤에 짓는다(그 신호에 붙는다).

const Commissions := preload("res://games/saga_go/data/commissions.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")

signal changed()

const DAY_CHECK_SEC := 5.0
const VISIT_CHECK_SEC := 0.5

var board_pos := Vector3.ZERO
var _player: Node3D = null
var _day_t := 0.0
var _visit_t := 0.0
var _layer: CanvasLayer = null
var _panel: PanelContainer = null
var _label: Label = null
var _ar_label: Label = null # 106장 ㉒ 모험·세계 등급 줄
var _wl_btn: Button = null

func _ready() -> void:
	add_to_group("go_commissions")
	_player = get_tree().get_first_node_in_group("player")
	if not InputMap.has_action("go_commissions"):
		InputMap.add_action("go_commissions")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_U
		InputMap.action_add_event("go_commissions", ev)
	board_pos = TestMap.world_pos(Commissions.BOARD_CELL.x, Commissions.BOARD_CELL.y, Commissions.BOARD_REGION) + Commissions.BOARD_OFFSET
	board_pos.y = TerrainBuilder.height_at(Commissions.BOARD_REGION, board_pos)
	_build_board()
	_build_panel()
	ensure_today()
	for e in get_tree().get_nodes_in_group("field_enemy"):
		e.connect("died", _on_enemy_died)
	var ga := get_tree().get_first_node_in_group("go_gathering")
	if ga:
		ga.connect("gathered", func(item: String) -> void: progress("gather", item))
	var ki := get_tree().get_first_node_in_group("go_kitchen")
	if ki:
		ki.connect("cooked", func(_r: String, _q: int) -> void: progress("cook", ""))
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	if fc:
		fc.connect("reacted", func(_r: String) -> void: progress("react", ""))
	_refresh_panel()

# ---------------------------------------------------------------- 상태

## 오늘 의뢰가 아니면 새로 굴린다. 굴렸으면 true.
func ensure_today() -> bool:
	var day := Commissions.today()
	if int(PartyState.commissions.get("day", -999999)) == day and (PartyState.commissions.get("list", []) as Array).size() == Commissions.PER_DAY:
		return false
	var list: Array = []
	for id in Commissions.roll(day):
		list.append({"id": id, "p": 0, "done": false})
	PartyState.commissions = {"day": day, "list": list, "bonus": false}
	changed.emit()
	_refresh_panel()
	return true

func entries() -> Array:
	return PartyState.commissions.get("list", [])

func done_count() -> int:
	var n := 0
	for e in entries():
		if e.done:
			n += 1
	return n

func bonus_claimed() -> bool:
	return bool(PartyState.commissions.get("bonus", false))

func all_done() -> bool:
	return done_count() >= Commissions.PER_DAY

static func info(id: String) -> Dictionary:
	return Commissions.POOL[id]

## 둘러보기 의뢰 자리(땅 높이까지).
static func visit_pos(id: String) -> Vector3:
	var c: Dictionary = Commissions.POOL[id]
	var g: Vector2 = c.cell
	var p := TestMap.world_pos(g.x, g.y, c.region)
	p.y = TerrainBuilder.height_at(c.region, p)
	return p

# ---------------------------------------------------------------- 진척

func _on_enemy_died(enemy: Node) -> void:
	var kind := String(enemy.get("kind"))
	var def: Variant = enemy.get("def")
	var elemental: bool = typeof(def) == TYPE_DICTIONARY and (def as Dictionary).has("element")
	for e in entries():
		if e.done or info(e.id).kind != "kill":
			continue
		var t: String = info(e.id).target
		if t == kind or (t == "elemental" and elemental):
			_advance(e)

## kind 가 맞는(채집은 채집물까지) 안 끝난 의뢰를 하나씩 올린다.
func progress(kind: String, what: String) -> void:
	for e in entries():
		if e.done or info(e.id).kind != kind:
			continue
		if kind == "gather" and info(e.id).item != what:
			continue
		_advance(e)

func _advance(e: Dictionary) -> void:
	var c := info(e.id)
	e.p = mini(int(e.p) + 1, int(c.n))
	if int(e.p) >= int(c.n):
		e.done = true
		PartyState.add_items(Commissions.REWARD)
		PartyState.add_exp(Commissions.REWARD_EXP)
		var tail := " — 게시판(마을 역참 옆)에서 추가 보상" if all_done() else ""
		Toast.show(self, "의뢰 완료: %s (%d/%d) · 냥 %d·짧은 견문록 %d%s" % [c.name, done_count(), Commissions.PER_DAY,
			Commissions.REWARD.mora, Commissions.REWARD.book_s, tail], 3.0)
		CombatFeel.ui()
	elif c.kind != "visit":
		Toast.show(self, "의뢰 %s %d/%d" % [c.name, int(e.p), int(c.n)], 1.4)
	changed.emit()
	_refresh_panel()

## 넷 다 끝났고 아직 안 받았으면 추가 보상. 받았으면 true.
func claim_bonus() -> bool:
	if not all_done() or bonus_claimed():
		return false
	PartyState.commissions.bonus = true
	PartyState.add_items(Commissions.BONUS)
	PartyState.add_exp(Commissions.BONUS_EXP)
	get_tree().call_group("go_eggs", "award", "commission", str(int(Time.get_unix_time_from_system() / 86400.0)))
	Toast.show(self, "오늘 의뢰를 다 마쳤다 — 냥 %d·견문록 %d·강화석 %d·연마석 %d" % [Commissions.BONUS.mora,
		Commissions.BONUS.book_m, Commissions.BONUS.ore_m, Commissions.BONUS.polish], 3.5)
	CombatFeel.ui()
	changed.emit()
	_refresh_panel()
	return true

func _physics_process(delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		return
	_day_t -= delta
	if _day_t <= 0.0:
		_day_t = DAY_CHECK_SEC
		if ensure_today():
			Toast.show(self, "새 날 — 오늘의 의뢰 넷 (U)", 2.5)
	_visit_t -= delta
	if _visit_t > 0.0:
		return
	_visit_t = VISIT_CHECK_SEC
	var p := _player.global_position
	for e in entries():
		if e.done or info(e.id).kind != "visit":
			continue
		var d := visit_pos(e.id) - p
		if Vector2(d.x, d.z).length() <= Commissions.VISIT_M:
			_advance(e)
	if all_done() and not bonus_claimed() and p.distance_to(board_pos) <= Commissions.BOARD_M:
		claim_bonus()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("go_commissions"):
		toggle_panel()
		get_viewport().set_input_as_handled()

# ---------------------------------------------------------------- 의뢰판

func toggle_panel() -> void:
	_panel.visible = not _panel.visible
	_refresh_panel()

func panel_text() -> String:
	return _label.text if _label else ""

func _build_panel() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = 5
	add_child(_layer)
	var btn := Button.new()
	btn.text = "의뢰 (U)"
	btn.position = Vector2(430, 20)
	btn.size = Vector2(96, 40)
	btn.pressed.connect(toggle_panel)
	_layer.add_child(btn)
	_panel = PanelContainer.new()
	_panel.position = Vector2(430, 70)
	_panel.custom_minimum_size = Vector2(420, 0)
	_panel.visible = false
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.08, 0.07, 0.06, 0.82)
	sb.set_corner_radius_all(8)
	sb.content_margin_left = 14
	sb.content_margin_right = 14
	sb.content_margin_top = 10
	sb.content_margin_bottom = 10
	_panel.add_theme_stylebox_override("panel", sb)
	_layer.add_child(_panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	_panel.add_child(box)
	## 106장 ㉒ — 원신 모험 수첩처럼 의뢰판 맨 위에 모험 등급·세계 등급, 세계 등급 낮추기 단추.
	_ar_label = Label.new()
	_ar_label.add_theme_font_size_override("font_size", 15)
	_ar_label.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5))
	_ar_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(_ar_label)
	_wl_btn = Button.new()
	_wl_btn.custom_minimum_size = Vector2(0, 36)
	_wl_btn.pressed.connect(func() -> void:
		var adv := get_tree().get_first_node_in_group("go_adventure")
		if adv:
			adv.call("lower_world")
		_refresh_panel())
	box.add_child(_wl_btn)
	_label = Label.new()
	_label.add_theme_font_size_override("font_size", 15)
	_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(_label)
	PartyState.world_changed.connect(_refresh_panel)
	PartyState.level_up.connect(func(_lv: int) -> void: _refresh_panel())

func _refresh_panel() -> void:
	if _label == null:
		return
	var adv := get_tree().get_first_node_in_group("go_adventure") if is_inside_tree() else null
	_ar_label.text = String(adv.call("summary")) if adv else ""
	_wl_btn.visible = adv != null and (PartyState.wl_lowered or Adventure.can_lower())
	_wl_btn.text = "세계 등급 되돌리기" if PartyState.wl_lowered else "세계 등급 한 단계 낮추기"
	var lines: Array[String] = ["오늘의 의뢰  %d/%d" % [done_count(), Commissions.PER_DAY]]
	for e in entries():
		var c := info(e.id)
		lines.append("%s [%s] %s  %d/%d\n    %s" % ["✔" if e.done else "·", Commissions.KIND_NAMES[c.kind], c.name,
			int(e.p), int(c.n), c.desc])
	if bonus_claimed():
		lines.append("추가 보상 받음 — 내일 새벽 4시에 새 의뢰")
	elif all_done():
		lines.append("넷 다 마쳤다 — 마을 역참 옆 의뢰 게시판으로")
	else:
		lines.append("넷 다 마치면 마을 역참 옆 게시판에서 추가 보상")
	_label.text = "\n".join(lines)

# ---------------------------------------------------------------- 게시판 모양

func _build_board() -> void:
	var root := Node3D.new()
	root.name = "CommissionBoard"
	add_child(root)
	root.global_position = board_pos
	var wood := StandardMaterial3D.new()
	wood.albedo_color = Color(0.45, 0.3, 0.17)
	var paper := StandardMaterial3D.new()
	paper.albedo_color = Color(0.92, 0.88, 0.76)
	for x in [-0.9, 0.9]:
		var post := MeshInstance3D.new()
		var pm := BoxMesh.new()
		pm.size = Vector3(0.14, 2.2, 0.14)
		post.mesh = pm
		post.material_override = wood
		post.position = Vector3(x, 1.1, 0.0)
		root.add_child(post)
	var plank := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(2.0, 1.1, 0.08)
	plank.mesh = bm
	plank.material_override = wood
	plank.position = Vector3(0.0, 1.45, 0.0)
	root.add_child(plank)
	var roof := MeshInstance3D.new()
	var rm := PrismMesh.new()
	rm.size = Vector3(2.4, 0.4, 0.5)
	roof.mesh = rm
	roof.material_override = wood
	roof.position = Vector3(0.0, 2.2, 0.0)
	root.add_child(roof)
	for i in 4:
		var note := MeshInstance3D.new()
		var nm := BoxMesh.new()
		nm.size = Vector3(0.36, 0.44, 0.02)
		note.mesh = nm
		note.material_override = paper
		note.position = Vector3(-0.66 + 0.44 * i, 1.45 + (0.12 if i % 2 == 0 else -0.08), 0.05)
		note.rotation.z = (0.06 if i % 2 == 0 else -0.05)
		root.add_child(note)
