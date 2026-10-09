class_name RealmRules
extends RealmState

## 사가천하 경영 규칙 1층 — 무장 성장·승진·명령 7종과 설전·문답.
## 상태 변수(`var`)는 아래 층 `RealmState` 에 있고, 저장·불러오기는 맨 위 `RealmSaveState`(autoload)가 한다.
## 상속 사슬: SagaSaveBase ← RealmState ← RealmRules ← RealmRulesWar ← RealmRulesMonth ← RealmSaveState (G-0006, 부모는 자식 함수를 못 부르니 피호출 쪽이 아래).

## ── 성장 (경험 · 승진) ──────────────────────────────────────────
## officer.js grow()/gainExp()/promote()를 그대로 옮겼다(위 officer_growth
## 머리말 참고).

func _growth(id: String) -> Dictionary:
	if not officer_growth.has(id):
		officer_growth[id] = {"lv": 1, "exp": 0, "rank": 0, "feats": 0, "bonus": {}}
	return officer_growth[id]


## officer.js off.stats() 축약 — 나이(aging)는 이 슬라이스에 없어(REALM
## PLAN 4절에도 없는 항목) 성장 배율만 곱한다. Characters.find(id)가 없으면
## (없는 id) 0을 돌려준다.
## **2026-09-17 추가 — `bonus`(야망 달성 "능력 +2 영구", PLAN 101-2 REALM
## ③).** 배율이 아니라 평평한 덧셈이라 곱셈 뒤에 더한다 — `_add_growth_
## bonus()`만 이 값을 채운다.
func _effective_stat(id: String, stat_key: String) -> float:
	var h = Characters.find(id)
	if h == null:
		return 0.0
	var base: float = float(h.stats.get(stat_key, 0))
	var g: Dictionary = officer_growth.get(id, {"lv": 1, "rank": 0})
	var mul := base * RealmGrowth.grow_mul(int(g.get("lv", 1)), int(g.get("rank", 0)))
	var bonus: Dictionary = g.get("bonus", {})
	return mul + float(bonus.get(stat_key, 0))


## 야망 달성 보상("능력 +2 영구") — `officer_growth[id].bonus[stat_key]`에
## 누적한다(같은 사람이 같은 축 야망을 두 번 이룰 일은 없지만, 겹쳐도
## 안전하게 더하기만 한다).
func _add_growth_bonus(id: String, stat_key: String, amount: int) -> void:
	var g := _growth(id)
	var bonus: Dictionary = g.get("bonus", {})
	bonus[stat_key] = int(bonus.get(stat_key, 0)) + amount
	g.bonus = bonus


## 경험을 준다 — 레벨이 오르면 _effective_stat()가 그만큼 곱해진다.
## officer.js gainExp() 그대로.
func gain_exp(id: String, amount: int) -> Dictionary:
	if amount <= 0 or Characters.find(id) == null:
		return {"gained": 0, "levels": 0}
	var g := _growth(id)
	if int(g.lv) >= RealmGrowth.MAX_LV:
		g.exp = 0
		return {"gained": 0, "levels": 0}
	g.exp = int(g.exp) + amount
	var levels := 0
	var need := RealmGrowth.exp_need(int(g.lv))
	while int(g.exp) >= need and int(g.lv) < RealmGrowth.MAX_LV:
		g.exp = int(g.exp) - need
		g.lv = int(g.lv) + 1
		levels += 1
		need = RealmGrowth.exp_need(int(g.lv))
	if int(g.lv) >= RealmGrowth.MAX_LV:
		g.exp = 0
	return {"gained": amount, "levels": levels}


## rtk.js order() 말미의 "명령 하나가 남기는 것" — 개발형·징병 명령에만
## 붙는다(수색·등용은 execute_order()가 먼저 return해 여기까지 안 온다).
func _grant_order_growth(officer_id: String) -> void:
	var g := _growth(officer_id)
	g.feats = int(g.feats) + 1
	officer_loyal[officer_id] = clampi(int(officer_loyal.get(officer_id, 50)) + 1, 0, 100)
	gain_exp(officer_id, int(RealmGrowth.EXP.order))


