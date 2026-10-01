class_name StoryCombatBase
extends RefCounted

## VERTICAL_SLICE_STORY.md 3절 — 웹판 `side.js`의 전투 판정. 급소(crit)·
## 경직(히트스톱) 상수는 원문 그대로(critRate 0.15·critMul 1.6·
## freeze 0.055초 — `core.tuned` 기본값·`game.js`의 freeze 상수).
##
## **재해석** — 웹판 `power()`는 등용한 인물(saga_core Characters,
## might/wisdom/command)에서 공격력을 뽑지만, 이 슬라이스는 아직 인물
## 로스터를 안 붙였다(VERTICAL_SLICE_STORY.md 1절 "제외" — 그건 GO의
## "등용"처럼 콘텐츠 확장 단계 몫). `side.js power()`가 인물 미선택일
## 때 쓰는 대체값(`{might:20, wisdom:10, command:15}`)을 그대로 시작
## 스탯으로 삼는다 — 새 숫자를 상상하지 않는다.

const CRIT_RATE := 0.15
const CRIT_MUL := 1.6

## side.js power()의 might=20·wisdom=10·command=15 대체값 그대로.
## atk = might*0.9 + wisdom*0.3, hp = 60 + command*6 + level*12(레벨1 고정).
const START_ATK := 21.0  # round(20*0.9 + 10*0.3) = round(21.0)
const START_HP := 162.0  # 60 + 15*6 + 1*12

## 잡졸(황건적) — data-enemy.js 첫 항목 + side.js spawnEnemy()의
## lv 공식(E_HP/E_DMG=1 기본값 그대로, core.tuned 안 건드림):
## hp=round(18*1.22^(lv-1)), dmg=round(4+lv*1.6). lv=1(field)을 넣으면
## hp=18·dmg=6 — 이 슬라이스가 처음 옮겼던 고정값과 정확히 같다(그
## 고정값의 출처가 이 공식의 lv=1 케이스였다).
##
## **2026-09-13 추가 — 몬스터 도감(사냥터별 잡졸).** 지금까지 이 lv가
## field(1) 하나로 고정이었던 것을, field/forest/cave/gorge 각 맵의
## `enemy_lv()`를 story_enemy.gd가 그대로 넘겨받아 되살린다 — side.js
## `spawnEnemy()`/`spawnBoss()`가 실제로 쓰는 것과 같은 공식이다.
static func enemy_base_hp(lv: float) -> float:
	return maxf(1.0, roundf(18.0 * pow(1.22, lv - 1.0)))


static func enemy_base_dmg(lv: float) -> float:
	return roundf(4.0 + lv * 1.6)


## **2026-09-13 추가 — 원거리 적(1절 "제외" 목록의 "원거리 적").**
## `data-side.js` RANGED_WEAPON.bow(spd 430px·range 360px·mul 0.8·cd 2.2초)
## 그대로 — px 값은 SCALE(0.02, 모든 맵 공통)로 미터 환산. 원작은 활·
## 조총 둘이 있지만, 이 포트는 사냥터마다 잡졸이 하나뿐이라(story_enemy_
## spawner.gd) **활(오랑캐 궁수, forest_map.gd) 한 종만** 옮긴다 — 조총은
## 다음에 다른 사냥터를 원거리로 바꿀 때 참고할 자리(RANGED_WEAPON.staff:
## spd 560·range 420·mul 1.0·cd 3.2).
##
## **재해석 — "다가오지 않고 멈춰서 쏜다"(holding) 갈래는 없다.** 이
## 포트의 잡졸은 애초에 추격을 안 해(story_enemy.gd 머리말, 1절 "제외")
## 제자리에서 사거리 안이면 그냥 쏜다 — 근접 접촉 피해(OVERLAP_RANGE)도
## 그대로 살아 있어, 붙어서 때리면 원거리형도 똑같이 맞는다(원작도 role
## 과 무관하게 overlap 판정은 걸린다, side.js 머리말 참고).
const RANGED_SPD_M := 8.6     # 430px * 0.02
const RANGED_RANGE_M := 7.2   # 360px * 0.02
const RANGED_MUL := 0.8
const RANGED_CD_SEC := 2.2
const RANGED_LIFE_SEC := 2.4  # side.js eshot life:2.4(초 단위라 환산 불필요)


## **2026-09-12 추가 — 무예 나머지 셋(횡소·기탄·기합).** VERTICAL_
## SLICE_STORY.md 1절 "제외" 목록의 "무예 나머지(48-1개)" 중, 무명이
## 처음부터 갖는 tier0 넷(`data-job.js` SKILLS job:'none') 나머지 셋만
## 먼저 채운다. cost·cd·mul·buff는 원문 그대로(재해석 없음). `side.js`
## MP_MAX=100·MP_REGEN=8(core.tuned('side.mpRegen', 8) 기본값) 그대로 —
## "앉아 쉬면 더 빨리 찬다"(resting 보너스)는 이번엔 안 옮긴다(입력 하나
## 더 얹는 것보다 "MP가 있어야 쓴다"는 핵심 감각부터 검증한다, 다음에
## 볼 자리).
const MP_MAX := 100.0
const MP_REGEN := 8.0  # 초당

## 횡소(橫掃) — aoe, r:117(px) = REACH(78px)*1.5. ATTACK_RANGE(2.2m,
## story_player.gd)가 REACH의 자리를 대신하므로 같은 1.5배를 그대로 곱해
## 미터로 옮긴다(원문 그대로 픽셀을 안 옮기고 "비율만" 지키는 이 포트의
## 기존 방식과 같다, VERTICAL_SLICE_STORY.md 2절).
const SWEEP_COST := 18.0
const SWEEP_CD := 4.0
const SWEEP_MUL := 1.8
const SWEEP_RANGE_MUL := 1.5  # story_player.gd ATTACK_RANGE에 곱한다

## 기탄(氣彈) — bolt(관통). 이 슬라이스가 처음 옮겨질 땐 투사체 이동
## 자체가 없어(적이 제자리에 서 있다, story_enemy.gd 머리말) "더 멀리
## 뻗는 관통 공격"으로 재해석했다 — 사거리만 늘리고(연참의 2배) 판정은
## 연참과 같은 정면 판정을 그대로 쓴다. **2026-09-13 추가 — 원거리 적이
## 생기며 투사체(story_enemy_shot.gd) 자체는 이제 있다**, 다만 이 무예는
## 플레이어가 쓰는 즉발형이라 그 투사체를 빌려 쓰지 않는다(재해석은 그대로
## 유효 — 다시 만들 이유가 없다).
const BOLT_COST := 24.0
const BOLT_CD := 6.0
const BOLT_MUL := 2.1
const BOLT_RANGE_MUL := 2.0  # story_player.gd ATTACK_RANGE에 곱한다

## 기합(氣合) — buff. sec:8·atk×1.35·speed×1.2 원문 그대로.
const BRACE_COST := 30.0
const BRACE_CD := 14.0
const BRACE_SEC := 8.0
const BRACE_ATK_MUL := 1.35
const BRACE_SPEED_MUL := 1.2

## side.js GATHER_R=50px·GATHER_RESPAWN=45초(§136-137) 그대로 — field_map.gd
## SCALE(0.02)로 미터 환산. 필드 채집(허브 등) 판정 반경·되돋는 시간.
const GATHER_RADIUS_M := 1.0  # 50px * 0.02
const GATHER_RESPAWN_SEC := 45.0

## data-side.js GATHERS 표 — 이 슬라이스는 field.gathers가 전부 herb라
## 이 하나만 옮겼었다(다른 사냥터가 늘어나면 berry/ore/cinder도 추가).
## **2026-09-13 추가(같은 날 더, 21절 다음 걸음) — 오림 숲(berry) 추가
## 당시 emoji/name을 원문(GATHERS.berry: '덤불 열매'🍇)을 안 보고 새로
## 지어냈었다("산딸기"🍓) — **같은 날 더 더(23절), 나머지 사냥터를
## 이어 지으며 발견해 바로잡는다.** ore·cinder도 이번에 원문 그대로 채움.
const GATHER_INFO := {
	"herb": {"name": "들꽃", "emoji": "🌼"},
	"berry": {"name": "덤불 열매", "emoji": "🍇"},
	"ore": {"name": "이끼 광물", "emoji": "⛏️"},
	"cinder": {"name": "그은 돌", "emoji": "🪨"},
}

## data-side.js field.boss(황건 두목) — hpMul 12·dmgMul 2.0·cool 15(분) 그대로.
## DMG_MUL은 2026-09-13(반격 추가)부터 실제로 쓰인다(story_enemy.gd
## `_physics_process()` — ENEMY_DMG에 곱한다).
##
## **2026-09-13 추가(같은 날 더) — 사냥터별 보스 배율로 옮김.** forest/
## cave/gorge는 각자 다른 hpMul·dmgMul·cool을 가진 보스라(field_map.gd·
## forest_map.gd·cave_map.gd·gorge_map.gd의 BOSS_HP_MUL 등 참고)
## story_boss_spawner.gd가 이제 이 세 값을 안 읽는다 — 여기 남겨 둔 값은
## field와 수치가 같고, map_path 없이 만들어진 story_enemy.gd 인스턴스의
## 기본값(안전값)으로만 쓰인다.
const BOSS_HP_MUL := 12.0
const BOSS_DMG_MUL := 2.0
const BOSS_COOL_SEC := 900.0  # 15분 * 60초

