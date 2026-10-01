extends Node

## 첫걸음 사명(G-0012) 판정 — test_village.gd 가 붙인다(그룹 "go_tutorial"). 표는 data/tutorial.gd, 기록은 PartyState.tut.
##   ① move: 처음 선 자리에서 20m 넘게 걸었고 등반 상태를 한 번 거쳤다 ② recruit: 동행(PartyState.members)이 생겼다
##   ③ chest: 보물 상자 `opened` 신호 ④ react: 필드 전투 `reacted` 신호 ⑤ save: 세이브 파일 수정 시각이 시작 때보다 늦어졌다(수동·자동 저장 모두)
## 신호는 상자가 나중에 생겨도 잡도록 POLL_SEC 마다 한 번씩 연결(이미 연결된 건 건너뜀). 다 하면 목표판은 평소 줄(사명/도감)로 돌아간다.

signal changed()

const Data := preload("res://games/saga_go/data/tutorial.gd")
const GoPlayer := preload("res://games/saga_go/player/go_player.gd")

const POLL_SEC := 1.0
const MOVE_M := 20.0

var _player: Node3D
var _poll := POLL_SEC  # 첫 프레임에 바로 한 번
var _start := Vector3.ZERO
var _has_start := false
var _climbed := false
var _save_t0 := -1


func _ready() -> void:
	add_to_group("go_tutorial")


## 아직 할 사명이 남았나.
func active() -> bool:
	return not Data.current(PartyState.tut).is_empty()


## 목표판 첫 줄(다 했으면 "").
func line() -> String:
	return Data.line(PartyState.tut)


func complete(id: String) -> void:
	if not Data.ids().has(id) or PartyState.tut.has(id):
		return
	PartyState.tut.append(id)
	changed.emit()


## 시험용 — 처음 상태로.
func reset_for_test() -> void:
	_has_start = false
	_climbed = false
	_save_t0 = -1
	_poll = POLL_SEC


func _physics_process(delta: float) -> void:
	_poll += delta
	if _poll < POLL_SEC:
		return
	_poll = 0.0
	if not active():
		return
	_check()


func _check() -> void:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
	if _player != null:
		if not _has_start:
			_start = _player.global_position
			_has_start = true
		if int(_player.get("mode")) == int(GoPlayer.Mode.CLIMB):
			_climbed = true
		if _climbed and _player.global_position.distance_to(_start) >= MOVE_M:
			complete("move")
	if PartyState.members.size() > 0:
		complete("recruit")
	_connect_signals()
	var t := FileAccess.get_modified_time(SaveState.save_path()) if FileAccess.file_exists(SaveState.save_path()) else 0
	if _save_t0 < 0:
		_save_t0 = t
	elif t > _save_t0:
		complete("save")


func _connect_signals() -> void:
	for c in get_tree().get_nodes_in_group("treasure_chest"):
		if c.has_signal("opened") and not c.is_connected("opened", _on_chest):
			c.connect("opened", _on_chest)
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	if fc != null and fc.has_signal("reacted") and not fc.is_connected("reacted", _on_react):
		fc.connect("reacted", _on_react)


func _on_chest(_chest: Node3D) -> void:
	complete("chest")


func _on_react(_reaction: String) -> void:
	complete("react")
