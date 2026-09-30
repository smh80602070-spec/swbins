extends SagaSaveBase

## VERTICAL_SLICE_REALM.md 완료 조건 — GO/DUNGEON/FOREST/STORY save_state
## 계열과 같은 정신(로컬 파일 하나, 버전 필드, 게임마다 완전히 분리된
## 세이브)이되, REALM은 다섯 판 중 유일한 턴제라 player_pos 대신 세력
## 살림(연·월·금고)과 성마다 따로 노는 살림(개간·상업·기술·치안·축성·
## 훈련·인구·병력·군량)과 무장(로스터/재야록)을 담는다.
##
## project.godot [autoload]에 RealmSaveState로 등록.
##
## 명령 실행(`execute_order`)·달 넘기기(`next_month`)는 웹판 `rtk.js`
## order()/doSearch()/doHire()/tryHire()/settleMonth()/endMonth()를 성
## 여러 곳·무장 하나~둘 규모로 그대로 옮긴 것 — 새 판정식을 상상하지 않는다.
##
## **2026-09-12 추가 — 여러 성(진류·복양·허창).** "여러 성으로 넓히는 것부터
## 해줘" — data-force.js 시나리오 194의 조조군이 원래부터 성 셋을 갖고
## 시작한다는 사실을 그대로 썼다(전쟁·정복 없이 넓히는 유일한 방법,
## `realm_cities.gd` 머리말 참고). `agri`·`comm`·`sec`·`tech`·`wall`·
## `train`·`pop`·`troops`·`food`·`ships`는 이제 `cities[city_id]` 안에
## 있다 — `current_city`가 "지금 조망 중인 성"이고, 명령은 전부 그 성에
## 적용된다. `gold`(세력 금고)·`roster`(무장)·`year`/`month`(달력)는
## rtk.js처럼 여전히 세력 전체가 공유한다.
##
## **2026-09-12 추가 — 무장의 성 소속(officer_city).** "무장 위치는 안
## 따진다"던 재해석을 이제 절반 뒤집었다: **개발형 명령(agri~ships·
## draft)은 그 성에 배치된 무장만 쓸 수 있다** — rtk.js order()의
## `r.city !== cityId` 체크를 그대로 들였다. 시작 무장(현책)은 허창에
## 배치돼 있어 허창은 그대로 돌아가지만, 진류·복양은 그 성 소속 무장을
## 얻기 전까진 개발형 명령을 못 쓴다 — "가서 인재를 심어야 그 성이
## 자란다"는 의도된 결과다. **수색(search)·등용(hire)만 예외** — 아직
## 로스터 전체 아무나 실행할 수 있다. 안 그러면 "그 성에 무장이 있어야
## 수색할 수 있는데 수색해야 무장이 생긴다"는 순환이 막힌다(2-5절에서
## 이미 이 문제를 피하려고 재야를 성마다 나눠 묻는 것까지만 했었다).
## 등용에 성공하면 그 무장은 **찾아낸(수색한) 성**에 배치된다.
##
## 무작위(대성공 판정·수색·등용 성공률)는 FOREST 창작 몬스터들과 같은
## 이유로 고정 시드를 쓴다 — 헤드리스 검증이 "몇 번을 돌려도 같은 결과"를
## 낼 수 있어야 한다(루트 CLAUDE.md 검증 습관). 실제 플레이에서는 매번
## 다른 명령·다른 순서로 이 스트림을 소비하니 체감상 무작위와 다르지 않다.

