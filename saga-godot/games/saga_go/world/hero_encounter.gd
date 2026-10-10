extends Node3D

## GO의 실제 정체성("saga — 역사 인물로 노는 웹 게임", 루트 CLAUDE.md 첫 줄)을
## 대표하는 사건 — 지금까지 만든 8개 사건(도적 두목·마을의 부탁·부상병 등)은
## 다 일반 산적·주민이었고, **실제 역사 인물을 만나 등용하는** 조우는 아직
## 하나도 없었다. saga_core/data/characters.gd(2026-08-31에 결정만 되고
## 안 만들어져 있던 것 — 105명 데이터를 옮겨 완성)를 처음 쓰는 자리다.
##
## 2026-09-11⑱ — 처음엔 "등용한다/보낸다" 두 선택지로 좁혀 항상 성공하게
## 했었는데, 웹판 encounter.js의 3라운드 설득(무/지/덕 어필이 인물 trait과
## 맞으면 호감도가 크게 오른다)이 그리 무겁지 않아 games/saga_go/data/
## persuade_rules.gd로 그대로 옮겨 붙였다(duel_rules.gd와 같은 경계 — 판정
## 층은 웹판 그대로, 화면만 3D). rarity 4 이상은 기질을 처음엔 감춘다
## (웹판 revealed = rarity<=3과 같음) — 한 번 찔러봐야 안다.
##
## 시각은 캡슐로 남겼다(다른 사건과 같은 이유 — 받아 둔 GLB 4종은 이미
## 플레이어·촌장·상인·산적 자리가 정해져 있다). rarity가 높을수록 금빛에
## 가깝게 색을 낸다 — 도감 rarity 색(data.js RARITY.5 = 금)과 같은 감각.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const ChoicePrompt := preload("res://saga_core/ui/choice_prompt.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const Characters := preload("res://saga_core/data/characters.gd")
## PersuadeRules는 class_name으로 전역 등록돼 있어(duel_rules.gd와 같은
## 경계) 여기서 다시 preload하지 않는다 — 이름이 겹치면 파싱 오류가 난다.

const TRIGGER_RADIUS := 18.0
const TOAST_SEC := 5.0
## 웹판 encounter.js의 gainHero() exp 그대로(h.rarity * 14).
const EXP_PER_RARITY := 14.0

const APPEALS := [
	{"key": "might", "label": "⚔️ 무(武)로 겨루자"},
	{"key": "wisdom", "label": "📜 지(智)를 논하자"},
	{"key": "virtue", "label": "🙏 덕(德)으로 청하자"},
]

@export var grid := Vector2i(7, 6) # 2026-09-11㉒ 지도 확장(+2,+2)
@export var hero_id := "kr_yisunsin"
## 2026-09-16, GO 폐허(region3_ruins.gd)에도 역사 인물 조우를 두기 위해
## 추가 — terrain_builder.gd @export region_id와 같은 판단(기본값
## "village" 그대로라 기존 두 인스턴스는 아무 것도 안 바꿔도 이전과
## 완전히 같다, 헤드리스 회귀 md5로 확인).
@export var region_id := "village"

var _hero: Dictionary
var _triggered := false
var _persuade: PersuadeRules
var _revealed := false
var _layer: CanvasLayer
## G-0158 — 설득 창이 뜬 동안 카메라가 이 인물을 비춘다(이야기 대화 구도 camera_rig.talk_shot 재사용).
## 듣는 자리를 인물 앞 TALK_NEAR m 로 잡아(트리거 반경 18m 그대로 쓰면 멀어 작다) 가까이, 겨누는 자리를 TALK_AIM_DROP m
## 낮춰 얼굴이 화면 위쪽 — 아래에 붙인 창(ChoicePrompt dock_bottom) 위로 오게.
const TALK_NEAR := 2.2
const TALK_AIM_DROP := 0.6
var _rig: Node = null

func _ready() -> void:
	add_to_group("go_heroes") # 사진 도감(photo_album.gd)이 화면 안 인물을 찾는다
	var found: Variant = Characters.find(hero_id)
	if found == null:
		push_warning("hero_encounter: unknown hero_id " + hero_id)
		queue_free()
		return
	_hero = found
	_spawn_visual()
	_spawn_area()

