extends RefCounted
## G-0032 — 발견 도감 이름표. CodexState 는 "본 것에 도장"만 찍고 이름을 안 들고 있어(codex_state.gd 머리말), 도감 화면(ui/codex_screen.gd)
## 발견 탭이 보일 이름을 여기 한 곳에 모았다. id 는 각 지역 파일이 CodexState.discover() 에 넘기는 값 그대로(손대지 않는다),
## 이름은 codex_state.gd TOTAL 주석·지역 파일 주석·장면 사건 제목에서 옮겼다. 갈래별 개수는 CodexState.TOTAL 과 같아야 한다
## (tools/probe_codex_screen.gd 가 개수·장면의 발견 지점 id 를 대조한다). 지역이 늘면 여기에도 한 줄.
##   역사 인물(record)·신수(pet) 이름은 Characters·Pets 표에서 읽으므로 id 만 둔다.

const REGION_ORDER := ["village", "coast", "ruins", "frost", "skyport", "crossing", "sunken", "amber", "vault", "fork", "sky"]
const REGION_NAMES := {
	"village": "청하 마을", "coast": "갯바람 포구", "ruins": "잿빛 폐허", "frost": "서리봉 고원", "skyport": "은하 나루",
	"crossing": "틈새 갈림길", "sunken": "잠긴 도읍", "amber": "굳은 거리", "vault": "갈무리 벌", "fork": "세갈래 고을", "sky": "하늘",
}

