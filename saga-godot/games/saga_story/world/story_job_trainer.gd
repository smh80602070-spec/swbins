extends Node3D

## VERTICAL_SLICE_STORY.md 4절 "제외" 목록 "전직 트리"의 첫 걸음.
##
## **재해석** — 원작은 전직에 딱히 정해진 위치가 없다(`js/ui.js`의 상시
## 열리는 "무예" 탭에서 고른다). 이 포트는 아직 탭 UI가 없어(가방·상점과
## 같은 이유, story_merchant.gd 참고) **허도(마을)에 자리 하나를 새로
## 두는 것**으로 좁혔다 — data-side.js heodo.npcs에 있는 기존 NPC(장로·
## 문지기·행상 등)를 흉내 내지 않고, "전직"이라는 새 기능 전용 자리임을
## 그대로 드러낸다.
##
## **선택 방식** — data-job.js JOBS tier:1 네 갈래(무사·궁수·협객·방사)
## 중 하나를 **직접 고른다**(상점의 "가장 싼 것 자동" 방식과 다르다 —
## 전직은 원작도 "되돌릴 수 없다"고 못박은 영구적 결정이라, 자동으로
## 대신 골라 주면 그 의미가 사라진다). 새 입력 액션 넷(`story_job_1~4`,
## 숫자 1~4 — potion_1~4와 물리 키는 같지만 다른 액션 이름이라 겹치지
## 않는다)을 K 범위 안에서만 받는다.
##
## **grow(hp/atk/mp)만 옮긴다** — 1차 전직에서 새로 열리는 무예 넷씩
## (총 16개, `data-job.js` SKILLS job:'warrior' 등)은 범위 밖(다음 걸음).
## 지금은 "직업을 고르면 스탯이 달라진다"까지만 검증한다.
##
## **2026-09-13 추가(같은 날 더) — SP(무예 점수) 투자.** 전직 전에는
## 숫자 1~4가 갈래를 고르고, **전직 후에는 같은 숫자 1~4가 그 직업의
## 무예 넷(StoryCombat.JOB_SKILL_KEYS 순서 — story_job_skill_1~4와 같은
## 순서) 중 하나에 SP 1점을 투자**하는 것으로 바뀐다 — 새 입력 액션을
## 안 늘리고 같은 넷을 "고르기 전/후" 두 자리로 재사용한다(허도 안에
## 탭 UI가 없어 이 자리 하나로 both를 겸한다).
##
## **2026-09-13 추가(같은 날 더 더) — 2~4차 전직.** SP 투자(숫자 1~4)와는
## 달리 진급은 "되돌릴 수 없다"는 의미가 더 무거운 결정이라 숫자 키와
## 안 겹치는 새 입력 액션(`story_job_advance`, P)을 하나 늘렸다 — 상점의
## K(구매)·전직 전의 숫자(갈래 선택)와 마찬가지로 이번에도 자동으로
## 대신 골라 주지 않는다(스스로 눌러야 진급한다). 갈래가 안 갈리므로
## (StoryCombat.job_next()) 지금 job에서 갈 수 있는 다음 자리는 항상
## 최대 하나뿐이라 "어느 걸 고를지" UI가 필요 없다.

const StoryNpcBody := preload("res://games/saga_story/world/story_npc_body.gd")
const Toast := preload("res://saga_core/ui/toast.gd")
const StoryCombat := preload("res://games/saga_story/data/story_combat.gd")

const BODY_COLOR := Color(0.25, 0.35, 0.72)  # 상인(붉은 톤)과 구분되는 파란 톤
const RANGE_RADIUS := 1.8

## data-job.js JOBS tier:1의 등장 순서 그대로 — story_job_1~4가 이 순서에 대응.
const JOB_ORDER := ["warrior", "archer", "rogue", "mage"]

var _player_in_range := false


func _ready() -> void:
	_spawn_visual()
	_spawn_area()


func _spawn_visual() -> void:
	## 2026-09-30 — 색 캡슐 대신 VRoid 몸(story_npc_body.gd).
	add_child(StoryNpcBody.build("job_trainer"))


func _spawn_area() -> void:
	var area := Area3D.new()
	area.name = "TrainerRange"
	var cs := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = RANGE_RADIUS
	cs.shape = shape
	area.add_child(cs)
	area.position = Vector3(0, 0.85, 0)
	area.body_entered.connect(_on_range_entered)
	area.body_exited.connect(_on_range_exited)
	add_child(area)


func _on_range_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	_player_in_range = true
	Toast.show(self, _status_text(), 2.5)


