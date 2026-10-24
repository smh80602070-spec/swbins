extends SceneTree

## G-0378 2나락 앞벽 걷어내기 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_cutaway.gd   → "PROBE dungeon_cutaway OK" / "FAIL n"
## ① 양면 변종 셰이더에 uniform 셋·discard 가 끼었다(cut_on 기본 0 — 옛 그림) ② 2나락 방에 DungeonCutaway 가 붙고 몇 프레임 뒤 PBR 재질마다 cut_on 1·카메라·주인공 자리
## ③ 손잡이 SAGA_DG_CUTAWAY=0 이면 안 붙음. 헤드리스라 그림은 촬영(dg_boss_tell)으로 본다.

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var RS: GDScript = load("res://games/saga_dungeon/world/dungeon_real_surface.gd")
	var CA: GDScript = load("res://games/saga_dungeon/world/dungeon_cutaway.gd")
	var code: String = (RS.two_sided_shader() as Shader).code
	check(code.contains("uniform float cut_on = 0.0;") and code.contains("uniform vec3 cut_player") and code.contains("discard;") and code.contains("cull_disabled"), "① 셰이더에 걷어내기(기본 꺼짐)")

	var sc := (load("res://games/saga_dungeon/world/TestRoom.tscn") as PackedScene).instantiate()
	root.add_child(sc)
	current_scene = sc
	for i in 10:
		await process_frame
	paused = false
	for i in 5:
		await process_frame
	var node := sc.get_node_or_null("DungeonCutaway")
	var mats: Array = RS.materials()
	var set_ok := not mats.is_empty()
	for m: ShaderMaterial in mats:
		set_ok = set_ok and float(m.get_shader_parameter("cut_on")) == 1.0
	check(node != null and set_ok, "② 방에 붙음 · 재질 %d 개 cut_on 1" % mats.size())

	OS.set_environment("SAGA_DG_CUTAWAY", "0")
	var off: Node = CA.attach(Node.new())
	OS.set_environment("SAGA_DG_CUTAWAY", "")
	check(off == null, "③ 끄면 안 붙음")

	print("PROBE dungeon_cutaway ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
