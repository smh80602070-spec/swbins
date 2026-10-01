extends Node
## GO 사건(bandit_encounter·simple_event·hero_encounter·pet_encounter 가 `EventState` 로 "한 번뿐"을 지키는 규칙) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_EVENTS_PROBE 가 있을 때만 단다. 진짜 세이브(user://save.json)는 안 건드리고 임시 파일로 돈다.
##
##   SAGA_EVENTS_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 씬에 사건 노드가 7 개 넘게 서 있고 이름이 겹치지 않는다(이름이 곧 키) ② EventState: 두 번 표시해도 한 번만 · 안 한 것은 false
## ③ 저장→불러오기 왕복에서 끝낸 사건이 남는다(2026-09-11 ㉑ 되살아남 버그의 재발 방지) ④ 끝낸 사건 노드만 씬에서 치워진다(_remove_resolved_events).
## 끝에 EVENTS_PROBE_DONE fails=N. 상태는 끝에 되돌린다.

const KINDS := ["bandit_encounter.gd", "simple_event.gd", "hero_encounter.gd", "pet_encounter.gd"]
const TMP := "user://events_probe.json"
const MIN_EVENTS := 7

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
	print("EVENTS_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _rm() -> void:
	for suffix in ["", ".bak", ".tmp"]:
		if FileAccess.file_exists(TMP + suffix):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP + suffix))


func _event_nodes() -> Array:
	var out := []
	for c in _scene.get_children():
		var s: Script = c.get_script()
		if s == null or c.is_queued_for_deletion():
			continue
		for k in KINDS:
			if s.resource_path.ends_with("/" + k):
				out.append(c)
				break
	return out


func _run() -> void:
	await _frames(4)
	var saved: Array[String] = EventState.resolved.duplicate()
	var saved_override: String = SaveState.path_override
	_rm()
	SaveState.path_override = TMP
	EventState.restore([] as Array[String])

	# ① 씬의 사건 노드
	var nodes := _event_nodes()
	var names := {}
	var dup := 0
	for n in nodes:
		if names.has(n.name):
			dup += 1
		names[n.name] = true
	_check("scene_events", nodes.size() >= MIN_EVENTS and dup == 0, "%d개 (이름 중복 %d)" % [nodes.size(), dup])

	# ② EventState 규칙
	EventState.mark_resolved("probe_evt")
	EventState.mark_resolved("probe_evt")
	_check("dedupe", EventState.is_resolved("probe_evt") and not EventState.is_resolved("probe_other") and EventState.resolved.count("probe_evt") == 1, str(EventState.resolved))

	# ③ 저장 → 불러오기
	SaveState.save()
	EventState.restore([] as Array[String])
	SaveState.try_load()
	_check("roundtrip", EventState.is_resolved("probe_evt"), str(EventState.resolved))

	# ④ 끝낸 사건만 치워진다
	if nodes.size() >= 2:
		var gone: Node = nodes[0]
		var stay: Node = nodes[1]
		EventState.mark_resolved(String(gone.name))
		_scene.call("_remove_resolved_events")
		await _frames(2)
		_check("remove_resolved", not is_instance_valid(gone) or gone.is_queued_for_deletion(), "치워짐: " + String(names.keys()[0]))
		_check("keep_unresolved", is_instance_valid(stay) and not stay.is_queued_for_deletion(), "남음: " + String(names.keys()[1]))

	# 되돌리기
	_rm()
	SaveState.path_override = saved_override
	EventState.restore(saved)
	print("EVENTS_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
