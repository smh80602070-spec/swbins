class_name StorySkillsMage
extends StorySkillsRogue

## 사가스토리 무예 — 술사 갈래(술사·현자·선인·초월) `_cast_*`. 상속 사슬은 story_skills_warrior.gd 머리 참고.

## 화구(m_fire) — bolt. 기탄·관통시와 같은 재해석(사거리 2배).
func _cast_mage_fire() -> void:
	var lv := StorySaveState.skill_level("m_fire")
	if lv <= 0 or _cd_mage_fire > 0.0 or mp < StoryCombat.MAGE_FIRE_COST:
		return
	_cd_mage_fire = StoryCombat.MAGE_FIRE_CD
	mp -= StoryCombat.MAGE_FIRE_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.MAGE_FIRE_BASE, StoryCombat.MAGE_FIRE_PER, lv)
	_melee_hit(ATTACK_RANGE * StoryCombat.MAGE_FIRE_RANGE_MUL, mul)


## 뇌전(m_bolt) — aoe. 선풍·횡소와 같은 360도 판정 구조.
func _cast_mage_bolt() -> void:
	var lv := StorySaveState.skill_level("m_bolt")
	if lv <= 0 or _cd_mage_bolt > 0.0 or mp < StoryCombat.MAGE_BOLT_COST:
		return
	_cd_mage_bolt = StoryCombat.MAGE_BOLT_CD
	mp -= StoryCombat.MAGE_BOLT_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.MAGE_BOLT_BASE, StoryCombat.MAGE_BOLT_PER, lv)
	var range_m := ATTACK_RANGE * StoryCombat.MAGE_BOLT_RANGE_MUL
	for enemy in get_tree().get_nodes_in_group("story_enemy"):
		var e := enemy as Node3D
		if e == null:
			continue
		var dx: float = e.global_position.x - global_position.x
		if absf(dx) > range_m:
			continue
		var roll: Dictionary = StoryCombat.roll_damage(_effective_atk(), mul)
		e.take_damage(float(roll.dmg))
		CombatFeel.hit(e, float(roll.dmg), bool(roll.crit))


## 치유(m_heal) — **이 포트에 처음 등장하는 effect:'heal'.** 적 판정이
## 없다 — max_hp의 MAGE_HEAL_PCT(투자 레벨에 따라 커진다)만큼 채운다
## (story_combat.gd 머리말 참고).
func _cast_mage_heal() -> void:
	var lv := StorySaveState.skill_level("m_heal")
	if lv <= 0 or _cd_mage_heal > 0.0 or mp < StoryCombat.MAGE_HEAL_COST:
		return
	_cd_mage_heal = StoryCombat.MAGE_HEAL_CD
	mp -= StoryCombat.MAGE_HEAL_COST
	var pct := StoryCombat.skill_mul(StoryCombat.MAGE_HEAL_BASE, StoryCombat.MAGE_HEAL_PER, lv)
	hp = clampf(hp + max_hp * pct, 0.0, max_hp)


## 부적(m_talis) — buff, 대미지 없음. atk 배율은 다른 job 버프와 같은
## `_job_buff_time_left`, regen 배율은 mp 회복 줄(`_physics_process()`)이
## 따로 적용한다.
func _cast_mage_talis() -> void:
	if StorySaveState.skill_level("m_talis") <= 0 or _cd_mage_talis > 0.0 or mp < StoryCombat.MAGE_TALIS_COST:
		return
	_cd_mage_talis = StoryCombat.MAGE_TALIS_CD
	mp -= StoryCombat.MAGE_TALIS_COST
	_job_buff_time_left = StoryCombat.MAGE_TALIS_SEC
	_job_buff_atk_mul = StoryCombat.MAGE_TALIS_ATK_MUL
	_job_buff_guard = 0.0
	_job_buff_regen_mul = StoryCombat.MAGE_TALIS_REGEN_MUL
	_job_buff_speed_mul = 1.0


