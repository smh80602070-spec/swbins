extends SceneTree

## GO 맞서기 규칙(data/duel_rules.gd — 승산·기세·예고·저스트 회피·부위 파괴(스태거)·75초 토벌)과 발견 밀도 계산(saga_core/world/density_report.gd) 자동 점검 — 화면 없는 순수 규칙. 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_duel.gd
## ① 승산: win_chance 는 힘 비율·12~88% 에 끼움·내 힘이 클수록 오름 ② 만들기: 체력·적 공격·사기 하한 200·시작 상태 ③ 일격·기: 쿨다운 0.35·피해 ±10%·기 +9·꽉 차면 필살(×0.62)·모자라면 거절
## ④ 적 차례: 2.6초마다 치고 세 번째는 예고(1.1초) 뒤 강공격(×2.4) ⑤ 회피: 예고 중에만·그냥 회피는 15%·저스트(예고 끝 0.25초 안)는 0 피해 + 기 +30%
## ⑥ 부위 파괴: 토벌(is_raid)만 체력 75·50·25%에서 스태거(한 번씩·필살로 몰아 깎으면 한꺼번에) ⑦ 끝: 처치·퇴각(사기 0)·시간 초과·물러남 · 씬 설정(도적 두목이 75초·토벌)
## ⑧ 발견 밀도: 빈 칸 비율 = 반경 밖 칸/걸을 수 있는 칸 · 지역 10 모두 걸을 수 있는 칸이 있고 점이 없으면 100%%. 끝에 "PROBE duel OK" 또는 "PROBE duel FAIL n".

