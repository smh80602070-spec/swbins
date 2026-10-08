extends SceneTree

## GO 이야기 동료 열여섯(data/story.gd MEMBERS — ㉛·㉟ 학자·나그네·촌장·사공·해솔(+하람) / ㊼~51 3~7부 달음·도담·한별·물새·하늬 / 이후 초롱·해미·벼리·나래·소담) 규칙 점검 — 화면 없는 순수 표·PartyState 규칙.
##   godot --headless --path saga-godot --script res://tools/probe_story_members.gd
## ① 표: 이름·시대·희귀도 4/5·원소·무기·서 있는 인물(npc)이 다 유효하고 이름·인물이 겹치지 않음 ② 장 끝 합류(join): 동료마다 정확히 한 장에서 · 장 순서가 표 순서와 같음 · 3~7부 다섯과 처음 여섯의 장 번호
## ③ 고유 스킬(data/kits.gd KITS): 동료마다 스킬·폭발이 이름·종류·대기·설명을 가짐 · 이름 겹침 없음 ④ PartyState.recruit: 명단에 들고 편성 빈자리에 서며 · 두 번 부르면 편성이 겹치지 않음. 상태는 끝에 되돌린다.
## 끝에 "PROBE story_members OK" 또는 "PROBE story_members FAIL n".

const Story := preload("res://games/saga_go/data/story.gd")
const Kits := preload("res://games/saga_go/data/kits.gd")
const Weapons := preload("res://games/saga_go/data/weapons.gd")

