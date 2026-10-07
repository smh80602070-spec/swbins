extends Node
## G-0068 오류 기록(saga_core/data/error_log.gd · ui/error_log_screen.gd) — scene_probe_host 로 돈다.
## ① 가짜 로그 글에서 ERROR·SCRIPT ERROR·WARNING 과 뒤 at: 만 뽑힘(보통 줄은 버림) ② 같은 항목 셋 → ×3 ③ max 넘으면 뒤쪽만
## ④ report() 머리줄·오류 없음 문구 ⑤ 화질 창 셋째 줄 → 오류 기록 창·복사/닫기 단추·닫으면 사라짐.

const ErrorLog := preload("res://saga_core/data/error_log.gd")
const Menu := preload("res://saga_core/ui/graphics_menu.gd")

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func run() -> int:
	var fake := "\n".join(PackedStringArray([
		"Godot Engine v4.7.2", "보통 줄",
		"ERROR: 무엇이 잘못됨", "   at: foo (res://a.gd:3)",
		"SCRIPT ERROR: Invalid call", "          at: bar (res://b.gd:9)",
		"WARNING: 경고 하나",
		"ERROR: 무엇이 잘못됨", "   at: foo (res://a.gd:3)",
		"ERROR: 무엇이 잘못됨", "   at: foo (res://a.gd:3)",
		"끝"]))
	var items := ErrorLog.collect(fake)
	if items.size() != 3:
		_fail("뽑힌 항목 %d (3 이어야) %s" % [items.size(), items])
	elif not String(items[0]).begins_with("ERROR: 무엇이 잘못됨  at: foo") or not String(items[0]).ends_with("×3"):
		_fail("at 붙이기·×3 %s" % items[0])
	elif not String(items[1]).begins_with("SCRIPT ERROR") or not String(items[2]).begins_with("WARNING"):
		_fail("종류 %s" % [items])
	var many := ""
	for i in 60:
		many += "ERROR: e%d\n" % i
	var last := ErrorLog.collect(many, 40)
	if last.size() != 40 or String(last[39]) != "ERROR: e59" or String(last[0]) != "ERROR: e20":
		_fail("max 40 뒤쪽 %d %s…%s" % [last.size(), last[0] if last.size() else "", last[-1] if last.size() else ""])
	var rep := ErrorLog.report()
	if not rep.begins_with("사가 고돗"):
		_fail("report 머리줄 %s" % rep.left(40))

	var menu := Menu.new()
	add_child(menu)
	menu.call("open_screen")
	var modal: Node = null
	for n in get_tree().get_nodes_in_group("ui_modal"):
		modal = n
	var btns: Array = modal.find_children("*", "Button", true, false) if modal else []
	if btns.size() != 3:
		_fail("화질 창 줄 %d" % btns.size())
	else:
		(btns[2] as Button).pressed.emit()
		await get_tree().process_frame
		var scr := menu.get_node_or_null("ErrorLog")
		if scr == null or not bool(scr.get("is_open")):
			_fail("오류 기록 창이 안 열림")
		else:
			if scr.find_child("CopyButton", true, false) == null or scr.find_child("CloseButton", true, false) == null:
				_fail("복사·닫기 단추 없음")
			scr.call("close_screen")
			if bool(scr.get("is_open")):
				_fail("닫기 안 됨")
	menu.queue_free()
	return fails
