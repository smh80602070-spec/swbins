extends Node

## "제외" 목록 3번(장비 등급+접사) — 무기 한 자루짜리 최소 장착 상태였던
## 것에, "제외" 목록 2번(소켓+부문어·투장·내구)에서 **부적(charm) 한
## 점**을 더했다(dungeon_items.gd 헤더 참고 — 투장이 2점을 채우려면
## 부위가 최소 둘 있어야 한다). **2026-09-14, PLAN.md 51장 "장비→빌드"
## — 갑주(armor) 한 점을 더해 세 부위가 됐다**(투장 3점 완성이 이걸로
## 처음 가능해진다, dungeon_items.gd SETS 주석 참고). 여전히 가방·창고는
## 없다 — 새로 주우면 그 부위의 이전 것을 그냥 대체한다(대체된 물건에
## 박혀 있던 룬은 그대로 사라진다 — 원작도 "한 번 박은 룬은 못 뺀다"였으니
## 이 손실은 새 버그가 아니라 같은 규칙의 자연스러운 결과다).
##
## 세 부위 각각에 흩어져 있던 `slot_name == "weapon" ? weapon : charm`류
## 2진 삼항식이 갑주가 생기며 전부 깨질 뻔해(부위가 셋이면 이미 어색하고
## 넷째가 오면 못 버틴다), `_item_for()`/`_set_item()`/`_emit_changed()`
## 세 헬퍼로 슬롯 이름 하나로 찾아 바꾸는 방식으로 이 파일 전체를
## 갈아엎었다 — 바깥에서 `DungeonEquipmentState.weapon`처럼 직접 읽는
## 자리(job_label.gd 등)는 프로퍼티 이름이 그대로라 안 건드려도 된다.
##
## **2026-09-14, PLAN.md 51장 "장비→빌드" — 남은 다섯 부위(helm·glove·
## boot·ring·neck) 추가.** SLOT_NAMES가 data-item.js SLOTS 순서 그대로
## 여덟으로 늘었다 — `_item_for`/`_set_item`/`_emit_changed` 세 헬퍼에
## 다섯 갈래만 더하면 됐고, `_active_items()`·`repair_all_cost()`처럼
## 셋을 하드코딩해 두던 자리는 이 김에 SLOT_NAMES를 도는 방식으로
## 일반화했다(넷째 부위 때 이미 세웠어야 할 관례를 이번에 마저 세운다).
##
## project.godot [autoload]에 DungeonEquipmentState로 등록.

const Meridian := preload("res://games/saga_dungeon/data/dungeon_meridian.gd")   # G-0217 경락도
const SLOT_NAMES: Array[String] = [
	"weapon", "armor", "helm", "glove", "boot", "ring", "neck", "charm",
]

signal weapon_changed
signal armor_changed
signal helm_changed
signal glove_changed
signal boot_changed
signal ring_changed
signal neck_changed
signal charm_changed

## {} 면 "맨손"/"갑주 없음"/...(시작 상태). 처음 주운 물건부터 실제로 바뀐다.
var weapon: Dictionary = {}
var armor: Dictionary = {}
var helm: Dictionary = {}
var glove: Dictionary = {}
var boot: Dictionary = {}
var ring: Dictionary = {}
var neck: Dictionary = {}
var charm: Dictionary = {}


## 슬롯 이름 → 그 var(참조) — Dictionary는 GDScript에서 참조형이라, 돌려준
## 것을 그 자리에서 고치면(`it["dur"] = ...`) weapon/armor/... 원본이
## 그대로 바뀐다(기존 코드가 이미 기대던 성질, 새로 만든 규칙이 아니다).
func _item_for(slot_name: String) -> Dictionary:
	match slot_name:
		"weapon": return weapon
		"armor": return armor
		"helm": return helm
		"glove": return glove
		"boot": return boot
		"ring": return ring
		"neck": return neck
		"charm": return charm
	return {}


func _set_item(slot_name: String, it: Dictionary) -> void:
	match slot_name:
		"weapon": weapon = it
		"armor": armor = it
		"helm": helm = it
		"glove": glove = it
		"boot": boot = it
		"ring": ring = it
		"neck": neck = it
		"charm": charm = it


