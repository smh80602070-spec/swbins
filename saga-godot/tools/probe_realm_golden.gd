extends SceneTree

## 사가천하 경영 규칙 "골든" 점검 — realm_save_state.gd 를 층으로 쪼갤 때(G-0006) 동작이 한 글자도 안 바뀌었는지 본다.
##   godot --headless --path saga-godot --script res://tools/probe_realm_golden.gd
## 고정 시드로 명령·전쟁·외교·계략·문답·설전·승진·인물 이동·다음 달 ×36 을 스크립트대로 돌리고, 돌려받은 값과 마지막 상태를
## 한 줄 md5 로 낸다. 끝에 "PROBE realm_golden OK md5=…". 기대값(GOLDEN)이 비어 있으면 값만 찍고 OK, 채워져 있으면 다르면 FAIL.
## 진짜 세이브는 안 건드린다(save()·try_load() 안 부름).

const GOLDEN := "a6992811362f0c002ae77013604f180c"  # 10-09 G-0126 시간 틈 아홉을 시작 성 셋 재야로(수색 결과가 달라짐 — 재야 표만 되돌리면 옛 값 9f622a79… 그대로, 확인함) · 10-06 문답 260 을 웹 가명판으로 다시 옮긴 뒤(옛 문답이면 분리 전 값 c0419613… 그대로 — 차이는 문답 글자뿐, 확인함)
const MONTHS := 36

var _log := ""


func _rec(tag: String, v: Variant) -> void:
	_log += tag + "=" + JSON.stringify(v, "", true) + ";"


## 지금 칠 수 있는 적(출진 성이 내 것이고 아직 안 함락) — 정렬해 매번 같은 차례로.
func _targets(S: Node) -> Array:
	var out: Array = []
	var ids: Array = S.enemies.keys()
	ids.sort()
	for e in ids:
		var d: Dictionary = S.RealmCities.enemy_by_id(String(e))
		if S.cities.has(String(d.get("from_city", ""))) and not bool(S.enemies[e].get("captured", false)):
			out.append(e)
	return out


func _initialize() -> void:
	await process_frame  # autoload 의 _ready(성·적·문답 초기화)가 돈 뒤에
	var S: Node = root.get_node("RealmSaveState")
	var fails := 0
	S._rng.seed = 20260824
	var orders := ["agri", "comm", "tech", "sec", "wall", "draft", "train", "ships", "search", "hire"]
	var plots := ["discord", "rumor", "bribe", "fire"]
	for m in MONTHS:
		S.gold = max(S.gold, 5000)
		for cid in S.cities.keys():
			S.cities[cid].troops = max(int(S.cities[cid].troops), 1500)
		_rec("ord%d" % m, S.execute_order(orders[m % orders.size()], 1.0))
		var ids: Array = _targets(S)
		if ids.size() > 0:
			var e: String = ids[m % ids.size()]
			match m % 4:
				0: _rec("atk%d" % m, S.attack(e, ["rock", "paper", "scissors"]))
				1: _rec("tru%d" % m, S.envoy_truce(e, 1.0))
				2: _rec("plt%d" % m, S.plot(plots[(m / 4) % plots.size()], e))
				3: _rec("trb%d" % m, S.envoy_tribute(e))
		if m % 5 == 0 and S.roster.size() > 0:
			var q: Array = S.debate_draw(String(S.roster[0]))
			_rec("dbt%d" % m, S.debate_result(q, [0, 1, 2]))
		var p: Dictionary = S.quiz_draw()
		if not p.is_empty():
			_rec("qz%d" % m, S.quiz_answer(p, m % 4))
		if m % 6 == 2 and S.roster.size() > 1 and S.cities.size() > 1:
			var to: String = String(S.cities.keys()[(m / 6) % S.cities.size()])
			_rec("trf%d" % m, S.transfer_officer(String(S.roster[1]), to))
		if m % 7 == 3 and S.roster.size() > 0:
			var oid := String(S.roster[0])
			S._growth(oid).feats = 99
			_rec("gexp%d" % m, S.gain_exp(oid, 400))
			_rec("prm%d" % m, S.promote(oid))
		S.next_month()
		var due: Array = S.ready_events()
		if due.size() > 0:
			_rec("evt%d" % m, S.resolve_event(due[0], 0))
	_rec("end", {
		"year": S.year, "month": S.month, "gold": S.gold, "cities": S.cities, "roster": S.roster, "enemies": S.enemies,
		"diplomacy": S.diplomacy, "quiz": S.quiz, "growth": S.officer_growth, "loyal": S.officer_loyal, "result": S.result,
		"events_done": S.events_done, "lord": S.current_lord_id,
	})
	# 상속·상수 접근(외부가 RealmSaveState.<CONST> 로 읽는 셋)이 살아 있는지
	_rec("consts", [S.BOSS_BONUS_GOLD, S.CULTURE_VICTORY_CORRECT, S.DIPLOMACY_VICTORY_MONTHS])
	var md5 := _log.md5_text()
	print("  log %dB  actions ok=%d" % [_log.length(), _log.count("\"ok\":true")])
	var cover := ""
	for tag in ["ord", "atk", "tru", "plt", "trb", "dbt", "qz", "trf", "prm", "evt"]:
		var rx := RegEx.create_from_string(tag + "\\d*=\\{[^;]*?\"ok\":true")
		cover += " %s=%d" % [tag, rx.search_all(_log).size()]
	print("  성공한 호출:", cover)
	if GOLDEN != "" and md5 != GOLDEN:
		fails += 1
	print("PROBE realm_golden ", "OK" if fails == 0 else "FAIL %d" % fails, " md5=", md5)
	quit(1 if fails > 0 else 0)
