extends Node3D

## G-0098 — 사가만리 굴 안. 굴 입구(landmarks_builder.gd cave_gate_pos, 격자 (5,2)) 곁에서 F → 세상 밖에 지은
## 흙 → 석회 → 용암 세 구간 굴로 들어간다(굴 조각 cave_* 16 — 입구 아치 dirt 는 바깥에도 쓴다).
##   구간 하나 = [아치] 복도 → 모퉁이 → 방(적) → 계단(1.2m×배율 내려감). 모퉁이는 구간마다 반대로 돌아 갈지자(겹치지 않게).
##   끝 = 큰 그릇 굴(floor_01) — 계단 끝에서 둘레 위로 내려서 미끄러져 내려가면 바닥 가운데 보물 상자·나가는 빛.
##   조각은 위가 열려 있다(천장 없음 — 카메라가 안 박힌다). 면이 뒤집혀 있어 충돌은 backface_collision 을 켠다(10-08 실측).
##   들어간 동안 해·환경광을 낮추고(나올 때 night_visual.refresh_now 로 되돌림) 방마다 횃불 빛.
##   보물은 한 번 실행에 한 번(저장 안 함 — 세이브 버전 안 올림). 나감 = 들어온 빛 원판·끝 빛에서 F, 또는 나가기 단추.
## 비경(domains.gd)과 같은 결: 세상 밖 자리·순간이동·F(go_domain 액션)·화면 단추.

