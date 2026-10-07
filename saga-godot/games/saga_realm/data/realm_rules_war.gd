class_name RealmRulesWar
extends RealmRules

## 사가천하 경영 규칙 2층 — 적 AI·전쟁·외교(화친·조공)·계략·승패 판정·정복 편입. 상속 사슬은 realm_rules.gd 머리 참고.

const AI_MARCH_CHANCE := 0.20  # 재해석 — 아래 _run_enemy_ai() 머리말 참고
const AI_TROOPS_FLOOR := 500   # attack()의 "오백은 넘겨야 군대라 하지요"와 같은 문턱


## rtk-ai.js의 "사람이 다음 달을 누르면 나머지 세력이 제 명령을 쓴다"를
## 좁혀 옮긴 것(2026-09-14, 4절 "제외" 타 세력 AI 첫 슬라이스, "묻지말고
## 이어해" → 같은 날 이어서 "묻지말고 이어해" 두 번째로 creed 차등 추가).
## **재해석 — 셋.**
## - **creed(성향) 차등 — `RealmCities.CREED`/`creed_chance_mul()`로
##   옮겼다.** 단, rtk-ai.js 자체엔 "친다/안 친다" 확률표가 없다(실제
##   판단은 매번 war.forecast()로 다시 계산한다) — 이 슬라이스엔 그
##   예측 판정이 없어, creed를 "얼마나 자주 치려 드는가"(`AI_MARCH_
##   CHANCE * creed_chance_mul()`, aggressive 1.5배·turtle 0.35배)로
##   옮겨 놓은 단순화다. 경제 성장 AI(pickOrder)를 옮길 때 이 표를
##   다시 쓸 것(같은 CREED, 다른 쓰임).
## - **AI가 이겨도 성을 뺏지 않는다.** 세력 멸망/패배 판정이 이
##   슬라이스에 없어(attack() 머리말·4절 "제외" 참고) 플레이어가 성을
##   전부 잃는 막다른 상태를 만들 수 있으면 안 된다 — 병력·성벽 손실만
##   입힌다. 승패 판정 자체(war.js와 같은 공식)는 그대로 굴린다 —
##   그 결과로 만들어진 troops/wall 변화만 실제로 반영한다.
## - **주인 없는 성(재야 수비대, force가 빈 문자열)은 움직이지 않는다**
##   — diplo.js의 "주인 없는 성은 계략 대상이 아니다"와 같은 결(
##   `realm_diplo_button.gd`/`realm_plot_button.gd`가 이미 이 가드를
##   쓴다). 화친 중(`diplomacy[].truce_months>0`)이면 마찬가지로 쉰다
##   (war.js canMarch()의 diplo.blocked() 체크와 같은 자리).
func _run_enemy_ai() -> Array:
	var messages: Array = []
	for enemy_id: String in enemies.keys():
		var e: Dictionary = enemies[enemy_id]
		if bool(e.get("captured", false)):
			continue
		var enemy_def := RealmCities.enemy_by_id(enemy_id)
		var force_id := force_of(enemy_id)
		if force_id.is_empty():
			continue
		var dip: Dictionary = diplomacy.get(force_id, {})
		if int(dip.get("truce_months", 0)) > 0:
			continue
		if int(e.troops) < AI_TROOPS_FLOOR:
			continue
		var target_id := _weakest_adjacent_playable(enemy_id)
		if target_id.is_empty():
			continue
		var chance := AI_MARCH_CHANCE * RealmCities.creed_chance_mul(force_id)
		if _rng.randf() > chance:
			continue
		var msg := _enemy_attack(enemy_id, e, target_id)
		if not msg.is_empty():
			messages.append(msg)
	if not messages.is_empty():
		Toast.show(self, "\n".join(messages), 3.0 + float(messages.size()))
	return messages


## 이 적 성과 맞닿은 우리 성(playable_ids가 아니라 cities — 정복 여부와
## 무관하게 실제 우리 살림이 있는 성만 노린다) 중 병력이 가장 적은 곳.
func _weakest_adjacent_playable(enemy_id: String) -> String:
	var best_id := ""
	var best_troops := -1
	for city_id: String in cities.keys():
		if not RealmCities.is_adjacent(enemy_id, city_id):
			continue
		var t := int(cities[city_id].troops)
		if best_id.is_empty() or t < best_troops:
			best_id = city_id
			best_troops = t
	return best_id


