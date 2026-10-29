extends RefCounted
## G-0426 — 4종횡 첫 실행 사명.
const Guide := preload("res://saga_core/data/first_run_guide.gd")
const MISSIONS := [
	{"id":"move", "name":"사냥터 걷기", "hint":"사냥터를 걸으며 적과 채집물을 찾아보자"},
	{"id":"fight", "name":"첫 승리", "hint":"사냥터의 적을 하나 물리치자"},
	{"id":"gather", "name":"재료 줍기", "hint":"들꽃을 모아 무예와 장비 성장에 쓰자"},
	{"id":"talk", "name":"사명 확인", "hint":"허도의 주민에게 말을 걸어 사명을 확인하자"},
	{"id":"save", "name":"기록 남기기", "hint":"저장 단추를 눌러 진행을 기록하자"},
]
static func line(done: Array) -> String: return Guide.line(MISSIONS, done)
static func complete(done: Array, id: String) -> bool: return Guide.complete_next(MISSIONS, done, id)
static func legacy_done() -> Array[String]: return Guide.legacy_complete(MISSIONS)
