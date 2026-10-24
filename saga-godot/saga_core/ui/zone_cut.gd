extends CanvasLayer

## G-0384 다섯 판 넘김 막(웹 W-0414 shared/js/zone-cut.js 짝) — 구역이 바뀌는 순간 곧장 덮고, 새 구역을 다 지은 뒤 걷는다.
##   ZoneCut.cut(tree, fn)            — 덮고 → fn 을 **곧바로** 부르고(동기 — 점검이 기대는 순서 그대로) → 짓기 끝을 기다려 걷음
##   ZoneCut.change_scene(tree, path) — 씬 넘김(4종횡 포털·마을 돌아가기). 막은 root 직속이라 씬이 바뀌어도 산다
##   wait_for(path)                   — ResourceLoader 스레드 요청을 걸어 두면 그게 끝날 때까지 덮음(없으면 프레임 MIN_FRAMES)
##   hold() / release()               — 여러 프레임에 나눠 짓는 쪽이 다 지을 때까지 붙듦(release 없으면 상한까지)
## 걷기 조건: MIN_FRAMES 지나고 걸린 요청 0, 아니면 상한 SAGA_ZONE_CUT_MAX(기본 1.6초)에서 저절로. SAGA_ZONE_CUT=0 이면 막 없이 fn 만.

const NODE_NAME := "ZoneCut"
const MIN_FRAMES := 3
const MAX_SEC := 1.6
const FADE_SEC := 0.25
const GROUP := "zone_cut"

var _rect: ColorRect
var _covered := false
var _frames := 0
var _elapsed := 0.0
var _fade_t := -1.0
var _pending: Array[String] = []
var _held := false


static func on() -> bool:
	return OS.get_environment("SAGA_ZONE_CUT") != "0"


static func max_sec() -> float:
	var v := OS.get_environment("SAGA_ZONE_CUT_MAX")
	return float(v) if v.is_valid_float() else MAX_SEC


## root 직속 막 하나(없으면 만든다).
## root 가 자식을 짓는 중(씬 _ready 안)일 수 있어 붙이기는 deferred — 같은 프레임 두 번째 부름은 _inst 로 같은 막.
static var _inst: Node = null


static func instance(tree: SceneTree) -> Node:
	if _inst != null and is_instance_valid(_inst):
		return _inst
	var n := tree.root.get_node_or_null(NODE_NAME)
	if n == null:
		n = (load("res://saga_core/ui/zone_cut.gd") as GDScript).new()
		n.name = NODE_NAME
		tree.root.add_child.call_deferred(n)
	_inst = n
	return n


## 덮기만(넘김 함수 맨 앞에서 — 그 뒤 짓기는 그 함수가 그대로 이어 간다).
static func begin(tree: SceneTree) -> void:
	if on():
		instance(tree).cover()


static func cut(tree: SceneTree, fn: Callable) -> void:
	begin(tree)
	fn.call()


static func change_scene(tree: SceneTree, path: String) -> void:
	cut(tree, func() -> void: tree.change_scene_to_file(path))


func _ready() -> void:
	layer = 120
	add_to_group(GROUP)
	process_mode = Node.PROCESS_MODE_ALWAYS
	_make_rect()


func _make_rect() -> void:
	if _rect != null:
		return
	_rect = ColorRect.new()
	_rect.color = Color(0.02, 0.02, 0.03, 0.0)
	_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_rect)


func cover() -> void:
	_make_rect()
	_covered = true
	_frames = 0
	_elapsed = 0.0
	_fade_t = -1.0
	_held = false
	_rect.color.a = 1.0
	_rect.mouse_filter = Control.MOUSE_FILTER_STOP   # 덮인 동안 누름 막음


func wait_for(path: String) -> void:
	if path != "" and not _pending.has(path):
		_pending.append(path)


func hold() -> void:
	_held = true


func release() -> void:
	_held = false


func is_covered() -> bool:
	return _covered


func alpha() -> float:
	return _rect.color.a if _rect else 0.0


func _process(delta: float) -> void:
	if _fade_t >= 0.0:
		_fade_t += delta
		_rect.color.a = clampf(1.0 - _fade_t / FADE_SEC, 0.0, 1.0)
		if _fade_t >= FADE_SEC:
			_fade_t = -1.0
			_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
		return
	if not _covered:
		return
	_frames += 1
	_elapsed += delta
	_pending = _pending.filter(func(p: String) -> bool:
		return ResourceLoader.load_threaded_get_status(p) == ResourceLoader.THREAD_LOAD_IN_PROGRESS)
	if (_frames >= MIN_FRAMES and _pending.is_empty() and not _held) or _elapsed >= max_sec():
		_covered = false
		_pending.clear()
		_held = false
		_fade_t = 0.0
