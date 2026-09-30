extends RefCounted

## 네 판(DUNGEON·FOREST·STORY·REALM) 세이브 왕복·마이그레이션 점검의 공용 몸통 — probe_save_<판>.gd 가 부른다.
## 진짜 세이브(user://save_*.json)는 건드리지 않는다: 세이브 스크립트를 autoload 가 아닌 새 인스턴스로 만들어
## _migrate() 만 부르고, 파일 왕복은 임시 경로(user://probe_save_tmp.json)로만 한다.
## (저장 사전은 각 save() 안에서 인라인으로 만들어져 밖에서 부를 수 없고, try_load() 는 SAVE_PATH 고정이라 그 둘은 안 본다.)

const SafeFile := preload("res://saga_core/data/safe_file.gd")
const TMP := "user://probe_save_tmp.json"


static func _rm() -> void:
	for suffix in ["", ".bak", ".tmp"]:
		if FileAccess.file_exists(TMP + suffix):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP + suffix))


## v1_extra: 버전 1 사전에 더 넣을 옛 필드. v1_check: 마이그레이션 뒤 사전을 받아 그 판 고유 변환을 확인(없으면 생략).
static func run(game: String, script_path: String, v1_extra: Dictionary, v1_check: Callable) -> int:
	var fails := 0
	var script: GDScript = load(script_path)
	var inst: Node = script.new()
	var sv := int(script.get_script_constant_map().get("SAVE_VERSION", 0))

	var checks: Array = []
	checks.append([sv >= 1, "SAVE_VERSION 이 양의 정수 (%d)" % sv])

	# ② 임시 경로 왕복 + 뒤처리
	_rm()
	var out := {"version": sv, "probe": "왕복", "nested": {"a": [1, 2, 3]}}
	var wrote := SafeFile.write_text(TMP, JSON.stringify(out))
	var back: Variant = SafeFile.read_json(TMP)
	var rt_ok: bool = wrote and back is Dictionary and int(back.get("version", -1)) == sv and back.get("probe") == "왕복"
	_rm()
	checks.append([rt_ok and not SafeFile.exists(TMP), "임시 경로 쓰기→읽기 version=%d · 뒤처리 후 파일 없음" % sv])

	# ③ 버전 1 → 현재
	var v1 := {"version": 1}
	v1.merge(v1_extra)
	var m: Variant = inst.call("_migrate", v1)
	var m_ok: bool = m is Dictionary and int(m.get("version", -1)) == sv
	if m_ok and v1_check.is_valid():
		m_ok = bool(v1_check.call(m))
	checks.append([m_ok, "version 1 → _migrate → version %d%s" % [sv, " + 고유 필드 변환" if v1_check.is_valid() else ""]])

	# ④ 이 빌드보다 높은 version 은 거부
	checks.append([inst.call("_migrate", {"version": sv + 1}) == null, "version %d(미래) 는 거부(null)" % (sv + 1)])

	# ⑤ version 없음(0)·깨진 값은 거부
	checks.append([inst.call("_migrate", {}) == null and inst.call("_migrate", {"version": "x"}) == null, "version 없음/깨짐은 거부(null)"])

	for c in checks:
		if not c[0]:
			fails += 1
		print("  ", "ok  " if c[0] else "FAIL", c[1])
	inst.free()
	print("PROBE save_%s " % game, "OK" if fails == 0 else "FAIL %d" % fails)
	return fails
