class_name StorySkillsArcher
extends StorySkillsWarrior

## 사가종횡 무예 — 궁수 갈래(궁수·저격수·비천·매) `_cast_*`. 상속 사슬은 story_skills_warrior.gd 머리 참고.

## 사격(a_shot) — arrow. 참격(w_cut)과 같은 정면 판정·사거리(원문에 별도
## 사거리가 없다, story_combat.gd 머리말) — mul만 다르다.
func _cast_archer_shot() -> void:
	var lv := StorySaveState.skill_level("a_shot")
	if lv <= 0 or _cd_archer_shot > 0.0 or mp < StoryCombat.ARCHER_SHOT_COST:
		return
	_cd_archer_shot = StoryCombat.ARCHER_SHOT_CD
	mp -= StoryCombat.ARCHER_SHOT_COST
	_play_anim("sprint")
	_melee_hit(ATTACK_RANGE, StoryCombat.skill_mul(StoryCombat.ARCHER_SHOT_BASE, StoryCombat.ARCHER_SHOT_PER, lv))


## 연사(a_double) — volley(shots:3). 투사체가 없어 정면 판정을 세 번
## 잇달아 적용하는 것으로 재해석(story_combat.gd 머리말).
func _cast_archer_double() -> void:
	var lv := StorySaveState.skill_level("a_double")
	if lv <= 0 or _cd_archer_double > 0.0 or mp < StoryCombat.ARCHER_DOUBLE_COST:
		return
	_cd_archer_double = StoryCombat.ARCHER_DOUBLE_CD
	mp -= StoryCombat.ARCHER_DOUBLE_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.ARCHER_DOUBLE_BASE, StoryCombat.ARCHER_DOUBLE_PER, lv)
	for i in StoryCombat.ARCHER_DOUBLE_SHOTS:
		_melee_hit(ATTACK_RANGE, mul)


## 관통시(a_pierce) — bolt. 기탄(_cast_bolt)과 같은 재해석(사거리 2배).
func _cast_archer_pierce() -> void:
	var lv := StorySaveState.skill_level("a_pierce")
	if lv <= 0 or _cd_archer_pierce > 0.0 or mp < StoryCombat.ARCHER_PIERCE_COST:
		return
	_cd_archer_pierce = StoryCombat.ARCHER_PIERCE_CD
	mp -= StoryCombat.ARCHER_PIERCE_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.ARCHER_PIERCE_BASE, StoryCombat.ARCHER_PIERCE_PER, lv)
	_melee_hit(ATTACK_RANGE * StoryCombat.ARCHER_PIERCE_RANGE_MUL, mul)


## 응안(a_eye) — buff, 대미지 없음. 철갑과 같은 `_job_buff_time_left`를
## 쓴다(job이 한 번 정해지면 안 바뀌어 섞일 일이 없다, 변수 선언부 참고).
func _cast_archer_eye() -> void:
	if StorySaveState.skill_level("a_eye") <= 0 or _cd_archer_eye > 0.0 or mp < StoryCombat.ARCHER_EYE_COST:
		return
	_cd_archer_eye = StoryCombat.ARCHER_EYE_CD
	mp -= StoryCombat.ARCHER_EYE_COST
	_job_buff_time_left = StoryCombat.ARCHER_EYE_SEC
	_job_buff_atk_mul = StoryCombat.ARCHER_EYE_ATK_MUL
	_job_buff_guard = 0.0
	_job_buff_regen_mul = 1.0
	_job_buff_speed_mul = 1.0


## 퇴보사(a_retreat) — dash, 원문 그대로 **뒤로** 물러나며 쏜다(다른
## dash류는 전부 전진 — 이 무예만 이동 방향을 반대로 뒤집는다).
func _cast_archer_retreat() -> void:
	var lv := StorySaveState.skill_level("a_retreat")
	if lv <= 0 or _cd_archer_retreat > 0.0 or mp < StoryCombat.ARCHER_RETREAT_COST:
		return
	_cd_archer_retreat = StoryCombat.ARCHER_RETREAT_CD
	mp -= StoryCombat.ARCHER_RETREAT_COST
	_play_anim("sprint")
	var dist_m := StoryCombat.archer_retreat_dist_m()
	_melee_hit(dist_m, StoryCombat.skill_mul(StoryCombat.ARCHER_RETREAT_BASE, StoryCombat.ARCHER_RETREAT_PER, lv))
	global_position.x -= dist_m * _facing