## 축지(m_step) — dash + invuln:0.5. 은신보와 같은 순서.
func _cast_mage_step() -> void:
	var lv := StorySaveState.skill_level("m_step")
	if lv <= 0 or _cd_mage_step > 0.0 or mp < StoryCombat.MAGE_STEP_COST:
		return
	_cd_mage_step = StoryCombat.MAGE_STEP_CD
	mp -= StoryCombat.MAGE_STEP_COST
	_play_anim("sprint")
	var dist_m := StoryCombat.mage_step_dist_m()
	_melee_hit(dist_m, StoryCombat.skill_mul(StoryCombat.MAGE_STEP_BASE, StoryCombat.MAGE_STEP_PER, lv))
	global_position.x += dist_m * _facing
	_invuln_time_left = maxf(_invuln_time_left, StoryCombat.MAGE_STEP_INVULN_SEC)


## 마탄(m_orb) — volley(shots:3). 연사와 같은 재해석.
func _cast_mage_orb() -> void:
	var lv := StorySaveState.skill_level("m_orb")
	if lv <= 0 or _cd_mage_orb > 0.0 or mp < StoryCombat.MAGE_ORB_COST:
		return
	_cd_mage_orb = StoryCombat.MAGE_ORB_CD
	mp -= StoryCombat.MAGE_ORB_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.MAGE_ORB_BASE, StoryCombat.MAGE_ORB_PER, lv)
	for i in StoryCombat.MAGE_ORB_SHOTS:
		_melee_hit(ATTACK_RANGE, mul)


## 지진(p_quake) — aoe, r:230px.
func _cast_sage_quake() -> void:
	var lv := StorySaveState.skill_level("p_quake")
	if lv <= 0 or _cd_sage_quake > 0.0 or mp < StoryCombat.SAGE_QUAKE_COST:
		return
	_cd_sage_quake = StoryCombat.SAGE_QUAKE_CD
	mp -= StoryCombat.SAGE_QUAKE_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.SAGE_QUAKE_BASE, StoryCombat.SAGE_QUAKE_PER, lv)
	var range_m := ATTACK_RANGE * StoryCombat.SAGE_QUAKE_RANGE_MUL
	for enemy in get_tree().get_nodes_in_group("story_enemy"):
		var e := enemy as Node3D
		if e == null:
			continue
		var dx: float = e.global_position.x - global_position.x
		if absf(dx) > range_m:
			continue
		var roll: Dictionary = StoryCombat.roll_damage(_effective_atk(), mul)
		e.take_damage(float(roll.dmg))
		CombatFeel.hit(e, float(roll.dmg), bool(roll.crit))


## 천뢰(p_beam) — 원문 effect:'rain', s_rain과 같은 단순 정면 재해석.
func _cast_sage_beam() -> void:
	var lv := StorySaveState.skill_level("p_beam")
	if lv <= 0 or _cd_sage_beam > 0.0 or mp < StoryCombat.SAGE_BEAM_COST:
		return
	_cd_sage_beam = StoryCombat.SAGE_BEAM_CD
	mp -= StoryCombat.SAGE_BEAM_COST
	_play_anim("sprint")
	_melee_hit(ATTACK_RANGE, StoryCombat.skill_mul(StoryCombat.SAGE_BEAM_BASE, StoryCombat.SAGE_BEAM_PER, lv))


## 호신부(p_ward) — buff, 대미지 없음.
func _cast_sage_ward() -> void:
	if StorySaveState.skill_level("p_ward") <= 0 or _cd_sage_ward > 0.0 or mp < StoryCombat.SAGE_WARD_COST:
		return
	_cd_sage_ward = StoryCombat.SAGE_WARD_CD
	mp -= StoryCombat.SAGE_WARD_COST
	_job_buff_time_left = StoryCombat.SAGE_WARD_SEC
	_job_buff_atk_mul = StoryCombat.SAGE_WARD_ATK_MUL
	_job_buff_guard = StoryCombat.SAGE_WARD_GUARD
	_job_buff_regen_mul = StoryCombat.SAGE_WARD_REGEN_MUL
	_job_buff_speed_mul = 1.0


