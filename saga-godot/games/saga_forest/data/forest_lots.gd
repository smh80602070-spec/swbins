extends RefCounted

## G-0237 3마을 입주 조건 — 빈 집을 꾸미면 떠돌이 손님이 눌러앉는다(웹 W-0284 lots.js 이식, 테라리아식 구조만).
##   짓기     제작대 레시피 lot(솔방울 12·광석 3·화석 2 — 웹 shard 자리) → 작은 빈 집 하나, 셋까지.
##   꾸미기   제작대 "🏠 빈 집 꾸미기" — 집 창고(home_stock) ↔ 빈 집, 한 집 가구 6점까지 · 산 집은 잠김.
##   조건     한 집에 서로 다른 태그 ≥3 + 그 태그를 둘 이상 좋아하는 아직 안 눌러앉은 손님 → **다음 날** 눌러앉음(하루 한 명, 동점은 명단 순).
##   태그     LOT_TAGS·LOT_TAG_NAMES·LOT_LIKES 는 웹 data-village.js 값 그대로. 3D 가구 14 엔 바다·밤·별·길 가구가 없어(웹은 방문객·행사 가구)
##            손님 여덟이 못 닿는다 → 가구 넷에 둘째 태그(LOT_TAGS2: 물항아리 바다·등잔 밤·도자기 별·반닫이 길) — tags_of 는 배열.
##   다음 날  고돗엔 날 굴림이 따로 없어 집마다 day = 마지막으로 손댄 날, 그날보다 뒤 날에 on_new_day 가 돌 때만 입주(웹 rollDay 짝).
##            on_new_day 는 하루 한 번(lots_roll = 그날) — 날 바뀌고 처음 마을에 들 때(forest_village.gd).
##   손님     웹 visitor.js 명단 10(웹 key → scenario.gd CAST 키, 낚시 명인 청파만 CAST 에 없어 웹 이름) · 몸은 기존 주민 npc_* 대역(body).
##            웹은 주민 visitSettled 와 함께 세지만 고돗엔 떠돌이 체계가 없어 lots 의 who 만 센다.
##   저장     ForestSaveState.lots = [{furn: [가구 key…], who: 손님 key|"" , day}] · lots_roll(int) — 순수 추가 칸(버전 안 올림).
## F = ForestSaveState(제작대 forest_craft.gd 와 같은 꼴 — SceneTree 점검이 오토로드 이름 없이 부른다).

const MAX := 3
const FURN_MAX := 6
const NEED_TAGS := 3
const NEED_LIKE := 2

