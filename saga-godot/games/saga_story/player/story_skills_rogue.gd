class_name StorySkillsRogue
extends StorySkillsArcher

## 사가종횡 무예 — 도적 갈래(도적·자객·환영·사신) `_cast_*`. 상속 사슬은 story_skills_warrior.gd 머리 참고.

## 쌍참(r_twin) — melee, hits:2. 연사(a_double)와 같은 재해석(정면 판정을
## 그 횟수만큼 잇달아 적용).
func _cast_rogue_twin() -> void:
	var lv := StorySaveState.skill_level("r_twin")
	if lv <= 0 or _cd_rogue_twin > 0.0 or mp < StoryCombat.ROGUE_TWIN_COST:
		return
	_cd_rogue_twin = StoryCombat.ROGUE_TWIN_CD
	mp -= StoryCombat.ROGUE_TWIN_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.ROGUE_TWIN_BASE, StoryCombat.ROGUE_TWIN_PER, lv)
	for i in StoryCombat.ROGUE_TWIN_HITS:
		_melee_hit(ATTACK_RANGE, mul)


## 비도(r_knife) — volley(shots:2). 연사와 같은 재해석.
func _cast_rogue_knife() -> void:
	var lv := StorySaveState.skill_level("r_knife")
	if lv <= 0 or _cd_rogue_knife > 0.0 or mp < StoryCombat.ROGUE_KNIFE_COST:
		return
	_cd_rogue_knife = StoryCombat.ROGUE_KNIFE_CD
	mp -= StoryCombat.ROGUE_KNIFE_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.ROGUE_KNIFE_BASE, StoryCombat.ROGUE_KNIFE_PER, lv)
	for i in StoryCombat.ROGUE_KNIFE_SHOTS:
		_melee_hit(ATTACK_RANGE, mul)


## 은신보(r_step) — dash + invuln:0.7(이 포트에 처음 등장). 돌진(w_rush)과
## 같은 순서(경로 판정 → 순간이동)에 무적 시간만 더한다.
func _cast_rogue_step() -> void:
	var lv := StorySaveState.skill_level("r_step")
	if lv <= 0 or _cd_rogue_step > 0.0 or mp < StoryCombat.ROGUE_STEP_COST:
		return
	_cd_rogue_step = StoryCombat.ROGUE_STEP_CD
	mp -= StoryCombat.ROGUE_STEP_COST
	_play_anim("sprint")
	var dist_m := StoryCombat.rogue_step_dist_m()
	_melee_hit(dist_m, StoryCombat.skill_mul(StoryCombat.ROGUE_STEP_BASE, StoryCombat.ROGUE_STEP_PER, lv))
	global_position.x += dist_m * _facing
	_invuln_time_left = maxf(_invuln_time_left, StoryCombat.ROGUE_STEP_INVULN_SEC)


## 급소(r_vital) — buff, 대미지 없음. 철갑·응안과 같은 `_job_buff_time_left`.
func _cast_rogue_vital() -> void:
	if StorySaveState.skill_level("r_vital") <= 0 or _cd_rogue_vital > 0.0 or mp < StoryCombat.ROGUE_VITAL_COST:
		return
	_cd_rogue_vital = StoryCombat.ROGUE_VITAL_CD
	mp -= StoryCombat.ROGUE_VITAL_COST
	_job_buff_time_left = StoryCombat.ROGUE_VITAL_SEC
	_job_buff_atk_mul = StoryCombat.ROGUE_VITAL_ATK_MUL
	_job_buff_guard = 0.0
	_job_buff_regen_mul = 1.0
	_job_buff_speed_mul = 1.0


