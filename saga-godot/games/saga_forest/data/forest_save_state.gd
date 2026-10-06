extends SagaSaveBase

## VERTICAL_SLICE_FOREST.md 4절 "저장/불러오기(위치+채집한 과일 개수
## 정도, GO/DUNGEON과 같은 최소 범위)". GO save_state.gd·DUNGEON
## dungeon_save_state.gd와 같은 정신(로컬 파일 하나, 버전 필드)이지만
## 파일·스키마는 완전히 분리한다 — DUNGEON이 이미 세운 "게임별 분리"
## 선례(dungeon_save_state.gd 상단 주석 참고) 그대로.
##
## project.godot [autoload]에 ForestSaveState로 등록.
##
## 2번째 확장(제외 목록 1번 — 나무 이외 채집 대상 + 진짜 하루 1회 리셋) —
## 나무 하나짜리 fruit_count(int)를 여러 채집물을 담는 items(Dictionary)로
## 바꿨다. **필드 모양 자체가 바뀌는 진짜 스키마 변경**이라(GO
## save_state.gd·DUNGEON dungeon_save_state.gd가 세운 기준과 같음 — 추가만
## 이면 버전을 안 올리지만 이건 바꿔치기다) SAVE_VERSION을 1→2로 올리고
## _migrate_step()에 옛 fruit_count 하나를 items["과일"]로 옮기는 경로를
## 처음으로 채웠다.

const SAVE_PATH := "user://save_forest.json"
const SafeFile := preload("res://saga_core/data/safe_file.gd")  # 임시 파일 → .bak → 바꿔치기(쓰는 도중 꺼져도 직전본이 남는다)
const SAVE_VERSION := 2


func save_version() -> int:
	return SAVE_VERSION


func save_path() -> String:
	return SAVE_PATH


var items: Dictionary = {}  # item_label(String) -> count(int)

## prop_id(String) -> day_key(int, ForestDay.today_key()). 웹판
## village.js의 st().used와 같은 뜻 — "이 채집 대상을 마지막으로 쓴 날".
var used: Dictionary = {}

## 3번째 확장(제외 목록 3번 — 주민 5명 전체 + 부탁·선물) — 전부 순수
## 추가 필드다(모양이 바뀌는 게 아니라 새 키가 느는 것뿐, GO save_state.gd
## 기준으로 버전을 안 올려도 되는 경우). 없으면 빈 값으로 안전하게 채워짐.
var gold := 0
var met: Dictionary = {}          # npc_id(String) -> true(만난 적 있음)
var quests_done: Dictionary = {}  # npc_id(String) -> true(부탁을 마침)
var gifted: Dictionary = {}       # npc_id(String) -> day_key(마지막으로 선물한 날)
var affinity: Dictionary = {}     # npc_id(String) -> int(친밀도 = "하트" 0~10)

## PLAN.md 101-2 FOREST ②후보 "관계 하트"(웹판 saga-forest/PLAN.md §5.4) —
## 순수 추가. 웹 스펙(하트 0~10, 대화·선물·부탁·세배 상승, 하루 상한 +4,
## 단계 해제 3/5/7/10♥, 하트≤2만 이사 후보)에서 이 3D 슬라이스가 이미
## 가진 것만 옮긴다 — **재해석/제외**: 3♥(주민 집 방문)·7♥(30초 동행+채집
## 확률)은 3D에 주민 집 인테리어·동행 AI가 아예 없어(다른 시스템이라
## 이번 후보 범위 밖) 보류. **이사 판정 자체가 3D엔 없어**(원작 F 실패
## 루프 전체를 이 슬라이스가 아직 안 옮겼다, 101-1 표 F 참고) "하트≤2만
## 이사 후보"도 해당 없음.
var talked: Dictionary = {}            # npc_id(String) -> day_key(대화 상승은 하루 1회)
var affinity_day: Dictionary = {}      # npc_id(String) -> day_key(하루 상한 +4 기준일)
var affinity_gained_today: Dictionary = {}  # npc_id(String) -> int(그 기준일에 이미 얻은 양)
var heart_reward_10: Dictionary = {}   # npc_id(String) -> true(10♥ 기념 사례금, 한 번만)

