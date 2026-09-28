extends Node
## GO 이야기 임무(106장 ㉕) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_STORY_PROBE 가 있을 때만 단다.
##
##   SAGA_STORY_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 표(장 둘·인물·보스·비경 id) ② 처음 — 추적 글자·목표 = 촌장 ③ 촌장 대화(고르는 줄 포함) → 다음 단계·멈춤 풀림
## ④ 그 자리 가기 ⑤ 들판 보스 쓰러뜨리기 ⑥ 사공 대화 → 임무 적 넷 ⑦ 다 쓰러뜨리기 ⑧ 학자 대화 → 제단
## ⑨ 원소로 제단 밝히기 ⑩ 촌장 → 1장 끝·보상·2장은 모험 등급 5 에 잠김 ⑪ 잠긴 동안은 혼잣말만
## ⑫ 2장 — 학자·제단 가기·주간 보스 비경 깨기·촌장 → 3장은 모험 등급 7 에 잠김 ⑬ 임무 목록(O).
## 106장 ㉗ 3장·대화 카메라: ⑭ 촌장 대화 — 인물이 말하면 카메라가 인물 얼굴을, 고르는 줄·내 대답이면 내 얼굴을 잡고, 끝나면 원래 시점
## ⑮ 청하란 셋 캐기(다른 채집물은 안 셈, 목표 = 가까운 청하란) ⑯ 요리 한 번(목표 = 가까운 솥) ⑰ 사공 ⑱ 잿불 도깨비왕 ⑲ 학자
## ⑳ 잠든 무덤 깨기 ㉑ 잔치 마당 졸개 넷 ㉒ 촌장 → 3장 끝·보상·목록 ✔ 제3장.
## 106장 ㉘ 4장: ㉓ 나그네는 4장 둘째 단계부터만 서 있고 가면이 머리 뼈에 붙음 ㉔ 나그네 대화 → 따라가기, 앞장선 동안은 말 못 검
## ㉕ 따라가기 — 멀면 서서 기다리고 "너무 멀다", 가까우면 길 끝까지 걷고 다음 단계 ㉖ 나그네 → 들녘 졸개 넷 ㉗ 다 쓰러뜨리기
## ㉘ 나그네 → 사라짐(길 끝 자리) ㉙ 학자 ㉚ 촌장 → 4장 끝·다 끝남·목록 ✔ 제4장.
## 106장 ㉚ 5장: ㉛ 잠긴 동안 학자는 폐허, 풀리면 옛길 어귀로 옮겨 서고 둘레 나무 줄기에 안 걸림 ㉜ 촌장 → 옛길 어귀 → 학자 둘레 졸개 넷
## ㉝ 다 쓰러뜨리기 ㉞ 학자(옛길) → 제단·석등 셋, 학자는 제단 곁으로, 원소 시야가 다음 석등을 짚음 ㉟ 석등 차례(틀리면 다 꺼짐·폭발이 셋에 닿아도 다음 것만) → 가면 무리 다섯
## ㊱ 다 쓰러뜨리기 → 나그네가 제단 곁에 ㊲ 나그네 → 사라짐 ㊳ 학자 → 폐허로 ㊴ 촌장 → 5장 끝·다 끝남·목록 ✔ 제5장.
## 106장 ㉜ 6장: ㊵ 풀림·새 자리 여유(신수 원·바위) ㊶ 학자 → 봉우리 목표 ㊷ 골짜기에선 안 넘어가고 꼭대기에 서면 넘어감·나그네가 봉우리에
## ㊸ 나그네 → 검은 가면(이야기 보스·가면·위 보스 막대) ㊹ 그림자(등 뒤로 옮겨 붙음)·절반에서 방패+졸개 둘·쓰러뜨리면 졸개도 흩어짐 ㊺ 나그네 → 제단·학자 봉우리로
## ㊻ 제단 ㊼ 학자 ㊽ 촌장 → 6장 끝·✔ 제6장·추적 글자는 제7장.
## 106장 ㉞ 7장: [49] 풀림·곶 자리(신수 원 여유·제단·나그네·물결 나오는 자리가 다 뭍) [50] 학자 → 사공 [51] 사공 → 곶 [52] 곶 가기 → 나그네
## [53] 나그네 → 제단 지키기, 멀면 물결이 안 나옴 [54] 가까이 오면 첫 물결 셋, 무리가 제단으로 가서 친다 [55] 시간이 지나면·다 잡으면 다음 물결
## [56] 제단이 무너지면 처음부터(쉬는 틈) → 세 물결 다 잡으면 금 간 검은 가면(가면에 금·물·위 보스 막대) [57] 밀물 원 넷이 나를 향해 줄지어·2단계 물 방패+졸개 둘
## [58] 나그네 → 제단 [59] 제단 [60] 사공 [61] 촌장 → 7장 끝·다 끝남·✔ 제7장.
## 106장 ㊲ 8장: [62] 풀림·바위섬 지형(꼭대기 높이·배 댄 자리 물 위·옮긴 별조각은 물 위)·자리가 다 뭍·도둑 길 사건 여유·도둑 평균 속도가 걷기~달리기 사이
## [63] 촌장 → 사공 [64] 사공 → 도둑(가까우면 달아남) [65] 놓치면 처음 자리로·따라잡으면 끝 [66] 사공 → 배 [67] 배 — 섬에 내리고 신상이 켜짐·사공도 섬에
## [68] 섬 꼭대기 무리 [69] 나그네 → 석등(뭍) [70] 별→달→해 → 해솔(가면에 금) [71] 해솔 → 사라짐 [72] 나그네 → 배 [73] 배 — 포구로 [74] 촌장 → 8장 끝·✔ 제8장.
## 106장 ㊳ 9장: [75] 풀림·구름섬 자리(밑 지형·기둥 둘레·기둥~섬 틈·들판 적 여유)·바람 기둥·먹구름 [76] 학자 → 봉우리 [77] 꼭대기(땅에선 안 뜸)·나그네
## [78] 나그네 → 구름섬 목표·나그네는 섬 위 [79] 바람 기둥 — 공중이면 저절로 활공·솟음·섬 윗면보다 위로, 접으면 다시 안 폄, 섬에 서면 넘어감
## [80] 섬 무리(떨어지면 제자리로) [81] 먹구름 가면 해솔(금·2단계 졸개 둘) → 가면 벗은 해솔 [82] 먹구름 임금(1.9배·왕관)·고리(곁·바깥은 안 맞음)
## [83] 나그네 [84] 해솔 → 마을 목표 [85] 마을에 내려오면 넘어감 [86] 촌장 → 9장 끝·해솔 합류·먹구름 걷힘·✔ 제9장.
## 106장 ㉟ 이야기 동료 둘 더: ㊽ 6장 끝에 촌장·[61] 7장 끝에 사공이 명단에(이미 지난 장이면 불러올 때 조용히).
## 106장 ㉛ 이야기 동료: ⑫ 2장 끝에 학자 은비·㊴ 5장 끝에 나그네가 명단에(이미 지난 장이면 불러올 때 조용히).
## 106장 ㉙ 대화 몸짓: ㊾ 글자 흘리기·입 모양(한글 모음 → 입 다섯)·말하는 동안 오른손이 앞·위로·F 한 번이면 줄 전체·끝나면 손·입 제자리·표정·눈 깜박임.
## 저장은 안 한다(부대 경험·이야기 상태는 메모리에서만 바꾸고 끝에 되돌린다).

