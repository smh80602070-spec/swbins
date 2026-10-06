extends Node3D

## VERTICAL_SLICE.md 26절 — 주민 1~2명(대화만, 등용 대상 아님).
## PLAN.md Phase 8의 86·87단계(NPC 시스템·Dialogue 시스템)를 이 슬라이스
## 범위로 좁혀 구현한다. 이름·대사는 웹판 js/npc.js를 그대로 가져오되
## (LEGACY_FEATURE_AUDIT.md 참고), 하루 일과·날씨·LOD는 이번 슬라이스
## 범위 밖이라 뺐다 — 자리는 고정, 대사는 한 줄이다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const CelShaderApply := preload("res://saga_core/shaders/cel_shader_apply.gd")
const VroidBody := preload("res://saga_core/world/vroid_body.gd")

const TALK_RADIUS := 14.0
const TALK_GAP_SEC := 45.0
const LINE_SHOW_SEC := 4.0


## 2026-09-11② — GO 사건 다양화(VERTICAL_SLICE §31 "마을의 부탁"). 촌장에게
## quest_* 필드를 추가했다 — 있으면 처음 말 걸었을 때 사명 제안 패널을
## 띄우고, 그 뒤로는 진행/완료 상태에 맞는 대사로 갈아 낀다. 상인은 그대로
## 한 줄뿐인 예전 방식이다(모든 NPC가 사명을 들 필요는 없다).
## 2026-09-11㉒ 지도 확장(+2,+2) — test_map.gd 참고. 촌장·상인의 격자
## 좌표를 그 값만큼 옮겼다(마을 안에서의 상대 위치는 그대로).
const VILLAGERS := [
	{"id": "npc_elder", "name": "마을 촌장", "role": "elder",
	 "line": "이 마을에 무슨 일로 오셨소.",
	 "grid": Vector2i(3, 5),
	 "quest_id": "village_ask", "quest_name": "도적 두목을 물리쳐라",
	 "quest_offer_title": "🙏 마을의 부탁\n\"보아하니 멀리서 오신 분 같은데, 청이 하나 있소. 요 며칠 산길에 도적 두목이 나타나 오가는 이들을 괴롭힌다오. 그자를 물리쳐 주실 수 있겠소?\"",
	 "quest_wait_line": "아직인가... 부디 조심하시게.",
	 "quest_done_line": "정말 고맙소이다! 이 은혜는 잊지 않겠소."},
	{"id": "npc_merchant", "name": "떠돌이 상인", "role": "merchant",
	 "line": "북쪽 산길은 요즘 값이 오르오. 짐꾼을 못 구해서.",
	 "grid": Vector2i(6, 5),
	 "offer_title": "🧺 길 위의 상인\n\"수레가 무거워 못 가겠소. 값은 후하게 쳐 드리리다.\"",
	 "offer_a_label": "짐을 덜어 준다", "offer_a_outcome": "상인이 등용서와 사료를 얹어 주었다.",
	 "offer_a_exp": 8.0,
	 "offer_b_label": "지나간다", "offer_b_outcome": "수레가 삐걱대는 소리가 뒤로 멀어졌다.",
	 "offer_b_exp": 0.0},
]