func promote_check(id: String) -> Dictionary:
	if Characters.find(id) == null:
		return {"ok": false, "why": "없는 무장입니다"}
	if not (id in roster):
		return {"ok": false, "why": "재야입니다"}
	var g := _growth(id)
	if int(g.rank) >= RealmGrowth.MAX_RANK:
		return {"ok": false, "why": "더 올릴 자리가 없습니다"}
	var cost := RealmGrowth.promote_cost(int(g.rank))
	if int(g.feats) < int(cost.feats):
		return {"ok": false, "why": "공이 모자랍니다 (%d/%d)" % [int(g.feats), int(cost.feats)], "cost": cost}
	if gold < int(cost.gold):
		return {"ok": false, "why": "금이 모자랍니다 (%d)" % int(cost.gold), "cost": cost}
	return {"ok": true, "cost": cost}


## 승진 — 쌓인 공과 금으로 관직을 올린다. 능력치가 오르고(RANK_STEP),
## 충성이 크게 오른다(+12) — 원작에서 관직이 사람을 붙들어 두는 힘이 그것이다.
## officer.js promote() 그대로.
func promote(id: String) -> Dictionary:
	var chk := promote_check(id)
	if not bool(chk.get("ok", false)):
		return chk
	var g := _growth(id)
	var cost: Dictionary = chk.cost
	g.feats = int(g.feats) - int(cost.feats)
	gold -= int(cost.gold)
	g.rank = int(g.rank) + 1
	## PLAN 101-2 REALM ③후보 — 탐욕(웹판 §5-1 "상 받으면 충성 +50%").
	var loyal_gain := 12
	if RealmTraits.has_trait(id, "greedy"):
		loyal_gain = roundi(float(loyal_gain) * RealmTraits.TRAIT_GREEDY_REWARD_MUL)
	officer_loyal[id] = clampi(int(officer_loyal.get(id, 50)) + loyal_gain, 0, 100)
	return {"ok": true, "rank": int(g.rank), "name": RealmGrowth.rank_name(int(g.rank)), "loyal": int(officer_loyal[id])}


## 명령을 실행한다 — rtk.js order()를 current_city 하나에 적용하는 축약.
## 반환: {"ok": bool, "why": String}(실패) 또는
##       {"ok": true, "officer": String, "amount": int, "crit": bool}
##       (개간/상업/기술/치안/축성/징병/훈련/조선) /
##       {"ok": true, "found": String}(수색, 빈 문자열이면 "더 찾을 사람 없음") /
##       {"ok": true, "hired": String, "chance": float}(등용, 빈 문자열이면 거절)
## `debate_mul`(PLAN 101-2 REALM ④후보 "설전") — key=="hire"에만 쓰인다,
## 기본값 1.0(안 주면 지금까지와 동치).
func execute_order(key: String, debate_mul: float = 1.0) -> Dictionary:
	var o := RealmOrders.by_key(key)
	if o.is_empty():
		return {"ok": false, "why": "없는 명령"}
	## rtk.js order() "배는 물가에서만 짓는다" — capOf('ships')가 0인
	## (land: plain) 성은 항상 여기서 막힌다. 금·무장 턴을 쓰기 전에 먼저
	## 걸러 원작 순서(금 차감보다 먼저)를 그대로 지켰다.
	if key == "ships" and RealmOrders.cap_of("ships", current_city) <= 0:
		return {"ok": false, "why": "물길이 없는 성입니다"}
	if gold < int(o.gold):
		return {"ok": false, "why": "금이 모자랍니다"}

	## 수색·등용은 로스터 전체 아무나(성 소속 무관), 나머지(개발형·징병)는
	## current_city에 배치된 무장만 — 위 "재해석" 문단 참고.
	var location_bound := key != "search" and key != "hire"
	var officer_id := _best_officer_for(String(o.stat), current_city if location_bound else "")
	if officer_id.is_empty():
		var why := "이 성에 배치된 무장이 없습니다" if location_bound else "명령을 쓸 무장이 없습니다"
		return {"ok": false, "why": why}

	gold -= int(o.gold)
	_done_this_month[officer_id] = true

	if key == "search":
		return _do_search(officer_id)
	if key == "hire":
		return _do_hire(officer_id, debate_mul)
	var result := _do_draft(o, officer_id) if key == "draft" else _do_devel(key, o, officer_id)
	_grant_order_growth(officer_id)
	return result


