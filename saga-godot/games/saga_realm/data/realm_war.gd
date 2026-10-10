extends RefCounted

## war.js의 `armyPower()`/`stepRound()`/`fight()`를 좁혀 옮긴 것(2026-09-12,
## "전쟁 외교 이어해"). **판정식은 그대로**(0.055·0.85+0.3·ROUT=0.35·성벽
## 배율 0.9·공성 배율 0.045 전부 원작 값) — 다만 이 슬라이스가 아직 안
## 가진 것은 뺐다:
## - 진형(formation)·일기토(duel) — 장수 능력치 문턱·확률 판정이 따로
##   있어 이 첫 전투 슬라이스엔 안 들였다(mul=1 고정과 같은 결).
## - 수전(water)·화공(fire)·배(ships) — 이 슬라이스의 유일한 목표(소패)가
##   뭍길이라 필요 없다.
## - 진영(camp, 여러 달에 걸치는 원정) — 승부가 안 갈리면(stalemate)
##   원작은 성 밖에 진을 치고 다음 달에 잇는데, 이 슬라이스는 그 자리에
##   진영 시스템이 없어 **routed와 같이 취급**한다(살아남은 병력이 그냥
##   돌아간다) — `realm_save_state.gd attack()`이 이 재해석을 적용한다.
##
## 적 쪽(수비)은 처음엔 이름 있는 장수가 없었다 — armyPower()의 "장수
## 없는 부대" 분기(`officer_count<=0` → lead=0.6)를 그대로 썼다.
## **2026-09-12 갱신 — 이간·매수 슬라이스가 소패에 수비 무장(sg_guanyu·
## sg_zhangfei)을 들이면서 이 분기가 실제로 갈리게 됐다** —
## `realm_save_state.gd attack()`이 `enemies[eid].officers`(매수·이간·
## 함락으로 줄어든다)를 그대로 넘긴다. 함수 자체는 안 바뀌었다 — 애초에
## officer_count가 0이 아닌 경우도 다뤘던 일반식이라 새로 손댈 게 없다.

const ROUNDS := 10   # war.js ROUNDS — 한 달에 붙는 횟수
const ROUT := 0.35   # war.js ROUT — 처음 병력의 이만큼까지 줄면 물러난다


## war.js armyPower() — 진형·수전(navy)·사기(morale)를 뺀 나머지는 그대로.
## officer_count<=0이면 "장수 없는 부대"(lead=0.6, war.js의 extra===0 분기).
static func army_power(troops: int, train: int, tech: int,
		best_command: float, best_might: float, officer_count: int) -> float:
	var train_f := 0.5 + clampf(float(train), 0.0, 100.0) / 200.0
	var tech_f := 0.7 + clampf(float(tech), 0.0, 900.0) / 900.0 * 0.6
	var lead: float
	if officer_count <= 0:
		lead = 0.6
	else:
		lead = 1.0 + best_command / 100.0 * 0.5 + best_might / 100.0 * 0.25 \
			+ maxf(0.0, float(officer_count - 1)) * 0.03
	return float(troops) * train_f * tech_f * lead


