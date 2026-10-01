class_name RealmState
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


