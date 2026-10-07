class_name StorySkillsWarrior
extends StoryPlayerBase

## 사가종횡 무예 — 무사 갈래(무사·장군·원수·패왕) `_cast_*`. 상속 사슬: StoryPlayerBase ← StorySkillsWarrior ← StorySkillsArcher ← StorySkillsRogue ← StorySkillsMage ← StoryPlayer (G-0007: 부모는 자식 함수를 못 부르니 피호출 헬퍼가 아래).

## 참격(w_cut) — 연참과 같은 정면 판정, 사거리도 같다(원문에 별도
## 사거리가 없다). mul은 투자 레벨을 따른다(**2026-09-13 추가 — SP
## 투자**: 안 배웠으면(레벨0) 캐스팅 자체를 조용히 무시한다, job.js
## bar()가 "찍은 것만" 놓는 것과 같은 자리).
func _cast_warrior_cut() -> void:
	var lv := StorySaveState.skill_level("w_cut")
	if lv <= 0 or _cd_warrior_cut > 0.0 or mp < StoryCombat.WARRIOR_CUT_COST:
		return
	_cd_warrior_cut = StoryCombat.WARRIOR_CUT_CD
	mp -= StoryCombat.WARRIOR_CUT_COST
	_play_anim("sprint")
	_melee_hit(ATTACK_RANGE, StoryCombat.skill_mul(StoryCombat.WARRIOR_CUT_BASE, StoryCombat.WARRIOR_CUT_PER, lv))


## 선풍(w_whirl) — aoe, 횡소(_cast_sweep)와 같은 360도 판정 구조.
func _cast_warrior_whirl() -> void:
	var lv := StorySaveState.skill_level("w_whirl")
	if lv <= 0 or _cd_warrior_whirl > 0.0 or mp < StoryCombat.WARRIOR_WHIRL_COST:
		return
	_cd_warrior_whirl = StoryCombat.WARRIOR_WHIRL_CD
	mp -= StoryCombat.WARRIOR_WHIRL_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.WARRIOR_WHIRL_BASE, StoryCombat.WARRIOR_WHIRL_PER, lv)
	var range_m := ATTACK_RANGE * StoryCombat.WARRIOR_WHIRL_RANGE_MUL
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


## 돌진(w_rush) — dash. 이 슬라이스엔 원문처럼 부드러운 이동 애니메이션을
## 새로 안 짜고(재해석), **먼저 이동 경로 위 적을 때린 뒤 그 자리로
## 순간이동**한다(때리고 지나간 결과만 재현 — 다치는 적 판정이 이동
## 전/후로 갈리는 걸 피하려고 이 순서를 골랐다). 벽·구덩이 충돌은 이번
## 슬라이스에서 확인하지 않는다(다음에 볼 자리).
func _cast_warrior_rush() -> void:
	var lv := StorySaveState.skill_level("w_rush")
	if lv <= 0 or _cd_warrior_rush > 0.0 or mp < StoryCombat.WARRIOR_RUSH_COST:
		return
	_cd_warrior_rush = StoryCombat.WARRIOR_RUSH_CD
	mp -= StoryCombat.WARRIOR_RUSH_COST
	_play_anim("sprint")
	var dist_m := StoryCombat.warrior_rush_dist_m()
	_melee_hit(dist_m, StoryCombat.skill_mul(StoryCombat.WARRIOR_RUSH_BASE, StoryCombat.WARRIOR_RUSH_PER, lv))
	global_position.x += dist_m * _facing


## 철갑(w_iron) — buff, 대미지 없음. 기합(brace)과 별개 타이머(위 변수
## 선언부 참고) — _effective_atk()가 곱하고, take_damage()가 guard를 뺀다.
## buff 성분(atk×1.2·guard0.35)은 원문에 레벨 항이 없어(mul:[0,0]) 투자
## 레벨과 무관하게 고정 — "배웠는지"만 확인한다.
func _cast_warrior_iron() -> void:
	if StorySaveState.skill_level("w_iron") <= 0 or _cd_warrior_iron > 0.0 or mp < StoryCombat.WARRIOR_IRON_COST:
		return
	_cd_warrior_iron = StoryCombat.WARRIOR_IRON_CD
	mp -= StoryCombat.WARRIOR_IRON_COST
	_job_buff_time_left = StoryCombat.WARRIOR_IRON_SEC
	_job_buff_atk_mul = StoryCombat.WARRIOR_IRON_ATK_MUL
	_job_buff_guard = StoryCombat.WARRIOR_IRON_GUARD
	_job_buff_regen_mul = 1.0
	_job_buff_speed_mul = 1.0


