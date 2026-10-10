extends Label

## 표준 A "목표판 3줄"(지금·이번 세션·이번 주, PLAN.md 101-1·101-4) —
## party_label.gd·quest_label.gd와 같은 경계: 다섯 판 HUD 에 같은
## 스크립트를 붙인 Label 하나를 둔다. 이 스크립트는 codex_state.gd의
## discover()처럼 무엇을 보여줄지 모른다 — saga_core 는 개별 판의
## QuestState·CodexState 같은 싱글턴을 모르니, 판별 *_state.gd 가
## set_goals()를 불러 3줄을 채운다(그룹 "goal_board"로 이 노드를 찾는다).
## 아직 안 부른 판은 빈 줄 그대로다("만든 판만 켠다" — DUNGEON·REALM 등).

## G-0039 — 다섯 판 HUD 씬은 16px·흰색 88% 로 두었는데 가로 1280×720 에선 약 9px 라 안 읽혔다. 라벨이 한 곳에서 덮어쓴다.
const FONT_SIZE := 22
const OUTLINE := 6
const MIN_WIDTH := 420.0
const MIN_TOP := 110.0   # 판 맨 위 알림 띠(약 40~100px) 아래로

func _ready() -> void:
	add_to_group("goal_board")
	add_theme_font_size_override("font_size", FONT_SIZE)
	add_theme_color_override("font_color", Color(1, 1, 1, 1))
	add_theme_color_override("font_outline_color", Color(0, 0, 0, 1))
	add_theme_constant_override("outline_size", OUTLINE)
	if offset_right - offset_left < MIN_WIDTH:   # 오른쪽에 붙인 채 왼쪽으로 넓힌다
		offset_left = offset_right - MIN_WIDTH
	offset_top = maxf(offset_top, MIN_TOP)
	offset_bottom = maxf(offset_bottom, offset_top + FONT_SIZE * 3 * 1.45)
	autowrap_mode = TextServer.AUTOWRAP_WORD_SMART   # 긴 목표(사가만리 첫걸음 안내)가 화면 밖으로 안 나가게
	text = ""


## G-0179 — 세션 마무리 카드(session_card.gd)가 "▶ 다음:" 줄로 쓴다(표준 B "다음에 할 것 1개").
var now_line := ""


func set_goals(now: String, session: String, week: String) -> void:
	now_line = now
	text = "🎯 %s\n⏱ %s\n📅 %s" % [now, session, week]
