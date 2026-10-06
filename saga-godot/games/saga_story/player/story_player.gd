extends StorySkillsMage

const VroidBody := preload("res://saga_core/world/vroid_body.gd")

## 사가스토리 플레이어 코어 — 이동·피해·상태·_physics_process. 상태 변수는 story_player_base.gd, 무예 `_cast_*` 는 story_skills_*.gd (상속 사슬, G-0007).

## side.js hurtMe()의 gear.cut(power().def) 그대로 — 방어구 def 합으로
## 받는 피해를 줄인다(story_combat.gd damage_cut() 참고). 철갑(iron)이
## 걸려 있으면 그 위에 guard(0.35)만큼 한 번 더 줄인다(방어구 컷과는
## 별개의 곱 — "9초간 덜 맞는다"는 원문 buff.guard를 그대로 얹은 것).
func take_damage(amount: float) -> void:
	if amount <= 0.0:
		return
	if _invuln_time_left > 0.0:
		return
	## PLAN 101-2 STORY ③후보 — 무사 받아치기(w_parry). 판정 창 안에 맞으면
	## 무효화하고 다음 공격에 배율을 건다(`_effective_atk()`가 소비한다).
	if _parry_time_left > 0.0:
		_parry_time_left = 0.0
		_signature_next_mul = StoryCombat.WARRIOR_PARRY_NEXT_MUL
		return
	var def: float = float(StorySaveState.gear_totals().def)
	var cut: float = StoryCombat.damage_cut(def)
	## **2026-09-13 추가(같은 날 더 더)** — 캐스팅 시점에 저장해 둔
	## `_job_buff_guard`를 그대로 쓴다(변수 선언부 머리말 참고, tier2
	## 버프가 생기며 chain만으로는 어느 버프가 걸렸는지 구분이 안 된다).
	var guard_mul: float = (1.0 - _job_buff_guard) if _job_buff_time_left > 0.0 else 1.0
	## PLAN 101-2 STORY ⑤(비경) — 방어 축 은사(철벽)의 dmg_taken_mult(),
	## 회차 밖이면 boons가 비어 있어 1.0(무해).
	hp = clampf(hp - amount * (1.0 - cut) * guard_mul * StoryLabyrinthState.dmg_taken_mult(), 0.0, max_hp)


## PLAN 101-2 STORY ⑤(비경) — StoryLabyrinthState가 healOnPick·healOnClear를
## 적용할 때 부르는 공개 헬퍼. pct는 0~1 분수(기존 스킬들의 heal 계산과
## 같은 단위, story_combat.gd skill_mul() 결과와 동일하게 소수로 받는다).
func heal_pct(pct: float) -> void:
	if pct <= 0.0:
		return
	hp = clampf(hp + max_hp * pct, 0.0, max_hp)


func _ready() -> void:
	if body_id != "":   # G-0030 — 새 인물 몸으로
		visual = VroidBody.wear(visual, body_id)
		_anim = visual.find_child("AnimationPlayer", true, false)
	visual.rotation.y = PI * 0.5  # 오른쪽(+X)을 보고 시작 — StoryPlayer.tscn 참고
	_play_anim("idle")
	CelShaderApply.apply_to(visual)
	## PLAN 102-4 — GO/DUNGEON/FOREST는 games/saga_go/player/player.gd를
	## 같이 쓰는 덕에 09-21 그림자 연결이 이미 셋 다 적용됐다. STORY만
	## story_player.gd가 따로라 여기 한 줄 더 필요(캡슐 반지름 0.6이라
	## GO보다 살짝 크게).
	var shadow := BlobShadow.make_decal(0.7)
	shadow.position = Vector3(0, 0.15, 0)
	add_child(shadow)
	var mount_node := Node3D.new()
	mount_node.set_script(load("res://saga_core/player/mount.gd"))
	add_child(mount_node)


