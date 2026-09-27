extends Node
## GO 인물별 고유 스킬(106장 ㉔) 자동 점검 — 평소엔 안 붙는다. test_village.gd 가 SAGA_KIT_PROBE 가 있을 때만 단다.
##
##   SAGA_KIT_PROBE=1 "$GODOT" --headless --path saga-godot res://games/saga_go/world/TestVillage.tscn
##
## 세상 밖 비경 원판(잠든 무덤 자리) 위에서 멈춰 둔 허수아비 적 둘로 본다.
## ① 표(다섯·재사용 대기·기본 이름) ② 주인공 E 돌진 — 길 위 적만·앞으로 나감 ③ 주인공 Q 불새 깃 — 기본 공격에 화 부여·끝나면 물리
## ④ 현책 E 팔괘진 — 인물을 바꿔도 남아 친다 ⑤ 현책 Q — 다른 인물 기력 +15·재사용 두 배 ⑥ 해장 E 포탄 — 늦게 떨어짐
## ⑦ 해장 Q — 명단 공격 +20%·상태 줄 ⑧ 결사 E — 보호막 25%·12초 ⑨ 결사 Q — 받는 피해 ×0.7 ⑩ 도적 두목 E — 솟구침
## ⑪ 도적 두목 Q — 앞 7m 소용돌이 ⑫ 운명의 자리 1 이 고유 재사용에도·지략 인물은 원소 기본.
## 갈래 스킬(무용·통솔·인덕 × 원소 7): ⑬ 표 — 도감 전원이 trait 대로 갈래/원소 기본, 21칸 이름이 다 다름, 원소 덧붙임 수치
## ⑭ 무용 돌격 — 길 위 적만·재사용 대기 ⑮ 물결 — 스킬이 명단 체력 4% 회복 ⑯ 바위 호령 — 보호막 +12%
## ⑰ 번개 검기 — 기본 공격 뇌 부여 + 다른 인물 기력 +10 ⑱ 인덕 방패 20%·덩굴 군기 13초.
## 106장 ㉛ 이야기 동료: ⑲ 표 — 원소·무기·이름·희귀도가 story.gd MEMBERS 대로 ⑳ 나그네 E 그림자 걸음 — 가까운 적 뒤로·표식·표식 난 적 피해 ×1.25
## ㉑ 나그네 Q 가면 벗기 — 표식 난 적에만 메아리 셋 ㉒ 학자 E 비문(초 부착)·Q 옛 글자 풀이 — 반응 ×1.4·상태 줄
## ㉓ 편성(106장 ㉛·㉝) — 꽉 찬 명단에 넣으면 마지막 자리와 바뀜 · 빼면 자리가 비고 명단이 줄어듦 · 빈자리에 새 동료가 저절로 · 앞 자리로 · 나는 못 뺌.
## 106장 ㉟: ㉔ 촌장 E 부채 바람 — 앞 적만 치고 밀어냄·명단 모두 6% 회복 · Q 잔칫날 순풍 — 안에 서 있으면 1초마다 5% 회복·안의 적 풍
## ㉕ 사공 E 노 물결 — 길 위 적만·앞으로 밀어냄 · Q 뱃노래 — 기본 공격이 맞으면 물 노가 따라 침(1초 쉼)·상태 줄.
## 106장 ㊱ ㉖ 편성 여러 벌 — 빈 칸으로 바꾸면 나 혼자·넣기가 그 칸에 남음·돌아오면 옛 명단·세이브 왕복·옛 세이브(칸 없음)는 지금 명단이 1번
##   · 쫓는 적이 30m 안이면(싸우는 중) 인물 화면에서 바꾸기·넣기 막힘, 멈추면 바뀌고 지금 인물은 첫 자리.
## 저장은 안 한다(명단은 끝에 되돌린다).

