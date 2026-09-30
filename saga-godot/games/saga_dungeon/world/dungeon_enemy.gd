extends CharacterBody3D

## 황건적(黃巾賊, tier1, biome:ruins) — VERTICAL_SLICE_DUNGEON.md 4절.
## `data-enemy.js`의 첫 항목을 그대로 옮겼다(새 몬스터를 상상하지
## 않는다) — 색(`#c9a83a`)까지 원작 그대로. HP·공격력은 `dungeon.js`의
## `enemyHp(1,false)`·`enemyDmg(1,false)` 공식을 floor=1로 계산한 값
## (24·5) — 원작 수치 그대로, 새로 만들지 않았다. "황건적"은 후한 말
## 반란 세력을 가리키는 역사 용어이지 실존 "인물"이 아니라, 루트
## CLAUDE.md의 이름 정책(HEROES 개별 인물 실명 회피)과는 다른 경계다 —
## "산적"·"정찰병"처럼 적 부류를 가리키는 일반명사로 GO에서도 이미
## 같은 방식을 쓴다.
##
## 시각은 캡슐(hero_encounter.gd·simple_event.gd와 같은 이유 — 이 판
## 전용 GLB가 아직 없다). 공격 간격(1.4초)은 원작에 없어(플레이어 공격
## 간격만 명시돼 있었다) 이번에 직접 정했다 — 너무 잦으면 첫 전투부터
## 벅차 보인다.
##
## "제외" 목록 4번(원소 6결+저항) — data-enemy.js 황건적 항목엔 `resist`
## 키가 아예 없다(0으로 본다, 새로 상상하지 않는다). `resist_pct()`는 다음에
## 저항 있는 몬스터가 추가될 자리를 남겨 둔 것뿐이다. 빙(냉)·독(dot) 둘은
## dungeon.js applyElem()의 성질(slow·dot)을 그대로 옮겨 여기서 받는다 —
## 새 피해 공식을 안 만들고 melee_attack.gd가 결마다 값을 계산해 넘긴다.
##
## "제외" 목록 7번(보스층) — data-enemy.js BOSSES 첫 항목 "황건 두목"(황건적과
## 같은 색 '#c9a83a' 그대로 — 원작도 보스를 색이 아니라 몸집·수식어로만
## 가른다, 새 색을 상상하지 않는다). HP·공격력은 `enemyHp`/`enemyDmg`의
## `boss` 갈래(*7·*2.2) 그대로 — 위 함수 이름이 이미 `boss` 인자를 받게
## 지어져 있었다(이번에 처음 실제로 쓴다). 몸집은 dungeon.js spawnEnemy()의
## `r = boss?22:13`(≈1.7배) 그대로 캡슐 반지름·높이·공격 사거리에 적용.
##
## **정예(精銳, 2026-09-14, 51장 "엘리트" 축)** — dungeon.js ELITES·
## eliteChance()·spawnEnemy()의 정예 갈래를 그대로 옮겼다("원작(디아블로)의
## 파란/노란 이름 몬스터", 주석 원문 그대로). 보스·그림자 분신에는 안 붙는다.
## 몸집(r 13→16)·색·효과 하나(속도·완력·저항·재생·가시·분열)가 붙고,
## `loot_pickup.gd`가 확정 드랍(이미 이 슬라이스는 잡졸도 확정이라 변화 없음)
## ·금 배율(2.2×)·아이템레벨 보너스(+14)·단약 확률(34%)을 정예 갈래로 받는다.
##
## **부적 던전(符籍, 2026-09-17, PLAN 101-2 DUNGEON ④)** — `DungeonSigilState`
## 가 부적이 켜져 있을 때만 반응하는 다섯 자리를 이 파일에 얹었다:
## 정예 확률(`_init`)·HP·공격력 배율(`_init` 끝, 한 자리에서 둘 다)·
## 이동 속도(`_physics_process`)·재생(`_tick_regen`)·저항(`resist_pct`).
## 전부 부적이 안 켜져 있으면(has_mod()가 false) 조용히 아무 효과가 없다
## — 새 분기가 아니라 기존 값에 배율 하나씩만 더 곱하는 자리다.
##
## **난입(亂入, 2026-09-17, PLAN 101-2 DUNGEON ⑤)** — `_init()` 꼬리 인자
## `extra_stat_mult`(기본 1.0)를 horde_arena.gd가 넘긴다. 부적과 같은
## "맨 끝에 한 번 더 곱한다" 자리, 서로 안 얽힌다.
##
## **월드 보스(2026-09-17, PLAN 101-2 DUNGEON ⑥)** — `_init()` 꼬리 인자
## `hp_only_extra_mult`(기본 1.0)를 world_boss_director.gd가 넘긴다.
## extra_stat_mult와 달리 max_hp에만 곱한다("체력만 8배", 공격력은 그대로).

