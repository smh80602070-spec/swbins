extends RefCounted
## G-0220 촬영 도우미 — 대화 초상: 자체툴 배치 전이면 웹에 놓인 초상(saga-web/saga-story/assets/portraits/live·expr)을 user:// 에 잠깐 베껴
## (에셋 아님 — 촬영 뒤 지우지 않아도 커밋되지 않는다) 스승 줄 대화창을 연다. 놓인 뒤엔 assets/portraits 를 그대로 쓴다.

const LP := preload("res://saga_core/ui/live_portrait.gd")
const TalkBox := preload("res://saga_core/ui/talk_box.gd")
const PID := "jp_musashi"


static func _copy_web(pid: String) -> void:
	var web := ProjectSettings.globalize_path("res://").path_join("../saga-web/saga-story/assets/portraits").simplify_path()
	var dst := "user://shot_portraits"
	DirAccess.make_dir_recursive_absolute(dst + "/live/" + pid)
	DirAccess.make_dir_recursive_absolute(dst + "/expr")
	var src := web.path_join("live").path_join(pid)
	for f in DirAccess.get_files_at(src):
		DirAccess.copy_absolute(src.path_join(f), ProjectSettings.globalize_path(dst + "/live/" + pid + "/" + f))
	for f in DirAccess.get_files_at(web.path_join("expr")):
		if f.begins_with(pid + "__"):
			DirAccess.copy_absolute(web.path_join("expr").path_join(f), ProjectSettings.globalize_path(dst + "/expr/" + f))
	LP.root_dir = dst


static func open(tree: SceneTree, emote: String) -> void:
	if not LP.available(PID):
		_copy_web(PID)
	var box: CanvasLayer = TalkBox.open(tree.current_scene, "📜 1부 2장 · 수련장", [["🥋 이도인", "검은 손이 먼저 안다. 머리는 나중에 따라온다. 오늘은 백 번만 휘둘러라.", {"id": PID, "emote": emote}]], func(_a: String) -> void: pass)
	print("ST_TALK_PORTRAIT 초상 %s (%s) · 뿌리 %s" % [box.call("portrait_id"), emote, LP.root_dir])
