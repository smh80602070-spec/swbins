extends "res://games/saga_go/world/story_quest_base.gd"

## PLAN 106장 ㉕ — 원신식 이야기 임무(진행·대화·목표 표시). 표는 data/story.gd, 상태는 PartyState.story {ch, step}.
##   임무 인물 셋(마을 촌장·포구 사공·폐허 학자)이 늘 서 있다. 3m 안 F(터치 "대화 (F)")로 말을 건다 —
##   지금 단계의 인물이면 대화가 이어지고(끝나면 다음 단계), 아니면 한 줄 혼잣말.
##   대화 창: 아래 가운데, 말하는 이·글. F·Space·Enter·누르기로 넘기고, 고르는 줄은 단추(대답만 다르다).
##   목표: 금빛 기둥 + "◆ 거리" 글자, 왼쪽 미니맵 밑 추적 글자, 지도·미니맵 금빛 마름모(world_map.gd 가 target_pos() 를 읽음).
##   임무 목록: O(터치 "임무" 단추) — 장마다 단계 ✔·▶·○.
## 세이브: PartyState.story 한 필드. 임무 적·제단 불은 저장하지 않는다(불러오면 그 단계 처음부터).


## 106장 ㉙ 대화 글자 흘리기 속도(초당 글자 수) — 점검 probe_gestures 가 이 파일 글자에서 직접 읽는다.
const REVEAL_CPS := 30.0

# ---------------------------------------------------------------- 입력·대화

func _unhandled_input(event: InputEvent) -> void:
	if _dlg_open:
		var next := event.is_action_pressed("go_domain") or event.is_action_pressed("jump")
		if event is InputEventKey and (event as InputEventKey).pressed and not (event as InputEventKey).echo \
				and (event as InputEventKey).keycode in [KEY_ENTER, KEY_KP_ENTER]:
			next = true
		if next:
			next_line()
			get_viewport().set_input_as_handled()
		## G-0055 — Esc(패드 B 는 창이 열려 있으면 Esc 로 바뀐다, gamepad.gd) = 건너뛰기.
		elif event is InputEventKey and (event as InputEventKey).pressed and not (event as InputEventKey).echo \
				and (event as InputEventKey).keycode == KEY_ESCAPE:
			skip_dialogue()
			get_viewport().set_input_as_handled()
		return
	if event.is_action_pressed("go_journal"):
		toggle_journal()
		get_viewport().set_input_as_handled()
	elif _journal_open and event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE:
		toggle_journal()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("go_domain"):
		if interact():
			get_viewport().set_input_as_handled()

## 가까운 임무 인물에게 말을 건다. 말을 걸었으면 true.
func interact() -> bool:
	var id := near_npc()
	if id == "" or _dlg_open or _modal_open():
		return false
	var s := current_step()
	if String(s.get("type", "")) == "talk" and String(s.npc) == id:
		open_dialogue(s.lines, advance, id)
	elif String(s.get("type", "")) == "sail" and String(s.npc) == id:
		open_dialogue([s.line], func() -> void: _sail(s), id)
	elif track() != "" and _story_talk_npc() == id:
		set_track("") # 세계 임무를 따라가는 중에도 이야기 인물과는 이야기가 이어진다
		open_dialogue(current_step().lines, advance, id)
	elif _wq_for_npc(id) != "":
		var q := _wq_for_npc(id)
		if not wq_started(q) or track() != q:
			_wq_begin(q) # 맡기 · 이 임무를 따라간다
		open_dialogue(current_step().lines, advance, id)
	else:
		var info: Dictionary = _npc_info(id)
		open_dialogue([[String(info.name), String(info.idle)]], Callable(), id)
	return true

func is_dialogue_open() -> bool:
	return _dlg_open

## npc_id 가 있으면 나를 그 인물 쪽으로 돌려 세우고, 줄마다 말하는 이를 카메라가 잡는다(106장 ㉗).
func open_dialogue(lines: Array, on_done: Callable, npc_id := "") -> void:
	_dlg_lines = lines
	_dlg_i = 0
	_dlg_done = on_done
	_dlg_npc = npc_id if _npc_pos.has(npc_id) else ""
	_dlg_open = true
	_dlg.visible = true
	_marker.visible = false   # G-0044
	add_to_group("ui_modal")
	_frozen_before = bool(_player.get("frozen"))
	_player.set("frozen", true)
	if _dlg_npc != "" and _player.has_method("face_toward"):
		_player.call("face_toward", _npc_pos[_dlg_npc])
	_show_line()

