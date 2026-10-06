extends SceneTree
## 얼굴 클로즈업 촬영 — 몸 glb·gltf 하나에(G-0030 부터 기본은 새 인물 몸 주인공 dj_haean) 셀 재질을 입혀 머리 높이에서 정면으로 찍는다(2026-09-30 원신풍 눈).
##   FACE_OUT=<png 경로> [FACE_GLB=res://assets/characters_dex/dj_haean.gltf] "$GODOT_CONSOLE" --path saga-godot --rendering-method mobile \
##       --position -4000,0 --resolution 1000x1000 --script res://tools/face_view.gd
## 머리 높이는 뼈 "Head" 로 잰다. 카메라는 몸 앞(+Z)에서 머리를 바라본다.

const CelShaderApply := preload("res://saga_core/shaders/cel_shader_apply.gd")
const AnimeMouthScript := preload("res://saga_core/anime_mouth.gd")

var _frame := 0
var _cam: Camera3D

func _init() -> void:
	var glb := OS.get_environment("FACE_GLB")
	if glb == "":
		glb = "res://assets/characters_dex/dj_haean.gltf"
	var body: Node3D = (load(glb) as PackedScene).instantiate()
	root.add_child(body)
	CelShaderApply.apply_to(body)
	## FACE_SHUT=1 이면 감은 눈(깜박임 그림)으로 찍는다.
	if OS.get_environment("FACE_SHUT") != "":
		for mi in body.find_children("Eyes", "MeshInstance3D", true, false):
			for si in (mi as MeshInstance3D).get_surface_override_material_count():
				var sm := (mi as MeshInstance3D).get_surface_override_material(si) as ShaderMaterial
				if sm != null and sm.has_meta("eye_closed"):
					sm.set_shader_parameter("albedo_texture", sm.get_meta("eye_closed"))
	## FACE_MOUTH=open|round|thin 이면 그 입 모양(anime_mouth)으로 찍는다.
	if OS.get_environment("FACE_MOUTH") != "":
		for mi in body.find_children("*", "MeshInstance3D", true, false):
			for si in (mi as MeshInstance3D).get_surface_override_material_count():
				var sm := (mi as MeshInstance3D).get_surface_override_material(si) as ShaderMaterial
				if sm != null and sm.has_meta("mouth_base"):
					var texs: Dictionary = AnimeMouthScript.textures_for(sm.get_meta("mouth_base"), sm.get_meta("mouth_uv"))
					sm.set_shader_parameter("albedo_texture", texs[OS.get_environment("FACE_MOUTH")])
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.62, 0.78, 0.95)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.75, 0.8, 0.9)
	env.ambient_light_energy = 0.7
	var we := WorldEnvironment.new()
	we.environment = env
	root.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-30, 25, 0)
	sun.light_energy = 1.1
	root.add_child(sun)
	var head_y := 1.5
	for sk in body.find_children("*", "Skeleton3D", true, false):
		var s := sk as Skeleton3D
		var b := s.find_bone("Head")
		if b < 0:
			b = s.find_bone("head")
		if b >= 0:
			head_y = s.get_bone_global_rest(b).origin.y + 0.05
	_cam = Camera3D.new()
	_cam.fov = float(OS.get_environment("FACE_FOV")) if OS.get_environment("FACE_FOV") != "" else 28.0
	root.add_child(_cam)
	var ey := head_y + float(OS.get_environment("FACE_DY")) if OS.get_environment("FACE_DY") != "" else head_y
	_cam.look_at_from_position(Vector3(0.0, ey, 1.3), Vector3(0.0, ey, 0.0))
	## 몸이 +Z 를 보는지 -Z 인지는 모델마다 — FACE_TURN=1 이면 뒤집어 찍는다.
	if OS.get_environment("FACE_TURN") != "":
		body.rotation.y = PI

func _process(_d: float) -> bool:
	_frame += 1
	if _frame == 30:
		var img := root.get_texture().get_image()
		img.save_png(OS.get_environment("FACE_OUT"))
		quit()
	return false
