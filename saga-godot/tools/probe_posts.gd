extends Node
## GO 역참·사진 모드·소문(마을 잡담) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_POSTS_PROBE 가 있을 때만 단다. 진짜 세이브·사진 폴더는 안 건드린다(촬영 단추는 누르지 않는다).
##
##   SAGA_POSTS_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 소문(world/npc_builder.gd LINES·_pick_line): 낮 → day 줄 · 밤 → night 줄 · 비/눈 → rain 줄(밤보다 우선) · 줄 표에 없는 역할은 제 줄 그대로
## ② 역참: 마을에 Waystation 건물이 서 있고 몸(충돌)이 있다 ③ 사진 모드(ui/photo_mode_button.gd): 켜면 단추 ✕·촬영 단추 보임·다른 HUD 숨김·
## 플레이어 얼림, 끄면 전부 처음 모습으로. 끝에 POSTS_PROBE_DONE fails=N. 강제한 날씨·시각은 끝에 푼다.

var _scene: Node
var _p: Node
var _fails := 0


func _ready() -> void:
	_scene = get_tree().current_scene
	_p = get_tree().get_first_node_in_group("player")
	_run.call_deferred()


func _frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("POSTS_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _by_script(root: Node, file: String) -> Node:
	var s: Script = root.get_script()
	if s != null and s.resource_path.ends_with("/" + file):
		return root
	for c in root.get_children():
		var r := _by_script(c, file)
		if r != null:
			return r
	return null


func _run() -> void:
	await _frames(4)

	# ① 소문 — 역할·시각·날씨로 갈리는 한 줄
	var npcs := _by_script(_scene, "npc_builder.gd")
	_check("npc_builder 있음", npcs != null, str(npcs))
	if npcs != null:
		var lines: Dictionary = npcs.LINES
		var ok_all := true
		var shown := ""
		for v in npcs.VILLAGERS:
			var set: Dictionary = lines.get(v.get("role", ""), {})
			if set.is_empty():
				Weather.force("clear")
				TimeOfDay.force(true)
				ok_all = ok_all and npcs._pick_line(v) == v.line  # 줄 표에 없는 역할은 제 줄 그대로
				continue
			Weather.force("clear")
			TimeOfDay.force(false)
			var day: String = npcs._pick_line(v)
			TimeOfDay.force(true)
			var night: String = npcs._pick_line(v)
			Weather.force("rain")
			TimeOfDay.force(false)
			var rain_day: String = npcs._pick_line(v)
			Weather.force("snow")
			TimeOfDay.force(true)
			var snow_night: String = npcs._pick_line(v)
			var one: bool = day == set.get("day") and night == set.get("night", set.get("day")) and rain_day == set.get("rain", set.get("day")) and snow_night == rain_day
			ok_all = ok_all and one
			shown += " %s:%s" % [v.role, "ok" if one else "BAD"]
		_check("rumor_lines", ok_all and lines.size() >= 2, "역할별 줄 선택" + shown)
	Weather.force("clear")
	TimeOfDay.force(false)

	# ② 역참
	var way := _scene.find_child("Waystation", true, false)
	var has_body := false
	if way != null:
		has_body = way.find_children("*", "CollisionShape3D", true, false).size() > 0 or way is StaticBody3D
	_check("waystation", way != null and has_body, "건물 %s · 충돌 %s" % [str(way != null), str(has_body)])

	# ③ 사진 모드
	var btn := _by_script(get_tree().root, "photo_mode_button.gd")
	_check("photo_button 있음", btn != null, str(btn))
	if btn != null and _p != null:
		var hud: Node = btn.get_parent()
		var cap: Button = btn._capture_button
		var before := {}
		for c in hud.get_children():
			# 안내 토스트(사진 모드 켰다/껐다 글)가 쓰는 대화창 둘은 일부러 켜지므로 뺀다
			if c is CanvasItem and c != btn and c != cap and not c.is_in_group("dialogue_panel") and not c.is_in_group("dialogue_label"):
				before[c] = (c as CanvasItem).visible
		var was_frozen: bool = bool(_p.get("frozen"))
		btn._on_pressed()
		var hidden_ok := true
		for c in before:
			hidden_ok = hidden_ok and not (c as CanvasItem).visible
		var vis_names := []
		for c in before:
			if (c as CanvasItem).visible:
				vis_names.append(String(c.name))
		_check("photo_on", btn._on and btn.text == "✕" and cap.visible and hidden_ok and bool(_p.get("frozen")), "on=%s frozen=%s 안 숨은 HUD=%s · " % [str(btn._on), str(_p.get("frozen")), str(vis_names)] + "단추 %s · 촬영 단추 %s · 숨긴 HUD %d" % [btn.text, str(cap.visible), before.size()])
		btn._on_pressed()
		var back_ok := true
		for c in before:
			back_ok = back_ok and (c as CanvasItem).visible == before[c]
		_check("photo_off", (not btn._on) and btn.text == "📷" and (not cap.visible) and back_ok and bool(_p.get("frozen")) == was_frozen, "처음 모습으로 복귀")

	Weather.force("")
	TimeOfDay.force(null)
	print("POSTS_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
