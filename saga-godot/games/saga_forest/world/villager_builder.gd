extends Node3D

## VERTICAL_SLICE_FOREST.md 4절 "제외" 목록 3번 착수 — 주민 5명 전체(+
## 첫 슬라이스의 숲지기 1명 = 총 6명) + 부탁(퀘스트)·선물. 웹판
## data-village.js NPCS/QUESTS 조사 결과: 여섯(+배달원)이 각자 하나씩
## "한 번뿐인 부탁"을 들고 있고(부탁 타입은 bagcat/chest/meetnpc 셋),
## 선물은 사람마다 좋아하는 채집물 갈래가 있어 맞혀 주면 정(친밀도)이
## 더 는다.
##
## **재해석한 부분(그대로 못 옮긴 것, 근거를 남겨 둔다):**
## - keeper(숲지기)의 원래 부탁은 "동굴 보물"(chest 타입) — 이 슬라이스엔
##   보물상자 시스템이 없어 bagcat(과일)로 바꿨다.
## - herbalist(약초꾼)의 원래 부탁은 "약초 다섯 뿌리" — 버섯숲 바이옴(4절
##   "제외" 목록 7번, 아직 없음) 전용 채집물이라 bagcat(광석)으로 바꿨다.
## - **배달원(courier)은 이번에 안 넣는다** — QUESTS 표가 없는 유일한
##   예외(반복 가능한 일거리라 "한 번뿐" 부탁 모델과 안 맞음, 택배 접수대
##   같은 새 사물도 필요)라 범위를 넘는다.
## - **편지(mail.js)는 이번에 안 넣는다** — 원작에서 편지는 "주민(residents)
##   이 이사 오고 나가는" 훨씬 큰 마을 시뮬레이션에 물려 있는 기능이라,
##   이 여섯 역할 NPC와는 다른 시스템이다. 얕은 흉내(가짜 편지 한 줄)보다
##   안 만드는 쪽을 골랐다 — 다음에 그 마을 시뮬레이션 자체를 만들 때
##   같이 볼 것.
##
## 나머지(angler·merchant·explorer·wanderer)의 부탁은 웹판 그대로(문구·
## 보상 금액도 같다) — 필요한 채집물이 이미 이 슬라이스에 다 있다.

const ForestMap := preload("res://games/saga_forest/data/village_map.gd")
const TerrainBuilder := preload("res://games/saga_forest/world/forest_terrain_builder.gd")
const WorldCurveMaterial := preload("res://saga_core/world/world_curve_material.gd")
const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
## PLAN 103-1 spritegen.py 산출물(09-20, 그동안 어디서도 안 쓰였다) — 관계
## 메뉴 제목의 "(♥%d)" 숫자 대신 실제 하트 한 줄로 보여준다. ChoicePrompt
## 자체(5판 39곳 공유)는 안 건드리고, 그 패널 바로 위에 별도 줄을 하나
## 더 얹는 방식(같은 CanvasLayer의 형제 자식이라 선택지를 고르면 같이
## `queue_free()` 된다 — 새 정리 로직 불필요).
const HEART_ICON_FILLED := preload("res://assets/generated/sprites/icon_heart_filled.png")
const HEART_ICON_EMPTY := preload("res://assets/generated/sprites/icon_heart_empty.png")

const TALK_RADIUS := 5.0
const TALK_GAP_SEC := 45.0
const LINE_SHOW_SEC := 4.0
const CURVE_AMOUNT := 0.004

## 선물로 줄 수 있는 갈래 — 이 슬라이스의 채집물 다섯 그대로(웹판
## GIFT_CATS는 곤충·조개·화석도 포함하지만 그건 아직 없는 도감 계열이다).
## "교배꽃"·"진교배꽃"도 더한다(SELL_BASE_PRICE 주석 참고) — 상인의
## gift_like는 정확히 "꽃"이라 이 둘을 줘도 "좋아하는 선물"은 아니지만
## (그건 의도대로다, 교배종은 팔아서 값을 받는 쪽이 낫다), 팔 생각이
## 없다면 선물로라도 쓸 수 있어야 막다른 항목이 아니게 된다.
const GIFT_CATS := ["과일", "솔방울", "광석", "꽃", "물고기", "교배꽃", "진교배꽃"]

