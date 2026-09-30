extends Button

## "승진" 버튼 — officer.js promote()를 옮긴 것(2026-09-14, VERTICAL_SLICE_
## REALM.md 4절 "제외" 승진/관직 5단). realm_transfer_button.gd와 같은
## ChoicePrompt 패턴이되 1단(무장 고르기 하나로 끝난다 — promote()에 대상
## 성 같은 둘째 물음이 없다).

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const RealmGrowth := preload("res://games/saga_realm/data/realm_growth.gd")

const TOAST_SEC := 2.5


func _ready() -> void:
	text = "승진"
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	var layer_box := {}
	var choices: Array = []
	for id: String in RealmSaveState.roster:
		var h = Characters.find(id)
		var g: Dictionary = RealmSaveState.officer_growth.get(id, {"lv": 1, "rank": 0, "feats": 0})
		var rank := int(g.get("rank", 0))
		var cost := RealmGrowth.promote_cost(rank)
		choices.append({
			"label": "%s — %s Lv.%d (공 %d/%d) %s" % [
				String(h.name), RealmGrowth.rank_name(rank), int(g.get("lv", 1)),
				int(g.get("feats", 0)), int(cost.feats),
				RealmSaveState.officer_hint(id),
			],
			"cb": func() -> void: _run(id, layer_box),
		})
	if choices.is_empty():
		Toast.show(self, "승진시킬 무장이 없습니다", TOAST_SEC)
		return
	layer_box["layer"] = ChoicePrompt.build(self, "승진 — 누구를", choices)


func _run(officer_id: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var r := RealmSaveState.promote(officer_id)
	var h = Characters.find(officer_id)
	if not r.get("ok", false):
		Toast.show(self, "승진 — %s" % r.get("why", "실패"), TOAST_SEC)
		return
	Toast.show(self, "%s 을(를) %s(으)로 올렸다 — 충성 %d" % [
		String(h.name), String(r.name), int(r.loyal),
	], TOAST_SEC)
