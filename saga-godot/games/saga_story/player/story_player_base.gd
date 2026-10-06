class_name StoryPlayerBase
extends CharacterBody3D

## VERTICAL_SLICE_STORY.md 1·2·3절 — 2.5D 플랫포머 이동+공격.
## GO player.gd의 GLB·애니메이션 재사용 방식은 그대로 빌리되(character-
## a.glb, idle/walk/sprint), 이 판은 **가로(X)·높이(Y) 평면에만** 움직인다
## (2절 "Z는 이번 슬라이스에서 고정") — move_forward/move_back(W/S)은
## 이동에 안 쓰고 줄 오르내리기 전용으로 돌린다.
##
## 물리 상수는 VERTICAL_SLICE_STORY.md 2절 그대로(비율만 웹과 맞춘 재설계,
## 원문 픽셀값을 그대로 옮기지 않는다).
##
## PLAN 101-2 STORY ①후보 "손맛 표준"(2026-09-17) — DUNGEON melee_attack.gd
## 가 이미 연결한 `saga_core/combat_feel.gd`의 5요소(hitstop·카메라 흔들림·
## 피격 플래시·숫자 팝·타격음)를 STORY에도 잇는다. 적중 판정이 한 곳
## (`_melee_hit()`)이 아니라 무예마다 함수가 갈려 있지만, 다 같은 3줄
## (`e.take_damage(...)` → `roll.crit`이면 `trigger_hitstop()`)이라 그
## 3줄을 `CombatFeel.hit(e, dmg, crit)` 한 줄로 바꿨다 — 이전엔 치명타일
## 때만 화면이 멈췄지만 이제 모든 타격이 5요소를 낸다(비치명은 짧게,
## combat_feel.gd 자체 수치). `story_combat.gd`의 옛 `trigger_hitstop()`
## (Engine.time_scale 직접 조작)은 더 쓰는 곳이 없어 지웠다.

const GRAVITY := 36.0
const JUMP_SPEED := 15.0
const RUN_SPEED := 6.0
const CLIMB_SPEED := 4.0
const TURN_RATE := 12.0
const ATTACK_RANGE := 2.2
const ATTACK_COOLDOWN := 0.36  # 무예 연참(連斬) cd 0.36 그대로(js/data-job.js)

## PLAN 101-2 STORY ②후보 "이동 손맛"(웹판 §5-5, 대시·코요테·버퍼만 — 3D
## PLAN.md가 벽 차기·착지 롤은 범위 밖으로 이미 좁혀 뒀다). 시간값(쿨·
## 무적·코요테·버퍼)은 웹판 초 단위 그대로 옮긴다(픽셀이 아니라 시간이라
## 비율 재설계가 필요 없다) — 거리만 웹 140px를 그대로 안 쓰고 RUN_SPEED
## 배수로 재설계.
const DASH_DIST_M := RUN_SPEED * 0.5  # 3m, 한 걸음보다 훨씬 크게(0.5초 치 주행 거리)
const DASH_COOLDOWN := 0.9
const DASH_INVULN_SEC := 0.12
const COYOTE_TIME := 0.1
const JUMP_BUFFER_TIME := 0.12

const StoryCombat := preload("res://games/saga_story/data/story_combat.gd")
const CelShaderApply := preload("res://saga_core/shaders/cel_shader_apply.gd")
const BlobShadow := preload("res://saga_core/world/blob_shadow.gd")

@onready var visual: Node3D = $Visual
## G-0030 — 이 판 주인공 몸(새 인물 몸 id). 장면의 빈 Visual 을 story_player._ready 가 이 몸으로 갈아 끼운다.
@export var body_id := ""

## 2026-09-30 탈것(games/saga_go/player/mount.gd, data/mounts.gd — 다섯 판 공용).
## 땅 탈것: 이동·점프 배율 · 나는 탈것(fly_on): 점프=오르기·손 떼면 내려앉기·Shift(story_dash)=급강하 — 가로 평면(X·Y)에서.
var mounted := false
var mount_speed_mul := 1.0
var mount_jump_mul := 1.0
var ride_height := 0.0
var mount_fly_speed := 0.0
var fly_on := false
@onready var _anim: AnimationPlayer = visual.find_child("AnimationPlayer", true, false)

var _current_anim := ""
var _facing := 1.0  # +1 오른쪽, -1 왼쪽
var _attack_cd_left := 0.0
var _on_rope := false
var _rope_area: Area3D = null

