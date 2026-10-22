extends "res://saga_core/ui/auto_quest_hud.gd"

## G-0299·G-0300 5천하 시정 위임(웹 W-0338 ④ auto-rule.js 짝) — 퀘스트가 없는 턴제라 "자동 퀘스트" 대신
## 목표 하나(🌾 개발·🛡️ 징병·📜 외교·🚩 출진)를 골라 ▶ 를 켜 두면 달마다 한 번, 내 성마다 놀고 있는 무장에게 명령을 대신 낸다.
##   늘 먼저: 치안 45 밑이면 치안 · 군량이 석 달치 밑이면 개간 · 이웃 적 병력이 우리 병력 8할을 넘으면 징병(인구 6%)·축성·훈련(웹 비상선)
##   🌾 개발 — 개간·상업·기술·치안 중 상한 대비 가장 모자란 것
##   🛡️ 징병 — 징병 → 훈련 85 → 축성 · 🚩 출진 — 같은 순서(훈련 95)에 병력 8,000 넘고 칠 만한 성이 있으면 **확인 카드**(눌러야 공격 창)
##   📜 외교 — 달마다 사신 한 번(가장 센 이웃 세력에 화친 — envoy_truce), 남은 무장은 개발
## 금: 켠 때의 금과 RESERVE 중 큰 것이 바닥, 그 위로 쌓인 몫의 절반만 이 달에 쓴다(웹 12달 진단 — 곳간을 비우지 않게).
## 규칙은 공개 함수만: RealmSaveState.execute_order(current_city 를 잠깐 바꿔 부르고 되돌림)·envoy_truce·attack_check·RealmOrders.cap_of·food_upkeep.
## 다음 달 넘기기는 사람 몫. 고른 목표는 이 판을 켜 둔 동안만(static — 세이브 안 건드림). 한 박자 = 한 달.

const RealmOrders := preload("res://games/saga_realm/data/realm_orders.gd")
const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")
const RealmTech := preload("res://games/saga_realm/data/realm_tech.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const GOALS := [
	{"key": "dev", "emoji": "🌾", "name": "개발"},
	{"key": "draft", "emoji": "🛡️", "name": "징병"},
	{"key": "diplo", "emoji": "📜", "name": "외교"},
	{"key": "war", "emoji": "🚩", "name": "출진"},
]
const DEV := ["agri", "comm", "tech", "sec"]
const SEC_FIRST := 45
const RESERVE := 900
const MAX_PER_CITY := 8   # 한 성 한 달 명령 상한(웹 guard 8)
const WAR_TROOPS := 8000   # 출진 카드 병력선(웹 warCard)
const WAR_RATIO := 1.5     # 출진 성 병력 ÷ 목표 병력 — 이만큼은 넘어야 "칠 만한 성"

static var goal_key := "dev"

var _done_key := ""
var _floor := 0
var _last_n := 0
var _envoy_key := ""
var _last_note := ""
var _chips: HBoxContainer


static func attach_rl(city: Node) -> Node:
	return attach(city, "res://games/saga_realm/world/auto_rule_realm.gd")


func _ready() -> void:
	game = "realm"
	btn_top = 300.0
	super._ready()
	_info.offset_top = btn_top + 84.0
	_info.offset_bottom = btn_top + 110.0
	_chips = HBoxContainer.new()
	_chips.name = "RuleGoals"
	_chips.anchor_left = 1.0
	_chips.anchor_right = 1.0
	_chips.offset_left = -300.0
	_chips.offset_right = -12.0
	_chips.offset_top = btn_top + 44.0
	_chips.offset_bottom = btn_top + 80.0
	_chips.alignment = BoxContainer.ALIGNMENT_END
	_chips.add_theme_constant_override("separation", 4)
	for g: Dictionary in GOALS:
		var b := Button.new()
		b.name = "Goal_" + String(g.key)
		b.focus_mode = Control.FOCUS_NONE
		b.toggle_mode = true
		b.tooltip_text = "%s 위임" % g.name
		b.add_theme_font_size_override("font_size", 15)
		if _btn.theme != null:
			b.theme = _btn.theme
		var k := String(g.key)
		b.pressed.connect(func() -> void: set_goal(k))
		_chips.add_child(b)
	add_child(_chips)
	_refresh()


static func goal_def(k: String) -> Dictionary:
	for g: Dictionary in GOALS:
		if String(g.key) == k:
			return g
	return GOALS[0]