## 선풍각(r_whirl) — aoe, r:110px. 선풍과 같은 360도 판정 구조.
func _cast_rogue_whirl() -> void:
	var lv := StorySaveState.skill_level("r_whirl")
	if lv <= 0 or _cd_rogue_whirl > 0.0 or mp < StoryCombat.ROGUE_WHIRL_COST:
		return
	_cd_rogue_whirl = StoryCombat.ROGUE_WHIRL_CD
	mp -= StoryCombat.ROGUE_WHIRL_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.ROGUE_WHIRL_BASE, StoryCombat.ROGUE_WHIRL_PER, lv)
	var range_m := ATTACK_RANGE * StoryCombat.ROGUE_WHIRL_RANGE_MUL
	for enemy in get_tree().get_nodes_in_group("story_enemy"):
		var e := enemy as Node3D
		if e == null:
			continue
		var dx: float = e.global_position.x - global_position.x
		if absf(dx) > range_m:
			continue
		var roll: Dictionary = StoryCombat.roll_damage(_effective_atk(), mul)
		e.take_damage(float(roll.dmg))
		StorySaveState.note_player_hit()   # G-0197 연속 타격
		CombatFeel.hit(e, float(roll.dmg), bool(roll.crit))


## 관통표(r_dart) — bolt. 기탄과 같은 재해석(사거리 2배).
func _cast_rogue_dart() -> void:
	var lv := StorySaveState.skill_level("r_dart")
	if lv <= 0 or _cd_rogue_dart > 0.0 or mp < StoryCombat.ROGUE_DART_COST:
		return
	_cd_rogue_dart = StoryCombat.ROGUE_DART_CD
	mp -= StoryCombat.ROGUE_DART_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.ROGUE_DART_BASE, StoryCombat.ROGUE_DART_PER, lv)
	_melee_hit(ATTACK_RANGE * StoryCombat.ROGUE_DART_RANGE_MUL, mul)


## 난무(x_storm) — melee, hits:4.
func _cast_assassin_storm() -> void:
	var lv := StorySaveState.skill_level("x_storm")
	if lv <= 0 or _cd_assassin_storm > 0.0 or mp < StoryCombat.ASSASSIN_STORM_COST:
		return
	_cd_assassin_storm = StoryCombat.ASSASSIN_STORM_CD
	mp -= StoryCombat.ASSASSIN_STORM_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.ASSASSIN_STORM_BASE, StoryCombat.ASSASSIN_STORM_PER, lv)
	for i in StoryCombat.ASSASSIN_STORM_HITS:
		_melee_hit(ATTACK_RANGE, mul)


## 만천화우(x_fan) — volley(shots:5).
func _cast_assassin_fan() -> void:
	var lv := StorySaveState.skill_level("x_fan")
	if lv <= 0 or _cd_assassin_fan > 0.0 or mp < StoryCombat.ASSASSIN_FAN_COST:
		return
	_cd_assassin_fan = StoryCombat.ASSASSIN_FAN_CD
	mp -= StoryCombat.ASSASSIN_FAN_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.ASSASSIN_FAN_BASE, StoryCombat.ASSASSIN_FAN_PER, lv)
	for i in StoryCombat.ASSASSIN_FAN_SHOTS:
		_melee_hit(ATTACK_RANGE, mul)


## 그림자밟기(x_shadow) — dash + invuln:0.9. 은신보(r_step)와 같은 순서.
func _cast_assassin_shadow() -> void:
	var lv := StorySaveState.skill_level("x_shadow")
	if lv <= 0 or _cd_assassin_shadow > 0.0 or mp < StoryCombat.ASSASSIN_SHADOW_COST:
		return
	_cd_assassin_shadow = StoryCombat.ASSASSIN_SHADOW_CD
	mp -= StoryCombat.ASSASSIN_SHADOW_COST
	_play_anim("sprint")
	var dist_m := StoryCombat.assassin_shadow_dist_m()
	_melee_hit(dist_m, StoryCombat.skill_mul(StoryCombat.ASSASSIN_SHADOW_BASE, StoryCombat.ASSASSIN_SHADOW_PER, lv))
	global_position.x += dist_m * _facing
	_invuln_time_left = maxf(_invuln_time_left, StoryCombat.ASSASSIN_SHADOW_INVULN_SEC)


