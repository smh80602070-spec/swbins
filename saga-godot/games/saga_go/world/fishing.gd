extends Node3D

## PLAN 106장 ㊷ — 원신식 낚시(표·수치는 data/fishing.gd). test_village.gd 가 붙인다.
##   낚시터 둘레 STAND_RADIUS 안에서 F(터치 "낚시") → 낚시 자세(움직이지 않음, 낚싯대·물 위 과녁 고리)
##   · 이동 키·조이스틱 = 던질 자리 옮기기(서는 자리에서 CAST_MIN~CAST_MAX, 물 위만) · 1~3 미끼 고르기
##   · F·마우스 왼쪽(터치 "던지기") = 던지기 → 입질 때 당기기 → 줄다리기 동안 누르고 있기/떼기 · Esc·마우스 오른쪽("그만") = 끝.
##   싸우는 중(30m 안 적)엔 못 들어가고, 낚는 중 맞으면 끝난다.
## 포구 선착장 곁 "낚시 조합" 게시판(F) — 물고기를 작살·냥·견문록·강화석·인연 매듭으로 바꾼다.
## 물고기 그림자는 물속에서 돌고, 잡은 자리는 PartyState.fishing.gone 에 시각을 적어 RESPAWN_SEC 뒤 다시 선다.

signal caught(fish_id: String)
signal state_changed(state: String)

