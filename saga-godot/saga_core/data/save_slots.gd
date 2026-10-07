extends RefCounted
## G-0070 — 저장 슬롯 셋(SAGA-BACKLOG §4.6). 다섯 판 공용, 정적 함수만.
## 슬롯 1 = 각 판의 원래 세이브 파일 그대로(옛 진행이 사라지지 않게), 2·3 = "<원래 줄기>_slot<n>.json".
## 판마다 고른 슬롯은 user://save_slots.cfg [slots] <판 id>=n 에 남는다. 각 판 save_path() 가 path_for 를 부른다.

const SLOTS := 3

static var cfg_path := "user://save_slots.cfg" # 점검이 임시 경로로 바꾼다
static var _cache := {}   # 판 id → 슬롯(한 번 읽은 뒤)


static func current(game: String) -> int:
	if not _cache.has(game):
		var cf := ConfigFile.new()
		var n := 1
		if cf.load(cfg_path) == OK:
			n = int(cf.get_value("slots", game, 1))
		_cache[game] = clampi(n, 1, SLOTS)
	return int(_cache[game])


static func set_current(game: String, n: int) -> void:
	n = clampi(n, 1, SLOTS)
	_cache[game] = n
	var cf := ConfigFile.new()
	cf.load(cfg_path)   # 다른 판 값은 그대로
	cf.set_value("slots", game, n)
	cf.save(cfg_path)


## 점검용 — 다음 current() 가 파일을 다시 읽게.
static func forget() -> void:
	_cache.clear()


## 그 판의 n 번 슬롯 파일 경로(n 이 0 이면 지금 슬롯). 슬롯 1 은 base 그대로.
static func path_for(game: String, base: String, n: int = 0) -> String:
	if n <= 0:
		n = current(game)
	if n == 1:
		return base
	return "%s_slot%d.%s" % [base.get_basename(), n, base.get_extension()]


## 단추 글 — "슬롯 2 · 비어 있음" / "슬롯 1 · 10-07 14:20".
static func slot_label(game: String, base: String, n: int) -> String:
	var p := path_for(game, base, n)
	var mark := "▶ " if n == current(game) else ""
	if not FileAccess.file_exists(p):
		return "%s슬롯 %d · 비어 있음" % [mark, n]
	var t := Time.get_datetime_dict_from_unix_time(FileAccess.get_modified_time(p) + int(Time.get_time_zone_from_system().get("bias", 0)) * 60)
	return "%s슬롯 %d · %02d-%02d %02d:%02d" % [mark, n, int(t.month), int(t.day), int(t.hour), int(t.minute)]
