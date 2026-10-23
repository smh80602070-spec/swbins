extends RefCounted

## G-0314 4종횡 띄우기·공중 콤보 — 웹 saga-web/saga-story/js/side-launch.js(W-0345) 이식, 비율 그대로(LAUNCH_K 0.7·JUGGLE_K 0.3·MAX_HITS 4·FALL_K 0.5).
##   올려치기  ↑(move_forward) 누른 채 근접으로 치면(player _melee_hit) 적이 뜬다 — 보스·관문 대장(is_champion)·탱커(role "tank")는 안 뜬다.
##   저글      떠 있는 적을 또 치면 다시 튕김(상한 4타, 넘으면 그대로 떨어짐).
##   떨어짐    중력으로 내려와 뜬 자리 높이에 닿으면 마지막 친 힘 × 0.5 피해.
##   떠 있는 동안 적은 걷기·몸 닿기·쏘기·패턴을 안 한다(story_enemy _physics_process 첫머리에서 tick 이 true 면 돌아감).
## 웹 px 값 × 4종횡 SCALE 0.02: 뛰기 760 px/s → 15.2 m/s · 중력 1900 px/s² → 38 m/s²(띄움 최고 약 1.5m).
## 적 노드 칸(런타임, 세이브 없음): launch_air·launch_hits·launch_ground_y·launch_vy·launch_dmg. SAGA_LAUNCH=0 이면 끔.

const LAUNCH_K := 0.7
const JUGGLE_K := 0.3
const MAX_HITS := 4
const FALL_K := 0.5
const JUMP := 15.2
const GRAVITY := 38.0


static func on() -> bool:
	return OS.get_environment("SAGA_LAUNCH") != "0"


static func immune(e: Object) -> bool:
	return e == null or bool(e.get("is_boss")) or bool(e.get("is_champion")) or String(e.get("role")) == "tank"


static func airborne(e: Object) -> bool:
	return e != null and bool(e.get("launch_air"))


static func launch(e: Node3D, dmg: float) -> bool:
	if not on() or immune(e) or airborne(e):
		return false
	e.set("launch_air", true)
	e.set("launch_hits", 0)
	e.set("launch_ground_y", e.global_position.y)
	e.set("launch_vy", JUMP * LAUNCH_K)
	e.set("launch_dmg", dmg)
	return true


## 떠 있는 적 추가타 — 다시 튕겼으면 true(상한이면 false — 그대로 떨어진다)
static func juggle(e: Node3D, dmg: float) -> bool:
	if not airborne(e):
		return false
	if dmg > 0.0:
		e.set("launch_dmg", dmg)
	if int(e.get("launch_hits")) >= MAX_HITS:
		return false
	e.set("launch_hits", int(e.get("launch_hits")) + 1)
	e.set("launch_vy", JUMP * JUGGLE_K)
	return true


## 근접 타격 뒤 — 떠 있으면 저글, ↑ 눌림이면 띄우기. 맡았으면 true
static func on_strike(e: Node3D, up: bool, dmg: float) -> bool:
	if not on() or e == null:
		return false
	if airborne(e):
		juggle(e, dmg)
		return true
	return launch(e, dmg) if up else false


## 한 틱 — 떠 있으면 위치를 옮기고 true(적 AI 를 건너뛴다). 닿는 틱에 떨어짐 피해를 넣고 false.
static func tick(e: Node3D, delta: float) -> bool:
	if not airborne(e) or delta <= 0.0:
		return false
	var vy: float = float(e.get("launch_vy")) - GRAVITY * delta
	var y: float = e.global_position.y + float(e.get("launch_vy")) * delta
	var gy: float = float(e.get("launch_ground_y"))
	if vy < 0.0 and y <= gy:
		e.global_position.y = gy
		e.set("launch_air", false)
		e.set("launch_hits", 0)
		e.set("launch_vy", 0.0)
		var d := maxf(1.0, roundf(float(e.get("launch_dmg")) * FALL_K))
		if e.has_method("take_damage"):
			e.call("take_damage", d)
		return false
	e.global_position.y = y
	e.set("launch_vy", vy)
	return true
