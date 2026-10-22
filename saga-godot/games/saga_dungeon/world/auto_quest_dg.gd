extends "res://saga_core/ui/auto_quest_hud.gd"

## G-0299 2나락 자동 퀘스트(웹 W-0338 ① auto-quest-dg 짝) — ▶ 를 누르면 이번 층을 방 순서대로 대신 걷는다:
## 이야기 단계가 "구출"이면 그 표지로 · 아니면 아직 안 나간 첫 방 — 그 방에 산 적이 있으면 다가가 평타(melee_attack.try_attack), 다 잡으면 출구로.
## 대화 줄은 TALK_SEC 마다 넘김(장면 안 건너뜀) · 은사·출사표 같은 고르기 창은 사람이 고를 때까지 기다림(멈추지 않음) · 체력 25% 밑이면 멈춤.
## 읽는 것은 test_room 공개 칸(_room_origin_z·_exit_used·ROOM_HALF)·scenario_runner(is_talking·next_line·rescue)·Scenario.step 뿐.

const Scenario := preload("res://games/saga_dungeon/data/scenario.gd")
const ARRIVE_M := 0.8
const HIT_R := 2.0
const FIGHT_R := 14.0
const LOW_HP := 0.25

var _room: Node = null


static func attach_dg(room: Node) -> Node:
	return attach(room, "res://games/saga_dungeon/world/auto_quest_dg.gd")


func _ready() -> void:
	game = "dungeon"
	btn_top = 300.0   # 2나락 목표판·위 알림 띠 밑(☰ 236 아래)
	_room = get_parent()
	super._ready()


func _scn() -> Node:
	return _room.get_node_or_null("ScenarioRunner") if _room else null


func goals() -> Array:
	if _room == null:
		return []
	var sc := _scn()
	if sc != null:
		var stv: Dictionary = sc.get("st")
		var s: Dictionary = Scenario.step(stv)
		if String(s.get("t", "")) == "rescue":
			var oz: Array = _room.get("_room_origin_z")
			var ri := int(s.get("room", -1))
			if ri >= 0 and ri < oz.size():
				return [{"id": "rescue:%s:%s" % [stv.get("ch", 0), stv.get("step", 0)], "type": "rescue", "label": "구출", "pos": Vector3(0, 0, float(oz[ri]) - 3.5)}]
	var used: Array = _room.get("_exit_used")
	var oz: Array = _room.get("_room_origin_z")
	var half: Vector3 = _room.ROOM_HALF
	for i in used.size():
		if not bool(used[i]):
			return [{"id": "room:%d" % i, "type": "room", "label": "%d번 방" % (i + 1), "room": i, "oz": float(oz[i]),
				"pos": Vector3(0, 0, float(oz[i]) - half.z - 1.0)}]
	return []


func _room_enemy(goal: Dictionary) -> Node3D:
	var e := nearest_alive("dungeon_enemy", FIGHT_R)
	if e == null or not goal.has("oz"):
		return e
	var half: Vector3 = _room.ROOM_HALF
	return e if absf(e.global_position.z - float(goal.oz)) <= half.z + 1.5 else null


func busy() -> bool:
	var sc := _scn()
	return (sc != null and bool(sc.call("is_talking"))) or choice_open()


func pause_reason() -> String:
	var p := _pl()
	var hp := p.get_node_or_null("PlayerHealth") if p else null
	if hp != null and float(hp.get("max_hp")) > 0.0 and float(hp.get("hp")) / float(hp.get("max_hp")) < LOW_HP:
		return "체력 낮음"
	return ""


func run(goal: Dictionary, dt: float) -> String:
	var sc := _scn()
	if sc != null and bool(sc.call("is_talking")):
		var box := get_tree().current_scene.find_child("TalkBox", true, false) if get_tree().current_scene else null
		if box != null and not (box.get("_choice") as Dictionary).is_empty() and bool(box.call("is_last_line")):
			walk(Vector3.ZERO)
			return "고르기 — 골라 주세요(기다림)"
		return advance_talk(dt, func() -> void: sc.call("next_line"))
	_talk_t = 0.0
	if choice_open():
		walk(Vector3.ZERO)
		return "고르기 — 골라 주세요(기다림)"
	if String(goal.type) == "rescue":
		if walk_to(goal.pos, ARRIVE_M + 0.7):
			sc.call("rescue")
			return "구출"
		return "구출하러 가는 중 %dm" % roundi(dist_to(goal.pos))
	var e := _room_enemy(goal)
	if e != null:
		if walk_to(e.global_position, HIT_R):
			var m := get_tree().get_first_node_in_group("melee_attack")
			if m != null:
				m.call("try_attack")
		return "싸우는 중 — %s" % String(goal.label)
	if not walk_to(goal.pos, ARRIVE_M):
		return "출구로 %dm — %s" % [roundi(dist_to(goal.pos)), String(goal.label)]
	return "출구 — %s" % String(goal.label)
