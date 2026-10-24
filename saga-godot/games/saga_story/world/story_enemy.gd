extends Node3D

## VERTICAL_SLICE_STORY.md 1·3절 — 잡졸 하나(황건적, data-enemy.js 첫
## 항목 그대로, weapon:club·color '#c9a83a' — DUNGEON dungeon_enemy.gd가
## 이미 같은 색으로 옮겨 둔 값과 같다). HP=18·DMG=6은 side.js
## spawnEnemy()의 lv=1 공식(story_combat.gd 상단 참고).
##
## **재해석** — 추격은 여전히 없다(1·3절 "제외" — 잡졸은 제자리에 서
## 있다, 넉백도 없음). **2026-09-13 추가 — 반격만 채운다**: side.js
## `overlap(p, e) && e.cd<=0`이면 `hurtMe(e.dmg)` 그대로 — 플레이어가
## 닿으면(추격 없이) 맞는다. 원문 `e.cd=1.0`(1초 쿨다운) 그대로. 겹침
## 판정 반경은 `P_W`(26px)/2 + 잡졸 `w`(34px)/2 = 30px×0.02=0.6m로
## 역산(원문은 AABB 겹침이지만 이 포트는 X축 거리 하나로 충분히
## 재현한다 — story_player.gd `_melee_hit()`도 같은 방식).
##
## **2026-09-13 추가 — 보스(황건 두목, is_boss).** story_boss_spawner.gd가
## add_child 전에 `is_boss=true`를 세팅한다(story_gather.gd의 kind와 같은
## 배선 순서 — set_script 직후 값을 덮어써야 _ready()가 그 값을 본다).
## 몸집 배율(BOSS_VISUAL_SCALE)은 원작에 없는 값 — DUNGEON dungeon_
## enemy.gd가 r=boss?22:13(≈1.7배)로 몸집만 키우고 색은 그대로 두는
## 것과 같은 결로 새로 정했다.
##
## **2026-09-13 추가 — 사냥터별 보스 배율.** hp_mul/dmg_mul은 이제
## story_boss_spawner.gd가 add_child 전에 맵별 값(is_boss와 같은 배선
## 순서)으로 덮어쓴다 — 기본값(story_combat.gd BOSS_HP_MUL/DMG_MUL)은
## map_path를 안 거치는 맨몸 인스턴스용 안전값일 뿐이다.
##
## **2026-09-13 추가(같은 날 더) — 몬스터 도감.** `enemy_lv`/`enemy_color`
## 신규 — hp·dmg가 이제 story_combat.gd의 lv 공식(`enemy_base_hp`/
## `enemy_base_dmg`)을 따르고, 몸 색도 맵이 넘긴 값을 쓴다(story_enemy_
## spawner.gd는 잡졸 색을, story_boss_spawner.gd는 보스 전용 색을
## 넘긴다 — 이 파일이 알던 하드코딩된 `COLOR` 하나(황건적/황건 두목,
## field 전용)는 이제 그 둘의 기본값일 뿐이다).
##
## **2026-09-13 추가(같은 날 더 더) — 원거리 적(1절 "제외" 목록).**
## `is_ranged`(story_enemy_spawner.gd가 map.enemy_is_ranged()로 세팅,
## 보스는 안 씀 — story_boss_spawner.gd가 안 건드려 기본값 false 그대로)
## true면 근접 접촉 피해와 별개로 사거리 안에서 화살을 쏜다(story_combat.gd
## RANGED_* 참고). 두 공격은 서로 독립된 쿨다운이라(side.js `e.cd`와
## `e.shotCd`가 다른 변수인 것과 같다) 한 쪽이 쿨다운 중이어도 다른 쪽은
## 정상 작동해야 한다 — `_physics_process()`를 그렇게 갈랐다.
const StoryLook := preload("res://games/saga_story/data/story_look.gd")   # G-0187
const StoryCombat := preload("res://games/saga_story/data/story_combat.gd")
const StoryGearPickup := preload("res://games/saga_story/world/story_gear_pickup.gd")
const StoryGoldPickup := preload("res://games/saga_story/world/story_gold_pickup.gd")
const StoryEnemyShot := preload("res://games/saga_story/world/story_enemy_shot.gd")
const CreatureBuilder := preload("res://saga_core/world/creature_builder.gd")
const StoryBossPattern := preload("res://games/saga_story/world/story_boss_pattern.gd")   # G-0205 보스 패턴전 1차
const Toast := preload("res://saga_core/ui/toast.gd")
const CombatTell := preload("res://saga_core/combat_tell.gd")   # G-0206 달려들기 예고
const StoryEnemies := preload("res://games/saga_story/data/story_enemies.gd")   # G-0209 잡몹 명단(웹 data-enemy.js)