signal died

const ATTACK_COOLDOWN := 1.4  # 원작에 없는 값 — 직접 정함(위 주석 참고)
const CHASE_SPEED := 2.4
const DETECT_RADIUS := 9.0
const ATTACK_RANGE := 2.0
const COLOR := Color(0.788, 0.659, 0.227)  # data-enemy.js 황건적 color '#c9a83a' 그대로
const BOSS_SCALE := 22.0 / 13.0  # dungeon.js spawnEnemy()의 r = boss?22:13 그대로
const ELITE_SCALE := 16.0 / 13.0  # spawnEnemy()의 정예 r=16 그대로
const SHADE_SCALE := 10.0 / 13.0  # spawnEnemy()의 그림자 분신 r=10 그대로
const LootPickup := preload("res://games/saga_dungeon/world/loot_pickup.gd")
const CreatureBuilder := preload("res://games/saga_go/world/creature_builder.gd")  # 색 캡슐 대신 GO 짐승 공방 몸(2026-09-30)
const Toast := preload("res://saga_core/ui/toast.gd")  # "그림자가 갈라졌다" 토스트용

## dungeon.js ELITES 그대로(8종, 색까지 원작 값) — hp/dmg 배율 없는 항목은
## spawnEnemy()의 기본값(1.35/1.15)을 쓴다(아래 _init에서 처리).
const ELITES: Array[Dictionary] = [
	{"key": "swift", "name": "날쌘", "color": "#6ad9e0", "spd": 1.9, "cd": 0.55},
	{"key": "tough", "name": "완강한", "color": "#8a9ab2", "hp": 2.6},
	{"key": "fierce", "name": "사나운", "color": "#e06565", "dmg": 1.9},
	{"key": "regen", "name": "되살아나는", "color": "#7ec96a", "regen": 0.035},
	{"key": "thorn", "name": "가시 돋친", "color": "#c98ae0", "thorn": 0.22},
	{"key": "shade", "name": "그림자", "color": "#9a7ad9", "split": 2},
	{"key": "plated", "name": "철갑 두른", "color": "#9aa3b2", "resist": {"phys": 35.0}},
	{"key": "warded", "name": "호신 두른", "color": "#6ad9e0", "resist": {"chi": 45.0}},
]

## 이 몬스터의 결별 저항(% ) — 황건적은 원작에 저항 키가 없어 빈 채로 둔다.
## 정예(철갑 두른·호신 두른)만 이 자리를 채운다(아래 _init).
var resist: Dictionary = {}
var elite_key: String = ""  # dungeon.js e.elite 그대로 — 없으면 빈 문자열
var _elite_def: Dictionary = {}  # ELITES[i] 그대로(빠른 재조회용 캐시)
var _is_shade: bool = false  # 그림자 분신 자신인지 — 정예 굴림·재분열을 막는다
var _dots: Array[Dictionary] = [] # [{dps, t}] — applyElem()의 독(pois) dot과 같은 모양
var _slow_mult := 1.0
var _slow_time_left := 0.0
var _hex_v := 0.0 # PLAN.md 51장 "장비→빌드" — 저주(curse)가 거는 "더 아파한다"
var _hex_time_left := 0.0