## **2026-09-13 추가 — 장비(1절 "제외" 목록의 "장비/노획").** 처음엔
## 무기 한 자리(목검)만 옮겼다가, 같은 날 이어서 **10부위 tier1 전부**로
## 넓혔다 — data-gear.js RAW에서 need:1인 물건 정확히 열 개(부위마다
## 하나씩). 이 슬라이스는 `field`(lv1) 하나뿐이라 need>1인 물건은
## 애초에 못 낀다 — tier2~4·주문서·고유(unique)·상점은 여전히 범위
## 밖(그 부분만 남은 "장비 나머지"). gear.js `rollDrop()`의 gearRate
## (잡졸 0.035·보스 0.9)도 그대로.
##
## **2026-09-13 추가(같은 날 더, "가방 확장" 첫 걸음) — tier2~4로 확장.**
## 나머지 사냥터(강릉진 lv5·오림 숲 등 lv12·마지막 lv20대)가 이미 갖춰져
## need가 이제 실제로 의미를 갖는다. data-gear.js RAW 40줄(부위 10×tier 4)을
## `need` 필드와 함께 그대로 옮겼다 — 새 숫자를 상상하지 않는다. 주문서·
## 고유(unique)·풀 가방+판매 UI는 여전히 범위 밖(가방 자체가 없는 이
## 포트 구조상 "물건 인스턴스별 상태"가 필요한 기능이라 별도 설계가
## 필요하다, 다음에 볼 자리).
##
## 가방이 없어 DUNGEON loot_pickup.gd처럼 **줍는 즉시 장착** — 이젠 부위당
## 물건이 넷이라 "아직 안 낀 부위"가 아니라 **이미 끼고 있는 바로 그 키**만
## 드롭 풀에서 뺀다(story_enemy.gd `_maybe_drop_gear()`) — 같은 물건이
## 다시 뜨는 것만 막고, 다른 단(tier)은 계속 뜬다(그래야 승급이 된다).
## `need`(요구 레벨)를 못 채우면 주워도 못 낀다 — `equip_gear()`가 거절.
## price는 data-gear.js RAW의 8번째 칸(gear.js priceMul() 같은 배수는
## 안 건드림) — story_merchant.gd가 그대로 읽는다.
##
## **2026-09-13 추가(같은 날 더, 주문서) — `up`(9번째 칸, 업횟 상한) 추가.**
## "주문서로 올린다"(3절 머리말) 자체를 포트하며 처음으로 이 칸이 쓰인다 —
## story_save_state.gd `scroll_left`가 장착 시 이 값으로 초기화된다.
const GEAR_POOL_LV_MARGIN := 3  # data-gear.js poolFor(lv): need <= lv+3

const GEAR_ITEMS := {
	# 무기 — 공격력은 인물 능력치에서 나오고(story_combat.gd 머리말), 무기는 그 위에 얹는다
	"sword1": {"slot": "weapon", "name": "목검(木劍)",     "need": 1,  "atk": 4.0,  "def": 0.0, "hp": 0.0,  "price": 240,   "up": 5},
	"sword2": {"slot": "weapon", "name": "환도(環刀)",     "need": 5,  "atk": 11.0, "def": 0.0, "hp": 0.0,  "price": 1100,  "up": 6},
	"sword3": {"slot": "weapon", "name": "청강검(靑鋼劍)", "need": 12, "atk": 22.0, "def": 0.0, "hp": 0.0,  "price": 4200,  "up": 7},
	"sword4": {"slot": "weapon", "name": "용린도(龍鱗刀)", "need": 20, "atk": 38.0, "def": 1.0, "hp": 0.0,  "price": 13000, "up": 7},

	# 투구
	"hat1": {"slot": "hat", "name": "가죽 두건",   "need": 1,  "atk": 0.0, "def": 2.0,  "hp": 6.0,  "price": 180,  "up": 5},
	"hat2": {"slot": "hat", "name": "철투구",      "need": 5,  "atk": 0.0, "def": 5.0,  "hp": 14.0, "price": 820,  "up": 5},
	"hat3": {"slot": "hat", "name": "봉시투구",    "need": 12, "atk": 0.0, "def": 9.0,  "hp": 26.0, "price": 3100, "up": 6},
	"hat4": {"slot": "hat", "name": "금장 갑주투", "need": 20, "atk": 1.0, "def": 15.0, "hp": 44.0, "price": 9800, "up": 7},

	# 갑옷
	"top1": {"slot": "top", "name": "무명 저고리", "need": 1,  "atk": 0.0, "def": 3.0,  "hp": 10.0, "price": 220,   "up": 5},
	"top2": {"slot": "top", "name": "가죽 갑옷",   "need": 5,  "atk": 0.0, "def": 7.0,  "hp": 22.0, "price": 980,   "up": 6},
	"top3": {"slot": "top", "name": "찰갑(札甲)",  "need": 12, "atk": 0.0, "def": 12.0, "hp": 40.0, "price": 3600,  "up": 6},
	"top4": {"slot": "top", "name": "두정갑",      "need": 20, "atk": 1.0, "def": 19.0, "hp": 66.0, "price": 11500, "up": 7},

	# 하의
	"bot1": {"slot": "bottom", "name": "무명 바지", "need": 1,  "atk": 0.0, "def": 2.0,  "hp": 8.0,  "price": 160,  "up": 5},
	"bot2": {"slot": "bottom", "name": "가죽 전군", "need": 5,  "atk": 0.0, "def": 5.0,  "hp": 16.0, "price": 760,  "up": 5},
	"bot3": {"slot": "bottom", "name": "철엽 전군", "need": 12, "atk": 0.0, "def": 9.0,  "hp": 30.0, "price": 2900, "up": 6},
	"bot4": {"slot": "bottom", "name": "용문 전군", "need": 20, "atk": 0.0, "def": 14.0, "hp": 50.0, "price": 9200, "up": 6},

	# 신
	"shoe1": {"slot": "shoes", "name": "짚신",      "need": 1,  "atk": 0.0, "def": 1.0,  "hp": 4.0,  "price": 120,  "up": 5},
	"shoe2": {"slot": "shoes", "name": "가죽 전화", "need": 5,  "atk": 0.0, "def": 4.0,  "hp": 10.0, "price": 640,  "up": 5},
	"shoe3": {"slot": "shoes", "name": "철갑 전화", "need": 12, "atk": 0.0, "def": 7.0,  "hp": 20.0, "price": 2400, "up": 6},
	"shoe4": {"slot": "shoes", "name": "비룡화",    "need": 20, "atk": 1.0, "def": 11.0, "hp": 34.0, "price": 7600, "up": 6},

	# 수갑 — 원작의 장갑이 그렇듯 공격이 조금 붙는다
	"glv1": {"slot": "glove", "name": "무명 팔찌", "need": 1,  "atk": 1.0,  "def": 1.0, "hp": 2.0,  "price": 200,   "up": 5},
	"glv2": {"slot": "glove", "name": "가죽 수갑", "need": 5,  "atk": 3.0,  "def": 3.0, "hp": 6.0,  "price": 900,   "up": 5},
	"glv3": {"slot": "glove", "name": "철갑 수갑", "need": 12, "atk": 6.0,  "def": 5.0, "hp": 12.0, "price": 3300,  "up": 6},
	"glv4": {"slot": "glove", "name": "용조 수갑", "need": 20, "atk": 11.0, "def": 8.0, "hp": 20.0, "price": 10500, "up": 7},

	# 망토
	"cap1": {"slot": "cape", "name": "베 망토",     "need": 1,  "atk": 0.0, "def": 1.0,  "hp": 8.0,  "price": 150,  "up": 5},
	"cap2": {"slot": "cape", "name": "가죽 망토",   "need": 5,  "atk": 0.0, "def": 3.0,  "hp": 18.0, "price": 700,  "up": 5},
	"cap3": {"slot": "cape", "name": "수달피 망토", "need": 12, "atk": 1.0, "def": 6.0,  "hp": 32.0, "price": 2700, "up": 6},
	"cap4": {"slot": "cape", "name": "흑룡 망토",   "need": 20, "atk": 2.0, "def": 10.0, "hp": 54.0, "price": 8900, "up": 7},

	# 반지 — 장신구, 공격 중심
	"ring1": {"slot": "ring", "name": "무명 지환", "need": 1,  "atk": 2.0,  "def": 0.0, "hp": 3.0,  "price": 160,  "up": 5},
	"ring2": {"slot": "ring", "name": "은지환",    "need": 5,  "atk": 5.0,  "def": 0.0, "hp": 8.0,  "price": 750,  "up": 5},
	"ring3": {"slot": "ring", "name": "옥지환",    "need": 12, "atk": 9.0,  "def": 1.0, "hp": 16.0, "price": 2800, "up": 6},
	"ring4": {"slot": "ring", "name": "금룡지환",  "need": 20, "atk": 16.0, "def": 2.0, "hp": 28.0, "price": 8800, "up": 7},

	# 목걸이 — 장신구, 체력 중심
	"neck1": {"slot": "necklace", "name": "나무 목걸이", "need": 1,  "atk": 0.0, "def": 1.0, "hp": 6.0,  "price": 150,  "up": 5},
	"neck2": {"slot": "necklace", "name": "은 목걸이",   "need": 5,  "atk": 0.0, "def": 2.0, "hp": 14.0, "price": 700,  "up": 5},
	"neck3": {"slot": "necklace", "name": "옥 목걸이",   "need": 12, "atk": 0.0, "def": 4.0, "hp": 26.0, "price": 2600, "up": 6},
	"neck4": {"slot": "necklace", "name": "금 목걸이",   "need": 20, "atk": 1.0, "def": 7.0, "hp": 44.0, "price": 8200, "up": 7},

	# 귀걸이 — 장신구, 공격·방어 고르게
	"ear1": {"slot": "earring", "name": "나무 귀걸이", "need": 1,  "atk": 1.0, "def": 1.0, "hp": 2.0,  "price": 150,  "up": 5},
	"ear2": {"slot": "earring", "name": "은 귀걸이",   "need": 5,  "atk": 2.0, "def": 2.0, "hp": 6.0,  "price": 700,  "up": 5},
	"ear3": {"slot": "earring", "name": "옥 귀걸이",   "need": 12, "atk": 4.0, "def": 4.0, "hp": 12.0, "price": 2600, "up": 6},
	"ear4": {"slot": "earring", "name": "금 귀걸이",   "need": 20, "atk": 7.0, "def": 7.0, "hp": 20.0, "price": 8200, "up": 7},
}

