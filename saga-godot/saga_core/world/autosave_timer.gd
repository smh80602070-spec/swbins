extends Node

## 자동 저장(다른 네 판용 단순판, 2026-09-30) — 상태 서명 없이 SAVE_SEC 마다 저장하고, 창 닫기·앱 멈춤(폰 홈 버튼)·초점 잃음 때도 저장한다.
## GO 는 변화를 살피는 world/autosave.gd 를 쓴다(저장할 상태 목록이 판마다 달라 서명은 그 판 몫). 저장은 각 판 SaveState.save()(→ SafeFile 안전 쓰기).
## 헤드리스·`--script`·SAGA_NO_AUTOSAVE·점검 노드(res://tools/…)가 씬에 붙었을 때는 스스로 꺼진다.
##   AutosaveTimer.attach(부모, 저장 Callable(→bool), 안전한지 Callable(→bool))

const SAVE_SEC := 60.0
const SHOW_SEC := 1.4

var force_enable := false
var saves := 0
var save_call: Callable
var safe_call: Callable

var _since := 0.0
var _label: Label
var _label_t := 0.0


static func attach(parent: Node, save_c: Callable, safe_c: Callable = Callable()) -> Node:
	var n := (load("res://saga_core/world/autosave_timer.gd") as GDScript).new() as Node
	n.name = "AutosaveTimer"
	n.set("save_call", save_c)
	n.set("safe_call", safe_c)
	parent.add_child(n)
	return n


func _ready() -> void:
	add_to_group("autosave_timer")
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


func try_save(_reason: String = "") -> bool:
	if not enabled():
		return false
	if safe_call.is_valid() and not bool(safe_call.call()):
		return false
	if not save_call.is_valid() or not bool(save_call.call()):
		return false
	_since = 0.0
	saves += 1
	flash()
	return true


## "💾 자동 저장" 을 SHOW_SEC 동안 띄운다(저장은 안 함 — 촬영이 표시만 볼 때도 쓴다, G-0069).
func flash(sec: float = SHOW_SEC) -> void:
	_label.visible = true
	_label_t = sec


func _physics_process(delta: float) -> void:
	_since += delta
	if _label_t > 0.0:
		_label_t -= delta
		if _label_t <= 0.0:
			_label.visible = false
	if _since >= SAVE_SEC:
		_since = 0.0
		try_save("주기")


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		try_save("떠남")
