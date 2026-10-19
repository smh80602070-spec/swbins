extends RefCounted

const Characters := preload("res://saga_core/data/characters.gd")

## diplo.js "우호"(relation)·"조공"(tribute)·"화친"(truce)을 좁혀 옮긴 것
## (2026-09-12, "외교도 이어해") — 지난 절(전쟁, 소패 공략)이 남긴 첫
## 후보였다. **판정식은 그대로**(조공 round(gold/120) 1~30, 화친 확률
## 0.30+지력/320+우호/260+금/12000, 우호 성공+12·실패+2) — 다만 이
## 슬라이스가 아직 안 가진 것은 뺐다:
## - **동맹(ally)** — 이 슬라이스는 세력이 우리(cao)와 소패의 주인
##   (유비) 둘뿐이라 "함께 칠 셋째 세력"이 없다. 동맹이 막을 전쟁 자체가
##   없어 뜻이 없다 — 화친(truce, "칠 수 없다")만으로 diplo.js의 "시간을
##   산다"는 목적이 이미 채워진다.
## - **국력 차(edge)·공동의 적(commonEnemy) 보정** — `envoyChance()`가
##   `R.summary(force).cities`·`R.ranking()`처럼 "세력 여럿의 성 수·순위"
##   를 비교하는데, 이 슬라이스는 세력을 온전히 굴리지 않아(소패는 정적
##   수치일 뿐 `R.force('bei')`가 없다) 그 비교 자체가 성립하지 않는다.
##   빼도 공식이 망가지지 않는다 — 두 항 다 원래 "0에 가까운 보정"이라
##   기본 확률(0.30)이 하는 일이 대부분이다.
## - **계략(plot: 이간·유언비어·매수·화계)** — 무장 충성(loyal)·태수
##   방어를 다루는데, 이 슬라이스의 로스터엔 충성 값 자체가 없다(REALM은
##   아직 loyal을 안 들였다). 값이 없는 시스템이라 통째로 다음에 볼
##   자리로 남긴다.
##
## **2026-09-12 추가 — 무장 충성(loyal) + 계략(plot) 절반.** "1,2,3
## 순서대로 다해"의 두 번째. `officer.js baseLoyal()`을 그대로 옮겨
## `RealmSaveState.officer_loyal`을 채운다(`LORD_ID`="sg_caocao" —
## data-force.js 시나리오 194의 조조군 군주, 우리 로스터엔 안 들어오지만
## baseLoyal()이 trait 비교에만 쓴다).
##
## **PLOTS는 넷이 아니라 둘만 옮겼다(유언비어·화계) — 재해석.** 이간·
## 매수는 **적 무장**을 대상으로 하는데(`off.atCity(cityId, c.force)`
## 후보 목록), `realm_war.gd` 머리말대로 소패엔 **이름 있는 수비 장수가
## 없다** — 대상 자체가 없어 늘 "홀릴 사람이 없습니다"만 뜨는 죽은
## 버튼이 된다. 유언비어(치안)·화계(군량)는 성 자체가 대상이라 옮길 수
## 있다 — 그러려면 `enemies[xiaopei]`에 `sec`·`food`가 있어야 해서
## `realm_save_state.gd _init_enemies()`가 이제 그 둘도 채운다(SAVE_
## VERSION 6→7). 이간·매수는 다음에 볼 자리(적 쪽에 이름 있는 무장을
## 먼저 들여야 한다).
##
## **화친 체크 없음 — 원작 그대로.** `plot()`은 `diplo.blocked()`를 안
## 본다(diplo.js 원문에 그 체크가 없다) — 첩보전은 정식 화친과 별개라는
## 뜻으로 그대로 옮겼다(`attack()`의 화친 체크와 다른 자리라 헷갈리지
## 않게 여기 적어 둔다).
##
## **2026-09-12 추가 — 이간·매수(적 쪽에 이름 있는 무장 들이기).** "1,2,3
## 다해줘"의 두 번째. data-force.js 시나리오 194 force('bei').officers
## = [sg_guanyu, sg_zhangfei, rf_mizhu, rf_jianyong] 중 **saga_core
## characters.gd에 이미 있는 둘만**(sg_guanyu·sg_zhangfei) 소패 수비
## 무장으로 들였다 — rf_* 둘은 REALM 전용 데이터(130명+)라 saga_core에
## 아직 없다(다음에 볼 자리).
##
## **2026-09-12 추가② — rf_mizhu·rf_jianyong도 saga_core에 들어왔다
## (가명 창윤·언유, characters.gd 참고).** `realm_cities.gd`
## `ENEMY_CITIES[xiaopei].officers`가 이제 넷 다 들고 있다 — 이 파일의
## 판정식(base_loyal·PLOTS·discord_chance·bribe_chance)은 officers
## 배열 길이·대상 id에 안 물려 있어(대상은 매번 `enemies[].officers`를
## 읽어 고른다) 코드 변경 없이 그대로 넷을 다 받는다.
## `base_loyal()`을 **군주를 인자로 받게**
## 일반화했다(기본값 LORD_ID로 기존 호출은 그대로) — 소패 수비 무장의
## 충성 바닥값은 그들의 군주(`sg_liubei`) 기준으로 재야만큼 계산해야
## 해서다. **매수 후보에서 군주는 뺀다**(diplo.js plot() "cands.filter
## (h.id !== lord)" 그대로) — 군주는 안 판다.
##
## **재해석 — 이간 성공 시 즉시 이탈 판정.** 원작은 이간으로 충성이
## 바닥나도 그 자체로는 아무 일도 안 하고, `officer.js checkDefection()`
## (월말 정산)이 12 이하인 사람을 35% 확률로 몰아낸다. 이 슬라이스는
## 적 로스터에 월말 정산을 도는 자리가 없어(`next_month()`는 우리
## 로스터만 돈다), **이간이 성공해 충성이 12 이하로 떨어지면 그 자리에서
## 같은 35% 굴림을 한 번 돌린다** — "적이 흔들릴 때까지 기다렸다가 우연히
## 떠나는 걸 지켜본다"를 "우리가 흔든 순간 결판난다"로 좁힌 재해석이다
## (판정 확률 자체는 안 바꿨다). 떠나면 `RealmSaveState.found`로 간다
## (재야, 원작 `r.found=true`와 같다 — 등용 대상이 된다).
##
## **재해석 — 매수 성공 시 즉시 합류.** 원작 bribe()는 `off.placeAt`으로
## 바로 우리 성에 배치하는데(사로잡는 게 아니라 넘어오는 것), 이 슬라이스도
## 그대로 — `roster`에 바로 들어가고(수색·등용 두 단계를 안 거친다)
## `officer_loyal`=40(원작 그대로)으로 시작한다.
##
## **재해석 — 태수(guard) 지력.** 지금까지 rumor·fire는 `PLOT_GUARD_
## WISDOM`(30) 고정값을 썼다 — 적 태수 정보가 없어서였다. 이제 소패에
## 이름 있는 수비 무장이 생겼으니 **넷 다** 그중 지력 최댓값을 태수로
## 쓴다(`RealmSaveState._enemy_guard_wisdom()`) — 수비 무장이 남아있는
## 동안은 계략이 더 어려워지고, 매수·이간으로 다 빼내면 원래대로 쉬워진다.
## rumor·fire의 예전 검증 수치(태수=30 고정)는 이 변경으로 다시 계산해야
## 한다(6·7절 검증은 그 시점 기준으로 여전히 맞다 — 그때는 수비 무장이
## 없었다).

