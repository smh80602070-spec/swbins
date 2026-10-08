extends Node
## G-0087 — 사가종횡 이야기 엔진. 사냥터(story_field.gd)·마을(story_town.gd) 장면마다 _ready 끝에 새로 붙는다(장면 바꿈 = 씬 다시 읽기).
## 진행은 autoload StorySaveState.scenario 에 있어 장면이 바뀌어도 이어진다. 표·규칙은 data/scenario.gd.
##   · 0.3초마다 지금 모습(레벨·장면 키·완수 사명·전직 차수)으로 단계를 넘기고, talk 단계면 공용 창(saga_core/ui/talk_box.gd)을 띄운다
##     (at 장면이 아니면 기다림, 선택 창[ui_modal]·멈춤 중이면 기다림).
##   · 처음 붙을 때 scenario 칸이 비었는데(또는 legacy 로 건너뛴 진행) 이미 그 장의 문턱(1부 Lv10·1차, 2부 Lv25·2차)을 지났으면 보상 없이 지나온 길로(웹 legacy).
##   · 장이 끝나면 경험치·금·알림, 저장(StorySaveState.save). 목표판 글은 objective()(ui/goal_board_feed.gd 가 그룹 story_scenario 로 찾는다).

const Scenario := preload("res://games/saga_story/data/scenario.gd")
const StoryCombat := preload("res://games/saga_story/data/story_combat.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const TalkBox := preload("res://saga_core/ui/talk_box.gd")

const CHECK_SEC := 0.3

var st: Dictionary = {}
var _layer: CanvasLayer
var _t := 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	add_to_group("story_scenario")
	var raw: Variant = StorySaveState.scenario
	var was_empty: bool = not (raw is Dictionary) or (raw as Dictionary).is_empty()
	st = Scenario.normalize(raw)
	var skipped := Scenario.apply_legacy(st, was_empty, StorySaveState.level, StoryCombat.job_tier(StorySaveState.job))
	if skipped > 0:
		Toast.show(get_parent(), "📜 이야기 %d장은 이미 지나온 길로 둔다." % skipped, 3.0)
	StorySaveState.scenario = st


func _process(delta: float) -> void:
	if _layer != null:
		return
	_t += delta
	if _t < CHECK_SEC:
		return
	_t = 0.0
	if get_tree().paused:
		return
	tick()


func tick() -> void:
	var ctx := context()
	_apply(Scenario.check(st, ctx))
	if _layer == null and Scenario.pending_scene(st, ctx) != "" and get_tree().get_nodes_in_group("ui_modal").is_empty():
		open_talk()


func context() -> Dictionary:
	var scene := get_tree().current_scene
	return {"level": StorySaveState.level, "stage": String(Scenario.SCENE_KEYS.get(String(scene.name) if scene != null else "", "")),
		"quests": StorySaveState.quests_done, "tier": StoryCombat.job_tier(StorySaveState.job), "champions": StorySaveState.weekly_champion_week.size()}


func objective() -> String:
	var names := {}
	for k in StoryCombat.QUESTS:
		names[k] = String(StoryCombat.QUESTS[k].name)
	return Scenario.objective(st, context(), names)


func is_talking() -> bool:
	return _layer != null


func _mentor_name() -> String:
	if StoryCombat.job_tier(StorySaveState.job) < 1:
		return ""
	return String(StoryCombat.mentor_of(StorySaveState.job).get("name", ""))


func _apply(results: Array) -> void:
	var changed := false
	for r: Dictionary in results:
		changed = true
		if r.has("chapter"):
			var ch: Dictionary = r.chapter
			StorySaveState.add_exp(int(ch.get("exp", 0)))
			StorySaveState.add_gold(int(ch.get("gold", 0)))
			Toast.show(get_parent(), "📜 %d부 %d장 「%s」 끝 — 경험치 +%d · 금 +%d" % [Scenario.part(ch), int(ch.no), String(ch.title), int(ch.exp), int(ch.gold)], 4.0)
	if changed:
		_save()


func _save() -> void:
	StorySaveState.scenario = st
	StorySaveState.save()


func open_talk() -> void:
	var scene := Scenario.pending_scene(st, context())
	if scene == "" or _layer != null:
		return
	var mentor := _mentor_name()
	var lines: Array = []
	for l: Array in Scenario.SCENES.get(scene, []):
		lines.append([Scenario.speaker(String(l[0]), mentor), String(l[1])])
	var ch := Scenario.chapter(st)
	_layer = TalkBox.open(get_parent(), "📜 %d부 %d장 · %s" % [Scenario.part(ch), int(ch.get("no", 0)), String(ch.get("title", ""))], lines, _on_talk_done)


func next_line() -> void:
	if _layer != null and is_instance_valid(_layer):
		_layer.call("next_line")


func _on_talk_done(_answer: String) -> void:
	_layer = null
	_apply(Scenario.finish_talk(st, context()))
	_save()
