extends SceneTree

## 사가천하 실패와 회복(재미 표준 F, SAGA-DESIGN §3) 측정 — 공성에 져서 "얼마 잃나·몇 번 눌러 다시 치나·몇 달에 되찾나"를 숫자로 낸다(G-0180). 규칙·수치는 안 고친다. 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_realm_defeat.gd
## ① 지는 판 셋(허창 병력 500·2000·셋째, 훈련 10·기술 100, 소패 기본 수비 — 5000 은 씨앗 20260824 에서 이겨 버려 셋째는 5000 부터 100씩 내려 처음 지는 병력): 짐 · 성 수·태수·금 그대로 · 군량 = 전 − need + 치중 · 잃은 병력 %(출진 대비·나라 전체 대비)
## ② 재도전: 진 달에 다시 치면 거절(이유는 병력 따라 "오백"·"장수 없음") · 그 뒤 실제로 먹힌 조작(next_month·draft·attack)만 세어 다시 ok 가 될 때까지(상한 8, 거절된 시도는 안 셈 — 화면에선 단추가 막혀 있다)
## ③ 회복: 같은 패배에서 매달 draft+next_month 로 출진 전 병력에 닿는 달 수(상한 24)
## ④ 전술판(G-0182·G-0188): 같은 판 셋 × 장수 수 둘(시작 판 1명 · 3명) × 결과(자동으로 둔 실제 결과 + 강제 넷 rout·win·draw·lose) — won · 잃은 병력 % · 전사·중상 ·
##   전사 장수가 나라 장수의 몇 % · 다음 출진까지 조작 수(장수가 없으면 "다시 못 침") · 회복 달. 전술 없는 판은 ①과 같은 값이어야 한다.
## FAIL 은 ①의 구조와 ②가 상한 안에 닿는지만 — %·달 수가 F 기준(비용 10~20%·조작 ≤3)을 넘으면 "F기준 밖"만 찍는다. 상태는 끝에 되돌린다.
## 끝에 "PROBE realm_defeat OK" 또는 "PROBE realm_defeat FAIL n".

const SAVED := ["gold", "year", "month", "cities", "current_city", "roster", "found", "officer_city", "officer_loyal", "officer_growth", "officer_ambition", "enemies_subverted", "active_events", "events_done",
	"lord_succession_enabled", "current_lord_id", "heir_id", "_succession_shock_until", "enemies", "enemy_officer_loyal", "diplomacy", "city_force", "quiz", "result", "diplomacy_peace_streak",
	"scenario_id", "_done_this_month", "scenario_ready", "viewing_map", "officer_hurt", "annals"]
const SEED := 20260824
const TROOPS := [500, 2000]
const TROOPS_TOP := 5000
const RETRY_CAP := 8
const RECOVER_CAP := 24

var fails := 0
var S: Node
var Orders: GDScript
var Diplo: GDScript


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _reset(scenario: String = "194") -> void:  # probe_realm_state 와 같은 출발점
	S.start_scenario(scenario)
	S.active_events = []
	S.events_done = {}
	S.lord_succession_enabled = false
	S.current_lord_id = Diplo.LORD_ID
	S.heir_id = ""
	S._succession_shock_until = {}
	S.diplomacy_peace_streak = 0
	S._rng.seed = SEED


func _fund() -> void:
	S.gold = 9000
	for cid in S.cities.keys():
		S.cities[cid].troops = maxi(int(S.cities[cid].troops), 2000)
		S.cities[cid].food = maxi(int(S.cities[cid].food), 30000)


func _total_troops() -> int:
	var t := 0
	for cid in S.cities.keys():
		t += int(S.cities[cid].troops)
	return t


## 지는 판 하나를 세운다 — 반환: 패배 직전 수치와 attack() 결과
func _lose(troops: int, extra: Array = []) -> Dictionary:
	_reset()
	_fund()
	for id: String in extra:   # ④ — 허창에 장수를 더 둔다(메모리에서만)
		S.roster.append(id)
		S.officer_city[id] = "xuchang"
	S.cities.xuchang.troops = troops
	S.cities.xuchang.train = 10
	S.cities.xuchang.tech = 100
	var pre := {"troops": troops, "total": _total_troops(), "cities": S.cities.size(), "gold": S.gold, "food": int(S.cities.xuchang.food),
		"gov": S.officer_city.duplicate(), "need": Orders.food_upkeep(troops) * 2, "baggage": Orders.food_upkeep(troops)}
	pre["at"] = S.attack("xiaopei")
	return pre


