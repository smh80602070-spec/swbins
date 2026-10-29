extends SceneTree

## G-0351 「오늘」 창 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_goals_panel.gd   → "PROBE goals_panel OK" / "FAIL n"
## 네 판(1만리·2나락·3마을·4종횡) 씬마다: ① ☰ 메뉴에 goals 칸 ② 칸 → 창(group goals_panel·ui_modal)·멈춤
## ③ rows 줄 수 = 판 기존 값(1만리 오늘 의뢰 넷·주간 다섯 · 2나락 시즌 둘 · 3마을 오늘 둘 · 4종횡 오늘 둘·주간 하나)
## ④ 1만리 주간 받기·2나락 현상금·4종횡 일일 사명: 받을 단추가 켜지고, 누르면 한 번 지급(임시 저장만)
## ⑤ Esc → 창 닫힘·멈춤 풀림 ⑥ 줄 글 함수(line_text·left_text). SAGA_GOALS_GAME=<판> 이면 그 판만. 5천하는 G-0364 「이번 달」(게임 달 — 시계 없음).

const MenuScreen := preload("res://saga_core/ui/menu_screen.gd")
const GoalsPanel := preload("res://saga_core/ui/goals_panel.gd")

const SCENES := {"go": "res://games/saga_go/world/TestVillage.tscn", "dungeon": "res://games/saga_dungeon/world/TestRoom.tscn",
	"forest": "res://games/saga_forest/world/TestVillageForest.tscn", "story": "res://games/saga_story/world/SinyaField.tscn",
	"realm": "res://games/saga_realm/world/TestCity.tscn"}   # G-0364 5천하 「이번 달」
## [오늘 줄 수, 주간 줄 수] — 2나락 오늘 칸 = 이번 판 현상금 셋(G-0372) · 3마을 셋째 = 낚시 대회(G-0373)
const WANT := {"go": [5, 5], "dungeon": [3, 2], "forest": [3, 0], "story": [2, 1], "realm": [2, 3]}   # G-0387 — 1만리 오늘 = 의뢰 넷 + 들판 수수께끼(이 지역) 한 줄

var fails := 0
var game := "go"


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", game, " ", msg)


