extends RefCounted

## 사진 도감 (2026-09-30 새 시스템) — 사진 모드(📷)가 화면을 파일로만 저장하던 것에 "무엇을 담았나"를 붙였다(포켓몬 스냅식).
## 찍는 순간 화면 안(시야 안·가림 없음·2.5~50m)의 들판 적·동행 신수·들판 신수·역사 인물을 찾아 구도 점수를 매기고, 처음 담은 것마다 보상을 준다.
## 규칙·수치는 여기, 상태는 PartyState.album, 찾기·화면은 world/photo_album.gd.
##
##   PartyState.album = {"shots": {대상 id: {"n": 찍은 수, "best": 최고 점수, "name": 이름, "kind": 갈래}}, "claimed": [받은 마일스톤 수…]}
##   대상 id — "e:<적 종>" · "b:<동행 신수>" · "p:<들판 신수>" · "h:<인물>".
##   점수 — 기본 10 + 화면 가운데에 가까울수록 0~10 + 클수록(키가 화면 높이의 35% 에서 만점) 0~10 = 10~30. 한 장에 여럿이면 여럿째마다 +5.

const Hunt := preload("res://games/saga_go/data/hunt.gd")
const Pets := preload("res://saga_core/data/pets.gd")
const Characters := preload("res://saga_core/data/characters.gd")

const MIN_DIST := 2.5
const MAX_DIST := 50.0
const BASE := 10
const SIZE_FULL := 0.35
const MULTI_BONUS := 5

## 처음 담았을 때 보상 — 갈래마다.
const FIRST_REWARD := {
	"enemy": {"mora": 300},
	"boss": {"mora": 1500, "book_s": 1},
	"buddy": {"mora": 500},
	"pet": {"mora": 1500, "book_s": 1},
	"hero": {"mora": 800},
}
## 담은 종류 수 문턱 → 보상.
const MILESTONES := [
	[5, {"mora": 3000}],
	[15, {"mora": 6000, "book_m": 2}],
	[30, {"fate_knot": 1, "book_m": 3}],
]

## 대상 갈래 이름(화면 글).
const KIND_NAMES := {"enemy": "들판", "boss": "우두머리", "buddy": "동행", "pet": "신수", "hero": "인물"}


static func state() -> Dictionary:
	var a: Dictionary = PartyState.album
	if not a.has("shots"):
		a["shots"] = {}
	if not a.has("claimed"):
		a["claimed"] = []
	return a


## id → 이름·갈래. 없는 id 면 {}.
static func describe(id: String) -> Dictionary:
	var parts := id.split(":", true, 1)
	if parts.size() != 2:
		return {}
	var key := String(parts[1])
	match String(parts[0]):
		"e":
			if Hunt.def(key).is_empty():
				return {}
			return {"name": Hunt.display_name(key), "kind": "boss" if Hunt.is_boss(key) else "enemy"}
		"b", "p":
			var p: Variant = Pets.find(key)
			if p == null:
				return {}
			return {"name": String(p.name), "kind": "buddy" if String(parts[0]) == "b" else "pet"}
		"h":
			var h: Variant = Characters.find(key)
			if h == null:
				return {}
			return {"name": String(h.name), "kind": "hero"}
	return {}


## 구도 점수(10~30). 가운데 거리 offset(0=한가운데 ~1=모서리)·키 비율 height_frac.
static func score(offset: float, height_frac: float) -> int:
	var centered := int(round(10.0 * (1.0 - clampf(offset, 0.0, 1.0))))
	var size := int(round(10.0 * clampf(height_frac / SIZE_FULL, 0.0, 1.0)))
	return BASE + centered + size


## 한 대상을 기록한다 — "first"(처음)·"better"(최고 점수 갱신)·"same". 처음이면 보상을 가방에 넣는다.
static func record(id: String, sc: int) -> Dictionary:
	var d := describe(id)
	if d.is_empty():
		return {"result": "unknown"}
	var shots: Dictionary = state().shots
	var e: Dictionary = shots.get(id, {})
	var result := "same"
	if e.is_empty():
		e = {"n": 0, "best": 0, "name": d.name, "kind": d.kind}
		result = "first"
	e.n = int(e.n) + 1
	if sc > int(e.best):
		if result != "first":
			result = "better"
		e.best = sc
	shots[id] = e
	var reward := {}
	if result == "first":
		reward = (FIRST_REWARD[d.kind] as Dictionary).duplicate()
		PartyState.add_items(reward)
	return {"result": result, "reward": reward, "name": d.name, "kind": d.kind}


static func kinds_count() -> int:
	return (state().shots as Dictionary).size()


static func best_total() -> int:
	var n := 0
	for id in state().shots:
		n += int((state().shots[id] as Dictionary).best)
	return n


static func milestone_reached(i: int) -> bool:
	return kinds_count() >= int(MILESTONES[i][0])


static func milestone_claimed(i: int) -> bool:
	return (state().claimed as Array).has(int(MILESTONES[i][0]))


static func claim_milestone(i: int) -> Dictionary:
	if i < 0 or i >= MILESTONES.size() or not milestone_reached(i) or milestone_claimed(i):
		return {}
	(state().claimed as Array).append(int(MILESTONES[i][0]))
	var r: Dictionary = MILESTONES[i][1]
	PartyState.add_items(r)
	return r


static func claimable_milestones() -> int:
	var n := 0
	for i in MILESTONES.size():
		if milestone_reached(i) and not milestone_claimed(i):
			n += 1
	return n


## 썸네일 파일 이름(대상 id 에서 파일에 못 쓰는 글자를 뺀다).
static func thumb_path(id: String) -> String:
	return "user://photos/album/%s.png" % id.replace(":", "_")
