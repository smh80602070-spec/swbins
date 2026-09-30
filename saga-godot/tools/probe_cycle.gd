extends Node
## GO 별배 재출항 = 회차(data/cycle.gd · world/cycle_screen.gd · adventure.gd 확장) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_CYCLE_PROBE 가 있을 때만 단다.
##
##   SAGA_CYCLE_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 표(세계 등급 확장 표·적 레벨 표) ② 출항 조건(이야기·모험 등급·마지막 회차) ③ 출항: 상자만 되살아나고 다른 사건은 그대로 ·
## 채집·주간·잔불 초기화 · 세계 등급 낮춤 해제 · 보상 ④ 세계 등급 상한이 회차당 +2, 모험 등급 45·50·… 에 하나씩
## ⑤ 공격력·경험치 +5%/회차 ⑥ 화면: 얼림·확인 두 번 눌러야 출항. 회차·가방·경험·이벤트는 끝에 되돌린다. 저장은 안 한다.

const Cycle := preload("res://games/saga_go/data/cycle.gd")
const Adventure := preload("res://games/saga_go/data/adventure.gd")
const Story := preload("res://games/saga_go/data/story.gd")

var _p: Node3D
var _n: Node
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
	print("CYCLE_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _set_ar(ar: int) -> void:
	PartyState.exp = float(ar - 1) * PartyState.EXP_PER_LEVEL + 1.0
	PartyState.refresh_power()


func _run() -> void:
	await _frames(4)
	_n = get_tree().get_first_node_in_group("go_cycle")
	_saved = {"cycle": PartyState.cycle, "exp": PartyState.exp, "bag": PartyState.bag.duplicate(), "story": PartyState.story.duplicate(true),
		"resolved": EventState.resolved.duplicate(), "gather": PartyState.gather_t.duplicate(), "weekly": PartyState.weekly.duplicate(),
		"echo": PartyState.night_echo.duplicate(), "low": PartyState.wl_lowered}
	PartyState.cycle = 0

	# ① 표
	var asc := true
	for i in range(1, Adventure.WL_AR_EXTRA.size()):
		asc = asc and int(Adventure.WL_AR_EXTRA[i]) > int(Adventure.WL_AR_EXTRA[i - 1])
	asc = asc and int(Adventure.WL_AR_EXTRA[0]) > int(Adventure.WL_AR[Adventure.WL_MAX])
	var need_lv: int = Adventure.WL_MAX + 1 + Adventure.CYCLE_WL * Cycle.MAX_CYCLE
	_check("tables", asc and Adventure.ENEMY_LV.size() >= need_lv and Adventure.WL_AR_EXTRA.size() >= Adventure.CYCLE_WL * Cycle.MAX_CYCLE and _n != null,
		"asc=%s enemy_lv=%d need=%d extra=%d" % [asc, Adventure.ENEMY_LV.size(), need_lv, Adventure.WL_AR_EXTRA.size()])

	# ② 조건
	PartyState.story = {"ch": 3, "step": 0}
	_set_ar(50)
	var b_story := Cycle.blocker()
	PartyState.story = {"ch": Story.CHAPTERS.size()}
	_set_ar(39)
	var b_ar := Cycle.blocker()
	_set_ar(40)
	var b_ok := Cycle.blocker()
	PartyState.cycle = Cycle.MAX_CYCLE
	var b_max := Cycle.blocker()
	PartyState.cycle = 0
	var adv_err := Cycle.advance() if false else {}
	_check("blockers", b_story.contains("이야기") and b_ar.contains("모험 등급") and b_ok == "" and b_max.contains("마지막"),
		"story=%s | ar=%s | ok=%s | max=%s" % [b_story, b_ar, b_ok, b_max])

	# ③ 출항
	_set_ar(40)
	EventState.resolved.assign(["chest_a", "chest_b", "bandit_x", "hero_y"])
	PartyState.gather_t = {"herb_1": 5.0}
	PartyState.weekly = {"week": 5, "claims": 2}
	PartyState.night_echo = {"day": 1, "done": ["village"]}
	PartyState.wl_lowered = true
	var mora0: int = PartyState.count("mora")
	var fk0: int = PartyState.count("fate_knot")
	var r := Cycle.advance()
	_check("advance", int(r.get("cycle", 0)) == 1 and int(r.get("chests", 0)) == 2 and PartyState.cycle == 1
		and EventState.resolved == ["bandit_x", "hero_y"] and PartyState.gather_t.is_empty() and PartyState.weekly.is_empty() and PartyState.night_echo.is_empty()
		and not PartyState.wl_lowered and PartyState.count("mora") >= mora0 + int(Cycle.CYCLE_REWARD.mora) and PartyState.count("fate_knot") >= fk0 + 3,
		"r=%s resolved=%s" % [r, EventState.resolved])
	var again_blocker := Cycle.blocker()
	PartyState.cycle = 0
	PartyState.story = {"ch": 5}
	var err_r := Cycle.advance()
	_check("no_advance_when_blocked", err_r.has("error") and PartyState.cycle == 0 and again_blocker == "", "err=%s" % [err_r])

	# ④ 세계 등급 상한
	PartyState.cycle = 0
	_set_ar(90)
	var wl0 := Adventure.max_world_level()
	PartyState.cycle = 1
	_set_ar(44)
	var wl1a := Adventure.max_world_level()
	_set_ar(45)
	var wl1b := Adventure.max_world_level()
	_set_ar(50)
	var wl1c := Adventure.max_world_level()
	_set_ar(90)
	var wl1d := Adventure.max_world_level()
	PartyState.cycle = 2
	var wl2 := Adventure.max_world_level()
	PartyState.cycle = 5
	var wl5 := Adventure.max_world_level()
	PartyState.cycle = 1
	_check("world_level", wl0 == 8 and wl1a == 8 and wl1b == 9 and wl1c == 10 and wl1d == 10 and wl2 == 12 and wl5 == 18
		and Adventure.ar_for_wl(9) == 45 and Adventure.ar_for_wl(10) == 50 and Adventure.ar_for_wl(11) == -1 and Adventure.enemy_level(18) == 135,
		"wl %d %d %d %d %d %d %d ar9=%d ar11=%d" % [wl0, wl1a, wl1b, wl1c, wl1d, wl2, wl5, Adventure.ar_for_wl(9), Adventure.ar_for_wl(11)])

	# ⑤ 영구 보너스
	PartyState.cycle = 0
	var atk0 := PartyState.atk_mul()
	var e0 := PartyState.exp
	PartyState.add_exp(100.0)
	var g0 := PartyState.exp - e0
	PartyState.cycle = 2
	var atk2 := PartyState.atk_mul()
	e0 = PartyState.exp
	PartyState.add_exp(100.0)
	var g2 := PartyState.exp - e0
	_check("bonus", absf(atk2 / atk0 - 1.10) < 0.001 and absf(g2 / g0 - 1.10) < 0.001 and absf(Cycle.bonus() - 0.10) < 0.001,
		"atk×%.3f exp×%.3f bonus=%.2f" % [atk2 / atk0, g2 / g0, Cycle.bonus()])

	# ⑥ 화면
	PartyState.cycle = 0
	PartyState.story = {"ch": Story.CHAPTERS.size()}
	_set_ar(40)
	EventState.resolved.assign(["chest_z"])
	var opened := bool(_n.call("open_screen"))
	var frozen := bool(_p.get("frozen"))
	await _frames(2)
	var kids := (_n.get("_body") as Node).get_child_count()
	_n.set("confirming", true)
	var res: Dictionary = _n.call("sail", false)
	_check("screen", opened and frozen and kids >= 9 and int(res.get("cycle", 0)) == 1 and not bool(_p.get("frozen")) and not bool(_n.get("is_open")) and not EventState.resolved.has("chest_z"),
		"opened=%s frozen=%s kids=%d res=%s" % [opened, frozen, kids, res])

	PartyState.cycle = _saved.cycle
	PartyState.exp = _saved.exp
	PartyState.bag = _saved.bag
	PartyState.story = _saved.story
	EventState.resolved.assign(_saved.resolved)
	PartyState.gather_t = _saved.gather
	PartyState.weekly = _saved.weekly
	PartyState.night_echo = _saved.echo
	PartyState.wl_lowered = _saved.low
	PartyState.refresh_power()
	print("CYCLE_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
