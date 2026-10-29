extends RefCounted
## G-0426 — 3마을 첫 실행 사명.
const Guide := preload("res://saga_core/data/first_run_guide.gd")
const MISSIONS := [
	{"id":"move", "name":"마을 둘러보기", "hint":"집과 주민이 있는 마을 길을 걸어 보자"},
	{"id":"gather", "name":"첫 채집", "hint":"나무·바위·풀숲에서 재료를 하나 모으자"},
	{"id":"talk", "name":"주민 만나기", "hint":"마을 주민에게 말을 걸자"},
	{"id":"quest", "name":"부탁 돕기", "hint":"주민의 부탁 하나를 끝내자"},
	{"id":"save", "name":"기록 남기기", "hint":"저장 단추를 눌러 진행을 기록하자"},
]
static func line(done: Array) -> String: return Guide.line(MISSIONS, done)
static func complete(done: Array, id: String) -> bool: return Guide.complete_next(MISSIONS, done, id)
static func legacy_done() -> Array[String]: return Guide.legacy_complete(MISSIONS)
