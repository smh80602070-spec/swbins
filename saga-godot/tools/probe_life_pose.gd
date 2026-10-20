extends SceneTree
## G-0265 생활 몸짓 점검 — godot --headless --path saga-godot --script res://tools/probe_life_pose.gd → "PROBE life_pose OK|FAIL n"
## dex 몸 둘에 saga_core/world/life_pose.gd 를 붙이고(뼈대 손 갱신 Manual) 자세마다 뼈 위치를 잰다 — 값은 선 몸 머리 높이를 1 로 둔 비율.
##   웹 pose3d.js EXPECT 와 같은 기준: sit 엉덩이 < 0.35 · wave 오른손 > 머리·앞으로 안 뻗음 |앞| < 0.15·몸 오른쪽 > 0.1 ·
##   look/shift 두 손 < 0.75 · 가만히 8초 → sit · 움직이면 0.3초 안 sit 세기 0 · 두 번 붙여도 같은 노드.

const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const LifePose := preload("res://saga_core/world/life_pose.gd")
const BODIES := ["self", "probe_npc_5"]

var fails := 0


func _check(ok: bool, what: String) -> void:
	if not ok:
		fails += 1
	print("  %s %s" % ["ok  " if ok else "FAIL", what])


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	if not VroidBody.dex_available():
		print("PROBE life_pose SKIP dex 없음")
		print("PROBE life_pose OK")
		quit(0)
		return
	for id in BODIES:
		var v := VroidBody.build_hero(String(id), 3)
		root.add_child(v)
		var skel := v.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
		skel.modifier_callback_mode_process = Skeleton3D.MODIFIER_CALLBACK_MODE_PROCESS_MANUAL
		var ap := v.get_node("AnimationPlayer") as AnimationPlayer
		var lp: Node = LifePose.attach(v)
		_check(lp != null and LifePose.attach(v) == lp and LifePose.attach(skel) == lp, "%s 붙임·두 번 붙여도 같은 노드" % id)
		if lp == null:
			v.free()
			continue
		lp.set_process(false)
		var b := {}
		for k in ["hips", "head"]:
			b[k] = VroidBody.find_bone_of(skel, LifePose.HIPS if k == "hips" else LifePose.HEAD)
		b.rhand = VroidBody.find_bone_of(skel, LifePose.HAND[1])
		b.lhand = VroidBody.find_bone_of(skel, LifePose.HAND[0])
		var head_h := skel.get_bone_global_rest(b.head).origin.y
		var fwd: Vector3 = lp.get("_fwd")
		var right: Vector3 = lp.get("_right")
		## 가만히 8초 → 앉기
		lp.call("tick_still", 4.0, true)
		_check(not lp.call("is_resting"), "%s 4초엔 아직 서 있음" % id)
		lp.call("tick_still", 4.1, true)
		lp.call("step", 0.3)
		var r := await _pose(ap, skel, b, head_h, fwd, right)
		_check(lp.call("is_resting") and r.hips.y < 0.35, "%s sit 엉덩이 %.2f < 0.35" % [id, r.hips.y])
		## 움직이면 0.3초 안에 일어남
		lp.call("tick_still", 0.016, false)
		lp.call("step", 0.3)
		_check(float(lp.call("sit_weight")) <= 0.001 and not lp.call("is_resting"), "%s 움직이면 0.3초 안 sit 세기 0 (%.2f)" % [id, lp.call("sit_weight")])
		## 인사 — u 0.4
		lp.call("play", "wave")
		lp.call("step", 0.64)
		r = await _pose(ap, skel, b, head_h, fwd, right)
		_check(r.rhand.y > r.head.y, "%s wave 오른손 %.2f > 머리 %.2f" % [id, r.rhand.y, r.head.y])
		_check(absf(r.rhand.fwd) < 0.15, "%s wave 앞으로 안 뻗음 |%.2f| < 0.15" % [id, r.rhand.fwd])
		_check(r.rhand.side > 0.1, "%s wave 몸 오른쪽 %.2f > 0.1" % [id, r.rhand.side])
		lp.call("step", 1.0)
		## 둘러보기·체중 — u 0.5
		for pn in ["look", "shift"]:
			lp.call("play", pn)
			lp.call("step", float(LifePose.DUR[pn]) * 0.5)
			r = await _pose(ap, skel, b, head_h, fwd, right)
			_check(r.rhand.y < 0.75 and r.lhand.y < 0.75, "%s %s 두 손 %.2f·%.2f < 0.75" % [id, pn, r.rhand.y, r.lhand.y])
			lp.call("step", float(LifePose.DUR[pn]))
		_check(String(lp.call("current")) == "", "%s 몸짓 끝나면 쉼" % id)
		v.free()
	print("PROBE life_pose ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)


## idle 첫 자세 위에 몸짓을 한 번 얹고 뼈 위치(뼈대 공간, 머리 높이 = 1) — {뼈: {y, fwd, side}}.
func _pose(ap: AnimationPlayer, skel: Skeleton3D, b: Dictionary, head_h: float, fwd: Vector3, right: Vector3) -> Dictionary:
	## 수정자는 프레임 끝 뼈대 갱신에서 돈다 — 그 신호(skeleton_updated) 안에서 한 번 읽는다(신호 밖에선 애니 자세로 돌아가 있다).
	var out := {}
	var read := func() -> void:
		if not out.is_empty():
			return
		var hips := skel.get_bone_global_pose(int(b.hips)).origin
		for k in b:
			var p := skel.get_bone_global_pose(int(b[k])).origin
			out[k] = {"y": p.y / head_h, "fwd": (p - hips).dot(fwd) / head_h, "side": (p - hips).dot(right) / head_h}
	skel.skeleton_updated.connect(read)
	ap.play("idle")
	ap.seek(0.0, true)
	skel.advance(0.016)
	for i in 10:
		if not out.is_empty():
			break
		await process_frame
	skel.skeleton_updated.disconnect(read)
	if out.is_empty():
		fails += 1
		print("  FAIL 뼈대 갱신 신호 없음")
		for k in b:
			out[k] = {"y": 0.0, "fwd": 0.0, "side": 0.0}
	return out
