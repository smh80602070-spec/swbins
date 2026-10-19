extends Node
## G-0231 전리품 거르기(data/loot_filter.gd · world/loot_pickup.gd spawn_at · ui/loot_filter_button.gd) 점검 — 러너 래퍼 tools/probe_loot_filter.gd.
## ① 기본 셋: 상품 갑주 보임·기둥 없음 · 전설·보물 기둥 · 내 직업 무기 기둥 · 남의 직업 무기 기둥 없음
## ② 첫 일치(순서가 뜻) · 끈 규칙 건너뜀 · 빠른 추가 "양품 이하 숨기기" 두 줄
## ③ 진짜 spawn_at: 전부 숨기면 장비 노드 없음·금은 늘 · 기본 셋 전설은 빛기둥
## ④ 세이브 왕복(임시 경로) · 옛 세이브(칸 없음) = 기본 셋 ⑤ 4층 추천 한 번 ⑥ 규칙 창 열기·닫기
## 세이브 칸·경로는 끝에 되돌린다.

const LootFilter := preload("res://games/saga_dungeon/data/loot_filter.gd")
const LootPickup := preload("res://games/saga_dungeon/world/loot_pickup.gd")
const TMP_SAVE := "user://probe_loot_filter.json"

var fails := 0


func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		fails += 1
		print("  FAIL ", name, " ", detail)
	else:
		print("  ok   ", name, " ", detail)


func _it(base: String, tier: int) -> Dictionary:
	return {"base": base, "tier": tier}


func _spawn_one(it_tier: int) -> Node3D:
	var parent := Node3D.new()
	add_child(parent)
	## spawn_at 은 등급을 굴린다 — 전설 배수를 아주 크게 주면 전설이 나온다(loot_glow 와 같은 꼴).
	LootPickup.spawn_at(parent, Vector3.ZERO, 5, false, false, 100000.0 if it_tier == 4 else 1.0)
	return parent


