class_name RealmRulesMonth
extends RealmRulesWar

## 사가천하 경영 규칙 3층 — 다음 달 진행·재해·이탈·야망·이벤트 체인·계승. 상속 사슬은 realm_rules.gd 머리 참고.

## rtk.js settleMonth()+endMonth()의 축약 — 세력 금고는 **성 전부의 소득
## 합**(rtk.js settleMonth() "세력 금고" 루프 그대로)에서 정산하고, 군량·
## 치안·병력은 성마다 따로 정산한다.
##
## **2026-09-13 추가 — 인구 자연 증감 + 재해(disaster).** 3·4절 "제외"에
## 남아 있던 마지막 자동 시스템 — 그동안 "pop은 징병으로만 준다"던 것을
## rtk.js settleMonth() 공식 그대로 되살렸다. 재해는 harvestMul(세수·수확
## 배율)·troops·wall에 매달(지속되는 동안 매번) 영향을 준다 — 원작처럼
## 시작 달에 한 번만이 아니라 `c.disaster`가 남아 있는 한 매달 다시
## 적용된다(플레그 3개월이면 병력이 매달 5%씩 세 번 준다).
func next_month() -> void:
	if not result.is_empty():
		return
	var income := 0
	var harvest := month in RealmOrders.HARVEST_MONTHS
	for city_id: String in cities.keys():
		var c: Dictionary = cities[city_id]

		## rtk.js govMul(cityId) — 그 성에 배치된 무장 중 으뜸(태수)의 자질이
		## 그 성 살림에만 얹힌다. 배치된 무장이 없으면 mul=1.0(rtk.js: !c.gov
		## 이면 1을 돌려주는 것과 같다) — 인재를 안 심은 성은 더 못 큰다.
		var gov_id := _governor_at(city_id)
		var mul := 1.0
		if not gov_id.is_empty():
			mul = RealmOrders.gov_mul(_effective_stat(gov_id, "wisdom"), _effective_stat(gov_id, "command"))
			## rtk.js "태수로 한 달을 앉아 있으면 그만큼 는다" — 자리가 사람을 기른다.
			gain_exp(gov_id, int(RealmGrowth.EXP.gov))

		var dz: Dictionary = RealmOrders.disaster_by_key(String(c.get("disaster", "")))
		var harvest_mul: float = float(dz.get("harvest", 1.0)) if not dz.is_empty() else 1.0

		income += RealmOrders.gold_income(int(c.comm), mul, int(c.sec), harvest_mul)
		if harvest:
			c.food = int(c.food) + RealmOrders.food_income(int(c.agri), mul, int(c.sec), harvest_mul)

		## rtk.js settleMonth() "군량이 떨어지면 병사가 흩어진다" — 병력이
		## 생긴 이상(징병) 매달 군량을 먹는다는 것까지는 옮겨야 징병이 군량과
		## 관계 없는 죽은 숫자가 되지 않는다. troops=0이면 food_upkeep도 0.
		c.food = int(c.food) - RealmOrders.food_upkeep(int(c.troops))
		if int(c.food) < 0:
			var lost := mini(int(c.troops), roundi(-float(c.food) / float(RealmOrders.FOOD_PER_1000) * 1000.0))
			c.troops = int(c.troops) - lost
			c.food = 0

		## rtk.js settleMonth() "치안은 가만두면 내려간다" — 그대로 이식.
		c.sec = clampi(int(c.sec) - 1, 0, 100)

		## 인구 자연 증감 — RealmOrders.pop_growth_delta() 참고.
		var disaster_pop_mul: float = float(dz.get("pop", 0.0)) if not dz.is_empty() else 0.0
		var grow := RealmOrders.pop_growth_delta(int(c.pop), int(c.agri), int(c.sec), disaster_pop_mul)
		c.pop = maxi(RealmOrders.POP_FLOOR, roundi(float(c.pop) + grow))

		## 재해의 병력·성벽 피해 — 지속되는 동안 매달 다시 적용된다(위 머리말).
		if dz.has("troops"):
			c.troops = maxi(0, roundi(float(c.troops) * (1.0 + float(dz.troops))))
		if dz.has("wall"):
			c.wall = maxi(200, int(c.wall) + int(dz.wall))

		## 재해가 지나간다.
		if not String(c.get("disaster", "")).is_empty():
			c.d_left = int(c.d_left) - 1
			if int(c.d_left) <= 0:
				Toast.show(self, "%s %s — %s 이(가) 지나갔다" % [
					String(dz.get("emoji", "☀️")), String(RealmCities.any_by_id(city_id).get("name", city_id)), String(dz.get("name", "")),
				], 3.0)
				c.disaster = ""
				c.d_left = 0

	var upkeep := roster.size() * RealmOrders.UPKEEP_PER_OFFICER
	gold = maxi(0, gold + income - upkeep)

	## diplo.js monthly() — 화친이 달마다 한 달씩 닳는다. 0에서 멈춘다(원작은
	## 다 닳으면 키 자체를 지우는데, 이 슬라이스는 항상 값이 있는 Dictionary로
	## 두는 쪽이 `attack()`의 `dip.get("truce_months",0)` 체크와 더 맞는다).
	for force_id: String in diplomacy.keys():
		var dip: Dictionary = diplomacy[force_id]
		dip.truce_months = maxi(0, int(dip.truce_months) - 1)

	## PLAN 101-2 REALM ②후보 "외교 승리" — 살아있는 세력(아직 성이 하나도
	## 안 넘어온 쪽) 전부가 지금 화친 중이면 이어지고, 하나라도 깨지면
	## 되돌린다. 위에서 막 닳은 truce_months를 그대로 본다("이번 달"
	## 기준이 맞다).
	if _all_alive_forces_at_peace():
		diplomacy_peace_streak += 1
	else:
		diplomacy_peace_streak = 0

	_tick_ambitions()
	_tick_events()
	_tick_succession()
	_check_defection()
	_run_enemy_ai()
	_run_enemy_economy()
	_roll_disasters()

	month += 1
	if month > 12:
		month = 1
		year += 1
	_done_this_month.clear()
	_tick_hurt()
	check_result()