const Characters := preload("res://saga_core/data/characters.gd")
const RealmOrders := preload("res://games/saga_realm/data/realm_orders.gd")
const RealmOfficerPool := preload("res://games/saga_realm/data/realm_officer_pool.gd")
const RealmCities := preload("res://games/saga_realm/data/realm_cities.gd")
const RealmWar := preload("res://games/saga_realm/data/realm_war.gd")
const RealmDiplo := preload("res://games/saga_realm/data/realm_diplo.gd")
const RealmGrowth := preload("res://games/saga_realm/data/realm_growth.gd")
const RealmQuizData := preload("res://games/saga_realm/data/realm_quiz_data.gd")
const RealmTraits := preload("res://games/saga_realm/data/realm_traits.gd")
const RealmEvents := preload("res://games/saga_realm/data/realm_events.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const SessionCard := preload("res://saga_core/ui/session_card.gd")
const LordPortrait := preload("res://games/saga_realm/ui/lord_portrait.gd")

const SAVE_PATH := "user://save_realm.json"
const SafeFile := preload("res://saga_core/data/safe_file.gd")  # 임시 파일 → .bak → 바꿔치기(쓰는 도중 꺼져도 직전본이 남는다)
const SAVE_VERSION := 16  # 1(성 하나) → 2(성 여러 곳) → 3(officer_city) → 4(enemies) → 5(diplomacy) → 6(정복 성 편입) → 7(충성·계략) → 8(문답) → 9(이간·매수) → 10(인구 증감+재해: cities[].disaster/d_left) → 11(승진/관직: officer_growth) → 12(승패 판정: result) → 13(시나리오: scenario_id) → 14(특성·야망: officer_ambition/enemies_subverted, PLAN 101-2 REALM ③) → 15(이벤트 체인: active_events/events_done, PLAN 101-2 REALM ⑤) → 16(계승: lord_succession_enabled/current_lord_id/heir_id/_succession_shock_until, PLAN 101-2 REALM ⑥)


func save_version() -> int:
	return SAVE_VERSION


func save_path() -> String:
	return SAVE_PATH


const RNG_SEED := 20260824  # 루트 CLAUDE.md 진단 시드와 같은 값(우연 아님, 관례를 따름)

## **2026-09-14 추가 — 시나리오(RealmCities.SCENARIO_CAO_CITIES 키).**
## `start_scenario(id)`로만 바뀐다 — 기본값 "194"는 지금까지의 유일한
## 시작과 똑같다. `city_force`(아래)가 이 값을 따라간다.
var scenario_id := "194"

## **2026-09-14 추가 — 새 게임 시나리오 고르기(REALM 4절 "제외" 마지막
## 후속 작업).** 기본값 true — 세이브를 불러왔거나(`try_load()`가 이미
## 확정된 과거 선택을 복원) 아직 한 번도 고를 필요가 없던 지금까지의
## 유일한 시작(194)과 같은 뜻이다. `realm_city.gd`가 진짜 새 게임(세이브
## 없음/버전 불일치)이라 판단해 시나리오 선택 패널을 띄우는 그 순간에만
## false로 내려간다 — `realm_worldmap.gd`가 이 값을 보고, 아직 고르지
## 않았으면 마커 세우기를 미룬다(우호 마커를 어느 성 기준으로 세워야
## 할지 아직 안 정해졌으므로). `start_scenario()`가 끝에서 다시 true로
## 올린다("이제 확정됐다").
var scenario_ready := true

var year := 194
var month := 1
## 조조군 시작 금고 — rtk.js setup(): 2000 + cities.length(3) * 400 = 3200.
var gold := 3200

## city_id -> {agri, comm, sec, tech, wall, train, pop, troops, food, ships}.
## _init_cities()가 RealmCities.CITIES 기본값으로 채운다(try_load()가 있으면
## 그 값으로 덮어쓴다).
var cities: Dictionary = {}
var current_city := RealmCities.DEFAULT_CITY  # "지금 조망 중인 성"

## PLAN.md 101-4 표준 A·B(목표판·세션 카드) — GO PartyState.session_exp_gained()·
## FOREST ForestSaveState.session_gold_gained()와 같은 계약(세이브 필드이
## 아니다, 세션 시작 시점 스냅샷과의 차이만 잰다). "편입"은 cities.size()
## 델타 — 성을 뺏기는(멸망) 경우도 있어 음수가 나올 수 있다, 그대로 보여준다.
var _session_start_gold := 0
var _session_start_cities := 0


func begin_session() -> void:
	_session_start_gold = gold
	_session_start_cities = cities.size()


func session_gold_gained() -> int:
	return gold - _session_start_gold


func session_cities_gained() -> int:
	return cities.size() - _session_start_cities

## **2026-09-12 추가 — 월드맵 손잡이(viewing_map).** true면 realm_worldmap.gd
## (성 셋을 한눈에)를 보여주고 diorama(realm_city.gd, "성 하나를 3D로
## 조망")를 숨긴다. **저장하지 않는다** — 세이브를 열 때마다 항상 디오라마
## 부터 보이는 게 원작 rtk.js의 "2D 지도가 기본"과 같은 결(realm3d.js는
## 2026-09-11부터 기본 on이지만, 그건 30개 성 전체를 다루는 원작 얘기고
## 이 슬라이스는 아직 지도가 순전히 조망용이라 디오라마가 더 자주 쓰인다).
var viewing_map := false

var roster: Array = [RealmOfficerPool.STARTING_OFFICER]
var found: Array = []               # 수색으로 찾아냈지만 아직 등용 전
## officer_id -> city_id. 개발형 명령(agri~ships·draft)은 이 배치를 따진다
## (수색·등용은 예외, "재해석" 문단 참고).
var officer_city: Dictionary = {RealmOfficerPool.STARTING_OFFICER: RealmCities.DEFAULT_CITY}
## **2026-09-12 추가 — 무장 충성(loyal).** officer_id -> int(0~100).
## `_ready()`가 시작 무장을, `_do_hire()`가 새로 합류한 무장을 `RealmDiplo.
## base_loyal()`로 채운다. `next_month()`가 매달 12 이하인 사람을 35%
## 확률로 이탈시킨다(officer.js checkDefection() 그대로) — 이 슬라이스엔
## 아직 충성을 깎는 수단(이간)이 없어 실전에서 잘 안 터지는 안전망이지만,
## 값과 문(door)은 이걸로 열어 둔다.
var officer_loyal: Dictionary = {RealmOfficerPool.STARTING_OFFICER: RealmDiplo.base_loyal(RealmOfficerPool.STARTING_OFFICER)}

## **2026-09-14 추가 — 승진/관직 5단(officer.js/hero.js, `realm_growth.gd`).**
## officer_id -> {lv, exp, rank, feats}. `_effective_stat()`이 이 값으로
## `RealmGrowth.grow_mul()`을 곱해 기본 능력치(Characters.find(id).stats)
## 위에 얹는다 — hero.js 머리말 "계산이 두 곳으로 갈라지면 안 된다"를 그대로
## 따라, 능력치를 쓰는 모든 자리(명령 성과·수색·등용·태수·출진·계략)가 이
## 한 함수만 거치게 좁혔다. 아직 관직이 없는(또는 세이브에 없는) 무장은
## lv=1·rank=0(배율 1.0)이라 기존 값과 다르지 않다.
var officer_growth: Dictionary = {}
var _done_this_month: Dictionary = {}  # officer_id -> bool

## **2026-09-17 추가 — PLAN 101-2 REALM ③후보(웹판 §5-1 "인물 특성·야망").**
## `officer_growth`와 같은 지연 초기화 패턴 — officer_id -> {k, prog, done,
## fail_months}. `k`(야망 종류)는 `RealmTraits.ambition_of(id)`로 결정적으로
## 뽑히고 이후 안 바뀐다. 특성(traits)은 세이브에 안 담는다(결정적이라
## 매번 다시 계산해도 같다, `realm_traits.gd` 머리말 참고).
var officer_ambition: Dictionary = {}
## 야망 "숙적"(적 무장을 계략으로 하나 제거) 진행도 — 이간 이탈 성공·매수
## 성공 둘 다 여기서 센다(`plot()` 참고). 세력 전체가 공유하는 값이라
## 사람별로 나누지 않는다(재야 성 편입 문턱을 세력 전체로 재는 "고향"과
## 같은 결).
var enemies_subverted := 0

## **2026-09-18 추가 — PLAN 101-2 REALM ⑤후보(웹판 §5-2 "관계·이벤트
## 체인").** `realm_events.gd` 머리말 참고 — 웹판 `{id, step, due, who}`를
## 그대로 옮기되 `step`은 항상 이 사람 한 명의 체인이라(관계가 아니라
## 1인 서사) 따로 안 센다. `due_month`/`due_year`가 그 카드가 **플레이어
## 화면에 뜨는(고를 수 있는) 시점**이고, 새로 걸린 이벤트는 즉시(now) 뜬다
## — 체인 후속만 `chain_months` 뒤로 예약된다. `ready_events()`가 이미
## 도달한 것만 골라준다.
var active_events: Array = []  # [{id, officer, due_month, due_year}]
var events_done: Dictionary = {}  # id(String) -> count(int)

## **2026-09-18 추가 — PLAN 101-2 REALM ⑥후보(웹판 §5-2, 정확히는 §5-8
## "군주 사망·계승").** 웹판은 "군주를 노쇠·죽음에서 빼 둔 구멍을 닫는다"고
## 적었지만, 그 전제(부하 무장 전원의 나이·자연사 시뮬레이션)가 이 슬라이스엔
## 아예 없다 — **대폭 재해석**: 나이 대신 매달 아주 낮은 고정 확률로
## "군주 유고"를 굴린다(§10-Q2가 이미 확정한 "기본 꺼짐, 사용자가 켠다"
## 손잡이는 그대로 살렸다). `RealmDiplo.LORD_ID`(상수, 시작 군주 조조)는
## 안 바꾸고 `current_lord_id`(변수)를 새로 둬 계승마다 이 값만 옮긴다 —
## `hire()`가 이제 이 값으로 신규 무장 시작 충성을 잰다(위 참고).
var lord_succession_enabled := false
var current_lord_id: String = RealmDiplo.LORD_ID
var heir_id := ""  # 로스터 id 또는 ""(미지정 — 계승 때 자동으로 고른다)
## officer_id -> {month, year} — 계승 충격 창(3달, 웹판 그대로). "야심"
## 특성만 이 창 안에서 이탈 판정 배율이 오른다(_check_defection() 참고).
var _succession_shock_until: Dictionary = {}

## **2026-09-12 추가 — 적 목표(realm_war.gd 첫 전투 슬라이스).**
## enemy_id -> {troops, wall, max_wall, train, tech, captured}. _init_enemies()
## 가 RealmCities.ENEMY_CITIES 기본값으로 채운다(try_load()가 있으면 그
## 값으로 덮어쓴다) — cities와 같은 패턴. next_month()는 이 값을 안 건드린다
## (적 AI가 없어 매달 그대로다 — attack()으로 싸울 때만 바뀐다).
var enemies: Dictionary = {}

## **2026-09-12 추가 — 이간·매수(적 수비 무장의 충성).** officer_id ->
## int(0~100). `officer_loyal`과 같은 모양이지만 남의 로스터라 따로
## 둔다(우리 쪽 `_check_defection()`이 실수로 적 무장을 훑지 않도록).
## `_init_enemies()`가 `ENEMY_CITIES[].officers`마다 `RealmDiplo.
## base_loyal(id, 그 성 lord)`로 채운다. 매수·이간으로 빠져나가면
## (`enemies[eid].officers`에서 지워질 때) 여기서도 같이 지운다.
var enemy_officer_loyal: Dictionary = {}

## **2026-09-12 추가 — 외교(realm_diplo.gd).** force_id("bei") -> {relation,
## truce_months}. diplo.js relKey()가 세력 둘을 한 쌍으로 묶는 것과 달리
## 이 슬라이스는 상대가 하나뿐이라 force_id 하나로 바로 찾는다. 화친 중
## (truce_months>0)이면 attack()이 막힌다(war.js canMarch()의 `diplo.
## blocked()` 체크와 같은 자리). next_month()가 매달 truce_months를
## 하나씩 깎는다(diplo.js monthly()).
var diplomacy: Dictionary = {}

## **2026-09-14 추가 — 시나리오별 force 재배정.** city_id -> force_id.
## `RealmCities.ENEMY_CITIES`에 정적으로 박힌 194 기준 `force`를 그대로
## 담되, `scenario_id`가 200/208처럼 194와 다르면 `RealmCities.
## SCENARIO_FORCE_OVERRIDE`로 겹쳐 쓴다(_init_city_force() 참고) —
## 실제 194 기준 세력 소속을 담은 const 배열 자체는 절대 안 건드린다,
## 이 Dictionary가 "지금 시나리오에서 실제로 누구 것인가"의 유일한
## 출처다. **저장하지 않는다** — `scenario_id`만 저장하고, 불러온
## 뒤 `_init_city_force()`로 다시 채운다(파생값, city_force 자체를
## 세이브에 중복해서 담지 않는다).
var city_force: Dictionary = {}

## **2026-09-12 추가 — 문답(quiz.js, "1,2,3 순서대로 다해" 세 번째).**
## quiz.js `qstate()`와 같은 모양 — learned(id→true)·wrongs(id→틀린
## 횟수)·total·correct·streak·best_streak·lore(학식, `LORE_PER_FIND`가
## 차면 `_reveal_free()`로 재야 하나가 저절로 드러난다). feat/fame/scroll
## 은 이 슬라이스에 그 축 자체가 없어(REALM엔 player.fame 같은 게 없다)
## 뺐다 — 첫 정답 보상은 세력 금고(gold)와 학식뿐이다(`quiz_answer()`
## 참고).
var quiz: Dictionary = {}

## **2026-09-14 추가 — 세력 멸망/승패 판정(rtk.js checkResult()).**
## ""(미정)·"win"(전체 107개 성을 다 가짐). **"lose"는 이 슬라이스에서
## 도달 불가능하다** — 22절("타 세력 AI")이 "AI가 이겨도 성을 뺏지
## 않는다"고 정한 안전장치 때문에 `cities`가 절대 비지 않는다. rtk.js
## `st.result`가 한 번 정해지면 그대로 굳는 것과 같이(`check_result()`
## 머리말 참고) `next_month()`도 승패가 정해지면 더 안 넘어간다(rtk.js
## `endMonth()`의 `if (!st.started || st.result) return null;` 그대로).
##
## **2026-09-17 추가 — PLAN 101-2 REALM ②후보 "승리 조건 4"(웹판 §5-5).**
## 웹판 넷(패권·문화·외교·생존) 중 지금 3D가 가진 것만 옮긴다: "win"(정복,
## 기존 그대로)에 "win_culture"(문답 정답 누적)·"win_diplomacy"(모든
## 살아있는 세력과 화친 연속 유지) 둘을 더한다. **재해석** — 문화는
## 웹판의 학식 상한·보물 11종을 뺐다(그 시스템 자체가 없다), 문답 정답
## 수만 본다. **보류**(새 시스템이 필요해 이번 범위 밖): 패권(세력 순위·
## "관문 성" 태그가 없다)·생존("균열의 왕" 전용 시나리오가 3D에 없다).
## 웹판은 승리를 "여러 개 모으는" 열린 판이지만(`save.rtk.victories` 배열)
## 3D는 기존 `result` 한 번 굳으면 다음 달을 막는 흐름을 그대로 따른다
## (다시 설계 안 함) — 넷 중 먼저 채운 조건 하나로 그 판이 끝난다.
var result := ""

## 외교 승리 진행도 — next_month()가 매달 "살아있는 모든 세력이 지금
## 화친 중인가"를 보고 이으면 +1, 끊기면 0으로 되돌린다.
var diplomacy_peace_streak := 0

var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.seed = RNG_SEED
	_init_city_force(RealmCities.SCENARIO_FORCE_OVERRIDE.get(scenario_id, {}))
	_init_cities()
	_init_enemies()
	_init_diplomacy()
	_init_quiz()


## rtk.js setup()의 도시 초기화. **2026-09-14 — scenario_id로 일반화.**
## `RealmCities.SCENARIO_CAO_CITIES[scenario_id]`가 주는 성 목록을 돈다 —
## 194의 세 성(`RealmCities.CITIES`에 있는)은 지금까지처럼 채우고(troops=0,
## sec/tech/train은 RealmOrders 기본 상수, "아직 아무것도 없는 시작"),
## 시나리오가 추가로 준 나머지 성(예: 200의 낙양·장안·소패·하비·수춘)은
## `RealmCities.ENEMY_CITIES`의 정의로 채운다 — 그 성 자신의 troops_start/
## train_start/tech_start를 그대로 쓴다("이미 자리 잡은 성을 물려받는다"는
## 뜻이라 0에서 시작하지 않는다, `_annex_city()`의 신선한 버전).
func _init_cities() -> void:
	cities.clear()
	var cao_cities: Array = RealmCities.SCENARIO_CAO_CITIES.get(scenario_id, RealmCities.SCENARIO_CAO_CITIES["194"])
	for city_id: String in cao_cities:
		var base := RealmCities.by_id(city_id)
		if not base.is_empty():
			cities[city_id] = {
				"agri": int(base.agri_start), "comm": int(base.comm_start),
				"sec": RealmOrders.SEC_START, "tech": RealmOrders.TECH_START,
				"wall": int(base.wall_start), "train": RealmOrders.TRAIN_START,
				"pop": int(base.pop_start), "troops": 0,
				"food": RealmCities.food_start(city_id),
				"ships": RealmCities.ships_start(city_id),
				"disaster": "", "d_left": 0,
			}
			continue
		var def := RealmCities.enemy_by_id(city_id)
		cities[city_id] = {
			"agri": int(def.agri_start), "comm": int(def.comm_start),
			"sec": RealmOrders.SEC_START, "tech": int(def.tech_start),
			"wall": int(def.wall_start), "train": int(def.train_start),
			"pop": int(def.pop_start), "troops": int(def.troops_start),
			"food": RealmCities.food_start(city_id),
			"ships": RealmCities.ships_start(city_id),
			"disaster": "", "d_left": 0,
		}


## RealmCities.ENEMY_CITIES 기본값으로 채운다 — _init_cities()와 같은 패턴.
## **2026-09-12 추가 — sec·food.** 계략(유언비어·화계)의 대상 값 — 이전엔
## 전투에만 쓰는 값만 있었다. sec는 `RealmOrders.SEC_START`(우리 성 시작값과
## 같은 기준, 적 태수 정보가 없어 새 값을 안 지어냈다), food는 `_init_cities()`
## 와 같은 공식(`RealmCities.food_start()`).
## **2026-09-12 추가 — officers.** 이간·매수 대상(`realm_diplo.gd` 머리말
## 참고) — 정적 정의(`ENEMY_CITIES[].officers`)를 그대로 복사해 실행 중
## 지워질 수 있는 배열로 든다(`cities`가 정적 시작값을 복사해 실행 중
## 값으로 쓰는 것과 같은 패턴). `enemy_officer_loyal`도 여기서 같이 채운다.
## **2026-09-14 추가 — 시나리오가 우리 것으로 준 성은 건너뛴다**(위
## `_init_cities()`가 이미 `cities`에 넣었다 — 한 성이 `cities`와
## `enemies` 둘 다에 있으면 안 된다).
func _init_enemies() -> void:
	enemies.clear()
	enemy_officer_loyal.clear()
	var cao_cities: Array = RealmCities.SCENARIO_CAO_CITIES.get(scenario_id, RealmCities.SCENARIO_CAO_CITIES["194"])
	for def: Dictionary in RealmCities.ENEMY_CITIES:
		var eid: String = String(def.id)
		if cao_cities.has(eid):
			continue
		var def_officers: Array = (def.get("officers", []) as Array).duplicate()
		enemies[eid] = {
			"troops": int(def.troops_start), "wall": int(def.wall_start),
			"max_wall": int(def.wall_start), "train": int(def.train_start),
			"tech": int(def.tech_start), "captured": false,
			"sec": RealmOrders.SEC_START, "food": RealmCities.food_start(eid),
			"officers": def_officers,
		}
		var lord_id: String = String(def.get("lord", ""))
		for oid: String in def_officers:
			if not enemy_officer_loyal.has(oid):
				enemy_officer_loyal[oid] = RealmDiplo.base_loyal(oid, lord_id)


## **2026-09-14 추가 — 시나리오별 force 재배정의 실제 출처.** `city_force`를
## 채운다 — 194 기준 정적 `force`에 `overrides`(RealmCities.
## SCENARIO_FORCE_OVERRIDE[scenario_id])를 겹쳐 쓰되, 이 시나리오에서
## 이미 우리 것이 된 성(`cao_cities`)은 아예 뺀다(그런 성은 "적의 세력"
## 개념 자체가 없다 — `enemies`에도 안 들어간다, 위 `_init_enemies()`와
## 같은 필터).
func _init_city_force(overrides: Dictionary) -> void:
	city_force.clear()
	var cao_cities: Array = RealmCities.SCENARIO_CAO_CITIES.get(scenario_id, RealmCities.SCENARIO_CAO_CITIES["194"])
	for def: Dictionary in RealmCities.ENEMY_CITIES:
		var eid: String = String(def.id)
		if cao_cities.has(eid):
			continue
		city_force[eid] = String(overrides.get(eid, def.get("force", "")))


## 이 성이 "지금" 속한 force — 194 기준 정적 `force` 대신 이걸 쓴다(다른
## 시나리오가 겹쳐 쓸 수 있으므로). 우리 것이거나(cao_cities) 원래도
## force가 없는 재야 성(77개)이면 빈 문자열.
func force_of(city_id: String) -> String:
	return String(city_force.get(city_id, ""))


## **2026-09-14 추가 — 이 성이 "지금" 섬기는 군주.** `RealmCities.
## enemy_by_id(city_id).lord`(정적, 194 기준)를 직접 읽지 않는다 —
## 200에서 force가 재배정된 성(계·북평·북해→shao 등)은 그 정적 값이
## 옛 주인을 가리켜서 화면에 옛 이름이 뜬다(`realm_diplo_button.gd`
## `_lord_name()`이 처음 이걸로 걸렸다). `force_of()`가 이미 답한
## "지금 세력"을 `RealmCities.FORCE_LORD`로 한 번 더 거친다 — 재야
## 성(force 없음)은 FORCE_LORD에도 없어 자연히 빈 문자열이 나온다.
func lord_of(city_id: String) -> String:
	return String(RealmCities.FORCE_LORD.get(force_of(city_id), ""))


## city_force가 실제로 갖는 force마다 우호 기본값(40)을 채운다 — 세력이
## 같은 여러 성을 가리켜도(예: 200의 shao는 여섯) 세력당 한 번만.
## **2026-09-14 — city_force 기준으로 갈아 끼웠다**(예전엔 ENEMY_CITIES의
## 정적 force를 직접 훑었다 — 시나리오가 그 값을 겹쳐 쓸 수 있게 된 지금은
## `city_force`가 유일한 출처다. `_init_city_force()`가 이미 우리 것이 된
## 성을 걸러 둬 죽은 항목(force는 있지만 실제 성이 하나도 없는)이 안 생긴다).
func _init_diplomacy() -> void:
	diplomacy.clear()
	for eid: String in city_force:
		var fid: String = String(city_force[eid])
		if fid.is_empty() or diplomacy.has(fid):
			continue
		diplomacy[fid] = {"relation": RealmDiplo.DEFAULT_RELATION, "truce_months": 0}


## **2026-09-14 추가 — 시나리오 전환(REALM 4절 "제외"에 마지막까지 남았던
## 항목).** `RealmCities.SCENARIO_CAO_CITIES`가 아는 시나리오("194"·"200")
## 로 게임 전체를 처음부터 다시 짠다 — `_ready()`가 부팅 시 한 번 하는 일
## (도시·적·외교·문답 초기화)을 그대로 다시 부르되, `scenario_id`를 먼저
## 바꿔 그 값을 따라가게 한다. 로스터·문답·연월·금고도 전부 새로 시작한다
## — **진행 중이던 게임 위에 부르면 그 진행이 지워진다**(save()로 먼저
## 남겨 두지 않은 채 쓰면 안 됨, "새 게임" 개념).
##
## **아직 이걸 부르는 UI가 없다** — 시나리오 고르기 화면(새 게임 시작
## 지점)은 이 슬라이스의 범위 밖으로 남겨 둔다(REALM 4절 "포함"에 아직
## "새 게임" 자체가 없다 — 지금까지 게임은 언제나 194로 부팅했다). 이
## 함수는 헤드리스 임시 씬으로 직접 불러 검증했다 — 다음 슬라이스가 할
## 일은 이 함수를 실제로 호출하는 진입점을 만드는 것뿐이다.
func start_scenario(id: String) -> void:
	if not RealmCities.SCENARIO_CAO_CITIES.has(id):
		return
	scenario_id = id
	year = int(id)
	month = 1
	result = ""
	roster = [RealmOfficerPool.STARTING_OFFICER]
	found = []
	officer_city = {RealmOfficerPool.STARTING_OFFICER: RealmCities.DEFAULT_CITY}
	officer_loyal = {RealmOfficerPool.STARTING_OFFICER: RealmDiplo.base_loyal(RealmOfficerPool.STARTING_OFFICER)}
	officer_growth = {}
	officer_ambition = {}
	enemies_subverted = 0
	_done_this_month.clear()
	viewing_map = false

	_init_city_force(RealmCities.SCENARIO_FORCE_OVERRIDE.get(scenario_id, {}))
	_init_cities()
	_init_enemies()
	_init_diplomacy()
	_init_quiz()

	current_city = RealmCities.DEFAULT_CITY  # 세 시나리오 전부 조조가 허창을 갖는다
	## rtk.js setup() 금고 공식(2000 + cities.length * 400)을 성 개수가
	## 달라진 시나리오에도 그대로 적용 — 194(3성)=3200(기존과 동일),
	## 200(8성)=5200.
	gold = 2000 + cities.size() * 400
	scenario_ready = true  # 이제 확정됐다 — realm_worldmap.gd가 미뤄 둔 마커를 세울 차례


## quiz.js qstate()의 기본값 그대로(best_streak는 camelCase→snake_case만).
func _init_quiz() -> void:
	quiz = {
		"learned": {}, "wrongs": {}, "total": 0, "correct": 0,
		"streak": 0, "best_streak": 0, "lore": 0,
	}


## ── 성장 (경험 · 승진) ──────────────────────────────────────────
## officer.js grow()/gainExp()/promote()를 그대로 옮겼다(위 officer_growth
## 머리말 참고).

func _growth(id: String) -> Dictionary:
	if not officer_growth.has(id):
		officer_growth[id] = {"lv": 1, "exp": 0, "rank": 0, "feats": 0, "bonus": {}}
	return officer_growth[id]


## officer.js off.stats() 축약 — 나이(aging)는 이 슬라이스에 없어(REALM
## PLAN 4절에도 없는 항목) 성장 배율만 곱한다. Characters.find(id)가 없으면
## (없는 id) 0을 돌려준다.
## **2026-09-17 추가 — `bonus`(야망 달성 "능력 +2 영구", PLAN 101-2 REALM
## ③).** 배율이 아니라 평평한 덧셈이라 곱셈 뒤에 더한다 — `_add_growth_
## bonus()`만 이 값을 채운다.
func _effective_stat(id: String, stat_key: String) -> float:
	var h = Characters.find(id)
	if h == null:
		return 0.0
	var base: float = float(h.stats.get(stat_key, 0))
	var g: Dictionary = officer_growth.get(id, {"lv": 1, "rank": 0})
	var mul := base * RealmGrowth.grow_mul(int(g.get("lv", 1)), int(g.get("rank", 0)))
	var bonus: Dictionary = g.get("bonus", {})
	return mul + float(bonus.get(stat_key, 0))


## 야망 달성 보상("능력 +2 영구") — `officer_growth[id].bonus[stat_key]`에
## 누적한다(같은 사람이 같은 축 야망을 두 번 이룰 일은 없지만, 겹쳐도
## 안전하게 더하기만 한다).
func _add_growth_bonus(id: String, stat_key: String, amount: int) -> void:
	var g := _growth(id)
	var bonus: Dictionary = g.get("bonus", {})
	bonus[stat_key] = int(bonus.get(stat_key, 0)) + amount
	g.bonus = bonus


## 경험을 준다 — 레벨이 오르면 _effective_stat()가 그만큼 곱해진다.
## officer.js gainExp() 그대로.
func gain_exp(id: String, amount: int) -> Dictionary:
	if amount <= 0 or Characters.find(id) == null:
		return {"gained": 0, "levels": 0}
	var g := _growth(id)
	if int(g.lv) >= RealmGrowth.MAX_LV:
		g.exp = 0
		return {"gained": 0, "levels": 0}
	g.exp = int(g.exp) + amount
	var levels := 0
	var need := RealmGrowth.exp_need(int(g.lv))
	while int(g.exp) >= need and int(g.lv) < RealmGrowth.MAX_LV:
		g.exp = int(g.exp) - need
		g.lv = int(g.lv) + 1
		levels += 1
		need = RealmGrowth.exp_need(int(g.lv))
	if int(g.lv) >= RealmGrowth.MAX_LV:
		g.exp = 0
	return {"gained": amount, "levels": levels}


## rtk.js order() 말미의 "명령 하나가 남기는 것" — 개발형·징병 명령에만
## 붙는다(수색·등용은 execute_order()가 먼저 return해 여기까지 안 온다).
func _grant_order_growth(officer_id: String) -> void:
	var g := _growth(officer_id)
	g.feats = int(g.feats) + 1
	officer_loyal[officer_id] = clampi(int(officer_loyal.get(officer_id, 50)) + 1, 0, 100)
	gain_exp(officer_id, int(RealmGrowth.EXP.order))


func promote_check(id: String) -> Dictionary:
	if Characters.find(id) == null:
		return {"ok": false, "why": "없는 무장입니다"}
	if not (id in roster):
		return {"ok": false, "why": "재야입니다"}
	var g := _growth(id)
	if int(g.rank) >= RealmGrowth.MAX_RANK:
		return {"ok": false, "why": "더 올릴 자리가 없습니다"}
	var cost := RealmGrowth.promote_cost(int(g.rank))
	if int(g.feats) < int(cost.feats):
		return {"ok": false, "why": "공이 모자랍니다 (%d/%d)" % [int(g.feats), int(cost.feats)], "cost": cost}
	if gold < int(cost.gold):
		return {"ok": false, "why": "금이 모자랍니다 (%d)" % int(cost.gold), "cost": cost}
	return {"ok": true, "cost": cost}


## 승진 — 쌓인 공과 금으로 관직을 올린다. 능력치가 오르고(RANK_STEP),
## 충성이 크게 오른다(+12) — 원작에서 관직이 사람을 붙들어 두는 힘이 그것이다.
## officer.js promote() 그대로.
func promote(id: String) -> Dictionary:
	var chk := promote_check(id)
	if not bool(chk.get("ok", false)):
		return chk
	var g := _growth(id)
	var cost: Dictionary = chk.cost
	g.feats = int(g.feats) - int(cost.feats)
	gold -= int(cost.gold)
	g.rank = int(g.rank) + 1
	## PLAN 101-2 REALM ③후보 — 탐욕(웹판 §5-1 "상 받으면 충성 +50%").
	var loyal_gain := 12
	if RealmTraits.has_trait(id, "greedy"):
		loyal_gain = roundi(float(loyal_gain) * RealmTraits.TRAIT_GREEDY_REWARD_MUL)
	officer_loyal[id] = clampi(int(officer_loyal.get(id, 50)) + loyal_gain, 0, 100)
	return {"ok": true, "rank": int(g.rank), "name": RealmGrowth.rank_name(int(g.rank)), "loyal": int(officer_loyal[id])}


## 명령을 실행한다 — rtk.js order()를 current_city 하나에 적용하는 축약.
## 반환: {"ok": bool, "why": String}(실패) 또는
##       {"ok": true, "officer": String, "amount": int, "crit": bool}
##       (개간/상업/기술/치안/축성/징병/훈련/조선) /
##       {"ok": true, "found": String}(수색, 빈 문자열이면 "더 찾을 사람 없음") /
##       {"ok": true, "hired": String, "chance": float}(등용, 빈 문자열이면 거절)
## `debate_mul`(PLAN 101-2 REALM ④후보 "설전") — key=="hire"에만 쓰인다,
## 기본값 1.0(안 주면 지금까지와 동치).
func execute_order(key: String, debate_mul: float = 1.0) -> Dictionary:
	var o := RealmOrders.by_key(key)
	if o.is_empty():
		return {"ok": false, "why": "없는 명령"}
	## rtk.js order() "배는 물가에서만 짓는다" — capOf('ships')가 0인
	## (land: plain) 성은 항상 여기서 막힌다. 금·무장 턴을 쓰기 전에 먼저
	## 걸러 원작 순서(금 차감보다 먼저)를 그대로 지켰다.
	if key == "ships" and RealmOrders.cap_of("ships", current_city) <= 0:
		return {"ok": false, "why": "물길이 없는 성입니다"}
	if gold < int(o.gold):
		return {"ok": false, "why": "금이 모자랍니다"}

	## 수색·등용은 로스터 전체 아무나(성 소속 무관), 나머지(개발형·징병)는
	## current_city에 배치된 무장만 — 위 "재해석" 문단 참고.
	var location_bound := key != "search" and key != "hire"
	var officer_id := _best_officer_for(String(o.stat), current_city if location_bound else "")
	if officer_id.is_empty():
		var why := "이 성에 배치된 무장이 없습니다" if location_bound else "명령을 쓸 무장이 없습니다"
		return {"ok": false, "why": why}

	gold -= int(o.gold)
	_done_this_month[officer_id] = true

	if key == "search":
		return _do_search(officer_id)
	if key == "hire":
		return _do_hire(officer_id, debate_mul)
	var result := _do_draft(o, officer_id) if key == "draft" else _do_devel(key, o, officer_id)
	_grant_order_growth(officer_id)
	return result


## rtk.js order()의 "대성공 판정 + 성과량" 부분 — 개발형 명령(devel)과
## 징병(draft)이 공유한다(뒤에서 amount를 다르게 다룰 뿐 굴리는 방식은 같다).
func _roll_amount(o: Dictionary, officer_id: String) -> Dictionary:
	var stat_val: float = _effective_stat(officer_id, String(o.stat))
	var crit := _rng.randf() < clampf(stat_val / 400.0, 0.03, 0.28)
	var amount := roundi((float(o.base) + stat_val * float(o.per)) * (1.5 if crit else 1.0))
	return {"amount": amount, "crit": crit}


## agri/comm/tech/sec/wall/train/ships 일곱 다 같은 모양(cap까지 채우고
## 남은 만큼만 는다)이라 current_city의 Dictionary를 직접 읽고 쓴다.
func _do_devel(key: String, o: Dictionary, officer_id: String) -> Dictionary:
	var roll := _roll_amount(o, officer_id)
	var amount: int = roll.amount

	var c: Dictionary = cities[current_city]
	var cap := RealmOrders.cap_of(key, current_city)
	var before: int = int(c.get(key, 0))
	var after: int = mini(cap, before + amount)
	c[key] = after
	amount = after - before

	return {"ok": true, "officer": officer_id, "amount": amount, "crit": roll.crit}


## rtk.js order()의 draft 분기 그대로 — 인구가 뽑을 수 있는 만큼(room)만
## 병력이 늘고, 그만큼 인구가 준다. 새 병사가 섞이면 훈련도가 희석된다.
## 전부 current_city 안에서 일어난다(인구·병력은 성마다 따로 논다).
func _do_draft(o: Dictionary, officer_id: String) -> Dictionary:
	var roll := _roll_amount(o, officer_id)
	var amount: int = roll.amount

	var c: Dictionary = cities[current_city]
	var pop_val: int = int(c.pop)
	var troops_val: int = int(c.troops)
	var room := floori(float(pop_val) * 0.06) - troops_val
	amount = maxi(0, mini(amount, maxi(0, room)))
	amount = mini(amount, floori(float(pop_val) / 12.0))
	c.troops = troops_val + amount
	c.pop = pop_val - amount
	if int(c.troops) > 0:
		c.train = roundi(float(c.train) * float(int(c.troops) - amount) / float(c.troops))

	return {"ok": true, "officer": officer_id, "amount": amount, "crit": roll.crit}


## rtk.js doSearch() — 재야 후보를 rarity 내림차순으로 보고, 지력이 높을수록
## "뻗치는 범위"(reach)가 넓어져 더 귀한 사람도 뽑힐 수 있다.
## **2026-09-12 추가 — 재야는 이제 current_city에 묻힌 사람만 나온다**
## (`HIDDEN_POOL_BY_CITY`, rtk.js doSearch()가 애초에 그 성 소속만 찾던
## 것과 같은 결) — 성마다 다른 재야가 있어 세 성을 다 둘러볼 이유가 생겼다.
func _do_search(officer_id: String) -> Dictionary:
	var hidden: Array = []
	for id: String in RealmOfficerPool.HIDDEN_POOL_BY_CITY.get(current_city, []):
		if id in found or id in roster:
			continue
		hidden.append(id)
	if hidden.is_empty():
		return {"ok": true, "found": ""}

	hidden.sort_custom(func(a: String, b: String) -> bool:
		return int(Characters.find(a).rarity) > int(Characters.find(b).rarity))

	var wis: float = _effective_stat(officer_id, "wisdom")
	var reach := clampi(roundi(hidden.size() * wis / 130.0), 1, hidden.size())
	var pick_idx := _rng.randi_range(0, reach - 1)
	var got: String = hidden[pick_idx]
	found.append(got)
	return {"ok": true, "found": got}


## rtk.js doHire()/tryHire() — 찾아낸 재야 중 가장 먼저 찾은 이를 부른다.
## 성공률은 부르는 쪽의 지력과 상대의 rarity(콧대)가 가른다 — 같은 trait면
## +10%p. `debate_mul`(PLAN 101-2 REALM ④후보 "설전") 기본값 1.0.
func _do_hire(officer_id: String, debate_mul: float = 1.0) -> Dictionary:
	if found.is_empty():
		return {"ok": true, "hired": ""}

	var target_id: String = found[0]
	var by = Characters.find(officer_id)
	var t = Characters.find(target_id)
	var wis: float = _effective_stat(officer_id, "wisdom")
	var chance := clampf(0.28 + wis / 260.0 - (float(t.rarity) - 2.0) * 0.09, 0.05, 0.9)
	if String(by.trait) == String(t.trait):
		chance += 0.10
	chance = clampf(chance * debate_mul, 0.05, 0.9)

	if _rng.randf() > chance:
		return {"ok": true, "hired": "", "chance": chance}

	found.erase(target_id)
	roster.append(target_id)
	officer_city[target_id] = current_city  # 찾아낸(수색한) 성에 배치된다
	## PLAN 101-2 REALM ⑥후보(계승) — 계승이 있었으면 그 뒤로 들어오는 사람은
	## 새 군주 기준으로 시작 충성을 잰다(current_lord_id, 기본값은 LORD_ID와
	## 같다 — 계승이 한 번도 없었으면 이전과 동치).
	officer_loyal[target_id] = RealmDiplo.base_loyal(target_id, current_lord_id)
	_done_this_month[target_id] = true  # rtk.js: 들어온 달에는 일하지 않는다
	return {"ok": true, "hired": target_id, "chance": chance}


## rtk.js settleMonth()+endMonth()의 축약 — 세력 금고는 **성 전부의 소득
## 합**(rtk.js settleMonth() "세력 금고" 루프 그대로)에서 정산하고, 군량·
## 치안·병력은 성마다 따로 정산한다.
##
## **2026-09-13 추가 — 인구 자연 증감 + 재해(disaster).** 3·4절 "제외"에
## 남아 있던 마지막 자동 시스템 — 그동안 "pop은 징병으로만 준다"던 것을
## rtk.js settleMonth() 공식 그대로 되살렸다. 재해는 harvestMul(세수·수확
## 배율)·troops·wall에 매달(지속되는 동안 매번) 영향을 준다 — 원작처럼
## 시작 달에 한 번만이 아니라 `c.disaster`가 남아 있는 한 매달 다시
## 적용된다(플레그 3개월이면 병력이 매달 5%씩 세 번 준다).
func next_month() -> void:
	if not result.is_empty():
		return
	var income := 0
	var harvest := month in RealmOrders.HARVEST_MONTHS
	for city_id: String in cities.keys():
		var c: Dictionary = cities[city_id]

		## rtk.js govMul(cityId) — 그 성에 배치된 무장 중 으뜸(태수)의 자질이
		## 그 성 살림에만 얹힌다. 배치된 무장이 없으면 mul=1.0(rtk.js: !c.gov
		## 이면 1을 돌려주는 것과 같다) — 인재를 안 심은 성은 더 못 큰다.
		var gov_id := _governor_at(city_id)
		var mul := 1.0
		if not gov_id.is_empty():
			mul = RealmOrders.gov_mul(_effective_stat(gov_id, "wisdom"), _effective_stat(gov_id, "command"))
			## rtk.js "태수로 한 달을 앉아 있으면 그만큼 는다" — 자리가 사람을 기른다.
			gain_exp(gov_id, int(RealmGrowth.EXP.gov))

		var dz: Dictionary = RealmOrders.disaster_by_key(String(c.get("disaster", "")))
		var harvest_mul: float = float(dz.get("harvest", 1.0)) if not dz.is_empty() else 1.0

		income += RealmOrders.gold_income(int(c.comm), mul, int(c.sec), harvest_mul)
		if harvest:
			c.food = int(c.food) + RealmOrders.food_income(int(c.agri), mul, int(c.sec), harvest_mul)

		## rtk.js settleMonth() "군량이 떨어지면 병사가 흩어진다" — 병력이
		## 생긴 이상(징병) 매달 군량을 먹는다는 것까지는 옮겨야 징병이 군량과
		## 관계 없는 죽은 숫자가 되지 않는다. troops=0이면 food_upkeep도 0.
		c.food = int(c.food) - RealmOrders.food_upkeep(int(c.troops))
		if int(c.food) < 0:
			var lost := mini(int(c.troops), roundi(-float(c.food) / float(RealmOrders.FOOD_PER_1000) * 1000.0))
			c.troops = int(c.troops) - lost
			c.food = 0

		## rtk.js settleMonth() "치안은 가만두면 내려간다" — 그대로 이식.
		c.sec = clampi(int(c.sec) - 1, 0, 100)

		## 인구 자연 증감 — RealmOrders.pop_growth_delta() 참고.
		var disaster_pop_mul: float = float(dz.get("pop", 0.0)) if not dz.is_empty() else 0.0
		var grow := RealmOrders.pop_growth_delta(int(c.pop), int(c.agri), int(c.sec), disaster_pop_mul)
		c.pop = maxi(RealmOrders.POP_FLOOR, roundi(float(c.pop) + grow))

		## 재해의 병력·성벽 피해 — 지속되는 동안 매달 다시 적용된다(위 머리말).
		if dz.has("troops"):
			c.troops = maxi(0, roundi(float(c.troops) * (1.0 + float(dz.troops))))
		if dz.has("wall"):
			c.wall = maxi(200, int(c.wall) + int(dz.wall))

		## 재해가 지나간다.
		if not String(c.get("disaster", "")).is_empty():
			c.d_left = int(c.d_left) - 1
			if int(c.d_left) <= 0:
				Toast.show(self, "%s %s — %s 이(가) 지나갔다" % [
					String(dz.get("emoji", "☀️")), String(RealmCities.any_by_id(city_id).get("name", city_id)), String(dz.get("name", "")),
				], 3.0)
				c.disaster = ""
				c.d_left = 0

	var upkeep := roster.size() * RealmOrders.UPKEEP_PER_OFFICER
	gold = maxi(0, gold + income - upkeep)

	## diplo.js monthly() — 화친이 달마다 한 달씩 닳는다. 0에서 멈춘다(원작은
	## 다 닳으면 키 자체를 지우는데, 이 슬라이스는 항상 값이 있는 Dictionary로
	## 두는 쪽이 `attack()`의 `dip.get("truce_months",0)` 체크와 더 맞는다).
	for force_id: String in diplomacy.keys():
		var dip: Dictionary = diplomacy[force_id]
		dip.truce_months = maxi(0, int(dip.truce_months) - 1)

	## PLAN 101-2 REALM ②후보 "외교 승리" — 살아있는 세력(아직 성이 하나도
	## 안 넘어온 쪽) 전부가 지금 화친 중이면 이어지고, 하나라도 깨지면
	## 되돌린다. 위에서 막 닳은 truce_months를 그대로 본다("이번 달"
	## 기준이 맞다).
	if _all_alive_forces_at_peace():
		diplomacy_peace_streak += 1
	else:
		diplomacy_peace_streak = 0

	_tick_ambitions()
	_tick_events()
	_tick_succession()
	_check_defection()
	_run_enemy_ai()
	_run_enemy_economy()
	_roll_disasters()

	month += 1
	if month > 12:
		month = 1
		year += 1
	_done_this_month.clear()
	check_result()


## rtk.js rollDisasters() 그대로 — 달마다 한 번, DISASTER_CHANCE 확률로
## 성 하나를 골라 재해(또는 풍년)를 새로 건다. 이미 재해가 있거나 우리
## 성이 아니면(이 슬라이스는 성 셋 다 우리 것이라 사실상 늘 통과) 무시.
## 치안이 낮을수록 "나쁜" 재해(good=false) 쪽으로 기운다(rtk.js
## `0.55 + (60-sec)/200` 그대로, 0.3~0.9로 clamp).
func _roll_disasters() -> void:
	if _rng.randf() > RealmOrders.DISASTER_CHANCE:
		return
	var ids := cities.keys()
	if ids.is_empty():
		return
	var target_id: String = ids[_rng.randi_range(0, ids.size() - 1)]
	var c: Dictionary = cities[target_id]
	if not String(c.get("disaster", "")).is_empty():
		return
	var bad_chance := clampf(0.55 + (60.0 - float(c.sec)) / 200.0, 0.3, 0.9)
	var want_bad := _rng.randf() < bad_chance
	var pool: Array[String] = []
	for key: String in RealmOrders.DISASTERS:
		var d: Dictionary = RealmOrders.DISASTERS[key]
		if bool(d.get("good", false)) != want_bad:
			pool.append(key)
	if pool.is_empty():
		return
	var picked: String = pool[_rng.randi_range(0, pool.size() - 1)]
	var d: Dictionary = RealmOrders.DISASTERS[picked]
	c.disaster = picked
	c.d_left = int(d.months)
	Toast.show(self, "%s %s — %s" % [
		String(d.get("emoji", "")), String(RealmCities.any_by_id(target_id).get("name", target_id)), String(d.get("text", "")),
	], 3.0)


## officer.js checkDefection() — 충성이 12 이하면 35% 확률로 스스로
## 떠난다. 원작은 떠난 사람을 그 성의 재야(found)로 되돌리는데, 이
## 슬라이스는 그 경로를 안 옮겼다(re-hire 창구를 새로 여는 셈이라
## 스코프가 는다) — 로스터·배치·충성 기록에서 조용히 지운다.
func _check_defection() -> void:
	var leaving: Array = []
	for id: String in roster:
		if int(officer_loyal.get(id, 50)) > RealmDiplo.DEFECT_LOYAL_FLOOR:
			continue
		## PLAN 101-2 REALM ③후보 — 충직(자기 이탈 확률을 낮춘다, `realm_
		## traits.gd` TRAIT_LOYAL_DEFECT_MUL 머리말 참고)과 야망 좌절
		## "이간 취약 ×1.5"(재해석 — 자기 이탈 확률에 건다) 둘 다 여기서 곱한다.
		var chance := RealmDiplo.DEFECT_CHANCE
		if RealmTraits.has_trait(id, "loyal_heart"):
			chance *= RealmTraits.TRAIT_LOYAL_DEFECT_MUL
		var amb: Dictionary = officer_ambition.get(id, {})
		if int(amb.get("fail_months", 0)) > RealmTraits.AMBITION_FRUSTRATE_MONTHS:
			chance *= RealmTraits.AMBITION_FRUSTRATE_DEFECT_MUL
		## PLAN 101-2 REALM ⑥후보(계승) — 웹판 §5-8 "야심은 -25 + 3달 안에
		## 이탈 판정 ×2". 창이 지났으면(비교가 실패하면) 그냥 지나간다 —
		## _succeed_lord()가 심은 값을 여기서 지우지 않아도(자연 소멸) 되는
		## 이유는 이 비교 하나로 충분해서다(굳이 매달 청소 안 해도 안전).
		if _succession_shock_until.has(id) and RealmTraits.has_trait(id, "ambitious"):
			var due: Dictionary = _succession_shock_until[id]
			if year < int(due.year) or (year == int(due.year) and month <= int(due.month)):
				chance *= SUCCESSION_AMBITIOUS_DEFECT_MUL
		if _rng.randf() > chance:
			continue
		leaving.append(id)
	for id: String in leaving:
		roster.erase(id)
		officer_city.erase(id)
		officer_loyal.erase(id)
		_succession_shock_until.erase(id)


## `officer_growth()`와 같은 지연 초기화 — 처음 보는 무장이면 `RealmTraits.
## ambition_of()`로 결정적인 야망 하나를 배정한다(이후 절대 안 바뀐다).
func _ambition(id: String) -> Dictionary:
	if not officer_ambition.has(id):
		officer_ambition[id] = {"k": RealmTraits.ambition_of(id), "prog": 0, "done": false, "fail_months": 0}
	return officer_ambition[id]


## PLAN 101-2 REALM ③후보 — 웹판 §5-1 "무장 카드에 특성 배지 2개·야망
## 한 줄과 진행 막대"의 3D 판. 이 슬라이스엔 그림 카드가 없어(전부 텍스트
## `ChoicePrompt` 라벨) 승진·전임처럼 **사람을 직접 고르는 화면**에만
## 한 줄로 얹는다(등용·태수·출진은 자동 선택이라 고르는 화면 자체가 없다).
func officer_hint(id: String) -> String:
	var badge := RealmTraits.trait_badge(id)
	var amb := _ambition(id)
	var def: Dictionary = RealmTraits.AMBITIONS.get(String(amb.k), {})
	var mark := "달성" if bool(amb.get("done", false)) else "%d/%d" % [int(amb.get("prog", 0)), int(def.get("target", 1))]
	return "%s 야망:%s(%s)" % [badge, String(def.get("name", "")), mark]


## PLAN 101-2 REALM ③후보(웹판 §5-1) — 달마다 로스터 전원의 야망 진행도를
## 다시 잰다. 대부분은 "지금 상태가 문턱을 넘었는가"를 그대로 다시 계산하는
## 절대값 판정이라(연속 개월만 예외 — 태수) 저장된 `prog`는 표시용 스냅샷일
## 뿐 판정 자체는 매번 새로 한다(진단이 "결과가 재현 가능"하려면 이쪽이
## 과거 이벤트를 따로 누적하는 것보다 안전하다).
func _tick_ambitions() -> void:
	for id: String in roster:
		if Characters.find(id) == null:
			continue
		var amb := _ambition(id)
		if bool(amb.get("done", false)):
			continue
		var key: String = String(amb.k)
		var def: Dictionary = RealmTraits.AMBITIONS.get(key, {})
		if def.is_empty():
			continue
		var target := int(def.target)
		var prog := 0
		match key:
			"governor":
				var is_gov := false
				for city_id: String in cities.keys():
					if _governor_at(city_id) == id:
						is_gov = true
						break
				prog = mini(target, int(amb.get("prog", 0)) + 1) if is_gov else 0
			"hometown":
				prog = mini(target, cities.size())
			"rival":
				prog = mini(target, enemies_subverted)
			"wealth":
				prog = mini(target, gold)
			"fame":
				prog = mini(target, int(_growth(id).get("rank", 0)))
			"scholar":
				prog = mini(target, quiz.learned.size())
		amb.prog = prog
		if prog >= target:
			amb.done = true
			amb.fail_months = 0
			_grant_ambition_reward(id, key)
		else:
			amb.fail_months = int(amb.get("fail_months", 0)) + 1
			## 웹판 §5-1 "12달 넘게 좌절이면 충성 -3/달" — 이간 취약 배율은
			## `_check_defection()`이 이 `fail_months`를 직접 읽어 적용한다.
			if int(amb.fail_months) > RealmTraits.AMBITION_FRUSTRATE_MONTHS:
				officer_loyal[id] = clampi(int(officer_loyal.get(id, 50)) - RealmTraits.AMBITION_FRUSTRATE_LOYAL_HIT, 0, 100)
		officer_ambition[id] = amb


## 야망 달성 보상 — 웹판 §5-1 "충성 +20·능력 +2 영구" 그대로.
func _grant_ambition_reward(id: String, key: String) -> void:
	officer_loyal[id] = clampi(int(officer_loyal.get(id, 50)) + RealmTraits.AMBITION_DONE_LOYAL, 0, 100)
	var stat_key := String(RealmTraits.AMBITIONS[key].get("reward_stat", "wisdom"))
	_add_growth_bonus(id, stat_key, RealmTraits.AMBITION_DONE_STAT)
	var h = Characters.find(id)
	if h != null:
		Toast.show(self, "🎯 %s — 야망 \"%s\"을(를) 이루었다! 충성 +%d · %s +%d" % [
			String(h.name), String(RealmTraits.AMBITIONS[key].name),
			RealmTraits.AMBITION_DONE_LOYAL, stat_key, RealmTraits.AMBITION_DONE_STAT,
		], 3.0)


## PLAN 101-2 REALM ⑤후보(웹판 §5-2) — 달마다 한 번, 로스터 중 이미 걸린
## 카드가 없는 무장을 골라 `RealmEvents.EVENT_CHANCE`(18%) 확률로 새 이벤트를
## 하나 건다(웹판 "세력당 동시 진행 체인 최대 2" — `active_events`엔 아직
## 도달 안 한 체인 후속도 포함되므로, 체인이 밀려 있으면 새 이벤트가 덜
## 뜬다는 뜻도 된다, 웹판과 같은 결).
func _tick_events() -> void:
	if active_events.size() >= RealmEvents.MAX_CONCURRENT or roster.is_empty():
		return
	if _rng.randf() > RealmEvents.EVENT_CHANCE:
		return
	var busy: Dictionary = {}
	for e: Dictionary in active_events:
		busy[String(e.officer)] = true
	var candidates: Array = []
	for id: String in roster:
		if not busy.has(id):
			candidates.append(id)
	if candidates.is_empty():
		return
	var officer_id: String = candidates[_rng.randi_range(0, candidates.size() - 1)]
	var amb := _ambition(officer_id)
	var event_id := RealmEvents.pick_for(officer_id, String(amb.k), _rng)
	if event_id.is_empty():
		return
	active_events.append({"id": event_id, "officer": officer_id, "due_month": month, "due_year": year})


## 지금 화면에 띄워 고를 수 있는 이벤트들 — `active_events`의 인덱스를
## 그대로 돌려준다(`resolve_event()`가 그 인덱스로 다시 찾는다). 체인
## 후속이 아직 예약된 미래 달이면(`due_year`/`due_month`가 지금보다 뒤)
## 빠진다.
func ready_events() -> Array[int]:
	var out: Array[int] = []
	for i in active_events.size():
		var e: Dictionary = active_events[i]
		if int(e.due_year) < year or (int(e.due_year) == year and int(e.due_month) <= month):
			out.append(i)
	return out


## choice_idx로 고른 효과를 얹고 카드를 치운다 — 체인이 있으면 `chain_months`
## 뒤로 후속을 새로 건다(같은 무장). 인덱스가 비정상이면(이미 처리됐거나
## UI가 낡은 목록을 들고 있으면) 조용히 false.
func resolve_event(index: int, choice_idx: int) -> bool:
	if index < 0 or index >= active_events.size():
		return false
	var e: Dictionary = active_events[index]
	var def: Dictionary = RealmEvents.by_key(String(e.id))
	var choices: Array = def.get("choices", [])
	if def.is_empty() or choice_idx < 0 or choice_idx >= choices.size():
		return false
	var choice: Dictionary = choices[choice_idx]
	var officer_id: String = String(e.officer)

	officer_loyal[officer_id] = clampi(int(officer_loyal.get(officer_id, 50)) + int(choice.get("loyal", 0)), 0, 100)
	gold = maxi(0, gold + int(choice.get("gold", 0)))
	if int(choice.get("exp", 0)) > 0:
		gain_exp(officer_id, int(choice.exp))
	## 야망 "숙적"(realm_traits.gd AMBITIONS.rival) 진척 — realm_events.gd
	## rival_chance 항목의 두 선택이 이 플래그를 켠다(같은 판정 없이 곧바로
	## "계략 성공"으로 재해석 — 실제 계략 성공률 판정은 plot()이 이미
	## 따로 있어 여기서 다시 굴리지 않는다, 이벤트 자체가 "기회가 왔다"는
	## 서사라 고르면 곧바로 진척된다).
	if bool(choice.get("ambition_progress", false)):
		var amb := _ambition(officer_id)
		if String(amb.k) == "rival" and not bool(amb.get("done", false)):
			amb.prog = int(amb.get("prog", 0)) + 1

	active_events.remove_at(index)
	events_done[String(e.id)] = int(events_done.get(String(e.id), 0)) + 1

	var chain_id := String(choice.get("chain", ""))
	if not chain_id.is_empty():
		var due_m := month
		var due_y := year
		for _i in int(choice.get("chain_months", 3)):
			due_m += 1
			if due_m > 12:
				due_m = 1
				due_y += 1
		active_events.append({"id": chain_id, "officer": officer_id, "due_month": due_m, "due_year": due_y})

	var h = Characters.find(officer_id)
	Toast.show(self, "%s %s — %s: %s" % [
		String(def.get("emoji", "📜")), String(h.name) if h != null else officer_id,
		String(def.get("name", "")), String(choice.get("label", "")),
	], 3.0)
	return true


## PLAN 101-2 REALM ⑥후보(웹판 §5-8) — 나이 시스템이 없어 매달 고정 확률로
## "군주 유고"를 굴린다(손잡이 꺼짐이면 건드리지 않는다). 0.6%/달은 대략
## 평균 14년에 한 번 — 웹판 "65세+ 사망 확률은 부하의 절반"이 이 슬라이스엔
## 잴 기준(부하 사망 확률 자체)이 없어 직접 낮게 잡은 값이다.
const LORD_DEATH_CHANCE_MONTHLY := 0.006
const SUCCESSION_DEFAULT_LOYAL_HIT := -15   # 웹판 "-10~-20" 중간값
const SUCCESSION_AMBITIOUS_LOYAL_HIT := -25 # 웹판 "야심은 -25" 그대로
const SUCCESSION_AMBITIOUS_DEFECT_MUL := 2.0 # 웹판 "이탈 판정 ×2" 그대로
const SUCCESSION_SHOCK_MONTHS := 3           # 웹판 "3달 안에" 그대로


func _tick_succession() -> void:
	if not lord_succession_enabled:
		return
	if _rng.randf() > LORD_DEATH_CHANCE_MONTHLY:
		return
	_succeed_lord()


## 지정된 후계(로스터에 아직 있으면)가 있으면 그 사람, 없으면 웹판 그대로
## "충성 최고 → 관직 최고" 순으로 자동 고른다. 로스터가 비어 있으면(극단
## 상황) ""을 돌려 계승 자체를 건너뛴다.
func _pick_heir() -> String:
	if not heir_id.is_empty() and roster.has(heir_id):
		return heir_id
	var best := ""
	var best_loyal := -1
	var best_rank := -1
	for id: String in roster:
		var loyal := int(officer_loyal.get(id, 50))
		var g: Dictionary = officer_growth.get(id, {"rank": 0})
		var rank := int(g.get("rank", 0))
		if loyal > best_loyal or (loyal == best_loyal and rank > best_rank):
			best = id
			best_loyal = loyal
			best_rank = rank
	return best


## 웹판 §5-8 "사망 시 후계자가 군주(충성 100 고정 이양), 다른 무장 충성
## -10~-20(충직 0·야심 -25+3달 이탈×2)" 그대로 — AI 자동 후계까지는
## 이 슬라이스에 적(AI 세력) 무장 로스터·군주 개념이 없어(§4 "제외") 옮기지
## 않는다(우리 세력 한정, 웹판도 "AI도 같은 함수"일 뿐 새 판정은 아니다).
func _succeed_lord() -> void:
	if roster.is_empty():
		return
	var new_lord := _pick_heir()
	if new_lord.is_empty():
		return
	var old_lord_id := current_lord_id
	current_lord_id = new_lord
	officer_loyal[new_lord] = 100
	for id: String in roster:
		if id == new_lord:
			continue
		var hit := SUCCESSION_DEFAULT_LOYAL_HIT
		if RealmTraits.has_trait(id, "loyal_heart"):
			hit = 0
		elif RealmTraits.has_trait(id, "ambitious"):
			hit = SUCCESSION_AMBITIOUS_LOYAL_HIT
			var due_m := month
			var due_y := year
			for _i in SUCCESSION_SHOCK_MONTHS:
				due_m += 1
				if due_m > 12:
					due_m = 1
					due_y += 1
			_succession_shock_until[id] = {"month": due_m, "year": due_y}
		officer_loyal[id] = clampi(int(officer_loyal.get(id, 50)) + hit, 0, 100)
	heir_id = ""  # 이번 지정은 소비됐다 — 다음 계승을 위해선 다시 지정해야 한다
	var old_h = Characters.find(old_lord_id)
	var new_h = Characters.find(new_lord)
	var new_lord_name := String(new_h.name) if new_h != null else new_lord
	Toast.show(self, "⚰️ %s 별세 — 👑 %s 즉위" % [
		String(old_h.name) if old_h != null else old_lord_id,
		new_lord_name,
	], 4.0)
	LordPortrait.show_lord(self, new_lord_name, 4.0)


const AI_MARCH_CHANCE := 0.20  # 재해석 — 아래 _run_enemy_ai() 머리말 참고
const AI_TROOPS_FLOOR := 500   # attack()의 "오백은 넘겨야 군대라 하지요"와 같은 문턱


## rtk-ai.js의 "사람이 다음 달을 누르면 나머지 세력이 제 명령을 쓴다"를
## 좁혀 옮긴 것(2026-09-14, 4절 "제외" 타 세력 AI 첫 슬라이스, "묻지말고
## 이어해" → 같은 날 이어서 "묻지말고 이어해" 두 번째로 creed 차등 추가).
## **재해석 — 셋.**
## - **creed(성향) 차등 — `RealmCities.CREED`/`creed_chance_mul()`로
##   옮겼다.** 단, rtk-ai.js 자체엔 "친다/안 친다" 확률표가 없다(실제
##   판단은 매번 war.forecast()로 다시 계산한다) — 이 슬라이스엔 그
##   예측 판정이 없어, creed를 "얼마나 자주 치려 드는가"(`AI_MARCH_
##   CHANCE * creed_chance_mul()`, aggressive 1.5배·turtle 0.35배)로
##   옮겨 놓은 단순화다. 경제 성장 AI(pickOrder)를 옮길 때 이 표를
##   다시 쓸 것(같은 CREED, 다른 쓰임).
## - **AI가 이겨도 성을 뺏지 않는다.** 세력 멸망/패배 판정이 이
##   슬라이스에 없어(attack() 머리말·4절 "제외" 참고) 플레이어가 성을
##   전부 잃는 막다른 상태를 만들 수 있으면 안 된다 — 병력·성벽 손실만
##   입힌다. 승패 판정 자체(war.js와 같은 공식)는 그대로 굴린다 —
##   그 결과로 만들어진 troops/wall 변화만 실제로 반영한다.
## - **주인 없는 성(재야 수비대, force가 빈 문자열)은 움직이지 않는다**
##   — diplo.js의 "주인 없는 성은 계략 대상이 아니다"와 같은 결(
##   `realm_diplo_button.gd`/`realm_plot_button.gd`가 이미 이 가드를
##   쓴다). 화친 중(`diplomacy[].truce_months>0`)이면 마찬가지로 쉰다
##   (war.js canMarch()의 diplo.blocked() 체크와 같은 자리).
func _run_enemy_ai() -> Array:
	var messages: Array = []
	for enemy_id: String in enemies.keys():
		var e: Dictionary = enemies[enemy_id]
		if bool(e.get("captured", false)):
			continue
		var enemy_def := RealmCities.enemy_by_id(enemy_id)
		var force_id := force_of(enemy_id)
		if force_id.is_empty():
			continue
		var dip: Dictionary = diplomacy.get(force_id, {})
		if int(dip.get("truce_months", 0)) > 0:
			continue
		if int(e.troops) < AI_TROOPS_FLOOR:
			continue
		var target_id := _weakest_adjacent_playable(enemy_id)
		if target_id.is_empty():
			continue
		var chance := AI_MARCH_CHANCE * RealmCities.creed_chance_mul(force_id)
		if _rng.randf() > chance:
			continue
		var msg := _enemy_attack(enemy_id, e, target_id)
		if not msg.is_empty():
			messages.append(msg)
	if not messages.is_empty():
		Toast.show(self, "\n".join(messages), 3.0 + float(messages.size()))
	return messages


## 이 적 성과 맞닿은 우리 성(playable_ids가 아니라 cities — 정복 여부와
## 무관하게 실제 우리 살림이 있는 성만 노린다) 중 병력이 가장 적은 곳.
func _weakest_adjacent_playable(enemy_id: String) -> String:
	var best_id := ""
	var best_troops := -1
	for city_id: String in cities.keys():
		if not RealmCities.is_adjacent(enemy_id, city_id):
			continue
		var t := int(cities[city_id].troops)
		if best_id.is_empty() or t < best_troops:
			best_id = city_id
			best_troops = t
	return best_id


## war.js march()+fight()를 적 쪽 시점으로 좁혀 옮긴 것 — attack()과
## 판정식은 완전히 같다(RealmWar.fight 그대로), 공격/수비 배역만 뒤집힌다.
## 수비 측(우리) 병력은 그 성의 troops 전부, 장수는 officer_city로 배치된
## 사람 **전원**(off.atCity()와 같은 뜻) — player attack()이 공격 측에서
## 하나만 데려가는 것과 다르다(수비는 원래도 그 성에 있는 사람 전부가
## 함께 막는다).
func _enemy_attack(enemy_id: String, e: Dictionary, target_id: String) -> String:
	var enemy_def := RealmCities.enemy_by_id(enemy_id)
	var c: Dictionary = cities[target_id]

	var def_officers: Array = []
	for id: String in roster:
		if officer_city.get(id, "") == target_id:
			def_officers.append(id)
	var def_best_command := 0.0
	var def_best_might := 0.0
	for oid: String in def_officers:
		def_best_command = maxf(def_best_command, _effective_stat(oid, "command"))
		def_best_might = maxf(def_best_might, _effective_stat(oid, "might"))
	var def_army := {
		"troops": int(c.troops), "start": int(c.troops), "train": int(c.train), "tech": int(c.tech),
		"best_command": def_best_command, "best_might": def_best_might, "officer_count": def_officers.size(),
	}

	var atk_officers: Array = e.get("officers", [])
	var atk_best_command := 0.0
	var atk_best_might := 0.0
	for oid: String in atk_officers:
		if Characters.find(oid) == null:
			continue
		atk_best_command = maxf(atk_best_command, _effective_stat(oid, "command"))
		atk_best_might = maxf(atk_best_might, _effective_stat(oid, "might"))
	var atk_army := {
		"troops": int(e.troops), "start": int(e.troops), "train": int(e.train), "tech": int(e.tech),
		"best_command": atk_best_command, "best_might": atk_best_might, "officer_count": atk_officers.size(),
	}

	var wall := {"wall": int(c.wall), "max_wall": RealmCities.wall_cap(target_id)}
	var land: String = String(RealmCities.any_by_id(target_id).get("land", "plain"))
	var rep := RealmWar.fight(atk_army, def_army, wall, RealmCities.land_def(land), RealmCities.land_siege(land), _rng)

	c.wall = wall.wall
	c.troops = rep.def_troops_left
	e.troops = rep.atk_troops_left
	enemies[enemy_id] = e

	var enemy_name := String(enemy_def.get("name", enemy_id))
	var city_name := String(RealmCities.any_by_id(target_id).get("name", target_id))
	if rep.won:
		return "⚔️ %s 이(가) %s 을(를) 쳐 성이 크게 흔들렸다 (아군 손실 %d · 적 손실 %d)" % \
			[enemy_name, city_name, int(rep.loss_d), int(rep.loss_a)]
	return "⚔️ %s 이(가) %s 을(를) 쳤으나 물리쳤다 (아군 손실 %d · 적 손실 %d)" % \
		[enemy_name, city_name, int(rep.loss_d), int(rep.loss_a)]


## rtk-ai.js pickOrder()를 적 세력 쪽으로 좁혀 옮긴 것(2026-09-14, "묻지말고
## 이어해" 네 번째 — 4절 "제외" 셋 중 economy AI). **재해석 — 적(enemies)은
## agri/comm/gold/pop을 안 갖는다(`_init_enemies()` 참고, 원래 전투용
## 값만 있었다)** — pickOrder 우선순위 중 이 슬라이스에 실제로 있는 필드
## (sec/wall/train/tech)만 옮기고 나머지(agri·comm·draft·ships)는 뺐다.
## 금 소모도 없다 — 적에게 금고 자체가 없어(플레이어처럼 명령을 "사는"
## 구조가 아니다), 세력이 살아 있는 한(captured=false, 장수 1명 이상)
## 매달 그대로 자란다.
## 이게 없으면 한 번 계략·전투로 깎인 적 성은 영영 그 값에 멈춰 있었다 —
## troops/wall/sec/train/tech 중 내려가는 경로(전투·`realm_plot_button.gd`
## 유언비어)는 있어도 올라가는 경로가 하나도 없어, 플레이어가 초반에 계속
## 같은 약한 이웃만 노려도 손해가 없었다.
func _run_enemy_economy() -> void:
	for enemy_id: String in enemies.keys():
		var e: Dictionary = enemies[enemy_id]
		if bool(e.get("captured", false)):
			continue
		var officers: Array = e.get("officers", [])
		if officers.is_empty():
			continue
		var key := _enemy_pick_order(e)
		if key.is_empty():
			continue
		var o := RealmOrders.by_key(key)
		var officer_id := _best_enemy_officer(officers, String(o.stat))
		if officer_id.is_empty():
			continue
		var stat_val: float = _effective_stat(officer_id, String(o.stat))
		var crit := _rng.randf() < clampf(stat_val / 400.0, 0.03, 0.28)
		var amount := roundi((float(o.base) + stat_val * float(o.per)) * (1.5 if crit else 1.0))
		match key:
			"sec": e.sec = mini(RealmOrders.CAP_SEC, int(e.sec) + amount)
			"wall": e.wall = mini(int(e.max_wall), int(e.wall) + amount)
			"train": e.train = mini(RealmOrders.CAP_TRAIN, int(e.train) + amount)
			"tech": e.tech = mini(RealmOrders.CAP_TECH, int(e.tech) + amount)
		enemies[enemy_id] = e


## rtk-ai.js pickOrder() 우선순위 그대로, 적에게 있는 네 필드로 좁힌 버전
## (sec<45 → sec, wall<maxWall*0.7 → wall, train<70 → train, tech<400 →
## tech, sec<85 → sec — food/agri/comm/wall(공성 없음)/draft/ships 문턱은
## 이 슬라이스의 enemies에 해당 필드가 없어 전부 뺐다). 넷 다 문턱을 채웠으면
## 빈 문자열(그 성은 이미 다 자랐다 — 아무것도 안 한다).
func _enemy_pick_order(e: Dictionary) -> String:
	if int(e.sec) < 45:
		return "sec"
	if int(e.wall) < int(e.max_wall) * 0.7:
		return "wall"
	if int(e.train) < 70:
		return "train"
	if int(e.tech) < 400:
		return "tech"
	if int(e.sec) < 85:
		return "sec"
	return ""


## rtk-ai.js bestFor() 축약 — 그 명령에 맞는 자질이 가장 높은 적 장수.
func _best_enemy_officer(officers: Array, stat_key: String) -> String:
	var best_id := ""
	var best_val := -1.0
	for oid: String in officers:
		if Characters.find(oid) == null:
			continue
		var v: float = _effective_stat(oid, stat_key)
		if v > best_val:
			best_val = v
			best_id = oid
	return best_id


## rtk.js checkResult() — 승패 판정. 한 번 정해지면(`result`가 빈 문자열이
## 아니면) 그대로 굳는다(원작의 `if (st.result) return st.result;`).
## **"lose"는 이 슬라이스에서 도달 불가능하다** — `_enemy_attack()`이
## 이겨도 성을 안 뺏어 `cities`가 절대 비지 않는다(위 `result` 변수
## 머리말 참고). "win"만 실제로 판정한다 — 성 우주 전체(기본 3 + 정복
## 대상 104 = 107)를 전부 갖게 되면 천하통일.
const CULTURE_VICTORY_CORRECT := 200   # 웹판 §5-5 "학당 문답 정답 200" 그대로
const DIPLOMACY_VICTORY_MONTHS := 36   # 웹판 §5-5 "36달 연속" 그대로


func check_result() -> String:
	if not result.is_empty():
		return result
	if cities.size() >= RealmCities.ids().size() + RealmCities.ENEMY_CITIES.size():
		result = "win"
		_show_victory_card("👑 천하통일", "패업을 이루었다 — 천하가 하나가 되었다.")
	elif int(quiz.get("correct", 0)) >= CULTURE_VICTORY_CORRECT:
		result = "win_culture"
		_show_victory_card("📚 문화의 으뜸", "학당 문답 %d개를 맞혀 학식으로 천하의 으뜸이 되었다." % CULTURE_VICTORY_CORRECT)
	elif diplomacy_peace_streak >= DIPLOMACY_VICTORY_MONTHS:
		result = "win_diplomacy"
		_show_victory_card("🕊️ 화친의 시대", "%d달 동안 살아있는 모든 세력과 화친을 지켰다." % DIPLOMACY_VICTORY_MONTHS)
	return result


## 웹판 §5-5 "결과 카드"(걸린 달·성·인물·기록) 재해석 — 이 슬라이스가
## 가진 값(연월·성·로스터)만 3줄로 좁혔다("인물 5인"·"다음 도전"은 아직
## 없는 시스템이라 뺐다). GO/FOREST/STORY save_button.gd와 같은
## SessionCard 패턴.
func _show_victory_card(title: String, sub: String) -> void:
	SessionCard.show(self, title, [
		sub,
		"%d년 %d월" % [year, month],
		"성 %d개 · 로스터 %d명" % [cities.size(), roster.size()],
	])


## 웹판 §5-5 "살아 있는 모든 세력과 화친"의 이 슬라이스 판. city_force는
## 시나리오 시작 시점 스냅샷이라(위 _init_city_force() 머리말) "아직 우리
## 것이 안 된 성이 남은 force"만 본다 — diplomacy.keys()를 그대로 쓰면
## 이미 멸망한(성을 다 뺏은) 세력의 죽은 항목까지 세게 된다.
func _all_alive_forces_at_peace() -> bool:
	var checked: Dictionary = {}
	for eid: String in city_force:
		if cities.has(eid):
			continue
		var fid: String = String(city_force[eid])
		if fid.is_empty() or checked.has(fid):
			continue
		checked[fid] = true
		var dip: Dictionary = diplomacy.get(fid, {"truce_months": 0})
		if int(dip.get("truce_months", 0)) <= 0:
			return false
	return true


## rtk.js war.js moveOfficer() — 무장을 맞닿은 성으로 옮긴다(그 달의 명령을
## 쓴다). 이 슬라이스는 성 셋이 전부 우리 것이라 원작의 `to.force !== r.force`
## 체크(남의 성인가)는 늘 통과 — 맞닿음과 "이 달에 이미 명령을 썼는가"만
## 실제로 갈린다. 태수(`from.gov = null`) 정리는 옮기지 않았다 — 이 슬라이스는
## 태수를 저장하지 않고 `_governor_at()`이 매번 배치를 보고 다시 골라서다.
func transfer_officer(officer_id: String, to_city_id: String) -> Dictionary:
	if not (officer_id in roster):
		return {"ok": false, "why": "로스터에 없는 무장"}
	var from_city: String = officer_city.get(officer_id, "")
	if from_city == to_city_id:
		return {"ok": false, "why": "이미 그 성에 있습니다"}
	if not RealmCities.is_adjacent(from_city, to_city_id):
		return {"ok": false, "why": "맞닿아 있지 않습니다"}
	if _done_this_month.get(officer_id, false):
		return {"ok": false, "why": "이 달에 이미 명령을 썼습니다"}

	officer_city[officer_id] = to_city_id
	_done_this_month[officer_id] = true
	return {"ok": true}


## war.js march()+fight()+finishMarch()를 좁혀 옮긴 것(2026-09-12, "전쟁
## 외교 이어해") — `realm_war.gd`가 판정 자체(armyPower/stepRound/fight)를
## 맡고, 여기는 원작 setupMarch()/finishMarch()가 하던 "출진 준비 → 판정
## 호출 → 뒤처리"만 좁혀서 한다. **재해석**:
## - 수량 선택 UI가 없다 — `from_city`에 있는 **전군**을 보낸다(이 판
##   다른 명령들처럼 버튼 하나로 결과만 보는 것과 같은 결).
## - 원정 준비(setupMarch)의 구원군(reinforce)·개입형 진행(marchInteractive)
##   은 안 옮겼다 — 적이 하나뿐이고 이웃 성도 없어 구원군 자체가 없다.
## - 승부가 안 갈리면(stalemate) 원작은 진(camp)을 쳐 다음 달로 넘기는데,
##   이 슬라이스엔 진영 시스템이 없어(realm_war.gd 머리말 참고) **routed와
##   같이 취급** — 살아남은 병력이 그냥 돌아간다.
## - 이기면(capture) 원작의 관리 인계(무장 배치·태수·치안 반토막·agri/
##   comm/pop 편입 등)는 `_annex_city()`(2026-09-12)와 이 함수의 승리
##   분기(officer_city 배치, 2026-09-14, "정복 후 관리" 이어감)로 전부
##   옮겨졌다 — 정복한 성은 그 자리에서 곧바로 playable_ids()에 들어가
##   조망·명령 대상이 된다. **세력 멸망 판정**(원작 checkResult())만
##   여전히 안 옮겼다 — `enemies` Dictionary가 성을 세력별로 묶지 않아,
##   107개 성 편입 이후 범위가 커진 채 다음에 볼 자리로 남아 있다.
## **2026-09-17 추가 — PLAN 101-2 REALM ④후보 "일기토"(웹판 §5-3).**
## `duel_moves`(플레이어가 미리 고른 최대 3수, `RealmWar.DUEL_MOVES` 값)를
## 안 주면(빈 배열) 지금까지와 완전히 동치 — 진단 "AI 일기토 무영향"·
## "선택 없이 자동으로 돌리면 기존 fight()와 결과 동일"이 이 기본값
## 하나로 보장된다.
func attack(enemy_id: String, duel_moves: Array = []) -> Dictionary:
	var enemy_def := RealmCities.enemy_by_id(enemy_id)
	if enemy_def.is_empty():
		return {"ok": false, "why": "없는 목표"}
	var e: Dictionary = enemies.get(enemy_id, {})
	if bool(e.get("captured", false)):
		return {"ok": false, "why": "이미 함락한 성입니다"}
	## war.js canMarch() "diplo.blocked()" 체크와 같은 자리 — 화친 중이면
	## 못 친다(2026-09-12 외교 슬라이스, `realm_diplo.gd` 머리말 참고).
	var force_id: String = force_of(enemy_id)
	var dip: Dictionary = diplomacy.get(force_id, {})
	if int(dip.get("truce_months", 0)) > 0:
		return {"ok": false, "why": "맹약이 있어 칠 수 없습니다"}

	var from_city: String = String(enemy_def.get("from_city", ""))
	if not cities.has(from_city):
		return {"ok": false, "why": "없는 출진 성"}
	var c: Dictionary = cities[from_city]
	var troops: int = int(c.troops)
	if troops < 500:
		return {"ok": false, "why": "오백은 넘겨야 군대라 하지요"}  # war.js canMarch()와 같은 문구

	var officer_id := _best_officer_for("might", from_city)
	if officer_id.is_empty():
		return {"ok": false, "why": "데려갈 장수가 없습니다"}
	if _done_this_month.get(officer_id, false):
		return {"ok": false, "why": "이 달에 이미 명령을 썼습니다"}

	## war.js canMarch() "원정 군량 — 병력의 한 달치는 들고 가야 한다"(×2).
	var need := RealmOrders.food_upkeep(troops) * 2
	if int(c.food) < need:
		return {"ok": false, "why": "군량이 모자랍니다"}

	c.troops = 0
	c.food = int(c.food) - need

	## PLAN 101-2 REALM ④후보 — 일기토 3합(`RealmWar` 상수·판정 참고). 합마다
	## AI 수를 그 자리에서 굴려(`_rng`, 진단 결정성 유지) 결과·배율을 매기고,
	## 3합 배율의 평균을 이 싸움 전체의 위력에 곱한다(머리말 재해석 참고).
	var duel_rounds: Array = []
	var duel_mul := 1.0
	if not duel_moves.is_empty():
		var mul_sum := 0.0
		for player_move: String in (duel_moves as Array).slice(0, RealmWar.DUEL_ROUNDS):
			var enemy_move := RealmWar.duel_ai_move(_rng)
			var res := RealmWar.duel_round_result(String(player_move), enemy_move)
			var mul := RealmWar.duel_round_mul(res)
			duel_rounds.append({"player": player_move, "enemy": enemy_move, "result": res})
			mul_sum += mul
		duel_mul = mul_sum / float(duel_rounds.size())

	## PLAN 101-2 REALM ③후보 — 호전(웹판 §5-1 "일기토 발생률" 재해석,
	## `realm_traits.gd` TRAIT_MILITANT_MIGHT_MUL 참고). 일기토(④, 위)가
	## 이번 세션에 따로 생겼지만 호전의 위력 배율은 그와 별개로 쌓는다
	## (하나는 특성, 하나는 그때그때 플레이어 선택 — 서로 다른 축).
	var atk_might := _effective_stat(officer_id, "might")
	if RealmTraits.has_trait(officer_id, "militant"):
		atk_might *= RealmTraits.TRAIT_MILITANT_MIGHT_MUL
	atk_might *= duel_mul
	var atk := {
		"troops": troops, "start": troops, "train": int(c.train), "tech": int(c.tech),
		"best_command": _effective_stat(officer_id, "command"), "best_might": atk_might,
		"officer_count": 1,
	}
	## **2026-09-12 갱신 — 이간·매수로 이름 있는 수비 무장이 생겼다.**
	## `e.officers`(비면 예전처럼 0)를 그대로 반영한다 — 매수·이간으로
	## 미리 빼내면 그만큼 수비가 약해진다(officer_count·best_command·
	## best_might가 실제로 준다).
	var def_officers: Array = e.get("officers", [])
	var def_best_command := 0.0
	var def_best_might := 0.0
	for oid: String in def_officers:
		if Characters.find(oid) == null:
			continue
		def_best_command = maxf(def_best_command, _effective_stat(oid, "command"))
		def_best_might = maxf(def_best_might, _effective_stat(oid, "might"))
	var def_army := {
		"troops": int(e.troops), "start": int(e.troops), "train": int(e.train), "tech": int(e.tech),
		"best_command": def_best_command, "best_might": def_best_might, "officer_count": def_officers.size(),
	}
	var wall := {"wall": int(e.wall), "max_wall": int(e.max_wall)}
	var land: String = String(enemy_def.get("land", "plain"))

	var rep := RealmWar.fight(atk, def_army, wall, RealmCities.land_def(land), RealmCities.land_siege(land), _rng)
	_done_this_month[officer_id] = true
	## war.js march() "따라나선 것만으로도 는다 — 이기고 지고는 그다음이다".
	gain_exp(officer_id, int(RealmGrowth.EXP.march))

	e.wall = wall.wall
	var boss_beaten := ""
	if rep.won:
		e.captured = true
		e.troops = 0
		## war.js capture() "보스전"(README 여덟 축) — 성을 잃기 전 수비
		## 명단에 `boss:true`인 사람이 있었는지 먼저 본다(아래서 이 사람들
		## 자리가 옮겨지기 전에). 새 전투 판정은 없다 — fight()가 이미 끝낸
		## 결과에 보상만 얹는다. **재해석 — 유물은 안 준다.** 원작은
		## ID.randomItem()으로 유물도 하나 얹는데, 이 슬라이스엔 장비/유물
		## 시스템 자체가 없어(REALM에 data-item.js 대응이 없다) 금 보너스만
		## 옮겼다(quiz_answer()가 feat/fame/scroll을 뺀 것과 같은 결).
		for oid: String in def_officers:
			var bh = Characters.find(oid)
			if bh != null and bool(bh.get("boss", false)):
				boss_beaten = String(bh.name)
				break
		if not boss_beaten.is_empty():
			gold += BOSS_BONUS_GOLD
		## war.js capture() "사로잡힌다" — 소패는 몸 붙일 이웃 성이 없어
		## (refuge 없음, `bei`가 소패 하나뿐) 원작에서도 전부 사로잡히는
		## 경로만 탄다. 사로잡힌 무장은 그 성(이제 우리 성)의 재야가
		## 된다(`off.rec(id).found=true`와 같은 결) — 매수·이간으로 미리
		## 빼낸 이는 이미 e.officers에서 빠져 여기 안 걸린다.
		for oid: String in (def_officers as Array).duplicate():
			if not (oid in found) and not (oid in roster):
				found.append(oid)
			enemy_officer_loyal.erase(oid)
		e.officers = []
		_annex_city(enemy_id, enemy_def, int(rep.atk_troops_left), int(c.train))
		## war.js capture() "데려간 장수는 그 성에 남는다" — off.placeAt()
		## 그대로. `_governor_at()`이 officer_city를 매번 다시 훑는 구조라
		## (머리말 참고) 태수를 따로 저장할 필요 없이 이 한 줄로 새 성에
		## 태수가 선다. feats+=3·충성+3·EXP.win도 같이 — 이 슬라이스는
		## 장수 하나(officer_id)뿐이라 그 한 명만 받는다.
		officer_city[officer_id] = enemy_id
		var wg := _growth(officer_id)
		wg.feats = int(wg.feats) + 3
		officer_loyal[officer_id] = clampi(int(officer_loyal.get(officer_id, 50)) + 3, 0, 100)
		gain_exp(officer_id, int(RealmGrowth.EXP.win))
	else:
		## war.js finishMarch() routed 분기 — 치중(baggage)은 need에서 이 달
		## 먹은 몫(food_upkeep(troops), 정확히 need의 절반)을 뺀 나머지다.
		var baggage := RealmOrders.food_upkeep(troops)
		c.troops = int(c.troops) + int(rep.atk_troops_left)
		c.food = int(c.food) + baggage
		e.troops = int(rep.def_troops_left)
	enemies[enemy_id] = e

	return {
		"ok": true, "won": rep.won, "routed": rep.routed, "sortie": rep.sortie,
		"loss_a": rep.loss_a, "loss_d": rep.loss_d,
		"wall_from": rep.wall_from, "wall_to": rep.wall_to,
		"boss_beaten": boss_beaten,
		"duel_rounds": duel_rounds, "duel_mul": duel_mul,
	}


## war.js capture()를 좁혀 옮긴 것(2026-09-12, "1,2,3 순서대로 다해" —
## 3·4절이 "함락 뒤처리" 통째로 미뤄 둔 나머지 절반). attack()이 이겼을
## 때만 부른다. **2026-09-12 갱신 — 사로잡힌 수비 무장.** 이간·매수
## 슬라이스가 소패에 이름 있는 수비 무장(sg_guanyu·sg_zhangfei)을
## 들이면서, 그때까지 안 빠져나간 이들을 위(`attack()`)에서 `found[]`로
## 옮기는 것까지 옮겼다(war.js capture()의 caught 분기 — 소패는 몸 붙일
## 이웃 성이 없어 fled 분기는 원작에서도 안 탄다). **보스전 보상은
## 2026-09-14에 옮겼다**(`attack()`의 `boss_beaten` 처리 — 유물 없이
## 금 보너스만, 위 함수 머리말 참고). 세력 멸망 판정은 여전히 안 옮겼다 —
## `bei`가 소패 하나만 들고 있다는 걸 `enemies` Dictionary가 몰라(정적
## 수치일 뿐 성 목록을 세력별로 묶지 않는다), "세력의 마지막 성을
## 뺏었는가"를 새로 판정하는 대신 다음에 볼 자리로 남긴다.
## **옮긴 부분**: `to.force`(정복 자체) · `to.troops = atk.troops`(살아남은
## 원정군이 그대로 수비대가 된다) · `to.train = atk.train`(원정군의
## 훈련도를 물려받는다) · `to.sec = max(10, round(그 성 sec*0.5))`("갓
## 뺏은 성은 어수선하다" — 이 성은 sec 기록이 없던 적 성이라 기준값을
## `RealmOrders.SEC_START`로 삼는다) 전부 war.js 원문 그대로. `agri`·
## `comm`·`pop`은 `ENEMY_CITIES`에 새로 들인 `*_start`(data-city.js
## 원문)로 채우고, `food`·`ships`는 `_init_cities()`가 새 성에 쓰는
## 것과 같은 공식(`RealmCities.food_start()`/`ships_start()`)을 그대로
## 쓴다 — 새 성이 늘 때와 같은 절차라 특수 케이스를 안 만든다.
func _annex_city(city_id: String, enemy_def: Dictionary, garrison: int, train_val: int) -> void:
	cities[city_id] = {
		"agri": int(enemy_def.get("agri_start", 0)), "comm": int(enemy_def.get("comm_start", 0)),
		"sec": maxi(10, roundi(float(RealmOrders.SEC_START) * 0.5)),
		"tech": int(enemies[city_id].tech),
		"wall": int(enemies[city_id].wall), "train": train_val,
		"pop": int(enemy_def.get("pop_start", 0)), "troops": garrison,
		"food": RealmCities.food_start(city_id),
		"ships": RealmCities.ships_start(city_id),
		"disaster": "", "d_left": 0,
	}


const BOSS_BONUS_GOLD := 600  # war.js capture() bossBeaten 분기의 bonusGold 그대로
const ENVOY_GOLD := 300     # diplo.js envoy()의 "gold" 매개변수 — 수량 선택
                             # UI가 없어 고정값(전임·전군출진과 같은 결)
const ENVOY_FEE := RealmDiplo.ENVOY_FEE
const TRIBUTE_GOLD := 600   # 조공에 실어 보내는 금 — 위와 같은 이유로 고정


## diplo.js envoy(kind==='truce') — 사자(지력 으뜸 무장, 위치 무관 — 로스터
## 전체에서 고른다, 원작도 성 소속을 안 따진다)를 보내 정전을 청한다.
## 성공하면 `RealmDiplo.TRUCE_MONTHS`간 `attack()`이 막힌다.
## `debate_mul`(PLAN 101-2 REALM ④후보 "설전") 기본값 1.0 — 안 주면
## 지금까지와 동치.
func envoy_truce(enemy_id: String, debate_mul: float = 1.0) -> Dictionary:
	var enemy_def := RealmCities.enemy_by_id(enemy_id)
	if enemy_def.is_empty():
		return {"ok": false, "why": "없는 상대"}
	var force_id: String = force_of(enemy_id)
	var cost := ENVOY_GOLD + ENVOY_FEE
	if gold < cost:
		return {"ok": false, "why": "금이 모자랍니다"}

	var officer_id := _best_officer_for("wisdom")
	if officer_id.is_empty():
		return {"ok": false, "why": "보낼 사자가 없습니다"}
	if _done_this_month.get(officer_id, false):
		return {"ok": false, "why": "이 달에 이미 명령을 썼습니다"}

	gold -= cost
	_done_this_month[officer_id] = true

	var dip: Dictionary = diplomacy.get(force_id, {"relation": RealmDiplo.DEFAULT_RELATION, "truce_months": 0})
	var chance := RealmDiplo.truce_chance(_effective_stat(officer_id, "wisdom"), int(dip.relation), ENVOY_GOLD)
	chance = clampf(chance * debate_mul, 0.03, 0.95)

	var accepted := _rng.randf() <= chance
	if accepted:
		dip.truce_months = RealmDiplo.TRUCE_MONTHS
		dip.relation = RealmDiplo.clamp_relation(int(dip.relation) + RealmDiplo.TRUCE_SUCCESS_BONUS)
	else:
		dip.relation = RealmDiplo.clamp_relation(int(dip.relation) + RealmDiplo.TRUCE_FAIL_BONUS)
	diplomacy[force_id] = dip

	return {"ok": true, "accepted": accepted, "chance": chance, "relation": int(dip.relation)}


## diplo.js envoy(kind==='tribute') — 굴림 없이 확정으로 우호를 올린다.
func envoy_tribute(enemy_id: String) -> Dictionary:
	var enemy_def := RealmCities.enemy_by_id(enemy_id)
	if enemy_def.is_empty():
		return {"ok": false, "why": "없는 상대"}
	var force_id: String = force_of(enemy_id)
	var cost := TRIBUTE_GOLD + ENVOY_FEE
	if gold < cost:
		return {"ok": false, "why": "금이 모자랍니다"}

	var officer_id := _best_officer_for("wisdom")
	if officer_id.is_empty():
		return {"ok": false, "why": "보낼 사자가 없습니다"}
	if _done_this_month.get(officer_id, false):
		return {"ok": false, "why": "이 달에 이미 명령을 썼습니다"}

	gold -= cost
	_done_this_month[officer_id] = true

	var dip: Dictionary = diplomacy.get(force_id, {"relation": RealmDiplo.DEFAULT_RELATION, "truce_months": 0})
	var up := RealmDiplo.tribute_up(TRIBUTE_GOLD)
	dip.relation = RealmDiplo.clamp_relation(int(dip.relation) + up)
	diplomacy[force_id] = dip

	return {"ok": true, "up": up, "relation": int(dip.relation)}


## diplo.js plot() — 처음엔 성 자체가 대상인 rumor/fire만 옮겼다가
## (2026-09-12, "1,2,3 순서대로 다해" 두 번째), 이번에 이간(discord)·
## 매수(bribe)를 마저 옮겼다(같은 지시의 세 번째, 이번 절). 화친 체크가
## 없는 것도 원작 그대로(plot()은 `attack()`과 달리 diplo.blocked()를
## 안 본다 — 첩보전은 정식 화친과 별개다).
func plot(kind: String, enemy_id: String) -> Dictionary:
	var chk := _plot_check(kind, enemy_id)
	if not bool(chk.get("ok", false)):
		return chk

	var officer_id: String = chk.officer_id
	var force_id: String = chk.force_id
	var e: Dictionary = chk.e
	var dip: Dictionary = chk.dip
	var chance: float = chk.chance

	gold -= int(RealmDiplo.plot_by_key(kind).gold)
	_done_this_month[officer_id] = true
	dip.relation = RealmDiplo.clamp_relation(int(dip.relation) + RealmDiplo.PLOT_RELATION_HIT)

	if _rng.randf() > chance:
		dip.relation = RealmDiplo.clamp_relation(int(dip.relation) + RealmDiplo.PLOT_FAIL_RELATION_HIT)
		diplomacy[force_id] = dip
		return {"ok": true, "done": false, "chance": chance}

	var result := {"ok": true, "done": true, "chance": chance}
	if kind == "rumor":
		var before_sec := int(e.sec)
		e.sec = maxi(0, before_sec - roundi(RealmDiplo.SEC_HIT_BASE + _rng.randf() * RealmDiplo.SEC_HIT_RANGE))
		result["sec_from"] = before_sec
		result["sec_to"] = int(e.sec)
		enemies[enemy_id] = e
	elif kind == "fire":
		var burned := roundi(float(e.food) * (RealmDiplo.FOOD_BURN_BASE + _rng.randf() * RealmDiplo.FOOD_BURN_RANGE))
		e.food = maxi(0, int(e.food) - burned)
		result["burned"] = burned
		enemies[enemy_id] = e
	elif kind == "discord":
		var target_id: String = String(chk.target_id)
		var before_loyal := int(enemy_officer_loyal.get(target_id, 50))
		var hit := RealmDiplo.DISCORD_HIT_BASE + floori(_rng.randf() * RealmDiplo.DISCORD_HIT_RANGE)
		var after_loyal := clampi(before_loyal - hit, 0, 100)
		enemy_officer_loyal[target_id] = after_loyal
		result["target"] = target_id
		result["loyal_from"] = before_loyal
		result["loyal_to"] = after_loyal
		result["defected"] = false
		## **재해석 — 원작은 월말 checkDefection()이 12 이하를 35% 확률로
		## 몰아낸다. 이 슬라이스는 적 로스터를 매달 훑는 자리가 없어, 이간이
		## 방금 만든 결과에 대해 그 자리에서 같은 굴림을 한 번 돈다.**
		if after_loyal <= RealmDiplo.DEFECT_LOYAL_FLOOR and _rng.randf() <= RealmDiplo.DEFECT_CHANCE:
			(e.officers as Array).erase(target_id)
			enemy_officer_loyal.erase(target_id)
			if not (target_id in found) and not (target_id in roster):
				found.append(target_id)
			result["defected"] = true
			enemies[enemy_id] = e
			## PLAN 101-2 REALM ③후보 — 야망 "숙적"(적 무장을 계략으로 하나
			## 제거) 진행도.
			enemies_subverted += 1
	elif kind == "bribe":
		var target_id: String = String(chk.target_id)
		(e.officers as Array).erase(target_id)
		enemy_officer_loyal.erase(target_id)
		enemies[enemy_id] = e
		roster.append(target_id)
		officer_city[target_id] = RealmCities.DEFAULT_CITY
		officer_loyal[target_id] = RealmDiplo.BRIBE_LOYAL_SET
		result["target"] = target_id
		result["home_city"] = RealmCities.DEFAULT_CITY
		enemies_subverted += 1  # 위와 같은 이유 — 매수도 "적 무장을 꺾은" 것으로 친다

	diplomacy[force_id] = dip
	return result


## `plot()`과 같은 검증·확률 계산을 상태 변경 없이 미리 보여 준다
## ("계략은 성공률을 숨기지 않는다", diplo.js 머리말) — 버튼이 메뉴를
## 띄우기 전에 부른다.
func plot_preview(kind: String, enemy_id: String) -> Dictionary:
	return _plot_check(kind, enemy_id)


## 현재 `enemies[eid].officers` 중 지력 최댓값 — "태수"(guard) 역할.
## 아무도 안 남았으면(다 매수·이간으로 빠지거나 함락 전이라도 애초에
## 없으면) `RealmDiplo.PLOT_GUARD_WISDOM`(30) 기본값으로 돌아간다.
func _enemy_guard_wisdom(enemy_id: String) -> float:
	var e: Dictionary = enemies.get(enemy_id, {})
	var best := -1.0
	for oid: String in (e.get("officers", []) as Array):
		if Characters.find(oid) == null:
			continue
		best = maxf(best, _effective_stat(oid, "wisdom"))
	return best if best >= 0.0 else float(RealmDiplo.PLOT_GUARD_WISDOM)


## diplo.js plot()의 "targetId 없으면 자동으로 고른다" — 충성이 가장
## 낮은 사람이 가장 잘 흔들린다(cands.sort by loyalOf asc). 군주는
## `ENEMY_CITIES[].officers`에 애초에 안 들어 있어(realm_cities.gd
## 머리말 참고) 따로 걸러낼 필요가 없다.
func _pick_plot_target(enemy_id: String) -> String:
	var e: Dictionary = enemies.get(enemy_id, {})
	var best_id := ""
	var best_loyal := 101
	for oid: String in (e.get("officers", []) as Array):
		var lv: int = int(enemy_officer_loyal.get(oid, 50))
		if lv < best_loyal:
			best_loyal = lv
			best_id = oid
	return best_id


func _plot_check(kind: String, enemy_id: String) -> Dictionary:
	var plot_def := RealmDiplo.plot_by_key(kind)
	if plot_def.is_empty():
		return {"ok": false, "why": "없는 계략"}
	var enemy_def := RealmCities.enemy_by_id(enemy_id)
	if enemy_def.is_empty():
		return {"ok": false, "why": "없는 목표"}
	var e: Dictionary = enemies.get(enemy_id, {})
	if bool(e.get("captured", false)):
		return {"ok": false, "why": "우리 성입니다"}

	## diplo.js touching() — 우리 성 중 하나라도 대상과 맞닿아 있어야 한다.
	var touching := false
	for cid: String in RealmCities.playable_ids():
		if RealmCities.is_adjacent(cid, enemy_id):
			touching = true
			break
	if not touching:
		return {"ok": false, "why": "손이 닿지 않는 성입니다"}

	if gold < int(plot_def.gold):
		return {"ok": false, "why": "금이 모자랍니다"}

	var officer_id := _best_officer_for("wisdom")
	if officer_id.is_empty():
		return {"ok": false, "why": "계략을 쓸 무장이 없습니다"}
	if _done_this_month.get(officer_id, false):
		return {"ok": false, "why": "이 달에 이미 명령을 썼습니다"}

	## 이간·매수는 대상 무장이 있어야 한다 — 없으면(다 빠져나갔거나 원래
	## 없으면) "홀릴 사람이 없습니다"(diplo.js plot() 그대로).
	var target_id := ""
	if kind == "discord" or kind == "bribe":
		target_id = _pick_plot_target(enemy_id)
		if target_id.is_empty():
			return {"ok": false, "why": "홀릴 사람이 없습니다"}

	var force_id: String = force_of(enemy_id)
	var dip: Dictionary = diplomacy.get(force_id, {"relation": RealmDiplo.DEFAULT_RELATION, "truce_months": 0})
	var mine_wisdom := _effective_stat(officer_id, "wisdom")
	var guard_wisdom := _enemy_guard_wisdom(enemy_id)
	var sec := int(e.get("sec", 50))

	var chance: float
	match kind:
		"discord":
			var target_loyal := int(enemy_officer_loyal.get(target_id, 50))
			chance = RealmDiplo.discord_chance(mine_wisdom, guard_wisdom, sec, target_loyal)
		"bribe":
			var target_loyal2 := int(enemy_officer_loyal.get(target_id, 50))
			var th = Characters.find(target_id)
			var target_rarity := int(th.rarity) if th != null else 3
			chance = RealmDiplo.bribe_chance(mine_wisdom, guard_wisdom, sec, target_loyal2, target_rarity)
			## PLAN 101-2 REALM ③후보 — 탐욕(매수 대상이면 쉽게 넘어옴)·
			## 청렴(반대짝, 매수 저항). 웹판 §5-1 그대로.
			if RealmTraits.has_trait(target_id, "greedy"):
				chance *= RealmTraits.TRAIT_GREEDY_BRIBE_MUL
			if RealmTraits.has_trait(target_id, "honest"):
				chance *= RealmTraits.TRAIT_HONEST_BRIBE_MUL
			chance = clampf(chance, 0.05, 0.9)
		_:
			chance = RealmDiplo.plot_chance(mine_wisdom, guard_wisdom, sec)

	return {
		"ok": true, "officer_id": officer_id, "force_id": force_id,
		"e": e, "dip": dip, "chance": chance, "target_id": target_id,
	}


## PLAN 101-2 REALM ④후보(웹판 §5-3 "설전") — 문답 260문항 재사용, 학당
## 진행(quiz.learned/wrongs/streak/lore)은 안 건드린다("문답 콘텐츠는 이
## 판 안에서만 도니 §2-1 위반 아님", 웹판 문구 그대로). 화친(envoy_truce)·
## 등용(execute_order("hire"))에서 쓰는 사자와 같은 사람(`_best_officer_
## for("wisdom")`)의 지력으로 난도를 정한다.
const DEBATE_ROUNDS := 3
const DEBATE_MUL_BY_CORRECT := {0: 0.8, 1: 0.95, 2: 1.1, 3: 1.3}  # 웹판 §5-3 그대로


## 화친·등용 둘 다 사자를 `_best_officer_for("wisdom")`로 고른다 — UI가
## 설전 문제를 뽑기 전에 "누구 지력 기준인가"를 미리 알아야 해서 공개했다.
func envoy_officer() -> String:
	return _best_officer_for("wisdom")


## 지력에 맞는 난도로 3문 뽑는다 — 웹판 "지력에 맞는 난도" 재해석(문답
## 등급 1~3에 wisdom 문턱을 매겼다). `_present()`가 보기를 섞어 `order`를
## 같이 내려준다(quiz_draw()와 같은 모양, `quiz.learned` 등은 안 건드림).
func debate_draw(officer_id: String) -> Array:
	var wisdom := _effective_stat(officer_id, "wisdom")
	var max_lv := 1
	if wisdom >= 70.0:
		max_lv = 3
	elif wisdom >= 40.0:
		max_lv = 2
	var pool: Array = []
	for ref: Dictionary in RealmQuizData.BANK:
		if RealmQuizData.lv_of(ref) <= max_lv:
			pool.append(ref)
	var out: Array = []
	for i in range(DEBATE_ROUNDS):
		var ref: Dictionary = pool[_rng.randi_range(0, pool.size() - 1)]
		out.append(_present(ref))
	return out


## `questions`는 `debate_draw()`가 낸 순서 그대로, `choice_indices`는 각
## 문제에서 플레이어가 고른 보기 자리(섞인 순서 기준, `quiz_answer()`와
## 같은 판정: `order[idx] == ref.a`). 정답 수(0~3) → 배율.
func debate_result(questions: Array, choice_indices: Array) -> Dictionary:
	var correct := 0
	for i in range(mini(questions.size(), choice_indices.size())):
		var q: Dictionary = questions[i]
		var ref := RealmQuizData.by_id(String(q.id))
		var order: Array = q.order
		if int(order[int(choice_indices[i])]) == int(ref.a):
			correct += 1
	return {"correct": correct, "mul": float(DEBATE_MUL_BY_CORRECT.get(correct, 1.0))}


## quiz.js draw() — 안 익힌 문제 우선(그 안에서는 쉬운 등급부터), 다
## 익혔으면 틀린 것 위주로 복습. 보기 순서는 낼 때마다 섞는다(_present()).
## 무작위(등급 안에서 고르기·복습 후보 중 고르기·보기 섞기)는 모두
## `_rng`(고정 시드)를 써 헤드리스 검증이 재현 가능하다.
func quiz_draw() -> Dictionary:
	var pool := RealmQuizData.BANK
	if pool.is_empty():
		return {}

	var fresh: Array = []
	for ref: Dictionary in pool:
		if not quiz.learned.has(String(ref.id)):
			fresh.append(ref)

	var chosen: Dictionary
	if not fresh.is_empty():
		var low := 3
		for ref: Dictionary in fresh:
			low = mini(low, RealmQuizData.lv_of(ref))
		var tier: Array = []
		for ref: Dictionary in fresh:
			if RealmQuizData.lv_of(ref) == low:
				tier.append(ref)
		chosen = tier[_rng.randi_range(0, tier.size() - 1)]
	else:
		## 전부 익혔다 — 틀린 횟수 내림차순 정렬 후 상위 1/4(최소 4)에서 고른다.
		var review: Array = pool.duplicate()
		review.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
			return int(quiz.wrongs.get(String(a.id), 0)) > int(quiz.wrongs.get(String(b.id), 0)))
		var top_n := maxi(4, ceili(float(review.size()) / 4.0))
		top_n = mini(top_n, review.size())
		var top: Array = review.slice(0, top_n)
		chosen = top[_rng.randi_range(0, top.size() - 1)]

	return _present(chosen)