## war.js march()+fight()를 적 쪽 시점으로 좁혀 옮긴 것 — attack()과
## 판정식은 완전히 같다(RealmWar.fight 그대로), 공격/수비 배역만 뒤집힌다.
## 수비 측(우리) 병력은 그 성의 troops 전부, 장수는 officer_city로 배치된
## 사람 **전원**(off.atCity()와 같은 뜻) — player attack()이 공격 측에서
## 하나만 데려가는 것과 다르다(수비는 원래도 그 성에 있는 사람 전부가
## 함께 막는다).
func _enemy_attack(enemy_id: String, e: Dictionary, target_id: String) -> String:
	var enemy_def := RealmCities.enemy_by_id(enemy_id)
	var c: Dictionary = cities[target_id]

	var def_officers: Array = []
	for id: String in roster:
		if officer_city.get(id, "") == target_id:
			def_officers.append(id)
	var def_best_command := 0.0
	var def_best_might := 0.0
	for oid: String in def_officers:
		def_best_command = maxf(def_best_command, _effective_stat(oid, "command"))
		def_best_might = maxf(def_best_might, _effective_stat(oid, "might"))
	var def_army := {
		"troops": int(c.troops), "start": int(c.troops), "train": int(c.train), "tech": int(c.tech),
		"best_command": def_best_command, "best_might": def_best_might, "officer_count": def_officers.size(),
	}

	var atk_officers: Array = e.get("officers", [])
	var atk_best_command := 0.0
	var atk_best_might := 0.0
	for oid: String in atk_officers:
		if Characters.find(oid) == null:
			continue
		atk_best_command = maxf(atk_best_command, _effective_stat(oid, "command"))
		atk_best_might = maxf(atk_best_might, _effective_stat(oid, "might"))
	var atk_army := {
		"troops": int(e.troops), "start": int(e.troops), "train": int(e.train), "tech": int(e.tech),
		"best_command": atk_best_command, "best_might": atk_best_might, "officer_count": atk_officers.size(),
	}

	var wall := {"wall": int(c.wall), "max_wall": RealmCities.wall_cap(target_id)}
	var land: String = String(RealmCities.any_by_id(target_id).get("land", "plain"))
	var rep := RealmWar.fight(atk_army, def_army, wall, RealmCities.land_def(land), RealmCities.land_siege(land), _rng)

	c.wall = wall.wall
	c.troops = rep.def_troops_left
	e.troops = rep.atk_troops_left
	enemies[enemy_id] = e

	var enemy_name := String(enemy_def.get("name", enemy_id))
	var city_name := String(RealmCities.any_by_id(target_id).get("name", target_id))
	if rep.won:
		return "⚔️ %s 이(가) %s 을(를) 쳐 성이 크게 흔들렸다 (아군 손실 %d · 적 손실 %d)" % \
			[enemy_name, city_name, int(rep.loss_d), int(rep.loss_a)]
	return "⚔️ %s 이(가) %s 을(를) 쳤으나 물리쳤다 (아군 손실 %d · 적 손실 %d)" % \
		[enemy_name, city_name, int(rep.loss_d), int(rep.loss_a)]


## rtk-ai.js pickOrder()를 적 세력 쪽으로 좁혀 옮긴 것(2026-09-14, "묻지말고
## 이어해" 네 번째 — 4절 "제외" 셋 중 economy AI). **재해석 — 적(enemies)은
## agri/comm/gold/pop을 안 갖는다(`_init_enemies()` 참고, 원래 전투용
## 값만 있었다)** — pickOrder 우선순위 중 이 슬라이스에 실제로 있는 필드
## (sec/wall/train/tech)만 옮기고 나머지(agri·comm·draft·ships)는 뺐다.
## 금 소모도 없다 — 적에게 금고 자체가 없어(플레이어처럼 명령을 "사는"
## 구조가 아니다), 세력이 살아 있는 한(captured=false, 장수 1명 이상)
## 매달 그대로 자란다.
## 이게 없으면 한 번 계략·전투로 깎인 적 성은 영영 그 값에 멈춰 있었다 —
## troops/wall/sec/train/tech 중 내려가는 경로(전투·`realm_plot_button.gd`
## 유언비어)는 있어도 올라가는 경로가 하나도 없어, 플레이어가 초반에 계속
## 같은 약한 이웃만 노려도 손해가 없었다.
func _run_enemy_economy() -> void:
	for enemy_id: String in enemies.keys():
		var e: Dictionary = enemies[enemy_id]
		if bool(e.get("captured", false)):
			continue
		var officers: Array = e.get("officers", [])
		if officers.is_empty():
			continue
		var key := _enemy_pick_order(e)
		if key.is_empty():
			continue
		var o := RealmOrders.by_key(key)
		var officer_id := _best_enemy_officer(officers, String(o.stat))
		if officer_id.is_empty():
			continue
		var stat_val: float = _effective_stat(officer_id, String(o.stat))
		var crit := _rng.randf() < clampf(stat_val / 400.0, 0.03, 0.28)
		var amount := roundi((float(o.base) + stat_val * float(o.per)) * (1.5 if crit else 1.0))
		match key:
			"sec": e.sec = mini(RealmOrders.CAP_SEC, int(e.sec) + amount)
			"wall": e.wall = mini(int(e.max_wall), int(e.wall) + amount)
			"train": e.train = mini(RealmOrders.CAP_TRAIN, int(e.train) + amount)
			"tech": e.tech = mini(RealmOrders.CAP_TECH, int(e.tech) + amount)
		enemies[enemy_id] = e


## rtk-ai.js pickOrder() 우선순위 그대로, 적에게 있는 네 필드로 좁힌 버전
## (sec<45 → sec, wall<maxWall*0.7 → wall, train<70 → train, tech<400 →
## tech, sec<85 → sec — food/agri/comm/wall(공성 없음)/draft/ships 문턱은
## 이 슬라이스의 enemies에 해당 필드가 없어 전부 뺐다). 넷 다 문턱을 채웠으면
## 빈 문자열(그 성은 이미 다 자랐다 — 아무것도 안 한다).
func _enemy_pick_order(e: Dictionary) -> String:
	if int(e.sec) < 45:
		return "sec"
	if int(e.wall) < int(e.max_wall) * 0.7:
		return "wall"
	if int(e.train) < 70:
		return "train"
	if int(e.tech) < 400:
		return "tech"
	if int(e.sec) < 85:
		return "sec"
	return ""


