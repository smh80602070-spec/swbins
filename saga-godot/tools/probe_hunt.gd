extends Node
## GO 사냥 기록(data/hunt.gd · world/hunt_log.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_HUNT_PROBE 가 있을 때만 단다.
##
##   SAGA_HUNT_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 표(종 목록·이름·단계 오름·보상 아이템이 실제 가방 항목) ② 마릿수 → 단계(문턱 9/10 · 39/40 · 119/120, 우두머리 1·3·10)
## ③ 받기: 닿은 단계만·한 번만·가방에 들어감 · 모두 받기 ④ 진짜 들판 적이 쓰러지면(died 신호) 그 종이 셈 ⑤ 세이브 JSON 을 거쳐도 그대로
## ⑥ 화면: 열면 얼림·줄 수 · 만난 적 없는 종은 "???" · 닫으면 풀림. 기록·가방·경험은 끝에 되돌린다.

const Hunt := preload("res://games/saga_go/data/hunt.gd")
const Growth := preload("res://games/saga_go/data/growth.gd")

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
	print("HUNT_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _run() -> void:
	await _frames(4)
	_n = get_tree().get_first_node_in_group("go_hunt")
	_saved = {"hunt": PartyState.hunt.duplicate(true), "bag": PartyState.bag.duplicate(), "exp": PartyState.exp, "ach": PartyState.achievements.duplicate(true)}
	PartyState.hunt = {}

	# ① 표
	var sp := Hunt.species()
	var bad: Array = []
	for id in sp:
		if Hunt.display_name(id) == id:
			bad.append("name " + id)
	for arr in [Hunt.TIERS, Hunt.BOSS_TIERS]:
		for i in range(1, arr.size()):
			if int(arr[i]) <= int(arr[i - 1]):
				bad.append("tiers")
	for rw in Hunt.REWARDS + Hunt.BOSS_REWARDS:
		for k in rw:
			if not Growth.ITEMS.has(k):
				bad.append("item " + String(k))
	var bosses := sp.filter(func(i): return Hunt.is_boss(i))
	_check("tables", bad.is_empty() and sp.size() >= 20 and bosses.size() >= 5 and sp.find(bosses[0]) > 8 and _n != null,
		"bad=%s species=%d bosses=%d" % [bad, sp.size(), bosses.size()])

	# ② 단계
	var t: Array = []
	for i in 9:
		Hunt.record("wolf")
	t.append(Hunt.tier_reached("wolf"))
	Hunt.record("wolf")
	t.append(Hunt.tier_reached("wolf"))
	for i in 29:
		Hunt.record("wolf")
	t.append(Hunt.tier_reached("wolf"))
	Hunt.record("wolf")
	t.append(Hunt.tier_reached("wolf"))
	for i in 79:
		Hunt.record("wolf")
	t.append(Hunt.tier_reached("wolf"))
	Hunt.record("wolf")
	t.append(Hunt.tier_reached("wolf"))
	var boss: String = bosses[0]
	var bt: Array = []
	Hunt.record(boss)
	bt.append(Hunt.tier_reached(boss))
	Hunt.record(boss)
	Hunt.record(boss)
	bt.append(Hunt.tier_reached(boss))
	_check("tiers", t == [0, 1, 1, 2, 2, 3] and bt == [1, 2] and Hunt.record("nothing") == 0 and Hunt.kills("wolf") == 120,
		"wolf=%s boss=%s kills=%d" % [t, bt, Hunt.kills("wolf")])

	# ③ 받기
	var mora0: int = PartyState.count("mora")
	var c0 := Hunt.claimable("wolf")
	var r := Hunt.claim("wolf")
	var expect := 0
	for rw in Hunt.REWARDS:
		expect += int(rw.mora)
	var again := Hunt.claim("wolf")
	var boss_claimable := Hunt.claimable(boss)
	var all := Hunt.claim_all()
	_check("claim", c0 == 3 and int(r.get("mora", 0)) == expect and PartyState.count("mora") >= mora0 + expect and again.is_empty()
		and boss_claimable == 2 and not all.is_empty() and Hunt.claimable_total() == 0,
		"claimable=%d reward=%s again=%s boss_claimable=%d all=%s" % [c0, r, again, boss_claimable, all])

	# ④ 진짜 적이 쓰러지면
	PartyState.hunt = {}
	var enemies := get_tree().get_nodes_in_group("field_enemy")
	var e: Node = enemies[0] if not enemies.is_empty() else null
	var kind := String(e.get("kind")) if e != null else ""
	if e != null:
		e.emit_signal("died", e)
	var late: Node = null
	_check("real_enemy", e != null and Hunt.kills(kind) == 1 and late == null, "kind=%s kills=%d enemies=%d" % [kind, Hunt.kills(kind), enemies.size()])

	# ⑤ 세이브 JSON
	Hunt.record("bandit")
	Hunt.record("bandit")
	var js := JSON.stringify(PartyState.hunt)
	PartyState.hunt = (JSON.parse_string(js) as Dictionary).duplicate(true)
	_check("save_json", Hunt.kills("bandit") == 2 and Hunt.kills(kind) == 1 and Hunt.found_count() >= 2, "bandit=%d found=%d" % [Hunt.kills("bandit"), Hunt.found_count()])

	# ⑥ 화면
	PartyState.hunt = {}
	Hunt.record("wolf")
	var opened := bool(_n.call("open_screen"))
	var frozen := bool(_p.get("frozen"))
	await _frames(2)
	var kids := (_n.get("_body") as Node).get_child_count()
	var found_names := 0
	var unknown := 0
	for row in (_n.get("_body") as Node).get_children():
		if row is HBoxContainer:
			var l := row.get_child(0) as Label
			if l.text == "???":
				unknown += 1
			elif l.text.begins_with(Hunt.display_name("wolf")):
				found_names += 1
	_n.call("close_screen")
	_check("screen", opened and frozen and kids == sp.size() + 1 and found_names == 1 and unknown == sp.size() - 1 and not bool(_p.get("frozen")),
		"opened=%s frozen=%s kids=%d wolf=%d unknown=%d" % [opened, frozen, kids, found_names, unknown])

	PartyState.hunt = _saved.hunt
	PartyState.bag = _saved.bag
	PartyState.exp = _saved.exp
	PartyState.achievements = _saved.ach
	print("HUNT_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