func set_goal(k: String) -> String:
	goal_key = String(goal_def(k).key)
	_done_key = ""   # 목표를 바꾸면 이 달에도 새 목표로 한 번 더 본다(이미 쓴 무장은 execute_order 가 거른다)
	_refresh()
	return goal_key


func _refresh() -> void:
	super._refresh()
	if _btn != null:
		var g := goal_def(goal_key)
		_btn.text = "⏸ 위임 멈춤" if q.on else "▶ 시정 위임(%s %s)" % [g.emoji, g.name]
	if _chips != null:
		for b: Button in _chips.get_children():
			var g := goal_def(String(b.name).trim_prefix("Goal_"))
			var cur := String(g.key) == goal_key
			b.set_pressed_no_signal(cur)
			b.text = ("%s %s" % [g.emoji, g.name]) if cur else String(g.emoji)


func toggle() -> bool:
	if not q.on:
		_floor = maxi(RESERVE, int(RealmSaveState.gold))
		_done_key = ""
	return super.toggle()


func _month_key() -> String:
	return "%d-%02d" % [int(RealmSaveState.year), int(RealmSaveState.month)]


func goals() -> Array:
	if not String(RealmSaveState.result).is_empty() or (RealmSaveState.cities as Dictionary).is_empty():
		return []
	var g := goal_def(goal_key)
	return [{"id": "rule:" + String(g.key), "type": "rule", "label": "%s %s 위임" % [g.emoji, g.name], "pos": Vector3.INF}]


func pos() -> Variant:
	return null   # 걷기 없음 — 막힘을 안 센다


func busy() -> bool:
	return true


## 이 성 이웃 적 성 중 가장 큰 병력(웹 rtkAI.threatAt — 함락한 곳·우리 성은 빼고)
static func threat_at(city_id: String) -> int:
	var worst := 0
	for eid: String in (RealmSaveState.enemies as Dictionary).keys():
		var e: Dictionary = RealmSaveState.enemies[eid]
		if bool(e.get("captured", false)) or not RealmCities.is_adjacent(city_id, eid):
			continue
		worst = maxi(worst, int(e.get("troops", 0)))
	return worst


## 이 성에 이 목표로 낼 명령 하나(순수 — 상태를 안 바꾼다). threat = threat_at(city_id)(점검이 넣어 볼 수 있게 밖에서 받음).
static func pick_for(goal: String, city: Dictionary, city_id: String, threat: int = 0) -> String:
	var cap := func(k: String) -> int: return maxi(1, RealmOrders.cap_of(k, city_id))
	if int(city.get("sec", 0)) < SEC_FIRST:
		return "sec"
	var troops := int(city.get("troops", 0))
	if int(city.get("food", 0)) < RealmOrders.food_upkeep(troops) * 3 and int(city.get("agri", 0)) < int(cap.call("agri")):
		return "agri"
	var draft_room := troops < floori(float(city.get("pop", 0)) * 0.06) - 50
	var wall_room := int(city.get("wall", 0)) < int(cap.call("wall"))
	if float(threat) > float(troops) * 0.8:
		if draft_room:
			return "draft"
		if wall_room:
			return "wall"
		if int(city.get("train", 0)) < 90:
			return "train"
	if goal == "draft" or goal == "war":
		if draft_room:
			return "draft"
		if int(city.get("train", 0)) < (95 if goal == "war" else 85):
			return "train"
		if wall_room:
			return "wall"
	var best := "agri"
	var br := 2.0
	for k: String in DEV:
		var r := float(city.get(k, 0)) / float(cap.call(k))
		if r < br:
			br = r
			best = k
	return best


func run(_goal: Dictionary, _dt: float) -> String:
	if choice_open():
		return "창이 닫히길 기다림"
	var mk := _month_key()
	if mk == _done_key:
		return "%s 명령 %d개%s — 다음 달을 기다림" % [mk, _last_n, _last_note]
	_done_key = mk
	_last_note = ""
	_last_n = assign_month()
	if goal_key == "war":
		war_card()
	if _last_n == 0 and int(RealmSaveState.gold) <= _floor:
		_last_note += " · 금이 바닥선 %d 위로 쌓이면 씀" % _floor
	return "%s 명령 %d개%s" % [mk, _last_n, _last_note]


