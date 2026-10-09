extends SceneTree

## 사가종횡 세이브 왕복·마이그레이션 점검 — 몸통은 probe_save_base.gd.
##   godot --headless --path saga-godot --script res://tools/probe_save_story.gd
## 끝에 "PROBE save_story OK" 또는 "PROBE save_story FAIL n". 진짜 세이브는 안 건드린다.

const Base := preload("res://tools/probe_save_base.gd")


func _initialize() -> void:  # autoload 이름은 _init 뒤에야 등록된다
	await process_frame
	var rt := {"tree": self, "autoload": "StorySaveState", "fields": {
		"level": [7, 1], "exp": [123, 0], "gold": [456, 0], "quests_done": [{"q_first": true}, {}]}}
	var fails: int = Base.run("story", "res://games/saga_story/data/story_save_state.gd", {}, Callable(), rt)
	quit(1 if fails > 0 else 0)
