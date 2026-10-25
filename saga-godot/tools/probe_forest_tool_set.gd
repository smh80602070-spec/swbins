extends SceneTree

## G-0401 3마을 도구 등급·채집꾼 한 벌(웹 W-0439 짝) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_forest_tool_set.gd   → "PROBE forest_tool_set OK" / "FAIL n"
## ① 등급 이름 Lv1~5 일반·고급·희귀·영웅·전설 ② 잠자리채·삽 Lv4·5 레시피(차례대로만 — Lv3 → 4 → 5) · 바구니는 3 그대로
## ③ 한 벌: 둘 다 Lv3 이상 → 1(덤 +10%) · 둘 다 Lv5 → 2(풍성 ×1.25) · 하나라도 Lv2 → 0 · 바구니엔 안 걸림
## ④ 채집 굴림: 수확 축 없어도 한 벌 덤으로 하나 더가 나옴 · 덤 0·배율 1 이면 옛 굴림과 같음 ⑤ 손잡이 0 = 한 벌 끔 ⑥ 배선. 도구 Lv 는 끝에 되돌린다.

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var F: Node = root.get_node("ForestSaveState")
	var TG: GDScript = load("res://games/saga_forest/data/forest_tool_grade.gd")
	var CR: GDScript = load("res://games/saga_forest/data/forest_craft.gd")
	var saved := {"lv": (F.tool_lv as Dictionary).duplicate(), "items": (F.items as Dictionary).duplicate(), "gold": F.gold, "perks": (F.tool_perks as Dictionary).duplicate(true)}

	# ①
	check(TG.label(1) == "일반" and TG.label(3) == "희귀" and TG.label(5) == "전설" and TG.label(9) == "전설", "① 등급 이름 일반~전설")

	# ②
	F.tool_lv = {"basket": 3, "net": 3, "spade": 2}
	F.items = {"곤충": 30, "약초": 30, "꽃": 30, "화석": 30, "조개": 30, "광석": 30, "솔방울": 30}
	F.gold = 100000
	var why5: String = CR.why_not(F, CR.recipe("up_net_5"))
	var r4: Dictionary = CR.make(F, "up_net_4")
	var r5: Dictionary = CR.make(F, "up_net_5")
	check(why5.contains("지금 Lv3") and bool(r4.ok) and bool(r5.ok) and CR.tool_lv(F, "net") == 5 and CR.recipe("up_basket_4").is_empty(), "② 잠자리채 Lv3 → 4 → 5(차례대로) · 바구니 Lv4 없음")

	# ③
	var t_a: int = TG.set_tier(F)   # 잠자리채 5·삽 2
	F.tool_lv = {"basket": 1, "net": 3, "spade": 4}
	var t_b: int = TG.set_tier(F)
	var fx_b: Dictionary = TG.fx(F, "net")
	var fx_basket: Dictionary = TG.fx(F, "basket")
	F.tool_lv = {"basket": 1, "net": 5, "spade": 5}
	var t_c: int = TG.set_tier(F)
	var fx_c: Dictionary = TG.fx(F, "spade")
	check(t_a == 0 and t_b == 1 and is_equal_approx(float(fx_b.harvest_add), 0.1) and float(fx_b.bounty_mul) == 1.0 and float(fx_basket.harvest_add) == 0.0 and t_c == 2 and is_equal_approx(float(fx_c.bounty_mul), 1.25),
		"③ 한 벌: Lv5·2 → %d · 3·4 → %d(덤 +10%%) · 5·5 → %d(풍성 ×1.25) · 바구니 안 걸림" % [t_a, t_b, t_c])

	# ④
	var same := true
	var with_set := 0
	for i in 400:
		var seed := "d%d|gather_bug" % i
		var a: Dictionary = CR.gather_roll(["bounty"], seed, 0.0)
		var b: Dictionary = CR.gather_roll(["bounty"], seed, 0.0, 0.0, 1.0)
		same = same and a == b
		with_set += int(CR.gather_roll([], seed, 0.0, 0.1, 1.0).extra)
	check(same and with_set > 15 and with_set < 70, "④ 덤 0·배율 1 = 옛 굴림 · 수확 축 없이 한 벌 덤으로 하나 더 %d/400" % with_set)

	# ⑤
	OS.set_environment("SAGA_TOOL_SET", "0")
	var off: int = TG.set_tier(F)
	OS.set_environment("SAGA_TOOL_SET", "")
	check(off == 0, "⑤ 손잡이 0 = 한 벌 끔")

	# ⑥
	var gb := FileAccess.get_file_as_string("res://games/saga_forest/world/gatherable_builder.gd")
	var cb := FileAccess.get_file_as_string("res://games/saga_forest/world/craft_bench.gd")
	check(gb.contains("forest_tool_grade.gd\").fx(ForestSaveState, tool_key)") and cb.contains("ToolGrade.set_text(ForestSaveState)") and cb.contains("ToolGrade.label(int(r.lv))"), "⑥ 배선(채집 굴림·제작대 줄)")

	F.tool_lv = saved.lv
	F.items = saved.items
	F.gold = saved.gold
	F.tool_perks = saved.perks
	print("PROBE forest_tool_set ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
