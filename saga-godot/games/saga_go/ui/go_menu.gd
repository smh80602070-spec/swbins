extends RefCounted

const UiKit := preload("res://saga_core/ui/ui_kit.gd")
const GoalsPanel := preload("res://saga_core/ui/goals_panel.gd")
const GOALS_ADAPTER := "res://games/saga_go/ui/goals_adapter.gd"

## G-0278 1만리 ☰ 메뉴 칸 표 — saga_core/ui/menu_screen.gd 에 넘긴다. 순서 = 격자 순서.
## 주요 화면은 원래 키(액션)를 한 번 누른 것처럼, hud_menu(2026-09-30 세로 목록) 항목은 그 open_entry·badge_of·shown 그대로.
## 키는 그대로다 — 칸 이름 괄호 안이 그 키.

const HUD_ICONS := {"go_hunt": "📜", "go_weekly_goals": "🗓", "go_album": "📷", "go_eggs": "🥚", "go_homestead": "🏡",
	"go_cycle": "⛵", "go_starchart": "✨", "go_save_transfer": "💾", "go_graphics": "🖥", "go_help": "❔"}


## 메뉴에서 여는 화면들(노드 이름) — 루트 Control 에 ui_kit 틀을 단다(손 StyleBoxFlat 덮개는 그대로 이김).
const SCREENS := ["CharacterScreen", "CodexScreen", "CookingScreen", "WorldMap", "StoryQuest", "Achievements", "Commissions",
	"HuntLog", "WeeklyGoals", "PhotoAlbum", "EggIncubator", "CycleScreen", "SaveTransfer", "HelpGuide", "Homestead"]


static func apply_theme(scene: Node) -> int:
	var n := 0
	for nm in SCREENS:
		n += UiKit.apply(scene.find_child(nm, true, false), "go")
	## G-0297 HUD 단추도 같은 틀 — 화면마다 스스로 만든 여는 단추(인물 (C)·요리 (G)… 윗줄, 화면 노드나 그 CanvasLayer 바로 밑).
	## 저장·사진(MobileHUD) — G-0301 에서 E·Q 구슬을 왼쪽으로 옮겨 겹침이 풀려 같은 틀을 씌운다(MobileHUD 의 다른 단추는 그대로)
	for nm in SCREENS:
		var node := scene.find_child(nm, true, false)
		if node == null:
			continue
		n += UiKit.apply_hud(node, "go")
		for c in node.get_children():
			if c is CanvasLayer:
				n += UiKit.apply_hud(c, "go")
	var th := UiKit.hud_theme("go")
	for nm in ["SaveButton", "PhotoModeButton"]:
		var b := scene.find_child(nm, true, false) as Button
		if th != null and b != null and b.theme == null:
			b.theme = th
			n += 1
	return n


## G-0351 「오늘」 창(saga_core goals_panel + 1만리 어댑터) — ☰ 칸·촬영(shot_scene static)이 부른다. node = 씬 안 아무 노드, SceneTree 도 됨.
static func open_goals(node: Object) -> void:
	var n: Node = (node as SceneTree).current_scene if node is SceneTree else node as Node
	GoalsPanel.open_for(n, "go", GOALS_ADAPTER)


static func items(hud_menu: Node) -> Array:
	var out: Array = [
		{"id": "character", "name": "인물 (C)", "icon": "🧑", "action": "go_character"},
		{"id": "codex", "name": "도감 (X)", "icon": "📖", "action": "go_codex"},
		{"id": "food", "name": "요리 (G)", "icon": "🍲", "action": "go_food"},
		{"id": "map", "name": "지도 (M)", "icon": "🗺", "action": "go_map"},
		{"id": "journal", "name": "임무 (O)", "icon": "🧭", "action": "go_journal"},
		{"id": "commissions", "name": "의뢰 (U)", "icon": "📌", "action": "go_commissions"},
		{"id": "achievements", "name": "업적 (Y)", "icon": "🏆", "action": "go_achievements"},
	]
	if hud_menu == null:
		return out
	out.insert(6, {"id": "goals", "name": "오늘", "icon": "📅", "open": open_goals.bind(hud_menu)})   # G-0351 「오늘」 창
	for e in hud_menu.get("ENTRIES"):
		var g := String(e[0])
		out.append({"id": g.trim_prefix("go_"), "name": String(e[1]).trim_prefix("✨ "), "icon": String(HUD_ICONS.get(g, "•")),
			"open": hud_menu.open_entry.bind(g), "badge": hud_menu.badge_of.bind(g), "shown": hud_menu.shown.bind(g)})
	return out