## explorer의 meetnpc 부탁 — 웹판이 "count = 로스터 크기-1"로 두는 것과
## 같은 자리(설명은 아래 _quest_progress() 참고). 로스터가 6명이라 5.
const ROSTER_SIZE := 6

## 제외 목록 6번(계절행사 8일) 착수 — 웹판 town.js priceMul()이 값을
## 가지려면 "판다"(sell) 동작 자체가 있어야 하는데 이 슬라이스엔 없었다.
## 상인에게 최소한의 판매를 얹었다 — 종별로 값이 갈리는 웹판 ITEMS
## 카탈로그(예: 과일 안에 능금 40·복숭아 70…)를 갈래 하나로 이미
## 단순화해 둔 이 슬라이스(museum.gd와 같은 단순화 방향)에 맞춰, 갈래별
## **가장 흔한(제일 싼) 종의 값** 하나만 기준가로 삼는다(웹판
## data-village.js ITEMS 그대로: 능금40·밤35·철석80·진달래30·배추흰나비40·
## 붕어50). ForestFestival.price_mul()이 오늘이 그 갈래의 행사날이면
## 배율을 곱한다.
## "약초"(제외 목록 7번, 버섯숲 바이옴 전용 채집물) 추가 — 웹판
## data-village.js ITEMS.herb의 가장 싼 종(쑥, 45)을 기준가로.
##
## "교배꽃"·"진교배꽃"(2026-09-15, forest_planting.gd 교배 깊이 추가와 함께) —
## 이전엔 심어서 얻어도 팔 곳도 선물할 곳도 없는 막다른 항목이었다. 꽃(30)
## 기준으로 교배는 4배(120, 그냥 곁에 심기만 하면 노려볼 수 있는 첫 단),
## 진교배는 10배(300, 이미 하이브리드 곁에 심어야만 나오는 둘째 단) —
## 들이는 수고(자리·시간·해시 운)에 비례해 값을 올렸다.
const SELL_BASE_PRICE := {
	"과일": 40, "솔방울": 35, "광석": 80, "꽃": 30, "곤충": 40, "물고기": 50, "약초": 45,
	"교배꽃": 120, "진교배꽃": 300,
}

