extends SceneTree

## 사가나락 장비 데이터 층(games/saga_dungeon/data/dungeon_items.gd — 등급·접사·소켓·룬·부문어·세트·내구·값·원소) 자동 점검 — 화면 없는 순수 표·굴림 규칙. 씨앗 고정(20260824).
##   godot --headless --path saga-godot --script res://tools/probe_dungeon_gear.gd
## ① 표: 등급 5(가중치 내림·배수 오름·접사 수=번호)·접사 14(키 유일·lo<hi)·밑감(키 유일·부위별 개수 무기 12·갑주 5·투구 3·장갑 2·신발 2·반지 2·목걸이 2·부적 5)
## ② roll: 3000번 굴려 접사 수=등급·접사 겹침 없음·소켓 수≤부위 최대·내구=dur_max_of·미확인=등급 1 이상·세트는 보물만·부위 지정 존중·forced_tier
## ③ 등급 추첨: 가중치 비율에 가깝고 legendary_mult 가 전설만 키움·투전 추첨은 윗등급이 두꺼움
## ④ 소켓·룬·부문어: 룬 12(등급 1~5·next_rune_key)·부문어 5(룬 키가 다 있음)·순서가 맞아야 이루어짐·빈 구멍이면 안 이루어짐·무기 전용 용호·socket_effects 가 부문어만 냄·룬 드랍이 층 한도 안
## ⑤ 세트: 10벌·조각이 밑감에 있고 한 벌에만 속함·bonus_for 누적(1점 0·2점·3점)·set_of_base
## ⑥ 내구: 장신구(부적·반지·목걸이)는 0·부서짐 규칙·수리값(가득 0·닳을수록 늘어 값의 40% 에 닿음)·값이 등급·수준에 늘어남·투전·주문서 값
## ⑦ 원소: 7(물리+6결)·보석 6이 무기=eldmg·갑주=elres·부적 능력치를 줌·socket_effects 가 박힌 부위에 맞게 냄·보석 등급 배수가 오름·저항 상한 75.
## 끝에 "PROBE dungeon_gear OK" 또는 "PROBE dungeon_gear FAIL n".

