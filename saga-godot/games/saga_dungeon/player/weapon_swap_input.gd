extends Node

## G-0236 무기 두 벌 바꿔 들기(웹 W-0281 wpn-swap.js press) — Q(weapon_swap)와 HUD 🔁 단추가 같은 진입점 press().
## 규칙은 DungeonEquipmentState.swap_weapons() 에 있고, 여기는 입력·토스트·0.4초 바꿔 드는 자세만.
## 자세는 새 그림 없이 몸(Visual)을 뒤로 젖혔다가 앞으로 숙이며 돌아오는 기울이기(player.gd 는 rotation.y 만 만진다).
## potion_belt_input.gd 와 같은 경계(Player 자식 컴포넌트, 입력 하나를 받는 자리).

const Toast := preload("res://saga_core/ui/toast.gd")
const LEAN_BACK := -0.32   # 라디안 — 칼집에 넣듯 뒤로
const LEAN_FWD := 0.18     # 새 무기를 뽑아 들며 앞으로
const LOOK_EMOJI := {
	"sword": "🗡️", "bow": "🏹", "spear": "🔱", "club": "🏏", "guandao": "⚔️", "axe": "🪓", "halberd": "🪓",
	"staff": "✨", "fan": "🎐", "brush": "🖌️", "scroll": "📜", "gauntlet": "🥊",
}

var pose_left := 0.0   # 남은 자세 시간(점검이 읽는다)
var _tween: Tween = null


func _ready() -> void:
	add_to_group("weapon_swap")


func _process(delta: float) -> void:
	pose_left = maxf(0.0, pose_left - delta)
	if Input.is_action_just_pressed("weapon_swap"):
		press()


static func emoji_of(it: Dictionary) -> String:
	if it.is_empty():
		return "✊"
	return str(LOOK_EMOJI.get(str(DungeonItems.base_by_key(str(it.get("base", ""))).get("look", "")), "⚔️"))


func press() -> bool:
	var r: Dictionary = DungeonEquipmentState.swap_weapons()
	if bool(r.get("ok", false)):
		var w := DungeonEquipmentState.weapon
		Toast.show(self, "%s 바꿔 들었다 — %s · 첫 타 ×%.2f" % [emoji_of(w), DungeonItems.class_name_for_weapon(w), DungeonEquipmentState.FIRST_MUL], 1.6)
		_pose()
		return true
	if str(r.get("reason", "")) == "single":
		Toast.show(self, "을(乙) 무기가 없다 — 새 무기를 주우면 손에 든 것이 을로 간다", 2.0)
	return false


func _pose() -> void:
	pose_left = DungeonEquipmentState.SWAP_SEC
	var p := get_parent()
	var vis: Node3D = p.get_node_or_null("Visual") as Node3D if p else null
	if vis == null or not vis.is_inside_tree():
		return
	if _tween and _tween.is_valid():
		_tween.kill()
	var t := DungeonEquipmentState.SWAP_SEC
	_tween = vis.create_tween()
	_tween.tween_property(vis, "rotation:x", LEAN_BACK, t * 0.4).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	_tween.tween_property(vis, "rotation:x", LEAN_FWD, t * 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_tween.tween_property(vis, "rotation:x", 0.0, t * 0.3).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