## war.js stepRound() — 야전(sortie)·공성 갈림, 병력 손실, 공성 시 성벽
## 깎기, 승부 판정까지 한 합. atk/def/wall은 Dictionary라 그대로 고쳐
## 쓴다(참조 전달 — war.js가 atk.troops -= lossA로 직접 고치던 것과 같은
## 결). rng는 RealmSaveState._rng(고정 시드)를 그대로 받아 진단 결정성을
## 지킨다.
##   atk/def: {troops, start, train, tech, best_command, best_might, officer_count}
##   G-0182 — atk 에 give(공 위력 배율)·take(받는 피해 배율)가 있으면 곱한다(격자 전술 결과, 웹 atk.grid). 없으면 1.0 이라 예전과 비트 단위로 같다.
##   wall:    {wall, max_wall}
static func step_round(atk: Dictionary, def: Dictionary, wall: Dictionary,
		land_def: float, land_siege: float, sortie: bool,
		rng: RandomNumberGenerator) -> Dictionary:
	var wall_f: float
	if sortie:
		wall_f = land_def
	else:
		wall_f = land_def * (1.0 + float(wall.wall) / maxf(1.0, float(wall.max_wall)) * 0.9)

	var ap := army_power(int(atk.troops), int(atk.train), int(atk.tech),
		float(atk.best_command), float(atk.best_might), int(atk.officer_count)) * float(atk.get("give", 1.0))
	var dp := army_power(int(def.troops), int(def.train), int(def.tech),
		float(def.best_command), float(def.best_might), int(def.officer_count)) * wall_f

	var loss_a := roundi(dp * 0.055 * (0.85 + rng.randf() * 0.3) * float(atk.get("take", 1.0)))
	var loss_d := roundi(ap * 0.055 * (0.85 + rng.randf() * 0.3))
	atk.troops = maxi(0, int(atk.troops) - loss_a)
	def.troops = maxi(0, int(def.troops) - loss_d)

	if not sortie:
		wall.wall = maxi(0, roundi(float(wall.wall) - float(atk.troops) * 0.045 * land_siege))

	var outcome := ""
	if int(def.troops) <= 0:
		outcome = "won"
	elif float(atk.troops) <= float(atk.start) * ROUT:
		outcome = "routed"
	elif not sortie and int(wall.wall) <= 0 and float(def.troops) < float(atk.troops) * 0.5:
		outcome = "won"
	elif not sortie and float(def.troops) <= float(atk.troops) * 0.08:
		outcome = "won"
	elif sortie and float(def.troops) < float(atk.troops) * 0.25:
		outcome = "won"

	return {"loss_a": loss_a, "loss_d": loss_d, "outcome": outcome}


## war.js fight() — 최대 ROUNDS합을 굴려 승부를 낸다. sortie는 war.js
## fightIntro()처럼 싸움 시작 때 한 번만 정해진다(합마다 다시 안 잰다).
static func fight(atk: Dictionary, def: Dictionary, wall: Dictionary,
		land_def: float, land_siege: float, rng: RandomNumberGenerator) -> Dictionary:
	var sortie: bool = float(def.troops) > float(atk.troops) * 0.85
	var wall_from: int = int(wall.wall)
	var won := false
	var routed := false
	for _r in ROUNDS:
		var res := step_round(atk, def, wall, land_def, land_siege, sortie, rng)
		if res.outcome == "won":
			won = true
			break
		elif res.outcome == "routed":
			routed = true
			break

	return {
		"won": won, "routed": routed, "sortie": sortie,
		"loss_a": int(atk.start) - int(atk.troops), "loss_d": int(def.start) - int(def.troops),
		"wall_from": wall_from, "wall_to": int(wall.wall),
		"atk_troops_left": int(atk.troops), "def_troops_left": int(def.troops),
	}


## PLAN 101-2 REALM ④후보(웹판 §5-3 "일기토") — 원작 duel()의 hits[]
## 판정을 대체하지 않고 배율로 얹는다는 규칙 그대로, 다만 이 슬라이스의
## `fight()`는 10합을 뭉쳐 도는 집계식이라 "합마다"가 아니라 **싸움 전체에
## 한 번** 곱한다(3합 결과를 평균 배율 하나로 뭉친 재해석). 실시간 타이밍
## 입력은 안 넣는다(턴제 판, PLAN 105-Q3와 같은 결).
const DUEL_ROUNDS := 3
const DUEL_MOVES: Array[String] = ["slash", "stab", "guard"]  # 베기·찌르기·막기
const DUEL_MOVE_NAME := {"slash": "베기", "stab": "찌르기", "guard": "막기"}
const DUEL_WIN_MUL := 1.3   # 웹판 §5-3 "이기면 ×1.3"
const DUEL_TIE_MUL := 1.0   # "비기면 ×1.0"
const DUEL_LOSE_MUL := 0.8  # "지면 ×0.8"

## 베기>막기·막기>찌르기·찌르기>베기(가위바위보와 같은 순환).
static func duel_beats(move: String) -> String:
	match move:
		"slash": return "guard"
		"guard": return "stab"
		"stab": return "slash"
	return ""


static func duel_round_result(player_move: String, enemy_move: String) -> String:
	if player_move == enemy_move:
		return "tie"
	return "win" if duel_beats(player_move) == enemy_move else "lose"


static func duel_round_mul(result: String) -> float:
	match result:
		"win": return DUEL_WIN_MUL
		"lose": return DUEL_LOSE_MUL
		_: return DUEL_TIE_MUL


static func duel_ai_move(rng: RandomNumberGenerator) -> String:
	return DUEL_MOVES[rng.randi_range(0, DUEL_MOVES.size() - 1)]
