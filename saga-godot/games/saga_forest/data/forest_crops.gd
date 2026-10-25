extends RefCounted

## G-0391 3마을 밭 작물(스타듀 밸리 — 구조만) — 유니티 U-0223 ForestCrops.cs 짝, 수치 같게(밭 열매 8·씨 1·거둠 4·물 준 날 3).
##   밭      제작대 「🌾 밭」 → 집 앞 작은 밭 하나·칸 넷(world/forest_crop_view.gd). 고돗 3마을 "열매" = 가방 "과일".
##   씨      빈 두둑에 과일 1 → 씨(단계 0).
##   물      하루 한 번(두 번 = 한 번 — 둘째는 거절) · 빈 두둑·다 자란 칸 거절 · 비가 오면 씨 뿌린 칸 저절로(rain_water — 보이는 쪽이 날씨를 보고 부른다).
##   아침    날 바뀌고 처음(advance — 마을에 들 때·밭이 1초 남짓마다): 어제 물 받은 칸만 한 단계(씨 → 싹 → 자람 → 다 자람) · 물 준 날 3 → 다 자람.
##           며칠 건너뛰었으면 몰아 셈 — 물은 첫 날 것뿐이라 한 단계만 · 시들기 없음.
##   거둠    다 자란 칸 → 과일 +4, 빈 두둑으로.
##   저장    ForestSaveState.crops = {field: bool, plots: [{st, wet}], roll: 날} — 순수 추가 칸(버전 안 올림).
## F = ForestSaveState(forest_livestock.gd 와 같은 꼴). SAGA_CROPS=0 이면 끔.

const PLOTS := 4
const FIELD_COST := 8
const SEED_COST := 1
const HARVEST := 4
const RIPE := 3
const FRUIT := "과일"
const STAGE_NAME := ["씨", "싹", "자람", "다 자람"]


static func on() -> bool:
	return OS.get_environment("SAGA_CROPS") != "0"


static func st(F: Node) -> Dictionary:
	if typeof(F.crops) != TYPE_DICTIONARY:
		F.crops = {}
	var C: Dictionary = F.crops
	if not C.has("field"):
		C["field"] = false
	if not (C.get("plots") is Array):
		C["plots"] = []
	while (C.plots as Array).size() < PLOTS:
		(C.plots as Array).append({"st": -1, "wet": false})
	if not C.has("roll"):
		C["roll"] = -1
	return C


static func has_field(F: Node) -> bool:
	return on() and bool(st(F).field)


static func plots(F: Node) -> Array:
	return st(F).plots


static func stage(F: Node, i: int) -> int:
	return int((plots(F)[i] as Dictionary).get("st", -1))


static func _spend(F: Node, n: int) -> void:
	F.items[FRUIT] = F.item_count(FRUIT) - n
	if int(F.items[FRUIT]) <= 0:
		F.items.erase(FRUIT)


static func why_not_build(F: Node) -> String:
	if not on():
		return "밭이 꺼져 있다"
	if bool(st(F).field):
		return "밭은 하나"
	if F.item_count(FRUIT) < FIELD_COST:
		return "%s 모자람(%d/%d)" % [FRUIT, F.item_count(FRUIT), FIELD_COST]
	return ""


static func build(F: Node, today: int = -1) -> Dictionary:
	var why := why_not_build(F)
	if why != "":
		return {"ok": false, "why": why}
	_spend(F, FIELD_COST)
	var C := st(F)
	C["field"] = true
	C["roll"] = today if today >= 0 else ForestDay.epoch_day_index()
	return {"ok": true, "why": ""}


static func _plot(F: Node, i: int) -> Dictionary:
	if not has_field(F) or i < 0 or i >= PLOTS:
		return {}
	return plots(F)[i]


