extends Node

## G-0388 3마을 주민 생일(스타듀 밸리·동물의숲 · 웹 W-0427 짝).
##   생일 = 주민 id md5 → 1~12월 × 1~28일(고돗 3마을은 실제 날짜 ForestDay yyyymmdd — 웹의 28일 달력 대신 실제 달 1~28일),
##   겹치면 다음 날(VILLAGERS 순서대로 — 결정적). 세이브 안 씀(매번 id 로 셈).
##   생일에 선물하면 친밀도 × GIFT_MUL(좋아하는 것 +3 → +9, 아니면 +1 → +3) · 그날 하루 상한(4)을 CAP_BONUS 만큼 올려 실제로 크게 오른다.
##   그날 마을에 들면 「오늘은 <이름> 생일 🎂」 한 번(메모리 — 다시 켜면 또) · 「오늘」 창 줄 · 주민 메뉴 제목에 🎂 날짜.
##   SAGA_BIRTHDAY=0 이면 다 끔(배수 1·상한 그대로·알림 없음).
## ForestSaveState(자동 로드)가 부르므로 villager_builder 는 미리 싣지 않고 쓸 때 load() 한다(자동 로드 컴파일 순환 피하기).

const GIFT_MUL := 3
const CAP_BONUS := 5
const DAYS := 28

static var _table: Dictionary = {}
static var _toasted_day := -1


static func on() -> bool:
	return OS.get_environment("SAGA_BIRTHDAY") != "0"


static func _villagers() -> Array:
	return (load("res://games/saga_forest/world/villager_builder.gd") as GDScript).get("VILLAGERS")


## 주민 id → Vector2i(월, 일).
static func table() -> Dictionary:
	if not _table.is_empty():
		return _table
	var taken := {}
	var out := {}
	for v: Dictionary in _villagers():
		var id := String(v.id)
		var h := id.md5_text()
		var idx := (h.substr(0, 6).hex_to_int() % 12) * DAYS + h.substr(6, 6).hex_to_int() % DAYS
		while taken.has(idx):
			idx = (idx + 1) % (12 * DAYS)
		taken[idx] = true
		out[id] = Vector2i(idx / DAYS + 1, idx % DAYS + 1)
	_table = out
	return out


static func birthday_of(id: String) -> Vector2i:
	return table().get(id, Vector2i.ZERO)


static func is_today(id: String, day_key: int) -> bool:
	var b := birthday_of(id)
	return b != Vector2i.ZERO and b.x == (day_key / 100) % 100 and b.y == day_key % 100


static func gift_mul(id: String, day_key: int) -> int:
	return GIFT_MUL if on() and is_today(id, day_key) else 1


static func cap_bonus(id: String, day_key: int) -> int:
	return CAP_BONUS if on() and is_today(id, day_key) else 0


static func today_ids(day_key: int) -> Array:
	var out: Array = []
	if not on():
		return out
	for id: String in table():
		if is_today(id, day_key):
			out.append(id)
	return out


static func name_of(id: String) -> String:
	for v: Dictionary in _villagers():
		if String(v.id) == id:
			return String(v.name)
	return id


static func label(id: String) -> String:
	var b := birthday_of(id)
	return "🎂 %d월 %d일" % [b.x, b.y] if b != Vector2i.ZERO else ""


## 마을에 붙어 그날 생일이면 한 번 알린다.
static func attach(parent: Node) -> Node:
	if not on():
		return null
	var n: Node = (load("res://games/saga_forest/data/forest_birthday.gd") as GDScript).new()
	n.name = "ForestBirthday"
	parent.add_child(n)
	return n


func _ready() -> void:
	var day := ForestDay.today_key()
	if _toasted_day == day:
		return
	var ids := today_ids(day)
	if ids.is_empty():
		return
	_toasted_day = day
	var names: PackedStringArray = []
	for id: String in ids:
		names.append(name_of(id))
	preload("res://saga_core/ui/toast.gd").show(get_parent(), "오늘은 %s 생일 🎂 — 선물하면 아주 기뻐한다" % ", ".join(names), 4.0)
