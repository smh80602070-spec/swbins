extends Node

## G-0251 — 날씨(3마을·5천하·4종횡 바깥 씬). 1만리는 weather.gd·season_weather_visual·sky_panorama·region4_frost 가 맡고,
## 세 판은 늘 맑았다. 3시간 슬롯마다 결정론적 날씨 여섯(1만리 Weather.key_at 식 해시) →
##   env 복제본 fog_density·volumetric_fog_density(1만리 KINDS.fog_density_mul 값) · sky_real cloud_cover(sky_panorama.CLOUD_COVER 값 + 안개·눈)
##   비/눈 입자 CPUParticles3D "Rainfall"/"Snowfall"(카메라 위 22m 상자, 위치만 따라감)
## 안개색·해·주변광은 day_light.gd 만 쓴다(같은 칸을 둘이 쓰면 서로 덮는다) — 여기선 DayLight 에 weather_tint·weather_sun_mul 을 넣고 refresh_now().
## 계절: 3마을 ForestDay.epoch_day_index 의 달 · 5천하 RealmSaveState.month · 4종횡 실제 달. 겨울(12~2월)만 눈, 그 밖엔 눈 무게 0.
## 손잡이: SAGA_WEATHER=<키>(clear·cloud·rain·wind·fog·snow) 면 그 날씨 고정 · SAGA_WEATHER=0 이면 안 단다.
## environment_profile._pick_environment 이 _real_sky_scene(GO 밖) 이면 DayLight 옆에 단다. 1만리 코드는 부르지 않는다(값만 옮겨 적음).

const WeatherSound := preload("res://saga_core/audio/weather_sound.gd")   # G-0367 빗소리·바람 소리
const FDay := preload("res://games/saga_forest/data/forest_day.gd")   # check_refs:allow — 3마을 게임 날짜(달) 읽기, 순수 함수 하나
const GROUP := "saga_weather_visual"
const CHECK_SEC := 60.0
const SPAN_MS := 3 * 60 * 60 * 1000   # weather.gd SPAN_MS
## fog = 1만리 Weather.KINDS.fog_density_mul · tint = KINDS.tint(안개색에 곱 — day_light 가 넣는다)
## cloud = sky_panorama.CLOUD_COVER(fog·snow 는 이 표가 정함) · sun = 해 세기 배율(day_light 가 곱한다)
## G-0258 gray = sky_real 회색 섞기(0~1 — 곱만으론 구름 틈·천정 파란 기가 남았다). 맑음·바람 0.
## G-0256 sky = 하늘색 배율(천정·지평선·구름 — day_light 가 곱한다) · sun_glow = sky_real sun_strength(해 빛무리) 배율(이 노드가 곱한다). 맑음·바람 1 = 회귀 그대로.
const KINDS := {
	"clear": {"fog": 0.6, "tint": Color(1.05, 1.03, 0.95), "cloud": 0.32, "sun": 1.0, "sky": Color(1, 1, 1), "sun_glow": 1.0, "gray": 0.0},
	"cloud": {"fog": 1.0, "tint": Color(0.95, 0.96, 1.0), "cloud": 0.72, "sun": 0.85, "sky": Color(0.80, 0.82, 0.86), "sun_glow": 0.5, "gray": 0.35},
	"rain": {"fog": 1.6, "tint": Color(0.85, 0.9, 1.0), "cloud": 0.9, "sun": 0.75, "sky": Color(0.62, 0.60, 0.55), "sun_glow": 0.1, "gray": 0.72},
	"wind": {"fog": 0.8, "tint": Color(1.0, 1.0, 1.0), "cloud": 0.5, "sun": 1.0, "sky": Color(1, 1, 1), "sun_glow": 1.0, "gray": 0.0},
	"fog": {"fog": 2.4, "tint": Color(0.9, 0.9, 0.92), "cloud": 0.95, "sun": 0.75, "sky": Color(0.86, 0.82, 0.72), "sun_glow": 0.15, "gray": 0.75},
	"snow": {"fog": 1.2, "tint": Color(1.02, 1.02, 1.08), "cloud": 0.6, "sun": 0.85, "sky": Color(0.85, 0.86, 0.90), "sun_glow": 0.4, "gray": 0.45},
}
## 손보기 — 세 판 바탕 안개가 0.004 라 곱만으론 안개·비가 옅었다(3마을·전술판 컷). 곱한 뒤 더하는 최소 밀도(맑음·흐림·바람 0 = 회귀 그대로).
const FOG_ADD := {"clear": 0.0, "cloud": 0.0, "rain": 0.006, "wind": 0.0, "fog": 0.016, "snow": 0.004}
## 입자 상자 중심 = 카메라가 보는 쪽 FRONT m 앞 + 위 RISE m(카메라 바로 둘레 입자가 화면에 큰 점·굵은 줄로 보였다).
const SUN_STRENGTH_DEFAULT := 6.0   # sky_real.gdshader sun_strength 기본값
const FRONT := 12.0
const RISE := 10.0
const ORDER := ["clear", "cloud", "rain", "wind", "fog", "snow"]
## 계절 무게(ORDER 순). 겨울만 눈.
const W_WINTER := [3.0, 2.5, 0.3, 1.5, 1.0, 2.5]
const W_OTHER := [4.0, 2.5, 1.8, 1.2, 0.8, 0.0]
const BOX := 22.0
const RAIN_AMOUNT := 700
const SNOW_AMOUNT := 600   # region4_frost.SNOW_FULL 260 — 손보기: 근거리 7m 안을 지우니 성겨 늘림

