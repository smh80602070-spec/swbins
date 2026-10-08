extends Node

## 사진 도감 (2026-09-30) — 규칙·수치는 data/album.gd, 상태는 PartyState.album. test_village.gd 가 붙인다.
##   사진 모드(📷)의 촬영 단추가 그룹 "go_album" 의 shoot(화면 이미지)을 부른다 → 화면 안 대상을 찾아 점수를 매기고 기록·보상·썸네일 저장.
##   P(왼쪽 위 "사진첩" 단추) → 담은 것 목록(썸네일·이름·찍은 수·최고 점수)과 마일스톤(5·15·30종).

signal shot_taken(result: Dictionary)

const Album := preload("res://games/saga_go/data/album.gd")
const Growth := preload("res://games/saga_go/data/growth.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const THUMB_SIZE := Vector2i(192, 108)

var is_open := false
var last_shot: Dictionary = {}

var _player: Node3D
var _frozen_before := false
var _layer: CanvasLayer
var _panel: PanelContainer
var _title: Label
var _body: VBoxContainer
var _btn: Button


func _ready() -> void:
	add_to_group("go_album")
	if not InputMap.has_action("go_album"):
		InputMap.add_action("go_album")
		var ev := InputEventKey.new()
		ev.physical_keycode = KEY_P
		InputMap.action_add_event("go_album", ev)
	_build()


# ---------------------------------------------------------------- 찾기

## 화면 안 대상 — [{id, name, kind, score, dist}]. cam 을 안 주면 지금 카메라.
func subjects_in_frame(cam: Camera3D = null) -> Array:
	if cam == null:
		cam = get_viewport().get_camera_3d()
	var out: Array = []
	if cam == null:
		return out
	var size := get_viewport().get_visible_rect().size
	for c in _candidates():
		var node: Node3D = c.node
		if node == null or not is_instance_valid(node) or not node.visible or node.is_queued_for_deletion():
			continue
		var pos: Vector3 = node.global_position + Vector3(0, 0.9, 0)
		var dist := cam.global_position.distance_to(pos)
		if dist < Album.MIN_DIST or dist > Album.MAX_DIST:
			continue
		if cam.is_position_behind(pos) or not cam.is_position_in_frustum(pos):
			continue
		if _occluded(cam, pos, node):
			continue
		var sp := cam.unproject_position(pos)
		var off := Vector2((sp.x / size.x - 0.5) * 2.0, (sp.y / size.y - 0.5) * 2.0).length()
		var top := cam.unproject_position(node.global_position + Vector3(0, 1.8, 0))
		var bottom := cam.unproject_position(node.global_position)
		var frac := absf(top.y - bottom.y) / size.y
		var d: Dictionary = Album.describe(String(c.id))
		if d.is_empty():
			continue
		out.append({"id": c.id, "name": d.name, "kind": d.kind, "score": Album.score(minf(off, 1.0), frac), "dist": dist})
	return out


func _candidates() -> Array:
	var out: Array = []
	for e in get_tree().get_nodes_in_group("field_enemy"):
		out.append({"id": "e:" + String(e.get("kind")), "node": e})
	for h in get_tree().get_nodes_in_group("go_heroes"):
		out.append({"id": "h:" + String(h.get("hero_id")), "node": h})
	for p in get_tree().get_nodes_in_group("go_pets"):
		out.append({"id": "p:" + String(p.get("pet_id")), "node": p})
	var eggs := get_tree().get_first_node_in_group("go_eggs")
	if eggs != null:
		var buddy: Node3D = eggs.get("_buddy")
		var bid := String(PartyState.eggs.get("buddy", ""))
		if buddy != null and bid != "":
			out.append({"id": "b:" + bid, "node": buddy})
	return out


## 카메라에서 대상까지 다른 물체가 가로막나.
func _occluded(cam: Camera3D, pos: Vector3, subject: Node3D) -> bool:
	var space := cam.get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(cam.global_position, pos)
	q.collision_mask = 1
	var ex: Array[RID] = []
	if subject is CollisionObject3D:
		ex.append((subject as CollisionObject3D).get_rid())
	if _player is CollisionObject3D:
		ex.append((_player as CollisionObject3D).get_rid())
	q.exclude = ex
	var hit := space.intersect_ray(q)
	if hit.is_empty():
		return false
	var col := hit.collider as Node
	if col != null and (col == subject or subject.is_ancestor_of(col)):
		return false
	return cam.global_position.distance_to(hit.position) < cam.global_position.distance_to(pos) - 1.5


# ---------------------------------------------------------------- 찍기

## 한 장 — 이미지가 있으면 썸네일도 저장. 결과 {subjects, total, firsts, better}.
func shoot(img: Image = null) -> Dictionary:
	var subs := subjects_in_frame()
	var res := {"subjects": subs.size(), "total": 0, "firsts": [], "better": [], "photo_score": 0}
	if subs.is_empty():
		last_shot = res
		Toast.show(self, "📷 담긴 것이 없다 — 적·신수·인물이 화면 안(2.5~50m)에 보이게", 2.5)
		shot_taken.emit(res)
		return res
	subs.sort_custom(func(a, b): return int(a.score) > int(b.score))
	var total := 0
	for i in subs.size():
		var s: Dictionary = subs[i]
		var sc := int(s.score) + (Album.MULTI_BONUS if i > 0 else 0)
		total += sc
		var r := Album.record(String(s.id), int(s.score))
		if r.result == "first":
			(res.firsts as Array).append(String(s.name))
			_save_thumb(String(s.id), img)
		elif r.result == "better":
			(res.better as Array).append(String(s.name))
			_save_thumb(String(s.id), img)
	res.total = total
	res.photo_score = total
	last_shot = res
	var parts: Array[String] = []
	if not (res.firsts as Array).is_empty():
		parts.append("새로 담음: " + ", ".join(PackedStringArray(res.firsts)))
	if not (res.better as Array).is_empty():
		parts.append("최고 갱신: " + ", ".join(PackedStringArray(res.better)))
	Toast.show(self, "📷 %d개를 담았다 · %d점%s" % [subs.size(), total, (" — " + " / ".join(PackedStringArray(parts))) if not parts.is_empty() else ""], 4.0)
	shot_taken.emit(res)
	if not (res.firsts as Array).is_empty():
		get_tree().call_group("go_help", "tip", "album")
	return res


func _save_thumb(id: String, img: Image) -> void:
	if img == null:
		return
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://photos/album"))
	var small := img.duplicate() as Image
	small.resize(THUMB_SIZE.x, THUMB_SIZE.y, Image.INTERPOLATE_BILINEAR)
	small.save_png(Album.thumb_path(id))


func do_claim(i: int) -> Dictionary:
	var r := Album.claim_milestone(i)
	if not r.is_empty():
		var parts: Array[String] = []
		for k in r:
			parts.append("%s %d" % [String(Growth.ITEMS.get(k, {}).get("name", k)), int(r[k])])
		Toast.show(self, "📷 사진 도감 %d종 보상: %s" % [int(Album.MILESTONES[i][0]), " · ".join(PackedStringArray(parts))], 3.5)
	_refresh()
	return r


# ---------------------------------------------------------------- 화면

func _physics_process(_delta: float) -> void:
	if _player == null or not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player") as Node3D
	_btn.visible = not is_open and _player != null and not bool(_player.get("frozen")) and not get_tree().has_group("go_hud_menu")
	var c := Album.claimable_milestones()
	_btn.text = "사진첩 (P)" + (" ●%d" % c if c > 0 else "")


func _unhandled_input(event: InputEvent) -> void:
	if is_open:
		if event.is_action_pressed("go_album") or (event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE):
			close_screen()
			get_viewport().set_input_as_handled()
	elif event.is_action_pressed("go_album"):
		if open_screen():
			get_viewport().set_input_as_handled()


func open_screen() -> bool:
	if is_open or _player == null or _player.get("frozen"):
		return false
	if get_tree().get_nodes_in_group("duel_active").size() > 0:
		return false
	is_open = true
	_panel.visible = true
	_frozen_before = bool(_player.get("frozen"))
	_player.set("frozen", true)
	_refresh()
	return true


func close_screen() -> void:
	if not is_open:
		return
	is_open = false
	_panel.visible = false
	if _player:
		_player.set("frozen", _frozen_before)


func _build() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = 6
	add_child(_layer)
	_btn = Button.new()
	## 화면 기준 크기(1920×1280) 좌표 — 주간 도전 단추 오른쪽 줄.
	_btn.offset_left = 1270
	_btn.offset_right = 1470
	_btn.offset_top = 70
	_btn.offset_bottom = 108
	_btn.add_theme_font_size_override("font_size", 15)
	_btn.visible = false
	_btn.pressed.connect(func() -> void: open_screen())
	_layer.add_child(_btn)
	_panel = PanelContainer.new()
	_panel.anchor_left = 0.5
	_panel.anchor_right = 0.5
	_panel.anchor_top = 0.5
	_panel.anchor_bottom = 0.5
	_panel.offset_left = -430
	_panel.offset_right = 430
	_panel.offset_top = -320
	_panel.offset_bottom = 320
	_panel.visible = false
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.07, 0.1, 0.95)
	sb.set_corner_radius_all(10)
	sb.content_margin_left = 16
	sb.content_margin_right = 16
	sb.content_margin_top = 12
	sb.content_margin_bottom = 12
	_panel.add_theme_stylebox_override("panel", sb)
	_layer.add_child(_panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	_panel.add_child(box)
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 19)
	_title.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5))
	box.add_child(_title)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.custom_minimum_size = Vector2(0, 430)
	box.add_child(scroll)
	_body = VBoxContainer.new()
	_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_body.add_theme_constant_override("separation", 8)
	scroll.add_child(_body)
	var close := Button.new()
	close.text = "닫기 (P)"
	close.custom_minimum_size = Vector2(0, 40)
	close.pressed.connect(close_screen)
	box.add_child(close)