const TRUCE_MONTHS := 8            # diplo.js TRUCE_MONTHS
const DEFAULT_RELATION := 40       # diplo.js relation() 기본값
const TRUCE_BASE := 0.30           # diplo.js envoyChance() kind==='truce'
const TRUCE_SUCCESS_BONUS := 12    # diplo.js envoy() 화친 성공 시 +우호
const TRUCE_FAIL_BONUS := 2        # diplo.js envoy() 사양당해도 +우호
const ENVOY_FEE := 100             # diplo.js envoy() "gold+100"의 고정 수수료

const LORD_ID := "sg_caocao"       # data-force.js force('cao').lord

## officer.js PLOTS 전부 — diplo.js 원래 순서(이간·유언비어·매수·화계) 그대로.
const PLOTS := [
	{"key": "discord", "name": "이간", "emoji": "🕸️", "gold": 200,
	 "desc": "적 무장을 헐뜯어 충성을 깎는다. 바닥나면 스스로 떠난다."},
	{"key": "rumor", "name": "유언비어", "emoji": "🗣️", "gold": 150,
	 "desc": "적 성에 뜬소문을 놓아 치안을 깎는다."},
	{"key": "bribe", "name": "매수", "emoji": "💰", "gold": 600,
	 "desc": "충성이 낮은 적 무장을 금으로 부른다."},
	{"key": "fire", "name": "화계", "emoji": "🔥", "gold": 300,
	 "desc": "적 성의 군량에 불을 놓는다. 원정 나온 군대가 굶는다."},
	## G-0239 웹 W-0278 「보급 끊기」 — 그 성에서 나갔거나 그 성을 지나 보급받는 적 진을 2달 끊는다(realm_supply.gd).
	{"key": "cut", "name": "보급 끊기", "emoji": "✂️", "gold": 250,
	 "desc": "그 성에서 나갔거나 그 성을 지나 보급받는 적 진의 보급을 2달 끊는다."},
]
const PLOT_RELATION_HIT := -4      # diplo.js plot() "걸기만 해도" 우호 하락
const PLOT_FAIL_RELATION_HIT := -6 # diplo.js plot() 들통났을 때 추가 하락
const PLOT_GUARD_WISDOM := 30      # diplo.js plotChance() "태수가 비어 있으면" 기본값
                                    # — 수비 무장이 전부 없어지면(매수·이간으로
                                    # 다 뺏기면) 이 값으로 돌아간다.
