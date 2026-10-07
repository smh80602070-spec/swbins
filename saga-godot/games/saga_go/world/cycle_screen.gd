extends Node

## 별배 재출항(회차) 화면 (2026-09-30) — 규칙·수치는 data/cycle.gd, 상태는 PartyState.cycle. test_village.gd 가 붙인다.
##   N(터치 없음 — 이야기를 끝낸 뒤에만 왼쪽 위 "재출항" 단추가 뜬다) → 화면: 지금 회차·얻는 것(영구 +5%·세계 등급 상한 +2)·되살아나는 것·
##   조건. 조건이 되면 "별배 재출항" 단추 — 한 번 눌러 확인, 한 번 더 누르면 출항(그 자리에서 상자가 되살아나고 저장한다).

signal sailed(result: Dictionary)

const Cycle := preload("res://games/saga_go/data/cycle.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")
const Story := preload("res://games/saga_go/data/story.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

var is_open := false
var confirming := false

var _player: Node3D
var _frozen_before := false
var _layer: CanvasLayer
var _panel: PanelContainer
var _body: VBoxContainer
var _prompt_btn: Button


func _ready() -> void:
	add_to_group("go_cycle")
	if not InputMap.has_action("go_cycle"):
		InputMap.add_action("go_cycle")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_N
		InputMap.action_add_event("go_cycle", ev)
	_build_screen()


func _physics_process(_delta: float) -> void:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
		return
	_prompt_btn.visible = not is_open and not bool(_player.get("frozen")) and Cycle.story_done() and not get_tree().has_group("go_hud_menu")
	_prompt_btn.text = "재출항 (N)" + (" ★%d" % PartyState.cycle if PartyState.cycle > 0 else "")


## 출항한다. 상자를 그 자리에서 되살리고(treasure_spawner.respawn) 저장한다(persist — 점검은 끈다). 결과를 돌려준다.
func sail(persist := true) -> Dictionary:
	var r := Cycle.advance()
	if r.has("error"):
		Toast.show(self, String(r.error), 2.5)
		return r
	Toast.show(self, "⛵ %d회차 출항! 상자 %d개가 되살아났다 — 공격력·경험치 +%d%%" % [int(r.cycle), int(r.chests), int(100.0 * Cycle.bonus())], 4.0)
	sailed.emit(r)
	confirming = false
	if is_open:
		close_screen()
	get_tree().call_group("go_treasure", "respawn")
	if persist:
		SaveState.save()
	return r


func _unhandled_input(event: InputEvent) -> void:
	if is_open:
		if event.is_action_pressed("go_cycle") or (event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE):
			close_screen()
			get_viewport().set_input_as_handled()
	elif event.is_action_pressed("go_cycle"):
		if open_screen():
			get_viewport().set_input_as_handled()


func open_screen() -> bool:
	if is_open or _player == null or _player.get("frozen"):
		return false
	if get_tree().get_nodes_in_group("duel_active").size() > 0:
		return false
	is_open = true
	confirming = false
	_panel.visible = true
	_frozen_before = bool(_player.get("frozen"))
	_player.set("frozen", true)
	_refresh()
	return true


func close_screen() -> void:
	if not is_open:
		return
	is_open = false
	confirming = false
	_panel.visible = false
	if _player:
		_player.set("frozen", _frozen_before)


func _build_screen() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = 6
	add_child(_layer)
	_prompt_btn = Button.new()
	_prompt_btn.anchor_top = 0.0
	## 화면 기준 크기(1920×1280) 좌표 — 왼쪽 위 단추 줄 바로 아래(미니맵과 안 겹치게).
	_prompt_btn.offset_left = 222
	_prompt_btn.offset_right = 400
	_prompt_btn.offset_top = 70
	_prompt_btn.offset_bottom = 108
	_prompt_btn.visible = false
	_prompt_btn.pressed.connect(func() -> void: open_screen())
	_layer.add_child(_prompt_btn)
	_panel = PanelContainer.new()
	_panel.anchor_left = 0.5
	_panel.anchor_right = 0.5
	_panel.anchor_top = 0.5
	_panel.anchor_bottom = 0.5
	_panel.offset_left = -330
	_panel.offset_right = 330
	_panel.offset_top = -270
	_panel.offset_bottom = 270
	_panel.visible = false
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.07, 0.1, 0.94)
	sb.set_corner_radius_all(10)
	sb.content_margin_left = 18
	sb.content_margin_right = 18
	sb.content_margin_top = 14
	sb.content_margin_bottom = 14
	_panel.add_theme_stylebox_override("panel", sb)
	_layer.add_child(_panel)
	_body = VBoxContainer.new()
	_body.add_theme_constant_override("separation", 8)
	_panel.add_child(_body)


