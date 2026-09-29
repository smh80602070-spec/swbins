extends Node

## VERTICAL_SLICE_STORY.md 25절 — 사냥터별 하늘 색(data-side.js STAGES의
## `sky: [top, horizon]` 그대로, 아홉 자리 전부 다르다). env_pc.tres/
## env_mobile.tres 자체는 손 안 댄다 — games/saga_go/world/
## season_weather_visual.gd와 같은 원칙(다섯 판 공용 리소스는 기준값
## 그대로 둔다). 다만 그 파일과 달리 이건 **씬마다 완전히 다른 하늘**이라
## 공용 Environment를 직접 고치면 다른 판(GO/DUNGEON/FOREST/REALM도 같은
## env_pc.tres를 쓴다)에 물들 수 있어, 이 씬 전용 사본으로 갈아 끼운
## 뒤에만 고친다(`duplicate(true)` — 원본 리소스는 그대로).
##
## environment_profile.gd(WorldEnvironment)가 `environment`를 먼저 골라
## 둬야 하므로(season_weather_visual.gd와 같은 형제 순서 규칙 — 씬 파일
## 에서 WorldEnvironment 바로 다음 자리에 둔다), 이 노드는 그 형제 뒤에
## 놓는다.
##
## story_terrain_builder.gd의 `ground_color` export와 같은 패턴 — 씬마다
## 다른 값을 export로 얹는다(기본값은 field). 원본 hex는 씬이 아홉이라
## .tscn마다 못 달아 여기 한 번에 모아 둔다:
##   sinya #f2d9a0/#f7ecc9 · heodo #e8c15a/#f5e2a0 · field #79c3e8/#c6e6f2 ·
##   gangneungjin #4f8fa8/#a8d8e0 · forest #5fa06a/#a8d49a ·
##   namjeongseong #6b6b78/#a9a9b8 · cave #2b2436/#4a3d58 ·
##   gisanchae #5a2c1e/#a85c3a · gorge #3a1410/#8f3a1c

@export var sky_top_color := Color(0.4745, 0.7647, 0.9098, 1)      # field #79c3e8
@export var sky_horizon_color := Color(0.7765, 0.9020, 0.9490, 1)  # field #c6e6f2
@export var world_environment_path: NodePath = NodePath("../WorldEnvironment")


func _ready() -> void:
	var world_env := get_node(world_environment_path) as WorldEnvironment
	if world_env == null or world_env.environment == null:
		return
	var env: Environment = world_env.environment.duplicate(true)
	world_env.environment = env
	if env.sky == null:
		return
	var sky_mat := env.sky.sky_material as ProceduralSkyMaterial
	if sky_mat == null:
		return
	sky_mat.sky_top_color = sky_top_color
	sky_mat.sky_horizon_color = sky_horizon_color
	## 발판 아래 허공이 잿빛 땅 반구로 보였다(창 모드 SinyaField) — 아래 반구도 같은 하늘빛으로 이어 준다.
	sky_mat.ground_horizon_color = sky_horizon_color
	sky_mat.ground_bottom_color = sky_horizon_color.darkened(0.12)