## quiz.js present() — 보기 넷을 Fisher-Yates로 섞는다. `order[i]`는
## "i번째로 보여줄 보기가 원래 몇 번(정답 인덱스 기준)이었는가".
func _present(ref: Dictionary) -> Dictionary:
	var order: Array = [0, 1, 2, 3]
	for i in range(order.size() - 1, 0, -1):
		var j := _rng.randi_range(0, i)
		var t: int = order[i]
		order[i] = order[j]
		order[j] = t

	var choices: Array = []
	for idx: int in order:
		choices.append(String(ref.c[idx]))

	var lv := RealmQuizData.lv_of(ref)
	return {
		"id": String(ref.id), "cat": String(ref.cat), "lv": lv,
		"lv_name": String(RealmQuizData.LV_NAME[lv]),
		"q": String(ref.q), "choices": choices, "order": order,
		"review": quiz.learned.has(String(ref.id)),
	}


## quiz.js answer() — `p`는 quiz_draw()가 준 문제, choice_idx는 화면에
## 보인 보기 번호(섞인 순서 기준). **REALM 재해석 — 보상 축소.** 원작
## reward는 feat/fame/scroll까지 주는데, 이 슬라이스엔 그 값 자체가
## 없어(REALM엔 player.fame·items.scroll이 없다) gold(세력 금고, rtk.js
## study()가 하던 일)와 lore→재야 공개만 남겼다.
func quiz_answer(p: Dictionary, choice_idx: int) -> Dictionary:
	var ref := RealmQuizData.by_id(String(p.get("id", "")))
	if ref.is_empty():
		return {"ok": false}

	var qid: String = String(ref.id)
	var order: Array = p.order
	var correct: bool = int(order[choice_idx]) == int(ref.a)
	var first: bool = correct and not quiz.learned.has(qid)
	quiz.total = int(quiz.total) + 1

	var lv := RealmQuizData.lv_of(ref)
	var rw: Dictionary = RealmQuizData.LV_REWARD[lv]
	var reward := {"gold": 0, "lv": lv, "found": ""}

	if correct:
		quiz.correct = int(quiz.correct) + 1
		quiz.streak = int(quiz.streak) + 1
		if int(quiz.wrongs.get(qid, 0)) > 0:
			quiz.wrongs[qid] = maxi(0, int(quiz.wrongs[qid]) - 1)
			if int(quiz.wrongs[qid]) == 0:
				quiz.wrongs.erase(qid)
		if int(quiz.streak) > int(quiz.best_streak):
			quiz.best_streak = quiz.streak

		if first:
			## **2026-09-12 추가 — 서고(learnedList).** 원작은 `Date.now()`로
			## "언제 익혔는지"를 남겨 서고를 최근순으로 보여준다. 이 슬라이스는
			## 그 대신 `quiz.total`(그 시점까지 누적 시도 횟수, 항상 증가)을
			## 쓴다 — 실제 시각을 쓰면 헤드리스 검증의 "세 번 돌려도 같은 결과"
			## 요건이 깨진다(루트 CLAUDE.md 검증 습관). 값 자체는 안 보여주고
			## 정렬(내림차순 = 최근 익힌 순)에만 쓴다.
			quiz.learned[qid] = quiz.total
			reward.gold = int(rw.gold)
			## rtk.js study() — 학식이 LORE_PER_FIND만큼 쌓일 때마다 재야
			## 하나가 저절로 드러난다(수색 없이, 지력 판정도 없이).
			quiz.lore = int(quiz.lore) + maxi(1, lv)
			while int(quiz.lore) >= RealmQuizData.LORE_PER_FIND:
				quiz.lore = int(quiz.lore) - RealmQuizData.LORE_PER_FIND
				var got := _reveal_free()
				if not got.is_empty():
					reward.found = got
		else:
			reward.gold = int(rw.rgold)

		## PLAN 101-2 REALM ③후보 — 학구(웹판 §5-1 "문답 상금 ×1.3"). 문답은
		## 특정 무장이 푸는 행동이 아니라(플레이어 조작), 지금 조망 중인 성의
		## 태수가 대신한다고 재해석했다 — `gov_mul()`이 성 살림에 태수의
		## 자질을 얹는 것과 같은 자리(태수가 없으면 배율 없음).
		var gov_id := _governor_at(current_city)
		if not gov_id.is_empty() and RealmTraits.has_trait(gov_id, "scholarly"):
			reward.gold = roundi(float(reward.gold) * RealmTraits.TRAIT_SCHOLARLY_QUIZ_MUL)

		gold += int(reward.gold)
	else:
		quiz.streak = 0
		quiz.wrongs[qid] = int(quiz.wrongs.get(qid, 0)) + 1

	return {
		"ok": true, "correct": correct, "first": first, "why": String(ref.why),
		"answer_text": String(ref.c[int(ref.a)]),
		"lv": lv, "lv_name": String(RealmQuizData.LV_NAME[lv]),
		"streak": int(quiz.streak), "reward": reward,
	}


