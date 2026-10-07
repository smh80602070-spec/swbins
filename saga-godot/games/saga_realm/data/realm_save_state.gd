extends RealmRulesMonth

## 사가천하 세이브 상태(autoload) — 저장·불러오기·마이그레이션만. 상태 변수는 realm_state.gd, 규칙은 realm_rules*.gd (상속 사슬, G-0006).

const SAVE_PATH := "user://save_realm.json"
const SaveSlots := preload("res://saga_core/data/save_slots.gd")   # G-0070 슬롯(1 = 이 파일 그대로)
const SafeFile := preload("res://saga_core/data/safe_file.gd")  # 임시 파일 → .bak → 바꿔치기(쓰는 도중 꺼져도 직전본이 남는다)
const SAVE_VERSION := 16  # 1(성 하나) → 2(성 여러 곳) → 3(officer_city) → 4(enemies) → 5(diplomacy) → 6(정복 성 편입) → 7(충성·계략) → 8(문답) → 9(이간·매수) → 10(인구 증감+재해: cities[].disaster/d_left) → 11(승진/관직: officer_growth) → 12(승패 판정: result) → 13(시나리오: scenario_id) → 14(특성·야망: officer_ambition/enemies_subverted, PLAN 101-2 REALM ③) → 15(이벤트 체인: active_events/events_done, PLAN 101-2 REALM ⑤) → 16(계승: lord_succession_enabled/current_lord_id/heir_id/_succession_shock_until, PLAN 101-2 REALM ⑥)


func save_version() -> int:
	return SAVE_VERSION


func save_path() -> String:
	return SaveSlots.path_for("realm", SAVE_PATH)


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
