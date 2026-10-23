extends SceneTree

## G-0328 1만리 신수 일꾼 점검 —
##   godot --headless --path saga-godot --script res://tools/probe_go_workers.gd   → "PROBE go_workers OK" / "FAIL n"
## ① 칸 = 1 + 마당 등급 · 동행·안 가진 신수·같은 신수·칸 넘침 거절 ② 일: 30분에 하나 · 갈래별(무력 강화석·지력 박하/꿀꽃·통솔 고기) · 상한 24
## ③ 받기: 가방에 들어가고 자투리 시간은 이어 셈 · 상한이면 시계 새로 ④ 내보내기: 모은 것 먼저 받음 ⑤ SAGA_HOME_WORK=0 → 앉히기·모으기 없음
## ⑥ 쉼터 화면 배선(수확·일꾼 줄·몸). 시계는 Homestead.time_offset 으로 돌린다. 진짜 세이브는 안 건드린다(메모리만).

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame
	var PS: Node = root.get_node("PartyState")
	var HS: GDScript = load("res://games/saga_go/data/homestead.gd")
	var W: GDScript = load("res://games/saga_go/data/home_workers.gd")
	var saved := {"home": (PS.home as Dictionary).duplicate(true), "bag": (PS.bag as Dictionary).duplicate(true)}
	PS.home = {}
	HS.time_offset = 0.0

	# ①
	check(W.slots() == 1, "① 빈 마당 칸 1")
	var w_dog := String(W.why("pt_dokkaebi", false, ""))
	var w_buddy := String(W.why("pt_dokkaebi", true, "pt_dokkaebi"))
	var ok1 := String(W.assign("pt_dokkaebi", true, ""))
	var full := String(W.why("pt_gumiho", true, ""))
	PS.home.items = [{"id": "shed", "x": 0, "z": 0, "r": 0}]   # 안락 15 → 아담한 마당(등급 1)
	var slots2: int = W.slots()
	var again := String(W.why("pt_dokkaebi", true, ""))
	check(w_dog.contains("만나지") and w_buddy.contains("동행") and ok1 == "" and full.contains("자리") and slots2 == 2 and again.contains("이미"),
		"① 안 가짐·동행·칸 넘침(「%s」)·같은 신수 거절 · 마당 등급 1 → 칸 %d" % [full, slots2])

	# ②
	PS.home.workers = [{"pet": "pt_dokkaebi", "t": HS.now()}, {"pet": "pt_samjogo", "t": HS.now()}]
	HS.time_offset = 95.0 * 60.0
	var pd: Dictionary = W.pending()
	var j_dok: Dictionary = W.job_of("pt_dokkaebi")
	var j_sam: Dictionary = W.job_of("pt_samjogo")
	HS.time_offset = 30.0 * 3600.0
	var capped: int = W.count(W.pending_of(PS.home.workers[0]))
	check(W.count(pd) == 6 and j_sam.items.has("mint") and capped == W.CAP, "② 95분 → 일꾼 둘 × 3 = %d %s · 삼족오(지력) %s · 30시간 상한 %d" % [W.count(pd), str(pd), str(j_sam.items), capped])

	# ③
	HS.time_offset = 0.0
	var t0: float = HS.now()
	PS.home.workers = [{"pet": "pt_samjogo", "t": t0}]
	PS.bag = {}
	HS.time_offset = 95.0 * 60.0
	var got: Dictionary = W.collect(PS.add_items)
	var left_t: float = float(PS.home.workers[0].t) - t0
	check(W.count(got) == 3 and int(PS.bag.get("mint", 0)) == 2 and int(PS.bag.get("honey_flower", 0)) == 1 and is_equal_approx(left_t, 90.0 * 60.0),
		"③ 받기 %s · 가방 박하 2·꿀꽃 1 · 자투리 5분 이어 셈" % str(got))

	# ④
	HS.time_offset = 95.0 * 60.0 + 31.0 * 60.0
	PS.bag = {}
	var rel: Dictionary = W.release("pt_samjogo", PS.add_items)
	check(W.count(rel) == 1 and W.list().is_empty() and PS.count("mint") + PS.count("honey_flower") == 1, "④ 내보내기 → 모은 것 %s 먼저 받음 · 일꾼 0" % str(rel))

	# ⑤
	OS.set_environment("SAGA_HOME_WORK", "0")
	PS.home.workers = [{"pet": "pt_samjogo", "t": 0.0}]
	check(String(W.why("pt_gumiho", true, "")).contains("꺼져") and W.pending().is_empty(), "⑤ SAGA_HOME_WORK=0 → 앉히기·모으기 없음")
	OS.set_environment("SAGA_HOME_WORK", "")

	# ⑥
	var hs := FileAccess.get_file_as_string("res://games/saga_go/world/homestead.gd")
	check(hs.contains("Workers.collect(PartyState.add_items)") and hs.contains("_worker_rows()") and hs.contains("_sync_workers()"), "⑥ 쉼터 배선(수확·일꾼 줄·몸)")

	HS.time_offset = 0.0
	PS.home = saved.home
	PS.bag = saved.bag
	print("PROBE go_workers ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