## 말하는 이 쪽으로 카메라 — 인물이 말하면 내 어깨 너머로 인물을, 내가 말하면 인물 어깨 너머로 나를.
func _frame_speaker(me: bool) -> void:
	if _dlg_npc == "":
		return
	var rig := _player.get_node_or_null("CameraRig")
	if rig == null or not rig.has_method("talk_shot"):
		return
	var npc: Vector3 = _npc_pos[_dlg_npc]
	var pp := _player.global_position
	if me:
		rig.call("talk_shot", pp, npc)
	else:
		rig.call("talk_shot", npc, pp)

## 지금 카메라가 잡은 말하는 이("me"·"npc"·"") — 점검용.
func speaker_side() -> String:
	if not _dlg_open or _dlg_npc == "":
		return ""
	var line: Array = _dlg_lines[_dlg_i]
	return "me" if String(line[0]) == "?" or _dlg_name.text == "나" else "npc"

## 다음 줄(고르는 줄이면 고르기 전엔 안 넘어간다). 글자가 흘러나오는 중이면 먼저 줄 전체를 한 번에 보인다(원신처럼 두 번 눌러 넘김).
func next_line() -> void:
	if not _dlg_open or _dlg_waiting_choice:
		return
	if _reveal >= 0.0:
		_finish_reveal()
		return
	_dlg_i += 1
	if _dlg_i >= _dlg_lines.size():
		_close_dialogue()
	else:
		_show_line()

## G-0055 — 건너뛰기: 다음 고르는 줄 앞까지 한 번에(없으면 닫는다 — 끝 콜백은 그대로). 고르는 중이면 아무것도 안 한다.
func skip_dialogue() -> void:
	if not _dlg_open or _dlg_waiting_choice:
		return
	_finish_reveal()
	_dlg_i += 1
	while _dlg_i < _dlg_lines.size() and String((_dlg_lines[_dlg_i] as Array)[0]) != "?":
		_dlg_i += 1
	if _dlg_i >= _dlg_lines.size():
		_close_dialogue()
	else:
		_show_line()

## 고르는 줄에서 i 번째 대답.
func choose(i: int) -> void:
	if not _dlg_waiting_choice:
		return
	var opts: Array = _dlg_lines[_dlg_i][1]
	_dlg_waiting_choice = false
	for c in _dlg_choices.get_children():
		c.queue_free()
	_dlg_name.text = "나"
	_begin_reveal(String(opts[clampi(i, 0, opts.size() - 1)]), _player_face(), "")
	_frame_speaker(true)

func _show_line() -> void:
	var line: Array = _dlg_lines[_dlg_i]
	for c in _dlg_choices.get_children():
		c.queue_free()
	if String(line[0]) == "?":
		_dlg_waiting_choice = true
		_dlg_name.text = "나"
		_begin_reveal("", null, "")
		_dlg_text.text = "…"
		var opts: Array = line[1]
		for i in opts.size():
			var b := Button.new()
			b.text = "▸ " + String(opts[i])
			b.alignment = HORIZONTAL_ALIGNMENT_LEFT
			b.custom_minimum_size = Vector2(0, 60)
			b.add_theme_font_size_override("font_size", 26)
			var k: int = i
			b.pressed.connect(func() -> void: choose(k))
			_dlg_choices.add_child(b)
		_frame_speaker(true)
	else:
		_dlg_waiting_choice = false
		_dlg_name.text = String(line[0])
		var me := String(line[0]) == "나"
		_begin_reveal(String(line[1]), _player_face() if me else _faces.get(_dlg_npc), String(line[2]) if line.size() > 2 else "")
		_frame_speaker(me)

# ---------------------------------------------------------------- 대화 몸짓(106장 ㉙, world/talk_face.gd)

