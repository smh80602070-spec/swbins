extends Node

## PLAN 101-2 DUNGEON ④(부적 던전, 2026-09-17) — saga-web/saga-dungeon/
## PLAN.md §5.3 "부적(符籍) 던전 — 나이트메어 티어와 변형자"를 옮긴다.
##
## 웹 원안은 "굴혈 앞에서 부적 던전을 고르면 방 5개짜리 새 층(보스 없음,
## 마지막 방 정예 무리)이 열린다"인데, 이 슬라이스는 층이 procedural이
## 아니라 한 씬 안에 이미 고정된 방 7개(`test_room.gd::ROOM_COUNT`)뿐이고
## "내려가기/새 층 생성" 자체가 없다 — 그래서 새 층을 만드는 대신 **지금
## 있는 7개 방 전체를 "부적을 켠 채로" 다시 돈다**로 재해석했다(별도
## 인스턴스·씬 전환 없음, "새로 설계하지 않는다" 원칙 유지 — dungeon_boons.gd
## 헤더가 축복 3택에서 내린 것과 같은 판단). 변형자 9종 중 방 단위 타이머
## (75초 제한, "그 방을 클리어했다"는 판정 자체가 없다 — 방은 늘 출구까지
## 걸어가면 끝난다, 적 전멸 게이트가 없다)·항아리 스폰(순수 장식)·어둠
## (시야 감소, 조명 조작이 필요해 진단하기 어렵다) 셋은 이번 범위에서
## 뺐다 — 나머지 6종만 옮긴다(MOD_POOL 참고).
##
## 부적 인벤 상한 20 그대로(웹 5.3). 티어 T의 부적을 켠 채로 마지막
## 방(`test_room.gd` is_final)에 닿으면 `clear_run()`이 60% 확률로 T+1
## 부적을 새로 주고 부적을 끈다 — 결사처럼 "한 번 켜면 그 회차 끝까지"
## 유지(중간에 못 끈다, `sigil_button.gd` 참고).
##
## project.godot [autoload]에 DungeonSigilState로 등록.

signal sigil_changed

const MAX_SIGILS := 20  # 웹 5.3 "부적 인벤 상한 20" 그대로
const HP_DMG_MULT_PER_TIER := 0.35  # "적 배율 1+0.35×T" 그대로
const REWARD_MULT_PER_TIER := 0.25  # "보상 배율 1+0.25×T" 그대로 — 이 슬라이스는 금에만 적용(아이템레벨 보정은 범위 밖)
const NEXT_TIER_DROP_CHANCE := 0.60  # "클리어 시 다음 티어 60%" 그대로
const MAX_TIER := 10
const BOSS_SIGIL_DROP_CHANCE := 0.5  # 원작 "층 10+ 보스" 드랍 — 이 슬라이스는 보스가 둘뿐이라 직접 정함

## 6종(원안 9종 중 방 단위 타이머·항아리 스폰·어둠 셋을 뺐다, 파일 헤더
## 참고): swift(적 이동 +30%)·elite_double(정예 확률 2배)·treasure(금
## +50%, "보상 배율"과 별도로 곱해진다)·regen(모든 적 HP 초당 1%)·
## resist_boost(지정 원소 저항 +40%)·glass_cannon(공격력 +50%·받는
## 피해 +50%, dungeon_run_state.gd `_sum_eff()`에 여섯 번째 채널로 붙는다).
const MOD_POOL: Array[String] = ["swift", "elite_double", "treasure", "regen", "resist_boost", "glass_cannon"]
## G-0323 — 창에 쓰는 이름(키를 그대로 보이던 것을 바로잡음)
const MOD_LABEL := {"swift": "날쌘 적", "elite_double": "정예 둘배", "treasure": "보물 +50%", "regen": "적 재생", "resist_boost": "원소 저항", "glass_cannon": "유리 칼(공·피해 +50%)"}

const RESIST_BOOST_ELEMENTS: Array[String] = ["fire", "cold", "lit", "pois", "chi", "emp"]

## G-0308 지도 장치(웹 W-0298 atlas.js 짝) — 켜기 전 부적에 금을 내고 변형자를
## 하나씩 더 새긴다(부적 dict `extra`, 없으면 빈 것 = 옛 세이브 그대로). 새긴 수만큼
## 보상 금 ×(1+0.2×n). 수치는 웹 그대로. SAGA_ATLAS=0 이면 새김도, 새긴 것도 끔.
const ATLAS_MAX_EXTRA := 3
const ATLAS_COST := 150
const ATLAS_LOOT_PER := 0.2