## rtk.js revealFree() — 우리 성(playable_ids())에 묻힌 재야 중 아직
## 안 드러난(found·roster 어디에도 없는) 사람을 rarity 내림차순으로
## 하나 고른다. `_do_search()`(지력 판정 있음)와 달리 판정이 없다 —
## 원작도 study()가 부를 땐 그냥 가장 귀한 사람을 바로 준다.
func _reveal_free() -> String:
	var pool: Array = []
	for city_id: String in RealmCities.playable_ids():
		for oid: String in RealmOfficerPool.HIDDEN_POOL_BY_CITY.get(city_id, []):
			if oid in found or oid in roster:
				continue
			pool.append(oid)
	if pool.is_empty():
		return ""

	pool.sort_custom(func(a: String, b: String) -> bool:
		return int(Characters.find(a).rarity) > int(Characters.find(b).rarity))
	var got: String = pool[0]
	found.append(got)
	return got


## quiz.js progress() 축약 — 분야·등급별 세부는 quiz_cat_counts()가 맡는다.
func quiz_progress() -> Dictionary:
	return {
		"learned": quiz.learned.size(), "total": RealmQuizData.BANK.size(),
		"answered": int(quiz.total), "correct": int(quiz.correct),
		"streak": int(quiz.streak), "best_streak": int(quiz.best_streak),
	}


