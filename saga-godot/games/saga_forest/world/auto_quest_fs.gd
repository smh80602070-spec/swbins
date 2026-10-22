extends "res://saga_core/ui/auto_quest_hud.gd"

## G-0299 3마을 자동 퀘스트(웹 W-0338 ② auto-quest-fs 짝) — ▶ 를 누르면 이야기 단계를 대신 걷는다:
##   visit·fest 그 주민 곁 · spot 그 명소 곁 · rounds 아직 안 간 가장 가까운 주민 곁 · biome 그 바이옴의 가장 가까운 칸 · talk 이야기 창이 저절로 뜸(줄 넘김)
##   place·gather·heart·donate(가구·채집·하트·기증) — "직접 해야 하는 단계"로 멈춤. 고르기·주민 메뉴 창은 사람이 고를 때까지 기다림.
## 주민 곁(4m)에 서면 이야기 엔진(scenario_runner.context)이 저절로 단계를 넘긴다 — 여기선 걷기만. 자리 계산은 scenario_runner 와 같은 노드 경로·칸 식.

const Scenario := preload("res://games/saga_forest/data/scenario.gd")
const VillagerBuilder := preload("res://games/saga_forest/world/villager_builder.gd")
const ARRIVE_M := 2.5   # 엔진 판정 4m 보다 안쪽
const WALKS := ["visit", "fest", "spot", "rounds", "biome"]

var _village: Node = null


static func attach_fs(village: Node) -> Node:
	return attach(village, "res://games/saga_forest/world/auto_quest_fs.gd")


func _ready() -> void:
	game = "forest"
	btn_top = 340.0   # 제작대 [G] 글 밑(촬영)
	_village = get_parent()
	super._ready()


func _scn() -> Node:
	return _village.get_node_or_null("ScenarioRunner") if _village else null


func _node_pos(path: String) -> Vector3:
	var n := _village.get_node_or_null(path) as Node3D if _village else null
	return n.global_position if n else Vector3.INF


func _target(s: Dictionary, stv: Dictionary) -> Vector3:
	match String(s.get("t", "")):
		"visit", "fest":
			return _node_pos("Villager/Villager_" + String(s.npc))
		"spot":
			return _node_pos("Landmarks/Landmark_" + String(s.key))
		"rounds":
			var done: Array = stv.get("rounds", [])
			var best := Vector3.INF
			var bd := INF
			for v: Dictionary in VillagerBuilder.VILLAGERS:
				if done.has(String(v.id)):
					continue
				var p := _node_pos("Villager/Villager_" + String(v.id))
				var d := dist_to(p)
				if d < bd:
					bd = d
					best = p
			return best
		"biome":
			var sc := _scn()
			var w := int(sc.MAP_W)
			var h := int(sc.MAP_H)
			var best := Vector3.INF
			var bd := INF
			for gy in h:
				for gx in w:
					if String(ForestBiome.biome_at(gx, gy).get("key", "")) != String(s.key):
						continue
					var p := Vector3((gx - w / 2.0) * 3.0, 0.0, (gy - h / 2.0) * 3.0)
					var d := dist_to(p)
					if d < bd:
						bd = d
						best = p
			return best
	return Vector3.INF


func goals() -> Array:
	var sc := _scn()
	if sc == null:
		return []
	var stv: Dictionary = sc.get("st")
	var s: Dictionary = Scenario.step(stv)
	if s.is_empty():
		return []
	var t := String(s.get("t", ""))
	var id := "st:%s:%s:%d" % [stv.get("ch", 0), stv.get("step", 0), (stv.get("rounds", []) as Array).size()]
	var label := String(sc.call("objective"))
	if t == "talk":
		return [{"id": id, "type": "wait", "label": label, "pos": Vector3.INF}]
	if not WALKS.has(t):
		return [{"id": id, "type": "direct", "label": label, "pos": Vector3.INF}]
	return [{"id": id, "type": "walk", "label": label, "pos": _target(s, stv)}]


func busy() -> bool:
	var sc := _scn()
	return (sc != null and bool(sc.call("is_talking"))) or choice_open()


func pause_reason() -> String:
	var g: Array = goals()
	if g.is_empty():
		return ""
	if String(g[0].type) == "direct":
		return "직접 해야 하는 단계 — %s" % String(g[0].label)
	if String(g[0].type) == "walk" and (g[0].pos as Vector3) == Vector3.INF:
		return "자리를 모름 — %s" % String(g[0].label)
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
	if String(goal.type) == "walk":
		if not walk_to(goal.pos, ARRIVE_M):
			return "가는 중 %dm — %s" % [roundi(dist_to(goal.pos)), String(goal.label)]
		return "도착 — %s" % String(goal.label)
	walk(Vector3.ZERO)
	return "기다리는 중 — %s" % String(goal.label)
