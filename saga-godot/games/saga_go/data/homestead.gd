extends RefCounted

## 쉼터 마당 (2026-09-30 새 시스템) — 원신 동천·동물의숲 집 꾸미기를 이 판 문법으로. 냥으로 소품을 사서 마당에 놓으면
## 안락도가 오르고, 안락도 등급이 오를수록 마당이 실제 시간으로 냥을 쌓아 준다(상한까지, 가서 "수확"). 규칙·수치는 여기,
## 상태는 PartyState.home, 마당·화면은 world/homestead.gd.
##
##   PartyState.home = {"items": [{"id","x","z","r"}…], "t": 마지막 정산 시각(초), "acc": 정산 때 쌓인 냥, "spent": 총 쓴 냥}
##   등급이 바뀌는 순간(놓기·치우기)엔 그 전 등급 수입을 먼저 은행(acc)에 넣는다 — 소급해서 바뀌지 않는다.

## 마당 중심 = 마을 신상 곁 열린 풀밭(창 모드 촬영으로 잡음). 반지름 안에서만 놓는다.
const REGION := "village"
const ANCHOR := "v_statue"
const ANCHOR_OFFSET := Vector3(-14.0, 0.0, 12.0)
const RADIUS := 9.0
const PROMPT_M := 12.0

const MAX_ITEMS := 40
const SPACING_M := 0.9   # 소품끼리 이 안에 놓지 못한다
const REFUND := 0.5      # 치우면 값의 절반
const CAP_HOURS := 12.0  # 쌓이는 수입 상한(시간)

## glb — 소품 모델, scale — 배율, cost — 냥, comfort — 안락도.
const ITEMS := [
	{"id": "fence", "name": "울타리", "glb": "res://assets/generated/props/fence_s1_01.glb", "scale": 1.0, "cost": 100, "comfort": 1},
	{"id": "reed", "name": "갈대", "glb": "res://assets/generated/props/reed_s1_01.glb", "scale": 1.0, "cost": 120, "comfort": 1},
	{"id": "flowers", "name": "꽃덤불", "glb": "res://assets/generated/variants/Bush_Common_Flowers__go_village.glb", "scale": 0.7, "cost": 150, "comfort": 2},
	{"id": "rock", "name": "정원석", "glb": "res://assets/generated/props/rock_s1_01.glb", "scale": 1.2, "cost": 200, "comfort": 2},
	{"id": "lamp", "name": "등롱", "glb": "res://assets/generated/props/lamp_s1_01.glb", "scale": 0.7, "cost": 350, "comfort": 3},
	{"id": "scare", "name": "허수아비", "glb": "res://assets/generated/props/scare_s1_01.glb", "scale": 1.0, "cost": 400, "comfort": 3},
	{"id": "stele", "name": "작은 비석", "glb": "res://assets/generated/props/stele_s1_01.glb", "scale": 1.4, "cost": 500, "comfort": 4},
	{"id": "tree", "name": "느티나무", "glb": "res://assets/generated/variants/CommonTree_1__go_village.glb", "scale": 0.55, "cost": 800, "comfort": 6},
	{"id": "pine", "name": "소나무", "glb": "res://assets/generated/variants/Pine_1__go_village.glb", "scale": 0.55, "cost": 800, "comfort": 6},
	{"id": "well", "name": "우물", "glb": "res://assets/generated/props/well_s1_01.glb", "scale": 1.0, "cost": 900, "comfort": 6},
	{"id": "stall", "name": "좌판", "glb": "res://assets/generated/props/market_s1_01.glb", "scale": 0.6, "cost": 1200, "comfort": 8},
	{"id": "shed", "name": "작은 집", "glb": "res://assets/generated/props/house_s2_02.glb", "scale": 0.28, "cost": 2500, "comfort": 15},
]

