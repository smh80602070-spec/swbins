extends RefCounted

## G-0247 난도 평(平)·험(險)·절(絕) — 웹 saga-web/saga-dungeon/src/dungeon/02-run.js
## MODES 를 그대로 옮긴다(원작 노멀·나이트메어·헬). autoload 를 늘리지 않으려고
## 정적 변수 둘(고른 난도·이번 회차 난도)만 든 스크립트 — 쓰는 쪽은 preload 한다.
##
## 회차 고정: 웹 mode() 는 "run 이 있으면 run.mode, 없으면 고른 값". 이 슬라이스는
## 세이브 파일이 곧 회차라(dungeon_run_state.gd 헤더) 던전 씬이 열릴 때
## (test_room.gd _ready, 적을 세우기 직전) begin_run() 이 고른 값을 굳힌다.
## 그 뒤 HUD 에서 바꾼 값은 다음 회차(다시 열 때)부터 — 이미 선 적과 금·노획이
## 한 회차 안에서 서로 다른 난도로 갈리지 않는다.
##
## 문턱(웹 10층·20층 대신): 험 = 3번 방(첫 보스) · 절 = 6번 방(둘째 보스)을 깬 뒤.
## 티켓 제안(험 = 일곱 방 완주 · 절 = 부적 티어 3 완주)은 이 슬라이스에서 깬 방이
## 다시 안 살아나 — 열리는 순간 그 세이브엔 싸울 적이 남지 않는다(측정 메모 G-0247).
## 웹도 "최고 층" 하나로 여니 같은 꼴로 "깬 방 수" 하나로 연다.
##
## exp 는 고돗 나락에 경험치 자리가 없어 뺐다. 난입·월드 보스는 평 고정(그쪽 적은
## mode 를 안 곱한다 — dungeon_enemy.gd _init 의 use_mode).

const MODES: Array[Dictionary] = [
	{"key": "normal", "name": "평(平)", "need": 0, "hp": 1.0, "dmg": 1.0, "bias": 0, "gold": 1.0, "resist": 0,
		"desc": "처음 내려가는 길."},
	{"key": "hard", "name": "험(險)", "need": 3, "hp": 1.8, "dmg": 1.5, "bias": 12, "gold": 1.6, "resist": 10,
		"desc": "적이 두 배 가까이 버티고 손도 맵다. 저항도 붙는다. 대신 나오는 것이 좋아진다."},
	{"key": "hell", "name": "절(絕)", "need": 6, "hp": 3.2, "dmg": 2.2, "bias": 26, "gold": 2.4, "resist": 20,
		"desc": "한 대가 치명적이다. 저항이 두껍다. 부문(符文)도 여기서 잘 나온다."},
]

static var chosen: String = "normal"   # 고른 난도(세이브 "mode" 칸)
static var run_mode: String = ""       # 이번 회차에 굳은 난도("" = 회차 밖)


static func mode_of(key: String) -> Dictionary:
	for m: Dictionary in MODES:
		if String(m.key) == key:
			return m
	return MODES[0]


## 깬 방 수(웹 dstate().best — 최고 층 자리)
static func best_rooms() -> int:
	var save: Node = Engine.get_main_loop().root.get_node_or_null("DungeonSaveState") if Engine.get_main_loop() is SceneTree else null
	return (save.rooms_cleared as Array).count(true) if save != null else 0


static func open_modes(best: int = -1) -> Array[Dictionary]:
	if best < 0:
		best = best_rooms()
	var out: Array[Dictionary] = []
	for m: Dictionary in MODES:
		if best >= int(m.need):
			out.append(m)
	return out


static func is_open(key: String, best: int = -1) -> bool:
	if best < 0:
		best = best_rooms()
	return best >= int(mode_of(key).need)


## 웹 setMode — 닫힌 난도는 거절. 회차 중이면 다음 회차부터(mode() 는 run_mode).
static func set_mode(key: String, best: int = -1) -> bool:
	var m := mode_of(key)
	if String(m.key) != key or not is_open(key, best):
		return false
	chosen = key
	return true


## 회차 시작 — 고른 값이 (세이브가 바뀌어) 닫혀 있으면 평으로.
static func begin_run(best: int = -1) -> void:
	run_mode = chosen if is_open(chosen, best) else "normal"


static func end_run() -> void:
	run_mode = ""


static func in_run() -> bool:
	return run_mode != ""


static func mode() -> Dictionary:
	return mode_of(run_mode if run_mode != "" else chosen)


## 세이브 왕복 — 옛 세이브(칸 없음)·모르는 값은 "normal"
static func restore(v: Variant) -> void:
	var k := String(v) if v is String else "normal"
	chosen = String(mode_of(k).key)
