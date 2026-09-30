extends Node
## GO 쉼터 마당(data/homestead.gd · world/homestead.gd) 자동 점검 — 평소엔 안 붙는다.
## test_village.gd 가 SAGA_HOME_PROBE 가 있을 때만 단다.
##
##   SAGA_HOME_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## ① 표(소품 id·모델 파일·값·등급 오름) ② 마당 자리(마을 안·평평·신상 곁) ③ 놓기 오류(냥 모자람·마당 밖·너무 가까움·가득)와 성공(냥 씀·안락도)
## ④ 등급 문턱 ⑤ 수입: 시간이 흐르면 쌓이고 상한에서 멈추며 등급이 바뀌기 전 수입은 은행에 남는다 · 수확
## ⑥ 치우기 = 절반 환불 ⑦ 세이브 JSON 을 거쳐도 그대로 ⑧ 마당 노드: 서 있는 자리에 놓임 · 소품 몸 생김 · 화면은 안 얼림
## ⑨ 안내 단추: 마당 곁에서만. 냥·마당·지점은 끝에 되돌린다. 저장은 안 한다.

const Homestead := preload("res://games/saga_go/data/homestead.gd")
const TerrainBuilder := preload("res://games/saga_go/world/terrain_builder.gd")

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
	print("HOME_PROBE %s %s %s" % ["ok  " if ok else "FAIL", name, detail])


