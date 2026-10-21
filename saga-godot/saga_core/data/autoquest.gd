extends RefCounted

## G-0298 자동 퀘스트 공용 틀(웹 saga-web/shared/js/autoquest.js 짝) — 순수 상태 기계, 그림·씬 없음.
## 모바일 MMO 문법: 목표 줄 ▶ 를 누르면 판이 주는 "지금 목표 목록"의 첫 것을 끝까지 대신한다(걷기·만남·대화·싸움) → 끝나면 다음 목표.
## 규칙은 여기 없다 — 어댑터(판)가 공개 함수만 불러 실행하고, 이 틀은 "어느 목표를 · 언제 멈추나" 만 안다.
##   var q := AutoQuest.new(adapter)   매 프레임 q.tick(dt)   ·   q.start() / q.stop(why) / q.toggle()   ·   q.status()
##   adapter = {
##     goals: Callable → [{id, type, label, pos(Vector3)}]  첫 것이 지금 목표(빈 배열이면 멈춤 "목표 없음")
##     run: Callable(goal, dt) → 한 줄(화면 글) — 판의 자동을 굴린다. 목표가 끝났는지는 goals() 첫 id 가 바뀌는 것으로 안다
##     pos: Callable → Vector3        busy: Callable → true 면 막힘을 안 센다(대화·싸움·창)
##     pause: Callable → 멈출 이유 글 또는 ""(체력 낮음·직접 해야 하는 단계 …)   begin(goal) / end(why) / unstick(n, goal) 은 선택
##   }
## 막힘: busy 아닌데 STILL_M 안에 STUCK_SEC 머물면 막힘 1 — unstick(n), STUCK_MAX 넘으면 멈춤 "막힘 — <목표>".

const STILL_M := 1.0
const STUCK_SEC := 30.0
const STUCK_MAX := 3

var ad: Dictionary
var on := false
var goal: Dictionary = {}
var doing := ""
var why := ""
var since := 0.0
var stuck := 0
var done := 0
var _still := 0.0
var _last = null   # Vector3 또는 null


func _init(adapter: Dictionary) -> void:
	ad = adapter


func _call(k: String, args: Array = []) -> Variant:
	var c: Callable = ad.get(k, Callable())
	return c.callv(args) if c.is_valid() else null


func _first() -> Dictionary:
	var gs = _call("goals")
	return (gs as Array)[0] if gs is Array and not (gs as Array).is_empty() else {}


func start() -> bool:
	if on:
		return false
	var g := _first()
	if g.is_empty():
		why = "목표 없음"
		return false
	on = true
	why = ""
	goal = g
	since = 0.0
	_still = 0.0
	stuck = 0
	_last = null
	doing = ""
	_call("begin", [g])
	return true


func stop(reason := "") -> bool:
	if not on:
		return false
	on = false
	why = reason
	goal = {}
	doing = ""
	_call("end", [why])
	return true


func toggle() -> bool:
	return not stop("손으로 끔") if on else start()


func tick(dt: float) -> void:
	if not on:
		return
	dt = maxf(dt, 0.0)
	var pz = _call("pause")
	if pz is String and pz != "":
		stop(pz)
		return
	var g := _first()
	if g.is_empty():
		stop("목표 없음")
		return
	if goal.is_empty() or g.get("id") != goal.get("id"):
		done += 1
		goal = g
		since = 0.0
		_still = 0.0
		stuck = 0
		_last = null
	since += dt
	var d = _call("run", [g, dt])
	doing = d if d is String else ""
	if not on:   # run 이 멈췄을 수 있다(직접 해야 하는 단계)
		return
	var p = _call("pos")
	if not (p is Vector3) or bool(_call("busy")):
		_still = 0.0
		_last = p
		return
	if _last is Vector3 and Vector2(p.x - _last.x, p.z - _last.z).length() < STILL_M:
		_still += dt
	else:
		_still = 0.0
		_last = p
	if _still < STUCK_SEC:
		return
	_still = 0.0
	stuck += 1
	if stuck > STUCK_MAX:
		stop("막힘 — %s" % String(g.get("label", g.get("id", ""))))
		return
	_call("unstick", [stuck, g])


func status() -> Dictionary:
	return {"on": on, "goal": goal, "doing": doing, "why": why, "stuck": stuck, "done": done, "since": since}