const VILLAGERS := [
	{"id": "npc_keeper", "name": "숲지기", "line": "이 숲은 내가 돌본다 — 짐승을 함부로 놀라게 하지 마시게",
	 "heart_line": "자네가 다녀간 뒤로 숲이 덜 사나워졌어 — 고맙네, 정말로.",
	 "grid": Vector2i(19, 9),
	 "gift_like": "과일",
	 "quest": {"title": "숲의 몫", "type": "bagcat", "item_label": "과일", "count": 5, "reward": 300,
		"desc": "겨울 채비로 과일을 다섯 개만 나눠 주게"}},
	{"id": "npc_angler", "name": "낚시꾼", "line": "이 물엔 씨알 좋은 놈들이 산다네",
	 "heart_line": "자네랑 나란히 낚싯대 드리우는 게 요즘 제일 낙이야.",
	 "grid": Vector2i(26, 5),
	 "gift_like": "물고기",
	 "quest": {"title": "씨알 좋은 물고기", "type": "bagcat", "item_label": "물고기", "count": 3, "reward": 350,
		"desc": "물고기 세 마리만 낚아다 주게"}},
	{"id": "npc_merchant", "name": "상인", "line": "먼 길 다니며 이것저것 모았지 — 나중에 풀어놓겠네",
	 "heart_line": "자네한테는 값 안 매기고 그냥 줘도 아깝지 않겠어.",
	 "grid": Vector2i(5, 14),
	 "gift_like": "꽃",
	 "quest": {"title": "꽃 다섯 송이", "type": "bagcat", "item_label": "꽃", "count": 5, "reward": 300,
		"desc": "꽃 다섯 송이만 모아다 주게 — 팔 데가 있어"},
	 ## 제외 목록 4번(화석 채집엔 삽이 있어야 한다, gatherable_builder.gd
	 ## 참고) — 웹판 buyTool()의 삽(700G)을 상인이 판다. 새 NPC를 안
	 ## 만들고 이미 있는 "상인"에게 얹었다.
	 "sells_tool": {"key": "spade", "name": "삽", "price": 700}},
	{"id": "npc_explorer", "name": "탐험가", "line": "이 폭포 너머에 뭐가 있는지 아직 아무도 몰라",
	 "heart_line": "다음에 폭포 너머로 갈 땐 자네부터 부르겠네.",
	 "grid": Vector2i(25, 8),
	 "gift_like": "광석",
	 "quest": {"title": "숲의 나머지 사람들", "type": "meetnpc", "count": ROSTER_SIZE - 1, "reward": 500,
		"desc": "이 숲 다른 사람들도 다 만나고 왔나?"}},
	{"id": "npc_herbalist", "name": "약초꾼", "line": "버섯 숲엔 좋은 약초가 지천이야",
	 "heart_line": "자네 안색만 봐도 요즘 어디 아픈 데는 없나 먼저 살피게 되네.",
	 "grid": Vector2i(5, 8),
	 "gift_like": "솔방울",
	 "quest": {"title": "광석 세 덩이", "type": "bagcat", "item_label": "광석", "count": 3, "reward": 400,
		"desc": "약을 지으려니 단단한 광석이 세 덩이 필요하네"}},
	{"id": "npc_wanderer", "name": "나그네", "line": "이 외딴집에서 하룻밤 신세 좀 지고 있다네",
	 "heart_line": "자네 덕에 이 숲이 남의 땅 같지 않고 편안해졌네.",
	 "grid": Vector2i(14, 15),
	 "gift_like": "과일",
	 "quest": {"title": "길양식", "type": "bagcat", "item_label": "솔방울", "count": 4, "reward": 320,
		"desc": "먼 길 갈 양식으로 솔방울 네 알만 나눠 주게"}},
]

var _last_said_ms := {}
var _in_range := {}


func _ready() -> void:
	for v: Dictionary in VILLAGERS:
		_spawn(v)


func _spawn(v: Dictionary) -> void:
	var ch: String = ForestMap.tile_at(v.grid.x, v.grid.y)
	var ground: float = TerrainBuilder.LEGEND[ch].height

	var root := Node3D.new()
	root.name = "Villager_%s" % v.id
	root.position = ForestMap.world_pos(v.grid.x, v.grid.y) + Vector3(0, ground, 0)
	root.add_to_group("codex_discoverable")
	add_child(root)

	root.add_child(_build_body(String(v.id)))

	var area := Area3D.new()
	area.name = "TalkArea"
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = TALK_RADIUS
	cs.shape = shape
	area.add_child(cs)
	root.add_child(area)
	area.body_entered.connect(_on_body_entered.bind(v))
	area.body_exited.connect(_on_body_exited.bind(v))

	_last_said_ms[v.id] = -TALK_GAP_SEC * 1000.0
	_in_range[v.id] = false


## G-0030 — 옛 Kenney 블록 대신 새 인물 몸(주민 id 해시로 299 중 하나). 숲은 구면 투영이라 셀 셰이더 대신
## 표면마다 원본 그림을 곡률 재질로 다시 입힌다(머리카락·속눈썹처럼 투명한 면은 컷아웃). 새 몸이 없으면 VroidBody 가 오류·빈 몸.
func _build_body(id: String) -> Node3D:
	var body := VroidBody.build(id, 2)
	for mi in body.find_children("*", "MeshInstance3D", true, false):
		var m := (mi as MeshInstance3D).mesh
		if m == null:
			continue
		for i in m.get_surface_count():
			var src := m.surface_get_material(i) as BaseMaterial3D
			if src == null or src.albedo_texture == null:
				continue
			var cut := src.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED
			(mi as MeshInstance3D).set_surface_override_material(i, WorldCurveMaterial.cutout_material(src.albedo_texture, CURVE_AMOUNT, 0.9, 0.3) if cut 				else WorldCurveMaterial.textured_material_from(src.albedo_texture, CURVE_AMOUNT))
	return body