## 사냥터별 몸 모양(GO 짐승 공방 재사용 — 캡슐 대신). 정해진 게 없으면(비경 등) 도깨비꼴.
const KIND_BY_STAGE := {"field": "goblin", "forest": "wolf", "cave": "beast", "gorge": "bear"}
## G-0209 — 종(species)이 있으면 몸은 form 으로(2나락과 같은 대응 — 판끼리 참조 안 해 여기 따로). 이름에 코끼리면 뭉툭한 네발.
const FORM_KIND := {"": "goblin", "ogre": "goblin", "quad": "wolf", "bird": "bird", "serpent": "serpent", "dragon": "serpent", "fish": "serpent", "toad": "turtle"}
## G-0209 순찰·추격(웹 side.js 적 루프, px→m ×0.02) — species 있는 사냥터 잡몹만. 보스·관문 대장·비경·부하는 그대로 선다.
const NEAR_X_M := 5.2        # |dx| < 260px
const NEAR_Y_M := 1.4        # |dy| < 70px
const FLAT_Y_M := 1.28       # 원거리 "같은 높이" 64px
const NEAR_MUL := 1.25
const PATROL_MUL := 0.7
const EDGE_L_M := 0.4        # x < 20px 에서 돌아섬
const EDGE_R_M := 0.8        # x > 폭 − 40px 에서 돌아섬
const HOLD_M := 78.0 * 1.2 * 0.02   # REACH×1.2 보다 멀면 원거리는 멈춰 쏜다
## G-0210 역할(웹 side.js enemyRole·spawnEnemy) — role 은 spawner 가 add_child 전에(없으면 종으로 판정, 마법형은 spawner 굴림만).
## 고돗 4종횡엔 넉백이 없어 웹 탱커의 "안 밀림"은 해당 없음.
const TANK_HP_MUL := 2.2
const TANK_SPD_MUL := 0.6
const TANK_DMG_MUL := 0.85
const MAGIC_HP_MUL := 0.85
const MAGIC_RANGE_M := 340.0 * 0.02
const MAGIC_CD := 2.2
const MAGIC_SPD_M := 260.0 * 0.02
const MAGIC_DMG_MUL := 1.15
const MAGIC_LIFE := 2.6
const MAGIC_COLOR := Color(0.72, 0.4, 1.0)
const RARE_HP_MUL := 3.2
const RARE_DMG_MUL := 1.35
const RARE_GAIN_MUL := 4.0
## G-0211 미니보스(웹 side.js 224 — 체력·공격 배수는 spawner boost 로) · 미니·희귀 몸 1.25배(웹 side-view.js 1029, 판정 상자는 그대로)
const MINI_GAIN_MUL := 8.0
const BIG_LOOK_MUL := 1.25

signal died

const COLOR := Color(0.788, 0.659, 0.227)  # data-enemy.js 황건적 color '#c9a83a'
const BOSS_VISUAL_SCALE := 1.6
const OVERLAP_RANGE := 0.6  # (P_W/2 + enemy_w/2)px * SCALE = (13+17)*0.02
const ATTACK_COOLDOWN := 1.0  # side.js e.cd = 1.0 그대로

var is_boss := false
var is_ranged := false
var boss_hp_mul := StoryCombat.BOSS_HP_MUL
var boss_dmg_mul := StoryCombat.BOSS_DMG_MUL
var enemy_lv := 1.0
var enemy_color := COLOR
var stage_key := ""  # data-quest.js goal.stage 그대로 — story_save_state.gd stage_kills 참고
var hp: float
var max_hp: float
var _dead := false
var _creature: Node3D
var _attack_cd_left := 0.0
var _shot_cd_left := 0.0

