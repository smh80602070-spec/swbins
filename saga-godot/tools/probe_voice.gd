extends SceneTree

## 대사 음성 재생기(saga_core/audio/voice.gd, G-0111) 점검 — 표·파일·빠진 줄 건너뛰기·간격·안내 키·켜기 설정·배선 자리.
##   godot --headless --path saga-godot --script res://tools/probe_voice.gd
## 끝에 "PROBE voice OK" 또는 "PROBE voice FAIL n". 설정은 user://voice_probe/ 에만 두고 끝에 지운다(진짜 user://audio.cfg 는 안 건드림).
## 헤드리스라 소리는 안 난다 — 고른 파일 길(last_path)과 파일 존재(ResourceLoader.exists)만 본다.

const Voice := preload("res://saga_core/audio/voice.gd")
const Bgm := preload("res://saga_core/audio/bgm.gd")
const DIR := "user://voice_probe/"
const HOOKS := {
	"res://saga_core/combat_feel.gd": "Voice.say(\"pickup\")",
	"res://saga_core/audio/bgm.gd": "Voice.system(key)",
	"res://games/saga_go/combat/field_combat.gd": "Voice.say(\"shout\", active_id(), true)",
	"res://games/saga_go/world/story_quest.gd": "Voice.say(\"greet\", _dlg_npc)",
	"res://games/saga_forest/world/villager_builder.gd": "Voice.say(\"greet\"",
	"res://games/saga_dungeon/player/melee_attack.gd": "Voice.say(\"shout\")",
	"res://games/saga_story/player/story_player.gd": "Voice.say(\"shout\")",
}

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _idle(n: Node) -> void:
	n._at.clear()
	n._busy_until = 0
	n._busy_prio = 0


func _fresh() -> Node:
	Voice.reset_for_test()
	await process_frame
	var n := Voice.state()
	await process_frame
	return n


