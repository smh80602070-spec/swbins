extends Node3D

## "제외" 목록 5번(인물 등용) — 방 안에서 실제 역사 인물을 만나 설득하는
## 조우. GO의 `hero_encounter.gd`(3라운드 설득, PersuadeRules)를 판정
## 층까지 그대로 따르되(duel_rules.gd·PersuadeRules를 새로 설계하지 않는다는
## 원칙) DUNGEON 사정에 맞춰 셋을 갈아 꼈다:
##   1) 시각은 GO처럼 캡슐(이 판 전용 GLB가 아직 없다, dungeon_enemy.gd와
##      같은 이유) — rarity가 높을수록 금빛(GO와 같은 감각).
##   2) 등용 성공 시 GO의 PartyState(무기 없는 순수 인원+레벨 스탯)가 아니라
##      `DungeonPartyState.recruit()`를 부른다 — DUNGEON은 이미 장비 기반
##      전투 채널이 있어(atk_flat/pct_bonus) 새 스탯 체계를 안 만들고
##      DungeonRunState._sum_eff()의 world eff(atkPct/hpPct)로만 보탠다
##      (dungeon_party_state.gd 헤더 참고). exp 보상도 없다 — 레벨 개념은
##      GO에만 있다.
##   3) 해결 여부(성공/실패)는 GO의 EventState(노드 이름 키)가 아니라
##      `DungeonSaveState.mark_hero_resolved(room_index)`로 남긴다 — DUNGEON
##      세이브 스키마를 GO와 안 섞는다는 기존 원칙(dungeon_save_state.gd
##      헤더) 그대로. GO는 씬에 고정 배치된 노드라 이름이 있지만, 이건
##      test_room.gd가 방마다 코드로 세우므로 room_index로 가리킨다.
##
## "물러난다"는 GO와 같이 조우 자체를 안 지운다 — 트리거를 다시 들어오면
## 처음부터 다시 설득해 볼 수 있다.

const ChoicePrompt := preload("res://games/saga_go/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const VroidBody := preload("res://games/saga_go/world/vroid_body.gd")
const Characters := preload("res://saga_core/data/characters.gd")
## PersuadeRules는 class_name으로 전역 등록돼 있어(GO의 hero_encounter.gd와
## 같은 경계) 여기서 다시 preload하지 않는다 — 이름이 겹치면 파싱 오류가 난다.

## GO(TRIGGER_RADIUS=18, 마을 스케일)보다 훨씬 작다 — 방이 12x12뿐이다.
const TRIGGER_RADIUS := 4.0
const TOAST_SEC := 5.0

const APPEALS := [
	{"key": "might", "label": "⚔️ 무(武)로 겨루자"},
	{"key": "wisdom", "label": "📜 지(智)를 논하자"},
	{"key": "virtue", "label": "🙏 덕(德)으로 청하자"},
]

var _hero_id: String
var _room_index: int
var _hero: Dictionary
var _triggered := false
var _persuade: PersuadeRules
var _revealed := false
var _layer: CanvasLayer


func _init(hero_id_in: String = "", room_index_in: int = 0) -> void:
	_hero_id = hero_id_in
	_room_index = room_index_in


func _ready() -> void:
	var found: Variant = Characters.find(_hero_id)
	if found == null:
		push_warning("dungeon_hero_encounter: unknown hero_id " + _hero_id)
		queue_free()
		return
	_hero = found
	_spawn_visual()
	_spawn_area()


func _spawn_visual() -> void:
	## 2026-09-30 — 캡슐 → GO hero_encounter 와 같은 VRoid 몸(인물 id 로 머리·옷 색 고정, ★5 는 금 테두리).
	add_child(VroidBody.build(_hero_id, int(_hero.rarity)))

	var cs := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.425
	shape.height = 1.6
	cs.position = Vector3(0, 0.8, 0)
	cs.shape = shape
	add_child(cs)


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
	_persuade = PersuadeRules.create(str(_hero["trait"]))
	_revealed = int(_hero.rarity) <= 3
	_show_round()


func _trait_label(trait_key: String) -> String:
	match trait_key:
		"might": return "무인 기질 ⚔️"
		"wisdom": return "지략가 기질 📜"
		_: return "덕망가 기질 🙏"


func _show_round() -> void:
	if _layer:
		_layer.queue_free()
	var trait_text := _trait_label(str(_hero["trait"])) if _revealed else "기질 불명 ❓"
	var title := "%s %s(%s) · %s·%s\n무 %d / 지 %d / 통 %d\n%s\n호감도 %d/100 (%d/%d라운드)" % [
		_hero.emoji, _hero.name, _hero.hanja, _hero.era, _hero.faction,
		int(_hero.stats.might), int(_hero.stats.wisdom), int(_hero.stats.command),
		trait_text, int(_persuade.favor), _persuade.round_num, PersuadeRules.MAX_ROUND,
	]
	var choices: Array = []
	for a in APPEALS:
		choices.append({"label": a.label, "cb": func() -> void: _do_appeal(a.key)})
	choices.append({"label": "물러난다", "cb": _flee})
	_layer = ChoicePrompt.build(self, title, choices)


func _do_appeal(key: String) -> void:
	var r: Dictionary = _persuade.appeal(key)
	_revealed = true
	if not r.get("ok", false):
		return
	if r.succeeded:
		_recruit()
	elif r.done:
		_fail()
	else:
		_show_round()


func _flee() -> void:
	if _layer:
		_layer.queue_free()
	Toast.show(self, "%s와(과) 인사를 나누고 헤어졌다." % _hero.name, TOAST_SEC)
	_triggered = false


func _fail() -> void:
	Toast.show(self, "%s — \"인연이 아닌 듯하오.\" 그가 떠났다." % _hero.name, TOAST_SEC)
	DungeonSaveState.mark_hero_resolved(_room_index)
	queue_free()


func _recruit() -> void:
	DungeonPartyState.recruit(str(_hero.id))
	Toast.show(self, "%s가 부대에 합류했다! \"%s\"" % [_hero.name, _hero.quote], TOAST_SEC)
	DungeonSaveState.mark_hero_resolved(_room_index)
	queue_free()
