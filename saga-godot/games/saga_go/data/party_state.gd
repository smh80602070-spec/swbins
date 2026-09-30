extends Node

## VERTICAL_SLICE.md 완료 조건(12단계 루프)의 나머지 두 단계 중 "도적이
## 부대에 합류한다" · "부대 전투력이 올랐다는 걸 화면에서 확인한다"를 위한
## 최소 구현. Phase 7(Stats/Item/Inventory/Equipment)을 통째로 만드는 게
## 아니라, 지금 loop을 완성하는 데 필요한 만큼만 — 등용한 인원 수만 세고
## 그 수에 비례해 공격력/방어력을 올린다. project.godot [autoload]에
## 등록된 싱글턴이라 어느 스크립트에서든 이름으로 바로 쓴다(PartyState.atk 등).
##
## BASE_ATK/BASE_DEF는 bandit_encounter.gd가 쓰던 예전 PLACEHOLDER_ATK/
## PLACEHOLDER_DEF와 같은 값이다 — 아직 아무도 등용하지 않았을 때 기존
## 전투 밸런스가 그대로 유지되도록 맞췄다.
##
## 2026-09-11⑬ — GO 사건 다양화로 사건마다 exp 보상(웹판 event.js의
## exp 필드)이 생겼는데, 그걸 받아 줄 자리가 없었다. Phase 7 전체(Stats/
## Item/Inventory/Equipment)를 만드는 대신, §37 재미 평가의 "레벨업이
## 의미가 있는가?"에 답할 만큼만 — 경험치를 모으면 부대 레벨이 오르고
## 그만큼 공격력/방어력이 조금씩 더 붙는다(EXP_PER_LEVEL마다 1레벨).

signal power_changed(atk: float, def: float)
## PLAN.md 101-2 GO ②"승급 3택" — 레벨이 실제로 오를 때만 emit(로드로
## 옛 레벨을 앉히는 restore()는 emit 안 함, 그 경위는 add_exp()·recruit()
## 쪽 주석 참고).
signal level_up(new_level: int)

const Perks := preload("res://games/saga_go/data/perks.gd")
const Growth := preload("res://games/saga_go/data/growth.gd")
const Weapons := preload("res://games/saga_go/data/weapons.gd")
const Artifacts := preload("res://games/saga_go/data/artifacts.gd")

## PLAN 106장 ⑩ — 인물 육성(원신식 레벨·돌파). 들판 전투는 이제 인물마다 이 값을 쓴다
## (char_atk·char_def). 위 atk/def(부대 전투력)는 옛 사건 결투·승급 3택이 그대로 쓴다.
signal growth_changed(member_id: String)
signal bag_changed()
signal weapon_changed()
signal artifact_changed()

const BASE_ATK := 60.0
const BASE_DEF := 35.0
const ATK_PER_MEMBER := 18.0
const DEF_PER_MEMBER := 10.0

const EXP_PER_LEVEL := 100.0
const ATK_PER_LEVEL := 4.0
const DEF_PER_LEVEL := 2.0

## 승급 3택 거절 보상 — 웹판 "단사 10"(재화)에 대응하나 이 판엔 재화가
## 없어 경험치로 갈아탔다.
const REJECT_EXP := 20.0

