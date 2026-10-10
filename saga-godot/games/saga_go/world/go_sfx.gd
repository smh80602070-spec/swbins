extends Node

## G-0177 — 1만리 효과음. `assets/audio/sfx/` 에 무기별 타격·피격·치명·상자·동전·임무·요리·낚시·UI 소리가 가져와져 있었는데
## 아무도 안 불러 타격은 combat_feel 의 sfxgen wav 3개만 돌았다. 두 길로 낸다:
##   ① CombatFeel.sound_hook — hit·pickup·ui 를 여기서 갈음(다른 판은 hook 을 안 걸어 그대로)
##      hit: 대상이 플레이어면 지금 인물 무기의 hurt, 아니면 무기의 hit(1·2 번갈아) · 치명이면 crit 겹침
##      pick: "냥…" 동전 · "보물…" 큰 동전 · 그 밖 줍기
##   ② `get_tree().call_group("go_sfx", "play", 키)` — 상자·쓰러짐·막음·회복·임무·요리·입질·찌
## 소리는 처음 한 번 load 해 두고, 종류마다 AudioStreamPlayer 하나를 돌려 쓴다. 같은 종류는 GAP 초 안이면 한 번만(범위 타격이 겹쳐 울리지 않게).
## 레벨업은 뺀다 — go_bgm.gd 의 stinger·Voice 가 이미 운다. counts·last 는 점검(probe_go_sfx.gd)용.

const DIR := "res://assets/audio/sfx/"
const DB := {
	"hit": -6.0, "hurt": -6.0, "crit": -8.0, "death": -10.0, "block": -8.0, "chest_open": -6.0,
	"coin": -10.0, "coin_big": -10.0, "item_pick": -12.0, "quest_accept": -6.0, "quest_done": -6.0,
	"heal": -12.0, "cook_done": -8.0, "fish_bite": -6.0, "splash": -10.0, "ui": -14.0,
}
const GAP := {"hit": 0.05, "hurt": 0.05, "crit": 0.05, "heal": 1.0}
const DEFAULT_GAP := 0.03
## weapons.gd TYPES → sfx 무기 이름
const WEAPON_SFX := {"sword": "sword", "claymore": "axe", "polearm": "spear", "catalyst": "staff", "bow": "bow"}
const Weapons := preload("res://games/saga_go/data/weapons.gd")

var counts := {}
var last := {}   # 종류 → 마지막에 낸 파일 키(점검용)
var _streams := {}
var _players := {}
var _last_ms := {}
var _alt := 0


func _ready() -> void:
	add_to_group("go_sfx")
	for k in DB:
		counts[k] = 0
		var ap := AudioStreamPlayer.new()
		ap.volume_db = float(DB[k])
		ap.max_polyphony = 3
		add_child(ap)
		_players[k] = ap
	for w in WEAPON_SFX.values():
		for n in [1, 2]:
			_load("%s_hit_%d" % [w, n])
			_load("%s_hurt_%d" % [w, n])
	for k in ["crit", "death", "block", "chest_open", "coin", "coin_big", "item_pick", "quest_accept",
			"quest_done", "heal", "cook_done", "fish_bite", "splash", "ui_click"]:
		_load(k)
	CombatFeel.sound_hook = _on_feel_sound


func _exit_tree() -> void:
	if CombatFeel.sound_hook == Callable(self, "_on_feel_sound"):
		CombatFeel.sound_hook = Callable()


func loaded() -> int:
	return _streams.size()


func _load(key: String) -> void:
	var path := DIR + "sfx_%s.ogg" % key
	if ResourceLoader.exists(path):
		_streams[key] = load(path)


## call_group 으로 부르는 쪽 — 키 이름 = 파일 이름(sfx_ 뺀 것) = 종류.
func play(key: String) -> void:
	_play(key, key)


func _on_feel_sound(kind: String, target: Node3D, crit: bool, label: String) -> bool:
	match kind:
		"hit":
			_alt = 1 - _alt
			var w := _weapon()
			if _is_player(target):
				_play("hurt", "%s_hurt_%d" % [w, _alt + 1])
			else:
				_play("hit", "%s_hit_%d" % [w, _alt + 1])
				if crit:
					_play("crit", "crit")
		"pick":
			if label.begins_with("냥"):
				_play("coin", "coin")
			elif label.begins_with("보물"):
				_play("coin_big", "coin_big")
			else:
				_play("item_pick", "item_pick")
		"ui":
			_play("ui", "ui_click")
		_:
			return false
	return true


func _weapon() -> String:
	var fc := get_tree().get_first_node_in_group("go_field_combat")
	var id := String(fc.call("active_id")) if fc else "self"
	return String(WEAPON_SFX.get(Weapons.type_of(id), "sword"))


func _is_player(target: Node) -> bool:
	if not is_instance_valid(target):
		return false
	return target.is_in_group("player") or (target.get_parent() != null and target.get_parent().is_in_group("player"))


func _play(kind: String, key: String) -> void:
	var ap: AudioStreamPlayer = _players.get(kind)
	if ap == null:
		return
	var now := Time.get_ticks_msec()
	if now - int(_last_ms.get(kind, -100000)) < int(float(GAP.get(kind, DEFAULT_GAP)) * 1000.0):
		return
	_last_ms[kind] = now
	counts[kind] = int(counts[kind]) + 1
	last[kind] = key
	var st: AudioStream = _streams.get(key)
	if st == null:
		return
	ap.stream = st
	ap.play()
