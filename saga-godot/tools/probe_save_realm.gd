extends SceneTree

## 사가천하 세이브 왕복·마이그레이션 점검 — 몸통은 probe_save_base.gd.
##   godot --headless --path saga-godot --script res://tools/probe_save_realm.gd
## 끝에 "PROBE save_realm OK" 또는 "PROBE save_realm FAIL n". 진짜 세이브는 안 건드린다.

const Base := preload("res://tools/probe_save_base.gd")


func _initialize() -> void:  # autoload 이름은 _init 뒤에야 등록된다
	var fails: int = Base.run("realm", "res://games/saga_realm/data/realm_save_state.gd", {}, Callable())
	quit(1 if fails > 0 else 0)
