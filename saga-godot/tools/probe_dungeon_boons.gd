extends SceneTree

## 사가블로 은사(games/saga_dungeon/data/dungeon_boons.gd 표·굴림, dungeon_run_state.gd 얹기·합산) 자동 점검 — 화면 없는 순수 규칙. 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_boons.gd
## ① 표: 키 유일·축 skill/hero/world·희귀도 3단·상한≥1·설명·원소 시너지 셋이 표에 있고 6결을 하나씩 짝지음·시너지 상수
## ② roll_choice: 600번 — 카드 셋·겹침 없음·세 축에서 하나씩·상한 찬 은사는 안 나옴·exclude_keys 지킴·축 하나가 다 차면 나머지에서 채움·전부 차면 빈 손·희귀도 문턱(common 이 legendary 보다 훨씬 흔함)
## ③ apply_boon_to: 모르는 키는 {} · 한 번에 1 오름 · 상한에서 막힘 · 비급은 allow_skill_grant=false 면 무예 점수를 안 줌(카운트만)
## ④ 합산: 맹공·철벽·연격·질주·장병·수호부·일격·진기·재물운의 getter 가 은사 수에 비례해 오름(기준선과의 차이로 잼) · 다른 채널(장비·부대)과 안 섞임 · 잠깐짜리 buff 는 약한 재시전이 강한 걸 못 덮음
## ⑤ reject_choice: 금 30×층·restore 가 boons 를 통째로 갈아 끼움. 상태는 끝에 되돌린다. 끝에 "PROBE dungeon_boons OK" 또는 "PROBE dungeon_boons FAIL n".

const Boons := preload("res://games/saga_dungeon/data/dungeon_boons.gd")
const Items := preload("res://games/saga_dungeon/data/dungeon_items.gd")

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _axis_of(k: String) -> String:
	return String(Boons.by_key(k).get("axis", ""))


