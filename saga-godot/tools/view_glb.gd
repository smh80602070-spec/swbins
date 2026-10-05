extends SceneTree
## GLB 몇 개를 밝은 무대에 나란히 세워 한 장 찍는다 — 시험 씬이 어두울 때 모양만 눈으로 볼 때(평소엔 안 쓴다).
##
##   SAGA_VIEW_GLBS=res://assets/world/a.glb,res://assets/world/b.glb SAGA_VIEW_OUT=<절대 경로.png> SAGA_VIEW_GAP=14 \
##     "$GODOT_CONSOLE" --path saga-godot --rendering-method mobile --position -4000,0 --resolution 1280x720 --script res://tools/view_glb.gd </dev/null
##
## 카메라는 가운데 GLB 를 위에서 비스듬히(거리 SAGA_VIEW_DIST, 기본 26) 내려다본다.

var _frame := 0

func _initialize() -> void:
	var paths := OS.get_environment("SAGA_VIEW_GLBS").split(",", false)
	var gap := float(OS.get_environment("SAGA_VIEW_GAP")) if OS.get_environment("SAGA_VIEW_GAP") != "" else 14.0
	var dist := float(OS.get_environment("SAGA_VIEW_DIST")) if OS.get_environment("SAGA_VIEW_DIST") != "" else 26.0
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.55, 0.62, 0.7)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.8, 0.8, 0.85)
	env.ambient_light_energy = 0.8
	var we := WorldEnvironment.new()
	we.environment = env
	root.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, 30, 0)
	sun.light_energy = 1.2
	root.add_child(sun)
	var mid := (paths.size() - 1) * 0.5
	for i in paths.size():
		var packed := load(paths[i]) as PackedScene
		if packed == null:
			print("VIEW_FAIL ", paths[i])
			continue
		var n := packed.instantiate() as Node3D
		n.position = Vector3((i - mid) * gap, 0, 0)
		root.add_child(n)
	var cam := Camera3D.new()
	root.add_child(cam)
	cam.current = true
	cam.look_at_from_position(Vector3(0, dist * 0.7, dist * 0.8), Vector3(0, 1.5, 0))
	cam.fov = 60.0 if paths.size() > 1 else 50.0

func _process(_delta: float) -> bool:
	_frame += 1
	if _frame == 20:
		var out := OS.get_environment("SAGA_VIEW_OUT")
		root.get_texture().get_image().save_png(out)
		print("VIEW_OK ", out)
		quit()
	return false
