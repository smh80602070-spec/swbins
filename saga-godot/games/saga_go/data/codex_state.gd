extends Node

## VERTICAL_SLICE.md §26이 "발견 도감 5갈래"로 미뤄 뒀던 것 — 웹판
## js/codex.js("본 것에 도장을 찍고 세는 일, 목록을 새로 만들지 않는다")를
## 그대로 옮긴다. 이 스크립트는 각 갈래에 **무엇이 있는지**는 안 들고
## 있다 — discover()를 부르는 쪽(landmarks_builder.gd·npc_builder.gd·
## animal_builder.gd·bandit_encounter.gd·simple_event.gd·hero_encounter.gd)
## 이 각자 "이걸 봤다"는 사실만 여기 도장 찍는다.
##
## 웹판 KINDS는 지역/사람/생물/사건/역사 다섯이다. 이 판에선 "역사"를
## event.record(사건이 남기는 별도 기록 문구) 대신 **역사 인물 조우**로
## 채웠다 — GO의 정체성 자체가 "역사 인물로 노는" 것이라(루트 CLAUDE.md)
## 그쪽이 "역사" 갈래의 취지에 더 맞는다고 판단했다(웹판 그대로 옮긴 게
## 아니라는 것을 밝혀 둔다).
##
## **2026-09-14, "pet" 갈래 추가 — 정직하게 밝혀 둔다.** 웹판은 이걸
## KINDS 다섯과 따로 관리한다(codex.js dexCount()가 `save.pets`를 KINDS
## tally와 별개로 센다, encounter.js registerDex('pets', id)) — 여기서는
## 새 시스템을 두 벌 만들지 않고 이미 있는 discover()/book/TOTAL/REWARD
## 한 벌에 그냥 여섯째 키로 얹었다(구조를 그대로 베낀 게 아니라 "본 것에
## 도장 찍고 센다"는 뜻만 재사용한 것).
##
## project.godot [autoload]에 CodexState로 등록된 싱글턴.

signal codex_changed

## 웹판 REWARD 테이블(codex.js) 그대로 — gold는 이 판에 재화 시스템이
## 없어 뺐다(다른 사건들과 같은 경계, PartyState.add_exp만 있다).
const REWARD := {
	"place": 12.0,
	"people": 8.0,
	"beast": 6.0,
	"event": 10.0,
	"record": 14.0,
	## 2026-09-14, GO 51장 "희귀 몬스터" — pets.gd 신수, 확률 판정을 통과
	## 해야만 얻는 유일한 갈래라(다른 갈래는 전부 마주치기만 하면 확정)
	## record보다도 조금 높게 잡았다.
	"pet": 16.0,
}

