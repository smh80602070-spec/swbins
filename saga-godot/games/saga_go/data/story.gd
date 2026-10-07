extends RefCounted

## PLAN 106장 ㉕ — 원신식 이야기 임무(마신 임무 자리). 표만 — 진행은 world/story_quest.gd, 상태는 PartyState.story {ch, step}.
##   장(chapter)마다 단계를 차례로. 단계 type:
##     talk  — 그 인물(NPCS)에게 3m 안에서 F → 대화(줄마다 F·Space·누르기로 넘김, 고르는 줄은 대답만 다르다).
##             줄 = [말하는 이, 글, 표정?] — 표정은 world/talk_face.gd MOODS(joy·angry·sorrow·surprised·fun), 없으면 보통
##     go    — 그 자리 radius 안에 들어가기
##     boss  — 들판 보스(world/field_bosses.gd) 하나 쓰러뜨리기(보상 꽃은 따로)
##     kill  — 그 자리에 임무 적(되살아나지 않음·전리품 없음)이 서고, 다 쓰러뜨리기
##     light — 그 자리 옛 제단에 원소 스킬·폭발(어느 원소든)
##     domain — 그 비경(data/domains.gd)을 깨기(보상 나무는 따로)
##     gather — 그 채집물(data/cooking.gd GATHER)을 count 번 캐기(world/gathering.gd `gathered`, 센 수는 저장 안 함)
##     cook   — 아무 요리나 한 번(world/kitchen.gd `cooked`)
##     follow — 그 인물이 path(칸 좌표)를 따라 걷는다 — 내가 FOLLOW_NEAR 안이면 걷고 멀면 서서 기다린다. 길 끝에 닿으면 끝(불러오면 길 처음부터)
##     climb  — 그 자리 radius 안, 땅 높이 + above(없으면 0) - CLIMB_SLACK m 보다 높이 서기(산 꼭대기·구조물 위 — 벽을 타거나 활공으로)
##     duel   — 그 자리에 이야기 보스 kind(combat/field_boss.gd, 되살아나지 않음·전리품 없음·세계 등급) 하나, 쓰러뜨리기
##     seal   — 그 자리 제단을 둘러싼 석등(order 순서의 SEAL_MARKS)을 order 차례대로 원소 스킬·폭발로 밝힌다(어느 원소든).
##              차례가 틀리면 다 꺼진다. 한 번에 여럿이 닿으면 다음 차례 것만 켜진다. 켠 수는 저장 안 함
##     defend — 그 자리 제단(체력 hp × 세계 등급 공격 배율)을 waves 물결의 적에게서 지킨다(원신 장치 지키기). 내가 DEFEND_START m 안에
##              들어서면 첫 물결, 물결을 다 쓰러뜨리거나 DEFEND_WAVE_SEC 초가 지나면 다음 물결(둘레 DEFEND_RING m 에서 나와 제단으로 곧장 —
##              내가 가까이 붙으면 나를 친다). 제단이 무너지면 그 단계 처음부터. 물결·제단 체력은 저장 안 함
##     chase  — name 도둑이 path(칸 좌표)를 따라 CHASE_SPEED 로 달아난다(내가 CHASE_START m 안에 들면 출발, 길 점마다 CHASE_PAUSE 초 숨 고르기).
##              CHASE_CATCH m 안으로 따라잡으면 끝, 길 끝까지 놓치면 처음 자리로 돌아가 다시 기다린다(걸어서는 못 잡고 달려야 잡는다)
##     sail   — 그 인물(npc)에게 F → 한 줄(line) 뒤 배로 to {region, cell} 에 내린다(106장 ㊲ 사공 버들의 배)
##     sky    — 바람 기둥을 타고 구름섬(world/sky_isle.gd — 북쪽 봉우리 옆 하늘) 윗면에 서기(106장 ㊳)
##     party  — 들판 명단(나 + 동료 셋)의 이야기 동료가 eras 의 시대를 하나씩 다 채우기(MEMBERS era — 106장 52 29장 편성 시험). 편성은 인물 화면
##     duel 의 flee = 쓰러뜨렸을 때 알림 글자(없으면 "가면에 금이 가고 — 먹구름 속으로 달아났다")
##     defend 의 altar = 제단 머리 글자(없으면 "넷째 제단") · start = 첫 물결 알림 · dirs = 무리가 나오는 방향(도, 북쪽 0·시계 방향 — 담이 막는 쪽은 빼게) ·
##     bare = true 면 제단 돌 없이 그 자리 장치가 받는다(29장 매듭 등불 — 머리 글자만)
##     seal 의 bare = true 면 제단 돌·불 없이 석등 셋이 그 자리 장치를 둘러싼다(31장 장터 결정 돔 — 깨지는 모양은 그 지역 파일) · hit_text = 다 켰을 때 알림
##   인물 helmet = true 면 머리에 옛 장수 투구(world/vroid_body.gd add_helmet) · visor = true 면 앞 시대 관측 바이저(add_visor) ·
##   hat = true 면 파발꾼 벙거지(add_hat) · halo = true 면 머리 위 빛 고리(add_halo — 은하 나루 나루지기) ·
##   beads = true 면 목에 염주·가사 띠(add_beads — 옛 절터 종지기) · goggles = true 면 이마에 기관사 고글(add_goggles — 은하역 기관사).
##   captain_hat = true 면 남색·금띠 선장 모자(add_hat 색만 — 별배 선장).
##   인물 자리 칸에 ch_to 가 있으면 ch ~ ch_to 장 모두(그 장들이 끝난 뒤 계속 서 있을 자리 — from 0·to 999 로). 칸은 먼저 맞는 것.
##   light 의 bell = true 면 제단 돌을 안 보이고, 원소가 닿으면 불 대신 종각에 건 종이 운다(world/region5_skyport.gd ring_bell — 17장).
##   light 의 bare = true 면 제단 돌·불 없이 그 자리 장치가 받는다(18장 변전함 — 켜진 모양은 그 지역 파일이 장·단계를 보고 바꾼다) · hit_text = 닿았을 때 알림.
##   chase 의 body = "drone"(배달 기계) · "horse"(놀란 역마, world/creature_builder.gd 말 — colors 세 빛깔) ·
##     "captain"(선장의 잔상 — 사람 몸 + 남색 선장 모자, 가면 없음) · 없으면 가면 쓴 사람.
##   단계·인물 칸에 sky = true 면 그 칸의 높이는 땅이 아니라 구름섬 윗면(kill·duel·appear — 9장).
##   lift = m 면 그 칸 땅 높이 + lift(떠 있는 구조물 윗면 — 14장 시간 틈 관측대, world/era_sites.gd OBS_RISE)(kill·duel·appear·stations).
##   rift_end = true 면 그 칸의 높이는 갈림길 끝 섬 윗면(world/rift_end.gd top_y — 20장)(kill·duel·light·seal·defend·sail 의 to·appear·stations).
##   isle = "<id>" 면 그 칸의 높이는 구름 위 항로 그 섬 윗면(world/sky_route.gd top_y — 7부, shrine·wreck·orbit)(rift_end 와 같은 곳에 다 쓴다).
##   eye = true 면 그 칸의 높이는 먹구름 눈 윗면(world/storm_eye.gd top_y — 8부 29장)(isle 과 같은 곳에 다 쓴다).
##     떠 있는 자리(sky·lift·rift_end·isle·eye)면 kill 둘레·seal 석등·defend 물결도 땅이 아니라 그 윗면 높이에 선다.
##   인물 자리: appear(보일 때만 서 있는 인물) · stations(늘 있는 인물이 그 장·단계 동안 옮겨 서는 자리) —
##     둘 다 {ch, from, to, region?, cell?} 한 칸 또는 여러 칸. region·cell 이 있으면 그 동안 거기에 선다.
##   대화 줄 말하는 이가 바뀌면 카메라가 그쪽으로(player/camera_rig.gd talk_shot — 인물 말은 내 어깨 너머, 내 말은 인물 어깨 너머).
##   단계마다 부대 경험 STEP_EXP, 장 끝에 reward + exp. 장은 모험 등급 ar 에 열린다.
##   G-0074 장 칸 cycle = 별배 재출항 그 회차 이상에만 열린다(13부 회차 전용 — 본편은 MAIN_CHAPTERS 장).
##   join 이 있는 장은 끝날 때 그 이야기 인물(MEMBERS)이 동료로 들어온다(원신 이야기 보상 인물) — 이미 지난 장이면 불러올 때 들어온다.
##   목표 자리엔 금빛 기둥·"◆ 거리", 왼쪽 미니맵 밑에 임무 이름·목표, 지도·미니맵에 금빛 마름모(미니맵 밖이면 가장자리).
## 이야기·이름은 이 판 것(오마주 문법만). 등장인물은 가상의 마을 사람.