## 말하는 이의 몸짓을 켜고(다른 이는 끄고) 글자를 처음부터 흘린다. face 가 null 이면 몸짓 없이 글자만.
func _begin_reveal(text: String, face: Node, mood: String) -> void:
	for f in _all_faces():
		if f != face:
			f.call("set_talking", false)
			f.call("set_mood", "")
	_reveal_face = face
	_dlg_text.text = text
	if face:
		face.call("set_talking", true)
		face.call("set_mood", mood)
	if text.is_empty():
		_reveal = -1.0
		_dlg_text.visible_characters = -1
		return
	_reveal = 0.0
	_dlg_text.visible_characters = 0

## 줄 전체를 보이고 입을 닫는다(손짓은 다음 줄까지 남는다).
func _finish_reveal() -> void:
	_reveal = -1.0
	_dlg_text.visible_characters = -1
	if _reveal_face:
		_reveal_face.call("speak", "")

func is_revealing() -> bool:
	return _reveal >= 0.0

func _process(delta: float) -> void:
	if _reveal < 0.0 or not _dlg_open:
		return
	var text := _dlg_text.text
	var before := int(_reveal)
	_reveal += REVEAL_CPS * delta
	var now := mini(int(_reveal), text.length())
	if _reveal_face:
		for i in range(before, now):
			_reveal_face.call("speak", text[i])
	_dlg_text.visible_characters = now
	if now >= text.length():
		_finish_reveal()

## 그 인물(또는 "me")의 몸짓 노드 — 점검용.
func face_of(id: String) -> Node:
	return _player_face() if id == "me" else _faces.get(id)

func _player_face() -> Node:
	if not is_instance_valid(_player_tf) and _player:   # G-0024 — 몸이 바뀌면 옛 표정 노드가 사라진다
		var vis := _player.get_node_or_null("Visual")
		if vis:
			_player_tf = TalkFace.attach(vis)
	return _player_tf

func _all_faces() -> Array:
	var out: Array = _faces.values()
	if _player_tf:
		out.append(_player_tf)
	return out

func _close_dialogue() -> void:
	for f in _all_faces():
		f.call("set_talking", false)
		f.call("set_mood", "")
	_reveal = -1.0
	_reveal_face = null
	_dlg_open = false
	_refresh_marker()   # G-0044 — 대화가 끝나면 빛기둥을 다시
	_dlg.visible = false
	remove_from_group("ui_modal")
	_player.set("frozen", _frozen_before)
	var rig := _player.get_node_or_null("CameraRig")
	if _dlg_npc != "" and rig and rig.has_method("end_talk"):
		rig.call("end_talk")
	_dlg_npc = ""
	var cb := _dlg_done
	_dlg_done = Callable()
	if cb.is_valid():
		cb.call()

# ---------------------------------------------------------------- 표시

func _refresh() -> void:
	_refresh_quest_marks()
	var c := Story.chapter(ch())
	if track() != "":
		_tracker.text = "◇ %s\n   %s" % [WorldQuests.quest(track()).name, step_text()]
	elif c.is_empty():
		_tracker.text = ""
	elif locked():
		_tracker.text = "◆ %s\n   %s" % [c.name, Story.lock_text(c, PartyState.cycle)]
	else:
		_tracker.text = "◆ %s\n   %s" % [c.name, step_text()]
	_refresh_journal()
	_refresh_marker()

## G-0075 — 이야기 적(보스·무리·지키기 물결)이 살아 있고 내가 그 자리 FIGHT_HIDE_M 안이면 빛기둥이 보스 몸을 덮지 않게 숨긴다
## (적마다 머리 위 막대·보스 막대가 이미 있다). 멀리서 찾아갈 땐 그대로 보인다.
const FIGHT_HIDE_M := 30.0
func _fighting_at(t: Vector3) -> bool:
	if _player == null or not ["duel", "kill", "defend"].has(String(current_step().get("type", ""))) or alive_quest_enemies().is_empty():
		return false
	return Vector2(_player.global_position.x - t.x, _player.global_position.z - t.z).length() <= FIGHT_HIDE_M

