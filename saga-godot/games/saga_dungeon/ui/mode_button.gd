extends Button

## G-0247 「⚖️ 난도」 — sigil_button.gd 와 같은 경계(HUD 단추 하나 + ChoicePrompt).
## 웹은 굴혈 앞 난도 고르기, 이 슬라이스엔 허브가 없어 단추로 근사했다. 열린 난도만
## 고를 수 있고(data/dungeon_mode.gd 문턱), 이번 회차는 굳은 값 그대로 — 고른 값은
## 다음 회차(던전을 다시 열 때)부터. 저장은 바로(다음에 켜도 남게).

const DungeonMode := preload("res://games/saga_dungeon/data/dungeon_mode.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")


func _ready() -> void:
	pressed.connect(_on_pressed)
	_refresh_look()


func _refresh_look() -> void:
	text = "⚖️%s" % String(DungeonMode.mode().name).left(1)


func _on_pressed() -> void:
	var best := DungeonMode.best_rooms()
	var cur: Dictionary = DungeonMode.mode()
	var choices: Array = []
	for m: Dictionary in DungeonMode.MODES:
		var key := String(m.key)
		var open := best >= int(m.need)
		var mark := "▶ " if key == DungeonMode.chosen else ""
		var label := "%s%s — %s" % [mark, String(m.name), String(m.desc)] if open else "🔒 %s — 방 %d개를 깨면 열린다" % [String(m.name), int(m.need)]
		choices.append({"label": label, "cb": func() -> void: _pick(key)})
	choices.append({"label": "그만둔다", "cb": func() -> void: pass})
	ChoicePrompt.build(get_tree().current_scene,
		"⚖️ 난도 — 이번 회차 %s(바꾸면 다음 회차부터)\n적 체력·공격·저항이 오르고 금·노획 등급이 좋아진다." % String(cur.name), choices)


func _pick(key: String) -> void:
	if not DungeonMode.set_mode(key):
		Toast.show(self, "🔒 아직 닫힌 난도 — 방을 더 깨야 한다.", 3.0)
		return
	var player: Node3D = get_tree().get_first_node_in_group("player")
	if player != null:
		DungeonSaveState.save(player)
	var m := DungeonMode.mode_of(key)
	if DungeonMode.in_run() and DungeonMode.run_mode != key:
		Toast.show(self, "⚖️ %s — 다음 회차부터(이번 회차는 %s)." % [String(m.name), String(DungeonMode.mode().name)], 4.0)
	else:
		Toast.show(self, "⚖️ %s" % String(m.name), 3.0)
	_refresh_look()
