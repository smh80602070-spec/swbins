extends Node3D
## char-forge 단계 2 — 지금 VRoid 몸과 공방(../tools/char-forge) 몸을 **같은 빛·같은 셀 셰이더·같은 동작**으로 나란히 세운다.
## 교체 문턱(char-forge README §8-1): 새 몸이 지금 것보다 못하지 않다고 사람이 판정하기 전엔 게임 몸을 안 바꾼다.
## 이 장면은 그 판정용이다 — 게임 씬은 아무것도 안 건드린다.
##
## 조작: 1~8 동작 고르기 · Space 동작 자동 넘김 켜고 끄기 · ←/→ 돌리기 · ↑/↓ 가까이·멀리 · Tab 다음 짝 보기 · R 천천히 돌기 켜고 끄기
## 폰(터치): 화면 누르면 다음 동작, 두 손가락 누르면 다음 짝.

const CelShaderApply := preload("res://saga_core/shaders/cel_shader_apply.gd")
const ENV := preload("res://assets/environment/env_pc.tres")
const CLIPS := ["idle", "walk", "sprint", "attack", "hit", "dodge", "death", "pickup"]
const LOOPS := ["idle", "walk", "sprint"]
const PAIRS := [
	{"name": "GO 플레이어", "old": "res://assets/characters_vroid/AvatarSample_A.glb", "old_scale": 1.091,
		"lib": "res://assets/characters_vroid/anim_cc0/AvatarSample_A_lib.res", "new": "res://assets/characters_cf/cmp_go_01.glb"},
	{"name": "FOREST 플레이어", "old": "res://assets/characters_vroid/saga_forest_avatar_01.glb", "old_scale": 1.0344,
		"lib": "res://assets/characters_vroid/anim_cc0/saga_forest_avatar_01_lib.res", "new": "res://assets/characters_cf/cmp_forest_01.glb"},
	{"name": "DUNGEON 영웅", "old": "res://assets/characters_vroid/dungeon_hero_01.glb", "old_scale": 0.933514,
		"lib": "res://assets/characters_vroid/anim_cc0/dungeon_hero_01_lib.res", "new": "res://assets/characters_cf/cmp_dungeon_01.glb"},
]
const GAP := 1.1  # 짝 안 두 몸 사이 절반(m)
const PAIR_STEP := 4.0  # 짝 사이(m)

var _players: Array = []  # [AnimationPlayer 옛, AnimationPlayer 새] 짝마다
var _stands: Array[Node3D] = []  # 돌리는 받침(짝마다 둘)
var _clip := 0
var _auto := true
var _spin := true
var _focus := 0
var _yaw := 0.0
var _dist := 4.2
var _timer := 0.0
var _cam: Camera3D
var _hud: Label


func _ready() -> void:
	var we := WorldEnvironment.new()
	we.environment = ENV
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.transform = Transform3D(Basis(Vector3(0.8, 0, -0.6), Vector3(-0.35, 0.807, -0.472), Vector3(0.48, 0.59, 0.646)), Vector3(0, 20, 0))
	sun.light_energy = 1.1  # 게임 TestVillage 해와 같은 방향·세기
	sun.shadow_enabled = true
	add_child(sun)
	var ground := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(40, 12)
	ground.mesh = pm
	var gm := StandardMaterial3D.new()
	gm.albedo_color = Color(0.46, 0.52, 0.4)
	ground.material_override = gm
	add_child(ground)
	var summary := []
	for i in PAIRS.size():
		var p: Dictionary = PAIRS[i]
		var x := (i - (PAIRS.size() - 1) / 2.0) * PAIR_STEP
		var old_stand := _stand(Vector3(x - GAP, 0, 0))
		var new_stand := _stand(Vector3(x + GAP, 0, 0))
		var old_body: Node3D = (load(p["old"]) as PackedScene).instantiate()
		old_body.scale = Vector3.ONE * float(p["old_scale"])
		old_stand.add_child(old_body)
		CelShaderApply.apply_to(old_body)
		var old_ap := AnimationPlayer.new()
		old_body.add_child(old_ap)
		old_ap.add_animation_library("", load(p["lib"]))
		var new_body: Node3D = (load(p["new"]) as PackedScene).instantiate()
		new_stand.add_child(new_body)
		CelShaderApply.apply_to(new_body)
		var new_ap: AnimationPlayer = new_body.find_children("*", "AnimationPlayer", true, false)[0]
		for clip in LOOPS:
			for ap in [old_ap, new_ap]:
				if ap.has_animation(clip):
					ap.get_animation(clip).loop_mode = Animation.LOOP_LINEAR
		_face_camera(old_body)
		_face_camera(new_body)
		# 새 몸 키를 게임에서 보이는 옛 몸 키에 맞춘다(같은 자리에서 비교)
		var ho := _height(old_body)
		var hn := _height(new_body)
		if hn > 0.01:
			new_body.scale *= ho / hn
		_label(old_stand, "지금 (VRoid)", ho)
		_label(new_stand, "새 공방 (CC0)", ho)
		_players.append([old_ap, new_ap])
		summary.append({"pair": p["name"], "old_h": snappedf(ho, 0.001), "new_h_raw": snappedf(hn, 0.001),
			"old_clips": old_ap.get_animation_list().size(), "new_clips": new_ap.get_animation_list().size(),
			"old_surfaces_cel": _cel_count(old_body), "new_surfaces_cel": _cel_count(new_body)})
	_cam = Camera3D.new()
	add_child(_cam)
	_hud = Label.new()
	_hud.position = Vector2(16, 12)
	_hud.add_theme_font_size_override("font_size", 22)
	add_child(_hud)
	_play()
	_place_camera()
	print("COMPARE ", JSON.stringify(summary))