func _spawn_visual() -> void:
	var ch: String = TestMap.tile_at(grid.x, grid.y, region_id)
	var ground: float = TerrainBuilder.height_at(region_id, TestMap.world_pos(grid.x, grid.y, region_id))  # 09-30 평지 기복 — LEGEND 평탄 값이 아니라 실제 지면
	position = TestMap.world_pos(grid.x, grid.y, region_id) + Vector3(0, ground, 0)

	## PLAN 106장 ④ — 캡슐 → VRoid 몸(인물 id 로 머리·옷 색 고정, ★5 는 금 테두리).
	add_child(VroidBody.build(hero_id, int(_hero.rarity), null, true))   # G-0024 — dex 설치 시 같은 id 의 몸

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
	CodexState.discover("record", hero_id)
	_persuade = PersuadeRules.create(_hero["trait"])
	_revealed = int(_hero.rarity) <= 3
	_frame_hero(body)
	_show_round()

func _frame_hero(player: Node3D) -> void:
	_rig = player.get_node_or_null("CameraRig")
	if _rig == null or not _rig.has_method("talk_shot"):
		_rig = null
		return
	var me := global_position
	var to_p := player.global_position - me
	to_p.y = 0.0
	var near := me + (to_p.normalized() * TALK_NEAR if to_p.length() > 0.1 else Vector3(0, 0, TALK_NEAR))
	_rig.call("talk_shot", me + Vector3.DOWN * TALK_AIM_DROP, near)

func _end_frame() -> void:
	if _rig != null and is_instance_valid(_rig) and _rig.has_method("end_talk"):
		_rig.call("end_talk")
	_rig = null

func _exit_tree() -> void:
	_end_frame()

func _trait_label(trait_key: String) -> String:
	match trait_key:
		"might": return "무인 기질 ⚔️"
		"wisdom": return "지략가 기질 📜"
		_: return "덕망가 기질 🙏"

func _show_round() -> void:
	if _layer:
		_layer.queue_free()
	var trait_text := _trait_label(_hero["trait"]) if _revealed else "기질 불명 ❓"
	var title := "%s %s(%s) · %s·%s\n무 %d / 지 %d / 통 %d\n%s\n호감도 %d/100 (%d/%d라운드)" % [
		_hero.emoji, _hero.name, _hero.hanja, _hero.era, _hero.faction,
		int(_hero.stats.might), int(_hero.stats.wisdom), int(_hero.stats.command),
		trait_text, int(_persuade.favor), _persuade.round_num, PersuadeRules.MAX_ROUND,
	]
	var choices: Array = []
	for a in APPEALS:
		choices.append({"label": a.label, "cb": func() -> void: _do_appeal(a.key)})
	choices.append({"label": "물러난다", "cb": _flee})
	_layer = ChoicePrompt.build(self, title, choices, _rig != null)   # G-0158 — 인물을 비추면 창은 아래로

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

## 웹판 encounter.js도 "물러난다"는 그냥 창을 닫을 뿐 조우 자체를 없애지
## 않는다(close()가 removeSpawn을 안 부름) — 여기서도 노드를 안 지우고
## _triggered만 되돌린다. 트리거 반경을 벗어났다 다시 들어오면 처음부터
## 다시 설득해 볼 수 있다(성공/실패만 EventState에 남는 진짜 끝이다).
func _flee() -> void:
	if _layer:
		_layer.queue_free()
	_end_frame()
	Toast.show(self, "%s와(과) 인사를 나누고 헤어졌다." % _hero.name, TOAST_SEC)
	_triggered = false

func _fail() -> void:
	Toast.show(self, "%s — \"인연이 아닌 듯하오.\" 그가 떠났다." % _hero.name, TOAST_SEC)
	EventState.mark_resolved(name)
	queue_free()

func _recruit() -> void:
	PartyState.recruit(_hero.id)
	var exp_reward: float = int(_hero.rarity) * EXP_PER_RARITY
	PartyState.add_exp(exp_reward)
	Toast.show(self, "%s가 부대에 합류했다! \"%s\" (경험 +%d)" % [_hero.name, _hero.quote, int(exp_reward)], TOAST_SEC)
	EventState.mark_resolved(name)
	queue_free()
