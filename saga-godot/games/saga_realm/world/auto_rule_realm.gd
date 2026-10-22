extends "res://saga_core/ui/auto_quest_hud.gd"

## G-0299 5천하 시정 위임(웹 W-0338 ④ auto-rule.js 짝, 목표 하나 🌾 개발) — 퀘스트가 없는 턴제라 "자동 퀘스트" 대신
## ▶ 를 켜 두면 달마다 한 번, 내 성마다 놀고 있는 무장에게 개발 명령을 대신 낸다: 치안 45 밑이면 치안 먼저, 아니면 개간·상업·기술·치안 중
## 상한 대비 가장 모자란 것. 금은 켠 순간의 금과 RESERVE 중 작은 것 밑으로 안 쓴다. 다음 달 넘기기는 사람 몫(위임은 명령만).
## 규칙은 공개 함수만: RealmSaveState.execute_order(current_city 를 잠깐 바꿔 부르고 되돌림)·RealmOrders.cap_of·cities.
## 멈춤: ▶ 다시 누름 · 승부가 남 · 내 성이 없음. 같은 공용 몸(auto_quest_hud) — 한 박자 = 한 달.

const RealmOrders := preload("res://games/saga_realm/data/realm_orders.gd")
const DEV := ["agri", "comm", "tech", "sec"]
const SEC_FIRST := 45
const RESERVE := 900
const MAX_PER_CITY := 6   # 한 성 한 달 명령 상한(무장 수만큼이지만 무한 되풀이 막기)

var _done_key := ""
var _keep_gold := 0
var _last_n := 0


static func attach_rl(city: Node) -> Node:
	return attach(city, "res://games/saga_realm/world/auto_rule_realm.gd")


func _ready() -> void:
	game = "realm"
	btn_top = 300.0
	super._ready()
	_btn.text = "▶ 시정 위임(개발)"


func _refresh() -> void:
	super._refresh()
	if _btn != null:
		_btn.text = "⏸ 위임 멈춤" if q.on else "▶ 시정 위임(개발)"


func toggle() -> bool:
	if not q.on:
		_keep_gold = mini(RESERVE, int(RealmSaveState.gold))
		_done_key = ""
	return super.toggle()


func _month_key() -> String:
	return "%d-%02d" % [int(RealmSaveState.year), int(RealmSaveState.month)]


func goals() -> Array:
	if not String(RealmSaveState.result).is_empty() or (RealmSaveState.cities as Dictionary).is_empty():
		return []
	return [{"id": "rule", "type": "rule", "label": "🌾 개발", "pos": Vector3.INF}]


func pos() -> Variant:
	return null   # 걷기 없음 — 막힘을 안 센다


func busy() -> bool:
	return true


## 이 성에 낼 개발 명령 하나(순수 — 상태를 안 바꾼다)
static func pick_for(city: Dictionary, city_id: String) -> String:
	if int(city.get("sec", 0)) < SEC_FIRST:
		return "sec"
	var best := ""
	var br := INF
	for k in DEV:
		var cap := float(RealmOrders.cap_of(k, city_id))
		if cap <= 0.0:
			continue
		var r := float(city.get(k, 0)) / cap
		if r < br and r < 1.0:
			br = r
			best = k
	return best


func run(_goal: Dictionary, _dt: float) -> String:
	if choice_open():
		return "창이 닫히길 기다림"
	var mk := _month_key()
	if mk == _done_key:
		return "%s 명령 %d개 — 다음 달을 기다림" % [mk, _last_n]
	_done_key = mk
	_last_n = assign_month()
	return "%s 명령 %d개" % [mk, _last_n]


## 이번 달 — 내 성마다 놀고 있는 무장이 있는 동안 개발 명령. 낸 수.
func assign_month() -> int:
	var keep_city: String = RealmSaveState.current_city
	var n := 0
	for cid in (RealmSaveState.cities as Dictionary).keys():
		RealmSaveState.current_city = String(cid)
		for _i in MAX_PER_CITY:
			var k := pick_for(RealmSaveState.cities[cid], String(cid))
			if k == "" or int(RealmSaveState.gold) - int(RealmOrders.by_key(k).get("gold", 0)) < _keep_gold:
				break
			var r: Dictionary = RealmSaveState.execute_order(k)
			if not bool(r.get("ok", false)):
				break
			n += 1
	RealmSaveState.current_city = keep_city
	return n
