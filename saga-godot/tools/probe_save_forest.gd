extends SceneTree

## 사가의숲 세이브 왕복·마이그레이션 점검 — 몸통은 probe_save_base.gd.
##   godot --headless --path saga-godot --script res://tools/probe_save_forest.gd
## 끝에 "PROBE save_forest OK" 또는 "PROBE save_forest FAIL n". 진짜 세이브는 안 건드린다.

const Base := preload("res://tools/probe_save_base.gd")


func _initialize() -> void:  # autoload 이름은 _init 뒤에야 등록된다
	var fails: int = Base.run("forest", "res://games/saga_forest/data/forest_save_state.gd", {"fruit_count": 3}, func(d: Dictionary) -> bool: return int(d.get("items", {}).get("과일", -1)) == 3 and not d.has("fruit_count"))
	quit(1 if fails > 0 else 0)