const STEP_EXP := 10.0
const TALK_M := 3.0

const NPCS := {
	"elder": {"name": "청하 촌장 누리", "region": "village", "cell": Vector2(5.8, 3.3), "rarity": 3, "cloth": Color(0.42, 0.5, 0.38),
		"idle": "먹구름이 걷히면 마을 잔치를 열어야지."},
	"ferryman": {"name": "늙은 사공 버들", "region": "coast", "cell": Vector2(4.0, 4.65), "rarity": 2, "cloth": Color(0.3, 0.4, 0.55),
		"idle": "바다 냄새가 요즘 영 비릿해."},
	"scholar": {"name": "떠돌이 학자 은비", "region": "ruins", "cell": Vector2(3.1, 2.35), "rarity": 4, "cloth": Color(0.55, 0.42, 0.6),
		"idle": "이 비문, 읽을수록 이상하다니까."},
	## 4장에만 나오는 인물 — appear 의 장·단계 사이에만 서 있고, 따라가기(follow) 단계를 지나면 길 끝에 선다. mask = 얼굴에 흰 가면.
	"wanderer": {"name": "가면 쓴 나그네", "region": "village", "cell": Vector2(5.7, 6.2), "rarity": 4, "cloth": Color(0.22, 0.22, 0.28),
		"idle": "……", "mask": true, "appear": [{"ch": 3, "from": 1, "to": 5},
			{"ch": 4, "from": 6, "to": 6, "region": "village", "cell": Vector2(0.9, 1.62)},
			{"ch": 5, "from": 2, "to": 4, "region": "village", "cell": Vector2(7.35, 1.3)},
			{"ch": 6, "from": 2, "to": 6, "region": "coast", "cell": Vector2(3.3, 4.75)},
			{"ch": 7, "from": 6, "to": 9, "region": "coast", "cell": Vector2(5.9, 1.88)},
			{"ch": 8, "from": 2, "to": 2, "region": "village", "cell": Vector2(7.35, 1.3)},
			{"ch": 8, "from": 3, "to": 8, "region": "village", "cell": Vector2(6.95, 1.12), "sky": true},
			## 106장 52-2 27장 — 둘째 매듭을 다시 묶은 뒤(5) 옛길 제단 곁(석등 고리 밖 남동).
			{"ch": 26, "from": 5, "to": 5, "region": "village", "cell": Vector2(1.22, 1.42)},
			## 52-3 28장 — 먼저 구름섬에 올라가 기다린다(5~9, 9장 자리).
			{"ch": 27, "from": 5, "to": 9, "region": "village", "cell": Vector2(6.95, 1.12), "sky": true}]},
	## 8장 — 검은 가면의 참이름. 가면 반쪽이 깨진 채(금 간 파란 줄 가면) 다섯째 제단 곁에 한 번 선다.
	"haesol": {"name": "해솔", "region": "coast", "cell": Vector2(6.12, 2.05), "rarity": 5, "cloth": Color(0.1, 0.12, 0.17),
		"idle": "……", "mask": true, "mask_color": Color(0.3, 0.55, 0.9), "mask_face": Color(0.08, 0.07, 0.1), "crack": true,
		"appear": [{"ch": 7, "from": 8, "to": 8}]},
	## 9장 — 가면이 떨어진 뒤의 해솔(몸은 해솔과 같게 body). 구름섬에서 되찾은 뒤에만.
	"haesol_free": {"name": "해솔", "body": "haesol", "region": "village", "cell": Vector2(7.22, 0.9), "rarity": 5, "cloth": Color(0.16, 0.18, 0.26),
		"idle": "……고맙다. 노래를 다시 부를 수 있을 것 같아.", "appear": [{"ch": 8, "from": 6, "to": 9, "region": "village", "cell": Vector2(7.22, 0.9), "sky": true},
			## 106장 52-2 27장 — 셋째 매듭을 묶은 뒤(8) 봉우리 꼭대기(6장 나그네 자리).
			{"ch": 26, "from": 8, "to": 8, "region": "village", "cell": Vector2(7.35, 1.3)},
			## 52-4 29장 — 임금을 쓰러뜨린 뒤(6) 먹구름 눈 북동쪽(바람 기둥 쪽).
			{"ch": 28, "from": 6, "to": 6, "region": "village", "cell": Vector2(6.4646, 0.9167), "eye": true},
			## G-0074 13부 43장 — 봉우리에 올라온 뒤(2~4) 27장과 같은 꼭대기 자리.
			{"ch": 42, "from": 2, "to": 4, "region": "village", "cell": Vector2(7.35, 1.3)}]},
	## 106장 ㊺ 이야기 2부 — 서리봉 고원(world/region4_frost.gd). 관측원은 기상 관측소 앞, 조종 기계는 추락한 비행선 곁.
	"haram": {"name": "기상 관측원 하람", "era": "현대", "region": "frost", "cell": Vector2(3.85, 1.7), "rarity": 4, "cloth": Color(0.86, 0.46, 0.2),
		"idle": "기압계 바늘이 또 얼었네… 사흘째 눈이 안 멎어요."},
	"bandi": {"name": "조종 기계 반디", "era": "미래", "body": "drone", "region": "frost", "cell": Vector2(6.0, 4.8), "rarity": 4, "cloth": Color(0.55, 0.85, 0.95),
		"idle": "삐— 동력 3퍼센트. 추위 경고."},
	## 106장 ㊺-3 11장 — 옛 산성을 지키던 산성지기의 넋(과거). 산성에 들어선 뒤(2)부터 11장 끝까지만 선다 —
	## 문루 안쪽(2·6~7) · 호수 석등 차례 동안 호숫가(3~5). 장이 끝나면 불씨를 건네고 사라진다.
	## 106장 ㊼-1 이야기 3부 13장 — 갯바람 포구 동쪽 녹슨 조선소(world/era_sites.gd)의 조선공(현대). 늘 조선소 창고 앞에 선다.
	"daon": {"name": "조선공 다온", "era": "현대", "region": "coast", "cell": Vector2(7.52, 3.98), "rarity": 4, "cloth": Color(0.2, 0.36, 0.62),
		"idle": "이 조선소 문 닫은 지 십 년인데… 요즘 밤마다 쇳소리가 나요."},
	## 106장 ㊼-2 14장 — 잿빛 폐허 서쪽 시간 틈 관측소(world/era_sites.gd)의 관측사(미래). 늘 관측소 남서쪽 발치에 선다.
	"gaon": {"name": "시간 틈 관측사 가온", "era": "미래", "region": "ruins", "cell": Vector2(1.05, 2.33), "rarity": 4, "cloth": Color(0.86, 0.88, 0.92),
		"visor": true, "idle": "관측대가 또 한 뼘 기울었어요. 기록만 하고 있을 순 없는데…"},
	## 106장 ㊼-3 15장 — 청하 마을 남쪽 산골 옛 역참 터(world/era_sites.gd)의 파발꾼(과거). 늘 역참 터 앞에 선다(15장 8~10 은 별배 곁).
	## 15장을 마치면 3부 동료(MEMBERS story_dareum)가 된다.
	"dareum": {"name": "파발꾼 달음", "era": "과거", "region": "village", "cell": Vector2(4.86, 8.72), "rarity": 4, "cloth": Color(0.5, 0.34, 0.22),
		"hat": true, "idle": "파발은 멈추면 파발이 아니지요. …말이 좀 쉬어야 해서 그렇지."},
	## 106장 ㊽-2 16장 — 은하 나루(world/region5_skyport.gd) 별배 나루의 나루지기(미래). 늘 표지 부스 앞에 선다.
	"ara": {"name": "나루지기 아라", "era": "미래", "region": "skyport", "cell": Vector2(5.1, 1.68), "rarity": 4, "cloth": Color(0.28, 0.4, 0.62),
		"halo": true, "idle": "별배 나루는 오늘도 비어 있어요. …기다리는 게 제 일이니까요."},
	## 106장 ㊽-3 17장 — 옛 절터(world/region5_skyport.gd BELFRY_OFF) 종각 앞의 종지기(과거). 종각이 무너지던 밤 시간 틈에 휩쓸려 이 시대로 왔다.
	## 늘 종각 남쪽에 선다(17장 쓰러진 종 곁 동안은 STATIONS).
	"hangyeol": {"name": "종지기 한결", "era": "과거", "region": "skyport", "cell": Vector2(2.71, 3.64), "rarity": 4, "cloth": Color(0.46, 0.43, 0.38),
		"beads": true, "idle": "종지기는 종 곁에 있어야 하는 법이오. 종이 없어도 말이오."},
	## 106장 ㊽-4 18장 — 은하역(world/region5_skyport.gd _build_station) 마지막 기관사(현대). 늘 승강장 남쪽 끝 아래에 선다.
	## 18장을 마치면 4부 동료(MEMBERS story_dodam)가 된다.
	"dodam": {"name": "기관사 도담", "era": "현대", "region": "skyport", "cell": Vector2(4.9, 5.27), "rarity": 4, "cloth": Color(0.22, 0.28, 0.36),
		"goggles": true, "idle": "선로가 끊겨도 기관사는 역을 떠나지 않아요. 막차가 아직 여기 있으니까."},
	## 106장 ㊾-2 19장 — 별배 선장 한별(미래). 틈 한가운데서 시간을 멈춰 틈이 더 벌어지지 않게 붙들고 있었다.
	## 20장을 마치면 5부 동료(MEMBERS story_hanbyeol)가 된다.
	## 19장 7단계에 떠 있는 섬돌 꼭대기(lift = region6_crossing.gd TOP_H + 0.3)에 처음 서고, 8~9 섬돌 아래, 19장 뒤엔 첫 정거장 곁.
	"hanbyeol": {"name": "별배 선장 한별", "era": "미래", "region": "crossing", "cell": Vector2(4.8, 2.4), "rarity": 5, "cloth": Color(0.14, 0.18, 0.34),
		"captain_hat": true, "idle": "틈의 끝을 찾아야 해. 준비가 되면 말해 주게.",
		"appear": [{"ch": 18, "from": 7, "to": 7, "region": "crossing", "cell": Vector2(2.54, 7.0), "lift": 17.9},
			{"ch": 18, "from": 8, "to": 9, "region": "crossing", "cell": Vector2(2.95, 6.4)},
			## ㊾-3 20장 — 막차가 갈림길 끝에 닿은 뒤(2~10) 섬 위 옛 나무 선로 곁. 끝나면 다시 첫 정거장 곁.
			{"ch": 19, "from": 2, "to": 10, "region": "crossing", "cell": Vector2(6.394, 2.438), "rift_end": true},
			{"ch": 19, "from": 0, "to": 999, "region": "crossing", "cell": Vector2(4.8, 2.4)},
			## ㊿-2 21장 — 은하 나루 별배 곁(0~1) → 별배에서 내린 잠긴 도읍 모래밭(2~, 21장 뒤에도).
			{"ch": 20, "from": 0, "to": 1, "region": "skyport", "cell": Vector2(5.2, 1.95)},
			## 51-2 24장 — 별배로 하늘 사당 섬에 내린 뒤(2~, 24장 뒤에도) 섬 남쪽 내린 자리 곁(isle = world/sky_route.gd 섬 윗면).
			{"ch": 23, "from": 2, "to": 999, "region": "sunken", "cell": Vector2(6.4896, 7.4417), "isle": "shrine"},
			## 53-2 9부(30장~) — 별배를 은하 나루에 다시 매고 착륙판 곁에서 항로표를 본다(아래 하늘 사당 자리보다 먼저).
			{"ch": 29, "ch_to": 999, "from": 0, "to": 999, "region": "skyport", "cell": Vector2(5.2, 1.95)},
			{"ch": 24, "ch_to": 999, "from": 0, "to": 999, "region": "sunken", "cell": Vector2(6.4896, 7.4417), "isle": "shrine"},
			{"ch": 20, "ch_to": 999, "from": 0, "to": 999, "region": "sunken", "cell": Vector2(3.3, 1.8)}]},
	## 106장 ㊿-2 21장 — 잠긴 도읍(world/region7_sunken.gd) 해저 연구 기지의 마지막 대원(현대). 늘 기지 경사로 서쪽 모래밭에 선다.
	## 잠수 마스크는 기관사 고글과 같은 틀(goggles). 21장 4~6 은 잠수정 선착장 판 위(lift — 바다 밑 −3 + 3.5 = 판 윗면), 7~ 은 궁궐 기단 위.
	"yeoul": {"name": "잠수 기사 여울", "era": "현대", "region": "sunken", "cell": Vector2(6.2, 2.95), "rarity": 4, "cloth": Color(0.12, 0.3, 0.36),
		"goggles": true, "idle": "기지 불이 나간 지 한참이에요. 그래도 잠수정은 제가 지켜요."},
	## 106장 ㊿-3 22장 — 도읍이 잠기던 날 물질 나갔다가 시대에 갇힌 해녀(과거). 늘 물 위나 돔 안이라 appear 칸마다 자리(lift)를 준다 —
	## 곁채 지붕 위(1~2, 바다 밑 + 3.45 = 지붕 윗면) → 돔 문 앞 받침 위(3~6) → 문이 열린 뒤 돔 안(7~, 22장 뒤에도). 흰 물옷.
	"mulsae": {"name": "해녀 물새", "era": "과거", "region": "sunken", "cell": Vector2(3.5, 5.45), "rarity": 4, "cloth": Color(0.9, 0.9, 0.85),
		"idle": "숨 한 번에 한 길. 물은 서두르는 사람을 싫어한다오.",
		"appear": [{"ch": 21, "from": 1, "to": 2, "region": "sunken", "cell": Vector2(3.5, 5.45), "lift": 3.45},
			{"ch": 21, "from": 3, "to": 6, "region": "sunken", "cell": Vector2(4.833, 5.396), "lift": 3.5},
			{"ch": 21, "from": 7, "to": 999, "region": "sunken", "cell": Vector2(5.1875, 6.125)},
			{"ch": 22, "ch_to": 999, "from": 0, "to": 999, "region": "sunken", "cell": Vector2(5.1875, 6.125)}]},
	## 106장 ㊿-4 23장 — 빛 돔을 지키는 안내 인공지능(미래). 몸은 반디와 같은 조종 기계 틀(drone)에 파란 빛깔.
	## 돔 안 기록실 앞(경사로 발치 동쪽 — 돔 가운데에서 동 4m·남 6.5m)에 23장부터 선다(22장 뒤에도).
	"parang": {"name": "돔 관리 인공지능 파랑", "era": "미래", "body": "drone", "region": "sunken", "cell": Vector2(5.0833, 6.1354), "rarity": 4,
		"cloth": Color(0.3, 0.55, 1.0), "idle": "빛 돔 기록실입니다. 열람하실 기록을 말씀해 주십시오.",
		"appear": [{"ch": 22, "ch_to": 999, "from": 0, "to": 999}]},
	## 106장 51-2 24장 — 하늘 사당(world/sky_route.gd shrine)의 바람 방울을 지키던 무녀(과거). 사당이 하늘로 들린 날부터 홀로 남았다.
	## 별배가 섬에 내린 뒤(24장 2~, 뒤에도) 사당 앞 서쪽에 선다(가운데 석등 자리를 비켜).
	"saebyeok": {"name": "바람 무녀 새벽", "era": "과거", "region": "sunken", "cell": Vector2(6.3438, 7.0771), "rarity": 4, "cloth": Color(0.9, 0.9, 0.96),
		"idle": "방울이 울면 바람이 길을 안다오.",
		"appear": [{"ch": 23, "from": 2, "to": 999, "region": "sunken", "cell": Vector2(6.3438, 7.0771), "isle": "shrine"},
			{"ch": 24, "ch_to": 999, "from": 0, "to": 999, "region": "sunken", "cell": Vector2(6.3438, 7.0771), "isle": "shrine"}]},
	## 106장 51-3 25장 — 기상 비행선 마지막 조종사(현대). 먹구름에 휘말려 잔해 섬(world/sky_route.gd wreck)에 불시착했다. 비행 고글은 기관사 고글 틀.
	## 25장부터(뒤에도) 조종실 동쪽 앞에 선다.
	"haneul": {"name": "비행사 하늬", "era": "현대", "region": "sunken", "cell": Vector2(5.5105, 7.4417), "rarity": 4, "cloth": Color(0.85, 0.45, 0.18),
		"goggles": true, "idle": "기낭만 기우면 다시 뜰 수 있어요. …기울 수만 있으면요.",
		"appear": [{"ch": 24, "from": 0, "to": 999, "region": "sunken", "cell": Vector2(5.5105, 7.4417), "isle": "wreck"},
			## 51-4 26장 — 잔해 기둥으로 함께 올라(1~, 26장 뒤에도) 정거장 조각 동쪽.
			{"ch": 25, "from": 1, "to": 999, "region": "sunken", "cell": Vector2(4.7813, 7.1084), "isle": "orbit"},
			{"ch": 26, "ch_to": 999, "from": 0, "to": 999, "region": "sunken", "cell": Vector2(4.7813, 7.1084), "isle": "orbit"},
			{"ch": 25, "ch_to": 999, "from": 0, "to": 999, "region": "sunken", "cell": Vector2(5.5105, 7.4417), "isle": "wreck"}]},
	## 106장 51-4 26장 — 먹구름을 부리는 가면 그림자(정체는 8부까지). 23장 반디 기록 속 그 그림자. 26장 장치 셋을 끈 뒤(6) 한 번만 정거장 서쪽에 선다.
	"gamyeon": {"name": "가면 그림자", "region": "sunken", "cell": Vector2(4.4063, 7.0876), "rarity": 5, "cloth": Color(0.08, 0.07, 0.11),
		"idle": "……", "mask": true, "mask_color": Color(0.55, 0.35, 0.85), "mask_face": Color(0.06, 0.05, 0.09),
		"appear": [{"ch": 25, "from": 6, "to": 6, "region": "sunken", "cell": Vector2(4.4063, 7.0876), "isle": "orbit"},
			## 106장 52-3 28장 — 여섯째 매듭을 묶은 뒤(8) 구름섬 북동쪽에 한 번(정체를 밝히고 먹구름 눈으로 올라간다).
			{"ch": 27, "from": 8, "to": 8, "region": "village", "cell": Vector2(7.25, 0.85), "sky": true},
			## 106장 52-4 29장 — 먹구름 눈에 올라서면(3) 눈 서쪽 9m 에 한 번(그 뒤 참몸이 되어 이야기 보스로).
			{"ch": 28, "from": 3, "to": 3, "region": "village", "cell": Vector2(6.1521, 1.0), "eye": true}]},
	## 106장 53-2 30장 — 굳은 거리(world/region8_amber.gd) 시계방의 수리공(현대). 거리가 굳던 날 손목시계 속 틈 조각 태엽 덕에 혼자 안 굳었다.
	## 9부(30장~)부터 늘 시계방 서쪽 앞(괘종시계 곁)에 선다.
	"chorong": {"name": "시계 수리공 초롱", "era": "현대", "region": "amber", "cell": Vector2(6.25, 5.3), "rarity": 4, "cloth": Color(0.36, 0.5, 0.44),
		"idle": "다른 시계는 다 멈췄는데 내 손목시계만 째깍거려요.",
		"appear": [{"ch": 29, "ch_to": 999, "from": 0, "to": 999}]},
	## 106장 53-3 31장 — 호박 속 장터(world/region8_amber.gd MARKET_CELL) 결정 안에 좌판째 굳어 있던 장돌뱅이(과거). 파발꾼과 같은 벙거지.
	## 장터 석등을 다 켜 결정 돔이 깨진 뒤(31장 2~, 뒤에도) 장터 가운데 — 굳어 있던 그 자리에 선다.
	"neoul": {"name": "장돌뱅이 너울", "era": "과거", "region": "amber", "cell": Vector2(1.5, 3.5), "rarity": 4, "cloth": Color(0.6, 0.48, 0.3),
		"hat": true, "idle": "저울추는 셈이 정확해야 하는 법이지. 쇠 수레 구경도 한두 번이지, 허허.",
		"appear": [{"ch": 30, "from": 2, "to": 999}, {"ch": 31, "ch_to": 999, "from": 0, "to": 999}]},
	## 106장 53-4 32장 — 짓다 만 부양탑(world/region8_amber.gd TOWER_CELL)의 설계사(미래). 높은 데를 무서워해 탑 발치 남쪽에서 도면만 본다.
	## 31장 끝(6 — 초롱이 "탑 발치에서 혼잣말"이라 한 때)부터(뒤에도) 선다.
	"saegil": {"name": "탑 설계사 새길", "era": "미래", "region": "amber", "cell": Vector2(4.0, 1.62), "rarity": 4, "cloth": Color(0.82, 0.86, 0.9),
		"visor": true, "idle": "층판 공식은 맞는데… 시간이 안 흐르면 공식도 멈추나 봐요.",
		"appear": [{"ch": 30, "from": 6, "to": 999}, {"ch": 31, "ch_to": 999, "from": 0, "to": 999}]},
	## 106장 54-2 33장 — 갈무리 벌(world/region9_vault.gd) 물류 야적장의 마지막 창고지기(현대). 드론이 조각을 나르는 걸 날마다 지켜봤다.
	## 10부(33장~) 고개 울타리가 꺼진 뒤부터 늘 창고(WAREHOUSE_CELL) 셔터 앞에 선다.
	"maru": {"name": "창고지기 마루", "era": "현대", "region": "vault", "cell": Vector2(6.2, 5.2), "rarity": 4, "cloth": Color(0.5, 0.46, 0.3),
		"idle": "드론이 또 한 대 지나가네. 오늘만 백스무 번째…",
		"appear": [{"ch": 32, "ch_to": 999, "from": 0, "to": 999}]},
	## 106장 54-3 34장 — 곳간째 갈무리 벌로 들려 온 옛 곳간 마을 아이(과거). 씨앗 곡식을 지키느라 곳간 안에 숨어 있었다.
	## 곳간 석등을 다 켜 문이 열린 뒤(34장 2~, 뒤에도) 곳간 문 앞 서쪽 — 동력 기둥·금고 문 앞 자리는 STATIONS.
	"sodam": {"name": "곳간지기 소담", "era": "과거", "region": "vault", "cell": Vector2(1.15, 5.5), "rarity": 4, "cloth": Color(0.72, 0.5, 0.42),
		"idle": "씨앗 한 톨이 한 해 농사예요. 한 톨도 못 줘요.",
		"appear": [{"ch": 33, "from": 2, "to": 999}, {"ch": 34, "ch_to": 999, "from": 0, "to": 999}]},
	## 106장 54-4 35장 — 시간 씨앗 금고를 세운 보관사(미래). 제가 만든 인공지능 갈무리에게 진열장째 갈무리됐다.
	## 금고 안에 들어선 뒤(35장 1~, 뒤에도) 해미 진열장(region9_vault.gd HAEMI_CASE_DEG — case_pos(160)) 자리 — 대결 전엔 유리 속, 뒤엔 깨진 받침 위.
	"haemi": {"name": "씨앗 보관사 해미", "era": "미래", "region": "vault", "cell": Vector2(3.9537, 1.3727), "rarity": 4, "cloth": Color(0.84, 0.9, 0.82),
		"visor": true, "idle": "씨앗도 순간도, 갈무리는 다시 꺼내 심으려고 하는 거예요.",
		"appear": [{"ch": 34, "from": 1, "to": 999}, {"ch": 35, "ch_to": 999, "from": 0, "to": 999}]},
	## 35장 — 금고 관리 인공지능(미래, 몸은 조종 기계 틀). 기록 기둥 꼭대기에 올라선 뒤(4) 핵 곁에 한 번 — 핵을 버리고 금고 가장 깊은 곳으로 달아난다.
	"garmuri": {"name": "금고 관리 인공지능 갈무리", "era": "미래", "body": "drone", "region": "vault", "cell": Vector2(4.0208, 1.5), "rarity": 5,
		"cloth": Color(0.8, 0.95, 1.0), "idle": "아름다운 때를 영원히.",
		"appear": [{"ch": 34, "from": 4, "to": 4, "lift": 11.0},
			## 106장 55-4 38장 — 처음의 별까마귀를 쓰러뜨린 뒤(2) 세갈래 길목 위에 한 번(그 뒤 참몸이 되어 이야기 보스로).
			{"ch": 37, "from": 2, "to": 2, "region": "fork", "cell": Vector2(4.05, 3.55), "lift": 3.0}]},
	## 106장 55-2 36장 — 세갈래 고을(world/region10_fork.gd)의 대장장이(과거). 그날 막 벼린 칼날이 틈 조각 쇠라 멈춘 순간 속에서 혼자 움직인다.
	## 11부(36장~)부터 성문 안쪽에 서 있다가, 대장간으로 앞장선 뒤(36장 5~, 뒤에도)엔 대장간 화덕 앞(STATIONS).
	"byeori": {"name": "대장장이 벼리", "era": "과거", "region": "fork", "cell": Vector2(4.0, 5.95), "rarity": 4, "cloth": Color(0.42, 0.3, 0.22),
		"idle": "쇠는 식기 전에 두드려야 하는데… 불도, 쇠도, 하늘도 다 멈췄어.",
		"appear": [{"ch": 35, "ch_to": 999, "from": 0, "to": 999}]},
	## 106장 55-3 37장 — 세갈래 고을 동쪽 선로 공사장의 측량 기사(현대). 하늘이 찢어질 때 공사장째 이 고을로 떨어져 굳어 있다가,
	## 역참길 격자 말뚝이 꺼진 뒤(37장 2~, 뒤에도) 풀려나 공사장 북동쪽에 선다 — 기관차를 되살리러 간 뒤 자리는 STATIONS.
	"narae": {"name": "측량 기사 나래", "era": "현대", "region": "fork", "cell": Vector2(6.8, 4.6), "rarity": 4, "cloth": Color(0.92, 0.55, 0.15),
		"idle": "측량값이 전부 0 이에요. 거리도, 시간도.",
		"appear": [{"ch": 36, "from": 2, "to": 999}, {"ch": 37, "ch_to": 999, "from": 0, "to": 999}]},
	"bawoo": {"name": "산성지기 바우", "era": "과거", "region": "frost", "cell": Vector2(3.0, 4.11), "rarity": 4, "cloth": Color(0.48, 0.2, 0.16),
		"helmet": true, "idle": "……불씨가 식지 않게. 그것만이 내 일이다.",
		"appear": [
			## G-0077 14부(회차 2) — 45장 문루(3~4)·호숫가(5) · 46장 호숫가(0~1)·문루(2~3) · 47장 문루(4). 47장 뒤엔 다시 안 선다(돌담을 떠남).
			{"ch": 44, "from": 3, "to": 4}, {"ch": 44, "from": 5, "to": 5, "region": "frost", "cell": Vector2(3.25, 2.36)},
			{"ch": 45, "from": 0, "to": 1, "region": "frost", "cell": Vector2(3.25, 2.36)}, {"ch": 45, "from": 2, "to": 3}, {"ch": 46, "from": 4, "to": 4},
			{"ch": 10, "from": 2, "to": 2},
			{"ch": 10, "from": 3, "to": 5, "region": "frost", "cell": Vector2(3.25, 2.36)},
			{"ch": 10, "from": 6, "to": 7}]},
}

