extends RefCounted
## G-0426 — 2나락 첫 실행 사명. 기록된 행동만 순서대로 완료한다.
const Guide := preload("res://saga_core/data/first_run_guide.gd")
const MISSIONS := [
	{"id":"move", "name":"굴을 살피기", "hint":"첫 방을 돌아다니며 출구와 적을 살펴보자"},
	{"id":"fight", "name":"첫 방 정리", "hint":"방의 적을 모두 물리쳐 길을 열자"},
	{"id":"recruit", "name":"동행 맞이", "hint":"역사 인물을 만나 부대에 합류시키자"},
	{"id":"skill", "name":"무예 사용", "hint":"장착한 무예나 기술을 전투에서 써 보자"},
	{"id":"save", "name":"기록 남기기", "hint":"저장 단추를 눌러 진행을 기록하자"},
]
static func line(done: Array) -> String: return Guide.line(MISSIONS, done)
static func complete(done: Array, id: String) -> bool: return Guide.complete_next(MISSIONS, done, id)
static func legacy_done() -> Array[String]: return Guide.legacy_complete(MISSIONS)
