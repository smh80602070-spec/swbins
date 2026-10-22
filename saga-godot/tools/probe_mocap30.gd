extends SceneTree
## G-0282 모캡 30(K-0161 clips30) 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_mocap30.gd   → "PROBE mocap30 OK" / "FAIL n"
## ① 사람 몸(3마을 주인공) AnimationPlayer 에 MOCAP30 29 이름 · 되풀이 표(MOCAP30_LOOP)대로 루프 · jump 는 옛 dex 것 그대로
## ② 공용 player: hold(fish_cast→fish_wait) 동안 얼어도 서 있어도 idle 이 안 덮음 · 2.6초 뒤 fish_wait · unhold → idle ·
##    탈것 위 서기 ride_idle · play_once(gather·throw·plant·hammer·dig) 직후 걸음새가 안 덮음
## ③ 3마을 낚시터(fishing_spot): 던지면 몸이 fish_wait 를 쥐고, 줄이 거둬지면 놓음
## ④ 4종횡 줄: 오르내리면 ladder · 멈추면 hang
## ⑤ 배선 자리(1만리 낚시·채집·들어 던지기·3마을 채집·심기·제작대)에 클립 이름 — 장면 없이 글로만
## ⑥ SAGA_MOCAP30=0 이면 클립 없음·hold false·탈것 위 idle(옛 길)

const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const WIRES := {
	"res://games/saga_go/world/fishing.gd": ["\"fish_cast\", \"fish_wait\"", "unhold"],
	"res://games/saga_go/world/gathering.gd": ["\"gather\""],
	"res://games/saga_go/combat/field_grab.gd": ["\"throw\""],
	"res://games/saga_forest/world/gatherable_builder.gd": ["\"dig\"", "\"gather\""],
	"res://games/saga_forest/world/forest_planting.gd": ["\"plant\"", "\"gather\""],
	"res://games/saga_forest/world/craft_bench.gd": ["\"hammer\""],
}

var fails := 0


func _fail(msg: String) -> void:
	fails += 1
	print("  FAIL ", msg)