## 학자는 5장 동안 서쪽 고개 옛길에 가 있다(0~3 단계 옛길 어귀, 4~7 단계 둘째 제단 곁).
const STATIONS := {
	"scholar": [{"ch": 4, "from": 0, "to": 3, "region": "village", "cell": Vector2(1.1, 2.55)},
		{"ch": 4, "from": 4, "to": 7, "region": "village", "cell": Vector2(1.5, 1.62)},
		{"ch": 5, "from": 5, "to": 6, "region": "village", "cell": Vector2(6.85, 1.62)}],
	## 사공은 8장 섬에 건너간 동안(5~10 단계) 섬 남쪽 물가 배 댄 자리에.
	"ferryman": [{"ch": 7, "from": 5, "to": 10, "region": "coast", "cell": Vector2(6.03, 2.3)},
		## 52-3 28장 — 바위섬에 건너간 뒤(4~9) 8장과 같은 배 댄 자리.
		{"ch": 27, "from": 4, "to": 9, "region": "coast", "cell": Vector2(6.03, 2.3)},
		## G-0074 13부 44장 — 바위섬에 건너간 동안(2~4) 같은 배 댄 자리.
		{"ch": 43, "from": 2, "to": 4, "region": "coast", "cell": Vector2(6.03, 2.3)}],
	## 106장 53-3 31장 — 초롱은 가게 문을 닫고 따라와 석등·너울·도둑 동안(1~4) 장터 동쪽 앞(석등 고리 SEAL_RING 밖), 되감기(5~)는 시계방 앞 제자리.
	## 106장 54-3 34장 — 마루는 지게차를 몰고 곳간 마을로(1~) 곳간 동남쪽(석등 고리 SEAL_RING 밖).
	"maru": [{"ch": 33, "from": 1, "to": 999, "region": "vault", "cell": Vector2(1.62, 5.62)}],
	## 34장 — 곳간을 지킨 뒤 동력 기둥으로 앞장서(4~) 금고 문 앞 두 기둥 사이, 뒤에도(35장 "금고 문 앞 소담").
	"sodam": [{"ch": 33, "from": 4, "to": 999, "region": "vault", "cell": Vector2(4.0, 2.3)},
		{"ch": 34, "from": 0, "to": 0, "region": "vault", "cell": Vector2(4.0, 2.3)},
		## 54-4 35장 — 금고 안에 들어선 뒤(1~, 뒤에도) 문 안쪽(금고 가운데에서 남쪽 8m).
		{"ch": 34, "ch_to": 999, "from": 0, "to": 999, "region": "vault", "cell": Vector2(4.0, 1.6667)}],
	## 106장 55-2 36장 — 벼리는 대장간으로 앞장선 뒤(5~, 36장 뒤에도) 화덕 앞(follow 길 끝과 같은 자리).
	"byeori": [{"ch": 35, "from": 5, "to": 999, "region": "fork", "cell": Vector2(2.45, 5.45)},
		{"ch": 36, "from": 0, "to": 0, "region": "fork", "cell": Vector2(2.45, 5.45)},
		## 55-3 37장 — 말뚝을 끄러 나선 뒤(1~, 뒤에도) 세갈래 길목 동남쪽(머리 위 별까마귀를 지켜본다).
		{"ch": 36, "ch_to": 999, "from": 0, "to": 999, "region": "fork", "cell": Vector2(4.35, 3.8)}],
	## 106장 55-4 38장 — 해미는 순간이 풀린 뒤(4~, 뒤에도) 진열장 밖에서 걸어 들어와 세갈래 길목 서쪽에(고을 마당에 씨앗을 심는다).
	"haemi": [{"ch": 37, "from": 4, "to": 999, "region": "fork", "cell": Vector2(3.7, 3.75)},
		{"ch": 38, "ch_to": 999, "from": 0, "to": 999, "region": "fork", "cell": Vector2(3.7, 3.75)}],
	## 55-3 37장 — 나래는 기관 불을 되살리러 간 뒤(3~, 뒤에도) 멈춘 기관차 서쪽 끝(지키기 자리 곁).
	"narae": [{"ch": 36, "from": 3, "to": 999, "region": "fork", "cell": Vector2(6.0, 3.1)},
		{"ch": 37, "ch_to": 999, "from": 0, "to": 999, "region": "fork", "cell": Vector2(6.0, 3.1)}],
	"chorong": [{"ch": 30, "from": 1, "to": 4, "region": "amber", "cell": Vector2(1.9, 3.8)},
		## 53-4 32장 — 거북을 쓰러뜨린 뒤(5) 탑 밑 광장으로 달려와 있다.
		{"ch": 31, "from": 5, "to": 5, "region": "amber", "cell": Vector2(4.55, 1.75)}],
	## 106장 ㊺ 10장 — 하람은 따라가기(5) 뒤 비행선 곁(6), 산성 둘러보기(7~8) 동안 산성 터 문루 안쪽.
	## 12장 — 불씨를 비행선에 붙이는 동안(6~8) 비행선 곁.
	"haram": [{"ch": 9, "from": 6, "to": 6, "region": "frost", "cell": Vector2(5.85, 4.85)},
		{"ch": 11, "from": 6, "to": 8, "region": "frost", "cell": Vector2(5.85, 4.85)},
		{"ch": 9, "from": 7, "to": 8, "region": "frost", "cell": Vector2(3.25, 4.5)},
		## 11장 — 불씨를 들고 비행선으로 가는 마지막 단계(8)에 먼저 가 있다.
		{"ch": 10, "from": 8, "to": 8, "region": "frost", "cell": Vector2(5.85, 4.85)}],
	## 106장 ㊺-4 12장 — 반디는 구미호를 물리친 뒤(5) 얼음굴 앞에 날아와 있다.
	"bandi": [
		## G-0074 13부 — 42장 첫 대화는 은하 나루 별배 곁(0), 44장 섬 꼭대기 해솔 자리(3).
		{"ch": 41, "from": 0, "to": 0, "region": "skyport", "cell": Vector2(5.44, 1.8)},
		{"ch": 43, "from": 3, "to": 3, "region": "coast", "cell": Vector2(6.12, 2.05)},
		## G-0077 14부 — 45장 첫 대화는 은하 나루 별배 곁(0), 47장 첫 대화는 고원 옛 비행선 자리(0).
		{"ch": 44, "from": 0, "to": 0, "region": "skyport", "cell": Vector2(5.44, 1.8)},
		{"ch": 46, "from": 0, "to": 0, "region": "frost", "cell": Vector2(6.0, 4.8)},
		## G-0078 15부 — 48장 첫 대화는 은하 나루 별배 곁(0), 50장 끝 대화는 조선소(4, 13장 조선소 자리).
		{"ch": 47, "from": 0, "to": 0, "region": "skyport", "cell": Vector2(5.44, 1.8)},
		{"ch": 49, "from": 4, "to": 4, "region": "coast", "cell": Vector2(7.05, 4.02)},
		## G-0079 16부 — 51장 첫 대화는 은하 나루 별배 곁(0).
		{"ch": 50, "from": 0, "to": 0, "region": "skyport", "cell": Vector2(5.44, 1.8)},
		{"ch": 11, "from": 5, "to": 5, "region": "frost", "cell": Vector2(6.15, 2.5)},
		## ㊼-1 13장 — 날개 조각을 꺼낸 뒤(6~8) 조선소로 날아와 있다.
		{"ch": 12, "from": 6, "to": 8, "region": "coast", "cell": Vector2(7.05, 4.02)},
		## ㊼-2 14장 — 관측대 위 파수를 물리친 뒤(9) 떠 있는 관측대 위로 날아와 있다(lift = era_sites.gd OBS_RISE).
		{"ch": 13, "from": 9, "to": 9, "region": "ruins", "cell": Vector2(1.26, 2.24), "lift": 24.0},
		## ㊽-2 16장 — 별배를 몰고 은하 나루에 매단 뒤(6~8) 착륙판 남쪽에 떠 있다.
		{"ch": 15, "from": 6, "to": 8, "region": "skyport", "cell": Vector2(5.44, 1.8)},
		## ㊽-3 17장 — 처음엔 나루에(0~6), 별배를 몰고 쓰러진 종 곁으로(7), 종을 건 뒤엔 종각 곁에(8~9).
		{"ch": 16, "from": 0, "to": 6, "region": "skyport", "cell": Vector2(5.44, 1.8)},
		{"ch": 16, "from": 7, "to": 7, "region": "skyport", "cell": Vector2(1.72, 5.2)},
		{"ch": 16, "from": 8, "to": 9, "region": "skyport", "cell": Vector2(2.64, 3.66)},
		## ㊽-4 18장 — 처음엔 종각 곁에(0), 기적 소리를 따라 은하역 곁으로(1~9).
		{"ch": 17, "from": 0, "to": 0, "region": "skyport", "cell": Vector2(2.64, 3.66)},
		{"ch": 17, "from": 1, "to": 9, "region": "skyport", "cell": Vector2(5.25, 5.35)},
		## ㊾-2 19장 — 은하역(0~1) → 막차로 첫 정거장(2~4) → 시계탑 발치(5) → 떠 있는 섬돌 곁(6~9).
		{"ch": 18, "from": 0, "to": 1, "region": "skyport", "cell": Vector2(5.25, 5.35)},
		{"ch": 18, "from": 2, "to": 4, "region": "crossing", "cell": Vector2(4.75, 2.4)},
		{"ch": 18, "from": 5, "to": 5, "region": "crossing", "cell": Vector2(6.2, 6.35)},
		{"ch": 18, "from": 6, "to": 9, "region": "crossing", "cell": Vector2(3.05, 6.45)},
		## ㊾-3 20장 — 먼저 날아 올라가 갈림길 끝 섬 위에(2~10, 쇠 선로 곁).
		{"ch": 19, "from": 2, "to": 10, "region": "crossing", "cell": Vector2(6.206, 2.438), "rift_end": true},
		## ㊿-2 21장 — 별배를 타고 잠긴 도읍 모래밭에(2~6) → 잠수정으로 궁궐 기단 위에(7~, 21장 뒤에도).
		{"ch": 20, "from": 2, "to": 6, "region": "sunken", "cell": Vector2(3.1, 1.55)},
		{"ch": 20, "from": 7, "to": 999, "region": "sunken", "cell": Vector2(2.15, 4.87), "lift": 3.25},
		## ㊿-3 22장 — 기단(0~2) → 돔 문 앞 받침 위(3~6, lift 3.5 = 받침 윗면) → 문이 열린 뒤 돔 안 마른 바닥(7~, 22장 뒤에도).
		{"ch": 21, "from": 0, "to": 2, "region": "sunken", "cell": Vector2(2.15, 4.87), "lift": 3.25},
		{"ch": 21, "from": 3, "to": 6, "region": "sunken", "cell": Vector2(5.083, 5.354), "lift": 3.5},
		{"ch": 21, "from": 7, "to": 999, "region": "sunken", "cell": Vector2(5.208, 5.958)},
		## ㊿-4 23장 — 등대에 불을 켠 뒤(3) 옛 등대 난간 판 위로 날아와 있다(lift = region7_sunken.gd LIGHT_H + 0.3, 등롱 서북서 2m — 판 반지름 2.3 안).
		{"ch": 22, "from": 3, "to": 3, "region": "sunken", "cell": Vector2(6.9625, 6.9833), "lift": 15.3},
		## 51-2 24장 — 선장 곁 모래밭(0~1) → 별배로 하늘 사당 섬에(2~, 24장 뒤에도).
		{"ch": 23, "from": 0, "to": 1, "region": "sunken", "cell": Vector2(3.1, 1.55)},
		{"ch": 23, "from": 2, "to": 999, "region": "sunken", "cell": Vector2(6.323, 7.4417), "isle": "shrine"},
		## 51-3 25장 — 잔해 섬으로 먼저 날아가(1~, 25장 뒤에도) 조종실 동쪽 꼬리 날개 앞.
		{"ch": 24, "from": 1, "to": 999, "region": "sunken", "cell": Vector2(5.573, 7.3584), "isle": "wreck"},
		## 51-4 26장 — 정거장 조각으로 먼저 날아가(1~, 26장 뒤에도) 동쪽 남동 장치 곁.
		{"ch": 25, "from": 1, "to": 999, "region": "sunken", "cell": Vector2(4.7813, 7.2126), "isle": "orbit"},
		## 53-2 9부 30장 — 선장 곁 착륙판(0) → 굳은 거리로 먼저 날아가 시계방 남서쪽(1~, 30장 뒤에도 — 굳은 신호를 잰다).
		{"ch": 29, "from": 0, "to": 0, "region": "skyport", "cell": Vector2(5.44, 1.8)},
		## 54-2 10부 33장 — 굳은 거리(0) → 고원 관측소 하람 곁(1) → 갈무리 벌 창고 앞 마루 곁(2~, 33장 뒤에도 — 드론 신호를 잰다).
		{"ch": 32, "from": 1, "to": 1, "region": "frost", "cell": Vector2(3.65, 1.75)},
		{"ch": 32, "from": 2, "to": 999, "region": "vault", "cell": Vector2(6.0, 5.3)},
		{"ch": 33, "ch_to": 999, "from": 0, "to": 999, "region": "vault", "cell": Vector2(6.0, 5.3)},
		{"ch": 29, "ch_to": 999, "from": 0, "to": 999, "region": "amber", "cell": Vector2(6.1, 5.6)},
		## 52 8부(27장~) — 청하 마을로 돌아와 촌장 동쪽에(매듭 신호를 잰다).
		{"ch": 26, "ch_to": 999, "from": 0, "to": 999, "region": "village", "cell": Vector2(5.97, 3.22)},
		{"ch": 25, "ch_to": 999, "from": 0, "to": 999, "region": "sunken", "cell": Vector2(5.573, 7.3584), "isle": "wreck"},
		{"ch": 24, "ch_to": 999, "from": 0, "to": 999, "region": "sunken", "cell": Vector2(6.323, 7.4417), "isle": "shrine"},
		{"ch": 22, "ch_to": 999, "from": 0, "to": 999, "region": "sunken", "cell": Vector2(5.208, 5.958)},
		## 19장 뒤 — 별배가 매인 은하 나루 착륙판 곁(고원 별배 빈자리에 서지 않게).
		{"ch": 19, "ch_to": 999, "from": 0, "to": 999, "region": "skyport", "cell": Vector2(5.44, 1.8)}],
	## ㊿-2 21장 — 여울은 잔교를 걸어오는 동안(4~6) 잠수정 선착장 판 위, 잠수정으로 내려간 뒤(7~) 궁궐 기단 위.
	"yeoul": [{"ch": 20, "from": 4, "to": 6, "region": "sunken", "cell": Vector2(6.08, 4.26), "lift": 3.5},
		{"ch": 20, "from": 7, "to": 999, "region": "sunken", "cell": Vector2(2.45, 4.87), "lift": 3.25},
		{"ch": 21, "from": 0, "to": 2, "region": "sunken", "cell": Vector2(2.45, 4.87), "lift": 3.25},
		## ㊿-3 22장 — 돔 문 앞 받침 위(3~6) → 돔 안 마른 바닥(7~, 22장 뒤에도).
		{"ch": 21, "from": 3, "to": 6, "region": "sunken", "cell": Vector2(5.167, 5.396), "lift": 3.5},
		{"ch": 21, "from": 7, "to": 999, "region": "sunken", "cell": Vector2(5.25, 6.042)},
		{"ch": 22, "ch_to": 999, "from": 0, "to": 999, "region": "sunken", "cell": Vector2(5.25, 6.042)}],
	## ㊽-4 18장 — 선장의 잔상을 따라잡은 뒤(7) 선로 남쪽 끝에 와 있다.
	"dodam": [{"ch": 17, "from": 7, "to": 7, "region": "skyport", "cell": Vector2(5.2, 6.85)},
		## ㊾-2 19장 — 막차를 몰고 첫 정거장에 닿은 뒤(2~9) 선로 서쪽에.
		{"ch": 18, "from": 2, "to": 9, "region": "crossing", "cell": Vector2(4.85, 1.9)},
		## ㊾-3 20장 — 첫 정거장에서 막차를 대기(0~1) → 갈림길 끝 섬 위 막차 곁(2~10).
		{"ch": 19, "from": 0, "to": 1, "region": "crossing", "cell": Vector2(4.85, 1.9)},
		{"ch": 19, "from": 2, "to": 10, "region": "crossing", "cell": Vector2(6.092, 2.6), "rift_end": true}],
	## ㊽-3 17장 — 비탈의 짐승을 물리친 뒤(4~7) 쓰러진 종 곁에 와 있다.
	"hangyeol": [{"ch": 16, "from": 4, "to": 7, "region": "skyport", "cell": Vector2(1.55, 4.88)}],
	## ㊼-3 15장 — 조각 셋을 들고 별배로 가는 동안(8~10) 달음이 먼저 별배 곁에 와 있다.
	"dareum": [{"ch": 14, "from": 8, "to": 10, "region": "frost", "cell": Vector2(5.62, 4.95)}],
}

