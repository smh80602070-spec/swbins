extends SceneTree

## 사가의숲 규칙 층(games/saga_forest/data — forest_turnip·forest_festival·forest_wear·forest_home·forest_biome·village_map·forest_save_state) 자동 점검 — 화면 없는 순수 표·계산·거래 규칙. 날짜·시각은 ForestDay.force·ForestTurnip.force_morning 으로 붙든다.
##   godot --headless --path saga-godot --script res://tools/probe_forest_rules.gd
## ① 순무: 요일·주 계산(1970-01-04=일요일)·장은 일요일 오전만·살 값 90~110 결정적·시세 패턴 넷이 다 나옴·파는 값 하한 15·일요일 0·패턴별 모양(내림은 떨어짐·폭등은 서너 배) · 사기(열 개 단위·장 닫힘·한 주 900개·금 모자람·평균 값) · 팔기(일요일 거절·썩으면 10)
## ② 계절행사: 8일(날짜 표·가격 배율)·교배꽃도 꽃 값을 따름·설날 표지·행사 없는 날은 1.0
## ③ 옷: 겉옷 4·머리 7·옷 빛 8·덧옷 2·키 유일 · 사기·입기(금 모자람·이미 가짐·안 산 건 못 입음)
## ④ 가구·집: 가구 14(계열 4)·오늘의 전방 넷(날짜 결정적)·점수(값/50+개수×2+계열 보너스 25/45+마감+증축×20)·집 등급·증축 4단(비용·크기 오름·빚이 있으면 막힘·갚기) · 벽지·장판 7+7(기본 0원·사기·고르기)
## ⑤ 바이옴·지도: 네 사분면 경계(흙길 10행·집 15열)·지도 30×20·밖은 T·집 H·월드 좌표 중심
## ⑥ 하트·선물·채집: 하루 +4 상한·0~10·날이 바뀌면 리셋·같은 날 대화/선물 한 번·채집은 하루 한 번 · 박물관 기증(없으면 거절·갈래 누적)·번들은 5개에서 한 번만 완성·사고 등급·번들 장식 6.
## 상태는 끝에 되돌린다. 끝에 "PROBE forest_rules OK" 또는 "PROBE forest_rules FAIL n".

const Day := preload("res://games/saga_forest/data/forest_day.gd")
const Turnip := preload("res://games/saga_forest/data/forest_turnip.gd")
const Festival := preload("res://games/saga_forest/data/forest_festival.gd")
const Wear := preload("res://games/saga_forest/data/forest_wear.gd")
const Home := preload("res://games/saga_forest/data/forest_home.gd")
const Biome := preload("res://games/saga_forest/data/forest_biome.gd")
const VMap := preload("res://games/saga_forest/data/village_map.gd")

