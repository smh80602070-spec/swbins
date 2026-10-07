extends RefCounted

## PLAN.md 101-2 STORY ⑤(비경, 2026-09-18) — saga-web/saga-story/PLAN.md
## §5-3 "비경(祕境) — 경로 선택 미니던전 + 진입 축복 3택 + 기억 조각"을
## 3D로 옮긴다. 웹은 Phase 3(§8 로드맵)라 아직 미구현(§10 Q1 "Phase 3~5는
## 3D 트랙으로 간다")이지만, 이 트랙은 지금까지 DUNGEON ①·STORY ④처럼
## "웹 코드가 이미 돌고 있어야 한다는 뜻이 아니다" 선례를 그대로 따른다
## (dungeon_boons.gd 머리말 참고). §10 Q5(2026-09-18) "발판 기반 노드
## 지도로 한정"에 맞춰, 층마다 노드 종류별 **발판**(눈에 보이는 자리)을
## 세우고 그 위에 올라 상호작용해야 그 노드로 확정된다 — 메뉴 팝업으로
## 고르지 않는다(사가나락 던전(층 하나에 방 여러 개를 순서대로 지나는
## 구조)과 겹치지 않게).
##
## **재해석 — 축복 3택.** 원안은 "도감 인물의 서명 효과를 빌려 쓴다"지만,
## 이 포트의 인물(saga_core/data/characters.gd)은 전직 스승 표시 전용이라
## 전투 수치가 없다(story_save_state.gd 머리말 "수치 보정 없음" 참고) —
## DUNGEON ①이 "인물 축"을 부대 생존기로 재해석한 것과 같은 이유로, 여기도
## **이 판에 실제로 있는 채널**(공격/방어/유틸 3축)로 다시 짰다. eff 키는
## dungeon_boons.gd와 같은 결(Pct 단위, story_labyrinth_state.gd가 합산)이지만
## 이름은 이 판 전용 접두어 없이 그대로 둔다(다른 판과 딕셔너리를 공유하지
## 않는다 — DungeonBoons를 참조하지 않는다).
##
## 적용 eff 키: atkPct·atkSpdPct(기본 공격 쿨다운에만)·reachPct(모든 무예
## 판정 공용 _melee_hit()에서 합류)·guardPct·healOnPick(1회성)·healOnClear
## (노드 클리어마다)·moveSpdPct·rewardPct(비경 안 보물/사건 보상)·
## fragmentBonus(회차 정산 때만 합산, skillPointGrant처럼 별도 채널이 아니라
## end_run()이 그냥 _sum_eff()로 읽는다 — 1회성 소비가 필요 없어서 boons.gd
## 보다 단순하다).

const BLESSINGS: Array[Dictionary] = [
	## 공격(atk) 축
	{ "key": "fury", "name": "맹공(猛攻)", "emoji": "⚔️", "max": 5, "axis": "atk", "rarity": "common",
		"desc": "공격력 +15%", "eff": { "atkPct": 15.0 } },
	{ "key": "haste", "name": "연격(連擊)", "emoji": "💨", "max": 4, "axis": "atk", "rarity": "common",
		"desc": "기본 공격 속도 +12%", "eff": { "atkSpdPct": 12.0 } },
	{ "key": "reach", "name": "장병(長兵)", "emoji": "📏", "max": 3, "axis": "atk", "rarity": "rare",
		"desc": "공격 사거리 +20%", "eff": { "reachPct": 20.0 } },

	## 방어(def) 축
	{ "key": "wall", "name": "철벽(鐵壁)", "emoji": "🛡️", "max": 5, "axis": "def", "rarity": "common",
		"desc": "받는 피해 -12%", "eff": { "guardPct": 12.0 } },
	{ "key": "mend", "name": "회복(回復)", "emoji": "🌿", "max": 3, "axis": "def", "rarity": "common",
		"desc": "즉시 체력 20% 회복", "eff": { "healOnPick": 20.0 } },
	{ "key": "regen", "name": "재생(再生)", "emoji": "💚", "max": 3, "axis": "def", "rarity": "rare",
		"desc": "노드를 클리어할 때마다 체력 5% 회복", "eff": { "healOnClear": 5.0 } },

	## 유틸(util) 축
	{ "key": "dash", "name": "질주(疾走)", "emoji": "🏃", "max": 3, "axis": "util", "rarity": "common",
		"desc": "이동 속도 +15%", "eff": { "moveSpdPct": 15.0 } },
	{ "key": "fortune", "name": "재물운(財)", "emoji": "💰", "max": 3, "axis": "util", "rarity": "common",
		"desc": "비경 안 보물·사건 보상 +25%", "eff": { "rewardPct": 25.0 } },
	{ "key": "memory", "name": "기억(記憶)", "emoji": "💠", "max": 3, "axis": "util", "rarity": "rare",
		"desc": "이 회차를 마칠 때 기억 조각 +1", "eff": { "fragmentBonus": 1.0 } },
]