var members: Array[String] = []
var exp: float = 0.0
var level: int = 0
var atk: float = BASE_ATK
var def: float = BASE_DEF
var perks: Array[String] = []
## id("self" = 주인공) → {"lv": int, "exp": float, "asc": int, "tn"/"ts"/"tb": 특성 레벨(106장 ⑫), "con": 운명의 자리}.
## 없는 칸 = 레벨 1·특성 1·자리 0(⑫ 이전 v3 세이브도 그대로 읽힌다 — 필드를 더했을 뿐이라 SAVE_VERSION 그대로).
var growth: Dictionary = {}
## 아이템 id(growth.gd ITEMS) → 개수.
var bag: Dictionary = {}
## 106장 ⑯ — 가진 무기 id → {"lv", "exp", "asc", "ref"}(수련용은 처음 쓸 때 칸이 생긴다) · 인물 id → 든 무기 id
## (없거나 못 드는 무기면 그 종류 수련용). 필드만 더해 SAVE_VERSION 3 그대로.
var weapons: Dictionary = {}
var equip: Dictionary = {}
## 106장 ⑰ — 성유물 uid("a<번호>") → artifacts.gd generate() 모양(owner = 낀 인물 id 또는 ""). 번호는 artifact_seq 로
## 매기고 그 번호로 씨앗을 정한다(얻는 차례가 같으면 늘 같은 성유물). 필드만 더해 SAVE_VERSION 3 그대로.
var artifacts: Dictionary = {}
var artifact_seq := 0
## 106장 ⑱ 채집·요리 — 채집물 id → 캔 때(실제 시각 초, cooking.gd now()) · 요리 id → 조리한 번수(숙련).
## 필드만 더해 SAVE_VERSION 3 그대로. 음식 버프(계열 → {recipe, q, stat, value, left})는 저장하지 않는다(세션 한정).
var gather_t: Dictionary = {}
var cook_prof: Dictionary = {}
var food_buffs: Dictionary = {}
signal food_changed()
## 106장 ⑲ 일일 의뢰 — {"day": 날짜 번호, "list": [{"id", "p"(진척), "done"}], "bonus": 추가 보상 받음}. 날이 바뀌면
## world/commissions.gd 가 새로 굴린다. 필드만 더해 SAVE_VERSION 3 그대로.
var commissions: Dictionary = {}
## 106장 ⑳ 비경 원기 — 값·마지막으로 센 때(실제 시각 초, 0 = 아직 안 셈 → 가득). domains.gd resin_now() 가 채운다.
var resin := 160
var resin_t := 0.0
## 106장 ㉑ 주간 보스 — {"week": 주 번호(월요일 새벽 4시 갈림), "claims": 이번 주 보상 받은 번수}. 처음 셋은 원기 절반.
var weekly: Dictionary = {}
## 106장 ㉒ 모험·세계 등급 — 세계 등급 한 단계 낮춤 · 보상을 준 마지막 모험 등급(-1 = 아직 안 셈 → 지금 등급으로 앉힘,
## 옛 세이브에 지난 등급 보상이 한꺼번에 쏟아지지 않게). 필드만 더해 SAVE_VERSION 3 그대로.
var wl_lowered := false
var ar_paid := -1
## 106장 ㉕ 이야기 임무 — {"ch": 장 번호, "step": 단계 번호}(ch 가 장 수면 다 끝남). 빈 사전 = 처음(1장 1단계).
## 필드만 더해 SAVE_VERSION 3 그대로. world/story_quest.gd 가 읽고 쓴다.
var story: Dictionary = {}
## 106장 ㊴ 세계 임무 — {"steps": {id: 단계}, "done": [id…], "track": 따라가는 임무 id(빈 글자 = 이야기 임무)}.
## 필드만 더해 SAVE_VERSION 그대로. world/story_quest.gd 가 읽고 쓴다(표는 data/world_quests.gd).
var world_quests: Dictionary = {}
## 106장 ㊷ 낚시 — {"log": {물고기: 잡은 수}, "gone": {"<낚시터>:<번호>": 잡은 시각}}. 필드만 더해 SAVE_VERSION 그대로.
## world/fishing.gd 가 읽고 쓴다(표는 data/fishing.gd).
var fishing: Dictionary = {}
## 106장 ㊸ 업적 — {"stats": {셈: 수}, "tier": {업적: 닿은 단계}, "claimed": {업적: 받은 단계}}. 필드만 더해 SAVE_VERSION 그대로.
## world/achievements.gd 가 읽고 쓴다(표는 data/achievements.gd).
var achievements: Dictionary = {}
## 106장 ㊹ 탐사 파견 — {"out": {탐사지: {"id", "hours", "start"}}, "done": 받은 번수}. 필드만 더해 SAVE_VERSION 그대로.
## world/dispatch.gd 가 읽고 쓴다(표는 data/dispatch.gd). 탐사 중인 동료는 들판 명단·편성에 못 넣는다(is_away).
var dispatch: Dictionary = {}
## 106장 52-5 결말 뒤 밤의 잔불 — {"day": 날 번호(새벽 4시 넘김), "done": [오늘 끈 지역 id…]}. 필드만 더해 SAVE_VERSION 그대로.
## world/night_echoes.gd 가 읽고 쓴다(표는 data/night_echoes.gd).
var night_echo: Dictionary = {}
## 2026-09-30 신수 알·동행 — {"bag": [알 종류…], "inc": [{"tier","walked"}…], "hatched", "walk", "buddy", "buddy_m"}. 필드만 더해 SAVE_VERSION 그대로.
## world/egg_incubator.gd 가 읽고 쓴다(규칙은 data/eggs.gd).
var eggs: Dictionary = {}
## 2026-09-30 쉼터 마당 — {"items": [{"id","x","z","r"}…], "t": 정산 시각, "acc": 은행 냥, "spent": 총 쓴 냥}. 필드만 더해 SAVE_VERSION 그대로.
## world/homestead.gd 가 읽고 쓴다(규칙은 data/homestead.gd).
var home: Dictionary = {}
## 2026-09-30 회차(별배 재출항) — 이야기를 끝낸 뒤 다시 연 횟수(0 = 첫 회차). 필드만 더해 SAVE_VERSION 그대로.
## data/cycle.gd 가 읽고 쓴다(공격력·경험치 +5%/회차, 세계 등급 상한 +2/회차).
var cycle: int = 0
## 2026-09-30 도움말 — 이미 띄운 첫 걸음 안내 id 들(data/help.gd TIPS). 필드만 더해 SAVE_VERSION 그대로.
var tips: Array = []
## 2026-09-30 사냥 기록 — {"kills": {종: 마릿수}, "claimed": {종: 받은 단계 수}}. 필드만 더해 SAVE_VERSION 그대로.
## world/hunt_log.gd 가 읽고 쓴다(규칙은 data/hunt.gd).
var hunt: Dictionary = {}
## 2026-09-30 주간 도전 — {"week", "base": {셈: 주 시작 값}, "claimed": [도전 id], "bonus": 완주 보상 받음}. 필드만 더해 SAVE_VERSION 그대로.
## world/weekly_goals.gd 가 읽고 쓴다(규칙은 data/weekly_goals.gd).
var weekly_goals: Dictionary = {}
signal world_changed()

var _session_start_exp: float = 0.0


## PLAN.md 101-4 "이번 세션" 줄의 기준점 — test_village.gd가 SaveState.
## try_load()(그러니까 restore()가 이미 exp를 앉힌) 뒤에 부른다. 그 전에
## 부르면 세션 델타가 로드 전 값(보통 0)을 기준으로 잡혀 "이번 세션에
## 이만큼 벌었다"가 실제로는 세이브를 불러오기 전부터의 누적으로 부풀어
## 보인다.
func begin_session() -> void:
	_session_start_exp = exp