## "여러 방 연결"(§28-8 A안 이전의 최소 버전) — 방을 층처럼 취급해 웹판
## `dungeon.js`의 `enemyHp(floor, boss)`·`enemyDmg(floor, boss)` 공식을
## 그대로 옮겼다: `round(24 * 1.26^(floor-1))`·`round(5 * 1.20^(floor-1))`
## (boss=false 고정, mode().hp/dmg는 난도 시스템이 없어 1로 취급 — 기존
## 방 0의 24/5와 정확히 일치하는 걸로 확인). 새 몬스터를 상상하지 않고
## 같은 잡졸이 층마다 세지기만 한다.
var max_hp: float
var attack_damage: float
var hp: float
var _floor_num: int = 1
var is_boss: bool = false
var _scale_mul: float = 1.0
var _creature: Node3D
var _anim := ""
var _attack_cd_left := 0.0
var _player: Node3D
var _dead := false


## dungeon.js eliteChance(floor) 그대로 — 깊을수록 잦다(상한 30%).
static func _elite_chance(floor_num: int) -> float:
	return minf(0.30, 0.06 + float(floor_num) * 0.012)


## shade=true는 kill()이 만드는 그림자 분신 전용(spawnEnemy()의 opts.shade
## 그대로) — boss와 마찬가지로 정예가 안 붙는다("!opts.spawned" 그대로,
## 여기선 shade 인자 자체가 그 역할).
## force_elite=true는 dungeon.js spawnEnemy(floor, false, {forceElite:true})
## 그대로 — "정예 소굴"(POI: Elite) 방이 확률 없이 정예 하나를 반드시
## 끼우는 자리에서만 쓴다(test_room.gd::_spawn_elite_den).
func _init(floor_num: int = 1, boss: bool = false, shade: bool = false, force_elite: bool = false, extra_stat_mult: float = 1.0, hp_only_extra_mult: float = 1.0) -> void:
	_floor_num = floor_num
	is_boss = boss
	_is_shade = shade
	_scale_mul = BOSS_SCALE if boss else 1.0
	max_hp = roundf(24.0 * pow(1.26, floor_num - 1) * (7.0 if boss else 1.0))
	attack_damage = roundf(5.0 * pow(1.20, floor_num - 1) * (2.2 if boss else 1.0))
	## PLAN 101-2 DUNGEON ④(부적 던전, 2026-09-17) — "정예 2배" 부적이
	## 켜져 있으면 정예 확률만 두 배(상한 90%, 완전 확정은 안 만든다).
	var elite_chance := _elite_chance(floor_num)
	if DungeonSigilState.has_mod("elite_double"):
		elite_chance = minf(0.9, elite_chance * 2.0)
	if not boss and not shade and (force_elite or randf() < elite_chance):
		_elite_def = ELITES[randi() % ELITES.size()]
		elite_key = str(_elite_def.key)
		max_hp = roundf(max_hp * float(_elite_def.get("hp", 1.35)))
		attack_damage = roundf(attack_damage * float(_elite_def.get("dmg", 1.15)))
		_scale_mul = ELITE_SCALE
		resist = (_elite_def.get("resist", {}) as Dictionary).duplicate()
	if shade:
		## spawnEnemy()의 shade 갈래 — hp*0.34·dmg*0.6·r=10, 정예 배율보다
		## 나중에 적용된다(원작도 elite 갈래 뒤에 shade 갈래가 온다).
		max_hp = maxf(1.0, roundf(max_hp * 0.34))
		attack_damage = roundf(attack_damage * 0.6)
		_scale_mul = SHADE_SCALE
	## PLAN 101-2 DUNGEON ④(부적 던전) — "적 배율 1+0.35×T"를 정예·그림자
	## 배율까지 다 곱해진 마지막에 한 번 더 곱한다(원작 순서와 같은 자리 —
	## 티어 배율은 전부를 함께 키운다).
	var sigil_mul := DungeonSigilState.enemy_stat_mult()
	if sigil_mul != 1.0:
		max_hp = roundf(max_hp * sigil_mul)
		attack_damage = roundf(attack_damage * sigil_mul)
	## PLAN 101-2 DUNGEON ⑤(난입, 2026-09-17) — horde_arena.gd가 난입
	## 잡졸에만 티어 배율(1+0.35×파도/8, dungeon_horde_state.gd 참고)을
	## 넘긴다. 던전 스폰(기본값 1.0)은 전혀 안 바뀐다 — 부적과 같은 자리에서
	## 한 번 더 곱할 뿐, 서로의 존재를 모른다("충돌 없음").
	if extra_stat_mult != 1.0:
		max_hp = roundf(max_hp * extra_stat_mult)
		attack_damage = roundf(attack_damage * extra_stat_mult)
	## PLAN 101-2 DUNGEON ⑥(월드 보스, 2026-09-17) — 웹 5.4 "체력 8배"는
	## 체력만 말한다(공격력은 그대로) — extra_stat_mult와 달리 max_hp에만
	## 곱한다. dungeon_worldboss_state.gd 참고.
	if hp_only_extra_mult != 1.0:
		max_hp = roundf(max_hp * hp_only_extra_mult)
	hp = max_hp