## [id, 이름, 지역]
const PLACES := [
	["village", "청하 마을", "village"], ["cave", "굴 입구", "village"], ["ruins", "마을 옛 폐허", "village"], ["bridge", "다리", "village"],
	["shrine", "옛 사당", "village"], ["waterfall", "폭포", "village"], ["waystation", "역참", "village"],
	["village_cairn", "돌무더기", "village"], ["village_mossstone", "이끼바위", "village"], ["village_scarecrow", "허수아비", "village"],
	["village_milestone", "이정표", "village"], ["village_foxden", "여우굴", "village"], ["village_hollow", "고목 구멍", "village"],
	["village_beehive", "벌집", "village"], ["village_squirrelnest", "다람쥐 둥지", "village"], ["village_badgerden", "오소리굴", "village"],
	["village_woodpecker", "딱따구리 나무", "village"], ["village_well", "우물", "village"], ["village_pass_cairn", "산길 돌탑", "village"],
	["village_spring", "옹달샘", "village"], ["village_old_road", "옛 역참 터", "village"],
	["harbor", "갯바람 포구", "coast"], ["coast_whalebone", "고래뼈", "coast"], ["coast_anchor", "닻", "coast"], ["coast_netpile", "그물 더미", "coast"],
	["coast_shellmidden", "조개무지", "coast"], ["coast_firepit", "불자리", "coast"], ["coast_mast", "돛대", "coast"], ["coast_crabshell", "게딱지", "coast"],
	["coast_sandcastle", "모래성", "coast"], ["coast_tidepool", "밀물 웅덩이", "coast"], ["coast_shipyard", "녹슨 조선소", "coast"],
	["ruins_far", "산 너머 폐허", "ruins"], ["ruins_shield", "부서진 방패", "ruins"], ["ruins_helm", "투구", "ruins"], ["ruins_arrows", "화살", "ruins"],
	["ruins_banner", "깃대", "ruins"], ["ruins_brick", "벽돌", "ruins"], ["ruins_step", "계단", "ruins"], ["ruins_urn", "항아리", "ruins"],
	["ruins_column", "기둥", "ruins"], ["ruins_mural", "벽화", "ruins"], ["ruins_ash", "잿더미", "ruins"], ["ruins_well", "마른 우물", "ruins"],
	["ruins_gateframe", "문틀 조각", "ruins"], ["ruins_rift_observatory", "시간 틈 관측소", "ruins"],
	["frost_plateau", "서리봉 고원", "frost"], ["frost_pass", "고원 고개", "frost"], ["frost_fort", "옛 산성 터", "frost"],
	["frost_observatory", "기상 관측소", "frost"], ["frost_airship", "추락한 비행선", "frost"], ["frost_lake", "얼어붙은 호수", "frost"],
	["frost_satellite", "떨어진 위성 조각", "frost"], ["frost_statue", "눈에 묻힌 장수 석상", "frost"], ["frost_hut", "사냥꾼 오두막", "frost"],
	["frost_snowman", "눈사람과 썰매", "frost"], ["frost_cablecar", "멈춘 케이블카", "frost"], ["frost_icecave", "얼음굴 어귀", "frost"],
	["frost_beacon", "옛 봉화 돌무더기", "frost"],
	["skyport_region", "은하 나루", "skyport"], ["skyport_pass", "나루 고개", "skyport"], ["skyport_port", "나루터", "skyport"],
	["skyport_temple", "절터", "skyport"], ["skyport_station", "역", "skyport"], ["skyport_solar", "태양광 밭", "skyport"],
	["skyport_drone", "멈춘 배달 기계", "skyport"], ["skyport_bell", "쓰러진 절 종", "skyport"], ["skyport_phone", "빈 공중전화", "skyport"],
	["skyport_capsule", "묻힌 시간 캡슐", "skyport"], ["skyport_totem", "고개 돌무더기 탑", "skyport"], ["skyport_sign", "녹슨 이정표", "skyport"],
	["skyport_crates", "화물 상자 더미", "skyport"], ["skyport_busstop", "빈 버스 정류장", "skyport"], ["skyport_jars", "옹기 더미", "skyport"],
	["skyport_antenna", "쓰러진 안테나", "skyport"],
	["crossing_region", "틈새 갈림길", "crossing"], ["crossing_pass", "갈림길 고개", "crossing"], ["crossing_station", "정거장", "crossing"],
	["crossing_gate", "성문", "crossing"], ["crossing_clock", "시계탑", "crossing"], ["crossing_stones", "섬돌", "crossing"],
	["crossing_dial", "떨어진 시계 문자판", "crossing"], ["crossing_lantern", "허공에 멈춘 등롱", "crossing"], ["crossing_robot", "멈춘 경비 기계", "crossing"],
	["crossing_tiles", "멈춘 기와 조각", "crossing"], ["crossing_signal", "철도 신호기", "crossing"], ["crossing_crystal", "틈 수정", "crossing"],
	["crossing_cart", "바퀴 빠진 수레", "crossing"], ["crossing_pod", "묻힌 탈출 포드", "crossing"], ["crossing_ticket", "표 파는 기계", "crossing"],
	["crossing_helm", "꽂힌 칼과 투구", "crossing"], ["crossing_end", "갈림길 끝 섬", "crossing"],
	["sunken_region", "잠긴 도읍", "sunken"], ["sunken_pass", "도읍 고개", "sunken"], ["sunken_palace", "잠긴 궁궐", "sunken"],
	["sunken_base", "물밑 기지", "sunken"], ["sunken_dome", "빛 돔", "sunken"], ["sunken_light", "등대", "sunken"],
	["sunken_tewak", "해녀 테왁과 망사리", "sunken"], ["sunken_helmet", "구리 잠수 투구", "sunken"], ["sunken_crates", "기지 보급 상자", "sunken"],
	["sunken_pearl", "큰 진주조개", "sunken"], ["sunken_buoy", "신호 부표", "sunken"], ["sunken_turtle", "비석 돌거북", "sunken"],
	["sunken_plaque", "떠 있는 궁궐 편액", "sunken"], ["sunken_haetae", "산호 덮인 해태상", "sunken"], ["sunken_jelly", "빛 해파리 떼", "sunken"],
	["sunken_drone", "멈춘 수중 드론", "sunken"],
	["amber_region", "굳은 거리", "amber"], ["amber_pass", "거리 고개", "amber"], ["amber_cross", "네거리", "amber"],
	["amber_shop", "시계방", "amber"], ["amber_market", "장터", "amber"], ["amber_tower", "부양탑", "amber"],
	["amber_bike", "멈춘 자전거", "amber"], ["amber_phone", "공중전화 부스", "amber"], ["amber_pigeons", "굳은 비둘기 떼", "amber"],
	["amber_scale", "장터 저울", "amber"], ["amber_coins", "흩어진 엽전 꾸러미", "amber"], ["amber_blueprint", "빛 설계 도면", "amber"],
	["amber_surveyor", "멈춘 측량 드론", "amber"], ["amber_kiosk", "신문 가판대", "amber"], ["amber_shard", "호박 결정 덩이", "amber"],
	["amber_umbrella", "멈춘 빗방울과 우산", "amber"],
	["vault_region", "갈무리 벌", "vault"], ["vault_pass", "벌 고개", "vault"], ["vault_dome", "금고", "vault"],
	["vault_pylons", "동력 기둥", "vault"], ["vault_granary", "곳간", "vault"], ["vault_yard", "야적장", "vault"],
	["vault_haystack", "볏가리", "vault"], ["vault_jars", "장독대", "vault"], ["vault_mortar", "디딜방아", "vault"],
	["vault_sotdae", "솟대", "vault"], ["vault_forklift", "멈춘 지게차", "vault"], ["vault_parcels", "택배 상자 더미", "vault"],
	["vault_container", "문 열린 컨테이너", "vault"], ["vault_seedpod", "떨어진 씨앗 캡슐", "vault"], ["vault_drone_down", "떨어진 운반 드론", "vault"],
	["vault_case_shard", "깨진 진열장 조각", "vault"],
	["fork_region", "세갈래 고을", "fork"], ["fork_gate", "고을 성문", "fork"], ["fork_junction", "길목", "fork"],
	["fork_forge", "대장간", "fork"], ["fork_works", "공사장", "fork"], ["fork_tower", "종루", "fork"],
	["fork_well", "고을 우물", "fork"], ["fork_laundry", "멈춘 빨래", "fork"], ["fork_kite", "멈춘 방패연", "fork"],
	["fork_tripod", "측량 삼각대", "fork"], ["fork_rails", "레일 더미", "fork"], ["fork_flag", "측량 깃발", "fork"],
	["fork_drone", "떨어진 보관 드론", "fork"], ["fork_shard", "부러진 격자 조각", "fork"], ["fork_rain", "멈춘 빗방울", "fork"],
	["fork_birds", "멈춘 새 떼", "fork"],
	["sky_shrine", "하늘 사당", "sky"], ["sky_wreck", "비행선 잔해", "sky"], ["sky_orbit", "궤도 정거장 조각", "sky"], ["storm_eye", "먹구름 눈", "sky"],
]