## G-0182 — 중상(officer_hurt) 남은 달을 하나씩 줄이고 0 이면 지운다(웹 rec.hurt 가 달마다 주는 것과 같다).
func _tick_hurt() -> void:
	for id: String in officer_hurt.keys():
		var left := int(officer_hurt[id]) - 1
		if left <= 0:
			officer_hurt.erase(id)
		else:
			officer_hurt[id] = left

## rtk.js rollDisasters() 그대로 — 달마다 한 번, DISASTER_CHANCE 확률로
## 성 하나를 골라 재해(또는 풍년)를 새로 건다. 이미 재해가 있거나 우리
## 성이 아니면(이 슬라이스는 성 셋 다 우리 것이라 사실상 늘 통과) 무시.
## 치안이 낮을수록 "나쁜" 재해(good=false) 쪽으로 기운다(rtk.js
## `0.55 + (60-sec)/200` 그대로, 0.3~0.9로 clamp).
func _roll_disasters() -> void:
	if _rng.randf() > RealmOrders.DISASTER_CHANCE:
		return
	var ids := cities.keys()
	if ids.is_empty():
		return
	var target_id: String = ids[_rng.randi_range(0, ids.size() - 1)]
	var c: Dictionary = cities[target_id]
	if not String(c.get("disaster", "")).is_empty():
		return
	var bad_chance := clampf(0.55 + (60.0 - float(c.sec)) / 200.0, 0.3, 0.9)
	var want_bad := _rng.randf() < bad_chance
	var pool: Array[String] = []
	for key: String in RealmOrders.DISASTERS:
		var d: Dictionary = RealmOrders.DISASTERS[key]
		if bool(d.get("good", false)) != want_bad:
			pool.append(key)
	if pool.is_empty():
		return
	var picked: String = pool[_rng.randi_range(0, pool.size() - 1)]
	var d: Dictionary = RealmOrders.DISASTERS[picked]
	c.disaster = picked
	c.d_left = int(d.months)
	Toast.show(self, "%s %s — %s" % [
		String(d.get("emoji", "")), String(RealmCities.any_by_id(target_id).get("name", target_id)), String(d.get("text", "")),
	], 3.0)


