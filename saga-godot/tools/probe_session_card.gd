extends SceneTree

## G-0179 다섯 판 세션 마무리 카드(saga_core/ui/session_card.gd) "▶ 다음:" 줄(재미 표준 B "다음에 할 것 1개") 자동 점검.
## 부르는 다섯 곳(go save_button·dungeon test_room·forest/story save_button·realm month_button)은 같은 show() 를 쓰니 여기서 한 번만 본다.
##   godot --headless --path saga-godot --script res://tools/probe_session_card.gd
## ① 목표판 없음 → 라벨 = 제목+3, 닫기 단추 1 ② 목표판 set_goals("방 3/7 클리어", …) → 끝 라벨 "▶ 다음: 방 3/7 클리어"(금빛)
## ③ 🎯 줄이 빈 글 → 다음 줄 없음 ④ 넘긴 배열은 안 바뀜·얻은 것 3줄 그대로. 끝에 "PROBE session_card OK" 또는 "PROBE session_card FAIL n".

var SessionCard: GDScript   # autoload(CombatFeel)이 뜬 뒤 load — const preload 는 --script 모드에서 먼저 컴파일돼 깨진다
const LINES := ["금 +12", "새로 연 방 +2", "부대 3명"]

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _labels(card: CanvasLayer) -> Array:
	var out: Array = []
	for l in card.find_children("*", "Label", true, false):
		out.append((l as Label).text)
	return out


func _initialize() -> void:
	await process_frame
	SessionCard = load("res://saga_core/ui/session_card.gd")
	var given: Array = LINES.duplicate()

	# ① 목표판 없음
	var card: CanvasLayer = SessionCard.show(root, "저장했다 — 이번 세션", given)
	var labels := _labels(card)
	check(labels == ["저장했다 — 이번 세션"] + LINES and card.find_children("*", "Button", true, false).size() == 1, "목표판 없음 → 제목+3·닫기 1 %s" % str(labels))
	card.queue_free()

	# ② 목표판 있음
	var board := Label.new()
	board.set_script(load("res://saga_core/ui/goal_board.gd"))
	root.add_child(board)
	await process_frame
	board.set_goals("방 3/7 클리어", "금 +12", "—")
	card = SessionCard.show(root, "저장했다 — 이번 세션", given)
	labels = _labels(card)
	check(labels.size() == 5 and labels[4] == "▶ 다음: 방 3/7 클리어", "다음 줄 = 목표판 🎯 줄 %s" % str(labels))
	check(labels.slice(1, 4) == LINES, "얻은 것 3줄 그대로")
	var last := card.find_children("*", "Label", true, false)[4] as Label
	check(last.has_theme_color_override("font_color"), "다음 줄 금빛")
	check(given == LINES, "넘긴 배열은 안 바뀜")
	card.queue_free()

	# ③ 🎯 줄이 빈 글
	board.set_goals("", "s", "w")
	card = SessionCard.show(root, "정산", given)
	labels = _labels(card)
	check(labels.size() == 4, "빈 🎯 → 다음 줄 없음 %s" % str(labels))
	card.queue_free()

	board.queue_free()
	await process_frame
	print("PROBE session_card ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
