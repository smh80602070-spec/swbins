extends RefCounted

## PLAN 106장 ㊴ — 원신식 세계 임무(곁가지 임무). 표만 — 진행은 world/story_quest.gd(이야기 임무와 같은 단계 엔진),
## 상태는 PartyState.world_quests {"steps": {id: 단계}, "done": [id…], "track": id}.
##   맡는 법: 맡길 사람(giver) 머리 위 푸른 "!" — 3m 안 F 로 말을 걸면 그 임무가 시작되고 "따라가는 임무"가 된다.
##   따라가는 임무 하나만 목표·추적 글자·임무 적이 선다(이야기 임무는 그동안 쉰다 — 끝나거나 O 목록에서 바꾸면 돌아간다).
##   따라가지 않는 임무도 다음 단계가 누군가와의 대화면 그 사람에게 말을 걸어 이어 갈 수 있다(그 순간 따라가는 임무가 된다).
##   단계 type·인물 칸은 data/story.gd 와 같다. 인물 appear 칸은 {"wq": 임무 id, "from", "to", region?, cell?} — 그 임무 단계 동안만.
## 전체 퓨전(../SAGA-DESIGN.md §12·§13): 임무마다 과거·현대·미래 인물이 한 자리에 — 세 시대가 한 사건으로 엮인다.
## 이야기·이름은 이 판 것(오마주 문법만, 실존 인물 없음).

const STEP_EXP := 8.0

## 인물 — body = VRoid 말고 코드로 그린 몸("drone" 배달 기계). era 는 표시 글자에만(이름 옆 작은 글씨).
const NPCS := {
	"postmaster": {"name": "역참지기 묵호", "era": "과거", "region": "village", "cell": Vector2(4.9, 3.45), "rarity": 3, "cloth": Color(0.5, 0.36, 0.24),
		"idle": "파발 말은 늙었어도 편지는 늘 제때 가야지."},
	"rider": {"name": "배달꾼 다래", "era": "현대", "region": "village", "cell": Vector2(4.5, 4.55), "rarity": 3, "cloth": Color(0.85, 0.45, 0.15),
		"idle": "오늘도 마을 한 바퀴! 짐칸 자물쇠만 말썽이야.", "appear": [{"wq": "wq_letters", "from": 1, "to": 3}]},
	"dungsil": {"name": "배달 기계 둥실이", "era": "미래", "body": "drone", "region": "village", "cell": Vector2(4.62, 4.4), "rarity": 3,
		"cloth": Color(0.55, 0.85, 0.95), "idle": "삐빅 — 배달 경로 다시 짜는 중.", "appear": [{"wq": "wq_letters", "from": 3, "to": 3}]},
	"researcher": {"name": "바다 연구원 물결", "era": "현대", "region": "coast", "cell": Vector2(3.4, 6.2), "rarity": 3, "cloth": Color(0.25, 0.5, 0.6),
		"idle": "밤바다에 옛 등대 불빛 같은 게 깜박여. 기록해 둬야지."},
	"hanbit": {"name": "등대 지기 한빛", "era": "미래", "region": "coast", "cell": Vector2(7.2, 5.75), "rarity": 4, "cloth": Color(0.4, 0.95, 1.0),
		"idle": "신호 세기 백 분의 사. 불씨가 필요합니다.", "appear": [{"wq": "wq_lighthouse", "from": 2, "to": 4}]},
	"wq_byeori": {"name": "시간 탐사대원 별이", "era": "미래", "region": "ruins", "cell": Vector2(4.6, 3.6), "rarity": 4, "cloth": Color(0.85, 0.88, 0.95),
		"idle": "여기 연도 표시가 셋이나 겹쳐 보여. 시간 틈이 맞아."},
	"dolsoe": {"name": "옛 석공 돌쇠", "era": "과거", "region": "ruins", "cell": Vector2(1.6, 4.6), "rarity": 3, "cloth": Color(0.45, 0.43, 0.38),
		"idle": "돌은 거짓말을 안 하지. 사람이 할 뿐.", "appear": [{"wq": "wq_rift", "from": 2, "to": 6}]},
}

const ORDER := ["wq_letters", "wq_lighthouse", "wq_rift"]