func _physics_process(delta: float) -> void:
	_attack_cd_left = maxf(0.0, _attack_cd_left - delta)
	_cd_sweep = maxf(0.0, _cd_sweep - delta)
	_cd_bolt = maxf(0.0, _cd_bolt - delta)
	_cd_brace = maxf(0.0, _cd_brace - delta)
	_buff_time_left = maxf(0.0, _buff_time_left - delta)
	_cd_warrior_cut = maxf(0.0, _cd_warrior_cut - delta)
	_cd_warrior_whirl = maxf(0.0, _cd_warrior_whirl - delta)
	_cd_warrior_rush = maxf(0.0, _cd_warrior_rush - delta)
	_cd_warrior_iron = maxf(0.0, _cd_warrior_iron - delta)
	_cd_archer_shot = maxf(0.0, _cd_archer_shot - delta)
	_cd_archer_double = maxf(0.0, _cd_archer_double - delta)
	_cd_archer_pierce = maxf(0.0, _cd_archer_pierce - delta)
	_cd_archer_eye = maxf(0.0, _cd_archer_eye - delta)
	_cd_rogue_twin = maxf(0.0, _cd_rogue_twin - delta)
	_cd_rogue_knife = maxf(0.0, _cd_rogue_knife - delta)
	_cd_rogue_step = maxf(0.0, _cd_rogue_step - delta)
	_cd_rogue_vital = maxf(0.0, _cd_rogue_vital - delta)
	_invuln_time_left = maxf(0.0, _invuln_time_left - delta)
	_dash_cd_left = maxf(0.0, _dash_cd_left - delta)
	_signature_cd_left = maxf(0.0, _signature_cd_left - delta)
	_parry_time_left = maxf(0.0, _parry_time_left - delta)
	_cd_mage_fire = maxf(0.0, _cd_mage_fire - delta)
	_cd_mage_bolt = maxf(0.0, _cd_mage_bolt - delta)
	_cd_mage_heal = maxf(0.0, _cd_mage_heal - delta)
	_cd_mage_talis = maxf(0.0, _cd_mage_talis - delta)
	_cd_general_smash = maxf(0.0, _cd_general_smash - delta)
	_cd_general_roar = maxf(0.0, _cd_general_roar - delta)
	_cd_general_wall = maxf(0.0, _cd_general_wall - delta)
	_cd_sniper_rain = maxf(0.0, _cd_sniper_rain - delta)
	_cd_sniper_snipe = maxf(0.0, _cd_sniper_snipe - delta)
	_cd_sniper_split = maxf(0.0, _cd_sniper_split - delta)
	_cd_assassin_storm = maxf(0.0, _cd_assassin_storm - delta)
	_cd_assassin_fan = maxf(0.0, _cd_assassin_fan - delta)
	_cd_assassin_shadow = maxf(0.0, _cd_assassin_shadow - delta)
	_cd_sage_quake = maxf(0.0, _cd_sage_quake - delta)
	_cd_sage_beam = maxf(0.0, _cd_sage_beam - delta)
	_cd_sage_ward = maxf(0.0, _cd_sage_ward - delta)
	_cd_warrior_edge = maxf(0.0, _cd_warrior_edge - delta)
	_cd_warrior_vital = maxf(0.0, _cd_warrior_vital - delta)
	_cd_archer_retreat = maxf(0.0, _cd_archer_retreat - delta)
	_cd_archer_burst = maxf(0.0, _cd_archer_burst - delta)
	_cd_rogue_whirl = maxf(0.0, _cd_rogue_whirl - delta)
	_cd_rogue_dart = maxf(0.0, _cd_rogue_dart - delta)
	_cd_mage_step = maxf(0.0, _cd_mage_step - delta)
	_cd_mage_orb = maxf(0.0, _cd_mage_orb - delta)
	_cd_general_edge = maxf(0.0, _cd_general_edge - delta)
	_cd_general_vital = maxf(0.0, _cd_general_vital - delta)
	_cd_sniper_retreat = maxf(0.0, _cd_sniper_retreat - delta)
	_cd_sniper_burst = maxf(0.0, _cd_sniper_burst - delta)
	_cd_assassin_whirl = maxf(0.0, _cd_assassin_whirl - delta)
	_cd_assassin_dart = maxf(0.0, _cd_assassin_dart - delta)
	_cd_sage_step = maxf(0.0, _cd_sage_step - delta)
	_cd_sage_orb = maxf(0.0, _cd_sage_orb - delta)
	_cd_marshal_heaven = maxf(0.0, _cd_marshal_heaven - delta)
	_cd_marshal_quake = maxf(0.0, _cd_marshal_quake - delta)
	_cd_marshal_charge = maxf(0.0, _cd_marshal_charge - delta)
	_cd_marshal_banner = maxf(0.0, _cd_marshal_banner - delta)
	_cd_marshal_edge = maxf(0.0, _cd_marshal_edge - delta)
	_cd_marshal_vital = maxf(0.0, _cd_marshal_vital - delta)
	_cd_flier_storm = maxf(0.0, _cd_flier_storm - delta)
	_cd_flier_pierce = maxf(0.0, _cd_flier_pierce - delta)
	_cd_flier_volley = maxf(0.0, _cd_flier_volley - delta)
	_cd_flier_focus = maxf(0.0, _cd_flier_focus - delta)
	_cd_flier_retreat = maxf(0.0, _cd_flier_retreat - delta)
	_cd_flier_burst = maxf(0.0, _cd_flier_burst - delta)
	_cd_wraith_blur = maxf(0.0, _cd_wraith_blur - delta)
	_cd_wraith_petal = maxf(0.0, _cd_wraith_petal - delta)
	_cd_wraith_void = maxf(0.0, _cd_wraith_void - delta)
	_cd_wraith_mark = maxf(0.0, _cd_wraith_mark - delta)
	_cd_wraith_whirl = maxf(0.0, _cd_wraith_whirl - delta)
	_cd_wraith_dart = maxf(0.0, _cd_wraith_dart - delta)
	_cd_immortal_meteor = maxf(0.0, _cd_immortal_meteor - delta)
	_cd_immortal_abyss = maxf(0.0, _cd_immortal_abyss - delta)
	_cd_immortal_mend = maxf(0.0, _cd_immortal_mend - delta)
	_cd_immortal_tao = maxf(0.0, _cd_immortal_tao - delta)
	_cd_immortal_step = maxf(0.0, _cd_immortal_step - delta)
	_cd_immortal_orb = maxf(0.0, _cd_immortal_orb - delta)
	_cd_warlord_ruin = maxf(0.0, _cd_warlord_ruin - delta)
	_cd_warlord_tremor = maxf(0.0, _cd_warlord_tremor - delta)
	_cd_warlord_smite = maxf(0.0, _cd_warlord_smite - delta)
	_cd_warlord_conquer = maxf(0.0, _cd_warlord_conquer - delta)
	_cd_warlord_edge = maxf(0.0, _cd_warlord_edge - delta)
	_cd_warlord_vital = maxf(0.0, _cd_warlord_vital - delta)
	_cd_falcon_tempest = maxf(0.0, _cd_falcon_tempest - delta)
	_cd_falcon_ray = maxf(0.0, _cd_falcon_ray - delta)
	_cd_falcon_swarm = maxf(0.0, _cd_falcon_swarm - delta)
	_cd_falcon_zenith = maxf(0.0, _cd_falcon_zenith - delta)
	_cd_falcon_retreat = maxf(0.0, _cd_falcon_retreat - delta)
	_cd_falcon_burst = maxf(0.0, _cd_falcon_burst - delta)
	_cd_reaper_carve = maxf(0.0, _cd_reaper_carve - delta)
	_cd_reaper_bloom = maxf(0.0, _cd_reaper_bloom - delta)
	_cd_reaper_veil = maxf(0.0, _cd_reaper_veil - delta)
	_cd_reaper_curse = maxf(0.0, _cd_reaper_curse - delta)
	_cd_reaper_whirl = maxf(0.0, _cd_reaper_whirl - delta)
	_cd_reaper_dart = maxf(0.0, _cd_reaper_dart - delta)
	_cd_ascendant_starfall = maxf(0.0, _cd_ascendant_starfall - delta)
	_cd_ascendant_collapse = maxf(0.0, _cd_ascendant_collapse - delta)
	_cd_ascendant_rebirth = maxf(0.0, _cd_ascendant_rebirth - delta)
	_cd_ascendant_eternity = maxf(0.0, _cd_ascendant_eternity - delta)
	_cd_ascendant_step = maxf(0.0, _cd_ascendant_step - delta)
	_cd_ascendant_orb = maxf(0.0, _cd_ascendant_orb - delta)
	_job_buff_time_left = maxf(0.0, _job_buff_time_left - delta)
	## m_talis(부적)·p_ward(호신부)가 걸려 있으면 mp 회복이 배로 빨라진다
	## (side.js MP_REGEN*bf.regen과 같은 자리) — 다른 job 버프는 regen이
	## 없다(캐스팅 시점에 `_job_buff_regen_mul`을 1.0으로 채워 둔다).
	## **2026-09-13 추가(같은 날 더 더)** — job을 다시 안 보고 캐스팅
	## 시점에 저장해 둔 값을 그대로 쓴다(변수 선언부 머리말 참고).
	var regen_mul: float = _job_buff_regen_mul if _job_buff_time_left > 0.0 else 1.0
	mp = minf(max_mp, mp + StoryCombat.MP_REGEN * regen_mul * delta)
	_check_rope()

	visual.position.y = ride_height
	if fly_on:
		_story_fly(delta)
	elif _on_rope and _rope_area != null:
		_climb(delta)
	else:
		_walk(delta)

	## 2절 "Z는 이번 슬라이스에서 고정" — 어떤 경로로도 Z가 안 밀리게
	## 매 프레임 되돌린다(바닥·발판 충돌이 얕은 Z폭을 갖다 보니 모서리에서
	## 아주 조금 밀릴 수 있다).
	global_position.z = 0.0

	move_and_slide()
	if fly_on and is_on_floor() and velocity.y <= 0.5:
		fly_on = false

	if Input.is_action_just_pressed("combat_quick") and _attack_cd_left <= 0.0:
		_attack()
	if Input.is_action_just_pressed("story_skill_sweep"):
		_cast_sweep()
	if Input.is_action_just_pressed("story_skill_bolt"):
		_cast_bolt()
	if Input.is_action_just_pressed("story_skill_brace"):
		_cast_brace()
	## **2026-09-13 추가 — 2~4차 전직**: `job` 문자열과의 정확 일치 대신
	## 사슬 소속(네 갈래는 서로 안 섞이므로 여전히 최대 하나만 걸린다)으로
	## 바꿨다 — 장군(general)으로 전직해도 무사 무예 넷(w_cut 등)을 계속
	## 쓸 수 있어야 한다(원작 skillsOf()의 누적 정신, story_combat.gd
	## JOB_FROM 머리말 참고).
	var chain: Array = StoryCombat.job_chain(StorySaveState.job)
	if chain.has("warrior"):
		if Input.is_action_just_pressed("story_job_skill_1"):
			_cast_warrior_cut()
		if Input.is_action_just_pressed("story_job_skill_2"):
			_cast_warrior_whirl()
		if Input.is_action_just_pressed("story_job_skill_3"):
			_cast_warrior_rush()
		if Input.is_action_just_pressed("story_job_skill_4"):
			_cast_warrior_iron()
		if Input.is_action_just_pressed("story_job_skill_5"):
			_cast_warrior_edge()
		if Input.is_action_just_pressed("story_job_skill_6"):
			_cast_warrior_vital()
	elif chain.has("archer"):
		if Input.is_action_just_pressed("story_job_skill_1"):
			_cast_archer_shot()
		if Input.is_action_just_pressed("story_job_skill_2"):
			_cast_archer_double()
		if Input.is_action_just_pressed("story_job_skill_3"):
			_cast_archer_pierce()
		if Input.is_action_just_pressed("story_job_skill_4"):
			_cast_archer_eye()
		if Input.is_action_just_pressed("story_job_skill_5"):
			_cast_archer_retreat()
		if Input.is_action_just_pressed("story_job_skill_6"):
			_cast_archer_burst()
	elif chain.has("rogue"):
		if Input.is_action_just_pressed("story_job_skill_1"):
			_cast_rogue_twin()
		if Input.is_action_just_pressed("story_job_skill_2"):
			_cast_rogue_knife()
		if Input.is_action_just_pressed("story_job_skill_3"):
			_cast_rogue_step()
		if Input.is_action_just_pressed("story_job_skill_4"):
			_cast_rogue_vital()
		if Input.is_action_just_pressed("story_job_skill_5"):
			_cast_rogue_whirl()
		if Input.is_action_just_pressed("story_job_skill_6"):
			_cast_rogue_dart()
	elif chain.has("mage"):
		if Input.is_action_just_pressed("story_job_skill_1"):
			_cast_mage_fire()
		if Input.is_action_just_pressed("story_job_skill_2"):
			_cast_mage_bolt()
		if Input.is_action_just_pressed("story_job_skill_3"):
			_cast_mage_heal()
		if Input.is_action_just_pressed("story_job_skill_4"):
			_cast_mage_talis()
		if Input.is_action_just_pressed("story_job_skill_5"):
			_cast_mage_step()
		if Input.is_action_just_pressed("story_job_skill_6"):
			_cast_mage_orb()

	## **2026-09-13 추가(같은 날 더 더) — tier2 무예 열둘.** 위 tier1
	## 분기와 별개 입력 액션(story_job_skill2_1~3, 갈래마다 셋뿐이라
	## 넷째가 없다)이라 elif로 안 묶는다 — chain에 tier1도 항상 같이
	## 들어 있으므로 위 분기와 이 분기가 둘 다 걸린다(전직해도 무사
	## 무예 넷을 그대로 쓰면서 장군 무예 셋도 새로 쓴다).
	if chain.has("general"):
		if Input.is_action_just_pressed("story_job_skill2_1"):
			_cast_general_smash()
		if Input.is_action_just_pressed("story_job_skill2_2"):
			_cast_general_roar()
		if Input.is_action_just_pressed("story_job_skill2_3"):
			_cast_general_wall()
		if Input.is_action_just_pressed("story_job_skill2_4"):
			_cast_general_edge()
		if Input.is_action_just_pressed("story_job_skill2_5"):
			_cast_general_vital()
	elif chain.has("sniper"):
		if Input.is_action_just_pressed("story_job_skill2_1"):
			_cast_sniper_rain()
		if Input.is_action_just_pressed("story_job_skill2_2"):
			_cast_sniper_snipe()
		if Input.is_action_just_pressed("story_job_skill2_3"):
			_cast_sniper_split()
		if Input.is_action_just_pressed("story_job_skill2_4"):
			_cast_sniper_retreat()
		if Input.is_action_just_pressed("story_job_skill2_5"):
			_cast_sniper_burst()
	elif chain.has("assassin"):
		if Input.is_action_just_pressed("story_job_skill2_1"):
			_cast_assassin_storm()
		if Input.is_action_just_pressed("story_job_skill2_2"):
			_cast_assassin_fan()
		if Input.is_action_just_pressed("story_job_skill2_3"):
			_cast_assassin_shadow()
		if Input.is_action_just_pressed("story_job_skill2_4"):
			_cast_assassin_whirl()
		if Input.is_action_just_pressed("story_job_skill2_5"):
			_cast_assassin_dart()
	elif chain.has("sage"):
		if Input.is_action_just_pressed("story_job_skill2_1"):
			_cast_sage_quake()
		if Input.is_action_just_pressed("story_job_skill2_2"):
			_cast_sage_beam()
		if Input.is_action_just_pressed("story_job_skill2_3"):
			_cast_sage_ward()
		if Input.is_action_just_pressed("story_job_skill2_4"):
			_cast_sage_step()
		if Input.is_action_just_pressed("story_job_skill2_5"):
			_cast_sage_orb()

	## **2026-09-13 추가(같은 날 더 더 더 더) — tier3 무예 스물넷.** 위
	## tier1·tier2 분기와 별개 입력(story_job_skill3_1~6)이라 elif로 안
	## 묶는다 — chain에 tier1·tier2도 항상 같이 들어 있으므로(예:
	## job=marshal이면 chain=[marshal,general,warrior]) 세 분기가 전부
	## 걸린다.
	if chain.has("marshal"):
		if Input.is_action_just_pressed("story_job_skill3_1"):
			_cast_marshal_heaven()
		if Input.is_action_just_pressed("story_job_skill3_2"):
			_cast_marshal_quake()
		if Input.is_action_just_pressed("story_job_skill3_3"):
			_cast_marshal_charge()
		if Input.is_action_just_pressed("story_job_skill3_4"):
			_cast_marshal_banner()
		if Input.is_action_just_pressed("story_job_skill3_5"):
			_cast_marshal_edge()
		if Input.is_action_just_pressed("story_job_skill3_6"):
			_cast_marshal_vital()
	elif chain.has("flier"):
		if Input.is_action_just_pressed("story_job_skill3_1"):
			_cast_flier_storm()
		if Input.is_action_just_pressed("story_job_skill3_2"):
			_cast_flier_pierce()
		if Input.is_action_just_pressed("story_job_skill3_3"):
			_cast_flier_volley()
		if Input.is_action_just_pressed("story_job_skill3_4"):
			_cast_flier_focus()
		if Input.is_action_just_pressed("story_job_skill3_5"):
			_cast_flier_retreat()
		if Input.is_action_just_pressed("story_job_skill3_6"):
			_cast_flier_burst()
	elif chain.has("wraith"):
		if Input.is_action_just_pressed("story_job_skill3_1"):
			_cast_wraith_blur()
		if Input.is_action_just_pressed("story_job_skill3_2"):
			_cast_wraith_petal()
		if Input.is_action_just_pressed("story_job_skill3_3"):
			_cast_wraith_void()
		if Input.is_action_just_pressed("story_job_skill3_4"):
			_cast_wraith_mark()
		if Input.is_action_just_pressed("story_job_skill3_5"):
			_cast_wraith_whirl()
		if Input.is_action_just_pressed("story_job_skill3_6"):
			_cast_wraith_dart()
	elif chain.has("immortal"):
		if Input.is_action_just_pressed("story_job_skill3_1"):
			_cast_immortal_meteor()
		if Input.is_action_just_pressed("story_job_skill3_2"):
			_cast_immortal_abyss()
		if Input.is_action_just_pressed("story_job_skill3_3"):
			_cast_immortal_mend()
		if Input.is_action_just_pressed("story_job_skill3_4"):
			_cast_immortal_tao()
		if Input.is_action_just_pressed("story_job_skill3_5"):
			_cast_immortal_step()
		if Input.is_action_just_pressed("story_job_skill3_6"):
			_cast_immortal_orb()

	## **2026-09-13 추가(같은 날 더×5) — tier4 무예 스물넷(갈래의 끝).**
	## 위 tier1·tier2·tier3 분기와 별개 입력(story_job_skill4_1~6)이라
	## elif로 안 묶는다 — chain에 아래 세 tier도 항상 같이 들어 있다
	## (예: job=warlord이면 chain=[warlord,marshal,general,warrior]).
	if chain.has("warlord"):
		if Input.is_action_just_pressed("story_job_skill4_1"):
			_cast_warlord_ruin()
		if Input.is_action_just_pressed("story_job_skill4_2"):
			_cast_warlord_tremor()
		if Input.is_action_just_pressed("story_job_skill4_3"):
			_cast_warlord_smite()
		if Input.is_action_just_pressed("story_job_skill4_4"):
			_cast_warlord_conquer()
		if Input.is_action_just_pressed("story_job_skill4_5"):
			_cast_warlord_edge()
		if Input.is_action_just_pressed("story_job_skill4_6"):
			_cast_warlord_vital()
	elif chain.has("falcon"):
		if Input.is_action_just_pressed("story_job_skill4_1"):
			_cast_falcon_tempest()
		if Input.is_action_just_pressed("story_job_skill4_2"):
			_cast_falcon_ray()
		if Input.is_action_just_pressed("story_job_skill4_3"):
			_cast_falcon_swarm()
		if Input.is_action_just_pressed("story_job_skill4_4"):
			_cast_falcon_zenith()
		if Input.is_action_just_pressed("story_job_skill4_5"):
			_cast_falcon_retreat()
		if Input.is_action_just_pressed("story_job_skill4_6"):
			_cast_falcon_burst()
	elif chain.has("reaper"):
		if Input.is_action_just_pressed("story_job_skill4_1"):
			_cast_reaper_carve()
		if Input.is_action_just_pressed("story_job_skill4_2"):
			_cast_reaper_bloom()
		if Input.is_action_just_pressed("story_job_skill4_3"):
			_cast_reaper_veil()
		if Input.is_action_just_pressed("story_job_skill4_4"):
			_cast_reaper_curse()
		if Input.is_action_just_pressed("story_job_skill4_5"):
			_cast_reaper_whirl()
		if Input.is_action_just_pressed("story_job_skill4_6"):
			_cast_reaper_dart()
	elif chain.has("ascendant"):
		if Input.is_action_just_pressed("story_job_skill4_1"):
			_cast_ascendant_starfall()
		if Input.is_action_just_pressed("story_job_skill4_2"):
			_cast_ascendant_collapse()
		if Input.is_action_just_pressed("story_job_skill4_3"):
			_cast_ascendant_rebirth()
		if Input.is_action_just_pressed("story_job_skill4_4"):
			_cast_ascendant_eternity()
		if Input.is_action_just_pressed("story_job_skill4_5"):
			_cast_ascendant_step()
		if Input.is_action_just_pressed("story_job_skill4_6"):
			_cast_ascendant_orb()