## officer.js checkDefection() — 충성이 12 이하면 35% 확률로 스스로
## 떠난다. 원작은 떠난 사람을 그 성의 재야(found)로 되돌리는데, 이
## 슬라이스는 그 경로를 안 옮겼다(re-hire 창구를 새로 여는 셈이라
## 스코프가 는다) — 로스터·배치·충성 기록에서 조용히 지운다.
func _check_defection() -> void:
	var leaving: Array = []
	for id: String in roster:
		if int(officer_loyal.get(id, 50)) > RealmDiplo.DEFECT_LOYAL_FLOOR:
			continue
		## PLAN 101-2 REALM ③후보 — 충직(자기 이탈 확률을 낮춘다, `realm_
		## traits.gd` TRAIT_LOYAL_DEFECT_MUL 머리말 참고)과 야망 좌절
		## "이간 취약 ×1.5"(재해석 — 자기 이탈 확률에 건다) 둘 다 여기서 곱한다.
		var chance := RealmDiplo.DEFECT_CHANCE
		if RealmTraits.has_trait(id, "loyal_heart"):
			chance *= RealmTraits.TRAIT_LOYAL_DEFECT_MUL
		var amb: Dictionary = officer_ambition.get(id, {})
		if int(amb.get("fail_months", 0)) > RealmTraits.AMBITION_FRUSTRATE_MONTHS:
			chance *= RealmTraits.AMBITION_FRUSTRATE_DEFECT_MUL
		## PLAN 101-2 REALM ⑥후보(계승) — 웹판 §5-8 "야심은 -25 + 3달 안에
		## 이탈 판정 ×2". 창이 지났으면(비교가 실패하면) 그냥 지나간다 —
		## _succeed_lord()가 심은 값을 여기서 지우지 않아도(자연 소멸) 되는
		## 이유는 이 비교 하나로 충분해서다(굳이 매달 청소 안 해도 안전).
		if _succession_shock_until.has(id) and RealmTraits.has_trait(id, "ambitious"):
			var due: Dictionary = _succession_shock_until[id]
			if year < int(due.year) or (year == int(due.year) and month <= int(due.month)):
				chance *= SUCCESSION_AMBITIOUS_DEFECT_MUL
		if _rng.randf() > chance:
			continue
		leaving.append(id)
	for id: String in leaving:
		roster.erase(id)
		officer_city.erase(id)
		officer_loyal.erase(id)
		_succession_shock_until.erase(id)


## `officer_growth()`와 같은 지연 초기화 — 처음 보는 무장이면 `RealmTraits.
## ambition_of()`로 결정적인 야망 하나를 배정한다(이후 절대 안 바뀐다).
func _ambition(id: String) -> Dictionary:
	if not officer_ambition.has(id):
		officer_ambition[id] = {"k": RealmTraits.ambition_of(id), "prog": 0, "done": false, "fail_months": 0}
	return officer_ambition[id]


## PLAN 101-2 REALM ③후보 — 웹판 §5-1 "무장 카드에 특성 배지 2개·야망
## 한 줄과 진행 막대"의 3D 판. 이 슬라이스엔 그림 카드가 없어(전부 텍스트
## `ChoicePrompt` 라벨) 승진·전임처럼 **사람을 직접 고르는 화면**에만
## 한 줄로 얹는다(등용·태수·출진은 자동 선택이라 고르는 화면 자체가 없다).
func officer_hint(id: String) -> String:
	var badge := RealmTraits.trait_badge(id)
	var amb := _ambition(id)
	var def: Dictionary = RealmTraits.AMBITIONS.get(String(amb.k), {})
	var mark := "달성" if bool(amb.get("done", false)) else "%d/%d" % [int(amb.get("prog", 0)), int(def.get("target", 1))]
	return "%s 야망:%s(%s)" % [badge, String(def.get("name", "")), mark]