## 무기 아닌 나머지 아홉 부위 — 주문서 `for:'armor'`가 이 중 아무 데나
## 붙는다(scroll.rate 등의 정의역, story_merchant.gd `_buy_scroll()` 참고).
const ARMOR_SLOTS: Array[String] = ["hat", "top", "bottom", "shoes", "glove", "cape", "ring", "necklace", "earring"]
const GEAR_DROP_CHANCE_GRUNT := 0.035
const GEAR_DROP_CHANCE_BOSS := 0.9

## **2026-09-13 추가 — 상점 물목 화면.** data-gear.js `SLOTS` 그대로(이름·
## 이모지) — 열 부위를 이 순서로 늘어놓는다(story_merchant.gd 참고).
const SLOT_LABEL := {
	"weapon":   {"name": "무기",       "emoji": "🗡️"},
	"hat":      {"name": "투구",       "emoji": "🪖"},
	"top":      {"name": "갑옷",       "emoji": "🥋"},
	"bottom":   {"name": "전군(戰裙)", "emoji": "👖"},
	"shoes":    {"name": "전화(戰靴)", "emoji": "👢"},
	"glove":    {"name": "수갑(手甲)", "emoji": "🧤"},
	"cape":     {"name": "망토",       "emoji": "🧣"},
	"ring":     {"name": "반지",       "emoji": "💍"},
	"necklace": {"name": "목걸이",     "emoji": "📿"},
	"earring":  {"name": "귀걸이",     "emoji": "💎"},
}


## data-gear.js poolFor(lv) 그대로 — 그 사냥터 lv+3까지의 물건(부위 안 가림).
## 빈 결과가 나올 수 없는 lv(≥-2)면 그럴 일이 없지만, 원문처럼 안전망으로
## need==1(부위마다 하나씩, tier1 전부)로 대체한다.
static func gear_pool_for(lv: float) -> Array:
	var out: Array = []
	for key: String in GEAR_ITEMS:
		if int(GEAR_ITEMS[key].need) <= int(lv) + GEAR_POOL_LV_MARGIN:
			out.append(key)
	if not out.is_empty():
		return out
	for key: String in GEAR_ITEMS:
		if int(GEAR_ITEMS[key].need) == 1:
			out.append(key)
	return out


## **2026-09-13 추가(같은 날 더, "가방 확장" 다음 걸음) — 고유(固有).**
## `data-unique.js` UNIQUES 열 개 그대로: 부위마다 하나씩, tier4 밑감
## (need 20) 위에 얹는 **정해진 물건**(접사를 굴리지 않는다 — 이 판엔
## 접사 자체가 없다, 표에 적힌 값이 최종값). `base`가 그 밑감의
## GEAR_ITEMS 키 — 밑감이 그 부위의 마지막 단일 때만 고유로 바뀔 수
## 있다(원문 그대로, 낮은 단이 고유가 되면 표의 마지막 물건보다 세져
## 어색해진다는 이유). `up`(업횟 상한)도 밑감과 같은 자리 — data-unique.js
## 그대로 옮겼다.
##
## `GEAR_ITEMS`와 분리한 이유 — 여기 섞으면 `gear_pool_for()`가 일반
## 사냥터 드롭 풀에 고유를 끼워 넣어 버린다(원문은 "보스가 tier4 밑감을
## 떨굴 때만, 그것도 드물게" 대체하는 구조라 애초에 독립 풀이 아니다).
## 대신 `item_def(key)`로 두 표를 하나처럼 읽게 해 `equip_gear()`·
## `gear_totals()`·`story_gear_pickup.gd` 같은 소비 쪽은 GEAR_ITEMS와
## UNIQUE_ITEMS를 구분할 필요가 없다(gear.js `findDef()`와 같은 정신 —
## 고유가 먼저다, 밑감과 키가 겹칠 일은 없어 순서 자체는 중요하지 않다).
const UNIQUE_CHANCE := 0.16  # gear.js UNIQUE_CHANCE — 보스가 tier4 밑감을 떨굴 때 고유로 바뀔 확률

const UNIQUE_ITEMS := {
	"u_sword": {"slot": "weapon", "base": "sword4", "name": "진룡도(震龍刀)", "need": 20, "atk": 56.0, "def": 2.0, "hp": 0.0, "price": 42000, "up": 9},
	"u_hat": {"slot": "hat", "base": "hat4", "name": "봉황관(鳳凰冠)", "need": 20, "atk": 2.0, "def": 22.0, "hp": 70.0, "price": 32000, "up": 9},
	"u_top": {"slot": "top", "base": "top4", "name": "현무갑(玄武甲)", "need": 20, "atk": 2.0, "def": 28.0, "hp": 100.0, "price": 36000, "up": 9},
	"u_bottom": {"slot": "bottom", "base": "bot4", "name": "천리군(千里裙)", "need": 20, "atk": 0.0, "def": 20.0, "hp": 75.0, "price": 30000, "up": 8},
	"u_shoes": {"slot": "shoes", "base": "shoe4", "name": "분마화(奔馬靴)", "need": 20, "atk": 2.0, "def": 16.0, "hp": 50.0, "price": 26000, "up": 8},
	"u_glove": {"slot": "glove", "base": "glv4", "name": "호랑수갑(虎狼手甲)", "need": 20, "atk": 18.0, "def": 12.0, "hp": 30.0, "price": 34000, "up": 9},
	"u_cape": {"slot": "cape", "base": "cap4", "name": "봉래포(蓬萊袍)", "need": 20, "atk": 3.0, "def": 16.0, "hp": 80.0, "price": 28000, "up": 9},
	"u_ring": {"slot": "ring", "base": "ring4", "name": "구룡지환(九龍指環)", "need": 20, "atk": 26.0, "def": 3.0, "hp": 34.0, "price": 24000, "up": 8},
	"u_necklace": {"slot": "necklace", "base": "neck4", "name": "영롱주(玲瓏珠)", "need": 20, "atk": 2.0, "def": 10.0, "hp": 78.0, "price": 22000, "up": 8},
	"u_earring": {"slot": "earring", "base": "ear4", "name": "월아환(月牙環)", "need": 20, "atk": 13.0, "def": 13.0, "hp": 24.0, "price": 22000, "up": 8},
}


## GEAR_ITEMS와 UNIQUE_ITEMS를 하나처럼 읽는다 — gear.js findDef() 그대로,
## 고유가 먼저다(밑감과 키가 겹칠 일은 없어 순서는 사실 중요하지 않다).
static func item_def(key: String) -> Dictionary:
	if UNIQUE_ITEMS.has(key):
		return UNIQUE_ITEMS[key]
	return GEAR_ITEMS.get(key, {})


## 이 밑감(tier4 물건)이 고유로 바뀔 수 있다면 그 고유 key를, 없으면 ""를 준다.
static func unique_for_base(base_key: String) -> String:
	for key: String in UNIQUE_ITEMS:
		if String(UNIQUE_ITEMS[key].base) == base_key:
			return key
	return ""


## **2026-09-13 추가(같은 날 더 더, "가방 확장" 마지막 걸음) — 주문서.**
## `data-gear.js` SCROLLS 일곱 개 그대로. `for`는 'weapon'(무기 하나뿐)·
## 'armor'(나머지 아홉 부위 아무 데나, ARMOR_SLOTS). **"터지는" 규칙은
## 없다** — 원작 머리말 그대로, 실패해도 물건(이 포트는 그 슬롯의 남은
## 업횟)만 닳는다.
##
## **재해석 — 가방 없이 산다.** 원작은 사서 가방에 쌓고, 낀 물건(uid)을
## 골라 쓴다. 이 포트는 가방도 물건 인스턴스(uid)도 없어 **사는 즉시
## 적용**으로 좁힌다 — `story_merchant.gd _buy_scroll()`이 대상 슬롯
## (무기 주문서→무기, 방어구 주문서→낀 방어구 중 무작위 하나)을 그
## 자리에서 골라 바로 굴린다. 주문서를 "모아 뒀다 나중에 쓴다"는 결이
## 사라지지만, 이 포트는 처음부터 상점 자체가 "다가가면 자동 구매"라
## 같은 결의 단순화다(장비 구매와 다르지 않다).
const SCROLLS := {
	"atk100": {"for": "weapon", "rate": 1.0, "atk": 1.0, "def": 0.0, "hp": 0.0, "price": 900, "name": "공격력 주문서 100%"},
	"atk60":  {"for": "weapon", "rate": 0.6, "atk": 3.0, "def": 0.0, "hp": 0.0, "price": 1800, "name": "공격력 주문서 60%"},
	"atk10":  {"for": "weapon", "rate": 0.1, "atk": 8.0, "def": 0.0, "hp": 0.0, "price": 4200, "name": "공격력 주문서 10%"},
	"def100": {"for": "armor", "rate": 1.0, "atk": 0.0, "def": 1.0, "hp": 0.0, "price": 500, "name": "물리방어 주문서 100%"},
	"def60":  {"for": "armor", "rate": 0.6, "atk": 0.0, "def": 3.0, "hp": 0.0, "price": 1100, "name": "물리방어 주문서 60%"},
	"hp60":   {"for": "armor", "rate": 0.6, "atk": 0.0, "def": 0.0, "hp": 18.0, "price": 1300, "name": "체력 주문서 60%"},
	"hp10":   {"for": "armor", "rate": 0.1, "atk": 0.0, "def": 0.0, "hp": 55.0, "price": 3600, "name": "체력 주문서 10%"},
}