## 환시(a_burst) — aoe, r:110px. 선풍과 같은 360도 판정 구조.
func _cast_archer_burst() -> void:
	var lv := StorySaveState.skill_level("a_burst")
	if lv <= 0 or _cd_archer_burst > 0.0 or mp < StoryCombat.ARCHER_BURST_COST:
		return
	_cd_archer_burst = StoryCombat.ARCHER_BURST_CD
	mp -= StoryCombat.ARCHER_BURST_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.ARCHER_BURST_BASE, StoryCombat.ARCHER_BURST_PER, lv)
	var range_m := ATTACK_RANGE * StoryCombat.ARCHER_BURST_RANGE_MUL
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


## 전우(s_rain) — 원문 effect:'rain', 사격(a_shot)과 같은 단순 정면 재해석.
func _cast_sniper_rain() -> void:
	var lv := StorySaveState.skill_level("s_rain")
	if lv <= 0 or _cd_sniper_rain > 0.0 or mp < StoryCombat.SNIPER_RAIN_COST:
		return
	_cd_sniper_rain = StoryCombat.SNIPER_RAIN_CD
	mp -= StoryCombat.SNIPER_RAIN_COST
	_play_anim("sprint")
	_melee_hit(ATTACK_RANGE, StoryCombat.skill_mul(StoryCombat.SNIPER_RAIN_BASE, StoryCombat.SNIPER_RAIN_PER, lv))


## 일점사(s_snipe) — bolt. 관통시(a_pierce)와 같은 재해석(사거리 2배).
func _cast_sniper_snipe() -> void:
	var lv := StorySaveState.skill_level("s_snipe")
	if lv <= 0 or _cd_sniper_snipe > 0.0 or mp < StoryCombat.SNIPER_SNIPE_COST:
		return
	_cd_sniper_snipe = StoryCombat.SNIPER_SNIPE_CD
	mp -= StoryCombat.SNIPER_SNIPE_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.SNIPER_SNIPE_BASE, StoryCombat.SNIPER_SNIPE_PER, lv)
	_melee_hit(ATTACK_RANGE * StoryCombat.SNIPER_SNIPE_RANGE_MUL, mul)


## 분시(s_split) — volley(shots:4). 연사(a_double)와 같은 재해석.
func _cast_sniper_split() -> void:
	var lv := StorySaveState.skill_level("s_split")
	if lv <= 0 or _cd_sniper_split > 0.0 or mp < StoryCombat.SNIPER_SPLIT_COST:
		return
	_cd_sniper_split = StoryCombat.SNIPER_SPLIT_CD
	mp -= StoryCombat.SNIPER_SPLIT_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.SNIPER_SPLIT_BASE, StoryCombat.SNIPER_SPLIT_PER, lv)
	for i in StoryCombat.SNIPER_SPLIT_SHOTS:
		_melee_hit(ATTACK_RANGE, mul)


## 활보사(s_retreat) — dash, 퇴보사와 같은 재해석(뒤로 물러난다).
func _cast_sniper_retreat() -> void:
	var lv := StorySaveState.skill_level("s_retreat")
	if lv <= 0 or _cd_sniper_retreat > 0.0 or mp < StoryCombat.SNIPER_RETREAT_COST:
		return
	_cd_sniper_retreat = StoryCombat.SNIPER_RETREAT_CD
	mp -= StoryCombat.SNIPER_RETREAT_COST
	_play_anim("sprint")
	var dist_m := StoryCombat.sniper_retreat_dist_m()
	_melee_hit(dist_m, StoryCombat.skill_mul(StoryCombat.SNIPER_RETREAT_BASE, StoryCombat.SNIPER_RETREAT_PER, lv))
	global_position.x -= dist_m * _facing


## 광환시(s_burst) — aoe, r:140px.
func _cast_sniper_burst() -> void:
	var lv := StorySaveState.skill_level("s_burst")
	if lv <= 0 or _cd_sniper_burst > 0.0 or mp < StoryCombat.SNIPER_BURST_COST:
		return
	_cd_sniper_burst = StoryCombat.SNIPER_BURST_CD
	mp -= StoryCombat.SNIPER_BURST_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.SNIPER_BURST_BASE, StoryCombat.SNIPER_BURST_PER, lv)
	var range_m := ATTACK_RANGE * StoryCombat.SNIPER_BURST_RANGE_MUL
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


