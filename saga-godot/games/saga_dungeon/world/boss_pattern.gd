extends RefCounted

## G-0204 — 2나락 보스 패턴(웹 saga-web/saga-dungeon/js/dungeon.js bossPattern() 1893~ 이식). 예고(바닥 표시가 차오름) 뒤 터진다.
##   club 강타 — 제자리 원형 AOE · axe 돌진 — 예고가 끝나면 순간 다가서고 붙어 있으면 맞음
##   spear·halberd 관통 — 예고 시작 순간 방향을 고정, 끝나면 그 방향 긴 부채꼴(옆으로 비키면 안 맞음) · sword 연격 — 예고 뒤 세 번 벤다
## 웹은 보스 표(data-enemy.js BOSSES)의 look.weapon 으로 가르지만 고돗엔 보스 표가 없다 — 그 표의 단계(tier)별 무기 목록에서
## 층 번호로 고른다(무작위 아님). 평타는 dungeon_enemy.gd 가 그대로 치고, 예고·연격 중엔 보스가 그 자리에 선다(busy).
## 쿨 흔들림은 보스마다 자체 RNG(전역 randf 순서를 안 바꾼다). 수치는 웹 상수 그대로 px→m(6/148).

const CombatTell := preload("res://saga_core/combat_tell.gd")
const CombatFx := preload("res://saga_core/combat_fx.gd")

const PX := 6.0 / 148.0
const SLAM_WARN := 0.7
const SLAM_RANGE := 110.0 * PX
const SLAM_MUL := 1.8
const CHARGE_WARN := 0.55
const CHARGE_STEP := 90.0 * PX
const CHARGE_MUL := 1.6
const THRUST_WARN := 0.5
const THRUST_RANGE := 170.0 * PX
const THRUST_HALF := 0.5
const THRUST_MUL := 1.5
const FLURRY_WARN := 0.4
const FLURRY_HITS := 3
const FLURRY_GAP := 0.22
const FLURRY_MUL := 0.7
const P_R := 13.0 * PX # 웹 플레이어 반지름
const BOSS_R := 22.0 * PX # 웹 보스 반지름(spawnEnemy r = boss?22:13)

## data-enemy.js BOSSES 의 단계별 무기(천룡은 무기 없음 → 강타)
const WEAPONS_BY_TIER := {1: ["club", "axe"], 2: ["sword", "axe", "halberd"], 3: ["spear", "sword", "sword"], 4: ["halberd", "halberd"]}
const NAMES := {"club": "강타", "axe": "돌진", "spear": "찌르기", "halberd": "찌르기", "sword": "연격"}
const COLORS := {"club": Color("#ff6a3a"), "axe": Color("#ffb43a"), "spear": Color("#8ad0ff"), "halberd": Color("#8ad0ff"), "sword": Color("#ff7a7a")}

var weapon := "club"
var warn := 0.0
var cd := 4.0
var face := Vector3.FORWARD
var flurry_left := 0
var flurry_t := 0.0
var _rng := RandomNumberGenerator.new()


## data-enemy.js tierOf(stage) 그대로.
static func tier_of(stage: int) -> int:
	if stage <= 5:
		return 1
	if stage <= 12:
		return 2
	if stage <= 25:
		return 3
	return 4


static func weapon_for(floor_num: int) -> String:
	var l: Array = WEAPONS_BY_TIER[tier_of(floor_num)]
	return String(l[floor_num % l.size()])


func _init(floor_num: int = 1, force_weapon: String = "") -> void:
	weapon = force_weapon if force_weapon != "" else weapon_for(floor_num)
	_rng.seed = floor_num * 7919 + 17
	cd = 3.5 if weapon == "axe" else 4.0 # 웹 첫 slamCd


func pattern_name() -> String:
	return String(NAMES.get(weapon, "강타"))


## 예고·연격 중 — 보스는 그 자리에 서고 평타를 쉰다.
func busy() -> bool:
	return warn > 0.0 or flurry_left > 0


## 한 틱. hurt.call(배율, 패턴 이름) 이 플레이어에게 피해를 준다(맞았을 때만 부름).
func tick(me: Node3D, player: Node3D, delta: float, hurt: Callable) -> void:
	if player == null or not is_instance_valid(player):
		return
	match weapon:
		"axe":
			_charge(me, player, delta, hurt)
		"spear", "halberd":
			_thrust(me, player, delta, hurt)
		"sword":
			_flurry(me, player, delta, hurt)
		_:
			_slam(me, player, delta, hurt)


