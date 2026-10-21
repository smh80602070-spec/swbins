extends SceneTree
## G-0265 생활 몸짓 점검 — godot --headless --path saga-godot --script res://tools/probe_life_pose.gd → "PROBE life_pose OK|FAIL n"
## dex 몸 둘에 saga_core/world/life_pose.gd 를 붙이고(뼈대 손 갱신 Manual) 자세마다 뼈 위치를 잰다 — 값은 선 몸 머리 높이를 1 로 둔 비율.
##   웹 pose3d.js EXPECT 와 같은 기준: sit 엉덩이 < 0.35 · wave 오른손 > 머리·앞으로 안 뻗음 |앞| < 0.15·몸 오른쪽 > 0.1 ·
##   look/shift 두 손 < 0.75 · 가만히 8초 → sit · 움직이면 0.3초 안 sit 세기 0 · 두 번 붙여도 같은 노드.
## 둘째 절(G-0266 연결 한 줄 = 점검 한 줄) — 판 코드를 실제로 불러 몸짓이 켜졌는지:
##   1만리 npc_builder._on_body_entered → 주민 wave · 4종횡 story_talk_npc._on_range_entered → wave ·
##   4종횡 StoryPlayer._walk(입력 없음·땅) → 앉기(sit 세기 > 0.5) · 5천하 전술판 _select → 말하는 손짓 ·
##   _play(attack) → 몸짓 멈춤(hold)·idle 이면 풂 · idle_tick → 쉬는 장수 둘러보기/체중. 진짜 세이브는 안 쓴다(메모리만).

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
		if ap.has_animation("greet"):
			## G-0275 — 모캡 greet 클립이 있는 몸은 뼈 코드 대신 그 클립(손 높이는 클립 몫 — SAGA_MOCAP=0 이 뼈 코드 기준을 잰다).
			_check(ap.current_animation == "greet" and String(lp.call("current")) == "wave", "%s wave = greet 클립(%s)" % [id, ap.current_animation])
			ap.play("idle")
			ap.clear_queue()
			lp.call("step", 3.0)
		else:
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
	await _wiring()
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


const REALM_STATS := {"sg_xiahoudun": {"might": 90, "wisdom": 50, "command": 80}, "sg_zhangliao": {"might": 85, "wisdom": 60, "command": 80}}


func _wiring() -> void:
	var stage := Node3D.new()
	root.add_child(stage)
	current_scene = stage
	var me := CharacterBody3D.new()
	me.add_to_group("player")
	stage.add_child(me)
	## 1만리 마을 사람
	var nb := Node3D.new()
	nb.set_script(load("res://games/saga_go/world/npc_builder.gd"))
	stage.add_child(nb)
	var v: Dictionary = nb.get("VILLAGERS")[0]
	nb.call("_on_body_entered", me, v)
	var lp: Node = (nb.get("lifes") as Dictionary).get(v.id)
	_check(lp != null and String(lp.call("current")) == "wave", "1만리 주민 %s 다가오면 인사(%s)" % [v.id, lp.call("current") if lp != null else "없음"])
	## 4종횡 말 거는 사람
	var tn := Node3D.new()
	tn.set_script(load("res://games/saga_story/world/story_talk_npc.gd"))
	stage.add_child(tn)
	tn.call("_on_range_entered", me)
	var tl: Node = tn.get("_life")
	_check(tl != null and String(tl.call("current")) == "wave", "4종횡 말 거는 사람 다가오면 인사")
	## 4종횡 나 — 땅 위 입력 없음 → 앉기
	var floor_body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(40, 1, 40)
	cs.shape = box
	floor_body.add_child(cs)
	floor_body.position = Vector3(100, -0.5, 0)
	stage.add_child(floor_body)
	var p: CharacterBody3D = (load("res://games/saga_story/player/StoryPlayer.tscn") as PackedScene).instantiate()
	stage.add_child(p)
	p.set_physics_process(false)
	p.set_process(false)
	p.global_position = Vector3(100, 0.02, 0)
	await physics_frame
	var pl: Node = p.get("_life")
	if pl != null:
		pl.set("sit_after", 0.1)
		for i in 20:
			p.call("_walk", 1.0 / 60.0)
			p.move_and_slide()
		pl.call("step", 0.3)
	_check(pl != null and bool(pl.call("is_resting")) and float(pl.call("sit_weight")) > 0.5, "4종횡 나 가만히 → 앉기(sit %.2f · 땅 %s)" % [float(pl.call("sit_weight")) if pl != null else -1.0, p.is_on_floor()])
	## 5천하 전술판
	var View: GDScript = load("res://games/saga_realm/world/realm_tactics_view.gd")
	var T: GDScript = load("res://games/saga_realm/data/realm_tactics.gd")
	var b: Dictionary = T.make_board("g-0266", "plain", false)
	T.units_of(b, ["sg_xiahoudun"], ["sg_zhangliao"], [800], REALM_STATS)
	var view: Node = View.open(stage, "x", {"board": b, "mine": ["sg_xiahoudun"]}, func(_g: Dictionary) -> void: pass, false)
	await process_frame
	var uid := "me:sg_xiahoudun"
	var rl: Node = (view.get("_units") as Dictionary)[uid].get("life")
	view.call("_select", uid)
	_check(rl != null and bool(rl.call("is_talking")), "5천하 장수 고르면 명 받음 손짓")
	view.call("_play", uid, "attack")
	var held: bool = rl != null and bool(rl.call("is_held"))
	view.call("_play", uid, "idle")
	_check(held and not bool(rl.call("is_held")), "5천하 공격 중 몸짓 멈춤 · idle 이면 풂")
	view.call("idle_tick", 10.0)
	var any := false
	for k in view.get("_units"):
		var l: Node = (view.get("_units") as Dictionary)[k].get("life")
		any = any or (l != null and ["look", "shift"].has(String(l.call("current"))))
	_check(any, "5천하 대기 장수 둘러보기·체중(타이머 하나)")
	view.call("_on_cancel")
	await process_frame
	stage.queue_free()
	await process_frame