## **2026-09-12 추가 — 무예 나머지 셋(횡소·기탄·기합).** story_combat.gd
## 머리말 참고. MP는 세이브에 안 넣는다(재입장 시 가득 찬 채 시작 —
## 원작도 "쉬는 중은 실제로 mp 가득 참으로 시작"이 기본 흐름이다).
var mp := StoryCombat.MP_MAX
var _cd_sweep := 0.0
var _cd_bolt := 0.0
var _cd_brace := 0.0
var _buff_time_left := 0.0  # 기합(brace) 남은 시간 — atk·speed 배율에 쓴다

## **2026-09-13 추가(같은 날 더) — 전직 다음 걸음: 무사(warrior) 무예 넷.**
## job이 'warrior'일 때만 실제로 쓰인다(story_combat.gd JOB_CHANGE_LEVEL
## 머리말 참고) — 다른 직업(궁수·협객·방사)은 아직 전용 무예가 없어
## 이 넷을 조용히 무시한다. 철갑(iron)의 버프는 기합(brace)과 **별도
## 타이머**로 둔다 — 둘 다 tier0/전직 넷으로 서로 다른 자리라 동시에
## 걸릴 수 있고(원작이 막지 않는다), _effective_atk()가 두 배율을
## 곱해서 적용한다.
var _cd_warrior_cut := 0.0
var _cd_warrior_whirl := 0.0
var _cd_warrior_rush := 0.0
var _cd_warrior_iron := 0.0
var _job_buff_time_left := 0.0

## **2026-09-13 추가(같은 날 더) — 전직 다음 걸음: 궁수(archer) 무예 넷.**
## `_job_buff_time_left`는 응안(a_eye)도 같이 쓴다(철갑처럼 "전직 넷 중
## 버프 하나" 자리는 job당 하나뿐이라 타이머를 공유해도 섞이지 않는다 —
## `job`이 한 번 정해지면 안 바뀌므로 동시에 두 직업 버프가 걸릴 수
## 없다). 배율은 `_effective_atk()`/`take_damage()`가 job을 보고 고른다.
var _cd_archer_shot := 0.0
var _cd_archer_double := 0.0
var _cd_archer_pierce := 0.0
var _cd_archer_eye := 0.0

## **2026-09-13 추가(같은 날 더) — 전직 다음 걸음: 협객(rogue) 무예 넷.**
## `_invuln_time_left`는 은신보(rogue) 전용으로 새로 늘렸다(축지·mage
## 몫은 다음에 m_step을 옮길 때 이 변수를 그대로 재사용할 수 있다) —
## side.js `p.invuln`과 같은 자리, take_damage()가 이 값이 0보다 크면
## 피해 자체를 무시한다(방어 컷보다 앞서 확인).
var _cd_rogue_twin := 0.0
var _cd_rogue_knife := 0.0
var _cd_rogue_step := 0.0
var _cd_rogue_vital := 0.0
var _invuln_time_left := 0.0

## PLAN 101-2 STORY ②후보 "이동 손맛" — 대시 쿨다운·코요테 타임(발판을
## 떠난 직후에도 잠깐 점프를 허용)·점프 버퍼(착지 직전 눌러 둔 점프를
## 착지 즉시 터뜨림).
var _dash_cd_left := 0.0
var _coyote_time_left := 0.0
var _jump_buffer_left := 0.0

## PLAN 101-2 STORY ③후보 "직업 정체성" — 갈래별 고유 조작(`_try_signature()`
## 머리말 참고). `_dash_hold_time`은 `story_dash`를 누르고 있는 시간(뗄 때
## 0으로), `_signature_next_mul`은 "다음 공격 한 방" 한정 배율(`_effective_
## atk()`가 읽는 즉시 1.0으로 되돌린다).
var _signature_cd_left := 0.0
var _dash_hold_time := 0.0
var _signature_fired_this_hold := false
var _archer_charging := false
var _parry_time_left := 0.0
var _signature_next_mul := 1.0
var _mage_element_idx := 0

## **2026-09-13 추가(같은 날 더) — 전직 다음 걸음: 방사(mage) 무예 넷.**
## `_job_buff_time_left`를 부적(m_talis)도 같이 쓴다(archer/warrior와
## 같은 공유 규칙). regen 배율은 mp 회복 줄(`_physics_process()`)이
## job=='mage'일 때만 곱한다.
var _cd_mage_fire := 0.0
var _cd_mage_bolt := 0.0
var _cd_mage_heal := 0.0
var _cd_mage_talis := 0.0