func _on_range_exited(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	_player_in_range = false


func _status_text() -> String:
	if StorySaveState.job != "none":
		var name_: String = String(StoryCombat.job_info(StorySaveState.job).get("name", StorySaveState.job))
		var keys: Array = StoryCombat.JOB_SKILL_KEYS.get(StorySaveState.job, [])
		var levels := ""
		for i in keys.size():
			levels += "%d:%s(Lv%d) " % [i + 1, String(keys[i]), StorySaveState.skill_level(String(keys[i]))]
		var sig_name: String = String(StoryCombat.SIGNATURE_NAME.get(StoryCombat.job_root(StorySaveState.job), ""))
		var mentor: Dictionary = StoryCombat.mentor_of(StorySaveState.job)
		var text := "🎖️ %s — SP %d/%d 남음 — %s— 회피(Shift) 길게 눌러 %s\n👤 스승 %s — 사제 정 %d/%d" % [
			name_, StorySaveState.sp_left(), StorySaveState.sp_total(), levels, sig_name,
			String(mentor.name), StorySaveState.mentor_bond, StorySaveState.MENTOR_BOND_THRESHOLDS[-1],
		]
		var next_key := StoryCombat.job_next(StorySaveState.job)
		if next_key != "":
			var next_name: String = String(StoryCombat.job_info(next_key).get("name", next_key))
			if StorySaveState.can_advance_job(next_key):
				text += "— P키로 %s 승급 가능!" % next_name
			else:
				text += "— 다음: %s(Lv.%d, 지금 무예 하나를 Lv.%d 이상으로)" % [
					next_name, StoryCombat.job_level_need(next_key), StoryCombat.job_advance_skill_gate(next_key),
				]
		return text
	if StorySaveState.level < StoryCombat.JOB_CHANGE_LEVEL:
		return "🎖️ 전직은 Lv.%d부터(현재 Lv.%d) — 1:무사 2:궁수 3:협객 4:방사" % [StoryCombat.JOB_CHANGE_LEVEL, StorySaveState.level]
	return "🎖️ 전직할 수 있다 — 1:무사 2:궁수 3:협객 4:방사"


## story_merchant.gd·story_portal.gd와 같은 폴링 방식.
func _process(_delta: float) -> void:
	if not _player_in_range:
		return
	if Input.is_action_just_pressed("story_interact"):
		Toast.show(self, _status_text(), 2.5)
		return
	if StorySaveState.job != "none":
		if Input.is_action_just_pressed("story_job_advance"):
			_advance()
			return
		_raise(0)
		_raise(1)
		_raise(2)
		_raise(3)
		## **2026-09-13 추가(같은 날 더 더 더) — tier1 다섯째·여섯째 무예.**
		## story_job_5/6(물리키 5·6) — tier2(다섯 자리뿐)는 _raise()가
		## idx>=keys.size()면 조용히 넘어가므로 6번째(story_job_6)는
		## 자연히 안 쓰인다.
		_raise(4)
		_raise(5)
		return
	for i in JOB_ORDER.size():
		if Input.is_action_just_pressed("story_job_%d" % (i + 1)):
			_choose(JOB_ORDER[i])
			return


func _choose(key: String) -> void:
	if not StorySaveState.choose_job(key):
		Toast.show(self, _status_text(), 2.5)
		return
	var it: Dictionary = StoryCombat.JOBS_TIER1[key]
	var mentor: Dictionary = StoryCombat.mentor_of(key)
	Toast.show(self, "🎖️ %s로 전직! 체력+%d 공격+%d%s\n👤 스승 %s — \"%s\"" % [
		String(it.name), int(it.hp), int(it.atk),
		(" 기력+%d" % int(it.mp)) if float(it.mp) > 0.0 else "",
		String(mentor.name), String(mentor.quote),
	], 4.0)


## 2~4차 전직 — job.js join() 그대로: 진급하면 job이 다음 자리로
## 덮어써진다(사슬은 story_combat.gd JOB_FROM이 데이터로 갖고 있으니
## 하위 무예·grow는 그대로 다 유지된다 — 잃는 게 없다).
func _advance() -> void:
	var next_key := StoryCombat.job_next(StorySaveState.job)
	if next_key == "" or not StorySaveState.advance_job(next_key):
		Toast.show(self, _status_text(), 2.5)
		return
	var it: Dictionary = StoryCombat.job_info(next_key)
	var mentor: Dictionary = StoryCombat.mentor_of(next_key)
	Toast.show(self, "🎖️ %s로 승급! 체력+%d 공격+%d%s\n👤 스승 %s — \"%s\"" % [
		String(it.name), int(it.hp), int(it.atk),
		(" 기력+%d" % int(it.mp)) if float(it.mp) > 0.0 else "",
		String(mentor.name), String(mentor.quote),
	], 4.0)


## SP 투자 — story_job_(idx+1) 액션이 눌리면 그 직업의 idx번째 무예에
## 1점 찍는다(job.js raise() 그대로: 이미 만렙이거나 SP가 없으면 조용히
## 실패, 토스트로만 알린다 — 원문 toast 'weak' 정신).
func _raise(idx: int) -> void:
	if not Input.is_action_just_pressed("story_job_%d" % (idx + 1)):
		return
	var keys: Array = StoryCombat.JOB_SKILL_KEYS.get(StorySaveState.job, [])
	if idx >= keys.size():
		return
	var key: String = String(keys[idx])
	if StorySaveState.raise_skill(key):
		Toast.show(self, "🎖️ %s Lv.%d (SP %d 남음)" % [key, StorySaveState.skill_level(key), StorySaveState.sp_left()], 2.0)
	else:
		Toast.show(self, _status_text(), 2.5)
