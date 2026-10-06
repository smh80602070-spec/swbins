extends Node
## GO 이야기 8부 무대(PLAN 106장 52-1, world/storm_eye.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_STORMEYE_PROBE 가 있을 때만 단다.
##
##   SAGA_STORMEYE_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## [1] 27장 전 — 매듭·먹구름 눈·바람 기둥 모두 안 보임(눈은 충돌도 없음)
## [2] 27장 처음 — 매듭 여섯 보임·모두 먹구름 연기·줄 없음 · 자리(제단 칸에서 KNOT_OFF, 땅/구름섬 윗면) · 도감 place 112
## [3] 27장 4단계 — 첫째 매듭만 불·줄이 곧게 위로(BEAM_UP)
## [4] 28장 8단계 — 여섯 다 묶임 · 줄 여섯이 매듭 등불 한 점으로 · 눈은 아직 안 보임
## [5] 28장 9단계 — 눈 보임(충돌)·소용돌이 · 바람 기둥은 아직 · 눈이 구름섬·봉우리 기둥과 안 겹침 · eye 칸 = 눈 윗면
## [6] 29장 — 바람 기둥을 실제로 타고 올라 활공해 눈 윗면에 내려섬 · 도감 먹구름 눈
## [7] 29장 뒤 — 소용돌이 걷힘·"맑은 하늘 뜰"·줄 거둠·불은 남음·바람 기둥 남음.
## 이야기 상태·자리는 끝에 되돌린다. 저장은 안 한다.

const StormEye := preload("res://games/saga_go/world/storm_eye.gd")
const SkyIsle := preload("res://games/saga_go/world/sky_isle.gd")
const StoryQuest := preload("res://games/saga_go/world/story_quest.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")