## [id, 이름]
const PEOPLE := [["npc_elder", "마을 촌장"], ["npc_merchant", "떠돌이 상인"], ["npc_fisher", "늙은 어부"]]
const BEASTS := [["deer", "사슴"], ["magpie", "까치"], ["carp", "잉어"], ["ox", "소"], ["gull", "갈매기"], ["crab", "게"]]
const EVENTS := [
	["BanditEncounter", "도적의 습격"], ["BanditLeaderEncounter", "도적 두목의 소굴"], ["WolfPackEvent", "늑대 무리"],
	["EnemyScoutEvent", "적군 정찰병"], ["HurtSoldierEvent", "부상당한 병사"], ["StoneTextEvent", "고대 비문"],
	["MapScrapEvent", "보물 지도 조각"], ["RareHerbEvent", "희귀 약초"], ["LostChildEvent", "사라진 아이"],
	["CaveSecretEvent", "이름 없는 굴"], ["FloodFordEvent", "불어난 여울"], ["WaterfallFallsEvent", "산속 폭포"],
	["village_ask", "마을의 부탁"], ["offer_npc_merchant", "길 위의 상인"], ["offer_npc_fisher", "어부의 그물"],
	["coast_driftwood", "표류물"], ["coast_boat", "뒤집힌 조각배"], ["ruins_relic", "옛 유물"],
]
## 역사 인물 조우(hero_encounter.gd 셋) — 이름은 Characters 에서.
const RECORDS := ["kr_yisunsin", "sg_zhugeliang", "kr_gyebaek"]

## 갈래 하나의 [id, 이름] 목록(신수는 Pets, 기록은 Characters 에서 이름을 찾는다).
static func entries(kind: String) -> Array:
	match kind:
		"place":
			return PLACES.map(func(e: Array) -> Array: return [e[0], e[1]])
		"people":
			return PEOPLE
		"beast":
			return BEASTS
		"event":
			return EVENTS
		"record":
			var ch := preload("res://saga_core/data/characters.gd")
			return RECORDS.map(func(id: String) -> Array:
				var h: Variant = ch.find(id)
				return [id, String(h.name) if h != null else id])
		"pet":
			var pets := preload("res://saga_core/data/pets.gd")
			return pets.PETS.map(func(p: Dictionary) -> Array: return [String(p.id), String(p.name)])
	return []

## 지역 하나의 [id, 이름] 목록(지명만).
static func places_in(region: String) -> Array:
	var out: Array = []
	for e: Array in PLACES:
		if e[2] == region:
			out.append([e[0], e[1]])
	return out
