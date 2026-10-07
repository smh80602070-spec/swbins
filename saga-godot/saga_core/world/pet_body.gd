extends RefCounted

## G-0084 — 사가만리 신수 몸을 자체툴 GLB(assets/world/pet_<신수 id>.glb, K-0075: 앞 +Z·원점 발 밑·동작 일곱
## Idle·Walk·Run·Attack·Hit·Death·Special)로. 동행(egg_incubator)·들판 만남(pet_encounter)·도감 미리보기(codex_screen)가 부른다.
## 짓기는 들판 적과 같은 길(MonsterBody.build — 키 맞춤·Idle/Walk/Run 되풀이). GLB 가 없거나 못 부르면 코드 신수(CreatureBuilder.build_pet).
## **끄는 스위치**: SAGA_CODE_CREATURES=1 이면 코드 신수(들판 적 몸 G-0082 와 같은 하나). 탈것(mount.gd)은 안장 자리가 코드 몸에 묶여 여기 안 온다.

const MonsterBody := preload("res://saga_core/world/monster_body.gd")
const CreatureBuilder := preload("res://saga_core/world/creature_builder.gd")

const DIR := "res://assets/world/"


## 그 신수의 GLB 경로. 꺼짐·없음이면 "".
static func path_for(pet_id: String) -> String:
	if pet_id == "" or OS.get_environment("SAGA_CODE_CREATURES") != "":
		return ""
	var p := DIR + "pet_%s.glb" % pet_id
	return p if ResourceLoader.exists(p) else ""


## 신수 몸 하나(키 height_m). GLB 몸이면 이름 "PetBody", 코드 신수면 "Creature".
static func build(pet_id: String, height_m: float) -> Node3D:
	var p := path_for(pet_id)
	if p != "":
		var v := MonsterBody.build(p, height_m)
		if v != null:
			v.name = "PetBody"
			return v
		push_warning("pet_body fallback %s %s" % [pet_id, p])
	return CreatureBuilder.build_pet(pet_id, height_m)


## 소문자 동작 이름(idle·walk…) → 그 몸에 있는 이름(코드 신수는 소문자, GLB 는 Idle·Walk…). 없으면 "".
static func anim_of(ap: AnimationPlayer, want: String) -> String:
	if ap == null:
		return ""
	if ap.has_animation(want):
		return want
	var n := MonsterBody.anim_name(want)
	return n if ap.has_animation(n) else ""
