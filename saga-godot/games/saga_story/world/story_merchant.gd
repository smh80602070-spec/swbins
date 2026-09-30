extends Node3D

## VERTICAL_SLICE_STORY.md 1절 "제외" 목록 "장비/노획"의 상점 걸음.
##
## **재해석** — 원작(`js/ui.js` 'talk-shop')은 마을(허도) NPC 'merchant'와
## 대화해 여는 물목 화면(가방에 담고 따로 장착)이다. 이 슬라이스는 아직
## 마을이 없고(나머지 사냥터 8곳·문(portal)과 함께 묶인 별도 항목,
## docs/PROJECT_STATE.md 참고) 가방도 없다(줍는 즉시 장착하는 이 포트의
## 기존 규칙, story_gear_pickup.gd). 그래서 상인을 **이 사냥터 안에 하나
## 세워**, 다가가 상호작용하면 상인이 뜬다. "이동 상인"(side.js MERCHANT_DUR
## 할인 버프)도 이번엔 안 옮긴다.
##
## **2026-09-13 추가 — 물목을 고르는 화면(자동구매 대체).** 처음엔
## "가장 싼 것을 알아서 산다"로 좁혔었는데(_buy_cheapest_missing()), 사용자가
## saga-godot 완성도를 물어본 김에 훑어보니 `games/saga_go/ui/choice_prompt.gd`
## (ChoicePrompt)가 이미 DUNGEON 행상(vendor_button.gd)·FOREST 사고(museum.gd)·
## REALM 서고 등에서 재사용되는 공용 선택지 목록이었다 — 이 판만 안 붙였을
## 뿐, PLAN.md 7장 "공통 시스템 재사용"대로 그대로 갖다 쓴다. **목록이 마흔
## 개(GEAR_ITEMS 전부)로 안 넘치게, 부위(열 곳)마다 지금 살 수 있는 것 중
## 가장 싼 것 하나만 올린다** — 가격이 tier와 정비례해 이게 곧 "그 부위의
## 다음 승급" 하나뿐이다(ChoicePrompt엔 스크롤 컨테이너가 없어 REALM 서고가
## 20개로 자체 상한을 둔 것과 같은 이유). 주문서 일곱 개는 전부 늘어놓는다
## (원작 `ui.js viewShop()`이 주문서를 부위로 안 좁히던 것 그대로) —
## `can_scroll()`로 지금 못 쓰는 것만 거른다.
##
## 가격(price)·상품 목록은 story_combat.gd GEAR_ITEMS/SCROLLS를 그대로
## 읽는다 — 데이터를 새로 안 만든다(PLAN.md 7장).