## 장 끝에 합류하는 차례(장 번호 = 1 부터) — 표(CHAPTERS)가 이 순서·번호를 따른다.
const JOIN_CH := {
	"story_scholar": 2, "story_wanderer": 5, "story_elder": 6, "story_ferryman": 7, "story_haesol": 9, "story_haram": 12,
	"story_dareum": 15, "story_dodam": 18, "story_hanbyeol": 20, "story_mulsae": 23, "story_haneul": 26,
	"story_chorong": 32, "story_haemi": 35, "story_byeori": 38, "story_narae": 40, "story_sodam": 41,
}

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame  # PartyState autoload 가 올라온 뒤
	var ids: Array = Story.MEMBERS.keys()

	# ① 표
	var bad: Array = []
	var names := {}
	var npcs := {}
	for id in ids:
		var m: Dictionary = Story.MEMBERS[id]
		var ok: bool = String(m.get("name", "")) != "" and ["과거", "현대", "미래"].has(String(m.get("era", ""))) \
			and [4, 5].has(int(m.get("rarity", 0))) and Kits.ELEMENT_NAMES.has(String(m.get("element", ""))) \
			and Weapons.TYPES.has(String(m.get("weapon", ""))) and Story.NPCS.has(String(m.get("npc", "")))
		if not ok:
			bad.append(id)
		names[m.get("name", "")] = true
		npcs[m.get("npc", "")] = true
	check(ids.size() == JOIN_CH.size() and bad.is_empty(), "MEMBERS %d 명 · 이름·시대·희귀도(4/5)·원소·무기·서 있는 인물이 다 유효 %s" % [ids.size(), str(bad)])
	check(names.size() == ids.size() and npcs.size() == ids.size(), "동료 이름·서 있는 인물이 겹치지 않음")
	var five_star := 0
	for id in ids:
		if int(Story.MEMBERS[id].rarity) == 5:
			five_star += 1
	check(five_star >= 3 and five_star < ids.size(), "5성은 일부만(%d/%d) — 나그네·해솔·한별 같은 극적인 자리" % [five_star, ids.size()])
	check(Story.member("story_dareum") != null and Story.member("nobody") == null and String(Story.member("story_haneul").name) == "비행사 하늬", "Story.member: 있는 이름은 표를, 모르는 이름은 null")

	# ② 합류 장
	var joins := {}
	var last_ch := 0
	var order_ok := true
	for i in Story.CHAPTERS.size():
		var j := String(Story.CHAPTERS[i].get("join", ""))
		if j == "":
			continue
		joins[j] = joins.get(j, 0) + 1
		if i + 1 <= last_ch:
			order_ok = false
		last_ch = i + 1
	var join_ok: bool = joins.size() == ids.size()
	for id in ids:
		join_ok = join_ok and int(joins.get(id, 0)) == 1
	check(join_ok and order_ok, "장 끝 합류: 동료마다 정확히 한 장 · join 값이 다 MEMBERS 의 id · 장 순서대로")
	var ch_ok := true
	for id in JOIN_CH:
		var n := int(JOIN_CH[id])
		ch_ok = ch_ok and n <= Story.CHAPTERS.size() and String(Story.CHAPTERS[n - 1].get("join", "")) == id
	check(ch_ok, "합류 장 번호: 은비 2·나그네 5·촌장 6·사공 7·해솔 9·하람 12 / 달음 15·도담 18·한별 20·물새 23·하늬 26 / 초롱 32 … 소담 41")
	var past_ok := true
	for id in ["story_dareum", "story_dodam", "story_hanbyeol", "story_mulsae", "story_haneul"]:
		past_ok = past_ok and ids.has(id)
	check(past_ok and Story.MEMBERS.story_hanbyeol.rarity == 5 and Story.MEMBERS.story_dareum.era == "과거" and Story.MEMBERS.story_hanbyeol.era == "미래", "3~7부 동료 다섯: 시대(달음 과거·한별 미래)·한별만 5성")

	# ③ 고유 스킬
	var kit_bad: Array = []
	var skill_names := {}
	for id in ids:
		var k: Dictionary = Kits.KITS.get(id, {})
		var s: Dictionary = k.get("skill", {})
		var b: Dictionary = k.get("burst", {})
		var ok: bool = String(s.get("name", "")) != "" and String(s.get("type", "")) != "" and float(s.get("cd", 0.0)) > 0.0 and String(s.get("text", "")) != "" \
			and String(b.get("name", "")) != "" and String(b.get("type", "")) != "" and String(b.get("text", "")) != ""
		if not ok:
			kit_bad.append(id)
		skill_names[s.get("name", "")] = true
		skill_names[b.get("name", "")] = true
	check(kit_bad.is_empty(), "고유 스킬·폭발: 열여섯 명 모두 이름·종류·설명(스킬은 대기 > 0) %s" % str(kit_bad))
	check(skill_names.size() == ids.size() * 2, "스킬·폭발 이름이 겹치지 않음(%d)" % skill_names.size())

	# ④ PartyState.recruit
	var P: Node = root.get_node("PartyState")
	var saved := {"members": P.members.duplicate(), "size": P.party_size, "presets": P.presets.duplicate(true), "i": P.preset_i, "dispatch": P.dispatch.duplicate(true)}
	P.dispatch = {}
	var first: String = String(Story.MEMBERS.keys()[0])
	P.members.assign(P.members.filter(func(x): return not String(x).begins_with("story_")))
	P.party_size = 1
	P.recruit(first)
	check(P.members.has(first) and P.in_party(first), "recruit: 명단에 들고 편성 빈자리에 섬(%s)" % first)
	var before: Array = P.party().duplicate()
	var second: String = String(Story.MEMBERS.keys()[1])
	P.recruit(second)
	var want_party: Array = before + [second] if before.size() < P.PARTY_MAX else before   # G-0118 — 칸이 비면 들어가고, 차면 그대로(둘 다 정답이던 것)
	check(P.members.has(second) and P.party() == want_party, "다음 동료를 부르면 명단에 듦 · 편성 칸이 차 있으면 그대로(%d → %d명)" % [before.size(), P.party().size()])
	var dup := {}
	for x in P.party():
		dup[x] = true
	check(dup.size() == P.party().size(), "편성에 같은 이름이 둘 들지 않음")

	P.members.assign(saved.members)
	P.party_size = saved.size
	P.presets = saved.presets
	P.preset_i = saved.i
	P.dispatch = saved.dispatch
	P._recompute()
	print("PROBE story_members ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