const CLIMB_SLACK := 2.5

## chase(106장 ㊲) — 걷기 6·달리기 10 m/초 사이
const CHASE_START := 14.0
const CHASE_CATCH := 2.5
const CHASE_SPEED := 7.0
const CHASE_PAUSE := 0.7

## defend(106장 ㉞)
const DEFEND_START := 25.0
const DEFEND_RING := 15.0
const DEFEND_WAVE_SEC := 28.0

## seal 석등 표지 — 글자·빛깔. 석등은 제단 둘레 SEAL_RING m 에, 놓인 자리 차례는 order 와 다르다(SEAL_LAYOUT).
const SEAL_MARKS := {
	"sun": {"name": "해", "color": Color(1.0, 0.62, 0.25)},
	"moon": {"name": "달", "color": Color(0.7, 0.8, 1.0)},
	"star": {"name": "별", "color": Color(0.95, 0.9, 0.55)},
}
const SEAL_RING := 6.0
const SEAL_LAYOUT := ["moon", "star", "sun"] # 둘레에 놓는 차례(북쪽부터 시계 방향)

## 106장 ㉛ 이야기로 만나는 동료 — 도감(saga_core characters) 밖 id. 이름·희귀도·원소·무기를 여기서 정하고(해시 아님),
## era = 그 인물이 온 시대(시나리오 인물 표 — 29장 편성 시험 party 단계가 본다).
## 고유 스킬은 data/kits.gd KITS. npc 는 세상에 서 있는 이야기 인물(동료가 돼도 임무 인물로 계속 선다).
const MEMBERS := {
	"story_scholar": {"era": "현대", "name": "학자 은비", "rarity": 4, "element": "grass", "weapon": "catalyst", "npc": "scholar"},
	"story_wanderer": {"era": "과거", "name": "가면 쓴 나그네", "rarity": 5, "element": "ice", "weapon": "sword", "npc": "wanderer"},
	## 106장 ㉟ 둘 더 — 촌장 누리 6장(치유)·늙은 사공 버들 7장(협동 공격) 보상.
	"story_elder": {"era": "과거", "name": "촌장 누리", "rarity": 4, "element": "wind", "weapon": "catalyst", "npc": "elder"},
	"story_ferryman": {"era": "과거", "name": "사공 버들", "rarity": 4, "element": "water", "weapon": "polearm", "npc": "ferryman"},
	## 106장 ㊳ 9장 보상 — 가면을 벗은 해솔(먹구름 벼락·뇌 부여).
	"story_haesol": {"era": "현대", "name": "해솔", "rarity": 5, "element": "thunder", "weapon": "claymore", "npc": "haesol_free"},
	## 106장 ㊺-4 12장 보상 — 관측원 하람(현대, 화·활 — 신호탄). 명단에 없던 원소·무기.
	"story_haram": {"era": "현대", "name": "관측원 하람", "rarity": 4, "element": "fire", "weapon": "bow", "npc": "haram"},
	## 106장 ㊼-3 15장 보상 — 파발꾼 달음(과거, 암·장병기). 이야기 동료에 없던 원소(암).
	"story_dareum": {"era": "과거", "name": "파발꾼 달음", "rarity": 4, "element": "rock", "weapon": "polearm", "npc": "dareum"},
	## 106장 ㊽-4 18장 보상 — 기관사 도담(현대, 뇌·양손검 — 대형 렌치). 선로 전류·막차 출발 신호.
	"story_dodam": {"era": "현대", "name": "기관사 도담", "rarity": 4, "element": "thunder", "weapon": "claymore", "npc": "dodam"},
	## 106장 ㊾-3 20장 보상 — 별배 선장 한별(미래, 풍·활 — 별배 신호총). 이야기 동료 첫 ★5 원거리.
	"story_hanbyeol": {"era": "미래", "name": "별배 선장 한별", "rarity": 5, "element": "wind", "weapon": "bow", "npc": "hanbyeol"},
	## 106장 ㊿-4 23장 보상 — 해녀 물새(과거, 수·한손검 — 빗창). 시나리오의 수·장병기는 사공 버들(★4 수·장병기)과 똑같이 겹쳐 한손검으로.
	"story_mulsae": {"era": "과거", "name": "해녀 물새", "rarity": 4, "element": "water", "weapon": "sword", "npc": "mulsae"},
	## 106장 51-4 26장 보상 — 비행사 하늬(현대, 빙·장병기 — 비행선 닻 갈고리). 이야기 동료에 없던 짝.
	"story_haneul": {"era": "현대", "name": "비행사 하늬", "rarity": 4, "element": "ice", "weapon": "polearm", "npc": "haneul"},
	## 106장 53-4 32장 보상 — 시계 수리공 초롱(현대, 암·법구 — 태엽 손목시계). 이야기 동료에 없던 짝.
	"story_chorong": {"era": "현대", "name": "시계 수리공 초롱", "rarity": 4, "element": "rock", "weapon": "catalyst", "npc": "chorong"},
	## 106장 54-4 35장 보상 — 씨앗 보관사 해미(미래, 초·한손검 — 씨앗 칼). 이야기 동료에 없던 짝, 두 번째 미래 동료.
	"story_haemi": {"era": "미래", "name": "씨앗 보관사 해미", "rarity": 4, "element": "grass", "weapon": "sword", "npc": "haemi"},
	## 106장 55-4 38장 보상 — 대장장이 벼리(과거, 화·양손검 — 틈 쇠 큰 칼). 이야기 동료에 없던 짝, 첫 불 근접.
	"story_byeori": {"era": "과거", "name": "대장장이 벼리", "rarity": 4, "element": "fire", "weapon": "claymore", "npc": "byeori"},
	## 106장 56-1 40장 보상 — 측량 기사 나래(현대, 수·법구 — 측량 나침). 이야기 동료에 없던 현대 수.
	"story_narae": {"era": "현대", "name": "측량 기사 나래", "rarity": 4, "element": "water", "weapon": "catalyst", "npc": "narae"},
	## 106장 56-1 41장 보상 — 곳간지기 소담(과거, 풍·법구 — 곳간 노래). 이야기 동료에 없던 과거 풍.
	"story_sodam": {"era": "과거", "name": "곳간지기 소담", "rarity": 4, "element": "wind", "weapon": "catalyst", "npc": "sodam"},
}