const Story := preload("res://games/saga_go/data/story.gd")
const FieldBosses := preload("res://games/saga_go/world/field_bosses.gd")
const Domains := preload("res://games/saga_go/data/domains.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const Cooking := preload("res://games/saga_go/data/cooking.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const Gathering := preload("res://games/saga_go/world/gathering.gd")
const Veg := preload("res://games/saga_go/world/vegetation_builder.gd")
const SkyIsle := preload("res://games/saga_go/world/sky_isle.gd")

var _p: CharacterBody3D
var _sq: Node
var _fb: Node
var _dm: Node
var _frame := 0
var _step := 0
var _fails := 0
var _v: Variant = null
var _saved := {}
var _boss: Node = null # 6장 이야기 보스(㊸~㊹)

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _sq == null:
		_sq = get_tree().get_first_node_in_group("go_story")
		_fb = get_tree().get_first_node_in_group("go_field_bosses")
		_dm = get_tree().get_first_node_in_group("go_domains")
		_frame = 0
		return
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
		40: # ㊵ 6장 풀림·새 자리 여유
			if _frame == 1:
				PartyState.exp = 1400.0 # 모험 등급 15
				PartyState.level = 14
			if _frame == 6:
				var home: Vector3 = TestMap.world_pos(Story.NPCS.scholar.cell.x, Story.NPCS.scholar.cell.y, "ruins")
				var pet := _pet_clear(_ch6_spots())
				var rock := _rock_clear(_ch6_spots())
				var peak_h := TerrainBuilder.height_at("village", TestMap.world_pos(7.1, 1.5, "village"))
				var ok: bool = not bool(_sq.call("locked")) and (_sq.call("target_pos") as Vector3).is_equal_approx(_sq.call("npc_pos", "scholar")) \
					and _flat(_sq.call("npc_pos", "scholar"), home) < 0.1 and float(pet[0]) > 0.0 and float(rock[0]) >= 3.0 and peak_h > 8.0
				_check("ch6_unlock", ok, "locked=%s pet_margin=%.1f@%s rock_min=%.1f@%s peak_h=%.1f" % [_sq.call("locked"), pet[0], pet[1], rock[0], rock[1], peak_h])
				_next()
		41: # ㊶ 학자 → 봉우리
			if _frame == 1:
				_near_npc("scholar")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				var c: Dictionary = Story.CHAPTERS[5].steps[1]
				var ok: bool = int(_sq.call("st")) == 1 and _flat(_sq.call("target_pos"), TestMap.world_pos(c.cell.x, c.cell.y, "village")) < 0.1 \
					and String(_sq.call("tracker_text")).contains("벽 타기")
				_check("ch6_scholar", ok, "st=%d tracker='%s'" % [_sq.call("st"), String(_sq.call("tracker_text")).replace("\n", " / ")])
				_next()
		42: # ㊷ 골짜기(봉우리 밑)에선 안 넘어가고, 꼭대기에 서면 넘어감
			var c: Dictionary = Story.CHAPTERS[5].steps[1]
			var peak := TestMap.world_pos(c.cell.x, c.cell.y, "village")
			if _frame == 1:
				_put(TestMap.world_pos(5.0, 1.2, "village") + Vector3.UP * 0.5)
			if _frame == 20:
				_v = [int(_sq.call("st"))]
				_put(Vector3(peak.x, TerrainBuilder.height_at("village", peak) + 1.0, peak.z))
			if _frame == 40:
				var post: Dictionary = Story.NPCS.wanderer.appear[2]
				var d := _flat(_sq.call("npc_pos", "wanderer"), TestMap.world_pos(post.cell.x, post.cell.y, "village"))
				var ok: bool = int(_v[0]) == 1 and int(_sq.call("st")) == 2 and bool(_sq.call("npc_visible", "wanderer")) and d < 0.1
				_check("ch6_climb", ok, "gorge_st=%d st=%d wanderer=%s d=%.2f" % [_v[0], _sq.call("st"), _sq.call("npc_visible", "wanderer"), d])
				_next()
		43: # ㊸ 나그네 → 검은 가면
			if _frame == 1:
				_near_npc("wanderer")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 40:
				var bosses := get_tree().get_nodes_in_group("go_story_boss")
				var boss: Node3D = bosses[0] if bosses.size() == 1 else null
				var fbn: Node = get_tree().get_first_node_in_group("go_field_bosses")
				var hud: String = fbn.call("hud_text") if fbn else ""
				var ok: bool = int(_sq.call("st")) == 3 and boss != null and not boss.find_children("Mask", "Node3D", true, false).is_empty() \
					and (_sq.call("target_pos") as Vector3).is_equal_approx(boss.global_position) and hud.contains("검은 가면")
				_check("ch6_boss", ok, "st=%d bosses=%d hud='%s'" % [_sq.call("st"), bosses.size(), hud])
				_boss = boss
				_next()
		44: # ㊹ 그림자·2단계 졸개·쓰러뜨리기
			var boss: Node = _boss
			if _frame == 1:
				_v = {}
				_p.call("face_toward", _p.global_position + Vector3(0.0, 0.0, -5.0)) # 북쪽을 보게 — 그림자는 남쪽(등 뒤)에
				boss.call("begin_skill", "shadow", _p)
				var rel: Vector3 = (boss as Node3D).global_position - _p.global_position
				rel.y = 0.0
				_v.behind = rel.length()
				_v.back = rel.normalized().dot(Vector3(0.0, 0.0, 1.0))
				_v.marks = (boss.get("_marks") as Array).size()
			if _frame == 2: # 절벽 밑으로 떨어진 셈 — 봉우리로 되돌아와야
				(boss as Node3D).global_position = (boss.get("home") as Vector3) + Vector3(6.0, -9.0, 0.0)
			if _frame == 5:
				_v.back_home = ((boss as Node3D).global_position - (boss.get("home") as Vector3)).length() < 1.0
				boss.set("hp", float(boss.get("max_hp")) * 0.45)
			if _frame == 10:
				_v.phase = int(boss.get("phase"))
				_v.shield = float(boss.get("shield"))
				_v.summons = (boss.get("summoned") as Array).filter(func(m: Variant) -> bool: return is_instance_valid(m)).size()
				_v.summon_list = boss.get("summoned")
				boss.call("_die")
			if _frame == 16:
				var left := 0
				for m in _v.summon_list:
					if is_instance_valid(m):
						left += 1
				var ok: bool = bool(_v.back_home) and absf(float(_v.behind) - 2.2) < 0.3 and float(_v.back) > 0.9 and int(_v.marks) == 1 and int(_v.phase) == 2 and float(_v.shield) > 0.0 \
					and int(_v.summons) == 2 and left == 0 and int(_sq.call("st")) == 4 and get_tree().get_nodes_in_group("go_story_boss").is_empty()
				_check("ch6_duel", ok, "back_home=%s behind=%.2f back=%.2f marks=%d phase=%d shield=%.0f summons=%d left=%d st=%d" % [_v.back_home, _v.behind, _v.back, _v.marks, _v.phase, _v.shield, _v.summons, left, _sq.call("st")])
				_next()
		45: # ㊺ 나그네 → 제단, 학자가 봉우리로
			if _frame == 1:
				_dismiss_prompts()
				_near_npc("wanderer")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 14:
				var sta: Vector2 = Story.STATIONS.scholar[2].cell
				var d := _flat(_sq.call("npc_pos", "scholar"), TestMap.world_pos(sta.x, sta.y, "village"))
				var ok: bool = int(_sq.call("st")) == 5 and not bool(_sq.call("npc_visible", "wanderer")) and _sq.get("_altar") != null and d < 0.1
				_check("ch6_after_duel", ok, "st=%d wanderer=%s altar=%s scholar_d=%.2f" % [_sq.call("st"), _sq.call("npc_visible", "wanderer"), _sq.get("_altar") != null, d])
				_next()
		46: # ㊻ 제단
			if _frame == 1:
				var alt: Node3D = _sq.get("_altar")
				_sq.call("receive_element", alt.global_position, 4.0, "ice")
			if _frame == 80:
				_check("ch6_light", int(_sq.call("st")) == 6, "st=%d" % _sq.call("st"))
				_next()
		47: # ㊼ 학자(봉우리)
			if _frame == 1:
				_near_npc("scholar")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				_check("ch6_scholar_peak", int(_sq.call("st")) == 7, "st=%d" % _sq.call("st"))
				_next()
		48: # ㊽ 촌장 → 6장 끝
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
			## 6장 보상 경험으로 모험 등급 18 이 돼 7장이 바로 열린다.
			var ok: bool = int(_sq.call("ch")) == 6 and String(_sq.call("tracker_text")).contains("제7장") and jt.contains("✔ 제6장") \
				and PartyState.count("fate_knot") == int(_v) + 4 and PartyState.members.count("story_elder") == 1
			_check("chapter6", ok, "ch=%d knots %d→%d elder=%s tracker='%s'" % [_sq.call("ch"), _v, PartyState.count("fate_knot"), PartyState.members.has("story_elder"), String(_sq.call("tracker_text")).replace("\n", " / ")])
			_next()
		49: # [49] 7장 풀림·곶 자리
			if _frame == 1:
				PartyState.exp = 1700.0 # 모험 등급 18
				PartyState.level = 17
			if _frame == 6:
				var spots := _ch7_spots()
				var pet := _pet_clear(spots)
				var wet := ""
				for k in spots:
					if TerrainBuilder.height_at("coast", spots[k]) < TerrainBuilder.WATER_LEVEL + 0.3:
						wet += k + " "
				var ev := _coast_event_clear(spots)
				var ok: bool = not bool(_sq.call("locked")) and (_sq.call("target_pos") as Vector3).is_equal_approx(_sq.call("npc_pos", "scholar")) \
					and float(pet[0]) > 0.0 and float(ev[0]) > 5.0 and wet == "" and not bool(_sq.call("npc_visible", "wanderer"))
				_check("ch7_unlock", ok, "locked=%s pet_margin=%.1f@%s event_margin=%.1f@%s wet='%s' wanderer=%s" % [_sq.call("locked"), pet[0], pet[1], ev[0], ev[1], wet, _sq.call("npc_visible", "wanderer")])
				_next()
		50: # [50] 학자 → 사공
			if _frame == 1:
				_near_npc("scholar")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				var ok: bool = int(_sq.call("st")) == 1 and (_sq.call("target_pos") as Vector3).is_equal_approx(_sq.call("npc_pos", "ferryman"))
				_check("ch7_scholar", ok, "st=%d" % _sq.call("st"))
				_next()
		51: # [51] 사공 → 곶
			if _frame == 1:
				_near_npc("ferryman")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				var c: Dictionary = Story.CHAPTERS[6].steps[2]
				var ok: bool = int(_sq.call("st")) == 2 and _flat(_sq.call("target_pos"), TestMap.world_pos(c.cell.x, c.cell.y, "coast")) < 0.1
				_check("ch7_ferryman", ok, "st=%d" % _sq.call("st"))
				_next()
		52: # [52] 곶 가기 → 나그네
			if _frame == 1:
				_put(_sq.call("target_pos"))
			if _frame == 10:
				var post: Dictionary = Story.NPCS.wanderer.appear[3]
				var d := _flat(_sq.call("npc_pos", "wanderer"), TestMap.world_pos(post.cell.x, post.cell.y, "coast"))
				var ok: bool = int(_sq.call("st")) == 3 and bool(_sq.call("npc_visible", "wanderer")) and d < 0.1
				_check("ch7_cape", ok, "st=%d wanderer=%s d=%.2f" % [_sq.call("st"), _sq.call("npc_visible", "wanderer"), d])
				_next()
		53: # [53] 나그네 → 제단 지키기, 멀리 있으면 물결이 안 나옴
			if _frame == 1:
				_near_npc("wanderer")
			if _frame == 10:
				_v = {"near": String(_sq.call("near_npc")), "prompts": _visible_prompts(), "pnames": str(get_tree().get_nodes_in_group("ui_modal").filter(func(n: Node) -> bool: return n != _sq and n.get("visible") != false).map(func(n: Node) -> String: return String(n.name) + ":" + String(n.get_script().resource_path.get_file() if n.get_script() else ""))), "opened": bool(_sq.call("interact"))}
				_drain()
				_put(TestMap.world_pos(4.4, 4.3, "coast") + Vector3.UP * 0.5) # 포구 신상 — 제단에서 96m
			if _frame == 30:
				var alt: Node3D = _sq.get("_altar")
				var ok: bool = int(_sq.call("st")) == 4 and alt != null and alt.has_method("siege_hit") and int(_sq.call("defend_wave")) == -1 \
					and _sq.call("quest_enemies").is_empty() and String(_sq.call("tracker_text")).contains("제단 곁으로") \
					and not _sq.is_in_group("element_receiver") and float(_sq.call("defend_hp")) > 0.0
				_check("ch7_defend_wait", ok, "near=%s prompts=%d %s opened=%s st=%d wave=%d enemies=%d hp=%.0f tracker='%s'" % [_v.near, _v.prompts, _v.pnames, _v.opened, _sq.call("st"), _sq.call("defend_wave"), _sq.call("quest_enemies").size(), _sq.call("defend_hp"), String(_sq.call("tracker_text")).replace("\n", " / ")])
				_next()
		54: # [54] 가까이 오면 첫 물결 — 무리가 제단으로 가서 친다(나는 20m 떨어져 구경)
			var alt: Node3D = _sq.get("_altar")
			if _frame == 1:
				_put(alt.global_position + Vector3(0.0, 0.5, 20.0))
			if _frame == 5:
				var es: Array = _sq.call("alive_quest_enemies")
				_v = {"n": es.size(), "siege": es.all(func(e: Variant) -> bool: return e.get("siege") == alt), "hp0": float(_sq.call("defend_hp"))}
			if _frame == 900 or (_frame > 5 and float(_sq.call("defend_hp")) < float(_v.hp0)):
				var ok: bool = int(_sq.call("defend_wave")) == 0 and int(_v.n) == 3 and bool(_v.siege) and float(_sq.call("defend_hp")) < float(_v.hp0) \
					and String(_sq.call("tracker_text")).contains("물결 1/3")
				_check("ch7_defend_wave1", ok, "wave=%d n=%d siege=%s hp %.0f→%.0f frame=%d" % [_sq.call("defend_wave"), _v.n, _v.siege, _v.hp0, _sq.call("defend_hp"), _frame])
				_next()
		55: # [55] 시간이 지나면 다음 물결(앞 물결이 남아 있어도), 다 잡으면 그다음
			if _frame == 1:
				_sq.set("_wave_t", Story.DEFEND_WAVE_SEC)
			if _frame == 4:
				_v = {"w1": int(_sq.call("defend_wave")), "n1": (_sq.call("alive_quest_enemies") as Array).size()}
				for e in _sq.call("alive_quest_enemies"):
					e.call("_die")
			if _frame == 8:
				var ok: bool = int(_v.w1) == 1 and int(_v.n1) == 7 and int(_sq.call("defend_wave")) == 2 and (_sq.call("alive_quest_enemies") as Array).size() == 4 and int(_sq.call("st")) == 4
				_check("ch7_defend_waves", ok, "timer→wave %d alive %d · cleared→wave %d alive %d st=%d" % [_v.w1, _v.n1, _sq.call("defend_wave"), (_sq.call("alive_quest_enemies") as Array).size(), _sq.call("st")])
				_next()
		56: # [56] 제단이 무너지면 처음부터(쉬는 틈) → 세 물결 다 잡으면 금 간 검은 가면
			var alt: Node3D = _sq.get("_altar")
			if _frame == 1:
				alt.call("siege_hit", 1e6, null)
			if _frame == 4:
				_v = {"st": int(_sq.call("st")), "wave": int(_sq.call("defend_wave")), "n": (_sq.call("quest_enemies") as Array).size(),
					"full": is_equal_approx(float(_sq.call("defend_hp")), float(_sq.call("defend_max"))), "hold": float(_sq.get("_defend_hold"))}
			if _frame == 30:
				_v.still = int(_sq.call("defend_wave")) # 쉬는 틈엔 곁에 있어도 안 나옴
				_sq.set("_defend_hold", 0.0)
			if _frame > 32 and _frame < 200 and int(_sq.call("st")) == 4:
				for e in _sq.call("alive_quest_enemies"):
					e.call("_die")
			if _frame == 200:
				var bosses := get_tree().get_nodes_in_group("go_story_boss")
				var boss: Node3D = bosses[0] if bosses.size() == 1 else null
				var fbn: Node = get_tree().get_first_node_in_group("go_field_bosses")
				var hud: String = fbn.call("hud_text") if fbn else ""
				var cracked: bool = boss != null and not boss.find_children("Crack0", "MeshInstance3D", true, false).is_empty()
				var ok: bool = int(_v.st) == 4 and int(_v.wave) == -1 and int(_v.n) == 0 and bool(_v.full) and float(_v.hold) > 3.0 and int(_v.still) == -1 \
					and int(_sq.call("st")) == 5 and boss != null and String(boss.get("kind")) == "black_mask_tide" and String(boss.get("element")) == "water" \
					and cracked and hud.contains("금 간 검은 가면")
				_check("ch7_defend_done", ok, "fail: st=%d wave=%d n=%d full=%s hold=%.1f still=%d · st=%d bosses=%d cracked=%s hud='%s'" % [_v.st, _v.wave, _v.n, _v.full, _v.hold, _v.still, _sq.call("st"), bosses.size(), cracked, hud])
				_boss = boss
				_next()
		57: # [57] 밀물 원 넷이 나를 향해 줄지어 · 2단계 물 방패+졸개 둘 · 쓰러뜨리기
			var boss: Node = _boss
			if _frame == 1:
				_put((boss as Node3D).global_position + Vector3(0.0, 0.5, 10.0))
			if _frame == 3:
				boss.call("_clear_marks") # 저절로 쓰던 패턴 예고는 지우고
				boss.call("begin_skill", "tide", _p)
				var marks: Array = boss.get("_marks")
				var to_p: Vector3 = _p.global_position - (boss as Node3D).global_position
				to_p.y = 0.0
				var line := true
				for m in marks:
					var rel: Vector3 = (m.pos as Vector3) - (boss as Node3D).global_position
					rel.y = 0.0
					line = line and rel.normalized().dot(to_p.normalized()) > 0.95
				_v = {"marks": marks.size(), "line": line}
			if _frame == 90:
				boss.set("hp", float(boss.get("max_hp")) * 0.45)
			if _frame == 95:
				_v.phase = int(boss.get("phase"))
				_v.shield = float(boss.get("shield"))
				_v.summons = (boss.get("summoned") as Array).filter(func(m: Variant) -> bool: return is_instance_valid(m)).size()
				boss.call("_die")
			if _frame == 101:
				var ok: bool = int(_v.marks) == 4 and bool(_v.line) and int(_v.phase) == 2 and float(_v.shield) > 0.0 and int(_v.summons) == 2 \
					and int(_sq.call("st")) == 6 and get_tree().get_nodes_in_group("go_story_boss").is_empty()
				_check("ch7_duel", ok, "marks=%d line=%s phase=%d shield=%.0f summons=%d st=%d" % [_v.marks, _v.line, _v.phase, _v.shield, _v.summons, _sq.call("st")])
				_next()
		58: # [58] 나그네 → 제단
			if _frame == 1:
				_dismiss_prompts()
				_near_npc("wanderer")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 14:
				var ok: bool = int(_sq.call("st")) == 7 and not bool(_sq.call("npc_visible", "wanderer")) and _sq.get("_altar") != null and _sq.is_in_group("element_receiver")
				_check("ch7_after_duel", ok, "st=%d wanderer=%s receiver=%s" % [_sq.call("st"), _sq.call("npc_visible", "wanderer"), _sq.is_in_group("element_receiver")])
				_next()
		59: # [59] 제단
			if _frame == 1:
				var alt: Node3D = _sq.get("_altar")
				_sq.call("receive_element", alt.global_position, 4.0, "thunder")
			if _frame == 80:
				_check("ch7_light", int(_sq.call("st")) == 8, "st=%d" % _sq.call("st"))
				_next()
		60: # [60] 사공
			if _frame == 1:
				_near_npc("ferryman")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				_check("ch7_ferryman_after", int(_sq.call("st")) == 9, "st=%d" % _sq.call("st"))
				_next()
		61: # [61] 촌장 → 7장 끝(장 경험으로 모험 등급 20 을 넘으면 등급 보상 매듭 하나가 더 — adventure.gd AR_REWARD_5)
			if _frame == 1:
				_near_npc("elder")
				_v = {"knots": PartyState.count("fate_knot"), "ar": PartyState.level + 1, "paid": PartyState.ar_paid}
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
			var bonus := int(PartyState.ar_paid) / 5 - int(_v.paid) / 5 # 이 사이에 치른 모험 등급 보상(5의 배수마다 매듭 하나)
			var ok: bool = int(_sq.call("ch")) == 7 and String(_sq.call("tracker_text")).contains("제8장") and jt.contains("✔ 제7장") \
				and PartyState.count("fate_knot") == int(_v.knots) + 4 + bonus and PartyState.members.count("story_ferryman") == 1
			## 이 기능 전에 6·7장을 끝낸 세이브 — 둘 다 빼고 불러올 때처럼 _join_past.
			PartyState.members.erase("story_elder")
			PartyState.members.erase("story_ferryman")
			_sq.call("_join_past")
			var past := PartyState.members.count("story_elder") == 1 and PartyState.members.count("story_ferryman") == 1
			_check("chapter7", ok and past, "ch=%d knots %d→%d (ar %d→%d, +%d) ferryman=%s past=%s tracker='%s'" % [_sq.call("ch"), _v.knots, PartyState.count("fate_knot"), _v.ar, PartyState.level + 1, bonus, PartyState.members.has("story_ferryman"), past, _sq.call("tracker_text")])
			_next()
		62: # [62] 8장 풀림·바위섬
			if _frame == 1:
				PartyState.exp = 2200.0 # 모험 등급 23 그대로(7장 끝)
				PartyState.level = 22
			if _frame == 6:
				var isle := TestMap.world_pos(6.0, 2.0, "coast")
				var top := TerrainBuilder.height_at("coast", isle)
				var land_c: Vector2 = Story.CHAPTERS[7].steps[4].to.cell
				var land := TerrainBuilder.height_at("coast", TestMap.world_pos(land_c.x, land_c.y, "coast"))
				var shard := TerrainBuilder.height_at("coast", TestMap.world_pos(7.0, 3.0, "coast"))
				var spots := _ch8_spots()
				var wet := ""
				for k in spots:
					if TerrainBuilder.height_at("coast", spots[k]) < TerrainBuilder.WATER_LEVEL + 0.3:
						wet += k + " "
				var ev := _coast_event_clear(_ch8_path_spots())
				var pet := _pet_clear(spots)
				var c: Dictionary = Story.CHAPTERS[7].steps[2]
				var length := 0.0
				for i in range(1, (c.path as Array).size()):
					length += _flat(TestMap.world_pos(c.path[i].x, c.path[i].y, "coast"), TestMap.world_pos(c.path[i - 1].x, c.path[i - 1].y, "coast"))
				var avg := length / (length / Story.CHASE_SPEED + Story.CHASE_PAUSE * ((c.path as Array).size() - 1))
				var ok: bool = not bool(_sq.call("locked")) and (_sq.call("target_pos") as Vector3).is_equal_approx(_sq.call("npc_pos", "elder")) \
					and top > 2.5 and land > TerrainBuilder.WATER_LEVEL and land < 1.5 and shard < TerrainBuilder.WATER_LEVEL and wet == "" \
					and float(ev[0]) > 3.0 and float(pet[0]) > 0.0 and avg > 5.5 and avg < 8.0
				_check("ch8_unlock", ok, "locked=%s top=%.2f land=%.2f shard_ground=%.2f wet='%s' event=%.1f@%s pet=%.1f@%s thief_avg=%.2f m/s over %.0fm" % [
					_sq.call("locked"), top, land, shard, wet, ev[0], ev[1], pet[0], pet[1], avg, length])
				_next()
		63: # [63] 촌장 → 사공
			if _frame == 1:
				_near_npc("elder")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				_check("ch8_elder", int(_sq.call("st")) == 1 and (_sq.call("target_pos") as Vector3).is_equal_approx(_sq.call("npc_pos", "ferryman")), "st=%d" % _sq.call("st"))
				_next()
		64: # [64] 사공 → 도둑, 가까우면 달아남
			if _frame == 1:
				_near_npc("ferryman")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 30:
				var cs: Dictionary = _sq.call("chase_state")
				var ok: bool = int(_sq.call("st")) == 2 and bool(cs.run) and _sq.get("_thief") != null and String(_sq.call("tracker_text")).contains("노 도둑이(가) 달아난다")
				_check("ch8_thief", ok, "st=%d run=%s i=%d tracker='%s'" % [_sq.call("st"), cs.run, cs.i, String(_sq.call("tracker_text")).replace("\n", " / ")])
				_next()
		65: # [65] 놓치면 처음 자리로 · 따라잡으면 끝
			var c: Dictionary = Story.CHAPTERS[7].steps[2]
			var start := TestMap.world_pos(c.path[0].x, c.path[0].y, "coast")
			if _frame == 1:
				_put(TestMap.world_pos(4.4, 6.9, "coast") + Vector3.UP * 0.5) # 멀리(도둑 길에서 110m 남쪽 모래밭)
				_sq.set("chase_speed_mul", 30.0)
				_sq.set("_chase_pause", 0.0)
			if _frame > 1 and _frame < 200:
				_sq.set("_chase_pause", 0.0) # 숨 고르기 없이 곧장 끝까지
			if _frame == 200:
				var cs: Dictionary = _sq.call("chase_state")
				_v = {"lost": not bool(cs.run) and int(cs.i) == 0 and _flat(cs.pos, start) < 0.5, "st": int(_sq.call("st"))}
				_sq.set("chase_speed_mul", 1.0)
				_put(start + Vector3(0.0, 0.5, 8.0))
			if _frame == 210:
				_v.run = bool((_sq.call("chase_state") as Dictionary).run)
				_put((_sq.call("chase_state") as Dictionary).pos + Vector3(0.0, 0.5, 1.0))
			if _frame == 220:
				var ok: bool = bool(_v.lost) and int(_v.st) == 2 and bool(_v.run) and int(_sq.call("st")) == 3 and _sq.get("_thief") == null
				_check("ch8_chase", ok, "lost=%s run=%s st=%d thief=%s" % [_v.lost, _v.run, _sq.call("st"), _sq.get("_thief") != null])
				_next()
		66: # [66] 사공 → 배
			if _frame == 1:
				_near_npc("ferryman")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				_check("ch8_oar", int(_sq.call("st")) == 4 and String(_sq.call("tracker_text")).contains("사공에게 F"), "st=%d" % _sq.call("st"))
				_next()
		67: # [67] 배 — 섬에 내리고 신상이 켜짐, 사공도 섬에
			var land_c: Vector2 = Story.CHAPTERS[7].steps[4].to.cell
			var land := TestMap.world_pos(land_c.x, land_c.y, "coast")
			if _frame == 1:
				_v = {"wp_before": EventState.is_resolved("wp_c_isle")}
				_near_npc("ferryman")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 60:
				var wps: Node = get_tree().get_first_node_in_group("go_waypoints")
				var sta: Vector2 = Story.STATIONS.ferryman[0].cell
				var on := _flat(_p.global_position, land) < 1.5 and _p.global_position.y > TerrainBuilder.WATER_LEVEL
				var ok: bool = int(_sq.call("st")) == 5 and on and bool(wps.call("is_active", "c_isle")) \
					and _flat(_sq.call("npc_pos", "ferryman"), TestMap.world_pos(sta.x, sta.y, "coast")) < 0.1
				_check("ch8_sail", ok, "st=%d on_isle=%s y=%.2f wp=%s" % [_sq.call("st"), on, _p.global_position.y, wps.call("is_active", "c_isle")])
				if not bool(_v.wp_before):
					EventState.resolved.erase("wp_c_isle")
				_next()
		68: # [68] 섬 꼭대기 무리
			if _frame == 5:
				var es: Array = _sq.call("alive_quest_enemies")
				_v = es.size()
				var high := es.all(func(e: Variant) -> bool: return (e as Node3D).global_position.y > 1.0)
				for e in es:
					e.call("_die")
				_v = [_v, high]
			if _frame == 12:
				_check("ch8_isle_kill", int(_v[0]) == 4 and bool(_v[1]) and int(_sq.call("st")) == 6, "n=%d high=%s st=%d" % [_v[0], _v[1], _sq.call("st")])
				_next()
		69: # [69] 나그네 → 석등
			if _frame == 1:
				_near_npc("wanderer")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 14:
				var dry := true
				for m in Story.SEAL_LAYOUT:
					dry = dry and (_sq.call("seal_lamp_pos", m) as Vector3).y > TerrainBuilder.WATER_LEVEL + 0.3
				_check("ch8_seal_ready", int(_sq.call("st")) == 7 and dry and String(_sq.call("tracker_text")).contains("별 → 달 → 해"), "st=%d dry=%s" % [_sq.call("st"), dry])
				_next()
		70: # [70] 별→달→해 → 해솔
			if _frame == 1:
				for m in ["star", "moon", "sun"]:
					_sq.call("receive_element", _sq.call("seal_lamp_pos", m), 0.5, "fire")
			if _frame == 80:
				var hs: Node3D = (_sq.get("_npcs") as Dictionary)["haesol"]
				var ok: bool = int(_sq.call("st")) == 8 and bool(_sq.call("npc_visible", "haesol")) and not hs.find_children("Crack0", "MeshInstance3D", true, false).is_empty()
				_check("ch8_seal", ok, "st=%d haesol=%s" % [_sq.call("st"), _sq.call("npc_visible", "haesol")])
				_next()
		71: # [71] 해솔 → 사라짐
			if _frame == 1:
				_near_npc("haesol")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 14:
				_check("ch8_haesol", int(_sq.call("st")) == 9 and not bool(_sq.call("npc_visible", "haesol")), "st=%d" % _sq.call("st"))
				_next()
		72: # [72] 나그네 → 배
			if _frame == 1:
				_near_npc("wanderer")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				_check("ch8_wanderer_after", int(_sq.call("st")) == 10 and not bool(_sq.call("npc_visible", "wanderer")), "st=%d" % _sq.call("st"))
				_next()
		73: # [73] 배 — 포구로
			var back_c: Vector2 = Story.CHAPTERS[7].steps[10].to.cell
			if _frame == 1:
				_near_npc("ferryman")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 30:
				var d := _flat(_p.global_position, TestMap.world_pos(back_c.x, back_c.y, "coast"))
				var home: Vector2 = Story.NPCS.ferryman.cell
				var ok: bool = int(_sq.call("st")) == 11 and d < 1.5 and _flat(_sq.call("npc_pos", "ferryman"), TestMap.world_pos(home.x, home.y, "coast")) < 0.1
				_check("ch8_sail_back", ok, "st=%d d=%.2f" % [_sq.call("st"), d])
				_next()
		74: # [74] 촌장 → 8장 끝
			if _frame == 1:
				_near_npc("elder")
				_v = {"knots": PartyState.count("fate_knot"), "ar": PartyState.level + 1, "paid": PartyState.ar_paid}
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
			var bonus := int(PartyState.ar_paid) / 5 - int(_v.paid) / 5 # 이 사이에 치른 모험 등급 보상(5의 배수마다 매듭 하나)
			var ok: bool = int(_sq.call("ch")) == 8 and String(_sq.call("tracker_text")).contains("제9장") and jt.contains("✔ 제8장") \
				and PartyState.count("fate_knot") == int(_v.knots) + 4 + bonus
			_check("chapter8", ok, "ch=%d knots %d→%d (+%d) tracker='%s'" % [_sq.call("ch"), _v.knots, PartyState.count("fate_knot"), bonus, _sq.call("tracker_text")])
			_next()
		75: # [75] 9장 풀림·구름섬·바람 기둥 자리
			if _frame == 1:
				PartyState.exp = 2500.0 # 모험 등급 26(9장 25)
				PartyState.level = 25
			if _frame == 6:
				var sky: Node = get_tree().get_first_node_in_group("go_sky_isle")
				var c := SkyIsle.center()
				var base := SkyIsle.draft_base()
				var under := -1e9 # 섬 둘레·밑 지형 가장 높은 곳
				for i in 24:
					for r in [0.0, SkyIsle.RADIUS * 0.5, SkyIsle.RADIUS + 2.0]:
						var a := TAU * i / 24.0
						var q := c + Vector3(cos(a), 0.0, sin(a)) * float(r)
						under = maxf(under, TerrainBuilder.height_at("village", q))
				var col := -1e9 # 바람 기둥 둘레 지형(기둥이 벽에 묻히지 않게)
				for i in 12:
					var a := TAU * i / 12.0
					col = maxf(col, TerrainBuilder.height_at("village", base + Vector3(cos(a), 0.0, sin(a)) * SkyIsle.DRAFT_R))
				var near := 1e9
				for e in get_tree().get_nodes_in_group("field_enemy"):
					near = minf(near, _flat((e as Node3D).global_position, c))
				var gap := _flat(base, c) - SkyIsle.RADIUS
				var ok: bool = not bool(_sq.call("locked")) and (_sq.call("target_pos") as Vector3).is_equal_approx(_sq.call("npc_pos", "scholar")) \
					and sky != null and bool(sky.call("draft_active")) and bool(sky.call("gloom_visible")) \
					and under < c.y - 10.0 and col < base.y + 3.0 and gap > 5.0 and gap < 14.0 and near > 30.0
				_check("ch9_unlock", ok, "locked=%s top=%.1f base=%.1f under=%.1f col=%.1f gap=%.1f near_enemy=%.0f draft=%s gloom=%s" % [
					_sq.call("locked"), c.y, base.y, under, col, gap, near, sky.call("draft_active") if sky else false, sky.call("gloom_visible") if sky else false])
				_next()
		76: # [76] 학자 → 봉우리
			if _frame == 1:
				_near_npc("scholar")
			if _frame == 10:
				_sq.call("interact")
				_drain()
				var c: Dictionary = Story.CHAPTERS[8].steps[1]
				_check("ch9_scholar", int(_sq.call("st")) == 1 and _flat(_sq.call("target_pos"), TestMap.world_pos(c.cell.x, c.cell.y, "village")) < 0.1, "st=%d" % _sq.call("st"))
				_next()
		77: # [77] 봉우리 꼭대기 → 나그네가 봉우리에
			if _frame == 1:
				_put(SkyIsle.draft_base())
				_p.call("_set_mode", _p.Mode.GROUND)
			if _frame == 30:
				var post: Dictionary = Story.NPCS.wanderer.appear[5]
				var d := _flat(_sq.call("npc_pos", "wanderer"), TestMap.world_pos(post.cell.x, post.cell.y, "village"))
				## 땅에 선 채로는 기둥이 안 띄운다
				var dy := _p.global_position.y - SkyIsle.draft_base().y
				_check("ch9_peak", int(_sq.call("st")) == 2 and bool(_sq.call("npc_visible", "wanderer")) and d < 0.1 and absf(dy) < 1.5,
					"st=%d wanderer=%s d=%.2f dy=%.2f" % [_sq.call("st"), _sq.call("npc_visible", "wanderer"), d, dy])
				_next()
		78: # [78] 나그네 → 구름섬 목표, 나그네는 섬 위에
			if _frame == 1:
				_near_npc("wanderer")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 14:
				var w: Vector3 = _sq.call("npc_pos", "wanderer")
				var ok: bool = int(_sq.call("st")) == 3 and (_sq.call("target_pos") as Vector3).is_equal_approx(SkyIsle.center()) \
					and absf(w.y - SkyIsle.top_y()) < 0.01 and SkyIsle.on_isle(w) and String(_sq.call("tracker_text")).contains("구름섬")
				_check("ch9_wanderer", ok, "st=%d wanderer_y=%.1f top=%.1f" % [_sq.call("st"), w.y, SkyIsle.top_y()])
				_next()
		79: # [79] 바람 기둥 — 공중이면 저절로 활공하고 솟는다, 뛰어 접으면 기둥 안에서 다시 안 편다
			var b := SkyIsle.draft_base()
			if _frame == 1:
				_put(b + Vector3(0.0, 3.0, 0.0))
				_p.set("stamina", float(_p.get("stamina_max")))
				_p.call("_set_mode", _p.Mode.AIR)
				_v = {"y0": _p.global_position.y, "glide": false, "peak": -1e9}
			if _frame > 1 and _frame < 400:
				_v.glide = bool(_v.glide) or int(_p.get("mode")) == _p.Mode.GLIDE
				_v.peak = maxf(float(_v.peak), _p.global_position.y)
			if _frame == 60:
				_v.rise1 = _p.global_position.y - float(_v.y0)
			if _frame == 400:
				_v.top = float(_v.peak)
				_v.stam = float(_p.get("stamina"))
				## 기둥 안에서 스스로 접기(점프) — 기둥을 나갈 때까지 활공을 다시 펴지 않는다
				_put(b + Vector3(0.0, 12.0, 0.0))
				_p.call("_set_mode", _p.Mode.GLIDE)
			if _frame == 405: # 기둥 안에서 활공하던 중 점프 — 접기
				_p.set("_jump_buffer", 0.12)
			if _frame == 420:
				_v.skip_ok = int(_p.get("mode")) != _p.Mode.GLIDE
				_put(SkyIsle.center() + Vector3(0.0, 0.5, 0.0))
			if _frame == 440:
				var ok: bool = bool(_v.glide) and float(_v.rise1) > 3.0 and float(_v.top) > SkyIsle.top_y() + 2.0 and bool(_v.skip_ok) and int(_sq.call("st")) == 4
				_check("ch9_updraft", ok, "glide=%s rise_1s=%.1f peak=%.1f top=%.1f stamina_left=%.0f skip=%s st=%d" % [_v.glide, _v.rise1, _v.top, SkyIsle.top_y(), _v.stam, _v.skip_ok, _sq.call("st")])
				_next()
		80: # [80] 구름섬 무리 — 섬 위에 서고, 떨어지면 제자리로
			if _frame == 5:
				var es: Array = _sq.call("alive_quest_enemies")
				_v = {"n": es.size(), "high": es.all(func(e: Variant) -> bool: return SkyIsle.on_isle((e as Node3D).global_position)), "back": false}
				if not es.is_empty():
					(es[0] as Node3D).global_position = (es[0].get("home") as Vector3) + Vector3(20.0, -12.0, 0.0)
					_v.fell = es[0]
			if _frame == 8:
				_v.back = _v.has("fell") and SkyIsle.on_isle((_v.fell as Node3D).global_position)
				for e in _sq.call("alive_quest_enemies"):
					e.call("_die")
			if _frame == 14:
				_check("ch9_isle_kill", int(_v.n) == 4 and bool(_v.high) and bool(_v.back) and int(_sq.call("st")) == 5, "n=%d high=%s back=%s st=%d" % [_v.n, _v.high, _v.back, _sq.call("st")])
				_next()
		81: # [81] 먹구름 가면 해솔 — 섬 위·가면 금·2단계 방패+졸개 둘 → 가면 벗은 해솔
			if _frame == 10:
				var bosses := get_tree().get_nodes_in_group("go_story_boss")
				_boss = bosses[0] if bosses.size() == 1 else null
				_v = {"n": bosses.size(), "on": _boss != null and SkyIsle.on_isle((_boss as Node3D).global_position),
					"crack": _boss != null and not _boss.find_children("Crack0", "MeshInstance3D", true, false).is_empty(), "phase": 0, "summons": 0,
					"rel": ((_boss as Node3D).global_position - SkyIsle.center()) if _boss else Vector3.ZERO}
				if _boss:
					_boss.set("hp", float(_boss.get("max_hp")) * 0.45)
			if _frame == 16 and _boss:
				_v.phase = int(_boss.get("phase"))
				_v.summons = (_boss.get("summoned") as Array).filter(func(m: Variant) -> bool: return is_instance_valid(m)).size()
				_boss.call("_die")
			if _frame == 24:
				var free_ok: bool = bool(_sq.call("npc_visible", "haesol_free")) and not bool(_sq.call("has_mask", "haesol_free")) and SkyIsle.on_isle(_sq.call("npc_pos", "haesol_free"))
				var ok: bool = int(_v.n) == 1 and bool(_v.on) and bool(_v.crack) and int(_v.phase) == 2 and int(_v.summons) == 2 \
					and int(_sq.call("st")) == 6 and free_ok
				_check("ch9_haesol_duel", ok, "n=%d on=%s crack=%s phase=%d summons=%d st=%d free=%s boss_rel=%s me_rel=%s" % [_v.n, _v.on, _v.crack, _v.phase, _v.summons, _sq.call("st"), free_ok, _v.get("rel", ""), _p.global_position - SkyIsle.center()])
				_next()
		82: # [82] 해솔 → 먹구름 임금(1.9배·왕관), 고리 — 곁·멀리는 안 맞고 고리 위만 맞음
			if _frame == 1:
				_dismiss_prompts()
				_near_npc("haesol_free")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 30:
				var bosses := get_tree().get_nodes_in_group("go_story_boss")
				_boss = bosses[0] if bosses.size() == 1 else null
				_v = {"n": bosses.size(), "size": 0.0, "crown": false, "on": false, "hits": [], "h0": 0}
				if _boss:
					var ref: Node3D = load("res://games/saga_go/world/vroid_body.gd").build(String(_boss.name), 5)
					var base_scale := ref.scale.x
					ref.free()
					_v.size = float((_boss.get("_visual") as Node3D).scale.x) / base_scale
					_v.crown = not _boss.find_children("Crown", "Node3D", true, false).is_empty()
					_v.on = SkyIsle.on_isle((_boss as Node3D).global_position)
			## 고리 셋: 6m(고리 위) · 1.5m(안쪽 빈 곳) · 11m(바깥)
			if _boss:
				for k in 3:
					var f0 := 40 + k * 110
					if _frame == f0:
						var bp := (_boss as Node3D).global_position
						_boss.set("velocity", Vector3.ZERO)
						_put(Vector3(bp.x + [6.0, 1.5, 11.0][k], SkyIsle.top_y() + 0.2, bp.z))
						_v.h0 = int(_boss.get("hits_taken"))
						_boss.call("begin_skill", "halo", _p)
					if _frame == f0 + 100:
						(_v.hits as Array).append(int(_boss.get("hits_taken")) - int(_v.h0))
			if _frame == 380:
				var ok: bool = int(_v.n) == 1 and int(_sq.call("st")) == 7 and float(_v.size) > 1.8 and float(_v.size) < 2.0 and bool(_v.crown) and bool(_v.on) \
					and _v.hits == [1, 0, 0]
				_check("ch9_king", ok, "n=%d st=%d size=%.2f crown=%s on=%s halo_hits(6m,1.5m,11m)=%s" % [_v.n, _sq.call("st"), _v.size, _v.crown, _v.on, _v.hits])
				if _boss:
					_boss.call("_die")
				_next()
		83: # [83] 임금 쓰러짐 → 나그네
			if _frame == 1:
				_dismiss_prompts()
			if _frame == 5:
				_near_npc("wanderer")
			if _frame == 14:
				_sq.call("interact")
				_drain()
			if _frame == 18:
				_check("ch9_wanderer_after", int(_sq.call("st")) == 9 and get_tree().get_nodes_in_group("go_story_boss").is_empty(), "st=%d" % _sq.call("st"))
				_next()
		84: # [84] 해솔 → 마을로 내려가기(해솔·나그네는 섬에서 사라짐)
			if _frame == 1:
				_near_npc("haesol_free")
			if _frame == 10:
				_sq.call("interact")
				_drain()
			if _frame == 14:
				var e: Vector2 = Story.CHAPTERS[8].steps[10].cell
				var ok: bool = int(_sq.call("st")) == 10 and not bool(_sq.call("npc_visible", "haesol_free")) and not bool(_sq.call("npc_visible", "wanderer")) \
					and _flat(_sq.call("target_pos"), TestMap.world_pos(e.x, e.y, "village")) < 0.1
				_check("ch9_haesol_after", ok, "st=%d haesol=%s wanderer=%s" % [_sq.call("st"), _sq.call("npc_visible", "haesol_free"), _sq.call("npc_visible", "wanderer")])
				_next()
		85: # [85] 활공해 마을에(섬 위에선 안 넘어감)
			if _frame == 1:
				_v = int(_sq.call("st"))
				_put(TestMap.world_pos(5.8, 3.3, "village") + Vector3(8.0, 0.5, 0.0))
			if _frame == 20:
				_check("ch9_glide_home", int(_v) == 10 and int(_sq.call("st")) == 11, "st_on_isle=%d st=%d" % [_v, _sq.call("st")])
				_next()
		86: # [86] 촌장 → 9장 끝·해솔 합류·먹구름 걷힘·바람 기둥은 남음
			if _frame == 1:
				_near_npc("elder")
				_v = {"knots": PartyState.count("fate_knot"), "ar": PartyState.level + 1, "paid": PartyState.ar_paid}
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
			var sky: Node = get_tree().get_first_node_in_group("go_sky_isle")
			var bonus := int(PartyState.ar_paid) / 5 - int(_v.paid) / 5 # 이 사이에 치른 모험 등급 보상(5의 배수마다 매듭 하나)
			var ok: bool = int(_sq.call("ch")) == 9 and (String(_sq.call("tracker_text")) == "" or String(_sq.call("tracker_text")).contains("제10장")) and jt.contains("✔ 제9장") \
				and PartyState.count("fate_knot") == int(_v.knots) + 5 + bonus and PartyState.members.count("story_haesol") == 1 \
				and not bool(sky.call("gloom_visible")) and bool(sky.call("draft_active"))
			_check("chapter9", ok, "ch=%d knots %d→%d (+%d) haesol=%s gloom=%s draft=%s tracker='%s'" % [_sq.call("ch"), _v.knots, PartyState.count("fate_knot"), bonus,
				PartyState.members.has("story_haesol"), sky.call("gloom_visible"), sky.call("draft_active"), _sq.call("tracker_text")])
			_next()
		87: # ㊾ 대화 몸짓 — 다 끝난 뒤 촌장 혼잣말로
			var face: Node = _sq.call("face_of", "elder")
			var body: Node3D = (_sq.get("_npcs")["elder"] as Node3D).get_node("Body")
			if _frame == 1:
				## 106장 ㊺ 2부(10장~)가 생겨 9장 뒤에도 촌장 대화가 이어진다 — 모든 장을 마친 자리로 옮겨 혼잣말 한 줄로(끝에 되돌림).
				PartyState.story = {"ch": Story.CHAPTERS.size(), "step": 0}
				_sq.call("_enter_step")
				_near_npc("elder")
				_v = {"hand": _hand_probe(body), "blink": 0.0, "base_y": 0.0, "base_f": 0.0, "n": 0}
			if _frame > 1:
				_v.blink = maxf(float(_v.blink), float(face.call("blink_weight")))
			if _frame >= 30 and _frame < 60: # 몸짓 없을 때 손 자리 평균(서기 애니가 조금 흔든다)
				var hp: Vector3 = (_v.hand as Node3D).global_position - body.global_position
				_v.base_y += hp.y
				_v.base_f += hp.dot(body.global_transform.basis.z.normalized())
				_v.n += 1
			if _frame == 60:
				_v.map = [face.call("viseme_of", "가"), face.call("viseme_of", "기"), face.call("viseme_of", "구"), face.call("viseme_of", "게"), face.call("viseme_of", "고"), face.call("viseme_of", "!"), face.call("viseme_of", "a")]
				_v.opened = bool(_sq.call("interact"))
			if _frame == 66:
				var vc := int((_sq.get("_dlg_text") as Label).visible_characters)
				_v.revealing = bool(_sq.call("is_revealing")) and vc > 0 and vc < String((_sq.get("_dlg_text") as Label).text).length()
				_v.mouth = float((face.call("mouth_state") as Array)[1])
			if _frame == 110:
				var hp: Vector3 = (_v.hand as Node3D).global_position - body.global_position
				_v.lift = hp.y - float(_v.base_y) / float(_v.n)
				_v.fwd = hp.dot(body.global_transform.basis.z.normalized()) - float(_v.base_f) / float(_v.n)
				_v.infl = float(face.get("influence"))
				_v.done_reveal = not bool(_sq.call("is_revealing"))
				_v.open_mid = bool(_sq.call("is_dialogue_open"))
				face.call("set_mood", "joy")
			if _frame == 150:
				_v.joy = float(face.call("mood_weight", "joy"))
				face.call("set_mood", "")
				_sq.call("next_line") # 혼잣말 한 줄 — 닫힘
				_v.closed = not bool(_sq.call("is_dialogue_open"))
			if _frame == 420:
				var hp: Vector3 = (_v.hand as Node3D).global_position - body.global_position
				var back := absf(hp.y - float(_v.base_y) / float(_v.n)) < 0.05
				## 09-29 공방 몸(char-forge)엔 입·눈 변형(blend shape)이 없다 — 있는 몸만 입·기쁨·깜빡임을 본다. 손짓·끄덕임은 늘.
				var faced := bool(face.call("has_mouth"))
				var ok: bool = _v.map == [0, 1, 2, 3, 4, -1, -1] and bool(_v.opened) and bool(_v.revealing) \
					and float(_v.lift) > 0.12 and float(_v.fwd) > 0.08 and float(_v.infl) > 0.9 and bool(_v.done_reveal) and bool(_v.open_mid) \
					and bool(_v.closed) and float(face.get("influence")) < 0.05 and back \
					and (not faced or (float(_v.mouth) > 0.2 and float(_v.joy) > 0.5 and float(_v.blink) > 0.99))
				_check("talk_face", ok, "map=%s reveal=%s mouth=%.2f lift=%.2f fwd=%.2f infl=%.2f joy=%.2f closed=%s back=%s blink=%.1f front=%+.0f" % [
					_v.map, _v.revealing, _v.mouth, _v.lift, _v.fwd, _v.infl, _v.joy, _v.closed, back, _v.blink, face.call("front_sign")])
				(_v.hand as Node).queue_free()
				_next()
		88:
			PartyState.story = _saved.story
			PartyState.members.assign(_saved.members)
			PartyState.exp = _saved.exp
			PartyState.level = _saved.level
			PartyState.resin = _saved.resin
			PartyState.resin_t = _saved.resin_t
			PartyState.gather_t = _saved.gather_t
			var ga: Node = get_tree().get_first_node_in_group("go_gathering")
			if ga:
				ga.call("refresh")
			print("STORY_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

## 보이는 선택지 창(승급 3택 등) 수 — 이야기 노드 자신은 뺀다.
func _visible_prompts() -> int:
	return get_tree().get_nodes_in_group("ui_modal").filter(func(n: Node) -> bool: return n != _sq and n.get("visible") != false).size()

## 보이는 선택지 창마다 첫 단추를 한 번 누른다(사람이 고르는 것처럼). 창은 그 프레임 끝에 사라지므로 몇 프레임 뒤에 본다.
var _pressed: Array = []

func _dismiss_prompts() -> void:
	for n in get_tree().get_nodes_in_group("ui_modal"):
		if n == _sq or n.get("visible") == false or _pressed.has(n):
			continue
		_pressed.append(n)
		var btns := (n as Node).find_children("*", "Button", true, false)
		if not btns.is_empty():
			(btns[0] as Button).pressed.emit()

## 대화를 끝까지 넘긴다(고르는 줄은 첫 대답). 고른 줄 수를 돌려준다.
func _drain() -> int:
	var choices := 0
	var guard := 0
	while _sq.call("is_dialogue_open") and guard < 50:
		guard += 1
		if _sq.get("_dlg_waiting_choice"):
			_sq.call("choose", 0)
			choices += 1
		else:
			_sq.call("next_line")
	return choices

## 카메라가 그 사람 얼굴(발 자리 + 1.45m) 쪽을 보는 정도(1 = 정면).
func _looks_at(foot: Vector3) -> float:
	var cam: Camera3D = _p.get_node("CameraRig/SpringArm3D/Camera3D")
	var to: Vector3 = (foot + Vector3.UP * 1.45) - cam.global_position
	return (-cam.global_transform.basis.z).dot(to.normalized())

## 다음 줄로 — 글자가 흘러나오는 중이면 두 번(한 번은 줄 전체 보이기).
func _line_next() -> void:
	if _sq.call("is_revealing"):
		_sq.call("next_line")
	_sq.call("next_line")

## 오른손 뼈에 붙인 빈 노드(손짓 점검 — 뼈대 수정 뒤 자리를 따라간다).
func _hand_probe(body: Node3D) -> Node3D:
	var skel: Skeleton3D = body.find_children("*", "Skeleton3D", true, false)[0]
	var att := BoneAttachment3D.new()
	att.bone_idx = skel.find_bone("J_Bip_R_Hand") if skel.find_bone("J_Bip_R_Hand") >= 0 else skel.find_bone("hand_r")
	skel.add_child(att)
	return att

func _flat(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()

## 5장 새 자리가 신수 조우 원(pet_encounter.gd TRIGGER_RADIUS + 임무 적 퍼짐)과 얼마나 떨어졌나 [여유 m, 어디] — 겹치면 조우 창이 대화를 막는다.
func _pet_clear(spots: Dictionary = {}) -> Array:
	var best := 1e9
	var where := ""
	if spots.is_empty():
		spots = _ch5_spots()
	for n in get_tree().current_scene.get_children():
		var sc: Script = n.get_script()
		if sc == null or not sc.resource_path.ends_with("pet_encounter.gd"):
			continue
		for k in spots:
			var m := _flat((n as Node3D).global_position, spots[k]) - float(n.get("TRIGGER_RADIUS")) - 4.5
			if m < best:
				best = m
				where = "%s~%s" % [k, n.name]
	return [best, where]

## 6장 새 자리 — 봉우리·나그네·학자(봉우리)·제단.
func _ch6_spots() -> Dictionary:
	var spots := {}
	spots["peak"] = TestMap.world_pos(7.1, 1.55, "village")
	spots["wanderer"] = TestMap.world_pos(Story.NPCS.wanderer.appear[2].cell.x, Story.NPCS.wanderer.appear[2].cell.y, "village")
	spots["scholar"] = TestMap.world_pos(Story.STATIONS.scholar[2].cell.x, Story.STATIONS.scholar[2].cell.y, "village")
	var alt: Dictionary = Story.CHAPTERS[5].steps[5]
	spots["altar"] = TestMap.world_pos(alt.cell.x, alt.cell.y, "village")
	return spots

## 7장 곶 자리 — 제단·나그네·싸움터·물결이 나오는 둘레 자리 전부(포구).
func _ch7_spots() -> Dictionary:
	var spots := {}
	var d: Dictionary = Story.CHAPTERS[6].steps[4]
	var c := TestMap.world_pos(d.cell.x, d.cell.y, "coast")
	spots["altar"] = c
	spots["wanderer"] = TestMap.world_pos(Story.NPCS.wanderer.appear[3].cell.x, Story.NPCS.wanderer.appear[3].cell.y, "coast")
	var du: Dictionary = Story.CHAPTERS[6].steps[5]
	spots["duel"] = TestMap.world_pos(du.cell.x, du.cell.y, "coast")
	for w in (d.waves as Array).size():
		var n: int = (d.waves[w] as Array).size()
		for i in n:
			var a := TAU * float(i) / float(n) + 0.9 * w
			spots["wave%d_%d" % [w, i]] = c + Vector3(cos(a), 0.0, sin(a)) * Story.DEFEND_RING
	return spots

## 8장 바위섬 자리 — 제단·나그네·해솔·배 댄 자리·석등 셋·순간이동 신상.
func _ch8_spots() -> Dictionary:
	var spots := {}
	var c := TestMap.world_pos(6.0, 2.0, "coast")
	spots["altar"] = c
	spots["wanderer"] = TestMap.world_pos(Story.NPCS.wanderer.appear[4].cell.x, Story.NPCS.wanderer.appear[4].cell.y, "coast")
	spots["haesol"] = TestMap.world_pos(Story.NPCS.haesol.cell.x, Story.NPCS.haesol.cell.y, "coast")
	spots["landing"] = TestMap.world_pos(Story.STATIONS.ferryman[0].cell.x, Story.STATIONS.ferryman[0].cell.y, "coast")
	spots["statue"] = TestMap.world_pos(5.95, 2.27, "coast")
	for i in Story.SEAL_LAYOUT.size():
		var a := TAU * float(i) / float(Story.SEAL_LAYOUT.size())
		spots["lamp_" + String(Story.SEAL_LAYOUT[i])] = c + Vector3(sin(a), 0.0, -cos(a)) * Story.SEAL_RING
	return spots

## 8장 도둑 길 점(포구 사건 반경에 걸리면 쫓는 도중 선택 창이 뜬다).
func _ch8_path_spots() -> Dictionary:
	var spots := {}
	var c: Dictionary = Story.CHAPTERS[7].steps[2]
	for i in (c.path as Array).size():
		spots["path%d" % i] = TestMap.world_pos(c.path[i].x, c.path[i].y, "coast")
	return spots

## 포구 사건(region2_coast.gd — 어부 부탁·표류물·조각배, 반경 안에 들면 선택 창이 떠 대화를 막는다)과의 여유 [m, 어디].
func _coast_event_clear(spots: Dictionary) -> Array:
	const Coast := preload("res://games/saga_go/world/region2_coast.gd")
	var evs := {"fisher": [Coast.FISHER_GRID, Coast.FISHER_TALK_RADIUS], "driftwood": [Coast.DRIFTWOOD_GRID, Coast.DRIFTWOOD_TRIGGER_RADIUS],
		"boat": [Coast.BOAT_GRID, Coast.BOAT_TRIGGER_RADIUS]}
	var best := 1e9
	var where := ""
	for e in evs:
		var g: Vector2i = evs[e][0]
		var ep := TestMap.world_pos(g.x, g.y, "coast")
		for k in spots:
			var m := _flat(ep, spots[k]) - float(evs[e][1])
			if m < best:
				best = m
				where = "%s~%s" % [k, e]
	return [best, where]

## 산 바위(vegetation_builder _scatter_rocks 와 같은 해시)에서 가장 가까운 거리 [m, 어디] — 바위가 제단·인물을 덮지 않게.
func _rock_clear(spots: Dictionary) -> Array:
	var best := 1e9
	var where := ""
	var rows := TestMap.rows_of("village")
	for y in rows.size():
		for x in String(rows[y]).length():
			if String(rows[y])[x] != "^":
				continue
			for i in Veg.ROCKS_PER_MOUNTAIN_TILE:
				var jx := (Veg._hash(x, y, i * 3 + 500) - 0.5) * TestMap.TILE_SIZE * 0.6
				var jz := (Veg._hash(x, y, i * 3 + 501) - 0.5) * TestMap.TILE_SIZE * 0.6
				var rp := TestMap.world_pos(x, y, "village") + Vector3(jx, 0.0, jz)
				for k in spots:
					var d := _flat(rp, spots[k])
					if d < best:
						best = d
						where = k
	return [best, where]

func _ch5_spots() -> Dictionary:
	var spots := {}
	spots["road"] = TestMap.world_pos(Story.STATIONS.scholar[0].cell.x, Story.STATIONS.scholar[0].cell.y, "village")
	spots["altar_side"] = TestMap.world_pos(Story.STATIONS.scholar[1].cell.x, Story.STATIONS.scholar[1].cell.y, "village")
	spots["wanderer"] = TestMap.world_pos(Story.NPCS.wanderer.appear[1].cell.x, Story.NPCS.wanderer.appear[1].cell.y, "village")
	var seal: Dictionary = Story.CHAPTERS[4].steps[4]
	spots["altar"] = TestMap.world_pos(seal.cell.x, seal.cell.y, "village")
	return spots

## 5장 새 자리(학자 두 자리·나그네·제단·석등 셋)에서 가장 가까운 나무 줄기까지 [거리, 어디] — vegetation_builder 와 같은 해시.
func _trunk_clear() -> Array:
	var spots := _ch5_spots()
	var c: Vector3 = spots["altar"]
	for i in Story.SEAL_LAYOUT.size():
		var a := TAU * float(i) / float(Story.SEAL_LAYOUT.size())
		spots["lamp_" + String(Story.SEAL_LAYOUT[i])] = c + Vector3(sin(a), 0.0, -cos(a)) * Story.SEAL_RING
	var best := 1e9
	var where := ""
	var rows := TestMap.rows_of("village")
	for y in rows.size():
		for x in String(rows[y]).length():
			if String(rows[y])[x] != "T":
				continue
			for i in Veg.TREES_PER_FOREST_TILE:
				var jx := (Veg._hash(x, y, i * 2) - 0.5) * TestMap.TILE_SIZE * 0.8
				var jz := (Veg._hash(x, y, i * 2 + 1) - 0.5) * TestMap.TILE_SIZE * 0.8
				var tp := TestMap.world_pos(x, y, "village") + Vector3(jx, 0.0, jz)
				for k in spots:
					var d := _flat(tp, spots[k])
					if d < best:
						best = d
						where = k
	return [best, where]

func _near_npc(id: String) -> void:
	_dismiss_prompts()
	_put(_sq.call("npc_pos", id) + Vector3(0.0, 0.3, 1.5))

func _put(pos: Vector3) -> void:
	_p.global_position = pos + Vector3(0.0, 0.3, 0.0)
	_p.velocity = Vector3.ZERO

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("STORY_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
