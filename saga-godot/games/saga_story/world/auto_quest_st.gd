extends "res://saga_core/ui/auto_quest_hud.gd"

## G-0299 4종횡 자동 퀘스트(웹 W-0338 ③ auto-quest-st 짝) — ▶ 를 누르면 이야기 단계를 대신한다(옆보기 — 좌우 걷기 auto_x·평타 auto_attack):
##   stage / talk(at)  그 장면으로 — 장면 파일의 문(target_scene)을 읽어 다음 문을 고르고(너비 우선) 걸어가 문을 연다(story_interact 한 번)
##   stagekill / 사냥 사명(kill) · boss   그 사냥터로 가서 가까운 적에게 다가가 평타
##   talk(그 장면) — 장면에 들어서면 이야기 창이 저절로 뜬다(기다림), 줄은 TALK_SEC 마다 넘김
##   그 밖(전직·관문·비경·유대·채집·장비·말 걸기 횟수·금 …) — "직접 해야 하는 단계"로 멈춤. 고르기·상인 창은 사람이 고를 때까지 기다림. 체력 25% 밑 멈춤.

const Scenario := preload("res://games/saga_story/data/scenario.gd")
const WORLD := "res://games/saga_story/world/"
const ARRIVE_M := 0.8
const HIT_R := 1.9
const FIGHT_R := 400.0   # 옆보기 장면 전체
const HUNT_DEFAULT := "TestField"   # 장소 없는 사냥 — 이 장면에 적이 없으면 허창 들판으로
const LOW_HP := 0.25

static var _graph := {}   # 장면 이름 → [이웃 장면 이름] (tscn 의 target_scene 을 한 번 읽음)
var _press_t := 0.0


static func attach_st(scene: Node) -> Node:
	return attach(scene, "res://games/saga_story/world/auto_quest_st.gd")


func _ready() -> void:
	game = "story"
	btn_top = 300.0   # 4종횡 오른쪽 목표 글·☰(236) 밑
	super._ready()


func _scn() -> Node:
	return get_tree().get_first_node_in_group("story_scenario")


func _cur_name() -> String:
	var s := get_tree().current_scene
	return String(s.name) if s else ""


static func _scene_of_key(key: String) -> String:
	for n in Scenario.SCENE_KEYS:
		if String(Scenario.SCENE_KEYS[n]) == key:
			return n
	return ""


static func graph() -> Dictionary:
	if _graph.is_empty():
		for n in Scenario.SCENE_KEYS:
			var txt := FileAccess.get_file_as_string(WORLD + n + ".tscn")
			var out: Array = []
			for line in txt.split("\n"):
				if line.begins_with("target_scene = \""):
					out.append(line.get_slice("\"", 1).get_file().get_basename())
			_graph[n] = out
	return _graph


## from → to 로 가는 첫 이웃(없으면 "")
static func next_hop(from: String, to: String) -> String:
	if from == to:
		return ""
	var g := graph()
	var prev := {from: ""}
	var queue: Array = [from]
	while not queue.is_empty():
		var cur: String = queue.pop_front()
		for nb in g.get(cur, []):
			if prev.has(nb):
				continue
			prev[nb] = cur
			if nb == to:
				var step: String = nb
				while String(prev[step]) != from:
					step = prev[step]
				return step
			queue.append(nb)
	return ""


func _portal_to(scene_name: String) -> Node3D:
	var s := get_tree().current_scene
	if s == null:
		return null
	for n in s.find_children("*", "Node3D", true, false):
		var ts = n.get("target_scene")
		if ts is String and String(ts).get_file().get_basename() == scene_name:
			return n
	return null


