extends RefCounted

## G-0296 4종횡 달 사명(웹 W-0242 monthly.js 짝) — 달마다 하나: 이번 달(YYYY-MM, 기기 날짜) 안에 어디서든 몹 GOAL 마리,
## 이달의 사냥터(달 열쇠 해시로 앞쪽 사냥터 여섯 중 하나)에선 두 배로 센다. 채우면 그 달 '달 문장'을 모은다(힘 없음 — 도감처럼).
## 새 달은 셈만 새로, 모은 문장은 그대로. 놓쳐도 벌칙 없음(SAGA-DESIGN §3 H).
## 세이브 칸 = StorySaveState.monthly {key, n, badges:[달 열쇠…]} — 규칙은 여기 순수 함수, 상태는 그 사전을 참조로 고친다.

const GOAL := 300
const FEATURED := ["sinya", "field", "port", "forest", "namjeong", "cave"]   # scenario.gd STAGE_NAMES 앞쪽 사냥터 여섯(허도 = 마을 뺌)


static func key_of(date: Dictionary) -> String:
	return "%04d-%02d" % [int(date.year), int(date.month)]


static func now_key() -> String:
	return key_of(Time.get_date_dict_from_system())


## 달 열쇠 → 이달의 사냥터(같은 달이면 늘 같은 곳)
static func featured_of(key: String) -> String:
	var h := 0
	for i in key.length():
		h = (h * 31 + key.unicode_at(i)) % 1000003
	return FEATURED[h % FEATURED.size()]


## 처치 한 마리 — 달이 바뀌었으면 셈부터 새로. 이번에 채웠으면 true(문장 하나 더함).
static func on_kill(st: Dictionary, stage: String, key: String) -> bool:
	if String(st.get("key", "")) != key:
		st["key"] = key
		st["n"] = 0
	if not st.has("badges"):
		st["badges"] = []
	var before := int(st.get("n", 0))
	if before >= GOAL:
		return false
	st["n"] = mini(GOAL, before + (2 if stage == featured_of(key) else 1))
	if int(st.n) >= GOAL and not (st.badges as Array).has(key):
		(st.badges as Array).append(key)
		return true
	return false


## 세션 카드 한 줄
static func line(st: Dictionary, key: String, stage_names: Dictionary) -> String:
	var n := int(st.get("n", 0)) if String(st.get("key", "")) == key else 0
	var f := featured_of(key)
	var done := "  ✔" if n >= GOAL else ""
	return "🌙 달 사명 %d/%d%s · 이달의 사냥터 %s(두 배) · 달 문장 %d" % [n, GOAL, done, String(stage_names.get(f, f)), (st.get("badges", []) as Array).size()]
