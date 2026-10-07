extends Node

## saga_core/ui/goal_board.gd는 StorySaveState를 모른다(GO test_village.gd
## 헤더와 같은 경계). STORY엔 GO/DUNGEON/FOREST의 "월드" 스크립트 같은
## 씬 공통 진입점이 없다(마을은 story_town.gd, 사냥터는 story_field.gd로
## 루트 스크립트가 갈린다) — 그래서 STORY만 quest_label.gd·gold_label.gd와
## 같은 폴링 라벨 옆에 이 작은 피더 노드를 둔다(goal_board.gd 자체는 다섯
## 판이 그대로 공유, 새 UI 없음).
## "지금"은 사명 완수 진행도(전체 QUESTS, 반복/일일은 성격상 끝이 없어
## 뺀다). "세션"은 처치·골드 델타(exp는 레벨업마다 0으로 되감겨 델타로
## 못 쓴다, story_save_state.gd 주석 참고). "주"는 다른 네 판과 같은
## 이유로 "—".

const StoryCombat := preload("res://games/saga_story/data/story_combat.gd")


func _process(_delta: float) -> void:
	var board := get_tree().get_first_node_in_group("goal_board")
	if board == null:
		return
	var now := "사명 완수 %d/%d" % [StorySaveState.quests_done.size(), StoryCombat.QUESTS.size()]
	var runner := get_tree().get_first_node_in_group("story_scenario")   # G-0087 이야기 목표 먼저
	var story: String = runner.call("objective") if runner != null else ""
	if story != "":
		now = story + " · " + now
	var session := "처치 +%d · 골드 +%d" % [
		StorySaveState.session_kills_gained(), StorySaveState.session_gold_gained()]
	board.set_goals(now, session, "—")
