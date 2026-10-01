extends Node

## 장면 상태를 1초마다 보고 곡 키를 고르는 연결 노드(G-0013) — go_bgm.gd 의 일반형.
##   preload("res://saga_core/audio/bgm_picker.gd").attach(self, func() -> String: return "dungeon-field")
## 고르는 함수가 "" 를 돌려주면 그 틱은 건드리지 않는다. 곡 파일이 없으면 Bgm 이 조용히 넘어간다.

const Bgm := preload("res://saga_core/audio/bgm.gd")

const POLL_SEC := 1.0

var _pick: Callable
var _t := POLL_SEC  # 첫 프레임에 바로 한 번


static func attach(parent: Node, pick: Callable) -> void:
	var n: Node = (load("res://saga_core/audio/bgm_picker.gd") as GDScript).new()
	n.set("_pick", pick)
	parent.add_child(n)


func _process(delta: float) -> void:
	_t += delta
	if _t < POLL_SEC:
		return
	_t = 0.0
	var key := String(_pick.call())
	if key != "":
		Bgm.play(self, key)