## rtk-ai.js bestFor() 축약 — 그 명령에 맞는 자질이 가장 높은 적 장수.
func _best_enemy_officer(officers: Array, stat_key: String) -> String:
	var best_id := ""
	var best_val := -1.0
	for oid: String in officers:
		if Characters.find(oid) == null:
			continue
		var v: float = _effective_stat(oid, stat_key)
		if v > best_val:
			best_val = v
			best_id = oid
	return best_id


## rtk.js checkResult() — 승패 판정. 한 번 정해지면(`result`가 빈 문자열이
## 아니면) 그대로 굳는다(원작의 `if (st.result) return st.result;`).
## **"lose"는 이 슬라이스에서 도달 불가능하다** — `_enemy_attack()`이
## 이겨도 성을 안 뺏어 `cities`가 절대 비지 않는다(위 `result` 변수
## 머리말 참고). "win"만 실제로 판정한다 — 성 우주 전체(기본 3 + 정복
## 대상 104 = 107)를 전부 갖게 되면 천하통일.
const CULTURE_VICTORY_CORRECT := 200   # 웹판 §5-5 "학당 문답 정답 200" 그대로
const DIPLOMACY_VICTORY_MONTHS := 36   # 웹판 §5-5 "36달 연속" 그대로


func check_result() -> String:
	if not result.is_empty():
		return result
	if cities.size() >= RealmCities.ids().size() + RealmCities.ENEMY_CITIES.size():
		result = "win"
		_show_victory_card("👑 천하통일", "패업을 이루었다 — 천하가 하나가 되었다.")
	elif int(quiz.get("correct", 0)) >= CULTURE_VICTORY_CORRECT:
		result = "win_culture"
		_show_victory_card("📚 문화의 으뜸", "학당 문답 %d개를 맞혀 학식으로 천하의 으뜸이 되었다." % CULTURE_VICTORY_CORRECT)
	elif diplomacy_peace_streak >= DIPLOMACY_VICTORY_MONTHS:
		result = "win_diplomacy"
		_show_victory_card("🕊️ 화친의 시대", "%d달 동안 살아있는 모든 세력과 화친을 지켰다." % DIPLOMACY_VICTORY_MONTHS)
	return result


## 웹판 §5-5 "결과 카드"(걸린 달·성·인물·기록) 재해석 — 이 슬라이스가
## 가진 값(연월·성·로스터)만 3줄로 좁혔다("인물 5인"·"다음 도전"은 아직
## 없는 시스템이라 뺐다). GO/FOREST/STORY save_button.gd와 같은
## SessionCard 패턴.
func _show_victory_card(title: String, sub: String) -> void:
	SessionCard.show(self, title, [
		sub,
		"%d년 %d월" % [year, month],
		"성 %d개 · 로스터 %d명" % [cities.size(), roster.size()],
	])


## 웹판 §5-5 "살아 있는 모든 세력과 화친"의 이 슬라이스 판. city_force는
## 시나리오 시작 시점 스냅샷이라(위 _init_city_force() 머리말) "아직 우리
## 것이 안 된 성이 남은 force"만 본다 — diplomacy.keys()를 그대로 쓰면
## 이미 멸망한(성을 다 뺏은) 세력의 죽은 항목까지 세게 된다.
func _all_alive_forces_at_peace() -> bool:
	var checked: Dictionary = {}
	for eid: String in city_force:
		if cities.has(eid):
			continue
		var fid: String = String(city_force[eid])
		if fid.is_empty() or checked.has(fid):
			continue
		checked[fid] = true
		var dip: Dictionary = diplomacy.get(fid, {"truce_months": 0})
		if int(dip.get("truce_months", 0)) <= 0:
			return false
	return true


## rtk.js war.js moveOfficer() — 무장을 맞닿은 성으로 옮긴다(그 달의 명령을
## 쓴다). 이 슬라이스는 성 셋이 전부 우리 것이라 원작의 `to.force !== r.force`
## 체크(남의 성인가)는 늘 통과 — 맞닿음과 "이 달에 이미 명령을 썼는가"만
## 실제로 갈린다. 태수(`from.gov = null`) 정리는 옮기지 않았다 — 이 슬라이스는
## 태수를 저장하지 않고 `_governor_at()`이 매번 배치를 보고 다시 골라서다.
func transfer_officer(officer_id: String, to_city_id: String) -> Dictionary:
	if not (officer_id in roster):
		return {"ok": false, "why": "로스터에 없는 무장"}
	var from_city: String = officer_city.get(officer_id, "")
	if from_city == to_city_id:
		return {"ok": false, "why": "이미 그 성에 있습니다"}
	if not RealmCities.is_adjacent(from_city, to_city_id):
		return {"ok": false, "why": "맞닿아 있지 않습니다"}
	if _done_this_month.get(officer_id, false):
		return {"ok": false, "why": "이 달에 이미 명령을 썼습니다"}

	officer_city[officer_id] = to_city_id
	_done_this_month[officer_id] = true
	return {"ok": true}


