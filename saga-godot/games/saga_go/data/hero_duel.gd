extends RefCounted

## G-0397 1만리 등용 「⚔️ 무(武)로 겨루자」 = 실시간 결투(웹 W-0430 짝 — 웹 field-combat ⑯ duelCamp 를 고돗 들판 전투 꼴로 좁힘).
##   판     인물 하나(들판 적 kind "duel_hero", 그 인물 몸) + ★3 졸개 하나·★4~5 둘(떠돌이 도적 몸) — 인물이 서 있던 자리에.
##          인물 체력 = HP_BASE × (1.6 + 0.7×★) · 공격 = ATK_BASE × (0.9 + 0.12×★)(웹 식 그대로, 바탕은 고돗 들판 늑대 값) — 세계 등급 배율은 들판 적과 같이.
##          웹의 원소 방패 겹(★4·5)은 고돗 사람 몸 적에 방패 길이 없어 뺐다.
##   끝     인물이 쓰러지면 이김 → 굴복 · 등용(옛 설득 성공과 같은 _recruit) · 명단이 다 쓰러지면(field_combat party_wiped) 짐 → 떠남(옛 실패)
##          · 판 가운데서 FLEE_M 넘게 멀어지면 물러남(판 걷힘, 다시 다가가면 처음부터) · 졸개는 이기든 지든 함께 걷힌다.
## 지·덕 설득은 옛 굴림 그대로. SAGA_HERO_DUEL=0 이면 무도 옛 굴림.

const HP_BASE := 220.0
const ATK_BASE := 14.0
const FLEE_M := 30.0
const RETINUE_GAP := 3.2


static func on() -> bool:
	return OS.get_environment("SAGA_HERO_DUEL") != "0"


## 판 — {hp, atk, minions: [Vector3 자리 차이…]} · 순수
static func camp(rarity: int) -> Dictionary:
	var r := clampi(rarity, 1, 5)
	var n := 2 if r >= 4 else (1 if r >= 3 else 0)
	var spots: Array = []
	for i in n:
		spots.append(Vector3(RETINUE_GAP if i == 0 else -RETINUE_GAP, 0.0, 2.4))
	return {"hp": roundf(HP_BASE * (1.6 + 0.7 * float(r))), "atk": roundf(ATK_BASE * (0.9 + 0.12 * float(r))), "minions": spots}


## 결과 — "win"·"lose"·"flee"·""(아직) · 순수
static func result(hero_alive: bool, wiped: bool, player_dist: float) -> String:
	if not hero_alive:
		return "win"
	if wiped:
		return "lose"
	if player_dist > FLEE_M:
		return "flee"
	return ""