## 나는 탈것 — 가로 평면에서 난다(중력 없음).
func begin_fly() -> void:
	fly_on = true
	velocity.y = 8.5

func end_fly() -> void:
	fly_on = false

func is_flying_now() -> bool:
	return fly_on

func _story_fly(delta: float) -> void:
	var axis := Input.get_axis("move_left", "move_right")
	var fspeed := mount_fly_speed if mount_fly_speed > 0.0 else 14.0
	velocity.x = lerpf(velocity.x, axis * fspeed, 3.0 * delta)
	var want_y := -0.6 # 떠 있기
	if Input.is_action_pressed("jump") and global_position.y < 60.0:
		want_y = 9.0
	elif Input.is_action_pressed("story_dash"):
		want_y = -11.0
	velocity.y = lerpf(velocity.y, want_y, 4.0 * delta)
	if absf(axis) > 0.05:
		_facing = signf(axis)
		visual.rotation.y = lerp_angle(visual.rotation.y, PI * 0.5 if _facing > 0 else -PI * 0.5, TURN_RATE * delta)
	_play_anim("idle")


func _walk(delta: float) -> void:
	## 코요테 타임 — 발판 위에 있는 동안은 늘 꽉 채워 두고(그래서 평범한
	## 즉시 점프도 아래 조건 하나로 같이 처리된다), 떠나면 그때부터 깎인다.
	if is_on_floor():
		_coyote_time_left = COYOTE_TIME
	else:
		velocity.y -= GRAVITY * delta
		_coyote_time_left = maxf(0.0, _coyote_time_left - delta)

	## 점프 버퍼 — 착지 직전 눌러 둔 점프를 기억해 뒀다 착지하는 프레임에
	## 바로 터뜨린다(코요테 창이 동시에 열려 있어야 한다는 점에서 같은
	## 조건 하나로 "제때 누른 보통 점프"·"코요테 안 점프"·"버퍼 착지 점프"
	## 셋을 다 커버한다).
	if Input.is_action_just_pressed("jump"):
		_jump_buffer_left = JUMP_BUFFER_TIME
	if _jump_buffer_left > 0.0 and _coyote_time_left > 0.0:
		velocity.y = JUMP_SPEED * mount_jump_mul
		_jump_buffer_left = 0.0
		_coyote_time_left = 0.0
	elif is_on_floor():
		velocity.y = 0.0
	_jump_buffer_left = maxf(0.0, _jump_buffer_left - delta)

	_try_dash()
	_try_signature(delta)

	var axis := Input.get_axis("move_left", "move_right")
	## **2026-09-13 추가(같은 날 더 더 더 더)** — f_focus(정심)가 처음으로
	## job 버프에 이동속도 배율을 얹었다. 기합(brace)과는 별개 곱.
	var speed := RUN_SPEED * (StoryCombat.BRACE_SPEED_MUL if _buff_time_left > 0.0 else 1.0) \
		* (_job_buff_speed_mul if _job_buff_time_left > 0.0 else 1.0) \
		* (StoryCombat.ARCHER_DRAW_MOVE_MUL if _archer_charging else 1.0) \
		* StoryLabyrinthState.move_speed_mult() \
		* mount_speed_mul  # PLAN 101-2 STORY ⑤(비경, 질주 은사) · 탈것
	velocity.x = axis * speed

	if absf(axis) > 0.05:
		_facing = signf(axis)
		visual.rotation.y = lerp_angle(visual.rotation.y, PI * 0.5 if _facing > 0 else -PI * 0.5, TURN_RATE * delta)
		_play_anim("idle" if mounted else "walk")
	else:
		_play_anim("idle")