var sigils: Array[Dictionary] = []  # {id:int, tier:int, mods:Array[String], resist_el:String}
var active_index: int = -1
var best_tier_cleared: int = 0
var _next_id: int = 1


func is_active() -> bool:
	return active_index >= 0 and active_index < sigils.size()


## dungeon_save_state.gd가 저장할 때 부른다 — id 발급 카운터도 저장해야
## 재접속 뒤 부적 id(따라서 결정적 변형자 조합)가 안 겹친다.
func next_id_for_save() -> int:
	return _next_id


func active_sigil() -> Dictionary:
	return sigils[active_index] if is_active() else {}


## `core.hash2(부적 id)로 결정적` 그대로 — 같은 id는 항상 같은 변형자
## 조합이 나온다. `Array.shuffle()`은 전역 RNG라 시드를 못 줘, 시드
## 고정 RNG로 손수 Fisher-Yates를 돌린다.
static func roll_mods(id: int) -> Array[String]:
	var rng := RandomNumberGenerator.new()
	rng.seed = id
	var pool: Array[String] = MOD_POOL.duplicate()
	for i in range(pool.size() - 1, 0, -1):
		var j := rng.randi_range(0, i)
		var tmp: String = pool[i]
		pool[i] = pool[j]
		pool[j] = tmp
	var count := 2 if rng.randf() < 0.5 else 3
	var out: Array[String] = []
	for i in range(count):
		out.append(pool[i])
	return out


## mods와 얽히지 않게 시드에 오프셋을 둔다(같은 id로 두 번 굴려도 항상
## 같은 결과 — mods 셔플이 RNG 상태를 몇 번 진행시켰는지와 무관해진다).
static func roll_resist_el(id: int) -> String:
	var rng := RandomNumberGenerator.new()
	rng.seed = id + 100000
	return RESIST_BOOST_ELEMENTS[rng.randi() % RESIST_BOOST_ELEMENTS.size()]


func add_sigil(tier: int) -> Dictionary:
	var id := _next_id
	_next_id += 1
	var mods := roll_mods(id)
	var sigil := {
		"id": id,
		"tier": clampi(tier, 1, MAX_TIER),
		"mods": mods,
		"resist_el": roll_resist_el(id) if mods.has("resist_boost") else "",
	}
	sigils.append(sigil)
	if sigils.size() > MAX_SIGILS:
		## 상한을 넘기면 가장 오래된 것부터 버린다 — active_index가 0이면
		## 활성 부적이 밀려나므로 같이 옮겨 준다(활성 중엔 실제로 이 상한에
		## 거의 안 걸리지만 방어적으로 맞춰 둔다).
		sigils.pop_front()
		if active_index >= 0:
			active_index -= 1
	sigil_changed.emit()
	return sigil


func activate(index: int) -> bool:
	if is_active() or index < 0 or index >= sigils.size():
		return false
	active_index = index
	sigil_changed.emit()
	return true


func deactivate() -> void:
	active_index = -1
	sigil_changed.emit()


## 이 슬라이스의 "클리어" = 마지막 방 출구에 닿았을 때(`test_room.gd`
## is_final) — 부적이 켜져 있을 때만 부른다.
func clear_run() -> void:
	if not is_active():
		return
	var tier: int = int(active_sigil().get("tier", 1))
	best_tier_cleared = maxi(best_tier_cleared, tier)
	if randf() < NEXT_TIER_DROP_CHANCE:
		add_sigil(tier + 1)
	deactivate()


## G-0247 — 웹 dieNightmare: 부적 켠 채 쓰러지면 그 부적은 소모(목록에서 빠짐)되고 꺼진다.
## 되돌려 주지 않는다 · 최고 기록(best_tier_cleared)은 완주만 올린다. 쓰러진 티어를 돌려준다(꺼져 있었으면 0).
func fail_run() -> int:
	if not is_active():
		return 0
	var tier: int = int(active_sigil().get("tier", 1))
	sigils.remove_at(active_index)
	deactivate()
	return tier


## G-0247 — 웹 goRoom 부적 마지막 방 "정예 무리" 수 4+min(3,⌊T/3⌋)
static func pack_count(tier: int) -> int:
	return 4 + mini(3, tier / 3)


func has_mod(key: String) -> bool:
	if not is_active():
		return false
	return all_mods(active_sigil()).has(key)


func resist_boost_el() -> String:
	if not is_active():
		return ""
	var s := active_sigil()
	var el := str(s.get("resist_el", ""))
	if el == "" and all_mods(s).has("resist_boost"):
		el = roll_resist_el(int(s.get("id", 0)))   # 새긴 resist_boost — 원소도 id 로 결정적
	return el


