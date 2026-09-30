extends WorldEnvironment

## PLAN.md 66-1장 — PC(forward_plus)와 Mobile/Web 프로파일이 각기 다른
## Environment 리소스를 쓰도록 실행 시점에 고른다. 씬 안에는 이 스크립트만
## 두고, 실제 값은 assets/environment/env_pc.tres · env_mobile.tres 둘로만
## 관리한다 — 씬 파일 안에서 렌더러를 분기하지 않는다는 66-1장 원칙.

const ENV_PC: Environment = preload("res://assets/environment/env_pc.tres")
const ENV_MOBILE: Environment = preload("res://assets/environment/env_mobile.tres")


## PLAN 106장 ② — GO 만 손그림 하늘(sky_toon.gdshader). 이 스크립트와 env_*.tres 는
## 다섯 판이 같이 쓰므로(DUNGEON·FOREST·STORY·REALM 씬도 이 스크립트를 단다) 파일은
## 그대로 두고, GO 씬(games/saga_go/ 아래)일 때만 복제본의 하늘을 갈아 끼운다(두
## 프로파일 같은 값 — 66-1 "톤은 같게"). 안개 색 = 지평선 색(102-2 규칙).
const SKY_HORIZON := Color(0.76, 0.88, 0.96)
const TOON_SKY_SCENE_PREFIX := "res://games/saga_go/"  # check_refs:allow — 씬 경로 판별용 문자열일 뿐 GO 스크립트를 부르지 않는다
## GO 만 안개를 옅게 — env_*.tres 의 0.012 는 방 하나·마을 하나 크기 판(다섯 판 공용) 값이라, 이어진 네 지역을 걷는 GO 에선
## 맑은 날(날씨 배율 0.6)에도 100m 앞이 절반 가려져 화면이 뿌옜다(2026-09-26 창 모드 촬영). 원신처럼 멀리 산이 비치게.
## 안개는 그리기 부담과 무관하다(가리기만 하고 덜 그리지 않는다).
## 09-28 0.0035 → 0.0022 — 300m 앞 산이 65% 가려 잿빛 판으로 보였다(이제 약 48%).
## 09-30 0.0022 → 0.0013 + 안개색을 하늘빛보다 한 단 푸르게(공기 원근) — 안개를 아예 끄면 먼 절벽이 검푸른 판이 되고, 하늘빛 안개는 회색으로 씻어 냈다.
## 푸른 옅은 안개는 먼 절벽이 청회색으로 물러나 깊이가 살고 풀·나무는 또렷하다(창 모드 v_statue_far·s_port 비교).
const GO_FOG_DENSITY := 0.0013
const GO_FOG_COLOR := Color(0.66, 0.8, 0.95)
const GO_EXPOSURE := 0.88


func _ready() -> void:
	var base := ENV_MOBILE if (OS.has_feature("mobile") or OS.has_feature("web")) else ENV_PC
	var scene_path := owner.scene_file_path if owner != null else ""
	if not scene_path.begins_with(TOON_SKY_SCENE_PREFIX):
		environment = base
		return
	var env := base.duplicate() as Environment
	var mat := ShaderMaterial.new()
	mat.shader = load("res://saga_core/shaders/sky_toon.gdshader")
	mat.set_shader_parameter("horizon_color", SKY_HORIZON)
	var sky := Sky.new()
	sky.sky_material = mat
	env.sky = sky
	env.fog_light_color = GO_FOG_COLOR
	env.fog_density = GO_FOG_DENSITY
	## 2026-09-28 "그래픽 먼저" — AgX 는 색을 크게 빼서(다섯 판 공용 값) GO 들판이 잿빛으로 바랬다(창 모드 촬영).
	## 원신처럼 맑고 짙게: ACES + 채도·대비 한 단, 하늘빛 주변광 조금 더. 밤·날씨는 이 위에 그대로 곱해진다.
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = GO_EXPOSURE
	env.adjustment_saturation = 1.22
	env.adjustment_contrast = 1.08
	env.ambient_light_energy = 1.15
	env.ssao_intensity = 1.2
	env.glow_intensity = 0.35
	env.fog_sky_affect = 0.35   # 안개가 하늘까지 덮으면 하늘이 허옇게 바랬다 — 하늘은 하늘빛 그대로
	environment = env