var key := ""
var _we: WorldEnvironment
var _env: Environment
var _base := {}
var _sky_mat: ShaderMaterial = null   # G-0256 빛무리 바탕을 잰 하늘 재질
var _check := 0.0
var _rain: CPUParticles3D
var _snow: CPUParticles3D
var last := {}   # 점검용: key·fog_density·cloud_cover·sun_mul

## G-0359·G-0360 땅 젖음 — 비가 오면 땅 재질(아래 두 셰이더의 wet)을 WET_IN 초에 걸쳐 1 로, 그치면 WET_OUT 초에 걸쳐 0 으로.
## 땅 재질은 씬에서 그 셰이더를 쓰는 material_override 를 모은다(지역이 나중에 지어지니 WET_SCAN 초마다 다시). SAGA_WET=0 이면 안 적심.
## 1만리 terrain_triplanar · 3마을(곡면) curved_triplanar. G-0361 — StandardMaterial 땅은 meta WET_META 를 단 것만(4종횡 들판):
## 처음 색·거칠기를 meta 로 기억해 두고 젖은 만큼 색 ×0.64·거칠기 ×0.45 까지(웅덩이는 셰이더만).
const WET_META := &"saga_wet"
const WET_SHADERS := ["res://saga_core/shaders/terrain_triplanar.gdshader", "res://saga_core/shaders/curved_triplanar.gdshader"]
const WET_IN := 20.0
const WET_OUT := 60.0
const WET_SCAN := 5.0
var wet := 0.0
var _wet_mats: Array[ShaderMaterial] = []
var _wet_std: Array[StandardMaterial3D] = []
## G-0363 바람 날 풀 눕힘 — 풀 셰이더(grass_blades)의 wind_strength 를 날씨 배율만큼(처음 값은 meta 로 기억), 초당 0.5 씩 다가감.
const GRASS_SHADER := "res://saga_core/shaders/grass_blades.gdshader"
const WIND_MUL := {"wind": 2.6, "rain": 1.6, "snow": 1.3}
const GRASS_WIND_DEFAULT := 0.16   # grass_blades.gdshader wind_strength 기본값(안 넣은 손잡이는 get 이 null)
var wind_k := 1.0
var _sound: Node = null   # G-0367
var _grass: Array[ShaderMaterial] = []
var _sway: Array[ShaderMaterial] = []   # G-0365 meta grass_sway 단 메시 표면 재질(3마을 풀 포기)
var _wind_sent := -1.0


## 젖음·바람 배율 목표(순수)
static func wind_target(k: String) -> float:
	return float(WIND_MUL.get(k, 1.0))


## G-0365 — 메시 표면(MeshInstance·MultiMesh 의 mesh)에 붙은 meta grass_sway 재질 · G-0366 material_override 도
static func sway_mats(root: Node) -> Array[ShaderMaterial]:
	var out: Array[ShaderMaterial] = []
	if root == null:
		return out
	for n in root.find_children("*", "GeometryInstance3D", true, false):
		var mo := (n as GeometryInstance3D).material_override as ShaderMaterial
		if mo != null and mo.has_meta(&"grass_sway") and not out.has(mo):
			out.append(mo)
		var mesh: Mesh = null
		if n is MeshInstance3D:
			mesh = (n as MeshInstance3D).mesh
		elif n is MultiMeshInstance3D and (n as MultiMeshInstance3D).multimesh != null:
			mesh = (n as MultiMeshInstance3D).multimesh.mesh
		if mesh == null:
			continue
		for i in mesh.get_surface_count():
			var m := mesh.surface_get_material(i) as ShaderMaterial
			if m != null and m.has_meta(&"grass_sway") and not out.has(m):
				out.append(m)
	return out