var _p: CharacterBody3D
var _se: Node
var _frame := 0
var _step := 0
var _fails := 0
var _v: Variant = null
var _saved := {}

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player") as CharacterBody3D

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _se == null:
		_se = get_tree().get_first_node_in_group("go_storm_eye")
		_frame = 0
		return
	match _step:
		0:
			_saved = {"story": PartyState.story.duplicate(true), "pos": _p.global_position}
			_set_story(25, 0)
			_next()
		1: # [1] 27장 전
			if _frame < 40:
				return
			var any_knot := range(6).any(func(k: int) -> bool: return bool(_se.call("knot_lit", k)) or bool(_se.call("knot_smoking", k)) or bool(_se.call("beam_visible", k)))
			var ok: bool = not any_knot and not bool(_se.call("is_shown")) and not bool(_se.call("draft_active"))
			_check("before_ch27", ok, "knot=%s eye=%s draft=%s" % [any_knot, _se.call("is_shown"), _se.call("draft_active")])
			_set_story(StormEye.CH27, 0)
			_next()
		2: # [2] 27장 처음 — 연기·자리
			if _frame < 40:
				return
			var bad: Array = []
			for k in 6:
				if not bool(_se.call("knot_smoking", k)) or bool(_se.call("knot_lit", k)) or bool(_se.call("beam_visible", k)):
					bad.append("state %d" % k)
				var r: Array = StormEye.KNOTS[k]
				var kp := StormEye.knot_pos(k)
				var cell := TestMap.world_pos(r[1].x, r[1].y, String(r[0]))
				var want_y := SkyIsle.top_y() if bool(r[2]) else TerrainBuilder.height_at(String(r[0]), kp)
				if absf(_flat(kp, cell) - StormEye.KNOT_OFF.length()) > 0.01 or absf(kp.y - want_y) > 0.01 or TestMap.region_at(kp) != String(r[0]) and not bool(r[2]):
					bad.append("pos %d %s" % [k, kp])
			if not SkyIsle.on_isle(StormEye.knot_pos(5)):
				bad.append("knot5 off isle")
			if int(CodexState.TOTAL.place) < 112:
				bad.append("codex total %d" % CodexState.TOTAL.place)
			_check("ch27_knots", bad.is_empty(), str(bad))
			## G-0041 — 매듭 연기는 연기 입자(공 도형 없음)
			var puff_bad := []
			for kn in _se.get("_knots"):
				if not _particles_only(kn.smoke):
					puff_bad.append((kn.root as Node).name)
			_check("knot_smoke_particles", puff_bad.is_empty(), str(puff_bad))
			_set_story(StormEye.CH27, 4)
			_next()
		3: # [3] 첫째 매듭만 묶임 — 줄 곧게 위로
			if _frame < 40:
				return
			var lit := range(6).filter(func(k: int) -> bool: return bool(_se.call("knot_lit", k)))
			var end: Vector3 = _se.call("beam_end", 0)
			var base := StormEye.knot_pos(0)
			var up_ok := _flat(end, base) < 0.1 and end.y - base.y > StormEye.BEAM_UP
			var ok: bool = lit == [0] and bool(_se.call("beam_visible", 0)) and not bool(_se.call("beam_visible", 1)) and bool(_se.call("knot_smoking", 1)) and up_ok
			_check("knot0_tied", ok, "lit=%s end=%s base=%s" % [lit, end, base])
			_set_story(StormEye.CH28, 8)
			_next()
		4: # [4] 여섯 다 묶임 — 줄이 매듭 등불로
			if _frame < 40:
				return
			var lp := StormEye.lantern_pos()
			var bad: Array = []
			for k in 6:
				if not bool(_se.call("knot_lit", k)) or bool(_se.call("knot_smoking", k)) or not bool(_se.call("beam_visible", k)) or StormEye.beam_mode(k) != "eye":
					bad.append("state %d" % k)
				elif (_se.call("beam_end", k) as Vector3).distance_to(lp) > 0.1:
					bad.append("end %d %s" % [k, _se.call("beam_end", k)])
			if bool(_se.call("is_shown")):
				bad.append("eye shown at 8")
			_check("all_tied", bad.is_empty(), str(bad))
			_set_story(StormEye.CH28, StormEye.EYE_FROM_STEP)
			_next()
		5: # [5] 눈 보임 — 기둥은 아직 · 겹침 없음 · eye 칸
			if _frame < 40:
				return
			var bad: Array = []
			if not _particles_only(_se.get("_vortex")):   # G-0041 — 소용돌이도 연기 입자(번개 줄 넷만 메시)
				bad.append("vortex spheres")
			if not bool(_se.call("is_shown")) or not bool(_se.call("vortex_visible")) or bool(_se.call("draft_active")):
				bad.append("eye=%s vortex=%s draft=%s" % [_se.call("is_shown"), _se.call("vortex_visible"), _se.call("draft_active")])
			var ec := StormEye.center()
			var ic := SkyIsle.center()
			var db := StormEye.draft_base()
			if _flat(ec, ic) < StormEye.EYE_R + SkyIsle.RADIUS + 2.0:
				bad.append("eye-isle %.1f" % _flat(ec, ic))
			if _flat(ec, db) < StormEye.EYE_R + StormEye.DRAFT_R + 1.5 or not SkyIsle.on_isle(db):
				bad.append("draft-eye %.1f on_isle=%s" % [_flat(ec, db), SkyIsle.on_isle(db)])
			## 봉우리 → 구름섬 기둥(9장)과 눈이 안 겹친다(기둥 꼭대기 = 구름섬 윗면 + 9)
			if _flat(ec, SkyIsle.draft_base()) < StormEye.EYE_R + SkyIsle.DRAFT_R + 1.0:
				bad.append("peak draft %.1f" % _flat(ec, SkyIsle.draft_base()))
			var cell := Vector2(7.1 - StormEye.EYE_WEST / TestMap.tile_size_of("village"), 1.0)
			var sp := StoryQuest._spot_pos({"region": "village", "cell": cell, "eye": true})
			if absf(sp.y - StormEye.top_y()) > 0.01 or _flat(sp, ec) > 0.5 or not StoryQuest._floating({"eye": true}):
				bad.append("spot %s" % sp)
			_check("eye_shown", bad.is_empty(), str(bad))
			_set_story(StormEye.CH29, 0)
			_next()
		6: # [6] 구름섬 서쪽 바람 기둥을 실제로 타고 올라 활공해 눈에 내려선다
			var b := StormEye.draft_base()
			if _frame == 40:
				_v = {"draft": bool(_se.call("draft_active")), "go_at": 0, "landed": false}
				Input.action_release("move_forward")
				_put(b + Vector3(0.0, 3.0, 0.0))
				_p.call("_set_mode", _p.Mode.AIR)
			if _frame > 40:
				_p.set("stamina", float(_p.get("stamina_max")))
				var c0 := StormEye.center()
				var dir := Vector3(c0.x - _p.global_position.x, 0.0, c0.z - _p.global_position.z).normalized()
				var rig := get_tree().get_first_node_in_group("camera_rig") as Node3D
				if rig:
					rig.global_rotation = Vector3(rig.global_rotation.x, atan2(-dir.x, -dir.z), 0.0)
				if int(_v.go_at) == 0 and _p.global_position.y >= StormEye.top_y() + StormEye.DRAFT_OVER - 1.5:
					_v.go_at = _frame
					Input.action_press("move_forward")
				if StormEye.on_eye(_p.global_position) and _p.is_on_floor():
					_v.landed = true
			if _frame > 40 and (bool(_v.landed) or _frame > 1500):
				Input.action_release("move_forward")
				_frame = 0
				_step = 60
		60:
			if _frame < 30: # 도감 발견은 몸이 들어설 때
				return
			var ok: bool = bool(_v.draft) and bool(_v.landed) and CodexState.has("place", StormEye.PLACE_ID)
			_check("ride_to_eye", ok, "draft=%s go_at=%d landed=%s codex=%s pos=%s" % [_v.draft, _v.go_at, _v.landed, CodexState.has("place", StormEye.PLACE_ID), _p.global_position])
			_step = 6
			_next()
		7: # [7] 29장 뒤 — 맑은 하늘 뜰
			if _frame == 1:
				_set_story(StormEye.CH29 + 1, 0)
			if _frame < 40:
				return
			var texts: Array = _se.find_children("*", "Label3D", true, false).map(func(l: Label3D) -> String: return l.text)
			var beams := range(6).any(func(k: int) -> bool: return bool(_se.call("beam_visible", k)))
			var lit := range(6).all(func(k: int) -> bool: return bool(_se.call("knot_lit", k)))
			var ok: bool = texts.has("맑은 하늘 뜰") and not texts.has("먹구름 눈") and not bool(_se.call("vortex_visible")) and not beams and lit \
				and bool(_se.call("draft_active")) and bool(_se.call("is_shown"))
			_check("eye_clear", ok, "texts=%s vortex=%s beams=%s lit=%s draft=%s" % [texts, _se.call("vortex_visible"), beams, lit, _se.call("draft_active")])
			_next()
		8:
			PartyState.story = _saved.story
			_p.global_position = _saved.pos
			print("STORMEYE_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

func _set_story(ch: int, st: int) -> void:
	PartyState.story = {"ch": ch, "step": st}

func _put(p: Vector3) -> void:
	_p.global_position = p
	_p.velocity = Vector3.ZERO

func _flat(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()

func _next() -> void:
	_step += 1
	_frame = 0

func _check(name: String, ok: bool, detail: String) -> void:
	if ok:
		print("STORMEYE_PROBE ok   %s" % name)
	else:
		_fails += 1
		print("STORMEYE_PROBE FAIL %s — %s" % [name, detail])

## G-0041 — 연기 노드 안에 입자가 있고 공(SphereMesh) 메시는 없다.
func _particles_only(n: Node) -> bool:
	if n == null or n.find_children("*", "CPUParticles3D", true, false).is_empty():
		return false
	for m in n.find_children("*", "MeshInstance3D", true, false):
		if (m as MeshInstance3D).mesh is SphereMesh:
			return false
	return true
