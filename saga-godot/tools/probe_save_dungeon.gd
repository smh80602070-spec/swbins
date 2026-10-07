extends SceneTree

## 사가나락 세이브 왕복·마이그레이션 점검 — 몸통은 probe_save_base.gd.
##   godot --headless --path saga-godot --script res://tools/probe_save_dungeon.gd
## 끝에 "PROBE save_dungeon OK" 또는 "PROBE save_dungeon FAIL n". 진짜 세이브는 안 건드린다.

const Base := preload("res://tools/probe_save_base.gd")


func _initialize() -> void:  # autoload 이름은 _init 뒤에야 등록된다
	var fails: int = Base.run("dungeon", "res://games/saga_dungeon/data/dungeon_save_state.gd", {"room_cleared": true}, func(d: Dictionary) -> bool: return d.get("rooms_cleared") == [true] and not d.has("room_cleared"))
	quit(1 if fails > 0 else 0)