## rtk.js order()의 "대성공 판정 + 성과량" 부분 — 개발형 명령(devel)과
## 징병(draft)이 공유한다(뒤에서 amount를 다르게 다룰 뿐 굴리는 방식은 같다).
func _roll_amount(o: Dictionary, officer_id: String) -> Dictionary:
	var stat_val: float = _effective_stat(officer_id, String(o.stat))
	var crit := _rng.randf() < clampf(stat_val / 400.0, 0.03, 0.28)
	var amount := roundi((float(o.base) + stat_val * float(o.per)) * (1.5 if crit else 1.0))
	return {"amount": amount, "crit": crit}


## agri/comm/tech/sec/wall/train/ships 일곱 다 같은 모양(cap까지 채우고
## 남은 만큼만 는다)이라 current_city의 Dictionary를 직접 읽고 쓴다.
func _do_devel(key: String, o: Dictionary, officer_id: String) -> Dictionary:
	var roll := _roll_amount(o, officer_id)
	var amount: int = roll.amount

	var c: Dictionary = cities[current_city]
	var cap := RealmOrders.cap_of(key, current_city)
	var before: int = int(c.get(key, 0))
	var after: int = mini(cap, before + amount)
	c[key] = after
	amount = after - before

	return {"ok": true, "officer": officer_id, "amount": amount, "crit": roll.crit}


## rtk.js order()의 draft 분기 그대로 — 인구가 뽑을 수 있는 만큼(room)만
## 병력이 늘고, 그만큼 인구가 준다. 새 병사가 섞이면 훈련도가 희석된다.
## 전부 current_city 안에서 일어난다(인구·병력은 성마다 따로 논다).
func _do_draft(o: Dictionary, officer_id: String) -> Dictionary:
	var roll := _roll_amount(o, officer_id)
	var amount: int = roll.amount

	var c: Dictionary = cities[current_city]
	var pop_val: int = int(c.pop)
	var troops_val: int = int(c.troops)
	var room := floori(float(pop_val) * 0.06) - troops_val
	amount = maxi(0, mini(amount, maxi(0, room)))
	amount = mini(amount, floori(float(pop_val) / 12.0))
	c.troops = troops_val + amount
	c.pop = pop_val - amount
	if int(c.troops) > 0:
		c.train = roundi(float(c.train) * float(int(c.troops) - amount) / float(c.troops))

	return {"ok": true, "officer": officer_id, "amount": amount, "crit": roll.crit}


## rtk.js doSearch() — 재야 후보를 rarity 내림차순으로 보고, 지력이 높을수록
## "뻗치는 범위"(reach)가 넓어져 더 귀한 사람도 뽑힐 수 있다.
## **2026-09-12 추가 — 재야는 이제 current_city에 묻힌 사람만 나온다**
## (`HIDDEN_POOL_BY_CITY`, rtk.js doSearch()가 애초에 그 성 소속만 찾던
## 것과 같은 결) — 성마다 다른 재야가 있어 세 성을 다 둘러볼 이유가 생겼다.
func _do_search(officer_id: String) -> Dictionary:
	var hidden: Array = []
	for id: String in RealmOfficerPool.HIDDEN_POOL_BY_CITY.get(current_city, []):
		if id in found or id in roster:
			continue
		hidden.append(id)
	if hidden.is_empty():
		return {"ok": true, "found": ""}

	hidden.sort_custom(_hidden_first)

	var wis: float = _effective_stat(officer_id, "wisdom")
	var reach := clampi(roundi(hidden.size() * wis / 130.0), 1, hidden.size())
	var pick_idx := _rng.randi_range(0, reach - 1)
	var got: String = hidden[pick_idx]
	found.append(got)
	return {"ok": true, "found": got}