## PLAN 101-2 STORY ④후보(웹판 §5-4 "관문 대장") — `story_boss_spawner.gd`
## 가 `is_boss`처럼 add_child 전에 세팅한다. 체력·공격 배율은 기존 보스
## 배율 위에 곱한다(웹판 "체력 잡졸×40·공격×2.5"는 이 슬라이스의 잡졸
## 기준과 안 맞아 배율을 다시 잡았다 — 재해석). 3단 체력바는 화면 UI가
## 없어(이 슬라이스는 HP 숫자 바도 안 띄운다) 문턱만 내부에서 잰다(
## 진단·기획 문서용, 화면 표시는 다음에 볼 자리).
const CHAMPION_HP_MUL := 2.5
const CHAMPION_DMG_MUL := 1.5
const CHAMPION_VISUAL_SCALE := 1.9  # BOSS_VISUAL_SCALE(1.6)보다 한 단 더
const CHAMPION_ENRAGE_SEC := 180.0        # 웹판 "제한 시간 3분(초과 시 광폭 +50%)"
const CHAMPION_ENRAGE_DMG_MUL := 1.5
const CHAMPION_SHIELD_THRESHOLD_PCT := 0.3  # 웹판 "누적 피해 30% → 방패 깨짐"
const CHAMPION_SHIELD_VULN_SEC := 10.0      # 웹판 "10s 취약 ×1.5"
const CHAMPION_SHIELD_VULN_MUL := 1.5
const CHAMPION_EXP_MUL := 2.0  # 웹판 "고유 장비 확정+주문서+기억 조각" 재해석 — 기억 조각
const CHAMPION_GOLD_MUL := 2.0  # 시스템이 없어(비경 미구현) 경험·금 보너스로 갈음

var is_champion := false
var _champion_elapsed := 0.0
var _champion_dmg_taken := 0.0  # 취약 배율 적용 전 원본 피해 누적(방패 문턱 판정용)
var _champion_shield_broken := false
var _champion_vuln_time_left := 0.0

## G-0205 — 사냥터 보스(관문 대장 제외)만 패턴전. 아래 셋은 story_boss_spawner 가 add_child 전에 넣는다.
var boss_pattern: RefCounted = null
var boss_name := "보스"
var intro_done := false   # G-0339 등장 띠(공용 boss_banner) — 패턴전 거리(is_near) 안에 처음 들면 한 번, 띠 동안 첫 패턴 미룸
const INTRO_GRACE := 2.0
var stage_width_m := 0.0
var minion_color := COLOR
var _bp_api: Dictionary = {}
## G-0206 달려들기(웹 side.js 1802 — 보스·관문 대장 공통): 쿨 4~7초 뒤 near 면 1.1초 동안 플레이어 쪽으로 미끄러진다
## (고돗 4종횡 적은 원래 걷지 않는다 — 돌진 중에만 움직이고 끝나면 그 자리). 속도 = 웹 spd(38+min(40, lv×2))×1.25(near)×2.6.
const CHARGE_T := 1.1
const CHARGE_MUL := 2.6
const CHARGE_TELL_R := 46.0 * 0.02
const CHARGE_WARN_SEC := 0.9
var _charge_t := 0.0
var _charge_cd := -1.0
var _charge_dir := 1.0
var _charge_rng := RandomNumberGenerator.new()
var _groggy_label: Label3D = null
var species: Dictionary = {} # G-0209 — 사냥터 잡몹의 종(StoryEnemies.ENEMIES 한 줄). spawner 가 add_child 전에 넣는다.
var walk_dir := 1.0          # G-0209 — 걷는 방향(spawner 가 자체 RNG 로)
var walking := false         # 이 틱에 걸었는지(점검·몸짓)
var _anim := ""
var role := ""               # G-0210 — ranged|dash|tank|melee|magic(spawner 가 넣음, 비면 종으로)
var is_rare := false         # G-0210 — 희귀형(spawner 굴림)
## G-0314 띄우기·공중 콤보(data/story_launch.gd) — 런타임 칸, 세이브 없음
var launch_air := false
var launch_hits := 0
var launch_ground_y := 0.0
var launch_vy := 0.0
var launch_dmg := 0.0
var role_seed := 0           # G-0210 — 돌진 쿨·마법 쿨 흔들림용(spawner RNG 에서 — 전역 randf 안 씀)
var is_mini := false         # G-0211 — 미니보스(spawner boost). is_boss 는 false 그대로(보스 처치 수·사제 유대 불변)
var mini_hp_mul := 1.0
var mini_dmg_mul := 1.0
var guard := false           # G-0211 — 붙잡힌 사람을 지키는 잡몹(spawner 가 다 잡혔나 본다)
var shots_fired := 0         # 점검용
var _role_rng := RandomNumberGenerator.new()
var _dash_t := 0.0
var _dash_cd := 0.0
var _dash_dir := 1.0