## war.js march()+fight()+finishMarch()를 좁혀 옮긴 것(2026-09-12, "전쟁
## 외교 이어해") — `realm_war.gd`가 판정 자체(armyPower/stepRound/fight)를
## 맡고, 여기는 원작 setupMarch()/finishMarch()가 하던 "출진 준비 → 판정
## 호출 → 뒤처리"만 좁혀서 한다. **재해석**:
## - 수량 선택 UI가 없다 — `from_city`에 있는 **전군**을 보낸다(이 판
##   다른 명령들처럼 버튼 하나로 결과만 보는 것과 같은 결).
## - 원정 준비(setupMarch)의 구원군(reinforce)·개입형 진행(marchInteractive)
##   은 안 옮겼다 — 적이 하나뿐이고 이웃 성도 없어 구원군 자체가 없다.
## - 승부가 안 갈리면(stalemate) 원작은 진(camp)을 쳐 다음 달로 넘기는데,
##   이 슬라이스엔 진영 시스템이 없어(realm_war.gd 머리말 참고) **routed와
##   같이 취급** — 살아남은 병력이 그냥 돌아간다.
## - 이기면(capture) 원작의 관리 인계(무장 배치·태수·치안 반토막·agri/
##   comm/pop 편입 등)는 `_annex_city()`(2026-09-12)와 이 함수의 승리
##   분기(officer_city 배치, 2026-09-14, "정복 후 관리" 이어감)로 전부
##   옮겨졌다 — 정복한 성은 그 자리에서 곧바로 playable_ids()에 들어가
##   조망·명령 대상이 된다. **세력 멸망 판정**(원작 checkResult())만
##   여전히 안 옮겼다 — `enemies` Dictionary가 성을 세력별로 묶지 않아,
##   107개 성 편입 이후 범위가 커진 채 다음에 볼 자리로 남아 있다.
## **2026-09-17 추가 — PLAN 101-2 REALM ④후보 "일기토"(웹판 §5-3).**
## `duel_moves`(플레이어가 미리 고른 최대 3수, `RealmWar.DUEL_MOVES` 값)를
## 안 주면(빈 배열) 지금까지와 완전히 동치 — 진단 "AI 일기토 무영향"·
## "선택 없이 자동으로 돌리면 기존 fight()와 결과 동일"이 이 기본값
## 하나로 보장된다.
func attack(enemy_id: String, duel_moves: Array = []) -> Dictionary:
	var enemy_def := RealmCities.enemy_by_id(enemy_id)
	if enemy_def.is_empty():
		return {"ok": false, "why": "없는 목표"}
	var e: Dictionary = enemies.get(enemy_id, {})
	if bool(e.get("captured", false)):
		return {"ok": false, "why": "이미 함락한 성입니다"}
	## war.js canMarch() "diplo.blocked()" 체크와 같은 자리 — 화친 중이면
	## 못 친다(2026-09-12 외교 슬라이스, `realm_diplo.gd` 머리말 참고).
	var force_id: String = force_of(enemy_id)
	var dip: Dictionary = diplomacy.get(force_id, {})
	if int(dip.get("truce_months", 0)) > 0:
		return {"ok": false, "why": "맹약이 있어 칠 수 없습니다"}

	var from_city: String = String(enemy_def.get("from_city", ""))
	if not cities.has(from_city):
		return {"ok": false, "why": "없는 출진 성"}
	var c: Dictionary = cities[from_city]
	var troops: int = int(c.troops)
	if troops < 500:
		return {"ok": false, "why": "오백은 넘겨야 군대라 하지요"}  # war.js canMarch()와 같은 문구

	var officer_id := _best_officer_for("might", from_city)
	if officer_id.is_empty():
		return {"ok": false, "why": "데려갈 장수가 없습니다"}
	if _done_this_month.get(officer_id, false):
		return {"ok": false, "why": "이 달에 이미 명령을 썼습니다"}

	## war.js canMarch() "원정 군량 — 병력의 한 달치는 들고 가야 한다"(×2).
	var need := RealmOrders.food_upkeep(troops) * 2
	if int(c.food) < need:
		return {"ok": false, "why": "군량이 모자랍니다"}

	c.troops = 0
	c.food = int(c.food) - need

	## PLAN 101-2 REALM ④후보 — 일기토 3합(`RealmWar` 상수·판정 참고). 합마다
	## AI 수를 그 자리에서 굴려(`_rng`, 진단 결정성 유지) 결과·배율을 매기고,
	## 3합 배율의 평균을 이 싸움 전체의 위력에 곱한다(머리말 재해석 참고).
	var duel_rounds: Array = []
	var duel_mul := 1.0
	if not duel_moves.is_empty():
		var mul_sum := 0.0
		for player_move: String in (duel_moves as Array).slice(0, RealmWar.DUEL_ROUNDS):
			var enemy_move := RealmWar.duel_ai_move(_rng)
			var res := RealmWar.duel_round_result(String(player_move), enemy_move)
			var mul := RealmWar.duel_round_mul(res)
			duel_rounds.append({"player": player_move, "enemy": enemy_move, "result": res})
			mul_sum += mul
		duel_mul = mul_sum / float(duel_rounds.size())

	## PLAN 101-2 REALM ③후보 — 호전(웹판 §5-1 "일기토 발생률" 재해석,
	## `realm_traits.gd` TRAIT_MILITANT_MIGHT_MUL 참고). 일기토(④, 위)가
	## 이번 세션에 따로 생겼지만 호전의 위력 배율은 그와 별개로 쌓는다
	## (하나는 특성, 하나는 그때그때 플레이어 선택 — 서로 다른 축).
	var atk_might := _effective_stat(officer_id, "might")
	if RealmTraits.has_trait(officer_id, "militant"):
		atk_might *= RealmTraits.TRAIT_MILITANT_MIGHT_MUL
	atk_might *= duel_mul
	var atk := {
		"troops": troops, "start": troops, "train": int(c.train), "tech": int(c.tech),
		"best_command": _effective_stat(officer_id, "command"), "best_might": atk_might,
		"officer_count": 1,
	}
	## **2026-09-12 갱신 — 이간·매수로 이름 있는 수비 무장이 생겼다.**
	## `e.officers`(비면 예전처럼 0)를 그대로 반영한다 — 매수·이간으로
	## 미리 빼내면 그만큼 수비가 약해진다(officer_count·best_command·
	## best_might가 실제로 준다).
	var def_officers: Array = e.get("officers", [])
	var def_best_command := 0.0
	var def_best_might := 0.0
	for oid: String in def_officers:
		if Characters.find(oid) == null:
			continue
		def_best_command = maxf(def_best_command, _effective_stat(oid, "command"))
		def_best_might = maxf(def_best_might, _effective_stat(oid, "might"))
	var def_army := {
		"troops": int(e.troops), "start": int(e.troops), "train": int(e.train), "tech": int(e.tech),
		"best_command": def_best_command, "best_might": def_best_might, "officer_count": def_officers.size(),
	}
	var wall := {"wall": int(e.wall), "max_wall": int(e.max_wall)}
	var land: String = String(enemy_def.get("land", "plain"))

	var rep := RealmWar.fight(atk, def_army, wall, RealmCities.land_def(land), RealmCities.land_siege(land), _rng)
	_done_this_month[officer_id] = true
	## war.js march() "따라나선 것만으로도 는다 — 이기고 지고는 그다음이다".
	gain_exp(officer_id, int(RealmGrowth.EXP.march))

	e.wall = wall.wall
	var boss_beaten := ""
	if rep.won:
		e.captured = true
		e.troops = 0
		## war.js capture() "보스전"(README 여덟 축) — 성을 잃기 전 수비
		## 명단에 `boss:true`인 사람이 있었는지 먼저 본다(아래서 이 사람들
		## 자리가 옮겨지기 전에). 새 전투 판정은 없다 — fight()가 이미 끝낸
		## 결과에 보상만 얹는다. **재해석 — 유물은 안 준다.** 원작은
		## ID.randomItem()으로 유물도 하나 얹는데, 이 슬라이스엔 장비/유물
		## 시스템 자체가 없어(REALM에 data-item.js 대응이 없다) 금 보너스만
		## 옮겼다(quiz_answer()가 feat/fame/scroll을 뺀 것과 같은 결).
		for oid: String in def_officers:
			var bh = Characters.find(oid)
			if bh != null and bool(bh.get("boss", false)):
				boss_beaten = String(bh.name)
				break
		if not boss_beaten.is_empty():
			gold += BOSS_BONUS_GOLD
		## war.js capture() "사로잡힌다" — 소패는 몸 붙일 이웃 성이 없어
		## (refuge 없음, `bei`가 소패 하나뿐) 원작에서도 전부 사로잡히는
		## 경로만 탄다. 사로잡힌 무장은 그 성(이제 우리 성)의 재야가
		## 된다(`off.rec(id).found=true`와 같은 결) — 매수·이간으로 미리
		## 빼낸 이는 이미 e.officers에서 빠져 여기 안 걸린다.
		for oid: String in (def_officers as Array).duplicate():
			if not (oid in found) and not (oid in roster):
				found.append(oid)
			enemy_officer_loyal.erase(oid)
		e.officers = []
		_annex_city(enemy_id, enemy_def, int(rep.atk_troops_left), int(c.train))
		## war.js capture() "데려간 장수는 그 성에 남는다" — off.placeAt()
		## 그대로. `_governor_at()`이 officer_city를 매번 다시 훑는 구조라
		## (머리말 참고) 태수를 따로 저장할 필요 없이 이 한 줄로 새 성에
		## 태수가 선다. feats+=3·충성+3·EXP.win도 같이 — 이 슬라이스는
		## 장수 하나(officer_id)뿐이라 그 한 명만 받는다.
		officer_city[officer_id] = enemy_id
		var wg := _growth(officer_id)
		wg.feats = int(wg.feats) + 3
		officer_loyal[officer_id] = clampi(int(officer_loyal.get(officer_id, 50)) + 3, 0, 100)
		gain_exp(officer_id, int(RealmGrowth.EXP.win))
	else:
		## war.js finishMarch() routed 분기 — 치중(baggage)은 need에서 이 달
		## 먹은 몫(food_upkeep(troops), 정확히 need의 절반)을 뺀 나머지다.
		var baggage := RealmOrders.food_upkeep(troops)
		c.troops = int(c.troops) + int(rep.atk_troops_left)
		c.food = int(c.food) + baggage
		e.troops = int(rep.def_troops_left)
	enemies[enemy_id] = e

	return {
		"ok": true, "won": rep.won, "routed": rep.routed, "sortie": rep.sortie,
		"loss_a": rep.loss_a, "loss_d": rep.loss_d,
		"wall_from": rep.wall_from, "wall_to": rep.wall_to,
		"boss_beaten": boss_beaten,
		"duel_rounds": duel_rounds, "duel_mul": duel_mul,
	}


