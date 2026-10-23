extends Button

## G-0333 문파 입구 — ☰ 메뉴 「🏯 문파」. 공용 선택 창: 들었으면 단계·공·오늘 의뢰 사냥터·나가기, 안 들었으면 셋 중 들기.
## realm_trade_button.gd 와 같은 꼴(창을 닫고 다시 연다). 규칙은 data/story_guild.gd.

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Guild := preload("res://games/saga_story/data/story_guild.gd")
const Scenario := preload("res://games/saga_story/data/scenario.gd")

var _layer: CanvasLayer = null


func _ready() -> void:
	text = "🏯 문파"
	focus_mode = Control.FOCUS_NONE
	add_to_group("story_guild")
	pressed.connect(open_screen)


func _close() -> void:
	if _layer != null and is_instance_valid(_layer):
		_layer.queue_free()
	_layer = null


func lines() -> Array:
	var S: Object = StorySaveState
	var out: Array = []
	var gid := Guild.joined(S)
	if gid != "":
		var h := Guild.hunt_today(gid, Guild.day_key())
		out.append({"act": "", "label": Guild.rank_text(S)})
		out.append({"act": "", "label": "📋 오늘의 문파 의뢰 — %s에서 잡으면 공 두 배(보스 +%d)" % [String(Scenario.STAGE_NAMES.get(h, h)), Guild.BOSS_PTS]})
		out.append({"act": "leave", "label": "🚪 문파를 나간다 — 공이 0 으로"})
	else:
		for k: String in Guild.ORDER:
			var g: Dictionary = Guild.GUILDS[k]
			out.append({"act": "join:" + k, "label": "%s %s(%s)에 든다 — 단계마다 %s +%d%%(최고 +%d%%)" % [g.emoji, g.name, g.hanja, g.fx_name, int(Guild.STEP_PCT), int(Guild.STEP_PCT * (Guild.RANKS.size() - 1))]})
	return out


func open_screen() -> bool:
	_close()
	if not Guild.on():
		return false
	var choices: Array = []
	for l: Dictionary in lines():
		var act := String(l.act)
		choices.append({"label": String(l.label), "cb": func() -> void: _act(act)})
	choices.append({"label": "닫기", "cb": _close})
	_layer = ChoicePrompt.build(get_tree().current_scene, "🏯 문파 — 공은 처치로 쌓인다 · 단계 입문·제자·사형·장로·부문주·문주", choices)
	return true


func _act(act: String) -> void:
	if act.begins_with("join:"):
		var e := Guild.join(StorySaveState, act.substr(5))
		Toast.show(self, ("🏯 %s에 들었다" % String(Guild.GUILDS[act.substr(5)].name)) if e == "" else e, 2.5)
	elif act == "leave":
		Guild.leave(StorySaveState)
		Toast.show(self, "🚪 문파를 나왔다", 2.0)
	open_screen()
