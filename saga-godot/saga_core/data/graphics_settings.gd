extends RefCounted

## G-0054 — 설정 "화질/성능" 2단(SAGA-BACKLOG §4.6 · SAGA-DESIGN §6.1-B ②). 다섯 판 공용, 정적 함수만(오토로드를 안 늘린다).
## 화질 = 지금까지 그대로(기본). 성능 = 30fps · 3D 해상도 0.75 · MSAA 끔 · 환경 SSAO/SSIL/SDFGI 끔(env_pc 와 env_mobile 의 차이 그대로).
## 고른 값은 세이브와 별개인 user://graphics.cfg 에 — 다음 실행·다른 판에도 간다(세이브 옮기기에는 안 실린다).
## 환경은 environment_profile.gd 가 그룹 "env_profile" 에 들고, 시작할 때 apply_env 를 부른다. 날씨·밤 스크립트가 바꾸는 값(안개·빛)은 안 건드린다.

const QUALITY := "quality"
const PERFORMANCE := "performance"
const PERF_FPS := 30
const PERF_SCALE := 0.75
const GROUP := "env_profile"
const ORIG_META := &"gfx_orig"

static var cfg_path := "user://graphics.cfg" # 점검이 임시 경로로 바꾼다
static var _mode := ""


static func mode() -> String:
	if _mode == "":
		var cf := ConfigFile.new()
		_mode = String(cf.get_value("graphics", "mode", QUALITY)) if cf.load(cfg_path) == OK else QUALITY
		if _mode != PERFORMANCE:
			_mode = QUALITY
	return _mode


static func is_performance() -> bool:
	return mode() == PERFORMANCE


static func label() -> String:
	return "성능" if is_performance() else "화질"


## 모드를 바꾸고(save=true 면 파일에도) 지금 화면에 곧바로 적용한다.
static func set_mode(m: String, tree: SceneTree, save := true) -> void:
	_mode = PERFORMANCE if m == PERFORMANCE else QUALITY
	if save:
		var cf := ConfigFile.new()
		cf.set_value("graphics", "mode", _mode)
		cf.save(cfg_path)
	apply(tree)


## 점검용 — 다음 mode() 가 파일을 다시 읽게.
static func forget() -> void:
	_mode = ""


static func apply(tree: SceneTree) -> void:
	if tree == null:
		return
	var perf := is_performance()
	Engine.max_fps = PERF_FPS if perf else 0
	var vp := tree.root
	vp.scaling_3d_scale = PERF_SCALE if perf else 1.0
	vp.msaa_3d = Viewport.MSAA_DISABLED if perf else int(ProjectSettings.get_setting_with_override("rendering/anti_aliasing/quality/msaa_3d")) as Viewport.MSAA
	for n in tree.get_nodes_in_group(GROUP):
		if n is WorldEnvironment and (n as WorldEnvironment).environment != null:
			apply_env((n as WorldEnvironment).environment)


## 무거운 화면 효과 셋만 켜고 끈다. 처음 값은 메타로 기억해 화질로 돌아오면 그 값으로(env_mobile 은 처음부터 꺼져 있다).
static func apply_env(env: Environment) -> void:
	if not env.has_meta(ORIG_META):
		env.set_meta(ORIG_META, [env.ssao_enabled, env.ssil_enabled, env.sdfgi_enabled])
	var orig: Array = env.get_meta(ORIG_META)
	var perf := is_performance()
	env.ssao_enabled = false if perf else bool(orig[0])
	env.ssil_enabled = false if perf else bool(orig[1])
	env.sdfgi_enabled = false if perf else bool(orig[2])