func session_exp_gained() -> float:
	return exp - _session_start_exp


## 106장 ㉛·㉝ 편성 — 들판 명단 = 나 + members 앞 party_size 명(겹침 빼고). 자리 순서 = members 순서(숫자키 2·3·4).
## party_size 기본 PARTY_MAX 라 옛 세이브·점검은 옛날과 같다(앞 셋). 세이브 "party_size" 한 칸(없으면 PARTY_MAX, 버전 그대로).
const PARTY_MAX := 3
var party_size := PARTY_MAX
## 106장 ㊱ 편성 여러 벌(원신 파티 1~4) — 칸마다 나를 뺀 명단. 지금 명단(members 앞 party_size)은 늘 presets[preset_i] 와 같게 둔다
## (_set_party 가 적어 둔다). 다른 칸으로 바꾸면 그 칸 명단을 members 앞으로. 세이브 "party_presets"·"party_preset"(없으면 지금 명단이 1번).
const PRESET_COUNT := 4
var presets: Array = [[], [], [], []]
var preset_i := 0

## 나를 뺀 들판 명단.
func party() -> Array[String]:
	var out: Array[String] = []
	for m in members:
		if out.size() >= party_size:
			break
		if not out.has(m):
			out.append(m)
	return out

func in_party(id: String) -> bool:
	return id == "self" or party().has(id)

## 106장 ㊹ 탐사 나가 있는 동료인가.
func is_away(id: String) -> bool:
	for sid in dispatch.get("out", {}):
		if String((dispatch.out[sid] as Dictionary).get("id", "")) == id:
			return true
	return false

## 명단을 p 로(그 밖의 동료는 원래 순서로 뒤에, first 가 있으면 그 맨 앞).
func _set_party(p: Array[String], first: String = "") -> void:
	var rest: Array[String] = []
	if first != "":
		rest.append(first)
	for m in members:
		if not p.has(m) and not rest.has(m):
			rest.append(m)
	members.assign(p + rest)
	party_size = p.size()
	presets[preset_i] = p.duplicate()
	power_changed.emit(atk, def)

## 편성 칸 k 로 바꾼다 — 지금 명단은 지금 칸에 남고, k 칸 명단(없는 동료·겹침은 빼고)이 들판 명단이 된다. 바꿨으면 true.
func use_preset(k: int) -> bool:
	if k < 0 or k >= PRESET_COUNT or k == preset_i:
		return false
	presets[preset_i] = party().duplicate()
	preset_i = k
	var p: Array[String] = []
	for id in presets[k]:
		if members.has(String(id)) and not p.has(String(id)) and p.size() < PARTY_MAX and not is_away(String(id)):
			p.append(String(id))
	_set_party(p)
	return true

## 편성 칸 k 의 명단(지금 칸이면 지금 명단).
func preset_party(k: int) -> Array[String]:
	var out: Array[String] = []
	if k == preset_i:
		return party()
	for id in presets[k]:
		if members.has(String(id)) and not out.has(String(id)) and not is_away(String(id)):
			out.append(String(id))
	return out

## 세이브에서 — 칸이 없으면 지금 명단이 1번, 나머지는 빈 칸.
func restore_presets(saved: Variant, saved_i: int) -> void:
	presets = [[], [], [], []]
	if typeof(saved) == TYPE_ARRAY:
		for k in mini((saved as Array).size(), PRESET_COUNT):
			var arr: Variant = saved[k]
			if typeof(arr) == TYPE_ARRAY:
				for id in arr:
					if (presets[k] as Array).size() < PARTY_MAX:
						(presets[k] as Array).append(String(id))
		preset_i = clampi(saved_i, 0, PRESET_COUNT - 1)
	else:
		preset_i = 0
	presets[preset_i] = party().duplicate()

## 넣기 — 빈 자리가 있으면 그 자리에, 꽉 찼으면 마지막 자리와 바꾼다. 넣었으면 true.
func put_in_party(id: String) -> bool:
	if id == "self" or not members.has(id) or in_party(id) or is_away(id):
		return false
	var p := party()
	var out := ""
	if p.size() >= PARTY_MAX:
		out = p.pop_back()
	p.append(id)
	_set_party(p, out)
	return true

## 빼기 — 나는 못 뺀다(늘 첫 자리). 뺐으면 true.
func remove_from_party(id: String) -> bool:
	var p := party()
	if not p.has(id):
		return false
	p.erase(id)
	_set_party(p, id)
	return true

## 명단 안에서 한 자리 앞으로(숫자키 순서). 옮겼으면 true.
func move_up_in_party(id: String) -> bool:
	var p := party()
	var i := p.find(id)
	if i <= 0:
		return false
	p[i] = p[i - 1]
	p[i - 1] = id
	_set_party(p)
	return true

func recruit(id: String) -> void:
	members.append(id)
	## 106장 ㉝ — 편성으로 자리를 비워 둔 채면 새 동료가 그 빈자리에(옛날처럼 셋이 찰 때까지는 저절로).
	if party_size < PARTY_MAX and not in_party(id):
		put_in_party(id)
	var old_level := level
	_recompute()
	power_changed.emit(atk, def)
	if level > old_level:
		level_up.emit(level)