## ④ — 같은 시작에서 전술 보정(grid)을 실어 친다
func _lose_grid(troops: int, extra: Array, grid: Dictionary) -> Dictionary:
	_reset()
	_fund()
	for id: String in extra:
		S.roster.append(id)
		S.officer_city[id] = "xuchang"
	S.cities.xuchang.troops = troops
	S.cities.xuchang.train = 10
	S.cities.xuchang.tech = 100
	return {"total": _total_troops(), "at": S.attack("xiaopei", [], grid)}


func _initialize() -> void:
	await process_frame
	S = root.get_node("RealmSaveState")
	Orders = load("res://games/saga_realm/data/realm_orders.gd")
	Diplo = load("res://games/saga_realm/data/realm_diplo.gd")
	var saved := {}
	for v in SAVED:
		var cur: Variant = S.get(v)
		saved[v] = cur.duplicate(true) if (cur is Dictionary or cur is Array) else cur
	var saved_rng_seed: int = S._rng.seed
	var saved_rng_state: int = S._rng.state

	var cases: Array = TROOPS.duplicate()
	var top := TROOPS_TOP
	while top > int(TROOPS[-1]) and bool(_lose(top).at.won):
		top -= 100
	print("셋째 판: %d 은 이김 → 처음 지는 병력 %d" % [TROOPS_TOP, top] if top != TROOPS_TOP else "셋째 판: %d" % top)
	if top > int(TROOPS[-1]):
		cases.append(top)
	check(cases.size() == 3, "지는 판 셋을 세움(%s)" % str(cases))
	var summary: Array = []
	for troops: int in cases:
		print("— 출진 %d" % troops)
		# ① 비용
		var pre := _lose(troops)
		var at: Dictionary = pre.at
		var left: int = int(S.cities.xuchang.troops)
		var lost: int = troops - left
		var pct_army := 100.0 * float(lost) / float(troops)
		var pct_nation := 100.0 * float(lost) / float(pre.total)
		check(at.ok and not at.won, "지는 판: attack ok·won=false")
		check(S.cities.size() == pre.cities and S.officer_city == pre.gov and S.gold == pre.gold, "성 %d·태수·금 %d 그대로" % [pre.cities, pre.gold])
		check(int(S.cities.xuchang.food) == pre.food - pre.need + pre.baggage, "군량 %d → %d (need %d · 치중 %d 돌아옴)" % [pre.food, int(S.cities.xuchang.food), pre.need, pre.baggage])
		var cost_in := pct_nation >= 10.0 and pct_nation <= 20.0
		print("  잰값 잃은 병력 %d — 출진 대비 %.1f%% · 나라 전체(%d) 대비 %.1f%%%s" % [lost, pct_army, pre.total, pct_nation, "" if cost_in else " (F기준 밖: 10~20%)"])

		# ② 재도전 — 진 달에 바로 다시 치면 거절, 그 뒤 조작 수
		var again: Dictionary = S.attack("xiaopei")
		check(not again.ok and int(S.cities.xuchang.troops) == left, "진 달에 다시 치면 거절(%s)·병력 그대로" % String(again.get("why", "")))
		var ops := 0
		var log: Array = []
		var retried := false
		while ops < RETRY_CAP:
			var a: Dictionary = S.attack("xiaopei")
			if a.ok:
				ops += 1
				log.append("attack")
				retried = true
				break
			# 병력이 모자라면 징병부터(장수가 이 달에 쓰였으면 안 먹힌다 — 상태 그대로), 아니면 달을 넘긴다
			if "오백" in String(a.get("why", "")) and S.execute_order("draft").ok:
				log.append("draft")
			else:
				S.next_month()
				log.append("next_month")
			ops += 1
		check(retried, "재도전이 조작 %d 안에 다시 ok" % RETRY_CAP)
		print("  잰값 재도전 조작 %d (%s)%s" % [ops, " → ".join(log), "" if ops <= 3 else " (F기준 밖: ≤3)"])

		# ③ 회복 — 같은 패배에서 매달 draft+next_month
		_lose(troops)
		var months := 0
		while int(S.cities.xuchang.troops) < troops and months < RECOVER_CAP:
			S.execute_order("draft")
			S.next_month()
			months += 1
		var reached: bool = int(S.cities.xuchang.troops) >= troops
		print("  잰값 회복 %s (병력 %d/%d)" % [("%d달" % months) if reached else ("%d달 안에 못 닿음" % RECOVER_CAP), int(S.cities.xuchang.troops), troops])
		summary.append("%d: 비용 %.1f%%(출진 %.1f%%)·조작 %d·회복 %s" % [troops, pct_nation, pct_army, ops, ("%d달" % months) if reached else ">%d달" % RECOVER_CAP])

	print("잰값 요약 — ", " | ".join(summary))

	# ④ 전술판
	var T: GDScript = load("res://games/saga_realm/data/realm_tactics.gd")
	var t_summary: Array = []
	for extra: Array in [[], ["sg_xiahoudun", "sg_zhangliao"]]:
		for troops: int in cases:
			# 자동 결과 — 판을 연 그 자리 그대로(attack 앞)
			_lose(troops, extra)   # 시작 상태 맞추기만(이 attack 결과는 버림)
			_reset()
			_fund()
			for id: String in extra:
				S.roster.append(id)
				S.officer_city[id] = "xuchang"
			S.cities.xuchang.troops = troops
			S.cities.xuchang.train = 10
			S.cities.xuchang.tech = 100
			var auto: Dictionary = S.tactics_auto("xiaopei")
			var mine: Array = auto.get("mine", [])
			var grids := {"auto": auto}
			for k: String in ["rout", "win", "draw", "lose"]:
				var o: Dictionary = T.OUT[k]
				var g: Dictionary = T.apply({"kind": k, "winPct": o.winPct, "lossMul": o.lossMul, "fallen": mine.duplicate() if k == "lose" else [], "wounded": []}, "xiaopei")
				g["mine"] = mine
				grids[k] = g
			for gk: String in ["auto", "rout", "win", "draw", "lose"]:
				var g2: Dictionary = grids[gk]
				var pre2 := _lose_grid(troops, extra, g2)
				var at2: Dictionary = pre2.at
				var left2 := int(S.cities.xuchang.troops)
				var lost2 := troops - left2 if not bool(at2.get("won", false)) else troops - int(S.cities.get("xiaopei", {}).get("troops", 0))
				var fallen: Array = at2.get("fallen", [])
				var roster_before := 1 + extra.size()
				if gk == "lose":
					var hurt2: Array = at2.get("hurt", [])
					check(not at2.won and fallen.size() + hurt2.size() == mine.size() and S.annals.size() == fallen.size() and not S.roster.is_empty() and hurt2.size() == (1 if mine.size() == roster_before else 0),
						"전술 패(%d·장수 %d): 판에 선 %d 모두 쓰러짐 — 전사 %d·중상 %d(로스터가 비면 하나는 중상, G-0189)" % [troops, roster_before, mine.size(), fallen.size(), hurt2.size()])
				# 다음 출진까지 — 먹힌 조작만
				var ops := 0
				var can := false
				if not bool(at2.get("won", false)):
					while ops < RETRY_CAP:
						var a: Dictionary = S.attack("xiaopei")
						if a.ok:
							ops += 1
							can = true
							break
						if "오백" in String(a.get("why", "")) and S.execute_order("draft").ok:
							pass
						else:
							S.next_month()
						ops += 1
				var line := "%s/%d명·%d: %s %s · 잃은 병력 %.1f%%(나라) · 전사 %d(장수의 %.0f%%)·중상 %d · 다음 출진 %s" % [gk, roster_before, troops, String(at2.get("grid", "")), "함락" if at2.get("won", false) else "짐",
					100.0 * float(lost2) / float(pre2.total), fallen.size(), 100.0 * float(fallen.size()) / float(roster_before), (at2.get("hurt", []) as Array).size(),
					"—(함락)" if at2.get("won", false) else (("조작 %d" % ops) if can else "다시 못 침(장수 없음 — 등용부터)")]
				print("  잰값 ④ ", line)
				if gk == "auto" or gk == "lose":
					t_summary.append(line)
	print("잰값 요약 ④ — ", " | ".join(t_summary))
	# 되돌리기
	for v in SAVED:
		S.set(v, saved[v])
	S._rng.seed = saved_rng_seed
	S._rng.state = saved_rng_state
	print("PROBE realm_defeat ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