static func grass_mats(root: Node) -> Array[ShaderMaterial]:
	var out: Array[ShaderMaterial] = []
	if root == null:
		return out
	for n in root.find_children("*", "GeometryInstance3D", true, false):
		var m := (n as GeometryInstance3D).material_override as ShaderMaterial
		if m != null and m.shader != null and m.shader.resource_path == GRASS_SHADER and not out.has(m):
			out.append(m)
	return out
var _wet_scan := 0.0
var _wet_sent := -1.0


## 젖음 셰이더를 쓰는 땅 재질들(씬 전체 — 지역 빌더가 만든 것)
static func terrain_mats(root: Node) -> Array[ShaderMaterial]:
	var out: Array[ShaderMaterial] = []
	if root == null:
		return out
	for n in root.find_children("*", "GeometryInstance3D", true, false):
		var m := (n as GeometryInstance3D).material_override as ShaderMaterial
		if m != null and m.shader != null and WET_SHADERS.has(m.shader.resource_path) and not out.has(m):
			out.append(m)
	return out


## 젖음 한 걸음(순수) — 비면 WET_IN 초에 1 까지, 아니면 WET_OUT 초에 0 까지
static func wet_step(w: float, raining: bool, dt: float) -> float:
	return minf(1.0, w + dt / WET_IN) if raining else maxf(0.0, w - dt / WET_OUT)


## G-0367 — 날씨 소리 노드에 지금 키를 알린다(처음 부를 때 붙임, SAGA_WEATHER_SOUND=0 이면 안 붙음).
func _sound_tick() -> void:
	if not WeatherSound.enabled():
		return
	if _sound == null:
		_sound = WeatherSound.new()
		_sound.name = "WeatherSound"
		add_child(_sound)
	_sound.call("set_weather", key)


func _wet_tick(delta: float) -> void:
	_sound_tick()
	if OS.get_environment("SAGA_WET") == "0":
		return
	wet = wet_step(wet, key == "rain", delta)
	_wet_scan -= delta
	if _wet_scan <= 0.0:
		_wet_scan = WET_SCAN
		_wet_mats = terrain_mats(get_tree().current_scene)
		_wet_std = std_wet_mats(get_tree().current_scene)
		_grass = grass_mats(get_tree().current_scene)
		_sway = sway_mats(get_tree().current_scene)
		_wet_sent = -1.0
		_wind_sent = -1.0
	wind_k = move_toward(wind_k, wind_target(key), delta * 0.5)
	if absf(wind_k - _wind_sent) > 0.02:
		_wind_sent = wind_k
		for g in _grass:
			if not g.has_meta(&"wind_base"):
				var ws = g.get_shader_parameter("wind_strength")
				g.set_meta(&"wind_base", float(ws) if ws != null else GRASS_WIND_DEFAULT)
			g.set_shader_parameter("wind_strength", float(g.get_meta(&"wind_base")) * wind_k)
		for s in _sway:
			s.set_shader_parameter("sway", float(s.get_meta(&"grass_sway")) * wind_k)
	if absf(wet - _wet_sent) > 0.01:
		_wet_sent = wet
		for m in _wet_mats:
			m.set_shader_parameter("wet", wet)
			m.set_shader_parameter("rain", 1.0 if key == "rain" else 0.0)   # G-0362 웅덩이 물결은 내리는 동안만
		for s in _wet_std:
			wet_std(s, wet)


## G-0361 meta 단 StandardMaterial 땅들
static func std_wet_mats(root: Node) -> Array[StandardMaterial3D]:
	var out: Array[StandardMaterial3D] = []
	if root == null:
		return out
	for n in root.find_children("*", "GeometryInstance3D", true, false):
		var m := (n as GeometryInstance3D).material_override as StandardMaterial3D
		if m != null and m.has_meta(WET_META) and not out.has(m):
			out.append(m)
	return out


## G-0361 StandardMaterial 젖히기(처음 값은 meta 로 한 번만 기억)
static func wet_std(m: StandardMaterial3D, w: float) -> void:
	if not m.has_meta(&"wet_base"):
		m.set_meta(&"wet_base", [m.albedo_color, m.roughness])
	var b: Array = m.get_meta(&"wet_base")
	var c: Color = b[0]
	var k := lerpf(1.0, 0.64, w)
	m.albedo_color = Color(c.r * k, c.g * k, c.b * k, c.a)
	m.roughness = float(b[1]) * lerpf(1.0, 0.45, w)


static func enabled() -> bool:
	return OS.get_environment("SAGA_WEATHER") != "0"


