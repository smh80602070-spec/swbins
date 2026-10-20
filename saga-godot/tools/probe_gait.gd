extends SceneTree
## G-0264 걸음새 측정 — godot --headless --path saga-godot --script res://tools/probe_gait.gd → "PROBE gait OK|FAIL n"
## dex 몸 셋에 walk·sprint 를 1/60초씩 advance 하며 발목(월드) 위치를 잰다(몸은 +Z 로 V m/s 만큼 민다).
##   v0   = 발목이 그 발 최저+6.5cm 안(발바닥 구르는 동안)에서 뒤로 가는 빠르기 — 클립 본래 빠르기(m/s, 몸 배율 포함)
##   slip = 발목이 최저+3cm 안(땅에 붙은 동안) 구간 하나에서 땅 위로 미끄러진 거리(cm, 걸음 평균)
## 첫째 절(before) = 고치기 전(클립 그대로·빠르기 1.0, walk 6·sprint 10 m/s).
## 둘째 절(after)  = foot_lock.gd 걸음새(gait — 클립·빠르기) + 디딘 발 잠금 모형: 닿은 자리에 잠그고, 엉덩이(허벅지 뿌리)→잠근 자리가
##   다리 길이(허벅지+정강이)를 넘는 만큼 끌려간 것 + RELEASE 넘어 다시 잠근 거리를 미끄러짐으로 센다.
##   (실제 IK·레이는 물리 땅이 있어야 해 traversal·mount 점검이 몸 그대로 돈다.) 걸음당 > SLIP_MAX(3cm) 면 FAIL.

const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const FootLock := preload("res://saga_core/player/foot_lock.gd")
const BODIES := ["self", "sg_zhugeliang", "probe_npc_3"]
const DT := 1.0 / 60.0
const SLIP_MAX := 3.0
const V0_EPS := 0.065
const SLIP_EPS := 0.03
const SPEEDS := {"walk": 6.0, "sprint": 10.0}

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _initialize() -> void:
	_run.call_deferred()   # 뿌리 창이 트리에 든 뒤(AnimationPlayer·뼈 전역 자세가 돈다)


