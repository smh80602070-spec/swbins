extends SceneTree

## 사가의숲 월드 규칙(world/villager_builder.gd 주민·부탁·하트·세배·판매가, world/forest_planting.gd 꽃 교배·심기, world/fishing_spot.gd 낚시 입질, world/forest_landmarks.gd 발견 표지) 자동 점검 — 노드를 만들어 규칙 함수만 부른다(그림은 안 봄). 날짜는 ForestDay.force·force_epoch_day 로 붙든다.
##   godot --headless --path saga-godot --script res://tools/probe_forest_world.gd
## ① 주민 6: 키 유일·자리가 풀밭·모델 파일·부탁 종류(bagcat/meetnpc)·선물 갈래·탐험가 만남 수 = 주민-1·상인 삽 700·판매 기준가 · 대화: 하루 한 번 하트 +1·세배(500+하트×150, 사람마다 하루 한 번, +2)·부탁(가방 속 개수 되면 소비하고 보상 + 하트 +2, 한 번만)·10♥ 기념 사례금 2000 한 번
## ② 교배: 풀밭에만·꽃이 있어야·너무 붙으면 거절(2.7m)·곁에 꽃이 없으면 1단 아님·곁에 있으면 자리 해시 0.45 넘을 때 교배꽃·교배 곁이면 0.7 넘을 때 진교배꽃 · 3일 뒤 하루 한 번 꺾음(등급 이름으로 얻음)·옛 세이브 호환(_tier_of)
## ③ 낚시: 던지면 입질 1.2~3.5초 · 창 0.7초 · 일찍 당기면 달아남·창 안이면 물고기 +1·늦으면 놓침
## ④ 발견 표지 11: id 유일·칸이 지도 안이고 서로 안 겹침. 상태는 끝에 되돌린다. 끝에 "PROBE forest_world OK" 또는 "PROBE forest_world FAIL n".

const Day := preload("res://games/saga_forest/data/forest_day.gd")
const VMap := preload("res://games/saga_forest/data/village_map.gd")
const Festival := preload("res://games/saga_forest/data/forest_festival.gd")

const SAVED_VARS := ["items", "used", "gold", "met", "quests_done", "affinity", "affinity_day", "affinity_gained_today", "talked", "gifted", "heart_reward_10", "bow", "planted", "museum_donated"]

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


## 격자 칸 가운데의 월드 좌표.
func _cell(gx: int, gy: int) -> Vector3:
	var s: Vector2i = VMap.size()
	return Vector3((float(gx) + 0.5 - s.x * 0.5) * VMap.TILE_SIZE, 0.0, (float(gy) + 0.5 - s.y * 0.5) * VMap.TILE_SIZE)


