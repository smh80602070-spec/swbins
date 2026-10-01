extends RealmRules

## 사가국지 세이브 상태(autoload) — 저장·불러오기·마이그레이션만. 상태 변수는 realm_state.gd, 규칙은 realm_rules*.gd (상속 사슬, G-0006).

const SAVE_PATH := "user://save_realm.json"
const SafeFile := preload("res://saga_core/data/safe_file.gd")  # 임시 파일 → .bak → 바꿔치기(쓰는 도중 꺼져도 직전본이 남는다)
const SAVE_VERSION := 16  # 1(성 하나) → 2(성 여러 곳) → 3(officer_city) → 4(enemies) → 5(diplomacy) → 6(정복 성 편입) → 7(충성·계략) → 8(문답) → 9(이간·매수) → 10(인구 증감+재해: cities[].disaster/d_left) → 11(승진/관직: officer_growth) → 12(승패 판정: result) → 13(시나리오: scenario_id) → 14(특성·야망: officer_ambition/enemies_subverted, PLAN 101-2 REALM ③) → 15(이벤트 체인: active_events/events_done, PLAN 101-2 REALM ⑤) → 16(계승: lord_succession_enabled/current_lord_id/heir_id/_succession_shock_until, PLAN 101-2 REALM ⑥)


func save_version() -> int:
	return SAVE_VERSION


func save_path() -> String:
	return SAVE_PATH


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
	check_result()


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


func save() -> bool:
	var data := {
		"version": SAVE_VERSION,
		"scenario_id": scenario_id,
		"year": year, "month": month,
		"gold": gold,
		"cities": cities,
		"current_city": current_city,
		"roster": roster, "found": found,
		"officer_city": officer_city,
		"officer_loyal": officer_loyal,
		"officer_growth": officer_growth,
		"enemies": enemies,
		"enemy_officer_loyal": enemy_officer_loyal,
		"diplomacy": diplomacy,
		"quiz": quiz,
		"result": result,
		"diplomacy_peace_streak": diplomacy_peace_streak,
		"officer_ambition": officer_ambition,
		"enemies_subverted": enemies_subverted,
		"active_events": active_events,
		"events_done": events_done,
		"lord_succession_enabled": lord_succession_enabled,
		"current_lord_id": current_lord_id,
		"heir_id": heir_id,
		"succession_shock_until": _succession_shock_until,
	}
	return SafeFile.write_text(SAVE_PATH, JSON.stringify(data))


func try_load() -> bool:
	var parsed: Variant = SafeFile.read_json(SAVE_PATH)
	if parsed == null:
		return false
	var migrated: Variant = _migrate(parsed)
	if migrated == null:
		return false
	var data: Dictionary = migrated

	scenario_id = String(data.get("scenario_id", "194"))
	if not RealmCities.SCENARIO_CAO_CITIES.has(scenario_id):
		scenario_id = "194"
	## city_force는 저장하지 않는다(파생값) — scenario_id로 다시 채운다.
	_init_city_force(RealmCities.SCENARIO_FORCE_OVERRIDE.get(scenario_id, {}))
	year = int(data.get("year", 194))
	month = int(data.get("month", 1))
	gold = int(data.get("gold", 3200))
	var loaded_cities: Variant = data.get("cities", {})
	if typeof(loaded_cities) == TYPE_DICTIONARY and not loaded_cities.is_empty():
		cities = loaded_cities
	current_city = String(data.get("current_city", RealmCities.DEFAULT_CITY))
	roster = data.get("roster", [RealmOfficerPool.STARTING_OFFICER])
	found = data.get("found", [])
	var loaded_officer_city: Variant = data.get("officer_city", {})
	if typeof(loaded_officer_city) == TYPE_DICTIONARY and not loaded_officer_city.is_empty():
		officer_city = loaded_officer_city
	var loaded_officer_loyal: Variant = data.get("officer_loyal", {})
	if typeof(loaded_officer_loyal) == TYPE_DICTIONARY and not loaded_officer_loyal.is_empty():
		officer_loyal = loaded_officer_loyal
	var loaded_officer_growth: Variant = data.get("officer_growth", {})
	if typeof(loaded_officer_growth) == TYPE_DICTIONARY:
		officer_growth = loaded_officer_growth
	var loaded_enemies: Variant = data.get("enemies", {})
	if typeof(loaded_enemies) == TYPE_DICTIONARY and not loaded_enemies.is_empty():
		enemies = loaded_enemies
	var loaded_enemy_officer_loyal: Variant = data.get("enemy_officer_loyal", {})
	if typeof(loaded_enemy_officer_loyal) == TYPE_DICTIONARY and not loaded_enemy_officer_loyal.is_empty():
		enemy_officer_loyal = loaded_enemy_officer_loyal
	var loaded_diplomacy: Variant = data.get("diplomacy", {})
	if typeof(loaded_diplomacy) == TYPE_DICTIONARY and not loaded_diplomacy.is_empty():
		diplomacy = loaded_diplomacy
	var loaded_quiz: Variant = data.get("quiz", {})
	if typeof(loaded_quiz) == TYPE_DICTIONARY and not loaded_quiz.is_empty():
		quiz = loaded_quiz
	result = String(data.get("result", ""))
	diplomacy_peace_streak = int(data.get("diplomacy_peace_streak", 0))
	var loaded_officer_ambition: Variant = data.get("officer_ambition", {})
	if typeof(loaded_officer_ambition) == TYPE_DICTIONARY:
		officer_ambition = loaded_officer_ambition
	enemies_subverted = int(data.get("enemies_subverted", 0))
	var loaded_active_events: Variant = data.get("active_events", [])
	active_events = loaded_active_events if typeof(loaded_active_events) == TYPE_ARRAY else []
	var loaded_events_done: Variant = data.get("events_done", {})
	events_done = loaded_events_done if typeof(loaded_events_done) == TYPE_DICTIONARY else {}
	lord_succession_enabled = bool(data.get("lord_succession_enabled", false))
	current_lord_id = String(data.get("current_lord_id", RealmDiplo.LORD_ID))
	heir_id = String(data.get("heir_id", ""))
	var loaded_shock: Variant = data.get("succession_shock_until", {})
	_succession_shock_until = loaded_shock if typeof(loaded_shock) == TYPE_DICTIONARY else {}
	_done_this_month.clear()
	return true


## 올린 1~15단계는 필드 추가뿐이고 try_load()가 전부 .get(key, 기본값)으로
## 읽으므로, 여기 단계들은 실제 변환 없이 버전 숫자만 올려 통과시킨다
## (필드 이름을 바꾸거나 옮기는 변경이 생기면 그 단계에 변환을 추가한다).
func _migrate_step(from_version: int, data: Dictionary) -> Variant:
	if from_version < 1 or from_version >= SAVE_VERSION:
		return null
	data["version"] = from_version + 1
	return data
