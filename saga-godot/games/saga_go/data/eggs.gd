extends RefCounted

## 신수 알 · 동행 신수 (2026-09-30 사용자 "그래픽 말고 새로운 시스템 부터") — 포켓몬GO의 알 부화·파트너를
## 이 판 문법으로. 규칙·수치는 여기, 상태는 PartyState.eggs, 화면·걸음 세기·동행 몸은 world/egg_incubator.gd.
##
##   알 — 상자·의뢰·비경·보스 꽃에서 나온다. 주머니(BAG_MAX)에 쌓이고, 부화기(칸은 모험 등급으로 열린다)에 넣고 걸으면
##        걸은 거리(m)만큼 차서 다 차면 부화 — 신수 하나가 나온다(안 가진 신수 우선, 다 가졌으면 냥).
##   동행 — 가진 신수 하나를 데리고 다닌다(뒤따라 걷는 몸). 함께 BUDDY_M 걸을 때마다 냥.
##   걸음 — 한 틱에 STEP_CAP_M 넘게 움직인 것(순간이동·지점 이동)은 안 센다. 탈것·날개도 센다(빨리 걸을수록 빨리 부화).

const Pets := preload("res://saga_core/data/pets.gd")

## need — 부화까지 걸을 거리(m). 마을~고원 왕복이 대략 1km.
const TIERS := [
	{"id": "e_small", "name": "작은 알", "emoji": "🥚", "need": 300.0,
		"pool": ["pt_gumiho", "pt_dokkaebi", "pt_bulgasari", "pt_jeolyeong"]},
	{"id": "e_mid", "name": "큰 알", "emoji": "🥚", "need": 800.0,
		"pool": ["pt_gumiho", "pt_dokkaebi", "pt_bulgasari", "pt_jeolyeong", "pt_jeoktoma", "pt_samjogo", "pt_haetae"]},
	{"id": "e_rare", "name": "빛나는 알", "emoji": "✨", "need": 1500.0,
		"pool": ["pt_jeoktoma", "pt_samjogo", "pt_haetae", "pt_cheongryong", "pt_baekho", "pt_jujak", "pt_hyeonmu"]},
]

const BAG_MAX := 9
## 부화기 칸이 열리는 모험 등급.
const SLOT_AR := [1, 4, 8]
const STEP_CAP_M := 3.0
const BUDDY_M := 400.0
const BUDDY_MORA := 800
const DUP_MORA := 1500
const DUP_EXP := 30.0

## 알이 나오는 곳 — [확률, 알 종류]. 굴림은 (곳, 열쇠) 해시라 같은 상자·같은 의뢰는 늘 같은 결과다.
const SOURCES := {
	"chest:common": [[0.12, "e_small"]],
	"chest:exquisite": [[0.25, "e_small"]],
	"chest:precious": [[0.5, "e_mid"]],
	"chest:luxurious": [[1.0, "e_mid"], [0.3, "e_rare"]],
	"commission": [[1.0, "e_small"]],
	"domain": [[0.6, "e_mid"]],
	"weekly": [[1.0, "e_rare"]],
	"bloom": [[0.5, "e_mid"]],
	"weekly_goal": [[1.0, "e_rare"]],
}


static func tier(id: String) -> Dictionary:
	for t in TIERS:
		if t.id == id:
			return t
	return {}


static func slots_for_ar(ar: int) -> int:
	var n := 0
	for a in SLOT_AR:
		if ar >= int(a):
			n += 1
	return n


## PartyState.eggs 를 꼴에 맞춰 돌려준다(없는 칸은 채운다).
static func state() -> Dictionary:
	var s: Dictionary = PartyState.eggs
	if not s.has("bag"):
		s["bag"] = []
	if not s.has("inc"):
		s["inc"] = []
	for k in ["hatched", "walk", "buddy_m"]:
		if not s.has(k):
			s[k] = 0.0 if k != "hatched" else 0
	if not s.has("buddy"):
		s["buddy"] = ""
	return s


static func _h(text: String) -> int:
	return absi(text.hash())


## G-0123 — 같은 날 되풀이할 수 있는 곳(비경·주간 보스·보스 꽃)은 열쇠가 "곳|단계|날짜" 라 그날 굴림이 늘 같았다(늘 알이면 원기만큼 뽑기).
## 그 곳은 굴릴 때마다 횟수(세이브 eggs.roll_n — 없으면 0)를 열쇠에 붙인다. 상자(상자 id)·의뢰·주간 도전은 한 번뿐이라 그대로.
const REPEAT_SOURCES := ["domain", "weekly", "bloom"]
static func next_key(source: String, key: String) -> String:
	if not (source in REPEAT_SOURCES):
		return key
	var s := state()
	var rn: Dictionary = s.get("roll_n", {})
	var n := int(rn.get(source, 0)) + 1
	rn[source] = n
	s["roll_n"] = rn
	return "%s|%d" % [key, n]


