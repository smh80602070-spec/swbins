extends Node
## GO 주간 도전(data/weekly_goals.gd · world/weekly_goals.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_WEEKLYGOAL_PROBE 가 있을 때만 단다.
##
##   SAGA_WEEKLYGOAL_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 표(도전 열둘의 셈이 실제로 읽힌다) ② 주마다 다른 다섯(결정적·서로 다른 셈) ③ 주 시작 값·진척 = 지금 − 시작 · 받기 한 번만
## ④ 다섯을 다 받으면 완주 보상(인연 매듭·빛나는 알) ⑤ 주가 바뀌면 새로 짠다 ⑥ 값이 줄어도(회차 등) 음수 진척이 안 나온다 ⑦ 알림 한 번 · 화면.
## 도전 기록·업적 셈·알·가방·경험은 끝에 되돌린다.

const Weekly := preload("res://games/saga_go/data/weekly_goals.gd")

var _p: Node3D
var _n: Node
var _ach: Node
var _fails := 0
var _saved := {}


func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")
	_run.call_deferred()


func _frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("WEEKLYGOAL_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


## 이 셈을 목표만큼 늘린다(늘릴 수 있는 셈만 — 상자·별조각은 상태에서 읽는 값이라 못 늘림).
func _bump(stat: String, n: int) -> bool:
	match stat:
		"walk":
			PartyState.eggs["walk"] = float(PartyState.eggs.get("walk", 0.0)) + float(n)
			return true
		"hatched":
			PartyState.eggs["hatched"] = int(PartyState.eggs.get("hatched", 0)) + n
			return true
		"chests", "shards":
			return false
	_ach.call("add_stat", stat, n, false)
	return true


func _run() -> void:
	await _frames(4)
	_n = get_tree().get_first_node_in_group("go_weekly_goals")
	_ach = get_tree().get_first_node_in_group("go_achievements")
	_saved = {"wg": PartyState.weekly_goals.duplicate(true), "ach": PartyState.achievements.duplicate(true), "eggs": PartyState.eggs.duplicate(true),
		"bag": PartyState.bag.duplicate(), "exp": PartyState.exp}
	PartyState.weekly_goals = {}
	Weekly.week_offset = 0
	var prov: Callable = Callable(_n, "provider")

	# ① 표
	var bad: Array = []
	if Weekly.ORDER.size() != Weekly.POOL.size():
		bad.append("order")
	for id in Weekly.ORDER:
		if not Weekly.POOL.has(id) or Weekly.goal_of(id) <= 0 or not Weekly.desc_of(id).contains(str(Weekly.goal_of(id))):
			bad.append(String(id))
		if int(prov.call(Weekly.stat_of(id))) < 0:
			bad.append("stat " + String(id))
	_check("tables", bad.is_empty() and _n != null and _ach != null, "bad=%s" % [bad])

	# ② 주마다 다른 다섯
	var ok_distinct := true
	var seen := {}
	var differs := false
	for w in 60:
		var pk := Weekly.picks(w)
		var stats := {}
		for id in pk:
			stats[Weekly.stat_of(id)] = true
			seen[id] = true
		ok_distinct = ok_distinct and pk.size() == Weekly.PER_WEEK and stats.size() == Weekly.PER_WEEK
		if w > 0 and pk != Weekly.picks(w - 1):
			differs = true
	_check("picks", ok_distinct and differs and Weekly.picks(7) == Weekly.picks(7) and seen.size() == Weekly.ORDER.size(),
		"distinct=%s differs=%s seen=%d/%d" % [ok_distinct, differs, seen.size(), Weekly.ORDER.size()])

	# ③ 진척·받기
	Weekly.week_offset = 0
	PartyState.weekly_goals = {}
	var w0 := Weekly.week()
	var pk0 := Weekly.picks(w0)
	var id0: String = pk0[0]
	var st0 := Weekly.stat_of(id0)
	Weekly.ensure(prov)
	var p_start := Weekly.progress(id0, prov)
	var bumped := _bump(st0, Weekly.goal_of(id0))
	var p_after := Weekly.progress(id0, prov)
	var not_pick := ""
	for id in Weekly.ORDER:
		if not pk0.has(id):
			not_pick = String(id)
	var mora0: int = PartyState.count("mora")
	var got := Weekly.claim(id0, prov) if bumped else false
	var again := Weekly.claim(id0, prov)
	var foreign := Weekly.claim(not_pick, prov)
	_check("progress_claim", p_start == 0 and (not bumped or p_after >= Weekly.goal_of(id0)) and (not bumped or (got and not again)) and not foreign
		and (not bumped or PartyState.count("mora") >= mora0 + int(Weekly.REWARD.mora)),
		"start=%d after=%d/%d got=%s again=%s foreign=%s" % [p_start, p_after, Weekly.goal_of(id0), got, again, foreign])

	# ④ 완주 보상 — 셈을 늘릴 수 있는 주를 찾아
	var find_w := -1
	for w in range(1, 400):
		var okw := true
		for id in Weekly.picks(w):
			if Weekly.stat_of(id) in ["chests", "shards"]:
				okw = false
		if okw:
			find_w = w
			break
	Weekly.week_offset = find_w - Weekly.Domains.this_week()
	PartyState.weekly_goals = {}
	Weekly.ensure(prov)
	for id in Weekly.picks(Weekly.week()):
		_bump(Weekly.stat_of(id), Weekly.goal_of(id))
	var claimable_n := Weekly.claimable(prov).size()
	var early_bonus := Weekly.claim_bonus()
	for id in Weekly.picks(Weekly.week()):
		Weekly.claim(id, prov)
	var eggs0: int = (PartyState.eggs.get("bag", []) as Array).size()
	var fk0: int = PartyState.count("fate_knot")
	var bonus_ok := bool(_n.call("do_claim_bonus"))
	var bonus_again := bool(_n.call("do_claim_bonus"))
	var eggs1: int = (PartyState.eggs.get("bag", []) as Array).size()
	_check("bonus", find_w > 0 and claimable_n == 5 and not early_bonus and Weekly.all_claimed() and bonus_ok and not bonus_again
		and PartyState.count("fate_knot") >= fk0 + 2 and eggs1 == eggs0 + 1, "week=%d claimable=%d early=%s ok=%s again=%s fk+=%d eggs %d→%d"
		% [find_w, claimable_n, early_bonus, bonus_ok, bonus_again, PartyState.count("fate_knot") - fk0, eggs0, eggs1])

	# ⑤ 주가 바뀌면 새로
	var claimed_before := (PartyState.weekly_goals.claimed as Array).size()
	Weekly.week_offset += 1
	Weekly.ensure(prov)
	_check("new_week", claimed_before == 5 and (PartyState.weekly_goals.claimed as Array).is_empty() and not bool(PartyState.weekly_goals.bonus)
		and int(PartyState.weekly_goals.week) == Weekly.week(), "claimed_before=%d now=%d" % [claimed_before, (PartyState.weekly_goals.claimed as Array).size()])

	# ⑥ 값이 줄어도
	var idn: String = Weekly.picks(Weekly.week())[0]
	var stn := Weekly.stat_of(idn)
	(PartyState.weekly_goals.base as Dictionary)[stn] = int(prov.call(stn)) + 50
	var neg := Weekly.progress(idn, prov)
	_check("no_negative", neg == 0 and int((PartyState.weekly_goals.base as Dictionary)[stn]) == int(prov.call(stn)), "progress=%d" % neg)

	# ⑦ 알림·화면
	Weekly.week_offset = 0
	PartyState.weekly_goals = {}
	Weekly.ensure(prov)
	var idm: String = ""
	for id in Weekly.picks(Weekly.week()):
		if not (Weekly.stat_of(id) in ["chests", "shards"]):
			idm = String(id)
			break
	var fired: Array = []
	_n.connect("completed", func(i): fired.append(i))
	_n.set("_notified", {})
	if idm != "":
		_bump(Weekly.stat_of(idm), Weekly.goal_of(idm))
	_n.call("_check")
	_n.call("_check")
	var opened := bool(_n.call("open_screen"))
	var frozen := bool(_p.get("frozen"))
	await _frames(2)
	var kids := (_n.get("_body") as Node).get_child_count()
	_n.call("close_screen")
	_check("notify_screen", idm == "" or (fired.count(idm) == 1) and opened and frozen and kids >= 7 and not bool(_p.get("frozen")),
		"fired=%s opened=%s frozen=%s kids=%d" % [fired, opened, frozen, kids])

	Weekly.week_offset = 0
	PartyState.weekly_goals = _saved.wg
	PartyState.achievements = _saved.ach
	PartyState.eggs = _saved.eggs
	PartyState.bag = _saved.bag
	PartyState.exp = _saved.exp
	print("WEEKLYGOAL_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