## 웹판 §5-5 "회피를 대시로 재정의"(3D엔 회피 입력이 아예 없어 새 액션
## `story_dash`로 새로 판다, Shift — GO의 `run`과 물리 키는 같지만 이
## 판은 안 쓰던 액션이라 겹치지 않는다). w_rush(돌진) 등 무예 "dash"들과
## 같은 방식으로 순간이동 재해석(부드러운 이동 애니메이션 없음, 벽·구덩이
## 충돌 미확인 — 다음에 볼 자리, w_rush 머리말과 같은 한계). 웹판의 대시
## 잔상(3프레임)은 새 VFX라 이번엔 뺐다.
func _try_dash() -> void:
	if _dash_cd_left > 0.0 or not Input.is_action_just_pressed("story_dash"):
		return
	_dash_cd_left = DASH_COOLDOWN
	global_position.x += DASH_DIST_M * _facing
	_invuln_time_left = maxf(_invuln_time_left, DASH_INVULN_SEC)


## PLAN 101-2 STORY ③후보(웹판 §5-1 "직업 정체성") — 같은 `story_dash`
## 버튼을 길게 누르면 대시와 별개로 갈래별 고유 조작이 나온다(`_try_dash()`
## 는 press 즉시 그대로 나가는 독립 이벤트라 서로 안 막는다). 궁수만
## "누르는 동안 계속 차징 → 뗄 때 발동"이라 나머지 셋(즉시 발동)과 갈린다
## — `story_combat.gd` 머리말 참고.
func _try_signature(delta: float) -> void:
	if Input.is_action_just_released("story_dash"):
		if StorySaveState.job == "archer" and _archer_charging:
			_release_archer_draw()
		_dash_hold_time = 0.0
		_signature_fired_this_hold = false
		_archer_charging = false
		return
	if not Input.is_action_pressed("story_dash"):
		return
	_dash_hold_time += delta
	if StorySaveState.job == "archer":
		if _dash_hold_time >= StoryCombat.ARCHER_DRAW_MIN_SEC:
			_archer_charging = true
		return
	if _signature_fired_this_hold or _dash_hold_time < StoryCombat.SIGNATURE_HOLD_SEC:
		return
	_signature_fired_this_hold = true
	match StorySaveState.job:
		"warrior": _fire_warrior_parry()
		"rogue": _fire_rogue_shadow_step()
		"mage": _fire_mage_element()