func _emit_changed(slot_name: String) -> void:
	match slot_name:
		"weapon": weapon_changed.emit()
		"armor": armor_changed.emit()
		"helm": helm_changed.emit()
		"glove": glove_changed.emit()
		"boot": boot_changed.emit()
		"ring": ring_changed.emit()
		"neck": neck_changed.emit()
		"charm": charm_changed.emit()


## 부위 이름을 몰라도(loot_pickup.gd처럼 주운 밑감의 slot만 아는 자리)
## 바로 장착할 수 있는 공용 진입점.
func equip(slot_name: String, it: Dictionary) -> void:
	preload("res://games/saga_dungeon/data/dungeon_mastery.gd").inherit(slot_name, _item_for(slot_name), it)   # G-0317 숙련 절반 물려받기(무기 말고)
	_set_item(slot_name, it)
	_emit_changed(slot_name)


## _item_for()의 공개판 — test_room.gd·vendor_button.gd처럼 바깥에서
## slot_name 하나로 "그 부위에 지금 뭐가 걸려 있는지" 물을 때 쓴다.
func item_for(slot_name: String) -> Dictionary:
	return _item_for(slot_name)


## `slot_name -> item` Dictionary 하나로 8부위를 한 번에 되돌린다(각
## 부위를 위치 인자로 받던 옛 방식은 다섯이 더 늘며 못 버틴다 — dungeon_
## save_state.gd가 저장된 슬롯만 채워 넘긴다, 없는 슬롯은 {}로 남는다).
func restore(saved: Dictionary) -> void:
	for slot_name in SLOT_NAMES:
		_set_item(slot_name, saved.get(slot_name, {}))
	for slot_name in SLOT_NAMES:
		_emit_changed(slot_name)


## ── G-0236 무기 을(乙) — 웹 wpn-swap.js(W-0281) 이식 ──
## 을은 SLOT_NAMES 밖이다(넣으면 _active_items 가 능력치·투장을 두 번 셈). 갑↔을을 바꾸면
## weapon_changed 하나로 직업·무예 넉 자리·경락도·job_label 이 저절로 따라온다.
## 가방이 없는 판이라 웹 "을에 들기" 대신 — 새 무기를 밟으면 손 무기가 을로, 을에 있던 건 버림(pick_weapon).
const SWAP_SEC := 0.4      # 바꿔 드는 자세(weapon_swap_input.gd 가 몸을 기울인다)
const SWAP_CD := 1.0
const FIRST_MUL := 1.15    # 바꾼 직후 첫 타 한 번
const FIRST_HIT_TUNE := {"stop_ms": 110, "shake_mul": 1.8, "pop_mul": 1.35}   # 첫 타 CombatFeel.hit 세게

signal weapon_swapped

var weapon2: Dictionary = {}
var _swap_cd := 0.0
var _first_mul := 0.0


func _process(delta: float) -> void:
	if _swap_cd > 0.0:
		_swap_cd = maxf(0.0, _swap_cd - delta)


func cd_left() -> float:
	return _swap_cd


## 무기 아닌 것은 을에 못 든다.
static func is_weapon(it: Dictionary) -> bool:
	return not it.is_empty() and str(DungeonItems.base_by_key(str(it.get("base", ""))).get("slot", "")) == "weapon"


func set_weapon2(it: Dictionary) -> bool:
	if not it.is_empty() and not is_weapon(it):
		return false
	weapon2 = it
	weapon_swapped.emit()
	return true


## 줍기(loot_pickup.gd) — 손에 든 무기를 을로 내리고(을에 있던 건 버림) 새 무기를 든다.
func pick_weapon(it: Dictionary) -> void:
	if not weapon.is_empty():
		weapon2 = weapon
	equip("weapon", it)
	weapon_swapped.emit()