func _ready() -> void:
	var base_hp: float = StoryCombat.enemy_base_hp(enemy_lv)
	if is_boss:
		hp = base_hp * boss_hp_mul * (CHAMPION_HP_MUL if is_champion else 1.0)
		add_to_group("story_boss")
	else:
		hp = base_hp
	add_to_group("story_enemy")
	if not species.is_empty():
		enemy_color = Color(String(species.color))
		var w := String(species.get("weapon", ""))
		is_ranged = w == "bow" or w == "staff"
		if role == "":
			role = StoryEnemies.role_of(species)
		_role_rng.seed = role_seed
		if role == "dash":
			_dash_cd = 3.0 + _role_rng.randf() * 2.0
		if not is_boss:
			hp *= hp_mul()
	max_hp = hp
	_spawn_visual()
	if is_rare and roams():
		_float_mark("✨", 0.0, Color(1.0, 0.9, 0.4))
		Toast.show(self, "✨ 희귀 %s 등장!" % String(species.get("name", "")), 2.5)
	if is_boss and boss_pattern == null:
		## 사냥터 보스는 패턴전(G-0205), 관문 대장은 고유 기술만(G-0206 gate)
		boss_pattern = StoryBossPattern.new(hash(stage_key) % 100000 + 13, boss_name, is_champion)
	if is_boss:
		_charge_rng.seed = hash(stage_key) % 100000 + 29
		_charge_cd = 4.0 + _charge_rng.randf() * 3.0


func _spawn_visual() -> void:
	var scale_mul: float = (CHAMPION_VISUAL_SCALE if is_champion else BOSS_VISUAL_SCALE) if is_boss else 1.0
	## 2026-09-30 — 색 캡슐이 몸이던 것을 짐승 공방 몸으로. 정면(+Z)이 옆(±X)을 보게 _face 가 매 틱 플레이어 쪽으로 돌린다.
	var kind := body_kind()
	_creature = CreatureBuilder.build(kind,
		[enemy_color, enemy_color.darkened(0.4), enemy_color.lightened(0.45)], {"enemy": true})
	var look_mul: float = BIG_LOOK_MUL if (is_mini or is_rare) and not is_boss else 1.0   # G-0211
	CreatureBuilder._fit(_creature, kind, 1.6 * scale_mul * look_mul * StoryLook.BODY_SCALE)   # G-0187 그림만 크게(아래 판정 상자는 그대로)
	add_child(_creature)
	_play_anim("idle")

	var cs := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.6 * scale_mul
	shape.height = 1.6 * scale_mul
	cs.position = Vector3(0, 0.8 * scale_mul, 0)
	cs.shape = shape
	add_child(cs)


func _physics_process(delta: float) -> void:
	if _dead:
		return
	if preload("res://games/saga_story/data/story_launch.gd").tick(self, delta):   # G-0314 떠 있는 동안 걷기·몸 닿기·패턴 없음
		return
	_attack_cd_left = maxf(0.0, _attack_cd_left - delta)
	_shot_cd_left = maxf(0.0, _shot_cd_left - delta)
	if is_champion:
		_champion_elapsed += delta
		_champion_vuln_time_left = maxf(0.0, _champion_vuln_time_left - delta)
	var player := get_tree().get_first_node_in_group("player")
	if player == null or not player.has_method("take_damage"):
		return
	var scale_mul: float = (CHAMPION_VISUAL_SCALE if is_champion else BOSS_VISUAL_SCALE) if is_boss else 1.0
	var dx: float = player.global_position.x - global_position.x
	if roams():
		_walk(delta, player, dx)
		dx = player.global_position.x - global_position.x
		if _creature != null:
			_creature.rotation.y = PI * 0.5 if walk_dir > 0.0 else -PI * 0.5
	elif _creature != null and absf(dx) > 0.1:
		_creature.rotation.y = PI * 0.5 if dx > 0.0 else -PI * 0.5
	## G-0205 — 패턴전은 붙어 치기와 나란히 돈다(웹 side.js 1819 — 몸통 박치기는 그대로).
	if boss_pattern != null:
		var near := StoryBossPattern.is_near(self, player)
		if near and not intro_done:
			intro_done = true
			var tags: Array = ["Lv.%d" % int(enemy_lv)] + (["🚪 관문 대장"] if is_champion else [])
			if preload("res://saga_core/ui/boss_banner.gd").pop(get_tree().current_scene, boss_name, " · ".join(tags), enemy_color) != null and not boss_pattern.call("busy"):
				boss_pattern.set("cd", maxf(float(boss_pattern.get("cd")), INTRO_GRACE))   # G-0339 띠 동안 첫 패턴 미룸
		var api := _pattern_api(player)
		if boss_pattern.gate:
			boss_pattern.step_sig(self, player, delta, near, api)
		else:
			boss_pattern.step(self, player, delta, near, api)
		if _dead:
			return
		if boss_pattern.begun:
			_charge_cd = maxf(_charge_cd, boss_pattern.t + 1.2) # 패턴이 풀릴 때까지 달려들기를 미룬다(웹 begin)
		_show_groggy(boss_pattern.groggy > 0.0)
		if boss_pattern.groggy > 0.0:
			_charge_t = 0.0
			return # 그로기 — 멈춰 선다(박치기·돌진 없음)
	if is_boss:
		_tick_charge(delta, player, dx)

	if _attack_cd_left <= 0.0 and absf(dx) <= OVERLAP_RANGE * scale_mul:
		_attack_cd_left = ATTACK_COOLDOWN
		var base_dmg: float = StoryCombat.enemy_base_dmg(enemy_lv)
		var dmg: float = base_dmg * (boss_dmg_mul if is_boss else dmg_mul())
		if boss_pattern != null:
			dmg *= boss_pattern.dmg_mul()   # G-0205 광폭
		if is_champion:
			dmg *= CHAMPION_DMG_MUL
			if _champion_elapsed >= CHAMPION_ENRAGE_SEC:
				dmg *= CHAMPION_ENRAGE_DMG_MUL
		player.take_damage(dmg)

	if is_ranged and not is_boss and _shot_cd_left <= 0.0 and absf(dx) <= shot_range():
		_shot_cd_left = StoryCombat.RANGED_STAFF_CD_SEC if is_staff() else StoryCombat.RANGED_CD_SEC
		_fire_shot(dx)
	## G-0210 마법형 — 높이를 안 가리고 사거리 안이면 쏜다(첫 발은 바로 — 웹 shotCd 0)
	if role == "magic" and roams() and _shot_cd_left <= 0.0 and absf(dx) < MAGIC_RANGE_M:
		_shot_cd_left = MAGIC_CD * (0.8 + _role_rng.randf() * 0.4)
		_fire_magic(dx)