## 파공검(w_edge) — bolt. 기탄과 같은 재해석(사거리 2배).
func _cast_warrior_edge() -> void:
	var lv := StorySaveState.skill_level("w_edge")
	if lv <= 0 or _cd_warrior_edge > 0.0 or mp < StoryCombat.WARRIOR_EDGE_COST:
		return
	_cd_warrior_edge = StoryCombat.WARRIOR_EDGE_CD
	mp -= StoryCombat.WARRIOR_EDGE_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.WARRIOR_EDGE_BASE, StoryCombat.WARRIOR_EDGE_PER, lv)
	_melee_hit(ATTACK_RANGE * StoryCombat.WARRIOR_EDGE_RANGE_MUL, mul)


## 생기결(w_vital) — heal. 치유(m_heal)와 같은 공식.
func _cast_warrior_vital() -> void:
	var lv := StorySaveState.skill_level("w_vital")
	if lv <= 0 or _cd_warrior_vital > 0.0 or mp < StoryCombat.WARRIOR_VITAL_COST:
		return
	_cd_warrior_vital = StoryCombat.WARRIOR_VITAL_CD
	mp -= StoryCombat.WARRIOR_VITAL_COST
	var pct := StoryCombat.skill_mul(StoryCombat.WARRIOR_VITAL_BASE, StoryCombat.WARRIOR_VITAL_PER, lv)
	hp = clampf(hp + max_hp * pct, 0.0, max_hp)


## 패왕격(g_smash) — melee, hits:2. 참격(w_cut)과 같은 정면 판정.
func _cast_general_smash() -> void:
	var lv := StorySaveState.skill_level("g_smash")
	if lv <= 0 or _cd_general_smash > 0.0 or mp < StoryCombat.GENERAL_SMASH_COST:
		return
	_cd_general_smash = StoryCombat.GENERAL_SMASH_CD
	mp -= StoryCombat.GENERAL_SMASH_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.GENERAL_SMASH_BASE, StoryCombat.GENERAL_SMASH_PER, lv)
	for i in StoryCombat.GENERAL_SMASH_HITS:
		_melee_hit(ATTACK_RANGE, mul)


## 함성(g_roar) — aoe, r:190px.
func _cast_general_roar() -> void:
	var lv := StorySaveState.skill_level("g_roar")
	if lv <= 0 or _cd_general_roar > 0.0 or mp < StoryCombat.GENERAL_ROAR_COST:
		return
	_cd_general_roar = StoryCombat.GENERAL_ROAR_CD
	mp -= StoryCombat.GENERAL_ROAR_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.GENERAL_ROAR_BASE, StoryCombat.GENERAL_ROAR_PER, lv)
	var range_m := ATTACK_RANGE * StoryCombat.GENERAL_ROAR_RANGE_MUL
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


## 철벽(g_wall) — buff, 대미지 없음.
func _cast_general_wall() -> void:
	if StorySaveState.skill_level("g_wall") <= 0 or _cd_general_wall > 0.0 or mp < StoryCombat.GENERAL_WALL_COST:
		return
	_cd_general_wall = StoryCombat.GENERAL_WALL_CD
	mp -= StoryCombat.GENERAL_WALL_COST
	_job_buff_time_left = StoryCombat.GENERAL_WALL_SEC
	_job_buff_atk_mul = StoryCombat.GENERAL_WALL_ATK_MUL
	_job_buff_guard = StoryCombat.GENERAL_WALL_GUARD
	_job_buff_regen_mul = 1.0
	_job_buff_speed_mul = 1.0


## 벽공검(g_edge) — bolt. 파공검과 같은 재해석(사거리 2배).
func _cast_general_edge() -> void:
	var lv := StorySaveState.skill_level("g_edge")
	if lv <= 0 or _cd_general_edge > 0.0 or mp < StoryCombat.GENERAL_EDGE_COST:
		return
	_cd_general_edge = StoryCombat.GENERAL_EDGE_CD
	mp -= StoryCombat.GENERAL_EDGE_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.GENERAL_EDGE_BASE, StoryCombat.GENERAL_EDGE_PER, lv)
	_melee_hit(ATTACK_RANGE * StoryCombat.GENERAL_EDGE_RANGE_MUL, mul)


## 회천결(g_vital) — heal. 생기결과 같은 공식.
func _cast_general_vital() -> void:
	var lv := StorySaveState.skill_level("g_vital")
	if lv <= 0 or _cd_general_vital > 0.0 or mp < StoryCombat.GENERAL_VITAL_COST:
		return
	_cd_general_vital = StoryCombat.GENERAL_VITAL_CD
	mp -= StoryCombat.GENERAL_VITAL_COST
	var pct := StoryCombat.skill_mul(StoryCombat.GENERAL_VITAL_BASE, StoryCombat.GENERAL_VITAL_PER, lv)
	hp = clampf(hp + max_hp * pct, 0.0, max_hp)