func _refresh_marker() -> void:
	var t := target_pos()
	_marker.visible = t != Vector3.INF and not _dlg_open and not _fighting_at(t)   # G-0075 싸우는 자리에선 숨김 · G-0044 — 대화 중엔 빛기둥이 말하는 인물을 덮지 않게 숨긴다
	if not _marker.visible:
		## G-0075 — 싸우는 자리에선 거리 글자를 떼어 둔다(숨기기 전 거리가 남지 않게).
		if t != Vector3.INF and not _dlg_open and track() == "":
			var fl := _tracker.text.split("\n")
			if fl.size() >= 2:
				_tracker.text = "%s\n   %s" % [fl[0], step_text()]
		return
	_marker.global_position = t
	var d := 0
	if _player:
		d = roundi(Vector2(_player.global_position.x - t.x, _player.global_position.z - t.z).length())
	_marker_label.text = "◆ %dm" % d
	var c := Story.chapter(ch())
	if track() != "" or (not c.is_empty() and not locked()):
		var lines := _tracker.text.split("\n")
		if lines.size() >= 2:
			_tracker.text = "%s\n   %s  %dm" % [lines[0], step_text(), d]

func toggle_journal() -> void:
	if not _journal_open and _modal_open():
		return
	_journal_open = not _journal_open
	_journal.visible = _journal_open
	if _journal_open:
		add_to_group("ui_modal")
		_refresh_journal()
	else:
		remove_from_group("ui_modal")

func is_journal_open() -> bool:
	return _journal_open

func journal_text() -> String:
	return _journal_label.text

func _refresh_journal() -> void:
	if _journal_label == null:
		return
	var out: Array[String] = ["이야기 임무"]
	for i in Story.CHAPTERS.size():
		var c: Dictionary = Story.CHAPTERS[i]
		var mark := "✔" if i < ch() else ("▶" if i == ch() else "○")
		var tail := ""
		if i == ch() and locked():
			tail = "  (%s)" % Story.lock_text(c, PartyState.cycle)
		out.append("\n%s %s%s" % [mark, c.name, tail])
		if i == ch() and not locked():
			var steps: Array = c.steps
			for j in steps.size():
				var sm := "✔" if j < st() else ("▶" if j == st() else "·")
				out.append("    %s %s" % [sm, steps[j].text])
	_journal_label.text = "\n".join(out)
	_refresh_wq_journal()

## 세계 임무 목록(오른쪽 칸) + 따라가기 단추(맡은 임무·이야기 임무).
func _refresh_wq_journal() -> void:
	if _wq_label == null:
		return
	var out: Array[String] = ["세계 임무"]
	for q in WorldQuests.ORDER:
		var d := WorldQuests.quest(q)
		var mark := "✔" if wq_done(q) else ("◇" if wq_started(q) else ("!" if wq_open(q) else "○"))
		var tail := ""
		if not wq_done(q) and not wq_started(q):
			tail = "  — %s %s" % [d.region_name, ("에서 맡을 수 있다" if wq_open(q) else "(모험 등급 %d)" % int(d.ar))]
		out.append("\n%s %s%s%s" % [mark, d.name, "  ← 따라가는 중" if track() == q else "", tail])
		if wq_started(q):
			out.append("    ▶ %s" % String(WorldQuests.step_of(q, wq_step(q)).text))
	_wq_label.text = "\n".join(out)
	for b in _track_box.get_children():
		_track_box.remove_child(b)
		b.queue_free()
	var ids: Array[String] = [""]
	for q in WorldQuests.ORDER:
		if wq_started(q):
			ids.append(q)
	if ids.size() < 2:
		return
	for q in ids:
		var b := Button.new()
		b.text = ("● " if track() == q else "") + ("이야기 임무 따라가기" if q == "" else "「%s」 따라가기" % String(WorldQuests.quest(q).name))
		b.custom_minimum_size = Vector2(260, 38)
		b.pressed.connect(func() -> void:
			set_track(q)
			_refresh_journal())
		_track_box.add_child(b)

## 세계 임무 인물 머리 위 푸른 "!"(말을 걸면 이어지는 임무가 있을 때).
func _refresh_quest_marks() -> void:
	for id in _npcs:
		var m := (_npcs[id] as Node3D).get_node_or_null("QuestMark") as Label3D
		if m:
			m.visible = _wq_for_npc(id) != ""

# ---------------------------------------------------------------- 모양

