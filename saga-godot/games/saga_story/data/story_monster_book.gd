extends RefCounted

## G-0374 괴물 카드 도감(메이플스토리 몬스터 컬렉션) — 사냥터 잡몹(StoryEnemies 명단 32 + 세 시대 8)을 쓰러뜨리면 낮은 확률로 그 종 카드 한 장.
##   한 장 = CARD_CHANCE(희귀 RARE_CHANCE · 미니 MINI_CHANCE) · 종마다 SET 장 모으면 "다 모음" — 다 모은 종 하나마다 공격 +ATK_PER(곱, 끝없이 쌓이지 않게 명단 수가 상한).
##   셈·카드 수는 StorySaveState.cards {종 이름: 장 수}(순수 추가 칸 — 옛 세이브는 빈 칸) · 공격은 story_player_base._effective_atk 가 atk_mul 을 곱한다.
##   보스·관문 대장·비경·부하는 종(species)이 없어 카드가 없다. 굴림은 rng 를 받아 점검이 씨앗으로 돌린다. SAGA_MONSTER_BOOK=0 이면 안 셈·곱 1.

const StoryEnemies := preload("res://games/saga_story/data/story_enemies.gd")

const CARD_CHANCE := 0.05
const MINI_CHANCE := 0.5
const RARE_CHANCE := 1.0
const SET := 5
const ATK_PER := 0.002

static var _own: RandomNumberGenerator = null


static func _rng() -> RandomNumberGenerator:
	if _own == null:
		_own = RandomNumberGenerator.new()
		_own.randomize()
	return _own


static func on() -> bool:
	return OS.get_environment("SAGA_MONSTER_BOOK") != "0"


## 도감 종 이름들(명단 차례 — 잡몹 다음 세 시대).
static func species() -> Array[String]:
	var out: Array[String] = []
	for e: Dictionary in StoryEnemies.ENEMIES + StoryEnemies.ERA_ENEMIES:
		var nm := String(e.name)
		if not out.has(nm):
			out.append(nm)
	return out


static func chance(rare: bool, mini: bool) -> float:
	return RARE_CHANCE if rare else (MINI_CHANCE if mini else CARD_CHANCE)


static func count(S: Object, nm: String) -> int:
	return int((S.get("cards") as Dictionary).get(nm, 0))


static func complete_count(S: Object) -> int:
	var n := 0
	for nm in species():
		if count(S, nm) >= SET:
			n += 1
	return n


static func found_count(S: Object) -> int:
	var n := 0
	for nm in species():
		if count(S, nm) > 0:
			n += 1
	return n


static func atk_mul(S: Object) -> float:
	return 1.0 + ATK_PER * complete_count(S) if on() else 1.0


## 한 마리 — 카드가 나오면 {name, n, set_done} · 안 나오면 {}. 다 모은 종도 더 나오지 않는다(남는 카드 없음).
static func on_kill(S: Object, nm: String, rare: bool, mini: bool, rng: RandomNumberGenerator = null) -> Dictionary:
	if not on() or not species().has(nm) or count(S, nm) >= SET:
		return {}
	var roll := rng.randf() if rng != null else _rng().randf()   # 제 rng — 판 전역 randf 흐름(골든·드롭)을 안 건드린다
	if roll >= chance(rare, mini):
		return {}
	var cards: Dictionary = S.get("cards")
	cards[nm] = count(S, nm) + 1
	return {"name": nm, "n": int(cards[nm]), "set_done": int(cards[nm]) >= SET}


static func toast_text(r: Dictionary) -> String:
	if r.is_empty():
		return ""
	if bool(r.set_done):
		return "🃏 %s 카드 다 모음! — 공격 +%.1f%%" % [String(r.name), ATK_PER * 100.0]
	return "🃏 %s 카드 (%d/%d)" % [String(r.name), int(r.n), SET]


## 「내 정보」·점검용 한 줄.
static func line(S: Object) -> String:
	return "🃏 카드 도감 %d/%d종 · 다 모음 %d · 공격 +%.1f%%" % [found_count(S), species().size(), complete_count(S), (atk_mul(S) - 1.0) * 100.0]