## 사건 보상(고대 비문을 읽는다·부상병을 돌본다·적을 물리친다 등)이
## 경험치를 쌓는 유일한 통로다 — 걷기·시간 경과로는 안 오른다.
## 천후(weather.gd)가 이 보상에 보너스를 건다(웹판 weather.js의 expPct와
## 같은 자리 — 이 판엔 포획·스폰 계열이 없어 exp만 옮겼다). "보" 축
## 특성(101-2)이 여기 더 얹인다.
func add_exp(amount: float) -> void:
	if amount <= 0.0:
		return
	exp += amount * Weather.exp_bonus_mul() * (1.0 + _support_bonus()) * (1.0 + buddy_bonus("exp")) * (1.0 + 0.05 * float(cycle))
	var old_level := level
	_recompute()
	power_changed.emit(atk, def)
	if level > old_level:
		level_up.emit(level)


## save_state.gd가 저장 파일을 불러온 뒤 여기로 넘긴다 — recruit()·add_exp()와
## 다르게 이미 정해진 값을 통째로 앉히고 수치만 다시 계산한다(신호는 한 번만,
## level_up 은 안 emit — 로드는 새 성장이 아니다).
func restore(saved_members: Array[String], saved_exp: float = 0.0, saved_perks: Array[String] = [],
		saved_growth: Dictionary = {}, saved_bag: Dictionary = {}, saved_weapons: Dictionary = {}, saved_equip: Dictionary = {},
		saved_artifacts: Dictionary = {}, saved_artifact_seq: int = 0) -> void:
	members = saved_members.duplicate()
	exp = saved_exp
	perks = saved_perks.duplicate()
	growth.clear()
	for id in saved_growth:
		var g: Variant = saved_growth[id]
		if typeof(g) == TYPE_DICTIONARY:
			growth[str(id)] = {"lv": int(g.get("lv", 1)), "exp": float(g.get("exp", 0.0)), "asc": int(g.get("asc", 0)),
				"tn": int(g.get("tn", 1)), "ts": int(g.get("ts", 1)), "tb": int(g.get("tb", 1)), "con": int(g.get("con", 0))}
	bag.clear()
	for item in saved_bag:
		bag[str(item)] = int(saved_bag[item])
	weapons.clear()
	for wid in saved_weapons:
		var w: Variant = saved_weapons[wid]
		if typeof(w) == TYPE_DICTIONARY and Weapons.WEAPONS.has(str(wid)):
			weapons[str(wid)] = {"lv": int(w.get("lv", 1)), "exp": float(w.get("exp", 0.0)), "asc": int(w.get("asc", 0)), "ref": int(w.get("ref", 1))}
	equip.clear()
	for mid in saved_equip:
		equip[str(mid)] = str(saved_equip[mid])
	artifacts.clear()
	for uid in saved_artifacts:
		var a: Variant = saved_artifacts[uid]
		if typeof(a) != TYPE_DICTIONARY or not Artifacts.SETS.has(str(a.get("set", ""))):
			continue
		var subs: Array = []
		for s in a.get("subs", []):
			subs.append([str(s[0]), float(s[1])])
		artifacts[str(uid)] = {"set": str(a.set), "slot": str(a.get("slot", "flower")), "rarity": int(a.get("rarity", 4)),
			"lv": int(a.get("lv", 0)), "exp": float(a.get("exp", 0.0)), "total": float(a.get("total", 0.0)),
			"main": str(a.get("main", "hp")), "subs": subs, "seed": int(a.get("seed", 0)), "owner": str(a.get("owner", ""))}
	artifact_seq = maxi(saved_artifact_seq, artifacts.size())
	_recompute()
	power_changed.emit(atk, def)


## level_up 카드에서 고른 특성을 확정한다(games/saga_go/ui나 test_village.gd가
## 부른다 — party_state.gd는 카드 UI를 모른다, codex_state.gd discover()와
## 같은 경계).
func add_perk(id: String) -> void:
	if not perks.has(id):
		perks.append(id)
	_recompute()
	power_changed.emit(atk, def)


func _support_bonus() -> float:
	var bonus := 0.0
	for pid in perks:
		var p: Dictionary = Perks.find(pid)
		if not p.is_empty() and p.axis == "support":
			bonus += float(p.mul)
	return bonus


func _perk_mul(axis: String) -> float:
	var mul := 1.0
	for pid in perks:
		var p: Dictionary = Perks.find(pid)
		if not p.is_empty() and p.axis == axis:
			mul += float(p.mul)
	return mul

func atk_mul() -> float:
	return _perk_mul("attack") * (1.0 + buddy_bonus("atk")) * (1.0 + 0.05 * float(cycle))

func def_mul() -> float:
	return _perk_mul("defense") * (1.0 + buddy_bonus("def"))

## 2026-09-30 동행 신수 친밀 — 함께 걸은 거리(eggs.friend[신수])가 500m 마다 친밀 1(최대 10). 신수 도감 bonus.stat 을
## 힘(might)→공격력 · 지혜(wisdom)→경험치 · 통솔(command)→방어력 으로 옮겨, 친밀 10 에서 도감 value % 가 붙는다(친밀 × value/10 %).
const BUDDY_LEVEL_M := 500.0
const BUDDY_STAT := {"might": "atk", "wisdom": "exp", "command": "def"}

func buddy_level() -> int:
	var id := String(eggs.get("buddy", ""))
	if id == "":
		return 0
	return mini(10, int(float((eggs.get("friend", {}) as Dictionary).get(id, 0.0)) / BUDDY_LEVEL_M))