## 천붕격(n_heaven) — melee, hits:3.
func _cast_marshal_heaven() -> void:
	var lv := StorySaveState.skill_level("n_heaven")
	if lv <= 0 or _cd_marshal_heaven > 0.0 or mp < StoryCombat.MARSHAL_HEAVEN_COST:
		return
	_cd_marshal_heaven = StoryCombat.MARSHAL_HEAVEN_CD
	mp -= StoryCombat.MARSHAL_HEAVEN_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.MARSHAL_HEAVEN_BASE, StoryCombat.MARSHAL_HEAVEN_PER, lv)
	for i in StoryCombat.MARSHAL_HEAVEN_HITS:
		_melee_hit(ATTACK_RANGE, mul)


## 진각(n_quake) — aoe, r:264px.
func _cast_marshal_quake() -> void:
	var lv := StorySaveState.skill_level("n_quake")
	if lv <= 0 or _cd_marshal_quake > 0.0 or mp < StoryCombat.MARSHAL_QUAKE_COST:
		return
	_cd_marshal_quake = StoryCombat.MARSHAL_QUAKE_CD
	mp -= StoryCombat.MARSHAL_QUAKE_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.MARSHAL_QUAKE_BASE, StoryCombat.MARSHAL_QUAKE_PER, lv)
	var range_m := ATTACK_RANGE * StoryCombat.MARSHAL_QUAKE_RANGE_MUL
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


## 철기돌격(n_charge) — dash, dist:330px.
func _cast_marshal_charge() -> void:
	var lv := StorySaveState.skill_level("n_charge")
	if lv <= 0 or _cd_marshal_charge > 0.0 or mp < StoryCombat.MARSHAL_CHARGE_COST:
		return
	_cd_marshal_charge = StoryCombat.MARSHAL_CHARGE_CD
	mp -= StoryCombat.MARSHAL_CHARGE_COST
	_play_anim("sprint")
	var dist_m := StoryCombat.marshal_charge_dist_m()
	_melee_hit(dist_m, StoryCombat.skill_mul(StoryCombat.MARSHAL_CHARGE_BASE, StoryCombat.MARSHAL_CHARGE_PER, lv))
	global_position.x += dist_m * _facing


## 대장기(n_banner) — buff, 대미지 없음.
func _cast_marshal_banner() -> void:
	if StorySaveState.skill_level("n_banner") <= 0 or _cd_marshal_banner > 0.0 or mp < StoryCombat.MARSHAL_BANNER_COST:
		return
	_cd_marshal_banner = StoryCombat.MARSHAL_BANNER_CD
	mp -= StoryCombat.MARSHAL_BANNER_COST
	_job_buff_time_left = StoryCombat.MARSHAL_BANNER_SEC
	_job_buff_atk_mul = StoryCombat.MARSHAL_BANNER_ATK_MUL
	_job_buff_guard = StoryCombat.MARSHAL_BANNER_GUARD
	_job_buff_regen_mul = StoryCombat.MARSHAL_BANNER_REGEN_MUL
	_job_buff_speed_mul = 1.0


## 천단검(n_edge) — bolt. 벽공검과 같은 재해석(사거리 2배).
func _cast_marshal_edge() -> void:
	var lv := StorySaveState.skill_level("n_edge")
	if lv <= 0 or _cd_marshal_edge > 0.0 or mp < StoryCombat.MARSHAL_EDGE_COST:
		return
	_cd_marshal_edge = StoryCombat.MARSHAL_EDGE_CD
	mp -= StoryCombat.MARSHAL_EDGE_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.MARSHAL_EDGE_BASE, StoryCombat.MARSHAL_EDGE_PER, lv)
	_melee_hit(ATTACK_RANGE * StoryCombat.MARSHAL_EDGE_RANGE_MUL, mul)


## 불사결(n_vital) — heal.
func _cast_marshal_vital() -> void:
	var lv := StorySaveState.skill_level("n_vital")
	if lv <= 0 or _cd_marshal_vital > 0.0 or mp < StoryCombat.MARSHAL_VITAL_COST:
		return
	_cd_marshal_vital = StoryCombat.MARSHAL_VITAL_CD
	mp -= StoryCombat.MARSHAL_VITAL_COST
	var pct := StoryCombat.skill_mul(StoryCombat.MARSHAL_VITAL_BASE, StoryCombat.MARSHAL_VITAL_PER, lv)
	hp = clampf(hp + max_hp * pct, 0.0, max_hp)


