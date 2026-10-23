extends RefCounted

## G-0319 4종횡 숨은 우두머리 — 사냥터 안 단서로 여는 숨은 보스(데드 셀 — 구조만). 고돗이 먼저(웹·유니티 짝 없음, 장부 story.md 우선 3 "탐험 동기").
##   단서   보스가 서는 사냥터(field·forest·cave·gorge 넷)의 끝자락(사냥터 오른쪽 끝 − CLUE_INSET_M, 땅 위)에 "옛 비문".
##          닿으면 읽힌다(사냥터마다 한 번 기록 — 세이브 hidden[stage].clue).
##   열기   비문을 읽은 사냥터에서 그 땅 보스를 첫 타부터 FAST_SEC 안에 쓰러뜨리면, RISE_SEC 뒤 같은 자리에 숨은 우두머리가 선다
##          (보스 체력 ×HP_MUL · 피해 ×DMG_MUL · 짙은 보라). 관문 대장(강화판 주)이어도 같다.
##   보상   숨은 우두머리를 잡으면 금 +GOLD × 사냥터 lv(보스 몫 금·경험은 평소 보스대로) · 기록 hidden[stage].beaten +1.
##   저장   StorySaveState.hidden = {stage_key: {clue: bool, beaten: n}} (24→25). SAGA_HIDDEN=0 이면 끔.

const FAST_SEC := 60.0
const RISE_SEC := 2.0
const HP_MUL := 2.5
const DMG_MUL := 1.5
const GOLD := 40
const CLUE_INSET_M := 2.5
const COLOR := Color(0.42, 0.22, 0.62)
const CLUE_TEXT := "📜 옛 비문 — 「이 땅의 우두머리를 숨 예순 번 안에 꺾으면, 그 그림자가 일어선다.」"
const MAPS := [
	"res://games/saga_story/data/field_map.gd",
	"res://games/saga_story/data/forest_map.gd",
	"res://games/saga_story/data/cave_map.gd",
	"res://games/saga_story/data/gorge_map.gd",
]


static func on() -> bool:
	return OS.get_environment("SAGA_HIDDEN") != "0"


static func rec(H: Dictionary, key: String) -> Dictionary:
	if typeof(H.get(key)) != TYPE_DICTIONARY:
		H[key] = {"clue": false, "beaten": 0}
	return H[key]


static func clue_read(H: Dictionary, key: String) -> bool:
	return bool((H.get(key, {}) as Dictionary).get("clue", false))


## 비문 읽기 — 새로 읽었으면 true
static func read_clue(H: Dictionary, key: String) -> bool:
	if not on() or clue_read(H, key):
		return false
	rec(H, key).clue = true
	return true


## 보스가 쓰러진 뒤 — 숨은 우두머리를 세울 때인가(첫 타부터 걸린 초)
static func should_rise(H: Dictionary, key: String, fight_sec: float) -> bool:
	return on() and clue_read(H, key) and fight_sec >= 0.0 and fight_sec <= FAST_SEC


static func beat(H: Dictionary, key: String, lv: int) -> int:
	var r := rec(H, key)
	r.beaten = int(r.beaten) + 1
	return GOLD * maxi(1, lv)


static func is_hunt_map(map_path: String) -> bool:
	return MAPS.has(map_path)