const SEC_HIT_BASE := 10           # diplo.js plot() 'rumor': 10 + rand*12
const SEC_HIT_RANGE := 12
const FOOD_BURN_BASE := 0.25       # diplo.js plot() 'fire': round(food*(0.25+rand*0.3))
const FOOD_BURN_RANGE := 0.3
const DISCORD_HIT_BASE := 12       # diplo.js plot() 'discord': -(12 + floor(rand*14))
const DISCORD_HIT_RANGE := 14
const DEFECT_LOYAL_FLOOR := 12     # officer.js checkDefection() "12 이하"
const DEFECT_CHANCE := 0.35        # officer.js checkDefection() "35% 확률"
const BRIBE_LOYAL_SET := 40        # diplo.js plot() 'bribe': "off.rec(targetId).loyal = 40"


static func plot_by_key(key: String) -> Dictionary:
	for p: Dictionary in PLOTS:
		if p.key == key:
			return p
	return {}


## officer.js baseLoyal() — 군주(lord_id, 기본 LORD_ID=우리 군주)와 trait이
## 같으면 +12, 귀할수록(rarity 클수록) -6씩, 삼국지 사람이 아니면(재야에서
## 온 이방인) -4. **2026-09-12 일반화** — 소패 수비 무장은 자기 군주
## (sg_liubei)를 기준으로 계산해야 해서 `lord_id`를 인자로 받는다(기본값
## 유지로 기존 호출은 그대로).
static func base_loyal(officer_id: String, lord_id: String = LORD_ID) -> int:
	var h = Characters.find(officer_id)
	var lord = Characters.find(lord_id)
	if h == null:
		return 50
	var v := 52
	if lord != null and String(lord.trait) == String(h.trait):
		v += 12
	v -= (int(h.rarity) - 3) * 6
	if String(h.era) != "삼국지":
		v -= 4
	return clampi(v, 25, 85)


## diplo.js plotChance() 공통 항(rumor/fire) — 기본 0.30 + (내 지력-태수
## 지력)/200 + (60-치안)/400.
static func plot_chance(mine_wisdom: float, guard_wisdom: float, sec: int) -> float:
	var p := 0.30 + (mine_wisdom - guard_wisdom) / 200.0
	p += (60.0 - float(sec)) / 400.0
	return clampf(p, 0.05, 0.9)


## diplo.js plotChance(kind==='discord') — plot_chance()의 항에 "(60-대상
## 충성)/300"을 더한다.
static func discord_chance(mine_wisdom: float, guard_wisdom: float, sec: int, target_loyal: int) -> float:
	var p := plot_chance(mine_wisdom, guard_wisdom, sec)
	p += (60.0 - float(target_loyal)) / 300.0
	return clampf(p, 0.05, 0.9)


## diplo.js plotChance(kind==='bribe') — 공통 항을 안 쓰고 통째로 새 공식:
## 0.15 + (70-대상 충성)/100 - (대상 rarity-3)*0.06 + (내 지력-태수 지력)/400
## + (60-치안)/400(성 항은 여전히 더한다, 원작 그대로).
static func bribe_chance(mine_wisdom: float, guard_wisdom: float, sec: int,
		target_loyal: int, target_rarity: int) -> float:
	var p := 0.15 + (70.0 - float(target_loyal)) / 100.0 - (float(target_rarity) - 3.0) * 0.06
	p += (mine_wisdom - guard_wisdom) / 400.0
	p += (60.0 - float(sec)) / 400.0
	return clampf(p, 0.05, 0.9)


## diplo.js envoyChance(kind==='truce') — edge(국력 차)·commonEnemy(공동의
## 적) 보정은 위 머리말 이유로 뺐다.
static func truce_chance(wisdom: float, relation: int, gold: int) -> float:
	var p := TRUCE_BASE + wisdom / 320.0 + float(relation) / 260.0 + float(gold) / 12000.0
	return clampf(p, 0.03, 0.95)


## diplo.js envoy(kind==='tribute') — round(gold/120), 1~30 사이.
static func tribute_up(gold: int) -> int:
	return clampi(roundi(float(gold) / 120.0), 1, 30)


static func clamp_relation(v: int) -> int:
	return clampi(v, 0, 100)
