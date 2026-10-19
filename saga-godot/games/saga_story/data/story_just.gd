extends RefCounted

## G-0233 4종횡 저스트 회피(웹 W-0282 side-just.js 이식) — 대시 무적 중에 적 공격이 닿았고 그게 대시 시작 0.15초 안이면 저스트:
##   0.8초 슬로(Engine.time_scale 0.35 — 실시간 타이머로 되돌림) · 다음 한 타 ×1.3(한 번 소비) · 쿨 4초 · 화면 가장자리 청록 번쩍 · 알림.
## 웹은 "무적 창 안에 닿으면"(창 0.15 > 무적 0.12 라 늘 참) — 여기도 같은 꼴로, 닿는 순간(story_player.take_damage 무적 가지)에 판정한다.
## 상태를 플레이어 var 로 두지 않는다(플레이어 var 를 늘리면 golden 해시가 바뀐다 — 성좌 비연과 같은 이유). 세이브엔 아무것도 안 남긴다.
## 4종횡엔 효과음 재생 자리가 없어 소리는 뺐다(그림·소리는 K 몫).

const WINDOW := 0.15
const SLOW_SEC := 0.8
const SLOW_MUL := 0.35
const NEXT_MUL := 1.3
const CD_SEC := 4.0
const FLASH_TINT := Color(0.3, 0.95, 1.0)

static var _dash_ms := -100000
static var _cd_until_ms := -100000
static var _bonus := 1.0
static var count := 0
static var slowing := false


static func reset() -> void:
	_dash_ms = -100000
	_cd_until_ms = -100000
	_bonus = 1.0
	count = 0
	if slowing:
		Engine.time_scale = 1.0
	slowing = false


## 대시가 나갔다(story_player._do_dash).
static func on_dash(now_ms: int = -1) -> void:
	_dash_ms = Time.get_ticks_msec() if now_ms < 0 else now_ms


static func cooldown_left(now_ms: int = -1) -> float:
	var now := Time.get_ticks_msec() if now_ms < 0 else now_ms
	return maxf(0.0, float(_cd_until_ms - now) / 1000.0)


## 닿기가 대시 시작 WINDOW 안이고 쿨이 아니면 저스트인가(순수 — 점검이 시각을 넘겨 묻는다).
static func qualifies(now_ms: int) -> bool:
	return now_ms - _dash_ms <= int(WINDOW * 1000.0) and now_ms >= _cd_until_ms


## 무적 중에 공격이 닿았다 — 저스트면 효과를 걸고 true. node = 트리에 있는 아무 노드(타이머·알림 자리).
static func evaded(node: Node, now_ms: int = -1) -> bool:
	var now := Time.get_ticks_msec() if now_ms < 0 else now_ms
	if not qualifies(now):
		return false
	_cd_until_ms = now + int(CD_SEC * 1000.0)
	_bonus = NEXT_MUL
	count += 1
	if node == null or not node.is_inside_tree():
		return true
	var tree := node.get_tree()
	if not tree.paused and not slowing:   # 일시정지·창 중엔 시간을 안 건드린다
		slowing = true
		Engine.time_scale = SLOW_MUL
		tree.create_timer(SLOW_SEC, true, false, true).timeout.connect(_end_slow)   # 실시간(ignore_time_scale)·멈춰도 돎
	var hv := tree.get_first_node_in_group("hurt_vignette")
	if hv != null and hv.has_method("flash_tint"):
		hv.call("flash_tint", FLASH_TINT)
	preload("res://saga_core/ui/toast.gd").show(node, "⚡ 저스트 회피! — 느려진다 · 다음 한 타 ×%.1f" % NEXT_MUL, 2.0)
	return true


static func _end_slow() -> void:
	if slowing:
		Engine.time_scale = 1.0
	slowing = false


## 공격 배율 — _effective_atk 가 한 번 꺼내 쓰고 지운다.
static func take_bonus() -> float:
	var b := _bonus
	_bonus = 1.0
	return b


static func bonus() -> float:
	return _bonus