func _stand(pos: Vector3) -> Node3D:
	var s := Node3D.new()
	s.position = pos
	add_child(s)
	_stands.append(s)
	return s


func _label(stand: Node3D, text: String, h: float) -> void:
	var l := Label3D.new()
	l.text = text
	l.font_size = 48
	l.pixel_size = 0.004
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.position = Vector3(0, h + 0.25, 0)
	stand.add_child(l)


## 발목 → 발끝이 카메라(+Z) 쪽을 보게 돌린다(saga_forest_avatar_01 은 뼈대 공간 앞이 -Z)
func _face_camera(body: Node3D) -> void:
	var sk: Array = body.find_children("*", "Skeleton3D", true, false)
	if sk.is_empty():
		return
	var s: Skeleton3D = sk[0]
	var foot := s.find_bone("J_Bip_R_Foot") if s.find_bone("J_Bip_R_Foot") >= 0 else s.find_bone("foot_r")
	var toe := s.find_bone("J_Bip_R_ToeBase") if s.find_bone("J_Bip_R_ToeBase") >= 0 else s.find_bone("ball_r")
	if foot < 0 or toe < 0:
		return
	var fwd := (s.global_transform * s.get_bone_global_rest(toe).origin) - (s.global_transform * s.get_bone_global_rest(foot).origin)
	if fwd.z < 0:
		body.rotate_y(PI)


func _height(body: Node3D) -> float:
	var top := -INF
	var bottom := INF
	for mi in body.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.mesh == null:
			continue
		var bb := m.global_transform * m.get_aabb()
		top = maxf(top, bb.end.y)
		bottom = minf(bottom, bb.position.y)
	return top - bottom if top > bottom else 0.0


func _cel_count(body: Node) -> int:
	var n := 0
	for mi in body.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.mesh == null:
			continue
		for i in m.mesh.get_surface_count():
			if m.get_surface_override_material(i) is ShaderMaterial:
				n += 1
	return n


func _play() -> void:
	var clip: String = CLIPS[_clip]
	for pair in _players:
		for ap in pair:
			if (ap as AnimationPlayer).has_animation(clip):
				(ap as AnimationPlayer).play(clip)
				(ap as AnimationPlayer).seek(0.0, true)
	_timer = 0.0
	_update_hud()


func _update_hud() -> void:
	_hud.text = "%s  |  동작 %d/8 %s  |  자동 넘김 %s · 돌기 %s\n1~8 동작 · Space 자동 · ←/→ 돌리기 · ↑/↓ 거리 · Tab 다음 짝 · R 돌기" % [
		PAIRS[_focus]["name"], _clip + 1, CLIPS[_clip], "켬" if _auto else "끔", "켬" if _spin else "끔"]


func _place_camera() -> void:
	## 09-29 — 판정 사진용: SAGA_CMP_FOCUS=<짝 번호> 면 그 짝을 가까이(--write-movie 로 프레임을 떠 사용자에게 보인다).
	var fo := OS.get_environment("SAGA_CMP_FOCUS")
	if fo != "":
		_focus = clampi(int(fo), 0, PAIRS.size() - 1)
		_dist = 3.3
	var x := (_focus - (PAIRS.size() - 1) / 2.0) * PAIR_STEP
	var target := Vector3(x, 0.95, 0)
	_cam.position = target + Vector3(sin(_yaw) * _dist * 0.25, 0.35, _dist)
	_cam.look_at(target)


func _process(delta: float) -> void:
	if _spin:
		for s in _stands:
			s.rotate_y(delta * 0.5)
	if _auto:
		_timer += delta
		var ap: AnimationPlayer = _players[_focus][0]
		var length := ap.get_animation(CLIPS[_clip]).length if ap.has_animation(CLIPS[_clip]) else 3.0
		if _timer > maxf(length * (2.0 if LOOPS.has(CLIPS[_clip]) else 1.0) + 0.6, 3.0):
			_clip = (_clip + 1) % CLIPS.size()
			_play()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		var k := (event as InputEventKey).keycode
		if k >= KEY_1 and k <= KEY_8:
			_clip = k - KEY_1
			_play()
		elif k == KEY_SPACE:
			_auto = not _auto
		elif k == KEY_R:
			_spin = not _spin
		elif k == KEY_TAB:
			_focus = (_focus + 1) % PAIRS.size()
		elif k == KEY_LEFT:
			_yaw -= 0.4
			for s in _stands:
				s.rotate_y(-0.4)
		elif k == KEY_RIGHT:
			for s in _stands:
				s.rotate_y(0.4)
		elif k == KEY_UP:
			_dist = maxf(1.6, _dist - 0.5)
		elif k == KEY_DOWN:
			_dist = minf(9.0, _dist + 0.5)
		_update_hud()
		_place_camera()
	elif event is InputEventScreenTouch and event.pressed:
		if (event as InputEventScreenTouch).index == 1:
			_focus = (_focus + 1) % PAIRS.size()
		else:
			_clip = (_clip + 1) % CLIPS.size()
			_play()
		_update_hud()
		_place_camera()
