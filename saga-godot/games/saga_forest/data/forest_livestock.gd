extends RefCounted

## G-0311 3마을 가축 기르기 — 웹 saga-web/saga-forest/js/livestock.js(W-0299) 이식, 수치 그대로(넷까지·하트 5·사흘 굶으면 떠남·꼬꼬 400·매매 900).
##   우리     제작대 레시피 pen(솔방울 10·광석 2 — 웹 잣·철석 자리) → 작은 우리 하나(길 남쪽, world/forest_livestock_view.gd).
##   들이기   제작대 "🐔 작은 우리" 창에서 금을 내고 새끼를 들인다.
##   먹이     하루 한 번 가방 "과일" 하나(고돗엔 견과가 없다) · 쓰다듬기 하루 한 번 하트 +1.
##   아침     날 바뀌고 처음 마을에 들 때 한 번(forest_village.gd — forest_lots.gd on_new_day 와 같은 자리): 어제 먹은 짐승은 산물
##            (하트 3 이상 둘) → 가방 "달걀"·"산양젖", 안 먹은 짐승은 굶은 날 +1. 며칠 건너뛰었으면 먹인 하루 뒤의 빈 날은 굶은 날.
##   저장     ForestSaveState.livestock = {pen: bool, list: [{kind, name, fed, petted, heart, hungry}], roll: 날} — 순수 추가 칸(버전 안 올림).
## F = ForestSaveState(forest_lots.gd 와 같은 꼴 — SceneTree 점검이 오토로드 이름 없이 부른다). SAGA_LIVESTOCK=0 이면 끔.

const MAX := 4
const HEART_MAX := 5
const HEART_TWO := 3
const LEAVE_DAYS := 3
const FEED := "과일"
const KINDS := {
	"chick": {"name": "꼬꼬", "emoji": "🐔", "price": 400, "product": "달걀"},
	"goat": {"name": "매매", "emoji": "🐐", "price": 900, "product": "산양젖"},
}


static func on() -> bool:
	return OS.get_environment("SAGA_LIVESTOCK") != "0"


static func st(F: Node) -> Dictionary:
	if typeof(F.livestock) != TYPE_DICTIONARY:
		F.livestock = {}
	var L: Dictionary = F.livestock
	if not (L.get("list") is Array):
		L["list"] = []
	if not L.has("pen"):
		L["pen"] = false
	if not L.has("roll"):
		L["roll"] = -1
	return L


static func has_pen(F: Node) -> bool:
	return bool(st(F).pen)


static func animals(F: Node) -> Array:
	return st(F).list


static func why_not_pen(F: Node) -> String:
	return "작은 우리는 하나" if has_pen(F) else ""


static func build_pen(F: Node) -> void:
	var L := st(F)
	L["pen"] = true
	L["roll"] = ForestDay.epoch_day_index()


static func why_not_buy(F: Node, kind: String) -> String:
	if not on():
		return "가축이 꺼져 있다"
	if not has_pen(F):
		return "작은 우리부터"
	if not KINDS.has(kind):
		return "없는 짐승"
	if animals(F).size() >= MAX:
		return "우리엔 %d마리까지" % MAX
	if int(F.gold) < int(KINDS[kind].price):
		return "금이 모자란다(%d)" % int(KINDS[kind].price)
	return ""


static func buy(F: Node, kind: String) -> Dictionary:
	var why := why_not_buy(F, kind)
	if why != "":
		return {"ok": false, "why": why}
	F.gold = int(F.gold) - int(KINDS[kind].price)
	var n := 1
	for a: Dictionary in animals(F):
		if String(a.kind) == kind:
			n += 1
	var nm := String(KINDS[kind].name) + ("" if n == 1 else str(n))
	animals(F).append({"kind": kind, "name": nm, "fed": false, "petted": false, "heart": 0, "hungry": 0})
	return {"ok": true, "why": "", "name": nm}


static func feed(F: Node, i: int) -> Dictionary:
	var list := animals(F)
	if i < 0 or i >= list.size():
		return {"ok": false, "why": "없는 짐승"}
	var a: Dictionary = list[i]
	if bool(a.fed):
		return {"ok": false, "why": "오늘은 먹였다"}
	if F.item_count(FEED) <= 0:
		return {"ok": false, "why": "%s이(가) 없다" % FEED}
	F.items[FEED] = F.item_count(FEED) - 1
	if int(F.items[FEED]) <= 0:
		F.items.erase(FEED)
	a["fed"] = true
	return {"ok": true, "why": ""}


static func pet(F: Node, i: int) -> Dictionary:
	var list := animals(F)
	if i < 0 or i >= list.size():
		return {"ok": false, "why": "없는 짐승"}
	var a: Dictionary = list[i]
	if bool(a.petted):
		return {"ok": false, "why": "오늘은 쓰다듬었다"}
	a["petted"] = true
	a["heart"] = mini(HEART_MAX, int(a.heart) + 1)
	return {"ok": true, "why": "", "heart": int(a.heart)}


static func hearts(a: Dictionary) -> String:
	return "♥".repeat(int(a.heart)) + "♡".repeat(HEART_MAX - int(a.heart))


## 아침 — {got: {산물: n}, left: [이름], text}. 오늘 이미 굴렸으면 {}.
static func on_new_day(F: Node, today: int = -1) -> Dictionary:
	if not on() or not has_pen(F):
		return {}
	if today < 0:
		today = ForestDay.epoch_day_index()
	var L := st(F)
	var last := int(L.roll)
	if last == today:
		return {}
	var gap := 1 if last < 0 else maxi(1, today - last)
	L["roll"] = today
	var got := {}
	var left: Array = []
	var keep: Array = []
	for a: Dictionary in animals(F):
		var k: Dictionary = KINDS.get(String(a.kind), {})
		if bool(a.fed) and not k.is_empty():
			var n := 2 if int(a.heart) >= HEART_TWO else 1
			F.add_item(String(k.product), n)
			got[String(k.product)] = int(got.get(String(k.product), 0)) + n
			a["hungry"] = gap - 1   # 먹인 그날 뒤로 건너뛴 날은 굶은 날
		else:
			a["hungry"] = int(a.hungry) + gap
		a["fed"] = false
		a["petted"] = false
		if int(a.hungry) >= LEAVE_DAYS:
			left.append(String(a.name))
		else:
			keep.append(a)
	L["list"] = keep
	var parts: Array = []
	for p in got:
		parts.append("%s %d" % [p, int(got[p])])
	var lines: Array = []
	if not parts.is_empty():
		lines.append("🐔 우리 — 아침에 거뒀다: %s" % " · ".join(parts))
	if not left.is_empty():
		lines.append("🐐 사흘 굶은 %s 이(가) 우리를 떠났다" % "·".join(left))
	return {"got": got, "left": left, "text": "\n".join(lines)}
