extends SceneTree

## G-0278 ☰ 메뉴 화면 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_menu_screen.gd   → "PROBE menu_screen OK" / "FAIL n"
## 1만리 씬(TestVillage)에서: ① MenuScreen·☰ 단추 있음, hud_menu 왼쪽 단추 숨김 ② 칸 수 = go_menu.items 수
## ③ Esc → 메뉴 열림(ui_modal) · 다시 Esc → 닫힘 ④ 칸마다 누르면 메뉴가 닫히고 그 화면이 열림(ui_modal 이나 is_open) — 그 뒤 Esc 로 닫음
## ⑤ 화면이 열린 채 Esc → 그 화면이 닫히고 메뉴는 안 열림 ⑥ 테마 Button normal 이 StyleBoxTexture(9-slice)
## ⑦ SAGA_MENU_SCREEN=0 이면 attach 가 null. 마당(쉼터)은 마당 곁에서만이라 shown false 면 건너뜀.

const MenuScreen := preload("res://saga_core/ui/menu_screen.gd")
const GoMenu := preload("res://games/saga_go/ui/go_menu.gd")
const UiKit := preload("res://saga_core/ui/ui_kit.gd")

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _init() -> void:
	_run.call_deferred()


func _esc() -> void:
	for d in [true, false]:
		var k := InputEventKey.new()
		k.keycode = KEY_ESCAPE
		k.physical_keycode = KEY_ESCAPE
		k.pressed = d
		Input.parse_input_event(k)
		await process_frame
	await process_frame


func _open_thing(menu: Node) -> String:
	for n in get_nodes_in_group("ui_modal"):
		if n != menu and n.get("visible") != false:
			return String(n.name)
	for n in current_scene.find_children("*", "", true, false):
		if n != menu and n.get("is_open") == true and not n.is_in_group("go_hud_menu"):
			return String(n.name)
	var cm := get_first_node_in_group("go_commissions")   # 의뢰판은 창이 아니라 옆 패널 켜고 끄기
	if cm != null and cm.get("_panel") != null and (cm.get("_panel") as Control).visible:
		return "CommissionsPanel"
	return ""


func _run() -> void:
	await process_frame
	var sc := (load("res://games/saga_go/world/TestVillage.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 40:
		await process_frame
	for m in get_nodes_in_group("ui_modal"):   # 첫 실행 안내·대화 창 — 지우면 붙잡고 있는 노드(봉화대 안내)가 깨져 숨기기만
		if m.has_method("close"):
			m.call("close")
		if m.get("visible") != null:
			m.set("visible", false)
	await process_frame
	var menu := get_first_node_in_group(MenuScreen.GROUP)
	if menu == null:
		_fail("① MenuScreen 없음")
		_end()
		return
	if menu.find_child("MenuBurger", true, false) == null:
		_fail("① ☰ 단추 없음")
	var hm := get_first_node_in_group("go_hud_menu")
	if hm == null or not bool(hm.get("grid_menu")):
		_fail("① hud_menu grid_menu 아님")
	var items: Array = GoMenu.items(hm)
	var grid := menu.find_child("MenuGrid", true, false)
	if grid == null or grid.get_child_count() != items.size():
		_fail("② 칸 수 %d != %d" % [grid.get_child_count() if grid else -1, items.size()])
	## ⑥ 테마
	var th := UiKit.theme_for("go")
	if th == null or not (th.get_stylebox("normal", "Button") is StyleBoxTexture):
		_fail("⑥ 테마 Button normal 이 StyleBoxTexture 아님")
	## ③ Esc 열고 닫기
	await _esc()
	if not bool(menu.get("is_open")) or not menu.is_in_group("ui_modal"):
		_fail("③ Esc 로 메뉴 안 열림")
	await _esc()
	if bool(menu.get("is_open")):
		_fail("③ 다시 Esc 로 메뉴 안 닫힘")
	## ④ 칸마다
	var opened := 0
	for b in grid.get_children():
		var it: Dictionary = b.get_meta("item", {})
		menu.call("open_menu")
		await process_frame
		if not (b as Control).visible:
			print("MENU %s 숨김(shown false)" % it.id)
			menu.call("close_menu")
			continue
		var before := get_nodes_in_group("ui_modal")
		(b as Button).pressed.emit()
		for _k in 4:
			await process_frame
		var got := _open_thing(menu)
		if bool(menu.get("is_open")):
			_fail("④ %s 누른 뒤 메뉴가 안 닫힘" % it.id)
		if got == "":
			_fail("④ %s 화면이 안 열림" % it.id)
		else:
			opened += 1
		print("MENU %s → %s" % [it.id, got])
		## ⑤ 화면이 열린 채 Esc — 메뉴는 안 열려야
		await _esc()
		if bool(menu.get("is_open")):
			if it.id != "commissions":   # 의뢰판은 창이 아니라 옆 패널(게임이 안 멈춤) — 그 위로 메뉴가 열려도 됨
				_fail("⑤ %s 열린 채 Esc 에 메뉴가 열림" % it.id)
			menu.call("close_menu")
		for _k in 2:
			if _open_thing(menu) != "":
				await _esc()
		for n in get_nodes_in_group("ui_modal"):   # 선택 창(화질 등 ChoicePrompt)은 Esc 로 안 닫힘 — 지움
			if n != menu and n is CanvasLayer and String(n.name).begins_with("@") and not before.has(n):
				n.queue_free()
		for n in sc.find_children("*", "", true, false):   # Esc 로 안 닫히는 화면(토글형)은 직접
			if n.get("is_open") == true and n != menu:
				if n.has_method("close_screen"):
					n.call("close_screen")
				elif n.has_method("toggle_panel"):
					n.call("toggle_panel")
		var cm := get_first_node_in_group("go_commissions")
		if cm != null and cm.get("_panel") != null and (cm.get("_panel") as Control).visible:
			cm.call("toggle_panel")
		await process_frame
	print("MENU opened=%d/%d" % [opened, items.size()])
	## ⑦ 손잡이
	OS.set_environment("SAGA_MENU_SCREEN", "0")
	if MenuScreen.attach(sc, "go", []) != null:
		_fail("⑦ SAGA_MENU_SCREEN=0 인데 attach 됨")
	OS.set_environment("SAGA_MENU_SCREEN", "")
	_end()


func _end() -> void:
	print("PROBE menu_screen ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