## **2026-09-13 추가(같은 날 더 더) — tier2 무예 열둘(장군·신궁·자객·도사
## 각 셋).** 별도 입력 액션(story_job_skill2_1~3)을 쓴다 — chain에는
## 언제나 tier1도 같이 들어 있어(예: job=general이면 chain=[general,
## warrior]) 위 tier1 분기와 이 분기가 둘 다 걸린다(전직해도 무사 무예
## 넷을 그대로 쓰면서 장군 무예 셋도 새로 쓴다, story_combat.gd
## SKILL_NEED 머리말 참고).
var _cd_general_smash := 0.0
var _cd_general_roar := 0.0
var _cd_general_wall := 0.0
var _cd_sniper_rain := 0.0
var _cd_sniper_snipe := 0.0
var _cd_sniper_split := 0.0
var _cd_assassin_storm := 0.0
var _cd_assassin_fan := 0.0
var _cd_assassin_shadow := 0.0
var _cd_sage_quake := 0.0
var _cd_sage_beam := 0.0
var _cd_sage_ward := 0.0

## **2026-09-13 추가(같은 날 더 더 더) — tier1 다섯째·여섯째 무예
## 여덟(파공검·생기결 등) + 그 여덟이 여는 tier2 나머지 여덟(벽공검
## 등, story_combat.gd SKILL_NEED 머리말 참고).** 입력은 tier1이
## story_job_skill_5~6, tier2가 story_job_skill2_4~5.
var _cd_warrior_edge := 0.0
var _cd_warrior_vital := 0.0
var _cd_archer_retreat := 0.0
var _cd_archer_burst := 0.0
var _cd_rogue_whirl := 0.0
var _cd_rogue_dart := 0.0
var _cd_mage_step := 0.0
var _cd_mage_orb := 0.0
var _cd_general_edge := 0.0
var _cd_general_vital := 0.0
var _cd_sniper_retreat := 0.0
var _cd_sniper_burst := 0.0
var _cd_assassin_whirl := 0.0
var _cd_assassin_dart := 0.0
var _cd_sage_step := 0.0
var _cd_sage_orb := 0.0

## **2026-09-13 추가(같은 날 더 더 더 더) — tier3 무예 스물넷(원수·비장·
## 귀영·진인 각 여섯). 입력은 story_job_skill3_1~6.**
var _cd_marshal_heaven := 0.0
var _cd_marshal_quake := 0.0
var _cd_marshal_charge := 0.0
var _cd_marshal_banner := 0.0
var _cd_marshal_edge := 0.0
var _cd_marshal_vital := 0.0
var _cd_flier_storm := 0.0
var _cd_flier_pierce := 0.0
var _cd_flier_volley := 0.0
var _cd_flier_focus := 0.0
var _cd_flier_retreat := 0.0
var _cd_flier_burst := 0.0
var _cd_wraith_blur := 0.0
var _cd_wraith_petal := 0.0
var _cd_wraith_void := 0.0
var _cd_wraith_mark := 0.0
var _cd_wraith_whirl := 0.0
var _cd_wraith_dart := 0.0
var _cd_immortal_meteor := 0.0
var _cd_immortal_abyss := 0.0
var _cd_immortal_mend := 0.0
var _cd_immortal_tao := 0.0
var _cd_immortal_step := 0.0
var _cd_immortal_orb := 0.0

## **2026-09-13 추가(같은 날 더×5) — tier4 무예 스물넷(전신·궁성·명왕·
## 천존 각 여섯, 갈래의 끝). 입력은 story_job_skill4_1~6.**
var _cd_warlord_ruin := 0.0
var _cd_warlord_tremor := 0.0
var _cd_warlord_smite := 0.0
var _cd_warlord_conquer := 0.0
var _cd_warlord_edge := 0.0
var _cd_warlord_vital := 0.0
var _cd_falcon_tempest := 0.0
var _cd_falcon_ray := 0.0
var _cd_falcon_swarm := 0.0
var _cd_falcon_zenith := 0.0
var _cd_falcon_retreat := 0.0
var _cd_falcon_burst := 0.0
var _cd_reaper_carve := 0.0
var _cd_reaper_bloom := 0.0
var _cd_reaper_veil := 0.0
var _cd_reaper_curse := 0.0
var _cd_reaper_whirl := 0.0
var _cd_reaper_dart := 0.0
var _cd_ascendant_starfall := 0.0
var _cd_ascendant_collapse := 0.0
var _cd_ascendant_rebirth := 0.0
var _cd_ascendant_eternity := 0.0
var _cd_ascendant_step := 0.0
var _cd_ascendant_orb := 0.0

