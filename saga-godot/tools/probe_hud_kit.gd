extends SceneTree

## G-0297 HUD 단추 틀 자동 점검(웹 W-0257 짝) —
##   godot --headless --path saga-godot --script res://tools/probe_hud_kit.gd   → "PROBE hud_kit OK" / "FAIL n"
## ① hud_theme(판) Button normal = 반으로 줄인 9-slice(모서리 12) ② 네 판 HUD 바로 밑 단추 = 그 판 hud_theme(MenuHook)
## ③ 1만리 윗줄 여는 단추(인물 (C) 등) = go hud_theme · 저장·사진은 그대로(E·Q 겹침) ④ SAGA_UI_KIT=0 이면 null

const UiKit := preload("res://saga_core/ui/ui_kit.gd")
const SCENES := {"go": "res://games/saga_go/world/TestVillage.tscn", "dungeon": "res://games/saga_dungeon/world/TestRoom.tscn",
	"forest": "res://games/saga_forest/world/TestVillageForest.tscn", "story": "res://games/saga_story/world/SinyaField.tscn",
	"realm": "res://games/saga_realm/world/TestCity.tscn"}

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _init() -> void:
	await process_frame
	for g in SCENES:
		var th := UiKit.hud_theme(g)
		var sb := th.get_stylebox("normal", "Button") if th else null
		if not (sb is StyleBoxTexture) or not is_equal_approx((sb as StyleBoxTexture).texture_margin_left, 12.0):
			_fail("① %s hud_theme 모서리 %s" % [g, (sb as StyleBoxTexture).texture_margin_left if sb is StyleBoxTexture else "없음"])
	for g in SCENES:
		var sc := (load(SCENES[g]) as PackedScene).instantiate()
		root.add_child(sc)
		current_scene = sc
		for _i in 30:
			await process_frame
		var th := UiKit.hud_theme(g)
		var n := 0
		if g == "go":
			for nm in ["CharacterScreen", "CookingScreen", "CodexScreen"]:
				var node := sc.find_child(nm, true, false)
				for b in node.find_children("*", "Button", true, false) if node else []:
					if (b as Button).text.contains("(") and (b.get_parent() == node or (b.get_parent() is CanvasLayer and b.get_parent().get_parent() == node)):
						n += 1
						if (b as Button).theme != th:
							_fail("③ 1만리 %s 여는 단추 틀 없음" % nm)
			## G-0301 저장·사진도 같은 틀 · E·Q 구슬(키보드 판)과 안 겹침
			var orbs: Array = []
			for c in sc.find_children("*", "Control", true, false):
				if c.get("key_text") in ["E", "Q"]:
					orbs.append(c)
			for nm in ["SaveButton", "PhotoModeButton"]:
				var sb := sc.get_node_or_null("MobileHUD/" + nm) as Button
				if sb == null:
					continue
				if sb.theme != th:
					_fail("③ 1만리 %s 틀 없음" % nm)
				for o: Control in orbs:
					if o.get_global_rect().intersects(sb.get_global_rect()):
						_fail("③ 1만리 %s 가 %s 구슬과 겹침" % [nm, o.get("key_text")])
			print("HUD go orbs=%d" % orbs.size())
		else:
			var hook := sc.find_child("MenuHook", true, false)
			var hud := hook.get_parent() if hook else null
			for c in hud.get_children() if hud else []:
				if c is Button:
					n += 1
					if (c as Button).theme != th:
						_fail("② %s %s 틀 없음" % [g, c.name])
		if n == 0:
			_fail("②③ %s 단추를 못 찾음" % g)
		print("HUDKIT %s 단추 %d" % [g, n])
		sc.queue_free()
		for _k in 3:
			await process_frame
	OS.set_environment("SAGA_UI_KIT", "0")
	if UiKit.hud_theme("dungeon") != null:
		_fail("④ 꺼도 테마")
	OS.set_environment("SAGA_UI_KIT", "")
	print("PROBE hud_kit ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
