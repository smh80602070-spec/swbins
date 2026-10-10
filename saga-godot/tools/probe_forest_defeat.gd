extends SceneTree

## 사가마을 실패와 회복(재미 표준 F, SAGA-DESIGN §3) 측정 — 마을에서 잃는 자리 둘(순무가 썩음·낚시 놓침)을 고정 날짜로 일으켜 "얼마 잃나·몇 번 눌러 다시 하나·얼마 만에 되찾나"를 숫자로 낸다(G-0181). 규칙·수치는 안 고친다.
##   godot --headless --path saga-godot --script res://tools/probe_forest_defeat.gd
## 마을엔 죽음·싸움이 없다(data/scenario.gd "싸움·실패 없음") · 생물(world/forest_creature.gd)은 달아나기만 하고 잡는 규칙이 없다 — F 는 이 둘이 전부.
## ① 순무 썩음 셋(금 10000·50000·100000): 일요일 오전에 살 수 있는 만큼(900 상한·10 단위) 사고 → 다음 주 일요일 → 썩음 → 팔기 · 판 값 = 개수×10 · 잃은 금 %(산 값 대비·산 전 금 대비)
## ② 순무 재도전: 썩은 채로 사면 거절 · 판 뒤 같은 장(일요일 오전)에 다시 사면 ok — 조작 수(팔기 1 + 사기 1)·기다린 날
## ③ 낚시 놓침 셋(성급·늦음·입질 놓침): IDLE 로 돌아오고 물고기 수 그대로(잃는 것 0) · 다시 낚기까지 조작 2(던지기·챔질)·최장 대기 ms · 제때 챔질하면 +1(대조)
## FAIL 은 구조(썩음 판정·판 값 공식·물고기 수 불변·IDLE 복귀)만 — %·조작 수가 F 기준(비용 10~20%·조작 ≤3)을 넘으면 "F기준 밖"만 찍는다. 상태·날짜 강제는 끝에 되돌린다.
## 끝에 "PROBE forest_defeat OK" 또는 "PROBE forest_defeat FAIL n".

const Day := preload("res://games/saga_forest/data/forest_day.gd")
const Turnip := preload("res://games/saga_forest/data/forest_turnip.gd")

