extends RefCounted

## 별배 재출항 = 회차 (2026-09-30 새 시스템) — 이야기를 끝낸 뒤 다시 도는 길. 이야기·도감·인물·무기는 그대로 두고 세계를 새로 연다.
##   조건 — 이야기 41장까지 끝(Story.all_done) · 모험 등급 REQ_AR 이상 · 회차 MAX_CYCLE 미만.
##   재출항 — PartyState.cycle +1. ① 열어 둔 상자(chest_*)가 되살아난다 ② 채집 자리 회복 ③ 주간 비경 횟수·밤의 잔불 초기화
##            ④ 세계 등급 낮춤 해제 ⑤ 보상 CYCLE_REWARD.
##   영구 — 회차마다 공격력·경험치 +5%. 세계 등급 상한이 회차당 +2(9~18, 모험 등급 45·50·…로 하나씩 열린다):
##            적 체력 +35%·공격 +22%·냥 전리품 +25% 가 등급마다 더 붙는다(adventure.gd 가 그대로 이어 계산).
## 규칙·수치는 여기, 상태는 PartyState.cycle, 화면은 world/cycle_screen.gd.

const Story := preload("res://games/saga_go/data/story.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")

const REQ_AR := 40
const MAX_CYCLE := 5
const BONUS_PER_CYCLE := 0.05
const CYCLE_REWARD := {"mora": 20000, "book_l": 2, "fate_knot": 3}
const CYCLE_EXP := 200.0


static func story_done() -> bool:
	return Story.all_done(int(PartyState.story.get("ch", 0)))


## 재출항할 수 없는 까닭(가능하면 "").
static func blocker() -> String:
	if PartyState.cycle >= MAX_CYCLE:
		return "이미 마지막 회차(%d)다" % MAX_CYCLE
	if not story_done():
		return "이야기를 끝까지 마쳐야 한다 (지금 %d/%d장)" % [int(PartyState.story.get("ch", 0)), Story.CHAPTERS.size()]
	if Adventure.ar() < REQ_AR:
		return "모험 등급 %d 이상이어야 한다 (지금 %d)" % [REQ_AR, Adventure.ar()]
	return ""


static func bonus() -> float:
	return BONUS_PER_CYCLE * float(PartyState.cycle)


## 재출항한다. 결과 {"chests": 되살린 상자 수, "cycle": 새 회차} — 못 하면 {"error": 까닭}.
static func advance() -> Dictionary:
	var err := blocker()
	if err != "":
		return {"error": err}
	PartyState.cycle += 1
	var kept: Array[String] = []
	var chests := 0
	for id in EventState.resolved:
		if String(id).begins_with("chest_"):
			chests += 1
		else:
			kept.append(id)
	EventState.resolved = kept
	PartyState.gather_t.clear()
	PartyState.weekly = {}
	PartyState.night_echo = {}
	PartyState.wl_lowered = false
	PartyState.add_items(CYCLE_REWARD)
	PartyState.add_exp(CYCLE_EXP)
	PartyState.refresh_power()
	PartyState.world_changed.emit()
	return {"chests": chests, "cycle": PartyState.cycle}
