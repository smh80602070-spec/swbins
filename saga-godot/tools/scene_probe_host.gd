extends Node

## 씬 환경(오토로드 포함)이 필요한 점검의 호스트. `--script`(SceneTree) 점검은 오토로드가 전역 식별자로 안 잡혀 씬·게임 스크립트가
## 컴파일에 실패하므로(material_audit_host.gd 주석, 09-23), 일반 씬 실행으로 이 호스트를 띄우고 점검 스크립트(`extends Node`, `run() -> int` = 실패 수)를 자식으로 싣는다.
## 사용: godot --headless --path . res://tools/scene_probe_host.tscn -- res://tools/scene_probes/<이름>.gd
## 끝에 "PROBE <이름> OK" 또는 "PROBE <이름> FAIL n" 을 찍는다. probe_all.sh 는 이걸 `tools/probe_<이름>.gd`(SceneTree 래퍼)로 부른다.

func _ready() -> void:
	get_tree().create_timer(90.0).timeout.connect(func() -> void:
		print("PROBE scene_host FAIL 1 (시간 초과)")
		get_tree().quit(3))
	var args := OS.get_cmdline_user_args()
	if args.is_empty():
		print("PROBE scene_host FAIL 1 (점검 스크립트 경로 인자 없음)")
		get_tree().quit(2)
		return
	var script := load(args[0]) as GDScript
	if script == null:
		print("PROBE scene_host FAIL 1 (점검 스크립트를 못 읽음: %s)" % args[0])
		get_tree().quit(2)
		return
	var probe: Node = script.new()
	add_child(probe)
	await get_tree().process_frame
	var fails: int = await probe.run()
	var label := String(args[0]).get_file().get_basename()
	print("PROBE %s %s" % [label, "OK" if fails == 0 else "FAIL %d" % fails])
	get_tree().quit(1 if fails > 0 else 0)