const LOT_TAGS := {
	"seoan": "study", "jokja": "study", "mungab": "study", "badukpan": "study", "byeongpung": "study", "deungjan": "study",
	"geomungo": "music",
	"mulhang": "kitchen", "hwaro": "kitchen", "soban": "kitchen", "fest_chuseok": "kitchen", "fest_dongji": "kitchen",
	"yo": "rest", "bangseok": "rest", "bandaji": "rest", "dokja": "rest",
	"hwabun": "garden", "fest_dano": "garden", "visit_bug": "garden", "visit_photo": "garden",
	"visit_sailor": "sea", "visit_angler": "sea",
	"visit_wisp": "night", "visit_dokkaebi": "night", "fest_baekjung": "night", "fest_daeborum": "night",
	"visit_future": "star", "visit_alien": "star",
	"visit_parcel": "road", "fest_seollal": "road", "fest_samjin": "road", "fest_chilseok": "road",
}
## 고돗만의 둘째 태그(감독 승인 10-19) — 3D 가구 14 로 손님 열 모두 닿게.
const LOT_TAGS2 := {"mulhang": "sea", "deungjan": "night", "dokja": "star", "bandaji": "road"}
const LOT_TAG_NAMES := {"study": "서재", "music": "악기", "kitchen": "부엌", "rest": "안방", "garden": "뜰", "sea": "바다", "night": "밤", "star": "별", "road": "길"}
const LOT_LIKES := {
	"fox": ["road", "kitchen", "study"], "sailor": ["sea", "kitchen"], "wisp": ["night", "music"], "angler": ["sea", "garden"], "bugdoc": ["garden", "study"],
	"traveler": ["star", "study"], "dokkaebi": ["night", "rest"], "alien": ["star", "music"], "courier": ["road", "rest"], "photo": ["garden", "night"],
}
## 손님 명단(웹 VISITORS 순서 — 동점은 앞사람) · cast = scenario.gd CAST 키 · body = 몸 대역 주민 id · line = 눌러앉은 뒤 말 한 줄
const GUESTS := [
	{"key": "fox", "cast": "hoyeon", "body": "npc_merchant", "line": "좌판은 접었소. 이 집 부엌 냄새가 길손을 붙드는구려."},
	{"key": "sailor", "cast": "pungnang", "body": "npc_angler", "line": "물항아리 소리가 파도 같소. 여기서 닻을 내리겠소."},
	{"key": "wisp", "cast": "bandi", "body": "npc_herbalist", "line": "밤마다 등잔 곁에서 깜빡일게요. 쫓아내지만 마요."},
	{"key": "angler", "cast": "", "name": "낚시 명인 청파", "emoji": "🎣", "body": "npc_angler", "line": "뜰 앞 물이 맑구먼. 내일 아침엔 같이 드리우세."},
	{"key": "bugdoc", "cast": "nabi", "body": "npc_herbalist", "line": "화분에 벌레가 꼬이면 나를 부르게. 이름부터 알려 주지."},
	{"key": "traveler", "cast": "k7", "body": "npc_explorer", "line": "이 시대 기록을 이 서재에서 마저 쓰겠습니다."},
	{"key": "dokkaebi", "cast": "dudu", "body": "npc_keeper", "line": "방석 푹신하다! 밤엔 조용히 놀게, 약속!"},
	{"key": "alien", "cast": "rumi", "body": "npc_explorer", "line": "거문고 소리랑 별빛 — 신호가 아주 잘 잡혀요."},
	{"key": "courier", "cast": "dareum", "body": "npc_wanderer", "line": "길 가까운 집이라 배달 다니기 딱이네요."},
	{"key": "photo", "cast": "chalna", "body": "npc_wanderer", "line": "밤 뜰 한 장 찍고 잘게요. 여기 빛이 좋아요."},
]


static func guest(key: String) -> Dictionary:
	for g: Dictionary in GUESTS:
		if String(g.key) == key:
			return g
	return {}


## 이름·이모지 — CAST 에서(청파만 제 칸)
static func guest_label(key: String) -> String:
	var g := guest(key)
	if g.is_empty():
		return key
	if String(g.cast) != "":
		var c: Dictionary = load("res://games/saga_forest/data/scenario.gd").CAST.get(String(g.cast), {})
		return "%s %s" % [String(c.get("emoji", "")), String(c.get("name", key))]
	return "%s %s" % [String(g.get("emoji", "")), String(g.get("name", key))]


static func tags_of(furn_key: String) -> Array:
	var out: Array = []
	var t := String(LOT_TAGS.get(furn_key, ""))
	if t == "":
		t = String(ForestHome.furn(furn_key).get("set", ""))
	if t != "":
		out.append(t)
	if LOT_TAGS2.has(furn_key):
		out.append(String(LOT_TAGS2[furn_key]))
	return out


static func tag_name(t: String) -> String:
	return String(LOT_TAG_NAMES.get(t, t))


static func lots(F: Node) -> Array:
	if typeof(F.lots) != TYPE_ARRAY:
		F.lots = []
	return F.lots


static func count(F: Node) -> int:
	return lots(F).size()


## 집 i 의 서로 다른 태그
static func lot_tags(F: Node, i: int) -> Array:
	var out: Array = []
	if i < 0 or i >= count(F):
		return out
	for k in (lots(F)[i] as Dictionary).get("furn", []):
		for t: String in tags_of(String(k)):
			if not out.has(t):
				out.append(t)
	return out


static func settled(F: Node) -> Array:
	var out: Array = []
	for lot: Dictionary in lots(F):
		if String(lot.get("who", "")) != "":
			out.append(String(lot.who))
	return out


static func why_not_build(F: Node) -> String:
	return "빈 집은 %d채까지" % MAX if count(F) >= MAX else ""


static func build(F: Node) -> Dictionary:
	var why := why_not_build(F)
	if why != "":
		return {"ok": false, "why": why}
	lots(F).append({"furn": [], "who": "", "day": ForestDay.epoch_day_index()})
	return {"ok": true, "why": "", "i": count(F) - 1}