## {ok, reason("single"|"cd"), left}. 갑이 비어 있었으면 을이 손으로 가고 을 칸은 빈다(웹 그대로).
func swap_weapons() -> Dictionary:
	if weapon2.is_empty():
		return {"ok": false, "reason": "single"}
	if _swap_cd > 0.0:
		return {"ok": false, "reason": "cd", "left": _swap_cd}
	var cur := weapon
	weapon = weapon2
	weapon2 = cur
	_swap_cd = SWAP_CD
	_first_mul = FIRST_MUL
	_emit_changed("weapon")
	weapon_swapped.emit()
	return {"ok": true}


## 바꾼 직후 첫 타 배율 — 타격 한 곳(melee·skill _strike)이 한 번 쓰고 끈다. 없으면 1.0.
func take_first_hit() -> float:
	if _first_mul <= 0.0:
		return 1.0
	var m := _first_mul
	_first_mul = 0.0
	return m


func restore_weapon2(v: Variant) -> void:
	weapon2 = v if typeof(v) == TYPE_DICTIONARY and is_weapon(v) else {}
	_swap_cd = 0.0
	_first_mul = 0.0
	weapon_swapped.emit()


## 부서진 장비는 아무 값도 안 낸다(item.js "부서지면 능력치를 안 준다") —
## main·접사·소켓 효과·투장 집계 전부 이 문턱 하나를 공유한다.
func _active_items() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for slot_name in SLOT_NAMES:
		var it := _item_for(slot_name)
		if not it.is_empty() and not DungeonItems.is_broken(it):
			out.append(it)
	return out


## 장착 중인(안 부서진) 것들의 접사 + 소켓(부문어 포함) 효과를 한 목록으로
## 모은다 — atk_flat_bonus()·atk_pct_bonus()·world_eff_sum()이 전부 이
## 하나만 훑는다(dungeon_run_state.gd::_sum_eff()와 같은 "단일 집계 지점"
## 패턴).
func _affix_and_socket_effects() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for it: Dictionary in _active_items():
		for a_ref: Dictionary in it.get("aff", []):
			var a := DungeonItems.affix_by_key(a_ref.k)
			if a.is_empty():
				continue
			out.append({"kind": a.kind, "stat": a.get("stat", ""), "eff": a.get("eff", ""), "v": float(a_ref.v)})
		for e: Dictionary in DungeonItems.socket_effects(it):
			out.append(e)
		for e: Dictionary in DungeonItems.unique_effects(it):   # G-0398 고유 효과(접사 자리)
			out.append(e)
	return out


## G-0398 — 세 점을 다 걸친 세트 key(세트 무예 T 자리). 없으면 "". 둘이면 SETS 순서 앞의 것.
func full_set_key() -> String:
	var counts: Dictionary = {}
	for it: Dictionary in _active_items():
		var set_key := str(it.get("set", ""))
		if set_key != "":
			counts[set_key] = int(counts.get(set_key, 0)) + 1
	for s: Dictionary in DungeonItems.SETS:
		if int(counts.get(str(s.key), 0)) >= (s.pieces as Array).size():
			return str(s.key)
	return ""


## 걸친(안 부서진) 무기·갑주·부적이 같은 투장(세트)에 속하면 그 점수만큼의
## 세트 효과를 더한다 — data-set.js bonusFor()는 누적이라 2점 값 위에
## 3점 값도 더 있으면 같이 붙는다. 갑주가 생겨(2026-09-14) 세 부위가
## 같은 세트면 이제 3점 문턱도 넘는다(dungeon_items.gd SETS 주석 참고).
func _set_effects() -> Array[Dictionary]:
	var counts: Dictionary = {}
	for it: Dictionary in _active_items():
		var set_key := str(it.get("set", ""))
		if set_key == "":
			continue
		counts[set_key] = int(counts.get(set_key, 0)) + 1
	var out: Array[Dictionary] = []
	for key in counts:
		var s := DungeonItems.set_by_key(str(key))
		for e: Dictionary in DungeonItems.bonus_for(s, int(counts[key])):
			out.append(e)
	return out


