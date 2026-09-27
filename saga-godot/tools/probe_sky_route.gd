extends Node
## GO 이야기 7부 무대 "구름 위 항로"(PLAN 106장 51-1, world/sky_route.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_SKYROUTE_PROBE 가 있을 때만 단다.
##
##   SAGA_SKYROUTE_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 표(섬 셋 — 서쪽일수록 높음·잠긴 도읍 하늘·섬 사이 틈 6~10m·빛 돔·등대와 안 겹침·섬 밑 뿔이 땅에서 10m 넘게 떠 있음)
## ② 23장 등롱 전엔 안 보이고 안 밟힘 ③ 등롱 뒤 보임 — 섬 윗면(광선) 셋 · isle 칸 자리 = 섬 윗면(story_quest _spot_pos)
## ④ 바람 기둥 — 24장 전 모두 닫힘 · 24장 뒤 등대·사당 · 25장 뒤 잔해까지 · 등대 기둥 밑동이 바위섬 땅 위 · 기둥 끝 = 다음 섬 + 9
## ⑤~⑦ 기둥마다 실제로 타고 올라 다음 섬 쪽으로 활공해 그 섬 윗면에 내려선다(등대 → 사당 → 잔해 → 정거장)
## ⑧ 도감 — 섬 윗면에 서면 place. 이야기·도감·위치는 끝에 되돌린다. 저장은 안 한다.

const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Sunken := preload("res://games/saga_go/world/region7_sunken.gd")
const SkyRoute := preload("res://games/saga_go/world/sky_route.gd")
const StoryQuest := preload("res://games/saga_go/world/story_quest.gd")

const R := "sunken"
const IDS := ["shrine", "wreck", "orbit"]

