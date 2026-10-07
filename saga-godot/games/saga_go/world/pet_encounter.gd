extends Node3D

## PLAN.md 51장 GO 확장 축("월드 확장→탐험→지역→이벤트→수집→희귀
## 몬스터")의 마지막 항목 — `saga_core/data/pets.gd`(신수 11종, 이번에
## 처음 만든 파일)를 처음 쓰는 자리다. hero_encounter.gd와 같은 "가까이
## 가면 창이 뜬다" 골격을 재사용하되, 3라운드 설득 대신 웹판
## encounter.js의 핵심 숫자 하나만(`catchBase` 확률로 한 번에 성패가
## 갈린다) 옮긴다 — 원작의 HP 깎기+미끼 던지기 미니게임은 이 슬라이스
## 범위 밖이다(§37 재미 평가가 묻는 건 "탐험·발견"이지 새 전투 시스템이
## 아니다, DUNGEON 출사표가 원작의 "정해진 셋" 대신 직접 고르기로
## 단순화한 것과 같은 결의 판단).
##
## 첫 걸음은 사신(四神, 청룡·백호·주작·현무) 넷만 지도 네 가장자리(원래
## 동서남북을 지키는 신수라)에 세웠다. **2026-09-14, 이어서 — 나머지
## 일곱(삼족오·해태·구미호·도깨비·불가사리·홍염마·섬영마)도 배치해 11종
## 전부 세계에 나온다.** 새 좌표는 기존 이벤트·NPC·동물 서식지 grid와
## 겹치지 않는 숲(T) 타일 중에서 고르되(TestMap.ROWS 대조), 사신처럼
## 방위 의미를 안 가지니 지도 전체에 고르게 흩었다.
##
## 포획 성공 시 보상은 새 채널을 안 만들고 `CodexState.discover("pet",
## id)`(codex_state.gd에 "pet" 갈래 신규)를 불러 다른 사건들과 같은
## exp 보상 경로(PartyState.add_exp)를 그대로 탄다 — pets.gd 헤더에
## 적어 둔 대로 `bonus.stat/value`는 이 슬라이스에 결별 스탯 시스템이
## 없어 아직 안 쓴다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const PetBody := preload("res://saga_core/world/pet_body.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Pets := preload("res://saga_core/data/pets.gd")

const TRIGGER_RADIUS := 16.0
const TOAST_SEC := 5.0

@export var grid := Vector2i(0, 0)
@export var pet_id := ""

var _pet: Dictionary
var _triggered := false
var _layer: CanvasLayer

func _ready() -> void:
	add_to_group("go_pets") # 사진 도감(photo_album.gd)이 화면 안 신수를 찾는다
	var found: Variant = Pets.find(pet_id)
	if found == null:
		push_warning("pet_encounter: unknown pet_id " + pet_id)
		queue_free()
		return
	_pet = found
	_spawn_visual()
	_spawn_area()

func _spawn_visual() -> void:
	var ch: String = TestMap.tile_at(grid.x, grid.y)
	var ground: float = TerrainBuilder.height_at("village", TestMap.world_pos(grid.x, grid.y))  # 09-30 평지 기복 — LEGEND 평탄 값이 아니라 실제 지면
	position = TestMap.world_pos(grid.x, grid.y) + Vector3(0, ground, 0)

	## 시각은 캡슐(다른 사건과 같은 이유 — 신수 전용 GLB가 없다). rarity
	## 5(사신 전부)는 hero_encounter.gd와 같은 금빛, 정예감을 신수도
	## 같은 규칙으로 준다(rarity 색 감각을 새로 안 만든다).
	## PLAN 106장 ④ — 캡슐 → 코드로 그린 신수(creature_builder.gd). 희귀할수록 크다.
	## G-0084 — 신수 GLB(K-0075)가 있으면 그 몸(PetBody), 없으면 코드 신수.
	add_child(PetBody.build(pet_id, 1.2 + 0.2 * float(_pet.rarity)))

func _spawn_area() -> void:
	var area := Area3D.new()
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = TRIGGER_RADIUS
	cs.shape = shape
	area.add_child(cs)
	add_child(area)
	area.body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node3D) -> void:
	if _triggered or not body.is_in_group("player"):
		return
	_triggered = true
	_show_prompt()

func _show_prompt() -> void:
	var pct := int(round(float(_pet.catch_base) * 100.0))
	var title := "%s %s (★%d)\n%s\n다가가면 %d%% 확률로 잡을 수 있다." % [
		_pet.emoji, _pet.name, int(_pet.rarity), _pet.desc, pct,
	]
	var choices: Array = [
		{"label": "다가가 잡는다", "cb": _attempt_catch},
		{"label": "물러난다", "cb": _flee},
	]
	_layer = ChoicePrompt.build(self, title, choices)

## 웹판 encounter.js catchAction()의 확률식(`catchBase + effect('catchPct')
## /100`)을 그대로 쓰되, 이 슬라이스엔 catchPct 보너스 효과가 없어(웹판
## 도구·은사 계열, DUNGEON 은사처럼 이 판엔 없는 시스템) catchBase만
## 남는다 — 값을 새로 지어내지 않고 있는 항만 옮긴 것이다.
func _attempt_catch() -> void:
	if randf() < float(_pet.catch_base):
		_caught()
	else:
		_escaped()

func _caught() -> void:
	CodexState.discover("pet", pet_id)
	Toast.show(self, "%s를(을) 잡았다! \"%s\"" % [_pet.name, _pet.desc], TOAST_SEC)
	EventState.mark_resolved(name)
	queue_free()

## 웹판도 포획 실패가 곧 그 개체의 소멸은 아니지만(다시 던질 수 있다),
## 이 슬라이스는 한 번의 확률 판정으로 성패를 가르기로 이미 단순화했으니
## (위 헤더 참고) 실패도 hero_encounter.gd `_fail()`과 같은 결로 끝낸다
## — 달아나면 그 개체와의 조우는 끝(EventState에 남는다), 다른 신수를
## 만나야 한다. "물러난다"(시도조차 안 함)와는 다른 결과다.
func _escaped() -> void:
	Toast.show(self, "%s — 낌새를 채고 순식간에 사라졌다." % _pet.name, TOAST_SEC)
	EventState.mark_resolved(name)
	queue_free()

func _flee() -> void:
	if _layer:
		_layer.queue_free()
	Toast.show(self, "%s에게서 조용히 물러났다." % _pet.name, TOAST_SEC)
	_triggered = false