static func _flat_dist(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()


func _col() -> Color:
	return COLORS.get(weapon, COLORS.club)


func _slam(me: Node3D, player: Node3D, delta: float, hurt: Callable) -> void:
	if warn > 0.0:
		warn -= delta
		if warn <= 0.0:
			warn = 0.0
			if _flat_dist(me.global_position, player.global_position) < SLAM_RANGE:
				hurt.call(SLAM_MUL, pattern_name())
			CombatFx.element_burst(me, me.global_position, SLAM_RANGE, _col(), 0.5, "fire", false)
			var rig := me.get_tree().get_first_node_in_group("camera_rig") if me.is_inside_tree() else null
			if rig != null and rig.has_method("shake"):
				rig.shake(0.14, 0.25)
			cd = 6.0 + _rng.randf() * 2.0
		return
	cd -= delta
	if cd <= 0.0:
		warn = SLAM_WARN
		CombatTell.ring(me, me.global_position, SLAM_RANGE, SLAM_WARN, _col())


func _charge(me: Node3D, player: Node3D, delta: float, hurt: Callable) -> void:
	if warn > 0.0:
		warn -= delta
		if warn <= 0.0:
			warn = 0.0
			var to := player.global_position - me.global_position
			to.y = 0.0
			var d := to.length()
			if d > 0.001:
				var step := minf(CHARGE_STEP, maxf(0.0, d - BOSS_R - P_R))
				me.global_position += to / d * step
			if _flat_dist(me.global_position, player.global_position) < BOSS_R + P_R + 14.0 * PX:
				hurt.call(CHARGE_MUL, pattern_name())
			CombatFx.element_burst(me, me.global_position, 1.4, _col(), 0.4, "rock", false)
			cd = 5.0 + _rng.randf() * 2.0
		return
	cd -= delta
	if cd <= 0.0:
		warn = CHARGE_WARN
		CombatTell.ring(me, me.global_position, 26.0 * PX + BOSS_R, CHARGE_WARN, _col())


func _thrust(me: Node3D, player: Node3D, delta: float, hurt: Callable) -> void:
	if warn > 0.0:
		warn -= delta
		if warn <= 0.0:
			warn = 0.0
			var to := player.global_position - me.global_position
			to.y = 0.0
			var d := to.length()
			if d <= THRUST_RANGE and d > 0.001 and to.dot(face) / d >= cos(THRUST_HALF):
				hurt.call(THRUST_MUL, pattern_name())
			CombatFx.slash(me, face, 3.0, _col(), 0, true)
			CombatFx.spark(me, me.global_position + face * THRUST_RANGE * 0.6 + Vector3.UP * 0.9, _col(), true)
			cd = 5.0 + _rng.randf() * 2.0
		return
	cd -= delta
	if cd <= 0.0:
		var to := player.global_position - me.global_position
		to.y = 0.0
		face = to.normalized() if to.length() > 0.001 else Vector3.FORWARD
		warn = THRUST_WARN
		CombatTell.fan(me, me.global_position, face, THRUST_RANGE, THRUST_HALF, THRUST_WARN, _col())


func _flurry(me: Node3D, player: Node3D, delta: float, hurt: Callable) -> void:
	if flurry_left > 0:
		flurry_t -= delta
		if flurry_t <= 0.0:
			if _flat_dist(me.global_position, player.global_position) < BOSS_R + P_R + 10.0 * PX:
				hurt.call(FLURRY_MUL, pattern_name())
			var to := player.global_position - me.global_position
			CombatFx.slash(me, to, 2.0, _col(), FLURRY_HITS - flurry_left)
			flurry_left -= 1
			flurry_t = FLURRY_GAP
		return
	if warn > 0.0:
		warn -= delta
		if warn <= 0.0:
			warn = 0.0
			flurry_left = FLURRY_HITS
			flurry_t = 0.0
			cd = 6.0 + _rng.randf() * 2.0
		return
	cd -= delta
	if cd <= 0.0:
		warn = FLURRY_WARN
		CombatTell.ring(me, me.global_position, BOSS_R + P_R + 20.0 * PX, FLURRY_WARN, _col())