## war.js capture()를 좁혀 옮긴 것(2026-09-12, "1,2,3 순서대로 다해" —
## 3·4절이 "함락 뒤처리" 통째로 미뤄 둔 나머지 절반). attack()이 이겼을
## 때만 부른다. **2026-09-12 갱신 — 사로잡힌 수비 무장.** 이간·매수
## 슬라이스가 소패에 이름 있는 수비 무장(sg_guanyu·sg_zhangfei)을
## 들이면서, 그때까지 안 빠져나간 이들을 위(`attack()`)에서 `found[]`로
## 옮기는 것까지 옮겼다(war.js capture()의 caught 분기 — 소패는 몸 붙일
## 이웃 성이 없어 fled 분기는 원작에서도 안 탄다). **보스전 보상은
## 2026-09-14에 옮겼다**(`attack()`의 `boss_beaten` 처리 — 유물 없이
## 금 보너스만, 위 함수 머리말 참고). 세력 멸망 판정은 여전히 안 옮겼다 —
## `bei`가 소패 하나만 들고 있다는 걸 `enemies` Dictionary가 몰라(정적
## 수치일 뿐 성 목록을 세력별로 묶지 않는다), "세력의 마지막 성을
## 뺏었는가"를 새로 판정하는 대신 다음에 볼 자리로 남긴다.
## **옮긴 부분**: `to.force`(정복 자체) · `to.troops = atk.troops`(살아남은
## 원정군이 그대로 수비대가 된다) · `to.train = atk.train`(원정군의
## 훈련도를 물려받는다) · `to.sec = max(10, round(그 성 sec*0.5))`("갓
## 뺏은 성은 어수선하다" — 이 성은 sec 기록이 없던 적 성이라 기준값을
## `RealmOrders.SEC_START`로 삼는다) 전부 war.js 원문 그대로. `agri`·
## `comm`·`pop`은 `ENEMY_CITIES`에 새로 들인 `*_start`(data-city.js
## 원문)로 채우고, `food`·`ships`는 `_init_cities()`가 새 성에 쓰는
## 것과 같은 공식(`RealmCities.food_start()`/`ships_start()`)을 그대로
## 쓴다 — 새 성이 늘 때와 같은 절차라 특수 케이스를 안 만든다.
func _annex_city(city_id: String, enemy_def: Dictionary, garrison: int, train_val: int) -> void:
	cities[city_id] = {
		"agri": int(enemy_def.get("agri_start", 0)), "comm": int(enemy_def.get("comm_start", 0)),
		"sec": maxi(10, roundi(float(RealmOrders.SEC_START) * 0.5)),
		"tech": int(enemies[city_id].tech),
		"wall": int(enemies[city_id].wall), "train": train_val,
		"pop": int(enemy_def.get("pop_start", 0)), "troops": garrison,
		"food": RealmCities.food_start(city_id),
		"ships": RealmCities.ships_start(city_id),
		"disaster": "", "d_left": 0,
	}


