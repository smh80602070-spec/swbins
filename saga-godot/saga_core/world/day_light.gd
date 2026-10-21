extends Node

## G-0250 — 시간대 빛(3마을·5천하·4종횡 바깥 씬). 1만리는 sky_panorama(해 방향·색 G-0027·0028)·night_visual(밤 G-0028 뒤)이
## 맡고, 세 판은 늘 한낮이었다. 실제 시각 → 키 시각 넷(새벽 6·낮 12·노을 18·밤 21, 4시 전·21시 뒤 = 밤) 사이를 섞어
##   Sun 방향(씬 원래 해를 방위로 돌리고 고도 하한 22° — G-0027 식) · 색(sky_panorama.SUN_TINT 값) · 세기(밤 ×0.28 = night_visual NIGHT.sun_mul)
##   env 복제본 ambient_light_energy·안개색 · sky_real warm(새벽·노을)·stars·밤 하늘색(night_visual NIGHT 값)
## 를 CHECK_SEC 마다 맞춘다. 낮 12시 값 = 씬 파일 값 그대로(섞기 0 이면 원래 값을 그대로 다시 쓴다 — regress md5 를 안 흔든다).
## environment_profile._pick_environment 이 _real_sky_scene(GO 밖) 이면 씬 뿌리에 단다(씬 파일 안 고침).
## 손잡이: SAGA_HOUR=n(0~24, 소수 됨) 이면 그 시각 고정 · SAGA_DAY_LIGHT=0 이면 안 단다.
## env_*.tres·씬 파일은 안 건드린다 — environment_profile 이 만든 복제본·런타임 노드 값만. 1만리 코드는 부르지 않는다(값만 옮겨 적음).

const NightGlow := preload("res://saga_core/world/night_glow.gd")   # G-0277
const GROUP := "saga_day_light"
const CHECK_SEC := 5.0
const SUN_MIN_EL := 22.0   # sky_panorama.SUN_MIN_EL
## 키 = [시, 이름]. 양끝(4 이전·21 이후)은 밤 그대로(TimeOfDay.is_night 21~4시와 같은 경계).
const KEYS := [[4.0, "night"], [6.0, "dawn"], [12.0, "noon"], [18.0, "sunset"], [21.0, "night"]]
## 이름별 값. noon 은 씬 원래 값(az 0·el -1 = 원래 고도·color null = 원래 색·mul 1).
##   az = 원래 해 방위에서 돌린 각(도, +는 서쪽 쪽으로) · el = 고도(도, 하한 22) · color = 해 색(sky_panorama.SUN_TINT dawn·sunset, 밤은 NIGHT.sun_color)
##   sun = 해 세기 배율 · amb = 주변광 배율 · warm·stars·night = sky_real 값(night = 하늘색을 밤 남색으로 섞는 정도)
const SLOT := {
	"dawn": {"az": -80.0, "el": SUN_MIN_EL, "color": Color(1.0, 0.80, 0.68), "sun": 0.75, "amb": 0.9, "warm": 1.0, "stars": 0.0, "night": 0.0},
	"noon": {"az": 0.0, "el": -1.0, "color": null, "sun": 1.0, "amb": 1.0, "warm": 0.0, "stars": 0.0, "night": 0.0},
	"sunset": {"az": 80.0, "el": SUN_MIN_EL, "color": Color(1.0, 0.72, 0.50), "sun": 0.8, "amb": 0.9, "warm": 1.0, "stars": 0.0, "night": 0.0},
	"night": {"az": 150.0, "el": 45.0, "color": Color(0.62, 0.72, 1.0), "sun": 0.28, "amb": 1.0, "warm": 0.0, "stars": 1.0, "night": 1.0},
}
## night_visual.NIGHT 하늘·안개 값(그대로 옮겨 적음).
const NIGHT_SKY := {
	"top_color": Color(0.03, 0.07, 0.19), "horizon_color": Color(0.13, 0.19, 0.36),
	"cloud_color": Color(0.3, 0.35, 0.5), "cloud_shade": Color(0.13, 0.15, 0.26),
}
const NIGHT_FOG_MUL := Color(0.2, 0.25, 0.4)
## 밤 주변광 — 세 판 env 는 주변광이 하늘빛 100% 라 하늘이 남색이 되면 주변광이 같이 꺼져 21시 컷 인물·땅이 검은 실루엣이었다
## (배율 2.0 도 거의 그대로 — 꺼진 하늘의 두 배). 1만리 env(하늘빛 0.65 + 고정 회색)처럼 밤엔 하늘 몫을 줄이고 달빛 남색을 섞는다.
const NIGHT_AMB_SKY := 0.35
const NIGHT_AMB_COLOR := Color(0.42, 0.5, 0.72)

