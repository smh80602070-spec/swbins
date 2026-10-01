extends SceneTree

## 사가스토리 무예 "골든" 점검 — story_player.gd 를 상속 층으로 쪼갤 때(G-0007) 동작이 한 글자도 안 바뀌었는지 본다.
##   godot --headless --path saga-godot --script res://tools/probe_story_golden.gd
## 플레이어를 매번 새로 띄워(스킬 전부 3렙·MP 가득·쿨다운 0) `_cast_*` 를 하나씩 직접 부르고, 부른 뒤 스크립트 var 값·
## 새로 생긴 노드(종류·스크립트)·더미 적 체력을 모아 한 줄 md5 로 낸다. 끝에 "PROBE story_golden OK md5=…".
## 기대값(GOLDEN)이 비어 있으면 값만 찍고 OK, 채워져 있으면 다르면 FAIL. 진짜 세이브는 안 건드린다(스킬 표만 임시로 갈아 끼우고 되돌림).

const GOLDEN := "de2c70a2fdff13a05deef5e3cbcd2f6a"  # 분리 전 HEAD(2026-10-01)에서 잰 값
const PLAYER_DIR := "res://games/saga_story/player/"
const SEED := 20260824

var _dummy_script: GDScript
var _log := ""


func _skill_keys() -> Dictionary:
	var keys := {}
	var rx := RegEx.create_from_string("skill_level\\(\"([a-z_0-9]+)\"\\)")
	var d := DirAccess.open(PLAYER_DIR)
	for f in d.get_files():
		if not f.ends_with(".gd"):
			continue
		for m in rx.search_all(FileAccess.get_file_as_string(PLAYER_DIR + f)):
			keys[m.get_string(1)] = 3
	return keys


func _snapshot(p: Node) -> Dictionary:
	var out := {}
	for prop in p.get_property_list():
		if (int(prop.usage) & PROPERTY_USAGE_SCRIPT_VARIABLE) == 0:
			continue
		var v: Variant = p.get(prop.name)
		match typeof(v):
			TYPE_INT, TYPE_FLOAT, TYPE_BOOL, TYPE_STRING, TYPE_STRING_NAME, TYPE_VECTOR2, TYPE_VECTOR3, TYPE_ARRAY, TYPE_DICTIONARY:
				out[prop.name] = str(v)
	return out


func _describe(n: Node) -> String:
	var s: Script = n.get_script()
	return "%s|%s|%s" % [n.get_class(), s.resource_path if s != null else "", str(n.get("position"))]


func _initialize() -> void:
	await process_frame
	var save: Node = root.get_node("StorySaveState")
	var saved_skills: Dictionary = save.skills.duplicate()
	save.skills = _skill_keys()
	_dummy_script = GDScript.new()
	_dummy_script.source_code = "extends Node3D\nvar hp := 0.0\nfunc take_damage(a: float) -> void:\n\thp += a\n"
	_dummy_script.reload()
	var packed: PackedScene = load("res://games/saga_story/player/StoryPlayer.tscn")

	# 이름은 스크립트에서 모은다 — 분리 전후 같은 목록이어야 한다.
	var probe_p: Node = packed.instantiate()
	var names: Array = []
	for m in probe_p.get_method_list():
		if String(m.name).begins_with("_cast_"):
			names.append(String(m.name))
	probe_p.free()
	names.sort()

	var effects := 0
	for n in names:
		seed(SEED)
		var stage := Node3D.new()
		root.add_child(stage)
		var p: Node = packed.instantiate()
		stage.add_child(p)
		var dummies: Array = []
		for dx in [0.6, 2.0, 5.0, -1.5]:
			var e: Node3D = Node3D.new()
			e.set_script(_dummy_script)
			e.add_to_group("story_enemy")
			stage.add_child(e)
			e.global_position = Vector3(dx, 0.0, 0.0)
			dummies.append(e)
		await process_frame
		p.set_physics_process(false)
		p.set_process(false)
		p.mp = 999.0
		for prop in p.get_property_list():
			if String(prop.name).begins_with("_cd_"):
				p.set(prop.name, 0.0)
		var before_children := stage.get_child_count()
		p.call(n)
		var hp_sum := 0.0
		var hps := []
		for e in dummies:
			hps.append(e.hp)
			hp_sum += e.hp
		var added := []
		for c in stage.get_children():
			if c != p and not (c in dummies):
				added.append(_describe(c))
		for c in p.get_children():
			if c.name != "CollisionShape3D" and c.name != "Visual":
				added.append("p/" + _describe(c))
		if hp_sum > 0.0 or added.size() > 0:
			effects += 1
		_log += "%s|%s|%s|%s;" % [n, JSON.stringify(_snapshot(p), "", true), str(hps), str(added)]
		stage.queue_free()
		await process_frame
	save.skills = saved_skills

	var md5 := _log.md5_text()
	print("  cast %d개 · 효과(적 피해·새 노드)가 있었던 것 %d개 · log %dB" % [names.size(), effects, _log.length()])
	var fails := 0
	if GOLDEN != "" and md5 != GOLDEN:
		fails += 1
	print("PROBE story_golden ", "OK" if fails == 0 else "FAIL %d" % fails, " md5=", md5)
	quit(1 if fails > 0 else 0)