const Duel := preload("res://games/saga_go/data/duel_rules.gd")
const Density := preload("res://saga_core/world/density_report.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	seed(20260824)

	# ① 승산
	check(absf(Duel.win_chance(100.0, 100.0) - 0.5) < 1e-9, "승산: 같은 힘이면 50%")
	var mono := true
	var prev := 0.0
	for m in range(10, 400, 10):
		var w: float = Duel.win_chance(float(m), 120.0)
		mono = mono and w >= prev and w >= 0.12 and w <= 0.88
		prev = w
	check(mono and Duel.win_chance(1000.0, 1.0) == 0.88 and Duel.win_chance(1.0, 1000.0) == 0.12 and absf(Duel.win_chance(200.0, 100.0) - 2.0 / 3.0) < 1e-9, "승산: 내 힘이 클수록 오르고 12~88%에 끼움(200 대 100 = 67%)")

	# ② 만들기
	var d: Duel = Duel.create(700.0, 30.0, 40.0)
	check(d.foe_hp == 700.0 and d.hp == 700.0 and d.foe_atk == 7.0 and d.my_atk == 30.0 and d.morale == 200.0 and d.morale_max == 200.0 and d.left == 60.0 and d.ki == 0.0 and not d.over and not d.is_raid, "create: 적 체력 700 · 공격 = 체력×1% · 사기 = 방어×3 의 하한 200 · 60초")
	var d2: Duel = Duel.create(50.0, 0.2, 100.0, 75.0, true)
	check(d2.foe_atk == 1.0 and d2.my_atk == 1.0 and d2.morale == 300.0 and d2.left == 75.0 and d2.is_raid and Duel.create(0.0, 5.0, 5.0).foe_hp == 1.0, "하한: 공격 1 · 방어 100 → 사기 300 · 토벌은 시간·표지를 받음")

	# ③ 일격·기
	var q: Dictionary = d.act("quick")
	check(q.ok and q.dmg >= roundf(30.0 * 0.10 * 0.9) and q.dmg <= roundf(30.0 * 0.10 * 1.1) and d.ki == 9.0 and d.cd == 0.35 and d.hits == 1 and d.hp == 700.0 - q.dmg, "일격: 피해 ±10%% · 기 +9 · 쿨다운 0.35")
	check(not d.act("quick").ok and d.act("quick").reason == "cd" and not d.act("ult").ok and d.act("ult").reason == "noki" and not d.act("zzz").ok and d.act("zzz").reason == "what", "쿨다운 중 일격·기 부족 필살·모르는 행동은 거절")
	d.ki = Duel.KI_MAX
	var hp_before: float = d.hp
	var u: Dictionary = d.act("ult")
	check(u.ok and u.dmg == roundf(30.0 * 0.62) and d.ki == 0.0 and d.hp == hp_before - u.dmg and d.ults == 1, "필살: 기 100 을 쓰고 공격×0.62")
	for i in 20:
		d.step(0.05)
	var ki_cap: Duel = Duel.create(1000.0, 30.0, 100.0)
	for i in 30:
		ki_cap.cd = 0.0
		ki_cap.act("quick")
	check(ki_cap.ki == 100.0 and ki_cap.hits == 30, "기는 100 에서 멈춤")

	# ④ 적 차례
	var t: Duel = Duel.create(1000.0, 10.0, 100.0)
	var evs: Array = []
	var clock := 0.0
	while clock < 12.0 and not t.over:
		for e in t.step(0.05):
			evs.append([clock, e])
		clock += 0.05
	var kinds: Array = evs.map(func(x): return x[1].t)
	var first_tell: float = 0.0
	for x in evs:
		if x[1].t == "tell":
			first_tell = x[0]
			break
	check(kinds.slice(0, 4) == ["hit", "hit", "tell", "heavy"] and absf(first_tell - 3.0 * 2.6 + 0.0) < 0.9 and t.taken > 0.0, "적 차례: 맞고·맞고·예고 → 강공격 순서 %s (예고 %.1f초)" % [str(kinds.slice(0, 4)), first_tell])
	var heavy_dmg: float = evs.filter(func(x): return x[1].t == "heavy")[0][1].dmg
	check(heavy_dmg == roundf(t.foe_atk * 2.4), "강공격 = 적 공격 ×2.4")

	# ⑤ 회피
	var d_none: Duel = Duel.create(1000.0, 10.0, 100.0)
	check(not d_none.act("dodge").ok and d_none.act("dodge").reason == "notell" and d_none.dodge_try == 2, "예고가 없으면 회피 실패")
	var plain: Duel = _to_tell(1000.0)
	plain.act("dodge")  # 예고 시작 직후 — 저스트 창 밖
	var out1: Array = _run_until_heavy(plain)
	check(out1[0].dodged and not out1[0].just and out1[0].dmg == roundf(roundf(plain.foe_atk * 2.4) * 0.15) and plain.dodge_ok == 1 and plain.just_dodge_ok == 0, "그냥 회피: 강공격이 15%%만 들어옴(%d)" % int(out1[0].dmg))
	var jd: Duel = _to_tell(1000.0)
	while jd.tell > Duel.JUST_DODGE_WINDOW - 0.001:
		jd.step(0.01)
	var ki_before: float = jd.ki
	var jr: Dictionary = jd.act("dodge")
	var out2: Array = _run_until_heavy(jd)
	check(jr.ok and jr.just and out2[0].just and out2[0].dmg == 0.0 and jd.ki == ki_before + Duel.KI_MAX * 0.30 and jd.just_dodge_ok == 1 and jd.dodge_ok == 1, "저스트 회피(예고 끝 0.25초 안): 피해 0 · 기 +30%%")
	var nd: Duel = _to_tell(1000.0)
	var out3: Array = _run_until_heavy(nd)
	check(not out3[0].dodged and out3[0].dmg == roundf(nd.foe_atk * 2.4) and nd.morale < nd.morale_max, "회피 안 하면 강공격이 그대로")
	var again: Duel = Duel.create(1000.0, 10.0, 100.0)
	check(Duel.JUST_DODGE_WINDOW == 0.25 and Duel.JUST_DODGE_KI_BONUS == 0.30 and Duel.DODGE_CUT == 0.15 and Duel.TELL_SEC == 1.1 and again.just_dodged == false, "회피 상수: 창 0.25초 · 기 보너스 30%% · 그냥 회피 15%%")

	# ⑥ 부위 파괴
	var raid: Duel = Duel.create(1000.0, 10.0, 100.0, 75.0, true)
	raid.hp = 1000.0 * 0.76
	raid.cd = 0.0
	raid.act("quick")
	var s1: int = raid.stagger_count
	check(s1 == 0 and Duel.STAGGER_THRESHOLDS == [0.75, 0.50, 0.25], "토벌: 체력 76%%에서는 아직 스태거 없음 · 문턱 75·50·25")
	var raid2: Duel = Duel.create(1000.0, 2000.0, 100.0, 75.0, true)
	raid2.hp = 1000.0 * 0.80
	raid2.cd = 0.0
	var ra: Dictionary = raid2.act("quick")
	check(raid2.hp < 800.0 and ra.stagger == (raid2.hp <= 750.0) and raid2.stagger_count == (1 if raid2.hp <= 750.0 else 0), "토벌: 75%% 아래로 내려가면 스태거 한 번")
	var counts: Array = []
	var multi: Duel = Duel.create(1000.0, 10000.0, 100.0, 75.0, true)
	multi.hp = 1000.0
	multi.ki = 100.0
	var mu: Dictionary = multi.act("ult")
	counts.append(multi.stagger_count)
	check(mu.ok and multi.hp <= 0.0 and counts == [3] and multi.over and multi.cleared, "큰 필살 한 방이 세 문턱을 한꺼번에 넘으면 스태거 3(한 번씩만 센다)")
	var normal: Duel = Duel.create(1000.0, 10000.0, 100.0)
	normal.ki = 100.0
	normal.act("ult")
	check(normal.stagger_count == 0 and normal.cleared, "토벌이 아니면 스태거가 안 걸림(웹판 기본)")
	var once: Duel = Duel.create(1000.0, 30.0, 100.0, 75.0, true)
	once.hp = 700.0
	once.cd = 0.0
	once.act("quick")
	var c1: int = once.stagger_count
	once.hp = 700.0
	once.cd = 0.0
	once.act("quick")
	check(c1 == 1 and once.stagger_count == 1, "같은 문턱은 두 번 안 셈")

	# ⑦ 끝
	var win: Duel = Duel.create(5.0, 100.0, 100.0)
	win.act("quick")
	check(win.over and win.cleared and not win.fled and win.act("quick").reason == "over" and win.step(1.0).is_empty(), "처치: 끝나고 이김 · 끝난 뒤엔 행동·진행 없음")
	var rout: Duel = Duel.create(100000.0, 1.0, 1.0)
	rout.morale = 5.0
	var rev: Array = []
	while not rout.over:
		rev.append_array(rout.step(0.5))
	check(rout.over and not rout.cleared and rout.morale == 0.0 and rev[-1].t == "rout", "사기가 0 이면 퇴각(패배)")
	var timed: Duel = Duel.create(100000.0, 1.0, 10000.0, 3.0)
	var tev: Array = []
	while not timed.over:
		tev.append_array(timed.step(0.5))
	check(timed.over and not timed.cleared and timed.left == 0.0 and tev[-1].t == "time", "시간 초과는 패배(처치 못 함)")
	var fl: Duel = Duel.create(1000.0, 10.0, 10.0)
	fl.flee()
	check(fl.over and fl.fled and not fl.cleared, "물러남")
	var tscn := FileAccess.get_file_as_string("res://games/saga_go/world/TestVillage.tscn")
	var leader := tscn.substr(tscn.find("[node name=\"BanditLeaderEncounter\""), 900)
	var next_node := leader.find("\n[node name=", 10)
	if next_node > 0:
		leader = leader.substr(0, next_node)
	check(leader.find("time_sec = 75.0") >= 0 and leader.find("is_raid = true") >= 0 and Duel.TIME_SEC == 60.0, "씬: 도적 두목이 75초·토벌(부위 파괴) · 기본은 60초")

	# ⑧ 발견 밀도
	var all_walk := func(x: int, y: int) -> bool: return true
	var r0: Dictionary = Density.report(Vector2i(10, 10), 3.0, [], 60.0, all_walk)
	check(r0.total == 100 and r0.empty == 100 and r0.empty_pct == 100.0, "점이 없으면 걸을 수 있는 칸이 모두 빈 칸(100%)")
	var r1: Dictionary = Density.report(Vector2i(10, 10), 3.0, [Vector2(5, 5)], 60.0, all_walk)
	check(r1.empty == 0 and r1.empty_pct == 0.0, "반경 60m(20칸)가 지역 전체를 덮으면 빈 칸 0%")
	var r2: Dictionary = Density.report(Vector2i(10, 10), 3.0, [Vector2(0, 0)], 6.0, all_walk)
	var near_cnt := 0
	for y in 10:
		for x in 10:
			if Vector2(x, y).distance_to(Vector2(0, 0)) <= 2.0:
				near_cnt += 1
	check(r2.empty == 100 - near_cnt and absf(r2.empty_pct - float(100 - near_cnt)) < 1e-9, "반경 6m(2칸) 점 하나: 가까운 %d칸만 덮임" % near_cnt)
	var half_walk := func(x: int, y: int) -> bool: return x < 5
	var r3: Dictionary = Density.report(Vector2i(10, 10), 3.0, [], 60.0, half_walk)
	var r4: Dictionary = Density.report(Vector2i(4, 4), 3.0, [], 60.0)
	check(r3.total == 50 and r3.empty == 50 and r4.total == 16 and Density.report(Vector2i(0, 0), 3.0, []).empty_pct == 0.0, "걸을 수 없는 칸은 분모에서 뺌 · 빈 지도는 0%%")
	var reg_ok := true
	var reg_n := 0
	for rid in TestMap.REGIONS.keys():
		var size: Vector2i = TestMap.size(String(rid))
		var tile: float = TestMap.tile_size_of(String(rid))
		var walkable := func(x: int, y: int) -> bool: return TerrainBuilder.LEGEND[TestMap.tile_at(x, y, String(rid))].walkable
		var rep: Dictionary = Density.report(size, tile, [], 60.0, walkable)
		reg_ok = reg_ok and rep.total > 0 and rep.total <= size.x * size.y and rep.empty == rep.total and rep.empty_pct == 100.0
		reg_n += 1
	check(reg_ok and reg_n >= 10, "지역 %d 곳 모두 걸을 수 있는 칸이 있고 · 점이 없으면 전부 빈 칸" % reg_n)

	print("PROBE duel ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)


## 첫 예고(tell > 0)가 시작될 때까지 돌린 맞서기.
func _to_tell(foe_hp: float) -> Duel:
	var x: Duel = Duel.create(foe_hp, 10.0, 100.0)
	var guard := 0
	while x.tell <= 0.0 and guard < 400:
		x.step(0.05)
		guard += 1
	return x


## 지금 예고에서 강공격이 터질 때까지 돌려 그 사건들을 돌려준다([heavy 사건, …]).
func _run_until_heavy(x: Duel) -> Array:
	var out: Array = []
	var guard := 0
	while out.is_empty() and guard < 400:
		for e in x.step(0.01):
			if e.t == "heavy":
				out.append(e)
		guard += 1
	return out
