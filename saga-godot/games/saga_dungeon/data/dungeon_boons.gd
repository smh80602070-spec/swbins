extends RefCounted
class_name DungeonBoons

## VERTICAL_SLICE_DUNGEON.md "제외" 목록 1번(은사) 착수. 웹판
## `saga-dungeon/js/data-dungeon.js`의 BOONS를 key·name·emoji·max·desc·eff
## 상수 하나 안 바꾸고 그대로 옮겼다(루트 CLAUDE.md "새로 설계하지 않는다").
## eff의 각 키가 뭘 하는지는 dungeon_run_state.gd가 실제로 읽어 적용한다 —
## 이 파일은 데이터만 들고 있는다(웹판 data-dungeon.js와 같은 경계).
##
## **2026-09-17, PLAN.md 101-2 DUNGEON ①(축복 3택) — saga-web/saga-dungeon/
## PLAN.md §5.1 "축복 3택 — 은사를 회차 빌드로 재해석"을 옮긴다.** 웹은
## 아직 미구현(§8 로드맵 Phase 1 예정, HANDOFF에 5.1 흔적 없음 — grep으로
## 확인)이지만, saga-godot 101-1 표도 GO 여섯 후보를 전부 "웹 미검증"
## 상태에서 그대로 옮긴 선례가 있다(PLAN 101-4 "3D는 새로 설계하지 않는다
## — 웹에서 검증된 것부터"는 §5의 **설계**를 출처로 삼으라는 뜻이지, 웹
## 코드가 이미 돌고 있어야 한다는 뜻이 아니다 — 지금까지 GO 트랙이 그렇게
## 해 왔다).
##
## 웹 5.1 원안은 "무예 축(걸어 둔 무예 4칸 중 하나를 강화)·인물 축(서명
## 무예 강화)·세계 축(7원소 시너지 12개)"인데, 이 슬라이스는 웹과 구조가
## 다르다 — 무예는 "4칸 장착"이 아니라 스킬트리 랭크(다섯 직업×6갈래×3단,
## dungeon_skills.gd)라 전부 상시 발동 중이고, "서명 무예"(인물별 고유
## 무예) 자체가 이 판엔 없다(DungeonPartyState는 부대원 수만큼 atkPct/
## hpPct를 더할 뿐 — dungeon_party_state.gd 참고). 그래서 세 축을 다음처럼
## **이 슬라이스에 실제로 있는 채널**로 재해석했다(새 시스템을 안 만든다는
## 원칙은 그대로 지킨다):
## - **무예 축(skill)**: `DungeonRunState.skill_mul()`(무예 데미지 전용
##   배율, dungeon_skills.gd가 이미 이 채널만 쓴다 — 기본 공격엔 안 곱는다)
##   에 꽂는 `skillPct`, 그리고 즉시 발동형 "비급"(현재 장착 무기 직업에
##   무예 점수 1 부여 — DungeonSkillState.award_point()를 그대로 부른다,
##   dungeon_run_state.gd::apply_boon() 참고). 모양별(swing 범위·bolt
##   관통 등) 고유 효과는 스킬 스크립트 80여 개를 개별 수정해야 해(직업당
##   스크립트 하나 결, dungeon_skills.gd 헤더 참고) 이번 범위 밖 — 다음
##   세션.
## - **인물 축(hero)**: 기존 14개 중 캐릭터 생존·전투 스탯(fury·wall·
##   haste·dash·pierce·drain·crit·reach·mend·ghost·ward)을 여기 모았다 —
##   DungeonPartyState가 이미 atkPct/hpPct로 부대를 이 채널에 합류시키고
##   있어(_sum_eff()) "인물(부대)"이라는 이름이 그대로 맞는다.
## - **세계 축(world)**: 기존 경제·탐색(greed·eye·scout) + **원소 시너지
##   3종 신규**(`SYNERGIES`, melee_attack.gd::_check_elem_synergy()가
##   읽는다) — 화+뇌·빙+기·독+전자 세 쌍 다 "그 적을 처치하면 반경 안
##   나머지에게 확산 피해"로 **하나의 메커니즘에 통일**했다(원안은 쌍마다
##   결빙 강화/저항 감소 등 다른 효과지만, 세 가지 다른 판정을 새로 짜면
##   이번 범위를 넘는다 — 반경 80px→BASE_REACH(34px) 환산 2.35m, 피해
##   14는 젬 원소 피해(5~8, dungeon_items.gd GEMS)의 대략 두 배로 직접
##   정함). 물리+화(작열, "콤보 6 이상")는 이 슬라이스에 콤보 카운터
##   자체가 없어 뺐다.
## 희귀도 3단(common 60%·rare 30%·legendary 10%, 원안 그대로)과 "같은 회차
## 안 축 중복 금지"는 `dungeon_run_state.gd::roll_choice()`가 맡는다.
## 메타 도감("은사첩")·"회차 한정" 리셋은 이 슬라이스에 안 만든다 — 세이브
## 파일 자체가 이미 "회차"라(파일 헤더 원 주석 그대로) `boons`가 리셋된 적이
## 없어 은사첩이 `boons.keys()`와 항상 같다(다음에 진짜 회차 리셋이 생기면
## 그때 분리한다).
##
## 이번 슬라이스에서 실제로 적용하는 eff 키: atkPct·atkSpdPct·moveSpdPct·
## reachPct·hpPct+healOnPick·guardPct·drainPct·critPct(1.85배, dungeon.js
## strike() 그대로)·echoPct·**skillPct(신규, skill_mul() 전용)**.
## **적용하지 않는 키(시스템이 아직 없다)**: goldPct(경제 시스템 없음)
## ·worldFindPct(장비 희귀도 없음, 노획은 이름만)·healOnFloor(여러 방/층
## 진입 이벤트가 없음, 방 하나뿐)·reveal(안개·시야 시스템 없음)·piercePct
## (적에게 방어력 자체가 없다 — 잡졸은 고정 HP만 갖는다, 방어를 "무시"할
## 대상이 없음). **skillPointGrant(신규, "비급")는 _sum_eff()가 아니라
## apply_boon()이 직접 소비한다** — 즉시 1회성 효과라 다른 키처럼 스택
## 합산이 아니다. 이 키들도 `boons` 딕셔너리엔 정상적으로 쌓인다 — 나중에
## 해당 시스템이 생기면 여기 getter만 추가하면 된다(데이터는 이미 다 있다).