## kind: "atk" | "exp" | "def" — 동행 신수가 그 갈래를 주면 비율(0.05 = +5%), 아니면 0.
func buddy_bonus(kind: String) -> float:
	var id := String(eggs.get("buddy", ""))
	if id == "":
		return 0.0
	var pet: Variant = preload("res://saga_core/data/pets.gd").find(id)
	if pet == null or String(BUDDY_STAT.get(String(pet.bonus.stat), "")) != kind:
		return 0.0
	return float(pet.bonus.value) * float(buddy_level()) / 10.0 / 100.0

## 동행·친밀이 바뀌면 공격·방어를 다시 계산해 알린다.
func refresh_power() -> void:
	_recompute()
	power_changed.emit(atk, def)

func _recompute() -> void:
	level = int(exp / EXP_PER_LEVEL)
	atk = (BASE_ATK + members.size() * ATK_PER_MEMBER + level * ATK_PER_LEVEL) * atk_mul()
	def = (BASE_DEF + members.size() * DEF_PER_MEMBER + level * DEF_PER_LEVEL) * def_mul()

# ---------------------------------------------------------------- 인물 육성(106장 ⑩)

func growth_of(id: String) -> Dictionary:
	if not growth.has(id):
		growth[id] = {"lv": 1, "exp": 0.0, "asc": 0}
	return growth[id]

func char_level(id: String) -> int:
	return int(growth_of(id).lv)

func char_asc(id: String) -> int:
	return int(growth_of(id).asc)

func char_cap(id: String) -> int:
	return Growth.cap_of(char_asc(id))

## 들판 전투 공격·방어 — (인물 기본 × 레벨·돌파 배율 + 무기 공격력) × (1 + 공격력%) × 승급 특성.
## 희귀도·공명은 field_combat 이 곱한다.
func char_atk(id: String) -> float:
	var g := growth_of(id)
	return ((Growth.BASE_ATK * Growth.stat_mul(int(g.lv), int(g.asc)) + weapon_atk(id)) * (1.0 + stat(id, "atk_pct")) + stat(id, "atk")) * atk_mul()

func char_def(id: String) -> float:
	var g := growth_of(id)
	return (Growth.BASE_DEF * Growth.stat_mul(int(g.lv), int(g.asc)) * (1.0 + stat(id, "def_pct")) + stat(id, "def")) * def_mul()

func count(item: String) -> int:
	return int(bag.get(item, 0))

func add_items(items: Dictionary) -> void:
	for item in items:
		bag[item] = count(item) + int(items[item])
	bag_changed.emit()

func has_items(items: Dictionary) -> bool:
	for item in items:
		if count(item) < int(items[item]):
			return false
	return true

func spend_items(items: Dictionary) -> bool:
	if not has_items(items):
		return false
	for item in items:
		bag[item] = count(item) - int(items[item])
	bag_changed.emit()
	return true

## 견문록 n 권을 id 에게 쓴다(권마다 냥도 든다). 상한에 닿으면 멈추고 남는 경험은 버린다(원신도 넘친 만큼은
## 쓸모가 없다). 오른 레벨 수를 돌려준다(한 권도 못 썼으면 -1).
func use_book(id: String, book: String, n: int = 1) -> int:
	var g := growth_of(id)
	var old_lv := int(g.lv)
	var used := 0
	for i in n:
		if int(g.lv) >= char_cap(id) or count(book) <= 0:
			break
		var gain: int = Growth.ITEMS[book].exp
		var cost := {"mora": int(ceil(gain * Growth.MORA_PER_EXP)), book: 1}
		if not spend_items(cost):
			break
		used += 1
		g.exp = float(g.exp) + gain
		while int(g.lv) < char_cap(id) and float(g.exp) >= Growth.exp_to_next(int(g.lv)):
			g.exp = float(g.exp) - Growth.exp_to_next(int(g.lv))
			g.lv = int(g.lv) + 1
		if int(g.lv) >= char_cap(id):
			g.exp = 0.0
	if used == 0:
		return -1
	growth_changed.emit(id)
	power_changed.emit(atk, def)
	return int(g.lv) - old_lv

## 다음 레벨까지 — 작은 견문록부터 필요한 만큼. 오른 레벨 수(못 쓰면 -1).
func level_up_once(id: String) -> int:
	var start := char_level(id)
	var any := false
	for book in Growth.BOOKS:
		while char_level(id) == start and char_level(id) < char_cap(id) and count(book) > 0:
			if use_book(id, book, 1) < 0:
				break
			any = true
		if char_level(id) > start:
			break
	return char_level(id) - start if any else -1

func can_ascend(id: String) -> bool:
	var g := growth_of(id)
	return int(g.asc) < Growth.MAX_ASC and int(g.lv) >= char_cap(id) and has_items(Growth.ascend_cost(id, int(g.asc)))

func ascend(id: String) -> bool:
	if not can_ascend(id):
		return false
	var g := growth_of(id)
	spend_items(Growth.ascend_cost(id, int(g.asc)))
	g.asc = int(g.asc) + 1
	growth_changed.emit(id)
	power_changed.emit(atk, def)
	return true

# ---------------------------------------------------------------- 특성·운명의 자리(106장 ⑫)

const _TALENT_KEY := {"normal": "tn", "skill": "ts", "burst": "tb"}

## 올린 특성 레벨(1~10). 운명의 자리 보너스는 뺀 값.
func talent_level(id: String, kind: String) -> int:
	return int(growth_of(id).get(_TALENT_KEY[kind], 1))

