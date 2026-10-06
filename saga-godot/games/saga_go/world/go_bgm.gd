extends Node
## GO 배경음 연결(G-0011) — 플레이어가 선 지역을 1초마다 보고 마을이면 `go-town`, 그 밖(포구·폐허·고원…)이면 `go-field` 곡을 건다.
## 들판 전투(`field_combat.in_combat()`)에 들면 `go-battle`(G-0013) — 끝난 뒤 BATTLE_HOLD_SEC 동안은 그대로 둬서 곡이 깜빡이지 않게.
## G-0034 — 보스(들판·주간 보스 field_boss, 이야기 보스 go_story_boss)와 싸우는 동안 `go-boss`, 결말 장(29·38·41장)을 마치면 ENDING_HOLD 초 `go-ending`.
##   순간마다 짧은 음악(Bgm.stinger): 레벨업·발견·임무(장 완료·주간 도전)·승리(비경·보스)·패배(전멸)·보스 등장·위험(체력 25% 밑)·
##   희귀/전설(알 부화 ★4/★5)·비밀(진귀·화려 상자). 곡 우선순위: 엔딩 > 보스 > 전투 > 마을/들판.
## 곡 파일이 없으면 Bgm 이 조용히 넘어간다. test_village.gd 가 붙인다.
const Bgm := preload("res://saga_core/audio/bgm.gd")
const TestMap := preload("res://games/saga_go/data/test_map.gd")
const FieldEnemy := preload("res://games/saga_go/combat/field_enemy.gd")
const Pets := preload("res://saga_core/data/pets.gd")
const POLL_SEC := 1.0
const BATTLE_HOLD_SEC := 5.0
const ENDING_CHAPTERS := [28, 37, 40]   # chapter_done(ch) 의 ch — 29·38·41장(1·2·3차 결말)
const ENDING_HOLD := 150.0
const BOSS_RANGE := 40.0
const DANGER_RATIO := 0.25
const DANGER_REARM := 0.5
const QUIET_SEC := 3.0   # 불러온 직후(세이브 복원 신호)는 발견 소리를 안 낸다
const SECRET_GRADES := ["precious", "luxurious"]

var _t := POLL_SEC  # 첫 프레임에 바로 한 번
var _battle_left := 0.0
var _ending_left := 0.0
var _age := 0.0
var _hooked := false
var _codex_n := -1
var _boss: Node = null
var _danger_armed := true

func _ready() -> void:
	add_to_group("go_music")

func _process(delta: float) -> void:
	_age += delta
	if not _hooked and _age > 0.2:
		_hook()
	_t += delta
	_battle_left = maxf(0.0, _battle_left - delta)
	_ending_left = maxf(0.0, _ending_left - delta)
	if _t < POLL_SEC:
		return
	_t = 0.0
	var p := get_tree().get_first_node_in_group("player") as Node3D
	if p == null:
		return
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	if fc != null and fc.call("in_combat"):
		_battle_left = BATTLE_HOLD_SEC
	_watch_boss(p)
	_watch_danger(fc)
	if _ending_left > 0.0:
		Bgm.play(self, "go-ending")
		return
	if _boss != null:
		Bgm.play(self, "go-boss")
		return
	if _battle_left > 0.0:
		Bgm.play(self, "go-battle")
		return
	Bgm.play(self, "go-town" if TestMap.region_at(p.global_position) == "village" else "go-field")

## 다른 노드가 다 선 뒤 한 번 — 신호를 건다.
func _hook() -> void:
	_hooked = true
	_codex_n = CodexState.count()
	PartyState.level_up.connect(func(_lv: int) -> void: Bgm.stinger(self, "levelup"))
	CodexState.codex_changed.connect(_on_codex)
	var sq := get_tree().get_first_node_in_group("go_story")
	if sq != null and sq.has_signal("chapter_done"):
		sq.connect("chapter_done", _on_chapter_done)
	var wg := get_tree().get_first_node_in_group("go_weekly_goals")
	if wg != null and wg.has_signal("completed"):
		wg.connect("completed", func(_id: String) -> void: Bgm.stinger(self, "quest"))
	var dm := get_tree().get_first_node_in_group("go_domains")
	if dm != null and dm.has_signal("state_changed"):
		dm.connect("state_changed", func(st: String) -> void:
			if st == "cleared":
				Bgm.stinger(self, "victory"))
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	if fc != null and fc.has_signal("party_wiped"):
		fc.connect("party_wiped", func() -> void: Bgm.stinger(self, "defeat"))
	var eg := get_tree().get_first_node_in_group("go_eggs")
	if eg != null and eg.has_signal("hatched"):
		eg.connect("hatched", _on_hatched)
	for c in get_tree().get_nodes_in_group("treasure_chest"):
		_hook_chest(c)
	get_tree().node_added.connect(func(n: Node) -> void:
		if n.is_in_group("treasure_chest"):
			_hook_chest(n))

func _hook_chest(c: Node) -> void:
	if c.has_signal("opened") and not c.is_connected("opened", _on_chest):
		c.connect("opened", _on_chest)

func _on_codex() -> void:
	var n := CodexState.count()
	if n > _codex_n and _age > QUIET_SEC:
		Bgm.stinger(self, "discover")
	_codex_n = n

func _on_chapter_done(ch: int) -> void:
	if ENDING_CHAPTERS.has(ch):
		_ending_left = ENDING_HOLD
		_t = POLL_SEC   # 곡을 바로 바꾼다
	else:
		Bgm.stinger(self, "quest")

func _on_hatched(pet_id: String, _dup: bool) -> void:
	var p: Variant = Pets.find(pet_id)
	var r := int(p.rarity) if p != null else 0
	if r >= 5:
		Bgm.stinger(self, "gacha_legend")
	elif r == 4:
		Bgm.stinger(self, "gacha_rare")

func _on_chest(chest: Node3D) -> void:
	if SECRET_GRADES.has(String(chest.get("grade"))):
		Bgm.stinger(self, "secret")

## 싸우는 보스(들판·주간 field_boss 또는 이야기 보스) — BOSS_RANGE 안, 쉬거나 돌아가거나 죽은 것은 뺀다.
func engaged_boss(p: Node3D) -> Node:
	for e in get_tree().get_nodes_in_group("field_enemy"):
		var s: Script = e.get_script()
		var is_boss := e.is_in_group("go_story_boss") or (s != null and s.resource_path.ends_with("field_boss.gd"))
		if not is_boss:
			continue
		var ai := int(e.get("ai"))
		if ai == FieldEnemy.AI.IDLE or ai == FieldEnemy.AI.RETURN or ai == FieldEnemy.AI.DEAD:
			continue
		if p.global_position.distance_to((e as Node3D).global_position) <= BOSS_RANGE:
			return e
	return null

func _watch_boss(p: Node3D) -> void:
	if _boss != null and (not is_instance_valid(_boss) or _boss.call("is_dead")):
		if is_instance_valid(_boss):
			Bgm.stinger(self, "victory")
		_boss = null
	if _boss == null:
		var b := engaged_boss(p)
		if b != null:
			_boss = b
			Bgm.stinger(self, "boss_appear")
	elif engaged_boss(p) == null:
		_boss = null   # 멀어졌거나 보스가 물러남

func _watch_danger(fc: Node) -> void:
	if fc == null:
		return
	var mx := float(fc.get("max_hp"))
	if mx <= 0.0:
		return
	var r := float(fc.get("hp")) / mx
	if r > 0.0 and r < DANGER_RATIO and _danger_armed:
		_danger_armed = false
		Bgm.stinger(self, "danger")
	elif r >= DANGER_REARM:
		_danger_armed = true
