extends Node
## GO 자동 저장(world/autosave.gd · saga_core/data/safe_file.gd · save_state.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_AUTOSAVE_PROBE 가 있을 때만 단다. 진짜 세이브(user://save.json)는 건드리지 않고 임시 파일로 돈다.
##
##   SAGA_AUTOSAVE_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 헤드리스·점검 중엔 스스로 꺼져 있다(진짜 세이브 보호) ② 켜면: 변화 없으면 안 저장 · 변화가 있어도 MIN_GAP 전엔 안 저장 · 뒤엔 저장
## ③ 안전하지 않을 때(얼림·지도 밖·비경 중)는 안 저장 ④ 떠날 때(앱 멈춤) 변화가 있으면 바로 저장 ⑤ 저장이 파일에 실제로 담김(경험·회차)
## ⑥ 두 번째 저장부터 .bak 이 직전본 · .tmp 가 안 남음 ⑦ 원본이 깨져도 .bak 으로 읽힘 ⑧ 세이브 서명이 상태 변화를 잡는다.
## 임시 파일·경험·회차는 끝에 되돌린다.

const SafeFile := preload("res://saga_core/data/safe_file.gd")

const TMP_PATH := "user://autosave_probe.json"

var _p: Node3D
var _a: Node
var _fails := 0
var _saved := {}


func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")
	_run.call_deferred()


func _frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("AUTOSAVE_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _rm() -> void:
	for suffix in ["", ".bak", ".tmp"]:
		var g := ProjectSettings.globalize_path(TMP_PATH + suffix)
		if FileAccess.file_exists(TMP_PATH + suffix):
			DirAccess.remove_absolute(g)


func _run() -> void:
	await _frames(4)
	_a = get_tree().get_first_node_in_group("go_autosave")
	_saved = {"exp": PartyState.exp, "cycle": PartyState.cycle, "pos": _p.global_position, "override": SaveState.path_override}
	_rm()
	SaveState.path_override = TMP_PATH

	# ① 스스로 꺼짐
	var off := not bool(_a.call("enabled"))
	_a.set("force_enable", true)
	var on := bool(_a.call("enabled"))
	_check("guard", off and on and _a != null, "off=%s on=%s" % [off, on])

	# ② 변화·간격
	_a.set("_sig", _a.call("signature"))
	_a.set("_since", 100.0)
	var no_change := bool(_a.call("poll"))
	PartyState.exp += 50.0
	_a.set("_since", 5.0)
	var too_soon := bool(_a.call("poll"))
	_a.set("_since", 25.0)
	var saved1 := bool(_a.call("poll"))
	var again := bool(_a.call("poll"))
	_check("gap", not no_change and not too_soon and saved1 and not again and int(_a.get("saves")) == 1 and FileAccess.file_exists(TMP_PATH),
		"nochange=%s soon=%s saved=%s again=%s saves=%d" % [no_change, too_soon, saved1, again, int(_a.get("saves"))])

	# ③ 안전
	PartyState.exp += 50.0
	_a.set("_since", 25.0)
	_p.set("frozen", true)
	var frozen_save := bool(_a.call("try_save", "x"))
	_p.set("frozen", false)
	_p.global_position = Vector3(-1400, 40, 0)
	var arena_save := bool(_a.call("try_save", "x"))
	_p.global_position = _saved.pos
	await _frames(2)
	var group_node := Node.new()
	group_node.add_to_group("go_domain_active")
	add_child(group_node)
	var domain_save := bool(_a.call("try_save", "x"))
	group_node.queue_free()
	await _frames(2)
	_check("unsafe", not frozen_save and not arena_save and not domain_save, "frozen=%s arena=%s domain=%s" % [frozen_save, arena_save, domain_save])

	# ④ 떠날 때
	var saves0 := int(_a.get("saves"))
	_a.call("_notification", NOTIFICATION_APPLICATION_PAUSED)
	var leave_saved := int(_a.get("saves")) == saves0 + 1 and String(_a.get("last_reason")) == "떠남"
	var saves1 := int(_a.get("saves"))
	_a.call("_notification", NOTIFICATION_APPLICATION_PAUSED)
	var leave_again := int(_a.get("saves")) != saves1
	_check("leave", leave_saved and not leave_again, "saved=%s again=%s" % [leave_saved, leave_again])

	# ⑤ 파일 내용
	PartyState.cycle = 3
	PartyState.exp += 10.0
	_a.call("try_save", "test")
	var data: Variant = SafeFile.read_json(TMP_PATH)
	_check("content", data != null and absf(float(data.party_exp) - PartyState.exp) < 0.01 and int(data.cycle) == 3 and data.has("eggs") and data.has("home"),
		"exp=%s cycle=%s" % [data.get("party_exp") if data != null else null, data.get("cycle") if data != null else null])

	# ⑥ .bak · .tmp
	var bak_ok := FileAccess.file_exists(TMP_PATH + ".bak") and not FileAccess.file_exists(TMP_PATH + ".tmp")
	var bak: Variant = JSON.parse_string(FileAccess.open(TMP_PATH + ".bak", FileAccess.READ).get_as_text())
	var newer := bak != null and float(bak.party_exp) < float(SafeFile.read_json(TMP_PATH).party_exp)
	_check("backup", bak_ok and newer, "bak=%s newer=%s" % [bak_ok, newer])

	# ⑦ 원본이 깨져도 읽힘
	var f := FileAccess.open(TMP_PATH, FileAccess.WRITE)
	f.store_string("{깨진 파일")
	f.close()
	var fallback: Variant = SafeFile.read_json(TMP_PATH)
	_check("corrupt_fallback", fallback != null and fallback.has("party_exp") and SafeFile.exists(TMP_PATH), "fallback=%s" % [fallback != null])

	# ⑧ 서명
	var s0 := String(_a.call("signature"))
	PartyState.add_items({"mora": 7})
	var s1 := String(_a.call("signature"))
	CodexState.discover("beast", "probe_fake_beast") if false else null
	_check("signature", s0 != s1, "changed=%s" % [s0 != s1])

	_rm()
	SaveState.path_override = _saved.override
	PartyState.exp = _saved.exp
	PartyState.cycle = _saved.cycle
	_p.global_position = _saved.pos
	print("AUTOSAVE_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