## **2026-09-13 추가 — 업적(data-achieve.js 그대로, "반복 플레이 요소").**
## `feat`(공적)는 원작에서 칭호 시스템의 연료지만 이 슬라이스엔 칭호가
## 없다 — admin.js 표시값과 같은 정신으로 그냥 누적 숫자만 저장한다
## (StorySaveState.feat, 다음에 칭호를 붙일 자리를 위해 값 자체는 쌓아 둔다).
##
## **2026-09-15 — 그 "다음"이 이거다.** `feat`가 쌓이기만 하고 어디서도
## 안 읽혀 막다른 값이었다(사가고돗 다섯 판 감사에서 발견 — FOREST
## "교배꽃"이 팔 곳이 없던 것과 같은 모양의 구멍). 원작처럼 진짜 칭호
## 시스템(칭호 목록·장착·표시 문구 갈아 끼우기)을 새로 짓는 대신, 이미
## 있는 `feat` 숫자를 문턱값으로만 읽어 HUD에 이름 하나를 보여주는
## 최소한만 얹는다(title_label.gd) — 장착·해제 개념 없이 지금 값에 맞는
## 것 하나만 항상 뜬다.
##
## **2026-09-16 확인 — "원작처럼 장착식"은 애초에 없는 것이었다.**
## 웹판 `js/ui.js`의 `titleOf(featTotal)`을 다시 보니, 원작도 정확히
## 이 슬라이스와 같은 모양(문턱값 하나 넘으면 이름 하나, 장착·해제·목록
## 없음)이다 — `js/core.js`의 `feat`/`featTotal`도 `gainFeat()`에서
## 항상 같이만 오르고 어디서도 안 깎인다(장착에 쓰는 "재화"가 아니다).
## 즉 지금 구현이 이미 원작에 충실한 포팅이다 — 장착식으로 "발전"시킬
## 원작 기능 자체가 없다. 대신 문턱 이름을 원작 `TITLES`(7단, 無名→
## 有司→校尉→將軍→太守→諸侯→霸王)에서 그대로 가져와 바꿨다 — 원작
## 숫자(30~4000)는 반복 사냥으로 무한히 쌓이는 `featTotal` 기준이라
## 이 슬라이스의 업적 8개짜리 유한한 `feat`(최대 215, 아래 참고)엔 안
## 맞아 문턱값 자체는 유지한다(6단 → 7단으로 하나 늘려 마지막 霸王을
## "업적 8개 전부"에만 정확히 닿게 잡았다).
const TITLES := [
	{"at": 0,   "name": "무명(無名)"},
	{"at": 20,  "name": "유사(有司)"},
	{"at": 60,  "name": "교위(校尉)"},
	{"at": 100, "name": "장군(將軍)"},
	{"at": 150, "name": "태수(太守)"},
	{"at": 190, "name": "제후(諸侯)"},
	{"at": 215, "name": "패왕(霸王)"},   # 업적 8개 전부(합계 215)를 채워야만 닿는다
]


## feat 값에 맞는 칭호 하나(문턱을 넘은 것 중 가장 높은 것) — TITLES는
## at 오름차순이 전제다.
static func title_for(feat: int) -> String:
	var name := String(TITLES[0].name)
	for t: Dictionary in TITLES:
		if feat >= int(t.at):
			name = String(t.name)
	return name
##
## **처음엔 9개 중 7개만 옮겼었다** — `a_dex20`·`a_quest10` 둘은 그때
## 그 값 자체가 없었다. **2026-09-13 정정** — `a_dex20`(도감 등록 수)을
## "몬스터 도감"이라고 적었던 건 틀렸다: 원문 valueOf()는 실제로
## `core.save.dex.heroes/pets`(인물·펫 등용 로스터)를 본다 — 이 슬라이스엔
## 인물 로스터 자체가 없어(story_combat.gd 맨 위 머리말) 여전히 못
## 옮긴다. **`a_quest10`은 이제 옮길 수 있다** — 아래 QUESTS가 여덟에서
## 열하나로 늘어 `StorySaveState.quests_done.size()`가 원작 "사명
## 10번 완료"의 좋은 근사가 됐다(원작은 반복 사명의 `done` 누적까지
## 세지만, 이 포트는 반복 사명이 없어 "완료한 사명 종류 수"로 좁힌다).
const ACHIEVES := {
	"a_kill100":  {"name": "백부장", "need": 100, "feat": 15, "emoji": "⚔️"},
	"a_kill500":  {"name": "살성(殺星)", "need": 500, "feat": 40, "emoji": "💀"},
	"a_boss5":    {"name": "토벌장", "need": 5, "feat": 30, "emoji": "👺"},
	"a_lv10":     {"name": "한 사람 몫", "need": 10, "feat": 15, "emoji": "🌱"},
	"a_lv30":     {"name": "노련한 몸", "need": 30, "feat": 50, "emoji": "🌳"},
	"a_gold5000": {"name": "군자금", "need": 5000, "feat": 20, "emoji": "🪙"},
	"a_gear7":    {"name": "온몸 무장", "need": 7, "feat": 25, "emoji": "🛡️"},
	"a_quest10":  {"name": "믿을 만한 사람", "need": 10, "feat": 20, "emoji": "📋"},
}


## **2026-09-13 추가 — 사명(퀘스트) 게시판.** data-quest.js QUESTS 20개 중
## **처음엔 8개, 사냥터별 킬 수 셋(q_field/q_forest/q_cave)을 더해 11개,
## q_explore1을 더해 12개, q_talk1을 더해 13개**가 됐다 — 이 슬라이스가
## 이미 가진 누적값(kill/gather/gear/boss/skill/gold/stage_kills/
## visited_stages/talks)만으로 바로 판정 가능한 것만 골랐다. 나머지
## 일곱(반복 5개·일일 2개)은 **한 번만 완수하는 이 QUESTS와 판정 방식이
## 달라 REPEAT_QUESTS(아래)로 따로 뒀다** — 자세한 재해석은 그쪽 머리말
## 참고. reward의 `potion`(탕약)은 전부 뺐다 — 이 포트엔 그 시스템 자체가
## 없다(RANGED_WEAPON.staff와 같은 결, 값이 생기면 채운다). `scroll`은
## 있는 그대로 옮겼다(story_save_state.gd `_grant_quest_scroll()` 참고).
## `stage`가 있으면(q_field 등) `_quest_value()`가 전체 kills 대신
## stage_kills[stage]를 본다(각 맵의 `stage_key()` 참고).
##
## **2026-09-13 추가(같은 날 더, q_explore1) — "visit".** data-quest.js
## goal.type:'visit'은 "서로 다른 사냥터를 밟은 집합의 크기"를 본다(같은
## 곳을 몇 번 다시 밟아도 안 늘어난다) — story_save_state.gd
## visited_stages(Dictionary, 밟은 stage_key 집합) 참고. 원작 STAGES에
## 사냥터가 field/forest/cave/gorge 넷뿐이라(마을은 STAGES 밖) n:4는
## "네 사냥터를 다 밟으면 끝"과 정확히 같다.
##
## **2026-09-13 추가(같은 날 더 더, q_talk1) — "talk".** data-quest.js
## goal.type:'talk'은 "말 건 횟수"를 그냥 누적한다(원작 onTalk()도 같은
## NPC에게 반복해 말해도 매번 센다 — visit과 달리 집합이 아니다).
## story_save_state.gd talks(누적 카운트)·add_talk() 참고. 이 슬라이스는
## 아직 대화 NPC가 허도의 파수병(story_talk_npc.gd) 하나뿐이라, 그
## 하나에게 다섯 번 말을 걸어도 원작과 똑같이 완수된다.
const QUESTS := {
	"q_first":    {"name": "첫 사냥",       "need": 1,  "goal_type": "kill",   "n": 10,   "exp": 60,   "gold": 200,  "scroll": ""},
	"q_gather1":  {"name": "약초 캐기",     "need": 2,  "goal_type": "gather", "n": 15,   "exp": 140,  "gold": 400,  "scroll": ""},
	"q_field":    {"name": "들판을 비운다", "need": 3,  "goal_type": "kill",   "n": 40,   "stage": "field",  "exp": 220,  "gold": 700,  "scroll": "def100"},
	"q_gear1":    {"name": "몸을 갖춘다",   "need": 4,  "goal_type": "gear",   "n": 3,    "exp": 180,  "gold": 600,  "scroll": ""},
	"q_boss1":    {"name": "두목의 목",     "need": 5,  "goal_type": "boss",   "n": 1,    "exp": 400,  "gold": 1200, "scroll": "atk60"},
	"q_forest":   {"name": "오림의 그늘",   "need": 6,  "goal_type": "kill",   "n": 60,   "stage": "forest", "exp": 700,  "gold": 2000, "scroll": ""},
	"q_explore1": {"name": "길을 넓힌다",   "need": 7,  "goal_type": "visit",  "n": 4,    "exp": 320,  "gold": 900,  "scroll": "hp60"},
	"q_talk1":    {"name": "민심을 살핀다", "need": 3,  "goal_type": "talk",   "n": 5,    "exp": 160,  "gold": 450,  "scroll": ""},
	"q_job":      {"name": "길을 정한다",   "need": 10, "goal_type": "skill",  "n": 1,    "exp": 500,  "gold": 1500, "scroll": "hp60"},
	"q_gold1":    {"name": "군자금",        "need": 8,  "goal_type": "gold",   "n": 8000, "exp": 600,  "gold": 0,    "scroll": "atk10"},
	"q_cave":     {"name": "굴혈로",        "need": 12, "goal_type": "kill",   "n": 90,   "stage": "cave",   "exp": 1800, "gold": 5000, "scroll": "def60"},
	"q_gear2":    {"name": "온몸을 갖춘다", "need": 14, "goal_type": "gear",   "n": 7,    "exp": 2200, "gold": 6000, "scroll": "hp10"},
	"q_master":   {"name": "무예를 익힌다", "need": 18, "goal_type": "skill",  "n": 20,   "exp": 3000, "gold": 8000, "scroll": "atk10"},
}