## 4번째 확장(제외 목록 4번 — 곤충/화석/조개 + 박물관) — 역시 순수 추가.
var tools: Dictionary = {}  # tool_key(String) -> true(예: "spade")
var museum_donated := 0     # 사고에 기증한 누적 개수(종 수가 아니라 총합 —
                             # 이 슬라이스엔 종 카탈로그가 없어 단순화, 근거는
                             # museum.gd 상단 주석)

## PLAN.md 101-2 FOREST ③후보 "마을 번들"(웹판 §5.3) — 순수 추가. 종
## 카탈로그가 없어(위 museum_donated 머리말과 같은 이유) 웹판의 "번들당
## 종 5~8개"를 "갈래당 기증 개수 5개"로 재해석했다(museum.gd BUNDLE_
## THRESHOLD 참고) — 갈래(곤충·물고기·화석·조개·꽃·과일) 자체가 곧
## 웹판 번들 하나하나에 대응한다.
var museum_donated_by_cat: Dictionary = {}  # item_label(String) -> int
var bundles_done: Dictionary = {}           # item_label(String) -> true(그 번들 완성)
var village_bundle_grand_reward := false    # 웹판 "6개 완성 → 평가 상한 해제+깃발"의
                                             # 재해석 보상(사례금+깃발 장식)을 한 번만 준다

## 5번째 확장(제외 목록 5번 — 순무 시세) — 역시 순수 추가. 가진 것만
## 남긴다는 웹판 turnip.js 원칙 그대로: {n, buy, week} 셋뿐, 시세는
## ForestTurnip이 주 번호에서 다시 계산한다(저장 안 함).
var turnip: Dictionary = {}  # {"n": int, "buy": int, "week": int} 또는 빈 딕셔너리(없음)

## 6번째 확장(제외 목록 6번 — 벽지/장판·꽃 교배·계절행사 8일·옷) — 전부
## 순수 추가.
var bow: Dictionary = {}  # npc_id(String) -> day_key(설날 세배를 받은 날)

## 심은 꽃 — {"x": float, "z": float, "day": int(ForestDay.epoch_day_index()
## 심은 날), "hybrid": bool}의 배열. 인덱스가 곧 forest_planting.gd가 쓰는
## can_gather() prop_id("planted_%d")다 — 항상 append만 하고 지우지 않으니
## 인덱스가 안정적이다.
var planted: Array = []

var wall_key := "earth"
var floor_key := "wood"
## "earth"·"wood"(기본값, 값 0)는 웹판처럼 처음부터 갖고 있다.
var owned_walls: Dictionary = {"earth": true}
var owned_floors: Dictionary = {"wood": true}

var wear_on: Dictionary = {"coat": "leather", "head": "topknot", "dye": "none", "cape": "off"}
## 값이 0인 기본 한 벌은 웹판처럼 처음부터 옷장에 있다.
var wear_owned: Dictionary = {
	"coat:leather": true, "head:none": true, "head:topknot": true,
	"dye:none": true, "cape:off": true,
}

## FOREST 콘텐츠 확장 1호(가구) — 순수 추가.
var home_stock: Dictionary = {}  # furn_key(String) -> count(int), 창고
var home_items: Array = []       # [{"key":String,"x":float,"z":float}], 놓인 것

## FOREST 콘텐츠 확장 2호(증축) — 순수 추가. 웹판 home.js expand()/repay()
## 그대로: 증축은 즉시 되고 그 자리에서 빚이 생긴다(선불이 아니다), 빚을
## 다 갚아야 다음 증축을 신청할 수 있다. tier·cost 표는 forest_home.gd
## HOME_TIERS가 갖고 있어 여기선 원시 int 둘만 들고 있는다(다른 세이브
## 필드처럼 이 파일은 값을, 규칙은 부르는 쪽(forest_house.gd)이 갖는다).
var home_tier := 0
var home_debt := 0

## PLAN.md 101-4 표준 A·B(목표판·세션 카드) — GO PartyState.session_exp_gained()·
## DUNGEON DungeonGoldState.session_gold_gained()와 같은 계약(세이브 필드가
## 아니다, 세션 시작 시점 스냅샷과의 차이만 잰다).
var _session_start_gold := 0
var _session_start_items := 0


