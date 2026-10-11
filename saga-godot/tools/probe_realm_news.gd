extends SceneTree

## G-0194 사가천하 영내 소식 자동 점검(games/saga_realm/data/realm_news.gd · realm_rules_month.gd _tick_news/resolve_news).
##   godot --headless --path saga-godot --script res://tools/probe_realm_news.gd
## ① 표: 12종 · 세 갈래 · 대사 두 벌 · 글에 성 자리 · 갈래 축(0 금 = gold/comm · 1 병 = troops/train/food/agri · 2 민심 = sec) · 열두 달 안에 12종 다 조건이 섬
## ② 60달(194): 소식 수 ≥ 성 수 × 0.12 × 60 × 0.8(재미 표준 E, 웹 W-0105 식) · 한 달에 하나 · 쌓인 것 ≤ 3
## ③ 결정성: 같은 시작 두 번 = 같은 소식 줄 ④ 풀기: 풍년 금 갈래 = 금 +300·치안 −3 ⑤ 장수 사건(active_events)과 따로 · 저장 왕복(news)
## 상태는 끝에 되돌린다. 끝에 "PROBE realm_news OK|FAIL n".

const SAVED := ["gold", "year", "month", "cities", "current_city", "roster", "found", "officer_city", "officer_loyal", "officer_growth", "officer_ambition", "enemies_subverted", "active_events", "events_done",
	"lord_succession_enabled", "current_lord_id", "heir_id", "_succession_shock_until", "enemies", "enemy_officer_loyal", "diplomacy", "city_force", "quiz", "result", "diplomacy_peace_streak",
	"scenario_id", "_done_this_month", "scenario_ready", "viewing_map", "officer_hurt", "annals", "news", "story", "path_override"]
const SEED := 20260824

var fails := 0
var S: Node
var N: GDScript


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _reset() -> void:
	S.start_scenario("194")
	S.active_events = []
	S.events_done = {}
	S.lord_succession_enabled = false
	S._rng.seed = SEED


## 60달 — 소식이 오면 그 달 안에 (달 % 3) 갈래로 푼다. 돌려준 값 = [(해·달·id·성)…]
func _sim(months: int) -> Array:
	_reset()
	var seq: Array = []
	var max_pending := 0
	var per_month_ok := true
	for m in months:
		var before: int = S.news.size()
		S.next_month()
		var added: int = S.news.size() - before
		per_month_ok = per_month_ok and added <= 1
		max_pending = maxi(max_pending, S.news.size())
		if added == 1:
			var n: Dictionary = S.news[-1]
			seq.append("%d-%d %s@%s" % [n.year, n.month, n.id, n.city])
		while not S.news.is_empty():
			S.resolve_news(0, m % 3)
	return [seq, max_pending, per_month_ok]


func _initialize() -> void:
	await process_frame
	S = root.get_node("RealmSaveState")
	N = load("res://games/saga_realm/data/realm_news.gd")
	var saved := {}
	for v in SAVED:
		var cur: Variant = S.get(v)
		saved[v] = cur.duplicate(true) if (cur is Dictionary or cur is Array) else cur
	var saved_rng_seed: int = S._rng.seed
	var saved_rng_state: int = S._rng.state

	# ①
	var shape_ok := true
	var axis_ok := true
	for k: String in N.NEWS.keys():
		var d: Dictionary = N.NEWS[k]
		var ch: Array = d.choices
		shape_ok = shape_ok and ch.size() == 3 and String(d.rough) != "" and String(d.gentle) != "" and "%s" in String(d.text)
		axis_ok = axis_ok and ((ch[0] as Dictionary).has("gold") or (ch[0] as Dictionary).has("comm"))
		axis_ok = axis_ok and ((ch[1] as Dictionary).has("troops") or (ch[1] as Dictionary).has("train") or (ch[1] as Dictionary).has("food") or (ch[1] as Dictionary).has("agri"))
		axis_ok = axis_ok and (ch[2] as Dictionary).has("sec")
	var seen := {}
	for m in range(1, 13):
		for k: String in N.eligible(m):
			seen[k] = true
	check(N.NEWS.size() == 12 and shape_ok and axis_ok and seen.size() == 12, "표: 12종 · 세 갈래 · 대사 두 벌 · 갈래 축 금/병/민심 · 열두 달 안에 12종 다 조건이 섬")
	# ②
	var r1: Array = _sim(60)
	var n_city: int = S.cities.size()
	var need: float = float(n_city) * float(N.CHANCE) * 60.0 * 0.8
	check((r1[0] as Array).size() >= need and int(r1[1]) <= N.MAX_PENDING and bool(r1[2]), "60달 소식 %d ≥ %.1f(성 %d × 0.12 × 60 × 0.8) · 한 달 하나 · 쌓임 ≤ %d" % [(r1[0] as Array).size(), need, n_city, N.MAX_PENDING])
	var kinds := {}
	for s: String in r1[0]:
		kinds[s.split(" ")[1].split("@")[0]] = true
	print("  잰값 60달 소식 %d · 종류 %d · 첫 다섯 %s" % [(r1[0] as Array).size(), kinds.size(), str((r1[0] as Array).slice(0, 5))])
	# ③
	var r2: Array = _sim(60)
	check(r1[0] == r2[0], "같은 시작 두 번 → 같은 소식 줄(결정적 해시)")
	# ④
	_reset()
	S.news = [{"id": "harvest", "city": "xuchang", "gov": "sg_zhugeliang", "year": 194, "month": 8}]
	var g0: int = S.gold
	var sec0: int = int(S.cities.xuchang.sec)
	var ok_r: bool = S.resolve_news(0, 0)
	check(ok_r and S.gold == g0 + 300 and int(S.cities.xuchang.sec) == maxi(0, sec0 - 3) and S.news.is_empty() and not S.resolve_news(0, 0), "풍년 금 갈래: 금 +300 · 치안 −3 · 풀면 사라짐 · 두 번은 안 됨")
	# ⑤
	_reset()
	S.news = [{"id": "relic", "city": "xuchang", "gov": "", "year": 194, "month": 2}]
	S.path_override = "user://probe_realm_news_save.json"
	var sv: bool = S.save()
	S.news = []
	var ld: bool = S.try_load()
	check(sv and ld and S.news.size() == 1 and String(S.news[0].id) == "relic" and S.active_events.is_empty(), "저장 왕복(news) · 장수 사건(active_events)과 따로")
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://probe_realm_news_save.json"))

	for v in SAVED:
		S.set(v, saved[v])
	S._rng.seed = saved_rng_seed
	S._rng.state = saved_rng_state
	print("PROBE realm_news ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