const BOSS_BONUS_GOLD := 600  # war.js capture() bossBeaten 분기의 bonusGold 그대로
const ENVOY_GOLD := 300     # diplo.js envoy()의 "gold" 매개변수 — 수량 선택
                             # UI가 없어 고정값(전임·전군출진과 같은 결)
const ENVOY_FEE := RealmDiplo.ENVOY_FEE
const TRIBUTE_GOLD := 600   # 조공에 실어 보내는 금 — 위와 같은 이유로 고정


## diplo.js envoy(kind==='truce') — 사자(지력 으뜸 무장, 위치 무관 — 로스터
## 전체에서 고른다, 원작도 성 소속을 안 따진다)를 보내 정전을 청한다.
## 성공하면 `RealmDiplo.TRUCE_MONTHS`간 `attack()`이 막힌다.
## `debate_mul`(PLAN 101-2 REALM ④후보 "설전") 기본값 1.0 — 안 주면
## 지금까지와 동치.
func envoy_truce(enemy_id: String, debate_mul: float = 1.0) -> Dictionary:
	var enemy_def := RealmCities.enemy_by_id(enemy_id)
	if enemy_def.is_empty():
		return {"ok": false, "why": "없는 상대"}
	var force_id: String = force_of(enemy_id)
	var cost := ENVOY_GOLD + ENVOY_FEE
	if gold < cost:
		return {"ok": false, "why": "금이 모자랍니다"}

	var officer_id := _best_officer_for("wisdom")
	if officer_id.is_empty():
		return {"ok": false, "why": "보낼 사자가 없습니다"}
	if _done_this_month.get(officer_id, false):
		return {"ok": false, "why": "이 달에 이미 명령을 썼습니다"}

	gold -= cost
	_done_this_month[officer_id] = true

	var dip: Dictionary = diplomacy.get(force_id, {"relation": RealmDiplo.DEFAULT_RELATION, "truce_months": 0})
	var chance := RealmDiplo.truce_chance(_effective_stat(officer_id, "wisdom"), int(dip.relation), ENVOY_GOLD)
	chance = clampf(chance * debate_mul, 0.03, 0.95)

	var accepted := _rng.randf() <= chance
	if accepted:
		dip.truce_months = RealmDiplo.TRUCE_MONTHS
		dip.relation = RealmDiplo.clamp_relation(int(dip.relation) + RealmDiplo.TRUCE_SUCCESS_BONUS)
	else:
		dip.relation = RealmDiplo.clamp_relation(int(dip.relation) + RealmDiplo.TRUCE_FAIL_BONUS)
	diplomacy[force_id] = dip

	return {"ok": true, "accepted": accepted, "chance": chance, "relation": int(dip.relation)}