## 싸울 때 쓰는 특성 레벨 — 운명의 자리 3(스킬)·5(폭발)가 +3.
func talent_effective(id: String, kind: String) -> int:
	var lv := talent_level(id, kind)
	if (kind == "skill" and constellation(id) >= 3) or (kind == "burst" and constellation(id) >= 5):
		lv += Growth.TALENT_BONUS
	return lv

func talent_mul(id: String, kind: String) -> float:
	return Growth.talent_mul(talent_effective(id, kind))

func talent_cap(id: String) -> int:
	return Growth.talent_cap(char_asc(id))

func can_talent_up(id: String, kind: String) -> bool:
	var lv := talent_level(id, kind)
	return lv < talent_cap(id) and has_items(Growth.talent_cost(id, lv))

func talent_up(id: String, kind: String) -> bool:
	if not can_talent_up(id, kind):
		return false
	var lv := talent_level(id, kind)
	spend_items(Growth.talent_cost(id, lv))
	growth_of(id)[_TALENT_KEY[kind]] = lv + 1
	growth_changed.emit(id)
	power_changed.emit(atk, def)
	return true

func constellation(id: String) -> int:
	return int(growth_of(id).get("con", 0))

func can_unlock_constellation(id: String) -> bool:
	return constellation(id) < Growth.CONSTELLATION_MAX and has_items(Growth.CONSTELLATION_COST)

func unlock_constellation(id: String) -> bool:
	if not can_unlock_constellation(id):
		return false
	spend_items(Growth.CONSTELLATION_COST)
	growth_of(id)["con"] = constellation(id) + 1
	growth_changed.emit(id)
	power_changed.emit(atk, def)
	return true

# ---------------------------------------------------------------- 무기(106장 ⑯)

## 이 인물이 든 무기 id — 든 게 없거나 못 드는 거면 그 종류 수련용.
func weapon_of(id: String) -> String:
	var wid: String = equip.get(id, "")
	if wid == "" or not owns_weapon(wid) or Weapons.info(wid).type != Weapons.type_of(id):
		return Weapons.default_of(Weapons.type_of(id))
	return wid

func owns_weapon(wid: String) -> bool:
	return Weapons.WEAPONS.has(wid) and (Weapons.is_shared(wid) or weapons.has(wid))

func weapon_state(wid: String) -> Dictionary:
	if not weapons.has(wid):
		weapons[wid] = {"lv": 1, "exp": 0.0, "asc": 0, "ref": 1}
	return weapons[wid]

func weapon_cap(wid: String) -> int:
	return Growth.cap_of(int(weapon_state(wid).asc))

## 무기를 얻는다 — 처음이면 "new", 이미 있으면 재련 +1 해서 "refine"(5 면 "max"). 수련용은 "".
func add_weapon(wid: String) -> String:
	if not Weapons.WEAPONS.has(wid) or Weapons.is_shared(wid):
		return ""
	var out := "new"
	if weapons.has(wid):
		var w: Dictionary = weapons[wid]
		if int(w.ref) >= Weapons.REFINE_MAX:
			out = "max"
		else:
			w.ref = int(w.ref) + 1
			out = "refine"
	else:
		weapon_state(wid)
	weapon_changed.emit()
	return out

## 이 인물이 들 수 있는 가진 무기(같은 종류) — 수련용 먼저, 그다음 희귀도 높은 순.
func weapons_for(id: String) -> Array[String]:
	var t := Weapons.type_of(id)
	var out: Array[String] = [Weapons.default_of(t)]
	for r in [4, 3]:
		for wid in Weapons.WEAPONS:
			if Weapons.info(wid).type == t and int(Weapons.info(wid).rarity) == r and weapons.has(wid):
				out.append(wid)
	return out

## 무기를 쥐여 준다. 한 자루뿐인 무기를 다른 인물이 들고 있었으면 그 인물은 수련용으로 돌아간다.
func equip_weapon(id: String, wid: String) -> bool:
	if not owns_weapon(wid) or Weapons.info(wid).type != Weapons.type_of(id):
		return false
	if not Weapons.is_shared(wid):
		for other in equip.keys():
			if other != id and equip[other] == wid:
				equip.erase(other)
	equip[id] = wid
	weapon_changed.emit()
	power_changed.emit(atk, def)
	return true

func weapon_atk(id: String) -> float:
	var wid := weapon_of(id)
	var w := weapon_state(wid)
	return Weapons.atk_at(wid, int(w.lv), int(w.asc))

## 옵션 합 — 무기 부옵션 + 낀 성유물 주/부옵션 + 세트 2 효과(106장 ⑰). 비율 옵션은 비율, 고정값(hp·atk·def)은 수.
func stat(id: String, key: String) -> float:
	var v := 0.0
	var wid := weapon_of(id)
	if Weapons.info(wid).get("sub", "") == key:
		v += Weapons.sub_at(wid, int(weapon_state(wid).lv))
	for art in equipped_artifacts(id):
		if art.main == key:
			v += Artifacts.main_value(art)
		for s in art.subs:
			if s[0] == key:
				v += float(s[1])
	var counts := set_counts(id)
	for set_id in counts:
		if int(counts[set_id]) >= 2:
			v += float((Artifacts.SETS[set_id]["2"] as Dictionary).get(key, 0.0))
	return v + food_stat(key)