## **2026-09-13 추가(같은 날 더 더 더) — 반복/일일 사명.** data-quest.js
## 나머지 일곱(r_*(반복 다섯)·d_*(일일 둘)) **전부**를 옮긴다.
## **재해석** — 원작은 게시판에서 "받기"를 누르고, 조건을 채운 뒤
## "바치기"를 눌러야 보상을 받고 다시 받을 수 있게 된다(quest.js
## take()/turnIn()). 이 포트엔 그 게시판 UI가 없어(위 QUESTS 머리말과
## 같은 이유) 대신 **"지난 완수 이후로 그 값이 n만큼 늘 때마다 자동으로
## 다시 완수하는 반복 문턱"**으로 좁혔다 — story_save_state.gd
## `repeat_progress`(key→마지막 완수 시점 스냅샷)가 그 기준선이고,
## `_check_repeat_quests()`가 `_quest_value(q) - baseline >= n`이 되는
## 순간마다 보상을 주고 baseline을 그 시점 값으로 다시 올린다(원작
## `turnIn()`이 `r.n`을 0으로 되돌리는 것과 같은 효과 — n을 넘은
## 나머지는 다음 판으로 안 넘어간다). `daily:true` 둘은
## `daily_done_day`(key→day index)로 하루 한 번만 걸러진다.
##
## **정정(2026-09-13, 다음 세션) — `r_purse`를 "gold는 스냅샷이라 못
## 옮긴다"고 뺐던 건 틀렸다.** 그 근거("gold가 한 번 4000을 넘으면
## 매번 다시 완수돼 버린다")는 baseline을 매번 0에 고정한 채 "지금
## gold>=n인가"만 보는 잘못된 구현을 가정한 것이었다 — 실제로 짠
## `_check_repeat_quests()`는 baseline을 **완수 시점의 현재값**으로
## 매번 올리므로(바로 위 문단), gold처럼 오르내리는 값이라도 "마지막
## 완수 이후 n만큼 더 늘었는가"를 정확히 본다. gold가 늘었다 줄었다
## 해도 델타 기준이라 과도하게 자주 터지지 않는다 — kill/boss/gather/
## talk과 다를 게 없었다. 그래서 이제 **일곱 전부** 옮긴다.
const REPEAT_QUESTS := {
	"r_hunt":   {"name": "토벌령(討伐令)", "need": 3, "goal_type": "kill",   "n": 30,   "exp": 260, "gold": 900,  "scroll": "",      "daily": false},
	"r_boss":   {"name": "수급(首級)",     "need": 7, "goal_type": "boss",   "n": 2,    "exp": 900, "gold": 2600, "scroll": "def60", "daily": false},
	"r_purse":  {"name": "군량 조달",      "need": 9, "goal_type": "gold",   "n": 4000, "exp": 700, "gold": 0,    "scroll": "",      "daily": false},
	"r_forage": {"name": "약재 상납",      "need": 4, "goal_type": "gather", "n": 20,   "exp": 240, "gold": 500,  "scroll": "",      "daily": false},
	"r_talk":   {"name": "민심 순회",      "need": 6, "goal_type": "talk",   "n": 8,    "exp": 300, "gold": 600,  "scroll": "",      "daily": false},
	"d_hunt":   {"name": "일일 토벌",      "need": 2, "goal_type": "kill",   "n": 20, "exp": 500, "gold": 1500, "scroll": "",      "daily": true},
	"d_gather": {"name": "일일 채집",      "need": 2, "goal_type": "gather", "n": 12, "exp": 350, "gold": 800,  "scroll": "",      "daily": true},
}


## **2026-09-13 추가(같은 날 더 더, q_talk1) — 대화 전용 NPC 대사.**
## data-side.js NPC_TALK 그대로 옮긴다(merchant는 뺐다 — 그건
## story_merchant.gd가 이미 상점 기능으로 맡고 있어 "대사만 있는" 이
## 표엔 안 넣는다). story_talk_npc.gd가 npc_key로 조회해 무작위로 한
## 줄 보여 준다.
const NPC_TALK := {
	"elder": {"name": "촌로", "emoji": "🧓", "lines": [
		"난리 통에도 사람 사는 꼴은 여전하구먼.",
		"젊은이, 무예를 부지런히 닦게. 몸이 그 값을 한다네.",
		"이 근방 사냥터마다 우두머리가 하나씩 있다고 들었네 — 조심하시게.",
		"들판에 나가면 캐 갈 것이 제법 있을 걸세.",
	]},
	"guard": {"name": "파수병", "emoji": "🛡️", "lines": [
		"앞쪽 사냥터는 만만치 않네. 채비는 갖췄는가?",
		"두목급은 한동안 다시 안 나온다니, 잡았으면 다른 곳부터 도시게.",
		"이 성 안에서는 걱정 말게, 아무도 안 덤빈다네.",
		"전직할 뜻이 있으면 서두르게. 무예는 일찍 닦을수록 낫네.",
	]},
	"healer": {"name": "의원", "emoji": "⚕️", "lines": [
		"체력이 다하기 전에 탕약부터 찾으시게.",
		"몸을 갖추는 것도 중요하지만 쉬어 가는 것도 중요하네.",
		"앉아 쉬면 체력과 기력이 차네 — 곁에 아무도 없을 때 말일세.",
		"다치는 건 순간이나 낫는 건 더디니 조심하시게.",
	]},
	"wanderer": {"name": "나그네", "emoji": "🥾", "lines": [
		"이곳저곳 떠돌다 보니 별별 것을 다 보네.",
		"드물게 희귀한 것들이 나온다더군 — 운이 좋으면 마주칠 걸세.",
		"보물상자를 봤다는 소문이 있던데, 사실인지는 모르겠네.",
		"길을 넓히려면 여러 곳을 밟아 봐야 하는 법이지.",
	]},
}


## **2026-09-13 추가 — 상점(1절 "제외" 목록 "장비 나머지"의 첫 걸음).**
## side.js kill()의 금 계산 그대로: gold = round((6+lv*3)*(0.8~1.4)*mul*
## GAIN_GOLD). GAIN_GOLD(core.tuned 기본 배수)는 1.0 그대로(손잡이 자체를
## 아직 안 옮겼다). mul은 보스 12·그 외 1.
##
## **2026-09-13 추가(같은 날 더, 몬스터 도감) — lv를 인자로 받는다.**
## 지금까지 lv가 이 상수(field.enemyLv=1) 하나로 고정이었던 것을,
## story_enemy.gd가 자기 맵의 enemy_lv를 넘기도록 바꿨다(forest/cave/
## gorge 킬이 이제 그 사냥터 lv 기준 금·경험치를 준다).
const ENEMY_GOLD_BASE := 6.0
const ENEMY_GOLD_PER_LV := 3.0
const BOSS_GOLD_MUL := 12.0
const GAIN_GOLD := 1.0

## side.js hurtMe()가 쓰는 gear.js cut(def) 그대로: min(0.6, def/(def+40)).
## amount *= (1 - cut) 형태로 적용한다 — story_player.gd take_damage() 참고.
static func damage_cut(def: float) -> float:
	if def <= 0.0:
		return 0.0
	return minf(0.6, def / (def + 40.0))


## 낀 물건 키 목록(equipped.values())에서 atk/def/hp 합을 뽑는다 —
## power()의 gearBonus()와 같은 자리(story_player.gd·story_save_state.gd
## 둘 다 이 셋을 쓴다). item_def()라 고유(UNIQUE_ITEMS) 키가 껴 있어도
## 그대로 잡힌다.
static func gear_totals(equipped_keys: Array) -> Dictionary:
	var atk := 0.0
	var def := 0.0
	var hp := 0.0
	for key: String in equipped_keys:
		var it: Dictionary = item_def(key)
		atk += float(it.get("atk", 0.0))
		def += float(it.get("def", 0.0))
		hp += float(it.get("hp", 0.0))
	return {"atk": atk, "def": def, "hp": hp}


## side.js kill()의 gold 계산 그대로(위 상수 참고) — Math.round와 같게
## roundi를 쓴다.
static func roll_gold(is_boss: bool, lv: float) -> int:
	var mul: float = BOSS_GOLD_MUL if is_boss else 1.0
	var variance: float = 0.8 + randf() * 0.6
	return roundi((ENEMY_GOLD_BASE + lv * ENEMY_GOLD_PER_LV) * variance * mul * GAIN_GOLD)


## **2026-09-13 추가 — 전직 트리(4절 "제외" 목록)의 첫 걸음: 레벨/경험치.**
## 원작(`data-job.js`)의 전직은 레벨 문턱(1차 Lv.10)에 걸려 있는데, 이
## 슬라이스는 지금까지 레벨이 늘 1로 고정이었다(story_save_state.gd의
## `level`/`exp` 필드는 세이브 스키마에만 있고 아무도 안 채웠다) — 그래서
## 전직 자체보다 먼저 이 밑바탕을 채운다. `core.js` `gainExp()`/`expNeed()`
## 그대로: 경험치는 랜덤 없이 결정적(금과 달리 variance가 없다).
const EXP_BASE := 50.0
const EXP_GROWTH := 1.28
const ENEMY_EXP_BASE := 6.0
const ENEMY_EXP_PER_LV := 4.0
const BOSS_EXP_MUL := 15.0
const GAIN_EXP := 1.0