## 등급 — 안락도가 min 이상이면 그 등급. income 은 실제 한 시간당 냥.
const TIERS := [
	{"name": "빈 마당", "min": 0, "income": 0},
	{"name": "아담한 마당", "min": 10, "income": 60},
	{"name": "정갈한 마당", "min": 30, "income": 150},
	{"name": "아늑한 쉼터", "min": 60, "income": 300},
	{"name": "이름난 쉼터", "min": 100, "income": 500},
]

## 점검이 시각을 돌릴 때(초).
static var time_offset := 0.0


static func now() -> float:
	return Time.get_unix_time_from_system() + time_offset


static func item(id: String) -> Dictionary:
	for it in ITEMS:
		if it.id == id:
			return it
	return {}


static func state() -> Dictionary:
	var h: Dictionary = PartyState.home
	if not h.has("items"):
		h["items"] = []
	if not h.has("acc"):
		h["acc"] = 0.0
	if not h.has("spent"):
		h["spent"] = 0
	if not h.has("t"):
		h["t"] = now()
	return h


static func comfort() -> int:
	var n := 0
	for e in state().items as Array:
		n += int(item(String(e.id)).get("comfort", 0))
	return n


static func tier_of(c: int) -> int:
	var t := 0
	for i in TIERS.size():
		if c >= int(TIERS[i].min):
			t = i
	return t


static func tier() -> int:
	return tier_of(comfort())


static func income_per_hour() -> int:
	return int(TIERS[tier()].income)


## 지금까지 쌓인 냥(상한 적용).
static func pending() -> int:
	var h := state()
	var hours := maxf((now() - float(h.t)) / 3600.0, 0.0)
	var cap := float(income_per_hour()) * CAP_HOURS
	return int(minf(float(h.acc) + float(income_per_hour()) * hours, maxf(cap, float(h.acc))))


## 등급이 바뀌기 전에 지금까지의 수입을 은행에 넣고 시각을 새로 잡는다.
static func bank() -> void:
	var h := state()
	h.acc = float(pending())
	h.t = now()


## 수확 — 받은 냥(0 이면 아무것도 안 함).
static func harvest() -> int:
	var n := pending()
	if n <= 0:
		return 0
	var h := state()
	h.acc = 0.0
	h.t = now()
	PartyState.add_items({"mora": n})
	return n


## 놓기 — 오류 글(없으면 ""). x·z 는 세계 좌표, center 는 마당 중심(세계).
static func place(id: String, x: float, z: float, rot: int, center_pos: Vector3) -> String:
	var it := item(id)
	if it.is_empty():
		return "그런 소품은 없다"
	var h := state()
	if (h.items as Array).size() >= MAX_ITEMS:
		return "마당이 가득 찼다 (%d개)" % MAX_ITEMS
	if Vector2(x - center_pos.x, z - center_pos.z).length() > RADIUS:
		return "마당 밖이다 — 표지 둘레 %dm 안에 놓는다" % int(RADIUS)
	for e in h.items as Array:
		if Vector2(float(e.x) - x, float(e.z) - z).length() < SPACING_M:
			return "다른 소품과 너무 가깝다"
	if not PartyState.spend_items({"mora": int(it.cost)}):
		return "냥이 모자란다 (%d 필요)" % int(it.cost)
	bank()
	(h.items as Array).append({"id": id, "x": snappedf(x, 0.5), "z": snappedf(z, 0.5), "r": rot % 4})
	h.spent = int(h.spent) + int(it.cost)
	return ""


## 치우기 — (x,z) 에서 reach 안 가장 가까운 소품을 치우고 절반을 돌려준다. 치운 id(없으면 "").
static func remove_near(x: float, z: float, reach: float) -> String:
	var h := state()
	var best := -1
	var bd := reach
	for i in (h.items as Array).size():
		var e: Dictionary = (h.items as Array)[i]
		var d := Vector2(float(e.x) - x, float(e.z) - z).length()
		if d <= bd:
			bd = d
			best = i
	if best < 0:
		return ""
	var id := String(((h.items as Array)[best] as Dictionary).id)
	bank()
	(h.items as Array).remove_at(best)
	PartyState.add_items({"mora": int(float(item(id).cost) * REFUND)})
	return id
