extends Node3D

## VERTICAL_SLICE_STORY.md 완료 조건의 마지막 두 단계 — "저장한다 →
## 다시 켜서 이어진다"(GO test_village.gd·FOREST forest_village.gd와
## 같은 순서 규칙: 자식들의 _ready()가 부모보다 먼저 돈다).
##
## 이 판은 구면 투영이 없어(2.5D 고정 카메라, VERTICAL_SLICE_STORY.md
## 2절) WorldCurveMaterial 등록이 필요 없다 — FOREST test_village.gd와
## 달리 이 부분이 빠진다.
##
## **2026-09-13 추가 — 문(portal, 15절).** 허도에서 건너온 경우
## StorySaveState.has_pending_spawn이 서 있다 — 그때는 세이브를 안 불러오고
## (안 그러면 세이브 위치가 문으로 도착한 자리를 덮어써 버린다) 문이
## 정해 준 자리에만 세운다. story_town.gd(허도 쪽)와 같은 규칙.

func _ready() -> void:
	## 자동 저장(saga_core/world/autosave_timer.gd) — 60초마다·앱 멈춤 때.
	preload("res://saga_core/world/autosave_timer.gd").attach(self, StorySaveState.save, func() -> bool: return get_tree().get_first_node_in_group("player") != null)
	if StorySaveState.has_pending_spawn:
		var player := get_tree().get_first_node_in_group("player")
		var x_m: float = StorySaveState.consume_pending_spawn()
		if player != null:
			player.global_position = Vector3(x_m, 0.1, 0)
	else:
		StorySaveState.try_load()
		StorySaveState.begin_session()