## rtk.js doHire()/tryHire() — 찾아낸 재야 중 가장 먼저 찾은 이를 부른다.
## 성공률은 부르는 쪽의 지력과 상대의 rarity(콧대)가 가른다 — 같은 trait면
## +10%p. `debate_mul`(PLAN 101-2 REALM ④후보 "설전") 기본값 1.0.
func _do_hire(officer_id: String, debate_mul: float = 1.0) -> Dictionary:
	if found.is_empty():
		return {"ok": true, "hired": ""}

	var target_id: String = found[0]
	var by = Characters.find(officer_id)
	var t = Characters.find(target_id)
	var wis: float = _effective_stat(officer_id, "wisdom")
	var chance := clampf(0.28 + wis / 260.0 - (float(t.rarity) - 2.0) * 0.09, 0.05, 0.9)
	if String(by.trait) == String(t.trait):
		chance += 0.10
	chance = clampf(chance * debate_mul, 0.05, 0.9)

	if _rng.randf() > chance:
		return {"ok": true, "hired": "", "chance": chance}

	found.erase(target_id)
	roster.append(target_id)
	officer_city[target_id] = current_city  # 찾아낸(수색한) 성에 배치된다
	## PLAN 101-2 REALM ⑥후보(계승) — 계승이 있었으면 그 뒤로 들어오는 사람은
	## 새 군주 기준으로 시작 충성을 잰다(current_lord_id, 기본값은 LORD_ID와
	## 같다 — 계승이 한 번도 없었으면 이전과 동치).
	officer_loyal[target_id] = RealmDiplo.base_loyal(target_id, current_lord_id)
	_done_this_month[target_id] = true  # rtk.js: 들어온 달에는 일하지 않는다
	return {"ok": true, "hired": target_id, "chance": chance}


## PLAN 101-2 REALM ④후보(웹판 §5-3 "설전") — 문답 260문항 재사용, 학당
## 진행(quiz.learned/wrongs/streak/lore)은 안 건드린다("문답 콘텐츠는 이
## 판 안에서만 도니 §2-1 위반 아님", 웹판 문구 그대로). 화친(envoy_truce)·
## 등용(execute_order("hire"))에서 쓰는 사자와 같은 사람(`_best_officer_
## for("wisdom")`)의 지력으로 난도를 정한다.
const DEBATE_ROUNDS := 3
const DEBATE_MUL_BY_CORRECT := {0: 0.8, 1: 0.95, 2: 1.1, 3: 1.3}  # 웹판 §5-3 그대로


## 화친·등용 둘 다 사자를 `_best_officer_for("wisdom")`로 고른다 — UI가
## 설전 문제를 뽑기 전에 "누구 지력 기준인가"를 미리 알아야 해서 공개했다.
func envoy_officer() -> String:
	return _best_officer_for("wisdom")


## 지력에 맞는 난도로 3문 뽑는다 — 웹판 "지력에 맞는 난도" 재해석(문답
## 등급 1~3에 wisdom 문턱을 매겼다). `_present()`가 보기를 섞어 `order`를
## 같이 내려준다(quiz_draw()와 같은 모양, `quiz.learned` 등은 안 건드림).
func debate_draw(officer_id: String) -> Array:
	var wisdom := _effective_stat(officer_id, "wisdom")
	var max_lv := 1
	if wisdom >= 70.0:
		max_lv = 3
	elif wisdom >= 40.0:
		max_lv = 2
	var pool: Array = []
	for ref: Dictionary in RealmQuizData.BANK:
		if RealmQuizData.lv_of(ref) <= max_lv:
			pool.append(ref)
	var out: Array = []
	for i in range(DEBATE_ROUNDS):
		var ref: Dictionary = pool[_rng.randi_range(0, pool.size() - 1)]
		out.append(_present(ref))
	return out


## `questions`는 `debate_draw()`가 낸 순서 그대로, `choice_indices`는 각
## 문제에서 플레이어가 고른 보기 자리(섞인 순서 기준, `quiz_answer()`와
## 같은 판정: `order[idx] == ref.a`). 정답 수(0~3) → 배율.
func debate_result(questions: Array, choice_indices: Array) -> Dictionary:
	var correct := 0
	for i in range(mini(questions.size(), choice_indices.size())):
		var q: Dictionary = questions[i]
		var ref := RealmQuizData.by_id(String(q.id))
		var order: Array = q.order
		if int(order[int(choice_indices[i])]) == int(ref.a):
			correct += 1
	return {"correct": correct, "mul": float(DEBATE_MUL_BY_CORRECT.get(correct, 1.0))}