## 축지술(p_step) — dash + invuln:0.7. 축지와 같은 재해석(더 크게 나아간다).
func _cast_sage_step() -> void:
	var lv := StorySaveState.skill_level("p_step")
	if lv <= 0 or _cd_sage_step > 0.0 or mp < StoryCombat.SAGE_STEP_COST:
		return
	_cd_sage_step = StoryCombat.SAGE_STEP_CD
	mp -= StoryCombat.SAGE_STEP_COST
	_play_anim("sprint")
	var dist_m := StoryCombat.sage_step_dist_m()
	_melee_hit(dist_m, StoryCombat.skill_mul(StoryCombat.SAGE_STEP_BASE, StoryCombat.SAGE_STEP_PER, lv))
	global_position.x += dist_m * _facing
	_invuln_time_left = maxf(_invuln_time_left, StoryCombat.SAGE_STEP_INVULN_SEC)


## 연환탄(p_orb) — volley(shots:4). 마탄과 같은 재해석.
func _cast_sage_orb() -> void:
	var lv := StorySaveState.skill_level("p_orb")
	if lv <= 0 or _cd_sage_orb > 0.0 or mp < StoryCombat.SAGE_ORB_COST:
		return
	_cd_sage_orb = StoryCombat.SAGE_ORB_CD
	mp -= StoryCombat.SAGE_ORB_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.SAGE_ORB_BASE, StoryCombat.SAGE_ORB_PER, lv)
	for i in StoryCombat.SAGE_ORB_SHOTS:
		_melee_hit(ATTACK_RANGE, mul)


## 유성(i_meteor) — 원문 effect:'rain', 천뢰와 같은 단순 정면 재해석.
func _cast_immortal_meteor() -> void:
	var lv := StorySaveState.skill_level("i_meteor")
	if lv <= 0 or _cd_immortal_meteor > 0.0 or mp < StoryCombat.IMMORTAL_METEOR_COST:
		return
	_cd_immortal_meteor = StoryCombat.IMMORTAL_METEOR_CD
	mp -= StoryCombat.IMMORTAL_METEOR_COST
	_play_anim("sprint")
	_melee_hit(ATTACK_RANGE, StoryCombat.skill_mul(StoryCombat.IMMORTAL_METEOR_BASE, StoryCombat.IMMORTAL_METEOR_PER, lv))


## 천붕지열(i_abyss) — aoe, r:300px.
func _cast_immortal_abyss() -> void:
	var lv := StorySaveState.skill_level("i_abyss")
	if lv <= 0 or _cd_immortal_abyss > 0.0 or mp < StoryCombat.IMMORTAL_ABYSS_COST:
		return
	_cd_immortal_abyss = StoryCombat.IMMORTAL_ABYSS_CD
	mp -= StoryCombat.IMMORTAL_ABYSS_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.IMMORTAL_ABYSS_BASE, StoryCombat.IMMORTAL_ABYSS_PER, lv)
	var range_m := ATTACK_RANGE * StoryCombat.IMMORTAL_ABYSS_RANGE_MUL
	for enemy in get_tree().get_nodes_in_group("story_enemy"):
		var e := enemy as Node3D
		if e == null:
			continue
		var dx: float = e.global_position.x - global_position.x
		if absf(dx) > range_m:
			continue
		var roll: Dictionary = StoryCombat.roll_damage(_effective_atk(), mul)
		e.take_damage(float(roll.dmg))
		CombatFeel.hit(e, float(roll.dmg), bool(roll.crit))


## 회춘(i_mend) — heal.
func _cast_immortal_mend() -> void:
	var lv := StorySaveState.skill_level("i_mend")
	if lv <= 0 or _cd_immortal_mend > 0.0 or mp < StoryCombat.IMMORTAL_MEND_COST:
		return
	_cd_immortal_mend = StoryCombat.IMMORTAL_MEND_CD
	mp -= StoryCombat.IMMORTAL_MEND_COST
	var pct := StoryCombat.skill_mul(StoryCombat.IMMORTAL_MEND_BASE, StoryCombat.IMMORTAL_MEND_PER, lv)
	hp = clampf(hp + max_hp * pct, 0.0, max_hp)


