extends StorySkillsMage

## G-0246 — 4종횡 5차 각성기 여덟(웹 data-job.js 09-30 이식). 상속 사슬: … ← StorySkillsMage ← 이 파일 ← StoryPlayer.
## class_name 을 안 붙인다(.godot 클래스 캐시가 저장소 밖이라 새 이름은 편집기 훑기 전엔 안 잡힌다) — story_player.gd 가 경로로 잇는다.
## 효과는 기존 꼴(4차 사슬 끝 무예와 같은 재해석)만, 그림은 _skill_fx_of(StorySkillMeta fx) 그대로. 입력 story_job_skill5_1·5_2(\ · `).

var _cd_godwar_wrath := 0.0
var _cd_godwar_banner := 0.0
var _cd_skybow_stars := 0.0
var _cd_skybow_sun := 0.0
var _cd_noshadow_afterimage := 0.0
var _cd_noshadow_gate := 0.0
var _cd_voidsage_void := 0.0
var _cd_voidsage_all := 0.0


func _tick_awaken_cd(cd_delta: float) -> void:
	_cd_godwar_wrath = maxf(0.0, _cd_godwar_wrath - cd_delta)
	_cd_godwar_banner = maxf(0.0, _cd_godwar_banner - cd_delta)
	_cd_skybow_stars = maxf(0.0, _cd_skybow_stars - cd_delta)
	_cd_skybow_sun = maxf(0.0, _cd_skybow_sun - cd_delta)
	_cd_noshadow_afterimage = maxf(0.0, _cd_noshadow_afterimage - cd_delta)
	_cd_noshadow_gate = maxf(0.0, _cd_noshadow_gate - cd_delta)
	_cd_voidsage_void = maxf(0.0, _cd_voidsage_void - cd_delta)
	_cd_voidsage_all = maxf(0.0, _cd_voidsage_all - cd_delta)


## 5차 입력 — 4차 분기(`if chain.has("warlord") … elif`)와 별개 입력이라 따로 본다. 5차 사슬에도 4차 키가 들어 있어
## (godwar → [godwar, warlord, marshal, general, warrior]) 4차 무예는 그 분기에서 그대로 나간다.
func _awaken_input(chain: Array) -> void:
	var a1 := Input.is_action_just_pressed("story_job_skill5_1")
	var a2 := Input.is_action_just_pressed("story_job_skill5_2")
	if not (a1 or a2):
		return
	if chain.has("godwar"):
		if a1:
			_cast_godwar_wrath()
		if a2:
			_cast_godwar_banner()
	elif chain.has("skybow"):
		if a1:
			_cast_skybow_stars()
		if a2:
			_cast_skybow_sun()
	elif chain.has("noshadow"):
		if a1:
			_cast_noshadow_afterimage()
		if a2:
			_cast_noshadow_gate()
	elif chain.has("voidsage"):
		if a1:
			_cast_voidsage_void()
		if a2:
			_cast_voidsage_all()


## 천멸격(p_wrath) — melee, hits:5. 파멸격과 같은 재해석.
func _cast_godwar_wrath() -> void:
	var lv := StorySaveState.skill_level("p_wrath")
	if lv <= 0 or _cd_godwar_wrath > 0.0 or mp < StoryCombat.GODWAR_WRATH_COST:
		return
	_cd_godwar_wrath = StoryCombat.GODWAR_WRATH_CD
	mp -= StoryCombat.GODWAR_WRATH_COST
	_skill_fx_of("p_wrath")
	_skill_pose("godwar_wrath")
	var mul := StoryCombat.skill_mul(StoryCombat.GODWAR_WRATH_BASE, StoryCombat.GODWAR_WRATH_PER, lv)
	for i in StoryCombat.GODWAR_WRATH_HITS:
		_melee_hit(ATTACK_RANGE, mul)


## 군신강림(p_banner) — buff, 대미지 없음. 패천기와 같은 자리.
func _cast_godwar_banner() -> void:
	if StorySaveState.skill_level("p_banner") <= 0 or _cd_godwar_banner > 0.0 or mp < StoryCombat.GODWAR_BANNER_COST:
		return
	_cd_godwar_banner = StoryCombat.GODWAR_BANNER_CD
	mp -= StoryCombat.GODWAR_BANNER_COST
	_skill_fx_of("p_banner")
	_job_buff_time_left = StoryCombat.GODWAR_BANNER_SEC
	_job_buff_atk_mul = StoryCombat.GODWAR_BANNER_ATK_MUL
	_job_buff_guard = StoryCombat.GODWAR_BANNER_GUARD
	_job_buff_regen_mul = StoryCombat.GODWAR_BANNER_REGEN_MUL
	_job_buff_speed_mul = 1.0