func _on_body_entered(body: Node3D, v: Dictionary) -> void:
	if not body.is_in_group("player"):
		return
	_in_range[v.id] = true
	ForestSaveState.mark_met(v.id)

	var now := Time.get_ticks_msec()
	if now - _last_said_ms[v.id] < TALK_GAP_SEC * 1000.0:
		return
	_last_said_ms[v.id] = now
	_talk(v)


func _on_body_exited(body: Node3D, v: Dictionary) -> void:
	if body.is_in_group("player"):
		_in_range[v.id] = false


## 웹판 talkNpc() 그대로 — 부탁을 이미 마쳤으면 인사말, 안 마쳤는데
## 조건을 채웠으면 그 자리에서 마치고 보상, 아직이면 진행 상황.
##
## **2026-09-17 추가 — PLAN 101-2 FOREST ②후보 "관계 하트"(웹판 §5.4).**
## "대화(하루 1회 +1)"는 이 함수가 곧 웹판 onTalk()이라 여기서 한 번만
## 매긴다(어느 분기로 빠지든 하루에 한 번). 세배·부탁 완수 분기는 §5.4가
## 딸린 값(+2 각각)을 그대로 더한다.
func _talk(v: Dictionary) -> void:
	if not ForestSaveState.talked_today(v.id):
		ForestSaveState.mark_talked(v.id)
		_gain_heart(v, 1)

	## 설날 — 첫 인사는 세배다(웹판과 같은 우선순위, "부탁"보다 먼저 본다).
	## 사람마다 하루 한 번, 친밀도가 깊을수록 두둑하다(500 + 친밀도*150,
	## 웹판 village.js talk() 그대로).
	if ForestFestival.is_new_year() and not ForestSaveState.has_bowed_today(v.id):
		var money: int = 500 + ForestSaveState.heart(v.id) * 150
		ForestSaveState.add_gold(money)
		ForestSaveState.mark_bowed(v.id)
		_gain_heart(v, 2)
		Toast.show(self, "%s — 새해 복 많이 받으시오. 🧧 💰 +%d" % [v.name, money], LINE_SHOW_SEC)
		return

	if ForestSaveState.is_quest_done(v.id):
		## 5♥ 해제 — 고유 대화 한 줄(웹판 §5.4 "5♥ 고유 대화 3"을 하나로
		## 좁혔다, 이 슬라이스엔 부탁을 하나만 두는 주민 구조라 그렇다).
		var line: String = v.get("heart_line", "") if ForestSaveState.heart(v.id) >= 5 else String(v.line)
		Toast.show(self, "%s — %s" % [v.name, line], LINE_SHOW_SEC)
		return

	var q: Dictionary = v.quest
	var prog := _quest_progress(q)
	if prog.have < prog.need:
		Toast.show(self, "%s — %s (%d/%d)" % [v.name, q.desc, prog.have, prog.need], LINE_SHOW_SEC)
		return

	ForestSaveState.mark_quest_done(v.id)
	if q.type == "bagcat":
		ForestSaveState.items[q.item_label] = ForestSaveState.item_count(q.item_label) - int(q.count)
	ForestSaveState.add_gold(int(q.reward))
	_gain_heart(v, 2)
	Toast.show(self, "%s — 「%s」을 마쳤다! 💰 +%d" % [v.name, q.title, q.reward], LINE_SHOW_SEC)


## PLAN 101-2 FOREST ②후보 "관계 하트" 공용 진입점 — 하루 상한(§5.4 "+4")과
## 0~10 clamp는 ForestSaveState.gain_affinity()가 맡는다. _give_gift()는
## 상한에 걸렸는지(applied < up) 토스트에 보여줘야 해서 gain_affinity()를
## 직접 부르고 _check_heart_reward()만 따로 부른다 — 이 함수는 그 둘을
## 한 번에 묶은 것뿐(대화·세배·부탁 완수처럼 적용량을 따로 안 보는 곳).
func _gain_heart(v: Dictionary, amount: int) -> void:
	ForestSaveState.gain_affinity(v.id, amount)
	_check_heart_reward(v)


