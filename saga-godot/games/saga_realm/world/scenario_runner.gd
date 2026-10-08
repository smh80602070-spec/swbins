extends Node
## G-0088 — 사가천하 이야기 엔진(사건 카드). realm_city.gd 가 세이브를 불러온 뒤 붙인다. 표·규칙은 data/scenario.gd, 진행은 RealmSaveState.story.
##   · 0.3초마다: 시나리오를 고른 뒤(scenario_ready)·다른 창(ui_modal)이 없을 때, 다음 카드의 때(지난 달·성 수)가 되면 공용 창(saga_core/ui/talk_box.gd)으로 띄운다.
##     카드 글 한 장 + 고르기 셋(이름 — 효과). 고르면 효과(금·수도 군량/치안/훈련·책사 충성·이웃 우호)를 적용하고 결과 글을 알림으로.
##   · 그 카드에 단계가 있고 그 답을 골랐으면(첫 화친 → 화친) 설전 세 문답(RealmSaveState.debate_draw/debate_result)을 이어 띄운다.
##   · {책사} = roster 중 지력 으뜸(없으면 군주), {이웃} = 우리 성과 이웃한 세력 성의 군주(없으면 아무 세력 군주).
##   · 카드·설전이 끝날 때마다 저장(RealmSaveState.save — 플레이어 노드 필요 없음). 목표판 글은 objective().