static func forced_key() -> String:
	var k := OS.get_environment("SAGA_WEATHER")
	return k if KINDS.has(k) else ""


## weather.gd::_hash01 과 같은 식(값만 옮겨 적음).
static func _hash01(slot: int) -> float:
	var h := (slot * 374761393) ^ 987654321
	h = (h ^ (h >> 13)) * 1274126177
	h = h ^ (h >> 16)
	return float(h & 0x7fffffff) / float(0x7fffffff)


## 순수 함수 — 시각(ms)·달(1~12) → 날씨 키. 같은 3시간 슬롯·같은 달이면 같은 키.
static func key_at(unix_ms: int, month: int) -> String:
	var h := _hash01(int(unix_ms / SPAN_MS))
	var w: Array = W_WINTER if month == 12 or month <= 2 else W_OTHER
	var total := 0.0
	for v in w:
		total += float(v)
	var x := h * total
	for i in ORDER.size():
		x -= float(w[i])
		if x <= 0.0 and float(w[i]) > 0.0:
			return ORDER[i]
	return ORDER[0]


## 이 씬의 달 — 3마을 게임 날짜·5천하 게임 달·그 밖(4종횡) 실제 달.
func month_now() -> int:
	var path := get_parent().scene_file_path if get_parent() else ""
	if path.begins_with("res://games/saga_forest/"):   # check_refs:allow — 경로 판별 문자열
		var d := Time.get_datetime_dict_from_unix_time(FDay.epoch_day_index() * 86400)
		return int(d.month)
	if path.begins_with("res://games/saga_realm/"):   # check_refs:allow
		var rs := get_tree().root.get_node_or_null("RealmSaveState")   # check_refs:allow — 5천하 게임 달
		if rs and rs.get("month") != null:
			return clampi(int(rs.get("month")), 1, 12)
	return int(Time.get_date_dict_from_system().month)


func key_now() -> String:
	var f := forced_key()
	if f != "":
		return f
	return key_at(int(Time.get_unix_time_from_system() * 1000.0), month_now())


func _ready() -> void:
	add_to_group(GROUP)
	_we = get_parent().get_node_or_null("WorldEnvironment") as WorldEnvironment
	refresh_now()
	wet = 1.0 if key == "rain" else 0.0   # G-0360 들어올 때 이미 비면 땅도 이미 젖어 있다
	wind_k = wind_target(key)   # G-0363 들어올 때 바람이면 이미 분다


func _process(delta: float) -> void:
	_check -= delta
	if _check <= 0.0:
		refresh_now()
	_wet_tick(delta)
	var p: CPUParticles3D = _rain if _rain and _rain.emitting else (_snow if _snow and _snow.emitting else null)
	if p:
		var cam := get_viewport().get_camera_3d()
		if cam:
			var to := _center(cam)
			var jump := p.global_position.distance_squared_to(to) > BOX * BOX
			p.global_position = to
			if jump:   # 카메라가 순간 이동(전술판·문 넘기)하면 옛 자리 입자가 남는다 — 새 자리에서 미리 돌린 채로 다시
				p.restart()


static func _center(cam: Camera3D) -> Vector3:
	return cam.global_position - cam.global_transform.basis.z * FRONT + Vector3(0, RISE, 0)


func refresh_now() -> void:
	_check = CHECK_SEC
	key = key_now()
	var k: Dictionary = KINDS[key]
	_grab_env()
	if _env:
		_env.fog_density = float(_base.fog) * float(k.fog) + float(FOG_ADD[key])
		if _env.volumetric_fog_enabled:
			_env.volumetric_fog_density = float(_base.vol) * float(k.fog)
		last["fog_density"] = _env.fog_density
		if _env.sky and _env.sky.sky_material is ShaderMaterial:
			(_env.sky.sky_material as ShaderMaterial).set_shader_parameter("cloud_cover", float(k.cloud))
			last["cloud_cover"] = float(k.cloud)
			## G-0256 — 해 빛무리. 바탕은 _grab_env 에서만 잰다(그 뒤엔 배율만 — 이미 곱한 값을 바탕으로 다시 재지 않게).
			if _base.has("sun_glow"):
				(_env.sky.sky_material as ShaderMaterial).set_shader_parameter("sun_strength", float(_base.sun_glow) * float(k.sun_glow))
				last["sun_glow"] = float(k.sun_glow)
				(_env.sky.sky_material as ShaderMaterial).set_shader_parameter("gray", float(k.gray))   # G-0258
				last["gray"] = float(k.gray)
	var dl := get_parent().get_node_or_null("DayLight")
	if dl:
		dl.weather_tint = k.tint
		dl.weather_sun_mul = float(k.sun)
		dl.weather_sky = k.sky
		dl.refresh_now()
	last["key"] = key
	last["sun_mul"] = float(k.sun)
	last["sky"] = k.sky
	_set_fall(key)


