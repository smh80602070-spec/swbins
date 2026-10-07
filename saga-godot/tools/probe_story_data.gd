extends SceneTree

## GO 이야기 표(games/saga_go/data/story.gd — 장 CHAPTERS·인물 NPCS·역 STATIONS·동료 MEMBERS) 골든 점검 — 표를 파일로 쪼갤 때(R-4) 값이 한 글자도
## 안 바뀌었는지 본다. 장 수·접근 함수·표 전체 JSON 의 md5 를 낸다.
##   godot --headless --path saga-godot --script res://tools/probe_story_data.gd
## 끝에 "PROBE story_data OK md5=…". 기대값(GOLDEN)이 비어 있으면 값만 찍고 OK, 채워져 있으면 다르면 FAIL.

const Story := preload("res://games/saga_go/data/story.gd")

const GOLDEN := "0011a9968c47aa7d99c491528c506e6d"  # G-0080 17부(54~56장)·한별·도담·반디 자리 더한 뒤(2026-10-08). 그 전 G-0079 6e4005bc…·G-0078 74da47bf…·G-0077 8253d4cd…·G-0074 853c63cb…. 처음 값 e901126a… 는 쪼개기 전 HEAD(10-01)
const CHAPTER_COUNT := 56

var fails := 0


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		fails += 1
		print("  FAIL ", msg)


func _initialize() -> void:
	check(Story.CHAPTERS.size() == CHAPTER_COUNT, "장 %d개 (기대 %d)" % [Story.CHAPTERS.size(), CHAPTER_COUNT])
	var ok_access := true
	for i in Story.CHAPTERS.size():
		ok_access = ok_access and Story.chapter(i) == Story.CHAPTERS[i]
		for s in Story.CHAPTERS[i].steps.size():
			ok_access = ok_access and Story.step_of(i, s) == Story.CHAPTERS[i].steps[s]
	check(ok_access, "chapter()·step_of() 가 표와 같다")
	check(not Story.all_done(0) and Story.all_done(Story.CHAPTERS.size()), "all_done() 경계")
	var tables := {"CHAPTERS": Story.CHAPTERS, "NPCS": Story.NPCS, "STATIONS": Story.STATIONS, "MEMBERS": Story.MEMBERS, "SEAL_MARKS": Story.SEAL_MARKS, "SEAL_LAYOUT": Story.SEAL_LAYOUT}
	var log := ""
	for k in tables:
		log += k + "=" + JSON.stringify(tables[k], "", true) + ";"
	var md5 := log.md5_text()
	if GOLDEN != "" and md5 != GOLDEN:
		fails += 1
	print("  log %dB" % log.length())
	print("PROBE story_data ", "OK" if fails == 0 else "FAIL %d" % fails, " md5=", md5)
	quit(1 if fails > 0 else 0)