const SAVED_VARS := ["items", "used", "gold", "affinity", "affinity_day", "affinity_gained_today", "talked", "gifted", "museum_donated", "museum_donated_by_cat", "bundles_done",
	"village_bundle_grand_reward", "turnip", "bow", "wall_key", "floor_key", "owned_walls", "owned_floors", "wear_on", "wear_owned", "home_stock", "home_items", "home_tier", "home_debt", "tools", "planted"]

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
	var House: GDScript = load("res://games/saga_forest/world/forest_house.gd")
	var Museum: GDScript = load("res://games/saga_forest/world/museum.gd")

	# ① 순무
	Day.force_epoch_day(3)  # 1970-01-04 = 일요일
	check(Turnip.dow() == 0 and Turnip.dow(4) == 1 and Turnip.dow(9) == 6 and Turnip.dow(10) == 0 and Turnip.week(3) == 1 and Turnip.week(9) == 1 and Turnip.week(10) == 2 and Turnip.dow(-100) >= 0, "요일·주: 1970-01-04 일요일 · 월~토 1~6 · 일요일마다 주가 바뀜")
	Turnip.force_morning(true)
	var open_sun: bool = Turnip.market_open()
	Turnip.force_morning(false)
	var open_pm: bool = Turnip.market_open()
	Day.force_epoch_day(4)
	Turnip.force_morning(true)
	var open_mon: bool = Turnip.market_open()
	check(open_sun and not open_pm and not open_mon and Turnip.half() == 0, "장은 일요일 오전에만 선다")
	var buy_ok := true
	var pat_seen := {}
	var min_p := 999999
	var max_p := 0
	var decline_ok := true
	var spike := 0
	var wave_ok := true
	for w in range(1, 1501):
		var bp: int = Turnip.buy_price(w)
		buy_ok = buy_ok and bp >= 90 and bp <= 110 and bp == Turnip.buy_price(w)
		var pat: int = Turnip.pattern(w)
		pat_seen[pat] = true
		buy_ok = buy_ok and Turnip.sell_price(w, 0, 0) == 0
		var first: int = Turnip.sell_price(w, 1, 0)
		var last: int = Turnip.sell_price(w, 6, 1)
		for d in range(1, 7):
			for h in 2:
				var p: int = Turnip.sell_price(w, d, h)
				min_p = mini(min_p, p)
				max_p = maxi(max_p, p)
				if pat == 0:
					wave_ok = wave_ok and p >= 80 and p <= 140
		if pat == 1:
			decline_ok = decline_ok and last < first
		if pat == 3:
			for d in range(1, 7):
				for h in 2:
					spike = maxi(spike, Turnip.sell_price(w, d, h))
	check(buy_ok and pat_seen.size() == 4, "살 값 90~110 결정적 · 일요일 파는 값 0 · 시세 패턴 넷이 다 나옴(1500주)")
	check(min_p >= 15 and decline_ok and wave_ok and spike >= 300 and max_p == spike, "파는 값: 하한 15 · 내림은 토요일 오후가 월요일 오전보다 낮음 · 파동 80~140 · 폭등은 300 이상(최고 %d)" % spike)
	check(Turnip.PATTERNS.size() == 4 and Turnip.BASE == 100 and Turnip.UNIT == 10 and Turnip.MAX_BUY == 900 and Turnip.ROT_PRICE == 10, "순무 상수: 기준 100 · 열 개 단위 · 주 900 · 썩으면 10")
	# 사기·팔기(일요일 오전)
	Day.force_epoch_day(3)
	Turnip.force_morning(true)
	var wk: int = Turnip.week()
	var price: int = Turnip.buy_price()
	F.turnip = {}
	F.gold = 100000
	check(F.buy_turnip(5) != "" and F.buy_turnip(0) != "" and F.gold == 100000, "열 개 미만은 거절(금 불변)")
	check(F.buy_turnip(95) == "" and F.turnip.n == 90 and F.turnip.buy == price and F.turnip.week == wk and F.gold == 100000 - 90 * price, "95개 → 열 개 단위로 내려 90개 · 값 %d" % price)
	check(F.buy_turnip(900) != "" and F.turnip.n == 90, "한 주 900개를 넘기면 거절")
	F.gold = 10
	check(F.buy_turnip(10) != "" and F.turnip.n == 90, "금이 모자라면 거절")
	F.gold = 100000
	check(F.buy_turnip(10) == "" and F.turnip.n == 100, "추가로 사면 합쳐짐")
	check(F.sell_turnip().find("일요일") >= 0 and F.has_turnip(), "일요일에는 팔 수 없음(썩지 않은 순무)")
	Day.force_epoch_day(5)  # 화요일
	var sp: int = Turnip.sell_price()
	var before: int = F.gold
	var msg: String = F.sell_turnip()
	check(F.gold == before + sp * 100 and not F.has_turnip() and msg.begins_with("🥬") and F.sell_turnip() == "가진 순무가 없다", "화요일에 다 팖: 금 +%d×100 · 순무 비워짐 · 또 팔 게 없음" % sp)
	F.turnip = {"n": 20, "buy": 100, "week": Turnip.week() - 1}
	check(F.turnip_rotten() and F.turnip_now_price() == 10 and F.buy_turnip(10) != "" and F.has_turnip(), "지난주 순무는 썩음 — 개당 10 · 새로 못 삼")
	Day.force_epoch_day(3 + 7)
	F.turnip = {"n": 20, "buy": 100, "week": Turnip.week() - 1}
	var g0: int = F.gold
	F.sell_turnip()
	check(F.gold == g0 + 200, "일요일에도 썩은 순무는 처분할 수 있음(20×10=200)")
	F.turnip = {}
	Day.force_epoch_day(null)
	Turnip.force_morning(null)

	# ② 계절행사
	var ev_ok: bool = Festival.EVENTS.size() == 8
	var keys := {}
	var dates := [[1, 1], [2, 15], [4, 3], [6, 5], [7, 7], [8, 15], [9, 17], [12, 22]]
	for i in 8:
		var e: Dictionary = Festival.EVENTS[i]
		keys[e.key] = true
		ev_ok = ev_ok and [int(e.m), int(e.d)] == dates[i] and (i == 0 or float(e.up_mul) > 1.0)
		ev_ok = ev_ok and Festival.event_of_day_key(2026 * 10000 + int(e.m) * 100 + int(e.d)).key == e.key and Festival.event_of_day_key(2031 * 10000 + int(e.m) * 100 + int(e.d)).key == e.key
	check(ev_ok and keys.size() == 8 and Festival.event_of_day_key(20260101).tag == "newyear" and Festival.event_of_day_key(20260102).is_empty() and Festival.event_of_day_key(20260215).up_cat == "솔방울", "행사 8일: 날짜 표 · 해마다 같은 날 · 행사 없는 날은 {}")
	Day.force(20260403)  # 삼짇날 — 꽃 ×2
	check(Festival.price_mul("꽃") == 2.0 and Festival.price_mul("교배꽃") == 2.0 and Festival.price_mul("진교배꽃") == 2.0 and Festival.price_mul("곤충") == 1.0 and not Festival.is_new_year(), "삼짇날: 꽃·교배꽃·진교배꽃이 ×2 · 곤충은 1.0")
	Day.force(20260909)
	check(Festival.price_mul("과일") == 1.0 and Festival.event_of_today().is_empty(), "행사 없는 날은 모든 값 1.0")
	Day.force(20260917)
	check(Festival.price_mul("과일") == 2.0 and Festival.price_mul("꽃") == 1.0, "한가위: 과일 ×2")
	Day.force(20260101)
	check(Festival.is_new_year() and Festival.price_mul("꽃") == 1.0, "설날: 값 변화 없이 세뱃돈 날")
	Day.force(null)

	# ③ 옷
	var wear_ok: bool = Wear.COATS.size() == 4 and Wear.HEADS.size() == 7 and Wear.DYES.size() == 8 and Wear.CAPES.size() == 2 and Wear.PARTS.size() == 4
	for p: Dictionary in Wear.PARTS:
		var seen := {}
		for it: Dictionary in p.list:
			seen[it.key] = true
			wear_ok = wear_ok and int(it.price) >= 0 and String(it.name) != ""
		wear_ok = wear_ok and seen.size() == (p.list as Array).size() and int((p.list as Array)[0].price) == 0
	for d: Dictionary in Wear.DYES:
		wear_ok = wear_ok and (String(d.c) == "" or Color.html_is_valid(String(d.c)))
	check(wear_ok and Wear.part("dye").name == "옷 빛" and Wear.part("zzz").is_empty() and Wear.item("coat", "robe").price == 2400 and Wear.item("coat", "nope").key == "leather" and Wear.item("zzz", "x").is_empty(), "옷 카탈로그: 겉옷 4·머리 7·옷 빛 8·덧옷 2 · 키 유일 · 첫 항목 0원 · 모르는 키는 첫 항목")
	F.wear_on = {"coat": "leather", "head": "topknot", "dye": "none", "cape": "off"}
	F.wear_owned = {}
	F.gold = 2000
	check(not F.buy_wear("coat", "robe", 2400) and F.gold == 2000 and not F.set_wear("coat", "robe"), "금이 모자라면 못 사고 안 산 옷은 못 입음")
	F.gold = 3000
	check(F.buy_wear("coat", "robe", 2400) and F.gold == 600 and F.owns_wear("coat", "robe") and not F.buy_wear("coat", "robe", 2400) and F.gold == 600 and F.set_wear("coat", "robe") and F.wearing("coat") == "robe" and F.wearing("head") == "topknot", "사면 금이 줄고 소유 · 또 못 삼 · 입으면 그 부위만 바뀜")

	# ④ 가구·집
	var furn_ok: bool = Home.FURNITURE.size() == 14
	var fk := {}
	var sets := {}
	for f: Dictionary in Home.FURNITURE:
		fk[f.key] = true
		sets[f.set] = int(sets.get(f.set, 0)) + 1
		furn_ok = furn_ok and int(f.price) > 0 and String(f.form) != ""
	check(furn_ok and fk.size() == 14 and sets.size() == 4 and Home.furn("soban").price == 900 and Home.furn("zzz").is_empty(), "가구 14: 키 유일 · 계열 4 %s" % str(sets))
	var shop_ok := true
	var diff := false
	for dk in range(20260101, 20260131):
		var sh: Array = Home.daily_shop(dk)
		var u := {}
		for f in sh:
			u[f.key] = true
		shop_ok = shop_ok and sh.size() == Home.SHOP_N and u.size() == Home.SHOP_N and Home.daily_shop(dk) == sh
		diff = diff or sh != Home.daily_shop(20260101)
	check(shop_ok and diff, "오늘의 전방: 날마다 서로 다른 넉 점 · 같은 날은 늘 같음")
	var items3: Array = [{"key": "jokja"}, {"key": "seoan"}, {"key": "mungab"}]
	var sc: Dictionary = Home.score(items3, 0)
	var raw: float = (1200.0 + 1400.0 + 1800.0) / 50.0 + 3 * 2.0
	check(sc.total == roundi(raw + 25.0) and sc.bonus == 25 and sc.n == 3 and sc.sets.sarang == 3, "점수: 사랑방 계열 3점 → 보너스 25 (%d)" % sc.total)
	var items5: Array = [{"key": "jokja"}, {"key": "seoan"}, {"key": "mungab"}, {"key": "badukpan"}, {"key": "byeongpung"}]
	check(Home.score(items5, 10, 2).bonus == 45 and Home.score(items5, 10, 2).total == roundi((1200.0 + 1400.0 + 1800.0 + 3000.0 + 3600.0) / 50.0 + 10.0 + 45.0 + 10.0 + 40.0) and Home.score([{"key": "zzz"}], 0).total == 2, "5점이면 보너스 45 · 마감·증축(×20) 가산 · 모르는 가구는 값 없이 개수만")
	check(Home.grade(0) == "휑한 방" and Home.grade(29) == "휑한 방" and Home.grade(30) == "살림이 든 방" and Home.grade(160) == "아취 있는 집" and Home.grade(450) == "명가(名家)" and Home.grade(9999) == "명가(名家)", "집 등급 문턱 0·30·80·160·280·450")
	var tier_ok: bool = Home.HOME_TIERS.size() == 4 and Home.tier_at(-3).name == "단칸방" and Home.tier_at(99).name == "기와집" and Home.next_tier(3).is_empty() and Home.next_tier(0).cost == 12000
	for i in range(1, 4):
		var a: Dictionary = Home.HOME_TIERS[i - 1]
		var b: Dictionary = Home.HOME_TIERS[i]
		tier_ok = tier_ok and int(b.cost) > int(a.cost) and int(b.w) > int(a.w) and int(b.h) > int(a.h) and float(b.half_x) > float(a.half_x) and float(b.half_z) > float(a.half_z)
	check(tier_ok, "증축 4단: 비용·가로세로·방 크기가 다 오름 · 범위 밖은 끝으로 끼움 · 마지막 다음은 {}")
	F.home_tier = 0
	F.home_debt = 0
	F.gold = 50000
	check(F.expand_home(12000) and F.home_tier == 1 and F.home_debt == 12000 and not F.expand_home(40000) and F.home_tier == 1, "증축: 빚이 생기고 · 빚이 있으면 또 증축 못 함")
	F.gold = 5000
	check(F.repay_home_debt(3000) == 3000 and F.gold == 2000 and F.home_debt == 9000 and F.repay_home_debt(99999) == 2000 and F.home_debt == 7000 and F.gold == 0 and F.repay_home_debt(10) == 0, "빚 갚기: 가진 금 안에서만 · 갚은 만큼만 돌려줌")
	F.home_stock = {}
	F.home_stock_add("soban")
	F.home_stock_add("soban", 2)
	check(F.home_stock_count("soban") == 3 and F.home_stock_count("zzz") == 0, "창고 개수")
	var finish_ok: bool = House.WALLS.size() == 7 and House.FLOORS.size() == 7 and House.WALLS[0].price == 0 and House.FLOORS[0].price == 0
	for tbl in [House.WALLS, House.FLOORS]:
		var u2 := {}
		for e: Dictionary in tbl:
			u2[e.key] = true
		finish_ok = finish_ok and u2.size() == 7
	check(finish_ok and House._wall_by_key("zzz").key == "earth" and House._floor_by_key("zzz").key == "wood" and House._wall_by_key("dan").price == 5200, "벽지 7·장판 7: 첫 항목 0원 · 키 유일 · 모르는 키는 기본")
	F.owned_walls = {"earth": true}
	F.owned_floors = {"wood": true}
	F.wall_key = "earth"
	F.floor_key = "wood"
	F.gold = 2500
	check(F.owns_finish("wall", "earth") and not F.set_finish("wall", "hanji") and not F.buy_finish("wall", "dan", 5200) and F.buy_finish("wall", "hanji", 2000) and F.gold == 500 and F.set_finish("wall", "hanji") and F.wall_key == "hanji" and F.floor_key == "wood" and not F.buy_finish("wall", "hanji", 2000), "벽지: 안 산 건 못 고르고 · 금 모자라면 못 사고 · 사면 고를 수 있음(장판은 그대로)")
	F.gold = 9000
	check(F.buy_finish("floor", "mat", 1800) and F.set_finish("floor", "mat") and F.floor_key == "mat" and F.gold == 7200 and F.owns_finish("floor", "mat") and not F.owns_finish("wall", "mat"), "장판은 따로 소유")

	# ⑤ 바이옴·지도
	check(Biome.biome_at(0, 0).key == "meadow" and Biome.biome_at(14, 9).key == "meadow" and Biome.biome_at(15, 9).key == "dark" and Biome.biome_at(29, 0).key == "dark" and Biome.biome_at(14, 10).key == "mush" and Biome.biome_at(0, 19).key == "mush" and Biome.biome_at(15, 10).key == "rocky" and Biome.biome_at(29, 19).key == "rocky", "바이옴 네 사분면 경계(흙길 10행 북/남 · 15열 서/동)")
	check(Biome.color_at(3, 3) == Biome.MEADOW.color and Biome.color_at(20, 15) == Biome.ROCKY.color and Biome.MEADOW.color != Biome.DARK.color and Biome.MUSH.color != Biome.ROCKY.color, "색: 사분면마다 다름")
	var sz: Vector2i = VMap.size()
	var road_ok := true
	for x in range(2, 28):
		road_ok = road_ok and VMap.tile_at(x, Biome.ROAD_ROW) == "="
	check(sz == Vector2i(30, 20) and road_ok and VMap.tile_at(Biome.MID_COL, 9) == "H" and VMap.tile_at(-1, 0) == "T" and VMap.tile_at(0, 99) == "T" and VMap.tile_at(5, 5) == "." and VMap.world_pos(15, 10) == Vector3.ZERO and VMap.world_pos(16, 10).x == VMap.TILE_SIZE, "지도 30×20: 흙길 10행 · 집(H)이 15열 9행 · 밖은 T · 중심(15,10)이 월드 원점")

	# ⑥ 하트·선물·채집
	F.affinity = {}
	F.affinity_day = {}
	F.affinity_gained_today = {}
	F.talked = {}
	F.gifted = {}
	Day.force(20260110)
	check(F.gain_affinity("a", 3) == 3 and F.gain_affinity("a", 3) == 1 and F.gain_affinity("a", 5) == 0 and F.heart("a") == 4 and F.gain_affinity("b", 9) == 4 and F.heart("b") == 4, "하루 상승 +4 상한: 3 → 나머지 1 → 0 · 사람마다 따로")
	Day.force(20260111)
	check(F.gain_affinity("a", 4) == 4 and F.heart("a") == 8, "날이 바뀌면 다시 +4")
	Day.force(20260112)
	F.gain_affinity("a", 4)
	check(F.heart("a") == 10 and F.gain_affinity("a", 2) == 0 and F.heart("a") == 10, "하트는 10 에서 멈춤(그날 상한도 참)")
	check(not F.talked_today("a") and not F.gifted_today("a"), "처음엔 대화·선물 안 함")
	F.mark_talked("a")
	F.mark_gifted("a")
	var tg: bool = F.talked_today("a") and F.gifted_today("a") and not F.gifted_today("b")
	Day.force(20260113)
	check(tg and not F.talked_today("a") and not F.gifted_today("a"), "같은 날 대화·선물은 한 번 · 다음 날 풀림")
	F.used = {}
	var fresh: bool = F.can_gather("tree1")
	F.mark_gathered("tree1")
	check(fresh and not F.can_gather("tree1") and F.can_gather("tree2"), "채집: 같은 자리는 하루 한 번")
	Day.force(20260114)
	check(F.can_gather("tree1"), "다음 날 다시 채집")
	F.items = {}
	F.add_item("꽃", 3)
	F.add_item("꽃", 2)
	F.add_item("곤충", 1)
	F.gold = 100
	F.begin_session()
	F.add_item("물고기", 4)
	F.add_gold(50)
	check(F.item_count("꽃") == 5 and F.total_items() == 6 + 4 and F.session_items_gathered() == 4 and F.session_gold_gained() == 50 and F.item_count("zzz") == 0, "아이템 개수·합계·세션 증가분")
	check(F.sell_items("꽃", 40) == 200 and F.item_count("꽃") == 0 and F.sell_items("꽃", 40) == 0 and F.gold == 350, "가진 것 한 번에 팔기(5×40) · 없으면 0")
	# 박물관·번들
	F.items = {"꽃": 7, "물고기": 1}
	F.museum_donated = 0
	F.museum_donated_by_cat = {}
	F.bundles_done = {}
	check(not F.donate_to_museum("곤충") and F.museum_donated == 0, "없는 것은 기증 못 함")
	var thr: int = Museum.BUNDLE_THRESHOLD
	var done_at := -1
	for i in 7:
		if not F.donate_to_museum("꽃"):
			break
		if F.check_bundle_complete("꽃", thr) and done_at < 0:
			done_at = i + 1
	check(done_at == thr and F.museum_donated == 7 and F.item_count("꽃") == 0 and F.museum_donated_by_cat["꽃"] == 7 and F.bundles_done_count() == 1 and not F.check_bundle_complete("꽃", thr) and not F.donate_to_museum("꽃"), "번들: %d번째 기증에서 한 번만 완성 · 기증은 가진 만큼만" % thr)
	var grade_ok: bool = Museum.GRADES.size() == 5
	for i in range(1, Museum.GRADES.size()):
		grade_ok = grade_ok and int(Museum.GRADES[i].at) > int(Museum.GRADES[i - 1].at)
	var decor_ok: bool = Museum.BUNDLE_DECOR.size() == 6
	for cat in Museum.DONATE_CATS:
		decor_ok = decor_ok and Museum.BUNDLE_DECOR.has(cat) and String(Museum.BUNDLE_DECOR[cat].name) != ""
	check(grade_ok and decor_ok and Museum.DONATE_CATS.size() == 6 and Museum.GRADES[0].at == 0, "사고 등급 5(문턱 오름) · 기증 갈래 6마다 번들 장식 하나")

	# 되돌리기
	Day.force(null)
	Day.force_epoch_day(null)
	Turnip.force_morning(null)
	for v in SAVED_VARS:
		F.set(v, saved[v])
	print("PROBE forest_rules ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