## 갈래별 총 개수 — 지금 있는 Vertical Slice 지역(11×11) 기준 실제
## 개수다. 웹판처럼 목록 함수를 두지 않고 상수로 뒀다 — 지역이 하나뿐인
## 지금은 그걸로 충분하고, 지역이 늘면 그때 목록화한다(추측성 확장 방지).
const TOTAL := {
	## 2026-09-15, GO 51장 "지역" 첫 걸음(region2_coast.gd) — 역참으로
	## 이어지는 포구를 place에 하나 더했다(7→8). "지역이 늘면 그때
	## 목록화한다"던 위 주석의 예고대로, 지역이 실제로 둘이 됐다 — 아직은
	## +1 상수 수정으로 충분하지만, 셋째 지역이 생기면 그때는 정말
	## 목록 함수로 바꿀 것.
	## 2026-09-16, GO 진짜 세 번째 지역(region3_ruins.gd) — "폐허"(place)
	## 추가(8→9). id는 "ruins_far"다 — 마을 쪽 landmarks_builder.gd
	## _add_ruins()가 이미 codex id "ruins"를 쓰고 있어(마을 안 폐허),
	## 그대로 쓰면 서로 다른 두 랜드마크가 book 키 하나를 공유하는
	## 충돌이 생겨 다른 이름으로 갈랐다. 2026-09-16, 포구 콘텐츠 확장 —
	## 고래뼈(coast_whalebone, 선택지 없는 순수 발견) 추가(9→10).
	## 2026-09-18, PLAN 101-1 E(발견 밀도) — 폐허 80.0% 빈 칸 재측정 뒤
	## region3_ruins.gd에 전장 잔해 넷(부서진 방패·투구·화살·깃대, 선택지
	## 없는 순수 발견) 추가(10→14). 재측정: 32.0%(HISTORY 09-18).
	## 같은 날, test_village.gd 밀도 진단의 walkable 판정을 LEGEND.walkable로
	## 고치니(강은 걸을 수 없다) 포구가 61.2%→41.4%로 줄었고, 남은 빈 칸에
	## 닻·그물더미·조개무지(선택지 없는 순수 발견) 추가(14→17). 재측정: 17.2%.
	## 같은 날, 마을(59.7%) 네 모퉁이에 순수 발견 넷(돌무더기·이끼바위·
	## 허수아비·이정표) 추가(17→21). 재측정: HISTORY 09-18.
	## 2026-09-20, PLAN 101-1 E 재점검(다섯 벌 다 여전히 10% 초과) — 마을
	## 여덟(여우굴·고목구멍·벌집·다람쥐둥지·오소리굴·딱따구리나무·우물·
	## 산길돌탑)·포구 다섯(불자리·돛대·게딱지·모래성·밀물웅덩이)·폐허
	## 여덟(벽돌·계단·항아리·기둥·벽화·잿더미·마른우물·문틀 조각) 추가
	## (21→42). 재측정: 마을 12.9%·포구 0.0%·폐허 0.0%(포구·폐허는 완전히
	## 덮여 신호가 죽었다 — 8개·5개 새로 심은 자리가 원래 빈 칸과 정확히
	## 겹쳐서다, 반경을 늘린 게 아니라 실제 콘텐츠라 문제로 안 본다).
	## 마을만 10% 문턱을 2칸((0,3)(0,5)) 차이로 못 넘어 옹달샘 하나 추가
	## (42→43). 재측정: HISTORY 09-20.
	## 2026-09-25, PLAN 106장 ㊺ 서리봉 고원(region4_frost.gd) — 고원·고개·옛 산성 터·기상 관측소·
	## 추락한 비행선·얼어붙은 호수(43→49) + 작은 발견 일곱(위성 조각·장수 석상·사냥꾼 오두막·눈사람·케이블카·얼음굴·봉화, 49→56).
	## 2026-09-26, PLAN 106장 ㊼-1 이야기 3부 — 포구 녹슨 조선소(world/era_sites.gd, 56→57).
	## 2026-09-26, PLAN 106장 ㊼-2 — 폐허 시간 틈 관측소(world/era_sites.gd, 57→58).
	## 2026-09-26, PLAN 106장 ㊼-3 — 마을 남쪽 옛 역참 터(world/era_sites.gd, 58→59).
	## 2026-09-26, PLAN 106장 ㊽ 다섯째 지역 은하 나루(world/region5_skyport.gd) — 지역·고개·나루·절터·역·태양광 밭 + 작은 발견 열(59→75).
	## 2026-09-26, PLAN 106장 ㊾ 여섯째 지역 틈새 갈림길(world/region6_crossing.gd) — 지역·고개·정거장·성문·시계탑·섬돌 + 작은 발견 열(75→91).
	## 2026-09-26, PLAN 106장 ㊾-3 — 갈림길 끝 섬(world/rift_end.gd, 91→92).
	## 2026-09-27, PLAN 106장 ㊿ 일곱째 지역 잠긴 도읍(world/region7_sunken.gd) — 지역·고개·궁궐·기지·빛 돔·등대 + 작은 발견 열(92→108).
	## 2026-09-27, PLAN 106장 51-1 이야기 7부 구름 위 항로(world/sky_route.gd) — 하늘 사당·비행선 잔해·궤도 정거장 조각(108→111).
	## 2026-09-27, PLAN 106장 52-1 이야기 8부 먹구름 눈(world/storm_eye.gd — 구름섬 서쪽 하늘, 28장 끝에 열림, 111→112).
	## 2026-09-27, PLAN 106장 53-1 여덟째 지역 굳은 거리(world/region8_amber.gd) — 지역·고개·네거리·시계방·장터·부양탑 + 작은 발견 열(112→128).
	## 2026-09-27, PLAN 106장 54-1 아홉째 지역 갈무리 벌(world/region9_vault.gd) — 지역·고개·금고·동력 기둥·곳간·야적장 + 작은 발견 열(128→144).
	## 2026-09-27, PLAN 106장 55-1 열째 지역 세갈래 고을(world/region10_fork.gd) — 지역·성문·길목·대장간·공사장·종루 + 작은 발견 열(144→160).
	"place": 160,  # 굴 입구·마을·(마을의)폐허·다리·옛 사당·폭포·역참·포구·
	              # 산 너머 폐허(ruins_far)·고래뼈·부서진 방패·투구·화살·깃대·
	              # 닻·그물더미·조개무지·돌무더기·이끼바위·허수아비·이정표·
	              # 여우굴·고목구멍·벌집·다람쥐둥지·오소리굴·딱따구리나무·
	              # 우물·산길돌탑·옹달샘·불자리·돛대·게딱지·모래성·밀물웅덩이·
	              # 벽돌·계단·항아리·기둥·벽화·잿더미·마른우물·문틀 조각
	## 2026-09-16, GO 포구 콘텐츠 확장(region2_coast.gd) — 늙은 어부 추가(2→3).
	"people": 3,  # 마을 촌장·떠돌이 상인·늙은 어부
	## "갈매기"·"게"는 웹판 animal.js에 없는 이 슬라이스만의 새 짐승 —
	## region2_coast.gd 헤더 참고(정직하게 밝혀 둔 대로 새 종이다).
	## 2026-09-16, 포구 콘텐츠 확장 — 게 추가(5→6).
	"beast": 6,   # 사슴·까치·잉어·소·갈매기·게
	## 2026-09-16, GO 포구 콘텐츠 확장 — 어부의 한 번뿐인 제안(offer_npc_fisher)
	## 추가(14→15, 상인의 "길 위의 상인"과 같은 결). 2026-09-16, 포구
	## 콘텐츠 확장 2호 — 표류물(coast_driftwood) 추가(15→16). 2026-09-16,
	## 포구 콘텐츠 확장 4호 — 뒤집힌 조각배(coast_boat) 추가(16→17).
	## 2026-09-16, 폐허 콘텐츠 1호 — 옛 유물(ruins_relic) 추가(17→18).
	"event": 18,  # 도적의 습격·도적 두목·부상병·비문·지도조각·약초·
	              # 사라진 아이·늑대 무리·정찰병·마을의 부탁·길 위의 상인·
	              # 이름 없는 굴·불어난 여울(비 올 때만)·산속 폭포·어부의 그물·
	              # 표류물·뒤집힌 조각배·옛 유물
	## 2026-09-16, GO 폐허(region3_ruins.gd) — hero_encounter.gd에 region_id
	## export를 얹어 세 번째 역사 인물 조우 추가(2→3, 결사=계백 오마주,
	## "오천으로 오만을 맞겠다" — 마지막 항전이라 폐허라는 자리와 결이 맞는다).
	"record": 3,  # 해장(이순신 오마주)·현책(제갈량 오마주)·결사(계백 오마주)
	## 2026-09-14, GO 51장 "희귀 몬스터" — pets.gd 신수 11종(사신 넷 +
	## 나머지 일곱) 전부 TestVillage.tscn에 배치 완료(pet_encounter.gd
	## 헤더 참고). event/beast와 같은 원칙대로 실제 배치된 개수만
	## TOTAL에 넣는다.
	"pet": 11,
}

