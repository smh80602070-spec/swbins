extends RefCounted

const Elements := preload("res://games/saga_go/combat/elements.gd")
const CombatFx := preload("res://saga_core/combat_fx.gd")
const FeelTuning := preload("res://games/saga_go/combat/feel_tuning.gd")

## G-0412 — map the combo step and impact timing onto the CC0 weapon motion clips.
static func combo_animation(weapon_type: String, step: int, heavy: bool = false) -> String:
	var clips: Array = []
	match weapon_type:
		"sword": clips = ["attack", "sword_2", "sword_3"]
		"claymore": clips = ["axe_1", "axe_2", "axe_heavy"]
		"polearm": clips = ["spear_1", "spear_2", "spear_heavy"]
		"bow": clips = ["bow_1", "bow_1", "bow_heavy"]
		_: clips = ["attack", "attack", "attack"]
	var clip: String = clips[2] if heavy else clips[mini(step, clips.size() - 1)]
	return "combat/" + clip

static func strike_delay(player: Node, clip: String, duration: float) -> float:
	var ap := player.get("_anim") as AnimationPlayer
	if ap == null or not ap.has_animation(clip):
		return duration * 0.5
	var anim := ap.get_animation(clip)
	var base_speed := anim.length / maxf(duration, 0.001)
	var strike_time := float(anim.get_meta("strike_time", anim.length * 0.5))
	return strike_time / maxf(base_speed * 0.7, 0.001)

static func resolve_attack(fc: Node, player: Node3D, step: int, amount: float, attacker_id: String, element: String, kit: Dictionary, energy_per_hit: float) -> void:
	FeelTuning.kind = "finisher" if step > 0 and step == (kit.mul as Array).size() - 1 else "normal"
	fc.set("_crit_id", attacker_id)
	var hits := 0
	if kit.has("range"):
		var targets: Array = fc.call("_nearest", player.global_position, float(kit.range), 1)
		if not targets.is_empty():
			var enemy := targets[0] as Node3D
			player.call("face_toward", enemy.global_position)
			fc.call("_shot_fx", enemy.global_position, Elements.color_of(element) if element != "" else Color(0.95, 0.9, 0.7))
			fc.call("_deal", enemy, amount, element, enemy.global_position - player.global_position)
			hits = 1
		else:
			var target := fc.call("nearest_target", float(kit.range)) as Node3D
			if target != null:
				player.call("face_toward", target.global_position)
				fc.call("_shot_fx", target.call("center") - Vector3.UP * 0.8, Elements.color_of(element) if element != "" else Color(0.95, 0.9, 0.7))
				target.call("strike", element)
	else:
		var heavy: bool = kit.get("heavy", false)
		fc.set("_heavy", heavy)
		CombatFx.slash(player, player.call("facing"), float(kit.reach), Elements.color_of(element) if element != "" else CombatFx.PHYSICAL, step, heavy)
		hits = int(fc.call("_hit_front", float(kit.reach), float(kit.arc), amount, element))
		fc.set("_heavy", false)
	fc.set("_crit_id", "")
	if hits > 0:
		fc.call("_gain_energy", energy_per_hit * hits)
		fc.call("_rain_follow")
