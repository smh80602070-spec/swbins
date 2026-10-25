extends Button

## G-0198 — 무예 자리 단추(넷, Z·X·C·V 짝). 예전 무예마다 하나씩이던 단추 76을 대신한다.
## 지금 직업 그 자리에 걸린 무예의 이모지(표 `icon`)와 키 글자, 쿨다운 중이면 남은 초를 보인다. 누르면 공용 시전기(skill_caster.gd)의 try_slot.

const KEYS := ["Z", "X", "C", "V", "T"]   # G-0398 slot 4 = 세트 무예(세 점을 다 걸쳤을 때만 보임)
const TICK := 0.1

@export var slot := 0

var _t := 0.0


func _ready() -> void:
	pressed.connect(_on_pressed)
	_refresh()


func _process(delta: float) -> void:
	_t -= delta
	if _t > 0.0:
		return
	_t = TICK
	_refresh()


func _caster() -> Node:
	var found := get_tree().get_nodes_in_group("skill_caster")
	return found[0] if not found.is_empty() else null


func _refresh() -> void:
	var c := _caster()
	if slot == 4:
		var ssk: Dictionary = c.set_skill() if c else {}
		visible = not ssk.is_empty()
		if visible:
			var scd: float = c.cooldown_left(String(ssk.key))
			var sl := "%s %s" % [str(ssk.icon), ("%d" % ceili(scd)) if scd > 0.0 else "T"]
			modulate.a = 0.6 if scd > 0.0 else 1.0
			if text != sl:
				text = sl
			tooltip_text = "세트 무예 %s — %s" % [str(ssk.name), str(ssk.desc)]
		return
	var k: String = c.slot_key(slot) if c else ""
	var label := ""
	if k == "":
		label = "%s ·" % KEYS[slot]
		modulate.a = 0.45
	else:
		var sk := DungeonSkills.skill_by_key(k)
		var cd: float = c.cooldown_left(k)
		label = "%s %s" % [str(sk.get("icon", "✦")), ("%d" % ceili(cd)) if cd > 0.0 else KEYS[slot]]
		modulate.a = 0.6 if cd > 0.0 else 1.0
	if text != label:
		text = label


func _on_pressed() -> void:
	var c := _caster()
	if c and slot == 4:
		c.try_set_skill()
	elif c:
		c.try_slot(slot)