func _label(text: String, size := 15, color := Color(0.92, 0.92, 0.92)) -> void:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_body.add_child(l)


func _refresh() -> void:
	for c in _body.get_children():
		c.queue_free()
	var cyc: int = PartyState.cycle
	_label("⛵ 별배 재출항 — %d회차 (최대 %d)" % [cyc, Cycle.MAX_CYCLE], 20, Color(1.0, 0.86, 0.5))
	_label("지금: 공격력·경험치 +%d%% · 세계 등급 상한 %d" % [int(100.0 * Cycle.bonus()), 8 + Adventure.CYCLE_WL * cyc], 15, Color(0.7, 0.95, 0.75))
	_label("이야기: %s · 모험 등급 %d/%d" % ["끝났다 ✔" if Cycle.story_done() else "끝나지 않았다 (%d/%d장)" % [int(PartyState.story.get("ch", 0)), Story.MAIN_CHAPTERS], Adventure.ar(), Cycle.REQ_AR], 15)
	_label("출항하면", 17, Color(1.0, 0.9, 0.6))
	_label("· 열어 둔 상자가 모두 되살아난다 · 채집 자리 회복 · 주간 비경 횟수·밤의 잔불 초기화 · 세계 등급 낮춤 해제", 14)
	_label("· 공격력·경험치가 영구히 +%d%% 더 · 세계 등급 상한 +%d(모험 등급 45·50·… 에 하나씩 열림 — 적이 더 세지고 전리품이 더 붙는다)" % [int(100.0 * Cycle.BONUS_PER_CYCLE), Adventure.CYCLE_WL], 14)
	_label("· 보상: 냥 %d · 두꺼운 견문록 %d · 인연 매듭 %d" % [int(Cycle.CYCLE_REWARD.mora), int(Cycle.CYCLE_REWARD.book_l), int(Cycle.CYCLE_REWARD.fate_knot)], 14)
	## G-0074 — 회차 전용 이야기(장 칸 cycle). 첫 회차 장이 아직 잠겨 있으면 무엇이 열리는지 알려 준다.
	var first_cycle_ch := Story.chapter(Story.MAIN_CHAPTERS)
	if not first_cycle_ch.is_empty() and cyc < int(first_cycle_ch.get("cycle", 0)):
		_label("· 회차 전용 이야기 13부 「같은 날, 다른 눈」(%s~)이 열린다 — 1부의 그날을 다른 시대의 눈으로" % String(first_cycle_ch.name).get_slice(" · ", 0), 14, Color(1.0, 0.8, 0.95))
	_label("그대로 남는 것: 이야기 진행·도감·인물·무기·성유물·신수·마당", 14, Color(0.7, 0.8, 0.95))
	var why := Cycle.blocker()
	if why != "":
		_label("지금은 출항할 수 없다 — " + why, 15, Color(0.95, 0.7, 0.5))
	var go := Button.new()
	go.text = "정말 출항한다 (한 번 더 누르면 새 회차로)" if confirming else "별배 재출항"
	go.custom_minimum_size = Vector2(0, 46)
	go.disabled = why != ""
	go.pressed.connect(func() -> void:
		if confirming:
			sail()
		else:
			confirming = true
			_refresh())
	_body.add_child(go)
	var close := Button.new()
	close.text = "닫기 (N)"
	close.custom_minimum_size = Vector2(0, 40)
	close.pressed.connect(close_screen)
	_body.add_child(close)