func _init() -> void:
	await process_frame
	if GoalsPanel.line_text({"label": "a", "cur": 5, "max": 3, "done": true}) != "✔ a 3/3" or GoalsPanel.line_text({"label": "b"}) != "· b" \
			or GoalsPanel.left_text(3 * 3600 + 120) != "3시간 2분" or GoalsPanel.left_text(30) != "1분" or GoalsPanel.left_text(0) != "":
		game = "core"
		_fail("⑥ 줄 글 함수")
	var only := OS.get_environment("SAGA_GOALS_GAME")
	for g in SCENES:
		if only == "" or only == g:
			game = g
			await _one()
	print("PROBE goals_panel ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)


func _one() -> void:
	var sc := (load(SCENES[game]) as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for _i in 40:
		await process_frame
	for m in get_nodes_in_group("ui_modal"):   # 첫 안내·세션 카드 — probe_me_panel 과 같게
		if m.has_method("close"):
			m.call("close")
		if m.get("visible") != null:
			m.set("visible", false)
		m.remove_from_group("ui_modal")
	paused = false
	await process_frame
	var menu := get_first_node_in_group(MenuScreen.GROUP)
	var btn: Button = null
	if menu != null:
		for b in menu.find_child("MenuGrid", true, false).get_children():
			if String((b.get_meta("item", {}) as Dictionary).get("id", "")) == "goals":
				btn = b
	if btn == null:
		_fail("① ☰ 에 goals 칸 없음")
		await _drop(sc)
		return
	menu.call("open_menu")
	await process_frame
	btn.pressed.emit()
	for _k in 4:
		await process_frame
	var panel := get_first_node_in_group(GoalsPanel.GROUP)
	if panel == null or not panel.is_in_group("ui_modal"):
		_fail("② goals 칸 눌러도 창 없음")
		await _drop(sc)
		return
	if not paused:
		_fail("② 창이 열렸는데 안 멈춤")
	var m: Dictionary = panel.get("model")
	var rows := GoalsPanel.rows(m)
	print("GOALS %s %s" % [game, " | ".join(rows)])
	var nt := (m.get("today", []) as Array).size()
	var nw := (m.get("week", []) as Array).size()
	if nt != int(WANT[game][0]) or nw != int(WANT[game][1]):
		_fail("③ 줄 수 오늘 %d·주간 %d != %s" % [nt, nw, WANT[game]])
	if game == "go":
		await _claim_go(panel)
	elif game == "dungeon" or game == "story":
		await _claim_manual(panel)
	panel = get_first_node_in_group(GoalsPanel.GROUP)
	if panel != null:
		var ev := InputEventAction.new()
		ev.action = "ui_cancel"
		ev.pressed = true
		panel.call("_unhandled_input", ev)
		await process_frame
	if get_first_node_in_group(GoalsPanel.GROUP) != null and not (get_first_node_in_group(GoalsPanel.GROUP) as Node).is_queued_for_deletion():
		_fail("⑤ Esc 로 안 닫힘")
	if paused:
		_fail("⑤ 닫았는데 멈춤 그대로")
	await _drop(sc)


## ④ 주간 도전 첫 것의 바탕을 목표만큼 낮춰 "끝남"으로 → 받기 켜짐 → 누르면 claimed
func _claim_go(panel: Node) -> void:
	var Weekly: GDScript = load("res://games/saga_go/data/weekly_goals.gd")
	var wk := get_first_node_in_group("go_weekly_goals")
	var prov := Callable(wk, "provider")
	var id: String = (Weekly.call("picks", Weekly.call("week")) as Array)[0]
	Weekly.call("ensure", prov)
	var stat := String(Weekly.call("stat_of", id))
	var st: Dictionary = root.get_node("PartyState").get("weekly_goals")
	(st["base"] as Dictionary)[stat] = int(prov.call(stat)) - int(Weekly.call("goal_of", id))
	st["claimed"] = []
	panel.call("close_panel")
	await process_frame
	GoalsPanel.open_for(current_scene, "go", "res://games/saga_go/ui/goals_adapter.gd")
	await process_frame
	panel = get_first_node_in_group(GoalsPanel.GROUP)
	var cb := panel.find_child("GoalsClaim", true, false) as Button
	if cb == null or cb.disabled:
		_fail("④ 주간 하나 끝났는데 받기 단추 꺼짐")
		return
	cb.pressed.emit()
	await process_frame
	if not bool(Weekly.call("claimed", id)):
		_fail("④ 받기 눌렀는데 %s 안 받음" % id)
	print("GOALS go 받기 %s → %s" % [id, Weekly.call("claimed", id)])


## G-0414 — 2나락 현상금·4종횡 일일 보상은 실제 공용 받기 단추로 한 번만 수령.
func _claim_manual(panel: Node) -> void:
	panel.call("close_panel")
	await process_frame
	var path := "user://probe_g0414_%s.json" % game
	var save: Node
	var saved: Dictionary = {}
	var expected_gold := 0
	if game == "dungeon":
		save = root.get_node("DungeonSaveState")
		var wallet: Node = root.get_node("DungeonGoldState")
		saved = {"pending": save.bounty_pending_gold, "gold": wallet.gold, "path": save.path_override, "pos": save.player_pos}
		save.path_override = path
		save.bounty_pending_gold = 73
		expected_gold = int(wallet.gold) + 73
	else:
		save = root.get_node("StorySaveState")
		saved = {"pending": save.daily_pending.duplicate(true), "path": save.path_override}
		save.path_override = path
		save.daily_pending = {"probe": {"name": "점검 보상", "exp": 0, "gold": 0, "scroll": ""}}
	var adapter := "res://games/saga_dungeon/ui/goals_adapter.gd" if game == "dungeon" else "res://games/saga_story/ui/goals_adapter.gd"
	GoalsPanel.open_for(current_scene, game, adapter)
	await process_frame
	panel = get_first_node_in_group(GoalsPanel.GROUP)
	var take := panel.find_child("GoalsClaim", true, false) as Button if panel != null else null
	if take == null or take.disabled:
		_fail("G-0414 받기 단추가 활성 상태로 안 보임")
	else:
		take.pressed.emit()
		await process_frame
		var remaining: int = int(save.bounty_pending_gold) if game == "dungeon" else (save.daily_pending as Dictionary).size()
		var saved_file := FileAccess.file_exists(ProjectSettings.globalize_path(path))
		if remaining != 0 or not saved_file:
			_fail("G-0414 누른 뒤 남은 대기=%d · 임시 저장=%s" % [remaining, saved_file])
		if game == "dungeon" and int(root.get_node("DungeonGoldState").gold) != expected_gold:
			_fail("G-0414 2나락 금 보상 한 번 지급 안 됨")
	var wallet: Node = root.get_node("DungeonGoldState") if game == "dungeon" else null
	if game == "dungeon":
		wallet.restore(int(saved.gold))
		save.bounty_pending_gold = int(saved.pending)
		save.player_pos = saved.pos
	else:
		save.daily_pending = saved.pending
	save.path_override = String(saved.path)
	for suffix in ["", ".bak", ".tmp"]:
		var test_path := ProjectSettings.globalize_path(path + suffix)
		if FileAccess.file_exists(test_path):
			DirAccess.remove_absolute(test_path)


func _drop(sc: Node) -> void:
	paused = false
	sc.queue_free()
	for _k in 3:
		await process_frame