## PLAN 101-2 REALM ③후보(웹판 §5-1) — 달마다 로스터 전원의 야망 진행도를
## 다시 잰다. 대부분은 "지금 상태가 문턱을 넘었는가"를 그대로 다시 계산하는
## 절대값 판정이라(연속 개월만 예외 — 태수) 저장된 `prog`는 표시용 스냅샷일
## 뿐 판정 자체는 매번 새로 한다(진단이 "결과가 재현 가능"하려면 이쪽이
## 과거 이벤트를 따로 누적하는 것보다 안전하다).
func _tick_ambitions() -> void:
	for id: String in roster:
		if Characters.find(id) == null:
			continue
		var amb := _ambition(id)
		if bool(amb.get("done", false)):
			continue
		var key: String = String(amb.k)
		var def: Dictionary = RealmTraits.AMBITIONS.get(key, {})
		if def.is_empty():
			continue
		var target := int(def.target)
		var prog := 0
		match key:
			"governor":
				var is_gov := false
				for city_id: String in cities.keys():
					if _governor_at(city_id) == id:
						is_gov = true
						break
				prog = mini(target, int(amb.get("prog", 0)) + 1) if is_gov else 0
			"hometown":
				prog = mini(target, cities.size())
			"rival":
				prog = mini(target, enemies_subverted)
			"wealth":
				prog = mini(target, gold)
			"fame":
				prog = mini(target, int(_growth(id).get("rank", 0)))
			"scholar":
				prog = mini(target, quiz.learned.size())
		amb.prog = prog
		if prog >= target:
			amb.done = true
			amb.fail_months = 0
			_grant_ambition_reward(id, key)
		else:
			amb.fail_months = int(amb.get("fail_months", 0)) + 1
			## 웹판 §5-1 "12달 넘게 좌절이면 충성 -3/달" — 이간 취약 배율은
			## `_check_defection()`이 이 `fail_months`를 직접 읽어 적용한다.
			if int(amb.fail_months) > RealmTraits.AMBITION_FRUSTRATE_MONTHS:
				officer_loyal[id] = clampi(int(officer_loyal.get(id, 50)) - RealmTraits.AMBITION_FRUSTRATE_LOYAL_HIT, 0, 100)
		officer_ambition[id] = amb


## 야망 달성 보상 — 웹판 §5-1 "충성 +20·능력 +2 영구" 그대로.
func _grant_ambition_reward(id: String, key: String) -> void:
	officer_loyal[id] = clampi(int(officer_loyal.get(id, 50)) + RealmTraits.AMBITION_DONE_LOYAL, 0, 100)
	var stat_key := String(RealmTraits.AMBITIONS[key].get("reward_stat", "wisdom"))
	_add_growth_bonus(id, stat_key, RealmTraits.AMBITION_DONE_STAT)
	var h = Characters.find(id)
	if h != null:
		Toast.show(self, "🎯 %s — 야망 \"%s\"을(를) 이루었다! 충성 +%d · %s +%d" % [
			String(h.name), String(RealmTraits.AMBITIONS[key].name),
			RealmTraits.AMBITION_DONE_LOYAL, stat_key, RealmTraits.AMBITION_DONE_STAT,
		], 3.0)