func _run() -> void:
	if not VroidBody.dex_available():
		print("PROBE gait SKIP dex 없음")
		print("PROBE gait OK")
		quit(0)
		return
	var v0s := {"walk": [], "sprint": []}
	for id in BODIES:
		var v := VroidBody.build_hero(String(id), 3)
		root.add_child(v)
		var skel := v.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
		var ap := v.get_node("AnimationPlayer") as AnimationPlayer
		var bones := {}
		for k in 2:
			bones["foot%d" % k] = VroidBody.find_bone_of(skel, FootLock.FOOT[k])
			bones["thigh%d" % k] = VroidBody.find_bone_of(skel, FootLock.THIGH[k])
			bones["calf%d" % k] = VroidBody.find_bone_of(skel, FootLock.CALF[k])
		for clip in ["walk", "sprint"]:
			var spd: float = SPEEDS[clip]
			var v0: float = _measure(v, skel, ap, bones, clip, 1.0, 0.0, false)[0]
			(v0s[clip] as Array).append(v0 / v.scale.y)
			var before: float = _measure(v, skel, ap, bones, clip, 1.0, spd, false)[1]
			var g: Array = FootLock.gait(spd, v.scale.y, false)
			var only_rate: float = _measure(v, skel, ap, bones, String(g[0]), float(g[1]), spd, false)[1]
			var after: float = _measure(v, skel, ap, bones, String(g[0]), float(g[1]), spd, true)[1]
			print("GAIT %s %s v0=%.2fm/s scale=%.2f V=%.0f slip_before=%.1fcm → %s×%.2f slip_rate=%.1fcm slip_after=%.1fcm" % [id, clip, v0, v.scale.y, spd, before, g[0], g[1], only_rate, after])
			if after > SLIP_MAX:
				_fail("%s %s 걸음당 미끄러짐 %.1fcm > %.0f" % [id, clip, after, SLIP_MAX])
		v.free()
	for clip in v0s:
		var a: Array = v0s[clip]
		var s := 0.0
		for x in a:
			s += float(x)
		print("GAIT v0 %s 배율1 평균=%.2fm/s (foot_lock.gd V0_%s=%.2f)" % [clip, s / a.size(), String(clip).to_upper(), FootLock.V0_WALK if clip == "walk" else FootLock.V0_SPRINT])
	print("PROBE gait ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)


## [v0(m/s), 걸음당 미끄러짐(cm)] — 클립 두 바퀴. lock = 디딘 발 잠금 모형(위 머리말).
func _measure(v: Node3D, skel: Skeleton3D, ap: AnimationPlayer, b: Dictionary, clip: String, rate: float, spd: float, lock: bool) -> Array:
	ap.play(clip)
	ap.seek(0.0, true)
	var n := int(ceil(ap.get_animation(clip).length * 2.0 / (DT * rate)))
	var xf := _chain(v, skel)
	var leg := [0.0, 0.0]
	for k in 2:
		var th := skel.get_bone_global_rest(int(b["thigh%d" % k])).origin
		var ca := skel.get_bone_global_rest(int(b["calf%d" % k])).origin
		var fo := skel.get_bone_global_rest(int(b["foot%d" % k])).origin
		leg[k] = ((th - ca).length() + (ca - fo).length()) * v.scale.y
	var foot := [[], []]
	var hip := [[], []]
	for i in n:
		ap.advance(DT * rate)
		var off := Vector3(0, 0, spd * float(i + 1) * DT)   # 몸이 +Z(앞)로 간 만큼
		for k in 2:
			foot[k].append(xf * skel.get_bone_global_pose(int(b["foot%d" % k])).origin + off)
			hip[k].append(xf * skel.get_bone_global_pose(int(b["thigh%d" % k])).origin + off)
	var back := 0.0
	var stance_t := 0.0
	var slips := []
	for k in 2:
		var lo := INF
		for p in foot[k]:
			lo = minf(lo, (p as Vector3).y)
		var seg := []
		var lk := Vector3.ZERO
		var drag := 0.0
		for i in n:
			var p: Vector3 = foot[k][i]
			if i > 0 and p.y <= lo + V0_EPS and (foot[k][i - 1] as Vector3).y <= lo + V0_EPS:
				back += maxf(0.0, ((foot[k][i - 1] as Vector3).z - spd * float(i) * DT) - (p.z - spd * float(i + 1) * DT))
				stance_t += DT
			var down := p.y <= lo + SLIP_EPS
			if down:
				if seg.is_empty():
					lk = p
					drag = 0.0
				elif lock:
					var h: Vector3 = hip[k][i]
					drag = maxf(drag, (lk - h).length() - float(leg[k]) * 1.02)
					if Vector2(p.x - lk.x, p.z - lk.z).length() > FootLock.RELEASE:
						drag += Vector2(p.x - lk.x, p.z - lk.z).length()
						lk = p
				seg.append(p.z)
			if (not down or i == n - 1) and seg.size() > 2:
				slips.append(maxf(drag, 0.0) * 100.0 if lock else (seg.max() - seg.min()) * 100.0)
			if not down:
				seg = []
	var slip := 0.0
	for s in slips:
		slip += float(s)
	slip = slip / maxf(1.0, float(slips.size()))
	return [back / maxf(stance_t, 0.001) * rate, slip]


## 몸 뿌리(v) 기준 → 뼈대 공간 변환(부모 줄을 곱한다). v 자신의 배율 포함.
func _chain(v: Node3D, skel: Node3D) -> Transform3D:
	var t := Transform3D.IDENTITY
	var n: Node = skel
	while n != null and n != v:
		if n is Node3D:
			t = (n as Node3D).transform * t
		n = n.get_parent()
	return v.transform * t