## 음식 버프(106장 ⑱) — 명단 전체에 같은 값. 계열마다 하나라 key 가 겹칠 일은 드물지만 더해 둔다.
func food_stat(key: String) -> float:
	var v := 0.0
	for cat in food_buffs:
		var b: Dictionary = food_buffs[cat]
		if b.stat == key and float(b.left) > 0.0:
			v += float(b.value)
	return v

## 버프를 건다(같은 계열은 갈아 끼움).
func set_food_buff(cat: String, recipe: String, q: int, key: String, value: float, sec: float) -> void:
	food_buffs[cat] = {"recipe": recipe, "q": q, "stat": key, "value": value, "left": sec}
	power_changed.emit(atk, def)
	food_changed.emit()

## cooking.gd 가 부른다 — 남은 시간을 깎고 끝난 버프를 뺀다.
func tick_food(delta: float) -> void:
	var ended := false
	for cat in food_buffs.keys():
		food_buffs[cat].left = float(food_buffs[cat].left) - delta
		if float(food_buffs[cat].left) <= 0.0:
			food_buffs.erase(cat)
			ended = true
	if ended:
		power_changed.emit(atk, def)
		food_changed.emit()

## save_state.gd 가 불러온 뒤 — 채집 시각·숙련(없으면 빈 사전).
func restore_cooking(saved_gather: Dictionary, saved_prof: Dictionary) -> void:
	gather_t.clear()
	for k in saved_gather:
		gather_t[str(k)] = float(saved_gather[k])
	cook_prof.clear()
	for k in saved_prof:
		cook_prof[str(k)] = int(saved_prof[k])
	food_buffs.clear()
	food_changed.emit()

func crit_rate(id: String) -> float:
	return clampf(Weapons.BASE_CRIT_RATE + stat(id, "crit_rate"), 0.0, 1.0)

func crit_dmg(id: String) -> float:
	return Weapons.BASE_CRIT_DMG + stat(id, "crit_dmg")

## 무기 효과 배율 — kind(normal·skill·burst·reaction) 가 그 무기 효과면 1 + 값(재련 반영).
## 성유물 4 세트도 더한다(기본 공격은 한손검·양손검·장병기만 · 스킬 · 폭발).
func passive_mul(id: String, kind: String) -> float:
	var m := 1.0
	var wid := weapon_of(id)
	if Weapons.info(wid).get("passive", "") == kind:
		m += Weapons.passive_at(wid, int(weapon_state(wid).ref))
	match kind:
		"normal":
			if ["sword", "claymore", "polearm"].has(Weapons.type_of(id)):
				m += set4(id, "normal_melee")
		"skill":
			m += set4(id, "skill_dmg")
		"burst":
			m += set4(id, "burst_dmg")
	return m

## 강화석 n 개를 무기에 쓴다(냥도 든다). 상한에서 멈추고 남는 경험은 버린다. 오른 레벨 수(못 쓰면 -1).
func weapon_use_ore(wid: String, ore: String, n: int = 1) -> int:
	if not owns_weapon(wid):
		return -1
	var w := weapon_state(wid)
	var old_lv := int(w.lv)
	var used := 0
	for i in n:
		if int(w.lv) >= weapon_cap(wid) or count(ore) <= 0:
			break
		var gain: int = Weapons.ORE_EXP[ore]
		if not spend_items({"mora": int(ceil(gain * Weapons.MORA_PER_EXP)), ore: 1}):
			break
		used += 1
		w.exp = float(w.exp) + gain
		while int(w.lv) < weapon_cap(wid) and float(w.exp) >= Weapons.exp_to_next(int(w.lv)):
			w.exp = float(w.exp) - Weapons.exp_to_next(int(w.lv))
			w.lv = int(w.lv) + 1
		if int(w.lv) >= weapon_cap(wid):
			w.exp = 0.0
	if used == 0:
		return -1
	weapon_changed.emit()
	power_changed.emit(atk, def)
	return int(w.lv) - old_lv

## 다음 레벨까지 — 작은 강화석부터. 오른 레벨 수(못 쓰면 -1).
func weapon_level_once(wid: String) -> int:
	var start := int(weapon_state(wid).lv)
	var any := false
	for ore in Weapons.ORES:
		while int(weapon_state(wid).lv) == start and start < weapon_cap(wid) and count(ore) > 0:
			if weapon_use_ore(wid, ore, 1) < 0:
				break
			any = true
		if int(weapon_state(wid).lv) > start:
			break
	return int(weapon_state(wid).lv) - start if any else -1

func can_weapon_ascend(wid: String) -> bool:
	if not owns_weapon(wid):
		return false
	var w := weapon_state(wid)
	return int(w.asc) < Growth.MAX_ASC and int(w.lv) >= weapon_cap(wid) and has_items(Weapons.ascend_cost(wid, int(w.asc)))

func weapon_ascend(wid: String) -> bool:
	if not can_weapon_ascend(wid):
		return false
	var w := weapon_state(wid)
	spend_items(Weapons.ascend_cost(wid, int(w.asc)))
	w.asc = int(w.asc) + 1
	weapon_changed.emit()
	power_changed.emit(atk, def)
	return true

# ---------------------------------------------------------------- 성유물(106장 ⑰)

## 새 성유물 — 번호를 하나 올려 그 번호로 씨앗을 정한다. 가득 차면 안 낀 ★4 부터 분해. uid 를 돌려준다.
func add_artifact(rarity: int, set_id: String = "", slot: String = "") -> String:
	artifact_seq += 1
	var uid := "a%d" % artifact_seq
	artifacts[uid] = Artifacts.generate(20260824 + artifact_seq * 7919, rarity, set_id, slot)
	while artifacts.size() > Artifacts.CAP:
		var victim := ""
		for k in artifacts:
			var a: Dictionary = artifacts[k]
			if k != uid and a.owner == "" and (victim == "" or int(a.rarity) < int(artifacts[victim].rarity)):
				victim = k
		if victim == "" or not salvage(victim):
			break
	artifact_changed.emit()
	return uid

