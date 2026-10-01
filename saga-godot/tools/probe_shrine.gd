extends Node
## GO 사당 시련(101-2 ④: world/shrine_trial.gd — 파도 넷·180초·하루 3번·실패 10분·클리어 경험치+인연) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_SHRINE_PROBE 가 있을 때만 단다. 진짜 세이브는 안 건드린다(경험치·동행·세운 인물은 끝에 되돌림).
##
##   SAGA_SHRINE_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## 시련 노드는 점검이 직접 몬다(_process 를 꺼 두고 `_duel` 값을 정해 `_on_wave_done()` 을 부른다 — 실제 싸움을 안 한다).
## ① 표: 파도 힘 넷이 오르막 · 180초·하루 3번·실패 10분·클리어 경험치 60 ② 하루 횟수: 3→0 으로 줄고 날짜가 바뀌면 다시 3
## ③ 입장→파도 넷을 차례로 깨면 남은 시간이 다음 파도로 이어지고(적 체력 = 힘×7) 마지막에 경험치+인연 인물이 서고 쿨다운 4초
## ④ 실패하면 경험치 없이 쿨다운 600초 ⑤ 물러나기는 횟수를 안 쓰고 4초 ⑥ 인연 고르기는 고정 조우 셋·이미 등용한 인물을 안 뽑는다.
## 끝에 SHRINE_PROBE_DONE fails=N.

const Characters := preload("res://saga_core/data/characters.gd")

var _scene: Node
var _fails := 0


func _ready() -> void:
	Weather.force("clear")
	_scene = get_tree().current_scene
	_run.call_deferred()


func _frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("SHRINE_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _run() -> void:
	await _frames(4)
	var st: Node = _scene.find_child("ShrineTrial", true, false)
	_check("shrine 있음", st != null, str(st))
	if st == null:
		print("SHRINE_PROBE_DONE fails=%d" % _fails)
		get_tree().quit()
		return
	st.set_process(false)
	var saved_exp: float = PartyState.exp
	var saved_members: Array = PartyState.members.duplicate()
	var powers: Array = st.WAVE_POWERS

	# ① 표
	var rising := powers.size() == 4
	for i in range(1, powers.size()):
		rising = rising and float(powers[i]) > float(powers[i - 1])
	_check("table", rising and is_equal_approx(st.TRIAL_TIME_SEC, 180.0) and st.DAILY_LIMIT == 3 and is_equal_approx(st.FAIL_COOLDOWN_SEC, 600.0) and is_equal_approx(st.CLEAR_EXP, 60.0), str(powers))

	# ② 하루 횟수
	st._last_reset_day = st._today_key()
	st._uses_today = 0
	var l0: int = st._daily_left()
	st._uses_today = 2
	var l1: int = st._daily_left()
	st._uses_today = 3
	var l2: int = st._daily_left()
	st._last_reset_day = "1999-01-01"
	var l3: int = st._daily_left()
	_check("daily_limit", l0 == 3 and l1 == 1 and l2 == 0 and l3 == 3 and st._uses_today == 0, "%d·%d·%d → 날짜 바뀜 %d" % [l0, l1, l2, l3])

	# ③ 입장 → 파도 넷 → 클리어
	st._uses_today = 0
	PartyState.members.clear()
	var heroes_before := _scene.find_children("ShrineHero_*", "", true, false).size()  # 시련 노드의 부모(랜드마크 빌더) 아래에 선다
	st._choose_enter()
	var d0: DuelRules = st._duel
	var enter_ok: bool = st._state == st.State.FIGHT and d0 != null and is_equal_approx(d0.foe_hp, roundf(float(powers[0]) * st.FOE_HP_MUL)) and is_equal_approx(d0.left, 180.0) and st._uses_today == 1 and st.is_in_group("duel_active")
	_check("enter", enter_ok, "적 체력 %.0f · 남은 %.0f초 · 오늘 %d번째" % [d0.foe_hp, d0.left, st._uses_today])
	var carry_ok := true
	var left := 150.0
	for w in range(1, powers.size()):
		var cur: DuelRules = st._duel
		cur.over = true
		cur.cleared = true
		cur.left = left
		st._on_wave_done()
		var nxt: DuelRules = st._duel
		carry_ok = carry_ok and st._wave_idx == w and nxt != null and is_equal_approx(nxt.left, left) and is_equal_approx(nxt.foe_hp, roundf(float(powers[w]) * st.FOE_HP_MUL))
		left -= 30.0
	_check("waves_carry_time", carry_ok, "파도 %d 까지 — 남은 시간이 다음 파도로 이어짐" % st._wave_idx)
	var exp0: float = PartyState.exp
	st._duel.over = true
	st._duel.cleared = true
	st._on_wave_done()
	await _frames(2)
	var heroes_after := _scene.find_children("ShrineHero_*", "", true, false)
	_check("clear", PartyState.exp >= exp0 + st.CLEAR_EXP - 0.01 and st._state == st.State.COOLDOWN and is_equal_approx(st._cooldown_left, 4.0) and not st.is_in_group("duel_active") and heroes_after.size() == heroes_before + 1, "경험 +%.1f · 쿨다운 %.0f · 인연 인물 %d명 섬" % [PartyState.exp - exp0, st._cooldown_left, heroes_after.size() - heroes_before])
	for h in heroes_after:
		h.queue_free()

	# ④ 실패
	st._state = st.State.IDLE
	st._choose_enter()
	st._duel.over = true
	st._duel.cleared = false
	var exp1: float = PartyState.exp
	st._on_wave_done()
	_check("fail", is_equal_approx(PartyState.exp, exp1) and st._state == st.State.COOLDOWN and is_equal_approx(st._cooldown_left, 600.0) and not st.is_in_group("duel_active"), "경험 그대로 · 쿨다운 %.0f" % st._cooldown_left)

	# ⑤ 물러나기
	st._state = st.State.IDLE
	var uses: int = st._uses_today
	st._choose_leave()
	_check("leave", st._uses_today == uses and st._state == st.State.COOLDOWN and is_equal_approx(st._cooldown_left, 4.0), "횟수 그대로 · 쿨다운 4")

	# ⑥ 인연 고르기
	var placed: Array = st.PLACED_HERO_IDS
	var pick_ok := true
	for i in 100:
		var id: String = st._pick_hero_id()
		pick_ok = pick_ok and id != "" and not placed.has(id) and not PartyState.members.has(id)
	var all_ids: Array[String] = []
	for h in Characters.HEROES:
		all_ids.append(String(h.id))
	PartyState.members.assign(all_ids)
	var none_left: String = st._pick_hero_id()
	PartyState.members.clear()
	_check("pick_hero", pick_ok and none_left == "", "고정 조우·등용한 인물 제외 · 다 등용하면 \"\"")

	st._state = st.State.IDLE
	PartyState.exp = saved_exp
	PartyState.members.assign(saved_members)
	print("SHRINE_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
