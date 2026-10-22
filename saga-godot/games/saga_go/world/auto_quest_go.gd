extends "res://saga_core/ui/auto_quest_hud.gd"

## G-0298 1만리 자동 퀘스트(웹 W-0337 auto-quest-go 짝) — 목표판 밑 ▶: 지금 따라가는 임무(이야기·세계 임무)의 단계를 끝까지 대신한다.
## 목표 자리로 걷기 · 대화 상대 앞에서 말 걸기·줄 넘기기 · 싸움 단계는 가까운 적에게 다가가 평타. 직접 해야 하는 단계(오르기·하늘섬·배·쫓기·
## 채집·요리·불 밝히기·봉인·방어 …)·고르기 대화·체력 낮음에서 멈추고 이유를 띄운다. 공용 몸(▶·글·이동 키 멈춤)은 saga_core/ui/auto_quest_hud.gd(G-0299).

const WorldQuests := preload("res://games/saga_go/data/world_quests.gd")

const WALK := ["go", "talk", "follow"]          # 걸어가서 끝나는 단계
const FIGHT := ["kill", "duel", "boss"]          # 걸어가서 싸우는 단계
const ARRIVE_M := 2.2
const FIGHT_R := 12.0
const HIT_R := 2.4
const LOW_HP := 0.25

var _sq: Node = null


static func attach_go(scene: Node) -> Node:
	return attach(scene, "res://games/saga_go/world/auto_quest_go.gd")


func _ready() -> void:
	game = "go"
	btn_top = 252.0   # 목표판 넷째 줄(의뢰) 밑 — 촬영으로 맞춤
	add_to_group("go_autoquest")
	super._ready()
	## G-0301 대화 띠(MobileHUD, 미니맵 밑으로 내려옴)가 ▶ 와 같은 높이 — 띠 오른쪽 끝을 ▶ 칸(-300) 왼쪽에서 멈춘다
	var hud := get_parent().find_child("MobileHUD", true, false) if get_parent() else null
	for nm in ["DialoguePanel", "DialogueLabel"]:
		var c := hud.get_node_or_null(nm) as Control if hud else null
		if c != null:
			c.offset_right = minf(c.offset_right, -316.0)


func _story() -> Node:
	if _sq == null or not is_instance_valid(_sq):
		_sq = get_tree().get_first_node_in_group("go_story")
	return _sq


## 지금 따라가는 단계 하나(세계 임무를 따라가면 그것, 아니면 이야기)
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
	if bool(sq.call("is_dialogue_open")):   # 이야기 대화는 story_quest 자체 줄(TalkBox 아님)
		return advance_talk(dt, func() -> void: sq.call("next_line"))
	_talk_t = 0.0
	var ty := String(goal.type)
	if FIGHT.has(ty):
		var fc := get_tree().get_first_node_in_group("go_field_combat")
		var near: Array = fc.call("_nearest", p.global_position, FIGHT_R, 1) if fc else []
		if not near.is_empty():
			if walk_to((near[0] as Node3D).global_position, HIT_R):
				fc.call("attack")
			return "싸우는 중 — %s" % String(goal.label)
	if not walk_to(goal.pos, ARRIVE_M):
		return "가는 중 %dm — %s" % [roundi(dist_to(goal.pos)), String(goal.label)]
	if ty == "talk" or ty == "follow":
		sq.call("interact")
		return "말 거는 중"
	return "도착 — %s" % String(goal.label)
