extends RefCounted

## G-0402 5천하 장수 보물·보물 세트(디아블로 세트 결을 「한 세력이 나눠 지니는 보물」로 — 구조만) — 웹 saga-web/saga-realm/js/data-item.js
## ITEMS 11 · treasure-set.js(W-0440) 짝, 수치 그대로. 고돗 5천하엔 보물 체계가 없었다(realm_state 머리말 — 이번에 처음).
##   지님   장수는 보물 하나만(S.officer_item {장수 id: 보물 id}, 저장 키 덧붙임). 능력치 +bonus(그 축 flat)
##   얻음   보스급 수비 무장이 있던 성을 함락하면(war.js capture 보스전 — 옛 고돗은 금만) 데려간 장수에게 보물 하나.
##          고르는 건 성·장수 해시(난수 순서를 안 건드림 — 다른 굴림·골든 그대로). 이미 지닌 장수면 바꿔 쥠.
##   등급   보너스 크기 → +6 기본 · +8 상급 · +9 희귀 · +10 영웅 · +12↑ 전설(웹 gradeOf)
##   세트   같은 세력(우리 로스터) 장수들이 한 세트의 조각을 나눠 지니면 그 보물을 지닌 장수 모두 그 축 +5%(둘)·+10%(셋, 큰 쪽)
##          · 둘 이상이면 세트 전법 — 전술판 유닛에 돌격진 공격 +3 · 원거리 계책 사거리 +1(최대 3) · 진군 이동 +1
## 표는 K 생성기(W-0435: 보물 60·세트 10)가 오면 줄만 늘린다. SAGA_TREASURE=0 이면 얻지 않고 효과도 끔.

const ITEMS := [
	{"id": "itm_ironblade", "name": "무쇠검", "emoji": "🗡️", "stat": "might", "bonus": 6, "desc": "날이 벼려진 채로 전해 내려온 검."},
	{"id": "itm_warhorse", "name": "준마", "emoji": "🐎", "stat": "might", "bonus": 10, "desc": "하루에 천 리를 달린다는 말."},
	{"id": "itm_armor", "name": "보갑", "emoji": "🛡️", "stat": "might", "bonus": 8, "desc": "화살도 뚫지 못하는 갑옷."},
	{"id": "itm_scroll", "name": "병서", "emoji": "📜", "stat": "wisdom", "bonus": 6, "desc": "옛 병가의 계책이 적힌 두루마리."},
	{"id": "itm_compass", "name": "나침반", "emoji": "🧭", "stat": "wisdom", "bonus": 10, "desc": "산길에서도 방향을 잃지 않게 해 준다."},
	{"id": "itm_jade", "name": "옥패", "emoji": "💎", "stat": "wisdom", "bonus": 8, "desc": "몸에 지니면 마음이 가라앉는다는 옥."},
	{"id": "itm_seal", "name": "인수", "emoji": "🔶", "stat": "command", "bonus": 6, "desc": "위엄을 세우는 관인."},
	{"id": "itm_drum", "name": "전고", "emoji": "🥁", "stat": "command", "bonus": 10, "desc": "북소리 하나로 군세를 다잡는다."},
	{"id": "itm_timeshard", "name": "시간의 파편", "emoji": "⏳", "stat": "wisdom", "bonus": 9, "desc": "균열에서 흘러나온 조각. 지니면 앞일이 어렴풋이 보인다."},
	{"id": "itm_purifier", "name": "정화 장치", "emoji": "🧪", "stat": "might", "bonus": 9, "desc": "오염을 씻어내는 장치. 몸에 지니면 숨쉬기가 한결 낫다."},
	{"id": "itm_boneseal", "name": "해골의 인장", "emoji": "💀", "stat": "command", "bonus": 9, "desc": "주인 없는 인장. 지니면 죽은 자도 따른다는 말이 있다."},
]
const PCT2 := 0.05
const PCT3 := 0.1
const SETS := [
	{"key": "set_mujang", "name": "무장의 채비", "stat": "might", "tactic": {"name": "돌격진", "atk": 3}, "pieces": ["itm_ironblade", "itm_warhorse", "itm_armor"]},
	{"key": "set_gunsa", "name": "군사의 채비", "stat": "wisdom", "tactic": {"name": "원거리 계책", "rng": 1}, "pieces": ["itm_scroll", "itm_compass", "itm_jade"]},
	{"key": "set_gunju", "name": "군주의 채비", "stat": "command", "tactic": {"name": "진군", "mov": 1}, "pieces": ["itm_seal", "itm_drum", "itm_boneseal"]},
]
const GRADE_NAMES := ["", "기본", "상급", "희귀", "영웅", "전설"]