var _p: CharacterBody3D
var _sr: Node
var _frame := 0
var _step := 0
var _fails := 0
var _saved := {}
var _v: Variant = null

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player") as CharacterBody3D

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _sr == null:
		_sr = get_tree().get_first_node_in_group("go_sky_route")
		_frame = 0
		return
	if _frame < 5 and _step == 0:
		return
	match _step:
		0: # ① 표
			_saved = {"story": PartyState.story.duplicate(true), "book": CodexState.book.duplicate(), "pos": _p.global_position}
			var bad: Array = []
			for i in IDS.size():
				var c := SkyRoute.center(IDS[i])
				if TestMap.region_at(c) != R:
					bad.append("region %s" % IDS[i])
				var under := TerrainBuilder.height_at(R, c)
				if c.y - 1.4 - 14.0 < maxf(under, TerrainBuilder.WATER_LEVEL) + 10.0:
					bad.append("low %s under=%.1f" % [IDS[i], under])
				if _flat(c, Sunken.dome_center()) < Sunken.RING_OUT + SkyRoute.radius(IDS[i]) or _flat(c, Sunken.cell_pos(Sunken.LIGHT_CELL)) < SkyRoute.radius(IDS[i]) + 5.0:
					bad.append("overlap %s" % IDS[i])
				if i > 0:
					var p := SkyRoute.center(IDS[i - 1])
					var gap := _flat(c, p) - SkyRoute.radius(IDS[i]) - SkyRoute.radius(IDS[i - 1])
					if c.x >= p.x or c.y <= p.y or gap < 6.0 or gap > 10.0:
						bad.append("order/gap %s gap=%.1f" % [IDS[i], gap])
			_check("tables", bad.is_empty(), str(bad))
			PartyState.story = {"ch": 22, "step": 0}
			_next()
		1: # ② 23장 등롱 전 — 안 보이고 안 밟힘
			if _frame < 40:
				return
			var hits := IDS.filter(func(id: String) -> bool: return _ray_down(SkyRoute.center(id) + Vector3(5.0, 0.0, 0.0)) != null and absf(float(_ray_down(SkyRoute.center(id) + Vector3(5.0, 0.0, 0.0))) - SkyRoute.top_y(id)) < 0.5)
			var drafts := range(3).filter(func(i: int) -> bool: return bool(_sr.call("draft_active", i)))
			_check("hidden", not bool(_sr.call("is_shown")) and hits.is_empty() and drafts.is_empty(), "shown=%s hits=%s drafts=%s" % [_sr.call("is_shown"), hits, drafts])
			PartyState.story = {"ch": 22, "step": 3}
			_next()
		2: # ③ 등롱 뒤 — 섬 윗면 셋·isle 칸 자리, 기둥은 아직(24장 전)
			if _frame < 40:
				return
			var bad: Array = []
			for id in IDS:
				var y: Variant = _ray_down(SkyRoute.center(id) + Vector3(5.0, 0.0, 0.0))
				if y == null or absf(float(y) - SkyRoute.top_y(id)) > 0.1:
					bad.append("%s top=%s" % [id, y])
				var c := SkyRoute.center(id)
				var cell := Vector2(0.0, 0.0)
				for row in SkyRoute.ISLES:
					if row[0] == id:
						cell = row[1]
				var sp := StoryQuest._spot_pos({"region": R, "cell": cell, "isle": id})
				if sp.distance_to(c) > 0.05 or not StoryQuest._floating({"region": R, "cell": cell, "isle": id}):
					bad.append("spot %s %s" % [id, sp])
			var drafts := range(3).filter(func(i: int) -> bool: return bool(_sr.call("draft_active", i)))
			_check("shown", bool(_sr.call("is_shown")) and bad.is_empty() and drafts.is_empty(), "%s drafts=%s" % [bad, drafts])
			PartyState.story = {"ch": 24, "step": 0}
			_next()
		3: # ④ 바람 기둥 — 24장 뒤 둘, 25장 뒤 셋 · 자리
			if _frame == 40:
				_v = range(3).filter(func(i: int) -> bool: return bool(_sr.call("draft_active", i)))
				PartyState.story = {"ch": 25, "step": 0}
			if _frame < 80:
				return
			var all := range(3).filter(func(i: int) -> bool: return bool(_sr.call("draft_active", i)))
			var bad: Array = []
			var ds: Array = SkyRoute.drafts()
			var lb: Vector3 = ds[0][1]
			if TestMap.tile_at(7, 7, R) != "K" or lb.y < TerrainBuilder.WATER_LEVEL + 1.5 or _flat(lb, Sunken.cell_pos(Sunken.LIGHT_CELL)) < Sunken.LIGHT_R + SkyRoute.DRAFT_R + 0.3:
				bad.append("light draft base %s" % lb)
			for i in ds.size():
				var to := String(ds[i][2])
				var b: Vector3 = ds[i][1]
				var rim := _flat(b, SkyRoute.center(to)) - SkyRoute.radius(to)
				if rim < 3.0 or rim > 13.0:
					bad.append("draft %d rim gap %.1f" % [i, rim])
				if i > 0 and (absf(b.y - SkyRoute.top_y(String(ds[i][0]))) > 0.01 or _flat(b, SkyRoute.center(String(ds[i][0]))) > SkyRoute.radius(String(ds[i][0])) - 2.0):
					bad.append("draft %d base %s" % [i, b])
			_check("drafts", _v == [0, 1] and all == [0, 1, 2] and bad.is_empty(), "after24=%s after25=%s %s" % [_v, all, bad])
			_next()
		4: # ⑤ 등대 섬 → 사당
			_ride(0, "ride_light_shrine")
		5: # ⑥ 사당 → 잔해
			_ride(1, "ride_shrine_wreck")
		6: # ⑦ 잔해 → 정거장
			_ride(2, "ride_wreck_orbit")
		7: # ⑧ 도감 — 섬 윗면에 서면
			if _frame == 1:
				_put(SkyRoute.at("shrine", 90.0, 4.0))
			if _frame == 20:
				_put(SkyRoute.at("orbit", 60.0, 4.0))
			if _frame == 40:
				var ok := CodexState.has("place", "sky_shrine") and CodexState.has("place", "sky_wreck") and CodexState.has("place", "sky_orbit") and int(CodexState.TOTAL.place) >= 111
				_check("discovery", ok, "shrine=%s wreck=%s orbit=%s total=%d" % [CodexState.has("place", "sky_shrine"), CodexState.has("place", "sky_wreck"), CodexState.has("place", "sky_orbit"), CodexState.TOTAL.place])
				_next()
		8:
			PartyState.story = _saved.story
			CodexState.book = _saved.book
			_p.global_position = _saved.pos
			print("SKYROUTE_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

## 기둥 i 를 타고 올라(공중에서 저절로 활공) 꼭대기 근처에서 다음 섬 쪽으로 앞 — 그 섬 윗면에 내려서면 성공.
func _ride(i: int, name: String) -> void:
	var d: Array = SkyRoute.drafts()[i]
	var to := String(d[2])
	var b: Vector3 = d[1]
	if _frame == 1:
		Input.action_release("move_forward")
		_put(b + Vector3(0.0, 3.0, 0.0))
		_p.call("_set_mode", _p.Mode.AIR)
		_v = {"peak": -1e9, "glide": false, "go_at": 0, "landed": false}
	if _frame > 1:
		_p.set("stamina", float(_p.get("stamina_max")))
		_v.glide = bool(_v.glide) or int(_p.get("mode")) == _p.Mode.GLIDE
		_v.peak = maxf(float(_v.peak), _p.global_position.y)
		var rig := get_tree().get_first_node_in_group("camera_rig") as Node3D
		## 겨누는 자리 — 섬 가운데가 아니라 기둥 쪽 절반(정거장 가운데엔 9m 안테나가 서 있다).
		var c0 := SkyRoute.center(to)
		var c := c0 + Vector3(b.x - c0.x, 0.0, b.z - c0.z).normalized() * SkyRoute.radius(to) * 0.5
		var dir := Vector3(c.x - _p.global_position.x, 0.0, c.z - _p.global_position.z).normalized()
		if rig:
			rig.global_rotation = Vector3(rig.global_rotation.x, atan2(-dir.x, -dir.z), 0.0)
		if int(_v.go_at) == 0 and _p.global_position.y >= SkyRoute.top_y(to) + SkyRoute.DRAFT_OVER - 1.5:
			_v.go_at = _frame
			Input.action_press("move_forward")
		if int(_v.go_at) > 0 and SkyRoute.on_isle(to, _p.global_position) and _p.is_on_floor():
			_v.landed = true
	if bool(_v.landed) or _frame > 1500 or (int(_v.go_at) > 0 and _p.global_position.y < SkyRoute.top_y(to) - 6.0):
		Input.action_release("move_forward")
		_check(name, bool(_v.landed) and bool(_v.glide), "landed=%s glide=%s peak=%.1f top=%.1f go_at=%d frames=%d pos=%s" % [_v.landed, _v.glide, _v.peak, SkyRoute.top_y(to), _v.go_at, _frame, _p.global_position])
		_next()

func _ray_down(p: Vector3) -> Variant:
	var q := PhysicsRayQueryParameters3D.create(Vector3(p.x, p.y + 30.0, p.z), Vector3(p.x, p.y - 30.0, p.z), 1)
	q.exclude = [_p.get_rid()]
	var hit := _p.get_world_3d().direct_space_state.intersect_ray(q)
	return (hit.position as Vector3).y if not hit.is_empty() else null

func _flat(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()

func _put(pos: Vector3) -> void:
	_p.global_position = pos + Vector3(0.0, 0.3, 0.0)
	_p.velocity = Vector3.ZERO

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("SKYROUTE_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
