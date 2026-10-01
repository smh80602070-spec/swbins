extends Node
## GO 도감(data/codex_state.gd · saga_core/data/pets.gd · 씬의 발견 자리·신수 조우) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_CODEX_PROBE 가 있을 때만 단다. 진짜 세이브(user://save.json)는 안 건드리고 임시 파일로 돈다.
##
##   SAGA_CODEX_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① discover 규칙: 처음만 true·경험치 보상 한 번(표 값 이상 — 세계 등급 배율이 붙을 수 있다) · 모르는 갈래는 false · count/total ② 표: TOTAL 과 REWARD 의 갈래가 같고
## 보상이 양수 · 신수 표(PETS) 11 = TOTAL.pet · id 겹침 0 ③ 씬: 신수 조우 노드가 PETS 11종을 하나씩 다 가짐 ·
## 발견 자리(codex_discoverable)의 이름이 안 겹침 ④ 저장→불러오기 왕복에서 도감이 남는다. 끝에 CODEX_PROBE_DONE fails=N. 상태는 끝에 되돌린다.

const Pets := preload("res://saga_core/data/pets.gd")
const TMP := "user://codex_probe.json"

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
	print("CODEX_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _rm() -> void:
	for suffix in ["", ".bak", ".tmp"]:
		if FileAccess.file_exists(TMP + suffix):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP + suffix))


func _run() -> void:
	await _frames(4)
	var saved_book: Dictionary = CodexState.book.duplicate()
	var saved_exp: float = PartyState.exp
	var saved_override: String = SaveState.path_override
	_rm()
	SaveState.path_override = TMP
	CodexState.restore({})

	# ① discover 규칙
	var exp0: float = PartyState.exp
	var first := CodexState.discover("place", "probe_x")
	var exp1: float = PartyState.exp
	var again := CodexState.discover("place", "probe_x")
	var exp2: float = PartyState.exp
	_check("discover_once", first and not again and CodexState.has("place", "probe_x") and CodexState.count() == 1, "first=%s again=%s" % [first, again])
	_check("reward_once", (exp1 - exp0) >= float(CodexState.REWARD["place"]) - 0.01 and exp2 == exp1, "경험 +%.1f, 두 번째 +%.1f" % [exp1 - exp0, exp2 - exp1])
	var unknown := CodexState.discover("nope", "x")
	_check("unknown_kind", not unknown and CodexState.count() == 1, "")
	var sum := 0
	for v in CodexState.TOTAL.values():
		sum += int(v)
	_check("total_sum", CodexState.total() == sum and sum > 0, "총 %d" % sum)

	# ② 표
	var same_kinds := CodexState.TOTAL.size() == CodexState.REWARD.size()
	for k in CodexState.TOTAL:
		same_kinds = same_kinds and CodexState.REWARD.has(k) and float(CodexState.REWARD[k]) > 0.0
	_check("kinds_match_reward", same_kinds, str(CodexState.TOTAL.keys()))
	var ids := {}
	for p in Pets.PETS:
		ids[p.id] = true
	_check("pets_table", Pets.PETS.size() == int(CodexState.TOTAL["pet"]) and ids.size() == Pets.PETS.size(), "신수 %d · TOTAL.pet %d" % [Pets.PETS.size(), int(CodexState.TOTAL["pet"])])

	# ③ 씬
	var placed := {}
	for c in _scene.get_children():
		var s: Script = c.get_script()
		if s != null and s.resource_path.ends_with("/pet_encounter.gd"):
			placed[String(c.pet_id)] = int(placed.get(String(c.pet_id), 0)) + 1
	var all_once := placed.size() == Pets.PETS.size()
	for p in Pets.PETS:
		all_once = all_once and int(placed.get(p.id, 0)) == 1
	_check("pets_placed", all_once, "배치 %d종" % placed.size())
	var areas := {}
	var dup := 0
	for a in get_tree().get_nodes_in_group("codex_discoverable"):
		if areas.has(a.name):
			dup += 1
		areas[a.name] = true
	_check("discover_areas", areas.size() > 0 and dup == 0, "발견 자리 %d곳 (이름 중복 %d)" % [areas.size(), dup])

	# ④ 저장 왕복
	CodexState.discover("pet", "pt_samjogo")
	SaveState.save()
	CodexState.restore({})
	SaveState.try_load()
	_check("roundtrip", CodexState.has("place", "probe_x") and CodexState.has("pet", "pt_samjogo") and CodexState.count() == 2, str(CodexState.count()))

	_rm()
	SaveState.path_override = saved_override
	CodexState.restore(saved_book)
	PartyState.exp = saved_exp
	print("CODEX_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
