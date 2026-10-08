extends SceneTree

## G-0086 사가마을 이야기 봄(games/saga_forest/data/scenario.gd·world/scenario_runner.gd) + 공용 대화 창(saga_core/ui/talk_box.gd) 자동 점검 — 세이브 파일 없이.
##   godot --headless --path saga-godot --script res://tools/probe_scenario_forest.gd
## ① 표: 장 넷 id 정본(sp_move·sp_postbox·sp_fox·sp_museum) · 시대 섞기 셋 · talk 장면·말한 이 · 단계 종류 · 금 · 고르기 모양
## ② 흐름 흉내(ctx 사전으로): move1 → 가구 1 → move2 → 숲지기 곁(1장 끝 금 300) → post1 → 꽃밭 → 옛 우체통 → post2 → 숲지기 → fox1 → 꽃 5(4 로는 안 됨, 채집 전 수는 안 셈)
##    → fox2 → 숲지기(기념 꽃놀이 알림) → 하트 1 → fox3 → mus1 → 화석 5 → mus2 고르기 "secret"(봄 끝, 금 합 1800, choices.name)
## ②-2 G-0090 여름: sail1 → 물고기 3 → 숲지기(단오) → sail2 → 낚시꾼 곁 → sail3 → photo1 → 버섯숲·바위 지대·어둑숲 → photo2 → fall1 → 나무뿌리 굴 → fall2 → star1 → 숲지기(칠석) → 하트 3 → star2(여름 끝, 금 합 5200)
## ②-3 G-0094 가을: rumi1 → 광석 3 → 옛 우체통 곁 → rumi2 → ins1 → 곤충 5 → 곤충 기증 5 → ins2 → har1 → 숲지기(한가위) → 주민 둘 하트 3(한 명으론 안 됨) → har2 → cave1 → 북쪽 돌무더기 굴 → cave2 고르기 open(가을 끝, 금 합 10200)
## ②-4 G-0099 겨울: let1 → 주민 다섯 곁(같은 이 두 번은 하나) → 하트 5 → let2 → dong1 → 숲지기(동지) → 주민 셋 하트 3(둘로는 안 됨) → dong2 → ny1 → 숲지기(설날) → 주민 여섯 세배(다섯으론 안 됨)
##    → moon1 → 숲지기(대보름) → 별 우체통 → moon2_open(가을 답) · quiet 답이면 moon2_quiet(겨울 끝, 금 합 18000)
## ②-5 G-0103 둘째 해 봄: rep1 → 주민 둘 → rep2 → hoy1 → 꽃 5 → hoy2 → 하트 6(5 머묾) → hoy3 → reb1 → 옛 돌사당 → reb2 → 편지 한 통 → ans1 → 숲지기(삼짇날) → ans2(금 합 24200)
## ②-6 G-0107 둘째 해 여름: sal1 → 물고기 3 → sal2 → lens1 → 꽃밭·버섯숲(차례) → lens2 → night1 → 어둑숲 → 곤충 3 → night2 → end1 → 숲지기(칠석) → end2(금 합 31600)
## ②-7 G-0108 둘째 해 가을: rum1 → 광석 3 → rum2 → 배달 하나 → rec1 → 조개 기증 3(둘 머묾) → rec2 → yhar1 → 하트 8(7 머묾) → 숲지기(한가위) → yhar2 → ccv1 → 북쪽 동굴 → ccv2(금 합 40300)
## ②-8 G-0109 둘째 해 겨울: wl1 → 주민 다섯 → wl2 → wd1 → 하트 8·숲지기(동지) → wd2 → wy1 → 숲지기(설날)·세배 여섯 → wy2 → wm1 → 숲지기(대보름) → 옛 돌사당 → wm2(금 합 52000)
## ③ 옛 세이브 빈 칸 → 봄 1장 · JSON 왕복 · 이미 가구가 있으면 place 바로 넘어감
## ④ 대화 창: 열면 멈춤·ui_modal · 다음 줄 · 끝 줄 고르기 단추 · pick 하면 닫히고 멈춤 풀림·답 전달 · 고르기 없는 창은 끝 줄 next 로 닫힘
## ⑤ 엔진 스크립트 컴파일·forest_village.gd 컴파일
## 끝에 "PROBE scenario_forest OK" 또는 "PROBE scenario_forest FAIL n".

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var S: GDScript = load("res://games/saga_forest/data/scenario.gd")
	check(S != null, "scenario.gd 를 불러옴")
	if S == null:
		_end()
		return

	# ① 표
	var ids: Array = S.CHAPTERS.map(func(c): return String(c.id))
	check(ids == ["sp_move", "sp_postbox", "sp_fox", "sp_museum", "su_sailor", "su_photo", "su_waterfall", "su_star", "au_rumi", "au_insect", "au_harvest", "au_cave",
		"wi_letters", "wi_dongji", "wi_newyear", "wi_moon", "y2_reply", "y2_hoyeon", "y2_ruin", "y2_bloom",
		"y2_album", "y2_lens", "y2_night", "y2_star",
		"y2_rumi", "y2_record", "y2_moon", "y2_cavebox",
		"y2_wletter", "y2_wdongji", "y2_wyear", "y2_wmoon"], "장 서른둘 id 정본 %s" % [ids])
	var bad: Array = []
	var known := ["talk", "place", "visit", "biome", "spot", "gather", "fest", "heart", "donate", "rounds"]
	for c: Dictionary in S.CHAPTERS:
		for era in ["past", "now", "future"]:
			if String((c.mix as Dictionary).get(era, "")) == "":
				bad.append("%s 시대 %s" % [c.id, era])
		if int(c.get("gold", 0)) <= 0:
			bad.append("%s 금" % c.id)
		for s: Dictionary in c.steps:
			if not known.has(String(s.t)):
				bad.append("%s 모르는 단계 %s" % [c.id, s.t])
			if s.t == "talk":
				var names: Array = [String(s.scene)]
				if s.has("by"):   # 고르기 답마다 장면 하나
					names = ["%s_open" % s.scene, "%s_quiet" % s.scene]
				var lines: Array = []
				for nm in names:
					if (S.scene_def(nm).get("lines", []) as Array).is_empty():
						bad.append("장면 없음 " + nm)
					lines += S.scene_def(nm).get("lines", [])
				var def: Dictionary = S.scene_def(names[0])
				for l: Array in lines:
					if String(l[0]) != "me" and not S.CAST.has(String(l[0])):
						bad.append("%s 모르는 이 %s" % [s.scene, l[0]])
				var chs: Dictionary = def.get("choice", {})
				if not chs.is_empty() and ((chs.get("options", []) as Array).size() < 2 or String(chs.get("id", "")) == ""):
					bad.append("%s 고르기 모양" % s.scene)
	check(bad.is_empty(), "표 규칙 %s" % [bad])

	# ② 흐름
	var st: Dictionary = S.fresh()
	var ctx := {"home_items": 0, "near": {}, "biome": "", "max_heart": 0, "donated": {}}
	var log := {"gold": 0, "fest": []}
	var take := func(arr: Array) -> void:
		for r: Dictionary in arr:
			if r.has("chapter"):
				log.gold = int(log.gold) + int(r.chapter.gold)
			if r.has("fest"):
				(log.fest as Array).append(String(r.fest))
	check(S.pending_scene(st) == "move1", "새 판 첫 단계 move1")
	take.call(S.finish_talk(st, ctx))
	check(S.objective(st).contains("가구 1"), "가구 단계 \"%s\"" % S.objective(st))
	ctx.home_items = 1
	take.call(S.check(st, ctx))
	check(S.pending_scene(st) == "move2", "가구 1 → move2")
	take.call(S.finish_talk(st, ctx))
	check(String(S.step(st).t) == "visit", "move2 → 숲지기에게")
	ctx.near = {"npc_keeper": true}
	take.call(S.check(st, ctx))
	check(int(log.gold) == 300 and S.pending_scene(st) == "post1", "숲지기 곁 → 1장 끝(300) → post1")
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))
	ctx.biome = "dark"
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "biome", "어둑숲으로는 안 넘어감")
	ctx.biome = "meadow"
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "spot" and S.objective(st).contains("옛 우체통"), "꽃밭 → 옛 우체통 \"%s\"" % S.objective(st))
	ctx.near = {"forest_shrine_stone": true}
	take.call(S.check(st, ctx))
	check(S.pending_scene(st) == "post2", "옛 우체통 곁 → post2")
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))
	ctx.near = {"npc_keeper": true}
	take.call(S.check(st, ctx))
	check(int(log.gold) == 700 and S.pending_scene(st) == "fox1", "2장 끝(400) → fox1")
	ctx.near = {}
	S.add_gather(st, "꽃")   # 단계 전 채집 — 안 센다
	take.call(S.finish_talk(st, ctx))
	for i in 4:
		S.add_gather(st, "꽃")
	S.add_gather(st, "과일")
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "gather" and S.objective(st).contains("꽃 채집 4/5"), "꽃 4(과일·단계 전 꽃 빼고) — 머묾 \"%s\"" % S.objective(st))
	S.add_gather(st, "꽃")
	take.call(S.check(st, ctx))
	check(S.pending_scene(st) == "fox2", "꽃 5 → fox2")
	take.call(S.finish_talk(st, ctx))
	ctx.near = {"npc_keeper": true}
	take.call(S.check(st, ctx))
	check(log.fest == ["samjin"] and String(S.step(st).t) == "heart", "숲지기 곁 → 기념 꽃놀이 알림 → 하트 단계")
	ctx.max_heart = 1
	take.call(S.check(st, ctx))
	check(S.pending_scene(st) == "fox3", "하트 1 → fox3")
	take.call(S.finish_talk(st, ctx))
	check(int(log.gold) == 1200 and S.pending_scene(st) == "mus1", "3장 끝(500) → mus1")
	take.call(S.finish_talk(st, ctx))
	ctx.donated = {"화석": 4}
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "donate", "화석 4 로는 머묾")
	ctx.donated = {"화석": 5}
	take.call(S.check(st, ctx))
	check(S.pending_scene(st) == "mus2", "화석 5 → mus2")
	take.call(S.finish_talk(st, ctx, "secret"))
	check(int(log.gold) == 1800 and String((st.choices as Dictionary).get("name", "")) == "secret" and (st.done as Array).size() == 4 and S.pending_scene(st) == "sail1",
		"봄 끝 — 금 %d · 고르기 %s → 여름 sail1" % [int(log.gold), st.choices])

	# ②-2 여름
	check(S.objective(st).begins_with("📜 여름 5장"), "여름 목표판 \"%s\"" % S.objective(st))
	ctx = {"home_items": 1, "near": {}, "biome": "", "max_heart": 1, "donated": {"화석": 5}}
	take.call(S.finish_talk(st, ctx))
	S.add_gather(st, "물고기", 2)
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "gather" and S.objective(st).contains("물고기 채집 2/3"), "물고기 2 머묾")
	S.add_gather(st, "물고기", 1)
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "fest", "물고기 3 → 단오")
	ctx.near = {"npc_keeper": true}
	take.call(S.check(st, ctx))
	check(log.fest.has("dano") and S.pending_scene(st) == "sail2", "숲지기 곁 → 단오 알림 → sail2")
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))
	check(String(S.step(st).get("npc", "")) == "npc_angler", "낚시꾼에게")
	ctx.near = {"npc_keeper": true}
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "visit", "숲지기 곁으론 안 넘어감")
	ctx.near = {"npc_angler": true}
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # sail3
	check(int(log.gold) == 2500 and S.pending_scene(st) == "photo1", "5장 끝(700) → photo1")
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))
	for b in ["mush", "rocky", "dark"]:
		ctx.biome = b
		take.call(S.check(st, ctx))
	check(S.pending_scene(st) == "photo2", "버섯숲·바위 지대·어둑숲 → photo2")
	take.call(S.finish_talk(st, ctx))
	take.call(S.finish_talk(st, ctx))   # fall1
	check(String(S.step(st).get("shape", "")) == "cave" and S.objective(st).contains("폭포 뒤 굴"), "굴 표지 단계")
	ctx.near = {"forest_root": true}
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # fall2
	check(int(log.gold) == 4200 and S.pending_scene(st) == "star1", "6·7장 끝 → star1")
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))
	ctx.near = {"npc_keeper": true}
	take.call(S.check(st, ctx))
	check(log.fest.has("chilseok") and String(S.step(st).t) == "heart", "칠석 → 하트 3 단계")
	ctx.max_heart = 3
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # star2
	check(int(log.gold) == 5200 and (st.done as Array).size() == 8 and S.pending_scene(st) == "rumi1", "여름 끝 — 금 합 %d → 가을 rumi1" % int(log.gold))

	# ②-3 가을
	ctx = {"home_items": 1, "near": {}, "biome": "", "max_heart": 3, "hearts": [3, 1, 0, 0, 0, 0], "donated": {"화석": 5}}
	take.call(S.finish_talk(st, ctx))
	for i in 3:
		S.add_gather(st, "광석")
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "spot" and String(S.step(st).key) == "forest_shrine_stone" and S.objective(st).begins_with("📜 가을 9장"), "광석 3 → 옛 우체통 \"%s\"" % S.objective(st))
	ctx.near = {"forest_shrine_stone": true}
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # rumi2
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))   # ins1
	for i in 5:
		S.add_gather(st, "곤충")
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "donate", "곤충 5 → 기증 단계")
	ctx.donated = {"화석": 5, "곤충": 5}
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # ins2
	check(int(log.gold) == 7500 and S.pending_scene(st) == "har1", "9·10장 끝 → har1")
	take.call(S.finish_talk(st, ctx))
	ctx.near = {"npc_keeper": true}
	take.call(S.check(st, ctx))
	check(log.fest.has("chuseok") and String(S.step(st).t) == "heart" and S.objective(st).contains("주민 2명 하트 3"), "한가위 → 주민 둘 하트 3")
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "heart", "한 명만 3이면 머묾")
	ctx.hearts = [3, 4, 0, 0, 0, 0]
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # har2
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))   # cave1
	check(String(S.step(st).get("shape", "")) == "cave" and String(S.step(st).key) == "forest_cairn_ne", "북쪽 동굴 굴 표지")
	ctx.near = {"forest_cairn_ne": true}
	take.call(S.check(st, ctx))
	check(S.pending_scene(st) == "cave2" and S.scene_def("cave2").has("choice"), "cave2 고르기")
	take.call(S.finish_talk(st, ctx, "open"))
	check(int(log.gold) == 10200 and (st.done as Array).size() == 12 and String(st.choices.get("crack", "")) == "open" and S.pending_scene(st) == "let1", "가을 끝 — 금 합 %d · 고르기 %s → 겨울 let1" % [int(log.gold), st.choices])

	# ②-4 G-0099 겨울
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))   # let1
	check(String(S.step(st).t) == "rounds" and S.objective(st).contains("주민에게 편지 전하기 0/5"), "편지 단계 \"%s\"" % S.objective(st))
	ctx.near = {"npc_keeper": true}
	take.call(S.check(st, ctx))
	ctx.near = {"npc_keeper": true, "npc_angler": false}
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "rounds" and (st.rounds as Array).size() == 1, "같은 주민 두 번은 하나")
	ctx.near = {"npc_angler": true, "npc_merchant": true, "npc_explorer": true, "npc_herbalist": true}
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "heart" and int(S.step(st).n) == 5, "주민 다섯 → 하트 5")
	ctx.max_heart = 5
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # let2
	check(int(log.gold) == 11700 and S.pending_scene(st) == "dong1", "13장 끝(1500) → dong1")
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))   # dong1
	ctx.near = {"npc_keeper": true}
	take.call(S.check(st, ctx))
	check(log.fest.has("dongji") and S.objective(st).contains("주민 3명 하트 3"), "동지 팥죽 → 주민 셋 하트 3")
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "heart", "둘만 3이면 머묾")
	ctx.hearts = [3, 4, 3, 0, 0, 0]
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # dong2
	take.call(S.finish_talk(st, ctx))   # ny1
	take.call(S.check(st, ctx))   # 숲지기 곁 — 설날
	check(log.fest.has("seollal") and String(S.step(st).t) == "rounds" and int(S.step(st).n) == 6 and (st.rounds as Array).size() == 1, "설날 → 세배 여섯(숲지기는 이미 곁)")
	ctx.near = {"npc_angler": true, "npc_merchant": true, "npc_explorer": true, "npc_herbalist": true}
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "rounds", "다섯으로는 머묾")
	ctx.near = {"npc_wanderer": true}
	take.call(S.check(st, ctx))
	check(int(log.gold) == 15000 and S.pending_scene(st) == "moon1", "15장 끝(1600+1700) → moon1")
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))   # moon1
	ctx.near = {"npc_keeper": true}
	take.call(S.check(st, ctx))
	check(log.fest.has("daeborum") and String(S.step(st).t) == "spot" and String(S.step(st).key) == "forest_shrine_stone", "대보름 → 별 우체통 표지")
	ctx.near = {"forest_shrine_stone": true}
	take.call(S.check(st, ctx))
	check(S.pending_scene(st) == "moon2_open", "가을 답 open → moon2_open")
	take.call(S.finish_talk(st, ctx))
	check(int(log.gold) == 18000 and (st.done as Array).size() == 16 and S.pending_scene(st) == "rep1", "겨울 끝 — 금 합 %d → 둘째 해 rep1" % int(log.gold))

	# ②-5 G-0103 둘째 해 봄
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))   # rep1
	check(S.objective(st).begins_with("📜 둘째 해 봄 17장") and S.objective(st).contains("답장 전하기 0/2"), "둘째 해 봄 답장 \"%s\"" % S.objective(st))
	ctx.near = {"npc_angler": true, "npc_merchant": true}
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # rep2
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))   # hoy1
	check(String(S.step(st).t) == "gather" and String(S.step(st).cat) == "꽃", "호연 → 꽃 5")
	for i in 5:
		S.add_gather(st, "꽃")
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # hoy2
	ctx.max_heart = 5
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "heart" and int(S.step(st).n) == 6, "하트 5 로는 머묾(6)")
	ctx.max_heart = 6
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # hoy3
	check(int(log.gold) == 19700 and S.pending_scene(st) == "reb1", "17·18장 끝 → reb1")
	take.call(S.finish_talk(st, ctx))
	ctx.near = {"forest_shrine_stone": true}
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # reb2
	check(String(S.step(st).t) == "rounds" and int(S.step(st).n) == 1 and (st.rounds as Array).is_empty(), "편지 한 통(명소 곁은 주민 아님)")
	ctx.near = {"npc_herbalist": true}
	take.call(S.check(st, ctx))
	check(S.pending_scene(st) == "ans1", "19장 끝 → ans1")
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))
	ctx.near = {"npc_keeper": true}
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # ans2
	check(int(log.gold) == 24200 and (st.done as Array).size() == 20 and S.pending_scene(st) == "sal1", "둘째 해 봄 끝 — 금 합 %d → 여름 sal1" % int(log.gold))

	# ②-6 G-0107 둘째 해 여름
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))   # sal1
	check(S.objective(st).begins_with("📜 둘째 해 여름 21장") and S.objective(st).contains("물고기 채집 0/3"), "사진첩 물고기 \"%s\"" % S.objective(st))
	S.add_gather(st, "물고기", 3)
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # sal2
	take.call(S.finish_talk(st, ctx))   # lens1
	ctx.biome = "mush"
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "biome" and String(S.step(st).key) == "meadow", "버섯숲 먼저 가도 꽃밭부터")
	for b in ["meadow", "mush"]:
		ctx.biome = b
		take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # lens2
	take.call(S.finish_talk(st, ctx))   # night1
	ctx.biome = "dark"
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "gather" and String(S.step(st).cat) == "곤충", "어둑숲 → 곤충 3")
	S.add_gather(st, "곤충", 3)
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # night2
	take.call(S.finish_talk(st, ctx))   # end1
	ctx.near = {"npc_keeper": true}
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # end2
	check(int(log.gold) == 31600 and (st.done as Array).size() == 24 and S.pending_scene(st) == "rum1", "둘째 해 여름 끝 — 금 합 %d → 가을 rum1" % int(log.gold))

	# ②-7 G-0108 둘째 해 가을
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))   # rum1
	S.add_gather(st, "광석", 3)
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # rum2
	ctx.near = {"npc_wanderer": true}
	take.call(S.check(st, ctx))
	check(S.pending_scene(st) == "rec1", "광석 3 → 배달 하나 → rec1")
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))   # rec1
	ctx.donated = {"화석": 5, "곤충": 5, "조개": 2}
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "donate" and String(S.step(st).cat) == "조개", "조개 둘로는 머묾")
	ctx.donated = {"화석": 5, "곤충": 5, "조개": 3}
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # rec2
	check(S.pending_scene(st) == "yhar1" and not S.scene_def("yhar1").is_empty(), "26장 끝 → yhar1(첫해 har1 과 다른 장면)")
	take.call(S.finish_talk(st, ctx))
	ctx.max_heart = 7
	take.call(S.check(st, ctx))
	check(String(S.step(st).t) == "heart" and int(S.step(st).n) == 8, "하트 7 로는 머묾")
	ctx.max_heart = 8
	ctx.near = {"npc_keeper": true}
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # yhar2
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))   # ccv1
	ctx.near = {"forest_cairn_ne": true}
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # ccv2
	check(int(log.gold) == 40300 and (st.done as Array).size() == 28 and S.pending_scene(st) == "wl1", "둘째 해 가을 끝 — 금 합 %d → 겨울 wl1" % int(log.gold))

	# ②-8 G-0109 둘째 해 겨울
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))   # wl1
	ctx.near = {"npc_keeper": true, "npc_angler": true, "npc_merchant": true, "npc_explorer": true, "npc_herbalist": true}
	take.call(S.check(st, ctx))
	check(S.pending_scene(st) == "wl2", "주민 다섯 → wl2")
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))   # wl2
	take.call(S.finish_talk(st, ctx))   # wd1
	ctx.max_heart = 8
	ctx.near = {"npc_keeper": true}
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # wd2
	take.call(S.finish_talk(st, ctx))   # wy1 (숲지기 곁 그대로 → 설날·세배 하나)
	ctx.near = {"npc_angler": true, "npc_merchant": true, "npc_explorer": true, "npc_herbalist": true, "npc_wanderer": true}
	take.call(S.check(st, ctx))
	check(S.pending_scene(st) == "wy2", "설날 → 여섯 세배 → wy2")
	ctx.near = {}
	take.call(S.finish_talk(st, ctx))   # wy2
	take.call(S.finish_talk(st, ctx))   # wm1
	ctx.near = {"npc_keeper": true}
	take.call(S.check(st, ctx))
	ctx.near = {"forest_shrine_stone": true}
	take.call(S.check(st, ctx))
	take.call(S.finish_talk(st, ctx))   # wm2
	check(S.finished(st) and int(log.gold) == 52000 and (st.done as Array).size() == 32 and S.objective(st) == "", "둘째 해 겨울 끝(웹 이야기 끝) — 금 합 %d" % int(log.gold))
	check(S.pending_scene(S.normalize({"ch": 15, "step": 3, "choices": {"crack": "quiet"}})) == "moon2_quiet", "답 quiet → moon2_quiet")
	check(S.pending_scene(S.normalize({"ch": 15, "step": 3})) == "moon2_open", "답 없으면 첫 답 open")

	# ③ 옛 세이브
	check(S.normalize({}) == S.fresh(), "빈 칸 → 봄 1장")
	var js: Dictionary = S.normalize(JSON.parse_string(JSON.stringify({"ch": 2, "step": 1, "base": 1, "gathered": {"꽃": 3}, "done": ["sp_move", "sp_postbox"], "choices": {}})))
	check(String(S.step(js).t) == "gather" and S.gathered(js, "꽃") == 3, "JSON 왕복(실수 칸)")
	var had: Dictionary = S.fresh()
	S.finish_talk(had, {"home_items": 3, "near": {}, "biome": "", "max_heart": 0, "donated": {}})
	check(S.pending_scene(had) == "move2", "가구가 이미 있으면 place 바로 넘어감")

	# ④ 대화 창
	var TB: GDScript = load("res://saga_core/ui/talk_box.gd")
	var got := {"answer": "-", "n": 0}
	var box: CanvasLayer = TB.open(root, "제목", [["가", "하나"], ["나", "둘"]], func(a: String) -> void:
		got.answer = a
		got.n = int(got.n) + 1, {"id": "q", "prompt": "고를까", "options": [{"key": "y", "label": "예"}, {"key": "n", "label": "아니요"}]})
	await process_frame
	check(paused and box.is_in_group("ui_modal") and not box.call("is_last_line"), "창 열림 — 멈춤·ui_modal·첫 줄")
	box.call("next_line")
	await process_frame
	var btns: Array = box.find_children("*", "Button", true, false).filter(func(b): return not b.is_queued_for_deletion())
	check(box.call("is_last_line") and btns.size() == 2, "끝 줄 — 고르기 단추 둘(%d)" % btns.size())
	box.call("next_line")   # 고르기가 있으면 next 로는 안 닫힘
	check(int(got.n) == 0, "고르기 끝 줄에서 다음은 무시")
	box.call("pick", "n")
	await process_frame
	check(int(got.n) == 1 and got.answer == "n" and not paused and get_nodes_in_group("ui_modal").is_empty(), "고르면 닫힘·멈춤 풀림·답 n")
	var got2 := {"answer": "-"}
	var box2: CanvasLayer = TB.open(root, "t", [["가", "하나"]], func(a: String) -> void: got2.answer = a)
	await process_frame
	box2.call("next_line")
	await process_frame
	check(got2.answer == "" and not paused, "고르기 없는 창은 끝 줄 다음으로 닫힘")

	# ⑤ 엔진
	var R: GDScript = load("res://games/saga_forest/world/scenario_runner.gd")
	check(R != null and R.can_instantiate(), "scenario_runner.gd 컴파일")
	var V: GDScript = load("res://games/saga_forest/world/forest_village.gd")
	check(V != null and V.can_instantiate(), "forest_village.gd 컴파일(엔진 배선)")
	_end()


func _end() -> void:
	print("PROBE scenario_forest %s" % ("OK" if fails == 0 else "FAIL %d" % fails))
	quit(0 if fails == 0 else 1)