## core.js expNeed(level) = round(50 * 1.28^(level-1)) 그대로.
static func exp_need(level: int) -> int:
	return roundi(EXP_BASE * pow(EXP_GROWTH, float(level - 1)))


## core.js kill()의 gainExp 호출 인자 그대로: (6+lv*4)*(boss?15:1)*GAIN_EXP.
static func enemy_exp(is_boss: bool, lv: float) -> int:
	var mul: float = BOSS_EXP_MUL if is_boss else 1.0
	return roundi((ENEMY_EXP_BASE + lv * ENEMY_EXP_PER_LV) * mul * GAIN_EXP)


## **1차 전직(Lv.10) 넷** — data-job.js JOBS tier:1 그대로(grow만 옮긴다,
## 그 자리에서 새로 열리는 무예 넷씩(총 16개)은 범위 밖 — 다음 걸음).
## key: {name, grow:{hp,atk,mp}}.
const JOBS_TIER1 := {
	"warrior": {"name": "무사(武士)", "hp": 40.0, "atk": 2.0, "mp": 0.0},
	"archer":  {"name": "궁수(弓手)", "hp": 10.0, "atk": 5.0, "mp": 0.0},
	"rogue":   {"name": "협객(俠客)", "hp": 18.0, "atk": 4.0, "mp": 0.0},
	"mage":    {"name": "방사(方士)", "hp": 12.0, "atk": 3.0, "mp": 40.0},
}
const JOB_CHANGE_LEVEL := 10

## **2026-09-13 추가 — 2~4차 전직(job 체인 재설계).** data-job.js JOBS는
## 실제로 갈래마다(무사→장군→원수→전신 등) `from`으로 이어지는 사슬 넷
## (서로 안 섞인다)이다. `job`은 여전히 문자열 하나뿐이고(전과 같다 —
## 원작 `job.js join()`도 그냥 덮어쓴다) 대신 이 사슬 정보를 데이터로
## 들여, `job_chain()`이 "이 job이 어느 사슬 위에 있는지"를 훑을 수 있게
## 한다 — story_player.gd의 여러 `job=="warrior"` 분기가 이제 이 사슬
## 소속 여부로 바뀐다(전직해도 하위 무예를 잃지 않는다, data-job.js
## skillsOf()의 chain-walk과 같은 정신).
##
## **무예 자체(6개씩×3단×4갈래=72개)는 이번 걸음 밖** — 그래서 tier2
## (장군 등)는 실제로 진급까지 열리지만, tier3·4는 `job.js canJoin()`의
## "하위 무예가 lv5/8/10 이상 하나 있어야 한다"(JOB_SKILL_LEVEL_GATE)
## 조건이 `JOB_SKILL_KEYS`에 tier2+ 항목이 아직 없어 자연히 못 채워진다
## (거짓으로 막지 않고 데이터가 없어 그냥 안 열린다) — tier2 무예가
## 생기기 전까지는 tier3 진급이 정직하게 막혀 있다.
const JOB_FROM := {
	"general": "warrior", "sniper": "archer", "assassin": "rogue", "sage": "mage",
	"marshal": "general", "flier": "sniper", "wraith": "assassin", "immortal": "sage",
	"warlord": "marshal", "falcon": "flier", "reaper": "wraith", "ascendant": "immortal",
}
const JOB_TIER := {
	"none": 0,
	"warrior": 1, "archer": 1, "rogue": 1, "mage": 1,
	"general": 2, "sniper": 2, "assassin": 2, "sage": 2,
	"marshal": 3, "flier": 3, "wraith": 3, "immortal": 3,
	"warlord": 4, "falcon": 4, "reaper": 4, "ascendant": 4,
}
const JOB_LEVEL_NEED := {
	"general": 25, "sniper": 25, "assassin": 25, "sage": 25,
	"marshal": 45, "flier": 45, "wraith": 45, "immortal": 45,
	"warlord": 70, "falcon": 70, "reaper": 70, "ascendant": 70,
}

## data-job.js JOBS의 tier2~4 grow(hp/atk/mp) 그대로 — JOBS_TIER1과 같은
## {name, hp, atk, mp} 모양.
const JOBS_TIER2 := {
	"general":  {"name": "장군(將軍)", "hp": 110.0, "atk": 7.0, "mp": 0.0},
	"sniper":   {"name": "신궁(神弓)", "hp": 40.0, "atk": 14.0, "mp": 0.0},
	"assassin": {"name": "자객(刺客)", "hp": 55.0, "atk": 11.0, "mp": 0.0},
	"sage":     {"name": "도사(道士)", "hp": 45.0, "atk": 9.0, "mp": 90.0},
}
const JOBS_TIER3 := {
	"marshal":  {"name": "원수(元帥)", "hp": 190.0, "atk": 13.0, "mp": 0.0},
	"flier":    {"name": "비장(飛將)", "hp": 70.0, "atk": 26.0, "mp": 0.0},
	"wraith":   {"name": "귀영(鬼影)", "hp": 95.0, "atk": 20.0, "mp": 0.0},
	"immortal": {"name": "진인(眞人)", "hp": 80.0, "atk": 17.0, "mp": 160.0},
}
const JOBS_TIER4 := {
	"warlord":   {"name": "전신(戰神)", "hp": 300.0, "atk": 20.0, "mp": 0.0},
	"falcon":    {"name": "궁성(弓聖)", "hp": 115.0, "atk": 39.0, "mp": 0.0},
	"reaper":    {"name": "명왕(冥王)", "hp": 155.0, "atk": 30.0, "mp": 0.0},
	"ascendant": {"name": "천존(天尊)", "hp": 130.0, "atk": 26.0, "mp": 260.0},
}

## job.js canJoin()의 tier별 무예 레벨 문턱(하위 무예 하나가 이 이상이어야
## 그 tier로 진급 가능) — tier2:5, tier3:8, tier4:10 그대로.
const JOB_SKILL_LEVEL_GATE := {2: 5, 3: 8, 4: 10}


static func job_tier(key: String) -> int:
	return int(JOB_TIER.get(key, 0))


static func job_info(key: String) -> Dictionary:
	if JOBS_TIER1.has(key):
		return JOBS_TIER1[key]
	if JOBS_TIER2.has(key):
		return JOBS_TIER2[key]
	if JOBS_TIER3.has(key):
		return JOBS_TIER3[key]
	if JOBS_TIER4.has(key):
		return JOBS_TIER4[key]
	return {"name": key, "hp": 0.0, "atk": 0.0, "mp": 0.0}


## key(자기 포함)에서 'none'까지 이어지는 사슬 — data-job.js skillsOf()의
## chain-walk 그대로(tier1은 JOB_FROM에 없어 get()의 기본값 "none"으로
## 바로 끊긴다).
static func job_chain(key: String) -> Array:
	var out: Array = []
	var cur := key
	while cur != "" and cur != "none":
		out.append(cur)
		cur = String(JOB_FROM.get(cur, "none"))
	return out


## job.js grow()의 chain-sum 그대로 — 사슬 위 모든 tier의 grow를 더한다.
static func job_grow_chain(key: String) -> Dictionary:
	var hp := 0.0
	var atk := 0.0
	var mp := 0.0
	for k: String in job_chain(key):
		var it: Dictionary = job_info(k)
		hp += float(it.get("hp", 0.0))
		atk += float(it.get("atk", 0.0))
		mp += float(it.get("mp", 0.0))
	return {"hp": hp, "atk": atk, "mp": mp}


## job.js canJoin()의 `j.from === core.save.job` 그대로 — key로 진급하려면
## 지금 이 job이어야 한다.
static func job_prereq(key: String) -> String:
	return String(JOB_FROM.get(key, "none"))


static func job_level_need(key: String) -> int:
	if JOBS_TIER1.has(key):
		return JOB_CHANGE_LEVEL
	return int(JOB_LEVEL_NEED.get(key, 999999))


static func job_advance_skill_gate(key: String) -> int:
	return int(JOB_SKILL_LEVEL_GATE.get(job_tier(key), 0))


## key에서 바로 다음(한 단계 위) job — 갈래가 안 갈리므로 항상 최대 하나.
## 없으면(예: tier4 극) 빈 문자열.
static func job_next(key: String) -> String:
	for k: String in JOB_FROM:
		if String(JOB_FROM[k]) == key:
			return k
	return ""


## key가 속한 갈래의 tier1 뿌리(warrior/archer/rogue/mage) — job_chain()의
## 마지막 항. PLAN 101-2 STORY ③후보(직업 정체성)의 "스승 인물"이 갈래
## 단위로 고정되게 쓴다.
static func job_root(key: String) -> String:
	var chain := job_chain(key)
	return String(chain[-1]) if not chain.is_empty() else key


## **2026-09-17 추가 — PLAN 101-2 STORY ③후보(웹판 §5-1 "직업 정체성 —
## 스승 인물").** 이 슬라이스는 아직 `saga_core Characters`(인물 105)를
## 한 번도 안 붙였다(이 파일 머리말 "인물 로스터를 아직 안 붙였다") — 이
## 자리가 STORY의 첫 연결이다. 웹판은 "스승이 도감(등용)에 있으면 고유
## 조작 수치가 오른다"고 하지만, STORY엔 등용·도감 개념 자체가 없어(GO의
## `hero_encounter`·REALM의 `roster` 같은 것이 없다) 그 수치 보정은 뺐다
## — 전직 때 초상 대신 이름·대사 1줄만 보여주는 **순수 장식**으로
## 좁혔다. (갈래, tier) 16쌍마다 문자 해시로 HEROES 105명 중 한 명을
## 결정적으로 고른다(새 인물을 짓지 않는다, REALM `realm_traits.gd`
## `_stable_hash`와 같은 방식).
const Characters := preload("res://saga_core/data/characters.gd")


