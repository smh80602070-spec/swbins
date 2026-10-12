extends Node3D

## VERTICAL_SLICE_STORY.md 1절 — <map>.enemy_positions_m()의 고정 자리
## 셋에 잡졸(story_enemy.gd)을 하나씩 세운다. 원작 spawnEnemy()의
## 무작위 리스폰은 "제외" 목록(day/파도 시스템 자체가 이번 슬라이스
## 밖)이라, 한 번 세우고 그걸로 끝 — 다 잡으면 "첫 사냥" 사명만 남는다.
##
## **2026-09-13 추가 — 사냥터 공용화(21절, story_terrain_builder.gd와
## 같은 결).** field 전용으로 FieldMap을 상수 preload하던 것을 `map_path`
## export로 바꿨다 — 새 사냥터를 추가할 때 이 파일을 복제하지 않는다.
##
## **2026-09-13 추가(같은 날 더) — 몬스터 도감.** 지금까지 잡졸은 모든
## 사냥터가 story_enemy.gd 기본값(황건적, lv1) 하나를 같이 썼다 — 이제
## 맵의 enemy_lv()/enemy_color()를 읽어 사냥터마다 다른 종·수치로 세운다
## (story_boss_spawner.gd가 boss_hp_mul 등을 넘기는 것과 같은 배선).
##
## **2026-09-13 추가(같은 날 더 더) — 원거리 적.** map.enemy_is_ranged()도
## 같이 읽는다 — forest_map.gd(오랑캐 궁수)만 true, 나머지 셋은 false.

## **G-0209 — 잡몹 명단·사냥터가 안 빈다(웹 side.js spawnEnemy·kill).** 자리마다 종을 그 단계 풀
## (StoryEnemies.pool_for(lv))에서 자체 RNG 로 고른다(사냥터·순번이 같으면 같은 종 — 전역 randi 순서는 안 바꿈).
## 잡몹이 죽으면 "잡은 자리 대신 다른 곳에서 하나 더"(웹 kill) — x = (200 + rand×(폭−300))px 그대로,
## 재해석 한 줄: 플레이어 4m 안이면 다시 굴린다(최대 5번 — 눈앞에 갑자기 솟지 않게). 사냥터 잡몹은 늘 셋.
## 맵 enemy_color()·enemy_is_ranged() 는 종이 색·원거리를 덮어쓰기 전의 기본값으로 남는다.

@export var map_path: String = "res://games/saga_story/data/field_map.gd"

const StoryEnemyScene := preload("res://games/saga_story/world/story_enemy.gd")
const StoryEnemies := preload("res://games/saga_story/data/story_enemies.gd")

const GROUND_Y := 0.0
const RESPAWN_CLEAR_M := 4.0
const RESPAWN_TRIES := 5
const MAGIC_CHANCE := 0.12   # G-0210 웹 side.js MAGIC_CHANCE
const RARE_CHANCE := 0.07    # G-0210 웹 side.js RARE_CHANCE

var _map: RefCounted
var _rng := RandomNumberGenerator.new()
var respawned := 0 # 점검용


func _ready() -> void:
	_map = (load(map_path) as GDScript).new()
	_rng.seed = hash(String(_map.stage_key())) % 100000 + 211
	for x: float in _map.enemy_positions_m():
		spawn_at(x)


## 자리 x 에 잡몹 하나 — 종은 이 사냥터 단계 풀에서, 걷는 방향도 같은 RNG 로.
## G-0210 — 웹 enemyRef·spawnEnemy 굴림 순서 그대로(전부 이 RNG): 시대 적(40%, 그 단계 ERA 풀) → 종 → 방향
## → 마법형(근접만 12%) → 희귀형(7%) → 역할 RNG 씨앗.
func spawn_at(x: float) -> Node3D:
	var lv := float(_map.enemy_lv())
	var pool := StoryEnemies.pool_for(lv)
	var era := StoryEnemies.era_pool_for(lv)
	if not era.is_empty() and _rng.randf() < StoryEnemies.ERA_SHARE:
		pool = era
	var enemy := Node3D.new()
	enemy.set_script(StoryEnemyScene)
	enemy.species = pool[_rng.randi() % pool.size()]
	enemy.walk_dir = 1.0 if _rng.randf() < 0.5 else -1.0
	var role := StoryEnemies.role_of(enemy.species)
	if role == "melee" and _rng.randf() < MAGIC_CHANCE:
		role = "magic"
	enemy.role = role
	enemy.is_rare = _rng.randf() < RARE_CHANCE
	enemy.role_seed = _rng.randi()
	enemy.enemy_lv = _map.enemy_lv()
	enemy.enemy_color = _map.enemy_color()
	enemy.is_ranged = _map.enemy_is_ranged()
	enemy.stage_key = _map.stage_key()
	enemy.stage_width_m = _map.width_m()
	enemy.position = Vector3(x, GROUND_Y, 0)
	enemy.died.connect(_on_died, CONNECT_ONE_SHOT)
	add_child(enemy)
	return enemy


func _on_died() -> void:
	_respawn.call_deferred()


## 웹 kill() 끝 spawnEnemy() — 다른 자리에 하나 더.
func _respawn() -> void:
	if not is_inside_tree():
		return
	var width_px: float = float(_map.width_m()) / 0.02
	var player := get_tree().get_first_node_in_group("player") as Node3D
	var x := 0.0
	for i in RESPAWN_TRIES:
		x = (200.0 + _rng.randf() * (width_px - 300.0)) * 0.02
		if player == null or absf(player.global_position.x - (global_position.x + x)) >= RESPAWN_CLEAR_M:
			break
	spawn_at(x)
	respawned += 1