const Items := preload("res://games/saga_dungeon/data/dungeon_items.gd")

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	seed(20260824)

	# ① 표
	var tiers_ok: bool = Items.TIERS.size() == 5
	for i in Items.TIERS.size():
		var t: Dictionary = Items.TIERS[i]
		tiers_ok = tiers_ok and int(t.key) == i and int(t.affix) == i
		if i > 0:
			tiers_ok = tiers_ok and float(t.weight) < float(Items.TIERS[i - 1].weight) and float(t.mul) > float(Items.TIERS[i - 1].mul)
	check(tiers_ok and Items.LEGENDARY_TIER == 4 and Items.SET_TIER == 3, "등급 5: 번호=접사 수 · 가중치 내림 · 배수 오름 · 전설 4 · 세트는 보물(3)")
	var aff_keys := {}
	var aff_ok := true
	for a: Dictionary in Items.AFFIXES:
		aff_keys[a.key] = true
		aff_ok = aff_ok and float(a.lo) < float(a.hi) and ["flat", "pct", "world"].has(String(a.kind)) and (String(a.kind) != "world" or String(a.get("eff", "")) != "")
	check(aff_ok and aff_keys.size() == Items.AFFIXES.size() and Items.AFFIXES.size() == 14, "접사 14: 키 유일 · lo<hi · 종류 flat/pct/world(world 는 eff)")
	var base_keys := {}
	var per_slot := {}
	var base_ok := true
	for b: Dictionary in Items.BASES:
		base_keys[b.key] = true
		per_slot[b.slot] = int(per_slot.get(b.slot, 0)) + 1
		base_ok = base_ok and float(b.base) > 0.0 and Items.SOCK_MAX.has(b.slot) and ["might", "wisdom", "command"].has(String(b.main))
	check(base_ok and base_keys.size() == Items.BASES.size(), "밑감 %d: 키 유일 · 기본값>0 · 부위가 소켓 표에 있음 · 주 능력치 유효" % Items.BASES.size())
	check(per_slot == {"weapon": 12, "armor": 5, "helm": 3, "glove": 2, "boot": 2, "ring": 2, "neck": 2, "charm": 5}, "부위별 밑감: 무기 12·갑주 5·투구 3·장갑 2·신발 2·반지 2·목걸이 2·부적 5 %s" % str(per_slot))
	check(Items.SOCK_MAX.size() == 8 and Items.SOCK_MAX.weapon == 3 and Items.SOCK_MAX.armor == 3 and Items.SOCK_MAX.helm == 2 and Items.SOCK_MAX.glove == 1 and Items.SOCK_MAX.charm == 2, "소켓 최대: 8부위(무기 3·갑주 3·투구 2·장갑 1·신발 1·반지 1·목걸이 1·부적 2)")

	# ② roll
	var roll_bad := 0
	var set_seen := 0
	var sock_seen := 0
	var tier_seen := {}
	for n in 3000:
		var it: Dictionary = Items.roll(1 + n % 30)
		var b: Dictionary = Items.base_by_key(String(it.base))
		var t := int(it.tier)
		tier_seen[t] = true
		var keys := {}
		var ok: bool = not b.is_empty() and (it.aff as Array).size() == t and float(it.main) >= 1.0
		for a in it.aff:
			keys[a.k] = true
			ok = ok and float(a.v) >= 1.0 and not Items.affix_by_key(String(a.k)).is_empty()
		ok = ok and keys.size() == (it.aff as Array).size() and (it.sock as Array).size() <= int(Items.SOCK_MAX.get(b.slot, 0))
		ok = ok and float(it.dur) == Items.dur_max_of(it) and bool(it.unid) == (t >= 1)
		if String(it.set) != "":
			set_seen += 1
			ok = ok and t == Items.SET_TIER and Items.set_of_base(String(it.base)).key == it.set
		if not (it.sock as Array).is_empty():
			sock_seen += 1
		if not ok:
			roll_bad += 1
	check(roll_bad == 0 and tier_seen.size() == 5, "roll 3000번: 접사 수=등급 · 접사 겹침 없음 · 소켓≤부위 최대 · 내구=dur_max_of · 미확인=등급1+ · 세트는 보물에만(탈락 %d, 본 등급 %d종)" % [roll_bad, tier_seen.size()])
	check(set_seen > 0 and sock_seen > 300, "세트 %d번 · 소켓 달린 것 %d번 나옴(굴림이 죽어 있지 않음)" % [set_seen, sock_seen])
	var slot_ok := true
	for s in Items.SOCK_MAX:
		for n in 40:
			slot_ok = slot_ok and Items.base_by_key(String(Items.roll(5, s).base)).slot == s
	var forced: Dictionary = Items.roll(8, "weapon", 4, true)
	var forced0: Dictionary = Items.roll(8, "charm", 0)
	check(slot_ok and int(forced.tier) == 4 and (forced.aff as Array).size() == 4 and not bool(forced.unid) and int(forced0.tier) == 0 and (forced0.aff as Array).is_empty(), "부위 지정을 지킴 · forced_tier 4 는 접사 4·확인됨 · 0 은 접사 없음")
	var deeper := 0.0
	var shallow := 0.0
	for n in 400:
		deeper += float(Items.roll(30, "weapon", 2).main)
		shallow += float(Items.roll(1, "weapon", 2).main)
	check(deeper > shallow * 1.5, "깊은 층(ilvl 30) 무기가 얕은 층(1)보다 주 수치가 훨씬 큼(%.0f vs %.0f)" % [deeper / 400.0, shallow / 400.0])

	# ③ 등급 추첨
	var cnt := [0, 0, 0, 0, 0]
	var cnt3 := [0, 0, 0, 0, 0]
	var cntg := [0, 0, 0, 0, 0]
	for n in 20000:
		cnt[Items.roll_tier()] += 1
		cnt3[Items.roll_tier(3.0)] += 1
		cntg[Items.roll_tier_gamble()] += 1
	var wsum := 0.0
	for t in Items.TIERS:
		wsum += float(t.weight)
	var near := true
	for i in 5:
		near = near and absf(float(cnt[i]) / 20000.0 - float(Items.TIERS[i].weight) / wsum) < 0.012
	check(near, "roll_tier 20000번: 등급 비율이 가중치와 1.2%%p 안 %s" % str(cnt))
	check(cnt3[4] > cnt[4] * 2 and cnt3[0] < cnt[0], "legendary_mult 3: 전설만 크게 늘고(%d→%d) 상품은 상대적으로 줆" % [cnt[4], cnt3[4]])
	check(cntg[0] < cnt[0] / 3 and cntg[3] > cnt[3] * 3 and cntg[1] > cntg[0], "투전 추첨은 윗등급이 훨씬 두꺼움 %s" % str(cntg))

	# ④ 소켓·룬·부문어
	var sock_ok := Items.roll_sockets("nothing", 4).is_empty() and Items.roll_sockets("ring", 4).size() <= 1
	var big := 0
	var any := 0
	for n in 500:
		var s: Array = Items.roll_sockets("weapon", 4)
		sock_ok = sock_ok and s.size() <= 3
		if not s.is_empty():
			any += 1
		big = maxi(big, s.size())
	check(sock_ok and big == 3 and any > 200 and any < 400, "roll_sockets: 모르는 부위는 [] · 부위 최대를 안 넘음 · 전설 무기 소켓 %d/500(약 60%%)" % any)
	var rune_keys := {}
	var rune_ok: bool = Items.RUNES.size() == 12
	for i in Items.RUNES.size():
		var r: Dictionary = Items.RUNES[i]
		rune_keys[r.key] = true
		rune_ok = rune_ok and int(r.tier) >= 1 and int(r.tier) <= 5 and (i == 0 or int(r.tier) >= int(Items.RUNES[i - 1].tier))
	check(rune_ok and rune_keys.size() == 12 and Items.next_rune_key("cheon") == "ji" and Items.next_rune_key("wang") == "" and Items.next_rune_key("none") == "", "룬 12: 키 유일 · 등급 오름차순 · next_rune_key(천→지, 마지막 王·모르는 키는 \"\")")
	var drop_ok := true
	for f in [0, 3, 8, 20]:
		var maxt := clampi(1 + f / 4, 1, 5)
		for n in 60:
			var k := Items.roll_rune_drop(f)
			drop_ok = drop_ok and int(Items.rune_by_key(k).get("tier", 99)) <= maxt
	check(drop_ok, "룬 드랍은 층이 감당하는 등급까지만(층 0·3·8·20)")
	var word_ok := Items.WORDS.size() == 5
	for w: Dictionary in Items.WORDS:
		for rk in w.runes:
			word_ok = word_ok and not Items.rune_by_key(String(rk)).is_empty()
		word_ok = word_ok and (w.slot == null or Items.SOCK_MAX.has(String(w.slot))) and (w.eff as Array).size() >= 2
	check(word_ok, "부문어 5: 룬 키가 다 있고 효과 2개 이상")
	var cjp := [{"t": "rune", "key": "cheon"}, {"t": "rune", "key": "ji"}, {"t": "rune", "key": "in"}]
	var wrong := [{"t": "rune", "key": "ji"}, {"t": "rune", "key": "cheon"}, {"t": "rune", "key": "in"}]
	var hole := [{"t": "rune", "key": "cheon"}, null, {"t": "rune", "key": "in"}]
	var gem_in := [{"t": "rune", "key": "cheon"}, {"t": "gem", "key": "agate", "g": 0}, {"t": "rune", "key": "in"}]
	check(Items.word_of(cjp, "armor").key == "cheonjiin" and Items.word_of(wrong, "armor").is_empty() and Items.word_of(hole, "armor").is_empty() and Items.word_of(gem_in, "armor").is_empty() and Items.word_of([], "armor").is_empty(), "word_of: 천지인은 순서까지 맞아야 · 순서 틀림·빈 구멍·보석 섞임·빈 소켓은 안 이루어짐")
	var yh := [{"t": "rune", "key": "yong"}, {"t": "rune", "key": "ryong"}]
	check(Items.word_of(yh, "weapon").key == "yongho" and Items.word_of(yh, "armor").is_empty(), "용호는 무기에만 든다")
	var it_word := {"base": "w_changj", "tier": 2, "ilvl": 1, "sock": yh}
	var eff_word: Array = Items.socket_effects(it_word)
	var it_loose := {"base": "w_changj", "tier": 2, "ilvl": 1, "sock": [{"t": "rune", "key": "yong"}, {"t": "rune", "key": "cheon"}]}
	var eff_loose: Array = Items.socket_effects(it_loose)
	check(eff_word.size() == 2 and eff_word[0].v == 16.0 and eff_loose.size() == 2 and eff_loose[0].v == 7.0 and eff_loose[1].v == 6.0 and Items.socket_effects({"base": "w_changj", "sock": []}).is_empty(), "socket_effects: 부문어가 이루어지면 부문어 효과만 · 아니면 룬마다 · 빈 소켓은 없음")
	check(Items.item_name({"base": "w_changj", "unid": true, "sock": yh}) == "장창" and Items.item_name(it_word) == "《용호(勇龍)》 장창" and Items.item_name({"base": "nope"}) == "?", "이름: 미확인은 밑감 이름만 · 부문어가 앞섬 · 모르는 밑감은 ?")

	# ⑤ 세트
	var set_pieces := {}
	var sets_ok: bool = Items.SETS.size() == 10
	for s: Dictionary in Items.SETS:
		sets_ok = sets_ok and (s.pieces as Array).size() == 3 and (s.bonus as Dictionary).has(2) and (s.bonus as Dictionary).has(3)
		for p in s.pieces:
			sets_ok = sets_ok and not Items.base_by_key(String(p)).is_empty() and not set_pieces.has(p)
			set_pieces[p] = s.key
	check(sets_ok and set_pieces.size() == 30, "세트 10벌: 조각 3개씩 · 모두 밑감에 있고 한 벌에만 속함 · 2점·3점 보너스")
	var cm: Dictionary = Items.set_by_key("chungmu")
	check(Items.set_of_base("w_hwando").key == "chungmu" and Items.set_of_base("w_pyeongon").is_empty() and Items.set_by_key("nope").is_empty() and Items.roll_set(Items.base_by_key("w_hwando"), 2) == "" and Items.roll_set(Items.base_by_key("w_pyeongon"), 3) == "", "set_of_base · set_by_key · 보물이 아니거나 한 벌이 아닌 밑감엔 세트가 안 붙음")
	check(Items.bonus_for(cm, 0).is_empty() and Items.bonus_for(cm, 1).is_empty() and Items.bonus_for(cm, 2).size() == 1 and Items.bonus_for(cm, 3).size() == 3 and Items.bonus_for({}, 3).is_empty(), "bonus_for: 1점 0 · 2점 1개 · 3점은 누적 3개")

	# ⑥ 내구·값
	var charm := {"base": "c_hopae", "tier": 4, "ilvl": 5}
	var ring := {"base": Items.roll(1, "ring").base, "tier": 3, "ilvl": 1}
	var weapon0 := {"base": "w_changj", "tier": 0, "ilvl": 1}
	var weapon4 := {"base": "w_changj", "tier": 4, "ilvl": 1}
	check(Items.dur_max_of(charm) == 0.0 and Items.dur_max_of(ring) == 0.0 and Items.dur_max_of(weapon0) == 24.0 and Items.dur_max_of(weapon4) == 64.0 and Items.dur_max_of({}) == 0.0, "내구 최대: 부적·반지·목걸이 0 · 무기 상품 24 … 전설 64")
	var worn := {"base": "w_changj", "tier": 2, "ilvl": 10, "dur": 0.0}
	var half := {"base": "w_changj", "tier": 2, "ilvl": 10, "dur": 22.0}
	var full := {"base": "w_changj", "tier": 2, "ilvl": 10, "dur": 44.0}
	check(Items.is_broken(worn) and not Items.is_broken(half) and not Items.is_broken(full) and not Items.is_broken({"base": "c_hopae", "tier": 4, "dur": 0.0}), "is_broken: 내구 0 이면 부서짐 · 부적은 절대 안 부서짐")
	var p := Items.price(worn)
	check(Items.repair_cost(full) == 0 and Items.repair_cost(half) > 0 and Items.repair_cost(half) < Items.repair_cost(worn) and Items.repair_cost(worn) == int(roundf(float(p) * 0.4)) and Items.repair_cost(charm) == 0, "수리값: 가득이면 0 · 닳을수록 늘어 다 닳으면 값의 40%%(%d) · 부적은 0" % Items.repair_cost(worn))
	check(Items.price(weapon4) > Items.price(weapon0) and Items.price({"base": "w_changj", "tier": 2, "ilvl": 20}) > Items.price({"base": "w_changj", "tier": 2, "ilvl": 2}) and Items.price({}) == 0, "값: 등급·수준이 오를수록 늘고 빈 것은 0")
	check(Items.gamble_price("charm", 1) < Items.gamble_price("weapon", 1) and Items.gamble_price("weapon", 10) > Items.gamble_price("weapon", 1) and Items.scroll_price(10) > Items.scroll_price(1) and Items.scroll_price(1) == 34, "투전값(부적이 쌈·수준에 늘어남) · 주문서 값(30+4×수준)")

	# ⑦ 원소·보석
	var el_ok: bool = Items.ELEMENTS.size() == 7 and Items.ELEMENTS[0].key == "phys"
	for e: Dictionary in Items.ELEMENTS:
		el_ok = el_ok and String(e.name) != "" and String(e.hanja) != ""
	check(el_ok and Items.elem_name("fire") == "화(火)" and Items.elem_name("zzz") == "zzz" and Items.RESIST_CAP == 75.0, "원소 7(물리+6결) · elem_name(화(火), 모르면 키 그대로) · 저항 상한 75")
	var gem_ok: bool = Items.GEMS.size() == 6
	var els := {}
	for g: Dictionary in Items.GEMS:
		els[g.el] = true
		gem_ok = gem_ok and g.weapon.kind == "eldmg" and g.weapon.el == g.el and g.armor.kind == "elres" and g.armor.el == g.el and not Items.elem_by_key(String(g.el)).is_empty() and String(g.el) != "phys"
	check(gem_ok and els.size() == 6, "보석 6: 무기=eldmg·갑주=elres(각자 자기 결) · 6결을 하나씩 · 물리는 보석으로 못 얻음")
	var grade_ok := true
	for i in range(1, Items.GRADES.size()):
		grade_ok = grade_ok and float(Items.GRADES[i].mul) > float(Items.GRADES[i - 1].mul)
	check(grade_ok and Items.grade(-3).g == 0 and Items.grade(99).g == 4, "보석 등급 5: 배수가 오름 · 범위 밖은 끝으로 끼움")
	var gw: Array = Items.socket_effects({"base": "w_changj", "sock": [{"t": "gem", "key": "agate", "g": 0}]})
	var ga: Array = Items.socket_effects({"base": "a_dujeong", "sock": [{"t": "gem", "key": "agate", "g": 0}]})
	var gh: Array = Items.socket_effects({"base": Items.roll(1, "helm").base, "sock": [{"t": "gem", "key": "agate", "g": 4}]})
	var gc: Array = Items.socket_effects({"base": "c_hopae", "sock": [{"t": "gem", "key": "agate", "g": 0}]})
	check(gw.size() == 1 and gw[0].kind == "eldmg" and gw[0].v == 6.0 and ga[0].kind == "elres" and ga[0].v == 8.0 and gh[0].kind == "elres" and gh[0].v == 56.0 and gc[0].kind == "pct" and gc[0].stat == "might", "보석은 박힌 부위로 갈림: 무기 화 피해 6 · 갑주 화 저항 8 · 투구 완(完)등급 8×7=56 · 부적 무력%")
	var jw: Array = Items.socket_effects({"base": "w_changj", "sock": [{"t": "jewel", "j": Items.roll_jewel(10)}]})
	var jc: Array = Items.socket_effects({"base": "c_hopae", "sock": [{"t": "jewel", "j": Items.roll_jewel(10)}]})
	check(not jw.is_empty() and not jc.is_empty(), "주옥은 부위를 안 가리고 효과를 냄(무기·부적)")

	print("PROBE dungeon_gear ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
