extends RefCounted
## G-0426 — 5천하 첫 실행 사명.
const Guide := preload("res://saga_core/data/first_run_guide.gd")
const MISSIONS := [
	{"id":"map", "name":"천하 살피기", "hint":"월드맵을 열어 우리 성과 주변 세력을 살펴보자"},
	{"id":"order", "name":"첫 명령", "hint":"장수에게 내정 또는 군사 명령을 하나 내리자"},
	{"id":"hire", "name":"인재 등용", "hint":"수색으로 만난 장수를 우리 편에 들이자"},
	{"id":"month", "name":"다음 달로", "hint":"준비를 마치면 다음 달로 넘겨 정산을 보자"},
	{"id":"save", "name":"기록 남기기", "hint":"저장 단추를 눌러 진행을 기록하자"},
]
static func line(done: Array) -> String: return Guide.line(MISSIONS, done)
static func complete(done: Array, id: String) -> bool: return Guide.complete_next(MISSIONS, done, id)
static func legacy_done() -> Array[String]: return Guide.legacy_complete(MISSIONS)
