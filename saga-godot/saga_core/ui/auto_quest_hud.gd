extends CanvasLayer

## G-0299 자동 퀘스트 HUD 공용 몸(G-0298 1만리 auto_quest_go 에서 뺌) — ▶ 단추·진행 글·이동 키 멈춤·틱.
## 판 어댑터가 이 스크립트를 잇고 goals()·run()·busy()·pause_reason() 을 덮는다(규칙은 판 공개 함수만). 상태 기계는 saga_core/data/autoquest.gd.
## 걷기는 walk(dir) — 기본은 주인공 auto_dir(saga_core/player/player.gd). 4종횡처럼 몸이 다르면 덮는다.
## 판은 attach(씬, 판 어댑터 스크립트 경로) 로 붙인다(경로는 판 쪽이 줌). 손잡이 SAGA_AUTOQUEST=0 이면 안 붙음.

const AutoQuest := preload("res://saga_core/data/autoquest.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const UiKit := preload("res://saga_core/ui/ui_kit.gd")
const TALK_SEC := 1.8   # 대화 한 줄 머무는 시간(장면은 건너뛰지 않음)
const MOVE_ACTIONS := ["move_left", "move_right", "move_forward", "move_back"]

var q: RefCounted
var game := "go"
var btn_top := 252.0   # 목표판 밑(1280×720 기준이 아니라 HUD 기준 좌표 — 판이 촬영으로 맞춤)
var _player: Node3D = null
var _btn: Button
var _info: Label
var _talk_t := 0.0
static var resume_on := false   # 켜진 채 장면이 바뀌면(문·층) 새 장면의 ▶ 가 저절로 이어 켠다


static func attach(scene: Node, script_path: String) -> Node:
	if OS.get_environment("SAGA_AUTOQUEST") == "0" or scene == null:
		return null
	var n: CanvasLayer = (load(script_path) as GDScript).new()
	n.name = "AutoQuest"
	scene.add_child(n)
	return n


func _ready() -> void:
	layer = 6
	process_mode = Node.PROCESS_MODE_ALWAYS   # 대화창이 판을 멈춰도 줄을 넘긴다
	add_to_group("autoquest")
	q = AutoQuest.new({"goals": goals, "run": run, "pos": pos, "busy": busy, "pause": pause_reason, "end": _on_end})
	_btn = Button.new()
	_btn.name = "AutoQuestButton"
	_btn.anchor_left = 1.0
	_btn.anchor_right = 1.0
	_btn.offset_left = -300.0
	_btn.offset_right = -12.0
	_btn.offset_top = btn_top
	_btn.offset_bottom = btn_top + 40.0
	_btn.add_theme_font_size_override("font_size", 18)
	_btn.focus_mode = Control.FOCUS_NONE
	_btn.pressed.connect(func() -> void: toggle())
	var th := UiKit.hud_theme(game)   # G-0297 HUD 틀
	if th != null:
		_btn.theme = th
	add_child(_btn)
	_info = Label.new()
	_info.anchor_left = 1.0
	_info.anchor_right = 1.0
	_info.offset_left = -420.0
	_info.offset_right = -12.0
	_info.offset_top = btn_top + 42.0
	_info.offset_bottom = btn_top + 68.0
	_info.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_info.add_theme_font_size_override("font_size", 15)
	_info.add_theme_color_override("font_outline_color", Color.BLACK)
	_info.add_theme_constant_override("outline_size", 4)
	add_child(_info)
	_refresh()
	if resume_on:
		resume_on = false
		call_deferred("_resume")


func toggle() -> bool:
	var was: bool = q.on
	q.toggle()
	if not was and not q.on:
		Toast.show(self, "자동 퀘스트 — %s" % q.why, 2.0)
	_refresh()
	return q.on


func _refresh() -> void:
	_btn.text = "⏸ 자동 멈춤" if q.on else "▶ 자동 퀘스트"
	_info.text = String(q.doing) if q.on else (("멈춤: " + String(q.why)) if String(q.why) != "" else "")


func _pl() -> Node3D:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
	return _player


# ---------------------------------------------------------------- 판이 덮는 것

func goals() -> Array:
	return []


func run(_goal: Dictionary, _dt: float) -> String:
	return ""


func busy() -> bool:
	return false


func pause_reason() -> String:
	return ""


func pos() -> Variant:
	var p := _pl()
	return p.global_position if p else null


func walk(dir: Vector3) -> void:
	var p := _pl()
	if p != null and "auto_dir" in p:
		p.set("auto_dir", dir)


# ---------------------------------------------------------------- 도우미

## 대화 줄을 TALK_SEC 마다 넘긴다 — next 는 판의 next_line Callable. 넘긴 줄이 있으면 "대화 중".
func advance_talk(dt: float, next: Callable) -> String:
	walk(Vector3.ZERO)
	_talk_t += dt
	if _talk_t >= TALK_SEC:
		_talk_t = 0.0
		next.call()
	return "대화 중"


## 고르기 창(ChoicePrompt 등 ui_modal, 내 것·대화창 빼고)이 떠 있나 — 사람이 고를 때까지 기다린다.
func choice_open(except: Array = []) -> bool:
	for n in get_tree().get_nodes_in_group("ui_modal"):
		if n == self or except.has(n) or n.get("visible") == false:
			continue
		if String(n.name).begins_with("TalkBox") or n.is_in_group("saga_menu_screen"):
			continue
		return true
	return false


## 목표 자리로 걷기(수평). 도착하면 true.
func walk_to(target: Vector3, arrive_m: float) -> bool:
	var p := _pl()
	if p == null:
		return false
	var d := target - p.global_position
	d.y = 0.0
	if d.length() <= arrive_m:
		walk(Vector3.ZERO)
		return true
	walk(d.normalized())
	return false


func dist_to(target: Vector3) -> float:
	var p := _pl()
	if p == null:
		return INF
	return Vector2(target.x - p.global_position.x, target.z - p.global_position.z).length()


## 그룹 안 살아 있는(hp>0) 가장 가까운 것 — radius 안, 없으면 null. 일이 있을 때만(틱마다 한 번, 몇 마리 안 됨).
func nearest_alive(group: String, radius: float) -> Node3D:
	var p := _pl()
	if p == null:
		return null
	var best: Node3D = null
	var bd := radius
	for e in get_tree().get_nodes_in_group(group):
		if not (e is Node3D) or not is_instance_valid(e) or e.is_queued_for_deletion():
			continue
		var hp = e.get("hp")
		if hp != null and float(hp) <= 0.0:
			continue
		var d := (e as Node3D).global_position.distance_to(p.global_position)
		if d < bd:
			bd = d
			best = e
	return best


func _resume() -> void:
	if is_inside_tree() and not q.on:
		toggle()


func _exit_tree() -> void:
	if q != null and q.on:
		resume_on = true
		walk(Vector3.ZERO)


func _on_end(_why: String) -> void:
	walk(Vector3.ZERO)
	_talk_t = 0.0
	_refresh()


func _process(delta: float) -> void:
	if q.on:
		q.tick(delta)
		_refresh()


## 아무 이동 입력 = 멈춤(손으로 끔)
func _input(event: InputEvent) -> void:
	if not q.on:
		return
	for a in MOVE_ACTIONS:
		if InputMap.has_action(a) and event.is_action_pressed(a):
			q.stop("손으로 끔")
			_refresh()
			return