const BOONS: Array[Dictionary] = [
	{ "key": "fury", "name": "맹공(猛攻)", "emoji": "⚔️", "max": 5, "axis": "hero", "rarity": "common",
		"desc": "공격력 +18%", "eff": { "atkPct": 18.0 } },
	{ "key": "wall", "name": "철벽(鐵壁)", "emoji": "🛡️", "max": 5, "axis": "hero", "rarity": "common",
		"desc": "최대 체력 +20% · 즉시 그만큼 회복", "eff": { "hpPct": 20.0, "healOnPick": 20.0 } },
	{ "key": "haste", "name": "연격(連擊)", "emoji": "💨", "max": 4, "axis": "hero", "rarity": "common",
		"desc": "공격 속도 +14%", "eff": { "atkSpdPct": 14.0 } },
	{ "key": "dash", "name": "질주(疾走)", "emoji": "🏃", "max": 3, "axis": "hero", "rarity": "common",
		"desc": "이동 속도 +16%", "eff": { "moveSpdPct": 16.0 } },
	{ "key": "pierce", "name": "관통(貫通)", "emoji": "🗡️", "max": 4, "axis": "hero", "rarity": "rare",
		"desc": "적 방어를 25% 무시", "eff": { "piercePct": 25.0 } },
	{ "key": "drain", "name": "흡혈(吸血)", "emoji": "🩸", "max": 4, "axis": "hero", "rarity": "common",
		"desc": "적을 잡으면 체력 3% 회복", "eff": { "drainPct": 3.0 } },
	{ "key": "crit", "name": "일격(一擊)", "emoji": "✨", "max": 5, "axis": "hero", "rarity": "rare",
		"desc": "치명타 확률 +8%", "eff": { "critPct": 8.0 } },
	{ "key": "reach", "name": "장병(長兵)", "emoji": "📏", "max": 3, "axis": "hero", "rarity": "common",
		"desc": "공격 사거리 +18%", "eff": { "reachPct": 18.0 } },
	{ "key": "greed", "name": "재물운(財)", "emoji": "💰", "max": 4, "axis": "world", "rarity": "common",
		"desc": "던전에서 얻는 금 +30%", "eff": { "goldPct": 30.0 } },
	{ "key": "eye", "name": "탐색안(眼)", "emoji": "🔎", "max": 4, "axis": "world", "rarity": "common",
		"desc": "좋은 물건이 나올 확률 +20%", "eff": { "worldFindPct": 20.0 } },
	{ "key": "mend", "name": "회복술(治)", "emoji": "🌿", "max": 3, "axis": "hero", "rarity": "rare",
		"desc": "층에 들어설 때 체력 25% 회복", "eff": { "healOnFloor": 25.0 } },
	{ "key": "ghost", "name": "분신(分身)", "emoji": "👥", "max": 3, "axis": "hero", "rarity": "rare",
		"desc": "공격 시 22% 확률로 한 번 더", "eff": { "echoPct": 22.0 } },
	{ "key": "ward", "name": "수호부(符)", "emoji": "🧿", "max": 3, "axis": "hero", "rarity": "rare",
		"desc": "받는 피해 -12%", "eff": { "guardPct": 12.0 } },
	{ "key": "scout", "name": "척후(斥候)", "emoji": "🗺️", "max": 2, "axis": "world", "rarity": "rare",
		"desc": "방을 들어서면 그 방이 바로 밝아진다", "eff": { "reveal": 1.0 } },

	## 무예 축(skill, 2026-09-17 신규) — skillPct는 dungeon_skills.gd의
	## s_focus·y_hex가 이미 채우던 채널을 은사도 같이 쓴다(skill_mul()
	## 하나로 자동 합산, 새 getter 불필요).
	{ "key": "skillamp1", "name": "진기(眞氣)", "emoji": "🌀", "max": 5, "axis": "skill", "rarity": "common",
		"desc": "무예 위력 +15%", "eff": { "skillPct": 15.0 } },
	{ "key": "skillamp2", "name": "현오(玄奧)", "emoji": "🔮", "max": 3, "axis": "skill", "rarity": "rare",
		"desc": "무예 위력 +30%", "eff": { "skillPct": 30.0 } },
	{ "key": "skillpoint", "name": "비급(祕笈)", "emoji": "📜", "max": 20, "axis": "skill", "rarity": "legendary",
		"desc": "즉시 지금 장착한 무기의 직업에 무예 점수 1 부여", "eff": { "skillPointGrant": 1.0 } },

	## 세계 축 원소 시너지(world, 2026-09-17 신규) — melee_attack.gd::
	## _check_elem_synergy()가 SYNERGIES를 통해 읽는다. 파일 헤더 참고.
	{ "key": "syn_fire_lit", "name": "폭발결(爆裂結)", "emoji": "💥", "max": 1, "axis": "world", "rarity": "legendary",
		"desc": "화+뇌 보석을 함께 박으면, 처치 시 반경 안 적에게 확산 피해", "eff": {} },
	{ "key": "syn_cold_chi", "name": "결빙결(結氷結)", "emoji": "❄️", "max": 1, "axis": "world", "rarity": "legendary",
		"desc": "빙+기 보석을 함께 박으면, 처치 시 반경 안 적에게 확산 피해", "eff": {} },
	{ "key": "syn_pois_emp", "name": "부식결(腐蝕結)", "emoji": "☣️", "max": 1, "axis": "world", "rarity": "legendary",
		"desc": "독+전자 보석을 함께 박으면, 처치 시 반경 안 적에게 확산 피해", "eff": {} },
]