## quiz.js draw() — 안 익힌 문제 우선(그 안에서는 쉬운 등급부터), 다
## 익혔으면 틀린 것 위주로 복습. 보기 순서는 낼 때마다 섞는다(_present()).
## 무작위(등급 안에서 고르기·복습 후보 중 고르기·보기 섞기)는 모두
## `_rng`(고정 시드)를 써 헤드리스 검증이 재현 가능하다.
func quiz_draw() -> Dictionary:
	var pool := RealmQuizData.BANK
	if pool.is_empty():
		return {}

	var fresh: Array = []
	for ref: Dictionary in pool:
		if not quiz.learned.has(String(ref.id)):
			fresh.append(ref)

	var chosen: Dictionary
	if not fresh.is_empty():
		var low := 3
		for ref: Dictionary in fresh:
			low = mini(low, RealmQuizData.lv_of(ref))
		var tier: Array = []
		for ref: Dictionary in fresh:
			if RealmQuizData.lv_of(ref) == low:
				tier.append(ref)
		chosen = tier[_rng.randi_range(0, tier.size() - 1)]
	else:
		## 전부 익혔다 — 틀린 횟수 내림차순 정렬 후 상위 1/4(최소 4)에서 고른다.
		var review: Array = pool.duplicate()
		review.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
			return int(quiz.wrongs.get(String(a.id), 0)) > int(quiz.wrongs.get(String(b.id), 0)))
		var top_n := maxi(4, ceili(float(review.size()) / 4.0))
		top_n = mini(top_n, review.size())
		var top: Array = review.slice(0, top_n)
		chosen = top[_rng.randi_range(0, top.size() - 1)]

	return _present(chosen)


## quiz.js present() — 보기 넷을 Fisher-Yates로 섞는다. `order[i]`는
## "i번째로 보여줄 보기가 원래 몇 번(정답 인덱스 기준)이었는가".
func _present(ref: Dictionary) -> Dictionary:
	var order: Array = [0, 1, 2, 3]
	for i in range(order.size() - 1, 0, -1):
		var j := _rng.randi_range(0, i)
		var t: int = order[i]
		order[i] = order[j]
		order[j] = t

	var choices: Array = []
	for idx: int in order:
		choices.append(String(ref.c[idx]))

	var lv := RealmQuizData.lv_of(ref)
	return {
		"id": String(ref.id), "cat": String(ref.cat), "lv": lv,
		"lv_name": String(RealmQuizData.LV_NAME[lv]),
		"q": String(ref.q), "choices": choices, "order": order,
		"review": quiz.learned.has(String(ref.id)),
	}