func _build_npc(id: String) -> void:
	var info: Dictionary = _npc_info(id)
	var p := _cell_pos(String(info.region), info.cell)
	var root := Node3D.new()
	root.name = "StoryNpc_" + id
	add_child(root)
	root.global_position = p
	var body: Node3D = _drone_body(info.cloth) if String(info.get("body", "")) == "drone" \
		else VroidBody.build("story_" + String(info.get("body", id)), int(info.rarity))   # G-0030 — 새 인물 몸(색 덮기 없음)
	body.name = "Body"
	root.add_child(body)
	var anim := body.get_node_or_null("AnimationPlayer") as AnimationPlayer
	if anim and anim.has_animation("idle"):
		anim.play("idle")
	if info.get("mask", false):
		VroidBody.add_mask(body, info.get("mask_color", Color(0.72, 0.12, 0.12)), info.get("mask_face", Color(0.94, 0.92, 0.86)), info.get("crack", false))
	if info.get("helmet", false):
		VroidBody.add_helmet(body)
	if info.get("visor", false):
		VroidBody.add_visor(body)
	if info.get("hat", false):
		VroidBody.add_hat(body)
	if info.get("halo", false):
		VroidBody.add_halo(body)
	if info.get("beads", false):
		VroidBody.add_beads(body)
	if info.get("goggles", false):
		VroidBody.add_goggles(body)
	if info.get("captain_hat", false): # 106장 ㊾-2 별배 선장 — 18장 잔상과 같은 남색·금띠 모자
		VroidBody.add_hat(body, Color(0.12, 0.16, 0.32), Color(0.9, 0.75, 0.3))
	var tf := TalkFace.attach(body)
	if tf:
		_faces[id] = tf
	var label := Label3D.new()
	label.text = String(info.name) + ("  · %s" % String(info.era) if info.has("era") else "")
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 34
	label.outline_size = 8
	label.pixel_size = 0.005
	label.modulate = Color(1.0, 0.95, 0.8)
	label.position = Vector3(0.0, 2.1, 0.0)
	root.add_child(label)
	if WorldQuests.NPCS.has(id):
		var mark := Label3D.new()
		mark.name = "QuestMark"
		mark.text = "!"
		mark.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		mark.font_size = 96
		mark.outline_size = 14
		mark.pixel_size = 0.005
		mark.modulate = WQ_BLUE
		mark.position = Vector3(0.0, 2.65, 0.0)
		mark.visible = false
		root.add_child(mark)
	_npcs[id] = root
	_npc_pos[id] = p

func has_mask(id: String) -> bool:
	var root: Node3D = _npcs.get(id)
	return root != null and not root.find_children("Mask", "Node3D", true, false).is_empty()

func _build_marker() -> void:
	_marker = Node3D.new()
	_marker.name = "StoryMarker"
	add_child(_marker)
	var beam := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.18
	cm.bottom_radius = 0.35
	cm.height = 40.0
	beam.mesh = cm
	var bm := StandardMaterial3D.new()
	bm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	bm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	bm.albedo_color = Color(GOLD.r, GOLD.g, GOLD.b, 0.28)
	bm.cull_mode = BaseMaterial3D.CULL_DISABLED
	beam.material_override = bm
	beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	beam.position = Vector3(0.0, 20.0, 0.0)
	_marker.add_child(beam)
	_marker_label = Label3D.new()
	_marker_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_marker_label.no_depth_test = true
	_marker_label.fixed_size = true
	## 2026-09-28 — 원신 표식처럼 작게(예전 0.0022·30 은 가로 화면 한가운데를 가렸다, 창 모드 촬영).
	_marker_label.pixel_size = 0.0012
	_marker_label.font_size = 28
	_marker_label.outline_size = 10
	_marker_label.modulate = GOLD
	_marker_label.position = Vector3(0.0, 3.2, 0.0)
	_marker.add_child(_marker_label)