const StoryNpcBody := preload("res://games/saga_story/world/story_npc_body.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const StoryCombat := preload("res://games/saga_story/data/story_combat.gd")

const BODY_COLOR := Color(0.72, 0.18, 0.2)  # 상인 — 다른 NPC 도입 전까지 이 판 유일의 붉은 톤
const RANGE_RADIUS := 1.8

var _player_in_range := false
var _shop_open := false
var _area: Area3D


func _ready() -> void:
	_spawn_visual()
	_spawn_area()


func _spawn_visual() -> void:
	## 2026-09-30 — 색 캡슐 대신 VRoid 몸(story_npc_body.gd).
	add_child(StoryNpcBody.build("merchant"))


func _spawn_area() -> void:
	_area = Area3D.new()
	_area.name = "MerchantRange"
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = RANGE_RADIUS
	cs.shape = shape
	_area.add_child(cs)
	_area.position = Vector3(0, 0.85, 0)
	_area.body_entered.connect(_on_range_entered)
	_area.body_exited.connect(_on_range_exited)
	add_child(_area)


func _on_range_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	_player_in_range = true
	Toast.show(self, "🏪 상인 — K: 물목을 본다", 2.0)


func _on_range_exited(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	_player_in_range = false


## story_player.gd `_physics_process()`와 같은 폴링 방식(Input.is_action_
## just_pressed) — 이 판은 `_unhandled_input` 이벤트 콜백을 안 쓴다.
## `_shop_open`이 열려 있는 동안은 다시 안 연다 — ChoicePrompt에는 모달
## 차단이 없어(패널 뒤 입력이 그대로 통과) 안 막으면 겹쳐 쌓인다.
func _process(_delta: float) -> void:
	if _player_in_range and not _shop_open and Input.is_action_just_pressed("story_interact"):
		_open_shop()


## 부위마다(열 곳) 지금 낄 수 있고(need<=level) 아직 안 낀 것 중 가장
## 싼 것 하나 — story_gear_pickup.gd·이전 버전의 부위별 최솟값 로직과
## 같은 계산, 이번엔 "부위 전체 후보"를 골라 화면에 늘어놓는 쪽으로 쓴다.
func _gear_offers() -> Array:
	var best_by_slot: Dictionary = {}
	for key: String in StoryCombat.GEAR_ITEMS:
		var it: Dictionary = StoryCombat.GEAR_ITEMS[key]
		if int(it.need) > StorySaveState.level:
			continue
		var slot := String(it.slot)
		if String(StorySaveState.equipped.get(slot, "")) == key:
			continue
		var price := int(it.price)
		var cur: Dictionary = best_by_slot.get(slot, {})
		if cur.is_empty() or price < int(cur.price):
			best_by_slot[slot] = {"key": key, "price": price}
	var out: Array = []
	for slot: String in StoryCombat.SLOT_LABEL:
		if best_by_slot.has(slot):
			out.append(String(best_by_slot[slot].key))
	return out


## 지금 적용 가능한(can_scroll) 주문서 키 — 무기면 무기 슬롯, 방어구면
## 아홉 슬롯 중 하나라도 열려 있으면 그 종류 전부를 후보에 올린다.
func _scroll_offers() -> Array:
	var weapon_ready := StorySaveState.can_scroll("weapon")
	var armor_ready := false
	for slot: String in StoryCombat.ARMOR_SLOTS:
		if StorySaveState.can_scroll(slot):
			armor_ready = true
			break
	var out: Array = []
	for key: String in StoryCombat.SCROLLS:
		var kind_for := String(StoryCombat.SCROLLS[key].get("for", ""))
		if (kind_for == "weapon" and weapon_ready) or (kind_for == "armor" and armor_ready):
			out.append(key)
	return out


func _open_shop() -> void:
	var gear_offers := _gear_offers()
	var scroll_offers := _scroll_offers()
	if gear_offers.is_empty() and scroll_offers.is_empty():
		Toast.show(self, "🏪 지금 살 수 있는 게 없다", 2.0)
		return

	var layer_box := {}
	var choices: Array = []
	for key: String in gear_offers:
		var it: Dictionary = StoryCombat.GEAR_ITEMS[key]
		var label: Dictionary = StoryCombat.SLOT_LABEL[String(it.slot)]
		choices.append({
			"label": "%s %s(%s) · 🪙 %d" % [String(label.emoji), String(it.name), String(label.name), int(it.price)],
			"cb": func() -> void: _on_gear_picked(key, layer_box),
		})
	for key: String in scroll_offers:
		var sc: Dictionary = StoryCombat.SCROLLS[key]
		choices.append({
			"label": "📜 %s · 🪙 %d" % [String(sc.name), int(sc.price)],
			"cb": func() -> void: _on_scroll_picked(key, layer_box),
		})

	_shop_open = true
	layer_box["layer"] = ChoicePrompt.build(get_tree().current_scene, "🏪 상인 — 무엇을 살까", choices)


func _close_shop(layer_box: Dictionary) -> void:
	var layer: Variant = layer_box.get("layer")
	if layer is CanvasLayer and is_instance_valid(layer):
		(layer as CanvasLayer).queue_free()
	_shop_open = false


func _on_gear_picked(key: String, layer_box: Dictionary) -> void:
	_close_shop(layer_box)
	var it: Dictionary = StoryCombat.GEAR_ITEMS[key]
	var price := int(it.price)
	if not StorySaveState.spend_gold(price):
		Toast.show(self, "🪙 금이 모자라다 (%d / 보유 %d)" % [price, StorySaveState.gold], 2.5)
		return
	StorySaveState.equip_gear(key)
	Toast.show(self, "🏪 %s 구매 · 🪙 -%d" % [String(it.name), price], 2.5)


## **재해석 — 가방 없이 "사는 즉시 적용".** 원작은 가방에 쌓아 뒀다 원하는
## 물건(uid)에 골라 쓰지만, 이 포트엔 가방도 물건 인스턴스도 없다 — 무기
## 주문서는 무기 슬롯, 방어구 주문서는 지금 낀 방어구 슬롯(ARMOR_SLOTS
## 아홉 곳) 중 아직 업횟이 남은 곳을 무작위로 골라 붓는다.
func _on_scroll_picked(key: String, layer_box: Dictionary) -> void:
	_close_shop(layer_box)
	var sc: Dictionary = StoryCombat.SCROLLS[key]
	var price := int(sc.price)
	if not StorySaveState.spend_gold(price):
		Toast.show(self, "🪙 금이 모자라다 (%d / 보유 %d)" % [price, StorySaveState.gold], 2.5)
		return
	var target_slot: String = "weapon" if String(sc.get("for", "")) == "weapon" else _pick_armor_slot()
	var hit := StorySaveState.apply_scroll(target_slot, sc)
	if hit:
		Toast.show(self, "✨ %s 성공 · 🪙 -%d" % [String(sc.name), price], 2.5)
	else:
		Toast.show(self, "💨 %s 실패(업횟만 닳음) · 🪙 -%d" % [String(sc.name), price], 2.5)


## ARMOR_SLOTS 중 지금 낄 수 있는(equip 상태 + 업횟 남음) 곳을 무작위로
## 하나 고른다 — _scroll_offers()가 armor_ready를 이미 확인했으니 최소
## 하나는 있다.
func _pick_armor_slot() -> String:
	var candidates: Array[String] = []
	for slot: String in StoryCombat.ARMOR_SLOTS:
		if StorySaveState.can_scroll(slot):
			candidates.append(slot)
	return candidates[randi() % candidates.size()]