const Kits := preload("res://games/saga_go/data/kits.gd")
const Domains := preload("res://games/saga_go/data/domains.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const Characters := preload("res://saga_core/data/characters.gd")
const Elements := preload("res://games/saga_go/combat/elements.gd")
const Weapons := preload("res://games/saga_go/data/weapons.gd")
const Story := preload("res://games/saga_go/data/story.gd")

var _p: CharacterBody3D
var _fc: Node
var _a: Node3D = null
var _b: Node3D = null
var _origin := Vector3.ZERO
var _members_before: Array = []
var _frame := 0
var _step := 0
var _fails := 0
var _v: Variant = null

func _ready() -> void:
	Weather.force("clear")
	_p = get_tree().get_first_node_in_group("player")

func _physics_process(_delta: float) -> void:
	_frame += 1
	if _fc == null:
		_fc = get_tree().get_first_node_in_group("go_field_combat")
		_frame = 0
		return
	match _step:
		0: # 자리 잡기
			if _frame == 1:
				_members_before = PartyState.members.duplicate()
				PartyState.members.assign(["sg_zhugeliang", "kr_yisunsin", "kr_gyebaek"])
				_origin = Domains.DOMAINS.tomb.arena + Vector3(0.0, 0.6, 6.0)
				_put(_origin)
				_fc.call("revive_all")
			if _frame == 30:
				_a = _dummy(_origin + Vector3(0.0, -0.3, -3.0))
				_b = _dummy(_origin + Vector3(5.0, -0.3, 0.0))
				_next()
		1: # ① 표
			var sage := _hero("wisdom", "fire")
			var ok: bool = Kits.KITS.size() == 16 and is_equal_approx(float(_fc.call("skill_cd_of", "self")), 6.0) \
				and is_equal_approx(float(_fc.call("skill_cd_of", "sg_zhugeliang")), 12.0) \
				and Kits.name_of(sage, "skill", "fire") == "불꽃 부채" and Kits.name_of("self", "burst", "fire") == "불새 깃"
			for id in Kits.KITS:
				for w in ["skill", "burst"]:
					ok = ok and String(Kits.KITS[id][w].get("name", "")) != "" and String(Kits.KITS[id][w].get("text", "")) != ""
			_check("table", ok, "n=%d" % Kits.KITS.size())
			_next()
		2: # ② 주인공 E 돌진
			if _frame == 1:
				_use(0)
				_v = [_a.get("hp"), _b.get("hp"), _p.global_position]
				_v.append(_fc.call("skill"))
			if _frame == 25:
				var moved: float = Vector2(_p.global_position.x - (_v[2] as Vector3).x, _p.global_position.z - (_v[2] as Vector3).z).length()
				var ok: bool = bool(_v[3]) and float(_a.get("hp")) < float(_v[0]) and is_equal_approx(float(_b.get("hp")), float(_v[1])) and moved >= 1.5 \
					and float(_fc.get("_skill_cd").get("self", 0.0)) > 5.0
				_check("self_dash", ok, "a %.0f→%.0f b %.0f→%.0f moved=%.1f" % [_v[0], _a.get("hp"), _v[1], _b.get("hp"), moved])
				_next()
		3: # ③ 주인공 Q 불새 깃
			if _frame == 1:
				_use(0)
				_put(_a.global_position + Vector3(0.0, 0.3, 1.8))
			if _frame == 10:
				_fc.get("_energy")["self"] = 100.0
				var burst_ok: bool = _fc.call("burst")
				_a.call("set_aura", "")
				_fc.set("_attack_t", 0.0)
				var hit: bool = _fc.call("attack")
				_v = [burst_ok, _fc.call("infusion_of", "self"), hit, _a.get("aura")]
			if _frame == 50:
				_fc.get("_infuse")["self"].left = 0.0
				_a.call("set_aura", "")
				_fc.set("_attack_t", 0.0)
				_fc.call("attack")
				var ok: bool = bool(_v[0]) and _v[1] == "fire" and bool(_v[2]) and _v[3] == "fire" and _a.get("aura") == "" and _fc.call("infusion_of", "self") == ""
				_check("self_infuse", ok, "burst=%s inf=%s aura=%s after=%s" % [_v[0], _v[1], _v[3], _a.get("aura")])
				_next()
		4: # ④ 현책 E 팔괘진 — 바꿔도 남는다
			if _frame == 1:
				_use(1)
				_put(_a.global_position + Vector3(0.0, 0.3, 2.0))
			if _frame == 5:
				_v = [_a.get("hp"), _fc.call("skill")]
				_fc.set("active", 0) # 바로 주인공으로
			if _frame == 110:
				var zone := _kinds().count("kit_zone")
				var ok: bool = bool(_v[1]) and zone == 1 and float(_a.get("hp")) < float(_v[0])
				_check("zhuge_zone", ok, "zone=%d a %.0f→%.0f" % [zone, _v[0], _a.get("hp")])
				_next()
		5: # ⑤ 현책 Q 천기 뇌우
			if _frame == 1:
				_use(1)
				_fc.get("_energy")["sg_zhugeliang"] = 100.0
				_fc.get("_energy")["kr_yisunsin"] = 0.0
				var ok_b: bool = _fc.call("burst")
				_v = [ok_b, float(_fc.call("energy_of", "kr_yisunsin")), float(_fc.get("_haste_t"))]
				_fc.get("_skill_cd")["self"] = 4.0
			if _frame == 61:
				## 타격 멈춤(CombatFeel)이 시간을 늦추므로 가속 시계(_haste_t)가 흐른 만큼의 두 배가 줄었는지 본다.
				var left := float(_fc.get("_skill_cd").get("self", 0.0))
				var elapsed := float(_v[2]) - float(_fc.get("_haste_t"))
				var ok: bool = bool(_v[0]) and is_equal_approx(float(_v[1]), 15.0) and absf(float(_v[2]) - 12.0) < 0.05 and elapsed > 0.5 					and absf((4.0 - left) - 2.0 * elapsed) < 0.05
				_check("zhuge_haste", ok, "energy=%.0f haste=%.1f cd_speed=×%.1f" % [_v[1], _v[2], (4.0 - left) / maxf(elapsed, 0.01)])
				_fc.set("_haste_t", 0.0)
				_next()
		6: # ⑥ 해장 E 포탄
			if _frame == 1:
				_use(2)
				_v = [_a.get("hp"), _fc.call("skill"), _kinds().count("kit_shell")]
			if _frame == 5:
				_v.append(float(_a.get("hp")))
			if _frame == 50:
				var ok: bool = bool(_v[1]) and int(_v[2]) >= 1 and is_equal_approx(float(_v[3]), float(_v[0])) and float(_a.get("hp")) < float(_v[0]) \
					and _kinds().count("kit_shell") == 0
				_check("yisun_shells", ok, "shells=%d a %.0f→(%.0f)→%.0f" % [_v[2], _v[0], _v[3], _a.get("hp")])
				_next()
		7: # ⑦ 해장 Q 학날개 진
			_use(2)
			var before := float(_fc.call("char_atk", "self"))
			_fc.get("_energy")["kr_yisunsin"] = 100.0
			var ok_b: bool = _fc.call("burst")
			var after := float(_fc.call("char_atk", "self"))
			var bt: String = _fc.call("buff_text")
			_check("yisun_rally", ok_b and is_equal_approx(after, before * 1.2) and bt.contains("공격 +20%"), "atk %.1f→%.1f buff='%s'" % [before, after, bt])
			_fc.set("_rally_t", 0.0)
			_next()
		8: # ⑧ 결사 E 결사 방진
			_use(3)
			_fc.set("shield_hp", 0.0)
			var ok_s: bool = _fc.call("skill")
			var want := float(_fc.get("max_hp")) * 0.25
			_check("gyebaek_shield", ok_s and is_equal_approx(float(_fc.get("shield_hp")), want) and absf(float(_fc.get("_shield_t")) - 12.0) < 0.05,
				"shield=%.0f/%.0f t=%.1f" % [_fc.get("shield_hp"), want, _fc.get("_shield_t")])
			_next()
		9: # ⑨ 결사 Q 오천의 맹세
			if _frame == 1:
				_use(3)
				_fc.get("_energy")["kr_gyebaek"] = 100.0
				_v = _fc.call("burst")
				_fc.set("shield_hp", 0.0)
				_fc.call("revive_all")
			if _frame == 3:
				var hp0 := float(_fc.get("hp"))
				_fc.call("take_damage", 100.0, null)
				var d := PartyState.char_def("kr_gyebaek")
				var want := 100.0 * (1.0 - d / (d + 120.0)) * 0.7
				var lost := hp0 - float(_fc.get("hp"))
				_check("gyebaek_guard", bool(_v) and absf(lost - want) < 0.01, "lost=%.2f want=%.2f" % [lost, want])
				_fc.set("_guard_t", 0.0)
				_fc.call("revive_all")
				_next()
		10: # ⑩ 도적 두목 E 회오리 도약
			if _frame == 1:
				PartyState.members.assign(["도적_두목"])
				_use(1)
				_put(_origin)
			if _frame == 40:
				_v = [_p.global_position.y, _fc.call("skill"), _p.global_position.y]
			if _frame > 40:
				_v[2] = maxf(float(_v[2]), _p.global_position.y)
			if _frame == 100:
				var rise := float(_v[2]) - float(_v[0])
				_check("boss_updraft", bool(_v[1]) and rise > 3.0, "rise=%.2f" % rise)
				_next()
		11: # ⑪ 도적 두목 Q 돌개바람 올가미
			if _frame == 30:
				_use(1)
				_fc.get("_energy")["도적_두목"] = 100.0
				var ok_b: bool = _fc.call("burst")
				var d := -1.0
				for fx in _fc.get("_effects"):
					if fx.kind == "kit_vortex":
						d = Vector2(fx.center.x - _p.global_position.x, fx.center.z - _p.global_position.z).length()
				_check("boss_vortex", ok_b and absf(d - 7.0) < 0.3, "d=%.2f" % d)
				_next()
		12: # ⑫ 운명의 자리 1·기본 원소 스킬
			PartyState.growth["kr_gyebaek"] = {"lv": 1, "exp": 0.0, "asc": 0, "tn": 1, "ts": 1, "tb": 1, "con": 1}
			var c1 := float(_fc.call("skill_cd_of", "kr_gyebaek"))
			var sage := _hero("wisdom", "water")
			var plain := float(_fc.call("skill_cd_of", sage))
			PartyState.growth.erase("kr_gyebaek")
			_check("c1_and_default", is_equal_approx(c1, 9.6) and is_equal_approx(plain, 6.0) and not Kits.has_kit(sage) and Kits.family_label(sage) == "지략",
				"c1=%.2f plain=%.2f sage=%s" % [c1, plain, sage])
			_next()
		13: # ⑬ 갈래 표
			var ok := true
			var names := {}
			var n := {"might": 0, "command": 0, "virtue": 0, "wisdom": 0}
			for h in Characters.HEROES:
				var t := String(h.trait)
				n[t] = int(n.get(t, 0)) + 1
				if Kits.is_signature(h.id):
					continue
				if t == "wisdom":
					ok = ok and not Kits.has_kit(h.id)
					continue
				var k := Kits.kit_of(h.id)
				ok = ok and String(k.get("family", "")) == t
				for w in ["skill", "burst"]:
					var txt := Kits.text_of(h.id, w)
					ok = ok and Kits.name_of(h.id, w, "") != "" and txt != "" and not txt.contains("%s")
					names[Kits.name_of(h.id, w, "")] = true
			var wf := Kits.family_kit("might", "wind")
			var ff := Kits.family_kit("might", "fire")
			var rv := Kits.family_kit("virtue", "rock")
			var gc := Kits.family_kit("command", "grass")
			ok = ok and names.size() == 42 and is_equal_approx(float(wf.skill.cd), 5.5) and is_equal_approx(float(ff.burst.mul), 1.8 * 1.15) \
				and is_equal_approx(float(rv.skill.shield), 0.32) and not rv.skill.has("bonus_shield") and is_equal_approx(float(gc.burst.sec), 13.0) \
				and is_equal_approx(float(Kits.family_kit("command", "ice").skill.mul), 0.95 * 1.15)
			_check("family_table", ok, "names=%d might=%d command=%d virtue=%d wisdom=%d" % [names.size(), n.might, n.command, n.virtue, n.wisdom])
			_next()
		14: # ⑭ 무용 돌격
			if _frame == 1:
				_v = [_hero("might", "ice")]
				PartyState.members.assign([_v[0]])
				_use(1)
				_put(_a.global_position + Vector3(0.0, 0.3, 3.0))
				_p.call("face_toward", _a.global_position)
			if _frame == 5:
				_v.append_array([_a.get("hp"), _b.get("hp"), _fc.call("skill")])
			if _frame == 25:
				var cd := float(_fc.call("skill_cd_of", _v[0]))
				var ok: bool = bool(_v[3]) and float(_a.get("hp")) < float(_v[1]) and is_equal_approx(float(_b.get("hp")), float(_v[2])) and is_equal_approx(cd, 7.0) \
					and Kits.name_of(_v[0], "skill", "") == "서리 돌격"
				_check("might_dash", ok, "%s a %.0f→%.0f b %.0f→%.0f cd=%.1f" % [_v[0], _v[1], _a.get("hp"), _v[2], _b.get("hp"), cd])
				_next()
		15: # ⑮ 물결 회복
			var id := _hero("might", "water")
			PartyState.members.assign([id])
			_use(1)
			_fc.call("revive_all")
			var m := float(_fc.get("max_hp"))
			_fc.set("hp", m * 0.5)
			var used: bool = _fc.call("skill")
			var got := float(_fc.get("hp")) - m * 0.5
			_check("water_heal", used and absf(got - m * 0.04) < 0.01, "%s +%.1f want %.1f" % [id, got, m * 0.04])
			_fc.call("revive_all")
			_next()
		16: # ⑯ 바위 호령 — 보호막 +12%
			var id := _hero("command", "rock")
			PartyState.members.assign([id])
			_use(1)
			_fc.set("shield_hp", 0.0)
			var used: bool = _fc.call("skill")
			var want := float(_fc.get("max_hp")) * 0.12
			_check("rock_shield", used and is_equal_approx(float(_fc.get("shield_hp")), want) and _kinds().count("kit_shell") >= 1,
				"%s shield=%.0f/%.0f" % [id, _fc.get("shield_hp"), want])
			_fc.set("shield_hp", 0.0)
			_next()
		17: # ⑰ 번개 검기 — 뇌 부여 + 다른 인물 기력
			if _frame == 1:
				var id := _hero("might", "thunder")
				_v = [id]
				PartyState.members.assign([id, "sg_zhugeliang"])
				_use(1)
				_put(_a.global_position + Vector3(0.0, 0.3, 1.8))
			if _frame == 10:
				var id: String = _v[0]
				_fc.get("_energy")[id] = 100.0
				_fc.get("_energy")["sg_zhugeliang"] = 0.0
				_fc.get("_energy")["self"] = 0.0
				var ok_b: bool = _fc.call("burst")
				## 기력은 기본 공격 전에 잰다(맞히면 대기 인물도 기력을 받는다 — 뇌 공명이면 더).
				var e2 := float(_fc.call("energy_of", "sg_zhugeliang"))
				var e0 := float(_fc.call("energy_of", "self"))
				_a.call("set_aura", "")
				_fc.set("_attack_t", 0.0)
				_fc.call("attack")
				var ok: bool = ok_b and _fc.call("infusion_of", id) == "thunder" and _a.get("aura") == "thunder" \
					and is_equal_approx(e2, 10.0) and is_equal_approx(e0, 10.0)
				_check("thunder_infuse", ok, "%s inf=%s aura=%s e2=%.1f self=%.1f" % [id, _fc.call("infusion_of", id), _a.get("aura"), e2, e0])
				_fc.get("_infuse").erase(id)
				_next()
		18: # ⑱ 인덕 방패 20% · 덩굴 군기 13초
			var vid := _hero("virtue", "fire")
			var cid := _hero("command", "grass")
			PartyState.members.assign([vid, cid])
			_use(1)
			_fc.set("shield_hp", 0.0)
			var ok_s: bool = _fc.call("skill")
			var want := float(_fc.get("max_hp")) * 0.2
			var s := float(_fc.get("shield_hp"))
			_use(2)
			_fc.get("_energy")[cid] = 100.0
			var ok_b: bool = _fc.call("burst")
			var bt: String = _fc.call("buff_text")
			_check("virtue_shield_grass_rally", ok_s and is_equal_approx(s, want) and ok_b and absf(float(_fc.get("_rally_t")) - 13.0) < 0.05 and bt.contains("공격 +15%"),
				"%s shield=%.0f/%.0f %s rally=%.1f buff='%s'" % [vid, s, want, cid, _fc.get("_rally_t"), bt])
			_fc.set("_rally_t", 0.0)
			_fc.set("shield_hp", 0.0)
			_next()
		19: # ⑲ 이야기 동료 표
			var ok := true
			for id in Story.MEMBERS:
				var m: Dictionary = Story.MEMBERS[id]
				ok = ok and Elements.element_of(id) == String(m.element) and Weapons.type_of(id) == String(m.weapon) \
					and _fc.call("display_name", id) == String(m.name) and Kits.family_label(id) == "고유" and Story.NPCS.has(String(m.npc))
			var joins := 0
			for c in Story.CHAPTERS:
				if Story.MEMBERS.has(String(c.get("join", ""))):
					joins += 1
			_check("story_members", ok and joins == 11, "members=%d joins=%d wanderer=%s/%s" % [Story.MEMBERS.size(), joins, Elements.element_of("story_wanderer"), Weapons.type_of("story_wanderer")])
			_next()
		20: # ⑳ 나그네 E 그림자 걸음 — 가까운 적(허수아비 a) 뒤로, 표식
			if _frame == 1:
				PartyState.members.assign(["story_wanderer"])
				_use(1)
				(_fc.get("_marks") as Dictionary).clear()
				_put(_a.global_position + Vector3(-4.0, 0.3, 5.0))
			if _frame == 5:
				_v = [_a.get("hp"), _fc.call("skill")]
			if _frame == 30:
				var d := Vector2(_p.global_position.x - _a.global_position.x, _p.global_position.z - _a.global_position.z).length()
				_a.call("set_aura", "")
				_b.call("set_aura", "")
				var da: float = _fc.call("_deal", _a, 100.0, "", Vector3.FORWARD)
				var db: float = _fc.call("_deal", _b, 100.0, "", Vector3.FORWARD)
				var bt: String = _fc.call("buff_text")
				var ok: bool = bool(_v[1]) and float(_a.get("hp")) < float(_v[0]) and absf(d - 1.5) < 1.0 and bool(_fc.call("is_marked", _a)) \
					and not bool(_fc.call("is_marked", _b)) and absf(da / maxf(db, 0.01) - 1.25) < 0.02 and bt.contains("표식 1")
				_check("wanderer_blink", ok, "a %.0f→%.0f behind=%.2f marked=%s ratio=%.3f buff='%s'" % [_v[0], _a.get("hp"), d, _fc.call("is_marked", _a), da / maxf(db, 0.01), bt])
				_next()
		21: # ㉑ 나그네 Q 가면 벗기 — 표식 난 a 에만 메아리
			if _frame == 1:
				_use(1)
				_fc.get("_energy")["story_wanderer"] = 100.0
				var ok_b: bool = _fc.call("burst")
				_v = [ok_b, _kinds().count("kit_echo"), float(_a.get("hp"))]
			if _frame == 120:
				var ok: bool = bool(_v[0]) and int(_v[1]) == 1 and float(_a.get("hp")) < float(_v[2]) and _kinds().count("kit_echo") == 0
				_check("wanderer_echo", ok, "burst=%s echoes=%d a %.0f→%.0f" % [_v[0], _v[1], _v[2], _a.get("hp")])
				(_fc.get("_marks") as Dictionary).clear()
				_next()
		22: # ㉒ 학자 E 비문 탁본(초 부착) · Q 옛 글자 풀이(반응 ×1.4)
			if _frame == 1:
				PartyState.members.assign(["story_scholar"])
				_use(1)
				_put(_a.global_position + Vector3(0.0, 0.3, 2.0))
			if _frame == 5:
				_a.call("set_aura", "")
				_v = [_fc.call("skill"), _kinds().count("kit_zone")]
			if _frame == 110:
				_v.append(String(_a.get("aura")))
				var m0: float = _fc.call("_reaction_mul", "")
				_fc.get("_energy")["story_scholar"] = 100.0
				var ok_b: bool = _fc.call("burst")
				var m1: float = _fc.call("_reaction_mul", "")
				var bt: String = _fc.call("buff_text")
				var ok: bool = bool(_v[0]) and int(_v[1]) == 1 and _v[2] == "grass" and ok_b and absf(m1 / m0 - 1.4) < 0.001 and bt.contains("반응 +40%")
				_check("scholar_lore", ok, "zone=%d aura=%s react ×%.2f buff='%s'" % [_v[1], _v[2], m1 / m0, bt])
				_fc.set("_lore_t", 0.0)
				_next()
		23: # ㉓ 편성
			PartyState.members.assign(["sg_zhugeliang", "kr_yisunsin", "kr_gyebaek", "story_wanderer"])
			var before: bool = PartyState.in_party("story_wanderer")
			var r0: Array = _fc.call("roster")
			var put: bool = PartyState.put_in_party("story_wanderer")
			var again: bool = PartyState.put_in_party("story_wanderer")
			var r1: Array = _fc.call("roster")
			var swap_ok: bool = not before and not r0.has("story_wanderer") and put and not again 				and r1 == ["self", "sg_zhugeliang", "kr_yisunsin", "story_wanderer"] and PartyState.members.size() == 4
			## 빼기 → 셋, 빈자리에 새 동료가 저절로, 앞 자리로, 나는 못 뺌
			var rm: bool = PartyState.remove_from_party("sg_zhugeliang")
			var r2: Array = _fc.call("roster")
			PartyState.recruit("story_scholar")
			var r3: Array = _fc.call("roster")
			var up: bool = PartyState.move_up_in_party("story_scholar")
			var r4: Array = _fc.call("roster")
			var self_rm: bool = PartyState.remove_from_party("self")
			var ok: bool = swap_ok and rm and r2 == ["self", "kr_yisunsin", "story_wanderer"] and PartyState.party_size == 3 				and r3 == ["self", "kr_yisunsin", "story_wanderer", "story_scholar"] and up and r4 == ["self", "kr_yisunsin", "story_scholar", "story_wanderer"] 				and not self_rm and PartyState.members.size() == 5 and PartyState.members.has("sg_zhugeliang")
			_check("formation", ok, "roster %s → %s → 빼기 %s → 합류 %s → 앞으로 %s" % [r0, r1, r2, r3, r4])
			PartyState.party_size = PartyState.PARTY_MAX
			_next()
		24: # ㉔ 촌장 E 부채 바람 · Q 잔칫날 순풍
			var eid := "story_elder"
			if _frame == 1:
				PartyState.members.assign([eid])
				_use(1)
				_fc.call("revive_all")
				_put(_a.global_position + Vector3(0.0, 0.3, 2.5))
			if _frame == 5:
				var hps: Dictionary = _fc.get("_hp")
				hps["self"] = float(_fc.call("max_hp_of", "self")) * 0.5
				hps[eid] = float(_fc.call("max_hp_of", eid)) * 0.5
				_a.set("_knock", Vector3.ZERO)
				_v = {"a": float(_a.get("hp")), "b": float(_b.get("hp")), "skill": bool(_fc.call("skill"))}
				_v.self_gain = float(_fc.call("hp_of", "self")) / float(_fc.call("max_hp_of", "self")) - 0.5
				_v.knock = (_a.get("_knock") as Vector3)
				_v.away = (_v.knock as Vector3).normalized().dot(Vector3(0.0, 0.0, -1.0)) # 나(남쪽) → a(북쪽) 방향으로 밀림
				_v.a1 = float(_a.get("hp"))
				_v.b_same = is_equal_approx(float(_b.get("hp")), float(_v.b)) # 부채꼴 밖(폭발 전에 잰다)
				_fc.get("_energy")[eid] = 100.0
				_v.burst = bool(_fc.call("burst"))
				_v.feast = _kinds().count("kit_feast")
				hps[eid] = float(_fc.call("max_hp_of", eid)) * 0.5
				_v.a2 = float(_a.get("hp"))
			if _frame == 170: # 1초마다 — 두 번은 돈다(140 이면 바쁜 판에서 한 번만 돈 적 있다)
				var gain := float(_fc.call("hp_of", eid)) / float(_fc.call("max_hp_of", eid)) - 0.5
				var ok: bool = bool(_v.skill) and float(_v.a1) < float(_v.a) and bool(_v.b_same) and absf(float(_v.self_gain) - 0.06) < 0.005 \
					and float(_v.away) > 0.9 and bool(_v.burst) and int(_v.feast) == 1 and gain >= 0.099 and float(_a.get("hp")) < float(_v.a2)
				_check("elder_heal", ok, "a %.0f→%.0f b same=%s self +%.3f push·dot=%.2f feast=%d elder +%.3f a %.0f→%.0f" % [_v.a, _v.a1, _v.b_same, _v.self_gain, _v.away, _v.feast, gain, _v.a2, _a.get("hp")])
				(_fc.get("_effects") as Array).clear()
				_next()
		25: # ㉕ 사공 E 노 물결 · Q 뱃노래
			var fid := "story_ferryman"
			if _frame == 1:
				PartyState.members.assign([fid])
				_use(1)
				_put(_a.global_position + Vector3(0.0, 0.3, 4.0))
			if _frame == 5:
				_a.set("_knock", Vector3.ZERO)
				_a.call("set_aura", "")
				_v = {"a": float(_a.get("hp")), "b": float(_b.get("hp")), "skill": bool(_fc.call("skill"))}
				_v.fwd = (_a.get("_knock") as Vector3).normalized().dot(Vector3(0.0, 0.0, -1.0))
				_v.aura = String(_a.get("aura"))
				_v.a1 = float(_a.get("hp"))
				_fc.get("_energy")[fid] = 100.0
				_v.burst = bool(_fc.call("burst"))
				_v.bt = String(_fc.call("buff_text"))
				_put(_a.global_position + Vector3(0.0, 0.3, 1.5))
			if _frame == 12:
				_fc.set("_attack_t", 0.0)
				_fc.set("_rain_cd", 0.0)
				_v.a2 = float(_a.get("hp"))
				_v.hit = bool(_fc.call("attack"))
				_v.cd = float(_fc.get("_rain_cd"))
				_v.again = int(_fc.call("_rain_follow")) # 쉬는 틈 — 안 나감
				_fc.set("_rain_cd", 0.0)
				_v.follow = int(_fc.call("_rain_follow")) # a·b 둘 다 8m 안
				var ok: bool = bool(_v.skill) and float(_v.a1) < float(_v.a) and float(_v.fwd) > 0.9 and String(_v.aura) == "water" and bool(_v.burst) \
					and absf(float(_fc.get("_rain_t")) - 15.0) < 0.3 and String(_v.bt).contains("뱃노래") and bool(_v.hit) and float(_v.cd) > 0.9 \
					and int(_v.again) == 0 and int(_v.follow) == 2 and float(_a.get("hp")) < float(_v.a2)
				_check("ferryman_rain", ok, "a %.0f→%.0f push·dot=%.2f aura=%s rain=%.1f buff='%s' hit=%s cd=%.2f again=%d follow=%d" % [_v.a, _v.a1, _v.fwd, _v.aura, _fc.get("_rain_t"), _v.bt, _v.hit, _v.cd, _v.again, _v.follow])
				_fc.set("_rain_t", 0.0)
				_next()
		26: # ㉖ 편성 여러 벌
			if _frame == 1:
				_v = {"presets": PartyState.presets.duplicate(true), "pi": PartyState.preset_i, "size": PartyState.party_size}
				PartyState.members.assign(["sg_zhugeliang", "kr_yisunsin", "kr_gyebaek", "story_wanderer"])
				PartyState.party_size = 3
				PartyState.restore_presets(null, 2) # 옛 세이브 — 칸 없음
				var legacy: bool = PartyState.preset_i == 0 and PartyState.presets[0] == ["sg_zhugeliang", "kr_yisunsin", "kr_gyebaek"]
				var sw1: bool = PartyState.use_preset(1)
				var r1: Array = _fc.call("roster")
				var put: bool = PartyState.put_in_party("story_wanderer")
				var p1: Array = PartyState.presets[1]
				var sw0: bool = PartyState.use_preset(0)
				var same: bool = PartyState.use_preset(0)
				var r0: Array = _fc.call("roster")
				PartyState.use_preset(1)
				var r1b: Array = _fc.call("roster")
				var saved: Array = PartyState.presets.duplicate(true)
				PartyState.restore_presets(saved, 1)
				var trip: bool = PartyState.preset_i == 1 and PartyState.preset_party(0) == ["sg_zhugeliang", "kr_yisunsin", "kr_gyebaek"] and PartyState.party() == ["story_wanderer"]
				var ok: bool = legacy and sw1 and r1 == ["self"] and put and p1 == ["story_wanderer"] and sw0 and not same \
					and r0 == ["self", "sg_zhugeliang", "kr_yisunsin", "kr_gyebaek"] and r1b == ["self", "story_wanderer"] and trip and PartyState.members.size() == 4
				_v.ok = ok
				_v.detail = "legacy=%s r1=%s put=%s p1=%s r0=%s r1b=%s trip=%s" % [legacy, r1, put, p1, r0, r1b, trip]
				## 싸우는 중 — 허수아비 a 가 나를 쫓는 셈
				_put(_a.global_position + Vector3(0.0, 0.3, 4.0))
			if _frame == 5:
				var cs: Node = get_tree().get_first_node_in_group("go_character_screen")
				_a.set("ai", FieldEnemy.AI.IDLE) # 앞 단계가 남긴 상태를 비우고 a 만 쫓게
				_b.set("ai", FieldEnemy.AI.IDLE)
				_v.quiet = not bool(_fc.call("in_combat"))
				_a.set("ai", FieldEnemy.AI.CHASE)
				_fc.set("active", 1)
				_v.fight = bool(_fc.call("in_combat"))
				_v.blocked = cs != null and not bool(cs.call("use_preset", 2))
				_v.still = PartyState.preset_i == 1
				_a.set("ai", FieldEnemy.AI.IDLE)
				_v.calm = not bool(_fc.call("in_combat"))
				_v.moved = cs != null and bool(cs.call("use_preset", 2))
				_v.active = int(_fc.get("active"))
				var ok: bool = bool(_v.ok) and bool(_v.quiet) and bool(_v.fight) and bool(_v.blocked) and bool(_v.still) and bool(_v.calm) and bool(_v.moved) \
					and PartyState.preset_i == 2 and int(_v.active) == 0
				_check("presets", ok, "%s · quiet=%s still=%s fight=%s blocked=%s calm=%s moved=%s active=%d" % [_v.detail, _v.quiet, _v.still, _v.fight, _v.blocked, _v.calm, _v.moved, _v.active])
				PartyState.presets = _v.presets
				PartyState.preset_i = int(_v.pi)
				PartyState.party_size = int(_v.size)
				_next()
		27:
			PartyState.members.assign(_members_before)
			print("KIT_PROBE_DONE fails=%d" % _fails)
			get_tree().quit()

## 멈춰 둔 허수아비 — 체력만 크고 움직이지 않는다(피해·부착은 그대로 받는다).
func _dummy(pos: Vector3) -> Node3D:
	var e: CharacterBody3D = FieldEnemy.new()
	e.name = "KitDummy_%d" % get_child_count()
	e.setup("wolf", pos, 20260824 + get_child_count())
	e.respawns = false
	e.drops = false
	add_child(e)
	e.set("max_hp", 1.0e6)
	e.set("hp", 1.0e6)
	e.process_mode = Node.PROCESS_MODE_DISABLED
	return e

## 그 명단 자리 인물로, 재사용 대기·남은 효과를 비우고.
func _use(index: int) -> void:
	_fc.set("active", index)
	(_fc.get("_skill_cd") as Dictionary).clear()
	(_fc.get("_effects") as Array).clear()

## trait·원소가 맞는 첫 도감 인물(고유 다섯은 뺀다).
func _hero(trait_id: String, el: String) -> String:
	for h in Characters.HEROES:
		if String(h.trait) == trait_id and Elements.element_of(h.id) == el and not Kits.is_signature(h.id):
			return h.id
	return ""

func _kinds() -> Array:
	return (_fc.get("_effects") as Array).map(func(fx: Dictionary) -> String: return String(fx.kind))

func _put(pos: Vector3) -> void:
	_p.global_position = pos
	_p.velocity = Vector3.ZERO

func _check(name: String, ok: bool, detail: String) -> void:
	if not ok:
		_fails += 1
	print("KIT_PROBE %s %s %s" % [name, "ok" if ok else "FAIL", detail])

func _next() -> void:
	_step += 1
	_frame = 0
