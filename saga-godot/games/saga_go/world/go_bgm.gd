extends Node

## GO 배경음 연결(G-0011) — 플레이어가 선 지역을 1초마다 보고 마을이면 `go-town`, 그 밖(포구·폐허·고원…)이면 `go-field` 곡을 건다.
## 들판 전투(`field_combat.in_combat()`)에 들면 `go-battle`(G-0013) — 끝난 뒤 BATTLE_HOLD_SEC 동안은 그대로 둬서 곡이 깜빡이지 않게.
## 곡 파일이 없으면 Bgm 이 조용히 넘어간다. test_village.gd 가 붙인다.

const Bgm := preload("res://saga_core/audio/bgm.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")

const POLL_SEC := 1.0
const BATTLE_HOLD_SEC := 5.0

var _t := POLL_SEC  # 첫 프레임에 바로 한 번
var _battle_left := 0.0


func _process(delta: float) -> void:
	_t += delta
	_battle_left = maxf(0.0, _battle_left - delta)
	if _t < POLL_SEC:
		return
	_t = 0.0
	var p := get_tree().get_first_node_in_group("player") as Node3D
	if p == null:
		return
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	if fc != null and fc.call("in_combat"):
		_battle_left = BATTLE_HOLD_SEC
	if _battle_left > 0.0:
		Bgm.play(self, "go-battle")
		return
	Bgm.play(self, "go-town" if TestMap.region_at(p.global_position) == "village" else "go-field")
