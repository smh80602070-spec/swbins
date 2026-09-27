extends RefCounted

## PLAN 106장 ㊹ — 원신식 탐사 파견(표·계산만 — 보내기·받기·화면은 world/dispatch.gd, 상태는 PartyState.dispatch
## {"out": {탐사지: {"id": 인물, "hours": 시간, "start": 보낸 실제 시각}}, "done": 받은 번수}).
##   마을 역참 곁 "탐사 파견" 게시판(F)에서 들판 명단에 없는 동료를 탐사지 하나에 보낸다 — 탐사지 하나에 한 명.
##   걸리는 시간 넷(4·8·12·20시간, 이 기기 실제 시각 — 게임을 꺼 둬도 흐른다). 다 되면 게시판에서 받기, 도중에 부르면 보상 없이 돌아온다.
##   동시에 보낼 수 있는 수는 모험 등급으로(2~5). 탐사지는 그 지역 신상을 켜야 열린다(지도가 드러나는 조건과 같다).
##   탐사 중인 동료는 들판 명단·편성에 못 넣는다(원신과 같다).
##   원신은 인물 고유 특성이 탐사 보상을 늘리지만, 이 판은 탐사지마다 잘 맞는 원소가 있어 그 원소 인물이면 보상 +25%(올림).
## 이름·수치는 이 판 것. 탐사지는 과거·현대·미래가 섞인다(SAGA-DESIGN §12 전체 퓨전).

const HOURS := [4, 8, 12, 20]
## 시간별 보상 배율(원신처럼 오래 보낼수록 시간당은 조금 준다).
const MUL := [1.0, 1.8, 2.5, 3.8]
const AFFINITY_BONUS := 0.25
## 보낼 수 있는 수 — 모험 등급이 이 값 이상인 칸 수(1·1·5·10·15 → 2~5).
const SLOT_AR := [1, 1, 5, 10, 15]

## 게시판 — 마을 역참 앞 순간이동 지점(waypoints.gd v_station) 곁, 의뢰 게시판(commissions.gd, 서남쪽)의 반대편 북동쪽.
const BOARD_REGION := "village"
const BOARD_CELL := Vector2(5.35, 3.0)
const BOARD_OFFSET := Vector3(4.0, 0.0, -4.0)
const BOARD_M := 3.0