func _initialize() -> void:
	await process_frame
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(DIR))
	Voice.cfg_path = DIR + "audio.cfg"
	Bgm.cfg_path = DIR + "audio.cfg"
	if FileAccess.file_exists(Voice.cfg_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(Voice.cfg_path))
	var n := await _fresh()
	Voice.always = true   # _fresh(reset_for_test) 가 끄므로 그 뒤에

	# ① 표
	var j: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(Voice.dir.path_join("voice_list.json")))
	var voices: Array = (j.get("voices", {}) as Dictionary).keys()
	check(voices.size() == 11 and voices.has(Voice.NARRATOR), "목소리 11(해설 NA 포함) — %d" % voices.size())
	var per := []
	for k in ["shout", "pickup", "greet", "system"]:
		per.append((n.lines.get(k, []) as Array).size())
	check(per == [20, 20, 20, 20], "갈래 넷 × 20줄 — %s" % [per])
	check(n.assign.size() == 299, "인물 목소리 배정 299 — %d" % n.assign.size())

	# ② 파일 — 인물 목소리 열 × (외침·획득·인사) + 해설 × 안내, 빠진 줄 빼고 모두 있어야
	var have := 0
	var lost := []
	for v in Voice.HASH_VOICES:
		for k in ["shout", "pickup", "greet"]:
			for lid in n.lines[k]:
				if n.missing.has(v + "/" + lid):
					continue
				if ResourceLoader.exists(n.path_of(v, lid)):
					have += 1
				else:
					lost.append(v + "/" + lid)
	for lid in n.lines["system"]:
		if n.missing.has(Voice.NARRATOR + "/" + lid):
			continue
		if ResourceLoader.exists(n.path_of(Voice.NARRATOR, lid)):
			have += 1
		else:
			lost.append("NA/" + lid)
	check(lost.is_empty() and have == 620 - n.missing.size(), "파일 %d 줄(620 − 빠진 %d), 없는 것 %s" % [have, n.missing.size(), lost.slice(0, 5)])

	# ③ 빠진 줄은 안 고른다
	var picked_missing := 0
	for v in Voice.HASH_VOICES:
		for i in 60:
			var lid: String = n.pick("shout", v)
			if lid == "" or n.missing.has(v + "/" + lid):
				picked_missing += 1
	check(picked_missing == 0, "외침 600번 고르기에 빠진 줄 0 — %d" % picked_missing)
	var picked_skip := 0
	for k in Voice.SKIP:
		for v in Voice.HASH_VOICES:
			for i in 60:
				if (Voice.SKIP[k] as Array).has(n.pick(k, v)):
					picked_skip += 1
	check(picked_skip == 0, "획득·인사 1200번 고르기에 상황 줄(SKIP) 0 — %d" % picked_skip)
	check(Voice.speaker == "self", "말하는 이 기본 = 주인공 self")

	# ④ 목소리 고르기 — 배정표 그대로, 없는 id 는 늘 같은 해시 목소리
	var first_id: String = n.assign.keys()[0]
	check(n.voice_of(first_id) == String(n.assign[first_id]), "배정표 인물 %s → %s" % [first_id, n.voice_of(first_id)])
	var hv: String = n.voice_of("probe_nobody")
	check(Voice.HASH_VOICES.has(hv) and n.voice_of("probe_nobody") == hv, "표에 없는 id → 해시 목소리 %s(같은 값)" % hv)

	# ⑤ 말하기·간격
	var p1 := Voice.say("shout", first_id)
	var want_pre := "voice_%s_shout_" % n.assign[first_id]
	check(p1.get_file().begins_with(want_pre) and ResourceLoader.exists(p1), "외침 → %s" % p1.get_file())
	check(Voice.say("shout", first_id) == "", "간격(%.1f초) 안 두 번째 외침은 무시" % Voice.GAP["shout"])
	check(Voice.say("greet", first_id) == "", "외침 중엔 낮은 순위(인사)는 버린다")
	n._busy_until = 0
	check(Voice.say("greet", first_id) != "", "말이 끝나면 다른 갈래(인사)는 따로 센다")
	_idle(n)
	Voice.say("shout", first_id)
	check(Voice.say("shout", first_id, true) != "", "필살(sure)은 간격 안에서도 외친다")
	check(Voice.say("shout", first_id) == "", "필살 외침 중 보통 외침은 못 끊는다")
	check(Voice.say("pickup", first_id) == "", "필살 외침 중 줍기 말은 버린다")
	check(Voice.say("system", first_id) == "", "say 로는 안내를 못 낸다(system 은 해설만)")
	Voice.always = false
	var said := 0
	for i in 200:
		_idle(n)
		if Voice.say("shout", first_id) != "":
			said += 1
	check(said > 30 and said < 110, "외침 확률 %.0f%% — 200번 중 %d" % [Voice.CHANCE["shout"] * 100.0, said])
	_idle(n)
	check(Voice.say("shout", first_id, true) != "", "sure 면 확률 없이 외친다")
	Voice.always = true

	# ⑥ 안내 키 → 해설 줄
	_idle(n)
	check(Voice.system("levelup").get_file() == "voice_NA_system_06.ogg", "levelup → 해설 system_06")
	check(Voice.system("quest").get_file() == "voice_NA_system_08.ogg", "다른 안내 키는 바로 이어서(키마다 간격)")
	check(Voice.system("levelup") == "", "같은 안내 키는 간격 안 무시")
	check(Voice.say("pickup", first_id) == "", "안내 중 줍기 말은 버린다")
	check(not Voice.SYSTEM.has("discover"), "도감 짧은 음악(discover)은 안내 없음(새 지역 줄과 안 맞음)")
	_idle(n)
	check(Voice.system("nope") == "", "모르는 키는 조용히")
	var bad_keys := []
	for key in Voice.SYSTEM:
		if not ResourceLoader.exists(n.path_of(Voice.NARRATOR, String(Voice.SYSTEM[key]))):
			bad_keys.append(key)
	check(bad_keys.is_empty(), "안내 키 %d 개 모두 파일 있음 %s" % [Voice.SYSTEM.size(), bad_keys])
	_idle(n)
	Bgm.stinger(null, "victory")
	check(n.last_path.get_file() == "voice_NA_system_12.ogg", "Bgm.stinger(victory) → 해설 system_12 — %s" % n.last_path.get_file())

	# ⑦ 끄기·설정 유지(같은 파일의 [bgm] 절은 남는다)
	var c0 := ConfigFile.new()
	c0.set_value("bgm", "volume", 0.3)
	c0.save(Voice.cfg_path)
	Voice.set_enabled(false)
	Voice.set_volume(0.5)
	_idle(n)
	check(Voice.say("greet", first_id) == "" and Voice.system("levelup") == "", "꺼지면 말 안 함")
	var c := ConfigFile.new()
	c.load(Voice.cfg_path)
	check(c.get_value("voice", "enabled", true) == false and is_equal_approx(float(c.get_value("bgm", "volume", 0.0)), 0.3), "설정 저장 — [voice] 꺼짐 · [bgm] 그대로")
	n = await _fresh()
	check(n.enabled == false and is_equal_approx(n.volume, 0.5), "다시 만들면 설정을 읽는다")
	Voice.set_enabled(true)

	# ⑧ 배선 자리
	var miss := []
	for f in HOOKS:
		if not FileAccess.get_file_as_string(f).contains(HOOKS[f]):
			miss.append(f.get_file())
	check(miss.is_empty(), "배선 %d 곳 %s" % [HOOKS.size(), miss])

	Voice.speaker = "probe"
	Voice.always = true
	Voice.reset_for_test()
	check(Voice.speaker == "self" and not Voice.always, "reset_for_test 가 말하는 이·always 를 되돌림")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(Voice.cfg_path))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(DIR))
	await process_frame
	print("PROBE voice OK" if fails == 0 else "PROBE voice FAIL %d" % fails)
	quit(0 if fails == 0 else 1)
