extends SceneTree

## G-0278 ☰ 메뉴 화면 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_menu_screen.gd   → "PROBE menu_screen OK" / "FAIL n"
## 1만리 씬(TestVillage)에서: ① MenuScreen·☰ 단추 있음, hud_menu 왼쪽 단추 숨김 ② 칸 수 = go_menu.items 수
## ③ Esc → 메뉴 열림(ui_modal) · 다시 Esc → 닫힘 ④ 칸마다 누르면 메뉴가 닫히고 그 화면이 열림(ui_modal 이나 is_open) — 그 뒤 Esc 로 닫음
## ⑤ 화면이 열린 채 Esc → 그 화면이 닫히고 메뉴는 안 열림 ⑥ 테마 Button normal 이 StyleBoxTexture(9-slice)
## ⑦ SAGA_MENU_SCREEN=0 이면 attach 가 null. 마당(쉼터)은 마당 곁에서만이라 shown false 면 건너뜀.
## G-0280: SAGA_MENU_GAME=dungeon|forest|story|realm 이면 그 판 씬 — 칸 = HUD MenuHook items 중 HUD 에 있는 단추, 옮긴 단추는 숨김.

const MenuScreen := preload("res://saga_core/ui/menu_screen.gd")
const GoMenu := preload("res://games/saga_go/ui/go_menu.gd")
const UiKit := preload("res://saga_core/ui/ui_kit.gd")
const SaveTransferScreen := preload("res://saga_core/ui/save_transfer_screen.gd")

const SCENES := {"go": "res://games/saga_go/world/TestVillage.tscn", "dungeon": "res://games/saga_dungeon/world/TestRoom.tscn",
	"forest": "res://games/saga_forest/world/TestVillageForest.tscn", "story": "res://games/saga_story/world/SinyaField.tscn",
	"realm": "res://games/saga_realm/world/TestCity.tscn"}
const TOGGLES := ["commissions", "horde", "hardcore", "sigil"]   # 창 없이 켜고 끄거나 옆 패널 — 열림 판정·Esc 판정 빼고 메뉴 닫힘만

var fails := 0
var game := "go"
var before_toast: Array = []


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
	for l in get_nodes_in_group("dialogue_label"):   # 조건이 안 맞으면 창 대신 한 마디(토스트 — "박을 빈 소켓이 없다") — 그것도 응답
		if (l as Label).visible and (l as Label).text != "" and not before_toast.has((l as Label).text):
			return "토스트 " + (l as Label).text.left(20)
	var cm := get_first_node_in_group("go_commissions")   # 의뢰판은 창이 아니라 옆 패널 켜고 끄기
	if cm != null and cm.get("_panel") != null and (cm.get("_panel") as Control).visible:
		return "CommissionsPanel"
	return ""


func _run() -> void:
	await process_frame
	var only := OS.get_environment("SAGA_MENU_GAME")
	for g in SCENES:
		if only == "" or only == g:
			game = g
			await _one()
	## ⑦ 손잡이
	OS.set_environment("SAGA_MENU_SCREEN", "0")
	if MenuScreen.attach(root, game, []) != null:
		_fail("⑦ SAGA_MENU_SCREEN=0 인데 attach 됨")
	OS.set_environment("SAGA_MENU_SCREEN", "")
	_end()