## 집 창고 → 집 i
static func put(F: Node, i: int, key: String) -> Dictionary:
	if i < 0 or i >= count(F):
		return {"ok": false, "why": "없는 집"}
	var lot: Dictionary = lots(F)[i]
	if String(lot.get("who", "")) != "":
		return {"ok": false, "why": "이미 사람이 산다"}
	if (lot.furn as Array).size() >= FURN_MAX:
		return {"ok": false, "why": "가구는 %d점까지" % FURN_MAX}
	if F.home_stock_count(key) < 1:
		return {"ok": false, "why": "창고에 없다"}
	F.home_stock[key] = F.home_stock_count(key) - 1
	if int(F.home_stock[key]) <= 0:
		F.home_stock.erase(key)
	(lot.furn as Array).append(key)
	lot["day"] = ForestDay.epoch_day_index()
	return {"ok": true, "why": ""}


## 집 i → 집 창고
static func take(F: Node, i: int, key: String) -> Dictionary:
	if i < 0 or i >= count(F):
		return {"ok": false, "why": "없는 집"}
	var lot: Dictionary = lots(F)[i]
	if String(lot.get("who", "")) != "":
		return {"ok": false, "why": "이미 사람이 산다"}
	var j := (lot.furn as Array).find(key)
	if j < 0:
		return {"ok": false, "why": "그 가구가 없다"}
	(lot.furn as Array).remove_at(j)
	F.home_stock_add(key, 1)
	lot["day"] = ForestDay.epoch_day_index()
	return {"ok": true, "why": ""}


## 집 i 에 어울리는 손님 — 좋아하는 태그가 가장 많이 든 아직 안 눌러앉은 손님 {key, score, miss}, 없으면 {}
static func match_for(F: Node, i: int) -> Dictionary:
	var tags := lot_tags(F, i)
	var done := settled(F)
	var best := {}
	for g: Dictionary in GUESTS:
		var key := String(g.key)
		if done.has(key):
			continue
		var score := 0
		var miss: Array = []
		for t: String in LOT_LIKES.get(key, []):
			if tags.has(t):
				score += 1
			else:
				miss.append(t)
		if best.is_empty() or score > int(best.score):
			best = {"key": key, "score": score, "miss": miss}
	return best


static func ready_match(F: Node, i: int) -> Dictionary:
	var m := match_for(F, i)
	if lot_tags(F, i).size() >= NEED_TAGS and not m.is_empty() and int(m.score) >= NEED_LIKE:
		return m
	return {}


static func hint_for(F: Node, i: int) -> String:
	var lot: Dictionary = lots(F)[i]
	if String(lot.get("who", "")) != "":
		return "%s 이(가) 산다" % guest_label(String(lot.who))
	var tags := lot_tags(F, i)
	var m := match_for(F, i)
	if m.is_empty():
		return "이제 올 손님이 없다"
	if tags.size() < NEED_TAGS:
		return "태그 %d/%d — 서로 다른 태그 가구를 더" % [tags.size(), NEED_TAGS]
	if int(m.score) >= NEED_LIKE:
		return "%s 이(가) 내일 눌러앉는다" % guest_label(String(m.key))
	var names: Array = []
	for t: String in m.miss:
		names.append(tag_name(t))
	return "%s 이(가) 어울린다 — %s 가구가 있으면" % [guest_label(String(m.key)), "·".join(names)]


## 날이 바뀌고 처음 — 조건 맞는 빈 집 하나에 손님이 눌러앉는다(하루 한 명). {key, lot, text} 또는 {}
static func on_new_day(F: Node) -> Dictionary:
	var today := ForestDay.epoch_day_index()
	if int(F.lots_roll) == today:
		return {}
	F.lots_roll = today
	var all := lots(F)
	for i in all.size():
		var lot: Dictionary = all[i]
		if String(lot.get("who", "")) != "" or int(lot.get("day", today)) >= today:
			continue
		var m := ready_match(F, i)
		if m.is_empty():
			continue
		lot["who"] = String(m.key)
		var names: Array = []
		for t: String in lot_tags(F, i):
			names.append(tag_name(t))
		return {"key": String(m.key), "lot": i,
			"text": "🏡 %s 이(가) %d번째 빈 집에 눌러앉았다 — %s" % [guest_label(String(m.key)), i + 1, "·".join(names)]}
	return {}