## env 는 형제(story_sky 등)가 복제본으로 갈아 끼울 수 있다 — 바뀌었으면 원래 밀도를 다시 잰다.
func _grab_env() -> void:
	var e: Environment = _we.environment if _we else null
	if e == _env:
		return
	_env = e
	if _env:
		_base["fog"] = _env.fog_density
		_base["vol"] = _env.volumetric_fog_density
		## 하늘 재질이 env 복제본끼리 같을 수 있다 — 재질이 바뀌었을 때만 빛무리 바탕을 잰다.
		var sm: ShaderMaterial = _env.sky.sky_material as ShaderMaterial if _env.sky else null
		if sm != null and sm != _sky_mat:
			_sky_mat = sm
			var ss = sm.get_shader_parameter("sun_strength")
			_base["sun_glow"] = float(ss) if ss != null else SUN_STRENGTH_DEFAULT


func _set_fall(k: String) -> void:
	if k == "rain" and _rain == null:
		_rain = _build_rain()
	if k == "snow" and _snow == null:
		_snow = _build_snow()
	if _rain:
		_rain.emitting = k == "rain"
		_rain.visible = _rain.emitting
	if _snow:
		_snow.emitting = k == "snow"
		_snow.visible = _snow.emitting


func _particles(n: String, amount: int, life: float) -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.name = n
	p.amount = amount
	p.lifetime = life
	p.preprocess = life
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	p.emission_box_extents = Vector3(BOX, 1, BOX)
	p.top_level = true
	p.visibility_aabb = AABB(Vector3(-BOX, -40, -BOX), Vector3(BOX * 2, 44, BOX * 2))
	var cam := get_viewport().get_camera_3d()
	add_child(p)
	if cam:
		p.global_position = _center(cam)
	return p


## 눈 = region4_frost._build_snow 값.
func _build_snow() -> CPUParticles3D:
	var p := _particles("Snowfall", SNOW_AMOUNT, 5.0)
	p.direction = Vector3(0.15, -1, 0.05)
	p.spread = 12.0
	p.gravity = Vector3(0, -1.2, 0)
	p.initial_velocity_min = 1.2
	p.initial_velocity_max = 2.0
	p.scale_amount_min = 1.0
	p.scale_amount_max = 1.6
	var q := QuadMesh.new()
	q.size = Vector2(0.3, 0.3)   # 손보기 — 크기는 메시로(입자 scale 에 기대지 않음)
	var m := _mat(Color(0.82, 0.85, 0.9, 0.85), BaseMaterial3D.BILLBOARD_PARTICLES)   # 손보기 — BILLBOARD_ENABLED 는 입자 크기(scale_amount)를 버려 눈송이가 1m 네모(큰 흐린 점)였다
	var g := Gradient.new()
	g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0)])
	g.offsets = PackedFloat32Array([0.25, 1.0])
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(1.0, 0.5)
	gt.width = 32
	gt.height = 32
	m.albedo_texture = gt
	q.material = m
	p.mesh = q
	return p


## 비 = 세로로 선 긴 빌보드(0.03×0.5m) · 속도 9~12 · 중력 −9 · 알파 0.45.
func _build_rain() -> CPUParticles3D:
	var p := _particles("Rainfall", RAIN_AMOUNT, 1.3)
	p.direction = Vector3(0.05, -1, 0.02)
	p.spread = 3.0
	p.gravity = Vector3(0, -9, 0)
	p.initial_velocity_min = 9.0
	p.initial_velocity_max = 12.0
	var q := QuadMesh.new()
	q.size = Vector2(0.03, 0.5)
	q.material = _mat(Color(0.78, 0.82, 0.9, 0.45), BaseMaterial3D.BILLBOARD_FIXED_Y)
	p.mesh = q
	return p


func _mat(c: Color, bb: int) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = bb
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = c
	## 카메라 가까운 입자가 화면에 크게 번지지 않게(region4_frost G-0127 식, 손보기 — 3~6m 로는 전술판·위에서 본 컷에 큰 점·굵은 줄이 남아 7~13m)
	m.distance_fade_mode = BaseMaterial3D.DISTANCE_FADE_PIXEL_ALPHA
	m.distance_fade_min_distance = 7.0
	m.distance_fade_max_distance = 13.0
	return m
