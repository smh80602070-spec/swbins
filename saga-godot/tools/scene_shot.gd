extends Node
## G-0148 — GO 말고 다른 판 씬을 창 모드로 띄워 한 장 찍는 호스트(그래픽 전후 촬영용, mount_host 와 같은 꼴 — 일반 씬 실행이라 판별 자동 로드가 붙는다).
##   "$GODOT" --path saga-godot --rendering-method mobile --position -4000,0 --resolution 1280x720 \
##       res://tools/scene_shot.tscn -- res://games/saga_forest/world/TestVillageForest.tscn <출력.png> [프레임=200] [노드 이름]
## 노드 이름을 주면 30 프레임째 플레이어(그룹 player)를 그 노드 곁(+z 7m)으로 옮긴다(연못 등 시작 화면 밖 자리).
## 첫 안내·대화 창(ui_modal)은 매 프레임 치운다(헤드리스·창 모드 모두 멈춤 함정). 끝에 "SCENE_SHOT <경로> err=N".

var _n := 0
var _frames := 200
var _out := ""
var _near := ""


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS   # 판이 첫 안내 창과 함께 트리를 멈춰도 셈은 돈다
	var args := OS.get_cmdline_user_args()
	if args.size() < 2:
		push_error("인자: <res 씬> <출력 png> [프레임]")
		get_tree().quit(2)
		return
	_out = args[1]
	if args.size() > 2:
		_frames = int(args[2])
	if args.size() > 3:
		_near = args[3]
	add_child((load(args[0]) as PackedScene).instantiate())


func _process(_delta: float) -> void:
	_n += 1
	for m in get_tree().get_nodes_in_group("ui_modal"):
		m.queue_free()
	if get_tree().paused:
		get_tree().paused = false
	if _n == 30 and _near != "":
		var t := get_tree().root.find_child(_near, true, false) as Node3D
		var p := get_tree().get_first_node_in_group("player") as Node3D
		if t and p:
			p.global_position = t.global_position + Vector3(0, 0.5, 7)
		print("SCENE_SHOT_NEAR ", _near, " found=", t != null, " player=", p != null)
	if _n == _frames:
		var img := get_viewport().get_texture().get_image()
		print("SCENE_SHOT ", _out, " err=", img.save_png(_out))
		get_tree().quit(0)
