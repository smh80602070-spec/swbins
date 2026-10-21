extends Node

## G-0280 ☰ 메뉴를 판 HUD 에 거는 공용 고리 — HUD .tscn 에 자식으로 하나(2나락·3마을·4종횡·5천하. 1만리는 go_menu.gd).
## HUD 를 싣는 씬마다 저절로 붙는다(4종횡 사냥터 열하나도 같은 StoryHUD). `items` 줄마다 "단추이름|아이콘|칸 이름":
## 그 HUD 단추를 숨기고 칸으로 — 칸을 누르면 단추 pressed 를 그대로 emit(단추 스크립트 안 고침, 단축키 F2·L 은 단추에 남아 그대로).
## HUD 에 없는 단추 줄은 건너뛴다. SAGA_MENU_SCREEN=0 이면 attach 가 null → 단추를 안 숨긴다(메뉴 없이 단추만 사라지는 일 없게).
## G-0286 — 줄이 "@me|아이콘|이름" 이면 단추 대신 「내 정보」 창(me_panel — 판 어댑터 경로는 tscn 의 me_adapter).
## 판 색 테마는 HUD 맨 위 Control(단추 빼고)에 ui_kit.apply.

const MenuScreen := preload("res://saga_core/ui/menu_screen.gd")
const UiKit := preload("res://saga_core/ui/ui_kit.gd")
const MePanel := preload("res://saga_core/ui/me_panel.gd")

@export var game := "dungeon"
@export var items: PackedStringArray = []
@export var me_adapter := ""   # G-0286 판 「내 정보」 어댑터 스크립트(model(hud))
@export var burger_top := 52.0   # ☰ 위 여백(1280×720 기준) — 판 HUD 오른쪽 위와 안 겹치게

var menu: Node = null
var moved: Array[Button] = []


func _ready() -> void:
	_attach.call_deferred()


func _attach() -> void:
	var hud := get_parent()
	if hud == null or hud.get_parent() == null:
		return
	var list: Array = []
	var btns: Array[Button] = []
	for line in items:
		var p := line.split("|")
		if p[0] == "@me":
			list.append({"id": "me", "icon": p[1] if p.size() > 1 else "👤", "name": p[2] if p.size() > 2 else "내 정보",
				"open": open_me})
			continue
		var b := hud.get_node_or_null(p[0]) as Button
		if b == null:
			continue
		btns.append(b)
		list.append({"id": p[0].trim_suffix("Button").to_snake_case(), "icon": p[1] if p.size() > 1 else "",
			"name": p[2] if p.size() > 2 else b.text, "open": func() -> void: b.pressed.emit()})
	menu = MenuScreen.attach(hud.get_parent(), game, list)
	if menu == null:
		return
	menu.call("set_burger_top", burger_top)
	for b in btns:
		b.visible = false
		moved.append(b)
	UiKit.apply(hud, game)


## 「내 정보」 창(G-0286) — ☰ 칸·촬영(shot_scene "call MenuHook open_me")이 부른다.
func open_me() -> void:
	MePanel.open_for(get_parent(), game, me_adapter)