## G-0210 — 역할·희귀 배수(보스·부하·비경은 role ""·희귀 아님 = 1)
func hp_mul() -> float:
	var m := 1.0
	if role == "tank":
		m *= TANK_HP_MUL
	elif role == "magic":
		m *= MAGIC_HP_MUL
	return m * (RARE_HP_MUL if is_rare else 1.0) * (mini_hp_mul if is_mini else 1.0)


func dmg_mul() -> float:
	return (TANK_DMG_MUL if role == "tank" else 1.0) * (RARE_DMG_MUL if is_rare else 1.0) * (mini_dmg_mul if is_mini else 1.0)


func dashing() -> bool:
	return _dash_t > 0.0


## G-0209 — 몸 모양: 종이 있으면 form, 없으면 사냥터 몸(지금 그대로).
func body_kind() -> String:
	if species.is_empty():
		return String(KIND_BY_STAGE.get(stage_key, "goblin"))
	if String(species.get("name", "")).contains("코끼리"):
		return "beast"
	return String(FORM_KIND.get(String(species.get("form", "")), "goblin"))


## 순찰·추격하는 잡몹인가(종이 있는 사냥터 잡몹만)
func roams() -> bool:
	return not species.is_empty() and not is_boss


func is_staff() -> bool:
	return String(species.get("weapon", "")) == "staff"


func shot_range() -> float:
	return StoryCombat.RANGED_STAFF_RANGE_M if is_staff() else StoryCombat.RANGED_RANGE_M


## 웹 spd = 42 + min(50, lv×2) px/s (탱커 ×0.6)
func walk_speed() -> float:
	return (42.0 + minf(50.0, enemy_lv * 2.0)) * 0.02 * (TANK_SPD_MUL if role == "tank" else 1.0)


