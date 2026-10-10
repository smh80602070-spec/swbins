extends Node
## G-0057 사진 모드(ui/photo_mode_button.gd) 공유용 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_PHOTO_PROBE 가 있을 때만 단다.
##
##   SAGA_PHOTO_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 환경 SAGA_PHOTO_DIR 가 저장 폴더를 이긴다(없으면 PC 는 사진 폴더/사가만리) ② 워터마크 글: 마을 한가운데면 "1만리 · 청하 마을 · 날짜"(G-0156, 폴더는 옛 이름 그대로)
## ③ 숨기기 → 되돌리기 뒤 CanvasLayer 보임이 처음 그대로(원래 숨은 층은 숨은 채), 숨긴 동안엔 워터마크 층 말고 다 숨음 ④ 워터마크 층은 평소 숨김.
## 파일은 안 쓴다(헤드리스는 화면을 못 읽는다). 끝에 "PHOTO_PROBE_DONE fails=N".

var _frame := 0
var _fails := 0
var _done := false


func _check(name: String, ok: bool, info := "") -> void:
	print("PHOTO_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", info])
	if not ok:
		_fails += 1


func _btn() -> Node:
	for n in get_tree().root.find_children("*", "Button", true, false):
		var sc := n.get_script() as Script
		if sc != null and sc.resource_path.ends_with("photo_mode_button.gd"):
			return n
	return null


func _physics_process(_delta: float) -> void:
	_frame += 1
	if _done or _frame < 10:
		return
	_done = true
	var btn := _btn()
	_check("button", btn != null)
	if btn == null:
		_finish()
		return
	var Btn: Script = btn.get_script()

	# ①
	var old := OS.get_environment("SAGA_PHOTO_DIR")
	OS.set_environment("SAGA_PHOTO_DIR", "C:/tmp/saga_photo_probe")
	_check("env_dir", String(Btn.call("photo_dir")) == "C:/tmp/saga_photo_probe")
	OS.unset_environment("SAGA_PHOTO_DIR")
	var d := String(Btn.call("photo_dir"))
	_check("default_dir", (d.ends_with("사가만리") if OS.has_feature("pc") else d == "user://photos"), d)
	if old != "":
		OS.set_environment("SAGA_PHOTO_DIR", old)

	# ②
	var wm := String(Btn.call("watermark_text", Vector3.ZERO))
	_check("watermark", wm.begins_with("1만리 · 청하 마을 · ") and wm.ends_with(Time.get_date_string_from_system()), wm)
	_check("watermark_outside", String(Btn.call("watermark_text", Vector3(99999, 0, 99999))) == "1만리 · " + Time.get_date_string_from_system())

	# ④
	var mark := btn.get("_mark_layer") as CanvasLayer
	_check("mark_hidden", mark != null and not mark.visible)

	# ③
	var extra := CanvasLayer.new()   # 원래 숨은 층 — 되돌린 뒤에도 숨어 있어야
	extra.visible = false
	get_tree().root.add_child(extra)
	var before := {}
	for n in get_tree().root.find_children("*", "CanvasLayer", true, false):
		before[n] = (n as CanvasLayer).visible
	var hidden: Array = btn.call("_hide_layers")
	var any_shown := false
	for n in before:
		if n != mark and (n as CanvasLayer).visible:
			any_shown = true
	_check("all_hidden", not any_shown and hidden.size() >= 3 and not hidden.has(extra), "숨긴 층 %d" % hidden.size())
	btn.call("_restore_layers", hidden)
	var same := true
	for n in before:
		same = same and (n as CanvasLayer).visible == bool(before[n])
	_check("restored", same and not extra.visible)
	extra.queue_free()
	_finish()


func _finish() -> void:
	print("PHOTO_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