## 이야기 동료 한 명(도감 인물처럼 name·rarity 를 읽는다) — 아니면 null.
static func member(id: String) -> Variant:
	return MEMBERS.get(id)

const FOLLOW_NEAR := 12.0 # 이 안이면 따라가는 인물이 걷는다
const FOLLOW_SPEED := 2.6 # m/초
const FOLLOW_LOST := 30.0 # 이보다 멀면 추적 글자에 "놓치겠다"

## 장 표는 story_chapters_1~4.gd 에 나눠 있다(파일 줄 수 상한 1,500줄 — R-4). 이어 붙인 값이 예전 CHAPTERS 와 같다(tools/probe_story_data.gd 가 지킨다).
const _Chapters1 := preload("res://games/saga_go/data/story_chapters_1.gd")
const _Chapters2 := preload("res://games/saga_go/data/story_chapters_2.gd")
const _Chapters3 := preload("res://games/saga_go/data/story_chapters_3.gd")
const _Chapters4 := preload("res://games/saga_go/data/story_chapters_4.gd")
const _Chapters5 := preload("res://games/saga_go/data/story_chapters_5.gd") # G-0074 13부(회차 전용)
const CHAPTERS := _Chapters1.CHAPTERS + _Chapters2.CHAPTERS + _Chapters3.CHAPTERS + _Chapters4.CHAPTERS + _Chapters5.CHAPTERS
## 본편 장 수(1~41장, 3차 결말까지) — 별배 재출항(data/cycle.gd)은 이것만 끝내면 된다. 그 뒤 장은 장 칸 cycle 로 잠긴다.
const MAIN_CHAPTERS := 41