## seal 석등 — 제단 둘레 SEAL_RING m 에 SEAL_LAYOUT 차례로(북쪽부터 시계 방향). 돌기둥·표지 빛깔 띠·글자, 켜지면 그 빛깔 불꽃.
func _build_seal(region: String, floating := false) -> void:
	var stone := StandardMaterial3D.new()
	stone.albedo_color = Color(0.5, 0.49, 0.46)
	var n := Story.SEAL_LAYOUT.size()
	for i in n:
		var mark := String(Story.SEAL_LAYOUT[i])
		var info: Dictionary = Story.SEAL_MARKS[mark]
		var a := TAU * float(i) / float(n)
		var world := _altar.global_position + Vector3(sin(a), 0.0, -cos(a)) * Story.SEAL_RING
		world.y = (_altar.global_position.y if floating else TerrainBuilder.height_at(region, world)) - 0.05
		var t := Node3D.new()
		t.name = "SealLamp_" + mark
		_altar.add_child(t)
		t.global_position = world
		var post := MeshInstance3D.new()
		var pm := CylinderMesh.new()
		pm.top_radius = 0.2
		pm.bottom_radius = 0.3
		pm.height = 1.2
		post.mesh = pm
		post.material_override = stone
		post.position = Vector3(0.0, 0.6, 0.0)
		t.add_child(post)
		var cap := MeshInstance3D.new()
		var cb := BoxMesh.new()
		cb.size = Vector3(0.66, 0.14, 0.66)
		cap.mesh = cb
		cap.material_override = stone
		cap.position = Vector3(0.0, 1.27, 0.0)
		t.add_child(cap)
		var band := MeshInstance3D.new()
		var bm := CylinderMesh.new()
		bm.top_radius = 0.23
		bm.bottom_radius = 0.23
		bm.height = 0.1
		band.mesh = bm
		var bmat := StandardMaterial3D.new()
		bmat.albedo_color = info.color
		band.material_override = bmat
		band.position = Vector3(0.0, 0.92, 0.0)
		t.add_child(band)
		var flame := MeshInstance3D.new()
		var fm := SphereMesh.new()
		fm.radius = 0.2
		fm.height = 0.48
		flame.mesh = fm
		var fmat := StandardMaterial3D.new()
		fmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		fmat.albedo_color = info.color
		flame.material_override = fmat
		flame.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		flame.position = Vector3(0.0, 1.56, 0.0)
		flame.visible = false
		t.add_child(flame)
		var label := Label3D.new()
		label.text = String(info.name)
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.modulate = info.color
		label.outline_size = 8
		label.font_size = 56
		label.pixel_size = 0.01
		label.position = Vector3(0.0, 2.1, 0.0)
		t.add_child(label)
		_seal.append({"node": t, "mark": mark, "flame": flame, "lit": false})

## chase 도둑 — 가면 쓴 사람 몸 + 이름표, path 첫 점에.
func _build_thief(s: Dictionary) -> void:
	_thief = Node3D.new()
	_thief.name = "StoryThief"
	add_child(_thief)
	_thief.global_position = _path_pos(s, (s.path as Array)[0])
	var drone := String(s.get("body", "")) == "drone"
	var horse := String(s.get("body", "")) == "horse" # 106장 ㊼-3 놀란 역마(코드 몸 말, 앞 = +Z)
	var captain := String(s.get("body", "")) == "captain" # 106장 ㊽-4 선장의 잔상(사람 몸 + 선장 모자, 가면 없음)
	var body: Node3D
	if drone:
		body = _drone_body(s.get("cloth", Color(0.55, 0.85, 0.95)))
	elif horse:
		body = CreatureBuilder.build("horse", s.get("colors", [Color(0.42, 0.28, 0.18), Color(0.16, 0.12, 0.1), Color(0.1, 0.08, 0.06)]))
	else:
		body = VroidBody.build_pool(VroidBody.BANDIT_POOL, "story_thief", 2)   # G-0030
	body.name = "Body"
	_thief.add_child(body)
	if captain:
		VroidBody.add_hat(body, Color(0.12, 0.16, 0.32), Color(0.9, 0.75, 0.3))
	elif not drone and not horse:
		VroidBody.add_mask(body)
	var label := Label3D.new()
	label.text = String(s.name)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 34
	label.outline_size = 8
	label.pixel_size = 0.005
	label.modulate = Color(1.0, 0.6, 0.45)
	label.position = Vector3(0.0, 2.1, 0.0)
	_thief.add_child(label)