func run() -> int:
	seed(20260824)
	var saved: Dictionary = DungeonSaveState.loot_filter.duplicate(true)
	var saved_path: String = DungeonSaveState.path_override

	# ① 기본 셋
	DungeonSaveState.loot_filter = {}
	var rs := LootFilter.rules()
	var d_plain := LootFilter.decide(_it("a_jichap", 0), rs, "warrior")
	var d_leg := LootFilter.decide(_it("a_jichap", 4), rs, "warrior")
	var d_tre := LootFilter.decide(_it("a_jichap", 3), rs, "warrior")
	var d_mine := LootFilter.decide(_it("w_changj", 0), rs, "warrior")
	var d_other := LootFilter.decide(_it("w_gakgung", 0), rs, "warrior")
	_check("defaults", rs.size() == 3 and d_plain.show and not d_plain.pillar and d_leg.pillar and d_tre.pillar and d_mine.pillar
		and d_other.show and not d_other.pillar,
		"n=%d plain=%s leg=%s tre=%s mine=%s other=%s" % [rs.size(), d_plain, d_leg.pillar, d_tre.pillar, d_mine.pillar, d_other])

	# ② 첫 일치·끄기·빠른 추가
	var order_a := [{"when": {"min_tier": 2}, "do": "show"}, {"when": {}, "do": "hide"}]
	var order_b := [{"when": {}, "do": "hide"}, {"when": {"min_tier": 2}, "do": "show"}]
	var a1 := LootFilter.decide(_it("a_jichap", 1), order_a, "")
	var a2 := LootFilter.decide(_it("a_jichap", 2), order_a, "")
	var b2 := LootFilter.decide(_it("a_jichap", 2), order_b, "")
	var off := [{"when": {}, "do": "hide", "off": true}]
	var o0 := LootFilter.decide(_it("a_jichap", 0), off, "")
	DungeonSaveState.loot_filter = {"rules": [], "hinted": false}
	LootFilter.add_preset("hide1")
	var h1 := LootFilter.decide(_it("a_jichap", 1), LootFilter.rules(), "")
	var h2 := LootFilter.decide(_it("a_jichap", 2), LootFilter.rules(), "")
	LootFilter.move(0, 1)
	var moved := LootFilter.decide(_it("a_jichap", 2), LootFilter.rules(), "")
	_check("first_match", not a1.show and a2.show and not b2.show and o0.show and o0.rule == -1
		and LootFilter.rules().size() == 2 and not h1.show and h2.show and not moved.show,
		"a1=%s a2=%s b2=%s off=%s hide1=%s/%s moved=%s" % [a1.show, a2.show, b2.show, o0.show, h1.show, h2.show, moved.show])

	# ③ 진짜 spawn_at
	DungeonSaveState.loot_filter = {"rules": [{"when": {"min_tier": 0}, "do": "hide"}], "hinted": true}
	var p_hide := _spawn_one(0)
	var hid := p_hide.get_node_or_null("LootPickup") == null and p_hide.get_node_or_null("GoldPickup") != null
	DungeonSaveState.loot_filter = {}
	var p_leg := _spawn_one(4)
	var leg_area := p_leg.get_node_or_null("LootPickup")
	var leg_beam := leg_area != null and leg_area.get_node_or_null("LegendaryBeam") != null
	_check("spawn", hid and leg_beam, "hidden_no_node+gold=%s legend_beam=%s" % [hid, leg_beam])
	p_hide.queue_free()
	p_leg.queue_free()

	# ④ 세이브 왕복 · 옛 세이브
	DungeonSaveState.path_override = TMP_SAVE
	var custom := {"rules": [{"when": {"slot": "weapon"}, "do": "hide", "off": true}, {"when": {"min_tier": 2}, "do": "beam"}], "hinted": true}
	DungeonSaveState.loot_filter = custom.duplicate(true)
	var body := Node3D.new()
	add_child(body)
	DungeonSaveState.save(body)
	DungeonSaveState.loot_filter = {}
	var loaded := DungeonSaveState.try_load()
	var back: Dictionary = DungeonSaveState.loot_filter
	var rt: bool = loaded and (back.get("rules", []) as Array).size() == 2 and bool(back.get("hinted", false)) \
		and bool(back.rules[0].get("off", false)) and int(back.rules[1].when.min_tier) == 2 \
		and LootFilter.decide(_it("a_jichap", 2), LootFilter.rules(), "").pillar
	var f := FileAccess.open(TMP_SAVE, FileAccess.READ)
	var raw: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	raw.erase("loot_filter")
	var w := FileAccess.open(TMP_SAVE, FileAccess.WRITE)
	w.store_string(JSON.stringify(raw))
	w.close()
	var old_ok := DungeonSaveState.try_load() and LootFilter.rules().size() == 3
	_check("save", rt and old_ok, "roundtrip=%s old_save_defaults=%s" % [rt, old_ok])
	body.queue_free()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP_SAVE))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TMP_SAVE + ".bak"))
	DungeonSaveState.path_override = saved_path

	# ⑤ 4층 추천 한 번
	DungeonSaveState.loot_filter = {}
	var h3 := LootFilter.hint_if_deep(self, 3)
	var h4 := LootFilter.hint_if_deep(self, 4)
	var h5 := LootFilter.hint_if_deep(self, 5)
	_check("hint", not h3 and h4 and not h5 and bool(LootFilter.store().hinted), "f3=%s f4=%s f5=%s" % [h3, h4, h5])

	# ⑥ 규칙 창
	var btn: Button = load("res://games/saga_dungeon/ui/loot_filter_button.gd").new()
	add_child(btn)
	var opened := bool(btn.call("open_screen"))
	await get_tree().process_frame
	var layer: Variant = btn.get("_layer")
	var lines := 0
	if layer is CanvasLayer:
		for b in (layer as CanvasLayer).find_children("*", "Button", true, false):
			lines += 1
	btn.call("_open_rule", 0)
	await get_tree().process_frame
	btn.call("_close")
	_check("screen", opened and lines == 3 + LootFilter.PRESETS.size() + 2 and btn.get("_layer") == null,
		"opened=%s buttons=%d" % [opened, lines])
	btn.queue_free()

	DungeonSaveState.loot_filter = saved
	return fails