## 질풍각(x_whirl) — aoe, r:140px.
func _cast_assassin_whirl() -> void:
	var lv := StorySaveState.skill_level("x_whirl")
	if lv <= 0 or _cd_assassin_whirl > 0.0 or mp < StoryCombat.ASSASSIN_WHIRL_COST:
		return
	_cd_assassin_whirl = StoryCombat.ASSASSIN_WHIRL_CD
	mp -= StoryCombat.ASSASSIN_WHIRL_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.ASSASSIN_WHIRL_BASE, StoryCombat.ASSASSIN_WHIRL_PER, lv)
	var range_m := ATTACK_RANGE * StoryCombat.ASSASSIN_WHIRL_RANGE_MUL
	for enemy in get_tree().get_nodes_in_group("story_enemy"):
		var e := enemy as Node3D
		if e == null:
			continue
		var dx: float = e.global_position.x - global_position.x
		if absf(dx) > range_m:
			continue
		var roll: Dictionary = StoryCombat.roll_damage(_effective_atk(), mul)
		e.take_damage(float(roll.dmg))
		StorySaveState.note_player_hit()   # G-0197 연속 타격
		CombatFeel.hit(e, float(roll.dmg), bool(roll.crit))


## 암습표(x_dart) — bolt. 관통표와 같은 재해석(사거리 2배).
func _cast_assassin_dart() -> void:
	var lv := StorySaveState.skill_level("x_dart")
	if lv <= 0 or _cd_assassin_dart > 0.0 or mp < StoryCombat.ASSASSIN_DART_COST:
		return
	_cd_assassin_dart = StoryCombat.ASSASSIN_DART_CD
	mp -= StoryCombat.ASSASSIN_DART_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.ASSASSIN_DART_BASE, StoryCombat.ASSASSIN_DART_PER, lv)
	_melee_hit(ATTACK_RANGE * StoryCombat.ASSASSIN_DART_RANGE_MUL, mul)


## 잔영(v_blur) — melee, hits:6.
func _cast_wraith_blur() -> void:
	var lv := StorySaveState.skill_level("v_blur")
	if lv <= 0 or _cd_wraith_blur > 0.0 or mp < StoryCombat.WRAITH_BLUR_COST:
		return
	_cd_wraith_blur = StoryCombat.WRAITH_BLUR_CD
	mp -= StoryCombat.WRAITH_BLUR_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.WRAITH_BLUR_BASE, StoryCombat.WRAITH_BLUR_PER, lv)
	for i in StoryCombat.WRAITH_BLUR_HITS:
		_melee_hit(ATTACK_RANGE, mul)


## 낙화(v_petal) — volley(shots:7). 만천화우와 같은 재해석.
func _cast_wraith_petal() -> void:
	var lv := StorySaveState.skill_level("v_petal")
	if lv <= 0 or _cd_wraith_petal > 0.0 or mp < StoryCombat.WRAITH_PETAL_COST:
		return
	_cd_wraith_petal = StoryCombat.WRAITH_PETAL_CD
	mp -= StoryCombat.WRAITH_PETAL_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.WRAITH_PETAL_BASE, StoryCombat.WRAITH_PETAL_PER, lv)
	for i in StoryCombat.WRAITH_PETAL_SHOTS:
		_melee_hit(ATTACK_RANGE, mul)


## 허공답보(v_void) — dash + invuln:1.2. 그림자밟기와 같은 재해석.
func _cast_wraith_void() -> void:
	var lv := StorySaveState.skill_level("v_void")
	if lv <= 0 or _cd_wraith_void > 0.0 or mp < StoryCombat.WRAITH_VOID_COST:
		return
	_cd_wraith_void = StoryCombat.WRAITH_VOID_CD
	mp -= StoryCombat.WRAITH_VOID_COST
	_play_anim("sprint")
	var dist_m := StoryCombat.wraith_void_dist_m()
	_melee_hit(dist_m, StoryCombat.skill_mul(StoryCombat.WRAITH_VOID_BASE, StoryCombat.WRAITH_VOID_PER, lv))
	global_position.x += dist_m * _facing
	_invuln_time_left = maxf(_invuln_time_left, StoryCombat.WRAITH_VOID_INVULN_SEC)