func _refresh() -> void:
	if _body == null:
		return
	for c in _body.get_children():
		c.queue_free()
	var shots: Dictionary = Album.state().shots
	_title.text = "📷 사진 도감 — 담은 것 %d종 · 최고 점수 합 %d (사진 모드 📷 에서 찍는다)" % [shots.size(), Album.best_total()]
	var ms := HBoxContainer.new()
	_body.add_child(ms)
	for i in Album.MILESTONES.size():
		var b := Button.new()
		var need := int(Album.MILESTONES[i][0])
		if Album.milestone_claimed(i):
			b.text = "%d종 ✔" % need
			b.disabled = true
		elif Album.milestone_reached(i):
			b.text = "%d종 받기 ●" % need
		else:
			b.text = "%d종 (%d/%d)" % [need, shots.size(), need]
			b.disabled = true
		var idx := i
		b.pressed.connect(func() -> void: do_claim(idx))
		ms.add_child(b)
	if shots.is_empty():
		var l := Label.new()
		l.text = "아직 담은 것이 없다. 사진 모드(왼쪽 위 📷)에서 적·신수·인물이 화면 안 2.5~50m 에 보이게 찍어 보자 — 가운데에 크게 담을수록 점수가 높다."
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_body.add_child(l)
		return
	var grid := GridContainer.new()
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	_body.add_child(grid)
	var ids: Array = shots.keys()
	ids.sort()
	for id in ids:
		var e: Dictionary = shots[id]
		var cell := VBoxContainer.new()
		cell.custom_minimum_size = Vector2(192, 0)
		grid.add_child(cell)
		var tex := TextureRect.new()
		tex.custom_minimum_size = Vector2(192, 108)
		tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		var path := Album.thumb_path(String(id))
		if FileAccess.file_exists(path):
			var im := Image.load_from_file(ProjectSettings.globalize_path(path))
			if im != null:
				tex.texture = ImageTexture.create_from_image(im)
		cell.add_child(tex)
		var nm := Label.new()
		## G-0118 — 이름은 지금 표에서(찍은 때 세이브에 적힌 이름은 이름 정책으로 바뀌었을 수 있다). 표에서 사라진 대상만 적힌 이름.
		var d := Album.describe(String(id))
		nm.text = "%s · %s" % [String(d.get("name", e.name)), String(Album.KIND_NAMES.get(String(e.kind), ""))]
		nm.add_theme_font_size_override("font_size", 14)
		cell.add_child(nm)
		var st := Label.new()
		st.text = "×%d · 최고 %d점" % [int(e.n), int(e.best)]
		st.add_theme_font_size_override("font_size", 12)
		st.add_theme_color_override("font_color", Color(0.75, 0.85, 1.0))
		cell.add_child(st)