## 106장 ㊴ 배달 기계(미래) — 코드로 그린 둥근 몸·눈 띠·프로펠러 고리 둘. 떠서 천천히 오르내린다.
func _drone_body(tint: Color) -> Node3D:
	var root := Node3D.new()
	var hull := StandardMaterial3D.new()
	hull.albedo_color = Color(0.92, 0.94, 0.97)
	hull.metallic = 0.4
	hull.roughness = 0.35
	var glow := StandardMaterial3D.new()
	glow.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	glow.albedo_color = tint
	var float_root := Node3D.new()
	float_root.position = Vector3(0.0, 1.3, 0.0)
	root.add_child(float_root)
	var body := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.38
	sm.height = 0.62
	body.mesh = sm
	body.material_override = hull
	float_root.add_child(body)
	var eye := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.42, 0.08, 0.06)
	eye.mesh = bm
	eye.material_override = glow
	eye.position = Vector3(0.0, 0.06, 0.34)
	float_root.add_child(eye)
	var box := MeshInstance3D.new()
	var bb := BoxMesh.new()
	bb.size = Vector3(0.34, 0.26, 0.3)
	box.mesh = bb
	box.material_override = glow
	box.position = Vector3(0.0, -0.36, 0.0)
	float_root.add_child(box)
	for x in [-0.5, 0.5]:
		var ring := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 0.16
		tm.outer_radius = 0.22
		ring.mesh = tm
		ring.material_override = hull
		ring.position = Vector3(x, 0.22, 0.0)
		float_root.add_child(ring)
	var tw := float_root.create_tween().set_loops()
	tw.tween_property(float_root, "position:y", 1.45, 0.9).set_trans(Tween.TRANS_SINE)
	tw.tween_property(float_root, "position:y", 1.3, 0.9).set_trans(Tween.TRANS_SINE)
	return root