## 사혼(v_mark) — buff, 대미지 없음.
func _cast_wraith_mark() -> void:
	if StorySaveState.skill_level("v_mark") <= 0 or _cd_wraith_mark > 0.0 or mp < StoryCombat.WRAITH_MARK_COST:
		return
	_cd_wraith_mark = StoryCombat.WRAITH_MARK_CD
	mp -= StoryCombat.WRAITH_MARK_COST
	_job_buff_time_left = StoryCombat.WRAITH_MARK_SEC
	_job_buff_atk_mul = StoryCombat.WRAITH_MARK_ATK_MUL
	_job_buff_guard = 0.0
	_job_buff_regen_mul = 1.0
	_job_buff_speed_mul = 1.0


## 광풍각(v_whirl) — aoe, r:175px.
func _cast_wraith_whirl() -> void:
	var lv := StorySaveState.skill_level("v_whirl")
	if lv <= 0 or _cd_wraith_whirl > 0.0 or mp < StoryCombat.WRAITH_WHIRL_COST:
		return
	_cd_wraith_whirl = StoryCombat.WRAITH_WHIRL_CD
	mp -= StoryCombat.WRAITH_WHIRL_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.WRAITH_WHIRL_BASE, StoryCombat.WRAITH_WHIRL_PER, lv)
	var range_m := ATTACK_RANGE * StoryCombat.WRAITH_WHIRL_RANGE_MUL
	for enemy in get_tree().get_nodes_in_group("story_enemy"):
		var e := enemy as Node3D
		if e == null:
			continue
		var dx: float = e.global_position.x - global_position.x
		if absf(dx) > range_m:
			continue
		var roll: Dictionary = StoryCombat.roll_damage(_effective_atk(), mul)
		e.take_damage(float(roll.dmg))
		StorySaveState.note_player_hit()   # G-0197 연속 타격
		CombatFeel.hit(e, float(roll.dmg), bool(roll.crit))


## 귀표(v_dart) — bolt. 암습표와 같은 재해석(사거리 2배).
func _cast_wraith_dart() -> void:
	var lv := StorySaveState.skill_level("v_dart")
	if lv <= 0 or _cd_wraith_dart > 0.0 or mp < StoryCombat.WRAITH_DART_COST:
		return
	_cd_wraith_dart = StoryCombat.WRAITH_DART_CD
	mp -= StoryCombat.WRAITH_DART_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.WRAITH_DART_BASE, StoryCombat.WRAITH_DART_PER, lv)
	_melee_hit(ATTACK_RANGE * StoryCombat.WRAITH_DART_RANGE_MUL, mul)


## 팔도(d_carve) — melee, hits:8.
func _cast_reaper_carve() -> void:
	var lv := StorySaveState.skill_level("d_carve")
	if lv <= 0 or _cd_reaper_carve > 0.0 or mp < StoryCombat.REAPER_CARVE_COST:
		return
	_cd_reaper_carve = StoryCombat.REAPER_CARVE_CD
	mp -= StoryCombat.REAPER_CARVE_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.REAPER_CARVE_BASE, StoryCombat.REAPER_CARVE_PER, lv)
	for i in StoryCombat.REAPER_CARVE_HITS:
		_melee_hit(ATTACK_RANGE, mul)