## PLAN 101-2 REALM ⑤후보(웹판 §5-2) — 달마다 한 번, 로스터 중 이미 걸린
## 카드가 없는 무장을 골라 `RealmEvents.EVENT_CHANCE`(18%) 확률로 새 이벤트를
## 하나 건다(웹판 "세력당 동시 진행 체인 최대 2" — `active_events`엔 아직
## 도달 안 한 체인 후속도 포함되므로, 체인이 밀려 있으면 새 이벤트가 덜
## 뜬다는 뜻도 된다, 웹판과 같은 결).
func _tick_events() -> void:
	if active_events.size() >= RealmEvents.MAX_CONCURRENT or roster.is_empty():
		return
	if _rng.randf() > RealmEvents.EVENT_CHANCE:
		return
	var busy: Dictionary = {}
	for e: Dictionary in active_events:
		busy[String(e.officer)] = true
	var candidates: Array = []
	for id: String in roster:
		if not busy.has(id):
			candidates.append(id)
	if candidates.is_empty():
		return
	var officer_id: String = candidates[_rng.randi_range(0, candidates.size() - 1)]
	var amb := _ambition(officer_id)
	var event_id := RealmEvents.pick_for(officer_id, String(amb.k), _rng)
	if event_id.is_empty():
		return
	active_events.append({"id": event_id, "officer": officer_id, "due_month": month, "due_year": year})


## 지금 화면에 띄워 고를 수 있는 이벤트들 — `active_events`의 인덱스를
## 그대로 돌려준다(`resolve_event()`가 그 인덱스로 다시 찾는다). 체인
## 후속이 아직 예약된 미래 달이면(`due_year`/`due_month`가 지금보다 뒤)
## 빠진다.
func ready_events() -> Array[int]:
	var out: Array[int] = []
	for i in active_events.size():
		var e: Dictionary = active_events[i]
		if int(e.due_year) < year or (int(e.due_year) == year and int(e.due_month) <= month):
			out.append(i)
	return out


## choice_idx로 고른 효과를 얹고 카드를 치운다 — 체인이 있으면 `chain_months`
## 뒤로 후속을 새로 건다(같은 무장). 인덱스가 비정상이면(이미 처리됐거나
## UI가 낡은 목록을 들고 있으면) 조용히 false.
func resolve_event(index: int, choice_idx: int) -> bool:
	if index < 0 or index >= active_events.size():
		return false
	var e: Dictionary = active_events[index]
	var def: Dictionary = RealmEvents.by_key(String(e.id))
	var choices: Array = def.get("choices", [])
	if def.is_empty() or choice_idx < 0 or choice_idx >= choices.size():
		return false
	var choice: Dictionary = choices[choice_idx]
	var officer_id: String = String(e.officer)

	officer_loyal[officer_id] = clampi(int(officer_loyal.get(officer_id, 50)) + int(choice.get("loyal", 0)), 0, 100)
	gold = maxi(0, gold + int(choice.get("gold", 0)))
	if int(choice.get("exp", 0)) > 0:
		gain_exp(officer_id, int(choice.exp))
	## 야망 "숙적"(realm_traits.gd AMBITIONS.rival) 진척 — realm_events.gd
	## rival_chance 항목의 두 선택이 이 플래그를 켠다(같은 판정 없이 곧바로
	## "계략 성공"으로 재해석 — 실제 계략 성공률 판정은 plot()이 이미
	## 따로 있어 여기서 다시 굴리지 않는다, 이벤트 자체가 "기회가 왔다"는
	## 서사라 고르면 곧바로 진척된다).
	if bool(choice.get("ambition_progress", false)):
		var amb := _ambition(officer_id)
		if String(amb.k) == "rival" and not bool(amb.get("done", false)):
			amb.prog = int(amb.get("prog", 0)) + 1

	active_events.remove_at(index)
	events_done[String(e.id)] = int(events_done.get(String(e.id), 0)) + 1

	var chain_id := String(choice.get("chain", ""))
	if not chain_id.is_empty():
		var due_m := month
		var due_y := year
		for _i in int(choice.get("chain_months", 3)):
			due_m += 1
			if due_m > 12:
				due_m = 1
				due_y += 1
		active_events.append({"id": chain_id, "officer": officer_id, "due_month": due_m, "due_year": due_y})

	var h = Characters.find(officer_id)
	Toast.show(self, "%s %s — %s: %s" % [
		String(def.get("emoji", "📜")), String(h.name) if h != null else officer_id,
		String(def.get("name", "")), String(choice.get("label", "")),
	], 3.0)
	return true


