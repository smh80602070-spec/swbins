class_name PersuadeRules
extends RefCounted

## GO 사건 다양화 확장(2026-09-11⑱) — 웹판 js/encounter.js의 "3라운드 설득"
## 판정 층(doAppeal)을 상수 하나 안 바꾸고 그대로 옮긴다(duel_rules.gd가
## duel.js를 그대로 옮긴 것과 같은 원칙, VERTICAL_SLICE.md 34절 "새로
## 설계하지 않는다"). 화면(games/saga_go/world/hero_encounter.gd)만 다르다.
##
## partyStatBonus(부대 평균 무/지/통 스탯이 설득 성공률을 살짝 올려주는
## 웹판 보너스)는 뺐다 — 이 판의 PartyState는 atk/def뿐이라 might/wisdom/
## command 개념이 없다. 골드·등용서·명성 비용을 이미 안 옮긴 것과 같은
## 경계(하위 시스템이 없어야 못 붙는 부분만 생략, 호감도 판정 자체는
## 웹판 수치 그대로).

const MAX_ROUND := 3
const NEED_FAVOR := 100.0
## 기질과 맞는 어필(hit) — 34~48. 셋 다 맞히면 반드시 성공하도록(웹판
## 주석 그대로: 34*3=102 > 100) 하한을 잡아 둔 값이다.
const HIT_MIN := 34.0
const HIT_RANGE := 14.0
## 안 맞는 어필(miss) — 8~18.
const MISS_MIN := 8.0
const MISS_RANGE := 10.0

var hero_trait: String = ""
var round_num: int = 1
var favor: float = 0.0
var done: bool = false
var succeeded: bool = false

static func create(trait_in: String) -> PersuadeRules:
	var s := PersuadeRules.new()
	s.hero_trait = trait_in
	return s

## key: "might" | "wisdom" | "virtue". 이미 끝났으면(done) 아무 것도 안 한다.
func appeal(key: String) -> Dictionary:
	if done:
		return {"ok": false}
	var hit := key == hero_trait
	var base: float = (HIT_MIN + randf() * HIT_RANGE) if hit else (MISS_MIN + randf() * MISS_RANGE)
	base *= preload("res://games/saga_go/data/go_starchart.gd").recruit_mul()   # G-0215 성도 설득(야행·큰 그물) — 굴림 뒤에 곱만
	favor += base
	var this_round := round_num
	round_num += 1
	if favor >= NEED_FAVOR:
		done = true
		succeeded = true
	elif round_num > MAX_ROUND:
		done = true
		succeeded = false
	return {"ok": true, "hit": hit, "gained": base, "favor": favor, "round": this_round, "done": done, "succeeded": succeeded}