var _sun: DirectionalLight3D
var _we: WorldEnvironment
var _env: Environment
var _sky: ShaderMaterial
var _day := {}
var _check := 0.0
var _moved := false
var last := {}   # 마지막으로 넣은 값(점검용): hour·sun_energy·warm·stars
## G-0251 — weather_visual.gd 가 넣는다(안개색·해는 이 노드만 쓰니 날씨 몫도 여기서 곱한다). 맑음·날씨 없음 = 1.
var weather_tint := Color(1, 1, 1)
var weather_sun_mul := 1.0
## G-0256 — 하늘색(천정·지평선·구름) 배율. 하늘색 넣기는 이 노드만(env 칸 분담) — 밤 남색에도 그대로 곱한다.
var weather_sky := Color(1, 1, 1)


static func enabled() -> bool:
	return OS.get_environment("SAGA_DAY_LIGHT") != "0"


## 지금 시각(시, 0~24). SAGA_HOUR 가 있으면 그 값.
static func hour_now() -> float:
	var h := OS.get_environment("SAGA_HOUR")
	if h != "" and h.is_valid_float():
		return fposmod(h.to_float(), 24.0)
	var t := Time.get_time_dict_from_system()
	return float(t.hour) + float(t.minute) / 60.0


## 순수 함수 — 시각 → [앞 이름, 뒤 이름, 섞기 0~1].
static func slots_at(hour: float) -> Array:
	if hour < KEYS[0][0] or hour >= KEYS[KEYS.size() - 1][0]:
		return ["night", "night", 0.0]
	for i in KEYS.size() - 1:
		var h0: float = KEYS[i][0]
		var h1: float = KEYS[i + 1][0]
		if hour >= h0 and hour < h1:
			return [KEYS[i][1], KEYS[i + 1][1], (hour - h0) / (h1 - h0)]
	return ["noon", "noon", 0.0]


func _ready() -> void:
	add_to_group(GROUP)
	var scene := get_parent()
	_sun = scene.get_node_or_null("Sun") as DirectionalLight3D
	_we = scene.get_node_or_null("WorldEnvironment") as WorldEnvironment
	if _sun:
		_day["xf"] = _sun.global_transform
		_day["sun"] = _sun.light_energy
		_day["sun_color"] = _sun.light_color
		## 원래 해 쪽 방향(빛은 -Z 로 비추니 해는 +Z 쪽)
		var d := _sun.global_transform.basis.z.normalized()
		_day["az"] = rad_to_deg(atan2(d.x, -d.z))
		_day["el"] = rad_to_deg(asin(clampf(d.y, -1.0, 1.0)))
	refresh_now()


func _process(delta: float) -> void:
	_check -= delta
	if _check <= 0.0:
		refresh_now()


## 지금 시각으로 곧바로 맞춘다(시작·촬영·점검).
func refresh_now() -> void:
	_check = CHECK_SEC
	_grab_env()
	var s := slots_at(hour_now())
	_apply(String(s[0]), String(s[1]), float(s[2]))
	last["hour"] = hour_now()