const GLBUtils := preload("res://saga_core/world/glb_utils.gd")
const Landmarks := preload("res://games/saga_go/world/landmarks_builder.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const DIR := "res://assets/world/"
const ORIGIN := Vector3(1400.0, 40.0, 0.0)   # 비경 원판(x −1400, z 0~3000)과 안 겹치는 세상 밖
const S := 1.5                               # 조각 배율 — 복도 바닥 폭 3m·벽 3.7m
const GATE_M := 4.0                          # 바깥 입구 곁(입구 충돌 상자 깊이 1.5m 라 비경 3m 보다 조금 넓게)
const USE_M := 2.6                           # 안의 빛 원판·상자 곁
const FALL_M := 3.0                          # 가장 낮은 바닥(그릇 가운데)보다 이만큼 아래면 들어온 자리로
const DARK_SUN := 0.3                        # 들어간 동안 해 세기 배율
const DARK_AMBIENT := 0.45                   # 환경광 배율
const REWARD := {"mora": 2500, "ore_m": 2}
const REWARD_EXP := 30.0

## 조각 — 연결점(조각 자리, 배율 전): in·out 바닥 점과 걸어 들어가는/나가는 방향. 10-08 실측(광선 높이 지도).
const PIECES := {
	"corridor": {"in": Vector3(0, 0, -2.0), "din": Vector3(0, 0, 1), "out": Vector3(0, 0, 2.0), "dout": Vector3(0, 0, 1)},
	"stairs": {"in": Vector3(0, 1.2, -2.0), "din": Vector3(0, 0, 1), "out": Vector3(0, 0, 2.0), "dout": Vector3(0, 0, 1)},
	"room": {"in": Vector3(0, 0, -2.3), "din": Vector3(0, 0, 1), "out": Vector3(0, 0, 2.25), "dout": Vector3(0, 0, 1)},
	"gate": {"in": Vector3(0, 0, -0.4), "din": Vector3(0, 0, 1), "out": Vector3(0, 0, 0.4), "dout": Vector3(0, 0, 1)},
	"corner_a": {"in": Vector3(3.0, 0, 0), "din": Vector3(-1, 0, 0), "out": Vector3(0, 0, 3.0), "dout": Vector3(0, 0, 1)},   # +x 팔로 들어가 +z 팔로
	"corner_b": {"in": Vector3(0, 0, 3.0), "din": Vector3(0, 0, -1), "out": Vector3(3.0, 0, 0), "dout": Vector3(1, 0, 0)},   # 거꾸로 — 반대로 돈다
}
## 구간 — 결·모퉁이·방의 적·횃불 색.
const SECTIONS := [
	{"tex": "dirt", "gate": "cave_gate_01_dirt", "corner": "corner_a", "foes": ["rock_bear", "wolf"], "light": Color(1.0, 0.72, 0.42)},
	{"tex": "limestone", "gate": "cave_gate_01_limestone", "corner": "corner_b", "foes": ["ice_fox", "water_turtle"], "light": Color(0.6, 0.8, 1.0)},
	{"tex": "lava", "gate": "cave_gate_01_lava", "corner": "corner_a", "foes": ["fire_imp", "fire_imp", "rock_bear"], "light": Color(1.0, 0.45, 0.2)},
]

var inside := false
var claimed := false
var built := false
var used_files: Dictionary = {}   # 지은 조각 파일 이름(점검)
var joints: Array = []            # 조각 사이 이음 바닥 점(점검 — 틈)

var _player: Node3D
var _root: Node3D
var _entry := Vector3.ZERO       # 굴 안 들어온 자리(빛 원판)
var _exit_light := Vector3.ZERO  # 끝 방 나가는 빛
var _chest_pos := Vector3.ZERO
var _chest: Node3D
var _chest_holder: Node3D   # 상자·이름표(첫 입장 때 바닥에 붙인다)
var _exit_holder: Node3D    # 끝 빛 원판·이름표·빛
var _snapped := false
var _rooms: Array = []           # [{pos, basis, foes, light}]
var _enemies: Array = []
var _return_pos := Vector3.ZERO
var _dark_saved := {}
var _meshes := {}
var _btn: Button
var _hud_layer: CanvasLayer
var _hud: Label


func _ready() -> void:
	add_to_group("go_cave")
	_player = get_tree().get_first_node_in_group("player")
	if not InputMap.has_action("go_domain"):   # domains.gd 와 같은 F
		InputMap.add_action("go_domain")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_F
		InputMap.action_add_event("go_domain", ev)
	_build_gate_sign()
	_build_hud()


func gate_pos() -> Vector3:
	return Landmarks.cave_gate_pos()


func near_gate() -> bool:
	if _player == null or inside:
		return false
	var d := _player.global_position - gate_pos()
	d.y = 0.0
	return d.length() <= GATE_M + 3.75   # 입구 아치 폭 7.5m 의 절반 + 곁


func near_exit() -> bool:
	if _player == null or not inside:
		return false
	return _player.global_position.distance_to(_entry) <= USE_M or _player.global_position.distance_to(_exit_light) <= USE_M


func near_chest() -> bool:
	return inside and _player != null and _player.global_position.distance_to(_chest_pos) <= USE_M + 0.6


func alive_enemies() -> Array:
	return _enemies.filter(func(e: Variant) -> bool: return is_instance_valid(e) and not e.call("is_dead"))


func entry_pos() -> Vector3:
	return _entry


func chest_pos() -> Vector3:
	return _chest_pos


func exit_light_pos() -> Vector3:
	return _exit_light


## 촬영·점검 — 구간 i(0~2) 방 들머리, 3 이면 끝 그릇 상자 곁으로 옮긴다(안에 있을 때만).
func goto_room(i: int) -> void:
	if not inside:
		return
	if i >= _rooms.size():
		_teleport(_chest_pos + Vector3(1.2, 0.4, 0))
		return
	var r: Dictionary = _rooms[i]
	_teleport((r.pos as Vector3) - (r.basis as Basis) * Vector3(0, 0, 6.0) + Vector3(0, 0.4, 0))   # 방 앞 모퉁이 팔


# ---------------------------------------------------------------- 들어감·나감

## 들어간다. 못 들어가면(이미 안·비경 안) false. 선택 창이 떠 있을 땐 F(_use)가 안 부른다.
func enter() -> bool:
	if inside or _player == null:
		return false
	if not get_tree().get_nodes_in_group("go_domain_active").is_empty():
		return false
	ensure_built()
	_return_pos = _player.global_position
	inside = true
	_root.visible = true
	_spawn_enemies()
	_darken(true)
	_teleport(_entry + Vector3(0, 0.4, 0))
	_hud_layer.visible = true
	_refresh_hud()
	Toast.show(self, "⛰ 굴 안 — 흙·석회·용암 세 구간, 끝에 보물. 나가려면 빛 원판에서 F", 3.0)
	return true


func leave() -> void:
	if not inside:
		return
	for e in _enemies:
		if is_instance_valid(e):
			e.queue_free()
	_enemies.clear()
	inside = false
	_root.visible = false
	_darken(false)
	_hud_layer.visible = false
	_teleport(_return_pos + Vector3(0, 0.3, 0))


## 끝 방 보물(한 번 실행에 한 번). 받았으면 true.
func claim() -> bool:
	if not inside or claimed:
		return false
	claimed = true
	PartyState.add_items(REWARD)
	PartyState.add_exp(REWARD_EXP)
	Toast.show(self, "⛰ 굴 끝 보물 — 모라 %d · 광석 %d" % [int(REWARD.mora), int(REWARD.ore_m)], 3.0)
	if _chest:
		_chest.rotation.x = -0.35   # 뚜껑 대신 살짝 기울여 연 표시
	_refresh_hud()
	return true


func _teleport(p: Vector3) -> void:
	_player.global_position = p
	_player.set("velocity", Vector3.ZERO)
	if _player.has_method("respawn_safe"):
		_player.set("_last_safe", p)


func _darken(on: bool) -> void:
	darken_scene(get_parent(), on, _dark_saved, DARK_SUN, DARK_AMBIENT)


## 해·환경광을 낮추거나(on — 원래 값을 saved 에) 되돌린다. G-0061 집 안(house_interiors.gd)도 쓴다.
static func darken_scene(scene: Node, on: bool, saved: Dictionary, sun_mul: float, ambient_mul: float) -> void:
	var sun := scene.get_node_or_null("Sun") as DirectionalLight3D
	var we := scene.get_node_or_null("WorldEnvironment") as WorldEnvironment
	var env: Environment = we.environment if we else null
	if on:
		saved.clear()
		if sun:
			saved["sun"] = sun.light_energy
			sun.light_energy *= sun_mul
		if env:
			saved["ambient"] = env.ambient_light_energy
			env.ambient_light_energy *= ambient_mul
		return
	if sun and saved.has("sun"):
		sun.light_energy = float(saved.sun)
	if env and saved.has("ambient"):
		env.ambient_light_energy = float(saved.ambient)
	scene.get_tree().call_group("go_night_visual", "refresh_now")   # 그사이 밤낮이 바뀌었으면 맞춘다


func _spawn_enemies() -> void:
	_enemies.clear()
	var n := 0
	for r: Dictionary in _rooms:
		var foes: Array = r.foes
		for i in foes.size():
			var side := (float(i) - (foes.size() - 1) * 0.5) * 1.2
			var home: Vector3 = r.pos + (r.basis as Basis) * Vector3(side, 0, 0.9) + Vector3(0, 0.6, 0)
			var e: CharacterBody3D = FieldEnemy.new()
			e.setup(String(foes[i]), home, 20260824 + 97 * n)
			e.respawns = false
			e.name = "CaveEnemy_%d" % n
			add_child(e)
			e.global_position = home
			e.connect("died", func(_x: Node) -> void: _refresh_hud())
			_enemies.append(e)
			n += 1


func _physics_process(_delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player")
		return
	if _btn:
		var label := ""
		if near_gate():
			label = "⛰ 굴 안으로 (F)"
		elif near_chest() and not claimed:
			label = "보물 열기 (F)"
		elif near_exit():
			label = "굴 밖으로 (F)"
		_btn.visible = label != "" and get_tree().get_nodes_in_group("ui_modal").is_empty()
		_btn.text = label
	if inside and not _snapped:
		_snap_markers()
	if inside and _player.global_position.y < _chest_pos.y - FALL_M:
		_teleport(_entry + Vector3(0, 0.4, 0))


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("go_domain") and _use():
		get_viewport().set_input_as_handled()


func _use() -> bool:
	if not get_tree().get_nodes_in_group("ui_modal").is_empty():
		return false
	if near_gate():
		return enter()
	if near_chest() and not claimed:
		return claim()
	if near_exit():
		leave()
		return true
	return false


# ---------------------------------------------------------------- 짓기

## 끝 그릇 바닥은 울퉁불퉁해 짓는 때 높이를 모른다 — 첫 입장 물리 틱에 상자·끝 빛을 광선으로 바닥에 붙인다.
func _snap_markers() -> void:
	_snapped = true
	var space := get_world_3d().direct_space_state
	for h: Node3D in [_chest_holder, _exit_holder]:
		if h == null:
			continue
		var p := h.global_position
		var r := space.intersect_ray(PhysicsRayQueryParameters3D.create(p + Vector3(0, 3.0, 0), p + Vector3(0, -8.0, 0)))
		if not r.is_empty():
			h.global_position = r.position
	if _chest_holder:
		_chest_pos = _chest_holder.global_position
	if _exit_holder:
		_exit_light = _exit_holder.global_position


func _mesh(file: String) -> Mesh:
	if not _meshes.has(file):
		_meshes[file] = GLBUtils.extract_mesh(DIR + file + ".glb")
	return _meshes[file]


static func _yaw(v: Vector3) -> float:
	return atan2(v.x, v.z)


## 한 번만 짓는다(처음 들어갈 때 · 점검).
func ensure_built() -> void:
	if built:
		return
	built = true
	_root = Node3D.new()
	_root.name = "CaveInterior"
	add_child(_root)
	_root.visible = false
	var pos := ORIGIN
	var yaw := 0.0
	_entry = pos + Vector3(0, 0, 2.8 * S)   # 첫 아치 지나 흙 복도 가운데
	_add_disc(_entry, Color(0.75, 0.9, 1.0), "들어온 자리 · 굴 밖으로 [F]")
	for si in SECTIONS.size():
		var sec: Dictionary = SECTIONS[si]
		var t := String(sec.tex)
		var cur := {"pos": pos, "yaw": yaw}
		_place(cur, "gate", String(sec.gate))
		_place(cur, "corridor", "cave_corridor_01_" + t)
		_place(cur, String(sec.corner), "cave_corner_01_" + t)
		var room := _place(cur, "room", "cave_room_01_" + t)
		_rooms.append({"pos": room.origin, "basis": room.basis.orthonormalized(), "foes": sec.foes})
		_add_light(room.origin + Vector3(0, 2.6, 0), sec.light, 9.0)
		_place(cur, "stairs", "cave_stairs_01_" + t)
		pos = cur.pos
		yaw = cur.yaw
	## 끝 그릇 굴 — 둘레 위가 계단 끝보다 조금 낮게, 둘레(z −7)가 계단 끝에 오게.
	var basis := Basis(Vector3.UP, yaw)
	var fwd := basis * Vector3(0, 0, 1)
	var bowl_o := pos + fwd * (7.0 * S) - Vector3(0, 5.2 * S, 0)
	_add_piece("cave_floor_01", Transform3D(basis.scaled(Vector3.ONE * S), bowl_o))
	_chest_pos = bowl_o + Vector3(0, 1.25 * S, 0)
	_exit_light = bowl_o + basis * Vector3(2.4 * S, 1.25 * S, 0)
	_chest_holder = _add_chest(_chest_pos, basis)
	_exit_holder = _add_disc(_exit_light, Color(1.0, 0.85, 0.5), "굴 밖으로 [F]")
	_add_light(_chest_pos + Vector3(0, 3.5, 0), Color(1.0, 0.6, 0.3), 14.0)
	## 떨어져도 받는 바닥(굴 밑 4m) — 넘어도 _physics_process 가 들어온 자리로 돌린다.
	var low := minf(_chest_pos.y, ORIGIN.y) - 4.0
	var catcher := StaticBody3D.new()
	catcher.name = "CaveCatcher"
	var bs := BoxShape3D.new()
	bs.size = Vector3(160, 1, 160)
	var cs := CollisionShape3D.new()
	cs.shape = bs
	catcher.add_child(cs)
	_root.add_child(catcher)
	catcher.global_position = Vector3(ORIGIN.x, low, ORIGIN.z + 30.0)


## cur(자리·방향)에 조각을 잇고 cur 를 다음 이음으로 옮긴다. 놓은 자리(Transform3D, 배율 포함 basis)를 돌려준다.
func _place(cur: Dictionary, kind: String, file: String) -> Transform3D:
	var p: Dictionary = PIECES[kind]
	var rot: float = float(cur.yaw) - _yaw(p.din)
	var basis := Basis(Vector3.UP, rot).scaled(Vector3.ONE * S)
	var o: Vector3 = (cur.pos as Vector3) - basis * (p.in as Vector3)
	var xf := Transform3D(basis, o)
	_add_piece(file, xf)
	cur.pos = o + basis * (p.out as Vector3)
	cur.yaw = rot + _yaw(p.dout)
	joints.append(cur.pos)
	return xf


func _add_piece(file: String, xf: Transform3D) -> void:
	var m := _mesh(file)
	if m == null:
		push_warning("굴 조각 없음: " + file)
		return
	used_files[file] = true
	var mi := MeshInstance3D.new()
	mi.name = file
	mi.mesh = m
	mi.transform = xf
	_root.add_child(mi)
	## 충돌 — 배율은 면에 굽고(도형에 비균일·배율 변환을 안 건다) 몸에는 회전·자리만.
	var faces := m.get_faces()
	var sc := Transform3D(Basis().scaled(Vector3.ONE * S), Vector3.ZERO)
	for i in faces.size():
		faces[i] = sc * faces[i]
	var shape := ConcavePolygonShape3D.new()
	shape.set_faces(faces)
	shape.backface_collision = true   # 조각 면이 뒤집혀 있다(10-08 실측)
	var body := StaticBody3D.new()
	body.name = file + "_body"
	var cs := CollisionShape3D.new()
	cs.shape = shape
	body.add_child(cs)
	body.transform = Transform3D(xf.basis.orthonormalized(), xf.origin)
	_root.add_child(body)


func _add_light(at: Vector3, c: Color, rng: float) -> void:
	var l := OmniLight3D.new()
	l.light_color = c
	l.light_energy = 2.2
	l.omni_range = rng
	l.shadow_enabled = false
	_root.add_child(l)
	l.global_position = at


func _add_disc(at: Vector3, c: Color, text: String) -> Node3D:
	var holder := Node3D.new()
	_root.add_child(holder)
	holder.global_position = at
	var mi := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 1.0
	cyl.bottom_radius = 1.0
	cyl.height = 0.06
	mi.mesh = cyl
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(c.r, c.g, c.b, 0.6)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = Vector3(0, 0.05, 0)
	holder.add_child(mi)
	var label := Label3D.new()
	label.text = text
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 40
	label.outline_size = 10
	label.position = Vector3(0, 2.0, 0)
	holder.add_child(label)
	var l := OmniLight3D.new()
	l.light_color = c
	l.light_energy = 2.2
	l.omni_range = 5.0
	l.position = Vector3(0, 1.2, 0)
	holder.add_child(l)
	return holder


func _add_chest(at: Vector3, basis: Basis) -> Node3D:
	var holder := Node3D.new()
	_root.add_child(holder)
	holder.global_position = at
	var m := _mesh("chest_01")
	var n: Node3D
	if m != null:
		var mi := MeshInstance3D.new()
		mi.mesh = m
		n = mi
	else:
		var box := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(1.0, 0.7, 0.7)
		box.mesh = bm
		n = box
	n.name = "CaveChest"
	holder.add_child(n)
	n.basis = basis
	_chest = n
	var label := Label3D.new()
	label.text = "보물 [F]"
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 40
	label.outline_size = 10
	label.position = Vector3(0, 1.6, 0)
	holder.add_child(label)
	return holder


func _build_gate_sign() -> void:
	var label := Label3D.new()
	label.name = "CaveGateSign"
	label.text = "⛰ 굴 안으로 [F]"
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 44
	label.outline_size = 10
	add_child(label)
	label.global_position = gate_pos() + Vector3(0, 6.8, 0)


func _build_hud() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 5
	add_child(layer)
	_btn = Button.new()
	_btn.anchor_left = 0.5
	_btn.anchor_right = 0.5
	_btn.anchor_top = 1.0
	_btn.anchor_bottom = 1.0
	_btn.offset_left = -90
	_btn.offset_right = 90
	_btn.offset_top = -222
	_btn.offset_bottom = -176
	_btn.visible = false
	_btn.pressed.connect(_use)
	layer.add_child(_btn)
	_hud_layer = CanvasLayer.new()
	_hud_layer.layer = 5
	_hud_layer.visible = false
	add_child(_hud_layer)
	_hud = Label.new()
	_hud.anchor_left = 0.5
	_hud.anchor_right = 0.5
	_hud.offset_left = -300
	_hud.offset_right = 300
	_hud.offset_top = 70
	_hud.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hud.add_theme_font_size_override("font_size", 18)
	_hud.add_theme_color_override("font_outline_color", Color(0, 0, 0))
	_hud.add_theme_constant_override("outline_size", 6)
	_hud_layer.add_child(_hud)
	var quit := Button.new()
	quit.text = "굴 나가기"
	quit.anchor_left = 0.5
	quit.anchor_right = 0.5
	quit.offset_left = 320
	quit.offset_right = 430
	quit.offset_top = 64
	quit.offset_bottom = 104
	quit.pressed.connect(leave)
	_hud_layer.add_child(quit)


func hud_text() -> String:
	return _hud.text if _hud else ""


func _refresh_hud() -> void:
	if _hud == null:
		return
	var left := alive_enemies().size()
	_hud.text = "⛰ 굴 안 — 남은 적 %d · %s" % [left, "보물 받음" if claimed else "끝 그릇 굴에 보물"]
