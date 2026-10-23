extends Node3D

## VERTICAL_SLICE_STORY.md 1절 — field_map.gd 머리말이 "문(portal)·채집·
## 보스는 이번 슬라이스에 안 옮긴다"고 적어 뒀던 셋의 마지막. data-side.js
## field.boss(황건 두목, cool:15분) 그대로 — 잡으면 BOSS_COOL_SEC 뒤
## 같은 자리에 다시 선다(story_gather.gd의 respawn과 같은 결, 다만
## 대상이 하나뿐이라 킬 시그널로 다음 스폰을 잇는다).
##
## **2026-09-13 추가 — 사냥터 공용화(21절)** — story_enemy_spawner.gd와
## 같은 이유로 `map_path` export로 바꿨다(보스 이름은 아직 화면에 안
## 띄운다 — field_map.gd BOSS_NAME 머리말 참고, 위치만 옮긴다).
##
## **2026-09-13 추가(같은 날 더) — 사냥터별 보스 배율.** hp_mul·dmg_mul·
## cool_sec을 더 이상 StoryCombat 전역 상수(field 값 하나뿐)로 안 쓰고
## 각 맵의 boss_hp_mul()/boss_dmg_mul()/boss_cool_sec()에서 읽는다
## (field/forest/cave/gorge 넷 다 정의돼 있다 — data-side.js 원문 그대로).
##
## **2026-09-13 추가(같은 날 더) — 몬스터 도감.** `enemy_lv`도 맵에서
## 읽는다(base hp/dmg 공식이 lv를 쓴다, story_enemy.gd 참고) — 지금까지
## 모든 보스가 lv=1 기준 hp(18*hp_mul)로 계산되고 있었는데, forest(lv6)·
## cave(lv14)·gorge(lv26)는 원래 훨씬 센 lv를 쓴다. `enemy_color`도
## data-enemy.js BOSSES의 실제 색(map.boss_color(), 잡졸과 다른 색)으로
## 바꿔 지금까지 넷 다 field 잡졸 색(#c9a83a)을 그대로 뒤집어쓰던 것을
## 바로잡는다.

@export var map_path: String = "res://games/saga_story/data/field_map.gd"

const StoryEnemyScene := preload("res://games/saga_story/world/story_enemy.gd")
const Toast := preload("res://saga_core/ui/toast.gd")

const GROUND_Y := 0.0
const Hidden := preload("res://games/saga_story/data/story_hidden.gd")   # G-0319 숨은 우두머리

var _map: RefCounted
var _boss: Node3D = null
var _fight_t0 := -1   # G-0319 지금 보스가 처음 맞은 때(ms) — 빨리 잡기 셈


func _ready() -> void:
	_map = (load(map_path) as GDScript).new()
	_spawn_boss()


## **2026-09-17 추가 — PLAN 101-2 STORY ④후보(웹판 §5-4 "관문 대장").**
## 이 슬라이스엔 "미사용 보스 6종"이 없다(field/forest/cave/gorge 넷뿐 —
## 나머지 다섯 사냥터는 애초에 보스 자체가 없다, 다음에 볼 자리) — 대신
## **있는 넷을 매주 한 번 강화판으로 다시 살린다**로 재해석했다. 이번
## 주(`StorySaveState.champion_available()`) 그 사냥터를 아직 관문
## 대장으로 못 잡았으면, 평소처럼 자동으로 다시 서는 그 보스가 이번엔
## 강화판이다 — 새 문(게이트) UI를 안 만들고 기존 리스폰 루프 그대로
## 쓴다(story_enemy.gd `is_champion` 스탯 배율·방패·광폭 참고).
func _spawn_boss(hidden := false) -> void:
	var boss := Node3D.new()
	boss.set_script(StoryEnemyScene)
	boss.is_boss = true  # _ready()보다 먼저 잡아야 한다(add_child가 곧바로 _ready를 부른다)
	boss.boss_hp_mul = _map.boss_hp_mul() * (Hidden.HP_MUL if hidden else 1.0)
	boss.boss_dmg_mul = _map.boss_dmg_mul() * (Hidden.DMG_MUL if hidden else 1.0)
	boss.enemy_lv = _map.enemy_lv()
	boss.enemy_color = Hidden.COLOR if hidden else _map.boss_color()
	boss.stage_key = _map.stage_key()
	boss.boss_name = ("숨은 " if hidden else "") + String(_map.BOSS_NAME)   # G-0205 패턴전 토스트·맵 폭·부하 색
	boss.stage_width_m = _map.width_m()
	boss.minion_color = _map.enemy_color()
	var is_champion: bool = not hidden and StorySaveState.champion_available(boss.stage_key)
	boss.is_champion = is_champion
	boss.position = Vector3(_map.boss_position_m(), GROUND_Y, 0)
	add_child(boss)
	if hidden:   # G-0319 — 숨은 우두머리는 다시 서기 고리 밖(평소 보스 타이머는 이미 걸려 있다)
		boss.died.connect(_on_hidden_died)
		Toast.show(self, "🌑 땅이 울린다 — 숨은 %s 이(가) 일어섰다!" % String(_map.BOSS_NAME), 3.5)
		return
	_boss = boss
	_fight_t0 = -1
	boss.died.connect(_on_boss_died)
	if is_champion:
		Toast.show(self, "🚪 관문 대장 — %s(이)가 이번 주 강화판으로 나타났다!" % String(_map.BOSS_NAME), 3.5)


func _on_boss_died() -> void:
	get_tree().create_timer(_map.boss_cool_sec()).timeout.connect(_spawn_boss)
	var sec := -1.0 if _fight_t0 < 0 else float(Time.get_ticks_msec() - _fight_t0) / 1000.0
	if Hidden.should_rise(StorySaveState.hidden, String(_map.stage_key()), sec):
		get_tree().create_timer(Hidden.RISE_SEC).timeout.connect(_spawn_boss.bind(true))


func _process(_delta: float) -> void:
	if _fight_t0 < 0 and _boss != null and is_instance_valid(_boss) and float(_boss.hp) < float(_boss.max_hp):
		_fight_t0 = Time.get_ticks_msec()


func _on_hidden_died() -> void:
	var g := Hidden.beat(StorySaveState.hidden, String(_map.stage_key()), int(_map.enemy_lv()))
	StorySaveState.add_gold(g)
	Toast.show(self, "🌑 숨은 우두머리를 꺾었다 — 💰 +%d" % g, 3.5)