## env 는 형제(story_sky·날씨 등)가 복제본으로 갈아 끼울 수 있다 — 바뀌었으면 낮 값을 다시 잰다.
func _grab_env() -> void:
	var e: Environment = _we.environment if _we else null
	if e == _env:
		return
	_env = e
	_sky = null
	if _env == null:
		return
	_day["ambient"] = _env.ambient_light_energy
	_day["fog"] = _env.fog_light_color
	_day["amb_color"] = _env.ambient_light_color
	_day["amb_sky"] = _env.ambient_light_sky_contribution
	if _env.sky and _env.sky.sky_material is ShaderMaterial:
		_sky = _env.sky.sky_material
		var defaults := {"top_color": Color(0.13, 0.33, 0.76), "horizon_color": Color(0.72, 0.81, 0.92),
			"cloud_color": Color(1.0, 0.99, 0.97), "cloud_shade": Color(0.55, 0.60, 0.70)}   # sky_real.gdshader 기본값
		for k in defaults:
			var v = _sky.get_shader_parameter(k)
			_day["sky_" + k] = v if v is Color else (Color(v.x, v.y, v.z) if v is Vector3 else defaults[k])


func _f(a: Dictionary, b: Dictionary, k: String, t: float) -> float:
	return lerpf(float(a[k]), float(b[k]), t)


func _apply(na: String, nb: String, t: float) -> void:
	var a: Dictionary = SLOT[na]
	var b: Dictionary = SLOT[nb]
	var noon := na == "noon" and (nb == "noon" or t == 0.0)
	if _sun and _day.has("sun"):
		var mul := _f(a, b, "sun", t)
		var ca: Color = a.color if a.color != null else _day.sun_color
		var cb: Color = b.color if b.color != null else _day.sun_color
		if noon:
			if _moved:   # 한 번도 안 돌렸으면 그대로 둔다 — 씬 파일 basis 는 정규직교가 아니라 다시 쓰면 값이 조금 바뀐다(regress·점검 "12시 = 씬 값")
				_sun.global_transform = _day.xf
				_moved = false
			_sun.light_energy = float(_day.sun) * weather_sun_mul
			_sun.light_color = _day.sun_color
		else:
			var el_a: float = a.el if a.el >= 0.0 else _day.el
			var el_b: float = b.el if b.el >= 0.0 else _day.el
			var da := _dir(float(_day.az) + float(a.az), maxf(el_a, SUN_MIN_EL))
			var db := _dir(float(_day.az) + float(b.az), maxf(el_b, SUN_MIN_EL))
			var d := da.slerp(db, t) if da.dot(db) < 0.9999 else da
			_moved = true
			_sun.global_transform = Transform3D(Basis.looking_at(-d.normalized(), Vector3.UP), _sun.global_position)
			_sun.light_energy = float(_day.sun) * mul * weather_sun_mul
			_sun.light_color = ca.lerp(cb, t)
		last["sun_energy"] = _sun.light_energy
	NightGlow.set_night(_f(a, b, "night", t), self)   # G-0277 자체 GLB 불 면·창·가까운 등 점광
	if _env and _day.has("ambient"):
		var nt := _f(a, b, "night", t)
		_env.ambient_light_energy = float(_day.ambient) * _f(a, b, "amb", t)
		_env.ambient_light_color = (_day.amb_color as Color).lerp(NIGHT_AMB_COLOR, nt)
		_env.ambient_light_sky_contribution = lerpf(float(_day.amb_sky), minf(float(_day.amb_sky), NIGHT_AMB_SKY), nt)
		_env.fog_light_color = (_day.fog as Color) * Color(1, 1, 1).lerp(NIGHT_FOG_MUL, nt) * weather_tint
		if _sky:
			var warm := _f(a, b, "warm", t)
			var stars := _f(a, b, "stars", t)
			_sky.set_shader_parameter("warm", warm)
			_sky.set_shader_parameter("stars", stars)
			for k in NIGHT_SKY:
				_sky.set_shader_parameter(k, (_day["sky_" + k] as Color).lerp(NIGHT_SKY[k], nt) * weather_sky)
			last["warm"] = warm
			last["stars"] = stars


## 방위각(0=북 −Z·90=동 +X)·고도(도) → 해 쪽 단위 벡터(sky_panorama.dir_from 과 같은 식).
static func _dir(az_deg: float, el_deg: float) -> Vector3:
	var az := deg_to_rad(az_deg)
	var el := deg_to_rad(el_deg)
	return Vector3(sin(az) * cos(el), sin(el), -cos(az) * cos(el))
