extends RefCounted

## G-0390 5천하 지원 단계 — 웹 saga-web/saga-realm/js/support.js(W-0425) 짝. 수치 그대로(파이어 엠블렘 지원 — 구조만).
##   셈     전술판에서 내 장수가 칠 때 상하좌우 이웃(거리 1)에 선 내 장수 쌍을 판(b.sup_pairs)에 적고, 판이 끝나면 쌍마다 +1 — 한 판 한 번
##   단계   점수 3·7·12 → C·B·A · 의형제(realm_relation sworn)는 점수 없이도 B 부터 · 원수(foe)는 안 오름·덤 없음
##   덤     칠 때 이웃에 지원 쌍이 있으면 명중 +5·+10·+15, 맞을 때 대상 이웃에 지원 쌍이 있으면 그만큼 깎음 — 쌍 여럿이면 가장 큰 것 하나
## 판 규칙(realm_tactics.gd)은 세이브를 안 읽는다 — 판을 세울 때 board_table() 로 쌍 단계 표를 b.sup 에 싣는다(없으면 옛 판과 같다).
## S = RealmSaveState. 저장 키 "support" {'a|b'(id 사전순): 점수}(덧붙임만, 버전 그대로). SAGA_SUPPORT=0 이면 끔.

const Characters := preload("res://saga_core/data/characters.gd")
const Relation := preload("res://games/saga_realm/data/realm_relation.gd")

const STEPS := [3, 7, 12]
const NAMES := ["C", "B", "A"]
const BONUS := [5, 10, 15]


static func on() -> bool:
	return OS.get_environment("SAGA_SUPPORT") != "0"


static func key(a: String, b: String) -> String:
	return a + "|" + b if a < b else b + "|" + a


## "sworn"·"foe"·""(관계망이 꺼져 있어도 표는 읽는다 — 웹 relData 그대로)
static func rel_kind(a: String, b: String) -> String:
	for p: Array in Relation.pairs_of(a):
		if (String(p[0]) == b or String(p[1]) == b) and (String(p[2]) == "sworn" or String(p[2]) == "foe"):
			return String(p[2])
	return ""


## 단계 0(없음)·1 C·2 B·3 A — 순수
static func level_of(pts: int, kind: String) -> int:
	if kind == "foe":
		return 0
	var lv := 0
	for i in STEPS.size():
		if pts >= int(STEPS[i]):
			lv = i + 1
	return maxi(2, lv) if kind == "sworn" else lv


static func points(S: Object, a: String, b: String) -> int:
	return int((S.support as Dictionary).get(key(a, b), 0))


static func level(S: Object, a: String, b: String) -> int:
	if a == "" or b == "" or a == b:
		return 0
	return level_of(points(S, a, b), rel_kind(a, b))


static func name_of(lv: int) -> String:
	return String(NAMES[lv - 1]) if lv > 0 else ""


static func bonus_of(lv: int) -> int:
	return int(BONUS[lv - 1]) if lv > 0 else 0


## 판에 실을 쌍 단계 표 {key: 단계} — 원수 쌍은 빠진다(셈도 덤도 없음). 꺼지면 {}.
static func board_table(S: Object, mine: Array) -> Dictionary:
	var out := {}
	if not on():
		return out
	for i in mine.size():
		for j in range(i + 1, mine.size()):
			var a := String(mine[i])
			var b := String(mine[j])
			if a != b and rel_kind(a, b) != "foe":
				out[key(a, b)] = level(S, a, b)
	return out


## 판 끝 — 함께 싸운 쌍마다 +1. 오른 단계 [{a, b, lv}]
static func on_end(S: Object, keys: Array) -> Array:
	var up: Array = []
	if not on():
		return up
	for k: Variant in keys:
		var ab := String(k).split("|")
		if ab.size() != 2:
			continue
		var before := level(S, ab[0], ab[1])
		S.support[String(k)] = points(S, ab[0], ab[1]) + 1
		var after := level(S, ab[0], ab[1])
		if after > before:
			up.append({"a": ab[0], "b": ab[1], "lv": after})
	return up


## 판 끝 미리보기 — 이 판 셈으로 오를 쌍 글 배열(세이브는 안 바꾼다)
static func preview(S: Object, keys: Array) -> Array:
	var lines: Array = []
	if not on():
		return lines
	for k: Variant in keys:
		var ab := String(k).split("|")
		if ab.size() != 2:
			continue
		var before := level(S, ab[0], ab[1])
		var after := level_of(points(S, ab[0], ab[1]) + 1, rel_kind(ab[0], ab[1]))
		lines.append("🤝 %s·%s 지원%s" % [_nm(ab[0]), _nm(ab[1]), (" %s↑" % name_of(after)) if after > before else " +1"])
	return lines


static func _nm(id: String) -> String:
	var h = Characters.find(id)
	return String(h.name) if h != null else id


## 무장 줄 꼬리(장수 상세 대신 — 고돗은 무장 고르는 창 줄이 상세다) — 없으면 ""
static func hint(S: Object, id: String) -> String:
	if not on() or id == "":
		return ""
	var seen := {}
	for k: String in (S.support as Dictionary).keys():
		var ab := k.split("|")
		if ab.size() == 2 and (ab[0] == id or ab[1] == id):
			seen[ab[1] if ab[0] == id else ab[0]] = true
	for p: Array in Relation.pairs_of(id):
		if String(p[2]) == "sworn":
			seen[String(p[1]) if String(p[0]) == id else String(p[0])] = true
	var items: Array = []
	var others: Array = seen.keys()
	others.sort()
	for o: String in others:
		var lv := level(S, id, o)
		if lv > 0:
			items.append("%s %s" % [name_of(lv), _nm(o)])
	return "" if items.is_empty() else " 🤝지원 " + "·".join(items)