static func atlas_on() -> bool:
	return OS.get_environment("SAGA_ATLAS") != "0"


static func extra_of(sig: Dictionary) -> Array:
	var ex: Variant = sig.get("extra", [])
	return ex if ex is Array else []


## 굴린 것 + 새긴 것(겹침 없이). 꺼져 있으면 굴린 것만.
static func all_mods(sig: Dictionary) -> Array:
	var out: Array = (sig.get("mods", []) as Array).duplicate()
	if atlas_on():
		for k in extra_of(sig):
			if not out.has(k):
				out.append(k)
	return out


static func mods_text(sig: Dictionary) -> String:
	return ", ".join(all_mods(sig).map(func(m: Variant) -> String: return String(MOD_LABEL.get(String(m), String(m)))))


static func inscribe_cost(sig: Dictionary) -> int:
	return ATLAS_COST * maxi(1, int(sig.get("tier", 1))) * (extra_of(sig).size() + 1)


## 다음에 새길 변형자 — 부적 id·새긴 수로 결정적, 이미 걸린 것은 건너뜀. 남은 게 없으면 "".
static func next_mod(sig: Dictionary) -> String:
	var have := all_mods(sig)
	var rng := RandomNumberGenerator.new()
	rng.seed = int(sig.get("id", 0)) * 7 + extra_of(sig).size() + 200000
	for g in range(40):
		var k: String = MOD_POOL[rng.randi() % MOD_POOL.size()]
		if not have.has(k):
			return k
	for k in MOD_POOL:   # 40번에 못 찾으면 남은 첫 것
		if not have.has(k):
			return k
	return ""


## 새김 — {ok, key, cost} 또는 {ok:false, reason: off|nosig|active|max|none|gold, cost}
func inscribe(index: int) -> Dictionary:
	if not atlas_on():
		return {"ok": false, "reason": "off"}
	if index < 0 or index >= sigils.size():
		return {"ok": false, "reason": "nosig"}
	if index == active_index:
		return {"ok": false, "reason": "active"}
	var sig: Dictionary = sigils[index]
	if extra_of(sig).size() >= ATLAS_MAX_EXTRA:
		return {"ok": false, "reason": "max"}
	var k := next_mod(sig)
	if k == "":
		return {"ok": false, "reason": "none"}
	var c := inscribe_cost(sig)
	if not DungeonGoldState.spend(c):
		return {"ok": false, "reason": "gold", "cost": c}
	var ex := extra_of(sig).duplicate()
	ex.append(k)
	sig["extra"] = ex
	sigil_changed.emit()
	return {"ok": true, "key": k, "cost": c}


static func atlas_gold_mult(sig: Dictionary) -> float:
	return 1.0 + ATLAS_LOOT_PER * extra_of(sig).size() if atlas_on() else 1.0


func enemy_stat_mult() -> float:
	if not is_active():
		return 1.0
	return 1.0 + HP_DMG_MULT_PER_TIER * int(active_sigil().get("tier", 0))


## "treasure" 모드가 뽑혔을 때만 추가로 곱한다 — 티어 기반 보상 배율과는
## 별개(파일 헤더 MOD_POOL 참고).
func gold_mult() -> float:
	if not is_active():
		return 1.0
	var m := 1.0 + REWARD_MULT_PER_TIER * int(active_sigil().get("tier", 0))
	if has_mod("treasure"):
		m *= 1.5
	return m * atlas_gold_mult(active_sigil())   # G-0308 새긴 수만큼


## dungeon_run_state.gd::_sum_eff()가 boons·장비·부대·무예에 이어 여섯
## 번째로 더하는 자리 — "유리대포"가 뽑혔을 때만 atkPct/guardPct에
## 반응한다(다른 키는 0, 새 채널 안 만듦 — dungeon_party_state.gd와
## 같은 계약).
func world_eff_sum(eff_key: String) -> float:
	if not has_mod("glass_cannon"):
		return 0.0
	match eff_key:
		"atkPct":
			return 50.0
		"guardPct":
			return -50.0
		_:
			return 0.0


func restore(saved_sigils: Array, saved_active: int, saved_best: int, saved_next_id: int) -> void:
	sigils.clear()
	for s in saved_sigils:
		if typeof(s) == TYPE_DICTIONARY:
			sigils.append(s)
	active_index = saved_active
	best_tier_cleared = saved_best
	_next_id = maxi(saved_next_id, 1)
	sigil_changed.emit()
