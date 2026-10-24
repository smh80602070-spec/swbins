extends SceneTree

## G-0384 다섯 판 넘김 막(saga_core/ui/zone_cut.gd) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_zone_cut.gd   → "PROBE zone_cut OK" / "FAIL n"
## ① cut: 곧장 덮고 fn 은 같은 프레임(동기) ② 프레임 MIN_FRAMES 뒤 걷힘 시작 → FADE_SEC 뒤 투명·누름 통과
## ③ 같은 프레임 두 번 = 막 하나 ④ hold 하면 release 없어도 상한(SAGA_ZONE_CUT_MAX)에서 저절로 걷힘
## ⑤ 0 끔 = 막 없이 fn 만 ⑥ 배선 — 4종횡 넷·3마을 집·굴·5천하 지역이 zone_cut 을 부름.

const ZC := preload("res://saga_core/ui/zone_cut.gd")

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _frames(n: int) -> void:
	for i in n:
		await process_frame


func _initialize() -> void:
	await process_frame
	var called := [0]
	ZC.cut(self, func() -> void: called[0] += 1)
	var zc: Node = ZC.instance(self)
	check(called[0] == 1 and zc.is_covered() and zc.alpha() == 1.0, "① 덮고 fn 곧바로(동기)")
	ZC.cut(self, func() -> void: called[0] += 1)
	await _frames(1)
	var n := 0
	for ch in root.get_children():
		n += 1 if String(ch.name).begins_with(ZC.NODE_NAME) else 0
	check(n == 1 and called[0] == 2, "③ 같은 프레임 두 번 = 막 하나(%d)" % n)
	await _frames(ZC.MIN_FRAMES + 1)
	check(not zc.is_covered(), "② %d 프레임 뒤 걷힘 시작" % ZC.MIN_FRAMES)
	await create_timer(ZC.FADE_SEC + 0.15).timeout
	check(zc.alpha() == 0.0 and zc.get_child(0).mouse_filter == Control.MOUSE_FILTER_IGNORE, "② 걷힌 뒤 투명·누름 통과")

	OS.set_environment("SAGA_ZONE_CUT_MAX", "0.3")
	ZC.cut(self, func() -> void: pass)
	zc.hold()
	await _frames(ZC.MIN_FRAMES + 2)
	var still: bool = zc.is_covered()
	await create_timer(0.45).timeout
	check(still and not zc.is_covered(), "④ hold 는 프레임 지나도 덮음 → 상한 0.3초에서 저절로 걷힘")
	OS.set_environment("SAGA_ZONE_CUT_MAX", "")

	await create_timer(ZC.FADE_SEC + 0.1).timeout
	OS.set_environment("SAGA_ZONE_CUT", "0")
	var c2 := [0]
	ZC.cut(self, func() -> void: c2[0] += 1)
	check(c2[0] == 1 and not zc.is_covered() and zc.alpha() == 0.0, "⑤ 0 끔 = fn 만")
	OS.set_environment("SAGA_ZONE_CUT", "")

	var wired := {
		"res://games/saga_story/world/story_portal.gd": "change_scene(",
		"res://games/saga_story/world/story_field.gd": "change_scene(",
		"res://games/saga_story/world/story_labyrinth.gd": "change_scene(",
		"res://games/saga_story/world/story_labyrinth_gate.gd": "change_scene(",
		"res://games/saga_forest/world/forest_house.gd": "zone_cut.gd",
		"res://games/saga_forest/world/forest_cave_view.gd": "zone_cut.gd",
		"res://games/saga_realm/world/realm_region_view.gd": "zone_cut.gd",
	}
	var miss: Array = []
	for path in wired:
		var src := FileAccess.get_file_as_string(path)
		if not (src.contains("zone_cut.gd") and src.contains(String(wired[path]))):
			miss.append(String(path).get_file())
	check(miss.is_empty(), "⑥ 배선 일곱 %s" % ("" if miss.is_empty() else str(miss)))

	print("PROBE zone_cut ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