## diplo.js envoy(kind==='tribute') — 굴림 없이 확정으로 우호를 올린다.
func envoy_tribute(enemy_id: String) -> Dictionary:
	var enemy_def := RealmCities.enemy_by_id(enemy_id)
	if enemy_def.is_empty():
		return {"ok": false, "why": "없는 상대"}
	var force_id: String = force_of(enemy_id)
	var cost := TRIBUTE_GOLD + ENVOY_FEE
	if gold < cost:
		return {"ok": false, "why": "금이 모자랍니다"}

	var officer_id := _best_officer_for("wisdom")
	if officer_id.is_empty():
		return {"ok": false, "why": "보낼 사자가 없습니다"}
	if _done_this_month.get(officer_id, false):
		return {"ok": false, "why": "이 달에 이미 명령을 썼습니다"}

	gold -= cost
	_done_this_month[officer_id] = true

	var dip: Dictionary = diplomacy.get(force_id, {"relation": RealmDiplo.DEFAULT_RELATION, "truce_months": 0})
	var up := RealmDiplo.tribute_up(TRIBUTE_GOLD)
	dip.relation = RealmDiplo.clamp_relation(int(dip.relation) + up)
	diplomacy[force_id] = dip

	return {"ok": true, "up": up, "relation": int(dip.relation)}


## diplo.js plot() — 처음엔 성 자체가 대상인 rumor/fire만 옮겼다가
## (2026-09-12, "1,2,3 순서대로 다해" 두 번째), 이번에 이간(discord)·
## 매수(bribe)를 마저 옮겼다(같은 지시의 세 번째, 이번 절). 화친 체크가
## 없는 것도 원작 그대로(plot()은 `attack()`과 달리 diplo.blocked()를
## 안 본다 — 첩보전은 정식 화친과 별개다).
func plot(kind: String, enemy_id: String) -> Dictionary:
	var chk := _plot_check(kind, enemy_id)
	if not bool(chk.get("ok", false)):
		return chk

	var officer_id: String = chk.officer_id
	var force_id: String = chk.force_id
	var e: Dictionary = chk.e
	var dip: Dictionary = chk.dip
	var chance: float = chk.chance

	gold -= int(RealmDiplo.plot_by_key(kind).gold)
	_done_this_month[officer_id] = true
	dip.relation = RealmDiplo.clamp_relation(int(dip.relation) + RealmDiplo.PLOT_RELATION_HIT)

	if _rng.randf() > chance:
		dip.relation = RealmDiplo.clamp_relation(int(dip.relation) + RealmDiplo.PLOT_FAIL_RELATION_HIT)
		diplomacy[force_id] = dip
		return {"ok": true, "done": false, "chance": chance}

	var result := {"ok": true, "done": true, "chance": chance}
	if kind == "rumor":
		var before_sec := int(e.sec)
		e.sec = maxi(0, before_sec - roundi(RealmDiplo.SEC_HIT_BASE + _rng.randf() * RealmDiplo.SEC_HIT_RANGE))
		result["sec_from"] = before_sec
		result["sec_to"] = int(e.sec)
		enemies[enemy_id] = e
	elif kind == "fire":
		var burned := roundi(float(e.food) * (RealmDiplo.FOOD_BURN_BASE + _rng.randf() * RealmDiplo.FOOD_BURN_RANGE))
		e.food = maxi(0, int(e.food) - burned)
		result["burned"] = burned
		enemies[enemy_id] = e
	elif kind == "discord":
		var target_id: String = String(chk.target_id)
		var before_loyal := int(enemy_officer_loyal.get(target_id, 50))
		var hit := RealmDiplo.DISCORD_HIT_BASE + floori(_rng.randf() * RealmDiplo.DISCORD_HIT_RANGE)
		var after_loyal := clampi(before_loyal - hit, 0, 100)
		enemy_officer_loyal[target_id] = after_loyal
		result["target"] = target_id
		result["loyal_from"] = before_loyal
		result["loyal_to"] = after_loyal
		result["defected"] = false
		## **재해석 — 원작은 월말 checkDefection()이 12 이하를 35% 확률로
		## 몰아낸다. 이 슬라이스는 적 로스터를 매달 훑는 자리가 없어, 이간이
		## 방금 만든 결과에 대해 그 자리에서 같은 굴림을 한 번 돈다.**
		if after_loyal <= RealmDiplo.DEFECT_LOYAL_FLOOR and _rng.randf() <= RealmDiplo.DEFECT_CHANCE:
			(e.officers as Array).erase(target_id)
			enemy_officer_loyal.erase(target_id)
			if not (target_id in found) and not (target_id in roster):
				found.append(target_id)
			result["defected"] = true
			enemies[enemy_id] = e
			## PLAN 101-2 REALM ③후보 — 야망 "숙적"(적 무장을 계략으로 하나
			## 제거) 진행도.
			enemies_subverted += 1
	elif kind == "bribe":
		var target_id: String = String(chk.target_id)
		(e.officers as Array).erase(target_id)
		enemy_officer_loyal.erase(target_id)
		enemies[enemy_id] = e
		roster.append(target_id)
		officer_city[target_id] = RealmCities.DEFAULT_CITY
		officer_loyal[target_id] = RealmDiplo.BRIBE_LOYAL_SET
		result["target"] = target_id
		result["home_city"] = RealmCities.DEFAULT_CITY
		enemies_subverted += 1  # 위와 같은 이유 — 매수도 "적 무장을 꺾은" 것으로 친다

	diplomacy[force_id] = dip
	return result