func _signature_ready() -> bool:
	return _signature_cd_left <= 0.0 and mp >= StoryCombat.SIGNATURE_MP_COST


func _spend_signature() -> void:
	_signature_cd_left = StoryCombat.SIGNATURE_COOLDOWN
	mp -= StoryCombat.SIGNATURE_MP_COST


func _fire_warrior_parry() -> void:
	if not _signature_ready():
		return
	_spend_signature()
	_parry_time_left = StoryCombat.WARRIOR_PARRY_SEC


func _fire_rogue_shadow_step() -> void:
	if not _signature_ready():
		return
	_spend_signature()
	_invuln_time_left = maxf(_invuln_time_left, StoryCombat.ROGUE_SHADOW_INVULN_SEC)
	_signature_next_mul = StoryCombat.ROGUE_SHADOW_NEXT_MUL


func _fire_mage_element() -> void:
	if not _signature_ready():
		return
	_spend_signature()
	_mage_element_idx = (_mage_element_idx + 1) % StoryCombat.MAGE_ELEMENTS.size()
	_signature_next_mul = StoryCombat.MAGE_ELEMENT_NEXT_MUL


## 궁수 당기기 — 뗄 때 발동, 누른 시간(0.4~1.2s)에 비례해 배율이 오른다.
func _release_archer_draw() -> void:
	if not _signature_ready():
		return
	_spend_signature()
	var held := clampf(_dash_hold_time, StoryCombat.ARCHER_DRAW_MIN_SEC, StoryCombat.ARCHER_DRAW_MAX_SEC)
	var t := (held - StoryCombat.ARCHER_DRAW_MIN_SEC) / (StoryCombat.ARCHER_DRAW_MAX_SEC - StoryCombat.ARCHER_DRAW_MIN_SEC)
	_signature_next_mul = lerpf(StoryCombat.ARCHER_DRAW_MIN_MUL, StoryCombat.ARCHER_DRAW_MAX_MUL, t)