func _ready() -> void:
	add_to_group("dungeon_enemy")
	if is_boss:
		add_to_group("dungeon_boss")
	_player = get_tree().get_first_node_in_group("player")
	_spawn_visual()


func _spawn_visual() -> void:
	## enemyName()의 정예 접두처럼, 시각도 정예 색이 잡졸 색을 덮는다. 보스는 곰, 나머지는 도깨비꼴.
	var col: Color = Color(String(_elite_def.color)) if not _elite_def.is_empty() else COLOR
	var kind := "bear" if is_boss else "goblin"
	_creature = CreatureBuilder.build(kind, [col, col.darkened(0.4), col.lightened(0.45)], {"enemy": true})
	CreatureBuilder._fit(_creature, kind, 1.7 * _scale_mul)
	add_child(_creature)
	_play_anim("idle")

	var cs := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.7 * _scale_mul
	shape.height = 1.7 * _scale_mul
	cs.position = Vector3(0, 0.85 * _scale_mul, 0)
	cs.shape = shape
	add_child(cs)


func _physics_process(delta: float) -> void:
	if _dead:
		return
	_tick_dots(delta)
	_tick_regen(delta)
	if _dead or _player == null:
		return
	_tick_slow(delta)
	_tick_hex(delta)
	_attack_cd_left = maxf(0.0, _attack_cd_left - delta)
	var to_player: Vector3 = _player.global_position - global_position
	to_player.y = 0
	var dist := to_player.length()
	if dist <= ATTACK_RANGE * _scale_mul:
		velocity = Vector3.ZERO
		if _attack_cd_left <= 0.0:
			## dungeon.js "en.cd = ENEMY_CD * (elite.cd||1) / chill" 그대로
			## (chill=냉기 감속, 우리는 몬스터 자신이 냉기에 걸릴 일이 없어
			## 그 인자는 안 옮긴다 — 새 규칙을 안 만든다).
			_attack_cd_left = ATTACK_COOLDOWN * float(_elite_def.get("cd", 1.0))
			_attack_player()
	elif dist <= DETECT_RADIUS:
		## dungeon.js "* (elite.spd||1) * chill" 그대로 — 정예 속도 배율에
		## 빙결 감속(_slow_mult)까지 곱한다. PLAN 101-2 DUNGEON ④(부적
		## 던전) — "swift" 부적이 켜져 있으면 +30%를 한 번 더 곱한다.
		var sigil_speed_mul := 1.3 if DungeonSigilState.has_mod("swift") else 1.0
		velocity = to_player.normalized() * CHASE_SPEED * float(_elite_def.get("spd", 1.0)) * _slow_mult * sigil_speed_mul
	else:
		velocity = Vector3.ZERO
	move_and_slide()
	_face_and_animate(to_player)


