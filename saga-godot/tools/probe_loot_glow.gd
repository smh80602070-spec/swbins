extends SceneTree
## loot_glow 점검의 러너 래퍼 — 오토로드가 필요해 씬 호스트(tools/scene_probe_host.tscn)를 새 프로세스로 띄워 결과 줄을 그대로 전한다.
## 본체 tools/scene_probes/loot_glow.gd. 끝에 "PROBE loot_glow OK" 또는 "PROBE loot_glow FAIL n".

func _initialize() -> void:
	var out: Array = []
	var rc := OS.execute(OS.get_executable_path(), ["--headless", "--path", ProjectSettings.globalize_path("res://"), "res://tools/scene_probe_host.tscn", "--", "res://tools/scene_probes/loot_glow.gd"], out, true)
	for chunk in out:
		for line in String(chunk).split("\n"):
			if line.begins_with("PROBE ") or line.begins_with("  FAIL") or line.contains("SCRIPT ERROR"):
				print(line)
	if rc != 0 and not "\n".join(PackedStringArray(out)).contains("PROBE loot_glow"):
		print("PROBE loot_glow FAIL 1 (호스트 종료 코드 %d, 결과 줄 없음)" % rc)
	quit(rc)