## quiz.js answer() — `p`는 quiz_draw()가 준 문제, choice_idx는 화면에
## 보인 보기 번호(섞인 순서 기준). **REALM 재해석 — 보상 축소.** 원작
## reward는 feat/fame/scroll까지 주는데, 이 슬라이스엔 그 값 자체가
## 없어(REALM엔 player.fame·items.scroll이 없다) gold(세력 금고, rtk.js
## study()가 하던 일)와 lore→재야 공개만 남겼다.
func quiz_answer(p: Dictionary, choice_idx: int) -> Dictionary:
	var ref := RealmQuizData.by_id(String(p.get("id", "")))
	if ref.is_empty():
		return {"ok": false}

	var qid: String = String(ref.id)
	var order: Array = p.order
	var correct: bool = int(order[choice_idx]) == int(ref.a)
	var first: bool = correct and not quiz.learned.has(qid)
	quiz.total = int(quiz.total) + 1

	var lv := RealmQuizData.lv_of(ref)
	var rw: Dictionary = RealmQuizData.LV_REWARD[lv]
	var reward := {"gold": 0, "lv": lv, "found": ""}

	if correct:
		quiz.correct = int(quiz.correct) + 1
		quiz.streak = int(quiz.streak) + 1
		if int(quiz.wrongs.get(qid, 0)) > 0:
			quiz.wrongs[qid] = maxi(0, int(quiz.wrongs[qid]) - 1)
			if int(quiz.wrongs[qid]) == 0:
				quiz.wrongs.erase(qid)
		if int(quiz.streak) > int(quiz.best_streak):
			quiz.best_streak = quiz.streak

		if first:
			## **2026-09-12 추가 — 서고(learnedList).** 원작은 `Date.now()`로
			## "언제 익혔는지"를 남겨 서고를 최근순으로 보여준다. 이 슬라이스는
			## 그 대신 `quiz.total`(그 시점까지 누적 시도 횟수, 항상 증가)을
			## 쓴다 — 실제 시각을 쓰면 헤드리스 검증의 "세 번 돌려도 같은 결과"
			## 요건이 깨진다(루트 CLAUDE.md 검증 습관). 값 자체는 안 보여주고
			## 정렬(내림차순 = 최근 익힌 순)에만 쓴다.
			quiz.learned[qid] = quiz.total
			reward.gold = int(rw.gold)
			## rtk.js study() — 학식이 LORE_PER_FIND만큼 쌓일 때마다 재야
			## 하나가 저절로 드러난다(수색 없이, 지력 판정도 없이).
			quiz.lore = int(quiz.lore) + maxi(1, lv)
			while int(quiz.lore) >= RealmQuizData.LORE_PER_FIND:
				quiz.lore = int(quiz.lore) - RealmQuizData.LORE_PER_FIND
				var got := _reveal_free()
				if not got.is_empty():
					reward.found = got
		else:
			reward.gold = int(rw.rgold)

		## PLAN 101-2 REALM ③후보 — 학구(웹판 §5-1 "문답 상금 ×1.3"). 문답은
		## 특정 무장이 푸는 행동이 아니라(플레이어 조작), 지금 조망 중인 성의
		## 태수가 대신한다고 재해석했다 — `gov_mul()`이 성 살림에 태수의
		## 자질을 얹는 것과 같은 자리(태수가 없으면 배율 없음).
		var gov_id := _governor_at(current_city)
		if not gov_id.is_empty() and RealmTraits.has_trait(gov_id, "scholarly"):
			reward.gold = roundi(float(reward.gold) * RealmTraits.TRAIT_SCHOLARLY_QUIZ_MUL)

		gold += int(reward.gold)
	else:
		quiz.streak = 0
		quiz.wrongs[qid] = int(quiz.wrongs.get(qid, 0)) + 1

	return {
		"ok": true, "correct": correct, "first": first, "why": String(ref.why),
		"answer_text": String(ref.c[int(ref.a)]),
		"lv": lv, "lv_name": String(RealmQuizData.LV_NAME[lv]),
		"streak": int(quiz.streak), "reward": reward,
	}


## rtk.js revealFree() — 우리 성(playable_ids())에 묻힌 재야 중 아직
## 안 드러난(found·roster 어디에도 없는) 사람을 rarity 내림차순으로
## 하나 고른다. `_do_search()`(지력 판정 있음)와 달리 판정이 없다 —
## 원작도 study()가 부를 땐 그냥 가장 귀한 사람을 바로 준다.
## 재야 정렬(G-0126) — 원래 재야를 시간 틈 사람보다 앞에, 그 안에선 귀한 순. 수색은 지력 손이 닿는 앞쪽에서 고르고 학식·카드는 맨 앞.
func _hidden_first(a: String, b: String) -> bool:
	var ta := a in RealmOfficerPool.TIME_FOLK
	var tb := b in RealmOfficerPool.TIME_FOLK
	if ta != tb:
		return tb
	return int(Characters.find(a).rarity) > int(Characters.find(b).rarity)


func _reveal_free() -> String:
	var pool: Array = []
	for city_id: String in RealmCities.playable_ids():
		for oid: String in RealmOfficerPool.HIDDEN_POOL_BY_CITY.get(city_id, []):
			if oid in found or oid in roster:
				continue
			pool.append(oid)
	if pool.is_empty():
		return ""

	pool.sort_custom(_hidden_first)
	var got: String = pool[0]
	found.append(got)
	return got


