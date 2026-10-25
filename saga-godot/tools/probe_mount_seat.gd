extends SceneTree
## G-0395 탄 자세 점검 — godot --headless --path saga-godot --script res://tools/probe_mount_seat.gd → "PROBE mount_seat OK|FAIL n"
## 탈것마다(saga_core/data/mounts.gd) 몸을 mount.gd 처럼 세우고(높이 height·앞뒤 −seat_z) dex 기수(self)에 mount.gd rider_fit
## (게임과 같은 함수 — 등 높이·몸통 반폭 실측 → 기수 발 높이)와 seat_pose.set_ik(반폭)로 앉힌 뒤 미터로 잰다:
##   엉덩이 살 아래(허벅지 뼈 − 반지름) − 등 윗면 = 틈(±GAP_TOL)
##   감싸기(말 등 몸통 좁은 것): 무릎이 등 윗면 아래 · 무릎 관절이 몸통 옆면 −0.05(다리 반지름 — 살은 옆구리에 닿음)~KNEE_OUT
##   얹기(몸통이 너무 넓은 새·용): 무릎이 등 윗면 근처(±0.12 — 다리를 등 위에)
## MOUNT_PRINT=1 이면 숫자만. MOUNT_OLD=1 이면 옛 방식(seat_y 손 수치·옛 각)으로 잰다(전후 비교). 판정은 촬영(probe_shots k_ride_*)이 먼저 — 이 점검은 숫자 지킴이.

const Mounts := preload("res://saga_core/data/mounts.gd")
const CreatureBuilder := preload("res://saga_core/world/creature_builder.gd")
const SeatPose := preload("res://saga_core/player/seat_pose.gd")
const MountScript := preload("res://saga_core/player/mount.gd")
const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const LifePose := preload("res://saga_core/world/life_pose.gd")
const GAP_TOL := 0.03
const KNEE_OUT := 0.10

var fails := 0


func _check(ok: bool, what: String) -> void:
	if not ok:
		fails += 1
	print("  %s %s" % ["ok  " if ok else "FAIL", what])


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	if not VroidBody.dex_available():
		print("PROBE mount_seat SKIP dex 없음")
		print("PROBE mount_seat OK")
		quit(0)
		return
	var only_print := OS.get_environment("MOUNT_PRINT") == "1"
	var old := OS.get_environment("MOUNT_OLD") == "1"
	var v := VroidBody.build_hero("self", 3)
	root.add_child(v)
	var skel := v.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	skel.modifier_callback_mode_process = Skeleton3D.MODIFIER_CALLBACK_MODE_PROCESS_MANUAL
	var ap := v.get_node("AnimationPlayer") as AnimationPlayer
	var sp: Node = SeatPose.attach(skel)
	sp.call("set_seated", true)
	sp.set("influence", 1.0)
	sp.set_process(false)
	var b := {
		"thigh0": VroidBody.find_bone_of(skel, LifePose.THIGH[0]), "thigh1": VroidBody.find_bone_of(skel, LifePose.THIGH[1]),
		"calf0": VroidBody.find_bone_of(skel, LifePose.CALF[0]), "calf1": VroidBody.find_bone_of(skel, LifePose.CALF[1]),
	}
	var hips_rest := skel.get_bone_global_rest(VroidBody.find_bone_of(skel, LifePose.HIPS)).origin.y
	var thigh_rest := skel.get_bone_global_rest(int(b.thigh0)).origin.y
	var tr := MountScript.SEAT_THIGH_R * thigh_rest / 0.9
	for d: Dictionary in Mounts.MOUNTS:
		var body := CreatureBuilder.build_pet(String(d.id), float(d.height))
		root.add_child(body)
		body.position = Vector3(0, 0, -float(d.get("seat_z", 0.0)))
		await process_frame
		var fit: Dictionary = MountScript.rider_fit(skel, 1.0, body, float(d.get("seat_z", 0.0)))
		var bk: Dictionary = MountScript.back_of(body, float(d.get("seat_z", 0.0)))
		var ride: float
		if old or fit.is_empty():
			ride = float(d.get("seat_y", 0.0)) + MountScript.SEAT_CLEAR - hips_rest
			sp.call("set_ik", -1.0)
		else:
			ride = float(fit.ride)
			sp.call("set_ik", float(fit.half))
		var p: Dictionary = await _read(ap, skel, b)
		if p.is_empty():
			fails += 1
			print("  FAIL %s 뼈대 갱신 신호 없음" % d.id)
			body.free()
			continue
		var back := float(bk.get("back", 0.0))
		var half := float(bk.get("half", 0.0))
		# 몸(body)은 z 로만 옮겨 로컬 = 월드 꼴(회전 없음) — 등·반폭 값 그대로 비교
		var gap := minf(p.thigh0.y, p.thigh1.y) + ride - tr - back
		var k0: Vector3 = p.calf0 + Vector3(0, ride, 0)
		var k1: Vector3 = p.calf1 + Vector3(0, ride, 0)
		var kout := minf(absf(k0.x), absf(k1.x)) - half
		var lt := skel.get_bone_global_rest(int(b.thigh0)).origin.distance_to(skel.get_bone_global_rest(int(b.calf0)).origin)
		var hx := absf(skel.get_bone_global_rest(int(b.thigh0)).origin.x)
		var straddle: bool = not old and not fit.is_empty() and SeatPose.straddles(float(fit.half), hx, lt)
		print("  %s %s seat_y=%.2f 등=%.3f 반폭=%.2f 틈=%+.3f 무릎(등 %+.2f) 무릎 옆 %+.3f" % [
			d.id, "감싸기" if straddle else ("얹기" if not old else "옛"), float(d.get("seat_y", 0.0)), back, half, gap, k0.y - back, kout])
		if not only_print and not old:
			_check(absf(gap) <= GAP_TOL, "%s 엉덩이–등 틈 %+.3f(±%.2f)" % [d.id, gap, GAP_TOL])
			if straddle:
				_check(k0.y < back and k1.y < back, "%s 감싸기 — 무릎이 등 윗면 아래" % d.id)
				_check(kout >= -0.05 and kout <= KNEE_OUT, "%s 감싸기 — 무릎 관절이 옆구리 −0.05(다리 반지름)~%.2f 안 %+.3f" % [d.id, KNEE_OUT, kout])
			else:
				_check(absf(k0.y - back) <= 0.12 and absf(k1.y - back) <= 0.12, "%s 얹기 — 무릎이 등 위(%+.2f)" % [d.id, k0.y - back])
		body.free()
	v.free()
	print("PROBE mount_seat ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)


func _read(ap: AnimationPlayer, skel: Skeleton3D, b: Dictionary) -> Dictionary:
	var out := {}
	var read := func() -> void:
		if not out.is_empty():
			return
		for k in b:
			out[k] = skel.get_bone_global_pose(int(b[k])).origin if int(b[k]) >= 0 else Vector3.ZERO
	skel.skeleton_updated.connect(read)
	ap.play("idle")
	ap.seek(0.0, true)
	skel.advance(0.016)
	for i in 10:
		if not out.is_empty():
			break
		await process_frame
	skel.skeleton_updated.disconnect(read)
	return out