## **2026-09-13 추가(같은 날 더 더) — job 버프 배율을 캐스팅 시점에
## 저장한다.** 지금까지 `_effective_atk()`/`take_damage()`가 매 프레임
## `job`에서 배율을 다시 골라 왔는데(철갑=WARRIOR_IRON_ATK_MUL 등),
## tier2에 새 버프(g_wall·p_ward)가 생기면서 job의 사슬(chain)만으로는
## "지금 실제로 걸린 버프가 tier1 것인지 tier2 것인지" 구분이 안 된다
## (예: job=general이면 chain이 warrior도 포함해 철갑 배율로 잘못 고를
## 수 있다). 그래서 각 `_cast_*_iron/_eye/_vital/_talis/_wall/_ward()`가
## 캐스팅 순간 이 세 값을 직접 채워 넣고, `_job_buff_time_left`가 남아
## 있는 동안은 그 값을 그대로 쓴다(job을 다시 안 본다).
var _job_buff_atk_mul := 1.0
var _job_buff_guard := 0.0
var _job_buff_regen_mul := 1.0

## **2026-09-13 추가(같은 날 더 더 더 더) — f_focus(정심, tier3)가 이
## 포트 job 버프 중 처음으로 이동속도 배율(speed×1.15)을 갖는다.**
## `_walk()`가 `_buff_time_left`(brace)와 별개로 이 값을 곱한다.
var _job_buff_speed_mul := 1.0

## **2026-09-13 추가 — 플레이어 체력(잡졸 반격).** story_enemy.gd 머리말이
## "추격·원거리 반격이 없다"고 적어 둔 것 중 반격(겹치면 맞는다, side.js
## overlap()+hurtMe())만 이번에 채운다 — 추격(쫓아오기)은 여전히 없다
## (잡졸은 제자리, 플레이어가 닿으면 맞는다). DUNGEON player_health.gd와
## 같은 정신으로 **죽음은 이번에도 범위 밖** — hp가 0 밑으로 안 내려가고
## 그냥 멈춘다(부활·게임오버 없음). mp처럼 세이브에 안 넣는다.
## side.js의 전역 피격무적(`p.invuln`, HIT_COOL)은 옮기지 않았다 — 잡졸이
## 하나(story_enemy.gd `_attack_cd_left`, 1초)뿐이라 같은 적이 연타하는
## 건 이미 막히고, 여러 적이 동시에 겹쳐 때리는 경우는 이번 슬라이스
## (그룬트 셋+보스 하나) 규모에선 드물다고 보고 좁혔다.
##
## **2026-09-13 추가(같은 날 더) — 장비 10부위, 이어서 전직(job).**
## max_hp는 이제 고정값이 아니라 StorySaveState.gear_totals().hp +
## job_grow().hp를 더한 값(power()의 hp = base + gear.hp + jb.hp와 같은
## 자리)이라 계산 프로퍼티(get)로 뺐다 — mp처럼 세이브에 hp 자체는 안
## 넣지만(재입장 시 가득 찬 채 시작), 장비(equipped)·직업(job)은 세이브에
## 있으므로 로드 직후 story_save_state.gd::try_load()가 hp를 새 max_hp로
## 채워 준다(안 그러면 이전 세션 보너스가 반영되기 전 기본치로 시작해
## 잠깐 어긋난다).
var hp := StoryCombat.START_HP

## PLAN 101-2 STORY ⑤(비경, 2026-09-18) — StorySaveState.memory_hp_mult()가
## 곱한다(영구 강화 단수, 비경 밖에서도 항상 적용 — 은사와 달리 회차 한정이
## 아니다). 기존 합(START_HP+장비+전직)에 곱하는 자리라 다른 계산은 안 건드린다.
var max_hp: float:
	get: return (StoryCombat.START_HP + float(StorySaveState.gear_totals().hp) + float(StorySaveState.job_grow().hp)) * StorySaveState.memory_hp_mult()

## 방사(mage) 전직의 jb.mp(+40)를 반영한 MP 최대치 — mp_bar.gd가 폴링한다.
var max_mp: float:
	get: return StoryCombat.MP_MAX + float(StorySaveState.job_grow().mp)