const Scenario := preload("res://games/saga_realm/data/scenario.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const TalkBox := preload("res://saga_core/ui/talk_box.gd")
const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")
const Characters := preload("res://saga_core/data/characters.gd")

const CHECK_SEC := 0.3

var st: Dictionary = {}
var _busy := false
var _t := 0.0
var _debate_qs: Array = []
var _debate_picks: Array = []
var _debate_card := ""


func _ready() -> void:
	add_to_group("realm_scenario")
	st = Scenario.normalize(RealmSaveState.story)
	RealmSaveState.story = st


func _process(delta: float) -> void:
	_t += delta
	if _t < CHECK_SEC:
		return
	_t = 0.0
	tick()


func tick() -> void:
	if _busy or get_tree().paused or not RealmSaveState.scenario_ready:
		return
	if RealmSaveState.story != st:   # 새 시나리오(start_scenario 가 story 를 비움)·불러오기
		st = Scenario.normalize(RealmSaveState.story)
		RealmSaveState.story = st
	if not get_tree().get_nodes_in_group("ui_modal").is_empty():
		return
	if Scenario.due(st, months(), RealmSaveState.cities.size()):
		open_card()


func months() -> int:
	return Scenario.elapsed(RealmSaveState.scenario_id, RealmSaveState.year, RealmSaveState.month)


func objective() -> String:
	return Scenario.objective(st, months(), RealmSaveState.cities.size())


func is_busy() -> bool:
	return _busy


# ---------------------------------------------------------------- 칸

func strategist_id() -> String:
	var best := ""
	var best_v := -1.0
	for id in RealmSaveState.roster:
		var v: float = RealmSaveState._effective_stat(String(id), "wisdom")
		if v > best_v:
			best_v = v
			best = String(id)
	return best


## 이웃 세력 성 하나(그 세력·군주 칸에 쓴다). 없으면 "".
func neighbor_city() -> String:
	var fallback := ""
	for eid in RealmSaveState.enemies:
		var e: Dictionary = RealmSaveState.enemies[eid]
		if bool(e.get("captured", false)) or RealmSaveState.force_of(String(eid)) == "":
			continue
		if fallback == "":
			fallback = String(eid)
		for cid in RealmSaveState.cities:
			if RealmCities.is_adjacent(String(eid), String(cid)):
				return String(eid)
	return fallback


func names() -> Dictionary:
	var sid := strategist_id()
	var lord_id := sid if sid != "" else RealmSaveState.current_lord_id
	var nb := neighbor_city()
	return {"책사": _display(lord_id), "이웃": _display(RealmSaveState.lord_of(nb)) if nb != "" else "이웃 군주"}


static func _display(id: String) -> String:
	var h = Characters.find(id)
	return String(h.name) if h != null else id


func capital() -> String:
	if RealmSaveState.cities.has(RealmSaveState.current_city):
		return RealmSaveState.current_city
	for cid in RealmSaveState.cities:
		return String(cid)
	return ""


# ---------------------------------------------------------------- 효과

func apply_fx(fx: Array) -> void:
	var cap := capital()
	for f: Dictionary in fx:
		var n := int(f.get("n", 0))
		match String(f.t):
			"gold":
				RealmSaveState.gold = maxi(0, RealmSaveState.gold + n)
			"food", "sec", "train":
				if cap != "":
					var c: Dictionary = RealmSaveState.cities[cap]
					var v := int(c.get(String(f.t), 0)) + n
					c[String(f.t)] = maxi(0, v) if String(f.t) == "food" else clampi(v, 0, 100)
			"loyal":
				var sid := strategist_id()
				if sid != "":
					RealmSaveState.officer_loyal[sid] = clampi(int(RealmSaveState.officer_loyal.get(sid, 50)) + n, 0, 100)
			"rel":
				var nb := neighbor_city()
				var fid := RealmSaveState.force_of(nb) if nb != "" else ""
				if fid != "":
					var d: Dictionary = RealmSaveState.diplomacy.get(fid, {"relation": 40, "truce_months": 0})
					d.relation = clampi(int(d.get("relation", 40)) + n, 0, 100)
					RealmSaveState.diplomacy[fid] = d


func _save() -> void:
	RealmSaveState.story = st
	RealmSaveState.save()


# ---------------------------------------------------------------- 카드 창

func open_card() -> void:
	var c := Scenario.next_card(st)
	if c.is_empty() or _busy:
		return
	_busy = true
	var nm := names()
	var head := "%s %s" % [String(c.emoji), String(c.title)]
	var opts: Array = []
	for o: Dictionary in c.choices:
		opts.append({"key": String(o.k), "label": "%s — %s" % [String(o.label), String(o.hint)]})
	TalkBox.open(get_parent(), "📖 %s" % Scenario.ACT_NAMES.get(int(c.act), ""), [[head, Scenario.fill(String(c.text), nm)]], _on_card_pick,
		{"prompt": "어떻게 할 것인가", "options": opts})


func _on_card_pick(k: String) -> void:
	var nm := names()
	var r := Scenario.pick(st, k)
	var ch: Dictionary = r.get("choice", {})
	if ch.has("cost"):
		RealmSaveState.gold = maxi(0, RealmSaveState.gold - int(ch.cost))
	apply_fx(ch.get("fx", []))
	Toast.show(get_parent(), "📖 " + Scenario.fill(String(ch.get("text", "")), nm), 4.0)
	_save()
	var stage: Dictionary = r.get("stage", {})
	if String(stage.get("kind", "")) == "debate":
		_start_debate(String(Scenario.CARDS[int(st.next) - 1].id), stage, nm)
	else:
		_busy = false


func _start_debate(card_id: String, stage: Dictionary, nm: Dictionary) -> void:
	_debate_card = card_id
	_debate_qs = RealmSaveState.debate_draw(RealmSaveState.envoy_officer())
	_debate_picks = []
	TalkBox.open(get_parent(), "🗣️ " + String(stage.title), [["🗣️ " + String(stage.title), Scenario.fill(String(stage.intro), nm)]], _on_debate_intro)


func _on_debate_intro(_a: String) -> void:
	_ask(0)


func _ask(i: int) -> void:
	if i >= _debate_qs.size():
		_end_debate()
		return
	var q: Dictionary = _debate_qs[i]
	var opts: Array = []
	var idx := 0
	for text in q.get("choices", []):
		opts.append({"key": str(idx), "label": String(text)})
		idx += 1
	TalkBox.open(get_parent(), "🗣️ 설전 %d/%d" % [i + 1, _debate_qs.size()], [["🗣️ 문답 %d" % (i + 1), String(q.get("q", ""))]],
		func(a: String) -> void:
			_debate_picks.append(int(a))
			_ask(i + 1), {"prompt": "", "options": opts})


## 설전 답(점검이 바로 부른다 — 창 없이).
func answer_debate(picks: Array) -> Dictionary:
	_debate_picks = picks
	return _end_debate()


func _end_debate() -> Dictionary:
	var res: Dictionary = RealmSaveState.debate_result(_debate_qs, _debate_picks)
	var out := Scenario.debate_outcome(st, _debate_card, int(res.get("correct", 0)))
	apply_fx(out.get("fx", []))
	Toast.show(get_parent(), "🗣️ 설전 %d/3 — %s" % [int(res.get("correct", 0)), Scenario.fill(String(out.get("text", "")), names())], 4.0)
	_save()
	_busy = false
	return out
