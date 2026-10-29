extends Node
## Completes the ordered "walk around" tutorial action after real player travel.
var _record: Callable
var _start := Vector3.ZERO
var _have_start := false

func _ready() -> void:
	add_to_group("first_run_walk_observer")

func setup(record_action: Callable) -> void:
	_record = record_action

func _process(_delta: float) -> void:
	if not _record.is_valid():
		return
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if player == null:
		return
	if not _have_start:
		_start = player.global_position
		_have_start = true
	elif player.global_position.distance_to(_start) >= 5.0:
		_record.call("move")
		set_process(false)
