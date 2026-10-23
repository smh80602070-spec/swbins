extends RealmRulesMonth

## 사가천하 세이브 상태(autoload) — 저장·불러오기·마이그레이션만. 상태 변수는 realm_state.gd, 규칙은 realm_rules*.gd (상속 사슬, G-0006).

const SAVE_PATH := "user://save_realm.json"
const SaveSlots := preload("res://saga_core/data/save_slots.gd")   # G-0070 슬롯(1 = 이 파일 그대로)
const SafeFile := preload("res://saga_core/data/safe_file.gd")  # 임시 파일 → .bak → 바꿔치기(쓰는 도중 꺼져도 직전본이 남는다)
const SAVE_VERSION := 26  # 25→26(장수 관계망: rel_master, G-0316) · 24→25(교역로: trade, G-0310) · 23→24(불가사의: wonders, G-0243) · 22→23(진·보급선: camps, G-0239) · 21→22(기술 나무: tech, G-0234) · 20→21(AI 세력 경륜도: ai_passive, G-0219) · 19→20(경륜도: passive, G-0216) · 18→19(영내 소식: news, G-0194) · 17→18(격자 전술: officer_hurt/annals, G-0182) · 16→17(이야기 카드: story, G-0088) · 1(성 하나) → 2(성 여러 곳) → 3(officer_city) → 4(enemies) → 5(diplomacy) → 6(정복 성 편입) → 7(충성·계략) → 8(문답) → 9(이간·매수) → 10(인구 증감+재해: cities[].disaster/d_left) → 11(승진/관직: officer_growth) → 12(승패 판정: result) → 13(시나리오: scenario_id) → 14(특성·야망: officer_ambition/enemies_subverted, PLAN 101-2 REALM ③) → 15(이벤트 체인: active_events/events_done, PLAN 101-2 REALM ⑤) → 16(계승: lord_succession_enabled/current_lord_id/heir_id/_succession_shock_until, PLAN 101-2 REALM ⑥)


func save_version() -> int:
	return SAVE_VERSION


func save_path() -> String:
	return path_override if path_override != "" else SaveSlots.path_for("realm", SAVE_PATH)


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
		"passive": passive,   # G-0216
		"ai_passive": ai_passive,   # G-0219
		"tech": tech,   # G-0234
		"camps": camps,   # G-0239
		"wonders": wonders,   # G-0243
		"trade": trade,   # G-0310
		"rel_master": rel_master,   # G-0316
		"enemy_officer_loyal": enemy_officer_loyal,
		"diplomacy": diplomacy,
		"quiz": quiz,
		"result": result,
		"diplomacy_peace_streak": diplomacy_peace_streak,
		"officer_ambition": officer_ambition,
		"enemies_subverted": enemies_subverted,
		"active_events": active_events,
		"events_done": events_done,
		"story": story,   # G-0088
		"lord_succession_enabled": lord_succession_enabled,
		"current_lord_id": current_lord_id,
		"heir_id": heir_id,
		"succession_shock_until": _succession_shock_until,
		"officer_hurt": officer_hurt,   # G-0182
		"annals": annals,
		"news": news,   # G-0194
	}
	return SafeFile.write_text(save_path(), JSON.stringify(data))


func try_load() -> bool:
	var parsed: Variant = SafeFile.read_json(save_path())
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
	var loaded_passive: Variant = data.get("passive", null)   # G-0216 — 옛 세이브(19)는 빈 칸
	passive = (loaded_passive as Dictionary).duplicate(true) if typeof(loaded_passive) == TYPE_DICTIONARY and (loaded_passive as Dictionary).has("taken") else {"start": null, "taken": []}
	_passive_api = null
	var loaded_ai: Variant = data.get("ai_passive", null)   # G-0219 — 옛 세이브(20)는 빈 칸
	ai_passive = (loaded_ai as Dictionary).duplicate(true) if typeof(loaded_ai) == TYPE_DICTIONARY else {}
	var loaded_tech: Variant = data.get("tech", null)   # G-0234 — 옛 세이브(21)는 0점
	tech = (loaded_tech as Dictionary).duplicate(true) if typeof(loaded_tech) == TYPE_DICTIONARY else {}
	preload("res://games/saga_realm/data/realm_tech.gd").bump()
	var loaded_camps: Variant = data.get("camps", [])   # G-0239 — 옛 세이브(22)는 빈 배열
	camps = (loaded_camps as Array).duplicate(true) if typeof(loaded_camps) == TYPE_ARRAY else []
	var loaded_trade: Variant = data.get("trade", [])   # G-0310 — 옛 세이브(24)는 상단 없음
	trade = (loaded_trade as Array).duplicate(true) if typeof(loaded_trade) == TYPE_ARRAY else []
	var loaded_rm: Variant = data.get("rel_master", {})   # G-0316 — 옛 세이브(25)는 빈 것
	rel_master = (loaded_rm as Dictionary).duplicate(true) if typeof(loaded_rm) == TYPE_DICTIONARY else {}
	var loaded_wonders: Variant = data.get("wonders", null)   # G-0243 — 옛 세이브(23)는 아무도 안 지었다
	wonders = (loaded_wonders as Dictionary).duplicate(true) if typeof(loaded_wonders) == TYPE_DICTIONARY else {"built": {}, "jobs": {}}
	preload("res://games/saga_realm/data/realm_wonder.gd").state(self)   # built·jobs 칸 채움
	preload("res://games/saga_realm/data/realm_wonder.gd").bump()
	_ai_apis = {}
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
	var loaded_story: Variant = data.get("story", {})   # G-0088 — 없으면(옛 세이브) 1막 첫 카드부터, 지난 달만큼 밀린 카드가 하나씩
	story = (loaded_story as Dictionary).duplicate(true) if typeof(loaded_story) == TYPE_DICTIONARY else {}
	lord_succession_enabled = bool(data.get("lord_succession_enabled", false))
	current_lord_id = String(data.get("current_lord_id", RealmDiplo.LORD_ID))
	heir_id = String(data.get("heir_id", ""))
	var loaded_shock: Variant = data.get("succession_shock_until", {})
	_succession_shock_until = loaded_shock if typeof(loaded_shock) == TYPE_DICTIONARY else {}
	var loaded_hurt: Variant = data.get("officer_hurt", {})   # G-0182 — 옛 세이브는 빈 값
	officer_hurt = loaded_hurt if typeof(loaded_hurt) == TYPE_DICTIONARY else {}
	var loaded_annals: Variant = data.get("annals", {})
	annals = loaded_annals if typeof(loaded_annals) == TYPE_DICTIONARY else {}
	var loaded_news: Variant = data.get("news", [])   # G-0194 — 옛 세이브는 빈 값
	news = (loaded_news as Array).duplicate(true) if typeof(loaded_news) == TYPE_ARRAY else []
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
