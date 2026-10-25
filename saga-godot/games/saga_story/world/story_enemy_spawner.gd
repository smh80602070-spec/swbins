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

## **G-0211 — 우연 사건 1차(웹 side.js PLAN 11절, px→m ×0.02).** 들어갈 때마다 사건 RNG(_ev_rng — 종 RNG·전역 randf 와 따로)로
## 습격 15%→미니보스 9%→붙잡힌 사람 10% 순으로 굴려 자리 x 하나씩(5.2 + r×(폭−10.4)m). 플레이어가 자리 R 안에 들면 한 번만:
## 습격 = 잡몹 셋(x±2.2, 가장자리 1.2m 안쪽) · 미니 = 잡몹 하나를 크게(boost — 마법·희귀 굴림 건너뜀, story_enemy.gd is_mini)
## · 구조 = 지키는 잡몹 둘(x±1.1) — 다 잡으면 사례금 (30+lv×10)×(0.8~1.2). 웹엔 그림이 없는 붙잡힌 사람은 재해석으로
## 몸 하나(StoryNpcBody, 사례금 때 지움). 사건으로 나온 적도 잡으면 하나 더(웹 1264). 사건은 저장 안 한다.
## **G-0212 — 2차 셋, 굴림은 웹 순서 여섯(상자→채집→습격→미니→상인→구조).** 보물상자 22%(밟으면 금 + 장비 하나 —
## 가방이 없어 장비는 그 자리에 떨궈 밟아 끼는 줍기로) · 채집 보너스 지역 18%(그 구간 채집 ×2, 처음 들어설 때 🍀 —
## story_gather.gd 가 그룹 story_hunt_events 로 forage_mul_at 를 묻는다) · 이동 상인 12%(지나면 90초 상점 ×0.7 —
## StorySaveState.merchant_until_ms, 메모리만). 웹은 🏪 를 어디서든 열지만 고돗 상점은 마을(허도)에만 있어 90초 안에 못 닿는다 —
## 재해석: 이동 상인을 그 자리의 상점(story_merchant.gd, K 로 물목)으로 세운다(R-5 리뷰).

@export var map_path: String = "res://games/saga_story/data/field_map.gd"

