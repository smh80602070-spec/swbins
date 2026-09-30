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


func _attack() -> void:
	## PLAN 101-2 STORY ⑤(비경, 연격 은사) — 기본 공격에만 건다(무예 쿨다운은
	## 갈래마다 따로라 이번 범위 밖, story_labyrinth.gd 헤더 참고).
	_attack_cd_left = ATTACK_COOLDOWN / StoryLabyrinthState.atk_speed_mult()
	_play_anim("sprint")  # 전용 공격 애니메이션이 없어 임시로 빌림(재해석, 실기 확인 때 다시 볼 것)
	_melee_hit(ATTACK_RANGE, 1.0)


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


func _play_anim(anim_name: String) -> void:
	if _anim == null or not _anim.has_animation(anim_name):
		return
	if _current_anim == anim_name:
		return
	_current_anim = anim_name
	_anim.play(anim_name)