## 곳(source)에서 나온 알 종류들(비었으면 []). 굴림만 — 주머니에 넣는 건 add_egg.
static func roll(source: String, key: String) -> Array[String]:
	var out: Array[String] = []
	var rows: Array = SOURCES.get(source, [])
	for i in rows.size():
		var chance: float = rows[i][0]
		var r := float(_h("%s|%s|%d" % [source, key, i]) % 1000) / 1000.0
		if r < chance:
			out.append(String(rows[i][1]))
	return out


## 주머니에 알을 넣는다. "ok" 또는 "full".
static func add_egg(tier_id: String) -> String:
	var s := state()
	if (s.bag as Array).size() >= BAG_MAX:
		return "full"
	(s.bag as Array).append(tier_id)
	return "ok"


## 주머니 bag_index 번 알을 부화기에 넣는다. 오류 글(없으면 "").
static func start(bag_index: int, ar: int) -> String:
	var s := state()
	if bag_index < 0 or bag_index >= (s.bag as Array).size():
		return "그 알이 없다"
	if (s.inc as Array).size() >= slots_for_ar(ar):
		return "부화기 칸이 모자라다 (모험 등급으로 열린다)"
	var t: String = (s.bag as Array)[bag_index]
	(s.bag as Array).remove_at(bag_index)
	(s.inc as Array).append({"tier": t, "walked": 0.0})
	return ""


## 부화기 idx 번 알을 주머니로 되돌린다(걸음은 그대로 잃는다).
static func stop(idx: int) -> String:
	var s := state()
	if idx < 0 or idx >= (s.inc as Array).size():
		return "그 칸이 비었다"
	if (s.bag as Array).size() >= BAG_MAX:
		return "주머니가 가득 찼다"
	var e: Dictionary = (s.inc as Array)[idx]
	(s.inc as Array).remove_at(idx)
	(s.bag as Array).append(String(e.tier))
	return ""


## 알 하나가 무엇으로 부화할지 — 안 가진 신수 우선, 굴림은 (알 종류, 지금까지 부화 수)로 정해 저장 전후가 같다.
static func pick_pet(tier_id: String, hatched: int) -> String:
	var pool: Array = tier(tier_id).get("pool", [])
	if pool.is_empty():
		return ""
	var fresh: Array = []
	for id in pool:
		if not CodexState.has("pet", String(id)):
			fresh.append(id)
	var from: Array = fresh if not fresh.is_empty() else pool
	return String(from[_h("%s|%d" % [tier_id, hatched]) % from.size()])


## 걸은 거리를 부화기에 준다 — 부화한 것들의 목록 [{tier, pet, dup}]. 신수는 도감에 도장, 겹치면 냥·경험.
static func walk(meters: float) -> Array:
	var s := state()
	s.walk = float(s.walk) + meters
	var done: Array = []
	var keep: Array = []
	for e in s.inc as Array:
		e.walked = float(e.walked) + meters
		if float(e.walked) >= float(tier(String(e.tier)).get("need", 1e9)):
			done.append(e)
		else:
			keep.append(e)
	s.inc = keep
	var out: Array = []
	for e in done:
		var pet := pick_pet(String(e.tier), int(s.hatched))
		s.hatched = int(s.hatched) + 1
		var dup := not CodexState.discover("pet", pet)
		if dup:
			PartyState.add_items({"mora": DUP_MORA})
			PartyState.add_exp(DUP_EXP)
		out.append({"tier": String(e.tier), "pet": pet, "dup": dup})
	if String(s.buddy) != "":
		if not s.has("friend"):
			s["friend"] = {}
		(s.friend as Dictionary)[String(s.buddy)] = float((s.friend as Dictionary).get(String(s.buddy), 0.0)) + meters
		s.buddy_m = float(s.buddy_m) + meters
		while float(s.buddy_m) >= BUDDY_M:
			s.buddy_m = float(s.buddy_m) - BUDDY_M
			PartyState.add_items({"mora": BUDDY_MORA})
	return out


static func set_buddy(pet_id: String) -> String:
	if pet_id != "" and not CodexState.has("pet", pet_id):
		return "아직 만나지 못한 신수다"
	var s := state()
	s.buddy = pet_id
	s.buddy_m = 0.0
	PartyState.refresh_power()
	return ""


## 동행했을 때 받는 것 — "공격력 최대 +14%" (친밀 10 에서. 갈래 표는 PartyState.BUDDY_STAT).
static func bonus_label(pet_id: String) -> String:
	var p: Variant = Pets.find(pet_id)
	if p == null:
		return ""
	var what: String = {"atk": "공격력", "exp": "경험치", "def": "방어력"}.get(String(PartyState.BUDDY_STAT.get(String(p.bonus.stat), "")), "")
	return "%s 최대 +%d%%" % [what, int(p.bonus.value)]


static func pet_name(id: String) -> String:
	var p: Variant = Pets.find(id)
	return String(p.name) if p != null else id


## 안 가진 신수(도감 pet) 수 / 전체.
static func owned_count() -> int:
	var n := 0
	for p in Pets.PETS:
		if CodexState.has("pet", String(p.id)):
			n += 1
	return n