## G-0209 — 웹 side.js 적 루프: near 면 플레이어 쪽으로 돌아서 ×1.25, 아니면 그 방향으로 ×0.7 순찰.
## 원거리는 같은 높이·사거리 안·HOLD_M 보다 멀면 멈춰 선다(holding). 사냥터 끝 여백에서 돌아선다.
func _walk(delta: float, player: Node3D, dx: float) -> void:
	var dy: float = absf(player.global_position.y - global_position.y)
	var near := absf(dx) < NEAR_X_M and dy < NEAR_Y_M
	if near:
		walk_dir = 1.0 if dx > 0.0 else -1.0
	var holding := false
	if is_ranged and dy < FLAT_Y_M and absf(dx) < shot_range():
		walk_dir = 1.0 if dx > 0.0 else -1.0
		holding = absf(dx) > HOLD_M
	elif role == "magic" and absf(dx) < MAGIC_RANGE_M:   # G-0210 마법형은 높이를 안 가린다
		walk_dir = 1.0 if dx > 0.0 else -1.0
		holding = absf(dx) > HOLD_M
	## G-0210 돌진형(웹 1803 — 보스 달려들기를 빌림): 쿨 다하고 near 면 1.1초 ×2.6(방향 고정), 다음 쿨 5~8초
	var mul: float = NEAR_MUL if near else PATROL_MUL
	if role == "dash":
		if _dash_t > 0.0:
			_dash_t -= delta
			walk_dir = _dash_dir
			mul *= CHARGE_MUL
		else:
			_dash_cd -= delta
			if _dash_cd <= 0.0 and near:
				_dash_t = CHARGE_T
				_dash_cd = 5.0 + _role_rng.randf() * 3.0
				_dash_dir = walk_dir
				_charge_tell()
	walking = not holding
	if walking:
		global_position.x += walk_dir * walk_speed() * mul * delta
	if stage_width_m > 0.0:
		if global_position.x < EDGE_L_M:
			global_position.x = EDGE_L_M
			walk_dir = 1.0
			_dash_t = 0.0
		elif global_position.x > stage_width_m - EDGE_R_M:
			global_position.x = stage_width_m - EDGE_R_M
			walk_dir = -1.0
			_dash_t = 0.0
	_play_anim("walk" if walking else "idle")


func _play_anim(anim: String) -> void:
	if anim == _anim or _creature == null:
		return
	var ap := _creature.get_node_or_null("AnimationPlayer") as AnimationPlayer
	if ap != null and ap.has_animation(anim):
		ap.play(anim)
		_anim = anim


## G-0206 달려들기 — 쿨이 다하고 보스가 나를 보면 1.1초 미끄러진다(예고: 몸 둘레 원 0.3초 + "!" 0.9초).
func _tick_charge(delta: float, player: Node3D, dx: float) -> void:
	if _charge_t > 0.0:
		_charge_t -= delta
		var spd := (38.0 + minf(40.0, enemy_lv * 2.0)) * 1.25 * CHARGE_MUL * 0.02
		var nx := global_position.x + _charge_dir * spd * delta
		global_position.x = clampf(nx, 0.6, stage_width_m - 0.6) if stage_width_m > 0.0 else nx
		return
	_charge_cd -= delta
	var busy: bool = boss_pattern != null and boss_pattern.busy()
	if _charge_cd <= 0.0 and not busy and StoryBossPattern.is_near(self, player):
		_charge_t = CHARGE_T
		_charge_cd = 5.0 + _charge_rng.randf() * 3.0
		_charge_dir = 1.0 if dx > 0.0 else -1.0
		_charge_tell()


## 달려들기 예고(보스·돌진형 잡몹 공통) — 몸 둘레 원 0.3초 + "!" 0.9초
func _charge_tell() -> void:
	var tell := CombatTell.ring(self, global_position, CHARGE_TELL_R + 0.8, 0.3, Color(1.0, 0.3, 0.2))
	if tell != null:
		tell.rotation.x = PI * 0.5
	_float_mark("!", CHARGE_WARN_SEC, Color(1.0, 0.35, 0.25))


## 머리 위 글자 표시(달려들기 "!" · 그로기 "💫").
func _float_mark(text: String, sec: float, col: Color) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font_size = 72
	l.pixel_size = 0.012
	l.modulate = col
	l.outline_size = 14
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	add_child(l)
	var head: float = (CHAMPION_VISUAL_SCALE if is_champion else BOSS_VISUAL_SCALE) if is_boss else 1.25   # G-0210 잡몹은 제 키 위
	l.position = Vector3(0, 2.6 * head * 0.9, 0)
	if sec > 0.0:
		get_tree().create_timer(sec).timeout.connect(l.queue_free)
	return l


func _show_groggy(on: bool) -> void:
	if on and _groggy_label == null:
		_groggy_label = _float_mark("💫", 0.0, Color(1.0, 0.95, 0.5))
	elif not on and _groggy_label != null:
		_groggy_label.queue_free()
		_groggy_label = null


## G-0205 — 패턴전이 바깥 일을 하는 길(웹 bpApi). Callable 은 한 번 만들고 값만 매 틱 갈아 넣는다.
func _pattern_api(player: Node) -> Dictionary:
	if _bp_api.is_empty():
		_bp_api = {"hurt": _bp_hurt, "spawn": _spawn_minion, "toast": _bp_toast, "shake": _bp_shake, "on_ground": _bp_on_ground}
	_bp_api.dmg = StoryCombat.enemy_base_dmg(enemy_lv) * boss_dmg_mul * boss_pattern.dmg_mul() * (CHAMPION_DMG_MUL if is_champion else 1.0)
	_bp_api.charging = _charge_t > 0.0
	_bp_api.hp = hp
	_bp_api.hp_max = max_hp
	_bp_api.player_hp_max = float(player.get("max_hp")) if player.get("max_hp") != null else 100.0
	_bp_api.name = boss_name
	_bp_api.width = stage_width_m
	return _bp_api