func _one() -> void:
	var f0 := fails
	var sc := (load(SCENES[game]) as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 40:
		await process_frame
	for m in get_nodes_in_group("ui_modal"):   # 첫 실행 안내·대화 창 — 지우면 붙잡고 있는 노드(봉화대 안내)가 깨져 숨기기만
		if m.has_method("close"):
			m.call("close")
		if m.get("visible") != null:
			m.set("visible", false)
		if game != "go":   # 숨긴 안내도 그룹에 남으면 "창이 하나라도 있으면 안 연다"는 화면(성좌)이 막힌다
			m.remove_from_group("ui_modal")
	paused = false   # 숨긴 첫 안내(세션 카드)가 멈춰 둔 채라 — 진짜 판에선 그 창을 닫으면 풀린다
	await process_frame
	var menu := get_first_node_in_group(MenuScreen.GROUP)
	if menu == null:
		_fail("① MenuScreen 없음")
		sc.free()
		return
	if menu.find_child("MenuBurger", true, false) == null:
		_fail("① ☰ 단추 없음")
	var items: Array = []
	if game == "go":
		var hm := get_first_node_in_group("go_hud_menu")
		if hm == null or not bool(hm.get("grid_menu")):
			_fail("① hud_menu grid_menu 아님")
		items = GoMenu.items(hm)
	else:
		var hook := sc.find_child("MenuHook", true, false)
		if hook == null:
			_fail("① HUD MenuHook 없음")
		else:
			items = hook.get("moved")
			for b: Button in items:
				if b.visible:
					_fail("① 옮긴 단추 %s 가 HUD 에 보임" % b.name)
			if items.size() != (hook.get("items") as PackedStringArray).size():
				print("MENU hook items %d 중 HUD 에 있는 단추 %d" % [(hook.get("items") as PackedStringArray).size(), items.size()])
	var extra := 0   # G-0286 "@me" 처럼 단추 없는 칸
	if game != "go":
		var hk := sc.find_child("MenuHook", true, false)
		if hk != null:
			extra = Array(hk.get("items")).filter(func(l): return String(l).begins_with("@")).size()
	var grid := menu.find_child("MenuGrid", true, false)
	if grid == null or grid.get_child_count() != items.size() + extra:
		_fail("② 칸 수 %d != %d" % [grid.get_child_count() if grid else -1, items.size() + extra])
	## ⑥ 테마
	var th := UiKit.theme_for(game)
	if th == null or not (th.get_stylebox("normal", "Button") is StyleBoxTexture):
		_fail("⑥ 테마 Button normal 이 StyleBoxTexture 아님")
	## ③ Esc 열고 닫기
	await _esc()
	if not bool(menu.get("is_open")) or not menu.is_in_group("ui_modal"):
		_fail("③ Esc 로 메뉴 안 열림 (막는 것 %s · paused %s)" % [menu.call("_other_modal"), paused])
	var pl := get_first_node_in_group("player")
	if pl != null and not SaveTransferScreen._is_frozen(pl):   # R-5 — frozen 없는 4종횡 몸도 멈춰야
		_fail("③ 메뉴가 열렸는데 주인공이 안 멈춤")
	await _esc()
	if bool(menu.get("is_open")):
		_fail("③ 다시 Esc 로 메뉴 안 닫힘")
	if pl != null and SaveTransferScreen._is_frozen(pl):
		_fail("③ 메뉴를 닫았는데 주인공이 멈춘 채")
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
		before_toast = get_nodes_in_group("dialogue_label").filter(func(l): return (l as Label).visible).map(func(l): return (l as Label).text)
		(b as Button).pressed.emit()
		for _k in 4:
			await process_frame
		var got := _open_thing(menu)
		if bool(menu.get("is_open")):
			_fail("④ %s 누른 뒤 메뉴가 안 닫힘" % it.id)
		if got == "" and not TOGGLES.has(it.id):
			_fail("④ %s 화면이 안 열림" % it.id)
		else:
			opened += 1
		print("MENU %s → %s" % [it.id, got])
		## ⑤ 화면이 열린 채 Esc — 메뉴는 안 열려야
		await _esc()
		if bool(menu.get("is_open")):
			if got != "" and not got.begins_with("토스트") and not TOGGLES.has(it.id):   # 의뢰판은 창이 아니라 옆 패널(게임이 안 멈춤) — 그 위로 메뉴가 열려도 됨
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
	print("MENU %s opened=%d/%d fails=%d" % [game, opened, items.size() + extra, fails - f0])
	for m in get_nodes_in_group("ui_modal"):
		if m is CanvasLayer and not sc.is_ancestor_of(m):
			m.queue_free()
	sc.queue_free()
	for _k in 3:
		await process_frame


func _end() -> void:
	print("PROBE menu_screen ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
