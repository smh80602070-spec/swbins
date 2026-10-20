extends Node

## saga_core/world/material_audit.gd 를 대표 씬에 돌리는 호스트. `-s` 스크립트로는
## 오토로드가 전역 식별자로 안 잡혀 씬 스크립트가 컴파일에 실패하므로(09-23 확인),
## 일반 씬 실행으로 이 호스트를 띄우고 대상 씬을 자식으로 싣는다.
## 사용: godot --headless --path . res://tools/material_audit_host.tscn -- res://<씬>.tscn

const MaterialAudit := preload("res://saga_core/world/material_audit.gd")
const SETTLE_FRAMES := 10


func _ready() -> void:
	## 감사 스크립트가 런타임 오류로 멈춰도 quit에 닿지 못해 영원히 도는 일이 없게.
	get_tree().create_timer(60.0).timeout.connect(func() -> void:
		print("MATERIAL_AUDIT_DONE issues=-1 (시간 초과)")
		get_tree().quit(3))
	var args := OS.get_cmdline_user_args()
	if args.is_empty():
		print("MATERIAL_AUDIT_DONE issues=-1 (씬 경로 인자 없음)")
		get_tree().quit(2)
		return
	var scene: Node = (load(args[0]) as PackedScene).instantiate()
	## G-0268 — current_scene 은 root 의 직속만 된다(mount_host 와 같은 고침). _ready 중엔 root 가 바빠 미룬다.
	get_tree().root.add_child.call_deferred(scene)
	await get_tree().process_frame
	get_tree().current_scene = scene
	for _i in SETTLE_FRAMES:
		await get_tree().process_frame
	var issues := MaterialAudit.audit(scene)
	for s in issues:
		print("MATERIAL_AUDIT ", s)
	print("MATERIAL_AUDIT_DONE issues=%d" % issues.size())
	get_tree().quit(1 if issues.size() > 0 else 0)
