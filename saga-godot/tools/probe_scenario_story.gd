extends SceneTree

## G-0087 사가종횡 이야기 1부(games/saga_story/data/scenario.gd·world/scenario_runner.gd) 자동 점검 — 세이브 파일 없이.
##   godot --headless --path saga-godot --script res://tools/probe_scenario_story.gd
## ① 표: 장 넷 id 정본(p1_sinya·p1_heodo·p1_field·p1_job) · 시대 섞기 셋 · 장면·말한 이 · 사명 key 가 고돗 QUESTS 에 있음 · 장면 키가 SCENE_KEYS 값 · 경험치·금
## ② 흐름 흉내(ctx 사전): 다른 장면에선 sinya1 안 뜸 → 신야성 → sinya1 → q_first → sinya2(1장 끝) → 허도 heodo1 → q_gear1 → heodo2 → 들판 field1 → q_field·q_boss1 → field2
##    → Lv9 에선 잠김("Lv 10 되면") → Lv10 허도 job1 → 1차 전직 → job2(1부 끝, 경험치 1230·금 4000)
## ②-2 G-0091 2부: job2 → 강릉진 port1 → 관문 대장 → port2 → 오림 숲 forest1 → q_forest·q_gather1 → forest2 → 남정성 q_talk1·q_job → nam2 → Lv25 굴혈 q_cave → cave1 → 2차 전직 → cave2(2부 끝)
## ②-3 G-0095 3부: cave2 → 기산채 gisan1 → q_gold1 → gisan2 → 호로곡 gorge1 → 처치 60 → 보스 1(단계 전 보스는 안 셈) → gorge2 → Lv30 lab1 → 비경 완주 1 → lab2 → Lv45 허도 job31 → 3차 → 유대 20 → job32(3부 끝)
## ②-4 G-0100 4부: 기산채 luoyang1 → 처치 150(149 머묾) → 보스 1 → luoyang2 → Lv70 한중 굴혈 depth1 → 비경 1 → depth2 → 보스 2(하나로 머묾) → gate1 → gate2 고르기 keep
##    → 허도 name1 → 4차 → name2 칭호 wander → name3_keep(4부 끝, 경험치 537930·금 427000) · close 면 name3_close · 답 없으면 close
## ②-5 G-0104 5부: Lv72 허창 들판 bp1 → 보스 1 → beyond1 → Lv74 강릉진 bn1 → 보스 1 → beyond2 → 허도 bf1 → 비경 1 → beyond3_keep(4부 문 지킴, 경험치 1837930·금 1327000) · close 면 beyond3_close
## ③ legacy: 빈 칸 + Lv10 또는 1차 → 1부만 · Lv30 또는 2차 → 2부까지 · Lv3 → 1장부터 · 칸이 있으면 안 함 · legacy 로 건너뛴 진행은 2부 문턱을 넘으면 이어 건너뜀
## ④ 말한 이: mentor 는 넘긴 스승 이름(없으면 "스승") · 스승 이름이 도감 가명(mentor_of)에서 나옴
## ⑤ 엔진·장면 스크립트 컴파일(scenario_runner·story_field·story_town·goal_board_feed)
## 끝에 "PROBE scenario_story OK" 또는 "PROBE scenario_story FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var S: GDScript = load("res://games/saga_story/data/scenario.gd")
	var C: GDScript = load("res://games/saga_story/data/story_combat.gd")
	check(S != null and C != null, "scenario.gd·story_combat.gd 를 불러옴")
	if S == null or C == null:
		_end()
		return

	# ① 표
	var ids: Array = S.CHAPTERS.map(func(c): return String(c.id))
	check(ids == ["p1_sinya", "p1_heodo", "p1_field", "p1_job", "p2_port", "p2_forest", "p2_namjeong", "p2_cave", "p3_gisan", "p3_gorge", "p3_labyrinth", "p3_job",
		"p4_luoyang", "p4_depth", "p4_gate", "p4_name", "p5_past", "p5_now", "p5_future"], "장 열아홉 id 정본 %s" % [ids])
	var bad: Array = []
	var keys: Array = S.SCENE_KEYS.values()
	for c: Dictionary in S.CHAPTERS:
		for era in ["past", "now", "future"]:
			if String((c.mix as Dictionary).get(era, "")) == "":
				bad.append("%s 시대 %s" % [c.id, era])
		if int(c.get("exp", 0)) <= 0 or int(c.get("gold", 0)) <= 0:
			bad.append("%s 보상" % c.id)
		for s: Dictionary in c.steps:
			match String(s.t):
				"talk":
					var lines: Array = []
					var names: Array = [String(s.scene)]
					if s.has("by"):   # 고르기 답마다 장면 하나
						names = []
						for k in S.CHOICES:
							if String(S.CHOICES[k].id) == String(s.by):
								for o: Dictionary in S.CHOICES[k].options:
									names.append("%s_%s" % [s.scene, o.key])
					for nm in names:
						if S.lines_of(nm).is_empty():
							bad.append("장면 없음 " + nm)
						lines += S.lines_of(nm)
					if names.is_empty():
						bad.append("고르기 없음 %s" % s.get("by", ""))
					for l: Array in lines:
						if not (String(l[0]) in ["me", "mentor", "mentor+"]) and not S.CAST.has(String(l[0])):
							bad.append("%s 모르는 이 %s" % [s.scene, l[0]])
					if s.has("at") and not keys.has(String(s.at)):
						bad.append("at %s" % s.at)
				"stage":
					if not keys.has(String(s.stage)):
						bad.append("장면 키 %s" % s.stage)
				"mission":
					if not C.QUESTS.has(String(s.quest)):
						bad.append("사명 없음 %s" % s.quest)
				"job", "gate", "stagekill", "boss", "rift", "bond":
					pass
				_:
					bad.append("모르는 단계 %s" % s.t)
	check(bad.is_empty(), "표 규칙 %s" % [bad])

	# ② 흐름
	var st: Dictionary = S.fresh()
	var ctx := {"level": 1, "stage": "heodo", "quests": {}, "tier": 0}
	var log := {"exp": 0, "gold": 0, "ch": []}
	var take := func(arr: Array) -> void:
		for r: Dictionary in arr:
			if r.has("chapter"):
				log.exp = int(log.exp) + int(r.chapter.exp)
				log.gold = int(log.gold) + int(r.chapter.gold)
				(log.ch as Array).append(String(r.chapter.id))
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "stage" and S.objective(st, ctx).contains("신야성"), "허도에선 신야성으로 \"%s\"" % S.objective(st, ctx))
	ctx.stage = "sinya"
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "sinya1", "신야성 → sinya1")
	ctx.stage = "heodo"
	check(S.pending_scene(st, ctx) == "", "at 신야성 대화는 다른 장면에서 안 뜸")
	ctx.stage = "sinya"
	take.call(S.finish_talk(st, ctx))
	check(String(S.step(st).t) == "mission" and S.objective(st, ctx).contains("첫 사냥") == false, "q_first 단계(이름은 부르는 쪽이 넘김)")
	check(S.objective(st, ctx, {"q_first": "첫 사냥"}).contains("「첫 사냥」"), "목표판 사명 이름")
	ctx.quests = {"q_first": true}
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "sinya2", "첫 사냥 → sinya2(어디서나)")
	take.call(S.finish_talk(st, ctx))
	check(log.ch == ["p1_sinya"] and String(S.step(st).t) == "stage", "1장 끝 → 허도로")
	ctx.stage = "heodo"
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # heodo1
	ctx.quests["q_gear1"] = true
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # heodo2
	check(log.ch == ["p1_sinya", "p1_heodo"], "2장 끝")
	ctx.stage = "field"
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "field1", "들판 → field1")
	take.call(S.finish_talk(st, ctx))
	ctx.quests["q_field"] = true
	take.call(S.check(st, ctx))
	check(String(S.step(st).get("quest", "")) == "q_boss1", "들판을 비운다 → 두목의 목")
	ctx.quests["q_boss1"] = true
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # field2
	check(log.ch.size() == 3, "3장 끝")
	ctx.stage = "heodo"
	ctx.level = 9
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "" and S.objective(st, ctx).contains("Lv 10 되면"), "Lv9 — 4장 잠김 \"%s\"" % S.objective(st, ctx))
	ctx.level = 10
	check(S.pending_scene(st, ctx) == "job1", "Lv10 허도 → job1")
	take.call(S.finish_talk(st, ctx))
	check(S.objective(st, ctx).contains("1차 전직"), "전직 단계")
	ctx.tier = 1
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # job2
	check(log.ch.size() == 4 and int(log.exp) == 1230 and int(log.gold) == 4000 and String(S.step(st).get("stage", "")) == "port" and S.objective(st, ctx).begins_with("📜 2부 5장"),
		"1부 끝 — 경험치 %d · 금 %d → 2부 \"%s\"" % [int(log.exp), int(log.gold), S.objective(st, ctx)])

	# ②-2 2부
	ctx.stage = "port"
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "port1", "강릉진 → port1")
	take.call(S.finish_talk(st, ctx))
	check(String(S.step(st).t) == "gate" and S.objective(st, ctx).contains("관문 대장"), "관문 대장 단계")
	ctx.champions = 1
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # port2
	check(log.ch.size() == 5, "5장 끝")
	ctx.stage = "forest"
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "forest1", "오림 숲 → forest1(나그네)")
	take.call(S.finish_talk(st, ctx))
	ctx.quests["q_forest"] = true
	take.call(S.check(st, ctx))
	check(String(S.step(st).get("quest", "")) == "q_gather1", "오림의 그늘 → 약초 캐기")
	ctx.quests["q_gather1"] = true
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # forest2
	ctx.stage = "namjeong"
	ctx.level = 12   # 7장 문턱
	ctx.quests["q_talk1"] = true
	ctx.quests["q_job"] = true
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "nam2", "남정성 · 민심·길을 정한다 → nam2")
	take.call(S.finish_talk(st, ctx))
	ctx.stage = "cave"
	ctx.quests["q_cave"] = true
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "" and S.objective(st, ctx).contains("Lv 25 되면"), "Lv12 — 8장 잠김")
	ctx.level = 25
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "cave1", "Lv25 굴혈 → cave1")
	take.call(S.finish_talk(st, ctx))
	check(S.objective(st, ctx).contains("2차 전직"), "2차 전직 단계")
	ctx.tier = 2
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # cave2
	check(log.ch.size() == 8 and int(log.exp) == 9930 and int(log.gold) == 22000 and S.objective(st, ctx).begins_with("📜 3부 9장"),
		"2부 끝 — 경험치 %d · 금 %d → 3부" % [int(log.exp), int(log.gold)])

	# ②-3 3부
	ctx.stage = "gisan"
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "gisan1", "기산채 → gisan1")
	take.call(S.finish_talk(st, ctx))
	ctx.quests["q_gold1"] = true
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # gisan2
	ctx.stage = "gorge"
	ctx.bosses = 5
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # gorge1
	ctx.stage_kills = {"gorge": 59}
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "stagekill" and S.objective(st, ctx).contains("호로곡 처치 59/60"), "처치 59 머묾 \"%s\"" % S.objective(st, ctx))
	ctx.stage_kills = {"gorge": 60}
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "boss" and int(st.base) == 5, "처치 60 → 보스 단계(기준 5)")
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "boss", "이미 잡은 보스 다섯은 안 셈")
	ctx.bosses = 6
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # gorge2
	check(log.ch.size() == 10 and S.objective(st, ctx).contains("Lv 30 되면"), "10장 끝 → 11장 Lv30 잠김")
	ctx.level = 30
	take.call(S.finish_talk(st, ctx))   # lab1
	check(String(S.step(st).t) == "rift" and S.objective(st, ctx).contains("비경"), "비경 단계")
	st.rifts = int(st.get("rifts", 0)) + 1
	take.call(S.check(st, ctx))
	var frags := 0
	for r2 in S.finish_talk(st, ctx):   # lab2
		if r2.has("chapter"):
			frags += int(r2.chapter.get("frags", 0))
			(log.ch as Array).append(String(r2.chapter.id))
			log.exp = int(log.exp) + int(r2.chapter.exp)
			log.gold = int(log.gold) + int(r2.chapter.gold)
	check(frags == 3, "11장 보상 기억 조각 3")
	ctx.level = 45
	ctx.stage = "heodo"
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "job31", "Lv45 허도 → job31")
	take.call(S.finish_talk(st, ctx))
	ctx.tier = 3
	ctx.bond = 0
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "bond" and S.objective(st, ctx).contains("유대 0/20"), "3차 → 사제 유대 20")
	ctx.bond = 20
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # job32
	check(log.ch.size() == 12 and int(log.exp) == 107930 and int(log.gold) == 97000 and String(S.chapter(st).id) == "p4_luoyang",
		"3부 끝 — 경험치 %d · 금 %d → 4부" % [int(log.exp), int(log.gold)])

	# ②-4 G-0100 4부
	check(String(S.step(st).t) == "stage" and S.objective(st, ctx).contains("기산채"), "4부 첫 단계 = 기산채로 \"%s\"" % S.objective(st, ctx))
	ctx.stage = "gisan"
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "luoyang1", "기산채 → luoyang1")
	take.call(S.finish_talk(st, ctx))
	ctx.stage_kills = {"gisan": 149}
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "stagekill", "기산채 처치 149 머묾")
	ctx.stage_kills = {"gisan": 150}
	ctx.bosses = 6
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "boss" and S.objective(st, ctx).contains("보스 처치 0/1"), "처치 150 → 보스 1 \"%s\"" % S.objective(st, ctx))
	ctx.bosses = 7
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # luoyang2
	check(log.ch.size() == 13 and S.objective(st, ctx).contains("Lv 70 되면"), "13장 끝 → 14장 Lv70 잠김")
	ctx.level = 70
	ctx.stage = "cave"
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "depth1", "Lv70 한중 굴혈 → depth1")
	take.call(S.finish_talk(st, ctx))
	check(String(S.step(st).t) == "rift", "깊이 = 비경 한 번 더")
	st.rifts = int(st.rifts) + 1
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # depth2
	check(String(S.step(st).t) == "boss" and int(S.step(st).n) == 2, "15장 = 보스 둘")
	ctx.bosses = 8
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "boss", "보스 하나로는 머묾")
	ctx.bosses = 9
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # gate1
	check(S.pending_scene(st, ctx) == "gate2" and S.CHOICES.has("gate2"), "gate2 고르기")
	take.call(S.finish_talk(st, ctx, "keep"))
	check(String(st.choices.get("gate", "")) == "keep" and S.pending_scene(st, ctx) == "", "문 지킴 → 16장 허도에서(굴혈에선 안 뜸)")
	ctx.stage = "heodo"
	take.call(S.finish_talk(st, ctx))   # name1
	ctx.tier = 3
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "job" and S.objective(st, ctx).contains("4차 전직"), "4차 전직 단계")
	ctx.tier = 4
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx, "wander"))   # name2
	check(S.pending_scene(st, ctx) == "name3_keep" and String(st.choices.get("name", "")) == "wander", "문 지킴 → name3_keep · 칭호 wander")
	take.call(S.finish_talk(st, ctx))
	check(log.ch.size() == 16 and int(log.exp) == 537930 and int(log.gold) == 427000 and S.objective(st, ctx).contains("Lv 72 되면"),
		"4부 끝 — 경험치 %d · 금 %d → 5부 Lv72 잠김" % [int(log.exp), int(log.gold)])

	# ②-5 G-0104 5부
	ctx.level = 72
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "stage" and S.objective(st, ctx).contains("허창 들판"), "옛 전장 = 허창 들판으로")
	ctx.stage = "field"
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "bp1", "허창 들판 → bp1")
	ctx.bosses = 20
	take.call(S.finish_talk(st, ctx))
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "boss", "들어선 뒤 보스 전엔 머묾")
	ctx.bosses = 21
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # beyond1
	check(log.ch.size() == 17 and S.objective(st, ctx).contains("Lv 74 되면"), "17장 끝 → 18장 Lv74 잠김")
	ctx.level = 76
	ctx.stage = "port"
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # bn1
	ctx.bosses = 22
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # beyond2
	check(log.ch.size() == 18 and S.pending_scene(st, ctx) == "", "18장 끝 → 19장은 허도에서")
	ctx.stage = "heodo"
	take.call(S.finish_talk(st, ctx))   # bf1
	check(String(S.step(st).t) == "rift", "궤도 기지 = 비경")
	st.rifts = int(st.rifts) + 1
	take.call(S.check(st, ctx))
	check(S.pending_scene(st, ctx) == "beyond3_keep", "4부 문 지킴 → beyond3_keep")
	take.call(S.finish_talk(st, ctx))
	check(S.finished(st) and log.ch.size() == 19 and int(log.exp) == 1837930 and int(log.gold) == 1327000 and S.objective(st, ctx) == "",
		"5부 끝 — 경험치 %d · 금 %d" % [int(log.exp), int(log.gold)])
	check(S.pending_scene(S.normalize({"ch": 18, "step": 2, "choices": {"gate": "close"}}), {"level": 76, "stage": "heodo"}) == "beyond3_close", "문 닫음 → beyond3_close")
	check(S.pending_scene(S.normalize({"ch": 15, "step": 3, "choices": {"gate": "close"}}), {"level": 70, "stage": "heodo"}) == "name3_close", "문 닫음 → name3_close")
	check(S.pending_scene(S.normalize({"ch": 15, "step": 3}), {"level": 70, "stage": "heodo"}) == "name3_close", "답 없으면 첫 답(close)")
	check(S.speaker("mentor+", "다음 스승") == "🥋 다음 스승", "mentor+ 표시")

	# ③ legacy
	var a: Dictionary = S.normalize({})
	check(S.apply_legacy(a, true, 12, 0) == 4 and int(a.ch) == 4 and (a.done as Array).size() == 4, "빈 칸 + Lv12 → 1부만 지나온 길")
	var b: Dictionary = S.normalize({})
	check(S.apply_legacy(b, true, 3, 1) == 4 and int(b.ch) == 4, "빈 칸 + 1차 전직 → 1부만")
	var b2: Dictionary = S.normalize({})
	check(S.apply_legacy(b2, true, 30, 2) == 8 and int(b2.ch) == 8, "빈 칸 + Lv30·2차 → 2부까지")
	var b3: Dictionary = S.normalize({})
	check(S.apply_legacy(b3, true, 50, 3) == 12 and int(b3.ch) == 12, "빈 칸 + Lv50·3차 → 3부까지")
	var b4: Dictionary = S.normalize({})
	check(S.apply_legacy(b4, true, 70, 4) == 16 and int(b4.ch) == 16, "빈 칸 + Lv70·4차 → 4부까지")
	var b5: Dictionary = S.normalize({})
	check(S.apply_legacy(b5, true, 76, 4) == 19 and S.finished(b5), "빈 칸 + Lv76 → 5부까지")
	var c: Dictionary = S.normalize({})
	check(S.apply_legacy(c, true, 3, 0) == 0 and S.pending_scene(c, {"level": 3, "stage": "sinya"}) == "", "빈 칸 + Lv3 → 1장부터(신야성 들어서기)")
	var d: Dictionary = S.normalize({"ch": 1, "step": 0, "done": ["p1_sinya"], "legacy": false})
	check(S.apply_legacy(d, false, 20, 2) == 0 and int(d.ch) == 1, "칸이 있으면 legacy 안 함")
	var e: Dictionary = S.normalize({"ch": 4, "step": 0, "done": ["p1_sinya", "p1_heodo", "p1_field", "p1_job"], "legacy": true})
	check(S.apply_legacy(e, false, 26, 1) == 4 and int(e.ch) == 8, "legacy 진행은 2부 문턱(Lv25)을 넘으면 이어 건너뜀")
	var e2: Dictionary = S.normalize({"ch": 4, "step": 0, "done": [], "legacy": true})
	check(S.apply_legacy(e2, false, 15, 1) == 0 and int(e2.ch) == 4, "legacy 진행이라도 2부 문턱 전이면 2부를 한다")

	# ④ 말한 이
	check(S.speaker("mentor", "") == "🥋 스승" and S.speaker("mentor", "가명") == "🥋 가명" and S.speaker("me", "") == "나 · 무명", "말한 이 표시")
	var m: Dictionary = C.mentor_of("warrior")
	check(String(m.get("name", "")) != "", "1차 무사 스승 이름 %s" % m.get("name", ""))

	# ⑤ 컴파일
	for p in ["res://games/saga_story/world/scenario_runner.gd", "res://games/saga_story/world/story_field.gd", "res://games/saga_story/world/story_town.gd", "res://games/saga_story/ui/goal_board_feed.gd"]:
		var g: GDScript = load(p)
		check(g != null and g.can_instantiate(), "컴파일 " + p.get_file())
	_end()


func _end() -> void:
	print("PROBE scenario_story %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