## 구화만개(d_bloom) — volley(shots:9). 낙화와 같은 재해석.
func _cast_reaper_bloom() -> void:
	var lv := StorySaveState.skill_level("d_bloom")
	if lv <= 0 or _cd_reaper_bloom > 0.0 or mp < StoryCombat.REAPER_BLOOM_COST:
		return
	_cd_reaper_bloom = StoryCombat.REAPER_BLOOM_CD
	mp -= StoryCombat.REAPER_BLOOM_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.REAPER_BLOOM_BASE, StoryCombat.REAPER_BLOOM_PER, lv)
	for i in StoryCombat.REAPER_BLOOM_SHOTS:
		_melee_hit(ATTACK_RANGE, mul)


## 명계보(d_veil) — dash + invuln:1.5. 허공답보와 같은 재해석.
func _cast_reaper_veil() -> void:
	var lv := StorySaveState.skill_level("d_veil")
	if lv <= 0 or _cd_reaper_veil > 0.0 or mp < StoryCombat.REAPER_VEIL_COST:
		return
	_cd_reaper_veil = StoryCombat.REAPER_VEIL_CD
	mp -= StoryCombat.REAPER_VEIL_COST
	_play_anim("sprint")
	var dist_m := StoryCombat.reaper_veil_dist_m()
	_melee_hit(dist_m, StoryCombat.skill_mul(StoryCombat.REAPER_VEIL_BASE, StoryCombat.REAPER_VEIL_PER, lv))
	global_position.x += dist_m * _facing
	_invuln_time_left = maxf(_invuln_time_left, StoryCombat.REAPER_VEIL_INVULN_SEC)


## 명왕부(d_curse) — buff, 대미지 없음.
func _cast_reaper_curse() -> void:
	if StorySaveState.skill_level("d_curse") <= 0 or _cd_reaper_curse > 0.0 or mp < StoryCombat.REAPER_CURSE_COST:
		return
	_cd_reaper_curse = StoryCombat.REAPER_CURSE_CD
	mp -= StoryCombat.REAPER_CURSE_COST
	_job_buff_time_left = StoryCombat.REAPER_CURSE_SEC
	_job_buff_atk_mul = StoryCombat.REAPER_CURSE_ATK_MUL
	_job_buff_guard = 0.0
	_job_buff_regen_mul = 1.0
	_job_buff_speed_mul = 1.0


## 절명풍(d_whirl) — aoe, r:210px.
func _cast_reaper_whirl() -> void:
	var lv := StorySaveState.skill_level("d_whirl")
	if lv <= 0 or _cd_reaper_whirl > 0.0 or mp < StoryCombat.REAPER_WHIRL_COST:
		return
	_cd_reaper_whirl = StoryCombat.REAPER_WHIRL_CD
	mp -= StoryCombat.REAPER_WHIRL_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.REAPER_WHIRL_BASE, StoryCombat.REAPER_WHIRL_PER, lv)
	var range_m := ATTACK_RANGE * StoryCombat.REAPER_WHIRL_RANGE_MUL
	for enemy in get_tree().get_nodes_in_group("story_enemy"):
		var e := enemy as Node3D
		if e == null:
			continue
		var dx: float = e.global_position.x - global_position.x
		if absf(dx) > range_m:
			continue
		var roll: Dictionary = StoryCombat.roll_damage(_effective_atk(), mul)
		e.take_damage(float(roll.dmg))
		StorySaveState.note_player_hit()   # G-0197 연속 타격
		CombatFeel.hit(e, float(roll.dmg), bool(roll.crit))


## 명표(d_dart) — bolt. 귀표와 같은 재해석(사거리 2배).
func _cast_reaper_dart() -> void:
	var lv := StorySaveState.skill_level("d_dart")
	if lv <= 0 or _cd_reaper_dart > 0.0 or mp < StoryCombat.REAPER_DART_COST:
		return
	_cd_reaper_dart = StoryCombat.REAPER_DART_CD
	mp -= StoryCombat.REAPER_DART_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.REAPER_DART_BASE, StoryCombat.REAPER_DART_PER, lv)
	_melee_hit(ATTACK_RANGE * StoryCombat.REAPER_DART_RANGE_MUL, mul)