## quiz.js progress() 축약 — 분야·등급별 세부는 quiz_cat_counts()가 맡는다.
func quiz_progress() -> Dictionary:
	return {
		"learned": quiz.learned.size(), "total": RealmQuizData.BANK.size(),
		"answered": int(quiz.total), "correct": int(quiz.correct),
		"streak": int(quiz.streak), "best_streak": int(quiz.best_streak),
	}


## quiz.js learnedList() — 익힌 지식 목록(서고), 최근에 익힌 것부터.
## **2026-09-12 추가("1,2,3 다해줘" 세 번째)** — `quiz.learned[qid]`가
## 이제 `quiz.total`(익힌 시점의 누적 시도 횟수) 값을 담고 있어(위
## `quiz_answer()` 참고) 그 값 내림차순 정렬이 곧 "최근 익힌 순"이다.
## `limit`(기본 20) — `ChoicePrompt.build()`가 choices 수만큼 패널
## 높이를 늘리기만 하고 스크롤이 없어서(games/saga_go/ui/choice_
## prompt.gd), 학습이 쌓여도 화면이 안 넘치게 최근 것만 자른다(전체
## 목록·페이지네이션은 다음에 볼 자리).
func quiz_learned_list(cat_key: String = "", limit: int = 20) -> Array:
	var out: Array = []
	for ref: Dictionary in RealmQuizData.BANK:
		var qid: String = String(ref.id)
		if not quiz.learned.has(qid):
			continue
		if not cat_key.is_empty() and String(ref.cat) != cat_key:
			continue
		out.append({
			"id": qid, "cat": String(ref.cat), "cat_name": RealmQuizData.cat_name(String(ref.cat)),
			"lv": RealmQuizData.lv_of(ref), "lv_name": String(RealmQuizData.LV_NAME[RealmQuizData.lv_of(ref)]),
			"q": String(ref.q), "answer": String(ref.c[int(ref.a)]), "why": String(ref.why),
			"at": int(quiz.learned[qid]),
		})
	out.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return int(a.at) > int(b.at))
	return out.slice(0, mini(limit, out.size()))


## 서고 "분야 필터" 메뉴(2026-09-12, 서고 UI 확장) — 분야별 학습 현황
## (분야 key·이름·익힌 수·전체 문항 수). 분야당 문항이 최대 15개라
## quiz_learned_list(cat_key)의 기본 limit(20)에 걸릴 일이 없다.
func quiz_cat_counts() -> Array:
	var out: Array = []
	for c: Dictionary in RealmQuizData.CATS:
		var key: String = String(c.key)
		var total := 0
		var learned := 0
		for ref: Dictionary in RealmQuizData.BANK:
			if String(ref.cat) != key:
				continue
			total += 1
			if quiz.learned.has(String(ref.id)):
				learned += 1
		out.append({"key": key, "name": String(c.name), "learned": learned, "total": total})
	return out


## rtk.js "태수는 그 성의 으뜸 무장"(지력*0.6+통솔*0.4 최댓값) — 이제
## officer_city로 실제 배치를 아니까, 그 성에 배치된 무장 중에서만 고른다.
func _governor_at(city_id: String) -> String:
	var best_id := ""
	var best_val := -1.0
	for id: String in roster:
		if officer_city.get(id, "") != city_id:
			continue
		if Characters.find(id) == null:
			continue
		var v: float = _effective_stat(id, "wisdom") * 0.6 + _effective_stat(id, "command") * 0.4
		if v > best_val:
			best_val = v
			best_id = id
	return best_id


## city_filter가 비어 있으면(수색·등용) 로스터 전체를 본다. 아니면
## officer_city[id] == city_filter인 무장만 본다(개발형 명령·징병).
func _best_officer_for(stat: String, city_filter: String = "") -> String:
	var best_id := ""
	var best_val := -1.0
	for id: String in roster:
		if _done_this_month.get(id, false):
			continue
		if not city_filter.is_empty() and officer_city.get(id, "") != city_filter:
			continue
		if Characters.find(id) == null:
			continue
		var v: float = _effective_stat(id, stat)
		if v > best_val:
			best_val = v
			best_id = id
	return best_id


