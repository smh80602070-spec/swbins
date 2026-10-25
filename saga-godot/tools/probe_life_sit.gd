extends SceneTree
## G-0394 앉기 자세 점검 — godot --headless --path saga-godot --script res://tools/probe_life_sit.gd → "PROBE life_sit OK|FAIL n"
## dex 몸 둘(probe_life_pose 와 같은 self·probe_npc_5)을 life_pose 로 앉히고 뼈를 미터로 잰다(몸 원점 = 발바닥 땅 0).
##   엉덩이 살 아래 ≈ 허벅지 뼈(다리 시작) 높이 − 허벅지 반지름(THIGH_R) → 땅 ±SEAT_TOL
##   두 손목이 같은 쪽 무릎에서 HAND_KNEE_M 안(손이 무릎 위) · 윗팔이 몸통 옆 아래로(팔꿈치가 어깨보다 아래)
## SIT_PRINT=1 이면 뼈 숫자만 찍는다(판정 없이).

const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const LifePose := preload("res://saga_core/world/life_pose.gd")
const BODIES := ["self", "probe_npc_5"]
const THIGH_R := 0.08        # 허벅지 뼈에서 엉덩이 살 아래까지(VRoid 어른 몸 — 허벅지 굵기 절반)
const SEAT_TOL := 0.02
const HAND_KNEE_M := 0.15

var fails := 0


func _check(ok: bool, what: String) -> void:
	if not ok:
		fails += 1
	print("  %s %s" % ["ok  " if ok else "FAIL", what])


func _initialize() -> void:
	_run.call_deferred()


func _bone(skel: Skeleton3D, names: Array) -> int:
	return VroidBody.find_bone_of(skel, names)


func _run() -> void:
	if not VroidBody.dex_available():
		print("PROBE life_sit SKIP dex 없음")
		print("PROBE life_sit OK")
		quit(0)
		return
	var only_print := OS.get_environment("SIT_PRINT") == "1"
	for id in BODIES:
		var v := VroidBody.build_hero(String(id), 3)
		root.add_child(v)
		var skel := v.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
		skel.modifier_callback_mode_process = Skeleton3D.MODIFIER_CALLBACK_MODE_PROCESS_MANUAL
		var ap := v.get_node("AnimationPlayer") as AnimationPlayer
		var lp: Node = LifePose.attach(v)
		lp.set_process(false)
		var b := {
			"hips": _bone(skel, LifePose.HIPS),
			"thigh0": _bone(skel, LifePose.THIGH[0]), "thigh1": _bone(skel, LifePose.THIGH[1]),
			"calf0": _bone(skel, LifePose.CALF[0]), "calf1": _bone(skel, LifePose.CALF[1]),
			"hand0": _bone(skel, LifePose.HAND[0]), "hand1": _bone(skel, LifePose.HAND[1]),
			"uarm0": _bone(skel, LifePose.UARM[0]), "uarm1": _bone(skel, LifePose.UARM[1]),
			"larm0": _bone(skel, LifePose.LARM[0]), "larm1": _bone(skel, LifePose.LARM[1]),
			"foot0": _bone(skel, LifePose.FOOT[0]),
		}
		var rest := {}
		for k in b:
			rest[k] = skel.get_bone_global_rest(int(b[k])).origin if int(b[k]) >= 0 else Vector3.ZERO
		lp.call("tick_still", 9.0, true)
		lp.call("step", 0.6)
		var p: Dictionary = await _read(ap, skel, b)
		if p.is_empty():
			fails += 1
			print("  FAIL %s 뼈대 갱신 신호 없음" % id)
			v.free()
			continue
		var thigh_y: float = minf(p.thigh0.y, p.thigh1.y)
		var seat := thigh_y - THIGH_R * float(rest.thigh0.y) / 0.9   # 몸 크기 비례(life_pose SIT_THIGH_REF)
		var hk0: float = (p.hand0 as Vector3).distance_to(p.calf0)
		var hk1: float = (p.hand1 as Vector3).distance_to(p.calf1)
		var elbow_below: bool = p.larm0.y < p.uarm0.y and p.larm1.y < p.uarm1.y
		print("  %s rest hips=%.3f thigh=%.3f foot=%.3f | sit hips=%.3f thigh=%.3f seat=%.3f knee=%.3f | 손목–무릎 %.2f·%.2f | 팔꿈치<어깨 %s" % [
			id, rest.hips.y, rest.thigh0.y, rest.foot0.y, p.hips.y, thigh_y, seat, minf(p.calf0.y, p.calf1.y), hk0, hk1, elbow_below])
		if not only_print:
			_check(absf(seat) <= SEAT_TOL, "%s 엉덩이 살 아래 %.3f m ≈ 땅(±%.2f)" % [id, seat, SEAT_TOL])
			_check(hk0 <= HAND_KNEE_M and hk1 <= HAND_KNEE_M, "%s 손이 무릎 위(%.2f·%.2f ≤ %.2f)" % [id, hk0, hk1, HAND_KNEE_M])
			_check(elbow_below, "%s 팔꿈치가 어깨보다 아래(팔 내려옴)" % id)
		v.free()
	print("PROBE life_sit ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)


## 수정자는 뼈대 갱신 신호 안에서만 자세가 보인다(probe_life_pose._pose 와 같은 법).
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