func _initialize() -> void:
	await process_frame
	seed(20260824)
	var F: Node = root.get_node("ForestSaveState")
	var saved := {}
	for v in SAVED_VARS:
		var cur: Variant = F.get(v)
		saved[v] = cur.duplicate(true) if (cur is Dictionary or cur is Array) else cur
	var VB: GDScript = load("res://games/saga_forest/world/villager_builder.gd")
	var Plant: GDScript = load("res://games/saga_forest/world/forest_planting.gd")
	var Fish: GDScript = load("res://games/saga_forest/world/fishing_spot.gd")
	var Land: GDScript = load("res://games/saga_forest/world/forest_landmarks.gd")

	# ① 주민
	var vil: Array = VB.VILLAGERS
	var ids := {}
	var vil_ok: bool = vil.size() == 6 and int(VB.ROSTER_SIZE) == 6
	for v: Dictionary in vil:
		ids[v.id] = true
		var g: Vector2i = v.grid
		vil_ok = vil_ok and VMap.tile_at(g.x, g.y) == "." and ResourceLoader.exists(String(v.glb)) and VB.GIFT_CATS.has(String(v.gift_like)) and String(v.name) != "" and String(v.line) != "" and String(v.heart_line) != ""
		var q: Dictionary = v.quest
		vil_ok = vil_ok and ["bagcat", "meetnpc"].has(String(q.type)) and int(q.reward) > 0 and int(q.count) > 0 and String(q.title) != ""
		if q.type == "bagcat":
			vil_ok = vil_ok and VB.GIFT_CATS.has(String(q.item_label)) and VB.SELL_BASE_PRICE.has(String(q.item_label))
		else:
			vil_ok = vil_ok and int(q.count) == vil.size() - 1
	check(vil_ok and ids.size() == 6, "주민 6: 키 유일 · 자리가 풀밭 · 모델 파일 · 선물 갈래 · 부탁 종류/보상 · 탐험가 만남 수 5")
	var merchant: Dictionary = {}
	for v: Dictionary in vil:
		if v.id == "npc_merchant":
			merchant = v
	var sp: Dictionary = merchant.sells_tool
	var price_ok := true
	for cat in ["과일", "솔방울", "광석", "꽃", "곤충", "물고기", "약초", "교배꽃", "진교배꽃"]:
		price_ok = price_ok and VB.SELL_BASE_PRICE.has(cat) and int(VB.SELL_BASE_PRICE[cat]) > 0
	for cat in VB.GIFT_CATS:
		price_ok = price_ok and VB.SELL_BASE_PRICE.has(cat)
	check(sp.key == "spade" and sp.price == 700 and price_ok and VB.SELL_BASE_PRICE["교배꽃"] == VB.SELL_BASE_PRICE["꽃"] * 4 and VB.SELL_BASE_PRICE["진교배꽃"] == VB.SELL_BASE_PRICE["꽃"] * 10, "상인 삽 700 · 판매 기준가 · 교배꽃은 꽃의 4배·진교배꽃은 10배")
	var vb: Node = VB.new()
	root.add_child(vb)
	await process_frame
	var by_id := {}
	for v: Dictionary in vil:
		by_id[v.id] = v
	var keeper: Dictionary = by_id.npc_keeper
	F.affinity = {}
	F.affinity_day = {}
	F.affinity_gained_today = {}
	F.talked = {}
	F.quests_done = {}
	F.items = {}
	F.gold = 0
	F.bow = {}
	F.heart_reward_10 = {}
	F.met = {}
	Day.force(20260210)
	vb._talk(keeper)
	check(F.heart("npc_keeper") == 1 and F.talked_today("npc_keeper") and F.gold == 0, "첫 대화: 하트 +1(하루 한 번) · 부탁을 못 채웠으면 보상 없음")
	vb._talk(keeper)
	check(F.heart("npc_keeper") == 1, "같은 날 다시 말해도 하트는 안 오름")
	check(vb._quest_progress(keeper.quest) == {"have": 0, "need": 5} and vb._quest_progress(by_id.npc_explorer.quest) == {"have": 0, "need": 5}, "부탁 진행도: 가방 속 개수 · 만난 주민 수")
	F.items["과일"] = 7
	Day.force(20260211)
	vb._talk(keeper)
	check(F.is_quest_done("npc_keeper") and F.item_count("과일") == 2 and F.gold == 300 and F.heart("npc_keeper") == 1 + 1 + 2, "부탁 완수: 과일 5개 소비 · 금 +300 · 하트 +1(대화)+2(부탁)")
	Day.force(20260212)
	vb._talk(keeper)
	check(F.gold == 300 and F.item_count("과일") == 2 and F.heart("npc_keeper") == 5, "마친 부탁은 다시 안 줌(대화 하트만 +1)")
	# 설날
	Day.force(20260101)
	var herb: Dictionary = by_id.npc_herbalist
	F.affinity["npc_herbalist"] = 2
	var g0: int = F.gold
	vb._talk(herb)
	check(Festival.is_new_year() and F.gold == g0 + 500 + 3 * 150 and F.heart("npc_herbalist") == 2 + 1 + 2 and F.has_bowed_today("npc_herbalist"), "설날 세배: 금 +(500+하트×150)(하트 3 → 950) · 하트 +2")
	var g1: int = F.gold
	vb._talk(herb)
	check(F.gold == g1, "세배는 사람마다 하루 한 번")
	Day.force(20260213)
	# 만남 부탁·10♥ 기념
	var explorer: Dictionary = by_id.npc_explorer
	for k in ["npc_keeper", "npc_angler", "npc_merchant", "npc_herbalist", "npc_wanderer"]:
		F.mark_met(k)
	F.affinity["npc_explorer"] = 7
	F.affinity_day = {}
	F.affinity_gained_today = {}
	var g2: int = F.gold
	vb._talk(explorer)
	check(F.is_quest_done("npc_explorer") and F.heart("npc_explorer") == 10 and F.heart_reward_10.get("npc_explorer", false), "만남 부탁 완수 + 10♥ 에 닿으면 기념 사례금(+500+2000 별도) 한 번")
	check(F.gold == g2 + 500 + 2000, "10♥ 사례금 2000 (합계 %d)" % (F.gold - g2))
	var g3: int = F.gold
	F.affinity["npc_explorer"] = 10
	vb._check_heart_reward(explorer)
	check(F.gold == g3, "10♥ 사례금은 한 번뿐")
	vb.queue_free()
	Day.force(null)

	# ② 교배
	var plant: Node3D = Plant.new()
	root.add_child(plant)
	var player := Node3D.new()
	player.add_to_group("player")
	root.add_child(player)
	await process_frame
	F.planted = []
	F.items = {"꽃": 20}
	F.used = {}
	Day.force_epoch_day(100)
	player.global_position = _cell(0, 0)  # 산(T) — 풀밭 아님
	plant._try_plant()
	check(F.planted.is_empty() and F.item_count("꽃") == 20, "풀밭이 아니면 못 심음(꽃 불변)")
	F.items = {}
	player.global_position = _cell(5, 5)
	plant._try_plant()
	check(F.planted.is_empty(), "꽃이 없으면 못 심음")
	F.items = {"꽃": 20}
	plant._try_plant()
	check(F.planted.size() == 1 and F.item_count("꽃") == 19 and F.planted[0].tier == 0 and not F.planted[0].hybrid and F.planted[0].day == 100, "첫 꽃: 곁에 꽃이 없으면 1단이 아님 · 꽃 -1 · 날짜 기록")
	player.global_position = _cell(5, 5) + Vector3(1.5, 0, 0)
	plant._try_plant()
	check(F.planted.size() == 1 and F.item_count("꽃") == 19, "너무 붙어 있으면(2.7m 안) 거절")
	# 곁에 심기 — 기준 꽃에서 2.8~4.7m 떨어진 자리마다 해시대로 갈림(기준 자리 넷 × 한 칸 둘레)
	var bases := [Vector2i(5, 5), Vector2i(10, 5), Vector2i(20, 5), Vector2i(5, 14)]
	var r0 := {"ok": true, "seen": {}}
	var r1 := {"ok": true, "seen": {}}
	for bc in bases:
		var a0: Dictionary = _ring(F, Plant, plant, player, bc, 0)
		var a1: Dictionary = _ring(F, Plant, plant, player, bc, 1)
		r0.ok = r0.ok and a0.ok
		r1.ok = r1.ok and a1.ok
		for k in a0.seen:
			r0.seen[k] = true
		for k in a1.seen:
			r1.seen[k] = true
	check(r0.ok and r0.seen.has(0) and r0.seen.has(1) and not r0.seen.has(2), "곁에 꽃이 있으면 자리 해시 0.45 를 넘을 때만 교배꽃(1단) — 두 결과 다 실측, 2단은 안 나옴 %s" % str(r0.seen.keys()))
	check(r1.ok and r1.seen.has(2) and r1.seen.has(1), "교배꽃 곁이면 0.7 을 넘을 때 진교배꽃(2단) · 아니면 1·0단(실측 %s)" % str(r1.seen.keys()))
	# 꺾기
	F.planted = [{"x": 0.0, "z": 0.0, "day": 100, "hybrid": false, "tier": 0}, {"x": 9.0, "z": 0.0, "day": 100, "hybrid": true}, {"x": 18.0, "z": 0.0, "day": 100, "hybrid": true, "tier": 2}]
	plant._nodes.clear()
	for i in 3:
		plant._in_range[i] = false
	F.items = {}
	Day.force_epoch_day(101)
	Day.force(20260301)
	plant._gather(0)
	check(F.item_count("꽃") == 0 and plant._elapsed(F.planted[0]) == 1 and Plant.PLANT_DAYS == 3, "자라는 중(3일 미만)에는 못 꺾음")
	Day.force_epoch_day(103)
	plant._gather(0)
	plant._gather(1)
	plant._gather(2)
	check(F.item_count("꽃") == 1 and F.item_count("교배꽃") == 1 and F.item_count("진교배꽃") == 1 and Plant._tier_of(F.planted[1]) == 1 and Plant._tier_of({}) == 0 and Plant._tier_of({"tier": 2}) == 2, "3일 뒤: 등급대로 꽃·교배꽃·진교배꽃을 얻음 · 옛 세이브(hybrid bool)는 1단으로")
	plant._gather(0)
	check(F.item_count("꽃") == 1, "같은 날 같은 꽃은 한 번만")
	Day.force_epoch_day(104)
	Day.force(20260302)
	plant._gather(0)
	check(F.item_count("꽃") == 2, "다음 날 다시 꺾음")
	check(Plant.HYBRID_ROLL == 0.45 and Plant.HYBRID2_ROLL == 0.7 and Plant.PLANT_MIN_GAP == 2.7 and Plant.HYBRID_NEAR == 4.8 and Plant._hash2(3, 4) == Plant._hash2(3, 4) and Plant._hash2(3, 4) != Plant._hash2(4, 3), "교배 상수 · 자리 해시는 결정적")
	plant.queue_free()
	player.queue_free()
	Day.force_epoch_day(null)

	# ③ 낚시
	var spot: Node3D = Fish.new()
	root.add_child(spot)
	await process_frame
	F.items = {}
	spot._cast()
	var window_ok: bool = spot._bite_at_ms - Time.get_ticks_msec() >= Fish.CAST_MIN_MS - 5 and spot._bite_at_ms - Time.get_ticks_msec() <= Fish.CAST_MIN_MS + Fish.CAST_VAR_MS and spot._ends_at_ms - spot._bite_at_ms == Fish.BITE_WINDOW_MS
	var now := Time.get_ticks_msec()
	spot._bite_at_ms = now + 2000
	spot._ends_at_ms = now + 2700
	spot._hook()
	var early_none: bool = F.item_count("물고기") == 0
	spot._bite_at_ms = now - 100
	spot._ends_at_ms = Time.get_ticks_msec() + 5000
	spot._hook()
	var caught: bool = F.item_count("물고기") == 1
	spot._bite_at_ms = now - 3000
	spot._ends_at_ms = now - 2300
	spot._hook()
	check(window_ok and early_none and caught and F.item_count("물고기") == 1 and Fish.LATE_GRACE_MS > 0 and Fish.FISH_RANGE > Fish.CAST_RADIUS, "낚시: 입질까지 1.2~3.5초 · 창 0.7초 · 일찍 당기면 달아남 · 창 안이면 +1 · 늦으면 놓침")
	spot.queue_free()

	# ④ 발견 표지
	var lids := {}
	var land_ok := true
	var cells := {}
	for m: Dictionary in Land.MARKERS:
		lids[m.id] = true
		var gc: Vector2i = m.grid
		land_ok = land_ok and gc.x >= 0 and gc.x < VMap.size().x and gc.y >= 0 and gc.y < VMap.size().y and ["T", "."].has(VMap.tile_at(gc.x, gc.y)) and String(m.shape) != "" and not cells.has(gc)
		cells[gc] = true
	check(Land.MARKERS.size() == 11 and lids.size() == 11 and land_ok, "발견 표지 11: id 유일 · 칸이 지도 안(풀밭·숲 가장자리)이고 서로 안 겹침 · 모양 이름")

	for v in SAVED_VARS:
		F.set(v, saved[v])
	Day.force(null)
	Day.force_epoch_day(null)
	print("PROBE forest_world ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)


## 기준 꽃(등급 base_tier)에서 2.8~4.7m 떨어진 풀밭 자리마다 심어 보고 해시 규칙대로인지 본다 — {ok, seen(나온 등급)}.
func _ring(F: Node, Plant: GDScript, plant: Node, player: Node3D, bc: Vector2i, base_tier: int) -> Dictionary:
	var base: Vector3 = _cell(bc.x, bc.y)
	var out := {"ok": true, "seen": {}}
	for gy in range(bc.y - 2, bc.y + 3):
		for gx in range(bc.x - 2, bc.x + 3):
			var pos: Vector3 = _cell(gx, gy)
			var d: float = Vector2(pos.x - base.x, pos.z - base.z).length()
			if d < 2.8 or d > 4.7 or VMap.tile_at(gx, gy) != ".":
				continue
			F.planted = [{"x": base.x, "z": base.z, "day": 100, "hybrid": base_tier >= 1, "tier": base_tier}]
			F.items = {"꽃": 5}
			player.global_position = pos
			plant._try_plant()
			if F.planted.size() != 2:
				out.ok = false
				continue
			var roll: float = Plant._hash2(int(round(pos.x)), int(round(pos.z)))
			var want := 0
			if base_tier >= 1 and roll > 0.7:
				want = 2
			elif roll > 0.45:
				want = 1
			out.ok = out.ok and F.planted[1].tier == want and F.planted[1].hybrid == (want >= 1)
			out.seen[want] = true
	return out
