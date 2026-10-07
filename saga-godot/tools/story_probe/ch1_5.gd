extends "res://tools/story_probe/base.gd"
## 사가만리 이야기 1부 점검 — 1~5장(단계 0~39). 도는 법·단계 설명은 tools/probe_story.gd 머리말.

func _steps_ch1_5() -> void:
	match _step:
		0: # 준비 — 처음부터, 부대 경험 0(1장 보상으로 모험 등급 5 를 넘지 않게)
			_saved = {"story": PartyState.story.duplicate(), "members": PartyState.members.duplicate(), "exp": PartyState.exp, "level": PartyState.level, "resin": PartyState.resin, "resin_t": PartyState.resin_t,
				"gather_t": PartyState.gather_t.duplicate()}
			PartyState.exp = 0.0
			PartyState.level = 0
			PartyState.story = {}
			for id in Story.MEMBERS:
				PartyState.members.erase(id)
			_sq.call("_enter_step")
			_next()
		1: # ① 표
			var ok := Story.CHAPTERS.size() >= 12 # 106장 ㊺ 2부 10~12장(probe_story2.gd)·㊼ 3부 13장~(probe_story3.gd)
			for c in Story.CHAPTERS:
				for s in c.steps:
					match String(s.type):
						"talk": ok = ok and Story.NPCS.has(String(s.npc)) and (s.lines as Array).size() > 0
						"boss": ok = ok and FieldBosses.FB.BOSSES.has(String(s.boss))
						"domain": ok = ok and Domains.DOMAINS.has(String(s.domain))
						"go", "kill", "light": ok = ok and s.has("region") and s.has("cell")
						"gather": ok = ok and Cooking.GATHER.has(String(s.item)) and int(s.count) > 0
						"cook", "sky": pass
						"party": ok = ok and (s.eras as Array).size() > 0 # 106장 52-4 29장 편성 시험(probe_story8.gd)
						"follow": ok = ok and Story.NPCS.has(String(s.npc)) and (s.path as Array).size() >= 2
						"climb": ok = ok and s.has("region") and s.has("cell") and float(s.radius) > 0.0
						"duel": ok = ok and FieldEnemy.KINDS.has(String(s.kind)) and s.has("region") and s.has("cell")
						"chase": ok = ok and s.has("region") and (s.path as Array).size() >= 2 and String(s.get("name", "")) != ""
						"sail": ok = ok and Story.NPCS.has(String(s.npc)) and (s.to as Dictionary).has("cell") and (s.line as Array).size() == 2
						"defend":
							ok = ok and s.has("region") and s.has("cell") and float(s.hp) > 0.0 and (s.waves as Array).size() >= 2
							for w in s.waves:
								for k in w:
									ok = ok and FieldEnemy.KINDS.has(String(k))
						"seal":
							ok = ok and s.has("region") and s.has("cell") and (s.order as Array).size() == Story.SEAL_LAYOUT.size()
							for m in s.order:
								ok = ok and Story.SEAL_MARKS.has(m) and Story.SEAL_LAYOUT.has(m)
						_: ok = false
			_check("table", ok, "chapters=%d" % Story.CHAPTERS.size())
			_next()
		2: # ② 처음
			var t: Vector3 = _sq.call("target_pos")
			var tx: String = _sq.call("tracker_text")
			_check("start", int(_sq.call("st")) == 0 and t.distance_to(_sq.call("npc_pos", "elder")) < 0.01 and tx.contains("제1장") and tx.contains("촌장"), "tracker='%s'" % tx.replace("\n", " / "))
			_next()
		3: # ③ 촌장 대화
			if _frame == 1:
				_near_npc("elder")
			if _frame == 10:
				var btn := bool((_sq.get("_talk_btn") as Button).visible) # 숨긴 선택지 창이 그룹에 남아 있어도 단추는 보여야
				var opened: bool = _sq.call("interact")
				var modal := _sq.is_in_group("ui_modal") and bool(_p.get("frozen"))
				var choices := _drain()
				_check("talk_elder", btn and opened and modal and choices == 1 and int(_sq.call("st")) == 1 and not bool(_p.get("frozen")) and not _sq.is_in_group("ui_modal"),
					"btn=%s opened=%s modal=%s choices=%d st=%d" % [btn, opened, modal, choices, _sq.call("st")])
				_next()
		4: # ④ 가기
			if _frame == 1:
				_put(_sq.call("target_pos"))
			if _frame == 10:
				_check("go", int(_sq.call("st")) == 2, "st=%d" % _sq.call("st"))
				_next()
		5: # ⑤ 들판 보스
			if _frame == 1:
				_fb.call("boss", "gale_roc").call("_die")
			if _frame == 5:
				_check("boss", int(_sq.call("st")) == 3 and _fb.call("has_bloom", "gale_roc"), "st=%d" % _sq.call("st"))
				_next()
		6: # ⑥ 사공 → 임무 적
			if _frame == 1:
				_near_npc("ferryman")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				var n := (_sq.call("alive_quest_enemies") as Array).size()
				_check("talk_ferryman", int(_sq.call("st")) == 4 and n == 4, "st=%d enemies=%d" % [_sq.call("st"), n])
				_next()
		7: # ⑦ 다 쓰러뜨리기
			if _frame == 1:
				for e in _sq.call("alive_quest_enemies"):
					e.call("_die")
			if _frame == 5:
				_check("kill", int(_sq.call("st")) == 5, "st=%d" % _sq.call("st"))
				_next()
		8: # ⑧ 학자 → 제단
			if _frame == 1:
				_near_npc("scholar")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				var altar: Node = _sq.get("_altar")
				_check("talk_scholar", int(_sq.call("st")) == 6 and altar != null and _sq.is_in_group("element_receiver"), "st=%d" % _sq.call("st"))
				_next()
		9: # ⑨ 제단 밝히기 — 멀리서는 안 되고 곁에서 된다
			if _frame == 1:
				var ap: Vector3 = (_sq.get("_altar") as Node3D).global_position
				_sq.call("receive_element", ap + Vector3(20.0, 0.0, 0.0), 4.0, "water")
				_v = int(_sq.call("st"))
				get_tree().call_group("element_receiver", "receive_element", ap + Vector3(1.0, 0.0, 0.0), 4.0, "water")
			if _frame == 90:
				_check("light", int(_v) == 6 and int(_sq.call("st")) == 7, "far_st=%d st=%d" % [_v, _sq.call("st")])
				_next()
		10: # ⑩ 1장 끝
			if _frame == 1:
				_near_npc("elder")
			if _frame == 10:
				var knots := PartyState.count("fate_knot")
				_sq.call("interact")
				_drain()
				var tx: String = _sq.call("tracker_text")
				var ok: bool = int(_sq.call("ch")) == 1 and int(_sq.call("st")) == 0 and PartyState.count("fate_knot") == knots + 2 \
					and _sq.call("locked") and tx.contains("모험 등급 5") and _sq.call("target_pos") == Vector3.INF
				_check("chapter1_done", ok, "ch=%d knots %d→%d ar=%d tracker='%s'" % [_sq.call("ch"), knots, PartyState.count("fate_knot"), PartyState.level + 1, tx.replace("\n", " / ")])
				_next()
		11: # ⑪ 잠긴 동안은 혼잣말(그 전에 1장 경험으로 뜬 승급 3택 창을 닫는다 — 창이 떠 있으면 말을 안 건다)
			if _frame == 1:
				_v = not _sq.call("interact") if _visible_prompts() > 0 else true
				_dismiss_prompts()
				return
			if _frame < 6:
				_dismiss_prompts()
				return
			var blocked := bool(_v)
			var opened: bool = _sq.call("interact")
			var lines := (_sq.get("_dlg_lines") as Array).size()
			_drain()
			_check("locked_idle", blocked and opened and lines == 1 and int(_sq.call("ch")) == 1 and int(_sq.call("st")) == 0, "lines=%d" % lines)
			_next()
		12: # ⑫ 2장
			if _frame == 1:
				PartyState.exp = 400.0
				PartyState.level = 4 # 모험 등급 5
				PartyState.resin = Domains.RESIN_MAX
				PartyState.resin_t = Domains.now()
				_sq.call("_refresh")
				_near_npc("scholar")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				_put(_sq.call("target_pos"))
			if _frame == 20:
				_v = [int(_sq.call("st"))]
				_dm.call("enter", "weekly", 0)
			if _frame == 230:
				for e in _dm.call("alive_enemies"):
					e.call("_die")
			if _frame == 236:
				_v.append(int(_sq.call("st")))
				_dm.call("leave")
			if _frame == 250:
				_near_npc("elder")
			if _frame == 260:
				_sq.call("interact")
				_drain()
				## 3장은 모험 등급 7 — 2장 경험으로 이미 닿았을 수도 있다(잠겼으면 등급 글, 열렸으면 첫 단계 글).
				var tx: String = _sq.call("tracker_text")
				var ok: bool = int(_v[0]) == 2 and int(_v[1]) == 3 and int(_sq.call("ch")) == 2 and tx.contains("제3장") \
					and (tx.contains("모험 등급 7") if _sq.call("locked") else tx.contains("촌장")) \
					and PartyState.members.has("story_scholar") and not PartyState.members.has("story_wanderer")
				_check("chapter2", ok, "go_st=%d domain_st=%d ch=%d scholar_joined=%s" % [_v[0], _v[1], _sq.call("ch"), PartyState.members.has("story_scholar")])
				_next()
		13: # ⑬ 임무 목록
			if _frame < 6:
				_dismiss_prompts()
				return
			_sq.call("toggle_journal")
			var jt: String = _sq.call("journal_text")
			var open: bool = _sq.call("is_journal_open")
			_sq.call("toggle_journal")
			_check("journal", open and jt.contains("✔ 제1장") and jt.contains("✔ 제2장") and jt.contains("▶ 제3장") and not _sq.call("is_journal_open"),
				"text=%s" % jt.replace("\n", " / "))
			_next()
		14: # ⑭ 3장 촌장 대화 — 말하는 이 쪽 카메라
			var rig: Node3D = _p.get_node("CameraRig")
			if _frame == 1:
				PartyState.level = 6 # 모험 등급 7
				PartyState.exp = 600.0
				_sq.call("_refresh")
				_near_npc("elder")
				_v = {"basis": rig.transform.basis, "len": float(rig.get("spring_arm").spring_length)}
			if _frame == 10:
				_v.opened = bool(_sq.call("interact"))
			if _frame == 50:
				_v.npc_look = _looks_at(_sq.call("npc_pos", "elder"))
				_v.npc_side = String(_sq.call("speaker_side"))
				_v.in_talk = bool(rig.call("in_talk"))
				_line_next()
				_line_next() # 고르는 줄
			if _frame == 90:
				_v.me_look = _looks_at(_p.global_position)
				_v.me_side = String(_sq.call("speaker_side"))
				_drain()
			if _frame == 130:
				var back: bool = not bool(rig.call("in_talk")) and rig.transform.basis.is_equal_approx(_v.basis) \
					and absf(float(rig.get("spring_arm").spring_length) - float(_v.len)) < 0.01 and rig.position.is_equal_approx(rig.get("_rest_pos"))
				var ok: bool = bool(_v.opened) and bool(_v.in_talk) and float(_v.npc_look) > 0.97 and _v.npc_side == "npc" and float(_v.me_look) > 0.97 \
					and _v.me_side == "me" and back and int(_sq.call("ch")) == 2 and int(_sq.call("st")) == 1 and not bool(_p.get("frozen"))
				_check("talk_camera", ok, "npc_look=%.3f me_look=%.3f sides=%s/%s back=%s st=%d" % [_v.npc_look, _v.me_look, _v.npc_side, _v.me_side, back, _sq.call("st")])
				_next()
		15: # ⑮ 청하란 셋
			if _frame < 4:
				_dismiss_prompts()
				return
			var ga: Node = get_tree().get_first_node_in_group("go_gathering")
			var tx0: String = _sq.call("tracker_text")
			var t: Vector3 = _sq.call("target_pos")
			var near: Vector3 = ga.call("nearest", "orchid", _p.global_position)
			_sq.call("_on_gathered", "mint")
			var after_mint := int(_sq.call("gathered_count"))
			var picked := 0
			var mid := ""
			for row in Gathering.all_nodes():
				if row[1] == "orchid" and picked < 3 and ga.call("node_pos", row[0]) != Vector3.INF:
					ga.call("pick", row[0])
					picked += 1
					if picked == 2:
						mid = _sq.call("tracker_text")
			_check("gather", t != Vector3.INF and t.is_equal_approx(near) and tx0.contains("0/3") and after_mint == 0 and picked == 3 and mid.contains("2/3") \
				and int(_sq.call("st")) == 2, "picked=%d mint=%d st=%d tracker0='%s'" % [picked, after_mint, _sq.call("st"), tx0.replace("\n", " / ")])
			_next()
		16: # ⑯ 요리 한 번
			var ki: Node = get_tree().get_first_node_in_group("go_kitchen")
			var t: Vector3 = _sq.call("target_pos")
			var on_pot := false
			for pp in ki.call("pots"):
				on_pot = on_pot or t.is_equal_approx(pp)
			ki.emit_signal("cooked", "probe", 1)
			_check("cook", on_pot and int(_sq.call("st")) == 3, "on_pot=%s st=%d" % [on_pot, _sq.call("st")])
			_next()
		17: # ⑰ 사공
			if _frame == 1:
				_near_npc("ferryman")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				_check("ch3_ferryman", int(_sq.call("st")) == 4, "st=%d" % _sq.call("st"))
				_next()
		18: # ⑱ 잿불 도깨비왕
			if _frame == 1:
				_fb.call("boss", "ember_king").call("_die")
			if _frame == 5:
				_check("ch3_boss", int(_sq.call("st")) == 5, "st=%d" % _sq.call("st"))
				_next()
		19: # ⑲ 학자
			if _frame == 1:
				_near_npc("scholar")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				_check("ch3_scholar", int(_sq.call("st")) == 6 and (_sq.call("target_pos") as Vector3).is_equal_approx(_dm.call("gate_pos", "tomb")), "st=%d" % _sq.call("st"))
				_next()
		20: # ⑳ 잠든 무덤
			if _frame == 1:
				PartyState.resin = Domains.RESIN_MAX
				PartyState.resin_t = Domains.now()
				_put(_sq.call("target_pos"))
			if _frame == 20:
				_dm.call("enter", "tomb", 0)
			if _frame == 230 or _frame == 238: # 파도 둘
				for e in _dm.call("alive_enemies"):
					e.call("_die")
			if _frame == 244:
				_v = int(_sq.call("st"))
				_dm.call("leave")
			if _frame == 250:
				var n := (_sq.call("alive_quest_enemies") as Array).size()
				_check("ch3_domain", int(_v) == 7 and n == 4, "st=%d enemies=%d" % [_v, n])
				_next()
		21: # ㉑ 잔치 마당 졸개
			if _frame == 1:
				for e in _sq.call("alive_quest_enemies"):
					e.call("_die")
			if _frame == 5:
				_check("ch3_kill", int(_sq.call("st")) == 8, "st=%d" % _sq.call("st"))
				_next()
		22: # ㉒ 촌장 → 3장 끝
			if _frame == 1:
				_near_npc("elder")
			if _frame == 10:
				var knots := PartyState.count("fate_knot")
				_sq.call("interact")
				_drain()
				_v = knots
			if _frame < 16:
				return
			_dismiss_prompts()
			if _frame < 22:
				return
			_sq.call("toggle_journal")
			var jt: String = _sq.call("journal_text")
			_sq.call("toggle_journal")
			## 장 보상 3 — 장 경험으로 모험 등급이 5 의 배수를 넘으면 등급 보상 1 이 더 붙는다(data/adventure.gd AR_REWARD_5).
			var got := PartyState.count("fate_knot") - int(_v)
			var ok: bool = int(_sq.call("ch")) == 3 and (got == 3 or got == 4) and String(_sq.call("tracker_text")).contains("제4장") and jt.contains("✔ 제3장")
			_check("chapter3", ok, "ch=%d knots %d→%d" % [_sq.call("ch"), _v, PartyState.count("fate_knot")])
			_next()
		23: # ㉓ 4장 — 나그네 등장 조건·가면
			if _frame == 1:
				PartyState.level = 9 # 모험 등급 10
				PartyState.exp = 1500.0
				_sq.call("_refresh")
			if _frame < 4:
				_dismiss_prompts()
				return
			if _frame == 4:
				_v = [bool(_sq.call("npc_visible", "wanderer")), bool((_sq.get("_npcs")["wanderer"] as Node3D).visible)]
				_near_npc("elder")
			if _frame == 14:
				_sq.call("interact")
				_drain()
			if _frame == 20:
				var root: Node3D = _sq.get("_npcs")["wanderer"]
				var att := root.find_children("*", "BoneAttachment3D", true, false)
				## 가면이 얼굴 쪽(몸 앞 +Z)에 있는가 — 머리 뼈 자리보다 몸 앞으로 나와 있어야.
				var mask_n: Node3D = root.find_children("Mask", "Node3D", true, false)[0]
				var body_w: Node3D = root.get_node("Body")
				var mask_fwd := (mask_n.global_position - (att[0] as Node3D).global_position).dot(body_w.global_transform.basis.z.normalized())
				var ok: bool = not bool(_v[0]) and not bool(_v[1]) and int(_sq.call("ch")) == 3 and int(_sq.call("st")) == 1 and root.visible \
					and bool(_sq.call("has_mask", "wanderer")) and att.size() == 1 and mask_fwd > 0.05 \
					and (_sq.call("target_pos") as Vector3).is_equal_approx(_sq.call("npc_pos", "wanderer"))
				_check("wanderer_appears", ok, "before=%s/%s st=%d visible=%s mask=%s on_head=%d mask_fwd=%.3f" % [_v[0], _v[1], _sq.call("st"), root.visible, _sq.call("has_mask", "wanderer"), att.size(), mask_fwd])
				_next()
		24: # ㉔ 나그네 대화 → 따라가기
			if _frame == 1:
				_near_npc("wanderer")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				var ok: bool = int(_sq.call("st")) == 2 and _sq.call("near_npc") == "" and not bool(_sq.call("interact"))
				_check("wanderer_talk", ok, "st=%d near='%s'" % [_sq.call("st"), _sq.call("near_npc")])
				_next()
		25: # ㉕ 따라가기 — 멀면 기다림, 가까우면 길 끝까지
			var w: Vector3 = _sq.call("npc_pos", "wanderer")
			if _frame == 1:
				_sq.set("follow_speed_mul", 20.0)
				_v = {"start": w}
			if _frame < 40: # 40m 밖 — 서서 기다린다
				_put(w + Vector3(40.0, 0.0, 0.0))
				return
			if _frame == 40:
				_v.waited = w.is_equal_approx(_v.start)
				_v.far_text = String(_sq.call("tracker_text")).contains("너무 멀다")
			if int(_sq.call("st")) == 2 and _frame < 1200:
				## 다리 칸(격자 5,7) 위에서는 강바닥이 아니라 상판 위를 걷는가.
				var g := TestMap.world_pos(5.0, 7.0, "village")
				if absf(w.z - g.z) < 10.0 and absf(w.x - g.x) < 10.0:
					_v.bridge_lift = maxf(float(_v.get("bridge_lift", -99.0)), w.y - TerrainBuilder.height_at("village", w))
				_put(w + Vector3(0.0, 0.0, 3.0))
				return
			var path: Array = Story.CHAPTERS[3].steps[2].path
			var end := TestMap.world_pos(path[path.size() - 1].x, path[path.size() - 1].y, "village")
			var at_end := Vector2(w.x - end.x, w.z - end.z).length() < 0.1
			_sq.set("follow_speed_mul", 1.0)
			var lift := float(_v.get("bridge_lift", -99.0))
			_check("follow", bool(_v.waited) and bool(_v.far_text) and int(_sq.call("st")) == 3 and at_end and lift > 1.5,
				"waited=%s far_text=%s st=%d at_end=%s bridge_lift=%.2f frames=%d" % [_v.waited, _v.far_text, _sq.call("st"), at_end, lift, _frame])
			_next()
		26: # ㉖ 나그네 → 들녘 졸개
			if _frame == 1:
				_near_npc("wanderer")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				var n := (_sq.call("alive_quest_enemies") as Array).size()
				_check("ambush", int(_sq.call("st")) == 4 and n == 4, "st=%d enemies=%d" % [_sq.call("st"), n])
				_next()
		27: # ㉗ 다 쓰러뜨리기
			if _frame == 1:
				for e in _sq.call("alive_quest_enemies"):
					e.call("_die")
			if _frame == 5:
				_check("ch4_kill", int(_sq.call("st")) == 5, "st=%d" % _sq.call("st"))
				_next()
		28: # ㉘ 나그네 → 사라짐
			if _frame == 1:
				_near_npc("wanderer")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 12:
				var root: Node3D = _sq.get("_npcs")["wanderer"]
				_check("wanderer_leaves", int(_sq.call("st")) == 6 and not root.visible and not bool(_sq.call("npc_visible", "wanderer")), "st=%d visible=%s" % [_sq.call("st"), root.visible])
				_next()
		29: # ㉙ 학자
			if _frame == 1:
				_near_npc("scholar")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				_check("ch4_scholar", int(_sq.call("st")) == 7, "st=%d" % _sq.call("st"))
				_next()
		30: # ㉚ 촌장 → 4장 끝
			if _frame == 1:
				_near_npc("elder")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame < 16:
				return
			_dismiss_prompts()
			if _frame < 22:
				return
			_sq.call("toggle_journal")
			var jt: String = _sq.call("journal_text")
			_sq.call("toggle_journal")
			var ok: bool = int(_sq.call("ch")) == 4 and jt.contains("✔ 제4장") and jt.contains("제5장")
			_check("chapter4", ok, "ch=%d tracker='%s'" % [_sq.call("ch"), _sq.call("tracker_text")])
			_next()
		31: # ㉛ 5장 잠김 → 풀림, 학자가 옛길 어귀로
			var home: Vector3 = TestMap.world_pos(Story.NPCS.scholar.cell.x, Story.NPCS.scholar.cell.y, "ruins")
			var sta: Vector2 = Story.STATIONS.scholar[0].cell
			var sta_w := TestMap.world_pos(sta.x, sta.y, "village")
			if _frame == 1:
				PartyState.exp = 1050.0 # 모험 등급 11
				PartyState.level = 10
			if _frame == 4:
				var sp: Vector3 = _sq.call("npc_pos", "scholar")
				_v = [bool(_sq.call("locked")), String(_sq.call("tracker_text")).contains("모험 등급 12"), _flat(sp, home) < 0.1]
				PartyState.exp = 1150.0 # 모험 등급 12
				PartyState.level = 11
			if _frame == 8:
				var sp: Vector3 = _sq.call("npc_pos", "scholar")
				var t: Vector3 = _sq.call("target_pos")
				var clear := _trunk_clear()
				var pet := _pet_clear()
				var ok: bool = bool(_v[0]) and bool(_v[1]) and bool(_v[2]) and not bool(_sq.call("locked")) and _flat(sp, sta_w) < 0.1 \
					and t.is_equal_approx(_sq.call("npc_pos", "elder")) and String(_sq.call("tracker_text")).contains("제5장") and float(clear[0]) >= 1.5 and float(pet[0]) > 0.0
				_check("ch5_unlock", ok, "locked=%s lock_text=%s at_home=%s scholar_at_road=%.2f trunk_min=%.2f@%s pet_margin=%.1f@%s" % [_v[0], _v[1], _v[2], _flat(sp, sta_w), clear[0], clear[1], pet[0], pet[1]])
				_next()
		32: # ㉜ 촌장 → 옛길 어귀 → 학자 둘레 졸개 넷
			if _frame == 1:
				_near_npc("elder")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				_v = int(_sq.call("st"))
				var go: Dictionary = Story.CHAPTERS[4].steps[1]
				_put(TestMap.world_pos(go.cell.x, go.cell.y, "village") + Vector3(0.0, TerrainBuilder.height_at("village", TestMap.world_pos(go.cell.x, go.cell.y, "village")), 0.0))
			if _frame == 16:
				var n := (_sq.call("alive_quest_enemies") as Array).size()
				_check("ch5_road", int(_v) == 1 and int(_sq.call("st")) == 2 and n == 4, "talk_st=%d st=%d enemies=%d" % [_v, _sq.call("st"), n])
				_next()
		33: # ㉝ 다 쓰러뜨리기
			if _frame == 1:
				for e in _sq.call("alive_quest_enemies"):
					e.call("_die")
			if _frame == 5:
				_check("ch5_kill_road", int(_sq.call("st")) == 3, "st=%d" % _sq.call("st"))
				_next()
		34: # ㉞ 학자(옛길) → 제단·석등, 학자는 제단 곁으로
			if _frame == 1:
				_near_npc("scholar")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 14:
				var sp: Vector3 = _sq.call("npc_pos", "scholar")
				var b: Vector2 = Story.STATIONS.scholar[1].cell
				var lamps := 0
				var seal: Dictionary = Story.CHAPTERS[4].steps[4]
				var alt_y := TerrainBuilder.height_at("village", TestMap.world_pos(seal.cell.x, seal.cell.y, "village"))
				var dy := 0.0 # 석등이 제단과 같은 땅(절벽 턱 위·아래가 아닌가)
				for m in Story.SEAL_LAYOUT:
					var lp: Vector3 = _sq.call("seal_lamp_pos", m)
					if lp != Vector3.INF:
						lamps += 1
						dy = maxf(dy, absf(lp.y - alt_y))
				_put(TestMap.world_pos(seal.cell.x, seal.cell.y, "village") + Vector3(3.0, TerrainBuilder.height_at("village", TestMap.world_pos(seal.cell.x, seal.cell.y, "village")), 0.0))
				var sight: Node = get_tree().get_first_node_in_group("go_elemental_sight")
				var hint := false
				if sight:
					sight.call("rescan")
					var sun: Vector3 = _sq.call("seal_lamp_pos", "sun")
					for t in sight.get("targets"):
						hint = hint or (t.kind == "torch" and _flat(t.pos, sun) < 0.1)
				var tx: String = _sq.call("tracker_text")
				var ok: bool = int(_sq.call("st")) == 4 and lamps == 3 and _sq.is_in_group("element_receiver") and _flat(sp, TestMap.world_pos(b.x, b.y, "village")) < 0.1 \
					and tx.contains("0/3") and tx.contains("해 → 달 → 별") and hint and dy < 1.0
				_check("ch5_seal_ready", ok, "st=%d lamps=%d dy=%.2f recv=%s scholar_b=%.2f hint=%s tracker='%s'" % [_sq.call("st"), lamps, dy, _sq.is_in_group("element_receiver"), _flat(sp, TestMap.world_pos(b.x, b.y, "village")), hint, tx.replace("\n", " / ")])
				_next()
		35: # ㉟ 석등 차례 — 먼저가 아닌 것·틀린 차례·폭발은 다음 것만
			var seal: Dictionary = Story.CHAPTERS[4].steps[4]
			var center := TestMap.world_pos(seal.cell.x, seal.cell.y, "village")
			if _frame == 1:
				_v = []
				_sq.call("receive_element", _sq.call("seal_lamp_pos", "moon"), 4.0, "fire") # 달이 먼저가 아니다
				_v.append(int(_sq.call("seal_lit")))
				_sq.call("receive_element", _sq.call("seal_lamp_pos", "sun"), 4.0, "water")
				_v.append(int(_sq.call("seal_lit")))
				_sq.call("receive_element", _sq.call("seal_lamp_pos", "star"), 4.0, "fire") # 달 앞에 별 — 다 꺼짐
				_v.append(int(_sq.call("seal_lit")))
				_sq.call("receive_element", center, 7.0, "thunder") # 폭발이 셋에 다 닿아도 해만
				_v.append(int(_sq.call("seal_lit")))
				_sq.call("receive_element", _sq.call("seal_lamp_pos", "moon"), 4.0, "ice")
				_sq.call("receive_element", _sq.call("seal_lamp_pos", "star"), 4.0, "wind")
				_v.append(int(_sq.call("seal_lit")))
				_v.append(int(_sq.call("st")))
			if _frame == 80:
				var n := (_sq.call("alive_quest_enemies") as Array).size()
				var ok: bool = _v == [0, 1, 0, 1, 3, 4] and int(_sq.call("st")) == 5 and n == 5 and not _sq.is_in_group("element_receiver")
				_check("ch5_seal", ok, "lit=%s st=%d enemies=%d" % [_v, _sq.call("st"), n])
				_next()
		36: # ㊱ 다 쓰러뜨리기 → 나그네가 제단 곁에
			if _frame == 1:
				for e in _sq.call("alive_quest_enemies"):
					e.call("_die")
			if _frame == 5:
				var root: Node3D = _sq.get("_npcs")["wanderer"]
				var post: Dictionary = Story.NPCS.wanderer.appear[1]
				var d := _flat(_sq.call("npc_pos", "wanderer"), TestMap.world_pos(post.cell.x, post.cell.y, "village"))
				var ok: bool = int(_sq.call("st")) == 6 and root.visible and bool(_sq.call("npc_visible", "wanderer")) and d < 0.1 \
					and (_sq.call("target_pos") as Vector3).is_equal_approx(_sq.call("npc_pos", "wanderer"))
				_check("ch5_wanderer", ok, "st=%d visible=%s d=%.2f" % [_sq.call("st"), root.visible, d])
				_next()
		37: # ㊲ 나그네 → 사라짐
			if _frame == 1:
				_near_npc("wanderer")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 12:
				var root: Node3D = _sq.get("_npcs")["wanderer"]
				_check("ch5_wanderer_leaves", int(_sq.call("st")) == 7 and not root.visible, "st=%d visible=%s" % [_sq.call("st"), root.visible])
				_next()
		38: # ㊳ 학자(제단 곁) → 폐허로 돌아감
			if _frame == 1:
				_near_npc("scholar")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 12:
				var home: Vector3 = TestMap.world_pos(Story.NPCS.scholar.cell.x, Story.NPCS.scholar.cell.y, "ruins")
				var d := _flat(_sq.call("npc_pos", "scholar"), home)
				_check("ch5_scholar", int(_sq.call("st")) == 8 and d < 0.1, "st=%d home_d=%.2f" % [_sq.call("st"), d])
				_next()
		39: # ㊴ 촌장 → 5장 끝
			if _frame == 1:
				_near_npc("elder")
				_v = PartyState.count("fate_knot")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame < 16:
				return
			_dismiss_prompts()
			if _frame < 22:
				return
			_sq.call("toggle_journal")
			var jt: String = _sq.call("journal_text")
			_sq.call("toggle_journal")
			var joined := PartyState.members.has("story_wanderer") and PartyState.members.count("story_scholar") == 1
			## 이 기능 전에 장을 끝낸 세이브 — 둘 다 빼고 불러올 때처럼 _join_past, 한 번 더 불러도 겹치지 않음.
			for id in Story.MEMBERS:
				PartyState.members.erase(id)
			_sq.call("_join_past")
			_sq.call("_join_past")
			var past := PartyState.members.count("story_scholar") == 1 and PartyState.members.count("story_wanderer") == 1
			var ok: bool = int(_sq.call("ch")) == 5 and jt.contains("✔ 제5장") and jt.contains("제6장") \
				and PartyState.count("fate_knot") == int(_v) + 3 and joined and past
			_check("chapter5", ok, "ch=%d knots %d→%d joined=%s past=%s tracker='%s'" % [_sq.call("ch"), _v, PartyState.count("fate_knot"), joined, past, _sq.call("tracker_text")])
			_next()