static func mentor_of(key: String) -> Dictionary:
	var root := job_root(key)
	var tier := maxi(1, job_tier(key))
	var seed_str := root + "#" + str(tier)
	var h := 5381
	for i in range(seed_str.length()):
		h = (h * 33 + seed_str.unicode_at(i)) & 0x7fffffff
	var heroes: Array = Characters.HEROES
	return heroes[h % heroes.size()]


## ── PLAN 101-2 STORY ③후보 — 갈래별 고유 조작(웹판 §5-1) ──────────
## 회피 버튼(`story_dash`, Shift)을 길게 누르면(대시는 press 즉시 그대로
## 나가는 별개 이벤트라 안 겹친다) 갈래별 고유 조작이 하나 더 나온다.
## 웹판 "효과 9 밖의 조작"을 좇아 새 효과를 만들지 않고 전부 기존 채널
## (한 방짜리 다음 공격 배율 `_signature_next_mul`·기존 무적 채널
## `_invuln_time_left`)에만 얹는다 — 궁수만 "누르는 동안 차징 → 뗄 때
## 발동"이라 즉시 발동인 나머지 셋과 다르다.
const SIGNATURE_HOLD_SEC := 0.35   # 웹판 "길게 누름(0.18s)"보다 넉넉히(실기 확인 전 임시)
const SIGNATURE_COOLDOWN := 6.0    # 웹판 "고유 조작 쿨 6s(공통)"
const SIGNATURE_MP_COST := 12.0    # 웹판 "기력 12"

## 무사 받아치기(w_parry) — 판정 창 0.25s 안에 맞으면 무효 + 다음 공격 ×1.5.
const WARRIOR_PARRY_SEC := 0.25
const WARRIOR_PARRY_NEXT_MUL := 1.5

## 궁수 당기기(a_draw) — 누른 시간 0.4~1.2s에 따라 다음 공격 위력 ×1.0~2.2,
## 차징 중 이동속도 40%(웹판 그대로). 관통(+1)은 이 슬라이스에 사거리별
## 관통 수 자체가 없어(story_combat.gd에 그런 필드가 없다) 뺐다.
const ARCHER_DRAW_MIN_SEC := 0.4
const ARCHER_DRAW_MAX_SEC := 1.2
const ARCHER_DRAW_MIN_MUL := 1.0
const ARCHER_DRAW_MAX_MUL := 2.2
const ARCHER_DRAW_MOVE_MUL := 0.4

## 협객 그림자 걷기(r_shadow) — 0.5s 무적 이동 + 다음 공격 ×1.8("적 통과"는
## 이 슬라이스가 이미 적과 몸이 안 부딪히는 판정이라(원거리 판정 위주) 그
## 자체로 자연히 만족된다 — 따로 손댈 콜리전이 없다).
const ROGUE_SHADOW_INVULN_SEC := 0.5
const ROGUE_SHADOW_NEXT_MUL := 1.8

## 방사 원소 전환(m_element) — 다음 3발 각각에 속성을 입히는 원문 대신,
## "다음 한 발"에 속성 표시 + 약한 배율만 얹는다(웹판 "적 데이터에 칸을
## 만들지 않는다"는 절제를 이어받아 지속피해·둔화·연쇄 같은 새 상태
## 자체를 안 만든다 — 재해석). 3원소를 활성화마다 돌아가며 하나씩 쓴다.
const MAGE_ELEMENT_NEXT_MUL := 1.15
const MAGE_ELEMENTS: Array[String] = ["fire", "ice", "lightning"]
const MAGE_ELEMENT_NAME := {"fire": "불", "ice": "얼음", "lightning": "번개"}

## 갈래별 고유 조작 이름 — 전직 트레이너 안내문 한 줄에 쓴다.
const SIGNATURE_NAME := {
	"warrior": "받아치기", "archer": "당기기",
	"rogue": "그림자 걷기", "mage": "원소 전환",
}

## **2026-09-13 추가(같은 날 더) — 전직 트리 다음 걸음: 무사(warrior)
## 무예 넷.** data-job.js SKILLS job:'warrior' 넷(w_cut/w_whirl/w_rush/
## w_iron).
##
## w_whirl의 r:128px는 SWEEP_RANGE_MUL(117/78=1.5)과 같은 방식으로
## REACH(78px, story_player.gd ATTACK_RANGE 자리)비로 옮긴다: 128/78.
## w_rush의 dist:210px는 SCALE(field_map.gd와 같은 0.02)로 미터 환산.
##
## **2026-09-13 추가(같은 날 더 더) — SP(무예 점수) 투자 시스템.**
## 지금까지 `FIXED_SKILL_LEVEL`(5, 임의의 중간값)로 mul을 고정해 뒀던 것을
## 실제 투자 레벨로 바꾼다 — `data-job.js` 머리말의 "레벨마다 3점을 찍어
## 무예를 0~10으로 올린다"를 `StorySaveState.skills`(key→레벨)로 옮기고,
## `job.js` `mulOf()`(mul[0]+mul[1]*max(0,lv-1))의 재해석을 그대로
## 이어간다 — 이 포트는 처음부터 (lv-1)이 아니라 lv를 그대로 곱하는
## 결로 갔었으니(과거 FIXED_SKILL_LEVEL 주석들) 그 관례를 유지한다:
## `skill_mul(base, per, lv) = base + per*lv`. **투자 0(안 배운 무예)은
## 아예 못 쓴다** — 원작 `job.js bar()`가 "찍은 것만" 조작 띠에 놓는 것과
## 같은 자리(story_player.gd 각 `_cast_*` 함수 맨 앞에서 확인).
const SKILL_MAX_LEVEL := 10
const SP_PER_LEVEL := 3  # data-job.js SP_PER_LEVEL 그대로

## key → job. StorySaveState.can_raise_skill()이 "이 직업의 무예가
## 맞는지" 확인할 때 쓴다(job.js canRaise()의 `JD.skillsOf(job)` 자리).
const SKILL_JOB := {
	"w_cut": "warrior", "w_whirl": "warrior", "w_rush": "warrior", "w_iron": "warrior",
	"a_shot": "archer", "a_double": "archer", "a_pierce": "archer", "a_eye": "archer",
	"r_twin": "rogue", "r_knife": "rogue", "r_step": "rogue", "r_vital": "rogue",
	"m_fire": "mage", "m_bolt": "mage", "m_heal": "mage", "m_talis": "mage",
	## **2026-09-13 추가(같은 날 더 더) — tier2 무예 열둘.** 아래 SKILL_NEED
	## 머리말 참고.
	"g_smash": "general", "g_roar": "general", "g_wall": "general",
	"s_rain": "sniper", "s_snipe": "sniper", "s_split": "sniper",
	"x_storm": "assassin", "x_fan": "assassin", "x_shadow": "assassin",
	"p_quake": "sage", "p_beam": "sage", "p_ward": "sage",
	## **2026-09-13 추가(같은 날 더 더 더) — tier1 다섯째·여섯째 여덟.**
	## 아래 JOB_SKILL_KEYS 머리말 참고.
	"w_edge": "warrior", "w_vital": "warrior",
	"a_retreat": "archer", "a_burst": "archer",
	"r_whirl": "rogue", "r_dart": "rogue",
	"m_step": "mage", "m_orb": "mage",
	## 그 다섯째·여섯째가 열어 주는 tier2 나머지 여덟(SKILL_NEED 참고).
	"g_edge": "general", "g_vital": "general",
	"s_retreat": "sniper", "s_burst": "sniper",
	"x_whirl": "assassin", "x_dart": "assassin",
	"p_step": "sage", "p_orb": "sage",
	## **2026-09-13 추가(같은 날 더 더 더 더) — tier3 무예 스물넷.** 아래
	## SKILL_NEED 머리말 참고 — tier1·tier2가 전부 옮겨져 있어 갈래마다
	## 여섯 개 전부(원문 그대로) 채울 수 있었다.
	"n_heaven": "marshal", "n_quake": "marshal", "n_charge": "marshal",
	"n_banner": "marshal", "n_edge": "marshal", "n_vital": "marshal",
	"f_storm": "flier", "f_pierce": "flier", "f_volley": "flier",
	"f_focus": "flier", "f_retreat": "flier", "f_burst": "flier",
	"v_blur": "wraith", "v_petal": "wraith", "v_void": "wraith",
	"v_mark": "wraith", "v_whirl": "wraith", "v_dart": "wraith",
	"i_meteor": "immortal", "i_abyss": "immortal", "i_mend": "immortal",
	"i_tao": "immortal", "i_step": "immortal", "i_orb": "immortal",
	## **2026-09-13 추가(같은 날 더×5) — tier4 무예 스물넷(전신·궁성·
	## 명왕·천존 각 여섯, 갈래의 끝).** 아래 SKILL_NEED 머리말 참고 —
	## tier3가 전부 있어 갈래마다 여섯 개 전부 채웠다.
	"o_ruin": "warlord", "o_tremor": "warlord", "o_smite": "warlord",
	"o_conquer": "warlord", "o_edge": "warlord", "o_vital": "warlord",
	"h_tempest": "falcon", "h_ray": "falcon", "h_swarm": "falcon",
	"h_zenith": "falcon", "h_retreat": "falcon", "h_burst": "falcon",
	"d_carve": "reaper", "d_bloom": "reaper", "d_veil": "reaper",
	"d_curse": "reaper", "d_whirl": "reaper", "d_dart": "reaper",
	"z_starfall": "ascendant", "z_collapse": "ascendant", "z_rebirth": "ascendant",
	"z_eternity": "ascendant", "z_step": "ascendant", "z_orb": "ascendant",
}