## 몸을 플레이어 쪽으로 돌리고(걷는 중이면 walk, 아니면 idle).
func _face_and_animate(to_player: Vector3) -> void:
	if _creature == null:
		return
	if to_player.length_squared() > 0.01:
		_creature.rotation.y = lerp_angle(_creature.rotation.y, atan2(to_player.x, to_player.z), 0.25)
	_play_anim("walk" if velocity.length_squared() > 0.05 else "idle")


func _play_anim(anim: String) -> void:
	if anim == _anim or _creature == null:
		return
	var ap := _creature.get_node_or_null("AnimationPlayer") as AnimationPlayer
	if ap != null and ap.has_animation(anim):
		ap.play(anim)
		_anim = anim


## dungeon.js applyElem()의 독(pois) dot과 같은 모양 — dps*t로 몇 초에
## 걸쳐 나눠 문다. update()의 p.dots 틱과 같은 자리(여기선 적 쪽).
func _tick_dots(delta: float) -> void:
	if _dots.is_empty():
		return
	var i := _dots.size() - 1
	while i >= 0:
		var d: Dictionary = _dots[i]
		var dmg: float = float(d.dps) * delta
		hp -= dmg
		d.t = float(d.t) - delta
		if d.t <= 0.0:
			_dots.remove_at(i)
		else:
			_dots[i] = d
		i -= 1
	if hp <= 0.0:
		_die()


## dungeon.js "if (el && el.regen && en.hp < en.hpMax) { en.hp += en.hpMax *
## el.regen * dt }" 그대로 — "되살아나는" 정예만 해당(그 밖엔 regen 키가
## 없어 0으로 조회돼 그냥 지나간다).
func _tick_regen(delta: float) -> void:
	var rate: float = float(_elite_def.get("regen", 0.0))
	## PLAN 101-2 DUNGEON ④(부적 던전) — "regen" 부적은 정예 여부와 무관
	## 하게 모든 적에게 초당 1%를 준다("되살아나는" 정예의 기존 값이 더
	## 세면 그쪽을 그대로 쓴다 — 더 센 쪽 유지).
	if DungeonSigilState.has_mod("regen"):
		rate = maxf(rate, 0.01)
	if rate <= 0.0 or hp >= max_hp:
		return
	hp = minf(max_hp, hp + max_hp * rate * delta)


func _tick_slow(delta: float) -> void:
	if _slow_time_left <= 0.0:
		return
	_slow_time_left -= delta
	if _slow_time_left <= 0.0:
		_slow_mult = 1.0


func _tick_hex(delta: float) -> void:
	if _hex_time_left <= 0.0:
		return
	_hex_time_left -= delta
	if _hex_time_left <= 0.0:
		_hex_v = 0.0


## 빙(cold) — 맞은 적이 잠깐 느려진다(data-elem.js). 여러 번 맞아도
## 겹쳐 더 안 느려지고 시간만 제일 긴 것으로 갱신된다(원작 dungeon.js
## "e.slow = max(e.slow||0, def.slowSec)"와 같은 규칙).
func apply_elem_slow(mult: float, secs: float) -> void:
	if _dead:
		return
	_slow_mult = minf(_slow_mult, mult) if _slow_time_left > 0.0 else mult
	_slow_time_left = maxf(_slow_time_left, secs)


## 저주(curse) — dungeon.js "ce.hex = { v, t: sk.sec||5 }" 그대로, 새로
## 걸 때마다 값·지속시간을 덮어쓴다(슬로우와 달리 "더 센 쪽 유지" 비교가
## 원작에 없다). `take_damage()`가 조회해 들어오는 모든 피해에 곱한다 —
## 원작 strike()가 물리/무예 가리지 않고 한 곳에서 곱하는 것과 같은 효과를,
## 공격 스크립트마다 따로 체크하지 않고 여기 한 곳에 모아서 낸다.
func apply_hex(v: float, secs: float) -> void:
	if _dead:
		return
	_hex_v = v
	_hex_time_left = secs


## 독(pois) — 즉발 대신 dps*t로 나눠 문다(applyElem() 그대로).
func apply_elem_dot(dps: float, secs: float) -> void:
	if _dead or dps <= 0.0 or secs <= 0.0:
		return
	_dots.append({"dps": dps, "t": secs})


