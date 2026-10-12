extends Node

## "제외" 목록 3번 — 단약(丹藥)과 요대(腰帶). 웹판 `potion.js`의 벨트
## 규칙(4칸, 칸마다 같은 등급이 4개까지 쌓인다, 차면 못 줍는다) 그대로.
##
## **기력단(mana)은 뺐다** — 우리 쪽엔 채울 기력(MP) 자원 자체가 없다
## (플레이어에게 MP 스탯이 없음). 마실 게 아무 효과도 안 내는 소비
## 아이템을 벨트에 쌓아 두는 건 UX상 의미가 없어, 원작처럼 "두 종류를
## 표에 얹어 두고 하나만 무효화"하는 대신 아예 회복단 하나만 옮겼다
## (KINDS 표 자체를 안 둔 이유 — 표를 만들어도 항상 하나만 골라진다).
##
## project.godot [autoload]에 DungeonPotionState로 등록.

signal belt_changed

const Meridian := preload("res://games/saga_dungeon/data/dungeon_meridian.gd")   # G-0217 경락도
const SLOTS := 4
const STACK := 4

## GRADES — potion.js 그대로(등급명·최대치 대비 %·값).
const GRADES: Array[Dictionary] = [
	{ "g": 0, "name": "소(小)", "pct": 25.0, "price": 40 },
	{ "g": 1, "name": "중(中)", "pct": 45.0, "price": 110 },
	{ "g": 2, "name": "대(大)", "pct": 70.0, "price": 280 },
]

## belt[i] = {}(빈 칸) 또는 {"g": int, "n": int} — weapon/charm과 같은
## "빈 Dictionary = 없음" 관례.
var belt: Array[Dictionary] = [{}, {}, {}, {}]


static func grade_of(g: int) -> Dictionary:
	return GRADES[clampi(g, 0, GRADES.size() - 1)]


## potion.js price(g, lv) 그대로 — 행상이 파는 값.
static func price(g: int, lv: int) -> int:
	return int(roundf(float(grade_of(g).price) * (1.0 + float(lv) * 0.06)))


## potion.js rollDrop(floor)의 등급 갈래만(종류는 회복단 고정) — 깊이가
## 감당하는 등급까지만, 낮은 등급일수록 잘 나온다(42%씩 escalate).
static func roll_drop_grade(floor_num: int) -> int:
	var cap: int = 2 if floor_num >= 14 else (1 if floor_num >= 6 else 0)
	var g := 0
	while g < cap and randf() < 0.42:
		g += 1
	return g


## potion.js add(k,g) — 같은 등급이 쌓인 칸부터, 없으면 빈 칸에.
func add(g: int) -> Dictionary:
	g = clampi(g, 0, GRADES.size() - 1)
	for i in range(belt.size()):
		if not belt[i].is_empty() and int(belt[i].g) == g and int(belt[i].n) < STACK:
			belt[i]["n"] = int(belt[i].n) + 1
			belt_changed.emit()
			return {"ok": true, "slot": i}
	for i in range(belt.size()):
		if belt[i].is_empty():
			belt[i] = {"g": g, "n": 1}
			belt_changed.emit()
			return {"ok": true, "slot": i}
	return {"ok": false, "reason": "full"}


## potion.js use(slot) — player_health가 이미 가득이면(원작 "이미 가득이면
## 안 마신다") 실패, 한 알 아낀다.
func use(slot: int) -> Dictionary:
	slot = clampi(slot, 0, SLOTS - 1)
	var row: Dictionary = belt[slot]
	if row.is_empty() or int(row.get("n", 0)) <= 0:
		return {"ok": false, "reason": "empty"}
	var found := get_tree().get_nodes_in_group("player_health")
	if found.is_empty():
		return {"ok": false, "reason": "off"}
	var health: Node = found[0]
	if Meridian.has_rule("diamond"):   # G-0217 금강(경락 규칙) — 단약으로 체력이 안 찬다(한 알 아낀다)
		return {"ok": false, "reason": "diamond"}
	if health.hp >= health.max_hp:
		return {"ok": false, "reason": "full"}
	var pct: float = grade_of(int(row.g)).pct
	health.heal_by(health.max_hp * pct / 100.0)
	row["n"] = int(row.n) - 1
	if int(row.n) <= 0:
		belt[slot] = {}
	belt_changed.emit()
	return {"ok": true, "g": int(row.g)}


func total() -> int:
	var n := 0
	for row: Dictionary in belt:
		if not row.is_empty():
			n += int(row.n)
	return n


func restore(saved: Array) -> void:
	var next: Array[Dictionary] = [{}, {}, {}, {}]
	for i in range(mini(saved.size(), SLOTS)):
		var row: Variant = saved[i]
		if row is Dictionary and not (row as Dictionary).is_empty():
			next[i] = {"g": int((row as Dictionary).get("g", 0)), "n": int((row as Dictionary).get("n", 0))}
	belt = next
	belt_changed.emit()