func _run() -> void:
	await _frames(6)
	_n = get_tree().get_first_node_in_group("go_homestead")
	_saved = {"home": PartyState.home.duplicate(true), "bag": PartyState.bag.duplicate(), "pos": _p.global_position}
	PartyState.home = {}
	Homestead.time_offset = 0.0
	var c: Vector3 = _n.call("center")

	# ① 표
	var bad: Array = []
	var ids := {}
	for it in Homestead.ITEMS:
		if ids.has(it.id):
			bad.append("dup " + it.id)
		ids[it.id] = true
		if not ResourceLoader.exists(String(it.glb)) or int(it.cost) <= 0 or int(it.comfort) <= 0 or float(it.scale) <= 0.0:
			bad.append(String(it.id))
	var last := -1
	for t in Homestead.TIERS:
		if int(t.min) <= last:
			bad.append("tier " + t.name)
		last = int(t.min)
	_check("tables", bad.is_empty() and _n != null, "bad=%s items=%d" % [bad, Homestead.ITEMS.size()])

	# ② 마당 자리
	var h := TerrainBuilder.height_at(Homestead.REGION, c)
	var hs: Array = []
	for a in 8:
		var q := c + Vector3(cos(TAU * a / 8.0), 0, sin(TAU * a / 8.0)) * Homestead.RADIUS
		hs.append(TerrainBuilder.height_at(Homestead.REGION, q))
	var mn: float = hs.min()
	var mx: float = hs.max()
	_check("site", c != Vector3.ZERO and absf(h - mn) < 1.2 and absf(h - mx) < 1.2 and h > -0.2, "center=%s h=%.2f ring=%.2f..%.2f" % [c, h, mn, mx])

	# ③ 놓기
	PartyState.bag["mora"] = 0
	var no_money := Homestead.place("flowers", c.x, c.z, 0, c)
	PartyState.bag["mora"] = 100000
	var outside := Homestead.place("flowers", c.x + Homestead.RADIUS + 3.0, c.z, 0, c)
	var ok1 := Homestead.place("flowers", c.x, c.z, 0, c)
	var close := Homestead.place("rock", c.x + 0.4, c.z, 0, c)
	var unknown := Homestead.place("nothing", c.x + 2, c.z, 0, c)
	var m_after: int = PartyState.count("mora")
	var full_err := ""
	for gx in range(-8, 9):
		for gz in range(-8, 9):
			if full_err != "" or Vector2(gx, gz).length() > 8.0 or Vector2(gx - 0.0, gz - 0.0).length() < 1.5:
				continue
			var e := Homestead.place("fence", c.x + gx, c.z + gz, 0, c)
			if e.contains("가득"):
				full_err = e
	_check("place", no_money.contains("모자란") and outside.contains("마당 밖") and ok1 == "" and close.contains("가깝") and unknown != ""
		and m_after == 100000 - 150 and full_err != "" and (Homestead.state().items as Array).size() == Homestead.MAX_ITEMS,
		"nomoney=%s out=%s close=%s spent=%d full=%s n=%d" % [no_money, outside, close, 100000 - m_after, full_err, (Homestead.state().items as Array).size()])

	# ④ 등급
	_check("tiers", Homestead.tier_of(0) == 0 and Homestead.tier_of(9) == 0 and Homestead.tier_of(10) == 1 and Homestead.tier_of(59) == 2 and Homestead.tier_of(60) == 3 and Homestead.tier_of(500) == 4,
		"%d %d %d %d" % [Homestead.tier_of(9), Homestead.tier_of(10), Homestead.tier_of(60), Homestead.tier_of(500)])

	# ⑤ 수입
	PartyState.home = {}
	PartyState.bag["mora"] = 100000
	for i in 4: # 안락 3+3+3+... 로 정갈한 마당(30) 만들기
		Homestead.place("stele", c.x - 4.0 + float(i) * 1.5, c.z + 3.0, 0, c) # 4×4
	for i in 4:
		Homestead.place("tree", c.x - 4.0 + float(i) * 2.5, c.z - 4.0, 0, c) # 4×6
	var comfort30 := Homestead.comfort()
	var tier2 := Homestead.tier()
	var rate2 := Homestead.income_per_hour()
	Homestead.time_offset = 2.0 * 3600.0
	var p2 := Homestead.pending()
	Homestead.time_offset = 100.0 * 3600.0
	var pcap := Homestead.pending()
	Homestead.time_offset = 2.0 * 3600.0
	var m1: int = PartyState.count("mora")
	Homestead.place("well", c.x + 5.0, c.z + 1.0, 0, c) # 등급이 오르기 전 수입 은행
	var banked := Homestead.pending()
	var got := Homestead.harvest()
	var again := Homestead.harvest()
	_check("income", comfort30 == 40 and tier2 == 2 and rate2 == 150 and p2 == 300 and pcap == 150 * 12 and banked >= 300 and got == banked and again == 0
		and PartyState.count("mora") == m1 - int(Homestead.item("well").cost) + got,
		"comfort=%d tier=%d rate=%d p2h=%d cap=%d banked=%d got=%d again=%d" % [comfort30, tier2, rate2, p2, pcap, banked, got, again])
	Homestead.time_offset = 0.0

	# ⑥ 치우기
	PartyState.home = {}
	PartyState.bag["mora"] = 1000
	Homestead.place("lamp", c.x, c.z, 0, c)
	var mora_a: int = PartyState.count("mora")
	var far_rm := Homestead.remove_near(c.x + 6.0, c.z, 1.0)
	var rm := Homestead.remove_near(c.x + 0.5, c.z, 1.0)
	_check("remove", far_rm == "" and rm == "lamp" and PartyState.count("mora") == mora_a + int(Homestead.item("lamp").cost * Homestead.REFUND) and (Homestead.state().items as Array).is_empty(),
		"far=%s rm=%s refund=%d" % [far_rm, rm, PartyState.count("mora") - mora_a])

	# ⑦ 세이브 JSON
	Homestead.place("flowers", c.x + 1.0, c.z + 1.0, 2, c)
	var js := JSON.stringify(PartyState.home)
	PartyState.home = (JSON.parse_string(js) as Dictionary).duplicate(true)
	var st := Homestead.state()
	_check("save_json", (st.items as Array).size() == 1 and String(st.items[0].id) == "flowers" and int(st.items[0].r) == 2 and Homestead.comfort() == 2,
		"items=%s" % [st.items])

	# ⑧ 노드
	PartyState.home = {}
	PartyState.bag["mora"] = 5000
	_p.global_position = c + Vector3(2.0, 0, 2.0)
	await _frames(3)
	var inside := bool(_n.call("inside"))
	_n.set("pick_id", "rock")
	var err := String(_n.call("place_here"))
	await _frames(3)
	var body_n := (_n.get("_items_root") as Node).get_child_count()
	var pos_ok := false
	if (Homestead.state().items as Array).size() == 1:
		var e0: Dictionary = (Homestead.state().items as Array)[0]
		pos_ok = Vector2(float(e0.x) - _p.global_position.x, float(e0.z) - _p.global_position.z).length() < 0.8
	var opened := bool(_n.call("open_screen"))
	var free := not bool(_p.get("frozen"))
	await _frames(2)
	var kids := (_n.get("_body") as Node).get_child_count()
	_n.call("close_screen")
	var rid := String(_n.call("remove_nearby"))
	await _frames(3)
	var body_after := (_n.get("_items_root") as Node).get_child_count()
	_check("node", inside and err == "" and body_n == 1 and pos_ok and opened and free and kids >= 12 and rid == "rock" and body_after == 0,
		"inside=%s err=%s body=%d pos=%s opened=%s free=%s kids=%d rid=%s after=%d" % [inside, err, body_n, pos_ok, opened, free, kids, rid, body_after])

	# ⑨ 안내 단추
	await _frames(3)
	## 안내 단추는 화면 메뉴(hud_menu.gd)가 대신한다 — 메뉴 항목이 마당 곁에서만 보이는지.
	var menu := get_tree().get_first_node_in_group("go_hud_menu")
	await _frames(3)
	var near_vis := bool(menu.call("shown", "go_homestead"))
	_p.global_position = c + Vector3(60.0, 0, 60.0)
	await _frames(3)
	var far_vis := bool(menu.call("shown", "go_homestead"))
	_check("prompt", near_vis and not far_vis, "near=%s far=%s" % [near_vis, far_vis])

	PartyState.home = _saved.home
	PartyState.bag = _saved.bag
	_p.global_position = _saved.pos
	print("HOME_PROBE_DONE fails=%d" % _fails)
	get_tree().quit()
