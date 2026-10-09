extends RefCounted

## 네 판(DUNGEON·FOREST·STORY·REALM) 세이브 왕복·마이그레이션 점검의 공용 몸통 — probe_save_<판>.gd 가 부른다.
## 진짜 세이브(user://save_*.json)는 건드리지 않는다: 세이브 스크립트를 autoload 가 아닌 새 인스턴스로 만들어
## _migrate() 만 부르고, 파일 왕복은 임시 경로(user://probe_save_tmp.json)로만 한다.
## G-0120 — rt(왕복)를 주면 판 autoload 의 진짜 save()·try_load() 도 본다: path_override(SagaSaveBase)를 임시 경로로 두고
## 필드에 값 A → save() → 값 B 로 흐트림 → try_load() → A 로 돌아왔나. 끝나면 필드·경로를 되돌리고, 진짜 세이브 파일 md5 가 그대로인지 본다.

const SafeFile := preload("res://saga_core/data/safe_file.gd")
const TMP := "user://probe_save_tmp.json"


## rt 몸통 — [[통과, 글], …].
static func _roundtrip(tree: SceneTree, game: String, autoload: String, fields: Dictionary) -> Array:
	var node: Node = tree.root.get_node_or_null(autoload)
	if node == null:
		return [[false, "autoload %s 없음" % autoload]]
	var real_path := String(node.call("save_path"))
	var real_md5 := FileAccess.get_md5(real_path) if FileAccess.file_exists(real_path) else ""
	var player := Node3D.new()   # 사가나락 save(player)·사가마을/종횡 _find_player() 용
	player.add_to_group("player")
	tree.root.add_child(player)
	player.global_position = Vector3(3.0, 0.0, -2.0)
	var orig := {}
	for f in fields:
		orig[f] = _copy(node.get(f))
	node.set("path_override", TMP)
	_rm()
	for f in fields:
		_put(node, f, fields[f][0])
	var saved: Variant = node.call("save", player) if game == "dungeon" else node.call("save")
	var wrote := SafeFile.exists(TMP)
	for f in fields:
		_put(node, f, fields[f][1])
	var loaded: bool = node.call("try_load")
	var bad: Array = []
	for f in fields:
		if _norm(node.get(f)) != _norm(fields[f][0]):
			bad.append("%s=%s" % [f, _norm(node.get(f))])
	_rm()
	node.set("path_override", "")
	for f in orig:
		_put(node, f, orig[f])
	player.free()
	var real_same := (FileAccess.get_md5(real_path) if FileAccess.file_exists(real_path) else "") == real_md5
	return [
		[wrote and (saved == null or bool(saved)), "진짜 save() 가 임시 경로에 씀"],
		[loaded and bad.is_empty(), "진짜 try_load() 로 필드 %d개 되돌아옴 %s" % [fields.size(), bad]],
		[real_same and String(node.call("save_path")) == real_path, "진짜 세이브 파일·경로 그대로"],
	]


static func _copy(v: Variant) -> Variant:
	return (v as Array).duplicate(true) if v is Array else ((v as Dictionary).duplicate(true) if v is Dictionary else v)


## 타입 있는 배열(Array[bool] 등)은 assign 으로, 사전은 복사로.
static func _put(node: Node, f: String, v: Variant) -> void:
	var cur: Variant = node.get(f)
	if cur is Array and v is Array:
		(cur as Array).assign((v as Array).duplicate(true))
	else:
		node.set(f, _copy(v))


## JSON 을 한 번 거친 모양으로(정수·실수 차이 없앰).
static func _norm(v: Variant) -> String:
	return JSON.stringify(JSON.parse_string(JSON.stringify(v)))


static func _rm() -> void:
	for suffix in ["", ".bak", ".tmp"]:
		if FileAccess.file_exists(TMP + suffix):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP + suffix))


## v1_extra: 버전 1 사전에 더 넣을 옛 필드. v1_check: 마이그레이션 뒤 사전을 받아 그 판 고유 변환을 확인(없으면 생략).
static func run(game: String, script_path: String, v1_extra: Dictionary, v1_check: Callable, rt: Dictionary = {}) -> int:
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

	if not rt.is_empty():
		checks.append_array(_roundtrip(rt.tree, game, String(rt.autoload), rt.fields))

	for c in checks:
		if not c[0]:
			fails += 1
		print("  ", "ok  " if c[0] else "FAIL", c[1])
	inst.free()
	print("PROBE save_%s " % game, "OK" if fails == 0 else "FAIL %d" % fails)
	return fails