static func by_key(k: String) -> Dictionary:
	for b: Dictionary in BLESSINGS:
		if b.key == k:
			return b
	return {}


## dungeon_boons.gd roll_choice()와 같은 정신(축마다 하나씩, 모자라면 전체
## 풀에서 채움) — 다만 희귀도가 common/rare 2단뿐이라 굴림이 더 단순하다.
static func roll_choice(counts: Dictionary) -> Array[String]:
	var out: Array[String] = []
	var axes := ["atk", "def", "util"]
	axes.shuffle()
	for axis in axes:
		var picked := _roll_one_of_axis(axis, out, counts)
		if picked != "":
			out.append(picked)
	if out.size() < 3:
		var pool: Array[String] = []
		for b: Dictionary in BLESSINGS:
			if out.has(str(b.key)):
				continue
			if int(counts.get(b.key, 0)) < int(b.max):
				pool.append(str(b.key))
		while out.size() < 3 and pool.size() > 0:
			var idx := randi() % pool.size()
			out.append(pool[idx])
			pool.remove_at(idx)
	return out


static func _roll_one_of_axis(axis: String, exclude: Array[String], counts: Dictionary) -> String:
	var by_rarity := {"common": [] as Array[String], "rare": [] as Array[String]}
	for b: Dictionary in BLESSINGS:
		if str(b.axis) != axis or exclude.has(str(b.key)):
			continue
		if int(counts.get(b.key, 0)) >= int(b.max):
			continue
		var r: String = str(b.get("rarity", "common"))
		if not by_rarity.has(r):
			r = "common"
		by_rarity[r].append(str(b.key))
	var order: Array[String] = ["common", "rare"]
	if randf() >= 0.7:
		order = ["rare", "common"]
	for tier in order:
		var arr: Array[String] = by_rarity[tier]
		if arr.size() > 0:
			return arr[randi() % arr.size()]
	return ""


## §5-3 "층마다 2~3 노드 중 1 선택: 전투·정예·보물·휴식·이벤트, 5층은 보스".
## 보스는 이 풀에 없다 — story_labyrinth.gd가 마지막 층에서 노드 선택 없이
## 곧바로 세운다.
const NODE_TYPES: Array[String] = ["battle", "elite", "treasure", "rest", "event"]
const NODE_ICON := {"battle": "⚔️", "elite": "🐉", "treasure": "💰", "rest": "🏕️", "event": "❓"}
const NODE_LABEL := {"battle": "전투", "elite": "정예", "treasure": "보물", "rest": "휴식", "event": "사건"}

const FLOOR_COUNT := 5  # 노드 선택 4층 + 보스 1층


static func roll_floor_nodes() -> Array[String]:
	var pool := NODE_TYPES.duplicate()
	pool.shuffle()
	var n: int = 2 if randf() < 0.5 else 3
	var out: Array[String] = []
	for i in mini(n, pool.size()):
		out.append(pool[i])
	return out


## §5-3 "주간 변형자 1개(적 체력 +30%·보상 +50% 등)" — story_boss_spawner.gd
## `current_week()`(StorySaveState)와 같은 7일 단위 정수 몫으로 결정적으로
## 켜진다(짝수 주만, 헤드리스 진단이 이 값을 직접 넣고 뺄 수 있게).
const WEEKLY_ENEMY_HP_MUL := 1.3
const WEEKLY_REWARD_MUL := 1.5


static func weekly_modifier_active(week: int) -> bool:
	return week % 2 == 0


## §5-3 "마을 NPC에게 영구 소폭 강화(최대 HP +2% ×10단)" — 단마다 필요
## 조각이 늘어(1단 3개, 2단 6개 ... 등차) 뒷단으로 갈수록 오래 걸린다.
const MEMORY_TIER_MAX := 10
const MEMORY_HP_PCT_PER_TIER := 2.0


static func memory_upgrade_cost(tier: int) -> int:
	return (tier + 1) * 3