const QUESTS := {
	## 마을 — 파발(과거)·오토바이 배달(현대)·배달 기계(미래)가 편지 세 통으로 엮인다.
	"wq_letters": {"name": "바람에 흩어진 편지", "region_name": "청하 마을", "ar": 3, "giver": "postmaster",
		"reward": {"mora": 12000, "book_m": 2, "fate_knot": 1}, "exp": 60.0,
		"steps": [
			{"type": "talk", "npc": "postmaster", "text": "역참지기 묵호의 부탁 듣기",
				"lines": [["묵호", "어이, 거기 젊은이! 돌개바람이 역참 편지 자루를 뒤집어 놨지 뭔가.", "surprised"],
					["묵호", "세 통이 날아갔어. 한 통은 배달꾼 다래가 주웠다더군. 그 애는 늘 마을 들판을 누비지."],
					["?", ["찾아 드릴게요.", "편지가 그렇게 중요해요?"]],
					["묵호", "먼 데서 온 편지는 사람을 살리기도 하지. 부탁하네."]]},
			{"type": "talk", "npc": "rider", "text": "배달꾼 다래에게 편지 묻기",
				"lines": [["다래", "아, 역참 편지? 한 통은 내 짐칸에 있어. 근데 둘째는…", "fun"],
					["다래", "배달 기계 둥실이가 물고 달아났어! 요즘 경로가 꼬였는지 아무거나 배달하려 들더라.", "surprised"],
					["?", ["잡아 올게요!", "기계가 편지를요?"]],
					["다래", "저기 날아간다! 걸어선 못 잡아 — 달려!"]]},
			{"type": "chase", "name": "배달 기계 둥실이", "body": "drone", "region": "village", "cloth": Color(0.55, 0.85, 0.95),
				"path": [Vector2(4.6, 4.35), Vector2(4.5, 3.9), Vector2(4.5, 3.5), Vector2(4.0, 3.5), Vector2(3.5, 3.5), Vector2(3.5, 4.0), Vector2(3.5, 4.5)],
				"caught": "둥실이를 붙잡았다 — 편지를 물고 있다",
				"text": "편지를 물고 달아나는 둥실이 따라잡기(달리기)"},
			{"type": "talk", "npc": "dungsil", "text": "붙잡힌 둥실이 달래기",
				"lines": [["둥실이", "삐빅 — 수신인 확인 불가. 편지 한 통 반환합니다.", "sorrow"],
					["둥실이", "셋째 편지 위치 기록: 북서쪽 숲 언덕. 돌개바람 괴물이 둥지로 가져감. 경고 — 위험.", "surprised"],
					["?", ["고마워, 둥실아.", "괴물이라고?"]],
					["다래", "둥실이 경로는 내가 고쳐 둘게. 셋째 편지는 부탁해!", "joy"]]},
			{"type": "kill", "region": "village", "cell": Vector2(3.55, 3.3), "kinds": ["wind_hawk", "wind_hawk", "wolf"],
				"text": "북서쪽 숲 언덕의 돌개바람 둥지에서 편지 되찾기"},
			{"type": "talk", "npc": "postmaster", "text": "묵호에게 편지 세 통 돌려주기",
				"lines": [["묵호", "세 통 다! 이 늙은이 체면이 섰네.", "joy"],
					["묵호", "허허, 봉투를 보게 — 하나는 옛 파발 도장, 하나는 요즘 우편 도장, 하나는 빛으로 찍힌 도장이야. 시절이 뒤섞였구먼.", "surprised"],
					["묵호", "어느 시절에서 왔든 편지는 편지지. 고맙네. 약소하지만 받게."]]},
		]},
	## 포구 — 봉수 불씨(과거)·바다 연구원(현대)·등대 지기 기계(미래).
	"wq_lighthouse": {"name": "세 시절의 등대", "region_name": "포구", "ar": 8, "giver": "researcher",
		"reward": {"mora": 15000, "book_m": 3, "fate_knot": 1}, "exp": 70.0,
		"steps": [
			{"type": "talk", "npc": "researcher", "text": "바다 연구원 물결의 이야기 듣기",
				"lines": [["물결", "밤마다 동쪽 모래톱 끝에서 빛 신호가 와. 옛 봉수 무늬인데… 파형은 아주 새것이야.", "surprised"],
					["물결", "거긴 옛 등대 터밖에 없거든. 같이 가서 봐 줄래?"],
					["?", ["가 볼게요.", "옛 봉수 무늬요?"]],
					["물결", "불 하나면 평안, 둘이면 적, 셋이면 싸움. 그런데 신호는 '불을 달라'야."]]},
			{"type": "go", "region": "coast", "cell": Vector2(7.35, 5.9), "radius": 10.0, "text": "동쪽 모래톱 끝 옛 등대 터로"},
			{"type": "talk", "npc": "hanbit", "text": "등대 터에 나타난 빛 사람과 이야기하기",
				"lines": [["한빛", "신원 확인. 등대 지기 한빛, 먼 뒷날의 이 등대를 지키는 기계입니다.", "fun"],
					["한빛", "시간 틈으로 신호만 겨우 닿고 있습니다. 옛 봉수 불씨가 켜지면 길이 이어집니다."],
					["?", ["불씨를 켤게요.", "먼 뒷날이라고요?"]],
					["한빛", "경고 — 불씨 둘레에 무리가 모여 있습니다. 불빛을 싫어하는 것들입니다.", "angry"]]},
			{"type": "kill", "region": "coast", "cell": Vector2(7.2, 6.1), "kinds": ["bandit", "water_turtle", "water_turtle"],
				"text": "등대 터를 차지한 무리 물리치기"},
			{"type": "light", "region": "coast", "cell": Vector2(7.35, 5.9), "text": "옛 봉수대에 원소 불 켜기"},
			{"type": "talk", "npc": "researcher", "text": "물결에게 알리기",
				"lines": [["물결", "봤어? 불이 켜지자마자 등대 터에 빛 기둥이 섰다가 사라졌어!", "joy"],
					["물결", "먼 뒷날의 등대 지기라니… 기록장이 모자라겠어. 이건 연구소에서 나온 사례금이야.", "fun"]]},
		]},
	## 폐허 — 옛 석공(과거)·떠돌이 학자(현대, 이야기 인물은 안 끌어들임)·시간 탐사대원(미래).
	"wq_rift": {"name": "폐허의 시간 틈", "region_name": "폐허", "ar": 12, "giver": "wq_byeori",
		"reward": {"mora": 18000, "book_m": 3, "talent_2": 2, "fate_knot": 1}, "exp": 80.0,
		"steps": [
			{"type": "talk", "npc": "wq_byeori", "text": "시간 탐사대원 별이 돕기",
				"lines": [["별이", "안녕! 난 먼 뒷날에서 온 탐사대원이야. 시간 틈을 재다가… 여기로 떨어졌어.", "sorrow"],
					["별이", "돌아가려면 틈을 한 번 더 열어야 해. 틈 괴물들이 틈 조각을 삼켜 버렸지 뭐야."],
					["?", ["되찾아 줄게요.", "틈 괴물?"]],
					["별이", "북쪽 기둥 사이에 모여 있어. 조심해!"]]},
			{"type": "kill", "region": "ruins", "cell": Vector2(3.9, 1.5), "kinds": ["ice_fox", "thunder_cat", "fire_imp"],
				"text": "틈 괴물을 물리쳐 틈 조각 되찾기"},
			{"type": "talk", "npc": "wq_byeori", "text": "별이에게 틈 조각 건네기",
				"lines": [["별이", "조각 셋 다! 이제 틈을 열 자리가 필요한데… 이 폐허 돌에 새긴 글이 내 기록이랑 맞아.", "joy"],
					["별이", "서쪽 끝에 옛 석공이 서성이던데, 돌을 잘 아는 사람 같더라."]]},
			{"type": "talk", "npc": "dolsoe", "text": "옛 석공 돌쇠에게 묻기",
				"lines": [["돌쇠", "이 돌 제단 말인가? 내가 쌓았지. 아니, 쌓을 참이지… 헷갈리는군. 날짜가 엉켰어.", "surprised"],
					["돌쇠", "석등 셋을 달 → 해 → 별 차례로 밝히면 돌이 문이 된다네. 내 스승이 그리 일렀어."],
					["?", ["해 볼게요.", "문이 되면요?"]],
					["돌쇠", "문이 열리는 동안 틈에서 뭔가 몰려나올 게야. 제단을 지키게."]]},
			{"type": "seal", "region": "ruins", "cell": Vector2(1.75, 3.35), "order": ["moon", "sun", "star"],
				"text": "틈 제단 석등을 차례대로 밝히기"},
			{"type": "defend", "region": "ruins", "cell": Vector2(1.75, 3.35), "hp": 900.0,
				"waves": [["ice_fox", "thunder_cat", "bandit"], ["fire_imp", "grass_snake", "rock_bear"]],
				"text": "틈이 열리는 동안 제단 지키기"},
			{"type": "talk", "npc": "dolsoe", "text": "돌쇠와 이야기하기",
				"lines": [["돌쇠", "허허, 문이 섰구먼. 이제 내 날짜도 제자리로 돌아가겠지.", "joy"],
					["돌쇠", "그 아이한테 전하게 — 돌은 오래 기다려 준다고."]]},
			{"type": "talk", "npc": "wq_byeori", "text": "별이 배웅하기",
				"lines": [["별이", "틈이 열렸어! 이제 돌아갈 수 있어.", "joy"],
					["별이", "먼 뒷날 이 폐허는 공원이 돼. 네 이름도 안내판에 있을지 몰라 — 농담이야! 이건 탐사대 비상금.", "fun"],
					["?", ["잘 가요!", "또 만나요."]],
					["별이", "시간 틈이 또 열리면, 그땐 내가 널 도우러 올게."]]},
		]},
}

static func quest(id: String) -> Dictionary:
	return QUESTS.get(id, {})

static func step_of(id: String, st: int) -> Dictionary:
	var q := quest(id)
	if q.is_empty():
		return {}
	var steps: Array = q.steps
	return steps[st] if st >= 0 and st < steps.size() else {}