func _bp_hurt(amount: float) -> void:
	var p := get_tree().get_first_node_in_group("player")
	if p != null and p.has_method("take_damage"):
		p.take_damage(amount)


func _bp_toast(msg: String) -> void:
	Toast.show(self, msg, 2.5)


func _bp_shake(amp: float, sec: float) -> void:
	var rig := get_tree().get_first_node_in_group("camera_rig")
	if rig != null and rig.has_method("shake"):
		rig.shake(amp, sec)


func _bp_on_ground() -> bool:
	var p := get_tree().get_first_node_in_group("player")
	return p != null and p.has_method("is_on_floor") and p.is_on_floor()


## 부하 하나 — 사냥터 잡졸과 같은 규칙(보상·처치 수)으로 보스 곁에.
func _spawn_minion(x: float) -> void:
	var m := Node3D.new()
	m.set_script(get_script())
	m.enemy_lv = enemy_lv
	m.enemy_color = minion_color
	m.stage_key = stage_key
	m.position = Vector3(clampf(x, 0.6, stage_width_m - 0.6) if stage_width_m > 0.0 else x, position.y, 0.0)
	get_parent().add_child(m)


## side.js eshot 그대로: dir·spd(RANGED_SPD_M)로 날아가 RANGED_MUL만큼
## 깎인 피해를 준다(enemy_base_dmg(enemy_lv) 기준 — 근접 피해와 같은
## lv 공식에서 갈라져 나온다).
func _fire_shot(dx: float) -> void:
	var dir: float = 1.0 if dx > 0.0 else -1.0
	var staff := is_staff()   # G-0209 조총은 웹 RANGED_WEAPON.staff 값
	var dmg: float = StoryCombat.enemy_base_dmg(enemy_lv) * (StoryCombat.RANGED_STAFF_MUL if staff else StoryCombat.RANGED_MUL) * dmg_mul()
	shots_fired += 1
	var shot := Area3D.new()
	shot.set_script(StoryEnemyShot)
	shot.dir = dir
	shot.speed = StoryCombat.RANGED_STAFF_SPD_M if staff else StoryCombat.RANGED_SPD_M
	shot.damage = dmg
	shot.life_left = StoryCombat.RANGED_LIFE_SEC
	get_parent().add_child(shot)
	shot.global_position = global_position + Vector3(dir * 0.5, 0.9, 0)   # G-0209 — 트리에 넣은 뒤에(전엔 밖에서 넣어 오류·자리 틀어짐)


## G-0210 마법형 구슬 — 웹 eshot {spd 260, dmg×1.15, homing, life 2.6}, 보라(코드 메시)
func _fire_magic(dx: float) -> void:
	var dir: float = 1.0 if dx > 0.0 else -1.0
	shots_fired += 1
	var shot := Area3D.new()
	shot.set_script(StoryEnemyShot)
	shot.dir = dir
	shot.speed = MAGIC_SPD_M
	shot.damage = StoryCombat.enemy_base_dmg(enemy_lv) * dmg_mul() * MAGIC_DMG_MUL
	shot.life_left = MAGIC_LIFE
	shot.homing = true
	shot.color = MAGIC_COLOR
	get_parent().add_child(shot)
	shot.global_position = global_position + Vector3(dir * 0.32, 0.84, 0)


## PLAN 101-2 STORY ④후보 — 관문 대장 방패(웹판 §5-4 "등 뒤에서 누적
## 피해 30% → 방패 깨짐 → 10s 취약 ×1.5"). "등 뒤" 판정은 이 슬라이스
## 전투가 방향을 안 가려(정면·원거리 판정 위주) 재해석으로 뺐다 — 누적
## 피해 문턱만 본다. 방패가 깨진 뒤 들어오는 피해에 배율을 곱한다.
func take_damage(amount: float) -> void:
	if _dead or amount <= 0.0:
		return
	var applied := amount
	if boss_pattern != null:
		applied *= boss_pattern.dmg_taken_mul()   # G-0206 그로기 ×1.5
	if is_champion:
		if _champion_vuln_time_left > 0.0:
			applied *= CHAMPION_SHIELD_VULN_MUL
		if not _champion_shield_broken:
			_champion_dmg_taken += amount
			if _champion_dmg_taken >= max_hp * CHAMPION_SHIELD_THRESHOLD_PCT:
				_champion_shield_broken = true
				_champion_vuln_time_left = CHAMPION_SHIELD_VULN_SEC
	hp -= applied
	if hp <= 0.0:
		_die()