const SAVED_VARS := ["items", "gold", "turnip"]
const GOLDS := [10000, 50000, 100000]
const SUNDAY := 3  # 1970-01-04 = 일요일(probe_forest_rules 와 같음)

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
	var saved := {}
	for v in SAVED_VARS:
		var cur: Variant = F.get(v)
		saved[v] = cur.duplicate(true) if (cur is Dictionary or cur is Array) else cur

	# ① 순무 썩음 · ② 재도전
	var summary: Array = []
	for g: int in GOLDS:
		print("— 금 %d" % g)
		Day.force_epoch_day(SUNDAY)
		Turnip.force_morning(true)
		F.turnip = {}
		F.gold = g
		var price: int = Turnip.buy_price()
		var n: int = mini(Turnip.MAX_BUY, int(floor(float(g) / float(price) / Turnip.UNIT)) * Turnip.UNIT)
		var why: String = F.buy_turnip(n)
		var paid: int = n * price
		check(why == "" and int(F.turnip.n) == n and F.gold == g - paid, "일요일 오전 %d개 삼(개당 %d · 💰%d)" % [n, price, paid])
		Day.force_epoch_day(SUNDAY + 7)
		Turnip.force_morning(true)
		check(F.turnip_rotten() and F.turnip_now_price() == Turnip.ROT_PRICE, "다음 주 일요일 — 썩음, 값 %d" % Turnip.ROT_PRICE)
		var rebuy_rotten: String = F.buy_turnip(Turnip.UNIT)
		check(rebuy_rotten != "" and "썩은" in rebuy_rotten, "썩은 채로 사면 거절(%s)" % rebuy_rotten)
		var before_sell: int = F.gold
		F.sell_turnip()
		var revenue: int = F.gold - before_sell
		check(revenue == n * Turnip.ROT_PRICE and not F.has_turnip(), "판 값 = %d×%d = %d" % [n, Turnip.ROT_PRICE, revenue])
		var lost: int = paid - revenue
		var pct_paid := 100.0 * float(lost) / float(paid)
		var pct_gold := 100.0 * float(lost) / float(g)
		var cost_in := pct_gold >= 10.0 and pct_gold <= 20.0
		print("  잰값 잃은 금 %d — 산 값 대비 %.1f%% · 산 전 금 대비 %.1f%%%s" % [lost, pct_paid, pct_gold, "" if cost_in else " (F기준 밖: 10~20%)"])
		# 같은 장에 다시 — 팔기 1 + 사기 1
		var again: String = F.buy_turnip(Turnip.UNIT)
		var ops := 2
		check(again == "" and F.has_turnip() and not F.turnip_rotten(), "판 뒤 같은 장(일요일 오전)에 다시 삼")
		print("  잰값 재도전 조작 %d (팔기 → 사기) · 기다린 날 0" % ops)
		summary.append("%d: 비용 %.1f%%(산 값 %.1f%%)·조작 %d" % [g, pct_gold, pct_paid, ops])
		F.turnip = {}

	# ③ 낚시 놓침
	print("— 낚시")
	var Spot: GDScript = load("res://games/saga_forest/world/fishing_spot.gd")
	var spot: Node3D = Spot.new()
	root.add_child(spot)
	await process_frame
	var label: String = Spot.FISH_ITEM_LABEL
	var fish0: int = F.item_count(label)
	var now := Time.get_ticks_msec()
	# 성급 — 입질 전에 챔질
	spot._state = spot.State.LINE_OUT
	spot._bite_at_ms = now + 100000
	spot._ends_at_ms = now + 100000 + Spot.BITE_WINDOW_MS
	spot._hook()
	check(spot._state == spot.State.IDLE and F.item_count(label) == fish0, "성급: IDLE · 물고기 %d 그대로" % fish0)
	# 늦음 — 창이 지난 뒤 챔질
	now = Time.get_ticks_msec()
	spot._state = spot.State.LINE_OUT
	spot._bite_at_ms = now - 10000
	spot._ends_at_ms = now - 10000 + Spot.BITE_WINDOW_MS
	spot._hook()
	check(spot._state == spot.State.IDLE and F.item_count(label) == fish0, "늦음: IDLE · 물고기 그대로")
	# 입질 놓침 — 챔질 안 하고 유예까지 지남
	now = Time.get_ticks_msec()
	spot._state = spot.State.LINE_OUT
	spot._bite_notified = true
	spot._bite_at_ms = now - 10000
	spot._ends_at_ms = now - 10000 + Spot.BITE_WINDOW_MS
	spot._process(0.0)
	check(spot._state == spot.State.IDLE and F.item_count(label) == fish0, "입질 놓침: IDLE · 물고기 그대로")
	# 대조 — 창 안에 챔질하면 +1
	now = Time.get_ticks_msec()
	spot._state = spot.State.LINE_OUT
	spot._bite_at_ms = now - 10
	spot._ends_at_ms = now + 10000
	spot._hook()
	check(spot._state == spot.State.IDLE and F.item_count(label) == fish0 + 1, "대조: 창 안 챔질 → 물고기 +1")
	var wait_max: int = Spot.CAST_MIN_MS + Spot.CAST_VAR_MS + Spot.BITE_WINDOW_MS
	print("  잰값 놓침 비용 0(물고기·미끼 그대로) · 재도전 조작 2(던지기 → 챔질) · 최장 대기 %d ms" % wait_max)
	summary.append("낚시: 비용 0·조작 2·대기 ≤%.1f초" % (float(wait_max) / 1000.0))
	spot.queue_free()

	print("잰값 요약 — ", " | ".join(summary))
	# 되돌리기
	Day.force(null)
	Day.force_epoch_day(null)
	Turnip.force_morning(null)
	for v in SAVED_VARS:
		F.set(v, saved[v])
	print("PROBE forest_defeat ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
