extends RefCounted

## G-0399 4종횡 장비 세트(메이플 세트 효과·디아블로 세트 스킬 — 구조만) — 웹 saga-story/js/gear-set.js(W-0437 ①) 짝, 수치 그대로.
##   세트   SETS 한 줄 = 이름·조각(GEAR key)·짝 수별 효과(누적 — 4 를 채우면 2·3 도 다 붙음)
##   효과   2·3 짝 = 공격·방어·체력 더하기(StorySaveState.gear_totals 합에 얹음) · 4 짝 = 세트 무예 한 칸(F, 기력 0 · 쿨만 — 벗으면 빠짐)
##   셈     요구 수준 미달(need > 레벨)은 짝으로 안 센다
## 지금 SETS 는 대역 둘 — K 생성기 표(W-0435: 세트 20)가 오면 줄만 늘린다. 세이브 안 바뀜(낀 것에서 셈). SAGA_GEAR_SET=0 이면 끔.
## 무예 반경 r 은 웹 px — 고돗 4종횡 눈금 0.02 m/px(사냥터 width_px = width_m / 0.02)로 바꾼다.

const SETS := [
	{"key": "set_ryong", "name": "흑룡 채비", "pieces": ["shoe4", "glv4", "cap4", "ring4"],
		"bonus": {2: {"atk": 8.0}, 3: {"hp": 120.0}, 4: {"def": 12.0}},
		"skill": {"key": "set_ryong", "name": "흑룡파(黑龍波)", "emoji": "🐉", "cd": 12.0, "effect": "aoe", "mul": 3.2, "r": 150.0, "desc": "흑룡 채비 네 점 — 주위를 크게 휩쓴다"}},
	{"key": "set_ok", "name": "옥 장신구", "pieces": ["ring3", "neck3", "ear3", "glv3"],
		"bonus": {2: {"hp": 60.0}, 3: {"atk": 6.0}, 4: {"def": 6.0}},
		"skill": {"key": "set_ok", "name": "옥령탄(玉靈彈)", "emoji": "💎", "cd": 9.0, "effect": "bolt", "mul": 2.6, "desc": "옥 장신구 네 점 — 앞으로 꿰뚫는 기를 날린다"}},
]
const PX_M := 0.02


static func on() -> bool:
	return OS.get_environment("SAGA_GEAR_SET") != "0"


## 낀 장비 중 요구 수준을 채운 key
static func worn_keys(S: Object) -> Array:
	var out: Array = []
	for k: Variant in (S.equipped as Dictionary).values():
		var d: Dictionary = StoryCombat.item_def(String(k))
		if not d.is_empty() and int(S.level) >= int(d.get("need", 0)):
			out.append(String(k))
	return out


## 세트마다 낀 짝 수 {key: n}
static func counts(keys: Array) -> Dictionary:
	var out := {}
	for s: Dictionary in SETS:
		var n := 0
		for p: String in s.pieces:
			n += 1 if keys.has(p) else 0
		out[String(s.key)] = n
	return out


## 더할 {atk, def, hp} — 짝 수 이하 효과 누적
static func bonus_of(keys: Array) -> Dictionary:
	var sum := {"atk": 0.0, "def": 0.0, "hp": 0.0}
	if not on():
		return sum
	var c := counts(keys)
	for s: Dictionary in SETS:
		for k: int in (s.bonus as Dictionary):
			if k <= int(c[s.key]):
				for st: String in (s.bonus[k] as Dictionary):
					sum[st] = float(sum[st]) + float(s.bonus[k][st])
	return sum


## 다 채운 세트의 무예들
static func skills_of(keys: Array) -> Array:
	var out: Array = []
	if not on():
		return out
	var c := counts(keys)
	for s: Dictionary in SETS:
		if s.has("skill") and int(c[s.key]) >= (s.pieces as Array).size():
			out.append(s.skill)
	return out


static func set_of(gear_key: String) -> Dictionary:
	for s: Dictionary in SETS:
		if (s.pieces as Array).has(gear_key):
			return s
	return {}


## 「내 정보」 줄 — 낀 짝이 하나라도 있는 세트만 [{label, value, detail}]
static func me_rows(S: Object) -> Array:
	var out: Array = []
	if not on():
		return out
	var c := counts(worn_keys(S))
	for s: Dictionary in SETS:
		var n := int(c[s.key])
		if n <= 0:
			continue
		var parts: Array = []
		for k: int in (s.bonus as Dictionary):
			for st: String in (s.bonus[k] as Dictionary):
				parts.append("%d짝 %s +%d%s" % [k, {"atk": "공격", "def": "방어", "hp": "체력"}[st], int(s.bonus[k][st]), "" if k <= n else "(아직)"])
		var sk: Dictionary = s.get("skill", {})
		parts.append("4짝 %s %s%s" % [String(sk.get("emoji", "")), String(sk.get("name", "")), " — F" if n >= (s.pieces as Array).size() else "(아직)"])
		out.append({"label": "🧩 " + String(s.name), "value": "%d/%d" % [n, (s.pieces as Array).size()], "detail": " · ".join(parts)})
	return out
