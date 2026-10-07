extends SceneTree

## G-0039 목표판이 읽히게(saga_core/ui/goal_board.gd 글자·자리 · 사가종횡 사냥터 world/story_field.gd 가로 UI 배율) 자동 점검. 화면 없이 설정값만.
##   godot --headless --path saga-godot --script res://tools/probe_goal_readable.gd
## ① 라벨: 22px·흰색 불투명·외곽선 6·폭 ≥ 420·위 ≥ 110(맨 위 알림 띠 아래)·세 줄 높이·줄바꿈 켬 ② 다섯 판 HUD 씬의 GoalBoard 가 이 스크립트
## ③ 사가종횡 사냥터 씬 넷의 루트(story_field.gd)와 마을(story_town.gd)이 orientation_scale 을 단다 ④ 사가나락 기술 단추 줄 위 여백 ≥ 목표판 아래.
## 끝에 "PROBE goal_readable OK" 또는 "PROBE goal_readable FAIL n".

const GOAL := "res://saga_core/ui/goal_board.gd"
const HUDS := ["res://games/saga_go/ui/MobileHUD.tscn", "res://games/saga_dungeon/ui/DungeonHUD.tscn", "res://games/saga_forest/ui/ForestHUD.tscn",
	"res://games/saga_story/ui/StoryHUD.tscn", "res://games/saga_realm/ui/RealmHUD.tscn"]
const HUNT := ["res://games/saga_story/world/CaveHuntGround.tscn", "res://games/saga_story/world/ForestHuntGround.tscn",
	"res://games/saga_story/world/GorgeHuntGround.tscn", "res://games/saga_story/world/TestField.tscn"]

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	# ① 라벨 — HUD 씬과 같은 자리(16px·-300~-10·50~135)에서 시작해 덮어쓰는지
	var L := Label.new()
	L.anchor_left = 1.0
	L.anchor_right = 1.0
	L.offset_left = -300.0
	L.offset_right = -10.0
	L.offset_top = 50.0
	L.offset_bottom = 135.0
	L.add_theme_font_size_override("font_size", 16)
	L.set_script(load(GOAL))
	root.add_child(L)
	await process_frame
	var fs := L.get_theme_font_size("font_size")
	var col := L.get_theme_color("font_color")
	check(fs == 22 and col == Color(1, 1, 1, 1) and L.get_theme_constant("outline_size") == 6, "글자 22px·흰색 불투명·외곽선 6 (지금 %dpx·%s)" % [fs, col])
	check(L.offset_right - L.offset_left >= 420.0 and L.offset_right == -10.0 and L.offset_top >= 110.0 and L.offset_bottom - L.offset_top >= 22 * 3 * 1.4 and L.autowrap_mode != TextServer.AUTOWRAP_OFF,
		"폭 %.0f(≥420, 오른쪽 붙임) · 위 %.0f(≥110) · 높이 %.0f(세 줄) · 줄바꿈" % [L.offset_right - L.offset_left, L.offset_top, L.offset_bottom - L.offset_top])
	L.call("set_goals", "가", "나", "다")
	check(L.text == "🎯 가\n⏱ 나\n📅 다", "세 줄 조립 그대로")
	var goal_bottom := L.offset_bottom
	L.free()
	# ② HUD 다섯
	var miss := []
	for h in HUDS:
		var t := FileAccess.get_file_as_string(String(h))
		if not (t.contains(GOAL) and t.contains("[node name=\"GoalBoard\"")):
			miss.append(String(h).get_file())
	check(miss.is_empty(), "다섯 판 HUD 의 GoalBoard 가 공용 라벨%s" % ("" if miss.is_empty() else " — 빠짐 %s" % [miss]))
	# ③ 사가종횡 가로 UI 배율
	var bad := []
	for s in HUNT:
		if not FileAccess.get_file_as_string(String(s)).contains("story_field.gd"):
			bad.append(String(s).get_file())
	var field_ok := FileAccess.get_file_as_string("res://games/saga_story/world/story_field.gd").contains("orientation_scale.gd")
	var town_ok := FileAccess.get_file_as_string("res://games/saga_story/world/story_town.gd").contains("orientation_scale.gd")
	check(bad.is_empty() and field_ok and town_ok, "사가종횡 사냥터 넷(story_field)·마을(story_town) 이 가로 UI 배율을 단다%s" % ("" if bad.is_empty() else " — 루트가 다름 %s" % [bad]))
	# ④ 사가나락 단추 줄
	var Col: GDScript = load("res://games/saga_dungeon/ui/hud_column_layout.gd")
	check(float(Col.TOP_MARGIN) >= goal_bottom, "사가나락 기술 단추 줄 위 여백 %.0f ≥ 목표판 아래 %.0f" % [Col.TOP_MARGIN, goal_bottom])
	print("PROBE goal_readable ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