## 옛 제단 — 돌 받침 + 붙으면 켜지는 불꽃. 붙기 전까지 element_receiver.
func _build_altar(p: Vector3, siege := false) -> void:
	_altar = SiegeAltar.new() if siege else Node3D.new()
	_altar.name = "StoryAltar"
	add_child(_altar)
	_altar.global_position = p
	var stone := StandardMaterial3D.new()
	stone.albedo_color = Color(0.52, 0.5, 0.47)
	for i in 2:
		var mi := MeshInstance3D.new()
		var c := CylinderMesh.new()
		c.top_radius = 0.7 - i * 0.25
		c.bottom_radius = 0.85 - i * 0.25
		c.height = 0.5
		mi.mesh = c
		mi.material_override = stone
		mi.position = Vector3(0.0, 0.25 + i * 0.5, 0.0)
		_altar.add_child(mi)
	_altar_flame = MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.3
	sm.height = 0.8
	(_altar_flame as MeshInstance3D).mesh = sm
	var fm := StandardMaterial3D.new()
	fm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	fm.albedo_color = Color(1.0, 0.7, 0.3)
	(_altar_flame as MeshInstance3D).material_override = fm
	_altar_flame.position = Vector3(0.0, 1.4, 0.0)
	_altar_flame.visible = false
	_altar.add_child(_altar_flame)
	if siege:
		_defend_label = Label3D.new()
		_defend_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		_defend_label.no_depth_test = true
		_defend_label.font_size = 48
		_defend_label.outline_size = 10
		_defend_label.pixel_size = 0.006
		_defend_label.position = Vector3(0.0, 2.3, 0.0)
		_altar.add_child(_defend_label)
	add_to_group("element_receiver")

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 5
	add_child(layer)
	## 추적 글자 — 미니맵·왼쪽 위 글자들 밑(world_map 이 옮긴 날씨 줄 아래).
	_tracker = Label.new()
	_tracker.offset_left = 40
	_tracker.offset_top = 455
	_tracker.add_theme_font_size_override("font_size", 17)
	_tracker.add_theme_color_override("font_color", GOLD)
	_tracker.add_theme_color_override("font_outline_color", Color(0, 0, 0))
	_tracker.add_theme_constant_override("outline_size", 6)
	_tracker.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(_tracker)
	_talk_btn = Button.new()
	_talk_btn.text = "대화 (F)"
	_talk_btn.anchor_left = 0.5
	_talk_btn.anchor_right = 0.5
	_talk_btn.anchor_top = 1.0
	_talk_btn.anchor_bottom = 1.0
	_talk_btn.offset_left = -70
	_talk_btn.offset_right = 70
	_talk_btn.offset_top = -170
	_talk_btn.offset_bottom = -124
	_talk_btn.visible = false
	_talk_btn.pressed.connect(func() -> void: interact())
	layer.add_child(_talk_btn)
	var jb := Button.new()
	jb.text = "임무 (O)"
	jb.position = Vector2(540, 20)
	jb.custom_minimum_size = Vector2(96, 40)
	jb.pressed.connect(toggle_journal)
	layer.add_child(jb)
	## 임무 목록.
	var jl := CanvasLayer.new()
	jl.layer = 6
	add_child(jl)
	_journal = Control.new()
	_journal.set_anchors_preset(Control.PRESET_FULL_RECT)
	_journal.visible = false
	jl.add_child(_journal)
	var dim := ColorRect.new()
	dim.color = Color(0.05, 0.05, 0.1, 0.82)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_journal.add_child(dim)
	_journal_label = Label.new()
	_journal_label.position = Vector2(120, 80)
	_journal_label.add_theme_font_size_override("font_size", 18)
	_journal.add_child(_journal_label)
	_wq_label = Label.new()
	_wq_label.position = Vector2(700, 80)
	_wq_label.add_theme_font_size_override("font_size", 18)
	_journal.add_child(_wq_label)
	_track_box = VBoxContainer.new()
	_track_box.position = Vector2(700, 420)
	_journal.add_child(_track_box)
	var close := Button.new()
	close.text = "닫기 (Esc)"
	close.position = Vector2(120, 30)
	close.custom_minimum_size = Vector2(120, 40)
	close.pressed.connect(toggle_journal)
	_journal.add_child(close)
	## 대화 창 — 아래 가운데. 창을 누르면 다음 줄.
	## G-0056 — 기준 화면이 가로 1920×1280 이라 1280×720 창에선 0.56배: 폭 760·글씨 18 은 10px 로 찍혔다. 선택 창(G-0052)과 같은 결로
	## 키우고(폭 1000 은 세로 기준 폭 1080 안), 아래 끝을 HP 막대(-64) 위로.
	var dl := CanvasLayer.new()
	dl.layer = 7
	add_child(dl)
	_dlg = Control.new()
	_dlg.anchor_left = 0.5
	_dlg.anchor_right = 0.5
	_dlg.anchor_top = 1.0
	_dlg.anchor_bottom = 1.0
	_dlg.offset_left = -500
	_dlg.offset_right = 500
	_dlg.offset_top = -430
	_dlg.offset_bottom = -100
	_dlg.visible = false
	dl.add_child(_dlg)
	var bg := Button.new()
	bg.flat = false
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.modulate = Color(1, 1, 1, 0.92)
	bg.pressed.connect(next_line)
	_dlg.add_child(bg)
	_dlg_name = Label.new()
	_dlg_name.position = Vector2(32, 16)
	_dlg_name.add_theme_font_size_override("font_size", 30)
	_dlg_name.add_theme_color_override("font_color", GOLD)
	_dlg_name.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dlg.add_child(_dlg_name)
	_dlg_text = Label.new()
	_dlg_text.position = Vector2(32, 66)
	_dlg_text.size = Vector2(936, 170)
	_dlg_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_dlg_text.add_theme_font_size_override("font_size", 28)
	_dlg_text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dlg.add_child(_dlg_text)
	_dlg_choices = VBoxContainer.new()
	_dlg_choices.position = Vector2(440, 62)
	_dlg_choices.custom_minimum_size = Vector2(528, 0)
	_dlg_choices.add_theme_constant_override("separation", 8)
	_dlg.add_child(_dlg_choices)
	_dlg_skip = Button.new()
	_dlg_skip.name = "SkipButton"
	_dlg_skip.text = "건너뛰기 ▶▶"
	_dlg_skip.position = Vector2(788, 268)
	_dlg_skip.size = Vector2(180, 48)
	_dlg_skip.add_theme_font_size_override("font_size", 24)
	_dlg_skip.pressed.connect(skip_dialogue)
	_dlg.add_child(_dlg_skip)
	var hint := Label.new()
	hint.text = "F · Space · 누르기 ▶    Esc 건너뛰기"
	hint.position = Vector2(32, 280)
	hint.add_theme_font_size_override("font_size", 20)
	hint.modulate = Color(1, 1, 1, 0.6)
	hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dlg.add_child(hint)
