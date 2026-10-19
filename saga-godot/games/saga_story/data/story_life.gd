extends RefCounted

## G-0238 4종횡 생활 기술 랭크 — 웹 saga-story/js/life.js(W-0283) 의 채집 몫만(요리·연주는 고돗 4종횡에 행동이 없어 뺌).
## 캘 때마다 경험 1(🍀 구간 2) · 랭크 F→E→D→C→B→A→3→2→1(9단) · 오를 때마다 "두 개" 확률 +1/8(랭크 1 은 늘 둘).
## 순수 함수 — 경험은 StorySaveState.life[k](사전, 요리·연주 자리 남김), rng 는 부르는 쪽이 넣는다.

const RANKS := ["F", "E", "D", "C", "B", "A", "3", "2", "1"]
const NEED := [20, 40, 60, 90, 120, 160, 200, 250]   # 랭크 i → i+1 에 드는 경험(누적 940)
const SKILLS := {
	"gather": {"name": "채집", "emoji": "🌿"},
}


## 랭크 번호 0(F)~8(1)
static func rank_idx(xp: int) -> int:
	var i := 0
	while i < NEED.size() and xp >= int(NEED[i]):
		xp -= int(NEED[i])
		i += 1
	return i


static func rank_of(xp: int) -> String:
	return RANKS[rank_idx(xp)]


## 다음 랭크까지 {idx, rank, xp(이 단에서 쌓인 것), need(끝이면 0)}
static func progress(xp: int) -> Dictionary:
	var i := 0
	while i < NEED.size() and xp >= int(NEED[i]):
		xp -= int(NEED[i])
		i += 1
	return {"idx": i, "rank": RANKS[i], "xp": xp, "need": int(NEED[i]) if i < NEED.size() else 0}


## 채집 — 이번에 더 나오는 개수(0/1). 랭크 F 는 늘 0, 랭크 1(idx 8) 은 늘 1.
static func extra(idx: int, rng: RandomNumberGenerator) -> int:
	if idx <= 0:
		return 0
	if idx >= 8:
		return 1
	return 1 if rng.randf() < float(idx) / 8.0 else 0


## 토스트 꼬리 "🌿 채집 D 12/60"(끝 랭크는 "🌿 채집 1")
static func label(k: String, xp: int) -> String:
	var s: Dictionary = SKILLS.get(k, {"name": k, "emoji": ""})
	var p := progress(xp)
	var tail := " %d/%d" % [p.xp, p.need] if int(p.need) > 0 else ""
	return "%s %s %s%s" % [s.emoji, s.name, p.rank, tail]


## 랭크 오름 알림 "🌿 채집 랭크 D — 두 개 확률 2/8"
static func rank_up_text(k: String, idx: int) -> String:
	var s: Dictionary = SKILLS.get(k, {"name": k, "emoji": ""})
	return "%s %s 랭크 %s — 두 개 확률 %d/8" % [s.emoji, s.name, RANKS[idx], mini(idx, 8)]