## main + might/all 계열 flat 접사 — 이 슬라이스의 유일한 목표 스탯(무력)에
## 실제로 닿는 값만 더한다. 지력·통솔 계열은 목표가 없어 0을 더한다
## (수치는 이름에 실리지만 효과는 안 낸다 — DungeonItems 주석 참고).
func atk_flat_bonus() -> float:
	var total := 0.0
	for it: Dictionary in _active_items():
		var b := DungeonItems.base_by_key(str(it.get("base", "")))
		if not b.is_empty() and b.main == "might":
			total += float(it.main)
	for e: Dictionary in _affix_and_socket_effects():
		if e.kind == "flat" and (e.stat == "might" or e.stat == "all"):
			total += float(e.v)
	for e: Dictionary in _set_effects():
		if e.kind == "flat" and (e.stat == "might" or e.stat == "all"):
			total += float(e.v)
	return total


## mightPct/allPct 접사 — atk_flat_bonus와 같은 경계(might/all만 우리
## 무력 채널에 닿는다). melee_attack.gd가 DungeonRunState.atk_mult()와
## 곱하는 게 아니라 **더하는** 별도 배율이다.
func atk_pct_bonus() -> float:
	var total := 0.0
	for e: Dictionary in _affix_and_socket_effects():
		if e.kind == "pct" and (e.stat == "might" or e.stat == "all"):
			total += float(e.v)
	for e: Dictionary in _set_effects():
		if e.kind == "pct" and (e.stat == "might" or e.stat == "all"):
			total += float(e.v)
	total += preload("res://games/saga_dungeon/data/dungeon_mastery.gd").atk_pct(weapon)   # G-0317 무기 숙련 단계마다 +3
	return total


## world kind 접사 합 — 은사(DungeonRunState)와 완전히 같은 eff 키 이름
## (atkPct·hpPct·critPct 등)을 쓰므로, DungeonRunState._sum_eff()가 이
## 함수를 더해 은사+장비를 한 공식으로 합산한다.
func world_eff_sum(eff_key: String) -> float:
	var total := 0.0
	for e: Dictionary in _affix_and_socket_effects():
		if e.kind == "world" and e.eff == eff_key:
			total += float(e.v)
	for e: Dictionary in _set_effects():
		if e.kind == "world" and e.eff == eff_key:
			total += float(e.v)
	return total


## "제외" 목록 2번(내구) — item.js::wearAll(), "층을 내려갈 때마다 1
## 닳는다"를 test_room.gd의 방 출구(descend에 해당)에서 부른다. 방금
## 부서진 부위 이름(SLOT_NAMES 중 하나)만 돌려준다(토스트용) —
## 장신구(charm·ring·neck)는 dur_max_of()가 0을 주므로 애초에 안 닳는다.
func wear_all(n: float = 1.0) -> Array[String]:
	var broke: Array[String] = []
	for slot_name in SLOT_NAMES:
		var it := _item_for(slot_name)
		if it.is_empty():
			continue
		var max_d := DungeonItems.dur_max_of(it)
		if max_d <= 0.0:
			continue
		var was: float = float(it.get("dur", max_d))
		it["dur"] = clampf(was - n, 0.0, max_d)
		if was > 0.0 and it.dur <= 0.0:
			broke.append(slot_name)
	for slot_name in broke:
		_emit_changed(slot_name)
	return broke


## "제외" 목록 2번(소켓) — 무기부터 살펴 빈 구멍이 있는 첫 부위를 준다
## (없으면 ""). 소켓 UI가 "지금 뭘 박을 수 있는지"를 물을 때 쓴다.
func first_socketable_slot() -> String:
	for slot_name in SLOT_NAMES:
		var it := _item_for(slot_name)
		if it.is_empty():
			continue
		var sock: Array = it.get("sock", [])
		if sock.has(null):
			return slot_name
	return ""


## 그 부위의 첫 빈 구멍에 부문(룬) 하나를 박는다. 재료는 호출 쪽이 이미
## DungeonMaterialsState에서 있는지 확인하고 불렀다고 본다(socket_button.gd).
## @returns 부문어가 새로 이루어졌으면 그 정의(word), 아니면 {}.
func socket_rune(slot_name: String, rune_key: String) -> Dictionary:
	var it := _item_for(slot_name)
	if it.is_empty():
		return {}
	var sock: Array = it.get("sock", [])
	var idx := sock.find(null)
	if idx < 0:
		return {}
	sock[idx] = {"t": "rune", "key": rune_key}
	_emit_changed(slot_name)
	var b := DungeonItems.base_by_key(str(it.get("base", "")))
	return DungeonItems.word_of(sock, str(b.get("slot", "")))


