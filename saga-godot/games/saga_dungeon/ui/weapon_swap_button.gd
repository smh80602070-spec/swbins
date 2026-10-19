extends Button

## G-0236 — 폰 🔁 무기 바꿔 들기 단추(Q 짝). 글자 = 다음에 들 무기(을) 모양 · 쿨 중이면 남은 초 · 을이 없으면 흐림.
## 누르면 Player 의 weapon_swap_input.gd press() — 키보드와 같은 진입점.

const Swap := preload("res://games/saga_dungeon/player/weapon_swap_input.gd")
const TICK := 0.1

var _t := 0.0
var _ring_on := false


func _ready() -> void:
	pressed.connect(_on_pressed)
	_refresh()


func _process(delta: float) -> void:
	_t -= delta
	if _t > 0.0:
		return
	_t = TICK
	_refresh()


func _refresh() -> void:
	var w2: Dictionary = DungeonEquipmentState.weapon2
	var cd: float = DungeonEquipmentState.cd_left()
	var label := ""
	if w2.is_empty():
		label = "🔁 Q"
		modulate.a = 0.45
	else:
		label = "🔁%s %s" % [Swap.emoji_of(w2), ("%.1f" % cd) if cd > 0.0 else "Q"]
		modulate.a = 0.6 if cd > 0.0 else 1.0
	if text != label:
		text = label
	if cd > 0.0 or _ring_on:
		_ring_on = cd > 0.0
		queue_redraw()


## 쿨 고리 — 남은 쿨만큼 단추 둘레에 호(새 그림 없이 선만).
func _draw() -> void:
	var cd: float = DungeonEquipmentState.cd_left()
	if cd <= 0.0:
		return
	var frac := clampf(cd / DungeonEquipmentState.SWAP_CD, 0.0, 1.0)
	var r := minf(size.x, size.y) * 0.5 - 4.0
	draw_arc(size * 0.5, r, -PI * 0.5, -PI * 0.5 + TAU * frac, 32, Color(1.0, 0.85, 0.4, 0.9), 4.0, true)


func _on_pressed() -> void:
	var found := get_tree().get_nodes_in_group("weapon_swap")
	if not found.is_empty():
		found[0].press()