## 태극(i_tao) — buff, 대미지 없음.
func _cast_immortal_tao() -> void:
	if StorySaveState.skill_level("i_tao") <= 0 or _cd_immortal_tao > 0.0 or mp < StoryCombat.IMMORTAL_TAO_COST:
		return
	_cd_immortal_tao = StoryCombat.IMMORTAL_TAO_CD
	mp -= StoryCombat.IMMORTAL_TAO_COST
	_job_buff_time_left = StoryCombat.IMMORTAL_TAO_SEC
	_job_buff_atk_mul = StoryCombat.IMMORTAL_TAO_ATK_MUL
	_job_buff_guard = StoryCombat.IMMORTAL_TAO_GUARD
	_job_buff_regen_mul = StoryCombat.IMMORTAL_TAO_REGEN_MUL
	_job_buff_speed_mul = 1.0


## 이형보(i_step) — dash + invuln:0.9. 축지술과 같은 재해석.
func _cast_immortal_step() -> void:
	var lv := StorySaveState.skill_level("i_step")
	if lv <= 0 or _cd_immortal_step > 0.0 or mp < StoryCombat.IMMORTAL_STEP_COST:
		return
	_cd_immortal_step = StoryCombat.IMMORTAL_STEP_CD
	mp -= StoryCombat.IMMORTAL_STEP_COST
	_play_anim("sprint")
	var dist_m := StoryCombat.immortal_step_dist_m()
	_melee_hit(dist_m, StoryCombat.skill_mul(StoryCombat.IMMORTAL_STEP_BASE, StoryCombat.IMMORTAL_STEP_PER, lv))
	global_position.x += dist_m * _facing
	_invuln_time_left = maxf(_invuln_time_left, StoryCombat.IMMORTAL_STEP_INVULN_SEC)


## 유성탄(i_orb) — volley(shots:6). 연환탄과 같은 재해석.
func _cast_immortal_orb() -> void:
	var lv := StorySaveState.skill_level("i_orb")
	if lv <= 0 or _cd_immortal_orb > 0.0 or mp < StoryCombat.IMMORTAL_ORB_COST:
		return
	_cd_immortal_orb = StoryCombat.IMMORTAL_ORB_CD
	mp -= StoryCombat.IMMORTAL_ORB_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.IMMORTAL_ORB_BASE, StoryCombat.IMMORTAL_ORB_PER, lv)
	for i in StoryCombat.IMMORTAL_ORB_SHOTS:
		_melee_hit(ATTACK_RANGE, mul)


## 낙성우(z_starfall) — 원문 effect:'rain', 유성과 같은 단순 정면 재해석.
func _cast_ascendant_starfall() -> void:
	var lv := StorySaveState.skill_level("z_starfall")
	if lv <= 0 or _cd_ascendant_starfall > 0.0 or mp < StoryCombat.ASCENDANT_STARFALL_COST:
		return
	_cd_ascendant_starfall = StoryCombat.ASCENDANT_STARFALL_CD
	mp -= StoryCombat.ASCENDANT_STARFALL_COST
	_play_anim("sprint")
	_melee_hit(ATTACK_RANGE, StoryCombat.skill_mul(StoryCombat.ASCENDANT_STARFALL_BASE, StoryCombat.ASCENDANT_STARFALL_PER, lv))


