extends Node

## 화면 메뉴 (2026-09-30) — 새 시스템 단추(사냥 기록·주간 도전·사진첩·신수 알·쉼터·재출항·도움말)를 각자 화면 위에 늘어놓았더니 세로 화면(폰)에서
## 겹치고 화면 밖으로 나갔다(창 540×960 촬영). 그래서 단추 하나("메뉴")로 모으고, 누르면 세로 목록이 펼쳐진다. 각 노드의 자기 단추는
## 그룹 "go_hud_menu" 가 있으면 숨는다(각 노드가 has_group 으로 본다). 받을 게 있는 항목엔 ●N, 쉼터는 마당 곁에서만·재출항은 이야기를 끝낸 뒤에만 나온다.
## 키보드 단축키는 그대로다(H·Z·P·I·T·N·F1).

const Hunt := preload("res://games/saga_go/data/hunt.gd")
const Album := preload("res://games/saga_go/data/album.gd")
const Cycle := preload("res://games/saga_go/data/cycle.gd")

var is_open := false

var _player: Node3D
var _layer: CanvasLayer
var _btn: Button
var _list: VBoxContainer
var _rows := {}
var _refresh_t := 0.0


func _ready() -> void:
	add_to_group("go_hud_menu")
	_build()


## [그룹, 글] — 메뉴에 나오는 순서.
const ENTRIES := [
	["go_hunt", "사냥 기록 (H)"],
	["go_weekly_goals", "주간 도전 (Z)"],
	["go_album", "사진첩 (P)"],
	["go_eggs", "신수 알 (I)"],
	["go_homestead", "쉼터 마당 (T)"],
	["go_cycle", "별배 재출항 (N)"],
	["go_help", "도움말 (F1)"],
]
## 받을 게 있어 메뉴 단추에도 ●로 모아 보이는 항목.
const BADGE_TOTAL := ["go_hunt", "go_weekly_goals", "go_album"]


## 항목의 배지 수(받을 것·쌓인 것).
func badge_of(group: String) -> int:
	match group:
		"go_hunt":
			return Hunt.claimable_total()
		"go_weekly_goals":
			return _call_int("go_weekly_goals", "claimable_count")
		"go_album":
			return Album.claimable_milestones()
		"go_eggs":
			return (PartyState.eggs.get("bag", []) as Array).size()
	return 0


## 항목을 지금 보일까 — 쉼터는 마당 곁에서만, 재출항은 이야기를 끝낸 뒤에만.
func shown(group: String) -> bool:
	match group:
		"go_homestead":
			return _yard_near()
		"go_cycle":
			return Cycle.story_done()
	return true


func _call_int(group: String, method: String) -> int:
	var n := get_tree().get_first_node_in_group(group)
	return int(n.call(method)) if n != null else 0


func _yard_near() -> bool:
	var n := get_tree().get_first_node_in_group("go_homestead")
	return n != null and bool(n.call("near"))


func _physics_process(delta: float) -> void:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
	var frozen := _player == null or bool(_player.get("frozen"))
	_btn.visible = not frozen
	if frozen and is_open:
		toggle(false)
	## 배지·항목 표시는 셈이 무거워(종 서른둘·업적 셈) 0.25초마다만 갱신한다.
	_refresh_t -= delta
	if _refresh_t > 0.0:
		return
	_refresh_t = 0.25
	var total := 0
	var i := 0
	for e in ENTRIES:
		var badge := badge_of(String(e[0]))
		if String(e[0]) in BADGE_TOTAL:
			total += badge
		var b: Button = _rows.get(i)
		if b != null:
			b.visible = shown(String(e[0]))
			b.text = String(e[1]) + (" ●%d" % badge if badge > 0 else "")
		i += 1
	_btn.text = "메뉴" + (" ●%d" % total if total > 0 else "")


func toggle(on: bool) -> void:
	is_open = on
	_list.visible = on


## 항목 하나를 연다 — 메뉴는 닫는다. 열렸으면 true.
func open_entry(group: String) -> bool:
	toggle(false)
	var n := get_tree().get_first_node_in_group(group)
	return n != null and bool(n.call("open_screen"))


func _build() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = 6
	add_child(_layer)
	## 화면 기준 크기(가로 1920×1280 · 세로 1080×1920) 좌표 — 왼쪽 가장자리 가운데(미니맵·단추 줄·목표 글·조이스틱과 안 겹치는 자리).
	_btn = Button.new()
	_btn.anchor_top = 0.5
	_btn.anchor_bottom = 0.5
	_btn.offset_left = 10
	_btn.offset_right = 190
	_btn.offset_top = -30
	_btn.offset_bottom = 22
	_btn.add_theme_font_size_override("font_size", 20)
	_btn.visible = false
	_btn.pressed.connect(func() -> void: toggle(not is_open))
	_layer.add_child(_btn)
	_list = VBoxContainer.new()
	_list.anchor_top = 0.5
	_list.anchor_bottom = 0.5
	_list.offset_left = 10
	_list.offset_right = 300
	_list.offset_top = 30
	_list.offset_bottom = 420
	_list.add_theme_constant_override("separation", 6)
	_list.visible = false
	_layer.add_child(_list)
	var i := 0
	for e in ENTRIES:
		var b := Button.new()
		b.text = String(e[1])
		b.custom_minimum_size = Vector2(290, 52)
		b.add_theme_font_size_override("font_size", 20)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		var g: String = e[0]
		b.pressed.connect(func() -> void: open_entry(g))
		_list.add_child(b)
		_rows[i] = b
		i += 1
