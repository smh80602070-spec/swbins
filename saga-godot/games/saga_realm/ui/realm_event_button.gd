extends Button

## PLAN 101-2 REALM ⑤후보(웹판 §5-2 "관계·이벤트 체인") — realm_promote_
## button.gd와 같은 ChoicePrompt 패턴이되 2단(대기 중인 카드 고르기 →
## 그 카드의 선택지 3개 고르기)이다. `RealmSaveState.ready_events()`가
## 빈 배열이면 "대기 중인 이벤트가 없습니다"만 띄운다(다른 버튼들과 같은
## 결 — 새 빈 상태 UI를 안 만든다).

const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const RealmEvents := preload("res://games/saga_realm/data/realm_events.gd")
const RealmNews := preload("res://games/saga_realm/data/realm_news.gd")   # G-0194 영내 소식
const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")
const RealmTraits := preload("res://games/saga_realm/data/realm_traits.gd")

const TOAST_SEC := 2.5


func _ready() -> void:
	text = "사건"
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	var ready: Array[int] = RealmSaveState.ready_events()
	var news: Array = RealmSaveState.news
	if ready.is_empty() and news.is_empty():
		Toast.show(self, "대기 중인 사건이 없습니다", TOAST_SEC)
		return
	var layer_box := {}
	var choices: Array = []
	## G-0194 — 영내 소식이 먼저(성 이름 · 소식)
	for ni in news.size():
		var n: Dictionary = news[ni]
		var nd := RealmNews.by_key(String(n.id))
		choices.append({
			"label": "📰 %s — %s %s" % [_city_name(String(n.city)), String(nd.get("emoji", "")), String(nd.get("name", ""))],
			"cb": func() -> void: _open_news(ni, layer_box),
		})
	for idx: int in ready:
		var e: Dictionary = RealmSaveState.active_events[idx]
		var def := RealmEvents.by_key(String(e.id))
		var h = Characters.find(String(e.officer))
		var name_text := String(h.name) if h != null else String(e.officer)
		choices.append({
			"label": "%s %s — %s" % [String(def.get("emoji", "📜")), name_text, String(def.get("name", ""))],
			"cb": func() -> void: _open_card(idx, layer_box),
		})
	layer_box["layer"] = ChoicePrompt.build(self, "사건 — 어느 것을", choices)


func _open_card(index: int, outer_box: Dictionary) -> void:
	(outer_box["layer"] as CanvasLayer).queue_free()
	if index < 0 or index >= RealmSaveState.active_events.size():
		return
	var e: Dictionary = RealmSaveState.active_events[index]
	var def := RealmEvents.by_key(String(e.id))
	if def.is_empty():
		return
	var h = Characters.find(String(e.officer))
	var name_text := String(h.name) if h != null else String(e.officer)
	var card_box := {}
	var choices: Array = []
	var opts: Array = def.get("choices", [])
	for i in opts.size():
		var c: Dictionary = opts[i]
		choices.append({
			"label": String(c.label),
			"cb": func() -> void: _resolve(index, i, card_box),
		})
	card_box["layer"] = ChoicePrompt.build(self, String(def.text) % name_text, choices)


func _city_name(cid: String) -> String:
	return String(RealmCities.any_by_id(cid).get("name", cid))


## G-0194 — 소식 카드: 성·소식 글 + 태수 한 줄(호전이면 거친 말) + 세 갈래(금 / 병 / 민심)
func _open_news(index: int, outer_box: Dictionary) -> void:
	(outer_box["layer"] as CanvasLayer).queue_free()
	if index < 0 or index >= RealmSaveState.news.size():
		return
	var n: Dictionary = RealmSaveState.news[index]
	var d := RealmNews.by_key(String(n.id))
	var gov := String(n.get("gov", ""))
	var h = Characters.find(gov) if gov != "" else null
	var who := String(h.name) if h != null else "고을 아전"
	var line := RealmNews.line_of(String(n.id), gov != "" and RealmTraits.has_trait(gov, "militant"))
	var title := "%s %s — %s
%s: “%s”" % [String(d.get("emoji", "📰")), String(d.get("name", "")), String(d.get("text", "%s")) % _city_name(String(n.city)), who, line]
	var card_box := {}
	var choices: Array = []
	var opts: Array = d.get("choices", [])
	for i in opts.size():
		choices.append({
			"label": "%s (%s)" % [String(opts[i].label), RealmNews.AXES[i]],
			"cb": func() -> void:
				(card_box["layer"] as CanvasLayer).queue_free()
				RealmSaveState.resolve_news(index, i),
		})
	card_box["layer"] = ChoicePrompt.build(self, title, choices)


func _resolve(index: int, choice_idx: int, card_box: Dictionary) -> void:
	(card_box["layer"] as CanvasLayer).queue_free()
	RealmSaveState.resolve_event(index, choice_idx)