func begin_session() -> void:
	_session_start_gold = gold
	_session_start_items = total_items()


func session_gold_gained() -> int:
	return gold - _session_start_gold


func session_items_gathered() -> int:
	return total_items() - _session_start_items


## 다음 tier가 있고 빚이 없을 때만 성공 — cost는 forest_house.gd가
## ForestHome.next_tier(home_tier).cost로 구해 넘겨준다.
func expand_home(cost: int) -> bool:
	if home_debt > 0:
		return false
	home_tier += 1
	home_debt = cost
	return true


## 가진 금 안에서 최대한 갚는다(turnip 판다·팔다 계열과 같은 결) — 실제로
## 깎인 금액을 돌려준다(0이면 빚이 없거나 금이 없다).
func repay_home_debt(amount: int) -> int:
	var pay: int = mini(mini(amount, home_debt), gold)
	if pay <= 0:
		return 0
	gold -= pay
	home_debt -= pay
	return pay


func home_stock_add(key: String, n: int = 1) -> void:
	home_stock[key] = int(home_stock.get(key, 0)) + n


func home_stock_count(key: String) -> int:
	return int(home_stock.get(key, 0))


func can_gather(prop_id: String) -> bool:
	return int(used.get(prop_id, -1)) != ForestDay.today_key()


func mark_gathered(prop_id: String) -> void:
	used[prop_id] = ForestDay.today_key()


func add_item(item_label: String, amount: int) -> void:
	items[item_label] = int(items.get(item_label, 0)) + amount


func item_count(item_label: String) -> int:
	return int(items.get(item_label, 0))


func total_items() -> int:
	var total := 0
	for v in items.values():
		total += int(v)
	return total


func mark_met(npc_id: String) -> void:
	met[npc_id] = true


func met_count() -> int:
	return met.size()


func is_quest_done(npc_id: String) -> bool:
	return bool(quests_done.get(npc_id, false))


func mark_quest_done(npc_id: String) -> void:
	quests_done[npc_id] = true


func add_gold(amount: int) -> void:
	gold += amount


func gifted_today(npc_id: String) -> bool:
	return int(gifted.get(npc_id, -1)) == ForestDay.today_key()


func mark_gifted(npc_id: String) -> void:
	gifted[npc_id] = ForestDay.today_key()


func heart(npc_id: String) -> int:
	return int(affinity.get(npc_id, 0))


func talked_today(npc_id: String) -> bool:
	return int(talked.get(npc_id, -1)) == ForestDay.today_key()


func mark_talked(npc_id: String) -> void:
	talked[npc_id] = ForestDay.today_key()


## 웹판 §5.4 "하루 상승 상한 +4" — 그 날 이미 얻은 만큼만 빼고 남는 몫을
## 적용한다(넘치는 나머지는 버림, gifted_today()처럼 하루가 지나면 새로
## 리셋). 0~10 범위로 상시 clamp(§5.4 "인물별 heart 0~10"). 실제로 적용된
## 양을 돌려준다 — 상한에 걸려 일부만 들어간 경우를 호출부가 알 수 있게.
func gain_affinity(npc_id: String, amount: int) -> int:
	var today := ForestDay.today_key()
	if int(affinity_day.get(npc_id, -1)) != today:
		affinity_day[npc_id] = today
		affinity_gained_today[npc_id] = 0
	var room: int = maxi(0, 4 - int(affinity_gained_today.get(npc_id, 0)))
	var applied: int = mini(amount, room)
	if applied > 0:
		affinity[npc_id] = clampi(heart(npc_id) + applied, 0, 10)
		affinity_gained_today[npc_id] = int(affinity_gained_today.get(npc_id, 0)) + applied
	return applied


func has_tool(tool_key: String) -> bool:
	return bool(tools.get(tool_key, false))


## gold가 모자라거나 이미 갖고 있으면 아무것도 안 하고 false.
func buy_tool(tool_key: String, price: int) -> bool:
	if has_tool(tool_key) or gold < price:
		return false
	gold -= price
	tools[tool_key] = true
	return true