## 시우(f_storm) — 원문 effect:'rain', 전우와 같은 단순 정면 재해석.
func _cast_flier_storm() -> void:
	var lv := StorySaveState.skill_level("f_storm")
	if lv <= 0 or _cd_flier_storm > 0.0 or mp < StoryCombat.FLIER_STORM_COST:
		return
	_cd_flier_storm = StoryCombat.FLIER_STORM_CD
	mp -= StoryCombat.FLIER_STORM_COST
	_play_anim("sprint")
	_melee_hit(ATTACK_RANGE, StoryCombat.skill_mul(StoryCombat.FLIER_STORM_BASE, StoryCombat.FLIER_STORM_PER, lv))


## 파천시(f_pierce) — bolt. 일점사와 같은 재해석(사거리 2배).
func _cast_flier_pierce() -> void:
	var lv := StorySaveState.skill_level("f_pierce")
	if lv <= 0 or _cd_flier_pierce > 0.0 or mp < StoryCombat.FLIER_PIERCE_COST:
		return
	_cd_flier_pierce = StoryCombat.FLIER_PIERCE_CD
	mp -= StoryCombat.FLIER_PIERCE_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.FLIER_PIERCE_BASE, StoryCombat.FLIER_PIERCE_PER, lv)
	_melee_hit(ATTACK_RANGE * StoryCombat.FLIER_PIERCE_RANGE_MUL, mul)


## 만시(f_volley) — volley(shots:8). 분시와 같은 재해석.
func _cast_flier_volley() -> void:
	var lv := StorySaveState.skill_level("f_volley")
	if lv <= 0 or _cd_flier_volley > 0.0 or mp < StoryCombat.FLIER_VOLLEY_COST:
		return
	_cd_flier_volley = StoryCombat.FLIER_VOLLEY_CD
	mp -= StoryCombat.FLIER_VOLLEY_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.FLIER_VOLLEY_BASE, StoryCombat.FLIER_VOLLEY_PER, lv)
	for i in StoryCombat.FLIER_VOLLEY_SHOTS:
		_melee_hit(ATTACK_RANGE, mul)


## 정심(f_focus) — buff, 대미지 없음. 이 포트 job 버프 중 처음으로
## 이동속도(_job_buff_speed_mul)도 함께 채운다.
func _cast_flier_focus() -> void:
	if StorySaveState.skill_level("f_focus") <= 0 or _cd_flier_focus > 0.0 or mp < StoryCombat.FLIER_FOCUS_COST:
		return
	_cd_flier_focus = StoryCombat.FLIER_FOCUS_CD
	mp -= StoryCombat.FLIER_FOCUS_COST
	_job_buff_time_left = StoryCombat.FLIER_FOCUS_SEC
	_job_buff_atk_mul = StoryCombat.FLIER_FOCUS_ATK_MUL
	_job_buff_guard = 0.0
	_job_buff_regen_mul = 1.0
	_job_buff_speed_mul = StoryCombat.FLIER_FOCUS_SPEED_MUL


## 답공사(f_retreat) — dash, 활보사와 같은 재해석(뒤로 물러난다).
func _cast_flier_retreat() -> void:
	var lv := StorySaveState.skill_level("f_retreat")
	if lv <= 0 or _cd_flier_retreat > 0.0 or mp < StoryCombat.FLIER_RETREAT_COST:
		return
	_cd_flier_retreat = StoryCombat.FLIER_RETREAT_CD
	mp -= StoryCombat.FLIER_RETREAT_COST
	_play_anim("sprint")
	var dist_m := StoryCombat.flier_retreat_dist_m()
	_melee_hit(dist_m, StoryCombat.skill_mul(StoryCombat.FLIER_RETREAT_BASE, StoryCombat.FLIER_RETREAT_PER, lv))
	global_position.x -= dist_m * _facing


## 천환시(f_burst) — aoe, r:175px.
func _cast_flier_burst() -> void:
	var lv := StorySaveState.skill_level("f_burst")
	if lv <= 0 or _cd_flier_burst > 0.0 or mp < StoryCombat.FLIER_BURST_COST:
		return
	_cd_flier_burst = StoryCombat.FLIER_BURST_CD
	mp -= StoryCombat.FLIER_BURST_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.FLIER_BURST_BASE, StoryCombat.FLIER_BURST_PER, lv)
	var range_m := ATTACK_RANGE * StoryCombat.FLIER_BURST_RANGE_MUL
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