## VERTICAL_SLICE.md 26절 "제외" 목록의 "소문 시스템" 착수(2026-09-14).
## **정직하게 밝혀 둔다** — 웹판 js/npc.js도 "소문"(진짜 정보가 퍼지는
## 시스템) 자체는 끝내 안 만들었다. 그 자리 바로 위에 이미 완성해 둔
## 것이 이 LINES/say() — 역할·시각(낮/밤)·천후(비/눈)로 갈리는 한 줄
## 잡담이다("여기가 나중에 소문이 붙을 자리"라는 웹판 주석 그대로). 이
## 슬라이스는 소문 그 자체를 새로 지어내지 않고, 원작이 실제로 완성해
## 둔 이 바로 아래 층(정적인 한 줄을 벗어나 상황마다 바뀌는 잡담)을
## 옮긴다 — 26절이 "고정된 한 줄"을 덜어내려던 취지에 맞는 가장 정직한
## 최소 구현이다. 로스터에 있는 두 역할(elder·merchant)만 옮겼다 —
## 웹판 LINES의 나머지(old·soldier·scholar·herb·smith·ronin·bandit·
## stranger)는 이 슬라이스에 그 역할의 NPC 자체가 없어 옮길 데가 없다.
const LINES := {
	"elder": {"day": "이 마을에 무슨 일로 오셨소.", "night": "밤길은 조심하시오. 강 건너는 특히.",
		"rain": "비가 오면 다리가 미끄럽소. 돌아가시오."},
	"merchant": {"day": "북쪽 산길은 요즘 값이 오르오. 짐꾼을 못 구해서.",
		"night": "오늘 장은 파했소. 내일 남문에서 봅시다.",
		"rain": "비 오는 날은 소금이 안 팔리오."},
}

var _last_said_ms := {}
var _quest_prompt_by_id := {}

func _ready() -> void:
	for v in VILLAGERS:
		_spawn(v)

func _spawn(v: Dictionary) -> void:
	var ch: String = TestMap.tile_at(v.grid.x, v.grid.y)
	var ground: float = TerrainBuilder.height_at("village", TestMap.world_pos(v.grid.x, v.grid.y))  # 09-30 평지 기복 — LEGEND 평탄 값이 아니라 실제 지면

	var root := Node3D.new()
	root.name = "Villager_%s" % v.id
	root.position = TestMap.world_pos(v.grid.x, v.grid.y) + Vector3(0, ground, 0)
	add_child(root)

	var body := _build_body(v)
	root.add_child(body)
	if not body.has_meta("cel_applied"):
		CelShaderApply.apply_to(body)

	var area := Area3D.new()
	area.name = "TalkArea"

	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = TALK_RADIUS
	cs.shape = shape
	area.add_child(cs)
	root.add_child(area)
	area.body_entered.connect(_on_body_entered.bind(v))

	if v.has("quest_id"):
		_quest_prompt_by_id[v.id] = _build_quest_prompt(v)

## 대화만 하는 주민이라 idle 그대로. G-0022·G-0030 — 새 인물 몸(주민 id 해시로 299 중 하나).
func _build_body(v: Dictionary) -> Node3D:
	return VroidBody.build(v.id, 2)

## 지나가다 듣는 한 마디다(웹판 npc.js와 같은 감각) — 누르는 대화창은
## 아니다. 조우 판정에는 손대지 않는다. 사명이 딸린 NPC(촌장)는 처음
## 말 걸었을 때만 제안 패널(_build_quest_prompt)이 뜨고, 그 뒤로는
## 진행/완료 상태에 맞는 한 줄로 갈아 낀다 — event.js village_ask가
## "한 번 맡으면 다시 안 묻는다"는 것과 같은 경계.
func _on_body_entered(body: Node3D, v: Dictionary) -> void:
	if not body.is_in_group("player"):
		return
	CodexState.discover("people", v.id)
	var now := Time.get_ticks_msec()
	var last: int = _last_said_ms.get(v.id, -TALK_GAP_SEC * 1000.0 as int)
	if now - last < TALK_GAP_SEC * 1000.0:
		return
	_last_said_ms[v.id] = now

	if v.has("quest_id"):
		if not QuestState.has_been_offered(v.quest_id):
			CodexState.discover("event", v.quest_id)
			_quest_prompt_by_id[v.id].show()
			return
		if QuestState.active_id == v.quest_id:
			_say(v.name, v.quest_done_line if QuestState.done else v.quest_wait_line)
			return
	if v.has("offer_title") and not EventState.is_resolved(_offer_event_id(v)):
		CodexState.discover("event", _offer_event_id(v))
		_show_offer_prompt(v)
		return
	_say(v.name, _pick_line(v))

