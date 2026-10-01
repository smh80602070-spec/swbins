extends RefCounted

## 첫 10분 첫걸음 사명 (G-0012) — 새 세이브에서 목표판 첫 줄에 차례로 뜨는 다섯 가지. 진행 기록은 PartyState.tut(저장 키 "tut").
## 옛 세이브(키 없음)는 다 한 것으로 본다(save_state.gd). 판정·연결은 world/tutorial.gd.

const MISSIONS := [
	{"id": "move", "name": "둘러보기", "hint": "20m 넘게 걷고, 벽이나 절벽에 붙어 올라 보자"},
	{"id": "recruit", "name": "동행 만나기", "hint": "마을 사람을 설득해 동행으로 맞자"},
	{"id": "chest", "name": "상자 열기", "hint": "반짝이는 보물 상자를 열어 보자"},
	{"id": "react", "name": "원소 맞부딪치기", "hint": "다른 원소 공격을 이어 맞혀 반응을 일으켜 보자"},
	{"id": "save", "name": "기록 남기기", "hint": "저장을 한 번 하자(자동 저장도 된다)"},
]


static func ids() -> Array:
	var out := []
	for m in MISSIONS:
		out.append(m.id)
	return out


## 아직 안 한 첫 사명(없으면 빈 사전).
static func current(done: Array) -> Dictionary:
	for m in MISSIONS:
		if not done.has(m.id):
			return m
	return {}


## 목표판 첫 줄 — "첫걸음 2/5 동행 만나기: 마을 사람을 …". 다 했으면 "".
static func line(done: Array) -> String:
	var m := current(done)
	if m.is_empty():
		return ""
	var n := 0
	for x in MISSIONS:
		if done.has(x.id):
			n += 1
	return "첫걸음 %d/%d %s: %s" % [n, MISSIONS.size(), m.name, m.hint]