## `plot()`과 같은 검증·확률 계산을 상태 변경 없이 미리 보여 준다
## ("계략은 성공률을 숨기지 않는다", diplo.js 머리말) — 버튼이 메뉴를
## 띄우기 전에 부른다.
func plot_preview(kind: String, enemy_id: String) -> Dictionary:
	return _plot_check(kind, enemy_id)


## 현재 `enemies[eid].officers` 중 지력 최댓값 — "태수"(guard) 역할.
## 아무도 안 남았으면(다 매수·이간으로 빠지거나 함락 전이라도 애초에
## 없으면) `RealmDiplo.PLOT_GUARD_WISDOM`(30) 기본값으로 돌아간다.
func _enemy_guard_wisdom(enemy_id: String) -> float:
	var e: Dictionary = enemies.get(enemy_id, {})
	var best := -1.0
	for oid: String in (e.get("officers", []) as Array):
		if Characters.find(oid) == null:
			continue
		best = maxf(best, _effective_stat(oid, "wisdom"))
	return best if best >= 0.0 else float(RealmDiplo.PLOT_GUARD_WISDOM)


## diplo.js plot()의 "targetId 없으면 자동으로 고른다" — 충성이 가장
## 낮은 사람이 가장 잘 흔들린다(cands.sort by loyalOf asc). 군주는
## `ENEMY_CITIES[].officers`에 애초에 안 들어 있어(realm_cities.gd
## 머리말 참고) 따로 걸러낼 필요가 없다.
func _pick_plot_target(enemy_id: String) -> String:
	var e: Dictionary = enemies.get(enemy_id, {})
	var best_id := ""
	var best_loyal := 101
	for oid: String in (e.get("officers", []) as Array):
		var lv: int = int(enemy_officer_loyal.get(oid, 50))
		if lv < best_loyal:
			best_loyal = lv
			best_id = oid
	return best_id


func _plot_check(kind: String, enemy_id: String) -> Dictionary:
	var plot_def := RealmDiplo.plot_by_key(kind)
	if plot_def.is_empty():
		return {"ok": false, "why": "없는 계략"}
	var enemy_def := RealmCities.enemy_by_id(enemy_id)
	if enemy_def.is_empty():
		return {"ok": false, "why": "없는 목표"}
	var e: Dictionary = enemies.get(enemy_id, {})
	if bool(e.get("captured", false)):
		return {"ok": false, "why": "우리 성입니다"}

	## diplo.js touching() — 우리 성 중 하나라도 대상과 맞닿아 있어야 한다.
	var touching := false
	for cid: String in RealmCities.playable_ids():
		if RealmCities.is_adjacent(cid, enemy_id):
			touching = true
			break
	if not touching:
		return {"ok": false, "why": "손이 닿지 않는 성입니다"}

	if gold < int(plot_def.gold):
		return {"ok": false, "why": "금이 모자랍니다"}

	var officer_id := _best_officer_for("wisdom")
	if officer_id.is_empty():
		return {"ok": false, "why": "계략을 쓸 무장이 없습니다"}
	if _done_this_month.get(officer_id, false):
		return {"ok": false, "why": "이 달에 이미 명령을 썼습니다"}

	## 이간·매수는 대상 무장이 있어야 한다 — 없으면(다 빠져나갔거나 원래
	## 없으면) "홀릴 사람이 없습니다"(diplo.js plot() 그대로).
	var target_id := ""
	if kind == "discord" or kind == "bribe":
		target_id = _pick_plot_target(enemy_id)
		if target_id.is_empty():
			return {"ok": false, "why": "홀릴 사람이 없습니다"}

	var force_id: String = force_of(enemy_id)
	var dip: Dictionary = diplomacy.get(force_id, {"relation": RealmDiplo.DEFAULT_RELATION, "truce_months": 0})
	var mine_wisdom := _effective_stat(officer_id, "wisdom")
	var guard_wisdom := _enemy_guard_wisdom(enemy_id)
	var sec := int(e.get("sec", 50))

	var chance: float
	match kind:
		"discord":
			var target_loyal := int(enemy_officer_loyal.get(target_id, 50))
			chance = RealmDiplo.discord_chance(mine_wisdom, guard_wisdom, sec, target_loyal)
		"bribe":
			var target_loyal2 := int(enemy_officer_loyal.get(target_id, 50))
			var th = Characters.find(target_id)
			var target_rarity := int(th.rarity) if th != null else 3
			chance = RealmDiplo.bribe_chance(mine_wisdom, guard_wisdom, sec, target_loyal2, target_rarity)
			## PLAN 101-2 REALM ③후보 — 탐욕(매수 대상이면 쉽게 넘어옴)·
			## 청렴(반대짝, 매수 저항). 웹판 §5-1 그대로.
			if RealmTraits.has_trait(target_id, "greedy"):
				chance *= RealmTraits.TRAIT_GREEDY_BRIBE_MUL
			if RealmTraits.has_trait(target_id, "honest"):
				chance *= RealmTraits.TRAIT_HONEST_BRIBE_MUL
			chance = clampf(chance, 0.05, 0.9)
		_:
			chance = RealmDiplo.plot_chance(mine_wisdom, guard_wisdom, sec)

	return {
		"ok": true, "officer_id": officer_id, "force_id": force_id,
		"e": e, "dip": dip, "chance": chance, "target_id": target_id,
	}


