extends CanvasLayer

## G-0298 1만리 자동 퀘스트(웹 W-0337 auto-quest-go 짝) — 목표판 밑 ▶ 단추를 누르면 지금 따라가는 임무(이야기·세계 임무)의 단계를
## 끝까지 대신한다: 목표 자리로 걷기(주인공 auto_dir) · 대화 상대 앞에서 말 걸기·줄 넘기기 · 싸움 단계는 가까운 적에게 다가가 평타.
## 공용 상태 기계는 saga_core/data/autoquest.gd. 이 판에서 "직접 해야 하는 단계"(오르기·하늘섬·배·쫓기·채집·요리·불 밝히기·봉인·방어 등)와
## 고르기 대화·체력 낮음에서는 멈추고 이유를 띄운다. 아무 이동 키·조이스틱 = 멈춤(손으로 끔). 이야기 장면은 건너뛰지 않는다(줄마다 TALK_SEC).
## 손잡이 SAGA_AUTOQUEST=0 이면 안 붙음.

const AutoQuest := preload("res://saga_core/data/autoquest.gd")
const WorldQuests := preload("res://games/saga_go/data/world_quests.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const WALK := ["go", "talk", "follow"]          # 걸어가서 끝나는 단계
const FIGHT := ["kill", "duel", "boss"]          # 걸어가서 싸우는 단계
const ARRIVE_M := 2.2                             # 대화 상대·목표 자리에 이만큼 다가가면 섬
const FIGHT_R := 12.0                             # 싸움 단계에서 이 안의 적을 찾는다
const HIT_R := 2.4                                # 이만큼 다가가면 평타
const TALK_SEC := 1.8                             # 대화 한 줄 머무는 시간
const LOW_HP := 0.25

var q: RefCounted
var _sq: Node = null
var _player: Node3D = null
var _btn: Button
var _info: Label
var _talk_t := 0.0


static func attach(scene: Node) -> Node:
	if OS.get_environment("SAGA_AUTOQUEST") == "0" or scene == null:
		return null
	var n: CanvasLayer = (load("res://games/saga_go/world/auto_quest_go.gd") as GDScript).new()
	n.name = "AutoQuest"
	scene.add_child(n)
	return n


func _ready() -> void:
	layer = 6
	process_mode = Node.PROCESS_MODE_ALWAYS   # 대화창이 판을 멈춰도 줄을 넘긴다
	add_to_group("go_autoquest")
	q = AutoQuest.new({"goals": goals, "run": run, "pos": pos, "busy": busy, "pause": pause_reason, "end": _on_end})
	_btn = Button.new()
	_btn.name = "AutoQuestButton"
	_btn.anchor_left = 1.0
	_btn.anchor_right = 1.0
	_btn.offset_left = -300.0
	_btn.offset_right = -12.0
	_btn.offset_top = 252.0   # 목표판 넷째 줄(의뢰) 밑 — 촬영으로 맞춤
	_btn.offset_bottom = 292.0
	_btn.add_theme_font_size_override("font_size", 18)
	_btn.focus_mode = Control.FOCUS_NONE
	_btn.pressed.connect(func() -> void: toggle())
	add_child(_btn)
	var th: Theme = (load("res://saga_core/ui/ui_kit.gd") as GDScript).call("hud_theme", "go")   # G-0297 HUD 틀
	if th != null:
		_btn.theme = th
	_info = Label.new()
	_info.anchor_left = 1.0
	_info.anchor_right = 1.0
	_info.offset_left = -300.0
	_info.offset_right = -12.0
	_info.offset_top = 294.0
	_info.offset_bottom = 320.0
	_info.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_info.add_theme_font_size_override("font_size", 15)
	_info.add_theme_color_override("font_outline_color", Color.BLACK)
	_info.add_theme_constant_override("outline_size", 4)
	add_child(_info)
	_refresh()


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


func _story() -> Node:
	if _sq == null or not is_instance_valid(_sq):
		_sq = get_tree().get_first_node_in_group("go_story")
	return _sq


func _pl() -> Node3D:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
	return _player


## 어댑터 — 지금 따라가는 단계 하나(세계 임무를 따라가면 그것, 아니면 이야기)
func goals() -> Array:
	var sq := _story()
	if sq == null:
		return []
	var t: String = sq.call("track")
	var s: Dictionary
	var id: String
	if t != "":
		s = WorldQuests.step_of(t, int(sq.call("wq_step", t)))
		id = "wq:%s:%d" % [t, int(sq.call("wq_step", t))]
	else:
		if bool(sq.call("locked")):
			return []
		s = sq.call("current_step")
		id = "st:%d:%d" % [int(sq.call("ch")), int(sq.call("st"))]
	if s.is_empty():
		return []
	var p: Vector3 = sq.call("target_pos")
	return [{"id": id, "type": String(s.get("type", "")), "label": String(s.get("text", "")), "pos": p, "npc": String(s.get("npc", ""))}]


func pos() -> Variant:
	var p := _pl()
	return p.global_position if p else null


func busy() -> bool:
	var sq := _story()
	if sq != null and bool(sq.call("is_dialogue_open")):
		return true
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	return fc != null and bool(fc.call("in_combat"))


func pause_reason() -> String:
	var g: Array = goals()
	if g.is_empty():
		return ""
	var ty := String(g[0].type)
	if not WALK.has(ty) and not FIGHT.has(ty):
		return "직접 해야 하는 단계 — %s" % String(g[0].label)
	if (g[0].pos as Vector3) == Vector3.INF:
		return "목표 자리를 모름 — %s" % String(g[0].label)
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	if fc != null:
		var id: String = fc.call("active_id")
		var mx := float(fc.call("max_hp_of", id))
		if mx > 0.0 and float(fc.call("hp_of", id)) / mx < LOW_HP:
			return "체력 낮음"
	var sq := _story()
	if sq != null and bool(sq.get("_dlg_waiting_choice")):
		return "고르기 — 직접 골라 주세요"
	return ""


func run(goal: Dictionary, dt: float) -> String:
	var sq := _story()
	var p := _pl()
	if sq == null or p == null:
		return ""
	## 대화 중 — 줄을 TALK_SEC 마다 넘긴다(장면은 건너뛰지 않음)
	if bool(sq.call("is_dialogue_open")):
		_walk(Vector3.ZERO)
		_talk_t += dt
		if _talk_t >= TALK_SEC:
			_talk_t = 0.0
			sq.call("next_line")   # 이야기 대화는 story_quest 자체 줄(TalkBox 아님)
		return "대화 중"
	_talk_t = 0.0
	var ty := String(goal.type)
	var target: Vector3 = goal.pos
	if FIGHT.has(ty):
		var fc := get_tree().get_first_node_in_group("go_field_combat")
		var near: Array = fc.call("_nearest", p.global_position, FIGHT_R, 1) if fc else []
		if not near.is_empty():
			var e := near[0] as Node3D
			var to := e.global_position - p.global_position
			to.y = 0.0
			if to.length() > HIT_R:
				_walk(to.normalized())
			else:
				_walk(Vector3.ZERO)
				fc.call("attack")
			return "싸우는 중 — %s" % String(goal.label)
	var d := target - p.global_position
	d.y = 0.0
	if d.length() > ARRIVE_M:
		_walk(d.normalized())
		return "가는 중 %dm — %s" % [roundi(d.length()), String(goal.label)]
	_walk(Vector3.ZERO)
	if ty == "talk" or ty == "follow":
		sq.call("interact")
		return "말 거는 중"
	return "도착 — %s" % String(goal.label)


func _walk(dir: Vector3) -> void:
	var p := _pl()
	if p != null and "auto_dir" in p:
		p.set("auto_dir", dir)


func _on_end(_why: String) -> void:
	_walk(Vector3.ZERO)
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
	for a in ["move_left", "move_right", "move_forward", "move_back"]:
		if InputMap.has_action(a) and event.is_action_pressed(a):
			q.stop("손으로 끔")
			_refresh()
			return
