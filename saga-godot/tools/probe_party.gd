extends SceneTree

## GO 편성(106장 ㉛·㉝·㊱: PartyState 의 party()·넣기·빼기·순서·편성 칸 네 벌·탐사 중 동료·세이브 복원) 자동 점검 — 화면 없는 순수 규칙.
##   godot --headless --path saga-godot --script res://tools/probe_party.gd
## ① 수치(PARTY_MAX 3·칸 4) ② party(): 앞 party_size 명·겹침 뺌 ③ 넣기: 빈자리엔 끝에·꽉 차면 마지막과 바꿈·이미 있거나 모르는 이름·"self" 는 거절
## ④ 빼기·한 자리 앞으로 ⑤ 편성 칸 바꾸기: 지금 명단은 칸에 남고·같은 칸·범위 밖은 거절·돌아오면 되살아남 ⑥ 탐사 나간 동료는 못 넣고 칸 복원에서도 빠짐
## ⑦ restore_presets: 엉뚱한 값도 안전·칸 번호 끼워 맞춤·칸마다 PARTY_MAX 까지만. 끝에 "PROBE party OK" 또는 "PROBE party FAIL n". 상태는 끝에 되돌린다.

const Characters := preload("res://saga_core/data/characters.gd")

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	await process_frame  # PartyState autoload 가 올라온 뒤(이름을 직접 쓰면 --script 컴파일이 깨진다 — 노드로 받는다)
	var P: Node = root.get_node("PartyState")
	var saved := {"members": P.members.duplicate(), "size": P.party_size, "presets": P.presets.duplicate(true), "i": P.preset_i, "dispatch": P.dispatch.duplicate(true)}
	var ids: Array[String] = []
	for h in Characters.HEROES.slice(0, 7):
		ids.append(String(h.id))
	var a: String = ids[0]
	var b: String = ids[1]
	var c: String = ids[2]
	var d: String = ids[3]
	var e: String = ids[4]
	var away: String = ids[5]
	P.dispatch = {}

	# ① 수치
	check(P.PARTY_MAX == 3 and P.PRESET_COUNT == 4, "PARTY_MAX 3 · 편성 칸 4")

	# ② party()
	P.members.assign([a, a, b, c, d])
	P.party_size = 3
	var p1: Array = P.party()
	P.party_size = 2
	var p2: Array = P.party()
	check(p1 == [a, b, c] and p2 == [a, b] and P.in_party("self") and P.in_party(a) and not P.in_party(d), "party(): 앞 party_size 명·겹침 뺌 · in_party")

	# ③ 넣기
	P.members.assign([a, b, c, d, e])
	P.preset_i = 0
	P.party_size = 2  # [a, b]
	var ok_free: bool = P.put_in_party(c)
	var after_free: Array = P.party()
	var ok_full: bool = P.put_in_party(d)  # 꽉 참 → 마지막(c)과 바꿈
	var after_full: Array = P.party()
	check(ok_free and after_free == [a, b, c] and ok_full and after_full == [a, b, d] and P.members.has(c), "넣기: 빈자리엔 끝에 · 꽉 차면 마지막과 바꿈(밀려난 동료는 members 에 남음) %s" % str(after_full))
	check(not P.put_in_party(d) and not P.put_in_party("nobody") and not P.put_in_party("self"), "이미 명단에 있음·모르는 이름·self 는 거절")

	# ④ 빼기·순서
	var rm: bool = P.remove_from_party(b)
	var after_rm: Array = P.party()
	var rm_bad: bool = P.remove_from_party(b)  # 이미 없음
	var up: bool = P.move_up_in_party(d)
	var after_up: Array = P.party()
	var up_first: bool = P.move_up_in_party(after_up[0])
	check(rm and after_rm == [a, d] and not rm_bad and P.members.has(b), "빼기: 명단에서만 빠짐(members 에 남음) · 없는 사람은 거절 %s" % str(after_rm))
	check(up and after_up == [d, a] and not up_first, "한 자리 앞으로 · 첫 자리는 못 올림 %s" % str(after_up))

	# ⑤ 편성 칸
	var to1: bool = P.use_preset(1)
	var in1: Array = P.party()
	var same: bool = P.use_preset(1)
	var bad_hi: bool = P.use_preset(9)
	var bad_lo: bool = P.use_preset(-1)
	var back0: bool = P.use_preset(0)
	check(to1 and P.preset_i == 0 and back0 and P.party() == [d, a] and not same and not bad_hi and not bad_lo and in1.is_empty(), "칸 바꾸기: 1번 칸(빈 칸) → 같은 칸·범위 밖 거절 → 0번으로 돌아오면 [d, a] 되살아남")
	P.put_in_party(e)
	check(P.preset_party(0) == P.party() and P.preset_party(1).is_empty(), "preset_party: 지금 칸이면 지금 명단")

	# ⑥ 탐사 나간 동료
	P.members.assign([a, b, c, d, e, away])
	P.dispatch = {"out": {"s1": {"id": away}}}
	check(P.is_away(away) and not P.is_away(a) and not P.put_in_party(away), "탐사 나간 동료는 is_away · 명단에 못 넣음")
	P.presets[1] = [away, a]
	P.preset_i = 0
	P.use_preset(1)
	check(not P.party().has(away) and P.party().has(a), "칸을 복원할 때도 탐사 나간 동료는 빠진다 %s" % str(P.party()))

	# ⑦ restore_presets
	P.dispatch = {}
	P.members.assign([a, b, c, d, e])
	P.party_size = 3
	P.restore_presets("엉뚱한 값", 9)
	var junk_ok: bool = P.preset_i == 0 and P.presets[0] == P.party()
	P.restore_presets([[a, b, c, d, e]], 9)
	check(junk_ok and P.preset_i == 3 and (P.presets[0] as Array).size() == 3 and P.presets[3] == P.party(), "restore_presets: 엉뚱한 값도 안전 · 칸 번호 끼워 맞춤(9→3) · 칸마다 3명까지만")

	P.members.assign(saved.members)
	P.party_size = saved.size
	P.presets = saved.presets
	P.preset_i = saved.i
	P.dispatch = saved.dispatch
	print("PROBE party ", "OK" if fails == 0 else "FAIL %d" % fails)
	quit(1 if fails > 0 else 0)
