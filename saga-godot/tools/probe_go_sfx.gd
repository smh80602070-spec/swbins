extends Node
## G-0177 1만리 효과음(games/saga_go/world/go_sfx.gd) 자동 점검 — 평소엔 안 붙는다.
##   SAGA_GOSFX_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
## ① 소리 34개 load·CombatFeel.sound_hook 걸림 ② 적에 hit → 무기 hit 1(파일 이름에 지금 인물 무기) ③ 치명 → crit 1
## ④ 플레이어 Visual 에 hit → hurt 1 ⑤ pickup "냥…" → coin 1 ⑥ ui → ui 1 ⑦ call_group 키 9개 각 1 ⑧ 같은 프레임 타격 3번 → 1.
## 헤드리스라 소리는 안 들리고 go_sfx.counts 만 센다. 끝에 "GOSFX_PROBE_DONE fails=N".

const Weapons := preload("res://games/saga_go/data/weapons.gd")
const KEYS := ["chest_open", "death", "block", "heal", "quest_accept", "quest_done", "cook_done", "fish_bite", "splash"]

var _frame := 0
var _fails := 0
var _sfx: Node
var _dummy: Node3D
var _base := {}


func _check(name: String, ok: bool, info := "") -> void:
	print("GOSFX_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", info])
	if not ok:
		_fails += 1


func _physics_process(_delta: float) -> void:
	_frame += 1
	if _frame == 10:
		_sfx = get_tree().get_first_node_in_group("go_sfx")
		_check("node", _sfx != null)
		if _sfx == null:
			_finish()
			return
		var n := int(_sfx.call("loaded"))
		_check("loaded", n == 34, "streams=%d (무기 5×4 + 14)" % n)
		_check("hook", CombatFeel.sound_hook.is_valid())
		_dummy = Node3D.new()
		get_tree().current_scene.add_child(_dummy)
		_base = _counts()
		CombatFeel.hit(_dummy, 10.0, false, {"stop_ms": 0, "shake_mul": 0.0})
	elif _frame == 25:
		var fc := get_tree().get_first_node_in_group("go_field_combat")
		var id := String(fc.call("active_id")) if fc else "self"
		var w := String(_sfx.WEAPON_SFX.get(Weapons.type_of(id), "sword"))
		var last := String((_sfx.get("last") as Dictionary).get("hit", ""))
		_check("hit", _d("hit") == 1 and _d("crit") == 0, "hit=%d crit=%d" % [_d("hit"), _d("crit")])
		_check("weapon", last.begins_with(w + "_hit_"), "active=%s 무기=%s last=%s" % [id, w, last])
		_base = _counts()
		CombatFeel.hit(_dummy, 10.0, true, {"stop_ms": 0, "shake_mul": 0.0})
	elif _frame == 40:
		_check("crit", _d("hit") == 1 and _d("crit") == 1, "hit=%d crit=%d" % [_d("hit"), _d("crit")])
		_base = _counts()
		var p := get_tree().get_first_node_in_group("player")
		CombatFeel.hit(p.get_node("Visual") if p else null, 5.0, false, {"stop_ms": 0, "shake_mul": 0.0})
	elif _frame == 55:
		_check("hurt", _d("hurt") == 1 and _d("hit") == 0, "hurt=%d hit=%d" % [_d("hurt"), _d("hit")])
		_base = _counts()
		CombatFeel.pickup(_dummy, "냥 +5")
		CombatFeel.ui()
	elif _frame == 70:
		_check("coin", _d("coin") == 1 and _d("item_pick") == 0, "coin=%d pick=%d" % [_d("coin"), _d("item_pick")])
		_check("ui", _d("ui") == 1, "ui=%d" % _d("ui"))
		_base = _counts()
		for k in KEYS:
			get_tree().call_group("go_sfx", "play", k)
	elif _frame == 85:
		var bad := []
		for k in KEYS:
			if _d(k) != 1:
				bad.append("%s=%d" % [k, _d(k)])
		_check("keys", bad.is_empty(), "9키 각 1 %s" % ", ".join(bad))
		_base = _counts()
		for i in 3:
			CombatFeel.hit(_dummy, 1.0, false, {"stop_ms": 0, "shake_mul": 0.0})
	elif _frame == 100:
		_check("gap", _d("hit") == 1, "같은 프레임 3번 → hit=%d" % _d("hit"))
		_finish()


func _counts() -> Dictionary:
	return (_sfx.get("counts") as Dictionary).duplicate()


func _d(k: String) -> int:
	return int((_sfx.get("counts") as Dictionary).get(k, 0)) - int(_base.get(k, 0))


func _finish() -> void:
	print("GOSFX_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