func artifact_of(id: String, slot: String) -> String:
	for uid in artifacts:
		var a: Dictionary = artifacts[uid]
		if a.owner == id and a.slot == slot:
			return uid
	return ""

func equipped_artifacts(id: String) -> Array:
	var out: Array = []
	for uid in artifacts:
		if artifacts[uid].owner == id:
			out.append(artifacts[uid])
	return out

## 낀다 — 그 부위에 끼던 건 이 성유물을 끼고 있던 인물에게 넘어간다(원신처럼 맞바꿈, 없으면 뺌).
func equip_artifact(id: String, uid: String) -> bool:
	if not artifacts.has(uid):
		return false
	var art: Dictionary = artifacts[uid]
	if art.owner == id:
		return true
	var prev_owner: String = art.owner
	var current := artifact_of(id, art.slot)
	if current != "":
		artifacts[current].owner = prev_owner
	art.owner = id
	artifact_changed.emit()
	power_changed.emit(atk, def)
	return true

func unequip_artifact(id: String, slot: String) -> void:
	var uid := artifact_of(id, slot)
	if uid != "":
		artifacts[uid].owner = ""
		artifact_changed.emit()
		power_changed.emit(atk, def)

## 그 부위 성유물 — 희귀도·레벨 높은 순, 같으면 번호 순.
func artifacts_for_slot(slot: String) -> Array[String]:
	var out: Array[String] = []
	for uid in artifacts:
		if artifacts[uid].slot == slot:
			out.append(uid)
	out.sort_custom(func(a: String, b: String) -> bool:
		var x: Dictionary = artifacts[a]
		var y: Dictionary = artifacts[b]
		if int(x.rarity) != int(y.rarity):
			return int(x.rarity) > int(y.rarity)
		if int(x.lv) != int(y.lv):
			return int(x.lv) > int(y.lv)
		return int(a.substr(1)) < int(b.substr(1)))
	return out

## 연마석으로 +1 — 오른 레벨 수(못 쓰면 -1). +4 마다 부옵션.
func artifact_level_once(uid: String) -> int:
	if not artifacts.has(uid):
		return -1
	var art: Dictionary = artifacts[uid]
	var max_lv: int = Artifacts.MAX_LV[int(art.rarity)]
	var start := int(art.lv)
	var any := false
	while int(art.lv) == start and start < max_lv:
		if not spend_items({"mora": Artifacts.POLISH_MORA, "polish": 1}):
			break
		any = true
		art.exp = float(art.exp) + Artifacts.POLISH_EXP
		art.total = float(art.total) + Artifacts.POLISH_EXP
		while int(art.lv) < max_lv and float(art.exp) >= Artifacts.exp_to_next(int(art.lv)):
			art.exp = float(art.exp) - Artifacts.exp_to_next(int(art.lv))
			art.lv = int(art.lv) + 1
			if int(art.lv) % 4 == 0:
				Artifacts.on_step(art)
		if int(art.lv) >= max_lv:
			art.exp = 0.0
	if not any:
		return -1
	artifact_changed.emit()
	power_changed.emit(atk, def)
	return int(art.lv) - start

## 분해 — 낀 건 안 된다. 연마석으로 돌려받는다.
func salvage(uid: String) -> bool:
	if not artifacts.has(uid) or artifacts[uid].owner != "":
		return false
	var n := Artifacts.salvage_value(artifacts[uid])
	artifacts.erase(uid)
	add_items({"polish": n})
	artifact_changed.emit()
	return true

## 안 낀 ★rarity 이하·+0 인 것을 모두 분해 — 분해한 수.
func salvage_unused(max_rarity: int = 4) -> int:
	var n := 0
	for uid in artifacts.keys():
		var a: Dictionary = artifacts[uid]
		if a.owner == "" and int(a.rarity) <= max_rarity and int(a.lv) == 0 and salvage(uid):
			n += 1
	return n

func set_counts(id: String) -> Dictionary:
	var c := {}
	for art in equipped_artifacts(id):
		c[art.set] = int(c.get(art.set, 0)) + 1
	return c

## 4 세트 효과 값(그 키가 있는 세트를 넷 이상 꼈을 때).
func set4(id: String, key: String) -> float:
	var v := 0.0
	var counts := set_counts(id)
	for set_id in counts:
		if int(counts[set_id]) >= 4:
			v += float((Artifacts.SETS[set_id]["4"] as Dictionary).get(key, 0.0))
	return v

## 반응 피해 배율 — 무기 효과(반응) + 4 세트(불꽃 무녀: 증발·융해·과부하·연소 · 바람 나그네: 확산).
func react_mul(id: String, reaction: String) -> float:
	var m := passive_mul(id, "reaction")
	if Artifacts.FIRE_REACTIONS.has(reaction):
		m += set4(id, "react_fire")
	elif reaction == "swirl":
		m += set4(id, "react_swirl")
	return m

## 원소(물리 "") 피해 보너스 배율.
func dmg_bonus(id: String, element: String) -> float:
	return 1.0 + stat(id, "elem_" + (element if element != "" else "phys"))