## 건곤붕(z_collapse) — aoe, r:330px.
func _cast_ascendant_collapse() -> void:
	var lv := StorySaveState.skill_level("z_collapse")
	if lv <= 0 or _cd_ascendant_collapse > 0.0 or mp < StoryCombat.ASCENDANT_COLLAPSE_COST:
		return
	_cd_ascendant_collapse = StoryCombat.ASCENDANT_COLLAPSE_CD
	mp -= StoryCombat.ASCENDANT_COLLAPSE_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.ASCENDANT_COLLAPSE_BASE, StoryCombat.ASCENDANT_COLLAPSE_PER, lv)
	var range_m := ATTACK_RANGE * StoryCombat.ASCENDANT_COLLAPSE_RANGE_MUL
	for enemy in get_tree().get_nodes_in_group("story_enemy"):
		var e := enemy as Node3D
		if e == null:
			continue
		var dx: float = e.global_position.x - global_position.x
		if absf(dx) > range_m:
			continue
		var roll: Dictionary = StoryCombat.roll_damage(_effective_atk(), mul)
		e.take_damage(float(roll.dmg))
		CombatFeel.hit(e, float(roll.dmg), bool(roll.crit))


## 환생(z_rebirth) — heal.
func _cast_ascendant_rebirth() -> void:
	var lv := StorySaveState.skill_level("z_rebirth")
	if lv <= 0 or _cd_ascendant_rebirth > 0.0 or mp < StoryCombat.ASCENDANT_REBIRTH_COST:
		return
	_cd_ascendant_rebirth = StoryCombat.ASCENDANT_REBIRTH_CD
	mp -= StoryCombat.ASCENDANT_REBIRTH_COST
	var pct := StoryCombat.skill_mul(StoryCombat.ASCENDANT_REBIRTH_BASE, StoryCombat.ASCENDANT_REBIRTH_PER, lv)
	hp = clampf(hp + max_hp * pct, 0.0, max_hp)


## 무극(z_eternity) — buff, 대미지 없음.
func _cast_ascendant_eternity() -> void:
	if StorySaveState.skill_level("z_eternity") <= 0 or _cd_ascendant_eternity > 0.0 or mp < StoryCombat.ASCENDANT_ETERNITY_COST:
		return
	_cd_ascendant_eternity = StoryCombat.ASCENDANT_ETERNITY_CD
	mp -= StoryCombat.ASCENDANT_ETERNITY_COST
	_job_buff_time_left = StoryCombat.ASCENDANT_ETERNITY_SEC
	_job_buff_atk_mul = StoryCombat.ASCENDANT_ETERNITY_ATK_MUL
	_job_buff_guard = StoryCombat.ASCENDANT_ETERNITY_GUARD
	_job_buff_regen_mul = StoryCombat.ASCENDANT_ETERNITY_REGEN_MUL
	_job_buff_speed_mul = 1.0


## 신행보(z_step) — dash + invuln:1.1. 이형보와 같은 재해석.
func _cast_ascendant_step() -> void:
	var lv := StorySaveState.skill_level("z_step")
	if lv <= 0 or _cd_ascendant_step > 0.0 or mp < StoryCombat.ASCENDANT_STEP_COST:
		return
	_cd_ascendant_step = StoryCombat.ASCENDANT_STEP_CD
	mp -= StoryCombat.ASCENDANT_STEP_COST
	_play_anim("sprint")
	var dist_m := StoryCombat.ascendant_step_dist_m()
	_melee_hit(dist_m, StoryCombat.skill_mul(StoryCombat.ASCENDANT_STEP_BASE, StoryCombat.ASCENDANT_STEP_PER, lv))
	global_position.x += dist_m * _facing
	_invuln_time_left = maxf(_invuln_time_left, StoryCombat.ASCENDANT_STEP_INVULN_SEC)


## 성라탄(z_orb) — volley(shots:8). 유성탄과 같은 재해석.
func _cast_ascendant_orb() -> void:
	var lv := StorySaveState.skill_level("z_orb")
	if lv <= 0 or _cd_ascendant_orb > 0.0 or mp < StoryCombat.ASCENDANT_ORB_COST:
		return
	_cd_ascendant_orb = StoryCombat.ASCENDANT_ORB_CD
	mp -= StoryCombat.ASCENDANT_ORB_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.ASCENDANT_ORB_BASE, StoryCombat.ASCENDANT_ORB_PER, lv)
	for i in StoryCombat.ASCENDANT_ORB_SHOTS:
		_melee_hit(ATTACK_RANGE, mul)
