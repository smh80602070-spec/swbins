extends Button
## G-0054 — 네 판(사가블로·사가의숲·사가스토리·사가국지) HUD 의 "화질" 단추. 누르면 화질/성능 고르기 창(graphics_menu.gd).
## 글자는 지금 모드("화질"·"성능"). 사가고는 화면 메뉴 항목으로 연다(hud_menu.gd).

const Menu := preload("res://saga_core/ui/graphics_menu.gd")
const Gfx := preload("res://saga_core/data/graphics_settings.gd")

var menu: Node = null   # 점검이 본다


func _ready() -> void:
	text = Gfx.label()
	menu = Menu.new()
	menu.name = "GraphicsMenu"
	add_child(menu)
	menu.changed.connect(func() -> void: text = Gfx.label())
	pressed.connect(func() -> void: menu.call("open_screen"))