static func chapter(i: int) -> Dictionary:
	return CHAPTERS[i] if i >= 0 and i < CHAPTERS.size() else {}

static func step_of(ch: int, st: int) -> Dictionary:
	var c := chapter(ch)
	if c.is_empty():
		return {}
	var steps: Array = c.steps
	return steps[st] if st >= 0 and st < steps.size() else {}

static func all_done(ch: int) -> bool:
	return ch >= CHAPTERS.size()

## 본편(MAIN_CHAPTERS 장)을 끝냈나 — 회차 조건.
static func main_done(ch: int) -> bool:
	return ch >= MAIN_CHAPTERS

## 잠긴 장의 열림 글 — 회차가 모자라면 회차, 아니면 모험 등급. cycle = 지금 회차(PartyState.cycle — 이 표 파일은 자동 로드를 모른다).
static func lock_text(c: Dictionary, cycle: int) -> String:
	if cycle < int(c.get("cycle", 0)):
		return "별배 재출항(%d회차) 뒤에 열린다" % int(c.cycle)
	return "모험 등급 %d 에 열린다" % int(c.get("ar", 0))

## appear·stations 값 → 칸 목록(한 칸짜리 사전도 받는다).
static func windows(v: Variant) -> Array:
	if v is Array:
		return v
	return [v] if v is Dictionary and not (v as Dictionary).is_empty() else []
