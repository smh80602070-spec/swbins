extends RefCounted

## G-0371 종 연구 과제(레전드 아르세우스 — 마릿수만 아니라 "어떻게 잡았나"를 종마다 센다). 사냥 기록(data/hunt.gd)의 곁가지:
##   과제 넷 = 급소로 쓰러뜨리기(조준 급소 화살 막타) · 원소 반응으로(반응 막타) · 쳐낸 적 쓰러뜨리기(그 목숨 동안 쳐냄) · 던진 적 쓰러뜨리기(그 목숨 동안 던짐, 우두머리는 못 잡아 뺌)
##   과제마다 N 번(우두머리 1) 채우면 그 자리에서 덤(TASK_REWARD) · 종의 과제를 다 채우면 "연구 완료" 덤(DONE_REWARD) 하나 더.
##   막타 표식은 field_combat._deal 이 적에 rs_hit(1 = 반응, 2 = 급소) 로, 쳐냄은 field_parry 의 parried_until, 던짐은 hunt_log 가 thrown_landed 때 rs_thrown 으로 남긴다.
##   상태 = PartyState.hunt.research {종: {과제: 횟수}} — 사냥 기록과 같은 세이브 칸이라 저장 칸을 새로 안 만든다. SAGA_HUNT_RESEARCH=0 이면 안 셈.

const Hunt := preload("res://games/saga_go/data/hunt.gd")

const TASKS := [
	{"id": "weak", "name": "급소로 쓰러뜨리기"},
	{"id": "react", "name": "원소 반응으로 쓰러뜨리기"},
	{"id": "parried", "name": "쳐낸 적 쓰러뜨리기"},
	{"id": "thrown", "name": "던진 적 쓰러뜨리기"},
]
const GOAL := 3
const BOSS_GOAL := 1
const TASK_REWARD := {"mora": 800, "book_s": 1}
const DONE_REWARD := {"mora": 3000, "book_m": 1}


static func on() -> bool:
	return OS.get_environment("SAGA_HUNT_RESEARCH") != "0"


static func state() -> Dictionary:
	var h := Hunt.state()
	if not h.has("research"):
		h["research"] = {}
	return h.research


## 그 종에 걸린 과제 id 들 — 우두머리는 던질 수 없어 셋.
static func tasks_of(kind: String) -> Array[String]:
	var out: Array[String] = []
	for t in TASKS:
		if t.id == "thrown" and Hunt.is_boss(kind):
			continue
		out.append(String(t.id))
	return out


static func goal_of(kind: String) -> int:
	return BOSS_GOAL if Hunt.is_boss(kind) else GOAL


static func task_name(id: String) -> String:
	for t in TASKS:
		if t.id == id:
			return String(t.name)
	return id


static func count(kind: String, task: String) -> int:
	return int((state().get(kind, {}) as Dictionary).get(task, 0))


## 채운 과제 수.
static func done_count(kind: String) -> int:
	var n := 0
	for t in tasks_of(kind):
		if count(kind, t) >= goal_of(kind):
			n += 1
	return n


static func complete(kind: String) -> bool:
	return done_count(kind) >= tasks_of(kind).size()


## 쓰러뜨린 적에 남은 표식 → 과제 태그(순수 — 점검도 부른다).
static func tags_from(rs_hit: int, parried: bool, thrown: bool) -> Array[String]:
	var out: Array[String] = []
	if rs_hit & 2:
		out.append("weak")
	if rs_hit & 1:
		out.append("react")
	if parried:
		out.append("parried")
	if thrown:
		out.append("thrown")
	return out


## 한 마리 — 태그마다 횟수를 올리고 이번에 채운 과제를 돌려준다(덤은 가방에). 연구 완료면 "done" 도 붙는다.
static func record(kind: String, tags: Array) -> Array[String]:
	var fresh: Array[String] = []
	if not on() or Hunt.def(kind).is_empty():
		return fresh
	var was_complete := complete(kind)
	var st := state()
	if not st.has(kind):
		st[kind] = {}
	var row: Dictionary = st[kind]
	var allowed := tasks_of(kind)
	for t in tags:
		if not allowed.has(String(t)):
			continue
		var before := int(row.get(t, 0))
		row[t] = before + 1
		if before < goal_of(kind) and before + 1 >= goal_of(kind):
			fresh.append(String(t))
			PartyState.add_items(TASK_REWARD.duplicate())
	if not was_complete and complete(kind):
		fresh.append("done")
		PartyState.add_items(DONE_REWARD.duplicate())
	return fresh


## 사냥 기록 줄 끝 글자 — "연구 2/4" · 다 채우면 "연구 완료".
static func row_text(kind: String) -> String:
	return "연구 완료" if complete(kind) else "연구 %d/%d" % [done_count(kind), tasks_of(kind).size()]


## 줄 마우스 올림 글 — 과제마다 횟수.
static func tooltip(kind: String) -> String:
	var lines: PackedStringArray = []
	for t in tasks_of(kind):
		lines.append("%s %s %d/%d" % ["✔" if count(kind, t) >= goal_of(kind) else "·", task_name(t), mini(count(kind, t), goal_of(kind)), goal_of(kind)])
	return "\n".join(lines)