## quiz.js learnedList() — 익힌 지식 목록(서고), 최근에 익힌 것부터.
## **2026-09-12 추가("1,2,3 다해줘" 세 번째)** — `quiz.learned[qid]`가
## 이제 `quiz.total`(익힌 시점의 누적 시도 횟수) 값을 담고 있어(위
## `quiz_answer()` 참고) 그 값 내림차순 정렬이 곧 "최근 익힌 순"이다.
## `limit`(기본 20) — `ChoicePrompt.build()`가 choices 수만큼 패널
## 높이를 늘리기만 하고 스크롤이 없어서(games/saga_go/ui/choice_
## prompt.gd), 학습이 쌓여도 화면이 안 넘치게 최근 것만 자른다(전체
## 목록·페이지네이션은 다음에 볼 자리).
func quiz_learned_list(cat_key: String = "", limit: int = 20) -> Array:
	var out: Array = []
	for ref: Dictionary in RealmQuizData.BANK:
		var qid: String = String(ref.id)
		if not quiz.learned.has(qid):
			continue
		if not cat_key.is_empty() and String(ref.cat) != cat_key:
			continue
		out.append({
			"id": qid, "cat": String(ref.cat), "cat_name": RealmQuizData.cat_name(String(ref.cat)),
			"lv": RealmQuizData.lv_of(ref), "lv_name": String(RealmQuizData.LV_NAME[RealmQuizData.lv_of(ref)]),
			"q": String(ref.q), "answer": String(ref.c[int(ref.a)]), "why": String(ref.why),
			"at": int(quiz.learned[qid]),
		})
	out.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return int(a.at) > int(b.at))
	return out.slice(0, mini(limit, out.size()))