## 성궁만천(p_stars) — volley(shots:16). 십이시와 같은 재해석.
func _cast_skybow_stars() -> void:
	var lv := StorySaveState.skill_level("p_stars")
	if lv <= 0 or _cd_skybow_stars > 0.0 or mp < StoryCombat.SKYBOW_STARS_COST:
		return
	_cd_skybow_stars = StoryCombat.SKYBOW_STARS_CD
	mp -= StoryCombat.SKYBOW_STARS_COST
	_skill_fx_of("p_stars")
	_skill_pose("skybow_stars")
	var mul := StoryCombat.skill_mul(StoryCombat.SKYBOW_STARS_BASE, StoryCombat.SKYBOW_STARS_PER, lv)
	for i in StoryCombat.SKYBOW_STARS_SHOTS:
		_melee_hit(ATTACK_RANGE, mul)


## 일월시(p_sun) — bolt. 광시와 같은 재해석(사거리 2배).
func _cast_skybow_sun() -> void:
	var lv := StorySaveState.skill_level("p_sun")
	if lv <= 0 or _cd_skybow_sun > 0.0 or mp < StoryCombat.SKYBOW_SUN_COST:
		return
	_cd_skybow_sun = StoryCombat.SKYBOW_SUN_CD
	mp -= StoryCombat.SKYBOW_SUN_COST
	_skill_fx_of("p_sun")
	_skill_pose("skybow_sun")
	var mul := StoryCombat.skill_mul(StoryCombat.SKYBOW_SUN_BASE, StoryCombat.SKYBOW_SUN_PER, lv)
	_melee_hit(ATTACK_RANGE * StoryCombat.SKYBOW_SUN_RANGE_MUL, mul)


## 무영참(p_afterimage) — melee, hits:12. 팔도와 같은 재해석.
func _cast_noshadow_afterimage() -> void:
	var lv := StorySaveState.skill_level("p_afterimage")
	if lv <= 0 or _cd_noshadow_afterimage > 0.0 or mp < StoryCombat.NOSHADOW_AFTERIMAGE_COST:
		return
	_cd_noshadow_afterimage = StoryCombat.NOSHADOW_AFTERIMAGE_CD
	mp -= StoryCombat.NOSHADOW_AFTERIMAGE_COST
	_skill_fx_of("p_afterimage")
	_skill_pose("noshadow_afterimage")
	var mul := StoryCombat.skill_mul(StoryCombat.NOSHADOW_AFTERIMAGE_BASE, StoryCombat.NOSHADOW_AFTERIMAGE_PER, lv)
	for i in StoryCombat.NOSHADOW_AFTERIMAGE_HITS:
		_melee_hit(ATTACK_RANGE, mul)


## 유명문(p_gate) — dash + invuln:2. 명계보와 같은 재해석.
func _cast_noshadow_gate() -> void:
	var lv := StorySaveState.skill_level("p_gate")
	if lv <= 0 or _cd_noshadow_gate > 0.0 or mp < StoryCombat.NOSHADOW_GATE_COST:
		return
	_cd_noshadow_gate = StoryCombat.NOSHADOW_GATE_CD
	mp -= StoryCombat.NOSHADOW_GATE_COST
	_skill_fx_of("p_gate")
	_skill_pose("noshadow_gate")
	var dist_m := StoryCombat.noshadow_gate_dist_m()
	_melee_hit(dist_m, StoryCombat.skill_mul(StoryCombat.NOSHADOW_GATE_BASE, StoryCombat.NOSHADOW_GATE_PER, lv))
	global_position.x += dist_m * _facing
	_invuln_time_left = maxf(_invuln_time_left, StoryCombat.NOSHADOW_GATE_INVULN_SEC)


## 태허붕(p_void) — aoe, r:380px. 건곤붕과 같은 재해석.
func _cast_voidsage_void() -> void:
	var lv := StorySaveState.skill_level("p_void")
	if lv <= 0 or _cd_voidsage_void > 0.0 or mp < StoryCombat.VOIDSAGE_VOID_COST:
		return
	_cd_voidsage_void = StoryCombat.VOIDSAGE_VOID_CD
	mp -= StoryCombat.VOIDSAGE_VOID_COST
	_skill_pose("voidsage_void")
	var mul := StoryCombat.skill_mul(StoryCombat.VOIDSAGE_VOID_BASE, StoryCombat.VOIDSAGE_VOID_PER, lv)
	var range_m := ATTACK_RANGE * StoryCombat.VOIDSAGE_VOID_RANGE_MUL
	_skill_fx_of("p_void", range_m)
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
		_hit_feel(e, roll)


## 만상환생(p_all) — heal. 환생과 같은 공식(체력 80%+).
func _cast_voidsage_all() -> void:
	var lv := StorySaveState.skill_level("p_all")
	if lv <= 0 or _cd_voidsage_all > 0.0 or mp < StoryCombat.VOIDSAGE_ALL_COST:
		return
	_cd_voidsage_all = StoryCombat.VOIDSAGE_ALL_CD
	mp -= StoryCombat.VOIDSAGE_ALL_COST
	_skill_fx_of("p_all")
	var pct := StoryCombat.skill_mul(StoryCombat.VOIDSAGE_ALL_BASE, StoryCombat.VOIDSAGE_ALL_PER, lv)
	hp = clampf(hp + max_hp * pct, 0.0, max_hp)
