extends SceneTree

## G-0286 「내 정보」 창 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_me_panel.gd   → "PROBE me_panel OK" / "FAIL n"
## 네 판(2나락·3마을·4종횡·5천하) 씬마다: ① ☰ 메뉴에 me 칸 ② me 칸 → 창(group me_panel·ui_modal)·멈춤
## ③ rows = 이름 + 칸 + 능력치 + 그물 줄 ④ 능력치 값 = 판 기존 함수 값(판별 하나씩) ⑤ 그물 단추 → passive_web_screen 열림
## ⑥ Esc → 창 닫힘·멈춤 풀림. SAGA_ME_GAME=<판> 이면 그 판만.

const MenuScreen := preload("res://saga_core/ui/menu_screen.gd")
const MePanel := preload("res://saga_core/ui/me_panel.gd")

const SCENES := {"dungeon": "res://games/saga_dungeon/world/TestRoom.tscn",
	"forest": "res://games/saga_forest/world/TestVillageForest.tscn", "story": "res://games/saga_story/world/SinyaField.tscn",
	"realm": "res://games/saga_realm/world/TestCity.tscn"}

var fails := 0
var game := "dungeon"


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", game, " ", msg)


func _init() -> void:
	await process_frame
	var only := OS.get_environment("SAGA_ME_GAME")
	for g in SCENES:
		if only == "" or only == g:
			game = g
			await _one()
	print("PROBE me_panel ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)


func _one() -> void:
	var f0 := fails
	var sc := (load(SCENES[game]) as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 40:
		await process_frame
	for m in get_nodes_in_group("ui_modal"):   # 첫 안내·세션 카드 — probe_menu_screen 과 같게 숨기고 그룹에서 뺌
		if m.has_method("close"):
			m.call("close")
		if m.get("visible") != null:
			m.set("visible", false)
		m.remove_from_group("ui_modal")
	paused = false
	await process_frame
	var menu := get_first_node_in_group(MenuScreen.GROUP)
	var hook := sc.find_child("MenuHook", true, false)
	if menu == null or hook == null:
		_fail("① 메뉴·MenuHook 없음")
		sc.queue_free()
		return
	var me_btn: Button = null
	for b in menu.find_child("MenuGrid", true, false).get_children():
		if String((b.get_meta("item", {}) as Dictionary).get("id", "")) == "me":
			me_btn = b
	if me_btn == null:
		_fail("① ☰ 에 me 칸 없음")
		sc.queue_free()
		return
	## ② 칸 → 창
	menu.call("open_menu")
	await process_frame
	me_btn.pressed.emit()
	for _k in 4:
		await process_frame
	var panel := get_first_node_in_group(MePanel.GROUP)
	if panel == null or not panel.is_in_group("ui_modal"):
		_fail("② me 칸 눌러도 창 없음")
		sc.queue_free()
		return
	if not paused:
		_fail("② 창이 열렸는데 안 멈춤")
	## ③ 줄
	var m: Dictionary = panel.get("model")
	var rows := MePanel.rows(m)
	var want: int = 1 + (m.get("slots", []) as Array).size() + (m.get("stats", []) as Array).size() + (0 if (m.get("grow", {}) as Dictionary).is_empty() else 1)
	if rows.size() != want or (m.get("stats", []) as Array).is_empty() or (m.get("grow", {}) as Dictionary).is_empty():
		_fail("③ 줄 %d != %d (능력치·그물 비면 안 됨)" % [rows.size(), want])
	print("ME %s: %s" % [game, " | ".join(rows)])
	## G-0295 5천하 군주 움직이는 초상
	if game == "realm":
		var pid := String(m.get("portrait", ""))
		var lp: GDScript = load("res://saga_core/ui/live_portrait.gd")
		if pid == "" or (bool(lp.call("available", pid)) and panel.find_child("MePortrait", true, false) == null):
			_fail("G-0295 군주 %s 초상 없음" % pid)
	## ④ 값
	_check_values(m)
	## ⑤ 그물
	var grow := panel.find_child("MeGrow", true, false) as Button
	grow.pressed.emit()
	for _k in 4:
		await process_frame
	var web := get_first_node_in_group("passive_web_screen")
	if web == null:
		_fail("⑤ 그물 단추로 그물 화면 안 열림")
	else:
		web.call("close_screen")
	if get_first_node_in_group(MePanel.GROUP) != null and not get_first_node_in_group(MePanel.GROUP).is_queued_for_deletion():
		_fail("⑤ 그물 열 때 내 정보 창이 안 닫힘")
	await process_frame
	paused = false
	## ⑥ Esc
	var p2 := MePanel.open_for(hook.get_parent(), game, String(hook.get("me_adapter")))
	await process_frame
	if p2 == null:
		_fail("⑥ open_for 다시 열기 실패")
	else:
		for down in [true, false]:
			var ev := InputEventAction.new()
			ev.action = "ui_cancel"
			ev.pressed = down
			Input.parse_input_event(ev)
		for _k in 3:
			await process_frame
		if is_instance_valid(p2) and not p2.is_queued_for_deletion():
			_fail("⑥ Esc 로 창 안 닫힘")
		if paused:
			_fail("⑥ 닫았는데 멈춘 채")
	print("ME %s fails=%d" % [game, fails - f0])
	for n in get_nodes_in_group("ui_modal"):
		if n is CanvasLayer and not sc.is_ancestor_of(n):
			n.queue_free()
	sc.queue_free()
	for _k in 3:
		await process_frame


## 판마다 능력치 하나 이상 = 기존 함수 값
func _check_values(m: Dictionary) -> void:
	var stats: Array = m.get("stats", [])
	var v := func(i: int) -> String: return String((stats[i] as Dictionary).get("value", ""))
	var A := func(n: String) -> Node: return root.get_node("/root/" + n)   # autoload 은 SceneTree 스크립트 컴파일 때 없음 — 이름으로
	match game:
		"dungeon":
			var hp := roundi(float(load("res://games/saga_dungeon/player/player_health.gd").get("MAX_HP_BASE")) * A.call("DungeonRunState").call("hp_mult"))
			if v.call(1) != str(hp):
				_fail("④ 체력 %s != %d" % [v.call(1), hp])
		"forest":
			if v.call(0) != str(A.call("ForestSaveState").get("gold")):
				_fail("④ 돈 %s != %d" % [v.call(0), A.call("ForestSaveState").get("gold")])
		"story":
			var pl: Node = null
			for n in current_scene.find_children("*", "CharacterBody3D", true, false):
				if n.has_method("_effective_atk"):
					pl = n
			if pl != null and v.call(2) != str(roundi(float(pl.get("max_hp")))):
				_fail("④ 체력 %s != 몸 max_hp %s" % [v.call(2), pl.get("max_hp")])
			var g: Dictionary = A.call("StorySaveState").call("gear_totals")
			if v.call(1) != str(roundi(float(g.def))):
				_fail("④ 방어 %s != %s" % [v.call(1), g.def])
		"realm":
			var id: String = A.call("RealmSaveState").get("current_lord_id")
			for i in 3:
				var key: String = ["might", "wisdom", "command"][i]
				if v.call(i) != str(roundi(A.call("RealmSaveState").call("_effective_stat", id, key))):
					_fail("④ %s %s != %s" % [key, v.call(i), A.call("RealmSaveState").call("_effective_stat", id, key)])