## PLAN 101-2 DUNGEON ④(부적 던전) — "resist_boost" 부적은 그 부적이
## 결정적으로 고른 한 원소(dungeon_sigil_state.gd::resist_boost_el())
## 에만 +40을 더한다.
func resist_pct(kind: String) -> float:
	var base := float(resist.get(kind, 0.0))
	if DungeonSigilState.has_mod("resist_boost") and kind == DungeonSigilState.resist_boost_el():
		base += 40.0
	return clampf(base, 0.0, DungeonItems.RESIST_CAP)


## dungeon.js strike()의 "if (elS && elS.thorn && e.hp > 0) { hurtPlayer(...) }"
## 그대로 — "가시 돋친" 정예만 해당, 맞은 만큼(전달받은 물리 피해 기준)
## 일부를 되돌려준다. 호출부(melee_attack.gd)가 실제로 플레이어에게 입힌다.
func thorn_reflect(dmg: float) -> float:
	if _dead or hp <= 0.0:
		return 0.0
	var thorn_pct: float = float(_elite_def.get("thorn", 0.0))
	if thorn_pct <= 0.0:
		return 0.0
	return maxf(1.0, roundf(dmg * thorn_pct))


func _attack_player() -> void:
	if _player.has_node("PlayerHealth"):
		_player.get_node("PlayerHealth").take_damage(attack_damage)


## **저주(hex)와 "가시 돋친" 정예의 순서 근사** — 원작 strike()는 hex
## 배율까지 곱한 최종 dmg로 e.hp를 깎고, 그 같은 dmg로 가시 반사량도
## 계산한다(둘 다 한 함수 안, 같은 변수). 여기선 반사(thorn_reflect())를
## 공격 스크립트가 이 함수 호출 "전"의 원본 dmg로 별도로 부르므로, hex가
## 걸려 있는 동안은 반사량이 그만큼 원작보다 약간 적게 계산된다 — 가시
## 정예와 저주가 동시에 걸리는 드문 조합이라 지금은 그대로 둔다(다음에
## 실제로 문제가 되면 take_damage()가 조정된 양을 돌려주는 쪽으로 고칠 것).
func take_damage(amount: float) -> void:
	if _dead or amount <= 0.0:
		return
	if _hex_time_left > 0.0:
		amount *= 1.0 + _hex_v / 100.0
	hp -= amount
	if hp <= 0.0:
		_die()


## dungeon.js kill()의 "if (elK && elK.split && !e.shade) { ... spawnEnemy(...,
## {spawned:true, shade:true, ...}) }" 그대로 — "그림자" 정예가 죽으면
## split(2)개의 약한 분신이 그 자리에 선다. 분신 자신(_is_shade)은 다시
## 갈라지지 않는다(위 가드 그대로).
func _die() -> void:
	if _dead:
		return
	_dead = true
	died.emit()
	var split: int = int(_elite_def.get("split", 0))
	if split > 0 and not _is_shade:
		var parent := get_parent()
		for i in range(split):
			## 자기 자신과 같은 스크립트로 새로 만든다(파일 안에서 자기
			## 클래스 이름을 못 쓰므로 get_script() 경유 — test_room.gd처럼
			## 바깥에서 부를 땐 그냥 DungeonEnemy.new()로 preload한다).
			var kid: CharacterBody3D = get_script().new(_floor_num, false, true)
			var offset := Vector3(0.9 if i == 0 else -0.9, 0, 0.6 if i == 0 else -0.6)
			## 트리에 먼저 넣어야 한다 — 안 그러면 global_position 대입이
			## "!is_inside_tree()" 오류를 낸다(트리 밖 Node3D는 전역 변환을
			## 못 구한다). 실측으로 잡은 문제(아래 검증 참고).
			parent.add_child(kid)
			kid.global_position = global_position + offset
		Toast.show(parent, "👤 그림자가 갈라졌다", 2.5)
	LootPickup.spawn_at(get_parent(), global_position, _floor_num, is_boss, not elite_key.is_empty())
	queue_free()