## PLAN 101-2 REALM ⑥후보(웹판 §5-8) — 나이 시스템이 없어 매달 고정 확률로
## "군주 유고"를 굴린다(손잡이 꺼짐이면 건드리지 않는다). 0.6%/달은 대략
## 평균 14년에 한 번 — 웹판 "65세+ 사망 확률은 부하의 절반"이 이 슬라이스엔
## 잴 기준(부하 사망 확률 자체)이 없어 직접 낮게 잡은 값이다.
const LORD_DEATH_CHANCE_MONTHLY := 0.006
const SUCCESSION_DEFAULT_LOYAL_HIT := -15   # 웹판 "-10~-20" 중간값
const SUCCESSION_AMBITIOUS_LOYAL_HIT := -25 # 웹판 "야심은 -25" 그대로
const SUCCESSION_AMBITIOUS_DEFECT_MUL := 2.0 # 웹판 "이탈 판정 ×2" 그대로
const SUCCESSION_SHOCK_MONTHS := 3           # 웹판 "3달 안에" 그대로


func _tick_succession() -> void:
	if not lord_succession_enabled:
		return
	if _rng.randf() > LORD_DEATH_CHANCE_MONTHLY:
		return
	_succeed_lord()


## 지정된 후계(로스터에 아직 있으면)가 있으면 그 사람, 없으면 웹판 그대로
## "충성 최고 → 관직 최고" 순으로 자동 고른다. 로스터가 비어 있으면(극단
## 상황) ""을 돌려 계승 자체를 건너뛴다.
func _pick_heir() -> String:
	if not heir_id.is_empty() and roster.has(heir_id):
		return heir_id
	var best := ""
	var best_loyal := -1
	var best_rank := -1
	for id: String in roster:
		var loyal := int(officer_loyal.get(id, 50))
		var g: Dictionary = officer_growth.get(id, {"rank": 0})
		var rank := int(g.get("rank", 0))
		if loyal > best_loyal or (loyal == best_loyal and rank > best_rank):
			best = id
			best_loyal = loyal
			best_rank = rank
	return best


## 웹판 §5-8 "사망 시 후계자가 군주(충성 100 고정 이양), 다른 무장 충성
## -10~-20(충직 0·야심 -25+3달 이탈×2)" 그대로 — AI 자동 후계까지는
## 이 슬라이스에 적(AI 세력) 무장 로스터·군주 개념이 없어(§4 "제외") 옮기지
## 않는다(우리 세력 한정, 웹판도 "AI도 같은 함수"일 뿐 새 판정은 아니다).
func _succeed_lord() -> void:
	if roster.is_empty():
		return
	var new_lord := _pick_heir()
	if new_lord.is_empty():
		return
	var old_lord_id := current_lord_id
	current_lord_id = new_lord
	officer_loyal[new_lord] = 100
	for id: String in roster:
		if id == new_lord:
			continue
		var hit := SUCCESSION_DEFAULT_LOYAL_HIT
		if RealmTraits.has_trait(id, "loyal_heart"):
			hit = 0
		elif RealmTraits.has_trait(id, "ambitious"):
			hit = SUCCESSION_AMBITIOUS_LOYAL_HIT
			var due_m := month
			var due_y := year
			for _i in SUCCESSION_SHOCK_MONTHS:
				due_m += 1
				if due_m > 12:
					due_m = 1
					due_y += 1
			_succession_shock_until[id] = {"month": due_m, "year": due_y}
		officer_loyal[id] = clampi(int(officer_loyal.get(id, 50)) + hit, 0, 100)
	heir_id = ""  # 이번 지정은 소비됐다 — 다음 계승을 위해선 다시 지정해야 한다
	var old_h = Characters.find(old_lord_id)
	var new_h = Characters.find(new_lord)
	var new_lord_name := String(new_h.name) if new_h != null else new_lord
	Toast.show(self, "⚰️ %s 별세 — 👑 %s 즉위" % [
		String(old_h.name) if old_h != null else old_lord_id,
		new_lord_name,
	], 4.0)
	LordPortrait.show_lord(self, new_lord_name, 4.0)


