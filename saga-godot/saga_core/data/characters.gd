extends RefCounted

## saga_core — 다섯 판(GO/DUNGEON/FOREST/STORY/REALM 예정) Godot 포트가 공유하는
## 인물 데이터. LEGACY_FEATURE_AUDIT.md 6장 결정(2026-08-31) — id는 기존 다섯
## 웹 프로젝트(saga-go 등)의 js/data.js HEROES와 완전히 동일하게 유지한다(그
## 다섯 곳은 서로 md5로 동일함을 확인하며 유지되는 한 벌이라, 여기 옮긴 것도
## 그 한 벌에서 그대로 가져온 것 — 새 id 체계를 만들지 않았다).
##
## 2026-09-11 시점 105명(삼국지 22·한국사 26·일본사 20·세계사 37,
## 2026-09-12 rf_mizhu·rf_jianyong 추가로 107명·삼국지 24,
## 2026-09-13 rf_chengong·rf_gaoshun 추가로 109명·삼국지 26). REALM
## 전용 무장(js/data-force.js, 130명+)은 이번에 포함하지 않았다 — LEGACY_
## FEATURE_AUDIT.md는 REALM 것도 통합하기로 했지만, REALM Godot 포트는
## 39장 순서상(Core→Vertical Slice→GO→DUNGEON→FOREST→STORY→REALM) 아직
## 멀었고 그때까지 REALM 쪽 웹판 데이터가 계속 바뀔 수 있어, 지금 당장
## 쓰는 GO부터 먼저 옮기고 REALM은 그 차례가 왔을 때 다시 최신본을 옮기는
## 쪽이 낫다고 판단했다(추측성 선작업 방지). id·이름 정책(가명, 루트
## CLAUDE.md "이름 정책")은 원본에서 이미 지켜진 상태 그대로 옮겼다 —
## name·hanja만 가명, BIOS(열전)는 옮기지 않았다(정책 미준수 상태라 그대로
## 들고 오면 saga_core에도 같은 문제가 생긴다 — 옮기지 않는 것이 맞다).
##
## **2026-09-12 추가 — rf_mizhu·rf_jianyong(사용자 승인, 소패 수비
## 완전화 목적)만 예외로 앞당겨 옮겼다.** 나머지 REALM 무장 130명+은
## 여전히 REALM 차례(위 이유)까지 안 옮긴다. **주의 — 이 둘의 원본
## (js/data-force.js)은 name·hanja가 가명화가 안 된 실명(미축/麋竺·
## 간옹/簡雍) 상태다** — 105명과 달리 "원본에서 이미 지켜진 상태를
## 그대로 옮긴" 것이 아니라, **이 파일에서 처음으로 가명(창윤/倉潤·
## 언유/言柔)을 새로 지어 넣었다.** era·faction·rarity·trait·stats·
## emoji·quote는 원본 그대로(quote는 이름을 드러내지 않아 정책에 안
## 걸린다). 나중에 REALM 무장 전체를 옮길 때 이 둘도 다시 마주칠 텐데,
## 그때 다른 이름으로 또 바뀌지 않도록 이 가명을 그대로 이어 쓸 것.
##
## **2026-09-13 추가 — rf_chengong·rf_gaoshun(같은 이유, 하비/여포군
## 성 추가 목적).** 원본(진궁/陳宮·고순/高順) 역시 가명화가 안 된
## 실명 상태였다 — 이번에 새로 가명을 지었다: 진궁→**현모(玄謀)**,
## 고순→**진위(陣威)**. faction은 위/오/촉 어디에도 안 속하는 여포
## 세력이라 이미 있던 "군웅"(원소·원술 등이 쓰던 값)을 그대로 썼다.
## era·rarity·trait·stats·emoji·quote는 원본 그대로(고순 quote의
## "함진영"은 부대 이름이지 인물 실명이 아니라 정책에 안 걸린다).
##
## **2026-09-14 추가 — REALM "전체 107개 성" 확장(사용자 지시 "다해
## 순서대로"/"묻지말고 최대한해")으로 삼국지 나머지 9개 세력의 무장 40명을
## 한 번에 들였다(109명→149명, 삼국지 26→66).** 원소·공손찬·공융·원술·
## 유표·이각·마등·장로·유장군 소속(`js/data-force.js` FORCES_194 그대로).
## 전부 이번에 처음 가명을 지었다(원본은 전부 실명 상태). name·hanja만
## 새로 지었고 era/rarity/trait/stats/emoji/quote는 원본 그대로(quote는
## 이름을 직접 안 드러내 정책에 안 걸린다). **faction — 위/오/촉 어느
## 정사(定史) 세력에도 정식으로 안 속한 채 끝난 사람은 "군웅"(원소·
## 공손찬·공융·원술·유표(형주)·이각·장로·유장 소속 대부분)을 그대로
## 썼다.** 예외 — `data-force.js`의 200/208년 표까지 대조해 실제로 다른
## 세력에 편입되는 게 확인된 사람만 그 세력으로: 장합·채모·괴량·문빙·
## 가후(FORCES_208에서 조조군 소속으로 재등장) → "위", 마등·방덕·한수
## (마초의 세력에 계속 묶여 있고 마초 본인은 이미 "촉"으로 가명화돼
## 있다) → "촉", 손책·정보·황개·한당·주태(손책→손권으로 이어지는 오의
## 창업 무리, `ce`→`quan` 세력이 세 시나리오 내내 이들을 그대로 간다)
## → "오". **황조(黃祖)만 예외적으로 "군웅"** — 강하에서 전사해(원작
## 그대로) 어느 표에도 재등장하지 않는다.
##
## **2026-09-14 추가(같은 날 이어서) — "전체 107개 성" 나머지 77개
## (한국·일본·교주·서역·남중·천축·막북·임읍·균열·폐허·묘역, 사용자 지시
## "77개 마저 이어해")의 수비 무장 99명.** `js/data-force.js`의
## `KOREA_OFFICERS`~`TOMB_OFFICERS` 11개 표 그대로 — **이 사람들은
## 가명을 새로 지을 필요가 없었다.** 원본부터 `era`가 전부 "OO(가상)"
## 이고 실존 인물이 아닌 지어낸 이름이라(예: kr2_pasodan/파소단, fu_
## seonghon/성혼) 원작 이름 정책 문제가 없다 — name·hanja를 원본 그대로
## 옮겼다. `faction` 필드는 위/오/촉이 아니라 **그 무장이 지키는 성의
## 이름**(원본 관례 그대로, 예: kr2_pasodan의 faction은 "양평"). 원본의
## `boss: true`(원본은 천축·막북·임읍·균열·폐허·묘역 여섯 지역 허브
## 하나씩 — 이 머리말이 처음 적혔을 때 천축을 빠뜨렸었다, 2026-09-14
## "보스전 보상" 절에서 바로잡음)와 `monster`(균열·폐허·묘역, `asset3d.js`
## 가 읽는 실제 3D 모델 경로)는 이 스키마에 없는 필드라 그때는 옮기지
## 않았다.
##
## **2026-09-14 추가 — 보스전 보상.** `boss: true` 여섯 개(tz_beonwang·
## mb_seonwoo·ly_jeonchung·fu_jongwang·ru_geohae·tb_baekgi)를 원본
## 그대로 얹었다 — `realm_save_state.gd attack()`이 함락 직전 수비
## 명단에서 이 값을 읽어 보스 보너스(금+유물)를 준다. `monster`(3D 모델
## 경로)는 여전히 안 옮겼다 — REALM에 3D 몬스터 렌더링 자체가 아직
## 없어서다(다음 자리).
##
## 필드: id(불변 고유키) · name(표시 이름, 가명) · era(시대 그룹) ·
## faction(세력) · rarity(1~5) · trait(might/wisdom/virtue, 설득 어필 방향) ·
## stats(might/wisdom/command) · hanja(표시용 가명 한자) · emoji · quote(대사).
##
## find(id)로 하나 찾는다 — 없으면 null.

## 명단은 R-4(10-10)에 시대별 다섯 파일 saga_core/data/heroes/*.gd 로 나눴다 — 순서는 예전 한 벌 그대로(삼국지→가상→한국사·일본사→세계사).
const _SANGUO := preload("res://saga_core/data/heroes/heroes_sanguo.gd")
const _VIRTUAL_A := preload("res://saga_core/data/heroes/heroes_virtual_a.gd")
const _VIRTUAL_B := preload("res://saga_core/data/heroes/heroes_virtual_b.gd")
const _KOREA_JAPAN := preload("res://saga_core/data/heroes/heroes_korea_japan.gd")
const _WORLD := preload("res://saga_core/data/heroes/heroes_world.gd")

const HEROES := _SANGUO.LIST + _VIRTUAL_A.LIST + _VIRTUAL_B.LIST + _KOREA_JAPAN.LIST + _WORLD.LIST


static func find(id: String) -> Variant:
	for h in HEROES:
		if h.id == id:
			return h
	return load("res://saga_core/data/time_folk.gd").find(id)   # G-0117 사가천하 시간 틈 사람(따로 표, 파일 줄 상한)