## 웹판 js/npc.js say()와 같은 규칙 — 비/눈이면 rain 줄, 아니면 밤/낮 줄,
## 그것도 없으면 v.line(고정 한 줄)으로 되돈다(LINES에 없는 role도 안전).
func _pick_line(v: Dictionary) -> String:
	var set: Dictionary = LINES.get(v.get("role", ""), {})
	if set.is_empty():
		return v.line
	var wkey := Weather.current_key()
	if wkey == "rain" or wkey == "snow":
		return set.get("rain", set.get("day", v.line))
	return set.get("night", set.get("day", v.line)) if TimeOfDay.is_night() else set.get("day", v.line)

## road_merchant 같은 일회성 제안 — 사명과 달리 상시 유지되는 패널을
## 미리 만들어 두지 않고 트리거될 때 그때 세운다(simple_event.gd의
## 사건 패널과 같은 경계). 2026-09-11㉑ 전에는 이 세션 안에서만 기억하고
## 저장/로드로는 안 이어지는 알려진 한계였는데, EventState.gd(다른 사건들과
## 같은 저장 구조)로 옮겨 고쳤다.
func _offer_event_id(v: Dictionary) -> String:
	return "offer_" + v.id

## 2026-09-16 실측으로 잡은 버그 — "선언 후 대입"(var layer; layer =
## ChoicePrompt.build(...))으로 클로저에 자기 자신을 참조시키는 이
## 패턴은 GDScript 람다가 지역 변수를 **생성 시점 값으로 스냅샷 캡처**해
## 실제로는 항상 null을 붙잡는다(참조 캡처가 아니다 — region2_coast.gd
## _show_fisher_offer() 검증 중 버튼을 실제로 눌러 봐서 발견, `layer.
## queue_free()`가 null 위에서 터졌다 — 즉 상인에게 말을 걸고 둘 중
## 아무 선택지나 누르면 크래시했을 자리). realm_attack_button.gd 등
## 다른 ChoicePrompt 호출부가 이미 쓰고 있던 `layer_box := {}` 관용구로
## 맞춘다 — Dictionary는 참조 타입이라 값으로 캡처돼도 나중에 채운
## 내용이 클로저 쪽에도 그대로 보인다.
func _show_offer_prompt(v: Dictionary) -> void:
	var layer_box := {}
	layer_box["layer"] = ChoicePrompt.build(self, v.offer_title, [
		{"label": v.offer_a_label, "cb": func() -> void: _resolve_offer(v, layer_box, v.offer_a_outcome, v.offer_a_exp)},
		{"label": v.offer_b_label, "cb": func() -> void: _resolve_offer(v, layer_box, v.offer_b_outcome, v.offer_b_exp)},
	])

func _resolve_offer(v: Dictionary, layer_box: Dictionary, text: String, exp_reward: float) -> void:
	(layer_box["layer"] as CanvasLayer).queue_free()
	if exp_reward > 0.0:
		PartyState.add_exp(exp_reward)
		text += " (경험 +%d)" % int(exp_reward)
	Toast.show(self, text, LINE_SHOW_SEC)
	EventState.mark_resolved(_offer_event_id(v))

func _build_quest_prompt(v: Dictionary) -> CanvasLayer:
	var layer := ChoicePrompt.build(self, v.quest_offer_title, [
		{"label": "맡는다", "cb": func() -> void:
			_quest_prompt_by_id[v.id].hide()
			QuestState.accept(v.quest_id, v.quest_name)
			_say(v.name, "고맙소, 부디 몸조심하시게.")},
		{"label": "사양한다", "cb": func() -> void:
			_quest_prompt_by_id[v.id].hide()
			QuestState.decline(v.quest_id)
			_say(v.name, "그런가... 아쉽구려.")},
	])
	layer.visible = false
	return layer

func _say(npc_name: String, line: String) -> void:
	Toast.show(self, "%s — %s" % [npc_name, line], LINE_SHOW_SEC)