## **10♥ 해제**(웹판 §5.4 "10♥ 인물 기념품 1") — 이 슬라이스엔 인물별
## 가구 카탈로그가 없어(forest_house.gd 창고는 ForestHome.daily_shop()이
## 도는 공용 목록뿐) **재해석**: 가구 대신 한 번뿐인 기념 사례금으로 좁혔다.
func _check_heart_reward(v: Dictionary) -> void:
	if ForestSaveState.heart(v.id) >= 10 and not ForestSaveState.heart_reward_10.get(v.id, false):
		ForestSaveState.heart_reward_10[v.id] = true
		ForestSaveState.add_gold(2000)
		Toast.show(self, "%s — 10년이 가도 한결같구먼, 이 마음이나 받아두게. 💰 +2000" % v.name, LINE_SHOW_SEC)


## bagcat(가방 속 채집물 개수)·meetnpc(만난 주민 수) 둘만 안다 — 웹판
## questProgress()와 같은 범위(chest는 이 슬라이스에 없어 빼뒀다, 위
## 상단 주석 "재해석한 부분" 참고).
func _quest_progress(q: Dictionary) -> Dictionary:
	if q.type == "meetnpc":
		return {"have": ForestSaveState.met_count(), "need": int(q.count)}
	return {"have": ForestSaveState.item_count(q.item_label), "need": int(q.count)}


func _process(_delta: float) -> void:
	for v: Dictionary in VILLAGERS:
		if _in_range.get(v.id, false) and Input.is_action_just_pressed("forest_gather"):
			_open_interact_menu(v)


## G를 누르면 선물(+상인만 도구 구매·순무 사고팔기)을 고르는 메뉴 —
## 부탁은 자동으로 진행되니(위 _talk()) 여기엔 안 나온다. 선물은 사람마다
## 하루 한 번, 좋아하는 갈래를 맞히면 친밀도가 더 는다(웹판 giveGift()와
## 같은 배율: 3배 아니면 1배).
func _open_interact_menu(v: Dictionary) -> void:
	var layer_box := {}
	var choices: Array = []

	if v.has("sells_tool"):
		var tool: Dictionary = v.sells_tool
		if not ForestSaveState.has_tool(tool.key):
			choices.append({
				"label": "%s 사기 (💰%d)" % [tool.name, tool.price],
				"cb": func() -> void: _buy_tool(v, tool, layer_box),
			})

	## 제외 목록 5번(순무 시세) — 웹판의 "전방"(순무를 사고파는 자리)을
	## 새 사물 없이 상인에게 얹었다(도구 판매와 같은 이유). 사는 건 열 개
	## 단위 한 번뿐(웹판은 900개까지 원하는 대로 사지만, 이 슬라이스는
	## 수량 선택 UI를 안 만든다 — 여러 번 눌러 더 살 수 있다), 파는 건
	## 가진 것을 한 번에 다 판다(웹판 sellAll() 그대로).
	if v.id == "npc_merchant":
		if ForestTurnip.market_open():
			var buy_price: int = ForestTurnip.buy_price()
			choices.append({
				"label": "🥬 순무 %d개 사기 (💰%d)" % [ForestTurnip.UNIT, buy_price * ForestTurnip.UNIT],
				"cb": func() -> void: _trade_turnip(v, true, layer_box),
			})
		if ForestSaveState.has_turnip():
			var n: int = int(ForestSaveState.turnip.get("n", 0))
			var price: int = ForestSaveState.turnip_now_price()
			choices.append({
				"label": "🥬 순무 팔기 (%d개, 개당 💰%d)" % [n, price],
				"cb": func() -> void: _trade_turnip(v, false, layer_box),
			})

		## 제외 목록 6번(계절행사 8일) — 이 갈래들을 판다(SELL_BASE_PRICE
		## 상단 주석 참고). 오늘이 그 갈래의 행사날이면 값이 오른다.
		for cat in SELL_BASE_PRICE:
			if ForestSaveState.item_count(cat) > 0:
				var unit: int = int(round(float(SELL_BASE_PRICE[cat]) * ForestFestival.price_mul(cat)))
				choices.append({
					"label": "%s 팔기 (%d개, 개당 💰%d)" % [cat, ForestSaveState.item_count(cat), unit],
					"cb": func() -> void: _sell_items(v, cat, unit, layer_box),
				})

		## 제외 목록 6번(옷·침선방) — 새 건물 없이 상인에게 얹었다(도구·
		## 순무와 같은 이유). 넷 중 하나를 고르는 메뉴로 한 번 더 들어간다
		## (겉옷·머리·옷 빛·덧옷 스물한 종을 한 메뉴에 다 늘어놓으면 너무 길다).
		choices.append({
			"label": "🧵 옷(침선방)",
			"cb": func() -> void: _open_wear_menu(v, layer_box),
		})

	if not ForestSaveState.gifted_today(v.id):
		for cat in GIFT_CATS:
			if ForestSaveState.item_count(cat) > 0:
				choices.append({
					"label": "%s 주기 (%d개 있음)" % [cat, ForestSaveState.item_count(cat)],
					"cb": func() -> void: _give_gift(v, cat, layer_box),
				})

	if choices.is_empty():
		Toast.show(self, "%s — 지금은 딱히 할 게 없다." % v.name, 2.0)
		return

	## GDScript 람다는 바깥 지역 변수를 "생성 시점 값"으로 캡처한다 —
	## test_room.gd의 은사 선택지·npc_builder.gd의 사명 제안과 같은
	## layer_box 우회(ChoicePrompt.build() 호출 전에 만든 콜백이 그 결과를
	## 미리 참조할 수 없어서다).
	var layer: CanvasLayer = ChoicePrompt.build(self, v.name, choices)
	layer_box["layer"] = layer
	_add_heart_row(layer, ForestSaveState.heart(v.id))


