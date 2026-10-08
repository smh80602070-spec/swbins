extends RefCounted

## VERTICAL_SLICE_REALM.md 3·4절 — saga_core/data/characters.gd HEROES
## (105명, 가명 처리 완료)에서 이 슬라이스가 쓰는 셋만 골랐다. 새 인물을
## 만들지 않는다 — 이 저장소 전체 습관 그대로.
##
## STARTING_OFFICER — 플레이어 세력(허창)의 시작 책사. 현책(sg_zhugeliang,
## 지력100·통솔92·무력38)은 지력·통솔 판정 명령은 다 잘 해내고 무력 판정
## (훈련)만 약하다 — rtk.js setup()의 "군주가 있는 성이 본거지" 규칙을
## 이 슬라이스 범위(무장 하나)로 줄인 것. 로스터가 하나뿐이라 매달 명령을
## 하나만 쓸 수 있다는 제약은 그대로 유효하다(어느 명령이든).
##
## HIDDEN_POOL_BY_CITY — 2026-09-12 "여러 성으로 넓히는 것" 다음 단계로
## 재야를 성마다 나눠 묻었다("무장을 성마다 나눠 앉히는 시스템"의 첫
## 조각 — VERTICAL_SLICE_REALM.md 2-4절이 "다음"으로 남긴 항목). 수색
## (search)은 이제 **current_city에 묻힌 재야만** 보여준다(rtk.js
## doSearch()가 애초에 그 성 소속만 찾던 것과 같은 결) — 세 성을 다
## 둘러봐야 재야를 전부 찾는다는 뜻이다. 허창(본거지, 시작 무장이 이미
## 있음)엔 일부러 안 묻었다 — 진류·복양 둘로 나눠 "다른 성에 가 볼
## 이유"를 만들었다.
## data-force.js 주석 그대로 "삼국지 사람이 아닌 인물은 재야다"를 따라
## 한국사·일본사 쪽에서 골랐다(해장=이순신 가명, rarity 5 · 이도인=미야모토
## 무사시 가명, rarity 4).
const STARTING_OFFICER := "sg_zhugeliang"
## G-0117 — 시간 틈 사람 아홉(time_folk.gd)을 성 아홉에 하나씩 묻었다(웹은 scatterFree 로 아무 성 재야).
## 아홉이 다 우리 사람이면 7막(scenario.gd r7_*)이 열린다. 시작 성 둘엔 귀하지 않은 이(rarity 3)만 — 원래 재야 둘이 먼저 나오게.
const HIDDEN_POOL_BY_CITY := {
	"chenliu": ["jp_musashi", "tm_doha"],
	"puyang": ["kr_yisunsin", "tm_gongseok"],
	"xuchang": [],
	"xiaopei": ["tm_gangseo"],
	"xiapi": ["tm_myeongbyeon"],
	"luoyang": ["tm_geumdam"],
	"ye": ["tm_yeongjeom"],
	"changan": ["tm_eunha"],
	"jianye": ["tm_seongyeon"],
	"chaisang": ["tm_gwedo"],
}
const TIME_FOLK := ["tm_gangseo", "tm_gongseok", "tm_geumdam", "tm_myeongbyeon", "tm_doha", "tm_seongyeon", "tm_gwedo", "tm_eunha", "tm_yeongjeom"]