## melee_attack.gd::_check_elem_synergy()가 읽는 시너지 표 — 세 쌍 다 같은
## 메커니즘(처치 시 확산 피해, 파일 헤더 참고)이라 반경·피해 상수도 공용이다.
const SYNERGIES: Array[Dictionary] = [
	{ "key": "syn_fire_lit", "a": "fire", "b": "lit" },
	{ "key": "syn_cold_chi", "a": "cold", "b": "chi" },
	{ "key": "syn_pois_emp", "a": "pois", "b": "emp" },
]
## 웹 5.1 원안 "반경 80"(px)을 dungeon_skills.gd가 써 온 것과 같은 환산
## 기준(BASE_REACH=34px=1m, nova·chain 반경 환산과 같은 자리)으로 옮겼다.
const SYN_RADIUS := 80.0 / 34.0  # ≈2.35m
const SYN_DAMAGE := 14.0  # 젬 원소 피해(5~8, dungeon_items.gd GEMS) 대략 두 배 — 직접 정함.


static func by_key(k: String) -> Dictionary:
	for b: Dictionary in BOONS:
		if b.key == k:
			return b
	return {}


## PLAN 101-2 DUNGEON ⑤(난입, 2026-09-17) — dungeon_run_state.gd::roll_choice()/
## _roll_one_of_axis()를 여기로 뽑았다(동작 그대로, `self.boons`였던 자리만
## 매개변수 `counts`로 바꿨다) — 난입의 즉석 3택(dungeon_horde_state.gd)이
## 영구 `boons`가 아니라 "난입 한정" 카운트(run_boons)에 대고 같은 굴림을
## 재사용해야 해서다. `exclude_keys`는 난입이 "비급"(영구 무예 점수, 되돌릴
## 수 없다)을 후보 풀에서 아예 빼는 자리 — 평소 호출(등용 없음)엔 빈 배열.
static func roll_choice(counts: Dictionary, exclude_keys: Array[String] = []) -> Array[String]:
	var out: Array[String] = []
	var axes := ["skill", "hero", "world"]
	axes.shuffle()
	for axis in axes:
		if out.size() >= 3:
			break
		var picked := _roll_one_of_axis(axis, out, counts, exclude_keys)
		if picked != "":
			out.append(picked)
	if out.size() < 3:
		var pool: Array[String] = []
		for b: Dictionary in BOONS:
			if out.has(str(b.key)) or exclude_keys.has(str(b.key)):
				continue
			if int(counts.get(b.key, 0)) < int(b.max):
				pool.append(str(b.key))
		while out.size() < 3 and pool.size() > 0:
			var idx := randi() % pool.size()
			out.append(pool[idx])
			pool.remove_at(idx)
	return out


static func _roll_one_of_axis(axis: String, exclude: Array[String], counts: Dictionary, exclude_keys: Array[String]) -> String:
	var by_rarity := {"common": [] as Array[String], "rare": [] as Array[String], "legendary": [] as Array[String]}
	for b: Dictionary in BOONS:
		if str(b.axis) != axis or exclude.has(str(b.key)) or exclude_keys.has(str(b.key)):
			continue
		if int(counts.get(b.key, 0)) >= int(b.max):
			continue
		var r: String = str(b.get("rarity", "common"))
		if not by_rarity.has(r):
			r = "common"
		by_rarity[r].append(str(b.key))
	var roll := randf() * 100.0
	var order: Array[String] = ["common", "rare", "legendary"]
	if roll >= 90.0:
		order = ["legendary", "rare", "common"]
	elif roll >= 60.0:
		order = ["rare", "common", "legendary"]
	for tier in order:
		var arr: Array[String] = by_rarity[tier]
		if arr.size() > 0:
			return arr[randi() % arr.size()]
	return ""
