extends RefCounted

## G-0278 공용 창 틀(웹 W-0252 ui-kit 짝) — K-0040 9-slice 부품(`assets/ui_skin/<판>/`, 규격 ui_parts.json)으로 Theme 하나.
##   Button normal·hover·pressed·disabled(btn_*, slice 24) · PanelContainer·Panel = window(32) · PopupPanel = popup(36)
##   · TabBar·TabContainer 탭 tab_on·tab_off(14) · ProgressBar 바탕 gauge_frame·채움 gauge_fill_xp.
## 글자 크기·색은 안 건드린다(G-0158~0168 값 그대로) — 틀만. content_margin = slice(글자가 테두리에 안 붙게).
## 판마다 한 벌(_cache). 손으로 add_theme_stylebox_override 한 자리는 그대로 이긴다(색만 판 색인 곳은 다음 티켓).
## 손잡이: SAGA_UI_KIT=0 이면 null(부르는 쪽은 테마를 안 단다).

const SKIN_DIR := "res://assets/ui_skin/"
const SLICE := {"window": 32, "popup": 36, "card": 28, "tab_on": 14, "tab_off": 14,
	"btn_normal": 24, "btn_hover": 24, "btn_pressed": 24, "btn_disabled": 24, "gauge_frame": 12, "gauge_fill_xp": 8}
const MIN_TOUCH := 96   # ui_parts.json min_touch_px — 폰 가로 48dp @2x

static var _cache := {}


static func enabled() -> bool:
	return OS.get_environment("SAGA_UI_KIT") != "0"


## 9-slice 한 장(content_margin 은 slice, 너무 크면 줄임). 그림이 없으면 null.
static func box(game: String, part: String, margin := -1) -> StyleBoxTexture:
	var p := "%s%s/%s.png" % [SKIN_DIR, game, part]
	if not ResourceLoader.exists(p):
		return null
	var sb := StyleBoxTexture.new()
	sb.texture = load(p) as Texture2D
	var s := int(SLICE.get(part, 16))
	sb.texture_margin_left = s
	sb.texture_margin_right = s
	sb.texture_margin_top = s
	sb.texture_margin_bottom = s
	var m := s if margin < 0 else margin
	sb.content_margin_left = m
	sb.content_margin_right = m
	sb.content_margin_top = m * 0.6
	sb.content_margin_bottom = m * 0.6
	return sb


## 판 하나의 Theme("go"·"dungeon"·"forest"·"story"·"realm"). 꺼졌거나 그림이 없으면 null.
static func theme_for(game: String) -> Theme:
	if not enabled():
		return null
	if _cache.has(game):
		return _cache[game]
	var th := Theme.new()
	var btn := {"normal": "btn_normal", "hover": "btn_hover", "pressed": "btn_pressed", "disabled": "btn_disabled", "focus": "btn_hover"}
	var any := false
	for st in btn:
		var sb := box(game, btn[st], 14)
		if sb != null:
			th.set_stylebox(st, "Button", sb)
			any = true
	var win := box(game, "window")
	if win != null:
		th.set_stylebox("panel", "PanelContainer", win)
		th.set_stylebox("panel", "Panel", win)
	var pop := box(game, "popup")
	if pop != null:
		th.set_stylebox("panel", "PopupPanel", pop)
	var on := box(game, "tab_on", 12)
	var off := box(game, "tab_off", 12)
	if on != null and off != null:
		th.set_stylebox("tab_selected", "TabBar", on)
		th.set_stylebox("tab_unselected", "TabBar", off)
		th.set_stylebox("tab_hovered", "TabBar", on)
		th.set_stylebox("tab_selected", "TabContainer", on)
		th.set_stylebox("tab_unselected", "TabContainer", off)
	var gf := box(game, "gauge_frame", 4)
	var gx := box(game, "gauge_fill_xp", 0)
	if gf != null and gx != null:
		th.set_stylebox("background", "ProgressBar", gf)
		th.set_stylebox("fill", "ProgressBar", gx)
	if not any:
		return null
	_cache[game] = th
	return th


## 화면 노드(CanvasLayer 든 Node 든)의 맨 위 Control 들(단추 빼고 — 판·틀)에 판 테마를 단다 — 이미 테마가 있는 Control 은 그대로. 단 수.
static func apply(node: Node, game: String) -> int:
	var th := theme_for(game)
	if th == null or node == null:
		return 0
	var n := 0
	var tops: Array = []
	for c in node.get_children():
		if c is Control:
			tops.append(c)
		elif c is CanvasLayer:
			for cc in c.get_children():
				if cc is Control:
					tops.append(cc)
	for c in tops:
		if c is BaseButton:   # 화면 여는 HUD 단추(높이 40 — 9-slice 모서리 24×2 가 짓눌림, HUD 는 다음 티켓)
			continue
		if (c as Control).theme == null:
			(c as Control).theme = th
			n += 1
	return n


## 카드 칸 바탕(card.png) — 메뉴 격자.
static func card_box(game: String) -> StyleBoxTexture:
	return box(game, "card", 18)