static func on() -> bool:
	return OS.get_environment("SAGA_TREASURE") != "0"


static func item(id: String) -> Dictionary:
	for it: Dictionary in ITEMS:
		if String(it.id) == id:
			return it
	return {}


static func grade_of(it: Dictionary) -> int:
	var b := int(it.get("bonus", 0))
	return 5 if b >= 12 else (4 if b >= 10 else (3 if b >= 9 else (2 if b >= 8 else 1)))


static func set_of(item_id: String) -> Dictionary:
	for s: Dictionary in SETS:
		if (s.pieces as Array).has(item_id):
			return s
	return {}


## 우리 로스터에서 세트 s 의 조각 종류 수(같은 보물 둘은 하나로)
static func count_in(S: Object, s: Dictionary) -> int:
	var got := {}
	for oid: Variant in S.roster:
		var iid := String((S.officer_item as Dictionary).get(String(oid), ""))
		if iid != "" and (s.pieces as Array).has(iid):
			got[iid] = true
	return got.size()


## 그 장수 그 축의 보물 덤 {flat, pct} — 보물·세트 없으면 0
static func bonus(S: Object, id: String, stat: String) -> Dictionary:
	var out := {"flat": 0.0, "pct": 0.0}
	if not on():
		return out
	var iid := String((S.officer_item as Dictionary).get(id, ""))
	var it := item(iid)
	if it.is_empty():
		return out
	if String(it.stat) == stat:
		out.flat = float(it.bonus)
	var s := set_of(iid)
	if not s.is_empty() and String(s.stat) == stat and (S.roster as Array).has(id):
		var n := count_in(S, s)
		out.pct = PCT3 if n >= 3 else (PCT2 if n >= 2 else 0.0)
	return out


## 세트 전법 — 전술판 장수 유닛 u 에 덧붙임(그 장수 세트가 둘 이상 모였을 때만). 붙은 이름 u.tactic
static func tactic(S: Object, u: Dictionary) -> Dictionary:
	if not on() or String(u.get("kind", "")) != "officer" or String(u.get("side", "")) != "me":
		return u
	var id := String(u.get("id", ""))
	var s := set_of(String((S.officer_item as Dictionary).get(id, "")))
	if s.is_empty() or count_in(S, s) < 2:
		return u
	var t: Dictionary = s.tactic
	if t.has("atk"):
		u.atk = float(u.atk) + float(t.atk)
	if t.has("rng"):
		u.rng = mini(3, int(u.rng) + int(t.rng))
	if t.has("mov"):
		u.mov = int(u.mov) + int(t.mov)
	u["tactic"] = String(t.name)
	return u


## 보스전 승리 — 데려간 장수에게 보물 하나(해시로 골라 난수 순서를 안 건드림). 준 보물 또는 {}
static func give(S: Object, officer_id: String, city_id: String) -> Dictionary:
	if not on() or officer_id == "":
		return {}
	var h := 0
	for ch in (city_id + "|" + officer_id).to_utf8_buffer():
		h = (h * 31 + int(ch)) & 0x7fffffff
	var it: Dictionary = ITEMS[h % ITEMS.size()]
	S.officer_item[officer_id] = String(it.id)
	return it


## 무장 줄 꼬리 — 지닌 보물(등급)·세트 이름
static func hint(S: Object, id: String) -> String:
	if not on():
		return ""
	var it := item(String((S.officer_item as Dictionary).get(id, "")))
	if it.is_empty():
		return ""
	var s := set_of(String(it.id))
	return " %s%s(%s +%d)%s" % [String(it.emoji), String(it.name), String(GRADE_NAMES[grade_of(it)]), int(it.bonus), (" 🧩" + String(s.name)) if not s.is_empty() else ""]
