extends RefCounted

## G-0232 3마을 동반자 — 관계 하트 끝에 함께 살기(웹 W-0288 partner.js 이식).
##   청하기   하트 10 + 표시 물건(교배꽃 한 송이 — 웹의 ❤️ 홍매 자리)을 곁에서 건넨다 → 승낙. 한 명만.
##   헤어지기 그 사람 하트 절반(내림).
##   아침     날이 바뀌고 처음 마을에 들면 하루 한 가지(날짜 해시) — 뜰 손질·아침밥·선물(좋아하는 갈래).
##            3D 마을엔 잡초·경험치가 없어 뜰 손질 = 떨어진 솔방울 둘 주워 옴 · 아침밥 = 금 +20 으로 바꿨다.
##   기념일   함께 산 지 30일마다 — 그날 말을 걸면 기념 대사, 금 300(그날 한 번).
##   집 안    forest_house.gd 가 방 오른쪽 벽 곁에 그 주민 몸 + 말풍선.
##   저장     ForestSaveState.partner = {id, since, last, anniv_day}(날 = ForestDay.epoch_day_index) — 순수 추가 칸.
## 3D 마을엔 이사(하트≤2 떠남) 판정이 없어(forest_save_state.gd 56행) 동반자와 겹칠 일이 없다.

const TOKEN := "교배꽃"
const ANNIV_DAYS := 30
const ANNIV_GOLD := 300
const MEAL_GOLD := 20
const TIDY_ITEM := "솔방울"
const TIDY_N := 2
const MORNING := ["tidy", "meal", "gift"]


static func villager(id: String) -> Dictionary:
	for v: Dictionary in load("res://games/saga_forest/world/villager_builder.gd").VILLAGERS:   # villager_builder 가 이 파일을 preload 해 맞물림을 피한다
		if String(v.id) == id:
			return v
	return {}


static func name_of(id: String) -> String:
	return String(villager(id).get("name", id))


static func partner_id() -> String:
	return String(ForestSaveState.partner.get("id", ""))


static func can_propose(id: String) -> Dictionary:
	if partner_id() != "":
		return {"ok": false, "why": "이미 %s 와(과) 함께 산다 — 한 사람뿐이다" % name_of(partner_id())}
	if ForestSaveState.heart(id) < 10:
		return {"ok": false, "why": "하트가 가득 차야 청할 수 있다 (💗 %d/10)" % ForestSaveState.heart(id)}
	if ForestSaveState.item_count(TOKEN) < 1:
		return {"ok": false, "why": "🌺 %s 한 송이가 있어야 마음을 전할 수 있다" % TOKEN}
	return {"ok": true, "why": ""}


## 곁의 주민에게 교배꽃을 건네며 청한다 — {ok, text}.
static func propose(id: String) -> Dictionary:
	var c := can_propose(id)
	if not bool(c.ok):
		return {"ok": false, "text": String(c.why)}
	ForestSaveState.items[TOKEN] = ForestSaveState.item_count(TOKEN) - 1
	var today := ForestDay.epoch_day_index()
	ForestSaveState.partner = {"id": id, "since": today, "last": today, "anniv_day": -1}
	return {"ok": true, "text": "%s — 🌺 이 꽃을... 내게? 좋소, 그대 곁에서 살겠소. 💞 (아침마다 한 가지를 거들어 드리리다)" % name_of(id)}


static func break_up() -> Dictionary:
	var id := partner_id()
	if id == "":
		return {"ok": false, "text": "함께 사는 이가 없다"}
	var h := int(floor(ForestSaveState.heart(id) / 2.0))
	ForestSaveState.affinity[id] = h
	ForestSaveState.partner = {}
	return {"ok": true, "text": "%s — ...그렇구려. 그동안 고마웠소. 💔 (💗 %d/10)" % [name_of(id), h]}


static func morning_kind(day: int) -> String:
	var h := absi(day * 7331 + 17) % 9973
	return MORNING[h % MORNING.size()]


static func lived_days() -> int:
	return ForestDay.epoch_day_index() - int(ForestSaveState.partner.get("since", 0))


static func is_anniversary() -> bool:
	if partner_id() == "":
		return false
	var l := lived_days()
	return l > 0 and l % ANNIV_DAYS == 0


## 날이 바뀌고 처음 — 한 가지 거든다. 한 일 {kind, text}, 이미 했거나 동반자가 없으면 {}.
static func on_new_day() -> Dictionary:
	var id := partner_id()
	if id == "":
		return {}
	var today := ForestDay.epoch_day_index()
	if int(ForestSaveState.partner.get("last", -1)) == today:
		return {}
	ForestSaveState.partner["last"] = today
	var kind := morning_kind(today)
	var nm := name_of(id)
	var text := ""
	match kind:
		"tidy":
			ForestSaveState.add_item(TIDY_ITEM, TIDY_N)
			text = "🌿 %s 이(가) 아침에 뜰을 손질했다 (%s %d)" % [nm, TIDY_ITEM, TIDY_N]
		"meal":
			ForestSaveState.add_gold(MEAL_GOLD)
			text = "🍚 %s 이(가) 아침밥을 차려 주었다 (💰 +%d)" % [nm, MEAL_GOLD]
		_:
			var like := String(villager(id).get("gift_like", "과일"))
			ForestSaveState.add_item(like, 1)
			text = "🎁 %s 이(가) %s 하나를 건넸다" % [nm, like]
	if is_anniversary():
		text += " · 💞 함께 산 지 %d일" % lived_days()
	return {"kind": kind, "text": text}


## 말 걸기 — 기념일이면 기념 대사(그날 한 번 금 300), 아니면 "".
static func anniversary_line(id: String) -> String:
	if partner_id() != id or not is_anniversary():
		return ""
	var today := ForestDay.epoch_day_index()
	if int(ForestSaveState.partner.get("anniv_day", -1)) == today:
		return "%s — 💞 오늘로 %d일이구려. 내일도 함께하오." % [name_of(id), lived_days()]
	ForestSaveState.partner["anniv_day"] = today
	ForestSaveState.add_gold(ANNIV_GOLD)
	return "%s — 💞 함께 산 지 %d일째요. 그날 받은 🌺 %s 를 아직 간직하고 있소. (💰 +%d)" % [name_of(id), lived_days(), TOKEN, ANNIV_GOLD]


static func bubble_text() -> String:
	return "💞 오늘이 그날이오" if is_anniversary() else "다녀왔소?"