func donate_to_museum(item_label: String) -> bool:
	if item_count(item_label) <= 0:
		return false
	items[item_label] = item_count(item_label) - 1
	museum_donated += 1
	museum_donated_by_cat[item_label] = int(museum_donated_by_cat.get(item_label, 0)) + 1
	return true


## museum.gd BUNDLE_THRESHOLD(5)를 이 갈래가 막 넘겼으면 true(한 번만,
## bundles_done으로 잠근다) — donate_to_museum() 바로 다음에 불러야
## "막 넘긴 순간"을 잡는다.
func check_bundle_complete(item_label: String, threshold: int) -> bool:
	if bundles_done.get(item_label, false):
		return false
	if int(museum_donated_by_cat.get(item_label, 0)) < threshold:
		return false
	bundles_done[item_label] = true
	return true


func bundles_done_count() -> int:
	return bundles_done.size()


func has_turnip() -> bool:
	return int(turnip.get("n", 0)) > 0


## 산 주가 지나면 썩는다(웹판 rotten()) — 다음 일요일이 오면 값이
## ROT_PRICE(10)로 뚝 떨어진다.
func turnip_rotten() -> bool:
	return has_turnip() and int(turnip.get("week", -1)) != ForestTurnip.week()


func turnip_now_price() -> int:
	return ForestTurnip.ROT_PRICE if turnip_rotten() else ForestTurnip.sell_price()


## 웹판 turnip.js::buy()를 그대로 옮김 — 실패 이유를 문자열로 돌려주고
## (성공하면 빈 문자열), 실제 거래(골드 차감·turnip 갱신)는 여기서 한다.
## n은 열 개 단위로 내림한다(웹판 UNIT).
func buy_turnip(n: int) -> String:
	if not ForestTurnip.market_open():
		return "순무 장은 일요일 오전에만 섭니다"
	var buy_n: int = int(floor(float(n) / ForestTurnip.UNIT)) * ForestTurnip.UNIT
	if buy_n <= 0:
		return "열 개 단위로만 살 수 있다"
	if turnip_rotten():
		return "썩은 순무가 남아 있다 — 먼저 처분하게"
	var already: int = int(turnip.get("n", 0))
	if already + buy_n > ForestTurnip.MAX_BUY:
		return "한 주에 %d개까지다(지금 %d)" % [ForestTurnip.MAX_BUY, already]
	var price: int = ForestTurnip.buy_price()
	var cost: int = price * buy_n
	if gold < cost:
		return "골드가 모자란다 (💰%d 필요)" % cost
	gold -= cost
	var total_cost: int = int(turnip.get("buy", 0)) * already + cost
	var total_n: int = already + buy_n
	turnip = {"n": total_n, "buy": int(round(float(total_cost) / float(total_n))), "week": ForestTurnip.week()}
	return ""


## 가진 것을 다 판다(웹판 sellAll()). 실패 이유 또는 결과 설명을 그대로
## 돌려준다(다르게 성공/실패를 나누는 대신, 호출부가 has_turnip()으로
## 성공 여부를 먼저 확인하고 이 문자열을 토스트로 보여준다).
func sell_turnip() -> String:
	if not has_turnip():
		return "가진 순무가 없다"
	if ForestTurnip.dow() == 0 and not turnip_rotten():
		return "일요일에는 전방이 순무를 받지 않는다"
	var price: int = turnip_now_price()
	var n: int = int(turnip.get("n", 0))
	var revenue: int = price * n
	var cost: int = int(turnip.get("buy", 0)) * n
	var profit: int = revenue - cost
	gold += revenue
	turnip = {}
	return "🥬 순무 %d개를 팔았다 (개당 💰%d) — %s%d" % \
		[n, price, "이문 💰+" if profit >= 0 else "밑진 것 💰", absi(profit)]


## 설날 세배 — 웹판 village.js talk()의 그 자리(500 + 친밀도*150). 사람마다
## 하루 한 번(gifted_today()와 같은 날짜 비교 패턴, 다른 딕셔너리를 씀).
func has_bowed_today(npc_id: String) -> bool:
	return int(bow.get(npc_id, -1)) == ForestDay.today_key()


