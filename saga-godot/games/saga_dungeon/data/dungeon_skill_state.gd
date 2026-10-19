extends Node

## PLAN.md 51장 "장비→빌드" — 무예(스킬) 랭크 상태. DungeonPartyState의
## world_eff_sum()과 같은 계약(dungeon_run_state.gd::_sum_eff()가 은사·
## 장비·부대에 이어 네 번째로 더하는 자리)이라 그 파일을 그대로 본떴다.
##
## **점수는 직업마다 따로 센다**(data-skill.js 헤더 "점수는 직업마다
## 따로 센다 — 무기를 바꿔도 그 나무의 점수는 그대로 남는다" 그대로).
## **점수를 얻는 자리** — 원작은 "인물 레벨만큼"인데 이 슬라이스엔 인물
## 레벨 자체가 없다. 대신 이미 있는 리듬(방 클리어마다 은사 하나,
## test_room.gd::_finish_exit())에 그대로 얹었다 — 방 하나 클리어할
## 때마다, **그 순간 장착 중인 무기가 정하는 직업**에 점 하나(원작과
## 다른 결정이지만 새 시스템을 만들지 않고 이미 있는 리듬을 재사용한다).
##
## project.godot [autoload]에 DungeonSkillState로 등록.

signal skills_changed

const SLOTS := 4

var points: Dictionary = {}  # cls_key(String) -> unspent point(int)
var ranks: Dictionary = {}   # skill_key(String) -> rank(int)
## G-0198 — 무예 넉 자리(Z·X·C·V), 웹 skill.js slots() 그대로 **직업마다 따로**: cls_key -> [키 넷] ("" = 빈 칸).
## 무기를 바꿨다 도로 쥐면 손이 그대로 살아난다.
var slots: Dictionary = {}
## G-0241 — 무예별 작은 나무 {무예 key: {xp, pts}}(dungeon_skill_tree.gd). 세이브 "skill_tree" 순수 추가.
var tree: Dictionary = {}


func restore_tree(saved: Variant) -> void:
	tree.clear()
	if typeof(saved) != TYPE_DICTIONARY:
		return
	for k in saved:
		var t: Variant = saved[k]
		if typeof(t) != TYPE_DICTIONARY:
			continue
		var pts: Array = []
		if t.get("pts", null) is Array:
			for v in t.pts:
				pts.append(int(v) if v != null else 0)
		tree[str(k)] = {"xp": int(t.get("xp", 0)), "pts": pts}


func award_point(cls_key: String) -> void:
	points[cls_key] = int(points.get(cls_key, 0)) + 1
	skills_changed.emit()


func points_for(cls_key: String) -> int:
	return int(points.get(cls_key, 0))


func rank_of(skill_key: String) -> int:
	return int(ranks.get(skill_key, 0))


## data-skill.js의 두 규칙(앞 단에 1점 필요·다 못 채운다) 그대로 —
## 점수가 있고, MAX_RANK 미만이고, 앞 단(prereq)에 1점 이상 있어야 한다.
func can_invest(skill_key: String) -> bool:
	var sk := DungeonSkills.skill_by_key(skill_key)
	if sk.is_empty():
		return false
	if points_for(str(sk.cls)) <= 0:
		return false
	if rank_of(skill_key) >= DungeonSkills.MAX_RANK:
		return false
	var pre := DungeonSkills.prereq_of(sk)
	if not pre.is_empty() and rank_of(str(pre.key)) <= 0:
		return false
	return true


func invest(skill_key: String) -> bool:
	if not can_invest(skill_key):
		return false
	var sk := DungeonSkills.skill_by_key(skill_key)
	ranks[skill_key] = rank_of(skill_key) + 1
	points[str(sk.cls)] = points_for(str(sk.cls)) - 1
	## 웹 learn() — 처음 배운 것은 빈 칸이 있으면 바로 걸어 준다(배우고도 못 쓰는 일이 없게).
	if rank_of(skill_key) == 1:
		auto_slot(skill_key)
	skills_changed.emit()
	return true


