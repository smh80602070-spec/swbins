extends Node
## GO 역사 인물 조우(data/persuade_rules.gd 3라운드 설득 · world/hero_encounter.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_HEROES_PROBE 가 있을 때만 단다. 진짜 세이브는 안 건드린다(임시 경로, 파티 상태는 메모리만 바뀜).
##
##   SAGA_HEROES_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 설득 규칙(순수): 기질에 맞는 어필 셋이면 3라운드에 반드시 성공(34×3>100) · 하나도 안 맞으면 반드시 실패 · 끝난 뒤 어필은 무시 ·
## 한 번의 획득량은 맞으면 34~48, 아니면 8~18 ② 씬에 조우 노드 3개 넘게 · 인물 id 가 도감에 있고 기질이 무/지/덕 중 하나 · 이름 겹침 0
## ③ 성공 흐름: 세 번 맞춰 어필 → 동행 등록·사건 표시·노드 사라짐 ④ 실패 흐름: 세 번 틀려 어필 → 동행 안 늘고·사건 표시·노드 사라짐.
## 끝에 HEROES_PROBE_DONE fails=N.

const Characters := preload("res://saga_core/data/characters.gd")
const TMP := "user://heroes_probe.json"
const TRAITS := ["might", "wisdom", "virtue"]
const TRIALS := 300

var _scene: Node
var _fails := 0


func _ready() -> void:
	Weather.force("clear")
	_scene = get_tree().current_scene
	_run.call_deferred()


func _frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("HEROES_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _rm() -> void:
	for suffix in ["", ".bak", ".tmp"]:
		if FileAccess.file_exists(TMP + suffix):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP + suffix))


func _heroes() -> Array:
	var out := []
	for c in _scene.get_children():
		var s: Script = c.get_script()
		if s != null and s.resource_path.ends_with("/hero_encounter.gd") and not c.is_queued_for_deletion():
			out.append(c)
	return out


func _rules() -> void:
	seed(20260824)
	var ok_hit := true
	var ok_miss := true
	var ok_round := true
	var in_range := true
	var ignored := true
	for i in TRIALS:
		var tr: String = TRAITS[i % 3]
		var wrong: String = TRAITS[(i + 1) % 3]
		var s := PersuadeRules.create(tr)
		var last := {}
		for r in 3:
			last = s.appeal(tr)
			in_range = in_range and float(last.gained) >= PersuadeRules.HIT_MIN and float(last.gained) <= PersuadeRules.HIT_MIN + PersuadeRules.HIT_RANGE
			if bool(last.done):
				break
		ok_hit = ok_hit and bool(last.succeeded)
		ok_round = ok_round and int(last.round) == 3  # 한 번에 최대 48 — 셋은 있어야 100 을 넘는다
		ignored = ignored and not bool(s.appeal(tr).get("ok", true))
		var m := PersuadeRules.create(tr)
		for r in 3:
			last = m.appeal(wrong)
			in_range = in_range and float(last.gained) >= PersuadeRules.MISS_MIN and float(last.gained) <= PersuadeRules.MISS_MIN + PersuadeRules.MISS_RANGE
		ok_miss = ok_miss and bool(last.done) and not bool(last.succeeded)
	_check("rules_hit", ok_hit and ok_round, "맞는 어필 셋 → 3라운드 성공 %d회" % TRIALS)
	_check("rules_miss", ok_miss, "안 맞는 어필 셋 → 실패 %d회" % TRIALS)
	_check("rules_range", in_range and ignored, "획득량 범위 · 끝난 뒤 어필 무시")


func _run() -> void:
	await _frames(4)
	var saved_override: String = SaveState.path_override
	_rm()
	SaveState.path_override = TMP
	_rules()

	var nodes := _heroes()
	var names := {}
	var bad := 0
	for n in nodes:
		names[n.name] = true
		var h: Variant = Characters.find(String(n.hero_id))
		if h == null or not TRAITS.has(String((h as Dictionary).get("trait", ""))):
			bad += 1
	_check("scene_heroes", nodes.size() >= 3 and names.size() == nodes.size() and bad == 0 and get_tree().get_nodes_in_group("go_heroes").size() >= nodes.size(), "%d개 (이상한 인물 %d)" % [nodes.size(), bad])

	PartyState.members.clear()
	if nodes.size() >= 2:
		# ③ 성공 흐름
		var a: Node = nodes[0]
		var a_id := String(a.hero_id)
		var a_name: String = String(a.name)
		var tr := String(a._hero["trait"])
		a._persuade = PersuadeRules.create(tr)
		for r in 3:
			if is_instance_valid(a) and not a.is_queued_for_deletion():
				a._do_appeal(tr)
		await _frames(2)
		_check("success_flow", PartyState.members.has(a_id) and PartyState.members.count(a_id) == 1 and EventState.is_resolved(a_name) and (not is_instance_valid(a) or a.is_queued_for_deletion()), "동행 %s · 사건 %s" % [str(PartyState.members.has(a_id)), a_name])

		# ④ 실패 흐름
		var b: Node = nodes[1]
		var b_id := String(b.hero_id)
		var b_name: String = String(b.name)
		var tb := String(b._hero["trait"])
		var wrong: String = TRAITS[(TRAITS.find(tb) + 1) % 3]
		var before := PartyState.members.size()
		b._persuade = PersuadeRules.create(tb)
		for r in 3:
			if is_instance_valid(b) and not b.is_queued_for_deletion():
				b._do_appeal(wrong)
		await _frames(2)
		_check("fail_flow", PartyState.members.size() == before and not PartyState.members.has(b_id) and EventState.is_resolved(b_name) and (not is_instance_valid(b) or b.is_queued_for_deletion()), "동행 그대로 · 사건 %s" % b_name)

	_rm()
	SaveState.path_override = saved_override
	print("HEROES_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