func mark_bowed(npc_id: String) -> void:
	bow[npc_id] = ForestDay.today_key()


## 계절행사 8일(price_mul)에 값을 주는 자리 — 가진 것을 한 번에 다 판다
## (turnip sell_turnip()과 같은 결). 실패(가진 게 없음)면 0.
func sell_items(item_label: String, unit_price: int) -> int:
	var n := item_count(item_label)
	if n <= 0:
		return 0
	items[item_label] = 0
	var revenue := n * unit_price
	gold += revenue
	return revenue


func owns_finish(kind: String, key: String) -> bool:
	var m: Dictionary = owned_walls if kind == "wall" else owned_floors
	return bool(m.get(key, false))


func buy_finish(kind: String, key: String, price: int) -> bool:
	if owns_finish(kind, key) or gold < price:
		return false
	gold -= price
	if kind == "wall":
		owned_walls[key] = true
	else:
		owned_floors[key] = true
	return true


func set_finish(kind: String, key: String) -> bool:
	if not owns_finish(kind, key):
		return false
	if kind == "wall":
		wall_key = key
	else:
		floor_key = key
	return true


func owns_wear(part: String, key: String) -> bool:
	return bool(wear_owned.get("%s:%s" % [part, key], false))


func buy_wear(part: String, key: String, price: int) -> bool:
	if owns_wear(part, key) or gold < price:
		return false
	gold -= price
	wear_owned["%s:%s" % [part, key]] = true
	return true


func set_wear(part: String, key: String) -> bool:
	if not owns_wear(part, key):
		return false
	wear_on[part] = key
	return true


func wearing(part: String) -> String:
	return String(wear_on.get(part, ""))


func save() -> bool:
	var player := _find_player()
	if player == null:
		return false
	var data := {
		"version": SAVE_VERSION,
		"player_pos": [player.global_position.x, player.global_position.y, player.global_position.z],
		"items": items,
		"used": used,
		"gold": gold,
		"met": met,
		"quests_done": quests_done,
		"gifted": gifted,
		"affinity": affinity,
		"talked": talked,
		"affinity_day": affinity_day,
		"affinity_gained_today": affinity_gained_today,
		"heart_reward_10": heart_reward_10,
		"tools": tools,
		"museum_donated": museum_donated,
		"museum_donated_by_cat": museum_donated_by_cat,
		"bundles_done": bundles_done,
		"village_bundle_grand_reward": village_bundle_grand_reward,
		"turnip": turnip,
		"bow": bow,
		"planted": planted,
		"wall_key": wall_key,
		"floor_key": floor_key,
		"owned_walls": owned_walls,
		"owned_floors": owned_floors,
		"wear_on": wear_on,
		"wear_owned": wear_owned,
		"home_stock": home_stock,
		"home_items": home_items,
		"home_tier": home_tier,
		"home_debt": home_debt,
	}
	return SafeFile.write_text(SAVE_PATH, JSON.stringify(data))