## 그 직업의 넉 자리(참조 — 길이가 넷이 아니면 맞춰 준다).
func slots_of(cls_key: String) -> Array:
	var s: Array = slots.get(cls_key, [])
	if s.size() != SLOTS:
		var fixed: Array = []
		for i in SLOTS:
			fixed.append(str(s[i]) if i < s.size() and s[i] != null else "")
		s = fixed
		slots[cls_key] = s
	return s


## 웹 autoSlot() — 활성 무예를 그 직업의 첫 빈 칸에. 이미 걸렸거나 칸이 없으면 false.
func auto_slot(skill_key: String) -> bool:
	var sk := DungeonSkills.skill_by_key(skill_key)
	if not DungeonSkills.is_active(sk):
		return false
	var s := slots_of(str(sk.cls))
	if s.has(skill_key):
		return false
	var i := s.find("")
	if i < 0:
		return false
	s[i] = skill_key
	return true


## 웹 setSlot() — 한 칸에 건다("" = 비우기). 이미 딴 칸에 걸린 것이면 자리를 맞바꾼다.
## 안 배운 것·패시브·다른 직업 것은 거절.
func set_slot(cls_key: String, idx: int, skill_key: String) -> bool:
	if idx < 0 or idx >= SLOTS:
		return false
	if skill_key != "":
		var sk := DungeonSkills.skill_by_key(skill_key)
		if not DungeonSkills.is_active(sk) or str(sk.cls) != cls_key or rank_of(skill_key) <= 0:
			return false
	var s := slots_of(cls_key)
	var was := s.find(skill_key) if skill_key != "" else -1
	if was >= 0 and was != idx:
		s[was] = s[idx]
	s[idx] = skill_key
	skills_changed.emit()
	return true


## 웹 equipped() — 그 직업의 넉 자리 중 지금 쓸 수 있는 것(배운 그 직업 활성 무예)만, 아니면 "".
func equipped(cls_key: String) -> Array:
	var out: Array = []
	for k in slots_of(cls_key):
		var sk := DungeonSkills.skill_by_key(str(k))
		out.append(str(k) if DungeonSkills.is_active(sk) and str(sk.cls) == cls_key and rank_of(str(k)) > 0 else "")
	return out


## saved_slots 가 없으면(G-0198 전 세이브) 배운 활성 무예를 표 순서로 직업마다 빈 칸에 채운다.
func restore(saved_points: Dictionary, saved_ranks: Dictionary, saved_slots: Variant = null) -> void:
	points.clear()
	for k in saved_points:
		points[str(k)] = int(saved_points[k])
	ranks.clear()
	for k in saved_ranks:
		ranks[str(k)] = int(saved_ranks[k])
	slots.clear()
	if typeof(saved_slots) == TYPE_DICTIONARY:
		for c in saved_slots:
			var arr: Variant = saved_slots[c]
			if typeof(arr) == TYPE_ARRAY:
				slots[str(c)] = (arr as Array).map(func(v): return str(v) if v != null else "")
				slots_of(str(c))
	else:
		for sk: Dictionary in DungeonSkills.SKILLS:
			if rank_of(str(sk.key)) > 0:
				auto_slot(str(sk.key))
	skills_changed.emit()


## dungeon_run_state.gd::_sum_eff()가 boons·장비·부대와 나란히 더하는
## 네 번째 자리 — 랭크가 있는 무예 중 이 eff_key를 쓰는 것만 더한다.
func world_eff_sum(eff_key: String) -> float:
	if eff_key == "":
		return 0.0
	var total := 0.0
	for skill_key in ranks:
		var r := int(ranks[skill_key])
		if r <= 0:
			continue
		var sk := DungeonSkills.skill_by_key(str(skill_key))
		if not sk.is_empty() and str(sk.eff) == eff_key:
			total += DungeonSkills.value_at(sk, r)
	return total
