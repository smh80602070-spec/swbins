extends Node

## 자동 저장 (2026-09-30 새 시스템) — 저장이 "저장" 단추뿐이라 폰을 끄거나 앱이 죽으면 그때까지가 사라졌다. test_village.gd 가 붙인다.
##   · 바뀐 게 있으면(경험·가방·도감·이야기·인물·상자·알·마당·회차 서명이 달라짐) 마지막 저장 MIN_GAP 초 뒤에 저장한다(POLL 초마다 살핀다).
##   · 아무 변화가 없어도 FORCE_GAP 초마다 한 번(걸은 자리를 남긴다).
##   · 창을 닫을 때·앱이 멈출 때(폰 홈 버튼)·창 초점을 잃을 때는 안전하면 바로 저장한다.
##   · 안전한 때만 — 플레이어가 지도 안(비경 원판·이야기 연출 밖)이고 얼려 있지 않고 대결·비경이 없을 때.
##   · 켜지지 않는 때 — 헤드리스·`--script` 실행·SAGA_NO_AUTOSAVE·점검 노드가 붙었을 때(점검·촬영이 진짜 세이브를 덮지 않게).
## 쓰기는 SaveState.save() → SafeFile(임시 파일 → .bak → 바꿔치기)라 쓰는 도중 꺼져도 직전 성공본이 남는다.

signal saved(reason: String)

const TestMap := preload("res://games/saga_go/data/test_map.gd")

const MIN_GAP := 20.0
const POLL := 2.0
const FORCE_GAP := 300.0
const SHOW_SEC := 1.4

## 점검이 켜고 끄는 스위치(빈 글자 = 자동 판단).
var force_enable := false
var saves := 0
var last_reason := ""

var _sig := ""
var _since := 0.0
var _poll_t := 0.0
var _player: Node3D
var _label: Label
var _label_t := 0.0


func _ready() -> void:
	add_to_group("go_autosave")
	var layer := CanvasLayer.new()
	layer.layer = 7
	add_child(layer)
	_label = Label.new()
	_label.text = "💾 자동 저장"
	_label.add_theme_font_size_override("font_size", 26)   # G-0069 — 13 은 가로 창에서 7px
	_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	_label.add_theme_constant_override("outline_size", 6)
	_label.add_theme_color_override("font_color", Color(1, 1, 1, 0.85))
	_label.anchor_top = 1.0
	_label.anchor_bottom = 1.0
	_label.offset_left = 210   # G-0069 — 폰 조이스틱(왼쪽 아래) 오른쪽 위로
	_label.offset_top = -110
	_label.offset_bottom = -70
	_label.visible = false
	layer.add_child(_label)
	_sig = signature()


## 저장해야 할 만큼 바뀌었는지 보는 서명 — 싼 값만 모은다.
func signature() -> String:
	var bag_total := 0
	for k in PartyState.bag:
		bag_total += int(PartyState.bag[k])
	return str([int(PartyState.exp), bag_total, CodexState.count(), PartyState.story, PartyState.members.size(), EventState.resolved.size(),
		(PartyState.eggs.get("bag", []) as Array).size(), (PartyState.eggs.get("inc", []) as Array).size(), int(PartyState.eggs.get("hatched", 0)),
		String(PartyState.eggs.get("buddy", "")), (PartyState.home.get("items", []) as Array).size(), PartyState.cycle,
		PartyState.weapons.size(), PartyState.artifacts.size(), PartyState.growth.size()])


func enabled() -> bool:
	if force_enable:
		return true
	if OS.get_environment("SAGA_NO_AUTOSAVE") != "":
		return false
	if DisplayServer.get_name() == "headless" or "--script" in OS.get_cmdline_args():
		return false
	var scene := get_tree().current_scene
	if scene != null:
		for c in scene.get_children():
			var sc: Script = c.get_script()
			if sc != null and String(sc.resource_path).begins_with("res://tools/"):
				return false
	return true


## 지금 저장해도 되는 자리·때인가.
func safe() -> bool:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
	if _player == null or bool(_player.get("frozen")):
		return false
	if TestMap.region_at(_player.global_position) == "":
		return false
	if get_tree().get_nodes_in_group("go_domain_active").size() > 0 or get_tree().get_nodes_in_group("duel_active").size() > 0:
		return false
	return true


## 저장한다. 안 켜졌거나 안전하지 않으면 false.
func try_save(reason: String) -> bool:
	if not enabled() or not safe():
		return false
	if not SaveState.save():
		return false
	_sig = signature()
	_since = 0.0
	saves += 1
	last_reason = reason
	saved.emit(reason)
	_label.visible = true
	_label_t = SHOW_SEC
	return true


## 살핌 한 번 — 변화가 있고 MIN_GAP 이 지났거나 FORCE_GAP 이 지났으면 저장.
func poll() -> bool:
	var changed := signature() != _sig
	if (changed and _since >= MIN_GAP) or _since >= FORCE_GAP:
		return try_save("변화" if changed else "주기")
	return false


func _physics_process(delta: float) -> void:
	_since += delta
	if _label_t > 0.0:
		_label_t -= delta
		if _label_t <= 0.0:
			_label.visible = false
	_poll_t += delta
	if _poll_t >= POLL:
		_poll_t = 0.0
		poll()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		if signature() != _sig:
			try_save("떠남")
