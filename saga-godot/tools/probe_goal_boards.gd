extends SceneTree

## 다섯 판 목표판(saga_core/ui/goal_board.gd 라벨 + 판별 피드: dungeon world/test_room.gd·forest world/forest_village.gd·story ui/goal_board_feed.gd·realm world/realm_city.gd 의 `_refresh_goal_board`) 자동 점검 — 라벨 하나와 각 판 상태만으로 세 줄(지금·이번 세션·이번 주)이 맞게 조립되는지 본다. 씬 전체는 안 세운다(함수만 붙인 노드).
##   godot --headless --path saga-godot --script res://tools/probe_goal_boards.gd
## ① 라벨: 처음엔 빈 글 · "goal_board" 그룹 · set_goals 가 "🎯 지금 / ⏱ 세션 / 📅 주" 세 줄
## ② 사가나락: 난입 중 > 부적 던전 > 방 클리어 k/7 순으로 "지금" · 세션 = 금 증가 + 새로 연 방 수 · 주 "—"
## ③ 사가마을: 주민 부탁 완수/6 · 세션 = 금·채집 증가 ④ 사가종횡: 사명 완수/13 · 세션 = 처치·금 증가 ⑤ 사가천하: 성 n/107 편입 · 세션 = 금·편입 증가 · 셋째 줄 = 가장 가까운 승리 조건 진척 %(통일·문화·외교, 결과가 있으면 "승리 달성").
## 상태는 끝에 되돌린다. 끝에 "PROBE goal_boards OK" 또는 "PROBE goal_boards FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


## 어떤 판 스크립트의 함수만 쓰려고, 이미 트리에 있는 빈 노드에 스크립트를 얹는다(_ready 는 안 돈다).
func _host(script_path: String, base3d: bool) -> Node:
	var n: Node = Node3D.new() if base3d else Node.new()
	root.add_child(n)
	n.set_script(load(script_path))
	return n