const StoryEnemyScene := preload("res://games/saga_story/world/story_enemy.gd")
const StoryEnemies := preload("res://games/saga_story/data/story_enemies.gd")
const StoryCombat := preload("res://games/saga_story/data/story_combat.gd")
const StoryNpcBody := preload("res://games/saga_story/world/story_npc_body.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const StoryLook := preload("res://games/saga_story/data/story_look.gd")
const StoryGearPickup := preload("res://games/saga_story/world/story_gear_pickup.gd")
const StoryMerchant := preload("res://games/saga_story/world/story_merchant.gd")

const GROUND_Y := 0.0
const RESPAWN_CLEAR_M := 4.0
const RESPAWN_TRIES := 5
const MAGIC_CHANCE := 0.12   # G-0210 웹 side.js MAGIC_CHANCE
const RARE_CHANCE := 0.07    # G-0210 웹 side.js RARE_CHANCE
## G-0211 웹 side.js 224·233·240
const AMBUSH_CHANCE := 0.15
const AMBUSH_R_M := 70.0 * 0.02
const AMBUSH_COUNT := 3
const AMBUSH_SPREAD_M := 110.0 * 0.02
const MINI_CHANCE := 0.09
const MINI_R_M := 70.0 * 0.02
const MINI_HP_MUL := 7.0
const MINI_DMG_MUL := 1.7
const RESCUE_CHANCE := 0.10
const RESCUE_R_M := 90.0 * 0.02
const RESCUE_COUNT := 2
const EVENT_MARGIN_M := 260.0 * 0.02   # 자리 x = 260 + r×(폭−520)px
const EVENT_EDGE_M := 60.0 * 0.02      # 습격·지키는 잡몹은 가장자리 60px 안쪽
## G-0212 웹 side.js 228·234~236 · side-view3d.js 626~657
const CHEST_CHANCE := 0.22
const CHEST_R_M := 46.0 * 0.02
const CHEST_MARGIN_M := 200.0 * 0.02   # x = 200 + r×(폭−400)px
const CHEST_SIZE := Vector3(0.42, 0.3, 0.3)   # 웹 h 30px 상자(0.7h×0.5h×0.5h)
const CHEST_COLOR := Color(0.784, 0.604, 0.235)   # #c89a3c
const FORAGE_CHANCE := 0.18
const FORAGE_HALF_M := 130.0 * 0.02
const FORAGE_MARGIN_M := 170.0 * 0.02  # cx = (HALF+40) + r×(폭−(HALF+40)×2)px
const FORAGE_MUL := 2
const FORAGE_COLOR := Color(0.549, 0.949, 0.549, 0.28)   # #8cf28c · 0.28
const MERCHANT_CHANCE := 0.12
const MERCHANT_R_M := 70.0 * 0.02
const MERCHANT_DUR_SEC := 90

var _map: RefCounted
var _rng := RandomNumberGenerator.new()
var respawned := 0 # 점검용
@export var event_seed := -1   # G-0211 −1 = 들어갈 때마다 다름(randomize), 점검이 고정
var _ev_rng := RandomNumberGenerator.new()
var ambush: Dictionary = {}    # {x, triggered} — 비면 이번엔 없음
var miniboss: Dictionary = {}  # {x, triggered}
var rescue: Dictionary = {}    # {x, spawned, done}
var mini_enemy: Node3D = null  # 점검용
var rescue_gold := 0           # 점검용
var _guards: Array = []
var _captive: Node3D = null
var chest: Dictionary = {}     # G-0212 {x, opened}
var forage: Dictionary = {}    # {x1, x2, notified}
var merchant: Dictionary = {}  # {x, triggered}
var chest_gold := 0            # 점검용
var chest_gear := ""           # 점검용
var _chest_node: Node3D = null
var _merchant_body: Node3D = null


func _ready() -> void:
	_map = (load(map_path) as GDScript).new()
	_rng.seed = hash(String(_map.stage_key())) % 100000 + 211
	add_to_group("story_hunt_events")   # G-0212 채집이 배수를 묻는 곳
	preload("res://games/saga_story/world/story_rune.gd").attach(self)   # G-0382 룬(사냥터에만)
	preload("res://games/saga_story/world/story_elite.gd").attach(self)   # G-0389 엘리트(처치 N 마다)
	for x: float in _map.enemy_positions_m():
		spawn_at(x)
	if event_seed < 0:
		_ev_rng.randomize()
	else:
		_ev_rng.seed = event_seed
	var ev := roll_events(_ev_rng, float(_map.width_m()))
	chest = ev.chest
	forage = ev.forage
	ambush = ev.ambush
	miniboss = ev.miniboss
	merchant = ev.merchant
	rescue = ev.rescue
	_build_props()


## G-0211·G-0212 — 웹 run 만들기(side.js 350) 순서: buildChest→ForageZone→Ambush→Miniboss→Merchant→Rescue(각자 굴림 하나 + 맞으면 자리 하나).
static func roll_events(rng: RandomNumberGenerator, width_m: float) -> Dictionary:
	var out := {"chest": {}, "forage": {}, "ambush": {}, "miniboss": {}, "merchant": {}, "rescue": {}}
	if rng.randf() < CHEST_CHANCE:
		out.chest = {"x": CHEST_MARGIN_M + rng.randf() * (width_m - CHEST_MARGIN_M * 2.0), "opened": false}
	if rng.randf() < FORAGE_CHANCE:
		var cx := FORAGE_MARGIN_M + rng.randf() * (width_m - FORAGE_MARGIN_M * 2.0)
		out.forage = {"x1": cx - FORAGE_HALF_M, "x2": cx + FORAGE_HALF_M, "notified": false}
	if rng.randf() < AMBUSH_CHANCE:
		out.ambush = {"x": _event_x(rng, width_m), "triggered": false}
	if rng.randf() < MINI_CHANCE:
		out.miniboss = {"x": _event_x(rng, width_m), "triggered": false}
	if rng.randf() < MERCHANT_CHANCE:
		out.merchant = {"x": _event_x(rng, width_m), "triggered": false}
	if rng.randf() < RESCUE_CHANCE:
		out.rescue = {"x": _event_x(rng, width_m), "spawned": false, "done": false}
	return out


static func _event_x(rng: RandomNumberGenerator, width_m: float) -> float:
	return EVENT_MARGIN_M + rng.randf() * (width_m - EVENT_MARGIN_M * 2.0)


## G-0212 — 상자(코드 상자, 웹 색)·채집 구간 바닥 판(옅은 초록 반투명)·이동 상인을 세운다. 점검·촬영이 사건을 바꾸면 다시 부르는데,
## 이 셋만 다시 세운다(구조의 사람 몸·지키는 잡몹·미니는 발동 때 생기니 발동 전에 바꿀 것).
func _build_props() -> void:
	for n in [_chest_node, _merchant_body]:
		if n != null and is_instance_valid(n):
			n.free()
	_chest_node = null
	_merchant_body = null
	var old := get_node_or_null("ForagePatch")
	if old != null:
		old.free()
	if not chest.is_empty():
		var mi := MeshInstance3D.new()
		mi.name = "EventChest"
		var box := BoxMesh.new()
		box.size = CHEST_SIZE * StoryLook.BODY_SCALE
		mi.mesh = box
		var mat := StandardMaterial3D.new()
		mat.albedo_color = CHEST_COLOR
		mi.material_override = mat
		mi.position = Vector3(float(chest.x), GROUND_Y + box.size.y * 0.5, -0.4)
		add_child(mi)
		_chest_node = mi
	if not forage.is_empty():
		var patch := MeshInstance3D.new()
		patch.name = "ForagePatch"
		var plane := PlaneMesh.new()
		plane.size = Vector2(float(forage.x2) - float(forage.x1), 3.2)   # 웹 160px 깊이
		patch.mesh = plane
		var pm := StandardMaterial3D.new()
		pm.albedo_color = FORAGE_COLOR
		pm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		pm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		pm.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
		patch.material_override = pm
		patch.position = Vector3((float(forage.x1) + float(forage.x2)) * 0.5, GROUND_Y + 0.03, -1.2)
		add_child(patch)
		## 재해석 — 고돗 들판 바닥이 이미 밝은 초록이라 판만으론 안 보인다(st_events2 촬영): 구간 양 끝에 🍀 표시
		for edge_x: float in [float(forage.x1), float(forage.x2)]:
			var mark := Label3D.new()
			mark.text = "🍀"
			mark.font_size = 64
			mark.pixel_size = 0.01
			mark.outline_size = 10
			mark.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			mark.position = Vector3(edge_x - patch.position.x, 0.5, 1.2)
			patch.add_child(mark)
	if not merchant.is_empty():
		_merchant_body = Node3D.new()
		_merchant_body.name = "WanderMerchant"
		_merchant_body.set_script(StoryMerchant)
		_merchant_body.position = Vector3(float(merchant.x), GROUND_Y, -0.6)
		add_child(_merchant_body)


## G-0212 상자 장비 후보 — R-5 리뷰: 적 드롭(_maybe_drop_gear)처럼 지금 낀 바로 그 키는 뺀다(같은 걸 다시 끼면 주문서 강화가 지워진다)
static func chest_pool(lv: float) -> Array:
	return StoryCombat.gear_pool_for(lv).filter(func(k): return String(StorySaveState.equipped.get(String(StoryCombat.GEAR_ITEMS[k].slot), "")) != k)


## G-0212 — 그 x 의 채집 배수(채집 보너스 구간 안 2, 밖 1)
func forage_mul_at(x: float) -> int:
	if not forage.is_empty() and x >= float(forage.x1) and x <= float(forage.x2):
		return FORAGE_MUL
	return 1


func _edge_clamp(x: float) -> float:
	return clampf(x, EVENT_EDGE_M, float(_map.width_m()) - EVENT_EDGE_M)


## 웹 update() 2022~2075 — 자리를 지나면 한 번만.
## 아직 발동할 사건이 남았나(R-5 리뷰 — 다 끝나면 매 틱 플레이어 찾기·검사를 안 한다)
func _pending() -> bool:
	return (not chest.is_empty() and not chest.opened) or (not forage.is_empty() and not forage.notified) \
		or (not ambush.is_empty() and not ambush.triggered) or (not miniboss.is_empty() and not miniboss.triggered) \
		or (not merchant.is_empty() and not merchant.triggered) or (not rescue.is_empty() and not rescue.done)


func _physics_process(_delta: float) -> void:
	if not _pending():
		return
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if player == null:
		return
	var px: float = player.global_position.x - global_position.x
	## G-0212 채집 보너스 — 처음 들어선 순간에만 한 번 알린다(웹 1975)
	if not forage.is_empty() and not forage.notified and px >= float(forage.x1) and px <= float(forage.x2):
		forage.notified = true
		Toast.show(self, "🍀 채집이 넘치는 곳이다!", 2.5)
	## G-0212 보물상자(웹 2004) — 금은 바로, 장비는 상자 자리에 줍기로(가방 없음)
	if not chest.is_empty() and not chest.opened and absf(float(chest.x) - px) < CHEST_R_M:
		chest.opened = true
		var lv := float(_map.enemy_lv())
		chest_gold = roundi((40.0 + lv * 12.0) * (0.8 + _ev_rng.randf() * 0.6) * StoryCombat.GAIN_GOLD)
		StorySaveState.add_gold(chest_gold)
		var pool: Array = chest_pool(lv)
		chest_gear = String(pool[_ev_rng.randi() % pool.size()]) if not pool.is_empty() else ""
		var msg := "💰 보물상자! 💰+%d" % chest_gold
		if chest_gear != "":
			StoryGearPickup.spawn_at(self, Vector3(float(chest.x), GROUND_Y, 0.0), chest_gear)
			msg += " · 📦 %s" % String(StoryCombat.item_def(chest_gear).get("name", chest_gear))
		if _chest_node != null:
			_chest_node.hide()
		Toast.show(self, msg, 2.5)
	if not ambush.is_empty() and not ambush.triggered and absf(float(ambush.x) - px) < AMBUSH_R_M:
		ambush.triggered = true
		for i in AMBUSH_COUNT:
			spawn_at(_edge_clamp(float(ambush.x) + (i - (AMBUSH_COUNT - 1) * 0.5) * AMBUSH_SPREAD_M))
		Toast.show(self, "🚨 몬스터 무리가 덮쳤다!", 2.5)
	if not miniboss.is_empty() and not miniboss.triggered and absf(float(miniboss.x) - px) < MINI_R_M:
		miniboss.triggered = true
		mini_enemy = spawn_at(float(miniboss.x), {"hp": MINI_HP_MUL, "dmg": MINI_DMG_MUL})
		Toast.show(self, "👹 미니보스 %s 등장!" % String(mini_enemy.species.get("name", "")), 2.5)
	## G-0212 이동 상인(웹 2046) — 값에만 잠깐 얹는다
	if not merchant.is_empty() and not merchant.triggered and absf(float(merchant.x) - px) < MERCHANT_R_M:
		merchant.triggered = true
		StorySaveState.merchant_until_ms = Time.get_ticks_msec() + MERCHANT_DUR_SEC * 1000
		Toast.show(self, "🛒 지나가던 상인 — %d초 동안 상점이 30%% 싸집니다! · K: 물목" % MERCHANT_DUR_SEC, 2.5)   # 그 자리 상점 안내를 덮으니 합침
	if not rescue.is_empty() and not rescue.spawned and absf(float(rescue.x) - px) < RESCUE_R_M:
		rescue.spawned = true
		for i in RESCUE_COUNT:
			var g := spawn_at(_edge_clamp(float(rescue.x) + (i - (RESCUE_COUNT - 1) * 0.5) * AMBUSH_SPREAD_M))
			g.guard = true
			_guards.append(g)
		_captive = StoryNpcBody.build("rescue")
		_captive.position = Vector3(float(rescue.x), GROUND_Y, -0.5)
		add_child(_captive)
		Toast.show(self, "😱 도적에게 붙잡힌 사람이 있다!", 2.5)
	if not rescue.is_empty() and rescue.spawned and not rescue.done:
		if _guards.all(func(g): return not is_instance_valid(g) or g._dead):
			rescue.done = true
			rescue_gold = roundi((30.0 + float(_map.enemy_lv()) * 10.0) * (0.8 + _ev_rng.randf() * 0.4) * StoryCombat.GAIN_GOLD)
			StorySaveState.add_gold(rescue_gold)
			if _captive != null:
				_captive.queue_free()
				_captive = null
			Toast.show(self, "🙏 구해줘서 고맙다며 사례금을 줬다 · 💰+%d" % rescue_gold, 2.5)


## 자리 x 에 잡몹 하나 — 종은 이 사냥터 단계 풀에서, 걷는 방향도 같은 RNG 로.
## G-0210 — 웹 enemyRef·spawnEnemy 굴림 순서 그대로(전부 이 RNG): 시대 적(40%, 그 단계 ERA 풀) → 종 → 방향
## → 마법형(근접만 12%) → 희귀형(7%) → 역할 RNG 씨앗.
## G-0211 boost {hp, dmg}(미니보스) — 웹처럼 마법·희귀 굴림을 건너뛴다(단락 평가 — RNG 도 안 씀).
func spawn_at(x: float, boost: Dictionary = {}) -> Node3D:
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
	if role == "melee" and boost.is_empty() and _rng.randf() < MAGIC_CHANCE:
		role = "magic"
	enemy.role = role
	enemy.is_rare = boost.is_empty() and _rng.randf() < RARE_CHANCE
	if not boost.is_empty():
		enemy.is_mini = true
		enemy.mini_hp_mul = float(boost.hp)
		enemy.mini_dmg_mul = float(boost.dmg)
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
	var el := get_node_or_null("StoryElite")   # G-0389 처치 셈
	if el != null:
		el.call("on_kill")
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
