extends Node3D

## VERTICAL_SLICE_STORY.md 15절 — 허도(마을) 씬 루트. story_field.gd와
## 같은 문(portal) 규칙: 필드에서 건너온 경우 StorySaveState.has_pending_
## spawn이 서 있고, 그때는 세이브를 안 불러온다(문이 정해 준 자리를
## 세이브 위치가 덮어쓰지 않게).
##
## **알려진 한계** — StoryHUD의 SaveButton은 이 씬에도 그대로 있다.
## field_map.gd/heodo_map.gd는 각자 로컬 좌표계라, 허도에서 저장한 뒤
## (지금은 TestField.tscn을 직접 여는 방식이라 실제 재접속은 항상
## field로 돌아간다) 다시 켜면 그 x값이 field 좌표계로 해석돼 자리가
## 어긋난다. 여러 사냥터를 아우르는 세이브 스키마(현재 위치가 어느
## 씬인지까지 기록)는 나머지 사냥터 8곳을 더 지을 때 같이 볼 자리 —
## 지금은 "field 하나만 진짜 재접속 지점"이라는 기존 한계를 그대로
## 남긴다.

func _ready() -> void:
	## 가로 화면이면 UI 기준 크기를 바꿔 글자가 깨알만 하지 않게(saga_core/ui/orientation_scale.gd).
	add_child(preload("res://saga_core/ui/orientation_scale.gd").new())
	## 자동 저장(saga_core/world/autosave_timer.gd) — 60초마다·앱 멈춤 때.
	preload("res://saga_core/world/autosave_timer.gd").attach(self, StorySaveState.save, func() -> bool: return get_tree().get_first_node_in_group("player") != null)
	if StorySaveState.has_pending_spawn:
		var player := get_tree().get_first_node_in_group("player")
		var x_m: float = StorySaveState.consume_pending_spawn()
		if player != null:
			player.global_position = Vector3(x_m, 0.1, 0)