func _initialize() -> void:
	await process_frame
	var board := Label.new()
	board.set_script(load("res://saga_core/ui/goal_board.gd"))
	root.add_child(board)
	await process_frame

	# ① 라벨
	check(board.text == "" and board.is_in_group("goal_board"), "처음엔 빈 글 · goal_board 그룹")
	board.set_goals("지금 할 일", "이번 세션", "이번 주")
	check(board.text == "🎯 지금 할 일\n⏱ 이번 세션\n📅 이번 주" and board.text.count("\n") == 2, "set_goals: 세 줄(🎯 지금 · ⏱ 세션 · 📅 주)")

	# ② 사가나락
	var DH: Node = root.get_node("DungeonHordeState")
	var DS: Node = root.get_node("DungeonSigilState")
	var DSave: Node = root.get_node("DungeonSaveState")
	var DG: Node = root.get_node("DungeonGoldState")
	var saved_d := {"horde": DH.active, "wave": DH.wave, "sig": DS.sigils.duplicate(true), "act": DS.active_index, "rooms": DSave.rooms_cleared.duplicate(), "gold": DG.gold}
	var room: Node = _host("res://games/saga_dungeon/world/test_room.gd", true)
	var rc: int = room.ROOM_COUNT
	DH.active = false
	DS.restore([], -1, 0, 1)
	DSave.rooms_cleared.assign([true, false, true])
	room._session_start_cleared = 1
	DG.gold = 500
	DG.begin_session()
	DG.gold = 740
	board.text = ""
	room._refresh_goal_board()
	check(board.text == "🎯 방 클리어 2/%d\n⏱ 금 +240 · 새로 연 방 +1\n📅 —" % rc, "사가나락: 방 클리어 2/7 · 금 +240 · 새로 연 방 +1 · 주 —")
	DS.add_sigil(4)
	DS.activate(0)
	room._refresh_goal_board()
	var sig_line: String = board.text.split("\n")[0]
	check(sig_line == "🎯 부적 던전 — 티어 %d" % int(DS.sigils[0].tier), "부적 던전이 켜지면 그쪽이 우선: " + sig_line)
	DH.active = true
	DH.wave = 5
	room._refresh_goal_board()
	check(board.text.split("\n")[0] == "🎯 난입 — 파도 5", "난입 중이면 난입이 가장 우선")
	DH.active = saved_d.horde
	DH.wave = saved_d.wave
	DS.restore(saved_d.sig, saved_d.act, 0, 1)
	DSave.rooms_cleared.assign(saved_d.rooms)
	DG.gold = saved_d.gold
	room.queue_free()

	# ③ 사가마을
	var F: Node = root.get_node("ForestSaveState")
	var saved_f := {"q": F.quests_done.duplicate(), "gold": F.gold, "items": F.items.duplicate()}
	var village: Node = _host("res://games/saga_forest/world/forest_village.gd", true)
	F.quests_done = {"npc_keeper": true, "npc_angler": true}
	F.items = {"꽃": 4}
	F.gold = 100
	F.begin_session()
	F.gold = 160
	F.items = {"꽃": 4, "물고기": 3}
	village._refresh_goal_board()
	check(board.text == "🎯 주민 부탁 2/6\n⏱ 골드 +60 · 채집 +3\n📅 —", "사가마을: 주민 부탁 2/6 · 골드 +60 · 채집 +3 · 주 —")
	F.quests_done = saved_f.q
	F.gold = saved_f.gold
	F.items = saved_f.items
	village.queue_free()

	# ④ 사가종횡
	var S: Node = root.get_node("StorySaveState")
	var Combat: GDScript = load("res://games/saga_story/data/story_combat.gd")
	var saved_s := {"q": S.quests_done.duplicate(), "kills": S.kills, "gold": S.gold}
	var feed: Node = _host("res://games/saga_story/ui/goal_board_feed.gd", false)
	S.quests_done = {"q_first": true, "q_gather1": true, "q_field": true}
	S.kills = 10
	S.gold = 0
	S.begin_session()
	S.kills = 17
	S.gold = 350
	feed._process(0.0)
	check(board.text == "🎯 사명 완수 3/%d\n⏱ 처치 +7 · 골드 +350\n📅 —" % Combat.QUESTS.size(), "사가종횡: 사명 완수 3/13 · 처치 +7 · 골드 +350 · 주 —")
	S.quests_done = saved_s.q
	S.kills = saved_s.kills
	S.gold = saved_s.gold
	feed.queue_free()

	# ⑤ 사가천하
	var R: Node = root.get_node("RealmSaveState")
	var Cities: GDScript = load("res://games/saga_realm/data/realm_cities.gd")
	var saved_r := {"cities": R.cities.duplicate(true), "gold": R.gold, "result": R.result, "correct": R.quiz.get("correct", 0), "streak": R.diplomacy_peace_streak}
	var city: Node = _host("res://games/saga_realm/world/realm_city.gd", true)
	var total: int = Cities.CITIES.size() + Cities.ENEMY_CITIES.size()
	R.gold = 1000
	R.begin_session()
	R.gold = 1600
	R.cities["xiaopei"] = {"x": 1}
	R.quiz.correct = 0
	R.diplomacy_peace_streak = 0
	R.result = ""
	city._refresh_goal_board()
	check(board.text == "🎯 성 4/%d 편입\n⏱ 골드 +600 · 편입 +1\n📅 천하통일 진척 3%%" % total, "사가천하: 성 4/107 편입 · 골드 +600 · 편입 +1 · 통일 3%%(4/107)")
	R.quiz.correct = 100
	city._refresh_goal_board()
	check(board.text.split("\n")[2] == "📅 문화 진척 50%", "문화 진척이 더 크면 그쪽(정답 100/200 = 50%)")
	R.diplomacy_peace_streak = 27
	city._refresh_goal_board()
	check(board.text.split("\n")[2] == "📅 외교 진척 75%", "외교 진척이 가장 크면 그쪽(27/36 = 75%)")
	R.diplomacy_peace_streak = 99
	R.quiz.correct = 9999
	city._refresh_goal_board()
	check(board.text.split("\n")[2] == "📅 문화 진척 100%", "진척은 100%에서 멈춤(여럿이면 먼저 큰 것)")
	R.result = "win_culture"
	city._refresh_goal_board()
	check(board.text.split("\n")[2] == "📅 승리 달성", "결과가 나면 승리 달성")
	R.result = saved_r.result
	R.cities = saved_r.cities
	R.gold = saved_r.gold
	R.quiz.correct = saved_r.correct
	R.diplomacy_peace_streak = saved_r.streak
	city.queue_free()
	board.queue_free()
	print("PROBE goal_boards ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
