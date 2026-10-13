extends Node

## G-0224 2나락 횃불 깜빡임 — 부모 OmniLight3D 의 세기를 느린 값 노이즈로 ±AMP 흔든다(방마다 씨앗이 달라 같이 안 깜빡인다).
## 셈은 sin 두 개뿐(매 프레임 가벼움). SAGA_DUNGEON_OLD=1 이면 test_room 이 이 노드를 안 단다.

const AMP := 0.12
const SPEED_A := 7.3
const SPEED_B := 2.9

var _base := 1.0
var _phase := 0.0
var _t := 0.0


func _ready() -> void:
	var l := get_parent() as Light3D
	if l == null:
		set_process(false)
		return
	_base = l.light_energy
	_phase = float(absi(hash(get_parent().get_path()))) * 0.001


func _process(delta: float) -> void:
	_t += delta
	var n := sin(_t * SPEED_A + _phase) * 0.6 + sin(_t * SPEED_B + _phase * 1.7) * 0.4
	(get_parent() as Light3D).light_energy = _base * (1.0 + AMP * n)