## 파멸격(o_ruin) — melee, hits:4.
func _cast_warlord_ruin() -> void:
	var lv := StorySaveState.skill_level("o_ruin")
	if lv <= 0 or _cd_warlord_ruin > 0.0 or mp < StoryCombat.WARLORD_RUIN_COST:
		return
	_cd_warlord_ruin = StoryCombat.WARLORD_RUIN_CD
	mp -= StoryCombat.WARLORD_RUIN_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.WARLORD_RUIN_BASE, StoryCombat.WARLORD_RUIN_PER, lv)
	for i in StoryCombat.WARLORD_RUIN_HITS:
		_melee_hit(ATTACK_RANGE, mul)


## 지열(o_tremor) — aoe, r:340px.
func _cast_warlord_tremor() -> void:
	var lv := StorySaveState.skill_level("o_tremor")
	if lv <= 0 or _cd_warlord_tremor > 0.0 or mp < StoryCombat.WARLORD_TREMOR_COST:
		return
	_cd_warlord_tremor = StoryCombat.WARLORD_TREMOR_CD
	mp -= StoryCombat.WARLORD_TREMOR_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.WARLORD_TREMOR_BASE, StoryCombat.WARLORD_TREMOR_PER, lv)
	var range_m := ATTACK_RANGE * StoryCombat.WARLORD_TREMOR_RANGE_MUL
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


## 벽력돌(o_smite) — dash, dist:410px.
func _cast_warlord_smite() -> void:
	var lv := StorySaveState.skill_level("o_smite")
	if lv <= 0 or _cd_warlord_smite > 0.0 or mp < StoryCombat.WARLORD_SMITE_COST:
		return
	_cd_warlord_smite = StoryCombat.WARLORD_SMITE_CD
	mp -= StoryCombat.WARLORD_SMITE_COST
	_play_anim("sprint")
	var dist_m := StoryCombat.warlord_smite_dist_m()
	_melee_hit(dist_m, StoryCombat.skill_mul(StoryCombat.WARLORD_SMITE_BASE, StoryCombat.WARLORD_SMITE_PER, lv))
	global_position.x += dist_m * _facing


## 패천기(o_conquer) — buff, 대미지 없음.
func _cast_warlord_conquer() -> void:
	if StorySaveState.skill_level("o_conquer") <= 0 or _cd_warlord_conquer > 0.0 or mp < StoryCombat.WARLORD_CONQUER_COST:
		return
	_cd_warlord_conquer = StoryCombat.WARLORD_CONQUER_CD
	mp -= StoryCombat.WARLORD_CONQUER_COST
	_job_buff_time_left = StoryCombat.WARLORD_CONQUER_SEC
	_job_buff_atk_mul = StoryCombat.WARLORD_CONQUER_ATK_MUL
	_job_buff_guard = StoryCombat.WARLORD_CONQUER_GUARD
	_job_buff_regen_mul = StoryCombat.WARLORD_CONQUER_REGEN_MUL
	_job_buff_speed_mul = 1.0


## 파천검(o_edge) — bolt. 천단검과 같은 재해석(사거리 2배).
func _cast_warlord_edge() -> void:
	var lv := StorySaveState.skill_level("o_edge")
	if lv <= 0 or _cd_warlord_edge > 0.0 or mp < StoryCombat.WARLORD_EDGE_COST:
		return
	_cd_warlord_edge = StoryCombat.WARLORD_EDGE_CD
	mp -= StoryCombat.WARLORD_EDGE_COST
	_play_anim("sprint")
	var mul := StoryCombat.skill_mul(StoryCombat.WARLORD_EDGE_BASE, StoryCombat.WARLORD_EDGE_PER, lv)
	_melee_hit(ATTACK_RANGE * StoryCombat.WARLORD_EDGE_RANGE_MUL, mul)


## 재생결(o_vital) — heal.
func _cast_warlord_vital() -> void:
	var lv := StorySaveState.skill_level("o_vital")
	if lv <= 0 or _cd_warlord_vital > 0.0 or mp < StoryCombat.WARLORD_VITAL_COST:
		return
	_cd_warlord_vital = StoryCombat.WARLORD_VITAL_CD
	mp -= StoryCombat.WARLORD_VITAL_COST
	var pct := StoryCombat.skill_mul(StoryCombat.WARLORD_VITAL_BASE, StoryCombat.WARLORD_VITAL_PER, lv)
	hp = clampf(hp + max_hp * pct, 0.0, max_hp)