func _die() -> void:
	if _dead:
		return
	_dead = true
	died.emit()
	StorySaveState.add_kill(stage_key)
	if is_boss:
		StorySaveState.add_boss_kill()
	if is_champion:
		StorySaveState.claim_champion(stage_key)
	## PLAN 51장 STORY "관계" 축(사제 유대, story_save_state.gd 헤더 참고) —
	## 잡졸 1·보스 8·관문 대장 20(보스이자 챔피언이라 둘 다 더함).
	StorySaveState.add_mentor_bond((8 if is_boss else 1) + (12 if is_champion else 0))
	var rare_mul: float = RARE_GAIN_MUL if is_rare else (MINI_GAIN_MUL if is_mini else 1.0)   # G-0210 웹 1181·1204 희귀 ×4 · G-0211 미니 ×8
	var reward_mul: float = (CHAMPION_EXP_MUL if is_champion else 1.0) * rare_mul
	StorySaveState.add_exp(roundi(StoryCombat.enemy_exp(is_boss, enemy_lv) * reward_mul))
	preload("res://games/saga_story/world/story_combo_kill.gd").on_kill(get_parent(), global_position, enemy_lv, is_boss)   # G-0345 콤보 킬
	var gold_mul: float = (CHAMPION_GOLD_MUL if is_champion else 1.0) * rare_mul
	StoryGoldPickup.spawn_at(get_parent(), global_position + Vector3(-0.4, 0, 0.4), roundi(StoryCombat.roll_gold(is_boss, enemy_lv) * gold_mul))
	_maybe_drop_gear()
	queue_free()


## **2026-09-13 추가(같은 날 더, tier2~4) — 사냥터 lv 기준 풀로 좁힘.**
## StoryCombat.gear_pool_for(enemy_lv)(data-gear.js poolFor와 같음, need
## <= enemy_lv+3)에서 **이미 끼고 있는 바로 그 키**만 뺀다 — 부위 전체를
## 빼던 전엔 tier1 하나뿐이라 결과가 같았지만, 이제 tier가 여럿이라
## 부위 전체를 빼면 승급(더 좋은 tier로 교체)이 영영 안 된다.
func _maybe_drop_gear() -> void:
	var pool: Array = []
	for key: String in StoryCombat.gear_pool_for(enemy_lv):
		var slot: String = String(StoryCombat.GEAR_ITEMS[key].slot)
		if String(StorySaveState.equipped.get(slot, "")) != key:
			pool.append(key)
	if pool.is_empty():
		return
	## 관문 대장은 웹판 "고유 장비 1 확정"을 그대로 좁혀 드롭 확률을 100%로
	## 올린다(고유로 바뀌는지는 아래 UNIQUE_CHANCE 굴림이 그대로 가른다).
	var bossy := is_boss or is_mini   # G-0211 웹 1198 rollDrop(lv, boss || mini) — 미니는 드롭·고유 굴림만 보스처럼
	var chance: float = 1.0 if is_champion else (StoryCombat.GEAR_DROP_CHANCE_BOSS if bossy else StoryCombat.GEAR_DROP_CHANCE_GRUNT)
	chance = minf(1.0, chance * float(StorySaveState.passive_fx("drop")))   # G-0214 성좌 드롭
	if randf() < chance:
		var picked: String = pool[randi() % pool.size()]
		## **2026-09-13 추가(같은 날 더 더, 고유) — gear.js rollDrop() 그대로:
		## 보스가 tier4 밑감(need==20)을 떨굴 때만, 그것도 UNIQUE_CHANCE(16%)
		## 로 이름 있는 물건으로 바뀐다. 그 부위에 고유가 없으면(UNIQUE_ITEMS에
		## 항목이 없으면) unique_for_base()가 ""를 줘 그냥 밑감 그대로 나간다.
		if bossy and int(StoryCombat.GEAR_ITEMS[picked].need) == 20 and randf() < StoryCombat.UNIQUE_CHANCE:
			var uniq: String = StoryCombat.unique_for_base(picked)
			if uniq != "":
				picked = uniq
		StoryGearPickup.spawn_at(get_parent(), global_position, picked)