static func plant(F: Node, i: int) -> Dictionary:
	var p := _plot(F, i)
	if p.is_empty():
		return {"ok": false, "why": "밭부터"}
	if int(p.st) >= 0:
		return {"ok": false, "why": "이미 심었다"}
	if F.item_count(FRUIT) < SEED_COST:
		return {"ok": false, "why": "%s이(가) 없다" % FRUIT}
	_spend(F, SEED_COST)
	p["st"] = 0
	p["wet"] = false
	return {"ok": true, "why": ""}


static func water(F: Node, i: int) -> Dictionary:
	var p := _plot(F, i)
	if p.is_empty():
		return {"ok": false, "why": "밭부터"}
	if int(p.st) < 0:
		return {"ok": false, "why": "빈 두둑"}
	if int(p.st) >= RIPE:
		return {"ok": false, "why": "다 자랐다 — 거둔다"}
	if bool(p.wet):
		return {"ok": false, "why": "오늘은 물을 줬다"}
	p["wet"] = true
	return {"ok": true, "why": ""}


## 비 — 씨 뿌린 칸(다 자란 칸 빼고) 저절로 물. 새로 젖은 칸 수
static func rain_water(F: Node) -> int:
	if not has_field(F):
		return 0
	var n := 0
	for p: Dictionary in plots(F):
		if int(p.st) >= 0 and int(p.st) < RIPE and not bool(p.wet):
			p["wet"] = true
			n += 1
	return n


static func harvest(F: Node, i: int) -> Dictionary:
	var p := _plot(F, i)
	if p.is_empty():
		return {"ok": false, "why": "밭부터"}
	if int(p.st) < RIPE:
		return {"ok": false, "why": "아직 덜 자랐다"}
	F.add_item(FRUIT, HARVEST)
	p["st"] = -1
	p["wet"] = false
	return {"ok": true, "why": "", "got": HARVEST}


## 아침 — 오늘 이미 굴렸거나 밭이 없으면 {}. {grew: 자란 칸 수, ripe: 다 자란 칸 수, text}
static func advance(F: Node, today: int = -1) -> Dictionary:
	if not has_field(F):
		return {}
	if today < 0:
		today = ForestDay.epoch_day_index()
	var C := st(F)
	var last := int(C.roll)
	if last == today:
		return {}
	C["roll"] = today
	if last < 0 or today < last:   # 처음 본 날·시계를 되돌린 날은 적기만
		return {}
	var grew := 0
	var ripe := 0
	for p: Dictionary in plots(F):
		if bool(p.wet) and int(p.st) >= 0 and int(p.st) < RIPE:
			p["st"] = int(p.st) + 1   # 건너뛴 날엔 물이 없다 — 한 단계뿐
			grew += 1
			if int(p.st) >= RIPE:
				ripe += 1
		p["wet"] = false
	var text := ""
	if grew > 0:
		text = "🌾 밭 — 밤새 %d칸 자랐다%s" % [grew, (" · %d칸 다 자람(거둔다)" % ripe) if ripe > 0 else ""]
	return {"grew": grew, "ripe": ripe, "text": text}


## 「오늘」 한 줄 — 밭이 없거나 물 줄 칸이 없으면 {}
static func today_row(F: Node) -> Dictionary:
	if not has_field(F):
		return {}
	var need := 0
	var wet := 0
	for p: Dictionary in plots(F):
		if int(p.st) >= 0 and int(p.st) < RIPE:
			need += 1
			wet += 1 if bool(p.wet) else 0
	if need == 0:
		return {}
	return {"label": "밭 물 주기", "cur": wet, "max": need, "done": wet >= need}


## 칸 한 줄 글 — 창·점검용
static func plot_text(F: Node, i: int) -> String:
	var p: Dictionary = plots(F)[i]
	var s := int(p.st)
	if s < 0:
		return "빈 두둑"
	if s >= RIPE:
		return "다 자람"
	return "%s %d/%d%s" % [STAGE_NAME[s], s, RIPE, " · 💧" if bool(p.wet) else ""]