## 천사우(h_tempest) — 원문 effect:'rain', 시우와 같은 단순 정면 재해석.
func _cast_falcon_tempest() -> void:
	var lv := StorySaveState.skill_level("h_tempest")
	if lv <= 0 or _cd_falcon_tempest > 0.0 or mp < StoryCombat.FALCON_TEMPEST_COST:
		return
	_cd_falcon_tempest = StoryCombat.FALCON_TEMPEST_CD
	mp -= StoryCombat.FALCON_TEMPEST_COST
	_play_anim("sprint")
	_melee_hit(ATTACK_RANGE, StoryCombat.skill_mul(StoryCombat.FALCON_TEMPEST_BASE, StoryCombat.FALCON_TEMPEST_PER, lv))


## 광시(h_ray) — bolt. 파천시와 같은 재해석(사거리 2배).
func _cast_falcon_ray() -> void:
	var lv := StorySaveState.skill_level("h_ray")
	if lv <= 0 or _cd_falcon_ray > 0.0 or mp < StoryCombat.FALCON_RAY_COST:
		return
	_cd_falcon_ray = StoryCombat.FALCON_RAY_CD
	mp -= StoryCombat.FALCON_RAY_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.FALCON_RAY_BASE, StoryCombat.FALCON_RAY_PER, lv)
	_melee_hit(ATTACK_RANGE * StoryCombat.FALCON_RAY_RANGE_MUL, mul)


## 십이시(h_swarm) — volley(shots:12). 만시와 같은 재해석.
func _cast_falcon_swarm() -> void:
	var lv := StorySaveState.skill_level("h_swarm")
	if lv <= 0 or _cd_falcon_swarm > 0.0 or mp < StoryCombat.FALCON_SWARM_COST:
		return
	_cd_falcon_swarm = StoryCombat.FALCON_SWARM_CD
	mp -= StoryCombat.FALCON_SWARM_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.FALCON_SWARM_BASE, StoryCombat.FALCON_SWARM_PER, lv)
	for i in StoryCombat.FALCON_SWARM_SHOTS:
		_melee_hit(ATTACK_RANGE, mul)


## 궁천합(h_zenith) — buff, 대미지 없음. 정심에 이어 두 번째로 이동속도
## 배율(_job_buff_speed_mul)도 함께 채운다.
func _cast_falcon_zenith() -> void:
	if StorySaveState.skill_level("h_zenith") <= 0 or _cd_falcon_zenith > 0.0 or mp < StoryCombat.FALCON_ZENITH_COST:
		return
	_cd_falcon_zenith = StoryCombat.FALCON_ZENITH_CD
	mp -= StoryCombat.FALCON_ZENITH_COST
	_job_buff_time_left = StoryCombat.FALCON_ZENITH_SEC
	_job_buff_atk_mul = StoryCombat.FALCON_ZENITH_ATK_MUL
	_job_buff_guard = 0.0
	_job_buff_regen_mul = 1.0
	_job_buff_speed_mul = StoryCombat.FALCON_ZENITH_SPEED_MUL


## 익보사(h_retreat) — dash, 답공사와 같은 재해석(뒤로 물러난다).
func _cast_falcon_retreat() -> void:
	var lv := StorySaveState.skill_level("h_retreat")
	if lv <= 0 or _cd_falcon_retreat > 0.0 or mp < StoryCombat.FALCON_RETREAT_COST:
		return
	_cd_falcon_retreat = StoryCombat.FALCON_RETREAT_CD
	mp -= StoryCombat.FALCON_RETREAT_COST
	_play_anim("sprint")
	var dist_m := StoryCombat.falcon_retreat_dist_m()
	_melee_hit(dist_m, StoryCombat.skill_mul(StoryCombat.FALCON_RETREAT_BASE, StoryCombat.FALCON_RETREAT_PER, lv))
	global_position.x -= dist_m * _facing


## 극환시(h_burst) — aoe, r:210px.
func _cast_falcon_burst() -> void:
	var lv := StorySaveState.skill_level("h_burst")
	if lv <= 0 or _cd_falcon_burst > 0.0 or mp < StoryCombat.FALCON_BURST_COST:
		return
	_cd_falcon_burst = StoryCombat.FALCON_BURST_CD
	mp -= StoryCombat.FALCON_BURST_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.FALCON_BURST_BASE, StoryCombat.FALCON_BURST_PER, lv)
	var range_m := ATTACK_RANGE * StoryCombat.FALCON_BURST_RANGE_MUL
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