## side.js power()의 atk = round(might*0.9+wisdom*0.3) + gearBonus().atk +
## jobGrow().atk — 낀 장비(10부위)·전직(job, 2026-09-13 추가) 전부의 atk
## 합을 그 위에 얹는다. 기합(brace)이 걸려 있으면 그 합계에 ×1.35(원문
## buff.atk 그대로, side.js가 pw.atk 자체를 buff로 올리는 것과 같은 결 —
## 스킬마다 따로 배율을 안 곱한다).
func _effective_atk() -> float:
	var atk := StoryCombat.START_ATK + float(StorySaveState.gear_totals().atk) + float(StorySaveState.job_grow().atk)
	atk *= StoryCombat.BRACE_ATK_MUL if _buff_time_left > 0.0 else 1.0
	## **2026-09-13 추가(같은 날 더 더)** — 캐스팅 시점에 저장해 둔
	## `_job_buff_atk_mul`을 그대로 쓴다(변수 선언부 머리말 참고).
	if _job_buff_time_left > 0.0:
		atk *= _job_buff_atk_mul
	## PLAN 101-2 STORY ③후보 — 갈래별 고유 조작의 "다음 공격" 배율. 한
	## 방짜리라 여기서 읽는 즉시 1.0으로 되돌린다(24곳 전부가 매 공격마다
	## `_effective_atk()`를 정확히 한 번씩만 부르므로 여기서 소비해도
	## 안전하다 — 파일 안 다른 호출부가 없다).
	if _signature_next_mul != 1.0:
		atk *= _signature_next_mul
		_signature_next_mul = 1.0
	atk *= StoryLabyrinthState.atk_mult()  # PLAN 101-2 STORY ⑤(비경, 맹공 은사) — 기본 공격·무예 전부 이 한 곳을 거친다
	return atk


## 정면 판정 공용 — 연참(reach)·기탄(reach*2)이 같이 쓴다. mul은 무예별
## 배율(연참 1.0·기탄 BOLT_MUL), range는 사거리.
func _melee_hit(range_m: float, mul: float) -> void:
	range_m *= StoryLabyrinthState.reach_mult()  # PLAN 101-2 STORY ⑤(비경, 장병 은사) — 18곳 전부 이 한 곳을 거친다
	for enemy in get_tree().get_nodes_in_group("story_enemy"):
		var e := enemy as Node3D
		if e == null:
			continue
		var dx: float = e.global_position.x - global_position.x
		if absf(dx) > range_m:
			continue
		if signf(dx) != 0.0 and signf(dx) != _facing and absf(dx) > 0.3:
			continue  # 등 뒤는 안 맞는다(바로 겹친 자리 정도는 봐준다)
		var roll: Dictionary = StoryCombat.roll_damage(_effective_atk(), mul)
		e.take_damage(float(roll.dmg))
		CombatFeel.hit(e, float(roll.dmg), bool(roll.crit))


## 횡소(sweep) — aoe, 등 뒤도 맞는다(360도 판정, side.js effect:'aoe' 그대로
## — 정면 판정이 없다). MP·쿨다운 부족하면 side.js castSkill()처럼 조용히
## 무시한다(원문에 실패 메시지가 없다).
func _cast_sweep() -> void:
	if _cd_sweep > 0.0 or mp < StoryCombat.SWEEP_COST:
		return
	_cd_sweep = StoryCombat.SWEEP_CD
	mp -= StoryCombat.SWEEP_COST
	_play_anim("sprint")
	var range_m := ATTACK_RANGE * StoryCombat.SWEEP_RANGE_MUL
	for enemy in get_tree().get_nodes_in_group("story_enemy"):
		var e := enemy as Node3D
		if e == null:
			continue
		var dx: float = e.global_position.x - global_position.x
		if absf(dx) > range_m:
			continue
		var roll: Dictionary = StoryCombat.roll_damage(_effective_atk(), StoryCombat.SWEEP_MUL)
		e.take_damage(float(roll.dmg))
		CombatFeel.hit(e, float(roll.dmg), bool(roll.crit))


## 기탄(bolt) — 관통. 이 슬라이스는 투사체가 없어(적이 안 움직인다) "더
## 멀리 뻗는 정면 공격"으로 재해석(story_combat.gd BOLT_RANGE_MUL 참고).
func _cast_bolt() -> void:
	if _cd_bolt > 0.0 or mp < StoryCombat.BOLT_COST:
		return
	_cd_bolt = StoryCombat.BOLT_CD
	mp -= StoryCombat.BOLT_COST
	_play_anim("sprint")
	_melee_hit(ATTACK_RANGE * StoryCombat.BOLT_RANGE_MUL, StoryCombat.BOLT_MUL)


## 기합(brace) — buff, 대미지 없음. _effective_atk()·_walk()의 speed
## 배율이 _buff_time_left>0을 읽어 실제로 적용한다.
func _cast_brace() -> void:
	if _cd_brace > 0.0 or mp < StoryCombat.BRACE_COST:
		return
	_cd_brace = StoryCombat.BRACE_CD
	mp -= StoryCombat.BRACE_COST
	_buff_time_left = StoryCombat.BRACE_SEC


func _play_anim(anim_name: String) -> void:
	if _anim == null or not _anim.has_animation(anim_name):
		return
	if _current_anim == anim_name:
		return
	_current_anim = anim_name
	_anim.play(anim_name)
