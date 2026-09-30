extends Node3D

## VERTICAL_SLICE_STORY.md 1절 "제외" 목록 "NPC 대화"의 첫 걸음 —
## data-quest.js q_talk1(goal.type:'talk')이 필요로 하던 "대사만 있는
## 마을 NPC"(원작 elder/guard/healer/wanderer, `data-side.js` NPC_TALK)를
## 처음으로 옮긴다. story_merchant.gd(상점)·story_job_trainer.gd(전직)와
## 달리 이 NPC는 **기능이 없다** — story_interact를 누르면 무작위로 한
## 줄을 보여 주고, StorySaveState.add_talk()로 q_talk1 진행도만 쌓는다.
##
## **재해석** — 원작 side.js talk()은 대사 하나를 순서 없이 고정으로
## 골랐다가 다시 걸면 다음 줄로 넘어가는 방식인데, 이 포트는 그 상태를
## 안 두고 매번 무작위로 고른다(가방·상점 자동 구매와 같은 "새 상태를
## 늘리지 않는" 선택 — 어느 줄이 나오든 진행도 집계엔 영향이 없다).
##
## npc_key로 story_combat.gd NPC_TALK를 조회한다 — story_job_trainer.gd의
## Area3D 폴링(proximity + story_interact) 그대로.

const StoryNpcBody := preload("res://games/saga_story/world/story_npc_body.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const StoryCombat := preload("res://games/saga_story/data/story_combat.gd")

@export var npc_key: String = "guard"

const RANGE_RADIUS := 1.8

var _player_in_range := false


func _ready() -> void:
	_spawn_visual()
	_spawn_area()


func _npc_def() -> Dictionary:
	return StoryCombat.NPC_TALK.get(npc_key, {})


func _body_color() -> Color:
	## data-side.js NPC별로 지어낸 색은 없다 — 파수병(guard)은 병기를
	## 다루니 쇠빛, 그 밖엔 job_trainer(파란 톤)·merchant(붉은 톤)와
	## 겹치지 않는 중립 갈색을 기본으로 둔다.
	return Color(0.55, 0.55, 0.6) if npc_key == "guard" else Color(0.5, 0.4, 0.3)


func _spawn_visual() -> void:
	## 2026-09-30 — 색 캡슐 대신 VRoid 몸(story_npc_body.gd).
	add_child(StoryNpcBody.build(npc_key))


func _spawn_area() -> void:
	var area := Area3D.new()
	area.name = "TalkRange"
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = RANGE_RADIUS
	cs.shape = shape
	area.add_child(cs)
	area.position = Vector3(0, 0.85, 0)
	area.body_entered.connect(_on_range_entered)
	area.body_exited.connect(_on_range_exited)
	add_child(area)


func _on_range_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	_player_in_range = true
	var d := _npc_def()
	Toast.show(self, "%s %s — story_interact로 말을 건넨다" % [String(d.get("emoji", "")), String(d.get("name", npc_key))], 2.0)


func _on_range_exited(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	_player_in_range = false


## story_merchant.gd·story_job_trainer.gd와 같은 폴링 방식. 말은 실제로
## 눌렀을 때만 세어야 quest.js onTalk()의 "말 건 순간에만 는다"와 맞는다
## (job_trainer의 자동 진입 토스트와 달리, 여기선 진입 토스트는 안내일
## 뿐 집계에 안 들어간다).
func _process(_delta: float) -> void:
	if not _player_in_range:
		return
	if not Input.is_action_just_pressed("story_interact"):
		return
	var d := _npc_def()
	var lines: Array = d.get("lines", [])
	if lines.is_empty():
		return
	var line: String = String(lines[randi() % lines.size()])
	StorySaveState.add_talk()
	Toast.show(self, "%s %s: %s" % [String(d.get("emoji", "")), String(d.get("name", npc_key)), line], 3.0)