## choice_prompt.gd 패널(가운데 정렬, 위 끝 = 패널 offset_top)의 바로 위 한 줄에
## 하트 10개(채움/빔)를 그린다 — 패널 내부에 끼워 넣지 않는 건 그 스크립트가
## 5판 39곳에서 같은 모양(제목+버튼 목록)만 가정하고 있어, 새 줄 하나 때문에
## 공유 코드를 건드리고 싶지 않아서다.
## G-0064 — 자리는 패널 위 끝에서 잰다(G-0052 에서 선택 창이 커지고 가운데 정렬이 돼 옛 고정 자리 -146 은 창 안 제목에 겹쳤다).
const HEART_PX := 40.0   # 그림 안 하트가 칸의 절반쯤이라(여백) 28 은 가로 창에서 8px 로 보였다
const HEART_GAP := 4
static func _add_heart_row(layer: CanvasLayer, heart: int) -> void:
	var panel_top := -120.0
	for c in layer.get_children():
		if c is PanelContainer:
			panel_top = (c as PanelContainer).offset_top
			break
	var w := HEART_PX * 10.0 + HEART_GAP * 9.0
	var row := HBoxContainer.new()
	row.name = "HeartRow"
	row.anchor_left = 0.5
	row.anchor_right = 0.5
	row.anchor_top = 0.5
	row.anchor_bottom = 0.5
	row.offset_left = -w * 0.5
	row.offset_right = w * 0.5
	row.offset_bottom = panel_top - 6.0
	row.offset_top = row.offset_bottom - HEART_PX
	row.add_theme_constant_override("separation", HEART_GAP)
	layer.add_child(row)
	for i in range(10):
		var t := TextureRect.new()
		t.texture = HEART_ICON_FILLED if i < heart else HEART_ICON_EMPTY
		t.custom_minimum_size = Vector2(HEART_PX, HEART_PX)
		t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		row.add_child(t)