func try_load() -> bool:
	var parsed: Variant = SafeFile.read_json(SAVE_PATH)
	if parsed == null:
		return false
	var migrated: Variant = _migrate(parsed)
	if migrated == null:
		return false
	var data: Dictionary = migrated

	var loaded_items: Variant = data.get("items", {})
	items = loaded_items if typeof(loaded_items) == TYPE_DICTIONARY else {}
	var loaded_used: Variant = data.get("used", {})
	used = loaded_used if typeof(loaded_used) == TYPE_DICTIONARY else {}

	gold = int(data.get("gold", 0))
	var loaded_met: Variant = data.get("met", {})
	met = loaded_met if typeof(loaded_met) == TYPE_DICTIONARY else {}
	var loaded_quests_done: Variant = data.get("quests_done", {})
	quests_done = loaded_quests_done if typeof(loaded_quests_done) == TYPE_DICTIONARY else {}
	var loaded_gifted: Variant = data.get("gifted", {})
	gifted = loaded_gifted if typeof(loaded_gifted) == TYPE_DICTIONARY else {}
	var loaded_affinity: Variant = data.get("affinity", {})
	affinity = loaded_affinity if typeof(loaded_affinity) == TYPE_DICTIONARY else {}
	var loaded_talked: Variant = data.get("talked", {})
	talked = loaded_talked if typeof(loaded_talked) == TYPE_DICTIONARY else {}
	var loaded_affinity_day: Variant = data.get("affinity_day", {})
	affinity_day = loaded_affinity_day if typeof(loaded_affinity_day) == TYPE_DICTIONARY else {}
	var loaded_affinity_gained_today: Variant = data.get("affinity_gained_today", {})
	affinity_gained_today = loaded_affinity_gained_today if typeof(loaded_affinity_gained_today) == TYPE_DICTIONARY else {}
	var loaded_heart_reward_10: Variant = data.get("heart_reward_10", {})
	heart_reward_10 = loaded_heart_reward_10 if typeof(loaded_heart_reward_10) == TYPE_DICTIONARY else {}
	var loaded_tools: Variant = data.get("tools", {})
	tools = loaded_tools if typeof(loaded_tools) == TYPE_DICTIONARY else {}
	museum_donated = int(data.get("museum_donated", 0))
	var loaded_museum_by_cat: Variant = data.get("museum_donated_by_cat", {})
	museum_donated_by_cat = loaded_museum_by_cat if typeof(loaded_museum_by_cat) == TYPE_DICTIONARY else {}
	var loaded_bundles_done: Variant = data.get("bundles_done", {})
	bundles_done = loaded_bundles_done if typeof(loaded_bundles_done) == TYPE_DICTIONARY else {}
	village_bundle_grand_reward = bool(data.get("village_bundle_grand_reward", false))
	var loaded_turnip: Variant = data.get("turnip", {})
	turnip = loaded_turnip if typeof(loaded_turnip) == TYPE_DICTIONARY else {}

	var loaded_bow: Variant = data.get("bow", {})
	bow = loaded_bow if typeof(loaded_bow) == TYPE_DICTIONARY else {}
	var loaded_planted: Variant = data.get("planted", [])
	planted = loaded_planted if typeof(loaded_planted) == TYPE_ARRAY else []
	wall_key = String(data.get("wall_key", "earth"))
	floor_key = String(data.get("floor_key", "wood"))
	var loaded_owned_walls: Variant = data.get("owned_walls", {"earth": true})
	owned_walls = loaded_owned_walls if typeof(loaded_owned_walls) == TYPE_DICTIONARY else {"earth": true}
	var loaded_owned_floors: Variant = data.get("owned_floors", {"wood": true})
	owned_floors = loaded_owned_floors if typeof(loaded_owned_floors) == TYPE_DICTIONARY else {"wood": true}
	var loaded_wear_on: Variant = data.get("wear_on", wear_on)
	wear_on = loaded_wear_on if typeof(loaded_wear_on) == TYPE_DICTIONARY else wear_on
	var loaded_wear_owned: Variant = data.get("wear_owned", wear_owned)
	wear_owned = loaded_wear_owned if typeof(loaded_wear_owned) == TYPE_DICTIONARY else wear_owned
	var loaded_home_stock: Variant = data.get("home_stock", {})
	home_stock = loaded_home_stock if typeof(loaded_home_stock) == TYPE_DICTIONARY else {}
	var loaded_home_items: Variant = data.get("home_items", [])
	home_items = loaded_home_items if typeof(loaded_home_items) == TYPE_ARRAY else []
	home_tier = int(data.get("home_tier", 0))
	home_debt = int(data.get("home_debt", 0))

	var pos: Array = data.get("player_pos", [])
	if pos.size() != 3:
		return false
	var player := _find_player()
	if player != null:
		player.global_position = Vector3(float(pos[0]), float(pos[1]), float(pos[2]))
	return true


func _migrate_step(from_version: int, data: Dictionary) -> Variant:
	match from_version:
		1:
			## 나무 하나뿐이던 시절의 fruit_count를 items["과일"]로.
			data["items"] = {"과일": int(data.get("fruit_count", 0))}
			data["used"] = {}
			data.erase("fruit_count")
			data["version"] = 2
			return data
		_:
			return null


func _find_player() -> Node3D:
	var found := get_tree().get_nodes_in_group("player")
	return found[0] if found.size() > 0 else null