## 이번 달 — (외교면 사신 한 번) 내 성마다 놀고 있는 무장이 있는 동안 목표대로 명령. 낸 수.
func assign_month() -> int:
	var gold := int(RealmSaveState.gold)
	var keep := gold - int(maxi(0, gold - _floor) * 0.5)
	var n := 0
	if goal_key == "diplo" and _envoy_key != _month_key():
		_envoy_key = _month_key()
		var to := envoy_target()
		if to != "" and gold - RealmSaveState.ENVOY_GOLD - RealmSaveState.ENVOY_FEE >= keep:
			var r: Dictionary = RealmSaveState.envoy_truce(to)
			if bool(r.get("ok", false)):
				n += 1
				_last_note = " · 📜 %s 화친 %s" % [_enemy_name(to), "받아들임" if bool(r.get("accepted", false)) else "사양"]
	var keep_city: String = RealmSaveState.current_city
	for cid in (RealmSaveState.cities as Dictionary).keys():
		RealmSaveState.current_city = String(cid)
		var th := threat_at(String(cid))
		for _i in MAX_PER_CITY:
			var k := pick_for(goal_key, RealmSaveState.cities[cid], String(cid), th)
			var o: Dictionary = RealmOrders.by_key(k)
			if int(RealmSaveState.gold) - RealmTech.cost(k, int(o.get("gold", 0))) < keep:
				break
			var r: Dictionary = RealmSaveState.execute_order(k)
			if not bool(r.get("ok", false)):
				break
			n += 1
	RealmSaveState.current_city = keep_city
	return n


## 화친을 청할 상대 — 맹약 없는 이웃 적 성 중 병력이 가장 큰 곳(그 세력이 가장 무섭다). 없으면 "".
func envoy_target() -> String:
	var best := ""
	var bt := -1
	for eid: String in (RealmSaveState.enemies as Dictionary).keys():
		var e: Dictionary = RealmSaveState.enemies[eid]
		if bool(e.get("captured", false)):
			continue
		if int((RealmSaveState.diplomacy.get(RealmSaveState.force_of(eid), {}) as Dictionary).get("truce_months", 0)) > 0:
			continue
		var near := false
		for cid: String in (RealmSaveState.cities as Dictionary).keys():
			if RealmCities.is_adjacent(cid, eid):
				near = true
				break
		if near and int(e.get("troops", 0)) > bt:
			bt = int(e.get("troops", 0))
			best = eid
	return best


## 칠 만한 성 — attack_check 가 통과하고 출진 성 병력이 목표의 WAR_RATIO 배를 넘는 곳 중 그 배수가 가장 큰 곳. 없으면 "".
func war_target() -> String:
	var best := ""
	var br := WAR_RATIO
	for eid: String in (RealmSaveState.enemies as Dictionary).keys():
		if RealmSaveState.attack_check(eid) != "":
			continue
		var from := String(RealmCities.enemy_by_id(eid).get("from_city", ""))
		var r := float(RealmSaveState.cities[from].troops) / float(maxi(1, int(RealmSaveState.enemies[eid].get("troops", 0))))
		if r >= br:
			br = r
			best = eid
	return best


## 출진 확인 카드 — 위임이 저절로 싸움을 걸지 않는다. "출진" = 공격 단추를 눌러 준다(목표·일기토·전술판은 사람이 고름).
func war_card() -> bool:
	var total := 0
	for cid in (RealmSaveState.cities as Dictionary).keys():
		total += int(RealmSaveState.cities[cid].troops)
	if total < WAR_TROOPS:
		return false
	var to := war_target()
	if to == "":
		_last_note = " · 🚩 칠 만한 성 없음"
		return false
	var atk := get_tree().current_scene.find_child("AttackButton", true, false) as Button if get_tree().current_scene else null
	var box := {}
	box["layer"] = ChoicePrompt.build(self, "🚩 병력 %d — %s, 칠 만합니다. 출진할까요?" % [total, _enemy_name(to)], [
		{"label": "🚩 출진(공격 창을 연다)", "cb": func() -> void:
			(box["layer"] as CanvasLayer).queue_free()
			if atk != null:
				atk.emit_signal("pressed")},
		{"label": "이번 달 아님", "cb": func() -> void: (box["layer"] as CanvasLayer).queue_free()},
	])
	_last_note = " · 🚩 %s 출진 물음" % _enemy_name(to)
	return true


func _enemy_name(eid: String) -> String:
	return String(RealmCities.enemy_by_id(eid).get("name", eid))