## 서고 "분야 필터" 메뉴(2026-09-12, 서고 UI 확장) — 분야별 학습 현황
## (분야 key·이름·익힌 수·전체 문항 수). 분야당 문항이 최대 15개라
## quiz_learned_list(cat_key)의 기본 limit(20)에 걸릴 일이 없다.
func quiz_cat_counts() -> Array:
	var out: Array = []
	for c: Dictionary in RealmQuizData.CATS:
		var key: String = String(c.key)
		var total := 0
		var learned := 0
		for ref: Dictionary in RealmQuizData.BANK:
			if String(ref.cat) != key:
				continue
			total += 1
			if quiz.learned.has(String(ref.id)):
				learned += 1
		out.append({"key": key, "name": String(c.name), "learned": learned, "total": total})
	return out


## rtk.js "태수는 그 성의 으뜸 무장"(지력*0.6+통솔*0.4 최댓값) — 이제
## officer_city로 실제 배치를 아니까, 그 성에 배치된 무장 중에서만 고른다.
func _governor_at(city_id: String) -> String:
	var best_id := ""
	var best_val := -1.0
	for id: String in roster:
		if officer_city.get(id, "") != city_id:
			continue
		if Characters.find(id) == null:
			continue
		var v: float = _effective_stat(id, "wisdom") * 0.6 + _effective_stat(id, "command") * 0.4
		if v > best_val:
			best_val = v
			best_id = id
	return best_id