## job → 그 직업 무예 key 목록. tier1(여섯)은 data-job.js SKILLS 등장
## 순서 그대로(cut/whirl/rush/iron/edge/vital 등) — 입력 액션
## story_job_skill_1~6·SP 투자 story_job_1~6과 정확히 같은 순서.
## tier2(다섯)도 마찬가지로 story_job_skill2_1~5·같은 story_job_1~5.
## story_job_trainer.gd의 SP 투자 배선이 이 순서를 그대로 쓴다.
const JOB_SKILL_KEYS := {
	"warrior": ["w_cut", "w_whirl", "w_rush", "w_iron", "w_edge", "w_vital"],
	"archer": ["a_shot", "a_double", "a_pierce", "a_eye", "a_retreat", "a_burst"],
	"rogue": ["r_twin", "r_knife", "r_step", "r_vital", "r_whirl", "r_dart"],
	"mage": ["m_fire", "m_bolt", "m_heal", "m_talis", "m_step", "m_orb"],
	## story_job_trainer.gd `_raise()`가 idx>=keys.size()면 조용히
	## 넘어가므로 tier1의 6번째 자리(물리키 6)는 tier2에서 그냥 안 쓰인다.
	"general": ["g_smash", "g_roar", "g_wall", "g_edge", "g_vital"],
	"sniper": ["s_rain", "s_snipe", "s_split", "s_retreat", "s_burst"],
	"assassin": ["x_storm", "x_fan", "x_shadow", "x_whirl", "x_dart"],
	"sage": ["p_quake", "p_beam", "p_ward", "p_step", "p_orb"],
	## tier3(여섯, tier1과 같은 개수)은 입력 story_job_skill3_1~6·SP 투자
	## story_job_1~6을 그대로 쓴다.
	"marshal": ["n_heaven", "n_quake", "n_charge", "n_banner", "n_edge", "n_vital"],
	"flier": ["f_storm", "f_pierce", "f_volley", "f_focus", "f_retreat", "f_burst"],
	"wraith": ["v_blur", "v_petal", "v_void", "v_mark", "v_whirl", "v_dart"],
	"immortal": ["i_meteor", "i_abyss", "i_mend", "i_tao", "i_step", "i_orb"],
	## tier4(여섯, 갈래의 끝)는 입력 story_job_skill4_1~6·SP 투자
	## story_job_1~6(이미 6자리까지 늘려 뒀다)을 그대로 쓴다.
	"warlord": ["o_ruin", "o_tremor", "o_smite", "o_conquer", "o_edge", "o_vital"],
	"falcon": ["h_tempest", "h_ray", "h_swarm", "h_zenith", "h_retreat", "h_burst"],
	"reaper": ["d_carve", "d_bloom", "d_veil", "d_curse", "d_whirl", "d_dart"],
	"ascendant": ["z_starfall", "z_collapse", "z_rebirth", "z_eternity", "z_step", "z_orb"],
}

## **2026-09-13 추가(같은 날 더 더) — 2~4차 전직 다음 걸음: tier2 무예
## 열둘.** data-job.js SKILLS의 tier2 스물(4갈래×5개) 중, 이 포트가 옮긴
## tier1 넷(cut/whirl/rush/iron 등) 안에 실제로 `need`가 걸리는 것만
## 골랐다 — 갈래마다 정확히 셋(장군·신궁·자객·도사 각 3개=12개).
##
## **`need`(선행 무예 lv5 이상) 게이트를 이번에 처음 실제로 켠다** —
## tier1엔 need가 없어 이 조건 자체가 없었지만, tier2부터는 원문에
## 실존하는 규칙이라 `StorySaveState.can_raise_skill()`이 이제 확인한다.
##
## **2026-09-13 추가(같은 날 더 더 더) — tier1 다섯째·여섯째(파공검·
## 생기결 등 여덟)를 마저 채우면서, 그 여덟에 need가 걸린 tier2 나머지
## 여덟(g_edge/g_vital·s_retreat/s_burst·x_whirl/x_dart·p_step/p_orb)도
## 이번에 같이 채웠다** — 28절이 "다섯째·여섯째 tier1이 옮겨지면 같이
## 열린다"고 적어 둔 그대로, 이걸로 data-job.js tier2 스물(4갈래×5개)이
## 전부 옮겨졌다. 돌진(w_rush)·응안(a_eye)·급소(r_vital)·치유(m_heal)만
## 여전히 tier2 대응이 없다(원문 자체가 그렇다 — 3차에서 바로 이어진다).
const SKILL_NEED := {
	"g_smash": {"key": "w_cut", "lv": 5},
	"g_roar": {"key": "w_whirl", "lv": 5},
	"g_wall": {"key": "w_iron", "lv": 5},
	"s_rain": {"key": "a_shot", "lv": 5},
	"s_snipe": {"key": "a_pierce", "lv": 5},
	"s_split": {"key": "a_double", "lv": 5},
	"x_storm": {"key": "r_twin", "lv": 5},
	"x_fan": {"key": "r_knife", "lv": 5},
	"x_shadow": {"key": "r_step", "lv": 5},
	"p_quake": {"key": "m_bolt", "lv": 5},
	"p_beam": {"key": "m_fire", "lv": 5},
	"p_ward": {"key": "m_talis", "lv": 5},
	"g_edge": {"key": "w_edge", "lv": 5},
	"g_vital": {"key": "w_vital", "lv": 5},
	"s_retreat": {"key": "a_retreat", "lv": 5},
	"s_burst": {"key": "a_burst", "lv": 5},
	"x_whirl": {"key": "r_whirl", "lv": 5},
	"x_dart": {"key": "r_dart", "lv": 5},
	"p_step": {"key": "m_step", "lv": 5},
	"p_orb": {"key": "m_orb", "lv": 5},
	## **2026-09-13 추가(같은 날 더 더 더 더) — tier3 무예 스물넷.**
	## data-job.js SKILLS의 need가 tier2뿐 아니라 tier1을 직접 가리키는
	## 경우도 있다(n_charge<-w_rush, f_focus<-a_eye, v_mark<-r_vital,
	## i_mend<-m_heal — 그 넷은 tier2에 대응 무예가 없어 원문이 tier1을
	## 바로 잇는다, 28절 머리말 참고) — 원문 그대로 옮겼다.
	"n_heaven": {"key": "g_smash", "lv": 5},
	"n_quake": {"key": "g_roar", "lv": 5},
	"n_charge": {"key": "w_rush", "lv": 5},
	"n_banner": {"key": "g_wall", "lv": 5},
	"n_edge": {"key": "g_edge", "lv": 5},
	"n_vital": {"key": "g_vital", "lv": 5},
	"f_storm": {"key": "s_rain", "lv": 5},
	"f_pierce": {"key": "s_snipe", "lv": 5},
	"f_volley": {"key": "s_split", "lv": 5},
	"f_focus": {"key": "a_eye", "lv": 5},
	"f_retreat": {"key": "s_retreat", "lv": 5},
	"f_burst": {"key": "s_burst", "lv": 5},
	"v_blur": {"key": "x_storm", "lv": 5},
	"v_petal": {"key": "x_fan", "lv": 5},
	"v_void": {"key": "x_shadow", "lv": 5},
	"v_mark": {"key": "r_vital", "lv": 5},
	"v_whirl": {"key": "x_whirl", "lv": 5},
	"v_dart": {"key": "x_dart", "lv": 5},
	"i_meteor": {"key": "p_beam", "lv": 5},
	"i_abyss": {"key": "p_quake", "lv": 5},
	"i_mend": {"key": "m_heal", "lv": 5},
	"i_tao": {"key": "p_ward", "lv": 5},
	"i_step": {"key": "p_step", "lv": 5},
	"i_orb": {"key": "p_orb", "lv": 5},
	## **2026-09-13 추가(같은 날 더×5) — tier4 무예 스물넷(갈래의 끝).**
	## 전부 바로 아래 tier3을 가리킨다(원문에 tier4는 tier2를 건너뛰는
	## 경우가 없다) — 원문 그대로.
	"o_ruin": {"key": "n_heaven", "lv": 5},
	"o_tremor": {"key": "n_quake", "lv": 5},
	"o_smite": {"key": "n_charge", "lv": 5},
	"o_conquer": {"key": "n_banner", "lv": 5},
	"o_edge": {"key": "n_edge", "lv": 5},
	"o_vital": {"key": "n_vital", "lv": 5},
	"h_tempest": {"key": "f_storm", "lv": 5},
	"h_ray": {"key": "f_pierce", "lv": 5},
	"h_swarm": {"key": "f_volley", "lv": 5},
	"h_zenith": {"key": "f_focus", "lv": 5},
	"h_retreat": {"key": "f_retreat", "lv": 5},
	"h_burst": {"key": "f_burst", "lv": 5},
	"d_carve": {"key": "v_blur", "lv": 5},
	"d_bloom": {"key": "v_petal", "lv": 5},
	"d_veil": {"key": "v_void", "lv": 5},
	"d_curse": {"key": "v_mark", "lv": 5},
	"d_whirl": {"key": "v_whirl", "lv": 5},
	"d_dart": {"key": "v_dart", "lv": 5},
	"z_starfall": {"key": "i_meteor", "lv": 5},
	"z_collapse": {"key": "i_abyss", "lv": 5},
	"z_rebirth": {"key": "i_mend", "lv": 5},
	"z_eternity": {"key": "i_tao", "lv": 5},
	"z_step": {"key": "i_step", "lv": 5},
	"z_orb": {"key": "i_orb", "lv": 5},
}


## job.js mulOf()의 이 포트 재해석 — base + per*lv(레벨 0이면 0, 호출
## 쪽이 먼저 "안 배웠으면 캐스팅 자체를 막는다"로 걸러 둔다).
static func skill_mul(base: float, per: float, level: int) -> float:
	return base + per * float(level)
