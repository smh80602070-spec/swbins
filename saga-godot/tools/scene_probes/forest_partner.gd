extends Node
## G-0232 3마을 동반자(data/forest_partner.gd · villager_builder 청하기·헤어지기 · forest_house 집 안 몸) 점검 — 러너 래퍼 tools/probe_forest_partner.gd.
## ① 하트 9 거절 · 10 + 교배꽃 승낙(꽃 하나 씀) · 둘째 사람 거절 · 꽃 없으면 거절
## ② 아침 한 가지 — 세 갈래 효과·같은 날 두 번 안 함 ③ 30일 기념 대사 금 300 그날 한 번
## ④ 헤어지기 하트 10 → 5 ⑤ 저장 왕복(임시 경로) · 옛 세이브(칸 없음) = 동반자 없음 ⑥ 집 안 몸·말풍선 놓고 거둠
## 세이브 칸·날·경로는 끝에 되돌린다.

const Partner := preload("res://games/saga_forest/data/forest_partner.gd")
const TMP_SAVE := "user://probe_forest_partner.json"
const DAY0 := 20000

var fails := 0


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		fails += 1
		print("  FAIL ", name, " ", detail)
	else:
		print("  ok   ", name, " ", detail)


func run() -> int:
	var saved := {"partner": ForestSaveState.partner.duplicate(true), "affinity": ForestSaveState.affinity.duplicate(true),
		"items": ForestSaveState.items.duplicate(true), "gold": ForestSaveState.gold, "path": ForestSaveState.path_override}
	ForestDay.force_epoch_day(DAY0)
	ForestSaveState.partner = {}

	# ① 청하기
	ForestSaveState.affinity["npc_keeper"] = 9
	ForestSaveState.affinity["npc_angler"] = 10
	ForestSaveState.items[Partner.TOKEN] = 0
	var no_token := Partner.propose("npc_angler")
	ForestSaveState.items[Partner.TOKEN] = 2
	var r9 := Partner.propose("npc_keeper")
	var r10 := Partner.propose("npc_angler")
	ForestSaveState.affinity["npc_keeper"] = 10
	var r2 := Partner.propose("npc_keeper")
	_check("propose", not bool(no_token.ok) and not bool(r9.ok) and bool(r10.ok) and not bool(r2.ok)
		and Partner.partner_id() == "npc_angler" and ForestSaveState.item_count(Partner.TOKEN) == 1 and String(r2.text).contains("이미"),
		"no_token=%s h9=%s h10=%s second=%s id=%s token=%d" % [no_token.ok, r9.ok, r10.ok, r2.ok, Partner.partner_id(), ForestSaveState.item_count(Partner.TOKEN)])

	# ② 아침 한 가지 — 세 갈래가 다 나오는 날을 찾아 효과를 잰다
	var seen := {}
	var effects_ok := true
	var same_day_twice := false
	for d in range(DAY0 + 1, DAY0 + 40):
		ForestDay.force_epoch_day(d)
		var k := Partner.morning_kind(d)
		if seen.has(k):
			continue
		var g0 := ForestSaveState.gold
		var c0 := ForestSaveState.item_count(Partner.TIDY_ITEM)
		var f0 := ForestSaveState.item_count("물고기")   # 낚시꾼이 좋아하는 갈래
		var r := Partner.on_new_day()
		seen[k] = true
		match k:
			"tidy": effects_ok = effects_ok and ForestSaveState.item_count(Partner.TIDY_ITEM) == c0 + Partner.TIDY_N
			"meal": effects_ok = effects_ok and ForestSaveState.gold == g0 + Partner.MEAL_GOLD
			"gift": effects_ok = effects_ok and ForestSaveState.item_count("물고기") == f0 + 1
		effects_ok = effects_ok and String(r.get("kind", "")) == k
		same_day_twice = same_day_twice or not Partner.on_new_day().is_empty()
	_check("morning", seen.size() == 3 and effects_ok and not same_day_twice, "kinds=%s effects=%s twice=%s" % [seen.keys(), effects_ok, same_day_twice])

	# ③ 30일 기념
	ForestSaveState.partner["since"] = DAY0
	ForestDay.force_epoch_day(DAY0 + 29)
	var not_yet := Partner.anniversary_line("npc_angler") == ""
	ForestDay.force_epoch_day(DAY0 + 30)
	var g1 := ForestSaveState.gold
	var l1 := Partner.anniversary_line("npc_angler")
	var g2 := ForestSaveState.gold
	var l2 := Partner.anniversary_line("npc_angler")
	var other := Partner.anniversary_line("npc_keeper") == ""
	_check("anniversary", not_yet and l1.contains("30일") and g2 == g1 + Partner.ANNIV_GOLD and ForestSaveState.gold == g2 and l2 != "" and other,
		"29=%s gold+%d again=%s" % [not_yet, g2 - g1, ForestSaveState.gold - g2])

	# ⑤ 저장 왕복 · 옛 세이브
	ForestSaveState.path_override = TMP_SAVE
	var body := Node3D.new()
	body.add_to_group("player")
	add_child(body)
	var want := ForestSaveState.partner.duplicate(true)
	ForestSaveState.save()
	ForestSaveState.partner = {}
	var loaded := ForestSaveState.try_load()
	var rt: bool = loaded and String(ForestSaveState.partner.get("id", "")) == "npc_angler" and int(ForestSaveState.partner.get("since", -1)) == int(want.since)
	var f := FileAccess.open(TMP_SAVE, FileAccess.READ)
	var raw: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	raw.erase("partner")
	var w := FileAccess.open(TMP_SAVE, FileAccess.WRITE)
	w.store_string(JSON.stringify(raw))
	w.close()
	var old_ok: bool = ForestSaveState.try_load() and ForestSaveState.partner.is_empty()
	_check("save", rt and old_ok, "roundtrip=%s old_save_none=%s" % [rt, old_ok])
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP_SAVE))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP_SAVE + ".bak"))
	ForestSaveState.path_override = String(saved.path)
	ForestSaveState.partner = want
	ForestSaveState.affinity["npc_angler"] = 10

	# ⑥ 집 안 몸
	var house: Node3D = load("res://games/saga_forest/world/forest_house.gd").new()
	add_child(house)
	await get_tree().process_frame
	await get_tree().process_frame
	var shown := house.find_child("Partner", true, false) != null and house.find_child("Bubble", true, false) != null

	# ④ 헤어지기
	var br := Partner.break_up()
	await get_tree().process_frame
	await get_tree().process_frame
	var gone := house.find_child("Partner", true, false) == null or (house.find_child("Partner", true, false) as Node).is_queued_for_deletion()
	_check("breakup", bool(br.ok) and ForestSaveState.heart("npc_angler") == 5 and Partner.partner_id() == "", "ok=%s heart=%d" % [br.ok, ForestSaveState.heart("npc_angler")])
	_check("house", shown and gone, "shown=%s gone_after_breakup=%s" % [shown, gone])
	house.queue_free()
	body.queue_free()

	ForestSaveState.partner = saved.partner
	ForestSaveState.affinity = saved.affinity
	ForestSaveState.items = saved.items
	ForestSaveState.gold = int(saved.gold)
	ForestDay.force_epoch_day(null)
	return fails
