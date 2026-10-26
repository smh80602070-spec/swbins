extends SceneTree
## G-0412 최종 QC용 대표 둘 자세 띠. 실저장·게임 상태를 쓰지 않는다.
const Body := preload("res://saga_core/world/vroid_body.gd")
const Weapon := preload("res://games/saga_go/player/weapon_visual.gd")
var actors: Array = []

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var out := OS.get_environment("SAGA_MOTION_OUT")
	if out == "":
		out = ProjectSettings.globalize_path("res://tools/_out/combat_motion")
	DirAccess.make_dir_recursive_absolute(out)
	var world := Node3D.new()
	root.add_child(world)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.13, 0.16, 0.21)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.8, 0.85, 1.0)
	env.environment.ambient_light_energy = 0.8
	world.add_child(env)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-35, -25, 0)
	light.light_energy = 2.0
	world.add_child(light)
	var cam := Camera3D.new()
	world.add_child(cam)
	cam.position = Vector3(0, 1.1, 3.5)
	cam.fov = 40.0
	cam.look_at(Vector3(0, 0.9, 0))
	cam.current = true
	var Go: GDScript = load("res://games/saga_go/player/go_player.gd")
	for id in ["self", "sg_xiahoudun"]:
		var v := Body.build_hero(id)
		world.add_child(v)
		v.position.x = -0.65 if actors.is_empty() else 0.65
		Weapon.attach(v, "w_sword_0")
		var player: Node = Go.new()
		player.set("visual", v)
		player.set("_anim", v.get_node("AnimationPlayer"))
		player.call("_attach_foot_lock")
		var lp: Node = player.get("_life")
		lp.set_process(false)
		var sk := v.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
		sk.modifier_callback_mode_process = Skeleton3D.MODIFIER_CALLBACK_MODE_PROCESS_MANUAL
		for mod in sk.get_children():
			if mod is SkeletonModifier3D and mod != lp and not mod is SpringBoneSimulator3D:
				mod.influence = 0.0
		var ap := v.get_node("AnimationPlayer") as AnimationPlayer
		ap.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
		actors.append({"p": player, "ap": ap, "lp": lp, "sk": sk})
	var layer := CanvasLayer.new()
	root.add_child(layer)
	var label := Label.new()
	label.position = Vector2(24, 16)
	label.add_theme_font_size_override("font_size", 30)
	layer.add_child(label)
	var shots := ["idle_out", "idle_in", "walk_a", "walk_b", "run_a", "run_b", "windup", "attack_1", "attack_2", "attack_3", "hit", "jump"]
	var sheet := Image.create(2560, 1080, false, Image.FORMAT_RGB8)
	for i in shots.size():
		var name: String = shots[i]
		label.text = name + "    self / companion"
		for actor in actors:
			var ap: AnimationPlayer = actor.ap
			var lp: Node = actor.lp
			var clip := "idle"
			var time := 0.0
			if name.begins_with("walk") or name.begins_with("run"):
				clip = "walk" if name.begins_with("walk") else "sprint"
				time = ap.get_animation(clip).length * (0.25 if name.ends_with("a") else 0.75)
			elif name == "hit" or name == "jump":
				clip = name
				time = ap.get_animation(clip).length * 0.4
			ap.play(clip, 0.0)
			ap.seek(time, true)
			ap.advance(0.0)
			if name == "windup" or name.begins_with("attack"):
				var step := int(name.right(1)) - 1 if name.begins_with("attack") else 0
				var combat_clip := "combat/" + String(["attack", "sword_2", "sword_3"][step])
				var a := ap.get_animation(combat_clip)
				ap.play(combat_clip, 0.0)
				ap.seek(float(a.get_meta("strike_time")) * (0.5 if name == "windup" else 1.0), true)
				ap.advance(0.0)
			ap.speed_scale = 0.0
			# 정지 자세 띠에서는 보간 시계도 멈추므로, 계산한 자세를 보간 없이 다시 놓는다.
			var pose_clip := ap.current_animation
			var pose_time := ap.current_animation_position
			ap.stop()
			ap.play(pose_clip, 0.0)
			ap.seek(pose_time, true)
			ap.advance(0.0)
			lp.call("step", 0.3)
			lp.set("_clock", 0.6 if name == "idle_in" else 1.8)
		for frame in 8:
			for actor in actors:
				(actor.sk as Skeleton3D).advance(1.0 / 60.0)
			await process_frame
			await RenderingServer.frame_post_draw
		var img := root.get_texture().get_image()
		img.save_png(out.path_join(name + ".png"))
		img.convert(Image.FORMAT_RGB8)
		img.resize(640, 360)
		sheet.blit_rect(img, Rect2i(0, 0, 640, 360), Vector2i((i % 4) * 640, (i / 4) * 360))
	sheet.save_png(out.path_join("sheet.png"))
	for actor in actors:
		(actor.p as Node).free()
	print("SHOT_COMBAT_MOTION_DONE shots=", shots.size(), " out=", out)
	quit()