## 탐사지 id → {region, name, era, element, base}. base = 4시간 보상(시간 배율을 곱해 반올림, 칸마다 최소 1).
const SPOTS := {
	"d_road": {"region": "village", "name": "옛 역참 길", "era": "과거", "element": "wind", "base": {"mora": 1500},
		"desc": "파발이 달리던 길 — 길손이 떨군 냥을 줍는다"},
	"d_wood": {"region": "village", "name": "북쪽 숲 가장자리", "era": "과거", "element": "grass", "base": {"mint": 2, "mushroom": 1},
		"desc": "박하와 송이버섯이 나는 그늘"},
	"d_mudflat": {"region": "coast", "name": "갯벌 선창", "era": "현대", "element": "water", "base": {"clam": 3},
		"desc": "물 빠진 갯벌에서 바지락을 캔다"},
	"d_shipyard": {"region": "coast", "name": "녹슨 조선소", "era": "현대", "element": "fire", "base": {"ore_s": 2, "iron": 1},
		"desc": "버려진 배를 뜯어 쓸 만한 쇠를 골라낸다"},
	"d_quarry": {"region": "ruins", "name": "잿빛 채석장", "era": "과거", "element": "rock", "base": {"iron": 2, "meat": 1},
		"desc": "옛 석공의 채석장 — 무쇠 조각과 들짐승"},
	"d_rift": {"region": "ruins", "name": "시간 틈 관측소", "era": "미래", "element": "thunder", "base": {"polish": 1, "ore_s": 1},
		"desc": "틈에서 흘러나온 앞 시대의 부품을 모은다"},
	## ㊻-2 서리봉 고원 — 셋째까지 없던 빙 원소 하나, 미래 한 곳· ㊻-3 고원 특산물 눈꽃 하나씩.
	"f_fortress": {"region": "frost", "name": "얼음 아래 산성 터", "era": "과거", "element": "ice", "base": {"iron": 1, "mushroom": 2, "snow_bloom": 1},
		"desc": "언 호수 밑 옛 산성 — 녹슨 쇠붙이와 그늘 버섯"},
	"f_wreck": {"region": "frost", "name": "추락한 비행선 잔해", "era": "미래", "element": "wind", "base": {"ore_s": 2, "polish": 1, "snow_bloom": 1},
		"desc": "눈에 묻힌 앞 시대 비행선에서 부품을 떼어 온다"},
	## ㊽-1 은하 나루 — 미래 나루 창고(뇌)·과거 옛 절터(초). 나루 신상 s_statue 를 켜야 열린다.
	"s_depot": {"region": "skyport", "name": "별배 나루 창고", "era": "미래", "element": "thunder", "base": {"polish": 1, "ore_s": 2},
		"desc": "주인 잃은 화물 상자에서 쓸 만한 부품을 고른다"},
	"s_temple": {"region": "skyport", "name": "옛 절터 주춧돌", "era": "과거", "element": "grass", "base": {"mushroom": 2, "mint": 1, "iron": 1},
		"desc": "주춧돌 틈에 자란 버섯과 옛 쇠붙이를 줍는다"},
	## ㊾ 틈새 갈림길 — 현대·미래 첫 정거장 분실물 창고(풍)·과거 뒤엉킨 성문(암). 갈림길 신상 x_statue 를 켜야 열린다.
	"x_stop": {"region": "crossing", "name": "첫 정거장 분실물 창고", "era": "현대", "element": "wind", "base": {"polish": 1, "ore_s": 1, "iron": 1},
		"desc": "여러 시대 손님이 두고 간 짐에서 쓸 만한 것을 고른다"},
	"x_gate": {"region": "crossing", "name": "뒤엉킨 성문 아래", "era": "과거", "element": "rock", "base": {"iron": 2, "mushroom": 1},
		"desc": "허공에 멈춘 성벽 조각 밑에서 옛 쇠붙이를 줍는다"},
	## ㊿ 잠긴 도읍 — 현대 해저 연구 기지(수)·과거 잠긴 궁궐(암). 도읍 신상 u_statue 를 켜야 열린다.
	"u_base": {"region": "sunken", "name": "해저 연구 기지 창고", "era": "현대", "element": "water", "base": {"clam": 2, "ore_s": 1, "polish": 1},
		"desc": "물이 샌 기지 창고에서 쓸 만한 부품과 조개를 건진다"},
	"u_palace": {"region": "sunken", "name": "잠긴 궁궐 기단", "era": "과거", "element": "rock", "base": {"iron": 2, "clam": 1},
		"desc": "물 빠진 틈에 기단 둘레에서 옛 쇠붙이를 줍는다"},
	## 53 굳은 거리 — 과거 호박 속 장터(암)·현대 멈춘 전철(뇌). 거리 신상 a_statue 를 켜야 열린다.
	"a_market": {"region": "amber", "name": "호박 속 장터 좌판", "era": "과거", "element": "rock", "base": {"iron": 2, "apple": 1},
		"desc": "결정이 덜 굳은 좌판 가장자리에서 옛 물건을 캐낸다"},
	"a_rail": {"region": "amber", "name": "멈춘 전철 차고", "era": "현대", "element": "thunder", "base": {"ore_s": 2, "polish": 1},
		"desc": "고가 선로 밑 차고에서 멈춘 전철 부품을 떼어 온다"},
	## 54 갈무리 벌 — 과거 곳간 마을(초)·현대 물류 야적장(뇌). 벌 신상 g_statue 를 켜야 열린다.
	"g_granary": {"region": "vault", "name": "곳간 마을 뒷밭", "era": "과거", "element": "grass", "base": {"apple": 2, "iron": 1},
		"desc": "곳간 마을 뒷밭 둑에서 잊힌 씨앗 자루와 농기구 쇠붙이를 거둔다"},
	"g_yard": {"region": "vault", "name": "갈무리 물류 창고", "era": "현대", "element": "thunder", "base": {"ore_s": 2, "polish": 1},
		"desc": "멈춘 컨테이너를 뒤져 쓸 만한 부품을 챙겨 온다"},
}
const ORDER := ["d_road", "d_wood", "d_mudflat", "d_shipyard", "d_quarry", "d_rift", "f_fortress", "f_wreck", "s_depot", "s_temple", "x_stop", "x_gate", "u_base", "u_palace", "a_market", "a_rail", "g_granary", "g_yard"]


static func spot(id: String) -> Dictionary:
	return SPOTS.get(id, {})

static func slots_for_ar(ar: int) -> int:
	var n := 0
	for a in SLOT_AR:
		if ar >= int(a):
			n += 1
	return n

static func hours_index(hours: int) -> int:
	return maxi(HOURS.find(hours), 0)

## 탐사지 id 에 hours 시간, 잘 맞는 원소면 affinity — 받는 것 {칸: 수}.
static func reward_of(id: String, hours: int, affinity: bool) -> Dictionary:
	var out := {}
	var m: float = MUL[hours_index(hours)] * (1.0 + AFFINITY_BONUS if affinity else 1.0)
	var base: Dictionary = spot(id).get("base", {})
	for k in base:
		var v := float(base[k]) * m
		out[k] = maxi(ceili(v - 0.001) if affinity else roundi(v), 1)
	return out

## 남은 초를 "3시간 12분"·"45분"·"20초" 로.
static func time_text(sec: float) -> String:
	var s := maxi(ceili(sec), 0)
	if s >= 3600:
		return "%d시간 %d분" % [s / 3600, (s % 3600) / 60]
	if s >= 60:
		return "%d분" % (s / 60)
	return "%d초" % s