const Fishing := preload("res://games/saga_go/data/fishing.gd")
const Cooking := preload("res://games/saga_go/data/cooking.gd")
const Growth := preload("res://games/saga_go/data/growth.gd")
const Weapons := preload("res://games/saga_go/data/weapons.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const CreatureBuilder := preload("res://saga_core/world/creature_builder.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

enum S { IDLE, AIM, WAIT, NIBBLE, BITE, REEL }
const STATE_NAMES := ["idle", "aim", "wait", "nibble", "bite", "reel"]

const SWIM_R := 5.5          # 물고기가 도는 둘레(던지는 물 가운데에서)
const FISH_DEPTH := 0.35     # 수면 아래
const RETICLE_SPEED := 6.0
const ARRIVE_M := 0.45
const BOARD_RADIUS := 3.0
const RIPPLE_COLOR := Color(1, 1, 1, 0.75)

var state := S.IDLE
var spot_id := ""
var bait := "honey_flower"
var reticle := Vector3.ZERO
var float_pos := Vector3.ZERO
var hooked := -1           # 지금 미끼로 오는(물린) 물고기 번호(그 낚시터 안)
var zone_c := 0.5
var zone_w := 0.2
var cursor := 0.5
var progress := 0.0
var holding := false
var catches := 0
var last_result := ""      # 점검용: "caught:<id>" · "escaped" · "scared" · "no_fish"
var board_open := false

var _player: CharacterBody3D = null
var _fc: Node = null
var _rng := RandomNumberGenerator.new()
var _fish: Dictionary = {}  # spot → [{node, id, idx, pos, target, scared}]
var _t := 0.0              # 지금 상태에 든 뒤 초
var _nibbles_left := 0
var _cursor_v := 0.0
var _zone_target := 0.5
var _zone_t := 0.0
var _hp_start := 0.0
var _frozen_before := false
var _reticle_node: MeshInstance3D = null
var _float_node: Node3D = null
var _line: MeshInstance3D = null
var _rod: Node3D = null
var _hud: Control = null
var _status: Label = null
var _prompt_btn: Button = null
var _reel: ReelBar = null
var _touch: Dictionary = {}
var _board_panel: PanelContainer = null
var _board_list: VBoxContainer = null
var _board_label: Label = null


func _ready() -> void:
	add_to_group("go_fishing")
	_rng.seed = 20260824
	_ensure_actions()
	for id in Fishing.SPOT_ORDER:
		_build_spot(id)
	_build_board()
	_build_hud()


func _ensure_actions() -> void:
	if not InputMap.has_action("go_fish"):
		InputMap.add_action("go_fish")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_F
		InputMap.action_add_event("go_fish", ev)

# ---------------------------------------------------------------- 자리

static func stand_pos(id: String) -> Vector3:
	var sp := Fishing.spot(id)
	var p := TestMap.world_pos(sp.stand.x, sp.stand.y, sp.region)
	p.y = TerrainBuilder.height_at(sp.region, p)
	return p

static func cast_center(id: String) -> Vector3:
	var sp := Fishing.spot(id)
	var p := TestMap.world_pos(sp.cast.x, sp.cast.y, sp.region)
	p.y = TerrainBuilder.WATER_LEVEL
	return p

static func board_pos() -> Vector3:
	var p := TestMap.world_pos(Fishing.BOARD_CELL.x, Fishing.BOARD_CELL.y, "coast")
	p.y = TerrainBuilder.height_at("coast", p)
	return p

static func is_water(region: String, p: Vector3) -> bool:
	return TerrainBuilder.height_at(region, p) < TerrainBuilder.WATER_LEVEL - 0.3

func _gone_key(id: String, idx: int) -> String:
	return "%s:%d" % [id, idx]

## 그 자리 물고기가 지금 있는가(잡은 뒤 RESPAWN_SEC 이 지났으면 다시).
func fish_present(id: String, idx: int) -> bool:
	var gone: Dictionary = PartyState.fishing.get("gone", {})
	var k := _gone_key(id, idx)
	return not gone.has(k) or Cooking.now() - float(gone[k]) >= Fishing.RESPAWN_SEC

func fish_left(id: String) -> int:
	var n := 0
	for f in _fish.get(id, []):
		if (f.node as Node3D).visible:
			n += 1
	return n

## 서 있는 낚시터 id(없으면 "").
func near_spot() -> String:
	if _player == null:
		return ""
	for id in Fishing.SPOT_ORDER:
		var p := stand_pos(id)
		if Vector2(p.x - _player.global_position.x, p.z - _player.global_position.z).length() <= Fishing.STAND_RADIUS \
			and absf(p.y - _player.global_position.y) < 2.5:
			return id
	return ""

func near_board() -> bool:
	if _player == null:
		return false
	var b := board_pos()
	return Vector2(b.x - _player.global_position.x, b.z - _player.global_position.z).length() <= BOARD_RADIUS

# ---------------------------------------------------------------- 들고 나기

func state_name() -> String:
	return STATE_NAMES[state]

func _set_state(s: int) -> void:
	state = s
	_t = 0.0
	state_changed.emit(state_name())
	_refresh_hud()

## 낚시 자세로 — 낚시터 둘레 안·땅·싸우지 않을 때만.
func begin(id: String = "") -> bool:
	if state != S.IDLE or board_open:
		return false
	if id == "":
		id = near_spot()
	if id == "" or _player == null or _player.get("frozen"):
		return false
	if not bool(_player.call("can_aim")):
		return false
	if _fc and _fc.call("in_combat"):
		Toast.show(self, "싸우는 중엔 낚시를 할 수 없다", 2.0)
		return false
	for g in ["go_world_map", "go_character_screen", "go_cooking_screen"]:
		var other := get_tree().get_first_node_in_group(g)
		if other and other.get("is_open"):
			return false
	spot_id = id
	if PartyState.count(bait) <= 0:
		for b in Fishing.BAIT_ORDER:
			if PartyState.count(b) > 0:
				bait = b
				break
	_frozen_before = bool(_player.get("frozen"))
	_player.set("frozen", true)
	_player.set("velocity", Vector3.ZERO)
	_hp_start = float(_fc.get("hp")) if _fc else 0.0
	var c := cast_center(id)
	reticle = _clamp_reticle(c)
	_player.call("face_toward", c)
	_attach_rod(true)
	_reticle_node.visible = true
	_set_state(S.AIM)
	if fish_left(id) == 0:
		Toast.show(self, "이 낚시터엔 지금 물고기가 없다 — 30분쯤 뒤에 다시", 2.5)
	return true

func end() -> void:
	if state == S.IDLE:
		return
	_release_hooked(false)
	holding = false
	_float_node.visible = false
	_line.visible = false
	_reticle_node.visible = false
	_attach_rod(false)
	if _player:
		_player.set("frozen", _frozen_before)
	spot_id = ""
	_set_state(S.IDLE)

## 입력 한 입구(키·마우스·터치). act: "fish"(F·왼쪽·던지기 단추) · "stop" · "bait_1~3" · "bait_next".
func press(act: String, pressed: bool) -> void:
	if act == "fish":
		holding = pressed
		if not pressed:
			return
		match state:
			S.IDLE:
				if near_board():
					open_board()
				else:
					begin()
			S.AIM:
				cast()
			S.WAIT:
				_reel_in("")
			S.NIBBLE:
				_scare()
			S.BITE:
				_start_reel()
	elif act == "stop" and pressed:
		end()
	elif act.begins_with("bait") and pressed and (state == S.AIM or state == S.WAIT):
		if act == "bait_next":
			var i := Fishing.BAIT_ORDER.find(bait)
			set_bait(Fishing.BAIT_ORDER[(i + 1) % Fishing.BAIT_ORDER.size()])
		else:
			set_bait(Fishing.BAIT_ORDER[clampi(int(act.substr(5)) - 1, 0, 2)])

func set_bait(b: String) -> void:
	if not Fishing.BAITS.has(b):
		return
	bait = b
	if state == S.WAIT:
		_reel_in("")
	_refresh_hud()

func _unhandled_input(event: InputEvent) -> void:
	if board_open:
		if event is InputEventKey and (event as InputEventKey).pressed and ((event as InputEventKey).keycode == KEY_ESCAPE or event.is_action_pressed("go_fish")):
			close_board()
			get_viewport().set_input_as_handled()
		return
	if state == S.IDLE:
		if event.is_action_pressed("go_fish") and (near_spot() != "" or near_board()):
			press("fish", true)
			get_viewport().set_input_as_handled()
		return
	var handled := true
	if event.is_action_pressed("go_fish") or event.is_action_pressed("combat_quick"):
		press("fish", true)
	elif event.is_action_released("go_fish") or event.is_action_released("combat_quick"):
		press("fish", false)
	elif event.is_action_pressed("combat_dodge") or (event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE):
		press("stop", true)
	elif event.is_action_pressed("party_1"):
		press("bait_1", true)
	elif event.is_action_pressed("party_2"):
		press("bait_2", true)
	elif event.is_action_pressed("party_3"):
		press("bait_3", true)
	else:
		handled = false
	if handled:
		get_viewport().set_input_as_handled()

# ---------------------------------------------------------------- 던지기·입질

## 던질 자리를 서는 자리에서 CAST_MIN~CAST_MAX 고리 안으로.
func _clamp_reticle(p: Vector3) -> Vector3:
	var s := stand_pos(spot_id)
	var d := Vector2(p.x - s.x, p.z - s.z)
	var l := clampf(d.length(), Fishing.CAST_MIN, Fishing.CAST_MAX)
	d = d.normalized() * l if d.length() > 0.01 else Vector2(0, l)
	return Vector3(s.x + d.x, TerrainBuilder.WATER_LEVEL, s.z + d.y)

func can_cast() -> bool:
	return state == S.AIM and is_water(String(Fishing.spot(spot_id).region), reticle) and PartyState.count(bait) > 0

func cast() -> bool:
	if state != S.AIM:
		return false
	if PartyState.count(bait) <= 0:
		Toast.show(self, "%s 이(가) 없다 — %s 을(를) 모아 오자" % [Fishing.BAITS[bait].name, Growth.ITEMS[bait].name], 2.0)
		return false
	if not is_water(String(Fishing.spot(spot_id).region), reticle):
		Toast.show(self, "물 위에 던져야 한다", 1.5)
		return false
	PartyState.add_items({bait: -1})
	float_pos = reticle
	_float_node.global_position = float_pos
	_float_node.visible = true
	_line.visible = true
	_ripple(float_pos, 0.6)
	CombatFeel.ui()
	_set_state(S.WAIT)
	return true

## 찌를 거둔다(물고기 없음·다시 던지기) — reason 이 있으면 알림.
func _reel_in(reason: String) -> void:
	_release_hooked(false)
	_float_node.visible = false
	_line.visible = false
	if reason != "":
		Toast.show(self, reason, 2.0)
	_set_state(S.AIM)

func _release_hooked(scared: bool) -> void:
	if hooked < 0 or not _fish.has(spot_id):
		hooked = -1
		return
	var f: Dictionary = _fish[spot_id][hooked]
	if scared:
		f.scared = Fishing.SCARE_SEC
		var away: Vector3 = f.pos - float_pos
		away.y = 0.0
		f.target = cast_center(spot_id) + (away.normalized() if away.length() > 0.1 else Vector3.BACK) * SWIM_R * 0.9
	hooked = -1

func _scare() -> void:
	last_result = "scared"
	_release_hooked(true)
	_reel_in("너무 일찍 당겼다 — 물고기가 달아났다")

func _start_reel() -> void:
	var f: Dictionary = _fish[spot_id][hooked]
	var d := Fishing.fish(String(f.id))
	zone_w = float(d.zone)
	zone_c = 0.5
	_zone_target = 0.5
	_zone_t = 0.0
	cursor = 0.5
	_cursor_v = 0.0
	progress = Fishing.PROGRESS_START
	_set_state(S.REEL)

func _catch() -> void:
	var f: Dictionary = _fish[spot_id][hooked]
	var id := String(f.id)
	var d := Fishing.fish(id)
	PartyState.add_items({Fishing.item_id(id): 1})
	if not PartyState.fishing.has("log"):
		PartyState.fishing["log"] = {}
	var log: Dictionary = PartyState.fishing["log"]
	var first := not log.has(id)
	log[id] = int(log.get(id, 0)) + 1
	if not PartyState.fishing.has("gone"):
		PartyState.fishing["gone"] = {}
	PartyState.fishing["gone"][_gone_key(spot_id, int(f.idx))] = Cooking.now()
	(f.node as Node3D).visible = false
	hooked = -1
	catches += 1
	last_result = "caught:" + id
	PartyState.add_exp(Fishing.CATCH_EXP[int(d.rarity)])
	CombatFeel.pickup(_player if _player else self, "%s %s" % [d.name, Fishing.stars(id)])
	Toast.show(self, "잡았다! %s %s · %s%s" % [d.name, Fishing.stars(id), d.era, "  — 처음 잡은 물고기" if first else ""], 2.5)
	caught.emit(id)
	_float_node.visible = false
	_line.visible = false
	_set_state(S.AIM)

func _escape() -> void:
	last_result = "escaped"
	_release_hooked(true)
	_reel_in("놓쳤다…")

# ---------------------------------------------------------------- 틱

func _physics_process(delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		_fc = get_tree().get_first_node_in_group("go_field_combat")
		return
	_t += delta
	_tick_fish(delta)
	if state == S.IDLE:
		_prompt_btn.visible = not board_open and (near_spot() != "" or near_board()) and not _player.get("frozen")
		_prompt_btn.text = "낚시 조합 (F)" if near_board() else "낚시 (F)"
		return
	_prompt_btn.visible = false
	## 맞으면(체력이 줄면) 끝.
	if _fc and float(_fc.get("hp")) < _hp_start - 0.5:
		Toast.show(self, "공격받았다 — 낚시를 멈춘다", 2.0)
		end()
		return
	match state:
		S.AIM:
			var mv: Vector2 = _player.call("_movement_input")
			if mv.length() > 0.05:
				var dir: Vector3 = _player.call("_world_direction", mv)
				reticle = _clamp_reticle(reticle + dir * RETICLE_SPEED * delta)
				_player.call("face_toward", reticle)
		S.WAIT:
			if hooked < 0:
				_pick_approacher()
			if hooked < 0 and _t > Fishing.WAIT_MAX:
				last_result = "no_fish"
				_reel_in("물고기가 오지 않는다 — 다른 미끼나 자리로")
		S.NIBBLE:
			if _t >= _rng.randf_range(Fishing.NIBBLE_GAP[0], Fishing.NIBBLE_GAP[1]) or _t > Fishing.NIBBLE_GAP[1]:
				_t = 0.0
				_nibbles_left -= 1
				_bob(0.12)
				if _nibbles_left <= 0:
					_bob(0.35)
					_set_state(S.BITE)
					Toast.show(self, "입질! — 지금 당겨라", Fishing.BITE_WINDOW)
		S.BITE:
			if _t > Fishing.BITE_WINDOW:
				_escape()
		S.REEL:
			_tick_reel(delta)
	_update_visuals()
	_refresh_hud()

## 미끼 둘레 BITE_RADIUS 안에서 이 미끼를 좋아하는 가장 가까운 물고기가 다가온다.
func _pick_approacher() -> void:
	var best := -1
	var best_d := Fishing.BITE_RADIUS
	var list: Array = _fish.get(spot_id, [])
	for i in list.size():
		var f: Dictionary = list[i]
		if not (f.node as Node3D).visible or float(f.scared) > 0.0 or not Fishing.likes(String(f.id), bait):
			continue
		var d := Vector2(f.pos.x - float_pos.x, f.pos.z - float_pos.z).length()
		if d < best_d:
			best_d = d
			best = i
	hooked = best

func _tick_fish(delta: float) -> void:
	for id in _fish:
		for i in (_fish[id] as Array).size():
			var f: Dictionary = _fish[id][i]
			var n: Node3D = f.node
			if not n.visible:
				if fish_present(id, int(f.idx)):
					n.visible = true
				continue
			f.scared = maxf(float(f.scared) - delta, 0.0)
			var goal: Vector3 = f.target
			var speed := Fishing.SWIM_SPEED
			if id == spot_id and i == hooked and state >= S.WAIT:
				goal = float_pos
				speed = Fishing.APPROACH_SPEED
			var to := goal - (f.pos as Vector3)
			to.y = 0.0
			if to.length() < ARRIVE_M:
				if id == spot_id and i == hooked and state == S.WAIT:
					_nibbles_left = _rng.randi_range(Fishing.NIBBLE_MIN, Fishing.NIBBLE_MAX)
					_set_state(S.NIBBLE)
				elif not (id == spot_id and i == hooked):
					f.target = _wander_point(id)
			else:
				var step := minf(speed * delta, to.length())
				f.pos = (f.pos as Vector3) + to.normalized() * step
				n.rotation.y = atan2(to.x, to.z)
			if id == spot_id and i == hooked and state == S.REEL:
				## 줄다리기 동안 찌 둘레에서 몸부림.
				f.pos = float_pos + Vector3(sin(_t * 9.0) * 0.3, 0.0, cos(_t * 7.0) * 0.3)
			n.global_position = Vector3(f.pos.x, TerrainBuilder.WATER_LEVEL - FISH_DEPTH, f.pos.z)

func _wander_point(id: String) -> Vector3:
	var c := cast_center(id)
	var region := String(Fishing.spot(id).region)
	for _k in 8:
		var a := _rng.randf() * TAU
		var r := sqrt(_rng.randf()) * SWIM_R
		var p := c + Vector3(cos(a) * r, 0.0, sin(a) * r)
		if is_water(region, p):
			return p
	return c

## 줄다리기 한 틱 — 칸은 물고기 move 사이마다 새 가운데로 부드럽게, 찌는 누르면 오르고 떼면 내린다.
func _tick_reel(delta: float) -> void:
	var f: Dictionary = _fish[spot_id][hooked]
	var d := Fishing.fish(String(f.id))
	_zone_t -= delta
	if _zone_t <= 0.0:
		_zone_t = _rng.randf_range(float(d.move[0]), float(d.move[1]))
		_zone_target = _rng.randf_range(zone_w * 0.5, 1.0 - zone_w * 0.5)
	zone_c = move_toward(zone_c, _zone_target, delta * 0.45)
	_cursor_v = clampf(_cursor_v + (Fishing.PULL_ACCEL if holding else -Fishing.PULL_ACCEL) * delta, -Fishing.PULL_VMAX, Fishing.PULL_VMAX)
	cursor += _cursor_v * delta
	if cursor <= 0.0 or cursor >= 1.0:
		cursor = clampf(cursor, 0.0, 1.0)
		_cursor_v = 0.0
	if in_zone():
		progress += float(d.gain) * delta
	else:
		progress -= float(d.loss) * delta
	if progress >= 1.0:
		_catch()
	elif progress <= 0.0:
		_escape()

func in_zone() -> bool:
	return absf(cursor - zone_c) <= zone_w * 0.5

## 지금 물린 물고기 id(없으면 "").
func hooked_fish() -> String:
	if hooked < 0 or not _fish.has(spot_id):
		return ""
	return String(_fish[spot_id][hooked].id)

# ---------------------------------------------------------------- 모양

func _build_spot(id: String) -> void:
	var sp := Fishing.spot(id)
	var list: Array = []
	var fishes: Array = sp.fish
	for i in fishes.size():
		var fid: String = fishes[i]
		var d := Fishing.fish(fid)
		var n := MeshInstance3D.new()
		n.name = "Fish_%s_%d" % [id, i]
		var m := SphereMesh.new()
		m.radius = 0.5
		m.height = 1.0
		m.radial_segments = 10
		m.rings = 5
		n.mesh = m
		var len_m := float(d.len)
		n.scale = Vector3(len_m * 0.36, 0.12, len_m)
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		var col: Color = Color(0.05, 0.08, 0.12).lerp(d.color, 0.25 + 0.15 * float(d.rarity))
		mat.albedo_color = Color(col.r, col.g, col.b, 0.7)
		n.material_override = mat
		n.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(n)
		var start := _wander_point(id)
		n.global_position = start
		n.visible = fish_present(id, i)
		list.append({"node": n, "id": fid, "idx": i, "pos": start, "target": _wander_point(id), "scared": 0.0})
	_fish[id] = list
	## 서는 자리 표 — 말뚝 + 글자.
	var post := Node3D.new()
	post.name = "FishingSign_" + id
	add_child(post)
	var at := stand_pos(id)
	post.global_position = at + (at - cast_center(id)).normalized() * 1.2 * Vector3(1, 0, 1)
	var pole := CylinderMesh.new()
	pole.top_radius = 0.06
	pole.bottom_radius = 0.08
	pole.height = 1.3
	CreatureBuilder._add(post, pole, Vector3(0, 0.65, 0), Vector3.ZERO, Color(0.5, 0.36, 0.22), true)
	var label := Label3D.new()
	label.text = "낚시터"
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 40
	label.outline_size = 8
	label.pixel_size = 0.006
	label.modulate = Color(0.7, 0.9, 1.0)
	label.position = Vector3(0, 1.6, 0)
	post.add_child(label)

func _build_board() -> void:
	var b := Node3D.new()
	b.name = "FishingBoard"
	add_child(b)
	b.global_position = board_pos()
	var wood := Color(0.5, 0.36, 0.22)
	for x in [-0.55, 0.55]:
		var leg := CylinderMesh.new()
		leg.top_radius = 0.06
		leg.bottom_radius = 0.07
		leg.height = 1.6
		CreatureBuilder._add(b, leg, Vector3(x, 0.8, 0), Vector3.ZERO, wood, true)
	var board := BoxMesh.new()
	board.size = Vector3(1.4, 0.8, 0.08)
	CreatureBuilder._add(b, board, Vector3(0, 1.35, 0), Vector3.ZERO, Color(0.66, 0.5, 0.32), true)
	var label := Label3D.new()
	label.text = "낚시 조합"
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 44
	label.outline_size = 8
	label.pixel_size = 0.006
	label.modulate = Color(0.7, 0.9, 1.0)
	label.position = Vector3(0, 2.1, 0)
	b.add_child(label)

	_reticle_node = MeshInstance3D.new()
	var tor := TorusMesh.new()
	tor.inner_radius = 0.55
	tor.outer_radius = 0.7
	tor.rings = 24
	tor.ring_segments = 4
	_reticle_node.mesh = tor
	_reticle_node.material_override = _glow(Color(1, 1, 1, 0.8))
	_reticle_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_reticle_node.visible = false
	add_child(_reticle_node)
	_float_node = Node3D.new()
	_float_node.name = "Float"
	add_child(_float_node)
	var top := MeshInstance3D.new()
	var s1 := SphereMesh.new()
	s1.radius = 0.09
	s1.height = 0.18
	top.mesh = s1
	top.material_override = _glow(Color(0.95, 0.2, 0.15))
	top.position = Vector3(0, 0.08, 0)
	_float_node.add_child(top)
	var bottom := MeshInstance3D.new()
	var s2 := SphereMesh.new()
	s2.radius = 0.09
	s2.height = 0.18
	bottom.mesh = s2
	bottom.material_override = _glow(Color(0.95, 0.95, 0.9))
	bottom.position = Vector3(0, -0.02, 0)
	_float_node.add_child(bottom)
	_float_node.visible = false
	_line = MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.008
	cyl.bottom_radius = 0.008
	cyl.height = 1.0
	cyl.radial_segments = 4
	_line.mesh = cyl
	_line.material_override = _glow(Color(0.95, 0.95, 0.95, 0.7))
	_line.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_line.visible = false
	add_child(_line)

func _attach_rod(on: bool) -> void:
	if _rod:
		_rod.queue_free()
		_rod = null
	if not on or _player == null:
		return
	var visual := _player.get_node_or_null("Visual") as Node3D
	if visual == null:
		return
	_rod = Node3D.new()
	_rod.name = "FishingRod"
	_rod.position = Vector3(0.25, 1.05, 0.25)
	_rod.rotation_degrees = Vector3(50, 0, 0) # 앞(+Z)으로 들어 올림
	visual.add_child(_rod)
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.012
	cyl.bottom_radius = 0.025
	cyl.height = 1.9
	CreatureBuilder._add(_rod, cyl, Vector3(0, 0.95, 0), Vector3.ZERO, Color(0.45, 0.3, 0.18), false)

func rod_tip() -> Vector3:
	if _rod:
		return _rod.to_global(Vector3(0, 1.9, 0))
	return _player.global_position + Vector3.UP * 2.0

func _update_visuals() -> void:
	_reticle_node.visible = state == S.AIM
	if state == S.AIM:
		_reticle_node.global_position = reticle + Vector3.UP * 0.05
		(_reticle_node.material_override as StandardMaterial3D).albedo_color = Color(1, 1, 1, 0.8) if can_cast() else Color(1, 0.4, 0.35, 0.8)
	if _float_node.visible:
		var bob := sin(_t * 3.0) * 0.02
		var dip := 0.0
		if state == S.BITE:
			dip = -0.18
		elif state == S.REEL:
			dip = -0.1 + sin(_t * 12.0) * 0.06
		_float_node.global_position = float_pos + Vector3(0, bob + dip, 0)
		var a := rod_tip()
		var b := _float_node.global_position
		var d := a.distance_to(b)
		if d > 0.05:
			(_line.mesh as CylinderMesh).height = d
			_line.global_position = (a + b) * 0.5
			var up := (b - a).normalized()
			var side := up.cross(Vector3.FORWARD if absf(up.dot(Vector3.FORWARD)) < 0.9 else Vector3.RIGHT).normalized()
			_line.global_basis = Basis(side, up, side.cross(up)).orthonormalized()

func _bob(depth: float) -> void:
	if _float_node.visible:
		var tw := _float_node.create_tween()
		tw.tween_property(_float_node, "position:y", float_pos.y - depth, 0.08)
		tw.tween_property(_float_node, "position:y", float_pos.y, 0.2)
	_ripple(float_pos, 0.35 + depth)

func _ripple(at: Vector3, r: float) -> void:
	var mi := MeshInstance3D.new()
	var tor := TorusMesh.new()
	tor.inner_radius = r * 0.85
	tor.outer_radius = r
	tor.rings = 20
	tor.ring_segments = 4
	mi.mesh = tor
	var mat := _glow(RIPPLE_COLOR)
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.global_position = at + Vector3.UP * 0.03
	var tw := mi.create_tween().set_parallel(true)
	tw.tween_property(mi, "scale", Vector3.ONE * 2.2, 0.6)
	tw.tween_property(mat, "albedo_color:a", 0.0, 0.6)
	tw.chain().tween_callback(mi.queue_free)

func _glow(color: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = color
	if color.a < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	return m

# ---------------------------------------------------------------- 화면

func _build_hud() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 5
	layer.name = "FishingHUD"
	add_child(layer)
	_hud = Control.new()
	_hud.set_anchors_preset(Control.PRESET_FULL_RECT)
	_hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(_hud)
	_prompt_btn = _button("낚시 (F)", Vector2(0.5, 1.0), Rect2(-80, -222, 160, 44))
	_prompt_btn.visible = false
	_prompt_btn.pressed.connect(func() -> void: press("fish", true))
	_status = Label.new()
	_status.anchor_left = 0.5
	_status.anchor_right = 0.5
	_status.offset_left = -330
	_status.offset_right = 330
	_status.offset_top = 96
	_status.offset_bottom = 150
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status.add_theme_font_size_override("font_size", 17)
	_status.add_theme_constant_override("outline_size", 6)
	_status.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	_status.visible = false
	_hud.add_child(_status)
	_reel = ReelBar.new()
	_reel.anchor_left = 0.5
	_reel.anchor_right = 0.5
	_reel.anchor_top = 1.0
	_reel.anchor_bottom = 1.0
	_reel.offset_left = -220
	_reel.offset_right = 220
	_reel.offset_top = -260
	_reel.offset_bottom = -200
	_reel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_reel.visible = false
	_hud.add_child(_reel)
	if DisplayServer.is_touchscreen_available():
		var cast_b := _button("던지기", Vector2(1.0, 1.0), Rect2(-280, -300, 110, 110))
		cast_b.button_down.connect(func() -> void: press("fish", true))
		cast_b.button_up.connect(func() -> void: press("fish", false))
		var bait_b := _button("미끼", Vector2(1.0, 1.0), Rect2(-410, -300, 110, 110))
		bait_b.pressed.connect(func() -> void: press("bait_next", true))
		var stop_b := _button("그만", Vector2(1.0, 1.0), Rect2(-540, -300, 110, 110))
		stop_b.pressed.connect(func() -> void: press("stop", true))
		_touch = {"cast": cast_b, "bait": bait_b, "stop": stop_b}
		for k in _touch:
			(_touch[k] as Button).visible = false
	_build_board_panel()

func _button(text: String, anchor: Vector2, r: Rect2) -> Button:
	var b := Button.new()
	b.text = text
	b.anchor_left = anchor.x
	b.anchor_right = anchor.x
	b.anchor_top = anchor.y
	b.anchor_bottom = anchor.y
	b.offset_left = r.position.x
	b.offset_top = r.position.y
	b.offset_right = r.position.x + r.size.x
	b.offset_bottom = r.position.y + r.size.y
	_hud.add_child(b)
	return b

func status_text() -> String:
	if state == S.IDLE:
		return ""
	var bait_txt := "%s ×%d" % [Fishing.BAITS[bait].name, PartyState.count(bait)]
	var left := "  · 남은 물고기 %d" % fish_left(spot_id)
	match state:
		S.AIM:
			return "%s%s\n이동 = 던질 자리 · F/왼쪽 = 던지기 · 1~3 미끼 · Esc/오른쪽 = 그만" % [bait_txt, left]
		S.WAIT:
			return "%s — 기다리는 중… (F = 거두기)" % bait_txt
		S.NIBBLE:
			return "톡… 톡… — 아직 당기지 마라"
		S.BITE:
			return "입질! — F/왼쪽으로 당겨라"
		S.REEL:
			return "누르고 있으면 찌가 오르고, 떼면 내려간다 — 물고기 칸 안에 두어라"
	return ""

func _refresh_hud() -> void:
	if _status == null:
		return
	_status.visible = state != S.IDLE
	_status.text = status_text()
	_reel.visible = state == S.REEL
	if state == S.REEL:
		_reel.zone_c = zone_c
		_reel.zone_w = zone_w
		_reel.cursor = cursor
		_reel.progress = progress
		_reel.good = in_zone()
		_reel.queue_redraw()
	for k in _touch:
		(_touch[k] as Button).visible = state != S.IDLE
	if _touch.has("cast"):
		(_touch.cast as Button).text = {S.AIM: "던지기", S.WAIT: "거두기", S.NIBBLE: "당기기", S.BITE: "당기기!", S.REEL: "감기"}.get(state, "던지기")

## 줄다리기 막대 — 푸른 칸 = 물고기, 흰 줄 = 찌, 아래 막대 = 잡는 정도.
class ReelBar extends Control:
	var zone_c := 0.5
	var zone_w := 0.2
	var cursor := 0.5
	var progress := 0.0
	var good := false

	func _draw() -> void:
		var w := size.x
		var bar := Rect2(0, 0, w, 26)
		draw_rect(bar, Color(0, 0, 0, 0.6))
		draw_rect(Rect2((zone_c - zone_w * 0.5) * w, 2, zone_w * w, 22), Color(0.45, 0.85, 1.0, 0.85) if good else Color(0.35, 0.6, 0.8, 0.7))
		var cx := cursor * w
		draw_line(Vector2(cx, -4), Vector2(cx, 30), Color(1, 1, 1), 4.0)
		draw_rect(Rect2(0, 38, w, 12), Color(0, 0, 0, 0.6))
		draw_rect(Rect2(0, 38, w * clampf(progress, 0.0, 1.0), 12), Color(1.0, 0.85, 0.35))

# ---------------------------------------------------------------- 낚시 조합

func _build_board_panel() -> void:
	_board_panel = PanelContainer.new()
	_board_panel.anchor_left = 0.5
	_board_panel.anchor_right = 0.5
	_board_panel.anchor_top = 0.5
	_board_panel.anchor_bottom = 0.5
	## G-0165 — 기본 회색 반투명 판·본문 14 라 뒤 세상이 비치고 줄이 묻혔다 — choice_prompt 와 같은 진한 판·큰 글자.
	_board_panel.offset_left = -380
	_board_panel.offset_right = 380
	_board_panel.offset_top = -260
	_board_panel.offset_bottom = 260
	_board_panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_board_panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.07, 0.06, 0.09, 0.93)
	bg.border_color = Color(0.85, 0.7, 0.4, 0.8)
	bg.set_border_width_all(2)
	bg.set_corner_radius_all(14)
	bg.set_content_margin_all(18)
	_board_panel.add_theme_stylebox_override("panel", bg)
	_board_panel.visible = false
	_hud.add_child(_board_panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	_board_panel.add_child(box)
	var title := Label.new()
	title.text = "낚시 조합 — 물고기 바꾸기"
	title.add_theme_font_size_override("font_size", 30)
	title.add_theme_color_override("font_color", Color(1.0, 0.88, 0.6))
	box.add_child(title)
	_board_label = Label.new()
	_board_label.add_theme_font_size_override("font_size", 22)
	_board_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(_board_label)
	_board_list = VBoxContainer.new()
	box.add_child(_board_list)
	var close := Button.new()
	close.text = "닫기"
	close.custom_minimum_size = Vector2(0, 52)
	close.add_theme_font_size_override("font_size", 24)
	close.pressed.connect(close_board)
	box.add_child(close)

func open_board() -> bool:
	if board_open or state != S.IDLE or _player == null or _player.get("frozen"):
		return false
	board_open = true
	_board_panel.visible = true
	add_to_group("ui_modal")
	_frozen_before = bool(_player.get("frozen"))
	_player.set("frozen", true)
	_refresh_board()
	return true

func close_board() -> void:
	if not board_open:
		return
	board_open = false
	_board_panel.visible = false
	remove_from_group("ui_modal")
	_player.set("frozen", _frozen_before)

func can_exchange(i: int) -> bool:
	var row: Dictionary = Fishing.EXCHANGE[i]
	for f in row.cost:
		if PartyState.count(Fishing.item_id(f)) < int(row.cost[f]):
			return false
	if row.has("weapon"):
		var w: Dictionary = PartyState.weapons.get(String(row.weapon), {})
		if not w.is_empty() and int(w.get("ref", 1)) >= Weapons.REFINE_MAX:
			return false
	return true

## 바꾸기 — 물고기를 내고 받는다. 받은 것 설명을 돌려준다(못 바꾸면 "").
func exchange(i: int) -> String:
	if i < 0 or i >= Fishing.EXCHANGE.size() or not can_exchange(i):
		return ""
	var row: Dictionary = Fishing.EXCHANGE[i]
	var pay := {}
	for f in row.cost:
		pay[Fishing.item_id(f)] = -int(row.cost[f])
	PartyState.add_items(pay)
	var got := String(row.name)
	if row.has("weapon"):
		var r := PartyState.add_weapon(String(row.weapon))
		got += " — 재련" if r == "refine" else " 얻음"
	if row.has("give"):
		PartyState.add_items(row.give)
	CombatFeel.ui()
	Toast.show(self, "바꿨다 — %s" % got, 2.5)
	_refresh_board()
	return got

func _refresh_board() -> void:
	var have: Array[String] = []
	for f in Fishing.FISH_ORDER:
		var n := PartyState.count(Fishing.item_id(f))
		if n > 0:
			have.append("%s %d" % [Fishing.fish(f).name, n])
	var log: Dictionary = PartyState.fishing.get("log", {})
	_board_label.text = "가진 물고기: %s\n잡아 본 물고기 %d/%d" % ["없음" if have.is_empty() else " · ".join(have), log.size(), Fishing.FISH.size()]
	for c in _board_list.get_children():
		_board_list.remove_child(c)
		c.queue_free()
	for i in Fishing.EXCHANGE.size():
		var row: Dictionary = Fishing.EXCHANGE[i]
		var cost: Array[String] = []
		for f in row.cost:
			cost.append("%s %d" % [Fishing.fish(f).name, int(row.cost[f])])
		var b := Button.new()
		b.text = "%s  ←  %s" % [row.name, " · ".join(cost)]
		b.disabled = not can_exchange(i)
		b.custom_minimum_size = Vector2(0, 52)
		b.add_theme_font_size_override("font_size", 22)
		b.add_theme_color_override("font_disabled_color", Color(0.85, 0.85, 0.85, 0.75))   # 못 바꾸는 줄도 무엇이 드는지 읽히게
		var idx := i
		b.pressed.connect(func() -> void: exchange(idx))
		_board_list.add_child(b)
