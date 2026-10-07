extends Button
## G-0037 — 네 판(사가나락·사가마을·사가종횡·사가천하) HUD 의 "옮기기" 단추. 누르면 세이브 옮기기 화면(save_transfer_screen.gd)을 연다.
## HUD 씬에서 game_id 만 정한다. 판 이름 → 세이브 autoload·저장 함수는 아래 표(사가나락만 저장에 플레이어가 든다).

const Screen := preload("res://saga_core/ui/save_transfer_screen.gd")
const STATES := {"dungeon": "DungeonSaveState", "forest": "ForestSaveState", "story": "StorySaveState", "realm": "RealmSaveState"}

@export var game_id := ""

var screen: Node = null   # 점검이 본다


func _ready() -> void:
	text = "옮기기"
	var st: Node = get_tree().root.get_node_or_null(String(STATES.get(game_id, "")))
	if st == null:
		disabled = true
		return
	screen = Screen.new()
	screen.name = "SaveTransfer"
	screen.set("game_id", game_id)
	screen.set("state", st)
	screen.set("group_name", "save_transfer")
	screen.set("load_before_reload", true)
	screen.set("save_call", func() -> void: _save(st))
	add_child(screen)
	pressed.connect(func() -> void: screen.call("open_screen"))


func _save(st: Node) -> void:
	if game_id == "dungeon":
		var p := get_tree().get_first_node_in_group("player") as Node3D
		if p != null:
			st.call("save", p)
	else:
		st.call("save")
