extends SceneTree

## G-0405 탈것 소리(말발굽·날갯짓) 자동 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_mount_sounds.gd   → "PROBE mount_sounds OK" / "FAIL n"
## ① 순수: hoof_set 돌·나무 hard / 풀·흙·모래·눈 soft · set_for(땅 탈것 바닥 위 걷기 = 말발굽, 섬 = "", 나는 탈것 공중 = 날갯짓·용은 heavy, 나는 탈것 땅 = "")
##    · interval(말발굽 빠를수록 짧게, 날갯짓 움직이면 잦게)
## ② 세 판(2나락·3마을·4종횡) 주인공 Mount 밑에 MountSounds 하나 · 소리 11 불러옴
## ③ 땅 탈것(pt_jeolyeong)에 오르면 발소리(StepSounds) 안 셈 · tick 이 그 판 땅 묶음(2나락 돌 → hard, 4종횡 풀 → soft, 3마을 발밑 따라) · 1→2→3 돌려 쓰기
## ④ 내리면 MountSounds 안 셈 · 다시 발소리 셈
## 헤드리스라 소리는 안 들리고 counts 만. 마지막 탈것 설정(user://mount.cfg)은 점검 앞 그대로 되돌린다.

const MountSounds := preload("res://saga_core/audio/mount_sounds.gd")
const SCENES := {"dungeon": "res://games/saga_dungeon/world/TestRoom.tscn", "forest": "res://games/saga_forest/world/TestVillageForest.tscn",
	"story": "res://games/saga_story/world/TestField.tscn"}
const CFG := "user://mount.cfg"

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _init() -> void:
	await process_frame
	var cfg_old := FileAccess.get_file_as_string(CFG) if FileAccess.file_exists(CFG) else ""

	# ①
	if MountSounds.hoof_set("stone") != "hoof_hard" or MountSounds.hoof_set("wood") != "hoof_hard" or MountSounds.hoof_set("grass") != "hoof_soft" or MountSounds.hoof_set("snow") != "hoof_soft" or MountSounds.hoof_set("sand") != "hoof_soft":
		_fail("① hoof_set")
	var sets := [MountSounds.set_for("ground", "pt_jeolyeong", true, 8.0, "stone"), MountSounds.set_for("ground", "pt_jeolyeong", true, 0.2, "grass"),
		MountSounds.set_for("fly", "pt_jujak", false, 10.0, ""), MountSounds.set_for("fly", "pt_cheongryong", false, 0.0, ""), MountSounds.set_for("fly", "pt_jujak", true, 3.0, "grass"),
		MountSounds.set_for("ground", "pt_baekho", false, 8.0, "grass")]
	if sets != ["hoof_hard", "", "wing_flap", "wing_heavy", "", ""]:
		_fail("① set_for %s" % [sets])
	if not (MountSounds.interval("hoof_soft", 16.0) < MountSounds.interval("hoof_soft", 4.0) and MountSounds.interval("wing_flap", 10.0) < MountSounds.interval("wing_flap", 0.0)
			and MountSounds.interval("wing_heavy", 10.0) > MountSounds.interval("wing_flap", 10.0)):
		_fail("① interval")

	for g in SCENES:
		var sc := (load(SCENES[g]) as PackedScene).instantiate()
		root.add_child(sc)
		current_scene = sc
		for _i in 60:
			await physics_frame
		var p := get_first_node_in_group("player") as CharacterBody3D
		var mt: Node = p.get_node_or_null("Mount") if p else null
		var ms: Node = mt.get_node_or_null("MountSounds") if mt else null
		var st: Node = p.get_node_or_null("StepSounds") if p else null
		if ms == null or st == null:
			_fail("② %s Mount %s MountSounds %s StepSounds %s" % [g, mt != null, ms != null, st != null])
		else:
			var n := (ms.get("_streams") as Dictionary).size()
			if n != 11:
				_fail("② %s 소리 %d != 11" % [g, n])
			mt.call("mount", "pt_jeolyeong")
			await physics_frame
			var floor_ok := p.is_on_floor()
			var s0 := int((st.get("counts") as Dictionary).step)
			p.velocity = Vector3(8.0, 0.0, 0.0)
			st.set("_t", 0.0)
			st.call("_physics_process", 0.016)
			var s1 := int((st.get("counts") as Dictionary).step)
			if s1 != s0:
				_fail("③ %s 탄 동안 발소리 %d→%d" % [g, s0, s1])
			var want := MountSounds.hoof_set(String(st.call("surface_now")))
			var keys: Array[String] = []
			for k in 3:
				ms.set("_t", 0.0)
				p.velocity = Vector3(8.0, 0.0, 0.0)
				ms.call("_physics_process", 0.016)
				keys.append(String(ms.get("last_key")))
			print("MOUNTSND %s floor=%s surface=%s → %s" % [g, floor_ok, st.call("surface_now"), keys])
			if floor_ok and keys != [want + "_2", want + "_3", want + "_1"] and keys != [want + "_1", want + "_2", want + "_3"]:
				_fail("③ %s 말발굽 %s (기대 %s)" % [g, keys, want])
			if g == "dungeon" and want != "hoof_hard" or g == "story" and want != "hoof_soft":   # 3마을은 세이브 자리(집 안 = 나무)에 따라 둘 다
				_fail("③ %s 땅 묶음 %s" % [g, want])
			mt.call("dismount", "", true)
			await physics_frame
			var c := (ms.get("counts") as Dictionary).duplicate()
			ms.set("_t", 0.0)
			p.velocity = Vector3(8.0, 0.0, 0.0)
			ms.call("_physics_process", 0.016)
			if (ms.get("counts") as Dictionary) != c:
				_fail("④ %s 내린 뒤 말발굽 셈" % g)
			var s2 := int((st.get("counts") as Dictionary).step)
			st.set("_t", 0.0)
			st.call("_physics_process", 0.016)
			if p.is_on_floor() and int((st.get("counts") as Dictionary).step) != s2 + 1:
				_fail("④ %s 내린 뒤 발소리 안 셈" % g)
			p.velocity = Vector3.ZERO
		sc.queue_free()
		for _k in 3:
			await process_frame

	if cfg_old == "":
		DirAccess.remove_absolute(ProjectSettings.globalize_path(CFG))
	else:
		var f := FileAccess.open(CFG, FileAccess.WRITE)
		f.store_string(cfg_old)
		f.close()
	print("PROBE mount_sounds ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