func _buy_tool(v: Dictionary, tool: Dictionary, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	if ForestSaveState.buy_tool(tool.key, int(tool.price)):
		Toast.show(self, "%s 에게서 %s 을(를) 샀다." % [v.name, tool.name], LINE_SHOW_SEC)
	else:
		Toast.show(self, "골드가 모자란다 (💰%d 필요)" % int(tool.price), 2.5)


func _trade_turnip(v: Dictionary, buying: bool, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	if buying:
		var price := ForestTurnip.buy_price()
		var err := ForestSaveState.buy_turnip(ForestTurnip.UNIT)
		if err.is_empty():
			Toast.show(self, "🥬 순무 %d개를 샀다 (개당 💰%d · 모두 💰%d)" %
				[ForestTurnip.UNIT, price, price * ForestTurnip.UNIT], LINE_SHOW_SEC)
		else:
			Toast.show(self, "%s — %s" % [v.name, err], 2.5)
	else:
		Toast.show(self, ForestSaveState.sell_turnip(), LINE_SHOW_SEC)


func _sell_items(v: Dictionary, cat: String, unit_price: int, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	var revenue := ForestSaveState.sell_items(cat, unit_price)
	Toast.show(self, "%s 에게 %s 을(를) 팔았다 — 💰 +%d" % [v.name, cat, revenue], LINE_SHOW_SEC)


## 침선방 1단계 — 넷(겉옷·머리·옷 빛·덧옷) 중 어느 칸을 볼지.
func _open_wear_menu(v: Dictionary, outer_layer_box: Dictionary) -> void:
	(outer_layer_box["layer"] as CanvasLayer).queue_free()
	var layer_box := {}
	var choices: Array = []
	for p: Dictionary in ForestWear.PARTS:
		var now := ForestWear.item(p.key, ForestSaveState.wearing(p.key))
		choices.append({
			"label": "%s (지금: %s)" % [p.name, now.get("name", "?")],
			"cb": func() -> void: _open_wear_part_menu(v, p, layer_box),
		})
	layer_box["layer"] = ChoicePrompt.build(self, "침선방", choices)


## 침선방 2단계 — 그 칸에서 고를 수 있는 것들. 안 가진 것은 "사기"(사면
## 곧바로 입는다), 가진 것은 "입기", 지금 입은 것은 상태만 보여준다.
func _open_wear_part_menu(v: Dictionary, part: Dictionary, outer_layer_box: Dictionary) -> void:
	(outer_layer_box["layer"] as CanvasLayer).queue_free()
	var layer_box := {}
	var choices: Array = []
	for it: Dictionary in (part.list as Array):
		var owned: bool = ForestSaveState.owns_wear(part.key, it.key)
		var wearing_now: bool = ForestSaveState.wearing(part.key) == it.key
		var label: String
		if wearing_now:
			label = "%s (입은 중)" % it.name
		elif owned:
			label = "%s 입기" % it.name
		else:
			label = "%s 사기 (💰%d)" % [it.name, int(it.price)]
		choices.append({
			"label": label,
			"cb": func() -> void: _choose_wear(v, part.key, it.key, int(it.price), layer_box),
		})
	layer_box["layer"] = ChoicePrompt.build(self, part.name, choices)


func _choose_wear(v: Dictionary, part: String, key: String, price: int, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	if ForestSaveState.wearing(part) == key:
		Toast.show(self, "이미 입고 있다.", 2.0)
		return
	if not ForestSaveState.owns_wear(part, key):
		if not ForestSaveState.buy_wear(part, key, price):
			Toast.show(self, "골드가 모자란다 (💰%d 필요)" % price, 2.5)
			return
	ForestSaveState.set_wear(part, key)
	Toast.show(self, "🧵 %s (으)로 갈아입었다." % ForestWear.item(part, key).name, LINE_SHOW_SEC)


func _give_gift(v: Dictionary, cat: String, layer_box: Dictionary) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	ForestSaveState.items[cat] = ForestSaveState.item_count(cat) - 1
	ForestSaveState.mark_gifted(v.id)
	var loved: bool = cat == v.gift_like
	var up: int = 3 if loved else 1
	var applied := ForestSaveState.gain_affinity(v.id, up)
	_check_heart_reward(v)
	Toast.show(self, "%s%s 에게 %s 을(를) 건넸다 — 친밀도 +%d%s" %
		["아주 반긴다! " if loved else "", v.name, cat, applied,
			" (오늘 상한)" if applied < up else ""], LINE_SHOW_SEC)