func _initialize() -> void:
	await process_frame  # DungeonRunState·DungeonGoldState autoload 가 올라온 뒤
	seed(20260824)
	var R: Node = root.get_node("DungeonRunState")
	var G: Node = root.get_node("DungeonGoldState")
	var saved_boons: Dictionary = R.boons.duplicate()
	var saved_gold: int = G.gold

	# ① 표
	var keys := {}
	var axes := {}
	var rar := {}
	var table_ok := true
	for b: Dictionary in Boons.BOONS:
		keys[b.key] = true
		axes[b.axis] = int(axes.get(b.axis, 0)) + 1
		rar[b.rarity] = int(rar.get(b.rarity, 0)) + 1
		table_ok = table_ok and int(b.max) >= 1 and String(b.name) != "" and String(b.desc) != "" and String(b.emoji) != "" and b.eff is Dictionary
	check(table_ok and keys.size() == Boons.BOONS.size(), "은사 %d: 키 유일 · 상한≥1 · 이름·이모지·설명·eff" % Boons.BOONS.size())
	check(axes.size() == 3 and axes.has("skill") and axes.has("hero") and axes.has("world") and rar.size() == 3 and rar.has("common") and rar.has("rare") and rar.has("legendary"), "축 셋(skill·hero·world) · 희귀도 셋 모두 쓰임 %s %s" % [str(axes), str(rar)])
	var syn_els := {}
	var syn_ok: bool = Boons.SYNERGIES.size() == 3
	for s: Dictionary in Boons.SYNERGIES:
		var bb: Dictionary = Boons.by_key(String(s.key))
		syn_ok = syn_ok and not bb.is_empty() and bb.axis == "world" and bb.rarity == "legendary" and int(bb.max) == 1 and s.a != s.b \
			and not Items.elem_by_key(String(s.a)).is_empty() and not Items.elem_by_key(String(s.b)).is_empty() and String(s.a) != "phys" and String(s.b) != "phys"
		syn_els[s.a] = true
		syn_els[s.b] = true
	check(syn_ok and syn_els.size() == 6, "원소 시너지 3쌍: 표에 세계 축·전설·상한 1로 있고 6결을 하나씩 짝지음")
	check(Boons.SYN_RADIUS > 2.0 and Boons.SYN_RADIUS < 3.0 and Boons.SYN_DAMAGE > 8.0, "시너지 반경 %.2fm(≈2.35) · 피해 %.0f(보석 원소 피해의 두 배쯤)" % [Boons.SYN_RADIUS, Boons.SYN_DAMAGE])
	check(Boons.by_key("fury").name == "맹공(猛攻)" and Boons.by_key("nope").is_empty(), "by_key: 있는 키는 표를 · 없으면 {}")

	# ② roll_choice
	var bad := 0
	var by_rar := {"common": 0, "rare": 0, "legendary": 0}
	for n in 600:
		var c: Array[String] = Boons.roll_choice({})
		var seen_axes := {}
		var ok: bool = c.size() == 3
		var uniq := {}
		for k in c:
			uniq[k] = true
			seen_axes[_axis_of(k)] = true
			by_rar[String(Boons.by_key(k).rarity)] += 1
		if not (ok and uniq.size() == 3 and seen_axes.size() == 3):
			bad += 1
	check(bad == 0, "roll_choice 600번: 카드 셋 · 겹침 없음 · 세 축에서 하나씩(탈락 %d)" % bad)
	check(by_rar.common > by_rar.rare and by_rar.rare > by_rar.legendary and by_rar.legendary > 0, "희귀도: common > rare > legendary 이고 전설도 나옴 %s" % str(by_rar))
	var capped := {}
	for b: Dictionary in Boons.BOONS:
		if b.axis == "skill":
			capped[b.key] = b.max
	var skill_free := true
	var fill := true
	for n in 200:
		var c2: Array[String] = Boons.roll_choice(capped)
		fill = fill and c2.size() == 3
		for k in c2:
			skill_free = skill_free and _axis_of(k) != "skill"
	check(skill_free and fill, "한 축이 다 차면 그 축 은사는 안 나오고 나머지에서 카드 셋을 채움")
	var ex: Array[String] = ["skillpoint"]
	var ex_ok := true
	for n in 300:
		ex_ok = ex_ok and not Boons.roll_choice({}, ex).has("skillpoint")
	check(ex_ok, "exclude_keys(비급)를 지킴 — 난입이 영구 무예 점수를 못 뽑게")
	var all_full := {}
	for b: Dictionary in Boons.BOONS:
		all_full[b.key] = b.max
	check(Boons.roll_choice(all_full).is_empty(), "전부 상한이면 빈 손")

	# ③ apply_boon_to
	var counts := {}
	check(R.apply_boon_to("nope", counts, false).is_empty() and counts.is_empty(), "apply_boon_to: 모르는 키는 {} · 카운트 불변")
	var first: Dictionary = R.apply_boon_to("dash", counts, false)
	R.apply_boon_to("dash", counts, false)
	R.apply_boon_to("dash", counts, false)
	var over: Dictionary = R.apply_boon_to("dash", counts, false)
	check(first.key == "dash" and int(counts.dash) == 3 and over.is_empty() and int(counts.dash) == int(Boons.by_key("dash").max), "한 번에 1 오름 · 상한(질주 3)에서 막힘")
	var c3 := {}
	var sp: Dictionary = R.apply_boon_to("skillpoint", c3, false)
	check(sp.key == "skillpoint" and int(c3.skillpoint) == 1, "비급은 allow_skill_grant=false 면 무예 점수 없이 카운트만")

	# ④ 합산 — 기준선과의 차이로 잰다(장비·부대·무예 채널이 같이 더해지므로)
	R.boons = {}
	var base := {"atk": R.atk_mult(), "hp": R.hp_mult(), "spd": R.atk_speed_mult(), "move": R.move_speed_mult(), "reach": R.reach_mult(), "guard": R.guard_mult(), "crit": R.crit_chance(),
		"skill": R.skill_mul(), "gold": R.gold_mult(), "drain": R.drain_pct(), "echo": R.echo_pct()}
	R.boons = {"fury": 2, "wall": 1, "haste": 3, "dash": 1, "reach": 2, "ward": 3, "crit": 2, "skillamp1": 1, "skillamp2": 2, "greed": 4, "drain": 2, "ghost": 1}
	var near := func(a: float, b: float) -> bool: return absf(a - b) < 0.0001
	check(near.call(R.atk_mult() - base.atk, 0.36) and near.call(R.hp_mult() - base.hp, 0.20) and near.call(R.atk_speed_mult() - base.spd, 0.42) and near.call(R.move_speed_mult() - base.move, 0.16) and near.call(R.reach_mult() - base.reach, 0.36),
		"합산: 맹공 2=+36%% · 철벽 1=+20%% · 연격 3=+42%% · 질주 1=+16%% · 장병 2=+36%%")
	check(near.call(R.guard_mult() - base.guard, -0.36) and near.call(R.crit_chance() - base.crit, 16.0) and near.call(R.skill_mul() - base.skill, 0.75) and near.call(R.gold_mult() - base.gold, 1.2) and near.call(R.drain_pct() - base.drain, 6.0) and near.call(R.echo_pct() - base.echo, 22.0),
		"합산: 수호부 3=받는 피해 -36%% · 일격 2=치명 +16 · 무예 위력 +15+60=+75%% · 재물운 4=금 +120%% · 흡혈 6 · 분신 22")
	R.boons = {"syn_fire_lit": 1, "skillpoint": 5}
	check(near.call(R.atk_mult(), base.atk) and near.call(R.skill_mul(), base.skill) and near.call(R.hp_mult(), base.hp), "시너지·비급은 합산 채널에 안 섞임(eff 가 비었거나 즉시형)")
	R.boons = {}
	R.add_temp_buff("atkPct", 50.0, 30.0)
	var strong: float = R.atk_mult()
	R.add_temp_buff("atkPct", 10.0, 30.0)
	var weak_try: float = R.atk_mult()
	R.add_temp_buff("atkPct", 80.0, 30.0)
	var stronger: float = R.atk_mult()
	R._temp_buffs.clear()
	check(near.call(strong - base.atk, 0.5) and near.call(weak_try, strong) and near.call(stronger - base.atk, 0.8) and near.call(R.atk_mult(), base.atk), "잠깐짜리 buff: 약한 재시전은 강한 걸 못 덮고 · 더 센 건 덮고 · 지우면 기준선")

	# ⑤ reject·restore
	G.gold = 100
	var got1: int = R.reject_choice(0)
	var got4: int = R.reject_choice(3)
	check(got1 == 30 and got4 == 120 and G.gold == 250, "reject_choice: 금 30×층(방 0 → 30 · 방 3 → 120) · 합계 250")
	R.restore({"fury": 2, "crit": "3"})
	check(R.boons == {"fury": 2, "crit": 3}, "restore: 은사를 통째로 갈아 끼움(문자열 개수도 정수로)")

	R.boons = saved_boons
	G.gold = saved_gold
	print("PROBE dungeon_boons ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
