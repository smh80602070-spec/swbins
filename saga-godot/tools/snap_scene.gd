extends SceneTree
## 씬 하나를 창 모드로 열어 몇 프레임 뒤 화면을 PNG 로 — 판별 시험 씬을 그대로 한 장 보고 싶을 때(눈 확인용, 평소엔 안 쓴다).
##
##   SAGA_SNAP_SCENE=res://games/saga_forest/world/TestVillageForest.tscn SAGA_SNAP_OUT=<절대 경로.png> \
##     "$GODOT_CONSOLE" --path saga-godot --rendering-method mobile --position -4000,0 --resolution 1280x720 --script res://tools/snap_scene.gd </dev/null
##
## SAGA_SNAP_FRAMES(기본 150) 프레임 뒤에 찍고 끈다. 저장은 안 한다.

var _frame := 0
var _frames := 150

func _initialize() -> void:
	var path := OS.get_environment("SAGA_SNAP_SCENE")
	var packed := load(path) as PackedScene
	if packed == null:
		print("SNAP_FAIL 씬 못 읽음 ", path)
		quit(1)
		return
	root.add_child(packed.instantiate())
	var f := OS.get_environment("SAGA_SNAP_FRAMES")
	if f != "":
		_frames = int(f)

func _process(_delta: float) -> bool:
	_frame += 1
	if _frame == _frames:
		var out := OS.get_environment("SAGA_SNAP_OUT")
		root.get_texture().get_image().save_png(out)
		print("SNAP_OK ", out)
		quit()
	return false