## 줄 안에서는 중력이 없다 — 위/아래(move_forward/move_back, 원래 3D
## 전후 이동용 축)를 오르내리기 전용으로 빌려 쓴다. 가로 입력이 세게
## 들어오면(> 0.3) 손을 놓은 것으로 본다(웹판엔 없는 규칙 — 로프에서
## 못 내려오는 사고를 막으려고 직접 정함, VERTICAL_SLICE_STORY.md에
## 안 적힌 세부 튜닝이라 여기 남겨 둔다).
func _climb(delta: float) -> void:
	var rope_x: float = float(_rope_area.get_meta("rope_x"))
	var top: float = float(_rope_area.get_meta("rope_top"))
	var bottom: float = float(_rope_area.get_meta("rope_bottom"))

	var vertical := Input.get_axis("move_back", "move_forward")
	if absf(Input.get_axis("move_left", "move_right")) > 0.3:
		_on_rope = false
		return

	global_position.x = rope_x
	velocity = Vector3.ZERO
	global_position.y = clampf(global_position.y + vertical * CLIMB_SPEED * delta, bottom, top)

	if absf(vertical) > 0.05:
		_play_anim("walk")
	else:
		_play_anim("idle")

	if Input.is_action_just_pressed("jump"):
		_on_rope = false
		velocity.y = JUMP_SPEED * 0.6


func _check_rope() -> void:
	if _on_rope:
		return
	if _rope_area == null:
		return
	var vertical := Input.get_axis("move_back", "move_forward")
	if absf(vertical) > 0.05:
		_on_rope = true


## story_terrain_builder.gd의 RopeArea가 body_entered/exited로 부른다
## (플레이어는 CharacterBody3D라 자기 쪽엔 Area3D 신호가 없다 — 줄
## 쪽에서 알려 주는 방향으로 배선했다).
func set_rope_area(area: Area3D) -> void:
	_rope_area = area


func clear_rope_area(area: Area3D) -> void:
	if _rope_area == area:
		_rope_area = null
		_on_rope = false


func _attack() -> void:
	## PLAN 101-2 STORY ⑤(비경, 연격 은사) — 기본 공격에만 건다(무예 쿨다운은
	## 갈래마다 따로라 이번 범위 밖, story_labyrinth.gd 헤더 참고).
	_attack_cd_left = ATTACK_COOLDOWN / StoryLabyrinthState.atk_speed_mult()
	_play_anim("sprint")  # 전용 공격 애니메이션이 없어 임시로 빌림(재해석, 실기 확인 때 다시 볼 것)
	_melee_hit(ATTACK_RANGE, 1.0)