## city_filter가 비어 있으면(수색·등용) 로스터 전체를 본다. 아니면
## officer_city[id] == city_filter인 무장만 본다(개발형 명령·징병).
func _best_officer_for(stat: String, city_filter: String = "") -> String:
	var best_id := ""
	var best_val := -1.0
	for id: String in roster:
		if _done_this_month.get(id, false):
			continue
		if not city_filter.is_empty() and officer_city.get(id, "") != city_filter:
			continue
		if Characters.find(id) == null:
			continue
		var v: float = _effective_stat(id, stat)
		if v > best_val:
			best_val = v
			best_id = id
	return best_id


func save() -> bool:
	var data := {
		"version": SAVE_VERSION,
		"scenario_id": scenario_id,
		"year": year, "month": month,
		"gold": gold,
		"cities": cities,
		"current_city": current_city,
		"roster": roster, "found": found,
		"officer_city": officer_city,
		"officer_loyal": officer_loyal,
		"officer_growth": officer_growth,
		"enemies": enemies,
		"enemy_officer_loyal": enemy_officer_loyal,
		"diplomacy": diplomacy,
		"quiz": quiz,
		"result": result,
		"diplomacy_peace_streak": diplomacy_peace_streak,
		"officer_ambition": officer_ambition,
		"enemies_subverted": enemies_subverted,
		"active_events": active_events,
		"events_done": events_done,
		"lord_succession_enabled": lord_succession_enabled,
		"current_lord_id": current_lord_id,
		"heir_id": heir_id,
		"succession_shock_until": _succession_shock_until,
	}
	return SafeFile.write_text(SAVE_PATH, JSON.stringify(data))