## "제외" 목록 4번(원소 6결+저항) — socket_rune()과 같은 경계(부문어 여부를
## 돌려준다, 여기선 보석·주옥이 섞이면 부문어가 절대 안 되니 늘 {}다).
func socket_gem(slot_name: String, gem_key: String, grade_num: int) -> Dictionary:
	var it := _item_for(slot_name)
	if it.is_empty():
		return {}
	var sock: Array = it.get("sock", [])
	var idx := sock.find(null)
	if idx < 0:
		return {}
	sock[idx] = {"t": "gem", "key": gem_key, "g": grade_num}
	_emit_changed(slot_name)
	return {}


## 주옥은 **부위를 안 가린다** — 어느 소켓에 박아도 굴려 나온 접사 그대로 낸다.
func socket_jewel(slot_name: String, jewel: Dictionary) -> Dictionary:
	var it := _item_for(slot_name)
	if it.is_empty():
		return {}
	var sock: Array = it.get("sock", [])
	var idx := sock.find(null)
	if idx < 0:
		return {}
	sock[idx] = {"t": "jewel", "j": jewel}
	_emit_changed(slot_name)
	return {}


## item.js elemDamage() 그대로 — 걸친(안 부서진) 것들의 소켓 효과 중 eldmg만
## 결별로 더한다. melee_attack.gd가 물리 타격 뒤 이 결과를 결마다 따로 적용한다.
func elem_damage() -> Dictionary:
	var out: Dictionary = {}
	for e: Dictionary in _affix_and_socket_effects():
		if e.kind == "eldmg":
			var el := str(e.el)
			out[el] = float(out.get(el, 0.0)) + float(e.v)
	return out


## item.js elemResist() 그대로 — 결별 저항(%), 상한은 DungeonItems.RESIST_CAP.
## 2026-09-14부터 갑주 소켓에 박은 보석(GEMS)도 이 값을 낸다 — 그 전엔
## 주옥만(부위를 안 가리므로) 채울 수 있었다.
func elem_resist(el: String) -> float:
	var total := 0.0
	for e: Dictionary in _affix_and_socket_effects():
		if e.kind == "elres" and str(e.el) == el:
			total += float(e.v)
	total += Meridian.add("allResPct")   # G-0217 경락도 모든 저항
	return clampf(total, 0.0, DungeonItems.RESIST_CAP)


## "제외" 목록 3번(감정) — 미확인 표시를 끈다. 재료(감정서)는 호출 쪽
## (vendor_button.gd)이 이미 DungeonMaterialsState에서 있는지 확인하고
## 불렀다고 본다(socket_rune()과 같은 경계). 이미 확인된 물건이면 false.
func identify(slot_name: String) -> bool:
	var it := _item_for(slot_name)
	if it.is_empty() or not bool(it.get("unid", false)):
		return false
	it["unid"] = false
	_emit_changed(slot_name)
	return true


## "제외" 목록 3번(수리) — item.js::repairCost()의 합. 0이면 수리할 게 없다.
func repair_all_cost() -> int:
	var total := 0
	for slot_name in SLOT_NAMES:
		var it := _item_for(slot_name)
		if not it.is_empty():
			total += DungeonItems.repair_cost(it)
	return total


## 걸친 모든 부위를 최대 내구까지 고친다 — 비용은 호출 쪽이 이미
## repair_all_cost()로 확인하고 금을 뗐다고 본다.
func repair_all() -> void:
	for slot_name in SLOT_NAMES:
		var it := _item_for(slot_name)
		if it.is_empty():
			continue
		var max_d := DungeonItems.dur_max_of(it)
		if max_d > 0.0:
			it["dur"] = max_d
	for slot_name in SLOT_NAMES:
		_emit_changed(slot_name)