var book: Dictionary = {}
var _session_start_count: int = 0


## party_state.gd begin_session()과 같은 계약·같은 이유(로드 뒤에 부른다).
func begin_session() -> void:
	_session_start_count = count()


func session_discovered() -> int:
	return count() - _session_start_count


## 처음 본 것에 도장을 찍는다. 처음일 때만 true를 준다 — 두 번째부터는
## 아무 일도 안 일어나니 지나갈 때마다 불러도 안전하다(웹판 discover()와
## 같은 계약).
func discover(kind: String, id: String) -> bool:
	if not TOTAL.has(kind):
		push_warning("CodexState: unknown kind " + kind)
		return false
	var key := kind + ":" + id
	if book.has(key):
		return false
	book[key] = true
	var reward: float = REWARD.get(kind, 0.0)
	if reward > 0.0:
		PartyState.add_exp(reward)
	codex_changed.emit()
	return true


func has(kind: String, id: String) -> bool:
	return book.has(kind + ":" + id)


func count() -> int:
	return book.size()


func total() -> int:
	var sum := 0
	for v in TOTAL.values():
		sum += v
	return sum


## save_state.gd가 저장 파일을 불러온 뒤 여기로 넘긴다(party_state.gd의
## restore()와 같은 경계).
func restore(saved_book: Dictionary) -> void:
	book = saved_book.duplicate()
	codex_changed.emit()