func try_load() -> bool:
	var parsed: Variant = SafeFile.read_json(SAVE_PATH)
	if parsed == null:
		return false
	var migrated: Variant = _migrate(parsed)
	if migrated == null:
		return false
	var data: Dictionary = migrated

	scenario_id = String(data.get("scenario_id", "194"))
	if not RealmCities.SCENARIO_CAO_CITIES.has(scenario_id):
		scenario_id = "194"
	## city_force는 저장하지 않는다(파생값) — scenario_id로 다시 채운다.
	_init_city_force(RealmCities.SCENARIO_FORCE_OVERRIDE.get(scenario_id, {}))
	year = int(data.get("year", 194))
	month = int(data.get("month", 1))
	gold = int(data.get("gold", 3200))
	var loaded_cities: Variant = data.get("cities", {})
	if typeof(loaded_cities) == TYPE_DICTIONARY and not loaded_cities.is_empty():
		cities = loaded_cities
	current_city = String(data.get("current_city", RealmCities.DEFAULT_CITY))
	roster = data.get("roster", [RealmOfficerPool.STARTING_OFFICER])
	found = data.get("found", [])
	var loaded_officer_city: Variant = data.get("officer_city", {})
	if typeof(loaded_officer_city) == TYPE_DICTIONARY and not loaded_officer_city.is_empty():
		officer_city = loaded_officer_city
	var loaded_officer_loyal: Variant = data.get("officer_loyal", {})
	if typeof(loaded_officer_loyal) == TYPE_DICTIONARY and not loaded_officer_loyal.is_empty():
		officer_loyal = loaded_officer_loyal
	var loaded_officer_growth: Variant = data.get("officer_growth", {})
	if typeof(loaded_officer_growth) == TYPE_DICTIONARY:
		officer_growth = loaded_officer_growth
	var loaded_enemies: Variant = data.get("enemies", {})
	if typeof(loaded_enemies) == TYPE_DICTIONARY and not loaded_enemies.is_empty():
		enemies = loaded_enemies
	var loaded_enemy_officer_loyal: Variant = data.get("enemy_officer_loyal", {})
	if typeof(loaded_enemy_officer_loyal) == TYPE_DICTIONARY and not loaded_enemy_officer_loyal.is_empty():
		enemy_officer_loyal = loaded_enemy_officer_loyal
	var loaded_diplomacy: Variant = data.get("diplomacy", {})
	if typeof(loaded_diplomacy) == TYPE_DICTIONARY and not loaded_diplomacy.is_empty():
		diplomacy = loaded_diplomacy
	var loaded_quiz: Variant = data.get("quiz", {})
	if typeof(loaded_quiz) == TYPE_DICTIONARY and not loaded_quiz.is_empty():
		quiz = loaded_quiz
	result = String(data.get("result", ""))
	diplomacy_peace_streak = int(data.get("diplomacy_peace_streak", 0))
	var loaded_officer_ambition: Variant = data.get("officer_ambition", {})
	if typeof(loaded_officer_ambition) == TYPE_DICTIONARY:
		officer_ambition = loaded_officer_ambition
	enemies_subverted = int(data.get("enemies_subverted", 0))
	var loaded_active_events: Variant = data.get("active_events", [])
	active_events = loaded_active_events if typeof(loaded_active_events) == TYPE_ARRAY else []
	var loaded_events_done: Variant = data.get("events_done", {})
	events_done = loaded_events_done if typeof(loaded_events_done) == TYPE_DICTIONARY else {}
	lord_succession_enabled = bool(data.get("lord_succession_enabled", false))
	current_lord_id = String(data.get("current_lord_id", RealmDiplo.LORD_ID))
	heir_id = String(data.get("heir_id", ""))
	var loaded_shock: Variant = data.get("succession_shock_until", {})
	_succession_shock_until = loaded_shock if typeof(loaded_shock) == TYPE_DICTIONARY else {}
	_done_this_month.clear()
	return true


## 올린 1~15단계는 필드 추가뿐이고 try_load()가 전부 .get(key, 기본값)으로
## 읽으므로, 여기 단계들은 실제 변환 없이 버전 숫자만 올려 통과시킨다
## (필드 이름을 바꾸거나 옮기는 변경이 생기면 그 단계에 변환을 추가한다).
func _migrate_step(from_version: int, data: Dictionary) -> Variant:
	if from_version < 1 or from_version >= SAVE_VERSION:
		return null
	data["version"] = from_version + 1
	return data