func _player(stage: Node, path: String) -> Node:
	var p: Node = (load(path) as PackedScene).instantiate()
	stage.add_child(p)
	return p


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	if not VroidBody.dex_available() or not VroidBody.mocap30_on():
		print("PROBE mocap30 SKIP dex·clips30 없음")
		print("PROBE mocap30 OK")
		quit(0)
		return
	var stage := Node3D.new()
	root.add_child(stage)
	var p := _player(stage, "res://games/saga_forest/player/ForestPlayer.tscn")
	for _i in 3:
		await physics_frame
	var ap := p.get("_anim") as AnimationPlayer
	## ①
	var miss := []
	for n: String in VroidBody.MOCAP30:
		if ap == null or not ap.has_animation(n):
			miss.append(n)
		elif (ap.get_animation(n).loop_mode != Animation.LOOP_NONE) != VroidBody.MOCAP30_LOOP.has(n):
			_fail("① %s 루프 %d" % [n, ap.get_animation(n).loop_mode])
	if not miss.is_empty():
		_fail("① 없는 클립 %s" % [miss])
	var base := load(VroidBody.DEX_LIB) as AnimationLibrary
	if ap != null and base.has_animation("jump") and absf(ap.get_animation("jump").length - base.get_animation("jump").length) > 0.001:
		_fail("① jump 가 모캡 것으로 덮임")
	print("M30 clips=%d miss=%s" % [VroidBody.MOCAP30.size() - miss.size(), miss])
	if ap == null:
		_finish()
		return
	## ②
	p.set("frozen", true)
	if not bool(p.call("hold", "fish_cast", "fish_wait")):
		_fail("② hold false")
	for _i in 5:
		await physics_frame
	if ap.current_animation != "fish_cast":
		_fail("② 얼린 서기가 던지기를 덮음(%s)" % ap.current_animation)
	await create_timer(ap.get_animation("fish_cast").length + 0.3).timeout
	if ap.current_animation != "fish_wait":
		_fail("② 던진 뒤 기다림 아님(%s)" % ap.current_animation)
	p.set("frozen", false)
	for _i in 3:
		await physics_frame
	if ap.current_animation != "fish_wait":
		_fail("② 서 있는데 기다림을 놓음(%s)" % ap.current_animation)
	p.call("unhold")
	for _i in 3:
		await physics_frame
	if ap.current_animation != "idle":
		_fail("② unhold 뒤 %s" % ap.current_animation)
	p.set("mounted", true)
	for _i in 3:
		await physics_frame
	if ap.current_animation != "ride_idle":
		_fail("② 탈것 위 서기 %s" % ap.current_animation)
	if String(p.call("_ride_anim", true)) != "ride_charge":
		_fail("② 탈것 달리기 클립 아님")
	p.set("mounted", false)
	for clip in ["gather", "throw", "plant", "hammer", "dig"]:
		p.set("_once_until", 0)
		if not bool(p.call("play_once", clip, 0.9)):
			_fail("② play_once %s false" % clip)
		p.call("_play_anim", "walk")
		if ap.current_animation != clip:
			_fail("② %s 직후 걸음새가 덮음(%s)" % [clip, ap.current_animation])
	p.set("_once_until", 0)
	p.call("_play_anim", "idle")
	## ③ 3마을 낚시터
	var spot: Node = load("res://games/saga_forest/world/fishing_spot.gd").new()
	stage.add_child(spot)
	spot.set("_player", p)
	spot.call("_cast")
	if String(p.get("hold_anim")) != "fish_wait":
		_fail("③ 던져도 몸이 낚시 자세가 아님(%s)" % p.get("hold_anim"))
	spot.set("_state", 0)
	await process_frame
	await process_frame
	if String(p.get("hold_anim")) != "":
		_fail("③ 줄을 거둬도 낚시 자세(%s)" % p.get("hold_anim"))
	## ④ 4종횡 줄
	var sp := _player(stage, "res://games/saga_story/player/StoryPlayer.tscn")
	for _i in 3:
		await physics_frame
	var sap := sp.get("_anim") as AnimationPlayer
	var area := Area3D.new()
	area.set_meta("rope_x", 0.0)
	area.set_meta("rope_top", 50.0)
	area.set_meta("rope_bottom", -50.0)
	stage.add_child(area)
	sp.call("set_rope_area", area)
	sp.set("_on_rope", true)
	Input.action_press("move_forward")
	for _i in 4:
		await physics_frame
	var up := sap.current_animation
	Input.action_release("move_forward")
	for _i in 4:
		await physics_frame
	var still := sap.current_animation
	print("M30 rope move=%s still=%s" % [up, still])
	if up != "ladder" or still != "hang":
		_fail("④ 줄 오르기 %s · 매달림 %s" % [up, still])
	## ⑤
	for f: String in WIRES:
		var src := FileAccess.get_file_as_string(f)
		for w: String in WIRES[f]:
			if not src.contains(w):
				_fail("⑤ %s 에 %s 없음" % [f.get_file(), w])
	## ⑥
	OS.set_environment("SAGA_MOCAP30", "0")
	var q := _player(stage, "res://games/saga_forest/player/ForestPlayer.tscn")
	for _i in 3:
		await physics_frame
	var qap := q.get("_anim") as AnimationPlayer
	if qap.has_animation("gather") or bool(q.call("hold", "fish_cast", "fish_wait")):
		_fail("⑥ 손잡이 0 인데 클립")
	q.set("mounted", true)
	for _i in 3:
		await physics_frame
	if qap.current_animation != "idle":
		_fail("⑥ 손잡이 0 탈것 위 %s" % qap.current_animation)
	OS.set_environment("SAGA_MOCAP30", "")
	_finish()


func _finish() -> void:
	print("PROBE mocap30 %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