## 지금 이야기 단계 하나 → {id, type(go·fight·wait·direct), label, want(장면 이름), pos}
func goals() -> Array:
	var sc := _scn()
	if sc == null:
		return []
	var stv: Dictionary = sc.get("st")
	var s: Dictionary = Scenario.step(stv)
	if s.is_empty():
		return []
	var id := "st:%s:%s" % [stv.get("ch", 0), stv.get("step", 0)]
	var label := String(sc.call("objective"))
	var t := String(s.get("t", ""))
	var want := ""
	var kind := "direct"
	match t:
		"stage":
			want = _scene_of_key(String(s.stage))
			kind = "wait"
		"talk":
			want = _scene_of_key(String(s.get("at", "")))
			kind = "wait"
		"stagekill":
			want = _scene_of_key(String(s.stage))
			kind = "fight"
		"boss":
			kind = "fight"
		"mission":
			var qd: Dictionary = StoryCombat.QUESTS.get(String(s.quest), {})
			if String(qd.get("goal_type", "")) in ["kill", "boss"]:
				want = _scene_of_key(String(qd.get("stage", "")))
				kind = "fight"
	if kind == "fight" and want == "" and nearest_alive("story_enemy", FIGHT_R) == null:
		want = HUNT_DEFAULT
	if want != "" and want != _cur_name():
		var hop := next_hop(_cur_name(), want)
		var portal := _portal_to(hop) if hop != "" else null
		if portal == null:
			return [{"id": id, "type": "direct", "label": "%s — 길을 모름(%s)" % [label, want], "pos": Vector3.INF}]
		return [{"id": id + ":" + hop, "type": "go", "label": label, "portal": portal, "pos": portal.global_position}]
	return [{"id": id, "type": kind, "label": label, "pos": Vector3.INF}]


func busy() -> bool:
	var sc := _scn()
	return (sc != null and bool(sc.call("is_talking"))) or choice_open()


func pause_reason() -> String:
	var g: Array = goals()
	if not g.is_empty() and String(g[0].type) == "direct":
		return "직접 해야 하는 단계 — %s" % String(g[0].label)
	var p := _pl()
	if p != null and float(p.get("max_hp")) > 0.0 and float(p.get("hp")) / float(p.get("max_hp")) < LOW_HP:
		return "체력 낮음"
	return ""


func walk(dir: Vector3) -> void:
	var p := _pl()
	if p != null and "auto_x" in p:
		p.set("auto_x", 0.0 if absf(dir.x) < 0.05 else signf(dir.x))


## 옆보기 — x 만 본다
func walk_to(target: Vector3, arrive_m: float) -> bool:
	var p := _pl()
	if p == null:
		return false
	var dx := target.x - p.global_position.x
	if absf(dx) <= arrive_m:
		walk(Vector3.ZERO)
		return true
	walk(Vector3(signf(dx), 0, 0))
	return false


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
	match String(goal.type):
		"go":
			var portal := goal.get("portal") as Node3D
			if portal == null or not is_instance_valid(portal):
				return ""
			if walk_to(portal.global_position, ARRIVE_M):
				_press_t += dt
				if _press_t > 0.6:   # 문 영역에 들어선 뒤 눌렀다 뗌(0.6초마다)
					_press_t = 0.0
					_press("story_interact", true)   # 입력 이벤트로 — 다음 프레임 앞에서 처리돼 문(_process 의 just_pressed 폴링)이 받는다
					var up := InputEventAction.new()
					up.action = "story_interact"
					up.pressed = false
					get_tree().create_timer(0.15, true).timeout.connect(Callable(Input, "parse_input_event").bind(up))   # 나를 안 붙잡음(장면이 바뀌어 내가 지워져도 뗀다)
				return "문 여는 중"
			_press_t = 0.0
			return "문으로 — %s" % String(goal.label)
		"fight":
			var e := nearest_alive("story_enemy", FIGHT_R)
			if e == null:
				walk(Vector3.ZERO)
				return "적을 기다리는 중 — %s" % String(goal.label)
			if walk_to(e.global_position, HIT_R):
				var p := _pl()
				if p != null:
					var dx := e.global_position.x - p.global_position.x
					p.set("_facing", signf(dx) if absf(dx) > 0.01 else float(p.get("_facing")))
					p.call("auto_attack")
			return "싸우는 중 — %s" % String(goal.label)
	walk(Vector3.ZERO)
	return "기다리는 중 — %s" % String(goal.label)


func _press(action: String, down: bool) -> void:
	var ev := InputEventAction.new()
	ev.action = action
	ev.pressed = down
	Input.parse_input_event(ev)
